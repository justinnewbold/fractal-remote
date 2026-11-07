/*
 * PLAY LINED UP: the layout Justin chose for a big screen ("A1", 6 November
 * 2026), on an iPad, an Android tablet, a Galaxy Fold opened and the iPhone
 * Duo opened.
 *
 *   the top bar, as everywhere
 *   the preset across the whole width (the only thing that stretches), with
 *     Setlists at its right-hand end
 *   SCENES over the left half, CHAIN · HOLD TO SWITCH CHANNELS over the right
 *   the scenes two across on the left, the chain on the right, in the SAME
 *     number of rows, so every row of scenes lines up with a row of pedals
 *     and the iPhone Duo's fold runs down the gap between the halves
 *   one row of buttons: Previous at the far left, Tuner, Edit and Tap in the
 *     middle, Next at the far right
 *
 * WHEN. Only where Play has room both ways and is at least as wide as it is
 * tall, measured on Play itself and never the kind of device or which way up
 * it is held:
 *
 *   wide  Play has already opened up (lib/playShape `wide`: a row of tiles at
 *         least OPENS_AT, 550 points, Play about 582 wide). The same line, so the
 *         buttons are already in their strip at the bottom on both sides of
 *         this one and nothing else moves when it switches.
 *   tall  Play's own height (the room between the top bar and that strip) at
 *         least LINED_TALL points, and it goes off LINED_LETS_GO under that,
 *         so a Fold set down half-open does not flip Play between two shapes.
 *   across Play's own width at least that height, so Play is a landscape
 *         page. "The iPad portrait view was already fine back before a few
 *         updates ago. It should basically look just like the phone does
 *         portrait view, just bigger" (Justin, 7 November 2026): A1 was
 *         chosen for a tablet on its side and the Duo opened, never for a
 *         tablet held upright. Off LINED_LETS_GO under, like the height.
 *
 * Every phone held upright is narrower than the wide line, so it is today's
 * Play exactly; a phone on its side (the few Android phones that turn) is far
 * too short. A tablet on its side, the iPhone Duo opened and a Fold opened
 * (nearly square, so their Play is wider than it is tall) are all three. A
 * tablet held upright is taller than wide, so it is the phone's own Play,
 * bigger, as it was before A1. An iPad sharing the screen with another app
 * takes this when its part is still wide enough, and today's Play when not.
 *
 * Nothing here imports anything, so the tests run it as it is.
 */

/** From this tall (Play's own height, points), with Play opened up, it lines up. */
export const LINED_TALL = 360
/** How far under LINED_TALL it switches back off. */
export const LINED_LETS_GO = 40
/** Scenes to a row: two, as the phone's own default. */
export const LINED_SCENES = 2
/** Pedals to a row: two, and four once a chain has more than LINED_FOUR_FROM - 1 (an Axe-Fx III's or an FM9's big chains). */
export const LINED_PEDALS = 2
export const LINED_PEDALS_MANY = 4
export const LINED_FOUR_FROM = 9
/** The most rows the halves are sized for: past this, the chain's half scrolls rather than every tile shrinking (unless the scenes need more). */
export const LINED_ROWS_MOST = 4
/** No tile shorter than the platforms' own 44. */
export const LINED_TILE_MIN = 44
/** Nor taller than this: an AM4's four scenes on an iPad turned upright would be 500 points each. */
export const LINED_TILE_MAX = 320
/** The pedals' names: today's 15 at the least, and no bigger than this. */
export const LINED_NAME_MIN = 15
export const LINED_NAME_MAX = 22

/**
 * Whether Play lines up. `wide` is lib/playShape's own answer for Play's
 * width, `tall` Play's own height and `across` its own width in points,
 * `was` this function's last answer (for the lines' memory). No width, no
 * lining up: a Play that has not measured itself is drawn as a phone's.
 */
export function linedOn({ wide, tall, across } = {}, was = false) {
  if (!wide) return false
  const h = Number(tall) > 0 ? Number(tall) : 0
  const w = Number(across) > 0 ? Number(across) : 0
  const give = was ? LINED_LETS_GO : 0
  return h >= LINED_TALL - give && w >= h - give
}

/**
 * The two halves' grids for `scenes` scenes and `pedals` pedals (the looper's
 * included). The rows are the same on both sides: the more of the two, up to
 * LINED_ROWS_MOST, or the scenes' own if they need more. A chain with more
 * rows than that keeps its tiles the size of the scenes' and scrolls
 * (`scrolls`), rather than shrinking every tile to fit.
 */
export function linedPlan({ scenes = 0, pedals = 0 } = {}) {
  const s = Math.max(0, Math.floor(Number(scenes)) || 0)
  const p = Math.max(0, Math.floor(Number(pedals)) || 0)
  const sceneCols = LINED_SCENES
  const chainCols = p >= LINED_FOUR_FROM ? LINED_PEDALS_MANY : LINED_PEDALS
  const sceneRows = Math.ceil(s / sceneCols)
  const chainRows = Math.ceil(p / chainCols)
  const most = Math.max(sceneRows, LINED_ROWS_MOST)
  const rows = Math.max(1, sceneRows, Math.min(chainRows, most))
  return { sceneCols, chainCols, sceneRows, chainRows, rows, scrolls: chainRows > rows }
}

/**
 * How tall every tile is, scenes and pedals alike, so the rows line up:
 * `room` points shared by `rows` rows with `gap` between them, between
 * LINED_TILE_MIN and LINED_TILE_MAX, rounded down so the rows never come out
 * taller than the room.
 */
export function linedTile({ room = 0, rows = 1, gap = 8 } = {}) {
  const n = Math.max(1, Math.floor(Number(rows)) || 1)
  const r = Math.max(0, Number(room) || 0)
  const tile = Math.floor((r - gap * (n - 1)) / n)
  return Math.max(LINED_TILE_MIN, Math.min(LINED_TILE_MAX, tile))
}

/**
 * The height of a scroll that shows `rows` rows of `tile` with `gap` between:
 * the chain's half when it has more rows than the scenes'.
 */
export const linedRowsTall = (rows, tile, gap = 8) => Math.max(0, rows) * tile + Math.max(0, rows - 1) * gap

/**
 * A pedal's name size on a tile `height` tall and `width` wide: bigger on a
 * big tile, never smaller than today's, and never so big a four-letter word
 * does not fit across a narrow one.
 */
export function linedName({ height = 0, width = 0 } = {}) {
  const byHeight = Math.floor((Number(height) || 0) * 0.12)
  const byWidth = Math.floor((Number(width) || 0) * 0.13)
  return Math.max(LINED_NAME_MIN, Math.min(LINED_NAME_MAX, byHeight, byWidth))
}
