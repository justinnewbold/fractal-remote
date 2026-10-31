/**
 * BLUETOOTH (BETA): the phone talking to the unit with no computer between.
 *
 * Everything here is checked byte for byte, because nobody fixing it has
 * every unit to try a fix on. It is in every store build since 1.87.1,
 * switched on for Justin's account alone since 11 October 2026 (and for
 * customers one day, in a new store version), so a wrong frame reaches a
 * real rig — and on the native side (the module, its permissions) a fix is
 * another pair of store builds, and an evening with the unit not answering.
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
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
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

/*
 * AS FRACTAL'S DOCUMENTS SAY, NOT AS THE PHONE ASSUMES. Where the pretend
 * unit does something the phone relies on, it does what Fractal wrote down,
 * and says where (the copies are in the build-out's scratchpad notes,
 * fractal-docs.md, never in the repo):
 *
 *   - Program Change, bank in CC#0: the III's manual, "MIDI Bank Select
 *     (CC#0) Value, Midi Program Change = Axe-Fx III Preset Number", "0, 0 =
 *     0" to "7, 127 = 1023"; the FM9's and FM3's say the same. `bankIn:
 *     'cc32'` is a unit that reads CC0 and CC32 as one 14-bit bank, the
 *     codec's 'standard' guess, which no Fractal document has, and a bank
 *     past its last preset loads nothing.
 *   - Program Change Off ignores it (`pc: false`): "Determines whether the
 *     Axe-Fx III will process or ignore incoming MIDI Program Change
 *     messages".
 *   - The 0x27 preset switch is FM3-Edit's, seen on an FM3 only; Fractal
 *     publishes no SysEx preset switch ("There is no published way to switch
 *     presets by SysEx"). So only the pretend FM3 takes it by default.
 *   - The tuner switch, 0x11 dd: "Turns the Tuner on or off". With Send
 *     Realtime Sysex on (`pushes: true`) it sends readings while the tuner is
 *     on, "F0 00 01 74 10 11 nn ss cc F7 ... Note that no checksum is sent",
 *     and a tempo beat, "F0 00 01 74 10 10 F7", on each down beat
 *     (Rev 1.4, "Push data"). `push` is the reading it sends.
 *   - `ack: true` answers the tap and the tuner switch with 64 <fn> 00.
 *     The 64 11 00 after the tuner switch is reported (tysonlt, 7 Feb 2019:
 *     "0x00 0x01 0x74 0x10 0x64 0x11 0x00 0x60" after Tuner on/off). For
 *     the tap, simonp54 and JackEddyCO report a 64 reply without its code,
 *     so the tap's 00 is ASSUMED, from tysonlt's "if the byte after the
 *     command is 0, then it's probably a success message". Fractal never
 *     documented 0x64.
 */
function fakeGen3(sx, o) {
  const { say, model, clock } = o
  const opt = {
    sceneEcho: true,
    publishedScene: true,
    publishedChannel: true,
    publishedTempo: false,
    sysexPreset: model === 0x11,
    pc: true,
    numbered: 'yes',
    thru: false,
    silent: false,
    pushes: false,
    /* Byte 7 was picked to read E under the FROM_A belief (bleWire.js): Fractal does not say which note 0 is. */
    push: [7, 0, 63],
    ack: false,
    refuseTuner: null,
    bankIn: 'cc0',
    looper: false,
    /* Answers the published scene, channel and tempo SETs with a refusal ("does not know that message", or the code given), rather than ignoring them. */
    refusePublished: false,
    ...o
  }
  const state = {
    preset: 12,
    scene: 0,
    bpm: 120,
    page: false,
    /* Its published tuner, sent on or off (0x11): on, it is on its tuner, whether it pushes readings or not. */
    tuner: false,
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
    pushing: false,
    /* EDIT'S SETTINGS (`edit`): each block's values as fn 0x1F hands them over, {count, values}, four channels one after another. */
    settings: o.settings ?? new Map(),
    edits: []
  }
  const nameBytes = (name) => {
    const b = [...name].map((c) => c.charCodeAt(0))
    while (b.length < 32) b.push(0x20)
    return b
  }
  const reply = (fn, payload) => say(sx.frame(model, fn, payload))
  const refusalCode = () => (opt.refusePublished === true ? 0x04 : opt.refusePublished)
  const find = (eid) => state.blocks.find((b) => b.eid === eid)
  function short(b) {
    if (!opt.pc) return
    if ((b[0] & 0xf0) === 0xb0 && b[1] === 0x00) state.cc0 = b[2]
    if ((b[0] & 0xf0) === 0xb0 && b[1] === 0x20) state.cc32 = b[2]
    if ((b[0] & 0xf0) === 0xc0) {
      const bank = opt.bankIn === 'cc0' ? state.cc0 : (state.cc0 << 7) | state.cc32
      /* MIDI PC Offset: "Adds a specified value to all incoming MIDI Program Change requests before they are processed." */
      const n = bank * 128 + b[1] + (opt.pcOffset || 0)
      /* A bank past the last preset (1023 on a III Mark II, 511 on the rest): nothing loads. */
      if (n <= (model === 0x10 ? 1023 : 511)) state.preset = n
      /* Switched off, or the adapter dropped, the moment the Program Change was taken: nothing answers after it. */
      if (opt.silentAfterPc) opt.silent = true
    }
  }
  /* Send Realtime Sysex on: the beat every half second, and while the tuner is on a reading every 100 ms, as the document shapes them (no checksum). */
  let beat = 0
  function pushTick() {
    if (opt.pushes && !opt.silent) {
      if (state.pushing) say([0xf0, 0x00, 0x01, 0x74, model, 0x11, ...opt.push, 0xf7], 1)
      if (beat++ % 5 === 0) say([0xf0, 0x00, 0x01, 0x74, model, 0x10, 0xf7], 1)
    }
    clock.setTimeout(pushTick, 100)
  }
  if (clock && opt.pushes) clock.setTimeout(pushTick, 100)
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
        if (opt.refusePublished !== false) return reply(0x64, [0x0c, refusalCode()])
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
        /* An FM9 before firmware 3.00: "3rd Party MIDI Command "Status Dump" is now enabled" (3.00 release notes). */
        if (opt.noStatus) return
        return reply(0x13, state.blocks.flatMap((bl) => [...sx.encode14(bl.eid), (bl.bypassed ? 1 : 0) | (bl.channel << 1) | (4 << 4)]))
      case 0x14:
        if (p[0] === 0x7f && p[1] === 0x7f) return reply(0x14, sx.encode14(state.bpm))
        if (opt.refusePublished !== false) return reply(0x64, [0x14, refusalCode()])
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
        if (opt.refusePublished !== false) return reply(0x64, [0x0b, refusalCode()])
        if (opt.publishedChannel) bl.channel = p[2]
        return
      }
      case 0x10:
        if (opt.ack) reply(0x64, [0x10, 0x00])
        return
      case 0x11:
        if (opt.refuseTuner !== null) return reply(0x64, [0x11, opt.refuseTuner])
        state.tuner = p[0] === 1
        state.pushing = p[0] === 1 && opt.pushes
        if (opt.ack) reply(0x64, [0x11, 0x00])
        return
      case 0x12:
        state.page = p[0] === 0x1e
        return
      /*
       * A block read whole, for Edit: the header naming it and how many
       * values, the values in two pages, the footer. A block not in the
       * preset is refused, as a real one refuses it; `editDamage` spoils the
       * second page's checksum, and `editSilent` answers nothing.
       */
      case 0x1f: {
        const eid = sx.decode14(p[0], p[1])
        if (!opt.edit) return reply(0x64, [0x1f, 0x04])
        if (!find(eid) || !state.settings.has(eid)) return reply(0x64, [0x1f, 0x07])
        if (opt.editSilent) return
        const { count, values } = state.settings.get(eid)
        const page = (list) => sx.frame(model, 0x75, [0, 0, ...list.flatMap((v) => [v & 0x7f, (v >> 7) & 0x7f, (v >> 14) & 0x03])])
        const half = Math.ceil(values.length / 2)
        const second = page(values.slice(half))
        if (opt.editDamage) second[second.length - 2] ^= 0x01
        let t = say(sx.frame(model, 0x74, [...sx.encode14(eid), ...sx.encode14(count)]))
        t = say(page(values.slice(0, half)), t + 2)
        t = say(second, t + 2)
        return say(sx.frame(model, 0x76, []), t + 2)
      }
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
        else if (opt.edit && (sub === 0x52 || sub === 0x09) && state.settings.has(eid) && find(eid)) {
          /* One of Edit's: a knob as its place along 0..65534, a typed write as its number, on the channel the block is on. */
          const chunk = state.settings.get(eid)
          const x = sx.bitsFloat(v)
          chunk.values[find(eid).channel * (chunk.count / 4) + pid] = sub === 0x52 || !Number.isInteger(x) ? Math.round(x * 65534) : x
          state.edits.push({ eid, pid, sub, value: x })
        } else reply(0x64, [0x01, 0x04])
        return
      }
      default:
        reply(0x64, [fn, 0x04])
    }
  }
  return { state, hear, opt }
}

/* ------------------------------------------------------------------ */
/* A stored AM4 preset, whole, as the unit sends it                    */
/* ------------------------------------------------------------------ */

/*
 * The six frames an AM4 answers "send me stored preset n" with, built here
 * the long way round: the body with its four scene records, Huffman-coded
 * behind its own code tree, laid into the 8,192-byte container with its
 * sizes and CRC, every 16-bit word packed into three wire bytes, and cut
 * into a header, four 3,082-byte chunks and a footer. The phone's reader
 * (parseAm4DumpSceneNames) has to undo every step to find a name.
 *
 * Checked once against forgefx-midi's decodeAm4PresetDumpBytes, the decoder
 * ForgeFX runs on real AM4 dumps over USB: it reads the same four names and
 * the same CRC out of what this makes.
 */
function am4DumpOf(sx, location, names, presetName = 'Clean Room') {
  const ascii32 = (s) => {
    const b = [...String(s)].map((c) => c.charCodeAt(0) & 0x7f).slice(0, 31)
    while (b.length < 31) b.push(0x20)
    return [...b, 0]
  }
  /* A body of 0x300 bytes: the four scene records, and something else in between for the code to be about. */
  const body = Array.from({ length: 0x300 }, (_v, i) => (i * 37 + 11) & 0xff)
  names.forEach((name, i) => body.splice(4 + i * 0x50, 32, ...ascii32(name)))

  /* Huffman, the way the format has it: a 1 is a leaf and its byte, a 0 a fork, left then right. */
  const counts = new Map()
  for (const b of body) counts.set(b, (counts.get(b) || 0) + 1)
  let nodes = [...counts].map(([value, n]) => ({ value, n }))
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.n - b.n || (a.value ?? 999) - (b.value ?? 999))
    const [l, r] = nodes.splice(0, 2)
    nodes.push({ l, r, n: l.n + r.n })
  }
  const bits = []
  const codes = new Map()
  const walk = (node, path) => {
    if (node.l) {
      bits.push(0)
      walk(node.l, [...path, 0])
      walk(node.r, [...path, 1])
    } else {
      bits.push(1)
      for (let i = 7; i >= 0; i--) bits.push((node.value >> i) & 1)
      codes.set(node.value, path)
    }
  }
  walk(nodes[0], [])
  for (const b of body) bits.push(...codes.get(b))
  const packed = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i + j] ?? 0)
    packed.push(v)
  }

  const raw = new Array(8192).fill(0)
  const put16 = (o, v) => {
    raw[o] = v & 0xff
    raw[o + 1] = (v >> 8) & 0xff
  }
  put16(0, 0x0109)
  put16(2, 0xaa55)
  ascii32(presetName).forEach((b, i) => (raw[8 + i] = b))
  put16(0x48, body.length)
  put16(0x4a, packed.length)
  packed.forEach((b, i) => (raw[0x4c + i] = b))
  let crc = 0xaa55
  for (const b of raw) {
    crc ^= b << 8
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  put16(4, crc)

  const septets = []
  let xor = 0
  for (let i = 0; i < raw.length; i += 2) {
    const w = raw[i] | (raw[i + 1] << 8)
    xor ^= w
    septets.push(w & 0x7f, (w >> 7) & 0x7f, (w >> 14) & 0x03)
  }
  const close = (body) => [...body, sx.checksum(body), 0xf7]
  const at = [0xf0, 0x00, 0x01, 0x74, 0x15]
  const chunks = [0, 1, 2, 3].map((c) => close([...at, 0x78, 0x00, 0x08, ...septets.slice(c * 3072, (c + 1) * 3072)]))
  return [
    close([...at, 0x77, location >> 2, location & 3, 0, 0, 0]),
    ...chunks,
    close([...at, 0x79, xor & 0x7f, (xor >> 7) & 0x7f, (xor >> 14) & 0x03])
  ]
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
    /* The amp's Out Boost, 0 or 1, as last written: it is never read over Bluetooth. */
    boost: 0,
    stored: new Map([
      [0, 'Interface'],
      [5, 'Clean Room'],
      [6, 'AC-20'],
      [7, '<EMPTY>']
    ]),
    tuner: [36, 110, -3, 1],
    sceneNames: new Map([
      [5, ['CLEAN', 'CRUNCH', 'LEAD BOOST', '']],
      [6, ['', '', '', '']]
    ]),
    /* Which stored presets were asked for whole, and anything heard while one was still going out. */
    dumped: [],
    sendingUntil: -Infinity,
    heardWhileSending: [],
    frozen: false,
    unknown: [],
    /*
     * Its own Tuner setting (SETUP > MIDI/Remote > Tuner): a CC number, or
     * 'none' as a factory-fresh one most likely has. Its MIDI channel, 1..16
     * or 'OMNI'. And its tuner screen, which only that CC opens and closes.
     */
    tunerCc: o.unitTunerCc ?? 'none',
    midiChannel: o.unitChannel ?? 1,
    tunerOpen: false,
    tunerHeard: [],
    /*
     * EDIT'S SETTINGS (`edit`): each register's values as fn 0x1F hands them
     * over, {count, values}, four channels one after another. Only a register
     * of a block in the preset answers; a read of any other, or a write to
     * one, is what the real one froze on, and freezes this one.
     */
    settings: o.settings ?? new Map(),
    edits: []
  }
  /* Whether a register belongs to a block in the preset now: its own code, or the first amp's cab section. */
  const registerHere = (reg) => state.slots.includes(reg) || (reg === 0x3e && state.slots.includes(0x3a))
  /* One of Edit's frames this AM4 knows: a whole-register read, or a write to a setting of a block in the preset. */
  function editFrame(b) {
    if (!opt.edit || !sx.isFractal(b) || b[4] !== 0x15) return false
    if (b[5] === 0x1f) return b.length === 10 && registerHere(sx.decode14(b[6], b[7])) && state.settings.has(sx.decode14(b[6], b[7]))
    if (b[5] !== 0x01 || b.length !== 23) return false
    const reg = sx.decode14(b[6], b[7])
    const action = sx.decode14(b[10], b[11])
    const chunk = state.settings.get(reg)
    return (action === 0x0001 || action === 0x0002) && registerHere(reg) && !!chunk && sx.decode14(b[8], b[9]) < chunk.count / 4
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
  /*
   * A Global setting's long answer, shaped the way his AM4 answered the one
   * setting of this kind it has been asked (a drive's bypass): 0 in the
   * whole number, the value in the float, the words on its screen from byte
   * 8. `unitAnswers: 'old'` is the shape first assumed instead: the value in
   * the whole number and nothing in the float.
   */
  const raw3 = (whole, float, text) => {
    const raw = forty(float, text)
    raw[0] = whole & 0xff
    raw[1] = whole >> 8
    return raw
  }
  const setting = (value, text) => (opt.unitAnswers === 'old' ? raw3(value, 0, text) : raw3(0, value, text))
  /* `unitTunerFrom0` is a list counted from 0, so "CC #20" is 19 in it; `unitTunerAnswer` any answer at all. */
  function tunerSetting() {
    const a = opt.unitTunerAnswer
    if (a) return raw3(a.whole ?? 0, a.float ?? 0, a.text ?? '')
    if (state.tunerCc === 'none') return setting(128, 'NONE')
    return setting(opt.unitTunerFrom0 ? state.tunerCc - 1 : state.tunerCc, opt.unitTunerText === 'plain' ? `${state.tunerCc}` : `CC #${state.tunerCc}`)
  }
  /*
   * Its value is a place in a list, 0 for channel 1 and 16 for OMNI: only the
   * words say the channel ("3", or "CH 3"). `unitChannelAnswer` is any answer
   * at all, or 'silent', while the channel it listens on stays as it is.
   */
  function channelSetting() {
    const a = opt.unitChannelAnswer
    if (a) return raw3(a.whole ?? 0, a.float ?? 0, a.text ?? '')
    return state.midiChannel === 'OMNI' ? setting(16, 'OMNI') : setting(state.midiChannel - 1, `${opt.unitChannelWords ?? ''}${state.midiChannel}`)
  }
  /* Its tuner's CC, exactly: its number, on its channel (any, on OMNI), at 127 or 0. */
  const mineToTune = (b) =>
    b.length === 3 &&
    Number.isInteger(state.tunerCc) &&
    (state.midiChannel === 'OMNI' ? (b[0] & 0xf0) === 0xb0 : b[0] === (0xb0 | (state.midiChannel - 1))) &&
    b[1] === state.tunerCc &&
    (b[2] === 0x7f || b[2] === 0x00)
  function hear(b) {
    if (opt.thru) say([...b], 1)
    if (o.clock && o.clock.now() < state.sendingUntil) state.heardWhileSending.push(b)
    /*
     * A short message. Its tuner's CC opens or closes its tuner screen, as his
     * MIDI pedal does. Anything else short is treated the way the real one
     * treated messages it did not expect, though no CC has ever frozen one:
     * cautious on purpose, so the phone is held to sending only that one.
     */
    if (b[0] !== 0xf0) {
      if (state.frozen) return
      if (mineToTune(b)) {
        state.tunerOpen = b[2] === 0x7f
        state.tunerHeard.push(b)
        return
      }
      state.frozen = true
      state.unknown.push(b)
      return
    }
    if (!sx.isAllowedAm4(b) && !editFrame(b)) {
      /* What the real one did with a message it did not expect: stopped answering. */
      state.frozen = true
      state.unknown.push(b)
    }
    if (state.frozen || opt.silent) return
    /* A stored preset, whole: six frames, about a second for each chunk, as 5-pin MIDI is. */
    if (b[5] === 0x03) {
      const n = b[6] * 4 + b[7]
      state.dumped.push(n)
      if (opt.noDumps) return
      const frames = am4DumpOf(sx, n, state.sceneNames.get(n) ?? ['', '', '', ''], state.stored.get(n) ?? '')
      if (opt.damageDump) {
        /* A byte changed on the way, its frame's own checksum made good again: only the CRC can tell. */
        const c = frames[2]
        c[500] ^= 0x01
        c[c.length - 2] = sx.checksum(c.slice(0, -2))
      }
      /* One frame after another, each about a second at 5-pin speed; `stallAfterHead` is a unit that goes quiet after the first. */
      let at = 6
      let last = at
      frames.forEach((f, i) => {
        last = at
        const done = say(f, at)
        at = Math.max(done + 2, at + (f.length > 100 ? 1000 : 10)) + (i === 0 && opt.stallAfterHead ? opt.stallAfterHead : 0)
      })
      /* Until its last frame has started going out: the phone cannot have heard the end before that. */
      if (o.clock) state.sendingUntil = o.clock.now() + last
      return
    }
    /*
     * A register's settings, whole: the header naming it and how many
     * values, the values in two pieces, the footer. `editDamage` spoils the
     * second piece's checksum; `editSilent` answers nothing.
     */
    if (b[5] === 0x1f) {
      if (opt.editSilent) return
      const reg = d14(b[6], b[7])
      const { count, values } = state.settings.get(reg)
      const at = [0xf0, 0x00, 0x01, 0x74, 0x15]
      const part = (list) => close([...at, 0x75, ...sx.encode14(list.length), ...list.flatMap((v) => [v & 0x7f, (v >> 7) & 0x7f, (v >> 14) & 0x03])])
      const half = Math.ceil(values.length / 2)
      const second = part(values.slice(half))
      if (opt.editDamage) second[second.length - 2] ^= 0x01
      let t = say(close([...at, 0x74, ...sx.encode14(reg), ...sx.encode14(count)]))
      t = say(part(values.slice(0, half)), t + 2)
      t = say(second, t + 2)
      return say(close([...at, 0x76]), t + 2)
    }
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
    /* `slowSettings` is how long it takes over these two, in ms. */
    if (action === 0x0d && pidLow === 0x0001 && pidHigh === 0x0049) {
      if (opt.unitTunerAnswer === 'silent') return
      return say(long(b, tunerSetting()), opt.slowSettings)
    }
    if (action === 0x0d && pidLow === 0x0001 && pidHigh === 0x003a) {
      if (opt.unitChannelAnswer === 'silent') return
      return say(long(b, channelSetting()), opt.slowSettings)
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
    /* One of Edit's: the setting on the channel the block is on (the cab section is the amp's), a knob as its place along 0..65534. */
    if (opt.edit && state.settings.has(pidLow) && pidHigh !== 0x0003 && pidHigh !== 0x07d2 && !(pidLow === 0x3a && pidHigh === 0x0096)) {
      const chunk = state.settings.get(pidLow)
      const ch = state.channel.get(pidLow === 0x3e ? 0x3a : pidLow) ?? 0
      const v = sx.am4ReadFloat(b, 16)
      chunk.values[ch * (chunk.count / 4) + pidHigh] = action === 0x0002 ? Math.round(v * 65534) : v
      state.edits.push({ reg: pidLow, number: pidHigh, action, value: v })
      return say(long(b, forty(v, '')), 3)
    }
    const value = action === 0x0001 && pidHigh === 0x000d ? sx.am4ReadU32(b, 16) : sx.am4ReadFloat(b, 16)
    if (pidLow === 0xce && pidHigh === 0x000d) state.scene = value
    else if (pidLow === 0xce && pidHigh === 0x000a) {
      state.location = value
      const name = state.stored.get(value) ?? '<EMPTY>'
      state.name = name === '<EMPTY>' ? '' : name
      state.scene = 0
    } else if (pidHigh === 0x0003) state.bypass.set(pidLow, value === 1)
    else if (pidLow === 0x003a && pidHigh === 0x0096) state.boost = value
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
  /*
   * What the unit says reaches the phone in pieces, as Bluetooth delivers it,
   * with a timing clock byte here and there — handed to the wire as bytes
   * first, as bluetooth.js does, then to the joiner. `rate` is a slow link,
   * in bytes a millisecond. Says when the last piece lands, after `after`.
   */
  const say = (bytes, after = options.delay ?? 6) => {
    let at = after
    for (let i = 0; i < bytes.length; ) {
      const n = 1 + Math.floor(random() * 9)
      const piece = bytes.slice(i, i + n)
      if (random() < 0.15) piece.splice(Math.floor(random() * (piece.length + 1)), 0, 0xf8)
      clock.setTimeout(() => {
        wire.heardBytes?.(piece)
        joiner.push(piece)
      }, at)
      line.lastDone = Math.max(line.lastDone, clock.now() + at)
      if (options.rate) at += n / options.rate
      else if (random() < 0.5) at += 1
      i += n
    }
    return at
  }
  const unit = kind === 'am4' ? fakeAm4(sx, { say, clock, ...options }) : fakeGen3(sx, { say, clock, model: sx.MODELS[kind], ...options })
  /*
   * A wire on the line, and `reconnect()` for the next one after the adapter
   * dropped and came back, as bleLink makes it: the unit's answers go to the
   * wire of the moment. `line.gone` is the adapter not there: a send fails
   * and reaches nothing. `line.refuses(bytes)` is the adapter not taking one
   * message for a moment, the rest going as usual.
   */
  const makeWire = () => {
    wire = createBleWire({
      unit: kind,
      catalog: options.catalog ?? catalog,
      clock,
      methods: options.methods,
      log: (l) => logs.push(l),
      remember: (m) => remembered.push(m),
      onForeign: (name) => foreign.push(name),
      edit: options.edit,
      send: (b) => {
        if (line.gone || line.refuses?.(b)) return false
        sent.push({ at: clock.now(), bytes: [...b] })
        unit.hear([...b])
        return true
      }
    })
    wire.subscribe((e) => events.push(e))
    return wire
  }
  makeWire()
  const get = (path) => drive(clock, wire.request(path))
  const post = (path, body) => drive(clock, wire.request(path, { method: 'POST', body: JSON.stringify(body ?? null) }))
  const frames = () => sent.map((s) => s.bytes)
  /*
   * HELLO FIRST, as the link does on every connection (bleLink's wake). A
   * gen-3 wire sends nothing but its probe to a unit that has never answered
   * (see `unheard` in bleWire), so a test of what comes after starts the way
   * the phone does: one detect, answered, then the slate wiped so the test
   * sees only its own frames. A silent unit, or `hello: false`, is left as it
   * is: those tests are about the line before anything has answered.
   */
  if (kind !== 'am4' && !options.silent && options.hello !== false) {
    await get('/device/detect')
    await advance(clock, 50)
    sent.length = 0
    logs.length = 0
    events.length = 0
  }
  return {
    sx,
    clock,
    get wire() {
      return wire
    },
    reconnect: makeWire,
    unit,
    sent,
    frames,
    events,
    logs,
    remembered,
    foreign,
    get,
    post,
    say,
    line
  }
}

/*
 * THE LINK ON A BENCH: lib/bleLink.js itself, run rather than read. It is
 * copied beside stand-ins for React Native, the switch, the rig, the unlock,
 * the log and lib/bluetooth.js, and its timers run on the line's clock. The
 * wire it connects is a real one on the line `t`: each connection it makes
 * is `t.reconnect()`, a fresh wire to the same pretend unit, as openWire
 * makes one. What the test plays is the rest of the phone:
 *
 *   - `away()` keeps the adapter from coming back, and hands back the
 *     function that brings it back (the line working again);
 *   - `drop()` is the adapter going, as the module says it: the line gone,
 *     then 'disconnected';
 *   - `settings(s)` is the Bluetooth page changing the unit or the adapter;
 *   - `rig.tunerOn` is the phone's tuner, and `refreshAll` the rig's read of
 *     everything on connecting, which a test may hold.
 */
async function linkOnABench(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ble-link-'))
  const swaps = [
    ["from 'react-native'", "from './react-native.js'"],
    ["from './bleSwitch'", "from './bleSwitch.js'"],
    ["from './bluetooth'", "from './bluetooth.js'"],
    ["from './rig'", "from './rig.js'"],
    ["from './purchases'", "from './purchases.js'"],
    ["from './debugLog'", "from './debugLog.js'"]
  ]
  let lib = readFileSync(new URL('../mobile/src/lib/bleLink.js', import.meta.url), 'utf8')
  for (const [from, to] of swaps) {
    assert.ok(lib.includes(from), `lib/bleLink no longer imports ${from}: the bench needs telling`)
    lib = lib.replace(from, to)
  }
  const unswapped = [...lib.matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1]).filter((m) => !swaps.some(([, to]) => to.includes(`'${m}'`)))
  assert.deepEqual(unswapped, [], 'lib/bleLink imports something the bench has no stand-in for')
  lib = "import { bench as __bench } from './bench.js'\n" + lib.replace(/\bsetTimeout\(/g, '__bench.clock.setTimeout(').replace(/\bclearTimeout\(/g, '__bench.clock.clearTimeout(')
  const files = {
    'package.json': '{ "type": "module" }',
    'bleLink.js': lib,
    'bench.js': `export const bench = {
      clock: null,
      settings: { unit: 'am4', adapter: { id: 'adapter-1', name: 'the adapter' } },
      /* What the store last said (purchases.js state), and whether the account signed in is his (lib/bluetooth bluetoothAdmin). */
      purchase: { unlocked: true, available: true },
      purchaseWatchers: new Set(),
      admin: false,
      rig: { tunerOn: false },
      open: () => null,
      connect: async () => true,
      refreshAll: async () => {},
      current: null,
      listeners: new Map(),
      watchers: [],
      said: [],
      resets: 0,
      tunerWrites: [],
      app: []
    }
`,
    /* The app going to sleep and coming back: `screen(status)` in what the bench returns. */
    'react-native.js': "import { bench } from './bench.js'\nexport const Platform = { OS: 'android' }\nexport const AppState = { currentState: 'active', addEventListener: (type, fn) => { bench.app.push(fn); return { remove() { bench.app.splice(bench.app.indexOf(fn) >>> 0, 1) } } } }\nbench.AppState = AppState\n",
    'bleSwitch.js': 'export const bluetoothOn = () => true\nexport const setSwitch = () => {}\n',
    'bluetooth.js': `import { bench } from './bench.js'
      export const adapterDevices = () => []
      export const adapterName = (a) => (a && typeof a.name === 'string' && a.name && a.name !== a.id ? a.name : null)
      export const bluetoothAdmin = () => bench.admin
      export const bluetoothSettings = () => bench.settings
      export const bluetoothSupported = () => true
      export function closeWire() { const was = bench.current; bench.current = null; was?.close() }
      export function openWire() { closeWire(); bench.current = bench.open(); return bench.current }
      export const connectAdapter = (id) => bench.connect(id)
      export const noteBluetooth = () => {}
      export const onAdapter = (name, fn) => { bench.listeners.set(name, fn); return () => bench.listeners.delete(name) }
      export const releaseAdapter = () => {}
      export const subscribeBluetooth = (fn) => { bench.watchers.push(fn); return () => {} }
      export const unitName = (u) => (u === 'am4' ? 'AM4' : 'FM3')
`,
    'rig.js': `import { bench } from './bench.js'
      export const getState = () => bench.rig
      export const handleEvent = () => {}
      export const refreshAll = () => bench.refreshAll()
      export const reset = () => { bench.resets++ }
      export const stopWatching = () => {}
      export const watchUnit = () => {}
      /* The phone's tuner put down and its close sent through the wire, as rig writeTuner does (bench.tunerWrites counts them). */
      export const writeTuner = async (on) => { bench.rig.tunerOn = on; bench.tunerWrites.push(on); try { await bench.current?.request('/tuner', { method: 'POST', body: JSON.stringify({ on }) }) } catch {} }
`,
    /* purchases.js's own two lines (held to them by text below), on the real rule: the check, and the watch usePurchase keeps. */
    'purchases.js':
      `import { bench } from './bench.js'\nimport { mayDriveBluetooth } from '${new URL('../mobile/src/lib/unlock-rule.js', import.meta.url).href}'\nexport const mayConnectBluetooth = (admin = false) => mayDriveBluetooth(bench.purchase, admin)\n` +
      'export const subscribePurchase = (fn) => { bench.purchaseWatchers.add(fn); return () => bench.purchaseWatchers.delete(fn) }\n',
    'debugLog.js': "import { bench } from './bench.js'\nexport const logDebug = (where, line) => { bench.said.push(line) }\n"
  }
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  const { bench } = await import(at('bench.js'))
  bench.clock = t.clock
  bench.open = () => t.reconnect()
  const link = await import(at('bleLink.js'))
  return {
    link,
    bench,
    rig: bench.rig,
    said: bench.said,
    away() {
      let back = null
      bench.connect = () => new Promise((resolve) => (back = resolve))
      return () => {
        t.line.gone = false
        bench.connect = async () => true
        back?.(true)
      }
    },
    drop() {
      t.line.gone = true
      bench.listeners.get('onState')?.({ id: bench.settings.adapter.id, state: 'disconnected' })
    },
    /* The store's answer changing (purchases.js set), told to whoever watches it. */
    purchase(next) {
      bench.purchase = { ...bench.purchase, ...next }
      for (const fn of [...bench.purchaseWatchers]) fn()
    },
    /* Handed back: what the link's watcher answers, so a test can wait out a let-go held for the AM4's tuner. */
    settings(next) {
      bench.settings = { ...bench.settings, ...next }
      return Promise.all(bench.watchers.map((fn) => fn(bench.settings)))
    },
    screen(status) {
      bench.AppState.currentState = status
      for (const fn of [...bench.app]) fn(status)
    },
    done() {
      link.stopBluetoothLink()
      rmSync(dir, { recursive: true, force: true })
    }
  }
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

  /*
   * CC0 ON EVERY GEN 3 UNIT, the Axe-Fx III too: its manual's table is "MIDI
   * Bank Select (CC#0) Value, Midi Program Change = Axe-Fx III Preset
   * Number", "1, 0 = 128" to "7, 127 = 1023", and CC#32 is in none of
   * Fractal's documents. The III's bank went in CC32 until 25 October 2026.
   */
  test('Program Change puts the bank in CC0 on every Gen 3 unit, as Fractal’s manuals say, the Axe-Fx III’s included', async () => {
    const sx = await import(SX)
    const pc = (n, opts) => hex(sx.buildProgramChange(n, opts).flat())
    assert.equal(pc(412), 'B0 00 03 B0 20 00 C0 1C')
    assert.equal(pc(475), 'B0 00 03 B0 20 00 C0 5B')
    assert.equal(pc(128), 'B0 00 01 B0 20 00 C0 00', 'the III manual: "1, 0 = 128"')
    assert.equal(pc(1023), 'B0 00 07 B0 20 00 C0 7F', 'the III manual: "7, 127 = 1023"')
    /* An old caller still asking for CC32 is not heard: there is no such way any more. */
    assert.equal(pc(475, { bankIn: 'cc32' }), 'B0 00 03 B0 20 00 C0 5B')
    /* Three separate messages: the phone's MIDI layer sends one at a time. */
    assert.equal(sx.buildProgramChange(475).length, 3)
    assert.equal(pc(475, { channel: 16 }), 'BF 00 03 BF 20 00 CF 5B', 'the MIDI number moves the status byte')
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
    ['Tuner setting read', 'F0 00 01 74 15 01 01 00 49 00 0D 00 00 00 00 00 54 F7', false, (sx) => sx.buildAm4TunerCcRead()],
    ['MIDI channel read', 'F0 00 01 74 15 01 01 00 3A 00 0D 00 00 00 00 00 27 F7', false, (sx) => sx.buildAm4MidiChannelRead()],
    ['tempo 120', `F0 00 01 74 15 01 ${tempoSet} 4D 1F 1B 13 70 23 F7`, false, (sx) => sx.buildAm4Tempo(120)],
    ['tempo 90', `F0 00 01 74 15 01 ${tempoSet} 55 21 32 53 70 6C F7`, false, (sx) => sx.buildAm4Tempo(90)],
    ['tempo 107', `F0 00 01 74 15 01 ${tempoSet} 08 02 37 43 70 07 F7`, false, (sx) => sx.buildAm4Tempo(107)],
    ['tempo 24', `F0 00 01 74 15 01 ${tempoSet} 00 00 00 00 00 09 F7`, false, (sx) => sx.buildAm4Tempo(24)],
    ['tempo 250', `F0 00 01 74 15 01 ${tempoSet} 00 00 10 03 78 62 F7`, false, (sx) => sx.buildAm4Tempo(250)],
    ['tuner note', 'F0 00 01 74 15 01 23 00 01 00 10 00 00 00 00 00 23 F7', true, (sx) => sx.buildAm4TunerPoll(1)],
    ['tuner frequency', 'F0 00 01 74 15 01 23 00 02 00 10 00 00 00 00 00 20 F7', true, (sx) => sx.buildAm4TunerPoll(2)],
    ['tuner cents', 'F0 00 01 74 15 01 23 00 03 00 10 00 00 00 00 00 21 F7', true, (sx) => sx.buildAm4TunerPoll(3)],
    ['tuner string', 'F0 00 01 74 15 01 23 00 04 00 10 00 00 00 00 00 26 F7', true, (sx) => sx.buildAm4TunerPoll(4)],
    /*
     * The amp's Out Boost: on an AM4 the amp's pedal is its boost (shared/
     * am4-boost.mjs). Byte for byte forgefx-midi's buildSetParam('amp.out_boost',
     * 1 and 0) at the commit the computer app ships (a17eb4a), which the codec
     * wire-verified against AM4-Edit's own toggle (its session-29 capture, not
     * in that repository, so not marked a golden here).
     */
    ['amp boost on', 'F0 00 01 74 15 01 3A 00 16 01 01 00 00 00 04 00 00 00 10 03 78 52 F7', false, (sx) => sx.buildAm4AmpBoost(true)],
    ['amp boost off', 'F0 00 01 74 15 01 3A 00 16 01 01 00 00 00 04 00 00 00 00 00 00 39 F7', false, (sx) => sx.buildAm4AmpBoost(false)]
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
      ['active buffer dump', 'F0 00 01 74 15 03 7F 7F 00 13 F7'],
      ['a stored dump past Z', 'F0 00 01 74 15 03 1A 00 00 09 F7'],
      ['a stored dump of sub 5', 'F0 00 01 74 15 03 00 04 00 17 F7'],
      ['a stored dump with a byte after it', 'F0 00 01 74 15 03 00 00 01 12 F7'],
      ['a stored dump one byte long', 'F0 00 01 74 15 03 00 00 00 00 13 F7'],
      ['a stored dump for an FM3', 'F0 00 01 74 11 03 00 00 00 17 F7'],
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
    /*
     * And the one fn 0x03 frame that IS sent: a stored preset, for its scene
     * names, in exactly the shape the computer app sends the same AM4 over USB.
     */
    for (const [n, bytes] of [
      [0, 'F0 00 01 74 15 03 00 00 00 13 F7'],
      [5, 'F0 00 01 74 15 03 01 01 00 13 F7'],
      [103, 'F0 00 01 74 15 03 19 03 00 09 F7']
    ]) {
      assert.equal(hex(sx.buildAm4StoredDump(n)), bytes, `stored preset ${n} is asked for in another shape`)
      assert.equal(sx.am4Allowed(H(bytes))?.name, 'stored preset dump', `stored preset ${n} would not be sent`)
    }
    assert.throws(() => sx.buildAm4StoredDump(104))

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

  /*
   * "On the AM4 the tuner doesn't activate on the device, it only shows it on
   * the phone." The AM4's own tuner is opened by the CC under its Tuner
   * setting, which has no factory number: so the phone reads it, and sends it
   * only on what the AM4 plainly says. The one answer of this kind seen from
   * his unit put 0 in the whole number, so the words carry it ("CC #20"),
   * and bare digits need the whole number or the float to agree.
   */
  test('the AM4’s Tuner setting and MIDI channel: two reads in the tempo read’s shape, the number taken from the AM4’s own words for it', async () => {
    const sx = await import(SX)
    const check = await import('../shared/am4-check.mjs')
    /* The same 18 bytes the AM4 check's own reader makes: the read his AM4 has answered on this Global block. */
    assert.equal(hex(sx.buildAm4TunerCcRead()), hex(check.readFrame({ pidLow: 0x0001, pidHigh: 0x0049 })))
    assert.equal(hex(sx.buildAm4MidiChannelRead()), hex(check.readFrame({ pidLow: 0x0001, pidHigh: 0x003a })))
    /* Exactly two entries added to the list, both reads, and nothing else on it moved. */
    assert.deepEqual(
      sx.AM4_ALLOWED.filter((a) => a.pidLow === 0x0001),
      [
        { name: 'tuner MIDI number read', fn: 0x01, pidLow: 0x0001, pidHigh: 0x0049, action: 0x000d, hdr4: 0, size: 18 },
        { name: 'MIDI channel read', fn: 0x01, pidLow: 0x0001, pidHigh: 0x003a, action: 0x000d, hdr4: 0, size: 18 }
      ]
    )
    /* And one more since, on 22 October 2026: the amp's Out Boost, written only (its own test, below). */
    assert.equal(sx.AM4_ALLOWED.length, 17, 'the AM4’s list grew by more than the two reads and the amp’s boost')
    assert.ok(!('AM4_TUNER_CC' in sx), 'a default tuner number is back in the codec: it would be sent to every AM4')
    /* Their neighbours on the same page stay off it: other assignments, any write to either, the short read. */
    const made = (fields) => sx.am4Frame(fields)
    for (const [what, f] of [
      ['the Tap Tempo assignment read', made({ pidLow: 1, pidHigh: 0x48, action: 0x0d })],
      ['the Scene assignment read', made({ pidLow: 1, pidHigh: 0x4a, action: 0x0d })],
      ['the metronome level read', made({ pidLow: 1, pidHigh: 0x61, action: 0x0d })],
      ['a write to the Tuner setting', made({ pidLow: 1, pidHigh: 0x49, action: 1, hdr4: 4, payload: sx.am4U32(20) })],
      ['a normalised write to the Tuner setting', made({ pidLow: 1, pidHigh: 0x49, action: 2, hdr4: 4, payload: sx.am4Float(0.5) })],
      ['a write to the MIDI channel', made({ pidLow: 1, pidHigh: 0x3a, action: 1, hdr4: 4, payload: sx.am4U32(1) })],
      ['a short read of the Tuner setting', made({ pidLow: 1, pidHigh: 0x49, action: 0x0e })],
      ['the Tuner setting read at another block', made({ pidLow: 2, pidHigh: 0x49, action: 0x0d })]
    ]) {
      assert.ok(!sx.isAllowedAm4(f), `${what} would be sent to the AM4`)
    }

    /*
     * The answer, unpacked as the tempo's is: the whole number in the first
     * two bytes, the float in bytes 4 to 7, the AM4's words from byte 8.
     */
    const answer = (pidHigh, whole, text, float = 0) => {
      const raw = new Array(40).fill(0)
      raw[0] = whole & 0xff
      raw[1] = whole >> 8
      const bits = sx.floatBits(float)
      raw.splice(4, 4, bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff)
      raw.splice(8, text.length, ...[...text].map((c) => c.charCodeAt(0)))
      const body = [...H(`F0 00 01 74 15 01 01 00 ${hex([pidHigh])} 00 0D 00 00 00 28 00`), ...sx.packChunked(raw)]
      return [...body, sx.checksum(body), 0xf7]
    }
    const f = answer(0x49, 20, 'CC #20')
    assert.equal(f.length, 64, 'not the 64 bytes his AM4’s long answers are')
    assert.deepEqual(sx.parseAm4GlobalLong(f, sx.AM4.TUNER_CC), { whole: 20, float: 0, text: 'CC #20' })
    /* The shape his AM4 gave for a drive's bypass: 0 in the whole number, the value in the float. */
    assert.deepEqual(sx.parseAm4GlobalLong(answer(0x49, 0, 'CC #20', 20), sx.AM4.TUNER_CC), { whole: 0, float: 20, text: 'CC #20' })
    assert.equal(sx.parseAm4GlobalLong(f, sx.AM4.MIDI_CHANNEL), null, 'the Tuner answer was taken for the channel')
    const bad = [...f]
    bad[62] ^= 1
    assert.equal(sx.parseAm4GlobalLong(bad, sx.AM4.TUNER_CC), null, 'a damaged answer was read')
    assert.equal(sx.parseAm4GlobalLong(sx.buildAm4TunerCcRead(), sx.AM4.TUNER_CC), null, 'the question, echoed back by MIDI Thru, was taken for its answer')

    /*
     * THE NUMBER RULE, in this order, and the computer's half (forgefx's
     * am4TunerSaid and am4TunerCcFrom) holds the same table case for case:
     *
     *   1. "CC #n", the setting's own words for it, is n by itself, any n,
     *      whatever the whole number and the float hold;
     *   2. NONE in the words is none;
     *   3. a whole number of 128 is the AM4's own NONE when the words are
     *      empty or not plain text, and unclear beside any other words;
     *   4. bare digits are believed only when the whole number or the float
     *      (within 1e-3 of a whole number) says the same.
     *
     * So 128 with "20" is unclear even with the float saying 20: step 3 comes
     * before step 4.
     */
    const tunerCc = (whole, text, float = 0) => sx.am4TunerCcFrom(sx.parseAm4GlobalLong(answer(0x49, whole, text, float), sx.AM4.TUNER_CC))
    for (const [whole, text, float, n, why] of [
      [0, 'CC #20', 20, 20, 'the real shape: the value in the float'],
      [0, 'CC #20', 19, 20, 'the real shape, its list counted from 0'],
      [20, 'CC #20', 0, 20, 'the shape first assumed: the value in the whole number'],
      [0, 'cc#20', 0, 20, 'its words, in another case and without the space'],
      [0, ' CC # 100 ', 0, 100, 'its words, spaced'],
      [20, '20', 0, 20, 'bare digits, the whole number agreeing'],
      [0, '20', 20, 20, 'bare digits, the float agreeing'],
      [0, '20', 19.99999, 20, 'bare digits, the float a count on its way through a float'],
      /* The edge of a count, either side: within a thousandth. */
      [0, '20', 19.9992, 20, 'bare digits, the float 0.0008 under'],
      [0, '20', 20.0008, 20, 'bare digits, the float 0.0008 over'],
      [0, 'CC #119', 119, 119, 'the last number that can only mean a function']
    ]) {
      assert.equal(tunerCc(whole, text, float), n, `${why}: ${whole} / ${float} “${text}”`)
    }
    assert.equal(tunerCc(0, 'NONE', 128), 'none')
    assert.equal(tunerCc(128, 'NONE'), 'none')
    assert.equal(tunerCc(20, 'none'), 'none', 'NONE on its screen, whatever the number')
    /* 128 is the AM4's own NONE: none with no words beside it, words that are not plain text included. */
    assert.equal(tunerCc(128, ''), 'none', '128 with no words')
    assert.equal(tunerCc(128, '\x01\x02'), 'none', '128 beside words that are not plain text')
    assert.equal(sx.am4TunerCcFrom({ whole: 128, float: 0, text: null }), 'none', '128 with no text at all')
    assert.equal(tunerCc(128, 'CC #20'), 20, 'the setting’s own words, whatever the whole number')
    for (const [whole, text, float, why] of [
      [0, '20', 0, 'bare digits nothing else says'],
      [0, '20', 19, 'bare digits, a float one off'],
      [0, '20', 20.5, 'bare digits, a float that is not a count'],
      /* A count is within 1e-3 of a whole number, no further: rounded, these two would be 20. */
      [0, '20', 19.6, 'bare digits, a float 0.4 under'],
      [0, '20', 20.4, 'bare digits, a float 0.4 over'],
      [0, '20', 19.998, 'bare digits, a float 0.002 under'],
      [0, '20', 20.002, 'bare digits, a float 0.002 over'],
      [128, '20', 0, 'bare digits with 128 in front'],
      /* 128 says NONE, its words say something else: the two disagree, so nothing is believed, not even NONE. */
      [128, '20', 20, 'bare digits with 128 in front, the float agreeing'],
      [128, '128', 0, 'bare digits saying 128 with 128 in front'],
      [128, '0', 0, 'bare digits saying 0 with 128 in front'],
      [0, '\x01', 20, 'words that are not plain text, no 128'],
      [128, 'PEDAL 1', 0, '128 with other words'],
      [128, 'OFF', 0, '128 with other words'],
      [0, 'CC #0', 0, 'bank select'],
      [0, 'CC #32', 32, 'bank select, its second half'],
      [0, 'CC #120', 120, 'a channel-mode message'],
      [127, 'CC #127', 127, 'a channel-mode message'],
      [123, '123', 123, 'all notes off'],
      [20, 'CC 20', 20, 'not the setting’s own words: no #'],
      [20, 'Tuner 20', 20, 'other words around it'],
      [20, '', 20, 'no words'],
      [129, 'PEDAL 1', 0, 'a pedal, not a CC']
    ]) {
      assert.equal(tunerCc(whole, text, float), null, `${why}: ${whole} / ${float} “${text}” was believed`)
    }
    assert.equal(sx.am4TunerCcFrom(null), null, 'no answer was believed')
    assert.equal(sx.am4TunerCcFrom({ rejected: 4 }), null, 'a refusal was believed')
    assert.equal(sx.am4TunerCcFrom({ rejected: 4, text: 'CC #20' }), null, 'a refusal was believed for its words')
    /*
     * WHICH NUMBER IT NAMES, sendable or not: a close needs to know that the
     * number its tuner was opened on has gone, even to one out of range.
     */
    const named = (whole, text, float = 0) => sx.am4TunerCcNamed(sx.parseAm4GlobalLong(answer(0x49, whole, text, float), sx.AM4.TUNER_CC))
    for (const [whole, text, float, n] of [
      [0, 'CC #20', 20, 20],
      [0, 'CC #120', 120, 120],
      [0, 'CC #0', 0, 0],
      [0, 'CC #32', 32, 32],
      [0, '30', 30, 30],
      [0, 'NONE', 128, 'none'],
      [128, '', 0, 'none'],
      [0, '20', 0, null],
      [0, '20', 19.6, null],
      [0, '20', 19.998, null],
      [0, '20', 19.9992, 20],
      [128, 'PEDAL 1', 0, null],
      [128, '20', 20, null],
      [128, '128', 0, null],
      [128, '0', 0, null],
      [128, 'CC #20', 0, 20],
      [128, 'NONE', 0, 'none'],
      [20, '', 20, null]
    ]) {
      assert.equal(named(whole, text, float), n, `${whole} / ${float} “${text}”`)
    }
    assert.equal(sx.am4TunerCcNamed(null), null)
    assert.equal(sx.am4TunerCcNamed({ rejected: 4, text: 'CC #20' }), null)

    /*
     * THE CHANNEL, from its words alone: its number and its float are places
     * in a list, one below. am4ChannelSaid is what the words plainly say,
     * 1..16, with OMNI as 1 (it hears every channel), or null when they say
     * nothing plain — and then the channel already known on the connection
     * is kept (see the wire's re-open). am4ChannelFrom is a connection that
     * knows none: the factory 1. The computer's half holds the same table.
     */
    const said = (whole, text, float = 0) => sx.am4ChannelSaid(sx.parseAm4GlobalLong(answer(0x3a, whole, text, float), sx.AM4.MIDI_CHANNEL))
    const channel = (whole, text, float = 0) => sx.am4ChannelFrom(sx.parseAm4GlobalLong(answer(0x3a, whole, text, float), sx.AM4.MIDI_CHANNEL))
    for (const [text, ch] of [
      ['1', 1],
      ['2', 2],
      ['CH 2', 2],
      ['Ch2', 2],
      ['CH. 2', 2],
      ['Channel 2', 2],
      ['channel 16', 16],
      ['16', 16]
    ]) {
      assert.equal(said(0, text, ch - 1), ch, `“${text}”`)
      assert.equal(channel(0, text, ch - 1), ch, `“${text}”`)
    }
    assert.equal(said(4, '5'), 5, 'the channel was taken from its number, not its words')
    assert.equal(said(16, 'OMNI', 16), 1, 'OMNI was taken for channel 16')
    assert.equal(said(16, 'omni', 16), 1)
    /* Never from the number, even with no words to go on: a place in a list, one below, or OMNI's 16. */
    for (const [whole, text, why] of [
      [4, '', 'no words'],
      [0, 'Tuner 2', 'other words around it'],
      [16, '17', 'no such channel'],
      [0, 'CH 0', 'no such channel'],
      [2, '', 'no words'],
      [0, '0', 'no such channel'],
      [0, '\x01', 'words that are not plain text']
    ]) {
      assert.equal(said(whole, text, whole), null, `${why}: “${text}” was taken for a channel`)
      assert.equal(channel(whole, text, whole), 1, `${why}: “${text}” is not channel 1, the AM4’s factory channel`)
    }
    assert.equal(sx.am4ChannelSaid({ whole: 4, float: 4, text: null }), null, 'the channel was taken from its number with no words')
    assert.equal(sx.am4ChannelSaid(null), null)
    assert.equal(sx.am4ChannelSaid({ rejected: 4, text: '3' }), null, 'a refusal was believed for its words')
    assert.equal(sx.am4ChannelFrom(null), 1)

    /* The CC itself: 127 opens, 0 closes, only on a number that can mean a function. */
    assert.equal(hex(sx.buildAm4TunerCc(true, { cc: 20, channel: 1 })), 'B0 14 7F')
    assert.equal(hex(sx.buildAm4TunerCc(false, { cc: 20, channel: 3 })), 'B2 14 00')
    for (const learned of [
      null,
      {},
      { cc: 0, channel: 1 },
      { cc: 32, channel: 1 },
      { cc: 120, channel: 1 },
      { cc: 128, channel: 1 },
      { cc: 'none', channel: 1 },
      { cc: 20.5, channel: 1 },
      { cc: 20, channel: 0 },
      { cc: 20, channel: 17 }
    ]) {
      assert.throws(() => sx.buildAm4TunerCc(true, learned), undefined, `${JSON.stringify(learned)} was built`)
    }
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

    /* And one short message: the tuner's CC, exactly as this connection read it from the AM4, at 127 or 0. */
    const tuned = am4Sender((b) => sent.push(b), (l) => logs.push(l), () => ({ cc: 20, channel: 1 }))
    for (const bytes of ['B0 14 7F', 'B0 14 00']) assert.equal(tuned(H(bytes)), 'sent', bytes)
    for (const bytes of ['C0 05', 'B0 14 40', 'B0 14 01', 'B0 15 7F', 'B0 0F 7F', 'B1 14 7F', 'BF 14 00', 'B0 00 01', 'B0 20 01', 'B0 7B 00', '90 3C 40', 'B0 14', 'B0 14 7F 00', 'B0']) {
      assert.equal(tuned(H(bytes)), 'refused', `${bytes} would be sent to the AM4`)
    }
    /* Knowing the number lets no SysEx past the list. */
    assert.equal(tuned(H('F0 00 01 74 15 1F 3A 00 35 F7')), 'refused')
    assert.equal(sent.length, 3)
    /* Nothing read, or nothing usable read: nothing short at all. */
    assert.equal(out(H('B0 14 7F')), 'refused', 'a CC went out before the AM4 was asked its number')
    for (const [learned, bytes] of [
      [null, 'B0 14 7F'],
      [{ cc: 'none', channel: 1 }, 'B0 14 7F'],
      [{ cc: 0, channel: 1 }, 'B0 00 7F'],
      [{ cc: 32, channel: 1 }, 'B0 20 7F'],
      [{ cc: 120, channel: 1 }, 'B0 78 00'],
      [{ cc: 20, channel: 0 }, 'B0 14 7F'],
      [{ cc: 20 }, 'B0 14 7F']
    ]) {
      const wrong = am4Sender((b) => sent.push(b), () => {}, () => learned)
      assert.equal(wrong(H(bytes)), 'refused', `${bytes} went out on ${JSON.stringify(learned)}`)
    }
    assert.equal(sent.length, 3, 'a refused short message reached the adapter')
    assert.equal(sx.am4ShortAllowed(H('B2 14 7F'), { cc: 20, channel: 3 }), 'tuner on')
    assert.equal(sx.am4ShortAllowed(H('B2 14 00'), { cc: 20, channel: 3 }), 'tuner off')
    assert.equal(sx.am4ShortAllowed(H('B2 14 00'), null), null)
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

  /*
   * FM3-EDIT'S MESSAGES STAY ON THE FM3 IN AUTO. Nobody has caught what
   * FM9-Edit or Axe-Edit III send, and the computer app sends FM3-Edit's
   * scene and channel to an FM3 alone (forgefx devices.ts
   * sceneChannelWriteMode). So on an FM9 or Axe-Fx III, Auto sends the
   * published scene, channel and tempo only, checks them, and says so when
   * one does not land; FM3-Edit's goes only when forced in the testing tools.
   * Changed on purpose on 25 October 2026: this test held an FM9 to falling
   * back to FM3-Edit's tempo write by itself.
   */
  test('an FM9 or Axe-Fx III tries only the published scene, channel and tempo in Auto, and says when one does not land', async () => {
    for (const [unit, model] of [['fm9', 0x12], ['axefx3', 0x10]]) {
      const isEdit = (f) => f[5] === 0x01 && [0x24, 0x16, 0x09].includes(f[6])
      /* The tempo: the published SET, read back, and the truth when it did not take. */
      const tempo = await onTheLine(unit, { publishedTempo: false })
      await assert.rejects(tempo.post('/tempo', { bpm: 133 }), (e) => e.status === 502 && /The tempo stayed at 120\./.test(e.message), unit)
      const get = tempo.sx.buildGetTempo(model)
      assert.deepEqual(tempo.frames().map(hex), [get, tempo.sx.buildSetTempo(model, 133), get].map(hex), `${unit}: more than the published tempo went`)
      assert.ok(!tempo.frames().some(isEdit), `${unit} was sent FM3-Edit’s tempo by Auto`)
      assert.deepEqual(tempo.wire.methods().learned, {}, `${unit}: Auto learned a way from a write that did not land`)
      /* The scene, the same. */
      const scene = await onTheLine(unit, { publishedScene: false, sceneEcho: false })
      await assert.rejects(scene.post('/scene', { index: 2 }), (e) => e.status === 502 && /stayed on scene 1/.test(e.message), unit)
      assert.ok(!scene.frames().some(isEdit), `${unit} was sent FM3-Edit’s scene by Auto`)
      assert.equal(scene.unit.state.scene, 0)
      /* The channel, the same. */
      const channel = await onTheLine(unit, { publishedChannel: false })
      await assert.rejects(channel.post('/preset/blocks/58/channel', { channel: 'C' }), (e) => e.status === 502 && /stayed on A/.test(e.message), unit)
      assert.ok(!channel.frames().some(isEdit), `${unit} was sent FM3-Edit’s channel by Auto`)
      /*
       * REFUSED OUTRIGHT, not just ignored: the unit answers the published
       * message with a refusal. That is said as the unit's refusal, nothing
       * is learned, and FM3-Edit's way never goes after it; this is the
       * branch that keeps Auto from falling through to it (mayTryEdit), which
       * no unit that only ignores a message reaches.
       */
      const refusing = await onTheLine(unit, { refusePublished: true })
      for (const [path, body] of [['/scene', { index: 2 }], ['/preset/blocks/58/channel', { channel: 'C' }], ['/tempo', { bpm: 133 }]]) {
        await assert.rejects(refusing.post(path, body), (e) => e.status === 502 && /^The unit refused it: the unit does not know that message\.$/.test(e.message), `${unit} ${path}: not said as the unit’s refusal`)
      }
      assert.ok(!refusing.frames().some(isEdit), `${unit}: FM3-Edit’s way went after a refused published message`)
      assert.deepEqual(refusing.wire.methods().learned, {}, `${unit}: a way was learned from a refusal`)
      assert.deepEqual(refusing.remembered, [], `${unit}: a way was kept on the phone from a refusal`)
      assert.equal(refusing.unit.state.scene, 0)
      assert.equal(refusing.unit.state.bpm, 120)
      /* A published way that works is learned and used, as ever. */
      const works = await onTheLine(unit, { publishedTempo: true })
      assert.deepEqual(await works.post('/tempo', { bpm: 133 }), { ok: true })
      assert.equal(works.unit.state.bpm, 133)
      assert.equal(works.wire.methods().learned.tempo, 'published')
      /* FM3-Edit's way learned on an older copy of the app is not used by Auto: the published goes, and is checked. */
      const old = await onTheLine(unit, { publishedTempo: false, publishedScene: false, sceneEcho: false, methods: { learned: { tempo: 'edit', scene: 'edit', channel: 'edit' } } })
      await assert.rejects(old.post('/tempo', { bpm: 140 }))
      await assert.rejects(old.post('/scene', { index: 3 }))
      assert.ok(!old.frames().some(isEdit), `${unit}: a way learned before sent FM3-Edit’s message by Auto`)
      /* Forced in the testing tools (his account only), it goes, as chosen. */
      const forced = await onTheLine(unit, { publishedTempo: false, publishedScene: false, sceneEcho: false, publishedChannel: false, methods: { tempo: 'edit', scene: 'edit', channel: 'edit' } })
      assert.deepEqual(await forced.post('/tempo', { bpm: 133 }), { ok: true })
      assert.ok(sameFrame(forced.frames()[0], forced.sx.buildSetTempoEdit(model, 133)), `${unit}: the forced tempo did not go FM3-Edit’s way`)
      await forced.post('/scene', { index: 2 })
      assert.equal(forced.unit.state.scene, 2, `${unit}: the forced scene did not go`)
      await forced.post('/preset/blocks/58/channel', { channel: 'C' })
      assert.equal(forced.unit.state.blocks.find((b) => b.eid === 58).channel, 2, `${unit}: the forced channel did not go`)
    }
    /* The FM3 keeps both: FM3-Edit's scene is still found and learned by Auto there. */
    const fm3 = await onTheLine('fm3', { sceneEcho: false, publishedScene: false })
    await fm3.post('/scene', { index: 2 })
    assert.equal(fm3.unit.state.scene, 2)
    assert.equal(fm3.wire.methods().learned.scene, 'edit')
    /* And a refusal of the published scene or channel there still goes on to FM3-Edit's way, and learns it. */
    const fm3r = await onTheLine('fm3', { refusePublished: true })
    await fm3r.post('/scene', { index: 2 })
    assert.equal(fm3r.unit.state.scene, 2, 'the FM3 did not go on to FM3-Edit’s scene after a refusal')
    await fm3r.post('/preset/blocks/58/channel', { channel: 'C' })
    assert.equal(fm3r.unit.state.blocks.find((b) => b.eid === 58).channel, 2, 'the FM3 did not go on to FM3-Edit’s channel after a refusal')
    assert.equal(fm3r.wire.methods().learned.scene, 'edit')
    assert.equal(fm3r.wire.methods().learned.channel, 'edit')
  })

  test('the testing tools on an FM9 or Axe-Fx III: a write check in Auto tries only the published way, and a forced FM3-Edit’s is tried and never remembered', async () => {
    for (const [unit, model] of [['fm9', 0x12], ['axefx3', 0x10]]) {
      const auto = await onTheLine(unit, { publishedScene: false, sceneEcho: false })
      const r = await drive(auto.clock, auto.wire.check('write-scene'))
      assert.equal(r.ok, false, `${unit}: a scene check whose published change did not land passed`)
      assert.ok(!auto.frames().some((f) => sameFrame(f, auto.sx.buildSetSceneEdit(model, 1))), `${unit}: the check sent FM3-Edit’s scene in Auto`)
      const forced = await onTheLine(unit, { publishedScene: false, sceneEcho: false, methods: { scene: 'edit' } })
      const f = await drive(forced.clock, forced.wire.check('write-scene'))
      assert.equal(f.ok, true, f.error)
      assert.ok(forced.frames().some((x) => sameFrame(x, forced.sx.buildSetSceneEdit(model, 1))), `${unit}: the forced check did not try FM3-Edit’s scene`)
      assert.equal(f.way, null, `${unit}: the panel says FM3-Edit’s way was remembered for Auto`)
      assert.equal(forced.wire.methods().learned.scene, undefined, `${unit}: FM3-Edit’s way was learned for Auto`)
      assert.equal(forced.unit.state.scene, 0, `${unit}: the check did not put the scene back`)
    }
    /* The testing tools say so, on the FM9 and Axe-Fx III (anything but the FM3 there: the AM4 has no choices). */
    const page = readFileSync(new URL('../mobile/src/screens/Bluetooth.js', import.meta.url), 'utf8').replace(/\s+/g, ' ')
    assert.match(page, /\{b\.unit !== 'fm3' \? \( <Hint>\{`On the \$\{unitName\(b\.unit\)\}, Auto sends only the published scene, channel and tempo\. FM3-Edit’s way goes only when you pick it here\.`\}<\/Hint> \) : null\}/)
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

  test('the Axe-Fx III’s Program Change carries its bank in CC0, as its manual says, on the MIDI number chosen', async () => {
    const t = await onTheLine('axefx3', { bankIn: 'cc0' })
    await t.post('/preset/select', { number: 475 })
    assert.deepEqual(t.frames().filter((f) => f[0] !== 0xf0).map(hex), ['B0 00 03', 'B0 20 00', 'C0 5B'])
    assert.equal(t.unit.state.preset, 475)
    const ch = await onTheLine('axefx3', { methods: { preset: 'pc', pcChannel: 3 } })
    await ch.post('/preset/select', { number: 5 })
    assert.deepEqual(ch.frames().map(hex), ['B2 00 00', 'B2 20 00', 'C2 05'], 'forced Program Change sent anything else')
    /*
     * A III that read CC0 and CC32 as one fourteen-bit bank (the codec's
     * 'standard' guess; no Fractal document says it) asked for 300 hears bank
     * 2 << 7, a preset that does not exist: nothing loads, and the phone says
     * so. The CC32 guess failed the other way, on a III that reads its
     * manual: 300 landed on 44, a different song.
     */
    const odd = await onTheLine('axefx3', { bankIn: 'cc32' })
    await assert.rejects(odd.post('/preset/select', { number: 300 }), (e) => e.status === 502 && /^The unit stayed on preset 12\./.test(e.message), 'a preset that did not land was taken as landed')
    assert.equal(odd.unit.state.preset, 12, 'the III moved to another preset')
    assert.notEqual(odd.unit.state.preset, 44)
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
   * would cost another pair of builds. Each pretend unit here (an FM9's
   * tempo, an FM3's for the rest, where Auto may go on to FM3-Edit's way)
   * ignores the way tried first, bar the FM9's published tempo, which is
   * all Auto sends it.
   */
  test('a first write to what the unit already has teaches nothing, and the next real change still finds the way that works', async () => {
    /* An FM9's tempo goes the published way alone (see the test above): the one it was already at teaches nothing, the next one teaches that. */
    const tempo = await onTheLine('fm9', { publishedTempo: true })
    await tempo.post('/tempo', { bpm: 120 })
    assert.deepEqual(tempo.wire.methods().learned, {}, 'the tempo it was already at taught a way')
    assert.equal(tempo.remembered.length, 0, 'a way was kept on the phone')
    await tempo.post('/tempo', { bpm: 130 })
    assert.equal(tempo.unit.state.bpm, 130, 'the next tempo did not go')
    assert.equal(tempo.wire.methods().learned.tempo, 'published')

    const preset = await onTheLine('fm9', { sysexPreset: false })
    await preset.post('/preset/select', { number: 12 })
    assert.deepEqual(preset.wire.methods().learned, {}, 'the preset already loaded taught a way')
    await preset.post('/preset/select', { number: 13 })
    assert.equal(preset.unit.state.preset, 13, 'the next preset never tried Program Change')
    assert.equal(preset.wire.methods().learned.preset, 'pc')

    /* FM3-Edit's channel and scene are found by Auto on an FM3 alone. */
    const channel = await onTheLine('fm3', { publishedChannel: false })
    await channel.post('/preset/blocks/58/channel', { channel: 'A' })
    assert.deepEqual(channel.wire.methods().learned, {}, 'the channel the amp was already on taught a way')
    await channel.post('/preset/blocks/58/channel', { channel: 'B' })
    assert.equal(channel.unit.state.blocks.find((b) => b.eid === 58).channel, 1, 'the amp stayed on A')
    assert.equal(channel.wire.methods().learned.channel, 'edit')

    /* With MIDI Thru on, the unit's own copy of the change reads as its answer. */
    const scene = await onTheLine('fm3', { publishedScene: false, sceneEcho: false, thru: true })
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
    /* Refresh names asks again: a scene renamed on the unit's screen shows without a preset change. */
    t.wire.forgetSceneNames()
    await t.get('/presets/12/scenes')
    assert.equal(t.sent.length - before, 8, 'Refresh names handed back the kept copy instead of asking the unit')
    const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    const rig = read('mobile/src/lib/rig.js')
    const reread = rig.slice(rig.indexOf('export async function rereadSceneNames'))
    assert.ok(reread.indexOf('device.freshSceneNames?.()') > 0 && reread.indexOf('device.freshSceneNames?.()') < reread.indexOf('await namesOfLoaded(number)'), 'Refresh names reads before letting the kept names go')
    assert.match(read('mobile/src/lib/device.js'), /export const freshSceneNames = \(\) => bluetoothWire\(\)\?\.forgetSceneNames\?\.\(\)/)
  })

  test('over Bluetooth, the metronome and the tuner say what is true of Bluetooth, not of a computer', () => {
    /* Its own readers: the shared ones further down this file are not made yet when this runs. */
    const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    const flat = (f) => src(f).replace(/\s+/g, ' ')
    /* The unit's click cannot be switched over Bluetooth (every setting write is refused): not "the unit didn't take it". */
    const metronome = src('mobile/src/lib/metronome.js')
    assert.match(metronome, /if \(isUnsupported\(err\)\) return \{ ok: false, unsupported: true \}/, 'a refused click reads as a unit that failed to take it')
    assert.ok(metronome.indexOf('if (isUnsupported(err))') < metronome.indexOf("logDebug('metronome', 'could not reach the unit'"))
    const settings = flat('mobile/src/screens/Settings.js')
    /*
     * "The unit metronome click is not working… It only works on the phone."
     * Over Bluetooth (and on an AM4) the unit's click is not offered at all,
     * the page says why, and a Unit picked earlier clicks on the phone.
     */
    assert.match(settings, /const clickHere = \{ bluetooth: bluetooth && !demo, demo \} const unitCan = unitClick\(rigSlug, clickHere\)/)
    assert.match(settings, /placesFor\(unitCan\.can\)\.map/, 'Unit and Both are offered where the unit cannot click')
    assert.match(settings, /unitCan\.can \? 'The unit’s own click is the steadiest one to play to\.' : unitCan\.why/)
    assert.match(flat('mobile/App.js'), /useUnitMetronome\(rigSlug, unitHere && !demo, \{ bluetooth \}\)/, 'a refused click is still sent on every Bluetooth arrival')
    /* And a tuner with no readings blames no computer when there is none. */
    const tuner = flat('mobile/src/components/Tuner.js')
    assert.match(tuner, /const bluetooth = useBluetoothOn\(\)/)
    /* On an FM9 or Axe-Fx III, the setting that sends the readings, by name (shared/bluetooth-gear tunerQuietLine); on the rest, as it was. */
    assert.match(tuner, /const quietLine = tunerQuietLine\(useBluetoothUnit\(\)\)/)
    assert.match(tuner, /\{stalled && bluetooth && quietLine \? \( <Note tone="warn">\{quietLine\}<\/Note> \) : stalled && bluetooth \? \( <Note tone="warn"> The tuner is on, but the unit isn’t sending readings over Bluetooth\./)
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

    /* Two probes, the only thing a unit that has never answered is sent. */
    const quiet = await onTheLine('fm3', { silent: true })
    const c = quiet.wire.request('/device/detect')
    const d = quiet.wire.request('/device/detect')
    await drive(quiet.clock, Promise.all([c, d]))
    assert.ok(quiet.sent[1].at >= 1200, 'the second went before the first had timed out')
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

  /* "Don't know if you can see any issues from this log." Most of it was "not over Bluetooth", over and over. */
  test('what Bluetooth never answers is refused every time, and said once a connection', async () => {
    const t = await onTheLine('am4')
    for (let i = 0; i < 3; i++) {
      for (const [path, status] of [
        ['/store/config/scene-names-am4%3A99', 404],
        ['/store/config/scene-names-am4%3A98', 404],
        ['/store/config/preset-names-am4', 404],
        ['/presets/99/summary', 501],
        ['/presets/98/summary', 501],
        ['/device', 404]
      ]) {
        await assert.rejects(t.get(path), (e) => e.status === status && e.bluetooth === true, path)
      }
      await assert.rejects(drive(t.clock, t.wire.request('/store/config/scene-names-am4%3A42', { method: 'PUT', body: '{}' })), (e) => e.status === 501)
    }
    const said = (start) => t.logs.filter((l) => l.startsWith(`not over Bluetooth: ${start}`)).length
    assert.equal(said('GET /store/config/scene-names'), 1, 'the same refusal was written again')
    assert.equal(said('GET /store/config/preset-names'), 1)
    assert.equal(said('GET /presets/'), 1)
    assert.equal(said('GET /device'), 1)
    assert.equal(said('PUT /store/config/scene-names'), 1)
    assert.equal(t.sent.length, 0)
    t.wire.close()
    /* A new connection says it again. */
    const again = await onTheLine('am4')
    await assert.rejects(again.get('/device'), (e) => e.status === 404)
    assert.equal(again.logs.filter((l) => l === 'not over Bluetooth: GET /device').length, 1)
    again.wire.close()
  })

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
    /* One good answer first, by hand, or the scene question is never sent. */
    const hello = t.wire.request('/device/detect')
    t.clock.setTimeout(() => t.wire.heard(t.sx.frame(0x11, 0x0c, [0])), 10)
    assert.equal((await drive(t.clock, hello)).connected, true)
    await advance(t.clock, 50)
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
    const asking = t.wire.request('/device/detect')
    const waiting = t.wire.request('/device/detect').then(
      () => null,
      (e) => e
    )
    /* The AM4's own refusal of a message for some other unit. */
    t.clock.setTimeout(() => t.wire.heard(t.sx.frame(0x15, 0x64, [0x0c, 0x02])), 10)
    assert.equal((await drive(t.clock, asking)).connected, false)
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

  /*
   * ANY OTHER UNIT ON THE OTHER END. Until 25 October 2026 only an AM4 on
   * another unit's connection was named; an FM9 answering an FM3's
   * connection was only in the log, and the page said "isn't answering",
   * which sends a player to the plugs. Now any unit the wire knows is named
   * to the page, by its bare name (the page says the article), once, and
   * only before the unit picked has answered. Nothing more is sent for it:
   * a gen-3 connection sends nothing but its probe until the unit picked
   * answers.
   */
  test('any other unit answering a connection before the one picked is named to the page, once, by its bare name', async () => {
    const PAIRS = [
      ['fm3', 0x12, 'FM9', 'the FM3'],
      ['fm3', 0x10, 'Axe-Fx III', 'the FM3'],
      ['fm3', 0x14, 'VP4', 'the FM3'],
      ['fm9', 0x11, 'FM3', 'the FM9'],
      ['axefx3', 0x12, 'FM9', 'the Axe-Fx III'],
      ['am4', 0x11, 'FM3', 'the AM4'],
      ['am4', 0x12, 'FM9', 'the AM4'],
      ['am4', 0x10, 'Axe-Fx III', 'the AM4'],
      ['am4', 0x14, 'VP4', 'the AM4']
    ]
    const { MODEL_NAMES } = await import(WIRE)
    for (const [picked, byte, name, not] of PAIRS) {
      const t = await onTheLine(picked, picked === 'am4' ? {} : { silent: true })
      const refusal = t.sx.frame(byte, 0x64, [0x0c, 0x02])
      /*
       * Fifty times, as a wrong unit refuses every message it is sent (an
       * AM4's polls are not held while the unit is silent): the log keeps 400
       * lines, and the same line fifty times pushed everything else out of it.
       */
      for (let i = 0; i < 50; i++) t.wire.heard(refusal)
      assert.deepEqual(t.foreign, [name], `${picked} hearing ${name}: the page was told ${JSON.stringify(t.foreign)}`)
      assert.equal(t.logs.filter((l) => l === `${MODEL_NAMES[byte]} answered, not ${not}`).length, 1, `${picked} hearing ${name}: not in the log once`)
      if (picked !== 'am4') {
        /* Nothing goes to it but the probe: a write is refused unsent, as for any unit that has not answered. */
        const before = t.sent.length
        await assert.rejects(t.post('/scene', { index: 2 }), (e) => e.status === 504)
        assert.equal(t.sent.length, before, `${picked}: a write went to the ${name}`)
      }
    }
    /* The unit picked has answered: a stray message from another is the log's, not the page's. */
    const answered = await onTheLine('fm3')
    answered.wire.heard(answered.sx.frame(0x12, 0x64, [0x0c, 0x02]))
    assert.deepEqual(answered.foreign, [], 'a connection that works was said to have the wrong unit on it')
    /*
     * THE ONE PICKED ANSWERS AFTER ANOTHER WAS NAMED: the cable moved onto
     * the FM3 with the Uhost still on, and Stop never tapped. The wire goes
     * on (only an AM4 stops it), the FM3 works, and the page's "An FM9
     * answered, not the FM3" is taken off (null), and stays off.
     */
    const moved = await onTheLine('fm3', { silent: true })
    moved.wire.heard(moved.sx.frame(0x12, 0x64, [0x0c, 0x02]))
    assert.deepEqual(moved.foreign, ['FM9'])
    moved.unit.opt.silent = false
    assert.equal((await moved.get('/device/detect')).connected, true)
    assert.deepEqual(moved.foreign, ['FM9', null], 'the page still says an FM9 answered, over an FM3 that works')
    moved.wire.heard(moved.sx.frame(0x12, 0x64, [0x0c, 0x02]))
    assert.deepEqual(moved.foreign, ['FM9', null], 'the FM9 was named again over a connection that works')
    assert.ok(moved.logs.includes('the FM3 answers after all: the other unit is no longer named on the page'))
    /* Nothing to take off on a connection where nobody else was named. */
    const plain = await onTheLine('fm3', { silent: true })
    plain.unit.opt.silent = false
    await plain.get('/device/detect')
    assert.deepEqual(plain.foreign, [])
    /* A model byte nobody knows, and the broadcast one, name nothing. */
    const odd = await onTheLine('fm3', { silent: true })
    odd.wire.heard(odd.sx.frame(0x77, 0x64, [0x0c, 0x02]))
    odd.wire.heard(odd.sx.frame(0x7f, 0x64, [0x0c, 0x02]))
    assert.deepEqual(odd.foreign, [])
    /* The AM4 on another unit's connection is named the same way, and still stops it (the test above): its line is never taken off. */
    const am4 = await onTheLine('fm9', { silent: true })
    am4.wire.heard(am4.sx.frame(0x15, 0x64, [0x0c, 0x02]))
    assert.deepEqual(am4.foreign, ['AM4'])
    am4.unit.opt.silent = false
    await assert.rejects(am4.get('/device/detect'), (e) => e.status === 409)
    assert.deepEqual(am4.foreign, ['AM4'])
  })

  test('a unit that has never answered is sent nothing but the probe: an AM4 picked as an FM3 that stays silent', async () => {
    /*
     * The guard above trips only when the AM4 says something. If it says
     * nothing to an FM3's messages, the full read and every check after it
     * would go on sending it FM3 messages. So nothing but "are you there?"
     * goes out until something answers.
     */
    const t = await onTheLine('fm3', { silent: true })
    assert.equal((await t.get('/device/detect')).connected, false)
    const probe = hex(t.frames()[0])
    assert.deepEqual(await t.get('/preset'), { number: -1, name: '' })
    assert.deepEqual(await t.get('/scene'), { index: -1 })
    assert.deepEqual(await t.get('/tempo'), { bpm: 0 })
    await assert.rejects(t.get('/preset/blocks'), (e) => e.status === 504)
    await assert.rejects(t.get('/presets/40'), (e) => e.status === 504)
    await assert.rejects(t.post('/scene', { index: 2 }), (e) => e.status === 504 && /has not answered yet, so nothing is sent/.test(e.message), 'a write to a silent unit was sent, or counted as done')
    await assert.rejects(t.post('/preset/select', { number: 3 }), (e) => e.status === 504)
    t.wire.startPolls()
    await advance(t.clock, 20000)
    assert.deepEqual(t.frames().map(hex), [probe], 'a unit that has never answered was sent more than the probe')
    assert.deepEqual(t.remembered, [], 'a way to send was learned from a unit that never answered')
    assert.ok(t.logs.some((l) => /held until the FM3 answers/.test(l)), 'the log does not say what was held')
    /* And the first answer opens the line. */
    t.unit.opt.silent = false
    assert.equal((await t.get('/device/detect')).connected, true)
    assert.ok(Number.isInteger((await t.get('/scene')).index) && (await t.get('/scene')).index >= 0, 'an answered unit is still held')
    t.wire.close()
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

  /*
   * THE GEN 3 TUNER, PRESSED FASTER THAN IT ANSWERS. A Close and then a Tuner
   * pressed without waiting ran side by side: the close's off went, the
   * open's on went after it, and only then did the close put down what it
   * believed the unit had open, over the open's. The next Close sent nothing
   * and the unit stayed on its tuner, muted, under a Play that showed it
   * closed. Each is held here to what the unit heard, in order, and to where
   * the unit was left.
   */
  /* What of the tuner a Gen 3 unit was sent, in order: an FM3's unless another model byte is named. */
  const gen3TunerHeard = (t, model = 0x11) =>
    t.frames().flatMap((f) => {
      const words = [
        [t.sx.buildTuner(model, true), 'tuner on'],
        [t.sx.buildTuner(model, false), 'tuner off'],
        [t.sx.buildTunerPage(model, true), 'page open'],
        [t.sx.buildTunerPage(model, false), 'page closed']
      ].find(([m]) => sameFrame(f, m))
      return words ? [words[1]] : []
    })
  const pressTuner = (t, on, deadline) => t.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on }), deadline })

  test('the published tuner: Close then Tuner pressed without waiting, then Close, leaves the unit off its tuner', async () => {
    /* The report's own: open, then Close and Tuner at once, then Close. */
    {
      const t = await onTheLine('fm3', { methods: { tuner: 'push' } })
      await t.post('/tuner', { on: true })
      await advance(t.clock, 200)
      assert.deepEqual(await drive(t.clock, Promise.all([pressTuner(t, false), pressTuner(t, true)])), [{ ok: true }, { ok: true }])
      await advance(t.clock, 200)
      assert.equal(t.unit.state.tuner, true, 'the Tuner pressed after the Close did not open')
      await t.post('/tuner', { on: false })
      assert.deepEqual(gen3TunerHeard(t), ['tuner on', 'tuner off', 'tuner on', 'tuner off'])
      assert.equal(t.unit.state.tuner, false, 'the last Close sent nothing, and the unit was left on its tuner')
    }
    /* Faster still: Tuner, Close, Tuner, Close, Tuner all at once, then Close. */
    {
      const t = await onTheLine('fm3', { methods: { tuner: 'push' } })
      await drive(t.clock, Promise.all([true, false, true, false, true].map((on) => pressTuner(t, on))))
      await advance(t.clock, 200)
      assert.equal(t.unit.state.tuner, true)
      await t.post('/tuner', { on: false })
      assert.deepEqual(gen3TunerHeard(t), ['tuner on', 'tuner off', 'tuner on', 'tuner off', 'tuner on', 'tuner off'])
      assert.equal(t.unit.state.tuner, false, 'the unit was left on its tuner after a burst')
      const before = t.sent.length
      await advance(t.clock, 2000)
      assert.equal(t.sent.length, before, 'something of the tuner went on after the last Close')
    }
    /* A unit that sent no readings, so the phone opened the page to ask: the Close shuts both, and so does the next. */
    {
      const t = await onTheLine('fm3', { methods: { tuner: 'push' } })
      await t.post('/tuner', { on: true })
      await advance(t.clock, 1500)
      assert.equal(t.unit.state.page, true, 'the phone never fell back to asking')
      await drive(t.clock, Promise.all([pressTuner(t, false), pressTuner(t, true)]))
      await advance(t.clock, 1500)
      await t.post('/tuner', { on: false })
      assert.deepEqual(gen3TunerHeard(t), ['tuner on', 'page open', 'tuner off', 'page closed', 'tuner on', 'page open', 'tuner off', 'page closed'])
      assert.equal(t.unit.state.tuner, false, 'the unit was left on its tuner')
      assert.equal(t.unit.state.page, false, 'the unit was left on its tuner page')
    }
  })

  test('the asked-for tuner: Close then Tuner pressed without waiting opens the page again, so it reads, and the next Close shuts it', async () => {
    const t = await onTheLine('fm3')
    await t.post('/tuner', { on: true })
    await advance(t.clock, 500)
    await drive(t.clock, Promise.all([pressTuner(t, false), pressTuner(t, true)]))
    t.events.length = 0
    await advance(t.clock, 1000)
    assert.equal(t.unit.state.page, true, 'the Tuner pressed after the Close asked a page the Close had shut')
    const readings = t.events.filter((e) => e.type === 'tuner')
    assert.ok(readings.length >= 3 && readings.every((r) => r.note === 'A'), `the tuner did not read: ${JSON.stringify(readings.at(-1))}`)
    await t.post('/tuner', { on: false })
    assert.deepEqual(gen3TunerHeard(t), ['page open', 'page closed', 'page open', 'page closed'])
    assert.equal(t.unit.state.page, false, 'the unit was left on its tuner page')
  })

  test('a Gen 3 tuner open that fails leaves nothing behind: the Close and Tuner after it work, on both ways', async () => {
    /* Dropped at its deadline behind a read the unit is slow to answer, with a Close and a Tuner pressed after it. */
    {
      const t = await onTheLine('fm3', { methods: { tuner: 'push' } })
      t.unit.opt.silent = true
      t.wire.request('/scene').catch(() => {})
      await advance(t.clock, 10)
      let dropped = null
      pressTuner(t, true, t.clock.now() + 300).catch((e) => (dropped = e))
      const closing = pressTuner(t, false)
      const opening = pressTuner(t, true, t.clock.now() + 1500)
      await advance(t.clock, 500)
      t.unit.opt.silent = false
      assert.deepEqual(await drive(t.clock, Promise.all([closing, opening])), [{ ok: true }, { ok: true }])
      assert.equal(dropped?.late, true, `the first open was not dropped at its deadline: ${dropped?.message}`)
      await advance(t.clock, 200)
      assert.equal(t.unit.state.tuner, true, 'the Tuner after the dropped one did not open')
      await t.post('/tuner', { on: false })
      assert.deepEqual(gen3TunerHeard(t), ['tuner on', 'tuner off'])
      assert.equal(t.unit.state.tuner, false, 'the last Close sent nothing, and the unit was left on its tuner')
    }
    /* The adapter not taking the page's message once: the next Tuner opens the page, and reads. */
    {
      const t = await onTheLine('fm3')
      let refused = 0
      t.line.refuses = (b) => sameFrame(b, t.sx.buildTunerPage(0x11, true)) && refused++ === 0
      await assert.rejects(drive(t.clock, pressTuner(t, true)), (e) => e.status === 503)
      await t.post('/tuner', { on: true })
      t.events.length = 0
      await advance(t.clock, 1000)
      assert.equal(t.unit.state.page, true, 'the Tuner after a failed one never opened the page')
      assert.ok(t.events.some((e) => e.type === 'tuner' && e.note === 'A'), 'the tuner did not read')
      await t.post('/tuner', { on: false })
      assert.deepEqual(gen3TunerHeard(t), ['page open', 'page closed'])
      assert.equal(t.unit.state.page, false)
    }
  })

  test('a Gen 3 tuner close that fails is sent again by the next Close, on both ways', async () => {
    for (const [methods, shut, heard, left] of [
      [{ tuner: 'push' }, (sx) => sx.buildTuner(0x11, false), ['tuner on', 'tuner off'], (u) => u.state.tuner],
      [undefined, (sx) => sx.buildTunerPage(0x11, false), ['page open', 'page closed'], (u) => u.state.page]
    ]) {
      const way = methods ? 'published' : 'asked-for'
      const t = await onTheLine('fm3', { methods })
      await t.post('/tuner', { on: true })
      await advance(t.clock, 200)
      let refused = 0
      t.line.refuses = (b) => sameFrame(b, shut(t.sx)) && refused++ === 0
      await assert.rejects(drive(t.clock, pressTuner(t, false)), (e) => e.status === 503)
      assert.equal(left(t.unit), true, `the ${way} tuner: the close the adapter did not take reached the unit`)
      assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true })
      assert.deepEqual(gen3TunerHeard(t), heard, `the ${way} tuner`)
      assert.equal(left(t.unit), false, `the ${way} tuner: the next Close sent nothing, and the unit was left on its tuner`)
      const before = t.sent.length
      await advance(t.clock, 1000)
      assert.equal(t.sent.length, before, `the ${way} tuner went on asking after it closed`)
    }
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
    await assert.rejects(wire.request('/device/detect'), (e) => e.status === 503)
    /* And with nothing ever answered, a write is refused unsent: never counted as one that worked. */
    await assert.rejects(wire.request('/scene', { method: 'POST', body: '{"index":1}' }), (e) => e.status === 504)
    const am4 = createBleWire({ unit: 'am4', send: () => false, clock: fakeClock() })
    await assert.rejects(am4.request('/preset'), (e) => e.status === 503)
    assert.throws(() => createBleWire({ unit: 'vp5', send: () => true }), /does not know a unit called vp5/)
    /* A VP4 whose adapter will not take the Program Change: an error, never a preset that went. */
    const vp4 = createBleWire({ unit: 'vp4', send: () => false, clock: fakeClock() })
    await assert.rejects(vp4.request('/preset/select', { method: 'POST', body: '{"number":3,"midiChannel":1}' }), (e) => e.status === 503)
  })

  /* ---------------------------------------------------------------- */
  /* A pretend VP4                                                      */
  /* ---------------------------------------------------------------- */

  /*
   * "I'm curious why the VP4 is not listed? ... it uses the same architecture
   * as the AM4." (Justin, 25 October 2026.) Over Bluetooth a VP4 is sent what
   * the computer sends it for presets and scenes (ForgeFX drivers/vp4.ts:
   * vp4ProgramChange and vp4SceneSelect), and nothing else, ever: no SysEx.
   * A pretend VP4 that writes down every byte it is sent, and answers
   * nothing, as a VP4 over this link does.
   */
  async function pretendVp4({ log = [] } = {}) {
    const { createBleWire, BLE_UNITS } = await import(WIRE)
    const clock = fakeClock()
    const got = []
    const events = []
    const foreign = []
    const wire = createBleWire({ unit: 'vp4', send: (bytes) => (got.push([...bytes]), true), clock, log: (l) => log.push(l), onForeign: (n) => foreign.push(n) })
    wire.subscribe((e) => events.push(e))
    const ask = (path, method = 'GET', body = null) => drive(clock, wire.request(path, { method, body: body === null ? undefined : JSON.stringify(body) }))
    return { wire, clock, got, events, foreign, log, ask, BLE_UNITS }
  }

  test('a VP4 over Bluetooth is sent a Program Change for a preset and its Scene Select for a scene, the computer’s own bytes, and nothing else', async () => {
    const v = await import('../mobile/src/lib/bleVp4.js')
    const t = await pretendVp4()
    assert.equal(t.wire.unit, 'vp4')
    assert.deepEqual(t.BLE_UNITS.at(-1), { key: 'vp4', name: 'VP4' }, 'the VP4 is not the last unit the page offers')
    /* The unit's check: connected while the adapter is, and said as a VP4, so device.js treats it as one (isVp4). */
    const detect = await t.ask('/device/detect')
    assert.equal(detect.connected, true)
    assert.equal(detect.modelId, 0x14)
    assert.equal(detect.short, 'VP4')
    assert.equal(detect.sendOnly, true)
    assert.deepEqual(detect.capabilities.plainMidi, { programChange: true, sceneSelect: true })
    assert.equal(detect.capabilities.via, 'bluetooth')
    assert.equal(detect.capabilities.tuner, false)
    assert.equal(detect.capabilities.hasChannels, false)
    assert.deepEqual(detect.capabilities.presets, { count: 104, addressing: 'bankLetterShort', canScanNames: false })
    const vp4Safety = await import('../shared/vp4-safety.mjs')
    assert.equal(vp4Safety.isVp4(detect), true)
    assert.equal(vp4Safety.vp4ComputerCan(detect.capabilities), true, 'device.js would refuse a VP4 preset over Bluetooth as needing a computer update')
    assert.deepEqual(t.got, [], 'the check sent the VP4 something')

    /* A preset: one Program Change on the player's channel, PC n = A1..Z4, no Bank Select, sent once. */
    const preset = await t.ask('/preset/select', 'POST', { number: 5, midiChannel: 2 })
    assert.deepEqual(t.got, [[0xc1, 5]])
    assert.deepEqual(preset, { ok: true, number: 5, code: 'B2', landed: true, sentOnly: true })
    /* The computer's own bytes (ForgeFX vp4ProgramChange): [0xC0 | channel-1, n]. */
    assert.deepEqual(v.vp4ProgramChange(0, 1), [0xc0, 0])
    assert.deepEqual(v.vp4ProgramChange(103, 16), [0xcf, 103])
    for (const [n, ch] of [[104, 1], [-1, 1], [1.5, 1], [3, 0], [3, 17]]) assert.throws(() => v.vp4ProgramChange(n, ch))
    /* No channel sent: 1, as the computer takes it. */
    await t.ask('/preset/select', 'POST', { number: 0 })
    assert.deepEqual(t.got.at(-1), [0xc0, 0])

    /* A scene: the Scene Select number the player set, value 0..3 = scenes 1..4, on the channel. */
    const scene = await t.ask('/scene', 'POST', { index: 2, sceneCc: 34, midiChannel: 2, sceneCcSet: 1 })
    assert.deepEqual(t.got.at(-1), [0xb1, 34, 2])
    assert.deepEqual(scene, { ok: true, index: 2, sentOnly: true })
    assert.deepEqual(t.events, [{ type: 'scene', index: 2 }])
    assert.deepEqual(v.vp4SceneSelect(1, 1, 0), [0xb0, 1, 0])
    for (const [cc, ch, sc] of [[0, 1, 0], [32, 1, 0], [120, 1, 0], [34, 1, 4], [34, 1, -1], [34, 0, 0]]) assert.throws(() => v.vp4SceneSelect(cc, ch, sc))
    /* The scene the unit watch asks for is the one this connection sent: nothing is read from a VP4. */
    assert.deepEqual(await t.ask('/scene'), { index: 2, sentOnly: true })
    const sent = t.got.length

    /* No number, a bad number, a scene a VP4 does not have, a preset past Z4: refused, nothing sent. */
    for (const body of [{ index: 1 }, { index: 1, sceneCc: 32 }, { index: 1, sceneCc: 0 }, { index: 1, sceneCc: 120 }, { index: 4, sceneCc: 34 }, { index: 1, sceneCc: 34, midiChannel: 17 }]) {
      await assert.rejects(t.ask('/scene', 'POST', body), (e) => e.status === 400, JSON.stringify(body))
    }
    for (const body of [{ number: 104 }, { number: -1 }, {}, { number: 3, midiChannel: 0 }]) {
      await assert.rejects(t.ask('/preset/select', 'POST', body), (e) => e.status === 400, JSON.stringify(body))
    }
    assert.equal(t.got.length, sent, 'a refused request sent the VP4 something')
  })

  test('a VP4 over Bluetooth is refused everything else with nothing sent, and every byte it is ever sent is a Program Change or its Scene Select', async () => {
    const v = await import('../mobile/src/lib/bleVp4.js')
    const t = await pretendVp4()
    /* The reads a VP4 cannot answer over Bluetooth: the preset it is on, the tempo, names, the tuner, every write but presets and scenes. */
    for (const [method, path, status] of [
      ...REFUSED.filter(([, p]) => p !== '/preset/grid'),
      ['GET', '/preset', 501],
      ['GET', '/tempo', 501],
      ['GET', '/presets/5/scenes', 501],
      ['GET', '/presets/5/summary', 501],
      ['POST', '/tuner', 501],
      ['POST', '/tempo', 501],
      ['POST', '/tempo/tap', 501],
      ['POST', '/preset/blocks/58/bypass', 501],
      ['POST', '/preset/blocks/58/channel', 501],
      ['PUT', '/preset/blocks/58/params/150', 501]
    ]) {
      await assert.rejects(t.ask(path, method, {}), (e) => e.status === status && e.bluetooth === true, `${method} ${path}`)
    }
    /* The chain, its names and its on/offs cannot be read: answered empty (Play says why, VP4_OVER_BLUETOOTH). */
    assert.deepEqual(await t.ask('/preset/grid'), { cells: [], name: null, scenes: null, sentOnly: true })
    assert.deepEqual(await t.ask('/preset/scene-state'), [])
    assert.deepEqual(t.got, [], 'a refused request sent the VP4 something')
    /* No footswitch watch, no check, no tuner owed: a VP4 is never asked anything. */
    t.wire.startPolls()
    await advance(t.clock, 60000)
    assert.deepEqual(t.got, [], 'the VP4 was polled')
    assert.equal((await t.wire.check('all')).ok, false)
    assert.deepEqual(t.got, [], 'the check sent the VP4 something')

    /*
     * EVERY BYTE A VP4 CAN RECEIVE, through its one way out (vp4BleAllowed):
     * a Program Change for A1..Z4 on any channel, or a Scene Select on a
     * number the player may use with a scene 0..3. Swept over every two- and
     * three-byte message there is, and the SysEx frames this wire's other
     * units are sent: nothing else passes.
     */
    let passed = 0
    for (let a = 0; a < 256; a++) {
      for (let b = 0; b < 256; b++) {
        const ok = v.vp4BleAllowed([a, b])
        if (ok) {
          passed++
          assert.ok((a & 0xf0) === 0xc0 && b <= 103, `[${a}, ${b}] passes`)
        }
        for (const c of [0, 1, 2, 3, 4, 64, 127, 0xf7]) {
          if (v.vp4BleAllowed([a, b, c])) assert.ok((a & 0xf0) === 0xb0 && b >= 1 && b <= 119 && b !== 32 && c <= 3, `[${a}, ${b}, ${c}] passes`)
        }
      }
    }
    assert.equal(passed, 16 * 104, 'not every Program Change for A1..Z4 on every channel passes')
    const sx = await import('../mobile/src/lib/fractal-sysex.mjs')
    for (const frame of [sx.buildAm4Structure(), sx.buildAm4Scene(1), sx.buildAm4Preset(3), sx.buildGetScene(0x14), ...sx.buildProgramChange(3).slice(0, 2), sx.buildProgramChange(3), [0xf0, 0x00, 0x01, 0x74, 0x14, 0x01, 0xf7], [0xc0], [0xc0, 1, 2], [0xb0, 34], [0xb0, 34, 2, 0], [0x90, 60, 100], [0xf8], []]) {
      assert.equal(v.vp4BleAllowed(frame), false, `${sx.toHex(frame)} would go to a VP4`)
    }
    for (const nonsense of [null, undefined, 'C0 05', [0xc0, '5'], [0xc0, 5.5], [0xc0, 256], [0x1c0, 5]]) assert.equal(v.vp4BleAllowed(nonsense), false, String(nonsense))
  })

  test('a VP4 over Bluetooth: a scene straight after a preset waits for it to load, a tap past its deadline is not sent, and another unit answering is named', async () => {
    const t = await pretendVp4()
    /* The preset's answer comes PRESET_SETTLE_MS after its Program Change, the computer's own first-read delay. */
    const { PRESET_SETTLE_MS } = await import('../mobile/src/lib/bleVp4.js')
    assert.equal(PRESET_SETTLE_MS, 250)
    const preset = t.wire.request('/preset/select', { method: 'POST', body: JSON.stringify({ number: 8, midiChannel: 1 }) })
    const scene = t.wire.request('/scene', { method: 'POST', body: JSON.stringify({ index: 1, sceneCc: 34, midiChannel: 1 }), deadline: t.clock.now() + 1500 })
    await flush()
    assert.deepEqual(t.got, [[0xc0, 8]], 'the scene went before the VP4 had time to load the preset')
    await advance(t.clock, PRESET_SETTLE_MS)
    await drive(t.clock, preset)
    await drive(t.clock, scene)
    assert.deepEqual(t.got, [[0xc0, 8], [0xb0, 34, 1]])
    /* A tap whose deadline the settle would pass: not sent at all. */
    const again = t.wire.request('/preset/select', { method: 'POST', body: JSON.stringify({ number: 9 }) })
    const late = t.wire.request('/scene', { method: 'POST', body: JSON.stringify({ index: 2, sceneCc: 34 }), deadline: t.clock.now() + 100 })
    await assert.rejects(drive(t.clock, late), (e) => e.late === true && e.status === 504)
    await drive(t.clock, again)
    assert.deepEqual(t.got.at(-1), [0xc0, 9])
    assert.ok(!t.got.some((m) => m[0] === 0xb0 && m[2] === 2), 'a scene past its deadline was sent')
    /* And a preset tapped past its deadline: nothing. */
    t.clock.set(t.clock.now() + 10)
    await assert.rejects(t.wire.request('/preset/select', { method: 'POST', body: '{"number":1}', deadline: t.clock.now() - 1 }), (e) => e.late === true)
    assert.notDeepEqual(t.got.at(-1), [0xc0, 1])
    /* What comes back is read for one thing only: another unit's message names it, once. */
    const sx = await import('../mobile/src/lib/fractal-sysex.mjs')
    t.wire.heard([0xf0, 0x00, 0x01, 0x74, 0x15, 0x0c, 0x02, 0x0f, 0xf7])
    t.wire.heard([0xf0, 0x00, 0x01, 0x74, 0x12, 0x0c, 0x02, 0x0f, 0xf7])
    assert.deepEqual(t.foreign, ['AM4'], 'another unit on the adapter is not named, or named twice')
    t.wire.heard([0xf0, 0x00, 0x01, 0x74, 0x14, 0x0c, 0x02, 0x0f, 0xf7])
    assert.ok(t.log.some((l) => /over Bluetooth the app reads nothing from a VP4/.test(l)))
    assert.ok(sx.isFractal([0xf0, 0x00, 0x01, 0x74, 0x14, 0x0c, 0x02, 0x0f, 0xf7]))
    /* Closed: everything refused, nothing sent. */
    const before = t.got.length
    t.wire.close()
    await assert.rejects(t.wire.request('/preset/select', { method: 'POST', body: '{"number":2}' }), (e) => e.status === 503)
    assert.equal(t.got.length, before)
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

  /*
   * "Let's make them load even if it's slower on Bluetooth, but it doesn't
   * have to constantly be rereading them once it reads them once."
   */
  test('an AM4’s scene names over Bluetooth: one stored preset, read whole, with nothing sent while it comes', async () => {
    const t = await onTheLine('am4')
    const read = t.get('/presets/5/scenes')
    /* A scene pressed while the preset is still coming waits for it: nothing goes to an AM4 mid-send. */
    const press = t.post('/scene', { index: 2 })
    assert.deepEqual(await read, { number: 5, names: ['CLEAN', 'CRUNCH', 'LEAD BOOST', ''] })
    await press
    assert.deepEqual(t.unit.state.dumped, [5], 'the stored preset was not asked for, or asked for twice')
    assert.deepEqual(t.unit.state.heardWhileSending.map(hex), [], 'something was sent to the AM4 while it was sending a preset')
    assert.equal(t.unit.state.scene, 2, 'the press made while the names came was lost')
    assert.equal(t.unit.state.frozen, false)
    assert.ok(t.logs.some((l) => /^read the scene names of B02 in \d+\.\d s$/.test(l)), 'how long it took is not in the log')

    /* Once: the same slot again is not another four seconds. */
    assert.deepEqual(await t.get('/presets/5/scenes'), { number: 5, names: ['CLEAN', 'CRUNCH', 'LEAD BOOST', ''] })
    assert.deepEqual(t.unit.state.dumped, [5], 'the names were read again with nothing asking for it')
    /* Unless Refresh names asks. */
    t.wire.forgetSceneNames()
    await t.get('/presets/5/scenes')
    assert.deepEqual(t.unit.state.dumped, [5, 5], 'Refresh names did not reach the unit')
    /* Unnamed scenes are an answer too: four blanks, not a failure. */
    assert.deepEqual(await t.get('/presets/6/scenes'), { number: 6, names: ['', '', '', ''] })
    /* Never as a summary, which Play asks of the slots either side. */
    await assert.rejects(t.get('/presets/7/summary'), (e) => e.status === 501)
    assert.deepEqual(t.unit.state.dumped, [5, 5, 6])
    t.wire.close()
  })

  /*
   * The review's case: a Bluetooth link slower than 1.2 KB/s could never
   * finish a stored preset when the wait ran frame to frame, and the next
   * message went to an AM4 still sending.
   */
  test('a stored preset on a slow link is waited out byte by byte, and one given up on is waited out before anything else is sent', async () => {
    const slow = await onTheLine('am4', { rate: 0.8 })
    const read = slow.get('/presets/5/scenes')
    const press = slow.post('/scene', { index: 2 })
    assert.deepEqual(await read, { number: 5, names: ['CLEAN', 'CRUNCH', 'LEAD BOOST', ''] }, 'a slow link gave up on the names')
    await press
    assert.ok(slow.clock.now() > 12000, `the whole preset took only ${slow.clock.now()} ms at 800 B/s`)
    assert.deepEqual(slow.unit.state.heardWhileSending.map(hex), [], 'something was sent to the AM4 while it was sending a preset')
    assert.equal(slow.unit.state.scene, 2)
    slow.wire.close()

    /* A unit that goes quiet after the first frame, past the wait, then sends the rest. */
    const stall = await onTheLine('am4', { stallAfterHead: 4000 })
    const given = stall.get('/presets/5/scenes')
    const after = stall.post('/scene', { index: 3 })
    await assert.rejects(given, (e) => e.status === 504, 'a stalled preset was read')
    await after
    assert.deepEqual(stall.unit.state.heardWhileSending.map(hex), [], 'the press went to the AM4 while it was still sending the preset given up on')
    assert.equal(stall.unit.state.scene, 3, 'the press was lost')
    assert.equal(stall.unit.state.frozen, false)
    /* Not again by itself: a read given up part-way would hold the line again on every visit. */
    await assert.rejects(stall.get('/presets/5/scenes'), (e) => e.status === 501)
    assert.deepEqual(stall.unit.state.dumped, [5], 'a preset given up on part-way was read again with nothing asking')
    /* Refresh names asks again: one stalled read does not turn the names off. */
    stall.wire.forgetSceneNames()
    stall.unit.opt.stallAfterHead = 0
    assert.deepEqual((await stall.get('/presets/5/scenes')).names, ['CLEAN', 'CRUNCH', 'LEAD BOOST', ''])
    stall.wire.close()
  })

  test('an AM4 that never answers for a stored preset is not asked again; a damaged one is not believed', async () => {
    const quiet = await onTheLine('am4', { noDumps: true })
    await assert.rejects(quiet.get('/presets/5/scenes'), (e) => e.status === 504)
    assert.ok(quiet.clock.now() < 5000, 'a unit that never answers held the line for more than its gap')
    assert.ok(quiet.logs.some((l) => /not asked for again on this connection/.test(l)))
    await assert.rejects(quiet.get('/presets/6/scenes'), (e) => e.status === 501)
    assert.deepEqual(quiet.unit.state.dumped, [5], 'a unit that never answers was asked again')
    /* Unless Refresh names asks. */
    quiet.wire.forgetSceneNames()
    await assert.rejects(quiet.get('/presets/6/scenes'), (e) => e.status === 504)
    assert.deepEqual(quiet.unit.state.dumped, [5, 6], 'Refresh names did not ask a unit that once did not answer')
    /* And the line is free again for everything else. */
    assert.deepEqual(await quiet.get('/preset'), { number: 5, name: 'Clean Room' })
    quiet.wire.close()

    const damaged = await onTheLine('am4', { damageDump: true })
    await assert.rejects(damaged.get('/presets/5/scenes'), (e) => e.status === 504)
    assert.ok(damaged.logs.some((l) => /scene names of B02 came back damaged/.test(l)))
    /* Damaged is not silent: the next try still goes to the unit. */
    await assert.rejects(damaged.get('/presets/5/scenes'), (e) => e.status === 504)
    assert.deepEqual(damaged.unit.state.dumped, [5, 5])
    damaged.wire.close()
  })

  test('the stored preset reader: every part checked, only four names read out', async () => {
    const sx = await import(SX)
    const frames = am4DumpOf(sx, 103, ['RHYTHM', 'SOLO', '', 'A NAME OF THIRTY-ONE LETTERS!!!'])
    assert.deepEqual(frames.map((f) => f.length), [13, 3082, 3082, 3082, 3082, 11])
    assert.deepEqual(sx.parseAm4DumpSceneNames(frames, 103), { location: 103, names: ['RHYTHM', 'SOLO', '', 'A NAME OF THIRTY-ONE LETTERS!!!'] })
    assert.equal(sx.parseAm4DumpSceneNames(frames, 102), null, 'another slot’s names were taken for this one')
    assert.equal(sx.parseAm4DumpSceneNames(frames.filter((_f, i) => i !== 3), 103), null, 'a preset missing a chunk was read')
    assert.equal(sx.parseAm4DumpSceneNames(frames.slice(0, 5), 103), null, 'a preset with no end was read')
    const shortChunk = frames.map((f, i) => (i === 2 ? [...f.slice(0, 100), ...f.slice(101)] : f))
    assert.equal(sx.parseAm4DumpSceneNames(shortChunk, 103), null, 'a chunk with a byte lost was read')
    const badSum = frames.map((f, i) => (i === 4 ? f.map((b, j) => (j === 40 ? b ^ 1 : b)) : f))
    assert.equal(sx.parseAm4DumpSceneNames(badSum, 103), null, 'a chunk failing its checksum was read')
    assert.equal(sx.am4DumpPart(sx.buildAm4Structure()), null, 'a structure read was taken for part of a preset')
    assert.equal(sx.parseAm4DumpSceneNames(frames, 104), null)
    assert.equal(sx.parseAm4DumpSceneNames(null, 5), null)
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

  /*
   * THE AM4'S OWN TUNER. "On the AM4 the tuner doesn't activate on the
   * device, it only shows it on the phone ... I have a MIDI device that does
   * it." Its two settings are read, then its own CC goes on its own channel,
   * then the four readings as before; the close sends the same CC at 0.
   */
  const READ_TUNER_CC = 'F0 00 01 74 15 01 01 00 49 00 0D 00 00 00 00 00 54 F7'
  const READ_CHANNEL = 'F0 00 01 74 15 01 01 00 3A 00 0D 00 00 00 00 00 27 F7'
  const TUNER_POLLS = ['tuner note', 'tuner frequency', 'tuner cents', 'tuner string']
  /* Everything sent but the readings, which come at their own pace. */
  const besidesReadings = (t, from = 0) =>
    t
      .frames()
      .slice(from)
      .filter((f) => !(f[0] === 0xf0 && TUNER_POLLS.includes(t.sx.am4Allowed(f)?.name)))
      .map(hex)
  const readingsOf = (t) => t.events.filter((e) => e.type === 'tuner')

  test('the AM4 tuner: its own tuner opened by its own CC, then its four readings, as a note', async () => {
    /* Answers shaped like his AM4's (0 in the whole number, the value in the float), and one case in the shape first assumed. */
    for (const [options, cc, shape] of [
      [{ unitTunerCc: 20, unitChannel: 3 }, 'B2 14', 'whole number 0, float 20, words “CC #20”'],
      [{ unitTunerCc: 20, unitChannel: 3, unitTunerText: 'plain' }, 'B2 14', 'whole number 0, float 20, words “20”'],
      [{ unitTunerCc: 20, unitChannel: 3, unitTunerFrom0: true }, 'B2 14', 'whole number 0, float 19, words “CC #20”'],
      [{ unitTunerCc: 100, unitChannel: 16, unitChannelWords: 'CH ' }, 'BF 64', 'whole number 0, float 100, words “CC #100”'],
      /* OMNI hears every channel: the AM4's factory 1 is sent. */
      [{ unitTunerCc: 20, unitChannel: 'OMNI' }, 'B0 14', 'whole number 0, float 20, words “CC #20”'],
      [{ unitTunerCc: 20, unitChannel: 3, unitAnswers: 'old', unitTunerText: 'plain' }, 'B2 14', 'whole number 20, float 0, words “20”']
    ]) {
      const t = await onTheLine('am4', options)
      const why = JSON.stringify(options)
      assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'opened' }, why)
      await advance(t.clock, 1000)
      assert.deepEqual(t.frames().slice(0, 7).map(hex), [READ_TUNER_CC, READ_CHANNEL, `${cc} 7F`, ...[1, 2, 3, 4].map((w) => hex(t.sx.buildAm4TunerPoll(w)))], why)
      assert.equal(t.unit.state.tunerOpen, true, `the AM4’s own tuner did not open: ${why}`)
      const readings = readingsOf(t)
      assert.ok(readings.length >= 2, `only ${readings.length} readings`)
      assert.deepEqual(readings[0], { type: 'tuner', freq: 110, note: 'A', octave: 2, cents: -3 })
      t.unit.state.tuner = [36, 0, 0, 0]
      await advance(t.clock, 800)
      assert.deepEqual(t.events.at(-1), { type: 'tuner', note: '', octave: undefined, cents: null }, 'silence is not shown as silence')
      /* The close reads the setting again, whole, and its 0 goes on the number and channel the AM4 still names. */
      const shut = t.sent.length
      assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true, unitTuner: 'closed' })
      assert.deepEqual(besidesReadings(t, shut), [READ_TUNER_CC, READ_CHANNEL, `${cc} 00`], `the AM4’s own tuner was not closed: ${why}`)
      assert.equal(t.unit.state.tunerOpen, false)
      assert.deepEqual(t.unit.state.tunerHeard.map(hex), [`${cc} 7F`, `${cc} 00`], 'the AM4 heard its tuner’s CC more than once each way')
      const before = t.sent.length
      await advance(t.clock, 1000)
      assert.equal(t.sent.length, before, 'the tuner kept asking after it closed')
      assert.equal(t.unit.state.frozen, false, `the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
      assert.ok(t.logs.some((l) => /^the AM4’s Tuner setting reads “(CC #)?(20|100)”, its MIDI channel “(CH )?(3|16|OMNI)”: CC (20|100) on channel (3|16|1)$/.test(l)), `the log does not say what the AM4 reported: ${why}`)
      /* And the raw answer, so a pasted log shows the shape his AM4 really uses: once a connection, however often the tuner opens. */
      await t.post('/tuner', { on: true })
      await advance(t.clock, 300)
      await t.post('/tuner', { on: false })
      assert.deepEqual(
        t.logs.filter((l) => l.startsWith('the AM4 answered about its Tuner setting: ')),
        [`the AM4 answered about its Tuner setting: ${shape}`],
        why
      )
      assert.equal(t.logs.filter((l) => l.startsWith('the AM4 answered about its MIDI channel: ')).length, 1, why)
      assert.equal(t.unit.state.tunerOpen, false)
    }
  })

  test('an AM4 whose Tuner setting is NONE is sent no CC at all, the answer says so, and the phone still tunes', async () => {
    const t = await onTheLine('am4')
    assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'none' })
    await advance(t.clock, 1000)
    assert.ok(readingsOf(t).length >= 2, 'no readings with the Tuner setting at NONE')
    await t.post('/tuner', { on: false })
    assert.ok(t.frames().every((f) => f[0] === 0xf0), 'a short message went to an AM4 with no Tuner number')
    /* No number, so the channel is not asked about: nothing would be sent on it. */
    assert.deepEqual(besidesReadings(t), [READ_TUNER_CC])
    assert.ok(t.logs.includes('the AM4’s Tuner setting reads “NONE”: no MIDI number, so its own tuner is left as it is (SETUP > MIDI/Remote > Tuner)'))
    assert.ok(t.logs.includes('the AM4 answered about its Tuner setting: whole number 0, float 128, words “NONE”'))
    /* Asked again at the next open: he may have set one on the AM4 in between. */
    t.unit.state.tunerCc = 20
    const mark = t.sent.length
    assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'opened' })
    await t.post('/tuner', { on: false })
    assert.deepEqual(besidesReadings(t, mark), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 7F', READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'])
    assert.equal(t.unit.state.tunerOpen, false)
    assert.equal(t.unit.state.frozen, false)
  })

  test('an unclear answer about the Tuner setting sends nothing, is not asked again on that connection, and the phone still tunes', async () => {
    for (const [answer, why] of [
      [{ whole: 0, float: 0, text: '20' }, 'bare digits nothing else says'],
      [{ whole: 0, float: 19, text: '20' }, 'bare digits, the float one off'],
      [{ whole: 0, float: 0, text: 'CC #0' }, 'bank select'],
      [{ whole: 0, float: 32, text: 'CC #32' }, 'bank select, its second half'],
      [{ whole: 0, float: 120, text: 'CC #120' }, 'a channel-mode message'],
      [{ whole: 127, float: 127, text: 'CC #127' }, 'a channel-mode message'],
      [{ whole: 20, float: 20, text: 'Tuner 20' }, 'other words around it'],
      ['silent', 'no answer']
    ]) {
      /* The AM4 itself is on CC 20: anything the phone sent on a number of its own guessing would show. */
      const t = await onTheLine('am4', { unitTunerCc: 20, unitTunerAnswer: answer })
      assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'unknown' }, why)
      await advance(t.clock, 1000)
      assert.ok(readingsOf(t).length >= 2, `${why}: the readings stopped`)
      await t.post('/tuner', { on: false })
      await t.post('/tuner', { on: true })
      await advance(t.clock, 500)
      await t.post('/tuner', { on: false })
      assert.ok(t.frames().every((f) => f[0] === 0xf0), `${why}: a CC went out`)
      assert.deepEqual(besidesReadings(t), [READ_TUNER_CC], `${why}: asked again on the same connection`)
      assert.equal(t.unit.state.tunerOpen, false)
      assert.equal(t.unit.state.frozen, false, `${why}: the AM4 froze`)
      assert.ok(t.logs.some((l) => l.startsWith('the AM4’s own tuner is left as it is: about its Tuner setting, ')), why)
    }
  })

  test('the AM4 tuner pressed on, off, on, off faster than the AM4 answers ends closed, every message in order', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20, delay: 60 })
    const press = (on) => t.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on }) })
    await drive(t.clock, Promise.all([press(true), press(false), press(true), press(false)]))
    await advance(t.clock, 1000)
    assert.deepEqual(besidesReadings(t), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 7F', READ_TUNER_CC, READ_CHANNEL, 'B0 14 00', READ_TUNER_CC, READ_CHANNEL, 'B0 14 7F', READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'])
    assert.equal(t.unit.state.tunerOpen, false, 'a late open left the AM4 on its tuner')
    const before = t.sent.length
    await advance(t.clock, 1000)
    assert.equal(t.sent.length, before, 'the readings went on after the last close')
    assert.equal(t.unit.state.frozen, false)
  })

  /*
   * KEPT OPEN UNTIL CLOSE. "On the AM4 when turning on the tuner it stays on
   * for about 15 seconds on the unit and then turns off. On the phone it
   * stays on until you hit close. We want it to stay on until the user hits
   * close." (23 October 2026) While the phone's tuner is open, the AM4's
   * own tuner is opened again every three seconds, after the same two reads
   * an open makes, on the number it went out on. The pretend AM4 here is a
   * level, as the real one is taken to be: a 127 opens, a 0 closes.
   */
  test('the AM4’s own tuner stays open until Close: its 127 again every three seconds after the two reads, and the 0 last', async () => {
    const { AM4_TUNER_KEEP_MS } = await import(WIRE)
    assert.equal(AM4_TUNER_KEEP_MS, 3000, 'the same three seconds as the computer’s')
    const t = await onTheLine('am4', { unitTunerCc: 20, unitChannel: 3 })
    assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'opened' })
    await advance(t.clock, AM4_TUNER_KEEP_MS - 300)
    assert.deepEqual(besidesReadings(t), [READ_TUNER_CC, READ_CHANNEL, 'B2 14 7F'], 'opened again before it was due')
    await advance(t.clock, 700)
    assert.deepEqual(besidesReadings(t), [READ_TUNER_CC, READ_CHANNEL, 'B2 14 7F', READ_TUNER_CC, READ_CHANNEL, 'B2 14 7F'], 'not opened again once due, or not after the two reads')
    /* The AM4 lets go of it, about fifteen seconds in: back within three, the readings going on throughout. */
    await advance(t.clock, 11_000)
    t.unit.state.tunerOpen = false
    await advance(t.clock, AM4_TUNER_KEEP_MS + 400)
    assert.equal(t.unit.state.tunerOpen, true, 'the AM4 let go of its own tuner and it was not opened again')
    assert.ok(t.unit.state.tunerHeard.length >= 6 && t.unit.state.tunerHeard.every((b) => hex(b) === 'B2 14 7F'), `heard ${t.unit.state.tunerHeard.map(hex).join(', ')}`)
    assert.ok(readingsOf(t).length > 50, `only ${readingsOf(t).length} readings in eighteen seconds`)
    assert.ok(t.logs.some((l) => l.startsWith('sent the AM4’s own tuner kept open (CC 20 at 127, channel 3)')), 'the log does not say it was kept open')
    /* The close: the setting read again and the 0, the last thing sent, and nothing at all after it. */
    const shut = t.sent.length
    assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true, unitTuner: 'closed' })
    assert.deepEqual(besidesReadings(t, shut), [READ_TUNER_CC, READ_CHANNEL, 'B2 14 00'])
    assert.equal(hex(t.frames().at(-1)), 'B2 14 00', 'the 0 was not the last thing sent')
    const closed = t.sent.length
    await advance(t.clock, AM4_TUNER_KEEP_MS * 4)
    assert.equal(t.sent.length, closed, 'something went after Close')
    assert.equal(t.unit.state.tunerOpen, false)
    assert.equal(t.unit.state.frozen, false, `the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
    /* And the channel the AM4 names now, when it names another: the 127 and then the 0 go there. */
    const c = await onTheLine('am4', { unitTunerCc: 20, unitChannel: 3 })
    await c.post('/tuner', { on: true })
    c.unit.state.midiChannel = 5
    await advance(c.clock, AM4_TUNER_KEEP_MS + 400)
    await c.post('/tuner', { on: false })
    assert.deepEqual(c.unit.state.tunerHeard.map(hex), ['B2 14 7F', 'B4 14 7F', 'B4 14 00'])
    c.wire.close()
    t.wire.close()
  })

  test('the AM4’s own tuner is not opened again on a number the AM4 no longer names, nothing is forgotten, and why is said once', async () => {
    for (const [change, why] of [
      [(u) => (u.state.tunerCc = 30), 'another number'],
      [(u) => (u.state.tunerCc = 'none'), 'NONE'],
      [(u) => (u.opt.unitTunerAnswer = 'silent'), 'no answer'],
      [(u) => (u.opt.unitTunerAnswer = { whole: 20, float: 20, text: 'Tuner 20' }), 'other words around it'],
      [(u) => (u.opt.unitTunerAnswer = { whole: 0, float: 121, text: 'CC #121' }), 'a number its tuner may not be sent']
    ]) {
      const t = await onTheLine('am4', { unitTunerCc: 20 })
      await t.post('/tuner', { on: true })
      const opened = t.sent.length
      change(t.unit)
      await advance(t.clock, 3000 * 2 + 400)
      assert.deepEqual(besidesReadings(t, opened), [READ_TUNER_CC, READ_TUNER_CC], `${why}: more than the Tuner setting’s read`)
      assert.equal(t.logs.filter((l) => l.startsWith('the AM4’s own tuner is not opened again: its Tuner setting ')).length, 1, `${why}: not said once`)
      /* Back on 20: opened again in its time, and the close sends its 0 there, as it always did. */
      t.unit.state.tunerCc = 20
      delete t.unit.opt.unitTunerAnswer
      await advance(t.clock, 3000 + 400)
      assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true, unitTuner: 'closed' }, why)
      assert.deepEqual(t.unit.state.tunerHeard.map(hex), ['B0 14 7F', 'B0 14 7F', 'B0 14 00'], why)
      assert.equal(t.unit.state.frozen, false, `${why}: the AM4 froze`)
      t.wire.close()
    }
  })

  test('a Close pressed while the AM4’s own tuner is being opened again gets no 127 after it', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20, slowSettings: 400 })
    await t.post('/tuner', { on: true })
    await advance(t.clock, 3000 + 250)
    assert.deepEqual(besidesReadings(t), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 7F', READ_TUNER_CC], 'the read before the 127 was not out')
    assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true, unitTuner: 'closed' })
    await advance(t.clock, 3000 * 3)
    assert.deepEqual(besidesReadings(t), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 7F', READ_TUNER_CC, READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'])
    assert.deepEqual(t.unit.state.tunerHeard.map(hex), ['B0 14 7F', 'B0 14 00'], 'a 127 went after the Close')
    assert.equal(t.unit.state.tunerOpen, false)
    t.wire.close()
  })

  /*
   * KEPT UP ONLY WHILE THE APP STAYS ON SCREEN. On an iPhone the code stops
   * in a pocket and the AM4 lets go; the first tick back found the keep
   * overdue and put the AM4 back on its tuner, muted, before Close could be
   * tapped. On Android the ticks go on in a pocket, holding the AM4 on its
   * tuner against a footswitch. Off screen even once, that tuner is not kept
   * up again; the readings and the Close go on as before, and the next open
   * is kept up afresh.
   */
  test('the AM4’s own tuner is not kept up once the app has gone off screen during it, not even on the way back', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20 })
    await t.post('/tuner', { on: true })
    await advance(t.clock, 3000 + 400)
    assert.deepEqual(t.unit.state.tunerHeard.map(hex), ['B0 14 7F', 'B0 14 7F'], 'not kept up on screen')
    t.wire.screenOff()
    t.unit.state.tunerOpen = false
    await advance(t.clock, 3000 * 4)
    assert.deepEqual(t.unit.state.tunerHeard.map(hex), ['B0 14 7F', 'B0 14 7F'], 'a 127 went with the app off screen')
    t.wire.screenOn()
    await advance(t.clock, 3000 * 4)
    assert.deepEqual(t.unit.state.tunerHeard.map(hex), ['B0 14 7F', 'B0 14 7F'], 'a 127 went on the way back, before Close could be tapped')
    assert.equal(t.unit.state.tunerOpen, false, 'the AM4 was put back on its tuner')
    assert.ok(readingsOf(t).length > 50, 'the readings stopped')
    assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true, unitTuner: 'closed' })
    assert.equal(hex(t.unit.state.tunerHeard.at(-1)), 'B0 14 00', 'the Close did not send its 0')
    /* Opened again, on screen: kept up again. Opened while off screen: not. */
    await t.post('/tuner', { on: true })
    await advance(t.clock, 3000 + 400)
    assert.deepEqual(t.unit.state.tunerHeard.slice(3).map(hex), ['B0 14 7F', 'B0 14 7F'], 'a tuner opened again was not kept up')
    await t.post('/tuner', { on: false })
    t.wire.screenOff()
    const before = t.unit.state.tunerHeard.length
    await t.post('/tuner', { on: true })
    t.wire.screenOn()
    await advance(t.clock, 3000 * 3)
    assert.equal(t.unit.state.tunerHeard.length, before + 1, 'a tuner opened off screen was kept up once back')
    await t.post('/tuner', { on: false })
    t.wire.close()
    /* And the link tells the wire, both ways, and on a connection made in a pocket. */
    const link = readFileSync(new URL('../mobile/src/lib/bleLink.js', import.meta.url), 'utf8')
    assert.match(link, /^  wire\?\.stopPolls\(\)\n  \/\*[\s\S]*?\*\/\n  if \(status !== 'inactive'\) wire\?\.screenOff\(\)\n\}/m, 'the app put away does not reach the wire')
    assert.match(link, /^      wire\.startPolls\(\)\n      wire\.screenOn\(\)$/m)
    assert.match(link, /^  \} else made\.screenOff\(\)$/m, 'a connection made off screen keeps the AM4 on its tuner')
  })

  test('the FM3’s tuner is left exactly as it was: nothing new at three seconds', async () => {
    const t = await onTheLine('fm3')
    await t.post('/tuner', { on: true })
    await advance(t.clock, 2500)
    const early = new Set(t.frames().map(hex))
    const from = t.sent.length
    await advance(t.clock, 7000)
    assert.ok(t.frames().slice(from).every((f) => early.has(hex(f))), 'the FM3 was sent something new while its tuner was open')
    await t.post('/tuner', { on: false })
    t.wire.close()
  })

  test('the AM4 left on its own tuner by a drop is closed from the next connection, and opened again by it', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20 })
    await t.post('/tuner', { on: true })
    await advance(t.clock, 500)
    /* The adapter goes with the tuner open: the 0 cannot reach the unit. */
    t.line.gone = true
    t.wire.close()
    assert.equal(t.unit.state.tunerOpen, true)
    t.line.gone = false
    t.reconnect()
    /* The player closes it on the phone. This connection has read nothing, so it reads first, then the 0. */
    let mark = t.sent.length
    assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true, unitTuner: 'closed' })
    assert.deepEqual(t.frames().slice(mark).map(hex), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'])
    assert.equal(t.unit.state.tunerOpen, false, 'the AM4 was left on its tuner')
    /* A second close knows it is closed, and sends nothing: no read, and no 0 again from what the first one found. */
    assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true, unitTuner: 'unknown' })
    assert.equal(t.sent.length, mark + 3)
    /* And nor does a third, after an open that found NONE: nothing is open, and this connection has asked. */
    t.unit.state.tunerCc = 'none'
    assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'none' })
    await t.post('/tuner', { on: false })
    assert.deepEqual(besidesReadings(t, mark + 3), [READ_TUNER_CC], 'a close with nothing open sent a 0 from a verdict kept')
    t.unit.state.tunerCc = 20

    /* Back with the app's tuner still open, the link opens it again (bleLink): the needle moves and the AM4 is on its tuner. */
    await t.post('/tuner', { on: true })
    await advance(t.clock, 500)
    t.line.gone = true
    t.wire.close()
    t.line.gone = false
    t.reconnect()
    mark = t.sent.length
    t.events.length = 0
    assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'opened' })
    await advance(t.clock, 1000)
    assert.equal(t.unit.state.tunerOpen, true)
    assert.ok(readingsOf(t).length >= 2, 'the needle stayed frozen after the adapter came back')
    await t.post('/tuner', { on: false })
    /* 127 again to a tuner already open: a level, so it stays open, and the one 0 closes it. */
    assert.deepEqual(besidesReadings(t, mark), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 7F', READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'])
    assert.equal(t.unit.state.tunerOpen, false)
    assert.equal(t.unit.state.frozen, false)
  })

  /*
   * The review's case: the tuner closed on the phone while Bluetooth was
   * down. That close had no connection to go on, and the next connection
   * found the phone's tuner closed and did nothing, so the AM4 stayed on its
   * own tuner screen for good. Now the wire that was let go of says the 0 is
   * owed, the link keeps that across the drop, and the next connection
   * closes it.
   */
  test('the AM4 tuner closed on the phone while Bluetooth was down is closed on the unit when the link comes back', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20 })
    await t.post('/tuner', { on: true })
    await advance(t.clock, 500)
    assert.equal(t.unit.state.tunerOpen, true)
    /* The adapter goes with the AM4 on its tuner: the 0 cannot go, so it is owed. */
    t.line.gone = true
    const old = t.wire
    assert.deepEqual(old.close(), { unitTunerOwed: true })
    assert.equal(old.unitTunerOwed(), true)
    assert.deepEqual(old.close(), { unitTunerOwed: true }, 'a second close forgot what the first one found')
    assert.ok(t.logs.includes('the AM4 may still be on its own tuner: it is closed from the next connection'))
    /* While it is away the phone's tuner is closed: nothing is there to send it on, and nothing is sent. */
    const mark = t.sent.length
    await advance(t.clock, 5000)
    assert.equal(t.sent.length, mark, 'something was sent while the adapter was away')
    assert.equal(t.unit.state.tunerOpen, true)
    /* Back: the link sends the owed close on the new connection, which reads first, then sends the 0. */
    t.line.gone = false
    t.reconnect()
    assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true, unitTuner: 'closed' })
    assert.deepEqual(t.frames().slice(mark).map(hex), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'])
    assert.equal(t.unit.state.tunerOpen, false, 'the AM4 was left on its tuner')
    assert.equal(t.unit.state.frozen, false)
    /* That connection let go of cleanly owes nothing. */
    assert.deepEqual(t.wire.close(), { unitTunerOwed: false })

    /* Dropped again while that close is still reading the setting: still owed, to the connection after. */
    const r = await onTheLine('am4', { unitTunerCc: 20, delay: 60 })
    await r.post('/tuner', { on: true })
    await advance(r.clock, 300)
    r.line.gone = true
    r.wire.close()
    r.line.gone = false
    r.reconnect()
    const closing = r.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: false }) })
    await advance(r.clock, 10)
    assert.equal(hex(r.frames().at(-1)), READ_TUNER_CC, 'the test dropped the link at the wrong moment')
    r.line.gone = true
    assert.deepEqual(r.wire.close(), { unitTunerOwed: true }, 'a close still reading was forgotten with the link')
    await drive(r.clock, closing)
    r.line.gone = false
    r.reconnect()
    assert.deepEqual(await r.post('/tuner', { on: false }), { ok: true, unitTuner: 'closed' })
    assert.equal(r.unit.state.tunerOpen, false)

    /* Nothing owed when nothing is: never opened, closed on the phone, the 0 sent as it closes, or NONE. */
    const never = await onTheLine('am4', { unitTunerCc: 20 })
    assert.deepEqual(never.wire.close(), { unitTunerOwed: false })
    const shut = await onTheLine('am4', { unitTunerCc: 20 })
    await shut.post('/tuner', { on: true })
    await advance(shut.clock, 300)
    await shut.post('/tuner', { on: false })
    shut.line.gone = true
    assert.deepEqual(shut.wire.close(), { unitTunerOwed: false })
    const live = await onTheLine('am4', { unitTunerCc: 20 })
    await live.post('/tuner', { on: true })
    await advance(live.clock, 300)
    assert.deepEqual(live.wire.close(), { unitTunerOwed: false })
    assert.equal(live.unit.state.tunerOpen, false)
    const none = await onTheLine('am4')
    await none.post('/tuner', { on: true })
    await advance(none.clock, 300)
    none.line.gone = true
    assert.deepEqual(none.wire.close(), { unitTunerOwed: false })
    /* And a gen-3 wire never owes the AM4 anything. */
    const fm3 = await onTheLine('fm3')
    await fm3.post('/tuner', { on: true })
    fm3.line.gone = true
    assert.deepEqual(fm3.wire.close(), { unitTunerOwed: false })
  })

  /*
   * THE LINK'S HALF, RUN. bleLink asks each wire it lets go of whether the
   * AM4 was left on its own tuner, keeps that across the drop, and on the
   * next connection, once the rig has read everything: opens the tuner again
   * if the phone's is open, or else closes the AM4's, reading first. Only a
   * turn that really did something settles it — opened, closed, or NONE — so
   * a connection that drops before its turn, or whose turn sent nothing,
   * hands it on to the one after. Another unit forgets it.
   */
  const tunerFrames = (t, from = 0, to = t.sent.length) =>
    t
      .frames()
      .slice(from, to)
      .map(hex)
      .filter((h) => h === READ_TUNER_CC || h === READ_CHANNEL || !h.startsWith('F0'))

  test('the link: a 0 owed by a wire let go of is sent by the next connection, after the rig has read everything', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20 })
    const b = await linkOnABench(t)
    try {
      b.link.startBluetoothLink(() => {})
      await advance(t.clock, 2000)
      assert.ok(b.bench.current, 'the link did not connect')
      b.rig.tunerOn = true
      assert.deepEqual(await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' })), { ok: true, unitTuner: 'opened' })
      assert.equal(t.unit.state.tunerOpen, true)

      /* Dropped with the phone's tuner still open: back, it opens again once the rig has read everything. */
      let back = b.away()
      b.drop()
      assert.equal(t.unit.state.tunerOpen, true, 'the test’s adapter was not gone')
      /* The rig's read takes its time; where the line stood when it ended is kept. */
      let refreshedAt = null
      b.bench.refreshAll = async () => {
        await new Promise((resolve) => t.clock.setTimeout(resolve, 200))
        refreshedAt = t.sent.length
      }
      let mark = t.sent.length
      back()
      await advance(t.clock, 3000)
      assert.ok(refreshedAt !== null, 'the rig was not asked to read everything')
      assert.deepEqual(tunerFrames(t, mark, refreshedAt), [], 'the tuner was opened before the rig had read everything')
      assert.deepEqual(tunerFrames(t, mark), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 7F'])
      assert.equal(t.unit.state.tunerOpen, true)

      /* Dropped again, and the phone's tuner closed while it is away: back, the owed 0 goes, read first. */
      back = b.away()
      b.drop()
      b.rig.tunerOn = false
      refreshedAt = null
      mark = t.sent.length
      back()
      await advance(t.clock, 3000)
      assert.ok(refreshedAt !== null)
      assert.deepEqual(tunerFrames(t, mark, refreshedAt), [], 'the 0 was sent before the rig had read everything')
      assert.deepEqual(tunerFrames(t, mark), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'], 'the owed 0 was not sent')
      assert.equal(t.unit.state.tunerOpen, false, 'the AM4 was left on its tuner')
      assert.ok(b.said.includes('the phone’s tuner is closed but the AM4 may still be on its own from before; closing it now'))

      /* Sent, it is settled: the connection after owes nothing, and asks nothing. */
      back = b.away()
      b.drop()
      mark = t.sent.length
      back()
      await advance(t.clock, 3000)
      assert.deepEqual(tunerFrames(t, mark), [], 'a 0 already sent was owed again')
      assert.equal(t.unit.state.frozen, false, `the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
    } finally {
      b.done()
    }
  })

  test('the link: over Bluetooth a customer needs the purchase itself, never only a store out of reach, and his account keeps the computer’s rule', async () => {
    /*
     * The computer's link lets anybody in when the store cannot be reached
     * (mayDrive's `!available`), which is harmless there: with no signal
     * there is no relay. Bluetooth needs no signal, so the same yes, with a
     * sign-in that ran out offline still opening the app, was a free rig
     * for any account in airplane mode, for good. So over Bluetooth it is
     * the purchase itself (the one remembered on the phone included), and
     * for his account what it always was.
     */
    const { mayDriveBluetooth, mayDrive } = await import('../mobile/src/lib/unlock-rule.js')
    for (const unlocked of [false, true]) {
      for (const available of [false, true]) {
        assert.equal(mayDriveBluetooth({ unlocked, available }, false), unlocked, `a customer, unlocked ${unlocked}, store ${available ? 'up' : 'out of reach'}`)
        assert.equal(mayDriveBluetooth({ unlocked, available }, true), mayDrive({ unlocked, available }), `his account, unlocked ${unlocked}, store ${available ? 'up' : 'out of reach'}`)
      }
    }
    assert.equal(mayDriveBluetooth(), false)
    assert.equal(mayDriveBluetooth({ unlocked: false, available: false }, 'yes'), false, 'anything but true is taken for his account')

    for (const [purchase, admin, connects] of [
      [{ unlocked: false, available: false }, false, false],
      [{ unlocked: false, available: true }, false, false],
      [{ unlocked: true, available: false }, false, true],
      [{ unlocked: false, available: false }, true, true],
      [{ unlocked: false, available: true }, true, false]
    ]) {
      const t = await onTheLine('am4')
      const b = await linkOnABench(t)
      try {
        b.bench.purchase = purchase
        b.bench.admin = admin
        const told = []
        b.link.startBluetoothLink((s) => told.push(s.link))
        await advance(t.clock, 2000)
        const what = `${admin ? 'his account' : 'a customer'}, ${JSON.stringify(purchase)}`
        assert.equal(Boolean(b.bench.current), connects, `${what}: ${connects ? 'not connected' : 'connected over Bluetooth'}`)
        assert.equal(b.said.includes('not connecting over Bluetooth: the app is not unlocked on this phone'), !connects, `${what}: the log does not say why`)
        if (!connects) assert.deepEqual(told, ['off'], `${what}: the bar is told something other than off`)
        /* Watching the purchase only while stopped at the unlock. */
        assert.equal(b.bench.purchaseWatchers.size, connects ? 0 : 1, `${what}: the purchase is ${connects ? 'still watched with the link up' : 'not watched, so nothing starts the link when it lands'}`)
      } finally {
        b.done()
      }
    }

    /*
     * AND THE PURCHASE LANDING LATE STARTS IT. Nothing else asks again
     * (App.js restarts the link on who is signed in, the demo and
     * Bluetooth, never the purchase), so a customer whose purchase came in
     * after the link was asked (the one remembered on the phone read late
     * at a launch with no signal, a Restore, a Buy with Bluetooth on) sat on
     * 'off' until a tap. Now the link starts the moment the purchase lets them in, and
     * only then: a store answer that is still no, or only "out of reach",
     * starts nothing.
     */
    {
      const t = await onTheLine('am4')
      const b = await linkOnABench(t)
      try {
        b.bench.purchase = { unlocked: false, available: false }
        b.link.startBluetoothLink(() => {})
        await advance(t.clock, 2000)
        assert.equal(b.bench.current, null)
        b.purchase({ available: true })
        await advance(t.clock, 2000)
        assert.equal(b.bench.current, null, 'a store answering no starts the link over Bluetooth')
        b.purchase({ available: false })
        await advance(t.clock, 2000)
        assert.equal(b.bench.current, null, 'the store out of reach starts the link over Bluetooth for a customer')
        b.purchase({ unlocked: true })
        await advance(t.clock, 2000)
        assert.ok(b.bench.current, 'a purchase that lands after the link was asked does not start it')
        assert.ok(b.said.includes('the app is unlocked on this phone now: connecting over Bluetooth'), 'the log does not say why the link started')
        assert.equal(b.bench.purchaseWatchers.size, 0, 'the purchase is still watched with the link up')
      } finally {
        b.done()
      }
    }
    /* Stopped while waiting: nothing watched, and a purchase after it starts nothing. */
    {
      const t = await onTheLine('am4')
      const b = await linkOnABench(t)
      try {
        b.bench.purchase = { unlocked: false, available: true }
        b.link.startBluetoothLink(() => {})
        await advance(t.clock, 2000)
        assert.equal(b.bench.purchaseWatchers.size, 1)
        b.link.stopBluetoothLink()
        assert.equal(b.bench.purchaseWatchers.size, 0, 'the purchase is still watched after the link was stopped')
        b.purchase({ unlocked: true })
        await advance(t.clock, 2000)
        assert.equal(b.bench.current, null, 'a purchase after the link was stopped starts it over Bluetooth')
        /* And asked twice while locked, it is watched once. */
        b.bench.purchase = { unlocked: false, available: true }
        b.link.startBluetoothLink(() => {})
        b.link.pokeBluetooth()
        b.link.startBluetoothLink(() => {})
        assert.equal(b.bench.purchaseWatchers.size, 1, 'the purchase is watched more than once')
        b.link.stopBluetoothLink()
      } finally {
        b.done()
      }
    }
  })

  test('the link: an owed 0 outlasts a connection that drops before its turn, and one whose turn sent nothing', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20 })
    const b = await linkOnABench(t)
    try {
      b.link.startBluetoothLink(() => {})
      await advance(t.clock, 2000)
      b.rig.tunerOn = true
      await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
      let back = b.away()
      b.drop()
      b.rig.tunerOn = false

      /* Back, but gone again while the rig is still reading everything: that connection never had its turn. */
      let release = null
      b.bench.refreshAll = () => new Promise((resolve) => (release = resolve))
      let mark = t.sent.length
      back()
      await advance(t.clock, 2000)
      assert.ok(release, 'the test did not hold the rig’s read')
      back = b.away()
      b.drop()
      release()
      await advance(t.clock, 500)
      assert.deepEqual(tunerFrames(t, mark), [], 'a connection let go of before its turn still had one')

      /* Back, and the AM4 says nothing about its Tuner setting: the turn sends nothing, and the 0 is still owed. */
      b.bench.refreshAll = async () => {}
      t.unit.opt.unitTunerAnswer = 'silent'
      mark = t.sent.length
      back()
      await advance(t.clock, 3000)
      assert.deepEqual(tunerFrames(t, mark), [READ_TUNER_CC], 'the silent connection did more than ask')
      assert.equal(t.unit.state.tunerOpen, true)

      /* The next one, answering: the 0 at last. */
      delete t.unit.opt.unitTunerAnswer
      back = b.away()
      b.drop()
      mark = t.sent.length
      back()
      await advance(t.clock, 3000)
      assert.deepEqual(tunerFrames(t, mark), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'], 'the owed 0 was forgotten on the way')
      assert.equal(t.unit.state.tunerOpen, false, 'the AM4 was left on its tuner')
      assert.equal(t.unit.state.frozen, false, `the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
    } finally {
      b.done()
    }
  })

  test('the link: another unit picked forgets the AM4’s owed 0', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20 })
    const b = await linkOnABench(t)
    try {
      b.link.startBluetoothLink(() => {})
      await advance(t.clock, 2000)
      b.rig.tunerOn = true
      await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
      const back = b.away()
      b.drop()
      b.rig.tunerOn = false
      /* Another unit picked while it is away, and then the AM4 again: the rig is cleared each time, and the 0 with it. */
      b.settings({ unit: 'fm3' })
      b.settings({ unit: 'am4' })
      assert.equal(b.bench.resets, 2, 'the unit change did not clear the rig')
      const mark = t.sent.length
      back()
      await advance(t.clock, 3000)
      assert.ok(b.bench.current, 'the link did not connect again')
      assert.deepEqual(tunerFrames(t, mark), [], 'an owed 0 outlived a change of unit')
    } finally {
      b.done()
    }
  })

  /*
   * THE REOPEN'S HALF OF THE OWED 0. Back with the phone's tuner still open,
   * the link opens the AM4's again; a turn that sent nothing (the AM4 silent
   * about its Tuner setting) does not settle the 0 the link holds owed, so
   * the connection after, finding the phone's tuner closed by then, still
   * closes the AM4's. Settled on any answer, that 0 was lost after one
   * silent reconnect, and the AM4 stayed on its tuner for good.
   */
  test('the link: a reopen that sent nothing leaves the owed 0 for the connection after', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20 })
    const b = await linkOnABench(t)
    try {
      b.link.startBluetoothLink(() => {})
      await advance(t.clock, 2000)
      b.rig.tunerOn = true
      await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
      assert.equal(t.unit.state.tunerOpen, true)
      /* Dropped with the phone's tuner open; back with the AM4 silent about its Tuner setting: the reopen only asks. */
      let back = b.away()
      b.drop()
      t.unit.opt.unitTunerAnswer = 'silent'
      let mark = t.sent.length
      back()
      await advance(t.clock, 3000)
      assert.ok(b.said.includes('the tuner was open when the adapter went; opening it again'), 'the link did not open the tuner again')
      assert.deepEqual(tunerFrames(t, mark), [READ_TUNER_CC], 'the silent reopen did more than ask')
      /* The player closes the phone's tuner on that connection: nothing open on it, nothing sent. */
      b.rig.tunerOn = false
      mark = t.sent.length
      assert.deepEqual(await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":false}' })), { ok: true, unitTuner: 'unknown' })
      assert.deepEqual(tunerFrames(t, mark), [], 'the close on the silent connection sent something')
      assert.equal(t.unit.state.tunerOpen, true)
      /* Dropped again; back with the AM4 answering: the 0 still owed goes, read first. */
      back = b.away()
      b.drop()
      delete t.unit.opt.unitTunerAnswer
      mark = t.sent.length
      back()
      await advance(t.clock, 3000)
      assert.deepEqual(tunerFrames(t, mark), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'], 'the owed 0 was settled by a reopen that sent nothing')
      assert.equal(t.unit.state.tunerOpen, false, 'the AM4 was left on its tuner')
      assert.equal(t.unit.state.frozen, false, `the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
    } finally {
      b.done()
    }
  })

  /*
   * LETTING GO WITH THE ADAPTER STILL THERE. Disconnect, Bluetooth off,
   * another unit or another adapter, with the AM4 on its own tuner: the
   * link has the wire close it in its turn first, reading the setting
   * again, and only then lets go. The wire's own close() would have sent
   * its 0 straight out on the number read at the open — onto Output Volume,
   * if the player had moved the Tuner off CC 20 with the tuner up.
   */
  test('the link: let go of with the AM4 on its own tuner, the wire closes it in its turn first, read again', async () => {
    const ways = [
      ['Disconnect', (b) => b.link.holdBluetooth()],
      ['Bluetooth off', (b) => b.link.stopBluetoothLink()],
      ['another unit', (b) => b.settings({ unit: 'fm3' })],
      ['another adapter', (b) => b.settings({ adapter: { id: 'adapter-2', name: 'another adapter' } })]
    ]
    for (const [what, letGo] of ways) {
      for (const [change, want, why] of [
        [() => {}, [READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'], 'still CC 20'],
        /* CC 20 given to Output Volume: a 0 on it would silence the rig, and freezes the pretend AM4. */
        [(u) => (u.state.tunerCc = 'none'), [READ_TUNER_CC], 'NONE now, CC 20 is Output Volume']
      ]) {
        const t = await onTheLine('am4', { unitTunerCc: 20 })
        const b = await linkOnABench(t)
        try {
          b.link.startBluetoothLink(() => {})
          await advance(t.clock, 2000)
          const old = b.bench.current
          b.rig.tunerOn = true
          assert.deepEqual(await drive(t.clock, old.request('/tuner', { method: 'POST', body: '{"on":true}' })), { ok: true, unitTuner: 'opened' })
          await advance(t.clock, 300)
          change(t.unit)
          /* What the phone's tuner does next is the rig's; another unit clears it. */
          if (what === 'another unit') b.rig.tunerOn = false
          const mark = t.sent.length
          /* Where the line stood, and the AM4's tuner, as the old wire went: another adapter connects again after it. */
          let gone = null
          let openAsItWent = null
          await drive(
            t.clock,
            Promise.resolve(letGo(b)).then(() => {
              gone = t.sent.length
              openAsItWent = t.unit.state.tunerOpen
            })
          )
          assert.ok(gone > mark, `${what}: let go of before the AM4’s tuner was closed in its turn`)
          assert.notEqual(b.bench.current, old, `${what}: the old wire was not let go of`)
          await advance(t.clock, 3000)
          assert.deepEqual(tunerFrames(t, mark, gone), want, `${what}, ${why}`)
          assert.ok(b.said.includes('letting go with the AM4 on its own tuner: closing it first'), what)
          assert.equal(openAsItWent, why !== 'still CC 20', `${what}, ${why}: the AM4’s tuner was ${openAsItWent ? 'open' : 'closed'} as the wire went`)
          assert.equal(t.unit.state.frozen, false, `${what}, ${why}: the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
        } finally {
          b.done()
        }
      }
    }

    /*
     * Given a second at most. An AM4 slow to answer is let go of on time, and
     * the wire's close() sends the 0 as the fallback, on the number the AM4
     * had named by then: CC 30 here, read again before the second was up.
     */
    const t = await onTheLine('am4', { unitTunerCc: 20, slowSettings: 700 })
    const b = await linkOnABench(t)
    try {
      b.link.startBluetoothLink(() => {})
      await advance(t.clock, 5000)
      const old = b.bench.current
      assert.ok(old, 'the link did not connect')
      await drive(t.clock, old.request('/tuner', { method: 'POST', body: '{"on":true}' }))
      assert.equal(t.unit.state.tunerOpen, true)
      t.unit.state.tunerCc = 30
      const mark = t.sent.length
      const at = t.clock.now()
      const going = Promise.resolve(b.link.holdBluetooth())
      await advance(t.clock, 900)
      assert.equal(b.bench.current, old, 'let go of before its second was up')
      await drive(t.clock, going)
      assert.equal(b.bench.current, null)
      assert.ok(t.clock.now() - at <= b.link.LET_GO_MS + 1, `let go of after ${t.clock.now() - at} ms`)
      assert.deepEqual(tunerFrames(t, mark), [READ_TUNER_CC, READ_CHANNEL, 'B0 1E 00'])
      assert.ok(t.logs.includes('the AM4’s own tuner closed as the connection closes: sent'), 'the 0 was not the fallback’s')
      assert.equal(t.unit.state.tunerOpen, false)
      assert.equal(t.unit.state.frozen, false, `the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
    } finally {
      b.done()
    }
  })

  /*
   * Control Center pulled down, Siri listening, the app switcher's first
   * peek: iOS says 'inactive', with Play still there under it. The AM4's own
   * tuner stays kept up through it. Only 'background', the app put away,
   * stops the keep, and for good for the tuner open now (keepUnitTuner).
   */
  test('the link: Control Center or Siri over Play keeps the AM4 on its tuner; putting the app away lets it go', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20 })
    const b = await linkOnABench(t)
    try {
      b.link.startBluetoothLink(() => {})
      await advance(t.clock, 2000)
      assert.ok(b.bench.current, 'the link did not connect')
      b.rig.tunerOn = true
      await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
      assert.equal(t.unit.state.tunerOpen, true)
      const opens = () => tunerFrames(t).filter((h) => h === 'B0 14 7F').length
      b.screen('inactive')
      t.unit.state.tunerOpen = false
      let mark = opens()
      await advance(t.clock, 3000 * 3 + 400)
      assert.ok(opens() > mark, 'Control Center pulled down over the tuner stopped keeping the AM4 on its tuner')
      assert.equal(t.unit.state.tunerOpen, true, 'the AM4 was let go of its tuner under Control Center')
      b.screen('active')
      mark = opens()
      await advance(t.clock, 3000 * 2 + 400)
      assert.ok(opens() > mark, 'not kept up once Control Center closed')
      /* iOS goes through 'inactive' on the way to 'background', and back the same way. */
      b.screen('inactive')
      b.screen('background')
      t.unit.state.tunerOpen = false
      mark = opens()
      await advance(t.clock, 3000 * 4)
      b.screen('inactive')
      b.screen('active')
      await advance(t.clock, 3000 * 4)
      assert.equal(opens(), mark, 'a 127 went with the app put away, or on the way back before Close could be tapped')
      assert.equal(t.unit.state.tunerOpen, false, 'the AM4 was put back on its tuner')
      b.rig.tunerOn = false
      await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":false}' }))
      assert.equal(tunerFrames(t).at(-1), 'B0 14 00', 'the Close did not send its 0')
    } finally {
      b.done()
    }
  })

  /*
   * A GEN 3 TUNER CLOSED WHILE THE ADAPTER WAS AWAY. The Close found no
   * connection to go on, the phone's tuner went down anyway, and the next
   * connection started with nothing marked open, so it sent nothing and every
   * Close on it found nothing to close: the unit stayed on its tuner, muted,
   * under a Play that said it was closed. Now the wire let go of says what
   * the unit was left on, and the next connection closes that, and only that.
   */
  const gen3OnABench = async (methods) => {
    const t = await onTheLine('fm3', { methods })
    const b = await linkOnABench(t)
    b.bench.settings = { ...b.bench.settings, unit: 'fm3' }
    b.link.startBluetoothLink(() => {})
    await advance(t.clock, 2000)
    assert.ok(b.bench.current, 'the link did not connect')
    return { t, b }
  }
  const GEN3_WAYS = [
    /* The published tuner, sending readings: only its on went, so only its off is owed. */
    ['published', { tuner: 'push' }, 200, ['tuner on'], ['tuner off']],
    /* The published tuner, silent, so the phone opened the page to ask as well: both are owed. */
    ['published, then asked', { tuner: 'push' }, 1500, ['tuner on', 'page open'], ['tuner off', 'page closed']],
    ['asked-for', undefined, 200, ['page open'], ['page closed']]
  ]

  test('the link: a Gen 3 tuner closed while the adapter was away is closed on the unit when it comes back, on every way', async () => {
    for (const [way, methods, open, opened, closed] of GEN3_WAYS) {
      const { t, b } = await gen3OnABench(methods)
      try {
        b.rig.tunerOn = true
        assert.deepEqual(await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' })), { ok: true })
        await advance(t.clock, open)
        assert.deepEqual(gen3TunerHeard(t), opened, `${way}: the test opened the tuner wrong`)
        /* The adapter goes, and Close is pressed while it is away: refused, and the phone's tuner goes down. */
        let back = b.away()
        b.drop()
        b.rig.tunerOn = false
        await advance(t.clock, 2000)
        assert.deepEqual(gen3TunerHeard(t), opened, `${way}: something of the tuner was sent while the adapter was away`)
        /* Back: the new connection closes what the unit was left on. */
        back()
        await advance(t.clock, 5000)
        assert.deepEqual(gen3TunerHeard(t), [...opened, ...closed], `${way}: the owed close was not sent`)
        assert.equal(t.unit.state.tuner, false, `${way}: the unit was left on its tuner, muted, under a Play that said closed`)
        assert.equal(t.unit.state.page, false, `${way}: the unit was left on its tuner page`)
        assert.ok(b.said.includes('the phone’s tuner is closed but the FM3 may still be on its tuner from before; closing it now'), way)
        /* Sent, it is settled: the connection after sends nothing of the tuner. */
        back = b.away()
        b.drop()
        back()
        await advance(t.clock, 5000)
        assert.deepEqual(gen3TunerHeard(t), [...opened, ...closed], `${way}: a close already sent was owed again`)
        /* And the tuner opens and closes as ever on it. */
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, open)
        b.rig.tunerOn = false
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":false}' }))
        assert.deepEqual(gen3TunerHeard(t), [...opened, ...closed, ...opened, ...closed], `${way}: the tuner after the owed close`)
        assert.equal(t.unit.state.tuner || t.unit.state.page, false, way)
      } finally {
        b.done()
      }
    }
  })

  test('the link: a Gen 3 owed close outlasts a connection whose close did not go, and is settled by a reopen the phone then closes', async () => {
    /* The owed close not taken by the adapter once: the connection after sends it again. */
    for (const [way, methods, open, opened, closed] of GEN3_WAYS) {
      const { t, b } = await gen3OnABench(methods)
      try {
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, open)
        let back = b.away()
        b.drop()
        b.rig.tunerOn = false
        const first = closed[0] === 'tuner off' ? t.sx.buildTuner(0x11, false) : t.sx.buildTunerPage(0x11, false)
        let refused = 0
        t.line.refuses = (m) => sameFrame(m, first) && refused++ === 0
        back()
        await advance(t.clock, 5000)
        assert.equal(refused, 1, `${way}: the owed close was not tried`)
        assert.deepEqual(gen3TunerHeard(t), opened, `${way}: the test’s adapter took the owed close`)
        assert.equal(t.unit.state.tuner || t.unit.state.page, true)
        back = b.away()
        b.drop()
        back()
        await advance(t.clock, 5000)
        assert.deepEqual(gen3TunerHeard(t), [...opened, ...closed], `${way}: an owed close the adapter did not take was forgotten`)
        assert.equal(t.unit.state.tuner || t.unit.state.page, false, `${way}: the unit was left on its tuner`)
      } finally {
        b.done()
      }
    }
    /* Back with the phone's tuner still open: reopened, and the phone's own Close closes it. Nothing is owed after. */
    for (const [way, methods, open, opened, closed] of GEN3_WAYS) {
      const { t, b } = await gen3OnABench(methods)
      try {
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, open)
        let back = b.away()
        b.drop()
        back()
        await advance(t.clock, 3000)
        assert.ok(b.said.includes('the tuner was open when the adapter went; opening it again'), way)
        b.rig.tunerOn = false
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":false}' }))
        const heard = gen3TunerHeard(t)
        assert.equal(t.unit.state.tuner || t.unit.state.page, false, `${way}: the Close after the reopen left the unit on its tuner`)
        back = b.away()
        b.drop()
        back()
        await advance(t.clock, 5000)
        assert.deepEqual(gen3TunerHeard(t), heard, `${way}: a tuner the reopen’s Close had closed was closed again`)
      } finally {
        b.done()
      }
    }
    /*
     * Gone again just after the reopen's on went, before it was answered:
     * that connection owes its on, and the page the one before left open is
     * still owed with it. Both are closed by the connection after.
     */
    {
      const [, methods, open, opened] = GEN3_WAYS[1]
      const { t, b } = await gen3OnABench(methods)
      try {
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, open)
        assert.deepEqual(gen3TunerHeard(t), opened)
        let back = b.away()
        b.drop()
        back()
        for (let ms = 0; ms < 3000 && gen3TunerHeard(t).length === opened.length; ms++) await advance(t.clock, 1)
        assert.deepEqual(gen3TunerHeard(t), [...opened, 'tuner on'], 'the test did not catch the reopen’s on')
        back = b.away()
        b.drop()
        b.rig.tunerOn = false
        back()
        await advance(t.clock, 5000)
        assert.deepEqual(gen3TunerHeard(t), [...opened, 'tuner on', 'tuner off', 'page closed'], 'what the connection before the reopen left open was forgotten')
        assert.equal(t.unit.state.tuner || t.unit.state.page, false, 'the unit was left on its tuner page')
      } finally {
        b.done()
      }
    }
  })

  test('the link: another unit picked forgets a Gen 3 owed close', async () => {
    const { t, b } = await gen3OnABench({ tuner: 'push' })
    try {
      b.rig.tunerOn = true
      await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
      await advance(t.clock, 200)
      const back = b.away()
      b.drop()
      b.rig.tunerOn = false
      b.settings({ unit: 'am4' })
      b.settings({ unit: 'fm3' })
      assert.equal(b.bench.resets, 2, 'the unit change did not clear the rig')
      back()
      await advance(t.clock, 5000)
      assert.ok(b.bench.current, 'the link did not connect again')
      assert.deepEqual(gen3TunerHeard(t), ['tuner on'], 'an owed close outlived a change of unit')
    } finally {
      b.done()
    }
    /*
     * Another unit picked while Bluetooth is off, where the link hears no
     * change: an AM4 connected after is sent nothing of the FM3's owed close.
     */
    const { t: f, b: k } = await gen3OnABench({ tuner: 'push' })
    try {
      k.rig.tunerOn = true
      await drive(f.clock, k.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
      await advance(f.clock, 200)
      f.line.gone = true
      await k.link.stopBluetoothLink()
      k.rig.tunerOn = false
      await k.settings({ unit: 'am4' })
      const a = await onTheLine('am4', { unitTunerCc: 20 })
      k.bench.clock = a.clock
      k.bench.open = () => a.reconnect()
      k.link.startBluetoothLink(() => {})
      await advance(a.clock, 5000)
      assert.equal(k.bench.current?.unit, 'am4', 'the link did not connect to the AM4')
      assert.deepEqual(tunerFrames(a), [], 'the AM4 was sent the FM3’s owed close')
      assert.ok(!k.said.some((l) => l.includes('may still be on its tuner from before')), 'the AM4 was told of the FM3’s tuner')
    } finally {
      k.done()
    }
    /*
     * THE SAME, WITH AN FM9 PICKED: the link's own check that an owed close
     * goes only to a wire for the same unit. An AM4's wire refuses the
     * handed close by itself, so the half above passes without that check;
     * an FM9's would take it, be sent "tuner off" for a tuner it never
     * opened, and the FM3 stay muted when it is picked again. Here the FM9
     * is sent nothing of it, and the FM3, picked again, still has it closed.
     */
    const { t: g, b: m } = await gen3OnABench({ tuner: 'push' })
    try {
      m.rig.tunerOn = true
      await drive(g.clock, m.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
      await advance(g.clock, 200)
      assert.deepEqual(gen3TunerHeard(g), ['tuner on'])
      g.line.gone = true
      await m.link.stopBluetoothLink()
      m.rig.tunerOn = false
      await m.settings({ unit: 'fm9' })
      const nine = await onTheLine('fm9', { methods: { tuner: 'push' } })
      m.bench.clock = nine.clock
      m.bench.open = () => nine.reconnect()
      m.link.startBluetoothLink(() => {})
      await advance(nine.clock, 5000)
      assert.equal(m.bench.current?.unit, 'fm9', 'the link did not connect to the FM9')
      assert.deepEqual(gen3TunerHeard(nine, 0x12), [], 'the FM9 was sent the FM3’s owed close')
      assert.equal(m.bench.current.gen3TunerOwes(), false, 'the FM9’s wire was handed the FM3’s owed close')
      assert.equal(nine.unit.state.tuner || nine.unit.state.page, false)
      /* The FM3 picked again, with the link stopped: its connection closes what it was left on. */
      nine.line.gone = true
      await m.link.stopBluetoothLink()
      await m.settings({ unit: 'fm3' })
      g.line.gone = false
      m.bench.clock = g.clock
      m.bench.open = () => g.reconnect()
      m.link.startBluetoothLink(() => {})
      await advance(g.clock, 5000)
      assert.equal(m.bench.current?.unit, 'fm3', 'the link did not connect to the FM3 again')
      assert.deepEqual(gen3TunerHeard(g), ['tuner on', 'tuner off'], 'the FM3’s owed close was lost on the FM9’s connection')
      assert.equal(g.unit.state.tuner, false, 'the FM3 was left on its tuner, muted')
    } finally {
      m.done()
    }
  })

  /*
   * WHAT A GEN 3 WIRE SAYS IT LEFT THE UNIT ON, as it closes. A page close
   * moves the unit's screen, so it is owed only for a page whose open
   * really went: one still waiting its turn when the adapter went is not. The
   * published off is a level, so it is owed whenever the on may have gone.
   * An AM4's wire owes none of this.
   */
  test('a Gen 3 wire let go of says what its tuner left the unit on, and no more', async () => {
    const owedAfter = async (methods, press) => {
      const t = await onTheLine('fm3', { methods })
      await press(t)
      t.line.gone = true
      t.wire.close()
      return t.wire.gen3TunerOwed()
    }
    const behindARead = async (t) => {
      t.unit.opt.silent = true
      t.wire.request('/scene').catch(() => {})
      await advance(t.clock, 10)
      pressTuner(t, true).catch(() => {})
      await advance(t.clock, 10)
    }
    assert.equal(await owedAfter(undefined, async () => {}), null, 'never opened')
    assert.deepEqual(await owedAfter(undefined, (t) => t.post('/tuner', { on: true })), { push: false, page: true })
    assert.deepEqual(await owedAfter({ tuner: 'push' }, (t) => t.post('/tuner', { on: true })), { push: true, page: false })
    assert.equal(
      await owedAfter(undefined, async (t) => {
        await t.post('/tuner', { on: true })
        await t.post('/tuner', { on: false })
      }),
      null,
      'closed on the phone'
    )
    assert.equal(await owedAfter(undefined, behindARead), null, 'a page open still waiting its turn was owed a close')
    assert.deepEqual(await owedAfter({ tuner: 'push' }, behindARead), { push: true, page: false })
    const am4 = await onTheLine('am4', { unitTunerCc: 20 })
    await am4.post('/tuner', { on: true })
    am4.line.gone = true
    am4.wire.close()
    assert.equal(am4.wire.gen3TunerOwed(), null)
  })

  /*
   * LET GO OF WITH THE ADAPTER STILL THERE, AN FM3, FM9 OR AXE-FX III ON ITS
   * TUNER (review of 25 October 2026). Only the AM4's tuner was closed in its
   * turn before letting go: a Gen 3 wire's close() sends the unit nothing,
   * only notes what was left on for a later Bluetooth connection. So
   * Bluetooth off (the Settings switch, the CONNECTED popup, the demo,
   * signing out) left the unit on its tuner, muted, under a Play over the
   * computer that said closed; and another unit picked forgot even the note
   * (settingsMoved), so picking the FM3 again never closed it. The tuner can
   * be open there: the watch's Tuner opens it from any screen.
   */
  test('the link: let go of with an FM3 on its tuner and the adapter still there, the close goes on that wire first, on every way', async () => {
    const ways = [
      ['Bluetooth off', (b) => b.link.stopBluetoothLink()],
      ['Disconnect', (b) => b.link.holdBluetooth()],
      ['another unit', (b) => b.settings({ unit: 'fm9' })]
    ]
    for (const [what, letGo] of ways) {
      for (const [way, methods, open, opened, closed] of GEN3_WAYS) {
        const { t, b } = await gen3OnABench(methods)
        try {
          b.rig.tunerOn = true
          await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
          await advance(t.clock, open)
          assert.deepEqual(gen3TunerHeard(t), opened, `${what}, ${way}: the test opened the tuner wrong`)
          const old = b.bench.current
          /* What the phone's tuner does next is the rig's; another unit clears it. */
          if (what === 'another unit') b.rig.tunerOn = false
          await drive(t.clock, Promise.resolve(letGo(b)))
          await advance(t.clock, 5000)
          assert.notEqual(b.bench.current, old, `${what}, ${way}: the old wire was not let go of`)
          assert.deepEqual(gen3TunerHeard(t), [...opened, ...closed], `${what}, ${way}: the unit's tuner was not closed before letting go`)
          assert.equal(t.unit.state.tuner || t.unit.state.page, false, `${what}, ${way}: the unit was left on its tuner, muted`)
          assert.ok(b.said.includes('letting go with the FM3 on its tuner: closing it first'), `${what}, ${way}`)
        } finally {
          b.done()
        }
      }
    }
    /* With nothing of the tuner left on, it lets go at once, as it always did, and sends nothing of the tuner. */
    const { t, b } = await gen3OnABench(GEN3_WAYS[0][1])
    try {
      await drive(t.clock, Promise.resolve(b.link.holdBluetooth()))
      assert.deepEqual(gen3TunerHeard(t), [])
      assert.ok(!b.said.some((l) => /letting go with the .* on its tuner/.test(l)), 'a let-go with no tuner open waited for a close')
    } finally {
      b.done()
    }
  })

  /*
   * SETTLED ONLY BY WHAT REALLY WENT (task 161's redesign). The first try
   * settled the owed close on any answer: a reopen that went another way
   * than the connection before (pushes arriving this time, so no page asked)
   * settled it, and its Close left the page the one before had opened. Now
   * the owed close is handed to the next wire for that unit, and kept in it
   * part by part until each part's own message goes.
   */
  test('the link: a Gen 3 owed close is put down part by part, as each of its messages goes', async () => {
    const [, methods, open, opened] = GEN3_WAYS[1]
    const { t, b } = await gen3OnABench(methods)
    try {
      b.rig.tunerOn = true
      await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
      await advance(t.clock, open)
      assert.deepEqual(gen3TunerHeard(t), opened)
      let back = b.away()
      b.drop()
      b.rig.tunerOn = false
      /* The adapter takes the off, and not the page close, once. */
      let refused = 0
      t.line.refuses = (m) => sameFrame(m, t.sx.buildTunerPage(0x11, false)) && refused++ === 0
      back()
      await advance(t.clock, 5000)
      assert.equal(refused, 1, 'the page close was not tried')
      assert.deepEqual(gen3TunerHeard(t), [...opened, 'tuner off'])
      assert.equal(t.unit.state.tuner, false)
      assert.equal(t.unit.state.page, true, 'the test’s adapter took the page close')
      /* The connection after: the page close alone. The off that went is not sent again for nothing. */
      back = b.away()
      b.drop()
      back()
      await advance(t.clock, 5000)
      assert.deepEqual(gen3TunerHeard(t), [...opened, 'tuner off', 'page closed'], 'the off that went was owed again, or the page close was forgotten')
      assert.equal(t.unit.state.page, false, 'the unit was left on its tuner page')
    } finally {
      b.done()
    }
  })

  test('the link: a reopen that goes another way than the connection before still closes what that one left', async () => {
    const [, methods, open, opened] = GEN3_WAYS[1]
    const { t, b } = await gen3OnABench(methods)
    try {
      b.rig.tunerOn = true
      await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
      await advance(t.clock, open)
      assert.deepEqual(gen3TunerHeard(t), opened, 'the first connection did not open the published tuner and the page')
      const back = b.away()
      b.drop()
      back()
      /* Back with the phone's tuner open: reopened, and this time the unit sends its readings, so no page is asked for. */
      for (let ms = 0; ms < 3000 && gen3TunerHeard(t).length === opened.length; ms++) await advance(t.clock, 1)
      assert.deepEqual(gen3TunerHeard(t), [...opened, 'tuner on'], 'the reopen’s on did not go')
      /* Readings every 100 ms, as a unit sending them does, from the moment the on went. */
      for (let ms = 0; ms < 2000; ms += 100) {
        b.bench.current.heard(t.sx.frame(0x11, 0x11, [0, 1, 63]))
        await advance(t.clock, 100)
      }
      assert.deepEqual(gen3TunerHeard(t), [...opened, 'tuner on'], 'the page was asked for although the unit was sending')
      /* The phone's Close: the off for this connection's tuner, and the page the one before left open. */
      b.rig.tunerOn = false
      await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":false}' }))
      assert.deepEqual(gen3TunerHeard(t), [...opened, 'tuner on', 'tuner off', 'page closed'], 'the page the connection before opened was left open')
      assert.equal(t.unit.state.tuner || t.unit.state.page, false, 'the unit was left on its tuner')
    } finally {
      b.done()
    }
  })

  test('the link: a Tuner pressed as a Gen 3 connection comes back is never shut by the owed close', async () => {
    const [, methods, open, opened, closed] = GEN3_WAYS[1]
    /* Pressed before the rig has read everything: the link reopens rather than closes, and the unit is on its tuner. */
    {
      const { t, b } = await gen3OnABench(methods)
      try {
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, open)
        const back = b.away()
        b.drop()
        b.rig.tunerOn = false
        let release = null
        b.bench.refreshAll = () => new Promise((resolve) => (release = resolve))
        back()
        await advance(t.clock, 1500)
        assert.ok(release, 'the link never read the rig on connecting')
        b.rig.tunerOn = true
        const pressed = b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' })
        release()
        await drive(t.clock, pressed)
        await advance(t.clock, 3000)
        const after = gen3TunerHeard(t).slice(opened.length)
        assert.ok(!after.includes('tuner off') && !after.includes('page closed'), `a tuner pressed again was shut: ${after.join(', ')}`)
        assert.equal(t.unit.state.tuner, true, 'the unit is not on its tuner under a Play that shows it open')
        /* And its own Close closes everything, the connection before's included. */
        b.rig.tunerOn = false
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":false}' }))
        assert.equal(t.unit.state.tuner || t.unit.state.page, false, 'the Close left the unit on its tuner')
      } finally {
        b.done()
      }
    }
    /* Pressed the moment the owed close is asked for: the close goes first, the open after it, and the unit ends on its tuner. */
    {
      const { t, b } = await gen3OnABench(methods)
      try {
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, open)
        const back = b.away()
        b.drop()
        b.rig.tunerOn = false
        back()
        for (let ms = 0; ms < 5000 && gen3TunerHeard(t).length === opened.length; ms++) await advance(t.clock, 1)
        assert.equal(gen3TunerHeard(t)[opened.length], closed[0], 'the owed close was not the first thing sent')
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, 3000)
        assert.deepEqual(gen3TunerHeard(t).slice(opened.length, opened.length + closed.length), closed, 'the owed close was cut short')
        assert.equal(t.unit.state.tuner, true, 'the owed close shut the tuner pressed after it')
      } finally {
        b.done()
      }
    }
  })

  /*
   * THE UNIT SILENT AS THE CONNECTION COMES BACK. The link asks for the owed
   * close once, after the wake and the rig's read; a Gen 3 wire sends a unit
   * that has not answered nothing but its probe, so with both unanswered
   * the close was refused unsent, and nothing asked again once the unit did
   * answer: it stayed on its tuner, muted, under a Play that said closed
   * (task 161). Now the close refused for that goes the moment the unit
   * first answers, in its turn.
   */
  test('the link: a Gen 3 owed close refused while the unit had not answered goes the moment it does', async () => {
    for (const [way, methods, open, opened, closed] of GEN3_WAYS) {
      const { t, b } = await gen3OnABench(methods)
      try {
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, open)
        assert.deepEqual(gen3TunerHeard(t), opened, `${way}: the test opened the tuner wrong`)
        const back = b.away()
        b.drop()
        b.rig.tunerOn = false
        /* Back, with the unit silent through the wake and the rig's read: the close is asked, and refused unsent. */
        t.unit.opt.silent = true
        back()
        await advance(t.clock, 60000)
        assert.ok(b.said.includes('the phone’s tuner is closed but the FM3 may still be on its tuner from before; closing it now'), `${way}: the link did not ask for the owed close`)
        assert.deepEqual(gen3TunerHeard(t), opened, `${way}: something of the tuner went to a unit that had not answered`)
        assert.equal(b.bench.current.gen3TunerOwes(), true, `${way}: the owed close was put down unsent`)
        /* It answers (a pull-down's read, say): the owed close goes, and only that. */
        t.unit.opt.silent = false
        assert.equal((await drive(t.clock, b.bench.current.request('/device/detect'))).connected, true)
        await advance(t.clock, 3000)
        assert.deepEqual(gen3TunerHeard(t), [...opened, ...closed], `${way}: the owed close never went once the unit answered`)
        assert.equal(b.bench.current.gen3TunerOwes(), false, `${way}: still owed after it went`)
        assert.equal(t.unit.state.tuner || t.unit.state.page, false, `${way}: the unit stayed on its tuner, muted, under a Play that said closed`)
        /* Sent once: more answers send nothing more of the tuner. */
        await drive(t.clock, b.bench.current.request('/device/detect'))
        await advance(t.clock, 3000)
        assert.deepEqual(gen3TunerHeard(t), [...opened, ...closed], `${way}: the close went twice`)
      } finally {
        b.done()
      }
    }
    /* A Tuner pressed straight after the first answer goes after the close, and the unit ends on its tuner. */
    {
      const [, methods, open, opened, closed] = GEN3_WAYS[2]
      const { t, b } = await gen3OnABench(methods)
      try {
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, open)
        const back = b.away()
        b.drop()
        b.rig.tunerOn = false
        t.unit.opt.silent = true
        back()
        await advance(t.clock, 60000)
        t.unit.opt.silent = false
        const asked = b.bench.current.request('/device/detect')
        await drive(t.clock, asked)
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, 3000)
        assert.deepEqual(gen3TunerHeard(t), [...opened, ...closed, ...opened], 'the Tuner pressed after the first answer was shut, or went before the close')
        assert.equal(t.unit.state.page, true, 'the unit is not on its tuner under a Play that shows it open')
      } finally {
        b.done()
      }
    }
    /*
     * With the phone's tuner still open as it comes back, the link asks for
     * it to be opened again, and a unit that has not answered is sent
     * nothing: the wire's tuner stays closed, so no reading would ever come
     * (review of 25 October 2026). Play's tuner stayed up over a needle that
     * never moved until the player tapped Close. Now the phone's tuner goes
     * down, as a press refused the same way does (rig writeTuner), and its
     * close is held for the unit's first answer, which closes what the
     * connection before left on it, and only that. An open refused unsent is
     * still never sent late.
     */
    for (const [way, methods, open, opened, closed] of GEN3_WAYS) {
      const { t, b } = await gen3OnABench(methods)
      try {
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, open)
        const back = b.away()
        b.drop()
        t.unit.opt.silent = true
        back()
        await advance(t.clock, 60000)
        assert.ok(b.said.includes('the tuner was open when the adapter went; opening it again'), way)
        assert.equal(b.rig.tunerOn, false, `${way}: Play's tuner stayed up over a unit that will never send it a reading`)
        assert.deepEqual(b.bench.tunerWrites, [false], `${way}: the phone's tuner was not put down through the rig, once`)
        assert.deepEqual(gen3TunerHeard(t), opened, `${way}: something of the tuner went to a unit that had not answered`)
        assert.equal(b.bench.current.gen3TunerOwes(), true, `${way}: the close of what the connection before left was not held`)
        t.unit.opt.silent = false
        await drive(t.clock, b.bench.current.request('/device/detect'))
        await advance(t.clock, 3000)
        assert.deepEqual(gen3TunerHeard(t), [...opened, ...closed], `${way}: the first answer did not close what the connection before left, or opened it late`)
        assert.equal(t.unit.state.tuner || t.unit.state.page, false, `${way}: the unit stayed on its tuner under a Play that says closed`)
      } finally {
        b.done()
      }
    }
  })

  /*
   * AND THE RIG'S TIMED CHECK SENDS IT, with no pull-down (review of 25
   * October 2026). The close held for the first answer went only on an
   * answer, and before one only the probe goes: the rig's watch reads the
   * preset (unit-watch probeUnit, GET /preset), which was held unsent and
   * answered "no preset", so the watch never saw the unit answering and the
   * unit stayed on its tuner, muted, until the player pulled down on Play.
   * Now that read asks the probe first while a close is held for it.
   */
  test('the link: a Gen 3 close held for the first answer goes on the rig’s timed check of the preset, with no pull-down', async () => {
    for (const [way, methods, open, opened, closed] of GEN3_WAYS) {
      const { t, b } = await gen3OnABench(methods)
      try {
        b.rig.tunerOn = true
        await drive(t.clock, b.bench.current.request('/tuner', { method: 'POST', body: '{"on":true}' }))
        await advance(t.clock, open)
        const back = b.away()
        b.drop()
        b.rig.tunerOn = false
        t.unit.opt.silent = true
        back()
        await advance(t.clock, 60000)
        assert.equal(b.bench.current.gen3TunerOwes(), true, `${way}: the test did not leave the close held`)
        /* Still silent: the timed check's read sends the probe, and nothing of the tuner. */
        const quiet = await drive(t.clock, b.bench.current.request('/preset'))
        assert.equal(quiet.number, -1, `${way}: a unit that never answered was read`)
        assert.deepEqual(gen3TunerHeard(t), opened, `${way}: something of the tuner went to a unit that had not answered`)
        /* It wakes, and the next timed check closes the tuner, then reads the preset. */
        t.unit.opt.silent = false
        const read = await drive(t.clock, b.bench.current.request('/preset'))
        await advance(t.clock, 3000)
        assert.deepEqual(gen3TunerHeard(t), [...opened, ...closed], `${way}: the held close waited for a pull-down`)
        assert.equal(b.bench.current.gen3TunerOwes(), false, `${way}: still owed after it went`)
        assert.equal(t.unit.state.tuner || t.unit.state.page, false, `${way}: the unit stayed on its tuner, muted, under a Play that said closed`)
        assert.ok(Number.isInteger(read.number) && read.number >= 0, `${way}: the timed check did not read the preset once the unit answered`)
        /* Answered, the read is a read: no more probes go ahead of it. */
        const sent = t.frames().length
        await drive(t.clock, b.bench.current.request('/preset'))
        assert.deepEqual(t.frames().slice(sent).map(hex), [hex(t.sx.buildGetPreset(0x11))], `${way}: a read after the first answer still sent the probe`)
      } finally {
        b.done()
      }
    }
  })

  test('a Gen 3 wire handed what the connection before left keeps it until it is closed, and hands it back if it goes first; an AM4’s is handed nothing', async () => {
    const t = await onTheLine('fm3')
    assert.equal(t.wire.gen3TunerOwes(), false)
    t.wire.oweGen3Tuner({ push: false, page: true })
    assert.equal(t.wire.gen3TunerOwes(), true)
    t.line.gone = true
    t.wire.close()
    assert.deepEqual(t.wire.gen3TunerOwed(), { push: false, page: true }, 'what it was handed was lost with the wire')
    /*
     * Its own open does not touch it, and leaves the page alone on the
     * published way: the unit sends its readings, so no page is asked for,
     * and the page the connection before left is still owed. Its Close
     * closes both, its own off and that page.
     */
    const p = await onTheLine('fm3', { methods: { tuner: 'push' } })
    p.wire.oweGen3Tuner({ push: false, page: true })
    assert.deepEqual(await p.post('/tuner', { on: true }), { ok: true })
    for (let ms = 0; ms < 2000; ms += 100) {
      p.wire.heard(p.sx.frame(0x11, 0x11, [0, 1, 63]))
      await advance(p.clock, 100)
    }
    assert.deepEqual(gen3TunerHeard(p), ['tuner on'], 'its own open asked for, or closed, the page the connection before left')
    assert.equal(p.wire.gen3TunerOwes(), true, 'its own open settled what the connection before left')
    assert.deepEqual(await p.post('/tuner', { on: false }), { ok: true })
    assert.deepEqual(gen3TunerHeard(p), ['tuner on', 'tuner off', 'page closed'], 'the Close left the page the connection before opened')
    assert.equal(p.wire.gen3TunerOwes(), false)
    const u = await onTheLine('fm3')
    u.wire.oweGen3Tuner({ push: true, page: false })
    assert.deepEqual(await u.post('/tuner', { on: false }), { ok: true })
    assert.deepEqual(gen3TunerHeard(u), ['tuner off'], 'more, or less, than what was owed was closed')
    assert.equal(u.wire.gen3TunerOwes(), false)
    u.line.gone = true
    u.wire.close()
    assert.equal(u.wire.gen3TunerOwed(), null, 'a close that went is owed again')
    const am4 = await onTheLine('am4', { unitTunerCc: 20 })
    am4.wire.oweGen3Tuner({ push: true, page: true })
    assert.equal(am4.wire.gen3TunerOwes(), false, 'an AM4 took a Gen 3 unit’s owed close')
  })

  test('letting go of the AM4 with its own tuner open closes it, and never into a stored preset coming back', async () => {
    /* Let go of without its turn (the link closes it in its turn first when it can): the 0 goes straight out as the connection closes. */
    const u = await onTheLine('am4', { unitTunerCc: 20 })
    await u.post('/tuner', { on: true })
    await advance(u.clock, 500)
    u.wire.close()
    assert.equal(hex(u.frames().at(-1)), 'B0 14 00')
    assert.equal(u.unit.state.tunerOpen, false)
    assert.ok(u.logs.includes('the AM4’s own tuner closed as the connection closes: sent'))
    /* Closed on the phone and let go of at once, the 0 still waiting behind a reading: it goes as the connection closes. */
    const quick = await onTheLine('am4', { unitTunerCc: 20, delay: 300 })
    await quick.post('/tuner', { on: true })
    await advance(quick.clock, 50)
    const closing = quick.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: false }) })
    await advance(quick.clock, 5)
    assert.notEqual(hex(quick.frames().at(-1)), 'B0 14 00', 'the test let go after the 0 had already gone')
    quick.wire.close()
    await drive(quick.clock, closing).catch(() => {})
    await advance(quick.clock, 1000)
    assert.equal(hex(quick.frames().at(-1)), 'B0 14 00')
    assert.equal(quick.unit.state.tunerOpen, false, 'closed and let go of at once, the AM4 was left on its tuner')
    /* With NONE set there is nothing to close. */
    const none = await onTheLine('am4')
    await none.post('/tuner', { on: true })
    await advance(none.clock, 500)
    none.wire.close()
    assert.ok(none.frames().every((f) => f[0] === 0xf0), 'a CC went out to an AM4 with no Tuner number')

    /* The reads and the CC wait for a stored preset coming back, and are never sent into it. */
    const t = await onTheLine('am4', { unitTunerCc: 20 })
    const names = t.wire.request('/presets/5/scenes')
    await advance(t.clock, 20)
    const on = t.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: true }) })
    await drive(t.clock, names)
    assert.deepEqual(await drive(t.clock, on), { ok: true, unitTuner: 'opened' })
    assert.equal(t.unit.state.tunerOpen, true)
    assert.deepEqual(t.unit.state.heardWhileSending.map(hex), [], 'the AM4 was sent something while it was sending a preset')
    await t.post('/tuner', { on: false })
    assert.equal(t.unit.state.tunerOpen, false)
    /* And a preset asked for while the channel is being read goes first: the 127 waits behind it, not into it. */
    const w = await onTheLine('am4', { unitTunerCc: 20, delay: 60 })
    const opening = w.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: true }) })
    await advance(w.clock, 90)
    assert.deepEqual(w.frames().map(hex), [READ_TUNER_CC, READ_CHANNEL], 'the test asked for the preset at the wrong moment')
    const coming = w.wire.request('/presets/5/scenes')
    await drive(w.clock, coming)
    await drive(w.clock, opening)
    assert.deepEqual(besidesReadings(w).slice(0, 4), [READ_TUNER_CC, READ_CHANNEL, hex(w.sx.buildAm4StoredDump(5)), 'B0 14 7F'])
    assert.deepEqual(w.unit.state.heardWhileSending.map(hex), [], 'the 127 was sent into a preset coming back')
    assert.equal(w.unit.state.tunerOpen, true)
    await w.post('/tuner', { on: false })

    /* Let go of mid-preset with the tuner open: the 0 is held back, and the AM4 left for its own footswitch. */
    const v = await onTheLine('am4', { unitTunerCc: 20 })
    await v.post('/tuner', { on: true })
    await advance(v.clock, 300)
    v.wire.request('/presets/6/scenes').catch(() => {})
    await advance(v.clock, 1200)
    assert.ok(v.unit.state.dumped.includes(6), 'the test let go before the preset was asked for')
    const mark = v.sent.length
    assert.deepEqual(v.wire.close(), { unitTunerOwed: true }, 'the 0 held back was not owed to the next connection')
    assert.equal(v.sent.length, mark, 'the 0 was sent into a preset coming back')
    await advance(v.clock, 6000)
    assert.deepEqual(v.unit.state.heardWhileSending.map(hex), [])
    assert.equal(v.unit.state.tunerOpen, true)
    assert.equal(v.unit.state.frozen, false)

    /*
     * A stored preset given up on part-way, the AM4 still sending the rest of
     * it: nothing is waiting on it any more, but the line is held until it
     * has finished, and the 0 is held with it.
     */
    const g = await onTheLine('am4', { unitTunerCc: 20, stallAfterHead: 4000 })
    await g.post('/tuner', { on: true })
    await advance(g.clock, 300)
    assert.equal(g.unit.state.tunerOpen, true)
    await assert.rejects(drive(g.clock, g.wire.request('/presets/5/scenes')), (e) => e.status === 504, 'a stalled preset was read')
    assert.ok(g.logs.includes('gave up on the scene names of B02 part-way; Refresh names asks again'), 'the test did not give up part-way')
    assert.ok(g.clock.now() < g.unit.state.sendingUntil, 'the test let go after the AM4 had finished sending')
    const held = g.sent.length
    assert.deepEqual(g.wire.close(), { unitTunerOwed: true })
    assert.equal(g.sent.length, held, 'the 0 was sent to an AM4 still sending a preset given up on')
    await advance(g.clock, 8000)
    assert.deepEqual(g.unit.state.heardWhileSending.map(hex), [], 'something was sent to the AM4 while it was still sending')
    assert.equal(g.unit.state.tunerOpen, true)
    assert.equal(g.unit.state.frozen, false)

    /*
     * Back from a drop on a slow link, the phone's close reads first, and its
     * 0 waits behind another read; let go of before it goes, the 0 goes
     * straight out as the connection closes.
     */
    const s = await onTheLine('am4', { unitTunerCc: 20, delay: 300 })
    await s.post('/tuner', { on: true })
    await advance(s.clock, 500)
    s.line.gone = true
    s.wire.close()
    s.line.gone = false
    s.reconnect()
    const off = s.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: false }) })
    const sentNow = () => s.frames().map(hex)
    for (let i = 0; i < 2000 && sentNow().at(-1) !== READ_CHANNEL; i++) await advance(s.clock, 1)
    assert.equal(sentNow().at(-1), READ_CHANNEL, 'the close never read the channel')
    const tempo = s.wire.request('/tempo').catch(() => null)
    const read = hex(s.sx.buildAm4TempoRead())
    for (let i = 0; i < 2000 && sentNow().at(-1) !== read; i++) await advance(s.clock, 1)
    assert.equal(sentNow().at(-1), read, 'the tempo read did not go ahead of the 0')
    await advance(s.clock, 5)
    assert.equal(sentNow().at(-1), read, 'the 0 did not wait behind the read')
    assert.equal(s.unit.state.tunerOpen, true)
    assert.deepEqual(s.wire.close(), { unitTunerOwed: false })
    assert.equal(sentNow().at(-1), 'B0 14 00')
    assert.equal(s.unit.state.tunerOpen, false, 'let go of with its 0 waiting, the AM4 was left on its tuner')
    await drive(s.clock, off)
    await drive(s.clock, tempo)
    await advance(s.clock, 1000)
    assert.equal(sentNow().at(-1), 'B0 14 00', 'something was sent after the wire was let go of')
    assert.equal(s.unit.state.frozen, false)
  })

  test('the AM4’s Tuner setting is read at every open, so a number changed on the unit in between is the one sent', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20 })
    await t.post('/tuner', { on: true })
    await advance(t.clock, 300)
    await t.post('/tuner', { on: false })
    /* Changed on the AM4's own screen: 20 now means nothing to it, and would freeze the pretend one. */
    t.unit.state.tunerCc = 30
    t.unit.state.midiChannel = 2
    await t.post('/tuner', { on: true })
    await advance(t.clock, 300)
    assert.equal(t.unit.state.tunerOpen, true, 'the new number was not read')
    await t.post('/tuner', { on: false })
    assert.deepEqual(besidesReadings(t), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 7F', READ_TUNER_CC, READ_CHANNEL, 'B0 14 00', READ_TUNER_CC, READ_CHANNEL, 'B1 1E 7F', READ_TUNER_CC, READ_CHANNEL, 'B1 1E 00'])
    /* And NONE set in between: nothing at the next open, and the answer says so. */
    t.unit.state.tunerCc = 'none'
    const mark = t.sent.length
    assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'none' })
    await t.post('/tuner', { on: false })
    assert.deepEqual(besidesReadings(t, mark), [READ_TUNER_CC])
    assert.equal(t.unit.state.tunerOpen, false)
    assert.equal(t.unit.state.frozen, false, `the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
  })

  /*
   * THE CLOSE'S RE-READ, WHOLE. The player may change the Tuner setting with
   * the tuner up, and give its old number to something else: Output Volume,
   * say, where a 0 is silence on stage. So a close reads the setting again
   * before its 0, number then channel, and the 0 goes only where the AM4
   * says its tuner is now:
   *
   *   - the same number: on it, on the channel the AM4 names now;
   *   - another number the tuner may be sent: that is the AM4's own Tuner
   *     number now, so there, on the channel it names now: 'closed';
   *   - NONE, out of range, bank select: nowhere, and what was open is
   *     forgotten, not owed even as the connection closes: 'none' or
   *     'unknown';
   *   - silent, or no number at all: on the number and channel remembered
   *     from the open.
   *
   * A channel read that is silent, or not plain channel words, keeps the
   * channel remembered from the open. The computer's half (forgefx) holds
   * the same table, case for case.
   */
  test('a close reads the Tuner setting again, whole, and its 0 goes only where the AM4 says its tuner is now', async () => {
    /* Opened on CC 20, channel 3: B2 14 7F. A message the pretend AM4 does not expect freezes it, so a 0 on a number it no longer names would show. */
    for (const [change, sent, says, why] of [
      [() => {}, [READ_TUNER_CC, READ_CHANNEL, 'B2 14 00'], 'closed', 'still CC 20, channel 3'],
      [(u) => (u.state.midiChannel = 5), [READ_TUNER_CC, READ_CHANNEL, 'B4 14 00'], 'closed', 'still CC 20, on channel 5 now'],
      [(u) => (u.state.midiChannel = 'OMNI'), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'], 'closed', 'still CC 20, on OMNI now'],
      [(u) => (u.opt.unitChannelAnswer = 'silent'), [READ_TUNER_CC, READ_CHANNEL, 'B2 14 00'], 'closed', 'still CC 20, the channel silent'],
      [(u) => (u.opt.unitChannelAnswer = { whole: 1, float: 1, text: 'Tuner 2' }), [READ_TUNER_CC, READ_CHANNEL, 'B2 14 00'], 'closed', 'still CC 20, the channel not plain words'],
      [(u) => (u.state.tunerCc = 30), [READ_TUNER_CC, READ_CHANNEL, 'B2 1E 00'], 'closed', 'CC 30 now'],
      [
        (u) => {
          u.state.tunerCc = 30
          u.state.midiChannel = 2
        },
        [READ_TUNER_CC, READ_CHANNEL, 'B1 1E 00'],
        'closed',
        'CC 30 on channel 2 now'
      ],
      [
        (u) => {
          u.state.tunerCc = 30
          u.opt.unitChannelAnswer = 'silent'
        },
        [READ_TUNER_CC, READ_CHANNEL, 'B2 1E 00'],
        'closed',
        'CC 30 now, the channel silent'
      ],
      [(u) => (u.opt.unitTunerAnswer = 'silent'), [READ_TUNER_CC, 'B2 14 00'], 'closed', 'no answer'],
      [(u) => (u.opt.unitTunerAnswer = { whole: 0, float: 0, text: '25' }), [READ_TUNER_CC, 'B2 14 00'], 'closed', 'bare digits nothing else says'],
      [(u) => (u.opt.unitTunerAnswer = { whole: 128, float: 0, text: 'PEDAL 1' }), [READ_TUNER_CC, 'B2 14 00'], 'closed', '128 with other words'],
      [(u) => (u.state.tunerCc = 'none'), [READ_TUNER_CC], 'none', 'NONE now'],
      [(u) => (u.state.tunerCc = 120), [READ_TUNER_CC], 'unknown', 'a number out of range now'],
      [(u) => (u.state.tunerCc = 0), [READ_TUNER_CC], 'unknown', 'bank select now'],
      [(u) => (u.state.tunerCc = 32), [READ_TUNER_CC], 'unknown', 'bank select’s second half now']
    ]) {
      const t = await onTheLine('am4', { unitTunerCc: 20, unitChannel: 3 })
      assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'opened' }, why)
      assert.deepEqual(besidesReadings(t), [READ_TUNER_CC, READ_CHANNEL, 'B2 14 7F'], why)
      await advance(t.clock, 300)
      change(t.unit)
      const mark = t.sent.length
      assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true, unitTuner: says }, why)
      assert.deepEqual(besidesReadings(t, mark), sent, why)
      const shut = says === 'closed'
      /* Not closed, it is left on its tuner for its own footswitch: no 0 goes on a number it does not name. */
      assert.equal(t.unit.state.tunerOpen, !shut, `${why}: the AM4’s tuner is ${t.unit.state.tunerOpen ? 'open' : 'closed'}`)
      if (!shut) assert.ok(t.logs.some((l) => /^the AM4’s Tuner setting reads “.*” now, not CC 20: no 0 goes out on CC 20, which may do something else on the AM4 now$/.test(l)), why)
      if (why.startsWith('CC 30')) assert.ok(t.logs.includes('the AM4’s Tuner setting reads “CC #30” now, not CC 20: its 0 goes on CC 30, the AM4’s own Tuner number now, and none on CC 20'), why)
      /* Settled either way: let go of now, the connection sends nothing more and owes nothing. */
      assert.deepEqual(t.wire.close(), { unitTunerOwed: false }, why)
      assert.deepEqual(besidesReadings(t, mark), sent, `${why}: a 0 went out as the connection closed`)
      assert.equal(t.unit.state.frozen, false, `${why}: the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
    }

    /* Let go of while that read is still out, the 0 goes on the number remembered as the connection closes. */
    const q = await onTheLine('am4', { unitTunerCc: 20, delay: 300 })
    await q.post('/tuner', { on: true })
    await advance(q.clock, 1000)
    const closing = q.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: false }) })
    for (let i = 0; i < 2000 && hex(q.frames().at(-1)) !== READ_TUNER_CC; i++) await advance(q.clock, 1)
    assert.equal(hex(q.frames().at(-1)), READ_TUNER_CC, 'the close did not read the setting again')
    assert.deepEqual(q.wire.close(), { unitTunerOwed: false })
    assert.equal(hex(q.frames().at(-1)), 'B0 14 00')
    assert.equal(q.unit.state.tunerOpen, false)
    await drive(q.clock, closing).catch(() => {})

    /* And let go of once it has named another number, its channel still being read: the 0 goes on the number it named. */
    const m = await onTheLine('am4', { unitTunerCc: 20, delay: 300 })
    await m.post('/tuner', { on: true })
    await advance(m.clock, 1000)
    m.unit.state.tunerCc = 30
    const moving = m.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: false }) })
    for (let i = 0; i < 4000 && hex(m.frames().at(-1)) !== READ_CHANNEL; i++) await advance(m.clock, 1)
    assert.equal(hex(m.frames().at(-1)), READ_CHANNEL, 'the close did not read the channel')
    assert.deepEqual(m.wire.close(), { unitTunerOwed: false })
    assert.equal(hex(m.frames().at(-1)), 'B0 1E 00', 'let go of mid-read, the 0 went on the number the AM4 no longer names')
    assert.equal(m.unit.state.tunerOpen, false)
    assert.equal(m.unit.state.frozen, false, `the AM4 froze on ${m.unit.state.unknown.map(hex).join(', ')}`)
    await drive(m.clock, moving).catch(() => {})
  })

  /*
   * THE CHANNEL KNOWN. A re-open whose channel read is silent, or not plain
   * channel words ("n", "CH n", "Channel n", OMNI), keeps the channel this
   * connection already knows: falling back to 1 would send the CC where an
   * AM4 on channel 3 does not listen, and its tuner would not open. Only a
   * connection that knows no channel takes the factory 1.
   */
  test('a re-open whose channel read says nothing plain keeps the channel this connection knows', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20, unitChannel: 3 })
    await t.post('/tuner', { on: true })
    await advance(t.clock, 300)
    await t.post('/tuner', { on: false })
    assert.deepEqual(besidesReadings(t), [READ_TUNER_CC, READ_CHANNEL, 'B2 14 7F', READ_TUNER_CC, READ_CHANNEL, 'B2 14 00'])
    for (const [answer, why] of [
      ['silent', 'no answer'],
      [{ whole: 1, float: 1, text: 'Tuner 2' }, 'other words around it'],
      [{ whole: 16, float: 16, text: '17' }, 'no such channel'],
      [{ whole: 0, float: 0, text: 'CH 0' }, 'no such channel'],
      [{ whole: 2, float: 2, text: '' }, 'no words']
    ]) {
      t.unit.opt.unitChannelAnswer = answer
      const mark = t.sent.length
      assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'opened' }, why)
      assert.equal(t.unit.state.tunerOpen, true, `${why}: the CC went to a channel the AM4 is not on`)
      await advance(t.clock, 300)
      await t.post('/tuner', { on: false })
      assert.deepEqual(besidesReadings(t, mark), [READ_TUNER_CC, READ_CHANNEL, 'B2 14 7F', READ_TUNER_CC, READ_CHANNEL, 'B2 14 00'], why)
    }
    /* Plain words move it: channel 5, then OMNI, which hears every channel, as the factory 1. */
    delete t.unit.opt.unitChannelAnswer
    for (const [ch, cc] of [
      [5, 'B4 14'],
      ['OMNI', 'B0 14']
    ]) {
      t.unit.state.midiChannel = ch
      const mark = t.sent.length
      await t.post('/tuner', { on: true })
      await advance(t.clock, 300)
      await t.post('/tuner', { on: false })
      assert.deepEqual(besidesReadings(t, mark), [READ_TUNER_CC, READ_CHANNEL, `${cc} 7F`, READ_TUNER_CC, READ_CHANNEL, `${cc} 00`], String(ch))
    }
    assert.equal(t.unit.state.tunerOpen, false)
    assert.equal(t.unit.state.frozen, false, `the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)

    /* A connection that knows none: the AM4's factory 1. */
    const fresh = await onTheLine('am4', { unitTunerCc: 20, unitChannel: 1, unitChannelAnswer: 'silent' })
    assert.deepEqual(await fresh.post('/tuner', { on: true }), { ok: true, unitTuner: 'opened' })
    await fresh.post('/tuner', { on: false })
    assert.deepEqual(besidesReadings(fresh), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 7F', READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'])
    assert.equal(fresh.unit.state.frozen, false)
  })

  /*
   * THE VERDICT PUT BACK. One silent read at a re-open turns the open
   * against asking again on this connection, but a close with a 127 still
   * owing its 0 always reads, and a number it confirms puts the verdict
   * back: one silent answer does not shut the AM4's own tuner out for the
   * rest of the connection. On the phone a re-open with a 0 still owed
   * follows a close whose 0 did not get out (the adapter would not take it
   * for a moment); the computer's re-open is a second open while it is up.
   */
  test('a close that confirms the Tuner number puts the verdict back after one silent read at a re-open', async () => {
    const t = await onTheLine('am4', { unitTunerCc: 20 })
    assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'opened' })
    await advance(t.clock, 300)
    /* The close's 0 does not get out: still owed. */
    t.line.refuses = (b) => b[0] !== 0xf0
    assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true, unitTuner: 'unknown' })
    t.line.refuses = null
    assert.equal(t.unit.state.tunerOpen, true, 'the test’s 0 got out')
    /* The re-open, the AM4 silent about its Tuner setting: nothing sent, and an open would not ask again. */
    t.unit.opt.unitTunerAnswer = 'silent'
    let mark = t.sent.length
    assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'unknown' })
    await advance(t.clock, 300)
    assert.deepEqual(besidesReadings(t, mark), [READ_TUNER_CC])
    /* The clean close: read again, whatever the verdict, the number confirmed, the 0 on it. */
    delete t.unit.opt.unitTunerAnswer
    mark = t.sent.length
    assert.deepEqual(await t.post('/tuner', { on: false }), { ok: true, unitTuner: 'closed' })
    assert.deepEqual(besidesReadings(t, mark), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 00'])
    assert.equal(t.unit.state.tunerOpen, false)
    /* And the next open asks, and sends its 127. */
    mark = t.sent.length
    assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'opened' })
    assert.deepEqual(besidesReadings(t, mark), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 7F'])
    assert.equal(t.unit.state.tunerOpen, true)
    await t.post('/tuner', { on: false })
    assert.equal(t.unit.state.tunerOpen, false)
    assert.equal(t.unit.state.frozen, false, `the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
  })

  /*
   * THE 127'S OWN SETTLE. The open counts its 127 as owing a 0 from before it
   * goes, not once its 40 ms have passed: let go of in between, the 0 still
   * goes as the connection closes (or is owed, with the adapter gone).
   */
  test('let go of while its 127 is still settling, the AM4’s own tuner is closed as the connection closes', async () => {
    const { WAIT } = await import(WIRE)
    for (const gone of [false, true]) {
      const t = await onTheLine('am4', { unitTunerCc: 20 })
      const opening = t.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: true }) })
      for (let i = 0; i < 2000 && hex(t.frames().at(-1) ?? []) !== 'B0 14 7F'; i++) await advance(t.clock, 1)
      assert.equal(hex(t.frames().at(-1)), 'B0 14 7F', 'the 127 never went')
      assert.ok(t.clock.now() - t.sent.at(-1).at < WAIT.am4Settle, 'the test let go after the 127 had settled')
      assert.equal(t.unit.state.tunerOpen, true)
      t.line.gone = gone
      if (gone) {
        assert.deepEqual(t.wire.close(), { unitTunerOwed: true }, 'let go of with the adapter gone, the 0 was not owed')
      } else {
        assert.deepEqual(t.wire.close(), { unitTunerOwed: false })
        assert.equal(hex(t.frames().at(-1)), 'B0 14 00', 'let go of in the 127’s settle, the AM4 was left on its tuner')
        assert.equal(t.unit.state.tunerOpen, false)
      }
      await drive(t.clock, opening).catch(() => {})
    }
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
    /* An AM4 with a Tuner number set, so its one short message is driven too. */
    const t = await onTheLine('am4', { usbEcho: true, unitTunerCc: 20, unitChannel: 3 })
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
    /* The amp's Out Boost, both ways, and every body it refuses with nothing sent. */
    for (const body of [{ value: 1, continuous: false }, { value: 0, continuous: false }, { value: 2, continuous: false }, { value: 1, continuous: true }, { value: 0.5, continuous: false }, {}]) {
      await tryIt('/preset/blocks/58/params/150', 'PUT', body)
    }
    await tryIt('/preset/blocks/59/params/150', 'PUT', { value: 1, continuous: false })
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
    /* Short messages: only the tuner's CC, on the number and channel the AM4 reported, and both ways. */
    const reported = { cc: t.unit.state.tunerCc, channel: t.unit.state.midiChannel }
    const shorts = frames.filter((f) => f[0] !== 0xf0)
    for (const f of shorts) assert.ok(t.sx.am4ShortAllowed(f, reported), `a short message went to the AM4: ${hex(f)}`)
    assert.deepEqual([...new Set(shorts.map((f) => t.sx.am4ShortAllowed(f, reported)))].sort(), ['tuner off', 'tuner on'], 'the tuner’s CC was not driven both ways')
    assert.equal(t.unit.state.tunerOpen, false, 'the safety test left the AM4 on its tuner')
    for (const f of frames.filter((x) => x[0] === 0xf0)) {
      assert.ok(t.sx.isAllowedAm4(f), `off the allowlist: ${hex(f)}`)
      assert.ok(![0x1f, 0x00].includes(f[5]), `function ${f[5].toString(16)} went to the AM4: ${hex(f)}`)
      /* fn 0x03 only as a stored preset, never the active buffer. */
      if (f[5] === 0x03) assert.equal(t.sx.am4Allowed(f).name, 'stored preset dump', `function 3 went to the AM4: ${hex(f)}`)
    }
    assert.equal(t.unit.state.frozen, false, `the AM4 froze on ${t.unit.state.unknown.map(hex).join(', ')}`)
    /* Every kind of frame on the list was actually exercised, so the rule is about something. */
    const seen = new Set(frames.filter((f) => f[0] === 0xf0).map((f) => t.sx.am4Allowed(f).name))
    for (const entry of t.sx.AM4_ALLOWED) assert.ok(seen.has(entry.name), `the safety test never sent a ${entry.name}`)
  })

  /*
   * ON AN AM4 THE AMP'S PEDAL IS ITS BOOST (1.87.49, shared/am4-boost.mjs).
   * Over Bluetooth the phone sends it itself: the codec's own frame for the
   * amp's Out Boost, at the amp's code, 0 or 1, and nothing else. It is never
   * read, because the AM4's answer to that read has never been seen.
   */
  test('over Bluetooth the AM4’s amp boost is written as its own frame, 0 or 1 only, and never read', async () => {
    const t = await onTheLine('am4')
    const put = (path, body) => drive(t.clock, t.wire.request(path, { method: 'PUT', body: JSON.stringify(body) }))
    await put('/preset/blocks/58/params/150', { value: 1, continuous: false })
    assert.equal(t.unit.state.boost, 1, 'the AM4’s boost did not go on')
    assert.deepEqual(t.frames().map(hex), [hex(H('F0 00 01 74 15 01 3A 00 16 01 01 00 00 00 04 00 00 00 10 03 78 52 F7'))], 'not exactly the codec’s Boost on')
    assert.equal(t.unit.state.bypass.get(0x3a), false, 'the amp was turned off')
    await put('/preset/blocks/58/params/150', { value: 0, continuous: false })
    assert.equal(t.unit.state.boost, 0)
    assert.equal(hex(t.frames().at(-1)), hex(H('F0 00 01 74 15 01 3A 00 16 01 01 00 00 00 04 00 00 00 00 00 00 39 F7')))
    /* Anything but a whole 0 or 1, on the discrete path, at the amp's own code and its boost: refused, with nothing sent. */
    const before = t.frames().length
    for (const [path, body] of [
      ['/preset/blocks/58/params/150', { value: 2, continuous: false }],
      ['/preset/blocks/58/params/150', { value: 1, continuous: true }],
      ['/preset/blocks/58/params/150', { value: 0.5, continuous: false }],
      ['/preset/blocks/58/params/150', {}],
      ['/preset/blocks/59/params/150', { value: 1, continuous: false }],
      ['/preset/blocks/58/params/8', { value: 1, continuous: false }]
    ]) {
      await assert.rejects(put(path, body), (e) => e.status === 400 || e.status === 501, `${path} ${JSON.stringify(body)} was not refused`)
    }
    assert.equal(t.frames().length, before, 'a write the AM4 has never been sent went out')
    /* And never read: the route stays refused here. */
    await assert.rejects(t.get('/preset/blocks/58/params'), (e) => e.status === 501)
    assert.equal(t.frames().length, before)
    assert.equal(t.unit.state.frozen, false)
    /* A gen-3 unit over Bluetooth has no such route at all. */
    const fm3 = await onTheLine('fm3')
    await assert.rejects(drive(fm3.clock, fm3.wire.request('/preset/blocks/58/params/150', { method: 'PUT', body: JSON.stringify({ value: 1, continuous: false }) })), (e) => e.status === 501)
    assert.equal(fm3.frames().length, 0)
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
    /* The gear file's words (presetMissLine) are plain data with no imports of their own. */
    assert.deepEqual(imports(read('bleWire.js')).sort(), ['./am4-edit.js', './bleVp4.js', './bluetooth-gear.js', './chain-outline.js', './fm3-edit.js', './fractal-sysex.mjs'])
    /* Edit's knobs: the codec and the catalogs the computer's codec writes (scripts/am4-knobs.mjs, scripts/fm3-knobs.mjs), and nothing that sends. */
    assert.deepEqual(imports(read('am4-edit.js')).sort(), ['./am4-knobs.js', './fractal-sysex.mjs'])
    assert.deepEqual(imports(read('am4-knobs.js')), [], 'the AM4 catalog imports something')
    assert.deepEqual(imports(read('fm3-edit.js')).sort(), ['./fm3-knobs.js', './fractal-sysex.mjs'])
    assert.deepEqual(imports(read('fm3-knobs.js')), [], 'the FM3 catalog imports something')
    assert.deepEqual(imports(read('bluetooth-gear.js')), [], 'the gear file imports something')
    /* The VP4's wire: the codec's helpers and the VP4 rules both ends keep, and nothing that sends (never bleWire, which hands it the unit). */
    assert.deepEqual(imports(read('bleVp4.js')).sort(), ['./fractal-sysex.mjs', './vp4-safety.js'])
    assert.deepEqual(imports(read('vp4-safety.js')), [], 'the VP4 rules import something')
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
    for (const f of ['bleSwitch.js', 'tapGate.js', 'relay-rules.js', 'firmware.js', 'param-fixes.js', 'grid-plan.js', 'unit.mjs', 'slots.js', 'presetName.js', 'encoding.js', 'scale.js', 'metronome-rules.js', 'device-word.js', 'unsupported.js', 'vp4-safety.js', 'device.js', 'bleVp4.js', 'fractal-sysex.mjs']) {
      files[f] = esm(lib(f))
    }
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
    const at = (f) => pathToFileURL(join(dir, f)).href
    const device = await import(at('device.js'))
    const sw = await import(at('bleSwitch.js'))
    const relay = await import(at('relay.js'))
    const gate = await import(at('tapGate.js'))
    const vp4wire = await import(at('bleVp4.js'))
    return { device, sw, relay, gate, vp4wire, done: () => rmSync(dir, { recursive: true, force: true }) }
  }

  /*
   * A VP4 OVER BLUETOOTH, THROUGH DEVICE.JS, as Play reaches it: device.js
   * takes it for a VP4 (isVp4 of its check), and every VP4 rule holds as over
   * the computer. The player's Scene Select number and channel go with each
   * scene and preset, a scene with no number is not sent, knobs and a save
   * are refused before the wire, a stored preset's name is unknown (A1..Z4),
   * and every refusal is said in the VP4's own words. And the VP4 is sent a
   * Program Change and its Scene Select, and not one byte more.
   */
  test('a VP4 over Bluetooth, through device.js: its own numbers on every preset and scene, every other request refused in its own words, and nothing sent but the two', async () => {
    const { device, sw, relay, vp4wire, done } = await deviceOnABench()
    try {
      const got = []
      const wire = vp4wire.createVp4Wire({ send: (b) => (got.push([...b]), true) })
      const kept = new Map()
      const storage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)), removeItem: (k) => kept.delete(k) }
      device.keepVp4SetupIn(storage)
      sw.setSwitch({ on: true, wire })
      const unit = await device.detect()
      assert.equal(device.vp4Here(), true, 'a VP4 over Bluetooth is not taken for a VP4')
      assert.equal(unit.capabilities.hasChannels, false, 'a VP4’s screens offer channels over Bluetooth')
      assert.deepEqual(device.vp4Capabilities().plainMidi, { programChange: true, sceneSelect: true })

      /* Not set up: presets go on channel 1, a scene says how to set up the number, and nothing goes for it. */
      await device.selectPreset(4)
      assert.deepEqual(got, [[0xc0, 4]])
      const vp4 = await import('../shared/vp4-safety.mjs')
      await assert.rejects(device.setScene(1), (e) => e.message === vp4.VP4_SCENES_NOT_SET_UP)
      assert.deepEqual(got, [[0xc0, 4]], 'a scene with no number was sent')

      /* Set up on the VP4 and saved in the app: Scene Select 34 on channel 3. */
      assert.equal(vp4.saveVp4Setup(storage, undefined, { sceneCc: 34, midiChannel: 3 }).ok, true)
      await device.selectPreset(103)
      await device.setScene(3)
      assert.deepEqual(got.slice(1), [[0xc2, 103], [0xb2, 34, 3]])

      /* Everything else, refused before anything is sent, in a VP4's words. */
      await assert.rejects(device.blockParams(58), (e) => e.message === vp4.VP4_NO_KNOBS)
      await assert.rejects(device.setTuner(true), (e) => e.message === vp4.VP4_NO_TUNER)
      await assert.rejects(device.setTempo(120), (e) => e.message === vp4.VP4_NO_TEMPO)
      await assert.rejects(device.currentPreset(), (e) => e.message === vp4.VP4_NO_WHICH_PRESET && e.quiet === true)
      assert.equal((await device.presetName(7))?.name ?? null, null, 'a VP4 stored preset’s name is not left unknown')
      assert.deepEqual(await device.presetBlocks(), [], 'the chain of a VP4 over Bluetooth is not empty')
      assert.deepEqual(got.slice(3), [], 'a refused request sent the VP4 something')
      for (const m of got) assert.ok(vp4wire.vp4BleAllowed(m), `the VP4 was sent ${m}`)
      assert.deepEqual(relay.asked, [], 'a request went to the computer while Bluetooth was on')

      /* Off again, and the computer's unit is not a VP4: its requests go as they always did. */
      sw.setSwitch({ on: false, wire: null })
      await device.detect()
      assert.equal(device.vp4Here(), false)
      await device.setScene(2)
      assert.deepEqual(relay.asked.at(-1), 'POST /scene')
    } finally {
      done()
    }
  })

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

  /*
   * A TAP THAT CANNOT GO IS SAID AS ONE, WHICHEVER WAY IT WAS GOING. "A scene
   * tap that can't get through is dropped" (Justin, 13 October 2026). With
   * the link down, device.js refuses a tap before the wire or the computer
   * is asked; over Bluetooth, the adapter away and a wire still busy at the
   * deadline are both told in the words every dropped tap is said in. A read,
   * and anything else with no deadline, is answered as it always was.
   */
  test('a tap while the link is down goes nowhere, and Bluetooth’s refusals of a tap are said as dropped taps', async () => {
    const { device, sw, relay, gate, done } = await deviceOnABench()
    try {
      const deadline = Date.now() + 1500
      gate.setLinkDown(true)
      await assert.rejects(device.setScene(2, { deadline }), (e) => e.notSent === true && e.message === 'Not sent — not connected')
      await assert.rejects(device.setBypass(58, true, { deadline }), (e) => e.notSent === true)
      await assert.rejects(device.selectPreset(20, { deadline }), (e) => e.notSent === true)
      assert.deepEqual(relay.asked, [], 'a tap went to the computer while the link was down')
      /* Not a tap: a read, and a write with no deadline, go as they went. */
      await device.currentPreset()
      await device.setTuner(false)
      assert.deepEqual(relay.asked, ['GET /preset', 'POST /tuner'])
      gate.setLinkDown(false)

      /* Bluetooth on, the adapter not there yet: a tap is "not sent", a read is the adapter's own words. */
      sw.setSwitch({ on: true })
      await assert.rejects(device.setScene(2, { deadline }), (e) => e.notSent === true && e.message === 'Not sent — not connected')
      await assert.rejects(device.currentPreset(), (e) => e.status === 503 && e.bluetooth === true && !e.notSent)

      /* Connected, and the wire still busy at the tap's deadline: dropped, in the late words. */
      const late = Object.assign(new Error('Not sent in time.'), { status: 504, bluetooth: true, late: true })
      sw.setSwitch({ on: true, wire: { request: async () => Promise.reject(late) } })
      await assert.rejects(device.setScene(2, { deadline }), (e) => e.notSent === true && e.message === 'Not sent — it would have landed late')
      /* Any other refusal from the wire is said as it was. */
      const refused = Object.assign(new Error('The unit refused it: busy.'), { status: 502, bluetooth: true })
      sw.setSwitch({ on: true, wire: { request: async () => Promise.reject(refused) } })
      await assert.rejects(device.setScene(2, { deadline }), (e) => e === refused)
      /* And the deadline reaches the wire with the request, the body as it always was. */
      const heard = []
      sw.setSwitch({ on: true, wire: { request: async (path, options) => (heard.push([path, options]), { ok: true }) } })
      await device.setScene(3, { deadline })
      assert.deepEqual(heard, [['/scene', { method: 'POST', body: JSON.stringify({ index: 3 }), deadline }]])
      sw.setSwitch({ on: false })
    } finally {
      done()
    }
  })

  test('over Bluetooth a tap still waiting behind another exchange at its deadline is never sent', async () => {
    /* A gen-3 read the unit does not answer holds the line for its whole wait (1.5 s for the loaded preset). */
    const t = await onTheLine('fm3')
    t.unit.opt.silent = true
    const read = t.wire.request('/preset')
    read.catch(() => {})
    await advance(t.clock, 10)
    const busy = t.sent.length
    assert.equal(busy, 1, 'the read did not go')
    let readOver = false
    read.then(
      () => (readOver = true),
      () => (readOver = true)
    )
    const body = JSON.stringify({ bypassed: true })
    let dropped = null
    t.wire.request('/preset/blocks/58/bypass', { method: 'POST', body, deadline: t.clock.now() + 500 }).catch((e) => (dropped = e))
    /*
     * Said AT the deadline, with the read still holding the line — not when
     * the line frees. Behind an AM4 sending a stored preset that is up to
     * twenty seconds on, and all that time the tile stayed lit for a tap that
     * was never going to go.
     */
    await advance(t.clock, 510)
    assert.equal(readOver, false, 'the read was over by the deadline, so this does not test a tap still waiting')
    assert.equal(dropped?.late, true, `a tap behind a read was dropped only when the line freed, not at its deadline: ${dropped?.message}`)
    await advance(t.clock, 3000)
    assert.equal(t.sent.length, busy, 'a tap went out after its deadline, behind the read')
    /* With room before its deadline, it goes once the read is done, as before. */
    const t2 = await onTheLine('fm3')
    t2.unit.opt.silent = true
    t2.wire.request('/preset').catch(() => {})
    await advance(t2.clock, 10)
    t2.unit.opt.silent = false
    const going = t2.wire.request('/preset/blocks/58/bypass', { method: 'POST', body, deadline: t2.clock.now() + 2500 })
    going.catch(() => {})
    await advance(t2.clock, 3000)
    assert.equal(t2.sent.length, 2, 'a tap with time left was dropped')
    /* And one with no deadline waits as long as it takes, as everything did. */
    const t3 = await onTheLine('fm3')
    t3.unit.opt.silent = true
    t3.wire.request('/preset').catch(() => {})
    await advance(t3.clock, 10)
    t3.unit.opt.silent = false
    t3.wire.request('/preset/blocks/58/bypass', { method: 'POST', body }).catch(() => {})
    await advance(t3.clock, 3000)
    assert.equal(t3.sent.length, 2)
  })

  /*
   * AND NOT SENT WHEN THE LINE FREES ON THE VERY INSTANT OF ITS DEADLINE. The
   * read ahead of it gives up at the same moment the tap's own time runs out,
   * and the read's timer was set first, so it goes first: the line is free
   * and pump() is choosing what goes next before the tap's own timer has had
   * its turn. pump() asks the clock itself; a tap whose deadline has come is
   * not started, however it came to be first in line.
   */
  test('over Bluetooth a tap whose turn comes on the instant of its deadline is not sent', async () => {
    const { WAIT } = await import(WIRE)
    const t = await onTheLine('fm3')
    t.unit.opt.silent = true
    t.wire.request('/preset').catch(() => {})
    await advance(t.clock, 10)
    assert.equal(t.sent.length, 1, 'the read did not go')
    /* The read gives up WAIT.preset after it went; the tap's deadline is that same instant. */
    const freesAt = t.sent[0].at + WAIT.preset
    let dropped = null
    let went = false
    t.wire
      .request('/preset/blocks/58/bypass', { method: 'POST', body: JSON.stringify({ bypassed: true }), deadline: freesAt })
      .then(() => (went = true), (e) => (dropped = e))
    await advance(t.clock, freesAt - t.clock.now() - 1)
    assert.equal(dropped, null, 'the tap was dropped before its deadline, with a millisecond still to go')
    await advance(t.clock, 3000)
    assert.equal(went, false, 'a tap whose deadline had come was reported as sent')
    assert.equal(dropped?.late, true, `not dropped as late: ${dropped?.message}`)
    assert.equal(t.sent.length, 1, `a tap went on the wire at its deadline, the instant the line freed (at ${t.sent[1]?.at - freesAt} ms)`)
  })

  /*
   * THE AM4'S TUNER OPENING IS A TAP TOO. Its 127 mutes the unit, and the
   * open waits its turn behind a close (am4TunerInTurn) and reads two of the
   * AM4's settings before the 127 goes, all after request() has let go of
   * the deadline. Held to it by name: a 127 that went out late would mute
   * the rig a while after the press, perhaps after the tuner was shut again.
   */
  test('over Bluetooth the AM4’s tuner opening is dropped at its deadline, behind a read or behind a close, and the phone’s tuner with it', async () => {
    const tunerOn = (t, deadline) => t.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: true }), deadline })
    /* Behind a read the AM4 does not answer: nothing of the open goes out, and it is said as a dropped tap. */
    {
      const t = await onTheLine('am4', { unitTunerCc: 20 })
      t.unit.opt.silent = true
      t.wire.request('/preset').catch(() => {})
      await advance(t.clock, 10)
      const busy = t.sent.length
      assert.equal(busy, 1, 'the read did not go')
      let dropped = null
      let opened = null
      tunerOn(t, t.clock.now() + 500).then((v) => (opened = v), (e) => (dropped = e))
      await advance(t.clock, 3000)
      t.unit.opt.silent = false
      await advance(t.clock, 3000)
      assert.equal(opened, null, `a tuner open behind a read went ahead past its deadline: ${JSON.stringify(opened)}`)
      assert.equal(dropped?.late, true, `not dropped as late: ${dropped?.message}`)
      assert.equal(t.sent.length, busy, 'something of the tuner opening went out after its deadline')
      assert.ok(!t.frames().some((f) => f[0] === 0xb0), 'the AM4’s tuner CC went out after the deadline')
      assert.equal(t.unit.state.tunerOpen, false, 'the AM4 was put on its tuner after the deadline')
      assert.ok(!readingsOf(t).length, 'the phone’s tuner opened on an open that was dropped')
      /* Dropped, not broken: the next open, with time to spare, goes as it always did. */
      assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'opened' })
      assert.equal(t.unit.state.tunerOpen, true)
      await t.post('/tuner', { on: false })
      assert.equal(t.unit.state.tunerOpen, false)
    }
    /* Behind a close that takes longer than the deadline: its turn comes late, and nothing is sent for it. */
    {
      const t = await onTheLine('am4', { unitTunerCc: 20 })
      assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true, unitTuner: 'opened' })
      /* The close reads the setting again; the AM4 slow to say it. */
      t.unit.opt.silent = true
      const closing = t.wire.request('/tuner', { method: 'POST', body: JSON.stringify({ on: false }) })
      closing.catch(() => {})
      await advance(t.clock, 0)
      let dropped = null
      tunerOn(t, t.clock.now() + 500).catch((e) => (dropped = e))
      await advance(t.clock, 600)
      t.unit.opt.silent = false
      const mark = t.sent.length
      await advance(t.clock, 5000)
      assert.equal(dropped?.late, true, `an open whose turn came past its deadline was not dropped: ${dropped?.message}`)
      assert.ok(!t.frames().slice(mark).some((f) => hex(f).endsWith('7F')), 'a 127 went out for an open dropped behind the close')
      assert.equal(t.unit.state.tunerOpen, false, 'the AM4 was left on its tuner by an open dropped behind its close')
    }
    /* With time to spare, an open with a deadline goes exactly as one without. */
    {
      const t = await onTheLine('am4', { unitTunerCc: 20 })
      const going = tunerOn(t, t.clock.now() + 1500)
      assert.deepEqual(await drive(t.clock, going), { ok: true, unitTuner: 'opened' })
      assert.deepEqual(besidesReadings(t), [READ_TUNER_CC, READ_CHANNEL, 'B0 14 7F'])
    }
  })

  /*
   * A WRITE BEING LEARNED IS LET THROUGH LATE, ONCE, ON PURPOSE (see tapUntil
   * in bleWire). Its second way comes after a read-back, and on a unit that
   * does not answer the published way that read waits out the hold for a
   * late answer: past the deadline every time. Held to it, the way would
   * never be learned and every tap of its kind would be dropped. Only its
   * first exchange is held; once learned, the tap is one bound write.
   */
  test('over Bluetooth a write being learned finishes once, late, and is learned; its first exchange and every tap after it keep the deadline', async () => {
    const body = JSON.stringify({ index: 2 })
    const get = (t) => hex(t.sx.buildGetScene(0x11))
    const t = await onTheLine('fm3', { sceneEcho: false, publishedScene: false })
    const t0 = t.clock.now()
    const going = t.wire.request('/scene', { method: 'POST', body, deadline: t0 + 1500 })
    assert.deepEqual(await drive(t.clock, going), { ok: true })
    assert.deepEqual(t.frames().map(hex), [get(t), hex(t.sx.buildSetScene(0x11, 2)), get(t), hex(t.sx.buildSetSceneEdit(0x11, 2)), get(t)])
    /* This is the case the comment names: FM3-Edit's way went after the deadline, and was learned. */
    assert.ok(t.sent[3].at > t0 + 1500, 'the bench no longer shows the trial running past the deadline; the comment in bleWire is out of date')
    assert.equal(t.unit.state.scene, 2)
    assert.equal(t.remembered.at(-1).learned.scene, 'edit')
    /* Learned: the next tap is one write, and held to its deadline behind a read like any other. */
    t.unit.opt.silent = true
    t.wire.request('/preset').catch(() => {})
    await advance(t.clock, 10)
    const busy = t.sent.length
    let dropped = null
    t.wire.request('/scene', { method: 'POST', body: JSON.stringify({ index: 4 }), deadline: t.clock.now() + 500 }).catch((e) => (dropped = e))
    await advance(t.clock, 3000)
    assert.equal(dropped?.late, true, `a learned scene behind a read was not dropped: ${dropped?.message}`)
    assert.equal(t.sent.length, busy)
    /* And a trial's first exchange, its read of where the unit is, keeps the deadline too. */
    const u = await onTheLine('fm3', { sceneEcho: false, publishedScene: false })
    u.unit.opt.silent = true
    u.wire.request('/preset').catch(() => {})
    await advance(u.clock, 10)
    const held = u.sent.length
    let first = null
    u.wire.request('/scene', { method: 'POST', body, deadline: u.clock.now() + 500 }).catch((e) => (first = e))
    await advance(u.clock, 3000)
    u.unit.opt.silent = false
    await advance(u.clock, 3000)
    assert.equal(first?.late, true, `a trial behind a read was not dropped at its deadline: ${first?.message}`)
    assert.equal(u.sent.length, held, 'a trial went out behind a read past its deadline')
  })

  test('device.js asks the switch one line under the demo, and before the memo of refusals', () => {
    const device = flat('mobile/src/lib/device.js')
    assert.match(device, /import \{ bluetoothWire \} from '\.\/bleSwitch'/)
    assert.match(
      device,
      /* With one line between them since 13 October 2026: a tap while the link is down goes nowhere, Bluetooth or not. */
      /*
       * And a VP4 over Bluetooth asked the VP4's way first (vp4Instead, as over the computer), its refusals in the VP4's words
       * (said): every other unit's wire exactly as before, since onVp4 is false for them.
       */
      /const demo = demoDevice\(\) if \(demo\) return demoRequest\(demo, path, options\) if \(options\?\.deadline && linkIsDown\(\)\) return Promise\.reject\(notSentError\(\)\) const ble = bluetoothWire\(\) if \(ble\) \{ \/\*[^*]*(?:\*(?!\/)[^*]*)*\*\/ const method = options\?\.method \|\| 'GET' const vp4 = onVp4 && vp4Instead\(method, path, options\) if \(vp4\) return vp4 return ble\.request\(path, options\)\.catch\(\(err\) => Promise\.reject\(said\(method, path, tapOverBle\(options, err\)\)\)\) \} \/\* What this unit has already refused/,
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
    assert.match(flat('mobile/src/lib/bleLink.js'), /if \(!mayConnectBluetooth\(bluetoothAdmin\(\)\)\) \{/, 'Bluetooth connects for somebody who has not paid, or with the store merely out of reach')
    assert.match(flat('mobile/src/lib/purchases.js'), /export const mayConnectBluetooth = \(admin = false\) => mayDriveBluetooth\(state, admin\)/, 'the link’s check over Bluetooth is not the purchase rule the row and the page use')
    assert.match(flat('mobile/src/lib/purchases.js'), /export const usePurchase = \(\) => useSyncExternalStore\(subscribe, purchaseState, purchaseState\)/)
    assert.match(flat('mobile/src/lib/purchases.js'), /export const subscribePurchase = subscribe\b/, 'the link waits on the purchase through something other than the watch the screens keep')
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
    /* Over Bluetooth, Edit only where its knobs are built and open to this account (ble-rule editOffered, through bluetooth.js). */
    assert.match(
      app,
      /BENCH && \(demo \|\| link\.link === 'connected'\) && \(!overBluetooth\(caps\) \|\| editOverBluetooth\(\)\) \? \(\) => setScreen\('edit'\) : null/,
      'Edit opens over Bluetooth where it is not built or not open'
    )
    assert.match(app, /<WrongAccount active=\{[^}]*&& !bluetooth\}/, 'the stage warns about a computer on another account while on Bluetooth')
    /* The waiting screen, over Bluetooth, is about the adapter. */
    const waking = app.slice(app.indexOf('function Waking('))
    assert.match(waking, /const bluetooth = useBluetoothOn\(\) const trouble = useBluetoothTrouble\(\)/)
    /*
     * Said for the device in hand (lib/device-word deviceNoun), not "the
     * phone": changed on purpose on 25 October 2026, when Bluetooth was to
     * reach customers, and with them iPads and Android tablets.
     */
    assert.match(waking, /`Check the \$\{deviceNoun\(\)\}’s Bluetooth is on, that the adapter is plugged into the unit’s MIDI In and Out and lit, and that nothing else is connected to it\.`/)
    /* What the phone knows is in the way is said instead of the plugs. */
    assert.match(waking, /trouble === 'bluetooth-off' \? `Bluetooth is off on this \$\{deviceNoun\(\)\}\. Turn it on in the \$\{deviceNoun\(\)\}’s settings\.`/)
    assert.match(waking, /trouble === 'permission' \? `\$\{ALLOW_WORDS\}\.`/, 'the waiting screen words the permission its own way')
    /*
     * On an iPhone whose adapter has gone, Look again opens Apple's screen
     * first (lib/bluetooth lookForAdapterAgain), then the link's own poke,
     * and says so under itself whenever it will (test 'Reconnect' holds the
     * words).
     */
    assert.match(waking, /<Press label="Look for the adapter again" sub=\{opensApplesScreen\(\) \? APPLE_SCREEN_OPENS : undefined\} onPress=\{\(\) => lookForAdapterAgain\(onRetry\)\} \/>/)
    /*
     * And the way back to the computer is there from the first second, not
     * four taps away behind the gear: "How do I get out of Bluetooth mode so
     * I can go back to connecting to computer?" Before the fifteen-second
     * block, so it never waits for it.
     */
    assert.match(waking, /\{bluetooth \? \( <View style=\{\{ alignSelf: 'stretch' \}\}> <Press label="Use the computer instead" onPress=\{\(\) => setBluetooth\(false\)\} \/>/, 'the Bluetooth waiting screen has no way back to the computer')
    assert.ok(waking.indexOf('Use the computer instead') < waking.indexOf("{long && link.link !== 'connected' ? ("), 'the way back to the computer waits fifteen seconds')
    assert.match(app, /import \{ ALLOW_WORDS, APPLE_SCREEN_OPENS, RESTRICTED_WORDS, allowBluetooth, editOverBluetooth, lookForAdapterAgain, opensApplesScreen, restoreBluetooth, setBluetooth, useBluetoothOn, useBluetoothTrouble \} from '\.\/src\/lib\/bluetooth' import \{ useBluetoothOffered \} from '\.\/src\/lib\/useBluetoothOffered'/)
    assert.match(waking, /\{bluetooth && onBluetooth \? <Press label="Bluetooth" onPress=\{onBluetooth\} \/> : null\}/, 'the waiting screen does not lead to the adapter’s page')
    /* Handed only through the Settings row's own gate: test 'every way onto the Bluetooth page' holds it. */
    assert.match(app, /onBluetooth=\{bluetoothOffered \? \(\) => openSettings\('bluetooth'\) : null\}/)
    assert.match(waking, /\{email && link\.link !== 'connected' && !bluetooth && !noneSaid \? \(/, 'the waiting screen names the computer’s account over Bluetooth')
  })

  test('Settings offers Bluetooth only where it is open (his account on every copy, a customer’s only on a copy built to open it), unlocked, on a device and build that can do it', () => {
    /*
     * The unlock and the build check, and since 11 October 2026 the account
     * as well: "Is there any way to just get the Bluetooth on the developers
     * mode for my own phone? I just feel like it's not ready to have
     * public." This held the row to the unlock and the build check alone
     * while every paying customer had it; changed on purpose, so the row and
     * the page both wait for bluetoothAllowed too, asked before the build
     * check so a customer's phone is not even asked whether it can do
     * Bluetooth. Its own row on Settings still: "Move the Bluetooth card
     * from the phone and computer menu to its own menu under the settings
     * menu. Still saying Bluetooth."
     *
     * And since 25 October 2026 bluetoothAllowed is yes for a customer too,
     * on a copy whose built-in store version opens it (lib/ble-rule.js, which
     * no copy today does): the expressions here did not change, only what
     * lib/bluetooth answers. Retitled on purpose; the next test holds the
     * answer.
     */
    const settings = src('mobile/src/screens/Settings.js')
    const one = settings.replace(/\s+/g, ' ')
    assert.match(one, /\{mayDriveBluetooth\(purchase, bluetoothAdmin\) && bluetoothAllowed && bluetoothSupported\(\) \? \( <SetupRow title="Bluetooth"/, 'the row is not behind the unlock, the developer’s account and the build check')
    assert.match(one, /title="Bluetooth"[\s\S]{0,300}onPress=\{\(\) => setPage\('bluetooth'\)\}/, 'the row opens nothing')
    /* The page itself, through the same gate. It is told whether this is Justin's account (from the server) only for its Testing tools (Apple's 2.2), never to let anybody in. */
    assert.match(one, /\{page === 'bluetooth' && mayDriveBluetooth\(purchase, bluetoothAdmin\) && bluetoothAllowed && bluetoothSupported\(\) \? \( <> \{head\('Bluetooth', 'back'\)\} <BluetoothPage purchase=\{purchase\} admin=\{isAdmin\(account\?\.id\)\} onReport=\{onReportBluetooth\} onOpen=\{setPage\} onConnected=\{onBack\} \/>/)
    /*
     * The account's answer comes from lib/bluetooth, which App.js tells from
     * the session kept on the phone, redrawn when it changes, so the row
     * comes and goes with signing in. Never from `account`, which asks the
     * server: with no signal at a gig it answers nobody, and the row, the
     * page and its Stop button would vanish with Bluetooth still on.
     */
    assert.match(one, /import \{ APPLE_SCREEN_OPENS, bluetoothSupported, lookForAdapterAgain, opensApplesScreen, useBluetoothAdmin, useBluetoothAllowed, useBluetoothOn \} from '\.\.\/lib\/bluetooth'/)
    assert.match(one, /const bluetoothAllowed = useBluetoothAllowed\(\)/)
    assert.ok(!/bluetoothAllowed = [^\n;]*account/.test(code('mobile/src/screens/Settings.js')), 'the row asks the account server whose phone this is')
    /* Every way onto the row and the page goes through that gate: no other mention of either. */
    assert.equal((settings.match(/title="Bluetooth"/g) || []).length, 1, 'a second Bluetooth row skips the gate')
    assert.equal((settings.match(/label="BLUETOOTH \(BETA\)"/g) || []).length, 0, 'the old card is still on Phone & computer')
    assert.equal((settings.match(/<BluetoothPage /g) || []).length, 1, 'a second way onto the page skips the gate')
    assert.doesNotMatch(one, /bluetooth: 'link'/, 'back from the page goes to Phone & computer, not Settings')
    /* On the front list, after Phone & computer and before the metronome. */
    const front = settings.slice(settings.indexOf('{page === null ? ('), settings.indexOf("{page === 'account' ? ("))
    const row = front.indexOf('title="Bluetooth"')
    assert.ok(row > front.indexOf('title="Phone & computer"') && row < front.indexOf('title="Metronome"'), 'the row is not on the Settings list beside Phone & computer')
    /* Phone & computer, which the Live pill opens, has one button to the page (26 October 2026), behind the row's gate as one name. */
    const link = settings.slice(settings.indexOf("{page === 'link' ? ("), settings.indexOf("{page === 'bluetooth'"))
    assert.equal((link.match(/setPage\('bluetooth'\)/g) || []).length, 1, 'Phone & computer opens Bluetooth from more than one button')
    assert.match(link.replace(/\s+/g, ' '), /\{bluetoothOffered && !demo \? \( <Press/, 'Phone & computer’s Bluetooth button skips the gate')
    /* After the link page and before the metronome: outside every slice the other tests take. */
    const at = settings.indexOf("{page === 'bluetooth'")
    assert.ok(at > settings.indexOf("{page === 'link' ? (") && at < settings.indexOf("{page === 'metronome' ? ("), 'the page moved into a slice another test reads')
    /*
     * Said for the device in hand, and with the two ways to connect, the
     * computer the best one (BLUETOOTH_WAYS): changed on purpose on 25
     * October 2026 from "This phone talks to the unit directly".
     */
    assert.match(one, /\{`Bluetooth is on\. This \$\{deviceNoun\(\)\} talks to the unit directly, not through the computer\. \$\{BLUETOOTH_WAYS\}`\}/, 'Phone & computer does not say Bluetooth is on, or that the computer is the best way')
    /*
     * The row's own line: on, the device in hand; off, what it is for and
     * what it costs against the computer, in the gear file's words, in one
     * line (BLUETOOTH_ROW_OFF). Changed on purpose on 25 October 2026 from
     * the cost alone, which read as a row with nothing going for it.
     */
    assert.match(one, /status=\{bluetooth \? `On · the \$\{deviceNoun\(\)\} talks to the unit itself` : BLUETOOTH_ROW_OFF\}/, 'the Settings row does not say what Bluetooth is for and what it costs')
    assert.match(one, /import \{ BLUETOOTH_ROW_OFF, BLUETOOTH_WAYS \} from '\.\.\/lib\/bluetooth-gear'/)
    /* The looper row stays away: the looper is left off the chain over Bluetooth. */
    assert.match(one, /\{\(link === 'connected' \|\| demo\) && !overBluetooth\(caps\) && !onRealVp4 \? \( <SetupRow title="Stop the looper"/)
  })

  test('Bluetooth is Justin’s account’s on every copy and a customer’s only by the store copy, asked of the session on the phone, at launch and at every change of who is signed in', async () => {
    /*
     * "Is there any way to just get the Bluetooth on the developers mode for
     * my own phone? I just feel like it's not ready to have public." (11
     * October 2026.)
     *
     * This test said the opposite until then: "open to everybody who has
     * unlocked the app: no list of accounts decides it", and it banned
     * allowBluetooth and useBluetoothAllowed by name, because the tester list
     * they once served was gone. Changed on purpose, not to get it to pass:
     * the shape is back, with the list replaced by the one account that
     * already opens the Developer pages (isAdmin, shared/admin.mjs). The
     * tester list itself stays gone.
     */
    for (const gone of ['shared/bluetooth-testers.mjs', 'mobile/src/lib/bluetooth-testers.js']) {
      assert.equal(existsSync(new URL(`../${gone}`, import.meta.url)), false, `${gone} is back`)
    }
    const { state } = await import('../scripts/sync-relay-rules.mjs')
    assert.ok(!state().some((f) => /bluetooth-testers/.test(f.source + f.target)), 'the sync makes the phone a copy of a tester list again')

    /*
     * One rule, in lib/bluetooth: his account, by id, through the Developer
     * pages' own check, and for anybody else the store copy (ble-rule.js
     * bluetoothOpen, by the version built into it). This pinned
     * `allowed = accountId(id) ? isAdmin(id) : null`; changed on purpose on
     * 25 October 2026, when Bluetooth was to reach customers in the next
     * store version and only there. Nobody known is still not a no.
     */
    const lib = code('mobile/src/lib/bluetooth.js').replace(/\s+/g, ' ')
    assert.match(lib, /import \{ isAdmin \} from '\.\/admin'/)
    assert.match(lib, /import \{ accountId \} from '\.\/owner-unlock'/)
    assert.match(lib, /import \{ installedStoreVersion \} from '\.\/storeVersion'/)
    assert.match(lib, /import \{ bluetoothOpen, editOffered, unitOffered \} from '\.\/ble-rule'/)
    assert.match(
      lib,
      /export function allowBluetooth\(id, \{ signedOut = false \} = \{\}\) \{ const was = allowed const wasAll = allUnits allowed = accountId\(id\) \? bluetoothOpen\(\{ platform: Platform\.OS, installed: builtInVersion\(\), admin: isAdmin\(id\) \}\) : null/,
      'whose phone this is is decided some other way than his account’s id and the store copy, or nobody known is taken for a no'
    )
    /* The rule is never handed a threshold by the app: only the tests try one. */
    assert.ok(!/bluetoothOpen\(\{[^}]*\bfrom\b/.test(lib), 'lib/bluetooth hands the rule a threshold of its own')
    assert.ok(!/relay|currentAccount|getUser/.test(lib), 'lib/bluetooth asks the account server whose phone this is, which answers nobody with no signal')

    /* Nothing in the app, or shared with it, asks a list of testers, and only App.js tells lib/bluetooth whose phone it is. */
    const files = [fileURLToPath(new URL('../mobile/App.js', import.meta.url))]
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(jsx?|mjs)$/.test(entry)) files.push(full)
      }
    }
    walk(fileURLToPath(new URL('../mobile/src/', import.meta.url)))
    walk(fileURLToPath(new URL('../shared/', import.meta.url)))
    const tellers = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      const name = file.replaceAll('\\', '/').split(/\/(?=mobile\/|shared\/)/).pop()
      assert.ok(!/bluetooth-testers|BLUETOOTH_TESTERS|mayUseBluetooth/.test(text), `${name} still asks a tester list about Bluetooth`)
      if (/allowBluetooth\(/.test(text.replace(/\/\*[\s\S]*?\*\//g, ' ')) && !name.endsWith('lib/bluetooth.js')) tellers.push(name)
    }
    assert.deepEqual(tellers, ['mobile/App.js'], 'something other than App.js decides whose phone this is')

    /*
     * App.js: AT LAUNCH, before the door opens, so the link never starts on
     * Bluetooth for a customer; and AT EVERY CHANGE of who is signed in, with
     * signed out as nobody, at once. Both from haveSession(), the session kept
     * on the phone — never currentAccount(), which asks the server.
     */
    const app = code('mobile/App.js').replace(/\s+/g, ' ')
    assert.match(
      app,
      /restoreDemo\(\) \.then\(\(on\) => \(on \? true : haveSession\(\)\)\) \.then\(\(id\) => \{ if \(!alive\) return if \(id !== true\) allowBluetooth\(id\) setAuth\(id \? 'in' : 'out'\) \}\)/,
      'the launch lets the app in before saying whose phone it is, so a customer’s phone left on Bluetooth reaches for the adapter'
    )
    assert.match(
      app,
      /useEffect\(\(\) => \{ if \(auth === 'checking'\) return undefined if \(auth === 'out'\) \{ allowBluetooth\(null\) return undefined \} let alive = true haveSession\(\) \.then\(\(id\) => alive && allowBluetooth\(id\)\) \.catch\(\(\) => \{\}\) return \(\) => \{ alive = false \} \}, \[auth, demo\]\)/,
      'signing in, signing out, another account or the demo ending does not ask again whose phone this is'
    )
    /*
     * NOBODY IS NOT A NO. The effect above hands over whatever the session
     * says, and no session is not his saying no (one that ran out with no
     * signal to renew it answers with his id now), so that off is held in
     * memory only. The
     * sign-outs somebody asked for say so, and write the off down: Sign out
     * (which Delete account in Settings goes through), the paywall's back,
     * Try the Demo and Delete account, and the way to the sign-in form.
     */
    const SIGNED_OUT = 'allowBluetooth\\(null, \\{ signedOut: true \\}\\)'
    assert.match(app, new RegExp(`const toSignIn = \\(\\) => \\{ setBuying\\(false\\) setScreen\\('stage'\\) setDemo\\(false\\) ${SIGNED_OUT} setAuth\\('out'\\) \\}`), 'the way to the sign-in form does not write Bluetooth’s off down')
    assert.match(app, new RegExp(`await stopLink\\(\\) await signOut\\(\\) unlinkAccount\\(\\)\\.catch\\(\\(\\) => \\{\\}\\) ${SIGNED_OUT} setScreen\\('stage'\\) setAuth\\('out'\\)`), 'Sign out in Settings does not write Bluetooth’s off down')
    const UNLINK = 'unlinkAccount\\(\\)\\.catch\\(\\(\\) => \\{\\}\\)'
    assert.match(app, new RegExp(`setDemo\\(true\\) signOut\\(\\)\\.catch\\(\\(\\) => \\{\\}\\) ${UNLINK} ${SIGNED_OUT} setAuth\\('in'\\) \\}\\} onBack=\\{\\(\\) => \\{ signOut\\(\\)\\.catch\\(\\(\\) => \\{\\}\\) ${UNLINK} ${SIGNED_OUT} setAuth\\('out'\\) \\}\\} onDeleted=\\{\\(\\) => \\{ signOut\\(\\)\\.catch\\(\\(\\) => \\{\\}\\) ${UNLINK} ${SIGNED_OUT} setAuth\\('out'\\) \\}\\}`), 'the paywall’s sign-outs do not write Bluetooth’s off down, or leave the store on the account just left')
    /* Delete account in Settings signs out through the same onSignOut. */
    assert.match(flat('mobile/src/screens/Settings.js'), /await deleteAccount\(\) setDeleting\(false\) Alert\.alert\([^)]*\) onSignOut\?\.\(\)/)
    assert.equal((app.match(/allowBluetooth\(null, \{ signedOut: true \}\)/g) || []).length, 5, 'a sign-out somebody asked for is missing its flag, or one was added that is not a sign-out')
    assert.equal((app.match(/allowBluetooth\(/g) || []).length, 8, 'App.js tells lib/bluetooth whose phone it is from somewhere else too')
    /*
     * haveSession is the session on the phone: supabase-js's getSession reads it from storage, where getUser asks the server.
     * And one that ran out with no signal to renew it is still his (keptSession, run in test/kept-session.mjs), off the
     * same storage, so his Bluetooth is a yes at the gig rather than a nobody.
     */
    const link = code('mobile/src/lib/link.js').replace(/\s+/g, ' ')
    assert.match(link, /export const haveSession = \(\) => keptSession\(\)/)
    const relay = code('mobile/src/lib/relay.js').replace(/\s+/g, ' ')
    assert.match(relay, /export async function restoreSession\(\) \{ try \{ const \{ data \} = await supabase\(\)\.auth\.getSession\(\) userId = data\?\.session\?\.user\?\.id \|\| null return userId \} catch \{ return null \} \}/, 'the relay no longer reads the session kept on the phone')
    const kept = relay.slice(relay.indexOf('export async function keptSession('), relay.indexOf('const sessionKey = '))
    assert.match(kept, /^export async function keptSession\(\) \{ try \{ const asked = supabase\(\) \.auth\.getSession\(\)/, 'haveSession no longer reads the session kept on the phone')
    assert.ok(!/getUser|currentAccount|rpc\(|fetch\(/.test(kept), 'haveSession asks the account server whose phone this is, which answers nobody with no signal')
  })

  test('on a bench: a customer left on Bluetooth is put back on the computer at launch, his phone starts on it once his id is in, and nobody known is not a no', async () => {
    const { ADMINS } = await import('../shared/admin.mjs')
    const JUSTIN = ADMINS[0]
    const CUSTOMER = '0b6c7a51-8f1e-4c2a-9d3b-5e7f9a1c2d4e'
    assert.ok(!ADMINS.includes(CUSTOMER))
    const leftOn = () => ({ 'fractal.bluetooth': JSON.stringify({ on: true, unit: 'am4', adapter: { id: '1:2', name: 'WIDI Uhost Bluetooth' }, pcChannel: 3 }) })
    const settle = () => new Promise((r) => setTimeout(r, 0))
    const kept = (bench) => JSON.parse(bench.disk.get('fractal.bluetooth'))

    /* A module that writes down everything it is asked, to show a refused phone's is asked nothing. */
    const recording = () => {
      const asked = []
      const mod = new Proxy({}, { get: (_, key) => (...args) => (asked.push(String(key)), key === 'supported' ? true : key === 'addListener' ? { remove() {} } : undefined) })
      return { mod, asked }
    }

    /*
     * 1. A customer who turned it on during the public day: the pick-up runs
     * first, with nobody known yet, then the account's answer, before the
     * link starts. Held off until then, nothing written, the module asked
     * nothing; then the no, written down.
     */
    {
      const { mod, asked } = recording()
      const bench = await bluetoothOnABench({ mod, disk: leftOn() })
      try {
        assert.equal(await bench.ble.restoreBluetooth(), false, 'with nobody known yet, the pick-up turns Bluetooth on')
        assert.equal(bench.sw.bluetoothOn(), false, 'a phone not yet known to be his sends to the adapter')
        assert.equal(bench.ble.useBluetoothOn(), false)
        /* The launch's own nobody (the sign-in screen's effect, say) on the way: still held, still nothing written. */
        assert.equal(bench.ble.allowBluetooth(null), false)
        assert.equal(bench.sw.bluetoothOn(), false)
        await settle()
        assert.equal(kept(bench).on, true, 'an off was written before anybody said whose phone this is')
        assert.equal(bench.ble.allowBluetooth(CUSTOMER), false)
        assert.equal(bench.sw.bluetoothOn(), false, 'a customer’s phone left on Bluetooth still sends to the adapter')
        assert.equal(bench.ble.useBluetoothOn(), false)
        assert.equal(bench.ble.useBluetoothAllowed(), false, 'the Settings row shows for a customer')
        assert.equal(bench.ble.bluetoothAllowed(), false)
        await settle()
        const disk = kept(bench)
        assert.equal(disk.on, false, 'the off is not written, so the next launch reaches for the adapter again')
        assert.equal(disk.unit, 'am4', 'the unit the customer chose is forgotten')
        assert.deepEqual(disk.adapter, { id: '1:2', name: 'WIDI Uhost Bluetooth' }, 'the adapter the customer chose is forgotten')
        assert.equal(disk.pcChannel, 3)
        assert.ok(bench.log.some((l) => /not open to this account in this version of the app, so it is off/.test(l)), 'the log does not say why Bluetooth went off')
        assert.equal(bench.ble.setBluetooth(true), false, 'Connect turns Bluetooth on for a customer')
        assert.equal(bench.sw.bluetoothOn(), false)
        assert.deepEqual(asked, [], 'a customer’s phone was asked something about Bluetooth')
        /* And a customer's held on never comes back, even for his account signing in on that phone. */
        assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.equal(bench.sw.bluetoothOn(), false, 'a customer’s on from the public day came back on')
      } finally {
        bench.done()
      }
    }

    /* 2. The other order: the account's answer first, then the pick-up. Off, written down, and the module never asked a thing. */
    {
      const { mod, asked } = recording()
      const bench = await bluetoothOnABench({ mod, disk: leftOn() })
      try {
        assert.equal(bench.ble.allowBluetooth(CUSTOMER), false)
        assert.equal(await bench.ble.restoreBluetooth(), false, 'a no that is already in does not hold at launch')
        assert.equal(bench.sw.bluetoothOn(), false)
        await settle()
        assert.equal(kept(bench).on, false, 'the off is not written when the no came first')
        assert.equal(kept(bench).unit, 'am4')
        assert.equal(bench.ble.setBluetooth(true), false)
        assert.deepEqual(asked, [], 'a refused customer’s phone was asked something about Bluetooth')
      } finally {
        bench.done()
      }
    }

    /*
     * 3. His phone: left on, it starts on, whichever lands first — the
     * pick-up holds the on until his id, which the launch gives before the
     * door opens — and Stop and Connect work.
     */
    for (const first of ['restore', 'account']) {
      const bench = await bluetoothOnABench({ mod: iphoneModule('allowedAlways').mod, disk: leftOn() })
      try {
        if (first === 'account') assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.equal(await bench.ble.restoreBluetooth(), first === 'account', `the pick-up (${first} first) did not wait for his id`)
        if (first === 'restore') {
          assert.equal(bench.sw.bluetoothOn(), false, 'Bluetooth went on before anybody said whose phone this is')
          assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        }
        assert.equal(bench.sw.bluetoothOn(), true, `his phone left on Bluetooth started on the computer (${first} first)`)
        assert.equal(bench.ble.useBluetoothOn(), true)
        assert.equal(bench.ble.useBluetoothAllowed(), true, 'the Settings row does not show for him')
        await settle()
        assert.equal(kept(bench).on, true)
        assert.equal(bench.ble.setBluetooth(false), false)
        assert.equal(bench.ble.setBluetooth(true), true, 'Connect could not turn Bluetooth on for him')
        /* The id as Supabase might hand it, in capitals or with a space: still his. */
        assert.equal(bench.ble.allowBluetooth(` ${JUSTIN.toUpperCase()} `), true)
        assert.equal(bench.sw.bluetoothOn(), true)

        /* Signing out on purpose: off, kept off, and written down; his unit and adapter kept for next time. */
        assert.equal(bench.ble.allowBluetooth(null, { signedOut: true }), false)
        assert.equal(bench.sw.bluetoothOn(), false, 'signing out leaves Bluetooth on')
        assert.equal(bench.ble.useBluetoothAllowed(), false, 'the Settings row stays after signing out')
        await settle()
        assert.equal(kept(bench).on, false, 'signing out on purpose does not write the off down')
        assert.equal(kept(bench).unit, 'am4')
        assert.equal(bench.ble.setBluetooth(true), false, 'Bluetooth turns on with nobody signed in')

        /* Back in as him: allowed again, and off until he taps Connect. */
        assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.equal(bench.sw.bluetoothOn(), false, 'signing back in turned Bluetooth on by itself')
        assert.equal(bench.ble.setBluetooth(true), true)

        /* Signed into another account on his phone: off again, and written down. */
        assert.equal(bench.ble.allowBluetooth(CUSTOMER), false)
        assert.equal(bench.sw.bluetoothOn(), false, 'another account on his phone keeps his Bluetooth on')
        await settle()
        assert.equal(kept(bench).on, false)
      } finally {
        bench.done()
      }
    }

    /*
     * 3b. His sign-in is gone without his asking (the account service turned
     * it away; one that only ran out with no signal answers with his id, see
     * test/kept-session.mjs): the phone has no session, which says nobody,
     * and nobody is not a no. Off for now, in memory only; the disk still
     * says on, so the next launch that knows it is his is on Bluetooth again,
     * and so is his signing back in.
     */
    {
      const bench = await bluetoothOnABench({ mod: iphoneModule('allowedAlways').mod, disk: leftOn() })
      let after
      try {
        assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.equal(await bench.ble.restoreBluetooth(), true)
        assert.equal(bench.ble.allowBluetooth(null), false)
        assert.equal(bench.sw.bluetoothOn(), false, 'with nobody known, Bluetooth stays on')
        assert.equal(bench.ble.useBluetoothOn(), false)
        assert.equal(bench.ble.useBluetoothAllowed(), false)
        assert.equal(bench.ble.setBluetooth(true), false, 'Bluetooth turns on with nobody known')
        await settle()
        assert.equal(kept(bench).on, true, 'a sign-in that ran out wrote his Bluetooth off for good')
        assert.equal(kept(bench).unit, 'am4')
        assert.ok(bench.log.some((l) => /off until this phone knows whose account it is/.test(l)))
        assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.equal(bench.sw.bluetoothOn(), true, 'his sign-in coming back left his Bluetooth off')
        bench.ble.allowBluetooth(null)
        await settle()
        after = Object.fromEntries(bench.disk)
      } finally {
        bench.done()
      }
      /* The next launch, from what that one left on the phone, with his id. */
      const next = await bluetoothOnABench({ mod: iphoneModule('allowedAlways').mod, disk: after })
      try {
        assert.equal(await next.ble.restoreBluetooth(), false)
        assert.equal(next.ble.allowBluetooth(JUSTIN), true)
        assert.equal(next.sw.bluetoothOn(), true, 'the launch after his sign-in ran out did not start on Bluetooth')
      } finally {
        next.done()
      }
    }

    /* 3c. Signing out on purpose while the pick-up is still holding the on: written off, and his id does not bring it back. */
    {
      const bench = await bluetoothOnABench({ mod: iphoneModule('allowedAlways').mod, disk: leftOn() })
      try {
        assert.equal(await bench.ble.restoreBluetooth(), false)
        assert.equal(bench.ble.allowBluetooth(null, { signedOut: true }), false)
        await settle()
        assert.equal(kept(bench).on, false, 'signing out on purpose left the on held on the phone')
        assert.equal(kept(bench).unit, 'am4')
        assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.equal(bench.sw.bluetoothOn(), false, 'signing back in after signing out turned Bluetooth on by itself')
      } finally {
        bench.done()
      }
    }

    /*
     * 3d. Anything else written while the on is held (an adapter chosen, say)
     * writes the held on with it, never an off. This chose the FM3 as its
     * write; changed on purpose on 25 October 2026, because the FM3 is his
     * account's alone now and nobody known is not his: it is refused until
     * his id is in, and taken once it is.
     */
    {
      const bench = await bluetoothOnABench({ mod: iphoneModule('allowedAlways').mod, disk: leftOn() })
      try {
        assert.equal(await bench.ble.restoreBluetooth(), false)
        assert.equal(bench.ble.setBluetoothUnit('fm3'), 'am4', 'the FM3 was taken before anybody said this is his phone')
        bench.ble.chooseAdapter({ id: '3:4', name: 'WIDI Jack' })
        await settle()
        assert.equal(kept(bench).on, true, 'choosing an adapter while the on was held wrote his Bluetooth off for good')
        assert.deepEqual(kept(bench).adapter, { id: '3:4', name: 'WIDI Jack' })
        assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.equal(bench.sw.bluetoothOn(), true)
        assert.equal(bench.ble.setBluetooth(false), false)
        assert.equal(bench.ble.setBluetoothUnit('fm3'), 'fm3', 'his account cannot pick the FM3')
      } finally {
        bench.done()
      }
    }

    /* 3e. His id on a phone (or a build) without Bluetooth MIDI: the held on stays off, rather than a link that can never connect. */
    {
      const { mod } = iphoneModule('allowedAlways')
      const bench = await bluetoothOnABench({ mod: { ...mod, supported: () => false }, disk: leftOn() })
      try {
        assert.equal(await bench.ble.restoreBluetooth(), false)
        assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.equal(bench.sw.bluetoothOn(), false, 'the held on came on where there is no Bluetooth MIDI')
      } finally {
        bench.done()
      }
    }

    /* 4. Anything that is not his account's id is nobody: the demo's `true`, nothing, a near miss. */
    const bench = await bluetoothOnABench({ mod: iphoneModule('allowedAlways').mod })
    try {
      assert.equal(bench.ble.useBluetoothAllowed(), false, 'the row shows before anybody has said whose phone this is')
      for (const id of [true, undefined, '', 'justin', `${JUSTIN}0`, `${JUSTIN.slice(0, -1)}${JUSTIN.endsWith('0') ? '1' : '0'}`]) {
        assert.equal(bench.ble.allowBluetooth(id), false, `${String(id)} is let in`)
      }
    } finally {
      bench.done()
    }
  })

  test('the Settings row and page redraw when the answer changes, and not when the same answer comes again', async () => {
    /*
     * The row and the page come and go with signing in, so the hook that
     * draws them has to hear the answer change. This listens the way React
     * does: through the subscribe the hook itself handed over, recorded by
     * the bench's React.
     */
    const { ADMINS } = await import('../shared/admin.mjs')
    const JUSTIN = ADMINS[0]
    const bench = await bluetoothOnABench({ mod: iphoneModule('allowedAlways').mod })
    try {
      const before = bench.subscribed.length
      assert.equal(bench.ble.useBluetoothAllowed(), false)
      assert.equal(bench.subscribed.length, before + 1, 'useBluetoothAllowed does not go through useSyncExternalStore')
      let heard = 0
      const stop = bench.subscribed.at(-1)(() => heard++)
      assert.equal(typeof stop, 'function', 'the subscribe hands React nothing to unsubscribe with')

      assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
      assert.equal(heard, 1, 'signing in as him does not redraw the row, so it never appears')
      assert.equal(bench.ble.useBluetoothAllowed(), true)
      bench.ble.allowBluetooth(JUSTIN)
      assert.equal(heard, 1, 'the same answer again redraws the row for nothing')

      assert.equal(bench.ble.allowBluetooth(null), false)
      assert.equal(heard, 2, 'signing out does not redraw the row, so it stays')
      assert.equal(bench.ble.useBluetoothAllowed(), false)
      bench.ble.allowBluetooth(null)
      assert.equal(heard, 2, 'nobody again redraws the row for nothing')

      stop()
      bench.ble.allowBluetooth(JUSTIN)
      assert.equal(heard, 2, 'a screen that has gone is still told')
    } finally {
      bench.done()
    }
  })

  /*
   * BLUETOOTH (BETA) FOR CUSTOMERS, BY THE STORE COPY, AND NEVER BY AN UPDATE.
   *
   * "I have tried it from an android phone and it works great." (25 October
   * 2026.) It is to reach paying customers in the next store version, on
   * both phones, and only there: every merge to main is an over-the-air
   * update to every copy on the current runtime (TestFlight 1.88.3, Google
   * Play 1.88.0, the App Store's 1.88.3 once approved), whose review notes
   * say customers do not see it, and switching it on for them by an update
   * is what Apple's 2.5.19 and 2.3.1(a) and Google's rule on features
   * "activated remotely" forbid. So it is decided by the version BUILT INTO
   * the copy (lib/storeVersion installedStoreVersion), which no update
   * touches, against BLUETOOTH_FROM_STORE in lib/ble-rule.js, null on both
   * phones until the build pull request.
   */
  test('the rule: a customer is let in only by the version built into the copy, at or above a threshold null until the build, and never on a version it cannot read', async () => {
    const rule = await import('../mobile/src/lib/ble-rule.js')
    const { bluetoothOpen, BLUETOOTH_FROM_STORE, CUSTOMER_UNITS, unitOffered } = rule
    /*
     * Frozen, so nothing at run time can set it. And null on both phones, or
     * set exactly as the build ledger allows: the build pull request's own
     * version, then the opening build's once its row is written. Asked of
     * the ledger test's own rule (test/ledger.mjs thresholdProblems), so the
     * build pull request, which sets it to 1.89.0 with the version, goes
     * green here as it does there, and nothing here has to be rewritten on
     * the day a build slot is waiting.
     */
    assert.ok(Object.isFrozen(BLUETOOTH_FROM_STORE), 'the threshold can be changed while the app runs')
    assert.deepEqual(Object.keys(BLUETOOTH_FROM_STORE).sort(), ['android', 'ios'])
    const { ledgerBuilds, thresholdProblems } = await import('./ledger.mjs')
    const app = JSON.parse(src('mobile/app.json')).expo.version
    assert.deepEqual(thresholdProblems(ledgerBuilds(src('docs/expo-builds.md')), BLUETOOTH_FROM_STORE, app), [], 'the threshold is set where the build ledger does not allow it: see the ledger test below')
    const FROM = { ios: '1.89.0', android: '1.89.0' }
    for (const platform of ['ios', 'android']) {
      /* Every copy there is, every copy before the build, and anything the copy cannot say: closed, whatever the threshold. */
      for (const installed of [null, undefined, '', '1.89', '1.89.0.1', 'v1.89.0', 'nonsense', '1.87.0', '1.87.1', '1.87.11', '1.88.0', '1.88.3', '1.88.4', '1.88.99']) {
        assert.equal(bluetoothOpen({ platform, installed, admin: false, from: FROM }), false, `a customer on a ${platform} copy that says ${JSON.stringify(installed)} is let in`)
        assert.equal(bluetoothOpen({ platform, installed, admin: false }), false)
      }
      /* The copy the build makes, and every store version after it: open, but only once the threshold is set, and closed while it is null. */
      for (const installed of ['1.89.0', '1.89.1', '1.90.0', '2.0.0']) {
        assert.equal(bluetoothOpen({ platform, installed, admin: false, from: FROM }), true, `a customer on the ${platform} ${installed} copy is shut out with the threshold set`)
        assert.equal(bluetoothOpen({ platform, installed, admin: false, from: { ios: null, android: null } }), false, `a customer on the ${platform} ${installed} copy is let in with no threshold`)
        if (BLUETOOTH_FROM_STORE[platform] === null) assert.equal(bluetoothOpen({ platform, installed, admin: false }), false, `a customer on the ${platform} ${installed} copy is let in with the threshold null`)
      }
      /* His account, on every copy, readable or not. */
      for (const installed of [null, '1.87.1', '1.88.3', '1.89.0']) assert.equal(bluetoothOpen({ platform, installed, admin: true }), true)
    }
    /* A threshold on one phone opens that phone only, and nothing that is not one of the two phones opens at all. */
    assert.equal(bluetoothOpen({ platform: 'android', installed: '1.89.0', from: { ios: '1.89.0', android: null } }), false)
    assert.equal(bluetoothOpen({ platform: 'ios', installed: '1.89.0', from: { ios: null, android: '1.89.0' } }), false)
    for (const platform of ['web', 'windows', null, undefined, '__proto__', 'constructor']) {
      assert.equal(bluetoothOpen({ platform, installed: '1.89.0', admin: false, from: FROM }), false, `${String(platform)} is let in`)
    }
    assert.equal(bluetoothOpen(), false)
    /*
     * EVERY UNIT, KEYED TO THE ONE STORE VERSION THAT OPENS BLUETOOTH. "I
     * don't wanna wait for the FM3 test", and the VP4 with them (25 October
     * 2026). Each unit carries the threshold it opens from, and all five
     * carry BLUETOOTH_FROM_STORE itself, so a customer gets each on exactly
     * the copies that open Bluetooth, and on no other. His account, every
     * unit on every copy. A unit the page offers that is not keyed here stays
     * his, and this fails until somebody decides (the page's list and the
     * keying are compared below).
     */
    const { UNITS_FROM_STORE } = rule
    const { BLE_UNITS } = await import('../mobile/src/lib/bleWire.js')
    assert.deepEqual([...CUSTOMER_UNITS], ['am4', 'fm3', 'fm9', 'axefx3', 'vp4'])
    assert.deepEqual([...CUSTOMER_UNITS], BLE_UNITS.map((u) => u.key), 'the Bluetooth page offers a unit that is not keyed to a store version, or the keying names one the page does not offer: decide, and key it')
    assert.ok(Object.isFrozen(CUSTOMER_UNITS) && Object.isFrozen(UNITS_FROM_STORE))
    for (const unit of CUSTOMER_UNITS) assert.equal(UNITS_FROM_STORE[unit], BLUETOOTH_FROM_STORE, `the ${unit} is not keyed to the store version that opens Bluetooth`)
    const KEYED = Object.fromEntries(CUSTOMER_UNITS.map((u) => [u, FROM]))
    for (const unit of CUSTOMER_UNITS) {
      for (const platform of ['ios', 'android']) {
        /* Closed on every copy there is, and open on the build's, for a customer; every copy for his account. */
        for (const installed of [null, '1.87.11', '1.88.0', '1.88.3', '1.88.99']) {
          assert.equal(unitOffered(unit, { platform, installed, units: KEYED }), false, `a customer on ${platform} ${installed} is offered the ${unit}`)
          assert.equal(unitOffered(unit, { platform, installed }), false)
          assert.equal(unitOffered(unit, { admin: true, platform, installed }), true, `his account is not offered the ${unit}`)
        }
        for (const installed of ['1.89.0', '1.90.0']) {
          assert.equal(unitOffered(unit, { platform, installed, units: KEYED }), true, `a customer on the ${platform} ${installed} copy is not offered the ${unit} with it keyed`)
          if (BLUETOOTH_FROM_STORE[platform] === null) assert.equal(unitOffered(unit, { platform, installed }), false, `a customer is offered the ${unit} with the threshold null`)
        }
      }
    }
    /* A unit nobody keyed, or a name that is not a unit: never a customer's, on any copy; his, as every unit the page knows is. */
    for (const unit of ['vp5', 'axefx2', '__proto__', 'constructor', 'toString', '', null, undefined]) {
      assert.equal(unitOffered(unit, { platform: 'ios', installed: '1.89.0', units: KEYED }), false, `a customer is offered ${String(unit)}`)
    }
    /* And a later unit keyed to a later store version reaches only the copies built to open it, never the 1.89.0 ones by update. */
    const later = { ...KEYED, vp5: { ios: '1.90.0', android: '1.90.0' } }
    assert.equal(unitOffered('vp5', { platform: 'ios', installed: '1.89.0', units: later }), false)
    assert.equal(unitOffered('vp5', { platform: 'android', installed: '1.90.0', units: later }), true)
    /* The ledger's own check of the keying, as it stands. */
    const { unitProblems, OPENED_AT } = await import('./ledger.mjs')
    assert.deepEqual(unitProblems({ units: UNITS_FROM_STORE, from: BLUETOOTH_FROM_STORE, pin: OPENED_AT }), [], 'the units are keyed where the ledger does not allow it')
    /* And on made-up pins, as the row's pull request and the years after it will have them. */
    const PIN = { version: '1.89.0', ios: '1.89.0', android: '1.89.0', units: ['am4', 'fm3', 'fm9', 'axefx3', 'vp4'] }
    assert.deepEqual(unitProblems({ units: KEYED, from: FROM, pin: PIN }), [], 'the opening build’s own keying fails its own pin')
    assert.deepEqual(unitProblems({ units: KEYED, from: FROM, pin: null }), [])
    assert.ok(unitProblems({ units: KEYED, from: FROM, pin: { ...PIN, units: undefined } }).some((p) => /OPENED_AT has no `units`/.test(p)), 'a pin with no units passes')
    /* A sixth unit keyed to the opening threshold after it: opened by update on copies reviewed without it. */
    assert.ok(unitProblems({ units: { ...KEYED, vp5: FROM }, from: FROM, pin: PIN }).some((p) => /vp5 opens on 1\.89\.0, which was reviewed without it/.test(p)))
    /* Keyed to a later store version of its own: fine. */
    assert.deepEqual(unitProblems({ units: { ...KEYED, vp5: { ios: '1.90.0', android: '1.90.0' } }, from: FROM, pin: PIN }), [])
    /* An opened unit closed by update: refused. */
    assert.ok(unitProblems({ units: { ...KEYED, fm3: { ios: '1.90.0', android: '1.90.0' } }, from: FROM, pin: PIN }).some((p) => /fm3 was opened to customers by 1\.89\.0, and is closed on it now/.test(p)))
    /* One phone alone, or before Bluetooth itself: refused. */
    assert.ok(unitProblems({ units: { ...KEYED, fm9: { ios: '1.89.0', android: null } }, from: FROM, pin: null }).some((p) => /fm9: keyed to ios 1\.89\.0 and android null/.test(p)))
    assert.ok(unitProblems({ units: { ...KEYED, fm9: { ios: '1.88.0', android: '1.88.0' } }, from: FROM, pin: null }).some((p) => /before Bluetooth \(beta\) itself/.test(p)))

    /*
     * PURE, AND READ THE ONE SAFE WAY. It imports the version rule and
     * nothing else, as siri-rule.js does, so a test can call it; and it asks
     * `isOlder(…) === false`, never `!isOlder(…)`, because isOlder says null
     * for a version it cannot read and `!null` would open it.
     */
    const ruleCode = code('mobile/src/lib/ble-rule.js')
    assert.deepEqual([...ruleCode.matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1]), ['./versions.js'], 'ble-rule.js imports something that needs a phone')
    assert.match(ruleCode, /isOlder\(installed, at\) === false/)
    assert.ok(!/!\s*isOlder\(/.test(ruleCode), 'the rule opens on a version it cannot read')

    /*
     * THE VERSION COMES FROM THE COPY, READ ONCE. lib/bluetooth asks
     * installedStoreVersion (the app config inside the binary) once, and
     * nothing in it or in the rule reads the update's number: APP_VERSION,
     * expoConfig and expo-updates all move with every merge.
     */
    const lib = code('mobile/src/lib/bluetooth.js')
    assert.equal((lib.match(/installedStoreVersion\(/g) || []).length, 1, 'lib/bluetooth asks for the built-in version more than once, or not at all')
    assert.match(lib.replace(/\s+/g, ' '), /let installed export const builtInVersion = \(\) => \{ if \(installed === undefined\) installed = installedStoreVersion\(\) return installed \}/)
    for (const [f, text] of [['lib/bluetooth.js', lib], ['lib/ble-rule.js', ruleCode]]) {
      assert.ok(!/APP_VERSION|expoConfig|nativeAppVersion|expo-updates|expo-constants|Constants\./.test(text), `${f} reads the update’s version, which an update changes`)
    }
    /* And nothing else in the app reads it for Bluetooth: the log's head and the purchase page ask lib/bluetooth. */
    const readers = []
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(jsx?|mjs)$/.test(entry) && /installedStoreVersion\(/.test(readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' '))) readers.push(full.replaceAll('\\', '/').split('/mobile/').pop())
      }
    }
    walk(fileURLToPath(new URL('../mobile/src/', import.meta.url)))
    assert.deepEqual(readers.sort(), ['src/lib/bluetooth.js', 'src/lib/siri.js', 'src/lib/storeVersion.js'], 'something else reads the built-in version')
    /* bluetoothAllowed and bluetoothFacts since 25 October 2026: a Bluetooth report's head says how Bluetooth stood. */
    assert.match(flat('mobile/src/lib/logHead.js'), /import \{ bluetoothAdmin, bluetoothAllowed, bluetoothFacts, builtInVersion, openForCustomersHere \} from '\.\/bluetooth'/)
    assert.match(flat('mobile/src/screens/Paywall.js'), /import \{ bluetoothSupported, openForCustomersHere \} from '\.\.\/lib\/bluetooth'/)
  })

  test('the build ledger holds the threshold: every build closed to a customer until a row marks the opening, and once one does, set and open on it for good', async () => {
    /*
     * The rule is test/ledger.mjs thresholdProblems, which says it in full,
     * and which the rule test above asks of the threshold too: every build
     * before the one marked as the opening closed to a customer; the opening
     * build's threshold set on each phone it built and open on its version,
     * for good; with no build marked, null or exactly this app's own version
     * (the build pull request); never above this app's version; and both
     * phones together, one build pair. And the pin (OPENED_AT, pinProblems)
     * holds the row and the threshold to each other once the row is written.
     */
    const { BLUETOOTH_FROM_STORE } = await import('../mobile/src/lib/ble-rule.js')
    const { ledgerBuilds, thresholdProblems: problems, withoutOpening, OPENED_AT, pinProblems } = await import('./ledger.mjs')

    const ledger = src('docs/expo-builds.md')
    const app = JSON.parse(src('mobile/app.json')).expo.version
    const builds = ledgerBuilds(ledger)
    assert.ok(builds.length >= 15, `only ${builds.length} builds were read from the ledger; this read is probably broken`)
    assert.ok(builds.some((b) => b.version === '1.88.3' && b.platform === 'ios') && builds.some((b) => b.version === '1.88.0' && b.platform === 'android'), 'the ledger’s newest builds were not read')
    assert.ok(!builds.some((b) => b.version === '1.88.3' && b.platform === 'android'), 'a phone the row did not build is read as built')
    /* The marker is said where it is written, in the ledger's own header, and in the rule. */
    assert.match(ledger, /The build that opens Bluetooth \(beta\) to customers says so in its row\*\*,\s+in these words in What it was for: "Bluetooth \(beta\) for customers"/, 'the ledger does not say how the opening build is marked')
    assert.match(src('mobile/src/lib/ble-rule.js'), /"Bluetooth \(beta\) for customers"/)

    /* THE REAL ONE: the ledger, the threshold and the pin as they are. */
    assert.deepEqual(problems(builds, BLUETOOTH_FROM_STORE, app), [])
    const stores = JSON.parse(src('public/store-versions.json'))
    assert.ok(OPENED_AT === null || (Object.isFrozen(OPENED_AT) && Object.keys(OPENED_AT).sort().join() === 'android,ios,units,version' && /^\d+\.\d+\.\d+$/.test(OPENED_AT.version) && Array.isArray(OPENED_AT.units)), 'OPENED_AT is not null, nor a frozen { version, ios, android, units }')
    assert.deepEqual(pinProblems({ builds, from: BLUETOOTH_FROM_STORE, stores, pin: OPENED_AT }), [])

    /*
     * And the check itself, on the ledgers it is there for: this one as it
     * was before any build opened Bluetooth, so these mean the same thing
     * the day the real opening row is written, and after.
     */
    const row = (version, ios, android, why) => `| 1 Nov | ${version} | ${ios} | ${android} | ${why} |`
    const unopened = withoutOpening(ledger)
    assert.ok(!ledgerBuilds(unopened).some((b) => b.opening) && ledgerBuilds(unopened).length >= 15, 'the ledger with its opening rows taken out is read wrong')
    const opened = `${unopened}\n${row('1.89.0', '1', '1', 'Bluetooth (beta) for customers: the AM4, from both phones')}\n`
    const pre = ledgerBuilds(unopened)
    assert.deepEqual(problems(pre, { ios: null, android: null }, app), [], 'today, closed everywhere, is wrong')
    assert.deepEqual(problems(pre, { ios: '1.89.0', android: '1.89.0' }, '1.89.0'), [], 'the build pull request, threshold and version moved together, is refused')
    assert.ok(problems(pre, { ios: '1.88.3', android: null }, app).some((p) => /ios 1\.88\.3 .* is open to a customer/.test(p)), '1.88.3 typed by mistake would open build 29 by update, and passes')
    assert.ok(problems(pre, { ios: '1.88.0', android: '1.88.0' }, app).length >= 2, 'a threshold under the copies in the stores passes')
    /* At a fixed version below the build's, so it still tries this on the build pull request itself, whose own version is 1.89.0. */
    assert.ok(problems(pre, { ios: '1.89.0', android: '1.89.0' }, '1.88.6').some((p) => /above this app’s version/.test(p)), 'a threshold no build from here reaches passes')
    assert.ok(problems(pre, { ios: '1.88.4', android: null }, '1.88.5').some((p) => /not this app’s version/.test(p)), 'a threshold set early and left behind by the next version, or the state just after the build pull request before the opening row is written, passes')
    /* And that failure sends whoever reads it to the row first, never only to moving the number, which would close the copies under review. */
    const behind = problems(pre, { ios: '1.89.0', android: '1.89.0' }, '1.89.1').find((p) => /^ios: .*not this app’s version/.test(p)) || ''
    assert.match(behind, /If a build has already been started from threshold 1\.89\.0, add its row to docs\/expo-builds\.md with "Bluetooth \(beta\) for customers" in What it was for, set OPENED_AT in test\/ledger\.mjs to that build, and leave the threshold as it is/)
    assert.ok(behind.indexOf('add its row') < behind.indexOf('move it with the version'), 'the ledger failure offers moving the threshold before writing the row')
    const after = ledgerBuilds(opened)
    assert.equal(after.filter((b) => b.opening).length, 2, 'the opening row is not read as the opening on both phones')
    assert.deepEqual(problems(after, { ios: '1.89.0', android: '1.89.0' }, '1.89.1'), [], 'the day the opening build is written down, the ledger check breaks')
    assert.ok(problems(after, { ios: null, android: null }, '1.89.1').length === 2, 'an update setting the threshold back to null, after the opening build, passes')
    assert.ok(problems(after, { ios: '1.90.0', android: '1.90.0' }, '1.90.0').length >= 2, 'a threshold raised past the opening build passes')
    assert.ok(problems(after, { ios: '1.89.0', android: null }, '1.89.1').some((p) => /^android: 1\.89\.0 is marked/.test(p)), 'an opening row that built Android, with Android left closed, passes')

    /*
     * BOTH PHONES TOGETHER. The build pull request with the threshold set on
     * one phone alone passed each phone's own check (null is fine, and so is
     * this app's version), and the pair would have been built on it, one
     * phone reviewed with notes that say Bluetooth is there and a copy that
     * keeps it closed. And a split row, the opening marked on one phone's
     * build and the same version's other build left unmarked, hid that from
     * the row's check afterwards.
     */
    for (const half of [{ ios: '1.89.0', android: null }, { ios: null, android: '1.89.0' }]) {
      assert.ok(problems(pre, half, '1.89.0').some((p) => /^the threshold is set on one phone only/.test(p)), `the build pull request with the threshold ${JSON.stringify(half)} passes`)
    }
    assert.ok(problems(pre, { ios: '1.89.0', android: '1.88.6' }, '1.89.0').some((p) => /^the threshold is not the same on both phones/.test(p)), 'a threshold set differently on each phone passes')
    assert.deepEqual(problems(pre, { ios: null, android: null }, '1.89.0'), [], 'the build pull request before the threshold is set is refused')
    const split = ledgerBuilds(`${unopened}\n${row('1.89.0', '1', '—', 'Bluetooth (beta) for customers: the AM4, from the iPhone')}\n${row('1.89.0', '—', '1', 'The build pair, Android')}\n`)
    assert.ok(problems(split, { ios: '1.89.0', android: null }, '1.89.1').some((p) => /^the opening is marked on ios at 1\.89\.0 and on android at no build/.test(p)), 'a split row hides an Android build of the opening version left closed')
    const oneSided = ledgerBuilds(`${unopened}\n${row('1.89.0', '1', '—', 'Bluetooth (beta) for customers: the AM4, from the iPhone')}\n`)
    assert.ok(problems(oneSided, { ios: '1.89.0', android: null }, '1.89.1').some((p) => /^the opening is marked on ios/.test(p)), 'an opening on one phone alone passes')

    /*
     * THE PIN. A later change that took the opening row out and set the
     * threshold back to null together passed every check above, at every
     * version, since the ledger is all they trust. OPENED_AT in
     * test/ledger.mjs is the third thing, checked both ways, and on the
     * stores without the ledger; tried here on the days it is for.
     */
    const PIN = Object.freeze({ version: '1.89.0', ios: '1.89.0', android: '1.89.0' })
    const BOTH = { ios: '1.89.0', android: '1.89.0' }
    const shut = { ios: null, android: null }
    const before = { ios: '1.88.3', android: '1.88.0' }
    const live = { ios: '1.89.0', android: '1.89.0' }
    const pins = (state) => pinProblems({ builds: after, from: BOTH, stores: before, pin: PIN, ...state })
    /* Today, the build pull request, and the row's pull request with the pin: nothing to say. */
    assert.deepEqual(pins({ builds: pre, from: shut, pin: null }), [], 'today, with nothing opened and nothing pinned, is wrong')
    assert.deepEqual(pins({ builds: pre, pin: null }), [], 'the build pull request, before any row or pin, is refused')
    assert.deepEqual(pins({}), [], 'the row’s pull request, with the pin, is refused')
    assert.deepEqual(pins({ stores: live }), [], 'the day 1.89.0 is live in both stores, the pin is refused')
    /* The row's pull request without the pin: red, and it says what to write. */
    const unpinned = pins({ pin: null })
    assert.ok(unpinned.some((p) => /^docs\/expo-builds\.md marks 1\.89\.0 as the opening, and OPENED_AT in test\/ledger\.mjs is null/.test(p)), 'the row’s pull request goes green without the pin')
    assert.ok(unpinned.join().includes("{ version: '1.89.0'"), 'the failure does not say what the pin is')
    /* The row and the threshold taken out together, the pin left: red, before and after the stores have it. */
    for (const stores of [before, live]) {
      const gone = pins({ builds: pre, from: shut, stores })
      assert.ok(gone.some((p) => /^ios: OPENED_AT says 1\.89\.0 opened Bluetooth \(beta\), and docs\/expo-builds\.md has no ios build/.test(p)), 'the opening row taken out passes')
      assert.ok(gone.some((p) => /^android: OPENED_AT says the threshold is 1\.89\.0, and it is null/.test(p)), 'the threshold set back to null passes')
    }
    /* Each alone, too: the threshold moved, the row taken out, the pin's version wrong. */
    assert.ok(pins({ from: { ios: '1.89.1', android: '1.89.0' } }).some((p) => /^ios: OPENED_AT says the threshold is 1\.89\.0, and it is 1\.89\.1/.test(p)), 'the threshold moved past the opening passes the pin')
    assert.ok(pins({ builds: pre }).length >= 2, 'the opening row taken out, the threshold left, passes the pin')
    assert.ok(pins({ pin: { ...PIN, version: '1.89.1' } }).some((p) => /OPENED_AT says 1\.89\.1 opened .* marks 1\.89\.0 as the opening/.test(p)), 'a pin on another version than the row passes')
    /* And the stores, which do not read the ledger: the pin rewritten for one phone, with that phone's threshold gone, once its store has the version. */
    const halfPin = { ...PIN, android: null }
    assert.deepEqual(pins({ pin: halfPin, from: { ios: '1.89.0', android: null }, stores: before }).filter((p) => /store-versions/.test(p)), [], 'a store not yet on the opening version is held to it')
    assert.ok(pins({ pin: halfPin, from: { ios: '1.89.0', android: null }, stores: { ios: '1.89.0', android: '1.89.2' } }).some((p) => /^android: public\/store-versions\.json says 1\.89\.2 is live, at or after 1\.89\.0, which opened Bluetooth \(beta\), and the threshold null does not open on 1\.89\.0/.test(p)), 'Google Play live on the opening version, with its threshold gone, passes')
  })

  test('on a bench, by the store copy: a customer is closed on every copy there is, and on the copy the build will make they get it, on every unit', async () => {
    const { ADMINS } = await import('../shared/admin.mjs')
    const JUSTIN = ADMINS[0]
    const CUSTOMER = '0b6c7a51-8f1e-4c2a-9d3b-5e7f9a1c2d4e'
    const settle = () => new Promise((r) => setTimeout(r, 0))
    const kept = (bench) => JSON.parse(bench.disk.get('fractal.bluetooth'))
    const left = (unit, on) => ({ 'fractal.bluetooth': JSON.stringify({ on, unit, adapter: { id: '1:2', name: 'WIDI Uhost Bluetooth' }, pcChannel: 1 }) })
    /* A module that writes down everything it is asked, as the bench test above has. */
    const recording = () => {
      const asked = []
      const mod = new Proxy({}, { get: (_, key) => (...args) => (asked.push(String(key)), key === 'supported' ? true : key === 'addListener' ? { remove() {} } : undefined) })
      return { mod, asked }
    }
    /* As the build pull request will set it. */
    const BUILD = { ios: '1.89.0', android: '1.89.0' }

    /*
     * 1. The rule as it is, on every copy there is (and on the copy the build
     * will make, while the threshold is still null): closed, and the module
     * asked nothing. On the build pull request, which sets the threshold,
     * the 1.89.0 copy is section 3's.
     */
    const { BLUETOOTH_FROM_STORE } = await import('../mobile/src/lib/ble-rule.js')
    for (const os of ['ios', 'android']) {
      for (const installed of ['1.87.1', '1.87.11', '1.88.0', '1.88.3', '1.88.4', ...(BLUETOOTH_FROM_STORE[os] === null ? ['1.89.0'] : []), null]) {
        const { mod, asked } = recording()
        const bench = await bluetoothOnABench({ os, mod, installed, disk: left('am4', true) })
        try {
          assert.equal(await bench.ble.restoreBluetooth(), false)
          assert.equal(bench.ble.allowBluetooth(CUSTOMER), false, `a customer on the ${os} ${installed} copy is let in`)
          assert.equal(bench.ble.useBluetoothAllowed(), false, `the Settings row shows for a customer on the ${os} ${installed} copy`)
          assert.equal(bench.ble.setBluetooth(true), false)
          assert.equal(bench.ble.openForCustomersHere(), false)
          assert.deepEqual(asked, [], `a customer’s ${os} ${installed} copy was asked something about Bluetooth`)
          /* His, on the same copy: open, as it has been since 11 October. */
          assert.equal(bench.ble.allowBluetooth(JUSTIN), true, `his account is shut out on the ${os} ${installed} copy`)
        } finally {
          bench.done()
        }
      }
    }

    /* 2. With the threshold set, the copies before it, and a copy that cannot say: still closed, still asked nothing. */
    for (const os of ['ios', 'android']) {
      for (const installed of ['1.88.0', '1.88.3', '1.88.4', null]) {
        const { mod, asked } = recording()
        const bench = await bluetoothOnABench({ os, mod, installed, from: BUILD, disk: left('am4', true) })
        try {
          assert.equal(await bench.ble.restoreBluetooth(), false)
          assert.equal(bench.ble.allowBluetooth(CUSTOMER), false, `with the threshold set, a customer on the ${os} ${installed} copy is let in`)
          assert.equal(bench.ble.setBluetooth(true), false)
          assert.deepEqual(asked, [])
        } finally {
          bench.done()
        }
      }
    }

    /*
     * 3. The copy at the threshold: open to a customer, every unit the page offers (all five, keyed to the same threshold), Connect turns it on, and the next launch starts on it once their id is in.
     *
     * And a customer is never taken for his account there. bluetoothAdmin
     * and useBluetoothAdmin are what keep a free account in airplane mode
     * out (unlock-rule mayDriveBluetooth gives his account mayDrive's "the
     * store cannot be reached" yes), and this is the one copy where
     * Bluetooth is open to a customer, so the one place a slip in them
     * (`allowed` read for `allUnits`) shows: on a closed copy a customer's
     * allowed is false too, and the two cannot be told apart.
     */
    const { mayDriveBluetooth } = await import('../mobile/src/lib/unlock-rule.js')
    for (const os of ['ios', 'android']) {
      const { mod, asked } = recording()
      const bench = await bluetoothOnABench({ os, mod, installed: '1.89.0', from: BUILD })
      let after
      try {
        assert.equal(bench.ble.openForCustomersHere(), true, `the ${os} 1.89.0 copy does not open Bluetooth to customers`)
        assert.equal(bench.ble.allowBluetooth(CUSTOMER), true, `a customer on the ${os} 1.89.0 copy is shut out`)
        assert.equal(bench.ble.bluetoothAdmin(), false, `a customer on the ${os} 1.89.0 copy is taken for his account`)
        assert.equal(bench.ble.useBluetoothAdmin(), false, `the Settings row and Connect take a customer on the ${os} 1.89.0 copy for his account`)
        assert.equal(mayDriveBluetooth({ unlocked: false, available: false }, bench.ble.bluetoothAdmin()), false, `a free account on the ${os} 1.89.0 copy, with the store out of reach, may use Bluetooth`)
        assert.equal(bench.ble.useBluetoothAllowed(), true, 'the Settings row does not show for a customer on the copy that opens it')
        assert.deepEqual(bench.ble.offeredUnits().map((u) => u.key), ['am4', 'fm3', 'fm9', 'axefx3', 'vp4'], 'a customer on the copy that opens it is not offered every unit')
        assert.equal(bench.ble.setBluetooth(true), false, 'Bluetooth turns on with no unit')
        for (const unit of ['fm3', 'fm9', 'axefx3', 'vp4']) assert.equal(bench.ble.setBluetoothUnit(unit), unit, `a customer on the copy that opens it cannot pick the ${unit}`)
        assert.equal(bench.ble.setBluetoothUnit('am4'), 'am4')
        bench.ble.chooseAdapter({ id: '1:2', name: 'WIDI Uhost Bluetooth' })
        assert.equal(bench.ble.setBluetooth(true), true, 'Connect does not turn Bluetooth on for a customer on the copy that opens it')
        assert.equal(bench.sw.bluetoothOn(), true)
        assert.ok(asked.includes('supported'), 'the copy that opens it never asks whether the phone can do it')
        await settle()
        after = Object.fromEntries(bench.disk)
      } finally {
        bench.done()
      }
      const next = await bluetoothOnABench({ os, mod: recording().mod, installed: '1.89.0', from: BUILD, disk: after })
      try {
        assert.equal(await next.ble.restoreBluetooth(), false, 'the pick-up turns it on before anybody has said whose phone this is')
        assert.equal(next.ble.allowBluetooth(CUSTOMER), true)
        assert.equal(next.sw.bluetoothOn(), true, `a customer left on Bluetooth on the ${os} copy that opens it starts on the computer`)
        assert.equal(next.ble.bluetoothAdmin(), false, 'a customer is taken for his account at the next launch')
        /* His account on the same phone: every unit, his own purchase rule, and still on. */
        assert.equal(next.ble.allowBluetooth(JUSTIN), true)
        assert.equal(next.ble.bluetoothAdmin(), true, `his account on the ${os} 1.89.0 copy is not known as his`)
        assert.equal(next.ble.useBluetoothAdmin(), true, `the Settings row and Connect do not know his account on the ${os} 1.89.0 copy`)
        assert.deepEqual(next.ble.offeredUnits().map((u) => u.key), ['am4', 'fm3', 'fm9', 'axefx3', 'vp4'], 'his account is not offered every unit')
        assert.equal(next.sw.bluetoothOn(), true)
        /* Signing out on purpose is off, written down, as on every copy. */
        assert.equal(next.ble.allowBluetooth(null, { signedOut: true }), false)
        await settle()
        assert.equal(kept(next).on, false)
      } finally {
        next.done()
      }
    }

    /*
     * 4. A unit this copy does not open to customers, kept from before (as a
     * unit keyed to a later store version would be: `later`): let go of and
     * written down, whichever lands first, and never turned on with it. And
     * an FM3 kept from the one public day, on the copy that opens every unit:
     * kept, since the FM3 is offered now.
     */
    for (const first of ['restore', 'account']) {
      const bench = await bluetoothOnABench({ mod: recording().mod, installed: '1.89.0', from: BUILD, later: ['vp4'], disk: left('vp4', true) })
      try {
        if (first === 'account') assert.equal(bench.ble.allowBluetooth(CUSTOMER), true)
        assert.equal(await bench.ble.restoreBluetooth(), false)
        if (first === 'restore') assert.equal(bench.ble.allowBluetooth(CUSTOMER), true)
        assert.equal(bench.sw.bluetoothOn(), false, `a customer’s VP4, keyed later, came on over Bluetooth (${first} first)`)
        assert.deepEqual(bench.ble.offeredUnits().map((u) => u.key), ['am4', 'fm3', 'fm9', 'axefx3'], 'a unit keyed to a later store version is offered on this one')
        await settle()
        assert.equal(kept(bench).unit, null, `a customer’s VP4, keyed later, is kept (${first} first)`)
        assert.equal(kept(bench).on, false)
        assert.ok(bench.log.some((l) => /the VP4 is not offered over Bluetooth to this account/.test(l)), 'the log does not say why the unit was cleared')
      } finally {
        bench.done()
      }
    }
    {
      const bench = await bluetoothOnABench({ mod: recording().mod, installed: '1.89.0', from: BUILD, disk: left('fm3', false) })
      try {
        assert.equal(await bench.ble.restoreBluetooth(), false)
        assert.equal(bench.ble.allowBluetooth(CUSTOMER), true)
        await settle()
        assert.equal(bench.ble.bluetoothSettings().unit, 'fm3', 'a customer’s FM3 is cleared on the copy that offers it')
      } finally {
        bench.done()
      }
    }
    /* His VP4 keyed later, on the same copy: kept, and on. */
    {
      const bench = await bluetoothOnABench({ mod: recording().mod, installed: '1.89.0', from: BUILD, later: ['vp4'], disk: left('vp4', true) })
      try {
        assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.equal(await bench.ble.restoreBluetooth(), true, 'his VP4 does not come back on')
        await settle()
        assert.equal(kept(bench).unit, 'vp4')
        /* And another account signing in on his phone: off, and his VP4 let go of. */
        assert.equal(bench.ble.allowBluetooth(CUSTOMER), true)
        assert.equal(bench.sw.bluetoothOn(), false, 'a customer signed in on his phone drives his VP4 over Bluetooth')
        await settle()
        assert.equal(kept(bench).unit, null)
      } finally {
        bench.done()
      }
    }
    /*
     * And on a copy that stays closed, it is KEPT, whoever it belonged to:
     * nothing there can use it (setBluetooth and setBluetoothUnit refuse a
     * unit that is not offered), so clearing it would buy nothing, and an
     * update would be erasing what was picked on copies whose review notes
     * say Bluetooth is not there. Both orders, and the tester's account on
     * his phone too: only a copy that opens it clears it.
     */
    for (const first of ['restore', 'account']) {
      for (const on of [false, true]) {
        const bench = await bluetoothOnABench({ mod: recording().mod, installed: '1.88.3', disk: left('fm3', on) })
        try {
          if (first === 'account') assert.equal(bench.ble.allowBluetooth(CUSTOMER), false)
          assert.equal(await bench.ble.restoreBluetooth(), false)
          if (first === 'restore') assert.equal(bench.ble.allowBluetooth(CUSTOMER), false)
          assert.equal(bench.sw.bluetoothOn(), false)
          await settle()
          assert.equal(kept(bench).unit, 'fm3', `a closed copy cleared the FM3 that was picked on it (${first} first, ${on ? 'on' : 'off'})`)
          assert.deepEqual(kept(bench).adapter, { id: '1:2', name: 'WIDI Uhost Bluetooth' }, 'the adapter went')
          assert.ok(!bench.log.some((l) => /is not offered over Bluetooth to this account/.test(l)), 'a closed copy says it cleared a unit')
        } finally {
          bench.done()
        }
      }
    }
    {
      const bench = await bluetoothOnABench({ mod: recording().mod, installed: '1.88.3', disk: left('fm3', true) })
      try {
        assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.equal(await bench.ble.restoreBluetooth(), true, 'his FM3 does not come back on a copy closed to customers')
        assert.equal(bench.ble.allowBluetooth(CUSTOMER), false)
        assert.equal(bench.sw.bluetoothOn(), false, 'a customer signed in on his phone drives his FM3 over Bluetooth')
        await settle()
        assert.equal(kept(bench).unit, 'fm3', 'a customer signing in on his phone, on a copy closed to them, cleared his FM3')
        assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.deepEqual(bench.ble.offeredUnits().map((u) => u.key), ['am4', 'fm3', 'fm9', 'axefx3', 'vp4'])
      } finally {
        bench.done()
      }
    }
    /* 5. Nobody known is not a no, on the copy that opens it as everywhere: held, nothing written. */
    {
      const bench = await bluetoothOnABench({ mod: recording().mod, installed: '1.89.0', from: BUILD, disk: left('am4', true) })
      try {
        assert.equal(await bench.ble.restoreBluetooth(), false)
        assert.equal(bench.ble.allowBluetooth(null), false)
        await settle()
        assert.equal(kept(bench).on, true, 'nobody known wrote a customer’s on off')
        assert.equal(kept(bench).unit, 'am4')
      } finally {
        bench.done()
      }
    }
  })

  test('every way onto the Bluetooth page goes through the one gate: the Settings row, the page, and both waiting-screen buttons', () => {
    /*
     * The gate is three things, the same everywhere: the full version as
     * Bluetooth reads it (unlock-rule mayDriveBluetooth: the purchase itself
     * for a customer, mayDrive's answer for his account), Bluetooth open to
     * this account on this copy (bluetoothAllowed, lib/bluetooth), and a
     * build and device that can do it (bluetoothSupported). Without all three
     * the page draws nothing, so a way onto it without them opens an empty
     * Settings page.
     */
    const GATE = 'mayDriveBluetooth(purchase, bluetoothAdmin) && bluetoothAllowed && bluetoothSupported()'
    const settings = flat('mobile/src/screens/Settings.js')
    /* Two ways on Settings: the row, and the button on Phone & computer, which the Live pill opens (26 October 2026), behind the same three as one name. */
    assert.equal((settings.match(/setPage\('bluetooth'\)/g) || []).length, 2, 'something else on Settings opens the Bluetooth page')
    assert.ok(settings.includes(`const bluetoothOffered = ${GATE}`), 'Phone & computer’s Bluetooth button is behind another gate')
    assert.match(settings, /\{bluetoothOffered && !demo \? \( <Press label=\{bluetooth \? 'Bluetooth' : 'Connect over Bluetooth'\}[^}]*\}[^]*?onPress=\{\(\) => setPage\('bluetooth'\)\}/, 'the button on Phone & computer is not behind the gate')
    for (const sub of ['bt-ways', 'bt-trouble', 'bt-limits']) assert.ok(settings.includes(`{page === '${sub}' && bluetoothOffered ? (`), `the ${sub} page is not behind the gate`)
    assert.ok(settings.includes(`{${GATE} ? ( <SetupRow title="Bluetooth"`), 'the row is not behind the gate')
    assert.ok(settings.includes(`{page === 'bluetooth' && ${GATE} ? (`), 'the page is not behind the gate')
    assert.ok(settings.includes('const bluetoothAllowed = useBluetoothAllowed()') && settings.includes('const bluetoothAdmin = useBluetoothAdmin()'), 'the row’s gate is read from something other than lib/bluetooth')
    /* And the page's own Connect, by the same purchase rule: never mayDrive, whose "store out of reach" is a yes. */
    const bluetoothPage = flat('mobile/src/screens/Bluetooth.js')
    assert.match(bluetoothPage, /const his = useBluetoothAdmin\(\) const paid = mayDriveBluetooth\(purchase, his\)/, 'Connect reads the full version some other way than the row')
    assert.match(bluetoothPage, /if \(paid\) setBluetooth\(true\)/)
    assert.match(bluetoothPage, /const canStart = !!b\.unit && paid/)
    assert.ok(!/mayDrive\(/.test(code('mobile/src/screens/Bluetooth.js')), 'the Bluetooth page lets a free account connect with the store out of reach')
    /* App.js: one way to the page, handed to the waiting screen only through the same three: the row's gate as one hook. */
    const app = flat('mobile/App.js')
    /* Two: the waiting screen's, and the Which unit sheet's off the Live pill, both behind bluetoothOffered. */
    assert.equal((app.match(/openSettings\('bluetooth'\)/g) || []).length, 2, 'App.js opens the Bluetooth page from somewhere else too')
    assert.ok(app.includes("onBluetooth={bluetoothOffered ? () => (setPickLive(false), openSettings('bluetooth')) : null}"), 'the Which unit sheet’s Bluetooth button is behind another gate')
    assert.ok(app.includes('const bluetoothOffered = useBluetoothOffered()'), 'the waiting screen’s way in is not the Settings row’s gate')
    assert.ok(!/mayDrive|bluetoothSupported\(\)|useBluetoothAllowed\(\)/.test(code('mobile/App.js')), 'App.js writes the Bluetooth gate out again beside the hook')
    const hook = code('mobile/src/lib/useBluetoothOffered.js').replace(/\s+/g, ' ')
    assert.match(hook, /const purchase = usePurchase\(\) const allowed = useBluetoothAllowed\(\) const admin = useBluetoothAdmin\(\) return mayDriveBluetooth\(purchase, admin\) && allowed && bluetoothSupported\(\)/, 'the hook is not the row’s gate')
    assert.match(app, /onBluetooth=\{bluetoothOffered \? \(\) => openSettings\('bluetooth'\) : null\}/)
    /* The waiting screen: every button that opens the page waits for that way in. */
    const waking = app.slice(app.indexOf('function Waking('))
    const uses = [...waking.matchAll(/onPress=\{onBluetooth\}/g)].length
    assert.equal(uses, 2, 'the waiting screen opens the Bluetooth page from more or fewer than its two buttons')
    assert.equal((waking.match(/&& onBluetooth (?:&& !elsewhere )?\? (?:\( )?<Press/g) || []).length, 2, 'a waiting-screen button opens the Bluetooth page without the gate')
    /*
     * THE NEW WAY IN: "No computer? Use Bluetooth", while it is off,
     * with what it costs against the computer under it (and, to a customer,
     * that it is the AM4 alone), and after the computer's own button, never
     * before it. Short enough for the one line a button's label has on a
     * 360-point Android phone: "Connect by Bluetooth" was cut there.
     */
    /*
     * And never under the account warning ("The computer on this wifi is
     * signed into a different account"): a computer is right there, and the
     * fix is the account, so "No computer?" would point the other way.
     */
    assert.match(waking, /\{!bluetooth && onBluetooth && !elsewhere \? \( <Press label="No computer\? Use Bluetooth" sub=\{BLUETOOTH_WAYS_SHORT\} onPress=\{onBluetooth\} \/> \) : null\}/, 'the waiting screen offers no way to Bluetooth with no computer, or offers it under the account warning')
    assert.ok('No computer? Use Bluetooth'.length <= 34, 'the waiting screen’s way in is too long for one line on a small phone')
    const advice = waking.slice(waking.indexOf("{long && link.link !== 'connected' ? ("))
    const noComputer = advice.indexOf('No computer? Use Bluetooth')
    const computer = advice.indexOf('label="Look for the computer again"')
    assert.ok(computer > 0 && noComputer > computer, 'Bluetooth is offered before the computer, which is the best way')
    assert.ok(noComputer > 0 && noComputer < advice.indexOf('label="Troubleshooting"'), 'the way to Bluetooth is not with the waiting screen’s advice')
    /* Nothing anywhere else in the app opens the page. */
    const files = []
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(jsx?|mjs)$/.test(entry)) files.push(full)
      }
    }
    walk(fileURLToPath(new URL('../mobile/src/', import.meta.url)))
    for (const f of files) {
      const name = f.replaceAll('\\', '/').split('/mobile/').pop()
      if (name === 'src/screens/Settings.js') continue
      assert.ok(!/(setPage|openSettings|onOpenSettings)\(\s*'bluetooth'\s*\)/.test(readFileSync(f, 'utf8')), `${name} opens the Bluetooth page without the gate`)
    }
  })

  test('two ways to connect, the computer the best one: said wherever Bluetooth is offered, from the gear file, and the same three things in the no-computer words and the email', async () => {
    /*
     * "Make it clear that there's multiple ways to connect the device, but
     * also make it clear that the computer is the preferred method and that
     * Bluetooth will have more lag and not have as many features." (25
     * October 2026.) In words a guitarist reads in two seconds, and only what
     * is true: slower (the preset list, a first preset's scene names, a
     * footswitch change shown at the next poll) and fewer features (the
     * page's own list of what is not there over Bluetooth).
     */
    const gear = await import('../shared/bluetooth-gear.mjs')
    /* "More lag": his word, kept (the gear file says why "slower" stood in for a day). */
    assert.equal(gear.BLUETOOTH_WAYS, 'There are two ways to connect. The computer is the best one. Bluetooth needs no computer, but it has more lag and fewer features.')
    /* Not "and does everything": on the purchase page it follows the list of what a VP4 cannot do from the app yet. */
    assert.ok(!/does everything|every feature/i.test(gear.BLUETOOTH_WAYS), 'the sentence says the computer does everything, beside what a VP4 cannot do')
    assert.equal(gear.BLUETOOTH_WAYS_SHORT, 'More lag than the computer, fewer features')
    assert.ok(gear.BLUETOOTH_WAYS.split(/\s+/).length <= 30, 'the sentence takes longer than two seconds to read')
    /* One short line for everybody since every unit opened together: the customer's "AM4 only for now · …" is gone. */
    assert.equal(gear.BLUETOOTH_WAYS_SHORT_AM4, undefined, 'a customer is still told the AM4 only')
    /* The Settings row: both halves, what it is for and what it costs, short enough for one line on a 320-point screen. */
    assert.equal(gear.BLUETOOTH_ROW_OFF, 'Off · no computer needed, more lag')
    assert.ok(gear.BLUETOOTH_ROW_OFF.length <= 36, 'the Settings row is too long for its one line')
    /* What it says it lacks, the page's list says too. */
    const different = src('mobile/src/screens/Bluetooth.js').match(/const DIFFERENT = \[([\s\S]*?)\n\]/)?.[1] ?? ''
    assert.match(different, /No editing or saving over Bluetooth\./)
    assert.match(different, /Slower to load the preset list\./)
    /*
     * The purchase page's line: the two ways, then every unit (and, since
     * 31 October 2026, nothing of which has been tried: that is the
     * Developer page's), what a VP4 gets, and every part bought separately,
     * with no prices. It said "a Bluetooth MIDI adapter" for a day, and the list it
     * stands for is four parts and a charger: each of them has to be in it.
     * And by name, in the line itself: it sent them to "the Bluetooth page"
     * for a day, which nobody who has not paid can open. The AM4 alone until
     * 25 October 2026, when every unit opened together.
     */
    assert.equal(
      gear.BLUETOOTH_PAYWALL,
      `${gear.BLUETOOTH_WAYS} It is offered on the AM4, FM3, FM9, Axe-Fx III and VP4, and on a VP4 it changes presets and scenes only. It needs parts sold separately: a CME WIDI Uhost (the Bluetooth adapter) and a CME C2MIDI Pro (its MIDI cable), or a CME U2MIDI Pro in its place for an FM3, plus two Type-A MIDI to 3.5 mm adapters for an AM4 or VP4, and a USB charger or power bank. Never the C2MIDI Pro on an FM3: it got very hot on one.`
    )
    const { BLE_UNITS } = await import('../mobile/src/lib/bleWire.js')
    for (const u of BLE_UNITS) assert.ok(new RegExp(`\\b${u.name}\\b`).test(gear.BLUETOOTH_PAYWALL), `the purchase page’s line leaves out the ${u.name}`)
    assert.deepEqual(gear.partsFor('vp4').map((p) => p.key), gear.partsFor('am4').map((p) => p.key), 'a VP4’s parts are not the AM4’s, and the purchase page says they are')
    assert.equal(gear.partsFor('am4').length, 3, 'the AM4’s list changed, and the purchase page’s line names the old one')
    for (const part of gear.partsFor('am4')) assert.ok(gear.BLUETOOTH_PAYWALL.toLowerCase().includes(part.name.toLowerCase()), `the purchase page’s line does not name the ${part.name}`)
    assert.ok(!/Bluetooth page|Settings →/.test(gear.BLUETOOTH_PAYWALL), 'the purchase page sends somebody who has not paid to a page they cannot open yet')
    assert.match(gear.POWER_LINE, /charger or power bank/, 'the power the purchase page names is not the list’s')
    assert.ok(!/\$|price|\d+\.\d\d/i.test(gear.BLUETOOTH_PAYWALL), 'the purchase page’s line names a price')

    /* Wherever it is offered, from the gear file and never typed again. */
    const page = flat('mobile/src/screens/Bluetooth.js')
    /* At the foot of the page since 26 October 2026 ("the connect steps right there at the top before any warnings or anything"), and on What Bluetooth can't do. */
    const main = page.slice(page.indexOf('export default function BluetoothPage('), page.indexOf('function UnitChips('))
    assert.ok(main.indexOf('<Hint>{BLUETOOTH_WAYS}</Hint>') > main.indexOf('<Heading>2 · Connect</Heading>'), 'the page does not say the two ways under the steps')
    assert.ok(page.slice(page.indexOf('export function BluetoothLimits(')).includes('<Hint>{BLUETOOTH_WAYS}</Hint>'), 'What Bluetooth can’t do does not say the two ways')
    assert.match(flat('mobile/src/screens/Settings.js'), /: BLUETOOTH_ROW_OFF\}/, 'the Settings row does not say it')
    assert.match(flat('mobile/src/screens/Settings.js'), /not through the computer\. \$\{BLUETOOTH_WAYS\}`/, 'Phone & computer does not say it while Bluetooth is on')
    assert.match(flat('mobile/App.js'), /sub=\{BLUETOOTH_WAYS_SHORT\}/, 'the waiting screen’s way in does not say it')
    const paywall = flat('mobile/src/screens/Paywall.js')
    assert.match(paywall, /\{openForCustomersHere\(\) && bluetoothSupported\(\) \? \( <Text[^>]*> \{BLUETOOTH_PAYWALL\} <\/Text> \) : null\}/, 'the purchase page offers Bluetooth on a copy that cannot open it, or not at all')
    for (const f of ['mobile/src/screens/Bluetooth.js', 'mobile/src/screens/Settings.js', 'mobile/App.js', 'mobile/src/screens/Paywall.js', 'mobile/src/screens/Fixes.js', 'mobile/src/components/NoComputer.js']) {
      assert.ok(!/two ways to connect|(slower|more lag) than the computer|no computer needed, more lag|AM4 only for now ·|Opens Apple’s Bluetooth screen|best (?:one|way)|more lag and/i.test(code(f)), `${f} types the words out again instead of taking them from the gear file or shared/no-computer.mjs`)
    }
    /*
     * AND THE OTHER TWO PLACES THE WORDING LIVES, held to the same three
     * things: the no-computer note and Fixes (shared/no-computer.mjs
     * NO_COMPUTER_BLUETOOTH), and the setup email (secondWay in
     * supabase/functions/setup-reminder). Each says it in its own words, for
     * its own place, so a change to how Bluetooth is presented is made in
     * all three (CLAUDE.md names them); this is what keeps one from being
     * left saying something else.
     */
    const { NO_COMPUTER_BLUETOOTH } = await import('../shared/no-computer.mjs')
    const email = src('supabase/functions/setup-reminder/index.ts').match(/const secondWay = `([^`]*)`/)?.[1] ?? ''
    assert.ok(email.length > 100, 'the setup email’s Bluetooth paragraph was not found; this check needs telling')
    for (const [where, words] of [['the gear file’s sentence', gear.BLUETOOTH_WAYS], ['the no-computer note and Fixes', NO_COMPUTER_BLUETOOTH], ['the setup email', email]]) {
      assert.match(words, /The computer is (?:still )?the best (?:one|way)/, `${where} does not say the computer is the best way`)
      assert.match(words, /more lag/, `${where} does not say Bluetooth has more lag`)
      assert.match(words, /fewer features|does less/, `${where} does not say Bluetooth does less`)
    }
  })

  test('the log’s head says which store copy this is, whether a customer would see Bluetooth on it only where that is no secret, and names the adapter, never its address', async () => {
    /*
     * His own account sees Bluetooth on every copy, so without this nothing
     * he can read shows the built-in version being read right on a real
     * phone, long before a customer's Bluetooth depends on it. Not optional:
     * his next log from each phone says it.
     */
    const head = flat('mobile/src/lib/logHead.js')
    assert.match(head, /'store copy': `\$\{builtInVersion\(\) \|\| 'not readable'\}\$\{forCustomers\(\)\}`/, 'the log’s head does not say the store copy')
    /*
     * The Bluetooth half only where it is no secret: on a copy that opens it,
     * and on his account. A customer's paste on a closed copy says the number
     * alone, never "Bluetooth for customers: closed", which names a feature
     * their copy's review notes say they are not shown.
     */
    assert.match(head, /const forCustomers = \(\) => \(openForCustomersHere\(\) \? ' · Bluetooth for customers: open' : bluetoothAdmin\(\) \? ' · Bluetooth for customers: closed' : ''\)/, 'a customer’s log says Bluetooth is closed for customers, or his does not say it')
    assert.ok(head.indexOf("'store copy'") > head.indexOf('app: `Fractal Remote (phone)'), 'the store copy is not beside the update’s version')
    /* On a bench: the built-in version as the copy says it, closed for customers on every copy today, and his account known for the closed half alone. */
    const { ADMINS } = await import('../shared/admin.mjs')
    for (const [installed, says] of [['1.88.3', '1.88.3'], [null, null]]) {
      const bench = await bluetoothOnABench({ mod: iphoneModule('allowedAlways').mod, installed })
      try {
        assert.equal(bench.ble.builtInVersion(), says)
        assert.equal(bench.ble.openForCustomersHere(), false)
        assert.equal(bench.ble.bluetoothAdmin(), false, 'nobody known is taken for his account')
        bench.ble.allowBluetooth('0b6c7a51-8f1e-4c2a-9d3b-5e7f9a1c2d4e')
        assert.equal(bench.ble.bluetoothAdmin(), false, 'a customer is taken for his account')
        bench.ble.allowBluetooth(ADMINS[0])
        assert.equal(bench.ble.bluetoothAdmin(), true, 'his account is not known as his')
      } finally {
        bench.done()
      }
    }
    const open = await bluetoothOnABench({ mod: iphoneModule('allowedAlways').mod, installed: '1.89.0', from: { ios: '1.89.0', android: '1.89.0' } })
    try {
      assert.equal(open.ble.openForCustomersHere(), true)
      /* The adapter by name, never by the address Android falls back to; nothing at all when that is all there is. */
      assert.equal(open.ble.adapterName({ id: 'AA:BB:CC:DD:EE:FF', name: 'WIDI Uhost Bluetooth' }), 'WIDI Uhost Bluetooth')
      assert.equal(open.ble.adapterName({ id: 'AA:BB:CC:DD:EE:FF', name: 'AA:BB:CC:DD:EE:FF' }), null)
      assert.equal(open.ble.adapterName({ id: 'AA:BB:CC:DD:EE:FF', name: '' }), null)
      assert.equal(open.ble.adapterName(null), null)
      open.ble.chooseAdapter({ id: 'AA:BB:CC:DD:EE:FF', name: 'AA:BB:CC:DD:EE:FF' })
      assert.ok(open.log.some((l) => l.includes('adapter chosen: an adapter with no name')), 'the log does not say an adapter with no name was chosen')
      assert.ok(!open.log.some((l) => l.includes('AA:BB:CC:DD:EE:FF')), 'the log names the adapter by its Bluetooth address')
    } finally {
      open.done()
    }
    const link = flat('mobile/src/lib/bleLink.js')
    assert.match(link, /const name = adapterName\(s\.adapter\) \|\| 'the Bluetooth adapter'/, 'the link names the adapter by whatever the module gave, its address included')
    assert.match(link, /const name = adapterName\(e\) \|\| adapterName\(s\.adapter\) \|\| 'the Bluetooth adapter'/)
    assert.ok(!/dev\.name \|\| dev\.id/.test(code('mobile/src/lib/bluetooth.js')), 'lib/bluetooth logs the adapter’s address when it has no name')
  })

  test('Reconnect: on an iPhone whose adapter has gone, the page and Look again open Apple’s screen straight away, and nowhere else', async () => {
    /*
     * An iPhone lets an unused Bluetooth link go after a few minutes
     * (Apple's QA1831): a phone locked between songs. bleLink does not ask
     * an offline port, and only Apple's screen can connect it again, so it
     * was Stop, Connect and the screen. Now one tap: Reconnect on the page,
     * and the waiting screen's and Phone & computer's Look again.
     */
    const { ADMINS } = await import('../shared/admin.mjs')
    const JUSTIN = ADMINS[0]
    const disk = { 'fractal.bluetooth': JSON.stringify({ on: true, unit: 'am4', adapter: { id: 'p1', name: 'WIDI Uhost Bluetooth' } }) }
    const iphone = (list, extra = {}) => {
      const asked = []
      const mod = { supported: () => true, devices: () => list, authorization: () => 'allowedAlways', pair: async () => void asked.push('pair'), addListener: () => ({ remove() {} }), ...extra }
      return { mod, asked }
    }
    const ADAPTER = { id: 'p1', name: 'WIDI Uhost Bluetooth', driver: 'Apple' }
    const cases = [
      ['not in the list', { list: [] }, true],
      ['listed offline', { list: [{ ...ADAPTER, offline: true }] }, true],
      ['connected', { list: [ADAPTER] }, false],
      ['on Android', { list: [], os: 'android' }, false],
      ['on iOS 27, before the build with Apple’s fix', { list: [], version: 27 }, false],
      ['on iOS 27, with Apple’s fix', { list: [], version: 27, extra: { pairsOnIOS27: () => true } }, true]
    ]
    for (const [what, { list, os = 'ios', version = 18, extra = {} }, opens] of cases) {
      const { mod, asked } = iphone(list, extra)
      const bench = await bluetoothOnABench({ os, version, mod, disk })
      try {
        assert.equal(bench.ble.allowBluetooth(JUSTIN), true)
        assert.equal(await bench.ble.restoreBluetooth(), true)
        /* What the button says under itself is the same question as what the tap does. */
        assert.equal(bench.ble.opensApplesScreen(), opens, `the adapter ${what}: the button ${opens ? 'does not say' : 'says'} Apple’s screen opens`)
        let poked = 0
        await bench.ble.lookForAdapterAgain(() => poked++)
        assert.deepEqual(asked, opens ? ['pair'] : [], `the adapter ${what}: Apple’s screen ${opens ? 'did not open' : 'opened'}`)
        assert.equal(poked, 1, `the adapter ${what}: the link was not asked to look again`)
      } finally {
        bench.done()
      }
    }
    /*
     * EVERY BUTTON THAT OPENS APPLE'S SCREEN SAYS SO UNDER ITSELF, and what to
     * do there, in the page's own words, once (lib/bluetooth
     * APPLE_SCREEN_OPENS): tapped before Connected, Done leaves the adapter
     * unconnected, and nothing on the waiting screen said the screen would
     * open at all.
     */
    const ble = src('mobile/src/lib/bluetooth.js')
    assert.match(ble, /export const APPLE_SCREEN_OPENS = 'Opens Apple’s Bluetooth screen: tap your adapter, wait for Connected, then Done\.'/)
    assert.match(ble, /export const opensApplesScreen = \(\) => adapterAway\(\) && !pairScreenShut\(\)/)
    assert.match(ble, /export async function lookForAdapterAgain\(poke\) \{\n  if \(opensApplesScreen\(\)\) \{/, 'the tap and the words under the button ask different questions')
    /* The page: Reconnect while it is on and away, over Stop, and never while Apple's screen is kept shut. */
    const page = flat('mobile/src/screens/Bluetooth.js')
    assert.match(page, /const reconnect = \(\) => lookForAdapterAgain\(probeNow\)/)
    assert.match(page, /\{away \? <Press label="Reconnect" tone="live" sub=\{APPLE_SCREEN_OPENS\} onPress=\{reconnect\} \/> : null\}/)
    const onHalf = page.slice(page.indexOf('{b.on ? ( <View'), page.indexOf(') : ( <View style={{ gap: space.lg }}>'))
    assert.ok(onHalf.indexOf('label="Reconnect"') > 0 && onHalf.indexOf('label="Reconnect"') < onHalf.indexOf('label="Stop using Bluetooth"'), 'Reconnect is not over Stop while it is on')
    /* And the hint over it says to check the adapter first: a power bank that switched itself off leaves Apple's screen empty on every tap. */
    assert.match(page, /: away \? `The adapter isn’t connected to this \$\{deviceNoun\(\)\} now\. Check it is plugged in and lit, then tap Reconnect\.`/)
    /* The waiting screen's Look again, and Phone & computer's. */
    const waking = flat('mobile/App.js').slice(flat('mobile/App.js').indexOf('function Waking('))
    assert.match(waking, /<Press label="Look for the adapter again" sub=\{opensApplesScreen\(\) \? APPLE_SCREEN_OPENS : undefined\} onPress=\{\(\) => lookForAdapterAgain\(onRetry\)\} \/>/, 'the waiting screen’s Look again opens Apple’s screen without saying so')
    assert.match(flat('mobile/src/screens/Settings.js'), /label=\{throughAdapter \? 'Look for the adapter again' : 'Look for the computer again'\} sub=\{throughAdapter && opensApplesScreen\(\) \? APPLE_SCREEN_OPENS : undefined\}/, 'Phone & computer’s Look again opens Apple’s screen without saying so')
    /* Never for a watch tap or anything that is not a hand on a screen: link.js's own poke is untouched. */
    assert.match(flat('mobile/src/lib/link.js'), /export function probeNow\(\) \{ \/\*[^*]*\*\/ if \(bluetoothOn\(\) && !isDemo\(\)\) return pokeBluetooth\(\)/)
    assert.ok(!/findAdapters|lookForAdapterAgain/.test(code('mobile/src/lib/link.js') + code('mobile/src/lib/bleLink.js')), 'the link opens Apple’s screen by itself')
  })

  test('the cable is never for an FM3: said when the FM3 is picked and where the cables are bought, and nobody is told the AM4 only', async () => {
    const page = flat('mobile/src/screens/Bluetooth.js')
    /*
     * Under the units only when the FM3 is picked (Justin, 26 October 2026:
     * "if they select FM3, why we wanna give the warning"), and for every
     * other unit where the C2MIDI Pro and the WIDI Master are bought, on How
     * to connect my Bluetooth device.
     */
    const step1 = page.slice(page.indexOf('<Heading>1 · Pick your unit</Heading>'), page.indexOf('<Heading>2 · Connect</Heading>'))
    assert.match(step1, /\{b\.unit === 'fm3' \? <Note tone="fault">\{FM3_NEVER\}<\/Note> : null\}/)
    assert.match(page, /\{unit !== 'fm3' && \(way\.key === 'uhost' \|\| way\.key === 'master'\) \? <Hint>\{NOT_FOR_FM3\}<\/Hint> : null\}/)
    const gear = await import('../shared/bluetooth-gear.mjs')
    assert.equal(gear.NOT_FOR_FM3, 'On an FM3, use the CME U2MIDI Pro, never the C2MIDI Pro or a WIDI Master: both got very hot on one.')
    /* The customer's "AM4 only" is gone everywhere: every unit opens together (lib/ble-rule.js UNITS_FROM_STORE). */
    assert.equal(gear.AM4_ONLY, undefined, 'the gear file still has the customer’s AM4-only line')
    assert.ok(!/AM4_ONLY|am4Only|AM4 only/.test(code('mobile/src/screens/Bluetooth.js')), 'the page still says the AM4 only to somebody')
    /* Connected, the unit silent: the plugs. */
    /* Shorter since 30 October 2026 ("too much to read everywhere you go"): the plugs on the page, an adapter that carries one way in Troubleshooting. */
    assert.match(page, /\{quiet \? <Hint>\{PLUGS_CHECK\}<\/Hint> : null\}/, 'a unit that does not answer is not told about the plugs')
    /*
     * Nothing tells anybody to pick a unit by name in step 1 but the wrong
     * unit's line, which is handed whether this account is offered it
     * (wrongUnitLine's `pickable`, run in its own test).
     */
    assert.ok(!/in step 1, then tap Connect/.test(page), 'the page words a pick in step 1 of its own, outside wrongUnitLine')
    assert.ok(!/pick (the )?(FM3|FM9|Axe-Fx III|VP4)/.test(page), 'the page sends somebody to pick a unit by name outside wrongUnitLine')
    assert.match(page, /pickable: units\.some\(\(u\) => u\.name === b\.answeredAs\)/)
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
    /*
     * Not on without a unit, not on where it cannot work, and not on for an
     * account it is not open to — at the switch and at launch. The account
     * is asked before the module, so a refused phone's module is never asked
     * anything. A yes, at the switch and at launch: with no answer yet the
     * pick-up holds the on (pendingOn) and the yes switches it on, so his
     * phone left on Bluetooth still starts on Bluetooth.
     */
    /*
     * And not on with a unit this account is not offered (lib/ble-rule.js
     * unitOffered: the AM4 alone for a customer), at the switch and at
     * launch, where a unit kept from before that it is not offered is let go
     * of. Changed on purpose on 25 October 2026 with the AM4-only rule.
     */
    assert.match(ble, /const want = on === true && allowed === true && !!saved\.unit && offered\(saved\.unit\) && bluetoothSupported\(\)/)
    assert.match(ble, /saved = \{ \.\.\.was, unit: dropped \? null : was\.unit, on: was\.on && !!was\.unit && !dropped && allowed === true && bluetoothSupported\(\) \}/, 'a build without the module, or an account not yet known to be his, comes back with Bluetooth on')
    assert.match(ble, /pendingOn = was\.on && !!was\.unit && allowed === null/, 'the pick-up does not hold an on for the answer')
  })

  test('the page offers the units this account may pick (all five in that order, the VP4 last), with none of them chosen', async () => {
    const { BLE_UNITS } = await import(WIRE)
    assert.deepEqual(BLE_UNITS.map((u) => u.name), ['AM4', 'FM3', 'FM9', 'Axe-Fx III', 'VP4'])
    const page = flat('mobile/src/screens/Bluetooth.js')
    /*
     * The chips are what lib/bluetooth offers this account (offeredUnits),
     * not the whole of BLE_UNITS: changed on purpose on 25 October 2026,
     * when a customer was to get the AM4 alone (every unit since, keyed to
     * the store version: lib/ble-rule.js). The bench test of the store copy
     * holds what offeredUnits answers.
     */
    assert.match(page, /const units = offeredUnits\(\) const vp4 = b\.unit === 'vp4'/)
    /*
     * Just the names, since 31 October 2026: "Not tried yet" under the units
     * nobody here had run it on is gone, and the record is on Developer →
     * App health → Tried ("we just need to keep track of it ourselves in the
     * developer menu", Justin).
     */
    assert.match(page, /\{units\.map\(\(u\) => \( <Press key=\{u\.key\} label=\{u\.name\} tone="signal" on=\{u\.key === picked\} disabled=\{disabled\} height=\{44\}/)
    assert.match(page, /<UnitChips units=\{units\} picked=\{b\.unit\} disabled=\{b\.on\} \/>/)
    /* Connect cannot be pressed before a unit is picked, nor by somebody who has not unlocked the app. */
    assert.match(page, /const canStart = !!b\.unit && paid/)
    assert.match(page, /tone="live" disabled=\{!canStart \|\| b\.looking\} onPress=\{start\}/, 'Connect can be pressed with no unit picked')
    /* And the unit cannot be changed while it is on: one mis-tap would send another unit's messages to the one on the adapter. */
    assert.match(page, /on=\{u\.key === picked\} disabled=\{disabled\}/, 'the unit can be changed while connected')
    assert.equal((page.match(/<UnitChips units=\{units\} picked=\{b\.unit\} disabled=\{b\.on\} \/>/g) || []).length, 2, 'a unit chip somewhere can be changed while connected')
    /*
     * CHANGED ON PURPOSE, 24 October 2026: "It would be cool if, like, a
     * five-year-old could connect it." The units used to stay on the page
     * while it was on, greyed, with "To change the unit, tap Stop first."
     * under them. Now step 1 is only drawn while it is off, inside the off
     * half of the one ternary that draws Stop in its on half; a line over
     * Stop names the unit while it is on. disabled={b.on} stays, so a tap in
     * the moment it turns on still goes nowhere.
     *
     * Each half read on its own: the whole ternary in one slice let a second
     * copy of the chips under Stop pass, since only the first copy was
     * looked at.
     */
    const ternary = page.slice(page.indexOf('{b.on ? ( <View'), page.indexOf('{/* Not under a trouble line'))
    const cut = ternary.indexOf(') : ( <View style={{ gap: space.lg }}>')
    assert.ok(cut > 0, 'the on/off ternary could not be split; this read is probably broken')
    const [onPart, offPart] = [ternary.slice(0, cut), ternary.slice(cut)]
    assert.ok(onPart.includes('<Press label="Stop using Bluetooth"'), 'Stop is not in the on half')
    assert.ok(!onPart.includes('<UnitChips '), 'the units are drawn while it is on')
    assert.ok(offPart.includes('<UnitChips '), 'the units are not drawn while it is off')
    assert.equal((page.match(/units\.map\(/g) || []).length, 1, 'the unit chips are drawn in more than one place')
    /* Every unit there is only on the Developer page's record of what was tried (BluetoothTried), which only his account opens. */
    assert.ok(!/BLE_UNITS\.map\(/.test(page.slice(0, page.indexOf('export function BluetoothTried('))), 'the page draws every unit there is, not the ones this account is offered')
    assert.equal((page.match(/BLE_UNITS\.map\(/g) || []).length, 1, 'every unit there is is drawn somewhere besides the Developer record')
    assert.ok(!page.includes('To change the unit, tap Stop first.'), 'a hint for units that are no longer drawn while it is on')
    /* What stopped the search shows with the switch off too; and the wrong unit answering says what to do. */
    const status = page.slice(page.indexOf('function status('), page.indexOf('const TONES'))
    assert.ok(status.indexOf("b.trouble === 'bluetooth-off'") < status.indexOf("if (!b.on) return { line: 'Not connected'"), 'the switch being off hides why the search failed')
    /*
     * Sent to pick the unit that answered only when this account can pick
     * it: never a customer to a unit they are not offered. The words are
     * shared/bluetooth-gear wrongUnitLine's, run for every pairing in its
     * own test; the page hands it what step 1 offers this account.
     */
    assert.match(status, /if \(b\.answeredAs\) \{ const units = offeredUnits\(\) return \{ line: wrongUnitLine\(\{ answered: b\.answeredAs, picked: name, pickable: units\.some\(\(u\) => u\.name === b\.answeredAs\) \}\), tone: 'fault' \}/)
    /* A VP4 never answers over Bluetooth: its connected line says the phone is sending, never "answering" (lib/bleVp4.js). */
    assert.match(status, /if \(b\.unit === 'vp4'\) return \{ line: VP4_CONNECTED, tone: 'ok' \} if \(unitState === 'present'\) return \{ line: `Connected · \$\{name\} answering`, tone: 'ok' \}/)
    assert.ok(!/in step 1, then tap Connect/.test(status), 'another line sends somebody to step 1 for a unit')
  })

  test('the Bluetooth page says plainly what is different from USB, and names an adapter maker only in what to buy', async () => {
    const page = src('mobile/src/screens/Bluetooth.js')
    for (const line of [
      'No editing or saving over Bluetooth.',
      'Slower to load the preset list.',
      'Footswitch changes may take a moment to show.',
      'About 30 feet of range.',
      'The adapter connects to one thing at a time.',
      'On the AM4, scene names take a moment the first time a preset is seen.',
      'No looper, volume button, unit metronome click or Footswitches page.'
    ]) {
      assert.ok(page.includes(`'${line}'`), `the page does not say: ${line}`)
    }
    /* After the two steps now: "a lot of different buttons to press" put setting it up first. */
    assert.ok(page.indexOf('2 · Connect') < page.indexOf('What’s different from USB'), 'the list is above the steps again')
    /*
     * THE MAKER, NAMED IN ONE PLACE AND FOR ONE REASON. This used to forbid
     * "CME" and "WIDI" anywhere in the app's own text, so that the app
     * talked about "the adapter", never one brand of it, and showed the
     * adapter's own name only as the adapter gave it — any Bluetooth MIDI
     * adapter is meant to work, and the link must never pick one by its
     * name. Then: "We need a CME Widi host. And then for the AM4 I use these
     * as well. Maybe we could add these with the Amazon links on how to buy
     * them?" So the parts he uses are named — in the gear file, which the
     * page's What to buy draws — and changed on purpose here. Everything
     * that finds, chooses, connects or talks to the adapter still names no
     * maker, and the page itself has no maker's name typed into it: every
     * one comes from the gear file.
     */
    for (const p of [
      'mobile/src/screens/Bluetooth.js',
      'mobile/src/screens/Settings.js',
      'mobile/App.js',
      'mobile/src/lib/bluetooth.js',
      'mobile/src/lib/bleLink.js',
      'mobile/src/lib/bleAdapters.js',
      'mobile/src/lib/bleWire.js'
    ]) {
      assert.ok(!/\bCME\b|WIDI/i.test(code(p)), `${p} names an adapter maker`)
    }
    assert.match(code('shared/bluetooth-gear.mjs'), /name: 'CME WIDI Uhost'/, 'the part he uses is not named where it is bought')
    /* The status line, in his words. */
    /* By unit since 25 October 2026 (shared/bluetooth-gear notAnsweringLine): the Axe-Fx III has no MIDI Thru setting, only a THRU jack to keep the white plug out of. */
    assert.match(page, /if \(unitState === 'missing' \|\| unitState === 'silent'\) return \{ line: notAnsweringLine\(b\.unit\), tone: 'fault' \}/)
    const gearWords = await import('../shared/bluetooth-gear.mjs')
    assert.equal(gearWords.notAnsweringLine('fm9'), 'Adapter connected, but the FM9 isn’t answering. Check both MIDI plugs, and that MIDI Thru is off.')
    assert.equal(gearWords.notAnsweringLine('axefx3'), 'Adapter connected, but the Axe-Fx III isn’t answering. Check both MIDI plugs: the white one goes in MIDI OUT, not THRU.')
    assert.match(page, /if \(b\.trouble === 'permission'\) return \{ line: ALLOW_WORDS, tone: 'fault' \}/)
    /* For the device in hand, changed on purpose on 25 October 2026 from "the phone’s settings". */
    assert.match(page, /`Turn on Bluetooth in the \$\{deviceNoun\(\)\}’s settings`/)
    /*
     * Android 11 and older asks for Location, not Nearby devices, and finds
     * nothing while Location is off; the words follow the phone, and an
     * empty search is said rather than ending in silence.
     */
    const lib = src('mobile/src/lib/bluetooth.js')
    assert.match(lib, /const OLD_ANDROID = Platform\.OS === 'android' && Number\(Platform\.Version\) < 31/)
    assert.match(lib, /\? 'Allow Location for Fractal Remote in Android’s settings, and turn Location on'\s*: 'Allow Nearby devices for Fractal Remote in Android’s settings'/)
    assert.match(lib, /if \(!saved\.adapter && !now\.devices\.length\) \{/, 'an Android search that finds nothing ends in silence')
    assert.match(lib, /Location has to be on for it to find one/)
    /* The iPhone's "nothing connected" says where Bluetooth is allowed, and a one-way adapter is named as the likely cause. */
    assert.match(page, /'No adapter was connected\. Check Bluetooth is on and allowed for Fractal Remote, then tap Connect again\.'/)
    assert.match(page, /The adapter has to carry MIDI both ways\./)
  })

  /*
   * "iPhone App crashed when trying to enable Bluetooth." (24 October 2026,
   * TestFlight 1.88.0 (28), iOS 27.0.1.) iOS 27 broke Apple's own Bluetooth
   * MIDI screen in every app: its loadView builds a NaN-tall table. Apple's
   * workaround waits for the next iPhone build as a patch; until then an
   * update keeps the screen shut on iOS 27 and says why.
   */
  test('on iOS 27 Apple’s Bluetooth screen stays shut until a build carries Apple’s fix, which waits as a patch', async () => {
    const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    const { pairScreenCrashes, pairScreenShutWords } = await import('../mobile/src/lib/bleAdapters.js')
    assert.equal(pairScreenCrashes({ os: 'ios', version: '27.0.1', fixed: false }), true, 'Apple’s screen is opened on iOS 27 in a build that crashes there')
    assert.equal(pairScreenCrashes({ os: 'ios', version: '27.1', fixed: undefined }), true, 'a build with no answer is taken for one with the fix')
    assert.equal(pairScreenCrashes({ os: 'ios', version: '27.0.1', fixed: true }), false, 'the fixed build keeps the screen shut')
    assert.equal(pairScreenCrashes({ os: 'ios', version: '26.6.2', fixed: false }), false, 'iOS 26, where the screen works, is kept from it')
    assert.equal(pairScreenCrashes({ os: 'ios', version: '28.0', fixed: false }), true)
    assert.equal(pairScreenCrashes({ os: 'android', version: 36, fixed: false }), false, 'Android has no such screen')
    assert.equal(pairScreenCrashes({ os: 'ios', version: undefined, fixed: false }), false)
    /* The note names the device in hand, as the hint over it does: an iPad on iOS 27 is never sent to "the iPhone". */
    assert.match(pairScreenShutWords('iPad'), /an adapter that is already connected to this iPad\.$/, 'an iPad on iOS 27 is told its adapter must be connected to the iPhone')
    assert.ok(!/iPhone|this phone/.test(pairScreenShutWords('iPad')), 'the note names a device other than the one in hand')
    /* Asked before Apple's screen, the way authorization is: an older build has no such function. */
    const lib = read('mobile/src/lib/bluetooth.js')
    const shutFn = lib.slice(lib.indexOf('export function pairScreenShut()'), lib.indexOf('export async function findAdapters'))
    assert.match(shutFn, /fixed = ble\(\)\?\.pairsOnIOS27\?\.\(\) === true/, 'the build’s own answer is not asked for')
    assert.match(shutFn, /return pairScreenCrashes\(\{ os: Platform\.OS, version: Platform\.Version, fixed \}\)/)
    const ios = lib.slice(lib.indexOf("if (Platform.OS === 'ios') {", lib.indexOf('export async function findAdapters')))
    const guard = ios.indexOf('if (pairScreenShut()) {')
    assert.ok(guard > 0 && guard < ios.indexOf('await mod.pair()'), 'Apple’s screen is opened before anything asks whether it crashes')
    assert.match(ios.slice(guard, ios.indexOf('await mod.pair()')), /if \(pick\) chooseAdapter\(pick\)\s*else noteBluetooth\(\{ said: pairScreenShutWords\(deviceNoun\(\)\) \}\)\s*return pick/, 'the page does not say why the screen stays shut, names some other device, or says it over an adapter it chose')
    /* And no hint on the page sends anybody to the screen while it is shut, nor the red "nothing connected" line under the note that says why. */
    const page = flat('mobile/src/screens/Bluetooth.js')
    assert.match(page, /const shut = pairScreenShut\(\)/)
    assert.match(page, /: shut \? `On iOS 27, Apple’s Bluetooth screen stays closed until the next build of the app\. Connect uses an adapter that is already connected to this \$\{deviceNoun\(\)\}\.` : ios \? 'In Apple’s screen, tap your adapter/, 'an iPad on iOS 27 is told its adapter must be connected to the iPhone')
    assert.match(page, /\{shut \? 'If this stays here, tap Stop, check the adapter is plugged in and lit, then tap Connect\.' : away \?/)
    /* Reconnect, which opens Apple's screen, is never offered while it is shut. */
    assert.match(page, /const away = b\.on && b\.phase === 'connecting' && ios && !shut && adapterAway\(\)/)
    assert.match(page, /\{!b\.on && missed && !b\.adapter && !b\.trouble && !b\.said \? \(/, 'the line sending him to Apple’s screen is drawn over the note saying it stays shut')
    assert.match(page, /\{shut && b\.said \? null : \( <Hint>/, 'the hint under Connect repeats the note under it on iOS 27')

    /*
     * The native half waits for a build: Apple's workaround, device side, and
     * the answer the JavaScript asks for. Read from the patch while it waits,
     * and from the module once it is applied and the patch is deleted in the
     * same change (docs/pending/README.md), so this holds the Swift itself
     * from build day on.
     */
    const waiting = existsSync(new URL('../docs/pending/ble-pair-ios27.patch', import.meta.url))
    const patch = waiting ? read('docs/pending/ble-pair-ios27.patch') : ''
    const added = waiting
      ? patch.split('\n').filter((l) => l.startsWith('+')).map((l) => l.slice(1)).join('\n')
      : read('mobile/modules/fractal-ble-midi/ios/FractalBleMidiModule.swift')
    assert.match(added, /if #available\(iOS 27, \*\) \{\s*central\.tableView = UITableView\(frame: \.zero, style: \.grouped\)\s*central\.viewDidLoad\(\)\s*\}/, 'Apple’s screen is not handed a table and its search started, as Apple’s workaround does')
    assert.match(added, /Function\("pairsOnIOS27"\) \{ \(\) -> Bool in\s*true\s*\}/, 'the build does not tell the JavaScript it has the fix')
    assert.match(waiting ? patch : added, /central\.viewDidLoad\(\)\s*\+?\s*\}\s*\n\s*let sheet = UINavigationController\(rootViewController: central\)/, 'the workaround is not between making the screen and putting it in its sheet')
    if (waiting) assert.match(read('docs/pending/README.md'), /^\| `ble-pair-ios27\.patch` \|.*\| \*\*iPhone only\*\*/m, 'the README does not say the fix moves only the iPhone')
    /* And duo.yml builds the next build: every waiting patch applied, so the device build compiles this one on Xcode 27.1. */
    const duo = read('.github/workflows/duo.yml')
    const applied = duo.indexOf('name: The waiting patches, applied')
    assert.ok(applied > 0 && applied < duo.indexOf('name: Install'), 'duo.yml builds main without the patches the next build carries')
  })

  test('on iOS 27, Connect leaves Apple’s screen shut in a build without the fix, and opens it in one with it', async () => {
    const { pairScreenShutWords } = await import('../mobile/src/lib/bleAdapters.js')
    /* The bench's device word is the real one (lib/device-word, the same module lib/bluetooth reads): a phone unless a test says otherwise. */
    const deviceWord = await import('../mobile/src/lib/device-word.js')
    const PAIR_SCREEN_IOS27 = pairScreenShutWords('phone')
    const press = async ({ os = 'ios', version, fixed, devices = [] }) => {
      const { mod, asked } = iphoneModule('allowedAlways')
      mod.devices = () => devices
      if (fixed !== undefined) mod.pairsOnIOS27 = typeof fixed === 'function' ? fixed : () => fixed
      const bench = await bluetoothOnABench({ os, version, mod })
      try {
        const shut = bench.ble.pairScreenShut()
        const pick = await bench.ble.findAdapters()
        const { said, adapter } = bench.ble.useBluetooth()
        return { shut, pick, said, adapter, asked: [...asked] }
      } finally {
        bench.done()
      }
    }
    /* 1.88.0 (28) on iOS 27.0.1, which has no pairsOnIOS27: the screen that crashed is never opened, and the note says why. */
    for (const fixed of [undefined, false, 1, () => { throw new Error('no') }]) {
      const got = await press({ version: '27.0.1', fixed })
      assert.equal(got.shut, true)
      assert.deepEqual(got.asked, [], `Apple’s screen opened on iOS 27 in a build without the fix (${typeof fixed === 'function' ? 'a module that throws' : fixed})`)
      assert.equal(got.said, PAIR_SCREEN_IOS27, 'nothing says why Connect did nothing')
      assert.equal(got.pick ?? null, null)
      assert.equal(got.adapter ?? null, null)
    }
    /* On an iPad (the device word set as lib/thisDevice sets it), the same note names the iPad. */
    deviceWord.setDevice('ipad')
    try {
      const pad = await press({ version: '27.0.1' })
      assert.equal(pad.said, pairScreenShutWords('iPad'), 'an iPad on iOS 27 is told its adapter must be connected to some other device')
    } finally {
      deviceWord.setDevice('phone')
    }
    /* An adapter iOS already has connected is used, as after Apple's screen, and no warning stays up over it. */
    const one = await press({ version: '27.0.1', devices: [{ id: 'a:b', name: 'WIDI Uhost Bluetooth' }] })
    assert.deepEqual(one.asked, [])
    assert.equal(one.pick?.id, 'a:b', 'the one adapter already connected is not handed back')
    assert.equal(one.adapter?.id, 'a:b', 'the one adapter already connected is not chosen')
    assert.equal(one.said, null, 'the warning stays up over an adapter it chose')
    /* Two to pick from: the list asks, and the note says why the screen did not open. */
    const two = await press({ version: '27.1', devices: [{ id: 'a', name: 'One' }, { id: 'b', name: 'Two' }] })
    assert.deepEqual(two.asked, [])
    assert.equal(two.pick ?? null, null)
    assert.equal(two.adapter ?? null, null, 'one of two adapters was chosen without a tap')
    assert.equal(two.said, PAIR_SCREEN_IOS27)
    /*
     * And tapping one of them ends the note: it is about the search, and left
     * up it sat under "Connected" for the rest of the session.
     */
    {
      const { mod } = iphoneModule('allowedAlways')
      mod.devices = () => [{ id: 'a', name: 'One' }, { id: 'b', name: 'Two' }]
      const bench = await bluetoothOnABench({ version: '27.0.1', mod })
      try {
        await bench.ble.findAdapters()
        assert.equal(bench.ble.useBluetooth().said, PAIR_SCREEN_IOS27)
        bench.ble.chooseAdapter({ id: 'b', name: 'Two' })
        assert.equal(bench.ble.useBluetooth().adapter?.id, 'b')
        assert.equal(bench.ble.useBluetooth().said, null, 'the search’s note stays up after an adapter was chosen')
      } finally {
        bench.done()
      }
    }
    /* The next build, with Apple's fix, says so, and the screen opens; iOS 26, where it never crashed, opens it as before. */
    for (const [version, fixed] of [['27.0.1', true], ['26.6.2', undefined], ['18.5', false]]) {
      const got = await press({ version, fixed })
      assert.equal(got.shut, false)
      assert.deepEqual(got.asked, ['pair'], `Apple’s screen did not open on iOS ${version}${fixed ? ' with the fix' : ''}`)
      assert.equal(got.said, null)
    }
    /* Android has no such screen, whatever its version. */
    const { mod } = iphoneModule(undefined)
    const android = await bluetoothOnABench({ os: 'android', version: 36, mod })
    try {
      assert.equal(android.ble.pairScreenShut(), false)
    } finally {
      android.done()
    }
  })

  test('setting it up is two steps and one button, and the phone picks the adapter when only one could be meant', async () => {
    /*
     * "Setting up the Bluetooth is kind of weird. A lot of different buttons
     * to press. Maybe we can make it a little easier. It was very confusing
     * for me, but I did figure it out finally."
     */
    const { isNetworkSession, pickAdapter } = await import('../mobile/src/lib/bleAdapters.js')
    const session = { id: '1:2', name: 'Network Session 1', driver: 'com.apple.AppleMIDIRTPDriver' }
    const adapter = { id: '3:4', name: 'WIDI Uhost Bluetooth', driver: 'com.apple.AppleMIDIBluetoothDriver' }
    const other = { id: '5:6', name: 'Another adapter' }
    /* Apple's Wi-Fi MIDI is never an adapter: on the first AM4 test it was picked and answered nothing. */
    assert.equal(isNetworkSession(session), true)
    assert.equal(isNetworkSession({ id: '1:2', name: 'Network Session 2' }), true, 'told only by its driver')
    assert.equal(isNetworkSession({ id: '1:2', name: 'Studio', driver: 'com.apple.AppleMIDIRTPDriver' }), true, 'told only by its name')
    assert.equal(isNetworkSession(adapter), false)
    /* The AM4 test's own list: the session and the adapter. The adapter, without asking. */
    assert.equal(pickAdapter([session, adapter]), adapter, 'the phone asks which one when only one is an adapter')
    /* The one just connected in Apple's screen, even with another one there. */
    assert.equal(pickAdapter([adapter, other], new Set([other.id])), other)
    /* Two, and nothing new: a real question, so the list asks it. */
    assert.equal(pickAdapter([adapter, other]), null, 'the phone guessed between two adapters')
    assert.equal(pickAdapter([adapter, other], new Set([adapter.id, other.id])), null, 'the phone guessed between two new adapters')
    /* One that is not connected to this phone is not picked, and nothing is nothing. */
    assert.equal(pickAdapter([{ ...adapter, offline: true }]), null)
    assert.equal(pickAdapter([]), null)
    assert.equal(pickAdapter(null), null)

    /* lib/bluetooth offers nothing that is not an adapter, and chooses when the picker says so. */
    const ble = flat('mobile/src/lib/bluetooth.js')
    assert.match(ble, /return Array\.isArray\(list\) \? list\.filter\(isAdapter\) : \[\]/, 'the Wi-Fi session is offered as an adapter again')
    assert.match(ble, /const rows = \(Array\.isArray\(list\) \? list : \[\]\)\.filter\(isAdapter\)/, 'the list the page draws offers the Wi-Fi session')
    assert.match(ble, /const pick = pickAdapter\(list, fresh\) if \(pick\) chooseAdapter\(pick\) return pick/, 'after Apple’s screen the adapter is not chosen by itself')
    assert.match(ble, /const pick = saved\.adapter \? null : pickAdapter\(now\.devices\) if \(pick\) chooseAdapter\(pick\)/, 'after an Android search the only adapter is not chosen by itself')

    /* The page: step 1 the unit, step 2 Connect; Stop once it is on; the list only for a real choice. */
    const page = flat('mobile/src/screens/Bluetooth.js')
    assert.ok(page.indexOf('1 · Pick your unit') < page.indexOf('2 · Connect'), 'the steps are out of order')
    assert.match(page, /const showList = !b\.on && !b\.adapter && b\.devices\.length > 0/, 'the list shows when there is nothing to choose')
    assert.match(page, /if \(!wanted \|\| !b\.adapter \|\| !b\.unit \|\| b\.on\) return setWanted\(false\) if \(paid\) setBluetooth\(true\)/, 'choosing the adapter does not turn Bluetooth on')
    assert.match(page, /if \(b\.adapter\) setBluetooth\(true\) else find\(\)/, 'Connect with an adapter from last time goes looking again')
    /* Except on an iPhone it is not connected to: Apple's screen is the only way back, so Connect opens it. */
    assert.match(page, /if \(b\.adapter && ios && offlineHere\(b\.adapter\)\) return another\(\)/, 'Connect on an iPhone waits for an offline adapter instead of opening Apple’s screen')
    assert.match(page, /const seen = adapterDevices\(\)\.find\(\(d\) => d\.id === a\.id\) return !seen \|\| !!seen\.offline/)
    assert.match(page, /<Press label="Stop using Bluetooth" sub="Goes back to the computer" height=\{52\} onPress=\{\(\) => setBluetooth\(false\)\} \/>/)
    /* The old buttons are gone from the way through. */
    const drawn = code('mobile/src/screens/Bluetooth.js')
    for (const gone of ['Use Bluetooth: on', 'Use Bluetooth: off', 'Forget this adapter', 'Use this one', '"Disconnect"']) {
      assert.ok(!drawn.includes(gone), `the page has its old button back: ${gone}`)
    }
    /* "Use a different adapter" forgets the one in use first, so Connect cannot come back on with it. */
    assert.match(page, /const another = \(\) => \{ if \(!canStart\) return forgetAdapter\(\) find\(\) \}/)
    /*
     * The check is still there for testing, folded away — and now for
     * Justin's account only. This pinned `b.unit && tools`, which showed the
     * button to every customer once a unit was picked. Changed on purpose:
     * Apple's 2.2 keeps test versions off the store, a reviewer once called a
     * visible test button a "Beta feature" not fit for release, and this
     * panel says "For testing." and offers Write checks that change the unit.
     */
    /* And never for a VP4, which is asked nothing over Bluetooth (lib/bleVp4.js): there is nothing to check. */
    /*
     * The tools moved off the page onto the Developer pages, which only his
     * account is shown (26 October 2026: "move that to the developer menu
     * that only I see"): a row there, and the page behind isAdmin too.
     */
    assert.ok(!/'Testing tools'|<Heading>Check<\/Heading>/.test(page.slice(page.indexOf('export default function BluetoothPage('), page.indexOf('export function BluetoothWays('))), 'the testing tools are back on the Bluetooth page')
    const tools = page.slice(page.indexOf('export function BluetoothTools('))
    assert.equal(page.split('<Heading>Check</Heading>').length - 1, 1, 'the check is drawn in more than one place')
    assert.ok(tools.includes('<Heading>Check</Heading>'), 'the check is not on the testing tools page')
    assert.match(tools, /if \(b\.unit === 'vp4'\) return <Hint>/, 'the tools ask a VP4 something')
    const developer = flat('mobile/src/screens/Settings.js')
    /* On Developer → Testing since 30 October 2026, when ten Developer rows became four. */
    assert.match(developer, /\{page === 'testing' && isAdmin\(account\?\.id\) \? \([^]*?\{bluetoothOffered \? \( <> <Section>Bluetooth check<\/Section> <BluetoothTools \/>/, 'the testing tools page is drawn for somebody other than his account')
    assert.match(developer, /<SetupRow title="Testing" status="View as a new customer, Bluetooth check" onPress=\{\(\) => setPage\('testing'\)\} \/>/)
    assert.ok(developer.indexOf('title="Testing"') > developer.indexOf("{page === 'developer' && isAdmin(account?.id) ? ("), 'the testing row is not on the Developer page')
    /* Settings works admin out as it does for his Developer pages. */
    const settingsFlat = flat('mobile/src/screens/Settings.js')
    assert.match(settingsFlat, /<BluetoothPage purchase=\{purchase\} admin=\{isAdmin\(account\?\.id\)\} onReport=\{onReportBluetooth\} onOpen=\{setPage\} onConnected=\{onBack\} \/>/, 'Settings does not tell the Bluetooth page whose account this is')
    /*
     * Nothing a customer needs is only in there. Every command goes Auto by
     * default, and Auto learns what works in ordinary use, not only in the
     * check: changePreset tries the published way, then the other, and
     * remembers.
     */
    const { DEFAULT_METHODS } = await import(WIRE)
    for (const key of ['scene', 'channel', 'tempo', 'preset', 'tuner']) assert.equal(DEFAULT_METHODS[key], 'auto', `${key} is not Auto unless somebody opens the testing tools`)
    const wireSrc = flat('mobile/src/lib/bleWire.js')
    assert.match(wireSrc, /const found = await trialPreset\(n\) if \(found\) learn\('preset', found\)/, 'a preset change no longer learns the way that works by itself')

    /* And one question wakes a new link, its answer not used, before the rig asks the real ones. */
    const link = flat('mobile/src/lib/bleLink.js')
    const wake = link.indexOf("const woke = await made.request('/device/detect')")
    assert.ok(wake > 0 && wake < link.indexOf('await refreshAll()', wake), 'the rig asks its questions before the link is woken')
  })

  test('over Bluetooth the bar is blue and its lamp is a wireless mark', async () => {
    /*
     * "Can we change the connected thing to be blue when it's on a Bluetooth
     * connection instead of green? And instead of a green dot next to the unit
     * name have a Bluetooth icon when it's connected via Bluetooth."
     * The picture is a plain aerial drawn for the app, not the Bluetooth
     * symbol, which the Bluetooth group lets only its members use
     * (test/independent.mjs holds that one away).
     */
    const bar = flat('mobile/src/components/TopBar.js')
    assert.match(bar, /const bluetooth = useBluetoothOn\(\) && !demo/, 'the demo would wear the Bluetooth look')
    /* In the pill since 24 October 2026, beside the state word, as the lamp is. */
    /* And none in the demo, where it is always grey and says nothing. */
    assert.match(bar, /\{demo \? null : bluetooth \? <BluetoothMark state=\{unitLamp\} \/> : <Lamp state=\{unitLamp\} size=\{8\} \/>\}/, 'the lamp is not the wireless mark over Bluetooth')
    assert.match(bar, /pill\.mark === 'ok' \? \(bluetooth \? color\.ble : color\.ok\)/, 'Live is not blue over Bluetooth')
    /* The mark is lit the way the lamp is: blue answering, red not, dim not yet asked. */
    assert.match(bar, /const tint = state === 'good' \? color\.ble : state === 'fault' \? color\.fault : color\.silkFaint/, 'the mark stays blue over a unit that stopped answering')
    assert.match(bar, /source=\{wirelessIcon\}/)
    assert.match(bar, /import wirelessIcon from '\.\.\/\.\.\/assets\/icons\/wireless\.png'/)
    /* No computer to be missing over Bluetooth, the pill's second line says Bluetooth, and so does a screen reader. */
    const { pillWords } = await import('../shared/pill-words.mjs')
    assert.equal(pillWords({ tone: 'dim', bluetooth: true }).status, 'Not connected', 'the bar says No computer over Bluetooth')
    assert.equal(pillWords({ tone: 'good', unitState: 'present', unit: 'AM4', computer: 'WIDI Uhost', bluetooth: true }).where, 'over Bluetooth', 'the pill names a computer over Bluetooth')
    assert.match(bar, /\[pill\.status, pill\.unit, pill\.where\]\.filter\(Boolean\)\.join\(', '\)/, 'a screen reader is not told the link is Bluetooth')
    assert.match(bar, /<Which link=\{link\} onClose=/)
    /* A blue in both themes, and plainly not the computer's cyan or the unit's green: at least 20 degrees of hue from each, theme by theme. */
    const theme = src('mobile/src/lib/theme.js')
    const hue = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      const max = Math.max(r, g, b)
      const d = max - Math.min(r, g, b)
      if (!d) return 0
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      return (h * 60 + 360) % 360
    }
    const apart = (a, b) => Math.min(Math.abs(hue(a) - hue(b)), 360 - Math.abs(hue(a) - hue(b)))
    for (const name of ['DARK', 'LIGHT']) {
      const block = theme.slice(theme.indexOf(`const ${name} = {`), theme.indexOf('\n}', theme.indexOf(`const ${name} = {`)))
      const of = (key) => (block.match(new RegExp(`\\b${key}: '(#[0-9a-f]{6})'`, 'i')) || [])[1]
      assert.ok(of('ble'), `Bluetooth has no blue in the ${name.toLowerCase()} theme`)
      for (const other of ['live', 'ok']) {
        assert.ok(apart(of('ble'), of(other)) >= 20, `the ${name.toLowerCase()} theme's Bluetooth blue is too close to its ${other} colour`)
      }
    }
    /* And the picture is there, the same size and kind as the bar's others. */
    const png = readFileSync(new URL('../mobile/assets/icons/wireless.png', import.meta.url))
    assert.equal(png.toString('ascii', 1, 4), 'PNG')
    assert.equal(png.readUInt32BE(16), 96, 'the wireless mark is not 96 wide like the other icons')
    assert.equal(png.readUInt32BE(20), 96, 'the wireless mark is not 96 high like the other icons')
  })

  test('over Bluetooth, CONNECTED opens a note with Turn off Bluetooth, which does what Stop does', async () => {
    /* "Make it so you can click the connected button at the top of the screen and have a button that pop up that says turn off Bluetooth." */
    const bar = flat('mobile/src/components/TopBar.js')
    assert.match(bar, /import \{ setBluetooth, useBluetoothOn \} from '\.\.\/lib\/bluetooth'/, 'the bar cannot turn Bluetooth off')
    /*
     * The word CONNECTED is the pill since 24 October 2026 (Axiom's "Live ●
     * AM4" over "on Raspberry Pi"), and over Bluetooth, in every state of the
     * link, the pill opens this note: one adapter, nothing to switch to.
     */
    assert.match(bar, /onPress=\{\(\) => \{ tick\(\) if \(bluetooth\) \{ setSaying\(\(open\) => !open\) return \}/, 'the pill does not open the note over Bluetooth')
    /* With Report a problem beside Turn off Bluetooth since 25 October 2026 (onReport, App's, through the page's gate). */
    assert.match(bar, /\{saying && bluetooth \? <Which link=\{link\} onClose=\{\(\) => setSaying\(false\)\} onReport=\{onReport\} \/> : null\}/)
    assert.match(bar, /useEffect\(\(\) => \{ if \(!bluetooth\) setSaying\(false\) \}, \[bluetooth\]\)/, 'the note is left open, to come back by itself when Bluetooth next comes on')
    const ble = bar.slice(bar.indexOf('function Which('), bar.indexOf('function Saved('))
    assert.ok(ble.length > 0 && ble.includes('Connected over Bluetooth, through'), 'the Bluetooth note is not where this looks')
    assert.match(ble, />Turn off Bluetooth<\/Text>/, 'the note has no Turn off Bluetooth')
    assert.match(ble, /accessibilityRole="button" accessibilityLabel="Turn off Bluetooth"/)
    assert.ok(!/\? \( <Pressable accessibilityRole="button" accessibilityLabel="Turn off Bluetooth"/.test(ble), 'Turn off Bluetooth only shows in some states of the link')
    assert.match(
      ble,
      /onPress=\{\(\) => \{ tick\(\) fire\('press Turn off Bluetooth', \(\) => setBluetooth\(false\)\) onClose\(\) \}\}/,
      'Turn off Bluetooth does something other than Stop'
    )
    assert.match(flat('mobile/src/screens/Bluetooth.js'), /<Press label="Stop using Bluetooth" sub="Goes back to the computer" height=\{52\} onPress=\{\(\) => setBluetooth\(false\)\} \/>/)
    assert.match(flat('mobile/App.js'), /<Press label="Use the computer instead" onPress=\{\(\) => setBluetooth\(false\)\} \/>/)
    assert.match(ble, /accessible=\{false\} onPress=\{onClose\}/, 'VoiceOver cannot reach Turn off Bluetooth inside the note')
    /* On a bench: off, kept off, unit and adapter kept, said in the log. */
    const disk = { 'fractal.bluetooth': JSON.stringify({ on: true, unit: 'am4', adapter: { id: '1:2', name: 'WIDI Uhost Bluetooth' } }) }
    const bench = await bluetoothOnABench({ mod: iphoneModule('allowedAlways').mod, disk })
    try {
      /* His account: the only one it is on for (lib/bluetooth, allowBluetooth). */
      bench.ble.allowBluetooth((await import('../shared/admin.mjs')).ADMINS[0])
      assert.equal(await bench.ble.restoreBluetooth(), true)
      assert.equal(bench.ble.setBluetooth(false), false)
      assert.equal(bench.sw.bluetoothOn(), false, 'the switch still sends requests to the adapter')
      assert.equal(bench.sw.bluetoothWire(), null, 'a Bluetooth wire still answers with it off')
      await new Promise((r) => setTimeout(r, 0))
      const kept = JSON.parse(bench.disk.get('fractal.bluetooth'))
      assert.equal(kept.on, false, 'it comes back on at the next launch')
      assert.equal(kept.unit, 'am4', 'the unit is forgotten, so Connect asks again')
      assert.deepEqual(kept.adapter, { id: '1:2', name: 'WIDI Uhost Bluetooth' }, 'the adapter is forgotten, so Connect goes looking again')
      assert.ok(bench.log.some((l) => /Bluetooth turned off/.test(l)), 'turning it off is not in the log')
    } finally {
      bench.done()
    }
  })

  test('on an AM4 over Bluetooth the Play screen reads the scene names once, keeps them, and Refresh names reads again', async () => {
    /*
     * "Can't we just add a thing that loads it the first time, or a button
     * to reload the names, cause it does say refresh names already right
     * above the scenes ... let's make them load even if it's slower on
     * Bluetooth, but it doesn't have to constantly be rereading them once it
     * reads them once, it can go off the remembered names unless they hit
     * refresh."
     */
    const stage = flat('mobile/src/screens/Stage.js')
    assert.match(stage, /<Label>Scenes<\/Label> \{\/\*[\s\S]*?\*\/\} <RefreshNames \/>/, 'Refresh names is held back over Bluetooth')
    assert.doesNotMatch(code('mobile/src/screens/Stage.js'), /overBluetooth\(caps\) && device === 'am4' \? null : <RefreshNames/)
    const rig = flat('mobile/src/lib/rig.js')
    /* Remembered first, from the same per-unit store the computer's names went into, under the same 'am4' name. */
    assert.match(rig, /const kept = await recallSceneNames\(owner, number\) if \(kept\.length && state\.preset\?\.number === number\) set\(\{ sceneNames: kept \}\)/, 'the names already seen are not shown first')
    assert.match(
      rig,
      /if \(viaBluetooth\(\)\) return \(kept\.length > 0 \|\| \(await sceneNamesKnown\(owner, number\)\)\) && state\.preset\?\.number === number/,
      'a preset whose names are remembered is read again over Bluetooth'
    )
    /* No computer to ask, and no summary of the slots either side, which would be a whole preset each. */
    assert.match(rig, /function followComputerNames\(\) \{ const number = state\.preset\?\.number \/\*[^*]*\*\/ if \(viaBluetooth\(\)\) return/)
    assert.match(rig, /const viaBluetooth = \(\) => state\.capabilities\?\.via === 'bluetooth'/)
    assert.match(rig, /if \(!bluetoothAm4\(\)\) \{ const summary = await device\.sceneNames\(number\)/)
    const device = flat('mobile/src/lib/device.js')
    assert.match(device, /export function keepSceneNames\(slug, number, names\) \{ if \(!slug \|\| !Number\.isInteger\(number\) \|\| number < 0 \|\| demoDevice\(\) \|\| bluetoothWire\(\)\) return/)
    /* Refresh names lets the wire's own copy go, so the press reaches the unit. */
    /* (A VP4 goes first, to its own re-read of the one record it is read by: never over Bluetooth, test/vp4-safety.mjs.) */
    assert.match(rig, /export async function rereadSceneNames\(\) \{ if \(device\.vp4Here\?\.\(\)\) return rereadVp4SceneNames\(\) const number = state\.preset\?\.number if \(!Number\.isInteger\(number\)\) return 'failed' device\.freshSceneNames\?\.\(\)/)
    assert.match(device, /export const freshSceneNames = \(\) => bluetoothWire\(\)\?\.forgetSceneNames\?\.\(\)/)
    const { deviceSlug } = await import('../shared/device-slug.mjs')
    assert.equal(deviceSlug({ name: 'AM4', short: 'AM4' }), 'am4', 'Bluetooth files the AM4 under another name, so the computer’s names are not found')
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
    /*
     * And what the player gets from it, in the sentence the iPhone shows
     * when it asks. Apple's 5.1.1(ii) help: "Name the specific feature or
     * outcome the data makes possible", and give "a concrete example".
     */
    assert.equal(
      app.expo.ios.infoPlist.NSBluetoothAlwaysUsageDescription,
      'Fractal Remote uses Bluetooth to connect to the Bluetooth MIDI adapter on your Fractal unit, so you can change presets and scenes from your phone without a computer.',
      'the Bluetooth permission no longer says what it is for and what the player gets'
    )

    /* mobile/.gitignore drops android/; the module's own Android code has to be let back in, or EAS builds without it. */
    const ignore = src('mobile/.gitignore').split('\n').map((l) => l.trim())
    const drop = ignore.indexOf('android/')
    const keep = ignore.indexOf('!/modules/*/android/')
    assert.ok(drop >= 0 && keep > drop, 'the module’s Android code is ignored by git')
    assert.ok(ignore.indexOf('/modules/*/android/build/') > keep, 'what Gradle builds inside the module would be committed')
  })

  /*
   * LIB/BLUETOOTH ON A BENCH OF ITS OWN, as device.js is above: the real file,
   * with React, React Native, the phone's storage and the native module
   * swapped for pretend ones, on whichever phone the test says. Each bench is
   * a fresh copy, so nothing one test switches on is still on in the next.
   *
   * AND ON WHICHEVER STORE COPY. `installed` is the version built into the
   * copy, as lib/storeVersion would read it off the binary (test/siri.mjs
   * stands it in the same way): 1.88.4 by default, newer than every store
   * build there is, which a customer is closed on today like any other copy.
   * `from` is the rule's threshold: left out, the real ble-rule.js decides;
   * given, a copy of it with BLUETOOTH_FROM_STORE set to that, as the build
   * pull request will set it, so the opening can be tried before any copy
   * has it.
   */
  async function bluetoothOnABench({ os = 'ios', version = 18, mod = null, disk = {}, installed = '1.88.4', from = undefined, later = [] } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'ble-lib-'))
    const real = (f) => new URL(`../mobile/src/lib/${f}`, import.meta.url).href
    const swaps = [
      ["from 'react'", "from './react.js'"],
      ["from 'react-native'", "from './react-native.js'"],
      ["from '@react-native-async-storage/async-storage'", "from './storage.js'"],
      ["from 'expo'", "from './expo.js'"],
      ["from './bleWire'", `from '${real('bleWire.js')}'`],
      ["from './fractal-sysex.mjs'", `from '${real('fractal-sysex.mjs')}'`],
      ["from './bleAdapters'", `from '${real('bleAdapters.js')}'`],
      ["from './gen3Catalog'", `from '${real('gen3Catalog.js')}'`],
      ["from './bleSwitch'", "from './bleSwitch.js'"],
      ["from './debugLog'", "from './debugLog.js'"],
      /* The real check of whose phone this is: admin.js and owner-unlock.js, which import nothing that needs a phone. */
      ["from './admin'", `from '${real('admin.js')}'`],
      ["from './owner-unlock'", `from '${real('owner-unlock.js')}'`],
      /* The version built into the copy, stood in; the rule, real or as the build will set it; the device's own word, real. */
      ["from './storeVersion'", "from './storeVersion.js'"],
      ["from './ble-rule'", from === undefined ? `from '${real('ble-rule.js')}'` : "from './ble-rule.js'"],
      ["from './device-word'", `from '${real('device-word.js')}'`],
      ["from './bluetooth-gear'", `from '${real('bluetooth-gear.js')}'`]
    ]
    let lib = src('mobile/src/lib/bluetooth.js')
    for (const [from, to] of swaps) {
      assert.ok(lib.includes(from), `lib/bluetooth no longer imports ${from}: the bench needs telling`)
      lib = lib.replace(from, to)
    }
    const files = {
      'package.json': '{ "type": "module" }',
      'bluetooth.js': lib,
      /* Every subscribe a hook hands React, kept, so a test can listen the way a screen would. */
      'react.js': 'export const subscribed = []\nexport const useSyncExternalStore = (subscribe, read) => {\n  subscribed.push(subscribe)\n  return read()\n}\n',
      'react-native.js': `export const Platform = { OS: ${JSON.stringify(os)}, Version: ${JSON.stringify(version)} }\n`,
      'storage.js':
        `export const disk = new Map(Object.entries(${JSON.stringify(disk)}))\n` +
        'export default { getItem: async (k) => (disk.has(k) ? disk.get(k) : null), setItem: async (k, v) => { disk.set(k, String(v)) } }\n',
      'expo.js': 'export const native = { module: null }\nexport const requireOptionalNativeModule = () => native.module\n',
      'debugLog.js': 'export const lines = []\nexport const logDebug = (...parts) => { lines.push(parts.join(" ")) }\n',
      'bleSwitch.js': src('mobile/src/lib/bleSwitch.js'),
      'storeVersion.js': `export const installedStoreVersion = () => ${JSON.stringify(installed)}\n`
    }
    if (from !== undefined) {
      const rule = src('mobile/src/lib/ble-rule.js')
      const set = rule.replace(/export const BLUETOOTH_FROM_STORE = Object\.freeze\(\{[^}]*\}\)/, `export const BLUETOOTH_FROM_STORE = Object.freeze(${JSON.stringify(from)})`)
      assert.notEqual(set, rule, 'ble-rule.js no longer says BLUETOOTH_FROM_STORE the way the bench sets it')
      /* `later`: units keyed to a later store version (1.90.0) instead, as a unit added after the opening build would be. */
      let keyed = set
      for (const key of later) {
        const was = keyed
        keyed = keyed.replace(`  ${key}: BLUETOOTH_FROM_STORE`, `  ${key}: Object.freeze({ ios: '1.90.0', android: '1.90.0' })`)
        assert.notEqual(keyed, was, `ble-rule.js no longer keys the ${key} the way the bench re-keys it`)
      }
      files['ble-rule.js'] = keyed.replace("from './versions.js'", `from '${real('versions.js')}'`)
    }
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
    const at = (f) => pathToFileURL(join(dir, f)).href
    ;(await import(at('expo.js'))).native.module = mod
    return {
      ble: await import(at('bluetooth.js')),
      sw: await import(at('bleSwitch.js')),
      subscribed: (await import(at('react.js'))).subscribed,
      disk: (await import(at('storage.js'))).disk,
      log: (await import(at('debugLog.js'))).lines,
      done: () => rmSync(dir, { recursive: true, force: true })
    }
  }

  /* A pretend iPhone module: what pair() is asked, and `authorization` as build 25 (absent) or the new build has it. */
  function iphoneModule(authorization) {
    const asked = []
    const mod = {
      supported: () => true,
      requestPermissions: async () => true,
      devices: () => [],
      pair: async () => {
        asked.push('pair')
      },
      addListener: () => ({ remove() {} })
    }
    if (typeof authorization === 'function') mod.authorization = authorization
    else if (authorization !== undefined) mod.authorization = () => authorization
    return { mod, asked }
  }

  test('an iPhone with Bluetooth not allowed for the app is told so, and Apple’s screen is not opened for nothing', async () => {
    /*
     * Don't Allow (or Screen Time, or a work profile, saying no) used to
     * open Apple's screen with nothing in it, and then a line that could only
     * say "check Bluetooth is on, and allowed".
     *
     * And the two are not the same trouble. This pinned both as 'permission',
     * whose words and button send the owner to Fractal Remote's own page in
     * the iPhone's Settings — which has no switch that can lift a Screen Time
     * or work-profile block. 'restricted' is its own word now, with its own
     * line and no button (the next test); changed on purpose.
     */
    for (const [access, trouble] of [['denied', 'permission'], ['restricted', 'restricted']]) {
      const { mod, asked } = iphoneModule(access)
      const bench = await bluetoothOnABench({ mod })
      try {
        await bench.ble.findAdapters()
        assert.equal(bench.ble.useBluetoothTrouble(), trouble, `${access} is not said as ${trouble}`)
        assert.deepEqual(asked, [], `Apple’s screen opened with Bluetooth ${access}`)
        assert.ok(bench.log.some((l) => l.includes(`not allowed for Fractal Remote (${access})`)), 'the log does not say why the screen did not open')
      } finally {
        bench.done()
      }
    }
    /*
     * Allowed, not asked yet, a word Apple adds later, a module that throws,
     * and BUILD 25, which has no such question at all: Apple's screen opens
     * exactly as before. Not asked yet is when iOS puts its own question,
     * inside that screen.
     */
    for (const access of ['allowedAlways', 'notDetermined', 'somethingNew', () => { throw new Error('no') }, undefined]) {
      const { mod, asked } = iphoneModule(access)
      const bench = await bluetoothOnABench({ mod })
      try {
        await bench.ble.findAdapters()
        assert.deepEqual(asked, ['pair'], `Apple’s screen did not open (${typeof access === 'function' ? 'a module that throws' : access ?? 'build 25'})`)
        assert.equal(bench.ble.useBluetoothTrouble(), null)
      } finally {
        bench.done()
      }
    }
    /* And the trouble goes again with the next Connect, once it is allowed. */
    let access = 'denied'
    const { mod, asked } = iphoneModule(() => access)
    const bench = await bluetoothOnABench({ mod })
    try {
      await bench.ble.findAdapters()
      access = 'allowedAlways'
      await bench.ble.findAdapters()
      assert.equal(bench.ble.useBluetoothTrouble(), null, 'not allowed is still said after it was allowed')
      assert.deepEqual(asked, ['pair'])
    } finally {
      bench.done()
    }
  })

  test('not allowed is said in the phone’s own words, with a button to the app’s own page in its settings', async () => {
    const lib = async (os, version) => {
      const bench = await bluetoothOnABench({ os, version })
      try {
        return { allow: bench.ble.ALLOW_WORDS, restricted: bench.ble.RESTRICTED_WORDS }
      } finally {
        bench.done()
      }
    }
    /*
     * ONE iPHONE LINE, RIGHT ON EVERY VERSION. Since iOS 18 an app's page is
     * under Settings → Apps; iOS 16 and 17, which the app still installs on,
     * have it in the main list and no Apps. This pinned two lines, one path
     * each, picked by the version number the phone reported. Open Settings
     * goes straight to Fractal Remote's page on every version, so the line now
     * leans on the button and names no path at all; changed on purpose, and
     * the button is held below to be wherever the line is.
     */
    const IPHONE = 'Bluetooth isn’t allowed for Fractal Remote. Tap Open Settings and switch Bluetooth on'
    for (const version of ['26.1', '18.0', '17.6.1', '16.4', null]) {
      const { allow, restricted } = await lib('ios', version)
      assert.equal(allow, IPHONE, `iOS ${version}: the line is not the one line`)
      assert.ok(!/Settings →|→ Apps|Apps →/.test(allow), `iOS ${version}: the line names a path through the iPhone’s menus again`)
      /*
       * BLOCKED IS NOT "NOT ALLOWED". Screen Time, or a profile from whoever
       * manages the phone: the app's own page cannot undo it, so its line
       * says where the block is and never sends anybody to Open Settings.
       */
      assert.match(restricted, /Screen Time/)
      assert.match(restricted, /whoever manages the phone/)
      assert.ok(!/Open Settings/.test(restricted), 'a blocked iPhone is promised the app’s own page can fix it')
    }
    assert.equal((await lib('android', 34)).allow, 'Allow Nearby devices for Fractal Remote in Android’s settings')
    assert.equal((await lib('android', 30)).allow, 'Allow Location for Fractal Remote in Android’s settings, and turn Location on')

    const page = flat('mobile/src/screens/Bluetooth.js')
    assert.match(page, /import \{ Linking, Platform, Text, View \} from 'react-native'/)
    assert.match(page, /if \(b\.trouble === 'restricted'\) return \{ line: RESTRICTED_WORDS, tone: 'fault' \}/, 'a blocked iPhone is not told so')
    /* On both phones: openSettings is the app's own page, the Bluetooth switch on an iPhone and Permissions on Android. One button, drawn by one function. */
    assert.match(page, /function OpenSettings\(\) \{ return <Press label="Open Settings" height=\{44\} onPress=\{\(\) => Linking\.openSettings\(\)\.catch\(\(\) => \{\}\)\} \/> \}/)
    assert.equal((page.match(/label="Open Settings"/g) || []).length, 1, 'a second Open Settings button skips the rule below')
    assert.ok(!/Platform\.OS === 'ios' && b\.trouble === 'permission'|ios && b\.trouble === 'permission'/.test(page), 'the button is kept from Android')
    /*
     * NEVER WITHOUT ITS LINE. It was drawn whenever the trouble was
     * 'permission', while the line saying what to change was drawn only
     * with Bluetooth off — so with Bluetooth on it stood under Stop, on its
     * own. Then it was drawn in two places, the status line of a step that
     * was on and a line of its own under Connect when it was off.
     *
     * CHANGED ON PURPOSE, 24 October 2026, when Connect went to the top
     * ("a five-year-old could connect it"): the status line is drawn first
     * on the page, on or off, and is the only place the trouble is said, so
     * the button is drawn once, straight under it. Only for 'permission'.
     */
    const uses = page.match(/\{b\.trouble === 'permission' \? <OpenSettings \/> : null\}/g) || []
    assert.equal(uses.length, 1, 'Open Settings is drawn somewhere other than under its line')
    /* Counted however it is written: an && or a bare <OpenSettings /> is a second button too. */
    const pageBody = page.slice(page.indexOf('return ( <View style={{ gap: space.xl }}>'), page.indexOf('function UnitChips('))
    assert.equal((pageBody.match(/<OpenSettings \/>/g) || []).length, 1, 'Open Settings is drawn in more than one place')
    /* And once more on Troubleshooting, among its fixes. */
    assert.equal((page.slice(page.indexOf('export function BluetoothTrouble(')).match(/<OpenSettings \/>/g) || []).length, 1)
    assert.match(page, /\{said\.line\} <\/Text> \{b\.trouble === 'permission' \? <OpenSettings \/> : null\}/, 'the button is not under the status line that says what to allow')
    assert.ok(!/\{!b\.on && b\.trouble \?/.test(page), 'the trouble is said twice while it is off: once at the top and again under Connect')
    /* The status line comes before anything else a person can press, on or off: nothing to scroll past to read it. */
    const body = page.slice(page.indexOf('return ( <View style={{ gap: space.xl }}>'))
    assert.ok(body.indexOf('{said.line}') > 0 && body.indexOf('{said.line}') < body.indexOf('<Press'), 'something is drawn above the line that says where it stands')
    assert.ok(!/\{b\.on \? \([^]*\{said\.line\}[^]*\) : \(/.test(body.slice(0, body.indexOf('Pick your unit'))), 'the status line is only drawn while it is on')
    /*
     * Drawn while it is on, and whenever something is wrong, a trouble or a
     * fault, on or off (26 October 2026: "very streamlined unless there is
     * problems"). Off and fine it would only say "Not connected", over the
     * steps that are about connecting.
     */
    const head = body.slice(0, body.indexOf('{said.line}')).replace(/\{\/\*[^*]*(?:\*(?!\/)[^*]*)*\*\/\}/g, '')
    assert.equal((head.match(/\?|&&/g) || []).length, 1, 'the status line is drawn on some other condition')
    assert.match(head, /\{sayIt \? \(/)
    /* And the status line it sits under is the allow line whenever the trouble is 'permission', on or off. */
    const status = page.slice(page.indexOf('function status('), page.indexOf('const TONES'))
    assert.ok(status.indexOf("b.trouble === 'permission'") < status.indexOf("if (!b.on) return { line: 'Not connected'"), 'with Bluetooth on, the line above the button says something else')
    assert.match(page, /\{!b\.on && missed && !b\.adapter && !b\.trouble && !b\.said \? \(/, 'the vague iPhone line shows under the plain one')

    /*
     * THE WAITING SCREEN TOO, which shows the same line with Bluetooth on and
     * had no button at all: the line now says "Tap Open Settings", so the
     * button is there for 'permission', and the blocked line has its own words.
     */
    const waking = flat('mobile/App.js').slice(flat('mobile/App.js').indexOf('function Waking('))
    assert.match(waking, /trouble === 'restricted' \? `\$\{RESTRICTED_WORDS\}\.`/, 'the waiting screen does not say a blocked iPhone is blocked')
    assert.match(waking, /\{bluetooth && trouble === 'permission' \? \( <Press label="Open Settings" onPress=\{\(\) => Linking\.openSettings\(\)\.catch\(\(\) => \{\}\)\} \/> \) : null\}/, 'the waiting screen says Tap Open Settings and has no such button')
    assert.equal((waking.match(/label="Open Settings"/g) || []).length, 1)
    /* Changed on purpose, 12 October 2026 (1.87.17): AppState joined the line, for the
       waiting screen's fifteen-second clock, which does not count time away from the screen
       (useLookedLong). What this holds is Linking, for Open Settings, and that is unchanged.
       And again, 15 October 2026: ScrollView joined it, for the waiting screen's column,
       which scrolls now when it is taller than a small phone. */
    assert.match(flat('mobile/App.js'), /import \{ ActivityIndicator, Alert, AppState, Appearance, BackHandler, Linking, ScrollView, Text, View \} from 'react-native'/)
  })

  test('the iPhone module answers whether Bluetooth is allowed without asking, and the build links CoreBluetooth for it', () => {
    const swift = src('mobile/modules/fractal-ble-midi/ios/FractalBleMidiModule.swift')
    const one = swift.replace(/\s+/g, ' ')
    assert.match(swift, /^import CoreBluetooth$/m)
    /* Declared the way the module's other calls are, and every one of Apple's four words mapped. */
    assert.match(one, /Function\("authorization"\) \{ \(\) -> String in switch CBManager\.authorization \{/)
    for (const word of ['allowedAlways', 'denied', 'restricted', 'notDetermined']) {
      assert.match(one, new RegExp(`case \\.${word}: return "${word}"`), `${word} is not answered as itself`)
    }
    /* Anything Apple adds later is not a no, so the JavaScript goes on as before. */
    assert.match(one, /@unknown default: return "notDetermined" \} \}/)
    /*
     * READ, NEVER ASKED. CBManager.authorization is a class property, read
     * with no Bluetooth manager made; making one is what brings up iOS's
     * question, and every customer who never opens Bluetooth would get it.
     */
    const swiftCode = swift.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '')
    assert.ok(!/CBCentralManager|CBPeripheralManager/.test(swiftCode), 'the module makes a Bluetooth manager, which asks the question')
    /* The pod needs 16.4, past the 13.1 the property arrived in. */
    const pod = src('mobile/modules/fractal-ble-midi/ios/FractalBleMidi.podspec')
    assert.match(pod, /s\.platforms\s*=\s*\{ :ios => '16\.4' \}/)
    assert.match(pod, /s\.frameworks = 'CoreMIDI', 'CoreAudioKit', 'CoreBluetooth'/, 'CoreBluetooth is not linked')
    /* Asked from one place only, before Apple's screen, and only if the build has it. */
    const ble = flat('mobile/src/lib/bluetooth.js')
    assert.match(ble, /try \{ access = mod\.authorization\?\.\(\) \?\? null \} catch \{ access = null \}/, 'build 25, which has no such question, is asked it anyway')
    assert.ok(ble.indexOf('mod.authorization?.()') < ble.indexOf('await mod.pair()'), 'Apple’s screen opens before asking')
  })

  test('Google Play is told the hardware the older Bluetooth permissions imply is not required', () => {
    /*
     * Play reads a hardware permission as "this app needs that hardware" and
     * hides the app, and every update to it, from devices without it, unless
     * the feature is declared required="false". Android's own table
     * (developer.android.com/guide/topics/manifest/uses-feature-element,
     * "Permissions that imply feature requirements", updated 1 September
     * 2026): BLUETOOTH and BLUETOOTH_ADMIN imply android.hardware.bluetooth,
     * ACCESS_FINE_LOCATION implies android.hardware.location (and .gps only
     * for an app aimed at Android 4.4W or older). BLUETOOTH_SCAN and
     * BLUETOOTH_CONNECT are not in the table, and aapt2, which reads the
     * manifest for Play, implies nothing for them (tools/aapt2/dump/
     * DumpManifest.cpp, addImpliedFeaturesForPermission) — and it adds the
     * others without looking at maxSdkVersion, so "Android 11 and older" does
     * not keep them away.
     */
    const IMPLIES = {
      'android.permission.BLUETOOTH': 'android.hardware.bluetooth',
      'android.permission.BLUETOOTH_ADMIN': 'android.hardware.bluetooth',
      'android.permission.ACCESS_FINE_LOCATION': 'android.hardware.location',
      'android.permission.ACCESS_COARSE_LOCATION': 'android.hardware.location'
    }
    const manifest = src('mobile/modules/fractal-ble-midi/android/src/main/AndroidManifest.xml').replace(/<!--[\s\S]*?-->/g, ' ')
    const asked = [...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)].map((m) => m[1])
    const features = Object.fromEntries([...manifest.matchAll(/<uses-feature android:name="([^"]+)" android:required="(true|false)"\/>/g)].map((m) => [m[1], m[2]]))
    assert.ok(asked.includes('android.permission.BLUETOOTH') && asked.includes('android.permission.ACCESS_FINE_LOCATION'), 'the permissions this was written about are gone: read it again')
    for (const permission of asked) {
      const feature = IMPLIES[permission]
      if (feature) assert.equal(features[feature], 'false', `${permission} makes Play hide the app from devices without ${feature}`)
    }
    /* And every feature the module names is one a phone can lack and still get the app. */
    assert.deepEqual(Object.keys(features).sort(), ['android.hardware.bluetooth', 'android.hardware.bluetooth_le', 'android.hardware.location', 'android.software.midi'])
    assert.ok(Object.values(features).every((r) => r === 'false'), 'a feature the module names is required')
  })

  test('Android leaves out the three permissions the app never uses, and keeps Bluetooth’s', () => {
    /*
     * The store copy asked for "display over other apps" and the old storage
     * pair. They came from Expo's starting template (SYSTEM_ALERT_WINDOW is
     * there for React Native's debugging overlay) and from expo-file-system,
     * which ships inside the expo package itself; the app uses none of them.
     * Expo can only take out what a package's own manifest adds by blocking
     * it (docs.expo.dev/guides/permissions: "The only way to remove
     * permissions that are added by package-level AndroidManifest.xml files
     * is to block them"), which writes tools:node="remove" into the app's.
     */
    const app = JSON.parse(src('mobile/app.json')).expo
    const BLOCKED = ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.CAMERA']
    assert.deepEqual(app.android.blockedPermissions, BLOCKED)
    /* VIBRATE is expo-haptics', and nothing Bluetooth needs is on the list. */
    for (const kept of ['android.permission.VIBRATE', 'android.permission.BLUETOOTH', 'android.permission.BLUETOOTH_SCAN', 'android.permission.BLUETOOTH_CONNECT', 'android.permission.ACCESS_FINE_LOCATION']) {
      assert.ok(!app.android.blockedPermissions.includes(kept), `${kept} is blocked`)
    }
    /* Nothing in the app reaches for what is blocked, or for the files and pictures they guard. */
    const files = [fileURLToPath(new URL('../mobile/App.js', import.meta.url))]
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) {
          if (entry !== 'build' && entry !== 'node_modules') walk(full)
        } else if (/\.(jsx?|mjs|kt|swift|xml)$/.test(entry)) files.push(full)
      }
    }
    walk(fileURLToPath(new URL('../mobile/src/', import.meta.url)))
    walk(fileURLToPath(new URL('../mobile/modules/', import.meta.url)))
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      assert.ok(!/SYSTEM_ALERT_WINDOW|EXTERNAL_STORAGE|PermissionsAndroid|expo-file-system|expo-media-library|expo-document-picker/.test(text), `${file.split('/mobile/')[1]} uses what is blocked`)
    }
    const pkg = JSON.parse(src('mobile/package.json'))
    for (const name of ['expo-file-system', 'expo-media-library', 'expo-document-picker']) {
      assert.ok(!(name in pkg.dependencies), `${name} is a package of the app's own now: check what it needs before blocking its permissions`)
    }
    /*
     * expo-image-picker is, for a report's screenshots (docs/pending
     * photo-picker.patch), and was checked: its own manifest adds CAMERA, and
     * READ and WRITE_EXTERNAL_STORAGE up to Android 12. The storage two stay
     * blocked here, because the picker it opens is the system's own (Android's
     * photo picker, or Google Play's copy of it on older phones, which the
     * manifest's photopicker_activity line asks for), which needs neither.
     * RECORD_AUDIO is blocked by its plugin. CAMERA is blocked in the list
     * above: the plugin blocks it only when cameraPermission is false, and
     * that is not possible here (test/reports.mjs says why).
     */
    const picker = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker')?.[1]
    if ('expo-image-picker' in pkg.dependencies) {
      assert.ok(app.android.blockedPermissions.includes('android.permission.CAMERA'), 'the photo picker brings the camera with it')
      assert.equal(picker?.microphonePermission, false, 'the photo picker brings the microphone with it')
    }
  })

  /*
   * WHAT YOU NEED. "We need to provide as much instructions as possible on
   * how to connect it and hook it up. So as far as I know, we need a CME
   * Widi host. And then for the AM4 I use these as well. Maybe we could add
   * these with the Amazon links on how to buy them?"
   */
  test('what you need: the parts for the unit picked, each at its one address, and how they plug in', async () => {
    const gear = await import('../shared/bluetooth-gear.mjs')
    const { SITE } = await import('../shared/whats-live.mjs')
    const { BLE_UNITS } = await import(WIRE)
    /*
     * The guide is on the website, at the site's own address: public/bluetooth-guide.html
     * since Bluetooth went back to Justin's account alone, because
     * /bluetooth now tells customers it is not in the app yet. Only the
     * Bluetooth page, which only his account opens, links it.
     */
    assert.equal(gear.GUIDE_URL, `${SITE}/bluetooth-guide.html`)
    /* The three he bought, as checked on amazon.com on 10 October 2026, and nothing on the end of them. */
    assert.deepEqual(
      Object.fromEntries(Object.entries(gear.PARTS).map(([key, p]) => [key, p.amazon])),
      {
        uhost: 'https://www.amazon.com/dp/B09GS326QW',
        c2midi: 'https://www.amazon.com/dp/B0GVXTX5D1',
        /* The rest checked against their Amazon pages on 26 October 2026, each title matching. */
        u2midi: 'https://www.amazon.com/dp/B0BH8DHCLY',
        usbA: 'https://www.amazon.com/dp/B01COOQIKU',
        adapters: 'https://www.amazon.com/dp/B0FN83P5P7',
        master: 'https://www.amazon.com/dp/B08F8F57JX',
        jackTrs: 'https://www.amazon.com/dp/B08ZZSYKQX',
        jackDin: 'https://www.amazon.com/dp/B08ZZSVM1J',
        /* The pair the WIDI Master was tried with on his AM4 (Justin, 26 October 2026). */
        masterAdapters: 'https://www.amazon.com/dp/B0FJRB9KGV'
      }
    )
    /*
     * THE WAYS, BY UNIT, best first (Justin, 26 October 2026): the WIDI
     * Master, the WIDI Jack, then the Uhost and a cable; the FM3 the Uhost
     * and the U2MIDI Pro alone, with the adapter its USB-A plug needs.
     */
    const ways = (u) => gear.waysFor(u).map((w) => [w.key, w.parts.join('+')])
    assert.deepEqual(ways('am4'), [['master', 'master+masterAdapters'], ['jack', 'jackTrs'], ['uhost', 'uhost+c2midi+adapters']])
    assert.deepEqual(ways('vp4'), [['master', 'master+masterAdapters'], ['jack', 'jackTrs'], ['uhost', 'uhost+c2midi+adapters']])
    for (const u of ['fm9', 'axefx3']) assert.deepEqual(ways(u), [['master', 'master'], ['jack', 'jackDin'], ['uhost', 'uhost+c2midi']])
    assert.deepEqual(ways('fm3'), [['uhost', 'uhost+u2midi+usbA']], 'something fed from MIDI OUT is offered for an FM3')
    /* Tried: the AM4 through the WIDI Master and the Uhost, the FM3 through the Uhost and the U2MIDI Pro. Nothing else says it has run. */
    const tried = Object.fromEntries(['am4', 'fm3', 'fm9', 'axefx3', 'vp4'].map((u) => [u, gear.waysFor(u).filter((w) => w.tried).map((w) => w.key)]))
    assert.deepEqual(tried, { am4: ['master', 'jack', 'uhost'], fm3: ['uhost'], fm9: [], axefx3: [], vp4: [] })
    /* The WIDI Master runs on the unit's MIDI OUT alone (CME: "No external power option"): its steps never send anybody to a charger for it. */
    for (const u of ['am4', 'fm9']) assert.match(gear.waysFor(u)[0].steps.join(' '), /It has no other way to be powered\./)
    /* The FM3's U2MIDI Pro: CME's own page, checked on 26 October 2026, and no Amazon link until one has been checked. */
    assert.equal(gear.PARTS.u2midi.maker, 'https://www.cme-pro.com/u2midi-pro-usb-to-midi-cable/')
    assert.equal(gear.PARTS.uhost.maker, 'https://www.cme-pro.com/widi-uhost/')
    assert.equal(gear.PARTS.c2midi.maker, 'https://www.cme-pro.com/c2midi-pro/')
    for (const url of gear.ALL_LINKS) {
      assert.match(url, /^https:\/\/[^?#\s]+$/, `${url} carries tracking or is not a plain address`)
      if (/amazon\.com/.test(url)) assert.match(url, /^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}$/, `${url} is not the plain /dp/ form`)
    }
    /* The 3.5 mm adapters are for the AM4 and the VP4 (both Type A, docs/bluetooth-midi.md): the others have the 5-pin jacks the C2MIDI Pro plugs into. */
    assert.deepEqual(gear.partsFor('am4').map((p) => p.key), ['uhost', 'c2midi', 'adapters'])
    assert.deepEqual(gear.partsFor('vp4').map((p) => p.key), ['uhost', 'c2midi', 'adapters'])
    for (const unit of ['fm9', 'axefx3']) assert.deepEqual(gear.partsFor(unit).map((p) => p.key), ['uhost', 'c2midi'])
    /*
     * "The CME C2MIDI Pro got extremely hot on the FM3 and the connection
     * didn't work." Nothing to buy for an FM3 and no steps: a warning that
     * says what happened, and what owners report. It stays one his account
     * can pick.
     *
     * NO RECIPE, AND OWNERS' REPORTS RATHER THAN A FACT ABOUT THE UNIT:
     * changed on purpose on 25 October 2026. This held the warning to "what
     * owners fit" (a 220-ohm resistor on pin 4 of a home-made adapter), and
     * to the FM3's MIDI OUT "with nothing to limit it", said as fact. A
     * soldering job is nothing the app can stand behind, and the app has
     * measured nothing on an FM3 but a hot cable.
     */
    /*
     * THE FM3, SINCE 26 OCTOBER 2026: "Using the U2midi pro adapter the FM3
     * works and does not get hot", and "The Widi Master did not work on the
     * FM3 and got very hot." So it has the Uhost and the U2MIDI Pro to buy,
     * and steps of its own, with its warning red and in front of them: the
     * WIDI Master and the C2MIDI Pro got very hot and the WIDI Master did not work, the
     * U2MIDI Pro runs on USB power only, works, and stays cool. Changed on
     * purpose: until then it had nothing to buy and no steps.
     */
    assert.deepEqual(gear.partsFor('fm3').map((p) => p.key), ['uhost', 'u2midi'], 'the FM3 is not given the U2MIDI Pro')
    assert.match(gear.hookupFor('fm3').join(' '), /^U2MIDI Pro: the black plug \(TO MIDI IN\) into the FM3’s MIDI IN\./, 'the FM3’s steps do not use the U2MIDI Pro')
    assert.ok(!/C2MIDI/.test(gear.hookupFor('fm3').join(' ')), 'the FM3’s steps send it the C2MIDI Pro')
    assert.equal(gear.warningFor('fm3'), gear.FM3_WARNING)
    for (const unit of ['am4', 'fm9', 'axefx3', 'vp4']) assert.equal(gear.warningFor(unit), null)
    assert.match(gear.FM3_WARNING, /^On an FM3, use the CME U2MIDI Pro\. When we tried the WIDI Master and the C2MIDI Pro on an FM3, both got very hot, and the WIDI Master did not work\. The U2MIDI Pro runs on USB power only: on an FM3 it works and stays cool\./)
    assert.ok(!/220|resistor|pin 4|solder/i.test(gear.FM3_WARNING), 'the FM3 warning gives a home-made way round it again')
    assert.match(gear.FM3_WARNING, /FM3 owners report the same heat with other adapters that take power from its MIDI OUT/, 'the FM3 warning does not say what owners report')
    assert.ok(!/nothing to limit it/.test(gear.FM3_WARNING), 'the FM3 warning states a fault in the unit as fact')
    /* And the WIDI Master on an AM4, tried and working: said under the AM4's parts, never for an FM3. */
    assert.match(gear.ALSO_ON_AM4, /^On an AM4, a CME WIDI Master works too[^]*Never on an FM3\.$/)
    /* The FM3 stays one the page knows, offered with the rest on a copy that opens Bluetooth (offeredUnits), its warning in front. */
    assert.ok(BLE_UNITS.some((u) => u.key === 'fm3'), 'the FM3 is gone from the page')
    const page = readFileSync(new URL('../mobile/src/screens/Bluetooth.js', import.meta.url), 'utf8').replace(/\s+/g, ' ')
    /* How to connect my Bluetooth device opens on the FM3's warning, red, before its way. */
    const waysPage = page.slice(page.indexOf('export function BluetoothWays('), page.indexOf('function Way('))
    assert.ok(waysPage.indexOf('{warningFor(b.unit) ? <Note tone="fault">') < waysPage.indexOf('{ways.map('), 'How to connect does not put the FM3 warning in front of its way')
    assert.match(gear.PARTS.adapters.does, /Type A/)
    for (const p of Object.values(gear.PARTS)) assert.ok(p.name && p.does, 'a part with no name or no line saying what it is for')
    /* The device in hand, passed in, for every part: an iPad's owner reads "Your iPad", and nobody is handed a function to draw. */
    for (const unit of ['am4', 'fm3', 'fm9', 'axefx3', 'vp4']) {
      for (const p of gear.partsFor(unit, 'iPad')) assert.equal(typeof p.does, 'string', `${p.key}: the page is handed something it cannot draw`)
    }
    assert.equal(gear.partsFor('am4', 'iPad')[0].does, 'The Bluetooth adapter. Your iPad connects to it.')
    assert.equal(gear.partsFor('am4')[0].does, 'The Bluetooth adapter. Your phone connects to it.')
    assert.match(gear.hookupFor('axefx3', 'tablet').join(' '), /Not THRU: the tablet would only hear itself there\./)
    /* Who makes the parts, and that the app is not them and gets nothing from the links: the guide has said it all along. */
    /* Without "connected", which on this page is the Bluetooth link: under a CME adapter it read as the app failing to reach it. */
    assert.equal(gear.SELLERS_LINE, 'CME, LOOTOOLS, Eldraqth and Anker make these parts. Fractal Remote has nothing to do with them or with Amazon, and gets nothing from these links.')
    assert.ok(!/connect/i.test(gear.SELLERS_LINE), 'the sellers’ line reads as a connection status')
    /* One thing driving the unit at a time, until the two together have been tried. */
    assert.match(gear.ONE_AT_A_TIME, /^While you use Bluetooth, quit the Fractal Remote app on the computer, or unplug the unit’s USB cable/)

    /* The hookup, for every unit the page offers, in at most five short steps: the FM3's with the U2MIDI Pro since 26 October 2026. */
    for (const { key, name } of BLE_UNITS) {
      const steps = gear.hookupFor(key)
      assert.ok(Array.isArray(steps) && steps.length >= 3 && steps.length <= 5, `${name}: ${steps?.length} steps`)
      const all = steps.join(' ')
      /* The colours, from CME's manual: black INTO the unit's MIDI IN, white into its MIDI OUT. Swapped, nothing gets through. */
      /* The VP4's black plug goes into "that adapter", the one pushed into its MIDI IN in the step before. */
      assert.match(all, key === 'vp4' ? /Push one 3\.5 mm adapter into the VP4’s MIDI IN\. C2MIDI Pro: the black plug \(TO MIDI IN\) into that adapter\./ : /the black plug \(TO MIDI IN\) into the [^.]*MIDI IN/, `${name}: the black plug is not said to go in MIDI IN`)
      /*
       * THE VP4: THE WHITE PLUG LEFT OUT. The app only sends a VP4 its
       * presets and scenes over Bluetooth and reads nothing (lib/bleVp4.js),
       * so the plug that can take power from a unit's MIDI OUT stays out.
       */
      if (key === 'vp4') {
        assert.match(all, /Leave the white plug out: the app only sends to a VP4, and nothing comes back over Bluetooth\./, 'VP4: the white plug is not said to stay out')
        assert.ok(!/into [^.]*MIDI OUT/.test(all), 'VP4: a plug is sent into its MIDI OUT')
      } else assert.match(all, /the white plug \(TO MIDI OUT\) into [^.]*MIDI OUT/i, `${name}: the white plug is not said to go in MIDI OUT`)
      assert.match(all, /the Uhost’s left socket, marked USB Host\/Device/)
      /* The Uhost needs power to host, 5 V and no more, and gets it last, with the unit already started. */
      const power = steps.findIndex((l) => /USB Power/.test(l))
      assert.ok(power > steps.findIndex((l) => /black plug/.test(l)), `${name}: the Uhost is powered before the MIDI side is plugged in`)
      assert.match(steps[power], new RegExp(`^With the ${name} already on, plug a phone charger or power bank into the Uhost’s right socket, marked USB Power \\(5 volts, nothing stronger\\)\\.`))
      if (key === 'axefx3') {
        /* No MIDI Thru setting on the III; its THRU jack only repeats the phone, so the white plug stays out of it. */
        assert.ok(!/MIDI Thru to Off/.test(all), 'the Axe-Fx III is told to change a setting it does not have')
        assert.match(all, /into its MIDI OUT\. Not THRU/)
        assert.equal(steps.at(-1), 'On the Axe-Fx III, open Setup → MIDI/Remote and set Program Change to On, the MIDI channel to 1 (or Omni), PC Mapping to Off, MIDI PC Offset to 0, and Send Realtime Sysex to On.')
      } else if (key === 'am4' || key === 'fm3') {
        assert.ok(all.includes(`On the ${name}, open Setup → MIDI/Remote and set MIDI Thru to Off.`), `${name}: MIDI Thru is not turned off`)
      } else if (key === 'vp4') {
        /* In the VP4's own manual's words (lib/vp4-safety): Receive MIDI PC ON, the channel, and Scene Select for scenes. */
        assert.equal(steps.at(-1), 'On the VP4, open SETUP > MIDI/Remote and set Receive MIDI PC to ON, and the MIDI Channel to 1 (or OMNI). For scenes, set Scene Select too: Settings > VP4 scenes & presets says how.')
        assert.ok(steps.at(-1).includes(src('shared/vp4-safety.mjs').match(/export const VP4_SETUP_TITLE = '([^']+)'/)[1]), 'VP4: the steps name a Settings page the app does not have')
      } else {
        /* The FM9's MIDI Thru, first in the one step that sends the player into its menus, with what Program Change alone and the published tuner need. */
        assert.equal(steps.at(-1), 'On the FM9, open Setup → MIDI/Remote and set MIDI Thru to Off, Program Change to On, the MIDI channel to 1 (or Omni), PC Mapping to Off, MIDI PC Offset to 0, and Send Realtime Sysex to On.')
      }
      /*
       * THE MIDI CHANNEL, on the units whose presets can go by Program Change
       * on channel 1 (bleWire pcChannel), in the guide's words, and with the
       * guide's condition first: only if presets don't change. A preset goes
       * by the unit's own SysEx switch first and by Program Change only when
       * that does not land (trialPreset), and moving the channel or turning
       * PC Mapping off changes how a player's own foot controller works on
       * the unit. So it is never one of the steps everybody follows: changed
       * on purpose on 25 October 2026 (it was the last step, for every
       * owner). Not the AM4, whose presets never go that way.
       */
      /*
       * EXCEPT ON THE FM9 AND AXE-FX III, since the build-out of 25 October
       * 2026: their presets go by Program Change alone (Fractal publishes no
       * SysEx preset switch; bleWire trialPreset), so the settings that needs
       * are one of the steps, and the line for some owners is not drawn.
       */
      if (gear.PC_FIRST.includes(key)) {
        assert.match(all, /Program Change to On, the MIDI channel to 1 \(or Omni\), PC Mapping to Off, MIDI PC Offset to 0, and Send Realtime Sysex to On\./, `${name}: the settings Program Change needs are not a step`)
        assert.equal(gear.midiSettingsFor(key, 'iPad'), null, `${name}: the settings are said twice`)
      } else assert.ok(!/Program Change|PC Mapping/.test(all), `${name}: every owner is told to set up Program Change`)
      if (key === 'am4' || key === 'vp4' || gear.PC_FIRST.includes(key)) assert.equal(gear.midiSettingsFor(key), null, `${name}: the Program Change line for some owners is drawn`)
      else {
        assert.equal(
          gear.midiSettingsFor(key, 'iPad'),
          `If presets don’t change from this iPad: on the ${name}, open Setup → MIDI/Remote and set Program Change to On, the MIDI channel to 1 (or Omni), and PC Mapping to Off.`
        )
        assert.ok(!/MIDI Thru/.test(gear.midiSettingsFor(key)), `${name}: MIDI Thru is in the settings for some owners only`)
      }
      /* The step the power goes in (powerStepOf; the ways page keeps it as powerAt). */
      assert.equal(gear.powerStepOf(key), power, `${name}: the power step is not where it was`)
      if (key === 'am4') assert.match(all, /Push one 3\.5 mm adapter into the AM4’s MIDI IN, and the other into its MIDI OUT\./)
      else if (key !== 'vp4') assert.ok(!/3\.5 mm/.test(all), `${name} is told to use the AM4’s adapters`)
      if (key === 'fm9') assert.match(all, /MIDI OUT\/THRU jack/)
      /* Never a promise that it works there, and never a word on whether it was tried: that is the Developer page's. */
      assert.ok(!/should work the same way|not tried|tried on|has been tried/i.test(all), `${name}: the steps say whether it was tried`)
    }
    /* The AM4 and, since 26 October 2026, the FM3 (with the U2MIDI Pro). */
    assert.deepEqual(gear.TESTED, ['am4', 'fm3', 'axefx3'])
    assert.equal(gear.hookupFor('vp5'), null, 'steps for a unit the page does not offer')
    /* The FM3's MIDI settings, for an owner whose presets don't change, under its steps; none for a unit the page does not know. */
    assert.match(gear.midiSettingsFor('fm3'), /^If presets don’t change from this phone: on the FM3, open Setup → MIDI\/Remote and set Program Change to On/)
    assert.equal(gear.midiSettingsFor('vp4'), null)
    assert.equal(gear.midiSettingsFor('vp5'), null)
    assert.equal(gear.powerStepOf('fm3'), 3, 'the FM3’s power step is not the fourth')
    assert.equal(gear.powerStepOf('vp5'), -1)
    /*
     * No heat check but the FM3's, since 31 October 2026: "The FM three is
     * the only one that ever has overheating issues so we don't need to
     * worry about it for any other devices" (Justin). The FM3's warning and
     * its never-the-C2MIDI line stay, below.
     */
    assert.equal(gear.heatLineFor, undefined, 'a heat check for other units is back')
    assert.equal(gear.HEAT_CHECK, undefined, 'a heat check for other units is back')
    /* The guide says the same about the channel, so the app and the guide do not disagree. */
    const guide = readFileSync(new URL('../public/bluetooth-guide.html', import.meta.url), 'utf8').replace(/\s+/g, ' ')
    /* The FM9 and Axe-Fx III have these among their steps since 25 October 2026 (PC_FIRST), with Send Realtime Sysex for the tuner; the FM3 keeps the line for some owners. */
    assert.match(guide, /FM3, if presets don’t change from the phone:<\/strong> in Setup → MIDI\/Remote, set Program Change on, the MIDI channel to 1 or Omni, and PC Mapping off/)
    assert.match(guide, /FM9 and Axe-Fx III:<\/strong> in Setup → MIDI\/Remote, also set <strong>Program Change<\/strong> on, the <strong>MIDI channel<\/strong> to 1 or Omni, <strong>PC Mapping<\/strong> off, <strong>MIDI PC Offset<\/strong> to 0, and <strong>Send Realtime Sysex<\/strong> on\./)
    assert.ok(!/extra blocks \(Amp 2, Cab 2/.test(guide), 'the guide still says the second blocks do not show')
    assert.match(guide, /FM9:<\/strong> use firmware 7\.00 or later\./)
    assert.match(guide, /Axe-Fx III:<\/strong> use firmware 25\.00 or later\./)
    assert.ok(!/Feel the C2MIDI Pro|feel the C2MIDI Pro/.test(guide), 'the guide tells owners of units other than the FM3 to check the heat again')
    assert.match(gear.GEAR_IN_SHORT, /CME WIDI Uhost, a CME C2MIDI Pro, and a phone charger or power bank/)
    assert.match(gear.GEAR_IN_SHORT, /For an AM4 or VP4, also two Type-A MIDI to 3\.5 mm adapters\./)
    /* One short list for everybody since every unit opened together: the customer's AM4-only list (GEAR_IN_SHORT_AM4) is gone. */
    assert.equal(gear.GEAR_IN_SHORT_AM4, undefined, 'a customer still has a short list of their own')
    /*
     * NEVER THE C2MIDI PRO ON AN FM3, TO EVERYBODY, WHATEVER IS PICKED. Its
     * own line under the units in step 1 on every visit (since 25 October
     * 2026), and the short list does not say it a second time. "Not for an
     * FM3" while the FM3 was not offered to customers; what is not for an
     * FM3 now is the cable.
     */
    assert.equal(gear.NOT_FOR_FM3, 'On an FM3, use the CME U2MIDI Pro, never the C2MIDI Pro or a WIDI Master: both got very hot on one.')
    assert.ok(!/FM3/.test(gear.GEAR_IN_SHORT), 'the short list says the FM3 line a second time, right under step 1')


    /*
     * THE BETA, IN PLAIN WORDS. "Let's just say that Bluetooth is beta though
     * in the app and give like a disclaimer saying that Bluetooth might not
     * function correctly." New, may not work with every unit or adapter,
     * tried so far on what TESTED says, and the cable still works.
     */
    /*
     * IN HIS WORDS, and changed on purpose on 25 October 2026, when Bluetooth
     * (beta) was decided for every customer with the full version: "marked
     * beta with 'Bluetooth is in beta, and some features might not work as
     * expected'", and "super easy for all users to submit bugs and
     * feedback". It opened "Bluetooth is new (beta), and may not work
     * correctly with every unit or adapter". His sentence first, word for
     * word; then where it was tried; then the button straight under the
     * note, by the name the button has; then the way back.
     */
    /* OUT OF BETA, 26 October 2026 ("remove anything that says beta on it for Bluetooth"): it never says beta. */
    /*
     * AND NOT WHERE IT HAS BEEN TRIED, since 31 October 2026: "we don't need
     * to mention really whether or not something has been tested or not, we
     * just need to keep track of it ourselves in the developer menu so that
     * we can confirm it or if someone leaves us a note saying it doesn't
     * work then we can investigate" (Justin). So the note is the button
     * alone, on both phones (it names no phone, so Apple's 2.3.10 has
     * nothing to find), and the record is TRIED_NOTES, drawn on Developer →
     * App health → Tried. Changed on purpose: the note was one per phone,
     * opening "So far, Bluetooth has been tried on…".
     */
    assert.equal(gear.REPORT_NOTE, `Something not working? Tap ${gear.REPORT_BUTTON}.`)
    assert.ok(!/\bbeta\b|tried|this phone|Settings →|Feedback|android|iphone/i.test(gear.REPORT_NOTE), gear.REPORT_NOTE)
    assert.equal(gear.REPORT_BUTTON, 'Report a Bluetooth problem')
    for (const gone of ['BETA_NOTE', 'BETA_NOTE_IPHONE', 'BETA_NOTE_ANDROID', 'betaNote', 'untriedLine', 'untriedSubFor', 'UNTRIED_SUB', 'untriedConnectedLine', 'untriedAboutLine', 'untriedShortLine', 'faultSubFor', 'feelLine', 'WAY_UNTRIED', 'notYetOn']) {
      assert.equal(gear[gone], undefined, `${gone} is back: a sentence a player reads says whether a unit was tried`)
    }
    /* The card that led to the page is gone with the card. */
    assert.equal(gear.BETA_CARD, undefined, 'the old Phone & computer card’s words are back')
    /* The record: one entry for each unit tried, and none for one that was not. */
    assert.deepEqual(Object.keys(gear.TRIED_NOTES).sort(), [...gear.TESTED].sort(), 'TRIED_NOTES and TESTED say different units were tried')
    /* The phone carries the same file, generated (the sync test holds it to the source). */
    const { state } = await import('../scripts/sync-relay-rules.mjs')
    assert.ok(state().some((f) => f.source === '../shared/bluetooth-gear.mjs' && f.target === '../mobile/src/lib/bluetooth-gear.js'))
  })

  /*
   * CONNECT AT THE TOP. "Will you move the connect button up closer to the
   * top? There's a lot of scrolling to figure out what's going on there ...
   * I know it needs all the information about where to get the plugs and how
   * to use them, but it's very messy and confusing right now. It would be
   * cool if, like, a five-year-old could connect it." (24 October 2026.)
   *
   * Changed on purpose from "the page says it is a beta first, and What you
   * need sits between the unit and Connect": the beta note and a paragraph
   * opened the page, and What you need, open for a first setup, put Connect
   * under a shopping list. Now: where it stands, the unit, Connect; then the
   * reading, in rows that open when tapped; then the beta, never folded.
   */
  test('the page opens on the two steps, with one button a page under them, and the report line always shown', () => {
    /*
     * "On the actual Bluetooth screen have the connect steps right there at
     * the top before any warnings or anything ... It should be very
     * streamlined unless there is problems" (Justin, 26 October 2026).
     */
    const page = flat('mobile/src/screens/Bluetooth.js')
    const drawn = page.slice(page.indexOf('return ( <View style={{ gap: space.xl }}>'), page.indexOf('function UnitChips('))
    const at = (what) => {
      const i = drawn.indexOf(what)
      assert.ok(i >= 0, `the page no longer draws ${what}`)
      return i
    }
    const order = [
      '{said.line}',
      '<Heading>1 · Pick your unit</Heading>',
      '<Heading>2 · Connect</Heading>',
      "label={b.looking ? 'Looking…' : 'Connect'}",
      '<Press label="Setup guide"',
      '<Press label="How to connect my Bluetooth device"',
      '<Press label="Troubleshooting"',
      '<Press label="What Bluetooth can’t do"',
      '{onReport ? <Press label={REPORT_BUTTON}',
      '<Hint>{BLUETOOTH_WAYS}</Hint>',
      '<Hint>{REPORT_NOTE}</Hint>'
    ]
    const places = order.map(at)
    for (let i = 1; i < places.length; i++) assert.ok(places[i - 1] < places[i], `${order[i - 1]} is no longer before ${order[i]}`)
    /* The big line only when there is something to say: on, or something wrong. */
    assert.match(page, /const sayIt = b\.on \|\| !!b\.trouble \|\| said\.tone === 'fault'/)
    assert.match(drawn, /\{sayIt \? \( <View style=\{\{ gap: space\.sm \}\}> <Text accessibilityLiveRegion="polite"/)
    /* Nothing a person reads once is on this page: the parts, the steps and the list of differences are each on their own. */
    for (const reading of ['waysFor(', 'hookupFor(', '{FIRST_TIME}', '{POWER_LINE}', 'GEAR_IN_SHORT', 'DIFFERENT.map(', '<Fold ']) assert.ok(!drawn.includes(reading), `${reading} is back on the Bluetooth page`)
    /* Each button opens its page, which Settings draws with ‹ Bluetooth back. */
    assert.match(drawn, /onPress=\{\(\) => onOpen\('bt-ways'\)\}/)
    assert.match(drawn, /onPress=\{\(\) => onOpen\('bt-trouble'\)\}/)
    assert.match(drawn, /onPress=\{\(\) => onOpen\('bt-limits'\)\}/)
    assert.match(drawn, /<Press label="Setup guide" sub="On the website" height=\{52\} onPress=\{\(\) => openLink\(GUIDE_URL\)\} \/>/)
    const settings = flat('mobile/src/screens/Settings.js')
    assert.match(settings, /<BluetoothPage purchase=\{purchase\} admin=\{isAdmin\(account\?\.id\)\} onReport=\{onReportBluetooth\} onOpen=\{setPage\} onConnected=\{onBack\} \/>/)
    assert.match(settings, /\{head\('How to connect my Bluetooth device', 'back'\)\} <BluetoothWays \/>/)
    assert.match(settings, /\{head\('Troubleshooting Bluetooth', 'back'\)\} <BluetoothTrouble onReport=\{onReportBluetooth\} \/>/)
    assert.match(settings, /\{head\('What Bluetooth can’t do', 'back'\)\} <BluetoothLimits \/>/)
    assert.match(settings, /bluetooth: '‹ Bluetooth'/)

    /*
     * The report line, on every visit and on no condition. Where it has been
     * tried is not said here any more: "we don't need to mention really
     * whether or not something has been tested or not, we just need to keep
     * track of it ourselves in the developer menu" (Justin, 31 October 2026).
     */
    assert.ok(!/BETA_NOTE|betaNote|TRIED_NOTES/.test(drawn), 'the page says where Bluetooth has been tried again')
    assert.equal((drawn.match(/\{REPORT_NOTE\}/g) || []).length, 1)
    assert.match(drawn, /<View style=\{\{ gap: space\.sm \}\}> <Hint>\{BLUETOOTH_WAYS\}<\/Hint> <Hint>\{REPORT_NOTE\}<\/Hint> <\/View>/, 'the note is drawn only on some condition')

    /* The list's heading says how many there are: one row is not "More than one". */
    assert.match(page, /b\.looking \? 'Found so far\. Tap yours:' : b\.devices\.length > 1 \? 'More than one is here\. Tap yours:' : 'Tap your adapter:'/, 'a single row is headed More than one is here')
    /* While it is on the unit chips are gone: a line over Stop says which, and how to change it. */
    const onHalf = page.slice(page.indexOf('{b.on ? ( <View'), page.indexOf('<Press label="Stop using Bluetooth"'))
    assert.match(onHalf, /\{b\.unit \? <Hint>\{`Unit: \$\{unitName\(b\.unit\)\}\. Tap Stop to change it\.`\}<\/Hint> : null\}/, 'nothing names the unit while it is on')

    /* A row is a Press like every other button, so it is in the tap log and has the haptic; and it says what a tap does. */
    const fold = page.slice(page.indexOf('function Fold('), page.indexOf('function Row('))
    assert.match(fold, /<Press label=\{title\} sub=\{sub \? `\$\{sub\} · \$\{open \? 'tap to hide' : 'tap to show'\}` : open \? 'Tap to hide' : 'Tap to show'\} height=\{52\} onPress=\{onToggle\} \/>/)
    assert.ok(!/Pressable/.test(page), 'a button on the page that is not a Press, so missing from the tap log')
    assert.match(page, /const openLink = \(url\) => Linking\.openURL\(url\)\.catch\(\(\) => \{\}\)/)

    /*
     * How to connect my Bluetooth device: the unit, then every way for it,
     * each a row, the first open; each way its parts with View on Amazon,
     * the firmware, and its steps.
     */
    const ways = page.slice(page.indexOf('export function BluetoothWays('), page.indexOf('export function BluetoothTrouble('))
    assert.match(ways, /const ways = waysFor\(b\.unit, deviceNoun\(\)\) const \[open, setOpen\] = useState\(0\)/)
    /* With no unit picked, one line to pick one, not the parts list: the parts come with the unit (30 October 2026, "too much to read everywhere you go"). */
    assert.match(ways, /\{!b\.unit \? <Hint>Pick your unit to see what to buy and how it plugs in\.<\/Hint> : null\}/)
    assert.match(ways, /\{warningFor\(b\.unit\) \? <Note tone="fault">\{warningFor\(b\.unit\)\}<\/Note> : null\}/, 'the FM3’s warning is not in front of its way')
    assert.match(ways, /<Press label=\{p\.amazon \? 'View on Amazon' : 'View on the maker’s site'\} height=\{44\} accessibilityLabel=\{p\.amazon \? `View the \$\{p\.name\} on Amazon` : `View the \$\{p\.name\} on the maker’s site`\} onPress=\{\(\) => openLink\(p\.amazon \|\| p\.maker\)\} \/>/)
    assert.match(ways, /\{way\.key === 'uhost' \? <Hint>\{POWER_LINE\}<\/Hint> : null\}/)
    assert.match(ways, /<Hint>\{way\.key === 'uhost' \? FIRST_TIME : FIRST_TIME_ADAPTER\}<\/Hint>/)
    /* Nothing on it says whether a way or a unit was tried (31 October 2026): the record is the Developer page's. */
    assert.ok(!/feelLine|WAY_UNTRIED|untriedUnit|untried\(|\.tried\b/.test(ways), 'the ways page says whether a way or a unit was tried')
    assert.match(ways, /\{b\.unit \? <Hint>\{ONE_AT_A_TIME\}<\/Hint> : null\} \{b\.unit \? <Hint>\{SELLERS_LINE\}<\/Hint> : null\}/)
    /* What Bluetooth can't do: the paragraph, and the list of what is different from USB. */
    const limits = page.slice(page.indexOf('export function BluetoothLimits('), page.indexOf('function Bullet('))
    assert.ok(limits.includes('with no computer. No editing or saving.'))
    assert.ok(limits.includes('<Heading>What’s different from USB</Heading> {DIFFERENT.map('))
    /* The usual reason a connected adapter hears nothing: the plugs swapped. */
    assert.match(page, /\{quiet \? <Hint>\{PLUGS_CHECK\}<\/Hint> : null\}/)

    /* ONE PLACE FOR THE ADDRESSES: no web address typed into the page, and no shop's anywhere in the app but the gear file. */
    assert.ok(!/https?:\/\//.test(code('mobile/src/screens/Bluetooth.js')), 'an address is typed into the page instead of coming from the gear file')
    const files = [fileURLToPath(new URL('../mobile/App.js', import.meta.url))]
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(jsx?|mjs)$/.test(entry)) files.push(full)
      }
    }
    walk(fileURLToPath(new URL('../mobile/src/', import.meta.url)))
    walk(fileURLToPath(new URL('../shared/', import.meta.url)))
    const shops = files.filter((f) => /amazon\.com|cme-pro\.com/.test(readFileSync(f, 'utf8'))).map((f) => f.replaceAll('\\', '/').split(/\/(?=mobile\/|shared\/)/).pop())
    assert.deepEqual(shops.sort(), ['mobile/src/lib/bluetooth-gear.js', 'shared/bluetooth-gear.mjs'], 'a shop’s address lives somewhere other than the gear file')
  })

  test('the website’s Bluetooth guide gives the same addresses to buy from as the app', async () => {
    /*
     * public/bluetooth-guide.html is plain HTML and cannot import the gear file, so
     * this holds it to it: every Amazon and CME link on the guide is one
     * the gear file gives too, and every part the app lists is on the guide
     * at the same address. A link moved in one and not the other fails here,
     * and so does a link to buy an adapter nobody has tried with the app:
     * the gear file gives the three parts and nothing else. (CME's links were
     * added to this check on 10 October; before, it read only Amazon's,
     * though the gear file's header said both.)
     */
    const gear = await import('../shared/bluetooth-gear.mjs')
    const at = new URL('../public/bluetooth-guide.html', import.meta.url)
    assert.ok(existsSync(at), 'the guide the app’s Full setup guide opens is not on the website')
    const html = readFileSync(at, 'utf8')
    const shop = html.match(/https:\/\/(?:www\.)?(?:amazon\.[a-z.]+|cme-pro\.com)\/[^"'\s<>)]*/g) || []
    assert.ok(shop.some((link) => /amazon\./.test(link)), 'the guide gives nowhere to buy the parts')
    for (const link of shop) assert.ok(gear.ALL_LINKS.includes(link), `the guide links ${link}, and the gear file does not give it`)
    /* Only the three parts: an untried adapter is named on the guide, never linked to buy. */
    assert.deepEqual(
      gear.ALL_LINKS.filter((u) => u !== gear.GUIDE_URL).sort(),
      Object.values(gear.PARTS).flatMap((p) => [p.amazon, p.maker]).filter(Boolean).sort(),
      'the gear file gives an address that is not one of the three parts'
    )
    for (const p of Object.values(gear.PARTS)) {
      if (p.amazon) assert.ok(html.includes(`href="${p.amazon}"`), `the guide does not link the ${p.name} where the app does`)
      if (p.maker) assert.ok(html.includes(`href="${p.maker}"`), `the guide does not link CME’s page for the ${p.name} where the gear file does`)
    }
  })
  /* ---------------------------------------------------------------- */
  /* Report a Bluetooth problem: the one report screen                 */
  /* ---------------------------------------------------------------- */

  /*
   * "It should basically be Leave feedback or report a problem. Then a box
   * to type out a message, upload a photo or video, and have the log sent
   * with what devices they're using." (Justin, 29 October 2026, holding
   * Report a Bluetooth problem, which was then seven buttons that each sent a
   * report in one tap.) So every Report a Bluetooth problem opens the one
   * report screen (screens/Report), and what made a Bluetooth report one
   * survives as a line under what was written: that it was opened from
   * Bluetooth, and what the app was saying then (shared/report-rules
   * formMessage). The Bluetooth lines still ride in the log's head.
   */
  test('a report opened from Bluetooth says so under what was written, with the fault it came from, and keeps what was written first', async () => {
    const rules = await import('../shared/report-rules.mjs')
    const ble = await import(pathToFileURL(fileURLToPath(new URL('../mobile/src/lib/bleReport.js', import.meta.url))).href)
    /* The one-tap answers are gone with the screen that drew them. */
    for (const gone of ['REASONS', 'reportNote', 'writeOutNote', 'REPORT_HEAD']) assert.ok(!(gone in ble), `lib/bleReport still has ${gone}`)
    assert.ok(!existsSync(fileURLToPath(new URL('../mobile/src/screens/BluetoothReport.js', import.meta.url))), 'the one-tap Bluetooth report is still in the app')

    /* What was written is the first line, which is what the email's subject is made of. */
    assert.equal(rules.formMessage({ typed: '  It drops after a minute  ' }), 'It drops after a minute')
    assert.equal(rules.formMessage({ typed: 'It drops after a minute', bluetooth: true }), 'It drops after a minute\n\nOpened from Bluetooth.')
    assert.equal(
      rules.formMessage({ typed: 'It drops', bluetooth: true, said: '  No adapter was connected.  ' }),
      'It drops\n\nOpened from Bluetooth. The app said: No adapter was connected.'
    )
    assert.equal(rules.formMessage({ typed: 'It drops', said: '   ' }), 'It drops', 'an empty fault line is sent as one')
    /* Nothing written (only a picture or a video) still says something: a row has to. */
    assert.equal(rules.formMessage({ typed: '   ' }), rules.ATTACHED_ONLY_MESSAGE)
    assert.equal(rules.formMessage({ bluetooth: true }).split('\n')[0], rules.ATTACHED_ONLY_MESSAGE)
    /* Never longer than the box can send: what was written gives way to the line, never the line to it. */
    const long = rules.formMessage({ typed: 'x'.repeat(rules.MAX_MESSAGE), bluetooth: true, said: 'Finding WIDI Uhost…' })
    assert.ok(long.length <= rules.MAX_MESSAGE, `${long.length} characters is longer than a report can carry`)
    assert.ok(long.endsWith('Opened from Bluetooth. The app said: Finding WIDI Uhost…'))
    const row = rules.buildReport({ kind: 'bug', message: long, context: {}, lines: [], format: () => '' })
    assert.equal(row.kind, 'bug')
    assert.notEqual(row.log, null, 'a Bluetooth report goes without its log')
  })

  /*
   * THE WORDS FOR EVERY WRONG PAIRING (shared/bluetooth-gear wrongUnitLine),
   * with the article chosen from the bare name: "An an FM9" was what the
   * page would have said, given the wire's own words, and "An VP4".
   */
  test('the page names the unit that really answered, with the right article, and the way out, for every wrong pairing', async () => {
    const gear = await import('../shared/bluetooth-gear.mjs')
    const { MODEL_NAMES, modelName, BLE_UNITS } = await import(WIRE)
    /* The article said here is the wire's own, for every unit it knows. */
    for (const [byte, said] of Object.entries(MODEL_NAMES)) assert.equal(gear.withArticle(modelName(Number(byte))), said)
    assert.equal(modelName(0x77), null)
    const capital = (s) => s[0].toUpperCase() + s.slice(1)
    const answering = Object.keys(MODEL_NAMES).map((b) => modelName(Number(b)))
    for (const picked of BLE_UNITS.map((u) => u.name)) {
      for (const answered of answering.filter((a) => a !== picked)) {
        /*
         * Every Bluetooth unit is in step 1 for every account on a copy that
         * opens it, the VP4 among them since 25 October 2026 (it was told it
         * "isn't a Bluetooth unit" until then). A unit the wire knows that
         * the page does not offer (none today) goes to the computer, with the
         * line for which units Bluetooth is for, when there is one.
         */
        const his = gear.wrongUnitLine({ answered, picked, pickable: BLE_UNITS.some((u) => u.name === answered) })
        const elsewhere = gear.wrongUnitLine({ answered, picked, pickable: false, forWhich: 'For now, Bluetooth is for these units only.' })
        for (const line of [his, elsewhere]) {
          assert.ok(line.startsWith(`${capital(gear.withArticle(answered))} answered, not the ${picked}. `), line)
          assert.ok(!/\b(an?|An?) (an?|An?)\b/.test(line), `two articles: ${line}`)
          assert.ok(!/this phone/i.test(line), line)
          assert.ok(!/isn’t a Bluetooth unit/.test(line), `a unit is told it is not a Bluetooth unit: ${line}`)
        }
        assert.equal(his, `${capital(gear.withArticle(answered))} answered, not the ${picked}. Tap Stop, pick ${answered} in step 1, then tap Connect.`)
        assert.equal(elsewhere, `${capital(gear.withArticle(answered))} answered, not the ${picked}. For now, Bluetooth is for these units only. Tap Stop, and use the computer for the ${answered}.`)
      }
    }
    assert.equal(gear.wrongUnitLine({ answered: 'VP4', picked: 'AM4', pickable: true }), 'A VP4 answered, not the AM4. Tap Stop, pick VP4 in step 1, then tap Connect.')
    /* The one in the plan, word for word. */
    assert.equal(gear.wrongUnitLine({ answered: 'FM9', picked: 'FM3', pickable: true }), 'An FM9 answered, not the FM3. Tap Stop, pick FM9 in step 1, then tap Connect.')
    assert.equal(gear.wrongUnitLine({ answered: 'Axe-Fx III', picked: 'AM4', pickable: true }), 'An Axe-Fx III answered, not the AM4. Tap Stop, pick Axe-Fx III in step 1, then tap Connect.')
    /* The comment that said only an AM4 is ever named is gone with it. */
    const page = flat('mobile/src/screens/Bluetooth.js')
    assert.ok(!/names nothing else/.test(page), 'the page still says only an AM4 is ever named')
    assert.ok(!/`An \$\{b\.answeredAs\}/.test(page), 'the page writes the article itself again')
  })

  /*
   * THE FM3, ALWAYS IN SIGHT WHEN IT IS PICKED, and the heat line for the
   * units nobody here has (critic, 25 October 2026). How to plug it in,
   * which holds the FM3's full warning, starts folded once an adapter has
   * been used here, and step 1's line is not drawn while Bluetooth is on.
   */
  test('the FM3 picked shows a warning nothing folds away, and the FM9 and Axe-Fx III steps end with feeling the cable', async () => {
    const gear = await import('../shared/bluetooth-gear.mjs')
    assert.equal(
      gear.FM3_NEVER,
      'On an FM3, use the CME U2MIDI Pro: it runs on USB power only, and when we tried it, it worked and stayed cool. Never the WIDI Master or the C2MIDI Pro: on an FM3 both got very hot, and the WIDI Master didn’t work. Nor any adapter that can take power from MIDI OUT, even on USB power: FM3 owners report the same.'
    )
    /* Since 26 October 2026 ("Using the U2midi pro adapter the FM3 works and does not get hot", "The Widi Master did not work on the FM3 and got very hot"): what to use first, then what never to. */
    /* Said as what happened here and what owners report, with no way round it and nothing said as a fact about the unit. */
    assert.ok(!/straight|220|resistor|solder|nothing to limit/i.test(gear.FM3_NEVER))
    /*
     * EVEN ON USB POWER, as the full warning and the guide say: the only FM3
     * line drawn with the fold closed read, to the owner of a WIDI Jack on a
     * USB charger, as not about their adapter. "Can take" power, so one that
     * runs on USB power alone, never from the jack, is not in it.
     */
    assert.match(gear.FM3_NEVER, /any adapter that can take power from MIDI OUT, even on USB power/, 'the FM3 line that is never folded away leaves out USB power')
    assert.match(gear.FM3_WARNING, /even on USB power/)
    /* The guide and the notes say the same thing. */
    const guide = readFileSync(new URL('../public/bluetooth-guide.html', import.meta.url), 'utf8').replace(/\s+/g, ' ')
    assert.match(guide, /keep the C2MIDI Pro, the WIDI Master, and any adapter that takes its power from the MIDI OUT jack, off an FM3/)
    assert.match(guide, /Powering the adapter from USB doesn’t stop it, because the jack is still feeding it\./)
    const notes = readFileSync(new URL('../docs/bluetooth-midi.md', import.meta.url), 'utf8').replace(/\s+/g, ' ')
    assert.match(notes, /Every adapter that feeds from MIDI Out runs hot on an FM3/)
    const page = flat('mobile/src/screens/Bluetooth.js')
    /* And whenever an FM3 is the unit that answered a connection made for another unit (review of 25 October 2026). */
    /* Off with the FM3 picked: under the units. On, or answered when another was picked: under the line that says where it stands. Never folded. */
    const at = page.indexOf("{(b.on && b.unit === 'fm3') || (b.answeredAs === 'FM3' && b.unit !== 'fm3') ? <Note tone=\"fault\">{FM3_NEVER}</Note> : null}")
    assert.ok(at > 0, 'the FM3 line is not drawn while it is on with the FM3, or when the FM3 answered')
    assert.ok(at > page.indexOf('{said.line}') && at < page.indexOf('{b.on ? ( <View'), 'the FM3 line is inside one half of the page')
    const off = page.indexOf("{b.unit === 'fm3' ? <Note tone=\"fault\">{FM3_NEVER}</Note> : null}")
    assert.ok(off > page.indexOf('<Heading>1 · Pick your unit</Heading>') && off < page.indexOf('<Heading>2 · Connect</Heading>'), 'the FM3 line is not under the units when the FM3 is picked')
    assert.equal((page.match(/\{FM3_NEVER\}/g) || []).length, 2)
    /*
     * The steps, numbered, and nothing between them: the heat line that
     * followed the power step on the units nobody here had run is gone
     * (31 October 2026, "The FM three is the only one that ever has
     * overheating issues", Justin). The FM3's warning above is all of it.
     */
    const way = page.slice(page.indexOf('function Way('), page.indexOf('export function BluetoothTrouble('))
    assert.match(
      way,
      /\{way\.steps\.map\(\(line, i\) => \( <View key=\{line\} style=\{[^}]*\}\}> <Text [^>]*>\{`\$\{i \+ 1\}\.`\}<\/Text> <Text [^>]*>\{line\}<\/Text> <\/View> \)\)\}/,
      'something is drawn between the steps'
    )
    for (const u of ['am4', 'fm3', 'fm9', 'axefx3', 'vp4']) {
      for (const w of gear.waysFor(u)) {
        assert.equal(w.feelLine, undefined, `${u} ${w.key}: a heat line is back`)
        assert.match(w.steps[w.powerAt], /power|charger/i, `${u} ${w.key}: powerAt is not the step that powers it`)
      }
    }
    /* On the FM9 and the Axe-Fx III, that is after step 4 (the power) and before step 5 (the unit's own settings). */
    assert.equal(gear.powerStepOf('fm9'), 3)
    assert.match(gear.hookupFor('fm9')[4], /^On the FM9, open Setup → MIDI\/Remote/)
    assert.equal(gear.powerStepOf('axefx3'), 3)
    assert.match(gear.hookupFor('axefx3')[4], /^On the Axe-Fx III, open Setup → MIDI\/Remote/)
    /* The Program Change settings, for some owners only: under the ways, with their condition, never numbered among them. */
    const ways = page.slice(page.indexOf('export function BluetoothWays('), page.indexOf('function Way('))
    assert.match(ways, /const midi = midiSettingsFor\(b\.unit, deviceNoun\(\)\)/)
    assert.ok(ways.indexOf('{midi ? <Hint>{midi}</Hint> : null}') > ways.indexOf('{ways.map('), 'the Program Change settings are among the steps')
    assert.ok(ways.indexOf('{midi ? <Hint>{midi}</Hint> : null}') < ways.indexOf('<Hint>{ONE_AT_A_TIME}</Hint>'))
  })

  test('the Gen 3 testing tools switch the first effect off and back, and leave it as it was', async () => {
    const { CHECK_STEPS } = await import(WIRE)
    assert.deepEqual(
      CHECK_STEPS.gen3.writes.find((s) => s.step === 'write-bypass'),
      {
        step: 'write-bypass',
        label: 'Effect: off and back',
        does: 'Switches the first effect off, or on, then puts it back as it was.',
        /* Said before it is tapped (review of 25 October 2026): on an amp-and-cab preset it is the amp. */
        warn: 'If the preset has only an amp and a cab, it switches the amp, so the sound changes for a moment until it is back on.'
      }
    )
    for (const unit of ['fm3', 'fm9', 'axefx3']) {
      const t = await onTheLine(unit)
      const model = t.sx.MODELS[unit]
      const before = t.unit.state.blocks.map((b) => ({ ...b }))
      const r = await drive(t.clock, t.wire.check('write-bypass'))
      assert.equal(r.ok, true, `${unit}: ${r.error}`)
      /* Compressor 1, the first effect before the amp and the cab: off in this preset, so on, then off again. Never the input or output. */
      const bypasses = t.frames().filter((f) => f[5] === 0x0a).map(hex)
      assert.deepEqual(bypasses, [t.sx.buildSetBypass(model, 46, false), t.sx.buildSetBypass(model, 46, true)].map(hex), `${unit}: the switches sent`)
      assert.deepEqual(t.unit.state.blocks, before, `${unit}: the block was not put back as it was`)
      assert.ok(r.rows.some((row) => /it worked/.test(row.meaning)), `${unit}: the check did not read whether it changed`)
      assert.deepEqual(t.events.at(-1), { type: 'changed', scope: 'grid' })
    }
    /*
     * THE AMP AND THE CAB LISTED FIRST: the pretend preset above happens to
     * list the compressor before them, so a check that took whatever came
     * first passed it. Here the amp and the cab come before the effects, and
     * the first effect after them is switched, never the amp (a silent rig
     * for the moment it takes) or the cab.
     */
    const ampFirst = await onTheLine('fm9')
    ampFirst.unit.state.blocks.splice(
      0,
      ampFirst.unit.state.blocks.length,
      { eid: 37, bypassed: false, channel: 0 },
      { eid: 58, bypassed: false, channel: 0 },
      { eid: 62, bypassed: false, channel: 0 },
      { eid: 118, bypassed: false, channel: 0 },
      { eid: 66, bypassed: true, channel: 0 },
      { eid: 42, bypassed: false, channel: 0 }
    )
    const kept = ampFirst.unit.state.blocks.map((b) => ({ ...b }))
    const a = await drive(ampFirst.clock, ampFirst.wire.check('write-bypass'))
    assert.equal(a.ok, true, a.error)
    const switched = ampFirst.frames().filter((f) => f[5] === 0x0a)
    assert.deepEqual(switched.map(hex), [ampFirst.sx.buildSetBypass(0x12, 118, true), ampFirst.sx.buildSetBypass(0x12, 118, false)].map(hex), 'the check did not switch the first effect after the amp and cab')
    assert.ok(!switched.some((f) => [58, 62].includes(ampFirst.sx.decode14(f[6], f[7]))), 'the amp or the cab was switched off')
    assert.deepEqual(ampFirst.unit.state.blocks, kept)
    /* A preset with nothing but the amp and the cab to switch: the amp, the first of them, and put back, rather than nothing to check. */
    const ampOnly = await onTheLine('fm3')
    ampOnly.unit.state.blocks.splice(0, ampOnly.unit.state.blocks.length, { eid: 37, bypassed: false, channel: 0 }, { eid: 58, bypassed: false, channel: 0 }, { eid: 62, bypassed: false, channel: 0 }, { eid: 42, bypassed: false, channel: 0 })
    const o = await drive(ampOnly.clock, ampOnly.wire.check('write-bypass'))
    assert.equal(o.ok, true, o.error)
    assert.deepEqual(ampOnly.frames().filter((f) => f[5] === 0x0a).map(hex), [ampOnly.sx.buildSetBypass(0x11, 58, true), ampOnly.sx.buildSetBypass(0x11, 58, false)].map(hex))
    assert.equal(ampOnly.unit.state.blocks.find((b) => b.eid === 58).bypassed, false, 'the amp was left off')
    /* The cab listed before the amp: still the amp, as the step's warning says, never the cab. */
    const cabFirst = await onTheLine('fm3')
    cabFirst.unit.state.blocks.splice(0, cabFirst.unit.state.blocks.length, { eid: 37, bypassed: false, channel: 0 }, { eid: 62, bypassed: false, channel: 0 }, { eid: 58, bypassed: false, channel: 0 }, { eid: 42, bypassed: false, channel: 0 })
    const c = await drive(cabFirst.clock, cabFirst.wire.check('write-bypass'))
    assert.equal(c.ok, true, c.error)
    assert.deepEqual(cabFirst.frames().filter((f) => f[5] === 0x0a).map(hex), [cabFirst.sx.buildSetBypass(0x11, 58, true), cabFirst.sx.buildSetBypass(0x11, 58, false)].map(hex), 'with the cab listed first, the check switched the cab, not the amp its warning names')
    assert.equal(cabFirst.unit.state.blocks.find((b) => b.eid === 58).bypassed, false, 'the amp was left off')
    /* A preset with nothing but the input and output: nothing is switched. */
    const bare = await onTheLine('fm3')
    bare.unit.state.blocks.splice(0, bare.unit.state.blocks.length, { eid: 37, bypassed: false, channel: 0 }, { eid: 42, bypassed: false, channel: 0 })
    const r = await drive(bare.clock, bare.wire.check('write-bypass'))
    assert.equal(r.ok, false)
    assert.match(r.error, /no effect to switch/)
    assert.ok(!bare.frames().some((f) => f[5] === 0x0a), 'the input or output was switched')
    /* The AM4's own check is as it was. */
    assert.ok(CHECK_STEPS.am4.writes.some((s) => s.step === 'write-bypass'))
  })

  /*
   * THE WAYS FOUND, IN THE LOG'S HEAD: how each command goes to the unit
   * picked, so a report from an FM9 says whether its scenes went the
   * published way. Within the head's byte budget, and absent with Bluetooth
   * off on anything but a Bluetooth report from an account it is open to
   * (the head test above holds that for every Bluetooth line).
   */
  test('the log head says the ways found for the unit picked, in the testing tools’ own names, within its byte budget', async () => {
    const r = await import(pathToFileURL(fileURLToPath(new URL('../mobile/src/lib/bleReport.js', import.meta.url))).href)
    const { headLines, HEAD_BYTES } = await import('../shared/report-rules.mjs')
    assert.equal(r.waysLine(null), undefined, 'a ways line with no unit picked')
    assert.equal(r.waysLine({ learned: {}, forced: {}, pcChannel: 1 }), 'none found yet')
    assert.equal(
      r.waysLine({ learned: { scene: 'published', preset: 'sysex', tuner: 'push', tempo: 'edit' }, forced: { channel: 'edit' }, pcChannel: 1 }),
      'scene Published, channel FM3-Edit’s (chosen), tempo FM3-Edit’s, preset SysEx, tuner Push'
    )
    assert.equal(r.waysLine({ learned: { preset: 'pc' }, forced: { scene: 'published' }, pcChannel: 3 }), 'scene Published (chosen), preset Program Change, Program Change on channel 3')
    assert.equal(r.bluetoothHead({ unit: 'FM9', ways: { learned: { scene: 'published' }, forced: {} } })['bluetooth ways'], 'scene Published')
    /* Every way at once, forced, on the longest names a head can have: still whole, under the budget. */
    const everything = { learned: {}, forced: { scene: 'published', channel: 'edit', tempo: 'edit', preset: 'pc', tuner: 'push' }, pcChannel: 16 }
    const head = headLines({
      app: 'Fractal Remote (phone) v1.88.8',
      'store copy': '1.88.3 · Bluetooth for customers: closed',
      platform: 'android 35',
      unit: 'Axe-Fx III',
      preset: `1023 ${'X'.repeat(32)}`,
      link: `Bluetooth, connected, through ${'W'.repeat(64)}`,
      ...r.bluetoothHead({ unit: 'Axe-Fx III', answeredAs: 'FM9', phase: 'connected', trouble: 'restricted', adapter: 'W'.repeat(64), ways: everything })
    })
    assert.ok(Buffer.byteLength(head) < HEAD_BYTES / 2, `the head is ${Buffer.byteLength(head)} bytes`)
    assert.match(head, /^bluetooth ways: scene Published \(chosen\), channel FM3-Edit’s \(chosen\), tempo FM3-Edit’s \(chosen\), preset Program Change \(chosen\), tuner Push \(chosen\), Program Change on channel 16$/m)
    /*
     * lib/bluetooth hands the head what the unit picked has learned, and
     * nothing for no unit, or for an AM4, which has one way for everything
     * and never learns one: its head said "none found yet" on every report.
     */
    const lib = flat('mobile/src/lib/bluetooth.js')
    /* Not for an AM4 or a VP4, which have one way for each and learn none. */
    assert.match(lib, /ways: saved\.unit && saved\.unit !== 'am4' && saved\.unit !== 'vp4' \? waysFor\(saved\.unit\) : null/)
    assert.match(lib, /return \{ learned: \{ \.\.\.m\.learned \}, forced, pcChannel: m\.pcChannel \}/)
  })

  test('a Bluetooth report’s log head says the unit picked, the one that answered, where the link stood and the adapter by its name, never its address', async () => {
    const r = await import(pathToFileURL(fileURLToPath(new URL('../mobile/src/lib/bleReport.js', import.meta.url))).href)
    const { headLines } = await import('../shared/report-rules.mjs')
    assert.deepEqual(r.bluetoothHead({ unit: 'AM4', phase: 'connected', adapter: 'WIDI Uhost Bluetooth' }), {
      'bluetooth unit': 'AM4',
      'bluetooth link': 'connected',
      'answered as': undefined,
      adapter: 'WIDI Uhost Bluetooth',
      'bluetooth ways': undefined
    })
    /* No unit answering in its place is said by saying nothing (headLines leaves an empty line out). */
    assert.ok(!/answered as/.test(headLines(r.bluetoothHead({ unit: 'AM4', phase: 'connected', adapter: 'WIDI' }))))
    assert.match(headLines(r.bluetoothHead({ unit: 'FM3', answeredAs: 'AM4', phase: 'connected', adapter: 'WIDI' })), /^answered as: AM4$/m)
    /* What is in the way, in words, beside where it stands. */
    assert.equal(r.bluetoothHead({ phase: 'off', trouble: 'permission' })['bluetooth link'], 'off · Bluetooth is not allowed for the app')
    assert.equal(r.bluetoothHead({ phase: 'no-adapter' })['bluetooth link'], 'on, no adapter chosen')
    assert.equal(r.bluetoothHead({})['bluetooth unit'], 'none picked')
    assert.equal(r.bluetoothHead({ adapter: null }).adapter, 'none chosen')
    assert.equal(r.bluetoothHead({ adapter: '' }).adapter, 'one with no name')

    /*
     * And from lib/bluetooth itself, on a bench: the facts it hands the head.
     * An adapter whose only name is its Bluetooth address (what Android falls
     * back to) is "one with no name" in the head, and the address is nowhere.
     */
    const ADDRESS = 'AA:BB:CC:DD:EE:FF'
    const bench = await bluetoothOnABench({ mod: iphoneModule('allowedAlways').mod })
    try {
      const { ADMINS } = await import('../shared/admin.mjs')
      bench.ble.allowBluetooth(ADMINS[0])
      assert.deepEqual(bench.ble.bluetoothFacts(), { unit: null, answeredAs: null, phase: 'off', trouble: null, adapter: null, ways: null })
      bench.ble.setBluetoothUnit('fm3')
      bench.ble.chooseAdapter({ id: ADDRESS, name: ADDRESS })
      bench.ble.noteBluetooth({ answeredAs: 'AM4', trouble: 'bluetooth-off' })
      const facts = bench.ble.bluetoothFacts()
      /* "FM3", plain, since it ran on one with the U2MIDI Pro (26 October 2026; shared/bluetooth-gear unitForReport). */
      assert.deepEqual(facts, { unit: 'FM3', answeredAs: 'AM4', phase: 'off', trouble: 'bluetooth-off', adapter: '', ways: { learned: {}, forced: {}, pcChannel: 1 } })
      /* An AM4 learns no way and has one for everything: its head says nothing about ways, not "none found yet". */
      bench.ble.setBluetoothUnit('am4')
      assert.equal(bench.ble.bluetoothFacts().ways, null, 'an AM4’s head is handed ways it never learns')
      assert.ok(!/bluetooth ways/.test(headLines(r.bluetoothHead(bench.ble.bluetoothFacts()))), 'an AM4’s head says how each command goes')
      bench.ble.setBluetoothUnit('fm3')
      const head = headLines(r.bluetoothHead(facts))
      assert.ok(!head.includes(ADDRESS), 'the head names the adapter by its Bluetooth address')
      assert.match(head, /^adapter: one with no name$/m)
      assert.match(head, /^bluetooth unit: FM3$/m)
      /* A VP4, like an AM4, has one way for each and learns none: no ways in its head. */
      bench.ble.setBluetoothUnit('vp4')
      assert.equal(bench.ble.bluetoothFacts().ways, null, 'a VP4’s head is handed ways it never learns')
      assert.equal(bench.ble.bluetoothFacts().unit, 'VP4 (not tried yet)')
      bench.ble.setBluetoothUnit('fm3')
      /* An adapter with a name of its own is named by it. */
      bench.ble.chooseAdapter({ id: '1:2', name: 'WIDI Uhost Bluetooth' })
      assert.equal(bench.ble.bluetoothFacts().adapter, 'WIDI Uhost Bluetooth')
    } finally {
      bench.done()
    }
  })

  /*
   * THE HEAD, RUN. lib/logHead.js copied beside stand-ins for the link, the
   * switch and lib/bluetooth, so what a report's log starts with is read off
   * the function itself: the Bluetooth lines over Bluetooth on every report,
   * with Bluetooth off only on a Bluetooth report from an account it is open
   * to, and never on anybody else's.
   */
  test('the log head carries how Bluetooth stood over Bluetooth, on a Bluetooth report, and on nothing a customer without it sends', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ble-head-'))
    try {
      const real = (f) => pathToFileURL(fileURLToPath(new URL(f, import.meta.url))).href
      let head = src('mobile/src/lib/logHead.js')
      const swaps = [
        ["from 'react-native'", "from './rn.js'"],
        ["from './version'", "from './state.js'"],
        ["from './link'", "from './state.js'"],
        ["from './bleSwitch'", "from './state.js'"],
        ["from './bluetooth'", "from './state.js'"],
        ["from './bleReport'", `from '${real('../mobile/src/lib/bleReport.js')}'`],
        ["from './demo'", "from './state.js'"],
        ["from './report-rules'", `from '${real('../shared/report-rules.mjs')}'`]
      ]
      for (const [from, to] of swaps) {
        assert.ok(head.includes(from), `lib/logHead no longer imports ${from}: the bench needs telling`)
        head = head.replace(from, to)
      }
      writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
      writeFileSync(join(dir, 'rn.js'), "export const Platform = { OS: 'ios', Version: '18.1' }\n")
      writeFileSync(
        join(dir, 'state.js'),
        [
          'export const s = { on: false, allowed: false, demo: false, link: { link: "connected", macName: "MacBook Pro", hostVersion: "1.88.8" } }',
          "export const APP_VERSION = '1.88.8'",
          'export const linkState = () => s.link',
          'export const bluetoothOn = () => s.on',
          'export const isDemo = () => s.demo',
          'export const bluetoothAllowed = () => s.allowed',
          'export const bluetoothAdmin = () => false',
          'export const openForCustomersHere = () => false',
          "export const builtInVersion = () => '1.88.3'",
          /* An FM9's facts, with a way learned; an AM4's (s.am4) as lib/bluetooth hands them, with no ways at all. */
          "export const bluetoothFacts = () => (s.am4 ? { unit: 'AM4', answeredAs: null, phase: s.on ? 'connected' : 'off', trouble: null, adapter: 'WIDI Uhost Bluetooth', ways: null } : { unit: 'FM9', answeredAs: null, phase: s.on ? 'connected' : 'off', trouble: null, adapter: 'WIDI Uhost Bluetooth', ways: { learned: { tempo: 'published' }, forced: {}, pcChannel: 1 } })"
        ].join('\n')
      )
      writeFileSync(join(dir, 'logHead.js'), head)
      const { s } = await import(pathToFileURL(join(dir, 'state.js')).href)
      const { logHeader } = await import(pathToFileURL(join(dir, 'logHead.js')).href)
      const { headLines } = await import('../shared/report-rules.mjs')
      const BLE_KEYS = ['bluetooth unit', 'bluetooth link', 'adapter', 'bluetooth ways']
      const has = (h) => BLE_KEYS.filter((k) => k in h)

      /* A customer through the computer: nothing about Bluetooth, on the Feedback form or the log screen, whoever they are. */
      assert.deepEqual(has(logHeader({ deviceName: 'FM3' })), [])
      s.allowed = true
      assert.deepEqual(has(logHeader({ deviceName: 'FM3' })), [], 'a report that is not about Bluetooth says how Bluetooth stood with it off')
      /* The Feedback form's own default (bluetooth = false) is the same head. */
      assert.deepEqual(has(logHeader({ deviceName: 'FM3', bluetooth: false })), [], 'the Feedback form’s default head says how Bluetooth stood')
      /* A Bluetooth report with it off, from an account it is open to: it says. From one it is not open to: it does not. */
      assert.deepEqual(has(logHeader({ deviceName: 'FM3', bluetooth: true })), BLE_KEYS)
      assert.equal(logHeader({ bluetooth: true })['bluetooth link'], 'off')
      s.allowed = false
      assert.deepEqual(has(logHeader({ deviceName: 'FM3', bluetooth: true })), [], 'a Bluetooth report from an account it is not open to names it')
      /* Over Bluetooth: on every report and every Copy Logs, beside the link line. */
      s.on = true
      s.link = { link: 'connected', macName: 'WIDI Uhost Bluetooth' }
      const over = logHeader({ deviceName: 'FM9' })
      assert.deepEqual(has(over), BLE_KEYS)
      assert.equal(over.link, 'Bluetooth, connected, through WIDI Uhost Bluetooth')
      assert.equal(over['bluetooth unit'], 'FM9')
      assert.equal(over['bluetooth link'], 'connected')
      assert.equal(over['bluetooth ways'], 'tempo Published', 'over Bluetooth the head does not say the ways found')
      assert.ok(!('computer' in over), 'over Bluetooth the head names a computer')
      /* An AM4 over Bluetooth: the same lines, bar the ways, which it never learns (no "none found yet" on every AM4 report). */
      s.am4 = true
      const am4 = logHeader({ deviceName: 'AM4' })
      assert.equal(am4['bluetooth unit'], 'AM4')
      assert.equal(am4['bluetooth ways'], undefined, 'an AM4’s head says how each command goes')
      assert.ok(!/^bluetooth ways:/m.test(headLines(am4)), 'an AM4’s written head has a ways line')
      assert.match(headLines(am4), /^bluetooth unit: AM4$/m)
      s.am4 = false
      /* Never in the demo, which is reaching nothing. */
      s.demo = true
      assert.deepEqual(has(logHeader({ deviceName: 'AM4' })), [])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }

    /*
     * The report screen asks for it only when a Bluetooth place opened it
     * (`bluetooth`, false by default, App.js reportAbout), and the log screen
     * never does, so a customer's head is what it was.
     */
    assert.match(flat('mobile/src/screens/Report.js'), /headLines\(logHeader\(\{ deviceName, preset, bluetooth \}\)\)/)
    assert.match(flat('mobile/src/screens/Report.js'), /export default function Report\(\{ onBack, bluetooth = false, said = null \}\)/)
    assert.match(flat('mobile/src/screens/Log.js'), /headLines\(logHeader\(\{ deviceName, preset \}\)\)/)
    /*
     * IN THE LOG, NEVER IN THE DETAILS. lib/reports context goes with every
     * report, a suggestion too, and the privacy page and the form's small
     * print list exactly what is in it. Nothing about Bluetooth goes in it.
     */
    const ctx = code('mobile/src/lib/reports.js')
    const body = ctx.slice(ctx.indexOf('export function context('), ctx.indexOf('export function logPreview('))
    assert.ok(body.length > 100, 'lib/reports context moved; this check reads it')
    assert.ok(!/bluetooth|adapter|bleUnit|answeredAs|topic/i.test(body), 'a report’s details carry Bluetooth facts the privacy page does not list')
    const { contextFrom } = await import('../shared/report-rules.mjs')
    assert.deepEqual(Object.keys(contextFrom({ version: '1', adapter: 'WIDI', bleUnit: 'AM4', unit: 'AM4' })), ['version', 'unit'], 'the report’s details take keys the privacy page does not list')
  })

  /*
   * THE PRIVACY PAGE IS WRITTEN FROM THIS LIST (docs/app-store.md, step 12),
   * so the list says what the head above does (review of 25 October 2026):
   * the Bluetooth lines go on every log sent while the app is on Bluetooth,
   * the Feedback form's and Send logs to developer's too, not on the
   * Bluetooth report alone; and each report button by the name it has where
   * it is drawn, not all of them as "Report this".
   */
  test('the privacy to-do for 1.89.0 says the Bluetooth lines go on every log sent over Bluetooth, and names each report button as the app draws it', async () => {
    const { REPORT_BUTTON } = await import('../shared/bluetooth-gear.mjs')
    const store = flat('docs/app-store.md')
    const bullet = store.slice(store.indexOf('**privacy.html**, both stores'), store.indexOf('**support.html**, the App Store'))
    assert.ok(bullet.length > 500, 'step 12’s privacy.html bullet moved; this check reads it')
    assert.ok(!/On those reports the log's head/.test(bullet), 'the list says the Bluetooth lines go with the Bluetooth report alone')
    assert.ok(
      bullet.includes('while the app is on Bluetooth, the head of every log that is sent (any bug report with its log: this one, the Feedback form, Send logs to developer) and of Copy Logs also says'),
      'the list does not say the Bluetooth lines go on every log sent over Bluetooth'
    )
    /* Each button, as it is drawn, and as the list names it. */
    for (const [file, drawn, named] of [
      ['mobile/src/screens/Bluetooth.js', '<Press label="Report this"', 'Report this beside a fault there'],
      ['mobile/src/screens/Stage.js', '<Press label="Report this" sub="Bluetooth"', "and on Play's fault card"],
      ['mobile/src/components/TopBar.js', '>Report a problem</Text>', "Report a problem under Play's pill"],
      ['mobile/App.js', '<Press label={REPORT_BUTTON} onPress={() => onReport(said)} />', `${REPORT_BUTTON} on the waiting screen`]
    ]) {
      assert.ok(flat(file).includes(drawn), `${file} no longer draws ${drawn}; this check needs telling`)
      assert.ok(bullet.includes(named), `the privacy list does not name the button in ${file} as it is drawn ("${named}")`)
    }
    /* And the last fault, on the website as on the phone, only with the log. */
    assert.ok(bullet.includes('The phone and the website both send that last fault only with the log'), 'the list still says the website sends the last fault without the log')
  })

  test('every Report a Bluetooth problem opens the one report screen, with the Bluetooth lines and the fault it came from, through the page’s gate', () => {
    const form = flat('mobile/src/screens/Report.js')
    /* Two props, both off unless a Bluetooth place opened it: the log's head, and the line under what was written. */
    assert.match(form, /export default function Report\(\{ onBack, bluetooth = false, said = null \}\)/)
    assert.match(form, /const extra = \(\) => \(\{ head: headLines\(logHeader\(\{ deviceName, preset, bluetooth \}\)\), before: runsBefore\(before\) \}\)/)
    assert.match(form, /message: formMessage\(\{ typed: message, bluetooth, said \}\),/)
    /* The fault it was opened from is said on the screen, so they know it goes too. */
    assert.match(form, /\{said \? <Note>\{`This goes with it: \$\{said\}`\}<\/Note> : null\}/)
    const formCode = code('mobile/src/screens/Report.js').replace(/\s+/g, ' ')
    assert.ok(!/bleReport|topic|REASONS/i.test(formCode), 'the report screen has grown a Bluetooth report of its own again')
    /* Help is Justin's own channel: no address anywhere else, and nobody sent to Fractal. */
    assert.ok(!/https?:|Fractal Audio|forum/i.test(formCode), 'the report screen sends a player somewhere else for help')
    assert.ok(!/this phone/i.test(src('mobile/src/screens/Report.js').replace(/\/\*[\s\S]*?\*\//g, '')), 'the report screen says “this phone”')

    /* App draws it once, for every way in; the Bluetooth half only through the page's gate. */
    const app = flat('mobile/App.js')
    assert.match(
      app,
      /\) : screen === 'report' \? \( \/\*[^]*?\*\/ <Report onBack=\{\(\) => setScreen\(reportFrom\)\} bluetooth=\{reportAbout === 'bluetooth' && bluetoothOffered\} said=\{reportAbout === 'bluetooth' && bluetoothOffered \? reportSaid : null\} \/> \)/
    )
    assert.equal((app.match(/<Report /g) || []).length, 1, 'the report screen is drawn somewhere else too')
    assert.ok(!/BluetoothReport|writeOutNote|writingOut/.test(code('mobile/App.js')), 'App still opens the one-tap Bluetooth report')
    /* One screen, so Back, the swipe and Android's back go to the one reportFrom. */
    assert.match(app, /report: reportFrom,/)
  })

  test('every way to Report a Bluetooth problem goes through the Bluetooth page’s own gate, and comes back where it was opened', () => {
    const app = flat('mobile/App.js')
    /* One handler, null unless the page itself would be drawn: no button for anybody the page is not drawn for. */
    assert.match(app, /const reportBluetooth = bluetoothOffered \? \(from, said = null\) => openReport\(from, 'bluetooth', said\) : null/)
    assert.match(app, /const openReport = \(from, about = null, said = null\) => \{ \/\*[^]*?\*\/ if \(from !== 'report'\) setReportFrom\(from\) setReportAbout\(about\) setReportSaid\(typeof said === 'string' && said\.trim\(\) \? said\.trim\(\) : null\) setScreen\('report'\) \}/)
    /* Each place, and where Done comes back to. */
    assert.match(app, /onReport=\{reportBluetooth && !typingReport \? \(said\) => reportBluetooth\(screen, said\) : null\}/, 'the note under the pill does not come back to the screen it was opened over')
    /*
     * NEVER OVER A REPORT. The pill's note is drawn over every screen, the
     * report screen and the log screen too, where its Report a problem would
     * open a fresh report in their place and lose what was typed, and the
     * pictures and video. Every report is typed into now, so it is never
     * offered over one.
     */
    assert.match(app, /const typingReport = screen === 'report' \|\| screen === 'log'/)
    assert.equal((app.match(/typingReport/g) || []).length, 3, 'typingReport is used somewhere else, or not by the pill')
    assert.equal((app.match(/onReport=\{reportBluetooth \? \(said\) => reportBluetooth\('stage', said\) : null\}/g) || []).length, 2, 'Play’s fault card and the waiting screen do not both come back to Play')
    assert.match(app, /onReportBluetooth=\{reportBluetooth \? \(said\) => reportBluetooth\('settings', said\) : null\}/)
    /* The Feedback form from Settings is the Feedback form, as it was. */
    assert.match(app, /onOpenReport=\{\(\) => openReport\('settings'\)\}/)
    assert.equal((app.match(/openReport\(/g) || []).length, 2, 'something else opens a report')

    /* Settings hands the page what App gave it, null when App gave nothing. */
    const settings = flat('mobile/src/screens/Settings.js')
    assert.match(settings, /onReportBluetooth = null,/)
    assert.match(settings, /<BluetoothPage purchase=\{purchase\} admin=\{isAdmin\(account\?\.id\)\} onReport=\{onReportBluetooth\} onOpen=\{setPage\} onConnected=\{onBack\} \/>/)

    /* The waiting screen: over Bluetooth only, in the fifteen-second block where a stuck player sits, with the line it is stuck on. */
    const waking = app.slice(app.indexOf('function Waking('))
    assert.match(waking, /^function Waking\(\{ link, long, onRetry, onSwitch, onTroubleshoot, onBluetooth, onReport, onSetlists \}\)/)
    assert.match(waking, /\{bluetooth && onReport \? <Press label=\{REPORT_BUTTON\} onPress=\{\(\) => onReport\(said\)\} \/> : null\}/)
    assert.ok(waking.indexOf('onReport(said)') > waking.indexOf("{long && link.link !== 'connected' ? ("), 'the waiting screen’s report is drawn before the advice')
  })

  test('the Bluetooth page has Report a Bluetooth problem under its steps, and Report this beside what is wrong, never under the permission line', () => {
    const page = flat('mobile/src/screens/Bluetooth.js')
    const drawn = page.slice(page.indexOf('return ( <View style={{ gap: space.xl }}>'), page.indexOf('const openLink ='))
    /* The big one, last of the buttons under the steps, on every visit, never folded, by the name the note gives it. */
    assert.match(drawn, /\{onReport \? <Press label=\{REPORT_BUTTON\} sub="Or tell us it works" height=\{52\} onPress=\{\(\) => onReport\(null\)\} \/> : null\}/)
    assert.ok(!drawn.slice(0, drawn.indexOf('function UnitChips(')).includes('<Fold '), 'the report button is inside a row that has to be opened')
    /* Report this: beside each fault line, the plugs hint, No adapter and the search's own note; never beside the permission line or Unlock. */
    assert.match(page, /const reportable = said\.tone === 'fault' && b\.trouble !== 'permission' && b\.phase !== 'locked' && !!onReport/)
    assert.match(page, /\{said\.line\} <\/Text> \{b\.trouble === 'permission' \? <OpenSettings \/> : null\} \{reportable && !quiet \? <ReportThis onPress=\{\(\) => onReport\(said\.line\)\} \/> : null\}/)
    assert.match(page, /\{b\.phase === 'connecting' \|\| quiet \? <Hint>\{CLOSE_AND_REOPEN\}<\/Hint> : null\} \{reportable && quiet \? <ReportThis onPress=\{\(\) => onReport\(said\.line\)\} \/> : null\}/, 'Report this is not under the plugs hint')
    assert.match(page, /\{!b\.on && missed && !b\.adapter && !b\.trouble && !b\.said && onReport \? <ReportThis onPress=\{\(\) => onReport\('No adapter was connected\.'\)\} \/> : null\}/)
    assert.match(page, /\{b\.said && onReport \? <ReportThis onPress=\{\(\) => onReport\(b\.said\)\} \/> : null\}/)
    assert.equal((drawn.match(/<ReportThis /g) || []).length, 4, 'Report this is drawn somewhere else, or twice for one line')
    /* "quiet" is the hint's own condition, so Report this is under the hint and not between it and its line. */
    assert.match(page, /const quiet = b\.on && b\.phase === 'connected' && !b\.answeredAs && \(unitState === 'missing' \|\| unitState === 'silent'\)/)
    assert.match(page, /function ReportThis\(\{ onPress \}\) \{ return <Press label="Report this" height=\{44\}/)

    /*
     * THE BETA NOTE POINTS AT THAT BUTTON, by its name, as does the line under
     * an untried unit's steps; and the Android note is still the iPhone's with
     * one clause, so the iPhone's names no other phone.
     */
    const gear = src('mobile/src/lib/bluetooth-gear.js')
    assert.match(gear, /export const REPORT_BUTTON = 'Report a Bluetooth problem'/)
    assert.match(page, /import \{[^}]*\bREPORT_BUTTON\b[^}]*\} from '\.\.\/lib\/bluetooth-gear'/)
  })

  test('not connecting after the adapter was unplugged and plugged back in: the page says to close the app completely, wherever it is on and not working', async () => {
    /*
     * "I had to force close the app after Bluetooth was connected, and when
     * I unplugged the device and plugged it back in. The Bluetooth wouldn't
     * connect again until I Force quit the app" (Justin, 26 October 2026).
     * His log: the iPhone still listed the adapter, the app connected to it
     * at once, and the FM3 never answered; the launch after the force quit
     * answered in a twentieth of a second. What was stale is the phone's own
     * MIDI connection, made once a launch (the native module), which an
     * update cannot change, so the way out is said where it is needed.
     */
    const gear = await import('../shared/bluetooth-gear.mjs')
    assert.equal(gear.CLOSE_AND_REOPEN, 'Still not connecting after unplugging and plugging the adapter back in? Close the app completely (swipe it away) and open it again.')
    assert.ok(!/this phone|beta/i.test(gear.CLOSE_AND_REOPEN))
    const page = flat('mobile/src/screens/Bluetooth.js')
    assert.match(page, /const quiet = b\.on && b\.phase === 'connected' && !b\.answeredAs && \(unitState === 'missing' \|\| unitState === 'silent'\)/)
    assert.match(page, /\{b\.phase === 'connecting' \|\| quiet \? <Hint>\{CLOSE_AND_REOPEN\}<\/Hint> : null\}/, 'the page does not say to close the app while it is connecting, or connected with the unit silent')
    const on = page.slice(page.indexOf('{b.on ? ( <View style={{ gap: space.sm }}>'), page.indexOf(') : ( <View style={{ gap: space.lg }}>'))
    assert.ok(on.includes('{CLOSE_AND_REOPEN}'), 'the line is not in the half of the page drawn while Bluetooth is on')
  })

  test('the note at the foot of the page points at the report button, and says nothing of where it was tried', async () => {
    const gear = await import('../shared/bluetooth-gear.mjs')
    /* Out of beta since 26 October 2026; the button alone since 31 October, when where it had been tried went to the Developer page. The way back is BLUETOOTH_WAYS, the line above it. */
    assert.equal(gear.REPORT_NOTE, 'Something not working? Tap Report a Bluetooth problem.')
    assert.ok(!/android|google|play store|\bapk\b|iphone|tried/i.test(gear.REPORT_NOTE))
  })

  test('the note under Play’s pill has Report a problem beside Turn off Bluetooth, each its own button, and says the device in hand', () => {
    const bar = flat('mobile/src/components/TopBar.js')
    assert.match(bar, /export default function TopBar\(\{ link, onOpenSettings, onOpenUnit, unitGoes, onUnlock, onReport = null, saveHere: saveWanted = true \}\)/)
    const ble = bar.slice(bar.indexOf('function Which('), bar.indexOf('function Saved('))
    assert.match(ble, /function Which\(\{ link, onClose, onReport = null \}\)/)
    /* Two buttons, each its own element to VoiceOver inside a note that is not one. */
    assert.match(ble, /accessible=\{false\} onPress=\{onClose\}/)
    assert.match(ble, /accessibilityRole="button" accessibilityLabel="Turn off Bluetooth" accessibilityHint=\{`The \$\{deviceNoun\(\)\} goes back to using the computer`\}/)
    assert.match(ble, /\{onReport \? \( <Pressable accessibilityRole="button" accessibilityLabel="Report a problem"/)
    assert.match(ble, /onPress=\{\(\) => \{ tick\(\) fire\('press Report a problem', \(\) => onReport\(said\)\) onClose\(\) \}\}/)
    assert.match(ble, />Report a problem<\/Text>/)
    assert.ok(!/The phone goes back/.test(bar), 'the hint says “the phone” on an iPad')
    assert.match(bar, /import \{ deviceNoun \} from '\.\.\/lib\/device-word'/)
  })

  test('Play’s fault card has Report this only over Bluetooth, in a conditional of its own, never on a dropped tap', () => {
    const stage = flat('mobile/src/screens/Stage.js')
    assert.match(stage, /export default function Stage\(\{ onOpenPresets, onOpenSetlists, onOpenEdit, onOpenFix, \/\*[^*]*\*\/ onReport = null,/)
    assert.match(stage, /import \{ overBluetooth \} from '\.\.\/lib\/bleSwitch'/)
    const card = stage.slice(stage.indexOf('<Toast open={!!error}'), stage.indexOf('</Toast>', stage.indexOf('<Toast open={!!error}')))
    /* The note keeps its own shape (a test reads it), What to try its own conditional, and Report this a third. */
    assert.match(card, /\{error \? \( <Note tone="fault" onDismiss=\{clearError\}> \{error\} <\/Note> \) : null\}/)
    assert.match(card, /\{error && onOpenFix && fixFor\(error\) \? \( <Press label=\{fixById\(fixFor\(error\)\)\.title\} sub="What to try"/)
    /* Its small line says "Bluetooth" on every unit: whether the unit was tried is the Developer page's, since 31 October 2026. */
    assert.match(card, /\{error && onReport && overBluetooth\(caps\) \? \( <Press label="Report this" sub="Bluetooth" height=\{44\} onPress=\{\(\) => onReport\(error\)\} \/> \) : null\}/)
    assert.ok(!/faultSubFor|untried/.test(stage), 'Play’s fault card says whether the unit was tried')
    assert.ok(card.indexOf('What to try') < card.indexOf('label="Report this"'), 'Report this is above What to try')
    /* Drawn only there: not on the advice card, and not with the dropped tap's note, which is not a fault. */
    assert.equal((stage.match(/label="Report this"/g) || []).length, 1)
    const dropped = stage.slice(stage.indexOf('{down || droppedNote ? ('), stage.indexOf('<Toast open={!!error}'))
    assert.ok(dropped.length > 100 && !/onReport/.test(dropped), 'a dropped tap’s note offers a report')
    /* Over Bluetooth is the unit's own word (caps.via), the same as Settings and Edit read it. */
    assert.match(src('mobile/src/lib/bleSwitch.js'), /export const overBluetooth = \(caps\) => caps\?\.via === 'bluetooth'/)
  })

  test('Settings has Report a problem or idea under Help, and Troubleshooting → Feedback stays where the help sentence says it is', async () => {
    const settings = flat('mobile/src/screens/Settings.js')
    const front = settings.slice(settings.indexOf("{page === null ? ("), settings.indexOf("{page === 'account' ? ("))
    const help = front.slice(front.indexOf('<Group title="Help"'), front.indexOf('<Group title="About"'))
    assert.match(help, /\{onOpenReport \? \( <SetupRow title="Feedback" status="Something broken, or something you want" onPress=\{onOpenReport\} \/> \) : null\}/)
    /* Troubleshooting still holds Feedback, the path the fixed help sentence names. */
    const trouble = settings.slice(settings.indexOf("{page === 'trouble' ? ("))
    assert.match(trouble, /<SetupRow title="Feedback" status="Something broken, or something you want" onPress=\{onOpenReport\} \/>/)
    const { SUPPORT_LINE } = await import('../shared/affiliation.mjs')
    assert.match(SUPPORT_LINE, /Settings → Troubleshooting → Feedback/)
  })

  /* ---------------------------------------------------------------- */
  /* The FM9 and Axe-Fx III, built out from what Fractal publishes      */
  /* ---------------------------------------------------------------- */

  /*
   * WHAT THE PHONE SENDS AN FM9 OR AN AXE-FX III, AND WHERE IT IS WRITTEN
   * DOWN. Nobody has run Bluetooth on either, so the rule is the byte rule:
   * nothing goes that Fractal does not document, or that the computer app has
   * not been seen to do on that unit. The pretend units (fakeGen3) behave as
   * Fractal's documents say, and cite them; these tests hold the wire to it.
   */
  const SHORT_OK = (f) => f.length === 3 && (f[0] & 0xf0) === 0xb0 ? f[1] === 0x00 || f[1] === 0x20 : f.length === 2 && (f[0] & 0xf0) === 0xc0
  /* Fractal's third-party MIDI document, Rev 1.4: bypass, channel, scene, preset name, scene name, tap, tuner on/off, status dump, tempo. (0x0F, the looper, is published too, and never sent: the phone has no looper over Bluetooth.) */
  const PUBLISHED = [0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x10, 0x11, 0x13, 0x14]

  test('a preset on an FM9 or an Axe-Fx III goes by Program Change alone, bank in CC0, checked once and remembered', async () => {
    for (const [unit, model] of [['fm9', 0x12], ['axefx3', 0x10]]) {
      /* Even a pretend unit that would take FM3-Edit's 0x27 frame is never sent it in Auto. */
      const t = await onTheLine(unit, { sysexPreset: true })
      assert.deepEqual(await t.post('/preset/select', { number: 475 % (unit === 'fm9' ? 512 : 1024) }), { ok: true })
      assert.ok(!t.frames().some((f) => f[0] === 0xf0 && f[5] === 0x01), `${unit}: an fn 0x01 frame went`)
      assert.deepEqual(t.frames().filter((f) => f[0] !== 0xf0).map(hex), ['B0 00 03', 'B0 20 00', 'C0 5B'], unit)
      assert.equal(t.unit.state.preset, 475)
      assert.ok(sameFrame(t.frames()[0], t.sx.buildGetPreset(model)) && sameFrame(t.frames().at(-1), t.sx.buildGetPreset(model)), `${unit}: not asked before and after`)
      assert.equal(t.remembered.at(-1).learned.preset, 'pc')
      /* And from then on it goes straight, with nothing asked. */
      t.sent.length = 0
      await t.post('/preset/select', { number: 13 })
      assert.deepEqual(t.frames().map(hex), ['B0 00 00', 'B0 20 00', 'C0 0D'])
      assert.equal(t.unit.state.preset, 13)
    }
  })

  test('a preset that does not land by Program Change says which setting on the unit to look at, and where it went', async () => {
    /* Program Change Off on the unit ("Determines whether the Axe-Fx III will process or ignore incoming MIDI Program Change messages"): it stays. */
    const off = await onTheLine('fm9', { pc: false })
    await assert.rejects(off.post('/preset/select', { number: 200 }), (e) => {
      assert.equal(e.status, 502)
      assert.equal(e.message, 'The unit stayed on preset 12. On the FM9, open Setup → MIDI/Remote and check that Program Change is On, the MIDI channel is 1 (or Omni), PC Mapping is Off, and MIDI PC Offset is 0.')
      return true
    })
    /* The preset asked, Program Change, where it landed: nothing else. */
    assert.deepEqual(off.frames().map((f) => (f[0] === 0xf0 ? `fn ${f[5].toString(16)}` : hex(f))), ['fn d', 'B0 00 01', 'B0 20 00', 'C0 48', 'fn d'])
    assert.deepEqual(off.wire.methods().learned, {}, 'a way was learned from a preset that did not land')
    /* A MIDI PC Offset ("Adds a specified value to all incoming MIDI Program Change requests"): it went somewhere else, and says where. */
    const offset = await onTheLine('axefx3', { pcOffset: 1 })
    await assert.rejects(offset.post('/preset/select', { number: 40 }), (e) => /^The unit went to preset 41, not 40\. On the Axe-Fx III, open Setup → MIDI\/Remote/.test(e.message))
    /* On the channel the testing tools set: the words say that channel. */
    const ch = await onTheLine('fm9', { pc: false, methods: { pcChannel: 3 } })
    await assert.rejects(ch.post('/preset/select', { number: 20 }), (e) => /the MIDI channel is 3 \(or Omni\)/.test(e.message))
  })

  test('a unit that stops answering after the Program Change on an FM9 or Axe-Fx III is not told a setting is wrong, and nothing is learned', async () => {
    for (const unit of ['fm9', 'axefx3']) {
      const t = await onTheLine(unit, { silentAfterPc: true })
      const r = await t.post('/preset/select', { number: 200 })
      assert.deepEqual(r, { ok: true }, `${unit}: an unanswered landing was taken as a wrong setting`)
      assert.deepEqual(t.wire.methods().learned, {}, `${unit}: a way was learned from an unanswered landing`)
      assert.equal(t.unit.state.preset, 200)
    }
  })

  test('FM3-Edit’s preset frame goes to an FM9 or Axe-Fx III only when forced in the testing tools, and a stored way learned on an FM3 build is not used', async () => {
    for (const [unit, model] of [['fm9', 0x12], ['axefx3', 0x10]]) {
      const forced = await onTheLine(unit, { sysexPreset: true, methods: { preset: 'sysex' } })
      await forced.post('/preset/select', { number: 30 })
      assert.ok(forced.frames().some((f) => sameFrame(f, forced.sx.buildSwitchPreset(model, 30))), `${unit}: the forced 0x27 frame did not go`)
      /* What an older copy of the app may have learned and kept on the phone. */
      const kept = await onTheLine(unit, { methods: { learned: { preset: 'sysex', tuner: 'poll' } } })
      await kept.post('/preset/select', { number: 30 })
      assert.ok(!kept.frames().some((f) => f[0] === 0xf0 && f[5] === 0x01), `${unit}: a stored 0x27 way was used`)
      assert.equal(kept.unit.state.preset, 30)
      assert.notEqual(kept.wire.methods().learned.preset, 'sysex')
      /* And the stored Poll tuner: Fractal's switch alone, never FM3-Edit's page or frequency question. */
      await kept.post('/tuner', { on: true })
      await advance(kept.clock, 3000)
      assert.ok(!kept.frames().some((f) => f[0] === 0xf0 && (f[5] === 0x12 || f[5] === 0x01)), `${unit}: a stored poll tuner was used`)
      /* And the check, through the same trial. */
      const check = await onTheLine(unit, { sysexPreset: true })
      const r = await drive(check.clock, check.wire.check('write-preset'))
      assert.equal(r.ok, true, r.error)
      assert.equal(r.way, 'pc')
      assert.ok(!check.frames().some((f) => f[0] === 0xf0 && f[5] === 0x01), `${unit}: the preset check sent an fn 0x01 frame`)
      assert.equal(check.unit.state.preset, 12, `${unit}: the check did not put the preset back`)
    }
    /* The FM3 keeps FM3-Edit's frame first (see the 0x27 test above). */
    const fm3 = await onTheLine('fm3')
    await fm3.post('/preset/select', { number: 30 })
    assert.ok(fm3.frames().some((f) => sameFrame(f, fm3.sx.buildSwitchPreset(0x11, 30))))
  })

  test('with SysEx or Poll picked in the testing tools, the preset and tuner checks on an FM9 or Axe-Fx III try that way', async () => {
    for (const [unit, model] of [['fm9', 0x12], ['axefx3', 0x10]]) {
      const p = await onTheLine(unit, { sysexPreset: true, methods: { preset: 'sysex' } })
      const r = await drive(p.clock, p.wire.check('write-preset'))
      assert.equal(r.ok, true, r.error)
      assert.ok(p.frames().some((f) => sameFrame(f, p.sx.buildSwitchPreset(model, 13))), `${unit}: the forced preset check did not send the 0x27 frame`)
      const tn = await onTheLine(unit, { methods: { tuner: 'poll' } })
      const tr = await drive(tn.clock, tn.wire.check('write-tuner'))
      assert.equal(tr.ok, true, tr.error)
      assert.ok(tn.frames().some((f) => sameFrame(f, tn.sx.buildTunerPage(model, true))), `${unit}: the forced tuner check did not open the tuner page`)
      assert.ok(tn.frames().some((f) => sameFrame(f, tn.sx.buildTunerPoll(model))), `${unit}: the forced tuner check did not poll`)
    }
  })

  test('an Axe-Fx III offers 512 presets, and a Mark II’s 600 still goes, by its manual’s bank 4', async () => {
    const t = await onTheLine('axefx3')
    const d = await t.get('/device/detect')
    assert.equal(d.capabilities.presets.count, 512)
    t.sent.length = 0
    await t.post('/preset/select', { number: 600 })
    assert.deepEqual(t.frames().filter((f) => f[0] !== 0xf0).map(hex), ['B0 00 04', 'B0 20 00', 'C0 58'])
    assert.equal(t.unit.state.preset, 600)
  })

  test('the grid is 14 by 6 on the FM9 and Axe-Fx III, and 12 by 4 on the FM3, as Fractal and the computer app say', async () => {
    for (const [unit, grid] of [['fm3', { rows: 4, cols: 12 }], ['fm9', { rows: 6, cols: 14 }], ['axefx3', { rows: 6, cols: 14 }]]) {
      const t = await onTheLine(unit)
      assert.deepEqual((await t.get('/device/detect')).capabilities.grid, grid, unit)
    }
  })

  test('the tuner on an FM9 or Axe-Fx III is Fractal’s switch alone, and its readings are the ones the unit sends', async () => {
    for (const [unit, model] of [['fm9', 0x12], ['axefx3', 0x10]]) {
      const t = await onTheLine(unit, { pushes: true })
      await t.post('/tuner', { on: true })
      assert.deepEqual(t.frames().map(hex), [hex(t.sx.frame(model, 0x11, [1]))], `${unit}: the tuner on sent something else`)
      assert.equal(hex(t.frames()[0]).slice(0, 20), `F0 00 01 74 ${hex([model])} 11 01`)
      await advance(t.clock, 1000)
      const readings = t.events.filter((e) => e.type === 'tuner')
      assert.ok(readings.length >= 5, `${unit}: the unit's readings did not reach the needle`)
      const { note, ...rest } = readings.at(-1)
      assert.deepEqual(rest, { type: 'tuner', octave: undefined, cents: 0 })
      assert.equal(note, 'E', 'BELIEVED, not documented: Rev 1.4 says only "nn = note (0 – 11)"; byte 7 is E only if 0 is A (FROM_A in bleWire.js). Change this when a real unit’s log shows an open low E')
      assert.equal(t.unit.state.tuner, true)
      t.sent.length = 0
      await t.post('/tuner', { on: false })
      assert.deepEqual(t.frames().map(hex), [hex(t.sx.frame(model, 0x11, [0]))], `${unit}: the tuner off sent something else`)
      assert.equal(t.unit.state.tuner, false)
      assert.ok(!t.frames().some((f) => f[5] === 0x12 || f[5] === 0x01))

      /* Send Realtime Sysex Off: no readings, and still nothing but the switch, however long it stays open. */
      const quiet = await onTheLine(unit)
      await quiet.post('/tuner', { on: true })
      await advance(quiet.clock, 5000)
      assert.ok(!quiet.frames().some((f) => f[5] === 0x12 || f[5] === 0x01), `${unit}: the page or the frequency question went`)
      assert.ok(quiet.logs.some((l) => /no tuner data from the .* in 1\.2 s: Send Realtime Sysex may be off on it/.test(l)), `${unit}: the log does not say why`)
      assert.ok(!quiet.logs.some((l) => /its own display shows the tuner/.test(l)), `${unit}: the log says as a fact what nobody knows`)
      /* Poll picked in the testing tools still asks the FM3-Edit way: how it would be tried. */
      const poll = await onTheLine(unit, { methods: { tuner: 'poll' } })
      await poll.post('/tuner', { on: true })
      assert.ok(poll.frames().some((f) => sameFrame(f, poll.sx.buildTunerPage(model, true))), `${unit}: forced Poll did not open the page`)
    }
    /* The FM3 asks, as it always has. */
    const fm3 = await onTheLine('fm3')
    await fm3.post('/tuner', { on: true })
    assert.ok(sameFrame(fm3.frames()[0], fm3.sx.buildTunerPage(0x11, true)))
  })

  test('the Axe-Fx III’s tuner: a close owed from the connection before is the switch off alone, and a refusal puts the tuner down with the reason, the off still owed', async () => {
    const t = await onTheLine('axefx3')
    t.wire.oweGen3Tuner({ push: true, page: false })
    await t.post('/tuner', { on: false })
    assert.deepEqual(gen3TunerHeard(t, 0x10), ['tuner off'])
    assert.equal(t.frames().length, 1)
    /*
     * "the unit does not know that message": the phone's tuner goes down and
     * nothing else is sent. But 11 01 went, and Fractal has not published
     * 0x64 or its codes, so the unit may be on its tuner (and muted) all the
     * same: the published off, 11 00, is still owed, by the next Close and
     * by the link's close on a new connection.
     */
    for (const [unit, model] of [['fm9', 0x12], ['axefx3', 0x10]]) {
      const no = await onTheLine(unit, { refuseTuner: 0x04 })
      await assert.rejects(no.post('/tuner', { on: true }), (e) => e.status === 502 && /does not know that message/.test(e.message))
      await advance(no.clock, 3000)
      assert.deepEqual(gen3TunerHeard(no, model), ['tuner on'], `${unit}: something else went after the refusal`)
      assert.equal(no.wire.gen3TunerLeftOn(), true, `${unit}: a refused switch that went is not owed its off`)
      no.sent.length = 0
      await no.post('/tuner', { on: false }).catch(() => {})
      assert.deepEqual(no.frames().map(hex), [hex(no.sx.frame(model, 0x11, [0]))], `${unit}: the Close after a refused switch did not send 11 00`)
      assert.equal(no.wire.gen3TunerLeftOn(), false, `${unit}: the off went and is still owed`)
    }
  })

  test('64 11 00 after the tuner switch, and 64 10 00 after a tap, are written down and never taken as refusals', async () => {
    const t = await onTheLine('axefx3', { ack: true, pushes: true })
    assert.deepEqual(await t.post('/tuner', { on: true }), { ok: true })
    assert.equal(t.wire.gen3TunerLeftOn(), true, 'the tuner was put down')
    assert.ok(t.logs.some((l) => /answered the tuner with 64 11 00, whose meaning Fractal has not published: not taken as a refusal/.test(l)))
    await t.post('/tuner', { on: false })
    assert.deepEqual(await t.post('/tempo/tap', {}), { ok: true })
    assert.ok(t.logs.some((l) => /64 10 00/.test(l)))
    /* Another code is still a refusal. */
    assert.match((await import(SX)).rejectedWords(0x00), /damaged/)
  })

  test('a 64 <fn> 00 after a scene, channel or tempo write is still a refusal (damaged): only the tap and the tuner switch are let through', async () => {
    for (const unit of ['axefx3', 'fm3']) {
      const t = await onTheLine(unit, { refusePublished: 0x00 })
      if (unit === 'fm3') {
        /* The FM3 goes on to FM3-Edit's way after a refusal of the published one, and learns it: only a refusal gets it there. */
        await t.post('/scene', { index: 2 })
        await t.post('/preset/blocks/58/channel', { channel: 'C' })
        assert.equal(t.wire.methods().learned.scene, 'edit', 'fm3: a 64 0C 00 was taken as the scene going')
        assert.equal(t.wire.methods().learned.channel, 'edit', 'fm3: a 64 0B 00 was taken as the channel going')
      } else {
        for (const [path, body] of [['/scene', { index: 2 }], ['/preset/blocks/58/channel', { channel: 'C' }], ['/tempo', { bpm: 133 }]]) {
          await assert.rejects(t.post(path, body), (e) => /damaged/.test(e.message), `${unit} ${path}: a 64 <fn> 00 was not a refusal`)
        }
        assert.equal(t.unit.state.scene, 0)
      }
      assert.ok(!t.logs.some((l) => /not taken as a refusal/.test(l)), `${unit}: a 64 <fn> 00 on a write was let through`)
    }
  })

  test('a pushed tuner reading is Fractal’s cents, one a step from 63, held to the needle, with the note byte and the string in the log', async () => {
    const t = await onTheLine('axefx3', { pushes: true })
    await t.post('/tuner', { on: true })
    await advance(t.clock, 300)
    const cents = async (fine) => {
      t.unit.opt.push = [7, 0, fine]
      await advance(t.clock, 250)
      return t.events.filter((e) => e.type === 'tuner').at(-1).cents
    }
    assert.equal(await cents(64), 1)
    assert.equal(await cents(62), -1)
    assert.equal(await cents(113), 50)
    assert.equal(await cents(13), -50)
    assert.equal(await cents(127), 50, 'past +50 is held to the needle')
    t.unit.opt.push = [0, 5, 63]
    await advance(t.clock, 250)
    assert.ok(t.logs.some((l) => /tuner data from the unit: note byte 7, string 0, cents byte 63/.test(l)))
    assert.ok(t.logs.some((l) => /tuner data from the unit: note byte 0, string 5/.test(l)), 'a new note is not written down with its byte and string')
  })

  test('an FM9 or Axe-Fx III that stops answering is left in peace: nothing for 30 s, then one question at each check, and the watch back the moment it answers', async () => {
    const { QUIET_MS } = await import(WIRE)
    for (const unit of ['fm9', 'axefx3', 'fm3']) {
      const t = await onTheLine(unit)
      t.wire.startPolls()
      await advance(t.clock, 2500)
      assert.ok(t.sent.length > 0, `${unit}: the watch is not asking`)
      /* Switched off, the adapter still on its charger. */
      t.unit.opt.silent = true
      await advance(t.clock, 8000)
      assert.ok(t.logs.some((l) => /has not answered 3 questions in a row: it may be switched off or starting up/.test(l)), `${unit}: the quiet is not logged`)
      const sentAt = t.sent.length
      /* The rig's own check, inside the 30 s: answered "not connected", with nothing sent. */
      for (let i = 0; i < 2; i++) {
        await advance(t.clock, 10000)
        assert.equal((await t.get('/device/detect')).connected, false)
      }
      assert.equal(t.sent.length, sentAt, `${unit}: something was sent to a unit that may be starting up`)
      /* Past the 30 s: one question at each check. */
      await advance(t.clock, QUIET_MS)
      assert.equal(t.sent.length, sentAt, `${unit}: the watch asked while quiet`)
      assert.equal((await t.get('/device/detect')).connected, false)
      assert.equal(t.sent.length, sentAt + 1, `${unit}: the check did not ask once`)
      /* Back on: the next check finds it, and the watch is asking again within a second. */
      t.unit.opt.silent = false
      assert.equal((await t.get('/device/detect')).connected, true)
      assert.ok(t.logs.some((l) => /answers again: the watch starts again/.test(l)))
      const back = t.sent.length
      await advance(t.clock, 1100)
      assert.ok(t.sent.slice(back).some((s) => sameFrame(s.bytes, t.sx.buildGetScene(t.sx.MODELS[unit]))), `${unit}: the watch did not start again`)
      t.wire.stopPolls()
    }
    /* A footswitch Program Change from the unit, while the wire is quiet, ends the quiet as any frame from it does. */
    const t = await onTheLine('fm9')
    t.wire.startPolls()
    await advance(t.clock, 2500)
    t.unit.opt.silent = true
    await advance(t.clock, 8000)
    assert.ok(t.logs.some((l) => /has not answered 3 questions in a row/.test(l)), 'the quiet is not logged')
    t.wire.heardShort([0xc0, 5])
    assert.ok(t.logs.some((l) => /answers again: the watch starts again/.test(l)), 'a Program Change from the unit did not end the quiet')
    const back = t.sent.length
    await advance(t.clock, 1100)
    assert.ok(t.sent.slice(back).some((s) => sameFrame(s.bytes, t.sx.buildGetScene(0x12))), 'the watch did not start again after a Program Change from the unit')
    t.wire.stopPolls()
  })

  test('a long front-panel burst with timing clock inside it, arriving during a read, upsets nothing and is answered with nothing', async () => {
    /* Its answer comes 200 ms after the question, so the burst, sent first, is on the line ahead of it, as one 5-pin line carries them. */
    const t = await onTheLine('axefx3', { delay: 200 })
    /* 600 bytes of fn 0x75, with 0xF8 sprinkled through it as current firmware sends clock out of MIDI OUT ("Default is MIDI only"). */
    const body = Array.from({ length: 590 }, (_v, i) => (i * 13) & 0x7f)
    for (let i = 50; i < body.length; i += 97) body.splice(i, 0, 0xf8)
    const burst = [0xf0, 0x00, 0x01, 0x74, 0x10, 0x75, ...body, 0x00, 0xf7]
    t.say(burst, 1)
    const p = await t.get('/preset')
    assert.deepEqual(p, { number: 12, name: 'SONG 12' })
    await advance(t.clock, 500)
    assert.deepEqual(t.frames().map(hex), [hex(t.sx.buildGetPreset(0x10))], 'something was sent in reply to the burst')
  })

  /* Every route, every check, the tuner and an owed close: what Auto sends an FM9 or Axe-Fx III. */
  async function sweepGen3(unit, methods) {
    const t = await onTheLine(unit, { pushes: true, publishedTempo: true, methods })
    const tryIt = async (p) => {
      try {
        await drive(t.clock, p)
      } catch {
        // Only the bytes are under test here.
      }
    }
    const req = (path, method = 'GET', body) => t.wire.request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const path of ['/device/detect', '/preset', '/scene', '/tempo', '/preset/blocks', '/preset/scene-state', '/presets/13', '/presets/12/summary', '/presets/12/scenes']) await tryIt(req(path))
    await tryIt(req('/preset/select', 'POST', { number: 200 }))
    await tryIt(req('/preset/select', 'POST', { number: 12 }))
    await tryIt(req('/scene', 'POST', { index: 3 }))
    await tryIt(req('/tempo', 'POST', { bpm: 133 }))
    await tryIt(req('/tempo/tap', 'POST', {}))
    await tryIt(req('/preset/blocks/58/bypass', 'POST', { bypassed: true }))
    await tryIt(req('/preset/blocks/58/channel', 'POST', { channel: 'C' }))
    await tryIt(req('/tuner', 'POST', { on: true }))
    await advance(t.clock, 2000)
    await tryIt(req('/tuner', 'POST', { on: false }))
    /* What the connection before may have left: the page only if Poll was picked there. */
    t.wire.oweGen3Tuner({ push: true, page: !!methods })
    await tryIt(req('/tuner', 'POST', { on: false }))
    t.wire.startPolls()
    await advance(t.clock, 5000)
    t.wire.stopPolls()
    const { CHECK_STEPS } = await import(WIRE)
    await tryIt(t.wire.check('all'))
    for (const s of CHECK_STEPS.gen3.writes) await tryIt(t.wire.check(s.step))
    const odd = new Set()
    for (const f of t.frames()) {
      if (f[0] === 0xf0) {
        if (!PUBLISHED.includes(f[5])) odd.add(f[5] === 0x01 ? `01/${t.sx.decode14(f[6], f[7]).toString(16)}` : f[5].toString(16))
      } else if (!SHORT_OK(f)) odd.add(hex(f))
    }
    return { t, odd: [...odd].sort() }
  }

  test('THE BYTE RULE: in Auto, an FM9 or Axe-Fx III is sent only Fractal’s published messages, Bank Select and Program Change', async () => {
    for (const unit of ['fm9', 'axefx3']) {
      const { t, odd } = await sweepGen3(unit)
      assert.deepEqual(odd, [], `${unit}: sent something Fractal has not published`)
      assert.ok(t.frames().length > 60, `${unit}: the sweep sent too little to mean anything`)
      for (const fn of [0x0c, 0x0d, 0x0e, 0x11, 0x13, 0x14]) assert.ok(t.frames().some((f) => f[0] === 0xf0 && f[5] === fn), `${unit}: the sweep never sent fn ${fn.toString(16)}`)
      assert.ok(t.frames().some((f) => (f[0] & 0xf0) === 0xc0), `${unit}: the sweep never sent Program Change`)
    }
    /* With every way forced in the testing tools (his account only), the exceptions are FM3-Edit's, exactly. */
    for (const unit of ['fm9', 'axefx3']) {
      const { odd } = await sweepGen3(unit, { scene: 'edit', channel: 'edit', tempo: 'edit', preset: 'sysex', tuner: 'poll' })
      assert.deepEqual(odd, ['01/16', '01/19', '01/24', '01/27', '01/9', '12'], `${unit}: the forced ways sent something else`)
    }
  })

  test('the FM9 and Axe-Fx III name their own blocks: a second amp, cab and reverb, and the III’s third delay, switched by the published bypass', async () => {
    const { catalogFor } = await import('../mobile/src/lib/gen3Catalog.js')
    const dump = [58, 59, 62, 63, 120, 67, 72]
    for (const [unit, model, delay3] of [['fm9', 0x12, false], ['axefx3', 0x10, true]]) {
      /* The wire as openWire makes it, with the unit's own list (lib/gen3Catalog catalogFor). */
      const t = await onTheLine(unit, { catalog: catalogFor(unit) })
      t.unit.state.blocks = dump.map((eid) => ({ eid, bypassed: false, channel: 0 }))
      const blocks = await t.get('/preset/blocks')
      const names = Object.fromEntries(blocks.map((b) => [b.effectId, b.name]))
      assert.deepEqual(names, { 58: 'Amp 1', 59: 'Amp 2', 62: 'Cab 1', 63: 'Cab 2', 120: 'Drive 3', 67: 'Reverb 2', ...(delay3 ? { 72: 'Delay 3' } : {}) }, unit)
      const sx = t.sx
      /* On the stage, a lone " 1" is dropped: Amp, and Amp 2 (tileGrid pedalName). */
      const { pedalName } = await import('../mobile/src/lib/tileGrid.js')
      assert.equal(pedalName({ slug: 'amp', name: names[58] }), 'Amp')
      assert.equal(pedalName({ slug: 'amp', name: names[59] }), 'Amp 2')
      t.sent.length = 0
      await t.post('/preset/blocks/59/bypass', { bypassed: true })
      assert.deepEqual(t.frames().map(hex), [hex(sx.frame(model, 0x0a, [0x3b, 0x00, 0x01]))])
      assert.equal(hex(t.frames()[0]).slice(0, 26), `F0 00 01 74 ${hex([model])} 0A 3B 00 01`)
      assert.equal(t.unit.state.blocks.find((b) => b.eid === 59).bypassed, true)
    }
    /* The FM3's list is the FM3's, exactly as it was. */
    assert.deepEqual(catalogFor('fm3'), catalog)
    assert.deepEqual(catalogFor('am4'), catalog)
    /* And openWire hands the wire the unit's own. */
    assert.match(src('mobile/src/lib/bluetooth.js'), /catalog: catalogFor\(unit\),/)
  })

  test('each Gen 3 unit’s block list is Fractal’s effect-ID enum, counted by its Blocks Guide, and the computer app’s ids exactly', async () => {
    const { catalogFor } = await import('../mobile/src/lib/gen3Catalog.js')
    /*
     * Fractal's enum (third-party MIDI document, Appendix 1): each family's
     * first id, every instance after it the next number. Counts from the
     * Blocks Guide's "Product BLOCKS Comparison" (June 2023), FM9 then III,
     * for the families Play draws.
     */
    const FAMILIES = {
      input: [37, 4, 5], output: [42, 3, 4], comp: [46, 2, 4], geq: [50, 4, 4], peq: [54, 4, 4], amp: [58, 2, 2], cab: [62, 2, 2],
      reverb: [66, 2, 2], delay: [70, 2, 4], multitap: [74, 2, 2], chorus: [78, 2, 2], flanger: [82, 2, 2], rotary: [86, 2, 2], phaser: [90, 2, 2],
      wah: [94, 2, 2], formant: [98, 2, 2], volume: [102, 4, 4], tremolo: [106, 2, 2], pitch: [110, 1, 2], filter: [114, 4, 4], drive: [118, 3, 4],
      enhancer: [122, 2, 2], mixer: [126, 4, 4], synth: [130, 1, 2], megatap: [138, 2, 2], gate: [146, 4, 4], ringmod: [150, 1, 1],
      multicomp: [154, 2, 2], tentap: [158, 2, 2], resonator: [162, 2, 2], looper: [166, 1, 1], plex: [178, 1, 2], send: [182, 2, 2],
      return: [186, 2, 2], multiplexer: [191, 2, 2]
    }
    for (const [unit, col] of [['fm9', 1], ['axefx3', 2]]) {
      const list = catalogFor(unit)
      for (const [slug, row] of Object.entries(FAMILIES)) {
        const pages = list.filter((b) => b.slug === slug).map((b) => b.page).sort((a, b) => a - b)
        assert.deepEqual(pages, Array.from({ length: row[col] }, (_v, i) => row[0] + i), `${unit} ${slug}`)
      }
      assert.equal(list.length, Object.values(FAMILIES).reduce((n, row) => n + row[col], 0), `${unit}: a block outside the families`)
      /* Every page once, and a family of more than one named with its number, the way the computer app names them. */
      assert.equal(new Set(list.map((b) => b.page)).size, list.length)
      for (const b of list) {
        const many = FAMILIES[b.slug][col] > 1
        assert.ok(many ? / \d$/.test(b.name) : !/ \d$/.test(b.name), `${unit}: ${b.page} is called ${b.name}`)
        assert.ok(Number.isInteger(b.paramCount) && Number.isInteger(b.typeCount), `${unit}: ${b.page} has no counts`)
      }
    }
    /* ForgeFX's /blocks for the two units, at the pin (drivers/gen3.ts), written in here: the same ids. */
    const FORGEFX_EXTRA = {
      fm9: [39, 40, 44, 52, 53, 56, 57, 59, 63, 67, 104, 105, 120, 139, 148, 149, 155, 159],
      axefx3: [39, 40, 41, 44, 45, 48, 49, 52, 53, 56, 57, 59, 63, 67, 72, 73, 104, 105, 111, 120, 121, 131, 139, 148, 149, 155, 159, 179]
    }
    const fm3 = new Set(catalog.map((b) => b.page))
    for (const [unit, extra] of Object.entries(FORGEFX_EXTRA)) {
      assert.deepEqual(catalogFor(unit).map((b) => b.page).filter((p) => !fm3.has(p)).sort((a, b) => a - b), extra, unit)
    }
    /* The blocks nobody names yet stay off: Crossover, Vocoder, Tone Match, RTA, Scene MIDI, IR Player. */
    for (const unit of ['fm9', 'axefx3']) {
      for (const id of [134, 142, 143, 170, 174, 190, 195, 196]) assert.ok(!catalogFor(unit).some((b) => b.page === id), `${unit}: ${id} is drawn`)
    }
  })

  test('scene names are read the same way on an FM9 and an Axe-Fx III as on an FM3', async () => {
    for (const unit of ['fm9', 'axefx3']) {
      const t = await onTheLine(unit)
      await t.get('/preset')
      assert.deepEqual(await t.get('/presets/12/summary'), { number: 12, name: 'SONG 12', scenes: ['CLEAN', 'CRUNCH', 'LEAD', '', '', '', '', 'AMBIENT'] })
      assert.ok(t.frames().filter((f) => f[5] === 0x0e).length === 8, unit)
      await assert.rejects(t.get('/presets/13/summary'), (e) => e.status === 501)
    }
  })

  test('on an Axe-Fx III an echo is a white plug in THRU, not a MIDI Thru setting it does not have', async () => {
    /*
     * The III's manual: "Messages received at the MIDI IN port are passed
     * automatically to the MIDI THRU port", and its answers leave by OUT. So
     * a pretend III whose white plug is in THRU echoes the phone and never
     * answers (silent), as a real one would: only probes go to it.
     */
    const t = await onTheLine('axefx3', { thru: true, silent: true })
    for (let i = 0; i < 4; i++) await t.get('/device/detect')
    assert.ok(t.logs.some((l) => l === 'the unit is echoing what it receives: the white plug may be in the Axe-Fx III’s MIDI THRU, not OUT'))
    const r = await drive(t.clock, t.wire.check('echo'))
    assert.equal(r.rows.at(-1).out, hex(t.sx.buildGetScene(0x10)), 'the echo test sent nothing to a III that has not answered')
    assert.match(r.rows.at(-1).meaning, /white plug may be in the Axe-Fx III’s MIDI THRU\. Move it to MIDI OUT\./)
    const nine = await onTheLine('fm9', { thru: true })
    for (let i = 0; i < 4; i++) await nine.get('/scene')
    assert.ok(nine.logs.some((l) => l === 'the unit is echoing what it receives: MIDI Thru is on'))
  })

  test('an FM9 that lists no blocks is told its firmware floor in the check', async () => {
    /* FM9 release notes 3.00: "3rd Party MIDI Command "Status Dump" is now enabled": before it, no answer. */
    const t = await onTheLine('fm9', { noStatus: true })
    const r = await drive(t.clock, t.wire.check('blocks'))
    assert.equal(r.rows[0].meaning, 'no answer: an FM9 lists its effects only from firmware 3.00 on')
    const three = await onTheLine('axefx3', { noStatus: true })
    assert.equal((await drive(three.clock, three.wire.check('blocks'))).rows[0].meaning, 'no answer')
  })

  test('whether a unit was tried is kept on the Developer page and in the logs, and said nowhere a player reads', async () => {
    /*
     * "we don't need to mention really whether or not something has been
     * tested or not, we just need to keep track of it ourselves in the
     * developer menu so that we can confirm it or if someone leaves us a
     * note saying it doesn't work then we can investigate" (Justin, 31
     * October 2026). Changed on purpose: until then "not tried yet" was said
     * wherever an FM9 or VP4 owner looked (under the unit, under Connected,
     * on What Bluetooth can't do, on Play's pill and fault card, at the foot
     * of the steps).
     */
    const gear = await import('../shared/bluetooth-gear.mjs')
    /* The record itself: the FM9 and VP4 not tried, the rest tried. */
    for (const unit of ['fm9', 'vp4']) assert.equal(gear.untried(unit), true, unit)
    for (const unit of ['am4', 'fm3', 'axefx3', null, 'vp5']) assert.equal(gear.untried(unit), false, String(unit))
    assert.deepEqual(gear.TESTED, ['am4', 'fm3', 'axefx3'])
    /* Which adapter the Axe-Fx III went through was not said, so no way on it is marked tried. */
    assert.ok(gear.waysFor('axefx3').every((w) => !w.tried))
    assert.ok(gear.waysFor('am4').some((w) => w.tried) && gear.waysFor('fm3').some((w) => w.tried))
    /* The head of every log he is sent still says it, so a report from an untried unit stands out. */
    assert.equal(gear.unitForReport('fm9'), 'FM9 (not tried yet)')
    assert.equal(gear.unitForReport('vp4'), 'VP4 (not tried yet)')
    assert.equal(gear.unitForReport('axefx3'), 'Axe-Fx III')
    assert.equal(gear.unitForReport('am4'), 'AM4')
    assert.match(flat('mobile/src/lib/bluetooth.js'), /unit: saved\.unit \? unitForReport\(saved\.unit\) \|\| unitName\(saved\.unit\) : null,/)
    /* The lines each unit keeps, which are about the unit, not about whether it was tried. */
    for (const [unit, name] of [['fm9', 'FM9'], ['axefx3', 'Axe-Fx III']]) {
      assert.equal(gear.tunerQuietLine(unit), `No readings from the ${name} yet. Play a string; if nothing shows, check that Send Realtime Sysex is On (Setup → MIDI/Remote on the ${name}). Until then, use the ${name}’s own display.`)
      assert.ok(gear.firmwareLineFor(unit).startsWith(`Use ${name} firmware`))
    }
    assert.ok(gear.missingBlocksLine('fm9').startsWith('A few blocks the FM3 doesn’t have (Crossover, Vocoder, Tone Match'))
    assert.match(gear.missingBlocksLine('axefx3'), /IR Player, Dynamic Distortion\)/)
    for (const unit of ['am4', 'fm3', null, 'vp5']) {
      assert.equal(gear.missingBlocksLine(unit), null)
      assert.equal(gear.tunerQuietLine(unit), null)
      assert.equal(gear.firmwareLineFor(unit), null)
    }
    /* No tuner, blocks or firmware words for a VP4 over Bluetooth: it has none of them there (VP4_OVER_BLUETOOTH says so once). */
    for (const f of ['missingBlocksLine', 'tunerQuietLine', 'firmwareLineFor']) assert.equal(gear[f]('vp4'), null, f)
    /* Nothing a player reads asks it: the page, Play's pill and its fault card. */
    const page = flat('mobile/src/screens/Bluetooth.js')
    const forPlayers = page.slice(page.indexOf("from '../lib/bluetooth-gear'"), page.indexOf('/** * Developer → App health → Tried:'))
    assert.ok(forPlayers.length > 1000, 'the page could not be cut where the Developer record starts; this read is probably broken')
    assert.ok(!/untried\(|untriedHere|\.tried\b|TRIED_NOTES|feelLine/.test(forPlayers), 'the Bluetooth page says whether the unit was tried')
    assert.ok(!/untried|tried/i.test(flat('mobile/src/components/TopBar.js')), 'Play’s pill says whether the unit was tried')
    assert.match(flat('mobile/src/components/TopBar.js'), /\? `Connected over Bluetooth, through \$\{adapter\}\.`/)
    const limitsPage = page.slice(page.indexOf('export function BluetoothLimits('), page.indexOf('function Bullet('))
    assert.ok(limitsPage.length > 100 && !/untried|Note tone="warn"/.test(limitsPage), 'What Bluetooth can’t do opens on a warning that the unit was not tried')
    assert.ok(page.indexOf('{missingBlocksLine(b.unit) ? <Bullet>') > page.indexOf('{DIFFERENT.map('), 'the blocks line is not with what is different')
    assert.match(page, /Bluetooth check · \$\{unitForReport\(b\.unit\) \|\| unitName\(b\.unit\)\} · /)
    /* The unit's firmware line, on How to connect, before its ways. */
    const waysPage = page.slice(page.indexOf('export function BluetoothWays('), page.indexOf('function Way('))
    assert.match(waysPage, /const firmware = firmwareLineFor\(b\.unit\)/)
    assert.ok(waysPage.indexOf('{firmware ? <Hint>{firmware}</Hint> : null}') < waysPage.indexOf('{ways.map('))
    /*
     * And the record is drawn on Developer → App health → Tried, which only
     * his account opens: each unit, tried or not, the ways it went through,
     * and what we know of the try.
     */
    const tried = page.slice(page.indexOf('export function BluetoothTried('), page.indexOf('function ReportThis('))
    assert.ok(tried.length > 100, 'BluetoothTried is gone')
    assert.match(tried, /\{BLE_UNITS\.map\(\(u\) => \{ const ways = waysFor\(u\.key\)\.filter\(\(w\) => w\.tried\)\.map\(\(w\) => w\.title\) const tried = !untried\(u\.key\)/)
    assert.match(tried, /\{`\$\{u\.name\} · \$\{tried \? 'Tried' : 'Not tried yet'\}`\}/)
    assert.match(tried, /\{TRIED_NOTES\[u\.key\] \? <Hint>\{TRIED_NOTES\[u\.key\]\}<\/Hint> : null\}/)
    const settings = flat('mobile/src/screens/Settings.js')
    assert.match(settings, /\{ key: 'tried', label: 'Tried' \}/)
    assert.match(settings, /\{devTab\.health === 'tried' \? <BluetoothTried \/> : null\}/)
    assert.match(settings, /\{page === 'health' && isAdmin\(account\?\.id\) \?/, 'App health opens on an account that is not his')
  })

  /* ---------------------------------------------------------------- */
  /* Edit over Bluetooth: the AM4's knobs, read and turned by the phone */
  /* ---------------------------------------------------------------- */

  const EDIT = '../mobile/src/lib/am4-edit.js'
  const KNOBS = '../mobile/src/lib/am4-knobs.js'

  /*
   * The AM4 in the pretend's preset (an amp at 0x3A, two drives), each
   * register's values made up but fixed: four channels, each as long as the
   * catalog's highest number on that register and a little more, so a slip
   * of one channel or one place reads a different value. `set` puts a value
   * at a setting's place on a channel.
   */
  async function editSettings() {
    const { AM4_KNOBS } = await import(KNOBS)
    const random = seeded(29)
    const settings = new Map()
    const make = (slug, reg) => {
      const top = Math.max(...AM4_KNOBS[slug].params.filter((r) => r[2] === reg).map((r) => r[3]))
      const stride = top + 3
      const values = Array.from({ length: stride * 4 }, () => Math.floor(random() * 65535))
      return { count: stride * 4, values }
    }
    settings.set(0x3a, make('amp', 0x3a))
    settings.set(0x3e, make('amp', 0x3e))
    settings.set(0x76, make('drive', 0x76))
    settings.set(0x77, make('drive', 0x76))
    const set = (reg, number, ch, wire) => {
      const c = settings.get(reg)
      c.values[ch * (c.count / 4) + number] = wire
    }
    return { settings, set }
  }

  test('Edit’s AM4 knobs come from the codec the computer app carries, every block named as the phone names it', async () => {
    const { AM4_KNOBS, AM4_KNOBS_FROM, AM4_PAGES, AM4_FAMILY_BY_BLOCK } = await import(KNOBS)
    const { PRECISION, settingsOf, layoutFor } = await import(EDIT)
    const sx = await import(SX)
    const lock = JSON.parse(src('desktop/forgefx.lock.json'))
    /* A new pin is a new table: scripts/am4-knobs.mjs on the pinned codec, never a phone that names a knob one way and the computer another. */
    assert.equal(AM4_KNOBS_FROM, lock['forgefx-midi'].commit, 'the AM4 knob table is not from the codec desktop/forgefx.lock.json pins: run scripts/am4-knobs.mjs on it')
    assert.match(src('scripts/am4-knobs.mjs'), /if \(head !== pinned\) throw new Error/, 'the table can be written from a codec that is not the pinned one')
    for (const [slug, spec] of Object.entries(AM4_KNOBS)) {
      assert.ok(Number.isInteger(sx.AM4_BLOCKS[slug]), `${slug} is not a block the phone knows`)
      assert.ok(spec.reads.includes(sx.AM4_BLOCKS[slug]), `${slug}’s settings are not read at its own code`)
      assert.ok(AM4_PAGES[AM4_FAMILY_BY_BLOCK[slug]], `${slug} has no editor pages`)
      assert.ok(!spec.reads.includes(0xce), `${slug} reads the preset’s own register, which the phone never sends fn 0x1F to`)
      for (const p of settingsOf(slug)) {
        if (p.unit !== 'enum') assert.ok(Number.isInteger(PRECISION[p.unit]), `${slug}.${p.key}: no places for ${p.unit}`)
        assert.ok(spec.reads.includes(p.pidLow), `${slug}.${p.key} is on a register that is never read`)
      }
      assert.ok(layoutFor(slug)?.pages?.length, `${slug} opens with no pages`)
    }
    /* Only the amp has a second register (its cab section, 0x3E), and every block the phone can name has its knobs. */
    assert.deepEqual(Object.entries(AM4_KNOBS).filter(([, b]) => b.reads.length > 1).map(([k, b]) => [k, b.reads]), [['amp', [0x3a, 0x3e]]])
    assert.deepEqual(Object.keys(AM4_KNOBS).sort(), Object.keys(sx.AM4_BLOCKS).sort())
  })

  test('Edit’s AM4 messages are byte for byte the codec’s: the read, a knob, a model', async () => {
    const e = await import(EDIT)
    /* From forgefx-midi at the pinned commit: buildGetAllParams, buildSetParamNorm, buildSetFloatParam. */
    assert.equal(hex(e.buildAm4ReadAll(0x3a)), 'F0 00 01 74 15 1F 3A 00 35 F7')
    assert.equal(hex(e.buildAm4ReadAll(0x3e)), 'F0 00 01 74 15 1F 3E 00 31 F7')
    assert.equal(hex(e.buildAm4ReadAll(0x77)), 'F0 00 01 74 15 1F 77 00 78 F7')
    assert.equal(hex(e.buildAm4SetNorm(0x3a, 1, 0.5)), 'F0 00 01 74 15 01 3A 00 01 00 02 00 00 00 04 00 00 00 00 03 78 57 F7')
    assert.equal(hex(e.buildAm4SetNorm(0x3e, 34, 0.25)), 'F0 00 01 74 15 01 3E 00 22 00 02 00 00 00 04 00 00 00 10 03 70 68 F7')
    assert.equal(hex(e.buildAm4SetValue(0x3a, 10, 13)), 'F0 00 01 74 15 01 3A 00 0A 00 01 00 00 00 04 00 00 00 0A 04 08 22 F7')
    assert.throws(() => e.buildAm4SetNorm(0x3a, 1, 1.5), /not 0\.\.1/)
    assert.throws(() => e.buildAm4SetValue(0x3a, 10, 1.5), /not a switch/)
    assert.throws(() => e.buildAm4ReadAll(0), /not one the AM4 is read at/)
  })

  test('an AM4 block’s settings read as the computer reads them: the channel it is on, each knob’s own scale, the cab under its own id', async () => {
    const e = await import(EDIT)
    const { settings, set } = await editSettings()
    /* Values from forgefx-midi decode and roundDisplayValue at the pinned commit. */
    set(0x3a, 11, 1, 32767) // amp gain, channel B
    set(0x3a, 12, 1, 13107) // amp bass
    set(0x3a, 11, 0, 65534) // the same gain on channel A
    set(0x3e, 32, 1, 50000) // the cab's master high cut, log10 200..20000 Hz
    set(0x3a, 10, 1, 13) // the model: AC-20
    const out = e.blockParamsOf(0x3a, settings, { channel: 1, bypassed: false })
    const knob = (id) => out.named.find((k) => k.id === id)
    assert.equal(knob(11).name, 'Gain')
    assert.equal(knob(11).value, 5)
    assert.equal(knob(11).min, 0)
    assert.equal(knob(11).max, 10)
    assert.equal(knob(12).value, 2)
    const cut = knob((0x3e << 16) | 32)
    assert.ok(cut, 'the cab section’s knobs are not under their own register’s id')
    assert.equal(cut.value, 6714)
    assert.equal(cut.unit, 'Hz')
    assert.equal(cut.log, true)
    assert.ok(Math.abs(cut.norm - Math.log(6714 / 200) / Math.log(100)) < 1e-9)
    assert.deepEqual(out.type, { value: 13, name: 'AC-20' })
    assert.equal(out.slug, 'amp')
    assert.equal(out.page, -1)
    /* Its on/off first, the made-up switch the computer puts there; no channel among the switches, which has its own buttons. */
    assert.deepEqual(out.enums[0], { id: 0xffff, name: 'Bypass', value: 0, options: [{ value: 0, label: 'Engaged' }, { value: 1, label: 'Bypassed' }] })
    assert.ok(!out.enums.some((x) => /^channel$/i.test(x.name)))
    assert.equal(new Set(out.named.map((k) => k.id)).size, out.named.length, 'two knobs share an id')
    assert.equal(out.layout?.family, 'DISTORT')
    /* Channel A is the first quarter. */
    assert.equal(e.blockParamsOf(0x3a, settings, { channel: 0 }).named.find((k) => k.id === 11).value, 10)
    /* A register that does not hold four channels holds channel A's alone. */
    const single = new Map([[0x76, { count: 41, values: Array.from({ length: 41 }, () => 32767) }]])
    assert.ok(e.blockParamsOf(0x76, single, { channel: 0 }).named.length > 0)
    assert.equal(e.blockParamsOf(0x76, single, { channel: 2 }).named.length, e.blockParamsOf(0x76, single, { channel: 0 }).named.length, 'channel A is not what a single copy answers')
    /* A second drive reads at its own code, and only there. */
    assert.deepEqual(e.readsOf(0x77), [{ wire: 0x77, key: 0x76 }])
    assert.deepEqual(e.readsOf(0x3a), [{ wire: 0x3a, key: 0x3a }, { wire: 0x3e, key: 0x3e }])
    assert.deepEqual(e.readsOf(0x3b), [{ wire: 0x3b, key: 0x3a }], 'a second amp is read at the first amp’s cab section')
    assert.equal(e.editBlock(0x99), null)
  })

  test('Edit’s frames go only to a block the AM4 has just named, only to settings the catalog names, within their range', async () => {
    const e = await import(EDIT)
    const sx = await import(SX)
    const { am4Sender } = await import(WIRE)
    const placed = [0x3a, 0x76, 0x77]
    assert.equal(e.am4EditAllowed(e.buildAm4ReadAll(0x3a), placed), 'block settings read')
    assert.equal(e.am4EditAllowed(e.buildAm4ReadAll(0x3e), placed), 'block settings read')
    assert.equal(e.am4EditAllowed(e.buildAm4ReadAll(0x77), placed), 'block settings read')
    /* Never a block not in the preset, and never a sweep: what froze an AM4. */
    assert.equal(e.am4EditAllowed(e.buildAm4ReadAll(0x42), placed), null)
    assert.equal(e.am4EditAllowed(e.buildAm4ReadAll(0x3e), [0x76]), null, 'the cab section is read with no amp in the preset')
    assert.equal(e.am4EditAllowed(e.buildAm4ReadAll(0x3f), [0x3b]), null)
    assert.equal(e.am4EditAllowed(e.buildAm4ReadAll(0xce), placed), null)
    assert.equal(e.am4EditAllowed(e.buildAm4ReadAll(0x3a), []), null)
    assert.equal(e.am4EditAllowed(e.buildAm4ReadAll(0x3a), null), null)
    const spoilt = e.buildAm4ReadAll(0x3a)
    spoilt[8] ^= 1
    assert.equal(e.am4EditAllowed(spoilt, placed), null, 'a frame with a bad checksum goes')
    /* A knob: a place along its travel, on a setting the catalog names as a knob. */
    assert.equal(e.am4EditAllowed(e.buildAm4SetNorm(0x3a, 11, 0.7), placed), 'block knob')
    assert.equal(e.am4EditAllowed(e.buildAm4SetNorm(0x3e, 32, 0.1), placed), 'block knob')
    assert.equal(e.am4EditAllowed(e.buildAm4SetNorm(0x77, 2, 0.1), placed), 'block knob', 'a second drive’s Balance')
    assert.equal(e.am4EditAllowed(e.buildAm4SetNorm(0x3a, 1999, 0.5), placed), null, 'a setting the catalog does not name')
    assert.equal(e.am4EditAllowed(e.buildAm4SetNorm(0x3a, 10, 0.5), placed), null, 'a model written as a knob')
    assert.equal(e.am4EditAllowed(e.buildAm4SetNorm(0x42, 1, 0.5), placed), null, 'a block not in the preset')
    const over = sx.am4Frame({ pidLow: 0x3a, pidHigh: 11, action: sx.AM4.SET_NORM, hdr4: 4, payload: sx.am4Float(1.5) })
    assert.equal(e.am4EditAllowed(over, placed), null, 'a knob past its end')
    /* A switch or a model: one of its own numbers, and never the channel, which goes to the base code by its own rule. */
    assert.equal(e.am4EditAllowed(e.buildAm4SetValue(0x3a, 10, 13), placed), 'block model')
    assert.equal(e.am4EditAllowed(e.buildAm4SetValue(0x3a, 10, 9999), placed), null, 'a model that does not exist')
    assert.equal(e.am4EditAllowed(e.buildAm4SetValue(0x3a, 11, 3), placed), null, 'a knob written as a switch')
    assert.equal(e.am4EditAllowed(sx.buildAm4Channel(0x77, 'B'), placed), null)
    /* And the one way out asks it only while Edit is open, of the blocks of the last answer. */
    let given = null
    const out = []
    const send = am4Sender((b) => out.push(b), () => {}, () => null, () => given)
    assert.equal(send(e.buildAm4ReadAll(0x3a)), 'refused', 'Edit’s read went with Edit closed')
    given = placed
    assert.equal(send(e.buildAm4ReadAll(0x3a)), 'sent')
    assert.equal(send(e.buildAm4ReadAll(0x42)), 'refused')
    assert.equal(send(sx.buildAm4Structure()), 'sent', 'the AM4’s own reads stopped going')
    assert.equal(out.length, 2)
  })

  test('over Bluetooth, Edit reads an AM4 block, turns a knob and picks a model, and the AM4 is sent nothing it has not been seen to take', async () => {
    const e = await import(EDIT)
    const { settings, set } = await editSettings()
    set(0x3a, 11, 1, 32767)
    set(0x3a, 10, 1, 13)
    const t = await onTheLine('am4', { edit: () => true, settings })
    const editing = { editing: true }
    const ask = (path, opts = {}) => drive(t.clock, t.wire.request(path, { ...editing, ...opts }))
    const read = await ask('/preset/blocks/58/params')
    assert.equal(read.slug, 'amp')
    /* The pretend amp is on channel B: its quarter, not A's. */
    assert.equal(read.named.find((k) => k.id === 11).value, 5)
    assert.deepEqual(read.type, { value: 13, name: 'AC-20' })
    assert.ok(read.named.some((k) => k.id === ((0x3e << 16) | 32)), 'the cab section was not read')
    const reads = t.frames().filter((f) => f[5] === 0x1f).map(hex)
    assert.deepEqual(reads, [hex(e.buildAm4ReadAll(0x3a)), hex(e.buildAm4ReadAll(0x3e))])
    /* A knob: the computer's frame, at the block's own code, and read back as it now is. */
    const before = t.frames().length
    assert.deepEqual(await ask('/preset/blocks/58/params/11', { method: 'PUT', body: JSON.stringify({ value: 0.7, continuous: true }) }), { ok: true })
    const wrote = t.frames().slice(before).filter((f) => f[5] === 0x01 && f.length === 23)
    assert.deepEqual(wrote.map(hex), [hex(e.buildAm4SetNorm(0x3a, 11, 0.7))])
    /* Whichever way the screen asks, a knob goes as a place along its travel: the other way puts an AM4 knob at its bottom. */
    await ask('/preset/blocks/58/params/11', { method: 'PUT', body: JSON.stringify({ value: 0.7, continuous: false }) })
    assert.ok(t.unit.state.edits.every((x) => x.action === 0x0002))
    assert.equal((await ask('/preset/blocks/58/params')).named.find((k) => k.id === 11).value, 7)
    /* A model, and the list the picker shows. */
    assert.deepEqual(await ask('/preset/blocks/58/type', { method: 'POST', body: JSON.stringify({ value: 0 }) }), { ok: true })
    assert.equal((await ask('/preset/blocks/58/params')).type.value, 0)
    const models = await ask('/blocks/amp/types')
    assert.equal(models.find((m) => m.value === 13).name, 'AC-20')
    /* A second drive, at its own code. */
    assert.equal((await ask('/preset/blocks/119/params')).slug, 'drive')
    assert.equal(t.unit.state.frozen, false, `the AM4 was sent something it froze on: ${t.unit.state.unknown.map(hex).join(' | ')}`)
    assert.ok(t.logs.some((l) => /read the amp’s settings in \d+\.\d s: \d+ knobs, channel B/.test(l)), 'the log does not say what the read found')
  })

  test('a knob let go over Bluetooth costs the write and one register read, not three whole blocks; a scene reads the block afresh', async () => {
    const { settings } = await editSettings()
    const t = await onTheLine('am4', { edit: () => true, settings })
    const ask = (path, opts = {}) => drive(t.clock, t.wire.request(path, { editing: true, ...opts }))
    await ask('/preset/blocks/58/params')
    const kinds = (from) =>
      t.frames().slice(from).map((f) => (f[5] === 0x1f ? `read ${t.sx.decode14(f[6], f[7]).toString(16)}` : f.length === 23 ? 'write' : t.sx.decode14(f[8], f[9]) === 0 ? 'preset' : `ask ${t.sx.decode14(f[8], f[9]).toString(16)}`))
    /* As Edit lets go of a knob: the write, the read to see it took, and the screen's read after it. */
    const from = t.frames().length
    await ask('/preset/blocks/58/params/11', { method: 'PUT', body: JSON.stringify({ value: 0.3, continuous: true }) })
    const back = await ask('/preset/blocks/58/params')
    const again = await ask('/preset/blocks/58/params')
    assert.equal(back.named.find((k) => k.id === 11).value, 3)
    assert.deepEqual(again, back, 'the screen’s read straight after is not the one just made')
    assert.deepEqual(kinds(from).filter((k) => k !== 'preset'), ['write', 'read 3a'], 'a knob let go reads more than the register it wrote')
    /* The cab section, written: its register alone. */
    const cab = t.frames().length
    await ask(`/preset/blocks/58/params/${(0x3e << 16) | 32}`, { method: 'PUT', body: JSON.stringify({ value: 0.5, continuous: true }) })
    await ask('/preset/blocks/58/params')
    assert.deepEqual(kinds(cab).filter((k) => k !== 'preset'), ['write', 'read 3e'])
    /* Another scene can put the block on another channel: read whole again, the channel first. */
    await drive(t.clock, t.wire.request('/scene', { method: 'POST', body: JSON.stringify({ index: 2 }) }))
    const scene = t.frames().length
    await ask('/preset/blocks/58/params')
    assert.deepEqual(kinds(scene).filter((k) => k !== 'preset'), ['ask 7dd', 'ask 3', 'read 3a', 'read 3e'])
    /* And kept only a moment: five seconds after its last read, it is read whole. */
    await advance(t.clock, 6000)
    const later = t.frames().length
    await ask('/preset/blocks/58/params')
    assert.ok(kinds(later).includes('read 3a') && kinds(later).includes('ask 7dd'), 'a block read a while ago is shown as it was then')
    assert.equal(t.unit.state.frozen, false)
  })

  test('Edit’s reads and writes go nowhere unless Edit is open and the request is Edit’s, and Play’s boost read stays refused', async () => {
    const { settings } = await editSettings()
    const closed = await onTheLine('am4', { edit: () => false, settings })
    await assert.rejects(drive(closed.clock, closed.wire.request('/preset/blocks/58/params', { editing: true })), (err) => err.status === 501 || /Bluetooth/i.test(err.message))
    assert.equal(closed.frames().length, 0, 'something went to the AM4 with Edit closed')
    const t = await onTheLine('am4', { edit: () => true, settings })
    /* Play's own read of the amp, for its boost (lib/am4-boost): not Edit's, so refused as it always was. */
    await assert.rejects(t.get('/preset/blocks/58/params'))
    await assert.rejects(drive(t.clock, t.wire.request('/preset/blocks/58/params/11', { method: 'PUT', body: JSON.stringify({ value: 0.5, continuous: true }) })))
    assert.equal(t.frames().length, 0, 'a request that was not Edit’s sent something')
    const ask = (path, opts = {}) => drive(t.clock, t.wire.request(path, { editing: true, ...opts }))
    /* A block that is not in the preset: the AM4 is asked what is, and nothing else goes. */
    await assert.rejects(ask('/preset/blocks/66/params'), /isn’t in the preset/)
    await assert.rejects(ask('/preset/blocks/66/params/1', { method: 'PUT', body: JSON.stringify({ value: 0.5 }) }), /isn’t in the preset/)
    /* A setting the catalog does not name, a model that does not exist, a knob past its end: refused, nothing sent. */
    await assert.rejects(ask('/preset/blocks/58/params/1999', { method: 'PUT', body: JSON.stringify({ value: 0.5 }) }), /isn’t one the app can change/)
    await assert.rejects(ask('/preset/blocks/58/type', { method: 'POST', body: JSON.stringify({ value: 9999 }) }), /no model 9999/)
    assert.ok(t.frames().every((f) => f[5] !== 0x1f && !(f[5] === 0x01 && [0x0001, 0x0002].includes(t.sx.decode14(f[10], f[11])) && t.sx.decode14(f[8], f[9]) !== 0x000d)), 'a refused request sent a write or a read of settings')
    /* And the boost's own write, Play's, still goes as it did. */
    assert.deepEqual(await drive(t.clock, t.wire.request('/preset/blocks/58/params/150', { method: 'PUT', body: JSON.stringify({ value: 1, continuous: false }) })), { ok: true })
    assert.equal(t.unit.state.boost, 1)
    assert.equal(t.unit.state.frozen, false)
  })

  test('an AM4 block whose settings come back damaged, or not at all, says so, and its cab section going missing leaves only those knobs out', async () => {
    const { settings } = await editSettings()
    const ask = (t, path) => drive(t.clock, t.wire.request(path, { editing: true }))
    const damaged = await onTheLine('am4', { edit: () => true, settings, editDamage: true })
    await assert.rejects(ask(damaged, '/preset/blocks/58/params'), /came back damaged/)
    const silent = await onTheLine('am4', { edit: () => true, settings, editSilent: true })
    await assert.rejects(ask(silent, '/preset/blocks/58/params'), /didn’t send the amp’s settings/)
    /* The pretend's cab section gone: the amp's own knobs are still there, and the log says what is not. */
    const { settings: noCab } = await editSettings()
    const t = await onTheLine('am4', { edit: () => true, settings: noCab })
    noCab.delete(0x3e)
    const real = t.unit.hear
    t.unit.hear = (b) => (b[5] === 0x1f && t.sx.decode14(b[6], b[7]) === 0x3e ? undefined : real(b))
    const read = await ask(t, '/preset/blocks/58/params')
    assert.ok(read.named.some((k) => k.id === 11))
    assert.ok(!read.named.some((k) => k.id > 0xffff))
    assert.ok(t.logs.some((l) => /no answer for the amp’s 3E section; its settings are left out/.test(l)))
  })

  test('Edit over Bluetooth is one switch per unit, a store version, null until the build that opens it, held to the ledger like Bluetooth itself', async () => {
    const rule = await import('../mobile/src/lib/ble-rule.js')
    const { ledgerBuilds, thresholdProblems, pinProblems, EDIT_OPENING, EDIT_WORDS, EDIT_OPENED_AT } = await import('./ledger.mjs')
    const { isOlder } = await import('../shared/versions.mjs')
    assert.deepEqual(rule.EDIT_UNITS, ['am4', 'fm3'], 'Edit over Bluetooth is listed for a unit whose knobs the phone cannot read')
    assert.deepEqual(rule.EDIT_FROM_STORE, { am4: null, fm3: null }, 'Edit over Bluetooth opens to customers before a store version whose notes say so')
    /* His account: every unit whose editing is built, on every copy. Nobody, a unit not built. */
    for (const installed of [null, '1.87.11', '1.89.0', '9.9.9']) {
      for (const unit of ['am4', 'fm3']) {
        assert.equal(rule.editOffered(unit, { admin: true, platform: 'ios', installed }), true)
        assert.equal(rule.editOffered(unit, { admin: false, platform: 'ios', installed }), false)
        assert.equal(rule.editOffered(unit, { admin: false, platform: 'android', installed }), false)
      }
      for (const unit of ['fm9', 'axefx3', 'vp4']) assert.equal(rule.editOffered(unit, { admin: true, platform: 'ios', installed }), false, `Edit opens over Bluetooth on the ${unit}, whose knobs are not built`)
    }
    /* The switch as a build will set it: open from that version on, on both phones, and never on a copy that cannot say what it is. */
    const units = { am4: { ios: '1.90.0', android: '1.90.0' } }
    for (const platform of ['ios', 'android']) {
      assert.equal(rule.editOffered('am4', { platform, installed: '1.90.0', units }), true)
      assert.equal(rule.editOffered('am4', { platform, installed: '1.91.2', units }), true)
      assert.equal(rule.editOffered('am4', { platform, installed: '1.89.9', units }), false)
      assert.equal(rule.editOffered('am4', { platform, installed: null, units }), false)
    }
    /* Held to the ledger as the Bluetooth threshold is: null, or this app's own version in the build pull request, until its row is written. */
    const app = JSON.parse(src('package.json')).version
    const builds = ledgerBuilds(src('docs/expo-builds.md'), EDIT_OPENING)
    for (const [unit, from] of Object.entries(rule.EDIT_FROM_STORE)) {
      assert.deepEqual(thresholdProblems(builds, from || {}, app, EDIT_WORDS), [], `${unit}: Edit over Bluetooth is set where the ledger does not allow it`)
      for (const p of ['ios', 'android']) {
        if (from?.[p]) assert.notEqual(isOlder(from[p], rule.BLUETOOTH_FROM_STORE[p]), true, `${unit} opens Edit over Bluetooth before Bluetooth itself on ${p}`)
      }
      const pin = EDIT_OPENED_AT?.[unit] ?? null
      assert.deepEqual(pinProblems({ builds, from: from || {}, stores: JSON.parse(src('public/store-versions.json')), pin, w: EDIT_WORDS }), [], `${unit}: Edit over Bluetooth's pin`)
    }
    /* The rule says no to the slips it is there for: a store version already out (it would open by update), one phone alone. */
    assert.ok(thresholdProblems(builds, { ios: '1.89.0', android: '1.89.0' }, app, EDIT_WORDS).length > 0, 'Edit over Bluetooth could open by update on copies already out')
    assert.ok(thresholdProblems(builds, { ios: app, android: null }, app, EDIT_WORDS).length > 0, 'Edit over Bluetooth could open on one phone alone')
    assert.deepEqual(thresholdProblems(builds, { ios: app, android: app }, app, EDIT_WORDS), [], 'the build pull request cannot set the switch')
    assert.ok(thresholdProblems(builds, { ios: app, android: app }, app, EDIT_WORDS).length === 0 && thresholdProblems(builds, { ios: app, android: app }, '9.0.0', EDIT_WORDS)[0]?.includes('Editing over Bluetooth for customers'), 'the rule does not say which row to write')
  })

  test('Edit opens over Bluetooth only through the switch, says what it does there, and keeps the computer’s jobs away', () => {
    const app = flat('mobile/App.js')
    assert.match(app, /\(!overBluetooth\(caps\) \|\| editOverBluetooth\(\)\) \? \(\) => setScreen\('edit'\)/)
    const lib = flat('mobile/src/lib/bluetooth.js')
    assert.match(lib, /export const editOverBluetooth = \(unit = saved\.unit\) => allowed === true && editOffered\(unit, \{ admin: allUnits, platform: Platform\.OS, installed: builtInVersion\(\) \}\)/)
    assert.match(lib, /edit: \(\) => editOverBluetooth\(unit\)/, 'the wire is not asked the switch at each request')
    const edit = flat('mobile/src/screens/Edit.js')
    assert.match(edit, /const viaBle = overBluetooth\(caps\)/)
    /* Up until its cross is pressed: "Make it so that this is a dismissible thing ... until they hit like an X". */
    assert.match(edit, /\{viaBle && bleNoteUp \? \( <Note onDismiss=\{\(\) => \{ setBleNoteUp\(false\) markBleEditNote\(\) \}\} > \{BLE_NOTE\} <\/Note> \) : null\}/)
    assert.match(edit, /const \[bleNoteUp, setBleNoteUp\] = useState\(false\)/, 'the note flashes up before storage has said it was put away')
    assert.match(edit, /bleEditNoteSeen\(\)\.then\(\(seen\) => \{ if \(alive && !seen\) setBleNoteUp\(true\) \}\)/)
    const coach = flat('mobile/src/lib/coach.js')
    assert.match(coach, /export function markBleEditNote\(\) \{ bleEditSettled = true AsyncStorage\.setItem\(BLE_EDIT_KEY, 'done'\)/)
    assert.match(edit, /channels\?\.length > 1 && block\.channel && !overBle \? \( <ChannelCopy/)
    assert.match(edit, /overBle=\{viaBle\}/)
    const words = code('mobile/src/screens/Edit.js')
    const note = /export const BLE_NOTE =\s*'([^']+)'/.exec(src('mobile/src/screens/Edit.js'))?.[1]
    assert.ok(note && /can’t save them over Bluetooth yet/.test(note) && /save it on the unit itself/.test(note), 'Edit does not say a change made over Bluetooth is lost unless it is saved on the unit')
    assert.ok(!/this phone/i.test(words), 'Edit names the device as a phone')
    /* Edit's own requests say so; Play's boost read does not, so over Bluetooth it stays refused. */
    const dev = flat('mobile/src/lib/device.js')
    for (const re of [
      /export const blockParams = async \(eid\) => fixRead\(await remoteRequest\(`\/preset\/blocks\/\$\{eid\}\/params`, EDITING\)\)/,
      /post\(`\/preset\/blocks\/\$\{eid\}\/type`, \{ value \}, EDITING\)/,
      /remoteRequest\(`\/blocks\/\$\{slug\}\/types`, EDITING\)/,
      /put\(`\/preset\/blocks\/\$\{eid\}\/params\/\$\{paramId\}`, \{ value: norm, continuous \}, EDITING\)/
    ])
      assert.match(dev, re)
    assert.match(dev, /export const readAmpBoost = \(path\) => remoteRequest\(path\)/, 'Play’s boost read is marked as Edit’s')
    const wire = flat('mobile/src/lib/bleWire.js')
    assert.match(wire, /const editing = opts\?\.editing === true && editOn\(\)/)
    assert.match(wire, /const editHere = am4 \|\| unit === 'fm3' const editOn = \(\) => editHere && \(typeof edit === 'function' \? edit\(\) === true : edit === true\)/, 'Edit over Bluetooth reaches a unit whose knobs are not built')
  })
  /* ---------------------------------------------------------------- */
  /* Edit over Bluetooth: the FM3's knobs                               */
  /* ---------------------------------------------------------------- */

  const FM3E = '../mobile/src/lib/fm3-edit.js'
  const FM3K = '../mobile/src/lib/fm3-knobs.js'

  /* The pretend FM3's amp, cab and drive, each block's values made up but fixed, four channels at the catalog's stride. */
  async function fm3Settings() {
    const { FM3_FAMILIES, FM3_BLOCKS } = await import(FM3K)
    const random = seeded(31)
    const settings = new Map()
    for (const eid of [58, 62, 66, 118]) {
      const stride = FM3_FAMILIES[FM3_BLOCKS[eid][1]].stride
      settings.set(eid, { count: stride * 4, values: Array.from({ length: stride * 4 }, () => (random() < 0.4 ? Math.floor(random() * 6) : Math.floor(random() * 65534))) })
    }
    const set = (eid, pid, ch, wire) => {
      const c = settings.get(eid)
      c.values[ch * (c.count / 4) + pid] = wire
    }
    return { settings, set }
  }

  test('Edit’s FM3 knobs come from the codec the computer app carries, by the computer’s own rules, for every block the pretend FM3 has', async () => {
    const k = await import(FM3K)
    const lock = JSON.parse(src('desktop/forgefx.lock.json'))
    assert.equal(k.FM3_KNOBS_FROM, lock['forgefx-midi'].commit, 'the FM3 knob table is not from the codec desktop/forgefx.lock.json pins: run scripts/fm3-knobs.mjs on it')
    assert.match(src('scripts/fm3-knobs.mjs'), /if \(head !== pinned\) throw new Error/, 'the table can be written from a codec that is not the pinned one')
    for (const [eid] of FM3_STATUS) assert.ok(k.FM3_BLOCKS[eid], `effect ${eid}, in the pretend FM3’s preset, is not in the catalog`)
    assert.deepEqual(k.FM3_BLOCKS[58], ['amp', 'DISTORT', 'Amp', 58])
    assert.deepEqual(k.FM3_BLOCKS[119], ['drive', 'FUZZ', 'Drive', 118])
    for (const [family, f] of Object.entries(k.FM3_FAMILIES)) {
      for (const knob of f.knobs) assert.ok(knob.length === 2 || (knob.length === 6 && knob[2] < knob[3]), `${family} ${knob[1]}: a knob with a range it cannot be drawn on`)
      for (const [, label, min, max, labels] of f.switches) assert.equal(labels.length, Math.min(128, max - min + 1), `${family} ${label}: options that are not its numbers`)
    }
    assert.equal(k.FM3_FAMILIES.DISTORT.stride, 144)
    assert.equal(k.FM3_FAMILIES.DISTORT.typeId, 6)
  })

  test('Edit’s FM3 messages are byte for byte the codec’s: the read, a knob, a typed write', async () => {
    const e = await import(FM3E)
    /* From forgefx-midi at the pinned commit: buildBlockBulkReadPoll, buildSetParameterContinuous, buildSetParameter (model 0x11). */
    assert.equal(hex(e.buildReadAll(0x11, 58)), 'F0 00 01 74 11 1F 3A 00 31 F7')
    assert.equal(hex(e.buildKnob(0x11, 58, 11, 0.5)), 'F0 00 01 74 11 01 52 00 3A 00 0B 00 00 00 00 78 03 00 00 00 00 0D F7')
    assert.equal(hex(e.buildTyped(0x11, 58, 10, 13)), 'F0 00 01 74 11 01 09 00 3A 00 0A 00 00 00 40 0A 04 00 00 00 00 62 F7')
    assert.throws(() => e.buildKnob(0x11, 58, 11, 1.2), /not 0\.\.1/)
  })

  test('an FM3 block’s settings read as the computer reads them: its channel’s slice, each knob’s scale, models, repeated names numbered', async () => {
    const e = await import(FM3E)
    const { settings, set } = await fm3Settings()
    set(58, 7, 1, 32767) // Gain, channel B: 0..10
    set(58, 1, 1, 65534) // Amp1 Level: -80..20 dB
    set(58, 12, 1, 32767) // Low Cut Frequency: 10..1000, log
    set(58, 6, 1, 13) // the model: 1987X Treble
    set(58, 7, 0, 0) // channel A's gain
    const out = e.blockParamsOf(58, settings.get(58), { channel: 1 })
    const knob = (id) => out.named.find((x) => x.id === id)
    /* The amp has two settings called Gain: the computer numbers them, and so does this. */
    assert.deepEqual(knob(7), { id: 7, name: 'Gain 1', value: 5, norm: 32767 / 65534, min: 0, max: 10 })
    assert.equal(knob(1).value, 20)
    assert.equal(knob(1).unit, 'dB')
    assert.equal(knob(12).value, 100)
    assert.equal(knob(12).log, true)
    assert.deepEqual(out.type, { value: 13, name: '1987X Treble' })
    assert.deepEqual([out.block, out.slug, out.page], ['Amp', 'amp', 58])
    assert.equal(out.layout?.family, 'DISTORT')
    assert.equal(e.blockParamsOf(58, settings.get(58), { channel: 0 }).named.find((x) => x.id === 7).value, 0, 'channel A is not the first slice')
    /* What the unit counts wins over the catalog's stride when the two disagree; a channel past the last one there is reads the last. */
    const odd = { count: 144 * 4 + 4, values: Array.from({ length: 144 * 4 + 4 }, (_, i) => i) }
    assert.equal(e.sliceOf(144, odd, 2).stride, 145)
    assert.equal(e.sliceOf(144, { count: 144, values: [] }, 3).base, 0)
    /* Past what the scale holds, it is shown 0 to 10, as the computer shows it. */
    set(58, 7, 1, 65535)
    assert.deepEqual(e.blockParamsOf(58, settings.get(58), { channel: 1 }).named.find((x) => x.id === 7), { id: 7, name: 'Gain 1', value: 10, norm: 1 })
    /* A cab's repeated names are numbered the computer's way (its Low Cuts), and a cab is never picked as a model over Bluetooth. */
    const cab = e.blockParamsOf(62, settings.get(62), { channel: 0 })
    assert.deepEqual(cab.named.filter((x) => /^Low Cut \d$/.test(x.name)).map((x) => x.name), ['Low Cut 1', 'Low Cut 2', 'Low Cut 3'])
    assert.deepEqual(e.modelsOf('cab'), [])
    assert.ok(e.modelFrame(0x11, 62, 3).refused)
    assert.equal(e.modelsOf('amp').find((m) => m.value === 13).basedOn, null)
    assert.equal(e.modelsOf('drive')[0].basedOn, 'Pro Co RAT')
  })

  test('Edit’s FM3 frames go only to a block the FM3 has just listed, only to settings the catalog names; everything the FM3 was sent before goes as it went', async () => {
    const e = await import(FM3E)
    const sx = await import(SX)
    const { gen3Sender } = await import(WIRE)
    const placed = FM3_STATUS.map(([eid]) => eid)
    assert.equal(e.fm3EditAllowed(e.buildReadAll(0x11, 58), placed), 'block settings read')
    assert.equal(e.fm3EditAllowed(e.buildReadAll(0x11, 74), placed), null, 'a block not in the preset')
    assert.equal(e.fm3EditAllowed(e.buildReadAll(0x11, 58), []), null)
    assert.equal(e.fm3EditAllowed(e.buildReadAll(0x12, 58), placed), null, 'another model’s frame')
    assert.equal(e.fm3EditAllowed(e.buildKnob(0x11, 58, 7, 0.4), placed), 'block knob')
    assert.equal(e.fm3EditAllowed(e.buildKnob(0x11, 58, 6, 0.4), placed), null, 'a model written as a knob')
    assert.equal(e.fm3EditAllowed(e.buildKnob(0x11, 58, 1999, 0.4), placed), null, 'a setting the catalog does not name')
    assert.equal(e.fm3EditAllowed(e.buildTyped(0x11, 58, 6, 13), placed), 'block model')
    assert.equal(e.fm3EditAllowed(e.buildTyped(0x11, 58, 6, 9999), placed), null)
    assert.equal(e.fm3EditAllowed(e.buildTyped(0x11, 62, 43, 3), placed), null, 'a cab picked as a model')
    assert.equal(e.fm3EditAllowed(e.buildTyped(0x11, 58, 7, 0.4), placed), 'block knob (typed)')
    const out = []
    let given = null
    const send = gen3Sender((b) => out.push(b), () => {}, 0x11, () => given)
    assert.equal(send(e.buildReadAll(0x11, 58)), 'refused', 'Edit’s read went with Edit closed')
    assert.equal(send(e.buildKnob(0x11, 58, 7, 0.4)), 'refused')
    given = placed
    assert.equal(send(e.buildReadAll(0x11, 58)), 'sent')
    assert.equal(send(e.buildReadAll(0x11, 74)), 'refused')
    /* What the FM3 was sent before Edit: the tempo's typed write at the Controllers, FM3-Edit's scene and channel, the published messages. */
    given = null
    for (const f of [sx.buildSetTempoEdit(0x11, 120), sx.buildSetSceneEdit(0x11, 3), sx.buildSetChannelEdit(0x11, 58, 'B'), sx.buildGetScene(0x11), sx.buildStatusDump(0x11), sx.buildTunerPoll(0x11)]) {
      assert.equal(send(f), 'sent', `${hex(f)} stopped going to an FM3`)
    }
  })

  test('over Bluetooth, Edit reads an FM3 block, turns a knob and picks a model; a block not in the preset, a cab model or Edit closed sends nothing', async () => {
    const e = await import(FM3E)
    const { settings, set } = await fm3Settings()
    set(58, 7, 1, 32767)
    set(58, 6, 1, 13)
    const t = await onTheLine('fm3', { edit: () => true, settings })
    t.unit.state.blocks.find((b) => b.eid === 58).channel = 1
    const ask = (path, opts = {}) => drive(t.clock, t.wire.request(path, { editing: true, ...opts }))
    const read = await ask('/preset/blocks/58/params')
    assert.equal(read.named.find((x) => x.id === 7).value, 5, 'the channel the amp is on was not the one read')
    assert.deepEqual(read.type, { value: 13, name: '1987X Treble' })
    const before = t.frames().length
    assert.deepEqual(await ask('/preset/blocks/58/params/7', { method: 'PUT', body: JSON.stringify({ value: 0.7, continuous: true }) }), { ok: true })
    assert.deepEqual(t.frames().slice(before).filter((f) => f[5] === 0x01).map(hex), [hex(e.buildKnob(0x11, 58, 7, 0.7))])
    assert.equal((await ask('/preset/blocks/58/params')).named.find((x) => x.id === 7).value, 7)
    /* The screen's read straight after the read-back sends nothing. */
    const quiet = t.frames().length
    await ask('/preset/blocks/58/params')
    assert.equal(t.frames().length, quiet, 'the read straight after was read again from the unit')
    /* A model, and the list the picker shows. */
    assert.deepEqual(await ask('/preset/blocks/58/type', { method: 'POST', body: JSON.stringify({ value: 2 }) }), { ok: true })
    assert.equal((await ask('/preset/blocks/58/params')).type.value, 2)
    assert.equal((await ask('/blocks/amp/types')).find((m) => m.value === 13).name, '1987X Treble')
    assert.deepEqual(await ask('/blocks/cab/types'), [])
    /* Refused, and nothing of Edit's sent: a block not in the preset, a cab model, a setting the catalog does not name. */
    const mark = t.frames().length
    await assert.rejects(ask('/preset/blocks/74/params'), /isn’t in the preset/)
    await assert.rejects(ask('/preset/blocks/62/type', { method: 'POST', body: JSON.stringify({ value: 3 }) }), /cab is picked with the computer/)
    await assert.rejects(ask('/preset/blocks/58/params/1999', { method: 'PUT', body: JSON.stringify({ value: 0.5 }) }), /isn’t one the app can change/)
    assert.ok(t.frames().slice(mark).every((f) => f[5] !== 0x1f && !(f[5] === 0x01 && (f[6] === 0x52 || f[6] === 0x09))), 'a refused request sent one of Edit’s frames')
    /* A request that is not Edit's, or Edit closed: refused, nothing sent. */
    await assert.rejects(t.get('/preset/blocks/58/params'))
    const closed = await onTheLine('fm3', { edit: () => false, settings })
    await assert.rejects(drive(closed.clock, closed.wire.request('/preset/blocks/58/params', { editing: true })))
    assert.ok(closed.frames().every((f) => f[5] !== 0x1f), 'a read went with Edit closed')
    /* Never an FM9's or an Axe-Fx III's, whose catalogs the phone does not carry. */
    for (const kind of ['fm9', 'axefx3']) {
      const other = await onTheLine(kind, { edit: () => true, settings })
      await assert.rejects(drive(other.clock, other.wire.request('/preset/blocks/58/params', { editing: true })))
      assert.ok(other.frames().every((f) => f[5] !== 0x1f), `a read went to an ${kind}`)
    }
  })

  test('an FM3 block whose settings come back damaged, or not at all, says so', async () => {
    const { settings } = await fm3Settings()
    const damaged = await onTheLine('fm3', { edit: () => true, settings, editDamage: true })
    await assert.rejects(drive(damaged.clock, damaged.wire.request('/preset/blocks/58/params', { editing: true })), /came back damaged/)
    const silent = await onTheLine('fm3', { edit: () => true, settings, editSilent: true })
    await assert.rejects(drive(silent.clock, silent.wire.request('/preset/blocks/58/params', { editing: true })), /didn’t send the Amp’s settings/)
  })
}
