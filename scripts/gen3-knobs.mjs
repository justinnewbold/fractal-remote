#!/usr/bin/env node
/**
 * The knobs of the three gen-3 units, for the phone to read and turn over
 * Bluetooth or a unit's own USB cable: the FM3, the FM9 and the Axe-Fx III.
 *
 * The AM4's twin (scripts/am4-knobs.mjs), for the gen-3 units: over the
 * computer a block's knobs come from ForgeFX's gen-3 driver, which names and
 * scales each setting from the codec's tables for the unit it is talking to
 * (forgefx-midi gen3/fm3, gen3/fm9, gen3/axe-fx-iii), through the unit's
 * profile (ForgeFX server/src/devices.ts PROFILES). Over Bluetooth the phone
 * carries what it needs of them, and this writes it, one file per unit:
 * mobile/src/lib/fm3-knobs.js, fm9-knobs.js and axefx3-knobs.js.
 *
 * Which settings are knobs, which are switches, how a knob is scaled and
 * what its switch options are called is decided HERE, by ForgeFX's own
 * rules (server/src/drivers/gen3.ts blockParams, #display, #enumOptions,
 * #paramId), each unit through its own profile, as devices.ts builds it:
 *
 *   - FM3: FM3_PARAMS_BY_FAMILY, FM3_RANGES, FM3_RANGE_SECTIONS,
 *     FM3_LAYOUTS, fm3RosterFor (FM3_ROSTERS, else the family's model
 *     enum), fm3EnumLabels (FM3_ENUM_OVERRIDES);
 *   - FM9: FM9_PARAMS_BY_FAMILY, FM9_RANGES, FM9_RANGE_SECTIONS,
 *     FM9_LAYOUTS, fm9RosterFor and fm9EnumLabels (the family-shaped
 *     FM9_ENUM_OVERRIDES; the computer does not read FM9_ROSTERS, so
 *     neither does this);
 *   - Axe-Fx III: PARAMS_BY_FAMILY, AXE3_RANGES merged over the table's own
 *     bounds (devices.ts AXE3_RANGES), AXE3_RANGE_SECTIONS, AXE3_LAYOUTS,
 *     axe3RosterFor (AXE3_ENUM_OVERRIDES, then GEN3_READ_ROSTERS, then the
 *     effect-type overlay) and axe3EnumLabels.
 *
 * So the file the phone carries holds answers, not rules, and lib/gen3-edit.js
 * only reads values off the wire into them.
 *
 * ONE THING THE COMPUTER CAN DO THAT THIS CANNOT: on connecting, it may walk
 * the unit itself and lay what the unit says over these tables. The phone
 * has the tables alone, which is what the computer has before a walk.
 *
 * FROM THE CODEC THE COMPUTER APP CARRIES, and no other: the pinned commit
 * in desktop/forgefx.lock.json, checked here and written into each file,
 * where a test holds it to the lock.
 *
 *   node scripts/gen3-knobs.mjs <forgefx-midi checkout, built> [fm3|fm9|axefx3 ...]
 *
 * With no unit named, all three are written.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const targetOf = (unit) => join(root, 'mobile', 'src', 'lib', `${unit}-knobs.js`)

/* ForgeFX's SLUG_FAMILY (server/src/devices.ts): a block's slug to its catalog family. */
export const SLUG_FAMILY = {
  amp: 'DISTORT', cab: 'CABINET', drive: 'FUZZ', comp: 'COMP', multicomp: 'MULTICOMP',
  peq: 'PEQ', geq: 'GEQ', reverb: 'REVERB', delay: 'DELAY', multitap: 'MULTITAP',
  chorus: 'CHORUS', flanger: 'FLANGER', phaser: 'PHASER', rotary: 'ROTARY', tremolo: 'TREMOLO',
  pitch: 'PITCH', wah: 'WAH', filter: 'FILTER', formant: 'FORMANT', enhancer: 'ENHANCER',
  mixer: 'MIXER', volume: 'VOLUME', input: 'INPUT', output: 'OUTPUT', gate: 'GATE',
  synth: 'SYNTH', ringmod: 'RINGMOD', looper: 'LOOPER', resonator: 'RESONATOR',
  megatap: 'MEGATAP', tentap: 'TENTAP', plex: 'PLEX', send: 'FDBKSEND', return: 'FDBKRET',
  multiplexer: 'MULTIPLEXER'
}

