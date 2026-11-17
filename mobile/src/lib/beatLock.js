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
 * Only while a beat has been heard in the last twenty seconds, and is known
 * to within inStepMs, do they say the two are in step (EDGE_WORDS.inStep).
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
  /*
   * Added to each side of every window from the computer: the computer
   * hearing the beat (a USB read and a busy moment on a Raspberry Pi), and
   * two clocks read to a millisecond.
   */
  slackMs: 10,
  /* Over Bluetooth or the cable a beat is heard about this long after it fell, give or take this much. */
  wireLateMs: 12,
  wireDoubtMs: 14,
  /* And only one of them in this many is weighed: every beat would be twice a second for nothing. */
  wireEveryMs: 2000,
  /* The doubt a window gains for each second it is kept: two clocks, a hundred parts in a million apart. */
  driftPerSec: 0.1,
  /* No window is believed closer than this, however many agree. */
  floorMs: 3,
  /* A move smaller than this is not made: nobody hears it. */
  ignoreMs: 8,
  /*
   * A window wider than this much of a beat, each side, says too little
   * about where in the beat: two of them could agree on two places at once.
   */
  widestOfBeat: 0.25,
  /* How many beats apart the unit's messages may come (a unit that sends one a bar), and how close to that they must be. */
  beatsApart: 8,
  gapWithin: 0.03,
  gapWithinMs: 12,
  /*
   * "In step" is said only where the unit's beat is known to within this,
   * and the device's beat is that near it. Through a computer on the other
   * side of the internet the answer is rarely that sure: the beat is still
   * moved to where it most likely is, and the words do not claim it.
   */
  inStepMs: 20,
  /*
   * And only once a window this long after the belief was formed has agreed
   * with it: two answers a few hundred milliseconds apart cannot show a
   * device keeping a tempo a little off the unit's; two seconds can.
   */
  sureAfterMs: 2000,
  /*
   * Tap along only where the unit's beat comes at this device's own tempo:
   * the computer's gap between the unit's beats (a median of its last few,
   * timed on a clock that never steps, to a tenth of a millisecond) is a
   * whole number of this device's beats to within this. That gap is good to
   * about a millisecond: each gap is two arrivals read off the USB port,
   * and the median of up to eight drops the late ones. Twice that leaves
   * room for its error. Around 120 BPM it is also narrow enough to close a
   * tempo that is off: 120.5 against 120 is 2.1 ms a beat, 121 against 120
   * is 4.1, and a device that far off drifts across a wide window between
   * two answers while still seeming held on it (an independent read found
   * a run there saved 50 to 110 ms where 30 was right). A sure belief
   * alone cannot tell, through a road 100 ms there and back. From about
   * 174 BPM up it is not: a whole BPM is less than 2 ms a beat there (200
   * against 201 is 1.5 ms, 250 against 249 is 1.0), so sameTempoBpm,
   * below, is asked beside it. Nothing but Tap along goes by this.
   */
  sameTempoMs: 2,
  /*
   * And the tempo the computer's gap says (60000 × n / gap, n the whole
   * number of this device's beats that fits it) within less than this many
   * BPM of the device's own (60000 / beat). Half, because the unit's tempo
   * and the device's are both whole BPM as the app reads them: a whole-BPM
   * miss is 1.0 apart, a match 0, and the computer's gap is a measurement,
   * so the line goes halfway. What it costs: at 250 BPM half a BPM is
   * under half a millisecond of gap, so a noisy gap can close Tap along
   * for an ask on a tempo that does match. That is the safe way to be
   * wrong: closed until a gap that fits comes, never a wrong nudge saved.
   */
  sameTempoBpm: 0.5,
  /*
   * An answer with a count and no age is 'finding': the computer has heard
   * beats and only just forgotten where they fall. But it keeps its count
   * across a tempo tapped and a reconnect, so a unit whose Send Realtime
   * Sysex was switched off after beats were heard answers so for as long as
   * the computer runs. After this long of such answers, from the first of
   * them, it is 'none' again and the page says to switch it on. A unit that
   * sends one beat a bar at 30 BPM gives an age within eight seconds.
   */
  findingMs: 10000,
  /* How long after the last window the device's beat still counts as on the unit's. */
  heldMs: 20000,
  /* A computer app with no such answer is not asked again for this long. */
  notAskedMs: 10 * 60 * 1000,
  /*
   * A move is made this much of a beat at a time, at most, one beat after
   * another: never a beat dropped, doubled or jumped, only a few a little
   * long or short until it is there.
   */
  slewOfBeat: 0.1
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
 * Answers `{ window: { mid, half, at, gap } }` (`gap` the computer's own
 * time between the unit's beats, which Tap along goes by: heldOnWith), or
 * `{ why }` when it says nothing: 'none' (no beat ever heard: Send
 * Realtime Sysex is most likely off), 'finding' (beats have been heard, but
 * the computer has only just forgotten where they fall: after a tempo
 * tapped from the app, or a new connection), 'tempo' (they come at another tempo than
 * the device is keeping), 'stale' (the beats stopped), 'slow' (the round
 * trip took too much of a beat), 'bad' (not an answer at all).
 */
export function windowFromAnswer(answer, asked, answered, beat) {
  if (!answer || answer.ok !== true || !(beat > 0) || !Number.isFinite(asked) || !Number.isFinite(answered) || answered < asked) return { why: 'bad' }
  const { age, gap } = answer
  if (age === null || age === undefined || gap === null || gap === undefined) return { why: answer.count > 0 ? 'finding' : 'none' }
  if (!Number.isFinite(age) || age < 0 || !Number.isFinite(gap)) return { why: 'bad' }
  if (!beatsApart(gap, beat)) return { why: 'tempo' }
  if (age > gap * 1.5) return { why: 'stale' }
  const half = (answered - asked) / 2 + BEAT_LOCK.slackMs
  if (half > beat * BEAT_LOCK.widestOfBeat) return { why: 'slow' }
  return { window: { mid: (asked + answered) / 2 - age, half, at: answered, gap } }
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
 * The beat comes round again, so two windows can overlap in two places a
 * beat apart. Where they do (two wide ones), it cannot be said which, and
 * the narrower of the two stands alone. Where they do not overlap at all,
 * one of them is wrong (a beat the computer heard late) or the unit's beat
 * has moved (a tempo tapped at the unit): `moved` says so, with the newest
 * window alone, and whoever follows waits for a second window to agree
 * before believing either (lib/unitBeat).
 */
export function joined(held, next, beat) {
  if (!next) return held || null
  if (!held || !(beat > 0)) return { ...next, moved: false }
  const doubt = held.half + (BEAT_LOCK.driftPerSec * Math.max(0, next.at - held.at)) / 1000
  /* Where the newest sits against the held one, in the half beat either side of it, and a beat round the other way. */
  const d = wrap(next.mid - held.mid, beat)
  const overlaps = [d, d > 0 ? d - beat : d + beat]
    .map((at) => ({ at, lo: Math.max(-doubt, at - next.half), hi: Math.min(doubt, at + next.half) }))
    .filter((o) => o.lo <= o.hi)
  if (!overlaps.length) return { ...next, moved: true }
  if (overlaps.length > 1) return next.half <= doubt ? { ...next, moved: false } : { mid: held.mid, half: doubt, at: next.at, moved: false }
  const [o] = overlaps
  /*
   * The answer is said as a beat beside the NEWEST window, not the first
   * one ever held: `beat` is this device's idea of the unit's, and counting
   * a tenth of a percent of difference across ten minutes of beats would
   * be the whole doubt there is.
   */
  const near = next.mid - o.at
  return { mid: near + (o.lo + o.hi) / 2, half: Math.max(BEAT_LOCK.floorMs, (o.hi - o.lo) / 2), at: next.at, moved: false }
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
 * The part of a move made on this beat: all of what is left, or a share of
 * a beat (slewOfBeat) where more is left than that.
 */
export function slewPart(left, beat) {
  if (!Number.isFinite(left) || !(beat > 0)) return 0
  const most = beat * BEAT_LOCK.slewOfBeat
  return Math.max(-most, Math.min(most, left))
}

/**
 * Whether a belief about the unit's beat is sure enough to say the two are
 * in step, with `left` of a move still to make. Only a belief a window has
 * agreed with WITHOUT moving it (`sure`, lib/unitBeat): two windows that only
 * agree with each other are just as likely a device keeping a tempo a little
 * off the unit's, followed round every few seconds, and the light then
 * drifts tens of milliseconds between windows (an independent read found it
 * said "In step" 110 ms off at 122 against 120).
 */
export const inStepWith = (window, left = 0) => Boolean(window) && window.sure === true && window.half <= BEAT_LOCK.inStepMs && Math.abs(left) <= BEAT_LOCK.inStepMs

/**
 * Whether the unit's beats, `gap` apart as the computer timed them, come at
 * this device's tempo of `beat` ms: a whole number of its beats (one, or a
 * bar's) to within sameTempoMs, AND the tempo that gap says within
 * sameTempoBpm of the device's. Both are needed: the milliseconds close a
 * part of a BPM off at slow tempos, the BPM a whole one off at fast ones.
 * False with no gap to go by.
 */
export function sameTempo(gap, beat) {
  if (!(gap > 0) || !(beat > 0)) return false
  const n = Math.round(gap / beat)
  return (
    n >= 1 &&
    n <= BEAT_LOCK.beatsApart &&
    Math.abs(gap - n * beat) <= BEAT_LOCK.sameTempoMs &&
    Math.abs((60000 * n) / gap - 60000 / beat) < BEAT_LOCK.sameTempoBpm
  )
}

/**
 * Whether the device's beat, of `beat` ms, is HELD ON the unit's: a sure
 * belief (as inStepWith), the move onto it made, however wide the window,
 * and the unit's beat at this device's tempo by the computer's own gap
 * (sameTempo). A sure belief does not show that on a wide window: a device
 * a beat a few milliseconds off still lands inside the next one. A window
 * with no gap (one this device heard itself, over Bluetooth or the cable:
 * windowFromWire) is never held on; Tap along is not offered there anyway. Through
 * a computer over the internet the window is rarely within inStepMs, so
 * the words never say "In step" there, but the device's beat is moved onto
 * the window's middle all the same and stays there across a stop and a
 * start: as near the unit's as the road can place it, off only by how
 * lopsided the road is, which is what a line-up by ear is for. Tap along
 * goes by this (lib/lineUp tapAlongHere), never the words.
 */
export const heldOnWith = (window, left = 0, beat = 0) =>
  Boolean(window) && window.sure === true && Math.abs(left) <= BEAT_LOCK.inStepMs && sameTempo(window.gap, beat)

/**
 * Whether what came back from GET /tempo/beat is its answer at all. A
 * computer app from before it existed answers with its web page (it sends
 * the page for any address it does not know), never an error.
 */
export const isBeatAnswer = (answer) => Boolean(answer) && typeof answer === 'object' && answer.ok === true && typeof answer.count === 'number'

/** What the log says of an answer that gave no window. */
export const whyWords = (why) =>
  ({
    none: 'the unit has sent no beat (Send Realtime Sysex may be off on it: Setup → MIDI/Remote)',
    finding: 'the computer has only just started hearing the unit’s beat again',
    tempo: 'the unit’s beats come at another tempo than this device is keeping',
    stale: 'the unit’s beats have stopped',
    slow: 'the answer took too long to say where in the beat',
    bad: 'the answer was not one'
  })[why] || 'nothing to go on'
