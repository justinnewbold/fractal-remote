#!/usr/bin/env node
/**
 * What the phone needs of the computer app's own tables to do, over
 * Bluetooth or a unit's USB cable, what the computer does for an FM3, FM9 or
 * Axe-Fx III beyond knobs: modifiers, a cab picked by name, and the
 * Footswitches page.
 *
 * Through the computer each of these is answered by ForgeFX from its
 * profile for the unit (server/src/devices.ts PROFILES) and its gen-3
 * driver (server/src/drivers/gen3.ts). Over Bluetooth the phone carries the
 * answers, and this writes them: mobile/src/lib/gen3-tools.js.
 *
 * NOTHING HERE IS RE-DERIVED. ForgeFX's own devices.ts and gen3.ts are
 * bundled as they are and RUN: the modifier model is the driver's
 * modifierModel(), the footswitch model the profile's fcModel, the cab
 * picker's settings and lists the driver's own cabState() asked with no
 * unit behind it (which is how it answers its option lists), the IR names
 * the profile's cabIrs(). So the file holds answers, not rules.
 *
 * FROM THE ENGINE AND THE CODEC THE COMPUTER APP CARRIES, and no others: the
 * pinned commits in desktop/forgefx.lock.json, checked here and written into
 * the file, where a test holds them to the lock.
 *
 * AND WHAT FORGEFX'S OWN DRIVER DOES WITH A UNIT, FOR THE TEST TO HOLD THE
 * PHONE TO: test/gen3-tools-engine.json. The same bundled driver is run
 * against a pretend unit with fixed contents (PRETEND, below) through a
 * fixed list of calls (a cab's state, a modifier slot read, a modifier
 * attached, and on an FM3 a footswitch, the layout and view on now, and the
 * layout names), and every message it sent and every answer it gave is
 * written down. test/bluetooth.mjs puts the same contents in its own
 * pretend unit, makes the same calls of the phone's wire, and fails on a
 * message or an answer that differs.
 *
 *   node scripts/gen3-tools.mjs <forgefx checkout> <forgefx-midi checkout, built>
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'mobile', 'src', 'lib', 'gen3-tools.js')
const engineTarget = join(root, 'test', 'gen3-tools-engine.json')
const UNITS = [
  ['fm3', 0x11],
  ['fm9', 0x12],
  ['axefx3', 0x10]
]
/* The first Cab block: the driver answers its option lists for any cab. */
const CAB = 62
/* gen3.ts FC_SWITCH_SETS: the unit's own switches and two FC controllers. */
const FC_SWITCH_SETS = 3

/*
 * THE PRETEND UNIT'S CONTENTS, the same for every unit: which channel the
 * Cab is on, the Cab block's values (four channels of `cabCount`, by place;
 * the unit's own count is all four together),
 * one modifier slot's values, and the footswitch setup's values by setting
 * (everything else nought). Chosen to walk every branch of the driver's
 * rules: a mode on DynaCab, a bank with names and one without, an IR past
 * a short bank's end, a DynaCab kept scaled to 16 bits, a label, a pick of
 * each verified kind, a layout name with a space, one that is not text.
 */
export const PRETEND = {
  cab: 62,
  cabChannel: 1,
  cabCount: 106,
  cabValues: { 31: 1, 0: 3, 4: 57, 1: 2, 5: 700, 85: 11, 86: 65534 },
  slot: 5,
  slotCount: 16,
  slotValues: { 0: 12, 1: 6553, 2: 58981, 8: 58, 9: 7 },
  bind: { slot: 5, targetEffectId: 58, targetParam: 7, source: 12 },
  fcSwitch: { layout: 0, view: 1, switch: 2 }
}

