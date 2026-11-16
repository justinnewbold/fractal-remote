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
 * cell takes its joins with it, as his unit did.
 *
 * What these hold: his drag, on his row, reads joined afterwards and sends
 * only the joins that went missing, each once; a drag whose joins the app
 * could not make again sends nothing at all; a row cut like his 390 is
 * offered "Join the row" and a preset with a parallel path is not; the
 * browser's drag is the phone's plan; the log says the row straight after
 * the move, before anything is mended; settings are measured and never
 * written, for his account only; and the demo is as it was. And, from an
 * independent review: Join the row only where the whole cut can be joined,
 * "joined again" only of a row that reads whole, never "sent" of nothing
 * sent; "put back" only where the read shows it; no join out of an Output
 * or into an Input; every write held to the preset; a bare wire, a split
 * and a merge beside a moved block; the newest truth under each row; and
 * each screen's own inputs to the plan pinned.
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
      assert.match(text, /const r = await joinRow\(\{ row: cut\.row, joins: cut\.joins, wire: moveWire, log: chainLog, names: [^}]*?\}?\)?\)?, blocks, rows(?:: gridRows)?, law: oldBytes\(\), version: [^,]+, holes: !!cut\.holes, onPreset: presetHeld\(n\) \}\)/, `${name}: Join the row does not ask the row again`)
      assert.match(text, /const w = joinedWords\(r\) leaveRow\(cut\.row, w\.ok \? \{ text: w\.text, joins: \[\], tone: 'ok', n \} : \{ text: w\.text, joins: w\.joins \?\? cut\.joins,/, `${name}: Join the row's words are not its own answer's`)
      /* A write to a row outdates what the last read found there, and every write to a row clears what was said under it. */
      assert.match(text, /const leaveRow = \(row, said\) => \{ setLeftUnder\(.*?\) setCutRows\(\(was\) => \(was\.some\(\(c\) => c\.row === row\) \? was\.filter\(\(c\) => c\.row !== row\) : was\)\) \}/, `${name}: a row's old read outlives a write to it`)
      const fn = (start) => text.slice(text.indexOf(start), text.indexOf(start) + 1500)
      assert.match(fn(name === 'the phone' ? 'const add = async' : 'const add = async'), /leaveRow\(row, null\)/, `${name}: an Add leaves the row's old note up`)
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
    assert.match(text, /await checkRows\(\[row\], \{ what: 'add' \}\)/, 'a Replace does not read the row back')
    assert.match(text, /const cuts = rowCuts\(\{ cells, blocks, rows, law: oldBytes\(\), version: cablesVersion\(\), holes, only: touched \}\)/)
    /* Through the relay to an older computer app, the old bytes; the computer's own window and Wi-Fi page are this release. */
    assert.match(text, /const oldBytes = \(\) => !isDemo\(\) && linkState\(\)\?\.role === 'remote' && oldCableBytes\(linkState\(\)\.macVersion\)/)

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
    const tapped = await m.joinRow({ row: R, joins: tapCuts[0].joins, wire: recorded(tap).wire, blocks: tap.presetBlocks(), rows: 6, holes: tapCuts[0].holes })
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
      ['mobile/src/screens/Edit.js', 'the phone', /: unitOnPreset\(n\)/, 'const n = getState().preset?.number'],
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
}