/* ForgeFX gen3.ts: the units a musician turns, and what each shows. devices.ts CONT_UNITS is the same set. */
const KNOB_UNITS = new Set(['numeric', 'knob_0_10', 'knob_0_20', 'db', 'hz', 'ms', 'seconds', 'percent', 'bipolar_percent', 'ratio', 'semitones', 'degrees'])
const UNIT_LABEL = { db: 'dB', hz: 'Hz', ms: 'ms', seconds: 's', percent: '%', bipolar_percent: '%', degrees: '°', semitones: 'st', pf: 'pF', ratio: ':1' }
/* ForgeFX gen3.ts paramLabel: the catalog's label, else the name less its family, underscores made spaces. */
const labelOf = (p) => p.displayLabel ?? p.name.replace(/^[A-Z0-9]+_/, '').replace(/_/g, ' ')

/* ForgeFX gen3.ts #paramId: 'type' is the family's model list (<FAM>_MODEL, then <FAM>_TYPE, then any enum ending TYPE). */
function paramIdOf(defs, family, name) {
  if (name.toLowerCase() === 'type') {
    return (defs.find((p) => p.name === `${family}_MODEL`) ?? defs.find((p) => p.name === `${family}_TYPE`) ?? defs.find((p) => p.unit === 'enum' && /TYPE$/i.test(p.name)))?.paramId
  }
  return defs.find((p) => p.displayLabel === name || p.name === name)?.paramId
}

/* ------------------------------------------------------------------ */
/* Each unit's profile, as ForgeFX's devices.ts builds it               */
/* ------------------------------------------------------------------ */

/* devices.ts modelSelectorPid: <FAM>_MODEL where there is one (the Delay's), else <FAM>_TYPE. */
const modelSelectorPid = (params, fam) => {
  const defs = params[fam] ?? []
  return (defs.find((p) => p.name === `${fam}_MODEL`) ?? defs.find((p) => p.name === `${fam}_TYPE`))?.paramId
}
/* devices.ts familyShapedRosterFor: the family's model enum, as a roster. */
const familyShapedRosterFor = (params, enums) => (slug) => {
  const fam = SLUG_FAMILY[slug.toLowerCase()]
  if (!fam) return []
  const pid = modelSelectorPid(params, fam)
  const labels = pid != null ? enums[fam]?.[String(pid)] : undefined
  return labels ? labels.map((name, value) => ({ value, name, manufacturer: null, basedOn: null })) : []
}
/* devices.ts recToRoster and recToLabels: a record by number to a list by number, holes and all. */
const recToRoster = (r) => {
  const out = []
  for (const [k, name] of Object.entries(r)) out[Number(k)] = { value: Number(k), name, manufacturer: null, basedOn: null }
  return out
}
const recToLabels = (r) => {
  const out = []
  for (const [k, name] of Object.entries(r)) out[Number(k)] = name
  return out
}

