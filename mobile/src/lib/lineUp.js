/*
 * LINING UP THE LIGHT AND THE CLICK WITH THE UNIT'S CLICK, BY HAND OR BY
 * TAPPING ALONG.
 *
 * "Also, the watch is not in sync with the phone with the flashes and the
 * taps and the sound ... Will you make sure everything's in sync properly
 * somehow or have a way for a user to calibrate" (Justin, 16 November 2026).
 *
 * The device keeps a beat of its own (lib/metronome usePhoneClick), put onto
 * the unit's own beat where the unit sends one (lib/beatLock). What is left
 * between them, nobody can measure from here: how long the unit's click
 * takes to come out of the speakers, how long this device's sound takes to
 * come out of whatever it plays through, and, through the computer, how
 * lopsided the road is. Somebody listening can. So Settings → Metronome has
 * two nudges, each kept on the device:
 *
 *   light  the flash round the edge of the screen (and anything else that
 *          lights on the beat: the green dot on Tap)
 *   click  the device's own click, and the tap felt with it
 *
 * each Earlier or Later in steps of LINE_UP.step, within LINE_UP.min and
 * LINE_UP.max. A nudge moves exactly that, and nothing written to the unit:
 * the unit is told on and off, never a time.
 *
 * And a third, `watch`, kept the same way and drawn nowhere yet: the Apple
 * Watch's tap. No watch build reads it today (lib/watchBridge sends it only
 * to a watch that says it knows `beat`); the next watch build reads it and
 * Settings shows its row then.
 *
 * TAP ALONG does the measuring for the player: tap a pad on every click
 * heard from the unit, for TAP_ALONG.least beats or more. Each tap is held
 * against the device's own nearest beat (offBeat), the middle of them is
 * taken (the median, so one late tap moves nothing), taps far from it are
 * dropped, and only if what is left is steady are both nudges set to it.
 * Not steady, nothing is changed, and the words say so.
 *
 * WHO IS OFFERED IT is his account until features
 * METRONOME_LINE_UP_FOR_EVERYONE (`lineUpOpen`), as every new thing is. For
 * every other account the nudges are not drawn and not applied, whatever
 * the device has kept.
 *
 * The rules, kept apart so they can be tested. Nothing here imports
 * anything.
 */

/** Whether an account is offered the line-up at all: his, or everyone once the switch is on. */
export const lineUpOpen = ({ admin = false, everyone = false } = {}) => admin === true || everyone === true

/** How far a nudge goes, and by how much a press. */
export const LINE_UP = Object.freeze({ min: -200, max: 200, step: 10 })

/** Where each nudge is kept, on the device. */
export const LINE_UP_KEYS = Object.freeze({
  light: 'fractal.metronome.lineUp.light',
  click: 'fractal.metronome.lineUp.click',
  /* The Apple Watch's: kept, sent to a watch that knows it, drawn nowhere yet. */
  watch: 'fractal.metronome.lineUp.watch'
})

/** A nudge made safe: whole steps, within range, and anything unreadable is none. */
export function lineUpNudge(ms) {
  const n = Math.round(Number(ms) / LINE_UP.step) * LINE_UP.step
  if (!Number.isFinite(n)) return 0
  /* Never a minus nought, which reads as "-0 ms". */
  return Math.max(LINE_UP.min, Math.min(LINE_UP.max, n)) || 0
}

/** A nudge out of what is on disk: none unless one was kept. */
export const lineUpKept = (raw) => (typeof raw === 'string' && raw.trim() !== '' ? lineUpNudge(raw) : 0)

/** And what goes on disk for it. */
export const lineUpToKeep = (ms) => String(lineUpNudge(ms))

/** A nudge in his words: "20 ms later", "30 ms earlier", or not moved. */
export function lineUpWords(ms) {
  const n = lineUpNudge(ms)
  if (n === 0) return 'Not moved'
  return `${Math.abs(n)} ms ${n > 0 ? 'later' : 'earlier'}`
}

/**
 * WHEN EACH THING HAPPENS ON A BEAT, from the beat's own moment `at` (when
 * the click is asked for with nothing moved), in milliseconds after it.
 *
 *   sound   whether the device clicks (with no sound there is no click and
 *           no tap, and the light is all there is)
 *   lead    how long after the click is asked for it is heard (shared
 *           flashLead, Flash timing included): the light and the tap wait
 *           for it, as they always have. Nothing with no sound.
 *   light, click   the two nudges
 *
 * Answers `clickAt` (null with no sound), `tapAt` (with the click, as it is
 * heard: null with no sound), `lightAt`, and `early`: how long before `at`
 * the beat's code has to run so that nothing is booked in the past. Nought
 * with nothing moved earlier, so with no nudges every beat runs exactly as
 * it did before there were any.
 */
