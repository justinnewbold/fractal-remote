/**
 * A GEN-3 UNIT ASKED TO DESCRIBE ONE BLOCK'S SETTINGS: THE DEVELOPER'S
 * READER FOR A BLOCK THE APP HAS NO KNOBS FOR.
 *
 * "Yes build the NAM reader now." (Justin, 12 November 2026, the day his
 * Axe-Fx III came: "AX3" in his words from then on.) Firmware 33 brought the
 * NAM block, and no catalog the app carries names its settings: over
 * Bluetooth Play draws NAM 1 and NAM 2 and switches them (lib/gen3Catalog
 * OWN), and Edit has nothing to turn. A customer's log gave the block's
 * numbers (206 and 207) and nothing of what is inside it.
 *
 * A gen-3 unit will say what is inside a block if it is asked: function
 * 0x01 with a "view" in place of a write's action. This is the unit's own
 * editor's question, and the computer's codec walks a whole unit with it
 * (forgefx-midi src/cache/liveWalk.ts, at the commit desktop/
 * forgefx.lock.json pins), which this file is a port of, for ONE block:
 *
 *   view 0x1C  a setting's definition: its type code, lowest, highest,
 *              default and step, as five floats;
 *   view 0x00  its value now, as the unit writes it ("6.20", "-3.0 dB");
 *   view 0x1F  one label of a list setting (the names in a model list).
 *
 * WHAT IT DOES NOT SAY IS THE SETTING'S NAME. Those come from Fractal's own
 * editor and nowhere on the wire, so what this reads is matched to names by
 * hand afterwards (the values and their units are how).
 *
 * EVERY ONE OF THESE ONLY ASKS. Nothing here builds a write, and
 * `describeAllowed` is the one way out for what it builds: a frame is one of
 * the three questions above, at a block and a setting, with nothing else in
 * it, or it does not go.
 *
 * AND IT ASKS LESS THAN THE COMPUTER'S WALK DOES, because a wrong question
 * has frozen a unit before (the codec's own notes, FORGEFX-32: an FM3 that
 * had to be switched off and on):
 *
 *   - settings 0 to 127 only, the range the read-only walk is proven on;
 *   - a label is asked for only of a setting that is plainly a list (step
 *     0, scale 0, whole-number ends: `plainList`), never on a guess, and
 *     never past LABELS_MOST of them. A label question at a setting with no
 *     list is the one that froze the FM3;
 *   - a block whose first four settings are not there is left;
 *   - one question at a time, a pause between them, and it stops at the
 *     second one in a row the unit does not answer.
 *
 * Pure: bytes in, bytes out, and a walk over a function it is handed.
 * test/gen3-describe.mjs runs it as it is, against the codec's own frames.
 */
import { FN, checksumOk, frame, isFractal } from './fractal-sysex.mjs'

/** The three questions. */
export const VIEW = Object.freeze({ definition: 0x1c, label: 0x1f, value: 0x00 })
const VIEWS = Object.freeze([VIEW.definition, VIEW.label, VIEW.value])

/** Every question is this long: the header, fifteen bytes, a checksum, the end. */
export const DESCRIBE_LEN = 23
/** The highest setting asked about: the read-only walk's own proven ceiling. */
export const PARAM_MOST = 127
/** A block with none of its first settings there is not one to walk (the walk's blockProbeDepth). */
export const PROBE_DEPTH = 4
/** The most labels read of one list. A model list can run to a thousand; the first of them say what it is. */
export const LABELS_MOST = 48
/** Between two questions, in milliseconds: never none (flooding is what froze the FM3; the codec's own floor is 3). */
export const PACE_MS = 25
/** How long one question waits for its answer. */
export const ANSWER_MS = 1500
/** This many unanswered in a row and the walk stops: something is wrong, and asking on is how a slow unit becomes a stuck one. */
export const SILENT_MOST = 2

const int14 = (n) => Number.isInteger(n) && n >= 0 && n <= 0x3fff

