/*
 * A HELD PEDAL SWAPPED FOR ANOTHER, ON THE UNIT (lib/swapBlock has the
 * rules and the words). The chain editor's own calls and nothing else: the
 * list of blocks, the grid read, a block put in a cell, a cable.
 */
import { overBluetooth } from './bleSwitch'
import { useBluetoothAdmin } from './bluetooth'
import { blockCatalog, gridCells, idOf, placeBlock, setCable, vp4Here } from './device'
import { logDebug } from './debugLog'
import { SWAP_BLOCK_FOR_EVERYONE } from './features'
import { beginChainWrite, endChainWrite, getState, noteEdited, refreshBlocks, useRig } from './rig'
import { missingJoins } from './chain-move'
import { swapPlan } from './ampToNam'
import { ownPaletteHere } from './ownBlocksHere'
import { SWAP_BLOCK_GONE, SWAP_BLOCK_MOVED, SWAP_BLOCK_NOT_READ, swapBlockFor, swapBlockHeld, swapBlockRefused, swapBlockUnjoined } from './swapBlock'

const ofCaps = (s) => s.capabilities

/** Whether the pop-up for `block` offers the swap here: his account, by the sign-in kept on the device, until lib/features SWAP_BLOCK_FOR_EVERYONE. */
export function useSwapBlock(block, elsewhere = false) {
  const his = useBluetoothAdmin()
  const caps = useRig(ofCaps)
  return swapBlockFor({ allowed: SWAP_BLOCK_FOR_EVERYONE || his, block, id: block ? idOf(block) : null, vp4: vp4Here(), viaBle: overBluetooth(caps), caps, elsewhere })
}

/** The blocks the unit can add, as the chain editor lists them (the unit's own blocks the phone names included). */
export const swapPalette = async () => ownPaletteHere(await blockCatalog())

/**
 * Put `pick` (a row of the list: `{ page, name }`) where `block` is.
 * Answers `{ ok: true, id, note }` with the new block's id (and a note
 * where a cable could not be joined again), or `{ ok: false, words }`.
 */
export async function swapBlockNow(block, pick) {
  const oldId = idOf(block)
  const to = Number(pick?.page)
  const n = getState().preset?.number
  const say = (what, how) => logDebug('chain', `swap a pedal: ${what}`, how)
  if (!Number.isInteger(oldId) || !Number.isInteger(to) || to <= 0) return { ok: false, words: SWAP_BLOCK_GONE }
  let cells
  try {
    cells = await gridCells()
  } catch (err) {
    say('the preset was not read', err?.message || 'failed')
    return { ok: false, words: SWAP_BLOCK_NOT_READ }
  }
  if (getState().preset?.number !== n) return { ok: false, words: SWAP_BLOCK_MOVED }
  const plan = swapPlan(cells, oldId)
  if (!plan) {
    say(`block ${oldId} is not on the grid as read`, 'nothing sent')
    return { ok: false, words: SWAP_BLOCK_GONE }
  }
  /* A unit has one of each block: one the preset holds already would be moved out of its own cell, not added. */
  if ((cells || []).some((c) => c && c.effectId === to)) {
    say(`block ${to} is in the preset already`, 'nothing sent')
    return { ok: false, words: swapBlockHeld(pick?.name) }
  }
  const cables = getState().capabilities?.gridRouting === true
  beginChainWrite()
  try {
    const r = await placeBlock(plan.row, plan.col, to)
    say(`block ${to} put where block ${oldId} was, row ${plan.row + 1} column ${plan.col + 1}`, r?.ok === true ? 'ok' : r?.refused ? `refused: ${r.refused}` : 'no answer')
    let after = await gridCells().catch(() => null)
    const landed = Array.isArray(after) && after.some((c) => c && c.row === plan.row && c.col === plan.col && c.effectId === to)
    say('the cell as read back', landed ? 'holds the new block' : Array.isArray(after) ? 'does not hold it' : 'not read')
    if (!landed) return { ok: false, words: swapBlockRefused(block?.name, pick?.name) }
    noteEdited()
    /* The row joined through it as it was: only the cables the read shows gone, and only where the unit has cables at all. */
    let unjoined = 0
    if (cables && plan.joins.length) {
      const gone = missingJoins(after, plan.joins)
      say('cables', gone.length ? `${gone.length} of ${plan.joins.length} gone after the swap; joining them again` : `all ${plan.joins.length} kept`)
      for (const j of gone) {
        if (getState().preset?.number !== n) break
        await setCable(j.srcRow, j.srcCol, j.destRow, true).catch((err) => say('a cable was not sent', err?.message || 'failed'))
      }
      if (gone.length) {
        after = await gridCells().catch(() => null)
        unjoined = Array.isArray(after) ? missingJoins(after, plan.joins).length : gone.length
        say('cables after joining', unjoined ? `${unjoined} still missing` : 'all there')
      }
    }
    return { ok: true, id: to, note: unjoined ? swapBlockUnjoined(pick?.name, unjoined) : '' }
  } catch (err) {
    say('failed', err?.message || 'failed')
    return { ok: false, words: err?.message || swapBlockRefused(block?.name, pick?.name) }
  } finally {
    endChainWrite({ refresh: false })
    await refreshBlocks({ quiet: true }).catch(() => {})
  }
}
