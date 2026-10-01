import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { clearCell, gridCells, placeBlock, setCable } from '../lib/device'
import { beginChainWrite, endChainWrite, refreshBlocks } from '../lib/rig'
import { blockColor } from '../lib/blockColors'
import { shortBlock } from '../lib/shortName'
import { logDebug } from '../lib/debugLog'
import { tick } from '../lib/feedback'
import { gridShape, doubtfulWrite } from '../lib/grid-plan'
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
} from '../lib/split-chain'
import Note from './Note'
import Press from './Press'

/* The map's measurements: a cell, the gap a join is drawn in, and the space between rows. */
const W = 58
const H = 42
const GAP = 16
const ROW_GAP = 12
const LINE = 2

/**
 * ROWS AND SPLITS — the chain as the unit holds it, every row and every join.
 *
 * "Right now, we can only edit blocks in a single row … if we rethink the
 * mobile version, how could we implement that and still make it be a smooth,
 * functional easy mobile experience." Two halves:
 *
 *   - THE MAP. Each row the preset uses is a lane, scrolled sideways together,
 *     with a line wherever one cell feeds the next — straight along a row, or
 *     stepping up or down between rows where the chain splits and mixes back.
 *     It is drawn from what the unit reports (shared/split-chain.mjs), so a
 *     preset built in FM3-Edit looks here the way it looks there.
 *
 *   - THE CHANGES, as choices rather than wires. Dragging a cable from one
 *     small square to another is the one thing a thumb on a stage does badly,
 *     so a tapped block offers what can be laid out around it — a dry signal
 *     beside it, a second one of it beside it, a delay and reverb side by side
 *     — and a tapped block on a parallel path offers taking that path away.
 *     The app works out every cable; the unit is read back afterwards.
 *
 * Moving and adding blocks within a row stays in the lanes below, where it
 * always was.
 */
