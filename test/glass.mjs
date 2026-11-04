/**
 * Frosted glass on the phone: the foundation.
 *
 * "As far as the real iPhone liquid glass, let's wait on that, but let's go
 * ahead and do the other one with the frosted glass look." (3 November 2026.)
 * Content first: the tiles, pedals and lists keep their colours; the controls
 * and the chrome float over them as glass. No build: JS only, no new
 * package, no new blur. These hold the tokens in lib/theme, the builders in
 * lib/glass, the solid fallback (the Sunlight look and Reduce Transparency),
 * the contrast every ink keeps on the glass with no credit for a blur
 * (Android draws none), the button and the note that wear it, and how many
 * live blurs there may be.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { contrast, mix } from '../mobile/src/lib/ink.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

/* The sixteen new keys, the same in both palettes. */
const GLASS_KEYS = [
  'glassFill', 'glassFillHi', 'glassBar', 'glassRim',
  'glassLift', 'glassLiftRing', 'glassFlat', 'glassTop', 'glassLit', 'glassLitTop', 'glassSheen',
  'sheetFill', 'sheetLift', 'scrim', 'grabber', 'glassWell'
]
/* The five fills the solid fallback swaps, and the shadows it never touches. */
const FILLS = ['glassFill', 'glassFillHi', 'glassBar', 'sheetFill', 'glassWell']
const SHADOWS = ['glassLift', 'glassLiftRing', 'glassFlat', 'glassTop', 'glassLit', 'glassLitTop', 'sheetLift']
/* Every ink that is drawn on glass, and the three that are drawn on a pressed card. */
const INKS = ['silk', 'silkDim', 'silkFaint', 'signal', 'live', 'fault', 'ok', 'ble']
const GREYS = ['silk', 'silkDim', 'silkFaint']

