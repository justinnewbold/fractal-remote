/*
 * PUTTING A NAM CAPTURE ON AN AXE-FX III: the messages, byte for byte, as
 * Axe-Edit III sends them.
 *
 * Learned from Justin's recording (MIDI Monitor on his Mac, 13 November 2026,
 * his Axe-Fx III Mark II on firmware 33.01): Axe-Edit III loading one
 * TONE3000 capture into the first empty slot, reading the list of slots
 * back, pointing NAM 1 at it and saving the preset. 20,778 messages, every
 * checksum right. docs/nam-install.md has the whole of it; this file is the
 * part the app can build and read. The recording is not in the repository
 * (it holds a creator's capture and the names of Fractal's own).
 *
 * WHAT A CAPTURE IS ON THE UNIT: one record of 16,384 thirty-two-bit words
 * (65,536 bytes), whatever the capture.
 *
 *   bytes   0..223   seven text fields of 32 bytes, NUL-padded: the name,
 *                    who made it, the gear's make, its model, its kind
 *                    ("amp_cab"), the tone's kind ("crunch"), and a seventh
 *                    Axe-Edit sent as noughts (some captures on a unit hold
 *                    "TONE3000" there; the unit keeps both kinds).
 *                    The name is 31 characters and A CHECK BYTE: its
 *                    32nd byte is the other 31 XORed together, so the
 *                    field XORs to nought (`namCheck`). Axe-Edit sent
 *                    0x60 there, which is exactly that for the name it
 *                    sent; the unit's own list answers a NUL in its place.
 *   bytes 224..255   the file's own `weights_hash` ("nam-content-v1:" and
 *                    64 hex digits), as its 32 bytes. Fractal's own captures
 *                    have noughts there, so a file with none sends noughts.
 *   words  64..67    four numbers: loudness (dB), gain, the input level and
 *                    the output level (dBu), each "not a number" where the
 *                    file has none.
 *   words  68..14084 the capture's 14,017 numbers as single-precision
 *                    floats in the file's own order: the lite network's
 *                    1,871, then the full network's 12,146.
 *   words 14085..14094  ten "not a number"s, and noughts to the end.
 *
 * THE PACKING IS PROVEN (`NAM_PACKING_PROVEN`, 13 November 2026): the file
 * that was loaded ("Orange Amp: Flat EQ, Gain 6, AKG 414 + sm57") packed by
 * `namRecord` is the record Axe-Edit sent, word for word: all 14,017
 * numbers, the four before them, the thirty-two bytes and the name's check
 * byte.
 *
 * THAT CHECK BYTE WAS LEFT OUT AT FIRST, AND THE UNIT DID NOT KEEP THE
 * CAPTURE. The first build took Axe-Edit's 32nd byte for something the unit
 * had written over and sent a NUL. Justin's first send (14 November 2026,
 * over Bluetooth) was answered "taken" at every one of the 130 messages, and
 * the unit then named the slot "<EMPTY>". It is the one byte the app's
 * record differed by, so the record now carries it; a unit that still says
 * "<EMPTY>" after a send is said so plainly (the card), never "done".
 *
 * HOW IT GOES TO THE UNIT (all function bytes of the unit's own model):
 *
 *   0x54  slot, and how many words follow (16,384)       unit: 64 54 00
 *   0x55  ×128: "128 words", then 128 words, five bytes  unit: 64 55 00
 *         each, low seven bits first                      after every one
 *   0x56  every word XORed together                       unit: 64 56 00
 *
 * Axe-Edit waits for each answer before the next message. Round it, it
 * writes 1 and then 0 to setting 114 of block 1 (function 0x01, typed
 * write 09 00), which is taken here for "a transfer is under way" and sent
 * the same. The whole of it took 0.4 seconds on USB; it is about 83 KB, so
 * about 27 seconds through a Bluetooth adapter on the MIDI jacks.
 *
 * THE LIST OF SLOTS: 257 of them (0 to 256; Axe-Edit counts from 001).
 * Function 0x01, 08 01, with the slot as the value, answers that slot's
 * first 272 bytes (the text fields, the thirty-two bytes and the four
 * numbers), eight bits packed into seven, high bit first. An empty slot's
 * name is "<EMPTY>".
 *
 * POINTING A NAM BLOCK AT A SLOT is an ordinary typed write: setting 0 of
 * the block (206 or 207), the slot as a float. The unit answers with the
 * slot over 256 and the capture's name.
 *
 * ONE THING ONLY SEEN FOR SLOTS UNDER 128: the 0x54 message carried slot 29
 * as "00 1D 00". Which two of those three bytes hold a bigger number is a
 * guess, so `namUploadFrames` refuses a slot over `NAM_SLOT_PROVEN_MOST`.
 *
 * Pure: the phone's own byte helpers, the file reader, and nothing else.
 */
