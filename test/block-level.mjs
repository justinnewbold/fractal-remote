/**
 * A block's own Level in Edit can be typed, never below the floor.
 *
 * SASouth on the Fractal forum, 10 November 2026: "I'm interested in knowing
 * why levels in the output blocks are marked read-only. I often want to
 * tweak the volume of a preset without changing the amps gain." And Justin:
 * "Yes, do an update for that right now, please."
 *
 * mobile/src/lib/blockLevel.js is the rule (the browser's, which has typed
 * its level since long before): still out of the knobs, a box to type into,
 * decibels only, never under -20 dB and never over the level's own top.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

/** lib/blockLevel, run from a copy: it imports nothing. */
async function rule() {
  const dir = mkdtempSync(join(tmpdir(), 'block-level-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    const src = read('mobile/src/lib/blockLevel.js')
    assert.doesNotMatch(src, /^import /m, 'lib/blockLevel imports something; this check runs it on its own')
    writeFileSync(join(dir, 'blockLevel.js'), src)
    return await import(pathToFileURL(join(dir, 'blockLevel.js')).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  test('block level: the block’s own Level is the one typed, out of every setting that ends in Level', async () => {
    const r = await rule()
    /* The FM3's Output block as its table has it: rows, then its own, then scenes. */
    const output = [
      { id: 0, name: 'Row 1 Level', min: -20, max: 20, value: 0 },
      { id: 1, name: 'Row 2 Level', min: -20, max: 20, value: 0 },
      { id: 12, name: 'Level', min: -80, max: 20, value: -3 },
      { id: 13, name: 'Balance', min: -100, max: 100, value: 0 },
      { id: 18, name: 'Scene 1 Level', min: -20, max: 20, value: 0 }
    ]
    assert.equal(r.blockLevel(output).id, 12, 'the Output block’s own Level lost to a row’s or a scene’s')
    /* An amp has no setting called exactly Level on an FM3: its own is the first that ends in it. */
    const amp = [
      { id: 7, name: 'Gain', min: 0, max: 10, value: 5 },
      { id: 124, name: 'Boost Level', min: 0, max: 24, value: 0 },
      { id: 49, name: 'Input Level', min: 0, max: 10, value: 5 },
      { id: 1, name: 'Amp1 Level', min: -80, max: 20, unit: 'dB', value: -6 }
    ]
    assert.equal(r.blockLevel(amp).id, 1, 'a boost’s or an input’s level was taken for the block’s own')
    assert.equal(r.blockLevel([{ id: 7, name: 'Gain', min: 0, max: 10 }]), null)
    assert.equal(r.blockLevel(null), null)
    assert.equal(r.blockLevel(), null)
  })

  test('block level: only a level in decibels is typed, and never below the floor or over its own top', async () => {
    const r = await rule()
    const guard = read('mobile/src/lib/guardrails.js')
    assert.match(guard, new RegExp(`export const LEVEL_FLOOR_DB = ${r.LEVEL_FLOOR_DB}\\n`), 'lib/blockLevel’s floor is not lib/guardrails’')
    assert.equal(r.LEVEL_FLOOR_DB, -20)
    assert.equal(r.LEVEL_HINT, 'not below -20 dB')

    const db = { id: 1, name: 'Amp1 Level', min: -80, max: 20, unit: 'dB', value: -6 }
    assert.equal(r.levelTypes(db), true)
    assert.equal(r.levelFloor(db), -20, 'the floor is the level’s own bottom, which is silence')
    assert.equal(r.levelToSend(db, -6), -6)
    assert.equal(r.levelToSend(db, -60), -20, 'a typed -60 dB went out: a preset that looks right and is silent')
    assert.equal(r.levelToSend(db, -80), -20)
    assert.equal(r.levelToSend(db, 99), 20, 'over the level’s own top')
    assert.equal(r.levelToSend(db, '3.5'), 3.5)
    for (const not of ['', null, 'loud', NaN, undefined]) assert.equal(r.levelToSend(db, not), null, `${String(not)} was sent`)

    /* No unit said: decibels by its name, as the volume slider takes the FM3's Output Level. The AM4 says "db". */
    assert.equal(r.levelTypes({ id: 12, name: 'Level', min: -80, max: 20, value: 0 }), true)
    assert.equal(r.levelTypes({ id: 0, name: 'Level', min: -80, max: 20, unit: 'db', value: 0 }), true)
    /* A scene's level on the Output block runs -20 to 20: its own bottom is the floor. */
    assert.equal(r.levelFloor({ name: 'Scene 1 Level', min: -20, max: 20 }), -20)
    assert.equal(r.levelFloor({ name: 'Level', min: -12, max: 12 }), -12, 'a level that cannot reach the floor was given a lower one')

    /* Not decibels, no range, no room over the floor, not a level: read-only, and nothing is sent. */
    const never = [
      { id: 1, name: 'Level', min: 0, max: 100, unit: '%', value: 50 },
      { id: 1, name: 'Level', value: 0 },
      { id: 1, name: 'Level', min: -80, max: -20, unit: 'dB', value: -40 },
      { id: 1, name: 'Level', min: 5, max: 5, unit: 'dB', value: 5 },
      { id: 1, name: 'Gain', min: -80, max: 20, unit: 'dB', value: 0 },
      { id: 1, name: 'Boost Level', min: 0, max: 24, unit: 'dB', value: 0 },
      null
    ]
    for (const level of never) {
      assert.equal(r.levelTypes(level), false, `${level?.name} ${level?.unit || ''} can be typed`)
      assert.equal(r.levelToSend(level, 0), null)
    }
  })

  test('block level: Edit types it under the knobs, keeps it out of them, and sends it the knobs’ own checked way', () => {
    const edit = code(read('mobile/src/screens/Edit.js'))
    assert.match(edit, /import \{ blockLevel, levelFloor, levelToSend, levelTypes, LEVEL_HINT \} from '\.\.\/lib\/blockLevel'/)
    assert.match(edit, /const level = blockLevel\(params\)\n/)
    /* Still no knob for it: a level under a thumb is the slip the rule is about. */
    assert.match(edit, /const editable = params\.filter\(\(p\) => !isSilencingParam\(p\.name\)\)/)
    const row = edit.slice(edit.indexOf('{level && !bare ? ('), edit.indexOf('{!panel && channels?.length > 1'))
    assert.ok(row.length > 200, 'the level’s row moved; this check reads it')
    assert.match(row, /levelTypes\(level\) \? \(/, 'the box is drawn for a level that cannot be typed')
    assert.match(row, /<ValueBox\s+param=\{\{ \.\.\.level, min: levelFloor\(level\), unit: level\.unit \|\| 'dB' \}\}\s+value=\{valueOf\(level\)\}/)
    /* Held at the floor on its way out, not during an Undo, and by the knob's own write: one at a time, read back. */
    assert.match(row, /const next = levelToSend\(level, v\)\s+if \(restoring \|\| next === null\) return\s+setLocal\(\(prev\) => \(\{ \.\.\.prev, \[level\.id\]: next \}\)\)\s+commit\(level, next\)/)
    assert.match(row, /\{LEVEL_HINT\}/, 'nothing beside the box says where it stops')
    /* One that cannot be typed is still a number that says so. */
    assert.match(row, /read-only/)
    assert.doesNotMatch(row, /<Knob\b/, 'the level became a knob')
    /* Not in the hold pop-up, whose "knobs only" leaves the level out (lib/holdPop POP_LEAVES_OUT). */
    assert.ok(JSON.parse(read('mobile/src/lib/holdPop.js').match(/export const POP_LEAVES_OUT = (\[[^\]]+\])/)[1].replace(/'/g, '"')).includes('level'))
  })
}