/* gen3.ts imports resolveEnumValues from gen3/axe-fx-iii for every unit: #enumOptions' overlay. */
function profiles({ fm3, fm9, axe3 }) {
  const fm3Roster = familyShapedRosterFor(fm3.FM3_PARAMS_BY_FAMILY, fm3.FM3_ENUM_OVERRIDES)
  const fm9Roster = familyShapedRosterFor(fm9.FM9_PARAMS_BY_FAMILY, fm9.FM9_ENUM_OVERRIDES)

  /* devices.ts AXE3_RANGES: the table's own bounds, then the cache's rows over them, its placeholder rows left out. */
  const axe3Params = axe3.PARAMS_BY_FAMILY
  const axe3Ranges = {}
  for (const [fam, list] of Object.entries(axe3Params)) {
    axe3Ranges[fam] = {}
    for (const p of list) {
      if (p.displayMin == null || p.displayMax == null) continue
      axe3Ranges[fam][p.paramId] = { kind: KNOB_UNITS.has(p.unit ?? '') ? 'float' : 'enum', displayMin: p.displayMin, displayMax: p.displayMax, typecode: 0 }
    }
  }
  for (const [fam, rows] of Object.entries(axe3.AXE3_RANGES)) {
    axe3Ranges[fam] ??= {}
    for (const [pid, r] of Object.entries(rows)) {
      if (r.kind === 'float' && r.displayMin === r.displayMax) continue
      axe3Ranges[fam][Number(pid)] = r
    }
  }
  const axe3DeviceRoster = familyShapedRosterFor(axe3Params, axe3.AXE3_ENUM_OVERRIDES)

  return {
    fm3: {
      name: 'FM3',
      prefix: 'FM3',
      editor: 'FM3-Edit',
      params: fm3.FM3_PARAMS_BY_FAMILY,
      ranges: fm3.FM3_RANGES,
      sections: fm3.FM3_RANGE_SECTIONS,
      layouts: fm3.FM3_LAYOUTS,
      familyByEid: fm3.FM3_FAMILY_BY_EFFECT_ID,
      /* devices.ts fm3RosterFor: the codec's FM3 rosters, with what each is based on, else the family's model enum. */
      rosterFor: (slug) => {
        const explicit = fm3.FM3_ROSTERS[slug.toLowerCase()]
        return explicit?.length ? explicit : fm3Roster(slug)
      },
      enumLabelsFor: (fam, pid) => fm3.FM3_ENUM_OVERRIDES[fam]?.[String(pid)]
    },
    fm9: {
      name: 'FM9',
      prefix: 'FM9',
      editor: 'FM9-Edit',
      params: fm9.FM9_PARAMS_BY_FAMILY,
      ranges: fm9.FM9_RANGES,
      sections: fm9.FM9_RANGE_SECTIONS,
      layouts: fm9.FM9_LAYOUTS,
      familyByEid: fm9.FM9_FAMILY_BY_EFFECT_ID,
      rosterFor: fm9Roster,
      enumLabelsFor: (fam, pid) => fm9.FM9_ENUM_OVERRIDES[fam]?.[String(pid)]
    },
    axefx3: {
      name: 'Axe-Fx III',
      prefix: 'AXE3',
      editor: 'Axe-Edit III',
      params: axe3Params,
      ranges: axe3Ranges,
      sections: axe3.AXE3_RANGE_SECTIONS,
      layouts: axe3.AXE3_LAYOUTS,
      /* The III ships no effect-id table: its audio blocks are named by the codec's slugs alone (devices.ts eidFamily()). */
      familyByEid: {},
      /* devices.ts axe3RosterFor. */
      rosterFor: (slug) => {
        const device = axe3DeviceRoster(slug)
        if (device.length) return device
        const fam = SLUG_FAMILY[slug.toLowerCase()]
        if (!fam) return []
        const read = axe3.GEN3_READ_ROSTERS[`${fam}_TYPE`]
        if (read) return recToRoster(read)
        const ov = axe3.resolveEnumValues(`${fam}_TYPE`)?.values
        return ov ? recToRoster(ov) : []
      },
      /* devices.ts axe3EnumLabels. */
      enumLabelsFor: (fam, pid) => {
        const device = axe3.AXE3_ENUM_OVERRIDES[fam]?.[String(pid)]
        if (device) return device
        const p = axe3Params[fam]?.find((x) => x.paramId === pid)
        const ov = p ? axe3.resolveEnumValues(p.name)?.values : undefined
        if (!ov) return undefined
        const labels = recToLabels(ov)
        return labels.length ? labels : undefined
      }
    }
  }
}

