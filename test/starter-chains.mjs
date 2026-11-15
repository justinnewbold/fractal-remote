/**
 * QUICK BUILD AND STARTER CHAINS (shared/starter-chains.mjs; the phone's
 * components/QuickBuild and components/StarterChains).
 *
 * "Let's also look into building out a way to build a preset quickly from an
 * empty preset." and "The four screens are good. I need everything with the
 * chain builder to work over Bluetooth also" (Justin, 15 November 2026).
 *
 * What these hold: the kept chains and their caps, a chain against a unit's
 * own list, the plan (every place before any cable, never a cable out of the
 * last column, the exact way back), what a read afterwards says, the words,
 * and that the screens reach the unit through five calls of lib/device
 * only, behind the account's door and the unit's own `gridEdit`, asking
 * nothing about the wire.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const lib = () => import('../shared/starter-chains.mjs')

/** A Map-backed storage, as the phone's `sync` behaves. */
function store(seed = {}) {
  const m = new Map(Object.entries(seed))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    raw: m
  }
}

/* An FM3's list as the computer gives it: one Amp, one Cab, one Reverb, two Drives and two Delays, and its ends. */
const FM3 = [
  { slug: 'input', family: 'input', instance: 1, name: 'Input 1', page: 37 },
  { slug: 'output', family: 'output', instance: 1, name: 'Output 1', page: 42 },
  { slug: 'comp', family: 'comp', instance: 1, name: 'Compressor 1', page: 46 },
  { slug: 'drive', family: 'drive', instance: 1, name: 'Drive 1', page: 118 },
  { slug: 'drive', family: 'drive', instance: 2, name: 'Drive 2', page: 119 },
  { slug: 'amp', family: 'amp', instance: 1, name: 'Amp', page: 58 },
  { slug: 'cab', family: 'cab', instance: 1, name: 'Cab', page: 62 },
  { slug: 'delay', family: 'delay', instance: 2, name: 'Delay 2', page: 71 },
  { slug: 'delay', family: 'delay', instance: 1, name: 'Delay 1', page: 70 },
  { slug: 'reverb', family: 'reverb', instance: 1, name: 'Reverb', page: 66 },
  { slug: 'geq', family: 'geq', instance: 1, name: 'Graphic EQ 1', page: 98 },
  { slug: 'synth', family: 'synth', instance: 1, name: 'Synth 1', page: 110 }
]
/* An Axe-Fx III's: two of most, and the NAM the phone adds. */
const III = [
  ...FM3.filter((e) => !['amp', 'reverb'].includes(e.family)),
  { slug: 'amp', family: 'amp', instance: 1, name: 'Amp 1', page: 58 },
  { slug: 'amp', family: 'amp', instance: 2, name: 'Amp 2', page: 59 },
  { slug: 'reverb', family: 'reverb', instance: 1, name: 'Reverb 1', page: 66 },
  { slug: 'reverb', family: 'reverb', instance: 2, name: 'Reverb 2', page: 67 },
  { slug: 'nam', family: 'nam', name: 'NAM 1', page: 206 },
  { slug: 'nam', family: 'nam', name: 'NAM 2', page: 207 }
]
/* An AM4's: its own spelling of the compressor, no ends, no cab. */
const AM4 = [
  { slug: 'amp', family: 'amp', instance: 1, name: 'Amp', page: 0x3a },
  { slug: 'compressor', family: 'compressor', instance: 1, name: 'Compressor', page: 0x2e },
  { slug: 'drive', family: 'drive', instance: 1, name: 'Drive', page: 0x76 },
  { slug: 'delay', family: 'delay', instance: 1, name: 'Delay', page: 0x46 },
  { slug: 'reverb', family: 'reverb', instance: 1, name: 'Reverb', page: 0x42 }
]

const FM3_SHAPE = { linear: false, rows: 4, cols: 12 }
const SIX = { linear: false, rows: 6, cols: 14 }
const AM4_SHAPE = { linear: true, rows: 1, cols: 4 }

const cell = (row, col, effectId, name, extra = {}) => ({ row, col, effectId, name, isShunt: false, fromRows: [], ...extra })
const ends = (row = 1, outCol = 11) => [cell(row, 0, 37, 'Input 1'), cell(row, outCol, 42, 'Output 1', { fromRows: [] })]
const chainOf = (cells) => cells.filter((c) => !c.isShunt).map((c) => ({ slug: c.effectId === 37 ? 'input' : c.effectId === 42 ? 'output' : 'x', name: c.name, effectId: c.effectId, row: c.row, col: c.col }))
const cables = (plan) => plan.steps.filter((s) => s.kind === 'cable').map((s) => [s.srcRow, s.srcCol, s.destRow, s.connect])
const kinds = (steps) => steps.map((s) => s.kind).join(' ')

