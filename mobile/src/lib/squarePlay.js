/*
 * PLAY'S TILES AS SQUARES ON A BIG SCREEN.
 *
 * "On the markup that shows the edit screen, can we make those blocks look
 * similar to the ones on the screen that shows the tuner?? only they look
 * pretty stretched, and it would be better if they looked like square boxes
 * as much as possible ... Also show me what the portrait view looks like on
 * the iPad, as I don't want those stretched out either." And, shown the
 * mockups: "Yes do the square tiles as shown." (Justin, 9 November 2026.)
 *
 * WHERE. Wherever Play is big: opened up (lib/playShape `wide`, a row of at
 * least 550 points: an iPad either way up, a tablet, a fold opened) or in a
 * side of two (`inSide`, the Duo's half among them). Never on a phone held
 * upright, whose Play is exactly what it always was.
 *
 * WHAT. Every scene and every pedal is the same square, never stretched to
 * fill a row. The arrangement is the one whose squares are biggest FOR HOW
 * WELL THEY FILL THE ROW: the scenes and the chain side by side (the scenes
 * on the left, as Play lined up has them), or one over the other, with as
 * many to a row as suits. Ties go to the order tried: side by side first,
 * fewer to a row first.
 *
 * ACROSS THE ROW, NOT THE BIGGEST SQUARE ALONE. "I'm on my iPad. We need to
 * fix this view. That's not right." (Justin, 9 November 2026, an AM4 on an
 * iPad held upright.) The biggest squares alone put its four scenes in one
 * column and its four pedals in another: two thin towers in the middle of
 * the screen with nothing either side of them. So a square's size is
 * counted for as much of the row as its arrangement fills (`fill`, below):
 * four scenes across over four pedals across beats the towers, and room
 * left over goes under the tiles, where a page's room belongs.
 *
 * `room` is the height from the top of the scenes' heading to the bottom of
 * Play's page, `width` the page's row; HEAD is each heading with the gap
 * under it, BETWEEN the gap between the scenes and the chain one over the
 * other, BESIDE the gap between them side by side. A chain too long to fit
 * in squares of at least SQUARE_LEAST gets SQUARE_LEAST and the page
 * scrolls, as it does on a phone.
 *
 * Nothing here imports anything, so the tests run it as it is.
 */

/** The smallest a square may be before the page scrolls instead: a thumb's tile with room for a name. */
export const SQUARE_LEAST = 72
/** And the largest: past this a tile is a poster, and the room is better left under it. */
export const SQUARE_MOST = 220

/** Whether Play's tiles are squares: opened up or in a side, never a phone held upright. */
export const squaresOn = ({ wide = false, inSide = false } = {}) => wide === true || inSide === true

const whole = (n) => Math.max(0, Math.floor(Number(n)) || 0)
const pts = (n) => Math.max(0, Number(n) || 0)
/** How wide `cols` squares of `side` are with `gap` between them. */
export const gridWide = (cols, side, gap = 8) => (cols > 0 ? cols * side + (cols - 1) * gap : 0)
/** And how tall `rows` of them are. */
export const gridTall = gridWide

/**
 * The squares for `scenes` scenes and `pedals` pedals (the looper's
 * included) in `width` by `room` points: `{ beside, sceneCols, chainCols,
 * side }`, with `side` a whole number of points. Nothing to draw, nothing
 * measured yet: null, and Play draws as it did.
 */
export function squarePlan({ width = 0, room = 0, scenes = 0, pedals = 0, gap = 8, head = 26, between = 16, beside = 24 } = {}) {
  const s = whole(scenes)
  const p = whole(pedals)
  const w = pts(width)
  const h = pts(room)
  if ((!s && !p) || !w || !h) return null
  const parts = [s, p].filter((n) => n > 0)
  const heads = parts.length * head
  let best = null
  /*
   * How well a plan's squares fill the row, from 0 to 1, at the size they
   * would be drawn (never past SQUARE_MOST): how far across they reach (one
   * over the other, each grid's own reach, averaged, so four scenes are not
   * left two by two over four pedals in a row), times how full their rows
   * are (side by side, a column of four scenes beside two rows of pedals is
   * half empty).
   */
  const fill = (plan) => {
    const side = Math.min(SQUARE_MOST, plan.side)
    const sr = plan.sceneCols ? Math.ceil(s / plan.sceneCols) : 0
    const cr = plan.chainCols ? Math.ceil(p / plan.chainCols) : 0
    if (plan.beside) {
      const across = gridWide(plan.sceneCols, side, gap) + beside + gridWide(plan.chainCols, side, gap)
      return (across / w) * ((s + p) / (Math.max(sr, cr) * (plan.sceneCols + plan.chainCols)))
    }
    const grids = [plan.sceneCols, plan.chainCols].filter((cols) => cols > 0)
    const across = grids.reduce((sum, cols) => sum + gridWide(cols, side, gap), 0) / grids.length
    return (across / w) * ((s + p) / (sr * plan.sceneCols + cr * plan.chainCols))
  }
  const keep = (plan) => {
    if (!(plan.side >= SQUARE_LEAST)) {
      /* Too small to draw: kept only to say nothing fits, below. */
      if (plan.side > 0 && !best) best = { ...plan, score: 0 }
      return
    }
    /* The square's size, counted for as much of the row as its arrangement fills. */
    const score = Math.min(SQUARE_MOST, plan.side) * fill(plan)
    if (!best || best.score === 0 || score > best.score + 0.5) best = { ...plan, score }
  }
  /* Side by side: only with both to show. */
  if (s && p) {
    for (let sc = 1; sc <= s; sc++) {
      for (let cc = 1; cc <= p; cc++) {
        const rows = Math.max(Math.ceil(s / sc), Math.ceil(p / cc))
        const across = (w - beside - (sc + cc - 2) * gap) / (sc + cc)
        const down = (h - head - (rows - 1) * gap) / rows
        keep({ beside: true, sceneCols: sc, chainCols: cc, side: Math.min(across, down) })
      }
    }
  }
  /* One over the other. */
  for (let sc = s ? 1 : 0; sc <= s; sc++) {
    for (let cc = p ? 1 : 0; cc <= p; cc++) {
      const sr = sc ? Math.ceil(s / sc) : 0
      const cr = cc ? Math.ceil(p / cc) : 0
      const across = Math.min(sc ? (w - (sc - 1) * gap) / sc : Infinity, cc ? (w - (cc - 1) * gap) / cc : Infinity)
      const gaps = (sr ? sr - 1 : 0) + (cr ? cr - 1 : 0)
      const down = (h - heads - (parts.length - 1) * between - gaps * gap) / (sr + cr)
      keep({ beside: false, sceneCols: sc, chainCols: cc, side: Math.min(across, down) })
    }
  }
  if (best && best.side >= SQUARE_LEAST) {
    const { score, ...plan } = best
    return { ...plan, side: Math.floor(Math.min(SQUARE_MOST, plan.side)) }
  }
  /* Too long to fit: the least square, one over the other, as many to a row as the width takes, and the page scrolls. */
  const fits = (n) => Math.max(1, Math.min(n, Math.floor((w + gap) / (SQUARE_LEAST + gap))))
  return { beside: false, sceneCols: s ? fits(s) : 0, chainCols: p ? fits(p) : 0, side: SQUARE_LEAST }
}
