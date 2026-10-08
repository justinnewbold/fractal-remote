/**
 * BLUETOOTH (BETA): the phone talking to the unit with no computer between.
 *
 * Everything here is checked byte for byte, because this is the one part of
 * the app that cannot be fixed over the air. The build that carries it takes
 * no updates, so a wrong frame is not a quick fix: it is another pair of
 * store builds, and an evening with the unit not answering.
 *
 * Three things are held here:
 *
 *   - the codec (mobile/src/lib/fractal-sysex.mjs): every frame in the
 *     design's table for the FM3, FM9 and Axe-Fx III, and every AM4 frame on
 *     the verified list, against the bytes a real unit was seen to take;
 *   - the wire (mobile/src/lib/bleWire.js), run against a pretend FM3 and a
 *     pretend AM4 whose answers arrive in random pieces, the way Bluetooth
 *     delivers them;
 *   - the AM4 SAFETY RULE: the AM4 has frozen twice on messages it did not
 *     expect, so every route and every check is driven against it here and
 *     every frame that went out is held to the allowlist.
 *
 * The clock is a pretend one the tests turn by hand, so a 1.5 second timeout
 * costs nothing to wait for.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SX = '../mobile/src/lib/fractal-sysex.mjs'
const WIRE = '../mobile/src/lib/bleWire.js'
const SWITCH = '../mobile/src/lib/bleSwitch.js'

const H = (hex) => (String(hex).replace(/[^0-9a-f]/gi, '').match(/../g) || []).map((x) => parseInt(x, 16))
const hex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
const catalog = JSON.parse(readFileSync(new URL('../mobile/src/data/blocks.json', import.meta.url), 'utf8'))

/* ------------------------------------------------------------------ */
/* A clock turned by hand                                              */
/* ------------------------------------------------------------------ */

function fakeClock() {
  let now = 0
  let seq = 0
  const timers = new Map()
  const earliest = () => {
    let pick = null
    for (const [id, t] of timers) if (!pick || t.at < pick.t.at || (t.at === pick.t.at && id < pick.id)) pick = { id, t }
    return pick
  }
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = ++seq
      timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn })
      return id
    },
    clearTimeout(id) {
      timers.delete(id)
    },
    nextAt: () => earliest()?.t.at ?? null,
    /* Fire the earliest timer. False when nothing is waiting. */
    next() {
      const pick = earliest()
      if (!pick) return false
      timers.delete(pick.id)
      now = Math.max(now, pick.t.at)
      pick.t.fn()
      return true
    },
    set(t) {
      now = Math.max(now, t)
    }
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

/* Turn the clock until the promise settles. */
async function drive(clock, promise) {
  let state = null
  promise.then(
    (v) => (state = { v }),
    (e) => (state = { e })
  )
  for (let turns = 0; ; turns++) {
    await flush()
    if (state) break
    if (turns > 200000) throw new Error(`still waiting at ${clock.now()} ms`)
    if (!clock.next()) {
      await flush()
      if (state) break
      throw new Error(`nothing left to happen at ${clock.now()} ms, and no answer`)
    }
  }
  if (state.e) throw state.e
  return state.v
}

/* Let the clock run on for `ms`, firing whatever falls due. */
async function advance(clock, ms) {
  const until = clock.now() + ms
  for (;;) {
    await flush()
    const at = clock.nextAt()
    if (at === null || at > until) break
    clock.next()
  }
  clock.set(until)
  await flush()
}

/* The same "random" pieces on every run and every Node. */
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ */
/* A pretend FM3 (or FM9, or III)                                      */
/* ------------------------------------------------------------------ */

const FM3_STATUS = [
  [37, 0x40],
  [42, 0x40],
  [46, 0x41],
  [58, 0x40],
  [62, 0x40],
  [66, 0x40],
  [70, 0x41],
  [71, 0x41],
  [78, 0x41],
  [90, 0x41],
  [94, 0x41],
  [118, 0x41]
]

function fakeGen3(sx, o) {
  const { say, model } = o
  const opt = {
    sceneEcho: true,
    publishedScene: true,
    publishedChannel: true,
    publishedTempo: false,
    sysexPreset: true,
    pc: true,
    numbered: 'yes',
    thru: false,
    silent: false,
    pushes: false,
    bankIn: 'cc0',
    looper: false,
    ...o
  }
  const state = {
    preset: 12,
    scene: 0,
    bpm: 120,
    page: false,
    hz: 110,
    cc0: 0,
    cc32: 0,
    names: new Map([
      [12, 'SONG 12'],
      [13, 'SONG 13'],
      [475, 'BIG ONE']
    ]),
    sceneNames: ['CLEAN', 'CRUNCH', 'LEAD', '', '', '', '', 'AMBIENT'],
    blocks: [...FM3_STATUS, ...(opt.looper ? [[166, 0x40]] : [])].map(([eid, dd]) => ({ eid, bypassed: (dd & 1) === 1, channel: (dd >> 1) & 7 })),
    pushing: false
  }
  const nameBytes = (name) => {
    const b = [...name].map((c) => c.charCodeAt(0))
    while (b.length < 32) b.push(0x20)
    return b
  }
  const reply = (fn, payload) => say(sx.frame(model, fn, payload))
  const find = (eid) => state.blocks.find((b) => b.eid === eid)
  function short(b) {
    if (!opt.pc) return
    if ((b[0] & 0xf0) === 0xb0 && b[1] === 0x00) state.cc0 = b[2]
    if ((b[0] & 0xf0) === 0xb0 && b[1] === 0x20) state.cc32 = b[2]
    if ((b[0] & 0xf0) === 0xc0) {
      const bank = opt.bankIn === 'cc0' ? state.cc0 : (state.cc0 << 7) | state.cc32
      state.preset = bank * 128 + b[1]
    }
  }
  function hear(b) {
    if (opt.thru) say([...b], 1)
    if (opt.silent) return
    if (b[0] !== 0xf0) return short(b)
    if (b[4] !== model) return
    const fn = b[5]
    const p = b.slice(6, -2)
    switch (fn) {
      case 0x0c:
        if (p[0] === 0x7f) return reply(0x0c, [state.scene])
        if (opt.publishedScene) state.scene = p[0]
        if (opt.sceneEcho) reply(0x0c, [state.scene])
        return
      case 0x0d: {
        const n = sx.decode14(p[0], p[1])
        const which = n === 0x3fff ? state.preset : opt.numbered === 'yes' ? n : opt.numbered === 'current' ? state.preset : null
        if (which === null) return
        return reply(0x0d, [...sx.encode14(which), ...nameBytes(state.names.get(which) || '')])
      }
      case 0x0e:
        return reply(0x0e, [p[0], ...nameBytes(state.sceneNames[p[0]] || '')])
      case 0x13:
        return reply(0x13, state.blocks.flatMap((bl) => [...sx.encode14(bl.eid), (bl.bypassed ? 1 : 0) | (bl.channel << 1) | (4 << 4)]))
      case 0x14:
        if (p[0] === 0x7f && p[1] === 0x7f) return reply(0x14, sx.encode14(state.bpm))
        if (opt.publishedTempo) state.bpm = sx.decode14(p[0], p[1])
        return
      case 0x0a: {
        const bl = find(sx.decode14(p[0], p[1]))
        if (!bl) return reply(0x64, [0x0a, 0x07])
        bl.bypassed = p[2] === 1
        return
      }
      case 0x0b: {
        const bl = find(sx.decode14(p[0], p[1]))
        if (!bl) return reply(0x64, [0x0b, 0x07])
        if (opt.publishedChannel) bl.channel = p[2]
        return
      }
      case 0x10:
        return
      case 0x11:
        state.pushing = p[0] === 1 && opt.pushes
        return
      case 0x12:
        state.page = p[0] === 0x1e
        return
      case 0x01: {
        const sub = sx.decode14(p[0], p[1])
        const eid = sx.decode14(p[2], p[3])
        const pid = sx.decode14(p[4], p[5])
        const v = sx.fromSeptets32(p, 6)
        if (sub === 0x24) state.scene = v
        else if (sub === 0x16) find(eid).channel = v
        else if (sub === 0x27) {
          if (opt.sysexPreset) state.preset = v
        } else if (sub === 0x09 && eid === 2 && pid === 0x20) state.bpm = Math.round(sx.bitsFloat(v))
        else if (sub === 0x19 && eid === 0x23 && pid === 2) reply(0x01, [...p.slice(0, 6), ...sx.floatSeptets(state.page ? state.hz : 0), 0, 0, 0, 0])
        else reply(0x64, [0x01, 0x04])
        return
      }
      default:
        reply(0x64, [fn, 0x04])
    }
  }
  return { state, hear, opt }
}

/* ------------------------------------------------------------------ */
/* A pretend AM4                                                       */
/* ------------------------------------------------------------------ */

function fakeAm4(sx, o) {
  const { say } = o
  const opt = { thru: false, usbEcho: false, silent: false, ...o }
  const state = {
    location: 5,
    scene: 1,
    name: 'Clean Room',
    slots: [0x3a, 0x76, 0x77, 0],
    bypass: new Map([
      [0x3a, false],
      [0x76, true],
      [0x77, false]
    ]),
    channel: new Map([
      [0x3a, 1],
      [0x76, 0],
      [0x77, 2]
    ]),
    bpm: 120,
    stored: new Map([
      [0, 'Interface'],
      [5, 'Clean Room'],
      [6, 'AC-20'],
      [7, '<EMPTY>']
    ]),
    tuner: [36, 110, -3, 1],
    frozen: false,
    unknown: []
  }
  const d14 = sx.decode14
  const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
  const f32 = (x) => u32(sx.floatBits(x))
  const ascii = (s, len) => {
    const b = [...s].map((c) => c.charCodeAt(0)).slice(0, len)
    if (b.length < len) b.push(0)
    while (b.length < len) b.push(0x20)
    return b
  }
  const close = (body) => [...body, sx.checksum(body), 0xf7]
  const head = (b) => b.slice(0, 12)
  function structureReply() {
    const raw = new Array(192).fill(0)
    raw.splice(0, 4, ...u32(state.location))
    raw.splice(8, 4, ...u32(state.scene))
    const name = [...state.name].map((c) => c.charCodeAt(0))
    raw.splice(0x10, name.length, ...name)
    state.slots.forEach((code, i) => raw.splice(0xb0 + i * 4, 4, ...u32(code)))
    return close([...H('F0 00 01 74 15 01 4E 01 00 00 1F 00 00 00 40 01'), ...sx.packMsb(raw)])
  }
  const long = (b, raw) => close([...head(b), 0, 0, ...sx.encode14(raw.length), ...sx.packChunked(raw)])
  const forty = (value, text) => {
    const raw = new Array(40).fill(0)
    raw.splice(4, 4, ...f32(value))
    const t = [...text].map((c) => c.charCodeAt(0))
    raw.splice(8, t.length, ...t)
    return raw
  }
  function hear(b) {
    if (opt.thru) say([...b], 1)
    if (b[0] !== 0xf0 || !sx.isAllowedAm4(b)) {
      /* What the real one did with a message it did not expect: stopped answering. */
      state.frozen = true
      state.unknown.push(b)
    }
    if (state.frozen || opt.silent) return
    const pidLow = d14(b[6], b[7])
    const pidHigh = d14(b[8], b[9])
    const action = d14(b[10], b[11])
    if (action === 0x1f) return say(structureReply())
    if (action === 0x12) {
      const n = sx.am4ReadU32(b, 16)
      const answer = close([...head(b), 0, 0, 0x20, 0, ...sx.packChunked(ascii(state.stored.get(n) ?? '<EMPTY>', 32))])
      return opt.slowName === n ? say(answer, 1500) : say(answer)
    }
    if (action === 0x0d && pidHigh === 0x0003) {
      const off = state.bypass.get(pidLow) === true
      return say(long(b, forty(off ? 1 : 0, off ? 'OFF' : 'ON')))
    }
    if (action === 0x0d && pidHigh === 0x07dd) {
      const raw = new Array(54).fill(0)
      raw[50] = state.channel.get(pidLow) ?? 0
      return say(long(b, raw))
    }
    if (action === 0x0d && pidLow === 0x0002) {
      const raw = forty((state.bpm - 24) / 226, `${state.bpm} BPM`)
      raw[0] = state.bpm & 0xff
      raw[1] = state.bpm >> 8
      raw[2] = 0x49
      return say(long(b, raw))
    }
    if (action === 0x10) return say(close([...head(b), 0, 0, 4, 0, ...sx.am4Float(state.tuner[pidHigh - 1])]))
    /* A write. On USB the AM4 also hands back a copy of the write itself. */
    if (opt.usbEcho) say([...b], 2)
    const value = action === 0x0001 && pidHigh === 0x000d ? sx.am4ReadU32(b, 16) : sx.am4ReadFloat(b, 16)
    if (pidLow === 0xce && pidHigh === 0x000d) state.scene = value
    else if (pidLow === 0xce && pidHigh === 0x000a) {
      state.location = value
      const name = state.stored.get(value) ?? '<EMPTY>'
      state.name = name === '<EMPTY>' ? '' : name
      state.scene = 0
    } else if (pidHigh === 0x0003) state.bypass.set(pidLow, value === 1)
    else if (pidHigh === 0x07d2) state.channel.set(pidLow, value)
    else if (pidLow === 0x0002) state.bpm = Math.round(24 + value * 226)
    /* And the 64-byte write echo it always sends after a SET. */
    say(long(b, forty(value, '')), 3)
  }
  return { state, hear, opt }
}

/* ------------------------------------------------------------------ */
/* A wire, a pretend unit, and the line between them                   */
/* ------------------------------------------------------------------ */

async function onTheLine(kind, options = {}) {
  const sx = await import(SX)
  const { createBleWire } = await import(WIRE)
  const clock = fakeClock()
  const random = seeded(options.seed ?? 7)
  const sent = []
  const events = []
  const logs = []
  const remembered = []
  const foreign = []
  let wire = null
  const joiner = sx.createJoiner({ onSysex: (f) => wire.heard(f), onShort: (m) => wire.heardShort(m) })
  const line = { lastDone: 0 }
  /* What the unit says reaches the phone in pieces, as Bluetooth delivers it, with a timing clock byte here and there. */
  const say = (bytes, after = options.delay ?? 6) => {
    let at = after
    for (let i = 0; i < bytes.length; ) {
      const n = 1 + Math.floor(random() * 9)
      const piece = bytes.slice(i, i + n)
      if (random() < 0.15) piece.splice(Math.floor(random() * (piece.length + 1)), 0, 0xf8)
      clock.setTimeout(() => joiner.push(piece), at)
      line.lastDone = Math.max(line.lastDone, clock.now() + at)
      if (random() < 0.5) at += 1
      i += n
    }
  }
  const unit = kind === 'am4' ? fakeAm4(sx, { say, ...options }) : fakeGen3(sx, { say, model: sx.MODELS[kind], ...options })
  wire = createBleWire({
    unit: kind,
    catalog,
    clock,
    methods: options.methods,
    log: (l) => logs.push(l),
    remember: (m) => remembered.push(m),
    onForeign: (name) => foreign.push(name),
    send: (b) => {
      sent.push({ at: clock.now(), bytes: [...b] })
      unit.hear([...b])
      return true
    }
  })
  wire.subscribe((e) => events.push(e))
  const get = (path) => drive(clock, wire.request(path))
  const post = (path, body) => drive(clock, wire.request(path, { method: 'POST', body: JSON.stringify(body ?? null) }))
  const frames = () => sent.map((s) => s.bytes)
  return { sx, clock, wire, unit, sent, frames, events, logs, remembered, foreign, get, post, say, line }
}

const sameFrame = (a, b) => hex(a) === hex(b)

/* ================================================================== */

