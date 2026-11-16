/**
 * THE DEVICE'S BEAT ON THE UNIT'S BEAT.
 *
 * "The metronome is not matching up properly into the sound coming out of
 * speakers. There's a delay." (Justin, 16 November 2026: his Axe-Fx III
 * clicking through his Raspberry Pi, his phone lighting.) The app kept the
 * unit's TEMPO, which it can read, and never knew its BEAT: the unit's click
 * and the device's light were two clocks at one speed, started at two
 * moments, so they sat a part of a beat apart and stayed there.
 *
 * A gen-3 unit with Send Realtime Sysex on sends one short message on its
 * tempo's beat. Through the computer, the computer app notes the moment each
 * arrives and answers GET /tempo/beat with how long ago the last one was
 * (ForgeFX unitBeat.ts). Over Bluetooth or the USB cable the message reaches
 * this device itself (bleWire). Either way the rules here turn it into a
 * WINDOW the unit's beat fell in, on this device's own clock, and say how
 * far to move the device's beat to sit on it.
 *
 * Nothing is sent to the unit for any of it, and a unit that sends no beat
 * changes nothing: the device keeps its own beat as it always has, and the
 * words go on saying the two can be apart (lib/edgeFlash EDGE_WORDS.apart).
 * Only while a beat has been heard in the last twenty seconds do they say
 * the two are in step (EDGE_WORDS.inStep).
 *
 * HIS ACCOUNT ONLY until he says: lib/features.js BEAT_LOCK_FOR_EVERYONE
 * (`beatLockOn`), as every new thing is. NOT SEEN ON A UNIT YET: that his
 * unit sends its beat down the USB port at all, on every beat or only on a
 * bar's first, and how near its own click. The log says (lib/unitBeat).
 *
 * This file imports nothing, so the tests can run every rule in it.
 */

/** Whether the device's beat is moved onto the unit's for whoever is signed in here. */
export const beatLockOn = ({ admin = false, everyone = false } = {}) => admin === true || everyone === true

export const BEAT_LOCK = Object.freeze({
  /* Through the computer: a few questions quickly when the beat starts, then one this often. */
  quick: 4,
  quickGapMs: 300,
  everyMs: 6000,
  /* Added to each side of every window: the computer hearing the beat, and two clocks read to a millisecond. */
  slackMs: 4,
  /* Over Bluetooth or the cable a beat is heard about this long after it fell, give or take this much. */
  wireLateMs: 12,
  wireDoubtMs: 14,
  /* And only one of them in this many is weighed: every beat would be twice a second for nothing. */
  wireEveryMs: 2000,
  /* The doubt a window gains for each second it is kept: two clocks, a hundred parts in a million apart. */
  driftPerSec: 0.1,
  /* Two windows that miss each other by less than this are one beat that drifted, not a beat that moved. */
  nearMs: 30,
  /* No window is believed closer than this, however many agree. */
  floorMs: 3,
  /* A move smaller than this is not made: nobody hears it, and every move is a beat a little long or short. */
  ignoreMs: 8,
  /* A window wider than this much of a beat, each side, says nothing about where in the beat. */
  widestOfBeat: 0.35,
  /* How many beats apart the unit's messages may come (a unit that sends one a bar), and how close to that they must be. */
  beatsApart: 8,
  gapWithin: 0.03,
  gapWithinMs: 12,
  /* How long after the last window the device's beat still counts as on the unit's. */
  heldMs: 20000,
  /* A computer app with no such answer is not asked again for this long. */
  notAskedMs: 10 * 60 * 1000,
  /* Never two clicks closer than this much of a beat, whatever the move. */
  apartOfBeat: 0.5,
  /* A beat a move has just put this far behind, and not clicked yet, is clicked now rather than dropped. */
  lateMs: 30
})

/** `ms` into the half beat either side of nought: (−beat/2, beat/2]. */
export function wrap(ms, beat) {
  if (!(beat > 0) || !Number.isFinite(ms)) return 0
  const r = ((ms % beat) + beat) % beat
  return r > beat / 2 ? r - beat : r
}

/**
 * How many of the device's beats apart the unit's messages come: 1 for every
 * beat, 4 for a bar's first in four-four, 0 when `gap` is not a whole number
 * of this tempo's beats (the device's tempo is not the unit's right now).
 */
export function beatsApart(gap, beat) {
  if (!(gap > 0) || !(beat > 0)) return 0
  const n = Math.round(gap / beat)
  if (n < 1 || n > BEAT_LOCK.beatsApart) return 0
  return Math.abs(gap - n * beat) <= Math.max(BEAT_LOCK.gapWithinMs, BEAT_LOCK.gapWithin * gap) ? n : 0
}

/**
 * The computer's answer as a window.
 *
 * `answer` is GET /tempo/beat's: `{ ok, count, age, gap }`, `age` the
 * milliseconds since the unit's last beat as the answer was made. `asked`
 * and `answered` are this device's clock when the question left and when
 * the answer came. The answer was made somewhere between the two, so the
 * beat fell between `asked − age` and `answered − age`: a window that
 * always holds it, however lopsided the road, and is as narrow as the round
 * trip was quick.
 *
 * Answers `{ window: { mid, half, at } }`, or `{ why }` when it says
 * nothing: 'none' (no beat heard), 'tempo' (they come at another tempo than
 * the device is keeping), 'stale' (the beats stopped), 'slow' (the round
 * trip took too much of a beat), 'bad' (not an answer at all).
 */
