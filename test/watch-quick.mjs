/**
 * QUICK EDIT ON THE APPLE WATCH: a pedal held on the wrist opens its
 * channels with a list of the block's knobs under them, and the Digital
 * Crown turns the one picked.
 *
 * "On the watch, we have pushed to hold on the channels to switch amps. Can
 * we set up quick edits on that as well? And change the name to hold to
 * quick edit? give me some mockups of that." Then, of the three: "For the
 * watch, mock up B." (Justin, 12 November 2026.)
 *
 * TWO HALVES, as everything on the watch is (test/watch-pages.mjs says why).
 * The phone's half is in the tree: the protocol (shared/watch-link.mjs,
 * QUICK EDIT ON THE WRIST), the rule and what is kept while a sheet is open
 * (mobile/src/lib/watchQuick.js, which imports nothing), and the one place
 * it is joined to the unit (lib/watchQuickEdit.js), by Edit's own read and
 * Edit's own checked write and nothing else. The watch's half is Swift and
 * waits in docs/pending/watch-page-order.patch.
 *
 * What is held here:
 *
 *   - INERT until a watch says `quick` in its hello, which none does before
 *     the build: to every watch out today the picture is what it was.
 *   - HIS ACCOUNT ONLY until features WATCH_QUICK_EDIT_FOR_EVERYONE, and
 *     only where the phone's own hold pop-up carries knobs (Edit's door;
 *     never a VP4).
 *   - THE KNOBS ARE EDIT'S: the ones its panel draws first, never a Level,
 *     read by blockParams and written by setParamConfirmed, both of which
 *     lib/device marks as Edit's. No model, no on or off, no save.
 *   - A turn never lands on another channel's, scene's or preset's block.
 *   - The watch writes a turned knob's number by the phone's own rule.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

const link = () => import('../shared/watch-link.mjs')

/** lib/watchQuick.js imports nothing, and is run from a copy. */
async function rules() {
  const dir = mkdtempSync(join(tmpdir(), 'watch-quick-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    const src = read('mobile/src/lib/watchQuick.js')
    assert.doesNotMatch(src, /^import /m, 'lib/watchQuick.js imports something; this check runs it on its own, and so nothing in it can reach the unit')
    writeFileSync(join(dir, 'rule.js'), src)
    return await import(pathToFileURL(join(dir, 'rule.js')).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Edit's own rules, from the files the phone's copies are generated from. */
async function edits() {
  const { editPages } = await import('../src/lib/editPages.js')
  const { isSilencingParam } = await import('../src/lib/guardrails.js')
  const { fromNormalized, toNormalized } = await import('../src/lib/scale.js')
  const { oneWriteAtATime } = await import('../shared/knob-keys.mjs')
  return { editPages, isSilencingParam, fromNormalized, toNormalized, oneWriteAtATime }
}

/** A drive as a unit with no editor pages reads it: four knobs, a Level, a routing control and a knob with no range. */
const DRIVE = () => ({
  slug: 'drive',
  named: [
    { id: 11, name: 'Drive', value: 6.2, min: 0, max: 10 },
    { id: 12, name: 'Tone', value: 5, min: 0, max: 10 },
    { id: 13, name: 'Level', value: -3, min: -80, max: 20, unit: 'dB' },
    { id: 14, name: 'Mix', value: 100, min: 0, max: 100, unit: '%' },
    { id: 15, name: 'Low Cut', value: 20, min: 20, max: 20000, unit: 'Hz', log: true },
    { id: 16, name: 'Bypass Mode', value: 0, min: 0, max: 3 },
    { id: 17, name: 'Slew', value: 0.4, norm: 0.4 }
  ]
})

/** A bench for what the phone keeps while a sheet is open: Edit's rules for real, the unit a stand-in that records. */
async function bench({ block = DRIVE(), failRead = false } = {}) {
  const r = await rules()
  const e = await edits()
  const { watchKnobText, WATCH_QUICK_MAX } = await link()
  const unit = { block, sig: 'p12:s1:r0:B', reads: 0, writes: [], edited: 0, changes: 0, log: [], readable: true, gate: null, now: 1000 }
  const quick = r.createWatchQuick({
    read: async (id) => {
      unit.reads++
      if (unit.gate) await unit.gate
      if (failRead) throw new Error('no answer')
      return JSON.parse(JSON.stringify(unit.block))
    },
    write: async (id, p, value) => {
      unit.writes.push({ id, param: p.id, value })
      if (unit.hold) await unit.hold
      const mine = unit.block.named.find((q) => q.id === p.id)
      if (mine && !unit.refuse) mine.value = value
      return { ok: !unit.refuse }
    },
    edited: () => unit.edited++,
    sig: () => unit.sig,
    readable: () => unit.readable,
    params: (got) => r.quickParams(got, { pages: e.editPages, silencing: e.isSilencingParam, max: WATCH_QUICK_MAX }),
    valueAt: (p, at) => Math.round(e.fromNormalized(at, p) * 1000) / 1000,
    knob: (p, value) => r.quickKnob(p, value, { toNormalized: e.toNormalized, text: watchKnobText }),
    oneAtATime: e.oneWriteAtATime,
    changed: () => unit.changes++,
    log: (...a) => unit.log.push(a.join(' ')),
    clock: () => unit.now
  })
  return { r, unit, quick }
}

const settle = () => new Promise((done) => setTimeout(done, 0))

export function run(test) {
  test('watch quick edit: his account only until its switch, only where the hold pop-up has knobs, and the switch is off', async () => {
    const r = await rules()
    assert.equal(r.watchQuickOn({ allowed: true, popKnobs: true }), true)
    assert.equal(r.watchQuickOn({ allowed: false, popKnobs: true }), false, 'quick edit is offered on the wrist to an account it is not open to')
    assert.equal(r.watchQuickOn({ allowed: true, popKnobs: false }), false, 'quick edit is offered on the wrist where the phone’s own pop-up has no knobs: Edit’s door is shut, or it is a VP4')
    assert.equal(r.watchQuickOn(), false)
    for (const odd of [1, 'yes', null, undefined, {}]) {
      assert.equal(r.watchQuickOn({ allowed: odd, popKnobs: true }), false, String(odd))
      assert.equal(r.watchQuickOn({ allowed: true, popKnobs: odd }), false, String(odd))
    }
    assert.match(read('mobile/src/lib/features.js'), /^export const WATCH_QUICK_EDIT_FOR_EVERYONE = false$/m, 'quick edit on the watch is open to every account before he has said so')

    /* App asks the rule with the pop-up's own answer (so Edit's door and never a VP4, lib/holdPop) and his kept sign-in or the switch; Play is told only that, and hands it to the watch's picture and nowhere else. */
    const app = code(read('mobile/App.js'))
    assert.match(app, /import \{ watchQuickOn \} from '\.\/src\/lib\/watchQuick'/)
    assert.match(app, /import \{ WATCH_QUICK_EDIT_FOR_EVERYONE \} from '\.\/src\/lib\/features'/)
    assert.match(app, /const popKnobs = popKnobsOn\(\{ allowed: sidesAdmin \|\| HOLD_POPUP_KNOBS_FOR_EVERYONE, editOpens, vp4: noKnobs \}\)/)
    assert.match(app, /const watchQuick = watchQuickOn\(\{ allowed: sidesAdmin \|\| WATCH_QUICK_EDIT_FOR_EVERYONE, popKnobs \}\)/)
    assert.match(app, /popKnobs=\{popKnobs\}\s+watchQuick=\{watchQuick\}/)
    /* Four: the file the rule is in, the answer, and Play's prop and its value. */
    assert.equal((app.match(/\bwatchQuick\b/g) || []).length, 4, 'the answer goes somewhere other than Play')
    const stage = code(read('mobile/src/screens/Stage.js'))
    assert.match(stage, /\n  watchQuick = false,\n/)
    assert.match(stage, /\n      quickEdit: watchQuick,\n/)
    assert.equal((stage.match(/\bwatchQuick\b/g) || []).length, 2, 'Play does something with the watch’s quick edit besides telling the watch')
  })

  test('watch quick edit: a watch says it knows quick, and the picture says nothing of it to one that has not', async () => {
    const { WATCH_KNOWS, watchKnows, watchState, sameWatchState } = await link()
    assert.ok(WATCH_KNOWS.includes('quick'))
    assert.deepEqual(watchKnows(['quick', 'pages']), ['pages', 'quick'])
    assert.match(code(read('mobile/src/lib/watchPages.js')), /export const watchKnowsQuick = \(\) => knows\.includes\('quick'\)/)

    /* Not given: neither field, and the picture is what it always was. */
    const input = { at: 5, linked: true, sceneCount: 4, pedals: [{ id: 50, name: 'Drive 1', channel: 'B', channels: ['A', 'B', 'C', 'D'] }, { id: 70, name: 'Delay 1', channels: ['A', 'B'] }] }
    const knobs = [
      { key: '11', name: 'Drive', text: '6.20', at: 0.62, min: 0, max: 10, log: false, unit: '' },
      { key: '15', name: 'Low Cut', text: '632.46 Hz', at: 0.5, min: 20, max: 20000, log: true, unit: 'Hz' }
    ]
    const plain = watchState(input)
    assert.equal('quickEdit' in plain, false, 'a watch that has not said it knows quick edit is told of it')
    assert.equal('quick' in plain, false)
    for (const none of [{ quickEdit: null }, { quickEdit: undefined }, { quickEdit: null, quick: { id: 50, knobs } }, { quick: { id: 50, knobs } }]) {
      assert.deepEqual(watchState({ ...input, ...none }), plain, `${JSON.stringify(none)} changed the picture`)
    }
    /* Offered, with no sheet open: the one word, last in the picture, and nothing else moved. */
    const offered = watchState({ ...input, quickEdit: true })
    assert.equal(offered.quickEdit, true)
    assert.equal('quick' in offered, false, 'a sheet’s knobs are in the picture with no sheet open')
    const { quickEdit: _q, ...rest } = offered
    assert.deepEqual(rest, plain, 'quick edit changed something else in the picture')
    assert.equal(Object.keys(offered).at(-1), 'quickEdit')
    /* Not offered is said as false, so a watch can be put back; and only a plain true is a yes. */
    assert.equal(watchState({ ...input, quickEdit: false }).quickEdit, false)
    for (const odd of [1, 'yes', {}, []]) assert.equal(watchState({ ...input, quickEdit: odd }).quickEdit, false, String(odd))
    /* NOT OFFERED, NO KNOBS, whatever is handed in. */
    assert.equal('quick' in watchState({ ...input, quickEdit: false, quick: { id: 50, knobs } }), false, 'knobs are sent where quick edit is not offered')

    /* A sheet open: the pedal and its knobs, each with every field. */
    const open = watchState({ ...input, quickEdit: true, quick: { id: 50, knobs } })
    assert.deepEqual(open.quick, { id: 50, knobs })
    assert.deepEqual(Object.keys(open.quick.knobs[0]), ['key', 'name', 'text', 'at', 'min', 'max', 'log', 'unit'])
    /* Only for a pedal the picture shows. */
    assert.equal('quick' in watchState({ ...input, quickEdit: true, quick: { id: 51, knobs } }), false, 'the knobs of a pedal the watch was never shown are sent')
    assert.equal('quick' in watchState({ ...input, quickEdit: true, quick: { id: '50', knobs } }), false)
    assert.equal('quick' in watchState({ ...input, pedals: [], quickEdit: true, quick: { id: 50, knobs } }), false, 'another preset’s chain is up, and the last one’s knobs are still sent')
    /* Still reading is no field at all; read and none to show is an empty list, which the watch draws as the channels alone. */
    assert.deepEqual(watchState({ ...input, quickEdit: true, quick: { id: 50, knobs: [] } }).quick, { id: 50, knobs: [] })
    assert.deepEqual(watchState({ ...input, quickEdit: true, quick: { id: 50 } }).quick, { id: 50, knobs: [] })

    /* What is sent is cleaned: no more than eight, each key once, and never a knob the watch could not place or turn. */
    const { WATCH_QUICK_MAX } = await link()
    assert.equal(WATCH_QUICK_MAX, 8)
    const many = Array.from({ length: 30 }, (_, i) => ({ key: String(i), name: `Knob ${i}`, text: '1.00', at: 0.1, min: 0, max: 10 }))
    assert.equal(watchState({ ...input, quickEdit: true, quick: { id: 50, knobs: many } }).quick.knobs.length, WATCH_QUICK_MAX)
    const one = (k) => watchState({ ...input, quickEdit: true, quick: { id: 50, knobs: [k] } }).quick.knobs
    const good = { key: '1', name: 'Drive', text: '6.20', at: 0.62, min: 0, max: 10 }
    assert.deepEqual(one(good), [{ ...good, log: false, unit: '' }])
    for (const bad of [{ key: '' }, { key: 7 }, { key: null }, { key: 'x'.repeat(40) }, { at: NaN }, { at: '0.5' }, { at: null }, { min: null }, { max: undefined }, { min: 10, max: 10 }, { min: 10, max: 0 }, { min: '0' }, { max: Infinity }]) {
      assert.deepEqual(one({ ...good, ...bad }), [], `${JSON.stringify(bad)} was sent as a knob`)
    }
    assert.deepEqual(one(null), [])
    assert.equal(one({ ...good, at: 4 })[0].at, 1)
    assert.equal(one({ ...good, at: -4 })[0].at, 0)
    assert.equal(one({ ...good, at: 0.123456 })[0].at, 0.123)
    assert.equal(one({ ...good, log: true })[0].log, false, 'a logarithmic scale from nought was sent as one')
    assert.equal(one({ ...good, min: 20, max: 20000, log: true })[0].log, true)
    assert.equal(one({ ...good, log: 'yes', min: 1 })[0].log, false)
    assert.ok(one({ ...good, name: 'x'.repeat(90), text: 'y'.repeat(90), unit: 'z'.repeat(90) }).every((k) => k.name.length <= 24 && k.text.length <= 16 && k.unit.length <= 8))
    assert.deepEqual(watchState({ ...input, quickEdit: true, quick: { id: 50, knobs: [good, { ...good, name: 'Twice' }] } }).quick.knobs.map((k) => k.name), ['Drive'], 'one key was sent twice')
    assert.deepEqual(watchState({ ...input, quickEdit: true, quick: { id: 50, knobs: 'none' } }).quick, { id: 50, knobs: [] })

    /* A knob moved, the sheet opened or closed, or quick edit offered or not, is a new picture; the clock alone is not. */
    assert.equal(sameWatchState(open, watchState({ ...input, quickEdit: true, quick: { id: 50, knobs: [{ ...knobs[0], at: 0.7, text: '7.00' }, knobs[1]] } })), false)
    assert.equal(sameWatchState(open, offered), false)
    assert.equal(sameWatchState(offered, plain), false)
    assert.equal(sameWatchState(offered, watchState({ ...input, quickEdit: false })), false)
    assert.equal(sameWatchState(open, watchState({ ...input, at: 9, quickEdit: true, quick: { id: 50, knobs } })), true)
    /* The link's version does not move: nothing an older watch reads changed meaning. */
    assert.equal(open.v, 1)
  })

  test('watch quick edit: the watch may ask for a held pedal’s knobs and turn one it was shown, and nothing else rides in', async () => {
    const { watchState, watchCommand } = await link()
    const pedals = [{ id: 50, name: 'Drive 1', channel: 'B', channels: ['A', 'B', 'C', 'D'] }, { id: 70, name: 'Delay 1', channel: 'A', channels: ['A'] }]
    const knobs = [{ key: '11', name: 'Drive', text: '6.20', at: 0.62, min: 0, max: 10 }, { key: '12', name: 'Tone', text: '5.00', at: 0.5, min: 0, max: 10 }]
    const offered = watchState({ sceneCount: 4, pedals, quickEdit: true })
    const open = watchState({ sceneCount: 4, pedals, quickEdit: true, quick: { id: 50, knobs } })
    const closed = watchState({ sceneCount: 4, pedals, quickEdit: false })
    const before = watchState({ sceneCount: 4, pedals })

    /* THE KNOBS OF A PEDAL: one the picture showed and a hold opens, and nothing but its id. */
    assert.deepEqual(watchCommand({ do: 'knobs', id: 50 }, offered), { do: 'knobs', id: 50 })
    assert.deepEqual(watchCommand({ do: 'knobs', id: 50, key: '11', at: 1, save: true, model: 9 }, offered), { do: 'knobs', id: 50 }, 'asking for the knobs carried something else to the phone')
    assert.equal(watchCommand({ do: 'knobs', id: 51 }, offered), null, 'the knobs of a pedal the watch was never shown were read')
    assert.equal(watchCommand({ do: 'knobs', id: 70 }, offered), null, 'the knobs of a pedal a hold does not open were read')
    for (const bad of [{}, { id: '50' }, { id: 50.5 }, { id: undefined }, { id: [50] }, { id: true }]) assert.equal(watchCommand({ do: 'knobs', ...bad }, offered), null, JSON.stringify(bad))
    /* The sheet closing: none. */
    assert.deepEqual(watchCommand({ do: 'knobs', id: null }, offered), { do: 'knobs', id: null })
    assert.deepEqual(watchCommand({ do: 'knobs', id: null }, open), { do: 'knobs', id: null })
    /* ONLY WHERE THE LAST PICTURE OFFERED QUICK EDIT: not where it said no, not to a watch never told of it, not with no picture. */
    for (const state of [closed, before, null, { quickEdit: 'yes', pedals: open.pedals }]) {
      assert.equal(watchCommand({ do: 'knobs', id: 50 }, state), null, 'a block’s knobs were read for a watch quick edit was not offered to')
      assert.equal(watchCommand({ do: 'knobs', id: null }, state), null)
      assert.equal(watchCommand({ do: 'knob', id: 50, key: '11', at: 0.5 }, state), null, 'a knob was turned for a watch quick edit was not offered to')
    }

    /* A TURN: only a knob the last picture listed for that pedal, to a place inside its range, to three figures. */
    assert.deepEqual(watchCommand({ do: 'knob', id: 50, key: '11', at: 0.5 }, open), { do: 'knob', id: 50, key: '11', at: 0.5 })
    assert.deepEqual(watchCommand({ do: 'knob', id: 50, key: '12', at: 0.123456, value: 99, save: true, continuous: false }, open), { do: 'knob', id: 50, key: '12', at: 0.123 }, 'a turn carried something else to the phone')
    assert.deepEqual(watchCommand({ do: 'knob', id: 50, key: '11', at: 0 }, open), { do: 'knob', id: 50, key: '11', at: 0 })
    assert.deepEqual(watchCommand({ do: 'knob', id: 50, key: '11', at: 1 }, open), { do: 'knob', id: 50, key: '11', at: 1 })
    assert.equal(watchCommand({ do: 'knob', id: 50, key: '13', at: 0.5 }, open), null, 'a knob the watch was never shown was turned: a Level, say')
    assert.equal(watchCommand({ do: 'knob', id: 70, key: '11', at: 0.5 }, open), null, 'a knob was turned on a pedal whose sheet is not open')
    assert.equal(watchCommand({ do: 'knob', id: 50, key: '11', at: 0.5 }, offered), null, 'a knob was turned with no sheet open')
    for (const bad of [{ at: 1.01 }, { at: -0.01 }, { at: NaN }, { at: Infinity }, { at: '0.5' }, { at: null }, { at: undefined }, { key: 11 }, { key: null }, { id: '50' }, { id: null }]) {
      assert.equal(watchCommand({ do: 'knob', id: 50, key: '11', at: 0.5, ...bad }, open), null, JSON.stringify(bad))
    }
    /* A picture whose knobs are not a list (never sent, but never trusted): refused. */
    assert.equal(watchCommand({ do: 'knob', id: 50, key: '11', at: 0.5 }, { quickEdit: true, quick: { id: 50, knobs: 'all' } }), null)
    assert.equal(watchCommand({ do: 'knob', id: 50, key: '11', at: 0.5 }, { quickEdit: true, quick: 'open' }), null)

    /* NOTHING ELSE FROM THE WRIST: no model, no on or off of its own, no save, no value by number. */
    for (const no of ['save', 'model', 'type', 'param', 'value', 'level', 'edit', 'store', 'bypass', 'enum']) {
      assert.equal(watchCommand({ do: no, id: 50, key: '11', at: 0.5, value: 5 }, open), null, `the watch may ask for “${no}”`)
    }
  })

  test('watch quick edit: the words under the pedals say quick edit only where it is offered, in a guitarist’s words', async () => {
    const { watchHoldLine, WATCH_HOLD_CHANNELS, WATCH_HOLD_QUICK } = await link()
    assert.equal(WATCH_HOLD_QUICK, 'Hold a pedal for quick edit.')
    assert.equal(WATCH_HOLD_CHANNELS, 'Hold a pedal for its channels.', 'today’s words moved: they are what every watch says where quick edit is not offered')
    assert.equal(watchHoldLine(true), WATCH_HOLD_QUICK)
    for (const no of [false, null, undefined, 1, 'yes']) assert.equal(watchHoldLine(no), WATCH_HOLD_CHANNELS, String(no))
    for (const line of [WATCH_HOLD_QUICK, WATCH_HOLD_CHANNELS]) {
      assert.ok(!/this (phone|iPhone|device|watch)/i.test(line), `“${line}” says this phone`)
      assert.ok(!/\b(beta|tried|tested|official|certified|approved|parameter|param|encoder)\b/i.test(line), `“${line}” is not a guitarist’s word`)
    }
    /* The mockup he picked is on record, with the day and his words (docs/watch, as the tuner's is). */
    const png = readFileSync(new URL('../docs/watch/quick-edit-list.png', import.meta.url))
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'quick-edit-list.png is not a picture')
    const note = read('docs/watch/README.md')
    assert.match(note, /!\[[^\]]*\]\(quick-edit-list\.png\)/)
    assert.match(note, /`quick-edit-list\.png` is the mockup Justin picked on 12 November 2026/)
    assert.ok(note.includes('"For the watch, mock up B."'))
    for (const words of [`"${WATCH_HOLD_QUICK}"`, `"${WATCH_HOLD_CHANNELS}"`, 'No Level row']) assert.ok(note.includes(words), `docs/watch/README.md does not say ${words}`)
    /* The phone's own Play says the same thing of its own hold (lib/holdPop). */
    assert.match(read('mobile/src/lib/holdPop.js'), /^export const HOLD_FOR_QUICK_EDIT = 'Hold for quick edit'$/m)
    /* And the phone's watch tips still promise no hold: they reach every phone by an update, and a watch from before the build cannot do it. */
    const bridge = read('mobile/src/lib/watchBridge.js')
    const tips = bridge.slice(bridge.indexOf('export const WATCH_HOW_OPEN'), bridge.indexOf('/** A watch is paired with this phone'))
    assert.ok(tips.length > 500 && !/quick edit|\bknob/i.test(code(tips)), 'the phone’s watch tips promise quick edit, which no watch out today can do')
  })

  test('watch quick edit: a turned knob’s number is written as Edit writes it, by one rule on both sides', async () => {
    const { watchKnobAt, watchKnobValue, watchKnobText, watchKnobWait, WATCH_KNOB_MS, WATCH_KNOB_SETTLE_MS, WATCH_KNOBS_ASK_MS, WATCH_KNOBS_ASKS } = await link()
    const { fromNormalized } = await import('../src/lib/scale.js')

    /* THE WORDS: Edit's own `fmt` (components/Knob), run from its source, then the unit after a space as the box under a knob has it. */
    const knob = read('mobile/src/components/Knob.js')
    const body = /export function fmt\(n\) \{([\s\S]*?)\n\}/.exec(knob)?.[1]
    assert.ok(body, 'Edit’s fmt is not where this test reads it (components/Knob.js)')
    const fmt = new Function('n', body)
    assert.match(read('mobile/src/screens/Edit.js'), /value=\{field \? field\.typed : `\$\{fmt\(value\)\}\$\{param\?\.unit \? ` \$\{param\.unit\}` : ''\}`\}/, 'the box under a knob no longer writes the value and then the unit')
    for (const v of [0, 5, 6.2, -3, 100, 999.994, 1000, 1234.5, 20000, -1234.5, 0.004, -0.004, 3.333, 632.456, 0.12, 47.9]) {
      assert.equal(watchKnobText(v), fmt(v), `the watch writes ${v} another way than Edit does`)
      assert.equal(watchKnobText(v, 'dB'), `${fmt(v)} dB`)
      assert.equal(watchKnobText(v, ''), fmt(v))
    }
    for (const none of [null, undefined, '5', NaN, Infinity, {}]) assert.equal(watchKnobText(none), '—', String(none))
    assert.equal(watchKnobText(null, 'Hz'), '— Hz')

    /* THE VALUE: Edit's own scale, rounded as Edit's knob rounds what it sends (Math.round(v * 1000) / 1000). */
    assert.match(knob, /function round3\(v\) \{\s+return Math\.round\(v \* 1000\) \/ 1000\s+\}/)
    assert.match(knob, /const v = round3\(fromNormalized\(next, p\)\)/)
    const params = [{ min: 0, max: 10 }, { min: -80, max: 20 }, { min: 20, max: 20000, log: true }, { min: 0, max: 10, log: true }, { min: 0.01, max: 100, log: true }, { min: -12, max: 12 }, { min: 0, max: 1 }]
    for (const p of params) {
      for (let i = 0; i <= 1000; i += 7) {
        const at = i / 1000
        assert.equal(watchKnobValue(at, p), Math.round(fromNormalized(at, p) * 1000) / 1000, `${at} of ${JSON.stringify(p)}`)
      }
    }
    /* Past either end is the end; no range is no value. */
    assert.equal(watchKnobValue(4, { min: 0, max: 10 }), 10)
    assert.equal(watchKnobValue(-4, { min: 0, max: 10 }), 0)
    for (const p of [{}, { min: 0 }, { max: 10 }, { min: 3, max: 3 }, { min: 5, max: 1 }, { min: '0', max: 10 }, undefined]) assert.equal(watchKnobValue(0.5, p), null, JSON.stringify(p))
    assert.equal(watchKnobValue(NaN, { min: 0, max: 10 }), null)

    /* A PLACE: 0 to 1, to three figures, and nought for nothing. */
    assert.equal(watchKnobAt(0.62), 0.62)
    assert.equal(watchKnobAt(0.12345), 0.123)
    assert.equal(watchKnobAt(0.9996), 1)
    assert.equal(watchKnobAt(7), 1)
    assert.equal(watchKnobAt(-7), 0)
    for (const none of [NaN, null, undefined, '0.5']) assert.equal(watchKnobAt(none), 0, String(none))

    /* THE PACE: a turn at most every tenth of a second, the watch's own number for a second and a half after the last, and a sheet not yet answered asked again, a few times. */
    assert.equal(WATCH_KNOB_MS, 100)
    assert.equal(WATCH_KNOB_SETTLE_MS, 1500)
    assert.equal(WATCH_KNOBS_ASK_MS, 2500)
    assert.equal(WATCH_KNOBS_ASKS, 4)
    assert.equal(watchKnobWait(null, 1000), 0)
    assert.equal(watchKnobWait(1000, 1000), 100)
    assert.equal(watchKnobWait(1000, 1040), 60)
    assert.equal(watchKnobWait(1000, 1100), 0)
    assert.equal(watchKnobWait(1000, 9000), 0)
    assert.equal(watchKnobWait(1050, 1000), 100, 'a clock put back holds a turn for longer than a tenth of a second')
    /* The asking is over before the phone gives up on a sheet it has heard nothing from, and that is longer than two of the watch's check-ins. */
    const r = await rules()
    const { WATCH_HERE_MS, WATCH_HERE_TICK_MS } = await link()
    assert.equal(r.WATCH_QUICK_IDLE_MS, 60000)
    assert.ok(r.WATCH_QUICK_IDLE_MS >= 2 * (WATCH_HERE_MS + WATCH_HERE_TICK_MS), 'an open sheet’s knobs are let go between two of the watch’s check-ins')
    assert.ok(WATCH_KNOBS_ASK_MS * WATCH_KNOBS_ASKS < r.WATCH_QUICK_IDLE_MS)
  })

  test('watch quick edit: the knobs listed are the first ones Edit’s panel draws, and never a Level', async () => {
    const r = await rules()
    const { editPages, isSilencingParam, toNormalized } = await edits()
    const { watchKnobText } = await link()
    const list = (got, max) => r.quickParams(got, { pages: editPages, silencing: isSilencingParam, max })

    /* No editor pages (an older unit): Edit's own order, with the level, the routing control and the knob with no range left out. */
    assert.deepEqual(list(DRIVE(), 8).map((p) => p.name), ['Drive', 'Tone', 'Mix', 'Low Cut'])
    assert.ok(!list(DRIVE(), 8).some((p) => /level/i.test(p.name)), 'a block’s Level is a knob on the wrist')
    /* Capped, from the front. */
    assert.deepEqual(list(DRIVE(), 2).map((p) => p.name), ['Drive', 'Tone'])
    const big = { named: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `Knob ${i + 1}`, value: 1, min: 0, max: 10 })) }
    assert.deepEqual(list(big, 8).map((p) => p.id), [1, 2, 3, 4, 5, 6, 7, 8], 'the cap takes knobs from somewhere other than the front of Edit’s first pages')
    /* Nothing read, or nothing to list: none, never a throw. */
    for (const none of [null, undefined, {}, { named: 'x' }, { named: [] }, { named: [null] }, { named: [{ id: 13, name: 'Level', value: -3, min: -80, max: 20 }] }]) assert.deepEqual(list(none, 8), [], JSON.stringify(none))

    /* WITH THE UNIT'S OWN PAGES (lib/editPages): the page order and the captions, the meters and the last page of extras left out, a knob on two pages listed once. */
    const paged = {
      slug: 'amp',
      named: [
        { id: 1, name: 'Input Drive', value: 5, min: 0, max: 10 },
        { id: 2, name: 'Bass 3', value: 5, min: 0, max: 10 },
        { id: 3, name: 'Level', value: -6, min: -80, max: 20, unit: 'dB' },
        { id: 4, name: 'Gain Meter', value: 1, min: 0, max: 10 },
        { id: 5, name: 'Presence', value: 5, min: 0, max: 10 },
        { id: 6, name: 'Left Out', value: 1, min: 0, max: 10 },
        { id: 7, name: 'Mix', value: 100, min: 0, max: 100, unit: '%' }
      ],
      layout: {
        family: 'AMP',
        pages: [
          { name: 'Tone', rows: [{ section: 'parameters', controls: [{ paramId: 2, label: 'Bass', paramName: 'AMP_BASS' }, { paramId: 1, label: 'Gain', paramName: 'AMP_GAIN' }, { paramId: 4, label: 'Gain', paramName: 'AMP_METER', widget: 'meter' }, { paramId: 3, label: 'Level', paramName: 'AMP_LEVEL' }] }, { section: 'mixer', controls: [{ paramId: 7, label: 'Mix', paramName: 'AMP_MIX' }] }] },
          { name: 'Power Amp', rows: [{ section: 'parameters', controls: [{ paramId: 5, label: 'Presence', paramName: 'AMP_PRESENCE' }, { paramId: 2, label: 'Bass', paramName: 'AMP_BASS' }] }] }
        ]
      }
    }
    const got = list(paged, 8)
    assert.deepEqual(got.map((p) => p.id), [2, 1, 5, 7], 'not Edit’s pages in Edit’s order, each knob once, with the meter, the Level and the extras left out')
    assert.deepEqual(got.map((p) => p.label), ['Bass', 'Gain', 'Presence', 'Mix'], 'the knobs are not called what Edit calls them')
    /* The very list Edit's own pages give, flattened: nothing listed that Edit would not draw. */
    const drawn = editPages(paged.named.filter((p) => !isSilencingParam(p.name)), paged.layout).filter((pg) => pg.key !== 'hidden').flatMap((pg) => pg.params.map((p) => p.id))
    assert.deepEqual(got.map((p) => p.id), [...new Set(drawn)])

    /* ONE KNOB FOR THE PICTURE: Edit's name, Edit's words, its place by Edit's scale, and its range. */
    const kn = (p, value = p.value) => r.quickKnob(p, value, { toNormalized, text: watchKnobText })
    assert.deepEqual(kn(got[0]), { key: '2', name: 'Bass', text: '5.00', at: 0.5, min: 0, max: 10, log: false, unit: '' })
    assert.deepEqual(kn(DRIVE().named[4], 632.456), { key: '15', name: 'Low Cut', text: '632.46 Hz', at: toNormalized(632.456, DRIVE().named[4]), min: 20, max: 20000, log: true, unit: 'Hz' })
    assert.ok(Math.abs(kn(DRIVE().named[4], 632.456).at - 0.5) < 0.0001)
    assert.equal(kn({ id: 9, name: 'Odd', value: 5, min: 0, max: 10, log: true }).log, false, 'a logarithmic scale from nought is not one, by Edit’s own test')
    /* A value the wrist has asked for is the one shown. */
    assert.equal(kn(got[0], 8).text, '8.00')
    assert.equal(kn(got[0], 8).at, 0.8)
  })

  test('watch quick edit: opening a sheet reads the block once, a turn is Edit’s checked write and its read back, and closing lets go', async () => {
    const { unit, quick } = await bench()
    assert.equal(quick.now(), null)
    assert.equal(quick.openOn(), null)

    const opening = quick.open(50)
    assert.equal(quick.openOn(), 50)
    assert.equal(quick.now(), null, 'knobs are in the picture before the unit has answered')
    await opening
    assert.equal(unit.reads, 1)
    assert.deepEqual(quick.now().knobs.map((k) => [k.key, k.name, k.text]), [['11', 'Drive', '6.20'], ['12', 'Tone', '5.00'], ['14', 'Mix', '100.00 %'], ['15', 'Low Cut', '20.00 Hz']])
    assert.equal(quick.now().id, 50)
    assert.ok(unit.changes >= 2, 'the picture is not sent again when the knobs arrive')
    assert.deepEqual(unit.writes, [], 'opening a sheet wrote something')
    assert.equal(unit.edited, 0)

    /* A TURN: shown at once as asked, then written, marked as an edit, and read back. */
    let hold
    unit.hold = new Promise((done) => (hold = done))
    const turning = quick.turn(50, '11', 0.8)
    assert.equal(quick.now().knobs[0].text, '8.00', 'the wrist’s own turn is not shown until the unit answers')
    assert.equal(quick.now().knobs[0].at, 0.8)
    await settle()
    assert.deepEqual(unit.writes, [{ id: 50, param: 11, value: 8 }])
    /* More turns while that one is out: only the newest waits, as a knob under a thumb. */
    quick.turn(50, '11', 0.81)
    quick.turn(50, '11', 0.82)
    quick.turn(50, '11', 0.9)
    assert.equal(quick.now().knobs[0].text, '9.00')
    hold()
    unit.hold = null
    await turning
    assert.deepEqual(unit.writes.map((w) => w.value), [8, 9], 'every turn was written, or the last one was not')
    assert.equal(unit.edited, 2, 'a turn from the wrist is not the preset’s unsaved change, as a knob turned in Edit is')
    assert.equal(unit.reads, 3, 'a turn is not read back from the unit')
    assert.equal(quick.now().knobs[0].text, '9.00')

    /* Where it already is, with nothing out: nothing sent. */
    await quick.turn(50, '11', 0.9)
    assert.equal(unit.writes.length, 2)
    /* A knob the sheet does not list (a Level's key, another pedal's): nothing. */
    assert.equal(quick.turn(50, '13', 0.1), undefined)
    assert.equal(quick.turn(70, '11', 0.1), undefined)
    assert.equal(unit.writes.length, 2, 'a knob that was never listed was written')

    /* THE UNIT WOULD NOT TAKE IT: logged, and the picture says what the unit holds. */
    unit.refuse = true
    await quick.turn(50, '12', 1)
    assert.ok(unit.log.some((l) => /did not take/.test(l)))
    assert.equal(quick.now().knobs[1].text, '5.00', 'a turn the unit refused is still shown as taken')
    unit.refuse = false

    /* CLOSING: the knobs are let go. */
    quick.close()
    assert.equal(quick.now(), null)
    assert.equal(quick.openOn(), null)
    assert.equal(quick.turn(50, '11', 0.1), undefined)
    assert.equal(unit.writes.length, 3, 'a turn was written with no sheet open')
  })

  test('watch quick edit: a turn never lands on another scene’s, channel’s or preset’s block, and the sheet reads again when the block moves', async () => {
    const { unit, quick } = await bench()
    await quick.open(50)

    /* A turn waiting behind another when the channel changes: dropped, never written to the new channel. */
    let hold
    unit.hold = new Promise((done) => (hold = done))
    const first = quick.turn(50, '11', 0.3)
    await settle()
    quick.turn(50, '11', 0.4)
    unit.sig = 'p12:s1:r0:C'
    hold()
    unit.hold = null
    await first
    assert.deepEqual(unit.writes.map((w) => w.value), [3], 'a turn made on channel B was written to channel C')
    assert.ok(unit.log.some((l) => /the block changed first/.test(l)))

    /* Play draws again: the block is not what was read, so it is read again, with nothing of the old one shown meanwhile. */
    const reads = unit.reads
    unit.block.named[0].value = 2
    const again = quick.follow(true)
    assert.equal(quick.now(), null, 'the old channel’s knobs are still in the picture while the new one is read')
    await again
    assert.equal(unit.reads, reads + 1)
    assert.equal(quick.now().knobs[0].text, '2.00')
    /* Nothing moved: nothing read. */
    assert.equal(quick.follow(true), undefined)
    assert.equal(unit.reads, reads + 1, 'the block is read again every time Play draws')

    /* A scene, and the preset loaded again: the same. */
    for (const sig of ['p12:s2:r0:C', 'p12:s2:r1:C']) {
      unit.sig = sig
      const before = unit.reads
      await quick.follow(true)
      assert.equal(unit.reads, before + 1, sig)
    }

    /* A read that answers after a newer one was asked is nobody's. */
    let gate
    unit.gate = new Promise((done) => (gate = done))
    unit.sig = 'p12:s3:r1:C'
    const slow = quick.follow(true)
    unit.sig = 'p12:s4:r1:C'
    const newer = quick.follow(true)
    unit.block.named[0].value = 7
    gate()
    unit.gate = null
    await Promise.all([slow, newer])
    assert.equal(quick.now().knobs[0].text, '7.00')

    /* THE PEDAL GONE (another preset without it), or quick edit no longer offered: let go, and nothing read. */
    const kept = unit.reads
    unit.sig = null
    quick.follow(true)
    assert.equal(quick.now(), null)
    assert.equal(quick.openOn(), null)
    assert.equal(unit.reads, kept)
    unit.sig = 'p13:s0:r2:A'
    await quick.open(50)
    quick.follow(false)
    assert.equal(quick.openOn(), null, 'the knobs are kept where quick edit is no longer offered, or the pedal is no longer drawn')

    /* A sheet opened on a pedal that is not there: nothing read, an empty list. */
    unit.sig = null
    const none = unit.reads
    await quick.open(50)
    assert.equal(unit.reads, none)
    assert.deepEqual(quick.now(), { id: 50, knobs: [] })
  })

  test('watch quick edit: a block that cannot be read is its channels alone, and a sheet nobody is looking at is let go', async () => {
    /* The read fails: an empty list, said in the log, and no throw. */
    const failed = await bench({ failRead: true })
    await failed.quick.open(50)
    assert.deepEqual(failed.quick.now(), { id: 50, knobs: [] })
    assert.ok(failed.unit.log.some((l) => /could not read the knobs/.test(l)))

    /* A block the wire has no knobs for (lib/holdPop popKnobsFor): not read at all. */
    const { unit, quick } = await bench()
    unit.readable = false
    await quick.open(50)
    assert.equal(unit.reads, 0, 'a block with no knobs to read was read')
    assert.deepEqual(quick.now(), { id: 50, knobs: [] })

    /* NOTHING HEARD FROM THE WATCH FOR A MINUTE (the wrist down, or the app closed with the sheet open): let go, so nothing is read again for nobody. */
    unit.readable = true
    await quick.open(50)
    unit.now += 59000
    quick.follow(true)
    assert.equal(quick.openOn(), 50)
    unit.now += 2000
    quick.follow(true)
    assert.equal(quick.openOn(), null, 'an open sheet’s knobs are kept, and read again at every scene, with no watch looking at them')
    /* Anything the watch says keeps it: its check-in comes every twenty seconds. */
    await quick.open(50)
    for (let i = 0; i < 10; i++) {
      unit.now += 22000
      quick.heard()
      quick.follow(true)
    }
    assert.equal(quick.openOn(), 50, 'a sheet the watch is still on was let go')
  })

  test('watch quick edit: it is joined to the unit by Edit’s own read and Edit’s own checked write, and by nothing else', async () => {
    const wired = read('mobile/src/lib/watchQuickEdit.js')
    const src = code(wired)
    /* The only things it takes from lib/device, which is the only way to the unit. */
    assert.match(src, /import \{ blockParams, sameBlock, setParamConfirmed \} from '\.\/device'/, 'quick edit reaches the unit by something other than Edit’s read and Edit’s checked write')
    assert.match(src, /read: \(id\) => blockParams\(id\),/)
    assert.match(src, /write: \(id, p, value\) => setParamConfirmed\(id, p\.id, value, p\),/)
    assert.match(src, /edited: noteEdited,/)
    assert.doesNotMatch(src, /remoteRequest|setType|setEnum|setBypass|setChannel|setScene|selectPreset|savePreset|parkSave|setParam\(|writeBypass|writeChannel|bluetoothWire|bleWire/, 'quick edit can send something Edit’s knobs cannot: a model, an on or off, a channel, a save, or a write nobody reads back')
    assert.deepEqual(
      [...src.matchAll(/^import [\s\S]*?from '([^']+)'/gm)].map((m) => m[1]).sort(),
      ['./debugLog', './device', './editPages', './guardrails', './knob-keys', './rig', './scale', './watch-link', './watchPages', './watchQuick'],
      'lib/watchQuickEdit imports something new: say here what it is for'
    )
    assert.match(src, /import \{ getState, noteEdited \} from '\.\/rig'/)
    /* What is listed is Edit's: its pages over its own list with the levels and the routing out, capped by the protocol's own number. */
    assert.match(src, /params: \(read\) => quickParams\(read, \{ pages: editPages, silencing: isSilencingParam, max: WATCH_QUICK_MAX \}\),/)
    /* A turn's value is Edit's scale, rounded as Edit's knob rounds it; the words are the one rule both sides write by. */
    assert.match(src, /const valueAt = \(p, at\) => Math\.round\(fromNormalized\(at, p\) \* 1000\) \/ 1000/)
    assert.match(src, /knob: \(p, value\) => quickKnob\(p, value, \{ toNormalized, text: watchKnobText \}\),/)
    assert.match(src, /oneAtATime: oneWriteAtATime,/)
    /* What a block is: the preset, the scene, a reload and its channel, as Play's own pop-up reads its knobs again for. */
    assert.match(src, /return block \? `\$\{s\.preset\?\.number\}:\$\{s\.sceneIndex\}:\$\{s\.bufferRev\}:\$\{block\.channel \|\| ''\}` : null/)
    assert.match(read('mobile/src/components/PopKnobs.js'), /key=\{`\$\{eid\}:\$\{block\.channel \|\| ''\}:\$\{scene\}:\$\{bufferRev\}`\}/)
    assert.match(src, /readable: \(id\) => blockOf\(id\)\?\.knobs !== false,/)
    /* NOTHING TO A WATCH THAT HAS NOT SAID SO, and no knobs where quick edit is not offered. */
    assert.match(src, /export const quickToSend = \(offered\) => \(watchKnowsQuick\(\) \? \{ quickEdit: offered === true, quick: offered === true \? quick\.now\(\) : null \} : null\)/)
    assert.match(flat(wired), /export function quickFollows\(offered, pedals\) \{ const id = quick\.openOn\(\) if \(id === null\) return quick\.follow\(offered === true && \(pedals \|\| \[\]\)\.some\(\(p\) => p\.id === id\)\) \}/)

    /* AND BOTH OF THOSE ARE MARKED AS EDIT'S in lib/device, which is what holds every frame over Bluetooth or a cable (bleWire's guards) and keeps them behind Edit's door there. */
    const device = code(read('mobile/src/lib/device.js'))
    assert.match(device, /const EDITING = Object\.freeze\(\{ editing: true \}\)/)
    assert.match(device, /export const blockParams = async \(eid\) => fixRead\(await remoteRequest\(`\/preset\/blocks\/\$\{eid\}\/params`, EDITING\)\)/, 'Edit’s read of a block is no longer marked as Edit’s')
    const checked = device.slice(device.indexOf('export async function setParamConfirmed('))
    assert.match(checked, /put\(`\/preset\/blocks\/\$\{eid\}\/params\/\$\{paramId\}`, \{ value: norm, continuous \}, EDITING\)/, 'Edit’s checked write of a knob is no longer marked as Edit’s')
    assert.equal((checked.match(/\bput\(/g) || []).length, 1, 'the checked write sends by a second way this test has not read')
    /* The hold pop-up's knobs go by the same two (Edit's BlockPanel), so the wrist and the screen are one path. */
    const edit = code(read('mobile/src/screens/Edit.js'))
    assert.match(edit, /blockParams\(eid\),/)
    assert.match(edit, /const res = await setParamConfirmed\(eid, p\.id, next, p\)/)
    assert.match(edit, /const editable = params\.filter\(\(p\) => !isSilencingParam\(p\.name\)\)/)

    /* THE BRIDGE: both requests through the one door, behind the wait a woken phone makes for its link; the sheet closing needs none. */
    const bridge = flat(read('mobile/src/lib/watchBridge.js'))
    assert.match(bridge, /import \{ onQuickChange, quickAsked, quickFollows, quickHeard, quickToSend \} from '\.\/watchQuickEdit'/)
    const runs = bridge.slice(bridge.indexOf('const run = () => {'), bridge.indexOf('if (!asleep) {'))
    assert.match(runs, /if \(cmd\.do === 'knobs' \|\| cmd\.do === 'knob'\) return quickAsked\(cmd\)/)
    assert.ok(bridge.indexOf("if (cmd.do === 'knobs' && cmd.id === null) { quickAsked(cmd) return }") > 0 && bridge.indexOf("if (cmd.do === 'knobs' && cmd.id === null)") < bridge.indexOf('const run = () => {'), 'a sheet closing waits for a woken phone’s link, and is dropped when it does not come')
    assert.equal((bridge.match(/quickAsked\(/g) || []).length, 2, 'quick edit is asked from somewhere else in the bridge')
    /* Checked against the last picture before anything else, as every request is. */
    assert.ok(bridge.indexOf('const cmd = watchCommand(msg, last.current) if (!cmd) return') < bridge.indexOf('quickHeard()'))
    assert.match(bridge, /if \(!cmd\) return quickHeard\(\)/)
    /* The picture: Play's answer taken out of what the stage hands over and sent only through quickToSend; the knobs kept only while it is offered and the pedal is drawn. */
    assert.match(bridge, /const \{ chain, channels, awake: seen, quickEdit, \.\.\.rest \} = picture/)
    assert.match(bridge, /tempo, quickOffered: quickEdit === true \} quickFollows\(quickEdit === true, pedals\) const state = pictured\(lastFrom\.current\)/)
    assert.doesNotMatch(bridge, /[{,]\s*quick(Edit)?: /, 'quick edit is put in the picture by hand, past the question of whether this watch knows it')
    /* And knobs that moved without Play drawing go out by the same one function, and stop when Play's bridge goes. */
    assert.match(bridge, /onQuickChange\(\(\) => \{ if \(!lastFrom\.current \|\| !sender\.current\) return last\.current = pictured\(lastFrom\.current\) sender\.current\.push\(last\.current\) \}\)/)
    assert.match(bridge, /sub\?\.remove\?\.\(\) onQuickChange\(null\)/)
  })

  test('watch quick edit: the watch’s half is in the patch that waits for a build, with mockup B’s sheet and the phone’s own rules', async () => {
    const { WATCH_KNOWS, WATCH_HOLD_CHANNELS, WATCH_HOLD_QUICK, WATCH_KNOB_MS, WATCH_KNOB_SETTLE_MS, WATCH_KNOBS_ASK_MS, WATCH_KNOBS_ASKS } = await link()
    const patched = /\bvar quickEdit: Bool\? = nil/.test(read('mobile/targets/watch/Model.swift'))
    const patch = read('docs/pending/watch-page-order.patch')
    /* The lines the patch adds to a file, or the file itself where the patch is in (web.yml's second run, and the build pull request). */
    const swift = (file) => {
      if (patched) return read(file)
      const from = patch.indexOf(`diff --git a/${file} b/${file}`)
      assert.ok(from >= 0, `the waiting patch does not carry ${file}`)
      const next = patch.indexOf('\ndiff --git ', from + 1)
      return patch
        .slice(from, next < 0 ? undefined : next)
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1))
        .join('\n')
    }
    if (!patched) {
      /* The tree as main has it: none of the watch's half, so its line of the fingerprint is where it was. */
      for (const f of ['Model.swift', 'Pages.swift', 'PhoneLink.swift']) {
        assert.doesNotMatch(read(`mobile/targets/watch/${f}`), /quickEdit|WatchKnob|QuickSheet|"quick"/, `part of quick edit’s watch half is in the tree (${f}), which moves the watch’s fingerprint`)
      }
      assert.match(read('docs/pending/README.md'), /^\| `watch-page-order\.patch` \|[^\n]*quick edit/m, 'docs/pending’s table does not say the watch’s patch carries quick edit')
    }
    const model = swift('mobile/targets/watch/Model.swift')
    const flatModel = model.replace(/\s+/g, ' ')
    const pages = swift('mobile/targets/watch/Pages.swift')
    const drawn = pages.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')

    /* IT SAYS IT KNOWS, in the phone's words, and reads both fields as optional: one missing never loses the picture. */
    assert.ok(model.includes(`case .hello: return #"{"do":"hello","knows":[${WATCH_KNOWS.map((k) => `"${k}"`).join(',')}]}"#`), 'the watch’s hello does not say what the phone listens for')
    assert.ok(model.includes(`static let knows = [${WATCH_KNOWS.map((k) => `"${k}"`).join(', ')}]`))
    assert.match(model, /var quickEdit: Bool\? = nil/)
    assert.match(model, /var quick: WatchQuick\? = nil/)
    assert.match(flatModel, /struct WatchQuick: Codable, Equatable \{ var id: Int var knobs: \[WatchKnob\]\? = nil \}/)
    for (const field of ['key: String', 'at: Double', 'name: String? = nil', 'text: String? = nil', 'min: Double? = nil', 'max: Double? = nil', 'log: Bool? = nil', 'unit: String? = nil']) {
      assert.ok(new RegExp(`struct WatchKnob: Codable, Equatable \\{[^}]*\\bvar ${field.replace(/[?.]/g, '\\$&')}\\b`).test(model), `the watch does not read a knob’s ${field}`)
    }
    /* THE TWO REQUESTS, in the phone's words; neither is ever tried a second time. */
    assert.ok(model.includes('return #"{"do":"knobs","id":\\#(which)}"#'), 'the watch cannot ask for a pedal’s knobs')
    assert.ok(model.includes('let which = id.map { String($0) } ?? "null"'))
    assert.ok(model.includes('case .knob(let id, let key, let at): return #"{"do":"knob","id":\\#(id),"key":\\#(jsonText(key)),"at":\\#(watchKnobAt(at))}"#'), 'the watch cannot turn a knob')
    assert.match(flatModel, /var once: Bool \{ switch self \{ case \.tap, \.here, \.knobs, \.knob: return true default: return false \} \}/, 'a turn that did not go is tried again a second later, over a newer one')

    /* THE WORDS, the phone's own, and which is said. */
    assert.ok(flatModel.includes(`enum PedalWords { static let channels = "${WATCH_HOLD_CHANNELS}" static let quick = "${WATCH_HOLD_QUICK}" }`), 'the watch’s words under its pedals are not the phone’s')
    assert.match(flatModel, /func pedalHoldLine\(quickEdit: Bool\?\) -> String \{ quickEdit == true \? PedalWords\.quick : PedalWords\.channels \}/)
    assert.equal((drawn.match(/Text\(pedalHoldLine\(quickEdit: state\.quickEdit\)\)\.font\(\.footnote\)\.foregroundStyle\(\.secondary\)/g) || []).length, 2, 'the line under the pedals is not the rule’s on both shapes of the page')
    assert.doesNotMatch(drawn, /Text\("Hold a pedal/, 'the line under the pedals is written out, whatever the iPhone offers')

    /* THE RULES, each the phone's in the phone's steps (pages.json holds their answers). */
    assert.match(flatModel, /func watchKnobAt\(_ x: Double\) -> Double \{ guard x\.isFinite else \{ return 0 \} return \(min\(1, max\(0, x\)\) \* 1000 \+ 0\.5\)\.rounded\(\.down\) \/ 1000 \}/)
    assert.match(
      flatModel,
      /func watchKnobValue\(at: Double, low: Double\?, high: Double\?, curved: Bool\?\) -> Double\? \{ guard at\.isFinite, let low, let high, low\.isFinite, high\.isFinite, high > low else \{ return nil \} let t = min\(1, max\(0, at\)\) let v: Double = \(curved == true && low > 0\) \? exp\(log\(low\) \+ t \* \(log\(high\) - log\(low\)\)\) : low \+ t \* \(high - low\) return \(v \* 1000 \+ 0\.5\)\.rounded\(\.down\) \/ 1000 \}/
    )
    assert.match(flatModel, /number = abs\(value\) >= 1000 \? String\(Int\(\(value \+ 0\.5\)\.rounded\(\.down\)\)\) : String\(format: "%\.2f", value\)/)
    assert.match(flatModel, /if let unit, !unit\.isEmpty \{ return "\\\(number\) \\\(unit\)" \} return number/)
    assert.ok(flatModel.includes(`let watchKnobSeconds: Double = ${WATCH_KNOB_MS / 1000}`))
    assert.ok(flatModel.includes(`let watchKnobSettle: Double = ${WATCH_KNOB_SETTLE_MS / 1000}`))
    assert.ok(flatModel.includes(`let watchKnobsAskSeconds: Double = ${WATCH_KNOBS_ASK_MS / 1000}`))
    assert.ok(flatModel.includes(`let watchKnobsAsks = ${WATCH_KNOBS_ASKS}`))
    assert.match(flatModel, /func watchKnobWait\(lastSent: Date\?, now: Date\) -> Double \{ guard let lastSent else \{ return 0 \} return max\(0, min\(watchKnobSeconds, watchKnobSeconds - now\.timeIntervalSince\(lastSent\)\)\) \}/)
    /* A row's number: the iPhone's words until the Crown is ahead of it, and then the rule's; never one made up for a knob with no range. */
    assert.match(flatModel, /func shown\(turned: Double\?\) -> String \{ guard let turned, let value = watchKnobValue\(at: turned, low: min, high: max, curved: log\) else \{ return text \?\? "" \} return watchKnobText\(value, unit: unit\) \}/)

    /* THE SHEET. Quick edit's only where the picture offers it; the channel picker, untouched, everywhere else. */
    assert.match(
      drawn,
      /if state\.quickEdit == true \{ QuickSheet\(pedal: pedal, lit: pendingChannel\[pedal\.id\] \?\? pedal\.channel, quick: watchQuickFor\(state\.quick, pedal: pedal\.id\)\) \{ name in choose\(name, for: pedal\) \} \.environmentObject\(link\) \} else \{ ChannelsSheet\(pedal: pedal, lit: pendingChannel\[pedal\.id\] \?\? pedal\.channel\) \{ name in choose\(name, for: pedal\) \} \.environmentObject\(link\)/,
      'the held pedal’s sheet is not today’s channel picker where quick edit is not offered'
    )
    /* The same hold, on the same pedals, and the same channel picker under the other branch: quick edit changes what opens where it is offered, never what can be held. (None of the three is the patch's to change, so they are read from the tree.) */
    const tree = read('mobile/targets/watch/Pages.swift').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')
    assert.match(tree, /private func hold\(_ pedal: WatchPedal\) \{ guard pedal\.canPickChannel else \{ return \}/)
    assert.match(tree, /including: pedal\.canPickChannel \? \.all : \.subviews/)
    assert.match(tree, /private struct ChannelsSheet: View \{ let pedal: WatchPedal let lit: String\? let pick: \(String\) -> Void/)
    assert.doesNotMatch(patch.split('\n').filter((l) => /^[-+]/.test(l)).join('\n'), /^-.*(private struct ChannelsSheet|Text\("CHANNEL"\)|minHeight: 44)/m, 'the waiting patch changes the channel picker itself')
    const sheet = drawn.slice(drawn.indexOf('private struct QuickSheet: View {'), drawn.indexOf('private struct KnobRow: View {'))
    assert.ok(sheet.length > 1500, 'the watch has no quick edit sheet')
    /* MOCKUP B: the name, the channels in ONE row (an HStack, never the two-column grid), the lit one green, then the knobs, a row each. */
    assert.match(sheet, /Text\(pedal\.name\) \.font\(\.system\(size: 15, weight: \.semibold\)\)/)
    assert.match(sheet, /HStack\(spacing: 4\) \{ ForEach\(pedal\.channels \?\? \[\], id: \\\.self\) \{ name in Button \{ pick\(name\) \} label:/)
    assert.doesNotMatch(sheet, /LazyVGrid/, 'the channels are in two rows of two, not one row of four')
    assert.match(sheet, /\.background\(name == lit \? signal : Color\.white\.opacity\(0\.14\), in: RoundedRectangle\(cornerRadius: 8\)\)/)
    assert.match(sheet, /ForEach\(knobs, id: \\\.key\) \{ knob in KnobRow\( knob: knob, value: knob\.shown\(turned: turned\[knob\.key\]\), on: knob\.key == picked\?\.key, tap: \{ choose\(knob\) \}, step: \{ by in move\(knob, to: place\(knob\) \+ by\) \} \) \}/)
    /* The first knob is picked when the sheet opens, and a tapped one while it is still listed. */
    assert.match(sheet, /private var picked: WatchKnob\? \{ watchKnobPicked\(knobs, chosen\) \}/)
    assert.match(flatModel, /func watchKnobPicked\(_ knobs: \[WatchKnob\], _ key: String\?\) -> WatchKnob\? \{ if let key, let chosen = knobs\.first\(where: \{ \$0\.key == key \}\) \{ return chosen \} return knobs\.first \}/)
    /* THE DIGITAL CROWN turns the picked knob: focusable, focused, and the Crown bound from nought to one. */
    assert.match(sheet, /\.focusable\(true\) \.focused\(\$crownOn\) \.digitalCrownRotation\(\$crown, from: 0, through: 1, sensitivity: \.low, isContinuous: false, isHapticFeedbackEnabled: true\)/)
    assert.match(sheet, /\.onChange\(of: crown\) \{ _, now in if let knob = picked \{ move\(knob, to: now\) \} \}/)
    /* A turn: nothing for a place the knob is already shown at (which is also what keeps the sheet's own setting of the Crown from being one), shown at once, sent now or after its tenth of a second, and never left unsent. */
    assert.match(sheet, /private func move\(_ knob: WatchKnob, to now: Double\) \{ let at = watchKnobAt\(now\) guard at != place\(knob\) else \{ return \} let key = knob\.key turned\[key\] = at/)
    assert.match(sheet, /let wait = watchKnobWait\(lastSent: lastSent, now: Date\(\)\) if wait <= 0 \{ send\(key\) \} else if owed == nil \{ owed = key/)
    assert.match(sheet, /guard turns == mine else \{ return \} sendUnsent\(\) turned = \[:\] went = \[:\]/, 'the iPhone’s numbers are never put back, or the last turn can be left unsent')
    assert.match(sheet, /private func send\(_ key: String\) \{ guard let at = turned\[key\] else \{ return \} lastSent = Date\(\) went\[key\] = at link\.send\(\.knob\(id: pedal\.id, key: key, at: at\)\) \}/)
    assert.equal((drawn.match(/link\.send\(\.knob\(/g) || []).length, 1, 'a turn is sent from somewhere that does not pace it')
    /* It asks for the knobs when it opens, again while unanswered, and says when it closes, with the last turn sent first. */
    assert.match(sheet, /private func askForKnobs\(\) \{ guard quick == nil else \{ return \} guard asksLeft > 0 else \{ waiting = false return \} asksLeft -= 1 link\.send\(\.knobs\(id: pedal\.id\)\)/)
    assert.match(sheet, /\.onDisappear \{ sendUnsent\(\) link\.send\(\.knobs\(id: nil\)\) \}/)
    assert.equal((drawn.match(/link\.send\(\.knobs\(/g) || []).length, 2)
    /* Nothing else is asked of the phone from the sheet: a channel is still the page's own choose(). */
    assert.equal((sheet.match(/link\.send\(/g) || []).length, 3, 'the quick edit sheet asks the phone for something besides its knobs and a turn')
    /* Waiting says so in plain words; none, or a block that could not be read, is the channels alone. */
    assert.match(sheet, /\} else if waiting, quick == nil \{ Text\("Reading \\\(pedal\.name\)…"\)/)
    /* A row: the name left, the value right; picked, an amber outline and an amber value. */
    const rowFrom = drawn.indexOf('private struct KnobRow: View {')
    const rowEnd = drawn.indexOf('@unknown default: break', rowFrom)
    assert.ok(rowFrom > 0 && rowEnd > rowFrom, 'the knob’s row is not where this test reads it')
    const row = drawn.slice(rowFrom, rowEnd)
    assert.match(row, /Text\(knob\.name \?\? ""\)[^}]*Spacer\(minLength: 4\) Text\(value\)[^}]*\.foregroundStyle\(on \? amber : Color\.white\.opacity\(0\.8\)\)/)
    assert.match(row, /\.overlay\(RoundedRectangle\(cornerRadius: 8\)\.stroke\(amber, lineWidth: on \? 1\.5 : 0\)\)/)
    assert.match(pages, /private let amber = Color\(red: 0\.961, green: 0\.651, blue: 0\.137\)/)
    /* No word on the watch that is not a guitarist's, and never a save. */
    const said = [...drawn.slice(drawn.indexOf('private struct QuickSheet: View {'), rowEnd).matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((m) => m[1]).filter((w) => /[a-z]{3}/i.test(w))
    assert.deepEqual(said, ['Channel \\(name)', 'Reading \\(pedal.name)…'], 'the quick edit sheet says something this test has not read')
    assert.doesNotMatch(sheet + row, /\b(save|beta|tried|official)\b/i)

    /* CI's pictures: the sheet and the line, in the demo, which offers quick edit only when asked to. */
    assert.match(swift('mobile/targets/watch/PhoneLink.swift'), /if Launch\.flag\("quickDemo"\) \{ sample = sample\.quickDemo \}/)
    const shots = swift('mobile/watch-ci/screens.sh')
    assert.match(shots, /shoot -page 1 -quickDemo YES\nxcrun simctl io "\$UDID" screenshot "screens\/quick-line\.png"/)
    assert.match(shots, /shoot -page 1 -pick 50 -quickDemo YES\nsleep 3\nxcrun simctl io "\$UDID" screenshot "screens\/quick\.png"/)
    /* And the watch's own tests ask the fixture's questions. */
    const tests = swift('mobile/watch-ci/Tests/WatchModelTests/WatchModelTests.swift')
    for (const name of [
      'testTheLineUnderThePedalsSaysQuickEditOnlyWhereTheIPhoneOffersIt',
      'testTheQuickEditSheetReadsThePhonesKnobs',
      'testAKnobsNumberIsWrittenAsThePhoneWritesIt',
      'testTheCrownTurnsThePickedKnobAndATurnGoesAtMostTenTimesASecond',
      'testTheDemoAnswersQuickEditAsThePhoneWould'
    ]) {
      assert.ok(tests.includes(`func ${name}(`), `the watch’s own tests have no ${name}`)
    }
  })
}
