/**
 * EDIT'S KNOBS FOLLOW THE UNIT (mobile/src/lib/liveKnobs.js, the rules;
 * lib/liveKnobsHere.js, the panel's side; bleWire heardReport and the
 * wire's `fresh` and `ifIdle` reads), his account first, every account since 2.0.0 by lib/features
 * LIVE_KNOBS_FOR_EVERYONE.
 *
 * "Changing a parameter on the unit itself doesn't reflect on the Amp." (A
 * customer's FM9 over Bluetooth through a WIDI Master, 16 November 2026.)
 * Everything here is run, on clocks turned by hand: the rules alone with a
 * pretend read; the wire against the pretend FM9, FM3 and Axe-Fx III of
 * test/bluetooth.mjs; and the panel's hook copied beside stand-ins for React
 * and the rest of the phone, reading through that same real wire, so a knob
 * turned on the pretend unit is seen to reach the panel's knobs, and what
 * went down the line on the way is counted.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { advance, drive, fakeClock, onTheLine, seeded } from './bluetooth.mjs'

const RULES = '../mobile/src/lib/liveKnobs.js'
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

/* ------------------------------------------------------------------ */
/* The rules on their own, with a pretend read                          */
/* ------------------------------------------------------------------ */

/*
 * `b.readMs` is how long a read takes, `b.answer()` what it answers,
 * `b.fail` an error it throws instead (`{ skipped: true }` is the line
 * busy). Every read asked is in `b.reads` with when and how; every read
 * laid over the panel in `b.applied`.
 */
async function rulesBench(over = {}) {
  const L = await import(RULES)
  const clock = fakeClock()
  const b = {
    on: true,
    timer: true,
    eid: 58,
    held: null,
    tapAt: -Infinity,
    heard: false,
    readMs: 600,
    fail: null,
    reads: [],
    applied: [],
    logs: [],
    answer: () => ({ named: [{ id: 11, name: 'Gain', value: 5 }] }),
    ...over
  }
  const ends = {
    on: () => b.on,
    timer: () => b.timer,
    eid: () => b.eid,
    held: () => b.held,
    tapAt: () => b.tapAt,
    heard: () => b.heard,
    read: (how) => {
      b.reads.push({ at: clock.now(), ...how })
      const fail = b.fail
      const answer = b.answer()
      return new Promise((resolve, reject) => clock.setTimeout(() => (fail ? reject(fail) : resolve(answer)), b.readMs))
    },
    apply: (got, why) => b.applied.push({ at: clock.now(), got, why }),
    log: (line) => b.logs.push(line)
  }
  const live = L.createLiveKnobs(() => ends, clock)
  /* As the panel opens: the rules start, and its own first read (600 ms) ends. */
  live.start()
  await advance(clock, 600)
  live.loaded(600)
  return { L, b, clock, live, at: () => b.reads.map((r) => r.at), go: (ms) => advance(clock, ms) }
}

/* ------------------------------------------------------------------ */
/* The pretend units' blocks                                          */
/* ------------------------------------------------------------------ */

const KNOBS = { fm3: '../mobile/src/lib/fm3-knobs.js', fm9: '../mobile/src/lib/fm9-knobs.js', axefx3: '../mobile/src/lib/axefx3-knobs.js' }
const PREFIX = { fm3: 'FM3', fm9: 'FM9', axefx3: 'AXE3' }
/* Each unit's amp Gain (gen3-edit's own numbers: 7 on an FM3, 11 on an FM9, 1 on an Axe-Fx III). */
const GAIN = { fm3: 7, fm9: 11, axefx3: 1 }
const ON_KNOB = (x) => Math.round(x * 6553.4)

/* The amp, cab, reverb and drive, made up but fixed, four channels at each unit's own stride; the amp's Gain at 5 on every channel. */
async function settingsFor(unit) {
  const k = await import(KNOBS[unit])
  const families = k[`${PREFIX[unit]}_FAMILIES`]
  const blocks = k[`${PREFIX[unit]}_BLOCKS`]
  const random = seeded(53)
  const settings = new Map()
  for (const eid of [58, 62, 66, 118]) {
    const stride = families[blocks[eid][1]].stride
    settings.set(eid, { count: stride * 4, values: Array.from({ length: stride * 4 }, () => (random() < 0.4 ? Math.floor(random() * 6) : Math.floor(random() * 65534))) })
  }
  const amp = settings.get(58)
  for (let ch = 0; ch < 4; ch++) amp.values[ch * (amp.count / 4) + GAIN[unit]] = ON_KNOB(5)
  /* A knob turned on the unit itself: the pretend unit's own value, and nothing sent. */
  const turn = (eid, pid, ch, wire) => {
    const c = settings.get(eid)
    c.values[ch * (c.count / 4) + pid] = wire
  }
  return { settings, turn }
}

/* What a unit sends when a knob is turned on it: the block's head, its values in two pages, the foot (the 0x1F answer's own frames). */
function reportOf(t, eid, { damaged = false } = {}) {
  const { sx } = t
  const model = t.wire.model
  const { count, values } = t.unit.state.settings.get(eid)
  const page = (list) => sx.frame(model, 0x75, [0, 0, ...list.flatMap((v) => [v & 0x7f, (v >> 7) & 0x7f, (v >> 14) & 0x03])])
  const half = Math.ceil(values.length / 2)
  const second = page(values.slice(half))
  if (damaged) second[second.length - 2] ^= 0x01
  return [sx.frame(model, 0x74, [...sx.encode14(eid), ...sx.encode14(count)]), page(values.slice(0, half)), second, sx.frame(model, 0x76, [])]
}
/* Sent by the unit, unasked, starting `after` ms from now; answers when its foot lands. */
function unitReports(t, eid, after = 5, opts) {
  let at = after
  for (const f of reportOf(t, eid, opts)) at = t.say(f, at) + 2
  return at
}

const reads1F = (t, from = 0) => t.frames().slice(from).filter((f) => f[5] === 0x1f)
const gainOf = (read, unit) => read.named.find((p) => p.id === GAIN[unit]).value
const editing = (t, how = {}) => drive(t.clock, t.wire.request('/preset/blocks/58/params', { editing: true, ...how }))

/* ------------------------------------------------------------------ */
/* The panel's hook on a bench                                         */
/* ------------------------------------------------------------------ */

/*
 * lib/liveKnobsHere.js as the phone runs it, with lib/liveKnobs.js and
 * lib/useLiveKnobs.js and lib/features.js beside it as they are, and
 * stand-ins for React (a few lines that keep hooks in order and run each
 * effect after its drawing), React Native's AppState, the rig, the device
 * layer, the switch and the log. Its clock is the line's.
 *
 * The device layer's two reads go to `bench.ask(how)`: the real wire on a
 * line, by default, as lib/device sends them. The rig's knob news is
 * `bench.tell(event)`. `bench.admin` is his account; `bench.rig` the rig's
 * state; `bench.wire` what the switch answers (null: through a computer).
 */
async function hookBench(t, over = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'live-knobs-'))
  const files = {
    'package.json': '{ "type": "module" }',
    'bench.js': 'export const bench = { clock: null }\n',
    'react.js': `
      const H = (globalThis.__liveHooks = { slots: [], i: 0, effects: [] })
      const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, j) => Object.is(x, b[j]))
      export function useRef(v) { const k = H.i++; if (!H.slots[k]) H.slots[k] = { current: v }; return H.slots[k] }
      export function useCallback(fn, deps) { const k = H.i++; const was = H.slots[k]; if (was && same(was.deps, deps)) return was.fn; H.slots[k] = { fn, deps }; return fn }
      export function useEffect(fn, deps) {
        const k = H.i++
        const was = H.slots[k]
        if (was && deps && same(was.deps, deps)) return
        H.effects.push(() => { was?.cleanup?.(); const c = fn(); H.slots[k] = { deps, cleanup: typeof c === 'function' ? c : null } })
      }
      export const useSyncExternalStore = (sub, get) => get()
    `,
    'react-native.js': `import { bench } from './bench.js'
      export const AppState = { currentState: 'active', addEventListener: (type, fn) => { bench.app.add(fn); return { remove: () => bench.app.delete(fn) } } }
      bench.AppState = AppState
    `,
    'bleSwitch.js': "import { bench } from './bench.js'\nexport const bluetoothWire = () => bench.wire\n",
    'device.js': `import { bench } from './bench.js'
      export const liveBlockParams = (eid, { fresh = true, ifIdle = false } = {}) => bench.ask({ eid, fresh, ifIdle, live: true })
      export const blockParams = (eid) => bench.ask({ eid, plain: true })
      export const captureGoing = () => bench.capture === true
      export const lastTapAt = () => bench.tapAt
      export const unitReportsHeard = () => (bench.wire?.reportsHeard?.() ?? 0) > 0
    `,
    'demo.js': "import { bench } from './bench.js'\nexport const isDemo = () => bench.demo === true\n",
    'debugLog.js': "import { bench } from './bench.js'\nexport const logDebug = (where, line) => { bench.said.push(line) }\n",
    'rig.js': `import { bench } from './bench.js'
      export const useRig = (pick) => pick(bench.rig)
      export const getState = () => bench.rig
      export const onKnobNews = (fn) => { bench.news.add(fn); return () => bench.news.delete(fn) }
      export const refreshSceneState = async () => { bench.sceneReads++; return true }
    `,
    'bluetooth.js': "import { bench } from './bench.js'\nexport const useBluetoothAdmin = () => bench.admin === true\n",
    /* The switch as it stands (open to everyone since 2.0.0), or closed (`over.closed`), so a test can still ask what an account it is closed to gets. */
    'features.js': over.closed === true ? read('mobile/src/lib/features.js').replace(/^export const LIVE_KNOBS_FOR_EVERYONE = true$/m, 'export const LIVE_KNOBS_FOR_EVERYONE = false') : read('mobile/src/lib/features.js'),
    'liveKnobs.js': read('mobile/src/lib/liveKnobs.js'),
    'useLiveKnobs.js': read('mobile/src/lib/useLiveKnobs.js').replace(/from '\.\/(\w+)'/g, "from './$1.js'"),
    'liveKnobsHere.js':
      "import { bench as __bench } from './bench.js'\n" +
      read('mobile/src/lib/liveKnobsHere.js')
        .replace(/from 'react'/g, "from './react.js'")
        .replace(/from 'react-native'/g, "from './react-native.js'")
        .replace(/from '\.\/(\w+)'/g, "from './$1.js'")
        .replace(/\bDate\.now\(\)/g, '__bench.clock.now()')
        .replace(/(?<![.\w])(setTimeout|clearTimeout)\(/g, '__bench.clock.$1(')
  }
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  const { bench } = await import(at('bench.js'))
  const hook = await import(at('liveKnobsHere.js'))
  rmSync(dir, { recursive: true, force: true })
  Object.assign(bench, {
    clock: t.clock,
    app: new Set(),
    news: new Set(),
    said: [],
    asks: [],
    sceneReads: 0,
    admin: true,
    demo: false,
    capture: false,
    tapAt: -Infinity,
    wire: t.wire,
    rig: { deviceSlug: t.wire?.unit === 'axefx3' ? 'axefxiii' : t.wire?.unit, sceneIndex: 0, preset: { number: 12 }, bufferRev: 1, tunerOn: false },
    ask: (how) => {
      bench.asks.push({ at: t.clock.now(), ...how })
      const opts = how.plain ? { editing: true } : { editing: true, fresh: how.fresh, ifIdle: how.ifIdle }
      return bench.wire.request(`/preset/blocks/${how.eid}/params`, opts)
    },
    tell: (event) => {
      for (const fn of [...bench.news]) fn(event)
    },
    ...over
  })
  const H = globalThis.__liveHooks
  H.slots = []
  /* The panel, as BlockPanel holds it: its state, its setters (each draws it again), and its scroll lock from above. */
  const locks = []
  const st = {
    eid: 58,
    block: { effectId: 58, name: 'Amp 1', slug: 'amp', channel: 'A' },
    lockAbove: (on) => locks.push(on),
    params: [],
    enums: [],
    type: null,
    layout: null,
    capture: null,
    local: {},
    loading: false,
    picking: false,
    choosing: {},
    capturing: null,
    rereading: false,
    restoring: null
  }
  const sets = {
    setParams: (v) => panel.set({ params: v }),
    setEnums: (v) => panel.set({ enums: v }),
    setType: (v) => panel.set({ type: v }),
    setLayout: (v) => panel.set({ layout: v }),
    setCapture: (v) => panel.set({ capture: v })
  }
  const panel = {
    st,
    locks,
    out: null,
    draws: 0,
    draw() {
      H.i = 0
      H.effects = []
      panel.out = hook.useLiveKnobsHere({ ...st, ...sets })
      panel.draws++
      for (const run of H.effects.splice(0)) run()
      return panel.out
    },
    set(patch) {
      Object.assign(st, patch)
      return panel.draw()
    },
    /* The panel's own first read, as its effect makes it: loading, the read (fresh where its knobs follow the unit), loading over. */
    async open() {
      panel.draw()
      panel.set({ loading: true })
      const p = await drive(t.clock, panel.out.firstRead(58))
      panel.set({ params: p.named, enums: p.enums || [], type: p.type ?? null, layout: p.layout || null, loading: false })
      return p
    },
    unmount() {
      for (const s of H.slots) s?.cleanup?.()
    },
    app(status) {
      bench.AppState.currentState = status
      for (const fn of [...bench.app]) fn(status)
    }
  }
  return { bench, panel, hook }
}

