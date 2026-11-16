/* Generated from shared/starter-chains.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/*
 * QUICK BUILD AND STARTER CHAINS: the rules, the words and the plan.
 *
 * "Let's also look into building out a way to build a preset quickly from an
 * empty preset. Maybe a "quick build" to build what blocks go in them
 * (including NAM blocks) and a quick default starter chain option as well
 * with settings a user where A user can create their own custom starter
 * chains with what blocks they want in their starter chain." Then, of the
 * four pictures: "The four screens are good. I need everything with the
 * chain builder to work over Bluetooth also" (Justin, 15 November 2026).
 *
 * On a preset with nothing in it but the Input and the Output, the player
 * taps blocks in the order they want them, and the app puts them in one row
 * of the grid and joins them from the Input to the Output, then reads the
 * chain back and says exactly what landed, with one Undo. A starter chain is
 * such an order, named and kept, offered on every empty preset.
 *
 * THIS FILE WRITES NOTHING TO A UNIT. The plan is a list of the steps
 * shared/split-chain.mjs already runs (place, clear, cable), in display
 * coordinates, so the phone runs it with the same runPlan and the same five
 * calls of its device layer whatever the wire under them is: the computer
 * today, Bluetooth on the day the wire answers the grid's routes.
 *
 * Storage is handed in, as lib/songNotes takes it, so a test hands in a
 * Map-backed stand-in. Pure otherwise: no imports from a unit, a screen or
 * an account. The phone carries a copy (scripts/sync-relay-rules.mjs); the
 * browser does not import it yet, which is what keeps it out of the computer
 * app until the browser's half is built.
 */

import { CELL, gridMap, stepWords } from './split-chain.js'
import { colLabel, rowLabel } from './grid-plan.js'
import { CHAIN_EMPTY } from './play-words.js'

/* ---------------------------------------------------------------- */
/* The words                                                         */
/* ---------------------------------------------------------------- */

export const QUICK_BUILD_TITLE = 'Quick build'
export const QUICK_BUILD_SUB = 'Pick the blocks you want, in order'
export const QUICK_BUILD_HOW = 'Tap blocks in the order you want them. Tap one again to take it out.'
export const NOTHING_SAVED = 'Nothing is saved on the unit until you tap Save.'
/** The same where the app has no Save to offer on this connection: never a button that is not there. */
export const NOTHING_SAVED_ON_UNIT = 'Nothing is saved until you save the preset on the unit itself.'
export const YOUR_CHAIN = 'Your chain'
export const BLOCKS_HEAD = 'Blocks'
export const MORE_CHIP = 'More…'
export const CHAIN_NONE_YET = 'Nothing picked. Tap a block below to start.'
export const KEEP_STARTER = 'Keep as a starter chain'
export const KEEP_STARTER_SUB = 'To use again on another empty preset'
export const KEEP_BUTTON = 'Keep'
export const CANCEL_BUTTON = 'Cancel'
export const NAME_LABEL = 'Name of the starter chain'
export const NAME_NEEDED = 'Give it a name first.'
export const BLOCKS_CAP_LINE = 'A starter chain holds 12 blocks at most.'

/** The build button, with the count in it. */
export const buildLabel = (n) => (n === 1 ? 'Build this block' : n > 1 ? `Build these ${n} blocks` : 'Build')

/** Under the chips once no more fit. */
export const chainFull = (room, linear) =>
  linear ? `That fills all ${room} slots, so the other blocks are quiet.` : `That is as many blocks as the row has room for, so the other blocks are quiet.`

/* On the empty preset (mock-up 1). */
/* Play's own line for it (shared/play-words), said the same here. */
export const EMPTY_LINE = CHAIN_EMPTY
export const FROM_A_CHAIN = 'Or start from a chain'
export const MAKE_YOUR_OWN = 'Make your own in Settings → Starter chains'
export const DEFAULT_BADGE = 'Default'

/* Settings → Starter chains (mock-up 4). */
export const STARTERS_TITLE = 'Starter chains'
export const startersLine = (unit) => `Chains to start an empty preset from. Kept for your ${unit || 'unit'}.`
export const COMES_WITH_APP = 'Comes with the app'
export const MAKE_DEFAULT = 'Make this the default'
export const NEW_STARTER = 'New starter chain'
export const EDIT_STARTER = 'Edit'
export const REMOVE_STARTER = 'Remove'
export const MOVE_UP = 'Move up'
export const MOVE_DOWN = 'Move down'
export const removeAsk = (name) => `Remove “${name}”?`
export const REMOVE_ASK_SUB = 'It is taken out of your starter chains. Nothing on the unit changes.'
export const STARTERS_FULL = 'You have 12 starter chains, which is the most there can be. Remove one to keep another.'
/** The Settings row's status line. */
export const startersStatus = (list) => {
  const n = Array.isArray(list) ? list.length : 0
  return n <= 1 ? CLASSIC_NAME : `${n} chains`
}

/* While it builds: over Bluetooth this takes seconds, so each step says itself. */
export const CHECKING_EMPTY = 'Checking the preset is still empty…'
export const placingLine = (name) => `Placing ${name || 'a block'}…`
export const JOINING = 'Joining the blocks…'
export const READING_BACK = 'Reading the chain back…'
export const READING_BLOCKS = 'Reading which blocks the unit has…'
/** Under the name box once a chain is kept. */
export const keptLine = (name) => `Kept as “${name}”. It is offered on every empty preset.`
export const UNDOING = 'Taking the blocks back out…'

/* The result (mock-up 3). */
export const BUILT_JOINED = 'Built and connected'
export const BUILT_ONLY = 'Built'
export const BACK_TO_PLAY = 'Back to Play'
export const UNDO_LABEL = 'Undo'
/* With no block to count (the read back did not come, or the unit took none and the build still changed cells), no number is said. */
export const undoSub = (n) => (n === 1 ? 'Takes the block back out' : n > 1 ? `Takes the ${n} blocks back out` : 'Puts the preset back as it was')
export const SAVE_PRESET = 'Save the preset'
export const PICK_AGAIN = 'Pick again'

const blocksWord = (n) => (n === 1 ? 'One block' : `${n} blocks`)

/**
 * The line under the result's title. `cols` are the columns the blocks went
 * in; `joined` whether they were joined from the Input to the Output, and
 * `why` the reason when not (planBuild's joinNote).
 */
export function builtLine({ count, row, cols = [], linear = false, joined = false, why = null }) {
  const n = Math.max(0, count | 0)
  if (linear) {
    const first = cols.length ? Math.min(...cols) + 1 : 1
    const last = cols.length ? Math.max(...cols) + 1 : n
    return n === 1 ? `One block in slot ${first}.` : `${n} blocks in slots ${first} to ${last}.`
  }
  const where = `${blocksWord(n)} in row ${rowLabel(row)}`
  if (joined) return `${where}, joined from input to output.`
  if (why === 'top') return `${where}. The app does not lay cables on the top row of this unit, so join them on the unit itself before you play.`
  return `${where}. There is no Input or Output on that row to join them to, so add one before you play.`
}

/** A block the unit did not take, when the others are in. */
export const notAddedTitle = (names) => `${names.join(' and ')} ${names.length === 1 ? 'was' : 'were'} not added`
/* `stops`: the column where the chain read back shows the row broken (joinBreak), when the plan was to join it. A cell the unit left empty breaks the row, and a preset with no sound is said as one. */
export function notAddedLine(names, others, joined, stops = null) {
  const it = names.length === 1 ? 'it' : 'them'
  const rest = others === 1 ? `The other block is in${joined ? ' and connected' : ''}.` : `The other ${others} blocks are in${joined ? ' and connected' : ''}.`
  const broken = Number.isInteger(stops) ? ` The row is not joined from the input to the output: it stops at column ${colLabel(stops)}. Nothing will sound until it is.` : ''
  return `${notAddedTitle(names)}. The unit did not take ${it}, which usually means the preset has no room left for ${it} (CPU). ${rest}${broken}`
}
/* An Input or an Output the app placed and the unit did not take: not a block that ran out of CPU, and a row with no end is a row with no sound. */
export const endMissingLine = (names, others) =>
  `${notAddedTitle(names)}, so the row is not joined from the input to the output. Nothing will sound until it is. ${others === 1 ? 'The block is in.' : `The ${others} blocks are in.`}`
