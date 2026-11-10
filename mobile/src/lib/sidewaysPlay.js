/*
 * PLAY ON A PHONE HELD ON ITS SIDE: TWO HALVES OF SQUARE TILES.
 *
 * "This is the landscape view on iPhone ... let's split the screen in half
 * kind of like the iPhone duo even though things will be smaller. It'll
 * still look better instead of just stretching everything." And, shown the
 * first pictures of it: "Can you make the icons more square looking instead
 * of stretched? For the iPhone landscape views." (Justin, 10 November 2026.)
 *
 * So here SQUARE WINS OVER FILLING, the other way round from a tablet's
 * Play (lib/squarePlay tilePlan, where the tiles fill the screen and are
 * only as square as that allows). Every tile is a square. Room a grid does
 * not need is left round it, and Play centres each grid in its half.
 *
 * TWO SHAPES, by where Play is:
 *
 *   split     Play has the whole window (`split` true): the scenes in the
 *             left half and the chain in the right, each its own squares,
 *             as big as its half allows across and down. An FM3's eight
 *             scenes and eight pedals are four across by two in each half;
 *             an AM4's four and four are two by two.
 *   stacked   Play is in one half beside a tool (`split` false), or has
 *             only scenes or only pedals: the scenes over the chain, each
 *             as big as its row takes, and both a little smaller, by the
 *             same share, where that fits them without a scroll (an AM4: a
 *             row of four over a row of four).
 *
 * WHEN THEY DO NOT FIT as squares of at least SQUARE_SMALLEST (a thumb),
 * nothing shrinks under that: the grid that does not fit is drawn at the
 * biggest square at or under SCROLL_SQUARE that its width takes, and Play's
 * page scrolls (`scrolls`).
 *
 * THE PRESET'S ROW, UP OR DOWN (`headUp`). The preset's name and Setlists
 * sit in a row over the halves (the FM3's picture). Where that row is what
 * holds the squares down, it goes up into the app's top bar instead (the
 * AM4's picture: its pads are about 133 across with the row up and about
 * 104 with it in the page). One rule, by what it buys and never by the
 * unit's name: up when that makes the smallest square at least
 * HEAD_UP_BUYS times bigger, or saves a scroll (and once up, `headWas`, it
 * stays while it still buys HEAD_UP_KEEPS). Only asked where the top bar
 * has room for it (`canHeadUp`: Play alone).
 *
 * `width` is Play's row, `room` the height from the top of the scenes'
 * heading to the bottom of Play's page WITH the preset's row in the page,
 * and `headRow` what that row and its gap take. `head` is a heading with
 * the gap under it, `beside` the gap between the halves, `between` the gap
 * between the scenes and the chain one over the other.
 *
 * The answer has tilePlan's own shape, so Play draws with either:
 *
 *   { beside, sceneCols, chainCols, scene: { wide, high }, pedal: { wide, high }, capped, scrolls, headUp }
 *
 * Nothing here imports anything, so the tests run it as it is.
 */

/** The least a square may be: a thumb's tile with room for a name. Under it the page scrolls instead. */
export const SQUARE_SMALLEST = 64
/** The most: one scene and one pedal are not drawn the height of the screen. */
export const SQUARE_BIGGEST = 160
/** A grid that scrolls is drawn at the biggest square at or under this that its width takes. */
export const SCROLL_SQUARE = 104
/** How much bigger the squares must get for the preset's row to go up into the top bar. */
export const HEAD_UP_BUYS = 1.15
/** And how much bigger they must still be for it to stay up, once it is (`headWas`): under where it went up, so a point of measuring either way does not send it up and down. */
export const HEAD_UP_KEEPS = 1.05

const whole = (n) => Math.max(0, Math.floor(Number(n)) || 0)
const pts = (n) => Math.max(0, Number(n) || 0)
const NONE = { cols: 0, side: 0 }

/** The side of a square with `cols` of them across `width`. */
const across = (width, cols, gap) => (width - (cols - 1) * gap) / cols

/**
 * The biggest squares `n` tiles can be in `width` by `height` with no
 * scroll: { cols, side } in whole points, or null when the best is under
 * SQUARE_SMALLEST. Fewer to a row wins a tie.
 */
