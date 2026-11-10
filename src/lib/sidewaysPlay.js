/*
 * PLAY IN A PHONE'S BROWSER, THE PHONE HELD ON ITS SIDE: TWO HALVES OF
 * SQUARE TILES.
 *
 * "This is the landscape view on iPhone ... let's split the screen in half
 * kind of like the iPhone duo even though things will be smaller. It'll
 * still look better instead of just stretching everything." And, shown the
 * first pictures: "Can you make the icons more square looking instead of
 * stretched? For the iPhone landscape views." (Justin, 10 November 2026.)
 *
 * The screenshot he sent with that was THIS page, the website in his
 * iPhone's browser: the phone app itself is held upright by its build, so
 * the browser is the one place a phone on its side is real today. The app
 * has the same arrangement waiting (mobile/src/lib/sidewaysPlay.js); this is
 * the browser's own copy of the rule, because the browser never imports
 * from mobile/. test/web-sideways.mjs runs both over one sweep and holds
 * them to the same squares.
 *
 * WHAT IT DRAWS (components/Gig.jsx, styles.css `data-sideways`): the
 * scenes in the left half and the chain in the right, every tile a square,
 * each grid centred in its half; Previous, Tuner, Edit, Tap and Next in one
 * row along the bottom; the preset's name and Setlists in one short row
 * over the halves, or up in the top bar where that buys clearly bigger
 * squares (`headUp`).
 *
 * Nothing here touches the page, so the tests run it as it is.
 */

import { browserDevice } from '../../shared/device-word.mjs'
import { isAdmin } from '../../shared/admin.mjs'

/* ------------------------------------------------------------------ */
/* Who sees it                                                         */
/* ------------------------------------------------------------------ */

/**
 * THE SWITCH. False: Justin's account only, until he has looked at it on
 * his own iPhone. True opens it to everybody whose browser is a phone on
 * its side. Every other account, signed out, and the demo with nobody
 * signed in get exactly the page they had.
 */
export const PHONE_SIDEWAYS_ON_THE_WEB_FOR_EVERYONE = false

/** Whether the account signed in on this page is let in: `id` is the same read the Developer rows use (link.account?.id). */
export const sidewaysOpenTo = (id, everyone = PHONE_SIDEWAYS_ON_THE_WEB_FOR_EVERYONE) => everyone === true || isAdmin(id)

/* ------------------------------------------------------------------ */
/* Which window                                                        */
/* ------------------------------------------------------------------ */

/** From this many CSS pixels across: each half is 360 before the phone's own edges come off. An iPhone SE on its side (667) stays one screen. */
export const SIDEWAYS_WIDE = 720
/** And UNDER this many down, which is what makes it a phone on its side: a tablet either way up is taller. */
export const SIDEWAYS_UNDER = 500
/** And at least this many down: under it two halves of tiles are not worth drawing. */
export const SIDEWAYS_LOW = 250

/**
 * The same three numbers as the browser's own question, for lib/asks
 * useAsks, which is how App.jsx already asks about the window (its
 * `narrow`). "Wider than tall" is the orientation.
 */
export const SIDEWAYS_ASKS = `(orientation: landscape) and (min-width: ${SIDEWAYS_WIDE}px) and (min-height: ${SIDEWAYS_LOW}px) and (max-height: ${SIDEWAYS_UNDER - 0.02}px)`

/** Whether a window `width` by `height` is low and wide enough: what SIDEWAYS_ASKS asks, as arithmetic. */
export function sidewaysWindow({ width = 0, height = 0 } = {}) {
  const w = Number(width) || 0
  const h = Number(height) || 0
  return w > h && w >= SIDEWAYS_WIDE && h >= SIDEWAYS_LOW && h < SIDEWAYS_UNDER
}

/**
 * Whether this browser is a phone's: by its own user agent and touch
 * (shared/device-word browserDevice), never by the page's role, which the
 * demo borrows from the computer. Never the computer app's own window, and
 * never a laptop's or a tablet's browser made low and wide.
 */
export function phoneBrowser({ nav = typeof navigator !== 'undefined' ? navigator : {}, screen = typeof window !== 'undefined' ? window.screen || {} : {}, desktopApp = false } = {}) {
  if (desktopApp) return false
  return browserDevice({ userAgent: nav.userAgent || '', touchPoints: nav.maxTouchPoints || 0, width: screen.width || 0, height: screen.height || 0 }) === 'phone'
}

/** All of it: a phone's browser, a low wide window, and an account that is let in. */
export const webSidewaysOn = ({ lowWide = false, phone = false, accountId = null, everyone = PHONE_SIDEWAYS_ON_THE_WEB_FOR_EVERYONE } = {}) =>
  lowWide === true && phone === true && sidewaysOpenTo(accountId, everyone)

/* ------------------------------------------------------------------ */
/* The squares                                                         */
/* ------------------------------------------------------------------ */

