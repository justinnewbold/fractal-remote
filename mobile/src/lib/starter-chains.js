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
export const JOINING = 'Joining the row…'
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
export const undoSub = (n) => (n === 1 ? 'Takes the block back out' : `Takes the ${n} blocks back out`)
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
  return `${where}. There is no Input or Output on that row to join them to, so add one in Edit chain before you play.`
}

/** A block the unit did not take, when the others are in. */
export const notAddedTitle = (names) => `${names.join(' and ')} ${names.length === 1 ? 'was' : 'were'} not added`
export function notAddedLine(names, others, joined) {
  const it = names.length === 1 ? 'it' : 'them'
  const rest = others === 1 ? `The other block is in${joined ? ' and connected' : ''}.` : `The other ${others} blocks are in${joined ? ' and connected' : ''}.`
  return `${notAddedTitle(names)}. The unit did not take ${it}, which usually means the preset has no room left for ${it} (CPU). ${rest}`
}
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
export const NOT_READ = 'The blocks were sent, but the unit did not answer when the app read the chain back, so the app can’t say what landed. Open the preset again to see.'
export const NONE_ADDED_TITLE = 'Nothing was added'
export const NONE_ADDED = 'The unit did not take any of the blocks. The chain has been read again.'

/** A family the unit does not have, or has no more of. */
export const missingLine = (names) =>
  `This unit has no ${names.join(', ')} to add, so ${names.length === 1 ? 'it is' : 'they are'} left out.`
/** Picks that did not fit in the row or the slots. */
export const leftLine = (names) => `No room for ${names.join(', ')}, so ${names.length === 1 ? 'it was' : 'they were'} left out.`

export const NOT_BARE = 'This preset is not empty any more, so Quick build did nothing. Nothing was changed.'
export const NO_PICKS = 'Pick at least one block.'
export const ENDS_APART = 'The Input and the Output are on different rows, so there is no one row to build along. Use Edit chain instead.'
export const NO_ROOM = 'There is no free cell between the Input and the Output.'
export const NOT_LISTED = 'The unit did not list one of these blocks. Read the preset again and try once more.'
export const READ_FAILED = 'The unit did not answer when the app asked what is in this preset. Nothing was changed.'

/** A step that threw part-way: which, and that nothing more went. */
export const stoppedLine = (step, error) =>
  `Stopped at “${stepWords(step)}”: ${error || 'no answer'}. Nothing more was sent, and the chain has been read again.`

/* An Undo whose read back did not come: what is still in is not known, and "took them out" is not said. */
export const UNDO_NOT_READ = 'Undo was sent, but the unit did not answer when the app read the chain back, so the app can’t say it is all out. Open the preset again to see.'
export const undoneLine = (n) => (n === 1 ? 'Took the block back out.' : `Took the ${n} blocks back out.`)
export const undoMissedLine = (names) => `Undo did not take everything back out: ${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} still in. The chain has been read again.`

/** Every word above that a player reads, for the test that holds them. */
export const SHOWN_WORDS = () => [
  QUICK_BUILD_TITLE, QUICK_BUILD_SUB, QUICK_BUILD_HOW, NOTHING_SAVED, YOUR_CHAIN, BLOCKS_HEAD, MORE_CHIP, CHAIN_NONE_YET,
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
  READ_FAILED, stoppedLine({ kind: 'place', row: 1, col: 2, name: 'Amp' }, 'no answer'), undoneLine(1), undoneLine(5),
  undoMissedLine(['Amp']), UNDO_NOT_READ
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
  for (const fam of paletteFamilies(palette)) {
    const mentions = []
    list.forEach((f, i) => {
      if (f === fam.family) mentions.push(i)
    })
    const shown = Math.min(fam.count, mentions.length + 1)
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
  const row = input ? input.row : output ? output.row : rows > 1 ? 1 : 0
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
 * `undo` takes it back out exactly: the cables it connected cut, right to
 * left, then each cell it placed into, right to left, given back its bare
 * wire if it had one, else cleared.
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
  const plan = { ok: true, row, linear: l.linear, steps, placed, was, joined, joinNote, span, left }
  plan.undo = undoSteps(plan)
  return plan
}

/**
 * The way back from the first `done` steps of a plan (all of them by
 * default): a run that stopped part-way is taken back only as far as it got.
 */
export function undoSteps(plan, done = plan?.steps?.length ?? 0) {
  const ran = (plan?.steps || []).slice(0, Math.max(0, done))
  const out = []
  for (const s of ran.filter((s) => s.kind === 'cable' && s.connect).reverse()) out.push(cable(s.srcRow, s.srcCol, s.destRow, false))
  for (const s of ran.filter((s) => s.kind === 'place').reverse()) {
    const shunt = plan.was?.[`${s.row}:${s.col}`]
    out.push(Number.isInteger(shunt) ? place(s.row, s.col, shunt, 'the bare wire') : clear(s.row, s.col, s.name))
  }
  return out
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
  for (let col = plan.span.first + 1; col <= plan.span.last; col++) {
    const cell = cells.find((c) => c && c.row === plan.row && c.col === col)
    if (!cell || !Array.isArray(cell.fromRows) || !cell.fromRows.includes(plan.row)) return col
  }
  return null
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
  if (!landed.length) return { all: false, none: true, joined: false, landed, missing, tone: 'fault', title: NONE_ADDED_TITLE, text: NONE_ADDED }
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
  const names = missing.map((p) => p.name)
  return { all: false, none: false, joined, landed, missing, tone: 'warn', title: notAddedTitle(names), text: notAddedLine(names, blocksIn.length, joined) }
}

/** After an Undo: what is still in a cell the build placed into. */
export function stillIn(plan, cellsAfter) {
  return (plan?.placed || []).filter((p) => holds(cellsAfter, p))
}
