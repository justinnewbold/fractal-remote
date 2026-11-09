/**
 * Frosted glass on the phone: Settings and its pages.
 *
 * "Let's go ahead and do the other one with the frosted glass look" (3
 * November 2026), and "I just don't wanna lose all the colors and current
 * color scheme cause I like those also." So in Settings what holds a control
 * turns to glass: each group is one card of glass with its rows inside it,
 * the account card, the tip cards, the looks and the off choice, the Undo
 * that floats over them, Connect a computer's pill, card and email box, the
 * facts on the Developer pages, the fields, and the panels on Fixes, the
 * feedback form, Footswitches and Bluetooth. The look previews, the swatches
 * and the pictures are content, and stay as they were.
 *
 * Only the material changes, never a place, a size, a word or a press: a
 * piece with a border keeps its width and changes only its colour, and a
 * piece with none gets its rim as a ring inside it. No blur, sheet or pop-up
 * is added. These draw the real components on a bench (their JSX turned into
 * plain calls by esbuild, against the real theme and the real lib/glass) and
 * read what they would draw, in Dark and Light, see-through and solid, and
 * hold every word on the new glass to 4.5:1 with no credit for a blur.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { contrast, mix } from '../mobile/src/lib/ink.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const FILES = {
  settings: 'mobile/src/screens/Settings.js',
  bluetooth: 'mobile/src/screens/Bluetooth.js',
  connect: 'mobile/src/screens/Connect.js',
  gear: 'mobile/src/screens/Gear.js',
  log: 'mobile/src/screens/Log.js',
  fixes: 'mobile/src/screens/Fixes.js',
  report: 'mobile/src/screens/Report.js',
  colours: 'mobile/src/components/Colours.js',
  walk: 'mobile/src/components/Walk.js',
  facts: 'mobile/src/components/Facts.js',
  copy: 'mobile/src/components/CopyAddress.js',
  gearCard: 'mobile/src/components/GearCard.js',
  shots: 'mobile/src/components/Shots.js',
  attach: 'mobile/src/components/Attach.js',
  footswitches: 'mobile/src/components/Footswitches.js',
  vp4: 'mobile/src/components/Vp4Setup.js',
  tickBox: 'mobile/src/components/TickBox.js'
}

/* A thumb's least, as Press has it. */
const THUMB = 44

/*
 * One top-level declaration of a file, as written: a function to the brace
 * that closes it at the margin, a const to the blank line after it. Any
 * `export` before it is left off, so the bench can call it by its name.
 */