/**
 * One question: F0 00 01 74 <model> 01 <view> 00 <block lo> <block hi>
 * <setting lo> <setting hi> <which lo> <which hi> 00 x7 <checksum> F7.
 * `which` is a label's number and is nothing for the other two.
 */
export function describeQuery(model, view, block, param, which = 0) {
  if (!VIEWS.includes(view)) throw new Error(`view ${view} is not one of the reader’s questions`)
  if (!int14(block) || block < 1) throw new Error(`block ${block} is not one a unit is asked about`)
  if (!int14(param) || param > PARAM_MOST) throw new Error(`setting ${param} is past what the reader asks about`)
  if (!int14(which) || (which !== 0 && view !== VIEW.label)) throw new Error(`label ${which} is not one the reader asks for`)
  const body = new Array(15).fill(0)
  body[0] = view
  body[2] = block & 0x7f
  body[3] = (block >> 7) & 0x7f
  body[4] = param & 0x7f
  body[5] = (param >> 7) & 0x7f
  body[6] = which & 0x7f
  body[7] = (which >> 7) & 0x7f
  return frame(model, FN.PARAM, body)
}

/**
 * Whether a frame is one of the reader's questions to a unit of this model,
 * and nothing else: what it is, or null. The one way out for what this file
 * builds (bleWire's reader sends nothing this refuses).
 */
export function describeAllowed(f, model) {
  if (!Array.isArray(f) || f.length !== DESCRIBE_LEN) return null
  for (let i = 0; i < f.length; i++) {
    const v = f[i]
    if (!Number.isInteger(v) || v < 0 || v > 0xff) return null
    if (i > 0 && i < f.length - 1 && v > 0x7f) return null
  }
  if (!isFractal(f) || f[4] !== model || f[5] !== FN.PARAM || !checksumOk(f)) return null
  const view = f[6]
  if (!VIEWS.includes(view) || f[7] !== 0) return null
  const block = (f[8] & 0x7f) | ((f[9] & 0x7f) << 7)
  const param = (f[10] & 0x7f) | ((f[11] & 0x7f) << 7)
  const which = (f[12] & 0x7f) | ((f[13] & 0x7f) << 7)
  if (block < 1 || param > PARAM_MOST) return null
  if (which !== 0 && view !== VIEW.label) return null
  for (let i = 14; i <= 20; i++) if (f[i] !== 0) return null
  return view === VIEW.definition ? 'a setting’s definition' : view === VIEW.label ? 'a list’s label' : 'a setting’s value'
}

/**
 * Whether a frame answers this question: the same view, the same high half
 * of the block, and both halves of the setting (the codec's host matches on
 * exactly these, ForgeFX services/deviceCache adaptRequest: the unit does
 * not echo the block's low half, so matching on it lets an old answer pass
 * for a new one).
 */
export const describeEcho = (query) => (f) =>
  isFractal(f) && f[4] === query[4] && f[5] === FN.PARAM && f.length >= 14 && f[6] === query[6] && f[9] === query[9] && f[10] === query[10] && f[11] === query[11]

/* A run of seven-bit bytes as eight-bit ones, the top bit first: the codec's decodeSeptetStream. */
function fromSeptets(wire, count, start) {
  const out = []
  let acc = 0
  let bits = 0
  for (let i = start; i < wire.length && out.length < count; i++) {
    acc = (acc << 7) | (wire[i] & 0x7f)
    bits += 7
    while (bits >= 8 && out.length < count) {
      bits -= 8
      out.push((acc >>> bits) & 0xff)
      acc &= (1 << bits) - 1
    }
  }
  return out
}

const f32 = (b, at) => new DataView(Uint8Array.from(b.slice(at, at + 4)).buffer).getFloat32(0, true)
const u32 = (b, at) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0
const whole = (x) => Number.isFinite(x) && x === Math.round(x)