/* The footswitch setup's values for the pretend unit, worked out from the unit's own model so they land on real fields. */
function pretendFc(profile, pidOf) {
  const m = profile.fcModel
  const out = {}
  if (!m?.liveState) return out
  const { layout, view, switch: sw } = PRETEND.fcSwitch
  const config = layout * m.configsPerLayout + view * m.switches + sw
  const at = (field, i = 0) => m.fields[field].base + config * m.fields[field].stride + i
  const withSlots = (cat, type) => (m.functions?.[cat] ?? []).find((d) => d.slots.length && (!type || d.slots.some((x) => x.type === type)))
  const scene = withSlots(3)
  const effect = withSlots(4, 'block')
  out[at('tapCategory')] = 3
  out[at('tapFunction')] = scene.ord
  out[at('tapDisplay')] = 2
  out[at('holdCategory')] = 4
  out[at('holdFunction')] = effect.ord
  out[at('color')] = 5
  for (const sl of scene.slots) out[at('tapParams', sl.i)] = 2 + sl.i
  for (const sl of effect.slots) out[at('holdParams', sl.i)] = sl.type === 'block' ? 58 : 1
  ;[...'SOLO'].forEach((c, i) => (out[at('tapLabel', i)] = c.charCodeAt(0)))
  out[pidOf('FC_PARAM_CUR_LAYOUT_FC1')] = 2
  out[pidOf('FC_PARAM_CUR_WINDOW_FC1')] = 1
  out[pidOf('FC_PARAM_CUR_LAYOUT_FC2')] = 99
  const base = pidOf('FC_LAYOUT_NAME_BEGIN')
  ;[...'MY SONGS'].forEach((c, i) => (out[base + i] = c.charCodeAt(0)))
  ;[...'B'].forEach((c, i) => (out[base + m.layoutNameStride + i] = c.charCodeAt(0)))
  out[base + 2 * m.layoutNameStride] = 7
  return out
}

/* A pretend unit as a transport: what the driver sends is written down and answered from the contents above. */
function pretendUnit(model, fc) {
  const sent = []
  const cs = (f) => f.reduce((a, b) => a ^ b, 0) & 0x7f
  const frame = (fn, payload) => {
    const f = [0xf0, 0x00, 0x01, 0x74, model, fn, ...payload]
    return [...f, cs(f), 0xf7]
  }
  const e14 = (n) => [n & 0x7f, (n >> 7) & 0x7f]
  const d14 = (b, i) => (b[i] & 0x7f) | ((b[i + 1] & 0x7f) << 7)
  const bulk = (eid, count, list) => {
    const page = (vals) => frame(0x75, [0, 0, ...vals.flatMap((v) => [v & 0x7f, (v >> 7) & 0x7f, (v >> 14) & 0x03])])
    const half = Math.ceil(list.length / 2)
    return [frame(0x74, [...e14(eid), ...e14(count)]), page(list.slice(0, half)), page(list.slice(half)), frame(0x76, [])]
  }
  const fill = (n, sparse, base = 0) => Array.from({ length: n }, (_, i) => sparse[i - base] ?? 0)
  const answer = (b) => {
    const fn = b[5]
    if (fn === 0x13) return [frame(0x13, [...e14(58), 0x40, ...e14(PRETEND.cab), 0x40 | (PRETEND.cabChannel << 1)])]
    if (fn === 0x1f) {
      const eid = d14(b, 6)
      if (eid === PRETEND.cab) return bulk(eid, PRETEND.cabCount * 4, fill(PRETEND.cabCount * 4, PRETEND.cabValues, PRETEND.cabCount * PRETEND.cabChannel))
      return bulk(eid, PRETEND.slotCount, fill(PRETEND.slotCount, PRETEND.slotValues))
    }
    if (fn === 0x01 && b[6] === 0x1b) {
      const v = fc[d14(b, 10)] ?? 0
      return [frame(0x01, [...b.slice(6, 12), v & 0x7f, (v >> 7) & 0x7f, 0, 0, 0, 0, 0, 0, 0])]
    }
    return []
  }
  const hex = (b) => b.map((x) => x.toString(16).padStart(2, '0')).join(' ')
  const request = async (bytes, opts = {}) => {
    sent.push(hex([...bytes]))
    const frames = answer([...bytes])
    /* A write is watched for a refusal and none comes; a read that nothing answers is the driver's own timeout. */
    if (!frames.length && opts.match && !opts.match([])) return []
    return frames
  }
  return {
    sent,
    transport: { label: 'pretend', kind: 'midi', slow: false, isOpen: true, open: async () => {}, close: async () => {}, send: (b) => void sent.push(hex([...b])), sendQueued: async (b) => void sent.push(hex([...b])), request, onFrame: () => () => {} }
  }
}

