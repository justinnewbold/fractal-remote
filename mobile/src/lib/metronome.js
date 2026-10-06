import { useEffect, useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import clickSound from '../../assets/click.wav'

import { setUnitMetronome } from './device'
import { DEFAULT_METRONOME, beatMs, clicks, metronomeSetting, nextBeat } from './metronome-rules'
import { tick } from './feedback'
import { logDebug } from './debugLog'

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

/**
 * Change the setting, and tell the unit if its half changed.
 *
 * Only the unit's half is written, and only when it changes: turning the
 * phone's tap on must not reach out and switch the unit's click off when
 * somebody had turned it on at the unit by hand.
 */
export async function setMetronome(patch, slug) {
  const before = clicks(setting).unit
  setting = metronomeSetting({ ...setting, ...patch })
  announce()
  AsyncStorage.setItem(KEY, JSON.stringify(setting)).catch(() => {})
  const after = clicks(setting).unit
  if (before === after) return { ok: true }
  try {
    const said = await setUnitMetronome(slug, after)
    if (said?.ok === false && !said?.unsupported) logDebug('metronome', 'the unit did not take it', JSON.stringify(said))
    return said || { ok: true }
  } catch (err) {
    logDebug('metronome', 'could not reach the unit', String(err?.message || err))
    return { ok: false, message: String(err?.message || err) }
  }
}

/**
 * Tell a unit that has just arrived, when its click is meant to be on.
 *
 * A unit switched on after the phone, or the other unit picked under Which
 * unit, has its own idea of whether it is clicking. If the setting says the
 * unit clicks, this says so to the unit in front of it now.
 */
export function useUnitMetronome(slug, present) {
  useEffect(() => {
    if (!present || !clicks(setting).unit) return
    setUnitMetronome(slug, true).catch(() => {})
  }, [slug, present])
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
 */
export function usePhoneClick(bpm, onBeat) {
  const s = useMetronome()
  const on = clicks(s).phone
  const beat = beatMs(bpm)
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
}
