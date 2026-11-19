/*
 * THE AMP SWAPPED FOR A NAM BLOCK, ON THE UNIT (lib/ampToNam has the rules
 * and the words). The chain editor's own calls and nothing else: the grid
 * read, a block put in a cell, a cable.
 */
import { useBluetoothAdmin } from './bluetooth'
import { gridCells, idOf, placeBlock, setCable } from './device'
import { logDebug } from './debugLog'
import { AMP_TO_NAM_FOR_EVERYONE } from './features'
import { beginChainWrite, endChainWrite, getState, refreshBlocks } from './rig'
import { missingJoins } from './chain-move'
import { namToPlace, SWAP_HAS_NAM, SWAP_MOVED, SWAP_NO_AMP, SWAP_NOT_READ, swapPlan, swapRefused, swapUnit, swapUnjoined } from './ampToNam'

/** Whether this account is offered the swap: his, by the sign-in kept on the device, until lib/features AMP_TO_NAM_FOR_EVERYONE. */
export const useAmpToNam = () => {
  const his = useBluetoothAdmin()
  return AMP_TO_NAM_FOR_EVERYONE || his
}

/**
 * Put a NAM block where `block` (an amp) is. Answers `{ ok: true, id, note }`
 * with the NAM block's id (and a note where a cable could not be joined
 * again), or `{ ok: false, words }` with nothing more to do.
 */
export async function swapAmpForNam(block) {
  const unit = swapUnit(getState().deviceSlug)
  const ampId = idOf(block)
  const n = getState().preset?.number
  const say = (what, how) => logDebug('chain', `amp to NAM: ${what}`, how)
  if (!unit || !Number.isInteger(ampId)) return { ok: false, words: SWAP_NO_AMP }
  let cells
  try {
    cells = await gridCells()
  } catch (err) {
    say('the preset was not read', err?.message || 'failed')
    return { ok: false, words: SWAP_NOT_READ }
  }
  if (getState().preset?.number !== n) return { ok: false, words: SWAP_MOVED }
  const plan = swapPlan(cells, ampId)
  if (!plan) {
    say(`block ${ampId} is not on the grid as read`, 'nothing sent')
    return { ok: false, words: SWAP_NO_AMP }
  }
  const nam = namToPlace(unit, cells)
  if (nam === null) {
    say('the preset already has its NAM block', 'nothing sent')
    return { ok: false, words: SWAP_HAS_NAM }
  }
  beginChainWrite()
  try {
    const r = await placeBlock(plan.row, plan.col, nam)
    say(`block ${nam} put where block ${ampId} was, row ${plan.row + 1} column ${plan.col + 1}`, r?.ok === true ? 'ok' : r?.refused ? `refused: ${r.refused}` : 'no answer')
    let after = await gridCells().catch(() => null)
    const landed = Array.isArray(after) && after.some((c) => c && c.row === plan.row && c.col === plan.col && c.effectId === nam)
    say('the cell as read back', landed ? 'holds the NAM block' : Array.isArray(after) ? 'does not hold it' : 'not read')
    if (!landed) return { ok: false, words: swapRefused(unit) }
    /* The row joined through it as it was through the amp: only the cables the read shows gone, and only where the unit has cables at all. */
    let unjoined = 0
    if (unit !== 'am4' && plan.joins.length) {
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
    return { ok: true, id: nam, note: unjoined ? swapUnjoined(unjoined) : '' }
  } catch (err) {
    say('failed', err?.message || 'failed')
    return { ok: false, words: err?.message || swapRefused(unit) }
  } finally {
    endChainWrite({ refresh: false })
    await refreshBlocks({ quiet: true }).catch(() => {})
  }
}