/**
 * What an answer says: {view: 'definition', wireId, tc, min, max, scale,
 * def, step}, {view: 'label', text}, {view: 'value', text}, or null for an
 * answer with nothing in it (the unit's "not there") or one that is neither.
 * The codec's decodeReply, which reads the same whichever tag the unit
 * marked the answer with.
 */
export function decodeDescribe(f) {
  if (!isFractal(f) || f[5] !== FN.PARAM || f.length < 10) return null
  const inner = f.slice(6, f.length - 2)
  if (inner.length < 7) return null
  const view = inner[0]
  const tag = inner[6]
  if (tag === 0x01 || tag === 0x03) return null
  if (inner.length < 15) return null
  const count = inner[13] | (inner[14] << 8)
  if (count < 1) return null
  if (inner.length < 15 + Math.ceil((count * 8) / 7)) return null
  const raw = fromSeptets(inner, count, 15)
  if (raw.length < count) return null
  if (count === 36) {
    const d = { view: 'definition', wireId: u32(raw, 0), tc: u32(raw, 4), min: f32(raw, 8), max: f32(raw, 12), scale: f32(raw, 16), def: f32(raw, 20), step: f32(raw, 24) }
    if ([d.min, d.max, d.scale, d.def, d.step].every((x) => Number.isFinite(x))) return d
  }
  let end = raw.length
  while (end > 0 && raw[end - 1] === 0) end -= 1
  if (!end) return null
  for (let i = 0; i < end; i++) if (raw[i] < 0x20 || raw[i] >= 0x7f) return null
  const text = String.fromCharCode(...raw.slice(0, end))
  if (view === VIEW.label) return { view: 'label', text }
  if (view === VIEW.value) return { view: 'value', text }
  return null
}

/**
 * What an answer carried, as it came, for one this file could not read as
 * a definition or as text: the unit's mark on it and its bytes in hex (the
 * first 48). His Axe-Fx III answered every value that has a unit (dB, Hz,
 * ms) with something that is not plain text (13 November 2026), and a "?"
 * says nothing about what it was. This does.
 */
export function answerBytes(f) {
  if (!isFractal(f) || f[5] !== FN.PARAM || f.length < 23) return null
  const inner = f.slice(6, f.length - 2)
  const count = inner[13] | (inner[14] << 8)
  const raw = fromSeptets(inner, Math.min(count, 48), 15)
  const hex = raw.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
  return `tag ${inner[6].toString(16).padStart(2, '0').toUpperCase()}, ${count} bytes${hex ? `: ${hex}` : ''}${count > 48 ? ' …' : ''}`
}

/** An empty place: every field nothing (the codec's isFillerDefinition). */
export const emptyDef = (d) => d.wireId === 0 && d.tc === 0 && d.min === 0 && d.max === 0 && d.def === 0 && d.step === 0

/**
 * Not a setting at all: what a block that is not a block answers with (the
 * codec's isGarbageDefinition: a type code past any real one, or a number
 * too small to be one).
 */
export function junkDef(d) {
  if (d.tc > 0x3fff) return true
  const junk = (x) => !Number.isFinite(x) || (x !== 0 && Math.abs(x) < 1e-37)
  return junk(d.min) || junk(d.max) || junk(d.def) || junk(d.step) || junk(d.scale)
}

/**
 * A setting that is plainly a list, and so may be asked for its labels:
 * the codec's own first test and nothing looser (step 0, scale 0,
 * whole-number ends, not below nought). The walk also tries a label on
 * settings that only might be lists; the reader never does.
 */
export const plainList = (d) => d.step === 0 && d.scale === 0 && whole(d.min) && whole(d.max) && d.min >= 0 && d.max >= d.min

/**
 * ONE BLOCK, ASKED ABOUT. `ask(frame)` sends one question and answers with
 * the frame that came back, null when none did, or {refused: code} when the
 * unit said no; `pause(ms)` waits. It answers {block, settings, asked,
 * stopped}: each setting {id, wireId, tc, min, max, def, step, scale, list,
 * value, labels, more}, and `stopped` a few words when the walk ended
 * early, null when it ran to its end. What was read before it stopped is
 * kept. A value the unit answered with something that is not text has
 * `raw`, what it sent (answerBytes); one it did not answer has `silent`.
 */
