/**
 * TWO SIDES ON A BIG SCREEN (mobile/src/lib/twoSides.js, components/Sides.js,
 * App.js): Play on one side, and Edit, Setlists, All presets or the tuner on the other,
 * on an iPad on its side, an Android tablet sideways or the iPhone Duo
 * opened; one screen, exactly as today, on every phone held upright, the
 * Duo closed or held tall, and an iPad upright. His account only until
 * features SIDES_FOR_EVERYONE opens it.
 *
 * The rule is run as it is (it imports nothing), with lib/playShape beside
 * it for Play's shape in a side; App.js, Sides.js and Stage.js are read for
 * how they draw with it. Nobody here has the Duo: its cases are its window
 * (951 by 669 opened, 466 by 678 closed, test/duo.mjs) and the 84-point
 * strip the plan gives it, run through the rule, never a device.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* Comments out, so a check reads the code and not its explanation. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

/** lib/twoSides, run from a copy, with lib/playShape (and the lib/gigSize it reads) beside it. */
async function rules() {
  const sides = read('mobile/src/lib/twoSides.js')
  assert.doesNotMatch(sides, /^import /m, 'lib/twoSides imports something; this check runs it on its own')
  const dir = mkdtempSync(join(tmpdir(), 'two-sides-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    writeFileSync(join(dir, 'twoSides.js'), sides)
    writeFileSync(join(dir, 'gigSize.js'), read('mobile/src/lib/gigSize.js'))
    writeFileSync(join(dir, 'playShape.js'), read('mobile/src/lib/playShape.js').replace("from './gigSize'", "from './gigSize.js'"))
    const t = await import(pathToFileURL(join(dir, 'twoSides.js')).href)
    const p = await import(pathToFileURL(join(dir, 'playShape.js')).href)
    return { ...t, ...p }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/*
 * A device's frame under the app's top bar: its window less the phone's own
 * top and bottom (about 44 together) and the bar (about 64), and less the
 * strip down one side where it has one. The Duo's strip is 84 (the plan);
 * its window opened is 951 by 669 and closed 466 by 678 (test/duo.mjs).
 */
const CHROME = 108
const frameOf = (width, height, { left = 0, right = 0 } = {}) => ({ width: width - left - right, height: height - CHROME, left, right })

export function run(test) {
  test('two sides on the Duo opened sideways, an iPad on its side, a Fold and a tablet; one screen on every phone upright, the Duo closed or tall, an iPad upright and a phone on its side', async () => {
    const r = await rules()
    const two = (w, h, insets) => r.twoSidesOn(frameOf(w, h, insets))
    /* Two sides. */
    assert.equal(two(951, 669, { right: 84 }), true, 'the iPhone Duo opened like a book, strip on the right')
    assert.equal(two(951, 669, { left: 84 }), true, 'the Duo opened, strip on the left')
    assert.equal(two(1180, 820), true, 'an 11-inch iPad on its side')
    assert.equal(two(1133, 744), true, 'an iPad mini on its side')
    assert.equal(two(1366, 1024), true, 'a 13-inch iPad on its side')
    assert.equal(two(841, 673), true, 'a Galaxy Fold opened')
    assert.equal(two(1280, 800), true, 'an Android tablet sideways')
    /* One screen, exactly as today. */
    assert.equal(two(669, 951, { top: 84 }), false, 'the Duo opened and held tall')
    assert.equal(two(466, 678, { right: 44 }), false, 'the Duo closed')
    assert.equal(two(469, 820), false, 'an iPad sharing its screen, the narrow half')
    assert.equal(two(590, 820), false, 'half an iPad')
    for (const [w, h] of [
      [320, 568],
      [375, 667],
      [390, 844],
      [393, 852],
      [411.43, 914.29],
      [430, 932],
      [440, 956]
    ]) {
      assert.equal(two(w, h), false, `a ${w}-point phone held upright`)
      assert.equal(two(h, w), false, `a ${w}-point phone on its side: wide enough, not tall enough`)
    }
    assert.equal(two(744, 1133), false, 'an iPad mini upright')
    assert.equal(two(820, 1180), false, 'an 11-inch iPad upright: wide enough, but its sides would stand one over the other')
    assert.equal(two(1024, 1366), false, 'a 13-inch iPad upright')
    /* Nothing measured yet: one screen, never a guess. */
    assert.equal(r.twoSidesOn({}), false)
    assert.equal(r.twoSidesOn({ width: 0, height: 0 }), false)
    assert.equal(r.twoSidesOn(), false)
  })

  test('each line goes off 40 under where it came on, both ways, so a divider dragged slowly or a Duo set down half-open does not flip', async () => {
    const r = await rules()
    const at = (width, was, height = 700) => r.twoSidesOn({ width, height }, was)
    assert.equal(r.LETS_GO, 40)
    /* On at the line, not under it. */
    assert.equal(at(r.SIDES_AT - 1, false), false)
    assert.equal(at(r.SIDES_AT, false), true)
    /* Off only 40 under it, once on. */
    assert.equal(at(r.SIDES_AT - 1, true), true)
    assert.equal(at(r.SIDES_AT - r.LETS_GO, true), true)
    assert.equal(at(r.SIDES_AT - r.LETS_GO - 1, true), false)
    /* And the height's line the same. */
    assert.equal(r.twoSidesOn({ width: 1000, height: r.SIDES_TALL - 1 }, false), false)
    assert.equal(r.twoSidesOn({ width: 1000, height: r.SIDES_TALL }, false), true)
    assert.equal(r.twoSidesOn({ width: 1000, height: r.SIDES_TALL - r.LETS_GO }, true), true)
    assert.equal(r.twoSidesOn({ width: 1000, height: r.SIDES_TALL - r.LETS_GO - 1 }, true), false)
    /* An iPad's divider dragged across its own window: on past the line, off well under, never both at one width. */
    let was = false
    const seen = []
    for (const w of [700, 740, 759, 760, 800, 759, 730, 720, 719, 700, 759, 760]) {
      was = r.twoSidesOn({ width: w, height: 700 }, was)
      seen.push(was)
    }
    assert.deepEqual(seen, [false, false, false, true, true, true, true, true, false, false, false, true])
  })

  test('the divider is the window’s middle: on the Duo’s fold, with the side away from the strip wider, and even halves on an iPad', async () => {
    const r = await rules()
    /* The Duo opened, 951 across with its 84-point strip on the right: the frame is 867, and the fold is at 475.5 of it. */
    assert.deepEqual(r.splitSides({ width: 867, right: 84 }), { first: 475.5, second: 391.5 })
    /* Strip on the left: the same two widths, mirrored. */
    assert.deepEqual(r.splitSides({ width: 867, left: 84 }), { first: 391.5, second: 475.5 })
    /* Each about an iPhone wide, and neither under the least a side may be. */
    for (const w of [475.5, 391.5]) assert.ok(w >= r.SIDE_LEAST && w <= 480, `a Duo side of ${w} is not about an iPhone`)
    /* An iPad has nothing down its sides: even halves. */
    assert.deepEqual(r.splitSides({ width: 1180 }), { first: 590, second: 590 })
    assert.deepEqual(r.splitSides({ width: 1366 }), { first: 683, second: 683 })
    /* Nothing, and nonsense, split to nothing rather than thrown. */
    assert.deepEqual(r.splitSides({}), { first: 0, second: 0 })
    assert.deepEqual(r.splitSides({ width: 'x' }), { first: 0, second: 0 })
    /* A strip wider than the frame could ever put the divider past its edge: held inside it. */
    const odd = r.splitSides({ width: 300, right: 800 })
    assert.ok(odd.first <= 300 && odd.second >= 0)
    /* Play on the right by default, on the narrower Duo side when the strip is on the right; Swap gives it the wider. */
    assert.deepEqual(r.sideWidths({ width: 867, right: 84 }), { play: 391.5, tool: 475.5 })
    assert.deepEqual(r.sideWidths({ width: 867, right: 84, playOnRight: false }), { play: 475.5, tool: 391.5 })
    assert.deepEqual(r.sideWidths({ width: 1180, playOnRight: true }), { play: 590, tool: 590 })
    /* And the room line: a frame whose narrower side would be under SIDE_LEAST stays one screen, however wide. */
    assert.equal(r.twoSidesOn({ width: 780, height: 600, right: 200 }, false), false, 'a side of 290 was allowed')
    assert.equal(r.twoSidesOn({ width: 780, height: 600 }, false), true)
  })

  test('the list offers Edit only where its door opens, All presets and the Tuner only where Play offers them, and Setlists always; Play is never on it', async () => {
    const r = await rules()
    assert.deepEqual(r.TOOLS, ['edit', 'setlists', 'presets', 'tuner'])
    assert.deepEqual(r.sideTools({ editOpens: true, presetsOffered: true, tunerOffered: true }), ['edit', 'setlists', 'presets', 'tuner'])
    assert.deepEqual(r.sideTools({ editOpens: true, presetsOffered: true }), ['edit', 'setlists', 'presets'])
    assert.deepEqual(r.sideTools({ editOpens: false, presetsOffered: true }), ['setlists', 'presets'])
    assert.deepEqual(r.sideTools({ editOpens: true, presetsOffered: false }), ['edit', 'setlists'])
    assert.deepEqual(r.sideTools({ tunerOffered: true }), ['setlists', 'tuner'])
    assert.deepEqual(r.sideTools({ tunerOffered: 'yes' }), ['setlists'], 'only a plain true offers it')
    assert.deepEqual(r.sideTools({}), ['setlists'])
    assert.deepEqual(r.sideTools(), ['setlists'])
    assert.ok(!r.TOOLS.includes('play'), 'Play is on the list')
    assert.equal(r.PLAY_ALWAYS, 'Play is always the other side.')
    assert.deepEqual(r.TOOL_NAMES, { edit: 'Edit', setlists: 'Setlists', presets: 'All presets', tuner: 'Tuner', play: 'Play' })
    for (const t of r.TOOLS) assert.equal(r.isTool(t), true)
    for (const t of ['stage', 'settings', 'play', null, undefined]) assert.equal(r.isTool(t), false)
  })

  test('the tuner opens in a side with two sides up, and only there; its side and the unit’s tuner go together, except when the window shrinks to one screen', async () => {
    const r = await rules()
    /* Turned on with two sides up and Play (or a tool beside it) on screen: into the side. */
    for (const screen of ['stage', 'edit', 'setlists', 'presets']) assert.equal(r.tunerGoes({ allowed: true, wide: true, screen }), 'side', screen)
    /* Anywhere else, over everything as on a phone. */
    assert.equal(r.tunerGoes({ allowed: true, wide: false, screen: 'stage' }), null, 'a narrow window')
    assert.equal(r.tunerGoes({ allowed: false, wide: true, screen: 'stage' }), null, 'an account the sides are not open to')
    for (const screen of ['settings', 'fixes', 'report', null]) assert.equal(r.tunerGoes({ allowed: true, wide: true, screen }), null, String(screen))
    assert.equal(r.tunerGoes(), null)
    /* Its side gone, the tuner stops: to Play, another tool, Settings. */
    for (const now of ['stage', 'edit', 'setlists', 'presets', 'settings']) assert.equal(r.tunerStops({ was: 'tuner', now, tunerOn: true }), true, now)
    /* But not when the window shrank to one screen: the tuner stays on and shows over everything. */
    assert.equal(r.tunerStops({ was: 'tuner', now: 'stage', tunerOn: true, toOneScreen: true }), false)
    /* Nothing to stop: already off, or the side never was the tuner, or it still is. */
    assert.equal(r.tunerStops({ was: 'tuner', now: 'stage', tunerOn: false }), false)
    assert.equal(r.tunerStops({ was: 'edit', now: 'stage', tunerOn: true }), false)
    assert.equal(r.tunerStops({ was: 'tuner', now: 'tuner', tunerOn: true }), false)
    assert.equal(r.tunerStops(), false)
    /* Shrunk with the tuner beside Play: Play shows, and the tuner is kept to come back. Back closes it like any side. */
    assert.deepEqual(r.whenNarrow({ tool: 'tuner', sideFull: false }), { screen: 'stage', keep: 'tuner' })
    assert.deepEqual(r.whenNarrow({ tool: 'tuner', sideFull: true }), { screen: 'tuner', keep: 'tuner' })
    assert.equal(r.backUnwinds({ tool: 'tuner', sideFull: false }), 'side')
  })

  test('App puts the tuner in its side and never also over everything, stops it when its side goes, and Play’s own tuner is untouched on one screen', () => {
    const app = code(read('mobile/App.js'))
    const stage = code(read('mobile/src/screens/Stage.js'))
    const tuner = code(read('mobile/src/components/Tuner.js'))
    /* Picked from a bar, or brought back: by turning the tuner on, never by a tuner screen with the unit off. */
    assert.match(app, /const openTool = \(tool\) => \(tool === 'tuner' \? writeTuner\(true\) : setScreen\(tool\)\)\n/)
    assert.match(app, /onPick=\{openTool\}/)
    assert.match(app, /onTwoSides=\{\(\) => openTool\(sideKept\)\}/)
    assert.match(app, /tunerOffered: \(demo \|\| link\.link === 'connected'\) && caps\?\.tuner !== false/)
    /* On: into the side. Off: the side closes. Its side gone: off, unless the window shrank. */
    assert.match(app, /if \(!tunerOn\) \{\s*if \(screen === 'tuner'\) setScreen\('stage'\)\s*return\s*\}/)
    assert.match(app, /tunerGoes\(\{ allowed: sidesAllowed, wide, screen \}\) === 'side'\) setScreen\('tuner'\)/)
    assert.match(app, /if \(tunerStops\(\{ was, now: screen, tunerOn, toOneScreen \}\)\) writeTuner\(false\)/)
    assert.match(app, /if \(to\.keep === 'tuner'\) tunerToOne\.current = true/)
    assert.match(app, /\(back !== 'tuner' \|\| tunerOn\)/, 'a tuner stopped while the window was narrow comes back on when it widens')
    /* The tuner is a screen only in a side: anywhere else, Play. */
    assert.match(app, /\} else if \(screen === 'tuner' && !twoSidesUp\) \{\s*tunerToOne\.current = true\s*setScreen\('stage'\)\s*\}/)
    assert.doesNotMatch(app, /alone === 'tuner'/, 'the switch draws a tuner screen of its own')
    /* In the side, and not also over everything. */
    assert.match(app, /sideTool === 'tuner' \? \(\s*<TunerSide onClose=\{\(\) => writeTuner\(false\)\} down=\{link\.down === true && !demo\} \/>/)
    assert.match(app, /const tunerBeside = twoSidesUp && sideTool === 'tuner'\n/)
    assert.match(app, /tunerBeside=\{tunerBeside\}/)
    assert.match(stage, /tunerBeside = false,\n/)
    assert.match(stage, /<Tuner on=\{tunerOn && !tunerBeside\} reading=\{tuning\} onClose=\{\(\) => writeTuner\(false\)\} down=\{down\} \/>/)
    /* One pane, in both places; "Tap anywhere to close" only over everything, and the side's pane measured from the side. */
    assert.match(tuner, /<TunerPane dial=\{dial\} reading=\{reading\} on=\{on\} onClose=\{onClose\} down=\{down\} tapToClose \/>/)
    assert.match(tuner, /\{tapToClose \? <Text[^>]*>Tap anywhere to close<\/Text> : null\}/)
    assert.match(tuner, /export function TunerSide\(\{ onClose, down = false \}\)/)
    assert.match(tuner, /onLayout=\{\(e\) => setRoom\(e\.nativeEvent\.layout\.width\)\}/)
    assert.equal(tuner.match(/<Press label="Stop tuner"/g).length, 1, 'the pane is drawn twice over, so the two drift apart')
  })

  test('Android’s back undoes full screen first, then closes the side; shrinking to one screen shows Play and keeps the tool, or the tool that was filling the screen', async () => {
    const r = await rules()
    assert.equal(r.backUnwinds({ tool: 'edit', sideFull: true }), 'full')
    assert.equal(r.backUnwinds({ tool: 'edit', sideFull: false }), 'side')
    assert.equal(r.backUnwinds({ tool: null, sideFull: true }), null, 'nothing to unwind with no side open')
    assert.equal(r.backUnwinds({}), null)
    /* The Duo folded with Edit beside Play: the front screen shows Play, and Edit is kept. */
    assert.deepEqual(r.whenNarrow({ tool: 'edit', sideFull: false }), { screen: 'stage', keep: 'edit' })
    /* Folded with Edit filling the screen: Edit, exactly as it was. */
    assert.deepEqual(r.whenNarrow({ tool: 'edit', sideFull: true }), { screen: 'edit', keep: 'edit' })
    assert.deepEqual(r.whenNarrow({ tool: 'setlists', sideFull: false }), { screen: 'stage', keep: 'setlists' })
    assert.deepEqual(r.whenNarrow({ tool: null }), { screen: 'stage', keep: null })
    assert.deepEqual(r.whenNarrow({}), { screen: 'stage', keep: null })
  })

  test('Play in a side keeps its buttons fixed to the bottom at the Duo’s 392, with an iPhone’s tiles, and no fold padding; every phone’s shape is untouched', async () => {
    const r = await rules()
    /* A 391.5-point Duo side: the row is an iPhone's, and so are the tiles; only the buttons move to the fixed strip. */
    const row = r.pageRow(391.5)
    const phone = r.playShape(row, 0, 'across', null)
    const side = r.playShape(row, 0, 'across', null, true)
    assert.equal(phone.footFixed, false, 'an iPhone’s buttons are not in the page any more')
    assert.equal(side.footFixed, true, 'in a side the buttons are not fixed to the bottom, so Next scrolls off a long preset')
    assert.equal(side.wide, false)
    assert.equal(side.sceneCols, 2)
    assert.equal(side.fxCols, 4)
    assert.equal(side.names, false)
    assert.equal(side.footRow, false)
    assert.deepEqual({ ...side, footFixed: phone.footFixed }, phone, 'a side changes more than the buttons at a phone’s width')
    /* An iPad's 590-point side: Play opens up as a 590 row does anywhere, and the fold padding stays off. */
    const half = r.playShape(r.pageRow(590), 0, 'across', null, true)
    assert.equal(half.wide, true)
    assert.equal(half.footFixed, true)
    assert.equal(half.foldPad, false)
    /* The spread layout in a side (a 13-inch iPad's 683): no fold padding, which centres Play on a window it has the whole of. */
    const spread = r.playShape(919, 0, 'across', null, true)
    assert.equal(spread.spread, true)
    assert.equal(spread.foldPad, false)
    assert.equal(r.playShape(919, 0, 'across', null).foldPad, true)
    /* inSide left out, or false, or anything but true: the shape it always was, field for field, at every width and step. */
    for (const w of [320, 375, 393, 411.43, 466, 590, 669, 820, 951, 1180]) {
      for (const step of [0, 1, 2, 3]) {
        for (const layout of ['across', 'down', 'four', 'mine']) {
          const was = r.playShape(r.pageRow(w), step, layout, null)
          assert.deepEqual(r.playShape(r.pageRow(w), step, layout, null, false), was)
          assert.deepEqual(r.playShape(r.pageRow(w), step, layout, null, undefined), was)
          assert.deepEqual(r.playShape(r.pageRow(w), step, layout, null, 'yes'), was)
        }
      }
    }
  })

  test('App draws the sides for his account only, leaves a tool to the host on two sides, and keeps Play in one place', () => {
    const app = code(read('mobile/App.js'))
    const sides = code(read('mobile/src/components/Sides.js'))
    const features = read('mobile/src/lib/features.js')
    /* Off for customers until step 6. */
    assert.match(features, /^export const SIDES_FOR_EVERYONE = false$/m, 'the two sides are open to everyone; that is step 6, with its line in What’s new')
    assert.match(app, /const sidesAllowed = SIDES_FOR_EVERYONE \|\| sidesAdmin\n/)
    assert.match(app, /const sidesAdmin = useBluetoothAdmin\(\)\n/, 'his account is not read from the sign-in kept on the phone')
    /* The frame is measured, and the rule asked on it with its memory, only for an account the sides are open to. */
    assert.match(app, /\{sidesAllowed \? <SidesFrame onFrame=\{setFrame\} \/> : null\}/)
    assert.match(app, /const wide = sidesAllowed && twoSidesOn\(frame \|\| \{\}, wideWas\.current\)\n\s*wideWas\.current = wide\n/)
    /* `screen` stays the record: the tool is read off it, Edit behind the bench's switch, and the switch leaves it to the host on two sides. */
    assert.match(app, /const sideTool = BENCH && screen === 'edit' \? 'edit' : screen === 'setlists' \|\| screen === 'presets' \|\| screen === 'tuner' \? screen : null\n/)
    assert.match(app, /const twoSidesUp = sidesAllowed && sideTool !== null && \(wide \|\| sideFull\)\n/)
    assert.match(app, /const alone = twoSidesUp \? 'stage' : screen\n/)
    for (const t of ['presets', 'setlists']) assert.match(app, new RegExp(`\\) : alone === '${t}' \\? \\(`), `${t} is drawn by the switch beside the host’s copy`)
    assert.match(app, /\) : BENCH && alone === 'edit' \? \(/)
    /* Play is drawn once, inside the host, told its side and its sleep; the tool beside it is the same screen with the same Done. */
    assert.equal(app.match(/<Stage\b/g).length, 1, 'Play is drawn in two places, so it is drawn afresh when a side opens')
    assert.match(app, /<Sides\s+allowed=\{sidesAllowed\}\s+two=\{wide\}\s+tool=\{twoSidesUp \? sideTool : null\}\s+full=\{sideFull\}/)
    assert.match(app, /<Stage\s+inSide=\{playBeside\}\s+awake=\{!playHidden\}\s+tunerBeside=\{tunerBeside\}/)
    assert.match(app, /const playBeside = twoSidesUp && !sideFull\n\s*const playHidden = twoSidesUp && sideFull\n/)
    assert.match(app, /<Presets onBack=\{closeSide\} stay \/>/, 'All presets beside Play does not stay open after a pick')
    assert.match(app, /<Setlists onBack=\{closeSide\} \/>/)
    assert.match(app, /<Edit\s+onBack=\{closeSide\}/)
    assert.match(app, /const closeSide = \(\) => setScreen\('stage'\)\n/)
    /* Play's own buttons keep their handlers: Edit opens 'edit', the preset name 'presets', Setlists 'setlists', and the host draws them beside Play. */
    assert.match(app, /onOpenEdit=\{editOpens \? \(\) => setScreen\('edit'\)/)
    assert.match(app, /onOpenSetlists=\{\(\) => setScreen\('setlists'\)\}/)
    /* Swap is kept on the device; Full screen on Play's bar is Play alone with the tool kept; Two sides brings it back. */
    assert.match(app, /onSwap=\{\(\) => \{\s*keepPlayOnRight\(!playOnRight\)\s*setPlayOnRight\(!playOnRight\)\s*\}\}/)
    assert.match(app, /onPlayFull=\{closeSide\}/)
    assert.match(app, /if \(sideTool\) setSideKept\(sideTool\)\s*else setSideFull\(false\)/)
    /* Nothing reopens at launch: what was kept starts empty, and only which side Play is on is read off the device. */
    assert.match(app, /const \[sideKept, setSideKept\] = useState\(null\)\n/)
    assert.match(app, /readPlayOnRight\(\)\.then/)
    assert.doesNotMatch(app, /readSideKept|AsyncStorage/, 'a tool is read back off the device at launch')
    /* Shrunk to one screen: lib/twoSides says what shows, decided while drawing and only after a render with the tool beside Play; wide again, the tool comes back only onto Play. */
    assert.match(app, /if \(wasBeside\.current && !wide\) \{\s*const to = whenNarrow\(\{ tool: sideTool, sideFull \}\)\s*if \(to\.screen !== screen\) \{\s*shrunk\.current = to\.keep\s*if \(to\.keep === 'tuner'\) tunerToOne\.current = true\s*setScreen\(to\.screen\)\s*\}\s*\} else if \(screen === 'tuner' && !twoSidesUp\) \{[^}]*\}\s*wasBeside\.current = playBeside\n/)
    assert.match(app, /if \(back && screen === 'stage' && \(back !== 'tuner' \|\| tunerOn\)\) setScreen\(back\)/)
    /* Android's back: full screen first, then today's step (the side's Done). */
    assert.match(app, /if \(twoSidesUp && backUnwinds\(\{ tool: sideTool, sideFull \}\) === 'full'\) \{\s*setSideFull\(false\)\s*return true\s*\}\s*if \(screen !== 'stage'\)/)
    /* Siri: told Play is elsewhere while a tool fills the window (screen is the tool), and not while it is beside one. */
    assert.match(app, /const playElsewhere = playElsewhereOf\(\{ auth, seenWalk, independentDue, screen, shareCard: askHow \|\| askShare \}\) && !playBeside\n/)
    /* The host: nothing for anybody else, Play in one View in every mode, the hidden side at no width and silent to a screen reader, the divider on the window's middle. */
    assert.match(sides, /if \(!allowed\) return children\n/)
    assert.match(sides, /<EdgeBack onBack=\{beside \? swallow : null\} style=\{\{ flex: 1 \}\}>\s*\{children\}\s*<\/EdgeBack>/, 'Play is wrapped in one View in one mode and another in the next, so it is drawn afresh')
    assert.match(sides, /const HIDDEN = \{ width: 0, overflow: 'hidden' \}/)
    assert.match(sides, /accessibilityElementsHidden=\{playHidden\}/)
    assert.match(sides, /importantForAccessibility=\{playHidden \? 'no-hide-descendants' : 'auto'\}/)
    assert.match(sides, /sideWidths\(\{ width: frame\?\.width, left: frame\?\.left, right: frame\?\.right, playOnRight \}\)/)
    /* Keyed, so Swap moves the two Views and draws neither afresh. */
    assert.match(sides, /key="play"/)
    assert.match(sides, /key="side"/)
    assert.match(sides, /\{playOnRight \? other : play\}\s*\{playOnRight \? play : other\}/)
    /* Nothing decided by the kind of device or which way up it is, in the rule or the host. */
    for (const f of ['mobile/src/lib/twoSides.js', 'mobile/src/components/Sides.js']) {
      assert.doesNotMatch(code(read(f)), /Platform\.isPad|isTablet|orientation|Dimensions\.get|useWindowDimensions/, `${f} decides something by the kind of device or the window`)
    }
    /* The frame is measured where the screens are drawn, under the top bar, and the strip's side read from the phone. */
    assert.match(sides, /export function SidesFrame\(\{ onFrame \}\)/)
    assert.match(sides, /const \{ left, right \} = useSafeAreaInsets\(\)/)
    assert.match(sides, /pointerEvents="none"/)
    assert.ok(app.indexOf('<EdgeBack onBack={backFrom}>') < app.indexOf('<SidesFrame') && app.indexOf('<SidesFrame') < app.indexOf("{settling && screen === 'stage'"), 'the frame is not measured inside the screens’ own frame')
  })

  test('a hidden Play sleeps: its pop-ups wait, the watch goes down, and Edit and Play keep today’s own handlers', () => {
    const stage = code(read('mobile/src/screens/Stage.js'))
    const bridge = code(read('mobile/src/lib/watchBridge.js'))
    const presets = code(read('mobile/src/screens/Presets.js'))
    assert.match(stage, /inSide = false,/)
    assert.match(stage, /awake = true,\n/)
    assert.match(stage, /const shape = playShape\(pageRow\(playWidth, space\.lg\), SIZES\.indexOf\(size\), sceneLayout, shapeWas\.current, inSide\)/)
    /* The quick tip waits for an awake Play; the colours line and the demo's nudge too. */
    assert.match(stage, /\{awake \? <Coach open=\{coach && !notesUp\} stage=\{coachStage\} onTry=\{tryCoach\} onSkip=\{closeCoach\} onDone=\{closeCoach\} \/> : null\}/)
    assert.match(stage, /\{awake \? <ColoursNotice waiting=\{notesUp \|\| coach \|\| watchTip\} unanswered=\{coachPending \|\| watchPending\} onOpen=\{onOpenColours\} \/> : null\}/)
    assert.match(stage, /\{awake \? <DemoTrialNudge onUnlock=\{onUnlock\} waiting=\{notesUp \|\| coach \|\| watchTip\} \/> : null\}/)
    /* The watch's pages go down as when Play is not open, and come back afresh: told in the picture, so the call the watch tests pin stays as it was. */
    assert.match(stage, /tuning,\s*awake,/)
    assert.match(bridge, /export function useWatchBridge\(picture, step\)/)
    assert.match(bridge, /const awake = picture\.awake !== false\n/)
    assert.match(bridge, /const \{ chain, channels, awake: seen, \.\.\.rest \} = picture\n/, 'awake is sent to the watch as part of its picture')
    assert.match(bridge, /if \(!watch\) return undefined\s*if \(!awake\) return undefined/)
    assert.match(bridge, /sender\.current = null\s*\}\s*\}, \[awake\]\)/)
    /* The screen stays awake. */
    assert.match(stage, /useKeepAwake\(\)/)
    /* All presets beside Play stays after a pick; on its own it goes back as it always did. */
    assert.match(presets, /export default function Presets\(\{ onBack, stay = false \}\)/)
    assert.match(presets, /loadPreset\(n\)\s*if \(!stay\) onBack\?\.\(\)/)
  })
}
