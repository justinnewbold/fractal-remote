/**
 * MOVING BLOCKS IN THE CHAIN EDITOR WITHOUT CUTTING THE ROW
 * (shared/chain-move.mjs; the phone's mobile/src/screens/Edit.js and the
 * browser's src/components/GridEditor.jsx).
 *
 * "Editing the chain, moving compressor after the NAM block caused the sound
 * to stop completely" (Justin, 16 November 2026, his Axe-Fx III through his
 * Raspberry Pi). The drag cleared four cells of row 3 and put four blocks
 * back, sent no join, and checked only where the blocks had gone; on a gen-3
 * unit a join lives in the cell it feeds, and the row most likely read "fed
 * from nothing" from column 2 on. He saved it so twice (preset 390).
 *
 * The demo's units join every block they place, so no test of a drag against
 * them could see this. These run against the mocks with `joinsAsOnUnit`,
 * which the demo never sets: a placed block joins nothing, and an emptied
 * cell takes the join INTO it with it (the joins out of it into the next
 * column stay), as his unit most likely did. The other way a unit may drop
 * joins, a clear that also takes the joins OUT of the cell, is `dropsOut`
 * below: a plain grid, for these tests only.
 *
 * What these hold: his drag, on his row, reads joined afterwards and sends
 * only the joins that went missing, each once; a drag whose joins the app
 * could not make again sends nothing at all; a row cut like his 390 is
 * offered "Join the row" and a preset with a parallel path is not; the
 * browser's drag is the phone's plan; the log says the row straight after
 * the move, before anything is mended; settings are measured and never
 * written, for his account only; and the demo is as it was. From the
 * reviews: Join the row only where the whole cut can be joined, and its
 * answer asks the pressed row again (its empty spaces always counted), so
 * "joined again" is said only of a row that reads whole, and never "sent"
 * of nothing sent; "put back" only where the read shows it, and every other
 * failure's words branch by branch; no join out of an Output or into an
 * Input, whether the ends are named or numbered only; every write held to
 * the preset where a hold is handed in, the first clear of a measured move
 * included, and nothing read as this preset's after it moved; a bare wire
 * before the moved blocks, a split and a merge, and on `dropsOut` a bare
 * wire after them and a split out of the first moved column; a cut the plan
 * did not cover, and a block the unit did not take, said after a move; an
 * Add that moves a block saying the space it left; the newest truth under
 * each row. From the fourth round: a move his settings' reads held back
 * before anything was sent said as one never sent, and the browser's read
 * after a move that sent nothing recording nothing; a block the unit did
 * not take said as "no sound past it" only between the row's Input and
 * Output, and past them as gone from the preset; and the row asked after a
 * move with the move's own rows, computer app and chain read (row 5
 * through 1.90.63 and 1.90.82, the top row, a space already in the row,
 * ends only the chain read names). From the fifth round: no join offered
 * into or out of a cell a move left empty, and a moved Output or Input the
 * unit did not take said as a row with no sound, with no button; a block
 * refused before the Input said as gone from the preset; Join the row
 * marking the chain written only once a join goes, and a press that sends
 * nothing recorded as no edit; a move a preset change stopped part-way
 * keeping its history line without marking the next preset unsaved. From
 * the sixth round: a moved Output or Input the unit did not take offers no
 * Join the row even beside a cut, and Join the row pressed on a row that
 * has lost its Output, or its Input, is never "joined again". From the
 * seventh: only an end the row HAD before the press counts, so a parallel
 * branch, or a row whose Output is on another row, is still joined again.
 * From the eighth: a move's note tells Join the row that the row had both
 * before the MOVE, so a move that failed part-way and did not bring the
 * Output (or Input) back is never "joined again" either.
 *
 * THE SCREENS ARE NOT RUN. Their calls into the plan are pinned by
 * patterns on the calls, not whole; the preset hold is pinned whole at
 * both ends, and the phone's is built from its own text and run. What they read and draw for a cut row
 * (the cut-row read, RowCut, where RowCut is drawn, the browser's read
 * after a write, the phone's read of the row a block left) is pinned
 * WHOLE, token for token, in the last test; the review's one-token mutants
 * of those places and of the reads' arguments (SP10-SP19, SB7-SB16, L5c,
 * L7, L8, L8b, L9) each fail here, as do the fourth and fifth rounds' own
 * of their fixes in this file (What's new's fail in test/whats-new.mjs).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const lib = () => import('../shared/chain-move.mjs')
const phoneLib = () => import('../mobile/src/lib/chain-move.js')
const phoneMock = () => import('../mobile/src/lib/mockDevice.js')
const webMock = () => import('../src/lib/mockDevice.js')

/* HIS ROW 3 OF PRESET 390, as the 12:10:58 Quick build read it back (row index 2). */
const R = 2
const ROW = [
  [37, 'Input 1'],
  [46, 'Comp 1'],
  [118, 'Drive 1'],
  [206, 'NAM 1'],
  [82, 'Flanger 1'],
  [42, 'Output 1']
]
const AX3 = { slotModel: 'grid', gridRouting: true, grid: { rows: 6, cols: 14 } }
/* His drag, as the first test works it out from his lane (Comp 1 let go after Flanger 1), for the tests that need no mock. */
const HIS_MOVES = [
  { id: 118, name: 'Drive 1', from: 2, to: 1 },
  { id: 206, name: 'NAM 1', from: 3, to: 2 },
  { id: 82, name: 'Flanger 1', from: 4, to: 3 },
  { id: 46, name: 'Comp 1', from: 1, to: 4 }
]
const BOTH = [
  ['the phone', () => import('../mobile/src/lib/chain-move.js')],
  ['the browser', () => import('../shared/chain-move.mjs')]
]
const SCREENS = [
  ['mobile/src/screens/Edit.js', 'the phone'],
  ['src/components/GridEditor.jsx', 'the browser']
]

/** A mock Axe-Fx III that does what his did, emptied, with his row on row 3: joined from Input to Output, or (`cut`) as 390 was saved. */
async function hisUnit(mod, { cut = false, asOnUnit = true } = {}) {
  const d = mod.createMockDevice('axefx3', { joinsAsOnUnit: asOnUnit })
  for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
  ROW.forEach(([id], col) => d.placeBlock(R, col, id))
  /* The joins: every one along the row, or (390) only the Output's, which the drag never cleared. */
  for (let col = 0; col < ROW.length - 1; col++) if (!cut || col === ROW.length - 2) d.cable(R, col, R, true)
  return d
}

/** A wire onto a mock that writes down every read and write, in order. */
function recorded(d, { readFails = false } = {}) {
  const sent = []
  const wire = {
    gridCells: () => {
      sent.push(['read'])
      if (readFails) throw new Error('no answer')
      return d.grid().cells
    },
    clearCell: (row, col) => (sent.push(['clear', row, col]), d.placeBlock(row, col, 0)),
    placeBlock: (row, col, id) => (sent.push(['place', row, col, id]), d.placeBlock(row, col, id)),
    setCable: (a, b, c, on) => (sent.push(['cable', a, b, c, on]), d.cable(a, b, c, on)),
    readBlock: (eid) => d.blockParams(eid)
  }
  return { wire, sent }
}

/** His drag, as the chain editor works it out: Comp 1 held by its ≡ and let go after Flanger 1. */
async function hisDrag(d) {
  const { lanesFor, laneItems } = await import('../shared/grid-plan.mjs')
  const { blockPositions, reorderPlan } = await import('../shared/lane-order.mjs')
  const lane = lanesFor(d.presetBlocks(), AX3).find((l) => l.row === R)
  const items = laneItems(lane)
  const pos = blockPositions(items, 1, 4)
  const names = new Map(ROW)
  return reorderPlan(
    items.filter((it) => it.kind === 'block').map((it) => ({ col: it.col, block: it.block })),
    pos.from,
    pos.to
  ).map((m) => ({ id: m.block.effectId, name: names.get(m.block.effectId), from: m.from, to: m.to }))
}

/** Any drag along his row, as the chain editor works it out: the item at `fromIndex` let go at `toIndex` (Input 0 … Output 5). */
async function laneDrag(d, fromIndex, toIndex) {
  const { lanesFor, laneItems } = await import('../shared/grid-plan.mjs')
  const { blockPositions, reorderPlan } = await import('../shared/lane-order.mjs')
  const lane = lanesFor(d.presetBlocks(), AX3).find((l) => l.row === R)
  const items = laneItems(lane)
  const pos = blockPositions(items, fromIndex, toIndex)
  const names = new Map(ROW)
  return reorderPlan(
    items.filter((it) => it.kind === 'block').map((it) => ({ col: it.col, block: it.block })),
    pos.from,
    pos.to
  ).map((m) => ({ id: m.block.effectId, name: names.get(m.block.effectId), from: m.from, to: m.to }))
}

const cables = (sent) => sent.filter((s) => s[0] === 'cable')
const writes = (sent) => sent.filter((s) => s[0] !== 'read')

/*
 * A UNIT THAT DROPS THE JOINS OUT OF A CELL IT EMPTIES, as well as the one
 * into it: one of the ways shared/chain-move.mjs says the unit may behave
 * ("the join of the cell after it too"), which the mocks do not model (an
 * emptied cell there takes only the join into it). A plain grid, for these
 * tests only, never the demo's: a clear takes the cell out and its row out of
 * every feed of the next column; a bare wire left fed from nothing stays a
 * bare wire (deleting it would turn a join into it into one into an empty
 * cell, which the app rightly never sends); a placed block joins nothing; a
 * join into an empty cell lays a bare wire.
 */
function dropsOut(start) {
  const grid = start.map((c) => ({ ...c, fromRows: c.fromRows.slice() }))
  const named = new Map(start.map((c) => [c.effectId, c.name]))
  const at = (r, c) => grid.findIndex((x) => x.row === r && x.col === c)
  const sent = []
  const wire = {
    gridCells: () => (sent.push(['read']), grid.map((c) => ({ ...c, fromRows: c.fromRows.slice() }))),
    clearCell: (row, col) => {
      sent.push(['clear', row, col])
      const i = at(row, col)
      if (i >= 0) grid.splice(i, 1)
      for (const c of grid) if (c.col === col + 1) c.fromRows = c.fromRows.filter((r) => r !== row)
      return { ok: true }
    },
    placeBlock: (row, col, id) => {
      sent.push(['place', row, col, id])
      const i = at(row, col)
      if (i >= 0) grid.splice(i, 1)
      if (id) grid.push({ row, col, effectId: id, name: named.get(id) || `Block ${id}`, fromRows: [] })
      return { ok: true }
    },
    setCable: (srcRow, srcCol, destRow, on = true) => {
      sent.push(['cable', srcRow, srcCol, destRow, on])
      const i = at(destRow, srcCol + 1)
      if (on && i >= 0 && !grid[i].fromRows.includes(srcRow)) grid[i].fromRows = [...grid[i].fromRows, srcRow].sort((a, b) => a - b)
      if (on && i < 0) grid.push({ row: destRow, col: srcCol + 1, effectId: 1024 + grid.length, name: 'Shunt', isShunt: true, fromRows: [srcRow] })
      if (!on && i >= 0) grid[i].fromRows = grid[i].fromRows.filter((r) => r !== srcRow)
      return { ok: true }
    }
  }
  return { grid, sent, wire }
}

/* A row of cells along row R from (id, name) pairs, each joined from the one before it (`fed`) or not. */
const rowOf = (pairs, { row = R, fed = true } = {}) =>
  pairs.map(([id, name], col) => (id === null ? null : { row, col, effectId: id, name, ...(id === 1024 ? { isShunt: true } : {}), fromRows: col === 0 || !fed ? [] : [row] })).filter(Boolean)