/*
 * NOT JOINED ALL THE WAY: every block is in, and the chain read back does
 * not show the row joined from the Input to the Output. Said from the
 * unit's own answer, never from what was sent: a cable the unit took and
 * did not keep, or an empty cell it did not carry the wire across, is a
 * preset with no sound, and "Built and connected" over it would be the app
 * saying so on no evidence.
 */
export const NOT_JOINED_TITLE = 'Built, but not joined all the way'
export const notJoinedLine = (count, row, col) =>
  `${blocksWord(count)} in row ${rowLabel(row)}, but the row is not joined from the input to the output: it stops at column ${colLabel(col)}. Nothing will sound until it is. Tap Undo to take them back out.`
/* The chain could not be read back: what landed is not known, and is not guessed. */
export const NOT_READ_TITLE = 'Sent, but not read back'
export const NOT_READ = 'The unit did not answer when the app went to read the chain back, so the app can’t say what landed. Open the preset again to see.'
export const NONE_ADDED_TITLE = 'Nothing was added'
export const NONE_ADDED = 'The unit did not take any of the blocks. The chain has been read again.'
/* None of the picked blocks is in, and an Input or Output the app placed is: "Nothing was added" over that, beside an Undo, would be two things said at once. */
export const NO_BLOCKS_TITLE = 'None of the blocks were added'
export const stoppedEarlyLine = (names = []) =>
  names.length
    ? `The build stopped before any block was sent. ${names.join(' and ')} ${names.length === 1 ? 'was' : 'were'} put in, and Undo takes ${names.length === 1 ? 'it' : 'them'} back out.`
    : 'The build stopped before any block was sent.'
export const endsPutLine = (names) =>
  `The unit did not take any of the blocks. ${names.join(' and ')} ${names.length === 1 ? 'was' : 'were'} put in, and Undo takes ${names.length === 1 ? 'it' : 'them'} back out.`

/** A family the unit does not have, or has no more of. */
export const missingLine = (names) =>
  `This unit has no ${names.join(', ')} to add, so ${names.length === 1 ? 'it is' : 'they are'} left out.`
/** Picks that did not fit in the row or the slots. */
export const leftLine = (names) => `No room for ${names.join(', ')}, so ${names.length === 1 ? 'it was' : 'they were'} left out.`

export const NOT_BARE = 'This preset is not empty any more, so Quick build did nothing. Nothing was changed.'
export const NO_PICKS = 'Pick at least one block.'
export const ENDS_APART = 'The Input and the Output are on different rows, so there is no one row to build along. Put them on the same row first.'
export const NO_ROOM = 'There is no free cell between the Input and the Output.'
export const NOT_LISTED = 'The unit did not list one of these blocks. Read the preset again and try once more.'
export const READ_FAILED = 'The unit did not answer when the app asked what is in this preset. Nothing was changed.'
/** The unit went to another preset while a build or an Undo was going: nothing more is sent, and nothing is said of a chain that is no longer the one on screen. */
export const PRESET_MOVED = 'The preset changed part-way, so the app stopped and sent nothing more. Open the preset again to see what is in it.'
/** The same, before a single step went. */
export const PRESET_MOVED_BEFORE = 'The preset changed before the app could build, so nothing was sent. Nothing was changed.'
/** The same, found only once every step had gone: nothing was stopped, so that is not said. */
export const PRESET_MOVED_AFTER = 'The unit went to another preset right after the build was sent, so the app can’t read what landed. Open that preset again to see what is in it.'
export const UNDO_MOVED_AFTER = 'The unit went to another preset right after Undo was sent, so the app can’t read whether everything is out. Open that preset again to see.'
/** The unit would not say which preset it is on between two steps: the app does not go on writing to a preset it cannot name. */
export const UNIT_QUIET = 'The unit stopped answering part-way, so the app stopped and sent nothing more.'
/** The same, before a single step went: nothing was sent, and no result is drawn for a build that never began. */
export const UNIT_QUIET_BEFORE = 'The unit did not say which preset it is on, so nothing was sent. Nothing was changed.'

/** A step that threw part-way: which, and that nothing more went. */
/* `read`: whether the chain was read again afterwards, which is said only where it was. The reason is given once, with one full stop. */
export const stoppedLine = (step, error, read = true) =>
  `Stopped at “${stepWords(step)}”: ${String(error || 'no answer').replace(/[.\s]+$/, '')}. Nothing more was sent${read ? ', and the chain has been read again' : ''}.`

/* An Undo whose read back did not come: what is still in is not known, and "took them out" is not said. */
export const UNDO_NOT_READ = 'Undo was sent, but the unit did not answer when the app went to read the chain back, so the app can’t say it is all out. Open the preset again to see.'
export const undoneLine = (n) => (n === 1 ? 'Took the block back out.' : n > 1 ? `Took the ${n} blocks back out.` : 'Put the preset back as it was.')
/* The blocks are out, and the chain read back does not show the wiring the preset had before the build. */
export const undoNotJoinedLine = (col, n = 0) =>
  `${n === 1 ? 'Took the block back out' : n > 1 ? `Took the ${n} blocks back out` : 'Undo ran'}, but the row is not joined the way it was before: it stops at column ${colLabel(col)}. Nothing will sound until it is. Join it on the unit, or load the preset again if you have not saved it.`
/* The unit's chain read does not show its cables (an older computer app): the Undo then cuts none, since none is known to be the build's own, and says so. */
export const undoWiringLeftLine = (n = 0) =>
  `${n === 1 ? 'Took the block back out' : n > 1 ? `Took the ${n} blocks back out` : 'Undo ran'}. The cables in the row were left as they are, because this unit’s chain read does not show its wiring.`
/** The unit's list of blocks could not be read: said as that, never as a unit with no blocks. */
export const BLOCKS_NOT_READ = 'The unit did not answer when the app asked which blocks it has.'
export const TRY_AGAIN = 'Try again'
export const undoMissedLine = (names) => `Undo did not take everything back out: ${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} still in. The chain has been read again.`

/*
 * THE CARD WHILE IT BUILDS. "Looks like everything worked. We need better
 * feedback. Let him know the chain is building correctly, like a spinning
 * circle or dots that are moving or something, as sometimes it feels like
 * it's just frozen even though it's just thinking in the background cause
 * it's taking longer over Bluetooth" (Justin, report 913f344a, 16 November
 * 2026: his Axe-Fx III over a WIDI Master, 56 seconds from the tap to the
 * result, 51 of them two reads of the whole preset with one line of text
 * that did not move). Three steps, the one going with a turning circle, and
 * a bar where how far it has got is known.
 */
export const STEPS_BUILD = Object.freeze(['Check the preset is empty', 'Put in the blocks and join them', 'Check what landed'])
export const STEPS_UNDO = Object.freeze(['Check nothing has changed', 'Take the blocks back out', 'Check what is left'])
export const readingFrom = (unit) => `Reading the preset from your ${unit || 'unit'}…`
export const readingBack = (unit) => `Reading the preset back from your ${unit || 'unit'}…`
/** Steps sent out of the plan's, under step 2's bar. */
export const sentOf = (k, n) => `${k} of ${n}`
/* Before the tap and under the card, where the preset is read down a Bluetooth adapter (Edit's takesLong). His first such build was 56 seconds; an FM3's or FM9's preset is half the size. */
export const TAKES_LONG = 'Over Bluetooth this takes about half a minute to a minute.'
/* Switched away, the phone stops the app, the read stops part-way and the build fails (no Bluetooth in the background). */
export const KEEP_OPEN = 'Keep the app open until it’s done.'
export const BUILDING = 'Building…'