export default function RowsPanel({ blocks, caps, palette, onError }) {
  const [cells, setCells] = useState(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [running, setRunning] = useState(false)
  const [said, setSaid] = useState(null)

  /* Read again whenever the chain changes under it — an add, a move, another preset. */
  const shapeKey = (blocks || []).map((b) => `${b.effectId}@${b.row}:${b.col}`).join(',')
  const read = async () => {
    try {
      const got = await gridCells()
      setCells(got)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }
  useEffect(() => {
    let live = true
    gridCells()
      .then((got) => live && (setCells(got), setFailed(false)))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [shapeKey])

  const map = gridMap(cells || [], blocks, gridShape(caps))
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
    beginChainWrite()
    try {
      const res = await runPlan(steps, { setCable, placeBlock, clearCell })
      for (const step of steps) logDebug('chain', `rows: ${stepWords(step)}`, '')
      endChainWrite({ refresh: false })
      await refreshBlocks({ quiet: true })
      await read()
      setPicked(null)
      if (!res.ok) {
        setSaid({ tone: 'fault', text: `Stopped at “${stepWords(res.failed)}” — ${res.error}. The chain has been read again, so what is drawn is what the unit holds.` })
      } else if (res.doubtful) {
        setSaid({ tone: 'warn', text: doubtfulWrite({ ok: false }) })
      } else {
        setSaid({ tone: 'hint', text: done })
      }
    } catch (err) {
      endChainWrite()
      setSaid({ tone: 'fault', text: err?.message || String(err) })
      onError?.(err?.message)
    } finally {
      setRunning(false)
    }
  }

  /* Where each shown row sits on the map, by its grid row number. */
  const y = (row) => rows.indexOf(row) * (H + ROW_GAP)
  const x = (col) => col * (W + GAP)
  const mapWidth = x(lastCol) + W
  const mapHeight = Math.max(1, rows.length) * (H + ROW_GAP) - ROW_GAP

  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }}>
        Rows and splits
      </Text>

      {cells === null && !failed ? <Note>Reading how the rows are joined…</Note> : null}
      {failed ? (
        <Note tone="warn" onDismiss={() => setFailed(false)}>
          The unit didn’t say how its rows are joined. Pull down to read the chain again.
        </Note>
      ) : null}

      {cells !== null ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: space.lg }}>
          <View style={{ width: mapWidth, height: mapHeight }}>
            {/* The joins first, so the cells draw over their ends. */}
            {edges.map((e, i) => {
              if (rows.indexOf(e.fromRow) < 0 || rows.indexOf(e.toRow) < 0) return null
              const left = x(e.col - 1) + W
              const mid = left + GAP / 2
              const y1 = y(e.fromRow) + H / 2
              const y2 = y(e.toRow) + H / 2
              const ink = e.fromRow === e.toRow ? color.silkDim : color.signal
              if (e.fromRow === e.toRow) {
                return <View key={i} style={{ position: 'absolute', left, top: y1 - LINE / 2, width: GAP, height: LINE, backgroundColor: ink }} />
              }
              return (
                <View key={i} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
                  <View style={{ position: 'absolute', left, top: y1 - LINE / 2, width: GAP / 2, height: LINE, backgroundColor: ink }} />
                  <View
                    style={{
                      position: 'absolute',
                      left: mid - LINE / 2,
                      top: Math.min(y1, y2) - LINE / 2,
                      width: LINE,
                      height: Math.abs(y2 - y1) + LINE,
                      backgroundColor: ink
                    }}
                  />
                  <View style={{ position: 'absolute', left: mid, top: y2 - LINE / 2, width: GAP / 2, height: LINE, backgroundColor: ink }} />
                </View>
              )
            })}

            {map.cells.map((c) => {
              if (rows.indexOf(c.row) < 0) return null
              const top = y(c.row)
              const left = x(c.col)
              if (c.kind === CELL.shunt) {
                /* A bare wire through an empty cell. */
                return (
                  <View
                    key={`${c.row}:${c.col}`}
                    style={{ position: 'absolute', left, top: top + H / 2 - LINE / 2, width: W, height: LINE, backgroundColor: color.silkDim }}
                  />
                )
              }
              const hue = blockColor(c.slug)
              const chosen = picked && picked.row === c.row && picked.col === c.col
              return (
                <Pressable
                  key={`${c.row}:${c.col}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name || c.slug}, row ${c.row + 1}, column ${c.col + 1}`}
                  onPress={() => {
                    tick()
                    setConfirm(null)
                    setSaid(null)
                    setPicked(chosen ? null : { row: c.row, col: c.col })
                  }}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width: W,
                    height: H,
                    borderRadius: radius.sm,
                    backgroundColor: hue.fill,
                    borderWidth: chosen ? 3 : 0,
                    borderColor: color.signal,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: c.block?.bypassed ? 0.55 : 1
                  }}
                >
                  <Text numberOfLines={1} style={{ color: hue.ink, fontSize: font.small, fontWeight: '700' }}>
                    {c.block ? shortBlock(c.block) : (c.name || '?').slice(0, 4).toUpperCase()}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      ) : null}

      {cells !== null && !known ? (
        <Note tone="warn">This computer doesn’t report how the rows are joined, so the lines are a guess. Update the app on the computer.</Note>
      ) : null}

      {/* What is there, in words, under the picture. */}
      {cells !== null
        ? paths.map((p) => (
            <Text key={p.row} style={{ color: color.silkDim, fontSize: font.small, lineHeight: 20 }}>
              Row {p.row + 1} runs beside column{p.start === p.end ? ` ${p.start + 1}` : `s ${p.start + 1}–${p.end + 1}`}
              {p.blocks.length ? ` with ${p.blocks.map((b) => b.name).join(', ')}` : ' as a dry signal'}
              {p.open ? ' — but it isn’t joined at both ends, so it makes no sound.' : '.'}
            </Text>
          ))
        : null}

      {cells !== null && !picked ? (
        <Text style={{ color: color.silkFaint, fontSize: font.micro }}>
          Tap a block to run something beside it, or tap a block on a second row to take that path away.
        </Text>
      ) : null}

      {/* A block on the main row: what can be laid out around it. */}
      {cell && cell.row === main && !confirm
        ? (() => {
            const choices = layoutsAround(map, cell, palette)
            if (!choices.length) {
              return <Note>Nothing can be split around {cell.name || 'this block'} — the ends of the chain and the looper stay on the main row.</Note>
            }
            return (
              <View style={{ gap: space.sm }}>
                {choices.map((choice) => (
                  <Press
                    key={choice.key}
                    label={choice.label}
                    sub={choice.plan.ok ? choice.sub : choice.plan.why}
                    disabled={!choice.plan.ok || running}
                    onPress={() => setConfirm({ kind: 'layout', choice })}
                  />
                ))}
              </View>
            )
          })()
        : null}

      {/* A block on a parallel path: take the path away. */}
      {cell && onPath && !confirm ? (
        <Press
          label="Remove this parallel path"
          sub={`Row ${onPath.row + 1}${onPath.blocks.length ? ` and ${onPath.blocks.map((b) => b.name).join(', ')} on it` : ''}`}
          disabled={running}
          onPress={() => setConfirm({ kind: 'remove', plan: planRemoveBranch(map, onPath.row) })}
        />
      ) : null}

      {/* Asked once, in words, before anything is written. */}
      {confirm ? (
        <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.signal, backgroundColor: color.signalWash }}>
          <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 22 }}>
            {confirm.kind === 'remove'
              ? confirm.plan.losing.length
                ? `This takes out ${confirm.plan.losing.join(', ')} and the path ${confirm.plan.losing.length === 1 ? 'it is' : 'they are'} on. ${confirm.plan.losing.length === 1 ? 'Its settings go' : 'Their settings go'} with ${confirm.plan.losing.length === 1 ? 'it' : 'them'}.`
                : 'This takes the dry path away. The main row plays on as it was.'
              : `${confirm.choice.label}. ${confirm.choice.sub}. Nothing is saved until you press Save.`}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Press
              grow
              tone="signal"
              on
              label={running ? 'Working…' : confirm.kind === 'remove' ? 'Remove it' : 'Do it'}
              disabled={running}
              onPress={() =>
                confirm.kind === 'remove'
                  ? run(confirm.plan.steps, 'Done — that path is gone.')
                  : run(confirm.choice.plan.steps, `Done — row ${confirm.choice.plan.row + 1} now runs beside it.`)
              }
            />
            <Press grow label="Keep it" disabled={running} onPress={() => setConfirm(null)} />
          </View>
        </View>
      ) : null}

      {said ? (
        <Note tone={said.tone} onDismiss={() => setSaid(null)}>
          {said.text}
        </Note>
      ) : null}
    </View>
  )
}
