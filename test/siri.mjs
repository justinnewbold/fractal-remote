/**
 * SIRI'S COMMANDS, CARRIED OUT ON THE PHONE (mobile/src/lib/siri.js).
 *
 * "Let's add all of the Siri commands to the build that we can." (Justin,
 * 23 October 2026.) test/siri-native.mjs reads the Swift and runs the hand-off
 * (lib/siriPipe). This runs what the JavaScript does with each command, on a
 * bench: lib/siri.js and lib/siri-rule.js as they are, the real pipe beside a
 * stand-in Siri module, and a clock the test turns by hand, so "a second and
 * a half later" costs nothing.
 *
 * Two rigs. A stand-in, which writes down every write it is asked for and
 * answers as the test says, for the rules: Play on screen, the 1.5-second tap
 * rule counted from when the Swift took the command, a phone that slept,
 * Tuner off from anywhere and its second try, exactly one pedal of a kind,
 * the tempo range, an AM4's four scenes and its boost, a VP4's limits, and
 * every word. And the phone's real rig store driving the demo's simulated
 * unit, which is what Apple's reviewer has.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const flat = (rel) => read(rel).replace(/\s+/g, ' ')
const withoutComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const LIB = 'mobile/src/lib'
const DATA = pathToFileURL(new URL('../mobile/src/data/', import.meta.url).pathname).href

/* Node wants the extension Metro does without, and the bench's own stand-ins for the packages. */
const esm = (src) =>
  src
    .replace(/from 'react'/g, "from './react.js'")
    .replace(/from 'react-native'/g, "from './react-native.js'")
    .replace(/from 'expo'/g, "from './expo.js'")
    .replace(/from '\.\/([\w.-]+)'/g, (whole, name) => (/\.m?js$/.test(name) ? whole : `from './${name}.js'`))
