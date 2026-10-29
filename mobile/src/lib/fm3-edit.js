/**
 * AN FM3 BLOCK'S KNOBS, READ AND TURNED BY THE PHONE ITSELF.
 *
 * The AM4's twin (lib/am4-edit.js), for the FM3, and like it a port of what
 * the computer app does, each from where it lives at ForgeFX's pinned
 * commits (desktop/forgefx.lock.json):
 *
 *   - the read: forgefx-midi gen3/axe-fx-iii buildBlockBulkReadPoll (fn
 *     0x1F with the block's effect id) and assembleGen3BlockBulkRead, whose
 *     answer is a header (0x74: the block and how many values), the values
 *     in pages (0x75), and a footer (0x76); every channel the block has, one
 *     after another;
 *   - what Edit is handed: ForgeFX server/src/drivers/gen3.ts blockParams,
 *     with its #channelSlice, #display and dedupeLabels, and the pages from
 *     its profile's layoutFor (server/src/devices.ts), picked by the block's
 *     model and the settings its pages are chosen by;
 *   - the writes: buildSetParameterContinuous for a knob (fn 0x01, 52 00,
 *     its place along its travel) and buildSetParameter for a switch or a
 *     model (09 00, its number), at the block's own effect id.
 *
 * Which settings are knobs and how each is scaled was decided when the
 * catalog was written (scripts/fm3-knobs.mjs), by ForgeFX's own rules from
 * the static FM3 profile. This file only reads values off the wire into it.
 *
 * And, as for the AM4, every frame these build is held to fm3EditAllowed
 * before it goes (bleWire): a read only of a block the FM3 has just listed
 * in its preset, a write only to a setting the catalog names on such a
 * block, within its range.
 */
import { FM3_BLOCKS, FM3_FAMILIES, FM3_PAGES, FM3_ROSTERS } from './fm3-knobs.js'
import { FN, MODELS, checksumOk, decode14, encode14, floatBits, frame, fromSeptets32, bitsFloat, isFractal, septets32 } from './fractal-sysex.mjs'

/* The read and the three parts of its answer. */
export const READ_ALL = 0x1f
const HEAD = 0x74
const CHUNK = 0x75
const FOOT = 0x76
/* The two writes' sub-actions: a knob's place (52 00), a switch's or a model's number (09 00). */
export const KNOB = [0x52, 0x00]
export const TYPED = [0x09, 0x00]
const WIRE_FULL = 65534

/** The block at this effect id as Edit can open it, or null: {slug, family, name, page}. */
export function editBlock(eid) {
  const b = FM3_BLOCKS[eid]
  if (!b) return null
  const [slug, family, name, page] = b
  return FM3_FAMILIES[family] ? { eid, slug, family, name, page } : null
}

/* ------------------------------------------------------------------ */
/* The read                                                            */
/* ------------------------------------------------------------------ */

/** fn 0x1F for one block: F0 00 01 74 <model> 1F <effect id> <checksum> F7. */
export function buildReadAll(model, eid) {
  if (!Number.isInteger(eid) || eid < 1 || eid > 0x3fff) throw new Error(`effect ${eid} is not one a unit is read at`)
  return frame(model, READ_ALL, encode14(eid))
}

/* Three septets to one sixteen-bit value: forgefx-midi unpackValue16. */
const packed16 = (b0, b1, b2) => (b0 & 0x7f) | ((b1 & 0x7f) << 7) | ((b2 & 0x03) << 14)

/**
 * What a frame is, as part of the answer to a read of `eid` from a unit of
 * this model: {part: 'head', count}, {part: 'chunk', values}, {part:
 * 'foot'}, {part: 'damaged'} for one whose checksum does not hold, or null.
 * A page's values run from its ninth byte to its checksum, three bytes each
 * (forgefx-midi parseGen3StateBroadcastBody).
 */
export function readAllPart(f, model, eid) {
  if (!isFractal(f) || f[4] !== model) return null
  const fn = f[5]
  if (fn !== HEAD && fn !== CHUNK && fn !== FOOT) return null
  if (fn === HEAD) {
    if (f.length < 11) return null
    if (decode14(f[6], f[7]) !== eid) return null
    if (!checksumOk(f)) return { part: 'damaged' }
    return { part: 'head', count: decode14(f[8], f[9]) }
  }
  if (!checksumOk(f)) return { part: 'damaged' }
  if (fn === FOOT) return { part: 'foot' }
  if (f.length < 10) return { part: 'damaged' }
  const values = []
  const end = f.length - 2
  for (let i = 8; i + 3 <= end; i += 3) values.push(packed16(f[i], f[i + 1], f[i + 2]))
  return { part: 'chunk', values }
}

