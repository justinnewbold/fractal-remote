/**
 * Which look the app wears, which unit's colours it is showing, and the
 * colours a player picked for himself.
 *
 * "Additionally i want to make a section where a user can edit the colors of
 * the blocks/presets and effects … Maybe even make some preset themes?"
 *
 * Everything colour-shaped that is REMEMBERED lives here, under one key, and
 * everything that is merely DATA — the palettes, the looks, the swatches —
 * lives in lib/blockPalettes. lib/blockColors and lib/sceneColors put the two
 * together each time a tile asks what colour it is.
 *
 * Takes its storage as an argument, the way lib/presetMarks does: the browser
 * hands it localStorage, the phone hands it `sync` from lib/store, which only
 * carries keys that start `fractal.` — hence the name of the key. And it keeps
 * what it read in memory, because a tile asks during its render and neither
 * end can wait for storage then.
 *
 * WHAT IS IN THE FILE, and why each part is shaped the way it is:
 *
 *   { v: 1,
 *     theme:   { id, at }                       the look; id null is a reset
 *     palette: { id, at }                       the last unit's palette
 *     families: { drive: { fill, at }, … }      your colour for a family
 *     scenes:   { '0': { fill, at }, … }        your colour for scene 1…8
 *     presetScenes: { unit: { preset: { '0': { fill, at } } } }
 *     presets:      { unit: { preset: { fill, at } } }
 *     off: { mode: 'colour' | 'grey', at } }
 *
 * Every entry carries the time it was set, and putting a colour back is a
 * `fill: null` WITH a time rather than a deletion. That is for the day these
 * follow the account the way setlists do: two copies meeting have to know
 * that "the drive is the unit's colour again" happened after "the drive is
 * pink", or a reset on the phone is undone by the Mac still holding the pink.
 *
 * Only a six-digit hex is a colour here. Anything else in the file — a name,
 * a CSS variable, a typo — is dropped on the way in rather than drawn.
 *
 * THE PALETTE IS REMEMBERED. The phone starts every launch as 'device' until
 * the unit answers, and gen-3 is what an unknown unit wears — so an AM4 owner
 * opened the app to FM3 colours and kept them for as long as the unit was not
 * there. The last unit's palette is kept with the colours and used until the
 * unit says otherwise. Not in the demo: trying the demo's FM3 must not leave
 * an AM4 owner's app in FM3 colours the next time he is offline.
 *
 * Shared with the phone by `npm run sync:rules`, so it imports nothing but its
 * neighbour, by an explicit './x.js' path, and takes the unit as an argument
 * rather than reaching for the device layer of either end.
 */
import { ALIASES, DEFAULT_LOOK, FAMILIES, FRACTAL_REMOTE_LOOK, PALETTE_IDS, familyOf as found, isLookId, lookById, paletteFor } from './blockPalettes.js'

const KEY = 'fractal.colours'

/** Scene colours are kept for eight scenes and wrap, like the unit's eight. */
export const SCENE_SLOTS = 8

/** "Keep their colour", the default, and "Grey when off". */
export const OFF_MODES = Object.freeze(['colour', 'grey'])

const blank = () => ({ v: 1, theme: null, palette: null, families: {}, scenes: {}, presetScenes: {}, presets: {}, off: null })

let doc = blank()
let held = null
let loaded = false
let version = 0
/* This session's unit: what setColourUnit was last told. */
let unit = { slug: null, key: null, palette: null, demo: false }
const watchers = new Set()

