#!/usr/bin/env node
/**
 * The AM4's knobs, for the phone to read and turn over Bluetooth.
 *
 * Over the computer, a block's knobs come from ForgeFX: it reads the block
 * off the AM4 and names each setting from the codec's catalog (forgefx-midi
 * KNOWN_PARAMS), with the editor's own pages beside them (AM4_LAYOUTS). Over
 * Bluetooth there is no computer, so the phone carries the part of that
 * catalog it needs, and this writes it: mobile/src/lib/am4-knobs.js.
 *
 * FROM THE CODEC THE COMPUTER APP CARRIES, and no other. desktop/
 * forgefx.lock.json pins forgefx-midi by commit; this refuses a codec that
 * is not on that commit, and writes the commit into the file, where a test
 * holds it to the lock. So a new pin is a new table, never a phone that names
 * a knob one way while the computer names it another.
 *
 *   node scripts/am4-knobs.mjs <forgefx-midi checkout, built>
 *
 * The checkout is the pinned commit with `npm ci && npm run build` run in it
 * (the table is read from its dist/, as the computer app reads it).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'mobile', 'src', 'lib', 'am4-knobs.js')

/*
 * The blocks the phone can open, and the editor family each one's pages are
 * filed under: ForgeFX's AM4_FAMILY_BY_BLOCK (server/src/devices.ts), name
 * for name. Not the preset or Global registers, which are not blocks.
 */
export const FAMILY_BY_BLOCK = {
  amp: 'DISTORT',
  compressor: 'COMP',
  geq: 'GEQ',
  peq: 'PEQ',
  reverb: 'REVERB',
  delay: 'DELAY',
  chorus: 'CHORUS',
  flanger: 'FLANGER',
  rotary: 'ROTARY',
  phaser: 'PHASER',
  wah: 'WAH',
  volpan: 'VOLUME',
  tremolo: 'TREMOLO',
  filter: 'FILTER',
  drive: 'FUZZ',
  enhancer: 'ENHANCER',
  gate: 'GATE'
}

/* ForgeFX's AM4_UNIT_LABEL (server/src/drivers/am4.ts), the unit a knob shows. */
const UNIT_LABEL = { db: 'dB', hz: 'Hz', ms: 'ms', seconds: 's', percent: '%', bipolar_percent: '%', degrees: '°', pf: 'pF' }

/* ForgeFX's am4ParamLabel: the catalog's own label, else the key with its underscores made spaces, each word capitalised. */
const labelOf = (p) => p.displayLabel ?? p.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/*
 * The settings that live in the preset's own register (0xCE), not the
 * block's: the amp's four channel colours. The computer reads that register
 * whole for them; the phone never asks the AM4 for it over Bluetooth, so they
 * are not carried.
 */
const PRESET_REGISTER = 0xce

/* Only what the page split and its choice of variant read (lib/am4-layout.js, ForgeFX's layoutFrom). */
function trimControl(c) {
  const out = { paramId: c.paramId, label: c.label ?? '' }
  if (c.paramName) out.paramName = c.paramName
  if (c.widget) out.widget = c.widget
  if (c.crossBlock) out.crossBlock = 1
  return out
}
/*
 * Two kinds of control are left out here because nothing on the phone could
 * ever use them: one with no setting behind it (a caption, a picture), which
 * the page split skips, and one marked for firmware below some version, which
 * ForgeFX's pruneControlsByFw drops before any page is shown.
 */
const kept = (c) => c && c.paramId != null && c.fw?.lt == null
function trimPage(p) {
  const out = { name: p.name, rows: (p.rows || []).map((r) => ({ section: r.section, controls: (r.controls || []).filter(kept).map(trimControl) })) }
  if (p.fw && (p.fw.lt != null || p.fw.gtet != null)) out.fw = { ...(p.fw.lt != null ? { lt: p.fw.lt } : {}), ...(p.fw.gtet != null ? { gtet: p.fw.gtet } : {}) }
  if (p.selectorParamName != null) out.selectorParamName = p.selectorParamName
  if (p.value != null) out.value = p.value
  return out
}
function trimVariant(v) {
  const out = { name: v.name, value: v.value ?? null, pages: (v.pages || []).map(trimPage) }
  if (v.fw) out.fw = v.fw
  if (v.pinned) out.pinned = true
  return out
}

