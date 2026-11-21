import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')

/* Clear this preset, in the chain editor (mobile/src/lib/clearPreset.js). */
export function run(test) {
  const lanes = [
    {
      row: 2,
      blocks: [
        { slug: 'input', name: 'Input 1', col: 0 },
        { slug: 'drive', name: 'Drive 1', col: 1 },
        { slug: 'amp', name: 'Amp 1', col: 2 },
        { slug: 'output', name: 'Output 1', col: 5 }
      ],
      held: [{ name: 'New block', col: 3 }]
    },
    { row: 3, blocks: [{ slug: 'delay', name: 'Delay 1', col: 2 }, { slug: 'nam', name: 'NAM', col: 3, fixed: true }] }
  ]

  test('clear preset: every block but the Input, the Output and one the editor cannot move, in the lanes’ order', async () => {
    const c = await import('../mobile/src/lib/clearPreset.js')
    assert.deepEqual(c.clearable(lanes), [
      { row: 2, col: 1, name: 'Drive 1' },
      { row: 2, col: 2, name: 'Amp 1' },
      { row: 3, col: 2, name: 'Delay 1' }
    ])
    assert.deepEqual(c.clearable([{ row: 0, blocks: [{ slug: 'input', col: 0 }, { slug: 'output', col: 3 }] }]), [], 'an Input or an Output is taken out')
    assert.deepEqual(c.clearable(null), [])
    assert.equal(c.heldCount(lanes), 1)
  })

  test('clear preset: it says what the read after shows, never that a preset was cleared when it was not', async () => {
    const c = await import('../mobile/src/lib/clearPreset.js')
    const ok = c.clearSaid({ asked: 3, sent: 3, left: [], read: true })
    assert.equal(ok.tone, 'ok')
    assert.match(ok.text, /^Took all 3 blocks out\. Nothing is saved until you save/)
    assert.match(c.clearSaid({ asked: 1, sent: 1 }).text, /^Took the block out\./)
    const kept = c.clearSaid({ asked: 3, sent: 3, left: [{ name: 'Amp 1' }], read: true })
    assert.equal(kept.tone, 'warn')
    assert.equal(kept.text, 'The unit kept Amp 1. 2 blocks taken out.')
    assert.equal(c.clearSaid({ asked: 3, sent: 0, stopped: 'moved' }).text, 'Nothing was taken out: the unit is on another preset now.')
    assert.match(c.clearSaid({ asked: 3, sent: 2, stopped: 'moved' }).text, /^Stopped: the unit went to another preset after 2 blocks/)
    assert.match(c.clearSaid({ asked: 3, sent: 1, stopped: 'unknown' }).text, /didn’t say which preset/)
    const blind = c.clearSaid({ asked: 3, sent: 3, read: false })
    assert.equal(blind.tone, 'warn')
    assert.ok(!/Took/.test(blind.text), 'a clear nobody read back is called done')
    assert.match(c.clearSaid({ asked: 2, sent: 2, held: 1 }).text, /One block the app has no name for was left where it is\.$/)
  })

  test('clear preset: it asks first, and says nothing is saved', async () => {
    const c = await import('../mobile/src/lib/clearPreset.js')
    assert.match(c.clearAsk(4), /^All 4 blocks in this preset and their settings are taken out\. The Input and Output stay\. Nothing is saved until you save: load the preset again to bring them back\.$/)
    assert.match(c.clearAsk(1), /^The 1 block in this preset and its settings/)
    assert.match(c.clearAsk(2, false), /Nothing is saved on the unit by this/)
  })

  test('clear preset: the editor asks before it sends, holds each remove to the preset, sends the editor’s own clear and reads the chain once', () => {
    const edit = flat(read('mobile/src/screens/Edit.js'))
    const a = edit.indexOf('const clearAll = async () => {')
    const b = edit.indexOf('const remove = async (row, col) => {')
    assert.ok(a > 0 && b > a)
    const body = edit.slice(a, b)
    assert.match(body, /const hold = presetHeld\(n\)/)
    assert.match(body, /if \(hold\) \{ const at = await hold\(\) if \(at !== 'same'\) \{ stopped = at break \} \} const r = await clearCell\(c\.row, c\.col\)/, 'a remove goes without the unit being asked which preset it is on')
    assert.equal(body.split('clearCell(').length - 1, 1, 'the clear sends something other than the editor’s own remove')
    assert.ok(!/placeBlock\(|setCable\(|saveOnWire|saveTo\./.test(body), 'a clear places, joins or saves')
    assert.match(body, /Alert\.alert\(CLEAR_ASK_TITLE, clearAsk\(n, caps\?\.supportsSave !== false\), \[ \{ text: 'Cancel', style: 'cancel' \}, \{ text: 'Clear', style: 'destructive', onPress: clearAll \} \]\)/, 'the clear goes without asking')
    assert.match(edit, /<Press label=\{CLEAR_LABEL\} sub=\{CLEAR_SUB\} height=\{48\} disabled=\{busy\} onPress=\{askClear\}/, 'the button sends without the question')
    assert.ok(!/^import /m.test(read('mobile/src/lib/clearPreset.js')))
  })
}
