/**
 * What the app keeps away from a VP4, at both ends — run, not read, wherever
 * it can be.
 *
 * "I didn't know that those settings didn't work on the VP4. I thought that
 * they did, so yeah, if they don't, we need to put that in there for now."
 *
 * Nobody on the project has a VP4. On the computer apps out there now, the
 * chain read and a block's knobs send one the sweep that froze an AM4, and a
 * save writes over Y1 whatever slot was picked. These hold the phone and the
 * browser to never asking for any of it: the chain comes off GET /preset/grid
 * (the one record VP4-Edit itself polls), and a block's knobs and a save are
 * refused in words, before anything is sent or parked for the computer.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const repoUrl = (p) => new URL(`../${p}`, import.meta.url).href
const flat = (p) => read(p).replace(/\s+/g, ' ')

/* What a computer answers about a VP4, and about an FM3. */
const VP4_DETECT = { connected: true, modelId: 0x14, name: 'VP4', short: 'VP4', capabilities: { slotModel: 'linear', slotCount: 4 } }
const FM3_DETECT = { connected: true, modelId: 0x11, name: 'FM3', short: 'FM3', capabilities: { slotModel: 'grid', grid: { rows: 4, cols: 12 } } }
/* GET /preset/grid on a VP4: the chain in slot order, slot 2 empty. */
const VP4_GRID = {
  model: 'vp4',
  name: 'My Preset',
  crcValid: true,
  rows: 1,
  cols: 4,
  scenes: ['Clean', 'Crunch', 'Lead', 'Solo'],
  cells: [
    { row: 0, col: 0, effectId: 118, name: 'Drive', isShunt: false, routeFlag: 0, fromRows: [], slug: 'drive' },
    { row: 0, col: 2, effectId: 70, name: 'Delay', isShunt: false, routeFlag: 0, fromRows: [], slug: 'delay' },
    { row: 0, col: 3, effectId: 66, name: 'Reverb', isShunt: false, routeFlag: 0, fromRows: [], slug: 'reverb' }
  ],
  source: 'dump'
}

/** A pretend computer: `unit` is what it has plugged in; every request it is handed is written down. */
function pretendComputer() {
  const asked = []
  const state = { unit: VP4_DETECT }
  const answer = (method, path) => {
    asked.push(`${method} ${path}`)
    /* A computer's stored document, where a test hands one over (`state.docs`, by path). */
    if (state.docs && path in state.docs) return state.docs[path]
    if (path === '/device/detect' || path === '/device') return state.unit
    if (path === '/preset/grid') return VP4_GRID
    if (path === '/preset/blocks') return [{ slug: 'amp', name: 'Amp 1', effectId: 58, row: 1, col: 1, fromRows: [], bypassed: false, channel: 'A' }]
    if (/^\/preset\/blocks\/\d+\/params$/.test(path)) return { block: 'Amp 1', slug: 'amp', page: 0, named: [], enums: [], type: null }
    return { ok: true }
  }
  return { asked, state, answer }
}

/**
 * The phone's device layer, as it is, beside a pretend relay: Bluetooth off,
 * no demo. `relay.computer` is the pretend computer it talks to.
 */
async function phoneOnABench() {
  const dir = mkdtempSync(join(tmpdir(), 'vp4-phone-'))
  const lib = (f) => read(`mobile/src/lib/${f}`)
  const esm = (text) => text.replace(/from '\.\/([\w.-]+)'/g, (whole, name) => (/\.m?js$/.test(name) ? whole : `from './${name}.js'`))
  const files = {
    'package.json': '{ "type": "module" }',
    'relay.js':
      'export const computer = { answer: () => ({ ok: true }) }\n' +
      "export async function remoteRequest(path, options = {}) { return computer.answer(String(options.method || 'GET').toUpperCase(), path) }\n",
    'demo.js': 'export const demoDevice = () => null\n',
    'demoWire.js': "export const demoRequest = () => { throw new Error('no demo on this bench') }\n",
    'debugLog.js': 'export const logDebug = () => {}\n',
    'lineage.js': 'export const withLineage = (slug, x) => x\n'
  }
  for (const f of ['bleSwitch.js', 'tapGate.js', 'relay-rules.js', 'firmware.js', 'param-fixes.js', 'grid-plan.js', 'unit.mjs', 'slots.js', 'presetName.js', 'encoding.js', 'scale.js', 'metronome-rules.js', 'device-word.js', 'unsupported.js', 'vp4-safety.js', 'device.js']) {
    files[f] = esm(lib(f))
  }
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  const device = await import(at('device.js'))
  const relay = await import(at('relay.js'))
  const computer = pretendComputer()
  relay.computer.answer = computer.answer
  return { device, computer, done: () => rmSync(dir, { recursive: true, force: true }) }
}

/**
 * src/lib/forgefx.js as it is, over a pretend relay to a pretend computer —
 * the browser on a phone, which is the end that runs on an old computer's
 * relay the same way the phone app does.
 */
