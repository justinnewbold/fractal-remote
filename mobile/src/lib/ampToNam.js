/*
 * AN AMP SWAPPED FOR A NAM BLOCK, FROM THE AMP'S OWN HOLD POP-UP. Pure: a
 * test runs it.
 *
 * "Let's make it so holding the amp button down shows TONE3000 just like the
 * NAM block when you hold it down. and you can switch out the amp block out
 * directly to a NAM block. Build that for AX3 and AM4" (Justin, 19 November
 * 2026). A capture plays in a NAM block, so the way from an amp to a
 * capture is the NAM block put where the amp was: the same cell of the
 * grid, or the same slot of an AM4, with the row joined through it as it
 * was through the amp.
 *
 * WHAT IS SENT is what the chain editor sends: a block put in a cell (the
 * NAM block's own number in the amp's place), and on an Axe-Fx III the
 * cables into and out of that cell again where the read after shows them
 * gone. Nothing new on the wire.
 *
 * THE AMP AND ITS SETTINGS LEAVE THE PRESET, which is said before anything
 * is sent. Nothing is saved: the preset is saved the usual way, and loading
 * it again brings the amp back.
 */
import { AM4_NAM_BLOCKS } from './am4-nam.js'
import { NAM_BLOCKS } from './nam-install.js'

/** The unit, by the rig's slug for it: the two that have a NAM block. */
export const swapUnit = (deviceSlug) => {
  const s = String(deviceSlug || '').toLowerCase()
  return s === 'am4' ? 'am4' : s === 'axefxiii' ? 'axefx3' : null
}

/** Whether the pop-up for `block` offers the swap: an amp, on a unit with a NAM block, for an account it is open to. */
export const ampToNamFor = (allowed, block, deviceSlug) => allowed === true && !!block && block.slug === 'amp' && swapUnit(deviceSlug) !== null

/**
 * The NAM block to put in: the unit's first that the preset does not hold
 * already (a unit has one of each). An AM4 is given its first only: nobody
 * places its second. Null where there is none to give.
 */
export function namToPlace(unit, cells) {
  const held = new Set((cells || []).map((c) => c?.effectId))
  if (unit === 'am4') return AM4_NAM_BLOCKS.some((id) => held.has(id)) ? null : AM4_NAM_BLOCKS[0]
  if (unit === 'axefx3') return NAM_BLOCKS.find((id) => !held.has(id)) ?? null
  return null
}

/**
 * Where the amp is and how its cell is joined, off a grid read: `{ row, col,
 * joins }`, the joins as lib/chain-move writes them ({ srcRow, srcCol,
 * destRow }): each row of the column before that feeds the cell, and each
 * cell of the column after that this one feeds. Null where the read does
 * not have the block.
 */
export function swapPlan(cells, ampId) {
  const list = Array.isArray(cells) ? cells : []
  const at = list.find((c) => c && c.effectId === ampId)
  if (!at) return null
  const joins = []
  for (const r of Array.isArray(at.fromRows) ? at.fromRows : []) if (Number.isInteger(r)) joins.push({ srcRow: r, srcCol: at.col - 1, destRow: at.row })
  for (const c of list) if (c && c.col === at.col + 1 && Array.isArray(c.fromRows) && c.fromRows.includes(at.row)) joins.push({ srcRow: at.row, srcCol: at.col, destRow: c.row })
  return { row: at.row, col: at.col, joins }
}

/* The words. */
export const SWAP_LABEL = 'Swap for a NAM block'
export const SWAP_SUB = 'Puts a NAM block in this amp’s place, then opens the captures to choose one'
export const SWAPPING = 'Swapping…'
export const swapAsk = (name) => ({
  title: `Swap ${name || 'the amp'} for a NAM block?`,
  body: `${name || 'The amp'} and its settings leave this preset, and a NAM block goes in its place. Nothing is saved until you save the preset.`,
  yes: 'Swap',
  no: 'Keep the amp'
})
export const SWAP_HAS_NAM = 'This preset already has a NAM block. Hold it to choose a capture.'
export const SWAP_NO_AMP = 'The app couldn’t find the amp in the preset as the unit has it now. Nothing was changed.'
export const SWAP_NOT_READ = 'The unit didn’t answer when the app asked what is in the preset. Nothing was changed.'
export const SWAP_MOVED = 'The unit is on another preset now. Nothing was changed.'
export const swapRefused = (unit) => `The ${unit === 'am4' ? 'AM4' : 'Axe-Fx III'} didn’t take the NAM block. On an AM4 that needs firmware 3.00 or later. The amp may be out of the preset: load the preset again to bring it back.`
export const swapUnjoined = (n) => `The NAM block is in, but the app couldn’t join ${n === 1 ? 'one cable' : `${n} cables`} to it, so there may be no sound. Open Edit chain and tap Join the row.`
