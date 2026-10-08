/**
 * THE UNIT'S OWN LANGUAGE, SPOKEN STRAIGHT FROM THE PHONE.
 *
 * Over the relay the phone never builds a single byte: it asks the computer,
 * and ForgeFX on the computer talks to the unit. Bluetooth (beta) takes the
 * computer out, so the phone has to say the words itself — through a
 * Bluetooth MIDI adapter plugged into the unit's MIDI In and Out.
 *
 * Everything here is a plain function of numbers to numbers, with no imports,
 * so the test runner can hold every frame to the exact bytes a real unit was
 * seen to take. That matters more here than anywhere else in the app: this
 * build takes no over-the-air updates, so a wrong byte is not a quick fix, it
 * is another pair of store builds.
 *
 * WRITTEN FRESH FROM THE SPEC, not copied. forgefx-midi (Apache-2.0, Stephen
 * Staker) was used only to produce the test vectors this file is checked
 * against; nothing of its source is in here.
 *
 * Two families:
 *
 *   - FM3, FM9 and Axe-Fx III ("gen 3"): Fractal's published third-party
 *     commands, plus the few frames FM3-Edit itself sends where the published
 *     ones are known not to work on an FM3 (see design.md, section 0).
 *   - AM4: its own parameter protocol, and ONLY the frames on AM4_ALLOWED.
 *     The AM4 has frozen twice on messages it was not expecting, so the list
 *     is data here and every AM4 frame is checked against it before it is
 *     sent (isAllowedAm4).
 */

/* ------------------------------------------------------------------ */
/* The envelope                                                        */
/* ------------------------------------------------------------------ */

/** Fractal's maker id: every frame starts F0 00 01 74. */
export const MAKER = [0x00, 0x01, 0x74]

/*
 * Which unit a frame is for. A unit ignores, or refuses, a frame carrying
 * another unit's byte — which is why the page makes the player pick, and
 * never guesses: over 5-pin MIDI a unit does not answer "who are you".
 */
export const MODELS = { axefx3: 0x10, fm3: 0x11, fm9: 0x12, am4: 0x15 }

/** The model byte for a unit key, or null for a unit this file does not speak to. */
export const modelOf = (unit) => (Object.prototype.hasOwnProperty.call(MODELS, unit) ? MODELS[unit] : null)

/** The function bytes this file uses. */
export const FN = {
  PARAM: 0x01,
  BYPASS: 0x0a,
  CHANNEL: 0x0b,
  SCENE: 0x0c,
  PRESET_NAME: 0x0d,
  SCENE_NAME: 0x0e,
  TAP: 0x10,
  TUNER: 0x11,
  PAGE: 0x12,
  STATUS: 0x13,
  TEMPO: 0x14,
  REPLY: 0x64
}

/** 7F in the value slot turns a SET into a GET. 7F 7F is the same, fourteen bits wide. */
export const ASK = 0x7f
const ASK14 = 0x3fff

/** Fractal's checksum: every byte from F0 up to the checksum, XORed, kept to seven bits. */
export function checksum(bytes, end = bytes.length) {
  let x = 0
  for (let i = 0; i < end; i++) x ^= bytes[i]
  return x & 0x7f
}

/** A whole frame: F0 00 01 74 <model> <fn> <payload> <checksum> F7. */
export function frame(model, fn, payload = []) {
  const body = [0xf0, ...MAKER, model, fn, ...payload]
  return [...body, checksum(body), 0xf7]
}

/** Whether these bytes are a complete Fractal frame, of any unit. */
export function isFractal(f) {
  return (
    Array.isArray(f) &&
    f.length >= 7 &&
    f[0] === 0xf0 &&
    f[1] === MAKER[0] &&
    f[2] === MAKER[1] &&
    f[3] === MAKER[2] &&
    f[f.length - 1] === 0xf7
  )
}

/** Whether a frame's checksum holds. A frame too short to carry one does not. */
export const checksumOk = (f) => Array.isArray(f) && f.length >= 8 && checksum(f, f.length - 2) === f[f.length - 2]

/* ------------------------------------------------------------------ */
/* Numbers on a wire that only carries seven bits                      */
/* ------------------------------------------------------------------ */

/**
 * A number up to 16383 as two bytes, low seven bits first. Block ids, preset
 * numbers and BPM all travel this way. Throws rather than wrapping, because a
 * wrapped preset number is a different preset.
 */
export function encode14(n) {
  if (!Number.isInteger(n) || n < 0 || n > ASK14) throw new Error(`${n} does not fit in fourteen bits`)
  return [n & 0x7f, (n >> 7) & 0x7f]
}

export const decode14 = (lo, hi) => (lo & 0x7f) | ((hi & 0x7f) << 7)

/**
 * GEN 3: a 32-bit word as five bytes, low seven bits first. The FM3-Edit
 * frames carry their value this way — a scene number, a channel, or the bits
 * of a float (tempo, the tuner's frequency).
 */
export const septets32 = (u) => [u & 0x7f, (u >>> 7) & 0x7f, (u >>> 14) & 0x7f, (u >>> 21) & 0x7f, (u >>> 28) & 0x0f]