const gainShown = (panel, unit = 'fm9') => panel.st.params.find((p) => p.id === GAIN[unit])?.value

/* ================================================================== */

export function run(test) {
  rulesTests(test)
  wireTests(test)
  panelTests(test)
  sourceTests(test)
}

function rulesTests(test) {
  /* ---------------------------------------------------------------- */
  /* The numbers and the merge                                         */
  /* ---------------------------------------------------------------- */

  test('live knobs: the gap is four seconds, or five times the last read, twelve after two idle minutes, fifteen once the unit has reported', async () => {
    const L = await import(RULES)
    assert.equal(L.LIVE_GAP_MS, 4000)
    assert.equal(L.LIVE_GAP_TIMES, 5)
    assert.equal(L.LIVE_IDLE_AFTER_MS, 120000)
    assert.equal(L.LIVE_IDLE_GAP_MS, 12000)
    assert.equal(L.LIVE_HEARD_GAP_MS, 15000)
    assert.equal(L.LIVE_AFTER_WRITE_MS, 2500)
    assert.equal(L.LIVE_AFTER_MOVE_MS, 3000)
    assert.equal(L.NEWS_SETTLE_MS, 400)
    assert.equal(L.NEWS_OWN_MS, 2000)
    assert.equal(L.liveGap({ lastReadMs: 0 }), 4000)
    assert.equal(L.liveGap({ lastReadMs: 650 }), 4000)
    assert.equal(L.liveGap({ lastReadMs: 800 }), 4000)
    assert.equal(L.liveGap({ lastReadMs: 801 }), 4005)
    assert.equal(L.liveGap({ lastReadMs: 1400 }), 7000)
    assert.equal(L.liveGap({ lastReadMs: 1400, idleMs: 119999 }), 7000)
    assert.equal(L.liveGap({ lastReadMs: 650, idleMs: 120000 }), 12000)
    assert.equal(L.liveGap({ lastReadMs: 3000, idleMs: 120000 }), 15000, 'idle, a slow line is still read no oftener than five times its read')
    assert.equal(L.liveGap({ lastReadMs: 650, heard: true }), 15000)
    assert.equal(L.liveGap({ lastReadMs: 4000, heard: true }), 20000)
    /* Never an AM4 or a VP4, by either of their names. */
    assert.deepEqual([...L.LIVE_SLUGS], ['fm3', 'fm9', 'axefxiii'])
    assert.deepEqual([...L.LIVE_WIRE_UNITS], ['fm3', 'fm9', 'axefx3'])
    for (const no of ['am4', 'vp4', 'axefx2', 'device', null]) assert.equal(L.liveUnit(no), false, `${no} follows the unit`)
  })

  test('live knobs: a read changes only knobs whose value differs, never one still waiting to go, and a new model is taken whole only with nothing waiting', async () => {
    const L = await import(RULES)
    const shown = [
      { id: 1, name: 'Level', value: -3 },
      { id: 11, name: 'Gain', label: 'Gain', value: 5 },
      { id: 12, name: 'Bass', value: 4 }
    ]
    /* Nothing moved: the very same list, so the panel is not drawn again. */
    const same = L.mergeKnobs(shown, shown.map((p) => ({ ...p })), {})
    assert.equal(same.list, shown)
    assert.deepEqual(same.changed, [])
    /* Gain moved: that knob alone, the others the same objects. */
    const fresh = [
      { id: 1, name: 'Level', value: -3 },
      { id: 11, name: 'Gain', label: 'Gain', value: 6.2 },
      { id: 12, name: 'Bass', value: 4 }
    ]
    const one = L.mergeKnobs(shown, fresh, {})
    assert.notEqual(one.list, shown)
    assert.equal(one.list[0], shown[0])
    assert.equal(one.list[2], shown[2])
    assert.equal(one.list[1].value, 6.2)
    assert.deepEqual(one.changed, [{ id: 11, name: 'Gain', from: 5, to: 6.2 }])
    assert.equal(L.changedWords(one.changed), 'Gain 5 → 6.2, changed on the unit')
    /* Gain still waiting to go (a finger moved it): it stays, the rest are laid over. */
    const both = fresh.map((p) => (p.id === 12 ? { ...p, value: 7 } : p))
    const held = L.mergeKnobs(shown, both, { 11: 8 })
    assert.equal(held.list[1], shown[1], 'a knob still waiting to go was laid over')
    assert.equal(held.list[2].value, 7)
    assert.deepEqual(held.changed.map((c) => c.id), [12])
    /* A pending nought is still pending. */
    assert.equal(L.mergeKnobs(shown, fresh, { 11: 0 }).list, shown)
    /* Other knobs (the model changed on the unit): whole, but not over anything waiting. */
    const other = [{ id: 30, name: 'Drive', value: 2 }]
    const whole = L.mergeKnobs(shown, other, {})
    assert.equal(whole.whole, true)
    assert.equal(whole.list, other)
    const waits = L.mergeKnobs(shown, other, { 12: 3 })
    assert.equal(waits.held, true)
    assert.equal(waits.list, shown)
    assert.deepEqual(L.mergeKnobs(shown, null, {}), { list: shown, changed: [] })
  })

  /* ---------------------------------------------------------------- */
  /* The rules: when the timer reads                                   */
  /* ---------------------------------------------------------------- */

  test('live knobs: the timer reads afresh on a quiet line, max(4 s, 5 × the read) after the last read ended, the panel’s own first read included', async () => {
    const { b, clock, live, at, go } = await rulesBench()
    /* Opened at 0, its own read ended at 600: the first timer read 4 s after that, never sooner. */
    await go(3999)
    assert.deepEqual(at(), [])
    await go(1)
    assert.deepEqual(at(), [4600])
    assert.deepEqual(b.reads[0], { at: 4600, fresh: true, ifIdle: true })
    /* It took 600 ms: the next 4 s after it ended. */
    await go(4600)
    assert.deepEqual(at(), [4600, 9200])
    assert.equal(b.applied.length, 1)
    assert.equal(b.applied[0].why, 'timer')
    /* A slow read, 1.4 s: the next 7 s after it ended. */
    b.readMs = 1400
    await go(4600)
    assert.deepEqual(at(), [4600, 9200, 13800])
    await go(1400 + 6999)
    assert.equal(at().length, 3)
    await go(1)
    assert.deepEqual(at().slice(3), [15200 + 7000])
    assert.equal(clock.now(), 22200)
    /* The panel's own read ending (a copy, a choice) starts the gap again from it. */
    await go(1400)
    live.loaded(200)
    await go(3999)
    assert.equal(at().length, 4)
    await go(1)
    assert.equal(at().length, 5)
    live.stop()
    await go(60000)
    assert.equal(at().length, 5, 'a panel gone still reads')
  })

  test('live knobs: twelve seconds after two minutes with no touch; a touch, the app back or a scene brings the four back', async () => {
    const { b, clock, live, at, go } = await rulesBench({ readMs: 100 })
    await go(120000)
    const quick = at()
    /* Every 4.1 s (4 s after a 100 ms read) for the first two minutes. */
    assert.equal(quick.length, 29)
    for (let i = 1; i < quick.length; i++) assert.equal(quick[i] - quick[i - 1], 4100)
    await go(60000)
    const idle = at().slice(quick.length)
    assert.equal(idle.length, 5)
    assert.equal(idle[0], quick.at(-1) + 100 + 12000)
    for (let i = 1; i < idle.length; i++) assert.equal(idle[i] - idle[i - 1], 12100)
    /* A touch: the next is 4 s after the last read ended, not 12. */
    const back4 = async (poke, hold = 0) => {
      const n = at().length
      const lastEnd = at()[n - 1] + 100
      await go(Math.max(0, lastEnd - clock.now()))
      poke()
      const due = Math.max(lastEnd + 4000, clock.now() + hold)
      await go(due - clock.now() - 1)
      assert.equal(at().length, n, 'read before its gap')
      await go(1)
      assert.equal(at().length, n + 1, 'the gap stayed long')
      return at()[n]
    }
    assert.equal(await back4(() => live.touched()), 184000)
    /* Idle again, then a scene: the four again (and its own 3 s hold is inside it). */
    await go(130000)
    assert.equal(at().at(-1) - at().at(-2), 12100)
    await back4(() => live.moved(), 3000)
    /* Idle again, then the app away and back: read at once, then every 4.1 s. */
    await go(130000)
    const m = at().length
    assert.equal(at()[m - 1] - at()[m - 2], 12100)
    live.back()
    live.front()
    await go(0)
    assert.equal(at().length, m + 1)
    await go(4100)
    assert.equal(at().length, m + 2, 'back at the front, the gap stayed long')
    assert.ok(b.applied.length > 0)
  })

  test('live knobs: once the unit has sent its own report on this connection the timer reads every fifteen seconds', async () => {
    const { b, at, go } = await rulesBench({ readMs: 100 })
    b.heard = true
    await go(60000)
    const reads = at()
    assert.ok(reads.length >= 3 && reads.length <= 4, `${reads.length} reads in a minute`)
    assert.equal(reads[0], 600 + 15000)
    for (let i = 1; i < reads.length; i++) assert.equal(reads[i] - reads[i - 1], 15100)
  })

  test('live knobs: a finger on a knob and a write of the panel’s own are touches too: the four again after two idle minutes; and a start begins the gap afresh', async () => {
    for (const poke of ['lock', 'write']) {
      const { clock, live, at, go } = await rulesBench({ readMs: 100 })
      await go(140000)
      assert.equal(at().at(-1) - at().at(-2), 12100)
      const lastEnd = at().at(-1) + 100
      await go(Math.max(0, lastEnd - clock.now()))
      if (poke === 'lock') {
        live.lock(true)
        live.lock(false)
      } else {
        live.wrote()
        live.checked()
      }
      const n = at().length
      const due = Math.max(lastEnd + 4000, clock.now() + (poke === 'write' ? 2500 : 0))
      await go(due - clock.now() - 1)
      assert.equal(at().length, n, poke)
      await go(1)
      assert.equal(at().length, n + 1, `${poke}: the gap stayed long`)
    }
    /* Made, and started ten seconds later (the switch opened with the panel up): the first read four seconds after the start. */
    const L = await import(RULES)
    const clock = fakeClock()
    const reads = []
    const ends = { on: () => true, timer: () => true, eid: () => 58, held: () => null, tapAt: () => -Infinity, heard: () => false, read: async () => (reads.push(clock.now()), { named: [] }), apply: () => {}, log: () => {} }
    const live = L.createLiveKnobs(() => ends, clock)
    await advance(clock, 10000)
    live.start()
    await advance(clock, 3999)
    assert.deepEqual(reads, [])
    await advance(clock, 1)
    assert.deepEqual(reads, [14000])
  })

  test('live knobs: a timer read is paused while a finger is on a knob, and goes as it is let go', async () => {
    const { live, at, go } = await rulesBench()
    await go(3000)
    live.lock(true)
    await go(10000)
    assert.deepEqual(at(), [], 'read under a finger')
    live.lock(false)
    await go(0)
    /* Let go is a touch too: the gap from the last read (the panel's own, long past). */
    assert.deepEqual(at(), [13600])
  })

  test('live knobs: paused while the panel says it is busy (a value waiting, a read of its own, the tuner, a capture) and looked at again within half a second of it ending', async () => {
    const { b, at, go } = await rulesBench()
    b.held = 'a value is waiting to go'
    await go(20000)
    assert.deepEqual(at(), [])
    b.held = null
    await go(500)
    assert.equal(at().length, 1)
    assert.ok(at()[0] > 20600 && at()[0] <= 21100)
  })

  test('live knobs: paused while a write of the panel’s own is out, and for 2.5 s after its check', async () => {
    const { live, at, go } = await rulesBench()
    await go(3000)
    let done
    const writing = live.during(() => new Promise((r) => (done = r)))
    await go(8000)
    assert.deepEqual(at(), [])
    done()
    await writing
    const checked = 11600
    await go(2499)
    assert.deepEqual(at(), [])
    await go(1)
    assert.deepEqual(at(), [checked + 2500])
    /* wrote() and checked() alone, the same. */
    await go(1000)
    live.wrote()
    await go(10000)
    assert.equal(at().length, 1)
    live.checked()
    await go(2499)
    assert.equal(at().length, 1)
    await go(1)
    assert.equal(at().length, 2)
  })

  test('live knobs: paused for 3 s after a Play tap, a scene or a preset', async () => {
    const { b, live, at, go } = await rulesBench()
    await go(3500)
    /* A tap at 4100, half a second before the read was due. */
    b.tapAt = 4100
    await go(3000 - 1)
    assert.deepEqual(at(), [])
    await go(1)
    assert.deepEqual(at(), [7100])
    await go(600)
    live.moved()
    const movedAt = 7700
    await go(2999)
    assert.equal(at().length, 1)
    /* After a scene the gap is the four from the last read, and the 3 s hold, whichever is later. */
    await go(1)
    assert.equal(at().length, 1)
    await go(4000 - 3000)
    assert.deepEqual(at().slice(1), [7700 + 4000])
    assert.ok(at()[1] >= movedAt + 3000)
  })

  test('live knobs: nothing is read while the app is away; back at the front, the block is read at once, afresh, not on the quiet line’s terms', async () => {
    const { b, live, at, go } = await rulesBench()
    live.back()
    await go(30000)
    /* Not even for news of a knob, which waits for the front. */
    assert.equal(live.news({ type: 'param', effectId: 58 }), true)
    await go(30000)
    assert.deepEqual(at(), [])
    live.front()
    await go(0)
    assert.deepEqual(b.reads, [{ at: 60600, fresh: true, ifIdle: false }])
    await go(600)
    assert.equal(b.applied[0].why, 'front')
    /* And the timer goes on from that read. */
    await go(3999)
    assert.equal(at().length, 1)
    await go(1)
    assert.equal(at().length, 2)
    /* Back at the front with a finger down: owed, and read when it lifts. */
    live.back()
    live.front()
    live.lock(true)
    await go(5000)
    const n = at().length
    live.lock(false)
    await go(0)
    assert.equal(at().length, n + 1)
    assert.equal(b.reads.at(-1).ifIdle, false)
  })

  test('live knobs: a read sent before a write began is dropped, never laid over the panel, and the log says so', async () => {
    const { b, live, at, go } = await rulesBench()
    await go(4000)
    assert.equal(at().length, 1)
    /* The read is out (600 ms); a write begins 100 ms in. */
    await go(100)
    live.wrote()
    await go(500)
    assert.equal(b.applied.length, 0, 'a read sent before a write was laid over the panel')
    assert.ok(b.logs.some((l) => /not used: a change was sent while it was out/.test(l)))
    live.checked()
    /* The next read is 4 s after that one ended (past the 2.5 s after the check), and laid over as ever. */
    await go(3999)
    assert.equal(at().length, 1)
    await go(1)
    assert.deepEqual(at(), [4600, 9200])
    await go(600)
    assert.equal(b.applied.length, 1)
  })

  test('live knobs: a timer read the line was too busy for sends nothing, is not counted as a read, and is tried again half a second on', async () => {
    const { b, at, go } = await rulesBench({ readMs: 0 })
    b.fail = Object.assign(new Error('busy'), { skipped: true })
    await go(4000)
    assert.deepEqual(at(), [4600])
    await go(499)
    assert.equal(at().length, 1)
    await go(1)
    assert.deepEqual(at(), [4600, 5100])
    b.fail = null
    await go(500)
    assert.deepEqual(at(), [4600, 5100, 5600])
    assert.equal(b.applied.length, 1)
    /* The next is four seconds after the one that went. */
    await go(3999)
    assert.equal(at().length, 3)
    await go(1)
    assert.equal(at().length, 4)
    /* A read that failed (the unit did not answer) is a read: no hurry to ask again, and nothing laid over. */
    b.fail = new Error('no answer')
    await go(4000)
    assert.equal(at().length, 5)
    await go(3999)
    assert.equal(at().length, 5)
    assert.equal(b.applied.length, 2)
  })

  test('live knobs: the news of a knob moved (the computer’s param, the wire’s block report) reads the open block once, 0.4 s after the last of a run', async () => {
    const { b, live, at, go } = await rulesBench({ timer: false })
    /* Through a computer: no timer at all. */
    await go(30000)
    assert.deepEqual(at(), [])
    assert.equal(live.news({ type: 'param', effectId: 58, paramId: 11, norm: 0.6 }), true)
    await go(300)
    live.news({ type: 'param', effectId: 58, paramId: 11, norm: 0.61 })
    await go(300)
    live.news({ type: 'param', effectId: 58, paramId: 11, norm: 0.62 })
    await go(399)
    assert.deepEqual(at(), [])
    await go(1)
    assert.deepEqual(b.reads, [{ at: 31600, fresh: true, ifIdle: false }])
    await go(600)
    assert.equal(b.applied.at(-1).why, 'news')
    /* Another block's news: nothing. Nor a shape it does not know. */
    assert.equal(live.news({ type: 'param', effectId: 62, paramId: 1 }), false)
    assert.equal(live.news({ type: 'changed', scope: 'grid' }), false)
    assert.equal(live.news(null), false)
    await go(5000)
    assert.equal(at().length, 1)
    /* The wire's block report: read from the copy it made (fresh: false). */
    live.news({ type: 'blockReport', eid: 58 })
    await go(400)
    assert.deepEqual(b.reads.at(-1), { at: 37600, fresh: false, ifIdle: false })
    await go(600)
    assert.equal(b.applied.at(-1).why, 'report')
    /* A report and a param together: from the unit, the stronger. */
    live.news({ type: 'blockReport', eid: 58 })
    live.news({ type: 'param', effectId: 58 })
    live.news({ type: 'blockReport', eid: 58 })
    await go(400)
    assert.equal(b.reads.at(-1).fresh, true)
  })

  test('live knobs: news while the panel’s own write is out, or within 2 s of its check, is that write coming back, and reads nothing', async () => {
    const { live, at, go } = await rulesBench({ timer: false })
    live.wrote()
    assert.equal(live.news({ type: 'param', effectId: 58 }), false)
    await go(1000)
    live.checked()
    await go(1999)
    assert.equal(live.news({ type: 'param', effectId: 58 }), false)
    assert.equal(live.news({ type: 'blockReport', eid: 58 }), false)
    await go(5000)
    assert.deepEqual(at(), [])
    await go(1)
    assert.equal(live.news({ type: 'param', effectId: 58 }), true)
    /* And a news read still waits out the panel's own pauses (a finger, here). */
    live.lock(true)
    await go(5000)
    assert.deepEqual(at(), [])
    live.lock(false)
    await go(0)
    assert.equal(at().length, 1)
  })

  test('live knobs: closed (not his account, not a unit it follows), nothing is ever read, by timer, news or the front', async () => {
    const { b, live, at, go } = await rulesBench({ on: false })
    await go(120000)
    assert.equal(live.news({ type: 'param', effectId: 58 }), false)
    live.front()
    live.touched()
    live.moved()
    live.lock(false)
    live.loaded(10)
    await go(60000)
    assert.deepEqual(at(), [])
    assert.deepEqual(b.applied, [])
    /* Open mid-panel: from then on. */
    b.on = true
    live.kick()
    await go(0)
    assert.equal(at().length, 1)
  })
}

