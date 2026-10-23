/*
 * THE OPENED-UP PLAY: the phone's Play on a screen wider than a phone.
 *
 * The phone's Play was drawn for a phone held upright, and on anything wider
 * it was that phone screen stretched: two very wide scenes, four very wide
 * pedals in three letters, and the six buttons floating up the screen under
 * a short preset. An iPad, an Android tablet, a Galaxy Fold opened, and the
 * iPhone Duo opened all have the room for more, and the iPhone Duo is opened
 * and closed while a song plays.
 *
 * So Play has a shape, worked out from ONE number: how wide its row of tiles
 * is, which the phone measures on Play itself (its own onLayout). Never the
 * window's size, never the kind of device, never which way up it is held: a
 * Duo, an iPad beside another app and a Fold each change Play's width while
 * the window's own size may not even say so, and a phone held upright is a
 * phone at any of them.
 *
 *   under 621  today's Play, exactly. Every phone, the Duo closed, half of
 *              the Duo open beside another app. A test holds it.
 *   621 and up the pedals' whole names (the three letters where a name does
 *              not fit), the six buttons in a strip fixed to the bottom, tiles
 *              up to 120 tall under Fit, the page no wider than 1180 and
 *              centered, sheets no wider than 480 and centered. 621 is the
 *              browser's own line between its phone layout and its computer
 *              one (max-width: 620px).
 *   700 and up at Smallest or Small, with the scenes Across or Like the unit:
 *              four scenes to a row, WIDE_PEDALS pedals to a row (two more
 *              from 936), and the six buttons in one row, Previous, Setlists
 *              and Next on the left half, Tuner, Edit and Tap on the right.
 *              Every row an even count, so with Play centered on the Duo's
 *              fold (foldInset, below) the fold runs through a gap and never
 *              through a tile.
 *
 * Down, in two columns, and My own order keep their two scene columns, which
 * is what they mean. Medium, Large and Largest keep their own counts and gain
 * only the names, the fixed buttons and the taller tiles.
 *
 * EACH LINE GOES OFF 40 UNDER WHERE IT CAME ON (`LETS_GO`), so an iPad's
 * divider dragged slowly across one, or a Duo set down half-open, does not
 * flip Play between two shapes a point apart.
 *
 * THE PHONE'S OWN FILE, NOT lib/gigSize's. The sizes, the scene layouts and
 * fitTiles are shared with the browser (src/lib/gigSize.js, copied beside
 * this file by npm run sync:rules), and the computer app serves the
 * browser's files, so every line added there made every merge put out a new
 * computer app (scripts/computer-fingerprint.mjs). Justin's rule is "a new
 * computer version only when its own part changed", and nothing here is the
 * computer's: the browser has had its own wide layout for a long time and is
 * not drawn by this. So the rule reads the shared steps and layouts from
 * ./gigSize, and lives where only the phone carries it.
 */
import { FX_MAX, SCENES_LIKE_UNIT, SCENE_LAYOUTS, SIZES, clampSize, sceneColsFor } from './gigSize'

/** The scene layouts' own ids, as lib/gigSize checks a stored one against them. */
const LAYOUT_IDS = SCENE_LAYOUTS.map((l) => l.id)

/** From this row width (points), Play opens up: whole names, the buttons fixed to the bottom. */
export const OPENS_AT = 621
/** From this row, at Smallest and Small with Across or Like the unit: four scenes, WIDE_PEDALS pedals, one row of buttons. */
export const SPREADS_AT = 700
/** From this row the spread layout takes two more pedals to a row. */
export const TWO_MORE_AT = 936
/** How far under its line each one switches back off. */
export const LETS_GO = 40

/*
 * HOW MANY PEDALS TO A ROW ON A WIDE ROW, in one number.
 *
 * Six, each still wider than a pedal on an iPhone today, and with every name
 * spelled out. His own rule for the phone is "only a max of four across"
 * (FX_MAX, in lib/gigSize), and it was made about narrow tiles on a phone,
 * where five and six made every name unreadable; at a 700-point row six
 * pedals are about 110 points each. If he would rather keep four everywhere,
 * this is the one number to change: at FX_MAX the spread layout keeps four,
 * even from 936, and the scenes then share their size with the pedals.
 */
export const WIDE_PEDALS = 6
/** Pedals to a row from TWO_MORE_AT: two more than WIDE_PEDALS, unless that is the phone's four. */
export const WIDEST_PEDALS = WIDE_PEDALS > FX_MAX ? WIDE_PEDALS + 2 : WIDE_PEDALS
/** Scenes to a row on the spread layout: the unit's own four. */
export const WIDE_SCENES = SCENES_LIKE_UNIT
/** How tall Fit may make a tile from OPENS_AT (fitTiles' own ceiling is 96). */
export const WIDE_TILE = 120
/** The widest Play's page gets, centered, as the browser's .shell. */
export const PAGE_MAX = 1180
/** The widest a sheet gets from OPENS_AT, centered: the Duo's closed screen is about 466. */
export const SHEET_MAX = 480

/**
 * The row of tiles in a Play `width` points wide: the page, no wider than
 * PAGE_MAX, less its padding on both sides. What the lines are measured on.
 */
export const pageRow = (width, pad = 16) => Math.max(0, Math.min(Math.max(0, Number(width) || 0), PAGE_MAX) - 2 * pad)

