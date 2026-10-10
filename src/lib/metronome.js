import { useEffect, useSyncExternalStore } from 'react'

import { currentDeviceSlug, isDemo, readUnitMetronome, setUnitMetronome } from './forgefx'
import { logDebug } from './debugLog.js'
import { DEFAULT_METRONOME, beatMs, clicks, followSwitch, metronomeSetting, unitClick } from '../../shared/metronome.mjs'

/**
 * THE METRONOME SETTING, in the browser — the phone's lib/metronome.js.
 *
 * Same setting, same rules (shared/metronome.mjs). What differs is this end's
 * half of the click: a browser can make a sound without a store build, so
 * "this screen" beeps as well as flashing.
 */

const KEY = 'fab.metronome'
const recall = () => {
  try {
    return metronomeSetting(JSON.parse(localStorage.getItem(KEY) || 'null'))
  } catch {
    return DEFAULT_METRONOME
  }
}
let setting = recall()
const watchers = new Set()

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

/* Whether this unit's click can be switched from here: not on an AM4, not in the demo (it makes no sound). */
const canOf = (slug) => unitClick(slug, { demo: isDemo() }).can

/*
 * Whether the unit has said its own click is on — the phone's `heard`. Until
 * it does, this screen keeps time under Unit as well (shared clicks()).
 */
let heard = { slug: null, on: false }
const hear = (slug, on) => {
  if (heard.slug === slug && heard.on === on) return
  heard = { slug, on }
  for (const fn of watchers) fn()
}
export const unitHeardOn = (slug) => heard.slug === slug && heard.on

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

/** Switch the unit's click, then follow where it says its switch is, as the phone does. */
let unfollow = () => {}
const stopFollowing = () => {
  unfollow()
  unfollow = () => {}
}

async function switchUnit(slug, on) {
  stopFollowing()
  if (!on) hear(slug, false)
  const said = await setUnitMetronome(slug, on)
  if (!on || said?.ok === false || said?.simulated) return said
  let told
  unfollow = followSwitch({
    read: () => readUnitMetronome(slug),
    wanted: () => clicks(setting, true).unit,
    answer: (heardOn, value) => {
      if (value !== told) {
        logDebug(
          'metronome',
          value === null ? 'the unit did not say where its metronome switch is' : `the unit says its metronome switch is at ${value}`,
          'asked for on'
        )
      }
      told = value
      hear(slug, heardOn)
    },
    wait: (fn, ms) => setTimeout(fn, ms),
    stop: (t) => clearTimeout(t)
  })
  return said
}

/* One audio context for the page, made on a press: browsers refuse to start
   one any other way. */
let audio = null
const ear = () => {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume().catch(() => {})
    return audio
  } catch {
    return null
  }
}

/**
 * Let this screen's beep start. A browser starts sound only on a press, and
 * where the unit cannot click the lit "This screen" row changes nothing — so
 * its press still has to do this, or a page loaded with the click on stays
 * silent.
 */
export const wakeScreenClick = () => {
  ear()
}

/** Change the setting; tell the unit only if its half changed (see the phone's). */
export async function setMetronome(patch, slug) {
  /* An AM4's click is never switched from here, nor the demo's: Unit there means this screen keeps time. */
  const can = canOf(slug)
  const before = clicks(setting, can).unit
  setting = metronomeSetting({ ...setting, ...patch })
  for (const fn of watchers) fn()
  try {
    localStorage.setItem(KEY, JSON.stringify(setting))
  } catch {
    // Kept for this visit if it cannot be kept for the next.
  }
  /* Heard or not: a press is the only moment a browser lets a sound start, and Unit may need it. */
  if (clicks(setting, can, false).phone) ear()
  const after = clicks(setting, can).unit
  if (before === after) return { ok: true }
  try {
    return (await switchUnit(slug, after)) || { ok: true }
  } catch (err) {
    logDebug('metronome', 'could not reach the unit', String(err?.message || err))
    return { ok: false, message: String(err?.message || err) }
  }
}

/** A unit that has just arrived is told, when its click is meant to be on; one that goes is no longer heard. */
export function useUnitMetronome(slug, present) {
  useEffect(() => {
    if (!present) {
      stopFollowing()
      hear(null, false)
      return
    }
    if (!clicks(setting, canOf(slug)).unit) {
      stopFollowing()
      return
    }
    switchUnit(slug, true).catch(() => {})
  }, [slug, present])
}