export function run(test) {
  /* ---------------------------------------------------------------- */
  /* The codec: gen 3                                                  */
  /* ---------------------------------------------------------------- */

  /*
   * The design's frame table, every row, for all three model bytes. The
   * checksums are the ones computed from forgefx-midi's codec and checked
   * against the FM3 captures; the payloads are the frames themselves.
   */
  const MODELS3 = [
    ['FM3', 0x11],
    ['FM9', 0x12],
    ['Axe-Fx III', 0x10]
  ]
  const TABLE = [
    ['GET scene', '0C 7F', ['67', '64', '66'], (sx, m) => sx.buildGetScene(m)],
    ['SET scene 0 (published)', '0C 00', ['18', '1B', '19'], (sx, m) => sx.buildSetScene(m, 0)],
    ['SET scene 3 (published)', '0C 03', ['1B', '18', '1A'], (sx, m) => sx.buildSetScene(m, 3)],
    ['SET scene 3 (FM3-Edit)', '01 24 00 00 00 01 00 03 00 00 00 00 00 00 00 00', ['33', '30', '32'], (sx, m) => sx.buildSetSceneEdit(m, 3)],
    ['GET current preset', '0D 7F 7F', ['19', '1A', '18'], (sx, m) => sx.buildGetPreset(m)],
    ['GET slot 475’s name', '0D 5B 03', ['41', '42', '40'], (sx, m) => sx.buildGetPresetName(m, 475)],
    ['GET scene name 0', '0E 00', ['1A', '19', '1B'], (sx, m) => sx.buildGetSceneName(m, 0)],
    ['GET scene name 7', '0E 07', ['1D', '1E', '1C'], (sx, m) => sx.buildGetSceneName(m, 7)],
    ['SET bypass Amp, bypassed', '0A 3A 00 01', ['25', '26', '24'], (sx, m) => sx.buildSetBypass(m, 58, true)],
    ['SET bypass Amp, engaged', '0A 3A 00 00', ['24', '27', '25'], (sx, m) => sx.buildSetBypass(m, 58, false)],
    ['SET bypass Delay 1, bypassed', '0A 46 00 01', ['59', '5A', '58'], (sx, m) => sx.buildSetBypass(m, 70, true)],
    ['SET channel Amp to B (published)', '0B 3A 00 01', ['24', '27', '25'], (sx, m) => sx.buildSetChannel(m, 58, 'B')],
    ['SET channel Amp to B (FM3-Edit)', '01 16 00 3A 00 00 00 01 00 00 00 00 00 00 00 00', ['38', '3B', '39'], (sx, m) => sx.buildSetChannelEdit(m, 58, 'B')],
    ['Switch to preset 475 (0x27)', '01 27 00 00 00 00 00 5B 03 00 00 00 00 00 00 00', ['6A', '69', '6B'], (sx, m) => sx.buildSwitchPreset(m, 475)],
    ['Tap', '10', ['04', '07', '05'], (sx, m) => sx.buildTap(m)],
    ['Tuner on (published)', '11 01', ['04', '07', '05'], (sx, m) => sx.buildTuner(m, true)],
    ['Tuner off (published)', '11 00', ['05', '06', '04'], (sx, m) => sx.buildTuner(m, false)],
    ['Tuner page open', '12 1E', ['18', '1B', '19'], (sx, m) => sx.buildTunerPage(m, true)],
    ['Tuner page close', '12 08', ['0E', '0D', '0F'], (sx, m) => sx.buildTunerPage(m, false)],
    ['Tuner frequency poll', '01 19 00 23 00 02 00 00 00 00 00 00 00 00 00 00', ['2D', '2E', '2C'], (sx, m) => sx.buildTunerPoll(m)],
    ['Status dump', '13', ['07', '04', '06'], (sx, m) => sx.buildStatusDump(m)],
    ['GET tempo', '14 7F 7F', ['00', '03', '01'], (sx, m) => sx.buildGetTempo(m)],
    ['SET tempo 120 (published)', '14 78 00', ['78', '7B', '79'], (sx, m) => sx.buildSetTempo(m, 120)],
    ['SET tempo 120 (FM3-Edit)', '01 09 00 02 00 20 00 00 00 40 17 04 00 00 00 00', ['6D', '6E', '6C'], (sx, m) => sx.buildSetTempoEdit(m, 120)]
  ]

  test('every frame in the design’s table, byte for byte, for the FM3, the FM9 and the Axe-Fx III', async () => {
    const sx = await import(SX)
    for (const [what, payload, sums, build] of TABLE) {
      MODELS3.forEach(([unit, m], i) => {
        const want = H(`F0 00 01 74 ${m.toString(16)} ${payload} ${sums[i]} F7`)
        assert.equal(hex(build(sx, m)), hex(want), `${what} on the ${unit}`)
      })
    }
  })

  test('the slot-0 and 90 BPM variants the table quotes for the FM3', async () => {
    const sx = await import(SX)
    assert.equal(hex(sx.buildSetSceneEdit(0x11, 0)), 'F0 00 01 74 11 01 24 00 00 00 01 00 00 00 00 00 00 00 00 00 00 30 F7')
    assert.equal(hex(sx.buildGetPresetName(0x11, 0)), 'F0 00 01 74 11 0D 00 00 19 F7')
    assert.equal(hex(sx.buildSwitchPreset(0x11, 0)), 'F0 00 01 74 11 01 27 00 00 00 00 00 00 00 00 00 00 00 00 00 00 32 F7')
    assert.equal(hex(sx.buildSetTempoEdit(0x11, 90)), 'F0 00 01 74 11 01 09 00 02 00 20 00 00 00 50 15 04 00 00 00 00 7F F7')
    /* The codec's own golden for the III's bypass. */
    assert.equal(hex(sx.buildSetBypass(0x10, 46, true)), 'F0 00 01 74 10 0A 2E 00 01 30 F7')
  })

  test('Program Change puts the bank where each unit reads it: CC0 on the FM3 and FM9, CC32 on the III', async () => {
    const sx = await import(SX)
    const pc = (n, bankIn, channel) => hex(sx.buildProgramChange(n, { bankIn, channel }).flat())
    assert.equal(pc(412, 'cc0'), 'B0 00 03 B0 20 00 C0 1C')
    assert.equal(pc(412, 'cc32'), 'B0 00 00 B0 20 03 C0 1C')
    assert.equal(pc(475, 'cc0'), 'B0 00 03 B0 20 00 C0 5B')
    assert.equal(pc(475, 'cc32'), 'B0 00 00 B0 20 03 C0 5B')
    /* Three separate messages: the phone's MIDI layer sends one at a time. */
    assert.equal(sx.buildProgramChange(475).length, 3)
    assert.equal(pc(475, 'cc0', 16), 'BF 00 03 BF 20 00 CF 5B', 'the MIDI number moves the status byte')
    assert.throws(() => sx.buildProgramChange(5, { channel: 17 }), /MIDI number 17/)
  })

  test('numbers that do not fit are refused, not wrapped onto another preset', async () => {
    const sx = await import(SX)
    assert.throws(() => sx.encode14(16384), /does not fit/)
    assert.throws(() => sx.buildSwitchPreset(0x11, 1024), /not 0..1023/)
    assert.throws(() => sx.buildSetScene(0x11, 8), /not 0..7/)
    assert.throws(() => sx.buildSetChannel(0x11, 58, 'E'), /not A..D/)
    assert.throws(() => sx.buildAm4Preset(104), /not 0..103/)
    assert.throws(() => sx.buildAm4Bypass(0x3e, true), /not an AM4 block/)
    assert.deepEqual(sx.encode14(475), [0x5b, 0x03])
    assert.equal(sx.decode14(0x7a, 0x01), 250)
  })

  test('the five-byte float the FM3-Edit frames carry, both ways', async () => {
    const sx = await import(SX)
    assert.deepEqual(sx.floatSeptets(120), H('00 00 40 17 04'))
    assert.deepEqual(sx.floatSeptets(1), H('00 00 00 7C 03'))
    assert.equal(sx.septetsFloat(H('00 00 50 15 04')), 90)
    for (const x of [0, 0.5, 82.41, 440, 1234.5]) assert.equal(sx.septetsFloat(sx.floatSeptets(x)), Math.fround(x))
    assert.equal(sx.fromSeptets32(sx.septets32(0xdeadbeef)), 0xdeadbeef)
  })

  test('what an FM3 really answered, read: the scene, the tempo, and its status dump', async () => {
    const sx = await import(SX)
    assert.equal(sx.parseScene(H('F0 00 01 74 11 0C 00 18 F7'), 0x11), 0)
    assert.equal(sx.parseTempo(H('F0 00 01 74 11 14 7A 01 7B F7'), 0x11), 250)
    const dump = sx.parseStatusDump(
      H('F0 00 01 74 11 13 25 00 40 2A 00 40 2E 00 41 3A 00 40 3E 00 40 42 00 40 46 00 41 47 00 41 4E 00 41 5A 00 41 5E 00 41 76 00 41 5C F7'),
      0x11
    )
    assert.deepEqual(dump.map((b) => b.effectId), [37, 42, 46, 58, 62, 66, 70, 71, 78, 90, 94, 118])
    assert.deepEqual(dump.filter((b) => b.bypassed).map((b) => b.effectId), [46, 70, 71, 78, 90, 94, 118])
    assert.ok(dump.every((b) => b.channel === 0 && b.channels === 4), 'every block on A, four channels each')
    /* The trap in the library: parsers that assume the III's model byte. These take it every time. */
    assert.equal(sx.parseTempo(H('F0 00 01 74 11 14 7A 01 7B F7'), 0x10), null, 'an FM3 frame read as a III’s')
  })

  test('a preset name reply and a refusal, read', async () => {
    const sx = await import(SX)
    const name = [...'SONG 12'].map((c) => c.charCodeAt(0))
    while (name.length < 32) name.push(0x20)
    const reply = sx.frame(0x11, 0x0d, [12, 0, ...name])
    assert.equal(reply.length, 42)
    assert.equal(reply[40], 0x03, 'the checksum the design worked out by hand')
    assert.deepEqual(sx.parsePresetName(reply, 0x11), { number: 12, name: 'SONG 12' })
    assert.deepEqual(sx.parseRejected(H('F0 00 01 74 11 64 0C 04 78 F7'), 0x11), { fn: 0x0c, code: 0x04 })
    assert.match(sx.rejectedWords(4), /does not know/)
  })

  test('the guards in the parsers: a bad checksum, another unit, the 7F of our own question', async () => {
    const sx = await import(SX)
    assert.equal(sx.parseScene(H('F0 00 01 74 11 0C 00 19 F7'), 0x11), null, 'a bad checksum was read')
    assert.equal(sx.parseScene(H('F0 00 01 74 11 0C 00 18 F7'), 0x12), null, 'an FM3’s answer was read as an FM9’s')
    /* An echoed "which scene?" must never read as scene 8. */
    assert.equal(sx.parseScene(sx.buildGetScene(0x11), 0x11), null)
    assert.equal(sx.parsePresetName(sx.frame(0x11, 0x0d, [0x7f, 0x7f, ...new Array(32).fill(0x20)]), 0x11), null)
    assert.equal(sx.parseTempo(sx.buildGetTempo(0x11), 0x11), null)
    assert.equal(sx.parseSceneName(sx.frame(0x11, 0x0e, [0x7f]), 0x11), null)
  })

  test('the tuner data a unit sends by itself parses with or without a checksum', async () => {
    const sx = await import(SX)
    const withSum = sx.frame(0x11, 0x11, [0x07, 0x00, 0x3f])
    const without = [...withSum.slice(0, -2), 0xf7]
    assert.deepEqual(sx.parseTunerPush(withSum, 0x11), { note: 7, string: 0, fine: 63 })
    assert.deepEqual(sx.parseTunerPush(without, 0x11), { note: 7, string: 0, fine: 63 })
    assert.equal(sx.parseTunerPush([...withSum.slice(0, -2), 0x00, 0xf7], 0x11), null, 'a wrong checksum is still wrong')
    assert.ok(sx.isBeatPush(H('F0 00 01 74 11 10 F7'), 0x11))
    /* And the frequency the tuner page is asked for. */
    const answer = sx.frame(0x11, 0x01, [0x19, 0, 0x23, 0, 0x02, 0, ...sx.floatSeptets(110), 0, 0, 0, 0])
    assert.equal(answer.length, 23)
    assert.equal(sx.parseTunerPoll(answer, 0x11), 110)
  })

  /* ---------------------------------------------------------------- */
  /* The joiner                                                        */
  /* ---------------------------------------------------------------- */

  const joined = async (chunks) => {
    const sx = await import(SX)
    const sysex = []
    const short = []
    const j = sx.createJoiner({ onSysex: (f) => sysex.push(hex(f)), onShort: (m) => short.push(hex(m)) })
    for (const c of chunks) j.push(c)
    return { sysex, short }
  }

  test('the joiner puts one frame back together from five pieces', async () => {
    const f = H('F0 00 01 74 11 14 7A 01 7B F7')
    const { sysex } = await joined([f.slice(0, 2), f.slice(2, 3), f.slice(3, 6), f.slice(6, 9), f.slice(9)])
    assert.deepEqual(sysex, [hex(f)])
  })

  test('the joiner takes two frames from one piece, and skips a timing clock inside one', async () => {
    const a = H('F0 00 01 74 11 0C 00 18 F7')
    const b = H('F0 00 01 74 11 14 7A 01 7B F7')
    assert.deepEqual((await joined([[...a, ...b]])).sysex, [hex(a), hex(b)])
    const clocked = [...a.slice(0, 4), 0xf8, ...a.slice(4, 7), 0xfe, 0xf8, ...a.slice(7)]
    assert.deepEqual((await joined([clocked])).sysex, [hex(a)])
  })

  test('the joiner hands on a Program Change between frames, with running status', async () => {
    const a = H('F0 00 01 74 11 0C 00 18 F7')
    const { sysex, short } = await joined([[...a, 0xc0, 0x05, ...a]])
    assert.deepEqual(sysex, [hex(a), hex(a)])
    assert.deepEqual(short, ['C0 05'])
    assert.deepEqual((await joined([[0x90, 0x3c, 0x40, 0x3e, 0x40]])).short, ['90 3C 40', '90 3E 40'], 'running status')
    assert.deepEqual((await joined([[0x3c, 0x40]])).short, [], 'data with nothing to belong to is dropped')
  })

  test('the joiner drops a frame cut short by a new one, and one longer than 64 KiB', async () => {
    const a = H('F0 00 01 74 11 0C 00 18 F7')
    assert.deepEqual((await joined([[0xf0, 0x00, 0x01, ...a]])).sysex, [hex(a)])
    const huge = [0xf0, ...new Array(70000).fill(0x11), 0xf7]
    assert.deepEqual((await joined([huge, a])).sysex, [hex(a)], 'the oversized frame was delivered')
    /* A status byte in the middle ends the frame: what was half-built is not delivered. */
    assert.deepEqual((await joined([[0xf0, 0x00, 0x01, 0xb0, 0x07, 0x64, 0xf7]])).sysex, [])
  })

  /* ---------------------------------------------------------------- */
  /* Hz to a note                                                      */
  /* ---------------------------------------------------------------- */

  test('a frequency as a note: low E, A, A440, and silence', async () => {
    const sx = await import(SX)
    assert.deepEqual(sx.hzToNote(82.41), { note: 'E', octave: 2, cents: 0 })
    assert.deepEqual(sx.hzToNote(110), { note: 'A', octave: 2, cents: 0 })
    assert.deepEqual(sx.hzToNote(440), { note: 'A', octave: 4, cents: 0 })
    assert.equal(sx.hzToNote(0), null)
    assert.equal(sx.hzToNote(NaN), null)
    assert.deepEqual(sx.hzToNote(445), { note: 'A', octave: 4, cents: 20 })
    /* The AM4 counts notes from nine below MIDI. */
    assert.deepEqual(sx.am4Note(36), { note: 'A', octave: 2 })
  })

  /* ---------------------------------------------------------------- */
  /* The codec: AM4                                                    */
  /* ---------------------------------------------------------------- */

  /*
   * Every AM4 frame on the verified list (am4-verified.json). `golden` marks
   * the ones that are byte-exact captures of AM4-Edit or of his unit; the rest
   * were built by ForgeFX's own builders and checked against them.
   */
  const NAME_HEAD = 'F0 00 01 74 15 01 4E 01 0B 00 12 00 00 00 04 00'
  const SCENE_HEAD = 'F0 00 01 74 15 01 4E 01 0D 00 01 00 00 00 04 00'
  const PRESET_HEAD = 'F0 00 01 74 15 01 4E 01 0A 00 01 00 00 00 04 00'
  const tempoSet = '02 00 1C 00 02 00 00 00 04 00'
  const AM4_FRAMES = [
    ['structure read', 'F0 00 01 74 15 01 4E 01 00 00 1F 00 00 00 00 00 41 F7', false, (sx) => sx.buildAm4Structure()],
    ['name of A01', `${NAME_HEAD} 00 00 00 00 00 43 F7`, true, (sx) => sx.buildAm4StoredName(0)],
    ['name of A02', `${NAME_HEAD} 00 40 00 00 00 03 F7`, true, (sx) => sx.buildAm4StoredName(1)],
    ['name of B02', `${NAME_HEAD} 02 40 00 00 00 01 F7`, false, (sx) => sx.buildAm4StoredName(5)],
    ['name of Z04', `${NAME_HEAD} 33 40 00 00 00 30 F7`, true, (sx) => sx.buildAm4StoredName(103)],
    ['scene 1', `${SCENE_HEAD} 00 00 00 00 00 56 F7`, true, (sx) => sx.buildAm4Scene(0)],
    ['scene 2', `${SCENE_HEAD} 00 40 00 00 00 16 F7`, true, (sx) => sx.buildAm4Scene(1)],
    ['scene 3', `${SCENE_HEAD} 01 00 00 00 00 57 F7`, true, (sx) => sx.buildAm4Scene(2)],
    ['scene 4', `${SCENE_HEAD} 01 40 00 00 00 17 F7`, true, (sx) => sx.buildAm4Scene(3)],
    ['preset A01', `${PRESET_HEAD} 00 00 00 00 00 51 F7`, true, (sx) => sx.buildAm4Preset(0)],
    ['preset A02', `${PRESET_HEAD} 00 00 10 03 78 3A F7`, true, (sx) => sx.buildAm4Preset(1)],
    ['preset B02', `${PRESET_HEAD} 00 00 14 04 00 41 F7`, false, (sx) => sx.buildAm4Preset(5)],
    ['preset at location 7', `${PRESET_HEAD} 00 00 1C 04 00 49 F7`, true, (sx) => sx.buildAm4Preset(7)],
    ['preset Z04', `${PRESET_HEAD} 00 00 19 64 10 3C F7`, false, (sx) => sx.buildAm4Preset(103)],
    ['drive on/off read', 'F0 00 01 74 15 01 76 00 03 00 0D 00 00 00 00 00 69 F7', false, (sx) => sx.buildAm4BypassRead(0x76)],
    ['amp on/off read', 'F0 00 01 74 15 01 3A 00 03 00 0D 00 00 00 00 00 25 F7', false, (sx) => sx.buildAm4BypassRead(0x3a)],
    ['reverb on/off read', 'F0 00 01 74 15 01 42 00 03 00 0D 00 00 00 00 00 5D F7', false, (sx) => sx.buildAm4BypassRead(0x42)],
    ['delay on/off read', 'F0 00 01 74 15 01 46 00 03 00 0D 00 00 00 00 00 59 F7', false, (sx) => sx.buildAm4BypassRead(0x46)],
    ['second drive on/off read', 'F0 00 01 74 15 01 77 00 03 00 0D 00 00 00 00 00 68 F7', false, (sx) => sx.buildAm4BypassRead(0x77)],
    ['gate on/off read', 'F0 00 01 74 15 01 12 01 03 00 0D 00 00 00 00 00 0C F7', false, (sx) => sx.buildAm4BypassRead(0x92)],
    ['drive channel read', 'F0 00 01 74 15 01 76 00 5D 0F 0D 00 00 00 00 00 38 F7', false, (sx) => sx.buildAm4ChannelRead(0x76)],
    ['amp channel read', 'F0 00 01 74 15 01 3A 00 5D 0F 0D 00 00 00 00 00 74 F7', false, (sx) => sx.buildAm4ChannelRead(0x3a)],
    ['reverb channel read', 'F0 00 01 74 15 01 42 00 5D 0F 0D 00 00 00 00 00 0C F7', false, (sx) => sx.buildAm4ChannelRead(0x42)],
    ['delay channel read', 'F0 00 01 74 15 01 46 00 5D 0F 0D 00 00 00 00 00 08 F7', false, (sx) => sx.buildAm4ChannelRead(0x46)],
    ['second drive channel read', 'F0 00 01 74 15 01 77 00 5D 0F 0D 00 00 00 00 00 39 F7', false, (sx) => sx.buildAm4ChannelRead(0x77)],
    ['drive off', 'F0 00 01 74 15 01 76 00 03 00 01 00 00 00 04 00 00 00 10 03 78 0A F7', true, (sx) => sx.buildAm4Bypass(0x76, true)],
    ['drive on', 'F0 00 01 74 15 01 76 00 03 00 01 00 00 00 04 00 00 00 00 00 00 61 F7', false, (sx) => sx.buildAm4Bypass(0x76, false)],
    ['amp off', 'F0 00 01 74 15 01 3A 00 03 00 01 00 00 00 04 00 00 00 10 03 78 46 F7', true, (sx) => sx.buildAm4Bypass(0x3a, true)],
    ['amp on', 'F0 00 01 74 15 01 3A 00 03 00 01 00 00 00 04 00 00 00 00 00 00 2D F7', true, (sx) => sx.buildAm4Bypass(0x3a, false)],
    ['reverb off', 'F0 00 01 74 15 01 42 00 03 00 01 00 00 00 04 00 00 00 10 03 78 3E F7', true, (sx) => sx.buildAm4Bypass(0x42, true)],
    ['second drive off', 'F0 00 01 74 15 01 77 00 03 00 01 00 00 00 04 00 00 00 10 03 78 0B F7', false, (sx) => sx.buildAm4Bypass(0x77, true)],
    ['amp to B', 'F0 00 01 74 15 01 3A 00 52 0F 01 00 00 00 04 00 00 00 10 03 78 18 F7', true, (sx) => sx.buildAm4Channel(0x3a, 'B')],
    ['amp to C', 'F0 00 01 74 15 01 3A 00 52 0F 01 00 00 00 04 00 00 00 00 04 00 77 F7', false, (sx) => sx.buildAm4Channel(0x3a, 'C')],
    ['amp to D', 'F0 00 01 74 15 01 3A 00 52 0F 01 00 00 00 04 00 00 00 08 04 00 7F F7', false, (sx) => sx.buildAm4Channel(0x3a, 'D')],
    ['amp to A', 'F0 00 01 74 15 01 3A 00 52 0F 01 00 00 00 04 00 00 00 00 00 00 73 F7', false, (sx) => sx.buildAm4Channel(0x3a, 'A')],
    ['drive to B', 'F0 00 01 74 15 01 76 00 52 0F 01 00 00 00 04 00 00 00 10 03 78 54 F7', true, (sx) => sx.buildAm4Channel(0x76, 'B')],
    ['reverb to B', 'F0 00 01 74 15 01 42 00 52 0F 01 00 00 00 04 00 00 00 10 03 78 60 F7', true, (sx) => sx.buildAm4Channel(0x42, 'B')],
    ['delay to B', 'F0 00 01 74 15 01 46 00 52 0F 01 00 00 00 04 00 00 00 10 03 78 64 F7', true, (sx) => sx.buildAm4Channel(0x46, 'B')],
    /* A second drive's channel goes to the base drive: that is where the AM4 takes it. */
    ['second drive to B, at the base', 'F0 00 01 74 15 01 76 00 52 0F 01 00 00 00 04 00 00 00 10 03 78 54 F7', false, (sx) => sx.buildAm4Channel(0x77, 'B')],
    ['tempo read', 'F0 00 01 74 15 01 02 00 1C 00 0D 00 00 00 00 00 02 F7', false, (sx) => sx.buildAm4TempoRead()],
    ['tempo 120', `F0 00 01 74 15 01 ${tempoSet} 4D 1F 1B 13 70 23 F7`, false, (sx) => sx.buildAm4Tempo(120)],
    ['tempo 90', `F0 00 01 74 15 01 ${tempoSet} 55 21 32 53 70 6C F7`, false, (sx) => sx.buildAm4Tempo(90)],
    ['tempo 107', `F0 00 01 74 15 01 ${tempoSet} 08 02 37 43 70 07 F7`, false, (sx) => sx.buildAm4Tempo(107)],
    ['tempo 24', `F0 00 01 74 15 01 ${tempoSet} 00 00 00 00 00 09 F7`, false, (sx) => sx.buildAm4Tempo(24)],
    ['tempo 250', `F0 00 01 74 15 01 ${tempoSet} 00 00 10 03 78 62 F7`, false, (sx) => sx.buildAm4Tempo(250)],
    ['tuner note', 'F0 00 01 74 15 01 23 00 01 00 10 00 00 00 00 00 23 F7', true, (sx) => sx.buildAm4TunerPoll(1)],
    ['tuner frequency', 'F0 00 01 74 15 01 23 00 02 00 10 00 00 00 00 00 20 F7', true, (sx) => sx.buildAm4TunerPoll(2)],
    ['tuner cents', 'F0 00 01 74 15 01 23 00 03 00 10 00 00 00 00 00 21 F7', true, (sx) => sx.buildAm4TunerPoll(3)],
    ['tuner string', 'F0 00 01 74 15 01 23 00 04 00 10 00 00 00 00 00 26 F7', true, (sx) => sx.buildAm4TunerPoll(4)]
  ]

  test('every AM4 capture golden, byte for byte', async () => {
    const sx = await import(SX)
    const goldens = AM4_FRAMES.filter((f) => f[2])
    assert.ok(goldens.length >= 20, 'the capture goldens went missing from this list')
    for (const [what, want, , build] of goldens) assert.equal(hex(build(sx)), hex(H(want)), what)
  })

  test('every other AM4 frame on the verified list, byte for byte', async () => {
    const sx = await import(SX)
    for (const [what, want, golden, build] of AM4_FRAMES) if (!golden) assert.equal(hex(build(sx)), hex(H(want)), what)
  })

  test('every AM4 frame the phone builds is on the AM4 allowlist', async () => {
    const sx = await import(SX)
    for (const [what, , , build] of AM4_FRAMES) assert.ok(sx.isAllowedAm4(build(sx)), `${what} is not on AM4_ALLOWED`)
  })

  /*
   * Everything the verified list says never to send, plus frames that are
   * right in their header and wrong in their value.
   */
  test('nothing off the AM4 allowlist passes: the finder, the dumps, saving, renaming, the probes', async () => {
    const sx = await import(SX)
    const never = [
      ['identify broadcast', 'F0 00 01 74 7F 00 7A F7'],
      ['firmware question', 'F0 00 01 74 15 08 18 F7'],
      ['GET_ALL_PARAMS amp', 'F0 00 01 74 15 1F 3A 00 35 F7'],
      ['GET_ALL_PARAMS cab', 'F0 00 01 74 15 1F 3E 00 31 F7'],
      ['GET_ALL_PARAMS 0xCE', 'F0 00 01 74 15 1F 4E 01 40 F7'],
      ['GET_ALL_PARAMS drive', 'F0 00 01 74 15 1F 76 00 79 F7'],
      ['GET_ALL_PARAMS second drive', 'F0 00 01 74 15 1F 77 00 78 F7'],
      ['scene names dump A01', 'F0 00 01 74 15 03 00 00 00 13 F7'],
      ['scene names dump B02', 'F0 00 01 74 15 03 01 01 00 13 F7'],
      ['scene names dump Z04', 'F0 00 01 74 15 03 19 03 00 09 F7'],
      ['active buffer dump', 'F0 00 01 74 15 03 7F 7F 00 13 F7'],
      ['edited-bit read', 'F0 00 01 74 15 01 00 00 00 00 1F 00 00 00 00 00 0E F7'],
      ['save to Z04', 'F0 00 01 74 15 01 00 00 00 00 1B 00 00 00 04 00 33 40 00 00 00 7D F7'],
      ['place a drive in slot 1', 'F0 00 01 74 15 01 4E 01 0F 00 01 00 00 00 04 00 00 00 1D 44 10 1D F7'],
      ['toggle the drive', 'F0 00 01 74 15 01 76 00 03 00 07 00 00 00 00 00 63 F7'],
      ['short read of the location', 'F0 00 01 74 15 01 4E 01 0A 00 0E 00 00 00 00 00 5A F7'],
      ['short read of the scene', 'F0 00 01 74 15 01 4E 01 0D 00 0E 00 00 00 00 00 5D F7'],
      ['short read of slot 1', 'F0 00 01 74 15 01 4E 01 0F 00 0E 00 00 00 00 00 5F F7'],
      ['short read of slot 2', 'F0 00 01 74 15 01 4E 01 10 00 0E 00 00 00 00 00 40 F7'],
      ['short read of slot 3', 'F0 00 01 74 15 01 4E 01 11 00 0E 00 00 00 00 00 41 F7'],
      ['short read of slot 4', 'F0 00 01 74 15 01 4E 01 12 00 0E 00 00 00 00 00 42 F7'],
      ['gen-3 tempo GET', 'F0 00 01 74 15 14 7F 7F 04 F7'],
      ['gen-3 tempo SET', 'F0 00 01 74 15 14 78 00 7C F7'],
      ['gen-3 tap', 'F0 00 01 74 15 10 00 F7']
    ]
    for (const [what, bytes] of never) assert.ok(!sx.isAllowedAm4(H(bytes)), `${what} would be sent to the AM4`)

    const made = (fields) => sx.am4Frame(fields)
    const wrongValue = [
      ['scene 5', made({ pidLow: 0xce, pidHigh: 0x0d, action: 1, hdr4: 4, payload: sx.am4U32(4) })],
      ['preset 104', made({ pidLow: 0xce, pidHigh: 0x0a, action: 1, hdr4: 4, payload: sx.am4Float(104) })],
      ['preset 2.5', made({ pidLow: 0xce, pidHigh: 0x0a, action: 1, hdr4: 4, payload: sx.am4Float(2.5) })],
      ['bypass 0.5', made({ pidLow: 0x76, pidHigh: 3, action: 1, hdr4: 4, payload: sx.am4Float(0.5) })],
      ['channel E', made({ pidLow: 0x3a, pidHigh: 0x07d2, action: 1, hdr4: 4, payload: sx.am4Float(4) })],
      ['channel at a second copy’s code', made({ pidLow: 0x77, pidHigh: 0x07d2, action: 1, hdr4: 4, payload: sx.am4Float(1) })],
      ['tempo past the end', made({ pidLow: 2, pidHigh: 0x1c, action: 2, hdr4: 4, payload: sx.am4Float(1.5) })],
      ['name of location 104', made({ pidLow: 0xce, pidHigh: 0x0b, action: 0x12, hdr4: 4, payload: sx.am4U32(104) })],
      ['metronome level read', made({ pidLow: 1, pidHigh: 0x61, action: 0x0d })],
      ['an unknown block’s read', made({ pidLow: 0x9a, pidHigh: 3, action: 0x0d })],
      ['a tuner read that is not one of the four', made({ pidLow: 0x23, pidHigh: 5, action: 0x10 })],
      ['a raw-value write to the tempo', made({ pidLow: 2, pidHigh: 0x1c, action: 1, hdr4: 4, payload: sx.am4Float(0.5) })],
      ['an FM3 frame', sx.buildGetScene(0x11)]
    ]
    for (const [what, bytes] of wrongValue) assert.ok(!sx.isAllowedAm4(bytes), `${what} would be sent to the AM4`)

    const good = sx.buildAm4Structure()
    const badSum = [...good]
    badSum[16] ^= 1
    assert.ok(!sx.isAllowedAm4(badSum), 'a bad checksum would be sent')
    const high = [...good]
    high[12] = 0x80
    assert.ok(!sx.isAllowedAm4(high), 'a byte with its top bit set inside the frame')
    assert.ok(!sx.isAllowedAm4([...good.slice(0, -1)]), 'a frame with no end')
  })

  test('the AM4’s packing: one stream or restarted every seven bytes, the same bytes, top bit first', async () => {
    const sx = await import(SX)
    const raw = Array.from({ length: 192 }, (_, i) => (i * 91 + 7) & 0xff)
    const stream = sx.packMsb(raw)
    assert.equal(stream.length, 220, 'the structure answer is 220 septets')
    assert.deepEqual(sx.unpackMsb(stream, 192), raw)
    /* Seven bytes are exactly eight septets, so restarting changes nothing. Held here so nobody "fixes" one of them. */
    for (let n = 0; n <= 60; n++) {
      const r = raw.slice(0, n)
      assert.deepEqual(sx.packChunked(r), sx.packMsb(r), `${n} bytes`)
      assert.deepEqual(sx.unpackChunked(sx.packMsb(r), n), r, `${n} bytes back`)
    }
    /* What does scramble it: the bits read low first. */
    const lowFirst = (septets, n) => {
      const out = []
      let acc = 0
      let bits = 0
      for (const s of septets) {
        acc |= s << bits
        bits += 7
        while (bits >= 8 && out.length < n) {
          out.push(acc & 0xff)
          acc >>= 8
          bits -= 8
        }
      }
      return out
    }
    assert.notDeepEqual(lowFirst(stream, 192), raw, 'low-bit-first happened to read it')
    assert.equal(sx.packChunked(new Array(40).fill(0)).length, 46)
    assert.equal(sx.packChunked(new Array(54).fill(0)).length, 62)
    assert.equal(sx.packChunked(new Array(32).fill(0)).length, 37)
    assert.deepEqual(sx.am4U32(1), H('00 40 00 00 00'))
    assert.deepEqual(sx.am4Float(1), H('00 00 10 03 78'))
    assert.deepEqual(sx.am4Float(0.42477876), H('4D 1F 1B 13 70'))
    assert.equal(sx.am4ReadU32(sx.am4U32(103)), 103)
    assert.equal(sx.am4ReadFloat(sx.am4Float(3)), 3)
  })

  test('the AM4’s tempo answer, rebuilt from his unit: 250 BPM', async () => {
    const sx = await import(SX)
    const f = H(`F0 00 01 74 15 01 02 00 1C 00 0D 00 00 00 28 00 7D 00 09 10 00 00 01 00 1F 4C 46 53 01 01 04 50 26 40 ${' 00'.repeat(28)} 3B F7`)
    assert.equal(f.length, 64)
    assert.ok(sx.checksumOk(f))
    assert.equal(sx.parseAm4Tempo(f), 250)
    const bad = [...f]
    bad[62] ^= 1
    assert.equal(sx.parseAm4Tempo(bad), null, 'a damaged tempo answer was read')
  })

  test('the AM4’s stored-name answers: a name, and an empty slot', async () => {
    const sx = await import(SX)
    const gig = H('F0 00 01 74 15 01 4E 01 0B 00 12 00 00 00 20 00 20 53 26 42 02 1D 52 67 10 14 4D 16 39 00 40 20 10 08 04 02 01 00 40 20 10 08 04 02 01 00 40 20 10 08 04 00 00 40 F7')
    const empty = H('F0 00 01 74 15 01 4E 01 0B 00 12 00 00 00 20 00 1E 11 29 55 02 51 32 3E 00 08 04 02 01 00 40 20 10 08 04 02 01 00 40 20 10 08 04 02 01 00 40 20 10 08 04 02 00 3A F7')
    assert.deepEqual(sx.parseAm4StoredName(gig), { name: 'AM4 Gig Rig', empty: false })
    assert.deepEqual(sx.parseAm4StoredName(empty), { name: '', empty: true })
    /* The request itself, echoed back, is not an answer. */
    assert.equal(sx.parseAm4StoredName(sx.buildAm4StoredName(0)), null)
  })

  test('the AM4’s structure, bypass and channel answers read back what was put in them', async () => {
    const sx = await import(SX)
    const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
    const raw = new Array(192).fill(0)
    raw.splice(0, 4, ...u32(5))
    raw.splice(8, 4, ...u32(2))
    raw.splice(0x10, 10, ...[...'Clean Room'].map((c) => c.charCodeAt(0)))
    raw.splice(0xb0, 4, ...u32(0x3a))
    raw.splice(0xb4, 4, ...u32(0x77))
    const body = [...H('F0 00 01 74 15 01 4E 01 00 00 1F 00 00 00 40 01'), ...sx.packMsb(raw)]
    const f = [...body, sx.checksum(body), 0xf7]
    assert.equal(f.length, 238)
    assert.deepEqual(sx.parseAm4Structure(f), { location: 5, scene: 2, name: 'Clean Room', slots: [0x3a, 0x77, 0, 0], checksumOk: true })
    const badSum = [...f]
    badSum[236] ^= 1
    assert.equal(sx.parseAm4Structure(badSum).checksumOk, false, 'kept, and said')
    /* A byte lost on the way still unpacks, with every slot after it shifted: not an answer. */
    assert.equal(sx.parseAm4Structure([...f.slice(0, 100), ...f.slice(101)]), null, 'a 237-byte answer was read')
    assert.equal(sx.parseAm4Structure([...f.slice(0, 100), 0, ...f.slice(100)]), null, 'a 239-byte answer was read')
    raw.splice(0, 4, ...u32(3000))
    const wild = [...H('F0 00 01 74 15 01 4E 01 00 00 1F 00 00 00 40 01'), ...sx.packMsb(raw)]
    assert.equal(sx.parseAm4Structure([...wild, sx.checksum(wild), 0xf7]), null, 'preset 3000 was believed')
    assert.equal(sx.am4LocationCode(0), 'A01')
    assert.equal(sx.am4LocationCode(5), 'B02')
    assert.equal(sx.am4LocationCode(103), 'Z04')
    assert.deepEqual(sx.am4Block(0x77), { slug: 'drive', base: 0x76, copy: 1 })
    assert.equal(sx.am4Block(0x3e), null, 'the cab is not a block the AM4 places')

    /*
     * AND ON/OFF AND CHANNEL ANSWERS THIS CODEC DID NOT MAKE. Everywhere else
     * these parsers are fed by fakeAm4, which packs its replies with this
     * codec's own packChunked, so a packing or offset mistake would cancel
     * itself out and pass. These were packed by forgefx-midi's
     * packValueChunked and closed with its fractalChecksum, and ForgeFX's own
     * parseLongReadBypassFlag and parseActiveChannelResponse read them the
     * same way.
     */
    const H2 = (s, n, t) => H(`${s}${' 00'.repeat(n)} ${t}`)
    const driveOff = H2('F0 00 01 74 15 01 76 00 03 00 0D 00 00 00 28 00 00 00 00 00 00 00 01 00 1F 53 68 64 30', 33, '30 F7')
    const driveOn = H2('F0 00 01 74 15 01 76 00 03 00 0D 00 00 00 28 00 00 00 00 00 00 00 00 00 00 13 69 60', 34, '5B F7')
    assert.equal(driveOff.length, 64)
    assert.equal(sx.parseAm4Bypass(driveOff, 0x76), true, 'the drive, off (raw float 1.0)')
    assert.equal(sx.parseAm4Bypass(driveOn, 0x76), false, 'the drive, on (raw float 0.0)')
    const ampC = H2('F0 00 01 74 15 01 3A 00 5D 0F 0D 00 00 00 36 00 1D', 57, '40 00 00 00 1F F7')
    assert.equal(ampC.length, 80)
    assert.equal(sx.parseAm4Channel(ampC, 0x3a), 2, 'the amp, on C')
    assert.equal(sx.parseAm4Channel(ampC, 0x76), null, 'another block’s answer')
  })

  test('the AM4 wire’s one way out sends nothing that is off the list', async () => {
    const sx = await import(SX)
    const { am4Sender } = await import(WIRE)
    const sent = []
    const logs = []
    const out = am4Sender((b) => sent.push(b), (l) => logs.push(l))
    assert.equal(out(H('F0 00 01 74 15 1F 3A 00 35 F7')), 'refused')
    assert.equal(out(H('F0 00 01 74 7F 00 7A F7')), 'refused')
    assert.equal(out(sx.buildGetScene(0x15)), 'refused')
    assert.equal(sent.length, 0, 'a refused frame reached the adapter')
    assert.equal(logs.length, 3)
    assert.equal(out(sx.buildAm4Structure()), 'sent')
    assert.equal(sent.length, 1)
  })

  /* ---------------------------------------------------------------- */
  /* The wire against a pretend FM3                                    */
  /* ---------------------------------------------------------------- */

  test('the FM3 is found, and says what it can do in the shapes the app reads', async () => {
    const t = await onTheLine('fm3')
    const d = await t.get('/device/detect')
    assert.equal(d.connected, true)
    assert.equal(d.short, 'FM3')
    assert.equal(d.port, 'bluetooth')
    assert.equal(d.capabilities.via, 'bluetooth')
    assert.equal(d.capabilities.sceneCount, 8)
    assert.equal(d.capabilities.presets.count, 512)
    assert.equal(d.capabilities.fc.liveState, false, 'the footswitch screen would ask for what Bluetooth cannot read')
    assert.equal(d.capabilities.meters, undefined, 'meters make the app ask for the computer’s copy of the grid')
    assert.equal(d.capabilities.supportsSave, false)
    assert.ok(sameFrame(t.frames()[0], t.sx.buildGetScene(0x11)), 'the probe is the harmless scene question')
    await assert.rejects(t.get('/device'), (e) => e.status === 404, 'detect falls back on a 404 for /device')
  })

  test('the FM3’s preset, scene and tempo are read', async () => {
    const t = await onTheLine('fm3', { seed: 3 })
    assert.deepEqual(await t.get('/preset'), { number: 12, name: 'SONG 12' })
    assert.deepEqual(await t.get('/scene'), { index: 0 })
    assert.deepEqual(await t.get('/tempo'), { bpm: 120 })
    assert.deepEqual(t.frames().map(hex), [t.sx.buildGetPreset(0x11), t.sx.buildGetScene(0x11), t.sx.buildGetTempo(0x11)].map(hex))
  })

  test('the chain answer leaves out the input, the output and the looper', async () => {
    const t = await onTheLine('fm3', { looper: true })
    const chain = await t.get('/preset/blocks')
    const ids = chain.map((b) => b.effectId)
    for (const id of [37, 42, 166]) assert.ok(!ids.includes(id), `block ${id} is on the stage`)
    assert.ok(ids.includes(58) && ids.includes(46), 'the amp and the compressor are missing')
    for (const b of chain) {
      assert.ok(b.slug && b.name, 'a block with no name')
      assert.equal(b.channel, 'A', 'the channel is a letter')
      assert.equal(typeof b.bypassed, 'boolean')
    }
    assert.equal(chain.find((b) => b.effectId === 46).bypassed, true)
    const states = await t.get('/preset/scene-state')
    assert.ok(states.some((s) => s.effectId === 166), 'the status answer is the unit’s whole list')
    assert.deepEqual(states[0], { effectId: 37, bypassed: false, channel: 'A' })
  })

  /*
   * The check's answer (0C 02) is the same bytes as the change sent just
   * before it. An echo guard that remembered more than the last frame threw
   * that answer away; this is the test that caught it.
   */
  test('a scene change goes the published way first, and is checked once before it is remembered', async () => {
    const t = await onTheLine('fm3')
    assert.deepEqual(await t.post('/scene', { index: 2 }), { ok: true })
    /* Where it is first: a change to the scene it was already on would prove nothing. */
    assert.ok(sameFrame(t.frames()[0], t.sx.buildGetScene(0x11)), 'the unit was not asked where it was before the trial')
    assert.ok(sameFrame(t.frames()[1], t.sx.buildSetScene(0x11, 2)), 'the published scene change was not first')
    assert.ok(sameFrame(t.frames()[2], t.sx.buildGetScene(0x11)), 'the change was not checked')
    assert.equal(t.unit.state.scene, 2)
    assert.equal(t.remembered.at(-1).learned.scene, 'published')
    assert.deepEqual(t.events, [{ type: 'scene', index: 2 }])
    /* Learned: the next one goes straight out, unchecked. */
    const before = t.sent.length
    await t.post('/scene', { index: 4 })
    assert.equal(t.sent.length - before, 1)
    assert.equal(t.unit.state.scene, 4)
  })

  test('with no answer to the published scene change, FM3-Edit’s frame is sent and remembered', async () => {
    const t = await onTheLine('fm3', { sceneEcho: false, publishedScene: false })
    await t.post('/scene', { index: 2 })
    /* Checked even with no answer to the change: a unit can take it and say nothing, and then FM3-Edit's would be learned from a write that moved nothing. */
    const get = t.sx.buildGetScene(0x11)
    assert.deepEqual(t.frames().map(hex), [get, t.sx.buildSetScene(0x11, 2), get, t.sx.buildSetSceneEdit(0x11, 2), get].map(hex))
    assert.equal(t.unit.state.scene, 2)
    assert.equal(t.remembered.at(-1).learned.scene, 'edit')
    assert.ok(t.logs.some((l) => /FM3-Edit/.test(l) && /remembered/.test(l)), 'the choice was not logged')
  })

  test('the FM3’s tempo goes as FM3-Edit’s parameter write, never the published SET it ignores', async () => {
    const t = await onTheLine('fm3')
    assert.deepEqual(await t.post('/tempo', { bpm: 120 }), { ok: true })
    assert.ok(sameFrame(t.frames()[0], t.sx.buildSetTempoEdit(0x11, 120)))
    assert.ok(!t.frames().some((f) => f[5] === 0x14 && f[6] === 0x78), 'the published tempo SET went to an FM3')
    assert.deepEqual(t.events, [{ type: 'tempo', bpm: 120 }])
  })

  test('an FM9 tries the published tempo, checks it, and falls back to FM3-Edit’s write', async () => {
    const t = await onTheLine('fm9', { publishedTempo: false })
    await t.post('/tempo', { bpm: 133 })
    const fns = t.frames().map((f) => hex(f))
    const get = t.sx.buildGetTempo(0x12)
    assert.deepEqual(fns, [get, t.sx.buildSetTempo(0x12, 133), get, t.sx.buildSetTempoEdit(0x12, 133), get].map(hex))
    assert.equal(t.unit.state.bpm, 133)
    assert.equal(t.remembered.at(-1).learned.tempo, 'edit')
  })

  test('a preset switch goes as the 0x27 frame, checked once, and remembered', async () => {
    const t = await onTheLine('fm3')
    assert.deepEqual(await t.post('/preset/select', { number: 475 }), { ok: true })
    assert.ok(sameFrame(t.frames()[0], t.sx.buildGetPreset(0x11)), 'the unit was not asked where it was before the trial')
    assert.ok(sameFrame(t.frames()[1], H('F0 00 01 74 11 01 27 00 00 00 00 00 5B 03 00 00 00 00 00 00 00 6A F7')))
    assert.ok(sameFrame(t.frames()[2], t.sx.buildGetPreset(0x11)), 'where it landed was not asked')
    assert.ok(t.sent[2].at - t.sent[1].at >= 300, 'asked before the unit had a moment to switch')
    assert.equal(t.unit.state.preset, 475)
    assert.equal(t.remembered.at(-1).learned.preset, 'sysex')
    assert.deepEqual(t.events, [{ type: 'changed', scope: 'preset' }])
  })

  test('with the 0x27 frame ignored, the FM3 is switched by Program Change, bank in CC0', async () => {
    const t = await onTheLine('fm3', { sysexPreset: false })
    await t.post('/preset/select', { number: 475 })
    const shorts = t.frames().filter((f) => f[0] !== 0xf0).map(hex)
    assert.deepEqual(shorts, ['B0 00 03', 'B0 20 00', 'C0 5B'])
    assert.equal(t.unit.state.preset, 475)
    assert.equal(t.remembered.at(-1).learned.preset, 'pc')
  })

  test('the Axe-Fx III’s Program Change carries its bank in CC32, on the MIDI number chosen', async () => {
    const t = await onTheLine('axefx3', { sysexPreset: false, bankIn: 'cc32' })
    await t.post('/preset/select', { number: 475 })
    assert.deepEqual(t.frames().filter((f) => f[0] !== 0xf0).map(hex), ['B0 00 00', 'B0 20 03', 'C0 5B'])
    assert.equal(t.unit.state.preset, 475)
    const ch = await onTheLine('axefx3', { methods: { preset: 'pc', pcChannel: 3 }, bankIn: 'cc32' })
    await ch.post('/preset/select', { number: 5 })
    assert.deepEqual(ch.frames().map(hex), ['B2 00 00', 'B2 20 00', 'C2 05'], 'forced Program Change sent anything else')
  })

  test('the echoes of the phone’s own writes have rig’s exact shapes, and a channel change has none', async () => {
    const t = await onTheLine('fm3')
    await t.post('/preset/blocks/58/bypass', { bypassed: true })
    assert.deepEqual(t.events.splice(0), [{ type: 'changed', scope: 'grid' }])
    assert.equal(t.unit.state.blocks.find((b) => b.eid === 58).bypassed, true)
    await t.post('/preset/blocks/58/channel', { channel: 'B' })
    assert.deepEqual(t.events.splice(0), [], 'the channel write announced itself')
    assert.equal(t.unit.state.blocks.find((b) => b.eid === 58).channel, 1)
    await t.post('/scene', { index: 1 })
    await t.post('/tempo', { bpm: 99 })
    await t.post('/preset/select', { number: 13 })
    assert.deepEqual(t.events, [
      { type: 'scene', index: 1 },
      { type: 'tempo', bpm: 99 },
      { type: 'changed', scope: 'preset' }
    ])
  })

  test('a channel the published SET does not move goes FM3-Edit’s way, checked with the status dump', async () => {
    const t = await onTheLine('fm3', { publishedChannel: false })
    await t.post('/preset/blocks/58/channel', { channel: 'C' })
    const kinds = t.frames().map((f) => (f[5] === 0x01 ? `01/${f[6].toString(16)}` : f[5].toString(16)))
    assert.deepEqual(kinds, ['13', 'b', '13', '01/16', '13'])
    assert.equal(t.unit.state.blocks.find((b) => b.eid === 58).channel, 2)
    assert.equal(t.remembered.at(-1).learned.channel, 'edit')
  })

  /*
   * A first write to where the unit already is lands whether its way works or
   * not — the first scene of a setlist song, a tempo it is already at. A way
   * learned from that is kept on the phone and sent unchecked from then on,
   * so every later write would fail without a word, and putting it right
   * would cost another pair of builds. Each pretend FM9 here ignores the way
   * tried first.
   */
  test('a first write to what the unit already has teaches nothing, and the next real change still finds the way that works', async () => {
    const tempo = await onTheLine('fm9', { publishedTempo: false })
    await tempo.post('/tempo', { bpm: 120 })
    assert.deepEqual(tempo.wire.methods().learned, {}, 'the tempo it was already at taught a way')
    assert.equal(tempo.remembered.length, 0, 'a way was kept on the phone')
    await tempo.post('/tempo', { bpm: 130 })
    assert.equal(tempo.unit.state.bpm, 130, 'the next tempo went the way that does nothing')
    assert.equal(tempo.wire.methods().learned.tempo, 'edit')

    const preset = await onTheLine('fm9', { sysexPreset: false })
    await preset.post('/preset/select', { number: 12 })
    assert.deepEqual(preset.wire.methods().learned, {}, 'the preset already loaded taught a way')
    await preset.post('/preset/select', { number: 13 })
    assert.equal(preset.unit.state.preset, 13, 'the next preset never tried Program Change')
    assert.equal(preset.wire.methods().learned.preset, 'pc')

    const channel = await onTheLine('fm9', { publishedChannel: false })
    await channel.post('/preset/blocks/58/channel', { channel: 'A' })
    assert.deepEqual(channel.wire.methods().learned, {}, 'the channel the amp was already on taught a way')
    await channel.post('/preset/blocks/58/channel', { channel: 'B' })
    assert.equal(channel.unit.state.blocks.find((b) => b.eid === 58).channel, 1, 'the amp stayed on A')
    assert.equal(channel.wire.methods().learned.channel, 'edit')

    /* With MIDI Thru on, the unit's own copy of the change reads as its answer. */
    const scene = await onTheLine('fm9', { publishedScene: false, sceneEcho: false, thru: true })
    await scene.post('/scene', { index: 0 })
    assert.deepEqual(scene.wire.methods().learned, {}, 'the scene it was already on taught a way')
    await scene.post('/scene', { index: 2 })
    assert.equal(scene.unit.state.scene, 2, 'the unit stayed on scene 1')
    assert.equal(scene.wire.methods().learned.scene, 'edit')
  })

  test('a refusal from the unit is an error, and a bypass on a block not in the preset says why', async () => {
    const t = await onTheLine('fm3')
    await assert.rejects(t.post('/preset/blocks/150/bypass', { bypassed: true }), (e) => e.status === 502 && /not in this preset/.test(e.message))
    assert.deepEqual(t.events, [])
  })

  test('nothing answering gives ForgeFX’s own sentinels, and a stored name is never a blank', async () => {
    const t = await onTheLine('fm3', { silent: true })
    assert.equal((await t.get('/device/detect')).connected, false)
    assert.deepEqual(await t.get('/preset'), { number: -1, name: '' })
    assert.deepEqual(await t.get('/scene'), { index: -1 })
    assert.deepEqual(await t.get('/tempo'), { bpm: 0 })
    assert.deepEqual(await t.get('/preset/scene-state'), [])
    await assert.rejects(t.get('/preset/blocks'), (e) => e.status === 504, 'an empty chain would draw an empty preset')
    await assert.rejects(t.get('/presets/40'), (e) => e.status === 504, 'a stored name timed out into an answer')
    assert.ok(t.logs.some((l) => /no answer to/.test(l)), 'timeouts are not logged')
  })

  test('stored names: answered for the slot asked about, and refused for good when the unit answers for another', async () => {
    const t = await onTheLine('fm3')
    assert.deepEqual(await t.get('/presets/13'), { number: 13, name: 'SONG 13' })
    const other = await onTheLine('fm3', { numbered: 'current' })
    await assert.rejects(other.get('/presets/13'), (e) => e.status === 501)
    const before = other.sent.length
    await assert.rejects(other.get('/presets/14'), (e) => e.status === 501)
    assert.equal(other.sent.length, before, 'asked again after the unit said it cannot')
  })

  /*
   * ForgeFX gives a preset question four seconds on a slow link; the phone
   * gives it one and a half. An answer after that is real, but it answers the
   * question that went unanswered, not the next one of the same kind: taken
   * for a stored name it turned stored names off for the whole connection,
   * and a stored name taken for the loaded preset is a preset change that
   * never happened.
   */
  test('a preset answer that comes late is not taken for the next preset question', async () => {
    const name = (s) => [...s.padEnd(32)].map((c) => c.charCodeAt(0))
    /* Every other answer takes 200 ms, so the next question's answer is still on its way when the late one lands. */
    const t = await onTheLine('fm9', { delay: 200 })
    const hear = t.unit.hear
    let slow = true
    t.unit.hear = (b) => {
      /* The first "which preset?" is answered 1.6 s later. */
      if (slow && b[5] === 0x0d && b[6] === 0x7f && b[7] === 0x7f) {
        slow = false
        return t.say(t.sx.frame(0x12, 0x0d, [...t.sx.encode14(12), ...name('SONG 12')]), 1600)
      }
      hear(b)
    }
    assert.deepEqual(await t.get('/preset'), { number: -1, name: '' })
    assert.deepEqual(await t.get('/presets/13'), { number: 13, name: 'SONG 13' }, 'the late answer was taken for preset 13’s name')
    assert.deepEqual(await t.get('/presets/14'), { number: 14, name: '' })
    assert.ok(!t.logs.some((l) => /answered for another preset/.test(l)), 'a late answer turned stored names off')

    const u = await onTheLine('fm9', { delay: 200 })
    const hearU = u.unit.hear
    u.unit.hear = (b) => {
      /* A stored name, answered 1.6 s later. */
      if (b[5] === 0x0d && !(b[6] === 0x7f && b[7] === 0x7f)) return u.say(u.sx.frame(0x12, 0x0d, [...u.sx.encode14(400), ...name('OTHER')]), 1600)
      hearU(b)
    }
    await assert.rejects(u.get('/presets/400'), (e) => e.status === 504)
    assert.deepEqual(await u.get('/preset'), { number: 12, name: 'SONG 12' }, 'preset 400’s late name was taken for the loaded preset')
  })

  test('scene names for the loaded preset, read once and kept; any other preset is refused with nothing sent', async () => {
    const t = await onTheLine('fm3')
    await t.get('/preset')
    const summary = await t.get('/presets/12/summary')
    assert.deepEqual(summary, { number: 12, name: 'SONG 12', scenes: ['CLEAN', 'CRUNCH', 'LEAD', '', '', '', '', 'AMBIENT'] })
    const before = t.sent.length
    assert.deepEqual(await t.get('/presets/12/scenes'), { number: 12, names: summary.scenes })
    assert.equal(t.sent.length, before, 'the names were read twice')
    await assert.rejects(t.get('/presets/13/summary'), (e) => e.status === 501)
    assert.equal(t.sent.length, before)
  })

  test('requests go one at a time: the second frame waits for the first answer, or the first timeout', async () => {
    const t = await onTheLine('fm3', { delay: 50 })
    const a = t.wire.request('/preset')
    const b = t.wire.request('/scene')
    assert.equal(t.sent.length, 1, 'two questions in flight at once')
    const answerDone = t.line.lastDone
    await drive(t.clock, Promise.all([a, b]))
    assert.equal(t.sent.length, 2)
    assert.ok(t.sent[1].at >= answerDone, `the second went at ${t.sent[1].at}, before the first answer finished at ${answerDone}`)

    const quiet = await onTheLine('fm3', { silent: true })
    const c = quiet.wire.request('/preset')
    const d = quiet.wire.request('/scene')
    await drive(quiet.clock, Promise.all([c, d]))
    assert.ok(quiet.sent[1].at >= 1500, 'the second went before the first had timed out')
  })

  test('the player’s writes go ahead of reads already waiting', async () => {
    const t = await onTheLine('fm3', { delay: 30 })
    const first = t.wire.request('/preset')
    const read = t.wire.request('/tempo')
    const write = t.wire.request('/preset/blocks/58/bypass', { method: 'POST', body: JSON.stringify({ bypassed: true }) })
    await drive(t.clock, Promise.all([first, read, write]))
    assert.deepEqual(t.frames().map((f) => f[5]), [0x0d, 0x0a, 0x14])
  })

  const REFUSED = [
    ['GET', '/device', 404],
    ['GET', '/store/config/preset-names-fm3', 404],
    ['GET', '/store/config/scene-names-fm3:12', 404],
    ['GET', '/preset/grid', 501],
    ['GET', '/blocks', 501],
    ['GET', '/healthz', 501],
    ['GET', '/preset/blocks/58/params', 501],
    ['GET', '/preset/blocks/62/cab', 501],
    ['GET', '/fc/model', 501],
    ['GET', '/mod/model', 501],
    ['GET', '/cab/irs', 501],
    ['GET', '/preset/looper', 501],
    ['GET', '/tempo/probe', 501],
    ['POST', '/preset/store', 501],
    ['POST', '/preset/name', 501],
    ['POST', '/scene/name', 501],
    ['POST', '/preset/looper/control', 501],
    ['POST', '/preset/blocks/58/type', 501],
    ['POST', '/mod/bind', 501],
    ['POST', '/preset/backup', 501],
    ['POST', '/preset/grid/cable', 501],
    ['PUT', '/store/config/preset-names-fm3', 501],
    ['PUT', '/preset/blocks/58/params/1', 501],
    ['PUT', '/preset/grid/cell', 501],
    ['PUT', '/preset/scene', 501],
    ['DELETE', '/device/cache', 501]
  ]
  const BAD_INPUT = [
    ['POST', '/scene', { index: 9 }],
    ['POST', '/scene', { index: 'two' }],
    ['POST', '/preset/select', { number: 4096 }],
    ['POST', '/preset/select', {}],
    ['POST', '/tempo', { bpm: 900 }],
    ['POST', '/preset/blocks/58/channel', { channel: 'E' }],
    ['POST', '/preset/blocks/0/bypass', { bypassed: true }]
  ]

  test('unknown routes, writes to the computer’s store and every PUT are refused with zero bytes sent', async () => {
    const t = await onTheLine('fm3')
    for (const [method, path, status] of REFUSED) {
      await assert.rejects(drive(t.clock, t.wire.request(path, { method, body: '{}' })), (e) => e.status === status && e.bluetooth === true, `${method} ${path}`)
    }
    for (const [method, path, body] of BAD_INPUT) {
      await assert.rejects(drive(t.clock, t.wire.request(path, { method, body: JSON.stringify(body) })), (e) => e.status === 400, `${method} ${path} ${JSON.stringify(body)}`)
    }
    assert.equal(t.sent.length, 0, `${t.sent.length} bytes went out for refused requests`)
    /* The refusal is the shape the app reads as "this unit cannot". */
    const { isUnsupported } = await import('../shared/unsupported.mjs')
    await assert.rejects(t.wire.request('/preset/grid'), (e) => isUnsupported(e))
  })

  test('the echo guard: with MIDI Thru on, the phone’s own bytes coming back are dropped and named', async () => {
    const t = await onTheLine('fm3', { thru: true })
    assert.deepEqual(await t.get('/scene'), { index: 0 })
    assert.deepEqual(await t.get('/preset'), { number: 12, name: 'SONG 12' })
    assert.deepEqual(await t.get('/tempo'), { bpm: 120 })
    assert.ok(t.wire.counts().echoes >= 3)
    assert.ok(t.logs.includes('the unit is echoing what it receives: MIDI Thru is on'), 'nobody was told MIDI Thru is on')
    /* And a write's echo is not taken as a change made on the unit. */
    await t.post('/preset/blocks/58/bypass', { bypassed: true })
    assert.deepEqual(t.events, [{ type: 'changed', scope: 'grid' }])
  })

  test('a frame with a bad checksum, or from another unit, is not taken as the answer', async () => {
    const t = await onTheLine('fm3', { silent: true })
    const p = t.wire.request('/scene')
    t.clock.setTimeout(() => t.wire.heard(H('F0 00 01 74 11 0C 03 19 F7')), 10)
    t.clock.setTimeout(() => t.wire.heard(t.sx.frame(0x12, 0x0c, [4])), 20)
    t.clock.setTimeout(() => t.wire.heard(t.sx.frame(0x11, 0x0c, [5])), 30)
    assert.deepEqual(await drive(t.clock, p), { index: 5 })
  })

  test('the footswitch watch: a scene, a preset and a tempo changed on the unit reach the app', async () => {
    const t = await onTheLine('fm3')
    await t.get('/preset')
    await t.get('/scene')
    await t.get('/tempo')
    t.wire.startPolls()
    await advance(t.clock, 1500)
    assert.deepEqual(t.events, [], 'nothing changed, and something was announced')
    t.unit.state.scene = 3
    await advance(t.clock, 1100)
    assert.deepEqual(t.events.splice(0), [{ type: 'scene', index: 3 }])
    t.unit.state.preset = 13
    await advance(t.clock, 2100)
    assert.ok(t.events.splice(0).some((e) => e.type === 'changed' && e.scope === 'preset'), 'a footswitch preset change was missed')
    t.unit.state.bpm = 101
    await advance(t.clock, 4100)
    assert.ok(t.events.splice(0).some((e) => e.type === 'tempo' && e.bpm === 101), 'a tempo change on the unit was missed')
    t.wire.stopPolls()
    const before = t.sent.length
    await advance(t.clock, 5000)
    assert.equal(t.sent.length, before, 'the watch kept asking after it was stopped')
  })

  test('the watch never asks while the player is waiting on an answer', async () => {
    const t = await onTheLine('fm3', { delay: 900 })
    /* Answered once, so the watch is really asking (it waits for that). */
    await t.get('/scene')
    t.wire.startPolls()
    await advance(t.clock, 50)
    assert.ok(sameFrame(t.frames().at(-1), t.sx.buildGetScene(0x11)), 'the watch was not asking')
    const read = t.wire.request('/preset/blocks')
    await drive(t.clock, read)
    const dumpAt = t.sent.findIndex((s) => s.bytes[5] === 0x13)
    const answered = t.sent[dumpAt].at + 900
    const between = t.sent.filter((s, i) => i > dumpAt && s.at < answered)
    assert.deepEqual(between.map((s) => hex(s.bytes)), [], 'a poll went out while the chain was being read')
    t.wire.close()
  })

  /*
   * The screen goes off and on in a blink — Control Center, a notification,
   * Face ID, every Android unlock — and a tick still waiting for its answer
   * used to wake into the new run and start a second loop beside it: one more
   * for every blink, for as long as the adapter stayed connected. On the AM4
   * that is a 238-byte answer each, on a 31,250-baud line.
   */
  test('the watch switched off and on while a question is out is still one watch, not one per blink', async () => {
    const { POLL_MS } = await import(WIRE)
    for (const [kind, question, every] of [
      ['am4', (sx) => sx.buildAm4Structure(), POLL_MS.am4],
      ['fm3', (sx) => sx.buildGetScene(0x11), POLL_MS.scene]
    ]) {
      const t = await onTheLine(kind)
      await t.get('/preset')
      /* The watch's first question goes unanswered, and the screen blinks five times while it waits. */
      t.unit.opt.silent = true
      t.wire.startPolls()
      await advance(t.clock, 10)
      for (let i = 0; i < 5; i++) {
        t.wire.stopPolls()
        t.wire.startPolls()
        await advance(t.clock, 1)
      }
      t.unit.opt.silent = false
      await advance(t.clock, 3000)
      const mark = t.sent.length
      await advance(t.clock, 20000)
      const asked = t.sent.slice(mark).filter((s) => sameFrame(s.bytes, question(t.sx))).length
      assert.ok(asked >= 5, `${kind}: the watch stopped (${asked} questions in 20 s)`)
      assert.ok(asked <= 20000 / every + 1, `${kind}: ${asked} questions in 20 s, so more than one watch is running`)
      t.wire.close()
    }
  })

  /*
   * The wrong unit picked: FM3 on the page, his AM4 on the adapter. The AM4
   * has frozen on messages it did not expect, so the first frame that carries
   * its model byte stops the connection sending anything at all — the watch,
   * what was waiting, and everything asked after — and says why.
   */
  test('a connection made for an FM3 that hears an AM4 sends it nothing more', async () => {
    const t = await onTheLine('fm3', { silent: true })
    t.wire.startPolls()
    const asking = t.wire.request('/scene')
    const waiting = t.wire.request('/tempo').then(
      () => null,
      (e) => e
    )
    /* The AM4's own refusal of a message for some other unit. */
    t.clock.setTimeout(() => t.wire.heard(t.sx.frame(0x15, 0x64, [0x0c, 0x02])), 10)
    assert.deepEqual(await drive(t.clock, asking), { index: -1 })
    assert.equal((await drive(t.clock, waiting))?.status, 409, 'what was waiting was sent anyway')
    const before = t.sent.length
    assert.equal(before, 1, 'more than the one question in flight went out')
    t.wire.startPolls()
    await advance(t.clock, 60000)
    for (const [path, body] of [['/preset'], ['/device/detect'], ['/scene', { index: 1 }], ['/preset/select', { number: 3 }], ['/tuner', { on: true }]]) {
      await assert.rejects(body ? t.post(path, body) : t.get(path), (e) => e.status === 409 && /An AM4 answered, not the FM3\./.test(e.message), path)
    }
    assert.equal(t.sent.length, before, 'the AM4 was still sent an FM3’s messages')
    assert.deepEqual(t.foreign, ['AM4'], 'the page was not told which unit answered')
    assert.ok(t.logs.some((l) => /an AM4 answered, not the FM3/.test(l)))
    /* The AM4's own connection is not stopped by its own answers. */
    const am4 = await onTheLine('am4')
    assert.equal((await am4.get('/device/detect')).connected, true)
    assert.deepEqual(am4.foreign, [])
  })

  test('the footswitch watch waits until the unit has answered once on this connection', async () => {
    const t = await onTheLine('am4', { silent: true })
    t.wire.startPolls()
    await advance(t.clock, 10000)
    assert.equal(t.sent.length, 0, 'the watch asked a unit that has never answered')
    t.unit.opt.silent = false
    await t.get('/preset')
    const after = t.sent.length
    await advance(t.clock, 4100)
    assert.ok(t.sent.length - after >= 1, 'the watch did not start once the unit answered')
    t.wire.close()
  })

  test('the tuner opens its page, asks for the frequency, and closes the page', async () => {
    const t = await onTheLine('fm3')
    await t.post('/tuner', { on: true })
    assert.ok(sameFrame(t.frames()[0], t.sx.buildTunerPage(0x11, true)))
    await advance(t.clock, 1000)
    const readings = t.events.filter((e) => e.type === 'tuner')
    assert.ok(readings.length >= 3, `only ${readings.length} readings in a second`)
    assert.deepEqual(readings[0], { type: 'tuner', freq: 110, note: 'A', octave: 2, cents: 0 })
    t.wire.startPolls()
    await advance(t.clock, 1500)
    assert.ok(!t.frames().some((f) => f[5] === 0x0c), 'the footswitch watch ran with the tuner open')
    await t.post('/tuner', { on: false })
    assert.ok(sameFrame(t.frames().at(-1), t.sx.buildTunerPage(0x11, false)))
    const before = t.sent.filter((s) => sameFrame(s.bytes, t.sx.buildTunerPoll(0x11))).length
    t.wire.stopPolls()
    await advance(t.clock, 1000)
    assert.equal(t.sent.filter((s) => sameFrame(s.bytes, t.sx.buildTunerPoll(0x11))).length, before, 'the tuner kept asking after it closed')
  })

  test('the published tuner, chosen: the unit’s own readings are used, or the phone asks after 1.2 s of nothing', async () => {
    const t = await onTheLine('fm3', { methods: { tuner: 'push' } })
    await t.post('/tuner', { on: true })
    assert.ok(sameFrame(t.frames()[0], t.sx.buildTuner(0x11, true)))
    t.say(t.sx.frame(0x11, 0x11, [7, 0, 63]))
    await advance(t.clock, 100)
    assert.deepEqual(t.events.filter((e) => e.type === 'tuner')[0], { type: 'tuner', note: 'E', octave: undefined, cents: 0 })
    await t.post('/tuner', { on: false })

    const quiet = await onTheLine('fm3', { methods: { tuner: 'push' } })
    await quiet.post('/tuner', { on: true })
    await advance(quiet.clock, 1100)
    assert.ok(!quiet.frames().some((f) => f[5] === 0x12), 'gave up on the unit too soon')
    await advance(quiet.clock, 400)
    assert.ok(quiet.frames().some((f) => sameFrame(f, quiet.sx.buildTunerPage(0x11, true))), 'never fell back to asking')
    assert.ok(quiet.logs.some((l) => /asking for the frequency instead/.test(l)))
    quiet.wire.close()
  })

  test('a Program Change from the unit is a preset change; the phone’s own, echoed back, is not', async () => {
    const t = await onTheLine('fm3', { methods: { preset: 'pc' } })
    await t.post('/preset/select', { number: 91 })
    t.events.splice(0)
    t.wire.heardShort([0xc0, 91])
    assert.deepEqual(t.events, [], 'the phone’s own Program Change came back as news')
    await advance(t.clock, 300)
    t.wire.heardShort([0xc0, 7])
    assert.deepEqual(t.events, [{ type: 'changed', scope: 'preset' }])
  })

  test('the check panel: every read, with the bytes out and back in hex', async () => {
    const t = await onTheLine('fm3')
    const result = await drive(t.clock, t.wire.check('all'))
    assert.equal(result.ok, true, result.error)
    assert.ok(result.rows.length >= 15, `only ${result.rows.length} rows`)
    for (const row of result.rows) {
      assert.ok(row.asked && typeof row.meaning === 'string' && Number.isFinite(row.ms), JSON.stringify(row))
      assert.match(row.out, /^F0 00 01 74 11 /, `${row.asked} has no bytes out`)
    }
    assert.ok(result.rows.some((r) => /answered for that preset: SONG 13/.test(r.meaning)))
    assert.ok(result.rows.some((r) => /Amp · A · on/.test(r.meaning)), 'the blocks are not decoded')
    assert.ok(result.rows.find((r) => r.asked === 'Echo test').meaning === 'no echo')
    await assert.rejects(t.wire.check('nope'), (e) => e.status === 400)
  })

  test('the check panel’s writes put things back and say which way worked', async () => {
    const t = await onTheLine('fm3', { sceneEcho: false, publishedScene: false, sysexPreset: false })
    const scene = await drive(t.clock, t.wire.check('write-scene'))
    assert.equal(scene.ok, true, scene.error)
    assert.equal(scene.way, 'edit')
    assert.equal(t.unit.state.scene, 0, 'the scene was not put back')
    const channel = await drive(t.clock, t.wire.check('write-channel'))
    assert.equal(channel.way, 'published')
    assert.equal(t.unit.state.blocks.find((b) => b.eid === 58).channel, 0)
    const tempo = await drive(t.clock, t.wire.check('write-tempo'))
    assert.equal(tempo.way, 'edit', 'the FM3 does not take the published tempo')
    assert.equal(t.unit.state.bpm, 120)
    const preset = await drive(t.clock, t.wire.check('write-preset'))
    assert.equal(preset.way, 'pc')
    assert.equal(t.unit.state.preset, 12)
    const tuner = await drive(t.clock, t.wire.check('write-tuner'))
    assert.equal(tuner.way, 'poll')
    assert.ok(tuner.polled > 5)
    assert.deepEqual(t.wire.methods().learned, { scene: 'edit', channel: 'published', tempo: 'edit', preset: 'pc', tuner: 'poll' })
  })

  test('what auto learned comes back with the wire, and a choice made on the panel is kept', async () => {
    const { settleMethods } = await import(WIRE)
    const t = await onTheLine('fm3', { methods: { learned: { scene: 'edit' } } })
    await t.post('/scene', { index: 2 })
    assert.deepEqual(t.frames().map(hex), [hex(t.sx.buildSetSceneEdit(0x11, 2))], 'a learned way was tried afresh')
    t.wire.setMethods({ scene: 'published' })
    await t.post('/scene', { index: 3 })
    assert.ok(sameFrame(t.frames().at(-1), t.sx.buildSetScene(0x11, 3)))
    assert.equal(t.remembered.at(-1).scene, 'published')
    assert.deepEqual(settleMethods({ scene: 'sideways', pcChannel: 40, learned: { tuner: 'push', preset: 'auto' } }).learned, { tuner: 'push' })
    assert.equal(settleMethods({ pcChannel: 40 }).pcChannel, 1)
  })

  /* ---------------------------------------------------------------- */
  /* The wire against a pretend AM4                                    */
  /* ---------------------------------------------------------------- */

  test('the AM4 is found with the structure read, and says what it can do', async () => {
    const t = await onTheLine('am4')
    const d = await t.get('/device/detect')
    assert.equal(d.connected, true)
    assert.equal(d.short, 'AM4')
    assert.ok(sameFrame(t.frames()[0], t.sx.buildAm4Structure()), 'the AM4 was probed with something other than the structure read')
    const c = d.capabilities
    assert.equal(c.via, 'bluetooth')
    assert.equal(c.slotModel, 'linear')
    assert.equal(c.grid, undefined)
    assert.equal(c.sceneCount, 4)
    assert.deepEqual(c.presets, { count: 104, addressing: 'bankLetter', canScanNames: false })
    assert.deepEqual(c.channelNames, ['A', 'B', 'C', 'D'])
    assert.equal(c.tuner, true)
    assert.equal(c.supportsSave, false)
    assert.equal(c.cabIrs, false)
    assert.equal(c.fc.liveState, false)
    assert.equal(c.meters, undefined)
  })

  test('the AM4’s preset, scene and blocks come from one structure read', async () => {
    const t = await onTheLine('am4')
    assert.deepEqual(await t.get('/preset'), { number: 5, name: 'Clean Room' })
    assert.deepEqual(await t.get('/scene'), { index: 1 })
    const chain = await t.get('/preset/blocks')
    assert.deepEqual(
      chain.map((b) => [b.slug, b.effectId, b.col, b.bypassed, b.channel]),
      [
        ['amp', 0x3a, 1, false, 'B'],
        ['drive', 0x76, 2, true, 'A'],
        ['drive', 0x77, 3, false, 'C']
      ]
    )
    assert.equal(t.frames().filter((f) => sameFrame(f, t.sx.buildAm4Structure())).length, 1, 'one screen load read the preset more than once')
    assert.deepEqual(await t.get('/tempo'), { bpm: 120 })
    assert.deepEqual(await t.get('/preset/scene-state'), [
      { effectId: 0x3a, bypassed: false, channel: 'B' },
      { effectId: 0x76, bypassed: true, channel: 'A' },
      { effectId: 0x77, bypassed: false, channel: 'C' }
    ])
  })

  test('a block code nobody has seen is listed by its number and asked nothing', async () => {
    const t = await onTheLine('am4')
    t.unit.state.slots = [0x3a, 0x9a, 0, 0]
    const chain = await t.get('/preset/blocks')
    assert.deepEqual(chain[1], { slug: '0x9a', name: '0x9a', effectId: 0x9a, row: 1, col: 2, fromRows: [], bypassed: null, channel: null })
    assert.ok(!t.frames().some((f) => f[6] === 0x1a && f[7] === 0x01), 'the unknown block was asked about')
    assert.equal(t.unit.state.frozen, false)
  })

  /*
   * The slot codes in the preset answer are the addresses the AM4 is asked
   * about and sent switches for. A byte lost on the adapter's MIDI side
   * shifts every one of them, and a bad checksum says the answer is not to
   * be trusted; neither may choose them.
   */
  test('a damaged preset answer cannot choose which blocks the AM4 is asked about', async () => {
    const t = await onTheLine('am4')
    const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
    const answer = (slots) => {
      const raw = new Array(192).fill(0)
      raw.splice(0, 4, ...u32(5))
      raw.splice(8, 4, ...u32(1))
      slots.forEach((code, i) => raw.splice(0xb0 + i * 4, 4, ...u32(code)))
      const body = [...H('F0 00 01 74 15 01 4E 01 00 00 1F 00 00 00 40 01'), ...t.sx.packMsb(raw)]
      return [...body, t.sx.checksum(body), 0xf7]
    }
    const hear = t.unit.hear
    /* The next preset answer is this one; the unit answers truly after it. */
    const once = (make) => {
      let left = 1
      t.unit.hear = (b) => {
        if (left && b[10] === 0x1f) {
          left = 0
          return t.say(make())
        }
        hear(b)
      }
    }
    const asked = () => t.frames().filter((f) => f[10] === 0x0d && (f[8] === 0x03 || f[8] === 0x5d)).map((f) => t.sx.decode14(f[6], f[7]))
    const theirs = [0x3a, 0x76, 0x77]

    /* A byte lost: 237 bytes, still unpacking, every slot after the loss shifted. */
    once(() => {
      const f = answer([0x42, 0x46, 0, 0])
      f.splice(100, 1)
      return f
    })
    await assert.rejects(t.get('/preset/blocks'), (e) => e.status === 504)
    assert.deepEqual(asked(), [], 'a shortened answer chose blocks to ask about')

    /* A bad checksum, and other slots in it: asked again, and the true answer used. */
    once(() => {
      const f = answer([0x42, 0x46, 0, 0])
      f[f.length - 2] ^= 1
      return f
    })
    const chain = await t.get('/preset/blocks')
    assert.deepEqual(chain.map((b) => b.effectId), theirs, 'the damaged answer’s blocks were drawn')
    assert.deepEqual([...new Set(asked())], theirs, 'a damaged answer chose a block to ask about')

    /* A unit whose every answer has a bad checksum still works: two answers that agree are believed. */
    t.unit.hear = (b) => {
      if (b[10] !== 0x1f) return hear(b)
      const f = answer(t.unit.state.slots)
      f[f.length - 2] ^= 1
      t.say(f)
    }
    t.unit.state.slots = [0x42, 0, 0, 0]
    await advance(t.clock, 500)
    assert.deepEqual((await t.get('/preset/blocks')).map((b) => b.effectId), [0x42])
    assert.equal(t.unit.state.frozen, false)
  })

  test('the AM4’s stored names: a name, an empty slot as a blank, and one at a time', async () => {
    const t = await onTheLine('am4')
    const a = t.wire.request('/presets/6')
    const b = t.wire.request('/presets/7')
    const [six, seven] = await drive(t.clock, Promise.all([a, b]))
    assert.deepEqual(six, { number: 6, name: 'AC-20' })
    assert.deepEqual(seven, { number: 7, name: '' }, '<EMPTY> is an empty slot')
    const names = t.sent.filter((s) => s.bytes[10] === 0x12)
    assert.equal(names.length, 2)
    assert.ok(names[1].at - names[0].at >= 600, 'two names asked closer than 600 ms apart')
    await assert.rejects(t.get('/presets/104'), (e) => e.status === 400)
    const quiet = await onTheLine('am4', { silent: true })
    await assert.rejects(quiet.get('/presets/6'), (e) => e.status === 504, 'a name timed out into an answer')
  })

  test('a stored name that answers late is never filed under the next slot', async () => {
    const t = await onTheLine('am4', { slowName: 6 })
    const a = t.wire.request('/presets/6')
    const b = t.wire.request('/presets/0')
    const [six, zero] = await drive(t.clock, Promise.allSettled([a, b]))
    assert.equal(six.status, 'rejected', 'the slow one was answered')
    assert.equal(six.reason.status, 504)
    assert.deepEqual(zero.value, { number: 0, name: 'Interface' }, 'AC-20, six’s late answer, was taken for slot 0')
    const names = t.sent.filter((x) => x.bytes[10] === 0x12)
    assert.ok(names[1].at - names[0].at >= 1200 + 2000, 'the next name was asked while the late answer could still arrive')
  })

  test('when the adapter goes, everything waiting is told so, and nothing is left running', async () => {
    const t = await onTheLine('fm3', { delay: 400 })
    await t.post('/tuner', { on: true })
    t.wire.startPolls()
    const waiting = [t.wire.request('/preset'), t.wire.request('/scene'), t.wire.request('/tempo')]
    await advance(t.clock, 50)
    t.wire.close()
    for (const r of await Promise.allSettled(waiting)) assert.equal(r.reason?.status, 503)
    await assert.rejects(t.wire.request('/preset'), (e) => e.status === 503)
    const before = t.sent.length
    await advance(t.clock, 5000)
    assert.equal(t.sent.length, before, 'something kept sending after the adapter went')
    t.wire.heard(t.sx.frame(0x11, 0x0c, [3]))
    assert.ok(!t.events.some((e) => e.type === 'scene'), 'a closed wire still announced')
  })

  test('an adapter that will not take a message is an error, not a write that worked', async () => {
    const { createBleWire } = await import(WIRE)
    const wire = createBleWire({ unit: 'fm3', send: () => false, clock: fakeClock() })
    await assert.rejects(wire.request('/scene', { method: 'POST', body: '{"index":1}' }), (e) => e.status === 503)
    await assert.rejects(wire.request('/preset'), (e) => e.status === 503)
    assert.throws(() => createBleWire({ unit: 'vp4', send: () => true }), /does not know a unit called vp4/)
  })

  test('the AM4’s writes: the exact frames, the echoes rig expects, and the channel at the base code', async () => {
    const t = await onTheLine('am4')
    await t.post('/scene', { index: 2 })
    assert.ok(sameFrame(t.frames().at(-1), H(`${SCENE_HEAD} 01 00 00 00 00 57 F7`)))
    assert.equal(t.unit.state.scene, 2)
    await t.post('/preset/blocks/119/bypass', { bypassed: true })
    assert.ok(sameFrame(t.frames().at(-1), H('F0 00 01 74 15 01 77 00 03 00 01 00 00 00 04 00 00 00 10 03 78 0B F7')))
    assert.equal(t.unit.state.bypass.get(0x77), true)
    await t.post('/preset/blocks/119/channel', { channel: 'B' })
    assert.ok(sameFrame(t.frames().at(-1), H('F0 00 01 74 15 01 76 00 52 0F 01 00 00 00 04 00 00 00 10 03 78 54 F7')))
    await t.post('/tempo', { bpm: 121 })
    assert.ok(sameFrame(t.frames().at(-2), t.sx.buildAm4Tempo(121)))
    assert.ok(sameFrame(t.frames().at(-1), t.sx.buildAm4TempoRead()), 'the tempo was not read back')
    assert.equal(t.unit.state.bpm, 121)
    await t.post('/preset/select', { number: 6 })
    assert.ok(sameFrame(t.frames().at(-1), t.sx.buildAm4Preset(6)))
    assert.equal(t.unit.state.location, 6)
    await advance(t.clock, 500)
    assert.ok(sameFrame(t.frames().at(-1), t.sx.buildAm4Structure()), 'the switch was not checked a moment later')
    assert.ok(t.logs.includes('the AM4 is on B03'), 'where it landed was not logged')
    assert.deepEqual(t.events, [
      { type: 'scene', index: 2 },
      { type: 'changed', scope: 'grid' },
      { type: 'tempo', bpm: 121 },
      { type: 'changed', scope: 'preset' }
    ])
  })

  test('the AM4 refuses everything it has no answer for, with zero bytes sent', async () => {
    const t = await onTheLine('am4')
    const am4Only = [
      ['GET', '/presets/5/summary', 501],
      ['GET', '/presets/5/scenes', 501],
      ['POST', '/tempo/tap', 501]
    ]
    for (const [method, path, status] of [...REFUSED, ...am4Only]) {
      await assert.rejects(drive(t.clock, t.wire.request(path, { method, body: '{}' })), (e) => e.status === status, `${method} ${path}`)
    }
    for (const [method, path, body] of [...BAD_INPUT, ['POST', '/scene', { index: 4 }], ['POST', '/preset/select', { number: 104 }], ['POST', '/preset/blocks/62/bypass', { bypassed: true }]]) {
      await assert.rejects(drive(t.clock, t.wire.request(path, { method, body: JSON.stringify(body) })), (e) => e.status === 400, `${method} ${path} ${JSON.stringify(body)}`)
    }
    assert.equal(t.sent.length, 0)
  })

  test('the AM4 with nothing answering gives the same sentinels', async () => {
    const t = await onTheLine('am4', { silent: true })
    assert.equal((await t.get('/device/detect')).connected, false)
    assert.deepEqual(await t.get('/preset'), { number: -1, name: '' })
    assert.deepEqual(await t.get('/scene'), { index: -1 })
    assert.deepEqual(await t.get('/tempo'), { bpm: 0 })
    assert.deepEqual(await t.get('/preset/scene-state'), [])
    await assert.rejects(t.get('/preset/blocks'), (e) => e.status === 504)
  })

  test('the AM4’s own copy of a write, and MIDI Thru, are dropped by the echo guard', async () => {
    const t = await onTheLine('am4', { usbEcho: true, thru: true })
    await t.post('/scene', { index: 3 })
    await t.post('/preset/blocks/58/bypass', { bypassed: true })
    assert.deepEqual(await t.get('/preset'), { number: 5, name: 'Clean Room' })
    assert.equal((await t.get('/preset/blocks'))[0].bypassed, true)
    assert.ok(t.logs.includes('the unit is echoing what it receives: MIDI Thru is on'))
    assert.deepEqual(t.events, [
      { type: 'scene', index: 3 },
      { type: 'changed', scope: 'grid' }
    ])
  })

  test('the AM4’s footswitch watch: one structure read every two seconds, a scene and a preset noticed', async () => {
    const t = await onTheLine('am4')
    await t.get('/preset')
    t.wire.startPolls()
    await advance(t.clock, 2500)
    t.unit.state.scene = 3
    await advance(t.clock, 2100)
    assert.deepEqual(t.events.splice(0), [{ type: 'scene', index: 3 }])
    t.unit.state.location = 9
    await advance(t.clock, 2100)
    assert.deepEqual(t.events.splice(0), [{ type: 'changed', scope: 'preset' }])
    assert.ok(t.frames().every((f) => sameFrame(f, t.sx.buildAm4Structure())), 'the watch asked the AM4 something besides its preset')
    t.wire.close()
  })

  test('the AM4 tuner: its four readings, as a note', async () => {
    const t = await onTheLine('am4')
    await t.post('/tuner', { on: true })
    await advance(t.clock, 1000)
    const readings = t.events.filter((e) => e.type === 'tuner')
    assert.ok(readings.length >= 2, `only ${readings.length} readings`)
    assert.deepEqual(readings[0], { type: 'tuner', freq: 110, note: 'A', octave: 2, cents: -3 })
    assert.deepEqual(t.frames().slice(0, 4).map(hex), [1, 2, 3, 4].map((w) => hex(t.sx.buildAm4TunerPoll(w))))
    t.unit.state.tuner = [36, 0, 0, 0]
    await advance(t.clock, 800)
    assert.deepEqual(t.events.at(-1), { type: 'tuner', note: '', octave: undefined, cents: null }, 'silence is not shown as silence')
    await t.post('/tuner', { on: false })
    const before = t.sent.length
    await advance(t.clock, 1000)
    assert.equal(t.sent.length, before, 'the tuner kept asking after it closed')
  })

  test('the AM4 check panel: reads and writes, each putting things back', async () => {
    const t = await onTheLine('am4')
    const all = await drive(t.clock, t.wire.check('all'))
    assert.equal(all.ok, true, all.error)
    assert.ok(all.rows.some((r) => /^B02 Clean Room, scene 2, slots amp, drive, drive, empty$/.test(r.meaning)), JSON.stringify(all.rows[0]))
    assert.ok(all.rows.some((r) => r.asked === 'B03’s name' && r.meaning === 'AC-20'))
    for (const step of ['write-scene', 'write-tempo', 'write-bypass', 'write-preset']) {
      const r = await drive(t.clock, t.wire.check(step))
      assert.equal(r.ok, true, `${step}: ${r.error}`)
      assert.ok(r.rows.some((row) => /it worked/.test(row.meaning)), `${step} did not say it worked`)
    }
    assert.equal(t.unit.state.scene, 1)
    assert.equal(t.unit.state.bpm, 120)
    assert.equal(t.unit.state.bypass.get(0x3a), false)
    assert.equal(t.unit.state.location, 5)
    const { CHECK_STEPS } = await import(WIRE)
    assert.match(CHECK_STEPS.am4.writes.find((s) => s.step === 'write-preset').warn, /drops any unsaved changes/)
  })

  /*
   * THE AM4 SAFETY TEST. Every route the app can ask, every check on the
   * panel, the footswitch watch and the tuner, all driven against a pretend
   * AM4 that freezes — as the real one did — the moment it is sent anything
   * off the list. Then every frame that went out is held to the list, and to
   * the three function bytes that froze it or would have.
   */
  test('THE AM4 SAFETY RULE: every route and every check sends only frames on the allowlist', async () => {
    const t = await onTheLine('am4', { usbEcho: true })
    const { CHECK_STEPS } = await import(WIRE)
    const tryIt = (path, method = 'GET', body) =>
      drive(t.clock, t.wire.request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })).catch(() => null)

    for (const [method, path] of REFUSED) await tryIt(path, method, {})
    for (const [method, path, body] of BAD_INPUT) await tryIt(path, method, body)
    for (const path of ['/device/detect', '/device', '/preset', '/scene', '/tempo', '/preset/blocks', '/preset/scene-state', '/presets/0', '/presets/103', '/presets/7', '/presets/5/summary', '/presets/5/scenes']) {
      await tryIt(path)
    }
    await tryIt('/preset/select', 'POST', { number: 6 })
    await tryIt('/preset/select', 'POST', { number: 5 })
    for (const index of [0, 1, 2, 3]) await tryIt('/scene', 'POST', { index })
    for (const eid of [0x3a, 0x76, 0x77, 0x42, 0x92]) {
      await tryIt(`/preset/blocks/${eid}/bypass`, 'POST', { bypassed: true })
      await tryIt(`/preset/blocks/${eid}/bypass`, 'POST', { bypassed: false })
      for (const channel of ['A', 'B', 'C', 'D']) await tryIt(`/preset/blocks/${eid}/channel`, 'POST', { channel })
    }
    for (const bpm of [24, 120, 250]) await tryIt('/tempo', 'POST', { bpm })
    await tryIt('/tempo/tap', 'POST', {})
    await tryIt('/tuner', 'POST', { on: true })
    await advance(t.clock, 1500)
    await tryIt('/tuner', 'POST', { on: false })
    t.wire.startPolls()
    await advance(t.clock, 6000)
    t.wire.stopPolls()
    for (const { step } of [...CHECK_STEPS.am4.reads, ...CHECK_STEPS.am4.writes]) await drive(t.clock, t.wire.check(step))
    await drive(t.clock, t.wire.check('all'))
    await advance(t.clock, 3000)

    const frames = t.frames()
    assert.ok(frames.length > 60, `only ${frames.length} frames went out; the test drove nothing`)
    for (const f of frames) {
      assert.equal(f[0], 0xf0, `a short message went to the AM4: ${hex(f)}`)
      assert.ok(t.sx.isAllowedAm4(f), `off the allowlist: ${hex(f)}`)
      assert.ok(![0x1f, 0x03, 0x00].includes(f[5]), `function ${f[5].toString(16)} went to the AM4: ${hex(f)}`)
    }
    assert.equal(t.unit.state.frozen, false, `the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
    /* Every kind of frame on the list was actually exercised, so the rule is about something. */
    const seen = new Set(frames.map((f) => t.sx.am4Allowed(f).name))
    for (const entry of t.sx.AM4_ALLOWED) assert.ok(seen.has(entry.name), `the safety test never sent a ${entry.name}`)
  })

  /* ---------------------------------------------------------------- */
  /* The switch                                                        */
  /* ---------------------------------------------------------------- */

  test('Bluetooth is off unless turned on, and off leaves every request going the usual way', async () => {
    const sw = await import(SWITCH)
    sw.setSwitch({ on: false })
    assert.equal(sw.bluetoothOn(), false)
    assert.equal(sw.bluetoothWire(), null, 'a wire answered with the mode off')
    assert.equal(sw.overBluetooth({ via: 'bluetooth' }), true)
    assert.equal(sw.overBluetooth({ slotModel: 'grid' }), false)
    assert.equal(sw.overBluetooth(null), false)

    /* On, before the adapter is connected: refused here, never passed to the computer. */
    sw.setSwitch({ on: true })
    assert.equal(sw.bluetoothOn(), true)
    await assert.rejects(sw.bluetoothWire().request('/preset'), (e) => e.status === 503 && e.bluetooth === true)

    const wire = { request: async () => 'from the wire' }
    sw.setSwitch({ on: true, wire })
    assert.equal(sw.bluetoothWire(), wire)
    sw.setSwitch({ on: false, wire })
    assert.equal(sw.bluetoothWire(), null, 'the wire outlived the switch')
    sw.setSwitch({ on: 'yes', wire })
    assert.equal(sw.bluetoothOn(), false, 'anything but true turned it on')
    sw.setSwitch({ on: false })
  })

  test('the Bluetooth files import only what they are allowed to', () => {
    const read = (p) => readFileSync(new URL(`../mobile/src/lib/${p}`, import.meta.url), 'utf8')
    const imports = (t) => [...t.matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1])
    assert.deepEqual(imports(read('fractal-sysex.mjs')), [], 'the codec imports something')
    assert.deepEqual(imports(read('bleSwitch.js')), [], 'the switch imports something')
    assert.deepEqual(imports(read('bleWire.js')).sort(), ['./chain-outline.js', './fractal-sysex.mjs'])
  })

  /* ---------------------------------------------------------------- */
  /* Wired into the phone                                              */
  /* ---------------------------------------------------------------- */

  /*
   * The phone's own files, as text where they reach for React Native, and
   * whitespace-flattened where a formatter could move a line. Comments are
   * stripped before any check that a WORD is absent, because the notes
   * explaining a rule have to name what the rule forbids.
   */
  const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  const flat = (p) => src(p).replace(/\s+/g, ' ')
  const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

  /*
   * DEVICE.JS ON A BENCH OF ITS OWN, with the real switch beside it and a
   * pretend computer that writes down everything it is asked. What is under
   * test is the one promise the whole feature rests on: with Bluetooth off,
   * every request goes exactly where it went before, and with it on, not one
   * goes to the computer.
   */
  async function deviceOnABench() {
    const dir = mkdtempSync(join(tmpdir(), 'ble-device-'))
    const lib = (f) => src(`mobile/src/lib/${f}`)
    /* Node wants the extension that Metro does without. */
    const esm = (text) => text.replace(/from '\.\/([\w.-]+)'/g, (whole, name) => (/\.m?js$/.test(name) ? whole : `from './${name}.js'`))
    const files = {
      'package.json': '{ "type": "module" }',
      'relay.js':
        'export const asked = []\n' +
        "export async function remoteRequest(path, options = {}) { asked.push(String(options.method || 'GET').toUpperCase() + ' ' + path); return { number: 7, name: 'FROM THE COMPUTER', ok: true } }\n",
      'demo.js': 'export const demoDevice = () => null\n',
      'demoWire.js': "export const demoRequest = () => { throw new Error('no demo on this bench') }\n",
      'debugLog.js': 'export const logDebug = () => {}\n',
      'lineage.js': 'export const withLineage = (slug, x) => x\n'
    }
    for (const f of ['bleSwitch.js', 'firmware.js', 'param-fixes.js', 'grid-plan.js', 'unit.mjs', 'slots.js', 'presetName.js', 'encoding.js', 'scale.js', 'metronome-rules.js', 'unsupported.js', 'device.js']) {
      files[f] = esm(lib(f))
    }
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
    const at = (f) => pathToFileURL(join(dir, f)).href
    const device = await import(at('device.js'))
    const sw = await import(at('bleSwitch.js'))
    const relay = await import(at('relay.js'))
    return { device, sw, relay, done: () => rmSync(dir, { recursive: true, force: true }) }
  }

  test('with Bluetooth off the computer is asked exactly as before; on, the wire is, and the computer never', async () => {
    const { device, sw, relay, done } = await deviceOnABench()
    try {
      /* Off, as it starts: the computer, and nothing else. */
      assert.equal(sw.bluetoothOn(), false, 'Bluetooth starts on')
      const fromComputer = await device.currentPreset()
      assert.deepEqual([fromComputer.number, fromComputer.name], [7, 'FROM THE COMPUTER'])
      await device.setScene(2)
      assert.deepEqual(relay.asked, ['GET /preset', 'POST /scene'], 'with Bluetooth off the computer was not asked, or was asked something else')

      /* On, before the adapter is there: refused here, and the computer hears nothing. */
      relay.asked.length = 0
      sw.setSwitch({ on: true })
      await assert.rejects(device.currentPreset(), (e) => e.status === 503 && e.bluetooth === true)
      assert.deepEqual(relay.asked, [], 'a request went to the computer while Bluetooth was on')

      /* On, connected: the wire is asked, with the request exactly as device.js makes it. */
      const heard = []
      const wire = {
        request: async (path, options = {}) => {
          heard.push([String(options.method || 'GET').toUpperCase(), path, options.body ?? null])
          if (path === '/fc/model') throw Object.assign(new Error('unsupported'), { status: 501, unsupported: true, bluetooth: true })
          return path === '/preset' ? { number: 12, name: 'SONG 12' } : { ok: true }
        }
      }
      sw.setSwitch({ on: true, wire })
      const fromWire = await device.currentPreset()
      assert.deepEqual([fromWire.number, fromWire.name], [12, 'SONG 12'])
      await device.setScene(3)
      await assert.rejects(device.fcModel(), (e) => e.status === 501)
      assert.deepEqual(heard, [
        ['GET', '/preset', null],
        ['POST', '/scene', JSON.stringify({ index: 3 })],
        ['GET', '/fc/model', null]
      ])
      assert.deepEqual(relay.asked, [], 'a request went to the computer while Bluetooth was connected')
      /* Refused by the wire, which sent nothing: there is nothing for the memo to remember. */
      assert.equal(device.refusedAlready('GET', '/fc/model'), false, 'a Bluetooth refusal was remembered against the computer')

      /* Off again: the computer, and the wire is never asked again. */
      sw.setSwitch({ on: false, wire })
      heard.length = 0
      await device.currentPreset()
      await device.fcModel()
      assert.deepEqual(relay.asked, ['GET /preset', 'GET /fc/model'], 'turning Bluetooth off did not send requests back to the computer')
      assert.deepEqual(heard, [], 'the wire was asked after Bluetooth was turned off')
    } finally {
      done()
    }
  })

  test('device.js asks the switch one line under the demo, and before the memo of refusals', () => {
    const device = flat('mobile/src/lib/device.js')
    assert.match(device, /import \{ bluetoothWire \} from '\.\/bleSwitch'/)
    assert.match(
      device,
      /const demo = demoDevice\(\) if \(demo\) return demoRequest\(demo, path, options\) const ble = bluetoothWire\(\) if \(ble\) return ble\.request\(path, options\) \/\* What this unit has already refused/,
      'the Bluetooth line is not directly under the demo line, or not before the memo'
    )
    /* No Bluetooth path strings in device.js: they all live in bleWire.js, where the tests above drive them. */
    assert.ok(!/bluetooth/i.test(code('mobile/src/lib/device.js').replace(/bluetoothWire|bleSwitch|\bble\b/g, '')), 'device.js grew Bluetooth code of its own')
  })

  test('link.js hands over to Bluetooth ahead of the demo block, and lets go of it first when it stops', () => {
    const link = flat('mobile/src/lib/link.js')
    assert.match(link, /import \{ bluetoothOn \} from '\.\/bleSwitch'/)
    assert.match(link, /import \{ pokeBluetooth, startBluetoothLink, stopBluetoothLink \} from '\.\/bleLink'/)
    const start = link.slice(link.indexOf('export function startLink() {'))
    const branch = start.indexOf('if (bluetoothOn() && !isDemo()) { running = false startBluetoothLink(set) return stopLink }')
    assert.ok(branch > 0, 'startLink has no Bluetooth branch, or it lets the demo be overridden')
    assert.ok(branch < start.indexOf('if (isDemo()) {'), 'the Bluetooth branch comes after the demo block')
    /* The demo's pinned block is untouched and still contiguous. */
    assert.match(link, /if \(isDemo\(\)\) \{ enterDemo\(\) return stopLink \} if \(running\)/)
    assert.match(link, /export async function stopLink\(\) \{ \/\*[^*]*\*\/ stopBluetoothLink\(\) running = false/, 'stopLink does not let go of Bluetooth first')
    assert.match(link, /export function probeNow\(\) \{ \/\*[^*]*\*\/ if \(bluetoothOn\(\) && !isDemo\(\)\) return pokeBluetooth\(\) if \(!running\) return/, 'Look again does not reach the adapter')

    /* And bleLink never imports link.js, which imports it: it is handed link.js's set instead. */
    const imports = [...src('mobile/src/lib/bleLink.js').matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1])
    assert.ok(!imports.includes('./link'), 'bleLink imports link.js')
    assert.match(flat('mobile/src/lib/bleLink.js'), /if \(!mayConnect\(\)\) \{/, 'Bluetooth connects for somebody who has not unlocked the app')
    /* With no adapter picked nothing is looked for: 'joining' put a spinner on the stage for ever. */
    assert.match(flat('mobile/src/lib/bleLink.js'), /tell\?\.\(\{ link: held \|\| !s\.adapter \? 'off' : 'joining',/, 'no adapter reads as looking for one')
    /* A new connection starts with no word of the wrong unit from the last one. */
    assert.match(flat('mobile/src/lib/bleLink.js'), /noteBluetooth\(\{ phase: 'connected', connectedTo: name, trouble: null, answeredAs: null \}\)/)
  })

  test('App.js restarts the link when Bluetooth goes on or off, and keeps Edit and the account warning away from it', () => {
    const app = flat('mobile/App.js')
    /* Only the on-or-off: the whole snapshot is a new object at every scan result and port change, and the app redrew for each. */
    assert.match(app, /const bluetooth = useBluetoothOn\(\)/)
    for (const p of ['mobile/App.js', 'mobile/src/screens/Settings.js']) assert.ok(!/useBluetooth\(\)/.test(code(p)), `${p} redraws for every change on the Bluetooth page`)
    assert.match(app, /useEffect\(\(\) => \{ restoreBluetooth\(\) \}, \[\]\)/, 'the setting is never picked up at launch')
    assert.match(app, /startLink\(\) return \(\) => \{ stopLink\(\) \} \}, \[auth, demo, bluetooth\]\)/, 'turning Bluetooth on or off does not restart the link')
    assert.match(app, /BENCH && \(demo \|\| link\.link === 'connected'\) && !overBluetooth\(caps\) \? \(\) => setScreen\('edit'\) : null/, 'Edit opens over Bluetooth')
    assert.match(app, /<WrongAccount active=\{[^}]*&& !bluetooth\}/, 'the stage warns about a computer on another account while on Bluetooth')
    /* The waiting screen, over Bluetooth, is about the adapter. */
    const waking = app.slice(app.indexOf('function Waking('))
    assert.match(waking, /const bluetooth = useBluetoothOn\(\) const trouble = useBluetoothTrouble\(\)/)
    assert.match(waking, /Check the phone’s Bluetooth is on, that the adapter is plugged into the unit’s MIDI In and Out and lit, and that nothing else is connected to it\./)
    /* What the phone knows is in the way is said instead of the plugs. */
    assert.match(waking, /trouble === 'bluetooth-off' \? 'Bluetooth is off on this phone\. Turn it on in the phone’s settings\.'/)
    assert.match(waking, /trouble === 'permission' \? 'Allow Nearby devices for Fractal Remote in Android’s settings\.'/)
    assert.match(waking, /<Press label="Look for the adapter again" onPress=\{\(\) => onRetry\?\.\(\)\} \/>/)
    assert.match(waking, /\{bluetooth && onBluetooth \? <Press label="Bluetooth \(beta\)" onPress=\{onBluetooth\} \/> : null\}/, 'the waiting screen does not lead to the adapter’s page')
    assert.match(app, /onBluetooth=\{\(\) => openSettings\('bluetooth'\)\}/)
    assert.match(waking, /\{email && link\.link !== 'connected' && !bluetooth \? \(/, 'the waiting screen names the computer’s account over Bluetooth')
  })

  test('Settings offers Bluetooth (beta) only to somebody unlocked, on a phone and build that can do it', () => {
    const settings = src('mobile/src/screens/Settings.js')
    const one = settings.replace(/\s+/g, ' ')
    assert.match(one, /\{mayDrive\(purchase\) && bluetoothSupported\(\) \? \( <TipCard icon=\{sendIcon\} label="BLUETOOTH \(BETA\)"/, 'the card is not behind the unlock and the build check')
    assert.match(one, /label="BLUETOOTH \(BETA\)"[\s\S]{0,200}onPress=\{\(\) => setPage\('bluetooth'\)\}/, 'the card opens nothing')
    assert.match(one, /\{page === 'bluetooth' && mayDrive\(purchase\) && bluetoothSupported\(\) \? \( <> \{head\('Bluetooth \(beta\)', 'back'\)\} <BluetoothPage purchase=\{purchase\} \/>/)
    assert.match(one, /const PARENT = \{ offline: 'link', bluetooth: 'link',/, 'back from the page does not go to Phone & computer')
    /* After the link page and before the metronome: outside every slice the other tests take. */
    const at = settings.indexOf("{page === 'bluetooth'")
    assert.ok(at > settings.indexOf("{page === 'link' ? (") && at < settings.indexOf("{page === 'metronome' ? ("), 'the page moved into a slice another test reads')
    /* The card sits after PLAYING WITH NO INTERNET, on Phone & computer. */
    assert.ok(settings.indexOf('label="BLUETOOTH (BETA)"') > settings.indexOf('label="PLAYING WITH NO INTERNET"'))
    assert.match(one, /Bluetooth \(beta\) is on\. This phone talks to the unit directly, not through the computer\./, 'Phone & computer does not say Bluetooth is on')
    /* The looper row stays away: the looper is left off the chain over Bluetooth. */
    assert.match(one, /\{\(link === 'connected' \|\| demo\) && !overBluetooth\(caps\) \? \( <SetupRow title="Stop the looper"/)
  })

  test('over Bluetooth nothing is marked unsaved, so no Save button appears that cannot work', () => {
    const rig = flat('mobile/src/lib/rig.js')
    assert.match(
      rig,
      /const unsaved = pendingFor\(number\) \/\*[^*]*\*\/ if \(state\.capabilities\?\.via === 'bluetooth'\) return \/\*/,
      'noteEdited marks a Bluetooth preset as unsaved'
    )
  })

  test('only bluetooth.js asks for the native module, inside a try, once; and it starts off, with no unit chosen', () => {
    const files = []
    const walk = (dir) => {
      for (const entry of readdirSync(fileURLToPath(dir))) {
        const full = fileURLToPath(new URL(entry, dir))
        if (statSync(full).isDirectory()) walk(new URL(`${entry}/`, dir))
        else if (/\.(jsx?|mjs)$/.test(entry)) files.push(full.replaceAll('\\', '/'))
      }
    }
    walk(new URL('../mobile/src/', import.meta.url))
    /* Forward slashes, like the walk above: on Windows fileURLToPath gives
       backslashes, '/mobile/' is not found, and the read is handed the whole
       absolute path twice over. */
    files.push(fileURLToPath(new URL('../mobile/App.js', import.meta.url)).replaceAll('\\', '/'))
    const askers = files.filter((f) => /FractalBleMidi/.test(code(f.slice(f.indexOf('/mobile/') + 1)))).map((f) => f.split('/mobile/')[1])
    assert.deepEqual(askers, ['src/lib/bluetooth.js'], 'something other than bluetooth.js reaches for the native module')

    const ble = flat('mobile/src/lib/bluetooth.js')
    assert.match(ble, /if \(native !== undefined\) return native try \{ native = requireOptionalNativeModule\('FractalBleMidi'\) \} catch \{ native = null \}/, 'the module is asked outside a try, or asked every time')
    assert.match(ble, /const KEY = 'fractal\.bluetooth'/)
    assert.match(ble, /const SAVED = \{ on: false, unit: null, adapter: null, pcChannel: 1, methods: \{\} \}/, 'Bluetooth starts on, or with a unit already chosen')
    /* Not on without a unit, and not on where it cannot work — at the switch and at launch. */
    assert.match(ble, /const want = on === true && !!saved\.unit && bluetoothSupported\(\)/)
    assert.match(ble, /saved = \{ \.\.\.was, on: was\.on && !!was\.unit && bluetoothSupported\(\) \}/, 'a build without the module comes back with Bluetooth on')
  })

  test('the page offers the AM4, FM3, FM9 and Axe-Fx III, in that order, with none of them chosen', async () => {
    const { BLE_UNITS } = await import(WIRE)
    assert.deepEqual(BLE_UNITS.map((u) => u.name), ['AM4', 'FM3', 'FM9', 'Axe-Fx III'])
    const page = flat('mobile/src/screens/Bluetooth.js')
    assert.match(page, /\{BLE_UNITS\.map\(\(u\) => \( <Press key=\{u\.key\} label=\{u\.name\} tone="signal" on=\{u\.key === b\.unit\}/)
    /* The switch cannot be turned on before a unit is picked. */
    assert.match(page, /disabled=\{!b\.on && \(!b\.unit \|\| !mayDrive\(purchase\)\)\}/)
    /* And the unit cannot be changed while it is on: one mis-tap would send another unit's messages to the one on the adapter. */
    assert.match(page, /on=\{u\.key === b\.unit\} disabled=\{b\.on\}/, 'the unit can be changed while connected')
    assert.match(page, /\{b\.on \? <Hint>To change the unit, turn Use Bluetooth off first\.<\/Hint> : null\}/)
    /* What stopped the search shows with the switch off too; and the wrong unit answering says what to do. */
    const status = page.slice(page.indexOf('function status('), page.indexOf('const TONES'))
    assert.ok(status.indexOf("b.trouble === 'bluetooth-off'") < status.indexOf("if (!b.on) return { line: 'Off'"), 'the switch being off hides why the search failed')
    assert.match(status, /if \(b\.answeredAs\) \{ return \{ line: `An \$\{b\.answeredAs\} answered, not the \$\{name\}\./)
  })

  test('the Bluetooth page says plainly what is different from USB, and names no adapter maker', () => {
    const page = src('mobile/src/screens/Bluetooth.js')
    for (const line of [
      'No editing or saving over Bluetooth.',
      'Slower to load the preset list.',
      'Footswitch changes may take a moment to show.',
      'About 30 feet of range.',
      'The adapter connects to one thing at a time.',
      'On the AM4, scene names don’t show over Bluetooth.'
    ]) {
      assert.ok(page.includes(`'${line}'`), `the page does not say: ${line}`)
    }
    assert.ok(page.indexOf('What’s different from USB') < page.indexOf('Use Bluetooth: on'), 'the list is not under the intro')
    /* What the app itself says never names the adapter's maker: the adapter's own name, from the adapter, is fine. */
    for (const p of ['mobile/src/screens/Bluetooth.js', 'mobile/src/screens/Settings.js', 'mobile/App.js', 'mobile/src/lib/bluetooth.js', 'mobile/src/lib/bleLink.js']) {
      assert.ok(!/\bCME\b|WIDI/i.test(code(p)), `${p} names an adapter maker`)
    }
    /* The status line, in his words. */
    assert.match(page, /Adapter connected, but the \$\{name\} isn’t answering\. Check both MIDI plugs, and that MIDI Thru is off\./)
    assert.match(page, /'Allow Nearby devices for Fractal Remote in Android’s settings'/)
    assert.match(page, /'Turn on Bluetooth in the phone’s settings'/)
  })

  test('the native module: its name and events, the simulator kept out, and no MIDI client until one is needed', () => {
    const config = JSON.parse(src('mobile/modules/fractal-ble-midi/expo-module.config.json'))
    assert.deepEqual(config.platforms, ['apple', 'android'])
    assert.deepEqual(config.apple.modules, ['FractalBleMidiModule'])
    assert.deepEqual(config.android.modules, ['cloud.newbold.fractalremote.blemidi.FractalBleMidiModule'])

    const swift = src('mobile/modules/fractal-ble-midi/ios/FractalBleMidiModule.swift')
    assert.match(swift, /Name\("FractalBleMidi"\)/)
    assert.match(swift, /Events\("onBytes", "onDevices", "onState"\)/)
    /*
     * Apple's Bluetooth MIDI screen (CoreAudioKit) is not in the simulator.
     * Every line that touches it has to be on the device side of a guard:
     * inside `#if !targetEnvironment(simulator)`, or in the `#else` of
     * `#if targetEnvironment(simulator)`.
     */
    const deviceOnly = []
    const swiftCode = swift.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '')
    for (const line of swiftCode.split('\n')) {
      const t = line.trim()
      if (t.startsWith('#if ')) deviceOnly.push(t === '#if !targetEnvironment(simulator)')
      else if (t === '#else') deviceOnly.push(!deviceOnly.pop())
      else if (t === '#endif') deviceOnly.pop()
      else if (/CoreAudioKit|CABTMIDI/.test(t)) assert.ok(deviceOnly.includes(true), `this reaches for Apple's Bluetooth screen in the simulator: ${t}`)
    }
    assert.match(swift, /#if !targetEnvironment\(simulator\)\s+import CoreAudioKit\s+#endif/)
    /* The client is made in ensure(), the first time something needs it — never when the module loads. */
    assert.equal((swift.match(/MIDIClientCreate/g) || []).length, 1, 'more than one place makes a MIDI client')
    assert.ok(swift.indexOf('MIDIClientCreate') > swift.indexOf('private func ensure()'), 'the MIDI client is made outside ensure()')
    assert.ok(!/OnCreate\s*\{/.test(swift), 'the module does work when it loads')

    const kotlin = src('mobile/modules/fractal-ble-midi/android/src/main/java/cloud/newbold/fractalremote/blemidi/FractalBleMidiModule.kt')
    assert.match(kotlin, /Name\("FractalBleMidi"\)/)
    assert.match(kotlin, /Events\("onBytes", "onDevices", "onState"\)/)
  })

  test('Android asks only for what a Bluetooth MIDI adapter needs, the iPhone says why, and the Android code is kept', () => {
    const manifest = src('mobile/modules/fractal-ble-midi/android/src/main/AndroidManifest.xml')
    assert.match(manifest, /android\.permission\.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation"/, 'the scan could be used to find where the phone is')
    assert.match(manifest, /android\.permission\.ACCESS_FINE_LOCATION" android:maxSdkVersion="30"/, 'location is asked for on phones that do not need it for a scan')
    assert.match(manifest, /android\.software\.midi" android:required="false"/, 'phones without MIDI drop out of the Play listing')
    assert.match(manifest, /android\.hardware\.bluetooth_le" android:required="false"/, 'phones without Bluetooth LE drop out of the Play listing')

    const app = JSON.parse(src('mobile/app.json'))
    assert.ok(/Bluetooth MIDI adapter/.test(app.expo.ios.infoPlist.NSBluetoothAlwaysUsageDescription || ''), 'iOS is not told why the app uses Bluetooth')

    /* mobile/.gitignore drops android/; the module's own Android code has to be let back in, or EAS builds without it. */
    const ignore = src('mobile/.gitignore').split('\n').map((l) => l.trim())
    const drop = ignore.indexOf('android/')
    const keep = ignore.indexOf('!/modules/*/android/')
    assert.ok(drop >= 0 && keep > drop, 'the module’s Android code is ignored by git')
    assert.ok(ignore.indexOf('/modules/*/android/build/') > keep, 'what Gradle builds inside the module would be committed')
  })
}
