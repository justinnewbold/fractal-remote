/**
 * NOT CONNECTED, AT ONCE; AND A TAP THAT CANNOT LAND ON TIME IS DROPPED.
 *
 * "When the link drops, Play says so right away. The tiles go dim under NOT
 * CONNECTED, and a scene tap that can't get through is dropped. Today a tap
 * can be held and land up to 8 seconds late, mid-verse." — what Justin
 * approved on 13 October 2026, for the phone, the watch and the browser.
 *
 * Everything here is RUN rather than read where it can be: each end's relay
 * (mobile/src/lib/relay.js and src/lib/remote.js) on a bench of its own,
 * beside a pretend relay server whose channel can drop, come back, and lose
 * its socket underneath a channel that still reads joined, and a computer
 * that answers when it is told to; and the phone's link loop (link.js), with
 * a pretend relay that answers or does not. Both on a clock the test turns by
 * hand, so "a second and a half later" costs nothing to run.
 *
 * What is under test is when a request reaches the wire, which is the one
 * thing the rule is about: never after its deadline, never queued while the
 * link is down, never dimming a working rig for one slow answer, and a
 * connected rig's taps going exactly as they always went.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* Every file under a directory of the repo, as repo paths. */
const walk = (dir) =>
  readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(`${dir}/${e.name}`)) : [`${dir}/${e.name}`]
  )

/* A clock turned by hand, as test/mobile.mjs's rig bench has it. */
const CLOCK = `
  let t = 1000000
  let seq = 0
  const timers = new Map()
  /* How early a timer of a given length goes off: real ones can, by a millisecond against Date.now(). */
  export const early = new Map()
  export const now = () => t
  export function setTimeout(fn, ms = 0, ...args) {
    const id = ++seq
    const wait = Math.max(0, Number(ms) || 0)
    timers.set(id, { id, at: t + Math.max(0, wait - (early.get(wait) || 0)), fn, args })
    return id
  }
  export function clearTimeout(id) { timers.delete(id) }
  const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => globalThis.setImmediate(r)) }
  export async function advance(ms) {
    const end = t + ms
    await flush()
    for (;;) {
      let next = null
      for (const x of timers.values()) if (x.at <= end && (!next || x.at < next.at || (x.at === next.at && x.id < next.id))) next = x
      if (!next) break
      timers.delete(next.id)
      t = next.at
      next.fn(...next.args)
      await flush()
    }
    t = end
    await flush()
  }
`