/*
 * What the page split reads (lib/editPages.js), and nothing more, so the
 * file stays small: of a page's rows its knob rows ('parameters') and its
 * mixer rows, and of their controls only those this block owns, each as
 * [paramId, caption] with a 1 after it for a meter; and from every other
 * row its meters alone, which the split looks for on every row ('x'). A control turning another
 * block's setting (`crossBlock`, or a name that is not this family's) is
 * never matched by the page split, so it is not carried; nor is one with no
 * setting behind it, or one only older firmware shows (ForgeFX's
 * pruneControlsByFw drops those before a page is shown).
 */
const SECTIONS = { parameters: 'p', mixer: 'm' }
const ownControl = (c, family) => c && c.paramId != null && c.fw?.lt == null && !c.crossBlock && !(c.paramName && !String(c.paramName).startsWith(`${family}_`))
function trimPage(p, family) {
  const rows = []
  for (const r of p.rows || []) {
    const section = SECTIONS[r.section] ?? 'x'
    const controls = (r.controls || [])
      .filter((c) => ownControl(c, family) && (section !== 'x' || c.widget === 'meter'))
      .map((c) => (c.widget === 'meter' ? [c.paramId, c.label ?? '', 1] : [c.paramId, c.label ?? '']))
    if (controls.length) rows.push([section, controls])
  }
  const out = { name: p.name, rows }
  if (p.fw && (p.fw.lt != null || p.fw.gtet != null)) out.fw = { ...(p.fw.lt != null ? { lt: p.fw.lt } : {}), ...(p.fw.gtet != null ? { gtet: p.fw.gtet } : {}) }
  if (p.selectorParamName != null) out.selectorParamName = p.selectorParamName
  if (p.value != null) out.value = p.value
  return out
}
/*
 * The variants a block can ever be shown, as ForgeFX picks one: a variant
 * keyed to model numbers, for those models; else, among the ones keyed to
 * none, the pinned one or the first; else, of them all, the pinned one or the
 * first. An amp ships every firmware's layout keyed to none, with one pinned:
 * only that one is ever shown, so only that one is carried.
 */
function reachable(variants) {
  const keyed = variants.filter((v) => v.value != null)
  const open = variants.filter((v) => v.value == null)
  const fallback = open.length ? open.find((v) => v.pinned) ?? open[0] : variants.find((v) => v.pinned) ?? variants[0]
  return variants.filter((v) => keyed.includes(v) || v === fallback)
}
/*
 * Variants keyed to models whose pages come out the same, carried once with
 * their model numbers joined: a Drive's forty models have a handful of page
 * sets between them. The phone reads only the pages (and the family), so a
 * model picks the same pages either way.
 */
function sharePages(variants) {
  const out = []
  for (const v of variants) {
    const same = v.value != null && out.find((o) => o.value != null && !o.pinned && !v.pinned && JSON.stringify(o.pages) === JSON.stringify(v.pages) && JSON.stringify(o.fw) === JSON.stringify(v.fw))
    if (same) same.value = `${same.value},${v.value}`
    else out.push({ ...v })
  }
  return out
}
function trimVariant(v, family) {
  const out = { name: v.name, value: v.value ?? null, pages: (v.pages || []).map((p) => trimPage(p, family)) }
  if (v.fw) out.fw = v.fw
  if (v.pinned) out.pinned = true
  return out
}

const UNITS = ['fm3', 'fm9', 'axefx3']