/* The driver run through the fixed list of calls, each with what it sent and what it answered. */
async function engineRun(f, model) {
  const profile = f.PROFILES[model]
  const pidOf = (name) => (profile.params?.FC ?? []).find((p) => p.name === name)?.paramId
  const fc = pretendFc(profile, pidOf)
  const unit = pretendUnit(model, fc)
  const driver = f.createGen3Driver(profile, { transport: async () => unit.transport, emit: () => {}, getCadence: () => ({}) })
  const mm = driver.modifierModel()
  const calls = [
    ['cabState', [PRETEND.cab]],
    ['rawBlock', [mm.effectId + PRETEND.slot - 1]],
    ['bindModifier', [PRETEND.bind.slot, PRETEND.bind.targetEffectId, PRETEND.bind.targetParam, PRETEND.bind.source]]
  ]
  if (profile.fcModel?.liveState) calls.push(['fcReadState', [PRETEND.fcSwitch.layout, PRETEND.fcSwitch.view, PRETEND.fcSwitch.switch]], ['fcReadCurrent', []], ['fcReadLayoutNames', []])
  const out = []
  for (const [call, args] of calls) {
    const from = unit.sent.length
    const answer = await driver[call](...args)
    out.push({ call, args, sent: unit.sent.slice(from), answer })
  }
  return { fc, calls: out }
}

const head = (dir) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()

