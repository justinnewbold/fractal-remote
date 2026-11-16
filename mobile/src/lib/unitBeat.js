import { askUnitBeat, unitBeatRoad } from './device'
import { onUnitBeat } from './beatBus'
import { BEAT_LOCK, beatsApart, joined, whyWords, windowFromAnswer, windowFromWire } from './beatLock'
import { logDebug } from './debugLog'

/**
 * FOLLOWING THE UNIT'S BEAT (lib/beatLock has the why and every rule).
 *
 * While the device keeps a beat beside a unit that is clicking, this finds
 * out where the unit's beat falls and hands each new belief to whoever is
 * keeping the device's:
 *
 *   through the computer   it asks GET /tempo/beat, a few times quickly and
 *                          then every few seconds, timing each question.
 *                          The computer answers from what it has heard and
 *                          asks the unit nothing. A computer app from before
 *                          the answer existed says so once and is not asked
 *                          again for ten minutes.
 *   over Bluetooth or the  the unit's beat reaches this device itself
 *   USB cable              (bleWire → rig.handleEvent → lib/beatBus), and
 *                          one in every couple of seconds is weighed.
 *
 * Nothing is sent to the unit either way. The log says what came of it,
 * once for each thing that changes, never once a beat.
 */

/* When a computer app that has no such answer may be asked again. Module-wide: every beat kept is the same computer. */
let notAskedUntil = 0
/** For the tests: forget that a computer had no such answer. */
export const __askAgain = () => {
  notAskedUntil = 0
}

const say = (line) => logDebug('metronome', line)

/**
 * Follow the unit's beat for a device's beat of `beat` milliseconds.
 * `onWindow` is handed every new belief (`{ mid, half, at, moved }`,
 * lib/beatLock joined). Answers a function that stops it.
 *
 * `o` is what a test hands in: the clock, the timers, the road and the ask.
 */
export function followUnitBeat({ beat, onWindow }, o = {}) {
  const now = o.now || (() => Date.now())
  const wait = o.wait || ((fn, ms) => setTimeout(fn, ms))
  const unwait = o.unwait || ((t) => clearTimeout(t))
  const road = (o.road || unitBeatRoad)()
  const ask = o.ask || askUnitBeat
  if (!(beat > 0) || typeof onWindow !== 'function' || !road) return () => {}

  let alive = true
  let held = null
  let timer = null
  /* What the log last said, so the same thing is not said every few seconds. */
  let said = null
  const sayOnce = (key, line) => {
    if (said === key) return
    said = key
    say(line)
  }

  const take = (window, how) => {
    if (!alive || !window) return
    const was = held
    held = joined(held, window, beat)
    /* The first one, and the first after the log said why there was none. */
    if (!was || said !== 'heard') sayOnce('heard', `the unit’s beat is heard ${how}: this device’s beat goes onto it`)
    else if (held.moved) say('the unit’s beat moved: this device’s beat follows it')
    onWindow(held)
  }

  if (road === 'wire') {
    let last = null
    let weighed = -Infinity
    const hear = (at) => {
      if (!alive || !Number.isFinite(at)) return
      const before = last
      last = at
      /* Two beats a whole number of this tempo's beats apart, or it is not this tempo being kept. */
      if (before === null || !beatsApart(at - before, beat)) return
      if (held && at - weighed < BEAT_LOCK.wireEveryMs) return
      weighed = at
      take(windowFromWire(at), 'over the adapter or the cable')
    }
    const unhear = onUnitBeat(hear)
    return () => {
      alive = false
      unhear()
    }
  }

  let asked = 0
  const again = () => {
    if (!alive) return
    timer = wait(round, asked < BEAT_LOCK.quick ? BEAT_LOCK.quickGapMs : BEAT_LOCK.everyMs)
  }
  async function round() {
    timer = null
    if (!alive) return
    if (now() < notAskedUntil) return
    asked++
    try {
      const got = await ask()
      if (!alive) return
      const read = windowFromAnswer(got?.answer, got?.asked, got?.answered, beat)
      if (read.window) take(read.window, `through the computer (${Math.round(got.answered - got.asked)} ms there and back, a beat every ${Math.round(got.answer.gap)} ms)`)
      else sayOnce(read.why, `not lined up with the unit’s beat: ${whyWords(read.why)}`)
    } catch (err) {
      if (!alive) return
      if (err?.status === 404 || err?.status === 501) {
        notAskedUntil = now() + BEAT_LOCK.notAskedMs
        sayOnce('old', 'not lined up with the unit’s beat: this computer app does not say when the beat falls yet. Update the computer app')
        return
      }
      sayOnce('failed', `not lined up with the unit’s beat: the question did not get through (${err?.message || err})`)
    }
    again()
  }
  if (now() < notAskedUntil) return () => {}
  timer = wait(round, 0)
  return () => {
    alive = false
    if (timer !== null) unwait(timer)
    timer = null
  }
}