/**
 * What the card shows: the three steps (`kind` 'build' or 'undo'), each
 * 'done', 'now' or 'next' by `step` (1, 2 or 3); the line under the one
 * going (the preset being read on 1 and 3, the line handed in on 2); and
 * how far it has got, where that is known.
 *
 * On steps 1 and 3, `got` and `of` are the bytes of the preset read so far
 * and the size known for the unit (bleWire gen3DumpGrid); on 2, the steps
 * sent before the one going and the plan's count. `percent` is null where
 * nothing says how far (through the computer, whose read tells nothing),
 * never below 0, at most 99 until `got` reaches `of`, and 100 only then:
 * a bar that fills before the end would be the frozen screen again, the
 * other way round. `tally` is what stands beside the bar.
 */
export function buildPanel({ kind = 'build', step = 1, got = null, of = null, line = null, unit = null } = {}) {
  const labels = kind === 'undo' ? STEPS_UNDO : STEPS_BUILD
  const at = [1, 2, 3].includes(step) ? step : 1
  const rows = labels.map((label, i) => ({ n: i + 1, label, state: i + 1 < at ? 'done' : i + 1 === at ? 'now' : 'next' }))
  const known = Number.isFinite(got) && Number.isFinite(of) && of > 0
  const percent = known ? (got >= of ? 100 : Math.max(0, Math.min(99, Math.floor((100 * got) / of)))) : null
  const said = at === 1 ? readingFrom(unit) : at === 3 ? readingBack(unit) : line || null
  const tally = percent === null ? null : at === 2 ? sentOf(Math.min(Math.max(0, got) + 1, of), of) : `${percent}%`
  return { rows, line: said, percent, tally }
}

/** Every word above that a player reads, for the test that holds them. */
export const SHOWN_WORDS = () => [
  QUICK_BUILD_TITLE, QUICK_BUILD_SUB, QUICK_BUILD_HOW, NOTHING_SAVED, NOTHING_SAVED_ON_UNIT, YOUR_CHAIN, BLOCKS_HEAD, MORE_CHIP, CHAIN_NONE_YET,
  KEEP_STARTER, KEEP_STARTER_SUB, KEEP_BUTTON, CANCEL_BUTTON, NAME_LABEL, NAME_NEEDED, BLOCKS_CAP_LINE, buildLabel(0), buildLabel(1), buildLabel(5),
  chainFull(4, true), chainFull(10, false), EMPTY_LINE, FROM_A_CHAIN, MAKE_YOUR_OWN, DEFAULT_BADGE, STARTERS_TITLE,
  startersLine('Axe-Fx III'), COMES_WITH_APP, MAKE_DEFAULT, NEW_STARTER, EDIT_STARTER, REMOVE_STARTER, MOVE_UP, MOVE_DOWN,
  removeAsk('My rig'), REMOVE_ASK_SUB, STARTERS_FULL, startersStatus([1]), startersStatus([1, 2]), CHECKING_EMPTY, placingLine('Amp'),
  JOINING, READING_BACK, READING_BLOCKS, keptLine('My rig'), UNDOING, BUILT_JOINED, BUILT_ONLY, BACK_TO_PLAY, UNDO_LABEL, undoSub(1), undoSub(5), SAVE_PRESET, PICK_AGAIN,
  builtLine({ count: 5, row: 1, joined: true }), builtLine({ count: 4, row: 0, why: 'top' }), builtLine({ count: 2, row: 1, why: 'ends' }),
  builtLine({ count: 4, linear: true, cols: [0, 1, 2, 3] }), builtLine({ count: 1, linear: true, cols: [0] }),
  notAddedLine(['Reverb'], 4, true), notAddedLine(['Reverb', 'Delay'], 1, false), NONE_ADDED_TITLE, NONE_ADDED,
  NOT_JOINED_TITLE, notJoinedLine(5, 1, 6), notJoinedLine(1, 1, 2), NOT_READ_TITLE, NOT_READ,
  missingLine(['Cab']), missingLine(['NAM', 'Cab']), leftLine(['Reverb']), NOT_BARE, NO_PICKS, ENDS_APART, NO_ROOM, NOT_LISTED,
  READ_FAILED, PRESET_MOVED, stoppedLine({ kind: 'place', row: 1, col: 2, name: 'Amp' }, 'no answer'), undoneLine(1), undoneLine(5),
  undoMissedLine(['Amp']), UNDO_NOT_READ, undoSub(0), undoneLine(0), undoNotJoinedLine(3), undoNotJoinedLine(3, 1), undoNotJoinedLine(3, 4), undoWiringLeftLine(0), undoWiringLeftLine(2), BLOCKS_NOT_READ, TRY_AGAIN,
  NO_BLOCKS_TITLE, stoppedEarlyLine(), stoppedEarlyLine(['Input 1']), endsPutLine(['Input 1']), endsPutLine(['Input 1', 'Output 1']), PRESET_MOVED_BEFORE, PRESET_MOVED_AFTER, UNDO_MOVED_AFTER, UNIT_QUIET, UNIT_QUIET_BEFORE, stoppedLine({ kind: 'place', row: 1, col: 2, name: 'Amp' }, 'The unit did not answer in time.', false),
  notAddedLine(['Cab'], 2, false, 2), endMissingLine(['Output 1'], 2), endMissingLine(['Input 1', 'Output 1'], 1),
  ...STEPS_BUILD, ...STEPS_UNDO, readingFrom('Axe-Fx III'), readingFrom(''), readingBack('FM3'), readingBack(null), sentOf(4, 11), TAKES_LONG, KEEP_OPEN, BUILDING
]

/* ---------------------------------------------------------------- */
/* Families, and the names a picker shows when no unit is linked       */
/* ---------------------------------------------------------------- */

/*
 * A FAMILY is the palette's `family || slug`: what Delay 1 and Delay 2 have
 * in common. Kept in one spelling, because the units spell two of them
 * differently (an AM4's 'compressor' is a gen-3 unit's 'comp', its 'volpan'
 * their 'volume'), and a starter chain made on one should mean the same on
 * the other.
 */
const SPELLED = Object.freeze({ compressor: 'comp', volpan: 'volume' })
export const familyKey = (f) => {
  const s = String(f || '').trim().toLowerCase()
  return SPELLED[s] || s
}
export const familyOf = (entry) => familyKey(entry?.family || entry?.slug)

/** The ends of the chain: never a chip, never in a starter chain. */
const ENDS = ['input', 'output']

/** The common ones, first and in this order where the unit has them. */
export const COMMON_FAMILIES = Object.freeze(['comp', 'drive', 'amp', 'nam', 'cab', 'irplayer', 'chorus', 'flanger', 'phaser', 'delay', 'reverb', 'wah', 'pitch', 'geq', 'looper'])

/** A name for every family the units list, for a picker with no unit to ask. */
export const FAMILY_NAMES = Object.freeze({
  comp: 'Compressor',
  drive: 'Drive',
  amp: 'Amp',
  nam: 'NAM',
  cab: 'Cab',
  irplayer: 'IR Player',
  chorus: 'Chorus',
  flanger: 'Flanger',
  phaser: 'Phaser',
  delay: 'Delay',
  reverb: 'Reverb',
  wah: 'Wah',
  pitch: 'Pitch',
  geq: 'Graphic EQ',
  looper: 'Looper',
  crossover: 'Crossover',
  dynadist: 'Dynamic Distortion',
  enhancer: 'Enhancer',
  filter: 'Filter',
  formant: 'Formant',
  gate: 'Gate',
  megatap: 'Megatap Delay',
  mixer: 'Mixer',
  multicomp: 'Multiband Compressor',
  multiplexer: 'Multiplexer',
  multitap: 'Multitap Delay',
  peq: 'Parametric EQ',
  plex: 'Plex Delay',
  resonator: 'Resonator',
  ringmod: 'Ring Modulator',
  rotary: 'Rotary',
  synth: 'Synth',
  tentap: 'Ten-Tap Delay',
  tonematch: 'Tone Match',
  tremolo: 'Tremolo',
  vocoder: 'Vocoder',
  volume: 'Volume'
})

