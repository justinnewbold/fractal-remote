/**
 * ROOM ON A TABLET: the walkthrough and the Unlock page grown to fill an iPad.
 *
 * "I'm on iPad these screens are not using the space very efficiently. Very
 * small. Let's use all available space we can to take advantage of iPad
 * screen." (Justin, 9 November 2026, on an iPad Pro held upright.) Both were
 * drawn for a phone: phone-sized words and buttons in the top half of a
 * 1366-point screen, and the Unlock sheet a 480-point strip in the middle.
 *
 * So on a window that is a tablet's, everything those two screens draw is
 * drawn bigger by one factor (`k`), in a column no wider than COLUMN_MOST,
 * centred, and the Unlock sheet comes up wider. Their words, their order and
 * what each button does are exactly what they were.
 *
 * A TABLET IS A WINDOW WHOSE SHORT SIDE IS 600 POINTS OR MORE: the line
 * Android draws between a phone and a tablet (plugins/withTabletTurns.js),
 * read off the window rather than the kind of device. So an Android tablet
 * is one too; an iPad beside another app in a narrow strip is not, and gets
 * the phone's layout, which is what fits a strip; and an iPad turned on its
 * side keeps its size, since its short side is the same.
 *
 * A PHONE IS EXACTLY AS IT WAS. Under the line the room is the theme's own
 * sizes, the very same objects, `grow` hands back the number it is given,
 * and there is no column, no wider sheet and no spacing: test/tablet-room.mjs
 * holds every phone shape to that.
 *
 * Pure, with nothing imported, so the test runs it as it is.
 */

/** The short side, in points, from which a window is a tablet's. */
export const TABLET_SIDE = 600

/** How much bigger: GROW_LEAST at the line, GROW_MOST from GROW_FULL_AT (a 12.9-inch iPad Pro's short side) up. */
export const GROW_LEAST = 1.2
export const GROW_MOST = 1.4
export const GROW_FULL_AT = 1024

/** The widest the walkthrough's column and the imposed Unlock page are drawn, centred. */
export const COLUMN_MOST = 840

/** The Unlock sheet on a tablet: this share of the window's width, no wider than SHEET_MOST. */
export const SHEET_SHARE = 0.8
export const SHEET_MOST = 820

const number = (n) => {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? v : 0
}

/** Whether a window this size is a tablet's. */
export const isTabletWindow = (width, height) => Math.min(number(width), number(height)) >= TABLET_SIDE

/**
 * How much bigger to draw, for a window this size: 1 on a phone, and on a
 * tablet from GROW_LEAST at 600 points of short side to GROW_MOST at 1024,
 * to the hundredth.
 */
export function growBy(width, height) {
  if (!isTabletWindow(width, height)) return 1
  const short = Math.min(number(width), number(height))
  const along = Math.min(1, (short - TABLET_SIDE) / (GROW_FULL_AT - TABLET_SIDE))
  return Math.round((GROW_LEAST + (GROW_MOST - GROW_LEAST) * along) * 100) / 100
}

/** A set of sizes ({ body: 15, … }), each grown by `k` and rounded: the same object when `k` is 1. */
export function grown(sizes, k) {
  if (k === 1) return sizes
  const out = {}
  for (const [key, value] of Object.entries(sizes)) out[key] = typeof value === 'number' ? Math.round(value * k) : value
  return out
}

const same = (n) => n
let kept = null

/**
 * The room a window gives these screens. `base` is the theme's { font,
 * space, TAP }. On a phone: those three as they are, `grow` that changes
 * nothing, and null for the column (`page`), the sheet's width (`sheet`) and
 * the column's margin (`inset`, 0). On a tablet: the three grown by `k`,
 * `grow(n)` for every other size, the column's style, and the sheet's width.
 *
 * The last answer is kept, so every piece of a screen asking about the same
 * window gets the same object.
 */
export function roomFor(width, height, base) {
  const w = number(width)
  const h = number(height)
  if (kept && kept.w === w && kept.h === h && kept.base === base) return kept.room
  const k = growBy(w, h)
  const room =
    k === 1
      ? { tablet: false, k: 1, font: base.font, space: base.space, TAP: base.TAP, grow: same, page: null, sheet: null, inset: 0 }
      : {
          tablet: true,
          k,
          font: grown(base.font, k),
          space: grown(base.space, k),
          TAP: Math.round(base.TAP * k),
          grow: (n) => Math.round(n * k),
          page: { flexGrow: 1, width: '100%', maxWidth: COLUMN_MOST, alignSelf: 'center' },
          sheet: Math.min(SHEET_MOST, Math.round(w * SHEET_SHARE)),
          inset: Math.max(0, Math.round((w - COLUMN_MOST) / 2))
        }
  kept = { w, h, base, room }
  return room
}

/**
 * A button's props in this room: on a phone the very same object, so the
 * button is drawn as it always was; on a tablet its words grown, and its
 * height the room's TAP when it gave none. A height it gave is kept: the
 * screens give the room's TAP already grown, and a 44 is a row of small
 * choices that stays one. `bodySize` is the theme's body size, Press's own
 * default for its words.
 */
export function grownPress(props, room, { bodySize }) {
  if (!room.tablet) return props
  return {
    ...props,
    height: props.height ?? room.TAP,
    labelSize: room.grow(props.labelSize ?? bodySize)
  }
}

/** A note's props in this room: the same object on a phone, its words grown on a tablet. */
export function grownNote(props, room) {
  if (!room.tablet) return props
  return { ...props, size: props.size ?? room.font.small }
}