export function lineUpTimes({ sound = false, lead = 0, light = 0, click = 0 } = {}) {
  const heard = sound === true && Number.isFinite(lead) ? Math.max(0, lead) : 0
  const c = lineUpNudge(click)
  const clickAt = sound === true ? c : null
  const tapAt = sound === true ? c + heard : null
  const lightAt = heard + lineUpNudge(light)
  const early = Math.max(0, -lightAt, clickAt === null ? 0 : -clickAt)
  return { clickAt, tapAt, lightAt, early }
}

/** How far a moment is from the nearest of a run of beats (`beatAt` one of them, `beat` apart): after it plus, before it minus, in the half beat either side. */
export function offBeat(t, beatAt, beat) {
  if (!Number.isFinite(t) || !Number.isFinite(beatAt) || !(beat > 0)) return null
  const r = (((t - beatAt) % beat) + beat) % beat
  return r > beat / 2 ? r - beat : r
}

/** Whether two moments are on the same beat of a run `beat` apart, to within `within` ms. */
export function samePhase(a, b, beat, within = 1) {
  const d = offBeat(a, b, beat)
  return d !== null && Math.abs(d) <= within
}

/*
 * TAP ALONG'S RULES.
 *
 *   least   the fewest taps it goes by
 *   most    where it stops by itself
 *   wide    a tap further than this from the middle of them all is dropped
 *   steady  how far, at the middle, the taps kept may be from their own
 *           middle (the median of how far each is): further, and they are
 *           too uneven to go by
 *   kept    the share of the taps that has to be kept
 */
export const TAP_ALONG = Object.freeze({ least: 8, most: 16, wide: 60, steady: 25, kept: 0.75 })