/** A family's name: the list's, else the palette entry's own without its number. */
export function familyName(family, entry = null) {
  const key = familyKey(family)
  if (FAMILY_NAMES[key]) return FAMILY_NAMES[key]
  const own = String(entry?.name || '').replace(/\s*\d+\s*$/, '').trim()
  return own || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Block')
}

/**
 * THE PALETTE WITH NO UNIT, for making a chain on the couch: every family
 * above, two of each (one looper), with no effect ids. Building always uses
 * the unit's own list; this only lets a chain be written down.
 */
export function builtInPalette() {
  const out = []
  for (const family of Object.keys(FAMILY_NAMES)) {
    const count = family === 'looper' ? 1 : 2
    for (let instance = 1; instance <= count; instance++) out.push({ slug: family, family, instance, name: count > 1 ? `${FAMILY_NAMES[family]} ${instance}` : FAMILY_NAMES[family] })
  }
  return out
}

/** One entry a family, with how many the unit has: the chips, common first, then the rest by name (behind More…). */
export function paletteFamilies(palette) {
  const counts = new Map()
  for (const e of Array.isArray(palette) ? palette : []) {
    const f = familyOf(e)
    if (!f || ENDS.includes(f)) continue
    const was = counts.get(f)
    counts.set(f, { family: f, name: was?.name || familyName(f, e), count: (was?.count || 0) + 1 })
  }
  const common = COMMON_FAMILIES.filter((f) => counts.has(f)).map((f) => ({ ...counts.get(f), common: true }))
  const rest = [...counts.values()]
    .filter((x) => !COMMON_FAMILIES.includes(x.family))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((x) => ({ ...x, common: false }))
  return [...common, ...rest]
}

/* ---------------------------------------------------------------- */
/* Picking                                                           */
/* ---------------------------------------------------------------- */

/*
 * The picks are a list of families in order, like a starter chain's blocks:
 * the nth mention of a family is the nth of it the unit has. So "Delay"
 * is the first mention and "Delay 2" the second, and taking the first out
 * makes the second the first, which is what the picture shows.
 */

/** Tap a chip: take its mention out if it is picked, else add it at the end while there is room. */
export function pickToggled(picks, family, nth = 1, room = Infinity) {
  const list = Array.isArray(picks) ? picks.slice() : []
  const key = familyKey(family)
  let seen = 0
  for (let i = 0; i < list.length; i++) {
    if (list[i] !== key) continue
    seen += 1
    if (seen === nth) {
      list.splice(i, 1)
      return list
    }
  }
  if (list.length >= room) return list
  list.push(key)
  return list
}

/**
 * The chips: one a family (common first), and once a family is picked and
 * the unit has another, a chip for the next one right after it. Each with
 * its place in the chain, or null when it is not picked.
 */
export function chipsFor(palette, picks) {
  const list = Array.isArray(picks) ? picks : []
  const out = []
  const fams = paletteFamilies(palette)
  /* A family that is picked and that this list of blocks lacks (a chain written against another list) still gets its chips, so it can be tapped out: one a mention, and never one more to add. */
  const known = new Set(fams.map((f) => f.family))
  for (const f of list) {
    if (typeof f !== 'string' || !f || known.has(f) || ENDS.includes(f)) continue
    known.add(f)
    fams.push({ family: f, name: familyName(f), count: 0, common: COMMON_FAMILIES.includes(f) })
  }
  for (const fam of fams) {
    const mentions = []
    list.forEach((f, i) => {
      if (f === fam.family) mentions.push(i)
    })
    const shown = fam.count ? Math.min(fam.count, mentions.length + 1) : mentions.length
    for (let nth = 1; nth <= shown; nth++) {
      out.push({
        family: fam.family,
        nth,
        common: fam.common,
        label: nth === 1 ? fam.name : `${fam.name} ${nth}`,
        place: nth <= mentions.length ? mentions[nth - 1] + 1 : null
      })
    }
  }
  return out
}

/* ---------------------------------------------------------------- */
/* Kept chains                                                       */
/* ---------------------------------------------------------------- */

export const STARTERS_KEY = 'fractal.starterChains'
export const PALETTE_KEY = 'fractal.starterPalette'
export const STARTERS_MAX = 12
export const STARTER_NAME_MAX = 24
export const STARTER_BLOCKS_MAX = 12

export const CLASSIC_ID = 'classic'
export const CLASSIC_NAME = 'Classic rig'
export const CLASSIC = Object.freeze({ id: CLASSIC_ID, name: CLASSIC_NAME, blocks: Object.freeze(['drive', 'amp', 'cab', 'delay', 'reverb']) })

/** A name as kept: one line, its spaces made single, trimmed, at most 24 characters. '' when nothing is left. */
export const cleanStarterName = (name) => (typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, STARTER_NAME_MAX).trim() : '')

/** Blocks as kept: family words only, in one spelling, no ends, at most 12. */
export function cleanStarterBlocks(blocks) {
  if (!Array.isArray(blocks)) return []
  return blocks
    .map((b) => (typeof b === 'string' ? familyKey(b) : ''))
    .filter((b) => /^[a-z0-9_-]{1,32}$/.test(b) && !ENDS.includes(b))
    .slice(0, STARTER_BLOCKS_MAX)
}

function readAll(storage, key = STARTERS_KEY) {
  try {
    const raw = storage?.getItem(key)
    const all = raw ? JSON.parse(raw) : null
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {}
  } catch {
    return {}
  }
}