export function run(test) {
  /* ------------------------------------------------------------ storage */

  test('starter chains: the built-in Classic rig comes first and cannot be changed or taken out', async () => {
    const s = await lib()
    const st = store()
    const list = s.starterList(st, 'fm3')
    assert.equal(list.length, 1)
    assert.deepEqual(list[0], { id: 'classic', name: 'Classic rig', blocks: ['drive', 'amp', 'cab', 'delay', 'reverb'], builtIn: true, isDefault: true })
    assert.equal(s.renameStarter(st, 'fm3', 'classic', 'Mine').ok, false)
    assert.equal(s.replaceStarterBlocks(st, 'fm3', 'classic', ['amp']).ok, false)
    assert.equal(s.removeStarter(st, 'fm3', 'classic'), false)
    assert.equal(s.starterList(st, 'fm3')[0].name, 'Classic rig')
  })

  test('starter chains: kept per unit, added, renamed, given new blocks and removed', async () => {
    const s = await lib()
    const st = store()
    const a = s.addStarter(st, 'axefxiii', { name: '  My   NAM\nrig ', blocks: ['compressor', 'nam', 'irplayer', 'delay', 'reverb', 'input'] })
    assert.equal(a.ok, true)
    assert.equal(a.chain.name, 'My NAM rig', 'one line, single spaces, trimmed')
    assert.deepEqual(a.chain.blocks, ['comp', 'nam', 'irplayer', 'delay', 'reverb'], 'one spelling, and never an end')
    assert.equal(s.starterList(st, 'fm3').length, 1, 'another unit’s drawer is its own')
    assert.equal(s.starterList(st, 'axefxiii').length, 2)
    assert.equal(s.renameStarter(st, 'axefxiii', a.chain.id, 'Clean ambient').ok, true)
    assert.equal(s.replaceStarterBlocks(st, 'axefxiii', a.chain.id, ['comp', 'amp', 'delay', 'delay']).ok, true)
    const kept = s.starterList(st, 'axefxiii')[1]
    assert.deepEqual([kept.name, kept.blocks], ['Clean ambient', ['comp', 'amp', 'delay', 'delay']])
    assert.equal(s.removeStarter(st, 'axefxiii', a.chain.id), true)
    assert.equal(s.starterList(st, 'axefxiii').length, 1)
  })

  test('starter chains: the caps (12 kept, a name of 1 to 24 characters, 12 blocks)', async () => {
    const s = await lib()
    const st = store()
    assert.equal(s.addStarter(st, 'fm3', { name: '   ', blocks: ['amp'] }).ok, false, 'a name of nothing')
    assert.equal(s.addStarter(st, 'fm3', { name: 'No blocks', blocks: [] }).ok, false, 'a chain of nothing')
    const long = s.addStarter(st, 'fm3', { name: 'x'.repeat(40), blocks: Array(20).fill('delay') })
    assert.equal(long.chain.name.length, 24)
    assert.equal(long.chain.blocks.length, 12)
    for (let i = 1; i < 12; i++) assert.equal(s.addStarter(st, 'fm3', { name: `Chain ${i}`, blocks: ['amp'] }).ok, true)
    assert.equal(s.roomForStarter(st, 'fm3'), false)
    const thirteenth = s.addStarter(st, 'fm3', { name: 'One more', blocks: ['amp'] })
    assert.deepEqual(thirteenth, { ok: false, why: s.STARTERS_FULL })
    assert.equal(s.starterList(st, 'fm3').length, 13, 'twelve kept and the built-in')
  })

  test('starter chains: junk in storage is read as nothing, never a throw', async () => {
    const s = await lib()
    for (const junk of ['not json', '[]', '12', 'null', JSON.stringify({ fm3: 'x' }), JSON.stringify({ fm3: { chains: 'x', default: 5 } }), JSON.stringify({ fm3: { chains: [null, { id: 'c1' }, { id: 'c2', name: 'Ok', blocks: 'amp' }, { id: 'zz', name: 'Bad id', blocks: ['amp'] }, { id: 'c3', name: 'Good', blocks: ['amp', 7, 'output'] }, { id: 'c3', name: 'Twice', blocks: ['amp'] }], default: 'c99', order: [1, 'c3', 'c3'] } })]) {
      const st = store({ [s.STARTERS_KEY]: junk })
      const list = s.starterList(st, 'fm3')
      assert.equal(list[0].id, 'classic', junk)
      assert.ok(list.every((c) => c.name && c.blocks.length), junk)
    }
    const st = store({ [s.STARTERS_KEY]: JSON.stringify({ fm3: { chains: [{ id: 'c3', name: 'Good', blocks: ['amp', 7, 'output'] }, { id: 'c3', name: 'Twice', blocks: ['amp'] }] } }) })
    assert.deepEqual(s.starterList(st, 'fm3').map((c) => [c.id, c.blocks]), [['classic', ['drive', 'amp', 'cab', 'delay', 'reverb']], ['c3', ['amp']]])
    const throws = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') } }
    assert.equal(s.starterList(throws, 'fm3').length, 1)
    assert.equal(s.addStarter(throws, 'fm3', { name: 'x', blocks: ['amp'] }).ok, true, 'a storage that refuses costs the next launch, not this press')
  })

  test('starter chains: the default is always first, and the built-in can stop being it', async () => {
    const s = await lib()
    const st = store()
    const a = s.addStarter(st, 'fm3', { name: 'A', blocks: ['amp'] }).chain
    const b = s.addStarter(st, 'fm3', { name: 'B', blocks: ['amp'] }).chain
    assert.deepEqual(s.starterList(st, 'fm3').map((c) => c.id), ['classic', a.id, b.id])
    assert.equal(s.setDefaultStarter(st, 'fm3', b.id), true)
    assert.deepEqual(s.starterList(st, 'fm3').map((c) => [c.id, c.isDefault]), [[b.id, true], ['classic', false], [a.id, false]])
    s.removeStarter(st, 'fm3', b.id)
    assert.equal(s.starterList(st, 'fm3')[0].id, 'classic', 'a default taken out hands it back to the built-in')
    assert.equal(s.setDefaultStarter(st, 'fm3', 'c99'), false)
  })

  test('starter chains: a move is a swap with the neighbour under the default, and out of range changes nothing', async () => {
    const s = await lib()
    assert.deepEqual(s.starterMoved(['classic', 'c1', 'c2', 'c3'], 'classic', 'c2', -1), ['classic', 'c2', 'c1', 'c3'])
    assert.deepEqual(s.starterMoved(['classic', 'c1', 'c2', 'c3'], 'classic', 'c1', -1), ['classic', 'c1', 'c2', 'c3'])
    assert.deepEqual(s.starterMoved(['classic', 'c1', 'c2', 'c3'], 'classic', 'c3', 1), ['classic', 'c1', 'c2', 'c3'])
    assert.deepEqual(s.starterMoved(['classic', 'c1', 'c2', 'c3'], 'c2', 'c1', 1), ['classic', 'c3', 'c2', 'c1'], 'the default is passed over')
    const st = store()
    const a = s.addStarter(st, 'fm3', { name: 'A', blocks: ['amp'] }).chain
    s.addStarter(st, 'fm3', { name: 'B', blocks: ['amp'] })
    assert.equal(s.moveStarter(st, 'fm3', a.id, 1), true)
    assert.deepEqual(s.starterList(st, 'fm3').map((c) => c.name), ['Classic rig', 'B', 'A'])
    assert.equal(s.moveStarter(st, 'fm3', a.id, 1), false)
  })

  test('starter chains: the unit’s list is kept for a picker with no unit, names and families only', async () => {
    const s = await lib()
    const st = store()
    assert.equal(s.paletteKept(st, 'fm3'), null)
    s.keepPalette(st, 'fm3', FM3)
    const kept = s.paletteKept(st, 'fm3')
    assert.equal(kept.length, FM3.length)
    assert.ok(kept.every((e) => e.page === undefined), 'no effect ids: building always reads the unit')
    assert.ok(s.builtInPalette().some((e) => e.family === 'nam'))
    assert.ok(!s.builtInPalette().some((e) => ['input', 'output'].includes(e.family)))
  })

  /* ------------------------------------------------------------ resolving */

  test('resolving a chain: the nth mention takes the nth of the family by instance; what the unit lacks is named, never dropped', async () => {
    const s = await lib()
    const r = s.resolveChain(['drive', 'amp', 'cab', 'delay', 'delay', 'reverb', 'reverb', 'nam', 'compressor'], FM3)
    assert.deepEqual(r.picks.map((p) => p.page), [118, 58, 62, 70, 71, 66, 46], 'Delay 1 then Delay 2, by instance not by list order')
    assert.deepEqual(r.missing, [
      { family: 'reverb', nth: 2, name: 'Reverb 2' },
      { family: 'nam', nth: 1, name: 'NAM' }
    ])
    const iii = s.resolveChain(['nam', 'nam', 'amp', 'amp', 'reverb', 'reverb', 'nam'], III)
    assert.deepEqual(iii.picks.map((p) => p.page), [206, 207, 58, 59, 66, 67])
    assert.deepEqual(iii.missing.map((m) => m.name), ['NAM 3'])
    assert.deepEqual(s.resolveChain(['comp'], AM4).picks.map((p) => p.page), [0x2e], 'an AM4’s compressor is the same family')
  })

  test('the picker: tap a chip to add it, again to take it out; Delay 2 appears once Delay is picked and the unit has two', async () => {
    const s = await lib()
    let picks = []
    let chips = s.chipsFor(FM3, picks)
    assert.ok(!chips.some((c) => ['input', 'output'].includes(c.family)), 'never the ends')
    assert.deepEqual(chips.filter((c) => c.common).map((c) => c.label), ['Compressor', 'Drive', 'Amp', 'Cab', 'Delay', 'Reverb', 'Graphic EQ'])
    assert.deepEqual(chips.filter((c) => !c.common).map((c) => c.label), ['Synth'])
    assert.ok(!chips.some((c) => c.label === 'Delay 2'))
    picks = s.pickToggled(picks, 'delay', 1)
    picks = s.pickToggled(picks, 'amp', 1)
    chips = s.chipsFor(FM3, picks)
    const delay = chips.findIndex((c) => c.label === 'Delay')
    assert.equal(chips[delay + 1].label, 'Delay 2', 'right after it')
    assert.equal(chips[delay].place, 1)
    picks = s.pickToggled(picks, 'delay', 2)
    assert.deepEqual(picks, ['delay', 'amp', 'delay'])
    assert.ok(!s.chipsFor(FM3, picks).some((c) => c.label === 'Delay 3'), 'an FM3 has two')
    assert.deepEqual(s.pickToggled(picks, 'delay', 1), ['amp', 'delay'], 'taking the first out makes the second the first')
    assert.deepEqual(s.pickToggled(['amp', 'cab'], 'reverb', 1, 2), ['amp', 'cab'], 'past the room, nothing is added')
  })

  /* ------------------------------------------------------------ the plan */

  test('Quick build plans an FM3’s bare row: every place first, then a cable out of each column up to the one before the Output', async () => {
    const s = await lib()
    const cells = ends()
    const { picks } = s.resolveChain(['drive', 'amp', 'cab', 'delay', 'reverb'], FM3)
    const plan = s.planBuild({ cells, shape: FM3_SHAPE, palette: FM3, picks, blocks: chainOf(cells) })
    assert.equal(plan.ok, true)
    assert.equal(plan.row, 1)
    assert.equal(kinds(plan.steps), 'place place place place place cable cable cable cable cable cable cable cable cable cable cable')
    assert.deepEqual(plan.steps.filter((x) => x.kind === 'place').map((x) => [x.row, x.col, x.blockId]), [[1, 1, 118], [1, 2, 58], [1, 3, 62], [1, 4, 70], [1, 5, 66]])
    assert.deepEqual(cables(plan), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => [1, c, 1, true]), 'from the Input’s column to the one before the Output’s, never out of the last')
    assert.equal(plan.joined, true)
    assert.deepEqual(plan.left, [])
  })

  test('Quick build skips a cable the grid read shows already there, into a cell it leaves alone', async () => {
    const s = await lib()
    const cells = [cell(1, 0, 37, 'Input 1'), cell(1, 11, 42, 'Output 1', { fromRows: [1] })]
    const { picks } = s.resolveChain(['amp'], FM3)
    const plan = s.planBuild({ cells, shape: FM3_SHAPE, palette: FM3, picks, blocks: chainOf(cells) })
    assert.deepEqual(cables(plan).map((c) => c[1]), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'the Output already hears the row')
  })

  test('Quick build on a grid with nothing in it: the Input at column 0, the picks after it, the Output after the last', async () => {
    const s = await lib()
    const { picks } = s.resolveChain(['amp', 'cab'], FM3)
    const plan = s.planBuild({ cells: [], shape: FM3_SHAPE, palette: FM3, picks, blocks: [] })
    assert.equal(plan.row, 1, 'the second row, where factory presets keep theirs')
    assert.deepEqual(plan.steps.filter((x) => x.kind === 'place').map((x) => [x.col, x.blockId]), [[0, 37], [1, 58], [2, 62], [3, 42]])
    assert.deepEqual(cables(plan), [[1, 0, 1, true], [1, 1, 1, true], [1, 2, 1, true]])
    assert.equal(plan.joined, true)
  })

  test('Quick build over a row of bare wires: a shunt’s cell is free, and the way back puts the shunt back', async () => {
    const s = await lib()
    const cells = [...ends(), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => ({ row: 1, col: c, effectId: 1024 + c, name: 'Shunt', isShunt: true, fromRows: [1] }))]
    cells[1].fromRows = [1]
    const { picks } = s.resolveChain(['amp', 'cab'], FM3)
    const plan = s.planBuild({ cells, shape: FM3_SHAPE, palette: FM3, picks, blocks: chainOf(cells) })
    assert.equal(plan.ok, true)
    assert.deepEqual(plan.steps.filter((x) => x.kind === 'place').map((x) => x.col), [1, 2])
    assert.deepEqual(cables(plan).map((c) => c[1]), [0, 1], 'into the two cells it places; the wires after them and the Output already hear the row')
    /*
     * THE WAY BACK IS TO THE PRESET AS IT WAS, AND THAT PRESET WAS JOINED.
     * The whole list, not its tail: no cable is cut (the two the build sent
     * were the preset's own), each cell gets its bare wire back, and then the
     * preset's joins at those cells are made again, left to right, the one
     * out of the last cell included. An Undo that cut what the build sent
     * left this preset silent under "Took the 2 blocks back out".
     */
    assert.deepEqual(plan.prior, [
      { srcRow: 1, srcCol: 0, destRow: 1 },
      { srcRow: 1, srcCol: 1, destRow: 1 },
      { srcRow: 1, srcCol: 2, destRow: 1 }
    ])
    assert.deepEqual(plan.undo, [
      { kind: 'place', row: 1, col: 2, blockId: 1026, name: 'the bare wire' },
      { kind: 'place', row: 1, col: 1, blockId: 1025, name: 'the bare wire' },
      { kind: 'cable', srcRow: 1, srcCol: 0, destRow: 1, connect: true },
      { kind: 'cable', srcRow: 1, srcCol: 1, destRow: 1, connect: true },
      { kind: 'cable', srcRow: 1, srcCol: 2, destRow: 1, connect: true }
    ])
    assert.ok(!plan.undo.some((x) => x.kind === 'cable' && x.connect === false), 'the Undo cuts a cable the preset had before the build')
    /* Run against a unit that drops a cell's cables whenever the cell is written: the build then its Undo leave every join the preset had. */
    const feeds = new Map(cells.filter((c) => c.fromRows.length).map((c) => [`${c.row}:${c.col}`, new Set(c.fromRows)]))
    const before = JSON.stringify([...feeds].map(([k, v]) => [k, [...v]]).sort())
    const wire = {
      placeBlock: async (r, c) => (feeds.delete(`${r}:${c}`), { ok: true }),
      clearCell: async (r, c) => (feeds.delete(`${r}:${c}`), { ok: true }),
      setCable: async (r, c, d, on) => {
        const k = `${d}:${c + 1}`
        if (on) feeds.set(k, new Set([...(feeds.get(k) || []), r]))
        else feeds.get(k)?.delete(r)
        return { ok: true }
      }
    }
    const { runPlan } = await import('../shared/split-chain.mjs')
    await runPlan(plan.steps, wire)
    await runPlan(plan.undo, wire)
    assert.equal(JSON.stringify([...feeds].filter(([, v]) => v.size).map(([k, v]) => [k, [...v]]).sort()), before, 'the build and its Undo did not leave the preset wired as it was')
    /* What the read back after an Undo is asked: is the wiring back? */
    assert.equal(s.undoUnjoined(plan, cells), null)
    assert.equal(s.undoUnjoined(plan, cells.map((c) => (c.col === 2 ? { ...c, fromRows: [] } : c))), 2, 'a bare wire put back and not joined')
    assert.equal(s.undoUnjoined(plan, cells.filter((c) => c.col !== 1)), 1, 'a cell left empty')
    assert.equal(s.undoUnjoined(plan, cells.map((c) => (c.col === 3 ? { ...c, fromRows: [0] } : c))), 3, 'the cell after the last, no longer fed from this row')
    assert.equal(s.undoUnjoined(plan, cells.map((c) => (c.col === 7 ? { ...c, fromRows: [] } : c))), null, 'a cell the build never touched is not its business')
    assert.equal(s.undoUnjoined(plan, null), 1)
    assert.equal(s.undoNotJoinedLine(2), 'Took the blocks back out, but the row is not joined the way it was before: it stops at column 3. Nothing will sound until it is. Join it on the unit, or load the preset again if you have not saved it.')
    /* A run that stopped after the first place: only that cell, and only the joins at it. */
    assert.deepEqual(s.undoSteps(plan, 1), [
      { kind: 'place', row: 1, col: 1, blockId: 1025, name: 'the bare wire' },
      { kind: 'cable', srcRow: 1, srcCol: 0, destRow: 1, connect: true },
      { kind: 'cable', srcRow: 1, srcCol: 1, destRow: 1, connect: true }
    ])
    assert.equal(s.undoUnjoined(plan, cells.map((c) => (c.col === 3 ? { ...c, fromRows: [] } : c)), 1), null, 'a join at a cell the run never reached')
  })

  test('an Undo cuts only the cables the build added, and a join the app cannot make again is said, not skipped in silence', async () => {
    const s = await lib()
    /* The Input joined to one bare wire, and nothing after it: the build's cable out of the amp is new, the one into it is the preset's. */
    const half = [...ends(1, 4), { row: 1, col: 1, effectId: 1025, name: 'Shunt', isShunt: true, fromRows: [1] }]
    const plan = s.planBuild({ cells: half, shape: FM3_SHAPE, palette: FM3, picks: s.resolveChain(['amp', 'cab'], FM3).picks, blocks: chainOf(half) })
    assert.deepEqual(cables(plan).map((c) => c[1]), [0, 1, 2, 3])
    assert.deepEqual(plan.undo, [
      { kind: 'cable', srcRow: 1, srcCol: 3, destRow: 1, connect: false },
      { kind: 'cable', srcRow: 1, srcCol: 2, destRow: 1, connect: false },
      { kind: 'cable', srcRow: 1, srcCol: 1, destRow: 1, connect: false },
      { kind: 'clear', row: 1, col: 2, name: 'Cab' },
      { kind: 'place', row: 1, col: 1, blockId: 1025, name: 'the bare wire' },
      { kind: 'cable', srcRow: 1, srcCol: 0, destRow: 1, connect: true }
    ])
    /* A six-row grid, the chain on its second row, and a bare wire also fed from the TOP row: that cable is one the app cannot make, so it is left out of the Undo and the read back is what says it is missing. */
    const six = [cell(1, 0, 37, 'Input 1'), cell(1, 13, 42, 'Output 1'), { row: 1, col: 1, effectId: 1030, name: 'Shunt', isShunt: true, fromRows: [0, 1] }]
    const p6 = s.planBuild({ cells: six, shape: SIX, palette: III, picks: s.resolveChain(['amp'], III).picks, blocks: chainOf(six) })
    assert.equal(p6.rows, 6)
    assert.deepEqual(p6.prior, [{ srcRow: 0, srcCol: 0, destRow: 1 }, { srcRow: 1, srcCol: 0, destRow: 1 }])
    assert.deepEqual(p6.undo.filter((x) => x.kind === 'cable' && x.connect), [{ kind: 'cable', srcRow: 1, srcCol: 0, destRow: 1, connect: true }])
    assert.equal(s.undoUnjoined(p6, six), null)
    assert.equal(s.undoUnjoined(p6, six.map((c) => (c.col === 1 ? { ...c, fromRows: [1] } : c))), 1, 'the top row’s feed is gone and nothing said so')
    /* On four rows the top row is like any other. */
    const four = [cell(1, 0, 37, 'Input 1'), cell(1, 11, 42, 'Output 1'), { row: 1, col: 1, effectId: 1030, name: 'Shunt', isShunt: true, fromRows: [0, 1] }]
    const p4 = s.planBuild({ cells: four, shape: FM3_SHAPE, palette: FM3, picks: s.resolveChain(['amp'], FM3).picks, blocks: chainOf(four) })
    assert.deepEqual(p4.undo.filter((x) => x.kind === 'cable' && x.connect).map((x) => x.srcRow), [0, 1])
    /* An AM4 has no cables: nothing to keep, nothing to join again. */
    const am4 = s.planBuild({ cells: [], shape: AM4_SHAPE, palette: AM4, picks: s.resolveChain(['amp', 'delay'], AM4).picks, blocks: [] })
    assert.deepEqual(am4.prior, [])
    assert.equal(s.undoUnjoined(am4, []), null)
  })

  test('an Undo is not run over a block the build did not place, and counts what it takes out from what is known', async () => {
    const s = await lib()
    const cells = ends(1, 4)
    const plan = s.planBuild({ cells, shape: FM3_SHAPE, palette: FM3, picks: s.resolveChain(['amp', 'cab'], FM3).picks, blocks: chainOf(cells) })
    const built = [...cells, ...plan.placed.map((p) => cell(p.row, p.col, p.blockId, p.name))]
    assert.equal(s.undoStale(plan, built), false)
    assert.equal(s.undoStale(plan, cells), false, 'cells the unit never filled are the build’s own to clear')
    assert.equal(s.undoStale(plan, built.map((c) => (c.col === 2 ? { ...c, effectId: 1026, isShunt: true } : c))), false, 'a bare wire is not somebody’s block')
    assert.equal(s.undoStale(plan, built.map((c) => (c.col === 1 ? cell(1, 1, 46, 'Compressor 1') : c))), true, 'a block swapped in since would be taken out')
    assert.equal(s.undoStale(plan, built.map((c) => (c.col === 2 ? cell(1, 2, 46, 'Compressor 1') : c)), 1), false, 'a cell the run never reached')
    assert.equal(s.undoStale(plan, built.map((c) => (c.col === 3 ? cell(1, 3, 46, 'Compressor 1') : c))), false, 'a cell the build never placed into')
    assert.equal(s.undoStale(plan, null), false)
    assert.equal(s.sentBlocks(plan), 2)
    assert.equal(s.sentBlocks(plan, 1), 1)
    assert.equal(s.sentBlocks(plan, 0), 0)
    /* The ends the app places are not counted as picked blocks. */
    const bare = s.planBuild({ cells: [], shape: FM3_SHAPE, palette: FM3, picks: s.resolveChain(['amp'], FM3).picks, blocks: [] })
    assert.equal(bare.placed.length, 3)
    assert.equal(s.sentBlocks(bare), 1)
    /* And no "0 blocks" is ever said. */
    assert.equal(s.undoSub(0), 'Puts the preset back as it was')
    assert.equal(s.undoneLine(0), 'Put the preset back as it was.')
    assert.equal(s.undoSub(1), 'Takes the block back out')
    assert.equal(s.undoneLine(2), 'Took the 2 blocks back out.')
    const qb = code(read('mobile/src/components/QuickBuild.js')).replace(/\s+/g, ' ')
    assert.match(qb, /count: landed\.unread \? sentBlocks\(plan, res\.done\) : landed\.landed\.filter/)
    /* The Undo reads the chain first, refuses over a swapped block, and only then writes; its read back asks after the wiring too. */
    assert.match(qb, /now = await gridCells\(\)[\s\S]*undoStale\(d\.plan, now, d\.ran\)[\s\S]*UNDO_STALE[\s\S]*beginChainWrite\(\)[\s\S]*runPlan\(d\.undo/)
    assert.match(qb, /const unjoined = after === null \? null : undoUnjoined\(d\.plan, after, d\.ran\)/)
    assert.match(qb, /: unjoined !== null \? \{ bad: true, text: undoNotJoinedLine\(unjoined\) \} : \{ bad: false, text: undoneLine\(d\.count\) \}/)
  })

  test('a preset with nowhere to build says why, and a list of blocks that was not read is not a unit with no blocks', async () => {
    const s = await lib()
    const apart = [cell(0, 0, 37, 'Input 1'), cell(2, 11, 42, 'Output 1')]
    assert.equal(s.buildBlocked({ cells: apart, shape: FM3_SHAPE, palette: FM3, blocks: chainOf(apart) }), s.ENDS_APART)
    assert.equal(s.buildRoom({ cells: apart, shape: FM3_SHAPE, palette: FM3, blocks: chainOf(apart) }), 0)
    const tight = [cell(1, 0, 37, 'Input 1'), cell(1, 1, 42, 'Output 1')]
    assert.equal(s.buildBlocked({ cells: tight, shape: FM3_SHAPE, palette: FM3, blocks: chainOf(tight) }), s.NO_ROOM)
    assert.equal(s.buildBlocked({ cells: ends(), shape: FM3_SHAPE, palette: FM3, blocks: chainOf(ends()) }), null)
    assert.equal(s.buildBlocked({ cells: [], shape: AM4_SHAPE, palette: AM4, blocks: [] }), null)
    const qb = code(read('mobile/src/components/QuickBuild.js')).replace(/\s+/g, ' ')
    assert.match(qb, /const blocked = palette \? buildBlocked\(\{ cells: \[\], shape, palette, blocks: chain \}\) : null/)
    assert.match(qb, /disabled=\{palette === null \|\| !!blocked\} onPress=\{\(\) => openWith\(\[\]\)\}/)
    assert.match(qb, /disabled=\{palette === null \|\| !!blocked\} onPress=\{\(\) => openWith\(c\.blocks\)\}/)
    assert.match(qb, /\) : blocked \? \( <Note tone="warn">\{blocked\}<\/Note> \) : \( <ChainPicker/)
    assert.match(qb, /const start = palette && !blocked \? startFrom\(blocks \|\| \[\], palette, room\) : \{ picks: \[\], missing: \[\], left: \[\] \}/)
    /* A read that failed leaves the list unread, says so, and offers to ask again: never an empty list, which reads as "This unit has no Drive, Amp…". */
    assert.ok(!/setPalette\(\[\]\)/.test(qb), 'a failed read of the unit’s blocks is kept as an empty list')
    assert.match(qb, /catch \(err\) \{ logDebug\('chain', 'quick build: block list'[^}]*\) if \(!stop\) setListFailed\(true\) \}/)
    assert.match(qb, /if \(!wanted \|\| palette !== null \|\| listFailed\) return undefined/)
    assert.equal((qb.match(/<Note tone="warn">\{BLOCKS_NOT_READ\}<\/Note> <Press label=\{TRY_AGAIN\} onPress=\{\(\) => setListFailed\(false\)\} \/>/g) || []).length, 2, 'said on the page and in the sheet')
  })

  test('chains kept with no unit known go to the first unit that is, and a picked block the list lacks can still be tapped out', async () => {
    const s = await lib()
    const st = store()
    const a = s.addStarter(st, 'device', { name: 'Clean + Verb', blocks: ['amp', 'reverb'] })
    const b = s.addStarter(st, 'device', { name: 'Lead', blocks: ['drive', 'amp', 'delay'] })
    s.setDefaultStarter(st, 'device', b.chain.id)
    s.addStarter(st, 'fm3', { name: 'Already here', blocks: ['amp'] })
    assert.equal(s.adoptStarters(st, 'device', 'fm3'), 2)
    assert.deepEqual(s.starterList(st, 'fm3').map((c) => [c.name, c.isDefault]), [['Lead', true], ['Classic rig', false], ['Already here', false], ['Clean + Verb', false]])
    assert.deepEqual(s.starterList(st, 'fm3').find((c) => c.name === 'Lead').blocks, ['drive', 'amp', 'delay'])
    assert.equal(s.starterList(st, 'device').length, 1, 'nothing is left where no unit will look')
    assert.equal(s.adoptStarters(st, 'device', 'fm3'), 0, 'once')
    assert.equal(a.ok, true)
    /* A unit's own default is not taken from it, and what does not fit stays where it was. */
    const full = store()
    for (let i = 0; i < 11; i++) s.addStarter(full, 'am4', { name: `Mine ${i}`, blocks: ['amp'] })
    const mine = s.starterList(full, 'am4').find((c) => c.name === 'Mine 3')
    s.setDefaultStarter(full, 'am4', mine.id)
    const c1 = s.addStarter(full, 'device', { name: 'Couch 1', blocks: ['amp'] })
    s.addStarter(full, 'device', { name: 'Couch 2', blocks: ['amp'] })
    s.setDefaultStarter(full, 'device', c1.chain.id)
    assert.equal(s.adoptStarters(full, 'device', 'am4'), 1)
    assert.equal(s.starterList(full, 'am4').find((c) => c.isDefault).name, 'Mine 3')
    assert.equal(s.startersKept(full, 'am4'), 12)
    assert.deepEqual(s.starterList(full, 'device').map((c) => c.name), ['Classic rig', 'Couch 2'])
    for (const [from, to] of [['device', 'device'], ['', 'fm3'], ['device', ''], [null, 'fm3']]) assert.equal(s.adoptStarters(st, from, to), 0)
    const here = code(read('mobile/src/lib/starterChainsHere.js')).replace(/\s+/g, ' ')
    assert.match(here, /if \(isDemo\(\) \|\| !device \|\| device === DEFAULT_SLUG\) return 0 return adoptStarters\(sync, stageKey\(DEFAULT_SLUG, false\), stageKey\(device, false\)\)/)
    assert.match(here, /useEffect\(\(\) => \{ adoptUnlinkedHere\(slug\) \}, \[slug\]\)/)

    /* NAM written into a chain against the plain list, opened later against an AM4's own, which has none: it has a chip, with its place, to tap it out, and no second one to add. */
    const chips = s.chipsFor(AM4, ['nam', 'amp', 'nam'])
    assert.deepEqual(chips.filter((c) => c.family === 'nam').map((c) => [c.nth, c.place, c.label]), [[1, 1, 'NAM'], [2, 3, 'NAM 2']])
    assert.deepEqual(s.pickToggled(['nam', 'amp', 'nam'], 'nam', 1), ['amp', 'nam'])
    assert.equal(s.chipsFor(AM4, ['amp']).some((c) => c.family === 'nam'), false, 'a family the unit lacks is offered')
    assert.equal(s.chipsFor(AM4, ['input', 'amp']).some((c) => c.family === 'input'), false)
  })

  test('Quick build on a six-row grid with the Input on the top row: built there, no cables at all, and it says so', async () => {
    const s = await lib()
    const cells = ends(0, 13)
    const { picks } = s.resolveChain(['amp', 'cab', 'nam'], III)
    const plan = s.planBuild({ cells, shape: SIX, palette: III, picks, blocks: chainOf(cells) })
    assert.equal(plan.ok, true)
    assert.equal(plan.row, 0)
    assert.deepEqual(cables(plan), [])
    assert.equal(plan.joined, false)
    assert.equal(plan.joinNote, 'top')
    const said = s.whatLanded(plan, [...cells, cell(0, 1, 58, 'Amp 1'), cell(0, 2, 62, 'Cab'), cell(0, 3, 206, 'NAM 1')])
    assert.equal(said.title, s.BUILT_ONLY)
    assert.match(said.text, /does not lay cables on the top row/)
  })

  test('Quick build with more picks than cells: the extra ones are left out and named', async () => {
    const s = await lib()
    const cells = [cell(1, 0, 37, 'Input 1'), cell(1, 4, 42, 'Output 1')]
    const { picks } = s.resolveChain(['drive', 'amp', 'cab', 'delay', 'reverb'], FM3)
    const plan = s.planBuild({ cells, shape: FM3_SHAPE, palette: FM3, picks, blocks: chainOf(cells) })
    assert.deepEqual(plan.placed.map((p) => p.col), [1, 2, 3])
    assert.deepEqual(plan.left, ['Delay 1', 'Reverb'])
    assert.deepEqual(cables(plan).map((c) => c[1]), [0, 1, 2, 3])
    assert.equal(s.buildRoom({ cells, shape: FM3_SHAPE, palette: FM3, blocks: chainOf(cells) }), 3)
    assert.equal(s.buildRoom({ cells: [], shape: FM3_SHAPE, palette: FM3 }), 10, 'twelve cells, less the Input and the Output it places')
  })

  test('Quick build on an AM4: the four slots in order, no cables, and five picks leave the fifth out', async () => {
    const s = await lib()
    const { picks } = s.resolveChain(['comp', 'drive', 'amp', 'delay', 'reverb'], AM4)
    const plan = s.planBuild({ cells: [], shape: AM4_SHAPE, palette: AM4, picks, blocks: [] })
    assert.equal(plan.ok, true)
    assert.deepEqual(plan.steps.map((x) => [x.kind, x.row, x.col, x.blockId]), [
      ['place', 0, 0, 0x2e],
      ['place', 0, 1, 0x76],
      ['place', 0, 2, 0x3a],
      ['place', 0, 3, 0x46]
    ])
    assert.deepEqual(plan.left, ['Reverb'])
    assert.equal(plan.joinNote, 'linear')
    const said = s.whatLanded(plan, plan.placed.map((p) => cell(0, p.col, p.blockId, p.name)))
    assert.equal(said.text, '4 blocks in slots 1 to 4.')
    assert.equal(s.buildRoom({ cells: [], shape: AM4_SHAPE, palette: AM4 }), 4)
  })

  test('Quick build refuses a preset that is not bare, in plain words: a block newer than the app counts, a bare wire does not', async () => {
    const s = await lib()
    const { picks } = s.resolveChain(['amp'], FM3)
    const busy = [...ends(), cell(1, 3, 66, 'Reverb')]
    assert.deepEqual(s.planBuild({ cells: busy, shape: FM3_SHAPE, palette: FM3, picks, blocks: [...chainOf(ends()), { slug: 'reverb', name: 'Reverb', effectId: 66, row: 1, col: 3 }] }), { ok: false, why: s.NOT_BARE })
    const nam = [...ends(), cell(1, 3, 206, 'eid_206')]
    assert.equal(s.isBare(nam, chainOf(ends())), false, 'a NAM the computer cannot name is in the preset')
    const shunts = [...ends(), { row: 1, col: 3, effectId: 1027, name: 'Shunt', isShunt: true, fromRows: [1] }]
    assert.equal(s.isBare(shunts, chainOf(ends())), true)
    assert.equal(s.isBareChain([{ slug: 'input' }, { slug: 'output' }]), true)
    assert.equal(s.isBareChain([{ slug: 'input' }, { slug: '', unknown: true }]), false)
    assert.equal(s.isBareChain([]), true)
    assert.deepEqual(s.planBuild({ cells: ends(), shape: FM3_SHAPE, palette: FM3, picks: [], blocks: chainOf(ends()) }), { ok: false, why: s.NO_PICKS })
  })

  test('Quick build’s Undo is the exact inverse: the cables it connected cut right to left, then each cell it placed into, right to left', async () => {
    const s = await lib()
    const { picks } = s.resolveChain(['amp', 'cab'], FM3)
    const cells = ends(1, 4)
    const plan = s.planBuild({ cells, shape: FM3_SHAPE, palette: FM3, picks, blocks: chainOf(cells) })
    assert.deepEqual(plan.undo, [
      { kind: 'cable', srcRow: 1, srcCol: 3, destRow: 1, connect: false },
      { kind: 'cable', srcRow: 1, srcCol: 2, destRow: 1, connect: false },
      { kind: 'cable', srcRow: 1, srcCol: 1, destRow: 1, connect: false },
      { kind: 'cable', srcRow: 1, srcCol: 0, destRow: 1, connect: false },
      { kind: 'clear', row: 1, col: 2, name: 'Cab' },
      { kind: 'clear', row: 1, col: 1, name: 'Amp' }
    ])
    /* Run against a grid that follows each step: the build then its undo leave it as it was. */
    const grid = new Map(cells.map((c) => [`${c.row}:${c.col}`, c.effectId]))
    const joins = new Set()
    const wire = {
      placeBlock: async (r, c, id) => (id ? grid.set(`${r}:${c}`, id) : grid.delete(`${r}:${c}`), { ok: true }),
      clearCell: async (r, c) => (grid.delete(`${r}:${c}`), { ok: true }),
      setCable: async (r, c, d, on) => (on ? joins.add(`${r}:${c}>${d}`) : joins.delete(`${r}:${c}>${d}`), { ok: true })
    }
    const before = JSON.stringify([...grid].sort())
    const { runPlan } = await import('../shared/split-chain.mjs')
    assert.equal((await runPlan(plan.steps, wire)).ok, true)
    assert.equal(joins.size, 4)
    assert.equal((await runPlan(plan.undo, wire)).ok, true)
    assert.equal(JSON.stringify([...grid].sort()), before)
    assert.equal(joins.size, 0)
    /* A run that stopped after the first two places is taken back only that far. */
    assert.deepEqual(s.undoSteps(plan, 1), [{ kind: 'clear', row: 1, col: 1, name: 'Amp' }])
    assert.deepEqual(s.undoSteps(plan, 0), [])
  })

  test('what landed: all in, one missing (the CPU sentence), none', async () => {
    const s = await lib()
    const cells = ends()
    const { picks } = s.resolveChain(['comp', 'drive', 'cab', 'delay', 'reverb'], FM3)
    const plan = s.planBuild({ cells, shape: FM3_SHAPE, palette: FM3, picks, blocks: chainOf(cells) })
    /* The chain as a unit reads it back once the row is joined: each block fed from its own row, and a bare wire carrying it across every empty cell to the Output. */
    const joinedRow = () => {
      const out = [cell(1, 0, 37, 'Input 1')]
      plan.placed.forEach((p) => out.push(cell(p.row, p.col, p.blockId, p.name, { fromRows: [1] })))
      for (let c = plan.placed.length + 1; c < 11; c++) out.push(cell(1, c, 1024 + c, `Shunt ${c}`, { isShunt: true, fromRows: [1] }))
      out.push(cell(1, 11, 42, 'Output 1', { fromRows: [1] }))
      return out
    }
    assert.deepEqual(plan.span, { first: 0, last: 11 })
    const ok = s.whatLanded(plan, joinedRow())
    assert.deepEqual([ok.all, ok.joined, ok.tone, ok.title, ok.text], [true, true, 'ok', 'Built and connected', '5 blocks in row 2, joined from input to output.'])
    assert.equal(s.joinBreak(plan, joinedRow()), null)

    /*
     * "CONNECTED" IS SAID FROM THE UNIT'S OWN ANSWER, NEVER FROM WHAT WAS
     * SENT. Every block in its cell and the row not shown joined is a preset
     * with no sound: the blocks with no cables at all (stops at the first),
     * an empty cell the unit did not carry the wire across, a cell fed from
     * another row, the Output not reached, a read with no word on cables.
     */
    const all = plan.placed.map((p) => cell(p.row, p.col, p.blockId, p.name))
    const bare = s.whatLanded(plan, [...cells, ...all])
    assert.deepEqual([bare.all, bare.joined, bare.tone, bare.title], [true, false, 'warn', 'Built, but not joined all the way'])
    assert.equal(bare.text, '5 blocks in row 2, but the row is not joined from the input to the output: it stops at column 2. Nothing will sound until it is. Tap Undo to take them back out.')
    for (const [what, change, stops] of [
      ['a gap after the last block', (row) => row.filter((c) => c.col !== 6), 6],
      ['a block fed from another row', (row) => row.map((c) => (c.col === 3 ? { ...c, fromRows: [0] } : c)), 3],
      ['the Output not fed', (row) => row.map((c) => (c.col === 11 ? { ...c, fromRows: [] } : c)), 11],
      ['a cell with no word on its cables', (row) => row.map((c) => (c.col === 4 ? { ...c, fromRows: undefined } : c)), 4],
      ['a bare wire on the row below, not this one', (row) => row.map((c) => (c.col === 8 ? { ...c, row: 2 } : c)), 8]
    ]) {
      const got = s.whatLanded(plan, change(joinedRow()))
      assert.deepEqual([got.all, got.joined, got.tone, got.title, got.stops], [true, false, 'warn', s.NOT_JOINED_TITLE, stops], what)
      assert.equal(s.joinBreak(plan, change(joinedRow())), stops, what)
      assert.ok(!/connected/i.test(`${got.title} ${got.text}`), `${what}: said connected`)
    }

    /* One block the unit did not take: the others are "in", and "connected" only if the read shows the row joined past the empty cell. */
    const some = s.whatLanded(plan, joinedRow().filter((c) => c.effectId !== 66))
    assert.equal(some.tone, 'warn')
    assert.equal(some.text, 'Reverb was not added. The unit did not take it, which usually means the preset has no room left for it (CPU). The other 4 blocks are in. The row is not joined from the input to the output: it stops at column 6. Nothing will sound until it is.', 'an empty cell breaks the row, and the break was worked out and then not said')
    assert.deepEqual([some.joined, some.stops], [false, 5])
    const carried = s.whatLanded(plan, joinedRow().map((c) => (c.effectId === 66 ? cell(1, c.col, 1030, 'Shunt 7', { isShunt: true, fromRows: [1] }) : c)))
    assert.equal(carried.text, 'Reverb was not added. The unit did not take it, which usually means the preset has no room left for it (CPU). The other 4 blocks are in and connected.')
    assert.equal(carried.stops, null)
    const none = s.whatLanded(plan, cells)
    assert.deepEqual([none.none, none.title, none.joined], [true, s.NONE_ADDED_TITLE, false])
    /* A preset with no Input or Output, where the app places both: the ends in and none of the picked blocks is "nothing was added", never "the other 0 blocks are in"; and a missing end has its own words, never the CPU sentence. */
    const ownEnds = s.planBuild({ cells: [], shape: FM3_SHAPE, palette: FM3, picks: s.resolveChain(['amp', 'cab'], FM3).picks, blocks: [] })
    const endsIn = ownEnds.placed.filter((p) => p.end).map((p) => cell(p.row, p.col, p.blockId, p.name))
    const onlyEnds = s.whatLanded(ownEnds, endsIn)
    assert.deepEqual([onlyEnds.none, onlyEnds.title, onlyEnds.text], [true, s.NONE_ADDED_TITLE, s.NONE_ADDED])
    assert.equal(onlyEnds.landed.length, 2, 'the ends that landed are still known, for the Undo')
    const noOut = s.whatLanded(ownEnds, ownEnds.placed.filter((p) => p.family !== 'output').map((p) => cell(p.row, p.col, p.blockId, p.name, { fromRows: [1] })))
    assert.equal(noOut.title, 'Output 1 was not added')
    assert.equal(noOut.text, 'Output 1 was not added, so the row is not joined from the input to the output. Nothing will sound until it is. The 2 blocks are in.')
    assert.ok(!/CPU/.test(noOut.text))
    const both = s.whatLanded(ownEnds, ownEnds.placed.filter((p) => p.family !== 'output' && p.family !== 'cab').map((p) => cell(p.row, p.col, p.blockId, p.name)))
    assert.match(both.title, /^Cab(?: 1)? was not added$/)
    assert.match(both.text, /\(CPU\)\. The other block is in\. The row is not joined from the input to the output: it stops at column 2\. Nothing will sound until it is\. Output 1 was not added either\.$/)
    for (const w of [s.ENDS_APART, s.builtLine({ count: 2, row: 1, why: 'ends' })]) assert.ok(!/Edit chain/.test(w), `${w}: names a tool that is not there over Bluetooth`)
    assert.equal(s.NOTHING_SAVED_ON_UNIT, 'Nothing is saved until you save the preset on the unit itself.')
    const qbs = code(read('mobile/src/components/QuickBuild.js')).replace(/\s+/g, ' ')
    assert.equal((qbs.match(/\{saves \? NOTHING_SAVED : NOTHING_SAVED_ON_UNIT\}/g) || []).length, 2)
    assert.ok(!/\{NOTHING_SAVED\}/.test(qbs), 'the Save line is shown where the app has no Save')
    assert.match(code(read('mobile/src/screens/Edit.js')).replace(/\s+/g, ' '), /saves=\{!viaBle \|\| caps\?\.supportsSave === true\}/)
    assert.equal(s.whatLanded(plan, [...cells, all[0]], 1).all, true, 'a run that stopped asks only after what was sent')

    /* NO READ AT ALL is not "nothing landed": what is in the preset is not known, and is not guessed either way. */
    for (const nothing of [null, undefined]) {
      const unread = s.whatLanded(plan, nothing)
      assert.deepEqual([unread.unread, unread.all, unread.none, unread.tone, unread.title, unread.text], [true, false, false, 'warn', s.NOT_READ_TITLE, s.NOT_READ])
      assert.deepEqual([unread.landed, unread.missing], [[], []])
    }
    /* A plan with no join to check (an AM4's slots, the top row, no Input or Output) is never said to be broken. */
    const am4 = s.planBuild({ cells: [], shape: AM4_SHAPE, palette: AM4, picks: s.resolveChain(['amp', 'delay'], AM4).picks, blocks: [] })
    assert.equal(am4.span, null)
    assert.equal(s.joinBreak(am4, []), null)
    assert.equal(s.whatLanded(am4, am4.placed.map((p) => cell(0, p.col, p.blockId, p.name))).tone, 'ok')
  })

  test('the screen says what the unit read back, and nothing when it read nothing: a build, and its Undo', () => {
    const qb = code(read('mobile/src/components/QuickBuild.js')).replace(/\s+/g, ' ')
    /* Both reads start as "not read" and stay so when the unit does not answer. */
    assert.equal((qb.match(/let after = null try \{ after = await gridCells\(\) \} catch/g) || []).length, 2, 'a read that failed is taken for an empty chain')
    assert.ok(!/let after = \[\]/.test(qb))
    assert.match(qb, /const landed = whatLanded\(plan, after, res\.done\)/)
    assert.match(qb, /const still = after === null \? \[\] : stillIn\(d\.plan, after\)/)
    assert.match(qb, /: after === null \? \{ bad: true, text: UNDO_NOT_READ \} : still\.length/)
  })

  /* ------------------------------------------------------------ the words */

  test('Quick build’s words: plain, American, and none of the words the app never says', async () => {
    const s = await lib()
    const words = s.SHOWN_WORDS()
    assert.ok(words.length > 60)
    for (const w of words) {
      assert.equal(typeof w, 'string')
      assert.ok(w.trim().length, 'an empty line')
      assert.ok(!/this phone|\bbeta\b|\bsoon\b|coming|\btried\b|official|colour|grey|favourite/i.test(w), w)
    }
    assert.equal(s.QUICK_BUILD_HOW, 'Tap blocks in the order you want them. Tap one again to take it out.')
    assert.equal(s.NOTHING_SAVED, 'Nothing is saved on the unit until you tap Save.')
    assert.equal(s.buildLabel(1), 'Build this block')
    assert.equal(s.buildLabel(5), 'Build these 5 blocks')
    assert.equal(s.undoSub(5), 'Takes the 5 blocks back out')
    assert.equal(s.startersLine('Axe-Fx III'), 'Chains to start an empty preset from. Kept for your Axe-Fx III.')
    assert.equal(s.EMPTY_LINE, 'Nothing in this preset but input and output.')
    assert.equal(s.startersStatus([{}]), 'Classic rig')
    assert.equal(s.startersStatus([{}, {}, {}]), '3 chains')
  })

  /* ------------------------------------------------------------ the screens */

  test('the screens reach the unit through five calls of lib/device only, and never ask about the wire', () => {
    const files = ['mobile/src/components/QuickBuild.js', 'mobile/src/components/StarterChains.js', 'mobile/src/lib/quickBuild.js', 'mobile/src/lib/useQuickBuild.js', 'mobile/src/lib/starterChainsHere.js']
    const allowed = ['blockCatalog', 'clearCell', 'gridCells', 'placeBlock', 'setCable']
    for (const f of files) {
      const src = code(read(f))
      assert.ok(!/viaBle|overBluetooth|bluetoothWire|via\s*===|'bluetooth'/.test(src), `${f} asks which wire it is on`)
      const m = /import \{([^}]*)\} from '\.\.\/lib\/device'/.exec(src)
      if (m) {
        const names = m[1].split(',').map((x) => x.trim()).filter(Boolean)
        assert.deepEqual(names.filter((n) => !allowed.includes(n)), [], `${f} calls more of lib/device than the five`)
      }
      assert.ok(!/from '\.\/device'/.test(src), `${f} reaches lib/device another way`)
    }
    const qb = code(read('mobile/src/components/QuickBuild.js'))
    assert.match(qb, /import \{ blockCatalog, clearCell, gridCells, placeBlock, setCable \} from '\.\.\/lib\/device'/)
    assert.match(qb, /runPlan\(plan\.steps, wire\(plan, n, gone\)\)/, 'the build runs the plan through split-chain’s runPlan')
    assert.match(qb, /beginChainWrite\(\)[\s\S]*runPlan\(plan\.steps[\s\S]*endChainWrite\(\{ refresh: false \}\)[\s\S]*refreshBlocks\(\{ quiet: true \}\)[\s\S]*gridCells\(\)[\s\S]*whatLanded\(/, 'guarded, read back, then said')
    assert.match(qb, /ofNumber\(\) !== d\.n[\s\S]*UNDO_STALE/, 'an Undo on another preset is refused')
  })

  test('the door: the account’s switch, never a VP4, the unit’s own gridEdit, this preset’s chain; Edit, Play and Settings all ask it', async () => {
    const q = await import('../mobile/src/lib/quickBuild.js')
    const caps = { gridEdit: true }
    assert.equal(q.quickBuildHere({ on: true, caps }), true)
    assert.equal(q.quickBuildHere({ on: false, caps }), false)
    assert.equal(q.quickBuildHere({ on: true, vp4: true, caps }), false)
    assert.equal(q.quickBuildHere({ on: true, caps: { gridEdit: 'yes' } }), false, 'only a real yes')
    assert.equal(q.quickBuildHere({ on: true, caps: {} }), false)
    assert.equal(q.quickBuildHere({ on: true, caps, elsewhere: true }), false)
    assert.equal(q.quickBuildOn({ admin: true }), true)
    assert.equal(q.quickBuildOn({}), false)
    assert.equal(q.quickBuildOn({ everyone: true }), true)
    assert.match(read('mobile/src/lib/quickBuild.js'), /caps\?\.gridEdit === true/)
    assert.match(read('mobile/src/lib/features.js'), /^export const QUICK_BUILD_FOR_EVERYONE = false$/m, 'his account first')
    assert.match(read('mobile/src/lib/useQuickBuild.js'), /quickBuildOn\(\{ admin: useBluetoothAdmin\(\), everyone: QUICK_BUILD_FOR_EVERYONE \}\)/)
    const edit = code(read('mobile/src/screens/Edit.js'))
    assert.match(edit, /const quickBuildShown = quickBuildHere\(\{ on: quickOn, vp4: vp4Bench\(\), caps, elsewhere: chainNow\.elsewhere \}\)/)
    assert.match(edit, /\{quickBuildShown \? \(\s*<QuickBuild /)
    assert.equal((edit.match(/<QuickBuild /g) || []).length, 1)
    const stage = code(read('mobile/src/screens/Stage.js'))
    assert.match(stage, /quickBuildHere\(\{ on: quickOn, vp4: vp4Here\(\), caps, elsewhere: chainNow\.elsewhere \}\)/)
    assert.match(stage, /\{quickBuildOnPlay \? \(/)
    const settings = code(read('mobile/src/screens/Settings.js'))
    assert.match(settings, /\{startersOpen \? <SetupRow title=\{STARTERS_TITLE\}/)
    assert.match(settings, /\{page === 'starters' && startersOpen \? \(/)
    /* An ask from Play is taken once, and an old one never opens a sheet. */
    q.askQuickBuild(1000)
    assert.equal(q.takeQuickBuildAsk(2000), true)
    assert.equal(q.takeQuickBuildAsk(2001), false)
    q.askQuickBuild(1000)
    assert.equal(q.takeQuickBuildAsk(20000), false)
  })

  test('gridEdit reaches the phone through the computer, which leaves it out of the capabilities it serves', async () => {
    const { withGridEdit } = await import('../mobile/src/lib/chainShape.js')
    /* The computer's curated capabilities: gridRouting, slotModel, no gridEdit. */
    assert.equal(withGridEdit({ slotModel: 'grid', gridRouting: true }).gridEdit, true, 'an FM3, FM9 or Axe-Fx III')
    assert.equal(withGridEdit({ slotModel: 'linear', slotCount: 4, gridRouting: false }).gridEdit, true, 'an AM4')
    /* An Axe-Fx II: its driver places blocks and lays no cables, so a row built there could not be joined. A no, until the plan can build without cables on a grid. */
    assert.equal(withGridEdit({ slotModel: 'grid', gridRouting: false }).gridEdit, false, 'an Axe-Fx II')
    /* An Axe-Fx Standard or Ultra: linear, 48 slots, and no way to place a block at all. "Linear and not a VP4" is not an AM4. */
    assert.equal(withGridEdit({ slotModel: 'linear', slotCount: 48, gridRouting: false }).gridEdit, false, 'a gen-1 unit was offered Quick build, and every block it sent would be refused')
    assert.equal(withGridEdit({ slotModel: 'linear', gridRouting: false }).gridEdit, false, 'a linear unit that does not say four slots')
    assert.equal(withGridEdit({ slotModel: 'linear', gridRouting: false }, { vp4: true }).gridEdit, false, 'never a VP4')
    assert.equal(withGridEdit({ slotModel: 'grid' }, { demo: true }).gridEdit, true, 'the demo answers every route')
    assert.equal(withGridEdit({ slotModel: 'linear' }, { demo: true, vp4: true }).gridEdit, false, 'but not on its VP4')
    /* A wire that says for itself is believed; one that says nothing and is not the computer is left with nothing. */
    assert.equal(withGridEdit({ via: 'bluetooth', slotModel: 'grid', gridEdit: true }).gridEdit, true)
    assert.equal(withGridEdit({ via: 'bluetooth', slotModel: 'grid' }).gridEdit, undefined)
    assert.equal(withGridEdit({ via: 'bluetooth', slotModel: 'linear', gridEdit: false }).gridEdit, false)
    const device = read('mobile/src/lib/device.js')
    assert.match(device, /res = \{ \.\.\.res, capabilities: withGridEdit\(res\.capabilities, \{ demo: !!demoDevice\(\), vp4: isVp4\(res\) \}\) \}/)
  })

  test('an AM4’s chain read is counted from zero on the phone, as in the browser; the demo’s and a VP4’s are left as they are', async () => {
    const { chainFromZero } = await import('../mobile/src/lib/chainShape.js')
    const am4 = [1, 2, 3, 4].map((col) => ({ slug: 'amp', row: 1, col }))
    const linear = { slotModel: 'linear', slotCount: 4 }
    assert.deepEqual(chainFromZero(am4, linear).map((b) => b.col), [0, 1, 2, 3])
    assert.deepEqual(chainFromZero([{ col: 2 }, { col: 4 }], linear).map((b) => b.col), [1, 3], 'slot 1 empty: still one along')
    assert.deepEqual(chainFromZero(am4, linear, { demo: true }).map((b) => b.col), [1, 2, 3, 4])
    assert.deepEqual(chainFromZero(am4, linear, { vp4: true }).map((b) => b.col), [1, 2, 3, 4])
    /* AND ITS ONE ROW IS ROW 0, as its grid read says and as a linear unit's shape has it: left on row 1, the chain editor drew a second, empty lane over a full AM4. */
    assert.deepEqual(chainFromZero(am4, linear).map((b) => b.row), [0, 0, 0, 0])
    assert.deepEqual(chainFromZero(am4, linear, { demo: true }).map((b) => b.row), [1, 1, 1, 1])
    assert.deepEqual(chainFromZero([{ slug: 'x', row: 3, col: 2 }], { slotModel: 'grid' }).map((b) => b.row), [3], 'a grid unit’s rows are its own')
    const { lanesShown, gridShape } = await import('../mobile/src/lib/grid-plan.js')
    const full = chainFromZero(am4.map((b, i) => ({ ...b, effectId: 100 + i, name: 'Amp' })), linear)
    assert.equal(gridShape(linear).rows, 1)
    assert.equal(lanesShown(full, linear).length, 1, 'a full AM4 through the computer shows a lane of free slots it does not have')
    const grid = [{ col: 0 }, { col: 5 }]
    assert.equal(chainFromZero(grid, { slotModel: 'grid' }), grid)
    const device = read('mobile/src/lib/device.js')
    assert.match(device, /const list = chainFromZero\(read, chainCaps, \{ demo: !!demoDevice\(\), vp4: onVp4 \}\)/, 'presetBlocks puts the columns back')
    assert.match(device, /chainCaps = res\?\.capabilities \?\? null/)
  })

  test('starter chains are the phone’s alone for now: nothing the computer app carries imports them', () => {
    const { readdirSync, statSync } = { readdirSync: (d) => readdirSyncReal(d), statSync: (p) => statSyncReal(p) }
    const walk = (dir) =>
      readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap((n) => {
        const p = `${dir}/${n}`
        return statSync(new URL(`../${p}`, import.meta.url)).isDirectory() ? walk(p) : [p]
      })
    for (const f of walk('src').filter((p) => /\.(m?js|jsx)$/.test(p))) assert.ok(!/starter-chains/.test(read(f)), `${f} imports starter chains, which makes a computer release`)
  })
}

import { readdirSync as readdirSyncReal, statSync as statSyncReal } from 'node:fs'