function wireTests(test) {
  /* ---------------------------------------------------------------- */
  /* The wire: the unit's own report, and the two reads                */
  /* ---------------------------------------------------------------- */

  /* A unit's report sent unasked, and the line let run until its foot has landed. */
  const reported = async (t, eid = 58, opts) => advance(t.clock, unitReports(t, eid, 5, opts) + 20)

  test('live knobs, the wire: the unit’s own block report is written in the log for every account, with what moved; kept and said to the panel only where its knobs follow', async () => {
    for (const on of [true, false]) {
      const { settings, turn } = await settingsFor('fm9')
      const t = await onTheLine('fm9', { edit: () => true, live: () => on, settings })
      assert.equal(gainOf(await editing(t), 'fm9'), 5)
      /* Past the 400 ms the list of what is on is kept. */
      await advance(t.clock, 1000)
      t.logs.length = 0
      const before = t.frames().length
      /* Gain turned to 6.2 on the unit's own front panel, and its report sent. */
      turn(58, GAIN.fm9, 0, ON_KNOB(6.2))
      await reported(t)
      assert.equal(t.frames().length, before, 'something was sent for a report')
      assert.deepEqual(t.logs, ['the unit reported a change to block 58 (Amp): 588 values, Gain 1 5 → 6.2 on channel A'], `${on}: ${t.logs.join(' | ')}`)
      assert.equal(t.wire.reportsHeard(), 1)
      const told = t.events.filter((e) => e.type === 'blockReport')
      const again = await editing(t)
      if (on) {
        assert.deepEqual(told.map((e) => e.eid), [58])
        /* Read from the report: the small list of what is on (its channel), and no read of the block. */
        assert.deepEqual(t.frames().slice(before).map((f) => f[5]), [0x13])
        assert.equal(gainOf(again, 'fm9'), 6.2)
        assert.equal(again.channel, 'A')
      } else {
        assert.deepEqual(told, [], 'the report was said to the screens for an account it is closed to')
        /* Exactly as before: the copy a moment old, and nothing sent. */
        assert.equal(t.frames().length, before)
        assert.equal(gainOf(again, 'fm9'), 5)
        assert.ok(!('channel' in again), 'the answer changed shape for an account it is closed to')
      }
    }
  })

  test('live knobs, the wire: a report says what it can without a read of its own, never named a change while a write of this device’s is out or for 2 s after, and a damaged one is not used', async () => {
    const { settings, turn } = await settingsFor('fm9')
    const t = await onTheLine('fm9', { edit: () => true, live: () => true, settings })
    /* Not read since the scene or preset changed: what moved is not known, and it is still kept. */
    await reported(t, 62)
    assert.match(t.logs.at(-1), /^the unit reported a change to block 62 \(Cab\): \d+ values; the app has no read of it to set this against \(none on this connection since the scene or preset last changed\), so what moved is not known$/)
    await editing(t)
    /* Nothing moved. */
    await advance(t.clock, 1000)
    await reported(t)
    assert.equal(t.logs.at(-1), 'the unit reported a change to block 58 (Amp): 588 values, all as the app last read them')
    /* A knob of another channel moved: counted, none of this channel's. */
    turn(58, GAIN.fm9, 2, ON_KNOB(9))
    await advance(t.clock, 1000)
    await reported(t)
    assert.equal(t.logs.at(-1), 'the unit reported a change to block 58 (Amp): 588 values, 1 of them not as the app last read them, no knob of channel A among them')
    const told = t.events.filter((e) => e.type === 'blockReport').length
    assert.equal(t.wire.reportsHeard(), 3)
    /* A knob written from the app, and the unit's report straight after it: that write being taken. */
    await advance(t.clock, 1000)
    t.logs.length = 0
    assert.deepEqual(await drive(t.clock, t.wire.request(`/preset/blocks/58/params/${GAIN.fm9}`, { editing: true, method: 'PUT', body: JSON.stringify({ value: 0.7, continuous: true }) })), { ok: true })
    const wrote = t.clock.now()
    await reported(t)
    await advance(t.clock, 1000)
    await reported(t)
    assert.ok(t.clock.now() - wrote < 2000)
    assert.equal(t.wire.reportsHeard(), 3, 'a write’s own report was counted as the unit’s')
    assert.equal(t.events.filter((e) => e.type === 'blockReport').length, told, 'a write’s own report was said to the panel')
    assert.deepEqual(t.logs.filter((l) => /unasked just after a change sent from the app/.test(l)).length, 1, t.logs.join(' | '))
    assert.ok(!t.logs.some((l) => /reported a change/.test(l)))
    /* 2 s after it, a report is the unit's again. */
    await advance(t.clock, 2000)
    await reported(t)
    assert.equal(t.wire.reportsHeard(), 4)
    /* Damaged on the way: said, not kept, not counted. */
    await advance(t.clock, 1000)
    await reported(t, 58, { damaged: true })
    assert.equal(t.logs.at(-1), 'the unit sent block 58 (Amp)’s settings unasked, and they came damaged: not used')
    assert.equal(t.wire.reportsHeard(), 4)
    /* Several in a second (a knob being turned): one line, the rest counted into the next. */
    t.logs.length = 0
    await advance(t.clock, 1000)
    for (let i = 0; i < 3; i++) await reported(t)
    await advance(t.clock, 1000)
    await reported(t)
    assert.equal(t.logs.length, 2, t.logs.join(' | '))
    assert.match(t.logs[1], /\(and 2 more since the last line\)$/)
    assert.equal(t.wire.reportsHeard(), 8)
    /* And a new connection starts its count again. */
    t.reconnect()
    assert.equal(t.wire.reportsHeard(), 0)

    /* A report that lands WHILE a write is still out (its short watch for a refusal), on a connection with no write before it: that write's. */
    settings.set(37, { count: 4, values: [1, 2, 3, 4] })
    const w = await onTheLine('fm9', { edit: () => true, live: () => true, settings })
    await editing(w)
    const put = w.wire.request(`/preset/blocks/58/params/${GAIN.fm9}`, { editing: true, method: 'PUT', body: JSON.stringify({ value: 0.4, continuous: true }) })
    let steps = 0
    while (!w.frames().some((f) => f[5] === 0x01 && f.length === 23) && steps++ < 5000) await advance(w.clock, 1)
    let at = 2
    for (const f of reportOf(w, 37)) at = w.say(f, at) + 1
    assert.ok(at < 60, `the small report takes ${at} ms`)
    assert.deepEqual(await drive(w.clock, put), { ok: true })
    await advance(w.clock, 3000)
    assert.equal(w.wire.reportsHeard(), 0, 'a report during a write was counted as the unit’s')
    assert.ok(w.logs.some((l) => /^the unit sent block 37 \(Input\)’s settings unasked just after a change sent from the app/.test(l)), w.logs.join(' | '))
  })

  test('live knobs, the wire: a read asked fresh skips the five-second copy, and the timer’s goes only on a quiet line; closed, both are every read', async () => {
    for (const on of [true, false]) {
      const { settings } = await settingsFor('fm9')
      const t = await onTheLine('fm9', { edit: () => true, live: () => on, settings })
      assert.equal('channel' in (await editing(t)), on, 'a read from the unit changed shape for an account it is closed to, or said no channel for his')
      const from = t.frames().length
      await editing(t)
      assert.equal(reads1F(t, from).length, 0, 'the copy was not used')
      const fresh = await editing(t, { fresh: true })
      assert.equal(reads1F(t, from).length, on ? 1 : 0)
      assert.equal(fresh.channel, on ? 'A' : undefined)
      /* The line busy (a Play read on it): the timer's read is answered skipped, with nothing of Edit's sent. */
      const mark = t.frames().length
      const play = drive(t.clock, t.wire.request('/scene'))
      const asked = t.wire.request('/preset/blocks/58/params', { editing: true, fresh: true, ifIdle: true })
      let got
      try {
        got = await drive(t.clock, asked)
      } catch (err) {
        got = err
      }
      await play
      if (on) {
        assert.equal(got.skipped, true)
        assert.equal(got.status, 409)
        assert.deepEqual(t.frames().slice(mark).map((f) => f[5]), [0x0c], 'something of Edit’s went on a busy line')
      } else assert.ok(Array.isArray(got.named), 'closed, a busy line held a read as it always has')
      /* The line busy with something not Play's (Edit's own read of another block): skipped too. */
      if (on) {
        await advance(t.clock, 3000)
        const other = drive(t.clock, t.wire.request('/preset/blocks/62/params', { editing: true, fresh: true }))
        await assert.rejects(drive(t.clock, t.wire.request('/preset/blocks/58/params', { editing: true, fresh: true, ifIdle: true })), (e) => e.skipped === true)
        await other
      }
      /* The tuner open: skipped too. Quiet: it goes, and its routine line is said once a block. */
      await advance(t.clock, 3000)
      if (on) {
        await drive(t.clock, t.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: true }) }))
        await assert.rejects(editing(t, { fresh: true, ifIdle: true }), (e) => e.skipped === true)
        await drive(t.clock, t.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: false }) }))
        await advance(t.clock, 3000)
        t.logs.length = 0
        const quiet = t.frames().length
        await editing(t, { fresh: true, ifIdle: true })
        await advance(t.clock, 100)
        await editing(t, { fresh: true, ifIdle: true })
        assert.equal(reads1F(t, quiet).length, 2)
        assert.equal(t.logs.filter((l) => /^read the Amp’s settings/.test(l)).length, 1, t.logs.join(' | '))
        assert.match(t.logs.find((l) => /^read the Amp’s settings/.test(l)), /; read again every few seconds while its knobs are open \(said once\)$/)
      }
    }
  })

  test('live knobs, the wire: a report gone quiet part-way is dropped; with Edit closed a report is only written down; the timer’s read waits for Play to read after a scene', async () => {
    const { settings, turn } = await settingsFor('fm9')
    const t = await onTheLine('fm9', { edit: () => true, live: () => true, settings })
    await editing(t)
    await advance(t.clock, 1000)
    /* A head, then nothing for three seconds, then pages and a foot: not one report. */
    const [head, ...rest] = reportOf(t, 58)
    t.say(head, 5)
    await advance(t.clock, 3000)
    let at = 5
    for (const f of rest) at = t.say(f, at) + 2
    await advance(t.clock, at + 50)
    assert.equal(t.wire.reportsHeard(), 0, 'a report gone quiet was finished by frames that came seconds later')
    assert.ok(!t.logs.some((l) => /reported a change/.test(l)))
    /* Edit closed to this account: written down, never kept nor said. */
    const shut = await onTheLine('fm9', { edit: () => false, live: () => true, settings })
    turn(58, GAIN.fm9, 0, ON_KNOB(3))
    await advance(shut.clock, unitReports(shut, 58) + 20)
    assert.equal(shut.wire.reportsHeard(), 1)
    assert.ok(shut.logs.some((l) => /^the unit reported a change to block 58 \(Amp\)/.test(l)))
    assert.deepEqual(shut.events.filter((e) => e.type === 'blockReport'), [])
    /* A scene changed: until Play has read the blocks again, the timer's read is answered skipped. */
    await advance(t.clock, 3000)
    await drive(t.clock, t.wire.request('/scene', { method: 'POST', body: JSON.stringify({ index: 2 }) }))
    await assert.rejects(editing(t, { fresh: true, ifIdle: true }), (e) => e.skipped === true)
    await drive(t.clock, t.wire.request('/preset/scene-state'))
    const n = reads1F(t).length
    await editing(t, { fresh: true, ifIdle: true })
    assert.equal(reads1F(t).length, n + 1)
  })

  test('live knobs, the wire: the late answer to the app’s own read of a block is never the unit’s report, for any account; one after the late window is', async () => {
    for (const on of [true, false]) {
      const { settings } = await settingsFor('fm9')
      /* A slow adapter: the read's first byte comes 1.1 s after it went, past the 1 s it is given. */
      const t = await onTheLine('fm9', { edit: () => true, live: () => on, settings, editLate: 1100 })
      let failed = null
      try {
        await editing(t)
      } catch (err) {
        failed = err
      }
      assert.ok(failed, 'the read was answered in time: the case is not made')
      await advance(t.clock, 3000)
      assert.equal(t.wire.reportsHeard(), 0, `${on}: the read's late answer was counted as the unit's own report: ${t.logs.join(' | ')}`)
      assert.deepEqual(t.events.filter((e) => e.type === 'blockReport'), [], `${on}: the late answer was said to the panel`)
      assert.ok(!t.logs.some((l) => /reported a change/.test(l)), `${on}: the log says the unit reports when it was the read's answer`)
      assert.equal(t.logs.filter((l) => /^a block’s settings came after the app had given up on its own read of them: taken as that read’s late answer, not a report from the unit \(said once a connection\)$/.test(l)).length, 1, t.logs.join(' | '))
      /* Past the late window, a report is the unit's again. */
      t.unit.opt.editLate = 0
      await reported(t)
      assert.equal(t.wire.reportsHeard(), 1, `${on}: the unit's own report after the window was dropped`)
    }
  })

  test('live knobs, the wire: the late window is the given-up block’s and taken once: a report on another block, or a second one on the same block, is the unit’s own', async () => {
    for (const on of [true, false]) {
      /* Block 58's read gets no answer at all; block 62's own report comes 300 ms after the read is given up. */
      {
        const { settings } = await settingsFor('fm9')
        const t = await onTheLine('fm9', { edit: () => true, live: () => on, settings, editSilent: true })
        await assert.rejects(editing(t))
        await advance(t.clock, 300)
        await reported(t, 62)
        assert.equal(t.wire.reportsHeard(), 1, `${on}: block 62’s own report was dropped as the late answer to block 58’s read: ${t.logs.join(' | ')}`)
        assert.ok(t.logs.some((l) => /^the unit reported a change to block 62/.test(l)), `${on}: ` + t.logs.join(' | '))
      }
      /* Block 58's late answer comes and is caught; then the unit's own reports, on 62 and on 58, inside the two seconds. */
      {
        const { settings, turn } = await settingsFor('fm9')
        const t = await onTheLine('fm9', { edit: () => true, live: () => on, settings, editLate: 1100 })
        await assert.rejects(editing(t))
        await advance(t.clock, 400)
        assert.equal(t.wire.reportsHeard(), 0, `${on}: the read’s late answer was counted`)
        await reported(t, 62)
        assert.equal(t.wire.reportsHeard(), 1, `${on}: the unit’s report on block 62 after the late answer had come was dropped: ${t.logs.join(' | ')}`)
        turn(58, GAIN.fm9, 0, ON_KNOB(7))
        await reported(t, 58)
        assert.equal(t.wire.reportsHeard(), 2, `${on}: a second head for block 58, a knob turned on the unit, was dropped: ${t.logs.join(' | ')}`)
        assert.equal(t.logs.filter((l) => /taken as that read’s late answer/.test(l)).length, 1)
      }
    }
  })

  test('live knobs, the wire: the first damaged report of a connection is said on its own, so the whole reports after it still have their line', async () => {
    for (const on of [true, false]) {
      const { settings, turn } = await settingsFor('fm9')
      const t = await onTheLine('fm9', { edit: () => true, live: () => on, settings })
      t.logs.length = 0
      await reported(t, 58, { damaged: true })
      for (let i = 0; i < 20; i++) {
        turn(58, GAIN.fm9, 0, ON_KNOB(1 + (i % 9)))
        await reported(t, 58)
        await advance(t.clock, 500)
      }
      await advance(t.clock, 2000)
      assert.equal(t.wire.reportsHeard(), 20)
      assert.equal(t.logs.filter((l) => /came damaged: not used$/.test(l)).length, 1, `${on}: ` + t.logs.join(' | '))
      assert.ok(t.logs.some((l) => /^the unit reported a change to block 58 \(Amp\)/.test(l)), `${on}: twenty whole reports and the log says only that one came damaged: ${t.logs.join(' | ')}`)
    }
  })

  test('live knobs, the wire: where the knobs do not follow the unit, a minute of turning a knob on it is a line every 30 s, not every second', async () => {
    for (const edit of [true, false]) {
      const { settings, turn } = await settingsFor('fm9')
      const t = await onTheLine('fm9', { edit: () => edit, live: () => false, settings })
      t.logs.length = 0
      const before = t.frames().length
      for (let i = 0; i < 240; i++) {
        turn(58, GAIN.fm9, 0, (i * 97) % 65534)
        unitReports(t, 58)
        await advance(t.clock, 250)
      }
      await advance(t.clock, 2000)
      const said = t.logs.filter((l) => /^the unit reported a change to block 58 \(Amp\)/.test(l))
      assert.ok(said.length >= 2 && said.length <= 3, `edit ${edit}: ${said.length} lines for a minute of one knob`)
      assert.match(said[1], /\(and \d+ more since the last line\)$/)
      assert.equal(t.wire.reportsHeard(), 240, 'a report was not counted')
      assert.equal(t.frames().length, before, 'something was sent for a report')
    }
  })

  test('live knobs, the wire: never an AM4: a read asked fresh or on a quiet line is every read, and a frame shaped like a report is nothing', async () => {
    const { AM4_KNOBS } = await import('../mobile/src/lib/am4-knobs.js')
    const random = seeded(29)
    const settings = new Map()
    const make = (slug, reg) => {
      const top = Math.max(...AM4_KNOBS[slug].params.filter((r) => r[2] === reg).map((r) => r[3]))
      return { count: (top + 3) * 4, values: Array.from({ length: (top + 3) * 4 }, () => Math.floor(random() * 65535)) }
    }
    settings.set(0x3a, make('amp', 0x3a))
    settings.set(0x3e, make('amp', 0x3e))
    settings.set(0x76, make('drive', 0x76))
    settings.set(0x77, make('drive', 0x76))
    const t = await onTheLine('am4', { edit: () => true, live: () => true, settings })
    const first = await editing(t)
    const from = t.frames().length
    const again = await editing(t, { fresh: true })
    assert.deepEqual(again, first)
    assert.equal(t.frames().length, from, 'an AM4 block was read again for a fresh read')
    assert.ok(!('channel' in again))
    /* A busy line: an AM4's read waits its turn as it always has, never skipped. */
    const play = drive(t.clock, t.wire.request('/scene'))
    const waited = await drive(t.clock, t.wire.request('/preset/blocks/58/params', { editing: true, fresh: true, ifIdle: true }))
    await play
    assert.equal(waited.slug, 'amp')
    assert.equal(t.wire.reportsHeard(), 0)
    assert.equal(t.unit.state.frozen, false)
  })
}