const median = (list) => {
  const s = [...list].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * What a run of taps comes to. `offsets` is each tap's offBeat against the
 * device's own beat.
 *
 * Answers `{ steady, ms, why, taps, kept, dropped, spread }`: `steady` and
 * `ms`, the nudge to set both to, only when it can be gone by; else `why`:
 * 'few' (fewer than TAP_ALONG.least), 'uneven' (too many dropped, or what
 * is kept too spread out) or 'far' (further than a nudge can move). And
 * lib/metronome finishTapAlong answers 'moved' for a run in which the
 * device's beat moved or was not held on the unit's (tapAlongHere has why).
 */
export function tapAlong(offsets = []) {
  const all = (Array.isArray(offsets) ? offsets : []).filter((d) => Number.isFinite(d))
  const none = { steady: false, ms: null, taps: all.length, kept: 0, dropped: 0, spread: null }
  if (all.length < TAP_ALONG.least) return { ...none, why: 'few' }
  const middle = median(all)
  const kept = all.filter((d) => Math.abs(d - middle) <= TAP_ALONG.wide)
  const dropped = all.length - kept.length
  const centre = kept.length ? median(kept) : middle
  const spread = kept.length ? median(kept.map((d) => Math.abs(d - centre))) : null
  const said = { ...none, kept: kept.length, dropped, spread }
  if (kept.length < TAP_ALONG.least || kept.length < all.length * TAP_ALONG.kept || spread > TAP_ALONG.steady) return { ...said, why: 'uneven' }
  if (Math.abs(centre) > LINE_UP.max + LINE_UP.step / 2) return { ...said, why: 'far' }
  return { ...said, steady: true, ms: lineUpNudge(centre), why: null }
}

/**
 * Whether Tap along is offered, and if not, why, in his words. Only where
 * there is a click from the unit to tap to (Unit or Both, where the app can
 * switch it, and not the sound picked Off, which puts the place on the
 * device), the metronome on, the device keeping its own beat beside it to
 * hold the taps against (`running`: the light or the device's click), AND
 * that beat held on the unit's (`held`, lib/metronome useBeatHeld: a sure
 * belief about the unit's beat, the move onto it made, and the unit's beat
 * at this device's own tempo by the computer's gap: lib/beatLock sameTempo).
 *
 * WHY HELD ON THE UNIT'S. A nudge is kept, and added to every beat after.
 * With no beat from the unit to follow, the device's beat starts wherever
 * it happens to each time the metronome starts (a tempo, a sound, the
 * flash switch all start it again), so what the taps measured is that one
 * start's gap, and a moment later it is wrong by anything up to half a beat
 * (an independent read found +170, -193 and +140 ms on three restarts
 * after one Tap along). Held on the unit's, the device's beat lands in the
 * same place every time, and what is measured is what is left: how late
 * each sound comes out, and through a computer how lopsided the road is.
 *
 * NOT "IN STEP" (lib/beatLock inStepWith), which also wants the unit's beat
 * known to within 20 ms: through a computer over the internet the window is
 * half the round trip and more each side, so it is almost never that
 * narrow, and Tap along would almost never be offered there. The beat is
 * moved onto the window's middle all the same, and that is what a nudge
 * lines up against.
 *
 * Over Bluetooth the app can't switch the unit's click and the page says
 * to switch it off at the unit, so nobody there has said the unit is
 * clicking: closed there (`can`), whatever the beat. Not held is reached
 * only through a computer, then, and `why` is why, as the beat follower
 * learned it (lib/metronome useBeatWhy; tapAlongClosedWords). `noun` is
 * the device in hand (shared/device-word deviceNoun), read when shown.
 */
export function tapAlongHere({ on = false, where = 'unit', can = false, quiet = false, running = false, held = false, why = null, noun = 'phone' } = {}) {
  if (can !== true) return { offered: false, why: 'Tap along needs the unit’s own click, and the app can’t switch it from here.' }
  if (quiet === true || (where !== 'unit' && where !== 'both')) return { offered: false, why: 'Tap along needs the unit’s click: pick Unit or Both.' }
  if (on !== true) return { offered: false, why: 'Switch the metronome on to tap along.' }
  if (running !== true) return { offered: false, why: `Tap along needs the light or this ${noun}’s click keeping time beside the unit’s. Switch the flash on, or wait for the unit’s tempo.` }
  if (held !== true) return { offered: false, why: tapAlongClosedWords(why, noun) }
  return { offered: true, why: null }
}

/**
 * Why Tap along waits, where this device's beat is not held on the unit's,
 * one short sentence for each cause the beat follower knows (lib/unitBeat
 * onWhy, lib/beatLock whyWords), and while it knows none yet, that it is
 * still finding the beat. Each says only what is so: never to update a
 * computer app that answers, never to switch on what is already on.
 */
export function tapAlongClosedWords(why = null, noun = 'phone') {
  return (
    {
      old: 'Update the computer app to tap along: this one doesn’t say where the unit’s beat falls.',
      none: 'Switch Send Realtime Sysex on at the unit to tap along: Setup → MIDI/Remote.',
      stale: 'The unit has stopped sending its beat, so there is nothing to tap along to.',
      tempo: `The unit’s beat is at another tempo than this ${noun}’s, so Tap along waits until they match.`,
      slow: 'The connection to the computer is too slow to place the unit’s beat, so Tap along can’t be used.',
      failed: 'The computer isn’t answering about the unit’s beat, so Tap along waits.',
      bad: 'The computer isn’t answering about the unit’s beat, so Tap along waits.',
      off: `Tap along needs this ${noun} to follow the unit’s beat, and it doesn’t here.`
    }[why] || 'Still finding where the unit’s beat falls, so Tap along waits.'
  )
}

/** The words of the line-up. `noun` is the device in hand, read when shown. */
export const LINE_UP_WORDS = Object.freeze({
  section: 'Line up the light and click',
  hint: (noun) =>
    `If the light or this ${noun}’s click lands before or after the unit’s click, move it here. Earlier and Later move each by ${LINE_UP.step} ms. Nothing here changes the unit. A nudge lines them up while this ${noun} is following the unit’s beat; where it has no beat from the unit to follow, the light keeps the tempo and starts wherever it falls, and a nudge just moves it that much.`,
  light: 'The light',
  click: (noun) => `This ${noun}’s click`,
  earlier: 'Earlier',
  later: 'Later',
  reset: 'Reset',
  tap: 'Tap along',
  tapHow: `Tap the pad on every click you hear from the unit, for ${TAP_ALONG.least} beats or more, then tap Done.`,
  pad: 'Tap on the click',
  taps: (n) => `${n} ${n === 1 ? 'tap' : 'taps'}`,
  done: 'Done',
  cancel: 'Cancel'
})

/** What Tap along says when it is done, from tapAlong's answer. */
export function tapAlongWords(result, noun = 'phone') {
  if (!result || result.steady !== true) {
    if (result?.why === 'few') return `Tap at least ${TAP_ALONG.least} times, once on every click you hear from the unit.`
    if (result?.why === 'moved') return `This ${noun}’s beat moved or lost the unit’s while you tapped, so nothing was set. Tap along again.`
    if (result?.why === 'far') return `Your taps came more than ${LINE_UP.max} ms from this ${noun}’s beat, further than this can move, so nothing was changed.`
    return 'Your taps were too uneven to go by, so nothing was changed. Try again, tapping on every click you hear from the unit.'
  }
  if (result.ms === 0) return `Your taps came on this ${noun}’s beat, so the light and the click are set to not moved.`
  const by = Math.abs(result.ms)
  const way = result.ms > 0 ? 'later' : 'earlier'
  return `Your taps came ${by} ms ${result.ms > 0 ? 'after' : 'before'} this ${noun}’s beat, so the light and the click are now ${by} ms ${way}.`
}