export async function build(engine, codec) {
  const lock = JSON.parse(readFileSync(join(root, 'desktop', 'forgefx.lock.json'), 'utf8'))
  const pins = { forgefx: lock.forgefx.commit, codec: lock['forgefx-midi'].commit }
  if (head(engine) !== pins.forgefx) throw new Error(`ForgeFX at ${engine} is on ${head(engine)}, not the pinned ${pins.forgefx} (desktop/forgefx.lock.json).`)
  if (head(codec) !== pins.codec) throw new Error(`The codec at ${codec} is on ${head(codec)}, not the pinned ${pins.codec} (desktop/forgefx.lock.json).`)

  /* ForgeFX's own files, bundled as they are, with the codec where its imports look for it. */
  const work = mkdtempSync(join(tmpdir(), 'gen3-tools-'))
  try {
    mkdirSync(join(work, 'node_modules'), { recursive: true })
    symlinkSync(resolve(codec), join(work, 'node_modules', 'forgefx-midi'))
    const entry = join(work, 'entry.ts')
    const src = join(resolve(engine), 'server', 'src')
    writeFileSync(
      entry,
      [
        `export { PROFILES } from ${JSON.stringify(join(src, 'devices.ts'))}`,
        `export { createGen3Driver } from ${JSON.stringify(join(src, 'drivers', 'gen3.ts'))}`,
        `export { blockRefForEid, effectRoster } from 'forgefx-midi/devices/gen3'`
      ].join('\n')
    )
    const out = join(work, 'bundle.mjs')
    execFileSync(join(root, 'node_modules', '.bin', 'esbuild'), [entry, '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error'], {
      env: { ...process.env, NODE_PATH: join(work, 'node_modules') },
      stdio: 'inherit'
    })
    const f = await import(pathToFileURL(out).href)

    const banks = []
    const bankAt = (names) => {
      const key = JSON.stringify(names)
      let i = banks.findIndex((b) => b.key === key)
      if (i < 0) i = banks.push({ key, names }) - 1
      return i
    }
    const units = {}
    for (const [unit, model] of UNITS) {
      const profile = f.PROFILES[model]
      if (!profile || profile.model !== model) throw new Error(`ForgeFX has no profile for ${unit}.`)
      /* No unit behind it: every read throws, which is how cabState answers its lists with a zeroed state. */
      const nobody = () => Promise.reject(new Error('no unit: the tables alone'))
      const driver = f.createGen3Driver(profile, { transport: nobody, emit: () => {}, getCadence: () => ({}) })
      const cab = await driver.cabState(CAB)
      if (!cab || cab.error || !Array.isArray(cab.slots) || !cab.slots.length) throw new Error(`${unit}: ForgeFX gave no cab state`)
      const fcDefs = profile.params?.FC ?? []
      const pid = (name) => fcDefs.find((p) => p.name === name)?.paramId ?? null
      const sets = []
      for (let n = 1; n <= FC_SWITCH_SETS; n++) {
        const layout = pid(`FC_PARAM_CUR_LAYOUT_FC${n}`)
        const view = pid(`FC_PARAM_CUR_WINDOW_FC${n}`)
        if (layout == null || view == null) break
        sets.push([layout, view])
      }
      units[unit] = {
        model,
        mod: driver.modifierModel(),
        fc: profile.fcModel ?? null,
        fcParams: { sets, nameBegin: pid('FC_LAYOUT_NAME_BEGIN') },
        cab: {
          modeParam: cab.modeParam,
          modeOptions: cab.modeOptions,
          bankOptions: cab.bankOptions,
          dynaOptions: cab.dynaOptions,
          slots: cab.slots.map((s) => ({ slot: s.slot, bankParam: s.bankParam, irParam: s.irParam, dynaParam: s.dynaParam }))
        },
        /* GET /blocks/cab/types: the driver's blockTypes('cab'), less any number the list skips. */
        cabTypes: driver.blockTypes('cab').filter(Boolean).map((m) => ({ value: m.value, name: m.name, manufacturer: m.manufacturer ?? null, basedOn: m.basedOn ?? null })),
        irs: Object.fromEntries(Object.entries(profile.cabIrs()).map(([bank, names]) => [bank, bankAt([...names])]))
      }
    }
    /* gen3.ts blockOfEid, for a footswitch's Effect pick: every id the codec's base table knows. */
    const meta = Object.fromEntries(f.effectRoster().map((e) => [e.slug, e.name]))
    const blockOf = {}
    for (let eid = 0; eid < 1024; eid++) {
      const ref = f.blockRefForEid(eid)
      if (ref) blockOf[eid] = [ref.slug, ref.instance, `${meta[ref.slug] ?? ref.slug} ${ref.instance}`]
    }
    const ran = { pins, pretend: PRETEND, units: {} }
    for (const [unit, model] of UNITS) ran.units[unit] = await engineRun(f, model)
    return { pins, units, banks: banks.map((b) => b.names), blockOf, engine: ran }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

export function render({ pins, units, banks, blockOf }) {
  const line = (v) => JSON.stringify(v)
  return [
    '/* Generated by scripts/gen3-tools.mjs from ForgeFX and forgefx-midi at the',
    ' * commits desktop/forgefx.lock.json pins. Do not edit: run the script on a',
    ' * new pin; a test holds the commits below to the lock. */',
    '',
    '/** The commits these tables were read from. */',
    `export const TOOLS_FROM = ${line(pins)}`,
    '',
    '/** The cab IR names, one list per distinct bank; a unit names its banks by their place here (GEN3_TOOLS[unit].irs). */',
    'export const IR_BANKS = [',
    ...banks.map((names, i) => `  ${line(names)}${i < banks.length - 1 ? ',' : ''}`),
    ']',
    '',
    '/** A block by its effect id, for a footswitch’s Effect pick: [slug, instance, name] (ForgeFX gen3.ts blockOfEid). */',
    `export const BLOCK_OF = ${line(blockOf)}`,
    '',
    '/**',
    ' * Each unit’s own: `mod` is ForgeFX’s answer to GET /mod/model, `fc` its',
    ' * answer to GET /fc/model, `fcParams` the settings its footswitch reads',
    ' * ask by name, `cab` the cab picker’s settings and lists as its cabState',
    ' * gives them, `cabTypes` its answer to GET /blocks/cab/types, `irs` its IR',
    ' * banks by name.',
    ' */',
    'export const GEN3_TOOLS = {',
    ...Object.entries(units).map(([unit, u], i, all) => `  ${unit}: ${line(u)}${i < all.length - 1 ? ',' : ''}`),
    '}',
    ''
  ].join('\n')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [engine, codec] = process.argv.slice(2)
  if (!engine || !codec) {
    console.error('usage: node scripts/gen3-tools.mjs <forgefx checkout> <forgefx-midi checkout, built>')
    process.exit(2)
  }
  const built = await build(engine, codec)
  const made = render(built)
  writeFileSync(target, made)
  console.log(`wrote ${target} (${made.length} bytes)`)
  writeFileSync(engineTarget, `${JSON.stringify(built.engine, null, 1)}\n`)
  console.log(`wrote ${engineTarget}`)
}