import { FN, bitsFloat, checksumOk, encode14, floatBits, floatSeptets, frame, fromSeptets32, isFractal, sameBytes, septets32, unpackMsb, buildEditFrame } from './fractal-sysex.mjs'
import { namNetworks } from './nam-file.js'

/** The .nam that was loaded has been set beside the recording, and the packing is right (13 November 2026). A sender may be built on it. */
export const NAM_PACKING_PROVEN = true

/** How many slots a unit has for captures: 0 to 256. */
export const NAM_SLOTS = 257
/** The biggest slot the upload has been seen to name (see the note above): 127. */
export const NAM_SLOT_PROVEN_MOST = 127
/** One capture's record: 16,384 words. */
export const NAM_RECORD_WORDS = 16384
/** The words before the numbers: seven text fields, thirty-two bytes, four numbers. */
export const NAM_HEAD_WORDS = 68
export const NAM_HEAD_BYTES = NAM_HEAD_WORDS * 4
/** An A2 capture's two networks, in the file's order: lite, then full. */
export const NAM_A2_NETWORKS = Object.freeze([1871, 12146])
export const NAM_WEIGHTS = NAM_A2_NETWORKS[0] + NAM_A2_NETWORKS[1]
/** The "not a number"s Axe-Edit writes after the last number. */
export const NAM_TAIL_NANS = 10
/** Words in one 0x55 message, and how many of those a record is. */
export const NAM_CHUNK_WORDS = 128
export const NAM_CHUNKS = NAM_RECORD_WORDS / NAM_CHUNK_WORDS

/** The three functions of an upload, and the unit's answer to each. */
export const NAM_FN = Object.freeze({ begin: 0x54, words: 0x55, end: 0x56, answer: 0x64 })
/** The sub-actions of function 0x01 this uses: a slot's first 272 bytes, and a typed write. */
export const NAM_SUB = Object.freeze({ slotHead: 0x88, typed: 0x09 })
/** "A transfer is under way": block 1, setting 114, 1 before and 0 after. */
export const NAM_BUSY = Object.freeze({ block: 1, setting: 114 })
/** The NAM block's setting that says which slot it plays. */
export const NAM_TYPE_SETTING = 0
/** An empty slot's name, as the unit says it. */
export const NAM_EMPTY = '<EMPTY>'

const FIELD = 32
const NAN_BITS = 0x7fc00000

/** The text fields of a record's head, in order, each 32 bytes. */
export const NAM_FIELDS = Object.freeze(['name', 'by', 'make', 'model', 'gearType', 'toneType'])

/* Plain printable ASCII, 31 characters at most: what the unit keeps of a field. */
const field = (text) => {
  const s = String(text ?? '')
    .normalize('NFKD')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/ +/g, ' ')
    .trim()
    .slice(0, FIELD - 1)
  const out = new Array(FIELD).fill(0)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? floatBits(x) : NAN_BITS)

/** The name's check byte: its first 31 bytes XORed together, which goes in the 32nd. */
export const namCheck = (bytes) => {
  let x = 0
  for (let i = 0; i < FIELD - 1; i++) x ^= bytes[i] & 0xff
  return x
}