/* And the clock the test turns. */
const clocked = (src) =>
  "import * as __clock from './clock.js'\n" +
  src
    .replace(/\bDate\.now\(\)/g, '__clock.now()')
    .replace(/\bsetTimeout\(/g, '__clock.setTimeout(')
    .replace(/\bclearTimeout\(/g, '__clock.clearTimeout(')
    .replace(/\bsetInterval\(/g, '__clock.setInterval(')
    .replace(/\bclearInterval\(/g, '__clock.clearInterval(')

const CLOCK = `
  let t = 1000000
  let seq = 0
  const timers = new Map()
  export const now = () => t
  export function setTimeout(fn, ms = 0, ...args) {
    const id = ++seq
    timers.set(id, { id, at: t + Math.max(0, Number(ms) || 0), fn, args })
    return id
  }
  export function clearTimeout(id) { timers.delete(id) }
  export const setInterval = () => 0
  export const clearInterval = () => {}
  const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => globalThis.setImmediate(r)) }
  export async function advance(ms) {
    const end = t + ms
    await flush()
    for (;;) {
      let next = null
      for (const x of timers.values()) if (x.at <= end && (!next || x.at < next.at || (x.at === next.at && x.id < next.id))) next = x
      if (!next) break
      timers.delete(next.id)
      t = Math.max(t, next.at)
      next.fn(...next.args)
      await flush()
    }
    t = end
    await flush()
  }
  /* The app put away and stopped by the phone: the clock runs on and no timer fires, until the next advance, when every one overdue fires at once. */
  export function jump(ms) { t += ms }
`

/* A stand-in FractalSiri module: what the JavaScript hears, and what it says back. */
const EXPO = `
  const listeners = []
  export const replies = []
  export const fake = {
    addListener: (event, fn) => { listeners.push({ event, fn }); return { remove: () => listeners.splice(listeners.findIndex((l) => l.fn === fn), 1) } },
    reply: (id, words) => replies.push([id, words])
  }
  export const native = { module: fake }
  export const emit = (body) => listeners.filter((l) => l.event === 'onCommand').forEach((l) => l.fn(body))
  export const listening = () => listeners.length
  export const requireOptionalNativeModule = (name) => (name === 'FractalSiri' ? native.module : null)
`

/* The phone's link, as the handler reads it: the word, a probe, and a wait for 'connected' the test ends. */
const LINK = `
  import * as clock from './clock.js'
  export const state = { link: 'connected' }
  export let probes = 0
  export const linkState = () => state
  export const probeNow = () => { probes++ }
  const waiting = new Set()
  export function untilConnected(ms = 8000) {
    if (state.link === 'connected') return Promise.resolve(true)
    probeNow()
    return new Promise((resolve) => {
      const w = { resolve }
      w.timer = clock.setTimeout(() => { waiting.delete(w); resolve(false) }, ms)
      waiting.add(w)
    })
  }
  export function __set(link) {
    state.link = link
    if (link !== 'connected') return
    for (const w of [...waiting]) { clock.clearTimeout(w.timer); waiting.delete(w); w.resolve(true) }
  }
`

/* React Native's Linking: the links that arrive while the app runs, and the one that started it. */
const LINKING = (launchUrl) => `
  const urls = []
  export const Linking = {
    addEventListener: (event, fn) => { if (event === 'url') urls.push(fn); return { remove: () => urls.splice(urls.indexOf(fn), 1) } },
    getInitialURL: async () => ${JSON.stringify(launchUrl)},
    open: (url) => urls.forEach((fn) => fn({ url })),
    listening: () => urls.length
  }
`

/*
 * React Native's AppState: what the app is now, which a test may set as it
 * likes, and a change of it, heard as the phone says it (__change). Locked,
 * or another app opened, is 'background', which iOS says before it stops
 * the app; Siri's own panel over the app is only 'inactive'.
 */
const APP_STATE = `
  const heard = new Set()
  export const AppState = {
    currentState: 'active',
    addEventListener: (event, fn) => {
      if (event === 'change') heard.add(fn)
      return { remove: () => heard.delete(fn) }
    },
    __change: (to) => {
      AppState.currentState = to
      ;[...heard].forEach((fn) => fn(to))
    },
    __listening: () => heard.size
  }
`

/* His account, by its id (shared/admin.mjs), and somebody else's. */
const JUSTIN = '7dfe6912-e43b-49bf-84e4-b56afbd442b1'
const CUSTOMER = '0b5f2a8e-4c1d-4e7a-9f3b-2d6c8e1a5f70'

/*
 * THE STAND-IN RIG. `state` is what Play's store holds; each write is
 * written down with its arguments and answered by `answers[name]`, or true.
 * `view` is the chain view (lib/chain-view): 'ready' unless the test says.
 */
const RIG = `
  export let state = {
    capabilities: { sceneCount: 8, presets: { count: 512 } },
    deviceSlug: 'fm3',
    preset: { number: 12, name: 'SONG 12' },
    sceneIndex: 0,
    sceneNames: ['VERSE', 'CHORUS', 'LEAD', '', '', '', '', ''],
    blocks: [
      { slug: 'drive', name: 'Drive 1', effectId: 133, bypassed: true },
      { slug: 'amp', name: 'Amp 1', effectId: 58, bypassed: false },
      { slug: 'delay', name: 'Delay 1', effectId: 70, bypassed: false },
      { slug: 'reverb', name: 'Reverb', effectId: 66, bypassed: false }
    ],
    tunerOn: false,
    view: 'ready',
    dropped: null,
    error: null
  }
  export const __set = (patch) => { state = { ...state, ...patch } }
  export const getState = () => state
  export const chainViewOf = (s) => s.view
  export const pedalSlug = () => state.deviceSlug
  export const calls = []
  export const answers = {}
  const write = (name) => (...args) => { calls.push([name, ...args]); return answers[name] ? answers[name](...args) : Promise.resolve(true) }
  export const writeScene = write('scene')
  export const writeBypass = write('bypass')
  export const writeTempo = write('tempo')
  export const loadPreset = write('preset')
  /* As rig.writeTuner does: an open is on its way from its press until its answer (tunerAskWaits), whoever asked for it. */
  let asks = 0
  export function tunerAskWaits() {
    asks++
    let open = true
    return () => {
      if (!open) return
      open = false
      asks--
    }
  }
  export const tunerAsksWaiting = () => asks
  const tunerWrite = write('tuner')
  export function writeTuner(on, ...rest) {
    const answered = on ? tunerAskWaits() : () => {}
    const out = tunerWrite(on, ...rest)
    Promise.resolve(out).then(answered, answered)
    return out
  }
  export const notes = []
  export function notSentNow(what, { late = true } = {}) {
    notes.push({ what, late })
    state = { ...state, dropped: late ? 'Not sent — it would have landed late' : 'Not sent — not connected' }
  }
  const watchers = new Set()
  export function onPresetAnswered(fn) { watchers.add(fn); return () => watchers.delete(fn) }
  export const __answered = (number, ok, words = null) => [...watchers].forEach((fn) => fn({ number, ok, words }))
  export const __watching = () => watchers.size
`

/** lib/siri.js on the bench, with the stand-in rig (or the real one driving the demo: see demoOnTheBench). */
async function siriOnTheBench({ os = 'ios', device = 'phone', vp4 = false, names = {}, siri = true, installed = '1.87.11', launchUrl = null, extra = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'siri-'))
  const files = {
    'package.json': '{ "type": "module" }',
    'clock.js': CLOCK,
    'react.js': 'export const useEffect = (fn) => fn()\nexport const useRef = (v) => ({ current: v })\nexport const useSyncExternalStore = (sub, get) => get()\n',
    'react-native.js': `${APP_STATE}\nexport const Platform = { OS: ${JSON.stringify(os)} }\n${LINKING(launchUrl)}`,
    'expo.js': siri ? EXPO : EXPO.replace('export const native = { module: fake }', 'export const native = { module: null }'),
    /* The version built into this copy of the app (lib/storeVersion), which an update never changes. */
    'storeVersion.js': `export const installedStoreVersion = () => ${JSON.stringify(installed)}\n`,
    'link.js': LINK,
    'rig.js': RIG,
    'debugLog.js': 'export const said = []\nexport const logDebug = (...a) => said.push(a.join(" "))\n',
    'device.js': `export const vp4Here = () => ${vp4 ? 'true' : 'false'}\n`,
    'presetNames.js': `const listed = ${JSON.stringify(names)}\nexport const nameOf = (n) => listed[n]\n`,
    ...extra
  }
  for (const f of ['siri-rule.js', 'versions.js', 'admin.js', 'owner-unlock.js', 'am4-boost.js', 'chain-view.js', 'device-word.js', 'relay-rules.js', 'tempo.js', 'unit.mjs', 'presetName.js', 'slots.js', 'vp4-safety.js']) {
    if (!(f in files)) files[f] = read(`${LIB}/${f}`)
  }
  files['siriPipe.js'] = clocked(esm(read(`${LIB}/siriPipe.js`)))
  files['siri.js'] = clocked(esm(read(`${LIB}/siri.js`)))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    const clock = await import(at('clock.js'))
    const words = await import(at('device-word.js'))
    words.setDevice(device)
    const b = {
      dir,
      clock,
      expo: await import(at('expo.js')),
      link: await import(at('link.js')),
      rn: await import(at('react-native.js')),
      rig: await import(at('rig.js')),
      log: await import(at('debugLog.js')),
      rule: await import(at('siri-rule.js')),
      siri: await import(at('siri.js'))
    }
    b.stop = b.siri.startSiri()
    let n = 0
    /* One command from Siri, `ago` milliseconds after the Swift took it. */
    b.say = (command, value, { ago = 100, answered = false, id = `c${++n}` } = {}) => {
      b.expo.emit({ id, at: clock.now() - ago, command, ...(value === undefined ? {} : { value }), answered })
      return id
    }
    b.replies = () => b.expo.replies.map(([, w]) => w)
    b.replyTo = (id) => b.expo.replies.filter(([who]) => who === id).map(([, w]) => w)
    /* Play on screen, with its own Previous and Next (Stage's step, landing and stuck). */
    b.play = ({ landing = (by) => 12 + by, stuck = () => null, step } = {}) => {
      const steps = []
      const off = b.siri.showPlay({
        landing,
        stuck,
        step: (by, when) => {
          steps.push([by, when])
          return step ? step(by, when) : Promise.resolve(true)
        }
      })
      return { steps, off }
    }
    return b
  } catch (err) {
    rmSync(dir, { recursive: true, force: true })
    throw err
  }
}

/* lib/siri-rule.js and the version rule it imports, where node takes them for the ES modules they are. */
let ruleCopy = null
async function siriRule() {
  if (ruleCopy) return ruleCopy
  const dir = mkdtempSync(join(tmpdir(), 'siri-rule-'))
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
  for (const f of ['siri-rule.js', 'versions.js']) writeFileSync(join(dir, f), read(`${LIB}/${f}`))
  ruleCopy = await import(pathToFileURL(join(dir, 'siri-rule.js')).href)
  rmSync(dir, { recursive: true, force: true })
  return ruleCopy
}

const done = (b) => {
  b.stop?.()
  rmSync(b.dir, { recursive: true, force: true })
}

/*
 * THE TUNER'S FLAG AS rig.writeTuner KEEPS IT, for the stand-in rig: up or
 * down with the press, and down again when the newest press did not go.
 * Each close is answered by `closes` in turn and each open by `opens`
 * (true, or a promise the test settles), true once they run out.
 */
function tunerLike(b, { closes = [], opens = [] } = {}) {
  let press = 0
  return (on) => {
    const mine = ++press
    b.rig.__set({ tunerOn: on })
    const answer = (on ? opens : closes).shift() ?? true
    return Promise.resolve(answer).then((ok) => {
      if (!ok && mine === press) b.rig.__set({ tunerOn: false })
      return ok
    })
  }
}

/*
 * THE DEMO, ON THE PHONE'S OWN RIG STORE. rig.js and device.js as they are,
 * with the demo switch on and the simulated unit (lib/mockDevice) answering
 * every request at the same door a real computer does (lib/demoWire), so a
 * scene from Siri is the scene the reviewer sees land.
 */
async function demoOnTheBench(unit = 'fm3') {
  const lib = (f) => read(`${LIB}/${f}`)
  const extra = {
    'relay.js':
      'export async function remoteRequest() { throw new Error("no computer in the demo") }\n' +
      'export const subscribeRemoteEvents = () => () => {}\nexport const subscribeRemoteState = () => () => {}\nexport const subscribeHostSeen = () => () => {}\n',
    'demo.js': `import { createMockDevice } from './mockDevice.js'\nconst mock = createMockDevice(${JSON.stringify(unit)})\nexport const isDemo = () => true\nexport const demoDevice = () => mock\nexport const demoUnit = () => ${JSON.stringify(unit)}\n`,
    'demoWire.js': lib('demoWire.js'),
    'mockDevice.js': lib('mockDevice.js').replace(/'\.\.\/data\//g, `'${DATA}`),
    'factoryPresets.js': lib('factoryPresets.js').replace(/'\.\.\/data\//g, `'${DATA}`),
    'bleSwitch.js': "export const bluetoothWire = () => null\nexport const bluetoothOn = () => false\nexport const overBluetooth = (caps) => caps?.via === 'bluetooth'\n",
    'lineage.js': 'export const withLineage = (x) => x\n',
    'presetNames.js': 'export const adopt = async () => 0\nexport const forget = () => {}\nexport const learn = () => {}\nexport const nameOf = () => undefined\n',
    'paramIndex.js': 'export const forget = () => {}\n',
    'sceneNameCache.js':
      'export const forgetSceneNames = () => true\nexport const recallSceneNames = async () => []\nexport const rememberSceneNames = () => true\nexport const sceneNamesKnown = async () => false\n',
    'blockCatalog.js': `export const blockCatalog = ${read('mobile/src/data/blocks.json')}\n`
  }
  for (const f of ['demoUnits.js', 'scale.js', 'sceneState.js', 'demoMemory.js', 'tunerStream.js', 'own-echo.js', 'chain-outline.js', 'firmware.js', 'fault-rule.js', 'unit-watch.js', 'device-slug.js', 'grid-plan.js', 'encoding.js', 'param-fixes.js', 'metronome-rules.js', 'unsupported.js', 'tapGate.js', 'looks.js', 'blockPalettes.js', 'ink.js']) {
    extra[f] = esm(lib(f))
  }
  extra['device.js'] = clocked(esm(lib('device.js')))
  extra['rig.js'] = clocked(esm(lib('rig.js')))
  const b = await siriOnTheBench({ extra })
  await b.rig.refreshAll()
  await b.clock.advance(5000)
  return b
}

export function run(test) {
  test('Siri: a scene goes with the time the Swift took it, as a tap on Play would, and Siri hears its name', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      const id = b.say('scene', 2, { ago: 300 })
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls, [['scene', 1, b.clock.now() - 300]], 'not the scene asked for, or not bound by the moment the Swift took it')
      assert.deepEqual(b.replyTo(id), ['Scene 2, CHORUS.'])
      /* Siri said "3": scene 3, which the tiles call 3 and the rig 2. */
      b.say('scene', 3)
      await b.clock.advance(0)
      assert.equal(b.rig.calls[1][1], 2)
      assert.deepEqual(b.replies().at(-1), 'Scene 3, LEAD.')
      /* A scene with no name is its number. */
      b.say('scene', 6)
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'Scene 6.')
    } finally {
      done(b)
    }
  })

  test('Siri: an AM4 has four scenes, and a unit with none has none, and nothing is sent for one it lacks', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      b.rig.__set({ deviceSlug: 'am4', capabilities: { sceneCount: 4, presets: { count: 104, addressing: 'bankLetter' } } })
      for (const n of [5, 6, 7, 8]) {
        b.say('scene', n)
        await b.clock.advance(0)
        assert.equal(b.replies().at(-1), 'This unit has 4 scenes.')
      }
      assert.equal(b.rig.calls.length, 0, 'a fifth scene was sent to an AM4')
      b.say('scene', 4)
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls.map((c) => c.slice(0, 2)), [['scene', 3]])
      b.rig.__set({ capabilities: { hasScenes: false } })
      b.say('scene', 1)
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'This unit has no scenes.')
      assert.equal(b.rig.calls.length, 1)
    } finally {
      done(b)
    }
  })

  test('Siri: every command but Tuner off needs Play on screen; elsewhere it says to open Play on this device, by its own name', async () => {
    for (const [device, noun] of [['phone', 'phone'], ['ipad', 'iPad'], ['tablet', 'tablet']]) {
      const b = await siriOnTheBench({ device })
      try {
        b.siri.siriElsewhere(true)
        for (const [command, value] of [['scene', 3], ['next'], ['previous'], ['tunerOn'], ['tempo', 120], ['preset', 5], ['pedalOn', 'delay'], ['pedalOff', 'drive']]) {
          const id = b.say(command, value)
          await b.clock.advance(0)
          assert.deepEqual(b.replyTo(id), [`Open Play on this ${noun}, then say it again.`], `${command} off Play`)
        }
        assert.equal(b.rig.calls.length, 0, 'a command went from another screen')
        assert.equal(b.rig.notes.length, 0, 'Not sent was put on Play for a command said on another screen')
        /* And Tuner off goes from there. */
        b.say('tunerOff')
        await b.clock.advance(0)
        assert.deepEqual(b.rig.calls, [['tuner', false]])
        assert.equal(b.replies().at(-1), 'Tuner off.')
      } finally {
        done(b)
      }
    }
  })

  test('Siri: the startup card, the walkthrough, the sign-in and the paywall say to open Play at once; only a starting app waits for it', async () => {
    const { playElsewhereOf } = await siriRule()
    /* Play does not come by itself from any of these: each waits for a tap. */
    for (const [where, state] of [
      ['the startup card', { auth: 'out', seenWalk: false, independentDue: true, screen: 'stage' }],
      ['the startup card, signed in', { auth: 'in', seenWalk: true, independentDue: true, screen: 'stage' }],
      ['the walkthrough on a fresh install', { auth: 'out', seenWalk: false, independentDue: false, screen: 'stage' }],
      ['the walkthrough, shown again', { auth: 'in', seenWalk: false, independentDue: false, screen: 'stage' }],
      ['the sign-in', { auth: 'out', seenWalk: true, independentDue: false, screen: 'stage' }],
      ['the paywall', { auth: 'paywall', seenWalk: true, independentDue: false, screen: 'stage' }],
      ['Settings', { auth: 'in', seenWalk: true, independentDue: false, screen: 'settings' }],
      ['Setlists', { auth: 'in', seenWalk: true, independentDue: false, screen: 'setlists' }]
    ]) {
      assert.equal(playElsewhereOf(state), true, `${where} waits a second and a half for a Play that is not coming`)
    }
    /* Still starting, or Play's own place (the waiting screen there can turn into Play by itself). */
    for (const [where, state] of [
      ['the stored answers loading', { auth: 'checking', seenWalk: null, independentDue: false, screen: 'stage' }],
      ['the walkthrough answer loading', { auth: 'in', seenWalk: null, independentDue: false, screen: 'stage' }],
      ['an account being checked after a sign-in', { auth: 'checking', seenWalk: true, independentDue: false, screen: 'stage' }],
      ['Play', { auth: 'in', seenWalk: true, independentDue: false, screen: 'stage' }]
    ]) {
      assert.equal(playElsewhereOf(state), false, `${where} is told to open Play`)
    }
    /* On the bench: said on the walkthrough, it is answered at once, in the words the review notes promise, and nothing is put on Play. */
    const b = await siriOnTheBench()
    try {
      b.siri.siriElsewhere(playElsewhereOf({ auth: 'out', seenWalk: false, independentDue: false, screen: 'stage' }))
      const id = b.say('scene', 3)
      await b.clock.advance(0)
      assert.deepEqual(b.replyTo(id), ['Open Play on this phone, then say it again.'])
      await b.clock.advance(2000)
      assert.deepEqual(b.replyTo(id), ['Open Play on this phone, then say it again.'], 'answered again, late')
      assert.equal(b.rig.notes.length, 0, 'Not sent was put on a Play that was never asked for')
      assert.ok(!b.replies().some((w) => /landed late/.test(w)), 'a command on the walkthrough was said to have been late')
    } finally {
      done(b)
    }
  })

  test('Siri: a command that arrives while the app is still starting waits for Play inside its 1.5 seconds, and is not sent after', async () => {
    const b = await siriOnTheBench()
    try {
      /* Play comes up 900 ms after the Swift took it: in time. */
      const early = b.say('scene', 2, { ago: 0 })
      await b.clock.advance(900)
      assert.equal(b.rig.calls.length, 0, 'sent before Play was up')
      const on = b.play()
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls.map((c) => c.slice(0, 2)), [['scene', 1]])
      assert.deepEqual(b.replyTo(early), ['Scene 2, CHORUS.'])
      on.off()
      /* Play not up by 1.5 s: never sent, and said on Play as a late tap is, and to Siri. */
      const late = b.say('scene', 3, { ago: 0 })
      await b.clock.advance(1500)
      const after = b.play()
      await b.clock.advance(1000)
      assert.equal(b.rig.calls.length, 1, 'a scene went seconds after it was said')
      assert.deepEqual(b.rig.notes.map((n) => n.late), [true])
      assert.deepEqual(b.replyTo(late), ['Not sent, it would have landed late.'])
      /*
       * Signed in with no computer, or one that does not answer: the waiting
       * screen stands in Play's place and Play never comes. Nothing was
       * there to land on, so it is Not sent because nothing is connected.
       */
      after.off()
      b.link.__set('no-answer')
      const nobody = b.say('scene', 4, { ago: 0 })
      await b.clock.advance(1500)
      assert.equal(b.rig.calls.length, 1, 'sent with no computer')
      assert.deepEqual(b.rig.notes.map((n) => n.late), [true, false])
      assert.deepEqual(b.replyTo(nobody), ['Not sent, not connected.'])
    } finally {
      done(b)
    }
  })

  test('Siri: the 1.5 seconds count from when the Swift took the command, not from when it reached the JavaScript', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      /* Held 1.6 s while the app started (the module holds commands up to 15 s): already late. */
      const held = b.say('scene', 2, { ago: 1600 })
      await b.clock.advance(0)
      assert.equal(b.rig.calls.length, 0, 'a command held past its deadline was given a fresh second and a half')
      assert.deepEqual(b.replyTo(held), ['Not sent, it would have landed late.'])
      assert.equal(b.rig.state.dropped, 'Not sent — it would have landed late', 'Play does not say Not sent the way it does for a late tap')
      /* One second old: it goes, with that second already spent (the rig drops it at the same deadline). */
      b.say('pedalOff', 'delay', { ago: 1000 })
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls, [['bypass', 70, true, b.clock.now() - 1000]])
      /* A clock ahead of the JavaScript's is now, never a later deadline. */
      b.say('tempo', 120, { ago: -60000 })
      await b.clock.advance(0)
      assert.equal(b.rig.calls[1][2], b.clock.now())
    } finally {
      done(b)
    }
  })

  test('Siri: one the Swift already answered with Not sent is not acted on, except Tuner off, and is not answered twice', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      b.say('scene', 2, { answered: true, ago: 5200 })
      /* Whatever its clock says: answered is answered. */
      b.say('next', undefined, { answered: true, ago: 100 })
      await b.clock.advance(0)
      assert.equal(b.rig.calls.length, 0, 'a command Siri was told was not sent went anyway')
      assert.equal(b.rig.notes.length, 2, 'Play does not say they were not sent')
      b.say('tunerOff', undefined, { answered: true, ago: 6000 })
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls, [['tuner', false]], 'a late Tuner off was dropped, and the rig left muted')
      assert.equal(b.expo.replies.length, 0, 'Siri was answered again after the Swift answered it')
      /* The same command handed over twice is carried out once. */
      b.say('scene', 4, { id: 'twice' })
      b.say('scene', 4, { id: 'twice' })
      await b.clock.advance(0)
      assert.equal(b.rig.calls.filter((c) => c[0] === 'scene').length, 1)
      assert.equal(b.replyTo('twice').length, 1)
    } finally {
      done(b)
    }
  })

  test('Siri: on a phone that slept, the link is waited for inside the tap rule and no longer; Siri’s own panel over a connected Play is not a sleep', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      /* Siri's panel up over Play: the app is inactive, the link is up, and it goes at once. */
      b.rn.AppState.currentState = 'inactive'
      b.say('scene', 2)
      await b.clock.advance(0)
      assert.equal(b.rig.calls.length, 1, 'Siri’s panel was taken for a sleeping phone')
      assert.equal(b.link.probes, 0, 'a connected link was asked again')
      /* Woken from a sleep, the link rejoining: back in 800 ms, inside the 1.5 s, so it goes. */
      b.rn.AppState.currentState = 'background'
      b.link.__set('joining')
      b.say('scene', 3, { ago: 200 })
      await b.clock.advance(800)
      assert.equal(b.rig.calls.length, 1, 'sent into a link still rejoining')
      b.link.__set('connected')
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls[1].slice(0, 2), ['scene', 2])
      /* Not back inside the 1.5 s: not sent, not connected, said on Play and to Siri. */
      b.link.__set('joining')
      const lost = b.say('scene', 4, { ago: 200 })
      await b.clock.advance(1300)
      b.link.__set('connected')
      await b.clock.advance(1000)
      assert.equal(b.rig.calls.length, 2, 'a scene went after its deadline because the link came back')
      assert.deepEqual(b.replyTo(lost), ['Not sent, not connected.'])
      assert.equal(b.rig.notes.at(-1).late, false)
    } finally {
      done(b)
    }
  })

  test('Siri: Tuner off works from any screen, is answered before it waits for the link, and is tried once more', async () => {
    const b = await siriOnTheBench()
    try {
      /* No Play, the app starting, the link asleep. */
      b.rn.AppState.currentState = 'background'
      b.link.__set('joining')
      let tries = 0
      b.rig.answers.tuner = () => Promise.resolve(++tries > 1)
      const id = b.say('tunerOff')
      await b.clock.advance(0)
      assert.deepEqual(b.replyTo(id), ['Closing the tuner as soon as the connection is back.'], 'Siri waits on a link that may take seconds')
      assert.equal(b.rig.calls.length, 0, 'sent into a link that is asleep')
      await b.clock.advance(400)
      b.link.__set('connected')
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls, [['tuner', false]])
      /* The first did not go: once more, a second and a half on. */
      await b.clock.advance(1500)
      assert.deepEqual(b.rig.calls, [['tuner', false], ['tuner', false]], 'a Tuner off that failed was not tried again, and the rig is left muted')
      await b.clock.advance(5000)
      assert.equal(b.rig.calls.length, 2, 'tried more than twice')
      /* With the link up, on Play or not: at once, and Siri told when it is done. */
      b.rn.AppState.currentState = 'active'
      b.rig.answers.tuner = () => Promise.resolve(true)
      const now = b.say('tunerOff')
      await b.clock.advance(0)
      assert.deepEqual(b.replyTo(now), ['Tuner off.'])
      /* Sent whatever the app thinks the tuner is doing: after a cold start it knows nothing. */
      assert.equal(b.rig.state.tunerOn, false)
      assert.equal(b.rig.calls.length, 3)
    } finally {
      done(b)
    }
  })

  test('Siri: Tuner off over a connected Play, with Siri’s own panel up, goes at once and is said done; one still out at four seconds is said as sent', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      /* Siri's panel over Play: 'inactive', the link up. The most common way Tuner off is said, and no sleep. */
      b.rn.AppState.currentState = 'inactive'
      const id = b.say('tunerOff')
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls, [['tuner', false]], 'the close waited, as if the phone had slept')
      assert.deepEqual(b.replyTo(id), ['Tuner off.'], 'Siri was told the connection was down when it was up')
      assert.equal(b.link.probes, 0, 'a connected link was asked again')
      /* A slow computer: the close still out when Siri must be answered is said as sent, not as a connection that is down. */
      b.rig.answers.tuner = () => new Promise(() => {})
      const slow = b.say('tunerOff', undefined, { ago: 100 })
      await b.clock.advance(3900)
      assert.deepEqual(b.replyTo(slow), [b.rule.sentWords('Tuner off')])
      /* And one whose link went down while it was out is said as waiting for it. */
      const lost = b.say('tunerOff', undefined, { ago: 100 })
      await b.clock.advance(2000)
      b.link.__set('joining')
      await b.clock.advance(1900)
      assert.deepEqual(b.replyTo(lost), ['Closing the tuner as soon as the connection is back.'])
      assert.equal(b.link.probes, 0)
    } finally {
      done(b)
    }
  })

  test('Siri: Tuner off’s second try is never sent over a tuner the player has opened since', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      /* As rig.writeTuner does: the flag goes with the press, and an overtaken or failed one answers false. */
      let firstClose = true
      b.rig.answers.tuner = (on) => {
        b.rig.__set({ tunerOn: on })
        if (!on && firstClose) {
          firstClose = false
          return Promise.resolve(false)
        }
        return Promise.resolve(true)
      }
      const id = b.say('tunerOff')
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls, [['tuner', false]])
      /* And before the second try, the player taps Tuner on Play to tune. */
      await b.clock.advance(500)
      b.rig.writeTuner(true, b.clock.now())
      await b.clock.advance(5000)
      assert.deepEqual(b.rig.calls.map((c) => c.slice(0, 2)), [['tuner', false], ['tuner', true]], 'the second try shut a tuner the player had just opened')
      assert.equal(b.rig.state.tunerOn, true)
      assert.deepEqual(b.replyTo(id), ['The tuner is already on. Your rig is muted.'])
      /* Nobody opened it: the second try goes, as it always did. */
      firstClose = true
      b.rig.__set({ tunerOn: false })
      b.say('tunerOff')
      await b.clock.advance(5000)
      assert.deepEqual(b.rig.calls.slice(2).map((c) => c.slice(0, 2)), [['tuner', false], ['tuner', false]])
      assert.equal(b.replies().at(-1), 'Tuner off.')
    } finally {
      done(b)
    }
  })

  /*
   * TUNER OFF'S SECOND TRY AND A TUNER ON ON ITS WAY: the watch's rule
   * (1.87.58, test/link-now.mjs). An open counts as on its way from the
   * moment it arrives (rig tunerAskWaits), while it waits for Play or for
   * the link after a sleep, and from its press until the unit answers it.
   * The second try waits while any open is on its way, then goes only over a
   * tuner that is not open. A close sent first would take the open's place:
   * it is stamped as it is sent, later than the open's own `at`, so the
   * relay keeps it as the newer of the two and the open never lands.
   */
  test('Siri: a Tuner on waiting for the same link as Tuner off’s second try is waited for, and the close never takes its place', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      b.rig.answers.tuner = tunerLike(b, { closes: [false] })
      /* Tuner off from a phone that slept: the first try goes once the link is back, and does not go. */
      b.rn.AppState.currentState = 'background'
      b.link.__set('joining')
      b.say('tunerOff')
      await b.clock.advance(500)
      b.link.__set('connected')
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls, [['tuner', false]])
      /* The link drops again, so the second try waits for it, and then Tuner on is said and waits for it too. */
      b.link.__set('joining')
      await b.clock.advance(1600)
      const on = b.say('tunerOn', undefined, { ago: 100 })
      await b.clock.advance(100)
      assert.deepEqual(b.rig.calls, [['tuner', false]], 'the open went before the link was back')
      assert.equal(b.rig.tunerAsksWaiting(), 1, 'a Tuner on waiting for the link is not counted as on its way')
      /* The link back: the second try hears it first, and must not close ahead of the open. */
      b.link.__set('connected')
      await b.clock.advance(5000)
      assert.deepEqual(b.rig.calls.map((c) => c[1]), [false, true], 'the second try went ahead of a Tuner on still waiting for the link')
      assert.equal(b.rig.state.tunerOn, true)
      assert.ok(b.log.said.some((l) => /tuner off: opened again since, so not tried again/.test(l)))
      assert.deepEqual(b.replyTo(on), ['Tuner on. Your rig is muted.'])
      assert.equal(b.rig.tunerAsksWaiting(), 0, 'the open is still counted as on its way after it was answered')
    } finally {
      done(b)
    }
  })

  test('Siri: a Tuner on that pressed keeps Tuner off’s second try back until it is answered, and one that then failed lets the close go', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      let no = null
      b.rig.answers.tuner = tunerLike(b, { closes: [false], opens: [new Promise((r) => (no = r))] })
      b.rn.AppState.currentState = 'background'
      b.link.__set('joining')
      b.say('tunerOff')
      await b.clock.advance(500)
      b.link.__set('connected')
      await b.clock.advance(500)
      /* Play in front again, the link up: Tuner on presses at once, and the unit has not answered yet. */
      b.rn.AppState.currentState = 'active'
      b.say('tunerOn', undefined, { ago: 100 })
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls.map((c) => c[1]), [false, true])
      assert.equal(b.rig.state.tunerOn, true)
      /* The second try's time comes, with the open pressed and not answered: pressed is not landed. */
      await b.clock.advance(1500)
      assert.deepEqual(b.rig.calls.map((c) => c[1]), [false, true], 'the second try went over an open still waiting for its answer')
      /* It did not go: nothing opened, and the rig still wants its close. */
      no(false)
      await b.clock.advance(5000)
      assert.deepEqual(b.rig.calls.map((c) => c[1]), [false, true, false], 'an open that pressed and failed kept the second try back: the rig stays muted, the screens say off')
      assert.equal(b.rig.state.tunerOn, false)
      assert.equal(b.rig.tunerAsksWaiting(), 0)
    } finally {
      done(b)
    }
  })

  test('Siri: a Tuner on dropped at its deadline keeps nothing back, and Tuner off’s second try then closes the tuner', async () => {
    const b = await siriOnTheBench()
    try {
      /* The app still starting, Play not up yet, and nothing else in its place. */
      b.rig.answers.tuner = tunerLike(b, { closes: [false] })
      b.rn.AppState.currentState = 'background'
      b.link.__set('joining')
      b.say('tunerOff')
      await b.clock.advance(500)
      b.link.__set('connected')
      await b.clock.advance(500)
      /* Tuner on waits for Play inside its 1.5 seconds, and Play does not come. */
      const on = b.say('tunerOn', undefined, { ago: 100 })
      await b.clock.advance(0)
      assert.equal(b.rig.tunerAsksWaiting(), 1, 'a Tuner on waiting for Play is not counted as on its way')
      /* The second try's time comes while it still waits: held back, as it may yet press. */
      await b.clock.advance(1200)
      assert.deepEqual(b.rig.calls.map((c) => c[1]), [false], 'the second try went ahead of a Tuner on that could still press')
      /* Its deadline passes: not sent, let go of, and the close goes. */
      await b.clock.advance(2000)
      assert.deepEqual(b.replyTo(on), ['Not sent, it would have landed late.'])
      assert.equal(b.rig.tunerAsksWaiting(), 0, 'an open dropped at its deadline is still counted as on its way')
      assert.deepEqual(b.rig.calls.map((c) => c[1]), [false, false], 'a dropped open kept the second try back: the rig stays muted')
      assert.equal(b.replies().length, 2)
    } finally {
      done(b)
    }
  })

  /*
   * NEVER LATE. Every Siri command, and every link, brings the app to the
   * front, so the chain starts with the app on screen; but the player puts the
   * phone away the moment Siri has answered, and nothing holds the app up
   * then (the Siri module takes no background time, unlike the watch's
   * 25-second wake): the phone stops it within seconds, timers and all, and
   * they go on where they stopped at the next launch. So once the app has
   * gone into the background (AppState 'background', which iOS says before
   * it stops the app), Tuner off goes inside SIRI_CLOSE_WINDOW_MS of `at` or
   * not at all. Each of these is an app in the background.
   */
  test('Siri: Tuner off goes only inside its window, never at the next launch over whatever tuner is up by then', async () => {
    /* The app in the background from the start, and the link never back inside the window: the second try is let go of. */
    {
      const b = await siriOnTheBench()
      try {
        assert.equal(b.siri.SIRI_CLOSE_WINDOW_MS, 20000)
        b.rig.answers.tuner = tunerLike(b, { closes: [false] })
        b.rn.AppState.currentState = 'background'
        b.link.__set('joining')
        b.say('tunerOff')
        await b.clock.advance(500)
        b.link.__set('connected')
        await b.clock.advance(0)
        b.link.__set('joining')
        await b.clock.advance(30000)
        b.link.__set('connected')
        await b.clock.advance(5000)
        assert.deepEqual(b.rig.calls.map((c) => c[1]), [false], 'a second try went after its window')
        assert.ok(b.log.said.some((l) => /tuner off: too late to try again/.test(l)))
      } finally {
        done(b)
      }
    }
    /* Put away and stopped between the tries, over a connected Play: ten minutes on, nothing goes. */
    {
      const b = await siriOnTheBench()
      try {
        b.play()
        b.rig.answers.tuner = tunerLike(b, { closes: [false] })
        b.say('tunerOff')
        await b.clock.advance(0)
        assert.deepEqual(b.rig.calls.map((c) => c[1]), [false])
        b.rn.AppState.__change('inactive')
        b.rn.AppState.__change('background')
        b.clock.jump(10 * 60000)
        await b.clock.advance(5000)
        assert.deepEqual(b.rig.calls.map((c) => c[1]), [false], 'a second try stopped with the app went at the next launch')
        assert.ok(b.log.said.some((l) => /tuner off: too late to try again/.test(l)))
      } finally {
        done(b)
      }
    }
    /* And stopped while the first try waited for the link after a sleep: nothing goes when the link is back. */
    {
      const b = await siriOnTheBench()
      try {
        b.rn.AppState.currentState = 'background'
        b.link.__set('joining')
        b.say('tunerOff')
        await b.clock.advance(500)
        b.clock.jump(10 * 60000)
        b.link.__set('connected')
        await b.clock.advance(5000)
        assert.deepEqual(b.rig.calls, [], 'a first try stopped with the app went at the next launch')
        assert.ok(b.log.said.some((l) => /tuner off: too late to try again/.test(l)))
      } finally {
        done(b)
      }
    }
    /* Inside it, as before: a link back after six seconds still gets its close, and its second try. */
    {
      const b = await siriOnTheBench()
      try {
        b.rig.answers.tuner = tunerLike(b, { closes: [false] })
        b.rn.AppState.currentState = 'background'
        b.link.__set('joining')
        b.say('tunerOff')
        await b.clock.advance(6000)
        b.link.__set('connected')
        await b.clock.advance(5000)
        assert.deepEqual(b.rig.calls.map((c) => c[1]), [false, false])
        assert.equal(b.replies().length, 1)
      } finally {
        done(b)
      }
    }
  })

  /*
   * BUT NOT WHILE THE APP STAYS ON SCREEN. A close is a request to the relay,
   * and it can take most of the window by itself: up to RELAY_GRACE (8 s)
   * waiting for a channel that is down, and up to timeoutFor('POST',
   * '/tuner') (20 s) for a computer that has gone with the channel still
   * joined. With Play still up, nothing stops the app, and the window would
   * only drop the close, with the rig muted under a Play that says the tuner
   * is off. There every wait the chain ever had still stands.
   */
  test('Siri: Tuner off with the app still on screen is not cut off by its window, however long the close itself takes', async () => {
    /* The link asleep from the start, the first close spending the relay's 8 s grace, and the link back at 22 seconds. */
    const slowFirst = (b, ms) => {
      let closes = 0
      return (on) => {
        b.rig.__set({ tunerOn: on })
        if (on || ++closes > 1) return Promise.resolve(true)
        return new Promise((r) => b.clock.setTimeout(() => r(false), ms))
      }
    }
    {
      const b = await siriOnTheBench()
      try {
        b.play()
        b.rig.answers.tuner = slowFirst(b, 8000)
        b.link.__set('joining')
        const id = b.say('tunerOff')
        await b.clock.advance(0)
        assert.deepEqual(b.replyTo(id), ['Closing the tuner as soon as the connection is back.'])
        await b.clock.advance(21800)
        assert.deepEqual(b.rig.calls.map((c) => c[1]), [false])
        b.link.__set('connected')
        await b.clock.advance(5000)
        assert.deepEqual(b.rig.calls.map((c) => c[1]), [false, false], 'the second try was cut off by the window with Play still on screen: the rig stays muted, Play says the tuner is off')
        assert.ok(!b.log.said.some((l) => /too late/.test(l)))
        assert.equal(b.replies().length, 1)
        assert.equal(b.rn.AppState.__listening(), 0, 'Tuner off is still listening for the app going away after it was done')
      } finally {
        done(b)
      }
    }
    /* The link up, under Siri's own panel, and the computer gone with the channel still joined: the first close goes unanswered for 20 seconds. */
    {
      const b = await siriOnTheBench()
      try {
        b.play()
        b.rig.answers.tuner = slowFirst(b, 20000)
        b.rn.AppState.currentState = 'inactive'
        b.say('tunerOff')
        await b.clock.advance(0)
        assert.deepEqual(b.rig.calls.map((c) => c[1]), [false])
        b.rn.AppState.__change('active')
        await b.clock.advance(2000)
        b.link.__set('joining')
        await b.clock.advance(10000)
        b.link.__set('connected')
        await b.clock.advance(15000)
        assert.deepEqual(b.rig.calls.map((c) => c[1]), [false, false], 'the first try alone used the whole window, so the second try never ran')
        assert.ok(!b.log.said.some((l) => /too late/.test(l)))
        assert.equal(b.rn.AppState.__listening(), 0)
      } finally {
        done(b)
      }
    }
    /* As the first, but the phone put away in the meantime: then the window holds, and the late close is let go of. */
    {
      const b = await siriOnTheBench()
      try {
        b.play()
        b.rig.answers.tuner = slowFirst(b, 8000)
        b.link.__set('joining')
        b.say('tunerOff')
        await b.clock.advance(10000)
        b.rn.AppState.__change('inactive')
        b.rn.AppState.__change('background')
        await b.clock.advance(11800)
        b.link.__set('connected')
        await b.clock.advance(5000)
        assert.deepEqual(b.rig.calls.map((c) => c[1]), [false], 'a close went after its window from an app put away')
        assert.ok(b.log.said.some((l) => /tuner off: too late to try again/.test(l)))
        assert.equal(b.rn.AppState.__listening(), 0)
      } finally {
        done(b)
      }
    }
  })

  test('Siri: Tuner on needs Play, says the rig is muted, and is not sent twice or to a unit without one', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      b.say('tunerOn', undefined, { ago: 200 })
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls, [['tuner', true, b.clock.now() - 200]], 'the tuner opening is not bound by the tap rule')
      assert.equal(b.replies().at(-1), 'Tuner on. Your rig is muted.')
      b.rig.__set({ tunerOn: true })
      b.say('tunerOn')
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'The tuner is already on. Your rig is muted.')
      b.rig.__set({ tunerOn: false, capabilities: { ...b.rig.state.capabilities, tuner: false } })
      b.say('tunerOn')
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'This unit has no tuner the app can open.')
      assert.equal(b.rig.calls.length, 1)
      /* None of them is left counted as on its way, the one that pressed nor the two that never would. */
      assert.equal(b.rig.tunerAsksWaiting(), 0, 'a Tuner on that never pressed is still counted as on its way')
    } finally {
      done(b)
    }
  })

  test('Siri: a pedal by kind is exactly one in Play’s own chain, set on or off as asked, and never a guess', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      b.say('pedalOn', 'drive')
      b.say('pedalOff', 'reverb')
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls.map((c) => c.slice(0, 3)), [['bypass', 133, false], ['bypass', 66, true]])
      assert.deepEqual(b.replies(), ['Drive on.', 'Reverb off.'])
      /* None of the kind. */
      b.say('pedalOn', 'wah')
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'This preset has no wah.')
      /* Two delays, by any name a delay goes by: use the screen. */
      b.rig.__set({ blocks: [...b.rig.state.blocks, { slug: 'plex', name: 'Plex Delay', effectId: 72, bypassed: true }] })
      b.say('pedalOn', 'delay')
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'This preset has more than one delay, so use the screen.')
      /* One Plex Delay alone is the delay. */
      b.rig.__set({ blocks: [{ slug: 'plex', name: 'Plex Delay', effectId: 72, bypassed: true }, { slug: 'multicomp', name: 'Multiband Comp', effectId: 48, bypassed: true }] })
      b.say('pedalOn', 'delay')
      b.say('pedalOn', 'compressor')
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls.slice(2).map((c) => c.slice(0, 3)), [['bypass', 72, false], ['bypass', 48, false]])
      /* Never on the outline, another preset's chain still up, or a chain whose read failed. */
      for (const view of ['outline', 'loading', 'failed']) {
        b.rig.__set({ view })
        b.say('pedalOff', 'delay')
        await b.clock.advance(0)
        assert.equal(b.replies().at(-1), 'This preset’s pedals aren’t read yet. Try again in a moment.', `a pedal was switched on a chain that is ${view}`)
      }
      assert.equal(b.rig.calls.length, 4)
      /* And a chain being read again is still this preset's own. */
      b.rig.__set({ view: 'updating' })
      b.say('pedalOff', 'delay')
      await b.clock.advance(0)
      assert.equal(b.rig.calls.length, 5)
      /* Every kind the Swift can name is a kind here, and boost is the AM4's. */
      const { SIRI_PEDALS } = await import(pathToFileURL(join(b.dir, 'siriPipe.js')).href)
      assert.deepEqual(Object.keys(b.rule.PEDAL_SLUGS), [...SIRI_PEDALS])
    } finally {
      done(b)
    }
  })

  test('Siri: Boost on is an AM4 amp’s boost, sent as the boost and never on another unit', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      b.say('pedalOn', 'boost')
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'Only an AM4’s amp has a boost the app can switch.')
      b.rig.__set({ deviceSlug: 'am4', capabilities: { sceneCount: 4, presets: { count: 104, addressing: 'bankLetter' } } })
      b.say('pedalOn', 'boost')
      b.say('pedalOff', 'boost')
      await b.clock.advance(0)
      /* writeBypass with the amp is rig.tapBoost with the boost asked for: on is bypassed false. */
      assert.deepEqual(b.rig.calls.map((c) => c.slice(0, 3)), [['bypass', 58, false], ['bypass', 58, true]])
      assert.deepEqual(b.replies().slice(-2), ['Boost on.', 'Boost off.'])
      /* The boost refused by the rig (the unit still being found): its own words. */
      b.rig.answers.bypass = () => {
        b.rig.__set({ error: 'The unit is still being found, so the boost wasn’t sent. Try it again in a moment.' })
        return Promise.resolve(false)
      }
      b.say('pedalOn', 'boost')
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'The unit is still being found, so the boost wasn’t sent. Try it again in a moment.')
      /* An amp at another code: the app cannot switch its boost. No amp: said. */
      b.rig.__set({ blocks: [{ slug: 'amp', name: 'Amp 2', effectId: 59, bypassed: false }] })
      b.say('pedalOn', 'boost')
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'The app can’t switch this amp’s boost yet.')
      b.rig.__set({ blocks: [{ slug: 'drive', name: 'Drive 1', effectId: 133, bypassed: true }] })
      b.say('pedalOn', 'boost')
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'This preset has no amp.')
      assert.equal(b.rig.calls.length, 3)
    } finally {
      done(b)
    }
  })

  test('Siri: a tempo is held to the unit’s own range, and a VP4, which has none the app can set, says so', async () => {
    const { tempoRange } = await import('../shared/tempo.mjs')
    const b = await siriOnTheBench()
    try {
      b.play()
      for (const slug of ['am4', 'fm3', 'fm9', 'axefxiii']) {
        const range = tempoRange(slug)
        b.rig.__set({ deviceSlug: slug })
        for (const [bpm, goes] of [[range.min, true], [range.max, true], [range.max + 1, false], [range.min - 1, false]]) {
          const before = b.rig.calls.length
          b.say('tempo', bpm)
          await b.clock.advance(0)
          assert.equal(b.rig.calls.length - before, goes ? 1 : 0, `${slug} tempo ${bpm}`)
          assert.equal(b.replies().at(-1), goes ? `Tempo ${bpm}.` : `This unit takes a tempo from ${range.min} to ${range.max}.`)
        }
      }
    } finally {
      done(b)
    }
    const vp4 = await siriOnTheBench({ vp4: true })
    try {
      vp4.play()
      vp4.say('tempo', 120)
      await vp4.clock.advance(0)
      assert.equal(vp4.rig.calls.length, 0)
      assert.equal(vp4.replies().at(-1), 'The app can’t set a VP4’s tempo yet. Tap tempo on the VP4 itself for now.')
    } finally {
      done(vp4)
    }
  })

  test('Siri: a preset by the number Play prints, named back as soon as the unit takes it, with an AM4’s bank', async () => {
    const b = await siriOnTheBench({ names: { 12: 'Clean', 40: 'Schism' } })
    try {
      b.play()
      b.rig.__set({ deviceSlug: 'am4', capabilities: { sceneCount: 4, presets: { count: 104, addressing: 'bankLetter' } }, preset: { number: 3, name: 'Old' } })
      /* The load goes on reading for seconds; Siri is answered when the select is. */
      let landed
      b.rig.answers.preset = () => new Promise((r) => (landed = r))
      const id = b.say('preset', 12, { ago: 100 })
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls, [['preset', 12, b.clock.now() - 100]])
      assert.equal(b.replyTo(id).length, 0, 'answered before the unit took it')
      b.rig.__answered(12, true)
      await b.clock.advance(0)
      assert.deepEqual(b.replyTo(id), ['Preset 012 D01, Clean.'])
      landed(true)
      await b.clock.advance(0)
      assert.equal(b.replyTo(id).length, 1)
      assert.equal(b.rig.__watching(), 0, 'still listening for a select already answered')
      /* Past the unit's last slot: said, nothing sent. The one on screen: not loaded again (that throws unsaved changes away). */
      b.rig.__set({ preset: { number: 12, name: 'Clean' } })
      b.say('preset', 104)
      b.say('preset', 12)
      await b.clock.advance(0)
      assert.deepEqual(b.replies().slice(-2), ['This unit’s presets go from 0 to 103.', 'Already on preset 012 D01.'])
      assert.equal(b.rig.calls.length, 1)
      /* Refused: Play's own words. A VP4 that took it and showed no change: the rig's words for that. */
      b.rig.answers.preset = () => {
        b.rig.__set({ error: 'The unit refused that preset.' })
        b.rig.__answered(40, false)
        return Promise.resolve(false)
      }
      b.say('preset', 40)
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'The unit refused that preset.')
      b.rig.answers.preset = () => (b.rig.__answered(41, false, 'Sent, but the app couldn’t confirm the VP4 changed preset.'), new Promise(() => {}))
      b.say('preset', 41)
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'Sent, but the app couldn’t confirm the VP4 changed preset.')
    } finally {
      done(b)
    }
  })

  test('Siri: Next and Previous are Play’s own buttons, with the moment the Swift took them, and say where they went', async () => {
    const b = await siriOnTheBench({ names: { 13: 'Schism' } })
    try {
      const on = b.play({ step: (by) => (b.rig.__answered(12 + by, true), Promise.resolve(true)) })
      b.say('next', undefined, { ago: 250 })
      b.say('previous')
      await b.clock.advance(0)
      assert.deepEqual(on.steps, [[1, b.clock.now() - 250], [-1, b.clock.now() - 100]], 'not Play’s step, or not with the moment Siri handed it over')
      assert.deepEqual(b.replies(), ['Next: Schism, preset 013.', 'Previous: preset 011.'])
      assert.equal(b.rig.calls.length, 0, 'Next loaded a preset itself rather than through Play, which knows the setlist')
      on.off()
      /* The end of the slots: nothing to step to, and nothing pressed. */
      const end = b.play({ landing: () => null })
      b.say('next')
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'There’s no next preset.')
      assert.equal(end.steps.length, 0)
      end.off()
      /* A VP4 slot by slot: Play's own button says why on screen, and Siri says the same. */
      const stuck = b.play({ landing: () => null, stuck: () => 'On a VP4, Previous and Next work in a setlist or your starred presets.' })
      b.say('previous')
      await b.clock.advance(0)
      assert.equal(stuck.steps.length, 1)
      assert.equal(b.replies().at(-1), 'On a VP4, Previous and Next work in a setlist or your starred presets.')
    } finally {
      done(b)
    }
  })

  test('Siri: a write that did not go is answered with Play’s own words; one still out when Siri must be answered is said as sent', async () => {
    const b = await siriOnTheBench()
    try {
      b.play()
      b.rig.answers.scene = () => {
        b.rig.__set({ dropped: 'Not sent — not connected' })
        return Promise.resolve(false)
      }
      b.say('scene', 2)
      await b.clock.advance(0)
      assert.equal(b.replies().at(-1), 'Not sent, not connected.')
      /* On the wire past its deadline and not answered yet, a second before the Swift would say Not sent. */
      b.rig.answers.scene = () => new Promise(() => {})
      const id = b.say('scene', 3, { ago: 0 })
      await b.clock.advance(b.rule.SIRI_ANSWER_MS - 1)
      assert.equal(b.replyTo(id).length, 0)
      await b.clock.advance(1)
      assert.deepEqual(b.replyTo(id), ['Sent: Scene 3. The unit hasn’t answered yet.'])
      const { SIRI_REPLY_MS } = await import(pathToFileURL(join(b.dir, 'siriPipe.js')).href)
      assert.ok(b.rule.SIRI_ANSWER_MS <= SIRI_REPLY_MS - 500, 'the JavaScript answers too close to the Swift’s own Not sent')
    } finally {
      done(b)
    }
  })

  test('Siri: in the demo, which is what Apple’s reviewer has, the commands land on the simulated unit', async () => {
    const b = await demoOnTheBench('fm3')
    try {
      const { rig } = b
      assert.equal(rig.getState().deviceSlug, 'fm3', 'the demo did not come up')
      b.play({ step: (by, when) => rig.loadPreset(rig.getState().preset.number + by, when), landing: (by) => rig.getState().preset.number + by })
      b.say('scene', 3)
      await b.clock.advance(2000)
      assert.equal(rig.getState().sceneIndex, 2, 'the demo did not go to scene 3')
      assert.match(b.replies().at(-1), /^Scene 3[.,]/)
      b.say('tempo', 132)
      await b.clock.advance(2000)
      assert.equal(rig.getState().bpm, 132)
      assert.equal(b.replies().at(-1), 'Tempo 132.')
      const was = rig.getState().preset.number
      b.say('next')
      await b.clock.advance(8000)
      assert.equal(rig.getState().preset.number, was + 1)
      assert.match(b.replies().at(-1), /^Next: .*preset \d{3}\.$/)
      /* A pedal the demo preset has exactly one of. */
      const blocks = rig.getState().blocks
      const kind = Object.entries(b.rule.PEDAL_SLUGS).find(([k, slugs]) => k !== 'boost' && blocks.filter((x) => slugs.includes(x.slug)).length === 1)?.[0]
      assert.ok(kind, 'the demo preset has no pedal of a kind Siri names, once')
      const block = blocks.find((x) => b.rule.PEDAL_SLUGS[kind].includes(x.slug))
      const wanted = block.bypassed === true
      b.say(wanted ? 'pedalOn' : 'pedalOff', kind)
      await b.clock.advance(2000)
      assert.equal(rig.getState().blocks.find((x) => x.effectId === block.effectId).bypassed, !wanted, `${kind} was not switched in the demo`)
      assert.equal(b.replies().at(-1), `${b.rule.pedalWord(kind)} ${wanted ? 'on' : 'off'}.`)
      b.say('tunerOn')
      await b.clock.advance(2000)
      assert.equal(rig.getState().tunerOn, true)
      b.siri.siriElsewhere(true)
      b.say('tunerOff')
      await b.clock.advance(2000)
      assert.equal(rig.getState().tunerOn, false)
      assert.equal(b.replies().at(-1), 'Tuner off.')
    } finally {
      done(b)
    }
  })

  test('Siri: the rig says Not sent for a command from outside the screen, and when a preset’s select is answered', async () => {
    const b = await demoOnTheBench('am4')
    try {
      const { rig } = b
      rig.notSentNow('siri scene')
      assert.equal(rig.getState().dropped, 'Not sent — it would have landed late')
      assert.ok(rig.getState().droppedAt > 0, 'Play would not show it: no time on it')
      rig.notSentNow('siri scene', { late: false })
      assert.equal(rig.getState().dropped, 'Not sent — not connected')
      const heard = []
      const off = rig.onPresetAnswered((e) => heard.push(e))
      const loading = rig.loadPreset(20)
      await b.clock.advance(0)
      assert.deepEqual(heard, [{ number: 20, ok: true, words: null }], 'the select was not said as answered before the reads behind it')
      let finished = false
      loading.then(() => (finished = true))
      await b.clock.advance(0)
      assert.equal(finished, false, 'nothing was read after the select, or the test proves nothing')
      await b.clock.advance(8000)
      assert.equal(await loading, true)
      off()
      rig.loadPreset(21)
      await b.clock.advance(8000)
      assert.equal(heard.length, 1, 'still told after it stopped listening')
    } finally {
      done(b)
    }
  })

  test('Siri: every word it is handed is plain, names the device by deviceNoun, and calls nothing official', async () => {
    const rule = await siriRule()
    const S = rule.SIRI_SAYS
    const said = [
      S.openPlay('iPad'), S.notSent, S.scene(3, 'LEAD'), S.scene(6, ''), S.noScenes, S.sceneCount(4),
      S.step(1, '013', 'Schism'), S.step(-1, '011', ''), S.end(1), S.end(-1), S.preset('012 D01', 'Clean'), S.preset('012', ''),
      S.presetSame('012'), S.presetRange(104), S.presetRange(null), S.tempo(120), S.tempoRange(24, 250),
      S.tunerOn, S.tunerAlready, S.noTuner, S.tunerOff, S.tunerOffSoon,
      ...Object.keys(rule.PEDAL_SLUGS).flatMap((k) => [S.pedal(k, true), S.pedal(k, false), S.noPedal(k), S.manyPedals(k)]),
      S.notRead, S.noAmp, S.boostNotHere
    ]
    /* Every one of them, so a new sentence cannot skip this. */
    assert.equal(Object.keys(S).length, 23, 'a sentence was added to SIRI_SAYS and not to this test')
    said.push(rule.sentWords('Scene 3'))
    for (const w of said) {
      assert.ok(!/this phone/i.test(w), `“${w}” says “this phone”`)
      assert.ok(!/\b(official|certified|approved|endorsed|authori[sz]ed)\b/i.test(w), `“${w}”`)
      assert.ok(!/colour|favourite|grey\b|fractal audio/i.test(w), `“${w}”`)
      assert.ok(!/undefined|null|NaN|\[object/.test(w), `“${w}”`)
    }
    /* The one sentence that names the device takes it from deviceNoun, as it is shown. */
    const code = withoutComments(read(`${LIB}/siri.js`))
    assert.match(code, /SIRI_SAYS\.openPlay\(deviceNoun\(\)\)/)
    assert.ok(!/['`"][^'`"]*this phone/i.test(code), 'lib/siri says “this phone”')
    /* Play's own notes, as Siri says them. */
    assert.equal(rule.spoken('Not sent — not connected'), 'Not sent, not connected.')
    assert.equal(rule.spoken('Scene 3.'), 'Scene 3.')
    assert.equal(rule.spoken(`a\n${'x'.repeat(400)}`).length, 300)
  })

  test('Siri: Play hands over its own step, the app listens for its life, and nothing asks whether it is the demo', () => {
    const stage = withoutComments(read('mobile/src/screens/Stage.js'))
    assert.match(stage, /import \{ useSiriPlay \} from '\.\.\/lib\/siri'/)
    assert.match(stage, /useSiriPlay\(\{ step, landing, stuck: \(\) => \(!order && noSlotSteps \? vp4StepWords\(caps\) : null\) \}\)/, 'Siri’s Next is not Play’s own step')
    const step = stage.slice(stage.indexOf('const step = async (by, at = Date.now()) => {'), stage.indexOf('\n  }\n', stage.indexOf('const step = async (by, at = Date.now()) => {')))
    assert.match(step, /const loading = loadPreset\(next, at\)/)
    assert.match(step, /return loading\s*$/, 'Play’s step does not hand back its load, so Siri cannot say how it went')
    const app = flat('mobile/App.js')
    assert.match(app, /import \{ (allowSiriLinks, )?siriElsewhere, startSiri \} from '\.\/src\/lib\/siri'/)
    assert.match(app, /useEffect\(\(\) => startSiri\(\), \[\]\)/, 'Siri is not listened for from the start, so Tuner off works only on Play')
    assert.match(app, /import \{ playElsewhereOf \} from '\.\/src\/lib\/siri-rule'/)
    assert.match(app, /const playElsewhere = playElsewhereOf\(\{ auth, seenWalk, independentDue, screen \}\)/)
    assert.match(app, /useEffect\(\(\) => siriElsewhere\(playElsewhere\), \[playElsewhere\]\)/)
    const siri = withoutComments(read(`${LIB}/siri.js`))
    assert.ok(!/isDemo|from '\.\/demo'/.test(siri), 'Siri takes another road in the demo than on a rig, so the reviewer would try something customers do not have')
    /* The handler is the JavaScript's alone: it loads the native piece only through the pipe, which is null on every older build. */
    assert.ok(!/requireOptionalNativeModule|requireNativeModule|NativeModules/.test(siri))
    assert.match(read(`${LIB}/siriPipe.js`), /requireOptionalNativeModule\('FractalSiri'\)/)
  })

  test('links: fractalremote://next, previous, scene/1 to 8 and tuner/off are commands, and nothing else is, tuner on least of all', async () => {
    const { parseLink, LINK_SCHEME } = await siriRule()
    assert.equal(LINK_SCHEME, JSON.parse(read('mobile/app.json')).expo.scheme, 'the links are not the scheme every store build answers to')
    assert.deepEqual(parseLink('fractalremote://next'), { command: 'next', value: null })
    assert.deepEqual(parseLink('fractalremote://previous'), { command: 'previous', value: null })
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) assert.deepEqual(parseLink(`fractalremote://scene/${n}`), { command: 'scene', value: n })
    assert.deepEqual(parseLink('fractalremote://tuner/off'), { command: 'tunerOff', value: null })
    /* As Shortcuts and Tasker may write them. */
    assert.deepEqual(parseLink(' FractalRemote://Scene/3/ '), { command: 'scene', value: 3 })
    assert.deepEqual(parseLink('fractalremote:///next?from=shortcut#x'), { command: 'next', value: null })
    for (const url of [
      'fractalremote://tuner/on', 'fractalremote://tuner', 'fractalremote://tuner/on/off', 'fractalremote://scene/0', 'fractalremote://scene/9',
      'fractalremote://scene/03', 'fractalremote://scene/3/4', 'fractalremote://scene', 'fractalremote://', 'fractalremote://preset/12',
      'fractalremote://tempo/120', 'fractalremote://delay/on', 'https://fractal.newbold.cloud/next', 'exp+fractal-remote://expo-development-client', '', null, undefined, 42
    ]) assert.equal(parseLink(url), null, `${url} was taken for a command`)
  })

  test('links: open to Justin alone until the copy of the app is itself the new store version, which no update can make it', async () => {
    const { linksOpen, LINKS_AFTER_STORE } = await siriRule()
    /* The newest store version made before the links, on both stores, and nothing built since. */
    assert.equal(LINKS_AFTER_STORE, '1.87.11')
    assert.match(read('docs/expo-builds.md'), /\| 11 Oct \| 1\.87\.11 \| 1 \| 1 \|/)
    assert.equal(JSON.parse(read('public/store-versions.json')).ios, LINKS_AFTER_STORE, 'a newer store version is out: LINKS_AFTER_STORE is the one before the links')
    for (const platform of ['ios', 'android']) {
      assert.equal(linksOpen({ platform, installed: '1.87.11' }), false, `${platform}: open on 1.87.11, whose review notes say nothing of them`)
      assert.equal(linksOpen({ platform, installed: '1.87.11', admin: true }), true, `${platform}: shut to his own account`)
    }
    /* iPhone and iPad: the Siri piece is in the copy, or not. A version number alone is not it there. */
    assert.equal(linksOpen({ platform: 'ios', native: true, installed: '1.87.11' }), true)
    assert.equal(linksOpen({ platform: 'ios', installed: '1.87.60' }), false)
    /* Android, which has no Siri piece: the version built into the copy. */
    for (const v of ['1.87.12', '1.87.52', '1.88.0', '2.0.0']) assert.equal(linksOpen({ platform: 'android', installed: v }), true, v)
    for (const v of ['1.87.1', '1.87.0', '1.86.83', null, '', 'nonsense', '1.87']) assert.equal(linksOpen({ platform: 'android', installed: v }), false, String(v))
    assert.equal(linksOpen({ platform: 'web', installed: '9.9.9' }), false)
    assert.equal(linksOpen(), false)
  })

  test('links: on a copy from before them, a link does nothing but for his account, and opens to everybody on the new store version', async () => {
    for (const [os, opts, everybody] of [
      ['ios', { siri: false, installed: '1.87.11' }, false],
      ['ios', { siri: false, installed: '1.87.55' }, false],
      ['ios', { siri: true, installed: '1.87.55' }, true],
      ['android', { siri: false, installed: '1.87.11' }, false],
      ['android', { siri: false, installed: '1.87.55' }, true]
    ]) {
      const b = await siriOnTheBench({ os, ...opts })
      const where = `${os} ${opts.installed}${opts.siri ? ' with Siri' : ''}`
      try {
        b.play()
        assert.equal(b.siri.siriLinksOpen(), everybody, where)
        b.rn.Linking.open('fractalremote://scene/3')
        await b.clock.advance(0)
        assert.equal(b.rig.calls.length, everybody ? 1 : 0, `${where}: before anybody signed in`)
        assert.equal(b.siri.allowSiriLinks(CUSTOMER), everybody, where)
        b.rn.Linking.open('fractalremote://scene/3')
        await b.clock.advance(0)
        assert.equal(b.rig.calls.length, everybody ? 2 : 0, `${where}: a customer`)
        assert.equal(b.siri.allowSiriLinks(JUSTIN), true, where)
        b.rn.Linking.open('fractalremote://scene/3')
        await b.clock.advance(0)
        assert.deepEqual(b.rig.calls.at(-1), ['scene', 2, b.clock.now()], `${where}: his own account`)
        /* Signed out: shut again. */
        assert.equal(b.siri.allowSiriLinks(null), everybody, where)
        const before = b.rig.calls.length
        b.rn.Linking.open('fractalremote://scene/4')
        await b.clock.advance(0)
        assert.equal(b.rig.calls.length, before + (everybody ? 1 : 0), `${where}: signed out`)
        /* No link ever answers Siri. */
        assert.equal(b.expo.replies.length, 0)
      } finally {
        done(b)
      }
    }
  })

  test('links: the same handler and the same Play rule as Siri, never tuner on, and Tuner off from any screen', async () => {
    const b = await siriOnTheBench()
    try {
      const on = b.play({ step: (by) => (b.rig.__answered(12 + by, true), Promise.resolve(true)) })
      b.rn.Linking.open('fractalremote://next')
      b.rn.Linking.open('fractalremote://previous')
      b.rn.Linking.open('fractalremote://scene/2')
      await b.clock.advance(0)
      assert.deepEqual(on.steps, [[1, b.clock.now()], [-1, b.clock.now()]], 'a link’s Next is not Play’s own, counted from when it arrived')
      assert.deepEqual(b.rig.calls, [['scene', 1, b.clock.now()]])
      /* Any web page can open a link: none of them mutes the rig. */
      b.rn.Linking.open('fractalremote://tuner/on')
      await b.clock.advance(0)
      assert.equal(b.rig.calls.length, 1, 'a link turned the tuner on')
      /* Off Play: nothing sent, and nobody to tell. */
      on.off()
      b.siri.siriElsewhere(true)
      b.rn.Linking.open('fractalremote://scene/4')
      await b.clock.advance(2000)
      assert.equal(b.rig.calls.length, 1, 'a link’s scene went from another screen')
      b.rn.Linking.open('fractalremote://tuner/off')
      await b.clock.advance(0)
      assert.deepEqual(b.rig.calls.at(-1), ['tuner', false])
      assert.equal(b.expo.replies.length, 0, 'a link answered Siri')
      /* While the app is still starting: Play inside the tap rule, or nothing. */
      b.siri.siriElsewhere(false)
      b.rn.Linking.open('fractalremote://scene/5')
      await b.clock.advance(1500)
      b.play()
      await b.clock.advance(0)
      assert.equal(b.rig.calls.filter((c) => c[0] === 'scene').length, 1, 'a link’s scene went seconds after it arrived')
      assert.equal(b.rig.state.dropped, 'Not sent — it would have landed late', 'Play does not say the link was not sent')
    } finally {
      done(b)
    }
  })

  test('links: the one that started the app is only ever Tuner off, which waits for the app to know who is signed in', async () => {
    const next = await siriOnTheBench({ launchUrl: 'fractalremote://next' })
    try {
      const on = next.play()
      next.siri.allowSiriLinks(JUSTIN)
      await next.clock.advance(3000)
      assert.equal(on.steps.length, 0, 'the link that started the app stepped the setlist on, seconds after it was tapped, or again after a reload')
    } finally {
      done(next)
    }
    const off = await siriOnTheBench({ siri: false, launchUrl: 'fractalremote://tuner/off' })
    try {
      await off.clock.advance(2000)
      assert.equal(off.rig.calls.length, 0, 'sent before the app knew whose account it is')
      off.siri.allowSiriLinks(JUSTIN)
      await off.clock.advance(0)
      assert.deepEqual(off.rig.calls, [['tuner', false]])
    } finally {
      done(off)
    }
    /* Never known: not sent. */
    const nobody = await siriOnTheBench({ siri: false, launchUrl: 'fractalremote://tuner/off' })
    try {
      await nobody.clock.advance(10000)
      assert.equal(nobody.rig.calls.length, 0)
    } finally {
      done(nobody)
    }
  })

  test('links: the app listens for them for its life, asks who is signed in by the session kept on the phone, and stops cleanly', async () => {
    const b = await siriOnTheBench()
    try {
      assert.equal(b.rn.Linking.listening(), 1)
      b.stop()
      b.stop = null
      assert.equal(b.rn.Linking.listening(), 0)
      assert.equal(b.expo.listening(), 0)
    } finally {
      done(b)
    }
    const app = flat('mobile/App.js')
    assert.match(app, /import \{ allowSiriLinks, siriElsewhere, startSiri \} from '\.\/src\/lib\/siri'/)
    assert.match(
      app,
      /useEffect\(\(\) => \{ if \(auth === 'checking'\) return undefined if \(auth === 'out'\) \{ allowSiriLinks\(null\) return undefined \} let alive = true haveSession\(\) \.then\(\(id\) => alive && allowSiriLinks\(id\)\) \.catch\(\(\) => \{\}\) return \(\) => \{ alive = false \} \}, \[auth, demo\]\)/,
      'the links are not told who is signed in at every change, by the session on the phone'
    )
    assert.ok(!/currentAccount\(\)[^;]*allowSiriLinks|allowSiriLinks\([^)]*currentAccount/.test(app), 'the links ask the account server, which answers nobody at a gig with no signal')
    const siri = withoutComments(read(`${LIB}/siri.js`))
    assert.match(siri, /Linking\.addEventListener\('url'/)
    assert.match(siri, /Linking\.getInitialURL\(\)/)
    assert.match(siri, /export const siriLinksOpen = \(\) => linksOpen\(\{ native: siriPresent\(\), platform: Platform\.OS, installed: builtIn\(\), admin: linksAdmin \}\)/)
    /* Nothing an update can switch: no flag in storage, no answer from a server. */
    assert.ok(!/AsyncStorage|fetch\(|remoteRequest|supabase/.test(siri))
  })

  test('Siri: on a build without the Siri piece nothing listens, nothing throws, and nothing is said', async () => {
    const b = await siriOnTheBench({ siri: false })
    try {
      assert.equal(b.expo.listening(), 0)
      b.play()
      b.stop()
      assert.equal(b.rig.calls.length, 0)
    } finally {
      done(b)
    }
  })
}
