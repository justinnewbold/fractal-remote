/*
 * THREE ACROSS ON A VERY WIDE WINDOW: Play and two tools at once.
 *
 * "Three across on the big iPad Pro: Play, Edit and a list at once"
 * (offered 10 November 2026; Justin: "yes to all your other non build
 * suggestions as well"). On a 13-inch iPad Pro on its side each of two
 * sides is 683 points across, more than a tool needs; a third of that
 * window is still wider than any iPhone. So there, with a tool beside Play,
 * a second tool can open beside the first: Edit and your setlists, All
 * presets and a song's notes.
 *
 * THE THIRD SIDE IS AN ADDITION, NOT A NEW KIND OF WINDOW. Everything the
 * two sides already do (App.js `screen` and `sideTool`, the tuner and a
 * held block's knobs borrowing a side, the window narrowing, Android's
 * back, Two sides bringing a tool back) goes on as it did, about the FIRST
 * tool, and knows nothing of the third. The third is one more word App
 * keeps (`third`), drawn only while everything below holds.
 *
 * IT GOES BY THE SIZE OF THE FRAME, NEVER THE KIND OF DEVICE, as the two
 * sides do (lib/twoSides twoSidesOn, which has to say yes first):
 *
 *   wide     at least THREE_AT across, so each of three even sides is 430
 *            points or more, an iPhone Pro Max's own width. A 13-inch iPad
 *            Pro on its side is 1366; an 11-inch is 1194 to 1210 and stays
 *            two, with room to spare under the line even once it has let
 *            go (1250).
 *   tall     at least `tall` down (lib/twoSides SIDES_TALL, handed in).
 *   sideways at least as wide as it is tall.
 *   no fold  never where the phone keeps more down one side than the other
 *            (the iPhone Duo's strip): there the line between two sides is
 *            the crease, and a third side would put an edge off it.
 *
 * Each line goes off LETS_GO under where it came on, as the others do.
 *
 * Nothing here imports anything, so the tests run it as it is. The numbers
 * that are lib/twoSides' own are handed in.
 */

/** From this frame width (points), the window may show three sides: three times 430. */
export const THREE_AT = 1290
/** How far under each line it switches back off (lib/twoSides LETS_GO). */
export const THREE_LETS_GO = 40

const num = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0)
const past = (size, line, was) => size >= (was ? line - THREE_LETS_GO : line)

/**
 * Whether a frame `width` by `height`, with the phone's own `left` and
 * `right` down its sides, has room for three sides; `was` is the last
 * answer, for the lines' memory, and `tall` lib/twoSides SIDES_TALL. Every
 * phone, an 11-inch iPad either way up, the Duo and a Fold: false.
 */
export function threeSidesOn({ width, height, left = 0, right = 0 } = {}, was = false, tall = 500) {
  const w = num(width)
  const h = num(height)
  if (!w || !h) return false
  if (Math.abs(num(left) - num(right)) > 0.5) return false
  return past(w, THREE_AT, was) && past(h, tall, was) && past(w, h, was)
}

/** What the third side may hold: a tool with a screen of its own. Never the tuner or a block's knobs, which borrow the first side as they always have. */
export const THIRD_TOOLS = ['edit', 'setlists', 'presets', 'notes']
export const isThirdTool = (tool) => THIRD_TOOLS.includes(tool)

/** The words of the third side: its way in, its way out, and its list. */
export const THIRD_WORDS = {
  add: 'Add a side',
  close: 'Close this side',
  title: 'Third side',
  note: 'A second tool beside Play. A tool opens once, so what the first side holds is not on this list.'
}

/**
 * What the third side's list offers: what the first side's list offers now
 * (`tools`, lib/twoSides sideTools: the same conditions Play's own buttons
 * use), less the tool the first side has and less anything the third never
 * holds. A tool is never open twice.
 */
export const thirdTools = ({ tools = [], first = null } = {}) => (Array.isArray(tools) ? tools : []).filter((t) => isThirdTool(t) && t !== first)

/**
 * Whether the third side is drawn: a window with room for three (`three`),
 * a first tool beside Play and not filling the window (`beside`), and a
 * third tool that is not the first's. The first may be the tuner or a
 * block's knobs, borrowing its side: the third stays where it is meanwhile.
 */
export const thirdShown = ({ three = false, beside = false, first = null, third = null } = {}) => three === true && beside === true && Boolean(first) && isThirdTool(third) && third !== first

