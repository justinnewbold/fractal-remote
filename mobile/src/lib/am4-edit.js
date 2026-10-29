/**
 * AN AM4 BLOCK'S KNOBS, READ AND TURNED BY THE PHONE ITSELF.
 *
 * Over the computer, opening a block in Edit asks ForgeFX for its settings,
 * and ForgeFX reads them off the AM4 with one request per register (fn 0x1F,
 * "get all params") and names each one from the codec's catalog. Turning a
 * knob is one small write (fn 0x01, "set normalised"). Over Bluetooth there
 * is no computer, so this file is that part of ForgeFX: the same request,
 * the same reading of the answer, the same names and the same write, so
 * that Edit cannot tell which of the two it is talking to.
 *
 * Ported line for line, each from where it lives (ForgeFX's pinned commits,
 * desktop/forgefx.lock.json):
 *
 *   - the read and its answer: forgefx-midi devices/am4/shared/readOps.ts
 *     readAllParams (a header 0x74 naming the register and how many values,
 *     the values in 0x75, a footer 0x76), and am4/setParam.ts
 *     buildGetAllParams;
 *   - the values: devices/am4/descriptor/reader.ts decodeChannelParams and
 *     decodeChunkValue, with am4/params.ts decode and roundDisplayValue. The
 *     answer holds all four channels, A to D, one after another;
 *   - what Edit is handed: ForgeFX server/src/drivers/am4.ts blockParams
 *     (the knobs in `named`, the switches in `enums`, the model in `type`,
 *     a second register's settings under a composite id), and its
 *     am4LayoutFor (server/src/devices.ts) for the pages;
 *   - the writes: am4/setParam.ts buildSetParamNorm for a knob, and
 *     buildSetFloatParam for a switch or a model, at the block's own code.
 *
 * And one thing the computer does not do, because over Bluetooth there is
 * nothing between the phone and the AM4 to do it: every frame these build is
 * held to am4EditAllowed before it goes (bleWire's am4Sender), which lets a
 * read go only to a block the AM4 has just said is in the preset, and a
 * write only to a setting the catalog names on such a block, within its
 * range. Everything else the AM4 is ever sent is still AM4_ALLOWED's.
 *
 * Nothing here touches a phone: it imports the codec and the catalog, so
 * Node runs it against a pretend AM4 byte for byte.
 */
import { AM4_FAMILY_BY_BLOCK, AM4_KNOBS, AM4_PAGES, AM4_UNIT_LABEL } from './am4-knobs.js'
import { AM4, FN, MODELS, am4Block, am4Float, am4Frame, am4ReadFloat, checksumOk, decode14, encode14, frame, isFractal } from './fractal-sysex.mjs'

/* The read and the three parts of its answer. */
export const READ_ALL = 0x1f
const HEAD = 0x74
const CHUNK = 0x75
const FOOT = 0x76

/* What a value read off the AM4 is out of: forgefx-midi READ_VALUE_DENOMINATOR. */
const WIRE_FULL = 65534

/*
 * How many places each kind of knob shows: forgefx-midi am4/params.ts
 * DISPLAY_PRECISION, which matches AM4-Edit's own display. Every unit the
 * catalog uses is here (a test holds the two together).
 */
export const PRECISION = {
  knob_0_10: 2,
  knob_0_20: 2,
  db: 1,
  hz: 0,
  seconds: 2,
  percent: 0,
  bipolar_percent: 0,
  count: 0,
  semitones: 0,
  ratio: 1,
  ms: 0,
  degrees: 0,
  pf: 0,
  rotary_mic_spacing: 1,
  amp_geq_band: 1
}

/*
 * Settings that are never written through a block's knobs: its channel,
 * which has its own route and goes to the block's base code only
 * (buildAm4Channel); and its model, which goes through the model route
 * (am4TypeFrame) and is checked there.
 */
const NOT_A_KNOB = new Set(['channel', 'type'])

/* ------------------------------------------------------------------ */
/* The catalog, as the phone carries it                                */
/* ------------------------------------------------------------------ */

const rowsBySlug = new Map()

