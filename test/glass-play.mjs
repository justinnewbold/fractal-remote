/**
 * Frosted glass on the phone: Play's chrome.
 *
 * "Let's go ahead and do the other one with the frosted glass look" (3
 * November 2026), and "I just don't wanna lose all the colors and current
 * color scheme cause I like those also." So on Play the tiles, the pedals, the
 * Looper, the headings and the preset line are content and stay as they were,
 * and what floats over them or holds a control turns to glass: the top bar
 * and its pill, the amber Exit demo, Unlock and Save, a round of glass behind
 * the speaker and the gear, the strips that hang under the bar, the six
 * buttons' strip, NOT CONNECTED and the dropped-tap note, the fault card, and
 * the three cards on the page (the channel tip, which computer, the demo's
 * offer).
 *
 * Only the material changes, never a place, a size, a word or a press, and no
 * blur is added: Play keeps the one under the top bar (lib/glass, and
 * test/glass.mjs counts them all). These hold each piece to the foundation's
 * tokens, the speaker and the gear to a thumb's 44, and every word on the new
 * glass to 4.5:1 with no credit for a blur, in Dark and Light, see-through and
 * solid.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { contrast, mix } from '../mobile/src/lib/ink.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* Code only, one space for any run of white: a JSX comment goes whole (one comment in its braces, never reaching into the next), so no `{ }` is left where one was. */
