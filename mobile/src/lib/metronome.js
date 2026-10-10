import { useEffect, useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio'
import clickSound from '../../assets/click.wav'
import clickPadded from '../../assets/click-pad.wav'

import { readUnitMetronome, setUnitMetronome } from './device'
import { DEFAULT_METRONOME, beatMs, clicks, flashLead, flashNudge, followSwitch, metronomeSetting, nextBeat, unitClick } from './metronome-rules'
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
 * Switch the unit's click, then follow where the unit says its switch is.
 *
 * Its answers go into the log — "ok" only means the unit did not object —
 * and into `heard`, because the phone keeps time until the unit says it is
 * clicking. Asked again while Unit is picked (shared followSwitch), so a lost
 * answer, or the switch changed at the unit by hand, is caught. Switching it
 * off is believed straight away: the phone clicking on through a moment of
 * silence costs nothing.
 */
let unfollow = () => {}
const stopFollowing = () => {
  unfollow()
  unfollow = () => {}
}

async function switchUnit(slug, on) {
  stopFollowing()
  if (!on) hear(slug, false)
  const said = await setUnitMetronome(slug, on)
  if (said?.ok === false && !said?.unsupported) logDebug('metronome', 'the unit did not take it', JSON.stringify(said))
  if (said?.ok === false || said?.simulated) return said
  const tell = (value) =>
    logDebug(
      'metronome',
      value === null ? 'the unit did not say where its metronome switch is' : `the unit says its metronome switch is at ${value}`,
      `asked for ${on ? 'on' : 'off'}`
    )
  if (!on) {
    readUnitMetronome(slug).then(tell).catch(() => {})
    return said
  }
  /* Into the log when the answer changes, not every half minute. */
  let told
  /* Only while the setting still asks for it: a quick on-then-off must not hear the first answer last. */
  unfollow = followSwitch({
    read: () => readUnitMetronome(slug),
    wanted: () => clicks(setting, true).unit,
    answer: (heardOn, value) => {
      if (value !== told) tell(value)
      told = value
      hear(slug, heardOn)
    },
    wait: (fn, ms) => setTimeout(fn, ms),
    stop: (t) => clearTimeout(t)
  })
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
      stopFollowing()
      hear(null, false)
      return
    }
    /* Not asked again where it cannot click any more: Bluetooth turned on, say. */
    if (!clicks(setting, unitClick(slug, { bluetooth }).can).unit) {
      stopFollowing()
      return
    }
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
 * FLASH TIMING: how much later (or earlier) than standard the flash and the
 * tap come, for this phone and whatever it plays through. Settings → Metronome
 * moves it; shared/metronome.mjs says what standard is and keeps it in range.
 */
const FLASH_KEY = 'fractal.metronome.flash'
let nudge = 0
AsyncStorage.getItem(FLASH_KEY)
  .then((raw) => {
    if (raw === null) return
    nudge = flashNudge(Number(raw))
    announce()
  })
  .catch(() => {})
export const flashTiming = () => nudge
export function setFlashTiming(ms) {
  nudge = flashNudge(ms)
  announce()
  AsyncStorage.setItem(FLASH_KEY, String(nudge)).catch(() => {})
}
export function useFlashTiming() {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => nudge,
    () => nudge
  )
}

/*
 * Every beat the phone clicks, for anything else that lights on it — the
 * green dot on Tap — so it lights with the click and the edge flash rather
 * than on a clock of its own.
 */
const beatWatchers = new Set()
export function onPhoneBeat(fn) {
  beatWatchers.add(fn)
  return () => beatWatchers.delete(fn)
}
let clickingNow = false
const clickingWatchers = new Set()
const setClicking = (on) => {
  if (clickingNow === on) return
  clickingNow = on
  for (const fn of clickingWatchers) fn()
}
/** Whether the phone is clicking right now, as a hook. */
export function usePhoneClicking() {
  return useSyncExternalStore(
    (fn) => {
      clickingWatchers.add(fn)
      return () => clickingWatchers.delete(fn)
    },
    () => clickingNow,
    () => clickingNow
  )
}

/*
 * THE CLICK ITSELF: thirty milliseconds of tick, loaded once and played on
 * every beat. Made when the click first starts, not at launch, so a phone
 * that never turns the metronome on never opens audio.
 *
 * Plays with the ring switch on silent — a metronome somebody turned on is a
 * sound they asked for — and alongside whatever else is playing, so a backing
 * track keeps going under it.
 *
 * WHY TWO PLAYERS ON AN iPHONE, and why it is ready before the first beat.
 * "The flash is not matching up with the sound." It was the sound that was
 * late, and late by a different amount every beat:
 *
 * - The player rewound itself on the beat. The rewind is an asynchronous call
 *   that only runs after the beat's own code has finished, and the play is
 *   immediate — so the play came first, at the end of the last click, and
 *   the sound waited on the rewind landing behind it.
 * - The phone let go of its audio a tenth of a second after every click, and
 *   took it back on the next one, so every beat started the speaker (and any
 *   Bluetooth link) from cold.
 *
 * So on an iPhone two players take turns: the one that sounds was rewound a
 * whole beat ago, and the one that sounded last is rewound behind it. The
 * audio is kept awake while the click runs, and let go two seconds after it
 * stops (a tap-tempo press restarts the click, and must not pause it).
 *
 * Android plays its seek and its play in order, so one player does; but it
 * starts a new audio track for every click and fades each one in over 20 ms,
 * which took the whole click with it. Its click (assets/click-pad.wav) starts
 * with 25 ms of silence for the fade to spend itself on, and FLASH_LEAD
 * counts it.
 */