function main() {
  const codec = process.argv[2] || process.env.FORGEFX_MIDI
  if (!codec) throw new Error('Name the forgefx-midi checkout: node scripts/gen3-knobs.mjs <path> [fm3|fm9|axefx3 ...]')
  const asked = process.argv.slice(3)
  for (const u of asked) if (!UNITS.includes(u)) throw new Error(`${u} is not one of ${UNITS.join(', ')}`)
  const lock = JSON.parse(readFileSync(join(root, 'desktop', 'forgefx.lock.json'), 'utf8'))
  const pinned = lock['forgefx-midi'].commit
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: codec, encoding: 'utf8' }).trim()
  if (head !== pinned) throw new Error(`The codec at ${codec} is on ${head}, not the pinned ${pinned} (desktop/forgefx.lock.json).`)
  const at = (p) => import(pathToFileURL(join(codec, 'dist', ...p.split('/'), 'index.js')).href)
  return Promise.all([at('gen3/fm3'), at('gen3/fm9'), at('gen3/axe-fx-iii'), at('devices/gen3')]).then(([fm3, fm9, axe3, gen3]) => {
    const all = profiles({ fm3, fm9, axe3 })
    for (const unit of asked.length ? asked : UNITS) write({ unit, P: all[unit], axe3, gen3, pinned })
  })
}

