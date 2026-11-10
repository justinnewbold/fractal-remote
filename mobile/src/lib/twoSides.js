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
export const TOOLS = ['edit', 'setlists', 'presets', 'tuner']
/** Each one's name in the app's top bar and in the list, and Play's. */
export const TOOL_NAMES = { edit: 'Edit', setlists: 'Setlists', presets: 'All presets', tuner: 'Tuner', play: 'Play' }
/** The footnote under the list: Play is never on it. */
export const PLAY_ALWAYS = 'Play is always the other side.'
/** The two sides' buttons in the top bar, by word. */
export const SIDE_WORDS = { swap: 'Swap', full: 'Full screen', two: 'Two sides' }

/** Whether `screen` (App.js's own word for what is open) is a tool a side can hold. */
export const isTool = (screen) => TOOLS.includes(screen)
/**
 * A block's knobs in the side (step 4, below): App.js's word for that
 * screen. Never on the list, since it is opened by holding a block, and
 * never kept for Two sides.
 */
export const BLOCK = 'block'
/** Its name in the top bar. */
export const BLOCK_NAME = 'Knobs'

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

/*
 * A PHONE HELD ON ITS SIDE SPLITS IN TWO AS WELL (10 November 2026).
 *
 * "This is the landscape view on iPhone ... let's split the screen in half
 * kind of like the iPhone duo even though things will be smaller. It'll
 * still look better instead of just stretching everything." (Justin, on an
 * iPhone 17 Pro Max on its side, where Play was the upright Play pulled
 * 830 points wide.) So a phone on its side is its own answer beside
 * twoSidesOn, on the same measured frame, and what it answers is asked for
 * separately by App.js (his account until features PHONE_SIDEWAYS_FOR_
 * EVERYONE): Play laid out in two halves with square tiles (lib/
 * sidewaysPlay), a tool beside Play in the other half, and the two bars'
 * buttons up in the app's top bar, since a window this low has no room for
 * a second row of them.
 *
 *   wide     at least SIDEWAYS_AT across, so each half is at least
 *            SIDE_LEAST: an iPhone 17 on its side is about 734 (852 less 59
 *            down each side), a Pro Max 832; an iPhone SE (667) and a 13
 *            mini (712) are under it and stay one screen.
 *   low      UNDER SIDES_TALL. That is what makes it a phone on its side
 *            and nothing else: a tablet, a Fold and the Duo opened are at
 *            or over that line and keep twoSidesOn's answer, untouched.
 *   tall     at least SIDEWAYS_LOW down, under which two halves of tiles
 *            are not worth drawing (a phone in a small split window).
 *   sideways wider than tall, and
 *   room     each side at least SIDE_LEAST, both as twoSidesOn has them.
 *
 * Each line goes off LETS_GO past where it came on, as the others do. The
 * two answers are never both acted on: App.js asks this one only where
 * twoSidesOn said no.
 */

/** From this frame width (points), a phone on its side splits in two: twice the least a side may be. */
export const SIDEWAYS_AT = 720
/** And only from this frame height. */
export const SIDEWAYS_LOW = 250

/**
 * Whether a frame `width` by `height` (the room under the app's top bar,
 * with the phone's own `left` and `right` down its sides) is a phone held
 * on its side; `was` is the last answer, for the lines' memory. Every phone
 * held upright, every tablet, the Duo opened or closed upright: false.
 */
export function phoneSidewaysOn({ width, height, left = 0, right = 0 } = {}, was = false) {
  const w = num(width)
  const h = num(height)
  if (!w || !h) return false
  const wide = past(w, SIDEWAYS_AT, was)
  const low = h < (was ? SIDES_TALL + LETS_GO : SIDES_TALL)
  const tall = past(h, SIDEWAYS_LOW, was)
  const sideways = past(w, h, was)
  const { first, second } = splitSides({ width: w, left, right })
  const room = past(Math.min(first, second), SIDE_LEAST, was)
  return wide && low && tall && sideways && room
}

/** On a phone on its side the tool's bar button says this, not SIDE_WORDS.full: the top bar has no room for two words. */
export const SIDEWAYS_FULL = 'Full'

/*
 * THE TWO SIDES' BUTTONS ARE IN THE APP'S TOP BAR ON A BIG SCREEN TOO
 * (10 November 2026). "The play and two sides buttons take up a whole row
 * on iPad. What other options for those?" (Justin, on his iPad; offered the
 * top bar, "Yes do that now".) Each side had a bar of its own under the
 * app's: 52 points of every big screen for a name and two buttons, beside a
 * top bar that was mostly empty. So the names, Swap and Full screen or Two
 * sides sit in the top bar there, as they do on a phone held on its side
 * (components/SidesLead), and Play and the tool beside it get the row back.
 * What follows is what the bar needs to know that a row of its own did not.
 */