/**
 * This screen's half: a short beep on every beat, scheduled on the audio
 * clock rather than a timer, so it keeps steady time however busy the page
 * is. `onBeat` is called near each beat so the screen can flash with it.
 */
export function useScreenClick(bpm, onBeat) {
  const s = useMetronome()
  const slug = currentDeviceSlug()
  const on = clicks(s, canOf(slug), useUnitHeardOn(slug)).phone
  const beat = beatMs(bpm)
  useEffect(() => {
    if (!on || !beat) return undefined
    const ctx = ear()
    const step = beat / 1000
    let next = ctx ? ctx.currentTime + 0.05 : 0
    let alive = true
    let told = false
    /* Booked beeps and flashes, so a stop or a new tempo takes back the ones not yet heard. */
    const booked = []
    const flashes = new Set()
    /* While the browser will not let sound start yet: the flash keeps the tempo on its own. */
    let silentSince = null
    const beep = (at) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 1500
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.4, at + 0.002)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.06)
      return osc
    }
    /* Look a little ahead and book every beat in it on the audio clock. */
    const plan = () => {
      if (!alive) return
      if (ctx && ctx.state === 'running') {
        if (silentSince !== null) {
          silentSince = null
          next = ctx.currentTime + 0.05
        }
        while (booked.length && booked[0].at < ctx.currentTime - 0.1) booked.shift()
        while (next < ctx.currentTime + 0.2) {
          booked.push({ osc: beep(next), at: next })
          /* The flash on the beep as it is HEARD, not as it is made, less the frame it takes to draw. */
          const heard = heardAt(ctx, next)
          if (!told) {
            told = true
            logDebug('metronome', `the beep reaches the speaker ${Math.round(heard - (performance.now() + (next - ctx.currentTime) * 1000))} ms after it is made`)
          }
          const t = setTimeout(() => {
            flashes.delete(t)
            if (alive) onBeat?.()
          }, Math.max(0, heard - FLASH_FRAME_MS - performance.now()))
          flashes.add(t)
          next += step
        }
        return
      }
      const now = performance.now()
      if (silentSince === null) silentSince = now - beat
      if (now - silentSince >= beat) {
        silentSince += beat * Math.floor((now - silentSince) / beat)
        onBeat?.()
      }
    }
    plan()
    const timer = setInterval(plan, ctx ? 50 : beat)
    return () => {
      alive = false
      clearInterval(timer)
      for (const t of flashes) clearTimeout(t)
      flashes.clear()
      /* A beep stopped before it starts never sounds: none is heard without its flash. */
      for (const b of booked) {
        try {
          b.osc.stop()
        } catch {
          // Already over.
        }
      }
      booked.length = 0
    }
  }, [on, beat, onBeat])
}

/*
 * WHEN A BEEP BOOKED AT AUDIO TIME `t` COMES OUT OF THE SPEAKER, on
 * performance.now()'s clock.
 *
 * "They're not flashing and beeping at the same time." The flash was timed to
 * when the beep is made, and the sound then has the trip out of the browser
 * and the computer to make: a few tens of milliseconds on a laptop's own
 * speakers, a good deal more through Bluetooth. The browser says how long,
 * where it can: getOutputTimestamp() pairs the audio clock with the page's
 * clock at the speaker, and baseLatency/outputLatency are the same trip by
 * another route. An answer more than 400 ms out is not believed.
 */
const heardAt = (ctx, t) => {
  const made = performance.now() + (t - ctx.currentTime) * 1000
  const stamp = ctx.getOutputTimestamp?.()
  if (stamp && stamp.contextTime > 0 && stamp.performanceTime > 0) {
    const at = stamp.performanceTime + (t - stamp.contextTime) * 1000
    if (at - made >= 0 && at - made < 400) return at
  }
  const trip = ((ctx.baseLatency || 0) + (ctx.outputLatency || 0)) * 1000
  return made + (trip >= 0 && trip < 400 ? trip : 0)
}
/* A class set in a timer reaches the glass about a frame and a half later at 60 Hz. */
const FLASH_FRAME_MS = 20
