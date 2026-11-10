/*
 * PLAY'S TILES FILL THE SCREEN ON A BIG SCREEN, AS CLOSE TO SQUARE AS
 * FILLING ALLOWS.
 *
 * (The file keeps the name it was given when every tile was a square.)
 *
 * It began as squares: "it would be better if they looked like square boxes
 * as much as possible ... Also show me what the portrait view looks like on
 * the iPad, as I don't want those stretched out either." (Justin, 9 November
 * 2026.) Squares never stretched, so they left whatever room they did not
 * need: an AM4's four scenes and four pedals on an iPad held upright were
 * big squares with empty screen round them. The same day, on that iPad:
 *
 *   "I'm on my iPad. We need to fix this view. That's not right."
 *
 *   "What I meant was it's not right is that it should be taking full
 *   advantage of the iPad screen and all scenarios."
 *
 * SO THE RULE IS: the tiles fill all the room they have, across and down,
 * and are as close to square as filling allows. Filling wins over
 * squareness; squareness picks the arrangement.
 *
 * WHERE. Wherever Play is big: opened up (lib/playShape `wide`, a row of at
 * least 550 points: an iPad either way up, a tablet, a fold opened) or in a
 * side of two (`inSide`, the Duo's half among them). Never on a phone held
 * upright, whose Play is exactly what it always was.
 *
 * WHAT. Two arrangements, each with any number of scenes and of pedals to a
 * row:
 *
 *   side by side   the scenes on the left, the chain on the right. Every
 *                  tile is the same width, the row shared out evenly; each
 *                  half's tiles are as tall as the room allows for its own
 *                  number of rows.
 *   one over the   the scenes over the chain. Every row is the same height,
 *   other          the room shared out evenly; each grid's tiles are as wide
 *                  as the row allows for its own number across.
 *
 * So the grids end at the right-hand edge and at the bottom of Play's page,
 * with the same gaps as ever. All the scenes are one size and all the pedals
 * are one size; the two kinds may differ.
 *
 * WHICH. The arrangement whose tiles are closest to square: the smallest
 * worst |log(width / height)| over the two kinds. Counted against a plan on
 * top of that: tiles of very different sizes (one kind's more than twice
 * the other's area, so four scenes are not giants beside twelve small
 * pedals), and places left empty in a last row (eight scenes three across
 * leave one; a lone tile on a row of its own leaves most of it). Ties go to
 * the bigger tiles, then the bigger scenes, then the order tried: side by
 * side first, fewer to a row first.
 *
 * LIMITS. No side of a tile is under SQUARE_LEAST: when nothing fits, the
 * tiles are that tall, one grid over the other, and the page scrolls
 * (`scrolls`), as it does on a phone. And no tile is more than ASPECT_MOST
 * times as long as it is tall or wide: past that the long side is held and
 * the room left (`capped`), rather than one scene drawn as a banner. That
 * only bites with very few tiles (one scene and one pedal), and a plan that
 * needs it loses to any that does not.
 *
 * `room` is the height from the top of the scenes' heading to the bottom of
 * Play's page, `width` the page's row; `head` is each heading with the gap
 * under it, `between` the gap between the scenes and the chain one over the
 * other, `beside` the gap between them side by side. The chain's half can
 * hold more than its heading: `chainHead` is everything over its pedals (its
 * heading, and a note or a tip when one is up; `head` when not said) and
 * `chainFoot` whatever is drawn under them (a VP4's sentence), both taken
 * out of the room its tiles share.
 *
 * Nothing here imports anything, so the tests run it as it is.
 */

/** The least either side of a tile may be before the page scrolls instead: a thumb's tile with room for a name. */
export const SQUARE_LEAST = 72
/** The most a tile may be longer than it is tall or wide: past this it is a banner, and the room is better left. */
export const ASPECT_MOST = 2

/* What counts against a plan, on the scale of |log(width / height)| (a tile twice as long as tall is 0.69). */
/* One kind's tile past this many times the other's area... */
const UNEVEN_FROM = 2
/* ...costs this for each further doubling's worth (a natural log). */
const UNEVEN_COSTS = 0.5
/* Every place in the grids left empty, as a share of all of them. */
const EMPTY_COSTS = 1.5
/* A tile held at ASPECT_MOST: more than any plan that fills can cost for its shape alone. */
const CAPPED_COSTS = 1

/** Whether Play's tiles fill the screen: opened up or in a side, never a phone held upright. */
export const bigTilesOn = ({ wide = false, inSide = false } = {}) => wide === true || inSide === true

const whole = (n) => Math.max(0, Math.floor(Number(n)) || 0)
const pts = (n) => Math.max(0, Number(n) || 0)
/** How wide `cols` tiles `wide` across are with `gap` between them. */
export const gridWide = (cols, wide, gap = 8) => (cols > 0 ? cols * wide + (cols - 1) * gap : 0)
/** And how tall `rows` of them `high` are. */
export const gridTall = gridWide

const NONE = { wide: 0, high: 0 }

/** A tile in whole points, neither side past ASPECT_MOST times the other; `open` is the share of its long side given up to that. */
function tile(wide, high) {
  let w = Math.floor(wide)
  let h = Math.floor(high)
  let open = 0
  if (w > ASPECT_MOST * h) {
    open = 1 - (ASPECT_MOST * h) / w
    w = ASPECT_MOST * h
  } else if (h > ASPECT_MOST * w) {
    open = 1 - (ASPECT_MOST * w) / h
    h = ASPECT_MOST * w
  }
  return { wide: w, high: h, open }
}

