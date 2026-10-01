import { useEffect, useState } from 'react'
import { clearCell, placeBlock, readGrid, setCable } from '../lib/forgefx'
import { logDebug } from '../lib/debugLog'
import { blockColor } from '../lib/blockColors'
import { shortBlock } from '../lib/shortName'
import { doubtfulWrite, gridShape } from '../../shared/grid-plan.mjs'
import {
  CELL,
  branchAt,
  branches,
  gridMap,
  joins,
  layoutsAround,
  mainRow,
  planRemoveBranch,
  runPlan,
  stepWords,
  usedRows
} from '../../shared/split-chain.mjs'

/* The map's measurements, the phone's: a cell, the gap a join is drawn in, the space between rows. */
const W = 58
const H = 42
const GAP = 16
const ROW_GAP = 12

/**
 * ROWS AND SPLITS — the phone's components/RowsPanel, in the browser.
 *
 * Every row the preset uses, scrolled sideways together, with a line wherever
 * one cell feeds the next: along a row, or stepping between rows where the
 * chain splits and mixes back. Tap a block on the main row for what can be laid
 * out around it; tap one on a second row to take that path away. The cables
 * are worked out by shared/split-chain.mjs, the same copy the phone runs, and
 * the chain is read back from the unit afterwards.
 */
