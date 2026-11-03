/**
 * PLAY'S WORDS, THE SAME AT BOTH ENDS.
 *
 * "Is there anything else we need to do to match the apps?" (Justin, 3
 * November 2026, of the website.) The browser's Play (src/components/Gig.jsx,
 * Coach.jsx and UnlockOffer.jsx) and the phone's (mobile/src/screens/Stage.js)
 * say every one of these, so they live here once. The phone reads its copy,
 * mobile/src/lib/play-words.js, made by `npm run sync:rules`. A change here
 * changes both screens.
 *
 * These are the phone's words, taken from Stage.js as they were on the day:
 * nothing on the phone's screen changes. Two of them name the device in hand,
 * so they are functions, read when they are shown: the website changes role
 * after its files load (shared/device-word.mjs).
 */
import { deviceKind, deviceNoun } from './device-word.mjs'
import { P5 } from './onboarding.mjs'
import { COACH_BODY_AM4, COACH_DONE_AM4, isAm4 } from './am4-boost.mjs'

/* ------------------------------------------------------------------ */
/* The preset                                                          */
/* ------------------------------------------------------------------ */

/**
 * Over the preset button: "PRESET 000 A01 OF 104", "PRESET 000 OF 512",
 * "PRESET —". `label` is lib/slots slotLabel's, or null with no slot known;
 * `count` is lib/slots slotCount's, or null where the unit has not said.
 */
export const presetLine = (label, count) => `${label ? `PRESET ${label}` : 'PRESET —'}${count ? ` OF ${count}` : ''}`

/** Under the preset's name, on a button that opens every preset. */
export const ALL_PRESETS = 'Tap for all presets'

/* ------------------------------------------------------------------ */
/* The scenes                                                          */
/* ------------------------------------------------------------------ */

/** The Refresh names link beside SCENES, before and after a press. */
export const REFRESH_NAMES = Object.freeze({
  idle: 'Refresh names',
  reading: 'Reading…',
  found: 'Names updated',
  none: 'No names on the unit',
  failed: "Couldn't read them"
})

/** How long its answer stays before it says Refresh names again. */
export const REFRESH_NAMES_SAID_MS = 4000

/* ------------------------------------------------------------------ */
/* The chain                                                           */
/* ------------------------------------------------------------------ */

/** The chain's heading, by how its read is going: 'reading', 'failed', or anything else. */
export const chainHeading = (chain) => (chain === 'reading' ? 'Reading the chain…' : chain === 'failed' ? 'Chain — out of date' : 'Chain')

/** Beside it, where a hold does something. "Where it says chain above the pedals, also put hold to switch channels." */
export const HOLD_FOR_CHANNELS = 'Hold to switch channels'

/**
 * A chain read that failed, the last tiles kept. Each end says how to ask
 * again after it: the phone "Pull down to ask again.", the browser its Try
 * again button, since the website does not pull to refresh (styles.css,
 * overscroll: mid-gig that reloads the page).
 */
export const CHAIN_OUT_OF_DATE = 'The unit didn’t say what’s in this preset, so these buttons may be out of date.'

/** A chain read that came back with nothing to switch. */
export const CHAIN_EMPTY = 'Nothing in this preset but input and output.'

/* ------------------------------------------------------------------ */
/* The demo's card                                                     */
/* ------------------------------------------------------------------ */

/**
 * The demo's card at the top of Play. The phone's components/UnlockOffer.js
 * says the same and keeps its own copy, because its words are quoted in the
 * App Store review notes.
 */
export const DEMO_CARD = 'This is the demo'

/**
 * Under it. Read at render: the website changes role after it loads. The
 * computer app's own window is not a remote, so it says what unlocking gives
 * it, a phone or tablet to play from. MY WORDING for the computer's; Justin
 * can change it.
 */
export const demoCardBody = (kind = deviceKind()) =>
  kind === 'computer' ? 'Unlock to drive your own rig from a phone or tablet.' : `Unlock to drive your own rig from this ${deviceNoun(kind)}.`

/** The pill on it, with the price where there is one. */
export const unlockWord = (price) => (price ? `Unlock ${price}` : 'Unlock')

/* ------------------------------------------------------------------ */
/* The quick tip over the pedals                                       */
/* ------------------------------------------------------------------ */

/**
 * The quick tip's words at each stage, 'tip', 'trying' or 'done': P5's own
 * (shared/onboarding.mjs), his copy, with the AM4's amp's boost said on an
 * AM4, where P5's "Tap toggles the block" is not true of the amp
 * (shared/am4-boost.mjs COACH_BODY_AM4).
 */
export function coachWords(stage, slug) {
  const am4 = isAm4(slug)
  const at = stage === 'trying' ? P5.trying : stage === 'done' ? P5.done : P5
  const body = stage === 'tip' && am4 ? COACH_BODY_AM4 : stage === 'done' && am4 ? COACH_DONE_AM4 : at.body
  return { count: P5.count, head: at.head, body, hold: P5.hold, go: P5.go, skip: P5.skip, done: P5.done.go, foot: P5.foot }
}
