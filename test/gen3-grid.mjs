/**
 * THE CHAIN'S MESSAGES OVER BLUETOOTH (mobile/src/lib/gen3-grid.js and
 * mobile/src/lib/am4-chain.js).
 *
 * "The four screens are good. I need everything with the chain builder to
 * work over Bluetooth also" (Justin, 15 November 2026).
 *
 * These messages change a preset's STRUCTURE on a real unit, and nobody had
 * sent one from a phone before the day they were written, so what is held
 * here is what can be held without a unit:
 *
 *   - every frame the phone can build is the one the codec the computer app
 *     carries builds for the same thing, over every cell, a spread of block
 *     ids and every cable (test/gen3-grid-codec.json, written by
 *     scripts/grid-frames.mjs from the pinned codec, and held to the lock)
 *   - what cannot be built is refused, never guessed: a cell off the grid,
 *     an FM3's thirteenth column, the one cable nobody has decoded
 *   - the two grid reads come out as the grid that went in, on pretend
 *     answers (test/gen3-grid-fake.mjs). The codec reads the pretend PRESET
 *     the same on every unit, and the pretend LIVE answer's block ids and
 *     shunts; its cables the same on an FM3 only. On the six-row units the
 *     pretend live answer lays its cable bits by this app's own guess,
 *     which the codec's FM9 reading does not share (run on these answers,
 *     it reads every six-row cable shifted), so a six-row live cable in a
 *     test here proves the code against its own assumption and nothing
 *     about a unit
 *   - the rule the live read WOULD be believed by: only where the preset
 *     has borne it out, and never once it has disagreed. The app does not
 *     believe it yet at all (bleWire `liveGrid`, held in test/bluetooth)
 *   - the way out's rules: a grid frame, or an AM4's slot write, goes only
 *     as the one in hand
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { AM4_CODES, GRID_UNITS, cableFromCodec, cableWalked, gridDigests, idsFor } from './gen3-grid-sweep.mjs'
import { makeDump, makeLive } from './gen3-grid-fake.mjs'

const GRID = '../mobile/src/lib/gen3-grid.js'
const AM4_CHAIN = '../mobile/src/lib/am4-chain.js'
const SX = '../mobile/src/lib/fractal-sysex.mjs'
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const hex = (b) => b.map((x) => x.toString(16).padStart(2, '0')).join(' ')
const sha = (frames) => createHash('sha256').update(frames.flat().map((x) => x.toString(16).padStart(2, '0')).join('')).digest('hex')
const sorted = (cells) => JSON.stringify([...cells].sort((a, b) => a.col - b.col || a.row - b.row).map((c) => ({ row: c.row, col: c.col, effectId: c.effectId, fromRows: c.fromRows })))

/* Grids to read back: bare (an input and an output), a chain with a split, a shunt and cables, blocks numbered over 127. */
const GRIDS = {
  bare3: [0x11, [{ row: 1, col: 0, effectId: 37, fromRows: [] }, { row: 1, col: 11, effectId: 42, fromRows: [] }]],
  chain3: [
    0x11,
    [
      { row: 1, col: 0, effectId: 37, fromRows: [] },
      { row: 1, col: 1, effectId: 118, fromRows: [1] },
      { row: 1, col: 2, effectId: 58, fromRows: [1] },
      { row: 2, col: 2, effectId: 1024, fromRows: [1] },
      { row: 1, col: 3, effectId: 62, fromRows: [1, 2] },
      { row: 0, col: 4, effectId: 1025, fromRows: [1] },
      { row: 3, col: 11, effectId: 150, fromRows: [3] }
    ]
  ],
  bare9: [0x12, [{ row: 1, col: 0, effectId: 37, fromRows: [] }, { row: 1, col: 13, effectId: 42, fromRows: [] }]],
  chain9: [
    0x12,
    [
      { row: 1, col: 0, effectId: 37, fromRows: [] },
      { row: 1, col: 1, effectId: 46, fromRows: [1] },
      { row: 1, col: 2, effectId: 58, fromRows: [1] },
      { row: 5, col: 2, effectId: 1024, fromRows: [1] },
      { row: 1, col: 3, effectId: 62, fromRows: [1, 5] },
      { row: 0, col: 13, effectId: 42, fromRows: [0] }
    ]
  ],
  nam3x: [
    0x10,
    [
      { row: 1, col: 0, effectId: 37, fromRows: [] },
      { row: 1, col: 1, effectId: 206, fromRows: [1] },
      { row: 1, col: 2, effectId: 195, fromRows: [1] },
      { row: 4, col: 13, effectId: 42, fromRows: [3, 4] }
    ]
  ]
}
/*
 * The pretend answers, by digest, as they were on the day forgefx-midi at
 * the pinned commit read each of them back as the grid above (its
 * parsePresetDump, decodeRawPatch and decodeGen3Body for the preset, its
 * parseGen3GridLayout for the live answer: the cells and ids on every unit,
 * the cables on the FM3's, see the head of this file). A change to
 * test/gen3-grid-fake.mjs moves these, and then the pretend unit is no
 * longer one the codec has been seen to read: check it against the codec
 * again before writing new digests here.
 */
const FAKE_DIGESTS = {
  bare3: ['1f5aa4c91177209e', '7c529c3a76761bc2'],
  chain3: ['1182db2ad06e7249', '5315b385eed22674'],
  bare9: ['d85259dc1d05b071', '2750fcff429ab54d'],
  chain9: ['8e0c16acb4102da1', 'c221fa742ef8b140'],
  nam3x: ['3897d59614fae2e7', '1ff1f48b87045d25']
}