function panelTests(test) {
  /* ---------------------------------------------------------------- */
  /* The panel's hook, on the real wire                                */
  /* ---------------------------------------------------------------- */

  /* A pretend FM9 on the line, and the panel opened on its amp. */
  async function opened(unit = 'fm9', over = {}, line = {}) {
    const { settings, turn } = await settingsFor(unit)
    const t = await onTheLine(unit, { edit: () => true, live: () => over.wireLive ?? true, settings, ...line })
    const { bench, panel } = await hookBench(t, over.bench || {})
    const first = await panel.open()
    return { t, bench, panel, turn, first }
  }

  test('live knobs, the panel: a knob turned on the FM9 shows in the open panel within five seconds over Bluetooth, and only reads went down the line', async () => {
    for (const unit of ['fm9', 'fm3', 'axefx3']) {
      const { t, bench, panel, turn } = await opened(unit)
      assert.equal(gainShown(panel, unit), 5)
      const from = t.frames().length
      const asked = bench.asks.length
      turn(58, GAIN[unit], 0, ON_KNOB(6.2))
      await advance(t.clock, 5000)
      assert.equal(gainShown(panel, unit), 6.2, `${unit}: the turn on the unit did not reach the panel`)
      assert.deepEqual(bench.asks.slice(asked).map((a) => [a.fresh, a.ifIdle]), [[true, true]])
      /* What went: the small list of what is on, and one read of the block: nothing written. */
      const sent = t.frames().slice(from)
      assert.ok(sent.length >= 1 && sent.every((f) => f[5] === 0x13 || f[5] === 0x1f), sent.map((f) => f[5].toString(16)).join(' '))
      assert.equal(reads1F(t, from).length, 1)
      assert.ok(bench.said.some((l) => /^Amp 1: Gain( 1)? 5 → 6\.2, changed on the unit$/.test(l)), bench.said.join(' | '))
      /* And again five seconds on, with nothing turned: read, nothing changes, nothing said. */
      const said = bench.said.length
      const draws = panel.draws
      await advance(t.clock, 5000)
      assert.equal(reads1F(t, from).length, 2)
      assert.equal(bench.said.length, said)
      assert.equal(panel.draws, draws, 'a read with nothing changed drew the panel again')
      panel.unmount()
      await advance(t.clock, 30000)
      assert.equal(reads1F(t, from).length, 2, 'a panel gone still reads')
    }
  })

  test('live knobs, the panel: closed (not his account), it reads and sends exactly what it did: its own read from the copy, no timer, no listener, no news', async () => {
    const { t, bench, panel, turn } = await opened('fm9', { bench: { admin: false, closed: true } }, {})
    assert.deepEqual(bench.asks.map((a) => a.plain === true), [true], 'the first read was not the one the panel always made')
    assert.equal(bench.app.size, 0, 'an AppState listener for an account it is closed to')
    assert.equal(bench.news.size, 0, 'a news listener for an account it is closed to')
    const from = t.frames().length
    turn(58, GAIN.fm9, 0, ON_KNOB(9))
    bench.tell({ type: 'param', effectId: 58, paramId: 11, norm: 0.9 })
    panel.app('background')
    panel.app('active')
    await advance(t.clock, 120000)
    assert.equal(t.frames().length, from, 'something went down the line for a closed account')
    assert.equal(bench.asks.length, 1)
    assert.equal(gainShown(panel), 5)
    /* Its lock and its writes are handed straight through. */
    panel.out.lock(true)
    panel.out.lock(false)
    assert.deepEqual(panel.locks, [true, false])
    assert.equal(await panel.out.during(async () => 'done'), 'done')
    /* And the wire, closed too, keeps its copy for a read asked fresh. */
    const closed = await opened('fm9', { wireLive: false, bench: { admin: true } })
    const mark = closed.t.frames().length
    await advance(closed.t.clock, 6000)
    assert.ok(closed.bench.asks.length > 1, 'his account’s panel did not ask')
    assert.equal(reads1F(closed.t, mark).length, 0, 'a closed wire read the block afresh')
  })

  test('live knobs, the panel: never an AM4 or a VP4, never in the demo, never a block with no knobs', async () => {
    for (const over of [{ rig: { deviceSlug: 'am4' } }, { rig: { deviceSlug: 'vp4' } }, { rig: { deviceSlug: 'device' } }, { demo: true }]) {
      const { settings } = await settingsFor('fm9')
      const t = await onTheLine('fm9', { edit: () => true, live: () => true, settings })
      const { bench, panel } = await hookBench(t)
      Object.assign(bench, over.demo ? { demo: true } : {})
      if (over.rig) Object.assign(bench.rig, over.rig)
      await panel.open()
      const from = t.frames().length
      await advance(t.clock, 30000)
      bench.tell({ type: 'param', effectId: 58 })
      panel.app('active')
      await advance(t.clock, 30000)
      assert.equal(t.frames().length, from, `${JSON.stringify(over)}: read`)
      assert.equal(bench.app.size + bench.news.size, 0)
    }
    const { settings } = await settingsFor('fm9')
    const t = await onTheLine('fm9', { edit: () => true, live: () => true, settings })
    const { bench, panel } = await hookBench(t)
    panel.st.block = { ...panel.st.block, knobs: false }
    panel.draw()
    await advance(t.clock, 30000)
    assert.equal(bench.asks.length, 0)
    assert.equal(bench.app.size, 0)
  })

  test('live knobs, the panel: no timer read while the tuner is open, a capture is going, a value waits, or the panel is busy, nor for 3 s after a Play tap', async () => {
    const { t, bench, panel } = await opened()
    const reads = () => bench.asks.filter((a) => a.ifIdle).length
    const quiet = async (why, set, clear) => {
      const n = reads()
      set()
      await advance(t.clock, 20000)
      assert.equal(reads(), n, `read while ${why}`)
      clear()
      await advance(t.clock, 600)
      assert.equal(reads(), n + 1, `not read after ${why}`)
      await advance(t.clock, 5000)
    }
    await advance(t.clock, 5000)
    await quiet('the tuner was open', () => (bench.rig.tunerOn = true), () => (bench.rig.tunerOn = false))
    await quiet('a capture was going', () => (bench.capture = true), () => (bench.capture = false))
    await quiet('a value was waiting to go', () => panel.set({ local: { 11: 7 } }), () => panel.set({ local: {} }))
    /* The panel's own read: none meanwhile, however long it takes. */
    {
      const n = reads()
      panel.set({ loading: true })
      await advance(t.clock, 20000)
      assert.equal(reads(), n, 'read while the panel was reading the block itself')
      panel.set({ loading: false })
      /* And its gap is five times those 20 s: let the next be soon, as a short read of its own would make it. */
      panel.set({ loading: true })
      panel.set({ loading: false })
      await advance(t.clock, 5000)
    }
    /* The panel's own read: none meanwhile, and the gap from its end, five times what it took (1 s: 5 s). */
    {
      const n = reads()
      panel.set({ loading: true })
      await advance(t.clock, 1000)
      assert.equal(reads(), n)
      panel.set({ loading: false })
      await advance(t.clock, 4999)
      assert.equal(reads(), n, 'read sooner than five times the panel’s own read')
      await advance(t.clock, 1)
      assert.equal(reads(), n + 1)
      await advance(t.clock, 5000)
    }
    for (const flag of [{ picking: true }]) {
      const off = Object.fromEntries(Object.keys(flag).map((k) => [k, false]))
      await quiet(Object.keys(flag)[0], () => panel.set(flag), () => panel.set(off))
    }
    /* A finger on a knob: the lock the panel hands its knobs. */
    await quiet('a finger was on a knob', () => panel.out.lock(true), () => panel.out.lock(false))
    assert.deepEqual(panel.locks, [true, false], 'the lock from above was not handed on')
    /* A Play tap: 3 s. */
    const n = reads()
    bench.tapAt = t.clock.now()
    await advance(t.clock, 2999)
    const held = reads()
    assert.equal(held, n)
    await advance(t.clock, 600)
    assert.equal(reads(), n + 1)
    /* The app away: nothing; back: a fresh read at once (not the timer's). */
    panel.app('background')
    const away = bench.asks.length
    await advance(t.clock, 60000)
    assert.equal(bench.asks.length, away)
    panel.app('active')
    await advance(t.clock, 0)
    assert.deepEqual(bench.asks.slice(away).map((a) => [a.fresh, a.ifIdle]), [[true, false]])
  })

  test('live knobs, the panel: a setting being chosen, a capture picked or an Undo is a write: no read meanwhile or for 2.5 s after, and one already out is not used', async () => {
    for (const flag of [{ choosing: { 3: 1 } }, { capturing: 30 }, { rereading: true }, { restoring: { step: 'model' } }]) {
      const { t, bench, panel, turn } = await opened('fm9', {}, { rate: 2 })
      const name = Object.keys(flag)[0]
      const off = { choosing: {}, capturing: null, rereading: false, restoring: null }
      /* The timer read goes out (slowly, a byte every 2 ms); the panel begins its write while it is out. */
      turn(58, GAIN.fm9, 0, ON_KNOB(8))
      let steps = 0
      const n = bench.asks.length
      while (bench.asks.length === n && steps++ < 20000) await advance(t.clock, 5)
      await advance(t.clock, 50)
      panel.set(flag)
      await advance(t.clock, 10000)
      assert.equal(gainShown(panel), 5, `${name}: a read sent before it was laid over the panel`)
      assert.ok(bench.said.some((l) => /not used: a change was sent while it was out/.test(l)), `${name}: ${bench.said.join(' | ')}`)
      const during = bench.asks.length
      panel.set(off)
      const ended = t.clock.now()
      await advance(t.clock, 2499)
      assert.equal(bench.asks.length, during, `${name}: read within 2.5 s of the write`)
      await advance(t.clock, 20000)
      assert.ok(bench.asks.length > during, `${name}: never read again`)
      assert.ok(bench.asks[during].at >= ended + 2500)
      assert.equal(gainShown(panel), 8, `${name}: the turn never reached the panel`)
    }
  })

  test('live knobs, the panel: a knob write of its own (live.during) holds the reads, and a read never lays a value over one still waiting to go', async () => {
    const { t, bench, panel, turn } = await opened('fm9', {}, { rate: 0.5 })
    turn(58, GAIN.fm9, 0, ON_KNOB(8))
    turn(58, 12, 0, ON_KNOB(3))
    /* A read goes out; a finger moves Gain (a value waiting) while it is out, with no write yet. */
    let steps = 0
    while (!bench.asks.some((a) => a.ifIdle) && steps++ < 20000) await advance(t.clock, 5)
    panel.set({ local: { [GAIN.fm9]: 4 } })
    await advance(t.clock, 6000)
    assert.equal(gainShown(panel), 5, 'a value waiting to go was laid over')
    assert.equal(panel.st.params.find((p) => p.id === 12).value, 3, 'the other knobs were not laid over')
    /* The write itself, through the panel's writer: nothing read while it is out. */
    panel.set({ local: {} })
    let done
    const writing = panel.out.during(() => new Promise((r) => (done = r)))
    const n = bench.asks.length
    await advance(t.clock, 20000)
    assert.equal(bench.asks.length, n)
    done()
    await writing
    await advance(t.clock, 2499)
    assert.equal(bench.asks.length, n)
    await advance(t.clock, 3000)
    assert.ok(bench.asks.length > n)
    await advance(t.clock, 6000)
    assert.equal(gainShown(panel), 8)
  })

  test('live knobs, the panel: opened while the app is away it reads nothing until the front; a preset changed (its number first) holds the reads 3 s', async () => {
    const { settings } = await settingsFor('fm9')
    const t = await onTheLine('fm9', { edit: () => true, live: () => true, settings })
    const { bench, panel } = await hookBench(t)
    bench.AppState.currentState = 'background'
    panel.draw()
    panel.set({ params: [{ id: GAIN.fm9, name: 'Gain', value: 5 }] })
    await advance(t.clock, 60000)
    assert.deepEqual(bench.asks, [], 'a panel opened with the app away read')
    panel.app('active')
    await advance(t.clock, 0)
    assert.equal(bench.asks.length, 1)
    /* The preset's number moves (Play shows another preset), with no remount yet. */
    await advance(t.clock, 3000)
    const n = bench.asks.length
    bench.rig.preset = { number: 13 }
    panel.draw()
    const moved = t.clock.now()
    await advance(t.clock, 2999)
    assert.equal(bench.asks.length, n, 'read within 3 s of a preset change')
    await advance(t.clock, 6000)
    assert.ok(bench.asks.length > n)
    assert.ok(bench.asks[n].at >= moved + 3000)
    /* The scene the same. */
    await advance(t.clock, 2000)
    const m = bench.asks.length
    bench.rig.sceneIndex = 3
    panel.draw()
    const scene = t.clock.now()
    await advance(t.clock, 2999)
    assert.equal(bench.asks.length, m, 'read within 3 s of a scene change')
    await advance(t.clock, 6000)
    assert.ok(bench.asks[m].at >= scene + 3000)
  })

  test('live knobs, the panel: closed and opened again with the panel up (a sign-in), it follows from then, the gap starting afresh', async () => {
    const { t, bench, panel } = await opened('fm9', { bench: { closed: true } })
    await advance(t.clock, 6000)
    const n = bench.asks.length
    assert.ok(n >= 2)
    bench.admin = false
    panel.draw()
    await advance(t.clock, 60000)
    assert.equal(bench.asks.length, n, 'a panel closed to the account read')
    assert.equal(bench.news.size + bench.app.size, 0, 'a panel closed to the account still listens')
    bench.admin = true
    panel.draw()
    await advance(t.clock, 3999)
    assert.equal(bench.asks.length, n, 'opened again, it read before its gap')
    await advance(t.clock, 1)
    assert.equal(bench.asks.length, n + 1)
    assert.equal(bench.news.size, 1)
  })

  test('live knobs, the panel: a read that brings another model, its pages, a list setting or a capture lays each over the panel, and says so', async () => {
    const { settings } = await settingsFor('fm9')
    const t = await onTheLine('fm9', { edit: () => true, live: () => true, settings })
    let answer = { named: [{ id: 11, name: 'Gain', value: 5 }], enums: [{ id: 3, name: 'Bypass Mode', value: 0 }], type: { value: 1, name: 'Plexi' }, layout: [{ key: 'a' }], capture: { slot: 4 } }
    const { bench, panel } = await hookBench(t, { wire: null, ask: () => new Promise((r) => t.clock.setTimeout(() => r(JSON.parse(JSON.stringify(answer))), 100)) })
    panel.draw()
    panel.set({ params: answer.named, enums: answer.enums, type: answer.type, layout: answer.layout, capture: answer.capture })
    answer = { named: [{ id: 20, name: 'Drive', value: 2 }], enums: [{ id: 3, name: 'Bypass Mode', value: 1 }], type: { value: 7, name: 'Fuzz' }, layout: [{ key: 'b' }], capture: { slot: 9 } }
    bench.tell({ type: 'param', effectId: 58 })
    await advance(t.clock, 600)
    assert.deepEqual(panel.st.params, answer.named)
    assert.deepEqual(panel.st.enums, answer.enums)
    assert.deepEqual(panel.st.type, answer.type)
    assert.deepEqual(panel.st.layout, answer.layout)
    assert.deepEqual(panel.st.capture, answer.capture)
    assert.ok(bench.said.some((l) => /^Amp 1: Model Plexi → Fuzz, Drive undefined → 2, Bypass Mode 0 → 1, changed on the unit$/.test(l)), bench.said.join(' | '))
    /* Another model, and a value set waiting to go while the read was out: left whole for the next read. */
    answer = { ...answer, named: [{ id: 20, name: 'Drive', value: 4 }], type: { value: 8, name: 'Wah' } }
    bench.tell({ type: 'param', effectId: 58 })
    await advance(t.clock, 450)
    panel.set({ local: { 20: 3 } })
    await advance(t.clock, 200)
    assert.equal(panel.st.type.name, 'Fuzz', 'another model was laid over a value waiting to go')
    assert.equal(panel.st.params[0].value, 2, 'a value waiting to go was laid over')
    /* With nothing waiting, the next read takes it. */
    panel.set({ local: {} })
    bench.tell({ type: 'param', effectId: 58 })
    await advance(t.clock, 600)
    assert.equal(panel.st.type.name, 'Wah')
  })

  test('live knobs, the panel: a channel changed on the unit is not drawn under the panel’s channel: what is on is read once, and the knobs are left', async () => {
    const { t, bench, panel, turn } = await opened()
    turn(58, GAIN.fm9, 1, ON_KNOB(9))
    t.unit.state.blocks.find((b) => b.eid === 58).channel = 1
    await advance(t.clock, 5000)
    assert.equal(gainShown(panel), 5, 'channel B’s knobs were drawn under A')
    assert.equal(bench.sceneReads, 1)
    assert.ok(bench.said.some((l) => l === 'Amp 1 is on channel B on the unit, not A: what is on is read again'), bench.said.join(' | '))
    await advance(t.clock, 15000)
    assert.equal(bench.sceneReads, 1, 'what is on was read again at every read')
    /* The panel opened on B (the rig read it): its reads are laid over again. */
    panel.set({ block: { ...panel.st.block, channel: 'B' } })
    await advance(t.clock, 5000)
    assert.equal(gainShown(panel), 9)
  })

  test('live knobs, the panel: opening reads afresh (never the five-second copy), and a block report from the unit is read from the wire’s copy at once', async () => {
    const { settings, turn } = await settingsFor('fm9')
    const t = await onTheLine('fm9', { edit: () => true, live: () => true, settings })
    await editing(t)
    turn(58, GAIN.fm9, 0, ON_KNOB(7))
    const { bench, panel } = await hookBench(t)
    const mark = t.frames().length
    await panel.open()
    assert.equal(reads1F(t, mark).length, 1, 'the panel opened on the copy a moment old')
    assert.equal(gainShown(panel), 7)
    /* The unit's own report, said by the wire to the rig, and by the rig to the panel. */
    t.wire.subscribe((e) => (e.type === 'blockReport' ? bench.tell(e) : null))
    await advance(t.clock, 1000)
    turn(58, GAIN.fm9, 0, ON_KNOB(2))
    const from = t.frames().length
    await advance(t.clock, unitReports(t, 58) + 450)
    assert.equal(gainShown(panel), 2, 'the unit’s report did not reach the panel')
    assert.equal(reads1F(t, from).length, 0, 'the block was read again for a report that carried it')
    assert.equal(bench.asks.at(-1).fresh, false)
    /* And the timer, once the unit has reported, reads every fifteen seconds. */
    const n = reads1F(t, from).length
    await advance(t.clock, 14000)
    assert.equal(reads1F(t, from).length, n)
    await advance(t.clock, 2000)
    assert.equal(reads1F(t, from).length, n + 1)
  })

  test('live knobs, the panel: through a computer, the computer’s news of a knob reads the open block once, never the panel’s own write coming back, and nothing reads on a timer', async () => {
    const { settings } = await settingsFor('fm9')
    const t = await onTheLine('fm9', { edit: () => true, live: () => true, settings })
    let gain = 5
    const computer = []
    const { bench, panel } = await hookBench(t, {
      wire: null,
      ask: (how) => {
        computer.push({ at: t.clock.now(), ...how })
        return new Promise((r) => t.clock.setTimeout(() => r({ named: [{ id: 11, name: 'Gain', value: gain }] }), 80))
      }
    })
    bench.asks = computer
    panel.draw()
    panel.set({ params: [{ id: 11, name: 'Gain', value: 5 }] })
    await advance(t.clock, 60000)
    assert.deepEqual(computer, [], 'read on a timer through a computer')
    gain = 6
    bench.tell({ type: 'param', effectId: 58, paramId: 11, norm: 0.6 })
    await advance(t.clock, 200)
    bench.tell({ type: 'param', effectId: 58, paramId: 11, norm: 0.61 })
    await advance(t.clock, 399)
    assert.equal(computer.length, 0)
    await advance(t.clock, 1)
    assert.equal(computer.length, 1)
    await advance(t.clock, 100)
    assert.equal(gainShown({ st: panel.st }, 'fm9'), 6)
    /* Another block's: nothing. The panel's own write coming back: nothing, during it and for 2 s after. */
    bench.tell({ type: 'param', effectId: 62, paramId: 1 })
    let done
    const writing = panel.out.during(() => new Promise((r) => (done = r)))
    bench.tell({ type: 'param', effectId: 58, paramId: 11 })
    await advance(t.clock, 1000)
    done()
    await writing
    bench.tell({ type: 'param', effectId: 58, paramId: 11 })
    await advance(t.clock, 1900)
    bench.tell({ type: 'param', effectId: 58, paramId: 11 })
    await advance(t.clock, 5000)
    assert.equal(computer.length, 1, 'the panel’s own write coming back read the block')
    /* The app back at the front reads through the computer too. */
    panel.app('background')
    panel.app('active')
    await advance(t.clock, 0)
    assert.equal(computer.length, 2)
  })

  test('live knobs, the panel: through the computer, a read the computer could not finish (every knob at nought, no ranges, no model) is not laid over the panel', async () => {
    const { settings } = await settingsFor('fm9')
    const t = await onTheLine('fm9', { edit: () => true, live: () => true, settings })
    const good = { named: [{ id: 11, name: 'Gain', value: 5, min: 0, max: 10 }, { id: 12, name: 'Bass', value: 6, min: 0, max: 10 }], enums: [{ id: 3, name: 'Bypass Mode', value: 1 }], type: { value: 1, name: 'Plexi' }, layout: null }
    /* ForgeFX gen3.ts blockParams' catch: every knob at nought with no range, no settings, no model. */
    const failed = { named: [{ id: 11, name: 'Gain', value: 0, norm: 0 }, { id: 12, name: 'Bass', value: 0, norm: 0 }], enums: [], type: null, layout: null }
    let answer = good
    let asked = 0
    const { bench, panel } = await hookBench(t, { wire: null, ask: () => (asked++, new Promise((r) => t.clock.setTimeout(() => r(JSON.parse(JSON.stringify(answer))), 2600))) })
    panel.draw()
    panel.set({ params: good.named, enums: good.enums, type: good.type, layout: null })
    answer = failed
    panel.app('background')
    panel.app('active')
    await advance(t.clock, 3000)
    assert.ok(asked >= 1, 'the front read was not asked: the case is not made')
    assert.deepEqual(panel.st.params.map((p) => p.value), [5, 6], 'the knobs were blanked by a read the computer could not finish')
    assert.deepEqual(panel.st.enums, good.enums)
    assert.deepEqual(panel.st.type, good.type, 'the model was blanked')
    assert.ok(bench.said.some((l) => /every knob at nought and no ranges/.test(l)), bench.said.join(' | '))
    /* A model gone with good knobs is not used either. */
    answer = { ...good, type: null }
    panel.app('background')
    panel.app('active')
    await advance(t.clock, 3000)
    assert.deepEqual(panel.st.type, good.type, 'a read with no model took the model away')
    /* And a good read is still laid over it. */
    answer = { ...good, named: [{ id: 11, name: 'Gain', value: 7, min: 0, max: 10 }, { id: 12, name: 'Bass', value: 6, min: 0, max: 10 }] }
    panel.app('background')
    panel.app('active')
    await advance(t.clock, 3000)
    assert.deepEqual(panel.st.params.map((p) => p.value), [7, 6])
  })

  test('live knobs, the panel: a read already out when a finger lands is not laid over the knob under it, and the knob follows once it is let go', async () => {
    /* Over the wire: the timer's read is out, Gain is turned to 8 on the unit, a finger lands on the phone's knob. */
    {
      const { t, bench, panel, turn } = await opened('fm9', {}, { rate: 2 })
      let steps = 0
      const n = bench.asks.filter((a) => a.ifIdle).length
      while (bench.asks.filter((a) => a.ifIdle).length === n && steps++ < 20000) await advance(t.clock, 5)
      assert.ok(steps < 20000, 'no timer read went out')
      turn(58, GAIN.fm9, 0, ON_KNOB(8))
      panel.out.lock(true)
      await advance(t.clock, 10000)
      assert.equal(gainShown(panel), 5, 'the value under the finger jumped')
      assert.ok(bench.said.some((l) => /^a read of the block was not used: a finger was on a knob$/.test(l)), bench.said.join(' | '))
      panel.out.lock(false)
      await advance(t.clock, 30000)
      assert.equal(gainShown(panel), 8, 'the knob never followed once let go')
    }
    /* Through the computer, with no timer: a news read dropped for the finger is asked again once it lifts. */
    {
      const { settings } = await settingsFor('fm9')
      const t = await onTheLine('fm9', { edit: () => true, live: () => true, settings })
      let gain = 5
      const asked = []
      const { bench, panel } = await hookBench(t, { wire: null, ask: (how) => { asked.push(how); return new Promise((r) => t.clock.setTimeout(() => r({ named: [{ id: 11, name: 'Gain', value: gain, min: 0, max: 10 }] }), 300)) } })
      panel.draw()
      panel.set({ params: [{ id: 11, name: 'Gain', value: 5, min: 0, max: 10 }] })
      gain = 7
      bench.tell({ type: 'param', effectId: 58, paramId: 11 })
      await advance(t.clock, 450)
      const out = asked.length
      assert.ok(out >= 1, 'the news read was not asked: the case is not made')
      panel.out.lock(true)
      await advance(t.clock, 1000)
      assert.equal(panel.st.params[0].value, 5, 'the value under the finger jumped')
      panel.out.lock(false)
      await advance(t.clock, 2000)
      assert.ok(asked.length > out, 'the dropped news read was never asked again')
      assert.equal(panel.st.params[0].value, 7, 'the change on the unit never reached the panel')
    }
  })
}

