import { useState } from 'react'
import { blockCatalog, clearCell, placeBlock, readGrid, setCable } from '../lib/forgefx'
import { logDebug } from '../lib/debugLog'
import { doubtfulWrite, gridShape } from '../../shared/grid-plan.mjs'
import { gridMap, mainRow, planLooper, runPlan, stepWords } from '../../shared/split-chain.mjs'

/**
 * ADD A LOOPER, IN ONE TAP — the phone's components/LooperAtEnd, here.
 *
 * At the end of the chain, right before the Output, joined in on both sides:
 * shared/split-chain.mjs's planLooper works out the place, the same copy the
 * phone runs. A looper found off the chain is moved, after a question.
 */
export default function LooperAtEnd({ blocks, capabilities, palette, busy, onChanged, onError, onAdded }) {
  const [running, setRunning] = useState(false)
  const [said, setSaid] = useState(null)
  const [asking, setAsking] = useState(null)
  const looper = (blocks || []).find((b) => b.slug === 'looper')
  const already = !!looper
  /* In the chain already: nothing to offer. Off it, on a row joined to nothing: offered a move. */
  const inChain = already && looper.row === mainRow(gridMap([], blocks))

  const run = async (plan) => {
    setAsking(null)
    setRunning(true)
    try {
      const res = await runPlan(plan.steps, { setCable, placeBlock, clearCell })
      for (const step of plan.steps) logDebug('chain', `looper: ${stepWords(step)}`, '')
      const done = `Looper added at column ${plan.col + 1}, at the end of the chain. Nothing is saved until you press Save.`
      onChanged?.(res.ok ? 'Added a looper at the end of the chain' : 'The looper was added in part')
      if (!res.ok) setSaid({ bad: true, text: `Stopped at “${stepWords(res.failed)}” — ${res.error}. The chain has been read again.` })
      else if (res.doubtful) setSaid({ bad: true, text: doubtfulWrite({ ok: false }) })
      else {
        setSaid({ bad: false, text: done })
        onAdded?.(plan)
      }
    } catch (err) {
      setSaid({ bad: true, text: err?.message || String(err) })
      onError?.(err?.message)
    } finally {
      setRunning(false)
    }
  }

  const go = async () => {
    setSaid(null)
    let cells = []
    try {
      const got = await readGrid()
      cells = Array.isArray(got?.cells) ? got.cells : []
    } catch {
      /* The chain read still says where every block is; only the wires are a guess. */
    }
    let list = palette
    if (!Array.isArray(list) || !list.length) list = await blockCatalog().catch(() => [])
    const plan = planLooper(gridMap(cells, blocks, gridShape(capabilities)), list)
    if (!plan.ok) return setSaid({ bad: !plan.here, text: plan.why })
    if (plan.moved) return setAsking(plan)
    run(plan)
  }

  if (inChain && !said) return null

  return (
    <div className="looper-at-end">
      <button type="button" className="chip" disabled={busy || running || inChain} onClick={go}>
        {running ? 'Adding the looper…' : inChain ? 'The looper is in the chain' : already ? 'Put the looper at the end of the chain' : 'Add a looper'}
      </button>
      <span className="hint"> At the end of the chain, right before the Output.</span>
      {asking ? (
        <div className="rows-confirm" role="alertdialog" aria-label="Move the looper">
          <p>
            The looper is on a row that is not joined to the chain, so it makes no sound there. Moving it to the end of
            the chain resets its settings.
          </p>
          <div className="history-actions">
            <button type="button" className="primary" onClick={() => run(asking)}>
              Move it
            </button>
            <button type="button" className="chip" onClick={() => setAsking(null)}>
              Keep it
            </button>
          </div>
        </div>
      ) : null}
      {said ? (
        <p className={said.bad ? 'chain-issue' : 'hint'} role="status">
          {said.text}
        </p>
      ) : null}
    </div>
  )
}