/**
 * A .nam file's text as the record a unit keeps: `{ ok: true, words, name }`
 * (16,384 whole numbers, each 32 bits) or `{ ok: false, why }` in plain
 * words. The file's own notes name it, as they named the one Axe-Edit
 * loaded; `said` is what the app knows the capture by where the file does
 * not say: name, by, make, model, gearType, toneType. An A2 capture only, with its two networks the
 * sizes an A2's are: anything else is refused rather than guessed at.
 */
export function namRecord(text, said = {}) {
  const got = namNetworks(text)
  if (!got.ok) return got
  const sizes = got.networks.map((n) => n.weights.length)
  if (!got.a2 || sizes.length !== NAM_A2_NETWORKS.length || sizes.some((n, i) => n !== NAM_A2_NETWORKS[i])) {
    return { ok: false, why: 'This capture isn’t the A2 kind the Axe-Fx III’s NAM block plays.' }
  }
  const meta = got.metadata
  const own = (x, other) => (typeof x === 'string' && x.trim() ? x : other)
  const texts = {
    name: own(meta.name, said.name),
    by: own(meta.modeled_by, said.by),
    make: own(meta.gear_make, said.make),
    model: own(meta.gear_model, said.model),
    gearType: own(meta.gear_type, said.gearType),
    toneType: own(meta.tone_type, said.toneType)
  }
  const head = []
  for (const key of NAM_FIELDS) head.push(...field(texts[key]))
  if (!head[0]) return { ok: false, why: 'This capture has no name to file it under.' }
  /* The name's check byte, as Axe-Edit sends it: without it the unit took every message and filed the slot as empty. */
  head[FIELD - 1] = namCheck(head)
  /* The seventh line of text: noughts, as Axe-Edit sent it. Then the file's own hash of its numbers as 32 bytes, or noughts where it has none, as Fractal's own captures have. */
  while (head.length < 224) head.push(0)
  const hash = /^nam-content-v1:([0-9a-f]{64})$/i.exec(typeof meta.weights_hash === 'string' ? meta.weights_hash.trim() : '')
  for (let i = 0; i < 32; i++) head.push(hash ? parseInt(hash[1].slice(i * 2, i * 2 + 2), 16) : 0)

  const words = new Array(NAM_RECORD_WORDS).fill(0)
  for (let i = 0; i < 64; i++) words[i] = (head[i * 4] | (head[i * 4 + 1] << 8) | (head[i * 4 + 2] << 16) | (head[i * 4 + 3] << 24)) >>> 0
  words[64] = num(meta.loudness)
  words[65] = num(meta.gain)
  words[66] = num(meta.input_level_dbu)
  words[67] = num(meta.output_level_dbu)
  let at = NAM_HEAD_WORDS
  for (const net of got.networks) {
    for (const w of net.weights) {
      if (!Number.isFinite(w)) return { ok: false, why: 'This capture has a number in it that isn’t one.' }
      words[at++] = floatBits(w)
    }
  }
  for (let i = 0; i < NAM_TAIL_NANS; i++) words[at++] = NAN_BITS
  return { ok: true, words, name: String.fromCharCode(...head.slice(0, FIELD - 1).filter(Boolean)) }
}

/** Every word of a record XORed together: what the 0x56 message carries. */
export function namXor(words) {
  let x = 0
  for (const w of words) x ^= w
  return x >>> 0
}

/**
 * The 130 messages that put a record in a slot, in order: 0x54, 128 of 0x55,
 * 0x56. Each is sent only after the unit has answered the one before
 * (`namAnswer`). Throws on a record of the wrong size or a slot it cannot
 * name.
 */
export function namUploadFrames(model, slot, words) {
  if (!Array.isArray(words) || words.length !== NAM_RECORD_WORDS) throw new Error('a capture record is 16,384 words')
  if (!Number.isInteger(slot) || slot < 0 || slot > NAM_SLOT_PROVEN_MOST) throw new Error(`slot ${slot} is not one an upload has been seen to name (0 to ${NAM_SLOT_PROVEN_MOST})`)
  const out = [frame(model, NAM_FN.begin, [0x00, ...encode14(slot), 0x00, 0x00, 0x01])]
  for (let c = 0; c < NAM_CHUNKS; c++) {
    const body = [...encode14(NAM_CHUNK_WORDS)]
    for (let i = 0; i < NAM_CHUNK_WORDS; i++) body.push(...septets32(words[c * NAM_CHUNK_WORDS + i] >>> 0))
    out.push(frame(model, NAM_FN.words, body))
  }
  out.push(frame(model, NAM_FN.end, septets32(namXor(words))))
  return out
}