/** How wide Swap is in the top bar; the line between the sides runs through its middle. */
export const SWAP_WIDE = 64
/** From this width of the tool's own side, its button says SIDE_WORDS.full; under it (the Duo's sides, the tuner's narrow column, every phone on its side), SIDEWAYS_FULL. */
export const FULL_WORDS_AT = 480
/** What the tool's fill-the-window button says in the top bar, by how wide the tool's side is. */
export const fullSays = (toolWide) => (num(toolWide) >= FULL_WORDS_AT ? SIDE_WORDS.full : SIDEWAYS_FULL)

/**
 * How far along the top bar the two sides' buttons reach, from the frame's
 * left edge: with a tool beside Play, to the far edge of Swap, which sits on
 * the line between the sides (sideWidths, so the tuner's narrow column and
 * the Duo's fold are where the sides themselves have them); with a tool
 * filling the window or Play alone, LEAD_ALONE, room for a name and Two
 * sides. The top bar takes it out of what it offers the account's photo.
 */
export const LEAD_ALONE = 260
export function leadReach({ width, left = 0, right = 0, playOnRight = true, tool = null, full = false } = {}) {
  if (!tool || full === true) return LEAD_ALONE
  const sides = sideWidths({ width, left, right, playOnRight, tool })
  return (playOnRight ? sides.tool : sides.play) + SWAP_WIDE / 2
}

/**
 * Whether buttons saying `labels` fit `room` points of the top bar, side by
 * side: each its words at `letter` points a letter with `pad` round them,
 * `gap` between. Erring wide, so a button is moved to the other side of
 * Swap before it is cut. The side of the bar past Swap also holds the
 * account's photo, the unit's pill, the speaker and Settings, so on an iPad
 * with the tuner's narrow column on that side there is no room left for
 * the tuner's own name: then its buttons sit just before Swap instead.
 */
export function chipsFit({ room = 0, labels = [], letter = 8, pad = 24, gap = 8 } = {}) {
  const words = labels.filter((l) => typeof l === 'string' && l.length > 0)
  if (!words.length) return true
  const needs = words.reduce((sum, l) => sum + l.length * letter + pad, 0) + (words.length - 1) * gap
  return num(room) >= needs
}

/** From this frame width the tuner's side is a narrow column (TUNER_COLUMN), not half: an iPad on its side and wider. */
export const TUNER_NARROW_AT = 1000
/** The tuner's column there: the least a side may be, so Play keeps the rest. */
export const TUNER_COLUMN = SIDE_LEAST

/**
 * How wide each side is, given which side Play is on: `play` and `tool`,
 * from splitSides. Play starts on the right with the tool on the left, the
 * way he described it, and Swap flips them (App.js keeps the choice).
 *
 * The tuner (`tool` 'tuner') needs little room: on an iPad on its side it
 * is a narrow column and Play keeps most of the screen (the plan's picture
 * 6); on the Duo, the Fold and anything under TUNER_NARROW_AT it is half,
 * on the fold, like every other tool.
 */
export function sideWidths({ width, left = 0, right = 0, playOnRight = true, tool = null } = {}) {
  const w = num(width)
  if (tool === 'tuner' && w >= TUNER_NARROW_AT) return { play: w - TUNER_COLUMN, tool: TUNER_COLUMN }
  const { first, second } = splitSides({ width, left, right })
  return playOnRight ? { play: second, tool: first } : { play: first, tool: second }
}

/**
 * What the list offers right now, in TOOLS' order: the same conditions Play
 * already uses for its own buttons. Edit only where its door opens
 * (lib/editDoor `opens`); All presets only where Play offers it (the demo,
 * or the unit answering); the Tuner only where the unit has one and is
 * answering (or the demo); Setlists always, since it never needed the rig.
 */
export function sideTools({ editOpens = false, presetsOffered = false, tunerOffered = false } = {}) {
  const offered = { edit: editOpens, presets: presetsOffered, tuner: tunerOffered }
  return TOOLS.filter((t) => (t in offered ? offered[t] === true : true))
}