function write({ unit, P, axe3, gen3, pinned }) {
  const { params, ranges, sections, prefix } = P
  const meta = Object.fromEntries(gen3.effectRoster().map((e) => [e.slug, { name: e.name, page: e.page }]))

  /* Every effect id the codec names, with its slug, family, name and palette page (ForgeFX blockParams' opening lines). */
  const blocks = {}
  for (let eid = 1; eid < 1024; eid++) {
    const slug = gen3.slugForEffectId(eid) ?? ''
    const family = SLUG_FAMILY[slug.toLowerCase()] ?? P.familyByEid[eid]
    if (!slug || !family || !params[family]) continue
    blocks[eid] = [slug, family, meta[slug]?.name ?? family, meta[slug]?.page ?? -1]
  }
  const families = [...new Set(Object.values(blocks).map((b) => b[1]))].sort()

  const out = {}
  for (const family of families) {
    const defs = params[family] ?? []
    const r = ranges[family] ?? {}
    const typeId = paramIdOf(defs, family, 'type')
    /* ForgeFX blockParams' knob rule, and #display's scale for each. */
    const seen = new Set()
    const knobs = []
    for (const p of defs) {
      const range = r[p.paramId]
      if (range?.kind !== 'float') continue
      if (!KNOB_UNITS.has(p.unit ?? '')) continue
      if (/bypass/i.test(p.displayLabel ?? p.name)) continue
      if (range.displayMin === range.displayMax) continue
      if (seen.has(p.paramId)) continue
      seen.add(p.paramId)
      const usable = Number.isFinite(range.displayMin) && Number.isFinite(range.displayMax) && range.displayMin !== range.displayMax
      let log = false
      if (range.taper) log = range.taper === 'log' && range.displayMin > 0
      else {
        const nib = (range.typecode >> 4) & 0xf
        log = (nib === 4 || nib === 5) && range.displayMin > 0
      }
      /* The first def at this number gives the unit, as #display finds it. */
      const unitCode = defs.find((x) => x.paramId === p.paramId)?.unit
      const unitShown = range.unit ?? ((unitCode && UNIT_LABEL[unitCode]) || null)
      /* One whose range cannot be drawn is shown 0 to 10 by #display: the row says so by carrying no range. */
      knobs.push(usable ? [p.paramId, labelOf(p), range.displayMin, range.displayMax, log ? 1 : 0, unitShown] : [p.paramId, labelOf(p)])
    }
    /* ForgeFX blockParams' switch rule, and #enumOptions' labels: the profile's own, then the codec's overlay, then the number. */
    const switches = []
    for (const p of defs) {
      const range = r[p.paramId]
      if (range?.kind !== 'enum' || p.paramId === typeId) continue
      if (range.displayMax <= range.displayMin) continue
      if (/^bypass$/i.test(p.displayLabel ?? p.name)) continue
      const min = Math.round(range.displayMin)
      const max = Math.round(range.displayMax)
      const own = P.enumLabelsFor(family, p.paramId)
      const ov = axe3.resolveEnumValues(p.name)
      const labels = []
      for (let v = min; v <= max && labels.length < 128; v++) labels.push(own?.[v] ?? ov?.values?.[v] ?? String(v))
      switches.push([p.paramId, labelOf(p), min, max, labels])
    }
    /* The settings the editor's pages are chosen by, by the names the pages use (#paramId). */
    const selectors = {}
    for (const v of P.layouts[family]?.variants || []) {
      for (const pg of v.pages || []) {
        if (pg.selectorParamName == null || pg.selectorParamName in selectors) continue
        const pid = paramIdOf(defs, family, pg.selectorParamName)
        if (pid != null) selectors[pg.selectorParamName] = pid
      }
    }
    out[family] = { stride: sections[family]?.stride ?? null, typeId: typeId ?? null, knobs, switches, selectors }
  }

  /*
   * The profile's rosterFor: the models for each slug, with what each is
   * based on. A number the unit's list skips (a III read roster can) stays a
   * hole, written null, so every model keeps its place: the read takes a
   * model by its place in the list, as the computer does.
   */
  const rosters = {}
  for (const b of Object.values(blocks)) {
    const slug = b[0].toLowerCase()
    if (rosters[slug]) continue
    const list = P.rosterFor(slug) || []
    rosters[slug] = Array.from({ length: list.length }, (_, i) => {
      const m = list[i]
      return m ? [m.value, m.name, m.manufacturer ?? null, m.basedOn ?? null] : null
    })
  }

  const pages = {}
  for (const family of families) {
    const l = P.layouts[family]
    if (!l) continue
    pages[family] = { editorName: l.editorName, family: l.family, variants: sharePages(reachable(l.variants || []).map((v) => trimVariant(v, l.family ?? family))) }
  }

  const lines = []
  lines.push('/* Generated by scripts/gen3-knobs.mjs from forgefx-midi, the codec the')
  lines.push(' * computer app carries (desktop/forgefx.lock.json), by ForgeFX\'s own rules')
  lines.push(` * for which settings are knobs on the ${P.name}. Do not edit: run the script on the`)
  lines.push(` * pinned codec. A test holds ${prefix}_KNOBS_FROM to the lock. */`)
  lines.push('')
  lines.push(`export const ${prefix}_KNOBS_FROM = '${pinned}'`)
  lines.push('')
  lines.push(`/* Each effect id the ${P.name} has: [slug, family, name, palette page]. */`)
  lines.push(`export const ${prefix}_BLOCKS = ${JSON.stringify(blocks)}`)
  lines.push('')
  lines.push('/*')
  lines.push(' * Each family: its per-channel stride, its model setting, its knobs')
  lines.push(' * ([id, label, min, max, log, unit], or [id, label] where the range cannot')
  lines.push(' * be drawn), its switches ([id, label, min, max, option labels]) and the')
  lines.push(' * settings its pages are chosen by.')
  lines.push(' */')
  lines.push(`export const ${prefix}_FAMILIES = {`)
  for (const [family, f] of Object.entries(out)) lines.push(`  ${family}: ${JSON.stringify(f)},`)
  lines.push('}')
  lines.push('')
  lines.push('/* The models each slug offers: [value, name, maker, based on], null where the list skips a number. */')
  lines.push(`export const ${prefix}_ROSTERS = ${JSON.stringify(rosters)}`)
  lines.push('')
  lines.push(`/* ${P.editor}'s pages for each family, trimmed to what the phone reads (lib/gen3-edit.js). */`)
  lines.push(`export const ${prefix}_PAGES = ${JSON.stringify(pages)}`)
  lines.push('')
  const target = targetOf(unit)
  writeFileSync(target, lines.join('\n'))
  const size = readFileSync(target).length
  console.log(`wrote ${target}: ${Object.keys(blocks).length} effect ids, ${families.length} families, ${(size / 1024).toFixed(0)} KB (pages ${(JSON.stringify(pages).length / 1024).toFixed(0)} KB)`)
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err)
  process.exit(1)
})
