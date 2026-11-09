/*
 * TWO SIDES ON A BIG SCREEN: Play on one side, and Edit, your setlists or
 * all your presets on the other.
 *
 * "How do I put these side by side on the iPad?" (Justin, 9 November 2026,
 * on his iPad on its side.) The phone app has one screen at a time, and on
 * an iPad on its side, an Android tablet sideways or the iPhone Duo opened
 * like a book that is a lot of glass for one screen. So where there is room,
 * the window splits in two: Play keeps one side, and the other side holds
 * what you would otherwise have to leave Play to see.
 *
 * IT GOES BY THE SIZE OF THE FRAME, NEVER THE KIND OF DEVICE. The frame is
 * the room under the app's top bar, clear of the phone's own edges (App.js
 * measures it), and the rule is the same for every device:
 *
 *   wide    at least SIDES_AT across. An iPad on its side (1180 and up), an
 *           Android tablet sideways (1280 and more), a Galaxy Fold opened
 *           (about 841) and the iPhone Duo opened (951, less its 84-point
 *           strip, 867) are all past it; every phone held upright, the Duo
 *           closed (466) or opened and held tall (669), and an iPad held
 *           upright (744 to 1032) are under it.
 *   tall    at least SIDES_TALL down. A phone turned on its side is wide
 *           enough (up to 932) and this is what keeps it to one screen: its
 *           frame is about 350 tall.
 *   sideways at least as wide as it is tall. An iPad upright is wide but
 *           holds its sides one over the other.
 *   room    each side at least SIDE_LEAST after the split, so neither side
 *           is narrower than a small iPhone.
 *
 * EACH LINE GOES OFF LETS_GO UNDER WHERE IT CAME ON, as Play's own lines do
 * (lib/playShape), so an iPad's divider dragged slowly across one, or a Duo
 * set down half-open, does not flip between one screen and two a point apart.
 *
 * THE DIVIDER IS THE MIDDLE OF THE WINDOW, not the middle of the frame. On
 * the iPhone Duo the fold runs down the middle of the window and its clock
 * and camera take a strip down one side, which the app's frame keeps clear
 * of; so the frame's middle is off the fold by half the strip, and a divider
 * there would put a column of buttons across the crease. From the window's
 * middle the line sits on the fold, nothing you press is on it, each side is
 * about an iPhone wide, and the side away from the strip is a little wider
 * (475 and 392 with the 84-point strip). On an iPad there is nothing down
 * the sides and the two halves are even (590 and 590 on an 11-inch).
 *
 * Pure: no imports. test/two-sides.mjs runs it on every size above.
 */

/** From this frame width (points), the window may show two sides. */
export const SIDES_AT = 760
/** And from this frame height. A phone on its side is under it. */
export const SIDES_TALL = 500
/** How far under each line it switches back off. */
export const LETS_GO = 40
/** The least either side may be after the split. */
export const SIDE_LEAST = 360

/** What the other side may hold, in the order the list offers them. */
export const TOOLS = ['edit', 'setlists', 'presets']
/** Each one's name on its bar and in the list, and Play's. */
export const TOOL_NAMES = { edit: 'Edit', setlists: 'Setlists', presets: 'All presets', play: 'Play' }
/** The footnote under the list: Play is never on it. */
export const PLAY_ALWAYS = 'Play is always the other side.'
/** The two bars' buttons, by word. */
export const SIDE_WORDS = { swap: 'Swap', full: 'Full screen', two: 'Two sides' }

/** Whether `screen` (App.js's own word for what is open) is a tool a side can hold. */
export const isTool = (screen) => TOOLS.includes(screen)

const num = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0)

/**
 * Where the divider falls in a frame `width` across, with the phone's own
 * `left` and `right` down its sides: the window's middle, in the frame's own
 * coordinates, so it sits on the Duo's fold. Answers the two sides' widths,
 * `first` (the left side) and `second` (the right).
 */
export function splitSides({ width, left = 0, right = 0 } = {}) {
  const w = num(width)
  const at = Math.min(w, Math.max(0, (num(left) + w + num(right)) / 2 - num(left)))
  return { first: at, second: w - at }
}

/** Whether `size` is past `line`, remembering whether it was (`was`): on at the line, off LETS_GO under it. */
const past = (size, line, was) => size >= (was ? line - LETS_GO : line)

/**
 * Whether a frame `width` by `height`, with the phone's own `left` and
 * `right` down its sides, shows two sides; `was` is the last answer, for the
 * lines' memory. Every phone held upright, the Duo closed or held tall, and
 * an iPad held upright answer false.
 */
export function twoSidesOn({ width, height, left = 0, right = 0 } = {}, was = false) {
  const w = num(width)
  const h = num(height)
  if (!w || !h) return false
  const wide = past(w, SIDES_AT, was)
  const tall = past(h, SIDES_TALL, was)
  const sideways = past(w, h, was)
  const { first, second } = splitSides({ width: w, left, right })
  const room = past(Math.min(first, second), SIDE_LEAST, was)
  return wide && tall && sideways && room
}

/**
 * How wide each side is, given which side Play is on: `play` and `tool`,
 * from splitSides. Play starts on the right with the tool on the left, the
 * way he described it, and Swap flips them (App.js keeps the choice).
 */
export function sideWidths({ width, left = 0, right = 0, playOnRight = true } = {}) {
  const { first, second } = splitSides({ width, left, right })
  return playOnRight ? { play: second, tool: first } : { play: first, tool: second }
}

/**
 * What the list offers right now, in TOOLS' order: the same conditions Play
 * already uses for its own buttons. Edit only where its door opens
 * (lib/editDoor `opens`); All presets only where Play offers it (the demo,
 * or the unit answering); Setlists always, since it never needed the rig.
 */
export function sideTools({ editOpens = false, presetsOffered = false } = {}) {
  return TOOLS.filter((t) => (t === 'edit' ? editOpens === true : t === 'presets' ? presetsOffered === true : true))
}

/**
 * What Android's back button undoes first, with two sides up: a side filling
 * the screen ('full'), then the open side itself ('side', which goes back to
 * Play as its Done does), and nothing here when neither is up, so App.js
 * does what it does today.
 */
export function backUnwinds({ tool = null, sideFull = false } = {}) {
  if (!isTool(tool)) return null
  return sideFull ? 'full' : 'side'
}

/**
 * What the one screen shows when the window shrinks to one (the Duo folded,
 * an iPad's divider dragged, a tablet turned upright) with a tool open:
 * a tool that was filling the screen stays, exactly as it was; otherwise
 * Play, which is what you need mid-song, and the tool is kept (`keep`) so it
 * can come back when the window is wide again.
 */
export function whenNarrow({ tool = null, sideFull = false } = {}) {
  if (!isTool(tool)) return { screen: 'stage', keep: null }
  return sideFull ? { screen: tool, keep: tool } : { screen: 'stage', keep: tool }
}
