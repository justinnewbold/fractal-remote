import { useEffect, useMemo, useRef, useState } from 'react'
import { placeBlock, clearCell, readGrid, blockCatalog, wireRow, presetBlocks, setCable, blockParams, isDemo, currentPreset, servedLocally } from '../lib/forgefx'
import { linkState } from '../lib/link'
import { logDebug } from '../lib/debugLog'
import { blockPositions, landingIndex, reorderPlan } from '../../shared/lane-order.mjs'
import { CHAIN_CHANGED, JOIN_ROW, JOINING_ROW, afterMoveSaid, builtElsewhere, cablesLaid, joinRow, joinedWords, maybeCut, moveBlocks, oldCableBytes, rowCuts, rowNote } from '../../shared/chain-move.mjs'
import { chainPlan } from '../lib/actions'
import ChainWait, { useChain } from './ChainWait'
import RowsPanel from './RowsPanel'
import SwipeRow from './SwipeRow'
import LooperAtEnd from './LooperAtEnd'
import { readPutBack, useChainUndo } from './ChainUndo'
import {
  colLabel,
  doubtfulWrite,
  gapCols,
  gridShape,
  isSplitChain,
  laneItems,
  laneUsed,
  lanesShown,
  rowLabel
} from '../../shared/grid-plan.mjs'
import { NEW_BLOCK_NAME, NEW_BLOCK_NOTE, isNewBlock } from '../../shared/new-block.mjs'
import { ownInChainEditor, ownInPalette } from '../../shared/own-blocks.mjs'

/**
 * A workable starting chain, by block family rather than by number.
 *
 * Block type codes differ completely between an FM3 and an AM4, so the starter
 * resolves against the device's own palette. Anything the attached unit doesn't
 * offer is simply skipped.
 */
const STARTER_ORDER = ['drive', 'amp', 'cab', 'delay', 'reverb']

/**
 * The row a starter chain is built on (counted from nought). Everywhere but
 * a six-row grid: the second, as it always was. On a six-row grid (an FM9,
 * an Axe-Fx III): the row the preset's own Input is on, else its Output's,
 * and the third where it has neither. `buildStarter` says why.
 */
export const starterRow = ({ linear, rows, blocks }) => {
  if (linear || !(rows >= 6)) return 1
  const ends = blocks || []
  const end = ends.find((b) => b?.slug === 'input') || ends.find((b) => b?.slug === 'output')
  return Number.isInteger(end?.row) ? end.row : 2
}

/* The question Remove asks, in the phone's words — test/both-ends.mjs holds
   the two ends to the same sentence. */
const removeQuestion = (name) => `Remove ${name || 'this block'}?`
const REMOVE_WARNING = 'Its settings go with it. Adding it again brings it back with every knob at its default.'

/**
 * The chain, as a chain.
 *
 * This was a 4x12 grid of cells 940px wide, laid out on a canvas that scrolled
 * sideways on every screen and needed drag-and-drop — which does nothing at all
 * on iOS — to move anything. On a 390px phone you saw three cells of forty-eight
 * and had to scroll to find the one you wanted, and every error printed at the
 * top of a long page, far above the fold, so a tap that failed looked like a tap
 * that did nothing. The report was blunt and correct: "the rest you can't really
 * add anything or change anything… let's rethink that whole thing."
 *
 * So: one lane per row of the grid, each lane a vertical list of what is
 * actually in it, in signal order, with the free cells between them shown as
 * gaps you can tap. Nothing is hidden — the column number is on every card, and
 * a preset with parallel rows shows a lane each — but nothing is drawn that
 * isn't there either, which is what turned forty-eight cells into five.
 *
 * Tap a block for what you can do to it; tap a gap to put something in it. Every
 * answer, and every failure, appears in that same row, under your thumb.
 *
 * Two things about writing here are worth knowing. Placement writes structure
 * rather than values, and that part of ForgeFX is worked out from the protocol
 * rather than confirmed on hardware — so a bad write mangles a preset rather
 * than mis-setting a knob. And this unit family answers `ok:false` to writes
 * that landed (documented twice in this repo), which is why nothing here treats
 * that answer as a failure: it re-reads the chain from the unit instead and
 * lets you look.
 */
