/*
 * WHICH WAY UP A PHONE MAY BE HELD, PAGE BY PAGE.
 *
 * "Landscape mode on iPhone is not working." (Justin, 10 November 2026.)
 * Play on a phone held on its side had been built to split in two (lib/
 * twoSides phoneSidewaysOn; lib/sidewaysPlay), and no phone could be turned
 * to see it: an iPhone was held upright by app.json, an Android phone by
 * plugins/withTabletTurns. The build that carries this file lets a phone
 * turn, and this is the rule for where:
 *
 *   a tablet   NOTHING IS ASKED. An iPad, an Android tablet and a fold
 *              opened turn every way up, as they always have, and nothing
 *              here touches them (`turnsWanted` answers null).
 *   a phone    UPRIGHT, EXCEPT ON PLAY: on Play, on what opens beside Play
 *              (Edit, Setlists, All presets, the tuner in a side, Notes, a
 *              held block's knobs) and in Stage view it may be held either
 *              way on its side as well as upright. Everywhere else it is
 *              upright, as it was: the startup card, the walkthrough, the
 *              sign-in, the purchase page, Settings and every page in it,
 *              Bluetooth, the reports, Troubleshooting, Gear, How do you
 *              connect to your unit? and the sharing card. Those pages were
 *              drawn for a phone held upright and nobody has asked for them
 *              sideways.
 *
 * AND ONLY FOR AN ACCOUNT THE SIDEWAYS LAYOUT IS OPEN TO (App.js
 * `sidewaysAllowed`: his, until features PHONE_SIDEWAYS_FOR_EVERYONE). For
 * every other account a phone is upright on every page, Play among them, so
 * the app in their hands is exactly the app it was.
 *
 * AND ONLY ON A PHONE LONG ENOUGH TO SPLIT (`fitsSideways`). A phone whose
 * screen would be under SIDEWAYS_AT across on its side (an iPhone SE, a 13
 * mini, a small Android) would not split in two there: it would show Play
 * stretched, which is the screen he objected to ("instead of just stretching
 * everything"). Such a phone stays upright. What it would have across is
 * worked out while it is upright (`sidewaysAcross`), and checked against the
 * frame the app really measures once it is on its side (`tooNarrow`): a
 * phone that turned and came out under the line goes back upright and stays.
 *
 * UPSIDE DOWN IS NEVER ASKED FOR ON A PHONE. On the iPhone "turns" is every
 * way but upside down; on Android it is the phone's own choice, which is
 * never upside down on a phone and follows its auto-rotate switch.
 *
 * lib/turnScreen asks the phone for what this answers, and components/
 * PhoneTurns reads the screen for it. Nothing here imports anything, so the
 * tests run it as it is.
 */

/** The short side, in points, from which a screen is a tablet's (shared/device-word.mjs TABLET_SIDE; plugins/withTabletTurns writes the same number into Android). A test holds the three together. */
export const TABLET_SIDE = 600
/** The frame width from which a phone on its side splits in two (lib/twoSides SIDEWAYS_AT). A test holds the two together. */
export const SIDEWAYS_AT = 720
/** An iPhone's top inset over this is a notch or an island, which it keeps down BOTH sides when it is turned; at or under it, it is the clock's bar alone, which goes away. */
export const NOTCH_OVER = 24
/** An Android phone's bottom inset from this is its three buttons, which move to the side when it is turned; under it, it is the swipe bar, which stays underneath. */
export const BUTTONS_FROM = 40

/** Held upright, and nothing else. */
export const UPRIGHT = 'upright'
/** Upright or on either side: never upside down. */
export const TURNS = 'turns'
/** What a fold opened is told once, if it was held upright or let turn while it was shut: nothing is asked of it any more. */
export const RELEASE = 'release'

const num = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0)

/** Whether the whole screen (never the window) is a tablet's: an iPad, or a short side of TABLET_SIDE or more. */
export const isTablet = ({ pad = false, width = 0, height = 0 } = {}) => pad === true || Math.min(num(width), num(height)) >= TABLET_SIDE

/**
 * How many points across the app would have on a phone held on its side,
 * from what it measures now. `width` and `height` are the whole screen's,
 * either way up; `top` and `bottom` are the insets WHILE IT IS UPRIGHT.
 *
 *   an iPhone   a notch or an island (top over NOTCH_OVER) is kept clear down
 *               both sides, so twice it comes off: an iPhone 17 is 852 less
 *               59 and 59, a Pro Max 956 less 62 and 62. A Home-button
 *               iPhone's clock bar goes away, so nothing comes off.
 *   Android     the camera's cut-out is on one side only, about as deep as
 *               the bar over the clock (top), and three buttons (bottom from
 *               BUTTONS_FROM) move to the other side.
 */
export function sidewaysAcross({ os = 'ios', width = 0, height = 0, top = 0, bottom = 0 } = {}) {
  const long = Math.max(num(width), num(height))
  if (os === 'android') return Math.max(0, long - num(top) - (num(bottom) >= BUTTONS_FROM ? num(bottom) : 0))
  return Math.max(0, long - (num(top) > NOTCH_OVER ? 2 * num(top) : 0))
}

/** Whether a phone with that much across on its side would split in two there. */
export const fitsSideways = (across) => num(across) >= SIDEWAYS_AT

/**
 * Whether the frame the app really measured (App.js, under the top bar) is a
 * phone on its side that came out too narrow to split. `short` is the whole
 * screen's short side.
 *
 * ON ITS SIDE IS SAID BY THE WIDTH ALONE: a frame wider than the screen's
 * short side. Held upright no frame is, and on its side every frame is,
 * whatever its height. The height is never asked, because the keyboard takes
 * it: a phone held upright with the keyboard up has a frame wider than it is
 * tall, and reading that as a small phone on its side would have kept it
 * upright for good after one search typed in Edit.
 */
export function tooNarrow({ frame = null, short = 0 } = {}) {
  const w = num(frame?.width)
  const s = num(short)
  return s > 0 && w > s && w < SIDEWAYS_AT
}

/**
 * What this screen wants of the phone: null (a tablet: nothing is asked),
 * UPRIGHT or TURNS.
 *
 *   tablet     the whole screen is a tablet's (isTablet)
 *   allowed    the sideways layout is open to this account
 *   fits       the phone is long enough to split on its side
 *   inApp      past the startup card, the walkthrough, the sign-in, the
 *              purchase page, How do you connect? and the sharing card
 *   onPlay     Play is the screen (or the wait for a rig in its place)
 *   beside     the screen is one that opens beside Play
 *   stageView  Stage view is up
 */
export function turnsWanted({ tablet = false, allowed = false, fits = false, inApp = false, onPlay = false, beside = false, stageView = false } = {}) {
  if (tablet === true) return null
  if (allowed !== true || fits !== true || inApp !== true) return UPRIGHT
  return onPlay === true || beside === true || stageView === true ? TURNS : UPRIGHT
}

/**
 * What to ask the phone for now, given what it was last asked (`asked`:
 * UPRIGHT, TURNS or null for nothing) and what is wanted: UPRIGHT, TURNS,
 * RELEASE, or null for nothing to ask. On a tablet nothing is ever asked,
 * except to let go of what this app itself asked while the screen was a
 * phone's (a fold opened).
 */
export function turnStep(asked = null, wanted = null) {
  if (wanted !== UPRIGHT && wanted !== TURNS) return asked === UPRIGHT || asked === TURNS ? RELEASE : null
  return asked === wanted ? null : wanted
}