/** The least a square may be: a thumb's tile with room for a name. Under it the page scrolls down instead. */
export const SQUARE_SMALLEST = 64
/** The most: one scene and one pedal are not drawn the height of the screen. */
export const SQUARE_BIGGEST = 160
/** A grid that scrolls is drawn at the biggest square at or under this that its width takes. */
export const SCROLL_SQUARE = 104
/** How much bigger the squares must get for the preset's row to go up into the top bar. */
export const HEAD_UP_BUYS = 1.15
/** And how much bigger they must still be for it to stay up, once it is. */
export const HEAD_UP_KEEPS = 1.05

/* What the page draws round the squares, in CSS pixels; styles.css draws these same numbers (a test holds the two together). */
/** Between two tiles. */
export const SIDE_GAP = 8
/** A half's heading (SCENES, CHAIN) with the gap under it. */
export const SIDE_HEAD = 22
/** Between the two halves. */
export const SIDE_BESIDE = 24
/** The preset's row over the halves, with the gap under it. */
export const SIDE_HEAD_ROW = 52
/** A pedal's square under this is too narrow for its whole name ("REVERB 1"), and says its three letters, as an upright phone's tiles do. */
export const SIDE_NAME_ROOM = 88

const whole = (n) => Math.max(0, Math.floor(Number(n)) || 0)
const px = (n) => Math.max(0, Number(n) || 0)
const NONE = { cols: 0, side: 0 }
const across = (width, cols, gap) => (width - (cols - 1) * gap) / cols

/** The biggest squares `n` tiles can be in `width` by `height` with no scroll, or null when that is under SQUARE_SMALLEST. Fewer to a row wins a tie. */
export function fitSquares(n, width, height, gap = SIDE_GAP) {
  const count = whole(n)
  if (!count) return NONE
  let best = null
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols)
    const side = Math.floor(Math.min(SQUARE_BIGGEST, across(width, cols, gap), (height - (rows - 1) * gap) / rows))
    if (!best || side > best.side) best = { cols, side }
  }
  return best && best.side >= SQUARE_SMALLEST ? best : null
}

/** The squares `n` tiles are drawn at when they do not fit and the page scrolls. */
export function scrollSquares(n, width, gap = SIDE_GAP) {
  const count = whole(n)
  if (!count) return NONE
  let cols = 1
  while (cols < count && across(width, cols, gap) > SCROLL_SQUARE && across(width, cols + 1, gap) >= SQUARE_SMALLEST) cols++
  return { cols, side: Math.max(1, Math.floor(Math.min(SCROLL_SQUARE, across(width, cols, gap)))) }
}

function planIn({ w, room, s, p, gap, head, beside }) {
  if (s && p) {
    const half = (w - beside) / 2
    const a = fitSquares(s, half, room - head, gap)
    const b = fitSquares(p, half, room - head, gap)
    return { beside: true, scenes: a || scrollSquares(s, half, gap), chain: b || scrollSquares(p, half, gap), scrolls: !a || !b }
  }
  /* Only the scenes, or only the pedals: the whole row. */
  const n = s || p
  const one = fitSquares(n, w, room - head, gap)
  const grid = one || scrollSquares(n, w, gap)
  return { beside: false, scenes: s ? grid : NONE, chain: p ? grid : NONE, scrolls: !one }
}

const smallest = (plan) => Math.min(...[plan.scenes, plan.chain].filter((g) => g.cols > 0).map((g) => g.side))

/**
 * The squares for `scenes` scenes and `pedals` pedals (the looper's
 * included) in a row `width` across, with `room` down from the top of the
 * halves' headings to the top of the bottom row WHILE the preset's row is
 * in the page:
 *
 *   { beside, sceneCols, chainCols, scene, pedal, scrolls, headUp }
 *
 * `scene` and `pedal` are a square's side in whole CSS pixels. `headUp`
 * says the preset's row belongs in the top bar: when that makes the
 * smallest square at least HEAD_UP_BUYS times bigger, or saves a scroll
 * (and once up, `headWas`, while it still buys HEAD_UP_KEEPS). By what it
 * buys, never by the unit's name. Nothing to draw, nothing measured yet:
 * null, and Play waits.
 */
export function webSidewaysPlan({ width = 0, room = 0, scenes = 0, pedals = 0, gap = SIDE_GAP, head = SIDE_HEAD, beside = SIDE_BESIDE, headRow = SIDE_HEAD_ROW, canHeadUp = true, headWas = false } = {}) {
  const s = whole(scenes)
  const p = whole(pedals)
  const w = px(width)
  const h = px(room)
  if ((!s && !p) || !w || !h) return null
  const ask = { w, s, p, gap, head, beside }
  const down = planIn({ ...ask, room: h })
  let plan = down
  let headUp = false
  if (canHeadUp === true && px(headRow) > 0) {
    const up = planIn({ ...ask, room: h + px(headRow) })
    const buys = headWas === true ? HEAD_UP_KEEPS : HEAD_UP_BUYS
    if ((down.scrolls && !up.scrolls) || (!up.scrolls && smallest(up) >= buys * smallest(down))) {
      plan = up
      headUp = true
    }
  }
  return {
    beside: plan.beside,
    sceneCols: plan.scenes.cols,
    chainCols: plan.chain.cols,
    scene: plan.scenes.side,
    pedal: plan.chain.side,
    scrolls: plan.scrolls,
    headUp
  }
}