export default function GridEditor({ blocks: asRead, capabilities, busy, onError, onChanged, deviceKey = null, ownOpen = false, admin = false, onReread = null }) {
  /*
   * The chain as this editor takes it: an Axe-Fx III's NAM and the other
   * blocks the engine sends with no name are named and are the editor's own
   * to move and remove, for the accounts they are shown to
   * (shared/own-blocks.mjs ownInChainEditor says why, and what is not proven).
   */
  const blocks = useMemo(() => ownInChainEditor(asRead, deviceKey, ownOpen), [asRead, deviceKey, ownOpen])
  /* And the engine's list of blocks to add, with those blocks in it. */
  const withOwn = (list) => ownInPalette(list, deviceKey, ownOpen)
  // Which card's actions are open, as "row:col". One at a time.
  const [open, setOpen] = useState(null)
  const [moving, setMoving] = useState(null)
  // Which card's Remove is asking "are you sure", as "row:col".
  const [asking, setAsking] = useState(null)
  const [choice, setChoice] = useState('')
  const [working, setWorking] = useState(null)
  // Said beside the control that caused it, never at the top of the page.
  const [issue, setIssue] = useState(null)
  const [palette, setPalette] = useState([])
  const [paletteFailed, setPaletteFailed] = useState(false)

  /* rows and cols were read here and never defined, so on a grid unit the
     panel threw "Can't find variable: rows" before it drew a thing. */
  const { linear, rows, cols } = gridShape(capabilities)

  /* Whose chain the cards are. Another preset's are not drawn, and cannot be
     removed, moved or added beside: the cells they name are this preset's. */
  const chainNow = useChain({ editing: true })
  /* The last chain change, and the one click that takes it back. Its put-back is a write to a row, so what was said under that row goes first. */
  const chainUndo = useChainUndo({ blocks, number: chainNow.number, onChanged, onWrite: (row) => leaveRow(row, null) })

  /*
   * THE ROW'S JOINS, AS ON THE PHONE (shared/chain-move.mjs, one plan for
   * both). Only where the unit's joins are the app's to make (a gen-3 unit,
   * the demo's grid units): never an AM4, a VP4 or an Axe-Fx II. `oldBytes`:
   * through a computer app older than 1.90.82 (or one that does not say)
   * some six-row joins go to the wrong cell, so a move needing one is refused
   * before anything is cleared. That is any computer app this page did not
   * come from (shared/chain-move.mjs builtElsewhere): the one the relay
   * reaches, and the one on this computer when this is the hosted website
   * open beside it (its version read from its own host.name, link.js
   * readMac). The computer's own window and Wi-Fi page are this release.
   */
  const joinsHere = cablesLaid(capabilities)
  const elsewhere = () => builtElsewhere({ role: linkState()?.role, served: servedLocally() })
  const cablesVersion = () => (elsewhere() ? linkState().macVersion : null)
  const oldBytes = () => !isDemo() && elsewhere() && oldCableBytes(linkState().macVersion)
  const gridNow = () => readGrid().then((g) => (Array.isArray(g?.cells) ? g.cells : null))
  const moveWire = { gridCells: gridNow, clearCell, placeBlock, setCable, readBlock: blockParams }
  const chainLog = (what, detail) => logDebug('chain', what, detail)
  /*
   * EVERY WRITE OF A MOVE OR A JOIN IS HELD TO THE PRESET IT WAS BEGUN ON
   * (shared/chain-move.mjs presetHold), the unit asked before each, as the
   * phone asks it: a footswitch mid-move never gets the old row's joins
   * written into the preset it stepped to. Only where the joins are the
   * app's, and for a preset the page can name.
   */
  const presetHeld = (n) =>
    joinsHere && Number.isInteger(n) && n >= 0
      ? async () => {
          const p = await currentPreset()
          const k = p?.number
          return !Number.isInteger(k) || k < 0 ? 'unknown' : k === n ? 'same' : 'moved'
        }
      : null
  /* The lane's own names for its blocks, for a grid read that calls one by number. */
  const namesOf = (lane) => new Map((lane?.blocks || []).filter((b) => Number.isInteger(b?.effectId)).map((b) => [b.effectId, b.name]))
  /* A row that reads cut, found whenever the chain is read (rowCuts). */
  const [cutRows, setCutRows] = useState([])
  /* What a move, an add or a Join the row left under a row, by row: { text, joins, tone, n }, `n` the preset it was written on. */
  const [leftUnder, setLeftUnder] = useState({})
  const leaveRow = (row, said) => {
    setLeftUnder((was) => {
      const next = { ...was }
      if (said) next[row] = said
      else delete next[row]
      return next
    })
    /* A write to the row outdates what the last read found there, until the read after it. */
    setCutRows((was) => (was.some((c) => c.row === row) ? was.filter((c) => c.row !== row) : was))
  }
  const [joining, setJoining] = useState(null)
  const cutsSaid = useRef('')
  /* Another preset's lanes start with nothing said under them. */
  useEffect(() => {
    setLeftUnder({})
  }, [chainNow.number])
  /*
   * A ROW ALREADY CUT (a drag before this release, his preset 390): looked
   * for whenever the chain is read, from the chain read first (maybeCut, no
   * read of its own), and only then the grid, which has the bare wires.
   */
  useEffect(() => {
    if (busy || working) return undefined
    if (!joinsHere || !maybeCut(blocks)) {
      setCutRows([])
      return undefined
    }
    let stop = false
    ;(async () => {
      const cells = await gridNow().catch(() => null)
      if (stop || !Array.isArray(cells)) return
      const cuts = rowCuts({ cells, blocks, rows, law: oldBytes(), version: cablesVersion() })
      const said = cuts.map((c) => `row ${rowLabel(c.row)} at column ${label(c.col)} (${c.joins.length} to join${c.blocked.length ? `, ${c.blocked.length} the app can’t` : ''})`).join('; ')
      if (said && said !== cutsSaid.current) logDebug('chain', 'a row reads cut', said)
      cutsSaid.current = said
      setCutRows(cuts)
    })()
    return () => {
      stop = true
    }
  }, [blocks, busy, working, joinsHere])

  /*
   * After a write that can leave a row cut (a block moved to another cell,
   * one put in a space or over another): the grid read, and the rows it
   * touched said under them where they read cut. `holes` counts the space a
   * moved block left behind, which nothing here can join.
   */
  const checkRows = async (touched, { holes = false, what = 'change', n = chainNow.number } = {}) => {
    if (!joinsHere) return
    const cells = await gridNow().catch(() => null)
    if (!Array.isArray(cells)) return
    const cuts = rowCuts({ cells, blocks, rows, law: oldBytes(), version: cablesVersion(), holes, only: touched })
    for (const r of touched) {
      const cut = cuts.find((c) => c.row === r)
      leaveRow(r, cut ? { text: cut.text, joins: cut.joins, n } : null)
      if (cut) logDebug('chain', `row ${rowLabel(r)} after the ${what}`, cut.text)
    }
  }

  /** "JOIN THE ROW": the joins a move left missing, or a row that reads cut, sent where the grid does not show them; then read again and said. */
  const mendRow = async (cut) => {
    if (!cut?.joins?.length) return
    const n = chainNow.number
    setWorking('joining')
    setJoining(cut.row)
    setIssue(null)
    try {
      logDebug('chain', `Join the row clicked on row ${rowLabel(cut.row)}`, `${cut.joins.length} join${cut.joins.length === 1 ? '' : 's'}`)
      /* And the row asked again after, the way it was found (rowCuts, its empty spaces always counted), so "joined again" is said only of a row that reads whole. */
      const r = await joinRow({ row: cut.row, joins: cut.joins, wire: moveWire, log: chainLog, names: namesOf(shown.find((l) => l.row === cut.row)), blocks, rows, law: oldBytes(), version: cablesVersion(), onPreset: presetHeld(n) })
      const w = joinedWords(r)
      leaveRow(cut.row, w.ok ? { text: w.text, joins: [], tone: 'ok', n } : { text: w.text, joins: w.joins ?? cut.joins, n })
      onChanged(w.ok ? `Joined row ${rowLabel(cut.row)} again` : `Tried to join row ${rowLabel(cut.row)} again`)
    } catch (err) {
      setIssue(err.message)
      onError(err.message)
    } finally {
      setJoining(null)
      setWorking(null)
    }
  }

  /*
   * DRAG TO REORDER, AS ON THE PHONE. "How does moving the blocks in the chain
   * work on the web version? Can we set it up like the phone." Hold the ≡ grip
   * on a block and drag it up or down its lane; the other blocks shift out of
   * the way, and letting go deals the lane's blocks back into the same
   * columns in the new order. The maths is shared/lane-order, the same copy
   * the phone runs, so the two apps write the same block to the same column.
   */
  const [drag, setDrag] = useState(null)
  const slots = useRef({})
  const dragFrom = useRef({ y: 0, heights: [] })
  const GAP = 4

  /*
   * Columns are 0-indexed here, as /preset/blocks reports them and as
   * actions.js has always assumed; the wire's 1-indexing is added once, at the
   * boundary, by toWireCell. This panel used to add one of its own for a linear
   * unit and then add the wire's on top, so slot 1 on an AM4 was written to
   * column 2 — and the cells it drew could never match the blocks the device
   * reported, because those come back 0-indexed. The label is the only place
   * that counts from one, because that is how a person counts.
   */
  const label = colLabel

  const loadPalette = async () => {
    setPaletteFailed(false)
    try {
      const res = await blockCatalog()
      const list = withOwn(Array.isArray(res) ? res : [])
      setPalette(list)
      if (!list.length) setPaletteFailed(true)
    } catch {
      setPalette([])
      setPaletteFailed(true)
    }
  }

  useEffect(() => {
    let stop = false
    ;(async () => {
      try {
        const res = await blockCatalog()
        if (stop) return
        const list = withOwn(Array.isArray(res) ? res : [])
        setPalette(list)
        if (!list.length) setPaletteFailed(true)
      } catch {
        // Silently emptying the list left Place disabled with nothing to
        // explain it — a control that does nothing and says nothing.
        if (!stop) {
          setPalette([])
          setPaletteFailed(true)
        }
      }
    })()
    return () => {
      stop = true
    }
  }, [])

  /**
   * The rows of the grid, each as what is in it and where the gaps are.
   *
   * Only rows that hold something are shown, plus the first empty one so a bare
   * preset can be started and a parallel row can be begun. A gap is a real
   * empty cell — never drawn between two blocks that are already adjacent,
   * because there is nowhere there to put anything.
   */
  const shown = lanesShown(blocks, capabilities)

  /*
   * A SPLIT CHAIN, SAID OUT LOUD.
   *
   * Where every block sits is read from the unit. How the rows are JOINED is
   * not — there is no read for the cables anywhere in this app, only a write —
   * so on a preset running down two rows this editor can describe half of what
   * is there and cannot tell a deliberate split from two unrelated rows.
   *
   * Drawing that silently is the problem: two lanes with no comment read as an
   * editor that understands the routing and is showing it to you. (The joins
   * ARE read now: each cell's feeds come with the grid read, which Rows and
   * splits draws.)
   *
   * MOVING BLOCKS WITHIN A ROW CAN CUT IT. This used to say a move within a
   * row was safe, since cells and joins are separate writes. On a gen-3 unit a
   * join lives in the cell it feeds, and a drag that took four blocks out and
   * put them back left his Axe-Fx III's row silent (16 November 2026). So the
   * drag reads the joins first and puts back what it cut (`reorder`), and a
   * row that reads cut says so under it.
   */
  const splitChain = isSplitChain(blocks, capabilities)

  const close = () => {
    setOpen(null)
    setAsking(null)
    setChoice('')
    setIssue(null)
  }

  /*
   * A write is done when the unit has been asked and the chain re-read.
   *
   * `ok:false` is not a failure here. The AM4 answers it on writes that
   * actually landed — this repo documents that in two other places — and the
   * old editor took it at its word: a successful move was rolled straight back,
   * which is exactly why "delete works, the rest doesn't". So the answer is
   * reported as a note, the chain above is re-read from the unit, and the
   * person can see for themselves which it was.
   */
  const doubtful = doubtfulWrite

  const add = async (row, col) => {
    if (!choice) return
    chainUndo.clear()
    setWorking(`add:${row}:${col}`)
    setIssue(null)
    /*
     * A block already in the chain (the list offers every block, and a unit
     * has one of each) is MOVED here, and leaves an empty space where it was,
     * which nothing joins across: its old row is written to as well, and read
     * back with the space counted, as tap-to-move reads both of its rows.
     */
    const was = (blocks || []).find((b) => b.effectId === Number(choice) && !(b.row === row && b.col === col)) || null
    const touched = was ? [...new Set([row, was.row])] : [row]
    for (const r of touched) leaveRow(r, null)
    try {
      const res = await placeBlock(row, col, Number(choice))
      /* Replace puts a block over a joined one, and Add one into a space: on a gen-3 unit either may come in joined to nothing, so the row is read back and said under it where it is cut. */
      await checkRows(touched, { holes: !!was, what: 'add' })
      const block = palette.find((b) => b.page === Number(choice))
      onChanged(
        linear
          ? `Placed ${block?.name} in slot ${label(col)}`
          : `Placed ${block?.name} at row ${rowLabel(row)}, column ${label(col)}`
      )
      const note = doubtful(res)
      if (note) setIssue(note)
      else close()
    } catch (err) {
      setIssue(err.message)
      onError(err.message)
    } finally {
      setWorking(null)
    }
  }

  /**
   * Move a block to another cell.
   *
   * Order matters and the safe order isn't obvious. A block instance exists once
   * — an FM3 has one Amp — so placing it in a second cell while it still
   * occupies the first may be refused or may do something undefined. Clearing
   * first avoids asking that question.
   *
   * The cost is a window where the block exists nowhere, so its id is held and
   * put back if the placement *throws*. It is not put back on `ok:false`: that
   * answer means nothing on this hardware, and undoing a move because of it is
   * the bug this panel was reported for.
   */
  const move = async (from, to) => {
    const block = from.block
    chainUndo.clear()
    setWorking('moving')
    setIssue(null)
    const touched = [...new Set([from.row, to.row])]
    for (const r of touched) leaveRow(r, null)
    try {
      await clearCell(from.row, from.col)
      let res
      try {
        res = await placeBlock(to.row, to.col, block.effectId)
      } catch (err) {
        await placeBlock(from.row, from.col, block.effectId).catch(() => {})
        await checkRows(touched, { what: 'move that was put back' })
        throw err
      }
      /*
       * AND THE JOINS READ BACK. A block put into another cell lands there
       * joined to nothing on a gen-3 unit, and leaves an empty space where it
       * was, which nothing joins across (shared/chain-move.mjs rowCuts with
       * `holes`). Said under each row it touched, with Join the row where
       * the app can join it.
       */
      await checkRows(touched, { holes: true, what: 'move' })
      onChanged(
        linear
          ? `Moved ${block.name} to slot ${label(to.col)}`
          : `Moved ${block.name} to row ${rowLabel(to.row)}, column ${label(to.col)}`
      )
      const note = doubtful(res)
      if (note) setIssue(note)
      else close()
      setMoving(null)
    } catch (err) {
      setIssue(err.message)
      onError(err.message)
      setMoving(null)
    } finally {
      setWorking(null)
    }
  }

  /*
   * A drag, landed: every moving block is cleared first, then every one is
   * placed, so no target is occupied when it is written to. Every answer is
   * logged, and the chain is re-read off the unit afterwards and each moved
   * block looked for where it was put -- a unit that quietly ignores a write
   * answers exactly like one that took it.
   *
   * AND THE ROW'S JOINS ARE KEPT, BY THE PHONE'S OWN PLAN
   * (shared/chain-move.mjs). On a gen-3 unit a join lives in the cell it
   * feeds; a drag that cleared four cells and put four blocks back left his
   * Axe-Fx III's row silent (16 November 2026). So the grid is read first and
   * the move refused before anything is cleared where a join could not be
   * made again; the row is logged straight after the move, the missing joins
   * sent, and the row read again and checked. Still cut, it says so under the
   * row, with Join the row.
   */
  const reorder = async (lane, fromIndex, toIndex) => {
    const items = laneItems(lane)
    const pos = blockPositions(items, fromIndex, toIndex)
    if (!pos) return
    const moves = reorderPlan(
      items.filter((it) => it.kind === 'block').map((it) => ({ col: it.col, block: it.block })),
      pos.from,
      pos.to
    )
    if (!moves.length) return
    setWorking('moving')
    setIssue(null)
    leaveRow(lane.row, null)
    /* The preset this move is made on: every write of it is held to it, and what it leaves said is about it. */
    const n = chainNow.number
    const steps = moves.map((m) => ({ id: m.block.effectId, name: m.block.name, from: m.from, to: m.to }))
    try {
      /* The joins along the row are read before anything is written, and a move whose joins could not be made again sends nothing (moveBlocks, the phone's own). */
      const res = await moveBlocks({
        row: lane.row,
        moves: steps,
        wire: moveWire,
        rows,
        cols,
        cables: joinsHere,
        law: oldBytes(),
        version: cablesVersion(),
        log: chainLog,
        names: namesOf(lane),
        /* Each moved block read before and after, for the log: his account only (two reads a block would slow every customer's drag). */
        measure: admin,
        onPreset: presetHeld(n),
        /* The chain read, for the Inputs and Outputs when the row is asked again after the move. */
        blocks,
        /* Undo goes only once something is about to be written: a move refused before it keeps the last change's Undo. */
        starting: () => chainUndo.clear()
      })
      if (res.notSent) {
        if (res.why) leaveRow(lane.row, { text: res.why, joins: [], n })
        /*
         * Stopped by the preset before anything was sent, or refused because
         * the chain on the unit is not the one on screen: the chain is read
         * again, as the words say, and NOTHING ELSE. Not onChanged, which
         * writes a line in the history, hands the assistant a hand edit and
         * marks the preset unsaved (Save and Revert, over a preset nothing
         * was written to, whose Revert would throw away edits made at the
         * unit).
         */
        if (res.stopped || res.why === CHAIN_CHANGED) onReread?.()
        return
      }
      /* What the move leaves said, over the chain, under its row and in the history (afterMoveSaid, the phone's words too). */
      const said = afterMoveSaid({ row: lane.row, res })
      if (said.note) leaveRow(lane.row, { ...said.note, n })
      if (res.threw || res.stopped === 'moved') {
        /* A write threw, or the unit stopped saying its preset or went to another: the words claim no more than the read after shows. */
        setIssue(said.issue)
        if (res.threw) onError(res.threw.message)
        onChanged(said.line)
        return
      }
      /* Straight to the read. The computer's copy of the chain is dropped by
         the placement writes themselves; the DELETE /device/cache that used to
         go first deleted its saved profile of the FM3 and freshened nothing. */
      const now = await presetBlocks().catch(() => null)
      if (now) {
        const at = (m) => now.find((b) => b.effectId === m.block.effectId)
        const astray = moves.filter((m) => at(m)?.row !== lane.row || at(m)?.col !== m.to)
        for (const m of moves) {
          const b = at(m)
          /* Columns from one, as the unit and this page count them (they were printed from nought). */
          logDebug('chain', `${m.block.name}: column ${label(m.from)} → ${label(m.to)}`, astray.includes(m) ? (b ? `unit has it at row ${rowLabel(b.row)}, column ${label(b.col)}` : 'unit has it nowhere') : 'landed')
        }
        const refused = res.refused
        if (astray.length) {
          setIssue(
            `The unit did not keep the move: ${astray
              .map((m) => {
                const b = at(m)
                return `${m.block.name} is ${b ? `at row ${rowLabel(b.row)}, column ${label(b.col)}` : 'nowhere'}`
              })
              .join(', ')}. ${refused ? `The unit answered “refused” to ${refused} of the ${res.answers.length} steps.` : 'The unit answered every step without refusing it.'}`
          )
        } else {
          onChanged(`Moved ${moves.map((m) => m.block.name).join(', ')}`)
        }
      } else {
        onChanged(`Moved ${moves.map((m) => m.block.name).join(', ')} — could not re-read the chain to check`)
      }
    } catch (err) {
      setIssue(err.message)
      onError(err.message)
    } finally {
      setWorking(null)
    }
  }

  /* The grip reports; this decides. Pointer events, so a mouse and a finger
     are the same drag, and capture so the drag survives leaving the grip. */
  const gripDown = (e, lane, index) => {
    if (busy || working) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const n = laneItems(lane).length
    const heights = []
    for (let i = 0; i < n; i++) heights.push(slots.current[`${lane.row}:${i}`]?.getBoundingClientRect().height || 0)
    dragFrom.current = { y: e.clientY, heights }
    setDrag({ row: lane.row, index, dy: 0, to: index })
  }
  const gripMove = (e, lane, index) => {
    if (!drag || drag.row !== lane.row || drag.index !== index) return
    const dy = e.clientY - dragFrom.current.y
    const to = landingIndex(dragFrom.current.heights, index, dy, GAP)
    setDrag({ row: lane.row, index, dy, to })
  }
  const gripUp = (lane, index) => {
    if (!drag || drag.row !== lane.row || drag.index !== index) return
    const to = drag.to
    setDrag(null)
    if (to !== index) reorder(lane, index, to)
  }

  /*
   * Take a block out, then look.
   *
   * "Remove does nothing." The write was fine; what failed was everything
   * around it. The question in front of it was the browser's own pop-up, and a
   * browser that blocks pop-ups answers it "no" without showing it — so the
   * tap did nothing and said nothing. And the unit's answer was never looked
   * at: whatever happened, the panel closed and the history said "Cleared".
   *
   * So the chain is read back off the unit afterwards, as the drag does, and
   * a block still sitting in the cell is said out loud, the way the phone
   * says it.
   */
  const remove = async (row, col, name) => {
    chainUndo.clear()
    setWorking('clearing')
    setIssue(null)
    leaveRow(row, null)
    const where = linear ? `slot ${label(col)}` : `row ${rowLabel(row)}, column ${label(col)}`
    try {
      /* What it would take to put it back, read while it is still there. */
      const putBack = await readPutBack(row, col, capabilities, blocks).catch(() => null)
      const r = await clearCell(row, col)
      logDebug('chain', `remove ${name || 'block'} at ${where}`, r?.ok === false ? 'refused' : r?.ok === true ? 'ok' : 'no answer')
      const now = await presetBlocks().catch(() => null)
      const still = now ? now.find((b) => b.row === row && b.col === col) : null
      logDebug('chain', `${where} after the remove`, !now ? 'could not re-read the chain' : still ? `still holds ${still.name}` : 'empty now')
      if (still) {
        setIssue(
          `The unit did not remove it: ${where} still holds ${still.name || 'a block'}${
            r?.ok === false ? ', and the unit answered “refused”' : ''
          }.`
        )
        return
      }
      const cleared = linear ? `Cleared slot ${label(col)}` : `Cleared row ${rowLabel(row)}, column ${label(col)}`
      onChanged(now ? cleared : `${cleared} — could not re-read the chain to check`)
      if (putBack) chainUndo.offer({ ...putBack, label: `put ${putBack.back.name} back` })
      close()
    } catch (err) {
      setIssue(err.message)
      onError(err.message)
    } finally {
      setWorking(null)
    }
  }

  /* Nothing but the ends of the chain: where a starter chain is worth offering. */
  /* A block newer than the app counts as something: a starter chain is never written round it. */
  const bareChain = !(blocks || []).some((b) => isNewBlock(b) || (b.slug !== 'input' && b.slug !== 'output'))

  const buildStarter = async () => {
    setWorking('starter')
    setIssue(null)
    try {
      const chain = STARTER_ORDER.map((slug) => palette.find((b) => b.slug === slug)).filter(Boolean)
      /*
       * Between the input and the output, and putting them there when they are
       * missing — the same planner the assistant's own chain builder uses.
       *
       * This used to place from column 0 and count upwards, which wrote over
       * whichever of them was already on the row, and left a preset that had
       * neither with a drive that nothing feeds and nothing that reaches the
       * jack. Both are silent, and both look perfect on screen.
       */
      /*
       * WHICH ROW: the second (row index 1), where factory presets keep
       * theirs. On a SIX-ROW unit (an FM9, an Axe-Fx III) the row the
       * preset's own Input or Output is on, and the third where it has
       * neither.
       *
       * The message that joins two cells was wrong for a six-row unit's
       * second row: a row built there on an Axe-Fx III came back with every
       * block in and its first cable not there (15 November 2026;
       * mobile/src/lib/gen3-grid.js has the whole of it). The computer app
       * builds the message another way from 1.90.82, but this page also
       * drives computer apps from before that, and along the third row the
       * old message and the new are the same bytes, whichever computer app
       * sends them. (Not seen on a unit yet, either of them.)
       *
       * THE PRESET'S OWN ENDS SAY THE ROW, ON SIX ROWS. The third row is now
       * where the phone's Quick build and this button put an Input and an
       * Output, so a preset with nothing in it but those two, on that row,
       * is a common thing to meet. Built on the second row regardless, as
       * the first cut of this did, it got a second Input and Output placed
       * beside the ones it had.
       *
       * THREE THINGS THIS DOES NOT MEND, all as they were before in kind.
       * A six-row preset whose ends are on the SECOND row is built there,
       * and through a computer app older than 1.90.82 every cable along
       * that row names another cell: none is refused, this page says
       * "Built a starter chain", and the row is not joined (the one thing
       * of all this that has been SEEN, on 15 November 2026). The same for
       * the cables out of every other column along the fifth and sixth
       * rows. A
       * preset whose ends are on the TOP row is built there, where the
       * cables out of every other column are refused: what is said after
       * the build ("the unit refused N of the M connections along the row")
       * is the only word of it, and the preset is silent until the row is
       * joined on the unit. And a preset whose Input and Output are on
       * DIFFERENT rows is built on the Input's, with an Output asked for
       * there too; the phone's Quick build refuses such a preset in words,
       * and this button does not yet.
       *
       * On four rows nothing has changed: row index 1, wherever the ends
       * are, as it always was.
       */
      const row = starterRow({ linear, rows, blocks })
      const onRow = (blocks || []).filter((b) => b.row === row)
      const has = (slug) => palette.some((b) => b.slug === slug)
      const plan = chainPlan({
        onRow,
        width: cols || chain.length,
        count: chain.length,
        canInput: !linear && has('input') && !onRow.some((b) => b.slug === 'input'),
        canOutput: !linear && has('output') && !onRow.some((b) => b.slug === 'output')
      })
      const fits = linear ? chain.slice(0, cols) : chain.slice(0, plan.cols.length)

      if (plan.input !== null && !onRow.some((b) => b.slug === 'input')) {
        const into = palette.find((b) => b.slug === 'input')
        if (into) await placeBlock(row, plan.input, into.page)
      }
      for (const [i, block] of fits.entries()) {
        await placeBlock(row, linear ? i : plan.cols[i], block.page)
      }
      if (plan.output !== null && !onRow.some((b) => b.slug === 'output')) {
        const out = palette.find((b) => b.slug === 'output')
        if (out) await placeBlock(row, plan.output, out.page)
      }
      /*
       * And join the row up, or the starter chain is five blocks that make no
       * sound. Placing a block fills a cell; it does not connect that cell to
       * anything, and an empty preset has no cabling of its own to inherit.
       * A linear unit has no grid and nothing to wire.
       */
      const wiring = linear ? null : await wireRow(row, plan.wireTo)
      onChanged(`Built a starter chain — ${fits.map((b) => b.name).join(', ')}`)
      if (wiring?.refused) {
        setIssue(
          `The blocks are in, but the unit refused ${wiring.refused} of the ${wiring.cables} connections along the row — until that row is joined up this preset will be silent.`
        )
      }
      await readGrid().catch(() => {})
    } catch (err) {
      setIssue(err.message)
      onError(err.message)
    } finally {
      setWorking(null)
    }
  }

  /** The picker, or the reason there isn't one. */
  const picker = (onPick, verb, key) =>
    paletteFailed ? (
      <div className="chain-note">
        <p className="hint">Couldn&rsquo;t read the block list from your unit.</p>
        <button className="chip" onClick={loadPalette}>
          Try again
        </button>
      </div>
    ) : (
      <>
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          aria-label="Block to place"
        >
          <option value="">Choose a block…</option>
          {palette.map((b) => (
            <option key={`${b.slug}-${b.page}`} value={b.page}>
              {b.name}
            </option>
          ))}
        </select>
        <button className="primary" onClick={onPick} disabled={busy || !choice || !!working}>
          {working === key ? `${verb}…` : verb}
        </button>
      </>
    )

  const laneList = (editable) => (
    <div className="chain-lanes">
      {shown.map((lane) => (
        <div className="chain-lane" data-linear={linear ? 'yes' : undefined} key={lane.row}>
          {rows > 1 ? (
            <p className="silk-label chain-lane-head">
              {laneUsed(lane) ? `Row ${rowLabel(lane.row)}` : `Row ${rowLabel(lane.row)} — empty`}
            </p>
          ) : null}
          {/* Where the row is cut, said under its name: after a move that left a join missing, or as read (shared/chain-move.mjs). */}
          <RowCut
            said={rowNote(leftUnder[lane.row], cutRows.find((c) => c.row === lane.row), chainNow.number)}
            joining={joining === lane.row}
            disabled={!editable || busy || !!working}
            onJoin={(said) => mendRow({ ...said, row: lane.row })}
          />

          {laneItems(lane).map((item, index) => {
            const at = `${lane.row}:${item.col}`
            const isOpen = open === at
            /* While a block is held, the others slide out of its way. */
            const dragging = drag && drag.row === lane.row ? drag : null
            const lift = dragging ? dragFrom.current.heights[dragging.index] || 0 : 0
            let shift = 0
            if (dragging) {
              if (index === dragging.index) shift = dragging.dy
              else if (dragging.to > dragging.index && index > dragging.index && index <= dragging.to) shift = -(lift + GAP)
              else if (dragging.to < dragging.index && index >= dragging.to && index < dragging.index) shift = lift + GAP
            }
            const slotStyle = {
              transform: shift ? `translateY(${shift}px)` : undefined,
              transition: dragging && index === dragging.index ? 'none' : 'transform 120ms ease',
              zIndex: dragging && index === dragging.index ? 2 : undefined,
              position: 'relative'
            }
            const slotRef = (el) => {
              slots.current[`${lane.row}:${index}`] = el
            }

            if (item.kind === 'gap') {
              const target = moving && moving.at !== at
              return (
                <div className={`chain-slot ${isOpen ? 'open' : ''}`} key={at} ref={slotRef} style={slotStyle}>
                  <button
                    className={`chain-gap ${isOpen ? 'open' : ''} ${target ? 'target' : ''}`}
                    onClick={() => {
                      if (!editable) return
                      if (target) return move(moving, { row: lane.row, col: item.col })
                      setIssue(null)
                      setOpen(isOpen ? null : at)
                    }}
                    disabled={!editable || busy || !!working}
                  >
                    <span className="chain-col mono">{gapCols(item, label)}</span>
                    <span className="chain-gap-word">
                      {target ? `Move ${moving.block.name} here` : 'Empty — tap to add'}
                    </span>
                  </button>

                  {isOpen && editable && !moving ? (
                    <div className="chain-actions">
                      {picker(() => add(lane.row, item.col), 'Add', `add:${at}`)}
                      <button className="chip" onClick={close}>
                        Cancel
                      </button>
                      {issue ? <p className="chain-issue">{issue}</p> : null}
                    </div>
                  ) : null}
                </div>
              )
            }

            /*
             * A block newer than the app (shared/new-block.mjs): where it is,
             * in words, and nothing to press. Its cell is not a gap, so
             * nothing is moved or added onto it, and a drag deals the other
             * blocks round it.
             */
            if (item.kind === 'held') {
              return (
                <div className="chain-slot" key={at} ref={slotRef} style={slotStyle}>
                  <div className="chain-block chain-held" aria-label={`${NEW_BLOCK_NAME}, ${label(item.col)}. ${NEW_BLOCK_NOTE}`}>
                    <span className="chain-col mono">{label(item.col)}</span>
                    <span className="chain-block-name">{NEW_BLOCK_NAME}</span>
                  </div>
                  <p className="hint">{NEW_BLOCK_NOTE}</p>
                </div>
              )
            }

            const b = item.block
            const lifted = !!dragging && index === dragging.index
            return (
              <div className={`chain-slot ${isOpen ? 'open' : ''} ${lifted ? 'lifted' : ''}`} key={at} ref={slotRef} style={slotStyle}>
                {/*
                  SWIPE LEFT TO TAKE IT OUT — the phone's chain does the same.
                  "Let's add swipe to delete on the chain instead of having to
                  tap on it and hit remove… maybe with a confirmation X." A
                  swipe, or the ✕ it uncovers, asks the same question Remove
                  asks, here on the page. The ends of the chain do not slide.
                */}
                <SwipeRow
                  as="div"
                  className="chain-row"
                  fromButtons
                  label={`Remove ${b.name}`}
                  ask={
                    editable && !['input', 'output'].includes(b.slug)
                      ? (go, keep) => {
                          keep()
                          setIssue(null)
                          setMoving(null)
                          setOpen(at)
                          setAsking(at)
                        }
                      : null
                  }
                  onRemove={() => {}}
                  noSwipe={!editable || ['input', 'output'].includes(b.slug) || !!dragging}
                >
                  <button
                    className={`chain-block ${isOpen ? 'open' : ''} ${
                      moving?.at === at || lifted ? 'lifting' : ''
                    }`}
                    onClick={() => {
                      if (!editable) return
                      setIssue(null)
                      setOpen(isOpen ? null : at)
                      setMoving(null)
                      setAsking(null)
                    }}
                    disabled={!editable || busy || !!working}
                  >
                    <span className="chain-col mono">{label(item.col)}</span>
                    <span className="chain-block-name">{b.name}</span>
                  </button>
                  {editable && !linear ? (
                    <button
                      type="button"
                      className="chain-grip"
                      aria-label={`Move ${b.name} — hold and drag up or down`}
                      title="Hold and drag up or down to move it"
                      disabled={busy || !!working}
                      onPointerDown={(e) => gripDown(e, lane, index)}
                      onPointerMove={(e) => gripMove(e, lane, index)}
                      onPointerUp={() => gripUp(lane, index)}
                      onPointerCancel={() => gripUp(lane, index)}
                    >
                      ≡
                    </button>
                  ) : null}
                </SwipeRow>

                {isOpen && editable ? (
                  <div className="chain-actions">
                    {moving?.at === at ? (
                      <>
                        <p className="hint">Tap an empty slot to move it there.</p>
                        <button className="chip" onClick={() => setMoving(null)}>
                          Cancel move
                        </button>
                      </>
                    ) : (
                      <>
                        {/*
                          Move, only where moving keeps the block.

                          "The move function doesn't work... if it's not
                          possible or too hard, let's just remove the move
                          button either way."

                          On a grid unit a block carries its own settings, so
                          putting it in another cell is a move. On the AM4 the
                          settings live in the slot: the write available is
                          "set this slot's block type", so a move is clear one
                          slot, create a fresh block in another — same name,
                          every knob back at its default. That is not a move,
                          and dressing it as one loses somebody's tone silently.
                          Cleared and re-added is what it always was, and Remove
                          and Replace already say so honestly.
                        */}
                        {linear ? null : (
                          <button
                            className="chip"
                            onClick={() => setMoving({ at, row: lane.row, col: item.col, block: b })}
                            disabled={busy || !!working || !shown.some((l) => l.gaps.length)}
                          >
                            Move
                          </button>
                        )}
                        {picker(() => add(lane.row, item.col), 'Replace', `add:${at}`)}
                        {/* Red, and asked first — the phone does the same. A block
                            taken out loses its settings and there is no undo.
                            Asked here on the page rather than in a browser
                            pop-up, which a blocked pop-up answers "no" to
                            without ever showing it. */}
                        <button
                          className="chip chip-remove"
                          onClick={() => setAsking(at)}
                          disabled={busy || !!working || asking === at}
                        >
                          {working === 'clearing' ? 'Removing…' : 'Remove'}
                        </button>
                        <button className="chip" onClick={close}>
                          Cancel
                        </button>
                        {asking === at ? (
                          <div className="notice chain-ask" data-kind="fault" role="alertdialog" aria-label={removeQuestion(b.name)}>
                            <p>
                              <strong>{removeQuestion(b.name)}</strong> {REMOVE_WARNING}
                            </p>
                            <div className="history-actions">
                              <button
                                className="chip chip-remove"
                                onClick={() => {
                                  setAsking(null)
                                  remove(lane.row, item.col, b.name)
                                }}
                                disabled={busy || !!working}
                              >
                                Remove
                              </button>
                              <button className="chip" onClick={() => setAsking(null)}>
                                Keep it
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                    {issue ? <p className="chain-issue">{issue}</p> : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )

  /*
   * Locked: the chain as it is, and no way to change it by accident. Editing
   * behind an explicit mode means you can always see the chain, and have to say
   * so before you can move anything in it.
   */
  /*
   * No gate any more. This used to draw the lanes read-only behind an "Edit
   * the chain" button, inside a section that started folded, so the grips
   * were three taps deep and nobody found them: "Where do I grab it? It's
   * not set up like the phone." The phone opens straight onto the cards and
   * their grips; so does this. The caution about structure writes stays, as
   * a sentence at the foot rather than a door at the top.
   */
  if (chainNow.elsewhere) {
    return (
      <section className="grid-editor">
        <div className="history-head">
          <p className="silk-label">Edit the chain</p>
        </div>
        {/* The chain strip above says it is loading; this only holds the space. */}
        <ChainWait chain={chainNow} cards={3} className="chain-wait-lanes" quiet />
      </section>
    )
  }

  return (
    <section className={`grid-editor ${chainNow.late ? 'chain-updating' : ''}`}>
      <div className="history-head">
        <p className="silk-label">Edit the chain</p>
        <div className="history-actions">
          {/* Only on a preset with nothing in it: next to a full chain it is
              the one button here that writes five blocks at once. */}
          {bareChain ? (
            <button className="chip" onClick={buildStarter} disabled={busy || !!working || paletteFailed}>
              {working === 'starter' ? 'Building…' : 'Starter chain'}
            </button>
          ) : null}
        </div>
      </div>

      <p className="hint">
        Hold ≡ and drag a block up or down to move it. Swipe a block left to remove it. Tap a block for Add and Remove, or an empty
        slot to put something in it.
      </p>

      {/* The block somebody wants in every preset, in one tap and in the right place. */}
      {linear ? null : (
        <LooperAtEnd
          blocks={blocks}
          capabilities={capabilities}
          palette={palette}
          busy={busy || !!working || chainUndo.running}
          onChanged={onChanged}
          onError={onError}
          onAdded={(plan) =>
            chainUndo.offer(
              plan.undo ? { kind: 'out', name: 'the looper', label: 'take the looper out', row: plan.row, col: plan.col, steps: plan.undo } : null
            )
          }
        />
      )}
      {/* Undo for the last chain change: a block taken out, a looper put in. */}
      {chainUndo.bar}

      {/* Every row and every join — the phone's Rows and splits. See RowsPanel. */}
      {linear ? null : (
        <RowsPanel
          blocks={blocks}
          capabilities={capabilities}
          palette={palette}
          busy={busy || !!working}
          onChanged={onChanged}
          onError={onError}
        />
      )}
      {splitChain ? (
        <p className="hint">
          This preset uses more than one row. Each row&rsquo;s blocks are listed below; the joins
          between them are in Rows and splits above.
        </p>
      ) : null}

      {laneList(true)}

      <p className="hint">
        Placing blocks writes the preset&rsquo;s structure, not just its settings. Work on a slot
        you don&rsquo;t care about until the move has proved itself on your unit.
      </p>
    </section>
  )
}

/**
 * A row that is cut, under its name: the words, and Join the row where the
 * app can join it (shared/chain-move.mjs). A row joined again says so, with
 * nothing to press. The phone draws the same (Edit.js RowCut).
 */
function RowCut({ said, joining, disabled, onJoin }) {
  if (!said?.text) return null
  const canJoin = Array.isArray(said.joins) && said.joins.length > 0
  return (
    <div className="notice chain-cut" data-kind={said.tone === 'ok' ? 'did' : 'fault'} role="status">
      <p>{said.text}</p>
      {canJoin ? (
        <button type="button" className="chip" onClick={() => onJoin(said)} disabled={disabled}>
          {joining ? JOINING_ROW : JOIN_ROW}
        </button>
      ) : null}
    </div>
  )
}