export async function describeBlock({ ask, pause, model, block, onStep = () => {} }) {
  const settings = []
  let asked = 0
  let silent = 0
  let stopped = null
  /* The last answer as it came, or null: for a value that could not be read as text. */
  let came = null
  const put = async (view, param, which = 0) => {
    const q = describeQuery(model, view, block, param, which)
    /* Checked again where it leaves: nothing that is not one of the three questions goes. */
    if (!describeAllowed(q, model)) throw new Error('the reader built something that is not one of its questions')
    await pause(PACE_MS)
    asked += 1
    came = null
    const back = await ask(q)
    if (back && !Array.isArray(back)) {
      stopped = `the unit refused a question${back.refused === undefined ? '' : ` (${back.refused})`}`
      return undefined
    }
    if (!back) {
      silent += 1
      if (silent >= SILENT_MOST) stopped = 'the unit stopped answering'
      return undefined
    }
    silent = 0
    came = back
    return decodeDescribe(back)
  }
  for (let param = 0; param <= PARAM_MOST && !stopped; param++) {
    const got = await put(VIEW.definition, param)
    if (stopped) break
    const def = got && got.view === 'definition' && !emptyDef(got) && !junkDef(got) ? got : null
    if (!def) {
      if (!settings.length && param + 1 >= PROBE_DEPTH) stopped = 'nothing at its first settings'
      continue
    }
    const s = { id: param, wireId: def.wireId, tc: def.tc, min: def.min, max: def.max, def: def.def, step: def.step, scale: def.scale, list: plainList(def), value: null, labels: [], more: false }
    settings.push(s)
    const value = await put(VIEW.value, param)
    if (stopped) break
    if (value && value.view === 'value') s.value = value.text
    else if (came) s.raw = answerBytes(came)
    else s.silent = true
    if (s.list) {
      const lo = Math.round(def.min)
      const span = Math.round(def.max - def.min + 1)
      for (let i = 0; i < span && !stopped; i++) {
        if (i >= LABELS_MOST) {
          s.more = true
          break
        }
        const label = await put(VIEW.label, param, lo + i)
        if (!label || label.view !== 'label') break
        s.labels.push(label.text)
      }
    }
    onStep({ block, settings: settings.length, asked })
  }
  return { block, settings, asked, stopped }
}

const num = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 1e6) / 1e6))

/**
 * What was read, as text to copy: a line a setting. `bulk` is the block's
 * whole read ({count, values}, lib/gen3-edit readAllCollector), whose
 * numbers are the same settings as the unit keeps them, every channel one
 * after another.
 */
export function describeText({ name, block, settings, asked, stopped, bulk = null }) {
  const lines = [`${name || 'Block'} (effect ${block}): ${settings.length} settings, ${asked} questions${stopped ? `, stopped: ${stopped}` : ''}`]
  for (const s of settings) {
    const range = `${num(s.min)}..${num(s.max)} def ${num(s.def)} step ${num(s.step)} scale ${num(s.scale)}`
    const list = s.labels.length ? ` [${s.labels.join(' | ')}${s.more ? ' | …' : ''}]` : s.list ? ' [list, no labels]' : ''
    lines.push(`  ${String(s.id).padStart(3)}  tc ${s.tc}  ${range}  now ${s.value !== null ? JSON.stringify(s.value) : s.raw ? `? (${s.raw})` : '? (no answer)'}${list}`)
  }
  if (bulk && Array.isArray(bulk.values)) {
    lines.push(`  whole read: count ${bulk.count}, ${bulk.values.length} values`, `  ${bulk.values.join(' ')}`)
  } else if (bulk && bulk.note) {
    lines.push(`  whole read: ${bulk.note}`)
  }
  return lines.join('\n')
}