/**
 * Whether Add a side is offered: room for three, a first tool of its own
 * beside Play (not the tuner or a block's knobs, which are only borrowing
 * that side and have little room in the bar), no third yet, and something
 * for it to hold.
 */
export const thirdOffered = ({ three = false, beside = false, first = null, third = null, tools = [] } = {}) =>
  three === true && beside === true && isThirdTool(first) && !thirdShown({ three, beside, first, third }) && thirdTools({ tools, first }).length > 0

/**
 * THE THIRD SIDE, AS THE FIRST ONE CHANGES UNDER IT. Asked while App draws,
 * with what it saw last time (`seen`: `first`, the first tool at the last
 * draw; `prev`, the one before the last change; `held`, whether the third
 * is being kept through a narrow window). Answers the third to keep, a
 * screen to open (`screen`, or null), and what to remember.
 *
 *   the first now holds the third's tool   they change places: the third
 *       (picked from its list, or by one    takes what the first had, when
 *       of Play's own buttons)              that is a tool it can hold, and
 *                                           closes otherwise.
 *   the first side closed, back to Play,   the third takes its place: Play
 *       with the third on screen            and one tool, the one left.
 *       (`shown`, from the last draw)       (Not on screen, on a window with
 *                                           room for two only: forgotten.)
 *   the window narrowed to one screen,     kept (`held`), to come back
 *       with the third on screen            when the window is wide and the
 *                                           first tool is beside Play again
 *                                           (App brings that one back).
 *   Play left for another screen on a      forgotten: nothing comes back by
 *       wide window (Settings)              itself after Settings, as the
 *                                           first tool does not either.
 *
 * A window too narrow for three but wide enough for two changes nothing
 * here: the third is simply not drawn (thirdShown), and comes back with the
 * room.
 */
export function thirdStep({ third = null, first = null, screen = null, wide = false, shown = false, seen = null } = {}) {
  const lastFirst = seen?.first ?? null
  let prev = seen?.prev ?? null
  let held = seen?.held === true
  if (first !== lastFirst) prev = lastFirst
  const keep = (next, open = null) => ({ third: next, screen: open, seen: { first, prev, held: next ? held : false } })
  if (!isThirdTool(third)) return keep(null)
  if (first === third) return keep(isThirdTool(prev) && prev !== first ? prev : null)
  /* The window narrowed to one screen with the third on screen: kept from here. */
  if (wide !== true && shown === true) held = true
  if (first === null) {
    if (held) return wide !== true || screen === 'stage' ? keep(third) : keep(null)
    if (wide === true && shown === true && lastFirst !== null && screen === 'stage') return keep(null, third)
    return keep(null)
  }
  if (wide === true) held = false
  return keep(third)
}

/**
 * How wide each of three sides is in a frame `width` across: three even
 * columns, the odd points to Play. `tool` is the first side, `third` the
 * one added.
 */
export function threeWidths({ width = 0 } = {}) {
  const w = num(width)
  const side = Math.floor(w / 3)
  return { tool: side, third: side, play: w - 2 * side }
}

/**
 * The three sides, left to right: Play keeps the end it has with two (the
 * right, until swapped), the first tool keeps the far end, and the third
 * opens between them.
 */
export const threeOrder = (playOnRight = true) => (playOnRight ? ['tool', 'third', 'play'] : ['play', 'third', 'tool'])

/**
 * WHAT THE TOP BAR DRAWS WITH THREE SIDES UP, in the room it has (`room`,
 * measured; not measured yet, everything). Each side's name is always
 * there, and so is Swap. What gives way, in this order: the first side's
 * Full screen (`full`, the words it would say, or null where it has none,
 * as a block's knobs never do), then Play's own name, whose list is the
 * first side's list anyway. `letter` is a letter of a button's words in
 * points, `pad` what is round them and `gap` what is between two, as
 * lib/twoSides chipsFit counts them.
 */
export function threeLead({ room = null, first = '', third = '', play = '', full = null, swap = '', letter = 8, pad = 24, gap = 8 } = {}) {
  const needs = (labels) => {
    const words = labels.filter((l) => typeof l === 'string' && l.length > 0)
    return words.reduce((sum, l) => sum + l.length * letter + pad, 0) + Math.max(0, words.length - 1) * gap
  }
  const has = room === null || room === undefined ? Infinity : num(room)
  if (needs([first, full, third, play, swap]) <= has) return { full: Boolean(full), play: true }
  if (needs([first, third, play, swap]) <= has) return { full: false, play: true }
  return { full: false, play: false }
}
