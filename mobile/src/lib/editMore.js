/*
 * EDIT IS FOR TURNING KNOBS: THE REST IS ONE TAP AWAY.
 *
 * "I kind of want this to mainly be to edit knob presets quickly, and I feel
 * like that these four other buttons are just taking up space on the screen,
 * and we can move those somewhere else somehow." Then, shown the mockups
 * (docs/edit-more/): "Yes, I like those. Go ahead and implement that."
 * (Justin, 10 November 2026.)
 *
 * So Edit opens on a block, its knobs already on the screen (`firstOpen`),
 * and the four buttons that sat under the knobs (Amp & pedal names, Edit
 * chain, Modifiers, Rename preset and scenes) are in one More button beside
 * Done, with the beta note. Find a control is the magnifier beside it. And
 * three of them have a shortcut where a player would look for them: the
 * preset's name renames, the ＋ tile at the end of the chain edits it, the
 * i beside a model opens Amp & pedal names on that model (`gearStart`), and
 * a knob held still (`HOLD_MS`) opens Modifiers on that knob.
 *
 * Nothing here imports anything, so a test runs it as it is.
 */

/** The More sheet's title, and its rows' words: the words the buttons on the page had. */
export const MORE_TITLE = 'More in Edit'
export const MORE_ROWS = {
  chain: { label: 'Edit chain', sub: 'Add, move or remove blocks in this preset' },
  modifiers: { label: 'Modifiers', sub: 'Let a pedal or your playing move a control' },
  rename: { label: 'Rename preset and scenes', sub: 'Names you will know on a dark stage' },
  gear: { label: 'Amp & pedal names', sub: 'What each model on your unit really is' }
}

/** The tile at the end of the chain strip that opens Edit chain. */
export const CHAIN_TILE = { label: '+', sub: 'Chain' }

/** The two round buttons' names, for VoiceOver and TalkBack. */
export const FIND_LABEL = 'Find a control'
export const MORE_LABEL = 'More: edit chain, modifiers, rename, amp and pedal names'

/** The ends of a chain, which have no knobs worth opening first. */
const ENDS = ['input', 'output']

/**
 * The block Edit opens on by itself, so knobs are on the screen before
 * anything is tapped: the one last open in this preset (`kept`) while it is
 * still in the chain, else the amp, else the first block that is not an
 * end. `list` is [{ id, slug }] in chain order. Null with nothing to open.
 */
export function firstOpen(list = [], kept = null) {
  const blocks = Array.isArray(list) ? list.filter((b) => b && b.id !== null && b.id !== undefined) : []
  if (kept !== null && kept !== undefined && blocks.some((b) => b.id === kept)) return kept
  const amp = blocks.find((b) => b.slug === 'amp')
  if (amp) return amp.id
  const other = blocks.find((b) => !ENDS.includes(b.slug))
  return other ? other.id : null
}

/** The kinds of block Amp & pedal names has a page for (src/lib/gearCatalog GEAR_FAMILIES). */
export const GEAR_KINDS = ['amp', 'drive', 'cab', 'wah', 'comp', 'delay']

/** Where the i beside a model opens Amp & pedal names: that kind's list, on that model. Null for a kind it has no page for. */
export function gearStart(slug, name) {
  const model = String(name || '').trim()
  return GEAR_KINDS.includes(slug) && model ? { family: slug, name: model } : null
}

/**
 * A knob held still this long, without moving more than HOLD_SLOP points,
 * opens Modifiers on it. Longer than a phone's own long press (half a
 * second), so a thumb that lands and pauses before it turns is not taken
 * for a hold.
 */
export const HOLD_MS = 700
export const HOLD_SLOP = 6