async function browserOnABench() {
  const dir = mkdtempSync(join(tmpdir(), 'vp4-browser-'))
  const remote = `
    export const computer = { answer: () => ({ ok: true }) }
    export const remoteActive = () => true
    export async function remoteRequest(path, options = {}) { return computer.answer(String(options.method || 'GET').toUpperCase(), path) }
    export const subscribeHostSeen = () => () => {}
    export const subscribeRemoteEvents = () => () => {}
    export const subscribeRemoteState = () => () => {}
  `
  let src = read('src/lib/forgefx.js')
  assert.ok(src.includes("from './remote.js'"), 'forgefx.js no longer imports remote.js; the bench needs telling')
  src = src
    .replace("from './remote.js'", "from './remote.mjs'")
    .replace(/from '\.\/([\w.-]+\.js)'/g, (whole, f) => `from '${repoUrl(`src/lib/${f}`)}'`)
    .replace(/from '\.\.\/\.\.\/([\w./-]+)'/g, (whole, f) => `from '${repoUrl(f)}'`)
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
  writeFileSync(join(dir, 'remote.mjs'), remote)
  writeFileSync(join(dir, 'forgefx.mjs'), src)
  try {
    const ffx = await import(pathToFileURL(join(dir, 'forgefx.mjs')).href)
    const relay = await import(pathToFileURL(join(dir, 'remote.mjs')).href)
    const computer = pretendComputer()
    relay.computer.answer = computer.answer
    return { ffx, computer }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * The phone's Save (mobile/src/components/SaveToSlot.js) as it is, its JSX
 * turned into calls by esbuild, the hook run once against stand-ins: `slug`
 * is the unit the rig says it is on, `demo` whether this is the demo. Every
 * request left for the computer, every save sent and every word said is
 * written down.
 */
async function phoneSaveOnABench({ slug = 'vp4', demo = false } = {}) {
  const { transformSync } = await import('esbuild')
  const dir = mkdtempSync(join(tmpdir(), 'vp4-save-'))
  const files = {
    'package.json': '{ "type": "module" }',
    'react.mjs': `
      export const h = (type, props, ...children) => ({ type, props: props || {}, children })
      export const Frag = 'frag'
      export const said = []
      export function useState(initial) { return [initial, (v) => { if (v && typeof v === 'object' && 'text' in v) said.push(v) }] }
      export const useRef = (current = null) => ({ current })
      export const useEffect = () => {}
    `,
    'device.mjs': `
      export const parked = []
      export const asked = []
      export const currentPreset = async () => { asked.push('GET /preset'); return { number: 5, name: 'My Preset' } }
      export const parkSave = async (slug, req) => { parked.push(req) }
      export const readSaveProgress = async () => null
      export const readSaveResult = async () => null
      export const saveInDemo = async (n) => { asked.push('demo save ' + n); return n }
    `,
    'demo.mjs': `export const isDemo = () => ${demo ? 'true' : 'false'}\n`,
    'saveViaComputer.mjs': `
      export const started = []
      export const startComputerSave = (o) => { started.push(o); return { done: Promise.resolve({ ok: true, slot: o.slot }), cancel: () => {} } }
    `,
    'rig.mjs': `
      export const onConfigDoc = () => () => {}
      export const savedToSlot = () => {}
      export const useRig = (pick) => pick({ preset: { number: 5, name: 'My Preset' }, deviceSlug: ${JSON.stringify(slug)} })
    `,
    'rest.mjs': 'export const font = {}\nexport const logDebug = () => {}\nexport default function Stub() { return null }\n'
  }
  let src = transformSync(read('mobile/src/components/SaveToSlot.js'), { loader: 'jsx', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Frag', format: 'esm' }).code
  const swaps = [
    ['from "react"', "from './react.mjs'"],
    ['from "../lib/theme"', "from './rest.mjs'"],
    ['from "../lib/debugLog"', "from './rest.mjs'"],
    ['from "../lib/device"', "from './device.mjs'"],
    ['from "../lib/demo"', "from './demo.mjs'"],
    ['from "../lib/saveViaComputer"', "from './saveViaComputer.mjs'"],
    ['from "../lib/vp4-safety"', `from '${repoUrl('shared/vp4-safety.mjs')}'`],
    ['from "../lib/save-wait"', `from '${repoUrl('shared/save-wait.mjs')}'`],
    ['from "../lib/device-word"', `from '${repoUrl('shared/device-word.mjs')}'`],
    ['from "../lib/rig"', "from './rig.mjs'"],
    ['from "./Note"', "from './rest.mjs'"],
    ['from "./Press"', "from './rest.mjs'"]
  ]
  for (const [from, to] of swaps) src = src.replaceAll(from, to)
  const left = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((m) => !m.endsWith('.mjs'))
  assert.deepEqual(left, [], 'SaveToSlot.js imports something the bench has no stand-in for')
  files['SaveToSlot.mjs'] = "import { h, Frag } from './react.mjs'\n" + src
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    const { useSaveToSlot } = await import(at('SaveToSlot.mjs'))
    const react = await import(at('react.mjs'))
    const device = await import(at('device.mjs'))
    const away = await import(at('saveViaComputer.mjs'))
    return { s: useSaveToSlot(), said: react.said, parked: device.parked, asked: device.asked, started: away.started }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * The phone's demo VP4 note on Play (mobile/src/components/Vp4DemoNote.js) as
 * it is, its JSX turned into calls by esbuild, drawn against stand-ins: a
 * hook store that keeps its state across draws as a mounted component does,
 * the phone's storage as a Map, and the demo's on/off and unit as the bench
 * says. `mount()` is the component put on screen afresh (the next launch);
 * `draw()` draws it again, running any effect whose inputs moved and waiting
 * for what it asked the storage.
 */
async function phoneDemoNoteOnABench() {
  const { transformSync } = await import('esbuild')
  const dir = mkdtempSync(join(tmpdir(), 'vp4-demo-note-'))
  const files = {
    'package.json': '{ "type": "module" }',
    'react.mjs': `
      export const h = (type, props, ...children) => ({ type, props: props || {}, children })
      export const Frag = 'frag'
      let slots = [], deps = [], at = 0, effects = []
      export const mount = () => { slots = []; deps = []; at = 0; effects = [] }
      export const begin = () => { at = 0; effects = [] }
      export const ran = () => effects
      export function useState(initial) {
        const i = at++
        if (!(i in slots)) slots[i] = initial
        return [slots[i], (v) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }]
      }
      export function useEffect(fn, inputs) {
        const i = at++
        const was = deps[i]
        if (!was || inputs.some((x, k) => x !== was[k])) { deps[i] = inputs; effects.push(fn) }
      }
    `,
    'storage.mjs': `
      export const kept = new Map()
      export default {
        getItem: async (k) => (kept.has(k) ? kept.get(k) : null),
        setItem: async (k, v) => { kept.set(k, String(v)) }
      }
    `,
    'demo.mjs': `
      export const bench = { demo: true, unit: 'vp4' }
      export const useDemo = () => bench.demo
      export const useDemoUnit = () => bench.unit
    `,
    'rest.mjs': 'export const tick = () => {}\nexport default function Note() { return null }\n',
    /* The phone's own copies of the words, beside it, as a module. */
    'demoUnits.js': read('mobile/src/lib/demoUnits.js'),
    'vp4-safety.js': read('mobile/src/lib/vp4-safety.js')
  }
  let src = transformSync(read('mobile/src/components/Vp4DemoNote.js'), { loader: 'jsx', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Frag', format: 'esm' }).code
  const swaps = [
    ['from "react"', "from './react.mjs'"],
    ['from "@react-native-async-storage/async-storage"', "from './storage.mjs'"],
    ['from "../lib/demoUnits"', "from './demoUnits.js'"],
    ['from "../lib/demo"', "from './demo.mjs'"],
    ['from "../lib/feedback"', "from './rest.mjs'"],
    ['from "./Note"', "from './rest.mjs'"]
  ]
  for (const [from, to] of swaps) src = src.replaceAll(from, to)
  const left = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((m) => !m.endsWith('.mjs') && !m.endsWith('.js'))
  assert.deepEqual(left, [], 'Vp4DemoNote.js imports something the bench has no stand-in for')
  files['Vp4DemoNote.mjs'] = "import { h, Frag } from './react.mjs'\n" + src
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    const note = await import(at('Vp4DemoNote.mjs'))
    const react = await import(at('react.mjs'))
    const storage = await import(at('storage.mjs'))
    const demo = await import(at('demo.mjs'))
    const draw = async () => {
      react.begin()
      let out = note.default()
      const effects = react.ran()
      if (!effects.length) return out
      for (const fn of effects) fn()
      await new Promise((r) => setTimeout(r, 0))
      react.begin()
      out = note.default()
      for (const fn of react.ran()) fn()
      await new Promise((r) => setTimeout(r, 0))
      react.begin()
      return note.default()
    }
    const mount = () => {
      react.mount()
      return draw()
    }
    return { mount, draw, kept: storage.kept, bench: demo.bench, key: note.VP4_DEMO_NOTE_KEY }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* ------------------------------------------------- presets and scenes, by MIDI -- */

/* A VP4 behind a computer app that changes its scenes and presets (plainMidi), and one behind an older app. */
const VP4_NEW = {
  ...VP4_DETECT,
  capabilities: {
    ...VP4_DETECT.capabilities,
    /* What every computer app says of a VP4: the codec's description lists channels A to D. */
    hasChannels: true,
    channelNames: ['A', 'B', 'C', 'D'],
    presets: { count: 104, addressing: 'bankLetterShort' },
    plainMidi: { programChange: true, sceneSelect: true }
  }
}
const VP4_OLD = VP4_DETECT

/** A storage like the browser's and the phone's sync store: three methods, in memory. */
function memoryStorage() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }
}

/**
 * A pretend computer that sees bodies and can refuse with a status:
 * `reply(method, path, body)` answers, or returns { status, message } to fail.
 * `sent` is every request, its body parsed.
 */
function midiComputer() {
  const sent = []
  const state = { unit: VP4_NEW, reply: () => ({ ok: true }) }
  const answer = (method, path, body) => {
    sent.push({ line: `${method} ${path}`, body })
    if (path === '/device/detect' || path === '/device') return state.unit
    const r = state.reply(method, path, body)
    if (r && Number.isInteger(r.status) && r.status >= 400) {
      const err = new Error(r.message ?? `Host returned ${r.status}`)
      err.status = r.status
      throw err
    }
    return r
  }
  const lines = () => sent.map((x) => x.line)
  return { sent, state, answer, lines }
}

/** The phone's device layer as it is, over a pretend relay that hands the computer each body. */
async function phoneMidiBench() {
  const dir = mkdtempSync(join(tmpdir(), 'vp4-midi-phone-'))
  const lib = (f) => read(`mobile/src/lib/${f}`)
  const esm = (text) => text.replace(/from '\.\/([\w.-]+)'/g, (whole, name) => (/\.m?js$/.test(name) ? whole : `from './${name}.js'`))
  const files = {
    'package.json': '{ "type": "module" }',
    'relay.js':
      'export const computer = { answer: () => ({ ok: true }) }\n' +
      "export async function remoteRequest(path, options = {}) { await null; return computer.answer(String(options.method || 'GET').toUpperCase(), path, options.body ? JSON.parse(options.body) : null) }\n",
    'demo.js': 'export const demoDevice = () => null\n',
    'demoWire.js': "export const demoRequest = () => { throw new Error('no demo on this bench') }\n",
    'debugLog.js': 'export const logDebug = () => {}\n',
    'lineage.js': 'export const withLineage = (slug, x) => x\n'
  }
  for (const f of ['bleSwitch.js', 'tapGate.js', 'relay-rules.js', 'firmware.js', 'param-fixes.js', 'grid-plan.js', 'unit.mjs', 'slots.js', 'presetName.js', 'encoding.js', 'scale.js', 'metronome-rules.js', 'device-word.js', 'unsupported.js', 'vp4-safety.js', 'device.js']) {
    files[f] = esm(lib(f))
  }
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  const device = await import(at('device.js'))
  const relay = await import(at('relay.js'))
  const computer = midiComputer()
  relay.computer.answer = computer.answer
  const storage = memoryStorage()
  device.keepVp4SetupIn(storage)
  return { device, computer, storage, done: () => rmSync(dir, { recursive: true, force: true }) }
}

/** src/lib/forgefx.js as it is, over a pretend relay that hands the computer each body; its storage is `storage`. */
async function browserMidiBench() {
  const dir = mkdtempSync(join(tmpdir(), 'vp4-midi-browser-'))
  const remote = `
    export const computer = { answer: () => ({ ok: true }) }
    export const remoteActive = () => true
    export async function remoteRequest(path, options = {}) { await null; return computer.answer(String(options.method || 'GET').toUpperCase(), path, options.body ? JSON.parse(options.body) : null) }
    export const subscribeHostSeen = () => () => {}
    export const subscribeRemoteEvents = () => () => {}
    export const subscribeRemoteState = () => () => {}
  `
  let src = read('src/lib/forgefx.js')
  src = src
    .replace("from './remote.js'", "from './remote.mjs'")
    .replace(/from '\.\/([\w.-]+\.js)'/g, (whole, f) => `from '${repoUrl(`src/lib/${f}`)}'`)
    .replace(/from '\.\.\/\.\.\/([\w./-]+)'/g, (whole, f) => `from '${repoUrl(f)}'`)
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
  writeFileSync(join(dir, 'remote.mjs'), remote)
  writeFileSync(join(dir, 'forgefx.mjs'), src)
  try {
    const ffx = await import(pathToFileURL(join(dir, 'forgefx.mjs')).href)
    const relay = await import(pathToFileURL(join(dir, 'remote.mjs')).href)
    const computer = midiComputer()
    relay.computer.answer = computer.answer
    return { ffx, computer }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Run `body` with `storage` as the browser's localStorage, and put the old one back. */
async function withLocalStorage(storage, body) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
  try {
    return await body()
  } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had)
    else delete globalThis.localStorage
  }
}

/** The same scene and preset rules, run against either end: `bench` is { end, computer, storage }. */
async function sameRulesAtEitherEnd({ end, computer, storage }, where) {
  const v = await import('../shared/vp4-safety.mjs')
  const { isUnsupported } = await import('../shared/unsupported.mjs')
  const scenes = () => computer.sent.filter((x) => x.line === 'POST /scene')
  const presets = () => computer.sent.filter((x) => x.line === 'POST /preset/select')

  /* An older computer app: nothing goes, and the words say to update it. */
  computer.state.unit = VP4_OLD
  await end.detect()
  computer.sent.length = 0
  await assert.rejects(end.setScene(1), (err) => err.message === v.VP4_UPDATE_COMPUTER, `${where}: an old computer's VP4 scene is not said in words`)
  await assert.rejects(end.selectPreset(5), (err) => err.message === v.VP4_UPDATE_COMPUTER, `${where}: an old computer's VP4 preset is not said in words`)
  assert.deepEqual(computer.lines(), [], `${where}: a scene or a preset went to a computer that cannot do it`)

  /* A computer that can, and no number yet: nothing goes, in words, and nothing remembers it as a no. */
  computer.state.unit = VP4_NEW
  const seen = await end.detect()
  /* No channels on a VP4's screens — nothing can switch one — and what the computer can do kept. */
  assert.deepEqual(seen.capabilities.channelNames, [], `${where}: a VP4's screens are offered channels A to D`)
  assert.equal(seen.capabilities.hasChannels, false, `${where}: a VP4 is said to have channels to switch`)
  assert.deepEqual(seen.capabilities.plainMidi, VP4_NEW.capabilities.plainMidi, `${where}: what the computer can do for a VP4 was lost with its channels`)
  computer.sent.length = 0
  let refusal = null
  await assert.rejects(end.setScene(1), (err) => ((refusal = err), err.message === v.VP4_SCENES_NOT_SET_UP), `${where}: no number, and the tap is not refused in words`)
  assert.equal(scenes().length, 0, `${where}: a scene went before the player set a number`)
  assert.notEqual(refusal.status, 501, `${where}: "not set up" is a 501, which is remembered as "this unit cannot"`)
  assert.equal(isUnsupported(refusal), false, `${where}: "not set up" reads as unsupported`)
  assert.doesNotMatch(refusal.message, /unsupported/i)
  assert.equal(end.refusedAlready('POST', '/scene'), false, `${where}: "not set up" was remembered`)
  /*
   * A preset with nothing set up still carries its channel, 1. The computer
   * that changes a VP4's presets sends nothing for one without it — that is
   * how it tells an app from before these rules, which steps slot by slot and
   * can send a preset twice (VP4_UPDATE_APP) — so this end never sends one bare.
   */
  computer.state.reply = (m, p) => (p === '/preset/select' ? { ok: true, number: 5, code: 'B2', landed: true } : { ok: true })
  await end.selectPreset(5)
  assert.deepEqual(presets().map((x) => x.body), [{ number: 5, midiChannel: 1 }], `${where}: a preset with nothing set up went without its channel, and the computer refuses that`)
  computer.sent.length = 0
  computer.state.reply = () => ({ ok: true })

  /* Set up: the scene goes once, with the number, the channel and which save it is; the preset with its channel. */
  const saved = v.saveVp4Setup(storage, undefined, { sceneCc: '21', midiChannel: '3' }, 4242)
  assert.equal(saved.ok, true)
  computer.state.reply = (m, p) => (p === '/scene' ? { ok: true, index: 2, confirmed: true } : p === '/preset/select' ? { ok: true, number: 5, code: 'B2', landed: true } : { ok: true })
  await end.setScene(2)
  assert.deepEqual(scenes().map((x) => x.body), [{ index: 2, sceneCc: 21, midiChannel: 3, sceneCcSet: 4242 }], `${where}: the scene did not carry the player's number, or went twice`)
  const landed = await end.selectPreset(5)
  assert.equal(landed.landed, true)
  assert.deepEqual(presets().map((x) => x.body), [{ number: 5, midiChannel: 3 }], `${where}: the preset did not carry its channel, or went twice`)

  /* Not confirmed: said in the computer's words, the number held, and nothing more sent on it. */
  const missed = v.vp4SceneUnconfirmed(1, 21, 3)
  computer.state.reply = (m, p) => (p === '/scene' ? { ok: false, index: 0, sent: true, confirmed: false, held: true, message: missed } : { ok: true })
  await assert.rejects(end.setScene(1), (err) => err.message === missed, `${where}: a scene the VP4 did not show is not said`)
  assert.equal(v.readVp4Setup(storage).held, true, `${where}: the number is not held after a scene that did not show`)
  await assert.rejects(end.setScene(3), (err) => err.message === v.vp4SceneHeld(21), `${where}: a held number is not said`)
  assert.equal(scenes().length, 2, `${where}: a scene went on a number held after a miss, or was asked again by itself`)

  /* Saved again: it goes again. An overtaken answer is no news about the number. */
  v.saveVp4Setup(storage, undefined, { sceneCc: 21, midiChannel: 3 }, 5000)
  computer.state.reply = (m, p) => (p === '/scene' ? { ok: true, index: 3, confirmed: false, sent: true, overtaken: true } : { ok: true })
  await end.setScene(3)
  assert.equal(v.readVp4Setup(storage).held, false, `${where}: an overtaken tap held the number`)
  /* The computer held it already (a 428 to a number this end has): held here too. */
  computer.state.reply = (m, p) => (p === '/scene' ? { status: 428, message: v.vp4SceneHeld(21) } : { ok: true })
  await assert.rejects(end.setScene(0), (err) => err.message === v.vp4SceneHeld(21))
  assert.equal(v.readVp4Setup(storage).held, true, `${where}: the computer's hold is not kept here`)
  assert.equal(end.refusedAlready('POST', '/scene'), false, `${where}: a 428 was remembered as "unsupported"`)

  /* And the old computer's 501s on a VP4, fresh and from memory, in words — never the bare word. */
  computer.state.reply = (m, p) => (p === '/preset/blocks/70/channel' || p === '/tempo/tap' || p === '/preset' ? { status: 501, message: 'unsupported' } : { ok: true })
  for (const [run, words] of [[() => end.setChannel(70, 'B'), v.VP4_NO_CHANNELS], [() => end.tapTempo(), v.VP4_NO_TEMPO]]) {
    for (const time of ['fresh', 'from memory']) {
      await assert.rejects(run(), (err) => err.message === words && err.status === 501 && isUnsupported(err), `${where}: a VP4's 501 (${time}) is said as "${words}"`)
    }
  }

  /* Late: the computer sent nothing, said so in words, and it is not remembered as a no; the number is not held. */
  v.saveVp4Setup(storage, undefined, { sceneCc: 21, midiChannel: 3 }, 6000)
  computer.state.reply = (m, p) => (p === '/scene' || p === '/preset/select' ? { status: 503, message: v.VP4_LATE } : { ok: true })
  await assert.rejects(end.setScene(2), (err) => err.message === v.VP4_LATE && err.status !== 501 && !isUnsupported(err), `${where}: a late scene is not said in words`)
  await assert.rejects(end.selectPreset(5), (err) => err.message === v.VP4_LATE, `${where}: a late preset is not said in words`)
  assert.equal(v.readVp4Setup(storage).held, false, `${where}: a scene the computer never sent held the number`)
  assert.equal(end.refusedAlready('POST', '/scene'), false, `${where}: a late scene was remembered as "unsupported"`)
  assert.equal(end.refusedAlready('POST', '/preset/select'), false, `${where}: a late preset was remembered as "unsupported"`)
  /* The same preset again: the computer's `again` comes back as it was, for the store to read. */
  computer.state.reply = (m, p) => (p === '/preset/select' ? { ok: true, number: 5, code: 'B2', landed: false, again: true, message: v.VP4_PRESET_AGAIN } : { ok: true })
  const again = await end.selectPreset(5)
  assert.equal(again.again, true, `${where}: the computer's "loaded it again" was lost`)
  assert.equal(v.vp4PresetOn(again), true, `${where}: a VP4 on the preset asked for is not one a song's scene may go onto`)

  /* An FM3 is asked exactly as it always was: no MIDI fields, and its 501 is its own. */
  computer.state.unit = FM3_DETECT
  const fm3 = await end.detect()
  assert.deepEqual(fm3.capabilities, FM3_DETECT.capabilities, `${where}: an FM3's capabilities were changed as if it were a VP4`)
  computer.sent.length = 0
  computer.state.reply = () => ({ ok: true })
  await end.setScene(1)
  await end.selectPreset(5)
  assert.deepEqual(computer.sent.map((x) => x.body), [{ index: 1 }, { number: 5 }], `${where}: an FM3's scene or preset carried a VP4's fields`)
}


/* ------------------------------------------------- what a buyer is told -- */

/* The words a sentence uses for each thing the app can't do on a VP4 yet. */
const NOT_YET_WORDS = {
  knobs: /\bknobs?\b/i,
  'the tuner': /\btuner\b/i,
  'tap tempo': /\btempo\b/i,
  channels: /\bchannels?\b/i,
  saving: /\bsav(?:e|es|ed|ing)\b/i
}

/** Text as somebody reads it: tags out, entities and apostrophes one way, one space. */
const asRead = (t) =>
  String(t)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&rsquo;/g, '’')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/'/g, '’')
    .replace(/\s+/g, ' ')
    .trim()

const sentencesOf = (t) => asRead(t).split(/(?<=[.!?])\s+/).filter(Boolean)

/**
 * Every sentence in `text` that is about a VP4 and names something the app
 * can't do there yet says that it doesn't work yet; none says "coming" or
 * "soon". A sentence is about a VP4 when it names one, or follows one that
 * does in the same paragraph (the VP4 line's second and third sentences). A
 * paragraph ends at a blank line, so the list of what the app does on the
 * other units, a paragraph of its own, is not read as a VP4's.
 */
function promisesAVp4Nothing(where, text) {
  for (const paragraph of String(text).split(/\n\s*\n/)) {
    let aboutVp4 = false
    for (const sentence of sentencesOf(paragraph)) {
      if (/\bVP4\b/.test(sentence)) aboutVp4 = true
      if (!aboutVp4) continue
      assert.ok(!/\bcoming\b|\bsoon\b|\bwill be\b/i.test(sentence), `${where} promises a VP4 something later: ${sentence}`)
      for (const [thing, said] of Object.entries(NOT_YET_WORDS)) {
        if (!said.test(sentence)) continue
        assert.match(sentence, /don’t work\b[^.]*\byet\b|\bnot yet\b|can’t[^.]*\byet\b/, `${where} names ${thing} for a VP4 without saying it doesn’t work yet: ${sentence}`)
      }
    }
  }
}

/* And for each thing the app can't show on a VP4 (VP4_CANT_SHOW). */
const CANT_SHOW_WORDS = {
  'preset names': /\bnames of a VP4’s presets\b|\bpreset names\b/,
  'on or off': /\bon or off\b/
}

/** The one sentence in `text` that says what can't be shown yet names both. */
function namesEveryCantShow(where, text, VP4_CANT_SHOW) {
  const cant = sentencesOf(text).filter((s) => /can’t show\b[^.]*\byet\b/.test(s))
  assert.equal(cant.length, 1, `${where} does not say in one sentence what the app can’t show on a VP4 yet`)
  for (const thing of VP4_CANT_SHOW) assert.match(cant[0], CANT_SHOW_WORDS[thing], `${where} leaves ${thing} out of what the app can’t show on a VP4 yet`)
}

/** The one sentence in `text` that says what doesn't work yet names all five. */
function namesEveryNotYet(where, text, VP4_NOT_YET) {
  const notYet = sentencesOf(text).filter((s) => /don’t work\b[^.]*\byet\b/.test(s))
  assert.equal(notYet.length, 1, `${where} does not say in one sentence what doesn’t work on a VP4 yet`)
  for (const thing of VP4_NOT_YET) assert.match(notYet[0], NOT_YET_WORDS[thing], `${where} leaves ${thing} out of what doesn’t work on a VP4 yet`)
}

export function run(test) {
  test('the VP4’s scene and preset words are the computer’s, word for word, and promise nothing', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    /* The same literals ForgeFX's test/drivers/vp4.test.ts checks its own copies against. */
    assert.equal(v.VP4_SETUP_PLACE, 'Settings > VP4 scenes & presets')
    assert.equal(v.MIDI_SETUP_TITLE, 'VP4 scenes & presets')
    assert.equal(v.VP4_SCENES_NOT_SET_UP, 'To change a VP4’s scenes from the app, set one number on the VP4 first: SETUP > MIDI/Remote > Scene Select. Then type the same number in the app, in Settings > VP4 scenes & presets.')
    assert.equal(v.vp4PresetUnconfirmed(1), 'Sent, but the app couldn’t confirm the VP4 changed preset. If it was already on that preset, it loaded it again. If not, on the VP4: SETUP > MIDI/Remote, Receive MIDI PC ON, MIDI Channel 1 or OMNI.')
    assert.equal(v.VP4_PRESET_AGAIN, 'The VP4 was already on that preset, so it loaded it again.')
    assert.equal(v.VP4_LATE, 'The computer was still waiting for the VP4 to answer, so it didn’t send this: it would have landed late. Nothing changed on the VP4. Tap it again.')
    assert.equal(v.VP4_NOT_IN_CHAIN, 'That isn’t one of the effects in the preset the VP4 is on, so the app didn’t send anything to it.')
    assert.equal(v.vp4SceneUnconfirmed(2, 34, 1), 'Sent, but the VP4 didn’t show scene 3. On the VP4, check SETUP > MIDI/Remote: Scene Select is 34, and MIDI Channel is 1 or OMNI. The app won’t send scenes on 34 again until you save it again in Settings > VP4 scenes & presets.')
    assert.equal(v.vp4SceneHeld(34), 'The app has stopped sending scenes on 34, because the last scene it sent didn’t show on the VP4. Check SETUP > MIDI/Remote on the VP4, then save the number again in Settings > VP4 scenes & presets.')
    assert.equal(v.VP4_NEEDS_USB, 'The app can change a VP4’s scenes and presets only through the VP4’s USB cable to the computer.')
    assert.equal(v.VP4_UPDATE_COMPUTER, 'Update the Fractal Remote app on your computer to change a VP4’s scenes and presets.')
    /* The computer's, for a preset from an app that sends no channel: this end always sends one, and never says it. */
    assert.equal(v.VP4_UPDATE_APP, 'Update the Fractal Remote app on your phone, or reload the page in your browser, to change a VP4’s presets.')
    /* And for a scene from one of those apps, which sends neither a number nor a channel: the update, never a page it does not have. */
    assert.equal(v.VP4_UPDATE_APP_SCENES, 'Update the Fractal Remote app on your phone, or reload the page in your browser, to change a VP4’s scenes.')
    assert.doesNotMatch(v.VP4_UPDATE_APP_SCENES, /Settings >/, 'the words for an old app’s scene send it to a page it does not have')
    const all = [
      v.VP4_SCENES_NOT_SET_UP, v.VP4_NEEDS_USB, v.vp4PresetUnconfirmed(1), v.vp4SceneUnconfirmed(0, 34, 1), v.vp4SceneHeld(34), v.VP4_UPDATE_COMPUTER, v.VP4_UPDATE_APP, v.VP4_UPDATE_APP_SCENES,
      v.VP4_NO_TUNER, v.VP4_NO_LOOPER, v.VP4_NO_TEMPO, v.VP4_NO_CHANNELS, v.VP4_NO_RENAME, v.VP4_NO_WHICH_PRESET, v.VP4_CANT_YET, v.VP4_NO_STEP, v.VP4_RELOAD,
      v.VP4_PRESET_AGAIN, v.VP4_LATE, v.VP4_NOT_IN_CHAIN, v.VP4_NO_NAMES, v.VP4_ON_OFF_UNKNOWN, v.VP4_NO_EDITS,
      ...Object.values(v.VP4_SETUP).flatMap((w) => (typeof w === 'string' ? [w] : Array.isArray(w) ? w : [])),
      v.VP4_SETUP.status.on(34, 1), v.VP4_SETUP.status.held(34), v.VP4_SETUP.status.offChannel(2), v.vp4OldFirmware('2.10')
    ]
    for (const w of all) {
      assert.equal(typeof w, 'string')
      assert.doesNotMatch(w, /unsupported|coming|\bsoon\b/i, `the words say "unsupported" or promise something: ${w}`)
      assert.doesNotMatch(w, /\bMac\b/, `the words call the computer a Mac: ${w}`)
    }
    for (const w of [v.VP4_NO_TUNER, v.VP4_NO_LOOPER, v.VP4_NO_TEMPO, v.VP4_NO_CHANNELS, v.VP4_NO_RENAME, v.VP4_NO_WHICH_PRESET, v.VP4_CANT_YET, v.VP4_NO_NAMES, v.VP4_NO_EDITS]) assert.match(w, /\byet\b/, `a VP4 limit is not said as "yet": ${w}`)
    /* The setup card says how to set the number on the pedal, and to pick one nothing else uses. */
    assert.match(v.VP4_SETUP.steps.join(' '), /SETUP > MIDI\/Remote > Scene Select/)
    assert.match(v.VP4_SETUP.steps.join(' '), /1 to 119 \(not 32\)/)
    for (const what of ['volume', 'tuner', 'on/off', 'channel', 'footswitch mode']) assert.match(v.VP4_SETUP.freeNumber, new RegExp(what.replace('/', '\\/')), `the warning does not name the ${what}`)
    assert.match(v.VP4_SETUP.channelNote, /is 1 unless you changed it/)
    assert.equal(v.vp4OldFirmware('3.00'), null)
    assert.equal(v.vp4OldFirmware('4.03'), null)
    assert.equal(v.vp4OldFirmware(null), null)
    assert.match(v.vp4OldFirmware('2.10'), /firmware 2\.10\. Before 3\.00/)
  })

  test('the VP4’s numbers are kept per unit, only ones that may be sent, and a save after a miss is a new one', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    const st = memoryStorage()
    assert.deepEqual(v.readVp4Setup(st), { sceneCc: null, midiChannel: 1, savedAt: 0, held: false }, 'nothing saved is not "not set up, channel 1"')
    for (const bad of [0, 32, 120, 127, -1, 'abc', '34.5', '3x', ' 3 4 ']) {
      const r = v.saveVp4Setup(st, undefined, { sceneCc: bad, midiChannel: 1 }, 1)
      assert.deepEqual(r, { ok: false, error: v.VP4_SETUP.badNumber }, `Scene Select ${String(bad)} was saved`)
    }
    for (const bad of [0, 17, '17', 'x', 1.5]) assert.deepEqual(v.saveVp4Setup(st, undefined, { sceneCc: 34, midiChannel: bad }, 1), { ok: false, error: v.VP4_SETUP.badChannel }, `channel ${String(bad)} was saved`)
    assert.equal(st.m.size, 0, 'a refused number was written down')
    for (const ok of [1, 17, 31, 33, 119, ' 34 ']) assert.equal(v.saveVp4Setup(st, undefined, { sceneCc: ok }, 1).ok, true, `Scene Select ${ok} was refused`)
    v.saveVp4Setup(st, undefined, { sceneCc: '34', midiChannel: '' }, 100)
    assert.deepEqual(v.readVp4Setup(st), { sceneCc: 34, midiChannel: 1, savedAt: 100, held: false })
    assert.deepEqual(v.vp4SceneFields(v.readVp4Setup(st)), { sceneCc: 34, midiChannel: 1, sceneCcSet: 100 })
    assert.deepEqual(v.vp4PresetFields(v.readVp4Setup(st)), { midiChannel: 1 })
    /* Per unit: another unit's slug is another drawer. */
    assert.equal(v.readVp4Setup(st, 'another').sceneCc, null)
    /* A miss holds the save that was sent, and only that one. */
    assert.equal(v.holdVp4Setup(st, undefined, 99).held, false, 'an answer to an older save held a newer one')
    assert.equal(v.holdVp4Setup(st, undefined, 100).held, true)
    assert.equal(v.vp4SceneGate(v.readVp4Setup(st), VP4_NEW.capabilities), v.vp4SceneHeld(34))
    v.saveVp4Setup(st, undefined, { sceneCc: 34 }, 200)
    assert.equal(v.readVp4Setup(st).held, false, 'saving the number again did not let it be used again')
    assert.equal(v.vp4SceneGate(v.readVp4Setup(st), VP4_NEW.capabilities), null)
    assert.equal(v.vp4SceneGate(v.readVp4Setup(st), VP4_OLD.capabilities), v.VP4_UPDATE_COMPUTER, 'an old computer is sent a scene it cannot do')
    assert.equal(v.vp4PresetGate(VP4_OLD.capabilities), v.VP4_UPDATE_COMPUTER)
    assert.equal(v.vp4PresetGate(VP4_NEW.capabilities), null)
    v.clearVp4Setup(st)
    assert.equal(v.vp4SceneGate(v.readVp4Setup(st), VP4_NEW.capabilities), v.VP4_SCENES_NOT_SET_UP)
    /* Garbage on disk is "not set up", never a number. */
    st.setItem('fractal.vp4-midi.vp4', JSON.stringify({ sceneCc: 32, midiChannel: 40, held: true }))
    assert.deepEqual(v.readVp4Setup(st), { sceneCc: null, midiChannel: 1, savedAt: 0, held: false })
    st.setItem('fractal.vp4-midi.vp4', '{not json')
    assert.equal(v.readVp4Setup(st).sceneCc, null)
    /* The row's status line. */
    assert.equal(v.vp4SetupStatus(v.readVp4Setup(st), VP4_OLD.capabilities), v.VP4_SETUP.status.update)
    assert.equal(v.vp4SetupStatus(v.readVp4Setup(st), VP4_NEW.capabilities), v.VP4_SETUP.status.off)
    v.saveVp4Setup(st, undefined, { sceneCc: 21, midiChannel: 2 }, 300)
    assert.equal(v.vp4SetupStatus(v.readVp4Setup(st), VP4_NEW.capabilities), 'Scene Select 21 · MIDI channel 2')
  })

  /*
   * TWO BROWSER LINES A VP4 MET. "Choose a preset" printed "null · Big Room is
   * loaded" — a VP4 never says which preset it is on, so its number is null —
   * and Play's first tip said to hold a block "to bring up its channels",
   * which on a VP4 (no channels in the app) is a tap that turns the effect off
   * mid-song. The phone's tip already waits for a unit with channels.
   */
  test('the browser never prints “null” for a VP4’s preset number, and never tips a hold for channels a unit does not offer', async () => {
    const { loadedNote } = await import('../src/lib/presetName.js')
    assert.equal(loadedNote({ number: null, name: 'Big Room' }), 'Big Room is loaded')
    assert.equal(loadedNote({ number: 4, name: 'Edge of Breakup' }), '004 · Edge of Breakup is loaded')
    assert.equal(loadedNote({ number: -1, name: ' Big Room ' }), 'Big Room is loaded')
    assert.equal(loadedNote(null), null)
    for (const p of [{ number: null, name: 'Big Room' }, { number: undefined, name: undefined }, { number: null, name: null }, {}, { number: NaN, name: '' }]) {
      assert.doesNotMatch(loadedNote(p), /null|undefined|NaN/, `the preset sheet says ${loadedNote(p)}`)
    }
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
    assert.match(app, /title="Choose a preset"\s+note=\{loadedNote\(preset\)\}/, 'the preset sheet does not take its line from loadedNote')
    assert.match(app, /const holdOpensChannels = \(device\?\.capabilities\?\.channelNames\?\.length \|\| 0\) > 1/, 'the hold tip is not tied to the unit having channels')
    const tip = app.indexOf('<p className="play-hint">')
    assert.ok(tip > 0, 'the hold tip is gone from Play')
    assert.match(app.slice(Math.max(0, tip - 200), tip), /\{!holdNoteSeen && holdOpensChannels && /, 'the hold tip shows on a unit a hold cannot pick a channel on')
    const stage = readFileSync(new URL('../mobile/src/screens/Stage.js', import.meta.url), 'utf8')
    assert.match(stage, /const holdDoesSomething = [^\n]*channels\?\.length > 1/, 'the phone’s tip stopped waiting for a unit with channels')
  })

  /*
   * THE CHANNEL SAVES ALONE. A VP4 on channel 2 that only wanted presets
   * could not have them: the card refused a save with the Scene Select box
   * empty, so every Program Change went on channel 1, under a card saying
   * presets need nothing set up. The scene gate is exactly as it was: no
   * number, no scene. And forgetting the number keeps the channel.
   */
  test('a VP4’s MIDI channel saves without a Scene Select number, presets carry it, and scenes still wait for a number', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    for (const empty of ['', '   ', null, undefined]) {
      const st = memoryStorage()
      const r = v.saveVp4Setup(st, undefined, { sceneCc: empty, midiChannel: '2' }, 10)
      assert.deepEqual(r, { ok: true, setup: { sceneCc: null, midiChannel: 2, savedAt: 10, held: false } }, `the channel was not saved with Scene Select ${JSON.stringify(empty)}`)
      const kept = v.readVp4Setup(st)
      assert.deepEqual(v.vp4PresetFields(kept), { midiChannel: 2 }, 'a preset does not carry the channel saved without a number')
      assert.equal(v.vp4SceneGate(kept, VP4_NEW.capabilities), v.VP4_SCENES_NOT_SET_UP, 'a scene went with a channel and no number')
      assert.equal(v.vp4SetupStatus(kept, VP4_NEW.capabilities), 'Scenes: not set up yet · MIDI channel 2')
    }
    /* Channel 1 with no number reads as it always did. */
    const one = memoryStorage()
    v.saveVp4Setup(one, undefined, { sceneCc: '', midiChannel: '' }, 11)
    assert.equal(v.vp4SetupStatus(v.readVp4Setup(one), VP4_NEW.capabilities), v.VP4_SETUP.status.off)
    /* A channel out of range is refused, number or no number, and nothing is written. */
    const st = memoryStorage()
    assert.deepEqual(v.saveVp4Setup(st, undefined, { sceneCc: '', midiChannel: '17' }, 12), { ok: false, error: v.VP4_SETUP.badChannel })
    assert.equal(st.m.size, 0)
    /* Forget the number: the channel the presets go on stays. */
    v.saveVp4Setup(st, undefined, { sceneCc: '34', midiChannel: '3' }, 13)
    v.clearVp4Setup(st, undefined, 14)
    const left = v.readVp4Setup(st)
    assert.equal(left.sceneCc, null, 'the number was not forgotten')
    assert.equal(left.midiChannel, 3, 'forgetting the number moved the presets back to channel 1')
    assert.equal(v.vp4SceneGate(left, VP4_NEW.capabilities), v.VP4_SCENES_NOT_SET_UP)
    /* And on channel 1, nothing is left behind. */
    v.saveVp4Setup(st, undefined, { sceneCc: '34', midiChannel: '1' }, 15)
    v.clearVp4Setup(st, undefined, 16)
    assert.equal(st.m.size, 0)
    /* The card says which kind of save it was, the same words at both ends. */
    assert.match(v.VP4_SETUP.savedChannel, /MIDI channel/)
    assert.doesNotMatch(v.VP4_SETUP.presets, /need nothing set up/, 'the card still says presets need nothing set up, above a channel they need')
    assert.match(v.VP4_SETUP.presets, /Scene Select number can stay empty/)
    for (const where of ['src/components/Vp4Setup.jsx', 'mobile/src/components/Vp4Setup.js']) {
      const src = readFileSync(new URL(`../${where}`, import.meta.url), 'utf8')
      assert.match(src, /setSaid\(r\.setup\.sceneCc === null \? VP4_SETUP\.savedChannel : VP4_SETUP\.saved\)/, `the ${where} card says the number was saved when only the channel was`)
      assert.doesNotMatch(src, /setChannel\('1'\)/, `the ${where} card puts the channel back to 1 when the number is forgotten`)
    }
  })

  test('the phone sends a VP4 scene only on the number the player set, with it, once; a preset with its channel', async () => {
    const { device, computer, storage, done } = await phoneMidiBench()
    try {
      await sameRulesAtEitherEnd({ end: device, computer, storage }, 'phone')
    } finally {
      done()
    }
  })

  test('the browser sends a VP4 scene and preset by the same rules as the phone', async () => {
    const storage = memoryStorage()
    await withLocalStorage(storage, async () => {
      const { ffx, computer } = await browserMidiBench()
      await sameRulesAtEitherEnd({ end: ffx, computer, storage }, 'browser')
    })
  })

  test('a VP4’s “which preset”, its stored names and its other refusals are quiet words, never a bare “unsupported”', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    /* Stored names: not asked, and unknown rather than "Empty". */
    assert.deepEqual(v.vp4Route('GET', '/presets/96'), { local: { number: 96, name: null } })
    assert.equal(v.vp4Route('GET', '/presets/96/summary'), null, 'a stored preset’s summary is no longer asked as it was')
    const { device, computer, done } = await phoneMidiBench()
    try {
      await device.detect()
      computer.sent.length = 0
      const named = await device.presetName(96)
      assert.equal(named.name, null, 'a VP4 slot nobody can read is named')
      assert.equal(named.empty, false, 'a VP4 slot nobody can read is called empty')
      assert.deepEqual(computer.lines(), [], 'a VP4’s stored name was asked for')
      computer.state.reply = (m, p) => (p === '/preset' ? { status: 501, message: 'unsupported' } : { ok: true })
      for (const time of ['fresh', 'from memory']) {
        await assert.rejects(device.currentPreset(), (err) => err.message === v.VP4_NO_WHICH_PRESET && err.quiet === true, `which preset (${time}) is not quiet words`)
      }
      /* And on an FM3 the same 501 is the bare refusal it always was, and never quiet. */
      computer.state.unit = FM3_DETECT
      await device.detect()
      await assert.rejects(device.currentPreset(), (err) => err.message === 'unsupported' && !err.quiet)
    } finally {
      done()
    }
    /* Every route a VP4 can be told "unsupported" on has its own words, or the general ones. */
    assert.equal(v.vp4Words('POST', '/scene'), v.VP4_UPDATE_COMPUTER)
    assert.equal(v.vp4Words('POST', '/preset/select'), v.VP4_UPDATE_COMPUTER)
    assert.equal(v.vp4Words('POST', '/tuner'), v.VP4_NO_TUNER)
    assert.equal(v.vp4Words('POST', '/preset/looper/control'), v.VP4_NO_LOOPER)
    assert.equal(v.vp4Words('GET', '/tempo'), v.VP4_NO_TEMPO)
    assert.equal(v.vp4Words('POST', '/preset/blocks/12/channel'), v.VP4_NO_CHANNELS)
    assert.equal(v.vp4Words('POST', '/scene/name'), v.VP4_NO_RENAME)
    assert.equal(v.vp4Words('POST', '/preset/blocks/12/type'), v.VP4_CANT_YET)
    const bare = Object.assign(new Error('unsupported'), { status: 501 })
    assert.equal(v.vp4Said('POST', '/x', bare).message, v.VP4_CANT_YET)
    const other = Object.assign(new Error('port busy'), { status: 503 })
    assert.equal(v.vp4Said('POST', '/x', other), other, 'a failure that is not a refusal was reworded')
    /* The rig keeps "which preset" quiet; the browser reads it as no answer. */
    const rig = read('mobile/src/lib/rig.js')
    assert.match(rig, /export async function refreshPreset\(\) \{\s*try \{\s*takePreset\(await device\.currentPreset\(\)\)\s*\} catch \(err\) \{[\s\S]{0,200}if \(err\?\.quiet\) return/)
    assert.match(rig, /if \(!err\?\.quiet\) set\(faultFrom\(err\)\)/)
    assert.match(read('src/lib/forgefx.js'), /await request\('\/preset'\)\.catch\(\(err\) => \(err\?\.quiet \? null : Promise\.reject\(err\)\)\)/)
  })

  test('a VP4’s slots are A1 to Z4, and the AM4’s are still A01 to Z04', async () => {
    const { slotLabel, isBanked, startsBank, slotCount } = await import('../src/lib/slots.js')
    assert.equal(slotLabel(0, 'bankLetterShort'), '000 A1')
    assert.equal(slotLabel(5, 'bankLetterShort'), '005 B2')
    assert.equal(slotLabel(96, 'bankLetterShort'), '096 Y1')
    assert.equal(slotLabel(103, 'bankLetterShort'), '103 Z4')
    assert.equal(slotLabel(96, 'bankLetter'), '096 Y01', 'the AM4’s letters changed')
    assert.equal(slotLabel(96, 'numeric'), '096')
    assert.equal(isBanked('bankLetterShort'), true)
    assert.equal(startsBank(4, 3, 'bankLetterShort'), true)
    assert.equal(startsBank(5, 4, 'bankLetterShort'), false)
    assert.equal(slotCount(VP4_NEW.capabilities), 104)
    /* The phone carries the same file. */
    assert.equal(read('mobile/src/lib/slots.js').includes("addressing === 'bankLetterShort'"), true)
  })

  test('Previous and Next on a VP4 step only through a setlist or the stars, and say why otherwise, at both ends', () => {
    const stage = flat('mobile/src/screens/Stage.js')
    assert.match(stage, /const noSlotSteps = vp4Here\(\)/)
    assert.match(stage, /const landing = \(by\) => order \? stepTarget\(\{ source, current: preset\?\.number, delta: by, favourites, lists \}\) : noSlotSteps \? null : stepSlot\(preset\?\.number, by, caps\)/, 'the phone steps a VP4 slot by slot')
    assert.match(stage, /if \(!order && noSlotSteps\) sayFault\(vp4StepWords\(caps\)\)/, 'the phone does not say why a VP4 cannot step')
    const gig = flat('src/components/Gig.jsx')
    assert.match(gig, /const noSlotSteps = vp4Here\(\)/)
    assert.match(gig, /const landing = \(delta\) => !order && noSlotSteps \? null : stepTarget\(/, 'the browser steps a VP4 slot by slot')
    assert.match(gig, /if \(!order && noSlotSteps\) onError\(vp4StepWords\(vp4Capabilities\(\)\)\)/, 'the browser does not say why a VP4 cannot step')
    /* And where presets are picked, the cost of tapping the one already on. */
    /* (Not behind an old computer app, which cannot send one: test below.) */
    assert.match(flat('mobile/src/screens/Presets.js'), /\{vp4Here\(\) && !vp4Old \? \( <View[^>]*> <Note tone="hint">\{VP4_RELOAD\}<\/Note>/)
    assert.match(flat('src/components/Console.jsx'), /const noNames = vp4Here\(\)/)
    assert.match(flat('src/components/Console.jsx'), /\{noNames && !vp4Old \? <p className="hint pad">\{VP4_RELOAD\}<\/p> : null\}/)
  })

  /*
   * PREVIOUS AND NEXT BEHIND A COMPUTER TOO OLD FOR A VP4'S PRESETS (every
   * computer app from before plainMidi, where most VP4 owners are until
   * theirs restarts into the new one). They said "work in a setlist or your
   * starred presets … Tap a preset in the list instead": a setlist Next there
   * says to update the computer app, and the list shows only that. Both ways
   * end in the update words, so the press says them at once, at both ends.
   */
  test('on a computer that can’t change a VP4’s presets, Previous and Next say to update it, at both ends', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    const m = await import('../mobile/src/lib/vp4-safety.js')
    for (const end of [v, m]) {
      assert.equal(end.vp4StepWords(VP4_NEW.capabilities), end.VP4_NO_STEP, 'a VP4 on the new computer is not sent to a setlist, the stars or the list')
      for (const old of [{ ...VP4_NEW.capabilities, plainMidi: undefined }, { plainMidi: { programChange: true } }, {}, null]) {
        assert.equal(end.vp4StepWords(old), end.VP4_UPDATE_COMPUTER, `a VP4 on a computer that can’t change its presets is sent to a setlist, the stars or the list: ${JSON.stringify(old)}`)
      }
    }
    /* And what each end hands it: the capabilities the preset list asks the same question of. */
    assert.match(flat('mobile/src/screens/Stage.js'), /const caps = useRig\(ofCaps\)/)
    assert.match(flat('mobile/src/screens/Presets.js'), /const vp4Old = noNames && !vp4ComputerCan\(caps\)/)
    assert.match(flat('src/components/Console.jsx'), /const vp4Old = noNames && !vp4ComputerCan\(vp4Capabilities\(\)\)/)
    assert.match(flat('src/components/Gig.jsx'), /import \{[^}]*\bvp4Capabilities\b[^}]*\} from '\.\.\/lib\/forgefx'/)
    assert.doesNotMatch(flat('mobile/src/screens/Stage.js') + flat('src/components/Gig.jsx'), /\(VP4_NO_STEP\)/, 'a screen says VP4_NO_STEP whatever the computer can do')
  })

  test('the VP4 setup card says the same words on the phone and in the browser, and only there', () => {
    const phone = read('mobile/src/components/Vp4Setup.js')
    const web = read('src/components/Vp4Setup.jsx')
    const keys = (src) => [...new Set([...src.matchAll(/VP4_SETUP\.(\w+)/g)].map((m) => m[1]))].sort()
    assert.deepEqual(keys(phone), keys(web), 'the two cards say different things')
    for (const key of ['intro', 'presets', 'reload', 'scenesHead', 'steps', 'freeNumber', 'numberLabel', 'channelLabel', 'channelNote', 'save', 'clear', 'saved', 'cleared', 'update', 'heldNote']) {
      assert.ok(keys(phone).includes(key), `the cards leave out ${key}`)
    }
    for (const [where, src] of [['phone', phone], ['browser', web]]) {
      assert.match(src, /vp4OldFirmware\(firmware\)/, `the ${where} card does not warn about firmware before 3.00`)
      assert.match(src, /vp4ComputerCan\(caps\)/, `the ${where} card does not say an old computer app cannot`)
      assert.match(src, /saveVp4Setup\(/, `the ${where} card does not save through the shared rule`)
      /* No words of its own between tags: everything a player reads is VP4_SETUP's. */
      const prose = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').match(/(?<!=)>\s*[A-Za-z][^<{]*</g) || []
      assert.deepEqual(prose, [], `the ${where} card has words of its own: ${prose.join(' | ')}`)
    }
    /* Both Settings lists open it by the same row, on a real VP4 only. */
    const settings = flat('mobile/src/screens/Settings.js')
    assert.match(settings, /\{onRealVp4 \? \( <SetupRow title=\{MIDI_SETUP_TITLE\} status=\{vp4SetupStatus\(readVp4Setup\(sync\), caps\)\}/)
    assert.match(settings, /const onRealVp4 = vp4Here\(\)/)
    const app = flat('src/App.jsx')
    assert.match(app, /\{onRealVp4 \? \( <SetupRow key="vp4" title=\{MIDI_SETUP_TITLE\} status=\{vp4SetupStatus\(vp4Setup\(\), device\?\.capabilities\)\}/)
    assert.match(app, /const onRealVp4 = Boolean\(device\) && vp4Here\(\)/)
    assert.match(app, /\{setupPage === 'vp4' && onRealVp4 \? \(/)
    /* The phone's store reaches the device layer, which is where the numbers are read at a tap. */
    assert.match(read('mobile/App.js'), /\nkeepVp4SetupIn\(sync\)\n/)
  })

  test('a VP4 is known by its model byte or its name, and nothing else is one', async () => {
    const { isVp4, VP4_MODEL_ID } = await import('../shared/vp4-safety.mjs')
    assert.equal(VP4_MODEL_ID, 0x14)
    for (const u of [VP4_DETECT, { modelId: 0x14 }, { short: 'VP4' }, { name: 'VP-4' }, 'vp4', 'VP4']) assert.equal(isVp4(u), true, `${JSON.stringify(u)} is not taken for a VP4`)
    for (const u of [FM3_DETECT, { modelId: 0x15, short: 'AM4' }, { modelId: 0x10, name: 'Axe-Fx III' }, 'fm3', 'device', '', null, undefined, {}]) assert.equal(isVp4(u), false, `${JSON.stringify(u)} is taken for a VP4`)
  })

  test('a VP4 is never asked for its chain the dangerous way, a block’s knobs, or a save', async () => {
    const { vp4Route, vp4BlocksFromGrid, VP4_NO_SAVE, VP4_NO_KNOBS } = await import('../shared/vp4-safety.mjs')
    const blocks = vp4Route('GET', '/preset/blocks')
    assert.equal(blocks?.path, '/preset/grid', 'the chain is not read off the grid')
    assert.equal(blocks?.answer, vp4BlocksFromGrid)
    assert.equal(vp4Route('get', '/preset/blocks/?x=1')?.path, '/preset/grid', 'a query string or a slash lets the chain read through')
    assert.deepEqual(vp4Route('GET', '/preset/blocks/70/params'), { refuse: VP4_NO_KNOBS })
    assert.deepEqual(vp4Route('POST', '/preset/store'), { refuse: VP4_NO_SAVE })
    /* Everything else goes as it is: the switches, the knob write, the scene, the safe reads. */
    for (const [m, p] of [
      ['GET', '/preset/grid'], ['GET', '/preset/scene-state'], ['GET', '/scene'], ['POST', '/scene'], ['POST', '/preset/select'],
      ['POST', '/preset/blocks/70/bypass'], ['PUT', '/preset/blocks/70/params/14'], ['GET', '/device/detect'], ['GET', '/preset/scenes'],
      ['PUT', '/store/config/fractal.pendingSave.vp4']
    ]) assert.equal(vp4Route(m, p), null, `${m} ${p} is held back on a VP4`)
  })

  test('a VP4’s chain off its grid is what a chain read answers, with bypass and channel unknown', async () => {
    const { vp4BlocksFromGrid } = await import('../shared/vp4-safety.mjs')
    const { zeroBasedChain } = await import('../src/lib/slots.js')
    const got = vp4BlocksFromGrid(VP4_GRID)
    assert.deepEqual(got.map((b) => [b.slug, b.effectId, b.row, b.col]), [['drive', 118, 1, 1], ['delay', 70, 1, 3], ['reverb', 66, 1, 4]])
    assert.ok(got.every((b) => b.bypassed === null && b.channel === null && Array.isArray(b.fromRows)), 'a bypass or a channel the record does not carry was made up')
    /* Counted from one, as a four-slot chain read is, so the browser's own correction puts it where it belongs. */
    assert.deepEqual(zeroBasedChain(got, VP4_DETECT.capabilities).map((b) => b.col), [0, 2, 3])
    assert.deepEqual(vp4BlocksFromGrid(null), [])
    assert.deepEqual(vp4BlocksFromGrid({ cells: [{ col: 0, effectId: 5, isShunt: true, slug: 'x' }, { col: 1, slug: 'y' }, null] }), [], 'a shunt or a cell with no id became a block')
  })

  test('a VP4 refusal is not a 501 and not “unsupported”, so nothing remembers it as a no for ever', async () => {
    const { vp4Refusal, VP4_NO_SAVE, VP4_NO_KNOBS } = await import('../shared/vp4-safety.mjs')
    const { isUnsupported, unsupportedMemo } = await import('../shared/unsupported.mjs')
    for (const words of [VP4_NO_SAVE, VP4_NO_KNOBS]) {
      const err = vp4Refusal(words)
      assert.equal(err.message, words)
      assert.equal(err.status, undefined, 'a VP4 refusal carries a status')
      assert.equal(isUnsupported(err), false, 'a VP4 refusal reads as "unsupported"')
      const memo = unsupportedMemo()
      memo.heard('GET', '/preset/blocks/70/params', err)
      assert.equal(memo.known('GET', '/preset/blocks/70/params'), false, 'a VP4 refusal was remembered')
      assert.doesNotMatch(words, /unsupported|coming|soon/i, 'the words promise or say "unsupported"')
      assert.match(words, /VP4/)
      assert.match(words, /\byet\b/, 'the words do not say "yet"')
    }
  })

  test('the phone on a VP4: its chain comes off the grid, and its knobs are never asked for', async () => {
    const { device, computer, done } = await phoneOnABench()
    try {
      const { VP4_NO_KNOBS } = await import('../shared/vp4-safety.mjs')
      await device.detect()
      computer.asked.length = 0
      const blocks = await device.presetBlocks()
      assert.deepEqual(computer.asked, ['GET /preset/grid'], 'the phone asked a VP4 for its chain the dangerous way')
      assert.deepEqual(blocks.map((b) => [b.slug, b.col, b.bypassed]), [['drive', 1, null], ['delay', 3, null], ['reverb', 4, null]])
      await assert.rejects(device.blockParams(70), (err) => err.message === VP4_NO_KNOBS && err.status === undefined)
      assert.deepEqual(computer.asked, ['GET /preset/grid'], 'the phone asked a VP4 for a block’s knobs')
      /* The rest of what a phone sends a VP4 goes as it always did. */
      await device.sceneState()
      await device.setBypass(70, true)
      assert.deepEqual(computer.asked.slice(1), ['GET /preset/scene-state', 'POST /preset/blocks/70/bypass'])
      /* And another unit is asked as it always was, the moment it is detected. */
      computer.state.unit = FM3_DETECT
      await device.detect()
      computer.asked.length = 0
      await device.presetBlocks()
      await device.blockParams(58)
      assert.deepEqual(computer.asked, ['GET /preset/blocks', 'GET /preset/blocks/58/params'], 'an FM3 is read as if it were a VP4')
    } finally {
      done()
    }
  })

  test('the browser on a VP4: its chain comes off the grid, and neither its knobs nor a save are sent', async () => {
    const { ffx, computer } = await browserOnABench()
    const { VP4_NO_KNOBS, VP4_NO_SAVE } = await import('../shared/vp4-safety.mjs')
    await ffx.detect()
    computer.asked.length = 0
    const blocks = await ffx.presetBlocks()
    assert.deepEqual(computer.asked, ['GET /preset/grid'], 'the browser asked a VP4 for its chain the dangerous way')
    assert.deepEqual(blocks.map((b) => [b.slug, b.col]), [['drive', 0], ['delay', 2], ['reverb', 3]], 'the chain is not where the browser counts it from')
    await assert.rejects(ffx.blockParams(70), (err) => err.message === VP4_NO_KNOBS)
    await assert.rejects(ffx.storePreset(5), (err) => err.message === VP4_NO_SAVE)
    assert.deepEqual(computer.asked, ['GET /preset/grid'], 'the browser sent a VP4 a knob read or a save')
    assert.equal(ffx.refusedAlready('POST', '/preset/store'), false, 'a VP4 refusal was remembered as "unsupported"')
    computer.state.unit = FM3_DETECT
    await ffx.detect()
    computer.asked.length = 0
    await ffx.presetBlocks()
    await ffx.storePreset(5)
    assert.deepEqual(computer.asked, ['GET /preset/blocks', 'POST /preset/store'], 'an FM3 is read or saved as if it were a VP4')
  })

  test('the phone’s Save on a VP4 leaves nothing for the computer and says why, at the first tap', async () => {
    const { VP4_NO_SAVE } = await import('../shared/vp4-safety.mjs')
    {
      const b = await phoneSaveOnABench({ slug: 'vp4' })
      assert.equal(b.s.notHere, true)
      await b.s.save()
      await b.s.write()
      assert.deepEqual(b.parked, [], 'a save was left for the computer on a VP4')
      assert.deepEqual(b.started, [], 'a save to the computer was started on a VP4')
      assert.deepEqual(b.asked, [], 'the unit was asked anything for a save that cannot happen')
      assert.deepEqual(b.said.map((x) => [x.tone, x.text]), [['warn', VP4_NO_SAVE], ['warn', VP4_NO_SAVE]])
    }
    /* An FM3 still saves through the computer, and the VP4 demo on the phone. */
    {
      const b = await phoneSaveOnABench({ slug: 'fm3' })
      assert.equal(b.s.notHere, false)
      await b.s.write()
      assert.equal(b.started.length, 1, 'an FM3 no longer saves')
    }
    {
      const b = await phoneSaveOnABench({ slug: 'vp4', demo: true })
      assert.equal(b.s.notHere, false)
      await b.s.write()
      assert.deepEqual(b.asked, ['demo save 5'], 'the VP4 demo no longer saves on the phone')
    }
  })

  test('the phone’s top bar offers no Save on a VP4, and its notes are drawn over the screen, not under it', () => {
    const bar = flat('mobile/src/components/TopBar.js')
    /* Not lit at all on a VP4: a Save that only says it cannot after a tap is a promise, and its note sat over the preset's name. */
    assert.match(bar, /const saveHere = saveWanted && !saveTo\.notHere/, 'the bar offers Save on a VP4')
    assert.match(bar, /const canSave = saveHere && \(saveTo\.saving \|\|/, 'the bar decides Save by something else')
    assert.match(bar, /zIndex: 3/, 'the bar’s notes are drawn under the screen below it again')
    /*
     * The lift is the whole bar's, so the metronome's flash, which was over
     * everything only by being drawn after it, sits higher: on every unit,
     * the top of the frame was under the bar.
     */
    const beat = read('mobile/src/components/MetronomeBeat.js')
    const beatZ = Number(/const BEAT_Z = (\d+)/.exec(beat)?.[1])
    assert.ok(beatZ > 3, `the metronome’s flash (zIndex ${beatZ}) is drawn under the top bar (3)`)
    assert.match(beat, /borderColor: color\.ok, opacity: glow, zIndex: BEAT_Z \}/, 'the flash does not wear its zIndex')
    assert.doesNotMatch(beat, /\belevation: *\d/, 'the flash casts a shadow on Android')
    const app = read('mobile/App.js')
    assert.ok(app.indexOf('<MetronomeBeat') > app.indexOf('<TopBar'), 'the flash is no longer drawn after the bar')
    for (const m of read('mobile/src/components/TopBar.js').matchAll(/zIndex: (\d+)/g)) assert.ok(Number(m[1]) < beatZ, `something in the top bar (zIndex ${m[1]}) is over the metronome’s flash`)
  })

  test('the browser’s Save on a VP4 sends nothing and parks nothing, at the computer and from away', () => {
    const app = read('src/App.jsx')
    assert.match(app, /import \{ aboutVp4, isVp4, VP4_NO_SAVE \} from '\.\.\/shared\/vp4-safety\.mjs'/)
    /* Its own Save: refused before the name is written, anything is parked, or the slot is stored. */
    const save = app.slice(app.indexOf('  const save = async () => {'))
    const refuse = save.indexOf('if (isVp4(device) && !isDemo()) {\n      setSaveError(VP4_NO_SAVE)\n      return false\n    }')
    assert.ok(refuse > 0, 'the browser’s Save does not refuse a VP4 in words')
    for (const later of ['const parked = await parkSave(', 'await setPresetName(name)', 'await storePreset(number)']) {
      assert.ok(save.indexOf(later) > refuse, `the browser’s Save reaches ${later} before it refuses a VP4`)
    }
    /* A save a phone left: refused before the name or the slot is written, and the phone told why. */
    const carry = app.slice(app.indexOf('const carryOutSave'), app.indexOf('At the Mac: anything the phone has asked for'))
    const no = carry.indexOf('if (isVp4(device)) throw new Error(VP4_NO_SAVE)')
    assert.ok(no > 0, 'a phone’s save is carried out on a VP4')
    for (const later of ['await setPresetName(name)', 'await storePreset(req.slot)']) assert.ok(carry.indexOf(later) > no, `a phone’s save reaches ${later} on a VP4`)
    assert.match(carry, /await clearParkedSave\(\)\.catch\(\(\) => \{\}\)\s*await reportSave\(\{ id: req\.id, ok: false, slot: req\.slot, error: err\.message \}\)/, 'a refused save is left parked, or the phone is not told')
    assert.match(carry, /\[preset\?\.name, sceneNames, record, device, markHandled\]/, 'the carrier reads a device it was not handed')
  })

  test('the phone and the browser keep a VP4 out of trouble by the same rule, from the same words', () => {
    /* One source: the phone's copy is generated from it (npm run sync:rules). */
    assert.match(read('scripts/sync-relay-rules.mjs'), /source: '\.\.\/shared\/vp4-safety\.mjs', target: '\.\.\/mobile\/src\/lib\/vp4-safety\.js'/)
    const phone = flat('mobile/src/lib/device.js')
    assert.match(phone, /import \{[^}]*\bisVp4\b[^}]*\bvp4Refusal\b[^}]*\bvp4Route\b[^}]*\} from '\.\/vp4-safety'/)
    assert.match(phone, /onVp4 = !demoDevice\(\) && !bluetoothWire\(\) && isVp4\(res\)/, 'the phone does not learn it is on a VP4, or learns it in the demo')
    assert.match(phone, /if \(refused\.known\(method, path\)\) return Promise\.reject\(rememberedRefusal\(method, path\)\) const vp4 = onVp4 && vp4Instead\(method, path, options\) if \(vp4\) return vp4 return overTheWire\(path, options\)/, 'a VP4 request reaches the computer unrouted')
    const web = flat('src/lib/forgefx.js')
    assert.match(web, /import \{[^}]*\bisVp4\b[^}]*\bvp4Refusal\b[^}]*\bvp4Route\b[^}]*\} from '\.\.\/\.\.\/shared\/vp4-safety\.mjs'/)
    assert.match(web, /unitIsVp4 = !mock && isVp4\(res\)/, 'the browser does not learn it is on a VP4, or learns it in the demo')
    assert.match(web, /const vp4 = !mock && unitIsVp4 \? vp4Route\(method, path\) : null/)
    assert.match(read('mobile/src/components/SaveToSlot.js'), /import \{ isVp4, VP4_NO_SAVE \} from '\.\.\/lib\/vp4-safety'/)
  })

  test('what a buyer is told about a VP4 is what the app does there, and names each thing it can’t do yet', async () => {
    /*
     * "I didn't know that those settings didn't work on the VP4. I thought
     * that they did, so yeah, if they don't, we need to put that in there for
     * now." The purchase page, the demo, the download page and both stores
     * named the VP4 and promised it presets, scenes, the tuner and tap tempo.
     */
    const v = await import('../shared/vp4-safety.mjs')
    const caps = { plainMidi: { programChange: true, sceneSelect: true } }

    /* What it says works is what the rules let through. */
    assert.equal(v.vp4Route('POST', '/preset/blocks/66/bypass'), null, 'the words say a VP4’s effects go on and off, and the rules stop that')
    assert.equal(v.vp4PresetGate(caps), null, 'the words say a VP4 changes presets, and the rules refuse one')
    assert.equal(v.vp4SceneGate({ sceneCc: 34, midiChannel: 1, savedAt: 1, held: false }, caps), null, 'the words say a VP4 changes scenes, and the rules refuse one')
    assert.equal(v.vp4SceneGate({ sceneCc: null, midiChannel: 1, savedAt: 0, held: false }, caps), v.VP4_SCENES_NOT_SET_UP, 'the words say scenes need one number set first, and the rules send without it')

    /*
     * And what it says doesn't work yet is what the rules refuse, both ways:
     * the day one of these starts working on a VP4, the words move with it.
     */
    const refused = {
      knobs: v.vp4Route('GET', '/preset/blocks/70/params')?.refuse === v.VP4_NO_KNOBS,
      saving: v.vp4Route('POST', '/preset/store')?.refuse === v.VP4_NO_SAVE,
      'the tuner': v.vp4Words('POST', '/tuner') === v.VP4_NO_TUNER,
      'tap tempo': v.vp4Words('POST', '/tempo/tap') === v.VP4_NO_TEMPO,
      channels: v.vp4Words('POST', '/preset/blocks/70/channel') === v.VP4_NO_CHANNELS
    }
    assert.deepEqual(
      Object.keys(refused).filter((k) => refused[k]).sort(),
      [...v.VP4_NOT_YET].sort(),
      'what the words say a VP4 can’t do yet is not what the app refuses on one'
    )

    /* The purchase page's sentence: what works, that presets and scenes are untried, and the five, in one sentence. */
    assert.match(v.VP4_SO_FAR, /^On a VP4, the app turns effects on and off, changes presets, and changes scenes once you set one number on the VP4 itself\. /)
    assert.match(v.VP4_SO_FAR, /nobody on our side has tried it on one yet/, 'the VP4 line no longer says presets and scenes are untried')
    namesEveryNotYet('the VP4 line', v.VP4_SO_FAR, v.VP4_NOT_YET)
    promisesAVp4Nothing('the VP4 line', v.VP4_SO_FAR)
    /*
     * And what a VP4 owner meets on the first screen, which WHAT IT DOES
     * promises every unit ("by name, in slot order"): no names in the preset
     * list, pedals that say neither on nor off, and no slot-by-slot Previous
     * and Next. Said because the rules do it: a stored name is not asked and
     * is unknown, a pedal's on/off off the record is unknown, and Previous
     * with no setlist says VP4_NO_STEP (the test above holds both screens).
     */
    assert.deepEqual(v.VP4_CANT_SHOW, ['preset names', 'on or off'])
    assert.equal(v.vp4Route('GET', '/presets/5')?.local?.name, null, 'the words say a VP4’s preset names can’t be shown, and the rules show one')
    assert.ok(v.vp4BlocksFromGrid(VP4_GRID).every((b) => b.bypassed === null), 'the words say a VP4’s on/off can’t be shown, and the rules show one')
    assert.match(v.VP4_NO_STEP, /Previous and Next work in a setlist or your starred presets/)
    namesEveryCantShow('the VP4 line', v.VP4_SO_FAR, v.VP4_CANT_SHOW)
    assert.match(v.VP4_SO_FAR, /except the one it is on/, 'the VP4 line says no preset name shows, and the one it is on does')
    assert.match(v.VP4_SO_FAR, /Previous and Next go through a setlist or your starred presets, not slot by slot\./, 'the VP4 line leaves out that Previous and Next do not step slot by slot')

    /* The demo's: it does them all, so it says which a real one doesn't. */
    assert.match(v.VP4_DEMO, /^This is a practice VP4\. Nothing you do here touches a real unit\. /)
    assert.match(v.VP4_DEMO, /work in this demo, but don’t work on a real VP4 from the app yet\./)
    assert.ok(!/ranges are the real ones/.test(v.VP4_DEMO), 'the demo’s VP4 says its knobs and ranges are a real one’s, and nobody knows a real one’s')
    namesEveryNotYet('the demo’s VP4', v.VP4_DEMO, v.VP4_NOT_YET)
    promisesAVp4Nothing('the demo’s VP4', v.VP4_DEMO)
    namesEveryCantShow('the demo’s VP4', v.VP4_DEMO, v.VP4_CANT_SHOW)
    /* And what it does with nothing set up that a real one doesn't: scenes with no number, and Previous and Next slot by slot. */
    assert.match(v.VP4_DEMO, /On a real VP4, scenes need one number set on the VP4 first, and Previous and Next go through a setlist or your starred presets\./, 'the demo’s VP4 leaves out that a real one’s scenes need a number and its Previous and Next do not step slot by slot')
  })

  test('the store listing, its promotional text, the download page and the README say the purchase page’s VP4 sentence', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    const { fenced, promoText, PROMO_LIMIT } = await import('../scripts/store-text.mjs')
    const store = read('docs/app-store.md')

    /* The Description, both stores: the VP4 has a line of its own under SUPPORTED UNITS, before the list of what the app does. */
    const description = fenced(store, '### Description')
    const at = description.indexOf('SUPPORTED UNITS\n')
    const units = description.slice(at, description.indexOf('\n\n', at))
    assert.equal(units, `SUPPORTED UNITS\nFM3, FM9, Axe-Fx III and AM4, and the VP4 in part.\n${v.VP4_SO_FAR.replace(/’/g, "'")}`, 'the Description’s VP4 line is not the purchase page’s')
    assert.ok(at > 0 && at < description.indexOf('WHAT IT DOES\n'), 'the VP4 line comes after the list of what the app does, or not at all')
    promisesAVp4Nothing('the Description', description)
    assert.match(description, /on all supported Fractal units \(on a VP4, what SUPPORTED UNITS says\)/, 'the lifetime unlock promises a VP4 everything')

    /*
     * The promotional text: the one part of the App Store page that changes
     * before the next version, and that page's Description still promises a
     * VP4 everything. So it names the five, and still opens on the computer.
     */
    const promo = promoText(store)
    assert.match(promo, /^REQUIRES A COMPUTER\./)
    assert.ok([...promo].length <= PROMO_LIMIT)
    assert.match(promo, /\bVP4\b/, 'the promotional text no longer says what doesn’t work on a VP4, and the live App Store Description still promises it')
    namesEveryNotYet('the promotional text', promo, v.VP4_NOT_YET)
    promisesAVp4Nothing('the promotional text', promo)

    /* The download page: what you need, word for word, and a demo that says it does more. */
    const page = read('public/downloads.html')
    const body = page.slice(page.indexOf('<main>'), page.indexOf('</main>'))
    const need = body.slice(body.indexOf('<strong>A Fractal unit</strong>'), body.indexOf('</li>', body.indexOf('<strong>A Fractal unit</strong>')))
    assert.ok(asRead(need).includes(asRead(v.VP4_SO_FAR)), 'the download page’s “A Fractal unit” does not say what the purchase page says about a VP4')
    assert.match(asRead(body), /The simulated VP4 does more than the app can do on a real one yet/, 'the download page’s demo does not say its VP4 does more than a real one')
    promisesAVp4Nothing('the download page', body)

    /* And the README, on GitHub. */
    const readme = read('README.md')
    assert.ok(asRead(readme).includes(asRead(v.VP4_SO_FAR)), 'the README does not say what the app does on a VP4')
    promisesAVp4Nothing('the README', readme.slice(0, readme.indexOf('\n## ')))

    /* The Play checklist says the VP4 line is the one still to paste. */
    assert.match(store, /- \*\*The VP4 line\*\* under SUPPORTED UNITS/, 'the Play checklist does not say the VP4 line is still to go on')
  })

  test('the demo’s VP4 says what a real one doesn’t do yet, at both ends, and the other four keep their sentence', async () => {
    const { VP4_DEMO } = await import('../shared/vp4-safety.mjs')
    const { demoSentence, UNITS } = await import('../src/lib/demoUnits.js')
    assert.equal(demoSentence('vp4'), VP4_DEMO)
    for (const unit of UNITS.filter((u) => u.key !== 'vp4')) {
      assert.equal(demoSentence(unit.key), `This is a practice ${unit.name}. Nothing you do here touches a real unit — the models, knobs and ranges are the real ones.`)
    }
    /* The phone's copy is generated, and imports the phone's copy of the words. */
    assert.match(read('mobile/src/lib/demoUnits.js'), /^import \{ VP4_DEMO \} from '\.\/vp4-safety\.js'$/m, 'the phone’s demo does not take its VP4 sentence from the phone’s copy of the shared words')
    assert.match(read('scripts/sync-relay-rules.mjs'), /source: '\.\.\/src\/lib\/demoUnits\.js',\s*target: '\.\.\/mobile\/src\/lib\/demoUnits\.js',\s*render: \(text\) => banner\('\.\.\/src\/lib\/demoUnits\.js'\) \+ text\.replace\("from '\.\.\/\.\.\/shared\/vp4-safety\.mjs'", "from '\.\/vp4-safety\.js'"\)/)
    /* Where it is said: the phone's demo picker, the browser's banner and the top bar's word. */
    assert.match(read('mobile/src/components/DemoUnit.js'), /<Note tone="warn">\{demoSentence\(unit\)\}<\/Note>/)
    assert.match(read('src/App.jsx'), /<span>\{demoSentence\(demoUnit\(\)\)\}<\/span>/)
    /*
     * AND WHERE A VP4 IS PICKED. The phone's sheet said the sentence of the unit
     * the demo was on, and closed on a pick, so picking VP4 from an FM3 never
     * showed the VP4's. It stays open on a VP4 now, its note turned into the
     * VP4's; every other pick still closes it.
     */
    assert.match(flat('mobile/src/components/DemoUnit.js'), /onPress=\{\(\) => \{ setDemoUnit\(u\.key\) if \(u\.key !== 'vp4'\) onClose\(\) \}\}/, 'the phone’s demo sheet closes on a VP4 pick before its sentence is shown')
    /* The phone's Settings said "Every screen works" of the demo's VP4: it says the VP4's sentence, and every other unit's note is as it was. */
    const settings = flat('mobile/src/screens/Settings.js')
    assert.match(settings, /\{unit === 'vp4' \? `\$\{demoSentence\(unit\)\} It also answers instantly, so anything still slow in here is this app rather than the line to a computer\.` : `This is the demo — a simulated \$\{ DEMO_UNITS\.find\(\(u\) => u\.key === unit\)\?\.name \|\| 'FM3' \}\. Every screen works and nothing reaches hardware\./, 'the phone’s Settings says “Every screen works” of the demo’s VP4')
    /*
     * The browser's banner was put away for every unit by one Got it, so after
     * Got it on the FM3 the VP4's never came up. A VP4 has its own, and the
     * Demo Unit page says the VP4's sentence under the buttons while it is one.
     */
    const web = flat('src/App.jsx')
    assert.match(web, /const demoNoteKey = \(unit\) => \(unit === 'vp4' \? DEMO_NOTE_KEY_VP4 : DEMO_NOTE_KEY\)/, 'a VP4’s demo note is put away by another unit’s Got it')
    assert.match(web, /useState\(\(\) => demoNoteWasSeen\(demoUnit\(\)\)\)/)
    assert.match(web, /setDemoNoteSeen\(true\) rememberDemoNote\(demoUnit\(\)\)/)
    assert.match(web, /\{demoUnit\(\) === 'vp4' \? <p className="hint">\{demoSentence\(demoUnit\(\)\)\}<\/p> : null\} <\/div> \) : null\}/, 'the browser’s Demo Unit page does not say the VP4’s sentence')
    /* Run, the keys: Got it on an FM3 leaves the VP4's note to come up, and the VP4's own Got it puts only it away. */
    const src = read('src/App.jsx')
    const keys = src.slice(src.indexOf("const DEMO_NOTE_KEY = "), src.indexOf('/**', src.indexOf("const rememberDemoNote")))
    const store = new Map()
    const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, val) => store.set(k, String(val)) }
    const { seen, remember } = new Function('localStorage', `${keys}; return { seen: demoNoteWasSeen, remember: rememberDemoNote }`)(localStorage)
    assert.equal(seen('fm3'), false)
    remember('fm3')
    assert.equal(seen('fm3'), true)
    assert.equal(seen('am4'), true, 'the other four units stopped sharing one note')
    assert.equal(seen('vp4'), false, 'Got it on an FM3 put the VP4’s note away')
    remember('vp4')
    assert.equal(seen('vp4'), true)
  })

  /*
   * AND ON THE PHONE'S PLAY, the first time the demo is a VP4, as on the
   * browser's. Somebody who picked VP4 in the walkthrough went from "Which
   * unit should we simulate?" to SAVE "Changes write to the slot on your
   * unit." to Play, with a working tuner, Tap 120 and HOLD TO SWITCH
   * CHANNELS, and the sentence that says a real VP4 does none of that from
   * the app yet was only in the Demo Unit sheet and Settings.
   */
  test('the demo’s VP4 says its sentence on Play the first time, at both ends, and its walkthrough offers no SAVE', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    /* The phone: drawn. The first Play in the demo's VP4 says it, with a cross. */
    const phone = await phoneDemoNoteOnABench()
    const first = await phone.mount()
    assert.equal(first?.type?.name, 'Note', 'the phone’s Play says nothing the first time the demo is a VP4')
    assert.equal(first.props.tone, 'warn')
    assert.deepEqual(first.children, [v.VP4_DEMO], 'the phone’s Play says something other than the demo’s VP4 sentence')
    assert.equal(typeof first.props.onDismiss, 'function', 'the phone’s VP4 demo note cannot be put away')
    /* Put away, it stays away: on this draw, on the next launch, and through another unit and back. */
    first.props.onDismiss()
    await new Promise((r) => setTimeout(r, 0))
    assert.equal(phone.kept.get(phone.key), 'seen', 'putting the note away is not kept on the phone')
    assert.equal(await phone.draw(), null)
    assert.equal(await phone.mount(), null, 'the VP4 demo note came back on the next launch after it was put away')
    phone.bench.unit = 'fm3'
    assert.equal(await phone.draw(), null)
    phone.bench.unit = 'vp4'
    assert.equal(await phone.draw(), null, 'the VP4 demo note came back after a trip to another unit')
    /* Never for another unit, never off the demo, and never before the phone's storage has answered. */
    phone.kept.clear()
    for (const unit of ['fm3', 'fm9', 'am4', 'axefx3']) {
      phone.bench.unit = unit
      assert.equal(await phone.mount(), null, `the phone’s Play says the VP4’s sentence over a demo ${unit}`)
    }
    phone.bench.unit = 'vp4'
    phone.bench.demo = false
    assert.equal(await phone.mount(), null, 'the phone’s Play says the demo’s VP4 sentence off the demo')
    phone.bench.demo = true
    assert.ok(phone.key !== 'fractal.offerDismissed', 'the VP4 demo note shares its key with the unlock offer')
    /* Hidden until storage answers: the first draw, before its effect, is nothing. */
    assert.match(flat('mobile/src/components/Vp4DemoNote.js'), /const \[seen, setSeen\] = useState\(true\)/, 'the VP4 demo note flashes up before the phone knows it was put away')
    /* At the top of Play, under the offer, and once. */
    const stage = flat('mobile/src/screens/Stage.js')
    /* Each in its turn since 18 October 2026: the VP4's sentence before the offer, never beside it (Stage's `wants`, test/independent.mjs). */
    assert.match(stage, /<UnlockOffer onUnlock=\{onUnlock\} waiting=\{noteBefore\('offer'\)\} onWant=\{says\.offer\} \/> \{\/\*[^*]*\*\/\} <Vp4DemoNote waiting=\{noteBefore\('vp4'\)\} onWant=\{says\.vp4\} \/>/, 'the phone’s Play does not put the demo’s VP4 sentence at its top')
    assert.equal((stage.match(/<Vp4DemoNote /g) || []).length, 1)
    /* The browser: its banner over Play, kept for a VP4 apart (held, run, above). */
    const web = flat('src/App.jsx')
    assert.match(web, /\{isDemo\(\) && status === 'live' && !demoNoteSeen \? \( <p className="demo-banner"> <span>\{demoSentence\(demoUnit\(\)\)\}<\/span>/, 'the browser’s Play no longer says the demo’s sentence')

    /* The walkthrough's last screen: a VP4 is shown PLAY and EDIT, and every other unit all three, at both ends. */
    const { P9, D5 } = await import('../shared/onboarding.mjs')
    assert.deepEqual(P9.tips.map((t) => t.key), ['play', 'edit', 'save'], 'the walkthrough’s cards moved; say what a VP4 is shown')
    assert.deepEqual(v.walkthroughTips(P9.tips, 'vp4').map((t) => t.key), ['play', 'edit'])
    assert.deepEqual(v.walkthroughTips(D5.tips, VP4_DETECT).map((t) => t.key), ['play', 'edit'], 'the computer’s walkthrough tells a VP4 on its USB to save from the computer')
    for (const unit of ['fm3', 'fm9', 'am4', 'axefx3', FM3_DETECT, null, undefined]) {
      assert.equal(v.walkthroughTips(P9.tips, unit), P9.tips, `the walkthrough left out a card for ${JSON.stringify(unit)}`)
    }
    assert.equal(P9.tips.length, 3, 'walkthroughTips changed the cards it was given')
    const phoneWalk = flat('mobile/src/screens/Onboarding.js')
    const webWalk = flat('src/components/PhoneWalkthrough.jsx')
    const computerWalk = flat('src/components/Onboarding.jsx')
    assert.match(phoneWalk, /\{walkthroughTips\(P9\.tips, unit\)\.map\(\(tip\) => \(/, 'the phone’s walkthrough shows a VP4 SAVE')
    assert.match(webWalk, /\{walkthroughTips\(P9\.tips, unit\)\.map\(\(tip\) => \(/, 'the browser’s walkthrough shows a VP4 SAVE')
    assert.match(computerWalk, /\{walkthroughTips\(D5\.tips, found \? device : null\)\.map\(\(tip\) => \(/, 'the computer’s walkthrough shows a VP4 SAVE')
    for (const [end, text] of [['phone', phoneWalk], ['browser', webWalk], ['computer', computerWalk]]) {
      assert.ok(!/\b(P9|D5)\.tips\.map/.test(text), `the ${end}’s walkthrough draws its cards another way too`)
    }
    assert.match(phoneWalk, /import \{ walkthroughTips \} from '\.\.\/lib\/vp4-safety'/)
  })

  /*
   * WHAT THE REVIEW OF THE FIRST ROUND FOUND, held. Each of these was a VP4
   * owner being told something the app cannot do, or a refusal that moved
   * Play under a thumb.
   */
  test('a VP4’s words offer no help link but the update one: “pick the preset again” reloads it on a VP4', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    const { fixFor } = await import('../shared/troubleshooting.mjs')
    const phoneFix = (await import('../mobile/src/lib/troubleshooting.js')).fixFor
    const words = [
      v.VP4_SCENES_NOT_SET_UP, v.vp4SceneUnconfirmed(1, 34, 1), v.vp4SceneHeld(34), v.vp4PresetUnconfirmed(1), v.VP4_NEEDS_USB,
      v.VP4_NO_STEP, v.VP4_RELOAD, v.VP4_NO_TUNER, v.VP4_NO_TEMPO, v.VP4_NO_CHANNELS, v.VP4_NO_RENAME, v.VP4_NO_WHICH_PRESET,
      v.VP4_CANT_YET, v.VP4_NO_SAVE, v.VP4_NO_KNOBS, v.VP4_LATE, v.VP4_PRESET_AGAIN, v.VP4_NOT_IN_CHAIN, v.VP4_NO_NAMES, v.VP4_NO_EDITS
    ]
    for (const w of words) {
      assert.equal(fixFor(w), null, `a VP4 refusal offers a fix that does not fit it: ${fixFor(w)} for “${w}”`)
      assert.equal(phoneFix(w), null, `the phone offers a fix for a VP4 refusal: “${w}”`)
    }
    assert.equal(fixFor(v.VP4_UPDATE_COMPUTER), 'versions', 'the old computer’s VP4 words lost their help link')
    assert.equal(phoneFix(v.VP4_UPDATE_COMPUTER), 'versions')
    /* Nothing else moved: a preset that will not load on an FM3 still gets its fix. */
    assert.equal(fixFor('The unit didn’t load that preset.'), 'preset')
    assert.equal(fixFor('The computer is not answering.'), 'connect')
  })

  /*
   * AND THE PAGE THAT LINK OPENS AGREES WITH IT. A VP4 tap on a computer that
   * cannot change its scenes and presets says to update the computer and links
   * to "The app and the computer disagree", whose version line said "That is
   * fine" for any computer from COMPUTER_NEEDED on, and the red line stayed
   * off. Both are now told by what the computer says it can do for the VP4,
   * not by raising COMPUTER_NEEDED, so every other unit sees what it saw.
   */
  test('a VP4 on a computer that cannot change its scenes and presets: the red line and the help page say update, at both ends, and nothing else moves', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    const pv = await import('../mobile/src/lib/vp4-safety.js')
    const ends = [
      ['shared', await import('../shared/link-chain.mjs'), await import('../shared/troubleshooting.mjs'), v],
      ['phone', await import('../mobile/src/lib/link-chain.js'), await import('../mobile/src/lib/troubleshooting.js'), pv]
    ]
    const { COMPUTER_NEEDED, isOlder } = await import('../shared/versions.mjs')
    const PHONE = '1.87.40'
    const COMPUTER = '1.87.29'
    assert.equal(isOlder(COMPUTER, COMPUTER_NEEDED), false, 'the case is a computer new enough for everything but the VP4')
    for (const [where, chain, help, safety] of ends) {
      assert.equal(safety.vp4ComputerLacks(true, VP4_OLD.capabilities), safety.VP4_COMPUTER_FOR, `${where}: an old computer under a VP4 lacks nothing`)
      assert.equal(safety.vp4ComputerLacks(true, VP4_NEW.capabilities), null, `${where}: a computer that can is said to lack it`)
      assert.equal(safety.vp4ComputerLacks(false, VP4_OLD.capabilities), null, `${where}: a unit that is not a real VP4 is said to need a newer computer`)
      assert.equal(safety.vp4ComputerLacks(false, null), null)
      const card = (lacks, version = COMPUTER) =>
        chain.linkChain({ here: 'phone', unit: { name: 'VP4', state: 'present' }, computer: { name: 'Studio', version, link: 'connected', lacks }, phone: { version: PHONE } }).find((c) => c.key === 'computer')
      assert.equal(card(safety.VP4_COMPUTER_FOR).warn, chain.UPDATE_COMPUTER, `${where}: no red line for a VP4 on a computer that cannot change its scenes and presets`)
      assert.equal(card(null).warn, undefined, `${where}: the red line came on for a computer new enough for its unit`)
      assert.equal(card(safety.VP4_COMPUTER_FOR, PHONE).warn, undefined, `${where}: a computer on this phone's own version is sent looking for a newer one`)
      assert.equal(card(safety.VP4_COMPUTER_FOR, '1.87.50').warn, undefined, `${where}: a computer ahead of this phone is sent looking for a newer one`)
      const said = help.versionsInSync({ app: PHONE, host: COMPUTER, lacks: safety.VP4_COMPUTER_FOR })
      assert.equal(said.state, 'behind', `${where}: the help page says the computer is fine for a VP4 it cannot change`)
      assert.equal(said.says, `The computer app is v${COMPUTER}, and this app needs a newer one for a VP4’s scenes and presets. Let the computer update, then reload this app.`)
      assert.equal(help.versionsInSync({ app: PHONE, host: COMPUTER }).state, 'ok', `${where}: every other unit's help page moved`)
      assert.equal(help.versionsInSync({ app: PHONE, host: PHONE, lacks: safety.VP4_COMPUTER_FOR }).state, 'ok', `${where}: the same version is called behind`)
      assert.equal(help.fixFor(safety.VP4_UPDATE_COMPUTER), 'versions', `${where}: the VP4's update words lost the link to that page`)
    }
    /* And each end asks it of what its computer said, where the line and the page are drawn. */
    const settings = flat('mobile/src/screens/Settings.js')
    assert.match(settings, /computer: \{ name: macName, version: hostVersion, link, lacks: vp4ComputerLacks\(onRealVp4, caps\) \}/, 'the phone’s computer card is not told about the VP4')
    assert.match(flat('mobile/src/screens/Fixes.js'), /versionsInSync\(\{ app: APP_VERSION, host: hostVersion, lacks: vp4ComputerLacks\(vp4Here\(\), vp4Capabilities\(\)\) \}\)/, 'the phone’s help page is not told about the VP4')
    const web = flat('src/App.jsx')
    assert.match(web, /\? \{ name: link\.macName, version: link\.macVersion, link: link\.link, lacks: vp4ComputerLacks\(onRealVp4, vp4Capabilities\(\)\) \}/, 'the browser’s computer card is not told about the VP4')
    assert.equal((web.match(/versionsInSync\(\{ app: VERSION, host: link\.macVersion, lacks: vp4ComputerLacks\(onRealVp4, vp4Capabilities\(\)\) \}\)/g) || []).length, 2, 'the browser’s help page is not told about the VP4')
    assert.equal((web.match(/versionsInSync\(/g) || []).length, 2, 'a browser version line that is not told about the VP4')
  })

  test('a VP4’s refusal is known by its mark or by its words, at either end, and nothing else is one', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    assert.equal(v.aboutVp4(v.vp4Refusal(v.VP4_NO_STEP)), true)
    assert.equal(v.aboutVp4(Object.assign(new Error('x'), { cause: v.vp4Refusal('x') })), true, 'the browser’s wrapped refusal is not known')
    assert.equal(v.aboutVp4(Object.assign(new Error(v.VP4_LATE), { status: 503 })), true, 'the computer’s words about a VP4 are not known')
    assert.equal(v.aboutVp4(v.VP4_NO_TEMPO), true)
    for (const no of [new Error('The unit didn’t load that preset.'), 'Not sent — not connected', null, undefined, {}]) assert.equal(v.aboutVp4(no), false, `${String(no?.message ?? no)} is taken for a VP4 refusal`)
  })

  test('the browser’s Play says a VP4’s refusals over the screen, in the dropped tap’s band, and never in the page', () => {
    const gig = flat('src/components/Gig.jsx')
    assert.match(gig, /onError: raiseInPage,/, 'Play’s refusals still go straight to the notice in the page')
    assert.match(gig, /const onError = \(err\) => \{ if \(vp4Here\(\) && aboutVp4\(err\)\) setDropped\(\{ words: typeof err === 'string' \? err : err\?\.message, at: Date\.now\(\), ms: VP4_SAID_MS \}\) else raiseInPage\(err\) \}/, 'a VP4 refusal on Play moves the scenes and pedals down')
    assert.match(gig, /const t = setTimeout\(\(\) => setDropped\(null\), dropped\.ms \|\| NOT_SENT_SHOWN_MS\)/, 'a VP4 refusal goes in a dropped tap’s three seconds')
    const ms = Number(/const VP4_SAID_MS = (\d+)/.exec(read('src/components/Gig.jsx'))?.[1])
    assert.ok(ms >= 6000 && ms <= 12000, `a VP4 refusal is up ${ms} ms: too short to read, or long enough to be in the way`)
  })

  test('the browser’s Save is not offered on a VP4, and a refusal stays on the sheet in its words', () => {
    const app = read('src/App.jsx')
    assert.match(flat('src/App.jsx'), /\{onRealVp4 \? null : \( <button className="chip preset-menu-more" onClick=\{\(\) => \{ setPresetMenu\(false\) setSheet\('save'\) \}\} > Save to a slot…/, 'the preset menu offers a VP4 “Save to a slot…”')
    assert.match(app, /status === 'live' && view !== 'gig' && !onRealVp4 \? \(\s*<SaveBar/, 'the bar offers a VP4 Save')
    assert.match(app, /refused=\{onRealVp4 \? VP4_NO_SAVE : null\}/, 'the sheet asks to overwrite a slot on a VP4')
    /* Only a VP4's refusal keeps it open: every other unit's Save closes the sheet after a press, as it always did. */
    assert.equal((app.match(/if \(\(await save\(\)\) \|\| !onRealVp4\) setSheet\(null\)/g) || []).length, 2, 'the sheet closes on a VP4’s refusal, or no longer closes for every other unit')
    assert.doesNotMatch(app, /await save\(\)\s*setSheet\(null\)/, 'a Save press closes the sheet whatever happened')
    assert.doesNotMatch(app, /if \(await save\(\)\) setSheet\(null\)/, 'an FM3’s failed save leaves the sheet open, which it never did')
    /* Every refusal in save() answers false, and the two ways a save starts answer true. */
    const save = app.slice(app.indexOf('  const save = async () => {'), app.indexOf('  const save = async () => {') + 9000)
    const head = save.slice(0, save.indexOf('setBusy(true)'))
    assert.equal((head.match(/\breturn\b/g) || []).length, (head.match(/return false/g) || []).length, 'a refusal in save() answers nothing, and the sheet cannot tell it from a save')
    assert.match(save, /record\('save', `Asked the computer to save[^`]*`\)\s*return true/)
    assert.match(save, /presetSaved\(number, name \|\| preset\?\.name\)\s*return true/)
    const sheet = flat('src/components/SaveSheet.jsx')
    assert.match(sheet, /if \(refused\) \{ return \( <div className="save-foot"> <p className="hint save-target-warn">\{refused\}<\/p> <button className="primary save-confirm" disabled>/, 'a refused save still has a live button, or no words')
  })

  test('neither end promises a VP4 preset names: one sentence, the same at both, and no Refresh', () => {
    const phone = flat('mobile/src/screens/Presets.js')
    assert.match(phone, /const noNames = vp4Here\(\)/)
    assert.match(phone, /\{noNames \? null : <Press label=\{refreshing \? 'Reading…' : 'Refresh'\}/, 'the phone offers a VP4 a Refresh that reads nothing')
    assert.match(phone, /\{noNames \? \( <View[^>]*> <Text[^>]*>\{vp4Old \? VP4_UPDATE_COMPUTER : VP4_NO_NAMES\}<\/Text>/, 'the phone says the names “fill in as you scroll” on a VP4')
    assert.match(phone, /\{hunting && !noNames \?/, 'the phone says “Tap Refresh to get the rest” on a VP4')
    assert.match(flat('mobile/src/components/SongPicker.js'), /\{vp4Here\(\) \? \( <Text[^>]*>\{vp4ComputerCan\(caps\) \? VP4_NO_NAMES : VP4_UPDATE_COMPUTER\}<\/Text> \) : slots && knownCount\(\) < slots/, 'the song picker promises a VP4 names')
    const web = flat('src/components/Console.jsx')
    assert.match(web, /const \[showAll, setShowAll\] = useState\(noNames\)/, 'the browser opens a VP4’s list on “No names read yet” instead of its slots')
    assert.match(web, /\{noNames \? null : \( <button className="icon-btn" onClick=\{scanning \? onStop : onScan\}/, 'the browser offers a VP4 ⟳')
    assert.match(web, /\{noNames \? <p className="hint pad">\{vp4Old \? VP4_UPDATE_COMPUTER : VP4_NO_NAMES\}<\/p> : null\}/, 'the browser does not say why a VP4’s list has no names')
    assert.match(web, /\{!needle && hidden > 0 && !noNames \?/)
    assert.match(web, /\{deviceSlots && named\.length && !noNames \?/)
  })

  test('a VP4’s pedals say nothing until tapped, at both ends, and say why once', () => {
    const stage = flat('mobile/src/screens/Stage.js')
    assert.match(stage, /const unknown = \(chainNow\.outline \|\| vp4Here\(\)\) && typeof block\.bypassed !== 'boolean'/, 'the phone’s VP4 pedals say On over an on/off nobody read')
    assert.match(stage, /if \(chainNow\.outline && typeof block\.bypassed !== 'boolean'\) return/, 'a VP4 pedal’s tap no longer goes, or an outline’s does')
    assert.match(stage, /\{vp4Here\(\) && blocks\.length && !chainNow\.elsewhere \? \( <Text[^>]*>\{VP4_ON_OFF_UNKNOWN\}<\/Text>/)
    const gig = flat('src/components/Gig.jsx')
    assert.match(gig, /const unknown = !rec && \(outline \|\| vp4Here\(\)\) && typeof block\.bypassed !== 'boolean'/, 'the browser’s VP4 pedals say On over an on/off nobody read')
    assert.match(gig, /\{!shown\.elsewhere && blocks\.length && vp4Here\(\) \? <p className="gig-note">\{VP4_ON_OFF_UNKNOWN\}<\/p> : null\}/)
    /* The edit screens: no On, no Engaged, no channel A. */
    const edit = flat('mobile/src/screens/Edit.js')
    assert.match(edit, /const unsure = vp4Here\(\) && typeof b\.bypassed !== 'boolean' const engaged = !unsure && !b\.bypassed/)
    assert.match(edit, /label=\{unsure \? 'Turn it off' : engaged \? 'Engaged' : 'Bypassed'\}/)
    const strip = flat('src/components/Console.jsx')
    assert.match(strip, /\{block\.channel \|\| \(vp4Here\(\) \? '' : 'A'\)\}/, 'the browser’s chain says channel A on a VP4')
    assert.match(strip, /typeof block\.bypassed !== 'boolean' && vp4Here\(\) \? \(/, 'the browser’s chain says On over a VP4’s unread on/off')
    /*
     * And an opened block's on/off. The browser's panel said "Engaged", lit,
     * over an on/off nobody read, where the phone's says what a press does.
     * Both now: "Turn it off", unlit, and the press sends off (bypassed: true)
     * — `engaged` and `wanted` are both !block.bypassed, true for a null.
     */
    assert.match(edit, /const engaged = !block\.bypassed \/\* [^*]*\*\/ const unsure = vp4Here\(\) && typeof block\.bypassed !== 'boolean'/, 'the phone’s block panel judges a VP4’s on/off another way')
    assert.match(edit, /<Press label=\{unsure \? 'Turn it off' : engaged \? 'Engaged' : 'Bypassed'\} tone="signal" on=\{engaged && !unsure\} onPress=\{\(\) => writeBypass\(eid, engaged\)\} \/>/, 'the phone’s block panel says or lights a VP4’s unread on/off')
    assert.match(strip, /const unsure = vp4Here\(\) && typeof block\?\.bypassed !== 'boolean'/, 'the browser’s block panel does not know a VP4’s on/off is unread')
    assert.match(strip, /className=\{`bypass-btn \$\{block\.bypassed \|\| unsure \? 'off' : ''\}`\} onClick=\{async \(\) => \{ const wanted = !block\.bypassed/, 'the browser’s block panel lights a VP4’s unread on/off, or sends something else')
    assert.match(strip, /\{unsure \? 'Turn it off' : block\.bypassed \? 'Bypassed' : 'Engaged'\}/, 'the browser’s block panel says “Engaged” over a VP4’s unread on/off')
    assert.equal((strip.match(/'Turn it off'/g) || []).length, 1)
    /* And after a scene, the VP4 moves them: a null is "not known" at both ends, not "as it was". */
    assert.match(flat('mobile/src/lib/rig.js'), /bypassed: vp4 \? s\.bypassed \?\? null : s\.bypassed \?\? b\.bypassed/)
    assert.match(flat('src/lib/deviceState.js'), /const bypassed = vp4 \? s\.bypassed \?\? null : s\.bypassed \?\? b\.bypassed/)
  })

  /*
   * A VP4'S PRESETS, ALL "EMPTY". The computer that changes a VP4's presets
   * says it holds 104 (every one before said it did not know), so the browser
   * started its background name scan on a VP4: 4 s after the computer's own
   * window went live, and whenever the picker opened on the website. A VP4's
   * "which name" is null (vp4Route), which storedName took as '' and followed
   * with GET /presets/n/summary — a 501 on a VP4, so "known": every slot
   * learned as "Empty", kept, and published to the computer's store, where
   * phones drew 104 rows of "Empty" over presets that are not, with no
   * Refresh on a VP4 to clear them. Now: no scan on a VP4, nothing asked and
   * nothing cached for one, and the empties an old page already wrote — into
   * the computer's store or this browser's own — are not believed, at
   * either end. Nothing of this reached the pedal: the summary is the
   * computer's own refusal.
   */
  test('a VP4’s presets are never learned as “Empty”: no scan, nothing asked, and an old page’s empties not believed, at both ends', async () => {
    /* The browser's scan: none on a VP4, whatever the computer says it holds. */
    assert.match(flat('src/App.jsx'), /const namesTotal = onRealVp4 \? 0 : slotCount\(device\?\.capabilities\) \?\? 0/, 'the browser scans a VP4’s preset names')
    const disk = memoryStorage()
    disk.setItem('fractal.presetNames', JSON.stringify({ vp4: { 0: '', 3: '', 9: 'Kept' }, fm3: { 0: '' } }))
    await withLocalStorage(disk, async () => {
      const { ffx, computer } = await browserOnABench()
      computer.state.unit = VP4_NEW
      await ffx.detect()
      computer.state.docs = { [`/store/config/preset-names-${ffx.currentDeviceSlug()}`]: { data: { 0: '', 1: '', 5: '<EMPTY>' } } }
      computer.asked.length = 0
      for (const n of [0, 1, 2, 103]) assert.deepEqual(await ffx.storedName(n), { name: '', known: false }, `slot ${n} of a VP4 is known`)
      await assert.rejects(ffx.learnName(7), 'a VP4 slot was learned')
      assert.equal(await ffx.rememberedName(7), '')
      assert.deepEqual(computer.asked, [], 'a VP4 was asked for a stored preset’s name or summary')
      /* What this browser kept from before, and the computer's copy: the empties go, a name stays. */
      assert.equal(await ffx.importHostNames(), 0, 'the browser took a VP4’s empties off the computer')
      assert.deepEqual(ffx.cachedPresetNames(), [{ number: 9, name: 'Kept' }], 'the browser believes a VP4 slot is empty')
      assert.equal(ffx.knowsName(0), false)
      /* The control: on an FM3 an empty slot is an answer, as it always was — off this browser's disk and off the computer's copy. */
      computer.state.unit = FM3_DETECT
      await ffx.detect()
      computer.state.docs = { [`/store/config/preset-names-${ffx.currentDeviceSlug()}`]: { data: { 1: '' } } }
      assert.equal(await ffx.importHostNames(), 1)
      assert.deepEqual(ffx.cachedPresetNames(), [{ number: 0, name: '' }, { number: 1, name: '' }])
    })

    /* The phone: its names module as it is, beside a computer whose store holds an old page's empties. */
    const dir = mkdtempSync(join(tmpdir(), 'vp4-names-'))
    try {
      writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
      writeFileSync(join(dir, 'react.js'), 'export const useEffect = () => {}\nexport const useSyncExternalStore = () => 0\n')
      writeFileSync(
        join(dir, 'device.js'),
        'export let onVp4 = false\nexport const __vp4 = (on) => { onVp4 = on }\nexport const vp4Here = () => onVp4\n' +
          'export const asked = []\nexport let hostDoc = null\nexport const __host = (d) => { hostDoc = d }\n' +
          'export async function storedNames(slug) { return hostDoc ? hostDoc[slug] ?? null : null }\n' +
          'export async function presetName(n) { asked.push(n); return { number: n, name: null, empty: false } }\n'
      )
      const mem = memoryStorage()
      mem.setItem('fractal.presetNames', JSON.stringify({ vp4: { at: 1, names: { 4: '', 8: '<EMPTY>' } } }))
      globalThis.__vp4NamesDisk = mem
      writeFileSync(join(dir, 'store.js'), 'export const hydrate = () => Promise.resolve()\nexport const sync = globalThis.__vp4NamesDisk\n')
      writeFileSync(join(dir, 'presetName.js'), read('mobile/src/lib/presetName.js'))
      const src = read('mobile/src/lib/presetNames.js')
        .replace("from 'react'", "from './react.js'")
        .replace(/from '\.\/([\w-]+)'/g, (whole, f) => `from './${f}.js'`)
      writeFileSync(join(dir, 'presetNames.js'), src)
      const unit = await import(pathToFileURL(join(dir, 'device.js')).href)
      const names = await import(pathToFileURL(join(dir, 'presetNames.js')).href)
      unit.__vp4(true)
      unit.__host({ vp4: { 0: '', 1: '', 2: '<EMPTY>', 103: '' } })
      await names.adopt('vp4')
      for (const n of [0, 1, 2, 4, 8, 103]) assert.equal(names.nameOf(n), undefined, `the phone believes VP4 slot ${n} is empty, and draws “Empty” over it`)
      assert.equal(names.knownCount(), 0)
      assert.deepEqual(unit.asked, [], 'the phone asked a VP4 for names to make up for them')
      /* So each row draws its place, A1 to Z4, as for any slot whose name is not known. */
      const { slotLabel } = await import(repoUrl('src/lib/slots.js'))
      assert.match(slotLabel(0, 'bankLetterShort'), /\bA1$/)
      assert.match(slotLabel(103, 'bankLetterShort'), /\bZ4$/)
      assert.match(flat('mobile/src/screens/Presets.js'), /label=\{typeof name === 'string' \? \(name \|\| 'Empty'\) : `Slot \$\{slotLabel\(n, addressing\)\}`\}/)
      /* The control: on an FM3 the computer's empty is an answer. */
      unit.__vp4(false)
      unit.__host({ fm3: { 0: '' } })
      await names.adopt('fm3')
      assert.equal(names.nameOf(0), '')
    } finally {
      delete globalThis.__vp4NamesDisk
      rmSync(dir, { recursive: true, force: true })
    }
  })

  /*
   * THE PRESET LIST NAMES THE ONE A VP4 IS ON, AT BOTH ENDS. VP4_NO_NAMES says
   * "A preset you pick from the app shows its name once the VP4 has loaded
   * it". The browser's row did ("004 B1: Edge of Breakup"); the phone's said
   * "Slot 004 B1 · Playing" under that sentence with Play showing the name.
   * And a VP4 owner searching for "B1", the pedal's own name for it, found
   * nothing at either end.
   *
   * The sentence used to say "The one the VP4 is on shows its name once the
   * app has read it", untrue both ways: at the start Play has the name and
   * no row does (the app can't tell which slot it is), and a preset picked
   * from the app keeps its name on its row after the VP4 has moved on.
   */
  test('the preset list names the preset a VP4 is on, from its record, and finds A1 to Z4 by name, at both ends', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    assert.equal(v.VP4_NO_NAMES, 'The app can’t read the names of a VP4’s presets yet, so the list shows them as A1 to Z4. A preset you pick from the app shows its name once the VP4 has loaded it.')
    assert.doesNotMatch(v.VP4_NO_NAMES, /the one the VP4 is on/i, 'the list promises the name of the preset the VP4 is on, which no row has at the start')
    const src = read('mobile/src/screens/Presets.js')
    const phone = src.replace(/\s+/g, ' ')
    assert.match(phone, /renderItem=\{\(\{ item: n \}\) => \{ const name = nameHere\(n\)/, 'the phone’s row does not name the preset the VP4 is on')
    assert.match(phone, /label=\{typeof name === 'string' \? \(name \|\| 'Empty'\) : `Slot \$\{slotLabel\(n, addressing\)\}`\}/)
    assert.match(phone, /const name = nameHere\(n\) const q = query\.trim\(\)\.toLowerCase\(\)/, 'the phone’s search does not find the preset the VP4 is on by its name')
    /* Run: the rule that picks the name, out of the screen as written. */
    const body = src.slice(src.indexOf('  const vp4Playing ='), src.indexOf('\n', src.indexOf('  const nameHere =')))
    const rule = (noNames, preset, recordName) =>
      new Function('noNames', 'preset', 'vp4PresetName', 'nameOf', `${body}; return nameHere`)(noNames, preset, () => recordName, (n) => (n === 7 ? 'Kept' : undefined))
    const edge = 'Edge of Breakup'
    assert.equal(rule(true, { number: 4, name: edge }, edge)(4), edge, 'the row of the preset the VP4 is on has no name')
    assert.equal(rule(true, { number: 4, name: edge }, edge)(5), undefined, 'another row took the name of the preset the VP4 is on')
    assert.equal(rule(true, { number: 4, name: edge }, edge)(7), 'Kept')
    assert.equal(rule(true, { number: 4, name: edge, pending: true }, edge)(4), undefined, 'a preset still being changed to is named')
    assert.equal(rule(true, { number: 4, name: 'Remembered' }, edge)(4), undefined, 'a name the VP4’s record did not carry is put on the row')
    assert.equal(rule(true, { number: null, name: edge }, edge)(4), undefined, 'an unseen preset’s name is put on a slot nobody saw it land in')
    assert.equal(rule(true, { number: 4, name: '' }, '')(4), undefined)
    assert.equal(rule(false, { number: 4, name: edge }, edge)(4), undefined, 'another unit’s rows are named by the VP4’s rule')
    /* The browser's row is named off its own list, which takes the name the record carried (noteLoadedName). */
    const web = flat('src/components/Console.jsx')
    assert.match(web, /<span className="preset-id mono">\{slotLabel\(slot\.number, addressing\)\}:<\/span>/)
    /* Search by the VP4's own name for a place, at both ends: "B1" is 004 B1, "B" the B bank, and a number is still a number. */
    assert.match(phone, /if \(noNames && vp4PresetCode\(n\)\?\.toLowerCase\(\)\.startsWith\(q\)\) return true/, 'the phone’s search does not find a VP4’s B1')
    assert.match(web, /\(noNames && \(vp4PresetCode\(s\.number\) \|\| ''\)\.toLowerCase\(\)\.startsWith\(needle\)\)/, 'the browser’s search does not find a VP4’s B1')
    const finds = (q) => Array.from({ length: 104 }, (_, n) => n).filter((n) => v.vp4PresetCode(n).toLowerCase().startsWith(q))
    assert.deepEqual(finds('b1'), [4])
    assert.deepEqual(finds('b'), [4, 5, 6, 7])
    assert.deepEqual(finds('z4'), [103])
    assert.deepEqual(finds('4'), [], 'a number is matched by the code as well as by itself')
  })

  /*
   * AN UNKNOWN PEDAL AND AN OFF ONE WERE THE SAME TILE in the browser at a
   * narrow width, where the corner word has no room: a first tap, which sends
   * Off, changed nothing on screen. A VP4's untapped pedal has a dashed ring.
   */
  test('the browser draws a VP4 pedal nobody has tapped unlike an Off one, at any width', () => {
    const gig = flat('src/components/Gig.jsx')
    assert.match(gig, /className=\{`gig-block \$\{unknown \|\| block\.bypassed \? 'off' : 'on'\}`\} (\/\*[^*]*(\*(?!\/)[^*]*)*\*\/ )?data-unknown=\{unknown && vp4Here\(\) \? 'yes' : undefined\}/, 'a VP4’s untapped pedal is not marked apart from an Off one')
    assert.match(flat('src/styles.css'), /button\.gig-block\.off\[data-unknown='yes'\] \{ border-style: dashed; \}/, 'the mark draws nothing')
  })

  /*
   * REVERT ON A VP4 LOADED THE WRONG PRESET, OR NOTHING. The browser's Revert
   * is "load the preset again"; with a VP4's place unknown it did nothing and
   * said nothing, and with it known it sent a Program Change for the preset
   * the app last picked, which is another one if the player has moved at the
   * footswitch since. The phone has no Revert. Neither end offers one now.
   */
  test('the browser offers no Revert on a VP4, in the Edit row or the save sheet, as the phone offers none', () => {
    const web = flat('src/App.jsx')
    assert.match(web, /\{dirty && !onRealVp4 \? \( <button className="chip armed" onClick=\{revert\} disabled=\{busy\}> Revert <\/button> \) : null\}/, 'the browser’s Edit row offers a VP4 a Revert')
    assert.match(web, /onRevert=\{onRealVp4 \? null : revert\}/, 'the browser’s save sheet offers a VP4 a Revert')
    assert.equal((web.match(/onRevert=\{/g) || []).length, 1)
    assert.match(flat('src/components/SaveSheet.jsx'), /\{onRevert \? \( <button className="chip" onClick=\{onRevert\} disabled=\{busy\}> Revert to saved <\/button> \) : null\}/)
    for (const where of ['mobile/src/screens/Edit.js', 'mobile/src/screens/Stage.js']) assert.ok(!/>\s*Revert|label="Revert/.test(read(where)), `${where} grew a Revert`)
  })

  /*
   * EDIT ON A VP4 OFFERED KNOBS THE APP CANNOT READ. The search box said
   * "Find a control — gain, mix, presence…" and answered "No control called
   * “gain” in this preset" over a preset with a Drive in it; the phone said
   * "Tap a block to open its controls", and the tap raised the knobs refusal
   * as a red fault that pushed the page down (twice in the browser at 1280:
   * the top and the side panel). Now, at both ends: no search, the knobs'
   * words once where the hint was, and a block opens with its on/off and no
   * read, so nothing is raised.
   */
  test('Edit on a VP4 offers no control search and no knobs, and says why once, at both ends', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    const edit = flat('mobile/src/screens/Edit.js')
    /* The phone: the search box only off a VP4, the hint only off a VP4, the knobs' words once. */
    assert.match(edit, /\{vp4Here\(\) \? null : \( <FindControl /, 'the phone’s Edit offers a VP4 the control search')
    assert.equal((edit.match(/<FindControl /g) || []).length, 1, 'the phone’s Edit has another way to the control search')
    assert.match(edit, /\) : blocks\.length && !chainNow\.elsewhere && !vp4Here\(\) \? \( <Note>Tap a block to open its controls\.<\/Note> \) : null\}/, 'the phone’s Edit tells a VP4 to tap a block for its controls')
    assert.match(edit, /\{vp4Here\(\) && blocks\.length && !chainNow\.elsewhere \? <Note>\{VP4_NO_KNOBS\}<\/Note> : null\}/, 'the phone’s Edit does not say a VP4’s knobs can’t be shown')
    assert.equal((edit.match(/\{VP4_NO_KNOBS\}/g) || []).length, 1, 'the phone’s Edit says the knobs’ words more than once')
    /* An opened block: nothing read, so nothing refused and nothing raised as a fault. */
    assert.match(edit, /const knobless = vp4Here\(\) useEffect\(\(\) => \{ if \(knobless\) return undefined let stop = false ;\(async \(\) => \{ setLoading\(true\) setLocal\(\{\}\) try \{ const \[p, t\] = await Promise\.all\(\[ blockParams\(eid\)/, 'the phone’s block panel asks a VP4 for its knobs')
    /* The browser: both search boxes give way to the same words; its panel reads nothing either. */
    const app = flat('src/App.jsx')
    const searches = app.split('<ParamSearch ').slice(1)
    assert.equal(searches.length, 2, 'the browser has another control search to hold')
    for (const before of app.split('<ParamSearch ').slice(0, -1)) {
      assert.match(before, /\{onRealVp4 \? \( <p className="hint">\{VP4_NO_KNOBS\}<\/p> \) : \( $/, 'a browser control search is offered on a VP4')
    }
    const panel = flat('src/components/Console.jsx')
    assert.match(panel, /const knobless = vp4Here\(\) useEffect\(\(\) => \{ if \(!block \|\| knobless\) return let stop = false ;\(async \(\) => \{ setLoading\(true\) setLocal\(\{\}\) try \{ const \[p, t\] = await Promise\.all\(\[ blockParams\(block\.effectId\)/, 'the browser’s block panel asks a VP4 for its knobs')
    /* The same words at both ends (the phone's copy is generated from these, and held to them), and not a promise. */
    assert.match(edit, /import \{ VP4_NO_EDITS, VP4_NO_KNOBS \} from '\.\.\/lib\/vp4-safety'/)
    assert.match(app, /import \{ MIDI_SETUP_TITLE, VP4_NO_EDITS, VP4_NO_KNOBS, VP4_NO_RENAME, vp4ComputerLacks, vp4SetupStatus \} from '\.\.\/shared\/vp4-safety\.mjs'/)
    assert.doesNotMatch(v.VP4_NO_KNOBS, /coming|unsupported/i)
    /* "No control called …" is said by the search alone, which a VP4 never draws (comments, which quote it, aside). */
    const code = (text) => text.replace(/\/\*[^]*?\*\//g, '')
    assert.equal((code(edit).match(/No control called/g) || []).length, 1)
    assert.equal((code(flat('src/components/ParamSearch.jsx')).match(/No control called/g) || []).length, 1)
    assert.ok(!/No control called/.test(code(app)), 'the browser says “No control called” outside the search')
  })

  test('a VP4 is offered no channels, chain editing, modifiers or renaming it cannot do, at either end', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    const caps = { channelNames: ['A', 'B', 'C', 'D'], hasChannels: true, plainMidi: { programChange: true, sceneSelect: true }, sceneCount: 4 }
    assert.deepEqual(v.vp4ScreenCaps(caps), { ...caps, channelNames: [], hasChannels: false })
    assert.deepEqual(caps.channelNames, ['A', 'B', 'C', 'D'], 'vp4ScreenCaps changed the answer it was given')
    assert.equal(v.vp4ScreenCaps(null), null)
    assert.match(flat('mobile/src/lib/device.js'), /if \(onVp4\) res = vp4ScreenUnit\(res\)/)
    assert.match(flat('src/lib/forgefx.js'), /if \(unitIsVp4\) res = vp4ScreenUnit\(res\)/)
    const edit = flat('mobile/src/screens/Edit.js')
    assert.match(edit, /\{vp4Here\(\) \? \( <Note tone="hint">\{VP4_NO_EDITS\}<\/Note> \) : \( <> \{chainNow\.elsewhere \? null : <ChainEditor/, 'the phone offers a VP4 Edit chain and Modifiers')
    assert.match(edit, /function RenameDoor\(\) \{ const \[open, setOpen\] = useState\(false\) \/\*[^*]*\*\/ if \(vp4Here\(\)\) return null/, 'the phone offers to rename on a VP4')
    const app = flat('src/App.jsx')
    assert.equal((app.match(/\{onRealVp4 \? \( <p className="hint">\{VP4_NO_EDITS\}<\/p> \) : \(/g) || []).length, 2, 'the browser offers a VP4 its chain editor or modifiers')
    assert.match(app, /\{onRealVp4 \? null : \( <button type="button" className="chip" disabled=\{busy \|\| status !== 'live'\} onClick=\{\(\) => \{ setSheetBack\('chain'\) setSheet\('scenes'\) \}\} > Rename preset and scenes/)
    assert.match(flat('src/components/Gig.jsx'), /\{vp4Here\(\) \? ' Tap one to hear it\.' : ' Tap one to hear it\. Name them yourself under Scenes on Edit\.'\}/, 'Play tells a VP4 owner to name scenes on Edit')
  })

  /*
   * A VP4 BEHIND AN OLD COMPUTER APP (1.87.4 — Justin's Mac until Sunday).
   * That app reports no preset count for a VP4, so both lists said the names
   * note and the reload warning over no rows at all: a spinner that never
   * stopped on the phone, "Nothing matches “”." in the browser.
   */
  test('a VP4’s preset list behind an old computer app says to update it, and nothing else, at both ends', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    assert.equal(v.vp4ComputerCan(VP4_OLD.capabilities), false)
    assert.equal(v.vp4ComputerCan(v.vp4ScreenCaps(VP4_NEW.capabilities)), true, 'the screens’ VP4 capabilities lost what the computer can do')
    const phone = flat('mobile/src/screens/Presets.js')
    assert.match(phone, /const vp4Old = noNames && !vp4ComputerCan\(caps\)/)
    assert.match(phone, /<Text[^>]*>\{vp4Old \? VP4_UPDATE_COMPUTER : VP4_NO_NAMES\}<\/Text>/, 'the phone’s list on an old computer does not say to update it')
    assert.match(phone, /\{vp4Here\(\) && !vp4Old \? \( <View[^>]*> <Note tone="hint">\{VP4_RELOAD\}<\/Note>/, 'the phone warns of reloading a preset it cannot send')
    assert.match(phone, /ListEmptyComponent=\{ \/\*[^*]*\*\/ vp4Old \? null : slots \? \(/, 'the phone’s list on an old computer spins for ever')
    assert.match(phone, /\{vp4Old \? null : \( <View[^>]*> <TextInput/, 'the phone offers a search of a list that has no rows')
    const web = flat('src/components/Console.jsx')
    assert.match(web, /const vp4Old = noNames && !vp4ComputerCan\(vp4Capabilities\(\)\)/)
    assert.match(web, /\{noNames && !vp4Old \? <p className="hint pad">\{VP4_RELOAD\}<\/p> : null\}/, 'the browser warns of reloading a preset it cannot send')
    assert.match(web, /<div className="preset-scroll" ref=\{rows\}> \{vp4Old \? null : named\.length === 0/, 'the browser says “Nothing matches” under the update words')
    assert.match(web, /\{vp4Old \? null : \( <input type="text" className="preset-filter"/, 'the browser offers a search of a list that has no rows')
    /* The browser reads what the computer said, not the screens' copy (which keeps plainMidi too). */
    assert.match(flat('src/lib/forgefx.js'), /export const vp4Capabilities = \(\) => \(unitIsVp4 \? lastCaps : null\)/)
  })

  /*
   * A VP4 PRESET SENT AND NOT SEEN TO LAND, picked from the browser's list,
   * went to App's notice under "Didn't work" and pushed Play down. It was
   * sent; the binding rule is "couldn't confirm", never "failed".
   */
  test('the browser never says “Didn’t work” over a VP4’s preset words, and on Play says them over the tiles', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    const app = flat('src/App.jsx')
    const jump = app.slice(app.indexOf('const jumpTo = async (number) => {'), app.indexOf('const rename = async (name) => {'))
    assert.match(jump, /\} catch \(err\) \{ if \(onRealVp4 && view === 'play' && aboutVp4\(err\)\) setVp4Said\(\{ words: err\.message, at: Date\.now\(\) \}\) else setError\(err\.message\) \}/, 'a VP4 preset picked from the list still goes to App’s notice on Play')
    assert.match(app, /\{onRealVp4 && aboutVp4\(error\) \? null : <h2>Didn&rsquo;t work<\/h2>\}/, 'a VP4’s words are headed “Didn’t work”')
    assert.match(app, /<Gig [^]*?said=\{vp4Said\}/, 'Play is not handed the VP4’s words')
    const gig = flat('src/components/Gig.jsx')
    assert.match(gig, /useEffect\(\(\) => \{ const left = said\?\.words \? VP4_SAID_MS - \(Date\.now\(\) - said\.at\) : 0 if \(left > 0\) setDropped\(\{ words: said\.words, at: said\.at, ms: left \}\) \}, \[said\?\.at\]\)/, 'Play does not say the VP4 words it is handed in its band, or says old ones again')
    /* Every word the computer can answer an unseen preset with, and the fallback at both ends, is known for a VP4's. */
    for (const w of [v.vp4PresetUnconfirmed(1), v.vp4PresetUnconfirmed(16), 'Sent, but the app couldn’t confirm the VP4 changed preset.']) assert.equal(v.aboutVp4(w), true, w)
    assert.match(flat('src/lib/deviceState.js'), /unseen = res\.message \|\| 'Sent, but the app couldn’t confirm the VP4 changed preset\.'/)
    assert.match(flat('mobile/src/lib/rig.js'), /unseen = answer\.message \|\| 'Sent, but the app couldn’t confirm the VP4 changed preset\.'/)
    assert.match(flat('src/lib/deviceState.js'), /if \(unseen && run === presetRun\) throw Object\.assign\(new Error\(unseen\), \{ vp4: true, unconfirmed: true \}\)/, 'the store’s unseen preset is not marked as a VP4’s words')
  })

  /*
   * AND WHERE IT LEAVES THE BAR. After a Program Change the VP4 did not
   * visibly take, the phone kept the place it was sent to over the name the
   * VP4's record still carried — "PRESET 004 B1 OF 104 / Big Room", a header
   * that contradicted itself, and B1 while a VP4 with Receive MIDI PC off was
   * on A1 — and the browser showed "--" (or, for a preset played there before,
   * kept its number too). One rule at both ends: what was up before the tap
   * goes back with its place unknown, and nothing a VP4 answers is asked
   * where it is. Run at each end in test/mobile.mjs and test/run.mjs ("a
   * preset not seen to land"); held to the same shape here.
   */
  test('a VP4 preset not seen to land leaves the place unknown and what was up before, at both ends', () => {
    const phone = flat('mobile/src/lib/rig.js')
    const web = flat('src/lib/deviceState.js')
    assert.match(phone, /if \(unseen && run === presetRun\) \{ set\(recall \|\| readFirst \? wasChain : \{ chainKnown: wasChain\.chainKnown, chainOutline: wasChain\.chainOutline \}\) set\(\{ preset: was \? \{ \.\.\.was, number: null \} : null, sceneNames: wasNames \}\) \}/, 'the phone keeps the place an unseen VP4 preset was sent to')
    assert.match(web, /if \(unseen && run === presetRun\) set\(\{ \.\.\.left, preset: left\.preset \? \{ \.\.\.left\.preset, number: null \} : null, chainGoing: null \}\)/, 'the browser keeps the place an unseen VP4 preset was sent to')
    /* And neither takes a "which preset" answer over it. */
    assert.match(phone, /let again = Boolean\(unseen\) if \(!again\) \{ try \{ const fresh = await device\.currentPreset\(\)/)
    assert.match(web, /if \(unseen\) again = true else \{ try \{ const fresh = await driver\.currentPreset\(\)/)
  })

  /*
   * THE SCENES SHEET. Edit's scene chip opens it on a VP4 too, and it offered
   * Rename, Edit name, Copy a scene and the scene map: "Read scenes" sent five
   * Scene Select messages from one click and drew every effect On, a guess.
   */
  test('the browser’s Scenes sheet offers a VP4 its four scene buttons and no rename, copy or scene map', () => {
    const app = flat('src/App.jsx')
    const start = app.indexOf("open={sheet === 'scenes'}")
    assert.ok(start > 0, 'the Scenes sheet is not where the test looks for it')
    const sheet = app.slice(start, app.indexOf('</Sheet>', start))
    assert.match(sheet, /\{onRealVp4 \? null : <RenamePreset preset=\{preset\} busy=\{busy\} onRename=\{rename\} \/>\}/, 'the Scenes sheet offers a VP4 its preset’s name to type')
    assert.equal((sheet.match(/<RenamePreset\b/g) || []).length, 1)
    assert.match(sheet, /<Scenes [^>]*canRename=\{!onRealVp4\}/, 'the Scenes sheet offers a VP4 Edit name')
    const gate = sheet.indexOf('{onRealVp4 ? ( <p className="hint">{VP4_NO_RENAME}</p> ) : ( <>')
    assert.ok(gate > 0, 'the Scenes sheet does not say once why a VP4 has no rename there')
    for (const tool of ['<SceneCopy', '<SceneMatrix']) {
      assert.equal(sheet.split(tool).length - 1, 1, `${tool} is drawn twice in the Scenes sheet`)
      assert.ok(sheet.indexOf(tool) > gate, `${tool} can be drawn on a VP4`)
    }
    const scenes = flat('src/components/Scenes.jsx')
    assert.match(scenes, /\{hasScenes && canRename && renaming === null \? \( <button className="chip scene-edit-name"/, 'Scenes offers Edit name whatever it is told')
    assert.match(scenes, /\{canRename && renaming !== null \? \( <div className="rename-row">/)
    assert.match(scenes, /canRename = true,/, 'every other unit lost Edit name')
  })

  test('nothing walks a VP4 through its scenes, at the browser’s seam or either end’s copy, and an FM3 still walks', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    const storage = memoryStorage()
    await withLocalStorage(storage, async () => {
      const { ffx, computer } = await browserMidiBench()
      await ffx.detect()
      v.saveVp4Setup(storage, undefined, { sceneCc: 34, midiChannel: 1 }, 4242)
      computer.state.reply = (m, p) => (p === '/scene' ? { ok: true, index: 1, confirmed: true } : p === '/preset/scene-state' ? [] : { ok: true })
      computer.sent.length = 0
      await assert.rejects(ffx.readAllScenes(4), (err) => err.message === v.VP4_CANT_YET, 'Read scenes on a VP4 is not refused in words')
      await assert.rejects(ffx.setSceneBlock(2, 70, { bypassed: true }), (err) => err.message === v.VP4_CANT_YET)
      await assert.rejects(ffx.setSceneParam(2, 70, 1, 0.5, null), (err) => err.message === v.VP4_CANT_YET)
      assert.deepEqual(await ffx.applyScenes([{ index: 0, blocks: [] }]), [v.VP4_CANT_YET], 'a plan’s scenes on a VP4 are not refused')
      assert.deepEqual(computer.lines(), [], 'a walk through a VP4’s scenes sent something')
      assert.ok(ffx.vp4SceneWalk(), 'the guard does not know a VP4')
      /* One tap is still one scene. */
      await ffx.setScene(1)
      assert.deepEqual(computer.lines(), ['POST /scene'])
      /* An FM3 walks as it always did: each scene, then back. */
      computer.state.unit = FM3_DETECT
      await ffx.detect()
      assert.equal(ffx.vp4SceneWalk(), null, 'an FM3 is refused its scene map')
      computer.sent.length = 0
      computer.state.reply = (m, p) => (p === '/scene' && m === 'GET' ? { index: 0 } : p === '/preset/scene-state' ? [] : { ok: true })
      await ffx.readAllScenes(2)
      assert.deepEqual(computer.lines().filter((l) => l === 'POST /scene').length, 3, 'an FM3’s scene map no longer walks its scenes')
    })
    /* The copy at either end asks first, before its first scene change. */
    const web = flat('src/components/SceneCopy.jsx')
    assert.ok(web.indexOf('const noWalk = vp4SceneWalk()') > 0 && web.indexOf('const noWalk = vp4SceneWalk()') < web.indexOf('await copyScene('), 'the browser’s Copy a scene does not ask first')
    const phone = flat('mobile/src/components/SceneCopy.js')
    assert.ok(phone.indexOf('if (vp4Here()) {') > 0 && phone.indexOf('if (vp4Here()) {') < phone.indexOf('await copyScene('), 'the phone’s Copy a scene does not ask first')
  })

  test('a VP4 preset’s name is the one its record carries, at both ends, and its place when that has not come', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    assert.equal(v.vp4NameFromGrid({ name: '  Big Room ' }), 'Big Room')
    for (const none of [{ name: '' }, { name: '   ' }, {}, null]) assert.equal(v.vp4NameFromGrid(none), null)
    for (const [n, code] of [[0, 'A1'], [4, 'B1'], [9, 'C2'], [103, 'Z4']]) assert.equal(v.vp4PresetCode(n), code)
    for (const n of [-1, 104, 2.5, null]) assert.equal(v.vp4PresetCode(n), null)
    /* The phone's device layer notes it off the chain read, and only on a VP4. */
    const { device, computer, done } = await phoneOnABench()
    try {
      await device.detect()
      await device.presetBlocks()
      assert.equal(device.vp4PresetName(), 'My Preset', 'the phone does not keep the name its VP4 chain read carried')
      computer.state.unit = FM3_DETECT
      await device.detect()
      assert.equal(device.vp4PresetName(), null, 'an FM3 is named off a VP4’s record')
    } finally {
      done()
    }
    const { ffx } = await browserOnABench()
    await ffx.detect()
    await ffx.presetBlocks()
    assert.equal(ffx.vp4PresetName(), 'My Preset', 'the browser does not keep the name its VP4 chain read carried')
  })

  /*
   * A VP4'S SCENE NAMES, off the same record. Both ends took the chain and the
   * preset's name off GET /preset/grid and threw away the four scene names
   * beside them, then asked for them again by routes a VP4 has none of (a 501,
   * nothing sent), so the scene buttons said 1 to 4 over scenes the player
   * had named — under a Description promising "the names your unit already
   * uses".
   */
  /*
   * A VP4 MOVED BY ITS OWN FOOTSWITCH. A VP4 is a floor pedal, so changing
   * preset on it is ordinary use, and its record names the preset it is on
   * but never its place. Both ends put that name on whatever place was up:
   * B1 landed from the app, a footswitch to Fuzz Wall, Refresh names, and
   * Play read "PRESET 004 B1 / Fuzz Wall" and the list "Fuzz Wall / 004 B1 ·
   * Playing", with Fuzz Wall nowhere near B1. Now only the first read after
   * the app's own landed Program Change, or a stand-in name, names the place;
   * a later read naming another preset leaves it unknown. Run at each end in
   * test/mobile.mjs and test/run.mjs.
   */
  test('a VP4 that changes preset by itself leaves the place unknown, by one rule at both ends', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    const edge = { number: 4, name: 'Edge of Breakup', empty: false, pending: false }
    /* The first read after this app's own landing names the place, whatever was up. */
    assert.deepEqual(v.vp4RecordNames({ ...edge, name: 'Remembered' }, 4, 'Edge of Breakup', 4), { name: 'Edge of Breakup', place: 4 })
    /* A later one naming another preset: the VP4 moved by itself. */
    assert.deepEqual(v.vp4RecordNames(edge, 4, 'Fuzz Wall', null), { name: 'Fuzz Wall', place: null }, 'a footswitch’s preset is put on the place the app last put the VP4')
    assert.deepEqual(v.vp4RecordNames(edge, 4, 'Fuzz Wall', 9), { name: 'Fuzz Wall', place: null })
    /* The same name again changes nothing. */
    assert.equal(v.vp4RecordNames(edge, 4, 'Edge of Breakup', null), null)
    /* A stand-in name is named on its place: blank, still coming, or its own A1 to Z4. */
    for (const standIn of [{ name: '' }, { name: 'Old', pending: true }, { name: 'B1' }]) {
      assert.deepEqual(v.vp4RecordNames({ ...edge, ...standIn }, 4, 'Crunch', null), { name: 'Crunch', place: 4 }, `${JSON.stringify(standIn)} is not a stand-in`)
    }
    assert.deepEqual(v.vp4RecordNames({ ...edge, name: 'C2' }, 4, 'Crunch', null), { name: 'Crunch', place: null }, 'another place’s code is a stand-in for this one')
    /* With the place unknown already, or nothing up, the name goes up and the place stays unknown. */
    assert.deepEqual(v.vp4RecordNames({ ...edge, number: null }, null, 'Fuzz Wall', null), { name: 'Fuzz Wall', place: null })
    assert.deepEqual(v.vp4RecordNames(null, undefined, 'Big Room', null), { name: 'Big Room', place: null })
    /* Never onto a preset the read was not for, and never without a name. */
    assert.equal(v.vp4RecordNames(edge, 9, 'Fuzz Wall', 4), null)
    assert.equal(v.vp4RecordNames(edge, 4, null, 4), null)
    /* Both ends decide by it, owe it only to their own landing, and never off a read that crossed a tap. */
    const phone = flat('mobile/src/lib/rig.js')
    const web = flat('src/lib/deviceState.js')
    assert.match(phone, /const said = vp4RecordNames\(p, number, name, vp4Owed\)/, 'the phone names a VP4’s place by its own rule')
    assert.match(web, /const said = vp4RecordNames\(p, number, name, vp4Owed\)/, 'the browser names a VP4’s place by its own rule')
    assert.match(phone, /if \(vp4PresetOn\(answer\) && run === presetRun\) vp4Owed = number/)
    assert.match(web, /if \(vp4Landed && run === presetRun\) vp4Owed = number/)
    assert.match(phone, /const run = \+\+presetRun \/\*[^*]*\*\/ vp4Owed = null/)
    assert.match(web, /const run = \+\+presetRun \/\*[^*]*\*\/ vp4Owed = null/)
    assert.match(phone, /const fresh = vp4ReadFresh\(era\) const named = fresh \? vp4NameFor\(number\) : null/)
    assert.match(web, /if \(!held\) takeVp4Name\(number, era\)/)
    for (const [end, src] of [['phone', phone], ['browser', web]]) {
      assert.match(src, /vp4Era \+= 1 vp4Selecting\.add\(run\) let \w+ try \{ \w+ = await \w+\.selectPreset\(number, \{ deadline \}\)[\s\S]{0,400}?\} finally \{ vp4Selecting\.delete\(run\) vp4Era \+= 1 \}/, `the ${end}’s select does not mark the reads that cross it`)
    }
  })

  test('a VP4’s scene names are the ones its record carries, at both ends, and never asked for again', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    assert.deepEqual(v.vp4SceneNamesFromGrid({ scenes: [' Verse ', 'Chorus', '', null, 'Fifth'] }), ['Verse', 'Chorus', '', ''], 'four, trimmed, blank where unnamed')
    assert.deepEqual(v.vp4SceneNamesFromGrid({ scenes: ['', '', '', ''] }), ['', '', '', ''], 'a preset with unnamed scenes keeps the last one’s names')
    for (const none of [{}, { scenes: 'x' }, null]) assert.equal(v.vp4SceneNamesFromGrid(none), null)
    const { device, computer, done } = await phoneOnABench()
    try {
      await device.detect()
      assert.equal(device.vp4SceneNames(), null, 'scene names before any read')
      await device.presetBlocks()
      assert.deepEqual(device.vp4SceneNames(), ['Clean', 'Crunch', 'Lead', 'Solo'], 'the phone does not keep the scene names its VP4 chain read carried')
      assert.deepEqual(computer.asked.filter((l) => /\/presets\/|\/scene/.test(l)), [], 'the phone asked a VP4 for its scene names another way')
      computer.state.unit = FM3_DETECT
      await device.detect()
      assert.equal(device.vp4SceneNames(), null, 'an FM3’s scenes are named off a VP4’s record')
    } finally {
      done()
    }
    const { ffx, computer: web } = await browserOnABench()
    await ffx.detect()
    assert.equal(ffx.vp4SceneNames(), null)
    await ffx.presetBlocks()
    assert.deepEqual(ffx.vp4SceneNames(), ['Clean', 'Crunch', 'Lead', 'Solo'], 'the browser does not keep the scene names its VP4 chain read carried')
    assert.deepEqual(web.asked.filter((l) => /\/presets\/|\/scene/.test(l)), [], 'the browser asked a VP4 for its scene names another way')
    /* Where they go: the phone's chain read, and the browser's store and its own read at the start. */
    assert.match(flat('mobile/src/lib/rig.js'), /const scenes = fresh \? vp4ScenesFor\(number\) : null .{0,300}?if \(scenes\) patch\.sceneNames = scenes/)
    assert.match(flat('src/lib/deviceState.js'), /export async function refreshLoadedSceneNames\(number\) \{ if \(!Number\.isInteger\(number\)\) return \/\*[^*]*\*\/ if \(driver\?\.vp4Here\?\.\(\)\) return/, 'the browser asks a VP4 for its scene names again, over the ones its record carried')
    assert.match(flat('src/App.jsx'), /setBlocks\(list\) \/\*[^*]*\*\/ if \(vp4Here\(\)\) takeVp4Record\(p\?\.number \?\? null\)/, 'the browser’s read at the start leaves a VP4 unnamed')
    assert.match(flat('src/App.jsx'), /vp4Here, vp4PresetName, vp4SceneNames, sceneState,/, 'the browser’s store is not handed the VP4’s scene names')
  })

  /*
   * THE TIMED CHECK ON A VP4. Both ends ask, every half-minute or so, which
   * preset the unit is on, and two quiet answers hand over to a whole re-read.
   * A VP4 can never say which preset, so every answer was quiet: the browser
   * re-read it from scratch every second tick for as long as a page was open
   * (identify, firmware, and on the computer apps out there now a chain read
   * that can fall back to the sweep that froze an AM4), and both ends wrote
   * "the unit stopped answering" in the log. A VP4 is asked which scene it is
   * on instead (shared/unit-watch.mjs probeUnit): GET /scene, the one safe
   * read on every computer app.
   */
  test('the timed check asks a VP4 which scene it is on, never re-reads it from scratch, and asks an FM3 as before, at both ends', async () => {
    const watch = await import('../shared/unit-watch.mjs')
    assert.equal(watch.sceneProbeSays({ scene: { index: 0 } }), 'answering', 'scene 1 is a scene')
    assert.equal(watch.sceneProbeSays({ scene: { index: 3 } }), 'answering')
    for (const none of [null, {}, { index: -1 }, { index: '2' }]) assert.equal(watch.sceneProbeSays({ scene: none }), 'quiet', `${JSON.stringify(none)} is a scene`)
    assert.equal(watch.sceneProbeSays({ failed: true }), 'quiet')
    /* `n` ticks the way both ends run them: the probe, the run of quiet answers, and a re-read when it is long enough. */
    const ticks = async (end, n) => {
      let quiet = 0
      let rereads = 0
      const heard = []
      for (let i = 0; i < n; i++) {
        const r = await watch.probeUnit({ vp4: end.vp4Here(), currentPreset: () => end.currentPreset(), getScene: () => end.getScene() })
        heard.push(r.heard)
        quiet = watch.countQuiet(quiet, r.said)
        if (watch.unitGone(quiet)) {
          rereads++
          quiet = 0
        }
      }
      return { rereads, heard }
    }
    const atEitherEnd = async (end, computer, where) => {
      computer.state.unit = VP4_NEW
      await end.detect()
      computer.state.reply = (m, p) => (p === '/preset' ? { status: 501, message: 'unsupported' } : p === '/scene' ? { index: 2 } : { ok: true })
      computer.sent.length = 0
      const vp4 = await ticks(end, 6)
      assert.equal(vp4.rereads, 0, `${where}: six timed checks on a VP4 that answers handed over to a re-read from scratch`)
      assert.ok(vp4.heard.every((h) => h === null), `${where}: a VP4 named a preset for the screen to follow`)
      assert.deepEqual(computer.lines(), Array(6).fill('GET /scene'), `${where}: the timed check on a VP4 asked ${[...new Set(computer.lines())].join(', ')}`)
      /* One that has stopped answering is still caught, by two failed reads in a row. */
      computer.state.reply = (m, p) => (p === '/scene' ? { status: 503, message: 'The VP4 didn’t answer when asked which scene it is on.' } : { ok: true })
      assert.equal((await ticks(end, 2)).rereads, 1, `${where}: a VP4 that stopped answering is not caught`)
      /* An FM3 is asked which preset, as it always was, and the screen follows it. */
      computer.state.unit = FM3_DETECT
      await end.detect()
      computer.state.reply = (m, p) => (p === '/preset' ? { number: 12, name: 'Lead' } : { ok: true })
      computer.sent.length = 0
      const fm3 = await ticks(end, 2)
      assert.equal(fm3.rereads, 0, `${where}: an FM3 that answers was re-read`)
      assert.equal(fm3.heard[0]?.number, 12, `${where}: an FM3’s preset is not followed`)
      assert.ok(computer.lines().includes('GET /preset') && !computer.lines().includes('GET /scene'), `${where}: an FM3’s timed check asked ${computer.lines().join(', ')}`)
    }
    const { device, computer, done } = await phoneMidiBench()
    try {
      await atEitherEnd(device, computer, 'phone')
    } finally {
      done()
    }
    await withLocalStorage(memoryStorage(), async () => {
      const { ffx, computer: web } = await browserMidiBench()
      await atEitherEnd(ffx, web, 'browser')
    })
    /* And both ends' timed checks are that probe, with the unit's VP4-ness, before the run of quiet answers that hands over. */
    const app = flat('src/App.jsx')
    assert.match(app, /const \{ said, heard \} = await probeUnit\(\{ vp4: vp4Here\(\), currentPreset, getScene \}\) if \(!live\) return/, 'the browser’s timed check is not the shared probe')
    assert.match(app, /quiet = countQuiet\(quiet, said\) if \(unitGone\(quiet\)\) \{[\s\S]{0,240}await read\(\)/)
    const rig = flat('mobile/src/lib/rig.js')
    assert.match(rig, /const \{ said, heard \} = await probeUnit\(\{ vp4: Boolean\(device\.vp4Here\?\.\(\)\), currentPreset: \(\) => device\.currentPreset\(\), getScene: \(\) => device\.getScene\(\) \}\)/, 'the phone’s timed check is not the shared probe')
    assert.match(rig, /if \(said === 'answering' && heard && state\.unit === 'present' && !presetBusy\(\)\) presetMovedAtUnit\(heard, loadRun\)/, 'the phone follows a preset a VP4 never named')
  })

  /*
   * A VP4'S LOOPER, LIT AND FULL OF BUTTONS THAT ONLY SAID NO. A VP4 preset
   * with a Looper in it (effect 166, which ForgeFX names `looper`) put the
   * LPR pedal on Play lit, as if on, right above "The app can't see whether a
   * VP4's effects are on or off": the record says `bypassed: null`, and both
   * ends drew !null. Tapping it opened Rec, Play, Stop, Dub, Undo, Once, Rev
   * and ½ Speed under "No loop yet. Tap Rec to start.", and each was refused
   * (no computer app's VP4 driver has a looper control: a 501), while the
   * panel asked where the playhead was for as long as it was open. Settings
   * at both ends offered "Stop the looper", which said "Didn't stop — The app
   * can't do that on a…", cut off. Nothing reached the pedal. Now, on a real
   * VP4 only: the pedal is lit only for an on/off known to be on and says
   * neither Rec nor Play, the panel is one sentence with nothing asked, and
   * there is no Stop the looper row. The demo and the other units as before.
   */
  test('a VP4’s looper pedal is not lit for an unread on/off, opens one sentence and no buttons, and has no Stop row, at both ends', async () => {
    const v = await import('../shared/vp4-safety.mjs')
    const { LOOPER_LABEL, LOOPER_ROWS } = await import('../shared/looper.mjs')
    /* The words: "yet", nothing promised, and not one of what a buyer is told doesn't work (nothing a buyer reads promises a VP4 a looper). */
    assert.equal(v.VP4_NO_LOOPER, 'The app can’t work a VP4’s looper yet. Use the looper on the VP4 itself for now.')
    assert.doesNotMatch(v.VP4_NO_LOOPER, /unsupported|coming|\bsoon\b|\bMac\b/i)
    assert.ok(!v.VP4_NOT_YET.includes('the looper'))
    for (const text of [v.VP4_SO_FAR, v.VP4_DEMO]) assert.doesNotMatch(text, /looper/i, 'a buyer is told something about a VP4’s looper')
    assert.equal(v.vp4Words('POST', '/preset/looper/control'), v.VP4_NO_LOOPER)
    assert.equal(v.vp4Words('GET', '/preset/looper?eid=166'), v.VP4_NO_LOOPER)
    assert.equal(v.vp4Said('POST', '/preset/looper/control', Object.assign(new Error('unsupported'), { status: 501 })).message, v.VP4_NO_LOOPER)
    assert.equal(v.aboutVp4(v.VP4_NO_LOOPER), true, 'the looper’s words are given a help link')

    /* And a button that still reached a computer, at either end, says those words rather than "unsupported". */
    const looper501 = (m, p) => (p.split('?')[0].startsWith('/preset/looper') ? { status: 501, message: 'unsupported' } : { ok: true })
    const phone = await phoneMidiBench()
    try {
      phone.computer.state.reply = looper501
      await phone.device.detect()
      await assert.rejects(phone.device.looperControl(166, 'record', true), (err) => err.message === v.VP4_NO_LOOPER, 'the phone’s looper refusal on a VP4 is not its words')
    } finally {
      phone.done()
    }
    await withLocalStorage(memoryStorage(), async () => {
      const { ffx, computer } = await browserMidiBench()
      computer.state.reply = looper501
      await ffx.detect()
      await assert.rejects(ffx.looperControl(166, 'record', true), (err) => err.message === v.VP4_NO_LOOPER, 'the browser’s looper refusal on a VP4 is not its words')
    })

    /*
     * The panel, run at both ends: the component as it is, its JSX turned
     * into calls, against stand-ins that write down every hook and every
     * request. On a VP4 it is the sentence, with no hook run and nothing
     * asked; anywhere else it is the panel with its eight buttons.
     */
    const { transformSync } = await import('esbuild')
    const tree = (node, out = []) => {
      if (Array.isArray(node)) node.forEach((n) => tree(n, out))
      else if (node && typeof node === 'object') {
        out.push(node)
        tree(node.children, out)
      }
      return out
    }
    const textOf = (node) => (Array.isArray(node) ? node.map(textOf).join('') : node && typeof node === 'object' ? textOf(node.children) : typeof node === 'string' ? node : '')
    async function panel(file, swaps) {
      const dir = mkdtempSync(join(tmpdir(), 'vp4-looper-'))
      try {
        writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
        writeFileSync(
          join(dir, 'stand.mjs'),
          `export const h = (type, props, ...children) => ({ type, props: props || {}, children })
           export const Frag = 'frag'
           export const log = []
           export const unit = { vp4: false }
           export function useState(initial) { log.push('hook'); return [typeof initial === 'function' ? initial() : initial, () => {}] }
           export function useRef(current = null) { log.push('hook'); return { current } }
           export const undo = []
           export function useEffect(fn) { log.push('hook'); const u = fn(); if (typeof u === 'function') undo.push(u) }
           export const vp4Here = () => unit.vp4
           export const looperControl = async (...a) => { log.push('control'); return { ok: true } }
           export const looperTelemetry = async (eid) => { log.push('telemetry ' + eid); return { wave: [], position: null, level: null } }
           export const useRig = (pick) => pick({ preset: { number: 5 } })
           export const tapDeadline = () => 0
           export const tick = () => {}
           export const thud = () => {}
           export const AppState = { currentState: 'active' }
           export const Text = 'Text'
           export const View = 'View'
           export const color = {}, font = {}, radius = {}, space = {}
           export function Note() { return null }
           export function Press() { return null }
           export default function Stub() { return null }`
        )
        let src = transformSync(read(file), { loader: 'jsx', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Frag', format: 'esm' }).code
        for (const [from, to] of swaps) src = src.replaceAll(from, to)
        const left = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((m) => !m.endsWith('.mjs'))
        assert.deepEqual(left, [], `${file} imports something the bench has no stand-in for`)
        writeFileSync(join(dir, 'Looper.mjs'), "import { h, Frag } from './stand.mjs'\n" + src)
        const stand = await import(pathToFileURL(join(dir, 'stand.mjs')).href)
        const { default: Looper } = await import(pathToFileURL(join(dir, 'Looper.mjs')).href)
        return { Looper, stand }
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }
    const shared = (f) => [`from "${f}"`, `from '${repoUrl(f.replace(/^(\.\.\/)+/, ''))}'`]
    const ends = [
      {
        where: 'phone',
        ...(await panel('mobile/src/components/Looper.js', [
          ['from "react"', "from './stand.mjs'"],
          ['from "react-native"', "from './stand.mjs'"],
          ['from "../lib/theme"', "from './stand.mjs'"],
          ['from "../lib/device"', "from './stand.mjs'"],
          ['from "../lib/feedback"', "from './stand.mjs'"],
          ['from "../lib/rig"', "from './stand.mjs'"],
          ['from "../lib/relay-rules"', "from './stand.mjs'"],
          ['from "../lib/looper"', `from '${repoUrl('shared/looper.mjs')}'`],
          ['from "../lib/vp4-safety"', `from '${repoUrl('shared/vp4-safety.mjs')}'`],
          ['from "./Note"', "from './stand.mjs'"],
          ['from "./Press"', "from './stand.mjs'"]
        ])),
        button: (n) => n.props?.accessibilityLabel
      },
      {
        where: 'browser',
        ...(await panel('src/components/Looper.jsx', [
          ['from "react"', "from './stand.mjs'"],
          ['from "../lib/forgefx"', "from './stand.mjs'"],
          ['from "../lib/feedback"', "from './stand.mjs'"],
          ['from "../lib/remote"', "from './stand.mjs'"],
          shared('../../shared/looper.mjs'),
          shared('../../shared/vp4-safety.mjs')
        ])),
        button: (n) => (n.type === 'button' ? n.props?.['aria-label'] : undefined)
      }
    ]
    const block = { slug: 'looper', name: 'Looper 1', effectId: 166, bypassed: null }
    for (const { where, Looper, stand, button } of ends) {
      stand.unit.vp4 = true
      stand.log.length = 0
      const said = Looper({ block, presetNumber: 5 })
      assert.equal(textOf(said), v.VP4_NO_LOOPER, `${where}: a VP4’s looper panel does not say its sentence`)
      assert.ok(!tree(said).some((n) => typeof n.type === 'function' && n.type.name === 'LooperPanel'), `${where}: a VP4 is offered the looper’s buttons`)
      assert.deepEqual(stand.log, [], `${where}: a VP4’s looper panel ran a hook or asked the computer for something`)
      /* Anywhere else, the panel and its eight buttons, as before. */
      stand.unit.vp4 = false
      const panelEl = Looper({ block, presetNumber: 5 })
      assert.equal(panelEl.type?.name, 'LooperPanel', `${where}: an FM3’s looper is no longer the panel`)
      const drawn = panelEl.type(panelEl.props)
      stand.undo.splice(0).forEach((u) => u())
      const labels = tree(drawn).map(button).filter(Boolean)
      assert.deepEqual(labels, LOOPER_ROWS.flat().map((a) => `Looper ${LOOPER_LABEL[a]}`), `${where}: an FM3’s looper lost its buttons`)
      assert.ok(stand.log.includes('telemetry 166'), `${where}: an FM3’s looper no longer asks where the playhead is`)
    }

    /* Play's pedal, at both ends: lit only for an on/off known to be on, and no Rec or Play, on a real VP4; Rec and Play elsewhere. */
    const stage = flat('mobile/src/screens/Stage.js')
    assert.match(stage, /const vp4Looper = looperTile && vp4Here\(\)/)
    assert.match(stage, /const looperState = typeof looperHere\?\.bypassed === 'boolean' \? \(looperHere\.bypassed \? 'Off' : 'On'\) : '\\u00a0'/)
    assert.match(stage, /topLeft=\{vp4Looper \? looperState : 'Rec'\} topRight=\{vp4Looper \? undefined : 'Play'\} pair=\{!vp4Looper\}/, 'the phone’s VP4 looper pedal says Rec and Play')
    assert.match(stage, /on=\{vp4Looper \? looperHere\.bypassed === false : !looperHere\.bypassed\}/, 'the phone’s VP4 looper pedal is lit for an on/off nobody read')
    assert.match(stage, /onPress=\{\(\) => setLooping\(true\)\}/)
    const gig = flat('src/components/Gig.jsx')
    assert.match(gig, /const rec = door && !vp4Here\(\)/)
    assert.match(gig, /const unknown = !rec && \(outline \|\| vp4Here\(\)\) && typeof block\.bypassed !== 'boolean'/, 'the browser’s VP4 looper pedal is lit for an on/off nobody read')
    assert.match(gig, /className=\{`gig-block \$\{unknown \|\| block\.bypassed \? 'off' : 'on'\}`\}/)
    assert.match(gig, /\{rec \? LOOPER_LABEL\.record : unknown \? '\\u00a0' : block\.bypassed \? 'Off' : 'On'\}/, 'the browser’s VP4 looper pedal says Rec')
    assert.match(gig, /\{rec \? \( <span className="gig-block-word gig-block-word-end"/, 'the browser’s VP4 looper pedal says Play')
    assert.match(gig, /rec \? 'Looper — open Record, Play and Stop'/)
    /* Settings at both ends: no Stop the looper on a real VP4. */
    const settings = flat('mobile/src/screens/Settings.js')
    assert.match(settings, /\{\(link === 'connected' \|\| demo\) && !overBluetooth\(caps\) && !onRealVp4 \? \( <SetupRow title="Stop the looper"/, 'the phone offers a VP4 Stop the looper')
    assert.match(settings, /const onRealVp4 = vp4Here\(\)/)
    const app = flat('src/App.jsx')
    assert.match(app, /\{status === 'live' && !onRealVp4 \? \( <SetupRow key="looper-stop" title="Stop the looper"/, 'the browser offers a VP4 Stop the looper')
    assert.equal((app.match(/title="Stop the looper"/g) || []).length, 1)
    assert.equal((settings.match(/title="Stop the looper"/g) || []).length, 1)
  })
}