/** The unit's answer to one message of an upload: `{ fn, code }` (code 0 is "taken"), or null for anything else. */
export function namAnswer(f, model) {
  if (!isFractal(f) || !checksumOk(f) || f[4] !== model || f[5] !== NAM_FN.answer || f.length !== 10) return null
  return { fn: f[6], code: f[7], ok: f[7] === 0 }
}

/** "A transfer is under way" (true) and "it is over" (false), as Axe-Edit says each. */
export const namBusyFrame = (model, on) => buildEditFrame(model, NAM_SUB.typed, NAM_BUSY.block, NAM_BUSY.setting, floatSeptets(on ? 1 : 0))

/** Ask for one slot's first 272 bytes. */
export function namSlotQuery(model, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= NAM_SLOTS) throw new Error(`slot ${slot} is not 0 to ${NAM_SLOTS - 1}`)
  return buildEditFrame(model, NAM_SUB.slotHead, 0, 0, septets32(slot))
}

/* Where an answer to namSlotQuery keeps its length and its bytes. */
const HEAD_LEN_AT = 19
const HEAD_AT = 21

const textAt = (bytes, at) => {
  let s = ''
  for (let i = at; i < at + FIELD && bytes[i]; i++) s += String.fromCharCode(bytes[i])
  return s
}
const floatAt = (bytes, at) => bitsFloat((bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0)

/** A record's first 272 bytes as what they say. */
export function namHead(bytes) {
  const out = {}
  NAM_FIELDS.forEach((key, i) => {
    out[key] = textAt(bytes, i * FIELD)
  })
  out.empty = out.name === NAM_EMPTY
  out.loudness = floatAt(bytes, 256)
  out.gain = floatAt(bytes, 260)
  out.inputLevel = floatAt(bytes, 264)
  out.outputLevel = floatAt(bytes, 268)
  return out
}

/** The unit's answer to namSlotQuery: that slot's head (`namHead`), or null for anything else. The answer does not say which slot it is; the asker knows. */
export function readNamSlot(f, model) {
  if (!isFractal(f) || !checksumOk(f) || f[4] !== model || f[5] !== FN.PARAM) return null
  if (f[6] !== (NAM_SUB.slotHead & 0x7f) || f[7] !== NAM_SUB.slotHead >> 7) return null
  const len = (f[HEAD_LEN_AT] & 0x7f) | ((f[HEAD_LEN_AT + 1] & 0x7f) << 7)
  if (len !== NAM_HEAD_BYTES) return null
  const septets = f.slice(HEAD_AT, f.length - 2)
  if (septets.length < Math.ceil((len * 8) / 7)) return null
  return namHead(unpackMsb(septets, len))
}

/** Point a NAM block (206 or 207) at a slot: the typed write of its setting 0. */
export function namPickFrame(model, block, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= NAM_SLOTS) throw new Error(`slot ${slot} is not 0 to ${NAM_SLOTS - 1}`)
  return buildEditFrame(model, NAM_SUB.typed, block, NAM_TYPE_SETTING, floatSeptets(slot))
}

/** The unit's answer to namPickFrame: `{ slot, name }`, or null for anything else. It says the slot as a share of 256. */
export function readNamPick(f, model, block) {
  if (!isFractal(f) || !checksumOk(f) || f[4] !== model || f[5] !== FN.PARAM) return null
  if (f[6] !== NAM_SUB.typed || f[7] !== 0) return null
  const [lo, hi] = encode14(block)
  if (f[8] !== lo || f[9] !== hi || f[10] !== NAM_TYPE_SETTING || f[11] !== 0) return null
  const share = bitsFloat(fromSeptets32(f, 12))
  const len = (f[HEAD_LEN_AT] & 0x7f) | ((f[HEAD_LEN_AT + 1] & 0x7f) << 7)
  /* The write's own bytes coming back (MIDI Thru) carry no name: not the unit's answer. */
  if (len !== FIELD || f.length < HEAD_AT + Math.ceil((FIELD * 8) / 7) + 2) return null
  const text = unpackMsb(f.slice(HEAD_AT, f.length - 2), len)
  return { slot: Math.round(share * 256), name: textAt(text, 0) }
}

