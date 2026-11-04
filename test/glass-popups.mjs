/**
 * Frosted glass on the phone: the sheets and the pop-ups.
 *
 * "As far as the real iPhone liquid glass, let's wait on that, but let's go
 * ahead and do the other one with the frosted glass look." (3 November 2026.)
 * The bottom sheets, the tuner, the volume, the tempo box and the password
 * box are glass now: a fill that reads with no help from a blur, a soft rim,
 * a light along the top edge and a soft shadow. Only material, shape, light
 * and shadow: every size, word, control and behaviour is as it was, and no
 * new blur, no new pop-up and no new import came with it.
 *
 * These hold what each one is drawn with, that the tuner and the volume keep
 * Justin's nearly solid backdrop, that nothing inside a sheet or a pane casts
 * a drop shadow of its own, that the Looper (run on a bench with its imports
 * swapped, test/vp4-safety.mjs) imports exactly what it did, and that every
 * word on them reads at 4.5:1 or better in Dark and Light, see-through and
 * solid, over anything from black to white behind, with no credit for a blur
 * (Android draws none).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { contrast, mix } from '../mobile/src/lib/ink.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* The file with its comments taken out and its white space run together. */
const flat = (p) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\s+/g, ' ')

const SHEET = 'mobile/src/components/Sheet.js'
const TUNER = 'mobile/src/components/Tuner.js'
const VOLUME = 'mobile/src/components/Volume.js'
const TEMPO = 'mobile/src/components/TempoBox.js'
const PASSWORD = 'mobile/src/components/PasswordBox.js'
const LOOPER = 'mobile/src/components/Looper.js'
const SIX = [SHEET, TUNER, VOLUME, TEMPO, PASSWORD, LOOPER]

/* Every shadow each file casts, in order: the panel's or the pane's, and the Sheet's ✕. Nothing else. */
const SHADOWS = {
  [SHEET]: ['color.sheetLift', 'color.glassLiftRing'],
  [TUNER]: ['color.glassLift'],
  [VOLUME]: ['color.glassLift'],
  [TEMPO]: ['color.glassLift'],
  [PASSWORD]: ['color.glassLift'],
  [LOOPER]: ['color.glassTop']
}

/* The Looper's imports, word for word: the bench swaps each of these for a stand-in. */
const LOOPER_IMPORTS = [
  "import { useEffect, useRef, useState } from 'react'",
  "import { AppState, Text, View } from 'react-native'",
  "import { color, font, radius, space } from '../lib/theme'",
  "import { looperControl, looperTelemetry, vp4Here } from '../lib/device'",
  "import { VP4_NO_LOOPER } from '../lib/vp4-safety'",
  "import { thud, tick } from '../lib/feedback'",
  "import { useRig } from '../lib/rig'",
  "import { tapDeadline } from '../lib/relay-rules'",
  "import { IDLE_LATCH, LOOPER_LABEL, LOOPER_ROWS, PRESS_MS, STOP_EVERYTHING, TELEMETRY_MISSES, TELEMETRY_MS, isToggle, looperKey, looperStatus, looperTap, readTelemetry, waveBars } from '../lib/looper'",
  "import Note from './Note'",
  "import Press from './Press'"
]

