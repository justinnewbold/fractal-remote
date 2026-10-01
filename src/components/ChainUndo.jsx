import { useEffect, useState } from 'react'
import {
  blockParams,
  clearCell,
  placeBlock,
  presetBlocks,
  readGrid,
  setCable,
  setEnum,
  setParam,
  setParamConfirmed,
  setType
} from '../lib/forgefx'
import { logDebug } from '../lib/debugLog'
import { gridShape } from '../../shared/grid-plan.mjs'
import { modelSnapshot, restoreModel } from '../../shared/model-undo.mjs'
import { UNDO_STALE, gridMap, planPutBack, putBackWords, runPlan, stepWords, takeOutWords } from '../../shared/split-chain.mjs'

/*
 * UNDO FOR THE LAST CHAIN CHANGE — the phone's, in the browser.
 *
 * A block swiped out, or a looper put in, can be taken back with one click
 * until another preset is loaded or the chain is changed again. Shared plan
 * and words: shared/split-chain.mjs. The phone's: mobile/src/components/ChainUndo.
 */

const SAID_FOR_MS = 10000

const at = (list, row, col) => (list || []).some((b) => b.row === row && b.col === col)
const looperAt = (list, row, col) => (list || []).some((b) => b.slug === 'looper' && b.row === row && b.col === col)

/** What a block taken out would need to go back, read while it is still there. */
export async function readPutBack(row, col, capabilities, blocks) {
  let cells = []
  try {
    const got = await readGrid()
    cells = Array.isArray(got?.cells) ? got.cells : []
  } catch {
    /* The chain read still says where it is; only the wires are a guess. */
  }
  const back = planPutBack(gridMap(cells, blocks, gridShape(capabilities)), row, col)
  if (!back.ok) return null
  const read = await blockParams(back.effectId).catch(() => null)
  return { kind: 'put', back, snap: modelSnapshot(read, { channel: null }) }
}

export function useChainUndo({ blocks, number, onChanged }) {
  const [undo, setUndo] = useState(null)
  const [said, setSaid] = useState(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!said || said.bad) return undefined
    const t = setTimeout(() => setSaid((now) => (now === said ? null : now)), SAID_FOR_MS)
    return () => clearTimeout(t)
  }, [said])

  /* Only for the preset it was made on. */
  const live = undo && undo.n === number ? undo : null

  const offer = (u) => {
    setSaid(null)
    setUndo(u ? { ...u, n: number } : null)
  }

  const run = async () => {
    const u = live
    if (!u || running) return
    setSaid(null)
    const stale = u.kind === 'put' ? at(blocks, u.back.row, u.back.col) : !looperAt(blocks, u.row, u.col)
    if (stale) {
      setUndo(null)
      setSaid({ bad: true, text: UNDO_STALE })
      return
    }
    setRunning(true)
    let words
    try {
      const steps = u.kind === 'put' ? u.back.steps : u.steps
      const res = await runPlan(steps, { setCable, placeBlock, clearCell })
      for (const step of steps) logDebug('chain', `undo: ${stepWords(step)}`, '')
      const now = await presetBlocks().catch(() => null)
      if (u.kind === 'put') {
        const landed = !!now && at(now, u.back.row, u.back.col)
        let kept = null
        if (res.ok && landed && u.snap) {
          const eid = u.back.effectId
          const r = await restoreModel(u.snap, {
            channel: null,
            setType: (v) => setType(eid, v),
            read: () => blockParams(eid),
            write: (p, v) => setParam(eid, p.id, v, p),
            writeEnum: (id, v) => setEnum(eid, id, v),
            writeChecked: (p, v) => setParamConfirmed(eid, p.id, v, p)
          })
          kept = !r.refused && !r.stopped && !r.unchecked && !(r.missed || []).length
        }
        words = putBackWords(u.back.name, { res, landed, kept })
      } else {
        words = takeOutWords(u.name, { res, gone: !!now && !looperAt(now, u.row, u.col) })
      }
      onChanged?.(words.bad ? 'Undo of the last chain change, in part' : `Undo: ${words.text}`)
    } catch (err) {
      words = { bad: true, text: err?.message || String(err) }
    } finally {
      setRunning(false)
      setUndo(null)
    }
    logDebug('chain', 'undo', words.text)
    setSaid(words)
  }

  const bar =
    live || said ? (
      <div className="chain-undo">
        {live ? (
          <button type="button" className="chip" disabled={running} onClick={run}>
            {running ? 'Undoing…' : `Undo — ${live.label}`}
          </button>
        ) : null}
        {said ? (
          <p className={said.bad ? 'chain-issue' : 'hint'} role="status">
            {said.text}
          </p>
        ) : null}
      </div>
    ) : null

  return { offer, clear: () => setUndo(null), running, bar }
}
