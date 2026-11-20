/**
 * A HELD AMP SWAPPED FOR A NAM BLOCK (mobile/src/lib/ampToNam.js,
 * lib/ampToNamHere.js, components/AmpToNam.js, and the button in Play's hold
 * pop-up, screens/Stage.js).
 *
 * "Let's make it so holding the amp button down shows TONE3000 just like the
 * NAM block when you hold it down. and you can switch out the amp block out
 * directly to a NAM block. Build that for AX3 and AM4" (Justin, 19 November
 * 2026).
 *
 * What these hold: who and what is offered it; which NAM block goes in; the
 * cables kept through the cell; that it asks first; and that it reaches a
 * unit by the chain editor's own calls and nothing else.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
const flat = (s) => code(s).replace(/\s+/g, ' ')

export function run(test) {
  test('amp to NAM: offered on a held amp of an Axe-Fx III or an AM4 for an account it is open to, and on nothing else', async () => {
    const m = await import('../mobile/src/lib/ampToNam.js')
    const amp = { slug: 'amp', name: 'Amp 1' }
    assert.equal(m.ampToNamFor(true, amp, 'axefxiii'), true)
    assert.equal(m.ampToNamFor(true, amp, 'am4'), true)
    for (const slug of ['fm3', 'fm9', 'vp4', 'axefxii', '', null]) assert.equal(m.ampToNamFor(true, amp, slug), false, String(slug))
    assert.equal(m.ampToNamFor(false, amp, 'am4'), false)
    assert.equal(m.ampToNamFor(true, { slug: 'nam' }, 'am4'), false)
    assert.equal(m.ampToNamFor(true, { slug: 'drive' }, 'axefxiii'), false)
    assert.equal(m.ampToNamFor(true, null, 'axefxiii'), false)
    /* His account first. */
    assert.match(read('mobile/src/lib/features.js'), /export const AMP_TO_NAM_FOR_EVERYONE = true/)
    assert.ok(flat(read('mobile/src/lib/ampToNamHere.js')).includes('export const useAmpToNam = () => { const his = useBluetoothAdmin() return AMP_TO_NAM_FOR_EVERYONE || his }'))
  })

  test('amp to NAM: the unit’s first NAM block the preset does not hold goes in, an AM4 only ever its first, and the cell’s cables are the ones to keep', async () => {
    const m = await import('../mobile/src/lib/ampToNam.js')
    assert.equal(m.namToPlace('axefx3', [{ effectId: 58 }]), 206)
    assert.equal(m.namToPlace('axefx3', [{ effectId: 58 }, { effectId: 206 }]), 207)
    assert.equal(m.namToPlace('axefx3', [{ effectId: 206 }, { effectId: 207 }]), null)
    assert.equal(m.namToPlace('am4', [{ effectId: 0x3a }]), 0xd1)
    assert.equal(m.namToPlace('am4', [{ effectId: 0xd1 }]), null, 'an AM4 is given a second NAM block')
    assert.equal(m.namToPlace('am4', [{ effectId: 0xd2 }]), null)
    assert.equal(m.namToPlace('fm3', []), null)
    /* A row of an Axe-Fx III: Input, Drive, Amp, Cab, Output on row 3 (index 2), and a branch out of the amp into row 4. */
    const cells = [
      { row: 2, col: 0, effectId: 37, fromRows: [] },
      { row: 2, col: 1, effectId: 118, fromRows: [2] },
      { row: 2, col: 2, effectId: 58, fromRows: [2] },
      { row: 2, col: 3, effectId: 62, fromRows: [2] },
      { row: 3, col: 3, effectId: 70, fromRows: [2] },
      { row: 2, col: 4, effectId: 42, fromRows: [2, 3] }
    ]
    assert.deepEqual(m.swapPlan(cells, 58), {
      row: 2,
      col: 2,
      joins: [
        { srcRow: 2, srcCol: 1, destRow: 2 },
        { srcRow: 2, srcCol: 2, destRow: 2 },
        { srcRow: 2, srcCol: 2, destRow: 3 }
      ]
    })
    assert.equal(m.swapPlan(cells, 59), null)
    assert.equal(m.swapPlan(null, 58), null)
    /* An AM4's slots carry no cables. */
    assert.deepEqual(m.swapPlan([{ row: 0, col: 0, effectId: 0x76, fromRows: [] }, { row: 0, col: 1, effectId: 0x3a, fromRows: [] }], 0x3a), { row: 0, col: 1, joins: [] })
  })

  test('amp to NAM: it asks before anything is sent, reaches the unit by the chain editor’s own calls, and the pop-up becomes the NAM block’s with its captures open', async () => {
    const m = await import('../mobile/src/lib/ampToNam.js')
    const ask = m.swapAsk('Amp 1')
    assert.equal(ask.title, 'Swap Amp 1 for a NAM block?')
    assert.match(ask.body, /Amp 1 and its settings leave this preset/)
    assert.match(ask.body, /Nothing is saved until you save the preset/)
    /* Every word a player can be shown names no device in hand by a fixed word. */
    for (const w of [m.SWAP_LABEL, m.SWAP_SUB, m.SWAP_HAS_NAM, m.SWAP_NO_AMP, m.SWAP_NOT_READ, m.SWAP_MOVED, m.swapRefused('am4'), m.swapRefused('axefx3'), m.swapUnjoined(1), m.swapUnjoined(2), ask.body]) assert.doesNotMatch(w, /this phone/i)
    assert.match(m.swapUnjoined(1), /one cable/)
    assert.match(m.swapUnjoined(3), /3 cables/)
    const here = code(read('mobile/src/lib/ampToNamHere.js'))
    /* The unit is reached by the grid read, a block put in a cell and a cable, and nothing else of lib/device. */
    assert.equal(here.match(/^import \{ ([^}]*) \} from '\.\/device'$/m)?.[1], 'gridCells, idOf, placeBlock, setCable')
    /* Read first, the preset checked, the cell read back before it is called in, and only the cables found gone are sent. */
    const f = flat(here)
    assert.ok(f.indexOf('cells = await gridCells()') < f.indexOf('await placeBlock(plan.row, plan.col, nam)'))
    assert.ok(f.includes("if (getState().preset?.number !== n) return { ok: false, words: SWAP_MOVED }"))
    assert.ok(f.includes('const landed = Array.isArray(after) && after.some((c) => c && c.row === plan.row && c.col === plan.col && c.effectId === nam)'))
    assert.ok(f.includes('if (!landed) return { ok: false, words: swapRefused(unit) }'))
    assert.ok(f.includes("if (unit !== 'am4' && plan.joins.length) { const gone = missingJoins(after, plan.joins)"))
    assert.ok(f.includes('for (const j of gone) { if (getState().preset?.number !== n) break await setCable(j.srcRow, j.srcCol, j.destRow, true)'))
    /* The button asks first. */
    const door = flat(read('mobile/src/components/AmpToNam.js'))
    assert.ok(door.includes("Alert.alert(w.title, w.body, [ { text: w.no, style: 'cancel' }, { text: w.yes, style: 'destructive', onPress: go } ])"))
    assert.ok(door.includes('onPress={ask}'), 'the swap is sent on the first tap')
    /* In Play's pop-up: over the knobs or the channels, and the NAM block's captures open once the pop-up is that block's. */
    const stage = flat(read('mobile/src/screens/Stage.js'))
    assert.ok(stage.includes("const swapHere = useAmpSwap(block) && typeof onSwapped === 'function'"))
    assert.ok(stage.includes('const ampDoor = swapHere ? ( <AmpSwapDoor block={block} onSwapped={(id, note) => { openOn.current = id onSwapped(id, note) }} /> ) : null'))
    assert.ok(stage.includes('onSwapped={(id) => setPicking(id)}'))
    assert.equal(stage.split('{ampDoor}').length - 1, 2)
  })
}
