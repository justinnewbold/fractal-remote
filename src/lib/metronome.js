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
    const beep = (at) => {
      if (!ctx) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 1500
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.4, at + 0.002)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.06)
    }
    /* Look a little ahead and book every beat in it on the audio clock. */
    const plan = () => {
      if (!alive) return
      if (ctx) {
        while (next < ctx.currentTime + 0.2) {
          beep(next)
          const wait = Math.max(0, (next - ctx.currentTime) * 1000)
          setTimeout(() => alive && onBeat?.(), wait)
          next += step
        }
      } else {
        onBeat?.()
      }
    }
    plan()
    const timer = setInterval(plan, ctx ? 50 : beat)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [on, beat, onBeat])
}