/** Whether `row` is past `line`, remembering whether it was (`was`): on at the line, off LETS_GO under it. */
const past = (row, line, was) => row >= (was ? line - LETS_GO : line)

/**
 * Which of the three lines a row is past, given the lines it was past last
 * time (`was`, from the last answer, or nothing on the first). Kept apart
 * from the shape, so a change of size or scene layout does not forget where
 * the row is.
 */
export function playLines(row, was) {
  const w = Number(row) > 0 ? Number(row) : 0
  return {
    opens: past(w, OPENS_AT, was?.opens),
    spreads: past(w, SPREADS_AT, was?.spreads),
    twoMore: past(w, TWO_MORE_AT, was?.twoMore)
  }
}

/**
 * Play's shape on a row `row` points wide, at size step `step` (an index into
 * SIZES) with scene layout `layout`, given the last shape (`was`, for the
 * lines' memory). Every field under 621 is today's: the size step's and the
 * layout's own counts, fitTiles' own caps, no names, the buttons in the page.
 *
 *   sceneCols  scenes to a row
 *   fxCols     pedals to a row to start from (Fit may widen it, up to fxMost)
 *   fxMost     the most pedals to a row Fit may go to (fitWide `most`)
 *   tileMax    the tallest Fit may make a tile (fitWide `max`)
 *   names      the pedals' whole names, where a name fits
 *   footFixed  the six buttons in a strip fixed to the bottom, out of the page
 *   footRow    the six buttons in one row, in two halves
 *   foldPad    the narrower side inset padded up to the wider one (foldInset)
 */
export function playShape(row, step, layout, was) {
  const lines = playLines(row, was?.lines)
  const at = clampSize(step)
  const size = SIZES[at]
  const wide = lines.opens
  const spread = wide && lines.spreads && at <= 1 && (layout === 'across' || layout === 'four' || !LAYOUT_IDS.includes(layout))
  const fx = spread ? (lines.twoMore ? WIDEST_PEDALS : WIDE_PEDALS) : size.fx
  return {
    lines,
    wide,
    spread,
    sceneCols: spread ? WIDE_SCENES : sceneColsFor(size, layout),
    fxCols: fx,
    fxMost: spread ? fx : FX_MAX,
    tileMax: wide ? WIDE_TILE : 96,
    names: wide,
    footFixed: wide,
    footRow: spread,
    foldPad: spread
  }
}

/**
 * The fold in the middle of the screen, and Play centered on it.
 *
 * The iPhone Duo opened like a book has its fold down the middle of the
 * screen and its clock and camera in a strip down one side, so Play, which
 * keeps clear of the strip, is off the middle by half the strip. The spread
 * layout's rows are all even counts, so with Play centered on the screen the
 * fold runs through the gap in the middle of every row. Centering it costs
 * the strip's width again on the other side, which is why only the spread
 * layout does it. `left` and `right` are the screen's own side insets; the
 * answer is what to add to Play's padding on each side.
 */
export function foldInset(left = 0, right = 0) {
  const l = Math.max(0, Number(left) || 0)
  const r = Math.max(0, Number(right) || 0)
  return { left: Math.max(0, r - l), right: Math.max(0, l - r) }
}

/*
 * FIT, WITH THE FOUR LIFTED: fitTiles' twin, for the spread layout.
 *
 * fitTiles (lib/gigSize, shared with the browser) never puts more than
 * FX_MAX pedals on a row: "only a max of four across", his rule for a phone.
 * The spread layout starts at six or eight (playShape `fxMost`), so it needs
 * the same arithmetic with the cap at `most` instead. This is that loop, line
 * for line, with FX_MAX read as `most` wherever fitTiles caps the row, and
 * nothing else changed. `most` only ever lifts the cap: left out, or asked
 * for less than four, it is four, and then this is fitTiles exactly. A test
 * runs both over a wide sweep of rigs, rooms and rows and holds every answer
 * to be the same, so a change to either one without the other fails there.
 */
export function fitWide({
  available,
  scenes = 0,
  blocks = 0,
  sceneCols = 2,
  fxCols = 4,
  gap = 8,
  min = 44,
  max = 96,
  width = 0,
  minWidth = 56,
  most = FX_MAX
} = {}) {
  const room = Math.max(0, Number(available) || 0)
  const sceneRows = Math.ceil(Math.max(0, scenes) / Math.max(1, sceneCols))
  const cap = Math.max(FX_MAX, Math.floor(Number(most)) || FX_MAX)
  const first = Math.max(1, Math.min(cap, fxCols))
  const across = Number(width) > 0 ? Math.floor((Number(width) + gap) / (minWidth + gap)) : cap
  const last = Math.max(first, Math.min(cap, across))
  const count = Math.max(0, blocks)
  let best = null
  for (let cols = first; cols <= last; cols++) {
    const rows = sceneRows + Math.ceil(count / cols)
    if (!rows) return { tile: max, fxCols: cols }
    /* The same number of rows as a narrower grid: nothing gained, so the
       narrower one stands. */
    if (best && rows >= best.rows) continue
    const tile = Math.floor((room - gap * (rows - 1)) / rows)
    best = { rows, tile, cols }
    if (tile >= min) break
  }
  return { tile: Math.max(min, Math.min(max, best.tile)), fxCols: best.cols }
}
