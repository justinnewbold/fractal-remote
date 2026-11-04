/**
 * Frosted glass on the phone: the lists, Edit, and the screens a player meets
 * first (the walkthrough, the sign-in, the purchase page and the two cards at
 * startup).
 *
 * "Let's go ahead and do the other one with the frosted glass look" (3
 * November 2026), and "I just don't wanna lose all the colors and current
 * color scheme cause I like those also." So the rows keep their colour tags,
 * the knobs and the chain's tiles are content and stay, and what holds a
 * control turns to glass: the find boxes, the cards, the choices. Only the
 * material changes, never a place, a size, a word or a press, and no blur and
 * no pop-up is added.
 *
 * TWO THINGS THAT CANNOT BE GLASS. A row with SwipeAway's red ✕ behind it
 * would let the red through a see-through fill, so it stays opaque (the
 * setlist's songs, and the chain's cards on Edit, whose folded-out parts sit
 * on the page's own ground). And a row in a long list has the light along its
 * top and no drop shadow, so a list of hundreds stays quick on an older
 * Android phone.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@babel/parser'
import babelTraverse from '@babel/traverse'

/* CommonJS interop: @babel/traverse's default export is on `.default` under ESM. */
const traverse = babelTraverse.default || babelTraverse

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* Code only, one space for any run of white: comments go, JSX ones with their braces. */
const flat = (text) =>
  text
    .replace(/\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ')
const tree = (p) => parse(read(p), { sourceType: 'module', plugins: ['jsx'] })

const PRESETS = 'mobile/src/screens/Presets.js'
const SETLISTS = 'mobile/src/screens/Setlists.js'
const EDIT = 'mobile/src/screens/Edit.js'
const SIGN_IN = 'mobile/src/screens/SignIn.js'
const ONBOARDING = 'mobile/src/screens/Onboarding.js'
const PAYWALL = 'mobile/src/screens/Paywall.js'
const PICKER = 'mobile/src/components/SongPicker.js'
const SONG_SETUP = 'mobile/src/components/SongSetup.js'
const NOTICES = ['mobile/src/components/IndependentNotice.js', 'mobile/src/components/GearShareNotice.js']
const FILES = [
  PRESETS, SETLISTS, EDIT, SIGN_IN, ONBOARDING, PAYWALL, PICKER, SONG_SETUP,
  'mobile/src/components/RowsPanel.js', 'mobile/src/components/IrPicker.js', 'mobile/src/components/RenamePreset.js',
  ...NOTICES
]

/* The source of one top-level function or const of a file, by its name. */
function named(file, name) {
  const text = read(file)
  let found = null
  traverse(tree(file), {
    FunctionDeclaration(path) {
      if (!found && path.node.id?.name === name) found = text.slice(path.node.start, path.node.end)
    },
    VariableDeclarator(path) {
      if (!found && path.node.id?.name === name && path.parentPath.parentPath?.isProgram()) {
        found = text.slice(path.node.start, path.node.end)
      }
    }
  })
  assert.ok(found, `${file} has no ${name}`)
  return found
}

/* An object literal's own keys, as { key: source of its value }, and its spreads, as source. */
function readObject(text, obj) {
  const keys = {}
  const spreads = []
  for (const p of obj.properties) {
    if (p.type === 'SpreadElement') spreads.push(text.slice(p.argument.start, p.argument.end))
    else if (p.type === 'ObjectProperty') keys[p.key.name || p.key.value] = text.slice(p.value.start, p.value.end)
  }
  return { keys, spreads }
}

/* The style object a JSX element is given: a literal, or the one a `({ pressed }) => ({ … })` returns. */
function styleOf(attr) {
  const v = attr?.value?.type === 'JSXExpressionContainer' ? attr.value.expression : null
  if (!v) return null
  if (v.type === 'ObjectExpression') return v
  if (v.type === 'ArrowFunctionExpression' && v.body.type === 'ObjectExpression') return v.body
  return null
}

/* Every text box in a file, with what its style says. */
function fields(file) {
  const text = read(file)
  const out = []
  traverse(tree(file), {
    JSXOpeningElement(path) {
      if (path.node.name.name !== 'TextInput') return
      const attr = path.node.attributes.find((a) => a.name?.name === 'style')
      const obj = styleOf(attr)
      out.push({ line: path.node.loc.start.line, style: obj ? readObject(text, obj) : null, raw: attr ? text.slice(attr.start, attr.end) : '' })
    }
  })
  return out
}

export function run(test) {
  test('glass screens: a setlist song stays opaque over its red ✕, its colour tag last, with the light along its top', () => {
    const song = named(SETLISTS, 'Song')
    assert.match(song, /<SwipeAway onRemove=\{onRemove\} label=\{`Remove \$\{name\}`\} demo=\{demo\}>/, 'the song is no longer the row a swipe takes away')
    /* both-ends.mjs holds the tag last too: a bar the row is drawn over would be no bar. */
    assert.match(song, /tagEdge\(tag\)\n\s*\]\}/, 'the colour tag is no longer the last thing the row is drawn with')
    const style = flat(song.slice(song.indexOf('style={['), song.indexOf('tagEdge(tag)')))
    assert.match(style, /backgroundColor: lifted \? color\.panelHi : color\.panel,/, 'the song row is see-through, so the red ✕ behind it shows')
    assert.match(style, /boxShadow: color\.glassTop \}/, 'the song row has lost the light along its top')
    assert.match(style, /borderRadius: radius\.md,/, 'the row with a colour bar is rounder than the bar can stay straight in')
    assert.match(style, /borderWidth: playing \|\| lifted \? 2 : 1,/, 'the row border changed its width')
    assert.doesNotMatch(style, /glassFill|glassLift|glassCard|elevation/, 'the song row is see-through, or casts a drop in a list')

    /* The choice of what Previous and Next walk: a card of glass, the chosen one in amber still. */
    const source = flat(named(SETLISTS, 'SourceRow'))
    assert.match(source, /\.\.\.glassCard\(\{ bordered: true, pressed: pressed && !classic\(\) \}\), borderWidth: on \? 2 : 1, \.\.\.\(on \? \{ borderColor: color\.signal, backgroundColor: color\.signalWash \} : null\),/, 'the chosen source lost its amber edge and wash, or the glass is drawn over them')
    assert.match(source, /minHeight: TAP, justifyContent: 'center', paddingHorizontal: space\.md, paddingVertical: space\.sm,/, 'the source row moved')
    const hint = flat(named(SETLISTS, 'SwipeHint'))
    assert.match(hint, /borderRadius: radius\.card, borderWidth: 1, borderColor: color\.signal, backgroundColor: color\.signalWash/, 'the swipe hint is not a card at the glass corner, in amber')
  })

  test('glass screens: a preset row is the row it was, the same flat glass tagged or not, and the star and the jumps have the light and no drop', async () => {
    const src = read(PRESETS)
    const all = flat(src)
    /* both-ends.mjs: nothing between the row and its star. */
    assert.match(src, /style=\{tagEdge\(tag\)\}\s*\/>\s*<Star/, 'something sits between a preset row and its star again')
    const row = flat(src.slice(src.lastIndexOf('<Press', src.indexOf('style={tagEdge(tag)}')), src.indexOf('<Star', src.indexOf('style={tagEdge(tag)}'))))
    assert.doesNotMatch(row, /glass|boxShadow|backgroundColor|borderRadius/, 'the preset row draws its own glass; Press does it')
    /* Every row a bar can go down, so a tagged row and an untagged one are the same shape and glass; flat, as a long list is. */
    assert.match(row, / bar flat style=\{tagEdge\(tag\)\}/, 'a preset row takes its shape from whether it has a tag, or casts a drop in a long list')
    assert.match(row, /grow height=\{ROW\}/, 'the preset row is not ROW tall')
    assert.match(src, /const ROW = TAP/)
    assert.match(src, /const STRIDE = ROW \+ GAP/)
    assert.match(src, /marginBottom: GAP/)

    /* Play's preset name is the other button a preset's tag goes down: the bar's corner and glass, tagged or not. */
    const stage = flat(read('mobile/src/screens/Stage.js'))
    assert.match(stage, / bar style=\{\[\{ paddingHorizontal: space\.lg \}, tagEdge\(presetTag\(preset\?\.number\)\)\]\}/, 'Play’s preset name changes shape between a tagged preset and an untagged one')
    const press = read('mobile/src/components/Press.js')
    assert.match(press, /const corner = bar \|\| classic\(\) \? radius\.md :/, 'Press rounds a button a colour bar goes down past what keeps the bar straight')

    /* The jumps: the light along the top only. */
    assert.match(
      all,
      /<Press key=\{n\} grow fit fitWith=\{jumpLabels\.filter\(\(_, j\) => j !== i\)\} label=\{jumpLabels\[i\]\} height=\{44\} onPress=\{\(\) => jumpTo\(n\)\} style=\{\{ boxShadow: color\.glassTop \}\} \/>/,
      'the jump buttons are not the light along the top only, or they changed'
    )
    /* The star: its TAP square at the small corner, glass with the light along its top, amber when starred, no drop. */
    const star = flat(named(PRESETS, 'Star'))
    assert.match(star, /width: TAP, minHeight: TAP, alignItems: 'center', justifyContent: 'center', borderRadius: radius\.md, borderWidth: 1, borderColor: on \? color\.signal : color\.glassRim, backgroundColor: color\.glassFill, boxShadow: color\.glassTop, opacity: pressed \? 0\.7 : 1/, 'the star is not the glass the design gives it')
    assert.doesNotMatch(star, /glassLift|elevation/, 'the star casts a drop in a long list')

    /*
     * The two other places a preset's tag is drawn (components/PresetTag): the
     * button on Settings → Colors, a button of glass on the page at the bar's
     * corner, as Press's `bar` is; and the colour sheet's preview of the row,
     * drawn as the row in the list is, flat. Both keep their size, and the
     * tag's bar last, so it is the bar the list draws.
     */
    const tags = 'mobile/src/components/PresetTag.js'
    assert.match(
      flat(named(tags, 'TagRow')),
      /minHeight: TAP, paddingHorizontal: space\.md, borderRadius: radius\.md, borderWidth: 1, borderColor: color\.glassRim, backgroundColor: pressed \? color\.glassFillHi : color\.glassFill, boxShadow: color\.glassLift, \.\.\.tagEdge\(fill\) \}\)/,
      'the tag button on Colors is not glass at the bar’s corner, or its size or its bar moved'
    )
    assert.match(
      flat(named(tags, 'TagPreview')),
      /minHeight: TAP, justifyContent: 'center', paddingHorizontal: space\.md, borderRadius: radius\.md, borderWidth: 1, borderColor: color\.glassRim, backgroundColor: color\.glassFill, boxShadow: color\.glassTop, \.\.\.tagEdge\(fill\) \}\}/,
      'the colour sheet’s preview is not the preset row’s flat glass, or its size or its bar moved'
    )
  })

  test('glass screens: every find box and text field on these screens is a glass field, at the card corner, with no shadow', () => {
    const counts = { [PRESETS]: 1, [PICKER]: 1, [SONG_SETUP]: 1, [EDIT]: 3, 'mobile/src/components/IrPicker.js': 1, 'mobile/src/components/RenamePreset.js': 1, [SIGN_IN]: 1, [ONBOARDING]: 1 }
    for (const [file, n] of Object.entries(counts)) {
      const src = read(file)
      assert.match(src, /^import \{[^}]*\bglassField\b[^}]*\} from '\.\.\/lib\/glass'$/m, `${file} does not take its fields from lib/glass`)
      assert.equal(flat(src).split('...glassField()').length - 1, n, `${file} has a different number of glass fields from the boxes it draws`)
    }
    const misses = []
    for (const file of FILES) {
      for (const f of fields(file)) {
        if (!f.style) continue
        const { keys, spreads } = f.style
        const where = `${file}:${f.line}`
        const glass = spreads.includes('glassField()')
        /* ValueBox, the number under a knob, is glass at its small corner (it is 32 tall). */
        const small = keys.backgroundColor === 'color.glassFill' && keys.borderColor === 'color.glassRim' && keys.borderRadius === 'classic() ? radius.sm : radius.md'
        if ('borderWidth' in keys && !glass && !small) misses.push(`${where}: a boxed field that is not glass`)
        if (glass && 'borderRadius' in keys) misses.push(`${where}: a glass field with a corner of its own`)
        if (glass && keys.borderWidth !== '1') misses.push(`${where}: a glass field whose border is not the 1 it had`)
        for (const k of ['boxShadow', 'elevation']) if (k in keys) misses.push(`${where}: a field with ${k}`)
        for (const [k, v] of Object.entries(keys)) if (/color\.(panel|rule)\b/.test(v)) misses.push(`${where}: ${k} is still ${v}`)
      }
    }
    assert.deepEqual(misses, [], `fields that are not glass:\n  ${misses.join('\n  ')}`)

    /* The number under a knob, in Edit. */
    assert.match(flat(named(EDIT, 'ValueBox')), /minHeight: 32, textAlign: 'center', borderRadius: classic\(\) \? radius\.sm : radius\.md, borderWidth: 1, borderColor: color\.glassRim, backgroundColor: color\.glassFill,/, 'the value under a knob is not glass at its small corner')
    /* The sign-in field is the box round the picture and the words, as tall as it was, its hairline the glass rim. */
    const signIn = flat(named(SIGN_IN, 'Field'))
    assert.match(signIn, /minHeight: TAP \+ 8, borderWidth: 1, \.\.\.glassField\(\) \}/, 'the sign-in field is not a glass field as tall as it was')
    assert.match(signIn, /<View style=\{\{ width: 1, alignSelf: 'stretch', marginVertical: space\.sm, backgroundColor: color\.glassRim \}\} \/>/, 'the hairline beside the picture is not the glass rim')
    assert.match(flat(named(ONBOARDING, 'Field')), /padding: space\.md, minHeight: TAP, borderWidth: 1, \.\.\.glassField\(\) \}/, 'the walkthrough field is not a glass field')
    /* The setlist name is typed in its own card, and has no box of its own. */
    assert.ok(fields(SETLISTS).every((f) => !f.style || !('borderWidth' in f.style.keys)), 'the setlist name has grown a box')
  })

  test('glass screens: the amber button of the walkthrough keeps its glow and elevation, and is lit glass', () => {
    const cta = flat(named(ONBOARDING, 'Cta'))
    assert.match(cta, /backgroundColor: color\.signal,/, 'the amber button is not amber')
    assert.match(cta, /shadowColor: color\.signal, shadowOpacity: 0\.35, shadowRadius: 16, shadowOffset: \{ width: 0, height: 4 \}, elevation: 6,/, 'the amber button lost its glow or its elevation')
    assert.match(cta, /boxShadow: color\.glassLitTop, experimental_backgroundImage: color\.glassSheen \}/, 'the amber button is not lit glass')
    assert.doesNotMatch(cta, /color\.glassLit\b|glassLift|glassFill/, 'the amber button has a second drop under its glow, or a see-through fill under its elevation')
    assert.match(cta, /minHeight: TAP \+ 16, paddingHorizontal: space\.xl, borderRadius: radius\.lg,/, 'the amber button changed its size or corner')
  })

  test('glass screens: the two cards at startup are glass cards at the card corner, still centred by the view that grows with them', () => {
    for (const file of NOTICES) {
      const text = read(file)
      assert.match(text, /^import \{ cardCorner, glassCard \} from '\.\.\/lib\/glass'$/m, `${file} does not take its card from lib/glass`)
      let card = null
      let parent = null
      traverse(tree(file), {
        JSXOpeningElement(path) {
          if (card || !path.node.attributes.some((a) => a.name?.name === 'accessibilityViewIsModal')) return
          card = readObject(text, styleOf(path.node.attributes.find((a) => a.name?.name === 'style')))
          const up = path.parentPath.findParent((p) => p.isJSXElement())
          parent = up ? readObject(text, styleOf(up.node.openingElement.attributes.find((a) => a.name?.name === 'style'))) : null
        }
      })
      assert.ok(card, `${file} has lost its card, or the card is no longer modal to a screen reader`)
      assert.deepEqual(card.spreads, ['glassCard({ bordered: true })'], `${file}: the card is not a rimmed glass card`)
      assert.equal(card.keys.borderRadius, 'cardCorner(radius.lg)', `${file}: the card is not at the card corner, or at its old radius.lg in Classic`)
      assert.equal(card.keys.borderWidth, '1', `${file}: the card border changed its width`)
      assert.equal(card.keys.padding, 'space.xl', `${file}: the card moved its words`)
      assert.ok(!('backgroundColor' in card.keys) && !('borderColor' in card.keys), `${file}: the card paints over its glass`)
      assert.deepEqual(parent?.keys, { flexGrow: '1', justifyContent: "'center'" }, `${file}: the card is no longer centred by the view that grows with it`)
      /* mobile.mjs: never a scroll view that centres what can outgrow it. */
      assert.match(text, /contentContainerStyle=\{\{ flexGrow: 1, padding: space\.xl \}\}/, `${file}: the scroll view under the card changed`)
    }
    assert.ok(read(NOTICES[0]).includes('{NOT_AFFILIATED}'), 'the startup card no longer says the sentence')
  })

  test('glass screens: the chain cards on Edit sit on the page ground over their red ✕, and their colours stay', () => {
    const edit = read(EDIT)
    const card = flat(named(EDIT, 'BlockCard'))
    assert.match(card, /return \( <View style=\{\{ gap: space\.sm, backgroundColor: classic\(\) \? undefined : color\.chassis \}\}>/, 'what folds out under a chain card is glass over the red ✕ behind it')
    /* Its head is a Press with the colour bar, on the opaque panel (`bar="solid"`, the rule held in glass.mjs). */
    assert.match(card, /<Press grow caption=\{at\} label=\{block\.name\} on=\{lifted\} tone="signal" bar="solid" style=\{\{ borderLeftWidth: 4, borderLeftColor: hue\.fill \}\}/, 'the chain card lost its colour bar, or its opaque panel')
    /* Green to add, red to take away: the washes are meaning, and stay. */
    assert.match(card, /style=\{\{ borderColor: color\.ok, backgroundColor: tint\(color\.ok, 0\.16\) \}\}/)
    assert.match(card, /style=\{\{ borderColor: color\.fault, backgroundColor: tint\(color\.fault, 0\.16\) \}\}/)
    /* The chain card is the only thing a swipe takes away on Edit. */
    const swiped = []
    traverse(tree(EDIT), {
      JSXElement(path) {
        if (!['Swipeable', 'SwipeAway'].includes(path.node.openingElement.name.name)) return
        for (const child of path.node.children) if (child.type === 'JSXElement') swiped.push(child.openingElement.name.name)
      }
    })
    /* Swipeable is the one SwipeAway on Edit, handing it what it holds as it is, and it holds the chain card alone. */
    assert.deepEqual(swiped, ['BlockCard'], 'something else is swiped away on Edit, and it may be glass')
    assert.match(flat(named(EDIT, 'Swipeable')), /return on \? <SwipeAway \{\.\.\.rest\}>\{children\}<\/SwipeAway> : children/, 'the swipe on Edit wraps more than the card it is given')
    assert.match(read('mobile/src/components/SwipeAway.js'), /backgroundColor: color\.fault,/, 'the ✕ behind is no longer red, so the reason for all this has moved')
    /* Content stays content: the strip of tiles. */
    assert.ok(edit.includes('style={{ width: 84, opacity: engaged ? 1 : 0.55 }}'), 'the chain strip tiles changed')
  })

  test('glass screens: the cards on the walkthrough, the sign-in and the purchase page are glass, and the chosen ones stay amber', () => {
    /* The sign-in steps: a rimmed card with its light, the amber number rounds as they were. */
    const signIn = flat(read(SIGN_IN))
    assert.match(signIn, /<View style=\{\{ \.\.\.glassCard\(\{ bordered: true, classicCorner: radius\.lg \}\), borderWidth: 1, padding: space\.lg, gap: space\.md \}\} > <Text style=\{\{ color: color\.silk, fontSize: font\.title, fontWeight: '800' \}\}>\{SETUP\.title\}/, 'the sign-in steps are not a glass card')
    assert.match(signIn, /borderRadius: 15, backgroundColor: color\.signal,/, 'the amber step numbers changed')
    assert.match(signIn, /label=\{SETUP\.howTo\} icon=\{externalIcon\} disabled=\{busy\} onPress=\{\(\) => setHelping\(true\)\} style=\{\{ borderColor: color\.signal \}\}/, 'How to connect lost its amber edge')

    const onb = (name) => flat(named(ONBOARDING, name))
    assert.match(onb('UnitTile'), /\.\.\.glassCard\(\{ bordered: true, pressed, classicCorner: radius\.lg \}\), borderWidth: on \? 2 : 1, \.\.\.\(on \? \{ borderColor: color\.signal, backgroundColor: tint\(color\.signal, 0\.14\) \} : null\)/, 'the unit picked is not amber over its glass')
    assert.match(onb('Choice'), /\.\.\.glassCard\(\{ bordered: true, classicCorner: radius\.lg \}\), borderWidth: 1, \.\.\.\(lit \? \{ borderColor: color\.signal, backgroundColor: color\.signalWash \} : null\)/, 'the way to press is not amber over its glass')
    assert.match(onb('ChainBox'), /padding: tight \? space\.md : space\.lg, \.\.\.glassCard\(\{ bordered: true, classicCorner: radius\.lg \}\), borderWidth: 1 \}/, 'the three boxes are not glass cards')
    /* The cable is the drawing, not chrome: lit amber end to end, its ring included (Walk.js ChainWire's grey ring is an UNLIT cable's). */
    assert.match(onb('Wire'), /borderRadius: 999, borderWidth: 1, borderColor: color\.signal, backgroundColor: color\.chassis \}/, 'the lit cable’s ring is not amber, so it reads half unlit')
    assert.match(onb('Wire'), /<Text style=\{\{ color: color\.signal,/, 'the cable name is no longer lit')
    const welcome = flat(read(ONBOARDING))
    assert.match(welcome, /alignItems: 'center', padding: space\.sm, \.\.\.glassCard\(\{ bordered: true \}\), borderRadius: radius\.lg \* 1\.4, borderWidth: 1 \}/, 'the picture card is not glass with its own rounder corner')
    assert.match(welcome, /borderRadius: radius\.card, backgroundColor: tint\(color\.signal, 0\.1\), boxShadow: color\.glassLiftRing,/, 'the feature squares lost their amber wash, or are not glass')

    /* The purchase page: glass on the page, flat in the sheet it is when asked for. */
    assert.match(flat(read(PAYWALL)), /<View style=\{\{ \.\.\.glassCard\(\{ flat: asked, classicCorner: radius\.lg \}\), padding: space\.lg, gap: space\.md \}\} > <Text[^>]*> Presets, scenes, amp &amp; effect blocks/, 'the purchase page list is not a glass card, flat in its sheet')
    assert.match(read(PAYWALL), /return asked \? \(\s*<Sheet open/, 'the purchase page asked for is no longer the sheet the card is flat in')
  })

  test('glass screens: no drop in a long list, no elevation on glass, no new blur or pop-up, and nothing built before it is drawn', () => {
    /* Rows of a long list: the light along the top, no drop. */
    const picker = flat(named(PICKER, 'Row'))
    assert.match(picker, /height: ROW, marginBottom: GAP, paddingHorizontal: space\.md, borderRadius: radius\.card, borderWidth: 1, borderColor: on \? color\.signal : color\.glassRim, backgroundColor: color\.glassFill, boxShadow: color\.glassTop,/, 'a song picker row is not flat glass at the same height')
    assert.match(read(PICKER), /const ROW = TAP\nconst GAP = 8/)
    assert.match(flat(read(PICKER)), /borderTopWidth: 1, borderTopColor: color\.glassRim/, 'the picker foot rule is not the glass rim')
    assert.match(flat(read(SONG_SETUP)), /borderRadius: classic\(\) \? radius\.sm : capsule\(TAP\), borderWidth: 1, borderColor: on \? color\.signal : color\.glassRim, backgroundColor: on \? color\.signalWash : pressed && !classic\(\) \? color\.glassFillHi : color\.glassFill, boxShadow: color\.glassTop,/, 'a song setup choice is not a flat glass capsule')
    for (const [file, name] of [[PICKER, 'Row'], [PRESETS, 'Star'], [SETLISTS, 'Song']]) {
      assert.doesNotMatch(named(file, name), /glassLift|glassControl|elevation/, `${file} ${name} casts a drop in a long list`)
    }
    assert.doesNotMatch(read(SONG_SETUP), /glassLift|glassControl|elevation/, 'the song setup choices cast a drop, nine to a song')

    const misses = []
    for (const file of FILES) {
      const text = read(file)
      if (/<BlurView\b/.test(text)) misses.push(`${file}: a blur`)
      const modals = (text.match(/<Modal\b/g) || []).length
      if (modals !== (file === PICKER ? 1 : 0)) misses.push(`${file}: ${modals} pop-ups`)
      traverse(tree(file), {
        ObjectExpression(path) {
          const { keys, spreads } = readObject(text, path.node)
          const seeThrough = spreads.some((s) => /^glass(Card|Control|Field)\(/.test(s)) || /glassFill/.test(keys.backgroundColor || '')
          if ('elevation' in keys && seeThrough) misses.push(`${file}:${path.node.loc.start.line}: elevation on glass, which shows through it`)
        },
        CallExpression(path) {
          const name = path.node.callee?.name
          if (/^(glass[A-Z]\w*|capsule)$/.test(name || '') && !path.getFunctionParent()) misses.push(`${file}:${path.node.loc.start.line}: ${name} built once at load, so a change of theme never reaches it`)
        },
        MemberExpression(path) {
          if (path.node.object?.name === 'color' && /^glass/.test(path.node.property?.name || '') && !path.getFunctionParent()) {
            misses.push(`${file}:${path.node.loc.start.line}: color.${path.node.property.name} read once at load`)
          }
        }
      })
    }
    assert.deepEqual(misses, [], misses.join('\n'))
  })

  test('glass screens: the words on these screens say nothing a glass pass may not', () => {
    /* Edit (Beta) is another feature, and keeps its word; Bluetooth is never a beta. */
    const betaBluetooth = (s) => /bluetooth[^.]*\bbeta\b|\bbeta\b[^.]*bluetooth/i.test(s)
    const misses = []
    for (const file of FILES) {
      const text = read(file)
      traverse(tree(file), {
        StringLiteral(path) {
          const s = path.node.value
          if (/this phone/i.test(s)) misses.push(`${file}: "${s}" says this phone`)
          if (/\bofficial\b/i.test(s)) misses.push(`${file}: "${s}" says official`)
          if (betaBluetooth(s)) misses.push(`${file}: "${s}" calls Bluetooth a beta`)
        },
        JSXText(path) {
          const s = path.node.value
          if (/this phone|\bofficial\b/i.test(s) || betaBluetooth(s)) misses.push(`${file}: "${s.trim()}"`)
        }
      })
      assert.ok(text.length > 0)
    }
    assert.deepEqual(misses, [], misses.join('\n'))
  })
}
