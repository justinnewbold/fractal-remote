import { useEffect, useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import clickSound from '../../assets/click.wav'

import { readUnitMetronome, setUnitMetronome } from './device'
import { DEFAULT_METRONOME, beatMs, clicks, metronomeSetting, nextBeat, switchHeardOn, unitClick } from './metronome-rules'
import { useRig } from './rig'
import { useBluetoothOn } from './bluetooth'
import { isDemo } from './demo'
import { tick } from './feedback'
import { logDebug } from './debugLog'
import { isUnsupported } from './unsupported'

/**
 * THE METRONOME SETTING, and the two things it drives.
 *
 * "A metronome that plays out loud that can be toggled on and off in
 * settings … play on the unit or the phone or both." Settings → Metronome is
 * the switch and the choice of where; this keeps the answer, tells the unit,
 * and runs the phone's half. The rules — which number switches which unit,
 * and when a beat is due — are shared/metronome.mjs's.
 */

const KEY = 'fractal.metronome'
let setting = DEFAULT_METRONOME
const watchers = new Set()

const announce = () => {
  for (const fn of watchers) fn()
}

AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return
    setting = metronomeSetting(JSON.parse(raw))
    announce()
  })
  .catch(() => {})

export const metronome = () => setting

export function useMetronome() {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => setting,
    () => setting
  )
}

/*
 * Whether the unit has said its own click is on, since the app last switched
 * it — for the unit it said it of.
 *
 * "It doesn't turn it on the unit on the FM3." The unit answers the write
 * "ok" whenever it does not object, and nobody has yet seen an FM3 act on its
 * switch, so "ok" is not taken for a click. Until the switch reads back as on,
 * Unit keeps the phone clicking as well (shared clicks()), and the phone stops
 * the moment the unit says it is clicking.
 */
let heard = { slug: null, on: false }
const hear = (slug, on) => {
  if (heard.slug === slug && heard.on === on) return
  heard = { slug, on }
  announce()
}
export const unitHeardOn = (slug) => heard.slug === slug && heard.on

/** unitHeardOn as a hook: the Metronome page and the phone's click both follow it. */
export function useUnitHeardOn(slug) {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => unitHeardOn(slug),
    () => unitHeardOn(slug)
  )
}

/**
 * Switch the unit's click, then ask the unit where its switch is.
 *
 * The answer goes into the log, because "ok" only means the unit did not
 * object, and into `heard`, because the phone keeps time until the unit says
 * it is clicking. Switching it off is believed straight away: the phone
 * clicking on through a moment of silence costs nothing.
 */
async function switchUnit(slug, on) {
  if (!on) hear(slug, false)
  const said = await setUnitMetronome(slug, on)
  if (said?.ok === false && !said?.unsupported) logDebug('metronome', 'the unit did not take it', JSON.stringify(said))
  if (said?.ok !== false && !said?.simulated) {
    readUnitMetronome(slug)
      .then((value) => {
        logDebug(
          'metronome',
          value === null ? 'the unit did not say where its metronome switch is' : `the unit says its metronome switch is at ${value}`,
          `asked for ${on ? 'on' : 'off'}`
        )
        /* Only if the setting still asks for it: a quick on-then-off must not hear the first answer last. */
        if (on && clicks(setting, true).unit) hear(slug, switchHeardOn(value))
      })
      .catch(() => {})
  }
  return said
}

/**
 * Change the setting, and tell the unit if its half changed.
 *
 * Only the unit's half is written, and only when it changes: turning the
 * phone's tap on must not reach out and switch the unit's click off when
 * somebody had turned it on at the unit by hand.
 */
export async function setMetronome(patch, slug, here = {}) {
  /* Where the unit's click cannot be switched (an AM4, Bluetooth, the demo), its half never changes. */
  const can = unitClick(slug, here).can
  const before = clicks(setting, can).unit
  setting = metronomeSetting({ ...setting, ...patch })
  announce()
  AsyncStorage.setItem(KEY, JSON.stringify(setting)).catch(() => {})
  const after = clicks(setting, can).unit
  if (before === after) return { ok: true }
  try {
    return (await switchUnit(slug, after)) || { ok: true }
  } catch (err) {
    /* A unit (or a link: Bluetooth refuses every setting write) that has no
       click to switch is not a unit that failed to take it. */
    if (isUnsupported(err)) return { ok: false, unsupported: true }
    logDebug('metronome', 'could not reach the unit', String(err?.message || err))
    return { ok: false, message: String(err?.message || err) }
  }
}

/**
 * Tell a unit that has just arrived, when its click is meant to be on.
 *
 * A unit switched on after the phone, or the other unit picked under Which
 * unit, has its own idea of whether it is clicking. If the setting says the
 * unit clicks, this says so to the unit in front of it now. A unit that goes
 * is no longer heard clicking, so the phone covers until the next one says.
 */
export function useUnitMetronome(slug, present, here = {}) {
  const bluetooth = Boolean(here.bluetooth)
  useEffect(() => {
    if (!present) {
      hear(null, false)
      return
    }
    if (!clicks(setting, unitClick(slug, { bluetooth }).can).unit) return
    switchUnit(slug, true).catch((err) => logDebug('metronome', 'could not tell the unit it arrived clicking', String(err?.message || err)))
  }, [slug, present, bluetooth])
}

/* Whether this unit's own click can be switched from here: the phone keeps time where it cannot. */
const ofSlug = (s) => s.deviceSlug
function useUnitCan() {
  const slug = useRig(ofSlug)
  const demo = isDemo()
  const bluetooth = useBluetoothOn() && !demo
  return { can: unitClick(slug, { bluetooth, demo }).can, heard: useUnitHeardOn(slug) }
}

/*
 * The click itself: thirty milliseconds of tick (assets/click.wav), loaded
 * once and played from the top on every beat. Made on first use, not at
 * launch, so a phone that never turns the metronome on never opens audio.
 *
 * Plays with the ring switch on silent — a metronome somebody turned on is a
 * sound they asked for — and alongside whatever else is playing, so a backing
 * track keeps going under it.
 */
let player = null
const click = () => {
  try {
    if (!player) {
      setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {})
      player = createAudioPlayer(clickSound)
    }
    player.seekTo(0)
    player.play()
  } catch {
    // A phone that cannot make the sound still flashes and taps.
  }
}

/**
 * The phone's half: a click out loud on every beat, a tap you feel with it,
 * and a flash for the screen.
 *
 * Counted from when it started rather than from the last beat (nextBeat), so
 * a timer that runs late once does not drag every beat after it. `onBeat` is
 * handed each beat so a screen can flash with it.
 *
 * Answers whether it is clicking right now: the setting says the phone clicks
 * AND there is a tempo to click at. MetronomeBeat keeps the screen awake on
 * that, and on nothing wider, so a phone with the click switched on but no
 * tempo yet still sleeps as it always has.
 */
export function usePhoneClick(bpm, onBeat) {
  const s = useMetronome()
  const { can, heard: heardOn } = useUnitCan()
  const on = clicks(s, can, heardOn).phone
  const beat = beatMs(bpm)
  const running = Boolean(on && beat)
  useEffect(() => {
    if (!on || !beat) return undefined
    const startedAt = Date.now()
    let timer = null
    let alive = true
    const step = () => {
      if (!alive) return
      click()
      tick()
      onBeat?.()
      const due = nextBeat(startedAt, Date.now(), beat)
      timer = setTimeout(step, Math.max(0, due - Date.now()))
    }
    step()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [on, beat, onBeat])
  return running
}