/* One palette block of theme.js, by name, as { key: value }. */
const theme = read('mobile/src/lib/theme.js')
const block = (name) => {
  const m = theme.match(new RegExp(`\\nconst ${name} = \\{([\\s\\S]*?)\\n\\}`))
  assert.ok(m, `theme.js has no ${name} block`)
  return Object.fromEntries([...m[1].matchAll(/^ {2}([a-zA-Z]+): '([^']*)'/gm)].map((x) => [x[1], x[2]]))
}

/* A fill drawn over what is under it: 'rgba(r, g, b, a)' mixed in, a '#rrggbb' drawn whole. */
const over = (fill, under) => {
  const m = /^rgba\((\d+), (\d+), (\d+), (0|1|0?\.\d+)\)$/.exec(fill)
  if (!m) {
    assert.match(fill, /^#[0-9a-f]{6}$/i, `${fill} is not a colour this check can read`)
    return fill
  }
  const hex = `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`
  return mix(under, hex, Number(m[4]))
}

export function run(test) {
  test('glass: a sheet is frosted glass over a dim, edge to edge as it was, with a round glass ✕', () => {
    const src = read(SHEET)
    const sheet = flat(SHEET)
    /* Still one blur, the backdrop, as it was, with the dim under it that Android's flat blur does not give. */
    assert.equal((src.match(/<BlurView\b/g) || []).length, 1, 'the sheet has another blur')
    assert.match(sheet, /<BlurView intensity=\{60\} tint="dark" experimentalBlurMethod="dimezisBlurView" style=\{\{ flex: 1, justifyContent: 'flex-end', backgroundColor: color\.scrim \}\} >/, 'the sheet’s backdrop is not the blur over the dim')
    /* The panel: the sheet's fill, the rim on every side it had a border, and the light along its top with the shadow cast up. */
    const from = sheet.indexOf('onPress={() => {}}')
    const panel = sheet.slice(from, sheet.indexOf('paddingBottom: Math.max(bottom, FOOT_AT_LEAST)', from))
    assert.ok(from > 0 && panel.length > 0, 'the sheet’s panel moved; this check reads it')
    assert.match(panel, /maxHeight: highest, backgroundColor: color\.sheetFill, borderTopLeftRadius: radius\.lg \* 2, borderTopRightRadius: radius\.lg \* 2, borderTopWidth: 1, borderColor: color\.glassRim, boxShadow: color\.sheetLift, $/, 'the sheet’s panel is not frosted glass, or its corners or edges changed')
    assert.doesNotMatch(sheet, /color\.chassis|rgba\(255,255,255,0\.14\)/, 'the sheet is still drawn in the old opaque chassis and white rim')
    /* The grabber the size it was, in its own colour; the title row's rule the glass's rim. */
    assert.match(sheet, /<View style=\{\{ width: 44, height: 5, borderRadius: 3, backgroundColor: color\.grabber \}\} \/>/, 'the grabber changed size or is not the glass’s')
    assert.match(sheet, /paddingVertical: space\.md, borderBottomWidth: 1, borderBottomColor: color\.glassRim \}\}/, 'the title row’s rule is not the rim')
    /* The ✕: 44 round as it was, frosted, darker when pressed, its rim a ring inside it so it is still 44. */
    assert.match(sheet, /accessibilityLabel="Close" onPress=\{onClose\} style=\{\(\{ pressed \}\) => \(\{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed \? color\.glassFillHi : color\.glassFill, boxShadow: color\.glassLiftRing \}\)\}/, 'the sheet’s ✕ is not a 44-point disc of glass')
    assert.doesNotMatch(sheet, /color\.panelHi|backgroundColor: color\.panel\b/, 'the ✕ is still the old panel')
  })

  test('glass: the tuner and the volume keep their nearly solid backdrop, and their panes are opaque glass', () => {
    for (const file of [TUNER, VOLUME]) {
      const src = read(file)
      const body = flat(file)
      assert.equal((src.match(/<BlurView\b/g) || []).length, 1, `${file} has another blur`)
      /* Justin's choice: the screen behind goes almost black, and nothing else is laid over it. */
      assert.match(body, /<BlurView intensity=\{70\} tint="dark" experimentalBlurMethod="dimezisBlurView" style=\{\{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space\.xl, \.\.\.sides, backgroundColor: tint\(color\.chassis, 0\.94\) \}\} >/, `${file} lost its nearly solid backdrop`)
      assert.doesNotMatch(body, /color\.scrim/, `${file} lays the sheets’ dim over its own backdrop`)
      assert.doesNotMatch(body, /rgba\(255,255,255,0\.14\)/, `${file} still has the old white rim`)
    }
    /* The panes keep their own opaque panel, corner and border width; the rim and the lift are the glass's. */
    assert.match(flat(TUNER), /paddingHorizontal: space\.lg, borderRadius: radius\.lg \* 2, borderWidth: 1, borderColor: color\.glassRim, boxShadow: color\.glassLift, backgroundColor: color\.panel, overflow: 'hidden' \}\}/, 'the tuner’s pane is not opaque glass')
    assert.match(flat(VOLUME), /paddingHorizontal: space\.lg, borderRadius: radius\.lg \* 2, borderWidth: 1, borderColor: color\.glassRim, boxShadow: color\.glassLift, backgroundColor: color\.panel \}\}/, 'the volume’s pane is not opaque glass')
    /* The meter and the slider are drawn as they were: the needle's bar, and the amber track and white knob. */
    assert.match(flat(TUNER), /height: 22, borderRadius: radius\.pill, backgroundColor: 'rgba\(0,0,0,0\.35\)', borderWidth: 1, borderColor: 'rgba\(255,255,255,0\.12\)', justifyContent: 'center' \}\}/, 'the tuner’s needle bar changed')
    assert.match(flat(VOLUME), /style=\{\{ height: TRACK, borderRadius: TRACK \/ 2, backgroundColor: tint\(color\.silk, 0\.22\) \}\}/, 'the volume’s track changed')
    assert.match(flat(VOLUME), /borderRadius: KNOB \/ 2, backgroundColor: '#ffffff',/, 'the volume’s knob changed')
  })

  test('glass: the tempo box and the password box are frosted panes over a dim, with wells for the fields', () => {
    for (const file of [TEMPO, PASSWORD]) {
      const src = read(file)
      const body = flat(file)
      assert.equal((src.match(/<BlurView\b/g) || []).length, 1, `${file} has another blur`)
      /* Nothing near-clear is left: the pane read dark words on a dark ground in Light. */
      for (const gone of ['rgba(255,255,255,0.04)', 'rgba(0,0,0,0.35)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.10)']) {
        assert.ok(!src.includes(gone), `${file} still draws ${gone}`)
      }
      /* The backdrop: the same blur, with the dim under it. */
      assert.match(body, /<BlurView intensity=\{70\} tint="dark" experimentalBlurMethod="dimezisBlurView" style=\{\{ flex: 1, alignItems: 'center',/, `${file} lost its blur`)
      /* The pane: the sheet's own fill, the rim and the lift, at its old corner and border width. */
      assert.match(body, /borderRadius: radius\.lg \* 2, borderWidth: 1, borderColor: color\.glassRim, backgroundColor: color\.sheetFill, boxShadow: color\.glassLift \}\}/, `${file}’s pane is not frosted glass`)
    }
    const tempo = flat(TEMPO)
    assert.match(tempo, /\.\.\.clearSides\(insets, tight \? space\.lg : space\.xl\), backgroundColor: color\.scrim \}\}/, 'the tempo box’s backdrop has no dim')
    /* The field: a well, with its live and fault borders as they were. */
    assert.match(tempo, /minHeight: tight \? TAP \+ 8 : TAP \+ 24, backgroundColor: color\.glassWell, borderWidth: 1, borderColor: error \? color\.fault : color\.live, borderRadius: radius\.md,/, 'the tempo field is not a well, or lost its border')
    assert.equal((tempo.match(/color\.glassWell/g) || []).length, 1)
    assert.match(tempo, /<View style=\{\{ borderTopWidth: 1, borderTopColor: color\.glassRim, paddingTop: tight \? space\.sm : space\.md \}\}>/, 'the tempo box’s divider is not the rim')
    const password = flat(PASSWORD)
    assert.match(password, /paddingTop: Math\.max\(space\.xxl, height \* 0\.1\), \.\.\.clearSides\(insets, space\.xl\), backgroundColor: color\.scrim \}\}/, 'the password box’s backdrop has no dim')
    /* Both fields come from one box(), a well with its live and fault borders as they were. */
    assert.match(password, /const box = \(bad\) => \(\{ minHeight: TAP, backgroundColor: color\.glassWell, borderWidth: 1, borderColor: bad \? color\.fault : color\.live, borderRadius: radius\.md,/, 'the password fields are not wells, or lost their border')
    assert.equal((password.match(/style=\{box\(/g) || []).length, 2, 'a password field is drawn some other way')
  })

  test('glass: the Looper is flat glass inside its sheet, and imports exactly what the bench swaps', () => {
    const src = read(LOOPER)
    /* The bench (test/vp4-safety.mjs) swaps each import for a stand-in: a new one, or a changed one, has none. */
    const imports = [...src.matchAll(/^import [\s\S]*?from '[^']+'$/gm)].map((m) => m[0].replace(/\s+/g, ' ').replace(/\{ /g, '{ ').replace(/, \}/g, ' }'))
    assert.deepEqual(imports, LOOPER_IMPORTS, 'the Looper imports something new or something else, which the bench has no stand-in for')
    assert.doesNotMatch(src, /\bglass(Card|Control|Sheet|Pane|Field|Lit|Float)\(|GlassCard|GlassDisc/, 'the Looper reaches for a builder it cannot import')
    /* A card with no side bar: the card's corner, the rim on its border, the frosted fill and the light along its top, no drop. */
    assert.match(flat(LOOPER), /gap: space\.sm, padding: space\.md, borderRadius: radius\.card, borderWidth: 1, borderColor: color\.glassRim, backgroundColor: color\.glassFill, boxShadow: color\.glassTop \}\}/, 'the Looper’s card is not flat glass')
    assert.doesNotMatch(src, /color\.rule\b,\s*backgroundColor: color\.panel/, 'the Looper’s card is still the old panel')
  })

  test('glass: nothing inside a sheet or a pane casts a shadow of its own, nothing see-through has elevation, and nothing is built once', () => {
    for (const file of SIX) {
      const body = flat(file)
      /* Every shadow is a glass token, read when drawn, and only where it belongs. */
      const shadows = [...body.matchAll(/boxShadow: ([^,}]+?)\s*[,}]/g)].map((m) => m[1].trim())
      assert.deepEqual(shadows, SHADOWS[file], `${file} casts a shadow where it should not, or a hand-written one`)
      /* No elevation on a see-through fill (it shows through): only the volume's opaque white knob has one. */
      const lifts = [...body.matchAll(/elevation: \d+/g)]
      if (file === VOLUME) {
        assert.equal(lifts.length, 1)
        assert.match(body, /backgroundColor: '#ffffff', transform: \[\{ scale: dragging \? 1\.12 : 1 \}\], shadowColor: '#000', shadowOpacity: 0\.35, shadowRadius: 4, shadowOffset: \{ width: 0, height: 2 \}, elevation: 4/, 'an elevation is on something other than the volume’s white knob')
      } else {
        assert.equal(lifts.length, 0, `${file} has an elevation`)
      }
      /* Read when drawn: no style that reads a colour at load, and nothing memoised. */
      assert.doesNotMatch(read(file), /^\S.*\bcolor\./m, `${file} reads a colour at load, so a change of look or Reduce Transparency does not repaint it`)
      assert.doesNotMatch(read(file), /useMemo|StyleSheet\.create|\bmemo\(/, `${file} keeps a style from an earlier paint`)
      assert.doesNotMatch(read(file), /BlurTargetView|blurTarget/, `${file} uses a blur target`)
    }
  })

  test('glass: every word on a sheet, a pane and the Looper reads at 4.5:1 with no credit for a blur, in Dark and Light, see-through and solid', () => {
    const solid = { DARK: block('SOLID_DARK'), LIGHT: block('SOLID_LIGHT') }
    for (const mode of ['DARK', 'LIGHT']) {
      for (const drawn of ['see-through', 'solid']) {
        const c = { ...block(mode), ...(drawn === 'solid' ? solid[mode] : null) }
        /* Anything from black to white behind the dim: a white or a black scene tile, the chassis. */
        for (const behind of ['#ffffff', '#000000', c.chassis]) {
          const where = `${mode} ${drawn}, over ${behind}`
          const sheet = over(c.sheetFill, over(c.scrim, behind))
          /* The sheet's title and note, and what the sheets hold. */
          for (const ink of ['silk', 'silkDim', 'silkFaint', 'fault']) assert.ok(contrast(c[ink], sheet) >= 4.5, `${ink} on a sheet, ${where}: ${contrast(c[ink], sheet).toFixed(2)}`)
          /*
           * The ✕'s glyph on its disc and the Looper's words on its card
           * inside the sheet; and the ✕ pressed, the one thing here drawn on
           * the pressed fill, whose glyph is silkDim. (silkFaint is never
           * drawn on a pressed fill in a sheet: over a white screen in Dark
           * it would be 4.33.)
           */
          for (const [fill, inks] of [['glassFill', ['silk', 'silkDim', 'silkFaint']], ['glassFillHi', ['silk', 'silkDim']]]) {
            const card = over(c[fill], sheet)
            for (const ink of inks) assert.ok(contrast(c[ink], card) >= 4.5, `${ink} on ${fill} in a sheet, ${where}: ${contrast(c[ink], card).toFixed(2)}`)
          }
          assert.match(flat(SHEET), /<Text style=\{\{ color: color\.silkDim, fontSize: font\.lead \}\}>✕<\/Text>/, 'the ✕ is drawn in another ink; check it on the pressed fill')
          /* The tempo and password panes are the sheet's fill over the same dim; their fields are wells on them. */
          const well = over(c.glassWell, sheet)
          for (const ink of ['silk', 'silkFaint']) assert.ok(contrast(c[ink], well) >= 4.5, `${ink} in a field, ${where}: ${contrast(c[ink], well).toFixed(2)}`)
        }
        /* The Looper on Edit, on the plain ground. */
        const ground = over(c.glassFill, c.chassis)
        for (const ink of ['silk', 'silkDim', 'silkFaint']) assert.ok(contrast(c[ink], ground) >= 4.5, `${ink} on the Looper on Edit, ${mode} ${drawn}: ${contrast(c[ink], ground).toFixed(2)}`)
        /* The tuner and the volume keep their opaque panel. */
        for (const ink of ['silk', 'silkDim', 'silkFaint']) assert.ok(contrast(c[ink], c.panel) >= 4.5, `${ink} on the tuner’s pane, ${mode}: ${contrast(c[ink], c.panel).toFixed(2)}`)
      }
    }
  })
}
