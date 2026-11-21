/*
 * A HELD PEDAL SWAPPED FOR ANOTHER, FROM ITS OWN HOLD POP-UP. Pure: a test
 * runs it.
 *
 * "It would be nice to be able to swap pedals out from the screen as well
 * ... pulls up a list" (Justin's report 9361e16b, 21 November 2026, of the
 * quick-edit pop-ups). The amp could already be swapped for a NAM block
 * there (lib/ampToNam); this is any block for any other the unit can add.
 *
 * WHAT IS SENT is what the chain editor sends: the chosen block put in the
 * held block's own cell (or AM4 slot), and where the unit has cables, the
 * ones into and out of that cell again where the read after shows them
 * gone. Nothing new on the wire, so it is offered exactly where the chain
 * editor is.
 *
 * THE HELD BLOCK AND ITS SETTINGS LEAVE THE PRESET, which is said before
 * anything is sent. Nothing is saved.
 */
import { chainEditorHere } from './chainOnWire.js'

const ENDS = new Set(['input', 'output'])

/**
 * Whether the pop-up for `block` offers the swap: an account it is open to,
 * where the chain editor is (never a VP4, never another preset's chain,
 * over Bluetooth only where the wire says the editor is there), on a unit
 * that places blocks (`gridEdit`), and a block with a number of its own
 * that is not an end of the chain or one the editor only holds.
 */
export const swapBlockFor = ({ allowed = false, block = null, id = null, vp4 = false, viaBle = false, caps = null, elsewhere = false } = {}) =>
  allowed === true &&
  !!block &&
  Number.isInteger(id) &&
  !ENDS.has(block.slug) &&
  block.fixed !== true &&
  block.noControls !== true &&
  caps?.gridEdit === true &&
  chainEditorHere({ vp4, viaBle, caps, elsewhere })

/** What the list shows with nothing typed: the first of each kind the preset does not hold (a unit has one of each block). */
export function swapKinds(palette, used) {
  const held = used instanceof Set ? used : new Set(used || [])
  const seen = new Set()
  const out = []
  for (const b of palette || []) {
    const kind = b.family || b.slug || b.name
    if (seen.has(kind) || held.has(b.page)) continue
    seen.add(kind)
    out.push(b)
  }
  return out
}

/** Every block the list may offer at all: the unit's, less the ones the preset holds already (a search shows numbers and all). */
export const swapList = (palette, used) => {
  const held = used instanceof Set ? used : new Set(used || [])
  return (palette || []).filter((b) => Number.isInteger(b?.page) && !held.has(b.page))
}

/* The words. */
export const SWAP_BLOCK_LABEL = 'Swap for another pedal'
export const swapBlockSub = (name) => `Puts another block in ${name || 'this block'}’s place`
export const swapBlockTitle = (name) => `Swap ${name || 'this block'} for…`
export const SWAP_BLOCK_NOTE = 'Pick the block that takes its place'
export const SWAP_BLOCK_FIND = 'Find a block'
export const SWAP_BLOCK_NONE = 'No block named like that.'
export const SWAP_BLOCK_READING = 'Asking your unit what it can add…'
export const SWAP_BLOCK_NO_LIST = 'Couldn’t read the list of blocks from your unit.'
export const SWAPPING_BLOCK = 'Swapping…'
export const swapBlockAsk = (name, to) => ({
  title: `Swap ${name || 'this block'} for ${to || 'the block'}?`,
  body: `${name || 'This block'} and its settings leave this preset, and ${to || 'the block'} goes in its place. Nothing is saved until you save the preset.`,
  yes: 'Swap',
  no: 'Cancel'
})
export const SWAP_BLOCK_GONE = 'The app couldn’t find this block in the preset as the unit has it now. Nothing was changed.'
export const SWAP_BLOCK_NOT_READ = 'The unit didn’t answer when the app asked what is in the preset. Nothing was changed.'
export const SWAP_BLOCK_MOVED = 'The unit is on another preset now. Nothing was changed.'
export const swapBlockHeld = (to) => `This preset already has ${to || 'that block'}. Nothing was changed.`
export const swapBlockRefused = (name, to) => `The unit didn’t take ${to || 'the block'}. ${name || 'The old block'} may be out of the preset: load the preset again to bring it back.`
export const swapBlockUnjoined = (to, n) => `${to || 'The block'} is in, but the app couldn’t join ${n === 1 ? 'one cable' : `${n} cables`} to it, so there may be no sound. Open Edit chain and tap Join the row.`