const code = (p) =>
  read(p)
    .replace(/\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ')

/* One function of a file, from its head to the next top-level function (or the end). */
const body = (text, head) => {
  const at = text.indexOf(head)
  assert.ok(at >= 0, `${head} is not there`)
  const next = text.indexOf(' function ', at + head.length)
  return text.slice(at, next < 0 ? undefined : next)
}

/* A thumb's least, as Press has it. */
const THUMB = 44

/* 'rgba(r, g, b, a)' or '#rrggbb' as a colour and how much of it is drawn. */
const paint = (value) => {
  const m = /^rgba\((\d+), (\d+), (\d+), (0|1|0?\.\d+)\)$/.exec(value)
  if (m) return { hex: `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`, a: Number(m[4]) }
  if (/^#[0-9a-f]{6}$/i.test(value)) return { hex: value.toLowerCase(), a: 1 }
  return null
}
const over = (top, ground) => {
  const p = paint(top)
  assert.ok(p, `${top} is not a colour this reads`)
  return mix(ground, p.hex, p.a)
}

/* Each mode, see-through and solid, painted by the theme itself, and put back as it was. */
async function palettes() {
  const t = await import('../mobile/src/lib/theme.js')
  const was = { mode: t.getMode(), solid: t.isSolidChrome() }
  const out = []
  try {
    for (const mode of ['dark', 'light']) {
      for (const solid of [false, true]) {
        t.setMode(mode)
        t.setSolidChrome(solid)
        out.push({ name: `${mode}${solid ? ', solid' : ''}`, c: { ...t.color } })
      }
    }
  } finally {
    t.setSolidChrome(was.solid)
    t.setMode(was.mode)
  }
  return out
}

const FILES = {
  bar: 'mobile/src/components/TopBar.js',
  stage: 'mobile/src/screens/Stage.js',
  toast: 'mobile/src/components/Toast.js',
  offer: 'mobile/src/components/UnlockOffer.js',
  coach: 'mobile/src/components/Coach.js',
  card: 'mobile/src/components/ComputerCard.js'
}

export function run(test) {
  test('glass on Play: the top bar is frosted, with its one blur and every pinned prop, and no shadow of its own', () => {
    const raw = read(FILES.bar)
    const bar = code(FILES.bar)
    /* One blur, counted in the file as written (comments too: test/glass.mjs counts them so). */
    assert.equal((raw.match(/<BlurView\b/g) || []).length, 1, 'the top bar has more than one blur, or none')
    assert.match(bar, /<BlurView accessibilityLiveRegion="polite" intensity=\{40\} tint=\{isDark\(\) \? 'dark' : 'light'\} experimentalBlurMethod="dimezisBlurView" style=\{\[\{/, 'the bar’s blur lost a prop it is pinned to')
    /* Its own style first, and over it only the slimmer padding of a phone held on its side (`slim`, test/two-sides.mjs). */
    assert.match(bar, /zIndex: 3 \}, slim \? SLIM : null\]\} >/, 'something other than the slim padding is laid over the bar’s style')
    assert.match(bar, /const SLIM = \{ paddingVertical: space\.xs \}/)
    /* The bar's own style: from the blur to where the slim padding is laid over it. */
    const style = bar.slice(bar.indexOf('<BlurView'), bar.indexOf('}, slim ? SLIM : null]}', bar.indexOf('<BlurView'))).trim()
    assert.match(style, /borderBottomWidth: 1, borderBottomColor: color\.glassRim, backgroundColor: classic\(\) \? at\(color\.panel, 0\.55\) : color\.glassBar, zIndex: 3$/, 'the bar is not the frosted bar over its soft rim (the panel at 0.55 in Classic, as it was), or its zIndex moved')
    assert.doesNotMatch(style, /boxShadow|elevation|shadow/, 'the bar casts a shadow: it is the top of the screen, not a float')
    assert.doesNotMatch(style.replace('classic() ? at(color.panel, 0.55) :', ''), /at\(color\.panel, 0\.55\)/, 'the bar is drawn from the panel again outside Classic, so the Sunlight look cannot make it solid')
    /* No new zIndex anywhere in the bar: the bar's 3, Which's 3, and the three strips' 2, all under the metronome's flash (vp4-safety.mjs). */
    assert.deepEqual([...raw.matchAll(/zIndex: (\d+)/g)].map((m) => Number(m[1])), [3, 3, 2, 2, 2], 'a zIndex was added to the bar, or moved')
  })

  test('glass on Play: the pill floats on the bar as the glass’s capsule, its edge, padding and fill as they were', () => {
    const bar = code(FILES.bar)
    assert.ok(bar.indexOf('hitSlop={6} style={({ pressed }) => ({') > 0, 'the pill’s reach or its style moved; this check reads it from there')
    const pill = bar.slice(bar.indexOf('hitSlop={6} style={({ pressed }) => ({'), bar.indexOf('})}', bar.indexOf('hitSlop={6}'))).trim()
    assert.match(pill, /paddingHorizontal: space\.sm, paddingVertical: 3, borderRadius: classic\(\) \? radius\.lg : radius\.pill, borderWidth: 1, borderColor: color\.glassRim, backgroundColor: pressed \? color\.panelHi : at\(color\.panel, 0\.6\), boxShadow: color\.glassLift$/, 'the pill is not the glass’s capsule, or its edge, padding or fill changed')
  })

  test('glass on Play: Exit demo, Unlock and Save are lit glass in amber, and keep their press', () => {
    const bar = code(FILES.bar)
    for (const [name, at, corner] of [
      ['Exit demo', 'accessibilityLabel="Exit demo"', 'radius.pill'],
      ['Unlock', 'accessibilityLabel="Unlock the full version"', 'radius.lg'],
      ['Save', 'accessibilityLabel="Save the preset"', 'radius.pill']
    ]) {
      const from = bar.indexOf(at)
      assert.ok(from > 0, `${name} is gone from the bar`)
      const style = bar.slice(bar.indexOf('style={({ pressed }) => ({', from), bar.indexOf('})}', from))
      assert.match(
        style,
        new RegExp(`borderRadius: ${corner.replace('.', '\\.')}, backgroundColor: pressed \\? color\\.signalWash : color\\.signal, boxShadow: color\\.glassLit, experimental_backgroundImage: color\\.glassSheen`),
        `${name} is not lit glass on its amber, or lost its corner or its press`
      )
    }
  })

  test('glass on Play: a round of glass behind the speaker and the gear, the icons as they were, neither reach smaller than it was', async () => {
    const { space } = await import('../mobile/src/lib/theme.js')
    const bar = code(FILES.bar)
    assert.match(bar, /import \{ GlassDisc \} from '\.\/Glass'/, 'the bar does not draw the glass disc')
    assert.equal((bar.match(/<GlassDisc /g) || []).length, 2, 'not one disc behind each of the speaker and the gear')
    /* A hit slop as each side's reach: one number for all four, or the four named. */
    const reach = (slop) => {
      if (/^\d+$/.test(slop)) return { top: +slop, bottom: +slop, left: +slop, right: +slop }
      const side = (k) => Number(new RegExp(`\\b${k}: (\\d+)`).exec(slop)?.[1] ?? NaN)
      return { top: side('top'), bottom: side('bottom'), left: side('left'), right: side('right') }
    }
    const got = {}
    for (const [name, label, icon, size, ink] of [
      ['speaker', 'Volume', 'volumeIcon', 24, 'silkDim'],
      ['gear', 'Connection and setup', 'setupIcon', 22, 'silk']
    ]) {
      /* The disc is the button's FIRST child, so the icon is drawn over it; the button has no style of its own, so the disc is centred on the icon. */
      const m = new RegExp(
        `accessibilityLabel="${label}" hitSlop=\\{(\\d+|\\{ [^}]* \\})\\} onPress=\\{[^}]*\\}\\)?\\}? > <GlassDisc size=\\{30\\} box=\\{${size}\\} \\/> <Image source=\\{${icon}\\} accessible=\\{false\\} resizeMode="contain" style=\\{\\{ width: ${size}, height: ${size}, tintColor: color\\.${ink} \\}\\} \\/> <\\/Pressable>`
      ).exec(bar)
      assert.ok(m, `the ${name} is not its own picture, at ${size}, over a disc drawn first`)
      got[name] = { size, ...reach(m[1]) }
    }
    const { speaker, gear } = got
    /* The two sit in the bar's row, the gear last, space.md apart, and the bar's own side padding after it. */
    assert.match(bar, /gap: space\.md, paddingHorizontal: space\.lg, paddingVertical: space\.sm,/, 'the bar’s gap or side padding moved, and the reaches below were worked out for them')
    const gap = space.md
    /*
     * Where the two reaches overlap, the gear has it: both phones hit-test the
     * later of two siblings first. So the speaker's width is cut where the
     * gear's reach starts. The speaker's was 10 + 24 + (12 − 10) = 36 before
     * the glass, beside a gear of 10; it is never to be less.
     */
    const speakerWide = speaker.left + speaker.size + Math.min(speaker.right, gap - gear.left)
    assert.ok(speakerWide >= 36, `the speaker reaches ${speakerWide}pt across once the gear has its overlap, under the 36 it had`)
    assert.ok(speaker.top + speaker.size + speaker.bottom >= THUMB, `the speaker is ${speaker.top + speaker.size + speaker.bottom}pt tall to a thumb, under ${THUMB}`)
    assert.ok(gear.left + gear.size + gear.right >= THUMB, `the gear is ${gear.left + gear.size + gear.right}pt across to a thumb, under ${THUMB}`)
    assert.ok(gear.top + gear.size + gear.bottom >= THUMB, `the gear is ${gear.top + gear.size + gear.bottom}pt tall to a thumb, under ${THUMB}`)
    assert.ok(gear.right <= space.lg, 'the gear reaches past the bar’s side padding')
    assert.ok(gear.left <= 10, 'the gear’s reach grew toward the speaker, and takes it from the speaker')
  })

  test('glass on Play: the strips under the bar stay opaque, with their coloured edge, and gain the glass’s lift', () => {
    const bar = code(FILES.bar)
    for (const [name, edge] of [
      ['Saved', /borderLeftWidth: 3, borderLeftColor: said\.tone === 'warn' \? color\.fault : color\.ok, backgroundColor: color\.panelHi, boxShadow: color\.glassLift,/],
      ['Late', /borderLeftWidth: 3, borderLeftColor: color\.ok, backgroundColor: color\.panelHi, boxShadow: color\.glassLift,/],
      ['Reported', /borderLeftWidth: 3, borderLeftColor: color\.fault, backgroundColor: color\.panelHi, boxShadow: color\.glassLift,/],
      ['Which', /borderBottomWidth: 1, borderBottomColor: color\.rule, backgroundColor: color\.panelHi, boxShadow: color\.glassLift \}/]
    ]) {
      const fn = body(bar, `function ${name}(`)
      assert.match(fn, /position: 'absolute', left: (0|space\.lg), right: (0|space\.lg), top: '100%', zIndex: [23],/, `${name} no longer hangs under the bar where it did`)
      assert.match(fn, edge, `${name} is not the opaque strip with its edge and the glass’s lift`)
    }
    /* The buttons on the strips are capsules of glass on them: Turn off Bluetooth and Report a problem, and the late save's Cancel. Their sizes as they were. */
    assert.match(
      body(bar, 'function Which('),
      /const button = \(\{ pressed \}\) => \(\{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: space\.lg, borderRadius: classic\(\) \? radius\.md : radius\.pill, borderWidth: 1, borderColor: color\.glassRim, backgroundColor: classic\(\) \? \(pressed \? color\.panel : color\.chassis\) : pressed \? color\.glassFillHi : color\.glassFill, boxShadow: color\.glassLift \}\)/,
      'Turn off Bluetooth and Report a problem are not glass capsules, or their size changed'
    )
    /* Three since 6 November 2026: on a USB cable, Use a Bluetooth adapter instead beside them. Four since 7 November 2026: Connect again, while the unit says nothing. */
    assert.equal((body(bar, 'function Which(').match(/style=\{button\}/g) || []).length, 4, 'not all of Which’s buttons wear it')
    assert.match(
      body(bar, 'function Late('),
      /accessibilityLabel="Cancel the save" hitSlop=\{8\} onPress=\{[^}]*\}\} style=\{\(\{ pressed \}\) => \(\{ minHeight: 36, justifyContent: 'center', paddingHorizontal: space\.md, borderRadius: classic\(\) \? radius\.md : radius\.pill, borderWidth: 1, borderColor: color\.glassRim, backgroundColor: classic\(\) \? \(pressed \? color\.panel : color\.chassis\) : pressed \? color\.glassFillHi : color\.glassFill, boxShadow: color\.glassLift \}\)\}/,
      'the late save’s Cancel is not a glass capsule, or its size or reach changed'
    )
  })

  test('glass on Play: the six buttons’ strip is the bottom bar of glass with no blur, and the floats over the tiles keep their opaque fills', () => {
    const stage = code(FILES.stage)
    assert.ok(!/<BlurView\b|expo-blur/.test(read(FILES.stage)), 'Play has a blur of its own: on an older Android phone it costs every frame')
    assert.match(
      stage,
      /* (Its own style first; over it, on a phone held on its side only, less padding over and under: `low`, test/two-sides.mjs.) */
      /\{shape\.footFixed \? \( <View style=\{\[\{ borderTopWidth: StyleSheet\.hairlineWidth, borderTopColor: color\.glassRim, backgroundColor: color\.glassBar, boxShadow: color\.glassTop, paddingTop: space\.sm, paddingBottom: tight \? space\.lg : space\.xxl \}, low \? LOW_STRIP : null\]\} >/,
      'the fixed strip is not the frosted bar under its rim with the light along its top, or gained a size or a padding'
    )
    /* NOT CONNECTED and the dropped tap: opaque over the tiles (a see-through one would fail over a white scene), with the light along the top. */
    const band = stage.slice(stage.indexOf('{down || droppedNote ? ( <View pointerEvents="none"'))
    assert.match(band.slice(0, 400), /zIndex: 1, elevation: 6 \}\}/, 'the band lost its place over the tiles')
    assert.match(band, /borderRadius: radius\.pill, borderWidth: 1, borderColor: color\.fault, backgroundColor: color\.chassis, boxShadow: color\.glassTop \}\} > <Text style=\{\{ color: color\.fault, [^}]*\}\}>\{NOT_CONNECTED\}/, 'NOT CONNECTED is not its opaque red-edged pill with the glass’s light')
    assert.match(band, /<View style=\{\{ paddingHorizontal: space\.md, paddingVertical: space\.sm, borderRadius: radius\.md, backgroundColor: color\.panel, boxShadow: color\.glassTop \}\}> <Text [^>]*>\{droppedNote\}/, 'the dropped-tap note is not opaque with the glass’s light')
  })

  test('glass on Play: the fault card keeps its opaque fill, its shadow and its elevation, and gains the light along its top', () => {
    const toast = code(FILES.toast)
    assert.match(
      toast,
      /<View onLayout=\{onLayout\} style=\{\{ position: 'absolute', top: space\.sm, left: space\.lg, right: space\.lg, zIndex: 2, boxShadow: color\.glassTop, gap: space\.xs, borderRadius: radius\.md, backgroundColor: color\.chassis, shadowColor: '#000', shadowOpacity: 0\.35, shadowRadius: 8, shadowOffset: \{ width: 0, height: 2 \}, elevation: 6 \}\}/,
      'the fault card is not opaque, lost its shadow or its elevation, or has no light along its top'
    )
  })

  test('glass on Play: the channel tip, which computer, and the demo’s offer are glass cards, the offer still in amber', () => {
    const coach = code(FILES.coach)
    assert.match(coach, /style=\{\{ gap: space\.sm, padding: space\.lg, borderRadius: cardCorner\(radius\.lg\), borderWidth: 1, borderColor: color\.glassRim, backgroundColor: color\.glassFill, boxShadow: color\.glassLift \}\}/, 'the channel tip is not a glass card, or its size changed')
    const card = code(FILES.card)
    assert.match(card, /style=\{\{ gap: space\.sm, borderLeftWidth: 3, borderLeftColor: color\.signal, backgroundColor: color\.glassFill, borderRadius: classic\(\) \? radius\.sm : radius\.md, boxShadow: color\.glassFlat, padding: space\.md \}\}/, 'which computer is not flat glass with its amber edge')
    const offer = code(FILES.offer)
    assert.match(offer, /padding: space\.md, borderRadius: radius\.card, borderWidth: 1, borderColor: color\.signal, backgroundColor: color\.signalWash, boxShadow: color\.glassLift \}\}/, 'the demo’s offer is not an amber glass card')
    assert.match(offer, /borderRadius: radius\.pill, backgroundColor: pressed \? color\.silkFaint : color\.signal, boxShadow: color\.glassLit, experimental_backgroundImage: color\.glassSheen \}\)\}/, 'the offer’s Unlock is not lit glass, or lost its press')
    /* The offer is run on a bench (independent.mjs) that stands in for each import by its exact line: not one added or changed. */
    assert.deepEqual(
      read(FILES.offer).split('\n').filter((l) => /^import /.test(l)),
      [
        "import { useEffect, useState } from 'react'",
        "import { Pressable, Text, View } from 'react-native'",
        "import AsyncStorage from '@react-native-async-storage/async-storage'",
        "import { color, font, radius, space } from '../lib/theme'",
        "import { tick } from '../lib/feedback'",
        "import { shouldOffer, trialOnOffer, usePurchase } from '../lib/purchases'",
        "import { DEMO_NUDGE_GO, demoTrialLine } from '../lib/trial-words'",
        "import { useDemo } from '../lib/demo'",
        "import { deviceNoun } from '../lib/device-word'"
      ],
      'the offer’s imports changed, and the bench that runs it has no stand-in'
    )
  })

  test('glass on Play: every colour and corner the six files read is one the theme has, in both palettes', async () => {
    const t = await import('../mobile/src/lib/theme.js')
    const painted = await palettes()
    const misses = []
    for (const f of Object.values(FILES)) {
      const text = code(f)
      for (const m of text.matchAll(/\bcolor\.([a-zA-Z]+)/g)) {
        for (const { name, c } of painted) if (typeof c[m[1]] !== 'string') misses.push(`${f} reads color.${m[1]}, which ${name} has not`)
      }
      for (const m of text.matchAll(/\bradius\.([a-zA-Z]+)/g)) if (typeof t.radius[m[1]] !== 'number') misses.push(`${f} reads radius.${m[1]}, which is not a corner`)
    }
    assert.deepEqual([...new Set(misses)], [], misses.join('\n'))
  })

  test('glass on Play: every word on the new glass reads at 4.5:1 with no credit for a blur, in Dark and Light, see-through and solid', async () => {
    const misses = []
    const need = (name, what, ink, ground) => {
      const r = contrast(ink, ground)
      if (!(r >= 4.5)) misses.push(`${name}: ${what} (${ink} on ${ground}) is ${r?.toFixed(2)}:1`)
    }
    for (const { name, c } of await palettes()) {
      /* The bar is in the page's flow, so under it is the chassis; Android draws no blur, so none is counted. */
      const barGround = over(c.glassBar, c.chassis)
      need(name, 'the version on the bar', c.silkFaint, barGround)
      /* The pill's own fill, over the bar: its words are the state's colours and the unit's and the computer's. */
      const pill = mix(barGround, c.panel, 0.6)
      for (const ink of ['silk', 'silkDim', 'ok', 'ble', 'fault', 'signal']) need(name, `${ink} on the pill`, c[ink], pill)
      /* The speaker and the gear are pictures, not words: 3:1 for those, on their disc over the bar. */
      const disc = over(c.glassFill, barGround)
      for (const ink of ['silk', 'silkDim']) {
        const r = contrast(c[ink], disc)
        if (!(r >= 3)) misses.push(`${name}: the ${ink} icon on its disc is ${r?.toFixed(2)}:1`)
      }
      /* The six buttons' strip is the bar's fill over the chassis too, and the buttons on it glass over that: every word a button there says. */
      const button = over(c.glassFill, barGround)
      for (const ink of ['silk', 'silkDim', 'silkFaint']) need(name, `${ink} on a button on the bottom bar`, c[ink], button)
      /* The cards on the page: the channel tip and which computer, glass over the chassis. */
      const card = over(c.glassFill, c.chassis)
      for (const ink of ['silk', 'silkDim', 'silkFaint', 'signal']) need(name, `${ink} on a card`, c[ink], card)
      /* Exit demo, Unlock and Save, and the offer's Unlock: the ink on amber, and at each stop of the sheen over it. */
      const stops = [...c.glassSheen.matchAll(/rgba\([^)]*\)/g)].map((m) => paint(m[0]))
      assert.equal(stops.length, 3, `${name}: the sheen is not three stops`)
      for (const ground of [c.signal, ...stops.map((s) => mix(c.signal, s.hex, s.a))]) need(name, 'the ink on a lit amber pill', c.onSignal, ground)
    }
    assert.deepEqual(misses, [], `words under 4.5:1 on Play’s glass:\n  ${misses.join('\n  ')}`)
  })
}