export default function RowsPanel({ blocks, capabilities, palette, busy, onChanged, onError }) {
  const [cells, setCells] = useState(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [running, setRunning] = useState(false)
  const [said, setSaid] = useState(null)

  const read = async () => {
    try {
      const got = await readGrid()
      setCells(Array.isArray(got?.cells) ? got.cells : [])
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }
  const shapeKey = (blocks || []).map((b) => `${b.effectId}@${b.row}:${b.col}`).join(',')
  useEffect(() => {
    let live = true
    readGrid()
      .then((got) => {
        if (!live) return
        setCells(Array.isArray(got?.cells) ? got.cells : [])
        setFailed(false)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [shapeKey])

  const map = gridMap(cells || [], blocks, gridShape(capabilities))
  const main = mainRow(map)
  const rows = usedRows(map)
  const { edges, known } = joins(map)
  const paths = branches(map)
  const lastCol = Math.max(0, ...map.cells.map((c) => c.col))
  const cell = picked ? map.at(picked.row, picked.col) : null
  const onPath = cell ? branchAt(map, cell.row) : null

  const run = async (steps, done) => {
    setRunning(true)
    setSaid(null)
    setConfirm(null)
    try {
      const res = await runPlan(steps, { setCable, placeBlock, clearCell })
      for (const step of steps) logDebug('chain', `rows: ${stepWords(step)}`, '')
      onChanged?.(res.ok ? done : 'Rows changed in part')
      await read()
      setPicked(null)
      if (!res.ok) {
        setSaid({ tone: 'fault', text: `Stopped at “${stepWords(res.failed)}” — ${res.error}. The chain has been read again, so what is drawn is what the unit holds.` })
      } else if (res.doubtful) {
        setSaid({ tone: 'warn', text: doubtfulWrite({ ok: false }) })
      } else {
        setSaid({ tone: 'ok', text: done })
      }
    } catch (err) {
      setSaid({ tone: 'fault', text: err?.message || String(err) })
      onError?.(err?.message)
    } finally {
      setRunning(false)
    }
  }

  const y = (row) => rows.indexOf(row) * (H + ROW_GAP)
  const x = (col) => col * (W + GAP)

  return (
    <div className="rows-panel">
      <p className="silk-label">Rows and splits</p>

      {cells === null && !failed ? <p className="hint">Reading how the rows are joined…</p> : null}
      {failed ? (
        <p className="chain-issue">
          The unit didn&rsquo;t say how its rows are joined.{' '}
          <button type="button" className="chip" onClick={read}>
            Try again
          </button>
        </p>
      ) : null}

      {cells !== null ? (
        <div className="rows-map-scroll">
          <div
            className="rows-map"
            style={{ width: x(lastCol) + W, height: Math.max(1, rows.length) * (H + ROW_GAP) - ROW_GAP }}
          >
            {edges.map((e, i) => {
              if (rows.indexOf(e.fromRow) < 0 || rows.indexOf(e.toRow) < 0) return null
              const left = x(e.col - 1) + W
              const y1 = y(e.fromRow) + H / 2
              const y2 = y(e.toRow) + H / 2
              if (e.fromRow === e.toRow) {
                return <span key={i} className="rows-line" style={{ left, top: y1 - 1, width: GAP, height: 2 }} />
              }
              return (
                <span key={i}>
                  <span className="rows-line split" style={{ left, top: y1 - 1, width: GAP / 2, height: 2 }} />
                  <span
                    className="rows-line split"
                    style={{ left: left + GAP / 2 - 1, top: Math.min(y1, y2) - 1, width: 2, height: Math.abs(y2 - y1) + 2 }}
                  />
                  <span className="rows-line split" style={{ left: left + GAP / 2, top: y2 - 1, width: GAP / 2, height: 2 }} />
                </span>
              )
            })}
            {map.cells.map((c) => {
              if (rows.indexOf(c.row) < 0) return null
              if (c.kind === CELL.shunt) {
                return (
                  <span
                    key={`${c.row}:${c.col}`}
                    className="rows-line"
                    style={{ left: x(c.col), top: y(c.row) + H / 2 - 1, width: W, height: 2 }}
                  />
                )
              }
              const hue = blockColor(c.slug)
              const chosen = picked && picked.row === c.row && picked.col === c.col
              return (
                <button
                  type="button"
                  key={`${c.row}:${c.col}`}
                  className={`rows-cell${chosen ? ' chosen' : ''}${c.block?.bypassed ? ' off' : ''}`}
                  style={{ left: x(c.col), top: y(c.row), width: W, height: H, background: hue.fill, color: hue.ink }}
                  aria-label={`${c.name || c.slug}, row ${c.row + 1}, column ${c.col + 1}`}
                  aria-pressed={!!chosen}
                  onClick={() => {
                    setConfirm(null)
                    setSaid(null)
                    setPicked(chosen ? null : { row: c.row, col: c.col })
                  }}
                >
                  {c.block ? shortBlock(c.block) : (c.name || '?').slice(0, 4).toUpperCase()}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {cells !== null && !known ? (
        <p className="chain-issue">
          This computer doesn&rsquo;t report how the rows are joined, so the lines are a guess. Update
          the app on the computer.
        </p>
      ) : null}

      {cells !== null
        ? paths.map((p) => (
            <p key={p.row} className="hint">
              Row {p.row + 1} runs beside column{p.start === p.end ? ` ${p.start + 1}` : `s ${p.start + 1}–${p.end + 1}`}
              {p.blocks.length ? ` with ${p.blocks.map((b) => b.name).join(', ')}` : ' as a dry signal'}
              {p.open ? ' — but it isn’t joined at both ends, so it makes no sound.' : '.'}
            </p>
          ))
        : null}

      {cells !== null && !picked ? (
        <p className="hint">Tap a block to run something beside it, or tap a block on a second row to take that path away.</p>
      ) : null}

      {cell && cell.row === main && !confirm
        ? (() => {
            const choices = layoutsAround(map, cell, palette)
            if (!choices.length) {
              return (
                <p className="hint">
                  Nothing can be split around {cell.name || 'this block'} — the ends of the chain and the looper
                  stay on the main row.
                </p>
              )
            }
            return (
              <div className="rows-choices">
                {choices.map((choice) => (
                  <button
                    type="button"
                    key={choice.key}
                    className="rows-choice"
                    disabled={!choice.plan.ok || running || busy}
                    onClick={() => setConfirm({ kind: 'layout', choice })}
                  >
                    <strong>{choice.label}</strong>
                    <span>{choice.plan.ok ? choice.sub : choice.plan.why}</span>
                  </button>
                ))}
              </div>
            )
          })()
        : null}

      {cell && onPath && !confirm ? (
        <div className="rows-choices">
          <button
            type="button"
            className="rows-choice"
            disabled={running || busy}
            onClick={() => setConfirm({ kind: 'remove', plan: planRemoveBranch(map, onPath.row) })}
          >
            <strong>Remove this parallel path</strong>
            <span>
              Row {onPath.row + 1}
              {onPath.blocks.length ? ` and ${onPath.blocks.map((b) => b.name).join(', ')} on it` : ''}
            </span>
          </button>
        </div>
      ) : null}

      {confirm ? (
        <div className="rows-confirm" role="alertdialog" aria-label="Change the rows">
          <p>
            {confirm.kind === 'remove'
              ? confirm.plan.losing.length
                ? `This takes out ${confirm.plan.losing.join(', ')} and the path ${confirm.plan.losing.length === 1 ? 'it is' : 'they are'} on. ${confirm.plan.losing.length === 1 ? 'Its settings go' : 'Their settings go'} with ${confirm.plan.losing.length === 1 ? 'it' : 'them'}.`
                : 'This takes the dry path away. The main row plays on as it was.'
              : `${confirm.choice.label}. ${confirm.choice.sub}. Nothing is saved until you press Save.`}
          </p>
          <div className="history-actions">
            <button
              type="button"
              className="primary"
              disabled={running}
              onClick={() =>
                confirm.kind === 'remove'
                  ? run(confirm.plan.steps, 'Done — that path is gone.')
                  : run(confirm.choice.plan.steps, `Done — row ${confirm.choice.plan.row + 1} now runs beside it.`)
              }
            >
              {running ? 'Working…' : confirm.kind === 'remove' ? 'Remove it' : 'Do it'}
            </button>
            <button type="button" className="chip" disabled={running} onClick={() => setConfirm(null)}>
              Keep it
            </button>
          </div>
        </div>
      ) : null}

      {said ? (
        <p className={said.tone === 'fault' ? 'chain-issue' : 'hint'} role="status">
          {said.text}
        </p>
      ) : null}
    </div>
  )
}