/* One palette block of theme.js, by name, as { key: value }. */
const theme = read('mobile/src/lib/theme.js')
const block = (name) => {
  const m = theme.match(new RegExp(`\\nconst ${name} = \\{([\\s\\S]*?)\\n\\}`))
  assert.ok(m, `theme.js has no ${name} block`)
  return Object.fromEntries([...m[1].matchAll(/^ {2}([a-zA-Z]+): '([^']*)'/gm)].map((x) => [x[1], x[2]]))
}

/* 'rgba(r, g, b, a)' or '#rrggbb' as a colour and how much of it is drawn. */
const paint = (value) => {
  const m = /^rgba\((\d+), (\d+), (\d+), (0|1|0?\.\d+)\)$/.exec(value)
  if (m) return { hex: `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`, a: Number(m[4]) }
  if (/^#[0-9a-f]{6}$/i.test(value)) return { hex: value.toLowerCase(), a: 1 }
  return null
}

/*
 * React Native's own reading of a box-shadow string (Libraries/StyleSheet/
 * processBoxShadow.js, 0.86.3). Copied, because CI runs this suite before it
 * installs the app's own packages; where they are installed, the copy is held
 * to the file, so an upgrade that reads shadows differently says so here.
 */
const RN = {
  COMMA_SPLIT_REGEX: /,(?![^()]*\))/,
  WHITESPACE_SPLIT_REGEX: /\s+(?![^(]*\))/,
  LENGTH_PARSE_REGEX: /^([+-]?\d*\.?\d+)(px)?$/
}
const RN_SHADOW = new URL('../mobile/node_modules/react-native/Libraries/StyleSheet/processBoxShadow.js', import.meta.url)

/* The phone's files, walked. */
const walk = (at, out = []) => {
  for (const entry of readdirSync(at)) {
    const next = `${at}/${entry}`
    if (statSync(next).isDirectory()) walk(next, out)
    else if (/\.m?js$/.test(entry)) out.push(next)
  }
  return out
}
const phoneFiles = () => [...walk(fileURLToPath(new URL('../mobile/src', import.meta.url))), fileURLToPath(new URL('../mobile/App.js', import.meta.url))]
const named = (file) => file.replaceAll('\\', '/').split('/mobile/')[1]

/* Each look and mode, painted by the theme itself, and put back as it was. */
async function palettes() {
  const t = await import('../mobile/src/lib/theme.js')
  const was = { mode: t.getMode(), solid: t.isSolidChrome() }
  const out = []
  try {
    for (const mode of ['dark', 'light']) {
      for (const solid of [false, true]) {
        t.setMode(mode)
        t.setSolidChrome(solid)
        out.push({ name: `${mode}${solid ? ', solid' : ''}`, mode, solid, c: { ...t.color } })
      }
    }
  } finally {
    t.setSolidChrome(was.solid)
    t.setMode(was.mode)
  }
  return out
}

export function run(test) {
  test('glass: the sixteen keys are in both palettes, written so every reader of theme.js still finds its block', () => {
    const dark = block('DARK')
    const light = block('LIGHT')
    for (const key of GLASS_KEYS) {
      assert.ok(typeof dark[key] === 'string' && dark[key].length > 0, `DARK has no ${key}`)
      assert.ok(typeof light[key] === 'string' && light[key].length > 0, `LIGHT has no ${key}`)
    }
    /* mobile.mjs, link-now.mjs and both-ends.mjs cut each block at its first } (or \n}): there must be no other. */
    for (const name of ['DARK', 'LIGHT']) {
      const at = theme.indexOf(`const ${name} = {`)
      assert.equal(theme.indexOf('}', at), theme.indexOf('\n}', at) + 1, `a } inside ${name} cuts it short for the tests that read it by shape`)
    }
    assert.deepEqual(Object.keys(block('LIGHT')).sort(), Object.keys(block('DARK')).sort(), 'the two palettes do not carry the same colours')
    /* The two Light ink fixes, and nothing else of the old palette moved. */
    assert.equal(light.silkFaint, '#636a74', 'Light’s faint grey is the one that read 3.72:1 again')
    assert.equal(light.onSignal, '#ffffff', 'Light’s ink on the amber is the warm white that read 4.46:1 again')
    assert.equal(dark.silkFaint, '#7a8189', 'Dark’s faint grey moved, and the browser’s :root holds it')
    assert.equal(dark.onSignal, '#14161a')
    assert.match(theme, /export const radius = \{ sm: 6, md: 10, lg: 14, pill: 999, card: 18 \}/, 'the tiles’ corners moved, or the glass has no card corner')
    assert.doesNotMatch(theme, /^\s*import\b/m, 'theme.js imports something, and the suite loads it under plain Node')
  })

  test('glass: solid is the colour each fill draws on the plain ground, so Sunlight looks the same there and lets nothing through', () => {
    const ch = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const darkKeys = Object.keys(block('DARK'))
    for (const [solidName, name] of [['SOLID_DARK', 'DARK'], ['SOLID_LIGHT', 'LIGHT']]) {
      const solid = block(solidName)
      const base = block(name)
      assert.deepEqual(Object.keys(solid).sort(), [...FILLS].sort(), `${solidName} swaps something other than the five fills`)
      for (const key of Object.keys(solid)) assert.ok(darkKeys.includes(key), `${solidName}.${key} is not a colour the palette has`)
      for (const [key, value] of Object.entries(solid)) {
        assert.match(value, /^#[0-9a-f]{6}$/, `${solidName}.${key} is not opaque`)
        const p = paint(base[key])
        assert.ok(p, `${name}.${key} is not a colour this reads`)
        const drawn = mix(base.chassis, p.hex, p.a)
        assert.ok(ch(value).every((v, i) => Math.abs(v - ch(drawn)[i]) <= 1), `${solidName}.${key} is ${value}, and the glass draws ${drawn} on the chassis`)
      }
    }
    /* Written after LIGHT, and never named like the blocks the other tests look for. */
    assert.ok(theme.indexOf('const SOLID_DARK = {') > theme.indexOf('const LIGHT = {'))
    assert.ok(theme.indexOf('const SOLID_LIGHT = {') > theme.indexOf('const LIGHT = {'))
  })

  test('glass: every shadow is one React Native reads, part by part, and every sheen is a three-stop gradient', () => {
    if (existsSync(RN_SHADOW)) {
      const src = readFileSync(RN_SHADOW, 'utf8')
      for (const [name, re] of Object.entries(RN)) {
        const m = src.match(new RegExp(`const ${name} = \\/(.+)\\/([a-z]*);`))
        assert.ok(m, `React Native no longer has ${name}: it reads shadows another way`)
        assert.equal(m[1], re.source, `React Native reads ${name} differently from the copy here`)
      }
    }
    for (const name of ['DARK', 'LIGHT']) {
      const p = block(name)
      for (const key of [...SHADOWS]) {
        const parts = p[key].split(RN.COMMA_SPLIT_REGEX).map((s) => s.trim()).filter(Boolean)
        assert.ok(parts.length >= 1, `${name}.${key} has no shadow in it`)
        for (const part of parts) {
          const args = part.split(RN.WHITESPACE_SPLIT_REGEX)
          if (args[0] === 'inset') args.shift()
          const colour = args.pop()
          assert.ok(paint(colour) && colour.startsWith('rgba('), `${name}.${key}: “${part}” does not end in one rgba colour`)
          assert.ok(args.length >= 2 && args.length <= 4, `${name}.${key}: “${part}” has ${args.length} lengths`)
          for (const a of args) assert.match(a, RN.LENGTH_PARSE_REGEX, `${name}.${key}: “${a}” is not a length React Native reads`)
          if (args[2] !== undefined) assert.ok(parseFloat(args[2]) >= 0, `${name}.${key}: a negative blur, which React Native drops`)
          assert.ok(!args.includes('inset'), `${name}.${key}: inset after a length, which React Native refuses`)
        }
      }
      assert.match(
        p.glassSheen,
        /^linear-gradient\(180deg, rgba\([^)]*\) \d+%, rgba\([^)]*\) \d+%, rgba\([^)]*\) \d+%\)$/,
        `${name}.glassSheen is not a three-stop gradient from top to bottom`
      )
    }
  })

  test('glass: drawn solid in place, once, and only the five fills; Light and Dark stay solid', async () => {
    const t = await import('../mobile/src/lib/theme.js')
    const was = { mode: t.getMode(), solid: t.isSolidChrome() }
    const dark = block('DARK')
    const solidDark = block('SOLID_DARK')
    const solidLight = block('SOLID_LIGHT')
    try {
      t.setSolidChrome(false)
      t.setMode('dark')
      const same = t.color
      const before = { ...t.color }
      const v = t.themeVersion()
      t.setSolidChrome(true)
      assert.equal(t.color, same, 'the palette object was replaced, so every screen still holds the old one')
      assert.equal(t.themeVersion(), v + 1, 'drawing it solid does not tell the root to repaint, or tells it twice')
      assert.equal(t.isSolidChrome(), true)
      t.setSolidChrome(true)
      assert.equal(t.themeVersion(), v + 1, 'asking for solid twice repaints twice')
      const changed = Object.keys(before).filter((k) => before[k] !== t.color[k]).sort()
      assert.deepEqual(changed, [...FILLS].sort(), 'solid changes something other than the five fills')
      for (const k of FILLS) assert.equal(t.color[k], solidDark[k])
      for (const k of [...SHADOWS, 'glassSheen', 'glassRim', 'scrim', 'grabber']) assert.equal(t.color[k], before[k], `solid takes away ${k}: the shapes and the light edge stay`)
      t.setMode('light')
      assert.equal(t.isSolidChrome(), true, 'Light lost the solid glass')
      for (const k of FILLS) assert.equal(t.color[k], solidLight[k], `Light, solid: ${k}`)
      t.setMode('dark')
      for (const k of FILLS) assert.equal(t.color[k], solidDark[k], `Dark again, solid: ${k}`)
      t.setSolidChrome(false)
      assert.equal(t.isSolidChrome(), false)
      for (const k of FILLS) assert.equal(t.color[k], dark[k], `see-through again: ${k}`)
      t.setSolidChrome(null)
      assert.equal(t.isSolidChrome(), false, 'something other than true draws it solid')
    } finally {
      t.setSolidChrome(was.solid)
      t.setMode(was.mode)
    }
  })

  test('glass: Sunlight and Reduce Transparency are solid, every other look is glass, and every builder reads the colour when it is called', async () => {
    const g = await import('../mobile/src/lib/glass.js')
    const { LOOKS } = await import('../mobile/src/lib/blockPalettes.js')
    assert.equal(g.SUNLIGHT_LOOK, 'sunlight')
    assert.ok(LOOKS.some((l) => l.id === g.SUNLIGHT_LOOK && l.name === 'Sunlight'), 'there is no Sunlight look to be solid in')
    for (const l of LOOKS) {
      assert.equal(g.chromeSolid({ look: l.id, reduceTransparency: false }), l.id === 'sunlight', `${l.name}: solid is wrong`)
      assert.equal(g.chromeSolid({ look: l.id, reduceTransparency: true }), true, `${l.name}: Reduce Transparency still lets things through`)
    }
    assert.equal(g.chromeSolid({}), false)
    assert.equal(g.chromeSolid(), false)
    assert.equal(g.chromeSolid({ look: 'fractalremote', reduceTransparency: 'yes' }), false, 'something other than true counts as Reduce Transparency')
    assert.equal(g.capsule(56), 28)
    assert.equal(g.capsule(40), 20)

    const t = await import('../mobile/src/lib/theme.js')
    const was = { mode: t.getMode(), solid: t.isSolidChrome() }
    try {
      t.setSolidChrome(false)
      t.setMode('dark')
      const c = t.color
      assert.deepEqual(g.glassControl(), { backgroundColor: c.glassFill, borderColor: c.glassRim, boxShadow: c.glassLift })
      assert.deepEqual(g.glassControl({ pressed: true, bordered: false }), { backgroundColor: c.glassFillHi, boxShadow: c.glassLiftRing })
      assert.deepEqual(g.glassCard(), { backgroundColor: c.glassFill, borderRadius: 18, boxShadow: c.glassLiftRing })
      assert.deepEqual(g.glassCard({ flat: true }), { backgroundColor: c.glassFill, borderRadius: 18, boxShadow: c.glassFlat })
      assert.deepEqual(g.glassCard({ bordered: true }), { backgroundColor: c.glassFill, borderRadius: 18, borderColor: c.glassRim, boxShadow: c.glassLift })
      assert.deepEqual(g.glassCard({ bordered: true, flat: true, pressed: true }), { backgroundColor: c.glassFillHi, borderRadius: 18, borderColor: c.glassRim, boxShadow: c.glassTop })
      assert.deepEqual(g.glassFloat(), { boxShadow: c.glassTop })
      assert.deepEqual(g.glassSheet(), { backgroundColor: c.sheetFill, borderColor: c.glassRim, boxShadow: c.sheetLift })
      assert.deepEqual(g.glassPane(), { borderColor: c.glassRim, boxShadow: c.glassLift })
      assert.deepEqual(g.glassLit(c.signal), { backgroundColor: c.signal, borderColor: c.signal, boxShadow: c.glassLit, experimental_backgroundImage: c.glassSheen })
      assert.equal(g.glassLit(c.live, { glowing: true }).boxShadow, c.glassLitTop)
      assert.deepEqual(g.glassField(), { backgroundColor: c.glassFill, borderColor: c.glassRim, borderRadius: 18 })
      const darkCard = g.glassCard()
      t.setMode('light')
      assert.notDeepEqual(g.glassCard(), darkCard, 'a builder kept the colours it was first called with')
      assert.equal(g.glassCard().backgroundColor, block('LIGHT').glassFill)
      t.setSolidChrome(true)
      assert.equal(g.glassCard().backgroundColor, block('SOLID_LIGHT').glassFill, 'a builder does not follow the solid glass')
    } finally {
      t.setSolidChrome(was.solid)
      t.setMode(was.mode)
    }

    /* Pure: the theme alone, by its file name, and nothing from React Native, so this file loads under Node. */
    const src = code('mobile/src/lib/glass.js')
    const imports = [...src.matchAll(/^\s*import\b[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
    assert.deepEqual(imports, ['./theme.js'], 'lib/glass imports something other than the theme')
    assert.ok(!/react-native/.test(src), 'lib/glass reaches for React Native')
    assert.ok(!/useMemo|memo\(/.test(src), 'lib/glass keeps a style, and a change of theme would not repaint it')
    /* No style built once at load: every export is a function, or the look's name. */
    for (const [name, value] of Object.entries(g)) if (name !== 'SUNLIGHT_LOOK') assert.equal(typeof value, 'function', `lib/glass ${name} is built once, at load`)
  })

  test('glass: every ink reads at 4.5:1 on the glass with no credit for a blur, in Dark and Light, see-through and solid', async () => {
    const over = (top, ground) => {
      const p = paint(top)
      assert.ok(p, `${top} is not a colour this reads`)
      return mix(ground, p.hex, p.a)
    }
    const misses = []
    for (const { name, mode, c } of await palettes()) {
      /* The worst thing a sheet can be over: white on the dark stage (a Sunlight tile), and black or deep blue under the light one. */
      const worst = mode === 'dark' ? ['#ffffff'] : ['#000000', '#000066']
      const grounds = {
        'glass on the chassis': over(c.glassFill, c.chassis),
        'glass on glass': over(c.glassFill, over(c.glassFill, c.chassis)),
        'the top bar’s pill': mix(over(c.glassBar, c.chassis), c.panel, 0.6)
      }
      for (const w of worst) {
        const sheet = over(c.sheetFill, over(c.scrim, w))
        grounds[`a sheet over ${w}`] = sheet
        grounds[`glass on a sheet over ${w}`] = over(c.glassFill, sheet)
      }
      for (const [where, ground] of Object.entries(grounds)) {
        for (const ink of INKS) {
          const r = contrast(c[ink], ground)
          if (!(r >= 4.5)) misses.push(`${name}: ${ink} on ${where} (${ground}) is ${r?.toFixed(2)}:1`)
        }
      }
      const pressed = over(c.glassFillHi, c.chassis)
      for (const ink of GREYS) {
        const r = contrast(c[ink], pressed)
        if (!(r >= 4.5)) misses.push(`${name}: ${ink} on a pressed card (${pressed}) is ${r?.toFixed(2)}:1`)
      }
      /* A lit button: the ink on its colour, and at each end of the sheen over it. */
      const stops = [...c.glassSheen.matchAll(/rgba\([^)]*\)/g)].map((m) => paint(m[0]))
      assert.equal(stops.length, 3, `${name}: the sheen is not three stops`)
      for (const lit of ['signal', 'live', 'silk']) {
        for (const ground of [c[lit], ...stops.map((s) => mix(c[lit], s.hex, s.a))]) {
          const r = contrast(c.onSignal, ground)
          if (!(r >= 4.5)) misses.push(`${name}: the ink on a lit ${lit} button over ${ground} is ${r?.toFixed(2)}:1`)
        }
      }
    }
    assert.deepEqual(misses, [], `words under 4.5:1 on the glass:\n  ${misses.join('\n  ')}`)
  })

  test('glass: the rim is never fainter than the rule it replaced, on the page and on the glass, in Dark and Light', () => {
    /*
     * The rim is the only edge on a text field and on an unticked box, where
     * the edge is what shows the state. The old rule's own reading is the
     * floor: against the chassis, and against the white of a box (Light) or
     * the panel (Dark). The ring drawn inside unbordered glass is the same rim.
     */
    for (const name of ['DARK', 'LIGHT']) {
      const c = block(name)
      const rim = paint(c.glassRim)
      assert.ok(rim, `${name}.glassRim is not a colour this reads`)
      const onGlass = mix(c.chassis, paint(c.glassFill).hex, paint(c.glassFill).a)
      for (const [ground, what] of [[c.chassis, 'the chassis'], [c.panel, 'the panel'], [onGlass, 'the glass']]) {
        const was = contrast(c.rule, ground)
        const now = contrast(mix(ground, rim.hex, rim.a), ground)
        assert.ok(now >= was - 0.02, `${name}: the rim reads ${now.toFixed(2)}:1 on ${what}, fainter than the old rule's ${was.toFixed(2)}:1`)
      }
      assert.ok(c.glassLiftRing.startsWith(`inset 0 0 0 1px ${c.glassRim},`), `${name}: the ring inside unbordered glass is not the rim`)
    }
  })

  test('glass: Press is the glass button, its corner by what it carries, and every pin it had is still there', () => {
    const press = read('mobile/src/components/Press.js')
    const flat = code('mobile/src/components/Press.js').replace(/\s+/g, ' ')
    /*
     * The bar's corner and glass come from the kind of button (`bar`), never
     * from whether this preset has a tag today: read off the style, Play's
     * preset name was a capsule on one preset and a box on the next.
     */
    assert.match(press, /import \{ Image, PixelRatio, Pressable, Text, View \} from 'react-native'/)
    assert.match(press, /import \{ capsule, classic \} from '\.\.\/lib\/glass'/)
    assert.doesNotMatch(code('mobile/src/components/Press.js'), /StyleSheet|borderLeftWidth/, 'Press reads its shape off the caller’s style again, so a tag changes the button')
    assert.match(press, /const solid = bar === 'solid'/)
    assert.match(press, /const corner = bar \|\| classic\(\) \? radius\.md : under !== undefined \|\| caption \? radius\.card : capsule\(height\)/, 'the corner is not the bar’s, the line’s or a capsule, or Classic is not the old radius.md')
    assert.match(press, /const background = on \? accent : solid \? color\.panel : color\.glassFill/, 'Edit’s chain card is see-through over SwipeAway’s red, or a lit one is not its colour')
    assert.match(press, /const lift = flat \? \(on \? color\.glassLitTop : color\.glassTop\) : on \? color\.glassLit : solid \? color\.glassTop : color\.glassLift/, 'a row in a long list casts a drop, or a button lost its lift')
    assert.match(flat, /borderRadius: corner, borderWidth: BORDER, borderColor: on \? accent : color\.glassRim, backgroundColor: background, boxShadow: lift, experimental_backgroundImage: on \? color\.glassSheen : undefined, opacity: disabled \? 0\.45 : pressed \? 0\.7 : 1 \}, style \]/, 'the glass is not the button’s, or a caller’s own corner no longer wins')
    /* A thumb gets 44 whatever the button is drawn at. */
    assert.match(press, /const THUMB = 44\n/)
    assert.match(press, /hitSlop=\{height < THUMB \? \(THUMB - height\) \/ 2 : undefined\}/, 'a button drawn at 40 is a smaller target than a thumb')
    assert.ok(!/elevation|Animated|shadowColor/.test(code('mobile/src/components/Press.js')), 'Press animates or elevates its glass, which shows through a see-through fill')
    assert.ok(!/color\.rule/.test(code('mobile/src/components/Press.js')), 'Press still draws the old grey border')
    /* The pins, word for word. */
    for (const pin of [
      'minHeight: height',
      'height = TAP',
      'borderWidth: BORDER,',
      'paddingHorizontal: space.md,',
      'paddingVertical: under !== undefined ? space.xs : space.sm',
      'const ink = on ? color.onSignal : disabled ? color.silkFaint : color.silk',
      'opacity: disabled ? 0.45 : pressed ? 0.7 : 1',
      'accessibilityState={{ selected: on, disabled, busy }}',
      "[caption, label, sub].filter(Boolean).join(', ')",
      'minHeight: rowTall',
      'opacity: lineWaits ? 0 : 1,',
      '{icon && !bare ? <Picture',
      'marginHorizontal: fit ? -(space.md - STEP_LINE_EDGE) : 0,',
      "const MEASURE = { position: 'absolute', left: 0, top: 0, width: 2000, height: 0, overflow: 'hidden', opacity: 0, alignItems: 'flex-start' }"
    ]) assert.ok(press.includes(pin), `Press lost “${pin}”`)
  })

  test('glass: Note is flat glass with its coloured edge, and its padding is still last', () => {
    const note = read('mobile/src/components/Note.js')
    assert.match(
      note,
      /borderLeftWidth: EDGE,\n\s+borderLeftColor: accent,\n[\s\S]{0,140}backgroundColor: color\.glassFill,\n\s+borderRadius: classic\(\) \? radius\.sm : radius\.md,\n\s+boxShadow: color\.glassFlat,\n\s+paddingVertical: space\.md,\n\s+paddingHorizontal: space\.md\n/,
      'the note is not flat glass, or its padding moved off the end'
    )
    assert.ok(!/color\.panel/.test(code('mobile/src/components/Note.js')), 'the note is still the old opaque panel')
    assert.equal((code('mobile/src/components/Note.js').match(/radius\.sm/g) || []).length, 1, 'the old small corner is drawn outside Classic')
    assert.ok(!/elevation|0 3px 10px/.test(code('mobile/src/components/Note.js')), 'a note has a drop shadow; notes are flat')
    assert.match(note, /accessibilityLiveRegion=\{tone === 'hint' \? 'none' : 'polite'\}/)
    assert.match(note, /fontWeight: strong \? '700' : undefined/)
  })

  test('glass: GlassCard and GlassDisc take no room of their own and read the builders', () => {
    const glass = code('mobile/src/components/Glass.js').replace(/\s+/g, ' ')
    assert.match(glass, /export function GlassCard\(\{ flat = false, bordered = false, clip = false, pressed = false, bare = false, style, children, \.\.\.viewProps \}\)/)
    /* Classic: a bare card is the plain View it was, and there is no disc. */
    assert.match(glass, /if \(bare && classic\(\)\) \{ return \( <View \{\.\.\.viewProps\} style=\{style\}> \{children\} <\/View> \) \}/, 'a bare card is glass in Classic')
    assert.match(glass, /export function GlassDisc\(\{ size = 30 \}\) \{ if \(classic\(\)\) return null /, 'the disc is drawn in Classic')
    assert.match(glass, /style=\{\[glassCard\(\{ pressed, bordered, flat \}\), clip \? \{ overflow: 'hidden' \} : null, style\]\}/)
    assert.match(glass, /export function GlassDisc\(\{ size = 30 \}\)/)
    assert.match(glass, /pointerEvents="none"/, 'the disc takes the icon’s touch')
    assert.match(glass, /position: 'absolute', left: '50%', top: '50%', width: size, height: size, marginLeft: -size \/ 2, marginTop: -size \/ 2, borderRadius: size \/ 2, backgroundColor: color\.glassFill, boxShadow: color\.glassLiftRing/, 'the disc is not a centred, absolute circle of glass')
  })

  test('glass: six live blurs in the whole app, one in each of the six that had one, and nothing new installed', () => {
    const files = phoneFiles()
    assert.ok(files.length > 30, `only ${files.length} phone files were read`)
    const blurs = {}
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      const n = (text.match(/<BlurView\b/g) || []).length
      if (n) blurs[named(f)] = n
      assert.ok(!/BlurTargetView|blurTarget/.test(text), `${named(f)} uses a blur target, too costly on an older Android phone`)
    }
    assert.deepEqual(
      blurs,
      {
        'src/components/PasswordBox.js': 1,
        'src/components/Sheet.js': 1,
        'src/components/TempoBox.js': 1,
        'src/components/TopBar.js': 1,
        'src/components/Tuner.js': 1,
        'src/components/Volume.js': 1
      },
      'a blur was added, moved or doubled: a control on the plain ground gets a see-through fill, not a blur'
    )
    const pkg = JSON.parse(read('mobile/package.json'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    assert.ok(deps['expo-blur'], 'expo-blur is gone, and the sheets and the top bar lose their blur')
    for (const name of ['expo-linear-gradient', 'react-native-svg']) assert.ok(!deps[name], `${name} is installed, which is a new build`)
  })

  test('glass: the root asks once whether to draw it solid, from Reduce Transparency and the look', () => {
    const hook = read('mobile/src/lib/useSolidChrome.js')
    const flat = code('mobile/src/lib/useSolidChrome.js').replace(/\s+/g, ' ')
    assert.match(hook, /import \{ AccessibilityInfo \} from 'react-native'/)
    assert.match(flat, /AccessibilityInfo\.isReduceTransparencyEnabled\(\) \.then\(\(v\) => live && setReduce\(Boolean\(v\)\)\) \.catch\(\(\) => \{\}\)/, 'Reduce Transparency is not asked, or a refusal throws')
    assert.match(flat, /const sub = AccessibilityInfo\.addEventListener\('reduceTransparencyChanged', \(v\) => setReduce\(Boolean\(v\)\)\)/, 'a change to Reduce Transparency is not heard')
    assert.match(flat, /return \(\) => \{ live = false sub\?\.remove\?\.\(\) \}/, 'the listener is left behind')
    assert.match(flat, /const solid = chromeSolid\(\{ look: lookId\(\), reduceTransparency: reduce \}\) useEffect\(\(\) => \{ setSolidChrome\(solid\) \}, \[solid\]\)/)
    /* The look is only read: lib/looks is generated, and the hook writes nothing to it. */
    assert.match(hook, /import \{ lookId \} from '\.\/looks'\n/)
    const app = read('mobile/App.js')
    assert.match(app, /import \{ useSolidChrome \} from '\.\/src\/lib\/useSolidChrome'/)
    assert.match(app, /useSyncExternalStore\(watchLooks, looksVersion, looksVersion\)\n  useSolidChrome\(\)\n/, 'the root does not ask, or asks before the looks are watched')
    assert.equal((app.match(/useSolidChrome\(\)/g) || []).length, 1, 'the root asks more than once')
    /* And nothing else decides it: the theme defines it, the hook calls it, the root asks. */
    const callers = phoneFiles()
      .map(named)
      .filter((f) => /useSolidChrome|setSolidChrome/.test(code(`mobile/${f}`)))
      .sort()
    assert.deepEqual(callers, ['App.js', 'src/lib/theme.js', 'src/lib/useSolidChrome.js'], 'something other than the root decides when the glass is solid')
  })
}