/** A block's settings in the catalog's order, as objects. */
export function settingsOf(slug) {
  if (rowsBySlug.has(slug)) return rowsBySlug.get(slug)
  const spec = AM4_KNOBS[slug]
  const rows = (spec?.params || []).map(([key, label, pidLow, pidHigh, unit, min, max, log, enumValues]) => ({
    key,
    label,
    pidLow,
    pidHigh,
    unit,
    min,
    max,
    log: log === 1,
    enumValues: enumValues || null
  }))
  rowsBySlug.set(slug, rows)
  return rows
}

/**
 * The block at this code, as Edit can open it: its slug, base and which copy
 * it is (fractal-sysex am4Block), or null for a code the catalog has no
 * settings for.
 */
export function editBlock(code) {
  const b = am4Block(code)
  if (!b || !AM4_KNOBS[b.slug]) return null
  return { ...b, code }
}

/**
 * The registers read for the block at this code, each as {wire, key}: `wire`
 * the address the request goes to, `key` the register the catalog files its
 * settings under. Its own register is its code (a second drive's own is
 * 0x77, as the AM4 reports it). The amp's cab section is filed under a
 * register of its own, 0x3E: read for the first amp only, the one whose
 * address is known. ForgeFX reads it at 0x3E plus the copy for a second
 * amp, which nobody has seen answer; the phone leaves it out there.
 */