export function windowFromAnswer(answer, asked, answered, beat) {
  if (!answer || answer.ok !== true || !(beat > 0) || !Number.isFinite(asked) || !Number.isFinite(answered) || answered < asked) return { why: 'bad' }
  const { age, gap } = answer
  if (age === null || age === undefined || gap === null || gap === undefined) return { why: 'none' }
  if (!Number.isFinite(age) || age < 0 || !Number.isFinite(gap)) return { why: 'bad' }
  if (!beatsApart(gap, beat)) return { why: 'tempo' }
  if (age > gap * 1.5) return { why: 'stale' }
  const half = (answered - asked) / 2 + BEAT_LOCK.slackMs
  if (half > beat * BEAT_LOCK.widestOfBeat) return { why: 'slow' }
  return { window: { mid: (asked + answered) / 2 - age, half, at: answered } }
}

/** A beat this device heard itself, over Bluetooth or the cable, as a window: `at` is this device's clock when it came. */
export function windowFromWire(at) {
  if (!Number.isFinite(at)) return null
  return { mid: at - BEAT_LOCK.wireLateMs, half: BEAT_LOCK.wireDoubtMs, at }
}

/**
 * Two windows as one.
 *
 * `held` is what is believed so far (null for nothing), `next` the newest.
 * Both hold the unit's beat, so it is where they overlap: narrower than
 * either, and the more windows the narrower, down to the floor. A window
 * kept gains a little doubt for every second, for two clocks that are not
 * quite one speed.
 *
 * Where they do not overlap, by a little (nearMs), it is that drift and
 * the answer is the gap between them. By more, the unit's beat has moved
 * (a tempo tapped at the unit, its tempo set) and what was held says
 * nothing: the newest window alone, and `moved` says so.
 */
export function joined(held, next, beat) {
  if (!next) return held || null
  if (!held || !(beat > 0)) return { ...next, moved: false }
  const doubt = held.half + (BEAT_LOCK.driftPerSec * Math.max(0, next.at - held.at)) / 1000
  /* Where the newest sits against the held one, in the half beat either side of it. */
  const d = wrap(next.mid - held.mid, beat)
  const lo = Math.max(-doubt, d - next.half)
  const hi = Math.min(doubt, d + next.half)
  /*
   * The answer is said as a beat beside the NEWEST window, not the first
   * one ever held: `beat` is this device's idea of the unit's, and counting
   * a tenth of a percent of difference across ten minutes of beats would
   * be the whole doubt there is.
   */
  const near = next.mid - d
  if (lo <= hi) return { mid: near + (lo + hi) / 2, half: Math.max(BEAT_LOCK.floorMs, (hi - lo) / 2), at: next.at, moved: false }
  if (lo - hi <= BEAT_LOCK.nearMs) return { mid: near + (lo + hi) / 2, half: Math.max(BEAT_LOCK.floorMs, (lo - hi) / 2), at: next.at, moved: false }
  return { ...next, moved: true }
}

/**
 * How far to move the device's beat, in milliseconds (later is more), to
 * put what is heard or seen of it on the unit's. `startedAt` is what the
 * device's beats are counted from; `lead` how long after one of them the
 * device's click is heard (shared flashLead; nought in silence, where the
 * light is on the beat itself). Nought when it is near enough already.
 */
export function moveFor(startedAt, window, beat, lead = 0) {
  if (!window || !(beat > 0) || !Number.isFinite(startedAt)) return 0
  const by = wrap(window.mid - (Number.isFinite(lead) ? lead : 0) - startedAt, beat)
  return Math.abs(by) < BEAT_LOCK.ignoreMs ? 0 : by
}

/**
 * When the next click comes after a move: `due` as the beat's own count has
 * it, or the beat after when that would be a second click too soon after
 * the last (`clicked`, null for none yet).
 */
export function notTooSoon(due, clicked, beat) {
  if (!Number.isFinite(due) || !(beat > 0) || !Number.isFinite(clicked)) return due
  return due - clicked < beat * BEAT_LOCK.apartOfBeat ? due + beat : due
}

/**
 * The same, and a beat is not DROPPED by a move either.
 *
 * `next` is the beat the count says comes next after a move (shared
 * nextBeat, at `now`). A move earlier can put the beat that was about to be
 * clicked a little BEHIND now, and the count then calls it gone and books
 * the one after: nearly two beats between two clicks. So where the beat
 * before `next` is only just gone (lateMs) and has not been clicked (it is
 * at least half a beat after the last click), it is clicked now. Never
 * before anything has clicked at all: the first beat waits for one that is
 * squarely on the unit's.
 */
export function dueAfterMove(next, now, clicked, beat) {
  if (!Number.isFinite(next) || !(beat > 0) || !Number.isFinite(now) || !Number.isFinite(clicked)) return next
  const gone = next - beat
  if (now - gone <= BEAT_LOCK.lateMs && gone - clicked >= beat * BEAT_LOCK.apartOfBeat) return Math.max(now, gone)
  return notTooSoon(next, clicked, beat)
}

/** What the log says of an answer that gave no window. */
export const whyWords = (why) =>
  ({
    none: 'the unit has sent no beat (Send Realtime Sysex may be off on it: Setup → MIDI/Remote)',
    tempo: 'the unit’s beats come at another tempo than this device is keeping',
    stale: 'the unit’s beats have stopped',
    slow: 'the answer took too long to say where in the beat',
    bad: 'the answer was not one'
  })[why] || 'nothing to go on'