/*
 * THE TUNER IN A SIDE (step 3). On one screen the tuner covers everything,
 * because tuning is all you are doing. With two sides up there is room to
 * tune and still see Play, so the tuner opens in the other side instead:
 * Play's Tuner button (or the watch, or Siri) turning it on puts it there,
 * and the list under either side's name offers it too.
 *
 * THE TUNER BORROWS THE SIDE (docs/two-sides, "The tuner"). Whatever was
 * there (Edit, Setlists or All presets) comes back when the tuner goes off;
 * with Play alone, turning it on brings two sides back with the tuner
 * beside Play, and turning it off leaves Play alone again.
 *
 * THE SIDE AND THE UNIT'S TUNER GO TOGETHER. The tuner usually mutes the
 * unit, so a tuner side that has gone must never leave the unit tuning out
 * of sight: closing it (Stop tuner, back, Play's Full screen, another tool
 * picked from the list, Settings, folding the Duo) turns the tuner off. It
 * never turns itself back on, and never starts with the app. And the tuner
 * turned off anywhere else (the watch, Siri, an open the unit refused)
 * gives the side back.
 */

/**
 * Where the tuner goes when it comes on: 'side' with two sides up and Play
 * (or a tool beside it) on screen; null otherwise, and the tuner shows over
 * everything as it always has.
 */
export function tunerGoes({ allowed = false, wide = false, screen = null } = {}) {
  if (!allowed || !wide) return null
  return screen === 'stage' || isTool(screen) || screen === BLOCK ? 'side' : null
}

/**
 * Whether the tuner at the unit has to be turned off because its side went:
 * the screen left 'tuner' (`was` and `now`) any way at all, folding the Duo
 * too, with the tuner still on.
 */
export function tunerStops({ was = null, now = null, tunerOn = false } = {}) {
  return was === 'tuner' && now !== 'tuner' && tunerOn === true
}

/**
 * What the side borrowed by the tuner gives back when the tuner goes off:
 * the tool that was there (`lent`), or Play alone ('stage').
 */
export const tunerGivesBack = (lent) => (isTool(lent) && lent !== 'tuner' ? lent : 'stage')

/** The one line under Stop tuner in its side (picture 6). */
export const TUNER_MUTES = 'Your unit’s own Tuner setting decides if the sound mutes.'

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
  /* A block's knobs beside Play (step 4): Play, and the knobs are not kept. `keep` names them so App brings back what they borrowed, as it does for the tuner. */
  if (tool === BLOCK) return { screen: 'stage', keep: BLOCK }
  if (!isTool(tool)) return { screen: 'stage', keep: null }
  return sideFull ? { screen: tool, keep: tool } : { screen: 'stage', keep: tool }
}

/*
 * DEREK'S IDEA: HOLD A BLOCK, GET ITS PANEL (step 4; docs/two-sides,
 * "Derek's idea"). On Play a tap turns a block on or off and a hold opens
 * its channels, A to D, in a small pop-up. On a big screen there is room
 * for more: the hold opens the block's knobs, with its channels over them,
 * and Play stays in front of you.
 *
 * ONLY WHERE EDITING WORKS, AND ONLY WHERE THE TWO SIDES ARE. The knobs are
 * Edit's own (components/BlockSide draws Edit's block view), so they open
 * exactly where Edit opens (lib/editDoor `opens`): through the computer with
 * the full version, in the demo, and over Bluetooth or a USB cable only for
 * an account and a unit Edit is open to there. Never on a VP4, which has no
 * knobs anywhere. And only for an account the two sides are open to, on a
 * window that shows two sides. Everywhere else (every phone, anything held
 * upright, a customer over Bluetooth, every other account) the hold is
 * today's pop-up, exactly.
 *
 * WHERE THE PANEL GOES:
 *   'lane'  Play filling the window: the Scenes column becomes the panel,
 *           and the blocks stay where they are.
 *   'edit'  Edit is beside Play: Edit jumps to that block.
 *   'side'  The tuner, Setlists or All presets are beside Play (or another
 *           block's knobs already are): the panel takes that side. It
 *           borrows it: Close gives it back (blockGivesBack). A tuner it
 *           took the side from goes off with its side, as it always does,
 *           and never comes back on by itself, so what Close gives back
 *           then is what the tuner had borrowed.
 *   null    Today's pop-up.
 */
export function holdGoes({ allowed = false, editOpens = false, vp4 = false, wide = false, beside = false, screen = null } = {}) {
  if (allowed !== true || editOpens !== true || vp4 === true || wide !== true) return null
  if (screen === 'stage') return 'lane'
  if (beside !== true) return null
  if (screen === 'edit') return 'edit'
  return screen === BLOCK || isTool(screen) ? 'side' : null
}