function piece(src, head) {
  const m = new RegExp(`^(?:export (?:default )?)?${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').exec(src)
  assert.ok(m, `${head} is not there; this check reads it`)
  const from = m.index + m[0].length - head.length
  const end = head.startsWith('function ') ? src.indexOf('\n}\n', from) + 2 : src.indexOf('\n\n', from)
  assert.ok(end > from, `${head} has no end this check can find`)
  return src.slice(from, end)
}

/* An element as the bench draws it: never called, so a component is its name and its props. */
const h = (type, props, ...children) => ({ type: typeof type === 'function' ? type.name : type, props: props || {}, children: children.flat() })

/*
 * The named declarations of `file`, on a bench: their JSX made plain calls,
 * and every name they use from outside given by `scope` (a component is its
 * name, as a string). The theme and lib/glass are the real ones, so what is
 * drawn is what the phone draws, and changes when the theme does.
 */
async function bench(file, heads, scope) {
  const { transformSync } = await import('esbuild')
  const src = read(file)
  const text = heads.map((head) => piece(src, head)).join('\n\n')
  const code = transformSync(text, { loader: 'jsx', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Fragment' }).code
  const names = heads.map((head) => /^(?:function|const)\s+(\w+)/.exec(head)[1])
  const all = { h, Fragment: 'Fragment', ...(await kit()), ...scope }
  return new Function(...Object.keys(all), `${code}\nreturn { ${names.join(', ')} }`)(...Object.values(all))
}

/* What every bench is given: the real theme and glass, the host views by name, and the things that only make noise. */
async function kit() {
  const theme = await import('../mobile/src/lib/theme.js')
  const glass = await import('../mobile/src/lib/glass.js')
  return {
    color: theme.color,
    font: theme.font,
    radius: theme.radius,
    space: theme.space,
    TAP: theme.TAP,
    glassCard: glass.glassCard,
    classic: glass.classic,
    cardCorner: glass.cardCorner,
    glassControl: glass.glassControl,
    glassField: glass.glassField,
    View: 'View',
    Text: 'Text',
    Pressable: 'Pressable',
    Image: 'Image',
    GlassCard: 'GlassCard',
    tick: () => {},
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}]
  }
}

/* The first element in a drawing that passes `is`, depth first. */
function find(tree, is) {
  if (!tree || typeof tree !== 'object') return null
  if (is(tree)) return tree
  for (const child of tree.children || []) {
    const hit = find(child, is)
    if (hit) return hit
  }
  return null
}

/* A Pressable's style, at rest or pressed, as it would be drawn. */
const styleOf = (el, pressed = false) => {
  const s = typeof el.props.style === 'function' ? el.props.style({ pressed }) : el.props.style
  return Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s
}

/* Each mode, see-through and solid, painted by the theme itself, then put back as it was. */
async function eachPalette(fn) {
  const t = await import('../mobile/src/lib/theme.js')
  const was = { mode: t.getMode(), solid: t.isSolidChrome() }
  try {
    for (const mode of ['dark', 'light']) {
      for (const solid of [false, true]) {
        t.setMode(mode)
        t.setSolidChrome(solid)
        await fn(`${mode}${solid ? ', solid' : ''}`, t.color)
      }
    }
  } finally {
    t.setSolidChrome(was.solid)
    t.setMode(was.mode)
  }
}

/* Code only, one space for any run of white: comments go, so a word in one is never read as code. */
const code = (p) =>
  read(p)
    .replace(/\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ')

/* 'rgba(r, g, b, a)' or '#rrggbb' laid over a ground, as the screen draws it. */
const over = (top, ground) => {
  const m = /^rgba\((\d+), (\d+), (\d+), (0|1|0?\.\d+)\)$/.exec(top)
  if (m) return mix(ground, `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`, Number(m[4]))
  assert.match(top, /^#[0-9a-f]{6}$/i, `${top} is not a colour this reads`)
  return top.toLowerCase()
}

/* The Fixes page is drawn on no-computer.mjs's bench, which stands in for these imports and only these. */
const FIXES_IMPORTS = [
  "import { useState } from 'react'",
  "import { ScrollView, Text, View } from 'react-native'",
  "import { color, font, radius, space } from '../lib/theme'",
  "import { FIXES, FIRMWARE_NOTE, versionsInSync } from '../lib/troubleshooting'",
  "import { APP_VERSION } from '../lib/version'",
  "import Note from '../components/Note'",
  "import Press from '../components/Press'",
  "import { bluetoothOn } from '../lib/bleSwitch'",
  "import { isDemo } from '../lib/demo'",
  "import { deviceNoun } from '../lib/device-word'",
  "import { vp4Capabilities, vp4Here } from '../lib/device'",
  "import { vp4ComputerLacks } from '../lib/vp4-safety'",
  "import { NO_COMPUTER_BLUETOOTH } from '../lib/no-computer'",
  "import { useBluetoothOffered } from '../lib/useBluetoothOffered'",
  "import { cableNow } from '../lib/bluetooth'",
  "import { cableFixesLine } from '../lib/cableWords'",
  "import { SETUP } from '../lib/onboarding'"
]

export function run(test) {
  test('glass in Settings: each group is one card of glass, its heading clear on it, and its rows inside it', async () => {
    const raw = read(FILES.settings)
    const { Group, OPEN_GROUPS } = await bench(FILES.settings, ['function Group(', 'const OPEN_GROUPS = new Set()'], {})
    await eachPalette((name, color) => {
      const shut = Group({ title: 'About', hint: 'v1', children: 'A-ROW' })
      assert.equal(shut.type, 'GlassCard', `${name}: a group is not one card of glass`)
      assert.equal(shut.props.clip, true, `${name}: the group’s card does not cut its rows to its corner`)
      assert.ok(!shut.props.bordered && !shut.props.flat, `${name}: the group’s card has a border it never had, or lost its lift`)
      const head = find(shut, (el) => el.type === 'Pressable')
      const rest = styleOf(head)
      const down = styleOf(head, true)
      assert.equal(rest.backgroundColor, 'transparent', `${name}: the heading has a fill of its own over the card`)
      assert.equal(down.backgroundColor, color.glassFillHi, `${name}: the heading is not pressed in the glass’s own press`)
      assert.equal(rest.borderRadius, 18, `${name}: the heading is not at the card’s corner`)
      /* Its size and its padding, as they were. */
      assert.equal(rest.minHeight, 64)
      assert.equal(rest.paddingHorizontal, 12)
      assert.equal(rest.paddingVertical, 12)
      assert.equal(rest.borderWidth, undefined, `${name}: the heading gained a border, and moved`)
      assert.ok(!find(shut, (el) => el === 'A-ROW'), `${name}: a shut group draws its rows`)
    })
    /* Open, the rows are inside the same card, in the container they always had. */
    OPEN_GROUPS.add('About')
    const open = Group({ title: 'About', hint: 'v1', children: 'A-ROW' })
    const rows = open.children.find((el) => el && el.type === 'View' && el.children.includes('A-ROW'))
    assert.ok(rows, 'an open group’s rows are not inside its card')
    assert.deepEqual(rows.props.style, { gap: 0, paddingLeft: 8 })
    /* The lines other tests read, word for word. */
    assert.match(raw, /\{open \? <View style=\{\{ gap: 0, paddingLeft: space\.sm \}\}>\{children\}<\/View> : null\}/)
    assert.match(raw, /import \{ GlassCard \} from '\.\.\/components\/Glass'/)
  })

  test('glass in Settings: the account card, the tips, the looks and the off choice are bordered glass at the card’s corner', async () => {
    const settings = await bench(FILES.settings, ['function AccountCard(', 'const KEPT_OFFLINE ='], { APP_VERSION: '1.0.0', ACCOUNT_LINE: 'Password, sign out, delete account' })
    const walk = await bench(FILES.walk, ['function TipCard('], { Tile: 'Tile', chevronIcon: 1 })
    const colours = await bench(FILES.colours, ['function LookCard(', 'function OffChoice('], {
      lookCard: () => [{ slug: 'drive', fill: '#ff0000' }, { fill: '#00ff00' }],
      lookWhy: () => 'Why',
      shortName: (s) => s,
      Tile: 'Tile',
      offMode: () => 'colour',
      setOffMode: () => {},
      blockColor: () => ({ fill: '#ff0000', ink: '#ffffff', picked: '#ff0000' }),
      sync: {}
    })
    await eachPalette((name, color) => {
      const drawn = [
        ['the account card', settings.AccountCard({ asked: true, email: 'a@b.c', onPress: () => {} }), 1, color.glassRim],
        ['a tip card', walk.TipCard({ icon: 1, label: 'TIP', body: 'Body', onPress: () => {} }), 1, color.glassRim],
        ['a look’s card', colours.LookCard({ look: { id: 'fractal', name: 'Fractal Remote' }, on: false, onPress: () => {} }), 1, color.glassRim],
        ['the look worn', colours.LookCard({ look: { id: 'fractal', name: 'Fractal Remote' }, on: true, onPress: () => {} }), 2, color.signal],
        ['the off choice worn', colours.OffChoice({ mode: 'colour', label: 'Keep their color', sub: 'Sub' }), 2, color.signal],
        ['the off choice not worn', colours.OffChoice({ mode: 'grey', label: 'Gray when off', sub: 'Sub' }), 1, color.glassRim]
      ]
      for (const [what, el, width, edge] of drawn) {
        assert.equal(el.type, 'Pressable', `${name}: ${what} is no longer the button it was`)
        const rest = styleOf(el)
        const down = styleOf(el, true)
        assert.equal(rest.backgroundColor, color.glassFill, `${name}: ${what} is not frosted glass`)
        assert.equal(down.backgroundColor, color.glassFillHi, `${name}: ${what} is not pressed in the glass’s own press`)
        assert.equal(rest.borderRadius, 18, `${name}: ${what} is not at the card’s corner`)
        assert.equal(rest.boxShadow, color.glassLift, `${name}: ${what} has not the light along its top and the lift`)
        assert.equal(rest.borderWidth, width, `${name}: ${what}’s border changed width, and moved`)
        assert.equal(rest.borderColor, edge, `${name}: ${what}’s border is not the glass’s rim, or the worn one lost its amber`)
        assert.equal(rest.elevation, undefined, `${name}: ${what} has an elevation that would show through the glass`)
      }
    })
    /* The tip card's own picture tile is the card's, and stays amber. */
    const tile = piece(read(FILES.walk), 'function Tile(')
    assert.match(tile, /borderColor: tint\(color\.signal, 0\.35\),\s+backgroundColor: tint\(color\.signal, 0\.14\)/, 'the tip card’s amber picture tile changed')
  })

  test('glass in Settings: Apply floats over the cards, solid, with its own shadow and elevation and the light along its top', async () => {
    /* The bar that was Undo's, saying Apply now (5 November 2026): drawn the same. */
    const { LookApply } = await bench(FILES.colours, ['function LookApply('], {
      useSyncExternalStore: (watch, get) => get(),
      watchLooks: () => () => {},
      looksVersion: () => 0,
      watchPick: () => () => {},
      pickNow: () => 'sunlight',
      pickLook: (id) => id,
      LOOKS: [{ id: 'sunlight', name: 'Sunlight' }],
      Press: 'Press',
      applyLook: () => null,
      offerPick: () => {},
      offerUndo: () => {},
      sync: {}
    })
    await eachPalette((name, color) => {
      const bar = LookApply({ onApplied: () => {} })
      assert.equal(bar.type, 'View', `${name}: the Apply bar is gone`)
      const s = bar.props.style
      assert.equal(s.backgroundColor, color.chassis, `${name}: the Apply bar lets the cards through: it floats over them, and keeps its solid fill`)
      assert.equal(s.elevation, 6, `${name}: the Apply bar lost its elevation`)
      assert.deepEqual([s.shadowColor, s.shadowOpacity, s.shadowRadius, s.shadowOffset], ['#000', 0.35, 8, { width: 0, height: 2 }], `${name}: the Apply bar lost its shadow`)
      assert.equal(s.boxShadow, color.glassTop, `${name}: the Apply bar has not the light along its top`)
      assert.equal(s.borderColor, color.glassRim, `${name}: the Apply bar’s border is not the glass’s rim`)
      assert.equal(s.borderWidth, 1)
      assert.equal(s.borderRadius, 18, `${name}: the Apply bar is not at the card’s corner`)
      assert.deepEqual([s.position, s.left, s.right, s.bottom, s.padding, s.paddingLeft], ['absolute', 16, 16, 16, 8, 12], `${name}: the Apply bar moved`)
    })
  })

  test('glass in Settings: a row is flat, its rule the glass’s rim, and a tick box row reaches a thumb', async () => {
    const { SetupRow, Choice, CHOICE_SLOP } = await bench(FILES.settings, ['function SetupRow(', 'function Choice(', 'const CHOICE_SLOP ='], {})
    const { look, Facts } = await bench(FILES.facts, ['const look =', 'function Facts('], {})
    const { Line } = await bench(FILES.log, ['function Line('], { face: 'monospace' })
    const { font } = await kit()
    await eachPalette((name, color) => {
      const row = SetupRow({ title: 'Updates', status: 'v1', onPress: () => {} })
      const rest = styleOf(row)
      assert.equal(rest.backgroundColor, 'transparent', `${name}: a row has a fill of its own`)
      assert.equal(styleOf(row, true).backgroundColor, color.glassFillHi, `${name}: a row is not pressed in the glass’s own press`)
      assert.deepEqual([rest.borderBottomWidth, rest.borderBottomColor], [1, color.glassRim], `${name}: a row’s rule is not the glass’s rim`)
      assert.equal(rest.boxShadow, undefined, `${name}: a row is lifted: rows are flat`)
      assert.equal(rest.minHeight, 64, `${name}: a row changed height`)

      for (const on of [false, true]) {
        const choice = Choice({ on, label: 'Fit everything on one screen', sub: 'Sub', onPress: () => {} })
        const box = find(choice, (el) => el.type === 'View' && el.props.style?.width === 28).props.style
        assert.deepEqual([box.width, box.height, box.borderRadius, box.borderWidth], [28, 28, 6, on ? 0 : 1], `${name}: the tick square changed shape`)
        assert.equal(box.borderColor, color.glassRim, `${name}: the tick square’s rule is not the glass’s rim`)
        assert.equal(box.backgroundColor, on ? color.signal : color.panel, `${name}: the tick square lost its amber when on`)
      }

      /* The facts are one flat card: a list of rows is never lifted, and Messages from users draws them inside a sheet. */
      const facts = Facts({ title: 'People', rows: [{ label: 'A', value: 'B' }, { label: 'C', value: 'D' }] })
      const card = find(facts, (el) => el.type === 'GlassCard')
      assert.ok(card && card.props.flat === true && !card.props.bordered, `${name}: the facts are not one flat card of glass`)
      assert.deepEqual(card.props.style, { paddingHorizontal: 12 }, `${name}: the facts’ card changed its padding`)
      assert.deepEqual([look(1, false).borderTopWidth, look(1, false).borderTopColor, look(0, false).borderTopWidth], [1, color.glassRim, 0], `${name}: the lines between the facts are not the glass’s rim`)

      /* A log line is on the glass's fill and nothing more: hundreds of them, and text takes no shadow. */
      const line = Line({ text: 'x', hot: false }).props.style
      assert.equal(line.backgroundColor, color.glassFill, `${name}: a log line is not on the glass`)
      assert.equal(line.boxShadow, undefined, `${name}: a log line is lifted`)
      assert.equal(line.borderRadius, 6, `${name}: a log line changed its corner`)
    })
    /* Its least height is its label and one line under it; with the slop it reaches a thumb, and never the row 12 below. */
    const least = font.body * 1.2 + 4 + font.small * 1.5
    assert.ok(least < THUMB, 'a tick box row is a thumb’s height already; the slop is not needed')
    assert.ok(least + CHOICE_SLOP.top + CHOICE_SLOP.bottom >= THUMB, `a tick box row is ${least + CHOICE_SLOP.top + CHOICE_SLOP.bottom} to a thumb, under ${THUMB}`)
    assert.ok(CHOICE_SLOP.bottom < 12 / 2 && CHOICE_SLOP.top < 12 / 2, 'a tick box row’s reach overlaps the row beside it')
    /* The signature and the role, as the tile size check reads them. */
    assert.match(read(FILES.settings), /function Choice\(\{ on, label, sub, onPress, role = 'checkbox' \}\)[\s\S]{0,80}accessibilityRole=\{role\}/)
    /* And the long lists elsewhere are flat glass too. */
    assert.match(code(FILES.gear), /borderWidth: 1, \.\.\.glassCard\(\{ bordered: true, flat: true, pressed \}\) \}\)\}/, 'a model’s row is not flat glass')
    assert.match(code(FILES.footswitches), /<View key=\{i\} style=\{\{ gap: space\.xs, padding: space\.md, borderWidth: 1, \.\.\.glassCard\(\{ bordered: true, flat: true \}\) \}\}>/, 'a switch’s card is not flat glass')
  })

  test('glass in Settings: every text field is frosted glass at the card’s corner, a rounded box and never a capsule', async () => {
    const { glassField, glassCard } = await import('../mobile/src/lib/glass.js')
    await eachPalette((name, color) => {
      const field = glassField()
      assert.deepEqual(field, { backgroundColor: color.glassFill, borderColor: color.glassRim, borderRadius: 18 }, `${name}: a field is not frosted glass at the card’s corner`)
      assert.equal(glassCard({ bordered: true }).borderRadius, 18)
    })
    /* Each field's own style: the glass, its border's width kept, and no corner of its own after it. */
    const box = (text, at) => {
      const from = text.indexOf(at)
      assert.ok(from >= 0, `${at} is not there; this check reads it`)
      return text.slice(from, text.indexOf('}', from))
    }
    const fields = [
      ['the feedback form’s message and email', box(code(FILES.report), 'const box = {')],
      ['the VP4’s two numbers', box(code(FILES.vp4), 'const box = {')],
      ['Amp & pedal names’ search', box(code(FILES.gear), 'accessibilityLabel="Find an amp or pedal" style={{')],
      ['the log’s note', box(code(FILES.log), 'accessibilityLabel="What happened, if you want to say" style={{')],
      ['Connect’s email box', box(code(FILES.connect), "flexDirection: 'row', alignItems: 'center', minHeight: TAP + 8,")]
    ]
    for (const [what, style] of fields) {
      assert.match(style, /borderWidth: 1, \.\.\.glassField\(\)/, `${what} is not a field of glass, or lost its border`)
      assert.doesNotMatch(style, /borderRadius|backgroundColor|borderColor/, `${what} draws its own corner or colour over the glass’s`)
      assert.doesNotMatch(style, /boxShadow|elevation/, `${what} is lifted: a field is never lifted`)
    }
    /* The message box is far taller than twice the corner: a rounded box, never a capsule. */
    assert.match(code(FILES.report), /style=\{\{ \.\.\.box, minHeight: 140, lineHeight: 22 \}\}/, 'the message box changed its height')
    assert.ok(18 * 2 < 140, 'the message box would be a capsule')
    /* The log preview on the feedback form and the address box are wells in the glass. */
    assert.match(code(FILES.report), /<ScrollView nestedScrollEnabled style=\{\{ maxHeight: 220, backgroundColor: color\.glassWell, borderRadius: radius\.sm \}\}/, 'the log preview is not a well in the glass')
  })

  test('glass in Settings: the Fixes page wears it with the imports it had, so its bench still stands in for every one', () => {
    const src = read(FILES.fixes)
    assert.deepEqual(src.split('\n').filter((l) => l.startsWith('import ')), FIXES_IMPORTS, 'Fixes.js changed an import: no-computer.mjs draws it on a bench that stands in for these alone')
    const panel = code(FILES.fixes)
    assert.match(panel, /\{isOpen \? \( <View style=\{\{ gap: space\.md, padding: space\.md, borderWidth: 1, borderColor: color\.glassRim, borderRadius: radius\.card, backgroundColor: color\.glassFill, boxShadow: color\.glassLift \}\} >/, 'a fix’s steps are not on a card of glass, or its border or padding changed')
  })

  test('glass in Settings: Connect’s pill stays green, its card and the Bluetooth panels are glass, and the cable between the cards takes the rim', async () => {
    const connect = code(FILES.connect)
    assert.match(connect, /borderRadius: radius\.pill, borderWidth: 1, borderColor: color\.ok, backgroundColor: color\.glassFill, boxShadow: color\.glassLift \}\}/, 'Connect’s pill is not a green capsule of glass')
    assert.match(connect, /padding: space\.lg, gap: space\.lg, borderWidth: 1, \.\.\.glassCard\(\{ bordered: true, classicCorner: radius\.lg \}\) \}\}/, 'Connect’s card is not bordered glass, at its old corner in Classic')
    /* The laptop's square went with the three steps (9 November 2026); each step's number is a solid disc of the app's amber, never glass, so it reads over the card. */
    assert.match(connect, /width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: color\.signal \}\}/, 'a step’s number is not a solid amber disc')
    assert.equal((connect.match(/<View style=\{\{ flex: 1, height: 1, backgroundColor: color\.glassRim \}\} \/>/g) || []).length, 2, 'the two rules either side of “or” are not the glass’s rim')

    const { Row, BluetoothTried } = await bench(FILES.bluetooth, ['function Row(', 'function BluetoothTried('], {
      face: 'monospace',
      Hint: 'Hint',
      BLE_UNITS: [{ key: 'am4', name: 'AM4' }],
      waysFor: () => [],
      untried: () => false,
      TRIED_NOTES: {}
    })
    const { ChainWire } = await bench(FILES.walk, ['function ChainWire('], {})
    await eachPalette((name, color) => {
      const panels = [Row({ row: { asked: 'A', out: '', back: '', meaning: 'M', ms: 1 } }), find(BluetoothTried(), (el) => el.type === 'View' && el.props.style?.gap === 2)]
      for (const el of panels) {
        const s = el.props.style
        assert.deepEqual([s.backgroundColor, s.borderRadius, s.boxShadow, s.borderWidth], [color.glassFill, 10, color.glassFlat, undefined], `${name}: a Bluetooth panel is not flat glass, or gained a border`)
        assert.deepEqual([s.gap, s.padding], [2, 8], `${name}: a Bluetooth panel moved`)
      }
      for (const lit of [false, true]) {
        const wire = ChainWire({ label: 'USB', lit })
        const pill = wire.children.find((el) => el.props.style?.borderRadius)
        assert.deepEqual([pill.props.style.borderRadius, pill.props.style.backgroundColor], [999, color.chassis], `${name}: the cable’s label lost its capsule or its fill`)
        assert.equal(pill.props.style.borderColor, lit ? color.signal : color.glassRim, `${name}: the cable is not amber when lit and the glass’s rim when not`)
      }
    })
  })

  test('glass in Settings: the address box, the model page’s arrows and the pictures’ frames; the tick box keeps the outline that shows it', async () => {
    const copy = code(FILES.copy)
    assert.match(copy, /borderRadius: radius\.card, borderWidth: 1, borderColor: copied \? color\.signal : color\.glassRim, backgroundColor: pressed \? color\.glassFillHi : color\.glassWell \}\)\}/, 'the address box is not a well in the glass, or lost its amber once copied')
    assert.match(copy, /borderWidth: 1, \.\.\.glassCard\(\{ bordered: true, pressed, classicCorner: radius\.lg \}\), borderColor: copied \? color\.signal : color\.glassRim \}\)\}/, 'the address card is not glass, or lost its amber once copied')
    assert.match(copy, /width: 44, height: 44, borderRadius: radius\.md,/, 'the copy button’s square changed')

    const { Arrow } = await bench(FILES.gearCard, ['function Arrow('], { chevronIcon: 1 })
    await eachPalette((name, color) => {
      const arrow = Arrow({ side: 'left', onPress: () => {}, label: 'Previous' })
      const rest = styleOf(arrow)
      assert.deepEqual([rest.width, rest.height, rest.borderRadius, rest.borderWidth, arrow.props.hitSlop], [44, 44, 22, 1, 8], `${name}: the arrow changed size or reach`)
      assert.deepEqual([rest.backgroundColor, styleOf(arrow, true).backgroundColor, rest.borderColor, rest.boxShadow], [color.glassFill, color.glassFillHi, color.glassRim, color.glassLift], `${name}: the arrow is not a round of glass`)
    })
    for (const file of [FILES.shots, FILES.attach]) {
      assert.doesNotMatch(code(file), /color\.rule/, `${file}: a picture’s frame is not the glass’s rim`)
      assert.match(code(file), /borderRadius: radius\.sm, borderWidth: 1, borderColor: color\.glassRim, backgroundColor: color\.panel/, `${file}: a picture’s frame changed`)
    }

    /*
     * THE TICK BOX ON THE FEEDBACK FORM KEEPS ITS OUTLINE. An unticked box is
     * shown by its outline alone, and a control's outline wants 3:1 against
     * what is round it to be found at all: the glass's rim would draw it at
     * about 1.4:1, a box nobody sees until it is ticked. So it stays the
     * faint grey it was, on its 44 target, and only the rim-ruled squares
     * (Settings' tick boxes, ruled before) take the glass's rim.
     */
    const tickBox = code(FILES.tickBox)
    assert.match(tickBox, /minHeight: 44,/, 'the tick box is under a thumb')
    assert.match(tickBox, /width: 28, height: 28, borderRadius: radius\.sm, borderWidth: on \? 0 : 1, borderColor: color\.silkFaint,/, 'the tick box lost the outline that shows it')
    await eachPalette((name, color) => {
      for (const ground of [color.chassis, over(color.glassFill, color.chassis)]) {
        assert.ok(contrast(color.silkFaint, ground) >= 3, `${name}: an unticked box’s outline is under 3:1 on ${ground}`)
      }
      assert.ok(contrast(over(color.glassRim, color.chassis), color.chassis) < 3, `${name}: the glass’s rim would show a tick box after all; this note is out of date`)
    })
  })

  test('glass in Settings: no blur, sheet or pop-up is added, no see-through fill has an elevation, and no style is built at load', () => {
    for (const file of Object.values(FILES)) {
      const text = code(file)
      assert.doesNotMatch(text, /<BlurView|<Modal\b|BlurTargetView|blurTarget/, `${file} draws a blur or a pop-up of its own`)
      /* Every elevation is on a solid fill: Undo's, over the cards. */
      for (const m of text.matchAll(/elevation: \d+/g)) {
        const fills = [...text.slice(Math.max(0, m.index - 400), m.index).matchAll(/backgroundColor: ([^,}]+)/g)]
        assert.equal(fills.at(-1)?.[1], 'color.chassis', `${file}: an elevation on a fill that is not solid shows through it`)
      }
      /* A style that reads the theme at load is never repainted: every one is built when it is drawn. */
      for (const decl of read(file).split(/\n(?=\S)/)) {
        /* A read inside an arrow (`ok: () => color.ble`) is made when it is called, which is when it is drawn. */
        if (/^const \w+ = \{/.test(decl)) assert.doesNotMatch(decl.replace(/=>[^,}\n]*/g, ' '), /color\./, `${file}: ${decl.slice(0, 40)}… reads the theme once, at load`)
      }
    }
    assert.equal((code(FILES.settings).match(/<Sheet\b/g) || []).length, 2, 'Settings has a sheet it did not have')
    assert.equal((code(FILES.colours).match(/<Sheet\b/g) || []).length, 1, 'Colors has a sheet it did not have')
    assert.equal(code(FILES.colours).match(/elevation: \d+/g)?.length, 1, 'Colors gained an elevation, or lost Undo’s')
  })

  test('glass in Settings: every word on the new glass reads at 4.5:1 with no credit for a blur, and a press is never harder to read than it was', async () => {
    await eachPalette((name, c) => {
      const card = over(c.glassFill, c.chassis)
      const grounds = {
        'a card on the page': card,
        'a card pressed': over(c.glassFillHi, c.chassis),
        'a group’s heading or row pressed': over(c.glassFillHi, card),
        'a field on a card': over(c.glassFill, card),
        'a well in a card': over(c.glassWell, card),
        'a well on the page': over(c.glassWell, c.chassis),
        'a well pressed': over(c.glassFillHi, card)
      }
      /* What was drawn pressed before: the panel's own press, solid. */
      const before = c.panelHi
      const pieces = [
        ['a group’s heading, and the rows inside it', 'a card on the page', 'a group’s heading or row pressed', ['silk', 'ok', 'silkFaint']],
        ['a row on the page', null, 'a card pressed', ['silk', 'ok', 'silkFaint']],
        ['the account card', 'a card on the page', 'a card pressed', ['silk', 'signal', 'ok', 'silkDim', 'silkFaint']],
        ['a tip card', 'a card on the page', 'a card pressed', ['signal', 'silkDim', 'fault']],
        ['a look’s card, and the off choice', 'a card on the page', 'a card pressed', ['silk', 'signal', 'silkDim']],
        ['Connect’s pill, card and email box', 'a card on the page', null, ['ok', 'silk', 'silkDim', 'silkFaint']],
        ['the facts, the Bluetooth panels, the switches, the steps on Fixes and a log line', 'a card on the page', null, ['silk', 'silkDim', 'silkFaint', 'ok', 'fault']],
        ['a model’s row', 'a card on the page', 'a card pressed', ['silk', 'ok', 'silkFaint']],
        ['the feedback form’s email box and tick boxes, on its card', 'a field on a card', null, ['silk', 'silkDim', 'silkFaint']],
        ['the address box, in a card', 'a well in a card', 'a well pressed', ['silk']],
        ['the address box, on the page', 'a well on the page', 'a card pressed', ['silk']],
        ['the log preview', 'a well in a card', null, ['silkDim']]
      ]
      for (const [what, rest, pressed, inks] of pieces) {
        for (const ink of inks) {
          if (rest) {
            const r = contrast(c[ink], grounds[rest])
            assert.ok(r >= 4.5, `${name}: ${ink} on ${what} is ${r.toFixed(2)}:1, under 4.5`)
          }
          if (pressed) {
            const now = contrast(c[ink], grounds[pressed])
            const was = contrast(c[ink], before)
            assert.ok(now >= was - 0.005, `${name}: ${ink} on ${what}, pressed, is ${now.toFixed(2)}:1, harder to read than the ${was.toFixed(2)} it was`)
          }
        }
      }
    })
  })
}