export function readsOf(code) {
  const b = editBlock(code)
  if (!b) return []
  const out = []
  for (const key of AM4_KNOBS[b.slug].reads) {
    if (key === b.base) out.push({ wire: code, key })
    else if (b.copy === 0) out.push({ wire: key, key })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* The read                                                            */
/* ------------------------------------------------------------------ */

/** fn 0x1F for one register: F0 00 01 74 15 1F <register> <checksum> F7. */
export function buildAm4ReadAll(wire) {
  if (!Number.isInteger(wire) || wire < 1 || wire > 0x3fff) throw new Error(`register ${wire} is not one the AM4 is read at`)
  return frame(MODELS.am4, READ_ALL, encode14(wire))
}

/* Three septets to one sixteen-bit value: forgefx-midi decode16Packed. */
const packed16 = (b0, b1, b2) => (b0 & 0x7f) | ((b1 & 0x7f) << 7) | ((b2 & 0x03) << 14)

/**
 * What a frame is, as part of the answer to a read of `wire`: the header
 * ({part: 'head', count}), some values ({part: 'chunk', values}), the
 * footer ({part: 'foot'}), {part: 'damaged'} for one of these whose
 * checksum does not hold, or null for anything else (an answer to another
 * register's read included).
 */
export function readAllPart(f, wire) {
  if (!isFractal(f) || f[4] !== MODELS.am4) return null
  const fn = f[5]
  if (fn !== HEAD && fn !== CHUNK && fn !== FOOT) return null
  if (fn === HEAD) {
    if (f.length < 12) return null
    if (decode14(f[6], f[7]) !== wire) return null
    if (!checksumOk(f)) return { part: 'damaged' }
    return { part: 'head', count: decode14(f[8], f[9]) }
  }
  if (!checksumOk(f)) return { part: 'damaged' }
  if (fn === FOOT) return { part: 'foot' }
  if (f.length < 10) return { part: 'damaged' }
  const n = decode14(f[6], f[7])
  const values = []
  const end = f.length - 2
  for (let i = 0; i < n; i++) {
    const at = 8 + i * 3
    if (at + 2 >= end) break
    values.push(packed16(f[at], f[at + 1], f[at + 2]))
  }
  return { part: 'chunk', values }
}

/**
 * A collector for bleWire's `collect`: fed every frame while the read is
 * the one on the line, it answers undefined for a frame that is not part of
 * it, null while more is to come, and once the footer is in, {count, values}
 * (or {damaged: true} when any part came back damaged). A chunk or footer
 * before the header is not part of it, as ForgeFX drops them.
 */
export function readAllCollector(wire) {
  let head = null
  let damaged = false
  const values = []
  return (f) => {
    const got = readAllPart(f, wire)
    if (!got) return undefined
    if (got.part === 'damaged') {
      if (!head) return undefined
      damaged = true
      return null
    }
    if (got.part === 'head') {
      if (head) return undefined
      head = { count: got.count }
      return null
    }
    if (!head) return undefined
    if (got.part === 'chunk') {
      for (const v of got.values) values.push(v)
      return null
    }
    return damaged ? { damaged: true } : { count: head.count, values }
  }
}

/* ------------------------------------------------------------------ */
/* The values                                                          */
/* ------------------------------------------------------------------ */

/* forgefx-midi am4/params.ts decode: the AM4's 0..1 to what its display shows. */
function fromInternal(p, internal) {
  if (p.unit === 'enum') return Math.round(internal)
  const { min, max } = p
  if (p.log) {
    if (min <= 0 || max <= 0 || max === min) return min + internal * (max - min)
    return min * Math.pow(max / min, internal)
  }
  return min + internal * (max - min)
}

/* forgefx-midi roundDisplayValue: to the places the AM4 shows, and never -0. */
function rounded(p, v) {
  if (typeof v !== 'number' || p.unit === 'enum') return v
  const factor = 10 ** PRECISION[p.unit]
  const r = Math.round(v * factor) / factor
  return Object.is(r, -0) ? 0 : r
}

/** A value off the wire, as the display shows it: the switch's name for a switch (or its number, when it has none). */
export function shown(p, wire) {
  if (p.unit === 'enum') return p.enumValues?.[wire] ?? wire
  return rounded(p, fromInternal(p, wire / WIRE_FULL))
}

/*
 * One setting's value for one channel, out of the registers read: ForgeFX's
 * decodeChannelParams. A register whose count divides by four holds the four
 * channels one after another; one that does not holds one copy, which is
 * channel A's. Undefined when the answer does not reach it.
 */
function valueIn(p, chunks, channel) {
  const chunk = chunks.get(p.pidLow)
  if (!chunk) return undefined
  const { count, values } = chunk
  let at
  if (count > 0 && count % 4 === 0) at = channel * (count / 4) + p.pidHigh
  else if (channel === 0) at = p.pidHigh
  else return undefined
  if (at >= values.length) return undefined
  return shown(p, values[at])
}

/* A switch's shown value back to its number: ForgeFX's #enumOrdinal. */
function ordinalOf(p, v) {
  if (typeof v === 'number') return v
  for (const [n, label] of Object.entries(p.enumValues || {})) if (label === v) return Number(n)
  return Number(v) || 0
}

/* Where a value sits along its knob's travel, 0 to 1: ForgeFX's #normOf. */
export function normOf(p, value) {
  const { min: lo, max: hi } = p
  let n
  if (p.log && lo > 0 && hi > 0 && hi !== lo) n = Math.log(value / lo) / Math.log(hi / lo)
  else if (hi !== lo) n = (value - lo) / (hi - lo)
  else n = 0
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

/*
 * A setting's id as Edit knows it: its own number on the block's own
 * register, and the register and number together, (register << 16) |
 * number, for one filed under another (the amp's cab). ForgeFX's encId.
 */
const idOf = (p, base) => (p.pidLow === base ? p.pidHigh : (p.pidLow << 16) | p.pidHigh)

/**
 * What GET /preset/blocks/<code>/params answers over the computer, made from
 * the registers read (`chunks`, by the register the catalog files them
 * under: {count, values}), for the channel the block is on (0 to 3), with
 * its on/off when it was read. ForgeFX's blockParams, field for field:
 * knobs in `named`, switches in `enums` (with a made-up Bypass first when
 * the on/off is known), the model in `type`, and the pages.
 */
export function blockParamsOf(code, chunks, { channel = 0, bypassed } = {}) {
  const b = editBlock(code)
  if (!b) return null
  const settings = settingsOf(b.slug)
  const ch = Number.isInteger(channel) && channel >= 0 && channel <= 3 ? channel : 0
  /* The channel asked for, or channel A when the answer holds nothing for it (ForgeFX's #slotParamValues). */
  let values = settings.map((p) => valueIn(p, chunks, ch))
  if (ch !== 0 && values.every((v) => v === undefined)) values = settings.map((p) => valueIn(p, chunks, 0))
  const named = []
  const enums = []
  let type = null
  settings.forEach((p, i) => {
    const v = values[i]
    if (v === undefined) return
    if (p.unit === 'enum') {
      const value = ordinalOf(p, v)
      if (p.key === 'type') {
        type = { value, name: p.enumValues?.[value] ?? String(v) }
        return
      }
      if (p.key === 'channel') return
      enums.push({ id: idOf(p, b.base), name: p.label, value, options: Object.entries(p.enumValues || {}).map(([n, label]) => ({ value: Number(n), label })) })
      return
    }
    const value = typeof v === 'number' ? v : Number(v) || 0
    const knob = { id: idOf(p, b.base), name: p.label, value, norm: normOf(p, value) }
    if (AM4_UNIT_LABEL[p.unit]) knob.unit = AM4_UNIT_LABEL[p.unit]
    knob.min = p.min
    knob.max = p.max
    if (p.log) knob.log = true
    named.push(knob)
  })
  const once = (list) => {
    const seen = new Set()
    return list.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
  }
  const enumsOut = once(enums)
  if (typeof bypassed === 'boolean') {
    enumsOut.unshift({ id: 0xffff, name: 'Bypass', value: bypassed ? 1 : 0, options: [{ value: 0, label: 'Engaged' }, { value: 1, label: 'Bypassed' }] })
  }
  const out = { block: b.slug, slug: b.slug, page: -1, named: once(named), enums: enumsOut, type }
  const layout = layoutFor(b.slug, type?.value)
  if (layout) out.layout = layout
  return out
}

/** The models a block offers, as GET /blocks/<slug>/types answers on the computer: ForgeFX's blockTypes. */
export function modelsOf(slug) {
  const t = settingsOf(slug).find((p) => p.key === 'type')
  if (!t?.enumValues) return []
  return Object.entries(t.enumValues)
    .map(([v, name]) => ({ value: Number(v), name, manufacturer: null, basedOn: null }))
    .sort((a, b) => a.value - b.value)
}

/* ------------------------------------------------------------------ */
/* The writes                                                          */
/* ------------------------------------------------------------------ */

/**
 * The catalog row an id names on the block at this code, with where a write
 * to it goes ({p, pidLow, pidHigh}), or null. An id above 0xFFFF carries its
 * own register (the amp's cab), and it goes there, as ForgeFX's setParam
 * sends it; a bare id goes to the block's own code.
 */
export function settingAt(code, id) {
  const b = editBlock(code)
  if (!b || !Number.isInteger(id) || id < 0) return null
  const register = id > 0xffff ? id >>> 16 : b.base
  const number = id > 0xffff ? id & 0xffff : id
  const p = settingsOf(b.slug).find((q) => q.pidLow === register && q.pidHigh === number)
  if (!p) return null
  const wire = readsOf(code).find((r) => r.key === register)
  if (!wire) return null
  return { p, pidLow: wire.wire, pidHigh: number }
}

/** A knob to a place along its travel, 0 to 1: forgefx-midi buildSetParamNorm. */
export function buildAm4SetNorm(pidLow, pidHigh, norm) {
  if (!Number.isFinite(norm) || norm < 0 || norm > 1) throw new Error(`${norm} is not 0..1`)
  return am4Frame({ pidLow, pidHigh, action: AM4.SET_NORM, hdr4: 4, payload: am4Float(norm) })
}

/** A switch or a model to one of its numbers: forgefx-midi buildSetFloatParam. */
export function buildAm4SetValue(pidLow, pidHigh, value) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${value} is not a switch's number`)
  return am4Frame({ pidLow, pidHigh, action: AM4.SET, hdr4: 4, payload: am4Float(value) })
}

/** Whether a switch has this number among its options. */
const hasOption = (p, v) => Number.isInteger(v) && !!p.enumValues && Object.prototype.hasOwnProperty.call(p.enumValues, v)

/**
 * The frame for PUT /preset/blocks/<code>/params/<id>, or a sentence saying
 * why there is none: {frame, what, register} or {refused}, `register` the
 * one the catalog files the setting under (the one to read again).
 *
 * A knob goes as a place along its travel, whichever way the screen asked:
 * on the AM4 the other way writes the number as it stands, and a 0-to-1
 * number written that way puts the knob at its bottom (lib/encoding.js).
 * A switch goes as one of its numbers.
 */
export function knobFrame(code, id, body) {
  const at = settingAt(code, id)
  if (!at) return { refused: 'That setting isn’t one the app can change over Bluetooth.' }
  const { p, pidLow, pidHigh } = at
  if (NOT_A_KNOB.has(p.key)) return { refused: 'That setting isn’t changed here.' }
  const v = Number(body?.value)
  if (p.unit === 'enum') {
    if (!hasOption(p, v)) return { refused: `${p.label} has no setting ${body?.value}.` }
    return { frame: buildAm4SetValue(pidLow, pidHigh, v), what: `${p.label} on block ${code} to ${p.enumValues[v]}`, register: p.pidLow }
  }
  if (!Number.isFinite(v)) return { refused: `${p.label} needs a number.` }
  const norm = Math.max(0, Math.min(1, v))
  return { frame: buildAm4SetNorm(pidLow, pidHigh, norm), what: `${p.label} on block ${code} to ${norm.toFixed(4)}`, register: p.pidLow }
}

/** The frame for POST /preset/blocks/<code>/type: {frame, what} or {refused}. ForgeFX's setType. */
export function modelFrame(code, value) {
  const b = editBlock(code)
  const t = b ? settingsOf(b.slug).find((p) => p.key === 'type') : null
  if (!t) return { refused: 'This block has no models to choose from.' }
  const v = Number(value)
  if (!hasOption(t, v)) return { refused: `There is no model ${value} for this block.` }
  return { frame: buildAm4SetValue(code, t.pidHigh, v), what: `block ${code} model to ${t.enumValues[v]}` }
}

/* ------------------------------------------------------------------ */
/* The one way out, for these                                          */
/* ------------------------------------------------------------------ */

/* The catalog row at this address on a block placed now, with the block, or null. */
function rowAt(pidLow, pidHigh, placed) {
  for (const code of placed || []) {
    const b = editBlock(code)
    if (!b) continue
    for (const r of readsOf(code)) {
      if (r.wire !== pidLow) continue
      const p = settingsOf(b.slug).find((q) => q.pidLow === r.key && q.pidHigh === pidHigh)
      if (p) return { p, code }
    }
  }
  return null
}

/**
 * Whether the AM4 may be sent this frame because it is one of Edit's: a
 * name for it, or null.
 *
 * `placed` is the block codes the AM4 itself reported in the preset it is
 * on, in the last answer this connection had (bleWire hands them in); with
 * none, nothing here goes. Every byte is looked at, as am4Allowed looks:
 *
 *   - a read (fn 0x1F) only of a register readsOf names for a block placed
 *     now: never a sweep of codes, which froze an AM4 once;
 *   - a knob write (SET_NORM) only at an address the catalog names as a
 *     knob of a block placed now, with a value from 0 to 1;
 *   - a switch or model write (SET) only at an address the catalog names as
 *     a switch of a block placed now, with one of its own numbers; and
 *     never the channel, which is AM4_ALLOWED's, at the base code only.
 */
export function am4EditAllowed(f, placed) {
  if (!Array.isArray(f) || f.length < 10 || !Array.isArray(placed) || !placed.length) return null
  for (let i = 0; i < f.length; i++) {
    const v = f[i]
    if (!Number.isInteger(v) || v < 0 || v > 0xff) return null
    if (i > 0 && i < f.length - 1 && v > 0x7f) return null
  }
  if (!isFractal(f) || f[4] !== MODELS.am4 || !checksumOk(f)) return null
  if (f[5] === READ_ALL) {
    if (f.length !== 10) return null
    const wire = decode14(f[6], f[7])
    return placed.some((code) => readsOf(code).some((r) => r.wire === wire)) ? 'block settings read' : null
  }
  if (f[5] !== FN.PARAM || f.length !== 23) return null
  const pidLow = decode14(f[6], f[7])
  const pidHigh = decode14(f[8], f[9])
  const action = decode14(f[10], f[11])
  if (decode14(f[12], f[13]) !== 0 || decode14(f[14], f[15]) !== 4) return null
  const found = rowAt(pidLow, pidHigh, placed)
  if (!found || found.p.key === 'channel') return null
  const v = am4ReadFloat(f.slice(16, 21))
  if (action === AM4.SET_NORM) return found.p.unit !== 'enum' && Number.isFinite(v) && v >= 0 && v <= 1 ? 'block knob' : null
  if (action === AM4.SET) return found.p.unit === 'enum' && hasOption(found.p, v) ? (found.p.key === 'type' ? 'block model' : 'block switch') : null
  return null
}

/* ------------------------------------------------------------------ */
/* The pages                                                           */
/* ------------------------------------------------------------------ */

/*
 * ForgeFX's layoutFrom (server/src/devices.ts), as the AM4 asks it: for the
 * block's current model and nothing else (no selectors). The page sets come
 * trimmed (scripts/am4-knobs.mjs): a control with no setting behind it, or
 * one only older firmware shows, is already out, as resolveLayoutPages would
 * leave it.
 */
const selectorValues = (value) =>
  value == null
    ? []
    : String(value)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n))