export function run(test) {
  test('a whole preset’s size, for Quick build’s bar: 49,336 bytes from an Axe-Fx III (as his came over a WIDI Master), 24,680 from an FM3 or FM9, and none for a unit whose count is not known', async () => {
    const g = await import(GRID)
    const sx = await import('../mobile/src/lib/fractal-sysex.mjs')
    assert.deepEqual([g.dumpBytes(0x10), g.dumpBytes(0x11), g.dumpBytes(0x12)], [49336, 24680, 24680])
    for (const none of [sx.MODELS.am4, 0x14, undefined, null]) assert.equal(g.dumpBytes(none), null, String(none))
    for (const [model, chunks] of Object.entries(g.DUMP_CHUNKS)) {
      assert.equal(g.dumpBytes(Number(model)), g.DUMP.HEAD_BYTES + chunks * g.DUMP.CHUNK_BYTES + g.DUMP.FOOT_BYTES)
      /* The pretend unit's preset, head to foot, is that many bytes: the bar's whole is what a unit sends. */
      assert.equal(makeDump(Number(model), []).reduce((n, f) => n + f.length, 0), g.dumpBytes(Number(model)), model)
    }
    assert.deepEqual(Object.keys(g.DUMP_CHUNKS).map(Number).sort(), [0x10, 0x11, 0x12])
  })

  test('every grid message the phone builds is the one the computer app’s codec builds, over every cell and cable', async () => {
    const g = await import(GRID)
    const c = await import(AM4_CHAIN)
    const kept = JSON.parse(src('test/gen3-grid-codec.json'))
    const lock = JSON.parse(src('desktop/forgefx.lock.json'))
    /* A new pin is a new walk: scripts/grid-frames.mjs on the pinned codec, never a phone that sends what an older computer sent. */
    assert.equal(kept.from, lock['forgefx-midi'].commit, 'the grid’s digests are not from the codec desktop/forgefx.lock.json pins: run scripts/grid-frames.mjs on it')
    assert.match(src('scripts/grid-frames.mjs'), /if \(head !== pinned\) throw new Error/, 'the digests can be written from a codec that is not the pinned one')
    const mine = gridDigests({
      select: g.buildGridSelect,
      put: g.buildGridPut,
      cable: g.buildGridCable,
      read: g.buildGridRead,
      dump: g.buildGridDump,
      slot: c.buildAm4Slot
    })
    assert.deepEqual(mine, kept.sums)
    /*
     * And the walk is the whole of what is the codec's: every FM3 cable, and
     * on six rows the 270 (joined and parted, 540) whose bytes the codec's
     * law gets right, so none is left out of the digest by a loop that stops
     * early. The other 162 are the next test's.
     */
    assert.deepEqual(
      Object.fromEntries(Object.entries(GRID_UNITS).map(([name]) => [name, kept.sums[name].cables])),
      { fm3: 4 * 11 * 4 * 2, fm9: 270 * 2, axefx3: 270 * 2 }
    )
  })

  /*
   * "I'm confused by the built but not joined?" (Justin, 15 November 2026:
   * Quick build on his Axe-Fx III, an Input, two blocks and an Output on row
   * 2, three cables, every message taken, and a read back with the row not
   * joined at its first cable.) The
   * codec's six-row cable law names the wrong cell for a cable into row 2.
   */
  test('a six-row cable names the two cells that were asked for, every one of them; the codec’s law does not, into row 2', async () => {
    const g = await import(GRID)
    /* The codec's fitted six-row law, as the phone sent it until 1.90.82 and as a computer app from before then still does. Kept here to say what those bytes meant. */
    const law = (srcRow, srcCol, destRow) => {
      const cell = (srcCol - 1) * 6 + (srcRow - 1)
      const colTerm = Math.floor((3 * (srcCol - 1)) / 2) + 1
      return [Math.floor(cell / 2), ((cell & 1) << 6) | (colTerm + (destRow >= 3 ? 1 : 0)), ((Math.abs(destRow - 3) + (srcCol % 2 === 0 ? 2 : 0)) % 4) << 5]
    }
    const checked = (f) => (f.slice(0, -2).reduce((a, b) => a ^ b, 0) & 0x7f) === f[f.length - 2]
    for (const [name, unit] of Object.entries(GRID_UNITS)) {
      let same = 0
      let changed = 0
      for (let srcCol = 1; srcCol < unit.cols; srcCol++) {
        for (let srcRow = 1; srcRow <= unit.rows; srcRow++) {
          if (!cableWalked(unit, srcRow, srcCol)) continue
          for (let destRow = 1; destRow <= unit.rows; destRow++) {
            for (const join of [true, false]) {
              const f = g.buildGridCable(unit.model, srcRow, srcCol, destRow, join)
              const where = `${name} row ${srcRow}, column ${srcCol} into row ${destRow}`
              assert.equal(f.length, 26, where)
              assert.ok(checked(f), `${where}: the checksum`)
              assert.equal(f[12], join ? 0x01 : 0x02, `${where}: joined or parted`)
              /* Read back out of the frame: the cell it leaves, and the cell it feeds, one column on. */
              const { from, to } = g.cableCells(f[21], f[22], f[23])
              assert.equal(from, (srcCol - 1) * unit.rows + (srcRow - 1), `${where}: the cell it leaves`)
              assert.equal(to, srcCol * unit.rows + (destRow - 1), `${where}: the cell it feeds`)
              assert.equal(Math.floor(to / unit.rows), Math.floor(from / unit.rows) + 1, `${where}: not into the next column`)
              for (const b of f.slice(21, 24)) assert.ok(b >= 0 && b <= 0x7f, `${where}: a byte over seven bits`)
            }
            if (unit.rows !== 6) continue
            const mine = g.buildGridCable(unit.model, srcRow, srcCol, destRow, true).slice(21, 24).join(',')
            const laws = law(srcRow, srcCol, destRow).join(',')
            /* Which cables the law got right is the sweep's rule and the phone's own, and they are one rule. */
            assert.equal(mine === laws, cableFromCodec(unit, srcCol, destRow), `${name} row ${srcRow}, column ${srcCol} into row ${destRow}: the law and the packing`)
            assert.equal(g.cableAsTheLaw(6, srcCol, destRow), cableFromCodec(unit, srcCol, destRow), 'the phone’s own word for which cables an older computer app gets right')
            if (mine === laws) same++
            else changed++
          }
        }
      }
      if (unit.rows === 6) assert.deepEqual([same, changed], [270, 162], `${name}: how many cables are the law’s own bytes, and how many changed`)
      assert.equal(g.cableAsTheLaw(unit.rows, 2, 2), unit.rows !== 6, `${name}: row 2 from an even column`)
    }
    /* THE ROW THAT DID NOT JOIN: row 2 of an Axe-Fx III, columns 1 to 4. What went out named row 6 of the source's own column. */
    for (const [i, srcCol] of [1, 2, 3].entries()) {
      const { from, to } = g.cableCells(...law(2, srcCol, 2))
      assert.equal(from, i * 6 + 1, 'the law’s bytes have the source right')
      assert.equal(to, i * 6 + 5, 'read as the two cells, the law’s row-2 bytes name row 6 of the SAME column')
    }
    /* Out of an even column into rows 5 and 6, the law names rows 1 and 2 of the next column: a real cable, into the wrong row. */
    assert.deepEqual(g.cableCells(...law(2, 2, 5)), { from: 7, to: 12 })
    assert.deepEqual(g.cableCells(...law(2, 2, 6)), { from: 7, to: 13 })
    /* What goes out now, by its bytes: the same three frames the computer app's own test holds (ForgeFX server/test/drivers/grid-cable.test.ts), so the two ends cannot drift. */
    assert.equal(hex(g.buildGridCable(0x10, 2, 1, 2, true)), 'f0 00 01 74 10 01 35 00 00 00 00 00 01 00 00 00 00 00 00 02 00 00 41 60 03 f7')
    assert.equal(hex(g.buildGridCable(0x10, 2, 2, 2, true)), 'f0 00 01 74 10 01 35 00 00 00 00 00 01 00 00 00 00 00 00 02 00 03 43 20 42 f7')
    assert.equal(hex(g.buildGridCable(0x10, 2, 3, 2, true)), 'f0 00 01 74 10 01 35 00 00 00 00 00 01 00 00 00 00 00 00 02 00 06 44 60 00 f7')
    /* And along row 3, where Quick build puts a chain on a six-row unit, the law's bytes and these are the same, column after column: an older computer app sends the same bytes there. (His Axe-Fx III has joined that row twice: from the phone over a WIDI Master, report 913f344a, and through his Pi on computer app 1.90.63, report adc7d553.) */
    for (let srcCol = 1; srcCol <= 13; srcCol++) {
      assert.deepEqual(g.buildGridCable(0x10, 3, srcCol, 3, true).slice(21, 24), law(3, srcCol, 3), `row 3, column ${srcCol}`)
      assert.deepEqual(g.buildGridCable(0x12, 4, srcCol, 4, true).slice(21, 24), law(4, srcCol, 4), `row 4, column ${srcCol}`)
      assert.ok(g.cableAsTheLaw(6, srcCol, 3) && g.cableAsTheLaw(6, srcCol, 4))
      assert.equal(g.cableAsTheLaw(6, srcCol, 2), false, 'no cable into row 2 is right from an older computer app')
    }
    /* An FM3's rule IS the packing with four rows (FM3-Edit's own messages bear it out), which is why six rows are packed the same way. */
    for (let srcCol = 1; srcCol <= 11; srcCol++) for (let srcRow = 1; srcRow <= 4; srcRow++) for (let destRow = 1; destRow <= 4; destRow++) {
      const cell = (srcCol - 1) * 4 + (srcRow - 1)
      assert.deepEqual(g.cableWhere(4, srcRow, srcCol, destRow), [Math.floor(cell / 2), ((cell & 1) << 6) | srcCol, (destRow - 1) << 5])
    }
    /* The shared rules send a six-row chain to the third row, and say why in the same place this file does. */
    const rules = await import(new URL('../shared/starter-chains.mjs', import.meta.url).href)
    assert.equal(rules.homeRow(6), 2)
  })

  test('the frames themselves, read off the bytes: which cell, which block, which cable', async () => {
    const g = await import(GRID)
    const sx = await import(SX)
    /* An FM9's Amp into row 1, column 1, and a Cab into row 1, column 4: the codec's own goldens, captured from FM9-Edit. */
    assert.equal(hex(g.buildGridPut(0x12, 1, 1, 58)), 'f0 00 01 74 12 01 32 00 3a 00 00 00 00 00 00 00 00 00 00 00 00 1e f7')
    assert.equal(g.buildGridPut(0x12, 1, 4, 62)[12], 0x12)
    /* An FM3's Cab into row 4, column 12: its last cell, numbered down the columns four to a column. */
    assert.equal(g.buildGridPut(0x11, 4, 12, 62)[12], 0x2f)
    /* An FM3's cable out of row 2, column 1 into row 2 of column 2, from FM3-Edit. */
    assert.equal(hex(g.buildGridCable(0x11, 2, 1, 2, true)).slice(0, 71), 'f0 00 01 74 11 01 35 00 00 00 00 00 01 00 00 00 00 00 00 02 00 00 41 20')
    assert.equal(g.buildGridCable(0x11, 2, 1, 2, false)[12], 0x02, 'parting a cable is not 02')
    for (const unit of Object.values(GRID_UNITS)) {
      for (const f of [g.buildGridSelect(unit.model, 1, 1), g.buildGridPut(unit.model, unit.rows, unit.cols, 0), g.buildGridCable(unit.model, 2, 1, 2, true), g.buildGridRead(unit.model), g.buildGridDump(unit.model)]) {
        assert.ok(sx.isFractal(f) && sx.checksumOk(f) && f[4] === unit.model && f.every((b, i) => i === 0 || i === f.length - 1 || b < 0x80), hex(f))
      }
      assert.equal(g.buildGridSelect(unit.model, 1, 1).length, 23)
      assert.equal(g.buildGridPut(unit.model, 1, 1, 58).length, 23)
      assert.equal(g.buildGridCable(unit.model, 2, 1, 2, true).length, 26)
      assert.equal(g.buildGridRead(unit.model).length, 23)
      assert.equal(g.buildGridDump(unit.model).length, 11)
    }
  })

  test('what is not on a unit’s grid is never built: a cell off it, an FM3’s thirteenth column, the one cable nobody has decoded', async () => {
    const g = await import(GRID)
    for (const [name, unit] of Object.entries(GRID_UNITS)) {
      for (const [row, col] of [[0, 1], [unit.rows + 1, 1], [1, 0], [1, unit.cols + 1], [1.5, 1], ['1', 1], [1, null], [NaN, 1]]) {
        assert.equal(g.buildGridSelect(unit.model, row, col), null, `${name} selected row ${row}, column ${col}`)
        assert.equal(g.buildGridPut(unit.model, row, col, 58), null, `${name} put a block in row ${row}, column ${col}`)
        assert.equal(g.cellOnGrid(unit.model, row, col), false)
      }
      for (const id of [-1, 16384, 1.5, '58', null, undefined, NaN]) assert.equal(g.buildGridPut(unit.model, 1, 1, id), null, `${name} put block ${id}`)
      /* A cable goes into the NEXT column: the last column starts none. The codec lets an FM3 ask for columns 12 and 13, which it does not have. */
      for (const srcCol of [0, unit.cols, unit.cols + 1, 14]) {
        if (srcCol >= 1 && srcCol < unit.cols) continue
        assert.equal(g.buildGridCable(unit.model, 2, srcCol, 2, true), null, `${name} cabled out of column ${srcCol}`)
      }
      for (const [srcRow, destRow] of [[0, 1], [unit.rows + 1, 1], [1, 0], [1, unit.rows + 1]]) assert.equal(g.buildGridCable(unit.model, srcRow, 1, destRow, true), null)
      /* Out of a six-row grid's top row from an even column: refused, on every such column, into every row, join and part. */
      for (let srcCol = 1; srcCol < unit.cols; srcCol++) {
        for (let destRow = 1; destRow <= unit.rows; destRow++) {
          const walked = cableWalked(unit, 1, srcCol)
          assert.equal(g.cableKnown(unit.model, 1, srcCol, destRow), walked, `${name} top row, column ${srcCol}`)
          assert.equal(g.buildGridCable(unit.model, 1, srcCol, destRow, true) === null, !walked)
          assert.equal(g.buildGridCable(unit.model, 1, srcCol, destRow, false) === null, !walked)
        }
      }
    }
    /* An FM3 has no undecoded cable: four rows, every one built. */
    for (let srcCol = 1; srcCol < 12; srcCol++) for (let srcRow = 1; srcRow <= 4; srcRow++) assert.ok(g.buildGridCable(0x11, srcRow, srcCol, 1, true))
    /* A unit with no grid has none of it. */
    for (const model of [0x15, 0x07, undefined]) {
      assert.equal(g.gridSize(model), null)
      assert.equal(g.buildGridSelect(model, 1, 1), null)
      assert.equal(g.buildGridPut(model, 1, 1, 58), null)
      assert.equal(g.buildGridCable(model, 2, 1, 2, true), null)
      assert.equal(g.buildGridRead(model), null)
      assert.equal(g.buildGridDump(model), null)
    }
  })

  test('the way out’s rule: a frame of the grid’s shape goes only as, byte for byte, one of the frames in hand', async () => {
    const g = await import(GRID)
    const sx = await import(SX)
    for (const unit of Object.values(GRID_UNITS)) {
      const m = unit.model
      const frames = [g.buildGridSelect(m, 2, 3), g.buildGridPut(m, 2, 3, 58), g.buildGridCable(m, 2, 3, 2, true), g.buildGridCable(m, 2, 3, 2, false), g.buildGridRead(m)]
      for (const f of frames) {
        assert.ok(g.gridShaped(f, m), hex(f))
        assert.ok(g.gridAllowed(f, [f]))
        assert.ok(g.gridAllowed(f, frames))
        assert.ok(!g.gridAllowed(f, null) && !g.gridAllowed(f, []) && !g.gridAllowed(f, undefined), 'a grid frame went with no grid job in hand')
        /* Another model's byte in the same frame is not this unit's grid frame. */
        assert.ok(!g.gridShaped(f, m === 0x11 ? 0x12 : 0x11))
      }
      /* The cell beside the one in hand, another block into the same cell, the cable parted when it was to be joined: each refused. */
      assert.ok(!g.gridAllowed(g.buildGridPut(m, 2, 4, 58), [g.buildGridSelect(m, 2, 3), g.buildGridPut(m, 2, 3, 58)]))
      assert.ok(!g.gridAllowed(g.buildGridPut(m, 2, 3, 62), [g.buildGridPut(m, 2, 3, 58)]))
      assert.ok(!g.gridAllowed(g.buildGridCable(m, 2, 3, 2, false), [g.buildGridCable(m, 2, 3, 2, true)]))
      /* The sub-function the codec calls the clear's companion (33 00) is of the shape, and nothing here builds it: it can never be in hand. */
      const companion = sx.frame(m, 0x01, [0x33, 0x00, 0, 0, 0, 0, ...sx.septets32(5), 0, 0, 0, 0])
      assert.ok(g.gridShaped(companion, m))
      /* What the app sent before has none of the shapes: a knob (52 00), a typed write (09 00), a save (26 00), the tempo, a scene. */
      for (const sub of [0x52, 0x09, 0x26, 0x24, 0x16, 0x27, 0x19, 0x08, 0x1c, 0x1f, 0x00]) {
        assert.ok(!g.gridShaped(sx.frame(m, 0x01, [sub, 0x00, 0x3a, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), m), `sub ${sub.toString(16)} reads as a grid frame`)
      }
      assert.ok(!g.gridShaped(g.buildGridDump(m), m), 'the request for the preset is not one of the five')
      assert.ok(!g.gridShaped(sx.frame(m, 0x13), m))
    }
    assert.ok(!g.gridShaped(null, 0x11) && !g.gridShaped([0xf0], 0x11) && !g.gridShaped('f0', 0x11))
    /* An AM4 has no grid: a frame of the same bytes with its model is not grid-shaped. */
    assert.ok(!g.gridShaped(sx.frame(0x15, 0x01, [0x32, 0x00, 0x3a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 0x15))
  })

  test('an AM4’s slot write is the codec’s, held to four slots and the blocks the AM4 names, and goes only as the one in hand', async () => {
    const c = await import(AM4_CHAIN)
    const sx = await import(SX)
    /* A drive into slot 1: the register the preset lives in, the first slot's place, "set", four bytes, 118 as a float. */
    assert.equal(hex(c.buildAm4Slot(1, 0x76)), 'f0 00 01 74 15 01 4e 01 0f 00 01 00 00 00 04 00 00 00 1d 44 10 1d f7')
    assert.deepEqual([...c.AM4_PALETTE.map((b) => b.page)].sort((a, b) => a - b), [...Object.values(sx.AM4_BLOCKS)].sort((a, b) => a - b), 'the blocks offered are not exactly the ones the AM4 reports')
    assert.deepEqual([0, ...c.AM4_PALETTE.map((b) => b.page)].sort((a, b) => a - b), [...AM4_CODES].sort((a, b) => a - b))
    for (const b of c.AM4_PALETTE) {
      assert.ok(b.slug && b.family === b.slug && b.instance === 1 && typeof b.name === 'string' && b.name.length > 2 && /^[A-Z]/.test(b.name), JSON.stringify(b))
    }
    for (let slot = 1; slot <= 4; slot++) {
      for (const code of AM4_CODES) {
        const f = c.buildAm4Slot(slot, code)
        assert.equal(f.length, 23)
        assert.ok(sx.checksumOk(f))
        assert.deepEqual(c.readAm4Slot(f), { slot, code })
        assert.ok(c.am4SlotAllowed(f, [f]))
        assert.ok(!c.am4SlotAllowed(f, null) && !c.am4SlotAllowed(f, []) && !c.am4SlotAllowed(f, [c.buildAm4Slot(slot === 1 ? 2 : 1, code)]), 'a slot write went that was not the one in hand')
        /* None of the lists the AM4's way out had before lets one through. */
        assert.equal(sx.am4Allowed(f), null, `the AM4’s old list lets a slot write through: ${hex(f)}`)
      }
    }
    /* Never a fifth slot (one address further answered wrongly on a real AM4 and disturbed another slot), a slot 0, a second copy of a block, or a code that is no block. */
    for (const [slot, code] of [[0, 0x76], [5, 0x76], [1.5, 0x76], ['1', 0x76], [1, 0x77], [1, 0x3e], [1, 0xce], [1, -1], [1, 0.5], [1, null]]) assert.equal(c.buildAm4Slot(slot, code), null, `built slot ${slot}, code ${code}`)
    const made = (pidHigh, value) => sx.am4Frame({ pidLow: 0xce, pidHigh, action: 0x0001, hdr4: 4, payload: sx.am4Float(value) })
    /* Built by hand, the fifth slot and a code off the list: refused even if somebody had put them "in hand". */
    for (const f of [made(0x13, 0x76), made(0x0e, 0x76), made(0x0f, 0x77), made(0x0f, 0x3e), made(0x0f, 1.5)]) assert.ok(!c.am4SlotAllowed(f, [f]), hex(f))
    /* And the preset's own writes at that register stay what they were: the scene and the preset change are not slot writes. */
    assert.equal(c.readAm4Slot(sx.buildAm4Scene(1)), null)
    assert.equal(c.readAm4Slot(sx.buildAm4Preset(5)), null)
    assert.equal(c.readAm4Slot(sx.buildAm4Structure()), null)
    /* A damaged copy of a good one is not it. */
    const good = c.buildAm4Slot(2, 0x42)
    const bad = [...good]
    bad[18] ^= 0x01
    assert.ok(!c.am4SlotAllowed(bad, [bad]))
  })

  test('the pretend unit’s answers are the ones the codec was seen to read', () => {
    for (const [name, [model, cells]] of Object.entries(GRIDS)) {
      assert.deepEqual([sha(makeDump(model, cells)).slice(0, 16), sha([makeLive(model, cells)]).slice(0, 16)], FAKE_DIGESTS[name], name)
    }
  })

  test('the preset, read whole, gives the grid that is in it: cells, shunts and which rows feed which', async () => {
    const g = await import(GRID)
    for (const [name, [model, cells]] of Object.entries(GRIDS)) {
      const frames = makeDump(model, cells)
      assert.equal(frames.length, (model === 0x10 ? 16 : 8) + 2, name)
      assert.equal(frames.flat().length, model === 0x10 ? 49336 : 24680, `${name}: not the size a unit’s own preset is`)
      assert.deepEqual(frames.map((f) => g.gridDumpPart(f, model)), ['head', ...new Array(frames.length - 2).fill('chunk'), 'foot'])
      const got = g.parseGridDump(frames, model)
      assert.equal(sorted(got.cells), sorted(cells), name)
      assert.deepEqual([got.rows, got.cols], model === 0x11 ? [4, 12] : [6, 14])
      for (const cell of got.cells) assert.equal(cell.isShunt, cell.effectId >= 1024)
      /* Another unit's frames are not this unit's preset. */
      assert.equal(g.parseGridDump(frames, model === 0x11 ? 0x12 : 0x11), null)
      /* A chunk missing, the frames out of order, the head twice, no foot, nothing at all. */
      assert.equal(g.parseGridDump([frames[0], ...frames.slice(2)], model), null, 'a preset one chunk short was read')
      assert.equal(g.parseGridDump([frames[1], frames[0], ...frames.slice(2)], model), null)
      assert.equal(g.parseGridDump([frames[0], frames[0], ...frames.slice(1)], model), null)
      assert.equal(g.parseGridDump([...frames.slice(0, -1), frames[0], frames[frames.length - 1]], model), null, 'a second head among the chunks was let through')
      /* A frame of something else among the chunks (the unit's answer to another question, a frame damaged on the way): not a preset. */
      const junk = [0xf0, 0x00, 0x01, 0x74, model, 0x13, 0x00, 0xf7]
      junk[6] = junk.slice(0, 6).reduce((x, b) => x ^ b, 0) & 0x7f
      assert.equal(g.parseGridDump([frames[0], frames[1], junk, ...frames.slice(2)], model), null, 'a frame that is no part of a preset was let through among its chunks')
      assert.equal(g.parseGridDump([frames[0], frames[frames.length - 1]], model), null, 'a preset with no chunks was read')
      assert.equal(g.parseGridDump(frames.slice(0, -1), model), null)
      assert.equal(g.parseGridDump([], model), null)
      assert.equal(g.parseGridDump(null, model), null)
      /* One byte changed on the way with its frame's own checksum made good: only the CRC over the whole can tell, and it does. */
      for (const at of [20, 700, 2000]) {
        const hurt = frames.map((f) => [...f])
        hurt[2][at] ^= 0x01
        hurt[2][hurt[2].length - 2] = hurt[2].slice(0, -2).reduce((x, b) => x ^ b, 0) & 0x7f
        assert.equal(g.parseGridDump(hurt, model), null, `${name}: a preset damaged at byte ${at} was read`)
      }
      /* And one whose frame checksum is simply wrong is no part of a preset. */
      const wrong = [...frames[1]]
      wrong[wrong.length - 2] ^= 0x01
      assert.equal(g.gridDumpPart(wrong, model), null)
    }
  })

  test('the live read gives the same grid, block ids over 127 and all, and is null for anything it does not know the meaning of', async () => {
    const g = await import(GRID)
    const sx = await import(SX)
    for (const [name, [model, cells]] of Object.entries(GRIDS)) {
      const f = makeLive(model, cells)
      assert.equal(f.length, 755)
      assert.ok(f.length >= g.liveBytesNeeded(model), name)
      const live = g.parseGridLive(f, model)
      assert.ok(live, name)
      assert.equal(live.cells.length, cells.length)
      for (const c of cells) {
        const got = live.cells.find((x) => x.row === c.row && x.col === c.col)
        assert.ok(got, `${name}: nothing at row ${c.row}, column ${c.col}`)
        if (c.effectId >= 1024) assert.equal(got.shunt, c.effectId - 1024)
        else assert.equal(got.effectId, c.effectId, `${name}: block ${c.effectId} read as ${got.effectId}`)
      }
      /* Not the request (the phone hearing itself), another unit's answer, a short one, one with a bad checksum, a knob's answer. */
      assert.equal(g.parseGridLive(g.buildGridRead(model), model), null)
      assert.equal(g.parseGridLive(f, model === 0x11 ? 0x12 : 0x11), null)
      assert.equal(g.parseGridLive(f.slice(0, 400).concat([0, 0xf7]), model), null)
      const bad = [...f]
      bad[bad.length - 2] ^= 0x01
      assert.equal(g.parseGridLive(bad, model), null)
      assert.equal(g.parseGridLive(sx.frame(model, 0x01, [0x52, 0x00, ...new Array(745).fill(0)]), model), null)
    }
    /* A six-row grid needs every byte of a 755-byte answer; an FM3's fits in fewer. */
    assert.deepEqual([g.liveBytesNeeded(0x11), g.liveBytesNeeded(0x12), g.liveBytesNeeded(0x10)], [590, 754, 754])
    /* A kind of cell nobody has seen, bits where none belong, the same block twice: not read at all, rather than read wrongly. */
    const model = 0x11
    const put = (frame, at, n, value) => {
      const out = [...frame]
      for (let i = 0; i < n; i++) {
        const b = at + i
        const where = 1 + Math.floor(b / 7)
        const mask = 1 << (6 - (b % 7))
        if ((value >> (n - 1 - i)) & 1) out[where] |= mask
        else out[where] &= ~mask
      }
      out[out.length - 2] = out.slice(0, -2).reduce((x, y) => x ^ y, 0) & 0x7f
      return out
    }
    const base = makeLive(model, GRIDS.bare3[1])
    const cellBit = (row, col) => g.LIVE_FIRST_BIT + (col * 4 + row) * 32
    assert.ok(g.parseGridLive(base, model))
    assert.equal(g.parseGridLive(put(base, cellBit(1, 0) + 16, 8, 0x20), model), null, 'a cell of an unknown kind was read')
    assert.equal(g.parseGridLive(put(base, cellBit(1, 0) + 12, 4, 0x1), model), null, 'bits in the unused four were ignored')
    assert.equal(g.parseGridLive(put(base, cellBit(2, 5) + 24, 8, 0x10), model), null, 'cables into an empty cell were read as a grid')
    assert.equal(g.parseGridLive(put(base, cellBit(2, 5), 12, 37), model), null, 'the same block in two cells was read as a grid')
  })

  test('the live read is believed only where the preset has borne it out, blocks AND cables, and never once it has disagreed', async () => {
    const g = await import(GRID)
    const both = (name, liveOpts, liveCells) => {
      const [model, cells] = GRIDS[name]
      return { model, cells, live: g.parseGridLive(makeLive(model, liveCells || cells, liveOpts), model), dump: g.parseGridDump(makeDump(model, cells), model) }
    }
    /* Nothing proven: nothing used. */
    const start = g.noProof()
    assert.deepEqual(start, { cells: null, shuntBase: null, rowBit: null })
    for (const name of Object.keys(GRIDS)) assert.equal(g.gridFromLive(both(name).live, start), null, `${name}: a live read was used with nothing proven`)

    /* A bare preset proves where blocks are and nothing about cables: still not used. */
    const bare = both('bare3')
    const afterBare = g.gridProof(start, bare.live, bare.dump)
    assert.deepEqual(afterBare.proof, { cells: true, shuntBase: null, rowBit: null })
    assert.equal(g.gridFromLive(bare.live, afterBare.proof), null, 'a live read was used before a cable had been read both ways')
    assert.match(afterBare.said, /agrees/)

    /* A chain with cables and shunts proves the rest, and then the live read is the same grid as the preset's. */
    for (const name of ['chain3', 'chain9']) {
      const t = both(name)
      const proved = g.gridProof(start, t.live, t.dump)
      assert.deepEqual(proved.proof, { cells: true, shuntBase: 1024, rowBit: t.model === 0x11 ? 4 : 2 }, name)
      assert.equal(sorted(g.gridFromLive(t.live, proved.proof).cells), sorted(t.cells), name)
      const back = g.gridFromLive(t.live, proved.proof)
      for (const c of back.cells) assert.equal(c.isShunt, c.effectId >= 1024)
      /* And a bare preset after that is read live too, with no cables and none invented. */
      const bareNow = both(t.model === 0x11 ? 'bare3' : 'bare9')
      assert.equal(sorted(g.gridFromLive(bareNow.live, proved.proof).cells), sorted(bareNow.cells))
    }

    /* Cables proven on a preset with no shunt: a later answer with a shunt in it is not guessed at. */
    const nam = both('nam3x')
    const noShuntYet = g.gridProof(start, nam.live, nam.dump).proof
    assert.deepEqual(noShuntYet, { cells: true, shuntBase: null, rowBit: 2 })
    assert.equal(sorted(g.gridFromLive(nam.live, noShuntYet).cells), sorted(nam.cells))
    const withShunt = both('chain9')
    assert.equal(g.gridFromLive(withShunt.live, noShuntYet), null, 'a shunt’s block id was guessed')
    const learned = g.gridProof(noShuntYet, withShunt.live, withShunt.dump).proof
    assert.equal(learned.shuntBase, 1024)
    assert.equal(sorted(g.gridFromLive(withShunt.live, learned).cells), sorted(withShunt.cells))

    /* A unit that lays its cable bits or numbers its shunts another way is read right all the same: the rule is taken from the unit, not assumed. */
    for (const [liveOpts, want] of [[{ rowBit: 0 }, { rowBit: 0, shuntBase: 1024 }], [{ rowBit: 3, shuntBase: 1023 }, { rowBit: 3, shuntBase: 1023 }]]) {
      const t = both('chain3', liveOpts)
      const proved = g.gridProof(start, t.live, t.dump).proof
      assert.deepEqual(proved, { cells: true, ...want })
      assert.equal(sorted(g.gridFromLive(t.live, proved).cells), sorted(t.cells))
    }

    /* ONE BLOCK IN ANOTHER CELL, or another block in the cell, and the live read is not used again, whatever comes after. */
    const shifted = GRIDS.chain3[1].map((c) => (c.effectId === 58 ? { ...c, row: 0 } : c))
    const renamed = GRIDS.chain3[1].map((c) => (c.effectId === 58 ? { ...c, effectId: 59 } : c))
    const fewer = GRIDS.chain3[1].filter((c) => c.effectId !== 62)
    const more = [...GRIDS.chain3[1], { row: 3, col: 5, effectId: 70, fromRows: [] }]
    for (const [what, liveCells] of [['moved', shifted], ['renamed', renamed], ['missing', fewer], ['extra', more]]) {
      const t = both('chain3', {}, liveCells)
      const out = g.gridProof(start, t.live, t.dump)
      assert.equal(out.proof.cells, false, what)
      assert.match(out.said, /DISAGREES with the preset at row \d+, column \d+/, what)
      assert.equal(g.gridFromLive(t.live, out.proof), null, what)
      /* Even a later answer that agrees does not bring it back, and a proof already good is lost by one disagreement. */
      const good = both('chain3')
      const again = g.gridProof(out.proof, good.live, good.dump)
      assert.equal(again.proof.cells, false, `${what}: believed again`)
      assert.equal(g.gridFromLive(good.live, again.proof), null)
      const wasGood = g.gridProof(start, good.live, good.dump).proof
      assert.equal(g.gridProof(wasGood, t.live, t.dump).proof.cells, false, `${what}: a proven read kept its proof past a disagreement`)
    }

    /* Cables that do not come out as the preset's (the byte somewhere this app is not looking): never used, though every block agrees. */
    const noMasks = GRIDS.chain3[1].map((c) => ({ ...c, fromRows: [] }))
    const blind = both('chain3', {}, noMasks)
    const out = g.gridProof(start, blind.live, blind.dump)
    assert.equal(out.proof.rowBit, false)
    assert.equal(out.proof.cells, true)
    assert.equal(g.gridFromLive(blind.live, out.proof), null, 'a live read with unreadable cables was used')
    assert.match(out.said, /CABLES DO NOT COME OUT/)
    const wrongRows = GRIDS.chain3[1].map((c) => (c.fromRows.length ? { ...c, fromRows: [0] } : c))
    assert.equal(g.gridProof(start, both('chain3', {}, wrongRows).live, blind.dump).proof.rowBit, false)
    /* Shunts numbered with no one rule: an answer with a shunt in it is read from the preset, the rest live. */
    const odd = both('chain3', {}, GRIDS.chain3[1].map((c) => (c.effectId === 1025 ? { ...c, effectId: 1030 } : c)))
    const oddProof = g.gridProof(start, odd.live, odd.dump).proof
    assert.equal(oddProof.shuntBase, false)
    assert.equal(g.gridFromLive(odd.live, oddProof), null)
    assert.ok(g.gridFromLive(both('bare3').live, oddProof), 'a preset with no shunt in it was not read live')

    /* One block is too little to prove where blocks are. */
    const one = [{ row: 1, col: 0, effectId: 37, fromRows: [] }]
    const lone = g.gridProof(start, g.parseGridLive(makeLive(0x11, one), 0x11), g.parseGridDump(makeDump(0x11, one), 0x11))
    assert.equal(lone.proof.cells, null)
    /* No live answer, or no preset: nothing learned and nothing lost. */
    assert.deepEqual(g.gridProof(learned, null, withShunt.dump).proof, learned)
    assert.deepEqual(g.gridProof(learned, withShunt.live, null).proof, learned)
    /* A cable bit outside the rows the proof gives is an answer not to be used. */
    const proof3 = g.gridProof(start, both('chain3').live, both('chain3').dump).proof
    const stray = g.parseGridLive(makeLive(0x11, GRIDS.chain3[1], { rowBit: 0 }), 0x11)
    assert.equal(g.gridFromLive(stray, proof3), null)
  })

  test('the frames in hand are let go of when their job ends, however it ends', async () => {
    const g = await import(GRID)
    const hand = g.gridHand()
    assert.equal(hand.now(), null)
    const frames = [g.buildGridSelect(0x11, 2, 3), g.buildGridPut(0x11, 2, 3, 58)]
    let seen = null
    assert.equal(await hand.during(frames, async () => ((seen = hand.now()), 'done')), 'done')
    assert.equal(seen, frames, 'the frames were not in hand while the job ran')
    assert.equal(hand.now(), null, 'a finished job left its frames in hand')
    await assert.rejects(hand.during(frames, async () => {
      throw new Error('stopped part-way')
    }), /stopped part-way/)
    assert.equal(hand.now(), null, 'a job that stopped part-way left its frames allowed out')
    await assert.rejects(hand.during(frames, () => {
      throw new Error('threw at once')
    }), /threw at once/)
    assert.equal(hand.now(), null)
    /* Two hands are two hands: one wire's job is never another's. */
    const other = g.gridHand()
    await hand.during(frames, async () => assert.equal(other.now(), null))
    /* And the wire holds every grid job through it, and asks it at each send. */
    const wire = src('mobile/src/lib/bleWire.js').replace(/\s+/g, ' ')
    assert.match(wire, /const chainHand = gridHand\(\)/)
    assert.match(wire, /const withFrames = \(frames, run\) => chainHand\.during\(frames, run\)/)
    assert.equal((wire.match(/chainHand\.now\(\)/g) || []).length, 2, 'both ways out ask what is in hand, and nothing else does')
    assert.equal((wire.match(/\(\) => \(chainOn\(\) \? chainHand\.now\(\) : null\)/g) || []).length, 2, 'a way out is handed the frames without asking whether the chain is open')
    assert.ok(!/\bchaining\b/.test(wire))
    assert.equal((wire.match(/withFrames\(/g) || []).length, 4, 'a grid job sends outside the hand: the live read, a block placed, a cable and an AM4’s slot each go through it once')
  })

  test('the chain over Bluetooth is one switch, open to every account since 2.0.0, and the wire is told at every request', () => {
    const flat = (p) => src(p).replace(/\s+/g, ' ')
    assert.match(flat('mobile/src/lib/features.js'), /export const CHAIN_OVER_BLUETOOTH_FOR_EVERYONE = true/)
    const ble = flat('mobile/src/lib/bluetooth.js')
    assert.match(ble, /export const chainOverBluetooth = \(\) => allUnits === true \|\| CHAIN_OVER_BLUETOOTH_FOR_EVERYONE/)
    assert.match(ble, /chain: \(\) => chainOverBluetooth\(\), \/\*[^*]*\*\/ live: \(\) => liveKnobsOverBluetooth\(\), \/\*/)
    const wire = flat('mobile/src/lib/bleWire.js')
    assert.match(wire, /const chainOn = \(\) => editOn\(\) && typeof chain === 'function' && chain\(\) === true/)
    /* The page does not ask the chain's switch itself: its words follow saving (lib/editWords), which opens with the chain (test/bluetooth.mjs holds the two equal). */
    assert.ok(!/CHAIN_OVER_BLUETOOTH/.test(src('mobile/src/screens/Bluetooth.js')))
  })

  test('the frames walked are every one: the ids and codes the digests cover', () => {
    for (const unit of Object.values(GRID_UNITS)) {
      const ids = idsFor(unit)
      assert.ok(ids.includes(0) && ids.includes(127) && ids.includes(128) && ids.includes(206) && ids.includes(1024) && ids.includes(16383))
      assert.equal(Math.max(...ids.filter((x) => x < 16383)), 1024 + unit.rows * unit.cols - 1)
    }
    assert.equal(AM4_CODES.length, 18)
  })
}
