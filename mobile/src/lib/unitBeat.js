import { askUnitBeat, unitBeatRoad } from './device'
import { onUnitBeat } from './beatBus'
import { BEAT_LOCK, beatsApart, isBeatAnswer, joined, sameTempo, whyWords, windowFromAnswer, windowFromWire } from './beatLock'
import { logDebug } from './debugLog'

/**
 * FOLLOWING THE UNIT'S BEAT (lib/beatLock has the why and every rule).
 *
 * While the device keeps a beat beside a unit that is clicking, this finds
 * out where the unit's beat falls and hands each new belief to whoever is
 * keeping the device's:
 *
 *   through the computer   it asks GET /tempo/beat, a few times quickly and
 *                          then every few seconds (quickly again while a
 *                          window waits to be agreed with), timing each.
 *                          The computer answers from what it has heard and
 *                          asks the unit nothing. A computer app from before
 *                          the answer existed (it answers with its web page)
 *                          says so once and is asked again in ten minutes.
 *   over Bluetooth or the  the unit's beat reaches this device itself
 *   USB cable              (bleWire → rig.handleEvent → lib/beatBus), and
 *                          one in every couple of seconds is weighed.
 *
 * Nothing is sent to the unit either way. The log says what came of it,
 * once for each thing that changes, never once a beat.
 *
 * NO ONE WINDOW IS BELIEVED ALONE. The first is believed when a second
 * agrees with it, and one that disagrees with what is believed is kept
 * aside until another agrees with IT (the unit's beat has moved) or with
 * what was believed (it was a beat the computer heard late, and is
 * forgotten). One bad answer never moves the device's beat.
 */

const say = (line) => logDebug('metronome', line)

/**
 * Follow the unit's beat for a device's beat of `beat` milliseconds.
 * `onWindow` is handed every new belief (`{ mid, half, at, moved }`,
 * lib/beatLock joined, with `sure`, and `gap`: the newest answer's own time
 * between the unit's beats, none for a window heard over the wire). `onWhy`, where given, is handed why there is
 * nothing to go on each time that is learned: 'old' (a computer app with no
 * such answer), 'failed' (the question did not get through), or an answer's
 * own why (lib/beatLock whyWords: 'none', 'finding', 'tempo', 'stale', 'slow', 'bad',
 * and 'none' again once answers with a count and no age have gone on for
 * BEAT_LOCK.findingMs); and whenever a window comes, null, or 'tempo' where
 * its gap is not this device's tempo (lib/beatLock sameTempo). Answers a
 * function that stops it.
 *
 * `o` is what a test hands in: the clock, the timers, the road and the ask.
 */