export function fitSquares(n, width, height, gap = 8) {
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

/**
 * The squares `n` tiles are drawn at when they do not fit and the page
 * scrolls: the fewest to a row whose square is at or under SCROLL_SQUARE
 * (never more to a row than there are tiles, never under SQUARE_SMALLEST
 * while the width allows it).
 */
export function scrollSquares(n, width, gap = 8) {
  const count = whole(n)
  if (!count) return NONE
  let cols = 1
  while (cols < count && across(width, cols, gap) > SCROLL_SQUARE && across(width, cols + 1, gap) >= SQUARE_SMALLEST) cols++
  return { cols, side: Math.max(1, Math.floor(Math.min(SCROLL_SQUARE, across(width, cols, gap)))) }
}

const square = (g) => ({ wide: g.side, high: g.side })

/** One plan in `room`, the preset's row wherever it is. */
function planIn({ w, room, s, p, gap, head, beside, between, split }) {
  if (split && s && p) {
    const half = (w - beside) / 2
    const a = fitSquares(s, half, room - head, gap)
    const b = fitSquares(p, half, room - head, gap)
    const scenes = a || scrollSquares(s, half, gap)
    const chain = b || scrollSquares(p, half, gap)
    return { beside: true, scenes, chain, scrolls: !a || !b }
  }
  if (s && p) {
    /* One over the other: the pair of sizes that fits with the biggest smaller square, then the biggest other. */
    let best = null
    for (let sc = 1; sc <= s; sc++) {
      for (let cc = 1; cc <= p; cc++) {
        const sr = Math.ceil(s / sc)
        const cr = Math.ceil(p / cc)
        /* As big as the row takes; and where that is too tall for the room, both a little smaller, by the same share. */
        const sceneWide = Math.min(SQUARE_BIGGEST, across(w, sc, gap))
        const pedalWide = Math.min(SQUARE_BIGGEST, across(w, cc, gap))
        const round = 2 * head + between + (sr - 1) * gap + (cr - 1) * gap
        const share = Math.min(1, (room - round) / (sr * sceneWide + cr * pedalWide))
        const scene = Math.floor(sceneWide * share)
        const pedal = Math.floor(pedalWide * share)
        if (scene < SQUARE_SMALLEST || pedal < SQUARE_SMALLEST) continue
        const least = Math.min(scene, pedal)
        const sum = scene + pedal
        if (!best || least > best.least || (least === best.least && sum > best.sum)) best = { least, sum, scenes: { cols: sc, side: scene }, chain: { cols: cc, side: pedal } }
      }
    }
    if (best) return { beside: false, scenes: best.scenes, chain: best.chain, scrolls: false }
    return { beside: false, scenes: scrollSquares(s, w, gap), chain: scrollSquares(p, w, gap), scrolls: true }
  }
  /* Only the scenes, or only the pedals: the whole row. */
  const n = s || p
  const one = fitSquares(n, w, room - head, gap)
  const grid = one || scrollSquares(n, w, gap)
  return { beside: false, scenes: s ? grid : NONE, chain: p ? grid : NONE, scrolls: !one }
}

/** The smallest square a plan draws, over the kinds it has. */
const smallest = (plan) => Math.min(...[plan.scenes, plan.chain].filter((g) => g.cols > 0).map((g) => g.side))

/**
 * The squares for `scenes` scenes and `pedals` pedals (the looper's
 * included) on a phone on its side. Nothing to draw, nothing measured yet:
 * null, and Play draws as it did.
 */
export function sidewaysPlan({ width = 0, room = 0, scenes = 0, pedals = 0, gap = 8, head = 26, beside = 24, between = 16, headRow = 0, split = true, canHeadUp = false, headWas = false } = {}) {
  const s = whole(scenes)
  const p = whole(pedals)
  const w = pts(width)
  const h = pts(room)
  if ((!s && !p) || !w || !h) return null
  const ask = { w, s, p, gap, head, beside, between, split: split === true }
  const down = planIn({ ...ask, room: h })
  let plan = down
  let headUp = false
  if (canHeadUp === true && pts(headRow) > 0) {
    const up = planIn({ ...ask, room: h + pts(headRow) })
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
    scene: square(plan.scenes),
    pedal: square(plan.chain),
    capped: false,
    scrolls: plan.scrolls,
    headUp
  }
}
