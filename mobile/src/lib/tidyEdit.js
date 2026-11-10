/*
 * THE TIDIER EDIT: how the open block's rows are arranged, by how wide the
 * block's own panel is.
 *
 * "What do you think we can do to make this more intuitive it just feels a
 * little clunky still and what can we do to improve the edit screen to make
 * it more like the real ax edit software" (Justin, 9 November 2026, Edit
 * beside Play on his iPad), and the next day: "We want as many knobs visible
 * in edit." Edit drew three knobs across at any width, under three rows of
 * its own: the block's name, the channels at a thumb's 56, and the pages. On
 * half an iPad that was four rows over the knobs and room for two more
 * knobs beside every three.
 *
 * So, for an account the tidier Edit is open to (his until features
 * TIDY_EDIT_FOR_EVERYONE; lib/useTidyEdit), two things go by the measured
 * width of the panel, never by the kind of device:
 *
 *   the knobs  as many across as fit at KNOB_CELL_LEAST each, from
 *              KNOBS_LEAST to KNOBS_MOST: three on a phone held upright,
 *              four on a big one or on the wider side of an opened Duo,
 *              five in half of an 11-inch iPad on its side, eight across
 *              the whole of it.
 *   the row    the block's name, its channels (A to D) and its on/off in
 *              ONE row at every width; from HEAD_MODEL_AT the model picker
 *              is in that row too. Under it the model stays where his 9
 *              November message put it, under the knobs ("let's move the
 *              copy channel, engaged and the pedal model name down below
 *              the actual knobs"): on a phone a fourth thing in the row
 *              would cut the block's name, and a second row would cost the
 *              knobs the height he asked for.
 *
 * This follows how an editor is worked (the block's own things in one line
 * over its knobs), never how one looks: no artwork, no colours, no layout
 * copied from anybody's.
 *
 * Nothing here imports anything, so the tests run it as it is.
 */

/** The least a knob's cell may be across: the knob, its number box under it, and a name that can be read. */
export const KNOB_CELL_LEAST = 96
/** Never fewer knobs to a row than Edit always had. */
export const KNOBS_LEAST = 3
/** Nor more than this, however wide: past it the eye loses the row. */
export const KNOBS_MOST = 8
/** From this panel width the model picker joins the block's row. */
export const HEAD_MODEL_AT = 520
/** How tall the block's row and the pages' row are: under a thumb's 44 on purpose, as the top bar's buttons are, each reaching 44 by its own slop. */
export const HEAD_TALL = 36

const pts = (n) => Math.max(0, Number(n) || 0)

/**
 * How many knobs go across a panel `width` points wide, with `gap` between
 * them. Nothing measured yet: KNOBS_LEAST, which is what Edit drew.
 */
export function knobsAcross(width, gap = 12) {
  const w = pts(width)
  if (!w) return KNOBS_LEAST
  const fit = Math.floor((w + gap) / (KNOB_CELL_LEAST + gap))
  return Math.max(KNOBS_LEAST, Math.min(KNOBS_MOST, fit))
}

/** How wide each knob's cell is then, in whole points; 0 when nothing is measured, and the cell keeps its old share of the row. */
export function knobCell(width, gap = 12) {
  const w = pts(width)
  if (!w) return 0
  const cols = knobsAcross(w, gap)
  return Math.max(0, Math.floor((w - (cols - 1) * gap) / cols))
}

/** The knob drawn in a cell that wide: Edit's own 64 on a phone, a little bigger where the cell has the room, never so big its name is squeezed. */
export function knobSize(cell) {
  const c = pts(cell)
  if (!c) return 64
  return Math.max(56, Math.min(84, Math.floor(c * 0.6)))
}

/**
 * What the block's one row holds in a panel `width` wide: its name, its
 * channels and its on/off always; `model` says the model picker is in it
 * too (and so not under the knobs).
 */
export function headShape(width) {
  return { model: pts(width) >= HEAD_MODEL_AT }
}
