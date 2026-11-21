/**
 * A HELD PEDAL SWAPPED FOR ANOTHER FROM A LIST (mobile/src/lib/swapBlock.js,
 * lib/swapBlockHere.js, components/SwapBlock.js, and the button in Play's
 * hold pop-up, screens/Stage.js).
 *
 * "It would be nice to be able to swap pedals out from the screen as well
 * ... pulls up a list" (Justin's report 9361e16b, 21 November 2026).
 *
 * What these hold: where and for whom it is offered; what the list leaves
 * out; that it asks first; and that it reaches a unit by the chain
 * editor's own calls, reads the cell back, and joins only what went.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
const flat = (s) => code(s).replace(/\s+/g, ' ')

export function run(test) {
  test('swap a pedal: offered where the chain editor is, on a block of the chain’s middle, for an account it is open to', async () => {
    const m = await import('../mobile/src/lib/swapBlock.js')
    const drive = { slug: 'drive', name: 'Drive 1' }
    const computer = { gridEdit: true }
    const ok = { allowed: true, block: drive, id: 118, caps: computer }
    assert.equal(m.swapBlockFor(ok), true)
    assert.equal(m.swapBlockFor({ ...ok, allowed: false }), false)
    assert.equal(m.swapBlockFor({ ...ok, vp4: true }), false)
    assert.equal(m.swapBlockFor({ ...ok, elsewhere: true }), false)
    assert.equal(m.swapBlockFor({ ...ok, id: null }), false)
    assert.equal(m.swapBlockFor({ ...ok, caps: {} }), false, 'a unit that places no blocks')
    assert.equal(m.swapBlockFor({ ...ok, block: null }), false)
    for (const slug of ['input', 'output']) assert.equal(m.swapBlockFor({ ...ok, block: { slug } }), false, slug)
    assert.equal(m.swapBlockFor({ ...ok, block: { ...drive, fixed: true } }), false)
    assert.equal(m.swapBlockFor({ ...ok, block: { ...drive, noControls: true } }), false)
    /* Over Bluetooth only where the wire says the editor is there. */
    assert.equal(m.swapBlockFor({ ...ok, viaBle: true }), false)
    assert.equal(m.swapBlockFor({ ...ok, viaBle: true, caps: { gridEdit: true, chainEditor: true } }), true)
    /* His account first. */
    assert.match(read('mobile/src/lib/features.js'), /export const SWAP_BLOCK_FOR_EVERYONE = false/)
    assert.ok(flat(read('mobile/src/lib/swapBlockHere.js')).includes('allowed: SWAP_BLOCK_FOR_EVERYONE || his,'))
  })

  test('swap a pedal: the list is the unit’s blocks less the ones the preset holds, one of each kind until something is typed', async () => {
    const m = await import('../mobile/src/lib/swapBlock.js')
    const palette = [
      { page: 118, name: 'Drive 1', family: 'drive' },
      { page: 119, name: 'Drive 2', family: 'drive' },
      { page: 70, name: 'Delay 1', family: 'delay' },
      { page: 71, name: 'Delay 2', family: 'delay' },
      { page: 66, name: 'Reverb 1', family: 'reverb' },
      { name: 'no number' }
    ]
    const used = new Set([118, 66])
    assert.deepEqual(m.swapList(palette, used).map((b) => b.page), [119, 70, 71])
    assert.deepEqual(m.swapKinds(m.swapList(palette, used), used).map((b) => b.name), ['Drive 2', 'Delay 1'])
    assert.deepEqual(m.swapList(null, used), [])
    const w = m.swapBlockAsk('Drive 1', 'Chorus 1')
    assert.match(w.body, /Drive 1 and its settings leave this preset/)
    assert.match(w.body, /Nothing is saved until you save the preset/)
  })

  test('swap a pedal: it asks first, sends by the chain editor’s calls alone, reads the cell back and joins only what went', () => {
    const here = flat(read('mobile/src/lib/swapBlockHere.js'))
    assert.match(here, /import \{ blockCatalog, gridCells, idOf, placeBlock, setCable, vp4Here \} from '\.\/device'/)
    assert.doesNotMatch(here, /remoteRequest|bleWire|clearCell/)
    /* Read first; nothing sent to another preset, for a block that is gone, or for one the preset holds. */
    const order = ['cells = await gridCells()', 'getState().preset?.number !== n) return { ok: false, words: SWAP_BLOCK_MOVED }', 'if (!plan)', 'c.effectId === to)) {', 'beginChainWrite()', 'await placeBlock(plan.row, plan.col, to)', 'const landed =', 'if (!landed) return', 'noteEdited()', 'missingJoins(after, plan.joins)', 'endChainWrite({ refresh: false })']
    let at = -1
    for (const piece of order) {
      const i = here.indexOf(piece, at + 1)
      assert.ok(i > at, `out of order or missing: ${piece}`)
      at = i
    }
    assert.ok(here.includes('if (cables && plan.joins.length)'), 'cables only where the unit has them')
    assert.ok(here.includes("const cables = getState().capabilities?.gridRouting === true"))
    const door = flat(read('mobile/src/components/SwapBlock.js'))
    assert.ok(door.includes("Alert.alert(w.title, w.body, [ { text: w.no, style: 'cancel' }, { text: w.yes, style: 'destructive', onPress: () => go(pick) } ])"))
    assert.ok(door.includes('onPick={ask}'), 'a pick swaps without asking')
    /* In the pop-up: under the knobs and the channels' words, never over them, and the new block's pop-up after. */
    const stage = flat(read('mobile/src/screens/Stage.js'))
    assert.ok(stage.includes("const swapAny = useSwapBlock(block, elsewhere) && typeof onSwapped === 'function'"))
    assert.equal(stage.split('{swapDoor}').length - 1, 2)
    assert.ok(stage.indexOf('<PopKnobs block={block}') < stage.indexOf('{swapDoor}'), 'the knobs come first')
  })
}