export const fromSeptets32 = (s, at = 0) =>
  ((s[at] & 0x7f) | ((s[at + 1] & 0x7f) << 7) | ((s[at + 2] & 0x7f) << 14) | ((s[at + 3] & 0x7f) << 21) | ((s[at + 4] & 0x0f) << 28)) >>> 0

/* One four-byte scratch space for turning a float into its bits and back. */
const scratch = new DataView(new ArrayBuffer(4))

/** The IEEE-754 single-precision bits of a number. */
export function floatBits(x) {
  scratch.setFloat32(0, x, true)
  return scratch.getUint32(0, true)
}

/** The number a set of single-precision bits stands for. */
export function bitsFloat(u) {
  scratch.setUint32(0, u >>> 0, true)
  return scratch.getFloat32(0, true)
}

/** GEN 3: a float as the five septets an FM3-Edit frame carries. */
export const floatSeptets = (x) => septets32(floatBits(x))
export const septetsFloat = (s, at = 0) => bitsFloat(fromSeptets32(s, at))

const u32le = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
const readU32le = (b, at) => ((b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0)
const readF32le = (b, at) => bitsFloat(readU32le(b, at))

/**
 * AM4: eight-bit bytes as a stream of seven-bit ones, the top bit of the
 * first byte first, the last septet padded with zeros at the bottom.
 *
 * ForgeFX describes this two ways — the structure read as ONE continuous
 * stream (packMsb / unpackMsb), everything else as a stream that restarts
 * every seven bytes (packChunked / unpackChunked) — and both are kept here
 * under those names so each reads like the spec it came from. They are the
 * same bytes: seven bytes are exactly eight septets, so a restart lands where
 * the continuous stream already is. The test holds them to each other. What
 * DOES scramble every field is reading the bits the other way round, low bit
 * first, which is the mistake ForgeFX's note warns about.
 */
export function packMsb(raw) {
  const out = []
  let acc = 0
  let bits = 0
  for (const b of raw) {
    acc = (acc << 8) | (b & 0xff)
    bits += 8
    while (bits >= 7) {
      bits -= 7
      out.push((acc >> bits) & 0x7f)
    }
    acc &= (1 << bits) - 1
  }
  if (bits > 0) out.push((acc << (7 - bits)) & 0x7f)
  return out
}

/** The inverse: `rawLen` bytes back out of a continuous septet stream. */
export function unpackMsb(septets, rawLen) {
  const out = new Array(rawLen).fill(0)
  let acc = 0
  let bits = 0
  let o = 0
  for (const s of septets) {
    if (o >= rawLen) break
    acc = (acc << 7) | (s & 0x7f)
    bits += 7
    while (bits >= 8 && o < rawLen) {
      bits -= 8
      out[o++] = (acc >> bits) & 0xff
    }
    acc &= (1 << bits) - 1
  }
  return out
}

/** Seven raw bytes travel as eight, and a shorter last run of N as N + 1. */
export function packChunked(raw) {
  const out = []
  for (let at = 0; at < raw.length; at += 7) out.push(...packMsb(raw.slice(at, at + 7)))
  return out
}

export function unpackChunked(wire, rawLen) {
  const out = []
  let w = 0
  while (out.length < rawLen) {
    const take = Math.min(7, rawLen - out.length)
    const span = take === 7 ? 8 : take + 1
    out.push(...unpackMsb(wire.slice(w, w + span), take))
    w += span
  }
  return out
}

/** How many wire bytes a chunked run of `rawLen` raw bytes takes. */
export const chunkedLength = (rawLen) => Math.floor(rawLen / 7) * 8 + (rawLen % 7 ? (rawLen % 7) + 1 : 0)

/** AM4: a whole number, and a float, as the five bytes a SET carries. */
export const am4U32 = (n) => packChunked(u32le(n >>> 0))
export const am4Float = (x) => packChunked(u32le(floatBits(x)))
export const am4ReadU32 = (wire, at = 0) => readU32le(unpackChunked(wire.slice(at, at + 5), 4), 0)
export const am4ReadFloat = (wire, at = 0) => readF32le(unpackChunked(wire.slice(at, at + 5), 4), 0)

/* ------------------------------------------------------------------ */
/* Bytes a person can read                                             */
/* ------------------------------------------------------------------ */

/** 'F0 00 01 74 …', for the log and the check panel. */
export const toHex = (bytes) => (Array.isArray(bytes) ? bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0').toUpperCase()).join(' ') : '')

/** Back from hex, with or without spaces. */
export const fromHex = (hex) => (String(hex || '').replace(/[^0-9a-f]/gi, '').match(/../g) || []).map((x) => parseInt(x, 16))

/** Two frames byte for byte. */
export function sameBytes(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/* ------------------------------------------------------------------ */
/* Gen 3: FM3, FM9, Axe-Fx III — the frames                            */
/* ------------------------------------------------------------------ */

const CHANNELS = ['A', 'B', 'C', 'D']

/** A channel as the unit counts it, 0..3, from a letter or a number; null otherwise. */
export function channelIndex(c) {
  if (Number.isInteger(c) && c >= 0 && c <= 3) return c
  const i = CHANNELS.indexOf(String(c ?? '').trim().toUpperCase())
  return i >= 0 ? i : null
}
export const channelLetter = (i) => CHANNELS[i] ?? null

const scene8 = (i) => {
  if (!Number.isInteger(i) || i < 0 || i > 7) throw new Error(`scene ${i} is not 0..7`)
  return i
}

/**
 * FM3-Edit's own frames (fn 0x01): a sub-action, a block, a parameter and a
 * five-byte value, then four zeros. The scene, channel, preset, tempo and
 * tuner frames below are all this one shape, which is why they are one
 * builder: one place for the layout to be right.
 */
export function buildEditFrame(model, sub, eid, pid, value) {
  return frame(model, FN.PARAM, [...encode14(sub), ...encode14(eid), ...encode14(pid), ...value, 0, 0, 0, 0])
}

export const buildGetScene = (model) => frame(model, FN.SCENE, [ASK])
export const buildSetScene = (model, index) => frame(model, FN.SCENE, [scene8(index)])
/** FM3-Edit's scene change: sub 0x24, parameter 1, the scene as a number. */
export const buildSetSceneEdit = (model, index) => buildEditFrame(model, 0x24, 0, 1, septets32(scene8(index)))

/** The loaded preset's number and name. The only way a gen-3 unit says which preset it is on. */
export const buildGetPreset = (model) => frame(model, FN.PRESET_NAME, [ASK, ASK])
/** A stored slot's name, asked by number. */
export const buildGetPresetName = (model, number) => frame(model, FN.PRESET_NAME, encode14(number))

export const buildGetSceneName = (model, index) => frame(model, FN.SCENE_NAME, [scene8(index)])

export const buildSetBypass = (model, eid, bypassed) => frame(model, FN.BYPASS, [...encode14(eid), bypassed ? 1 : 0])

export function buildSetChannel(model, eid, channel) {
  const c = channelIndex(channel)
  if (c === null) throw new Error(`channel ${channel} is not A..D`)
  return frame(model, FN.CHANNEL, [...encode14(eid), c])
}
/** FM3-Edit's channel change: sub 0x16, the block, the channel as a number. */
export function buildSetChannelEdit(model, eid, channel) {
  const c = channelIndex(channel)
  if (c === null) throw new Error(`channel ${channel} is not A..D`)
  return buildEditFrame(model, 0x16, eid, 0, septets32(c))
}

/**
 * Switch preset with the unpublished sub 0x27 frame. The published spec has
 * no SysEx preset switch at all; this one is FM3-Edit's, confirmed on an FM3.
 * The number rides in the value slot exactly as a whole number would.
 */
export function buildSwitchPreset(model, number) {
  if (!Number.isInteger(number) || number < 0 || number > 1023) throw new Error(`preset ${number} is not 0..1023`)
  return buildEditFrame(model, 0x27, 0, 0, septets32(number))
}

/**
 * The published way to switch preset: Bank Select, then Program Change.
 * Three separate messages, because the phone's MIDI layer sends one at a time.
 *
 * WHERE THE BANK GOES differs by unit, and getting it wrong lands on another
 * preset rather than failing: the FM3 on firmware 12.00 ignores CC32 (a switch
 * to 438 landed on 54), so the FM3 and FM9 take it in CC0; the Axe-Fx III
 * takes it in CC32.
 */
export function buildProgramChange(number, { channel = 1, bankIn = 'cc0' } = {}) {
  if (!Number.isInteger(number) || number < 0 || number > 16383) throw new Error(`preset ${number} is out of range`)
  if (!Number.isInteger(channel) || channel < 1 || channel > 16) throw new Error(`MIDI number ${channel} is not 1..16`)
  const ch = channel - 1
  const bank = number >> 7
  const [cc0, cc32] = bankIn === 'cc32' ? [(bank >> 7) & 0x7f, bank & 0x7f] : [bank & 0x7f, 0]
  return [
    [0xb0 | ch, 0x00, cc0],
    [0xb0 | ch, 0x20, cc32],
    [0xc0 | ch, number & 0x7f]
  ]
}

export const buildTap = (model) => frame(model, FN.TAP)
export const buildTuner = (model, on) => frame(model, FN.TUNER, [on ? 1 : 0])
/** FM3-Edit opens the tuner page before it asks for the frequency, and closes it after. */
export const buildTunerPage = (model, open) => frame(model, FN.PAGE, [open ? 0x1e : 0x08])
/** The detected frequency, asked for. */
export const buildTunerPoll = (model) => buildEditFrame(model, 0x19, 0x23, 0x02, [0, 0, 0, 0, 0])
export const buildStatusDump = (model) => frame(model, FN.STATUS)
export const buildGetTempo = (model) => frame(model, FN.TEMPO, [ASK, ASK])

const bpmOk = (bpm) => {
  if (!Number.isInteger(bpm) || bpm < 1 || bpm >= ASK14) throw new Error(`tempo ${bpm} is out of range`)
  return bpm
}
/** The published tempo SET. It does not take on an FM3; see buildSetTempoEdit. */
export const buildSetTempo = (model, bpm) => frame(model, FN.TEMPO, encode14(bpmOk(bpm)))
/** FM3-Edit's tempo write: the Controllers block (2), parameter 0x20, the BPM as a float. */
export function buildSetTempoEdit(model, bpm) {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Error(`tempo ${bpm} is out of range`)
  return buildEditFrame(model, 0x09, 0x02, 0x20, floatSeptets(bpm))
}

/* ------------------------------------------------------------------ */
/* Gen 3 — reading what comes back                                     */
/* ------------------------------------------------------------------ */

/*
 * Every parser answers null for a frame that is not its answer, and never
 * throws: they are run over everything that arrives, including the half of it
 * that is about something else.
 */
const isFrom = (f, model, fn) => isFractal(f) && f[4] === model && f[5] === fn
const payloadOf = (f) => f.slice(6, -2)

/** A name off the wire: printable ASCII, stopped at a NUL, padding trimmed. */
function asciiName(bytes) {
  let s = ''
  for (const b of bytes) {
    if (b === 0) break
    s += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ' '
  }
  return s.trim()
}

/** The scene a reply carries, 0..7. The 7F of our own GET is never a scene. */
export function parseScene(f, model) {
  if (!isFrom(f, model, FN.SCENE) || f.length !== 9 || !checksumOk(f)) return null
  if (f[6] === ASK) return null
  return f[6] & 0x07
}

/** {number, name} from a 0x0D reply; null for anything else, including the 7F 7F sentinel. */
export function parsePresetName(f, model) {
  if (!isFrom(f, model, FN.PRESET_NAME) || f.length < 11 || !checksumOk(f)) return null
  const number = decode14(f[6], f[7])
  if (number === ASK14) return null
  return { number, name: asciiName(f.slice(8, -2)) }
}

/** {index, name} from a 0x0E reply. */
export function parseSceneName(f, model) {
  if (!isFrom(f, model, FN.SCENE_NAME) || f.length < 10 || !checksumOk(f)) return null
  if (f[6] === ASK) return null
  return { index: f[6] & 0x07, name: asciiName(f.slice(7, -2)) }
}

/**
 * The status dump: every block in the loaded preset, three bytes each — the
 * effect id, then one byte holding bypass (bit 0), the channel (bits 1-3) and
 * how many channels the block has (bits 4-6).
 */
export function parseStatusDump(f, model) {
  if (!isFrom(f, model, FN.STATUS) || !checksumOk(f)) return null
  const p = payloadOf(f)
  if (p.length % 3) return null
  const out = []
  for (let i = 0; i < p.length; i += 3) {
    const dd = p[i + 2]
    out.push({ effectId: decode14(p[i], p[i + 1]), bypassed: (dd & 1) === 1, channel: (dd >> 1) & 7, channels: (dd >> 4) & 7 })
  }
  return out
}

/** BPM from a 0x14 reply; null for the 7F 7F sentinel. */
export function parseTempo(f, model) {
  if (!isFrom(f, model, FN.TEMPO) || f.length !== 10 || !checksumOk(f)) return null
  const bpm = decode14(f[6], f[7])
  return bpm === ASK14 ? null : bpm
}

/** Hz from the answer to buildTunerPoll: a float at bytes 12-16. */
export function parseTunerPoll(f, model) {
  if (!isFrom(f, model, FN.PARAM) || f.length !== 23 || !checksumOk(f)) return null
  if (f[6] !== 0x19 || f[8] !== 0x23 || f[10] !== 0x02) return null
  const hz = septetsFloat(f, 12)
  return Number.isFinite(hz) && hz >= 0 ? hz : null
}

/**
 * The tuner data a unit sends by itself when Global "Send Realtime Sysex" is
 * on: three bytes. Their meaning is not in any spec on file, so they come back
 * as they are and the wire decides what to make of them. Accepted with or
 * without a checksum, because nothing on file says whether a push carries one.
 */
export function parseTunerPush(f, model) {
  if (!isFrom(f, model, FN.TUNER) || (f.length !== 10 && f.length !== 11)) return null
  if (f.length === 11 && !checksumOk(f)) return null
  return { note: f[6], string: f[7], fine: f[8] }
}

/** The tempo beat a unit sends by itself (same setting). Nothing in it but that it happened. */
export const isBeatPush = (f, model) => isFrom(f, model, FN.TAP) && (f.length === 7 || f.length === 8)

/** A refusal: `64 <the function it refuses> <why>`. Any unit's, by model byte. */
export function parseRejected(f, model) {
  if (!isFrom(f, model, FN.REPLY) || f.length !== 10 || !checksumOk(f)) return null
  return { fn: f[6], code: f[7] }
}

/** Why a unit refused, in words. */
export const REJECTED = {
  0x00: 'the message arrived damaged',
  0x02: 'it is addressed to a different model',
  0x04: 'the unit does not know that message',
  0x05: 'there is no such block',
  0x07: 'that block is not in this preset'
}
export const rejectedWords = (code) => REJECTED[code] || `code ${toHex([code])}`

/* ------------------------------------------------------------------ */
/* AM4                                                                 */
/* ------------------------------------------------------------------ */

/*
 * An AM4 frame is fn 0x01 with a sixteen-byte header: the address (pidLow,
 * pidHigh), what to do with it (action), and two lengths (hdr3, hdr4), each
 * fourteen bits wide. hdr4 is how many raw bytes of value follow.
 */
export const AM4 = {
  PRESET_REG: 0x00ce,
  STRUCTURE: 0x0000,
  PRESET: 0x000a,
  NAME: 0x000b,
  SCENE: 0x000d,
  BYPASS: 0x0003,
  CHANNEL_READ: 0x07dd,
  CHANNEL_WRITE: 0x07d2,
  TEMPO_LOW: 0x0002,
  TEMPO_HIGH: 0x001c,
  TUNER: 0x0023,
  SET: 0x0001,
  SET_NORM: 0x0002,
  READ_LONG: 0x000d,
  POLL: 0x0010,
  READ_NAME: 0x0012,
  READ_STRUCTURE: 0x001f,
  TEMPO_MIN: 24,
  TEMPO_MAX: 250,
  LOCATIONS: 104,
  SCENES: 4
}

/**
 * What each block is called, by the code the AM4 files it under. A second
 * copy of a block in the same preset sits one above its base (a second drive
 * is 0x77), so a code is read as the nearest base below it, within four.
 */
export const AM4_BLOCKS = {
  amp: 0x3a,
  compressor: 0x2e,
  geq: 0x32,
  peq: 0x36,
  reverb: 0x42,
  delay: 0x46,
  chorus: 0x4e,
  flanger: 0x52,
  rotary: 0x56,
  phaser: 0x5a,
  wah: 0x5e,
  volpan: 0x66,
  tremolo: 0x6a,
  filter: 0x72,
  drive: 0x76,
  enhancer: 0x7a,
  gate: 0x92
}

/** {slug, base, copy} for a block code the AM4 reports, or null for none or one nobody has seen. */
export function am4Block(code) {
  if (!Number.isInteger(code) || code <= 0) return null
  let best = null
  for (const [slug, base] of Object.entries(AM4_BLOCKS)) {
    if (code >= base && code < base + 4 && (!best || base > best.base)) best = { slug, base, copy: code - base }
  }
  return best
}

/** The AM4's own name for a stored location, as its display shows it: A01 to Z04. */
export function am4LocationCode(n) {
  if (!Number.isInteger(n) || n < 0 || n >= AM4.LOCATIONS) return ''
  return `${String.fromCharCode(65 + (n >> 2))}${String((n & 3) + 1).padStart(2, '0')}`
}

/** BPM as the 0..1 the AM4 stores, clamped to its 24..250. */
export function am4TempoNorm(bpm) {
  const n = (Number(bpm) - AM4.TEMPO_MIN) / (AM4.TEMPO_MAX - AM4.TEMPO_MIN)
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
}

/** One AM4 frame from its header fields. */
export function am4Frame({ pidLow, pidHigh, action, hdr3 = 0, hdr4 = 0, payload = [] }) {
  return frame(MODELS.am4, FN.PARAM, [
    ...encode14(pidLow),
    ...encode14(pidHigh),
    ...encode14(action),
    ...encode14(hdr3),
    ...encode14(hdr4),
    ...payload
  ])
}

const am4Code = (code) => {
  if (!am4Block(code)) throw new Error(`0x${Number(code).toString(16)} is not an AM4 block`)
  return code
}
const location = (n) => {
  if (!Number.isInteger(n) || n < 0 || n >= AM4.LOCATIONS) throw new Error(`location ${n} is not 0..103`)
  return n
}

/** The structure read: location, scene, name and the four slots, in one answer. */
export const buildAm4Structure = () => am4Frame({ pidLow: AM4.PRESET_REG, pidHigh: AM4.STRUCTURE, action: AM4.READ_STRUCTURE })
/** A stored location's name. Its answer does not say which location, so they go one at a time. */
export const buildAm4StoredName = (n) =>
  am4Frame({ pidLow: AM4.PRESET_REG, pidHigh: AM4.NAME, action: AM4.READ_NAME, hdr4: 4, payload: am4U32(location(n)) })
export const buildAm4BypassRead = (code) => am4Frame({ pidLow: am4Code(code), pidHigh: AM4.BYPASS, action: AM4.READ_LONG })
/** Read from 0x07DD. Reading 0x07D2, where the channel is written, answers stale numbers. */
export const buildAm4ChannelRead = (code) => am4Frame({ pidLow: am4Code(code), pidHigh: AM4.CHANNEL_READ, action: AM4.READ_LONG })
export const buildAm4TempoRead = () => am4Frame({ pidLow: AM4.TEMPO_LOW, pidHigh: AM4.TEMPO_HIGH, action: AM4.READ_LONG })
/** One of the tuner's four readings: 1 note, 2 frequency, 3 cents, 4 string. */
export function buildAm4TunerPoll(which) {
  if (!Number.isInteger(which) || which < 1 || which > 4) throw new Error(`tuner reading ${which} is not 1..4`)
  return am4Frame({ pidLow: AM4.TUNER, pidHigh: which, action: AM4.POLL })
}

/** The scene, as a whole number. (The preset below is a float. The AM4 is like that.) */
export function buildAm4Scene(index) {
  if (!Number.isInteger(index) || index < 0 || index >= AM4.SCENES) throw new Error(`scene ${index} is not 0..3`)
  return am4Frame({ pidLow: AM4.PRESET_REG, pidHigh: AM4.SCENE, action: AM4.SET, hdr4: 4, payload: am4U32(index) })
}
/** Load a stored location. Anything unsaved on the unit is lost, exactly as on its own front panel. */
export const buildAm4Preset = (n) =>
  am4Frame({ pidLow: AM4.PRESET_REG, pidHigh: AM4.PRESET, action: AM4.SET, hdr4: 4, payload: am4Float(location(n)) })
export const buildAm4Bypass = (code, bypassed) =>
  am4Frame({ pidLow: am4Code(code), pidHigh: AM4.BYPASS, action: AM4.SET, hdr4: 4, payload: am4Float(bypassed ? 1 : 0) })
/** Always at the block's BASE code: a channel written to a second copy's code lands nowhere. */
export function buildAm4Channel(code, channel) {
  const c = channelIndex(channel)
  if (c === null) throw new Error(`channel ${channel} is not A..D`)
  const base = am4Block(am4Code(code)).base
  return am4Frame({ pidLow: base, pidHigh: AM4.CHANNEL_WRITE, action: AM4.SET, hdr4: 4, payload: am4Float(c) })
}
export const buildAm4Tempo = (bpm) =>
  am4Frame({ pidLow: AM4.TEMPO_LOW, pidHigh: AM4.TEMPO_HIGH, action: AM4.SET_NORM, hdr4: 4, payload: am4Float(am4TempoNorm(bpm)) })

/* ------------------------------------------------------------------ */
/* AM4 — the only frames it may ever be sent                           */
/* ------------------------------------------------------------------ */

/*
 * THE ALLOWLIST, as data, because the AM4 has frozen twice on things it was
 * sent that it did not expect: a "finder" that swept fn 0x1F across every
 * block id, and a guessed metronome write. Both needed a power cycle.
 *
 * Every frame the AM4 wire sends is held against this list first, and one
 * that is not on it is not sent (bleWire's sendFrame). `pidLow: 'block'` is
 * any block code the AM4 reports, a second copy included; `'base'` is a
 * block's base code only, for the one write that must go there.
 *
 * Deliberately NOT here, ever, over Bluetooth: fn 0x1F, the fn 0x03 dumps
 * (so no AM4 scene names in this version), saving (action 0x1B), renaming,
 * placing blocks, any other parameter write, the identify broadcast, the
 * firmware question, and the gen-3 probes.
 */
export const AM4_ALLOWED = [
  { name: 'structure read', fn: 0x01, pidLow: 0x00ce, pidHigh: 0x0000, action: 0x001f, hdr4: 0, size: 18 },
  { name: 'stored preset name', fn: 0x01, pidLow: 0x00ce, pidHigh: 0x000b, action: 0x0012, hdr4: 4, size: 23, value: { u32: [0, 103] } },
  { name: 'block on/off read', fn: 0x01, pidLow: 'block', pidHigh: 0x0003, action: 0x000d, hdr4: 0, size: 18 },
  { name: 'block channel read', fn: 0x01, pidLow: 'block', pidHigh: 0x07dd, action: 0x000d, hdr4: 0, size: 18 },
  { name: 'tempo read', fn: 0x01, pidLow: 0x0002, pidHigh: 0x001c, action: 0x000d, hdr4: 0, size: 18 },
  { name: 'tuner note', fn: 0x01, pidLow: 0x0023, pidHigh: 0x0001, action: 0x0010, hdr4: 0, size: 18 },
  { name: 'tuner frequency', fn: 0x01, pidLow: 0x0023, pidHigh: 0x0002, action: 0x0010, hdr4: 0, size: 18 },
  { name: 'tuner cents', fn: 0x01, pidLow: 0x0023, pidHigh: 0x0003, action: 0x0010, hdr4: 0, size: 18 },
  { name: 'tuner string', fn: 0x01, pidLow: 0x0023, pidHigh: 0x0004, action: 0x0010, hdr4: 0, size: 18 },
  { name: 'scene change', fn: 0x01, pidLow: 0x00ce, pidHigh: 0x000d, action: 0x0001, hdr4: 4, size: 23, value: { u32: [0, 3] } },
  { name: 'preset change', fn: 0x01, pidLow: 0x00ce, pidHigh: 0x000a, action: 0x0001, hdr4: 4, size: 23, value: { float: [0, 103], whole: true } },
  { name: 'block on/off', fn: 0x01, pidLow: 'block', pidHigh: 0x0003, action: 0x0001, hdr4: 4, size: 23, value: { float: [0, 1], whole: true } },
  { name: 'block channel', fn: 0x01, pidLow: 'base', pidHigh: 0x07d2, action: 0x0001, hdr4: 4, size: 23, value: { float: [0, 3], whole: true } },
  { name: 'tempo change', fn: 0x01, pidLow: 0x0002, pidHigh: 0x001c, action: 0x0002, hdr4: 4, size: 23, value: { float: [0, 1] } }
]

const pidLowFits = (want, got) => {
  if (want === 'block') return !!am4Block(got)
  if (want === 'base') return Object.values(AM4_BLOCKS).includes(got)
  return want === got
}

const valueFits = (want, f) => {
  if (!want) return true
  const wire = f.slice(16, 21)
  if (want.u32) {
    const v = am4ReadU32(wire)
    return v >= want.u32[0] && v <= want.u32[1]
  }
  const v = am4ReadFloat(wire)
  if (!Number.isFinite(v) || v < want.float[0] || v > want.float[1]) return false
  return !want.whole || Number.isInteger(v)
}

/**
 * The allowlist entry a frame is, or null. Every byte is looked at: the
 * envelope, the checksum, the length, the header and the value — a frame that
 * is right in its header and wrong in its value is still a frame the AM4 has
 * never been sent.
 */
export function am4Allowed(f) {
  if (!Array.isArray(f) || f.length < 18) return null
  for (let i = 0; i < f.length; i++) {
    const b = f[i]
    if (!Number.isInteger(b) || b < 0 || b > 0xff) return null
    if (i > 0 && i < f.length - 1 && b > 0x7f) return null
  }
  if (!isFractal(f) || f[4] !== MODELS.am4 || !checksumOk(f)) return null
  const pidLow = decode14(f[6], f[7])
  const pidHigh = decode14(f[8], f[9])
  const action = decode14(f[10], f[11])
  const hdr3 = decode14(f[12], f[13])
  const hdr4 = decode14(f[14], f[15])
  if (hdr3 !== 0) return null
  return (
    AM4_ALLOWED.find(
      (a) =>
        a.fn === f[5] &&
        a.size === f.length &&
        a.pidHigh === pidHigh &&
        a.action === action &&
        a.hdr4 === hdr4 &&
        pidLowFits(a.pidLow, pidLow) &&
        valueFits(a.value, f)
    ) || null
  )
}

/** Whether the AM4 may be sent these bytes. */
export const isAllowedAm4 = (f) => am4Allowed(f) !== null

/* ------------------------------------------------------------------ */
/* AM4 — reading what comes back                                       */
/* ------------------------------------------------------------------ */

const headMatches = (f, request) => {
  for (let i = 0; i < 12; i++) if (f[i] !== request[i]) return false
  return true
}

/*
 * THE STRUCTURE READ'S ANSWER: 192 bytes as one continuous stream.
 *
 * Nobody has yet checked that this answer carries a good checksum, so a bad
 * one is reported (checksumOk) rather than thrown away: dropping it would
 * leave the AM4 path blind, and that is a fix only a new build could deliver.
 * The numbers in it are held to their ranges instead, so a damaged answer
 * that says preset 3000 is still refused.
 */
const STRUCTURE_BYTES = 192
export function parseAm4Structure(f) {
  if (!isFrom(f, MODELS.am4, FN.PARAM) || f.length < 230) return null
  if (decode14(f[6], f[7]) !== AM4.PRESET_REG || decode14(f[8], f[9]) !== AM4.STRUCTURE) return null
  if (decode14(f[10], f[11]) !== AM4.READ_STRUCTURE) return null
  const raw = unpackMsb(f.slice(16, -2), STRUCTURE_BYTES)
  const at = readU32le(raw, 0x00)
  const scene = readU32le(raw, 0x08)
  if (at >= AM4.LOCATIONS || scene >= AM4.SCENES) return null
  return {
    location: at,
    scene,
    name: asciiName(raw.slice(0x10, 0x30)),
    slots: [0xb0, 0xb4, 0xb8, 0xbc].map((o) => readU32le(raw, o)),
    checksumOk: checksumOk(f)
  }
}

/** A stored name's answer: 55 bytes, 32 raw bytes of name. '<EMPTY>' is an empty slot. */
export function parseAm4StoredName(f) {
  if (!Array.isArray(f) || f.length !== 55 || !headMatches(f, buildAm4StoredName(0))) return null
  if (f[12] !== 0 || f[13] !== 0 || decode14(f[14], f[15]) !== 32 || f[54] !== 0xf7 || !checksumOk(f)) return null
  const name = asciiName(unpackChunked(f.slice(16, 53), 32))
  return name === '<EMPTY>' ? { name: '', empty: true } : { name, empty: false }
}

/** On/off from a block's long read: 64 bytes, and wire byte 22 is 01 when it is off. */
export function parseAm4Bypass(f, code) {
  if (!Array.isArray(f) || f.length !== 64 || !am4Block(code) || !headMatches(f, buildAm4BypassRead(code))) return null
  if (f[12] !== 0 || f[13] !== 0 || decode14(f[14], f[15]) !== 40 || f[63] !== 0xf7 || !checksumOk(f)) return null
  return f[22] === 0x01
}

/** The channel from a block's 0x07DD read: raw byte 50, 0..3 for A..D. */
export function parseAm4Channel(f, code) {
  if (!isFrom(f, MODELS.am4, FN.PARAM) || f.length < 18 || !checksumOk(f)) return null
  if (decode14(f[6], f[7]) !== code || decode14(f[8], f[9]) !== AM4.CHANNEL_READ || decode14(f[10], f[11]) !== AM4.READ_LONG) return null
  const size = decode14(f[14], f[15])
  if (size <= 50 || f.length - 18 < chunkedLength(size)) return null
  const c = unpackChunked(f.slice(16, -2), size)[50]
  return c >= 0 && c <= 3 ? c : null
}

/**
 * BPM from the tempo long read. The whole BPM is in the first two raw bytes;
 * if that is out of range the stored 0..1 float after it is used instead.
 */
export function parseAm4Tempo(f) {
  if (!isFrom(f, MODELS.am4, FN.PARAM) || f.length < 23 || !checksumOk(f)) return null
  if (decode14(f[6], f[7]) !== AM4.TEMPO_LOW || decode14(f[8], f[9]) !== AM4.TEMPO_HIGH) return null
  if (decode14(f[10], f[11]) !== AM4.READ_LONG) return null
  const size = decode14(f[14], f[15])
  if (size < 8 || f.length - 18 < chunkedLength(size)) return null
  const raw = unpackChunked(f.slice(16, -2), size)
  const whole = raw[0] | (raw[1] << 8)
  if (whole >= AM4.TEMPO_MIN && whole <= AM4.TEMPO_MAX) return whole
  const norm = readF32le(raw, 4)
  if (Number.isFinite(norm) && norm >= 0 && norm <= 1) return Math.round(AM4.TEMPO_MIN + norm * (AM4.TEMPO_MAX - AM4.TEMPO_MIN))
  return null
}

/** One tuner reading, as the float it is: a note index, Hz, cents or a string number. */
export function parseAm4TunerPoll(f, which) {
  if (!Array.isArray(f) || f.length !== 23 || !headMatches(f, buildAm4TunerPoll(which))) return null
  if (f[12] !== 0 || f[13] !== 0 || decode14(f[14], f[15]) !== 4 || f[22] !== 0xf7 || !checksumOk(f)) return null
  const v = am4ReadFloat(f, 16)
  return Number.isFinite(v) ? v : null
}

/* ------------------------------------------------------------------ */
/* SysEx split across Bluetooth packets                                */
/* ------------------------------------------------------------------ */

/**
 * ONE JOINER, IN JAVASCRIPT, so both phones put frames back together the same
 * way and a test can watch it do so.
 *
 * Bluetooth MIDI cuts a long SysEx into packets, and Android hands them over
 * "as received": half a frame, two frames, a timing clock byte in the middle
 * of one. The native side only forwards bytes; this puts them back together.
 *
 *   - F8..FF (real-time) can land inside a SysEx and are skipped.
 *   - F0 starts a frame, and throws away any frame left unfinished.
 *   - F7 ends one, which goes to onSysex.
 *   - Any other status byte ends a SysEx (it was cut short) and starts a short
 *     message, with running status: C_ and D_ take one data byte, the rest two.
 *     A finished one goes to onShort.
 *   - F1..F6 end a SysEx and running status, and are not passed on.
 *   - Data bytes with nothing to belong to are dropped.
 *   - A frame longer than `max` is dropped whole, not delivered cut short.
 */
export function createJoiner({ onSysex = () => {}, onShort = () => {}, max = 65536 } = {}) {
  let sysex = null
  let status = 0
  let need = 0
  let data = []
  const deliver = (fn, value) => {
    try {
      fn(value)
    } catch {
      // A listener that throws cannot stop the next frame being heard.
    }
  }
  return {
    push(chunk) {
      for (const raw of chunk || []) {
        const b = raw & 0xff
        if (b >= 0xf8) continue
        if (b === 0xf0) {
          sysex = [0xf0]
          status = 0
          continue
        }
        if (b === 0xf7) {
          if (sysex) {
            sysex.push(0xf7)
            const done = sysex
            sysex = null
            deliver(onSysex, done)
          }
          continue
        }
        if (b >= 0x80) {
          sysex = null
          if (b >= 0xf1) {
            status = 0
            continue
          }
          status = b
          need = (b & 0xf0) === 0xc0 || (b & 0xf0) === 0xd0 ? 1 : 2
          data = []
          continue
        }
        if (sysex) {
          sysex.push(b)
          if (sysex.length > max) sysex = null
          continue
        }
        if (!status) continue
        data.push(b)
        if (data.length === need) {
          const msg = [status, ...data]
          data = []
          deliver(onShort, msg)
        }
      }
    },
    reset() {
      sysex = null
      status = 0
      data = []
    }
  }
}

/* ------------------------------------------------------------------ */
/* Hz to a note                                                        */
/* ------------------------------------------------------------------ */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** A MIDI note number as a name and octave, 60 being C4. */
export function midiNote(n) {
  const m = Math.round(n)
  return { note: NOTE_NAMES[((m % 12) + 12) % 12], octave: Math.floor(m / 12) - 1 }
}

/**
 * A frequency as the nearest note and how far off it is, A4 = 440. null for
 * silence (0, or no reading at all), which the tuner shows as no note.
 */
export function hzToNote(hz) {
  if (!(hz > 0) || !Number.isFinite(hz)) return null
  const midi = 69 + 12 * Math.log2(hz / 440)
  const nearest = Math.round(midi)
  return { ...midiNote(nearest), cents: Math.round((midi - nearest) * 100) }
}

/** The AM4's note index as a note: MIDI = index + 9. */
export const am4Note = (index) => midiNote(Math.round(index) + 9)
