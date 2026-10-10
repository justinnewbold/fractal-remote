import { useEffect, useSyncExternalStore } from 'react'

import { currentDeviceSlug, setUnitMetronome } from './forgefx'
import { logDebug } from './debugLog.js'
import { DEFAULT_METRONOME, beatMs, clicks, metronomeSetting, unitClick } from '../../shared/metronome.mjs'

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

/** Change the setting; tell the unit only if its half changed (see the phone's). */
export async function setMetronome(patch, slug) {
  /* An AM4's click is never switched from here: Unit there means this screen keeps time. */
  const can = unitClick(slug).can
  const before = clicks(setting, can).unit
  setting = metronomeSetting({ ...setting, ...patch })
  for (const fn of watchers) fn()
  try {
    localStorage.setItem(KEY, JSON.stringify(setting))
  } catch {
    // Kept for this visit if it cannot be kept for the next.
  }
  if (clicks(setting, can).phone) ear()
  const after = clicks(setting, can).unit
  if (before === after) return { ok: true }
  try {
    return (await setUnitMetronome(slug, after)) || { ok: true }
  } catch (err) {
    logDebug('metronome', 'could not reach the unit', String(err?.message || err))
    return { ok: false, message: String(err?.message || err) }
  }
}

/** A unit that has just arrived is told, when its click is meant to be on. */
export function useUnitMetronome(slug, present) {
  useEffect(() => {
    if (!present || !clicks(setting, unitClick(slug).can).unit) return
    setUnitMetronome(slug, true).catch(() => {})
  }, [slug, present])
}

/**
 * This screen's half: a short beep on every beat, scheduled on the audio
 * clock rather than a timer, so it keeps steady time however busy the page
 * is. `onBeat` is called near each beat so the screen can flash with it.
 */
export function useScreenClick(bpm, onBeat) {
  const s = useMetronome()
  const on = clicks(s, unitClick(currentDeviceSlug()).can).phone
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