function main() {
  const codec = process.argv[2] || process.env.FORGEFX_MIDI
  if (!codec) throw new Error('Name the forgefx-midi checkout: node scripts/am4-knobs.mjs <path>')
  const lock = JSON.parse(readFileSync(join(root, 'desktop', 'forgefx.lock.json'), 'utf8'))
  const pinned = lock['forgefx-midi'].commit
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: codec, encoding: 'utf8' }).trim()
  if (head !== pinned) throw new Error(`The codec at ${codec} is on ${head}, not the pinned ${pinned} (desktop/forgefx.lock.json).`)
  return import(pathToFileURL(join(codec, 'dist', 'am4', 'index.js')).href).then((am4) => write(am4, pinned))
}

function write(am4, pinned) {
  const all = Object.values(am4.KNOWN_PARAMS)
  const blocks = {}
  for (const block of Object.keys(FAMILY_BY_BLOCK)) {
    const own = all.filter((p) => p.block === block && p.pidLow !== PRESET_REGISTER)
    if (!own.length) continue
    const reads = [...new Set(own.map((p) => p.pidLow))].sort((a, b) => a - b)
    const params = own.map((p) => {
      const row = [p.name, labelOf(p), p.pidLow, p.pidHigh, p.unit, p.displayMin, p.displayMax]
      if (p.unit === 'enum') {
        row.push(0, Object.fromEntries(Object.entries(p.enumValues || {}).map(([k, v]) => [Number(k), v])))
      } else if (p.scaling === 'log10') {
        row.push(1)
      }
      return row
    })
    blocks[block] = { reads, params }
  }
  const layouts = {}
  for (const family of new Set(Object.values(FAMILY_BY_BLOCK))) {
    const l = am4.AM4_LAYOUTS[family]
    if (!l) continue
    layouts[family] = { editorName: l.editorName, family: l.family, variants: (l.variants || []).map(trimVariant) }
  }

  const lines = []
  lines.push('/* Generated by scripts/am4-knobs.mjs from forgefx-midi, the codec the')
  lines.push(' * computer app carries (desktop/forgefx.lock.json). Do not edit: run the')
  lines.push(' * script on the pinned codec. A test holds AM4_KNOBS_FROM to the lock. */')
  lines.push('')
  lines.push(`export const AM4_KNOBS_FROM = '${pinned}'`)
  lines.push('')
  lines.push('/* What a knob shows beside its number, by the catalog\'s unit (ForgeFX AM4_UNIT_LABEL). */')
  lines.push(`export const AM4_UNIT_LABEL = ${JSON.stringify(UNIT_LABEL)}`)
  lines.push('')
  lines.push('/*')
  lines.push(' * Each block the phone can open: the registers its settings are read from')
  lines.push(' * (`reads`), and its settings in the catalog\'s order, each')
  lines.push(' * [key, label, pidLow, pidHigh, unit, displayMin, displayMax, log, enumValues].')
  lines.push(' */')
  lines.push('export const AM4_KNOBS = {')
  for (const [block, b] of Object.entries(blocks)) {
    lines.push(`  ${block}: {`)
    lines.push(`    reads: ${JSON.stringify(b.reads)},`)
    lines.push('    params: [')
    for (const row of b.params) lines.push(`      ${JSON.stringify(row)},`)
    lines.push('    ]')
    lines.push('  },')
  }
  lines.push('}')
  lines.push('')
  lines.push('/* The block each editor family\'s pages belong to (ForgeFX AM4_FAMILY_BY_BLOCK). */')
  lines.push(`export const AM4_FAMILY_BY_BLOCK = ${JSON.stringify(FAMILY_BY_BLOCK)}`)
  lines.push('')
  lines.push('/* AM4-Edit\'s pages for each family, trimmed to what the phone reads (lib/am4-layout.js). */')
  lines.push(`export const AM4_PAGES = ${JSON.stringify(layouts)}`)
  lines.push('')
  writeFileSync(target, lines.join('\n'))
  const size = readFileSync(target).length
  console.log(`wrote ${target}: ${Object.keys(blocks).length} blocks, ${Object.values(blocks).reduce((n, b) => n + b.params.length, 0)} settings, ${Object.keys(layouts).length} page sets, ${(size / 1024).toFixed(0)} KB`)
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