export function followUnitBeat({ beat, onWindow, onWhy }, o = {}) {
  const now = o.now || (() => Date.now())
  const wait = o.wait || ((fn, ms) => setTimeout(fn, ms))
  const unwait = o.unwait || ((t) => clearTimeout(t))
  const road = (o.road || unitBeatRoad)()
  const ask = o.ask || askUnitBeat
  if (!(beat > 0) || typeof onWindow !== 'function' || !road) return () => {}

  let alive = true
  let held = null
  /* A window that has not been agreed with yet: the first, or one that says the beat has moved. */
  let aside = null
  let timer = null
  /* What the log last said, so the same thing is not said every few seconds. */
  let said = null
  const sayOnce = (key, line) => {
    if (said === key) return
    said = key
    say(line)
  }

  const why = (w) => {
    if (typeof onWhy === 'function') onWhy(w)
  }
  /* Whether the newest window's gap was another tempo than this device's: the log says each change of it, never each answer. */
  let tempoOff = false
  const take = (window, how) => {
    if (!window) return
    /*
     * A window came: whatever kept it from coming (the question failing, an
     * old computer app, no beat) is no longer so. But while its own gap says
     * the unit keeps another tempo than this device's, that stays the cause,
     * whether this window is believed or set aside below (one set aside never
     * reaches whoever follows, and the line flipped to "Still finding" for a
     * moment every time the drifting beat made one disagree).
     */
    const off = Number.isFinite(window.gap) && !sameTempo(window.gap, beat)
    why(off ? 'tempo' : null)
    /*
     * Said once when it starts and once when it ends, with the numbers: at
     * 250 BPM half a BPM is under half a millisecond of the computer's gap,
     * so a log has to show whether the tempos really differed or the
     * computer's measure of the gap wavered.
     */
    if (off !== tempoOff) {
      const beats = Math.max(1, Math.round(window.gap / beat))
      if (off) say(`tap along waits: the computer measures the unit’s beats ${window.gap.toFixed(1)} ms apart, and ${beats} of this device’s come to ${(beats * beat).toFixed(1)} ms`)
      else say(`tap along: the unit’s beats are at this device’s tempo again${Number.isFinite(window.gap) ? ` (${window.gap.toFixed(1)} ms apart as the computer measures them)` : ''}`)
      tempoOff = off
    }
    /*
     * A belief, or a window aside, this old is forgotten: its doubt has grown
     * with every second of two clocks, and one late answer would fall inside
     * it and be believed alone (an independent read found it after a few
     * minutes with no beat). Two windows have to agree again, as at the start.
     */
    if (held && window.at - held.at > BEAT_LOCK.heldMs) held = null
    if (aside && window.at - aside.at > BEAT_LOCK.heldMs) aside = null
    const was = held
    const agreed = held ? joined(held, window, beat) : null
    if (agreed && !agreed.moved) {
      /* A window that agrees with what was believed, without moving it, long enough after it was formed: now it is sure (lib/beatLock inStepWith). */
      held = { ...agreed, since: was.since, sure: was.sure === true || window.at - was.since >= BEAT_LOCK.sureAfterMs, gap: window.gap }
      aside = null
    } else {
      /* Nothing believed yet, or the newest disagrees with it: believed only once a second window agrees. */
      const pair = aside ? joined(aside, window, beat) : null
      if (!pair || pair.moved) {
        aside = window
        return
      }
      held = { ...pair, moved: Boolean(was), sure: false, since: window.at, gap: window.gap }
      aside = null
    }
    if (!was || (said !== 'heard' && said !== 'moved')) sayOnce('heard', `the unit’s beat is heard ${how}: this device’s beat goes onto it`)
    else if (held.moved) sayOnce('moved', 'the unit’s beat moved: this device’s beat follows it')
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
      /* Every beat while a window waits to be agreed with; then one every couple of seconds. */
      if (held && !aside && at - weighed < BEAT_LOCK.wireEveryMs) return
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
  /* When the answers began to have a count and no age, or null. */
  let findingSince = null
  /* Quick questions asked for a window waiting to be agreed with, in a row: a few, then the usual pace. */
  let asideAsks = 0
  const again = (ms) => {
    if (!alive) return
    if (ms === undefined) {
      if (!aside) asideAsks = 0
      const quick = asked < BEAT_LOCK.quick || (aside && asideAsks++ < BEAT_LOCK.quick)
      ms = quick ? BEAT_LOCK.quickGapMs : BEAT_LOCK.everyMs
    }
    timer = wait(round, ms)
  }
  /* A computer app from before the answer: said once, and asked again in ten minutes, in case it has been updated. */
  const old = () => {
    why('old')
    sayOnce('old', 'not lined up with the unit’s beat: this computer app does not say when the beat falls yet. Update the computer app')
    again(BEAT_LOCK.notAskedMs)
  }
  async function round() {
    timer = null
    if (!alive) return
    asked++
    try {
      const got = await ask()
      if (!alive) return
      if (!isBeatAnswer(got?.answer)) return old()
      const read = windowFromAnswer(got.answer, got.asked, got.answered, beat)
      /* Answers with a count and no age, one after another from the first of them (lib/beatLock findingMs). Any other answer, one with an age above all, starts it over. */
      if (got.answer.count > 0 && !Number.isFinite(got.answer.age)) findingSince = findingSince ?? now()
      else findingSince = null
      if (read.window) take(read.window, `through the computer (${Math.round(got.answered - got.asked)} ms there and back, a beat every ${Math.round(got.answer.gap)} ms)`)
      else {
        const w = read.why === 'finding' && findingSince !== null && now() - findingSince >= BEAT_LOCK.findingMs ? 'none' : read.why
        why(w)
        sayOnce(w, `not lined up with the unit’s beat: ${whyWords(w)}`)
      }
    } catch (err) {
      if (!alive) return
      if (err?.status === 404 || err?.status === 501) return old()
      why('failed')
      sayOnce('failed', `not lined up with the unit’s beat: the question did not get through (${err?.message || err})`)
    }
    again()
  }
  timer = wait(round, 0)
  return () => {
    alive = false
    if (timer !== null) unwait(timer)
    timer = null
  }
}
