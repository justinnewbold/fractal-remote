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
 *                    ("amp_cab"), the tone's kind ("crunch"), one spare.
 *                    The unit keeps 31 characters of the name and ends it
 *                    itself (it wrote a NUL over the 32nd byte it was sent).
 *   bytes 224..255   thirty-two bytes Axe-Edit fills for a TONE3000 capture
 *                    and Fractal's own captures leave at nought, so the unit
 *                    plays one without them. What they are is not known;
 *                    this file sends noughts.
 *   words  64..67    four numbers: loudness (dB), gain, the input level and
 *                    the output level (dBu), each "not a number" where the
 *                    file has none.
 *   words  68..14084 the capture's 14,017 numbers as single-precision
 *                    floats in the file's own order: the lite network's
 *                    1,871, then the full network's 12,146.
 *   words 14085..14094  ten "not a number"s, and noughts to the end.
 *
 * WHAT IS NOT PROVEN YET (`NAM_PACKING_PROVEN`): that the 14,017 are the
 * file's own numbers untouched. Everything says so (the count is exact, the
 * lite network ends at word 1938 on the same closing number the full one
 * ends on, as an A2 file's two networks do, and the four numbers before
 * them are the file's own notes), but the .nam that was loaded has not been
 * set beside the recording. Until it has, NOTHING IN THE APP SENDS A
 * RECORD: this file only builds and reads. A capture packed wrong would
 * play as noise.
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
import { FN, bitsFloat, checksumOk, encode14, floatBits, floatSeptets, frame, fromSeptets32, isFractal, septets32, unpackMsb, buildEditFrame } from './fractal-sysex.mjs'
import { namNetworks } from './nam-file.js'

/** Whether the .nam that was loaded has been set beside the recording and the packing found right. Until it has, nothing sends a record. */
export const NAM_PACKING_PROVEN = false

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

/**
 * A .nam file's text as the record a unit keeps: `{ ok: true, words, name }`
 * (16,384 whole numbers, each 32 bits) or `{ ok: false, why }` in plain
 * words. `said` is what the app knows the capture by where the file itself
 * does not say (a TONE3000 file often has no name in it): name, by, make,
 * model, gearType, toneType. An A2 capture only, with its two networks the
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
  const texts = {
    name: said.name ?? meta.name,
    by: said.by ?? meta.modeled_by,
    make: said.make ?? meta.gear_make,
    model: said.model ?? meta.gear_model,
    gearType: said.gearType ?? meta.gear_type,
    toneType: said.toneType ?? meta.tone_type
  }
  const head = []
  for (const key of NAM_FIELDS) head.push(...field(texts[key]))
  if (!head[0]) return { ok: false, why: 'This capture has no name to file it under.' }
  /* The spare field and the thirty-two bytes: noughts, as Fractal's own captures have them. */
  while (head.length < 256) head.push(0)

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
  return { ok: true, words, name: String.fromCharCode(...head.slice(0, FIELD).filter(Boolean)) }
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
  const text = unpackMsb(f.slice(HEAD_AT, f.length - 2), len)
  return { slot: Math.round(share * 256), name: textAt(text, 0) }
}

/** The first empty slot an upload can name, from a list of heads in slot order, or null where there is none. */
export function firstEmptySlot(heads) {
  for (let i = 0; i < heads.length && i <= NAM_SLOT_PROVEN_MOST; i++) if (heads[i]?.empty) return i
  return null
}
