import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { color, font, space } from '../lib/theme'
import {
  blockParams,
  clearCell,
  gridCells,
  placeBlock,
  setCable,
  setEnum,
  setParam,
  setParamConfirmed,
  setType
} from '../lib/device'
import { beginChainWrite, endChainWrite, getState, refreshBlocks, useRig } from '../lib/rig'
import { logDebug } from '../lib/debugLog'
import { gridShape } from '../lib/grid-plan'
import { modelSnapshot, restoreModel } from '../lib/model-undo'
import { UNDO_STALE, gridMap, planPutBack, putBackWords, runPlan, stepWords, takeOutWords } from '../lib/split-chain'
import Press from './Press'

/*
 * UNDO FOR THE LAST CHAIN CHANGE.
 *
 * A swipe takes a block out in one movement, and a slip is quicker than a
 * swipe. So the last change to the chain — a block taken out, a looper put in
 * — can be taken back with one tap, until another preset is loaded or the
 * chain is changed again. Shared plan and words: shared/split-chain.mjs.
 */

/* How long a good "Put Drive 1 back" stays up. */
const SAID_FOR_MS = 10000

const ofNumber = (s) => s.preset?.number ?? null
const allBlocks = () => getState().allBlocks || []
const holds = (row, col) => allBlocks().some((b) => b.row === row && b.col === col)

/**
 * Read what a block taken out would need to go back — where it was, what fed
 * it, what it fed, and its settings — BEFORE it is taken out. Null when there
 * is nothing to put back with (the unit did not list it).
 */
export async function readPutBack(row, col, caps, blocks) {
  let cells = []
  try {
    cells = await gridCells()
  } catch {
    /* The chain read still says where it is; only the wires are a guess. */
  }
  const back = planPutBack(gridMap(cells, allBlocks().length ? allBlocks() : blocks, gridShape(caps)), row, col)
  if (!back.ok) return null
  const read = await blockParams(back.effectId).catch(() => null)
  return { kind: 'put', back, snap: modelSnapshot(read, { channel: null }) }
}

export function useChainUndo() {
  const n = useRig(ofNumber)
  const [undo, setUndo] = useState(null)
  const [said, setSaid] = useState(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!said || said.bad) return undefined
    const t = setTimeout(() => setSaid((now) => (now === said ? null : now)), SAID_FOR_MS)
    return () => clearTimeout(t)
  }, [said])

  /* Only for the preset it was made on. */
  const live = undo && undo.n === n ? undo : null

  const offer = (u) => {
    setSaid(null)
    setUndo(u ? { ...u, n: getState().preset?.number ?? null } : null)
  }

  const run = async () => {
    const u = live
    if (!u || running) return
    setUndo(null)
    setSaid(null)
    /* Another change since would have this write over it. */
    const stale = u.kind === 'put' ? holds(u.back.row, u.back.col) : !allBlocks().some((b) => b.slug === 'looper' && b.row === u.row && b.col === u.col)
    if (stale) {
      setUndo(null)
      setSaid({ bad: true, text: UNDO_STALE })
      return
    }
    setRunning(true)
    beginChainWrite()
    let words
    try {
      const steps = u.kind === 'put' ? u.back.steps : u.steps
      const res = await runPlan(steps, { setCable, placeBlock, clearCell })
      for (const step of steps) logDebug('chain', `undo: ${stepWords(step)}`, '')
      endChainWrite({ refresh: false })
      await refreshBlocks({ quiet: true })
      if (u.kind === 'put') {
        const landed = holds(u.back.row, u.back.col)
        let kept = null
        if (res.ok && landed && u.snap) {
          const eid = u.back.effectId
          const r = await restoreModel(u.snap, {
            channel: null,
            setType: (v) => setType(eid, v),
            read: () => blockParams(eid),
            write: (p, v) => setParam(eid, p.id, v, p),
            writeEnum: (id, v) => setEnum(eid, id, v),
            writeChecked: (p, v) => setParamConfirmed(eid, p.id, v, p),
            stillHere: () => (getState().preset?.number ?? null) === u.n
          })
          kept = !r.refused && !r.stopped && !r.unchecked && !(r.missed || []).length
        }
        words = putBackWords(u.back.name, { res, landed, kept })
      } else {
        words = takeOutWords(u.name, { res, gone: !allBlocks().some((b) => b.slug === 'looper' && b.row === u.row && b.col === u.col) })
      }
    } catch (err) {
      endChainWrite()
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
      <View style={{ gap: space.sm }}>
        {live ? <Press label={running ? 'Undoing…' : `Undo — ${live.label}`} disabled={running} onPress={run} /> : null}
        {said ? <Text style={{ color: said.bad ? color.fault : color.silkDim, fontSize: font.micro }}>{said.text}</Text> : null}
      </View>
    ) : null

  return {
    offer,
    clear: () => setUndo(null),
    running,
    bar
  }
}