/** The first empty slot an upload can name, from a list of heads in slot order, or null where there is none. */
export function firstEmptySlot(heads) {
  for (let i = 0; i < heads.length && i <= NAM_SLOT_PROVEN_MOST; i++) if (heads[i]?.empty) return i
  return null
}

/** The NAM blocks of an Axe-Fx III: NAM 1 and NAM 2. */
export const NAM_BLOCKS = Object.freeze([206, 207])

/** The unit's answer to namBusyFrame: its own write said back, longer than the write. */
export const namBusyAnswer = (f, model) =>
  isFractal(f) && checksumOk(f) && f[4] === model && f[5] === FN.PARAM && f[6] === NAM_SUB.typed && f[7] === 0 && f[8] === NAM_BUSY.block && f[9] === 0 && f[10] === NAM_BUSY.setting && f[11] === 0 && f.length > 23

/**
 * THE ONE WAY OUT. Whether these bytes have the shape of anything this file
 * builds: a message of an upload, the list's question, "a transfer is under
 * way", or a NAM block pointed at a slot. Nothing else the app sends has any
 * of these shapes, so the wire holds every such frame to `namAllowed`.
 */
export function namShaped(bytes, model) {
  if (!Array.isArray(bytes) || bytes[0] !== 0xf0 || bytes[4] !== model) return false
  if (bytes[5] === NAM_FN.begin || bytes[5] === NAM_FN.words || bytes[5] === NAM_FN.end) return true
  if (bytes[5] !== FN.PARAM) return false
  if (bytes[6] === (NAM_SUB.slotHead & 0x7f) && bytes[7] === NAM_SUB.slotHead >> 7) return true
  if (bytes[6] !== NAM_SUB.typed || bytes[7] !== 0) return false
  const block = (bytes[8] & 0x7f) | ((bytes[9] & 0x7f) << 7)
  const setting = (bytes[10] & 0x7f) | ((bytes[11] & 0x7f) << 7)
  return (block === NAM_BUSY.block && setting === NAM_BUSY.setting) || (NAM_BLOCKS.includes(block) && setting === NAM_TYPE_SETTING)
}

/**
 * Whether a frame of those shapes may go, given what the wire is doing with
 * captures at this moment (`going`, null when nothing):
 *   going.list    the list is being read: any slot's question, 0 to 256;
 *   going.frames  an upload is being sent: only those very frames, byte for
 *                 byte (its 130 messages and the two "under way" writes);
 *   going.pick    { block, slot }: only that one write, to a NAM block.
 * Anything else of the shape is refused, with nothing sent.
 */
export function namAllowed(bytes, model, going) {
  if (!going || !namShaped(bytes, model)) return false
  if (going.list === true && bytes[5] === FN.PARAM && bytes[6] === (NAM_SUB.slotHead & 0x7f)) {
    const slot = fromSeptets32(bytes, 12)
    return slot < NAM_SLOTS && sameBytes(bytes, namSlotQuery(model, slot))
  }
  if (Array.isArray(going.frames) && going.frames.some((f) => sameBytes(f, bytes))) return true
  if (going.pick && NAM_BLOCKS.includes(going.pick.block) && Number.isInteger(going.pick.slot) && going.pick.slot >= 0 && going.pick.slot < NAM_SLOTS) {
    return sameBytes(bytes, namPickFrame(model, going.pick.block, going.pick.slot))
  }
  return false
}

/** A slot as a player reads it: Axe-Edit counts from 001. */
export const namSlotSaid = (slot) => String(slot + 1).padStart(3, '0')