function pickVariant(block, typeValue) {
  const variants = block.variants || []
  if (!variants.length) return undefined
  let cands = typeValue == null ? [] : variants.filter((v) => selectorValues(v.value).includes(typeValue))
  if (!cands.length) cands = variants.filter((v) => v.value == null)
  if (!cands.length) cands = variants
  return cands.find((v) => v.pinned) ?? cands[0]
}

const fwBound = (v) => {
  if (!v) return 0
  const [maj = 0, min = 0] = String(v)
    .split(',')
    .map((s) => Number(s.trim()) || 0)
  return maj * 1000 + min
}

function newestFw(items) {
  if (items.length <= 1) return items
  if (!items.some((i) => i.fw && (i.fw.gtet || i.fw.lt))) return items
  const gtet = items.filter((i) => i.fw?.gtet)
  if (gtet.length) return [gtet.reduce((a, b) => (fwBound(b.fw.gtet) > fwBound(a.fw.gtet) ? b : a))]
  const ungated = items.filter((i) => !i.fw?.gtet && !i.fw?.lt)
  if (ungated.length) return ungated
  return [items.reduce((a, b) => (fwBound(b.fw.lt) > fwBound(a.fw.lt) ? b : a))]
}

function bySelector(group, typeValue) {
  const gated = group.filter((p) => p.selectorParamName != null && p.value != null)
  if (!gated.length) return group
  const ungated = group.filter((p) => p.selectorParamName == null || p.value == null)
  const byType = typeValue != null ? gated.filter((p) => selectorValues(p.value).includes(typeValue)) : []
  return [...ungated, ...(byType.length ? byType : [gated[0]])]
}

function resolvePages(pages, typeValue) {
  const order = []
  const groups = new Map()
  for (const p of pages) {
    if (!groups.has(p.name)) {
      groups.set(p.name, [])
      order.push(p.name)
    }
    groups.get(p.name).push(p)
  }
  const out = []
  for (const name of order) for (const p of newestFw(bySelector(groups.get(name), typeValue))) out.push(p)
  return out
}

/** The editor's pages for this block on this model, as the computer sends them, or null. */
export function layoutFor(slug, typeValue) {
  const family = AM4_FAMILY_BY_BLOCK[String(slug || '').toLowerCase()]
  const block = family ? AM4_PAGES[family] : null
  if (!block) return null
  const variant = pickVariant(block, typeValue)
  if (!variant) return null
  const out = { editorName: block.editorName, family: block.family, variantName: variant.name, variantValue: variant.value ?? null }
  if (variant.fw) out.fw = variant.fw
  if (variant.pinned) out.pinned = true
  out.pages = resolvePages(variant.pages || [], typeValue)
  return out
}
