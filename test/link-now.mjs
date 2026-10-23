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
  export const bench = { sent: [], socket: true, silent: false, lag: 40, reply: null, chan: null, handlers: {}, status: null, uid: 'u1', joinLag: null, chans: [], disconnects: 0 }
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
    /*
     * Two or more computers on the account (bench.computers): each answers
     * what is asked of nobody in particular and what is asked of it by name,
     * after its own lag, as computer app 1.87.4 and later do; one marked
     * \`old\` answers whatever name was asked, as a computer app too old to
     * know names.
     */
    if (bench.computers) {
      for (const c of bench.computers) {
        if (payload.host && payload.host !== c.name && !c.old) continue
        const said = c.reply ? c.reply(payload) : null
        if (said === 'silent') continue
        const res = said && typeof said === 'object' && 'status' in said ? said : { status: 200, body: JSON.stringify(said ?? { ok: true, from: c.name }) }
        /* \`lag\` may be a function of the request: a computer slow to answer one question only. */
        const lag = typeof c.lag === 'function' ? c.lag(payload) : c.lag ?? bench.lag
        clock.setTimeout(() => bench.handlers['broadcast:res']?.({ payload: { id: payload.id, encoding: 'utf8', ...res } }), lag)
      }
      return
    }
    const said = bench.reply ? bench.reply(payload) : null
    if (said === 'silent') return
    const res = said && typeof said === 'object' && 'status' in said ? said : { status: 200, body: JSON.stringify(said ?? { ok: true }) }
    clock.setTimeout(() => bench.handlers['broadcast:res']?.({ payload: { id: payload.id, encoding: 'utf8', ...res } }), bench.lag)
  }
  export const createClient = () => {
    const client = {
      auth: {
        /* Signed in as \`bench.uid\`, or nobody once signed out. */
        getSession: async () => ({ data: { session: bench.uid ? { user: { id: bench.uid }, access_token: 't' } : null } }),
        signOut: async () => ({ error: null })
      },
      /*
       * With \`bench.joinLag\` set, a channel takes that long to join, and the
       * socket is one for every channel, as realtime-js's is: closed, every
       * channel still on it errors. Otherwise a join is at once, and closing
       * the socket is only counted.
       */
      realtime: {
        isConnected: () => bench.socket,
        disconnect: async () => {
          bench.disconnects += 1
          if (bench.joinLag === null) return
          bench.socket = false
          for (const chan of bench.chans.filter((c) => !c.removed)) {
            chan.state = 'errored'
            chan.cb?.('CHANNEL_ERROR', new Error('socket closed: 1000'))
          }
        }
      },
      getChannels: () => [],
      removeChannel: async (chan) => {
        if (!chan || chan.removed) return
        chan.removed = true
        if (bench.joinLag === null) return
        chan.state = 'closed'
        chan.cb?.('CLOSED')
      },
      channel: () => {
        const chan = {
          state: 'closed',
          on(type, filter, fn) {
            bench.handlers[type + ':' + (filter?.event || '')] = fn
            return chan
          },
          subscribe(cb) {
            bench.status = cb
            chan.cb = cb
            if (bench.joinLag !== null) {
              bench.socket = true
              chan.state = 'joining'
              clock.setTimeout(() => {
                if (chan.removed) return
                chan.state = 'joined'
                cb('SUBSCRIBED')
              }, bench.joinLag)
              return chan
            }
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
        bench.chans.push(chan)
        return chan
      }
    }
    return client
  }
`

/**
 * One end's relay on a bench: 'phone' is mobile/src/lib/relay.js, 'web' is src/lib/remote.js.
 * `picked` is the computer picked under Which unit on an earlier visit, as each end keeps it for
 * the account (u1); `many` whether the last roll call that account finished heard two or more
 * (true), one (false), or was never written down (null); `legacy` keeps the pick the way 1.87.47
 * did, once for the whole phone or browser. `kept` is the key's whole text instead, written as it
 * is. `disk` is how the disk answers a read of it: at once (null), after so many ms, 'never', or
 * 'throws'.
 */
const PICK_KEY = { phone: 'fractal.remote.host', web: 'fab.remote.host' }
/* One account's entry in that key, as the bench's disk holds it now. */
const keptFor = (store, end, uid = 'u1') => {
  try {
    return JSON.parse(store.kept[PICK_KEY[end]]).accounts[uid] ?? null
  } catch {
    return null
  }
}
async function relayOnABench(end, { picked = null, many = null, legacy = false, kept = null, disk: slow = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), `link-now-${end}-`))
  const disk = {}
  if (picked || many !== null) disk[PICK_KEY[end]] = legacy ? picked : JSON.stringify({ accounts: { u1: { name: picked, many } } })
  if (kept !== null) disk[PICK_KEY[end]] = kept
  const files = {
    'package.json': '{ "type": "module" }',
    'clock.mjs': CLOCK,
    'service.mjs': SERVICE,
    /* The phone's disk (AsyncStorage) and the browser's (the pick's keys in localStorage), the same few keys; and the log, kept. */
    'nothing.mjs':
      "import * as clock from './clock.mjs'\n" +
      'export const logged = []\nexport const logDebug = (...a) => { logged.push(a.filter((x) => x !== undefined).join(" ")) }\n' +
      'export const notForever = (...a) => fetch(...a)\nexport const decode = async (p) => p.body\n' +
      `export const kept = ${JSON.stringify(disk)}\n` +
      /* How the disk answers a read, and how many reads it was asked: \`disk.slow\` may be changed by a test. */
      `export const disk = { slow: ${JSON.stringify(slow)}, reads: 0 }\n` +
      "const answer = (k) => { disk.reads += 1; if (disk.slow === 'throws') throw new Error('the bench disk is locked'); return kept[k] ?? null }\n" +
      'export const pickStore = { getItem: (k) => answer(k), setItem: (k, v) => { kept[k] = String(v) }, removeItem: (k) => { delete kept[k] } }\n' +
      "const later = (k) => (disk.slow === 'never' ? new Promise(() => {}) : typeof disk.slow === 'number' ? new Promise((go) => clock.setTimeout(() => go(kept[k] ?? null), disk.slow)) : Promise.resolve().then(() => answer(k)))\n" +
      'export default { getItem: async (k) => later(k), setItem: async (k, v) => { kept[k] = String(v) }, removeItem: async (k) => { delete kept[k] } }\n',
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
          ["from './debugLog.js'", "from './nothing.mjs'"],
          ["import('@supabase/supabase-js')", "import('./service.mjs')"],
          /* The pick's keys on the bench's disk rather than the runtime's localStorage, which Node may not have. */
          ["const pickStore = () => (typeof localStorage === 'undefined' ? null : localStorage)", 'const pickStore = () => __pick']
        ]
  let src = read(end === 'phone' ? 'mobile/src/lib/relay.js' : 'src/lib/remote.js')
  for (const [from, to] of swaps) {
    assert.ok(src.includes(from), `${end}: no longer has ${from}; the bench needs telling`)
    src = src.replaceAll(from, to)
  }
  if (end !== 'phone') src = "import { pickStore as __pick } from './nothing.mjs'\n" + src
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
    const store = await import(at('nothing.mjs'))
    return { relay, bench: service.bench, service, clock, rules, asked, tap, watch, store }
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
    /* What the phone wrote in its log, as `bench.logged`: "<tag> <line>". */
    'debugLog.mjs': "import { bench } from './bench.mjs'\nexport const logDebug = (tag, line) => { (bench.logged = bench.logged || []).push(`${tag} ${line}`) }\n",
    'bleSwitch.mjs': 'export const bluetoothOn = () => false\n',
    'bleLink.mjs': 'export const pokeBluetooth = () => {}\nexport const startBluetoothLink = () => {}\nexport const stopBluetoothLink = () => {}\n',
    'tapGate.mjs': read('mobile/src/lib/tapGate.js'),
    'relay-rules.mjs': clocked(read('shared/relay-rules.mjs')),
    'rig.mjs': "import { bench } from './bench.mjs'\nexport const listen = () => {}\nexport const refreshAll = async () => { bench.order.push('refreshAll') }\nexport const reset = () => {}\nexport const startClean = () => { bench.order.push('startClean') }\nexport const computerChanged = () => { bench.order.push('computerChanged') }\nexport const unitReadSince = () => bench.unitRead !== false\nexport const watchUnit = () => {}\nexport const stopWatching = () => {}\n",
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
      /* Every join begun is counted in \`bench.joins\`; \`bench.joinMs\` is how long one takes, at once unless a test says. */
      export async function remoteConnect() {
        bench.joins = (bench.joins || 0) + 1
        if (bench.joinMs) await new Promise((r) => clock.setTimeout(r, bench.joinMs))
        if (!bench.canJoin) throw new Error('the bench will not join')
        channelUp(true)
        return 'u1'
      }
      export const remoteDisconnect = async () => channelUp(false)
      /* What a roll call finds: \`bench.census\` runs inside it, and sets hosts, chosen and askedOf for the ones after. */
      export const censusHosts = async (options) => { bench.order.push('census'); (bench.censusOptions = bench.censusOptions || []).push(options ?? null); if (bench.census) await bench.census(); return bench.hosts || [] }
      export const hostConflict = () => null
      export const remoteChosenHost = () => bench.chosen ?? null
      export const remoteHosts = () => bench.hosts || []
      export const remoteUnits = () => bench.unitsNow || {}
      export const remoteReadsAskedOf = () => bench.askedOf ?? null
      /* Whether a roll call is due (relay.js remoteCountDue): \`bench.countDue\`, false unless a test says. */
      export const remoteCountDue = () => (typeof bench.countDue === 'function' ? bench.countDue() : bench.countDue === true)
      /* Whether a count cut short by a drop is owed (relay.js recountOwed): \`bench.countOwed\`, false unless a test says. */
      export const remoteCountOwed = () => bench.countOwed === true
      /* A pick that did not answer while another is driven (relay.js remoteMissingPick): \`bench.missing\`; Keep this one and Forget clear it. */
      export const remoteMissingPick = () => bench.missing ?? null
      export const keepDriven = () => { const had = !!bench.missing; bench.missing = null; bench.kept = (bench.kept || 0) + 1; return had }
      /* Which unit each computer has, asked again (relay.js refreshUnits): counted in \`bench.unitsAsked\`. */
      export const refreshUnits = async (options) => { bench.unitsAsked = (bench.unitsAsked || 0) + 1; (bench.unitsAskedWith = bench.unitsAskedWith || []).push(options ?? null); if (bench.unitsTake) await bench.unitsTake(); return bench.units || {} }
      export const forgetMissingPick = () => { const had = !!bench.missing; bench.missing = null; bench.forgot = (bench.forgot || 0) + 1; return had }
      /* Whether the account's record says it may have two (relay.js remoteMayBeTwo): \`bench.many\` true, which a test says. */
      export const remoteMayBeTwo = () => bench.many === true
      /* Which unit (relay.js pickHost): \`bench.pick\` runs inside it; \`bench.switched(name)\` tells link.js it moved, as relay.js does before the proof. */
      export const pickHost = async (name) => (bench.pick ? bench.pick(name) : false)
      const switchWatchers = new Set()
      export const subscribeSwitching = (fn) => (switchWatchers.add(fn), () => switchWatchers.delete(fn))
      bench.switched = (name) => [...switchWatchers].forEach((fn) => fn(name))
      /* A mix of computers' answers on screen (relay.js subscribeMixed): \`bench.mixed()\` tells link.js. */
      const mixedWatchers = new Set()
      export const subscribeMixed = (fn) => (mixedWatchers.add(fn), () => mixedWatchers.delete(fn))
      bench.mixed = () => [...mixedWatchers].forEach((fn) => fn())
      export const restoreSession = async () => 'u1'
      /* A computer older than 7 September refuses the level-readings route (refuseMeters); one that never answers holds it (holdMeters). */
      export async function remoteRequest(path, options = {}) {
        bench.requests.push({ at: clock.now(), path, method: options.method || 'GET', body: options.body ?? null })
        bench.order.push(path)
        if (path === '/telemetry/meters' && bench.holdMeters) return new Promise(() => {})
        if (path === '/telemetry/meters' && bench.refuseMeters) throw Object.assign(new Error('not allowed remotely'), { status: 403, remoteBlocked: true })
        return { data: { name: bench.named || 'Studio', version: '1.87.4' } }
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
/* The phone's whole link, run: link.js, relay.js, rig.js, device.js      */
/* -------------------------------------------------------------------- */

/*
 * Every file of mobile/src/lib as it is, on the hand-turned clock, beside a
 * pretend relay server with `bench.computers` on the account, each with its
 * own lag and its own unit or none, answering the way ForgeFX does: a
 * computer with nothing plugged in says "FM3" for /device, no for /healthz
 * and a 503 for every unit read. Its socket is one for every channel, as
 * realtime-js's is: `disconnect` closes it with 1000 and every channel still
 * on it errors. `bench.joinLag` is how long a channel takes to join.
 * `pick` is what the phone's disk holds for Which unit.
 */
const STACK_SERVICE = `
  import * as clock from './clock.mjs'
  export const bench = { computers: [], joinLag: 450, chans: [], socket: false, uid: 'u1', disconnects: 0 }
  const FM3_CAPS = { scenes: 8 }
  const AM4_CAPS = { scenes: 4 }
  const NO_UNIT = 'No Fractal device found on any serial or MIDI port.'
  function forgefx(c, p) {
    const path = p.path
    if (path === '/store/config/host.name') return { data: { name: c.name, version: c.version || '1.87.48' } }
    if (path === '/healthz') return { ok: !!c.unit }
    if (path === '/device') return { model: c.unit || 'FM3', capabilities: c.unit === 'AM4' ? AM4_CAPS : FM3_CAPS }
    if (path === '/device/detect') return c.unit ? { connected: true, name: c.unit, short: c.unit, capabilities: c.unit === 'AM4' ? AM4_CAPS : FM3_CAPS } : { connected: false, modelId: -1, name: 'No device', short: '—', gen: 0, supported: false, capabilities: null }
    if (path.startsWith('/store/config/')) return p.method === 'GET' ? { data: null } : { ok: true }
    if (path === '/telemetry/meters') return { ok: true }
    if (!c.unit) return { status: 503, body: JSON.stringify({ error: NO_UNIT }) }
    if (path === '/preset') return c.unit === 'FM3' ? { number: 479, name: 'Nothing Else Matters' } : { number: 53, name: 'AM4 53' }
    if (path === '/scene') return { index: c.unit === 'FM3' ? 6 : 1 }
    if (path === '/tempo') return { bpm: c.unit === 'FM3' ? 120 : 0 }
    if (path === '/preset/blocks') return [{ slug: 'amp', name: 'Amp 1', effectId: 58, bypassed: false, channel: 'A' }]
    if (path === '/preset/grid') return { name: 'grid', scenes: c.unit === 'FM3' ? ['VERSE', 'CHORUS', '', '', '', '', 'SOLO', ''] : ['A', 'B', 'C', 'D'], cells: [] }
    if (/^\\/presets\\/\\d+\\/scenes$/.test(path)) return { names: c.unit === 'FM3' ? ['VERSE', 'CHORUS', '', '', '', '', 'SOLO', ''] : ['A', 'B', 'C', 'D'] }
    if (/^\\/presets\\/\\d+\\/summary$/.test(path)) return { status: 501, body: JSON.stringify({ error: 'unsupported' }) }
    if (path === '/preset/scene-state') return []
    return { ok: true }
  }
  function answer(chan, payload) {
    for (const c of bench.computers) {
      if (payload.host && payload.host !== c.name) continue
      const said = forgefx(c, payload)
      const res = said && typeof said === 'object' && 'status' in said ? said : { status: 200, body: JSON.stringify(said) }
      /* What each computer heard, for a test that asks which of them carried out a write. */
      ;(c.heard = c.heard || []).push({ at: clock.now(), path: payload.path, host: payload.host || '' })
      clock.setTimeout(() => {
        if (chan.removed || chan.state !== 'joined') return
        chan.handlers['broadcast:res']?.({ payload: { id: payload.id, encoding: 'utf8', ...res } })
      }, typeof c.lag === 'function' ? c.lag(payload) : c.lag)
    }
  }
  export const createClient = () => ({
    auth: {
      getSession: async () => ({ data: { session: bench.uid ? { user: { id: bench.uid }, access_token: 't' } : null } }),
      getUser: async () => ({ data: { user: bench.uid ? { id: bench.uid } : null } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    },
    realtime: {
      isConnected: () => bench.socket,
      disconnect: async () => {
        bench.disconnects += 1
        bench.socket = false
        for (const chan of bench.chans.filter((c) => !c.removed)) {
          chan.state = 'errored'
          chan.cb?.('CHANNEL_ERROR', new Error('socket closed: 1000'))
        }
      }
    },
    getChannels: () => bench.chans.filter((c) => !c.removed),
    removeChannel: async (chan) => {
      if (chan.removed) return 'ok'
      chan.removed = true
      chan.state = 'closed'
      chan.cb?.('CLOSED')
      return 'ok'
    },
    channel: () => {
      const chan = {
        state: 'closed',
        handlers: {},
        on(type, filter, fn) {
          chan.handlers[type + ':' + (filter?.event || '')] = fn
          return chan
        },
        subscribe(cb) {
          chan.cb = cb
          bench.socket = true
          chan.state = 'joining'
          clock.setTimeout(() => {
            if (chan.removed) return
            chan.state = 'joined'
            cb('SUBSCRIBED')
          }, bench.joinLag)
          return chan
        },
        track: async () => 'ok',
        async send(msg) {
          if (chan.state === 'joined') answer(chan, msg.payload)
          return 'ok'
        }
      }
      bench.chans.push(chan)
      return chan
    },
    from: () => ({ insert: async () => ({ error: null }) })
  })
`
async function stackOnABench({ pick = null } = {}) {
  const lib = 'mobile/src/lib'
  const dir = mkdtempSync(join(tmpdir(), 'link-now-stack-'))
  const have = new Set(readdirSync(new URL(`../${lib}`, import.meta.url)))
  const named = (name) => (/\.m?js$/.test(name) ? name : have.has(`${name}.mjs`) && !have.has(`${name}.js`) ? `${name}.mjs` : `${name}.js`)
  const local = (src) =>
    src
      .replace(/from 'react'/g, "from './react.mjs'")
      .replace(/from 'react-native'/g, "from './react-native.mjs'")
      .replace(/from '@react-native-async-storage\/async-storage'/g, "from './storage.mjs'")
      .replace(/from '@supabase\/supabase-js'/g, "from './service.mjs'")
      .replace(/from '\.\/([\w.-]+)'/g, (whole, name) => `from './${named(name)}'`)
  /* Every timer and Date.now() the bench's, and only the bare ones: never one already on an object. */
  const timed = (src) =>
    "import * as __clock from './clock.mjs'\n" +
    src
      .replace(/\bDate\.now\(\)/g, '__clock.now()')
      .replace(/(?<![.\w])(setTimeout|clearTimeout|setInterval|clearInterval)\(/g, '__clock.$1(')
  const files = {}
  for (const f of have) if (/\.m?js$/.test(f)) files[f] = timed(local(read(`${lib}/${f}`)))
  Object.assign(files, {
    'package.json': '{ "type": "module" }',
    'clock.mjs':
      CLOCK +
      'export const setInterval = (fn, ms) => setTimeout(function again() { fn(); setTimeout(again, ms) }, ms)\nexport const clearInterval = clearTimeout\n',
    'service.mjs': STACK_SERVICE,
    'storage.mjs': `export const kept = ${JSON.stringify(pick === null ? {} : { 'fractal.remote.host': pick })}\nexport default { getItem: async (k) => kept[k] ?? null, setItem: async (k, v) => { kept[k] = String(v) }, removeItem: async (k) => { delete kept[k] } }\n`,
    'react-native.mjs':
      "export const heard = []\nexport const AppState = { currentState: 'active', addEventListener: (type, fn) => { heard.push(fn); return { remove() { heard.splice(heard.indexOf(fn) >>> 0, 1) } } } }\nexport const Platform = { OS: 'ios', Version: '27.0.1' }\nexport const Dimensions = { get: () => ({ width: 440, height: 956 }) }\n",
    'react.mjs': 'export const useSyncExternalStore = () => null\nexport const useEffect = () => {}\nexport const useState = (v) => [v, () => {}]\n',
    /* What reaches no computer, or needs the app around it: stood in for. */
    'demo.js': "export const isDemo = () => false\nexport const demoDevice = () => null\nexport const demoUnit = () => 'fm3'\nexport const useDemo = () => false\n",
    'demoWire.js': "export const demoRequest = () => { throw new Error('no demo on the bench') }\n",
    'bleSwitch.js': "export const bluetoothWire = () => null\nexport const bluetoothOn = () => false\nexport const overBluetooth = (caps) => caps?.via === 'bluetooth'\n",
    'bleLink.js': 'export const pokeBluetooth = () => {}\nexport const startBluetoothLink = () => {}\nexport const stopBluetoothLink = () => {}\n',
    'lineage.js': 'export const withLineage = (x) => x\n',
    'presetNames.js': 'export const adopt = async () => 0\nexport const forget = () => {}\nexport const learn = () => {}\nexport const nameOf = () => undefined\n',
    'paramIndex.js': 'export const forget = () => {}\n',
    'sceneNameCache.js': 'export const forgetSceneNames = () => true\nexport const recallSceneNames = async () => []\nexport const rememberSceneNames = () => true\nexport const sceneNamesKnown = async () => false\n',
    'notForever.js': 'export const notForever = (...a) => fetch(...a)\n',
    'decode.mjs': 'export const decode = async (p) => p.body\n',
    'phone-note.js': "export const PHONE_NOTE_PATH = '/store/config/phone.seen'\nexport const phoneNote = () => ({})\nexport const timeToTell = () => false\n",
    'blockCatalog.js': `export const blockCatalog = ${read('mobile/src/data/blocks.json')}\n`
  })
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    const clock = await import(at('clock.mjs'))
    const { bench } = await import(at('service.mjs'))
    const rn = await import(at('react-native.mjs'))
    const debug = await import(at('debugLog.js'))
    const relay = await import(at('relay.js'))
    const rig = await import(at('rig.js'))
    const link = await import(at('link.js'))
    const device = await import(at('device.js'))
    const app = {
      change(status) {
        rn.AppState.currentState = status
        for (const fn of [...rn.heard]) fn(status)
      }
    }
    /* The phone's log as Copy Logs words it, one line each. */
    const lines = () => debug.getDebugLog().map((e) => `[${e.source}] ${e.message}${e.detail ? ` — ${e.detail}` : ''}`)
    return { link, relay, rig, device, clock, bench, app, lines }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
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
      /* Every roll call, with the options it was taken with (\`late\`: at the first answer, link.js countIfDue). */
      export const censusHosts = async (options) => { bench.censuses = (bench.censuses || 0) + 1; (bench.censusOptions = bench.censusOptions || []).push(options ?? null); return [] }
      export const hostConflict = () => null
      export const remoteHosts = () => bench.hosts || []
      export const remoteUnits = () => bench.unitsNow || {}
      export const remoteChosenHost = () => null
      export const remoteReadsAskedOf = () => null
      export const remoteCountDue = () => (typeof bench.countDue === 'function' ? bench.countDue() : false)
      export const remoteCountOwed = () => bench.countOwed === true
      export const remoteMissingPick = () => bench.missing ?? null
      export const keepDriven = () => { const had = !!bench.missing; bench.missing = null; return had }
      export const refreshUnits = async (options) => { bench.unitsAsked = (bench.unitsAsked || 0) + 1; (bench.unitsAskedWith = bench.unitsAskedWith || []).push(options ?? null); if (bench.unitsTake) await bench.unitsTake(); return bench.unitsNow || {} }
      export const forgetMissingPick = () => { const had = !!bench.missing; bench.missing = null; return had }
      /* Which unit (remote.js pickHost): \`bench.pick\` runs inside it. */
      export const pickHost = async (name) => (bench.pick ? bench.pick(name) : false)
      export const subscribeSwitching = () => () => {}
      export const subscribeMixed = () => () => {}
    `,
    /* The unit store, which a computer change starts clean (deviceState.computerChanged): counted in \`bench.changed\`. */
    'deviceState.mjs': "import { bench } from './bench.mjs'\nexport const computerChanged = () => { bench.changed = (bench.changed || 0) + 1 }\n"
  }
  const swaps = [
    ["from './remote.js'", "from './remote.mjs'"],
    ["from './tapGate.js'", "from './tapGate.mjs'"],
    ["from './deviceState.js'", "from './deviceState.mjs'"],
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
  /* One join at a time                                                   */
  /* ------------------------------------------------------------------ */

  /*
   * Justin's launch of 22 October 2026, 16:48:55: "off → joining", then
   * "back on screen" 134 ms later while that join was still out. That
   * started a second join, which took the first one's channel; the first
   * then ended on its twelve-second timer, and its clean-up closed the
   * socket both were on: "socket closed: 1000", "join failed after 12.2s",
   * and the link gone for sixteen seconds under a Which unit tap. The
   * browser never did it (src/lib/link.js `if (joining) return`).
   */
  test('phone: back on screen while the launch is still joining starts no second join', async () => {
    const t = await linkOnABench()
    t.bench.joinMs = 450
    t.link.startLink()
    await t.clock.advance(134)
    t.app.change('active')
    await t.clock.advance(13000)
    assert.equal(t.bench.joins, 1, 'back on screen during the launch’s join began a second one')
    assert.equal(t.bench.order.filter((x) => x === 'refreshAll').length, 1, 'the unit was read once for each join')
    assert.equal(t.bench.order.filter((x) => x === 'census').length, 1, 'a roll call was taken for each join')
    assert.equal(t.link.linkState().link, 'connected')
    assert.ok(!t.told.some((s) => s.down), 'Play said NOT CONNECTED over the launch')
  })

  test('phone: a join asked for while one is under way waits for it, and one let go never closes the socket of the join after it', async () => {
    const r = await relayOnABench('phone')
    await r.relay.remoteDisconnect()
    r.bench.joinLag = 450
    const made = r.bench.chans.length
    /* Two at once, as the launch asked for them. */
    const first = r.watch(r.relay.remoteConnect())
    await r.clock.advance(134)
    const second = r.watch(r.relay.remoteConnect())
    await r.clock.advance(13000)
    assert.equal(r.bench.chans.length - made, 1, 'a second channel was made while the first was joining')
    assert.ok(first.done && !first.error, first.error?.message || 'the first join never ended')
    assert.ok(second.done && !second.error, second.error?.message || 'the second never ended')
    assert.equal(r.bench.disconnects, 0, 'the socket was closed under a working channel')
    assert.equal(r.relay.remoteActive(), true)
    /* Let go while joining (remoteDisconnect, as stopLink does), then joined again: the first ends at once, as replaced, and leaves the socket alone. */
    await r.relay.remoteDisconnect()
    const gone = r.watch(r.relay.remoteConnect())
    await r.clock.advance(134)
    await r.relay.remoteDisconnect()
    await r.clock.advance(1)
    assert.ok(gone.done, 'a join let go waited out its twelve seconds')
    assert.equal(gone.error?.replaced, true, gone.error?.message || 'a join let go was said to have joined')
    const next = r.watch(r.relay.remoteConnect())
    await r.clock.advance(13000)
    assert.ok(next.done && !next.error, next.error?.message || 'the join after it never ended')
    assert.equal(r.bench.disconnects, 0, 'the join let go closed the socket the next one is on')
    assert.equal(r.relay.remoteActive(), true, 'the next channel was dropped by the one it came after')
    /* A join that really failed still closes its socket: a dead one is never handed on. */
    await r.relay.remoteDisconnect()
    r.bench.joinLag = 60000
    const stuck = r.watch(r.relay.remoteConnect())
    await r.clock.advance(12100)
    assert.ok(stuck.done && /timed out/.test(stuck.error?.message), stuck.error?.message || 'a join that never got through never ended')
    assert.equal(r.bench.disconnects, 1, 'a failed join handed the next attempt the same socket')
  })

  test('phone: Which unit tapped 10.7 s into such a launch is done in under five seconds, and the link never drops', async () => {
    /* Justin's rig: the MacBook's FM3, a Pi 5 with nothing plugged in, and the Pi 3's AM4, picked. */
    const s = await stackOnABench({ pick: JSON.stringify({ accounts: { u1: { name: 'raspberry pi 3', many: true } } }) })
    const dump = (p) => /^\/preset\/(blocks|grid)$/.test(p.path)
    s.bench.computers = [
      { name: 'MacBook Pro SG 566', unit: 'FM3', version: '1.87.47', lag: (p) => (dump(p) ? 750 : 150) },
      { name: 'raspberry pi 5', unit: null, lag: 170 },
      { name: 'raspberry pi 3', unit: 'AM4', lag: (p) => (dump(p) ? 2500 : 320) }
    ]
    const told = []
    s.link.subscribeLink((st) => told.push({ at: s.clock.now(), link: st.link, down: st.down }))
    const t0 = s.clock.now()
    s.link.startLink()
    await s.clock.advance(134)
    s.app.change('active')
    await s.clock.advance(10720 - 134)
    const tapped = s.clock.now()
    let took = null
    s.link.chooseHost('MacBook Pro SG 566').finally(() => {
      took = s.clock.now() - tapped
    })
    await s.clock.advance(25000)
    const log = s.lines()
    assert.ok(took !== null && took < 5000, `the tap took ${took} ms\n${log.join('\n')}`)
    assert.equal(s.bench.disconnects, 0, `the phone closed the socket\n${log.join('\n')}`)
    assert.equal(s.bench.chans.length, 1, 'the launch joined twice')
    assert.ok(!log.some((l) => /join failed|socket closed|channel error/.test(l)), log.join('\n'))
    const up = told.find((x) => x.link === 'connected')
    assert.ok(up && up.at - t0 < 2000, 'the launch never connected')
    assert.ok(!told.some((x) => x.at > up.at && (x.link !== 'connected' || x.down)), `the link dropped after it was up: ${JSON.stringify(told.filter((x) => x.at > up.at))}`)
    assert.equal(s.link.linkState().chosenHost, 'MacBook Pro SG 566')
    assert.equal(s.rig.getState().deviceName, 'FM3')
  })

  /*
   * But a join is waited on only while its channel is being joined. Once it
   * is joined, the join goes on reading the unit for seconds, and a channel
   * lost under those reads (Android cutting it as the app is put away) is
   * joined again by the next turn at once, as 1.87.48 did. A turn that
   * waited on them instead waited out every one of those reads on a channel
   * that was gone: on the bench, NOT CONNECTED for forty seconds after the
   * app came back.
   */
  const FM3_MAC = { name: 'MacBook Pro SG 566', unit: 'FM3', version: '1.87.47', lag: (p) => (/^\/preset\/(blocks|grid)$/.test(p.path) ? 750 : 150) }
  const AM4_PI = { name: 'raspberry pi 3', unit: 'AM4', lag: (p) => (/^\/preset\/(blocks|grid)$/.test(p.path) ? 2500 : 320) }
  /* The socket lost under every channel on it, as Android cuts it when the app is put away: realtime-js says CHANNEL_ERROR. */
  const loseSocket = (s) => {
    s.bench.socket = false
    for (const chan of s.bench.chans.filter((c) => !c.removed)) {
      chan.state = 'errored'
      chan.cb?.('CHANNEL_ERROR', new Error('heartbeat timeout'))
    }
  }
  /* And realtime-js joining again, by itself, every channel it lost. */
  const rejoinSocket = (s) => {
    s.bench.socket = true
    for (const chan of s.bench.chans.filter((c) => !c.removed && c.state === 'errored')) {
      chan.state = 'joined'
      chan.cb?.('SUBSCRIBED')
    }
  }

  test('phone: a channel lost while the launch is still reading the unit is joined again the moment the app is back on screen', async () => {
    const s = await stackOnABench()
    s.bench.computers = [{ ...FM3_MAC }]
    s.link.startLink()
    await s.clock.advance(1000)
    assert.equal(s.link.linkState().link, 'connected', 'the bench never connected')
    s.app.change('background')
    loseSocket(s)
    await s.clock.advance(2000)
    const back = s.clock.now()
    let up = null
    s.link.subscribeLink((st) => {
      if (up === null && st.link === 'connected') up = s.clock.now() - back
    })
    s.app.change('active')
    await s.clock.advance(5000)
    assert.ok(up !== null && up < 1500, `connected ${up === null ? 'never' : `${up} ms`} after the app came back\n${s.lines().join('\n')}`)
  })

  /*
   * And the roll call with it. A channel lost while the launch's roll call
   * was listening leaves a count that never heard the computers out, and
   * only a fresh join counts again (relay.js remoteDisconnect). Waited on
   * instead, the old channel came back by itself with the half-done count
   * kept for the rest of its life: the pick never proved, every write to
   * every computer, both units carrying out the tap.
   */
  test('phone: two computers, the channel lost under the launch’s roll call, then back on screen and back by itself: a scene reaches the pick alone', async () => {
    const s = await stackOnABench({ pick: JSON.stringify({ accounts: { u1: { name: 'raspberry pi 3', many: true } } }) })
    s.bench.computers = [{ ...FM3_MAC }, { ...AM4_PI }]
    s.link.startLink()
    await s.clock.advance(2000)
    s.app.change('background')
    loseSocket(s)
    s.clock.setTimeout(() => rejoinSocket(s), 3000)
    await s.clock.advance(2000)
    s.app.change('active')
    await s.clock.advance(20000)
    const log = s.lines().join('\n')
    assert.equal(s.link.linkState().link, 'connected', log)
    const before = s.bench.computers.map((c) => (c.heard || []).length)
    const wrote = s.device.setScene(2).then(
      () => null,
      (e) => e
    )
    await s.clock.advance(10000)
    assert.equal(await wrote, null, `the scene was refused\n${log}`)
    const heard = s.bench.computers.filter((c, i) => (c.heard || []).slice(before[i]).some((h) => h.path === '/scene')).map((c) => c.name)
    assert.deepEqual(heard, ['raspberry pi 3'], `the scene was carried out by ${heard.join(' and ')}\n${log}`)
    assert.equal(s.link.linkState().chosenHost, 'raspberry pi 3')
    assert.equal(s.rig.getState().deviceName, 'AM4', log)
  })

  /*
   * And with the app on screen, the channel joined again by realtime-js
   * itself (the same channel, so the link never ends): Justin's three
   * computers, the AM4's Pi picked. The count the drop cut short was kept
   * as the link's one count, its proof unanswered and logged as a computer
   * app too old, and from then on every read went to whoever answered first
   * (the header FM3 over the AM4) and a scene to all three computers. The
   * bench of the join review: ONSCREEN=1 WRITE=1 dropmid.mjs 2000 30000 2000.
   */
  test('phone: three computers, the channel lost under the launch’s roll call with the app on screen and joined again by itself: counted again, and a scene reaches the pick alone', async () => {
    const s = await stackOnABench({ pick: JSON.stringify({ accounts: { u1: { name: 'raspberry pi 3', many: true } } }) })
    s.bench.computers = [{ ...FM3_MAC }, { name: 'raspberry pi 5', unit: null, lag: () => 170 }, { ...AM4_PI }]
    s.link.startLink()
    await s.clock.advance(2000)
    loseSocket(s)
    s.clock.setTimeout(() => rejoinSocket(s), 2000)
    await s.clock.advance(28000)
    const log = s.lines().join('\n')
    assert.equal(s.link.linkState().link, 'connected', log)
    assert.equal(s.bench.chans.length, 1, `the bench joined a second channel: this does not test realtime-js's own rejoin\n${log}`)
    assert.match(log, /the link dropped before the count was done: counted again when the link is back/, log)
    assert.match(log, /three computers answered: MacBook Pro SG 566 \(FM3\), raspberry pi 5 \(no unit plugged in\), raspberry pi 3 \(AM4\); driving raspberry pi 3, the one picked under Which unit, addressed/, log)
    assert.ok(!/too old to be asked alone/.test(log), `a proof lost to the drop was logged as an old computer app\n${log}`)
    /* Every read since the link came up was asked of the pick, the drop and the count after it included: the header is the AM4's. */
    for (const c of s.bench.computers.filter((x) => x.name !== 'raspberry pi 3')) {
      const units = (c.heard || []).filter((h) => !['/healthz', '/store/config/host.name', '/telemetry/meters', '/device'].includes(h.path))
      assert.deepEqual(units.map((h) => h.path), [], `${c.name} was asked the unit's reads\n${log}`)
    }
    assert.equal(s.rig.getState().deviceName, 'AM4', log)
    const before = s.bench.computers.map((c) => (c.heard || []).length)
    const wrote = s.device.setScene(2).then(
      () => null,
      (e) => e
    )
    await s.clock.advance(10000)
    assert.equal(await wrote, null, `the scene was refused\n${log}`)
    const heard = s.bench.computers.filter((c, i) => (c.heard || []).slice(before[i]).some((h) => h.path === '/scene')).map((c) => c.name)
    assert.deepEqual(heard, ['raspberry pi 3'], `the scene was carried out by ${heard.join(' and ')}\n${log}`)
  })

  /*
   * The same drop, early enough to take the pick's own answer to the roll
   * call: the count it cut short had not heard the pick, so it let the reads
   * go, and every read made while the link was down or coming back went to
   * whoever answered first. The MacBook's FM3 went up in the header over the
   * Pi 5's "No Fractal device found", the mix the launch no longer shows,
   * until the count owed took it down. Now they wait for that count, and it
   * is taken as the channel is back: the reads that would have heard the
   * computer are the ones held, so /healthz is asked at once.
   */
  test('phone: three computers, the channel lost under the roll call before the pick answered: no read reaches another computer, the header is never another unit, and the count owed is taken as the channel is back', async () => {
    const s = await stackOnABench({ pick: JSON.stringify({ accounts: { u1: { name: 'raspberry pi 3', many: true } } }) })
    s.bench.computers = [{ ...FM3_MAC }, { name: 'raspberry pi 5', unit: null, lag: () => 170 }, { ...AM4_PI }]
    s.link.startLink()
    await s.clock.advance(800)
    const lost = s.clock.now()
    loseSocket(s)
    s.clock.setTimeout(() => rejoinSocket(s), 2000)
    const headers = []
    let driven = null
    for (let i = 0; i < 200; i++) {
      await s.clock.advance(50)
      const named = s.rig.getState().deviceName
      if (named && headers[headers.length - 1] !== named) headers.push(named)
      if (!driven && s.link.linkState().chosenHost === 'raspberry pi 3') driven = s.clock.now() - lost
    }
    const log = s.lines().join('\n')
    assert.match(log, /two computers answered: MacBook Pro SG 566 \(unit not known\), raspberry pi 5 \(unit not known\); the link dropped before the count was done/, `the drop did not take the pick's answer: this does not test it\n${log}`)
    assert.deepEqual(headers, ['AM4'], `another computer's unit went up in the header\n${log}`)
    for (const c of s.bench.computers.filter((x) => x.name !== 'raspberry pi 3')) {
      const reads = (c.heard || []).filter((h) => h.at >= lost && !h.host && !['/healthz', '/store/config/host.name', '/telemetry/meters'].includes(h.path))
      assert.deepEqual(reads.map((h) => h.path), [], `${c.name} answered the unit's reads after the drop\n${log}`)
    }
    assert.ok(driven !== null && driven < 7000, `the count owed was driven ${driven} ms after the drop: more than its own four and a half seconds after the channel was back\n${log}`)
  })

  /*
   * And a count cut short that only comes owed once the channel is back:
   * the pick renamed (on no computer now), a short drop under the launch's
   * roll call, the channel back in 0.3 s and the count ending owed seconds
   * later. Nothing asked whether the computer was there: the turn out was
   * the join, stuck on reads held for the count owed, and /healthz went only
   * when that hold ran out, so Play said NOT CONNECTED and dropped every tap
   * until about 11 s from launch (5.25 s in 1.87.50). The count coming owed
   * asks it at once.
   */
  test('phone: three computers, a count that comes owed after the channel is back asks for the computer at once, and Play is connected as soon as in 1.87.50', async () => {
    const s = await stackOnABench({ pick: JSON.stringify({ accounts: { u1: { name: 'fractalpi', many: true } } }) })
    s.bench.computers = [{ ...FM3_MAC }, { name: 'raspberry pi 5', unit: null, lag: () => 170 }, { ...AM4_PI }]
    s.link.startLink()
    await s.clock.advance(1600)
    loseSocket(s)
    s.clock.setTimeout(() => rejoinSocket(s), 300)
    await s.clock.advance(300)
    const back = s.clock.now()
    let up = null
    for (let i = 0; i < 300 && up === null; i++) {
      await s.clock.advance(50)
      if (s.link.linkState().link === 'connected') up = s.clock.now() - back
    }
    const log = s.lines().join('\n')
    assert.match(log, /the link dropped before the count was done: counted again when the link is back/, `the drop did not cut the count short: this does not test it\n${log}`)
    assert.ok(up !== null && up <= 3500, `Play was connected ${up} ms after the channel was back (1.87.50: 3350)\n${log}`)
  })

  /*
   * Justin's screen of 22 October 2026: the pick, raspberry pi 3, with
   * nothing plugged in, driven at every launch, and the raw "No Fractal
   * device found" card on Play with nothing saying the FM3 was on the
   * MacBook. Now the card says so, the button is Which unit's own pick, and
   * nothing moves until it is pressed.
   */
  test('phone: the pick with no unit, the FM3 on another computer: Play says where it is, nothing moves until the button, and the button is a proved pick', async () => {
    const s = await stackOnABench({ pick: JSON.stringify({ accounts: { u1: { name: 'raspberry pi 3', many: true } } }) })
    const r = await import('../shared/relay-rules.mjs')
    s.bench.computers = [{ ...FM3_MAC }, { name: 'raspberry pi 5', unit: null, lag: () => 170 }, { name: 'raspberry pi 3', unit: null, lag: () => 320 }]
    s.link.startLink()
    await s.clock.advance(12000)
    const log = () => s.lines().join('\n')
    const card = () => r.unitElsewhereCard({ hosts: s.link.linkState().hosts, units: s.link.linkState().units, chosen: s.link.linkState().chosenHost, unitState: s.rig.getState().unit })
    assert.equal(s.link.linkState().chosenHost, 'raspberry pi 3', log())
    assert.equal(s.rig.getState().unit, 'missing', log())
    assert.equal(card()?.words, 'raspberry pi 3 has no unit plugged in. Your FM3 is on MacBook Pro SG 566.', log())
    assert.deepEqual(card().buttons.map((b) => b.label), ['Use the FM3 on MacBook Pro SG 566'])
    /* Never a switch on its own, however long the card is up. */
    await s.clock.advance(30000)
    assert.equal(s.link.linkState().chosenHost, 'raspberry pi 3', 'the phone moved to the computer with the unit by itself')
    const mac = s.bench.computers[0]
    assert.ok(!(mac.heard || []).some((h) => h.path === '/device/detect' || h.path === '/preset'), 'the MacBook was asked the unit’s reads before the button')
    /* The button: Which unit's own pick. A scene tapped during its proof waits for it and reaches the MacBook alone. */
    const before = s.bench.computers.map((c) => (c.heard || []).length)
    const picked = s.link.chooseHost(card().buttons[0].name)
    await s.clock.advance(200)
    const wrote = s.device.setScene(2).then(
      () => null,
      (e) => e
    )
    await s.clock.advance(12000)
    assert.equal(await picked, true, log())
    assert.equal(await wrote, null, log())
    const heard = s.bench.computers.filter((c, i) => (c.heard || []).slice(before[i]).some((h) => h.path === '/scene' && h.host)).map((c) => c.name)
    assert.deepEqual(heard, ['MacBook Pro SG 566'], `the scene was carried out by ${heard.join(' and ')}\n${log()}`)
    assert.ok(!s.bench.computers.some((c, i) => (c.heard || []).slice(before[i]).some((h) => h.path === '/scene' && !h.host)), 'a scene went asked of nobody during the proof')
    assert.equal(s.link.linkState().chosenHost, 'MacBook Pro SG 566')
    assert.equal(s.rig.getState().deviceName, 'FM3', log())
    assert.equal(card(), null, 'the card stayed up over the FM3')
  })

  /*
   * NEVER ONE COMPUTER'S UNIT IN THE HEADER OVER ANOTHER'S CARD. Justin's
   * screenshot: the MacBook's FM3 in the header, its scene 7 lit, a Pi's "No
   * Fractal device found" card and blank pedals, three and a half seconds
   * of it, on the launch whose record held nothing (the 1.87.47 pick never
   * counted since). Now the roll call's first window takes that down to
   * Looking… and the screen waits for the one driven; and with a record
   * that holds, it never appears at all.
   */
  test('phone: three computers at launch, Play shows a mix of two computers no longer than the roll call’s first window, then Looking… until the one driven answers', async () => {
    for (const pick of ['raspberry pi 3', JSON.stringify({ accounts: { u1: { name: 'raspberry pi 3', many: true } } })]) {
      const s = await stackOnABench({ pick })
      const dump = (p) => /^\/preset\/(blocks|grid)$/.test(p.path)
      s.bench.computers = [
        { name: 'MacBook Pro SG 566', unit: 'FM3', lag: (p) => (dump(p) ? 750 : 150) },
        { name: 'raspberry pi 5', unit: null, lag: () => 170 },
        { name: 'raspberry pi 3', unit: null, lag: () => 320 }
      ]
      const t0 = s.clock.now()
      /* Play opening as the launch gate lets go: its own reload (Stage.js reload({ arriving: true })). */
      let mounted = false
      s.link.subscribeLink((st) => {
        if (mounted || st.link !== 'connected') return
        mounted = true
        s.clock.setTimeout(() => s.rig.arrivedCurrent().then((cur) => (cur ? null : s.rig.refreshAll())).catch(() => {}), 150)
      })
      s.link.startLink()
      const seen = []
      for (let i = 0; i < 40; i++) {
        await s.clock.advance(250)
        const r = s.rig.getState()
        seen.push({ at: s.clock.now() - t0, header: r.deviceName, unit: r.unit, card: r.error ? String(r.error) : '', driving: s.link.linkState().chosenHost })
      }
      const log = `${seen.map((x) => `+${x.at} ${x.header || 'Looking…'} ${x.unit} ${x.card.slice(0, 20)} ${x.driving || ''}`).join('\n')}\n${s.lines().join('\n')}`
      /* The roll call began when the computer answered, and its first window is a second and a half. */
      const counted = s.lines().findIndex((l) => /no-answer → connected/.test(l))
      assert.ok(counted !== -1, log)
      const mixed = seen.filter((x) => x.header === 'FM3' && /No Fractal device found/.test(x.card))
      const legacy = pick === 'raspberry pi 3'
      if (!legacy) assert.deepEqual(mixed, [], `a record that holds showed the FM3 over a Pi's card\n${log}`)
      else assert.ok(mixed.every((x) => x.at <= 2250), `the FM3 stayed in the header over a Pi's card past the first window\n${log}`)
      /* Never the FM3 in the header once the count has said which: Looking…, then the one driven, which has none. */
      assert.ok(!seen.some((x) => x.at > 2250 && x.header === 'FM3'), `the FM3 was in the header while another computer was driven\n${log}`)
      const end = seen.at(-1)
      assert.equal(end.driving, 'raspberry pi 3', log)
      assert.equal(end.unit, 'missing', log)
    }
  })

  test('phone: a clean start for a mix on screen takes the header, the card and the preset with it; one for another computer leaves them', async () => {
    const s = await stackOnABench()
    const pedals = [{ slug: 'drv', name: 'Drive 1', effectId: 133, bypassed: false }]
    s.rig.set({ deviceName: 'FM3', unit: 'present', error: 'No Fractal device found on any serial or MIDI port.', errorLink: false, preset: { number: 479, name: 'Nothing Else Matters' }, sceneIndex: 6, sceneNames: ['VERSE'], blocks: pedals, allBlocks: pedals, capabilities: { scenes: 8, presets: { count: 512 } } })
    s.rig.startClean()
    const kept = s.rig.getState()
    assert.deepEqual([kept.deviceName, kept.unit, kept.preset?.number, kept.sceneIndex, kept.sceneNames, kept.blocks.length, kept.capabilities?.scenes], ['FM3', 'present', 479, 6, [], 1, 8])
    s.rig.startClean({ header: true })
    const gone = s.rig.getState()
    assert.deepEqual([gone.deviceName, gone.unit, gone.error, gone.preset, gone.sceneIndex], ['', 'unknown', null, null, 0])
    /* And the other unit's pedals, lit as they were, and what it can do (its eight tiles, "OF 512"), as the browser blanks its stage. */
    assert.deepEqual([gone.blocks, gone.allBlocks, gone.capabilities], [[], [], null], 'Play says Looking… over the other computer’s pedals and slot count')
    /* And "…" for the preset under Looking…, never "Untitled". */
    assert.match(read('mobile/src/screens/Stage.js'), /label=\{\(preset\?\.pending && !preset\?\.name\) \|\| \(!preset && unitState === 'unknown'\) \? '…' : presetLabel\(preset\)\}/, 'Play names the preset not read yet "Untitled"')
    /* link.js takes it down so, told by the relay, and the browser takes its own down from the same news. */
    const link = read('mobile/src/lib/link.js')
    assert.match(link, /subscribeMixed\(\(\) => \{\s*computerChanged\(\)\s*startClean\(\{ header: true \}\)\s*\}\)/)
    const web = read('src/lib/link.js')
    assert.match(web, /subscribeMixed\(\(\) => \{\s*computerChanged\(\)\s*set\(\{ mixedAt: Date\.now\(\) \}\)\s*\}\)/)
    const app = read('src/App.jsx')
    assert.match(app, /mixedRef\.current = link\.mixedAt\s*mixReadOwed\.current = true\s*setDevice\(null\)\s*setStatus\('idle'\)\s*setError\(null\)/)
    /* And read again once the count is in, whatever it chose. */
    assert.match(app, /if \(!mixReadOwed\.current \|\| !link\.countedAt \|\| link\.role !== 'remote'\) return\s*mixReadOwed\.current = false\s*read\(\)/)
    /* And a read that was out when the mix was found puts nothing up. */
    assert.equal(app.match(/if \(mixedRef\.current !== mixAt\) return null/g)?.length, 2)
  })

  test('phone: the units are asked again at once and every ten seconds while the card is up, and not after', async () => {
    const t = await linkOnABench()
    const stop = t.link.watchUnits()
    await t.clock.advance(25000)
    assert.equal(t.bench.unitsAsked, 3, 'the units were not asked again at once and every ten seconds')
    stop()
    await t.clock.advance(30000)
    assert.equal(t.bench.unitsAsked, 3, 'the units were asked after the card went')
  })

  /*
   * A computer that has not said which unit is asked again, alone, with
   * UNIT_ASK_MS, once at a time; Which unit says it is asking meanwhile; and
   * one computer, or every unit known, asks nothing.
   */
  for (const end of ['phone', 'browser']) {
    test(`${end}: a computer that has not said its unit is asked again with longer, one ask at a time`, async () => {
      const t = end === 'phone' ? await linkOnABench() : await webLinkOnABench()
      const { UNIT_ASK_MS } = await import('../shared/relay-rules.mjs')
      t.bench.unitsAsked = 0
      t.bench.unitsAskedWith = []
      t.bench.hosts = ['MacBook Pro SG 566', 'raspberry pi 3']
      t.bench.unitsNow = { 'MacBook Pro SG 566': { model: 'FM3', plugged: true } }
      let give
      t.bench.unitsTake = () => new Promise((go) => (give = go))
      const first = t.link.askUnknownUnits()
      const again = t.link.askUnknownUnits()
      await t.clock.advance(0)
      assert.equal(first, again, 'a second ask went out while the first was out')
      assert.equal(t.bench.unitsAsked, 1)
      assert.deepEqual(t.bench.unitsAskedWith[0], { windowMs: UNIT_ASK_MS, only: ['raspberry pi 3'] })
      assert.equal(t.link.linkState().unitsAsking, true, 'Which unit does not say it is asking')
      t.bench.unitsNow = { ...t.bench.unitsNow, 'raspberry pi 3': { model: 'AM4', plugged: true } }
      give()
      await first
      assert.equal(t.link.linkState().unitsAsking, false)
      assert.deepEqual(t.link.linkState().units['raspberry pi 3'], { model: 'AM4', plugged: true }, 'what it said did not reach Which unit')
      /* Every unit known: nothing asked. One computer: nothing asked. */
      t.bench.unitsTake = null
      await t.link.askUnknownUnits()
      t.bench.hosts = ['raspberry pi 3']
      t.bench.unitsNow = {}
      await t.link.askUnknownUnits()
      assert.equal(t.bench.unitsAsked, 1, 'a computer was asked its unit with nothing to find out')
      assert.equal(t.link.linkState().unitsAsking, false)
    })
  }

  /*
   * TWO COMPUTERS ANSWERING TO ONE NAME are never asked their unit
   * (readUnits: asked by it, both answer), so they are never asked again
   * either: no "Asking it which unit…" under them that cannot end, and no
   * "did not say its unit, asked again for 4 s" in the log about a name
   * nothing asked. A new Pi 5 given the old one's Hostname by Imager.
   */
  for (const end of ['phone', 'browser']) {
    test(`${end}: two computers sharing a name are not asked again, and Which unit never says it is asking about them`, async () => {
      const t = end === 'phone' ? await linkOnABench() : await webLinkOnABench()
      const { UNIT_ASK_MS } = await import('../shared/relay-rules.mjs')
      t.bench.unitsAsked = 0
      t.bench.unitsAskedWith = []
      t.bench.logged = []
      t.bench.hosts = ['raspberry pi 5', 'MacBook Pro SG 566', 'raspberry pi 5']
      t.bench.unitsNow = { 'MacBook Pro SG 566': { model: 'FM3', plugged: true } }
      const asking = []
      const stop = t.link.subscribeLink((st) => asking.push(st.unitsAsking))
      await t.link.askUnknownUnits()
      await t.clock.advance(0)
      assert.equal(t.bench.unitsAsked, 0, 'two computers that share a name were asked again, though neither can be asked alone')
      assert.ok(!asking.includes(true), 'Which unit said it was asking two computers that are never asked')
      assert.equal(t.link.linkState().unitsAsking, false)
      /* A third that has not said is asked, alone; the shared name is not in the ask, nor in the log. */
      t.bench.hosts = ['raspberry pi 5', 'MacBook Pro SG 566', 'raspberry pi 5', 'raspberry pi 3']
      await t.link.askUnknownUnits()
      assert.equal(t.bench.unitsAsked, 1)
      assert.deepEqual(t.bench.unitsAskedWith[0], { windowMs: UNIT_ASK_MS, only: ['raspberry pi 3'] })
      if (end === 'phone') {
        const said = t.bench.logged.filter((l) => /asked again/.test(l))
        assert.deepEqual(said, [`link raspberry pi 3 did not say its unit, asked again for ${UNIT_ASK_MS / 1000} s`], said.join('\n'))
      }
      stop?.()
    })
  }

  /*
   * "How can a user remove old units they aren't connected to." The list is
   * a roll call: a computer leaves it by not answering, and only that
   * computer can stop answering. So under Which unit, the way, in words that
   * are true of the code they describe.
   */
  test('Which unit says how to take a computer off the list, at that computer, true of the computer app', async () => {
    const r = await import('../shared/relay-rules.mjs')
    const app = r.notUsingOne('app')
    const page = r.notUsingOne('page')
    assert.equal(
      app,
      'Not using one of these? On that computer, open Fractal Remote, go to Settings → Phone & computer → Phone remote and press Turn off, or switch that computer off. Then close Fractal Remote here all the way (swipe it away) and open it again: it’s gone from this list. If you had picked it, it says not answering: press Forget. Turn off lasts until someone presses Turn on there.'
    )
    assert.equal(
      page,
      'Not using one of these? On that computer, open Fractal Remote, go to Settings → Phone & computer → Phone remote and press Turn off, or switch that computer off. Then reload this page: it’s gone from this list. If you had picked it, it says not answering: press Forget. Turn off lasts until someone presses Turn on there.'
    )
    for (const words of [app, page]) {
      for (const must of ['On that computer, open Fractal Remote', 'Settings → Phone & computer → Phone remote', 'press Turn off', 'switch that computer off', 'gone from this list', 'press Forget', 'Turn off lasts until someone presses Turn on there.']) {
        assert.ok(words.includes(must), `the line lost "${must}": ${words}`)
      }
      for (const never of [/this phone/i, /sign out/i, /official/i, /grey/i, /Inc\./]) assert.ok(!never.test(words), `${never} in: ${words}`)
    }
    /* Each end its own way to a fresh roll call: the app closed and opened, the page reloaded. Never the other's. */
    assert.ok(app.includes('close Fractal Remote here all the way (swipe it away) and open it again') && !/reload/i.test(app), app)
    assert.ok(page.includes('Then reload this page:') && !/swipe/i.test(page), page)

    /* The words are the computer's: its Settings sheet, its page, the fold, the button, and Turn off kept through a restart. */
    const web = read('src/App.jsx')
    assert.match(web, /title="Settings"/)
    assert.match(web, /link: 'Phone & computer',/, 'the computer’s page is not called Phone & computer: say what it is')
    assert.match(web, /<Section key="phone-remote" title="Phone remote"[\s\S]{0,400}<PhoneRemote /, 'Turn off is not in the Phone remote fold')
    const panel = read('src/components/PhoneRemote.jsx')
    assert.match(panel, /onAction\('mac-off'\)[^>]*>\s*Turn off\s*</)
    assert.match(panel, /onAction\('mac-on'\)[^>]*>\s*Turn on\s*</)
    assert.match(read('src/lib/link.js'), /export async function setMacRemote\(on\)[\s\S]{0,300}writeHostDoc\('remote\.host', \{ wanted: !!on/, 'Turn off is not written down, so a restart undoes it')
    assert.match(read('desktop/lib/host.mjs'), /if \(wanted && wanted\.wanted === false\) \{\s*log\('Phone remote: off — it was turned off in the app\.'\)\s*return \{ on: false, reason: 'turned-off'/, 'the computer app no longer keeps Turn off through a restart')
    /* And a fresh link forgets who answered on the last one (relay.js remoteDisconnect), so one that no longer answers is not listed. */
    for (const file of ['mobile/src/lib/relay.js', 'src/lib/remote.js']) assert.match(read(file), /export async function remoteDisconnect\(\)[\s\S]{0,700}hosts = \[\]/, file)
    /* The pick that did not answer is the one left, grayed, with Forget. */
    assert.deepEqual(r.missingPickRow('raspberry pi 5'), { name: 'raspberry pi 5', label: 'raspberry pi 5 — not answering', forget: 'Forget' })
  })

  /*
   * And under each of two computers with one name, that it is shared: never
   * "Asking it which unit…", which is never going to end.
   */
  test('Which unit says two computers share a name under each, and nothing else moves', async () => {
    const r = await import('../shared/relay-rules.mjs')
    const shared = 'Two computers are called raspberry pi 5, so they can’t be told apart. Switch one off, or give one a new name and restart it.'
    assert.equal(r.sharedName('raspberry pi 5'), shared)
    assert.deepEqual(r.onceNames(['raspberry pi 5', 'MacBook Pro SG 566', 'raspberry pi 5', 'raspberry pi 3']), ['MacBook Pro SG 566', 'raspberry pi 3'])
    assert.deepEqual(r.onceNames([]), [])
    const hosts = ['raspberry pi 5', 'MacBook Pro SG 566', 'raspberry pi 5', 'raspberry pi 3']
    const units = { 'MacBook Pro SG 566': { model: 'FM3', plugged: true } }
    for (const asking of [false, true]) {
      const rows = r.unitChoices(hosts, units, 'MacBook Pro SG 566', asking)
      assert.deepEqual(
        rows.map((x) => [x.name, x.label, x.detail, x.on]),
        [
          ['MacBook Pro SG 566', 'FM3', 'on MacBook Pro SG 566', true],
          ['raspberry pi 5', 'raspberry pi 5', shared, false],
          ['raspberry pi 5', 'raspberry pi 5', shared, false],
          ['raspberry pi 3', 'raspberry pi 3', r.unitNotSaid(asking), false]
        ]
      )
      assert.equal(new Set(rows.map((x) => x.key)).size, rows.length, 'two rows share a key')
    }
    /* With no name heard twice, exactly as 1.87.52 had it. */
    const before = (hostNames = [], units = {}, chosen = null, asking = false) => {
      const rows = hostNames.map((name, i) => {
        const unit = units?.[name] || null
        return { name, key: `${name}-${i}`, label: unit ? (unit.plugged ? unit.model : 'No unit plugged in') : name, detail: unit ? `on ${name}` : r.unitNotSaid(asking), plugged: Boolean(unit?.plugged), on: name === chosen }
      })
      return [...rows.filter((x) => x.plugged), ...rows.filter((x) => !x.plugged)]
    }
    const cases = [
      [[], {}, null, false],
      [['raspberry pi 5', 'MacBook Pro SG 566', 'raspberry pi 3'], { 'raspberry pi 5': { model: 'FM3', plugged: false }, 'MacBook Pro SG 566': { model: 'FM3', plugged: true }, 'raspberry pi 3': { model: 'AM4', plugged: true } }, 'raspberry pi 3', false],
      [['Old Mac', 'MacBook Pro'], { 'MacBook Pro': { model: 'FM3', plugged: true } }, null, true],
      [['Old Mac', 'MacBook Pro'], {}, 'Old Mac', false]
    ]
    for (const args of cases) assert.deepEqual(r.unitChoices(...args), before(...args), JSON.stringify(args))
  })

  test('a computer that has not said its unit is asked again once the count is done and whenever Which unit opens', () => {
    const phone = read('mobile/src/lib/link.js')
    assert.match(phone.slice(phone.indexOf('async function afterCount(')), /await refreshAll\(\)\n\s*\/\*[^*]*\*\/\n\s*askUnknownUnits\(\)\n\s*\} catch/, 'the phone does not ask again after the count')
    const web = read('src/lib/link.js')
    assert.match(web.slice(web.indexOf('async function afterCount(')), /quietMeters\(\)\n\s*\}\n\s*\/\*[^*]*\*\/\n\s*askUnknownUnits\(\)\n\s*\} catch/, 'the browser does not ask again after the count')
    /* Not when the count was cut short: it is taken again, and asks its own. */
    for (const src of [phone, web]) {
      const after = src.slice(src.indexOf('async function afterCount('))
      assert.ok(after.indexOf('return countIfDue()') < after.indexOf('askUnknownUnits()'), 'a count cut short asks the units it never finished')
    }
    const sheet = read('mobile/src/components/LiveUnit.js')
    assert.match(sheet, /useEffect\(\(\) => \{\s*if \(open\) askUnknownUnits\(\)\s*\}, \[open\]\)/)
    assert.match(read('mobile/App.js'), /<LiveUnit[\s\S]{0,300}asking=\{link\.unitsAsking\}/)
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /if \(page !== 'link' \|\| remoteHosts\(\)\.length < 2\) return undefined[\s\S]{0,300}askUnknownUnits\(\)\.finally\(/)
    const app = read('src/App.jsx')
    assert.match(app, /const whichUnitShown = sheet === 'units' \|\| \(sheet === 'settings' && setupPage === 'link'\)\s*useEffect\(\(\) => \{\s*if \(whichUnitShown\) askUnknownUnits\(\)\s*\}, \[whichUnitShown\]\)/)
    assert.equal(app.match(/unitChoices\(link\.hosts, link\.units, link\.chosenHost, link\.unitsAsking\)/g)?.length, 2, 'a Which unit list on the website does not say it is asking')
  })

  /*
   * The count owed is taken the moment the computer answers on the channel
   * that came back, even with the join that took the one cut short still
   * reading the unit: writes wait for it. Left to the end of the join (a Pi
   * 3's chain dumps, ten seconds on the bench), every tap in between was
   * dropped.
   */
  test('phone: a count cut short by a drop is taken again at once, inside the join that took it, and the unit read off the pick then is not read again', async () => {
    const t = await linkOnABench()
    t.bench.many = true
    let counts = 0
    t.bench.census = async () => {
      counts += 1
      t.bench.countOwed = counts === 1
      t.bench.hosts = ['MacBook Pro SG 566', 'raspberry pi 3']
      t.bench.chosen = counts === 1 ? null : 'raspberry pi 3'
      t.bench.askedOf = counts === 1 ? null : 'raspberry pi 3'
    }
    t.bench.countDue = () => t.bench.countOwed === true
    t.link.startLink()
    await t.clock.advance(5000)
    const order = t.bench.order.filter((x) => ['census', 'refreshAll', 'startClean'].includes(x))
    assert.equal(counts, 2, 'the count cut short was not taken again')
    assert.deepEqual(t.bench.censusOptions, [null, { late: true }])
    assert.deepEqual(order.slice(0, 2), ['census', 'census'], `the count owed waited for the join to finish reading: ${order.join(', ')}`)
    /* Every read was the pick's, and the unit was read off it: not read again from a clean start for the count owed. */
    assert.equal(order.filter((x) => x === 'refreshAll').length, 1, order.join(', '))
    assert.ok(!order.includes('startClean'), order.join(', '))
  })

  /*
   * A turn that waited on another's join leaves the rest to that turn: the
   * reads after it, and the next turn's time. Each scheduled its own, and
   * the backoff went up twice for one failed join, so a tap on Look again
   * (or the app back on screen) during a join that failed put the next try
   * three seconds later than nobody tapping would have.
   */
  test('phone: back on screen during a join that fails leaves the next try where it was', async () => {
    const t = await linkOnABench()
    t.bench.joinMs = 450
    t.bench.canJoin = false
    t.link.startLink()
    await t.clock.advance(134)
    t.app.change('active')
    await t.clock.advance(450 - 134 + 1)
    assert.equal(t.bench.joins, 1, 'back on screen began a second join')
    t.bench.canJoin = true
    /* Failed at 450 ms: tried again three seconds on, as with no tap, and joined 450 ms after that. */
    await t.clock.advance(3000)
    assert.equal(t.bench.joins, 2, 'the next try after the failed join came late')
    await t.clock.advance(1000)
    assert.equal(t.link.linkState().link, 'connected')
  })

  /*
   * App.js stops the link and starts it again when the demo or Bluetooth
   * flips. Stopped during the first join, that join ends as replaced, and
   * the turn that was waiting on it belongs to the loop that stopped: it
   * goes without a word to the loop that started, whose first turn it used
   * to put three seconds back.
   */
  test('phone: the link stopped and started again during the launch’s join joins at once, and stays joined', async () => {
    const s = await stackOnABench()
    s.bench.computers = [{ ...FM3_MAC }]
    s.link.startLink()
    await s.clock.advance(100)
    s.link.stopLink()
    s.link.startLink()
    const restarted = s.clock.now()
    const told = []
    s.link.subscribeLink((st) => told.push({ at: s.clock.now() - restarted, link: st.link, down: st.down }))
    await s.clock.advance(20000)
    const log = s.lines().join('\n')
    const up = told.find((x) => x.link === 'connected')
    assert.ok(up && up.at < 1500, `connected ${up ? `${up.at} ms` : 'never'} after the restart\n${log}`)
    assert.ok(!told.some((x) => x.at > up.at && (x.link !== 'connected' || x.down)), `the link dropped after it was up\n${log}`)
    assert.equal(s.bench.disconnects, 0, `the phone closed the socket\n${log}`)
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
    assert.match(links, /if \(next\.role !== was\.role\) setTapsRelayed\(next\.role === 'remote'\)/)
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
   * "The same names are not showing up again at all. on the AM4" (Justin, 21
   * October 2026, a Raspberry Pi 3). The browser's AM4 names came only from
   * the stored slot's dump, which that Pi cut short every time. The
   * computer's structure read carries the loaded preset's names with its
   * name (ForgeFX 296a1ac): asked before the dump, believed only under the
   * preset on screen, and with anything less the dump is asked as before.
   * The phone's rule (test/mobile.mjs), run on the browser's own driver.
   */
  test('browser: an AM4’s scene names come off its loaded preset through the computer, only when it is the preset on screen', async () => {
    const KORN = ['FREAK ON A LEASH', 'BLIND', 'FALLING AWAY', 'GOT THE LIFE']
    const bench = async (unit, grid) => {
      const { ffx, relay } = await forgefxOnABench()
      relay.answer = async (path) => {
        if (path === '/device/detect') return { connected: true, name: unit, short: unit, capabilities: { scenes: 4, slotModel: 'linear' } }
        if (path === '/device') return {}
        if (path === '/presets/53/summary') throw Object.assign(new Error('unsupported'), { status: 501 })
        if (path === '/preset/grid') return grid()
        if (path === '/presets/53/scenes') return { number: 53, names: ['STORED', '', '', ''] }
        return null
      }
      await ffx.detect()
      relay.handed.length = 0
      const asked = (p) => relay.handed.filter((h) => h.path === p).length
      return { ffx, relay, asked }
    }
    const shown = (name) => ({ shown: () => name })

    /* The loaded preset is the one on screen: its names, and no dump. */
    const here = await bench('AM4', () => ({ name: 'Recto 1', scenes: [...KORN], cells: [] }))
    assert.deepEqual(await here.ffx.readSceneNames(53, shown('Recto 1')), KORN)
    assert.equal(here.asked('/presets/53/scenes'), 0, 'the stored slot was dumped for names the computer had')
    assert.equal(here.asked('/preset/grid'), 1)
    assert.ok(here.ffx.sceneNameTrace.includes('loaded: found names'))
    /* Kept on the computer for the slot, as every route that finds names does (not awaited by the read). */
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
    assert.ok(here.relay.handed.some((h) => h.path === '/store/config/scene-names-am4%3A53' && h.method === 'PUT'), 'the names were not kept on the computer')

    /* Another preset (the last song), an older computer, every scene blank, no name to go on, a refused read: the dump, as before. */
    for (const [why, grid, name] of [
      ['another preset', () => ({ name: 'Bad Wolf Rising LM', scenes: [...KORN] }), 'Recto 1'],
      ['a computer app from before 1.87.47', () => ({ name: 'Recto 1', scenes: [] }), 'Recto 1'],
      ['every scene blank', () => ({ name: 'Recto 1', scenes: ['', '', '', ''] }), 'Recto 1'],
      ['no name on screen yet', () => ({ name: 'Recto 1', scenes: [...KORN] }), undefined],
      ['a refused read', () => { throw Object.assign(new Error('unsupported'), { status: 501 }) }, 'Recto 1']
    ]) {
      const b = await bench('AM4', grid)
      assert.deepEqual(await b.ffx.readSceneNames(53, shown(name)), ['STORED', '', '', ''], `${why}: not the stored slot’s names`)
      assert.equal(b.asked('/presets/53/scenes'), 1, `${why}: the slot was not read as before`)
    }

    /* Not an AM4, or asked without the preset on screen: the loaded read is never asked. */
    const fm3 = await bench('FM3', () => ({ name: 'Recto 1', scenes: [...KORN] }))
    await fm3.ffx.readSceneNames(53, shown('Recto 1'))
    assert.equal(fm3.asked('/preset/grid'), 0, 'an FM3’s name read asked the loaded preset')
    const blind = await bench('AM4', () => ({ name: 'Recto 1', scenes: [...KORN] }))
    await blind.ffx.readSceneNames(53)
    assert.equal(blind.asked('/preset/grid'), 0)

    /*
     * Two slots holding presets of the same name are the one case the name
     * cannot see. A computer that says which slot its read is of is believed
     * on the number too: another slot's is the stored slot read, whatever the
     * name (none says it yet: ForgeFX's grid leaves the location out).
     */
    const twin = await bench('AM4', () => ({ name: 'Recto 1', number: 54, scenes: [...KORN], cells: [] }))
    assert.deepEqual(await twin.ffx.readSceneNames(53, shown('Recto 1')), ['STORED', '', '', ''], 'a same-named preset in another slot gave this one its names')
    assert.equal(twin.asked('/presets/53/scenes'), 1)
    const said = await bench('AM4', () => ({ name: 'Recto 1', number: 53, scenes: [...KORN], cells: [] }))
    assert.deepEqual(await said.ffx.readSceneNames(53, shown('Recto 1')), KORN)
    assert.equal(said.asked('/presets/53/scenes'), 0)

    /*
     * The preset on screen moved on while the grid was read: the read stops
     * there, as the phone's does, rather than dumping the slot just left at
     * a unit loading the next one. Its answer would only be dropped.
     */
    let here2 = true
    const moved = await bench('AM4', () => {
      here2 = false
      return { name: 'Recto 1', scenes: [...KORN], cells: [] }
    })
    assert.equal(await moved.ffx.readSceneNames(53, { shown: () => (here2 ? 'Recto 1' : undefined), still: () => here2 }), null)
    assert.equal(moved.asked('/presets/53/scenes'), 0, 'the slot just left was dumped after the preset on screen moved on')
    assert.ok(!moved.relay.handed.some((h) => /^\/preset\/backup/.test(h.path)), 'the slot just left was backed up after the preset on screen moved on')
    assert.ok(moved.ffx.sceneNameTrace.includes('the preset on screen moved on: the slot is not read'))
    /* Any unit: after its summary, not on to the slot. Still on screen: on, as before. */
    const fm3moved = await bench('FM3', () => ({ name: 'Recto 1', scenes: [...KORN] }))
    assert.equal(await fm3moved.ffx.readSceneNames(53, { shown: () => undefined, still: () => false }), null)
    assert.equal(fm3moved.asked('/presets/53/summary'), 1)
    assert.equal(fm3moved.asked('/presets/53/scenes'), 0)
    const stays = await bench('AM4', () => ({ name: 'Recto 1', scenes: [], cells: [] }))
    assert.deepEqual(await stays.ffx.readSceneNames(53, { shown: () => 'Recto 1', still: () => true }), ['STORED', '', '', ''])

    /* And the store asks what is on screen when the answer lands, and drops an answer for a preset already left (test/run.mjs). */
    const ds = read('src/lib/deviceState.js').replace(/\s+/g, ' ')
    assert.match(ds, /const shown = \(\) => \(state\.preset\?\.number === number \? state\.preset\?\.name : undefined\)/)
    assert.match(ds, /const found = await driver\.readSceneNames\(number, \{ shown, still \}\) \/\*[^*]*\*\/ if \(!still\(\)\) return/)
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
    const turn = phone.slice(phone.indexOf('async function turn(gen)'), phone.indexOf('async function join(gen)'))
    assert.match(turn, /\n {2}if \(running\) quietMeters\(\)\n/, 'the phone’s loop never says it again')
    const join = phone.slice(phone.indexOf('async function join(gen)'), phone.indexOf('async function countHosts()'))
    assert.ok(join.indexOf('quietMeters()') > join.indexOf('await hostResponds()') && join.indexOf('quietMeters()') < join.indexOf('countHosts()'), 'the phone says it after the roll call has begun holding writes, or not at join at all')
    /*
     * And the roll call begins before the computer's name is read on an account that may have two: a tap made while
     * that read was out went to both units. Every other goes in 1.87.47's order, the name first: one whose last count
     * heard one, one never counted, one whose record is not off the disk yet.
     */
    assert.match(
      join,
      /if \(!remoteMayBeTwo\(\)\) \{\s*await readMacName\(\)\s*quietMeters\(\)\s*countHosts\(\)\s*\} else \{\s*quietMeters\(\)\s*countHosts\(\)\s*await readMacName\(\)\s*\}/,
      'the phone reads the computer’s name before the roll call holds writes, on an account that may have two'
    )
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

  /* ------------------------------------------------------------------ */
  /* Two computers on one account, at launch (1.87.48)                    */
  /* ------------------------------------------------------------------ */

  /*
   * Justin's rig: "fractalpi" (a Pi 5 with the FM3) and "raspberry pi 3"
   * (the AM4), both signed in to one account, the AM4 picked under Which
   * unit. The FM3's answers came first, and for the first few seconds of
   * every launch the phone was on the FM3. Each computer here answers what
   * is asked of nobody in particular and what is asked of it by name.
   */
  const computer = (name, model, { plugged = true, lag = 40, quiet = false, old = false } = {}) => ({
    name,
    lag,
    /* `old`: a computer app too old to know names, which answers whatever name was asked. */
    old,
    reply: (p) => {
      if (p.path === '/store/config/host.name') return { data: { name, version: '1.87.48' } }
      /* `quiet`: never says which unit it has, as a computer too slow for the roll call's window. */
      if (quiet && (p.path === '/healthz' || p.path === '/device')) return 'silent'
      if (p.path === '/healthz') return { ok: plugged, device: 'FM3' }
      if (p.path === '/device') return plugged ? { model } : {}
      if (p.path === '/device/detect') return { connected: plugged, name: model, short: model }
      if (p.path === '/tempo') return { bpm: model === 'FM3' ? 180 : 0 }
      return { ok: true, from: name }
    }
  })
  const PI5 = (opts = {}) => computer('fractalpi', 'FM3', { lag: 40, ...opts })
  const PI3 = (opts = {}) => computer('raspberry pi 3', 'AM4', { lag: 300, ...opts })
  /* Every request that went, by path, with whom it was asked of: '' for nobody in particular. */
  const sentOf = (bench, path) => bench.sent.filter((s) => s.msg.payload.path === path).map((s) => s.msg.payload.host ?? '')
  /* When the first request for a path went, on the bench clock. */
  const sentAt = (bench, path) => bench.sent.find((s) => s.msg.payload.path === path)?.at
  /* Writes, as the computers saw them: never one asked of nobody while two answer. */
  const writes = (bench) => bench.sent.filter((s) => s.msg.payload.method !== 'GET').map((s) => [s.msg.payload.path, s.msg.payload.host ?? ''])
  /* The roll call on the bench's clock. */
  const counted = (t) => t.watch(t.relay.censusHosts({ windowMs: 1500, sleep: (ms) => new Promise((go) => t.clock.setTimeout(go, ms)) }))
  /* A link of its own, the account's record kept: what the next launch is. */
  const newLink = async (t) => {
    await t.relay.remoteDisconnect()
    await t.relay.remoteConnect()
    await t.clock.advance(0)
    t.bench.sent.length = 0
  }

  for (const end of ['phone', 'web']) {

    test(`${end}: two computers at launch, one picked before: no read goes to whoever answers first, and no write to both`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const { bench, clock, relay, watch, tap } = t
      bench.computers = [PI5(), PI3()]
      /* A read the Play screen makes the moment the link is up, before the roll call has begun. */
      const early = watch(relay.remoteRequest('/device/detect'))
      await clock.advance(200)
      assert.deepEqual(sentOf(bench, '/device/detect'), [], 'a read went before the roll call had found the computer picked')
      const census = counted(t)
      await clock.advance(0)
      const began = clock.now()
      const during = watch(relay.remoteRequest('/tempo'))
      const pressed = watch(tap())
      /* The FM3's computer answers the roll call first, at 40 ms: not the pick, and nothing goes. */
      await clock.advance(200)
      assert.deepEqual([...sentOf(bench, '/device/detect'), ...sentOf(bench, '/tempo')], [], 'a read went to whoever answers first')
      /* The pick's own answer, at 300 ms: reads go to it by name then, not at the end of the window. */
      await clock.advance(200)
      assert.deepEqual(sentOf(bench, '/device/detect'), ['raspberry pi 3'], 'the held read was not asked of the computer picked')
      assert.deepEqual(sentOf(bench, '/tempo'), ['raspberry pi 3'])
      assert.ok(sentAt(bench, '/device/detect') - began < 400, `the held read waited ${sentAt(bench, '/device/detect') - began} ms, past the pick's own answer`)
      assert.equal(census.done, false, 'the count was over before the first reads went: this does not test the hold')
      await clock.advance(5000)
      assert.equal(census.done, true)
      assert.equal(early.value?.short, 'AM4', 'the first read of the unit was answered by the FM3’s computer')
      /* The AM4's computer answers bpm 0 here: it is the AM4's answer, and the rig keeps its last figure for it (shared/tempo heardTempo). */
      assert.deepEqual(during.value, { bpm: 0 })
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3')
      assert.equal(relay.remoteReadsAskedOf(), 'raspberry pi 3', 'every read was asked of the pick, and link.js would read the unit again for nothing')
      /* The tap made in the count waited for it and was dropped at its deadline, as ever; nothing went to both. */
      assert.equal(pressed.error?.notSent, true)
      assert.deepEqual(writes(bench), [], 'a write went during the roll call')
      /* And after it, a tap goes to the pick alone. */
      const after = watch(tap())
      await clock.advance(400)
      assert.equal(after.done && !after.error, true, after.error?.message)
      assert.deepEqual(writes(bench), [['/scene', 'raspberry pi 3']])
      assert.equal(keptFor(t.store, end)?.many, true, 'the count of two was not written down for the next launch')
    })

    test(`${end}: one computer and nothing picked: reads go at once and unaddressed, exactly as before`, async () => {
      const { bench, clock, relay, watch } = await relayOnABench(end)
      bench.computers = [computer('Studio', 'FM3')]
      const sleep = (ms) => new Promise((go) => clock.setTimeout(go, ms))
      const census = watch(relay.censusHosts({ windowMs: 1500, sleep }))
      await clock.advance(0)
      const t0 = clock.now()
      const r = watch(relay.remoteRequest('/preset'))
      await clock.advance(0)
      const sent = bench.sent.find((x) => x.msg.payload.path === '/preset')
      assert.ok(sent, 'a read on a one-computer account was held')
      assert.equal(sent.at, t0, `a read on a one-computer account waited ${sent.at - t0} ms`)
      assert.deepEqual(Object.keys(sent.msg.payload).sort(), ['body', 'id', 'method', 'path'], 'a read on a one-computer account was addressed')
      await clock.advance(100)
      assert.equal(r.done && !r.error, true)
      await clock.advance(3000)
      assert.equal(census.done, true)
      assert.deepEqual(relay.remoteHosts(), ['Studio'])
      assert.equal(relay.remoteChosenHost(), null, 'one computer was chosen, and its requests addressed')
      /* Only the name was asked: one computer is never asked which unit it has, and nothing more is sent. */
      assert.deepEqual([...new Set(bench.sent.map((x) => x.msg.payload.path))], ['/store/config/host.name', '/preset'])
    })

    /*
     * ONE COMPUTER, WITH A PICK LEFT OVER FROM WHEN THERE WERE TWO: nothing
     * slower and nothing different once a count of one has been seen. A pick
     * that is the one computer answering, and a pick that is not there at all.
     */
    for (const picked of ['Studio', 'Old Mac']) {
      test(`${end}: one computer, "${picked}" picked when there were two, and a count of one since: reads go at once and unaddressed`, async () => {
        const t = await relayOnABench(end, { picked, many: false })
        const { bench, clock, relay, watch, store } = t
        bench.computers = [computer('Studio', 'FM3')]
        /* The Play screen's read the moment the link is up, and refreshAll's once the count has begun. */
        const t0 = clock.now()
        watch(relay.remoteRequest('/device/detect'))
        await clock.advance(0)
        const census = counted(t)
        await clock.advance(0)
        watch(relay.remoteRequest('/preset'))
        await clock.advance(0)
        for (const path of ['/device/detect', '/preset']) {
          const sent = bench.sent.find((x) => x.msg.payload.path === path)
          assert.ok(sent, `${path} was held for a computer that is not the only one`)
          assert.equal(sent.at, t0, `${path} waited ${sent.at - t0} ms on an account of one computer`)
          assert.equal(sent.msg.payload.host, undefined, `${path} was addressed on an account of one computer`)
        }
        await clock.advance(3000)
        assert.equal(census.done, true)
        assert.equal(relay.remoteChosenHost(), null)
        assert.ok(!store.logged.some((line) => /did not answer|two computers/.test(line)), `the log names a computer this account does not have: ${store.logged.join(' | ')}`)
      })
    }

    test(`${end}: an account of two with only the pick switched on waits only for the pick's own answer, and the next launch not at all`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const { bench, clock, relay, watch, store } = t
      bench.computers = [PI3({ lag: 40 })]
      const census = counted(t)
      await clock.advance(0)
      const began = clock.now()
      watch(relay.remoteRequest('/preset'))
      await clock.advance(100)
      assert.ok(sentAt(bench, '/preset') - began <= 60, `the read waited ${sentAt(bench, '/preset') - began} ms for a pick that had answered in 40`)
      await clock.advance(2000)
      assert.equal(census.done, true)
      assert.deepEqual(relay.remoteHosts(), ['raspberry pi 3'])
      assert.equal(keptFor(store, end)?.many, false, 'a count of one was not written down')
      /* The next launch: one computer counted last time, so nothing waits, and nothing is addressed. */
      await newLink(t)
      const t1 = clock.now()
      watch(relay.remoteRequest('/preset'))
      await clock.advance(0)
      assert.equal(sentAt(bench, '/preset'), t1, 'an account back to one computer still waits at launch')
      assert.deepEqual(sentOf(bench, '/preset'), [''])
    })

    test(`${end}: the pick with no unit plugged in is still the one driven, and the log says it has none`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const { bench, clock, relay, store } = t
      bench.computers = [PI5(), PI3({ plugged: false })]
      const census = counted(t)
      await clock.advance(6000)
      assert.equal(census.done, true)
      /* Never handed to the other unit: nothing would hand the taps back when the pick's unit came on. */
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3', 'the taps went to the other unit')
      assert.equal(keptFor(store, end)?.name, 'raspberry pi 3', 'the pick was forgotten')
      assert.ok(
        store.logged.some((line) => line.includes('raspberry pi 3 (no unit plugged in); driving raspberry pi 3, the one picked under Which unit, addressed')),
        store.logged.join(' | ')
      )
      /* A pick that is merely slow to say which unit it has is the one driven too. */
      const slow = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      slow.bench.computers = [PI5(), PI3({ quiet: true })]
      const again = counted(slow)
      await slow.clock.advance(6000)
      assert.equal(again.done, true)
      assert.equal(slow.relay.remoteChosenHost(), 'raspberry pi 3', 'the pick was left on a timeout')
    })

    test(`${end}: a pick that did not answer holds reads to the end of the count; one computer then is only the first window`, async () => {
      const t = await relayOnABench(end, { picked: 'Old Mac', many: true })
      const { bench, clock, relay, watch, store } = t
      bench.computers = [PI5(), PI3()]
      const census = counted(t)
      await clock.advance(0)
      const r = watch(relay.remoteRequest('/preset'))
      await clock.advance(4000)
      assert.deepEqual(sentOf(bench, '/preset'), [], 'a read went before the count said where')
      await clock.advance(1500)
      assert.equal(census.done, true)
      /* Nobody picked among these two: the first with a unit (firstUnitHost), and the held read asked of it. */
      assert.equal(relay.remoteChosenHost(), 'fractalpi')
      assert.deepEqual(sentOf(bench, '/preset'), ['fractalpi'])
      await clock.advance(400)
      assert.equal(r.done && !r.error, true)
      assert.ok(store.logged.some((line) => line.includes('Old Mac, the one picked under Which unit, did not answer')), store.logged.join(' | '))
      /* The same old pick, with one computer answering now: held for the first window, then as it always went. */
      const one = await relayOnABench(end, { picked: 'Old Mac', many: true })
      one.bench.computers = [computer('Studio', 'FM3')]
      const t0 = one.clock.now()
      const first = counted(one)
      await one.clock.advance(0)
      one.watch(one.relay.remoteRequest('/preset'))
      await one.clock.advance(1400)
      assert.deepEqual(sentOf(one.bench, '/preset'), [])
      await one.clock.advance(400)
      assert.deepEqual(sentOf(one.bench, '/preset'), [''], 'one computer answering, and the read was not let go after the first window')
      assert.ok(sentAt(one.bench, '/preset') - t0 < 1600)
      await one.clock.advance(2000)
      assert.equal(first.done, true)
      /* And from the next launch, nothing waits: one computer was counted. */
      await newLink(one)
      const t1 = one.clock.now()
      one.watch(one.relay.remoteRequest('/preset'))
      await one.clock.advance(0)
      assert.equal(sentAt(one.bench, '/preset'), t1, 'a pick left over from two computers held the next launch too')
    })

    test(`${end}: no read waits past six seconds from when it was made, a count that starts late included, and one let go so is read again`, async () => {
      const t = await relayOnABench(end, { picked: 'Old Mac', many: true })
      const { bench, clock, relay, watch } = t
      bench.computers = [PI5(), PI3()]
      /* The Play screen's read as the link comes up; the first /healthz is slow, and the count begins five seconds on. */
      const t0 = clock.now()
      watch(relay.remoteRequest('/preset'))
      await clock.advance(5000)
      const census = counted(t)
      await clock.advance(100)
      /* And one made as the count begins: the hold is not made longer for it. */
      watch(relay.remoteRequest('/tempo'))
      await clock.advance(1100)
      const at = sentAt(bench, '/preset')
      assert.ok(at, 'the read was still held six seconds on')
      assert.ok(at - t0 > 4000 && at - t0 <= 6000, `the read went ${at - t0} ms after it was made`)
      assert.deepEqual(sentOf(bench, '/preset'), [''], 'a read let go by the end of its hold was asked of somebody')
      assert.ok(sentAt(bench, '/tempo') - t0 <= 6000, 'the count that began late held reads for six seconds more: the hold outlasted six seconds')
      await clock.advance(4000)
      assert.equal(census.done, true)
      /* It went to nobody in particular: link.js reads the unit again off the one driven. */
      assert.equal(relay.remoteReadsAskedOf(), null)
    })

    test(`${end}: a read asked of the pick is not taken for the pick's when another computer there is too old to know names`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const { bench, clock, relay, watch } = t
      bench.computers = [PI5({ old: true }), PI3()]
      const census = counted(t)
      await clock.advance(0)
      const r = watch(relay.remoteRequest('/device/detect'))
      await clock.advance(6000)
      assert.equal(census.done, true)
      assert.deepEqual(sentOf(bench, '/device/detect'), ['raspberry pi 3'])
      /* The old one answered it too, first: nothing proved it was the pick's. */
      assert.equal(r.value?.short, 'FM3')
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3')
      assert.equal(relay.remoteReadsAskedOf(), null, 'what the old computer answered was kept as the pick’s')
    })

    test(`${end}: the pick is the account's: another account signed in on the same ${end === 'phone' ? 'phone' : 'browser'} never waits for it, nor logs it`, async () => {
      const t = await relayOnABench(end, { picked: 'fractalpi', many: true })
      const { bench, clock, relay, watch, store } = t
      await relay.signOut()
      bench.uid = 'u2'
      if (end === 'phone') await relay.restoreSession()
      else await relay.restoreSession({})
      await relay.remoteConnect()
      await clock.advance(0)
      bench.sent.length = 0
      bench.computers = [computer('Studio', 'FM3')]
      const t0 = clock.now()
      watch(relay.remoteRequest('/preset'))
      await clock.advance(0)
      const census = counted(t)
      await clock.advance(3000)
      assert.equal(census.done, true)
      assert.equal(sentAt(bench, '/preset'), t0, 'another account’s pick held this one’s reads')
      assert.deepEqual(sentOf(bench, '/preset'), [''])
      assert.ok(!store.logged.some((line) => line.includes('fractalpi')), `another account’s computer is in this one’s log: ${store.logged.join(' | ')}`)
      /* And the first account's is still its own when it signs back in. */
      await relay.signOut()
      bench.uid = 'u1'
      if (end === 'phone') await relay.restoreSession()
      else await relay.restoreSession({})
      await relay.remoteConnect()
      await clock.advance(0)
      bench.sent.length = 0
      watch(relay.remoteRequest('/preset'))
      await clock.advance(100)
      assert.deepEqual(sentOf(bench, '/preset'), [], 'the first account’s pick was lost at the sign-out')
    })

    test(`${end}: the one pick 1.87.47 kept for the whole ${end === 'phone' ? 'phone' : 'browser'} becomes the account's, and the launch that finds it waits for nothing`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', legacy: true })
      const { bench, clock, relay, watch, store } = t
      assert.equal(keptFor(store, end)?.name, 'raspberry pi 3', 'the old pick was not taken for the account')
      assert.notEqual(store.kept[PICK_KEY[end]], 'raspberry pi 3', 'the old pick was left for the next account to find')
      bench.computers = [PI5(), PI3()]
      const t0 = clock.now()
      watch(relay.remoteRequest('/preset'))
      await clock.advance(0)
      assert.equal(sentAt(bench, '/preset'), t0, 'a pick never counted on this version held the launch')
      const census = counted(t)
      await clock.advance(6000)
      assert.equal(census.done, true)
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3')
      assert.equal(keptFor(store, end)?.many, true)
    })

    test(`${end}: a tap before the first count, on an account of two with a pick, is never sent to both`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const { bench, clock, watch, tap } = t
      bench.computers = [PI5(), PI3()]
      /* The link is up and nothing is counted yet: Android back on screen, the name read still out. */
      const pressed = watch(tap())
      await clock.advance(1000)
      assert.deepEqual(writes(bench), [], 'a tap went before the roll call, to both units')
      assert.equal(pressed.done, false, 'the tap was dropped at once rather than held for the count')
      /* The count begins inside its deadline, and outlasts it: dropped, as any tap the count holds. */
      counted(t)
      await clock.advance(6000)
      assert.equal(pressed.error?.notSent, true)
      assert.deepEqual(writes(bench), [], 'a tap went to both units')
      /* One computer counted last time: a tap before the count goes at once, as it always did. */
      const one = await relayOnABench(end, { picked: 'raspberry pi 3', many: false })
      one.bench.computers = [computer('Studio', 'FM3')]
      const t0 = one.clock.now()
      const sent = one.watch(one.tap())
      await one.clock.advance(100)
      assert.equal(sent.done && !sent.error, true, sent.error?.message)
      assert.equal(one.bench.sent.find((x) => x.msg.payload.method === 'POST').at, t0)
    })

    /*
     * ONCE PER LINK (1.87.48 review 2). A count mid-set holds every tap for
     * its window and drops the one made as it begins: a second computer
     * waking mid-set (an old laptop on the account) is no reason to take one,
     * and nor is a count that heard nobody, a minute on and every minute
     * after. 1.87.47 counted once per link and never held a tap again.
     */
    const posts = (bench) => bench.sent.filter((s) => s.msg.payload.method === 'POST')
    const rollCalls = (bench) => bench.sent.filter((s) => String(s.msg.payload.id).startsWith('census'))

    test(`${end}: a second computer waking mid-set is not counted on the link: no tap waits, is dropped or moves for it`, async () => {
      const t = await relayOnABench(end)
      const { bench, clock, relay, watch, tap } = t
      assert.equal(relay.remoteCountDue(), true, 'a fresh link is not due a roll call')
      const studio = computer('Studio', 'FM3')
      bench.computers = [studio]
      const census = counted(t)
      assert.equal(relay.remoteCountDue(), false, 'a roll call is due while one is running')
      await clock.advance(3000)
      assert.equal(census.done, true)
      assert.deepEqual(relay.remoteHosts(), ['Studio'])
      /* The old laptop on the account wakes, no unit on it: every question asked of nobody has two answers from here. */
      bench.computers = [studio, computer('Old Laptop', 'FM3', { plugged: false, lag: 120 })]
      bench.sent.length = 0
      const made = []
      for (let i = 0; i < 20; i++) {
        watch(relay.remoteRequest('/preset'))
        made.push([clock.now(), watch(tap('/scene', { index: i % 4 }))])
        await clock.advance(500)
        assert.equal(relay.remoteCountDue(), false, `a roll call came due ${i * 0.5 + 0.5} s after the second computer woke`)
      }
      await clock.advance(70000)
      assert.equal(relay.remoteCountDue(), false, 'a roll call came due a minute on')
      assert.deepEqual(rollCalls(bench), [], 'a roll call was taken mid-set')
      assert.equal(posts(bench).length, made.length, 'a tap was dropped')
      for (const [i, s] of posts(bench).entries()) {
        assert.equal(s.at, made[i][0], `tap ${i + 1} waited ${s.at - made[i][0]} ms`)
        assert.equal(s.msg.payload.host, undefined, `tap ${i + 1} was moved to one computer`)
        assert.equal(made[i][1].done && !made[i][1].error, true, made[i][1].error?.message)
      }
      assert.equal(relay.remoteChosenHost(), null, 'the taps moved to another computer mid-set')
    })

    test(`${end}: a roll call that heard nobody is not taken again, a minute on or ten, and no tap waits for one`, async () => {
      const t = await relayOnABench(end)
      const { bench, clock, relay, watch, tap } = t
      /* A busy Pi 3: the roll call's question answered in 1.7 s, past its window; everything else at once. */
      const busy = computer('Studio', 'AM4')
      busy.lag = (p) => (p.path === '/store/config/host.name' && String(p.id).startsWith('census') ? 1700 : 40)
      bench.computers = [busy]
      const census = counted(t)
      await clock.advance(3000)
      assert.equal(census.done, true)
      assert.deepEqual(relay.remoteHosts(), [], 'the bench computer answered inside the window: this does not test a count that heard nobody')
      for (const wait of [61000, 600000]) {
        await clock.advance(wait)
        const made = clock.now()
        const pressed = watch(tap())
        await clock.advance(200)
        assert.equal(relay.remoteHostSeen(), true, 'the bench computer stopped answering: this does not test the count')
        assert.equal(relay.remoteCountDue(), false, `a roll call came due again ${wait / 1000} s on`)
        assert.equal(pressed.done && !pressed.error, true, pressed.error?.message)
        assert.equal(posts(bench).at(-1).at, made, `a tap ${wait / 1000} s on waited ${posts(bench).at(-1).at - made} ms`)
      }
      assert.equal(rollCalls(bench).length, 1, 'the count that heard nobody was taken again')
    })

    test(`${end}: the count at the computer's first answer holds no tap on an account whose last count heard one, until it hears two`, async () => {
      const sleep = (ms) => new Promise((go) => t.clock.setTimeout(go, ms))
      /* One computer counted last time, and nothing picked: as 1.87.47, which took no count here and sent the tap at once. */
      const t = await relayOnABench(end, { many: false })
      t.bench.computers = [computer('Studio', 'FM3')]
      const late = t.watch(t.relay.censusHosts({ late: true, windowMs: 1500, sleep }))
      await t.clock.advance(0)
      const made = t.clock.now()
      const pressed = t.watch(t.tap())
      await t.clock.advance(100)
      assert.equal(pressed.done && !pressed.error, true, pressed.error?.message)
      assert.equal(posts(t.bench)[0]?.at, made, 'a tap of one computer waited for the count at its first answer')
      await t.clock.advance(3000)
      assert.equal(late.done, true)
      assert.equal(keptFor(t.store, end)?.many, false, 'what the count heard was not kept for an account with no pick')
      /*
       * Never counted on this version, and nothing picked: one computer's first launch on it, or a store that
       * cannot be read. At once too, as 1.87.47: held, it held every tap of one computer for a second and a half.
       */
      for (const disk of [null, 'throws']) {
        const never = await relayOnABench(end, { disk })
        never.bench.computers = [computer('Studio', 'FM3')]
        never.watch(never.relay.censusHosts({ late: true, windowMs: 1500, sleep: (ms) => new Promise((go) => never.clock.setTimeout(go, ms)) }))
        await never.clock.advance(0)
        const at = never.clock.now()
        const went = never.watch(never.tap())
        await never.clock.advance(100)
        assert.equal(went.done && !went.error, true, `a tap of one computer never counted (store ${disk ?? 'read'}) waited for the count at its first answer`)
        assert.equal(posts(never.bench)[0]?.at, at)
        await never.clock.advance(3000)
        if (!disk) assert.equal(keptFor(never.store, end)?.many, false, 'a first count of one was not kept')
      }
      /* The pick 1.87.47 kept, never counted since: an account that had two, held as at any join. */
      const legacy = await relayOnABench(end, { picked: 'Studio', legacy: true })
      legacy.bench.computers = [computer('Studio', 'FM3')]
      legacy.watch(legacy.relay.censusHosts({ late: true, windowMs: 1500, sleep: (ms) => new Promise((go) => legacy.clock.setTimeout(go, ms)) }))
      await legacy.clock.advance(0)
      const held = legacy.watch(legacy.tap())
      await legacy.clock.advance(100)
      assert.equal(held.done, false, 'a tap on an account with a 1.87.47 pick went before the count')
      await legacy.clock.advance(3000)
      assert.equal(keptFor(legacy.store, end)?.many, false, 'a first count of one was not kept')
      /* Two at the first answer, the last count having heard one: at once until the first window says two, held from then, and never to both. */
      const two = await relayOnABench(end, { many: false })
      two.bench.computers = [PI5(), PI3()]
      const both = two.watch(two.relay.censusHosts({ late: true, windowMs: 1500, sleep: (ms) => new Promise((go) => two.clock.setTimeout(go, ms)) }))
      await two.clock.advance(0)
      const t0 = two.clock.now()
      two.tap('/scene', { index: 1 }).catch(() => {})
      /* Both have answered by 300 ms: two known, so a tap after that waits, though the first window runs to 1500 ms. */
      await two.clock.advance(350)
      two.tap('/scene', { index: 3 }).catch(() => {})
      await two.clock.advance(50)
      assert.equal(posts(two.bench).length, 1, 'a tap went to both units after both had answered the count, in its first window')
      await two.clock.advance(1200)
      two.tap('/scene', { index: 2 }).catch(() => {})
      const edit = two.watch(two.relay.remoteRequest('/preset/blocks/2/params', { method: 'PUT', body: JSON.stringify({ gain: 5 }) }))
      await two.clock.advance(100)
      assert.equal(posts(two.bench).length, 1, 'a tap went once two had answered, before the count had said which')
      assert.equal(posts(two.bench)[0].at, t0)
      await two.clock.advance(6000)
      assert.equal(both.done, true)
      assert.equal(edit.done && !edit.error, true, edit.error?.message)
      assert.deepEqual(writes(two.bench).slice(1).filter(([, host]) => host === ''), [], 'a write went to both units once two were heard')
      assert.equal(keptFor(two.store, end)?.many, true)
    })

    /*
     * 1.87.51: A MIX ON SCREEN IS TAKEN DOWN, AND THEN THE PICK IS ASKED. In
     * 1.87.48 a read after the first window went on to whoever answered
     * first, because the unit on screen had come off the other computer and
     * a read of the pick would be filed under it. The screen then stayed a
     * mix to the end of the count: the MacBook's FM3 in the header over a
     * Pi's "No Fractal device found", Justin's screenshot. Now the first
     * window that hears two after such a read tells whoever subscribed
     * (subscribeMixed: link.js takes the screen down, header and all, so
     * nothing is filed under the other unit), and the reads after it go to
     * the pick. What was read off the other computer is still never kept as
     * the pick's (remoteReadsAskedOf).
     */
    test(`${end}: a read made after the first window, those before it gone to nobody, comes after the mix on screen is told, and is asked of the pick`, async () => {
      /* Justin's first launch after the update: the pick 1.87.47 kept, never counted on this version, so nothing is held. */
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', legacy: true })
      const { bench, clock, relay, watch } = t
      bench.computers = [PI5(), PI3()]
      let told = 0
      relay.subscribeMixed(() => (told += 1))
      watch(relay.remoteRequest('/device/detect'))
      await clock.advance(0)
      assert.deepEqual(sentOf(bench, '/device/detect'), [''], 'the bench held a read: this does not test the window')
      const census = counted(t)
      await clock.advance(1400)
      assert.equal(told, 0, 'the mix was told before two had answered')
      await clock.advance(200)
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3', 'the first window did not find the pick')
      assert.equal(told, 1, 'a screen built out of two computers’ answers was not told at the first window')
      watch(relay.remoteRequest('/presets/53/scenes'))
      await clock.advance(0)
      assert.deepEqual(sentOf(bench, '/presets/53/scenes'), ['raspberry pi 3'], 'a read after the mix was taken down went to whoever answers first')
      await clock.advance(5000)
      assert.equal(census.done, true)
      assert.equal(told, 1)
      assert.equal(relay.remoteReadsAskedOf(), null, 'what was read off the other computer was kept as the pick’s')
      /* No read to nobody before the count: nothing is told. */
      const quiet = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      quiet.bench.computers = [PI5(), PI3()]
      let heard = 0
      quiet.relay.subscribeMixed(() => (heard += 1))
      counted(quiet)
      await quiet.clock.advance(6000)
      assert.equal(heard, 0, 'a screen read off the pick alone was told it was a mix')
    })

    test(`${end}: Which unit is told before a read goes to the new computer, waits for a count in a fresh link's first window, and a read is never taken for the wrong one's`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const { bench, clock, relay, watch } = t
      const sleep = (ms) => new Promise((go) => clock.setTimeout(go, ms))
      bench.computers = [PI5(), PI3()]
      /* A fresh link's first window, nothing counted yet (Android back on screen), and the FM3 tapped. */
      const census = counted(t)
      await clock.advance(100)
      const told = []
      relay.subscribeSwitching?.(() => told.push(sentOf(bench, '/preset').slice()))
      const picking = watch(relay.pickHost('fractalpi', { windowMs: 1500, sleep }))
      watch(relay.remoteRequest('/preset'))
      await clock.advance(8000)
      assert.equal(census.done, true)
      assert.equal(picking.done && picking.value, true, 'a pick in the first window of a fresh link was dropped')
      assert.equal(relay.remoteChosenHost(), 'fractalpi')
      assert.equal(told.length, 1, `link.js was told of the switch ${told.length} times`)
      assert.ok(!told[0].includes('fractalpi'), 'a read was asked of the new computer before link.js was told')
      assert.equal(relay.remoteReadsAskedOf(), null, 'reads asked of the computer left were taken for the new one’s')
      /* Back to the first: told again, and what the count read off it is not taken for this visit's. */
      const back = watch(relay.pickHost('raspberry pi 3', { windowMs: 1500, sleep }))
      await clock.advance(2000)
      assert.equal(back.done && back.value, true)
      assert.equal(told.length, 2)
      assert.equal(relay.remoteReadsAskedOf(), null, 'the screen read off fractalpi was taken for raspberry pi 3’s')
      /* The one driven, tapped again: nothing to switch. */
      await relay.pickHost('raspberry pi 3', { windowMs: 0, sleep: async () => {} })
      assert.equal(told.length, 2, 'a tap on the computer driven was taken for a switch')
    })

    test(`${end}: an edit made as a count begins, with Which unit tapped during it, waits for the pick's proof and goes to the pick alone`, async () => {
      for (const at of [1700, 3000, 4400]) {
        const t = await relayOnABench(end)
        const { bench, clock, relay, watch } = t
        const sleep = (ms) => new Promise((go) => clock.setTimeout(go, ms))
        bench.computers = [PI5(), PI3()]
        const census = counted(t)
        await clock.advance(0)
        const edit = watch(relay.remoteRequest('/preset/blocks/2/params', { method: 'PUT', body: JSON.stringify({ gain: 5 }) }))
        await clock.advance(at)
        const picking = watch(relay.pickHost('raspberry pi 3', { windowMs: 1500, sleep }))
        await clock.advance(9000)
        assert.equal(census.done && picking.done, true)
        assert.equal(edit.done && !edit.error, true, edit.error?.message)
        assert.deepEqual(writes(bench), [['/preset/blocks/2/params', 'raspberry pi 3']], `Which unit tapped ${at} ms into the count: the edit went to both units in the proof`)
      }
      /* A proof that never ends: the edit is refused at its six seconds, not sent to both. */
      const t = await relayOnABench(end)
      const { bench, clock, relay, watch } = t
      bench.computers = [PI5(), PI3()]
      counted(t)
      await clock.advance(6000)
      assert.equal(relay.remoteChosenHost(), 'fractalpi')
      relay.pickHost('raspberry pi 3', { windowMs: 1500, sleep: () => new Promise(() => {}) })
      await clock.advance(0)
      const edit = watch(relay.remoteRequest('/preset/blocks/2/params', { method: 'PUT', body: JSON.stringify({ gain: 5 }) }))
      await clock.advance(7000)
      assert.equal(edit.error?.notSent, true, edit.error?.message || 'an edit waited out a proof that hangs and was sent')
      assert.deepEqual(writes(bench), [], 'an edit went to both units while the pick was not proved')
    })

    test(`${end}: a pick store that cannot be read is no pick, and is never written over: every other account's pick is on it still`, async () => {
      const theirs = JSON.stringify({ accounts: { u9: { name: 'Their Mac', many: true } } })
      const t = await relayOnABench(end, { kept: theirs, disk: 'throws' })
      const { bench, clock, relay, store } = t
      const sleep = (ms) => new Promise((go) => clock.setTimeout(go, ms))
      bench.computers = [PI5(), PI3()]
      counted(t)
      await clock.advance(6000)
      const picked = relay.pickHost('raspberry pi 3', { windowMs: 1500, sleep })
      await clock.advance(2000)
      assert.equal(await picked, true)
      assert.equal(store.kept[PICK_KEY[end]], theirs, 'a store that could not be read was written over')
      /* Read again once it can be: the pick goes in beside theirs. */
      store.disk.slow = null
      const again = relay.pickHost('fractalpi', { windowMs: 1500, sleep })
      await clock.advance(2000)
      assert.equal(await again, true)
      const book = JSON.parse(store.kept[PICK_KEY[end]]).accounts
      assert.deepEqual(book.u9, { name: 'Their Mac', many: true }, 'another account’s pick was lost')
      assert.equal(book.u1?.name, 'fractalpi')
    })

    test(`${end}: a unit picked under Which unit is proved before a write goes, and a read goes to it meanwhile`, async () => {
      const { bench, clock, relay, watch, tap } = await relayOnABench(end)
      bench.computers = [PI5(), PI3()]
      const sleep = (ms) => new Promise((go) => clock.setTimeout(go, ms))
      relay.censusHosts({ windowMs: 1500, sleep })
      await clock.advance(6000)
      assert.equal(relay.remoteChosenHost(), 'fractalpi')
      bench.sent.length = 0
      const picking = watch(relay.pickHost('raspberry pi 3', { windowMs: 1500, sleep }))
      await clock.advance(100)
      const pressed = watch(tap())
      const read = watch(relay.remoteRequest('/preset'))
      await clock.advance(50)
      assert.deepEqual(sentOf(bench, '/preset'), ['raspberry pi 3'], 'a read during the proof went to the computer left')
      assert.deepEqual(writes(bench), [], 'a tap went before the pick was proved: to both computers')
      await clock.advance(2000)
      assert.equal(picking.done && picking.value, true)
      assert.equal(read.done && !read.error, true)
      assert.deepEqual(writes(bench), [['/scene', 'raspberry pi 3']], 'the tap held through the proof did not go to the pick alone')
      assert.equal(pressed.done && !pressed.error, true, pressed.error?.message)
    })

    test(`${end}: a unit picked while a count is running waits for it, and a write made then goes to the pick alone`, async () => {
      const { bench, clock, relay, watch } = await relayOnABench(end)
      bench.computers = [PI5(), PI3()]
      const sleep = (ms) => new Promise((go) => clock.setTimeout(go, ms))
      relay.censusHosts({ windowMs: 1500, sleep })
      await clock.advance(6000)
      assert.equal(relay.remoteChosenHost(), 'fractalpi')
      /* Check again, and Which unit tapped while it counts; a write with no deadline in the middle of both. */
      const count = watch(relay.censusHosts({ windowMs: 1500, sleep }))
      await clock.advance(1600)
      const picking = watch(relay.pickHost('raspberry pi 3', { windowMs: 1500, sleep }))
      await clock.advance(50)
      const saved = watch(relay.remoteRequest('/scene', { method: 'POST', body: JSON.stringify({ index: 1 }) }))
      await clock.advance(2000)
      assert.equal(count.done, false, 'the count was over before the pick: this does not test the overlap')
      assert.deepEqual(writes(bench), [], 'a write went while the count and the pick were both still running')
      await clock.advance(5000)
      assert.equal(count.done && picking.done, true)
      assert.equal(picking.value, true, 'the pick was not proved')
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3', 'the count’s own choice landed over the pick made after it began')
      assert.equal(saved.done && !saved.error, true, saved.error?.message)
      assert.deepEqual(writes(bench), [['/scene', 'raspberry pi 3']], 'the write did not go to the pick alone')
    })

    /*
     * A ROLL CALL THE CHANNEL DROPPED UNDER IS NOT A ROLL CALL. realtime-js
     * rejoins the same channel, so the link never ends, and the count whose
     * questions went into the drop was kept as the link's one count: the
     * pick never proved, reads to whoever answered first and every write to
     * every computer for the rest of the link. Now it is owed: no write goes
     * while it is, and it is taken again once the channel is back.
     */
    test(`${end}: a roll call the channel dropped under is owed: no write goes to both computers, and it is taken again when the channel is back`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const { bench, clock, relay, watch, tap, service, store } = t
      bench.computers = [PI5(), PI3()]
      const census = counted(t)
      /* Both heard in the first window (40 and 300 ms); then the channel drops under it, and the units and the proof go into the drop. */
      await clock.advance(1000)
      service.drop()
      await clock.advance(2000)
      assert.equal(census.done, true)
      const log = () => store.logged.join('\n')
      assert.equal(relay.remoteCountOwed(), true, `the count the channel dropped under was kept\n${log()}`)
      assert.match(log(), /two computers answered: fractalpi \(unit not known\), raspberry pi 3 \(unit not known\); the link dropped before the count was done: counted again when the link is back/)
      assert.ok(!/too old to be asked alone/.test(log()), `a proof lost to the drop was logged as an old computer app\n${log()}`)
      assert.equal(relay.remoteChosenHost(), null, 'a computer was driven on a count cut short')
      service.back()
      /* Asked of the pick by name, as every read is while the count is owed: the Pi 3 answers at 300 ms. */
      const back = watch(relay.hostResponds())
      await clock.advance(400)
      assert.equal(back.value, true)
      assert.equal(relay.remoteCountDue(), true, 'the count cut short is not taken again with the channel back')
      /* A tap and an edit before it is: neither goes, and the tap is dropped at its deadline rather than sent to both. */
      bench.sent.length = 0
      const pressed = watch(tap())
      const saved = watch(relay.remoteRequest('/scene', { method: 'POST', body: JSON.stringify({ index: 1 }) }))
      const read = watch(relay.remoteRequest('/preset'))
      await clock.advance(1600)
      assert.deepEqual(writes(bench), [], 'a write went while the count was owed: to both computers')
      assert.equal(pressed.done && pressed.error?.notSent, true, `the tap made while the count was owed was not dropped: ${pressed.error?.message}`)
      assert.deepEqual(sentOf(bench, '/preset'), ['raspberry pi 3'], 'a read while the count was owed went to whoever answers first')
      const again = counted(t)
      await clock.advance(6000)
      assert.equal(again.done, true)
      assert.equal(relay.remoteCountOwed(), false)
      assert.equal(relay.remoteCountDue(), false)
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3')
      assert.equal(saved.done && !saved.error, true, saved.error?.message)
      assert.deepEqual(writes(bench), [['/scene', 'raspberry pi 3']], 'the edit did not go to the pick alone once it was counted again')
      assert.equal(read.done && !read.error, true)
    })

    test(`${end}: a channel dropped before any answer to the roll call, on an account that may have two, is owed too; with one computer it is kept as it always was`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      t.bench.computers = [PI5({ lag: 400 }), PI3({ lag: 400 })]
      const census = counted(t)
      await t.clock.advance(100)
      t.service.drop()
      await t.clock.advance(5000)
      assert.equal(census.done, true)
      assert.equal(t.relay.remoteCountOwed(), true, 'a count that heard nobody because of the drop was kept, on an account of two')
      /* One computer, nothing picked: the same drop changes nothing, and a tap after it goes at once. */
      const one = await relayOnABench(end)
      one.bench.computers = [computer('Studio', 'FM3')]
      const count = counted(one)
      await one.clock.advance(500)
      one.service.drop()
      await one.clock.advance(1500)
      one.service.back()
      await one.clock.advance(100)
      assert.equal(count.done, true)
      assert.equal(one.relay.remoteCountOwed(), false, 'one computer’s count was taken again')
      assert.equal(one.relay.remoteCountDue(), false)
      const hostSeen = one.watch(one.relay.hostResponds())
      await one.clock.advance(100)
      assert.equal(hostSeen.value, true)
      const made = one.clock.now()
      const pressed = one.watch(one.tap())
      await one.clock.advance(200)
      assert.equal(pressed.done && !pressed.error, true, pressed.error?.message)
      assert.equal(one.bench.sent.find((s) => s.msg.payload.method === 'POST')?.at, made, 'one computer’s tap waited')
    })

    /*
     * THE ONE PLACE ONE COMPUTER'S TIMING MOVES, AND ONLY ON A RECORD THAT
     * SAYS IT MAY HAVE TWO: its last count heard two (many: true), or a
     * 1.87.47 pick never counted since (relay-rules mayBeTwo). One computer
     * answered, and a drop under the count may have taken the second one's
     * answer with it; kept, every write after it went to nobody in
     * particular, both units if the second was there. So it is owed, as an
     * account of two's is, and a tap waits for the count owed (dropped at
     * its deadline). Every other record goes exactly as in 1.87.50: no
     * record, nothing picked, or a count that heard one.
     */
    test(`${end}: one computer answering a count the channel dropped under is counted again only where the record says it may have two; every other record keeps it, its taps at once`, async () => {
      const oneUnder = async (opts) => {
        const t = await relayOnABench(end, opts)
        t.bench.computers = [computer('Studio', 'FM3')]
        const count = counted(t)
        await t.clock.advance(400)
        t.service.drop()
        await t.clock.advance(1500)
        t.service.back()
        await t.clock.advance(100)
        assert.equal(count.done, true)
        const seen = t.watch(t.relay.hostResponds())
        await t.clock.advance(100)
        assert.equal(seen.value, true)
        t.bench.sent.length = 0
        const made = t.clock.now()
        const pressed = t.watch(t.tap())
        await t.clock.advance(2000)
        return { t, owed: t.relay.remoteCountOwed(), pressed, sentAt: t.bench.sent.find((s) => s.msg.payload.method === 'POST')?.at ?? null, made }
      }
      for (const opts of [{ picked: 'Studio', many: true }, { picked: 'Studio', legacy: true }]) {
        const { t, owed, pressed, sentAt } = await oneUnder(opts)
        assert.equal(owed, true, `${JSON.stringify(opts)}: a count a drop may have taken the second answer from was kept`)
        assert.equal(sentAt, null, `${JSON.stringify(opts)}: a tap went while the count was owed, to nobody in particular`)
        assert.equal(pressed.done && pressed.error?.notSent, true, pressed.error?.message)
        /* Counted again: one computer, and its taps go at once from there. */
        const again = counted(t)
        await t.clock.advance(2000)
        assert.equal(again.done, true)
        assert.equal(t.relay.remoteCountOwed(), false)
        t.bench.sent.length = 0
        const made = t.clock.now()
        const next = t.watch(t.tap())
        await t.clock.advance(200)
        assert.equal(next.done && !next.error, true, next.error?.message)
        assert.equal(t.bench.sent.find((s) => s.msg.payload.method === 'POST')?.at, made)
      }
      for (const opts of [{}, { picked: null, many: false }, { picked: 'Studio', many: false }]) {
        const { owed, pressed, sentAt, made } = await oneUnder(opts)
        assert.equal(owed, false, `${JSON.stringify(opts)}: one computer's count was taken again`)
        assert.equal(pressed.done && !pressed.error, true, pressed.error?.message)
        assert.equal(sentAt, made, `${JSON.stringify(opts)}: one computer's tap waited`)
      }
    })

    test(`${end}: a pick's proof the channel dropped under, its answer lost, is never taken for an old computer app: the computers are counted again`, async () => {
      const t = await relayOnABench(end)
      const { bench, clock, relay, watch, service, store } = t
      const pi3 = PI3()
      const answers = pi3.reply
      let lost = false
      pi3.reply = (p) => (lost && p.path === '/store/config/host.name' ? 'silent' : answers(p))
      bench.computers = [PI5(), pi3]
      const sleep = (ms) => new Promise((go) => clock.setTimeout(go, ms))
      relay.censusHosts({ windowMs: 1500, sleep })
      await clock.advance(6000)
      assert.equal(relay.remoteChosenHost(), 'fractalpi')
      store.logged.length = 0
      /* Which unit tapped; the channel drops at once, and the proof's answer goes with it. */
      lost = true
      const picking = watch(relay.pickHost('raspberry pi 3', { windowMs: 1500, sleep }))
      await clock.advance(100)
      service.drop()
      await clock.advance(100)
      service.back()
      lost = false
      await clock.advance(2000)
      assert.equal(picking.done && picking.value, false)
      const log = store.logged.join('\n')
      assert.equal(relay.remoteCountOwed(), true, `the proof lost to the drop was kept\n${log}`)
      assert.match(log, /the link dropped while raspberry pi 3, picked under Which unit, was asked alone: the computers are counted again when it is back/)
      assert.ok(!/too old/.test(log), log)
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3', 'the pick tapped was let go')
      bench.sent.length = 0
      const seen = watch(relay.hostResponds())
      await clock.advance(400)
      assert.equal(seen.value, true)
      const saved = watch(relay.remoteRequest('/scene', { method: 'POST', body: JSON.stringify({ index: 1 }) }))
      await clock.advance(500)
      assert.deepEqual(writes(bench), [], 'a write went while the proof was owed: to both computers')
      relay.censusHosts({ windowMs: 1500, sleep })
      await clock.advance(6000)
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3')
      assert.equal(saved.done && !saved.error, true, saved.error?.message)
      assert.deepEqual(writes(bench), [['/scene', 'raspberry pi 3']])
      /* A drop that comes after the proof's one answer leaves it proved, as a proof with no drop. */
      store.logged.length = 0
      const proved = watch(relay.pickHost('fractalpi', { windowMs: 1500, sleep }))
      await clock.advance(500)
      service.drop()
      await clock.advance(100)
      service.back()
      await clock.advance(2000)
      assert.equal(proved.done && proved.value, true, store.logged.join('\n'))
      assert.equal(relay.remoteCountOwed(), false)
    })

    /*
     * A SLOW PICK IS STILL THE PICK. Justin's Pi 3 can be two seconds on
     * answering; the roll call's first window is a second and a half. It was
     * "did not answer", and the taps went to the first computer with a unit:
     * the switch on a timeout that nothing else does.
     */
    test(`${end}: a pick slower than the roll call's first window is still the pick: driven, and proved over its own time`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const { bench, clock, relay, watch, tap, store } = t
      bench.computers = [PI5(), computer('raspberry pi 5', 'FM3', { plugged: false, lag: 60 }), PI3({ lag: 2000 })]
      const census = counted(t)
      await clock.advance(9000)
      assert.equal(census.done, true)
      const log = store.logged.join('\n')
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3', `the slow pick was left for the first computer with a unit\n${log}`)
      assert.ok(relay.remoteHosts().includes('raspberry pi 3'))
      assert.match(log, /driving raspberry pi 3, the one picked under Which unit, addressed/, log)
      assert.ok(!/did not answer/.test(log), log)
      assert.equal(relay.remoteMissingPick(), null)
      bench.sent.length = 0
      const pressed = watch(tap())
      await clock.advance(3000)
      assert.equal(pressed.done && !pressed.error, true, pressed.error?.message)
      assert.deepEqual(writes(bench), [['/scene', 'raspberry pi 3']], 'the tap did not go to the slow pick alone')
    })

    /*
     * A PICK THAT NEVER ANSWERS (renamed, switched off) leaves the first
     * computer with a unit driven, as 1.87.47 did, and now Play says so:
     * Keep this one makes the one driven the pick, and Forget under Which
     * unit leaves nothing picked.
     */
    test(`${end}: a pick that never answers is said with the computer driven instead; Keep this one makes that one the pick, and Forget leaves nothing picked`, async () => {
      const t = await relayOnABench(end, { picked: 'fractalpi', many: true })
      const { bench, clock, relay, rules, store } = t
      const gone = PI5()
      gone.reply = () => 'silent'
      bench.computers = [gone, computer('MacBook Pro SG 566', 'FM3', { lag: 60 }), PI3()]
      counted(t)
      await clock.advance(9000)
      assert.equal(relay.remoteChosenHost(), 'MacBook Pro SG 566')
      assert.equal(relay.remoteMissingPick(), 'fractalpi')
      const card = rules.missingPickCard({ missing: relay.remoteMissingPick(), driving: relay.remoteChosenHost(), hosts: relay.remoteHosts(), units: relay.remoteUnits() })
      assert.equal(card.words, 'fractalpi, picked under Which unit, isn’t answering. Playing the FM3 on MacBook Pro SG 566.')
      assert.deepEqual([card.keep, card.list], ['Keep this one', 'Which unit…'])
      assert.equal(relay.keepDriven(), true)
      await clock.advance(0)
      assert.equal(relay.remoteMissingPick(), null, 'the card stays up after Keep this one')
      assert.equal(keptFor(store, end)?.name, 'MacBook Pro SG 566', 'Keep this one did not make the one driven the pick')
      /* The next launch drives it as the pick, and says nothing. */
      await newLink(t)
      store.logged.length = 0
      counted(t)
      await clock.advance(9000)
      assert.equal(relay.remoteChosenHost(), 'MacBook Pro SG 566')
      assert.equal(relay.remoteMissingPick(), null)
      assert.match(store.logged.join('\n'), /driving MacBook Pro SG 566, the one picked under Which unit, addressed/)
      /* Forget: nothing picked, so the next count drives the first with a unit and has nothing to say. */
      const other = await relayOnABench(end, { picked: 'fractalpi', many: true })
      other.bench.computers = [gone, computer('MacBook Pro SG 566', 'FM3', { lag: 60 }), PI3()]
      counted(other)
      await other.clock.advance(9000)
      assert.equal(other.relay.remoteMissingPick(), 'fractalpi')
      assert.equal(other.relay.forgetMissingPick(), true)
      await other.clock.advance(0)
      assert.equal(other.relay.remoteMissingPick(), null)
      assert.equal(keptFor(other.store, end)?.name ?? null, null, 'Forget left the pick that does not answer picked')
      assert.equal(keptFor(other.store, end)?.many, true, 'Forget lost what the last count heard')
      await newLink(other)
      counted(other)
      await other.clock.advance(9000)
      assert.equal(other.relay.remoteMissingPick(), null)
      /* One computer heard: nothing said, whatever was picked. */
      const one = await relayOnABench(end, { picked: 'fractalpi', many: true })
      one.bench.computers = [gone, PI3()]
      counted(one)
      await one.clock.advance(9000)
      assert.equal(one.relay.remoteMissingPick(), null, 'a pick missing with one computer heard is said on Play')
    })

    test(`${end}: the units are asked again for Play's card, reads only and nothing held, and one computer is asked nothing more`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const { bench, clock, relay, watch, tap } = t
      const pi3 = PI3({ plugged: false })
      bench.computers = [PI5(), pi3]
      counted(t)
      await clock.advance(9000)
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3')
      assert.deepEqual(relay.remoteUnits()['raspberry pi 3'], { model: 'FM3', plugged: false })
      /* The AM4 plugged into the pick: asked again, it says so. */
      bench.computers[1] = PI3()
      bench.sent.length = 0
      const asked = watch(relay.refreshUnits({ windowMs: 1500, sleep: (ms) => new Promise((go) => clock.setTimeout(go, ms)) }))
      const made = clock.now()
      const pressed = watch(tap())
      await clock.advance(400)
      assert.equal(pressed.done && !pressed.error, true, pressed.error?.message)
      assert.equal(bench.sent.find((x) => x.msg.payload.method === 'POST')?.at, made, 'a tap waited for the units to be read')
      assert.deepEqual(writes(bench), [['/scene', 'raspberry pi 3']])
      await clock.advance(2000)
      assert.equal(asked.done, true)
      assert.deepEqual(relay.remoteUnits()['raspberry pi 3'], { model: 'AM4', plugged: true })
      assert.deepEqual(bench.sent.filter((x) => x.msg.payload.method === 'GET').map((x) => `${x.msg.payload.path} ${x.msg.payload.host}`).sort(), ['/device fractalpi', '/device raspberry pi 3', '/healthz fractalpi', '/healthz raspberry pi 3'], 'the units were asked something else, or of nobody in particular')
      /* Nothing changed: the same object, so nobody redraws for it. */
      const before = relay.remoteUnits()
      relay.refreshUnits({ windowMs: 1500, sleep: (ms) => new Promise((go) => clock.setTimeout(go, ms)) })
      await clock.advance(2000)
      assert.equal(relay.remoteUnits(), before)
      /* One computer: nothing asked. */
      const one = await relayOnABench(end)
      one.bench.computers = [computer('Studio', 'FM3')]
      counted(one)
      await one.clock.advance(3000)
      one.bench.sent.length = 0
      await one.relay.refreshUnits()
      assert.equal(one.bench.sent.length, 0, 'one computer was asked which unit it has')
    })

    /*
     * "raspberry pi 3 — Unit not known. Update the computer app on it to see
     * which." Justin's Pi 3 was on 1.87.48, the newest: it answered the roll
     * call, and took nearly two seconds to say its unit (GET /healthz —
     * 1819ms) against the roll call's one and a half. Asked again alone, with
     * longer, it says AM4, and nobody else is asked anything.
     */
    test(`${end}: a computer slow to say its unit is asked again alone, with longer, and Which unit never tells it to update`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const { bench, clock, relay, watch } = t
      bench.computers = [PI5(), PI3({ lag: (p) => (p.path === '/healthz' || p.path === '/device' ? 1850 : 300) })]
      counted(t)
      await clock.advance(9000)
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3')
      assert.equal(relay.remoteUnits()['raspberry pi 3'], undefined, 'the bench’s Pi 3 said its unit inside the window: this does not test it')
      const { unitChoices, UNIT_ASK_MS } = await import('../shared/relay-rules.mjs')
      const row = () => unitChoices(relay.remoteHosts(), relay.remoteUnits(), relay.remoteChosenHost()).find((r) => r.name === 'raspberry pi 3')
      assert.equal(row().detail, 'It didn’t say which unit in time.')
      bench.sent.length = 0
      const asked = watch(relay.refreshUnits({ windowMs: UNIT_ASK_MS, only: ['raspberry pi 3'], sleep: (ms) => new Promise((go) => clock.setTimeout(go, ms)) }))
      await clock.advance(UNIT_ASK_MS + 500)
      assert.equal(asked.done, true)
      assert.deepEqual(relay.remoteUnits()['raspberry pi 3'], { model: 'AM4', plugged: true })
      assert.deepEqual(relay.remoteUnits().fractalpi, { model: 'FM3', plugged: true }, 'what the other computer said was lost')
      assert.deepEqual([row().label, row().detail], ['AM4', 'on raspberry pi 3'])
      assert.deepEqual(
        bench.sent.map((x) => `${x.msg.payload.method} ${x.msg.payload.path} ${x.msg.payload.host}`).sort(),
        ['GET /device raspberry pi 3', 'GET /healthz raspberry pi 3'],
        'more than the one that had not said was asked, or something else was'
      )
    })

    test(`${end}: a pick that does not answer when asked alone is logged so, never as a computer app too old`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const pi3 = PI3()
      const answers = pi3.reply
      /* Answers the roll call, and nothing asked of it by name: a name it does not hear as its own. */
      pi3.reply = (p) => (p.host && p.path === '/store/config/host.name' ? 'silent' : answers(p))
      t.bench.computers = [PI5(), pi3]
      const census = counted(t)
      await t.clock.advance(6000)
      assert.equal(census.done, true)
      const log = t.store.logged.join('\n')
      assert.match(log, /driving raspberry pi 3, the one picked under Which unit, addressed, not proved: it did not answer when asked alone/, log)
      assert.ok(!/too old/.test(log), log)
      /* No drop: the count is this link's, as it always was. */
      assert.equal(t.relay.remoteCountOwed(), false)
    })

    /*
     * A PROOF WITH NO ANSWER NEVER SENDS ANYTHING TO EVERY COMPUTER. A
     * computer app too old to know names answers every name, so it gives
     * two answers; none is an answer lost or a computer slow. Justin's Pi 3
     * answers the roll call in 1.6 s and its name, asked alone, in 2.2 s: the
     * proof waited 2.1 s, and every tap after it went to all three computers,
     * the FM3 and the AM4 changing scene together. Now the one driven is
     * asked by name all the same. And the same for a pick heard in the
     * first window whose proof's answer is late, and for Which unit.
     */
    test(`${end}: a pick whose answer when asked alone comes after the proof's window is still asked by name: no write reaches two computers, and no read is answered by another`, async () => {
      for (const [roll, proof] of [
        [1600, 2200],
        [300, 1700]
      ]) {
        const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
        const { bench, clock, relay, watch, tap, store } = t
        const mac = computer('MacBook Pro SG 566', 'FM3', { lag: 150 })
        const pi3 = computer('raspberry pi 3', 'AM4', { lag: (p) => (p.path === '/store/config/host.name' ? (p.host ? proof : roll) : 400) })
        bench.computers = [mac, computer('raspberry pi 5', 'FM3', { plugged: false, lag: 170 }), pi3]
        const early = watch(relay.remoteRequest('/device/detect'))
        const census = counted(t)
        await clock.advance(9000)
        assert.equal(census.done, true)
        const log = store.logged.join('\n')
        assert.equal(relay.remoteChosenHost(), 'raspberry pi 3', log)
        assert.match(log, /driving raspberry pi 3, the one picked under Which unit, addressed, not proved: it did not answer when asked alone/, log)
        assert.ok(!/too old/.test(log), log)
        assert.equal(early.done && !early.error, true)
        assert.deepEqual(sentOf(bench, '/device/detect'), ['raspberry pi 3'], `${roll}/${proof}: a read at launch went to whoever answers first`)
        bench.sent.length = 0
        const pressed = watch(tap())
        const saved = watch(relay.remoteRequest('/store/config/scene-names-fm3%3A479', { method: 'PUT', body: '{}' }))
        const read = watch(relay.remoteRequest('/preset'))
        await clock.advance(3000)
        assert.equal(pressed.done && !pressed.error, true, pressed.error?.message)
        assert.equal(saved.done && !saved.error, true, saved.error?.message)
        assert.equal(read.done && !read.error, true, read.error?.message)
        assert.deepEqual(writes(bench).sort(), [['/scene', 'raspberry pi 3'], ['/store/config/scene-names-fm3%3A479', 'raspberry pi 3']], `${roll}/${proof}: a write after a proof with no answer went to every computer`)
        assert.deepEqual(sentOf(bench, '/preset'), ['raspberry pi 3'], `${roll}/${proof}: a read after a proof with no answer went to whoever answers first`)
        /* Which unit, its proof's answer late the same way: the MacBook is asked by name, and nobody else hears the tap. */
        mac.lag = (p) => (p.path === '/store/config/host.name' && p.host ? 2000 : 150)
        const sleep = (ms) => new Promise((go) => clock.setTimeout(go, ms))
        const picking = watch(relay.pickHost('MacBook Pro SG 566', { windowMs: 1500, sleep }))
        await clock.advance(3000)
        assert.equal(picking.done && picking.value, false)
        bench.sent.length = 0
        const moved = watch(tap())
        await clock.advance(1000)
        assert.equal(moved.done && !moved.error, true, moved.error?.message)
        assert.deepEqual(writes(bench), [['/scene', 'MacBook Pro SG 566']], `${roll}/${proof}: a tap after Which unit's proof had no answer went to every computer`)
      }
    })

    /*
     * A COUNT CUT SHORT WITH THE PICK'S ANSWER IN THE DROP KEEPS ITS READS
     * HELD. It kept them with the pick only when it had heard the pick; when
     * the drop took the pick's answer, the hold was let go, and every read
     * made while the link was down or coming back went to whoever answered
     * first: the MacBook's FM3 in the header over the Pi 5's "No Fractal
     * device found", the mix 1.87.51 takes out of the launch, back after a
     * drop. Now they wait for the count owed, as at a launch.
     */
    test(`${end}: a count cut short by a drop that took the pick's answer keeps its reads held, and none goes to whoever answers first before the count owed says where`, async () => {
      const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      const { bench, clock, relay, watch, service } = t
      let lost = true
      const pi3 = computer('raspberry pi 3', 'AM4', { lag: 320 })
      const answers = pi3.reply
      pi3.reply = (p) => (lost ? 'silent' : answers(p))
      bench.computers = [computer('MacBook Pro SG 566', 'FM3', { lag: 150 }), computer('raspberry pi 5', 'FM3', { plugged: false, lag: 170 }), pi3]
      const census = counted(t)
      await clock.advance(250)
      service.drop()
      const reads = []
      await clock.advance(750)
      reads.push(watch(relay.remoteRequest('/scene')))
      await clock.advance(1100)
      reads.push(watch(relay.remoteRequest('/scene')))
      await clock.advance(400)
      assert.equal(census.done, true)
      assert.equal(relay.remoteCountOwed(), true, 'the count the drop took the pick’s answer from was kept')
      lost = false
      service.back()
      const seen = watch(relay.hostResponds())
      await clock.advance(20)
      reads.push(watch(relay.remoteRequest('/scene')))
      await clock.advance(200)
      assert.equal(seen.value, true)
      assert.deepEqual(sentOf(bench, '/scene'), [], 'a read went before the count owed had begun')
      const again = counted(t)
      await clock.advance(8000)
      assert.equal(again.done, true)
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3')
      assert.deepEqual(sentOf(bench, '/scene'), ['raspberry pi 3', 'raspberry pi 3', 'raspberry pi 3'], 'a read made while the count was owed went to whoever answers first')
      for (const read of reads) assert.equal(read.done && !read.error && read.value?.from, 'raspberry pi 3', read.error?.message)
      /* The pick heard before the drop: reads go on to it by name, and nothing waits. */
      const heard = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
      heard.bench.computers = [computer('MacBook Pro SG 566', 'FM3', { lag: 150 }), computer('raspberry pi 5', 'FM3', { plugged: false, lag: 170 }), computer('raspberry pi 3', 'AM4', { lag: 320 })]
      counted(heard)
      await heard.clock.advance(1600)
      heard.service.drop()
      await heard.clock.advance(4000)
      assert.equal(heard.relay.remoteCountOwed(), true)
      heard.service.back()
      await heard.clock.advance(20)
      const after = heard.watch(heard.relay.remoteRequest('/scene'))
      await heard.clock.advance(400)
      assert.equal(after.done && after.value?.from, 'raspberry pi 3', 'a read with the pick heard waited, or went to another')
      assert.deepEqual(sentOf(heard.bench, '/scene'), ['raspberry pi 3'])
      /*
       * A pick two seconds slow, and a read made before the drop: its own six
       * seconds run out a moment before the pick answers the count owed. It
       * waits for that answer, to the end of the hold the count cut short
       * kept, rather than going to whoever answers first.
       */
      /* And with the channel down long enough that the hold kept at the drop would end first: the count owed holds for its own six seconds from when it begins, as at a launch. */
      for (const down of [2400, 6400]) {
        const slow = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
        let away = true
        const pi3s = computer('raspberry pi 3', 'AM4', { lag: 2000 })
        const said = pi3s.reply
        pi3s.reply = (p) => (away ? 'silent' : said(p))
        slow.bench.computers = [computer('MacBook Pro SG 566', 'FM3', { lag: 150 }), computer('raspberry pi 5', 'FM3', { plugged: false, lag: 170 }), pi3s]
        counted(slow)
        const early = slow.watch(slow.relay.remoteRequest('/scene'))
        await slow.clock.advance(1600)
        slow.service.drop()
        await slow.clock.advance(down)
        assert.equal(slow.relay.remoteCountOwed(), true)
        away = false
        slow.service.back()
        await slow.clock.advance(150)
        counted(slow)
        await slow.clock.advance(8000)
        assert.equal(slow.relay.remoteChosenHost(), 'raspberry pi 3')
        assert.deepEqual(sentOf(slow.bench, '/scene'), ['raspberry pi 3'], `down ${down} ms: a read made before the drop went to whoever answers first, its hold over a moment before the slow pick answered`)
        assert.equal(early.done && early.value?.from, 'raspberry pi 3', early.error?.message)
      }
    })

    /*
     * AND A CHANNEL DOWN LONGER THAN THAT HOLD. Kept six seconds from the end
     * of the count cut short, it was over when a channel down seven seconds
     * or more came back: the reads that had waited for the channel went to
     * whoever answered first, and the pick's answer to the count owed let
     * the rest go to nobody in particular after them. The MacBook's FM3 in
     * the header, then over the Pi's "No Fractal device found", until the
     * first window took it down. Now the hold runs from the channel's
     * return, and the pick's answer lets reads go only to be asked of it.
     */
    test(`${end}: a channel down longer than the hold a count cut short keeps: no read goes to whoever answers first when it is back, nor at the pick's answer`, async () => {
      for (const down of [9000, 14000]) {
        const t = await relayOnABench(end, { picked: 'raspberry pi 3', many: true })
        const { bench, clock, relay, watch, service } = t
        let lost = true
        const pi3 = computer('raspberry pi 3', 'AM4', { lag: 320 })
        const answers = pi3.reply
        pi3.reply = (p) => (lost ? 'silent' : answers(p))
        bench.computers = [computer('MacBook Pro SG 566', 'FM3', { lag: 150 }), computer('raspberry pi 5', 'FM3', { plugged: false, lag: 170 }), pi3]
        counted(t)
        const reads = [watch(relay.remoteRequest('/scene'))]
        await clock.advance(250)
        service.drop()
        await clock.advance(down)
        assert.equal(relay.remoteCountOwed(), true, 'the count the drop took the pick’s answer from was kept')
        lost = false
        service.back()
        await clock.advance(20)
        reads.push(watch(relay.remoteRequest('/scene')))
        await clock.advance(200)
        assert.deepEqual(sentOf(bench, '/scene'), [], `down ${down} ms: a read went to whoever answers first as the channel was back`)
        counted(t)
        await clock.advance(100)
        reads.push(watch(relay.remoteRequest('/scene')))
        await clock.advance(8000)
        assert.equal(relay.remoteChosenHost(), 'raspberry pi 3')
        assert.ok(sentOf(bench, '/scene').every((host) => host === 'raspberry pi 3'), `down ${down} ms: a read went to nobody in particular: ${sentOf(bench, '/scene')}`)
        for (const read of reads) if (read.done && !read.error) assert.equal(read.value?.from, 'raspberry pi 3', `down ${down} ms: a read was answered by another computer`)
      }
    })
  }

  test('phone: a disk slow to answer, or never answering, holds no read or tap of one computer past a quarter of a second, and never hangs a count or a pick', async () => {
    for (const slow of [3000, 'never']) {
      const t = await relayOnABench('phone', { disk: slow })
      const { bench, clock, relay, watch, tap } = t
      const sleep = (ms) => new Promise((go) => clock.setTimeout(go, ms))
      bench.computers = [computer('Studio', 'FM3')]
      /* The link came up a tenth of a second ago (the bench's own /healthz), with the disk asked as it was joined. */
      const census = counted(t)
      await clock.advance(0)
      const read = watch(relay.remoteRequest('/preset'))
      await clock.advance(300)
      assert.equal(read.done && !read.error, true, `a read of one computer waited on a disk that ${slow === 'never' ? 'never answers' : 'takes 3 s'}`)
      await clock.advance(2000)
      assert.equal(census.done, true, `the count waited on a disk that ${slow === 'never' ? 'never answers' : 'takes 3 s'}`)
      const made = clock.now()
      const pressed = watch(tap())
      await clock.advance(100)
      assert.equal(pressed.done && !pressed.error, true, pressed.error?.message)
      assert.equal(bench.sent.filter((s) => s.msg.payload.method === 'POST')[0].at, made)
      /* And Which unit never waits on the disk to write the pick down: no proof, nor every write behind it, held for it. */
      bench.computers = [PI5(), PI3()]
      counted(t)
      await clock.advance(6000)
      const picking = watch(relay.pickHost('raspberry pi 3', { windowMs: 1500, sleep }))
      await clock.advance(2000)
      assert.equal(picking.done && picking.value, true, `a pick waited on a disk that ${slow === 'never' ? 'never answers' : 'takes 3 s'}`)
    }
  })

  test('phone: a disk slower than the join holds nothing of one computer: a read and a tap the moment the link is up go at once, as in 1.87.47', async () => {
    for (const slow of [200, 3000, 'never']) {
      /* The record many:false is on the disk, not read yet: the link came up a tenth of a second ago. */
      const t = await relayOnABench('phone', { many: false, disk: slow })
      const { bench, clock, relay, watch, tap } = t
      bench.computers = [computer('Studio', 'FM3')]
      const made = clock.now()
      const read = watch(relay.remoteRequest('/scene'))
      const pressed = watch(tap())
      await clock.advance(0)
      assert.equal(sentAt(bench, '/scene'), made, `a read of one computer waited ${sentAt(bench, '/scene') - made} ms on a disk that ${slow === 'never' ? 'never answers' : `takes ${slow} ms`}`)
      assert.equal(bench.sent.filter((s) => s.msg.payload.method === 'POST')[0]?.at, made, `a tap of one computer waited on a disk that ${slow === 'never' ? 'never answers' : `takes ${slow} ms`}`)
      await clock.advance(400)
      assert.equal(read.done && !read.error, true)
      assert.equal(pressed.done && !pressed.error, true, pressed.error?.message)
    }
    /* Two computers, the pick's record off the disk after the link is up but before any read: held from then, as at a disk that is quick. */
    const t = await relayOnABench('phone', { picked: 'raspberry pi 3', many: true })
    t.bench.computers = [PI5(), PI3()]
    const early = t.watch(t.relay.remoteRequest('/device/detect'))
    await t.clock.advance(200)
    assert.deepEqual(sentOf(t.bench, '/device/detect'), [], 'a read went to whoever answers first')
    counted(t)
    await t.clock.advance(6000)
    assert.equal(early.value?.short, 'AM4')
  })

  test('phone: two computers, and the record still not off the disk when the roll call’s first window closes: it is looked for while their units are read, and the unit picked is driven, as 1.87.47 did', async () => {
    /* The first window closes 1.6 s after the link came up, and the units are read until 3.1 s; the AM4 is picked under Which unit. */
    for (const slow of [1700, 3000]) {
      const t = await relayOnABench('phone', { picked: 'raspberry pi 3', many: true, disk: slow })
      const { bench, clock, relay, watch, tap } = t
      bench.computers = [PI5(), PI3()]
      const census = counted(t)
      await clock.advance(9000)
      assert.equal(census.done, true)
      assert.equal(relay.remoteChosenHost(), 'raspberry pi 3', `a disk that took ${slow} ms handed the taps to the FM3, the first to answer`)
      const after = watch(tap())
      await clock.advance(400)
      assert.equal(after.done && !after.error, true, after.error?.message)
      assert.deepEqual(writes(bench), [['/scene', 'raspberry pi 3']])
    }
    /* Slower than that, or never: no pick, as with nothing picked, and the count takes not a moment longer for the disk. */
    for (const slow of [4000, 'never']) {
      const t = await relayOnABench('phone', { picked: 'raspberry pi 3', many: true, disk: slow })
      t.bench.computers = [PI5(), PI3()]
      const began = t.clock.now()
      const census = counted(t)
      await t.clock.advance(1500 + 1500 + 1500 + 50)
      assert.equal(census.done, true, `the count was still waiting on a disk that ${slow === 'never' ? 'never answers' : `takes ${slow} ms`}, ${t.clock.now() - began} ms on`)
      assert.equal(t.relay.remoteChosenHost(), 'fractalpi')
      assert.deepEqual(writes(t.bench), [])
    }
  })

  test('both ends: only a record that says two, or a 1.87.47 pick never counted since, is an account that may have two (shared mayBeTwo)', async () => {
    const { mayBeTwo } = await import('../shared/relay-rules.mjs')
    assert.equal(mayBeTwo(null), false, 'a record not read yet held one computer')
    assert.equal(mayBeTwo({ name: null, many: null }), false, 'an account never counted, with no pick, held one computer')
    assert.equal(mayBeTwo({ name: null, many: false }), false)
    assert.equal(mayBeTwo({ name: 'Studio', many: false }), false, 'a pick left over from two, counted one since, held one computer')
    assert.equal(mayBeTwo({ name: 'raspberry pi 3', many: null }), true, 'the pick 1.87.47 kept was not taken for an account that had two')
    assert.equal(mayBeTwo({ name: 'raspberry pi 3', many: true }), true)
    assert.equal(mayBeTwo({ name: null, many: true }), true)
    /* The phone's join goes by it, read off the account's own record. */
    for (const [opts, two] of [[{}, false], [{ many: false }, false], [{ picked: 'Studio', legacy: true }, true], [{ picked: 'raspberry pi 3', many: true }, true], [{ disk: 'never' }, false], [{ disk: 'throws' }, false]]) {
      const t = await relayOnABench('phone', opts)
      await t.clock.advance(0)
      assert.equal(t.relay.remoteMayBeTwo(), two, `record ${JSON.stringify(opts)}`)
    }
  })

  test('phone: a roll call that picked one of two reads the unit again when the read of it while it counted did not get it, as 1.87.47 always did', async () => {
    /* Every read went to the pick (relay holdReads), and its detect was lost: Play would wait on "Asking your unit what it is" for good. */
    const t = await linkOnABench()
    t.bench.unitRead = false
    t.bench.census = async () => {
      await new Promise((go) => t.clock.setTimeout(go, 4500))
      t.bench.hosts = ['fractalpi', 'raspberry pi 3']
      t.bench.chosen = 'raspberry pi 3'
      t.bench.askedOf = 'raspberry pi 3'
    }
    t.link.startLink()
    await t.clock.advance(6000)
    assert.deepEqual(t.bench.order.filter((x) => x === 'refreshAll' || x === 'startClean'), ['refreshAll', 'refreshAll'], 'a unit whose read was lost was never read again')
    /* And the rig says whether it has, from its own detect (rig.unitReadSince). */
    const rig = read('mobile/src/lib/rig.js')
    assert.match(rig, /export const unitReadSince = \(t\) => unitSettled && unitReadAt >= t/)
    assert.match(rig, /setColourUnit\(slug, \{ demo: simulated \}\)\n {2}\/\*[^*]*\*\/\n {2}unitReadAt = Date\.now\(\)\n/)
  })

  test('phone: an account whose last count heard one computer reads the computer’s name before the roll call at join, as in 1.87.47; one that may have two, after', async () => {
    /* `many` here is the record's own word (relay.js remoteMayBeTwo): null is never counted, or not off the disk yet, and goes as 1.87.47. */
    for (const [many, first] of [[false, 'name'], [null, 'name'], [true, 'census']]) {
      const t = await linkOnABench()
      t.bench.many = many
      t.link.startLink()
      await t.clock.advance(2000)
      const name = t.bench.order.indexOf('/store/config/host.name')
      const census = t.bench.order.indexOf('census')
      assert.ok(name >= 0 && census >= 0, t.bench.order.join(', '))
      assert.equal(name < census ? 'name' : 'census', first, `last count ${many}: ${t.bench.order.join(', ')}`)
    }
  })

  test('phone: Which unit that switched nothing leaves the screen as it is, and one that switched is told first, then starts clean once proved', async () => {
    const t = await linkOnABench()
    t.bench.census = async () => {
      t.bench.hosts = ['fractalpi', 'raspberry pi 3']
      t.bench.chosen = 'fractalpi'
      t.bench.askedOf = 'fractalpi'
    }
    t.link.startLink()
    await t.clock.advance(2000)
    assert.equal(t.link.linkState().chosenHost, 'fractalpi')
    /* A fresh link since (Android back on screen): the relay drives nobody yet, and the tap finds nothing to switch. */
    t.bench.chosen = null
    t.bench.order.length = 0
    await t.link.chooseHost('raspberry pi 3')
    assert.deepEqual(t.bench.order.filter((x) => x === 'startClean' || x === 'computerChanged'), [], 'a tap that switched nothing wiped a correct screen')
    /* One that switched: told before any read is asked of the new computer, then a clean start and a read once proved. */
    t.bench.pick = async (name) => {
      t.bench.switched(name)
      t.bench.order.push('proved')
      t.bench.chosen = name
      return true
    }
    t.bench.order.length = 0
    await t.link.chooseHost('raspberry pi 3')
    assert.deepEqual(t.bench.order.filter((x) => ['computerChanged', 'proved', 'startClean', 'refreshAll'].includes(x)), ['computerChanged', 'proved', 'startClean', 'refreshAll'])
  })

  test('both ends: Play says where the unit is when the computer driven has none and another has one, judged by plugged, never the model', async () => {
    const r = await import('../shared/relay-rules.mjs')
    /* Justin's three, as the roll call read them: a computer with nothing plugged in still says FM3. */
    const hosts = ['MacBook Pro SG 566', 'raspberry pi 5', 'raspberry pi 3']
    const units = { 'MacBook Pro SG 566': { model: 'FM3', plugged: true }, 'raspberry pi 5': { model: 'FM3', plugged: false }, 'raspberry pi 3': { model: 'FM3', plugged: false } }
    const card = r.unitElsewhereCard({ hosts, units, chosen: 'raspberry pi 3', unitState: 'missing' })
    assert.equal(card.words, 'raspberry pi 3 has no unit plugged in. Your FM3 is on MacBook Pro SG 566.')
    assert.deepEqual(card.buttons, [{ name: 'MacBook Pro SG 566', label: 'Use the FM3 on MacBook Pro SG 566', short: 'Use the FM3', sub: 'on MacBook Pro SG 566' }])
    assert.equal(card.title, 'Your unit is on another computer')
    /* The roll call's plugged false is enough before the rig has read the unit; the rig saying it answers is never overruled. */
    assert.ok(r.unitElsewhereCard({ hosts, units, chosen: 'raspberry pi 3', unitState: 'unknown' }))
    assert.equal(r.unitElsewhereCard({ hosts, units, chosen: 'raspberry pi 3', unitState: 'present' }), null)
    /* An AM4 on a fourth, and both offered. */
    const four = [...hosts, 'studio']
    const more = r.unitElsewhereCard({ hosts: four, units: { ...units, studio: { model: 'AM4', plugged: true } }, chosen: 'raspberry pi 3', unitState: 'missing' })
    assert.equal(more.words, 'raspberry pi 3 has no unit plugged in. Your FM3 is on MacBook Pro SG 566, and your AM4 is on studio.')
    assert.deepEqual(more.buttons.map((b) => b.label), ['Use the FM3 on MacBook Pro SG 566', 'Use the AM4 on studio'])
    /* Never: with one computer; with the one driven having a unit; with the other only saying FM3 with nothing plugged in; with the other unit's computer sharing a name it cannot be asked apart by. */
    assert.equal(r.unitElsewhereCard({ hosts: ['raspberry pi 3'], units, chosen: 'raspberry pi 3', unitState: 'missing' }), null)
    assert.equal(r.unitElsewhereCard({ hosts, units, chosen: 'MacBook Pro SG 566', unitState: 'present' }), null)
    assert.equal(r.unitElsewhereCard({ hosts: ['raspberry pi 5', 'raspberry pi 3'], units, chosen: 'raspberry pi 3', unitState: 'missing' }), null, 'a computer with nothing plugged in was offered for its model')
    assert.equal(r.unitElsewhereCard({ hosts: ['raspberrypi', 'raspberrypi', 'raspberry pi 3'], units: { raspberrypi: { model: 'FM3', plugged: true }, 'raspberry pi 3': { model: 'FM3', plugged: false } }, chosen: 'raspberry pi 3', unitState: 'missing' }), null)
    /* Nothing driven, or a unit the computer says is there but not answering, says nothing. */
    assert.equal(r.unitElsewhereCard({ hosts, units, chosen: null, unitState: 'missing' }), null)
    assert.equal(r.unitElsewhereCard({ hosts, units, chosen: 'raspberry pi 3', unitState: 'silent' }), null)
    for (const words of [card.words, more.words, card.title, ...more.buttons.map((b) => b.label)]) assert.ok(!/this phone/i.test(words), words)
    /* The phone: in place of the raw card, with each button Which unit's own pick, and the units asked again while it is up. */
    const stage = read('mobile/src/screens/Stage.js')
    assert.match(stage, /unitElsewhereCard\(\{ hosts: computers\?\.hosts, units: computers\?\.units, chosen: computers\?\.chosenHost, unitState \}\)/)
    assert.match(stage, /const fault = noDevice\(useRig\(ofError\), whereCard \|\| missingCard\)/, 'the raw "No Fractal device found" card is still up under the one that says where the unit is')
    assert.match(stage, /const noDevice = \(fault, where\) => \(where && NO_DEVICE\.test\(String\(fault\)\) \? null : fault\)/)
    /* The unit over the computer: the phone's button label is one line (Press), and the computer's name, the reason the button is there, was cut off at 320 wide. Its line under is two. */
    assert.match(stage, /buttons=\{whereCard\.buttons\.map\(\(b\) => \(\{ key: b\.name, label: b\.short, sub: b\.sub, onPress: \(\) => chooseHost\(b\.name\) \}\)\)\}/, 'the phone puts the computer’s name on the button’s one line, where a narrow phone cuts it off')
    const card2 = read('mobile/src/components/ComputerCard.js')
    assert.match(card2, /<Press\s+key=\{b\.key \|\| b\.label\}\s+label=\{busy === i \? 'Switching…' : b\.label\}\s+sub=\{b\.sub\}/)
    const press = read('mobile/src/components/Press.js')
    assert.match(press, /<Text\s+numberOfLines=\{1\}[\s\S]{0,240}\{label\}/, 'Press’s label is no longer one line: say so here')
    assert.match(press, /\{sub \? \(\s*<Text\s+numberOfLines=\{2\}/, 'the line under a Press is no longer two lines: the computer’s name may be cut')
    /* Spoken by VoiceOver as the fault it stands in for was (the Toast): VoiceOver does not read a live region. Both cards are this one component. */
    assert.match(card2, /useEffect\(\(\) => \{\s*if \(words && Platform\.OS === 'ios'\) AccessibilityInfo\.announceForAccessibility\(words\)\s*\}, \[words\]\)/, 'the card comes up in silence under VoiceOver')
    assert.match(card2, /accessibilityLiveRegion="polite"/, 'TalkBack no longer hears the card')
    assert.equal(stage.match(/<ComputerCard\b/g)?.length, 2, 'a card on Play that is not ComputerCard is not said aloud')
    assert.match(stage, /useEffect\(\(\) => \(watchingUnits \? watchUnits\(\) : undefined\), \[watchingUnits\]\)/)
    /* The browser: in the notice that stands where Play would be, the same words and buttons. */
    const app = read('src/App.jsx')
    assert.match(app, /unitElsewhereCard\(\{ hosts: link\.hosts, units: link\.units, chosen: link\.chosenHost, unitState: 'missing' \}\)/)
    assert.match(app, /<h2>\{elsewhere \? elsewhere\.title : missingHere\?\.title \|\| fault\.title\}<\/h2>\s*\{missingHere \? <p>[\s\S]{0,700}\) : null\}\s*\{\/\*[^*]*\*\/\}\s*\{unitAway && !elsewhere \? null : <p>\{elsewhere \? elsewhere\.words : fault\.body\}<\/p>\}/)
    /* Through the card's own buttons, which say Switching… on the one pressed and wait while its pick is proved: App's busy never moved for it, so a press looked like nothing. */
    assert.match(app, /\{elsewhere \? <CardButtons buttons=\{elsewhere\.buttons\.map\(\(b\) => \(\{ key: b\.name, label: b\.label, onClick: \(\) => chooseHost\(b\.name\) \}\)\)\} \/> : null\}/, 'the notice’s buttons give no sign while the pick is proved')
    const webCard = read('src/components/ComputerCard.jsx')
    assert.match(webCard, /export function CardButtons[\s\S]{0,600}disabled=\{busy !== null && busy !== i\}[\s\S]{0,200}setBusy\(i\)\s*try \{\s*await b\.onClick\?\.\(\)\s*\} finally \{\s*setBusy\(null\)[\s\S]{0,120}\{busy === i \? 'Switching…' : b\.label\}/)
    assert.match(webCard, /<CardButtons buttons=\{buttons\} \/>/, 'the card on Play and the notice have different buttons')
    /* And not "this comes back on its own" under it: the unit does not come back to the one driven by itself. */
    assert.match(app, /\{unitAway \? null : <p className="notice-note">Still checking every few seconds — this comes back on its own\.<\/p>\}/, 'the notice that says the unit is elsewhere still says it comes back on its own')
    assert.match(app, /useEffect\(\(\) => \(watchingUnits \? watchUnits\(\) : undefined\), \[watchingUnits\]\)/)
  })

  test('both ends: Play names a pick that never answers with the one driven, and Which unit lists it grayed with Forget', async () => {
    const r = await import('../shared/relay-rules.mjs')
    const hosts = ['MacBook Pro SG 566', 'raspberry pi 5']
    const units = { 'MacBook Pro SG 566': { model: 'FM3', plugged: true }, 'raspberry pi 5': { model: 'FM3', plugged: false } }
    assert.equal(r.missingPickCard({ missing: 'fractalpi', driving: 'MacBook Pro SG 566', hosts, units }).words, 'fractalpi, picked under Which unit, isn’t answering. Playing the FM3 on MacBook Pro SG 566.')
    /* Judged by plugged, never the model: a computer with nothing plugged in still says FM3. */
    assert.equal(r.missingPickCard({ missing: 'fractalpi', driving: 'raspberry pi 5', hosts, units }).words, 'fractalpi, picked under Which unit, isn’t answering. Using raspberry pi 5 instead, which has no unit plugged in. Your FM3 is on MacBook Pro SG 566.')
    /* And the rig saying the unit on the one driven is missing, which the roll call had not seen: said the same. A computer whose unit is not known says neither. */
    assert.equal(r.missingPickCard({ missing: 'fractalpi', driving: 'MacBook Pro SG 566', hosts, units, unitState: 'missing' }).words, 'fractalpi, picked under Which unit, isn’t answering. Using MacBook Pro SG 566 instead, which has no unit plugged in.')
    assert.equal(r.missingPickCard({ missing: 'fractalpi', driving: 'MacBook Pro SG 566', hosts, units: {} }).words, 'fractalpi, picked under Which unit, isn’t answering. Using MacBook Pro SG 566 instead.')
    /* Nothing to say: one computer, the pick driven, the pick listed after all, or nothing driven. */
    assert.equal(r.missingPickCard({ missing: 'fractalpi', driving: 'MacBook Pro SG 566', hosts: ['MacBook Pro SG 566'], units }), null)
    assert.equal(r.missingPickCard({ missing: 'MacBook Pro SG 566', driving: 'MacBook Pro SG 566', hosts, units }), null)
    assert.equal(r.missingPickCard({ missing: 'raspberry pi 5', driving: 'MacBook Pro SG 566', hosts, units }), null)
    assert.equal(r.missingPickCard({ missing: 'fractalpi', driving: null, hosts, units }), null)
    assert.deepEqual(r.missingPickRow('fractalpi'), { name: 'fractalpi', label: 'fractalpi — not answering', forget: 'Forget' })
    assert.equal(r.missingPickRow(null), null)
    /* The phone: on Play, its two buttons Keep this one and the list off the unit's name; under Which unit, grayed with Forget, in Settings and the sheet. */
    const stage = read('mobile/src/screens/Stage.js')
    assert.match(stage, /missingPickCard\(\{ missing: computers\?\.missingPick, driving: computers\?\.chosenHost, hosts: computers\?\.hosts, units: computers\?\.units, unitState \}\)/)
    /* And the raw "No Fractal device found" never floats over it, hiding its first sentence: the card says the one driven has no unit. */
    assert.match(stage, /const fault = noDevice\(useRig\(ofError\), whereCard \|\| missingCard\)/, 'the raw fault floats over the card for a pick that never answers')
    assert.match(stage, /<ComputerCard\s+words=\{missingCard\.words\}[\s\S]{0,200}label: missingCard\.keep, onPress: \(\) => keepThisOne\(\)[\s\S]{0,400}label: missingCard\.list, onPress: \(\) => onOpenUnits\(\)/)
    const phoneApp = read('mobile/App.js')
    assert.match(phoneApp, /computers=\{demo \? null : link\}\s*onOpenUnits=\{\(\) => setPickLive\(true\)\}/)
    assert.match(phoneApp, /<LiveUnit[\s\S]{0,300}missing=\{link\.missingPick\}/)
    assert.match(read('mobile/src/components/LiveUnit.js'), /<MissingPick name=\{missing\} onForget=\{\(\) => forgetMissing\(\)\} \/>/)
    assert.match(read('mobile/src/screens/Settings.js'), /<MissingPick\s+name=\{missing\}\s+onForget=\{\(\) => \{\s*forgetMissing\(\)/)
    assert.match(read('mobile/src/components/MissingPick.js'), /missingPickRow\(name\)/)
    /* Grayed, and readable: at least 4.5:1 on the page and on the sheet, in both themes (silkFaint was 3.7:1 in light). */
    const row = read('mobile/src/components/MissingPick.js').match(/<Text style=\{\{ flex: 1, color: color\.(\w+),/)?.[1]
    assert.ok(row, 'the not-answering row’s ink moved: say where')
    const { contrast } = await import('../src/lib/ink.js')
    const theme = read('mobile/src/lib/theme.js')
    for (const name of ['DARK', 'LIGHT']) {
      const block = theme.slice(theme.indexOf(`const ${name} = {`), theme.indexOf('}', theme.indexOf(`const ${name} = {`)))
      const hex = (key) => block.match(new RegExp(`\\b${key}: '(#[0-9a-f]{6})'`))?.[1]
      for (const ground of ['chassis', 'panel']) {
        const ratio = contrast(hex(row), hex(ground))
        assert.ok(ratio >= 4.5, `${name.toLowerCase()}: the not-answering row is ${ratio?.toFixed(2)}:1 on ${ground}, under 4.5:1`)
      }
    }
    /* The browser: the same card on Play, its list the Which unit sheet; the row in the sheet and on the page. */
    const app = read('src/App.jsx')
    assert.match(app, /missingPickCard\(\{ missing: link\.missingPick, driving: link\.chosenHost, hosts: link\.hosts, units: link\.units \}\)/)
    /* And in the notice that stands in for Play when the one driven has no unit either: its words and its two ways out, said before where any unit is, as on the phone. */
    assert.match(app, /const missingHere =\s*link\.role === 'remote' && status === 'fault' && device\?\.connected === false\s*\? missingPickCard\(\{ missing: link\.missingPick, driving: link\.chosenHost, hosts: link\.hosts, units: link\.units, unitState: 'missing' \}\)/)
    assert.match(app, /link\.role === 'remote' && status === 'fault' && device\?\.connected === false && !missingHere\s*\? unitElsewhereCard/)
    assert.match(app, /\{missingHere \? <p>\{missingHere\.words\}<\/p> : null\}\s*\{missingHere \? \(\s*<CardButtons\s*buttons=\{\[\s*\.\.\.\(missingHere\.keep \? \[\{ label: missingHere\.keep, onClick: \(\) => keepThisOne\(\) \}\] : \[\]\),\s*\.\.\.missingHere\.buttons\.map\(\(b\) => \(\{ key: b\.name, label: b\.label, onClick: \(\) => chooseHost\(b\.name\) \}\)\),\s*\{ label: missingHere\.list, onClick: \(\) => setSheet\('units'\) \}/, 'the browser’s notice never says the pick is not answering')
    assert.match(app, /card=\{\s*link\.role === 'remote' && missingCard\s*\? \{\s*words: missingCard\.words,[\s\S]{0,120}onClick: \(\) => keepThisOne\(\)[\s\S]{0,300}onClick: \(\) => setSheet\('units'\)/)
    assert.match(read('src/components/Gig.jsx'), /\{card \? <ComputerCard words=\{card\.words\} buttons=\{card\.buttons\} \/> : null\}/)
    assert.equal(app.match(/\{missingRow \? <MissingRow row=\{missingRow\} onForget=\{\(\) => forgetMissing\(\)\} \/> : null\}/g)?.length, 2, 'the pick that does not answer is not under both of the website’s Which unit lists')
    /* Plain words, never "this phone". */
    for (const words of [r.missingPickCard({ missing: 'fractalpi', driving: 'MacBook Pro SG 566', hosts, units }).words, r.missingPickRow('x').label]) assert.ok(!/this phone|\bMac\b/.test(words.replace('MacBook', '')), words)
  })

  /*
   * A PICK THAT NEVER ANSWERS, AND THE UNIT ON A THIRD COMPUTER. The FM3
   * unplugged from the MacBook after the roll call, the AM4 on the Pi 5, and
   * the picked Pi 3 switched off: the missing pick's card won over the one
   * that says where the unit is, so neither end said the AM4 was on the
   * Pi 5, its first button, Keep this one, would have made the computer
   * with no unit the pick, and the units were not asked again while it was
   * up. On the browser the notice kept the cable advice and "this comes back
   * on its own". Now that card says where the unit is too, with its buttons
   * in place of Keep this one, and is taken as that card for all the rest.
   */
  test('both ends: a pick that never answers, the one driven with no unit and the unit on another computer: Play says where it is, with its button and no Keep this one', async () => {
    const r = await import('../shared/relay-rules.mjs')
    const hosts = ['MacBook Pro SG 566', 'raspberry pi 5']
    const units = { 'MacBook Pro SG 566': { model: 'FM3', plugged: true }, 'raspberry pi 5': { model: 'AM4', plugged: true } }
    for (const facts of [
      { units, unitState: 'missing' },
      { units: { ...units, 'MacBook Pro SG 566': { model: 'FM3', plugged: false } }, unitState: null }
    ]) {
      const card = r.missingPickCard({ missing: 'raspberry pi 3', driving: 'MacBook Pro SG 566', hosts, ...facts })
      assert.equal(card.words, 'raspberry pi 3, picked under Which unit, isn’t answering. Using MacBook Pro SG 566 instead, which has no unit plugged in. Your AM4 is on raspberry pi 5.')
      assert.equal(card.keep, null, 'Keep this one would make the computer with no unit the pick')
      assert.deepEqual(card.buttons, [{ name: 'raspberry pi 5', label: 'Use the AM4 on raspberry pi 5', short: 'Use the AM4', sub: 'on raspberry pi 5' }])
      assert.equal(card.list, 'Which unit…')
      assert.equal(card.title, 'Your unit is on another computer')
    }
    /* Nobody else with a unit: as before, Keep this one and the list. And a unit on the one driven: nothing about where. */
    const alone = r.missingPickCard({ missing: 'raspberry pi 3', driving: 'MacBook Pro SG 566', hosts, units: { ...units, 'raspberry pi 5': { model: 'FM3', plugged: false } }, unitState: 'missing' })
    assert.equal(alone.keep, 'Keep this one')
    assert.deepEqual(alone.buttons, [])
    assert.deepEqual(r.missingPickCard({ missing: 'raspberry pi 3', driving: 'MacBook Pro SG 566', hosts, units, unitState: 'present' }).buttons, [])
    /* The phone: its buttons on the card, the unit over the computer, before the list; Keep this one only when offered; and the units asked again while it is up. */
    const stage = read('mobile/src/screens/Stage.js')
    assert.match(stage, /\.\.\.\(missingCard\.keep \? \[\{ label: missingCard\.keep, onPress: \(\) => keepThisOne\(\) \}\] : \[\]\),[\s\S]{0,200}\.\.\.missingCard\.buttons\.map\(\(b\) => \(\{ key: b\.name, label: b\.short, sub: b\.sub, onPress: \(\) => chooseHost\(b\.name\) \}\)\),\s*\.\.\.\(onOpenUnits \? \[\{ label: missingCard\.list/, 'the phone’s card for a missing pick has no button for the unit on another computer')
    assert.match(stage, /const watchingUnits = Boolean\(whereCard \|\| missingCard\?\.buttons\.length\)/, 'the units are not asked again while the missing pick’s card says where the unit is')
    /* The browser: the notice's heading is the other card's, no cable advice, no "comes back on its own", the units asked again; Play's card the same buttons. */
    const app = read('src/App.jsx')
    assert.match(app, /const unitAway = Boolean\(elsewhere \|\| missingHere\?\.buttons\.length\)/)
    assert.match(app, /const watchingUnits = Boolean\(unitAway \|\| \(link\.role === 'remote' && missingCard\?\.buttons\.length\)\)/)
    assert.match(app, /\{unitAway && !elsewhere \? null : <p>\{elsewhere \? elsewhere\.words : fault\.body\}<\/p>\}/, 'the cable advice is under a notice that says the unit is on another computer')
    assert.match(app, /\{faultWhy && !unitAway \? /)
    assert.match(app, /words: missingCard\.words,\s*buttons: \[\s*\.\.\.\(missingCard\.keep \? \[\{ label: missingCard\.keep, onClick: \(\) => keepThisOne\(\) \}\] : \[\]\),\s*\.\.\.missingCard\.buttons\.map\(\(b\) => \(\{ key: b\.name, label: b\.label, onClick: \(\) => chooseHost\(b\.name\) \}\)\),/)
    /* Never a button with no words on it. */
    assert.ok(!/label: missing(Card|Here)\.keep, onClick: \(\) => keepThisOne\(\) \},\s*\{/.test(app), 'Keep this one is offered with no label')
  })

  /*
   * SWITCHING… IN FULL INK. The button pressed disabled itself with the
   * others, and a disabled button is drawn at under half strength: the word
   * that says the tap took measured 1.7:1 on the phone in daylight and 2.1:1
   * on the browser's dark page, the same gray as the button not pressed, as
   * if nothing had happened. Only the others are dimmed now.
   */
  test('both ends: the card button pressed says Switching… in full ink, the others are dimmed, and a press meanwhile does nothing', async () => {
    const { contrast, mix } = await import('../src/lib/ink.js')
    /* How each end draws a button pressed (busy 0) and one not (busy 0, i 1), off its own expression. */
    const drawn = (file, attr) => {
      const src = read(file)
      const expr = src.match(/disabled=\{(busy !== [^}]*)\}/)?.[1]
      assert.ok(expr, `${file}: the card buttons' disabled moved: say where`)
      const off = new Function('busy', 'i', `return ${expr}`)
      assert.equal(off(0, 1), true, `${file}: the others are not dimmed while one is switching`)
      assert.equal(off(null, 0), false)
      assert.ok(src.includes(attr), `${file}: a screen reader is not told the button pressed is busy`)
      assert.match(src, /async \(\) => \{\s*if \(busy !== null\) return\s*setBusy\(i\)/, `${file}: a second press while one is switching starts another pick`)
      return off(0, 0)
    }
    /* The phone: a disabled Press is silkFaint at 0.45 over the card's panel; one not, silk. */
    const phoneOff = drawn('mobile/src/components/ComputerCard.js', 'busy={busy === i}')
    const press = read('mobile/src/components/Press.js')
    assert.match(press, /const ink = on \? color\.onSignal : disabled \? color\.silkFaint : color\.silk/, 'Press’s ink moved: say where')
    assert.match(press, /opacity: disabled \? 0\.45 :/, 'Press’s dimming moved: say where')
    assert.match(press, /accessibilityState=\{\{ selected: on, disabled, busy \}\}/)
    const theme = read('mobile/src/lib/theme.js')
    for (const name of ['DARK', 'LIGHT']) {
      const block = theme.slice(theme.indexOf(`const ${name} = {`), theme.indexOf('}', theme.indexOf(`const ${name} = {`)))
      const hex = (key) => block.match(new RegExp(`\\b${key}: '(#[0-9a-f]{6})'`))?.[1]
      const ink = phoneOff ? mix(hex('panel'), hex('silkFaint'), 0.45) : hex('silk')
      const ratio = contrast(ink, hex('panel'))
      assert.ok(ratio >= 4.5, `phone, ${name.toLowerCase()}: Switching… is ${ratio?.toFixed(2)}:1 on the card, under 4.5:1`)
    }
    /* The browser: a chip is silk-dim on the notice's panel, and button:disabled is at 0.45. */
    const webOff = drawn('src/components/ComputerCard.jsx', 'aria-busy={busy === i}')
    const css = read('src/styles.css')
    assert.match(css, /button:disabled \{\s*opacity: 0\.45;/, 'the browser’s dimming moved: say where')
    assert.match(css, /button\.chip \{[^}]*color: var\(--silk-dim\);/, 'the chip’s ink moved: say where')
    for (const [name, at] of [['dark', css.indexOf(':root {')], ['light', css.indexOf("[data-theme='light'] {")]]) {
      const block = css.slice(at, css.indexOf('}', at))
      const hex = (key) => block.match(new RegExp(`--${key}: (#[0-9a-f]{6})`))?.[1]
      const ink = webOff ? mix(hex('panel'), hex('silk-dim'), 0.45) : hex('silk-dim')
      const ratio = contrast(ink, hex('panel'))
      assert.ok(ratio >= 4.5, `browser, ${name}: Switching… is ${ratio?.toFixed(2)}:1 on the notice, under 4.5:1`)
    }
  })

  test('the roll call’s rules: one line in the log, and a pick is never left for another unit', async () => {
    const r = await import('../shared/relay-rules.mjs')
    const units = { fractalpi: { model: 'FM3', plugged: true }, 'raspberry pi 3': { model: 'AM4', plugged: false } }
    const both = ['fractalpi', 'raspberry pi 3']
    assert.equal(r.hostWithUnit, undefined, 'the pick is handed to another unit again: nothing would hand it back')
    const line = r.rollCallLine({ hosts: both, units: { fractalpi: units.fractalpi, 'raspberry pi 3': { model: 'AM4', plugged: true } }, chosen: 'raspberry pi 3', why: 'pick', addressed: true })
    assert.equal(line, 'two computers answered: fractalpi (FM3), raspberry pi 3 (AM4); driving raspberry pi 3, the one picked under Which unit, addressed')
    assert.equal(
      r.rollCallLine({ hosts: both, units, chosen: 'raspberry pi 3', why: 'pick', addressed: true }),
      'two computers answered: fractalpi (FM3), raspberry pi 3 (no unit plugged in); driving raspberry pi 3, the one picked under Which unit, addressed'
    )
    assert.match(r.rollCallLine({ hosts: both, units: {}, chosen: 'fractalpi', why: 'first', addressed: false }), /driving fractalpi, the first to answer, not addressed: a computer app on one of them is too old to be asked alone$/)
    /* A proof nobody answered is not a computer app too old, and a count the link dropped under says so instead of what it found. */
    assert.match(r.rollCallLine({ hosts: both, units: {}, chosen: 'fractalpi', why: 'pick', addressed: false, proof: 0 }), /driving fractalpi, the one picked under Which unit, addressed, not proved: it did not answer when asked alone$/)
    assert.match(r.rollCallLine({ hosts: both, units: {}, chosen: 'fractalpi', why: 'pick', addressed: false, proof: 2 }), /too old to be asked alone$/)
    assert.equal(r.rollCallLine({ hosts: both, units: {}, chosen: 'fractalpi', cut: true }), 'two computers answered: fractalpi (unit not known), raspberry pi 3 (unit not known); the link dropped before the count was done: counted again when the link is back')
    assert.equal(r.rollCallLine({ hosts: ['Studio'], missing: 'Old Mac' }), 'one computer answered: Studio; Old Mac, the one picked under Which unit, did not answer')
    /* Words a person may read: plain, and never "this phone". */
    for (const words of [line, r.rollCallLine({ hosts: both, units, chosen: 'fractalpi', why: 'first' })]) assert.ok(!/this phone|\bMac\b/.test(words), words)
    /* The pick, kept for each account in the one key; the bare name 1.87.47 kept is there for the first account to take. */
    assert.deepEqual(r.readPicks('raspberry pi 3'), { accounts: {}, legacy: 'raspberry pi 3' })
    assert.deepEqual(r.readPicks(null), { accounts: {}, legacy: null })
    const kept = r.writePicks({ u1: { name: 'raspberry pi 3', many: true } })
    assert.deepEqual(r.readPicks(kept), { accounts: { u1: { name: 'raspberry pi 3', many: true } }, legacy: null })
    assert.deepEqual(r.pickEntry(undefined), { name: null, many: null })
    assert.deepEqual(r.pickEntry({ name: 'fractalpi', many: 'yes' }), { name: 'fractalpi', many: null })
    /* A name that happens to read as JSON is still a name. */
    assert.deepEqual(r.readPicks('123'), { accounts: {}, legacy: '123' })
    assert.deepEqual(r.readPicks('true'), { accounts: {}, legacy: 'true' })
    /* An object of any other shape is no pick, and never the first account's computer under the whole of its text. */
    assert.deepEqual(r.readPicks('{"accounts":null}'), { accounts: {}, legacy: null })
    assert.deepEqual(r.readPicks('{"version":2,"picks":{"u1":"fractalpi"}}'), { accounts: {}, legacy: null })
    assert.deepEqual(r.readPicks('{"accounts":["fractalpi"]}'), { accounts: {}, legacy: null })
    /* Two computers answering to the picked name: no computer app is to blame. */
    assert.match(
      r.rollCallLine({ hosts: ['raspberrypi', 'raspberrypi'], units: {}, chosen: 'raspberrypi', why: 'pick', addressed: false }),
      /driving raspberrypi, the one picked under Which unit, not addressed: two computers share its name$/
    )
    /* Both ends log it from the same rule, once per roll call that found two or missed the pick, and neither hands the pick to another computer. */
    for (const file of ['mobile/src/lib/relay.js', 'src/lib/remote.js']) {
      const src = read(file)
      assert.match(src, /if \(hosts\.length > 1 \|\| missing\) logDebug\('link', rollCallLine\(\{ hosts, units, chosen, why: chosenWhy, addressed: targeted, missing, proof: proofAnswers \}\)\)/, `${file} does not say the roll call`)
      assert.ok(!/hostWithUnit/.test(src), `${file} hands the pick to another unit`)
      /* The pick is kept per account. */
      assert.match(src, /accounts\[uid\] = \{ name, many: /, `${file} keeps one pick for every account`)
    }
  })

  test('phone: one of two picked by the roll call has its name read again, and a unit read off another computer is read again from a clean start', async () => {
    /* Every read of the roll call went to the pick (relay holdReads): its name again, and nothing read twice. */
    const t = await linkOnABench()
    /* A roll call takes its three windows: the name read at join is answered long before it ends. */
    t.bench.census = async () => {
      await new Promise((go) => t.clock.setTimeout(go, 4500))
      t.bench.hosts = ['fractalpi', 'raspberry pi 3']
      t.bench.chosen = 'raspberry pi 3'
      t.bench.askedOf = 'raspberry pi 3'
      t.bench.named = 'raspberry pi 3'
    }
    t.link.startLink()
    await t.clock.advance(1000)
    assert.equal(t.link.linkState().macName, 'Studio', 'the bench did not read the name at join from whoever answered first')
    await t.clock.advance(5000)
    assert.equal(t.link.linkState().macName, 'raspberry pi 3', 'Settings and the log name the computer that answered first')
    assert.equal(t.bench.requests.filter((x) => x.path === '/store/config/host.name').length, 2, 'the name is not read again after the pick')
    assert.deepEqual(t.bench.order.filter((x) => x === 'refreshAll' || x === 'startClean'), ['refreshAll'], 'a unit read off the pick alone was read again')
    assert.deepEqual(t.link.linkState().hosts, ['fractalpi', 'raspberry pi 3'])
    /* Nobody picked: what was read while it listened came from whoever answered first, and goes before the second read. */
    const u = await linkOnABench()
    u.bench.census = async () => {
      await new Promise((go) => u.clock.setTimeout(go, 4500))
      u.bench.hosts = ['fractalpi', 'raspberry pi 3']
      u.bench.chosen = 'fractalpi'
      u.bench.askedOf = null
    }
    u.link.startLink()
    await u.clock.advance(6000)
    assert.deepEqual(u.bench.order.filter((x) => x === 'refreshAll' || x === 'startClean'), ['refreshAll', 'startClean', 'refreshAll'])
    /* One computer: nothing of this. */
    const one = await linkOnABench()
    one.link.startLink()
    await one.clock.advance(2000)
    assert.deepEqual(one.bench.order.filter((x) => x === 'refreshAll' || x === 'startClean'), ['refreshAll'])
    assert.equal(one.bench.requests.filter((x) => x.path === '/store/config/host.name').length, 1, 'one computer’s name was read twice')
    /* The browser's link does the same before App reads the unit again; Which unit on both ends too. */
    const web = read('src/lib/link.js')
    assert.match(web, /if \(remoteHosts\(\)\.length > 1 && remoteChosenHost\(\) !== before\) \{\s*if \(remoteReadsAskedOf\(\) !== remoteChosenHost\(\)\) computerChanged\(\)\s*readMacName\(\)\s*\}\s*set\(\{ hosts/)
    assert.match(web, /await pickHost\(name\)\s*set\(\{ hosts[\s\S]{0,200}readMacName\(\)\s*return state\.clash/)
    assert.match(web, /subscribeSwitching\(\(\) => computerChanged\(\)\)/, 'the browser is not told before a read goes to the new computer')
    /* And App's read, with the unit's answer in hand, is where the browser's clean start lands. */
    assert.match(read('src/App.jsx'), /answered = true\s*\/\*[^*]*\*\/\s*unitRead\(currentDeviceSlug\(\), \{ demo: isDemo\(\), since: unitAt \}\)\s*doneReading = beginChainRead\(\)/)
    const phone = read('mobile/src/lib/link.js')
    assert.match(phone, /const ok = await pickHost\(name\)\s*const moved = switchOwed\s*switchOwed = false[\s\S]{0,120}if \(moved\) startClean\(\)\s*readMacName\(\)/)
    assert.match(phone, /function switchedComputer\(\) \{\s*switchOwed = true\s*computerChanged\(\)\s*\}/)
    assert.match(phone, /subscribeSwitching\(switchedComputer\)/, 'the phone is not told before a read goes to the new computer')
  })

  test('phone: a link whose first /healthz went unanswered takes the roll call when the computer first answers, once, as the count at the first answer', async () => {
    const t = await linkOnABench()
    /* The Pis still starting: the first three /healthz go unanswered, and the next is answered. */
    let asked = 0
    t.bench.answer = () => new Promise((r) => t.clock.setTimeout(() => r(asked++ > 2), 300))
    t.bench.countDue = () => !t.bench.order.includes('census')
    /* Whether the computer was answering when each roll call was taken. */
    const answering = []
    t.bench.census = async () => {
      answering.push(t.bench.hostSeen)
    }
    t.link.startLink()
    await t.clock.advance(60000)
    assert.equal(t.link.linkState().link, 'connected', 'the bench computer never answered')
    assert.ok(asked > 3, 'the bench never had a /healthz go unanswered')
    assert.deepEqual(answering, [true], 'the computer answered and no roll call was taken on the link (every write went to every computer), or one was taken with nobody answering')
    /* Taken as the count at the first answer (relay.js censusHosts `late`), which holds no tap of an account whose last count heard one. */
    assert.deepEqual(t.bench.censusOptions, [{ late: true }])
    /* Its name is read after the roll call has begun holding writes, not before. */
    const order = t.bench.order
    assert.ok(order.indexOf('census') < order.indexOf('/store/config/host.name'), order.join(', '))
    /* And never in the demo, whatever the relay says (that a link is counted once is the relay's: remoteCountDue). */
    t.bench.countDue = true
    t.bench.demo = true
    await t.clock.advance(30000)
    assert.equal(t.bench.order.filter((x) => x === 'census').length, 1)
  })

  test('browser: a link whose first /healthz went unanswered takes the roll call when the computer first answers', async () => {
    const t = await webLinkOnABench()
    assert.equal(t.bench.censuses, 1, 'the bench browser’s join took no roll call')
    /* A link of its own, its first /healthz unanswered, and then answered. */
    let asked = 0
    t.bench.answer = () => new Promise((r) => t.clock.setTimeout(() => r(asked++ > 0), 300))
    t.bench.countDue = () => t.bench.censuses < 2
    t.remote.channelUp(false)
    await t.clock.advance(30000)
    assert.equal(t.link.linkState().link, 'connected', 'the bench computer never answered')
    assert.equal(t.bench.censuses, 2, 'the computer answered and no roll call was taken on the link')
    /* The join's own count as at any join, and the one at the first answer as that (remote.js censusHosts `late`). */
    assert.deepEqual(t.bench.censusOptions, [null, { late: true }])
  })

  test('phone: the log header names every computer and the one driven only when two answer, and never over Bluetooth', () => {
    /* The head lives in lib/logHead.js, where Copy Logs and a report both take it from. */
    const log = read('mobile/src/lib/logHead.js')
    const header = log.slice(log.indexOf('const throughAdapter = bluetoothOn() && !isDemo()'), log.indexOf('export const runsBefore'))
    const adapter = header.slice(header.indexOf('? { link: `Bluetooth (beta)'), header.indexOf(': {'))
    assert.ok(!/computers/.test(adapter), 'the Bluetooth header names computers')
    assert.match(header, /computers: link\.hosts\?\.length > 1 \? `\$\{link\.hosts\.join\(', '\)\}; driving \$\{link\.chosenHost \|\| 'none of them'\}` : undefined/)
    /* Absent is left out of the header altogether, so one computer's paste is what it was, and a report's head too. */
    assert.match(read('mobile/src/lib/debugLog.js'), /\.filter\(\(\[, v\]\) => v !== undefined && v !== null && v !== ''\)/)
    assert.match(read('shared/report-rules.mjs'), /export function headLines[\s\S]{0,120}\.filter\(\(\[, v\]\) => v !== undefined && v !== null && v !== ''\)/)
  })

  test('browser: the tempo 0 an AM4’s computer answers for no answer leaves Tap on its last figure', async () => {
    const ds = await import('../src/lib/deviceState.js')
    const { tempoRange } = await import('../shared/tempo.mjs')
    let bpm = 120
    ds.reset()
    ds.attachDriver({ getTempo: async () => ({ bpm }), tempoRange: () => tempoRange('am4') })
    try {
      await ds.refreshTempo()
      assert.equal(ds.getSnapshot().bpm, 120)
      bpm = 0
      await ds.refreshTempo()
      assert.equal(ds.getSnapshot().bpm, 120, 'Tap showed 0 for a unit that did not answer')
      bpm = 300
      await ds.refreshTempo()
      assert.equal(ds.getSnapshot().bpm, 120, 'a tempo past what an AM4 takes was shown')
      ds.handleEvent({ type: 'tempo', bpm: 0 })
      assert.equal(ds.getSnapshot().bpm, 120, 'an announced 0 was shown')
      bpm = 131
      await ds.refreshTempo()
      assert.equal(ds.getSnapshot().bpm, 131, 'a real tempo is not followed')
    } finally {
      ds.reset()
    }
  })

  test('browser: another unit after a real one starts clean, and a scene-name answer from the one before is dropped', async () => {
    const ds = await import('../src/lib/deviceState.js')
    let answer = null
    const asked = []
    ds.reset()
    ds.attachDriver({
      readSceneNames: (number, opts) => {
        asked.push({ number, opts })
        return new Promise((go) => (answer = go))
      }
    })
    try {
      ds.set({ preset: { number: 53, name: 'Recto 1' }, sceneNames: ['FREAK ON A LEASH', 'BLIND', '', ''], bpm: 180, chainFor: 53 })
      /* The first unit read is not another one: nothing goes. */
      assert.equal(ds.unitRead('device'), false)
      assert.equal(ds.unitRead('fm3'), false)
      assert.deepEqual(ds.getSnapshot().sceneNames.slice(0, 1), ['FREAK ON A LEASH'])
      /* A read of 53's names for the FM3, still on its way when the AM4 is read. */
      const reading = ds.refreshSceneNames(53)
      assert.equal(ds.unitRead('am4'), true, 'the AM4 after the FM3 was not another unit')
      const now = ds.getSnapshot()
      assert.deepEqual([now.sceneNames.length, now.bpm, now.chainFor], [0, null, null], 'the FM3’s names, tempo or chain stayed on the AM4')
      answer(['FREAK ON A LEASH', 'BLIND', '', ''])
      await reading
      assert.deepEqual(ds.getSnapshot().sceneNames, [], 'the FM3’s late answer was put on the AM4’s tiles')
      assert.equal(asked[0].opts.still(), false, 'the read was not told the unit had moved on')
      /* Gone missing and back is the same unit, not another. */
      assert.equal(ds.unitRead('device'), false)
      assert.equal(ds.unitRead('am4'), false)
      /* Another computer with the same model of unit: a late answer is dropped at once, and App's read starts clean. */
      ds.set({ sceneNames: ['CLEAN', 'LEAD', '', ''], bpm: 120, chainFor: 53 })
      const other = ds.refreshSceneNames(53)
      ds.computerChanged()
      assert.deepEqual(ds.getSnapshot().sceneNames.slice(0, 1), ['CLEAN'], 'the screen was cleared before App’s read had the unit’s answer')
      answer(['FROM THE OTHER ONE', '', '', ''])
      await other
      assert.deepEqual(ds.getSnapshot().sceneNames.slice(0, 1), ['CLEAN'], 'a late answer from the computer left was put on the tiles')
      assert.equal(ds.unitRead('am4'), true, 'App’s read of the new computer did not start clean')
      assert.deepEqual([ds.getSnapshot().sceneNames.length, ds.getSnapshot().bpm], [0, null])
      assert.equal(ds.unitRead('am4'), false, 'every read after starts clean again')
    } finally {
      ds.reset()
    }
  })

  test('browser: once another computer is driven, nothing is taken from a read until its unit is read, a read from before is not what starts it clean, and two demo units never do', async () => {
    const ds = await import('../src/lib/deviceState.js')
    const { tempoRange } = await import('../shared/tempo.mjs')
    let answer = null
    let bpm = 180
    const asked = []
    ds.reset()
    ds.attachDriver({
      readSceneNames: (number, opts) => {
        asked.push({ number, opts })
        return new Promise((go) => (answer = go))
      },
      getTempo: async () => ({ bpm }),
      tempoRange: () => tempoRange('fm3')
    })
    try {
      const FM3 = ['FREAK ON A LEASH', 'BLIND', '', '']
      ds.set({ preset: { number: 53, name: 'Recto 1' }, sceneNames: FM3, bpm: 180, chainFor: 53 })
      assert.equal(ds.unitRead('fm3'), false)
      /* App's read of the FM3 asks, and Which unit picks the AM4's computer while it does. */
      const asOf = ds.unitEraNow()
      ds.computerChanged()
      /* A names read made in the proof is asked of the new computer: it is neither put up nor kept under the FM3's slot. */
      const reading = ds.refreshSceneNames(53)
      assert.equal(asked[0].opts.still.unit(), false, 'the read was not told another computer is driven')
      answer(['CLEAN', 'LEAD', '', ''])
      await reading
      assert.deepEqual(ds.getSnapshot().sceneNames, FM3, 'the new computer’s names were put on the tiles before its unit was read')
      bpm = 99
      await ds.refreshTempo()
      assert.equal(ds.getSnapshot().bpm, 180, 'the new computer’s tempo was taken before its unit was read')
      /* The read that asked before the change has its answer: it is not what starts the new one clean. */
      assert.equal(ds.unitRead('fm3', { since: asOf }), false)
      assert.deepEqual(ds.getSnapshot().sceneNames, FM3)
      /* App's read for the new computer is. */
      assert.equal(ds.unitRead('am4', { since: ds.unitEraNow() }), true)
      assert.deepEqual(ds.getSnapshot().sceneNames, [])
      const after = ds.refreshSceneNames(53)
      assert.equal(asked[1].opts.still.unit(), true)
      answer(['CLEAN', 'LEAD', '', ''])
      await after
      assert.deepEqual(ds.getSnapshot().sceneNames, ['CLEAN', 'LEAD', '', ''])
      /* The demo: from one demo unit to the next is never a clean start, as on the phone. */
      ds.reset()
      ds.set({ preset: { number: 1, name: 'Demo' }, sceneNames: FM3, bpm: 120 })
      assert.equal(ds.unitRead('fm3', { demo: true }), false)
      assert.equal(ds.unitRead('am4', { demo: true }), false, 'the demo’s AM4 after its FM3 started clean')
      assert.deepEqual([ds.getSnapshot().sceneNames, ds.getSnapshot().bpm], [FM3, 120], 'the demo’s names and tempo went before the next unit was read')
      /* A real unit after the demo's is another one, as on the phone. */
      assert.equal(ds.unitRead('fm3'), true)
      const app = read('src/App.jsx')
      assert.match(app, /const unitAt = unitEraNow\(\)\s*const info = await confirmedDetect\(/, 'App’s read does not say when it asked')
    } finally {
      ds.reset()
    }
  })

  test('browser: names read once another computer is driven are not returned or kept under the unit on screen', async () => {
    const { ffx, relay } = await forgefxOnABench()
    relay.answer = async (path) => {
      if (path === '/device/detect') return { connected: true, name: 'FM3', short: 'FM3', capabilities: { scenes: 8 } }
      if (path === '/device') return {}
      if (path === '/presets/53/summary') return { number: 53, scenes: ['CLEAN', 'LEAD', '', '', '', '', '', ''] }
      return null
    }
    await ffx.detect()
    relay.handed.length = 0
    const elsewhere = Object.assign(() => true, { unit: () => false })
    assert.equal(await ffx.readSceneNames(53, { shown: () => 'Recto 1', still: elsewhere }), null)
    assert.ok(ffx.sceneNameTrace.includes('another computer is driven now — dropped'), ffx.sceneNameTrace.join(' | '))
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
    assert.ok(!relay.handed.some((h) => h.method === 'PUT'), 'names read off the new computer were kept under the unit on screen')
    /* The same unit still on screen: as before. */
    const here = Object.assign(() => true, { unit: () => true })
    assert.deepEqual((await ffx.readSceneNames(53, { shown: () => 'Recto 1', still: here })).slice(0, 2), ['CLEAN', 'LEAD'])
  })

  test('browser: the unit is not read twice at launch when every read of the roll call went to the computer it chose', () => {
    const app = read('src/App.jsx')
    assert.match(
      app,
      /lastHost\.current = link\.chosenHost\s*if \(remoteReadsAskedOf\(\) === link\.chosenHost\) return\s*if \(link\.role === 'remote' && link\.chosenHost\) read\(\)/,
      'App reads the unit again for a computer every read was already asked of'
    )
  })
}