function writeAll(storage, all, key = STARTERS_KEY) {
  try {
    storage?.setItem(key, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

const okDrawer = (d) => typeof d === 'string' && d !== ''

/** One unit's drawer, repaired: junk read as nothing, never a throw. */
function drawerIn(all, drawer) {
  const d = all?.[drawer]
  const chains = []
  const ids = new Set([CLASSIC_ID])
  for (const c of Array.isArray(d?.chains) ? d.chains : []) {
    const id = typeof c?.id === 'string' && /^c\d{1,9}$/.test(c.id) ? c.id : null
    const name = cleanStarterName(c?.name)
    const blocks = cleanStarterBlocks(c?.blocks)
    if (!id || ids.has(id) || !name || !blocks.length) continue
    ids.add(id)
    chains.push({ id, name, blocks })
    if (chains.length >= STARTERS_MAX) break
  }
  const order = []
  for (const id of Array.isArray(d?.order) ? d.order : []) if (ids.has(id) && !order.includes(id)) order.push(id)
  if (!order.includes(CLASSIC_ID)) order.unshift(CLASSIC_ID)
  for (const c of chains) if (!order.includes(c.id)) order.push(c.id)
  const def = typeof d?.default === 'string' && ids.has(d.default) ? d.default : CLASSIC_ID
  return { chains, order, default: def }
}

function putDrawer(storage, drawer, d) {
  const all = readAll(storage)
  all[drawer] = { chains: d.chains, order: d.order, default: d.default }
  return writeAll(storage, all)
}

/**
 * Every starter chain for this unit, the default first, then the rest in
 * the player's order. Each `{ id, name, blocks, builtIn, isDefault }`.
 */
export function starterList(storage, drawer) {
  const d = okDrawer(drawer) ? drawerIn(readAll(storage), drawer) : drawerIn({}, '')
  const byId = new Map([[CLASSIC_ID, { ...CLASSIC, blocks: [...CLASSIC.blocks] }], ...d.chains.map((c) => [c.id, c])])
  const shown = d.order.map((id) => byId.get(id)).filter(Boolean)
  const first = shown.find((c) => c.id === d.default)
  return [first, ...shown.filter((c) => c !== first)].map((c) => ({ ...c, builtIn: c.id === CLASSIC_ID, isDefault: c.id === d.default }))
}

/**
 * CHAINS KEPT BEFORE ANY UNIT WAS KNOWN GO TO THE FIRST UNIT THAT IS. A
 * chain made in Settings with nothing linked is filed under no unit's name
 * (`from`), and a unit's own drawer never opened it: it was kept, said to be
 * kept, and never seen again. So when a unit is known its drawer (`to`)
 * takes them, in their order, while it has room, and `from` keeps only what
 * did not fit. Returns how many moved.
 */
export function adoptStarters(storage, from, to) {
  if (!okDrawer(from) || !okDrawer(to) || from === to) return 0
  const all = readAll(storage)
  const src = drawerIn(all, from)
  if (!src.chains.length) return 0
  const dst = drawerIn(all, to)
  const byId = new Map(src.chains.map((c) => [c.id, c]))
  const left = []
  let moved = 0
  for (const c of src.order.map((id) => byId.get(id)).filter(Boolean)) {
    if (dst.chains.length >= STARTERS_MAX) {
      left.push(c)
      continue
    }
    const id = nextId(dst)
    dst.chains.push({ id, name: c.name, blocks: c.blocks })
    dst.order.push(id)
    if (src.default === c.id && dst.default === CLASSIC_ID) dst.default = id
    moved += 1
  }
  if (!moved) return 0
  const kept = new Set(left.map((c) => c.id))
  all[to] = { chains: dst.chains, order: dst.order, default: dst.default }
  all[from] = { chains: left, order: src.order.filter((id) => id === CLASSIC_ID || kept.has(id)), default: kept.has(src.default) ? src.default : CLASSIC_ID }
  writeAll(storage, all)
  return moved
}

/** How many kept chains (the built-in not counted), and whether another fits. */
export const startersKept = (storage, drawer) => (okDrawer(drawer) ? drawerIn(readAll(storage), drawer).chains.length : 0)
export const roomForStarter = (storage, drawer) => startersKept(storage, drawer) < STARTERS_MAX

const nextId = (d) => `c${d.chains.reduce((n, c) => Math.max(n, Number(c.id.slice(1)) || 0), 0) + 1}`

/** Keep a new one. `{ ok, chain }`, or `{ ok: false, why }`. */
export function addStarter(storage, drawer, { name, blocks } = {}) {
  if (!okDrawer(drawer)) return { ok: false, why: 'No unit to keep it for.' }
  const d = drawerIn(readAll(storage), drawer)
  if (d.chains.length >= STARTERS_MAX) return { ok: false, why: STARTERS_FULL }
  const n = cleanStarterName(name)
  if (!n) return { ok: false, why: NAME_NEEDED }
  const b = cleanStarterBlocks(blocks)
  if (!b.length) return { ok: false, why: NO_PICKS }
  const chain = { id: nextId(d), name: n, blocks: b }
  d.chains.push(chain)
  d.order.push(chain.id)
  putDrawer(storage, drawer, d)
  return { ok: true, chain }
}

const editable = (d, id) => d.chains.find((c) => c.id === id) || null

/** A new name for one of the player's own (never the built-in). */
export function renameStarter(storage, drawer, id, name) {
  if (!okDrawer(drawer)) return { ok: false }
  const d = drawerIn(readAll(storage), drawer)
  const c = editable(d, id)
  const n = cleanStarterName(name)
  if (!c) return { ok: false, why: 'That one cannot be changed.' }
  if (!n) return { ok: false, why: NAME_NEEDED }
  c.name = n
  putDrawer(storage, drawer, d)
  return { ok: true, chain: { ...c } }
}

/** New blocks for one of the player's own (never the built-in). */
export function replaceStarterBlocks(storage, drawer, id, blocks) {
  if (!okDrawer(drawer)) return { ok: false }
  const d = drawerIn(readAll(storage), drawer)
  const c = editable(d, id)
  const b = cleanStarterBlocks(blocks)
  if (!c) return { ok: false, why: 'That one cannot be changed.' }
  if (!b.length) return { ok: false, why: NO_PICKS }
  c.blocks = b
  putDrawer(storage, drawer, d)
  return { ok: true, chain: { ...c } }
}

/** Take one of the player's own out; the built-in stays. A default taken out hands it back to the built-in. */
export function removeStarter(storage, drawer, id) {
  if (!okDrawer(drawer)) return false
  const d = drawerIn(readAll(storage), drawer)
  if (!editable(d, id)) return false
  d.chains = d.chains.filter((c) => c.id !== id)
  d.order = d.order.filter((x) => x !== id)
  if (d.default === id) d.default = CLASSIC_ID
  return putDrawer(storage, drawer, d)
}

/** The one offered first, the built-in included. */
export function setDefaultStarter(storage, drawer, id) {
  if (!okDrawer(drawer)) return false
  const d = drawerIn(readAll(storage), drawer)
  if (id !== CLASSIC_ID && !editable(d, id)) return false
  d.default = id
  return putDrawer(storage, drawer, d)
}

/**
 * The move, as a rule (shared/watch-link.mjs watchPageMoved's way): `id`
 * swapped with its neighbour among the chains under the default, which
 * stays first. Out of range, the list as it was.
 */
export function starterMoved(order, def, id, by) {
  const list = Array.isArray(order) ? order.slice() : []
  const shown = list.filter((x) => x !== def)
  const at = shown.indexOf(id)
  const to = at + (by < 0 ? -1 : 1)
  if (at < 0 || to < 0 || to >= shown.length) return list
  const a = list.indexOf(shown[at])
  const b = list.indexOf(shown[to])
  ;[list[a], list[b]] = [list[b], list[a]]
  return list
}

export function moveStarter(storage, drawer, id, by) {
  if (!okDrawer(drawer)) return false
  const d = drawerIn(readAll(storage), drawer)
  const moved = starterMoved(d.order, d.default, id, by)
  if (moved.join() === d.order.join()) return false
  d.order = moved
  return putDrawer(storage, drawer, d)
}

/* The unit's list of blocks, last read: for a picker with no unit linked. Names and families only. */
export function keepPalette(storage, drawer, palette) {
  if (!okDrawer(drawer) || !Array.isArray(palette) || !palette.length) return false
  const slim = palette
    .filter((e) => familyOf(e))
    .slice(0, 200)
    .map((e) => ({ family: familyOf(e), instance: Number.isInteger(e.instance) ? e.instance : 1, name: String(e.name || '').slice(0, 40) }))
  const all = readAll(storage, PALETTE_KEY)
  if (JSON.stringify(all[drawer]) === JSON.stringify(slim)) return true
  all[drawer] = slim
  return writeAll(storage, all, PALETTE_KEY)
}

export function paletteKept(storage, drawer) {
  if (!okDrawer(drawer)) return null
  const list = readAll(storage, PALETTE_KEY)[drawer]
  if (!Array.isArray(list)) return null
  const out = list.filter((e) => e && typeof e.family === 'string' && /^[a-z0-9_-]{1,32}$/.test(e.family)).map((e) => ({ family: e.family, slug: e.family, instance: Number.isInteger(e.instance) ? e.instance : 1, name: typeof e.name === 'string' ? e.name : '' }))
  return out.length ? out : null
}

/* ---------------------------------------------------------------- */
/* A chain against a unit's palette                                  */
/* ---------------------------------------------------------------- */

/**
 * The palette entries a chain asks for: the nth mention of a family takes
 * the nth of that family the unit lists, by instance. A family the unit
 * does not have, or has no more of, is in `missing` with its name, never
 * dropped without a word.
 */
export function resolveChain(blocks, palette) {
  const byFamily = new Map()
  for (const e of Array.isArray(palette) ? palette : []) {
    const f = familyOf(e)
    if (!f) continue
    if (!byFamily.has(f)) byFamily.set(f, [])
    byFamily.get(f).push(e)
  }
  for (const list of byFamily.values()) list.sort((a, b) => (a.instance || 0) - (b.instance || 0))
  const used = new Map()
  const picks = []
  const missing = []
  for (const raw of Array.isArray(blocks) ? blocks : []) {
    const f = familyKey(raw)
    if (!f || ENDS.includes(f)) continue
    const nth = (used.get(f) || 0) + 1
    used.set(f, nth)
    const entry = byFamily.get(f)?.[nth - 1]
    if (entry) picks.push({ ...entry, family: f })
    else missing.push({ family: f, nth, name: nth > 1 ? `${familyName(f)} ${nth}` : familyName(f) })
  }
  return { picks, missing }
}

/* ---------------------------------------------------------------- */
/* Bare, and the plan                                                */
/* ---------------------------------------------------------------- */

const END_NAME = /^\s*(input|output|in|out)\s*\d*\s*$/i
const endOf = (cell, palette) => {
  const listed = (palette || []).find((e) => Number.isInteger(e?.page) && e.page === cell.effectId && ENDS.includes(familyOf(e)))
  if (listed) return familyOf(listed)
  if (ENDS.includes(cell.slug)) return cell.slug
  if (!cell.block && !cell.unknown && END_NAME.test(cell.name || '')) return /^\s*in/i.test(cell.name) ? 'input' : 'output'
  return null
}

/**
 * Nothing in the preset but its Input and Output. A bare wire (shunt) is not
 * a block; a block newer than the app IS one. Quick build is only offered,
 * and only planned, on a bare preset.
 */
export function isBare(cells, blocks, palette = []) {
  const map = gridMap(cells, blocks, {})
  return map.cells.every((c) => c.kind === CELL.shunt || (!c.unknown && endOf(c, palette) !== null))
}

/** The same question of the chain read alone (Play's and Edit's, before the grid is read). */
export const isBareChain = (blocks) =>
  (Array.isArray(blocks) ? blocks : []).every((b) => b && !b.unknown && b.slug !== '' && b.slug != null && ENDS.includes(b.slug))

const cable = (srcRow, srcCol, destRow, connect = true) => ({ kind: 'cable', srcRow, srcCol, destRow, connect })
const place = (row, col, blockId, name) => ({ kind: 'place', row, col, blockId, name })
const clear = (row, col, name) => ({ kind: 'clear', row, col, name })

const listedEnd = (palette, end) =>
  (palette || []).filter((e) => familyOf(e) === end && Number.isInteger(e.page)).sort((a, b) => (a.instance || 0) - (b.instance || 0))[0] || null

/**
 * THE ROW A CHAIN GOES ON where the preset has no Input or Output to say:
 * the second (row index 1), where factory presets keep theirs, and on a
 * SIX-ROW unit (FM9, Axe-Fx III) the THIRD.
 *
 * Why the third. On 15 November 2026 Quick build put an Input, two blocks and
 * an Output on row 2 of an empty preset on Justin's Axe-Fx III and sent the
 * cables; every message was taken, and the read back showed all four blocks
 * and the row not joined at its first cable. The message that joins two
 * cells was wrong for a six-row unit's row 2 (mobile/src/lib/gen3-grid.js
 * has the whole of it): it named another cell. Along rows 3 and 4 the old
 * message and the corrected one are the same bytes, so a chain there does
 * not depend on which computer app sends them, and a player's may well be
 * from before the correction. Row 3 of the two, the nearer to the second,
 * where a chain used to go. SEEN TO JOIN ONCE: Justin's Axe-Fx III, from
 * the phone over a WIDI Master, read back "6 in, 0 not; connected" on row 3
 * (report 913f344a, 16 November 2026). Through a computer app, and on an
 * FM9, not seen yet.
 */
export const homeRow = (rows) => (rows >= 6 ? 2 : rows > 1 ? 1 : 0)

/**
 * Where the blocks go, without the steps: the row, the Input's and Output's
 * columns (and whether each is placed here), and the free cells between.
 */
function layout({ cells, shape = {}, palette = [], blocks = [] }) {
  const map = gridMap(cells, blocks, shape)
  const free = (row, col) => {
    const c = map.at(row, col)
    return !c || c.kind === CELL.shunt
  }
  if (shape.linear) {
    const row = map.cells.length ? map.cells[0].row : 0
    const cols = []
    for (let c = 0; c < (shape.cols ?? 4); c++) if (free(row, c)) cols.push(c)
    return { ok: true, map, linear: true, row, cols, room: cols.length }
  }
  const ends = map.cells.filter((c) => c.kind === CELL.block).map((c) => ({ c, end: endOf(c, palette) }))
  const input = ends.find((x) => x.end === 'input')?.c || null
  const output = ends.find((x) => x.end === 'output')?.c || null
  if (input && output && input.row !== output.row) return { ok: false, why: ENDS_APART }
  const rows = map.rows
  const row = input ? input.row : output ? output.row : homeRow(rows)
  const inEntry = !input ? listedEnd(palette, 'input') : null
  const outEntry = !output ? listedEnd(palette, 'output') : null
  let inCol = input ? input.col : null
  const placeInput = !input && inEntry && free(row, 0) && (!output || output.col > 0)
  if (placeInput) inCol = 0
  const start = inCol === null ? 0 : inCol + 1
  const end = output ? output.col : map.cols
  const cols = []
  for (let c = start; c < end; c++) if (free(row, c)) cols.push(c)
  const room = output || !outEntry ? cols.length : Math.max(0, cols.length - 1)
  return {
    ok: true,
    map,
    linear: false,
    row,
    cols,
    room,
    input: input ? { col: input.col, placed: false } : placeInput ? { col: 0, placed: true, entry: inEntry } : null,
    output: output ? { col: output.col, placed: false } : outEntry ? { col: null, placed: true, entry: outEntry } : null,
    /* The top row of a six-row grid: its cables are a case nobody has decoded (setParam's buildSetGridRouting throws there). */
    top: rows >= 6 && row === 0
  }
}

/** How many blocks fit: the free cells (or slots), less one for an Output the app places. */
export function buildRoom({ cells, shape = {}, palette = [], blocks = [] }) {
  const l = layout({ cells, shape, palette, blocks })
  return l.ok ? l.room : 0
}

/** Why nothing can be built here, in words, or null when something can: an empty row with no room is not "as many blocks as the row has room for". */
export function buildBlocked({ cells, shape = {}, palette = [], blocks = [] }) {
  const l = layout({ cells, shape, palette, blocks })
  return !l.ok ? l.why : l.room ? null : NO_ROOM
}

/**
 * THE PLAN: every place first (the Input, the picks left to right, the
 * Output), then the cables left to right, one out of every column from the
 * first block's to the one before the last, so the unit has a block in a
 * cell before a cable to it means anything (planParallel does the same).
 * Never a cable out of the last column, never one from before the first.
 *
 * A cable the grid read shows already there is skipped, but only into a
 * cell this plan leaves alone: a cell it places into is joined again, since
 * whether the unit keeps a bare wire's joins under a new block is not known.
 *
 * `undo` puts the preset back as the grid read showed it (undoSteps).
 * `prior` is every cable that read showed into or out of a cell the plan
 * places into: the wiring that was the preset's own, which the build sends
 * again and the Undo must not take out.
 */
export function planBuild({ cells, shape = {}, palette = [], picks = [], blocks = [] } = {}) {
  const wanted = Array.isArray(picks) ? picks : []
  if (!wanted.length) return { ok: false, why: NO_PICKS }
  if (wanted.some((p) => !Number.isInteger(p?.page))) return { ok: false, why: NOT_LISTED }
  if (!isBare(cells, blocks, palette)) return { ok: false, why: NOT_BARE }
  const l = layout({ cells, shape, palette, blocks })
  if (!l.ok) return l
  if (!l.room) return { ok: false, why: NO_ROOM }
  const row = l.row
  const fits = wanted.slice(0, l.room)
  const left = wanted.slice(l.room).map((p) => p.name || familyName(familyOf(p)))
  const placed = []
  const was = {}
  const put = (col, entry, end = false) => {
    const prior = l.map.at(row, col)
    if (prior?.kind === CELL.shunt && Number.isInteger(prior.effectId)) was[`${row}:${col}`] = prior.effectId
    placed.push({ row, col, blockId: entry.page, name: entry.name || familyName(familyOf(entry)), family: familyOf(entry), end })
  }
  if (!l.linear && l.input?.placed) put(l.input.col, l.input.entry, true)
  fits.forEach((p, i) => put(l.cols[i], p))
  let outCol = l.output?.col ?? null
  if (!l.linear && l.output?.placed) {
    outCol = l.cols[fits.length]
    put(outCol, l.output.entry, true)
  }
  const steps = placed.map((p) => place(p.row, p.col, p.blockId, p.name))
  /*
   * WHETHER THE READ SHOWS THE WIRING AT ALL. A chain read with no `fromRows`
   * on a cell (an older computer app, a driver that does not decode routing)
   * says nothing of which cables are there, so none of the cables the build
   * sends is known to be new: `wiringKnown` false, and the Undo cuts none.
   */
  const wiringKnown = l.linear || l.map.cells.filter((c) => c.row === row).every((c) => Array.isArray(c.fromRows))
  /* The preset's own cables at the cells placed into: into each (from any row of the column before), and out of each (into any row of the column after). */
  const prior = []
  if (!l.linear) {
    const cols = new Set(placed.map((p) => p.col))
    for (const c of l.map.cells) {
      if (!Array.isArray(c.fromRows) || c.col < 1) continue
      for (const r of c.fromRows) {
        if (!Number.isInteger(r)) continue
        if ((c.row === row && cols.has(c.col)) || (r === row && cols.has(c.col - 1))) prior.push({ srcRow: r, srcCol: c.col - 1, destRow: c.row })
      }
    }
  }
  let joined = false
  let joinNote = l.linear ? 'linear' : null
  if (!l.linear) {
    const first = l.input ? l.input.col : placed[0].col
    const last = outCol !== null ? outCol : placed[placed.length - 1].col
    if (l.top) joinNote = 'top'
    else {
      const into = new Set(placed.map((p) => p.col))
      for (let c = first; c < last; c++) {
        const next = l.map.at(row, c + 1)
        if (!into.has(c + 1) && Array.isArray(next?.fromRows) && next.fromRows.includes(row)) continue
        steps.push(cable(row, c, row))
      }
      joined = !!(l.input && l.output)
      if (!joined) joinNote = 'ends'
    }
  }
  /* Where the join runs, when the plan makes one: from the Input's column to the Output's (joinBreak reads the chain back along it). */
  const span = joined ? { first: l.input.col, last: outCol } : null
  const plan = { ok: true, row, rows: l.map.rows, linear: l.linear, steps, placed, was, prior, wiringKnown, joined, joinNote, span, left }
  plan.undo = undoSteps(plan)
  return plan
}

const cableKey = (c) => `${c.srcRow}:${c.srcCol}:${c.destRow}`
const ranPlaces = (plan, done) => (plan?.steps || []).slice(0, Math.max(0, done)).filter((s) => s.kind === 'place')
/* The preset's own cables at the cells a run got as far as placing into (plan.prior, cut down to those cells). */
function priorTouched(plan, done) {
  const at = new Set(ranPlaces(plan, done).map((s) => `${s.row}:${s.col}`))
  return (plan?.prior || []).filter((c) => at.has(`${c.destRow}:${c.srcCol + 1}`) || at.has(`${c.srcRow}:${c.srcCol}`))
}
/*
 * A cable the app cannot make: out of the top row of a six-row grid from an
 * even column as the unit counts them (from one), which is an odd one here
 * (lib/gen3-grid cableKnown, and the codec refuses the same). The other
 * half of that row's cables it can make, so they are joined again like any.
 */
const unmakeable = (plan, c) => (plan?.rows ?? 0) >= 6 && c.srcRow === 0 && c.srcCol % 2 === 1

/**
 * The way back from the first `done` steps of a plan (all of them by
 * default): a run that stopped part-way is taken back only as far as it got.
 *
 * BACK TO WHAT THE PRESET WAS, NOT TO NOTHING. The usual empty preset is an
 * Input, a row of bare wires joined end to end, and an Output; the build
 * sends its cables over those joins, and an Undo that cut every cable the
 * build sent left that preset silent with "Took the blocks back out" over
 * it. So, in order: the cables the build ADDED are cut, right to left
 * (never one the grid read showed already there); each cell goes back to
 * its bare wire, or is cleared; and then the preset's own cables at those
 * cells are joined again, left to right, since nobody knows whether a unit
 * keeps a cell's cables through a block put in it and taken out.
 */
export function undoSteps(plan, done = plan?.steps?.length ?? 0) {
  const ran = (plan?.steps || []).slice(0, Math.max(0, done))
  const own = new Set((plan?.prior || []).map(cableKey))
  const out = []
  /* Where the read did not show the wiring, no cable is known to be the build's own, and none is cut (planBuild `wiringKnown`). */
  if (plan?.wiringKnown !== false) for (const s of ran.filter((s) => s.kind === 'cable' && s.connect).reverse()) if (!own.has(cableKey(s))) out.push(cable(s.srcRow, s.srcCol, s.destRow, false))
  for (const s of ran.filter((s) => s.kind === 'place').reverse()) {
    const shunt = plan.was?.[`${s.row}:${s.col}`]
    out.push(Number.isInteger(shunt) ? place(s.row, s.col, shunt, 'the bare wire') : clear(s.row, s.col, s.name))
  }
  const again = priorTouched(plan, done)
    .filter((c) => !unmakeable(plan, c))
    .sort((a, b) => a.srcCol - b.srcCol || a.srcRow - b.srcRow || a.destRow - b.destRow)
  for (const c of again) out.push(cable(c.srcRow, c.srcCol, c.destRow))
  return out
}

/**
 * After an Undo, in the chain as the unit has just read it back: the first
 * column where a cable the preset had before the build is not there (its
 * cell empty, or not fed from that row). Null when the wiring is back.
 */
export function undoUnjoined(plan, cellsAfter, done = plan?.steps?.length ?? 0) {
  const cells = Array.isArray(cellsAfter) ? cellsAfter : []
  let first = null
  for (const c of priorTouched(plan, done)) {
    const cell = cells.find((x) => x && x.row === c.destRow && x.col === c.srcCol + 1)
    if (cell && Array.isArray(cell.fromRows) && cell.fromRows.includes(c.srcRow)) continue
    if (first === null || c.srcCol + 1 < first) first = c.srcCol + 1
  }
  return first
}

/**
 * Before an Undo: whether a cell the build placed into now holds a block
 * that is NOT the one it placed (swapped at the unit's front panel, or from
 * the computer's window, since). An Undo run over that would take out a
 * block the build never put there. The placed block, a bare wire or an
 * empty cell are all the build's own doing or undoing.
 */
export function undoStale(plan, cellsNow, done = plan?.steps?.length ?? 0) {
  const cells = Array.isArray(cellsNow) ? cellsNow : []
  const sent = new Set(ranPlaces(plan, done).map((s) => `${s.row}:${s.col}`))
  return (plan?.placed || []).some((p) => {
    if (!sent.has(`${p.row}:${p.col}`)) return false
    const cell = cells.find((c) => c && c.row === p.row && c.col === p.col)
    return !!cell && !cell.isShunt && cell.effectId !== p.blockId
  })
}

/** How many of the picked blocks (the ends not counted) a run got as far as sending. */
export const sentBlocks = (plan, done = plan?.steps?.length ?? 0) => {
  const sent = new Set(ranPlaces(plan, done).map((s) => `${s.row}:${s.col}`))
  return (plan?.placed || []).filter((p) => !p.end && sent.has(`${p.row}:${p.col}`)).length
}

/* ---------------------------------------------------------------- */
/* What landed                                                       */
/* ---------------------------------------------------------------- */

const holds = (cells, p) => (Array.isArray(cells) ? cells : []).some((c) => c && c.row === p.row && c.col === p.col && !c.isShunt && c.effectId === p.blockId)

/**
 * WHERE THE JOIN STOPS, in the chain as the unit has just read it back: the
 * first column after the Input's whose cell holds nothing, or is not fed
 * from this row. Null when the row is joined all the way to the Output, or
 * when the plan made no join to check (a linear unit, the top row, no
 * Input or Output). A read that carries no `fromRows` for a cell is a cell
 * not shown to be joined.
 */
export function joinBreak(plan, cellsAfter) {
  if (!plan?.joined || !plan.span) return null
  const cells = Array.isArray(cellsAfter) ? cellsAfter : []
  const at = (col) => cells.find((c) => c && c.row === plan.row && c.col === col)
  /* The two ends have to BE there: a bare wire, or nothing, where the Input or the Output should be is a row with no sound however well it is fed. */
  const input = at(plan.span.first)
  if (!input || input.isShunt) return plan.span.first
  for (let col = plan.span.first + 1; col <= plan.span.last; col++) {
    const cell = at(col)
    if (!cell || !Array.isArray(cell.fromRows) || !cell.fromRows.includes(plan.row)) return col
    if (col === plan.span.last && cell.isShunt) return col
  }
  return null
}

/**
 * THE PLAN'S ROW AS THE UNIT READ IT BACK, for the log and nowhere else: each
 * cell from the first the plan cares about to the last, and which rows of the
 * column before feed it. The card says only where the row FIRST stops; a log
 * that says the same cannot tell one cable that did not take from three, and
 * that is the difference between a message the unit dropped and a message
 * that was wrong (his 15 November log could not say). Empty for a linear
 * unit, whose slots have no cables.
 */
export function rowAsRead(plan, cellsAfter) {
  if (!plan || plan.linear || !Array.isArray(cellsAfter)) return ''
  /*
   * EVERY CELL THE PLAN TOUCHED: the ones it placed into, and both ends of
   * every cable it sent. Not `span` alone, which a plan has only when it
   * joins the Input to the Output: a preset with an Input and no Output (or
   * the other way round) still has its cables sent, from the Input's column
   * or on to the Output's, and the cells those reach are the ones a log is
   * read for.
   */
  const cols = (plan.placed || []).map((p) => p.col)
  for (const step of plan.steps || []) if (step.kind === 'cable' && step.srcRow === plan.row && step.destRow === plan.row) cols.push(step.srcCol, step.srcCol + 1)
  if (plan.span) cols.push(plan.span.first, plan.span.last)
  const whole = cols.filter((c) => Number.isInteger(c))
  if (!whole.length) return ''
  const first = Math.min(...whole)
  const last = Math.max(...whole)
  const parts = []
  for (let col = first; col <= last; col++) {
    const cell = cellsAfter.find((c) => c && c.row === plan.row && c.col === col)
    if (!cell) {
      parts.push(`column ${colLabel(col)} empty`)
      continue
    }
    const what = cell.isShunt ? 'a bare wire' : cell.name || `block ${cell.effectId}`
    /* Only whole row numbers are said: anything else in the list is a read the app does not understand, and is said as that. */
    const rows = Array.isArray(cell.fromRows) ? cell.fromRows.filter((r) => Number.isInteger(r)) : null
    const fed = rows === null || rows.length !== cell.fromRows.length ? 'feed not read' : rows.length ? `fed from row ${rows.map((r) => rowLabel(r)).join(' and ')}` : 'fed from nothing'
    /* The first cell is where the row starts (the Input, or the first block of a row with none): nothing the plan sent feeds it. */
    parts.push(`column ${colLabel(col)} ${what}${col === first ? '' : ` (${fed})`}`)
  }
  return `row ${rowLabel(plan.row)} as read: ${parts.join(', ')}`
}

/**
 * A fresh grid read against the plan: which blocks are in their cells and
 * which are not, and the words for it. `done` is how many of the plan's
 * steps ran (a run that stopped part-way only asks after what was sent).
 */
export function whatLanded(plan, cellsAfter, done = plan?.steps?.length ?? 0) {
  /* No read at all (null: the unit did not answer) is not "nothing landed". */
  if (!Array.isArray(cellsAfter)) return { all: false, none: false, unread: true, joined: false, landed: [], missing: [], tone: 'warn', title: NOT_READ_TITLE, text: NOT_READ }
  const stops = joinBreak(plan, cellsAfter)
  const joined = !!plan?.joined && stops === null
  const sent = new Set(
    (plan?.steps || [])
      .slice(0, done)
      .filter((s) => s.kind === 'place')
      .map((s) => `${s.row}:${s.col}`)
  )
  const asked = (plan?.placed || []).filter((p) => sent.has(`${p.row}:${p.col}`))
  const landed = asked.filter((p) => holds(cellsAfter, p))
  const missing = asked.filter((p) => !holds(cellsAfter, p))
  const blocksIn = landed.filter((p) => !p.end)
  const cols = blocksIn.map((p) => p.col)
  /* None of the picked blocks is in ("the other 0 blocks are in" is not a sentence). An Input or Output the app placed may be, and then that is said, with the Undo that takes it back out. */
  if (!blocksIn.length) {
    const endsIn = landed.filter((p) => p.end).map((p) => p.name)
    /* A run that stopped before any picked block was sent: the unit refused nothing, and is not said to have. */
    if (!asked.some((p) => !p.end)) return { all: false, none: true, joined: false, landed, missing, tone: 'fault', title: NONE_ADDED_TITLE, text: stoppedEarlyLine(endsIn) }
    if (endsIn.length) return { all: false, none: true, joined: false, landed, missing, tone: 'fault', title: NO_BLOCKS_TITLE, text: endsPutLine(endsIn) }
    return { all: false, none: true, joined: false, landed, missing, tone: 'fault', title: NONE_ADDED_TITLE, text: NONE_ADDED }
  }
  if (!missing.length) {
    /* Every block is in, and the plan was to join them: "connected" only if the chain read back shows it. */
    if (plan.joined && !joined) return { all: true, none: false, joined: false, stops, landed, missing, tone: 'warn', title: NOT_JOINED_TITLE, text: notJoinedLine(blocksIn.length, plan.row, stops) }
    return {
      all: true,
      none: false,
      joined,
      landed,
      missing,
      tone: 'ok',
      title: joined ? BUILT_JOINED : BUILT_ONLY,
      text: builtLine({ count: blocksIn.length, row: plan.row, cols, linear: plan.linear, joined, why: plan.joinNote })
    }
  }
  const broken = plan.joined && stops !== null ? stops : null
  const lostBlocks = missing.filter((p) => !p.end).map((p) => p.name)
  const lostEnds = missing.filter((p) => p.end).map((p) => p.name)
  /* Only an end is missing: its own words, never the CPU sentence. */
  if (!lostBlocks.length) return { all: false, none: false, joined: false, stops: broken, landed, missing, tone: 'warn', title: notAddedTitle(lostEnds), text: endMissingLine(lostEnds, blocksIn.length) }
  const also = lostEnds.length ? ` ${notAddedTitle(lostEnds)} either.` : ''
  return { all: false, none: false, joined, stops: broken, landed, missing, tone: 'warn', title: notAddedTitle(lostBlocks), text: `${notAddedLine(lostBlocks, blocksIn.length, joined, broken)}${also}` }
}

/** After an Undo: what is still in a cell the build placed into. */
export function stillIn(plan, cellsAfter) {
  return (plan?.placed || []).filter((p) => holds(cellsAfter, p))
}