function sourceTests(test) {
  /* ---------------------------------------------------------------- */
  /* Where it is switched, and where the panel hands itself over       */
  /* ---------------------------------------------------------------- */

  test('live knobs, the panel: a write the unit took and checked stays on the knob when the read after it fails; where the knobs do not follow, it is said as before', async () => {
    /* Edit's own writeOne, as written, run with stand-ins for what it calls. */
    const src = read('mobile/src/screens/Edit.js')
    const from = src.indexOf('writeOne.current = async ({ p, next }) => {')
    const to = src.indexOf('\n  /**\n   * Swapping the model', from)
    assert.ok(from > 0 && to > from, 'Edit’s knob write is not where this test reads it')
    const body = src.slice(from + 'writeOne.current = '.length, to).trim()
    const run = async (open, res) => {
      let params = [{ id: 7, label: 'Gain', value: 5 }]
      let local = { 7: 7 }
      const errors = []
      const deps = {
        setParamConfirmed: async () => res,
        eid: 58,
        noteEdited: () => {},
        blockParams: async () => {
          throw new Error('the read after it failed')
        },
        setParams: (f) => {
          params = typeof f === 'function' ? f(params) : f
        },
        setEnums: () => {},
        onError: (m) => errors.push(m),
        notChecked: (p) => `not checked: ${p.label}`,
        didNotTake: (p, actual) => `did not take: ${actual}`,
        setLocal: (f) => {
          local = typeof f === 'function' ? f(local) : f
        },
        live: { open },
        settledAt: (id, v) => {
          if (local[id] === v) {
            local = { ...local }
            delete local[id]
          }
        },
      }
      const writeOne = new Function(...Object.keys(deps), `return (${body})`)(...Object.values(deps))
      await writeOne({ p: params[0], next: 7 })
      return { value: params[0].value, local, errors }
    }
    /* Following the unit: taken and checked, the read after it failed. The knob shows 7 and is let go of, so the next read can correct it. */
    const took = await run(true, { ok: true })
    assert.equal(took.value, 7, 'the knob jumped back to the old number though the unit took and checked 7')
    assert.deepEqual(took.local, {}, 'the value is still held, so the reads stand back from that knob')
    assert.deepEqual(took.errors, ['the read after it failed'])
    /* A miss the check heard: the unit's own number on the knob. */
    assert.equal((await run(true, { ok: false, actual: 6 })).value, 6, 'a miss the check heard does not show what the unit holds')
    /* A write that never went is no write taken: the knob is not moved. */
    assert.equal((await run(true, { ok: false, unsent: true })).value, 5)
    /* Not following: exactly as before. */
    const closed = await run(false, { ok: true })
    assert.deepEqual([closed.value, closed.local, closed.errors], [5, { 7: 7 }, ['the read after it failed']])
  })

  test('live knobs: one switch, on for every account since 2.0.0, asked the way every such switch is: lib/useLiveKnobs for the screens, lib/bluetooth for the wire', () => {
    assert.match(read('mobile/src/lib/features.js'), /^export const LIVE_KNOBS_FOR_EVERYONE = true$/m, 'Edit’s knobs do not follow the unit for customers on 2.0.0 (open since 17 November 2026)')
    assert.equal(flat(read('mobile/src/lib/useLiveKnobs.js')).trim(), "import { useBluetoothAdmin } from './bluetooth' import { LIVE_KNOBS_FOR_EVERYONE } from './features' export const useLiveKnobs = () => { const his = useBluetoothAdmin() return LIVE_KNOBS_FOR_EVERYONE || his }")
    const ble = flat(read('mobile/src/lib/bluetooth.js'))
    assert.match(ble, /export const liveKnobsOverBluetooth = \(\) => allUnits === true \|\| LIVE_KNOBS_FOR_EVERYONE/)
    assert.match(ble, /chain: \(\) => chainOverBluetooth\(\), live: \(\) => liveKnobsOverBluetooth\(\) \}\)/, 'the wire is not asked whether this account’s knobs follow the unit')
    assert.equal((ble.match(/LIVE_KNOBS_FOR_EVERYONE/g) || []).length, 2, 'the switch is read somewhere else in lib/bluetooth')
    /* The wire asks it, and on a gen-3 unit with Edit open only. */
    const wire = flat(read('mobile/src/lib/bleWire.js'))
    assert.match(wire, /const liveOn = \(\) => !am4 && !!g3Edit && editOn\(\) && typeof live === 'function' && live\(\) === true/)
    /* The rules import nothing, so every path of them is run here. */
    assert.doesNotMatch(read('mobile/src/lib/liveKnobs.js'), /^import /m)
    /* Only the panel's hook opens it, by the switch, the unit, never the demo, never a block with no knobs. */
    assert.match(flat(read('mobile/src/lib/liveKnobsHere.js')), /const open = his === true && liveUnit\(slug\) && !isDemo\(\) && p\.block\?\.knobs !== false/)
  })

  test('live knobs: Edit’s block panel (Edit, the hold pop-up, the big screen’s panel) hands its lock, its writes and its first read through the hook, and nothing else changed', () => {
    const edit = flat(read('mobile/src/screens/Edit.js'))
    const panel = edit.slice(edit.indexOf('export function BlockPanel('), edit.indexOf('function BlockColour('))
    assert.match(panel, /onError, onScrollLock: lockAbove, modelUndo,/)
    assert.match(
      panel,
      /const \[local, setLocal\] = useState\(\{\}\) const live = useLiveKnobsHere\(\{ eid, block, lockAbove, params, enums, type, layout, capture, local, loading, picking, choosing, capturing, rereading, restoring, setParams, setEnums, setType: setType_, setLayout, setCapture \}\) const onScrollLock = live\.lock const writes = useRef\(null\)/
    )
    assert.match(panel, /writes\.current = oneWriteAtATime\(\(job\) => live\.during\(\(\) => writeOne\.current\?\.\(job\)\), \{/, 'a knob’s write is not one the reads stand back for')
    assert.match(panel, /const \[p, t\] = await Promise\.all\(\[ live\.firstRead\(eid\),/, 'the panel opens on the copy a moment old')
    assert.match(panel, /await live\.during\(\(\) => applyModel\(value\)\)/)
    assert.match(panel, /const swapIr = async \(pick\) => \{ try \{ await live\.during\(\(\) => applyCab\(pick\)\)/)
    assert.match(panel, /await live\.during\(\(\) => applyCab\(null, \{ undoable: false, back: back\.cab \}\)\)/)
    assert.equal((panel.match(/onScrollLock=\{onScrollLock\}/g) || []).length, 1, 'the knobs are not handed the lock that tells the reads a finger is down')
    assert.equal((panel.match(/\blockAbove\b/g) || []).length, 2, 'the lock from above is used past the hook')
    assert.equal((panel.match(/\blive\.\w+/g) || []).length, 8, 'the panel asks the hook for something more')
    /* A value that will not go is let go of (an independent read, 16 November 2026): pushed past a knob's end, typed past a level's, or a write that failed where the knobs follow the unit. */
    assert.match(panel, /const settledAt = \(id, v\) => setLocal\(\(prev\) => \{ if \(prev\[id\] !== v\) return prev const copy = \{ \.\.\.prev \} delete copy\[id\] return copy \}\)/, 'a value set down is let go of whatever it now holds')
    assert.match(panel, /if \(next === p\.value && !writes\.current\.busy\(p\.id\)\) return settledAt\(p\.id, next\)/, 'a value that sends nothing is left waiting, and holds every read')
    assert.match(panel, /\} catch \(err\) \{ onError\(err\.message\) if \(live\.open\) settledAt\(p\.id, next\) \} \}/, 'a write that failed leaves its value waiting where the knobs follow the unit, or lets it go where they do not')
    /* The pop-up and the big screen's panel are BlockPanel, so they follow too, by the same rules. */
    assert.match(flat(read('mobile/src/components/PopKnobs.js')), /<BlockPanel key=/)
    assert.match(flat(read('mobile/src/components/BlockSide.js')), /<BlockPanel/)
  })

  test('live knobs: the rig hands the computer’s param and the wire’s block report to a listening panel, before anything else of handleEvent', () => {
    const rig = flat(read('mobile/src/lib/rig.js'))
    const handle = rig.slice(rig.indexOf('export function handleEvent(event) {'))
    assert.match(handle, /^export function handleEvent\(event\) \{ if \(!event\) return if \(event\.type === 'beat'\) \{ unitBeatHeard\(event\.at\) return \} if \(event\.type === 'param' \|\| event\.type === 'blockReport'\) \{ for \(const fn of \[\.\.\.knobWatchers\]\) \{ try \{ fn\(event\) \} catch \{ \} \} return \}/)
  })
}