const IOS = Platform.OS === 'ios'
let players = null
let turn = 0
let preparing = null
let releaseTimer = null

function prepareClick() {
  if (!preparing) {
    preparing = (async () => {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {})
      players = IOS
        ? [createAudioPlayer(clickSound, { keepAudioSessionActive: true }), createAudioPlayer(clickSound, { keepAudioSessionActive: true })]
        : [createAudioPlayer(clickPadded)]
      /* Loaded before the first beat, or the first click is a click that never sounds. */
      for (let waited = 0; waited < 500 && !players.every((p) => p.isLoaded); waited += 20) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
    })().catch(() => {
      // A phone that cannot make the sound still flashes and taps.
    })
  }
  return preparing.then(async () => {
    /* Every player at the top before a run starts: a run that stopped mid-turn left one at the end. */
    if (!players) return
    await Promise.all(
      players.map((p) => {
        try {
          p.pause()
          return Promise.resolve(p.seekTo(0)).catch(() => {})
        } catch {
          return null
        }
      })
    )
  })
}

function click() {
  if (!players) return null
  try {
    if (!IOS) {
      Promise.resolve(players[0].seekTo(0)).catch(() => {})
      players[0].play()
      return players[0]
    }
    const now = players[turn]
    turn = 1 - turn
    now.play()
    /* Rewound after this beat's code, which is when an iPhone runs it: never in front of this click. */
    Promise.resolve(players[turn].seekTo(0)).catch(() => {})
    return now
  } catch {
    return null
  }
}

/* Two seconds after the click stops: the audio is let go, unless it has started again. */
function releaseLater() {
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(() => {
    releaseTimer = null
    try {
      players?.forEach((p) => p.pause())
    } catch {
      // Gone already.
    }
    if (IOS) setIsAudioActiveAsync(false).catch(() => {})
  }, 2000)
}

/*
 * HOW LATE THE CLICK REALLY STARTS, on his phone, into the log. A few beats
 * into each run the iPhone's player is asked where it has got to, a moment
 * after it was told to play and again a little later if it had not started:
 * what it has not yet played is how long it took to start. Said once a run,
 * so "Send logs to developer" brings back a number nobody had to measure by
 * ear.
 */
const LAG_PROBES_MS = [20, 50, 80, 120]
function probeLag(player, lags, lead) {
  if (!IOS || !player || lags.done) return
  const ask = (i) =>
    setTimeout(() => {
      if (lags.done) return
      let at
      try {
        at = player.currentTime
      } catch {
        return
      }
      if (!(at > 0)) {
        if (i + 1 < LAG_PROBES_MS.length) return ask(i + 1)
        lags.push(LAG_PROBES_MS[i])
      } else if (at < 0.03) lags.push(LAG_PROBES_MS[i] - at * 1000)
      else return
      if (lags.length < 6) return
      lags.done = true
      const sorted = [...lags].sort((a, b) => a - b)
      const mid = Math.round((sorted[2] + sorted[3]) / 2)
      logDebug('metronome', `the click starts about ${mid} ms after the beat; the flash comes ${lead} ms after it`)
    }, LAG_PROBES_MS[i] - (i ? LAG_PROBES_MS[i - 1] : 0))
  ask(0)
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
    let startedAt = 0
    let timer = null
    let alive = true
    let n = 0
    /* The flashes and taps still to come, cleared when the click stops: none lands after it. */
    const later = new Set()
    const lags = []
    const step = () => {
      if (!alive) return
      const sounding = click()
      if (n++ >= 2) probeLag(sounding, lags, flashLead(Platform.OS, nudge))
      /* The flash and the tap wait for the sound: see FLASH_LEAD. Read each beat, so Flash timing moves it at once. */
      const t = setTimeout(() => {
        later.delete(t)
        if (!alive) return
        tick()
        onBeat?.()
        for (const fn of beatWatchers) fn()
      }, flashLead(Platform.OS, nudge))
      later.add(t)
      const due = nextBeat(startedAt, Date.now(), beat)
      timer = setTimeout(step, Math.max(0, due - Date.now()))
    }
    clearTimeout(releaseTimer)
    releaseTimer = null
    setClicking(true)
    prepareClick().finally(() => {
      if (!alive) return
      startedAt = Date.now()
      step()
    })
    return () => {
      alive = false
      clearTimeout(timer)
      for (const t of later) clearTimeout(t)
      later.clear()
      setClicking(false)
      releaseLater()
    }
  }, [on, beat, onBeat])
  return running
}