export function run(test) {
  test('chain move: his drag on a joined row 3 of an Axe-Fx III reads joined afterwards, and sends only the joins that went missing, each once', async () => {
    const { joinBreak } = await import('../shared/starter-chains.mjs')
    for (const [where, load] of [
      ['the phone', phoneLib],
      ['the browser', lib]
    ]) {
      const m = await load()
      const d = await hisUnit(await phoneMock())
      const moves = await hisDrag(d)
      /* The investigation's own reading of his log: Drive c3→c2, NAM c4→c3, Flanger c5→c4, Comp c2→c5. */
      assert.deepEqual(
        moves.map((x) => [x.name, x.from + 1, x.to + 1]),
        [
          ['Drive 1', 3, 2],
          ['NAM 1', 4, 3],
          ['Flanger 1', 5, 4],
          ['Comp 1', 2, 5]
        ]
      )
      const { wire, sent } = recorded(d)
      const lines = []
      /* The lane's own names, as the screens hand them in (the grid read calls a NAM block through the computer by its number). */
      const res = await m.moveBlocks({ row: R, moves, wire, rows: 6, cols: 14, cables: true, law: false, names: new Map(ROW), log: (a, b) => lines.push(b ? `${a} — ${b}` : a) })
      assert.equal(res.notSent, false, where)

      /* THE PLAN: the five joins from the Input to the Output, each once (planPutBack per column gave eight, three of them twice). */
      const keys = res.plan.joins.map((j) => `${j.srcRow}:${j.srcCol}>${j.destRow}`)
      assert.deepEqual(keys, ['2:0>2', '2:1>2', '2:2>2', '2:3>2', '2:4>2'], where)
      assert.equal(new Set(keys).size, keys.length, `${where}: a join is planned twice`)

      /* THE WRITES: the grid read before anything, the eight writes of the move, then only the four joins the read after it did not show. */
      assert.deepEqual(sent[0], ['read'], `${where}: something was written before the joins were read`)
      assert.deepEqual(
        writes(sent).slice(0, 8).map((s) => s[0]),
        ['clear', 'clear', 'clear', 'clear', 'place', 'place', 'place', 'place']
      )
      assert.deepEqual(
        cables(sent).map((s) => s.slice(1)),
        [
          [2, 0, 2, true],
          [2, 1, 2, true],
          [2, 2, 2, true],
          [2, 3, 2, true]
        ],
        `${where}: the joins sent are not the four that went missing, each once (the Output kept its own)`
      )
      assert.equal(res.sent, 4)
      assert.equal(res.missingAfterMove, 4)

      /* THE ROW READS JOINED, by the read Quick build's card goes by. */
      assert.deepEqual(res.still, [], `${where}: a join is still missing`)
      assert.equal(res.checked, true)
      assert.equal(joinBreak({ joined: true, row: R, span: { first: 0, last: 5 } }, d.grid().cells), null, `${where}: the row does not read joined after the move`)
      assert.deepEqual(
        d.grid().cells.filter((c) => c.row === R).sort((a, b) => a.col - b.col).map((c) => c.effectId),
        [37, 118, 206, 82, 46, 42],
        'the blocks are not where the drag put them'
      )

      /* THE LOG: the row before, straight after the move (before anything is mended: the line that settles what his unit does), and after. */
      const said = lines.join('\n')
      assert.match(said, /move: row 3 before: column 1 Input 1, column 2 Comp 1 \(fed from row 3\), column 3 Drive 1 \(fed from row 3\)/)
      assert.match(said, /move: row 3 straight after the move: column 1 Input 1, column 2 Drive 1 \(fed from nothing\), column 3 NAM 1 \(fed from nothing\), column 4 Flanger 1 \(fed from nothing\), column 5 Comp 1 \(fed from nothing\), column 6 Output 1 \(fed from row 3\)/)
      assert.match(said, /move: joins — 4 not there after the move \(row 3 column 1 → column 2; row 3 column 2 → column 3; row 3 column 3 → column 4; row 3 column 4 → column 5\); sent 4/)
      assert.match(said, /move: row 3 after joining it again: .*column 2 Drive 1 \(fed from row 3\).*column 5 Comp 1 \(fed from row 3\), column 6 Output 1 \(fed from row 3\)/)
      assert.ok(said.indexOf('straight after the move') < said.indexOf('move: joins'), 'the row was mended before it was written down as the unit left it')
      /* Columns from one, as the unit counts them. */
      assert.match(said, /clear Comp 1 from column 2 — ok/)
      assert.match(said, /place Comp 1 at column 5 — ok/)
    }

    /* A UNIT THAT KEEPS A JOIN THROUGH A CLEAR (the demo's rule): the same drag sends no join at all, and the log says so. */
    const m = await lib()
    const d = await hisUnit(await phoneMock(), { asOnUnit: false })
    const { wire, sent } = recorded(d)
    const lines = []
    const res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire, rows: 6, cols: 14, log: (a, b) => lines.push(b ? `${a} — ${b}` : a) })
    assert.equal(cables(sent).length, 0, 'a join that was still there was sent again')
    assert.match(lines.join('\n'), /move: joins — all 5 still there after the move, none sent/)
    assert.deepEqual(res.still, [])
  })

  test('chain move: a drag whose joins could not be made again sends nothing at all', async () => {
    const m = await lib()
    const mod = await phoneMock()

    /* THE TOP ROW OF A SIX-ROW UNIT, out of an even column: the join into a moved block cannot be built. */
    const d = mod.createMockDevice('axefx3', { joinsAsOnUnit: true })
    for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
    ;[37, 46, 118, 82, 42].forEach((id, col) => d.placeBlock(0, col, id))
    for (let col = 0; col < 4; col++) d.cable(0, col, 0, true)
    const swap = [
      { id: 82, name: 'Flanger 1', from: 3, to: 2 },
      { id: 118, name: 'Drive 1', from: 2, to: 3 }
    ]
    let rec = recorded(d)
    let res = await m.moveBlocks({ row: 0, moves: swap, wire: rec.wire, rows: 6, cols: 14 })
    assert.equal(res.notSent, true)
    assert.deepEqual(writes(rec.sent), [], 'a move was written whose join out of the top row the app cannot make again')
    assert.match(res.why, /^Nothing was moved: moving these blocks would cut the row, and the app couldn’t join it again\. The app can’t join the top row out of column 2\./)
    /* Nothing on the unit changed. */
    assert.deepEqual(
      d.grid().cells.filter((c) => c.row === 0).map((c) => [c.col, c.effectId, c.fromRows]),
      [
        [0, 37, []],
        [1, 46, [0]],
        [2, 118, [0]],
        [3, 82, [0]],
        [4, 42, [0]]
      ]
    )

    /* ROW 2 THROUGH A COMPUTER APP OLDER THAN 1.90.82, which sends a row-2 join to the wrong cell: refused, nothing sent. */
    const d2 = mod.createMockDevice('axefx3', { joinsAsOnUnit: true })
    for (const b of d2.presetBlocks()) d2.placeBlock(b.row, b.col, 0)
    ;[37, 46, 118, 82, 42].forEach((id, col) => d2.placeBlock(1, col, id))
    for (let col = 0; col < 4; col++) d2.cable(1, col, 1, true)
    rec = recorded(d2)
    res = await m.moveBlocks({ row: 1, moves: swap, wire: rec.wire, rows: 6, cols: 14, law: m.oldCableBytes('1.90.63'), version: '1.90.63' })
    assert.equal(res.notSent, true)
    assert.deepEqual(writes(rec.sent), [], 'a row-2 move went through a computer app that sends its joins to the wrong cell')
    assert.match(res.why, /The computer app on 1\.90\.63 sends the join into row 2 at column 3 to the wrong place\. Update the computer app to 1\.90\.82 or later\./)
    /* One that does not say its version is taken for an old one. */
    assert.equal(m.oldCableBytes(null), true)
    assert.equal(m.oldCableBytes('1.90.82'), false)
    assert.equal(m.oldCableBytes('1.91.5'), false)
    /* Through a computer app that builds them right, the same move goes, and the row reads joined. */
    rec = recorded(d2)
    res = await m.moveBlocks({ row: 1, moves: swap, wire: rec.wire, rows: 6, cols: 14, law: m.oldCableBytes('1.90.82') })
    assert.equal(res.notSent, false)
    assert.deepEqual(res.still, [])

    /* HIS ROW 3 THROUGH HIS PI ON 1.90.63 IS SAFE: along rows 3 and 4 the old bytes and the right ones are the same. */
    const d3 = await hisUnit(mod)
    rec = recorded(d3)
    res = await m.moveBlocks({ row: R, moves: await hisDrag(d3), wire: rec.wire, rows: 6, cols: 14, law: true, version: '1.90.63' })
    assert.equal(res.notSent, false, 'his own row is refused through his own Pi')
    assert.deepEqual(res.still, [])

    /* A GRID THAT COULD NOT BE READ, OR A CHAIN THAT CHANGED UNDER THE SCREEN: nothing sent either. */
    const d4 = await hisUnit(mod)
    rec = recorded(d4, { readFails: true })
    res = await m.moveBlocks({ row: R, moves: await hisDrag(d4), wire: rec.wire, rows: 6, cols: 14 })
    assert.equal(res.notSent, true)
    assert.equal(res.why, m.NOT_READ_BEFORE)
    assert.deepEqual(writes(rec.sent), [])
    rec = recorded(d4)
    res = await m.moveBlocks({ row: R, moves: [{ id: 46, name: 'Comp 1', from: 3, to: 1 }, { id: 206, name: 'NAM 1', from: 1, to: 3 }], wire: rec.wire, rows: 6, cols: 14 })
    assert.equal(res.notSent, true)
    assert.equal(res.why, m.CHAIN_CHANGED)
    assert.deepEqual(writes(rec.sent), [])

    /* AND THE SCREENS SEND NOTHING ON A REFUSAL: they go through moveBlocks, and a refusal returns before anything else. */
    for (const [file, name] of [
      ['mobile/src/screens/Edit.js', 'the phone'],
      ['src/components/GridEditor.jsx', 'the browser']
    ]) {
      const text = code(read(file))
      const move = flat(text.slice(text.indexOf('const reorder = async'), text.indexOf('const reorder = async') + 6000))
      assert.match(move, /const res = await moveBlocks\(\{ row: lane\.row, moves: steps, wire: moveWire,.*?cables: joinsHere, law: oldBytes\(\),/, `${name}: the drag does not go through the shared plan`)
      /* The refusal's inputs: the unit's own grid (a six-row unit's rows, or the plan takes four and lets a top-row move through), and on the phone an older computer app taken as one. */
      const shape = name === 'the phone' ? 'rows: gridRows, cols: gridCols,' : 'rows, cols,'
      assert.ok(move.includes(`wire: moveWire, ${shape} cables: joinsHere, law: oldBytes(),`), `${name}: the drag is not planned on the unit's own grid`)
      if (name === 'the phone') assert.match(flat(text), /const oldBytes = \(\) => !isDemo\(\) && linkVia\(\) === 'computer' && oldCableBytes\(linkState\(\)\.hostVersion\)/, 'the phone: an older computer app is not taken as one')
      /* And the joins kept only where they are the app's to make (cablesLaid): a gate that is always false is the 16 November bug back with every test green. */
      assert.match(flat(text), /const joinsHere = cablesLaid\((?:caps|capabilities)\)/, `${name}: the joins are not kept on the units that need them (joinsHere is not cablesLaid)`)
      assert.match(move, /if \(res\.notSent\) \{ (?:setSettling\(null\) )?(?:if \(res\.stopped\) followPresetAfterChainWrite\(\) )?if \(res\.why\) leaveRow\(lane\.row, \{ text: res\.why, joins: \[\], n \}\)/, `${name}: a refused move is not said under its row`)
      const refusal = move.slice(move.indexOf('if (res.notSent) {'), move.indexOf('const said = afterMoveSaid')).trim()
      assert.ok(refusal.endsWith('return }') && !/\b(?:clearCell|placeBlock|setCable|after)\(/.test(refusal), `${name}: a refused move goes on`)
      assert.ok(!/\b(?:clearCell|placeBlock|setCable)\(/.test(move.slice(0, move.indexOf('if (res.notSent)'))), `${name}: something is written before the plan is asked`)
      /* A refused move keeps the Undo of the last change: it is dropped only once something is about to be written (moveBlocks' `starting`). */
      assert.ok(!/chainUndo\.clear\(\)/.test(move.slice(0, move.indexOf('const res = await moveBlocks'))), `${name}: the Undo is dropped before the move is known to be sent`)
      assert.match(move, /starting: \(\) => (?:\{ )?chainUndo\.clear\(\)/, `${name}: the Undo of the last change outlives a move that was sent`)
    }
  })

  test('chain move: a row cut like his preset 390 is offered “Join the row”, and a preset with a parallel path is not', async () => {
    const m = await lib()
    const mod = await phoneMock()
    const { joinBreak } = await import('../shared/starter-chains.mjs')

    /* 390 AS HE SAVED IT: the blocks in, every one between the Input and the Output fed from nothing. */
    const d = await hisUnit(mod, { cut: true })
    assert.equal(m.maybeCut(d.presetBlocks()), true, 'the chain read alone does not see that the row might be cut')
    const cuts = m.rowCuts({ cells: d.grid().cells, blocks: d.presetBlocks(), rows: 6 })
    assert.equal(cuts.length, 1)
    assert.equal(cuts[0].row, R)
    assert.equal(cuts[0].col, 1)
    assert.equal(cuts[0].text, 'Row 3 isn’t joined at column 2, so there’s no sound past it.')
    assert.deepEqual(
      cuts[0].joins.map((j) => [j.srcRow, j.srcCol, j.destRow]),
      [
        [2, 0, 2],
        [2, 1, 2],
        [2, 2, 2],
        [2, 3, 2]
      ],
      'each cell fed from nothing is not joined from the one before it'
    )
    /* The button: those joins, then the row read again. */
    const { wire, sent } = recorded(d)
    const lines = []
    const joined = await m.joinRow({ row: R, joins: cuts[0].joins, wire, log: (a, b) => lines.push(b ? `${a} — ${b}` : a) })
    assert.equal(joined.sent, 4)
    assert.deepEqual(joined.still, [])
    assert.equal(joinBreak({ joined: true, row: R, span: { first: 0, last: 5 } }, d.grid().cells), null, 'Join the row left the row cut')
    assert.deepEqual(m.joinedWords({ row: R, still: joined.still, checked: joined.checked }), { ok: true, text: 'Row 3 is joined again.' })
    assert.match(lines.join('\n'), /join the row: row 3 before: column 1 Input 1, column 2 Comp 1 \(fed from nothing\)/)
    assert.equal(m.rowCuts({ cells: d.grid().cells, blocks: d.presetBlocks(), rows: 6 }).length, 0, 'a joined row is still offered Join the row')
    /* Pressed again on a row already joined, it sends nothing. */
    const again = recorded(d)
    await m.joinRow({ row: R, joins: cuts[0].joins, wire: again.wire })
    assert.equal(cables(again.sent).length, 0)

    /*
     * A PARALLEL PATH: row 3 splits into row 4 at column 3 and comes back at
     * the Output. Its Delay is fed from nothing ON ITS ROW, as a block on a
     * path that goes round it may be, and the row is not cut: never offered.
     */
    const p = mod.createMockDevice('axefx3', { joinsAsOnUnit: true })
    for (const b of p.presetBlocks()) p.placeBlock(b.row, b.col, 0)
    ;[37, 58, 70, 42].forEach((id, col) => p.placeBlock(R, col, id))
    p.placeBlock(R + 1, 2, 66)
    p.cable(R, 0, R, true)
    p.cable(R, 1, R + 1, true)
    p.cable(R + 1, 2, R, true)
    p.cable(R, 2, R, true)
    const cells = p.grid().cells
    assert.deepEqual(cells.find((c) => c.row === R && c.col === 2).fromRows, [])
    assert.deepEqual(cells.find((c) => c.row === R && c.col === 3).fromRows, [R, R + 1])
    assert.deepEqual(m.rowCuts({ cells, blocks: p.presetBlocks(), rows: 6 }), [], 'a preset with a parallel path is offered Join the row')

    /* A row whose feeds the read did not say is left alone, and so is a unit with no joins to make. */
    assert.deepEqual(m.rowCuts({ cells: d.grid().cells.map((c) => ({ ...c, fromRows: undefined })), blocks: d.presetBlocks(), rows: 6 }), [])
    assert.equal(m.cablesLaid({ slotModel: 'linear', slotCount: 4 }), false, 'an AM4')
    assert.equal(m.cablesLaid({ slotModel: 'linear', slotCount: 4, gridRouting: false }), false, 'a VP4')
    assert.equal(m.cablesLaid({ slotModel: 'grid', gridRouting: false, grid: { rows: 4, cols: 12 } }), false, 'an Axe-Fx II')
    assert.equal(m.cablesLaid(AX3), true)
    assert.equal(m.cablesLaid({ slotModel: 'grid', grid: { rows: 4, cols: 12 } }), true, 'the demo’s FM3')
    assert.equal(m.cablesLaid(null), false)
    /* A join the app cannot make is said, with no button for it. */
    const top = m.rowCuts({
      cells: [
        { row: 0, col: 0, effectId: 37, name: 'Input 1', fromRows: [] },
        { row: 0, col: 1, effectId: 46, name: 'Comp 1', fromRows: [0] },
        { row: 0, col: 2, effectId: 118, name: 'Drive 1', fromRows: [] },
        { row: 0, col: 3, effectId: 42, name: 'Output 1', fromRows: [0] }
      ],
      rows: 6
    })
    assert.equal(top.length, 1)
    assert.deepEqual(top[0].joins, [])
    assert.match(top[0].text, /^Row 1 isn’t joined at column 3, so there’s no sound past it\. The app can’t join the top row out of column 2\.$/)

    /* THE SCREENS: looked for whenever the chain is read, first from the chain read, and drawn under the row with Join the row. */
    for (const [file, name] of [
      ['mobile/src/screens/Edit.js', 'the phone'],
      ['src/components/GridEditor.jsx', 'the browser']
    ]) {
      const text = flat(code(read(file)))
      assert.match(text, /if \(!joinsHere \|\| !maybeCut\(blocks\)\) \{ setCutRows\(\[\]\) return undefined \}/, `${name}: the grid is read for a cut row on every chain read, or never`)
      assert.match(text, /const cuts = rowCuts\(\{ cells, blocks, rows(?:: gridRows)?, law: oldBytes\(\), version: /, `${name}: a cut row is not looked for`)
      assert.match(text, /<RowCut said=\{rowNote\(leftUnder\[lane\.row\], cutRows\.find\(\(c\) => c\.row === lane\.row\), (?:presetHere|chainNow\.number)\)\}/, `${name}: a cut row is not said under its row, or an old note hides it`)
      assert.match(text, /joining \? JOINING_ROW : JOIN_ROW/, `${name}: there is no Join the row`)
      assert.match(text, /const r = await joinRow\(\{ row: cut\.row, joins: cut\.joins, wire: moveWire,/, `${name}: Join the row does not send the joins`)
      /* And asks the row again as it was found, held to the preset, and says what that read shows. */
      assert.match(text, /const r = await joinRow\(\{ row: cut\.row, joins: cut\.joins, wire: moveWire, log: chainLog, names: [^}]*?\}?\)?\)?, blocks, rows(?:: gridRows)?, law: oldBytes\(\), version: [^,]+, onPreset: presetHeld\(n\)(?:, starting: \(\) => beginChainWrite\(\))? \}\)/, `${name}: Join the row does not ask the row again`)
      assert.match(text, /const w = joinedWords\(r\) leaveRow\(cut\.row, w\.ok \? \{ text: w\.text, joins: \[\], tone: 'ok', n \} : \{ text: w\.text, joins: w\.joins \?\? cut\.joins,/, `${name}: Join the row's words are not its own answer's`)
      /* A write to a row outdates what the last read found there, and every write to a row clears what was said under it. */
      assert.match(text, /const leaveRow = \(row, said\) => \{ setLeftUnder\(.*?\) setCutRows\(\(was\) => \(was\.some\(\(c\) => c\.row === row\) \? was\.filter\(\(c\) => c\.row !== row\) : was\)\) \}/, `${name}: a row's old read outlives a write to it`)
      const fn = (start) => text.slice(text.indexOf(start), text.indexOf(start) + 1500)
      if (name === 'the phone') {
        assert.match(fn('const add = async'), /leaveRow\(row, null\) if \(was && was\.row !== row\) leaveRow\(was\.row, null\)/, `${name}: an Add leaves an old note up under the row it wrote to, or the row its block left`)
      } else {
        assert.match(fn('const add = async'), /const was = \(blocks \|\| \[\]\)\.find\(\(b\) => b\.effectId === Number\(choice\) && !\(b\.row === row && b\.col === col\)\) \|\| null const touched = was \? \[\.\.\.new Set\(\[row, was\.row\]\)\] : \[row\] for \(const r of touched\) leaveRow\(r, null\)/, `${name}: an Add leaves an old note up under the row it wrote to, or the row its block left`)
      }
      assert.match(fn('const remove = async'), /leaveRow\(row, null\)/, `${name}: a Remove leaves the row's old note up`)
      assert.match(text, /useChainUndo\(\{ [^}]*?onWrite: \(row\) => leaveRow\(row, null\) \}\)/, `${name}: an Undo leaves the row's old note up`)
    }
    for (const file of ['mobile/src/components/ChainUndo.js', 'src/components/ChainUndo.jsx']) {
      assert.match(flat(code(read(file))), /setRunning\(true\) onWrite\?\.\(u\.kind === 'put' \? u\.back\.row : u\.row\)/, `${file}: the undo does not say which row it writes`)
    }
    /* Never over Bluetooth: the chain editor is not drawn there. */
    assert.match(flat(read('mobile/src/screens/Edit.js')), /const chainTools = !vp4Bench\(\) && !viaBle && !chainNow\.elsewhere/)
  })

  test('chain move: the browser’s drag is the phone’s plan, and its tap-to-move and Replace say a row they leave cut', async () => {
    const m = await lib()
    /* The browser's own mock, the same drag: the same writes in the same order. */
    const sentBy = async (mod) => {
      const d = await hisUnit(mod)
      const { wire, sent } = recorded(d)
      const res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire, rows: 6, cols: 14 })
      assert.deepEqual(res.still, [])
      return writes(sent)
    }
    const web = await sentBy(await webMock())
    assert.deepEqual(web, await sentBy(await phoneMock()), 'the browser and the phone send a different drag')
    assert.equal(cables(web).length, 4)

    const grid = read('src/components/GridEditor.jsx')
    const text = flat(code(grid))
    /* One plan: the browser imports the shared file, and the phone its generated copy. */
    assert.match(grid, /from '\.\.\/\.\.\/shared\/chain-move\.mjs'/)
    assert.match(read('mobile/src/screens/Edit.js'), /from '\.\.\/lib\/chain-move'/)
    assert.match(read('mobile/src/lib/chain-move.js'), /^\/\* Generated from shared\/chain-move\.mjs by scripts\/sync-relay-rules\.mjs\./)
    /* The grid read is the one with the bare wires and every cell's feeds. */
    assert.match(text, /const gridNow = \(\) => readGrid\(\)\.then\(\(g\) => \(Array\.isArray\(g\?\.cells\) \? g\.cells : null\)\)/)
    assert.match(text, /const moveWire = \{ gridCells: gridNow, clearCell, placeBlock, setCable, readBlock: blockParams \}/)
    /* The drag writes nothing of its own: every write is the plan's. */
    const reorder = text.slice(text.indexOf('const reorder = async'), text.indexOf('const gripDown'))
    assert.ok(!/\b(?:clearCell|placeBlock|setCable)\(/.test(reorder), 'the browser’s drag writes around the plan')
    /* Its landed line counts from one. */
    assert.match(reorder, /logDebug\('chain', `\$\{m\.block\.name\}: column \$\{label\(m\.from\)\} → \$\{label\(m\.to\)\}`/)
    assert.ok(!/column \$\{m\.from\} → \$\{m\.to\}/.test(grid), 'the landed line still counts from nought')
    /* Tap-to-move reads the joins of both rows after, the space it left counted; Add and Replace the row they wrote. */
    assert.match(text, /const touched = \[\.\.\.new Set\(\[from\.row, to\.row\]\)\]/)
    assert.match(text, /await checkRows\(touched, \{ holes: true, what: 'move' \}\)/, 'a tap-to-move does not read the row back')
    /* An Add or a Replace reads back the row it wrote, and an Add that MOVED a block (the list offers every block, and a unit has one of each) the row it left too, its empty space counted; a plain Add counts none. */
    assert.match(text, /await checkRows\(touched, \{ holes: !!was, what: 'add' \}\)/, 'a Replace, or an Add that moves a block, does not read its rows back')
    assert.match(text, /const cuts = rowCuts\(\{ cells, blocks, rows, law: oldBytes\(\), version: cablesVersion\(\), holes, only: touched \}\)/)
    /* Through the relay to an older computer app, or the hosted website beside one on the same computer, the old bytes (builtElsewhere); the computer's own window and Wi-Fi page are this release. */
    assert.match(text, /const elsewhere = \(\) => builtElsewhere\(\{ role: linkState\(\)\?\.role, served: servedLocally\(\) \}\) const cablesVersion = \(\) => \(elsewhere\(\) \? linkState\(\)\.macVersion : null\) const oldBytes = \(\) => !isDemo\(\) && elsewhere\(\) && oldCableBytes\(linkState\(\)\.macVersion\)/)

    /* A block moved out of the middle of a row leaves a space nothing joins across: said, with no button. */
    const mod = await webMock()
    const d = await hisUnit(mod)
    d.placeBlock(R, 3, 0)
    d.placeBlock(R + 1, 3, 206)
    const cuts = m.rowCuts({ cells: d.grid().cells, blocks: d.presetBlocks(), rows: 6, holes: true, only: [R, R + 1] })
    assert.equal(cuts.length, 1)
    assert.equal(cuts[0].col, 3)
    assert.deepEqual(cuts[0].joins, [])
    assert.match(cuts[0].text, /^Row 3 has an empty space at column 4 between its Input and Output, so the sound may stop there\./)
    /* Replace: the new block over a joined one comes in fed from nothing on this unit, and the row says so, with the join to make. */
    const r = await hisUnit(mod)
    r.placeBlock(R, 2, 119)
    const replaced = m.rowCuts({ cells: r.grid().cells, blocks: r.presetBlocks(), rows: 6, only: [R] })
    assert.equal(replaced.length, 1)
    assert.deepEqual(replaced[0].joins.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[2, 1, 2]])
  })

  test('chain move: the joins the app makes are lib/gen3-grid’s, cell for cell', async () => {
    const m = await lib()
    const g = await import('../mobile/src/lib/gen3-grid.js')
    const { MODELS } = await import('../mobile/src/lib/fractal-sysex.mjs')
    for (const [model, rows, cols] of [
      [MODELS.fm3, 4, 12],
      [MODELS.axefx3, 6, 14],
      [MODELS.fm9, 6, 14]
    ]) {
      for (let srcRow = 0; srcRow < rows; srcRow++) {
        for (let srcCol = 0; srcCol < cols - 1; srcCol++) {
          for (let destRow = 0; destRow < rows; destRow++) {
            assert.equal(m.joinMakeable(rows, srcRow, srcCol), g.cableKnown(model, srcRow + 1, srcCol + 1, destRow + 1), `makeable ${rows} rows, r${srcRow} c${srcCol} → r${destRow}`)
            assert.equal(m.joinAsTheLaw(rows, srcCol, destRow), g.cableAsTheLaw(rows, srcCol + 1, destRow + 1), `law ${rows} rows, c${srcCol} → r${destRow}`)
          }
        }
      }
    }
  })

  test('chain move: settings are measured before and after, in the log only, and never written', async () => {
    const m = await lib()
    /* A NAM block whose capture comes back at the default, and a Comp whose knob does not change. */
    const reads = new Map([
      [206, [{ capture: { slot: 39 }, named: [{ id: 1, name: 'Level', value: 0 }] }, { capture: { slot: 0 }, named: [{ id: 1, name: 'Level', value: 0 }] }]],
      [46, [{ type: { value: 3, name: 'Studio Comp' }, named: [{ id: 2, name: 'Threshold', value: -20 }] }, { type: { value: 3, name: 'Studio Comp' }, named: [{ id: 2, name: 'Threshold', value: -20 }] }]]
    ])
    const d = await hisUnit(await phoneMock())
    const { wire, sent } = recorded(d)
    wire.readBlock = (eid) => (reads.get(eid) || []).shift() || null
    const lines = []
    await m.moveBlocks({ row: R, moves: await hisDrag(d), wire, rows: 6, cols: 14, measure: true, log: (a, b) => lines.push(b ? `${a} — ${b}` : a) })
    const said = lines.join('\n')
    assert.match(said, /move: NAM 1 before: capture 040, Level 0/)
    assert.match(said, /move: NAM 1 after: capture 001, Level 0 \(was capture 040, Level 0\)/)
    assert.match(said, /move: Comp 1 before: model Studio Comp, Threshold -20/)
    assert.match(said, /move: Comp 1 after: model Studio Comp, Threshold -20 \(the same\)/)
    assert.match(said, /move: Drive 1 before: not read/)
    /* Measured before anything is cleared, and after everything is mended. */
    assert.ok(said.indexOf('NAM 1 before') < said.indexOf('clear '), 'a block was read after it was taken out')
    assert.ok(said.indexOf('NAM 1 after') > said.indexOf('move: joins'))
    /* Nothing but the move and its joins goes to the unit. */
    assert.deepEqual([...new Set(writes(sent).map((s) => s[0]))].sort(), ['cable', 'clear', 'place'])
    assert.equal(m.settingsSaid(null), 'not read')
    assert.equal(m.settingsSaid({ capture: { slot: null } }), 'capture not said')
    /* Nothing on the screen says whether settings were kept: none of the words drawn names them. */
    const words = [
      m.cutAfterMove({ srcRow: 2, srcCol: 0, destRow: 2 }),
      m.uncheckedAfterMove(2),
      m.putBackCut({ srcRow: 2, srcCol: 0, destRow: 2 }),
      m.uncheckedPutBack(2),
      m.cutRowWords(2, 1),
      m.holeWords(2, 3),
      m.joinedWords({ row: 2, still: [], checked: true }).text,
      m.NOT_READ_BEFORE,
      m.PRESET_MOVED_BEFORE,
      m.PRESET_MOVED_MID,
      m.UNIT_QUIET_MID,
      m.CHAIN_CHANGED,
      m.WIRING_UNKNOWN
    ]
    for (const w of words) assert.ok(!/setting|capture|knob|default/i.test(w), `the screen speaks of settings: ${w}`)
    assert.equal(m.cutAfterMove({ srcRow: 2, srcCol: 0, destRow: 2 }), 'The blocks moved, but row 3 isn’t joined at column 2, so there’s no sound past it.')
  })

  test('chain move: a move that fails part-way puts the blocks back and joins them again', async () => {
    const m = await lib()
    const d = await hisUnit(await phoneMock())
    const { wire, sent } = recorded(d)
    const place = wire.placeBlock
    let n = 0
    /* The third placement throws (the link drops), and only that one. */
    wire.placeBlock = (row, col, id) => {
      n += 1
      if (n === 3) {
        sent.push(['throw'])
        throw new Error('The computer stopped answering.')
      }
      return place(row, col, id)
    }
    const lines = []
    const res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire, rows: 6, cols: 14, log: (a, b) => lines.push(b ? `${a} — ${b}` : a) })
    assert.equal(res.threw?.message, 'The computer stopped answering.')
    /* Every block back where it was, and the row joined again from the read before the move. */
    assert.deepEqual(
      d.grid().cells.filter((c) => c.row === R).sort((a, b) => a.col - b.col).map((c) => c.effectId),
      ROW.map(([id]) => id)
    )
    assert.deepEqual(res.still, [], 'the blocks went back with their joins cut')
    assert.ok(cables(sent).length > 0)
    assert.match(lines.join('\n'), /move: row 3 straight after putting the blocks back: /)
    /* And the screens say it under the row where a join is still missing. */
    /* Put back, and read back so: the words go no further than "the blocks were put back" where nothing is cut, and nothing is said under the row. */
    assert.deepEqual(res.missingBack, [])
    const words = m.afterMoveSaid({ row: R, res })
    assert.deepEqual(words, { issue: 'The computer stopped answering.', note: null, line: 'A move on row 3 failed and its blocks were put back' })
    for (const file of ['mobile/src/screens/Edit.js', 'src/components/GridEditor.jsx']) {
      const text = flat(code(read(file)))
      assert.match(text, /const said = afterMoveSaid\(\{ row: lane\.row, res \}\)/, `${file}: a move's words are not the shared ones`)
      assert.match(text, /if \(said\.note\) leaveRow\(lane\.row, \{ \.\.\.said\.note, n \}\)/, `${file}: what a move left is not said under its row`)
      assert.match(text, /if \(res\.threw[^)]*\) \{ [^}]*?setIssue\(said\.issue\)/, `${file}: a failed move does not say what it left`)
    }
  })

  test('chain move: the demo is as it was, and only the tests ask the mock to drop joins', async () => {
    for (const load of [phoneMock, webMock]) {
      const d = (await load()).createMockDevice('axefx3')
      for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
      d.placeBlock(R, 0, 37)
      d.placeBlock(R, 1, 46)
      assert.deepEqual(d.grid().cells.find((c) => c.col === 1).fromRows, [R], 'the demo’s placed block is no longer joined to its row')
      const strict = (await load()).createMockDevice('axefx3', { joinsAsOnUnit: true })
      strict.placeBlock(R, 1, 46)
      assert.deepEqual(strict.grid().cells.find((c) => c.row === R && c.col === 1).fromRows, [])
    }
    for (const file of ['mobile/src/lib/demo.js', 'src/lib/forgefx.js']) {
      assert.ok(!/joinsAsOnUnit/.test(read(file)), `${file} asks the demo to drop joins`)
    }
  })

  test('chain move: the stale word that a drag cannot disturb the joins is gone from both editors', () => {
    for (const file of ['mobile/src/screens/Edit.js', 'src/components/GridEditor.jsx']) {
      const text = flat(read(file))
      assert.ok(!/shuffling a row cannot disturb/.test(text), `${file} still says a move cannot disturb the joins`)
      assert.match(text, /MOVING BLOCKS WITHIN A ROW CAN CUT IT/, file)
    }
    /* The phone's landed line counts from one too. */
    const edit = read('mobile/src/screens/Edit.js')
    /* Each component's own note sits over it: Told's over Told (it was left stranded over RowCut), and RowCut's names the ink it draws in (the hint grey, never green). */
    assert.match(flat(edit), /\/\*\* What the last Add or Remove did, [^/]*?\*\/ function Told\(/, 'Told’s note is not over Told')
    assert.ok(!/in green/.test(edit.slice(edit.indexOf('A row that is cut, under its name'), edit.indexOf('function RowCut('))), 'RowCut’s note says green; it draws in the hint grey')
    assert.match(edit, /logDebug\('chain', `\$\{m\.block\.name\}: column \$\{colLabel\(m\.from\)\} → \$\{colLabel\(m\.to\)\}`/)
    assert.ok(!/column \$\{m\.from\} → \$\{m\.to\}/.test(edit))
  })

  test('chain move: Join the row is offered only where the app can join the whole cut, and “joined again” only of a row that reads whole', async () => {
    const m = await lib()
    const mod = await phoneMock()
    /* THE TOP ROW OF A SIX-ROW UNIT, CUT LIKE 390 (only the Output's join kept): two of its four joins the app can make, two it cannot. */
    const top = mod.createMockDevice('axefx3', { joinsAsOnUnit: true })
    for (const b of top.presetBlocks()) top.placeBlock(b.row, b.col, 0)
    ROW.forEach(([id], col) => top.placeBlock(0, col, id))
    top.cable(0, 4, 0, true)
    const cuts = m.rowCuts({ cells: top.grid().cells, blocks: top.presetBlocks(), rows: 6 })
    assert.equal(cuts.length, 1)
    assert.deepEqual(cuts[0].joins, [], 'Join the row is offered on a row half of whose joins the app cannot make')
    assert.equal(cuts[0].blocked.length, 2)
    assert.equal(cuts[0].text, 'Row 1 isn’t joined at column 2, so there’s no sound past it. The app can’t join the top row out of column 2.', 'the words do not say why part of the row cannot be joined')

    /* ROW 5 THROUGH HIS PI ON 1.90.63, cut the same way: the old computer app would send two of its joins to the wrong cell. */
    const five = mod.createMockDevice('axefx3', { joinsAsOnUnit: true })
    for (const b of five.presetBlocks()) five.placeBlock(b.row, b.col, 0)
    ROW.forEach(([id], col) => five.placeBlock(4, col, id))
    five.cable(4, 4, 4, true)
    const old = m.rowCuts({ cells: five.grid().cells, blocks: five.presetBlocks(), rows: 6, law: true, version: '1.90.63' })
    assert.deepEqual(old[0].joins, [], 'Join the row is offered through a computer app that sends some of its joins to the wrong cell')
    assert.match(old[0].text, /The computer app on 1\.90\.63 sends the join into row 5 at column 3 to the wrong place\./)
    /* Through one that builds them right, the whole row is offered, and joins. */
    assert.equal(m.rowCuts({ cells: five.grid().cells, blocks: five.presetBlocks(), rows: 6, law: false })[0].joins.length, 4)

    /* A BLOCK FED FROM NOTHING WITH AN EMPTY CELL BEFORE IT: nothing to join it from, said, and no button. */
    const gap = await hisUnit(mod)
    gap.placeBlock(R, 2, 0)
    gap.placeBlock(R, 3, 206)
    const gapCuts = m.rowCuts({ cells: gap.grid().cells, blocks: gap.presetBlocks(), rows: 6 })
    assert.equal(gapCuts.length, 1)
    assert.deepEqual(gapCuts[0].joins, [], 'Join the row is offered over a cut nothing can be joined into')
    assert.equal(gapCuts[0].text, 'Row 3 isn’t joined at column 4, so there’s no sound past it. Column 3 is empty, so there’s nothing to join column 4 from.')

    /* JOIN THE ROW ASKS THE ROW AGAIN: handed half of 390's joins (a note from before a later change), it sends them and does not call the row joined while the read still finds it cut. */
    const half = await hisUnit(mod, { cut: true })
    const all = m.rowCuts({ cells: half.grid().cells, blocks: half.presetBlocks(), rows: 6 })[0].joins
    const { wire } = recorded(half)
    const r = await m.joinRow({ row: R, joins: all.slice(0, 2), wire, blocks: half.presetBlocks(), rows: 6 })
    assert.equal(r.sent, 2)
    assert.deepEqual(r.still, [])
    const w = m.joinedWords(r)
    assert.equal(w.ok, false, '“Row 3 is joined again” over a row that still reads cut')
    assert.equal(w.text, 'Row 3 isn’t joined at column 4, so there’s no sound past it.')
    assert.deepEqual(w.joins.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[2, 2, 2], [2, 3, 2]], 'the rest of the row is not offered')
    /* And the rest joins it, and only then is it joined again. */
    const rest = await m.joinRow({ row: R, joins: w.joins, wire, blocks: half.presetBlocks(), rows: 6 })
    assert.deepEqual(m.joinedWords(rest), { ok: true, text: 'Row 3 is joined again.' })

    /* AN EMPTY SPACE LEFT BY A TAP-TO-MOVE: the cut after it is joined, and the space is still said, never "joined again". */
    const tap = await hisUnit(mod)
    tap.placeBlock(R, 1, 0)
    tap.placeBlock(R, 4, 0)
    tap.placeBlock(R, 4, 46)
    const tapCuts = m.rowCuts({ cells: tap.grid().cells, blocks: tap.presetBlocks(), rows: 6, holes: true, only: [R] })
    assert.equal(tapCuts[0].holes, true)
    assert.equal(tapCuts[0].joins.length, 1)
    const tapped = await m.joinRow({ row: R, joins: tapCuts[0].joins, wire: recorded(tap).wire, blocks: tap.presetBlocks(), rows: 6 })
    const tw = m.joinedWords(tapped)
    assert.equal(tw.ok, false, 'an empty space mid-row is called joined again')
    assert.match(tw.text, /^Row 3 has an empty space at column 2 between its Input and Output/)
  })

  test('chain move: Join the row never says it sent joins it did not send', async () => {
    const m = await lib()
    const mod = await phoneMock()
    const d = await hisUnit(mod, { cut: true })
    const joins = m.rowCuts({ cells: d.grid().cells, blocks: d.presetBlocks(), rows: 6 })[0].joins
    const sentWords = (w) => /^The app sent/.test(w.text)

    /* The read before did not answer: nothing sent, and said so. */
    let rec = recorded(d, { readFails: true })
    let r = await m.joinRow({ row: R, joins, wire: rec.wire, rows: 6 })
    let w = m.joinedWords(r)
    assert.equal(cables(rec.sent).length, 0)
    assert.equal(w.text, 'Nothing was sent: the unit didn’t answer when the app asked how row 3 is joined. Try again.')

    /* The first join throws (the link dropped): nothing sent, and the link's own words. */
    rec = recorded(d)
    rec.wire.setCable = () => {
      throw new Error('The computer stopped answering.')
    }
    r = await m.joinRow({ row: R, joins, wire: rec.wire, rows: 6 })
    w = m.joinedWords(r)
    assert.equal(r.sent, 0)
    assert.equal(w.text, 'Nothing was sent: The computer stopped answering.')

    /* A move's joins left over a cell that is empty now: nothing can be sent, the empty column is named, and there is no button to press again. */
    const e = await hisUnit(mod, { cut: true })
    e.placeBlock(R, 2, 0)
    rec = recorded(e)
    r = await m.joinRow({ row: R, joins: [{ srcRow: R, srcCol: 1, destRow: R }], wire: rec.wire, rows: 6 })
    w = m.joinedWords(r)
    assert.equal(cables(rec.sent).length, 0)
    assert.equal(w.text, 'The app couldn’t join row 3 at column 3: column 3 is empty.')
    assert.deepEqual(w.joins, [])
    for (const said of [w]) assert.ok(!sentWords(said), said.text)
  })

  test('chain move: a move that fails part-way never says the blocks were put back when the read does not show them', async () => {
    const m = await lib()
    const mod = await phoneMock()

    /* THE LINK DROPS ON THE THIRD PLACEMENT AND STAYS DOWN: every put-back and every read after fails too. */
    let d = await hisUnit(mod)
    let rec = recorded(d)
    let n = 0
    let down = false
    const place = rec.wire.placeBlock
    const grid = rec.wire.gridCells
    rec.wire.placeBlock = (row, col, id) => {
      n += 1
      if (n >= 3) {
        down = true
        throw new Error('The computer stopped answering.')
      }
      return place(row, col, id)
    }
    rec.wire.gridCells = () => {
      if (down) throw new Error('The computer stopped answering.')
      return grid()
    }
    let res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14 })
    let said = m.afterMoveSaid({ row: R, res })
    assert.equal(res.checked, false)
    assert.ok(!/were put back/.test(said.issue) && !/were put back/.test(said.note.text) && !/were put back/.test(said.line), `“put back” over blocks in no cell: ${said.issue}`)
    assert.match(said.note.text, /^The app tried to put the blocks back, but couldn’t put .*Flanger 1.*Comp 1 back, and couldn’t read row 3 to check\.$/)
    assert.match(said.line, /^A move on row 3 failed; .*Flanger 1.*Comp 1 weren’t put back$/)

    /* PLACEMENTS 3 TO 5 THROW, THEN THE LINK COMES BACK: the read shows Drive 1 gone and NAM 1 out of its cell, and the words name them. */
    d = await hisUnit(mod)
    rec = recorded(d)
    n = 0
    const place2 = rec.wire.placeBlock
    rec.wire.placeBlock = (row, col, id) => {
      n += 1
      if (n >= 3 && n <= 5) throw new Error('The computer stopped answering.')
      return place2(row, col, id)
    }
    res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14 })
    said = m.afterMoveSaid({ row: R, res })
    assert.equal(res.checked, true)
    assert.deepEqual(res.missingBack, ['Drive 1', 'NAM 1'])
    assert.equal(said.note.text, 'The app tried to put the blocks back, but Drive 1 and NAM 1 aren’t back where they were in row 3.')
    assert.equal(said.issue, `The computer stopped answering. ${said.note.text}`)
    assert.equal(said.line, 'A move on row 3 failed; Drive 1 and NAM 1 weren’t put back')
  })

  test('chain move: no join is ever planned out of an Output or into an Input, however the ends are dragged', async () => {
    const m = await lib()
    const mod = await phoneMock()
    const keysOf = (res) => res.plan.joins.map((j) => `${j.srcRow}:${j.srcCol}>${j.destRow}`)
    /* The Output dragged up two places (Input, Comp, Drive, Output, NAM, Flanger): no cable out of the Output into NAM 1. */
    let d = await hisUnit(mod)
    let rec = recorded(d)
    let res = await m.moveBlocks({ row: R, moves: await laneDrag(d, 5, 3), wire: rec.wire, rows: 6, cols: 14 })
    assert.equal(d.grid().cells.find((c) => c.row === R && c.col === 3).effectId, 42, 'the drag did not move the Output')
    assert.deepEqual(keysOf(res), ['2:2>2', '2:4>2'], 'a join out of the Output is planned')
    assert.ok(!cables(rec.sent).some((c) => c[2] === 3), 'a join was sent out of the Output')
    /* The Input dragged down two places (Comp, Drive, Input, NAM, Flanger, Output): no cable into the Input. */
    d = await hisUnit(mod)
    rec = recorded(d)
    res = await m.moveBlocks({ row: R, moves: await laneDrag(d, 0, 2), wire: rec.wire, rows: 6, cols: 14 })
    assert.equal(d.grid().cells.find((c) => c.row === R && c.col === 2).effectId, 37, 'the drag did not move the Input')
    assert.ok(!keysOf(res).includes('2:1>2'), 'a join into the Input is planned')
    assert.ok(!cables(rec.sent).some((c) => c[2] === 1), 'a join was sent into the Input')
    assert.ok(keysOf(res).includes('2:2>2'), 'the Input no longer feeds the block after it')
    /* Comp dragged below the Output, which steps the Output up one: no cable out of it into Comp. */
    d = await hisUnit(mod)
    rec = recorded(d)
    res = await m.moveBlocks({ row: R, moves: await laneDrag(d, 1, 5), wire: rec.wire, rows: 6, cols: 14 })
    assert.equal(d.grid().cells.find((c) => c.row === R && c.col === 4).effectId, 42)
    assert.ok(!keysOf(res).includes('2:4>2'), 'a join out of the Output into the block dragged past it is planned')
    assert.deepEqual(res.still, [])
  })

  test('chain move: every write is held to the preset the move was made on, and a footswitch mid-move gets nothing written into the next one', async () => {
    const m = await lib()
    const mod = await phoneMock()
    const asked = (sameFor) => {
      let k = 0
      return async () => (++k > sameFor ? 'moved' : 'same')
    }
    /* On another preset before anything: nothing sent, and nothing started (the Undo of the last change stays). */
    let d = await hisUnit(mod)
    let rec = recorded(d)
    let started = 0
    let res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14, onPreset: asked(0), starting: () => (started += 1) })
    assert.equal(res.notSent, true)
    assert.equal(res.why, m.PRESET_MOVED_BEFORE)
    assert.deepEqual(writes(rec.sent), [])
    assert.equal(started, 0, 'a move that sent nothing dropped the Undo')

    /* Moved after the third clear: the fourth clear, every placement and every join stay unsent, and nothing is read as this preset's. */
    d = await hisUnit(mod)
    rec = recorded(d)
    res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14, onPreset: asked(3) })
    assert.equal(res.stopped, 'moved')
    assert.deepEqual(writes(rec.sent).map((s) => s[0]), ['clear', 'clear', 'clear'], 'a write went into the preset the unit moved to')
    assert.equal(rec.sent.filter((s) => s[0] === 'read').length, 1, 'the other preset was read as this one')
    assert.deepEqual(m.afterMoveSaid({ row: R, res }), { issue: m.PRESET_MOVED_MID, note: null, line: 'A move on row 3 stopped: the unit went to another preset' })

    /* Moved between the move and the rejoin: not one of the old row's joins goes into the new preset. */
    d = await hisUnit(mod)
    rec = recorded(d)
    res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14, onPreset: asked(8) })
    assert.equal(writes(rec.sent).length, 8)
    assert.equal(cables(rec.sent).length, 0, 'the old row’s joins were written into the new preset')
    assert.equal(res.stopped, 'moved')

    /* The unit stops saying which preset it is on after the clears: not a placement and not a put-back goes, and with no read after, the words name every block the app could not put back. */
    d = await hisUnit(mod)
    rec = recorded(d)
    let k = 0
    const grid0 = rec.wire.gridCells
    let reads = 0
    rec.wire.gridCells = () => {
      reads += 1
      if (reads > 1) throw new Error('no answer')
      return grid0()
    }
    res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14, onPreset: async () => (++k > 4 ? 'unknown' : 'same') })
    assert.equal(res.stopped, 'unknown')
    assert.deepEqual(writes(rec.sent).map((s) => s[0]), ['clear', 'clear', 'clear', 'clear'], 'a write went to a preset the unit would not name')
    const quiet = m.afterMoveSaid({ row: R, res })
    assert.ok(quiet.issue.startsWith(m.UNIT_QUIET_MID))
    assert.equal(quiet.note.text, 'The app tried to put the blocks back, but couldn’t put Drive 1, NAM 1, Flanger 1 and Comp 1 back, and couldn’t read row 3 to check.')

    /* Join the row the same. */
    const c = await hisUnit(mod, { cut: true })
    rec = recorded(c)
    const joins = m.rowCuts({ cells: c.grid().cells, blocks: c.presetBlocks(), rows: 6 })[0].joins
    const r = await m.joinRow({ row: R, joins, wire: rec.wire, rows: 6, onPreset: asked(0) })
    assert.equal(cables(rec.sent).length, 0, 'Join the row wrote into another preset')
    assert.deepEqual(m.joinedWords(r), { ok: false, text: 'No join was sent: the unit is on another preset now.', joins: [] })

    /* What a write left said is about its own preset: another preset's note is not drawn over this one's read. */
    const found = { row: R, text: 'Row 3 isn’t joined at column 2, so there’s no sound past it.', joins: [{ srcRow: R, srcCol: 0, destRow: R }] }
    assert.equal(m.rowNote({ text: 'The blocks moved, but …', joins: [], n: 7 }, found, 8), found)
    assert.equal(m.rowNote({ text: 'The blocks moved, but …', joins: [], n: 7 }, null, 8), null)

    /* THE SCREENS: each move and each Join the row held to the preset it began on, by asking the unit. */
    for (const [file, name, ask, begun] of [
      ['mobile/src/screens/Edit.js', 'the phone', /const presetHeld = \(n\) => joinsHere && Number\.isInteger\(n\) && n >= 0 \? async \(\) => \{ const here = getState\(\)\.preset\?\.number return Number\.isInteger\(here\) && here >= 0 && here !== n \? 'moved' : unitOnPreset\(n\) \} : null/, 'const n = getState().preset?.number'],
      ['src/components/GridEditor.jsx', 'the browser', /const p = await currentPreset\(\) const k = p\?\.number return !Number\.isInteger\(k\) \|\| k < 0 \? 'unknown' : k === n \? 'same' : 'moved'/, 'const n = chainNow.number']
    ]) {
      const text = flat(code(read(file)))
      assert.match(text, /const presetHeld = \(n\) => joinsHere && Number\.isInteger\(n\) && n >= 0 \?/, `${name}: no hold on the preset`)
      assert.match(text, ask, `${name}: the unit is not asked which preset it is on`)
      const move = text.slice(text.indexOf('const reorder = async'), text.indexOf('const reorder = async') + 6000)
      assert.ok(move.indexOf(begun) > 0 && move.indexOf(begun) < move.indexOf('const res = await moveBlocks'), `${name}: the move's preset is not taken before it`)
      assert.match(move, /const res = await moveBlocks\(\{[^}]*?onPreset: presetHeld\(n\),/, `${name}: a move's writes are not held to its preset`)
    }
    assert.match(flat(code(read('mobile/src/screens/Edit.js'))), /if \(res\.stopped === 'moved'\) \{ endChainWrite\(\{ refresh: false \}\) followPresetAfterChainWrite\(\)/, 'the phone: a move stopped by a preset change does not follow the unit')
  })

  test('chain move: what is said under a row is the newest truth about it', async () => {
    const m = await lib()
    const mod = await phoneMock()
    /* Join the row on 390, then an Add of a block that comes in joined to nothing: the green note gives way to the cut the read finds, with its button. */
    const d = await hisUnit(mod, { cut: true })
    const joins = m.rowCuts({ cells: d.grid().cells, blocks: d.presetBlocks(), rows: 6 })[0].joins
    const r = await m.joinRow({ row: R, joins, wire: recorded(d).wire, blocks: d.presetBlocks(), rows: 6 })
    const w = m.joinedWords(r)
    assert.equal(w.ok, true)
    const green = { text: w.text, joins: [], tone: 'ok', n: 390 }
    d.placeBlock(R, 3, 0)
    d.placeBlock(R, 3, 206)
    const found = m.rowCuts({ cells: d.grid().cells, blocks: d.presetBlocks(), rows: 6 })[0]
    assert.equal(found.text, 'Row 3 isn’t joined at column 4, so there’s no sound past it.')
    assert.equal(m.rowNote(green, found, 390), found, 'a green “joined again” hides a row cut since')
    assert.equal(m.rowNote(green, null, 390), green)
    /* A refused drag on a row that reads cut: its words, and the cut's words and Join the row under them. */
    const refused = { text: m.NOT_READ_BEFORE, joins: [], n: 390 }
    const both = m.rowNote(refused, found, 390)
    assert.equal(both.text, `${m.NOT_READ_BEFORE} ${found.text}`)
    assert.deepEqual(both.joins, found.joins, 'a refusal hides the row’s Join the row')
    /* A move's own note, with its joins to send, stands. */
    const moved = { text: 'The blocks moved, but row 3 isn’t joined at column 2, so there’s no sound past it.', joins: [{ srcRow: R, srcCol: 0, destRow: R }], n: 390 }
    assert.equal(m.rowNote(moved, found, 390), moved)
    assert.equal(m.rowNote(null, found, 390), found)
  })

  test('chain move: a bare wire beside a moved block is joined like a block, and a bare wire fed from nothing is a cut', async () => {
    const { joinBreak } = await import('../shared/starter-chains.mjs')
    for (const [where, load] of [
      ['the phone', phoneLib],
      ['the browser', lib]
    ]) {
      const m = await load()
      /* Input, a bare wire, Comp, Drive, Output; Comp and Drive swapped. The join OUT of the wire is in the grid read only. */
      const d = (await phoneMock()).createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
      d.placeBlock(R, 0, 37)
      d.cable(R, 0, R, true)
      d.placeBlock(R, 2, 46)
      d.placeBlock(R, 3, 118)
      d.placeBlock(R, 4, 42)
      for (const col of [1, 2, 3]) d.cable(R, col, R, true)
      assert.equal(d.grid().cells.find((c) => c.row === R && c.col === 1).isShunt, true)
      const rec = recorded(d)
      const res = await m.moveBlocks({ row: R, moves: [{ id: 118, name: 'Drive 1', from: 3, to: 2 }, { id: 46, name: 'Comp 1', from: 2, to: 3 }], wire: rec.wire, rows: 6, cols: 14 })
      assert.ok(res.plan.joins.some((j) => j.srcRow === R && j.srcCol === 1 && j.destRow === R), `${where}: the join out of the bare wire is not planned`)
      assert.ok(cables(rec.sent).some((c) => c[1] === R && c[2] === 1 && c[3] === R), `${where}: the join out of the bare wire is not sent`)
      assert.deepEqual(res.still, [])
      assert.equal(joinBreak({ joined: true, row: R, span: { first: 0, last: 4 } }, d.grid().cells), null, `${where}: the row next to a bare wire is left cut`)

      /* The same row already cut after the wire: offered the join out of it, which mends it. */
      const cut = (await phoneMock()).createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of cut.presetBlocks()) cut.placeBlock(b.row, b.col, 0)
      cut.placeBlock(R, 0, 37)
      cut.cable(R, 0, R, true)
      cut.placeBlock(R, 2, 46)
      cut.placeBlock(R, 3, 118)
      cut.placeBlock(R, 4, 42)
      cut.cable(R, 2, R, true)
      cut.cable(R, 3, R, true)
      const offered = m.rowCuts({ cells: cut.grid().cells, blocks: cut.presetBlocks(), rows: 6 })
      assert.deepEqual(offered[0].joins.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[R, 1, R]], `${where}: the join out of the bare wire is not offered`)
      const joined = await m.joinRow({ row: R, joins: offered[0].joins, wire: recorded(cut).wire, blocks: cut.presetBlocks(), rows: 6 })
      assert.equal(m.joinedWords(joined).ok, true)

      /* A bare wire fed from nothing is where the row stops. */
      const wireCut = m.rowCuts({
        cells: [
          { row: R, col: 0, effectId: 37, name: 'Input 1', fromRows: [] },
          { row: R, col: 1, effectId: 1024, name: 'Shunt', isShunt: true, fromRows: [] },
          { row: R, col: 2, effectId: 42, name: 'Output 1', fromRows: [R] }
        ],
        rows: 6
      })
      assert.equal(wireCut.length, 1, `${where}: a bare wire fed from nothing is not a cut`)
      assert.equal(wireCut[0].col, 1)
      assert.deepEqual(wireCut[0].joins.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[R, 0, R]])
    }
    /* The phone's wire reads GET /preset/grid (lib/device gridCells), which has the bare wires; the chain read does not. */
    assert.match(flat(code(read('mobile/src/screens/Edit.js'))), /const moveWire = \{ gridCells, clearCell, placeBlock, setCable, readBlock: blockParams \}/)
  })

  test('chain move: a moved block at a split or a merge keeps its joins to the other row, or the move is refused', async () => {
    for (const [where, load] of [
      ['the phone', phoneLib],
      ['the browser', lib]
    ]) {
      const m = await load()
      const fresh = (other, otherCol) => {
        const d = (async () => {
          const u = (await phoneMock()).createMockDevice('axefx3', { joinsAsOnUnit: true })
          for (const b of u.presetBlocks()) u.placeBlock(b.row, b.col, 0)
          ;[37, 46, 118, 82, 42].forEach((id, col) => u.placeBlock(R, col, id))
          u.placeBlock(other, otherCol, 70)
          return u
        })()
        return d
      }
      /* A MERGE: row 4's Delay feeds column 3 along with row 3's Comp; Drive and Flanger swapped. Column 3 is fed from both rows after. */
      const merge = await fresh(R + 1, 1)
      merge.cable(R, 0, R, true)
      merge.cable(R, 0, R + 1, true)
      merge.cable(R, 1, R, true)
      merge.cable(R + 1, 1, R, true)
      merge.cable(R, 2, R, true)
      merge.cable(R, 3, R, true)
      let res = await m.moveBlocks({ row: R, moves: [{ id: 118, name: 'Drive 1', from: 2, to: 3 }, { id: 82, name: 'Flanger 1', from: 3, to: 2 }], wire: recorded(merge).wire, rows: 6, cols: 14 })
      assert.deepEqual(merge.grid().cells.find((c) => c.row === R && c.col === 2).fromRows, [R, R + 1], `${where}: the merge into a moved column is lost`)
      assert.deepEqual(res.still, [])

      /* A SPLIT: column 3 also feeds row 4's Delay; Comp and Drive swapped. The join out to row 4 is planned and kept. */
      const split = await fresh(R + 1, 3)
      split.cable(R, 0, R, true)
      split.cable(R, 1, R, true)
      split.cable(R, 2, R, true)
      split.cable(R, 2, R + 1, true)
      split.cable(R, 3, R, true)
      res = await m.moveBlocks({ row: R, moves: [{ id: 46, name: 'Comp 1', from: 1, to: 2 }, { id: 118, name: 'Drive 1', from: 2, to: 1 }], wire: recorded(split).wire, rows: 6, cols: 14 })
      assert.ok(res.plan.joins.some((j) => j.srcRow === R && j.srcCol === 2 && j.destRow === R + 1), `${where}: the split out of a moved column is not kept`)
      assert.deepEqual(split.grid().cells.find((c) => c.row === R + 1 && c.col === 3).fromRows, [R])

      /* THE SAME SPLIT INTO ROW 2, THROUGH HIS PI ON 1.90.63: that join would go to the wrong cell, so nothing is sent. */
      const up = await fresh(R - 1, 3)
      up.cable(R, 0, R, true)
      up.cable(R, 1, R, true)
      up.cable(R, 2, R, true)
      up.cable(R, 2, R - 1, true)
      up.cable(R, 3, R, true)
      const rec = recorded(up)
      res = await m.moveBlocks({ row: R, moves: [{ id: 46, name: 'Comp 1', from: 1, to: 2 }, { id: 118, name: 'Drive 1', from: 2, to: 1 }], wire: rec.wire, rows: 6, cols: 14, law: true, version: '1.90.63' })
      assert.equal(res.notSent, true, `${where}: a move whose join into row 2 goes to the wrong cell is not refused`)
      assert.deepEqual(writes(rec.sent), [])
    }
  })

  test('chain move: a block’s settings are read for his account only, so nobody else’s drag waits on them', async () => {
    const m = await lib()
    const d = await hisUnit(await phoneMock())
    const { wire } = recorded(d)
    let reads = 0
    wire.readBlock = (eid) => ((reads += 1), d.blockParams(eid))
    await m.moveBlocks({ row: R, moves: await hisDrag(d), wire, rows: 6, cols: 14 })
    assert.equal(reads, 0, 'a drag measured settings it was not asked to')
    await m.moveBlocks({ row: R, moves: await hisDrag(d), wire, rows: 6, cols: 14, measure: true })
    assert.equal(reads, 8)
    /* The screens ask it of his account only: the phone by the kept sign-in (lib/bluetooth), the browser by the account App hands it. */
    assert.match(flat(code(read('mobile/src/screens/Edit.js'))), /const res = await moveBlocks\(\{[^}]*?measure: bluetoothAdmin\(\),/)
    assert.match(flat(code(read('src/components/GridEditor.jsx'))), /const res = await moveBlocks\(\{[^}]*?measure: admin,/)
    const app = flat(code(read('src/App.jsx')))
    assert.equal((app.match(/<GridEditor [^>]*?admin=\{isAdmin\(link\.account\?\.id\)\}/g) || []).length, 2, 'a chain editor in the browser measures for every account')
  })

  test('chain move: his drag is the moves the tests without a mock use', async () => {
    const d = await hisUnit(await phoneMock())
    assert.deepEqual(await hisDrag(d), HIS_MOVES)
  })

  test('chain move: an Add that moves a block out of a row says the empty space it left there, and Join the row never says “joined again” over an empty space', async () => {
    for (const [where, load] of BOTH) {
      const m = await load()
      /* INPUT, COMP FED FROM NOTHING, AN EMPTY COLUMN 3, DRIVE FED FROM THE ROW, OUTPUT. The cut-row read (empty spaces not counted) offers the join into Comp; after it, the row is asked again with its empty spaces counted, whatever found the cut. */
      const u = dropsOut([
        { row: R, col: 0, effectId: 37, name: 'Input 1', fromRows: [] },
        { row: R, col: 1, effectId: 46, name: 'Comp 1', fromRows: [] },
        { row: R, col: 3, effectId: 118, name: 'Drive 1', fromRows: [R] },
        { row: R, col: 4, effectId: 42, name: 'Output 1', fromRows: [R] }
      ])
      const found = m.rowCuts({ cells: u.wire.gridCells(), rows: 6, only: [R] })[0]
      assert.deepEqual(found.joins.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[R, 0, R]])
      const r = await m.joinRow({ row: R, joins: found.joins, wire: u.wire, rows: 6 })
      assert.equal(r.sent, 1)
      const w = m.joinedWords(r)
      assert.equal(w.ok, false, `${where}: “joined again” over an empty space between the row’s Input and Output`)
      assert.match(w.text, /^Row 3 has an empty space at column 3 between its Input and Output, so the sound may stop there\./)
      assert.deepEqual(w.joins, [], `${where}: Join the row offered over an empty space it cannot join across`)

      /* 390 JOINED AGAIN, THEN AN ADD OF NAM 1 INTO ROW 4 (a unit has one NAM 1, so it moves): the chain read alone cannot see the space it left, so the Add reads that row itself, and what it says there is the space, never the green note. */
      const d = await hisUnit(await phoneMock(), { cut: true })
      const joins = m.rowCuts({ cells: d.grid().cells, blocks: d.presetBlocks(), rows: 6 })[0].joins
      const green = m.joinedWords(await m.joinRow({ row: R, joins, wire: recorded(d).wire, blocks: d.presetBlocks(), rows: 6 }))
      assert.equal(green.ok, true)
      d.placeBlock(R, 3, 0)
      d.placeBlock(R + 1, 3, 206)
      assert.equal(m.maybeCut(d.presetBlocks()), false, 'the chain read sees the empty space after all: the Add’s own read is not needed')
      const left = m.rowCuts({ cells: d.grid().cells, blocks: d.presetBlocks(), rows: 6, holes: true, only: [R] })[0]
      assert.equal(left.text, 'Row 3 has an empty space at column 4 between its Input and Output, so the sound may stop there. Put a block in it, or move one back.')
      assert.deepEqual(left.joins, [])
    }
    /* THE SCREENS: an Add clears what was said under the row its block left as well as the row it wrote, and an Add that moved a block reads that row back with its empty spaces counted. */
    const phone = flat(code(read('mobile/src/screens/Edit.js')))
    assert.match(phone, /const sayRowLeft = async \(row, n\) => \{ const cells = await gridCells\(\)\.catch\(\(\) => null\) if \(!Array\.isArray\(cells\)\) return const cut = rowCuts\(\{ cells, blocks: getState\(\)\.allBlocks \|\| blocks, rows: gridRows, law: oldBytes\(\), version: linkState\(\)\.hostVersion, holes: true, only: \[row\] \}\)\[0\] leaveRow\(row, cut \? \{ text: cut\.text, joins: cut\.joins, n \} : null\)/, 'the phone: the row a block left is not read back with its empty space counted')
    const add = phone.slice(phone.indexOf('const add = async'), phone.indexOf('const addAfterCard'))
    assert.match(add, /const n = getState\(\)\.preset\?\.number/, 'the phone: what an Add leaves said is not tied to its preset')
    assert.match(add, /if \(got\.kind === 'moved' && joinsHere\) await sayRowLeft\(was\.row, n\)/, 'the phone: an Add that moved a block says nothing under the row it left')
    /* Join the row never hands the row's empty spaces in: it always counts them. */
    for (const [file] of SCREENS) assert.ok(!/holes: !!cut\.holes/.test(read(file)), `${file}: Join the row is told whether to count empty spaces`)
  })

  test('chain move: with settings measured, the first clear asks the unit’s preset again, so a footswitch during the reads gets nothing cleared, and the move is said as one never sent', async () => {
    for (const [where, load] of BOTH) {
      const m = await load()
      /*
       * On another preset at that ask, or not saying: nothing is written, and
       * the answer is a refusal's (notSent, the BEFORE words, `stopped`), so
       * both screens take their not-sent path: the words under the row, no
       * failure, no history line, and `starting` never called (the screens
       * drop the Undo there, and the phone marks the preset changed).
       */
      for (const [after, why] of [
        ['moved', m.PRESET_MOVED_BEFORE],
        ['unknown', m.UNIT_QUIET_BEFORE]
      ]) {
        const d = await hisUnit(await phoneMock())
        const rec = recorded(d)
        let stepped = false
        rec.wire.readBlock = (eid) => ((stepped = true), d.blockParams(eid))
        let asked = 0
        let started = 0
        const lines = []
        const res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14, measure: true, onPreset: async () => ((asked += 1), stepped ? after : 'same'), starting: () => (started += 1), log: (a, b) => lines.push(b ? `${a} — ${b}` : a) })
        assert.deepEqual(writes(rec.sent), [], `${where}, ${after}: a clear went to a preset the unit stepped to, or would not name, while settings were read`)
        assert.equal(asked, 2, `${where}: the unit was not asked again after the settings were read`)
        assert.equal(res.notSent, true, `${where}, ${after}: a move held back before anything was sent is answered as one that failed part-way`)
        assert.equal(res.why, why, `${where}, ${after}: not the words of a move never sent`)
        assert.equal(res.stopped, after, where)
        assert.equal(res.threw, undefined, `${where}, ${after}: a move never sent is answered as a failure`)
        assert.equal(started, 0, `${where}, ${after}: the Undo was dropped, and the preset marked changed, for a move that sent nothing`)
        assert.match(lines.join('\n'), new RegExp(`move on row 3 — not sent: ${after === 'moved' ? 'the unit is on another preset' : 'the unit didn’t say which preset it’s on'}`), `${where}, ${after}: the log does not say the move was not sent`)
        assert.ok(!/put .* back after|straight after/.test(lines.join('\n')), `${where}, ${after}: the log says blocks were taken out and put back`)
      }
      /* The same unit saying 'same' at that ask: the move goes, and `starting` is called once, before the first clear and after the settings were read. */
      const d = await hisUnit(await phoneMock())
      const rec = recorded(d)
      const order = []
      rec.wire.readBlock = (eid) => (order.push('read'), d.blockParams(eid))
      const clear = rec.wire.clearCell
      rec.wire.clearCell = (row, col) => (order.push('clear'), clear(row, col))
      const res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14, measure: true, onPreset: async () => 'same', starting: () => order.push('starting') })
      assert.equal(res.notSent, false)
      assert.deepEqual(order.slice(0, 6), ['read', 'read', 'read', 'read', 'starting', 'clear'], `${where}: the move is not begun once, just before its first write`)
      assert.equal(order.filter((x) => x === 'starting').length, 1)
    }
    /* THE SCREENS take the not-sent path for it: the phone says it under the row and follows the unit; the browser reads the chain again and records nothing (below). */
    const phone = flat(code(read('mobile/src/screens/Edit.js')))
    assert.match(phone, /if \(res\.notSent\) \{ setSettling\(null\) if \(res\.stopped\) followPresetAfterChainWrite\(\) if \(res\.why\) leaveRow\(lane\.row, \{ text: res\.why, joins: \[\], n \}\)/, 'the phone: a move never sent is not said under its row')
    /* With nothing measured, the ask made just before the move still counts for its first clear. */
    const m = await lib()
    const d = await hisUnit(await phoneMock())
    const rec = recorded(d)
    const order = []
    const clear = rec.wire.clearCell
    rec.wire.clearCell = (row, col) => (order.push('clear'), clear(row, col))
    await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14, onPreset: async () => (order.push('ask'), 'same') })
    assert.deepEqual(order.slice(0, 3), ['ask', 'clear', 'ask'])
  })

  test('chain move: on a unit that also drops the joins out of a cell it empties, the joins out of every moved column are made again: into a bare wire after them, and a split out of the first', async () => {
    const { joinBreak } = await import('../shared/starter-chains.mjs')
    const keysOf = (res) => res.plan.joins.map((j) => `${j.srcRow}:${j.srcCol}>${j.destRow}`)
    const swap = [
      { id: 118, name: 'Drive 1', from: 2, to: 1 },
      { id: 46, name: 'Comp 1', from: 1, to: 2 }
    ]
    for (const [where, load] of BOTH) {
      const m = await load()
      /* HIS DRAG ON SUCH A UNIT: every join the clears took is sent again, and the row reads joined. */
      let u = dropsOut(rowOf(ROW))
      let res = await m.moveBlocks({ row: R, moves: HIS_MOVES, wire: u.wire, rows: 6, cols: 14 })
      assert.equal(cables(u.sent).length, 5, `${where}: the drops-out grid did not drop the Output’s join with its column`)
      assert.deepEqual(res.still, [])
      assert.equal(joinBreak({ joined: true, row: R, span: { first: 0, last: 5 } }, u.grid), null, `${where}: his row is cut on a unit that drops the joins out of a cleared cell`)

      /* A BARE WIRE AFTER THE MOVED BLOCKS: Input, Comp, Drive, a bare wire, Output; Comp and Drive swapped. Clearing Drive's column cuts the wire's feed, and only the join OUT of that column gives it back. */
      u = dropsOut(rowOf([[37, 'Input 1'], [46, 'Comp 1'], [118, 'Drive 1'], [1024, 'Shunt'], [42, 'Output 1']]))
      res = await m.moveBlocks({ row: R, moves: swap, wire: u.wire, rows: 6, cols: 14 })
      assert.ok(keysOf(res).includes('2:2>2'), `${where}: the join out of a moved column into the bare wire after it is not planned`)
      assert.deepEqual(res.still, [])
      assert.equal(joinBreak({ joined: true, row: R, span: { first: 0, last: 4 } }, u.grid), null, `${where}: the row is cut at the bare wire after the move`)

      /* A SPLIT OUT OF THE FIRST OF TWO MOVED COLUMNS: column 2 also feeds row 4's Delay, which comes back into Flanger. */
      u = dropsOut([
        ...rowOf([[37, 'Input 1'], [46, 'Comp 1'], [118, 'Drive 1'], [82, 'Flanger 1'], [42, 'Output 1']]).map((c) => (c.col === 3 ? { ...c, fromRows: [R, R + 1] } : c)),
        { row: R + 1, col: 2, effectId: 70, name: 'Delay 1', fromRows: [R] }
      ])
      res = await m.moveBlocks({ row: R, moves: swap, wire: u.wire, rows: 6, cols: 14 })
      assert.ok(keysOf(res).includes('2:1>3'), `${where}: the split out of the first moved column is not planned`)
      assert.deepEqual(res.still, [])
      assert.deepEqual(u.grid.find((c) => c.row === R + 1 && c.col === 2).fromRows, [R], `${where}: the branch out of the first moved column is left cut`)
      assert.deepEqual(u.grid.find((c) => c.row === R && c.col === 3).fromRows, [R, R + 1])
    }
  })

  test('chain move: every way a move or a Join the row can fail says only what the read shows, with Join the row where a join can still be sent', async () => {
    const m = await lib()
    const mod = await phoneMock()
    const thirdThrows = (wire) => {
      let n = 0
      const place = wire.placeBlock
      wire.placeBlock = (row, col, id) => {
        n += 1
        if (n === 3) throw new Error('The computer stopped answering.')
        return place(row, col, id)
      }
    }
    const readsOnce = (wire) => {
      let reads = 0
      const grid = wire.gridCells
      wire.gridCells = () => {
        reads += 1
        if (reads > 1) throw new Error('no answer')
        return grid()
      }
    }

    /* PUT BACK, AND THE REJOIN ANSWERED BUT DID NOT TAKE: the row is said cut after the failure's words, under it too, with Join the row. */
    let d = await hisUnit(mod)
    let rec = recorded(d)
    thirdThrows(rec.wire)
    rec.wire.setCable = () => ({ ok: true })
    let res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14 })
    let said = m.afterMoveSaid({ row: R, res })
    assert.equal(res.checked, true)
    assert.deepEqual(res.missingBack, [])
    const back = m.putBackCut({ srcRow: R, srcCol: 0, destRow: R }).trim()
    assert.equal(back, 'The blocks were put back, but row 3 isn’t joined at column 2, so there’s no sound past it.')
    assert.equal(said.issue, `The computer stopped answering. ${back}`)
    assert.equal(said.note.text, back, 'a put-back over a row left cut is not said under it')
    assert.deepEqual(said.note.joins, res.plan.joins.map((j) => ({ ...j, had: true })), 'a put-back over a row left cut has no Join the row, or its joins do not say the row had its Input and Output')
    assert.equal(said.line, 'A move on row 3 failed and its blocks were put back')

    /* PUT BACK WHOLE, THEN NO READ AFTER: "tried to", never "were put back", and Join the row stays. */
    d = await hisUnit(mod)
    rec = recorded(d)
    thirdThrows(rec.wire)
    readsOnce(rec.wire)
    res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14 })
    said = m.afterMoveSaid({ row: R, res })
    assert.equal(res.checked, false)
    assert.deepEqual(res.missingBack, [])
    assert.deepEqual(said.note, { text: 'The app tried to put the blocks back, but couldn’t read row 3 back to check them.', joins: res.plan.joins.map((j) => ({ ...j, had: true })) })
    assert.equal(said.line, 'A move on row 3 failed and the app tried to put its blocks back')

    /* A MOVE THAT WENT, WHOSE READ AFTER FAILED: said as not checked, with Join the row. */
    d = await hisUnit(mod)
    rec = recorded(d)
    readsOnce(rec.wire)
    res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14 })
    assert.equal(res.threw, null)
    assert.equal(res.checked, false)
    assert.deepEqual(m.afterMoveSaid({ row: R, res }), { issue: null, note: { text: m.uncheckedAfterMove(R), joins: res.plan.joins.map((j) => ({ ...j, had: true })) }, line: null })

    /* JOIN THE ROW WHOSE READ AFTER FAILED: never "joined again". */
    let c = await hisUnit(mod, { cut: true })
    const joins = m.rowCuts({ cells: c.grid().cells, blocks: c.presetBlocks(), rows: 6 })[0].joins
    rec = recorded(c)
    readsOnce(rec.wire)
    let r = await m.joinRow({ row: R, joins, wire: rec.wire, rows: 6 })
    assert.equal(r.sent, 4)
    assert.equal(r.checked, false)
    assert.deepEqual(m.joinedWords(r), { ok: false, text: 'The app sent the joins, but couldn’t read row 3 back to check them.' })
    assert.equal(m.joinedWords({ row: R, still: [], checked: false, sent: 2 }).ok, false, '“joined again” with no read to go by')

    /* JOIN THE ROW ON A UNIT THAT WILL NOT SAY ITS PRESET: nothing sent, and its own words. */
    c = await hisUnit(mod, { cut: true })
    rec = recorded(c)
    r = await m.joinRow({ row: R, joins, wire: rec.wire, rows: 6, onPreset: async () => 'unknown' })
    assert.equal(cables(rec.sent).length, 0)
    assert.deepEqual(m.joinedWords(r), { ok: false, text: 'No join was sent: the unit didn’t say which preset it’s on. Try again.' })

    /* THE BROWSER: a move the unit's preset change stopped reads nothing back as this preset's, as a failed one. */
    assert.ok(flat(code(read('src/components/GridEditor.jsx'))).includes("if (res.threw || res.stopped === 'moved') { setIssue(said.issue)"), 'the browser: a move stopped by a preset change falls through to reading the chain')
  })

  test('chain move: the row is asked again on the move’s last read, so a cut the plan did not cover is said, and a block the unit did not take is named with no button', async () => {
    for (const [where, load] of BOTH) {
      const m = await load()
      const mod = await phoneMock()
      /* NAM 1 PARKED AFTER THE OUTPUT, fed from nothing, dragged up before it: nothing fed the column the Output goes to, so the plan joins nothing into it. The row is said cut there, with the join that mends it. */
      const d = mod.createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
      ;[37, 46, 118, 82, 42, 206].forEach((id, col) => d.placeBlock(R, col, id))
      for (let col = 0; col < 4; col++) d.cable(R, col, R, true)
      const moves = await laneDrag(d, 5, 4)
      assert.deepEqual(moves.map((x) => [x.name, x.from, x.to]), [['NAM 1', 5, 4], ['Output 1', 4, 5]])
      const res = await m.moveBlocks({ row: R, moves, wire: recorded(d).wire, rows: 6, cols: 14, blocks: d.presetBlocks() })
      assert.deepEqual(res.still, [], 'the joins the plan made did not all take')
      const said = m.afterMoveSaid({ row: R, res })
      assert.equal(said.note?.text, 'The blocks moved, but row 3 isn’t joined at column 6, so there’s no sound past it.', `${where}: a row the move left cut is not said`)
      assert.deepEqual(said.note.joins.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[R, 4, R]])
      const joined = await m.joinRow({ row: R, joins: said.note.joins, wire: recorded(d).wire, blocks: d.presetBlocks(), rows: 6 })
      assert.deepEqual(m.joinedWords(joined), { ok: true, text: 'Row 3 is joined again.' })

      /* A PLACEMENT THE UNIT REFUSED (NAM 1 put nowhere): named, and no Join the row, which could only answer that the cell is empty. */
      const e = await hisUnit(mod)
      const rec = recorded(e)
      const place = rec.wire.placeBlock
      rec.wire.placeBlock = (row, col, id) => (id === 206 ? (rec.sent.push(['refused', row, col, id]), { ok: false }) : place(row, col, id))
      const refused = await m.moveBlocks({ row: R, moves: await hisDrag(e), wire: rec.wire, rows: 6, cols: 14 })
      assert.deepEqual(refused.notPlaced, [{ name: 'NAM 1', col: 2, between: true, gone: true }])
      assert.deepEqual(m.afterMoveSaid({ row: R, res: refused }).note, { text: 'The unit didn’t take NAM 1 at column 3, so row 3 has an empty space there and no sound past it. Put a block in it, or move one back.', joins: [] }, `${where}: a block the unit did not take is said as a join to make`)
      assert.equal(m.notPlacedWords(R, [{ name: 'NAM 1', col: 2, between: true }, { name: 'Comp 1', col: 4, between: true }]), 'The unit didn’t take NAM 1 at column 3 and Comp 1 at column 5, so row 3 has empty spaces there and no sound past them. Put a block in each, or move one back.')
    }
    /* The screens hand the chain read in, for the ends. */
    for (const [file, name] of SCREENS) {
      const text = flat(code(read(file)))
      assert.match(text, /const res = await moveBlocks\(\{[^}]*?onPreset: presetHeld\(n\), blocks, starting:/, `${name}: the row is not asked again with the chain read’s ends`)
    }
  })

  test('chain move: a block the unit did not take says “no sound past it” only between the row’s Input and Output; past the Output it is a block gone from the preset, said after what the row’s read says', async () => {
    /* INPUT, COMP, DRIVE, OUTPUT, joined; Drive dragged past the Output, and its placement at column 4 refused. */
    const start = async () => {
      const d = (await phoneMock()).createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
      ;[37, 46, 118, 42].forEach((id, col) => d.placeBlock(R, col, id))
      for (let col = 0; col < 3; col++) d.cable(R, col, R, true)
      return d
    }
    const past = [
      { id: 118, name: 'Drive 1', from: 2, to: 3 },
      { id: 42, name: 'Output 1', from: 3, to: 2 }
    ]
    const refuse = (d, rec, elsewhere = null) => {
      const place = rec.wire.placeBlock
      rec.wire.placeBlock = (row, col, id) => {
        if (id !== 118 || col !== 3) return place(row, col, id)
        if (elsewhere !== null) d.placeBlock(row, elsewhere, id)
        return { ok: false }
      }
    }
    const { joinBreak } = await import('../shared/starter-chains.mjs')
    for (const [where, load] of BOTH) {
      const m = await load()
      /* The row still carries sound (Input, Comp and Output joined): never "no sound past it" over it, and the block that is gone is said. */
      let d = await start()
      let rec = recorded(d)
      refuse(d, rec)
      let res = await m.moveBlocks({ row: R, moves: past, wire: rec.wire, rows: 6, cols: 14, blocks: d.presetBlocks() })
      assert.equal(joinBreak({ joined: true, row: R, span: { first: 0, last: 2 } }, d.grid().cells), null, `${where}: the row this case needs is not joined`)
      assert.deepEqual(res.notPlaced, [{ name: 'Drive 1', col: 3, between: false, gone: true }], where)
      assert.deepEqual(m.afterMoveSaid({ row: R, res }).note, { text: 'The unit didn’t take Drive 1 at column 4, so it isn’t in this preset now. Add it again, or move one back.', joins: [] }, `${where}: an empty cell past the Output is said as a row with no sound`)
      /* The same, and the join into the Output answered but not taken: the row's cut first, with its Join the row, then the block that is gone. */
      d = await start()
      rec = recorded(d)
      refuse(d, rec)
      rec.wire.setCable = () => ({ ok: true })
      res = await m.moveBlocks({ row: R, moves: past, wire: rec.wire, rows: 6, cols: 14, blocks: d.presetBlocks() })
      const both = m.afterMoveSaid({ row: R, res }).note
      assert.equal(both?.text, 'The blocks moved, but row 3 isn’t joined at column 3, so there’s no sound past it. The unit didn’t take Drive 1 at column 4, so it isn’t in this preset now. Add it again, or move one back.', `${where}: a block gone past the Output hides the row's own cut`)
      assert.deepEqual(both.joins.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[R, 1, R]], `${where}: the row's cut has no Join the row`)
      /* Refused there, but put somewhere else by the unit: not gone, so nothing is said of it here (the screens' own check says where the unit has it). */
      d = await start()
      rec = recorded(d)
      refuse(d, rec, 5)
      res = await m.moveBlocks({ row: R, moves: past, wire: rec.wire, rows: 6, cols: 14, blocks: d.presetBlocks() })
      assert.deepEqual(res.notPlaced, [{ name: 'Drive 1', col: 3, between: false, gone: false }], where)
      assert.equal(m.afterMoveSaid({ row: R, res }).note, null, `${where}: a block the unit put elsewhere is said to be gone from the preset`)
    }
    /* Both kinds in one list: the space that stops the sound first, then the block that is gone; '' with nothing to say. */
    const m = await lib()
    assert.equal(
      m.notPlacedWords(R, [{ name: 'NAM 1', col: 2, between: true, gone: true }, { name: 'Delay 1', col: 7, between: false, gone: true }, { name: 'Drive 1', col: 8, between: false, gone: false }]),
      'The unit didn’t take NAM 1 at column 3, so row 3 has an empty space there and no sound past it. Put a block in it, or move one back. The unit didn’t take Delay 1 at column 8, so it isn’t in this preset now. Add it again, or move one back.'
    )
    assert.equal(m.notPlacedWords(R, [{ name: 'Delay 1', col: 0, between: false, gone: true }, { name: 'Drive 1', col: 7, between: false, gone: true }]), 'The unit didn’t take Delay 1 at column 1 and Drive 1 at column 8, so they aren’t in this preset now. Add them again, or move one back.')
    assert.equal(m.notPlacedWords(R, [{ name: 'Drive 1', col: 7, between: false, gone: false }]), '')
  })

  test('chain move: a moved Output or Input the unit did not take leaves a row with no sound, said with no button, and no join is offered into or out of a cell the move left empty', async () => {
    /* INPUT, COMP, a block, OUTPUT, joined: the block dragged past the Output, or Comp before the Input, and one placement refused. */
    const start = async (third) => {
      const d = (await phoneMock()).createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
      ;[37, 46, third, 42].forEach((id, col) => d.placeBlock(R, col, id))
      for (let col = 0; col < 3; col++) d.cable(R, col, R, true)
      return d
    }
    const moved = async (m, third, moves, id, col) => {
      const d = await start(third)
      const rec = recorded(d)
      const place = rec.wire.placeBlock
      rec.wire.placeBlock = (r, c, x) => (x === id && c === col ? { ok: false } : place(r, c, x))
      const res = await m.moveBlocks({ row: R, moves, wire: rec.wire, rows: 6, cols: 14, blocks: d.presetBlocks() })
      return { res, said: m.afterMoveSaid({ row: R, res }) }
    }
    const past = [
      { id: 206, name: 'NAM 1', from: 2, to: 3 },
      { id: 42, name: 'Output 1', from: 3, to: 2 }
    ]
    const before = [
      { id: 46, name: 'Comp 1', from: 1, to: 0 },
      { id: 37, name: 'Input 1', from: 0, to: 1 }
    ]
    for (const [where, load] of BOTH) {
      const m = await load()
      /* THE OUTPUT REFUSED at column 3: the plan's join into that empty cell is still missing, and is never offered (it could only answer that the cell is empty). The row has no Output, so no sound, said plainly. */
      let { res, said } = await moved(m, 206, past, 42, 2)
      assert.deepEqual(res.notPlaced, [{ name: 'Output 1', col: 2, between: false, gone: true, end: 'Output' }], `${where}: a row with no Output is counted as between its ends, or not as with no Output`)
      assert.deepEqual(res.still.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[R, 1, R]], `${where}: this case needs the join into the empty cell still missing`)
      assert.deepEqual(said.note, { text: 'The unit didn’t take Output 1 at column 3, so row 3 has no Output now, and no sound. Add it again, or move one back.', joins: [] }, `${where}: a join into the empty cell is offered, or the row with no Output is not said`)
      /* THE INPUT REFUSED at column 2. */
      ;({ res, said } = await moved(m, 118, before, 37, 1))
      assert.deepEqual(res.notPlaced, [{ name: 'Input 1', col: 1, between: false, gone: true, end: 'Input' }], where)
      assert.deepEqual(said.note, { text: 'The unit didn’t take Input 1 at column 2, so row 3 has no Input now, and no sound. Add it again, or move one back.', joins: [] }, `${where}: the row with no Input is not said`)
      /* COMP REFUSED BEFORE THE INPUT (column 1): the sound starts at the Input, so it is a block gone from the preset, never "no sound past it". */
      ;({ res, said } = await moved(m, 118, before, 46, 0))
      assert.deepEqual(res.notPlaced, [{ name: 'Comp 1', col: 0, between: false, gone: true }], `${where}: a cell before the Input is counted as between the row’s ends`)
      assert.deepEqual(said.note, { text: 'The unit didn’t take Comp 1 at column 1, so it isn’t in this preset now. Add it again, or move one back.', joins: [] }, where)
      assert.ok(!/no sound past it/.test(said.note.text), `${where}: “no sound past it” before the Input`)
      /* THE OUTPUT REFUSED, and a join elsewhere answered but not taken: the row with no Output, and no Join the row, which could only call a row with no sound joined (the sixth round). */
      const d = (await phoneMock()).createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
      ;[37, 46, 118, 206, 42].forEach((id, col) => d.placeBlock(R, col, id))
      for (let col = 0; col < 4; col++) d.cable(R, col, R, true)
      const rec = recorded(d)
      const place = rec.wire.placeBlock
      const cable = rec.wire.setCable
      rec.wire.placeBlock = (r, c, x) => (x === 42 && c === 3 ? { ok: false } : place(r, c, x))
      rec.wire.setCable = (a, b, c, on) => (b === 0 ? { ok: true } : cable(a, b, c, on))
      const drag = [
        { id: 118, name: 'Drive 1', from: 2, to: 1 },
        { id: 206, name: 'NAM 1', from: 3, to: 2 },
        { id: 42, name: 'Output 1', from: 4, to: 3 },
        { id: 46, name: 'Comp 1', from: 1, to: 4 }
      ]
      res = await m.moveBlocks({ row: R, moves: drag, wire: rec.wire, rows: 6, cols: 14, blocks: d.presetBlocks() })
      assert.deepEqual(res.still.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[R, 0, R], [R, 2, R]], `${where}: this case needs a cut and the join into the empty cell missing`)
      said = m.afterMoveSaid({ row: R, res })
      assert.deepEqual(said.note, { text: 'The unit didn’t take Output 1 at column 4, so row 3 has no Output now, and no sound. Add it again, or move one back.', joins: [] }, `${where}: Join the row is offered on a row with no Output`)
      /* THE INPUT REFUSED, and a join elsewhere answered but not taken: the same, for the Input (the eighth round: only the Output's half was held). */
      const di = (await phoneMock()).createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of di.presetBlocks()) di.placeBlock(b.row, b.col, 0)
      ;[37, 46, 118, 206, 42].forEach((id, col) => di.placeBlock(R, col, id))
      for (let col = 0; col < 4; col++) di.cable(R, col, R, true)
      const reci = recorded(di)
      const placei = reci.wire.placeBlock
      const cablei = reci.wire.setCable
      reci.wire.placeBlock = (r, c, x) => (x === 37 && c === 2 ? { ok: false } : placei(r, c, x))
      reci.wire.setCable = (a, b, c, on) => (b === 0 ? { ok: true } : cablei(a, b, c, on))
      const dragIn = [
        { id: 46, name: 'Comp 1', from: 1, to: 0 },
        { id: 118, name: 'Drive 1', from: 2, to: 1 },
        { id: 37, name: 'Input 1', from: 0, to: 2 }
      ]
      res = await m.moveBlocks({ row: R, moves: dragIn, wire: reci.wire, rows: 6, cols: 14, blocks: di.presetBlocks() })
      assert.deepEqual(res.still.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[R, 0, R]], `${where}: this case needs a cut beside the refused Input`)
      said = m.afterMoveSaid({ row: R, res })
      assert.deepEqual(said.note, { text: 'The unit didn’t take Input 1 at column 3, so row 3 has no Input now, and no sound. Add it again, or move one back.', joins: [] }, `${where}: Join the row is offered on a row with no Input`)
      /* THE INPUT REFUSED on a unit that also drops the joins out of a cell it empties: the join out of its empty cell is missing, and is never offered either. */
      const u = dropsOut(rowOf([[37, 'Input 1'], [46, 'Comp 1'], [118, 'Drive 1'], [42, 'Output 1']]))
      const put = u.wire.placeBlock
      u.wire.placeBlock = (r, c, x) => (x === 37 && c === 1 ? { ok: false } : put(r, c, x))
      res = await m.moveBlocks({ row: R, moves: before, wire: u.wire, rows: 6, cols: 14 })
      assert.deepEqual(res.still.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[R, 1, R]], `${where}: this case needs the join out of the empty cell missing`)
      assert.deepEqual(m.afterMoveSaid({ row: R, res }).note, { text: 'The unit didn’t take Input 1 at column 2, so row 3 has no Input now, and no sound. Add it again, or move one back.', joins: [] }, `${where}: a join out of the empty cell is offered`)
      /* THE OUTPUT REFUSED, but put further along the row by the unit: the row still has its Output, so the cell left empty is between the ends, said as the space it is. */
      const e = await start(206)
      const r2 = recorded(e)
      const p2 = r2.wire.placeBlock
      r2.wire.placeBlock = (r, c, x) => (x === 42 && c === 2 ? (p2(r, 5, x), { ok: false }) : p2(r, c, x))
      res = await m.moveBlocks({ row: R, moves: past, wire: r2.wire, rows: 6, cols: 14, blocks: e.presetBlocks() })
      assert.deepEqual(res.notPlaced, [{ name: 'Output 1', col: 2, between: true, gone: false }], `${where}: an Output the unit put elsewhere on the row is said as gone from it`)
      assert.deepEqual(m.afterMoveSaid({ row: R, res }).note, { text: 'The unit didn’t take Output 1 at column 3, so row 3 has an empty space there and no sound past it. Put a block in it, or move one back.', joins: [] }, where)
    }
  })

  test('chain move: Join the row pressed on a row that has lost its Output, or its Input, is never “joined again”; a row that never had both on it still is', async () => {
    const mod = await phoneMock()
    /* A row on row 3, joined but at the given columns, and a wire that may change the row as each join goes (`onJoin`). */
    const unit = (ids, cut) => {
      const d = mod.createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
      ids.forEach((id, col) => d.placeBlock(R, col, id))
      for (let col = 0; col < ids.length - 1; col++) if (!cut.includes(col)) d.cable(R, col, R, true)
      return d
    }
    const press = async (m, d, joins, onJoin = () => {}, row = R) => {
      const rec = recorded(d)
      const cable = rec.wire.setCable
      rec.wire.setCable = (a, b, c, on) => {
        const done = cable(a, b, c, on)
        onJoin(d)
        return done
      }
      const r = await m.joinRow({ row, joins, wire: rec.wire, blocks: d.presetBlocks(), rows: 6 })
      return { r, w: m.joinedWords(r) }
    }
    const NO_OUTPUT = { ok: false, text: 'Row 3 has no Output now, and no sound. Add one, or move one back.', joins: [] }
    const NO_INPUT = { ok: false, text: 'Row 3 has no Input now, and no sound. Add one, or move one back.', joins: [] }
    for (const [where, load] of BOTH) {
      const m = await load()
      /* BOTH ENDS BEFORE THE PRESS AND THE OUTPUT GONE AFTER IT: no Output, never joined again. */
      let { r, w } = await press(m, unit([37, 46, 118, 42], [1]), [{ srcRow: R, srcCol: 1, destRow: R }], (u) => u.placeBlock(R, 3, 0))
      assert.equal(r.sent, 1, where)
      assert.equal(r.noEnd, 'Output', where)
      assert.deepEqual(w, NO_OUTPUT, `${where}: a row that lost its Output is called joined again`)
      /* ... AND THE INPUT GONE AFTER IT: every join asked for is still there on that read, and it is no Input all the same. */
      const twoInputs = unit([37, 46, 118, 42], [1])
      /* Another row's Input (Input 2 on row 2) is not this row's: it is the Input that is said, not the Output. */
      twoInputs.placeBlock(R - 1, 0, 38)
      ;({ r, w } = await press(m, twoInputs, [{ srcRow: R, srcCol: 1, destRow: R }], (u) => u.placeBlock(R, 0, 0)))
      assert.equal(r.sent, 1, where)
      assert.deepEqual(r.still, [], `${where}: this case needs every join asked for there on the read after`)
      assert.equal(r.noEnd, 'Input', `${where}: another row’s Input is taken for this row’s`)
      assert.deepEqual(w, NO_INPUT, `${where}: a row that lost its Input is called joined again`)
      /* THE READ AFTER SAYS WHAT IS MISSING: an Output the read before did not have, there after the press, is joined again. */
      ;({ r, w } = await press(m, unit([37, 46, 118, 0], [1, 2]), [{ srcRow: R, srcCol: 1, destRow: R }], (u) => (u.placeBlock(R, 3, 42), u.cable(R, 2, R, true))))
      assert.equal(r.sent, 1, where)
      assert.equal(r.noEnd, null, where)
      assert.deepEqual(w, { ok: true, text: 'Row 3 is joined again.' }, `${where}: the ends are asked of the read before the press`)

      /*
       * A PARALLEL BRANCH NEVER HAD AN INPUT OR OUTPUT OF ITS OWN (the sixth
       * round's review): row 3 is Input, Comp, Drive, NAM, Output; row 4
       * leaves row 3 after the Input (Flanger, Delay, Tremolo) and comes
       * back into the Output. Two of its blocks are swapped, the unit
       * answers the join between them and does not take it, and Join the
       * row is offered. Pressed, the join goes and row 4 reads whole: joined
       * again, never "Row 4 has no Input".
       */
      const branch = unit([37, 46, 118, 206, 42], [])
      ;[82, 66, 70].forEach((id, i) => branch.placeBlock(R + 1, i + 1, id))
      branch.cable(R, 0, R + 1, true)
      branch.cable(R + 1, 1, R + 1, true)
      branch.cable(R + 1, 2, R + 1, true)
      branch.cable(R + 1, 3, R, true)
      const rec = recorded(branch)
      const cable = rec.wire.setCable
      rec.wire.setCable = (a, b, c, on) => (a === R + 1 && b === 1 && c === R + 1 ? { ok: true } : cable(a, b, c, on))
      const swap = [
        { id: 66, name: 'Delay 1', from: 2, to: 1 },
        { id: 82, name: 'Flanger 1', from: 1, to: 2 }
      ]
      const res = await m.moveBlocks({ row: R + 1, moves: swap, wire: rec.wire, rows: 6, cols: 14, blocks: branch.presetBlocks() })
      const said = m.afterMoveSaid({ row: R + 1, res })
      assert.deepEqual(res.still.map((j) => [j.srcRow, j.srcCol, j.destRow]), [[R + 1, 1, R + 1]], `${where}: this case needs the branch left cut between the swapped blocks`)
      assert.equal(said.note?.text, 'The blocks moved, but row 4 isn’t joined at column 3, so there’s no sound past it.', where)
      assert.ok(said.note.joins.length, `${where}: this case needs Join the row offered on the branch`)
      assert.equal(res.hadEnds, false, `${where}: a branch row is said to have had an Input and Output of its own`)
      assert.ok(said.note.joins.every((j) => j.had !== true), `${where}: a branch row’s joins say it had an Input and Output of its own`)
      ;({ r, w } = await press(m, branch, said.note.joins, () => {}, R + 1))
      assert.equal(r.sent, 1, `${where}: this case needs the one missing join sent`)
      assert.deepEqual(r.still, [], where)
      assert.equal(r.noEnd, null, `${where}: a branch row is asked for an Input or Output it never had`)
      assert.deepEqual(w, { ok: true, text: 'Row 4 is joined again.' }, `${where}: a branch row that reads whole is refused the green`)
      /* A ROW WHOSE OUTPUT IS ON THE NEXT ROW: Input, Comp, Drive on row 3, Drive joined down into Output 1 on row 4, and the join out of the Input dropped. */
      const down = unit([37, 46, 118], [0])
      down.placeBlock(R + 1, 3, 42)
      down.cable(R, 2, R + 1, true)
      ;({ r, w } = await press(m, down, [{ srcRow: R, srcCol: 0, destRow: R }]))
      assert.equal(r.sent, 1, where)
      assert.deepEqual(r.still, [], where)
      assert.equal(r.noEnd, null, `${where}: a row whose Output is on another row is asked for one of its own`)
      assert.deepEqual(w, { ok: true, text: 'Row 3 is joined again.' }, `${where}: a row whose Output is on the next row is refused the green`)
    }
  })

  test('chain move: a move that failed part-way and did not bring the Output, or the Input, back: Join the row from its note is never “joined again”', async () => {
    const mod = await phoneMock()
    const NO = (end) => ({ ok: false, text: `Row 3 has no ${end} now, and no sound. Add one, or move one back.`, joins: [] })
    /*
     * The eighth round (the seventh's review): the Output dragged one place
     * left past Flanger 1 (or the Input one place right past Comp 1), the
     * second place of the move throws, and so does putting that end back.
     * The other block goes back over it, the row has no Output (or Input)
     * anywhere, and the put-back's note still offers Join the row with the
     * plan's joins, every one of which is there. The read before the PRESS
     * already has no such end, so only what the move knew (the row had both)
     * keeps the green off a row with no sound.
     */
    for (const [where, load] of BOTH) {
      const m = await load()
      for (const [end, id, moves] of [
        ['Output', 42, [{ id: 42, name: 'Output 1', from: 5, to: 4 }, { id: 82, name: 'Flanger 1', from: 4, to: 5 }]],
        ['Input', 37, [{ id: 37, name: 'Input 1', from: 0, to: 1 }, { id: 46, name: 'Comp 1', from: 1, to: 0 }]]
      ]) {
        const d = await hisUnit(mod)
        const rec = recorded(d)
        const place = rec.wire.placeBlock
        let n = 0
        rec.wire.placeBlock = (r, c, x) => {
          n += 1
          if (n === 2 || (n > 2 && x === id)) throw new Error('The link dropped.')
          return place(r, c, x)
        }
        const res = await m.moveBlocks({ row: R, moves, wire: rec.wire, rows: 6, cols: 14, blocks: d.presetBlocks() })
        const said = m.afterMoveSaid({ row: R, res })
        assert.equal(res.hadEnds, true, `${where}: his row is not said to have had its Input and Output before the move`)
        assert.deepEqual(res.missingBack, [`${end} 1`], `${where}: this case needs the ${end} not put back`)
        assert.ok(!d.grid().cells.some((c) => c.row === R && c.effectId === id), `${where}: this case needs row 3 left with no ${end}`)
        assert.equal(said.note?.text, `The app tried to put the blocks back, but ${end} 1 isn’t back where it was in row 3.`, where)
        assert.ok(said.note.joins.length > 0, `${where}: this case needs Join the row offered`)
        assert.ok(said.note.joins.every((j) => j.had === true), `${where}: the note’s joins do not say the row had its Input and Output`)
        const r = await m.joinRow({ row: R, joins: said.note.joins, wire: recorded(d).wire, blocks: d.presetBlocks(), rows: 6 })
        assert.deepEqual(r.still, [], `${where}: this case needs every join asked for there on the read after`)
        assert.deepEqual(r.cuts, [], `${where}: this case needs rowCuts to find nothing on the row`)
        assert.equal(r.noEnd, end, where)
        assert.deepEqual(m.joinedWords(r), NO(end), `${where}: a row a failed move left with no ${end} is called joined again`)
      }
    }
  })

  test('chain move: the phone’s hold asks the unit unless its own screen already shows another preset', () => {
    /* The hold, built from the screen's own text, with the rig stubbed. */
    const body = code(read('mobile/src/screens/Edit.js')).match(/const presetHeld = (\(n\) =>[\s\S]*?: null)\n/)[1]
    const held = (joinsHere, screen, unit) => {
      const asked = []
      const getState = () => ({ preset: screen === undefined ? null : { number: screen } })
      const unitOnPreset = async (n) => (asked.push(n), unit)
      return { presetHeld: new Function('joinsHere', 'getState', 'unitOnPreset', `return ${body}`)(joinsHere, getState, unitOnPreset), asked }
    }
    return (async () => {
      /* Screen and unit both on 7: 'same', and the unit was asked. */
      let h = held(true, 7, 'same')
      assert.equal(await h.presetHeld(7)(), 'same')
      assert.deepEqual(h.asked, [7])
      /* The screen already on another preset: 'moved', with no need to ask. */
      h = held(true, 8, 'same')
      assert.equal(await h.presetHeld(7)(), 'moved')
      assert.deepEqual(h.asked, [])
      /* The screen showing -1 (a unit mid-switch) or nothing: the unit is asked, and its answer stands. */
      for (const [screen, unit] of [[-1, 'moved'], [-1, 'same'], [undefined, 'unknown'], [undefined, 'same']]) {
        h = held(true, screen, unit)
        assert.equal(await h.presetHeld(7)(), unit, `the screen showing ${screen}`)
        assert.deepEqual(h.asked, [7])
      }
      /* No hold where the joins are not the app's, or for a preset the screen cannot name. */
      assert.equal(held(false, 7, 'same').presetHeld(7), null)
      for (const n of [-1, null, undefined]) assert.equal(held(true, 7, 'same').presetHeld(n), null)
    })()
  })

  test('chain move: Join the row marks the chain as being written only once a join is let go, and a press that sends nothing is no edit', async () => {
    const mod = await phoneMock()
    for (const [where, load] of BOTH) {
      const m = await load()
      const press = async (d, { joins = null, onPreset = null, readFails = false } = {}) => {
        const order = []
        const rec = recorded(d, { readFails })
        const set = rec.wire.setCable
        rec.wire.setCable = (...a) => (order.push('join'), set(...a))
        const list = joins || m.rowCuts({ cells: d.grid().cells, blocks: d.presetBlocks(), rows: 6 })[0].joins
        const r = await m.joinRow({ row: R, joins: list, wire: rec.wire, rows: 6, onPreset, starting: () => order.push('starting') })
        return { r, order, list }
      }
      /* A cut row: `starting` once, just before the first join, and never again. */
      const d = await hisUnit(mod, { cut: true })
      const first = await press(d)
      assert.ok(first.r.sent >= 2, `${where}: this case needs more than one join`)
      assert.deepEqual(first.order, ['starting', ...first.order.slice(1).map(() => 'join')], `${where}: the chain is marked as being written other than once, before the first join`)
      assert.equal(first.order.length, first.r.sent + 1)
      /* Pressed again with every join there, on another preset, with the read failing, or into an empty cell: nothing sent, and nothing marked. */
      for (const [why, r] of [
        ['every join already there', await press(d, { joins: first.list })],
        ['the unit on another preset', await press(await hisUnit(mod, { cut: true }), { onPreset: async () => 'moved' })],
        ['the unit not saying its preset', await press(await hisUnit(mod, { cut: true }), { onPreset: async () => 'unknown' })],
        ['the read failing', await press(await hisUnit(mod, { cut: true }), { readFails: true })],
        ['a join into an empty cell', await press(await hisUnit(mod, { cut: true }), { joins: [{ srcRow: R, srcCol: 6, destRow: R }] })]
      ]) {
        assert.equal(r.r.sent, 0, `${where}, ${why}`)
        assert.deepEqual(r.order, [], `${where}, ${why}: the chain is marked as written by a press that sent nothing`)
      }
    }
    /* THE SCREENS: the phone marks the chain written from `starting` only; the browser records a change only where a join was sent, and a read otherwise. */
    const phone = flat(code(read('mobile/src/screens/Edit.js')))
    const mend = phone.slice(phone.indexOf('const mendRow = async'), phone.indexOf('const remove = async'))
    assert.match(mend, /const r = await joinRow\(\{[^}]*onPreset: presetHeld\(n\), starting: \(\) => beginChainWrite\(\) \}\)/, 'the phone: Join the row does not mark the chain written as its first join goes')
    assert.equal(mend.split('beginChainWrite()').length - 1, 1, 'the phone: Join the row marks the chain written before anything is sent')
    const web = flat(code(read('src/components/GridEditor.jsx')))
    assert.ok(
      web.includes("const w = joinedWords(r) leaveRow(cut.row, w.ok ? { text: w.text, joins: [], tone: 'ok', n } : { text: w.text, joins: w.joins ?? cut.joins, n }) if (r.sent) onChanged(w.ok ? `Joined row ${rowLabel(cut.row)} again` : `Tried to join row ${rowLabel(cut.row)} again`) else onReread?.() }"),
      'the browser: a Join the row that sent nothing is recorded as an edit'
    )
    /* And a move a preset change stopped part-way keeps its history line without marking the preset the unit stepped to unsaved. */
    assert.ok(web.includes("if (res.threw) onError(res.threw.message) onChanged(said.line, { stepped: res.stopped === 'moved' }) return }"), 'the browser: a move stopped by a preset change is not told as one')
    const app = flat(code(read('src/App.jsx')))
    assert.ok(app.includes('const record = useCallback((kind, summary, detail = [], fromAssistant = false, stepped = false) => {'), 'App: record does not take a stopped move')
    assert.ok(app.includes('if (!fromAssistant && !stepped && UNSAVES_PRESET.has(kind)) setDirty(true)'), 'App: a move stopped by a preset change marks the preset it stepped to unsaved')
  })

  test('chain move: the row asked after a move is asked with the move’s own rows, computer app and chain read, empty spaces counted', async () => {
    /* NAM 1 PARKED AFTER AN OUTPUT, fed from nothing, dragged before it: the plan joins only into NAM's column, and the Output it pushes along is fed from nothing after. */
    const parked = async (row, ids) => {
      const d = (await phoneMock()).createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
      ids.forEach((id, col) => d.placeBlock(row, col, id))
      const out = ids.indexOf(42)
      for (let col = 0; col < out; col++) d.cable(row, col, row, true)
      return { d, moves: [{ id: 206, name: 'NAM 1', from: out + 1, to: out }, { id: 42, name: 'Output 1', from: out, to: out + 1 }] }
    }
    const keys = (js) => (js || []).map((j) => [j.srcRow, j.srcCol, j.destRow])
    for (const [where, load] of BOTH) {
      const m = await load()
      /*
       * ROW 5 THROUGH HIS PI ON 1.90.63: Input, Comp, Drive, Flanger, Delay,
       * Output 1 at column 6, NAM 1 at 7. The plan's one join (row 5,
       * column 5 into 6) is right under the old law, so the move goes; the
       * Output, now at column 7, would need a join that computer app sends
       * to the wrong cell: said with its reason, and NO Join the row.
       */
      let { d, moves } = await parked(4, [37, 46, 118, 82, 70, 42, 206])
      let res = await m.moveBlocks({ row: 4, moves, wire: recorded(d).wire, rows: 6, cols: 14, law: true, version: '1.90.63', blocks: d.presetBlocks() })
      assert.equal(res.notSent, false, where)
      assert.deepEqual(keys(res.plan.joins), [[4, 4, 4]], where)
      let note = m.afterMoveSaid({ row: 4, res }).note
      assert.equal(note?.text, 'The blocks moved, but row 5 isn’t joined at column 7, so there’s no sound past it. The computer app on 1.90.63 sends the join into row 5 at column 7 to the wrong place. Update the computer app to 1.90.82 or later.', `${where}: the cut a 1.90.63 computer app cannot join is not said with why`)
      assert.deepEqual(note.joins, [], `${where}: Join the row offered for a join a 1.90.63 computer app sends to the wrong cell`)
      assert.equal(m.joinAsTheLaw(6, 5, 4), false)
      /* The same row through 1.90.82, which builds that join right: offered. */
      ;({ d, moves } = await parked(4, [37, 46, 118, 82, 70, 42, 206]))
      res = await m.moveBlocks({ row: 4, moves, wire: recorded(d).wire, rows: 6, cols: 14, law: m.oldCableBytes('1.90.82'), version: '1.90.82', blocks: d.presetBlocks() })
      note = m.afterMoveSaid({ row: 4, res }).note
      assert.equal(note?.text, 'The blocks moved, but row 5 isn’t joined at column 7, so there’s no sound past it.', where)
      assert.deepEqual(keys(note.joins), [[4, 5, 4]], `${where}: a join 1.90.82 builds right is not offered`)

      /* THE TOP ROW OF A SIX-ROW UNIT: the Output pushed to column 5 needs a join out of column 4, which the app cannot build. Said, with no button. */
      ;({ d, moves } = await parked(0, [37, 46, 118, 42, 206]))
      res = await m.moveBlocks({ row: 0, moves, wire: recorded(d).wire, rows: 6, cols: 14, blocks: d.presetBlocks() })
      assert.equal(res.notSent, false, `${where}: the top-row move this case needs was refused`)
      note = m.afterMoveSaid({ row: 0, res }).note
      assert.equal(note?.text, 'The blocks moved, but row 1 isn’t joined at column 5, so there’s no sound past it. The app can’t join the top row out of column 4.', where)
      assert.deepEqual(note.joins, [], `${where}: Join the row offered out of the top row's even column`)

      /*
       * AN EMPTY SPACE ALREADY IN THE ROW: Input, Comp, an empty column 3
       * (Drive keeps its feed across it), Drive, Flanger, NAM, Output;
       * Flanger and NAM swapped. Every join of the move reads back, and the
       * space is still there: said, with nothing to press.
       */
      d = (await phoneMock()).createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
      ;[[0, 37], [1, 46], [3, 118], [4, 82], [5, 206], [6, 42]].forEach(([c, id]) => d.placeBlock(R, c, id))
      for (const c of [0, 2, 3, 4, 5]) d.cable(R, c, R, true)
      res = await m.moveBlocks({ row: R, moves: [{ id: 206, name: 'NAM 1', from: 5, to: 4 }, { id: 82, name: 'Flanger 1', from: 4, to: 5 }], wire: recorded(d).wire, rows: 6, cols: 14, blocks: d.presetBlocks() })
      assert.deepEqual(res.still, [], where)
      assert.deepEqual(m.afterMoveSaid({ row: R, res }).note, { text: 'The blocks moved, but row 3 has an empty space at column 3 between its Input and Output, so the sound may stop there. Put a block in it, or move one back.', joins: [] }, `${where}: the empty space in the row is not said after the move`)

      /*
       * ENDS THE GRID READ NEITHER NAMES NOR NUMBERS (only the chain read's
       * word says which is the Input and which the Output): the row is asked
       * after with the chain read handed in, and so is where a block the unit
       * did not take sits.
       */
      const nameless = [
        { row: R, col: 0, effectId: 900, fromRows: [] },
        { row: R, col: 1, effectId: 46, fromRows: [R] },
        { row: R, col: 2, effectId: 118, fromRows: [R] },
        { row: R, col: 3, effectId: 901, fromRows: [R] }
      ]
      const slugs = [
        { effectId: 900, slug: 'input' },
        { effectId: 46, slug: 'comp' },
        { effectId: 118, slug: 'drive' },
        { effectId: 901, slug: 'output' },
        { effectId: 206, slug: 'nam' }
      ]
      let u = dropsOut([...nameless, { row: R, col: 4, effectId: 206, fromRows: [] }])
      res = await m.moveBlocks({ row: R, moves: [{ id: 206, name: 'NAM 1', from: 4, to: 3 }, { id: 901, name: 'Output 1', from: 3, to: 4 }], wire: u.wire, rows: 6, cols: 14, blocks: slugs })
      note = m.afterMoveSaid({ row: R, res }).note
      assert.equal(note?.text, 'The blocks moved, but row 3 isn’t joined at column 5, so there’s no sound past it.', `${where}: the row is asked after the move without the chain read's ends`)
      assert.deepEqual(keys(note.joins), [[R, 3, R]])
      u = dropsOut(nameless)
      const place = u.wire.placeBlock
      u.wire.placeBlock = (row, col, id) => (id === 46 && col === 2 ? { ok: false } : place(row, col, id))
      res = await m.moveBlocks({ row: R, moves: [{ id: 118, name: 'Drive 1', from: 2, to: 1 }, { id: 46, name: 'Comp 1', from: 1, to: 2 }], wire: u.wire, rows: 6, cols: 14, blocks: slugs })
      assert.deepEqual(res.notPlaced, [{ name: 'Comp 1', col: 2, between: true, gone: true }], `${where}: where a block the unit did not take sits is read without the chain read's ends`)
      /* And Join the row asks the row again the same way: an empty space between such ends is never "joined again". */
      u = dropsOut([
        { row: R, col: 0, effectId: 900, fromRows: [] },
        { row: R, col: 1, effectId: 46, fromRows: [] },
        { row: R, col: 3, effectId: 118, fromRows: [R] },
        { row: R, col: 4, effectId: 901, fromRows: [R] }
      ])
      const found = m.rowCuts({ cells: u.wire.gridCells(), blocks: slugs, rows: 6, only: [R] })[0]
      assert.deepEqual(keys(found.joins), [[R, 0, R]])
      const w = m.joinedWords(await m.joinRow({ row: R, joins: found.joins, wire: u.wire, blocks: slugs, rows: 6 }))
      assert.equal(w.ok, false, `${where}: Join the row says “joined again” over an empty space, asked without the chain read's ends`)
      assert.match(w.text, /^Row 3 has an empty space at column 3 between its Input and Output/)
    }
  })

  test('chain move: a move refused because the chain changed reads it again, as its words say, and the hosted website beside an older computer app is held to that app’s bytes', async () => {
    const m = await lib()
    assert.match(m.CHAIN_CHANGED, /It has been read again\.$/)
    const refusal = (text) => text.slice(text.indexOf('if (res.notSent) {'), text.indexOf('const said = afterMoveSaid'))
    assert.match(refusal(flat(code(read('mobile/src/screens/Edit.js')))), /if \(res\.why === CHAIN_CHANGED\) await refreshBlocks\(\{ quiet: true \}\) return \}\s*$/, 'the phone: “It has been read again” over a chain nobody read')
    /*
     * THE BROWSER READS IT AGAIN AND RECORDS NOTHING: a move that sent nothing
     * (the chain changed on the unit, or the unit was on another preset, the
     * ask after his settings were read included) is no edit. App's onChanged
     * writes a history line, hands the assistant a hand edit and marks the
     * preset unsaved (record('grid'): Save and Revert over a preset nothing
     * was written to), so it is a plain re-read of its own (`onReread`),
     * wired to App's read() alone at both of the editor's places.
     */
    const web = refusal(flat(code(read('src/components/GridEditor.jsx'))))
    assert.match(web, /if \(res\.stopped \|\| res\.why === CHAIN_CHANGED\) onReread\?\.\(\) return \}\s*$/, 'the browser: “It has been read again” over a chain nobody read, or a move never sent read again with a record of it')
    assert.ok(!/onChanged|onError|setIssue|record\(/.test(web), 'the browser: a move that sent nothing is recorded as a change, or said as a failure')
    assert.match(flat(code(read('src/components/GridEditor.jsx'))), /export default function GridEditor\(\{ [^}]*?, onReread = null \}\) \{/, 'the browser: the chain editor has no plain re-read')
    const app = flat(code(read('src/App.jsx')))
    const mounts = app.split('<GridEditor ').slice(1).map((s) => s.slice(0, s.indexOf('/>')))
    assert.equal(mounts.length, 2)
    for (const mount of mounts) {
      assert.match(mount, / onReread=\{\(\) => read\(\)\} $/, 'the browser: a chain editor whose re-read is not App’s read() alone')
      assert.match(mount, / onChanged=\{\(summary, how\) => \{ record\('grid', summary, \[\], false, how\?\.stepped === true\) read\(\) \}\} /, 'the browser: a chain editor whose changes are no longer recorded')
    }

    /* WHOSE BYTES: a computer app this page did not come from. */
    assert.equal(m.builtElsewhere({ role: 'remote', served: false }), true, 'through the relay')
    assert.equal(m.builtElsewhere({ role: 'mac', served: false }), true, 'the hosted website open on the computer that runs the app')
    assert.equal(m.builtElsewhere({ role: 'mac', served: true }), false, 'the computer’s own window')
    assert.equal(m.builtElsewhere({ role: 'wifi', served: true }), false, 'the computer’s Wi-Fi page')
    assert.equal(m.builtElsewhere({ role: 'unknown' }), false)
    /* Beside a computer app on 1.90.63, or one that does not say, a row-2 drag is refused; beside 1.90.82 it goes. */
    for (const [version, refused] of [['1.90.63', true], [null, true], ['1.90.82', false]]) {
      const d = (await phoneMock()).createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of d.presetBlocks()) d.placeBlock(b.row, b.col, 0)
      ;[37, 46, 118, 82, 42].forEach((id, col) => d.placeBlock(1, col, id))
      for (let col = 0; col < 4; col++) d.cable(1, col, 1, true)
      const res = await m.moveBlocks({ row: 1, moves: [{ id: 82, name: 'Flanger 1', from: 3, to: 2 }, { id: 118, name: 'Drive 1', from: 2, to: 3 }], wire: recorded(d).wire, rows: 6, cols: 14, law: m.builtElsewhere({ role: 'mac', served: false }) && m.oldCableBytes(version), version })
      assert.equal(res.notSent, refused, `beside a computer app on ${version}`)
    }
    /* The page on the computer reads that app's version from the app itself (its host.name), as the relay's does. */
    const link = flat(code(read('src/lib/link.js')))
    const readMac = link.slice(link.indexOf('async function readMac()'), link.indexOf('async function readMac()') + 2500)
    assert.match(readMac, /macVersion: named\?\.name \? \(named\.version \? String\(named\.version\) : null\) : state\.macVersion/)
  })

  test('chain move: Join the row asks the row again as it was found, and says only the pressed row', async () => {
    for (const [where, load] of BOTH) {
      const m = await load()
      const mod = await phoneMock()
      /* ROW 5 THROUGH HIS PI ON 1.90.63, CUT LIKE 390: the two joins that app sends right are pressed; the two it would send to the wrong cell are said after, with their reason, and no button. */
      const five = mod.createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of five.presetBlocks()) five.placeBlock(b.row, b.col, 0)
      ROW.forEach(([id], col) => five.placeBlock(4, col, id))
      five.cable(4, 4, 4, true)
      const right = [
        { srcRow: 4, srcCol: 0, destRow: 4 },
        { srcRow: 4, srcCol: 2, destRow: 4 }
      ]
      assert.ok(right.every((j) => m.joinAsTheLaw(6, j.srcCol, j.destRow)))
      const r = await m.joinRow({ row: 4, joins: right, wire: recorded(five).wire, blocks: five.presetBlocks(), rows: 6, law: true, version: '1.90.63' })
      assert.equal(r.sent, 2)
      const w = m.joinedWords(r)
      assert.equal(w.ok, false)
      assert.deepEqual(w.joins, [], `${where}: Join the row offers a join the old computer app sends to the wrong cell`)
      assert.match(w.text, /^Row 5 isn’t joined at column 3, so there’s no sound past it\. The computer app on 1\.90\.63 sends the join into row 5 at column 3 to the wrong place\./)

      /* TWO ROWS CUT, ONE PRESSED: what is said after is that row's only, never the other's cut and its joins. */
      const two = mod.createMockDevice('axefx3', { joinsAsOnUnit: true })
      for (const b of two.presetBlocks()) two.placeBlock(b.row, b.col, 0)
      ROW.forEach(([id], col) => two.placeBlock(R, col, id))
      two.cable(R, 4, R, true)
      ;[38, 58, 70, 43].forEach((id, col) => two.placeBlock(R + 1, col, id))
      two.cable(R + 1, 2, R + 1, true)
      const both = m.rowCuts({ cells: two.grid().cells, blocks: two.presetBlocks(), rows: 6 })
      assert.deepEqual(both.map((c) => c.row), [R, R + 1])
      const pressed = await m.joinRow({ row: R + 1, joins: both[1].joins, wire: recorded(two).wire, blocks: two.presetBlocks(), rows: 6 })
      assert.ok(Array.isArray(pressed.cuts) && pressed.cuts.every((c) => c.row === R + 1), `${where}: Join the row asks every row, not the one pressed`)
      assert.deepEqual(m.joinedWords(pressed), { ok: true, text: 'Row 4 is joined again.' })
      assert.deepEqual(m.joinedWords({ row: R + 1, still: [], checked: true, sent: 1, cuts: [both[0]] }), { ok: true, text: 'Row 4 is joined again.' }, `${where}: another row’s cut is said under the pressed row`)
    }
  })

  test('chain move: a preset change after the first join of a rejoin, or of a Join the row, stops it there, and nothing more is read as this preset’s', async () => {
    const asked = (sameFor) => {
      let k = 0
      return async () => (++k > sameFor ? 'moved' : 'same')
    }
    for (const [where, load] of BOTH) {
      const m = await load()
      const mod = await phoneMock()
      /* His drag, the unit stepping on after the rejoin's first join: one join, then nothing, and no read of the other preset. */
      const d = await hisUnit(mod)
      let rec = recorded(d)
      const res = await m.moveBlocks({ row: R, moves: await hisDrag(d), wire: rec.wire, rows: 6, cols: 14, onPreset: asked(9) })
      assert.equal(res.stopped, 'moved')
      assert.equal(cables(rec.sent).length, 1)
      assert.equal(rec.sent.filter((s) => s[0] === 'read').length, 2, `${where}: the preset the unit stepped to was read as this one`)
      assert.equal(res.checked, false)
      assert.equal(m.afterMoveSaid({ row: R, res }).issue, m.PRESET_MOVED_MID)
      /* Join the row, the same. */
      const c = await hisUnit(mod, { cut: true })
      rec = recorded(c)
      const joins = m.rowCuts({ cells: c.grid().cells, blocks: c.presetBlocks(), rows: 6 })[0].joins
      const r = await m.joinRow({ row: R, joins, wire: rec.wire, blocks: c.presetBlocks(), rows: 6, onPreset: asked(1) })
      assert.equal(cables(rec.sent).length, 1)
      assert.equal(rec.sent.filter((s) => s[0] === 'read').length, 1, `${where}: Join the row read the preset the unit stepped to as this one`)
      assert.equal(r.checked, false)
      assert.deepEqual(m.joinedWords(r), { ok: false, text: 'The app stopped joining row 3: the unit went to another preset.', joins: [] })
    }
    /* The phone follows the unit after a Join the row it stopped. */
    assert.match(flat(code(read('mobile/src/screens/Edit.js'))), /endChainWrite\(\{ refresh: false \}\) if \(r\.stopped\) followPresetAfterChainWrite\(\) else await refreshBlocks\(\{ quiet: true \}\)/, 'the phone: a Join the row stopped by a preset change does not follow the unit')
  })

  test('chain move: the plan and the cut-row read hold at their edges', async () => {
    for (const [where, load] of BOTH) {
      const m = await load()
      const mod = await phoneMock()
      const cells = (await hisUnit(mod)).grid().cells
      /* A chain changed under the screen at the SECOND moved block is refused too. */
      assert.equal(m.planMove({ cells, row: R, rows: 6, cols: 14, moves: [{ id: 118, name: 'Drive 1', from: 2, to: 1 }, { id: 999, name: 'Gone', from: 1, to: 2 }] }).why, m.CHAIN_CHANGED, where)
      /* Feeds the read did not say: refused, never a partial plan. */
      assert.equal(m.planMove({ cells: cells.map((c) => ({ ...c, fromRows: undefined })), row: R, rows: 6, cols: 14, moves: HIS_MOVES }).why, m.WIRING_UNKNOWN, where)
      /* An Output fed from nothing is a cut, in the chain read and in the grid read. */
      const outCut = [
        { row: R, col: 0, effectId: 37, slug: 'input', name: 'Input 1', fromRows: [] },
        { row: R, col: 1, effectId: 46, slug: 'comp', name: 'Comp 1', fromRows: [R] },
        { row: R, col: 2, effectId: 42, slug: 'output', name: 'Output 1', fromRows: [] }
      ]
      assert.equal(m.maybeCut(outCut), true, `${where}: an Output fed from nothing is not seen in the chain read`)
      assert.deepEqual(m.rowCuts({ cells: outCut, rows: 6 }).map((c) => [c.row, c.col]), [[R, 2]], `${where}: an Output fed from nothing is not a cut`)
      /* A row with no Input is never read as cut: its first cell is not taken for one. */
      const noInput = [
        { row: R + 1, col: 0, effectId: 46, name: 'Comp 1', fromRows: [] },
        { row: R + 1, col: 1, effectId: 118, name: 'Drive 1', fromRows: [] },
        { row: R + 1, col: 2, effectId: 43, name: 'Output 2', fromRows: [R + 1] }
      ]
      assert.deepEqual(m.rowCuts({ cells: noInput, rows: 6 }), [], `${where}: a row with no Input is read as cut`)
      /* The chain read's slug says which block is an end, where the grid read's name and number cannot. */
      const bySlug = [
        { row: R, col: 0, effectId: 900, fromRows: [] },
        { row: R, col: 1, effectId: 46, fromRows: [] },
        { row: R, col: 2, effectId: 901, fromRows: [R] }
      ]
      assert.equal(m.rowCuts({ cells: bySlug, rows: 6 }).length, 0)
      assert.deepEqual(m.rowCuts({ cells: bySlug, blocks: [{ effectId: 900, slug: 'input' }, { effectId: 901, slug: 'output' }], rows: 6 }).map((c) => c.col), [1], `${where}: the chain read’s word for an end is not taken`)
      /* A GRID READ THAT NAMES NEITHER END (a gen-3 unit's own numbers only): 390 is still found cut, and an ends drag still gets no join out of the Output or into the Input. */
      const nameless = (list) => list.map(({ name, ...c }) => c)
      const cut = await hisUnit(mod, { cut: true })
      assert.equal(m.rowCuts({ cells: nameless(cut.grid().cells), rows: 6 }).length, 1, `${where}: a cut row whose ends are named by number only is not found`)
      for (const [from, to, never] of [
        [5, 3, '2:3>2'],
        [0, 2, '2:1>2']
      ]) {
        const e = await hisUnit(mod)
        const rec = recorded(e)
        const grid = rec.wire.gridCells
        rec.wire.gridCells = () => nameless(grid())
        const res = await m.moveBlocks({ row: R, moves: await laneDrag(e, from, to), wire: rec.wire, rows: 6, cols: 14 })
        assert.equal(res.notSent, false)
        assert.ok(!res.plan.joins.some((j) => `${j.srcRow}:${j.srcCol}>${j.destRow}` === never), `${where}: ${never} planned when the ends are named by number only`)
      }
    }
  })

  test('chain move: what each screen stores, lets through and draws for a cut row is pinned whole, not only the calls', () => {
    /*
     * THE SCREENS ARE NOT RUN, so what they do for a cut row is held by its
     * text, WHOLE: each piece below is the flattened code (comments out) of
     * the cut-row read, RowCut, the place RowCut is drawn and the browser's
     * read after a write, token for token. A pin of a piece's first line let
     * one-token switch-offs through (the review's SP10-SP19 and SB7-SB16:
     * `!stop`, `!busy`, `!canJoin`, no words, a button that sends the joins
     * with no row, does nothing, or is never pressable, the read after a
     * write saying only its first row), each green on the whole suite. A
     * change to any of these is a change to this test, made on purpose.
     */
    const PINS = {
      'mobile/src/screens/Edit.js': [
        [
          'the cut-row read (the grid read only when the chain read shows a cut, nothing while a write is out, nothing kept from a read that was dropped)',
          "useEffect(() => { if (busy) return undefined if (!joinsHere || !maybeCut(blocks)) { setCutRows([]) return undefined } let stop = false ;(async () => { const cells = await gridCells().catch(() => null) if (stop || !Array.isArray(cells)) return const cuts = rowCuts({ cells, blocks, rows: gridRows, law: oldBytes(), version: linkState().hostVersion }) const said = cuts.map((c) => `row ${rowLabel(c.row)} at column ${colLabel(c.col)} (${c.joins.length} to join${c.blocked.length ? `, ${c.blocked.length} the app can’t` : ''})`).join('; ') if (said && said !== cutsSaid.current) logDebug('chain', 'a row reads cut', said) cutsSaid.current = said setCutRows(cuts) })() return () => { stop = true } }, [blocks, busy, joinsHere])"
        ],
        [
          'RowCut (the words, and Join the row where there are joins to send, pressable while nothing else is being written, sending the joins with their row)',
          "function RowCut({ said, row, joining, busy, onJoin }) { if (!said?.text) return null const canJoin = Array.isArray(said.joins) && said.joins.length > 0 return ( <View style={{ gap: space.sm }}> <Note tone={said.tone === 'ok' ? 'hint' : 'warn'}>{said.text}</Note> {canJoin ? <Press label={joining ? JOINING_ROW : JOIN_ROW} height={40} disabled={busy} onPress={() => onJoin({ ...said, row })} /> : null} </View> ) }"
        ],
        ['where RowCut is drawn (under each row, its note or the read’s cut, Join the row sent to mendRow with that row)', '<RowCut said={rowNote(leftUnder[lane.row], cutRows.find((c) => c.row === lane.row), presetHere)} joining={joining === lane.row} busy={busy} onJoin={mendRow} row={lane.row} />']
      ],
      'src/components/GridEditor.jsx': [
        [
          'the cut-row read',
          "useEffect(() => { if (busy || working) return undefined if (!joinsHere || !maybeCut(blocks)) { setCutRows([]) return undefined } let stop = false ;(async () => { const cells = await gridNow().catch(() => null) if (stop || !Array.isArray(cells)) return const cuts = rowCuts({ cells, blocks, rows, law: oldBytes(), version: cablesVersion() }) const said = cuts.map((c) => `row ${rowLabel(c.row)} at column ${label(c.col)} (${c.joins.length} to join${c.blocked.length ? `, ${c.blocked.length} the app can’t` : ''})`).join('; ') if (said && said !== cutsSaid.current) logDebug('chain', 'a row reads cut', said) cutsSaid.current = said setCutRows(cuts) })() return () => { stop = true } }, [blocks, busy, working, joinsHere])"
        ],
        [
          'RowCut',
          'function RowCut({ said, joining, disabled, onJoin }) { if (!said?.text) return null const canJoin = Array.isArray(said.joins) && said.joins.length > 0 return ( <div className="notice chain-cut" data-kind={said.tone === \'ok\' ? \'did\' : \'fault\'} role="status"> <p>{said.text}</p> {canJoin ? ( <button type="button" className="chip" onClick={() => onJoin(said)} disabled={disabled}> {joining ? JOINING_ROW : JOIN_ROW} </button> ) : null} </div> ) }'
        ],
        ['where RowCut is drawn (pressable only where the chain may be edited and nothing is being written)', '<RowCut said={rowNote(leftUnder[lane.row], cutRows.find((c) => c.row === lane.row), chainNow.number)} joining={joining === lane.row} disabled={!editable || busy || !!working} onJoin={(said) => mendRow({ ...said, row: lane.row })} />'],
        [
          'the read after a write (every row it touched, each said under itself with its own joins)',
          "const checkRows = async (touched, { holes = false, what = 'change', n = chainNow.number } = {}) => { if (!joinsHere) return const cells = await gridNow().catch(() => null) if (!Array.isArray(cells)) return const cuts = rowCuts({ cells, blocks, rows, law: oldBytes(), version: cablesVersion(), holes, only: touched }) for (const r of touched) { const cut = cuts.find((c) => c.row === r) leaveRow(r, cut ? { text: cut.text, joins: cut.joins, n } : null) if (cut) logDebug('chain', `row ${rowLabel(r)} after the ${what}`, cut.text) } }"
        ]
      ]
    }
    for (const [file, pins] of Object.entries(PINS)) {
      const text = flat(code(read(file)))
      for (const [what, pinned] of pins) assert.ok(text.includes(pinned), `${file}: ${what} is not as pinned`)
      /* Each drawn once, and Join the row pressed nowhere else. */
      assert.equal(text.split('<RowCut ').length - 1, 1, `${file}: RowCut drawn more or less than once`)
      assert.equal(text.split('mendRow(').length - 1 + text.split('onJoin={mendRow}').length - 1, 1, `${file}: Join the row is sent from more than its button`)
    }
    /* The phone's read of the row a block left (an Add that moved it), whole. */
    assert.ok(
      flat(code(read('mobile/src/screens/Edit.js'))).includes(
        "const sayRowLeft = async (row, n) => { const cells = await gridCells().catch(() => null) if (!Array.isArray(cells)) return const cut = rowCuts({ cells, blocks: getState().allBlocks || blocks, rows: gridRows, law: oldBytes(), version: linkState().hostVersion, holes: true, only: [row] })[0] leaveRow(row, cut ? { text: cut.text, joins: cut.joins, n } : null) if (cut) logDebug('chain', `row ${rowLabel(row)} after a block was moved out of it`, cut.text) }"
      ),
      'the phone: the read of the row a block left is not as pinned'
    )
    for (const [file, name] of SCREENS) {
      const text = flat(code(read(file)))
      assert.match(text, /const mendRow = async \(cut\) => \{ if \(!cut\?\.joins\?\.length\) return/, `${name}: Join the row lets nothing through`)
    }
  })
}