/**
 * Whether an open panel is still where it was opened (`opened`, holdGoes'
 * answer at the hold: 'lane' or 'side'): in the Scenes column with Play
 * alone, or in the side as its own screen. `goes` is holdGoes' answer now
 * (asked with Edit's door not shut, so a blink of the link does not close
 * it). Anything else (the window shrunk, the Duo folded, a tool or the tuner
 * taking the side, Play made full screen, Settings, Edit's door shut) and it
 * closes: it stays until Close, and is never drawn somewhere it was not
 * opened.
 */
export const panelKeeps = ({ screen = null, goes = null, opened = null } = {}) =>
  goes === opened && ((screen === 'stage' && goes === 'lane') || (screen === BLOCK && goes === 'side'))

/**
 * What a side is borrowed from, when something takes it: the tool on
 * `screen`, or what the tuner or a block's knobs there had borrowed
 * themselves (`tunerLent`, `blockLent`), since neither comes back by itself.
 */
export const sideUnder = (screen, { tunerLent = null, blockLent = null } = {}) => (screen === 'tuner' ? tunerLent : screen === BLOCK ? blockLent : screen)

/** What the side borrowed by a block's knobs gives back on Close: the tool that was there, or Play alone. */
export const blockGivesBack = (lent) => tunerGivesBack(lent)

/**
 * What the panel shows when the preset or its chain changes under it: it
 * follows the same block if the new preset has it, and otherwise closes.
 * 'wait' while the new preset's blocks are not here yet (`elsewhere`,
 * components/ChainWait, as Edit waits); 'show' with the block `found`;
 * 'close' only once the chain on screen is this preset's own, read from the
 * unit (`acts`, lib/chain-view chainActs), and the block is not in it. An
 * outline of the pedals, drawn ahead of that read, closes nothing.
 */
export function panelFollows({ found = false, elsewhere = false, acts = false } = {}) {
  if (elsewhere === true) return 'wait'
  if (found === true) return 'show'
  return acts === true ? 'close' : 'wait'
}

/** Over the blocks, where holding one opens its knobs; elsewhere Play says shared/play-words HOLD_FOR_CHANNELS, as always. */
export const HOLD_FOR_KNOBS = 'Hold for its knobs'
/** At the foot of the panel. */
export const PANEL_FOOT = 'Hold another block to show its knobs here. One tap on a block still turns it on or off.'
/** What the panel leaves out of Edit's block view, because one tap on the block already does it (on/off) or it is the bench's work (copying a channel, the block's colour). */
export const PANEL_LEAVES_OUT = ['copy', 'engaged', 'colour']

/** The least a panel in the Scenes column may be across: a small iPhone's row, so three knobs still sit side by side. */
export const PANEL_LEAST = 320
/** And the most it takes when the blocks have to make room for it. */
export const PANEL_MOST = 480

/**
 * THE PANEL WHERE THE SCENES WERE: how wide it is, and where that leaves the
 * blocks beside it. `plan` is Play's own plan for its tiles (lib/squarePlay
 * tilePlan: the scenes' and the pedals' own sizes, filling the screen) in a
 * row `width` across; `gap` is between tiles and `beside` between the two
 * halves.
 *
 * Side by side already (`plan.beside`), the blocks stay exactly where they
 * are: the same tiles, the same columns, and the panel takes everything
 * to their left, the scenes' own width and any room the two grids were
 * centred in (`stays` true).
 *
 * With the scenes in a row over the blocks (eight scenes over twelve pedals
 * on an 11-inch iPad on its side, or a very long chain), or no scenes at
 * all, or scenes too narrow to hold three knobs, there is no column to take: the
 * panel gets one of its own, and the blocks are planned again in what is
 * left (`chain`, the row for tilePlan with no scenes; `stays` false).
 * Null when even that leaves no room for a tile: the hold is the pop-up.
 */
export function panelLane({ width = 0, plan = null, gap = 8, beside = 24, least = 72 } = {}) {
  const w = num(width)
  if (!w || !plan) return null
  const grid = (cols, wide) => (cols > 0 ? cols * num(wide) + (cols - 1) * gap : 0)
  if (plan.beside === true && plan.sceneCols > 0) {
    const scenes = grid(plan.sceneCols, plan.scene?.wide)
    const spare = Math.max(0, (w - scenes - beside - grid(plan.chainCols, plan.pedal?.wide)) / 2)
    if (scenes + spare >= PANEL_LEAST) return { panel: scenes + spare, stays: true, chain: null }
  }
  const panel = Math.min(PANEL_MOST, Math.max(PANEL_LEAST, Math.floor(w * 0.45)))
  const chain = w - panel - beside
  return chain >= least ? { panel, stays: false, chain } : null
}