/** A collector for bleWire's `collect`, as lib/am4-edit.js readAllCollector: {count, values}, or {damaged}. */
export function readAllCollector(model, eid) {
  let head = null
  let damaged = false
  const values = []
  return (f) => {
    const got = readAllPart(f, model, eid)
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

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const round3 = (v) => Math.round(v * 1000) / 1000

/*
 * Which values are the channel the block is on: ForgeFX's #channelSlice.
 * The catalog's stride, unless the unit sent a count it does not divide, and
 * then the count in four; the channel past the last one there is, the last.
 */
export function sliceOf(stride, bulk, channel) {
  const basis = bulk.count > 0 ? bulk.count : bulk.values.length
  const s = stride && stride > 0 && basis % stride === 0 ? stride : basis > 0 && basis % 4 === 0 ? basis / 4 : Math.max(1, stride && stride > 0 ? stride : basis)
  const channels = Math.max(1, Math.floor(basis / s))
  return { stride: s, channels, base: Math.min(channel, channels - 1) * s }
}

/*
 * A knob's value off the wire: ForgeFX's #display. Its place along its
 * travel, and what its display shows, on its scale; a value the scale cannot
 * take (past 65534), or a knob with no range, is shown 0 to 10, as the
 * computer shows it.
 */
export function shownKnob(k, raw) {
  const [, , min, max, log, unit] = k
  const norm = clamp01(raw / WIRE_FULL)
  if (k.length > 2 && Number.isInteger(raw) && raw >= 0 && raw <= WIRE_FULL && min < max && !(log && (min <= 0 || max <= 0))) {
    const v = log ? min * Math.pow(max / min, raw / WIRE_FULL) : min + (raw / WIRE_FULL) * (max - min)
    const out = { value: round3(v), norm }
    if (unit) out.unit = unit
    out.min = min
    out.max = max
    if (log) out.log = true
    return out
  }
  return { value: Math.round(norm * 1000) / 100, norm }
}

/* ForgeFX's dedupeLabels: a name that repeats in a list gets 1, 2, 3 after it. */
function numberRepeats(items) {
  const total = new Map()
  for (const it of items) total.set(it.name, (total.get(it.name) ?? 0) + 1)
  const seen = new Map()
  for (const it of items) {
    if ((total.get(it.name) ?? 0) > 1) {
      const n = (seen.get(it.name) ?? 0) + 1
      seen.set(it.name, n)
      it.name = `${it.name} ${n}`
    }
  }
}

/*
 * NOT THE CAB'S. A cab block's list is its cabinets, and its "model" setting
 * is not one of them: over the computer a cab is picked through its cab state
 * (lib/cab-pick.js), never as a model change, which on a cab writes another
 * setting. There is no cab state over Bluetooth, so no cab is picked here;
 * its knobs and switches are.
 */
const NO_MODELS = new Set(['cab'])

/** The models a slug offers, as GET /blocks/<slug>/types answers on the computer: ForgeFX's rosterFor. */
export function modelsOf(slug) {
  const key = String(slug || '').toLowerCase()
  if (NO_MODELS.has(key)) return []
  return (FM3_ROSTERS[key] || []).map(([value, name, manufacturer, basedOn]) => ({ value, name, manufacturer, basedOn }))
}

/**
 * What GET /preset/blocks/<eid>/params answers over the computer, made from
 * the block's whole read (`bulk`, {count, values}) for the channel it is on:
 * ForgeFX's blockParams, field for field.
 */
export function blockParamsOf(eid, bulk, { channel = 0 } = {}) {
  const b = editBlock(eid)
  if (!b) return null
  const f = FM3_FAMILIES[b.family]
  const { base } = sliceOf(f.stride, bulk, Number.isInteger(channel) && channel >= 0 ? channel : 0)
  const at = (pid) => bulk.values[base + pid] ?? 0
  const named = f.knobs.map((k) => ({ id: k[0], name: k[1], ...shownKnob(k, at(k[0])) }))
  const enums = f.switches.map(([id, name, min, max, labels]) => {
    const raw = at(id)
    const value = raw > max ? Math.round((raw / WIRE_FULL) * (max - min)) + min : raw
    return { id, name, value, options: labels.map((label, i) => ({ value: min + i, label })) }
  })
  let type = null
  if (f.typeId != null) {
    const roster = FM3_ROSTERS[b.slug.toLowerCase()] || []
    const max = Math.max(0, roster.length - 1)
    const raw = at(f.typeId)
    const tv = raw > max ? Math.round((raw / WIRE_FULL) * max) : raw
    type = { value: tv, name: roster[tv]?.[1] ?? '' }
  }
  /* What the pages are chosen by: the model, else the switch or knob the page names (named over enums, as ForgeFX's map is filled). */
  const byId = new Map()
  for (const e of enums) byId.set(e.id, e.value)
  for (const n of named) if (typeof n.value === 'number') byId.set(n.id, n.value)
  const selector = (name) => {
    const pid = f.selectors[name]
    if (pid == null) return undefined
    if (f.typeId != null && pid === f.typeId) return type?.value
    return byId.get(pid)
  }
  const layout = layoutFor(b.family, type?.value, selector)
  numberRepeats(named)
  numberRepeats(enums)
  const out = { block: b.name, slug: b.slug, page: b.page, named, enums, type }
  if (layout) out.layout = layout
  return out
}

/* ------------------------------------------------------------------ */
/* The writes                                                          */
/* ------------------------------------------------------------------ */

/* fn 0x01 with a float at bytes 12-16 and four zeros after: forgefx-midi buildSetParameterFloat. */
function setFrame(model, sub, eid, pid, x) {
  return frame(model, FN.PARAM, [...sub, ...encode14(eid), ...encode14(pid), ...septets32(floatBits(x)), 0, 0, 0, 0])
}

/** A knob to a place along its travel: forgefx-midi buildSetParameterContinuous. */
export function buildKnob(model, eid, pid, norm) {
  if (!Number.isFinite(norm) || norm < 0 || norm > 1) throw new Error(`${norm} is not 0..1`)
  return setFrame(model, KNOB, eid, pid, norm)
}

/** A setting to a number, typed: forgefx-midi buildSetParameter. */
export function buildTyped(model, eid, pid, value) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${value} is not a setting’s number`)
  return setFrame(model, TYPED, eid, pid, value)
}

/* A setting of this block in the catalog: {kind: 'knob'|'switch'|'model', row}. */
function settingOf(b, pid) {
  const f = FM3_FAMILIES[b.family]
  if (f.typeId != null && pid === f.typeId) return { kind: 'model', row: null }
  const k = f.knobs.find((r) => r[0] === pid)
  if (k) return { kind: 'knob', row: k }
  const s = f.switches.find((r) => r[0] === pid)
  if (s) return { kind: 'switch', row: s }
  return null
}

/**
 * The frame for PUT /preset/blocks/<eid>/params/<id>, or why there is none:
 * {frame, what} or {refused}. As the computer sends it (ForgeFX setParam): a
 * place along the travel when the screen says continuous, the number as it
 * stands when it says not, which on an FM3 lands for a straight knob
 * (lib/encoding.js); a switch always as its number.
 */
export function knobFrame(model, eid, id, body) {
  const b = editBlock(eid)
  const s = b ? settingOf(b, id) : null
  if (!s || s.kind === 'model') return { refused: 'That setting isn’t one the app can change over Bluetooth.' }
  const v = Number(body?.value)
  if (s.kind === 'switch') {
    const [, label, min, max] = s.row
    if (!Number.isInteger(v) || v < min || v > max) return { refused: `${label} has no setting ${body?.value}.` }
    return { frame: buildTyped(model, eid, id, v), what: `${label} on block ${eid} to ${v}` }
  }
  if (!Number.isFinite(v)) return { refused: `${s.row[1]} needs a number.` }
  const n = clamp01(v)
  if (body?.continuous === false) return { frame: buildTyped(model, eid, id, n), what: `${s.row[1]} on block ${eid} to ${n.toFixed(4)} (typed)` }
  return { frame: buildKnob(model, eid, id, n), what: `${s.row[1]} on block ${eid} to ${n.toFixed(4)}` }
}

/** The frame for POST /preset/blocks/<eid>/type: {frame, what} or {refused}. ForgeFX's setType. */
export function modelFrame(model, eid, value) {
  const b = editBlock(eid)
  const f = b ? FM3_FAMILIES[b.family] : null
  if (!f || f.typeId == null) return { refused: 'This block has no models to choose from.' }
  if (NO_MODELS.has(b.slug.toLowerCase())) return { refused: 'A cab is picked with the computer for now.' }
  const roster = FM3_ROSTERS[b.slug.toLowerCase()] || []
  const v = Number(value)
  if (!Number.isInteger(v) || v < 0 || v >= roster.length) return { refused: `There is no model ${value} for this block.` }
  return { frame: buildTyped(model, eid, f.typeId, v), what: `block ${eid} model to ${roster[v][1]}` }
}

/* ------------------------------------------------------------------ */
/* The one way out, for these                                          */
/* ------------------------------------------------------------------ */

/**
 * Whether a unit of this model may be sent this frame because it is one of
 * Edit's: a name for it, or null. `placed` is the effect ids the unit listed
 * in its last answer about the preset it is on (the status dump bleWire read
 * for this connection); with none, nothing here goes.
 *
 *   - a read (fn 0x1F) only of a block placed now;
 *   - a knob (52 00) only at a setting the catalog names as a knob of a
 *     block placed now, from 0 to 1;
 *   - a typed write (09 00) only at a setting the catalog names on such a
 *     block: a switch to one of its numbers, a model to one of its models,
 *     a knob from 0 to 1 (ForgeFX's other way, above).
 */
export function fm3EditAllowed(f, placed, model = MODELS.fm3) {
  if (!Array.isArray(f) || !Array.isArray(placed) || !placed.length) return null
  for (let i = 0; i < f.length; i++) {
    const v = f[i]
    if (!Number.isInteger(v) || v < 0 || v > 0xff) return null
    if (i > 0 && i < f.length - 1 && v > 0x7f) return null
  }
  if (!isFractal(f) || f[4] !== model || !checksumOk(f)) return null
  if (f[5] === READ_ALL) {
    if (f.length !== 10) return null
    const eid = decode14(f[6], f[7])
    return placed.includes(eid) && editBlock(eid) ? 'block settings read' : null
  }
  if (f[5] !== FN.PARAM || f.length !== 23) return null
  const sub = [f[6], f[7]]
  const eid = decode14(f[8], f[9])
  const pid = decode14(f[10], f[11])
  if (f[17] || f[18] || f[19] || f[20]) return null
  if (!placed.includes(eid)) return null
  const b = editBlock(eid)
  const s = b ? settingOf(b, pid) : null
  if (!s) return null
  const x = bitsFloat(fromSeptets32(f, 12))
  if (!Number.isFinite(x)) return null
  if (sub[0] === KNOB[0] && sub[1] === KNOB[1]) return s.kind === 'knob' && x >= 0 && x <= 1 ? 'block knob' : null
  if (sub[0] !== TYPED[0] || sub[1] !== TYPED[1]) return null
  if (s.kind === 'knob') return x >= 0 && x <= 1 ? 'block knob (typed)' : null
  if (s.kind === 'switch') return Number.isInteger(x) && x >= s.row[2] && x <= s.row[3] ? 'block switch' : null
  const roster = NO_MODELS.has(b.slug.toLowerCase()) ? [] : FM3_ROSTERS[b.slug.toLowerCase()] || []
  return Number.isInteger(x) && x >= 0 && x < roster.length ? 'block model' : null
}

/* ------------------------------------------------------------------ */
/* The pages                                                           */
/* ------------------------------------------------------------------ */

/*
 * ForgeFX's layoutFrom (server/src/devices.ts) for the FM3: the variant for
 * the block's model, its pages grouped by name, each group cut down by the
 * setting its pages are chosen by (`selector`), then to the newest firmware's.
 * The page sets come trimmed (scripts/fm3-knobs.mjs), and are drawn out here
 * into the rows lib/editPages.js reads.
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

function bySelector(group, typeValue, selector) {
  const gated = group.filter((p) => p.selectorParamName != null && p.value != null)
  if (!gated.length) return group
  const ungated = group.filter((p) => p.selectorParamName == null || p.value == null)
  const cur = selector?.(gated[0].selectorParamName)
  if (cur != null) return [...ungated, ...gated.filter((p) => selectorValues(p.value).includes(cur))]
  const byType = typeValue != null ? gated.filter((p) => selectorValues(p.value).includes(typeValue)) : []
  return [...ungated, ...(byType.length ? byType : [gated[0]])]
}

const SECTION = { p: 'parameters', m: 'mixer', x: 'meters' }
const drawn = (page) => ({
  name: page.name,
  ...(page.fw ? { fw: page.fw } : {}),
  rows: page.rows.map(([s, controls]) => ({ section: SECTION[s], controls: controls.map(([paramId, label, meter]) => (meter ? { paramId, label, widget: 'meter' } : { paramId, label })) }))
})

/** The editor's pages for this family on this model, as the computer sends them, or null. */
export function layoutFor(family, typeValue, selector) {
  const block = FM3_PAGES[family]
  if (!block) return null
  const variant = pickVariant(block, typeValue)
  if (!variant) return null
  const order = []
  const groups = new Map()
  for (const p of variant.pages || []) {
    if (!groups.has(p.name)) {
      groups.set(p.name, [])
      order.push(p.name)
    }
    groups.get(p.name).push(p)
  }
  const pages = []
  for (const name of order) for (const p of newestFw(bySelector(groups.get(name), typeValue, selector))) pages.push(drawn(p))
  const out = { editorName: block.editorName, family: block.family, variantName: variant.name, variantValue: variant.value ?? null }
  if (variant.fw) out.fw = variant.fw
  if (variant.pinned) out.pinned = true
  out.pages = pages
  return out
}
