/**
 * THE LIST OF BLOCKS TO ADD, IN THE CHAIN EDITOR: a menu that opens and
 * scrolls (components/BlockMenu), not a wall of buttons.
 *
 * "In edit, make picking blocks to add a drop down scroll menu" (Justin, 15
 * November 2026, with a picture of an Axe-Fx III's list: forty-five buttons
 * in a dozen wrapped rows, two screens of them under every card whose Add
 * was tapped, and the one he had picked, NAM 1, at the very end). The list
 * was the unit's own order, which is by the unit's numbers and not by name:
 * Vocoder, Crossover, Tone Match, IR Player, Dynamic Distortion and NAM came
 * after Wah.
 *
 * So: one button that says the block picked, and opens the list over the
 * page (the app's sheet, as a block's list settings open theirs). In the
 * list, one row for each block, by name, with the find box staying at the
 * top while the rows scroll under it.
 *
 * What is here is the part a test can run: which blocks are listed, in what
 * order, and the words on the button.
 */

/** The button's name, over the block it is on. */
export const BLOCK_TO_ADD = 'Block to add'
/** On the button while nothing is picked. */
export const NONE_PICKED = 'Pick a block'
/** The find box at the top of the list. */
export const FIND_A_BLOCK = 'Find a block'
/** In the list's place when nothing is named like what was typed. */
export const NOTHING_FOUND = 'No block named like that.'
/** The most a search lists: every block of every number is in the unit's list, and nobody scrolls two hundred rows. */
export const FIND_MOST = 40

/* "Drive 2" is ["drive", 2]; "Looper" is ["looper", 0]. */
const parts = (name) => {
  const m = /^(.*?)(?:\s+(\d+))?$/.exec(String(name || '').trim())
  return [m[1].toLowerCase(), m[2] ? Number(m[2]) : 0]
}

/**
 * By name, and by number where the name is the same: Drive 2 before Drive
 * 10, which a plain sort of the words puts the other way round. Written out
 * rather than left to the phone's own sorting, so the list is in one order
 * on every phone.
 */
export const byName = (a, b) => {
  const [wordsA, numberA] = parts(a?.name)
  const [wordsB, numberB] = parts(b?.name)
  return wordsA < wordsB ? -1 : wordsA > wordsB ? 1 : numberA - numberB
}

/**
 * The rows of the menu. With nothing typed: one of each kind of block, the
 * next the chain has not used (`kinds`, the editor's own rule: Drive 2 once
 * Drive 1 is in). With something typed: every block whose name has it,
 * numbers and all, as the find box always did. Either way by name, and
 * never a block twice.
 *
 * @param {{ page: number, name: string }[]|null} palette  every block the unit can add
 * @param {{ page: number, name: string }[]|null} kinds    one of each kind
 * @param {string} [find]  what is typed in the find box
 */
export function blocksListed(palette, kinds, find = '') {
  const needle = String(find || '').trim().toLowerCase()
  const from = needle ? (palette || []).filter((b) => String(b?.name || '').toLowerCase().includes(needle)) : kinds || []
  const seen = new Set()
  const once = from.filter((b) => b && !seen.has(b.page) && seen.add(b.page))
  const sorted = [...once].sort(byName)
  return needle ? sorted.slice(0, FIND_MOST) : sorted
}

/** The block picked, out of the unit's list, by its page; null for none, or one the unit does not list. */
export const pickedOf = (palette, chosen) => (chosen === null || chosen === undefined ? null : (palette || []).find((b) => b.page === Number(chosen)) || null)

/** What the button says under its name: the block picked, or that none is, and the mark of a list that opens. */
export const menuSaid = (picked) => `${picked?.name || NONE_PICKED} ▾`

/** The button, to a screen reader: what it is for, what it is on, and that it opens a list. */
export const menuLabel = (label, picked) => `${label}: ${picked?.name || 'none picked'}. Opens a list.`
