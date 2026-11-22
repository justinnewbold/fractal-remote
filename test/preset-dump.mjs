/*
 * A preset kept on this device (mobile/src/lib/presetDump.js): the rules
 * with nothing under them. The wire's half is in test/bluetooth.mjs.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const LIB = '../mobile/src/lib/presetDump.js'
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

export function run(test) {
  test('a backup on this device: kept as text and read back byte for byte, and text that is not one is nothing', async () => {
    const d = await import(LIB)
    const frames = [
      [0xf0, 0x00, 0x01, 0x74, 0x11, 0x77, 0x7f, 0x7f, 0x00, 0x00, 0x00, 0x12, 0xf7],
      [0xf0, 0x00, 0x01, 0x74, 0x11, 0x78, 0x01, 0x02, 0x03, 0x7f, 0x00, 0xf7],
      [0xf0, 0x00, 0x01, 0x74, 0x11, 0x79, 0x01, 0x02, 0xf7]
    ]
    for (const cut of [frames, frames.slice(0, 2), frames.slice(0, 1), [[0xf0, 0xf7]], [[0xf0, 0x01, 0xf7]]]) assert.deepEqual(d.unpackFrames(d.packFrames(cut)), cut)
    for (const bad of [null, '', 'abc', '!!!!', d.packFrames([[0xf0, 0x01, 0x02]])]) assert.equal(d.unpackFrames(bad), null, String(bad))
  })

  test('a backup on this device: a head is only ever sent at the edit buffer, and only the frames in hand pass', async () => {
    const d = await import(LIB)
    const sx = await import('../mobile/src/lib/fractal-sysex.mjs')
    const head = sx.frame(0x10, 0x77, [0x00, 0x05, 0x10, 0x00, 0x00])
    const there = d.toEditBuffer(head)
    assert.deepEqual([there[6], there[7]], [0x7f, 0x7f])
    assert.equal(sx.checksumOk(there), true)
    assert.deepEqual(head.slice(6, 8), [0x00, 0x05], 'the head handed in was changed')
    const chunk = sx.frame(0x10, 0x78, [1, 2, 3])
    assert.equal(d.loadAllowed(there, [there, chunk]), true)
    assert.equal(d.loadAllowed(chunk, [there, chunk]), true)
    assert.equal(d.loadAllowed(head, [head, chunk]), false, 'a head that names a slot is a store: never sent, even in hand')
    assert.equal(d.loadAllowed(chunk, null), false)
    assert.equal(d.loadAllowed(sx.frame(0x10, 0x78, [1, 2, 4]), [there, chunk]), false)
    for (const fn of [0x77, 0x78, 0x79]) assert.equal(d.dumpShaped(sx.frame(0x10, fn, [0, 0]), 0x10), true)
    assert.equal(d.dumpShaped(sx.frame(0x10, 0x78, [0, 0]), 0x11), false)
    assert.equal(d.dumpShaped(sx.frame(0x10, 0x03, [0x7f, 0x7f, 0]), 0x10), false, 'the question is not a frame of a preset')
    assert.equal(d.loadable([head, chunk], 0x10), null)
    assert.equal(d.loadable(null, 0x10), null)
    /* Only the frame helpers under it, so nothing here can reach a unit. */
    assert.deepEqual(src('mobile/src/lib/presetDump.js').match(/^import .*$/gm), ["import { checksum } from './fractal-sysex.mjs'", "import { DUMP, gridDumpPart, parseGridDump } from './gen3-grid.js'"])
  })

  test('a backup on this device: five of a preset and twenty in all are kept, the oldest go, never the one just made, and its keys are not read when the app starts', async () => {
    const d = await import(LIB)
    let list = []
    const all = []
    for (let i = 0; i < 7; i++) {
      const r = d.afterAdding(list, { id: `a${i}`, unit: 'fm3', slot: 4, name: 'Lead', at: 1000 + i, bytes: 10 })
      list = r.index
      all.push(...r.dropped)
    }
    assert.deepEqual(list.map((e) => e.id), ['a6', 'a5', 'a4', 'a3', 'a2'])
    assert.deepEqual(all, ['a0', 'a1'])
    /* Another preset, and another unit's same preset, are counted apart. */
    list = d.afterAdding(list, { id: 'b', unit: 'fm3', slot: 5, name: '', at: 5, bytes: 1 }).index
    list = d.afterAdding(list, { id: 'c', unit: 'axefxiii', slot: 4, name: '', at: 6, bytes: 1 }).index
    assert.equal(list.length, 7)
    assert.deepEqual(d.phoneRows(list, { unit: 'fm3', slot: 4 }).map((e) => e.id), ['a6', 'a5', 'a4', 'a3', 'a2'])
    assert.deepEqual(d.phoneRows(list, { unit: 'fm3' }).map((e) => e.id), ['a6', 'a5', 'a4', 'a3', 'a2', 'b'])
    assert.deepEqual(d.phoneRows(list, { unit: 'axefxiii', slot: 4 }).map((e) => e.id), ['c'])
    /* Twenty in all: an old one of another preset goes; the one just made stays even if it is the oldest by its clock. */
    let many = []
    for (let i = 0; i < d.KEEP_IN_ALL; i++) many = d.afterAdding(many, { id: `m${i}`, unit: 'fm9', slot: i, name: '', at: 100 + i, bytes: 1 }).index
    const r = d.afterAdding(many, { id: 'new', unit: 'fm9', slot: 99, name: '', at: 1, bytes: 1 })
    assert.equal(r.index.length, d.KEEP_IN_ALL)
    assert.ok(r.index.some((e) => e.id === 'new'))
    assert.deepEqual(r.dropped, ['m0'])
    /* Rubbish in the list is left out, not thrown on. */
    assert.deepEqual(d.cleanIndex([null, 3, { id: '' }, { id: 'x', unit: 'fm3', at: 'soon' }, { id: 'ok', unit: 'fm3', at: 2, slot: 'x', name: 5 }]), [{ id: 'ok', unit: 'fm3', slot: null, name: '', at: 2, bytes: 0 }])
    assert.deepEqual(d.cleanIndex('nope'), [])
    /* lib/store reads every `fractal.` key into memory at launch: these are tens of thousands of characters each. */
    assert.ok(!d.INDEX_KEY.startsWith('fractal.') && !d.dataKey('x').startsWith('fractal.'))
    assert.match(src('mobile/src/lib/store.js'), /startsWith\('fractal\.'\)/)
  })

  test('a backup on this device: the words promise nothing that is not so, and the pace is the MIDI jack’s', async () => {
    const d = await import(LIB)
    /* A frame of 3,082 bytes takes a second down a MIDI jack: the next waits at least that. A cable, a breath. */
    assert.ok(d.paceFor(3082, false) >= 987 && d.paceFor(3082, false) < 1200)
    assert.equal(d.paceFor(3082, true), 40)
    const row = { name: 'Lead', slot: 12 }
    assert.match(d.phonePlayAsk(row, { on: 12 }).body, /Nothing is saved\.$/)
    assert.match(d.phonePlayAsk(row, { on: 30 }).body, /came from preset 12, and the unit is on preset 30: saving afterwards would write it over preset 30/)
    assert.match(d.phonePlayAsk(row, { on: 12, unsaved: true }).body, /changes you haven’t saved are lost/)
    assert.match(d.PLAYED('Lead', true), /Save the preset to keep it/)
    assert.match(d.PLAYED('Lead', false), /Save it on the unit/)
    assert.equal(d.keepingWords({ got: 99, of: 100 }), 'Reading the preset from the unit… 99%')
    assert.equal(d.keepingWords(null), 'Reading the preset from the unit…')
    for (const text of [d.PHONE_WHERE('phone'), d.PHONE_PLAY_NOTE, d.PHONE_ONLY_GEN3, d.KEPT('x'), d.PLAYED('x', true)]) assert.ok(!/this phone|VP4|AM4/.test(text) || text === d.PHONE_WHERE('phone'), text)
    /* His account only, at the wire and on the page, until the switch. */
    assert.match(src('mobile/src/lib/features.js'), /export const BACKUPS_OVER_BLUETOOTH_FOR_EVERYONE = false/)
    assert.match(src('mobile/src/lib/bluetooth.js'), /backups: \(\) => backupsOverBluetooth\(\)/)
    assert.match(src('mobile/src/lib/bluetooth.js'), /export const backupsOverBluetooth = \(\) => allUnits === true \|\| BACKUPS_OVER_BLUETOOTH_FOR_EVERYONE/)
    /* The page saves nothing by itself: a slot is written only by the app's own Save. */
    const page = src('mobile/src/components/PhoneBackups.js')
    assert.ok(!/saveOnWire|storePreset/.test(page), 'the Backups page saves on its own')
    assert.ok(!/\b(put|post|del|request)\(/.test(page), 'the Backups page reaches the unit by something other than the two backup calls')
  })
}