const store = (given) => {
  try {
    return given ?? held ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  } catch {
    // Blocked site data throws on the property access itself, not just on use.
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Reading the file, and refusing what does not belong in it            */
/* ------------------------------------------------------------------ */

const HEX = /^#[0-9a-f]{6}$/i
const isTime = (t) => typeof t === 'number' && Number.isFinite(t) && t >= 0
const isObject = (o) => !!o && typeof o === 'object' && !Array.isArray(o)

/** A colour as this file keeps it: six-digit hex, lower case, or null for "put back". Undefined for junk. */
const asFill = (v) => (v === null ? null : typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : undefined)

/** One { fill, at }, or null if it is not one. */
function entry(e) {
  if (!isObject(e) || !isTime(e.at)) return null
  const fill = asFill(e.fill)
  return fill === undefined ? null : { fill, at: e.at }
}

const sceneKey = (k) => (/^[0-7]$/.test(k) ? k : null)
const presetKey = (k) => (/^\d{1,4}$/.test(k) ? String(Number(k)) : null)
const unitKey = (k) => (typeof k === 'string' && /^[a-z0-9]{1,40}(:demo)?$/.test(k) ? k : null)
const familyKey = (k) => {
  if (typeof k !== 'string' || !/^[a-z0-9]{1,32}$/.test(k)) return null
  const family = ALIASES[k] || k
  return FAMILIES.includes(family) ? family : null
}

/** A map of keys to entries, keeping only the keys `ok` accepts and the entries that are entries. */
function entries(map, ok) {
  const out = {}
  if (!isObject(map)) return out
  for (const [k, v] of Object.entries(map)) {
    const key = ok(k)
    const e = key === null ? null : entry(v)
    if (e) out[key] = e
  }
  return out
}

/** Two levels of keys over entries — unit, then preset — for the per-preset scopes. */
function perPreset(map, inner) {
  const out = {}
  if (!isObject(map)) return out
  for (const [u, presets] of Object.entries(map)) {
    const uk = unitKey(u)
    if (!uk || !isObject(presets)) continue
    const kept = {}
    for (const [p, v] of Object.entries(presets)) {
      const pk = presetKey(p)
      if (pk === null) continue
      const got = inner(v)
      if (got) kept[pk] = got
    }
    if (Object.keys(kept).length) out[uk] = kept
  }
  return out
}

/** The whole file, cleaned. Anything unreadable is a file with nothing in it, never a throw. */
export function parseLooks(raw) {
  let all
  try {
    all = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return blank()
  }
  if (!isObject(all)) return blank()
  const out = blank()
  if (isObject(all.theme) && isTime(all.theme.at) && (all.theme.id === null || isLookId(all.theme.id))) {
    out.theme = { id: all.theme.id, at: all.theme.at }
  }
  if (isObject(all.palette) && isTime(all.palette.at) && PALETTE_IDS.includes(all.palette.id)) {
    out.palette = { id: all.palette.id, at: all.palette.at }
  }
  out.families = entries(all.families, familyKey)
  out.scenes = entries(all.scenes, sceneKey)
  out.presetScenes = perPreset(all.presetScenes, (v) => {
    const scenes = entries(v, sceneKey)
    return Object.keys(scenes).length ? scenes : null
  })
  out.presets = perPreset(all.presets, entry)
  if (isObject(all.off) && isTime(all.off.at) && OFF_MODES.includes(all.off.mode)) {
    out.off = { mode: all.off.mode, at: all.off.at }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Telling the screens                                                  */
/* ------------------------------------------------------------------ */

/**
 * A number that changes whenever anything here does, for a store
 * subscription. The phone re-renders from its root on it, beside the theme;
 * the browser's tiles each subscribe (lib/useLooks).
 */
export const looksVersion = () => version

/** Be told when anything here changes. Returns the unsubscribe. */
export function watchLooks(fn) {
  watchers.add(fn)
  return () => watchers.delete(fn)
}

function changed() {
  version += 1
  for (const fn of watchers) {
    try {
      fn()
    } catch {
      /* One screen's trouble is not every screen's. */
    }
  }
}

function save(storage) {
  try {
    store(storage)?.setItem(KEY, JSON.stringify(doc))
  } catch {
    // A private window, or a full quota. What is on screen is still right for
    // this session; only coming back to it later is lost.
  }
  changed()
  return true
}

/* ------------------------------------------------------------------ */
/* Loading, and the unit                                                */
/* ------------------------------------------------------------------ */

/**
 * Read the colours. Both ends call this once at start, beside the theme; the
 * phone after its store has landed.
 *
 * If the unit answered first — the phone's link can be quicker than its own
 * storage — its palette is the one kept, and written down now that writing is
 * safe. Writing before the read would have replaced the whole file with a
 * file holding only that.
 */
export function loadLooks(storage) {
  held = store(storage)
  try {
    doc = parseLooks(held?.getItem(KEY))
  } catch {
    doc = blank()
  }
  loaded = true
  if (unit.palette && !unit.demo && doc.palette?.id !== unit.palette) {
    doc.palette = { id: unit.palette, at: Date.now() }
    return save() && lookId()
  }
  changed()
  return lookId()
}

/**
 * Tell the colours which unit is connected: the slug setlists and stars are
 * filed under (shared/device-slug), and whether it is the demo's.
 *
 * 'device' — a unit that answered without naming itself — says nothing about
 * which palette it wears, so it leaves the remembered one alone. Null forgets
 * the unit altogether.
 */
export function setColourUnit(slug, { demo = false } = {}, storage) {
  const s = slug ? String(slug).toLowerCase() : ''
  if (!s) {
    const had = unit.key !== null || unit.palette !== null
    unit = { slug: null, key: null, palette: null, demo: false }
    if (had) changed()
    return currentPaletteId()
  }
  const palette = s === 'device' ? unit.palette : paletteFor(s)
  const key = demo ? `${s}:demo` : s
  const moved = key !== unit.key || palette !== unit.palette
  unit = { slug: s, key, palette, demo: !!demo }
  if (palette && !demo && loaded && doc.palette?.id !== palette) {
    doc.palette = { id: palette, at: Date.now() }
    save(storage)
  } else if (moved) changed()
  return currentPaletteId()
}

/** Which unit's palette is being worn: the unit's, else the last one remembered, else gen-3's. */
export const currentPaletteId = () => unit.palette || doc.palette?.id || paletteFor()

/** The key a per-preset colour is filed under for this unit — the demo's apart. Null before a unit has answered. */
export const colourUnit = () => unit.key

/* ------------------------------------------------------------------ */
/* The look                                                             */
/* ------------------------------------------------------------------ */

/** The look being worn. */
export const lookId = () => (isLookId(doc.theme?.id) ? doc.theme.id : DEFAULT_LOOK)
export const currentLook = () => lookById(lookId())

/**
 * Whether the look is "Fractal Remote", the app's colours as they always were
 * — which the phone also DRAWS as it always did (Tile's lift, the old edges),
 * because a look that only kept the numbers would still not look the same.
 */
export const isFractalRemoteLook = () => lookId() === FRACTAL_REMOTE_LOOK

/** Wear a look. Your own colours stay on top of it. False for a look there is no such thing as. */
export function setLook(id, storage) {
  if (!isLookId(id)) return false
  doc.theme = { id, at: Date.now() }
  return save(storage)
}

/* ------------------------------------------------------------------ */
/* Your own colours                                                     */
/* ------------------------------------------------------------------ */

/** The family a slug is filed under for your colours, or null — the same reading of a slug the tiles get. */
const familyOf = (slug) => found(slug)?.family || null

/** A colour for a whole family, on every unit and in every preset. Null puts the look's back. */
export function setFamily(slug, fill, storage) {
  const family = familyOf(slug)
  const f = asFill(fill)
  if (!family || f === undefined) return false
  doc.families[family] = { fill: f, at: Date.now() }
  return save(storage)
}

/** Your colour for this family, or null. */
export const yourFamily = (slug) => {
  const family = familyOf(slug)
  return (family && doc.families[family]?.fill) || null
}

const slotOf = (i) => {
  const n = Number(i)
  return Number.isInteger(n) ? String(((n % SCENE_SLOTS) + SCENE_SLOTS) % SCENE_SLOTS) : null
}
const presetOf = (p) => (Number.isInteger(p) && p >= 0 && p <= 9999 ? String(p) : null)

/**
 * A colour for scene `i` (from 0) — for every preset, or with `preset` for
 * that one preset on `unit` (this unit if none is given). Null puts it back:
 * a per-preset one back to your every-preset one, that back to the look's.
 */
export function setScene(i, fill, { unit: u, preset } = {}, storage) {
  const slot = slotOf(i)
  const f = asFill(fill)
  if (slot === null || f === undefined) return false
  if (preset === undefined || preset === null) {
    doc.scenes[slot] = { fill: f, at: Date.now() }
    return save(storage)
  }
  const p = presetOf(preset)
  const uk = unitKey(u ?? unit.key)
  if (p === null || !uk) return false
  if (!doc.presetScenes[uk]) doc.presetScenes[uk] = {}
  if (!doc.presetScenes[uk][p]) doc.presetScenes[uk][p] = {}
  doc.presetScenes[uk][p][slot] = { fill: f, at: Date.now() }
  return save(storage)
}

/** Your colour for scene `i`, in the scope asked for — every preset, or one preset on one unit — or null. */
export function yourScene(i, { unit: u, preset } = {}) {
  const slot = slotOf(i)
  if (slot === null) return null
  if (preset === undefined || preset === null) return doc.scenes[slot]?.fill || null
  const p = presetOf(preset)
  const uk = unitKey(u ?? unit.key)
  return (p !== null && uk && doc.presetScenes[uk]?.[p]?.[slot]?.fill) || null
}

/** A colour tag for one preset on one unit, like a star. Null takes it off. */
export function setPresetColour(u, preset, fill, storage) {
  const p = presetOf(preset)
  const uk = unitKey(u)
  const f = asFill(fill)
  if (p === null || !uk || f === undefined) return false
  if (!doc.presets[uk]) doc.presets[uk] = {}
  doc.presets[uk][p] = { fill: f, at: Date.now() }
  return save(storage)
}

/** That preset's colour tag, or null. */
export function presetColour(u, preset) {
  const p = presetOf(preset)
  const uk = unitKey(u)
  return (p !== null && uk && doc.presets[uk]?.[p]?.fill) || null
}

/** How switched-off effects are drawn: 'colour' (their own outline) or 'grey'. */
export const offMode = () => doc.off?.mode || 'colour'

export function setOffMode(mode, storage) {
  if (!OFF_MODES.includes(mode)) return false
  doc.off = { mode, at: Date.now() }
  return save(storage)
}

/** How many of your own colours sit on top of the look, every-preset ones only. */
export const ownColourCount = () =>
  Object.values(doc.families).filter((e) => e.fill).length + Object.values(doc.scenes).filter((e) => e.fill).length

/**
 * Put every colour back: Match my unit, the unit's colours, coloured outlines
 * for switched-off effects. Each colour of yours becomes a reset with today's
 * time rather than vanishing, for the reason at the top of this file. The
 * remembered palette stays: it is a fact about the unit, not a choice.
 */
export function resetAll(storage) {
  const at = Date.now()
  const back = (map) => {
    for (const k of Object.keys(map)) map[k] = { fill: null, at }
  }
  doc.theme = { id: null, at }
  back(doc.families)
  back(doc.scenes)
  for (const presets of Object.values(doc.presetScenes)) for (const scenes of Object.values(presets)) back(scenes)
  for (const presets of Object.values(doc.presets)) back(presets)
  doc.off = { mode: 'colour', at }
  return save(storage)
}

/** The file as it stands, for a test or a later sync to read. A copy: changing it changes nothing. */
export const looksDoc = () => JSON.parse(JSON.stringify(doc))