/* Time in a file is the bench's: Date.now and the timers, swapped. */
const clocked = (src) =>
  "import * as __clock from './clock.mjs'\n" +
  src
    .replace(/\bDate\.now\(\)/g, '__clock.now()')
    .replace(/\bsetTimeout\(/g, '__clock.setTimeout(')
    .replace(/\bclearTimeout\(/g, '__clock.clearTimeout(')

/*
 * The relay server and the computer behind it, as both relays see them
 * through supabase-js. `bench.drop()` is the channel erroring (realtime-js's
 * CHANNEL_ERROR), `bench.back()` its rejoin, `bench.socket` whether the
 * socket under it is open. Every send is written down with the time it was
 * made; the computer answers each request after `bench.lag`, unless
 * `bench.silent`, with `bench.reply(payload)` when it is given one.
 */
const SERVICE = `
  import * as clock from './clock.mjs'
  export const bench = { sent: [], socket: true, silent: false, lag: 40, reply: null, chan: null, handlers: {}, status: null }
  export function drop() {
    if (!bench.chan) return
    bench.chan.state = 'errored'
    bench.status?.('CHANNEL_ERROR', new Error('the bench dropped it'))
  }
  export function back() {
    if (!bench.chan) return
    bench.chan.state = 'joined'
    bench.status?.('SUBSCRIBED')
  }
  function answer(payload) {
    if (bench.silent) return
    const said = bench.reply ? bench.reply(payload) : null
    if (said === 'silent') return
    const res = said && typeof said === 'object' && 'status' in said ? said : { status: 200, body: JSON.stringify(said ?? { ok: true }) }
    clock.setTimeout(() => bench.handlers['broadcast:res']?.({ payload: { id: payload.id, encoding: 'utf8', ...res } }), bench.lag)
  }
  export const createClient = () => {
    const client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' }, access_token: 't' } } }) },
      realtime: { isConnected: () => bench.socket, disconnect: async () => {} },
      getChannels: () => [],
      removeChannel: async () => {},
      channel: () => {
        const chan = {
          state: 'closed',
          on(type, filter, fn) {
            bench.handlers[type + ':' + (filter?.event || '')] = fn
            return chan
          },
          subscribe(cb) {
            bench.status = cb
            chan.state = 'joined'
            cb('SUBSCRIBED')
            return chan
          },
          track: async () => 'ok',
          async send(msg, opts) {
            bench.sent.push({ at: clock.now(), msg, opts, args: arguments.length })
            if (!bench.silent) answer(msg.payload)
            return 'ok'
          }
        }
        bench.chan = chan
        return chan
      }
    }
    return client
  }
`

/** One end's relay on a bench: 'phone' is mobile/src/lib/relay.js, 'web' is src/lib/remote.js. */
async function relayOnABench(end) {
  const dir = mkdtempSync(join(tmpdir(), `link-now-${end}-`))
  const files = {
    'package.json': '{ "type": "module" }',
    'clock.mjs': CLOCK,
    'service.mjs': SERVICE,
    'nothing.mjs':
      'export const logDebug = () => {}\nexport const notForever = (...a) => fetch(...a)\nexport const decode = async (p) => p.body\n' +
      'export default { getItem: async () => null, setItem: async () => {} }\n',
    'retry.mjs': clocked(read('mobile/src/lib/retry.js')),
    /* On the bench's clock too: its deadlines are counted in the bench's time. */
    'relay-rules.mjs': clocked(read('shared/relay-rules.mjs')),
    'confirm-code.mjs': read('shared/confirm-code.mjs'),
    'device-word.mjs': read('shared/device-word.mjs'),
    'project.mjs': end === 'phone' ? read('mobile/src/lib/project.js') : read('desktop/lib/project.mjs')
  }
  const swaps =
    end === 'phone'
      ? [
          ["from '@react-native-async-storage/async-storage'", "from './nothing.mjs'"],
          ["from '@supabase/supabase-js'", "from './service.mjs'"],
          ["from './debugLog'", "from './nothing.mjs'"],
          ["from './project'", "from './project.mjs'"],
          ["from './decode'", "from './nothing.mjs'"],
          ["from './retry'", "from './retry.mjs'"],
          ["from './notForever'", "from './nothing.mjs'"],
          ["from './relay-rules'", "from './relay-rules.mjs'"],
          ["from './confirm-code'", "from './confirm-code.mjs'"],
          ["from './device-word'", "from './device-word.mjs'"]
        ]
      : [
          ["from '../../desktop/lib/project.mjs'", "from './project.mjs'"],
          ["from '../../shared/relay-rules.mjs'", "from './relay-rules.mjs'"],
          ["from '../../shared/confirm-code.mjs'", "from './confirm-code.mjs'"],
          ["from '../../shared/device-word.mjs'", "from './device-word.mjs'"],
          ["import('@supabase/supabase-js')", "import('./service.mjs')"]
        ]
  let src = read(end === 'phone' ? 'mobile/src/lib/relay.js' : 'src/lib/remote.js')
  for (const [from, to] of swaps) {
    assert.ok(src.includes(from), `${end}: no longer has ${from}; the bench needs telling`)
    src = src.replaceAll(from, to)
  }
  files['under-test.mjs'] = clocked(src)
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    const relay = await import(at('under-test.mjs'))
    const service = await import(at('service.mjs'))
    const clock = await import(at('clock.mjs'))
    const rules = await import(at('relay-rules.mjs'))
    if (end === 'phone') await relay.restoreSession()
    else await relay.restoreSession({})
    await relay.remoteConnect()
    /* Answered once, so the computer is known to be there, as on a working rig. */
    const health = relay.hostResponds()
    await clock.advance(100)
    assert.equal(await health, true, `${end}: the bench computer did not answer /healthz`)
    service.bench.sent.length = 0
    /* Every send of a request, by what it asked: "POST /scene". */
    const asked = () => service.bench.sent.map((s) => `${s.msg.payload.method} ${s.msg.payload.path}`)
    /* A tap as each end makes one: a write with a deadline from now. */
    const tap = (path = '/scene', body = { index: 2 }) =>
      relay.remoteRequest(path, { method: 'POST', body: JSON.stringify(body), deadline: rules.tapDeadline(clock.now()) })
    /* A promise's outcome, without the test waiting on it. */
    const watch = (p) => {
      const out = { done: false, value: undefined, error: undefined }
      p.then(
        (v) => Object.assign(out, { done: true, value: v }),
        (e) => Object.assign(out, { done: true, error: e })
      )
      return out
    }
    return { relay, bench: service.bench, service, clock, rules, asked, tap, watch }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* -------------------------------------------------------------------- */
/* The phone's link loop on a bench                                      */
/* -------------------------------------------------------------------- */

/*
 * mobile/src/lib/link.js as it is, beside a pretend relay that says what the
 * real one says — the channel up or down, the computer answering or not —
 * and stand-ins for the rest. `bench.answer()` is how the next /healthz
 * goes: a promise of true or false, on the bench clock. `bench.canJoin` is
 * whether a join of the loop's own gets through.
 */
async function linkOnABench() {
  const dir = mkdtempSync(join(tmpdir(), 'link-now-loop-'))
  const files = {
    'package.json': '{ "type": "module" }',
    'clock.mjs': CLOCK,
    'bench.mjs': `
      import * as clock from './clock.mjs'
      export const bench = { channel: false, hostSeen: false, answeredAt: 0, asks: [], canJoin: true, demo: false,
        answer: () => new Promise((r) => clock.setTimeout(() => r(true), 300)),
        /* Every request the link sends and its time, and the order it went in beside the roll call and refreshAll. */
        requests: [], order: [], refuseMeters: false, holdMeters: false }
    `,
    /* The app going to sleep and coming back: `app.change(status)` in what the bench returns. */
    'react-native.mjs': `
      export const heard = []
      export const AppState = {
        currentState: 'active',
        addEventListener: (type, fn) => {
          heard.push(fn)
          return { remove() { heard.splice(heard.indexOf(fn) >>> 0, 1) } }
        }
      }
    `,
    'demo.mjs': "import { bench } from './bench.mjs'\nexport const isDemo = () => bench.demo\n",
    'debugLog.mjs': 'export const logDebug = () => {}\n',
    'bleSwitch.mjs': 'export const bluetoothOn = () => false\n',
    'bleLink.mjs': 'export const pokeBluetooth = () => {}\nexport const startBluetoothLink = () => {}\nexport const stopBluetoothLink = () => {}\n',
    'tapGate.mjs': read('mobile/src/lib/tapGate.js'),
    'relay-rules.mjs': clocked(read('shared/relay-rules.mjs')),
    'rig.mjs': "import { bench } from './bench.mjs'\nexport const listen = () => {}\nexport const refreshAll = async () => { bench.order.push('refreshAll') }\nexport const reset = () => {}\nexport const watchUnit = () => {}\nexport const stopWatching = () => {}\n",
    'phone-note.mjs': "export const PHONE_NOTE_PATH = '/store/config/phone'\nexport const phoneNote = () => ({})\nexport const timeToTell = () => false\n",
    /* The relay as link.js hears it: the same order of news as relay.js gives it. */
    'relay.mjs': `
      import * as clock from './clock.mjs'
      import { bench } from './bench.mjs'
      const seers = new Set()
      const watchers = new Set()
      export const subscribeHostSeen = (fn) => (seers.add(fn), () => seers.delete(fn))
      export const subscribeRemoteState = (fn) => (watchers.add(fn), () => watchers.delete(fn))
      export const remoteActive = () => bench.channel
      export const remoteHostSeen = () => bench.hostSeen
      export const lastAnswerAt = () => bench.answeredAt
      export function seen(v) {
        if (v) bench.answeredAt = clock.now()
        if (v === bench.hostSeen) return
        bench.hostSeen = v
        for (const fn of [...seers]) fn(v)
      }
      export function channelUp(v) {
        if (v === bench.channel) return
        bench.channel = v
        if (!v) seen(false)
        for (const fn of [...watchers]) fn(v)
      }
      export async function hostResponds() {
        bench.asks.push(clock.now())
        if (!bench.channel) { seen(false); return false }
        const ok = await bench.answer()
        seen(ok)
        return bench.hostSeen
      }
      export async function remoteConnect() {
        if (!bench.canJoin) throw new Error('the bench will not join')
        channelUp(true)
        return 'u1'
      }
      export const remoteDisconnect = async () => channelUp(false)
      export const censusHosts = async () => { bench.order.push('census'); return [] }
      export const hostConflict = () => null
      export const remoteChosenHost = () => null
      export const remoteHosts = () => []
      export const remoteUnits = () => ({})
      export const pickHost = async () => false
      export const restoreSession = async () => 'u1'
      /* A computer older than 7 September refuses the level-readings route (refuseMeters); one that never answers holds it (holdMeters). */
      export async function remoteRequest(path, options = {}) {
        bench.requests.push({ at: clock.now(), path, method: options.method || 'GET', body: options.body ?? null })
        bench.order.push(path)
        if (path === '/telemetry/meters' && bench.holdMeters) return new Promise(() => {})
        if (path === '/telemetry/meters' && bench.refuseMeters) throw Object.assign(new Error('not allowed remotely'), { status: 403, remoteBlocked: true })
        return { data: { name: 'Studio', version: '1.87.4' } }
      }
    `
  }
  const swaps = [
    ["from 'react-native'", "from './react-native.mjs'"],
    ["from './demo'", "from './demo.mjs'"],
    ["from './debugLog'", "from './debugLog.mjs'"],
    ["from './bleSwitch'", "from './bleSwitch.mjs'"],
    ["from './bleLink'", "from './bleLink.mjs'"],
    ["from './tapGate'", "from './tapGate.mjs'"],
    ["from './relay-rules'", "from './relay-rules.mjs'"],
    ["from './relay'", "from './relay.mjs'"],
    ["from './rig'", "from './rig.mjs'"],
    ["from './phone-note'", "from './phone-note.mjs'"]
  ]
  let src = read('mobile/src/lib/link.js')
  for (const [from, to] of swaps) {
    assert.ok(src.includes(from), `link.js no longer imports ${from}; the bench needs telling`)
    src = src.replace(from, to)
  }
  const left = [...src.matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1]).filter((m) => !m.endsWith('.mjs'))
  assert.deepEqual(left, [], 'link.js imports something the bench has no stand-in for')
  files['link.mjs'] = clocked(src)
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    const link = await import(at('link.mjs'))
    const relay = await import(at('relay.mjs'))
    const gate = await import(at('tapGate.mjs'))
    const clock = await import(at('clock.mjs'))
    const { bench } = await import(at('bench.mjs'))
    const rn = await import(at('react-native.mjs'))
    /* Every state the screens are told, with whether the gate was down at that moment. */
    const told = []
    link.subscribeLink((s) => told.push({ at: clock.now(), link: s.link, down: s.down, gate: gate.linkIsDown() }))
    const app = {
      change(status) {
        rn.AppState.currentState = status
        for (const fn of [...rn.heard]) fn(status)
      }
    }
    return { link, relay, gate, clock, bench, told, app }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Started, joined and answering, with the record cleared: what follows is the test's. */
async function connectedLoop() {
  const t = await linkOnABench()
  t.link.startLink()
  await t.clock.advance(1000)
  assert.equal(t.link.linkState().link, 'connected', 'the bench loop did not connect')
  t.told.length = 0
  return t
}

/* -------------------------------------------------------------------- */
/* The browser's link on a bench                                          */
/* -------------------------------------------------------------------- */

/*
 * src/lib/link.js as it is, beside a pretend remote.js and forgefx.js that
 * say what the real ones say, on the hand-turned clock: the browser's twin of
 * linkOnABench. `bench.role` picks the end — 'remote' (a phone on the web
 * app), 'mac' (the computer's own window, the helper answering), 'wifi' (a
 * phone on the computer's wifi page) — and `bench.demo` the demo, which takes
 * the computer's role. `bench.joinMs` is how long a join of the loop's own
 * takes to get through or fail.
 */
async function webLinkOnABench({ role = 'remote', demo = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'link-now-web-'))
  /* Already a file URL. Through .pathname and back, Windows read "/D:/a/…" as
     a path on the current drive and looked for D:\D:\a\… */
  const shared = (f) => new URL(`../shared/${f}`, import.meta.url).href
  const files = {
    'package.json': '{ "type": "module" }',
    'clock.mjs': CLOCK,
    'bench.mjs': `
      import * as clock from './clock.mjs'
      export const bench = { channel: false, hostSeen: false, answeredAt: 0, asks: [], canJoin: true, joinMs: 0,
        demo: ${demo}, served: ${role === 'wifi'}, helper: ${role === 'mac'},
        answer: () => new Promise((r) => clock.setTimeout(() => r(true), 300)),
        /* What the website said about the level readings, and when; refuseMeters is a computer too old for the route. */
        meters: [], refuseMeters: false }
    `,
    'tapGate.mjs': read('src/lib/tapGate.js'),
    'relay-rules.mjs': clocked(read('shared/relay-rules.mjs')),
    'forgefx.mjs': `
      import * as clock from './clock.mjs'
      import { bench } from './bench.mjs'
      export async function setMetersWanted(on) {
        bench.meters.push({ at: clock.now(), on })
        if (bench.refuseMeters) throw Object.assign(new Error('not allowed remotely'), { status: 403, remoteBlocked: true })
        return { ok: true, meters: !!on }
      }
      export const isDemo = () => bench.demo
      export const servedLocally = () => bench.served
      export const localHelperAlive = async () => bench.helper
      export const canReachHelper = async () => false
      export const readHostDoc = async () => null
      export const writeHostDoc = async () => {}
      export const cloudStatus = async () => ({ enabled: false, user: null })
      export const remoteStatus = async () => ({ enabled: false, connected: false })
      export const remoteEnable = async () => ({})
    `,
    /* The relay as link.js hears it, in the order remote.js gives its news. */
    'remote.mjs': `
      import * as clock from './clock.mjs'
      import { bench } from './bench.mjs'
      const seers = new Set()
      const watchers = new Set()
      export const subscribeHostSeen = (fn) => (seers.add(fn), () => seers.delete(fn))
      export const subscribeRemoteState = (fn) => (watchers.add(fn), () => watchers.delete(fn))
      export const subscribeHosts = () => () => {}
      export const remoteActive = () => bench.channel
      export const remoteHostSeen = () => bench.hostSeen
      export const lastAnswerAt = () => bench.answeredAt
      export function seen(v) {
        if (v) bench.answeredAt = clock.now()
        if (v === bench.hostSeen) return
        bench.hostSeen = v
        for (const fn of [...seers]) fn(v)
      }
      export function channelUp(v) {
        if (v === bench.channel) return
        bench.channel = v
        if (!v) seen(false)
        for (const fn of [...watchers]) fn(v)
      }
      export async function hostResponds() {
        bench.asks.push(clock.now())
        if (!bench.channel) { seen(false); return false }
        const ok = await bench.answer()
        seen(ok)
        return bench.hostSeen
      }
      export async function remoteConnect() {
        if (bench.joinMs) await new Promise((r) => clock.setTimeout(r, bench.joinMs))
        if (!bench.canJoin) throw new Error('the bench will not join')
        channelUp(true)
        return 'u1'
      }
      export const remoteDisconnect = async () => channelUp(false)
      export const restoreSession = async () => 'u1'
      export const currentAccount = async () => ({ id: 'u1', email: 'player@example.com' })
      export const loadRemoteConfig = () => ({})
      export const saveRemoteConfig = () => {}
      export const setAutoConnect = () => {}
      export const wantsAutoConnect = () => true
      export const hasSavedSession = () => true
      export const remoteSignIn = async () => {}
      export const remoteSignUp = async () => {}
      export const signOut = async () => {}
      export const censusHosts = async () => []
      export const hostConflict = () => null
      export const remoteHosts = () => []
      export const remoteUnits = () => ({})
      export const remoteChosenHost = () => null
      export const pickHost = async () => false
    `
  }
  const swaps = [
    ["from './remote.js'", "from './remote.mjs'"],
    ["from './tapGate.js'", "from './tapGate.mjs'"],
    ["from '../../shared/relay-rules.mjs'", "from './relay-rules.mjs'"],
    ["from '../../shared/pairing.mjs'", `from '${shared('pairing.mjs')}'`],
    ["from '../../shared/phone-note.mjs'", `from '${shared('phone-note.mjs')}'`],
    ["from '../../shared/editors.mjs'", `from '${shared('editors.mjs')}'`],
    ["from '../../shared/onboarding.mjs'", `from '${shared('onboarding.mjs')}'`],
    ["from '../../shared/device-word.mjs'", `from '${shared('device-word.mjs')}'`],
    ["import('./forgefx.js')", "import('./forgefx.mjs')"]
  ]
  let src = read('src/lib/link.js')
  for (const [from, to] of swaps) {
    assert.ok(src.includes(from), `src/lib/link.js no longer has ${from}; the bench needs telling`)
    src = src.replaceAll(from, to)
  }
  const left = [...src.matchAll(/^(?:import|export)[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1]).filter((m) => !m.endsWith('.mjs'))
  assert.deepEqual(left, [], 'src/lib/link.js imports something the bench has no stand-in for')
  files['link.mjs'] = clocked(src)
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    /*
     * The stand-in link.js asks for with import() (its `device()`), loaded
     * BEFORE link.js is, so booting waits on no real file. bootLink's first
     * step is that import, and a first import reads the disk: on a slow
     * moment it outlasted the clock's flush below, booting went on after
     * advance() had returned, set a bench timer nothing would ever turn, and
     * `await booting` never settled — the whole suite stopped there with no
     * tally and the server tests never run. It did on Node 20, two runs in
     * four, and never on 22. Loaded here, link.js's import finds it already
     * in memory.
     */
    await import(at('forgefx.mjs'))
    const link = await import(at('link.mjs'))
    const remote = await import(at('remote.mjs'))
    const gate = await import(at('tapGate.mjs'))
    const clock = await import(at('clock.mjs'))
    const { bench } = await import(at('bench.mjs'))
    const told = []
    link.subscribeLink((s) => told.push({ at: clock.now(), role: s.role, link: s.link, down: s.down, gate: gate.linkIsDown() }))
    let booted = false
    const booting = link.bootLink().finally(() => {
      booted = true
    })
    await clock.advance(1000)
    /* And if boot ever waits on something off the bench clock again, this test fails and says so, rather than every test after it never running. */
    assert.ok(booted, 'the bench browser was still booting after a second of bench time: it is waiting on something the bench clock does not turn')
    await booting
    assert.equal(link.linkState().role, demo ? 'mac' : role, 'the bench browser took the wrong role')
    if (role === 'remote' && !demo) assert.equal(link.linkState().link, 'connected', 'the bench browser did not connect')
    told.length = 0
    return { link, remote, gate, clock, bench, told }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* -------------------------------------------------------------------- */
/* The browser's request and its Tap button, run                          */
/* -------------------------------------------------------------------- */

const repoUrl = (p) => new URL(`../${p}`, import.meta.url).href

/*
 * src/lib/forgefx.js as it is, with a pretend remote.js under it: `relay.answer`
 * is what the relay says to each request it is handed, `relay.handed` every
 * one it was. Everything else is the real module, the tap gate included, so
 * a test sets the gate the way link.js does.
 */
async function forgefxOnABench() {
  const dir = mkdtempSync(join(tmpdir(), 'link-now-ffx-'))
  const remote = `
    export const relay = { handed: [], answer: async () => ({ ok: true }) }
    export const remoteActive = () => true
    export async function remoteRequest(path, options = {}) {
      relay.handed.push({ path, ...options })
      return relay.answer(path, options)
    }
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
    const { relay } = await import(pathToFileURL(join(dir, 'remote.mjs')).href)
    return { ffx, relay }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/*
 * src/components/TapTempo.jsx, its JSX turned into calls by esbuild, rendered
 * once with stand-in hooks: enough to press the button the way a thumb does
 * and see what it sends and what goes on its face. `sent` is every setTempo,
 * `faces` every number put on the face, `dropped` every dropped tap said.
 */
async function tapTempoOnABench() {
  const { transformSync } = await import('esbuild')
  const dir = mkdtempSync(join(tmpdir(), 'link-now-tap-'))
  const files = {
    'package.json': '{ "type": "module" }',
    'clock.mjs': CLOCK,
    'react.mjs': `
      export const h = (type, props, ...children) => ({ type, props: props || {}, children })
      export const Frag = 'frag'
      export const faces = []
      export function useState(initial) {
        const value = typeof initial === 'function' ? initial() : initial
        return [value, (v) => faces.push(v)]
      }
      export const useRef = (current = null) => ({ current })
      export const useEffect = () => {}
    `,
    'forgefx.mjs': `
      export const sent = []
      /* Whether the unit is a VP4, which no computer app sets a tempo on (TapTempo's noTempo). */
      export const unit = { vp4: false }
      export const currentDeviceSlug = () => (unit.vp4 ? 'vp4' : 'fm3')
      export const refusedAlready = () => false
      export const vp4Here = () => unit.vp4
      export const setTempo = async (bpm, opts) => { sent.push([bpm, opts]); return { ok: true } }
    `,
    'deviceState.mjs': `
      export const useDevice = (pick) => pick({ bpm: 120 })
      export const refreshTempo = async () => {}
      export const getSnapshot = () => ({})
      export const chainNumberOf = () => 12
    `,
    'tapGate.mjs': read('src/lib/tapGate.js'),
    /* The typed-tempo box's press guard, as it is: it imports nothing. */
    'boxPress.mjs': read('src/lib/boxPress.js'),
    'rest.mjs': `
      export const tick = () => {}
      export const useLongPress = () => ({})
      export const useDismiss = () => {}
      export default function BpmBox() { return null }
    `
  }
  let src = transformSync(read('src/components/TapTempo.jsx'), { loader: 'jsx', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Frag', format: 'esm' }).code
  const swaps = [
    ["from 'react'", "from './react.mjs'"],
    ['from "react"', "from './react.mjs'"],
    ['from "../lib/forgefx"', "from './forgefx.mjs'"],
    ['from "../lib/deviceState"', "from './deviceState.mjs'"],
    ['from "../lib/remote"', `from '${repoUrl('shared/relay-rules.mjs')}'`],
    ['from "../lib/tapGate"', "from './tapGate.mjs'"],
    ['from "../lib/feedback"', "from './rest.mjs'"],
    ['from "../lib/longPress"', "from './rest.mjs'"],
    ['from "../lib/dismiss"', "from './rest.mjs'"],
    ['from "../lib/boxPress"', "from './boxPress.mjs'"],
    ['from "./BpmBox"', "from './rest.mjs'"],
    /* The metronome switch in the typed-tempo box: drawn only after a hold, which this bench never makes. */
    ['from "./MetronomeSwitch"', "from './rest.mjs'"],
    ['from "../../shared/unsupported.mjs"', `from '${repoUrl('shared/unsupported.mjs')}'`],
    ['from "../../shared/vp4-safety.mjs"', `from '${repoUrl('shared/vp4-safety.mjs')}'`],
    ['from "../../shared/tempo.mjs"', `from '${repoUrl('shared/tempo.mjs')}'`]
  ]
  for (const [from, to] of swaps) src = src.replaceAll(from, to)
  const left = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((m) => !m.endsWith('.mjs'))
  assert.deepEqual(left, [], 'TapTempo.jsx imports something the bench has no stand-in for')
  files['TapTempo.mjs'] = "import { h, Frag } from './react.mjs'\n" + clocked(src)
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    const { default: TapTempo } = await import(at('TapTempo.mjs'))
    const react = await import(at('react.mjs'))
    const { sent, unit } = await import(at('forgefx.mjs'))
    const gate = await import(at('tapGate.mjs'))
    const clock = await import(at('clock.mjs'))
    const dropped = []
    const errors = []
    const tree = TapTempo({ onError: (e) => errors.push(e), onChanged: () => {}, onDropped: (e) => dropped.push(e) })
    /* The one button, found the way a thumb finds it: the one with a press. */
    const find = (node) => {
      if (!node || typeof node !== 'object') return null
      if (node.props?.onClick && node.type === 'button') return node
      for (const c of node.children || []) {
        const hit = find(c)
        if (hit) return hit
      }
      return null
    }
    const button = find(tree)
    assert.ok(button, 'the bench could not find the Tap button')
    return { press: () => button.props.onClick(), sent, faces: react.faces, dropped, errors, gate, clock, unit }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  /* ------------------------------------------------------------------ */
  /* The rule itself                                                      */
  /* ------------------------------------------------------------------ */

  test('the deadline is a second and a half, the band two seconds, and the demo is never down', async () => {
    const r = await import('../shared/relay-rules.mjs')
    assert.equal(r.TAP_DEADLINE_MS, 1500, 'the tap deadline moved; say why in shared/relay-rules.mjs')
    assert.equal(r.LINK_DOWN_HOLD_MS, 2000, 'the hold before NOT CONNECTED moved; say why in shared/relay-rules.mjs')
    /* Longer than the deadline: the band never says NOT CONNECTED while a tap could still have made it. */
    assert.ok(r.LINK_DOWN_HOLD_MS > r.TAP_DEADLINE_MS)
    assert.equal(r.tapDeadline(1000), 2500)
    assert.equal(r.pastDeadline(2500, 2499), false)
    assert.equal(r.pastDeadline(2500, 2500), true)
    assert.equal(r.pastDeadline(undefined, 9e15), false, 'a request with no deadline was treated as late')
    const lost = 10000
    assert.equal(r.linkDownAt({ link: 'no-answer', lostAt: lost }, lost + 1999), false, 'one slow answer dims a working rig')
    assert.equal(r.linkDownAt({ link: 'no-answer', lostAt: lost }, lost + 2000), true)
    assert.equal(r.linkDownAt({ link: 'joining', lostAt: lost }, lost + 5000), true)
    assert.equal(r.linkDownAt({ link: 'connected', lostAt: lost }, lost + 5000), false)
    assert.equal(r.linkDownAt({ link: 'joining', lostAt: lost, demo: true }, lost + 60000), false, 'the demo was dimmed')
    assert.equal(r.linkDownAt({ link: 'joining', lostAt: 0 }, 1e12), false, 'a link that never left connected was dimmed')
    /* A dropped tap is not a link fault the relay would send again. */
    const e = r.notSentError()
    assert.equal(e.message, 'Not sent — not connected')
    assert.equal(e.notSent, true)
    assert.ok(!e.linkDown, 'a dropped tap is marked to be sent again')
    assert.ok(!e.aboutLink, 'a dropped tap is held on screen until the link is back')
    assert.equal(r.notSentError({ late: true }).message, 'Not sent — it would have landed late')
    assert.equal(r.NOT_CONNECTED, 'NOT CONNECTED')
    /* Nothing on the phone says "Mac" for the computer: these are the phone's words too. */
    for (const words of [r.NOT_CONNECTED, r.NOT_SENT, r.NOT_SENT_LATE]) assert.ok(!/\bMac\b/.test(words), words)
    /* The phone's fault rule keeps its own copy of how long a dropped tap is said (it imports nothing). */
    const fault = await import('../mobile/src/lib/fault-rule.js')
    assert.equal(fault.NOT_SENT_SHOWN_MS, r.NOT_SENT_SHOWN_MS, 'the phone and the browser say a dropped tap for different lengths of time')
    /* A dropped tap has a field of its own, and never touches the fault's: the card about the link stays where it is. */
    const brief = fault.faultFrom(r.notSentError())
    assert.deepEqual(brief, { dropped: 'Not sent — not connected', droppedLate: false })
    assert.ok(!('error' in brief) && !('errorLink' in brief), 'a dropped tap takes the place of the fault on screen')
    assert.equal(fault.droppedLeft({ ...brief, droppedAt: 1000 }, 1000), r.NOT_SENT_SHOWN_MS, 'a dropped tap is not said briefly')
    assert.equal(fault.droppedLeft({ ...brief, droppedAt: 1000 }, 1000 + r.NOT_SENT_SHOWN_MS), 0)
    assert.equal(fault.withdrawsDropped(brief, 'connected'), true, '"not connected" stays up under a link that is back')
    assert.equal(fault.withdrawsDropped(brief, 'joining'), false)
    /* Dropped with the link up ("it would have landed late"): the link reading connected does not make it untrue. */
    const late = fault.faultFrom(r.notSentError({ late: true }))
    assert.deepEqual(late, { dropped: 'Not sent — it would have landed late', droppedLate: true })
    assert.equal(fault.withdrawsDropped(late, 'connected'), false)
  })

  /* ------------------------------------------------------------------ */
  /* Each end's relay, run                                               */
  /* ------------------------------------------------------------------ */

  for (const end of ['phone', 'web']) {
    test(`${end}: a connected rig's tap goes at once, with the four fields the computer has always read`, async () => {
      const { bench, clock, tap, watch, relay } = await relayOnABench(end)
      const t0 = clock.now()
      const p = watch(tap('/scene', { index: 2 }))
      await clock.advance(0)
      assert.equal(bench.sent.length, 1, 'a tap on a connected rig did not go at once')
      assert.equal(bench.sent[0].at, t0, 'a tap on a connected rig was held')
      const { msg } = bench.sent[0]
      assert.equal(msg.type, 'broadcast')
      assert.equal(msg.event, 'req')
      /* Computer app 1.87.4 reads these four and nothing else: no deadline, no new field. */
      assert.deepEqual(Object.keys(msg.payload).sort(), ['body', 'id', 'method', 'path'])
      assert.deepEqual([msg.payload.method, msg.payload.path, msg.payload.body], ['POST', '/scene', JSON.stringify({ index: 2 })])
      /* Only the relay's own wait is told the deadline, should it ever post it the slow way. */
      assert.ok(bench.sent[0].opts?.timeout > 0 && bench.sent[0].opts.timeout <= 1500)
      await clock.advance(100)
      assert.equal(p.done, true)
      assert.deepEqual(p.value, { ok: true })
      /* And a read or an edit, with no deadline, is sent exactly as before: one argument, the same fields. */
      const r = watch(relay.remoteRequest('/preset/blocks/58/params/3', { method: 'PUT', body: '{"value":0.5}' }))
      await clock.advance(100)
      assert.equal(bench.sent[1].args, 1, 'a request with no deadline is sent differently than it was')
      assert.deepEqual(Object.keys(bench.sent[1].msg.payload).sort(), ['body', 'id', 'method', 'path'])
      assert.equal(r.done && !r.error, true)
    })

    test(`${end}: a tap made while the channel is down goes if it is back inside 1.5 s`, async () => {
      const { bench, clock, tap, watch, asked } = await relayOnABench(end)
      const t0 = clock.now()
      bench.socket = false
      bench.chan.state = 'errored'
      bench.status('CHANNEL_ERROR')
      const p = watch(tap())
      await clock.advance(1000)
      assert.deepEqual(asked(), [], 'a tap went into a channel that was down')
      bench.socket = true
      bench.chan.state = 'joined'
      bench.status('SUBSCRIBED')
      await clock.advance(300)
      assert.deepEqual(asked(), ['POST /scene'], 'a tap held through a sub-second blip was lost, or sent twice')
      assert.ok(bench.sent[0].at <= t0 + 1500, `the tap went at ${bench.sent[0].at - t0} ms`)
      await clock.advance(200)
      assert.equal(p.done && !p.error, true, p.error?.message)
    })

    test(`${end}: a tap made while the channel is down is never sent once its deadline has passed`, async () => {
      const { bench, clock, tap, watch, asked, rules } = await relayOnABench(end)
      bench.chan.state = 'errored'
      bench.status('CHANNEL_ERROR')
      const p = watch(tap())
      await clock.advance(1600)
      assert.equal(p.done, true, 'a tap that could not go was still waiting past its deadline')
      assert.equal(p.error?.notSent, true, `not said as a dropped tap: ${p.error?.message}`)
      assert.equal(p.error?.message, rules.NOT_SENT)
      /* The channel back afterwards: still nothing. "Never sent later." */
      bench.chan.state = 'joined'
      bench.status('SUBSCRIBED')
      await clock.advance(10000)
      assert.deepEqual(asked(), [], 'a dropped tap landed when the link came back')
    })

    test(`${end}: a channel back just as the deadline passes does not take the tap`, async () => {
      /*
       * The wait for a channel coming back polls, and a poll can land on the
       * deadline or past it — a timer is often late — and find
       * the channel joined. That is the moment a tap used to go late, and the
       * last look at the clock before the send is what stops it.
       */
      const { bench, clock, tap, watch, asked } = await relayOnABench(end)
      bench.chan.state = 'errored'
      bench.status('CHANNEL_ERROR')
      await clock.advance(60)
      const deadline = clock.now() + 1500
      const p = watch(tap())
      /* Polled every 150 ms from the tap: 1410 ms in, still down; back at 1450; the next poll is the deadline itself. */
      await clock.advance(1450)
      bench.chan.state = 'joined'
      bench.status('SUBSCRIBED')
      await clock.advance(5000)
      assert.ok(bench.sent.every((s) => s.at < deadline), `a tap went at its deadline or after it: ${bench.sent.map((s) => s.at - deadline).join(', ')} ms`)
      assert.deepEqual(asked(), [])
      assert.equal(p.error?.notSent, true)
    })

    test(`${end}: a tap that went and lost its answer is not sent again past its deadline, nor called "not sent"`, async () => {
      const { bench, clock, tap, watch, asked } = await relayOnABench(end)
      bench.silent = true
      const p = watch(tap())
      await clock.advance(1700)
      /* Taps only: the /healthz asked at the deadline (see the next tests) is not a tap. */
      const taps = () => asked().filter((a) => a === 'POST /scene')
      assert.deepEqual(taps(), ['POST /scene'])
      /* The channel drops with the answer still owed, and comes straight back. */
      bench.chan.state = 'errored'
      bench.status('CHANNEL_ERROR')
      await clock.advance(10)
      bench.silent = false
      bench.chan.state = 'joined'
      bench.status('SUBSCRIBED')
      await clock.advance(10000)
      assert.deepEqual(taps(), ['POST /scene'], 'a tap was sent a second time after its deadline')
      assert.equal(p.done, true)
      assert.ok(p.error, 'a tap whose answer was lost was reported as having worked')
      assert.ok(!p.error.notSent, 'a tap that may have landed is said as "not sent"')
      assert.equal(p.error.message, 'The connection dropped before your computer answered.')
    })

    test(`${end}: a tap still inside its deadline after a drop is sent again, as it always was`, async () => {
      const { bench, clock, tap, watch, asked } = await relayOnABench(end)
      const t0 = clock.now()
      bench.silent = true
      const p = watch(tap())
      await clock.advance(300)
      bench.chan.state = 'errored'
      bench.status('CHANNEL_ERROR')
      await clock.advance(500)
      bench.silent = false
      bench.chan.state = 'joined'
      bench.status('SUBSCRIBED')
      await clock.advance(400)
      assert.deepEqual(asked(), ['POST /scene', 'POST /scene'], 'the retry that saves a tap in a blip is gone')
      assert.ok(bench.sent[1].at < t0 + 1500, `the second attempt went at ${bench.sent[1].at - t0} ms`)
      await clock.advance(200)
      assert.equal(p.done && !p.error, true, p.error?.message)
    })

    /*
     * BUT NOT A VP4'S. Its preset is a Program Change, and a second one loads
     * the preset again: what the player had not saved goes, and the computer,
     * which cannot tell the second from the first, answers "couldn't
     * confirm" over a preset that landed (shared/relay-rules sendsOnce).
     */
    for (const [path, body] of [
      ['/preset/select', { number: 12, midiChannel: 1 }],
      ['/scene', { index: 2, sceneCc: 34, midiChannel: 1, sceneCcSet: 4242 }]
    ]) {
      test(`${end}: a VP4's ${path} that went and lost its answer inside its deadline goes on the wire once`, async () => {
        const { bench, clock, tap, watch, asked } = await relayOnABench(end)
        bench.silent = true
        const p = watch(tap(path, body))
        await clock.advance(300)
        bench.chan.state = 'errored'
        bench.status('CHANNEL_ERROR')
        await clock.advance(500)
        bench.silent = false
        bench.chan.state = 'joined'
        bench.status('SUBSCRIBED')
        await clock.advance(10000)
        assert.deepEqual(asked().filter((a) => a === `POST ${path}`), [`POST ${path}`], `a VP4's ${path} was sent again by itself`)
        assert.equal(p.done, true)
        assert.ok(p.error, 'a VP4 tap whose answer was lost was reported as having worked')
        assert.ok(!p.error.notSent, 'a VP4 tap that may have landed is said as "not sent"')
        assert.equal(p.error.message, 'The connection dropped before your computer answered.')
      })

      test(`${end}: a VP4's ${path} the relay refused before it left still goes, once, inside 1.5 s`, async () => {
        const { bench, clock, tap, watch, asked } = await relayOnABench(end)
        const t0 = clock.now()
        /* The first try never leaves: the relay will not take it. That is not a send, so the second try is its first. */
        const send = bench.chan.send
        let refused = 0
        bench.chan.send = async function (msg, opts) {
          if (msg?.payload?.path === path && refused++ === 0) return 'error'
          return send.call(this, msg, opts)
        }
        const p = watch(tap(path, body))
        await clock.advance(1400)
        assert.equal(refused >= 1, true, 'the bench never refused the first try')
        assert.deepEqual(asked(), [`POST ${path}`], `a VP4's ${path} that never left was lost, or went twice`)
        assert.ok(bench.sent[0].at < t0 + 1500, `it went at ${bench.sent[0].at - t0} ms`)
        assert.deepEqual(JSON.parse(bench.sent[0].msg.payload.body), body, 'the VP4 fields did not travel')
        await clock.advance(300)
        assert.equal(p.done && !p.error, true, p.error?.message)
      })

      /*
       * AND NEVER BY THE HTTPS ROAD, where an 'error' may be one that went.
       * realtime-js sends a broadcast over HTTPS when the channel cannot push
       * on its socket (RealtimeChannel.send asks `channelAdapter.canPush()`),
       * and answers 'error' for a fetch that failed after the relay server had
       * already taken it and passed it on. Read as refused, the second try
       * was a second Program Change. The bench's send does what realtime-js
       * does: off the socket, the message arrives and the answer is 'error'.
       */
      const httpsRoad = (bench, canPush) => {
        const send = bench.chan.send
        bench.chan.channelAdapter = { canPush }
        bench.chan.send = async function (msg, opts) {
          if (this.channelAdapter.canPush()) return send.call(this, msg, opts)
          await send.call(this, msg, opts)
          return 'error'
        }
      }

      test(`${end}: a VP4's ${path} whose socket closed just before it left goes once, on the socket, not by HTTPS`, async () => {
        const { bench, clock, tap, watch, asked } = await relayOnABench(end)
        const t0 = clock.now()
        /* The first look finds the socket gone; the next finds it back. */
        let looks = 0
        httpsRoad(bench, () => looks++ > 0)
        const p = watch(tap(path, body))
        await clock.advance(1400)
        assert.equal(looks >= 2, true, 'nothing asked whether the send would go on the socket')
        assert.deepEqual(asked().filter((a) => a === `POST ${path}`), [`POST ${path}`], `a VP4's ${path} went twice, or never`)
        assert.ok(bench.sent.find((s) => s.msg.payload.path === path).at < t0 + 1500, 'it went past its deadline')
        await clock.advance(300)
        assert.equal(p.done && !p.error, true, p.error?.message)
      })

      test(`${end}: a VP4's ${path} with no socket to go on is not sent, and is never posted by HTTPS`, async () => {
        const { bench, clock, tap, watch, asked } = await relayOnABench(end)
        httpsRoad(bench, () => false)
        const p = watch(tap(path, body))
        await clock.advance(5000)
        assert.deepEqual(asked().filter((a) => a === `POST ${path}`), [], `a VP4's ${path} was posted by HTTPS, where an 'error' may be one that went`)
        assert.equal(p.done, true)
        assert.equal(p.error?.notSent, true, `a VP4 tap that never left was not said as not sent: ${p.error?.message}`)
      })
    }

    test(`${end}: a tap held by the roll call past its deadline is dropped, and the roll call is not cut short`, async () => {
      const { bench, clock, relay, tap, watch, asked, rules } = await relayOnABench(end)
      const sleep = (ms) => new Promise((go) => clock.setTimeout(go, ms))
      const census = watch(relay.censusHosts({ windowMs: 3000, sleep }))
      await clock.advance(0)
      const p = watch(tap())
      await clock.advance(1600)
      assert.equal(p.error?.notSent, true, `a tap behind the roll call was not dropped at its deadline: ${p.error?.message}`)
      /* The link reads as up, so it is the late words, not "not connected". */
      assert.equal(p.error?.message, rules.NOT_SENT_LATE)
      await clock.advance(3000)
      assert.equal(census.done, true)
      assert.ok(!asked().includes('POST /scene'), 'a tap dropped behind the roll call was sent when the count was in')
      /* A roll call that is done inside the deadline still lets the tap through. */
      const quick = watch(relay.censusHosts({ windowMs: 800, sleep }))
      await clock.advance(0)
      const q = watch(tap())
      await clock.advance(1000)
      assert.equal(quick.done, true)
      assert.equal(asked().filter((a) => a === 'POST /scene').length, 1, 'a tap behind a short roll call never went')
      await clock.advance(200)
      assert.equal(q.done && !q.error, true, q.error?.message)
    })

    /*
     * AND NOT LET THROUGH MID-COUNT BY A TIMER THAT GOES OFF EARLY. The wait
     * for the roll call ends on a timer at the tap's deadline, and a real
     * timer can go off a millisecond before it by Date.now(). The clock alone
     * then read "a millisecond to spare", and the tap went out while the
     * computers were still being counted — addressed to nobody, which
     * computer app 1.87.4 carries out on every computer on the account.
     */
    test(`${end}: a tap the roll call is still holding is never sent, even when its timer goes off a millisecond early`, async () => {
      const { clock, relay, tap, watch, asked, rules } = await relayOnABench(end)
      const sleep = (ms) => new Promise((go) => clock.setTimeout(go, ms))
      const census = watch(relay.censusHosts({ windowMs: 3000, sleep }))
      await clock.advance(0)
      /* Every timer of a tap's whole deadline goes off a millisecond short, as Node's and the phone's can. */
      clock.early.set(rules.TAP_DEADLINE_MS, 1)
      const p = watch(tap())
      await clock.advance(rules.TAP_DEADLINE_MS + 100)
      clock.early.clear()
      assert.equal(census.done, false, 'the roll call was over before the deadline, so this does not test the wait')
      assert.ok(!asked().includes('POST /scene'), 'a tap went on the wire while the computers were still being counted, addressed to nobody')
      assert.equal(p.error?.notSent, true, `a tap held by a roll call still running was not dropped: ${p.error?.message}`)
      await clock.advance(4000)
      assert.equal(census.done, true)
      assert.ok(!asked().includes('POST /scene'), 'a tap dropped behind the roll call was sent when the count was in')
    })

    test(`${end}: a tap never takes the slow road when the socket under a joined channel has closed`, async () => {
      const { bench, clock, relay, tap, watch, asked } = await relayOnABench(end)
      bench.socket = false
      const p = watch(tap())
      await clock.advance(1000)
      assert.deepEqual(asked(), [], 'a tap was handed to a channel whose socket was closed — the HTTP road, ten seconds long')
      bench.socket = true
      await clock.advance(300)
      assert.deepEqual(asked(), ['POST /scene'], 'a tap whose socket came back inside its deadline did not go')
      await clock.advance(200)
      assert.equal(p.done && !p.error, true)
      /* Closed past the deadline: dropped, and nothing sent when it opens. */
      bench.sent.length = 0
      bench.socket = false
      const late = watch(tap())
      await clock.advance(1600)
      assert.equal(late.error?.notSent, true)
      bench.socket = true
      await clock.advance(5000)
      assert.deepEqual(asked(), [])
      /* A read in the same state goes as it always did: this is only for taps. */
      bench.socket = false
      const r = watch(relay.remoteRequest('/preset'))
      await clock.advance(0)
      assert.deepEqual(asked(), ['GET /preset'], 'a read now waits for the socket too')
      bench.socket = true
      await clock.advance(100)
      assert.equal(r.done && !r.error, true)
    })

    test(`${end}: a read keeps its grace — made while the channel is down, it waits and goes`, async () => {
      const { bench, clock, relay, watch, asked } = await relayOnABench(end)
      bench.chan.state = 'errored'
      bench.status('CHANNEL_ERROR')
      const r = watch(relay.remoteRequest('/preset'))
      await clock.advance(5000)
      assert.deepEqual(asked(), [])
      bench.chan.state = 'joined'
      bench.status('SUBSCRIBED')
      await clock.advance(300)
      assert.deepEqual(asked(), ['GET /preset'], 'a read lost the eight seconds it waits for the relay')
      await clock.advance(100)
      assert.equal(r.done && !r.error, true)
    })

    /*
     * THE NEWEST PRESS OF A CONTROL WINS (shared/relay-rules newestPresses).
     * Two scene taps inside one drop each waited for the channel on a poll of
     * their own, and went in whichever order those fell: the older after the
     * newer, both in time, and the unit on the scene pressed first under the
     * tile pressed last. Tried with the channel back at moments on both sides
     * of the newer tap's poll, so either one can be the first to look.
     */
    test(`${end}: two taps of one control during a drop never go out older after newer, and the newer goes`, async () => {
      for (const back of [920, 980, 1010, 1040]) {
        const { bench, clock, tap, watch } = await relayOnABench(end)
        bench.chan.state = 'errored'
        bench.status('CHANNEL_ERROR')
        const older = watch(tap('/scene', { index: 1 }))
        await clock.advance(100)
        const newer = watch(tap('/scene', { index: 2 }))
        await clock.advance(back - 100)
        bench.chan.state = 'joined'
        bench.status('SUBSCRIBED')
        await clock.advance(1000)
        const scenes = bench.sent.filter((s) => s.msg.payload.path === '/scene').map((s) => JSON.parse(s.msg.payload.body).index)
        assert.ok(!(scenes.indexOf(1) > scenes.indexOf(2)), `back ${back} ms in: the older tap went out after the newer (${scenes.join(', ')})`)
        assert.deepEqual(scenes, [2], `back ${back} ms in: the scenes went out as ${scenes.join(', ')}`)
        assert.equal(newer.done && !newer.error, true, `back ${back} ms in: ${newer.error?.message}`)
        /* The older is a dropped tap, marked so the screens leave the newer press's tile where it is. */
        assert.equal(older.error?.notSent, true, `back ${back} ms in: ${older.error?.message}`)
        assert.equal(older.error?.overtaken, true)
        assert.ok(!older.error?.linkDown, 'a tap a newer press took over is marked to be sent again')
      }
    })

    /*
     * AND ONE THE CLOCK DROPS WHILE THE NEWER WAITS IS THE NEWER'S TOO. With
     * the channel back after the older tap's deadline, the older was dropped
     * by the clock rather than at the wire, and said as plainly not sent: its
     * screen put back the tile the newer press had lit, under a unit on the
     * newer one. Never healed, the older is still the newer's, and the newer
     * is the one said.
     */
    test(`${end}: a tap dropped at its deadline while a newer press of its control waits is the newer one's`, async () => {
      for (const heals of [true, false]) {
        const { bench, clock, tap, watch } = await relayOnABench(end)
        bench.chan.state = 'errored'
        bench.status('CHANNEL_ERROR')
        const older = watch(tap('/scene', { index: 1 }))
        await clock.advance(700)
        const newer = watch(tap('/scene', { index: 2 }))
        /* Past the older's deadline (1500), inside the newer's (2200). */
        await clock.advance(820)
        if (heals) {
          bench.chan.state = 'joined'
          bench.status('SUBSCRIBED')
        }
        await clock.advance(2000)
        const scenes = bench.sent.map((s) => JSON.parse(s.msg.payload.body).index)
        assert.deepEqual(scenes, heals ? [2] : [], `healed ${heals}: the scenes went out as ${scenes.join(', ')}`)
        assert.equal(older.error?.notSent, true, older.error?.message)
        assert.equal(older.error?.overtaken, true, `healed ${heals}: a tap dropped at its deadline under a newer press is not marked as that press's`)
        if (heals) assert.equal(newer.done && !newer.error, true, newer.error?.message)
        else assert.ok(newer.error?.notSent && !newer.error?.overtaken, 'the newest press, dropped, is not said')
      }
    })

    /*
     * THE TUNER OPENED IN A DROP AND CLOSED A MOMENT LATER. The close has no
     * deadline, on purpose, so it was never written down as a press, and the
     * two went in whichever order their polls fell: the close, then the open,
     * inside its deadline — the unit muted on its tuner screen under a Play
     * that shows it closed. A write with no deadline is a press now, made as
     * it is handed over; it is never dropped itself.
     */
    test(`${end}: the tuner opened in a drop and closed a moment later is never opened after the close`, async () => {
      const { bench, clock, tap, watch, relay } = await relayOnABench(end)
      const close = () => relay.remoteRequest('/tuner', { method: 'POST', body: JSON.stringify({ on: false }) })
      const tuner = () => bench.sent.filter((s) => s.msg.payload.path === '/tuner').map((s) => JSON.parse(s.msg.payload.body).on)
      bench.chan.state = 'errored'
      bench.status('CHANNEL_ERROR')
      const open = watch(tap('/tuner', { on: true }))
      await clock.advance(350)
      const shut = watch(close())
      /* Back between the close's poll (650) and the open's (750): the close looks first. */
      await clock.advance(270)
      bench.chan.state = 'joined'
      bench.status('SUBSCRIBED')
      await clock.advance(2000)
      assert.deepEqual(tuner(), [false], 'the tuner was opened after the close went, leaving the unit muted')
      assert.equal(shut.done && !shut.error, true, shut.error?.message)
      assert.equal(open.error?.overtaken, true, 'the opening the close took over is not marked so, so Play would open the tuner again')
      /* The other way round, the close is still never dropped: both go. */
      bench.sent.length = 0
      bench.chan.state = 'errored'
      bench.status('CHANNEL_ERROR')
      const shut2 = watch(close())
      await clock.advance(350)
      const open2 = watch(tap('/tuner', { on: true }))
      await clock.advance(270)
      bench.chan.state = 'joined'
      bench.status('SUBSCRIBED')
      await clock.advance(2000)
      assert.deepEqual(tuner().sort(), [false, true], 'a close was dropped, or an opening after it')
      assert.equal(shut2.done && !shut2.error, true, shut2.error?.message)
      assert.equal(open2.done && !open2.error, true, open2.error?.message)
      /* And on a connected rig, open and close go as they always did. */
      bench.sent.length = 0
      const a = watch(tap('/tuner', { on: true }))
      await clock.advance(100)
      const b = watch(close())
      await clock.advance(100)
      assert.deepEqual(tuner(), [true, false])
      assert.equal(a.done && !a.error && b.done && !b.error, true)
    })

    test(`${end}: taps of different controls during a drop all go — a scene, two pedals, two looper buttons`, async () => {
      const { bench, clock, tap, watch } = await relayOnABench(end)
      bench.chan.state = 'errored'
      bench.status('CHANNEL_ERROR')
      const taps = [
        watch(tap('/scene', { index: 1 })),
        watch(tap('/preset/blocks/58/bypass', { bypassed: true })),
        watch(tap('/preset/blocks/133/bypass', { bypassed: false })),
        watch(tap('/preset/blocks/58/channel', { channel: 'B' })),
        watch(tap('/preset/looper/control', { eid: 74, action: 'record', on: true })),
        watch(tap('/preset/looper/control', { eid: 74, action: 'play', on: true }))
      ]
      await clock.advance(100)
      /* And a second press of the first one: only that one is held against its own older press. */
      const again = watch(tap('/scene', { index: 3 }))
      await clock.advance(850)
      bench.chan.state = 'joined'
      bench.status('SUBSCRIBED')
      await clock.advance(1000)
      const went = bench.sent.map((s) => `${s.msg.payload.path} ${s.msg.payload.body}`).sort()
      assert.deepEqual(
        went,
        [
          '/preset/blocks/133/bypass {"bypassed":false}',
          '/preset/blocks/58/bypass {"bypassed":true}',
          '/preset/blocks/58/channel {"channel":"B"}',
          '/preset/looper/control {"eid":74,"action":"play","on":true}',
          '/preset/looper/control {"eid":74,"action":"record","on":true}',
          '/scene {"index":3}'
        ],
        'a press of one control was dropped for a press of another'
      )
      assert.equal(again.done && !again.error, true, again.error?.message)
      for (const t of taps.slice(1)) assert.equal(t.done && !t.error, true, t.error?.message)
      assert.equal(taps[0].error?.overtaken, true)
    })

    test(`${end}: a connected rig's taps of one control go as they always did, each at once and in order`, async () => {
      const { bench, clock, tap, watch } = await relayOnABench(end)
      const t0 = clock.now()
      const a = watch(tap('/scene', { index: 1 }))
      await clock.advance(0)
      const b = watch(tap('/scene', { index: 2 }))
      await clock.advance(0)
      /* Two at the same instant, too: neither is newer. */
      const c = watch(tap('/scene', { index: 3 }))
      const d = watch(tap('/scene', { index: 4 }))
      await clock.advance(200)
      assert.deepEqual(bench.sent.map((s) => JSON.parse(s.msg.payload.body).index), [1, 2, 3, 4], 'a connected rig’s taps did not all go, in order')
      assert.ok(bench.sent.every((s) => s.at === t0), 'a connected rig’s tap was held')
      for (const p of [a, b, c, d]) assert.equal(p.done && !p.error, true, p.error?.message)
      /* Spaced the way a thumb does it, answered between: the same. */
      bench.sent.length = 0
      for (const index of [5, 6, 7]) {
        const p = watch(tap('/scene', { index }))
        await clock.advance(120)
        assert.equal(p.done && !p.error, true, p.error?.message)
      }
      assert.deepEqual(bench.sent.map((s) => JSON.parse(s.msg.payload.body).index), [5, 6, 7])
    })

    /*
     * A LOOPER BUTTON'S PRESS AND RELEASE STAY TOGETHER. The press carries
     * the deadline and the release none (Looper.js), sent once the press is
     * answered: a release is never held against its own press, and the next
     * press of the same button is never held against the release before it.
     */
    test(`${end}: a looper button's press and release go together through a drop, and the next press after them`, async () => {
      const { bench, clock, tap, watch, relay } = await relayOnABench(end)
      const button = (on) => ({ eid: 74, action: 'record', on })
      const release = () => relay.remoteRequest('/preset/looper/control', { method: 'POST', body: JSON.stringify(button(false)) })
      bench.chan.state = 'errored'
      bench.status('CHANNEL_ERROR')
      const press = watch(tap('/preset/looper/control', button(true)))
      await clock.advance(700)
      bench.chan.state = 'joined'
      bench.status('SUBSCRIBED')
      await clock.advance(300)
      assert.equal(press.done && !press.error, true, press.error?.message)
      const up = watch(release())
      await clock.advance(200)
      assert.equal(up.done && !up.error, true, up.error?.message)
      const next = watch(tap('/preset/looper/control', button(true)))
      await clock.advance(200)
      assert.equal(next.done && !next.error, true, next.error?.message)
      const up2 = watch(release())
      await clock.advance(200)
      assert.equal(up2.done && !up2.error, true, up2.error?.message)
      assert.deepEqual(bench.sent.map((s) => JSON.parse(s.msg.payload.body).on), [true, false, true, false], 'a looper press and its release were parted')
    })
  }

  /*
   * WHAT A TAP THAT NEVER LANDED PUTS BACK (shared/relay-rules
   * pressesInTheAir), the rule both ends keep: what the unit is on, which is
   * before the oldest press of the control it never took; only the newest
   * press of a control puts anything back; controls apart.
   */
  test('a press that never landed puts back what the unit is on, and only the newest of its control does', async () => {
    const { pressesInTheAir } = await import('../shared/relay-rules.mjs')
    const air = pressesInTheAir()
    /* Alone: what was there before it. */
    const one = air.press('scene', 0)
    assert.equal(air.failed(one).before, 0)
    /* Two in one drop, both lost: before the first, not the first's tile. */
    const a = air.press('scene', 0)
    const b = air.press('scene', 1)
    assert.equal(air.failed(a), null, 'an older press put something back under a newer one in the air')
    assert.equal(air.failed(b).before, 0, 'the newer press put back the older one’s tile, which the unit never took')
    /* The older landed, the newer lost: the older's. */
    const c = air.press('scene', 0)
    const d = air.press('scene', 1)
    air.landed(c)
    assert.equal(air.failed(d).before, 1)
    /* The newer landed: the older, failing after, puts nothing back. */
    const e = air.press('scene', 1)
    const f = air.press('scene', 2)
    air.landed(f)
    assert.equal(air.failed(e), null)
    /* Three, the middle one landed: back to it. */
    const g = air.press('scene', 2)
    const h = air.press('scene', 3)
    const i = air.press('scene', 4)
    air.landed(h)
    assert.equal(air.failed(g), null)
    assert.equal(air.failed(i).before, 4)
    /* Controls apart: one pedal's presses never stand behind another's. */
    const drive = air.press('bypassed 133', true)
    const amp = air.press('bypassed 58', false)
    air.landed(amp)
    assert.equal(air.failed(drive).before, true)
    /* And settled, a control starts again from what is on screen. */
    const j = air.press('scene', 5)
    assert.equal(air.failed(j).before, 5)
  })

  test('phone: a garbled answer to a scene is asked again only while the deadline allows', async () => {
    const garbled = { status: 500, body: JSON.stringify({ message: 'PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78' }) }
    {
      const { bench, clock, tap, watch, asked } = await relayOnABench('phone')
      let n = 0
      bench.reply = () => (n++ === 0 ? garbled : { ok: true })
      const p = watch(tap())
      await clock.advance(1000)
      assert.deepEqual(asked(), ['POST /scene', 'POST /scene'], 'a garbled answer inside the deadline was not asked again')
      await clock.advance(200)
      assert.equal(p.done && !p.error, true, p.error?.message)
    }
    {
      const { bench, clock, tap, watch, asked } = await relayOnABench('phone')
      bench.lag = 1200
      bench.reply = () => garbled
      const p = watch(tap())
      await clock.advance(5000)
      assert.deepEqual(asked(), ['POST /scene'], 'a garbled answer was asked again past the deadline')
      assert.match(p.error?.message || '', /PRESET_DUMP_HEADER/, 'the unit’s own answer is not what was said')
      assert.ok(!p.error?.notSent, 'a tap the unit answered is said as "not sent"')
      /* Marked as answered, so the rig reads where the unit is rather than putting the tile back (test/mobile.mjs). */
      assert.equal(p.error?.answeredGarbled, true, 'a garbled answer stopped at the deadline is taken for a no')
    }
  })

  test('phone: a garbled answer to a VP4’s preset or scene is never asked again: it went', async () => {
    const garbled = { status: 500, body: JSON.stringify({ message: 'PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78' }) }
    for (const [path, body] of [
      ['/preset/select', { number: 12, midiChannel: 1 }],
      ['/scene', { index: 2, sceneCc: 34, midiChannel: 1, sceneCcSet: 4242 }]
    ]) {
      const { bench, clock, tap, watch, asked } = await relayOnABench('phone')
      let n = 0
      bench.reply = () => (n++ === 0 ? garbled : { ok: true })
      const p = watch(tap(path, body))
      await clock.advance(3000)
      assert.deepEqual(asked(), [`POST ${path}`], `a VP4's ${path} was sent again for a garbled answer`)
      assert.match(p.error?.message || '', /PRESET_DUMP_HEADER/)
    }
  })

  test('a VP4’s preset and scene are told apart by what they carry, and nothing else is sent once', async () => {
    const r = await import('../shared/relay-rules.mjs')
    const retry = await import('../src/lib/retry.js')
    for (const [m, p, b] of [
      ['POST', '/preset/select', { number: 12, midiChannel: 1 }],
      ['post', '/scene/', JSON.stringify({ index: 2, sceneCc: 34, midiChannel: 3, sceneCcSet: 1 })],
      ['POST', '/scene?x=1', { index: 0, sceneCc: 21 }]
    ]) {
      assert.equal(r.sendsOnce(m, p, b), true, `${m} ${p} ${JSON.stringify(b)} may be sent twice`)
    }
    for (const [m, p, b] of [
      ['POST', '/preset/select', { number: 12 }],
      ['POST', '/scene', JSON.stringify({ index: 2 })],
      ['POST', '/scene', 'not json'],
      ['POST', '/scene', null],
      ['GET', '/scene', { midiChannel: 1 }],
      ['PUT', '/preset/blocks/58/params/3', { value: 0.5, midiChannel: 1 }]
    ]) {
      assert.equal(r.sendsOnce(m, p, b), false, `${m} ${p} ${JSON.stringify(b)} is held to once`)
    }
    /* And the garbled-answer retry obeys it, at either end (the phone's copy is generated from this one). */
    const garbled = () => Promise.reject(new Error('PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78'))
    let calls = 0
    await assert.rejects(retry.withRetry(() => (calls++, garbled()), { method: 'POST', path: '/preset/select', wait: async () => {}, once: true }))
    assert.equal(calls, 1, 'a once-only request was asked again for a garbled answer')
    calls = 0
    await assert.rejects(retry.withRetry(() => (calls++, garbled()), { method: 'POST', path: '/preset/select', wait: async () => {} }))
    assert.equal(calls, 3, 'an FM3’s preset is no longer asked again for a garbled answer')
    /* The browser asks with what the request carries. */
    assert.match(read('src/lib/forgefx.js'), /once: sendsOnce\(options\.method \|\| 'GET', path, options\.body\)/)
  })

  test('phone: a tap with no answer by its deadline has the computer asked whether it is there', async () => {
    /* Computer app 1.87.4 going deaf on a channel the server closed: the tap is lost, and the bar finds out now, not at the next keepalive. */
    const { bench, clock, tap, watch, asked } = await relayOnABench('phone')
    bench.reply = (payload) => (payload.path === '/scene' ? 'silent' : { ok: true })
    watch(tap())
    await clock.advance(1400)
    assert.deepEqual(asked(), ['POST /scene'])
    await clock.advance(200)
    assert.deepEqual(asked(), ['POST /scene', 'GET /healthz'], 'nothing asked after a tap went unanswered past its deadline')
    /* A tap that is answered in time asks nothing more. */
    bench.sent.length = 0
    bench.reply = null
    watch(tap())
    await clock.advance(3000)
    assert.deepEqual(asked(), ['POST /scene'], 'an answered tap cost an extra question')
  })

  /* ------------------------------------------------------------------ */
  /* The phone's link: down, and only when it is                        */
  /* ------------------------------------------------------------------ */

  test('one missed keepalive that recovers never dims the screen', async () => {
    const t = await connectedLoop()
    /* The keepalive that goes unanswered: six seconds of nothing, then the next one answers. */
    let first = true
    t.bench.answer = () =>
      new Promise((r) =>
        t.clock.setTimeout(() => {
          const ok = !first
          first = false
          r(ok)
        }, first ? 6000 : 300)
      )
    await t.clock.advance(40000)
    assert.ok(t.told.some((s) => s.link === 'no-answer'), 'the bench never missed a keepalive')
    assert.ok(!t.told.some((s) => s.down), 'one missed keepalive dimmed a working rig')
    assert.equal(t.gate.linkIsDown(), false)
    assert.equal(t.link.linkState().link, 'connected')
    /* Asked again at once, not sixteen seconds later. */
    const miss = t.told.find((s) => s.link === 'no-answer').at
    const back = t.told.find((s) => s.at > miss && s.link === 'connected').at
    assert.ok(back - miss < 2000, `the computer was asked again ${back - miss} ms after the miss`)
  })

  test('a slow read that times out is asked about at once, and a working rig is not dimmed', async () => {
    const t = await connectedLoop()
    await t.clock.advance(2000)
    /* A read the unit was too busy for: the relay calls the computer unseen. */
    t.relay.seen(false)
    await t.clock.advance(5000)
    assert.ok(t.told.some((s) => s.link === 'no-answer'))
    assert.ok(!t.told.some((s) => s.down), 'one slow answer dimmed a working rig')
    assert.equal(t.link.linkState().link, 'connected')
  })

  test('a channel that drops and heals by itself inside the hold never dims the screen', async () => {
    const t = await connectedLoop()
    t.bench.canJoin = false
    t.relay.channelUp(false)
    await t.clock.advance(1300)
    /* realtime-js's own rejoin; the computer then answers /healthz in 300 ms. */
    t.relay.channelUp(true)
    await t.clock.advance(2000)
    assert.equal(t.link.linkState().link, 'connected', 'the link did not come back when the channel did')
    assert.ok(!t.told.some((s) => s.down), 'a blip that healed itself in 1.6 s dimmed the screen')
  })

  test('a link down for two seconds says NOT CONNECTED and refuses taps, and goes live the moment it is back', async () => {
    const t = await connectedLoop()
    t.bench.canJoin = false
    const lost = t.clock.now()
    t.relay.channelUp(false)
    await t.clock.advance(1900)
    assert.equal(t.link.linkState().down, false, 'down before the hold was over')
    assert.equal(t.gate.linkIsDown(), false)
    await t.clock.advance(200)
    assert.equal(t.link.linkState().down, true, 'two seconds of no link and Play still looks live')
    assert.equal(t.gate.linkIsDown(), true, 'the screen says down and the taps are still queued')
    const downAt = t.told.find((s) => s.down).at
    assert.ok(downAt - lost >= 2000 && downAt - lost < 2100, `down ${downAt - lost} ms after the link went`)
    /* Back: the computer answers, and Play is live again at once. */
    t.bench.canJoin = true
    t.relay.channelUp(true)
    await t.clock.advance(400)
    assert.equal(t.link.linkState().link, 'connected')
    assert.equal(t.link.linkState().down, false)
    assert.equal(t.gate.linkIsDown(), false, 'the link is back and taps are still refused')
  })

  test('a hold timer that goes off a millisecond early still brings NOT CONNECTED up on time', async () => {
    /*
     * Real timers can fire a millisecond short of their time by Date.now().
     * The hold then reads 1999 ms, not down yet — and with nothing else due,
     * NOT CONNECTED used to wait for the loop's next turn, seconds later.
     */
    const t = await connectedLoop()
    t.clock.early.set(2000, 1)
    t.bench.canJoin = false
    /* A loop that stays quiet: nothing but the hold's own timer can bring the band up. */
    t.bench.answer = () => new Promise(() => {})
    const lost = t.clock.now()
    t.relay.channelUp(false)
    await t.clock.advance(2100)
    const first = t.told.find((s) => s.down)
    assert.ok(first, 'the hold went off a millisecond early and NOT CONNECTED never came up')
    assert.ok(first.at - lost >= 2000 && first.at - lost < 2100, `down ${first.at - lost} ms after the link went`)
    assert.equal(t.gate.linkIsDown(), true)
  })

  test('the demo is never NOT CONNECTED', async () => {
    const t = await linkOnABench()
    t.bench.demo = true
    t.link.startLink()
    await t.clock.advance(100)
    assert.equal(t.link.linkState().link, 'connected')
    /* Leaving and coming back through stopLink puts the link to 'off' for a moment. */
    await t.link.stopLink()
    await t.clock.advance(5000)
    assert.equal(t.link.linkState().down, false, 'the demo was dimmed')
    assert.equal(t.gate.linkIsDown(), false, 'the demo refuses taps')
  })

  /* ------------------------------------------------------------------ */
  /* Back on screen: the link has its two seconds again                  */
  /* ------------------------------------------------------------------ */

  /*
   * "connected → joining" twelve seconds after the last tap is the phone's
   * screen going off: Android cuts the connection when the app is put to
   * sleep. The outage clock started then, so Play used to come back on
   * screen already saying NOT CONNECTED, refusing the first tap at once
   * though the link was back a third of a second later.
   */
  test('phone: back on screen after the link was cut in the pocket, Play is not NOT CONNECTED and the first tap goes', async () => {
    const t = await connectedLoop()
    /* Put to sleep; Android cuts the connection a moment later, and it stays cut in the pocket. */
    t.app.change('background')
    await t.clock.advance(200)
    t.bench.canJoin = false
    t.relay.channelUp(false)
    await t.clock.advance(60000)
    assert.equal(t.link.linkState().down, true, 'the bench never went down while the phone slept, so this proves nothing')
    /* Out of the pocket: the link is back 300 ms later. */
    t.told.length = 0
    t.bench.canJoin = true
    t.app.change('active')
    const resumed = t.clock.now()
    assert.equal(t.gate.linkIsDown(), false, 'Play came back on screen refusing taps over a link that is coming back')
    assert.equal(t.link.linkState().down, false, 'Play came back on screen saying NOT CONNECTED')
    await t.clock.advance(3000)
    assert.ok(!t.told.some((s) => s.down || s.gate), 'NOT CONNECTED came up over a link that was back in a moment')
    const back = t.told.find((s) => s.link === 'connected')
    assert.ok(back && back.at - resumed <= 1000, 'the bench link did not come back on its own after the phone woke')
    /*
     * And the tap made the moment the screen came on: the gate let it through
     * (device.js refuses at once only on the gate), so it reaches the relay,
     * which waits for the channel inside its deadline and sends it once.
     */
    const device = read('mobile/src/lib/device.js')
    assert.match(device, /if \(options\?\.deadline && linkIsDown\(\)\) return Promise\.reject\(notSentError\(\)\)/, 'the phone refuses a tap at once on something other than the gate')
    const r = await relayOnABench('phone')
    const t0 = r.clock.now()
    r.bench.socket = false
    r.bench.chan.state = 'errored'
    r.bench.status('CHANNEL_ERROR')
    const p = r.watch(r.tap())
    await r.clock.advance(300)
    r.bench.socket = true
    r.bench.chan.state = 'joined'
    r.bench.status('SUBSCRIBED')
    await r.clock.advance(1500)
    assert.deepEqual(r.asked(), ['POST /scene'], 'the first tap after waking was lost, or sent twice')
    assert.ok(r.bench.sent[0].at - t0 <= 1500, `the first tap after waking went at ${r.bench.sent[0].at - t0} ms`)
    assert.equal(p.done && !p.error, true, p.error?.message)
  })

  test('phone: back on screen to a link that really is gone, NOT CONNECTED comes up two seconds after the screen did', async () => {
    const t = await connectedLoop()
    t.app.change('background')
    t.bench.canJoin = false
    t.relay.channelUp(false)
    await t.clock.advance(60000)
    t.told.length = 0
    const resumed = t.clock.now()
    t.app.change('active')
    assert.equal(t.gate.linkIsDown(), false)
    await t.clock.advance(1900)
    assert.equal(t.link.linkState().down, false, 'down before the screen had been on for two seconds')
    await t.clock.advance(300)
    const first = t.told.find((s) => s.down)
    assert.ok(first, 'a link that never came back after waking was never said')
    assert.ok(first.at - resumed >= 2000 && first.at - resumed < 2100, `NOT CONNECTED ${first.at - resumed} ms after the screen came on`)
    assert.equal(t.gate.linkIsDown(), true)
  })

  test('phone: NOT CONNECTED before the phone slept is still NOT CONNECTED when it wakes, with no gap', async () => {
    /* Taking the band down for two seconds only to put it back would be it flickering over a link that never came back. */
    const t = await connectedLoop()
    t.bench.canJoin = false
    t.relay.channelUp(false)
    await t.clock.advance(3000)
    assert.equal(t.link.linkState().down, true)
    /* iOS goes through 'inactive' on the way to 'background': one sleep, not two. */
    t.app.change('inactive')
    t.app.change('background')
    await t.clock.advance(60000)
    t.told.length = 0
    t.app.change('active')
    assert.equal(t.link.linkState().down, true, 'NOT CONNECTED went away on waking over a link that is still gone')
    assert.equal(t.gate.linkIsDown(), true)
    await t.clock.advance(2500)
    assert.ok(!t.told.some((s) => !s.down), 'NOT CONNECTED went away and came back after waking')
    /* And it goes the moment the link is back. */
    t.bench.canJoin = true
    t.link.probeNow()
    await t.clock.advance(1000)
    assert.equal(t.link.linkState().link, 'connected')
    assert.equal(t.gate.linkIsDown(), false)
  })

  test('phone: the loop starting after a sign-out long ago does not open with every tap refused', async () => {
    const t = await linkOnABench()
    /* Signed out: the link is 'off', and two seconds of that is down. */
    await t.link.stopLink()
    await t.clock.advance(60000)
    assert.equal(t.link.linkState().down, true, 'the bench was never down, so this proves nothing')
    t.told.length = 0
    t.link.startLink()
    assert.equal(t.gate.linkIsDown(), false, 'the loop starts refusing taps before its first join has had a chance')
    await t.clock.advance(1000)
    assert.equal(t.link.linkState().link, 'connected')
    assert.ok(!t.told.some((s) => s.down || s.gate), 'NOT CONNECTED over the first join')
  })

  /* ------------------------------------------------------------------ */
  /* The browser's link, run: down, and only when it is                  */
  /* ------------------------------------------------------------------ */

  test('browser: one missed keepalive that recovers never dims the screen', async () => {
    const t = await webLinkOnABench()
    /* The keepalive that goes unanswered: six seconds of nothing, then the next question answers. */
    let first = true
    t.bench.answer = () =>
      new Promise((r) =>
        t.clock.setTimeout(() => {
          const ok = !first
          first = false
          r(ok)
        }, first ? 6000 : 300)
      )
    await t.clock.advance(40000)
    assert.ok(t.told.some((s) => s.link === 'no-answer'), 'the bench never missed a keepalive')
    assert.ok(!t.told.some((s) => s.down), 'one missed keepalive dimmed a working rig')
    assert.equal(t.gate.linkIsDown(), false)
    assert.equal(t.link.linkState().link, 'connected')
    /* Asked again at once, not sixteen seconds later. */
    const miss = t.told.find((s) => s.link === 'no-answer').at
    const back = t.told.find((s) => s.at > miss && s.link === 'connected').at
    assert.ok(back - miss < 2000, `the computer was asked again ${back - miss} ms after the miss`)
  })

  test('browser: a channel that drops and heals by itself inside the hold never dims the screen', async () => {
    const t = await webLinkOnABench()
    t.bench.canJoin = false
    t.remote.channelUp(false)
    await t.clock.advance(1300)
    /* realtime-js's own rejoin; the computer then answers in 300 ms, asked at once. */
    t.remote.channelUp(true)
    await t.clock.advance(2000)
    assert.equal(t.link.linkState().link, 'connected', 'the link did not come back when the channel did')
    assert.ok(!t.told.some((s) => s.down), 'a blip that healed itself in 1.6 s dimmed the screen')
  })

  test('browser: a channel down for two seconds says NOT CONNECTED and refuses taps, and goes live the moment it is back', async () => {
    const t = await webLinkOnABench()
    t.bench.canJoin = false
    const lost = t.clock.now()
    t.remote.channelUp(false)
    await t.clock.advance(1900)
    assert.equal(t.link.linkState().down, false, 'down before the hold was over')
    assert.equal(t.gate.linkIsDown(), false)
    await t.clock.advance(200)
    assert.equal(t.link.linkState().down, true, 'two seconds of no link and Play still looks live')
    assert.equal(t.gate.linkIsDown(), true, 'the screen says down and the taps are still sent')
    const downAt = t.told.find((s) => s.down).at
    assert.ok(downAt - lost >= 2000 && downAt - lost < 2100, `down ${downAt - lost} ms after the link went`)
    t.bench.canJoin = true
    t.remote.channelUp(true)
    await t.clock.advance(400)
    assert.equal(t.link.linkState().link, 'connected')
    assert.equal(t.link.linkState().down, false)
    assert.equal(t.gate.linkIsDown(), false, 'the link is back and taps are still refused')
  })

  test('browser: joining, no answer and joining again are one outage, counted from when the link left connected', async () => {
    const t = await webLinkOnABench()
    /* Every join of the loop's own takes a second and a half to fail, so the word changes inside the hold, again and again. */
    t.bench.canJoin = false
    t.bench.joinMs = 1500
    const lost = t.clock.now()
    t.remote.channelUp(false)
    await t.clock.advance(12000)
    const words = new Set(t.told.map((s) => s.link))
    assert.ok(words.has('joining') && words.has('no-answer'), `the bench did not go through both words: ${[...words].join(', ')}`)
    const first = t.told.find((s) => s.down)
    assert.ok(first, 'twelve seconds of no link and Play never said so')
    assert.ok(first.at - lost < 2100, `NOT CONNECTED ${first.at - lost} ms after the link went: the hold restarted at a change of word`)
    assert.ok(!t.told.some((s) => s.at > first.at && !s.down), 'NOT CONNECTED went away while the link was still down, at a change of word')
    assert.equal(t.gate.linkIsDown(), true)
  })

  test('browser: a hold timer that goes off a millisecond early still brings NOT CONNECTED up on time', async () => {
    const t = await webLinkOnABench()
    t.clock.early.set(2000, 1)
    t.bench.canJoin = false
    /* Every join of the loop's own takes longer than the hold, so only the hold's timer can bring the band up in time. */
    t.bench.joinMs = 5000
    const lost = t.clock.now()
    t.remote.channelUp(false)
    await t.clock.advance(2100)
    const first = t.told.find((s) => s.down)
    assert.ok(first, 'the hold went off a millisecond early and NOT CONNECTED never came up')
    assert.ok(first.at - lost >= 2000 && first.at - lost < 2100, `down ${first.at - lost} ms after the link went`)
    assert.equal(t.gate.linkIsDown(), true)
  })

  test('browser: the computer’s own window, its wifi page and the demo are never NOT CONNECTED', async () => {
    for (const [options, why] of [
      [{ role: 'mac' }, 'the computer’s own window'],
      [{ role: 'wifi' }, 'a phone on the computer’s wifi page'],
      [{ demo: true }, 'the demo']
    ]) {
      const t = await webLinkOnABench(options)
      /* Whatever the relay does underneath, which none of these is reaching the rig through. */
      t.remote.channelUp(false)
      await t.clock.advance(10000)
      /* The wifi page is always connected: the device server is the page's own origin. The other two are off it here, which proves something. */
      if (options.role === 'wifi') assert.equal(t.link.linkState().link, 'connected')
      else assert.notEqual(t.link.linkState().link, 'connected', `${why}: the bench never left connected, so this proves nothing`)
      assert.equal(t.link.linkState().down, false, `${why} was dimmed`)
      assert.equal(t.gate.linkIsDown(), false, `${why} refuses taps`)
      assert.equal(t.gate.tapsRelayed(), false, `${why} sends its taps to the relay`)
    }
  })

  /*
   * A page that can be hidden and shown, as src/lib/link.js hears it. Node
   * has no document, so it is the global one only for the test that uses it,
   * and gone again when that test ends.
   */
  const withPage = async (fn) => {
    const heard = []
    const page = { hidden: false, addEventListener: (type, f) => type === 'visibilitychange' && heard.push(f) }
    globalThis.document = page
    try {
      await fn((shown) => {
        page.hidden = !shown
        for (const f of [...heard]) f()
      })
    } finally {
      delete globalThis.document
    }
  }

  test('browser: a tab seen again after its channel dropped while hidden is not NOT CONNECTED, and the first tap goes', async () => {
    await withPage(async (show) => {
      const t = await webLinkOnABench()
      show(false)
      t.bench.canJoin = false
      t.remote.channelUp(false)
      await t.clock.advance(60000)
      assert.equal(t.link.linkState().down, true, 'the bench never went down while hidden, so this proves nothing')
      t.told.length = 0
      t.bench.canJoin = true
      const shownAt = t.clock.now()
      show(true)
      assert.equal(t.gate.linkIsDown(), false, 'the page came back refusing taps over a link that is coming back')
      assert.equal(t.link.linkState().down, false, 'the page came back saying NOT CONNECTED')
      await t.clock.advance(3000)
      assert.ok(!t.told.some((s) => s.down || s.gate), 'NOT CONNECTED came up over a link that was back in a moment')
      const back = t.told.find((s) => s.link === 'connected')
      assert.ok(back && back.at - shownAt <= 1000, 'the bench link did not come back when the page was seen again')
    })
    /* The tap made the moment the page was seen: forgefx refuses at once only on the gate, and the relay sends it once. */
    const forgefx = read('src/lib/forgefx.js')
    assert.match(forgefx, /if \(!mock && options\.deadline && linkIsDown\(\)\) return Promise\.reject\(/, 'the browser refuses a tap at once on something other than the gate')
    const r = await relayOnABench('web')
    const t0 = r.clock.now()
    r.bench.socket = false
    r.bench.chan.state = 'errored'
    r.bench.status('CHANNEL_ERROR')
    const p = r.watch(r.tap())
    await r.clock.advance(300)
    r.bench.socket = true
    r.bench.chan.state = 'joined'
    r.bench.status('SUBSCRIBED')
    await r.clock.advance(1500)
    assert.deepEqual(r.asked(), ['POST /scene'], 'the first tap after the page came back was lost, or sent twice')
    assert.ok(r.bench.sent[0].at - t0 <= 1500)
    assert.equal(p.done && !p.error, true, p.error?.message)
  })

  test('browser: NOT CONNECTED before the tab was hidden is still NOT CONNECTED when it is seen again, with no gap', async () => {
    await withPage(async (show) => {
      const t = await webLinkOnABench()
      t.bench.canJoin = false
      t.remote.channelUp(false)
      await t.clock.advance(3000)
      assert.equal(t.link.linkState().down, true)
      show(false)
      await t.clock.advance(60000)
      t.told.length = 0
      show(true)
      assert.equal(t.link.linkState().down, true, 'NOT CONNECTED went away when the page came back over a link that is still gone')
      assert.equal(t.gate.linkIsDown(), true)
      await t.clock.advance(2500)
      assert.ok(!t.told.some((s) => !s.down), 'NOT CONNECTED went away and came back when the page was seen again')
    })
  })

  /* ------------------------------------------------------------------ */
  /* The browser's request and its Tap button, run                      */
  /* ------------------------------------------------------------------ */

  test('browser: a tap the relay drops reaches Play as a dropped tap, never as App’s notice', async () => {
    const { ffx, relay } = await forgefxOnABench()
    const rules = await import('../shared/relay-rules.mjs')
    const gate = await import('../src/lib/tapGate.js')
    try {
      /* Dropped at its deadline in the relay: the error Gig reads carries notSent, so its floating note says it, not App's notice above the tiles. */
      relay.answer = async () => Promise.reject(rules.notSentError())
      await assert.rejects(ffx.setScene(2, { deadline: Date.now() + 1500 }), (e) => e.notSent === true && e.late === false && e.message === rules.NOT_SENT)
      relay.answer = async () => Promise.reject(rules.notSentError({ late: true }))
      await assert.rejects(ffx.setScene(2, { deadline: Date.now() + 1500 }), (e) => e.notSent === true && e.late === true && e.message === rules.NOT_SENT_LATE)
      /* The deadline went beside the request, the body as it always was. */
      const [first] = relay.handed
      assert.equal(first.path, '/scene')
      assert.ok(Number.isFinite(first.deadline))
      assert.deepEqual(JSON.parse(first.body), { index: 2 })
      /* Any other failure is said as it was. */
      relay.answer = async () => Promise.reject(Object.assign(new Error('The unit refused it.'), { status: 409 }))
      await assert.rejects(ffx.setScene(2, { deadline: Date.now() + 1500 }), (e) => !e.notSent && e.message === 'The unit refused it.')
      /* While NOT CONNECTED: refused before the relay is asked, in the same words, with notSent. */
      relay.handed.length = 0
      gate.setLinkDown(true)
      await assert.rejects(ffx.setScene(2, { deadline: Date.now() + 1500 }), (e) => e.notSent === true && e.message === rules.NOT_SENT)
      await assert.rejects(ffx.setTempo(140, { deadline: Date.now() + 1500 }), (e) => e.notSent === true)
      assert.deepEqual(relay.handed, [], 'a tap went to the relay while NOT CONNECTED')
      /* A read, and a write with no deadline, still go. */
      relay.answer = async () => ({ index: 1 })
      await ffx.getScene()
      await ffx.setTuner(false)
      assert.deepEqual(relay.handed.map((r) => r.path), ['/scene', '/tuner'])
      gate.setLinkDown(false)
      /* Answered garbled with its deadline gone: marked, so the store reads the unit rather than putting the tile back. */
      relay.handed.length = 0
      relay.answer = async () => Promise.reject(Object.assign(new Error('PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78'), { status: 500 }))
      await assert.rejects(ffx.setScene(3, { deadline: Date.now() + 100 }), (e) => e.answeredGarbled === true && !e.notSent)
      assert.equal(relay.handed.length, 1, 'a garbled scene was asked again past its deadline')
    } finally {
      gate.setLinkDown(false)
    }
  })

  test('browser: the Tap button while NOT CONNECTED counts nothing, shows nothing and sends nothing', async () => {
    const t = await tapTempoOnABench()
    /* Three taps, half a second apart: 120 BPM, if any of them counted. */
    t.gate.setLinkDown(true)
    for (let i = 0; i < 3; i++) {
      await t.press()
      await t.clock.advance(500)
    }
    assert.equal(t.dropped.length, 3, 'a tap while NOT CONNECTED was not said as dropped')
    assert.ok(t.dropped.every((e) => e.notSent === true && e.message === 'Not sent — not connected'))
    assert.deepEqual(t.sent, [], 'a tempo was handed on while NOT CONNECTED')
    assert.ok(!t.faces.some((v) => Number.isFinite(v)), `the face showed a tempo that was never sent: ${t.faces.join(', ')}`)
    assert.deepEqual(t.errors, [], 'a dropped tap went to the notice that moves Play')
    /* The same taps with the link up: counted, on the face, and sent with a deadline — so the bench is not proving the gate by being broken. */
    t.gate.setLinkDown(false)
    await t.clock.advance(5000)
    for (let i = 0; i < 3; i++) {
      await t.press()
      await t.clock.advance(500)
    }
    assert.ok(t.faces.includes(120), `the face did not show the tapped tempo: ${t.faces.join(', ')}`)
    assert.equal(t.sent.length >= 1, true, 'taps with the link up sent nothing')
    assert.equal(t.sent.at(-1)[0], 120)
    assert.ok(Number.isFinite(t.sent.at(-1)[1]?.deadline), 'a tapped tempo went with no deadline')
  })

  /*
   * ON A VP4: no computer app sets one's tempo, and the generic sentence
   * named no unit, so Play's check for a VP4's refusals missed it and it went
   * under "Didn't work", pushing Play down. Its own words, from the first tap,
   * with nothing sent — and Gig's onError says those over the tiles.
   */
  test('browser: the Tap button on a VP4 sends nothing and says the VP4’s own words, which Play says over the tiles', async () => {
    const { VP4_NO_TEMPO, aboutVp4 } = await import('../shared/vp4-safety.mjs')
    const t = await tapTempoOnABench()
    t.unit.vp4 = true
    for (let i = 0; i < 3; i++) {
      await t.press()
      await t.clock.advance(500)
    }
    assert.deepEqual(t.sent, [], 'a tempo was sent to a VP4')
    assert.ok(!t.faces.some((v) => Number.isFinite(v)), `the face showed a tempo on a VP4: ${t.faces.join(', ')}`)
    assert.deepEqual(t.errors, [VP4_NO_TEMPO, VP4_NO_TEMPO, VP4_NO_TEMPO], 'a VP4’s Tap is not said in the VP4’s words')
    assert.equal(aboutVp4(t.errors[0]), true, 'Play would not know the Tap’s words for a VP4’s')
    /* And an FM3 on the same bench still sends: the guard is the VP4's alone. */
    t.unit.vp4 = false
    await t.clock.advance(5000)
    for (let i = 0; i < 3; i++) {
      await t.press()
      await t.clock.advance(500)
    }
    assert.ok(t.sent.length >= 1, 'an FM3’s Tap sent nothing')
    assert.match(read('src/components/Gig.jsx').replace(/\s+/g, ' '), /<TapTempo onError=\{onError\} onChanged=\{onChanged\} onDropped=\{sayNotSent\} \/>/, 'Play’s Tap no longer goes through the onError that floats a VP4’s words')
  })

  /* ------------------------------------------------------------------ */
  /* Nothing moves                                                        */
  /* ------------------------------------------------------------------ */

  test('NOT CONNECTED and the dimming move nothing on the phone’s Play screen', () => {
    const stage = read('mobile/src/screens/Stage.js')
    const flat = stage.replace(/\s+/g, ' ')
    const end = flat.indexOf('</ScrollView>')
    const band = flat.indexOf('{down || droppedNote ? ( <View pointerEvents="none"')
    assert.ok(band > end, 'NOT CONNECTED is in the scrolling content, where it pushes the tiles down')
    const view = flat.slice(band, flat.indexOf('</View> ) : null} </View> ) : null}', band))
    assert.match(view, /position: 'absolute'/, 'NOT CONNECTED takes room on the screen')
    assert.match(view, /\{NOT_CONNECTED\}/)
    assert.ok(!/<Toast/.test(view), 'NOT CONNECTED is a toast, and takes the fault’s place')
    /* A dropped tap is said under the word, in the same untouchable view: never in the card at the top. */
    assert.match(view, /\{droppedNote \? \( <View[^>]*>\s*<Text[^>]*>\{droppedNote\}<\/Text>/, 'a dropped tap is not said under NOT CONNECTED')
    /* Its own field in the store (lib/fault-rule faultFrom), so the card reads `error` as it always did and a dropped tap is never in it. */
    assert.match(flat, /const error = news && !\(lost && faultLink\) \? fault : null/, 'the card at the top is decided by something other than the fault')
    assert.match(flat, /const droppedNews = useStillNews\(dropped, droppedAt, droppedLeft\(\{ dropped, droppedAt \}, Date\.now\(\)\)\)/)
    assert.match(flat, /const droppedNote = droppedNews \? dropped : null/)
    assert.match(flat, /const ofDropped = \(s\) => s\.dropped/)
    /* So the advice after fifteen seconds is never put away by a refused tap, screen reader or not: it waits only for `error`, which a dropped tap never is. */
    assert.match(flat, /<Toast open=\{lost && !lostAway && !error\} onLayout=\{endOf\('advice'\)\}>/)
    /* And the guide's "What to try" never comes up for one: its words match the guide's "not connected". */
    assert.match(flat, /\{error && onOpenFix && fixFor\(error\) \? \(/)
    /*
     * Inside the scrolling content `down` only ever sets an opacity: never a
     * row, never `disabled`. The one exception is handed on, not drawn: the
     * tuner is a modal over the whole screen, and says it itself (the test
     * after this one).
     */
    const tunerTag = '<Tuner on={tunerOn} reading={tuning} onClose={() => writeTuner(false)} down={down} />'
    assert.ok(stage.includes(tunerTag), 'the open tuner is not told the link is down')
    const inside = stage
      .slice(stage.indexOf('<ScrollView'), stage.indexOf('</ScrollView>'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(tunerTag, '')
    assert.ok(!/\{\s*down\b|\bdown\s*\?|\bdown\s*&&/.test(inside), 'the scrolling content draws something of its own for the link being down')
    const dims = [...inside.matchAll(/\bdim(med)?\b[^\n]*/g)].map((m) => m[0])
    assert.ok(dims.length >= 6, 'the tiles and the foot are not dimmed')
    for (const line of dims) assert.match(line, /^(dim \?\? |dimmed\}|dimmed\b)/, `something other than opacity follows the link: ${line}`)
    assert.match(flat, /const dimmed = dim \? \{ opacity: dim \} : undefined/)
    assert.match(flat, /opacity: dim \?\? 1 \}/, 'the scenes do not dim')
    assert.match(flat, /opacity: dim \?\? \(chainNow\.late \? 0\.55 : chainNow\.outline \? 0\.72 : 1\)/, 'the pedals do not dim')
    /* Stop tuner always goes, so it is never dimmed while the tuner is open. */
    assert.match(flat, /style=\{tunerOn \? undefined : dimmed\}/)
    /* The props order the other Stage tests read. */
    assert.match(flat, /onAccount,[^}]*\bdown = false, lost = false, lostAway = false, onPutAway, onLookAgain \}\)/)
    /* App hands it the link's own word, never in the demo. */
    assert.match(read('mobile/App.js'), /down=\{link\.down === true && !demo\}/)
  })

  /*
   * THE TUNER IS A MODAL, AND NOTHING STAGE DRAWS GOES OVER IT. With the
   * tuner open when the link dropped, the word Stage floats was under it,
   * the top bar's DISCONNECTED under its glass, and the screen said "Play a
   * string" over a needle that had stopped — to somebody playing one. So the
   * tuner says NOT CONNECTED itself, in the line under the needle: the same
   * one line, so nothing in the pane moves, and Stop tuner below it as lit as
   * ever (a close always goes).
   */
  test('phone: with the tuner open, NOT CONNECTED is said inside it, in the line under the needle', () => {
    const tuner = read('mobile/src/components/Tuner.js')
    const flat = tuner.replace(/\s+/g, ' ')
    assert.match(flat, /export default function Tuner\(\{ reading, on, onClose, down = false \}\)/)
    assert.match(tuner, /^import \{ NOT_CONNECTED \} from '\.\.\/lib\/relay-rules'$/m)
    /* In the modal, in place of the one line, and only one line however it reads. */
    const bare = tuner.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ').replace(/\s+/g, ' ')
    const modal = bare.slice(bare.indexOf('<Modal visible={on}'), bare.indexOf('</Modal>'))
    const line = modal.match(/<Text numberOfLines=\{1\} accessibilityLiveRegion="polite" style=\{[^]*?\}\s*>\s*\{down \? NOT_CONNECTED : reading\?\.note \? `\$\{cents > 0 \? '\+' : ''\}\$\{cents\} cents` : 'Play a string'\}\s*<\/Text>/)
    assert.ok(line, 'the open tuner does not say NOT CONNECTED in its line under the needle')
    /* The same size either way: a style change, never a new row. */
    const sizes = [...line[0].matchAll(/fontSize: ([\w.]+)/g)].map((m) => m[1])
    assert.deepEqual(sizes, ['font.lead', 'font.lead'], 'NOT CONNECTED in the tuner is a different size from the line it replaces, so the pane moves')
    assert.ok(!/lineHeight|margin|padding/.test(line[0]), 'NOT CONNECTED in the tuner changes the space its line takes')
    assert.match(line[0], /color: color\.fault/)
    /* Nothing else in the pane follows the link: Stop tuner is drawn the same, and works. */
    assert.equal((modal.match(/\bdown\b/g) || []).length, 2, 'something else in the tuner changes with the link')
    assert.match(modal, /<Press label="Stop tuner" height=\{TAP\} tone="live" onPress=\{onClose\} style=\{\{ alignSelf: 'stretch' \}\} \/>/)
  })

  test('NOT CONNECTED and a dropped tap move nothing on the browser’s Play screen', () => {
    const gig = read('src/components/Gig.jsx')
    const flat = gig.replace(/\s+/g, ' ')
    assert.match(flat, /data-link-down=\{down \? 'yes' : undefined\}/)
    assert.match(flat, /\{down \|\| dropped \? createPortal\( <div className="gig-down-band" role="status" aria-live="polite" ref=\{bandRef\} \/\*[^*]*\*\/ style=\{bandAt === null \? undefined : \{ top: bandAt \}\} >/)
    /* On the page, not inside Play: .screen's will-change: transform makes it the box a fixed child is fixed to, and the band scrolled off with the screen. */
    assert.match(flat, /<\/div>, document\.body \) : null\}/, 'the band is drawn inside the Play screen, where "fixed" is fixed to the screen and not the window')
    assert.match(gig, /^import \{ createPortal, flushSync \} from 'react-dom'$/m)
    const css = read('src/styles.css').replace(/\/\*[\s\S]*?\*\//g, ' ')
    const rule = (sel) => css.match(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] || ''
    const bandCss = rule('.gig-down-band')
    assert.match(bandCss, /position: fixed;/, 'the band takes room in the page')
    assert.match(bandCss, /pointer-events: none;/, 'the band swallows a tap meant for the tile beneath')
    /* The dimming is opacity and its transition, nothing that moves a box. */
    const dimRule = css.match(/\.gig\[data-link-down='yes'\] \.gig-scenes,[^{]*\{([^}]*)\}/)?.[1] || ''
    const props = [...dimRule.matchAll(/([a-z-]+):/g)].map((m) => m[1]).sort()
    assert.deepEqual(props, ['opacity', 'transition'], `the dimming does more than dim: ${props.join(', ')}`)
    /* A dropped tap is said over the tiles, never through App's notice above them, which moves the page. */
    for (const handler of ['await writeScene(index)', 'await writeBypass(eid, wanted)', 'await loadPreset(next)', 'const res = await writeTuner(next)']) {
      const at = gig.indexOf(handler)
      assert.ok(at > 0, `Gig.jsx no longer has ${handler}`)
      const after = gig.slice(at, at + 900)
      assert.match(after, /if \(err\?\.notSent\) \{?\s*sayNotSent\(err\)/, `a dropped tap after ${handler} goes to the notice that moves Play`)
    }
    assert.match(flat, /<TapTempo onError=\{onError\} onChanged=\{onChanged\} onDropped=\{sayNotSent\} \/>/)
    assert.match(flat, /onDropped=\{sayNotSent\}/)
    /* Only the remote role, never the computer's own window or its wifi page, never the demo. */
    const app = read('src/App.jsx')
    assert.match(app, /const linkShowsDown = link\.down === true && !isDemo\(\)/)
    assert.match(app, /down=\{linkShowsDown\}/)
    const link = read('src/lib/link.js').replace(/\s+/g, ' ')
    assert.match(link, /if \(next\.role !== 'remote' \|\| next\.link === 'connected'\) \{ lostAt = 0/, 'the computer’s own window can be dimmed')
  })

  /* ------------------------------------------------------------------ */
  /* What the map put at risk                                            */
  /* ------------------------------------------------------------------ */

  test('the browser’s link says down only for a phone on the web app, after the hold', async () => {
    /* deriveLink and the role are pure; the down flag rides set(), which is reached through the exported helpers. */
    const link = await import('../src/lib/link.js')
    assert.equal(typeof link.linkState().down, 'boolean')
    /* Off until link.js says otherwise, so the computer's own window and its wifi page send as they always did. */
    const gate = read('src/lib/tapGate.js')
    assert.match(gate, /^let down = false$/m)
    assert.match(gate, /^let relayed = false$/m)
    const links = read('src/lib/link.js').replace(/\s+/g, ' ')
    assert.match(links, /if \(next\.role !== was\.role\) \{ setTapsRelayed\(next\.role === 'remote'\)/)
    /* The computer's own window and its wifi page never relay a tap with a channel down. */
    const ffx = read('src/lib/forgefx.js')
    assert.match(ffx, /if \(remoteActive\(\) \|\| \(options\.deadline && tapsRelayed\(\)\)\) \{/)
    assert.match(ffx, /if \(!mock && options\.deadline && linkIsDown\(\)\) return Promise\.reject\(new ForgeError\(NOT_SENT_WORDS, \{ cause: notSentError\(\) \}\)\)/)
    assert.match(ffx, /const \{ deadline, went, \.\.\.options \} = given/, 'a deadline is handed to fetch')
  })

  test('browser: while NOT CONNECTED a tap is refused before anything goes on screen, and closing the tuner still goes', async () => {
    const ds = await import('../src/lib/deviceState.js')
    const gate = await import('../src/lib/tapGate.js')
    const calls = []
    const record = (name) => async (...args) => (calls.push([name, ...args]), { ok: true })
    ds.reset()
    ds.attachDriver({ setScene: record('setScene'), setTempo: record('setTempo'), setBypass: record('setBypass'), setTuner: record('setTuner'), selectPreset: record('selectPreset') })
    ds.set({ sceneIndex: 1, tunerOn: true, blocks: [{ effectId: 58, bypassed: false }] })
    try {
      gate.setLinkDown(true)
      await assert.rejects(ds.writeScene(4), (e) => e.notSent === true && e.message === 'Not sent — not connected')
      assert.equal(ds.getSnapshot().sceneIndex, 1, 'a refused scene lit its tile')
      await assert.rejects(ds.writeTempo(150), (e) => e.notSent === true)
      await assert.rejects(ds.loadPreset(20), (e) => e.notSent === true)
      await assert.rejects(ds.writeTuner(true), (e) => e.notSent === true)
      assert.deepEqual(calls, [], 'a tap reached the device while the link was down')
      /* Closing the tuner is never refused: the unit would stay muted on it. */
      await ds.writeTuner(false)
      assert.deepEqual(calls, [['setTuner', false, undefined]])
      gate.setLinkDown(false)
      /* Up again: a tap goes, with its deadline beside it. */
      await ds.writeBypass(58, true)
      assert.equal(calls[1][0], 'setBypass')
      assert.ok(Number.isFinite(calls[1][3]?.deadline), 'a pedal tap went with no deadline')
    } finally {
      gate.setLinkDown(false)
      ds.reset()
    }
  })

  /*
   * A TAP A NEWER PRESS TOOK OVER IN THE RELAY (shared/relay-rules
   * newestPresses) is the newer press's business: its tile is not put back
   * over that one's, which would be the scene before both, and Play says
   * nothing for it. Any other dropped tap still goes back and is said.
   */
  test('browser: a tap a newer press took over leaves the newer one’s tile up, and Play says nothing for it', async () => {
    const ds = await import('../src/lib/deviceState.js')
    const rules = await import('../shared/relay-rules.mjs')
    const held = []
    const hold = (what) => (...args) => new Promise((go, no) => held.push({ what, args, go, no }))
    ds.reset()
    ds.attachDriver({
      setScene: hold('scene'),
      setBypass: hold('bypass'),
      setTuner: hold('tuner'),
      setTempo: hold('tempo'),
      sceneState: async () => [{ effectId: 58, bypassed: true, channel: 'A' }]
    })
    ds.set({ sceneIndex: 1, bpm: 120, tunerOn: false, blocks: [{ effectId: 58, bypassed: false }] })
    const overtaken = () => rules.notSentError({ late: true, overtaken: true })
    try {
      const older = ds.writeScene(2).catch((e) => e)
      const newer = ds.writeScene(3)
      held[0].no(overtaken())
      assert.equal((await older).overtaken, true)
      assert.equal(ds.getSnapshot().sceneIndex, 3, 'a scene a newer press took over put its tile back over the newer one')
      held[1].go({ ok: true })
      await newer
      assert.equal(ds.getSnapshot().sceneIndex, 3)
      /* A pedal pressed on and off: the off is what is on screen. */
      const on = ds.writeBypass(58, true).catch((e) => e)
      const off = ds.writeBypass(58, false)
      held[2].no(overtaken())
      await on
      held[3].go({ ok: true })
      await off
      assert.equal(ds.getSnapshot().blocks[0].bypassed, false, 'a pedal tap a newer one took over put its tile back')
      /* A tempo and the tuner opening, the same. */
      const slow = ds.writeTempo(130).catch((e) => e)
      const fast = ds.writeTempo(140)
      held[4].no(overtaken())
      await slow
      held[5].go({ ok: true })
      await fast
      assert.equal(ds.getSnapshot().bpm, 140)
      const open = ds.writeTuner(true).catch((e) => e)
      const again = ds.writeTuner(true)
      held[6].no(overtaken())
      await open
      assert.equal(ds.getSnapshot().tunerOn, true, 'an opening a newer one took over closed the tuner the newer one opened')
      held[7].go({ ok: true })
      await again
      /* Any other dropped tap still puts its tile back. */
      const late = ds.writeScene(5).catch((e) => e)
      held[8].no(rules.notSentError({ late: true }))
      assert.equal((await late).notSent, true)
      assert.equal(ds.getSnapshot().sceneIndex, 3, 'a dropped tap no longer puts its tile back')
    } finally {
      ds.reset()
    }
    /* The flag survives the browser's request, and Play's note leaves it out. */
    const { ffx, relay } = await forgefxOnABench()
    relay.answer = async () => Promise.reject(overtaken())
    await assert.rejects(ffx.setScene(2, { deadline: Date.now() + 1500 }), (e) => e.notSent === true && e.overtaken === true)
    const gig = read('src/components/Gig.jsx').replace(/\s+/g, ' ')
    assert.match(gig, /const sayNotSent = \(err\) => \{ if \(!err\?\.overtaken\) setDropped\(\{ words: err\?\.message \|\| NOT_SENT, at: Date\.now\(\) \}\) \}/, 'Play says a tap a newer press took over')
    assert.match(read('src/components/TapTempo.jsx'), /\(err\) => \{\n\s*\/\*[^*]*\*\/\n\s*if \(err\?\.overtaken\) return\n\s*if \(!err\?\.notSent\)/, 'the Tap button’s face goes back over a newer tempo')
  })

  /*
   * AND A TAP THAT NEVER LANDED PUTS BACK WHAT THE UNIT IS ON
   * (shared/relay-rules pressesInTheAir): two scenes in one drop both
   * dropped go back to the scene before both, not to the first's tile; a
   * pedal dropped puts back that pedal alone, not the row as it was over a
   * pedal that landed since. Each held the way the relay hands them back
   * (the tests above): the older taken over, the newer dropped or landing.
   */
  test('browser: taps that never landed leave every tile on what the unit is on, however many were pressed in one drop', async () => {
    const ds = await import('../src/lib/deviceState.js')
    const rules = await import('../shared/relay-rules.mjs')
    const held = []
    const hold = () => new Promise((go, no) => held.push({ go, no }))
    ds.reset()
    const real = { sceneIndex: 1, bpm: 120, 1: false, 2: false }
    ds.attachDriver({ setScene: hold, setBypass: hold, setTempo: hold, sceneState: async () => [1, 2].map((effectId) => ({ effectId, bypassed: real[effectId] })) })
    ds.set({ sceneIndex: 1, bpm: 120, blocks: [{ effectId: 1, bypassed: false }, { effectId: 2, bypassed: false }] })
    const overtaken = () => rules.notSentError({ late: true, overtaken: true })
    const pedal = (id) => ds.getSnapshot().blocks.find((b) => b.effectId === id).bypassed
    try {
      /* Two scenes, both dropped. */
      const s1 = ds.writeScene(2).catch((e) => e)
      const s2 = ds.writeScene(3).catch((e) => e)
      held[0].no(overtaken())
      held[1].no(rules.notSentError())
      assert.equal((await s1).overtaken, true)
      assert.equal((await s2).notSent, true)
      assert.equal(ds.getSnapshot().sceneIndex, real.sceneIndex, 'two scenes dropped in one drop, and the tile is on one the unit never took')
      /* The older landed, the newer dropped: back to the older. */
      const s3 = ds.writeScene(4)
      const s4 = ds.writeScene(5).catch((e) => e)
      held[2].go({ ok: true })
      real.sceneIndex = 4
      await s3
      held[3].no(rules.notSentError())
      await s4
      assert.equal(ds.getSnapshot().sceneIndex, real.sceneIndex, 'a dropped scene put back the one before a scene that landed')
      /* Two tempos, both dropped: the same. */
      const t1 = ds.writeTempo(130).catch((e) => e)
      const t2 = ds.writeTempo(140).catch((e) => e)
      held[4].no(overtaken())
      held[5].no(rules.notSentError())
      await t1
      await t2
      assert.equal(ds.getSnapshot().bpm, real.bpm)
      /* One pedal on and off again, both dropped. */
      const on = ds.writeBypass(1, true).catch((e) => e)
      const off = ds.writeBypass(1, false).catch((e) => e)
      held[6].no(overtaken())
      held[7].no(rules.notSentError())
      await on
      await off
      assert.equal(pedal(1), real[1])
      /* Two pedals: the first dropped, the second landing; then the second landing first. */
      const p1 = ds.writeBypass(1, true).catch((e) => e)
      const p2 = ds.writeBypass(2, true)
      held[8].no(rules.notSentError())
      await p1
      held[9].go({ ok: true })
      real[2] = true
      await p2
      assert.deepEqual([pedal(1), pedal(2)], [real[1], real[2]], 'a dropped pedal put back the whole row as it was, over a pedal that landed since')
      const p3 = ds.writeBypass(1, true).catch((e) => e)
      const p4 = ds.writeBypass(2, false)
      held[11].go({ ok: true })
      real[2] = false
      await p4
      held[10].no(rules.notSentError())
      await p3
      assert.deepEqual([pedal(1), pedal(2)], [real[1], real[2]])
    } finally {
      ds.reset()
    }
  })

  test('closing the tuner, letting go of a looper button and saving carry no deadline', () => {
    const rig = read('mobile/src/lib/rig.js').replace(/\s+/g, ' ')
    assert.match(rig, /if \(on && refusedNow\('tuner on'\)\) return false/, 'closing the tuner can be refused')
    assert.match(rig, /device\.setTuner\(on, on \? \{ deadline: tapDeadline\(at\) \} : undefined\)/, 'closing the tuner can be dropped, leaving the unit muted')
    const ds = read('src/lib/deviceState.js').replace(/\s+/g, ' ')
    assert.match(ds, /if \(on\) tapRefused\(\)/)
    assert.match(ds, /driver\.setTuner\(on, on \? \{ deadline: tapDeadline\(at\) \} : undefined\)/)
    for (const file of ['mobile/src/components/Looper.js', 'src/components/Looper.jsx']) {
      assert.match(read(file), /looperControl\(eid, action, sends\[i\], i === 0 \? \{ deadline \} : undefined\)/, `${file}: a looper release can be dropped, leaving the button held`)
    }
    /* Settings' "Stop the looper" is untouched: every write that means stop, with no deadline. */
    for (const file of ['mobile/src/components/Looper.js', 'src/components/Looper.jsx']) {
      assert.match(read(file), /await looperControl\(eid, action, on\)\n/, `${file}: Stop the looper carries a deadline`)
    }
    /* Saves are not taps: the save request to the computer and its document reads have no deadline. */
    const device = read('mobile/src/lib/device.js')
    const save = device.slice(device.indexOf('export function parkSave('), device.indexOf('export async function saveInDemo('))
    assert.ok(save.length > 0 && !/deadline/.test(save), 'a save to a slot can be dropped part-way')
    assert.match(device, /const put = \(path, body\) => remoteRequest\(path, \{ method: 'PUT', body: JSON\.stringify\(body\) \}\)/, 'a PUT carries a deadline')
  })

  test('a watch tap that woke the phone waits only for its deadline, and is not tried again', () => {
    const bridge = read('mobile/src/lib/watchBridge.js')
    const flat = bridge.replace(/\s+/g, ' ')
    assert.match(flat, /const receivedAt = Date\.now\(\)/)
    assert.match(flat, /const deadline = tapDeadline\(receivedAt\) probeNow\(\) untilConnected\(Math\.max\(0, deadline - Date\.now\(\)\)\) \.then\(\(up\) => \{ if \(!up \|\| Date\.now\(\) >= deadline\) \{/, 'a woken watch tap waits past its deadline')
    /* The second try after a pause is only for the tuner closing. */
    const tapPath = flat.slice(flat.indexOf('const deadline = tapDeadline(receivedAt)'))
    assert.ok(!/pause\(1500\)/.test(tapPath.slice(0, tapPath.indexOf('return () =>'))), 'a woken watch tap is tried a second time, later still')
    assert.match(flat, /if \(cmd\.do === 'tuner' && !cmd\.on\) \{ probeNow\(\) pause\(400\)/, 'the tuner closing from a woken phone can be dropped')
    /* And the watch shows its own "not connected" page while Play says NOT CONNECTED — but never while it is tuning, see the next test. */
    assert.match(read('mobile/src/screens/Stage.js'), /linked: Number\.isInteger\(preset\?\.number\) && \(!down \|\| tunerOn\),/)
  })

  test('the watch keeps its pages while it is tuning, so NOT CONNECTED never turns the tuner off behind the player', () => {
    /*
     * Why: the watch takes all its pages away when the picture says it is not
     * linked, the Tuner page with them, and that page turns the tuner off as it
     * goes. The close is never dropped, so it landed when the link came back,
     * mid-tuning. The watch only changes by a build; the phone's picture is
     * what keeps the page up. If either Swift line below changes, so may this.
     */
    const root = read('mobile/targets/watch/FractalWatchApp.swift').replace(/\s+/g, ' ')
    assert.match(root, /if let state = link\.state, state\.linked, !state\.tooNew, !link\.away \{ TabView/)
    const pages = read('mobile/targets/watch/Pages.swift').replace(/\s+/g, ' ')
    assert.match(pages, /\.onDisappear \{ if state\.tuner\.on \{ link\.send\(\.tuner\(on: false\)\) \} \}/)
    const stage = read('mobile/src/screens/Stage.js')
    assert.match(stage, /linked: Number\.isInteger\(preset\?\.number\) && \(!down \|\| tunerOn\),/, 'NOT CONNECTED takes the watch’s Tuner page away while it is tuning')
    /* And a tap on the pages it keeps is still refused at once while the link is down: the rig asks before anything goes. */
    const bridge = read('mobile/src/lib/watchBridge.js')
    assert.match(bridge, /if \(cmd\.do === 'scene'\) return writeScene\(cmd\.index, receivedAt\)/)
    assert.match(read('mobile/src/lib/rig.js'), /export function writeScene\(index, at = Date\.now\(\)\) \{\n  if \(refusedNow\(/)
    /* A tuner-off the watch sends as its page goes, with the phone's tuner already off, does nothing. */
    assert.match(bridge, /if \(cmd\.do === 'tuner' && getState\(\)\.tunerOn !== cmd\.on\) return writeTuner\(cmd\.on, receivedAt\)/)
  })

  test('a song’s scene and tempo go only after its preset landed', () => {
    assert.match(read('mobile/src/screens/Stage.js').replace(/\s+/g, ' '), /\.then\(\(landed\) => landed === true && mine === stepsRef\.current && !songLate\(song, awayAtNext\) \? applySong\(song, \{ scene: writeScene, tempo: writeTempo \}\) : null \)/)
    /* The browser's step awaits a select that throws when it does not land, so the song is never applied after one. */
    assert.match(read('src/components/Gig.jsx').replace(/\s+/g, ' '), /await loadPreset\(next\) onPresetLoaded\?\.\(\)/)
  })

  /*
   * TWO QUICK NEXTS SET UP ONLY THE SONG LANDED ON. rig.loadPreset used to
   * answer true for a select that landed even after a newer press took the
   * load over (it hands the reads on to that one), so the skipped song's
   * scene and tempo went onto the unit loading the next. It answers false
   * for one taken over now (the test after this one); Stage's own count is
   * the second guard, run here: its `step` out of Stage.js, beside stand-ins
   * for what it calls, and a rig that answers every select true.
   */
  test('phone: two quick steps in a setlist set up only the newest song, and one step still sets up its own', async () => {
    const stage = read('mobile/src/screens/Stage.js')
    const from = stage.indexOf('const step = async (by, at = Date.now()) => {')
    const end = stage.indexOf('\n  }\n', from)
    assert.ok(from > 0 && end > from, 'Stage.step is not where this test reads it')
    const arrow = stage.slice(stage.indexOf('async', from), end + 4)
    assert.match(stage, /^ {2}const stepsRef = useRef\(0\)$/m, 'the count of presses is not kept for the life of the screen')
    const loads = []
    const applied = []
    const env = {
      landing: (n) => n,
      nope: () => {},
      thud: () => {},
      awayNow: () => 0,
      loadPreset: (n) => new Promise((landed) => loads.push({ n, landed })),
      order: [11, 12, 13],
      source: 'set',
      lists: [],
      songFor: (source, lists, n) => ({ scene: n - 10, bpm: 100 + n }),
      songLate: () => false,
      applySong: async (song) => applied.push(song.bpm),
      writeScene: () => {},
      writeTempo: () => {},
      stepsRef: { current: 0 }
    }
    const step = new Function(...Object.keys(env), `return (${arrow})`)(...Object.values(env))
    const settle = () => new Promise((r) => setImmediate(r))
    /* Next, Next: the first select lands after the second press, and is answered true. */
    step(11)
    step(12)
    loads[0].landed(true)
    await settle()
    loads[1].landed(true)
    await settle()
    assert.deepEqual(applied, [112], 'the song skipped past was set up on the unit loading the next one')
    /* The newer landing first changes nothing. */
    applied.length = 0
    step(13)
    step(11)
    loads[3].landed(true)
    await settle()
    loads[2].landed(true)
    await settle()
    assert.deepEqual(applied, [111])
    /* One step: its song, exactly as before. And a select that did not land: none, as before. */
    applied.length = 0
    step(12)
    loads[4].landed(true)
    await settle()
    assert.deepEqual(applied, [112], 'one step no longer sets up its song')
    step(13)
    loads[5].landed(false)
    await settle()
    assert.deepEqual(applied, [112])
    /* The watch's Previous and Next are this same step. */
    assert.match(read('mobile/src/lib/watchBridge.js'), /if \(cmd\.do === 'preset'\) return stepRef\.current\?\.\(cmd\.step, receivedAt\)/)
    assert.match(stage.replace(/\s+/g, ' '), /canNext: nextAt !== null \}, step \)/, 'the watch steps by something other than Stage.step')
  })

  /*
   * A SETLIST SONG'S SCENE AND TEMPO, NEVER SECONDS AFTER NEXT.
   *
   * They go once the preset has loaded and been read, so they cannot carry
   * Next's own deadline. But on a link that dropped just after the select and
   * came back, every one of those reads waited for it, and the song's scene
   * went out eight seconds after Next, mid-verse. The rule: the link away for
   * longer than a tap's deadline in all, between Next and then, and they are
   * not sent, and said. A link that stayed up is never touched.
   */
  test('a song’s setup is dropped when the link was away for longer than a tap’s deadline while its preset loaded', async () => {
    const r = await import('../shared/relay-rules.mjs')
    assert.equal(r.songWouldLandLate(0), false, 'a link that stayed up dropped the song’s setup')
    assert.equal(r.songWouldLandLate(r.TAP_DEADLINE_MS), false, 'a blip a tap would have ridden out dropped the song’s setup')
    assert.equal(r.songWouldLandLate(r.TAP_DEADLINE_MS + 1), true)
    assert.equal(r.songWouldLandLate(NaN), false)
    assert.equal(r.songNotSent({ scene: true, tempo: true }), 'Not sent — the song’s scene and tempo would have landed late')
    assert.equal(r.songNotSent({ scene: true }), 'Not sent — the song’s scene would have landed late')
    assert.equal(r.songNotSent({ tempo: true }), 'Not sent — the song’s tempo would have landed late')
    assert.ok(!/\bMac\b/.test(r.songNotSent({ scene: true, tempo: true })))
    const e = r.notSentError({ late: true, words: r.songNotSent({ scene: true }) })
    assert.equal(e.notSent, true)
    assert.equal(e.late, true)
    assert.ok(!e.linkDown && !e.aboutLink)
  })

  test('phone: the time the link is away is added up across its outages, and never in the demo', async () => {
    const t = await connectedLoop()
    const away = () => t.gate.linkAwayMs(t.clock.now())
    /* Connected for ten seconds of keepalives: nothing away. */
    const before = away()
    await t.clock.advance(10000)
    assert.equal(away() - before, 0, 'a link that stayed up was counted as away')
    /* The finding's timeline: the channel drops just after the select and is back six seconds later. */
    const atNext = away()
    t.bench.canJoin = false
    t.relay.channelUp(false)
    await t.clock.advance(5700)
    t.bench.canJoin = true
    t.relay.channelUp(true)
    await t.clock.advance(2000)
    assert.equal(t.link.linkState().link, 'connected')
    const held = away() - atNext
    assert.ok(held >= 5700 && held < 6500, `the link was away ${held} ms`)
    assert.equal((await import('../shared/relay-rules.mjs')).songWouldLandLate(held), true, 'a song’s scene would go out seconds after Next')
    /* A blip that heals by itself: under a tap's deadline, so the song's setup still goes. */
    const atBlip = away()
    t.relay.channelUp(false)
    await t.clock.advance(800)
    t.relay.channelUp(true)
    await t.clock.advance(2000)
    const blip = away() - atBlip
    assert.ok(blip > 0 && blip <= 1500, `a blip counted ${blip} ms away`)
    /* The demo: never away. */
    const d = await linkOnABench()
    d.bench.demo = true
    d.link.startLink()
    await d.clock.advance(100)
    await d.link.stopLink()
    await d.clock.advance(5000)
    assert.equal(d.gate.linkAwayMs(d.clock.now()), 0, 'the demo was counted as away')
  })

  test('browser: the time the link is away is added up for a phone on the web app only', async () => {
    const t = await webLinkOnABench()
    const away = () => t.gate.linkAwayMs(t.clock.now())
    const atNext = away()
    t.bench.canJoin = false
    t.remote.channelUp(false)
    await t.clock.advance(5700)
    t.bench.canJoin = true
    t.remote.channelUp(true)
    await t.clock.advance(2000)
    assert.equal(t.link.linkState().link, 'connected')
    const held = away() - atNext
    assert.ok(held >= 5700 && held < 6500, `the link was away ${held} ms`)
    for (const options of [{ role: 'mac' }, { role: 'wifi' }, { demo: true }]) {
      const o = await webLinkOnABench(options)
      o.remote.channelUp(false)
      await o.clock.advance(10000)
      assert.equal(o.gate.linkAwayMs(o.clock.now()), 0, `${JSON.stringify(options)} was counted as away`)
    }
  })

  test('both ends ask about the song’s setup before sending it, from a count taken as Next was pressed', () => {
    const stage = read('mobile/src/screens/Stage.js').replace(/\s+/g, ' ')
    assert.match(stage, /const awayAtNext = awayNow\(\)[\s\S]{0,300}const loading = loadPreset\(next, at\)/, 'the phone counts the link’s time away from after the load, not from Next')
    assert.match(stage, /landed === true && mine === stepsRef\.current && !songLate\(song, awayAtNext\) \? applySong\(/)
    const gig = read('src/components/Gig.jsx').replace(/\s+/g, ' ')
    assert.match(gig, /const awayAtNext = linkAwayMs\(Date\.now\(\)\) try \{[\s\S]{0,400}await loadPreset\(next\)/, 'the browser counts the link’s time away from after the load, not from Next')
    assert.match(gig, /if \(song && landed !== null\) \{ if \(songLate\(song, awayAtNext\)\) return (\/\*[\s\S]*?\*\/ )?const \{ refused, unsent \} = await applySongSorted\(/, 'the browser sends a song’s setup that would land late')
    assert.match(gig, /const songLate = \(song, awayAtNext\) => \{ if \(!songWouldLandLate\(linkAwayMs\(Date\.now\(\)\) - awayAtNext\)\) return false sayNotSent\(/, 'the browser’s dropped song setup is not said over the tiles')
  })

  test('a tempo waiting behind another is sent with the time of its own tap', async () => {
    const { tempoSender } = await import('../shared/tempo.mjs')
    let t = 0
    const calls = []
    let release = null
    const sender = tempoSender(
      (bpm, at) => {
        calls.push([bpm, at, t])
        return new Promise((go) => (release = go))
      },
      () => {},
      () => t
    )
    sender.push(120)
    t = 100
    sender.push(126)
    t = 2400
    release()
    await new Promise((r) => setImmediate(r))
    assert.deepEqual(calls, [
      [120, 0, 0],
      [126, 100, 2400]
    ], 'a queued tempo is sent with the time its turn came, not its tap')
  })
  /*
   * A SETLIST SONG'S SCENE THAT WAS NEVER SENT, IN THE BROWSER.
   *
   * applySong catches each half and names it, which lost why: a scene dropped
   * at its deadline, or refused because NOT CONNECTED came up while the
   * preset loaded, went to App's "Didn't work" notice — a row in the page
   * above Play that pushes every tile down — saying "The song's scene didn't
   * take. Set it by hand", which is not true of a scene that was never sent.
   */
  test('browser: a setlist song’s scene that was never sent is said over the tiles, never in App’s notice', async () => {
    const s = await import('../src/lib/setlists.js')
    const rules = await import('../shared/relay-rules.mjs')
    const did = []
    let res = await s.applySongSorted(
      { scene: 1, bpm: 120 },
      {
        scene: async (i) => {
          did.push(`scene ${i}`)
          throw rules.notSentError()
        },
        tempo: async (b) => {
          did.push(`tempo ${b}`)
        }
      }
    )
    assert.deepEqual(did, ['scene 1', 'tempo 120'], 'the tempo did not still go after the scene was dropped')
    assert.deepEqual(res.refused, [], 'a scene that was never sent is said as one the unit did not take')
    assert.equal(res.unsent?.message, rules.NOT_SENT)
    /* A real refusal is still a refusal, beside a half that was dropped. */
    res = await s.applySongSorted(
      { scene: 1, bpm: 120 },
      {
        scene: async () => {
          throw Object.assign(new Error('The unit refused it.'), { status: 409 })
        },
        tempo: async () => {
          throw rules.notSentError({ late: true })
        }
      }
    )
    assert.deepEqual(res.refused, ['scene'])
    assert.equal(res.unsent?.late, true)
    assert.deepEqual(await s.applySongSorted({ scene: 1 }, { scene: async () => ({ ok: true }) }), { refused: [], unsent: null })
    /* And Gig's Next sends only a real refusal to onError; a dropped half goes to the note over the tiles. */
    const gig = read('src/components/Gig.jsx').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')
    assert.match(
      gig,
      /const \{ refused, unsent \} = await applySongSorted\(song, \{ scene: writeScene, tempo: writeTempo \}\) if \(unsent\) sayNotSent\(unsent\) if \(refused\.length\) onError\(`The song’s \$\{refused\.join\(' and '\)\} didn’t take\./,
      'a song’s dropped scene goes to the notice that moves Play'
    )
    assert.ok(!/applySong\(/.test(gig), 'Gig still applies a song without keeping why a half failed')
  })

  test('browser: a channel picked on the hold sheet goes with the deadline of its press', async () => {
    const gig = read('src/components/Gig.jsx')
    const from = gig.indexOf('function ChannelSheet(')
    const sheet = gig.slice(from, gig.indexOf('return (', from))
    assert.ok(from > 0 && sheet.length > 0, 'the channel sheet is not where this test reads it')
    assert.match(sheet, /const deadline = tapDeadline\(\)\n/, 'the channel sheet’s press is not stamped when it is pressed')
    assert.match(sheet, /await setChannel\(block\.effectId, ch, \{ deadline \}\)/, 'a channel picked on the sheet goes with no deadline, and can land seconds late')
    /* And forgefx hands it to the relay beside the request, the body as it always was. */
    const { ffx, relay } = await forgefxOnABench()
    await ffx.setChannel(58, 'B', { deadline: 4321 })
    const [chan] = relay.handed
    assert.equal(chan.path, '/preset/blocks/58/channel')
    assert.equal(chan.deadline, 4321)
    assert.deepEqual(JSON.parse(chan.body), { channel: 'B' })
  })

  /*
   * NOT CONNECTED IS NEVER UNDER A CARD AT THE TOP.
   *
   * Measured on the real phone app at 320 by 568 (the first iPhone SE, or a
   * later one set to Larger Text): the fifteen-second advice reached down
   * past a third of the screen, and its Troubleshooting button covered the
   * word — 7 points of it with the iPhone's font, 27 of its 33 with Android's
   * wider one. The card is still drawn on top, so its buttons stay
   * pressable; the word floats below it, and moves nothing either way.
   */
  /*
   * THE BROWSER'S WORD GOES OVER THE TILES, ON ANY SCREEN. At a fixed 42% of
   * the window it sat on the Tap button on an iPad held upright, on Setlists
   * held sideways, and under everything on a big screen, where Play is
   * shorter than the window. It is placed over the scenes in view now
   * (src/lib/downBand.js), the pedals when the scenes are scrolled away.
   */
  test('browser: NOT CONNECTED floats over the scenes in view, on a phone, a tablet or a big screen', async () => {
    const { downBandTop, BAND_SHARE, BAND_EDGE } = await import('../src/lib/downBand.js')
    const word = 38
    /* What Play measures at four sizes (a probe of the real page): the top bar's bottom edge, the scenes, the pedals. */
    const sizes = {
      '375x667 (phone)': { viewport: 667, floor: 45, scenes: { top: 105, bottom: 353 }, blocks: { top: 365, bottom: 477 } },
      '768x1024 (iPad upright)': { viewport: 1024, floor: 45, scenes: { top: 162, bottom: 282 }, blocks: { top: 294, bottom: 346 }, tap: { top: 415, bottom: 459 } },
      '1024x768 (iPad sideways)': { viewport: 768, floor: 45, scenes: { top: 162, bottom: 218 }, blocks: { top: 230, bottom: 282 }, tap: { top: 299, bottom: 395 } },
      '1920x1080': { viewport: 1080, floor: 45, scenes: { top: 162, bottom: 218 }, blocks: { top: 230, bottom: 282 }, tap: { top: 299, bottom: 395 } }
    }
    for (const [name, at] of Object.entries(sizes)) {
      const top = downBandTop({ ...at, height: word })
      const middle = top + word / 2
      assert.ok(middle > at.scenes.top && middle < at.scenes.bottom, `${name}: the word's middle is at ${middle}, not over the scenes (${at.scenes.top}–${at.scenes.bottom})`)
      if (at.tap) assert.ok(top + word < at.tap.top, `${name}: the word is over the buttons at the foot`)
      /* The 42% it was: on everything but a phone, off the tiles. */
      if (at.tap) assert.ok(Math.round(at.viewport * BAND_SHARE) > at.blocks.bottom, `${name}: the old place was over the tiles after all, so this proves nothing`)
    }
    /* A dropped tap's note under the word does not move the word. */
    const at = sizes['1920x1080']
    assert.equal(downBandTop({ ...at, height: word, whole: word + 43 }), downBandTop({ ...at, height: word }))
    /* Scrolled to the pedals, the scenes behind the top bar: over the pedals, below the bar. */
    const scrolled = { viewport: 320, floor: 45, scenes: { top: -185, bottom: 40 }, blocks: { top: 50, bottom: 290 } }
    const s = downBandTop({ ...scrolled, height: word })
    assert.ok(s + word / 2 > 50 && s + word / 2 < 290 && s >= 45 + BAND_EDGE, `scrolled to the pedals, the word is at ${s}`)
    /* A sliver of scenes peeking out under the bar does not count: the pedals do. */
    const sliver = downBandTop({ viewport: 320, floor: 45, scenes: { top: -150, bottom: 70 }, blocks: { top: 80, bottom: 300 }, height: word })
    assert.ok(sliver + word / 2 > 80, `the word went over a sliver of scenes under the top bar (${sliver})`)
    /* Nothing measured yet: the old share. Never under the top bar, never off the bottom, note and all. */
    assert.equal(downBandTop({ viewport: 1000, floor: 45, height: word }), 420)
    assert.equal(downBandTop({ viewport: 0 }), null)
    assert.equal(downBandTop({ viewport: 600, floor: 45, scenes: { top: 45, bottom: 75 }, height: word }), 45 + BAND_EDGE)
    assert.equal(downBandTop({ viewport: 600, floor: 45, scenes: { top: 560, bottom: 600 }, height: word, whole: 81 }), 600 - 81 - BAND_EDGE)
    /* And Gig measures it from the grids themselves, and again whenever they move in the window. */
    const gig = read('src/components/Gig.jsx').replace(/\s+/g, ' ')
    assert.match(gig, /scenes: box\(scenesRef\.current\), blocks: box\(blocksRef\.current\),/)
    assert.match(gig, /height: bandRef\.current\?\.firstElementChild\?\.offsetHeight \|\| 0, whole: bandRef\.current\?\.offsetHeight \|\| 0/)
    assert.match(gig, /window\.addEventListener\('scroll', schedule, true\)/, 'a scroll of Play’s own screen leaves the word where the scenes were')
    assert.match(gig, /window\.addEventListener\('resize', schedule\)/)
  })

  test('phone: NOT CONNECTED floats below a card at the top, never under it', async () => {
    const { bandTop, BAND_AT } = await import('../mobile/src/lib/tileGrid.js')
    assert.equal(BAND_AT, 0.38)
    /* No card: where it always was. */
    assert.equal(bandTop(420, 0, 8), Math.round(420 * 0.38))
    /* A card above that point leaves it there. */
    assert.equal(bandTop(420, 120, 8), Math.round(420 * 0.38))
    /* A card reaching past it: the word goes under its bottom edge. */
    assert.equal(bandTop(420, 247, 8), 255)
    assert.equal(bandTop(420, 267.4, 8), 276)
    /* Before the screen is measured: the share as a percentage, or under a card already measured. */
    assert.equal(bandTop(0, 0, 8), '38%')
    assert.equal(bandTop(0, 247, 8), 255)
    const stage = read('mobile/src/screens/Stage.js').replace(/\s+/g, ' ')
    assert.match(stage, /const adviceUp = lost && !lostAway && !error/)
    assert.match(stage, /const bandAt = bandTop\(viewport, error \? cardEnd\.fault : adviceUp \? cardEnd\.advice : 0, space\.sm\)/, 'the word is not kept clear of the card that is up')
    assert.match(stage, /<Toast open=\{!!error\} onLayout=\{endOf\('fault'\)\}>/)
    assert.match(stage, /<Toast open=\{lost && !lostAway && !error\} onLayout=\{endOf\('advice'\)\}>/)
    const band = stage.slice(stage.indexOf('{down || droppedNote ? ( <View pointerEvents="none"'))
    assert.match(band.slice(0, 600), /style=\{\{ position: 'absolute', left: space\.lg, right: space\.lg, top: bandAt, [^}]*zIndex: 1,/, 'the word is not placed by the rule, or is drawn over the card')
    /* The card reports itself, and stays above the word so its buttons can be pressed. */
    const toast = read('mobile/src/components/Toast.js').replace(/\s+/g, ' ')
    assert.match(toast, /export default function Toast\(\{ open, yields = false, onLayout, children \}\)/)
    assert.match(toast, /<View onLayout=\{onLayout\} style=\{\{ position: 'absolute',[^}]*zIndex: 2,/)
  })

  /* ------------------------------------------------------------------ */
  /* The level readings nobody looks at                                  */
  /* ------------------------------------------------------------------ */

  /*
   * "Stop the computer asking the unit for level readings nobody is looking
   * at. With an FM3, FM9 or Axe-Fx III, the computer asks the unit for its
   * output level about 40 times a second the whole time it's online, even
   * when no screen shows a level bar. That's the same load that once made the
   * sound cut out. The website already says 'stop' when it doesn't need
   * them; the phone never does." — what Justin approved on 15 October 2026.
   * shared/relay-rules.mjs METERS_OFF_PATH says why only OFF is ever said,
   * and what an old computer does with it.
   */
  const metersSaid = (t) => t.bench.requests.filter((r) => r.path === '/telemetry/meters')

  test('the rule: off is all that is ever said, two minutes apart, and an old computer’s refusal is known', async () => {
    const r = await import('../shared/relay-rules.mjs')
    assert.equal(r.METERS_OFF_PATH, '/telemetry/meters')
    assert.deepEqual(JSON.parse(r.metersOffBody()), { on: false }, 'something other than off is sent')
    assert.equal(r.metersOffBody(), JSON.stringify({ on: false }), 'not the bytes Play has sent all along, which every computer since 7 September reads')
    assert.equal(r.hostAllows('POST', r.METERS_OFF_PATH), true, 'the relay refuses the one request that quietens the unit')
    assert.equal(r.forbiddenRemotely('POST', r.METERS_OFF_PATH), null)
    assert.equal(r.QUIET_METERS_MS, 2 * 60 * 1000, 'the rhythm moved; say why in shared/relay-rules.mjs (every request is a line in the computer’s log)')
    /* A computer older than the route: 403 over the relay, 404 at the computer itself. Nothing else is a refusal. */
    assert.equal(r.metersRefused({ status: 403 }), true)
    assert.equal(r.metersRefused({ status: 404 }), true)
    assert.equal(r.metersRefused({ status: 500 }), false, 'a computer that failed once is never asked again')
    assert.equal(r.metersRefused(Object.assign(new Error('The connection dropped'), { linkDown: true })), false, 'a dropped link counted as a refusal')
    assert.equal(r.metersRefused(undefined), false)
    const t0 = 1_000_000
    assert.equal(r.timeToQuietMeters({ link: 'connected', quietAt: 0, now: t0 }), true, 'not said the moment the computer answers')
    assert.equal(r.timeToQuietMeters({ link: 'connected', quietAt: t0, now: t0 + r.QUIET_METERS_MS - 1 }), false, 'said again inside two minutes')
    assert.equal(r.timeToQuietMeters({ link: 'connected', quietAt: t0, now: t0 + r.QUIET_METERS_MS }), true)
    assert.equal(r.timeToQuietMeters({ link: 'connected', quietAt: t0, now: t0 - 5 }), true, 'a clock that went back waits for ever')
    assert.equal(r.timeToQuietMeters({ link: 'no-answer', quietAt: 0, now: t0 }), false, 'said to a computer that is not there')
    assert.equal(r.timeToQuietMeters({ link: 'connected', quietAt: 0, now: t0, refused: true }), false, 'a computer that refused is asked again')
    assert.equal(r.timeToQuietMeters({ link: 'connected', quietAt: 0, now: t0, clash: 'two computers' }), false)
  })

  test('phone: the computer is told the moment it answers, before the roll call and the first reads, and never waited for', async () => {
    const t = await linkOnABench()
    t.link.startLink()
    await t.clock.advance(1000)
    assert.equal(t.link.linkState().link, 'connected')
    const said = metersSaid(t)
    assert.equal(said.length, 1, 'the phone never tells the computer nobody is looking at the level readings')
    assert.equal(said[0].method, 'POST')
    assert.deepEqual(JSON.parse(said[0].body), { on: false })
    const at = (what) => t.bench.order.indexOf(what)
    assert.ok(at('/telemetry/meters') >= 0 && at('/telemetry/meters') < at('census'), 'said after the roll call started holding writes')
    assert.ok(at('/telemetry/meters') < at('refreshAll'), 'said after the first reads queued up on the unit')
    /* And never anything but off, from anywhere in the link. */
    assert.ok(!t.bench.requests.some((x) => /"on":\s*true/.test(String(x.body))), 'the phone turned the readings on')
  })

  test('phone: a computer that never answers it holds nothing up', async () => {
    const t = await linkOnABench()
    t.bench.holdMeters = true
    t.link.startLink()
    await t.clock.advance(1000)
    assert.equal(metersSaid(t).length, 1)
    assert.ok(t.bench.order.includes('refreshAll'), 'the first reads waited on it')
    const asks = t.bench.asks.length
    await t.clock.advance(60000)
    /* A keepalive every sixteen seconds of quiet (KEEPALIVE, answered at the turn before); a loop that waited on it would ask none. */
    assert.ok(t.bench.asks.length >= asks + 3, `the keepalive waited on it (${t.bench.asks.length - asks} asks in a minute)`)
    assert.equal(t.link.linkState().link, 'connected')
  })

  test('phone: said again every two minutes while connected, and no more often', async () => {
    const t = await connectedLoop()
    t.bench.requests.length = 0
    await t.clock.advance(110000)
    assert.equal(metersSaid(t).length, 0, 'said again inside two minutes, which pushes useful lines out of the computer’s log')
    await t.clock.advance(20000)
    assert.equal(metersSaid(t).length, 1, 'not said again after two minutes, so a computer whose own window turned them on stays loud')
    await t.clock.advance(110000)
    assert.equal(metersSaid(t).length, 1)
    await t.clock.advance(20000)
    assert.equal(metersSaid(t).length, 2)
  })

  test('phone: a computer that stopped answering and came back is told again at once, not two minutes later', async () => {
    const t = await connectedLoop()
    await t.clock.advance(30000)
    t.bench.requests.length = 0
    /* A computer app restarted: one request unanswered, and the next question answered. It comes back with the readings on. */
    t.relay.seen(false)
    await t.clock.advance(1500)
    assert.equal(t.link.linkState().link, 'connected')
    assert.equal(metersSaid(t).length, 1, 'a computer back from a restart is left reading its levels for up to two minutes')
    /* And a channel that dropped and came back: the same. */
    await t.clock.advance(30000)
    t.bench.requests.length = 0
    t.relay.channelUp(false)
    await t.clock.advance(20000)
    assert.equal(t.link.linkState().link, 'connected', 'the bench loop did not rejoin')
    assert.equal(metersSaid(t).length, 1, 'a channel that came back is not told')
  })

  test('phone: a computer too old for it is asked once on each link, and nothing is said on screen', async () => {
    const t = await linkOnABench()
    t.bench.refuseMeters = true
    t.link.startLink()
    await t.clock.advance(1000)
    assert.equal(metersSaid(t).length, 1)
    await t.clock.advance(5 * 60 * 1000)
    assert.equal(metersSaid(t).length, 1, 'a computer that refused is asked again every two minutes')
    assert.equal(t.link.linkState().link, 'connected', 'a refusal moved the link')
    assert.ok(!t.told.some((s) => s.down), 'a refusal dimmed Play')
    /* The link dropped: it may be another computer app now, so it is asked once more. */
    t.relay.seen(false)
    await t.clock.advance(1500)
    assert.equal(metersSaid(t).length, 2, 'a computer that came back is never asked again')
    await t.clock.advance(5 * 60 * 1000)
    assert.equal(metersSaid(t).length, 2)
    /* And a computer chosen under Which unit is asked, whatever the last one said. */
    await t.link.chooseHost('Studio')
    assert.equal(metersSaid(t).length, 3, 'the computer picked under Which unit is not told')
  })

  test('phone: the demo tells no computer anything', async () => {
    const t = await linkOnABench()
    t.bench.demo = true
    t.link.startLink()
    await t.clock.advance(5 * 60 * 1000)
    assert.equal(metersSaid(t).length, 0)
  })

  test('browser: a phone on the website tells the computer off when it answers, every two minutes, and at once after a drop', async () => {
    const t = await webLinkOnABench()
    /* bootLink's join: said once already. */
    assert.deepEqual(t.bench.meters.map((m) => m.on), [false], 'the website used from a phone does not tell the computer when it answers')
    await t.clock.advance(110000)
    assert.equal(t.bench.meters.length, 1, 'said again inside two minutes')
    await t.clock.advance(20000)
    assert.equal(t.bench.meters.length, 2)
    /* The computer stops answering and is back. */
    t.remote.seen(false)
    await t.clock.advance(1500)
    assert.equal(t.link.linkState().link, 'connected')
    assert.equal(t.bench.meters.length, 3, 'a computer back from a restart is left reading its levels')
    assert.ok(t.bench.meters.every((m) => m.on === false), 'the website turned the readings on')
  })

  test('browser: a computer too old for it is asked once on each link', async () => {
    const t = await webLinkOnABench()
    t.bench.refuseMeters = true
    t.remote.seen(false)
    await t.clock.advance(1500)
    assert.equal(t.bench.meters.length, 2)
    await t.clock.advance(5 * 60 * 1000)
    assert.equal(t.bench.meters.length, 2, 'a computer that refused is asked again every two minutes')
    assert.equal(t.link.linkState().link, 'connected')
  })

  test('browser: the computer’s own window, its wifi page and the demo leave it to Play', async () => {
    for (const opts of [{ role: 'mac' }, { role: 'wifi' }, { demo: true }]) {
      const t = await webLinkOnABench(opts)
      await t.clock.advance(5 * 60 * 1000)
      assert.deepEqual(t.bench.meters, [], `${JSON.stringify(opts)}: the link said it where Play is the one to`)
    }
  })

  test('Play says off when it opens, even with its bar on screen, and the bar keeps its own read', () => {
    const gig = read('src/components/Gig.jsx')
    const calls = [...gig.matchAll(/setMetersWanted\(([^)]*)\)/g)].map((m) => m[1].trim())
    assert.deepEqual(calls, ['false'], 'Play tells the computer to read its levels again, under a phone that just said off')
    assert.match(gig, /useEffect\(\(\) => \{\s*setMetersWanted\(false\)\.catch\(\(\) => \{[\s\S]{0,120}\}\)\s*\}, \[\]\)/, 'Play says it on every chain read, or not when it opens')
    /* The bar is liveMeters — the output block's own monitor — and asks for it whatever the computer's readings are. */
    assert.match(gig, /if \(meterEid === null \|\| compact\) \{\s*setMeters\(\[\]\)/, 'the bar is hidden for something other than its size or a chain with no output block')
    assert.match(gig, /const data = await liveMeters\(meterEid\)/, 'the bar stopped reading the output block')
    const fx = read('src/lib/forgefx.js')
    assert.match(fx.slice(fx.indexOf('export const liveMeters')), /^export const liveMeters[^\n]*\n[\s\S]{0,300}\/preset\/monitors\/live/, 'the bar no longer reads the block monitor, which never needed the computer’s readings')
  })

  test('nothing anywhere in either app turns the readings on', () => {
    const files = [
      ...['src', 'mobile/src'].flatMap((dir) => walk(dir)),
      'mobile/App.js'
    ].filter((f) => /\.(m?js|jsx)$/.test(f))
    assert.ok(files.length > 50, 'the walk found almost nothing to read')
    for (const f of files) {
      const text = read(f)
      for (const m of text.matchAll(/setMetersWanted\(([^)]*)\)/g)) {
        const arg = m[1].trim()
        assert.ok(arg === 'false' || /export const setMetersWanted = \(on\)/.test(text.slice(Math.max(0, m.index - 30), m.index + 30)), `${f}: setMetersWanted(${arg})`)
      }
      for (const m of text.matchAll(/\/telemetry\/meters/g)) {
        assert.ok(!/on:\s*(true|!!|on\b)|"on":\s*true/.test(text.slice(m.index, m.index + 160)) || f === 'src/lib/forgefx.js', `${f}: something posts on to /telemetry/meters`)
      }
    }
    /* The phone's loop: in its turn and its join, never awaited, started again by every drop. */
    const phone = read('mobile/src/lib/link.js')
    const turn = phone.slice(phone.indexOf('async function turn()'), phone.indexOf('async function join()'))
    assert.match(turn, /\n {2}if \(running\) quietMeters\(\)\n/, 'the phone’s loop never says it again')
    const join = phone.slice(phone.indexOf('async function join()'), phone.indexOf('async function countHosts()'))
    assert.ok(join.indexOf('quietMeters()') > join.indexOf('await readMacName()') && join.indexOf('quietMeters()') < join.indexOf('countHosts()'), 'the phone says it after the roll call has begun holding writes, or not at join at all')
    assert.ok(!/await remoteRequest\(METERS_OFF_PATH/.test(phone), 'the link waits on it')
    assert.match(phone, /remoteRequest\(METERS_OFF_PATH, \{ method: 'POST', body: metersOffBody\(\) \}\)/)
    const start = phone.slice(phone.indexOf('export function startLink()'))
    assert.match(start, /subscribeRemoteState\(\(up\) => \{\s*\/\*[^*]*\*\/\s*if \(!up\) metersAgain\(\)/, 'a dropped channel does not start the clock again')
    assert.match(start, /subscribeHostSeen\(\(seen\) => \{\s*if \(!seen\) metersAgain\(\)/, 'a computer that stopped answering does not start the clock again')
    assert.match(phone.slice(phone.indexOf('export async function stopLink()')), /metersAgain\(\)/)
    const web = read('src/lib/link.js')
    const webTurn = web.slice(web.indexOf('async function turn()'), web.indexOf('function tellComputer()'))
    assert.match(webTurn, /\n {2}tellComputer\(\)\n {2}\/\/[^\n]*\n {2}quietMeters\(\)\n/, 'the website’s loop never says it')
    assert.match(web.slice(web.indexOf('function quietMeters()')), /^function quietMeters\(\) \{\n {2}if \(state\.role !== 'remote'\) return/, 'the website says it from the computer’s own window, where Play does')
  })
}