/**
 * The tiles for `scenes` scenes and `pedals` pedals (the looper's included)
 * in `width` by `room` points:
 *
 *   { beside, sceneCols, chainCols, scene: { wide, high }, pedal: { wide, high }, capped, scrolls }
 *
 * in whole points. A kind with nothing to draw is 0 across and 0 by 0.
 * `capped` says a tile was held at ASPECT_MOST and room is left; `scrolls`
 * that nothing fits and the page scrolls. Nothing to draw, nothing measured
 * yet: null, and Play draws as it did.
 */
export function tilePlan({ width = 0, room = 0, scenes = 0, pedals = 0, gap = 8, head = 26, between = 16, beside = 24, chainHead = head, chainFoot = 0 } = {}) {
  const s = whole(scenes)
  const p = whole(pedals)
  const w = pts(width)
  const h = pts(room)
  if ((!s && !p) || !w || !h) return null
  /* Over and under the pedals, in the chain's half. */
  const round = pts(chainHead) + pts(chainFoot)
  let best = null
  const keep = (plan) => {
    const kinds = [s ? plan.scene : null, p ? plan.pedal : null].filter(Boolean)
    if (kinds.some((k) => k.wide < SQUARE_LEAST || k.high < SQUARE_LEAST)) return
    /* How far from square the worse of the two kinds is. */
    const shape = Math.max(...kinds.map((k) => Math.abs(Math.log(k.wide / k.high))))
    const areas = kinds.map((k) => k.wide * k.high)
    const uneven = Math.max(0, Math.log(Math.max(...areas) / Math.min(...areas) / UNEVEN_FROM))
    const places = (plan.sceneCols ? Math.ceil(s / plan.sceneCols) * plan.sceneCols : 0) + (plan.chainCols ? Math.ceil(p / plan.chainCols) * plan.chainCols : 0)
    const empty = (places - s - p) / places
    const open = Math.max(...kinds.map((k) => k.open))
    const cost = shape + UNEVEN_COSTS * uneven + EMPTY_COSTS * empty + (open > 0 ? CAPPED_COSTS + open : 0)
    const least = Math.min(...areas)
    const scene = s ? plan.scene.wide * plan.scene.high : 0
    const better =
      !best ||
      cost < best.cost - 1e-9 ||
      (Math.abs(cost - best.cost) <= 1e-9 && (least > best.least || (least === best.least && scene > best.sceneArea)))
    if (better) best = { plan, cost, least, sceneArea: scene, capped: open > 0 }
  }
  /* Side by side: only with both to show. Every tile one width; each half as tall as the room for its own rows. */
  if (s && p) {
    for (let sc = 1; sc <= s; sc++) {
      for (let cc = 1; cc <= p; cc++) {
        const sr = Math.ceil(s / sc)
        const cr = Math.ceil(p / cc)
        const across = (w - beside - (sc + cc - 2) * gap) / (sc + cc)
        keep({
          beside: true,
          sceneCols: sc,
          chainCols: cc,
          scene: tile(across, (h - head - (sr - 1) * gap) / sr),
          pedal: tile(across, (h - round - (cr - 1) * gap) / cr)
        })
      }
    }
  }
  /* One over the other. Every row one height; each grid as wide as the row for its own number across. */
  const heads = (s ? head : 0) + (p ? round : 0) + (s && p ? between : 0)
  for (let sc = s ? 1 : 0; sc <= s; sc++) {
    for (let cc = p ? 1 : 0; cc <= p; cc++) {
      const sr = sc ? Math.ceil(s / sc) : 0
      const cr = cc ? Math.ceil(p / cc) : 0
      const gaps = (sr ? sr - 1 : 0) + (cr ? cr - 1 : 0)
      const down = (h - heads - gaps * gap) / (sr + cr)
      keep({
        beside: false,
        sceneCols: sc,
        chainCols: cc,
        scene: sc ? tile((w - (sc - 1) * gap) / sc, down) : NONE,
        pedal: cc ? tile((w - (cc - 1) * gap) / cc, down) : NONE
      })
    }
  }
  const size = (t) => ({ wide: t.wide, high: t.high })
  if (best) {
    const { plan } = best
    return { beside: plan.beside, sceneCols: plan.sceneCols, chainCols: plan.chainCols, scene: size(plan.scene), pedal: size(plan.pedal), capped: best.capped, scrolls: false }
  }
  /* Too many to fit: one over the other, the least height, as many to a row as the width takes, each as wide as that leaves, and the page scrolls. */
  const fits = (n) => Math.max(1, Math.min(n, Math.floor((w + gap) / (SQUARE_LEAST + gap))))
  const least = (n) => {
    const cols = fits(n)
    const across = Math.floor((w - (cols - 1) * gap) / cols)
    const most = ASPECT_MOST * SQUARE_LEAST
    return { cols, held: across > most, size: { wide: Math.max(SQUARE_LEAST, Math.min(most, across)), high: SQUARE_LEAST } }
  }
  const scene = s ? least(s) : { cols: 0, held: false, size: NONE }
  const pedal = p ? least(p) : { cols: 0, held: false, size: NONE }
  return { beside: false, sceneCols: scene.cols, chainCols: pedal.cols, scene: size(scene.size), pedal: size(pedal.size), capped: scene.held || pedal.held, scrolls: true }
}
