/**
 * TWO SIDES ON A BIG SCREEN (mobile/src/lib/twoSides.js, components/Sides.js,
 * App.js): Play on one side, and Edit, Setlists, All presets or the tuner on the other,
 * on an iPad on its side, an Android tablet sideways or the iPhone Duo
 * opened; one screen, exactly as today, on every phone held upright, the
 * Duo closed or held tall, and an iPad upright. His account only until
 * features SIDES_FOR_EVERYONE opens it.
 *
 * And Derek's panel (step 4): a block held on Play opens its knobs where
 * the scenes were, or in the other side, only where editing works and the
 * two sides are; everywhere else the hold is today's channel pop-up.
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
    /* For Derek's panel: Play's tiles filling a big screen, which the panel takes the scenes' room from, and Edit's door, which it opens behind. Neither imports anything. */
    for (const f of ['squarePlay', 'editDoor', 'sidewaysPlay']) {
      const src = read(`mobile/src/lib/${f}.js`)
      assert.doesNotMatch(src, /^import /m, `lib/${f} imports something; this check runs it on its own`)
      writeFileSync(join(dir, `${f}.js`), src)
    }
    const t = await import(pathToFileURL(join(dir, 'twoSides.js')).href)
    const p = await import(pathToFileURL(join(dir, 'playShape.js')).href)
    const q = await import(pathToFileURL(join(dir, 'squarePlay.js')).href)
    const d = await import(pathToFileURL(join(dir, 'editDoor.js')).href)
    /* A phone held on its side: its squares (the test at the end of this file). */
    const w = await import(pathToFileURL(join(dir, 'sidewaysPlay.js')).href)
    return { ...t, ...p, ...q, ...d, ...w }
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
    assert.deepEqual(r.TOOLS, ['edit', 'setlists', 'notes', 'presets', 'tuner'])
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
    assert.deepEqual(r.TOOL_NAMES, { edit: 'Edit', setlists: 'Setlists', notes: 'Notes', presets: 'All presets', tuner: 'Tuner', play: 'Play' })
    for (const t of r.TOOLS) assert.equal(r.isTool(t), true)
    for (const t of ['stage', 'settings', 'play', null, undefined]) assert.equal(r.isTool(t), false)
  })

  test('the tuner opens in a side with two sides up, and only there; it borrows the side and gives it back; its side and the unit’s tuner go together, folding too', async () => {
    const r = await rules()
    /* Turned on with two sides up and Play (or a tool beside it) on screen: into the side. */
    for (const screen of ['stage', 'edit', 'setlists', 'presets']) assert.equal(r.tunerGoes({ allowed: true, wide: true, screen }), 'side', screen)
    /* Anywhere else, over everything as on a phone. */
    assert.equal(r.tunerGoes({ allowed: true, wide: false, screen: 'stage' }), null, 'a narrow window')
    assert.equal(r.tunerGoes({ allowed: false, wide: true, screen: 'stage' }), null, 'an account the sides are not open to')
    for (const screen of ['settings', 'fixes', 'report', null]) assert.equal(r.tunerGoes({ allowed: true, wide: true, screen }), null, String(screen))
    assert.equal(r.tunerGoes(), null)
    /* Its side gone, the tuner stops: to Play (closed, Full screen, or the Duo folded), another tool, Settings. */
    for (const now of ['stage', 'edit', 'setlists', 'presets', 'settings']) assert.equal(r.tunerStops({ was: 'tuner', now, tunerOn: true }), true, now)
    /* It borrows the side: off, what was there comes back, or Play alone. */
    for (const t of ['edit', 'setlists', 'presets']) assert.equal(r.tunerGivesBack(t), t)
    for (const t of ['stage', 'tuner', null, undefined, 'settings']) assert.equal(r.tunerGivesBack(t), 'stage', String(t))
    assert.equal(r.TUNER_MUTES, 'Your unit’s own Tuner setting decides if the sound mutes.')
    /* A narrow column on an iPad on its side (Play keeps the rest); half on the Duo and the Fold, on the fold. */
    const ipad = r.sideWidths({ width: 1180, tool: 'tuner' })
    assert.deepEqual(ipad, { play: 1180 - r.TUNER_COLUMN, tool: r.TUNER_COLUMN })
    assert.equal(r.TUNER_COLUMN, r.SIDE_LEAST)
    assert.deepEqual(r.sideWidths({ width: 1180, tool: 'tuner', playOnRight: false }), ipad, 'Swap moves the column, not its width')
    assert.deepEqual(r.sideWidths({ width: 1180, tool: 'edit' }), { play: 590, tool: 590 }, 'every other tool is still half')
    const duo = frameOf(951, 669, { left: 84 })
    assert.deepEqual(r.sideWidths({ ...duo, tool: 'tuner' }), r.sideWidths({ ...duo, tool: 'edit' }), 'the Duo’s tuner is not on the fold')
    assert.deepEqual(r.sideWidths({ width: 841, tool: 'tuner' }), r.sideWidths({ width: 841 }))
    /* Nothing to stop: already off, or the side never was the tuner, or it still is. */
    assert.equal(r.tunerStops({ was: 'tuner', now: 'stage', tunerOn: false }), false)
    assert.equal(r.tunerStops({ was: 'edit', now: 'stage', tunerOn: true }), false)
    assert.equal(r.tunerStops({ was: 'tuner', now: 'tuner', tunerOn: true }), false)
    assert.equal(r.tunerStops(), false)
    /* Folded with the tuner beside Play: Play shows (and the tuner goes off, above). Back closes it like any side. */
    assert.deepEqual(r.whenNarrow({ tool: 'tuner', sideFull: false }).screen, 'stage')
    assert.equal(r.backUnwinds({ tool: 'tuner', sideFull: false }), 'side')
  })

  test('App puts the tuner in its side and never the big pop-up while two sides can show, gives the side back, stops it when its side goes, and Play’s own tuner is untouched on one screen', () => {
    const app = code(read('mobile/App.js'))
    const stage = code(read('mobile/src/screens/Stage.js'))
    const tuner = code(read('mobile/src/components/Tuner.js'))
    /* Picked from a bar, or brought back: by turning the tuner on, never by a tuner screen with the unit off. */
    assert.match(app, /const openTool = \(tool\) => \(tool === 'tuner' \? writeTuner\(true\) : setScreen\(tool\)\)\n/)
    assert.match(app, /onPick=\{openTool\}/)
    /* (Two sides, in the top bar with Play alone on a big screen: the tool that was beside it, or the list.) */
    assert.match(app, /onTwo=\{sideKept \? \(\) => openTool\(sideKept\) : \(\) => setSideList\('play'\)\}/)
    assert.match(app, /tunerOffered: \(demo \|\| link\.link === 'connected'\) && caps\?\.tuner !== false/)
    /* On: into the side. Off: the side closes. Its side gone: off, unless the window shrank. */
    assert.match(app, /if \(!tunerOn\) \{\s*if \(screen === 'tuner'\) setScreen\(tunerGivesBack\(tunerLent\.current\)\)\s*return\s*\}/)
    assert.match(app, /tunerGoes\(\{ allowed: sidesAllowed, wide, screen \}\) === 'side'\) \{\s*tunerLent\.current = sideUnder\(screen, \{ blockLent: blockLent\.current \}\)\s*setScreen\('tuner'\)\s*\}/)
    assert.match(app, /if \(tunerStops\(\{ was, now: screen, tunerOn \}\)\) writeTuner\(false\)/)
    /* Folded: what the tuner borrowed comes back when the window widens, never the tuner itself. */
    assert.match(app, /shrunk\.current = sideUnder\(to\.keep, \{ tunerLent: tunerLent\.current, blockLent: blockLent\.current \}\)/)
    /* The tuner is a screen only in a side: anywhere else, Play, and it goes off. */
    assert.match(app, /\} else if \(screen === 'tuner' && !twoSidesUp\) \{\s*setScreen\('stage'\)\s*\}/)
    assert.doesNotMatch(app, /alone === 'tuner'/, 'the switch draws a tuner screen of its own')
    /* In the side, and not also over everything. */
    assert.match(app, /sideTool === 'tuner' \? \(\s*<TunerSide onClose=\{\(\) => writeTuner\(false\)\} down=\{link\.down === true && !demo\} \/>/)
    assert.match(app, /const tunerBeside = wide \|\| \(twoSidesUp && sideTool === 'tuner'\)\n/)
    assert.match(app, /tunerBeside=\{tunerBeside\}/)
    assert.match(stage, /tunerBeside = false,\n/)
    assert.match(stage, /<Tuner on=\{tunerOn && !tunerBeside && !stageView\} reading=\{tuning\} onClose=\{\(\) => writeTuner\(false\)\} down=\{down\} \/>/)
    /* One pane, in both places; "Tap anywhere to close" only over everything, and the side's pane measured from the side. */
    assert.match(tuner, /<TunerPane dial=\{dial\} reading=\{reading\} on=\{on\} onClose=\{onClose\} down=\{down\} tapToClose \/>/)
    assert.match(tuner, /\{tapToClose \? <Text[^>]*>Tap anywhere to close<\/Text> : null\}/)
    assert.match(tuner, /export function TunerSide\(\{ onClose, down = false \}\)/)
    assert.match(tuner, /footnote=\{TUNER_MUTES\}/, 'the tuner side does not say the unit decides whether it mutes')
    assert.match(code(read('mobile/src/components/Sides.js')), /sideWidths\(\{ width: frame\?\.width, left: frame\?\.left, right: frame\?\.right, playOnRight, tool, share \}\)/)
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
    /* Open to everyone since 9 November 2026 ("flip the switch though to turn this on for all users"); the hold for a block's knobs since the 10th ("Activate the other hold for knobs i checked it"). */
    assert.match(features, /^export const SIDES_FOR_EVERYONE = true$/m, 'the two sides are closed to customers again')
    assert.match(features, /^export const HOLD_KNOBS_FOR_EVERYONE = true$/m, 'holding a block for its knobs is closed to customers again')
    assert.match(app, /const sidesAllowed = SIDES_FOR_EVERYONE \|\| sidesAdmin\n/)
    assert.match(app, /const sidesAdmin = useBluetoothAdmin\(\)\n/, 'his account is not read from the sign-in kept on the phone')
    /* The frame is measured, and the rule asked on it with its memory, only for an account the sides are open to. */
    assert.match(app, /\{sidesAllowed \? <SidesFrame onFrame=\{setFrame\} \/> : null\}/)
    /* (`big` is that answer; `wide` is it or a phone held on its side, the test at the end of this file.) */
    assert.match(app, /const big = sidesAllowed && twoSidesOn\(frame \|\| \{\}, wideWas\.current\)\n\s*wideWas\.current = big\n/)
    /* `screen` stays the record: the tool is read off it, Edit behind the bench's switch, and the switch leaves it to the host on two sides. */
    assert.match(app, /const sideTool = BENCH && screen === 'edit' \? 'edit' : screen === 'setlists' \|\| screen === 'presets' \|\| screen === 'tuner' \|\| screen === 'notes' \|\| screen === BLOCK \? screen : null\n/)
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
    assert.match(app, /<Setlists onBack=\{closeSide\} notes=\{notesAllowed\} \/>/)
    assert.match(app, /<Edit\s+onBack=\{closeSide\}/)
    assert.match(app, /const closeSide = \(\) => setScreen\('stage'\)\n/)
    /* Play's own buttons keep their handlers: Edit opens 'edit', the preset name 'presets', Setlists 'setlists', and the host draws them beside Play. */
    assert.match(app, /onOpenEdit=\{editOpens \? \(\) => setScreen\('edit'\)/)
    assert.match(app, /onOpenSetlists=\{\(\) => setScreen\('setlists'\)\}/)
    /* Swap is kept on the device; the tool's Done is Play alone with the tool kept; Two sides brings it back. (The buttons are in the top bar since 10 November 2026: the test at the end of this file.) */
    assert.match(app, /const swapSides = \(\) => \{\s*keepPlayOnRight\(!playOnRight\)\s*setPlayOnRight\(!playOnRight\)\s*\}\n/)
    assert.match(app, /onSwap=\{swapSides\}/)
    assert.match(app, /if \(sideTool === BLOCK\) return\s*if \(sideTool\) setSideKept\(sideTool\)\s*else setSideFull\(false\)/)
    /* Nothing reopens at launch: what was kept starts empty, and only which side Play is on is read off the device. */
    assert.match(app, /const \[sideKept, setSideKept\] = useState\(null\)\n/)
    assert.match(app, /readPlayOnRight\(\)\.then/)
    assert.doesNotMatch(app, /readSideKept|AsyncStorage/, 'a tool is read back off the device at launch')
    /* Shrunk to one screen: lib/twoSides says what shows, decided while drawing and only after a render with the tool beside Play; wide again, the tool comes back only onto Play. */
    assert.match(app, /if \(wasBeside\.current && !wide\) \{\s*const to = whenNarrow\(\{ tool: sideTool, sideFull \}\)\s*if \(to\.screen !== screen\) \{\s*shrunk\.current = sideUnder\(to\.keep, \{ tunerLent: tunerLent\.current, blockLent: blockLent\.current \}\)\s*setScreen\(to\.screen\)\s*\}\s*\} else if \(screen === 'tuner' && !twoSidesUp\) \{[^}]*\}\s*wasBeside\.current = playBeside\n/)
    assert.match(app, /if \(back && screen === 'stage'\) setScreen\(back\)/)
    /* Android's back: full screen first, then today's step (the side's Done). */
    assert.match(app, /if \(twoSidesUp && backUnwinds\(\{ tool: sideTool, sideFull \}\) === 'full'\) \{\s*setSideFull\(false\)\s*return true\s*\}\s*if \(screen !== 'stage'\)/)
    /* Siri: told Play is elsewhere while a tool fills the window (screen is the tool), and not while it is beside one. */
    assert.match(app, /const playElsewhere = playElsewhereOf\(\{ auth, seenWalk, independentDue, screen: stageViewUp \? 'stage' : screen, shareCard: askHow \|\| askShare \}\) && !playBeside\n/)
    /* The host: nothing for anybody else, Play in one View in every mode, the hidden side at no width and silent to a screen reader, the divider on the window's middle. */
    assert.match(sides, /if \(!allowed\) return children\n/)
    assert.match(sides, /<EdgeBack onBack=\{beside \? swallow : null\} style=\{\{ flex: 1 \}\}>\s*\{children\}\s*<\/EdgeBack>/, 'Play is wrapped in one View in one mode and another in the next, so it is drawn afresh')
    assert.match(sides, /const HIDDEN = \{ width: 0, overflow: 'hidden' \}/)
    assert.match(sides, /accessibilityElementsHidden=\{playHidden\}/)
    assert.match(sides, /importantForAccessibility=\{playHidden \? 'no-hide-descendants' : 'auto'\}/)
    assert.match(sides, /sideWidths\(\{ width: frame\?\.width, left: frame\?\.left, right: frame\?\.right, playOnRight, tool, share \}\)/)
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
    /* (`quickEdit` is taken out beside it since 12 November 2026: Play's answer for quick edit on the wrist, which goes to the watch only through lib/watchQuickEdit; test/watch-quick.mjs.) */
    assert.match(bridge, /const \{ chain, channels, awake: seen, quickEdit, \.\.\.rest \} = picture\n/, 'awake is sent to the watch as part of its picture')
    assert.match(bridge, /if \(!watch\) return undefined\s*if \(!awake\) return undefined/)
    assert.match(bridge, /sender\.current = null\s*\}\s*\}, \[awake\]\)/)
    /* The screen stays awake. */
    assert.match(stage, /useKeepAwake\(\)/)
    /* All presets beside Play stays after a pick; on its own it goes back as it always did. */
    assert.match(presets, /export default function Presets\(\{ onBack, stay = false \}\)/)
    assert.match(presets, /loadPreset\(n\)\s*if \(!stay\) onBack\?\.\(\)/)
  })

  /* ------------------------------------------------------------------ */
  /* Step 4: Derek's idea, hold a block and get its panel                */
  /* ------------------------------------------------------------------ */

  test('Derek’s panel: a hold opens a block’s knobs only where editing works on a window that shows two sides, for an account they are open to; everywhere else it is today’s pop-up', async () => {
    const r = await rules()
    const his = { allowed: true, editOpens: true, wide: true }
    /* Play filling a big screen: where the scenes were. */
    assert.equal(r.holdGoes({ ...his, screen: 'stage' }), 'lane')
    /* Two sides showing: Edit jumps to the block; the tuner, Setlists and All presets lend their side; another block's knobs move. */
    assert.equal(r.holdGoes({ ...his, beside: true, screen: 'edit' }), 'edit')
    for (const screen of ['tuner', 'setlists', 'presets', r.BLOCK]) assert.equal(r.holdGoes({ ...his, beside: true, screen }), 'side', screen)
    /* Today's pop-up (null), for every place Play can be held from: */
    const places = [
      { screen: 'stage' },
      { beside: true, screen: 'edit' },
      { beside: true, screen: 'tuner' },
      { beside: true, screen: 'setlists' },
      { beside: true, screen: 'presets' },
      { beside: true, screen: r.BLOCK }
    ]
    for (const place of places) {
      const at = JSON.stringify(place)
      assert.equal(r.holdGoes({ ...his, ...place, allowed: false }), null, `an account the two sides are not open to gets the panel: ${at}`)
      assert.equal(r.holdGoes({ ...his, ...place, editOpens: false }), null, `the panel opens where editing does not work: ${at}`)
      assert.equal(r.holdGoes({ ...his, ...place, vp4: true }), null, `a VP4 gets a panel of knobs it does not have: ${at}`)
      assert.equal(r.holdGoes({ ...his, ...place, wide: false }), null, `a phone, or anything held upright, gets the panel: ${at}`)
      /* Only a plain true opens anything. */
      assert.equal(r.holdGoes({ ...his, ...place, allowed: 'yes' }), null)
      assert.equal(r.holdGoes({ ...his, ...place, editOpens: 1 }), null)
    }
    /* A tool filling the window has Play out of sight: nothing to hold. And no other screen opens one. */
    for (const screen of ['edit', 'setlists', 'presets', 'tuner']) assert.equal(r.holdGoes({ ...his, beside: false, screen }), null, screen)
    for (const screen of ['settings', 'fixes', 'report', 'gear', null, undefined]) assert.equal(r.holdGoes({ ...his, beside: true, screen }), null, String(screen))
    assert.equal(r.holdGoes({}), null)
    assert.equal(r.holdGoes(), null)

    /* `wide` is the two sides' own rule, on the frame: every phone upright or on its side, the Duo closed or held tall and an iPad upright are the pop-up; an iPad on its side and the Duo opened are the panel. */
    const held = (w, h, insets) => r.holdGoes({ allowed: true, editOpens: true, screen: 'stage', wide: r.twoSidesOn(frameOf(w, h, insets)) })
    for (const [w, h] of [[320, 568], [375, 667], [393, 852], [430, 932], [440, 956]]) {
      assert.equal(held(w, h), null, `a ${w}-point phone held upright`)
      assert.equal(held(h, w), null, `a ${w}-point phone on its side`)
    }
    assert.equal(held(466, 678, { right: 44 }), null, 'the Duo closed')
    assert.equal(held(669, 951), null, 'the Duo opened and held tall')
    assert.equal(held(820, 1180), null, 'an 11-inch iPad upright')
    assert.equal(held(1024, 1366), null, 'a 13-inch iPad upright')
    assert.equal(held(1180, 820), 'lane', 'an 11-inch iPad on its side')
    assert.equal(held(1280, 800), 'lane', 'an Android tablet sideways')
    assert.equal(held(951, 669, { right: 84 }), 'lane', 'the Duo opened with Play full screen')

    /* `editOpens` is Edit's own door (lib/editDoor), so the panel opens exactly where Edit does. */
    const door = (ask) => r.holdGoes({ allowed: true, wide: true, screen: 'stage', vp4: ask.vp4 === true, editOpens: r.editDoor({ bench: true, ...ask }).opens })
    assert.equal(door({ link: 'connected' }), 'lane', 'through the computer')
    assert.equal(door({ demo: true }), 'lane', 'in the demo')
    assert.equal(door({ link: 'connected', overBluetooth: true, editOpen: true, built: true }), 'lane', 'over Bluetooth where Edit is open to this account and unit')
    assert.equal(door({ link: 'connected', overBluetooth: true, editOpen: false, built: true }), null, 'a customer over Bluetooth, where Edit is closed, lost the scenes for a panel')
    assert.equal(door({ link: 'connected', overBluetooth: true, editOpen: false, built: false }), null)
    assert.equal(door({ link: 'joining' }), null, 'with nothing answering')
    assert.equal(door({ link: 'connected', vp4: true }), null, 'a VP4 through the computer')
    assert.equal(door({ link: 'connected', overBluetooth: true, vp4: true }), null, 'a VP4 over Bluetooth')
    assert.equal(r.holdGoes({ allowed: true, wide: true, screen: 'stage', editOpens: r.editDoor({ bench: false, link: 'connected' }).opens }), null, 'with Edit switched off')
  })

  test('Derek’s panel: it stays where it was opened until Close, borrows a side and gives it back, and follows its block to the next preset or closes', async () => {
    const r = await rules()
    /* Kept only in the place it was opened. */
    assert.equal(r.panelKeeps({ screen: 'stage', goes: 'lane', opened: 'lane' }), true)
    assert.equal(r.panelKeeps({ screen: r.BLOCK, goes: 'side', opened: 'side' }), true)
    /* Play made full screen with the knobs beside it: they close, they do not hop into the scenes' column. */
    assert.equal(r.panelKeeps({ screen: 'stage', goes: 'lane', opened: 'side' }), false)
    /* The window shrunk or the Duo folded, editing shut, the account changed: no place for it. */
    assert.equal(r.panelKeeps({ screen: 'stage', goes: null, opened: 'lane' }), false)
    assert.equal(r.panelKeeps({ screen: r.BLOCK, goes: null, opened: 'side' }), false)
    /* A tool or the tuner took the side, Edit opened beside Play, Settings. */
    for (const screen of ['tuner', 'setlists', 'presets']) assert.equal(r.panelKeeps({ screen, goes: 'side', opened: 'side' }), false, screen)
    assert.equal(r.panelKeeps({ screen: 'tuner', goes: 'side', opened: 'lane' }), false)
    assert.equal(r.panelKeeps({ screen: 'edit', goes: 'edit', opened: 'lane' }), false)
    assert.equal(r.panelKeeps({ screen: 'settings', goes: null, opened: 'lane' }), false)
    assert.equal(r.panelKeeps({}), false)
    assert.equal(r.panelKeeps(), false)

    /* It borrows the side: Close gives back the tool that was there, or Play alone. */
    for (const t of ['setlists', 'presets', 'edit']) assert.equal(r.blockGivesBack(t), t)
    for (const t of ['stage', 'tuner', r.BLOCK, null, undefined, 'settings']) assert.equal(r.blockGivesBack(t), 'stage', String(t))
    /* From the tuner's side: the tuner goes off with its side and never comes back on by itself, so what Close gives back is what the tuner had borrowed. */
    assert.equal(r.sideUnder('tuner', { tunerLent: 'setlists' }), 'setlists')
    assert.equal(r.blockGivesBack(r.sideUnder('tuner', { tunerLent: 'stage' })), 'stage')
    assert.equal(r.blockGivesBack(r.sideUnder('tuner', {})), 'stage')
    assert.equal(r.tunerStops({ was: 'tuner', now: r.BLOCK, tunerOn: true }), true, 'the tuner stays on at the unit, out of sight, when a block’s knobs take its side')
    assert.equal(r.sideUnder('presets', { tunerLent: 'setlists' }), 'presets')
    /* And the tuner turned on beside a block's knobs takes the side from them, with what they had borrowed. */
    assert.equal(r.tunerGoes({ allowed: true, wide: true, screen: r.BLOCK }), 'side')
    assert.equal(r.sideUnder(r.BLOCK, { blockLent: 'presets' }), 'presets')
    assert.equal(r.tunerGivesBack(r.sideUnder(r.BLOCK, { blockLent: null })), 'stage')
    /* Folded with the knobs beside Play: Play shows, the knobs are not kept, and what they borrowed is what comes back. */
    assert.deepEqual(r.whenNarrow({ tool: r.BLOCK, sideFull: false }), { screen: 'stage', keep: r.BLOCK })
    assert.equal(r.sideUnder(r.whenNarrow({ tool: r.BLOCK }).keep, { tunerLent: 'edit', blockLent: 'setlists' }), 'setlists')
    assert.equal(r.sideUnder(r.whenNarrow({ tool: 'tuner' }).keep, { tunerLent: 'edit', blockLent: 'setlists' }), 'edit')
    assert.equal(r.sideUnder(r.whenNarrow({ tool: 'presets' }).keep, { tunerLent: 'edit', blockLent: 'setlists' }), 'presets')
    /* Never on the list, never a tool to bring back, and named Knobs on its bar. */
    assert.equal(r.BLOCK, 'block')
    assert.equal(r.BLOCK_NAME, 'Knobs')
    assert.ok(!r.TOOLS.includes(r.BLOCK) && r.isTool(r.BLOCK) === false, 'a block’s knobs are on the list beside Play')
    assert.ok(!r.sideTools({ editOpens: true, presetsOffered: true, tunerOffered: true }).includes(r.BLOCK))

    /* A preset change: wait for the new preset's blocks, follow the same block if it is there, close if it is not. */
    assert.equal(r.panelFollows({ found: true, elsewhere: true, acts: false }), 'wait', 'the last preset’s block is shown under the new preset’s name')
    assert.equal(r.panelFollows({ found: false, elsewhere: true }), 'wait')
    assert.equal(r.panelFollows({ found: true, acts: true }), 'show')
    assert.equal(r.panelFollows({ found: true, acts: false }), 'show', 'a scene change, or a re-read of this preset’s own chain, closes it')
    assert.equal(r.panelFollows({ found: false, acts: true }), 'close', 'it stays open on a block the new preset does not have')
    assert.equal(r.panelFollows({ found: false, acts: false }), 'wait', 'an outline drawn ahead of the chain read closes it')
    assert.equal(r.panelFollows(), 'wait')
  })

  test('Derek’s panel where the scenes were: the blocks stay exactly where they are, and a chain that sat under its scenes fills what is left beside the panel', async () => {
    const r = await rules()
    const ASK = { gap: 8, head: 34, between: 16, beside: 24 }
    assert.equal(r.PANEL_LEAST, 320)
    assert.ok(r.PANEL_MOST > r.PANEL_LEAST)
    /* panelLane's own least tile is Play's. */
    const least = { beside: false, sceneCols: 8, chainCols: 1, scene: { wide: 72, high: 72 }, pedal: { wide: 72, high: 72 } }
    assert.equal(r.panelLane({ width: r.PANEL_LEAST + 24 + r.SQUARE_LEAST, plan: least })?.chain, r.SQUARE_LEAST)
    assert.equal(r.panelLane({ width: r.PANEL_LEAST + 24 + r.SQUARE_LEAST - 1, plan: least }), null, 'a panel with no room left for one tile beside it')
    /* Every big screen, with every chain: the panel fits, and whichever way Play's tiles lay, nothing runs off the row. */
    let stayed = 0
    let squaredAgain = 0
    for (const [name, width, room] of [
      ['an 11-inch iPad on its side', 1148, 426],
      ['a 13-inch iPad on its side', 1148, 660],
      ['an iPad mini on its side', 1101, 350],
      ['the Duo with Play full screen', 835, 275],
      ['a Galaxy Fold opened', 809, 310],
      ['an Android tablet sideways', 1148, 450]
    ]) {
      for (const scenes of [0, 4, 8]) {
        for (const pedals of [1, 2, 4, 6, 7, 9, 12, 16, 24]) {
          const at = `${name}, ${scenes} scenes and ${pedals} pedals`
          const plan = r.tilePlan({ width, room, scenes, pedals, ...ASK })
          const lane = r.panelLane({ width, plan, gap: ASK.gap, beside: ASK.beside })
          assert.ok(lane, `${at}: no panel`)
          assert.ok(lane.panel >= r.PANEL_LEAST, `${at}: a panel ${lane.panel} points across`)
          if (lane.stays) {
            stayed++
            assert.equal(plan.beside, true, `${at}: the blocks are said to stay where there was no column beside them`)
            assert.equal(lane.chain, null)
            /* Where the blocks were: centred with the scenes; where they are now: after the panel, from the left edge. The same place. */
            const scenesWide = r.gridWide(plan.sceneCols, plan.scene.wide, ASK.gap)
            const chainWide = r.gridWide(plan.chainCols, plan.pedal.wide, ASK.gap)
            const was = (width - scenesWide - ASK.beside - chainWide) / 2 + scenesWide + ASK.beside
            assert.ok(Math.abs(lane.panel + ASK.beside - was) < 0.001, `${at}: the blocks were at ${was} and are at ${lane.panel + ASK.beside}`)
            assert.ok(lane.panel + ASK.beside + chainWide <= width + 0.001, `${at}: the blocks run off the row`)
          } else {
            squaredAgain++
            assert.ok(lane.panel <= r.PANEL_MOST, `${at}: a panel ${lane.panel} points across`)
            assert.equal(lane.panel + ASK.beside + lane.chain, width, `${at}: the panel and the blocks are not the row`)
            const again = r.tilePlan({ width: lane.chain, room, scenes: 0, pedals, ...ASK })
            assert.ok(again && again.pedal.wide >= r.SQUARE_LEAST && again.pedal.high >= r.SQUARE_LEAST, `${at}: no tiles beside the panel`)
            assert.ok(r.gridWide(again.chainCols, again.pedal.wide, ASK.gap) <= lane.chain + 0.001, `${at}: the blocks beside the panel run off the row`)
            /* And they fill what is left: to its right-hand edge, and down the room, unless they are held back from being banners or the page scrolls. */
            if (!again.capped) assert.ok(r.gridWide(again.chainCols, again.pedal.wide, ASK.gap) >= lane.chain * 0.95, `${at}: the blocks beside the panel stop short of the edge`)
            const down = ASK.head + r.gridTall(Math.ceil(pedals / again.chainCols), again.pedal.high, ASK.gap)
            if (!again.scrolls) assert.ok(down <= room + 0.001, `${at}: the blocks beside the panel run off the bottom`)
            if (!again.scrolls && !again.capped) assert.ok(down >= room * 0.95, `${at}: the blocks beside the panel stop short of the bottom`)
          }
        }
      }
    }
    assert.ok(stayed > 0 && squaredAgain > 0, 'one of the two ways was never tried')
    /* Side by side already (a 13-inch iPad, eight scenes and seven pedals; an AM4's four and four): the blocks stay. */
    for (const [width, room, scenes, pedals] of [[1148, 660, 8, 7], [1148, 426, 4, 4]]) {
      const plan = r.tilePlan({ width, room, scenes, pedals, ...ASK })
      assert.equal(plan.beside, true)
      assert.equal(r.panelLane({ width, plan, gap: ASK.gap, beside: ASK.beside }).stays, true)
    }
    /* The scenes over the blocks (an 11-inch iPad on its side with eight scenes in one row over seven pedals): there is no column to take, so the panel gets one and the blocks fill what is left beside it. */
    const long = r.tilePlan({ width: 1148, room: 426, scenes: 8, pedals: 7, ...ASK })
    assert.equal(long.beside, false, 'eight scenes and seven pedals are side by side on an 11-inch iPad now; pick another for this check')
    const moved = r.panelLane({ width: 1148, plan: long, gap: ASK.gap, beside: ASK.beside })
    assert.equal(moved.stays, false)
    assert.equal(moved.panel, r.PANEL_MOST)
    assert.equal(moved.panel + ASK.beside + moved.chain, 1148)
    /* Scenes too narrow to hold three knobs: the same. And no scenes at all. */
    const thin = r.panelLane({ width: 760, plan: { beside: true, sceneCols: 1, chainCols: 6, scene: { wide: 100, high: 100 }, pedal: { wide: 100, high: 100 } }, gap: 8, beside: 24 })
    assert.equal(thin.stays, false)
    assert.ok(thin.panel >= r.PANEL_LEAST)
    assert.equal(r.panelLane({ width: 1148, plan: { beside: false, sceneCols: 0, chainCols: 7, scene: { wide: 0, high: 0 }, pedal: { wide: 150, high: 150 } }, gap: 8, beside: 24 }).stays, false)
    /* The scenes' column is measured by the scenes' own tiles, which need not be the pedals' size now: two scenes 277 across, whatever the pedals are. */
    const wide = r.panelLane({ width: 1148, plan: { beside: true, sceneCols: 2, chainCols: 2, scene: { wide: 277, high: 192 }, pedal: { wide: 277, high: 392 } }, gap: 8, beside: 24 })
    assert.deepEqual(wide, { panel: 562, stays: true, chain: null })
    /* Nothing measured, nothing planned: no panel, never a guess. */
    assert.equal(r.panelLane({ width: 0, plan: long }), null)
    assert.equal(r.panelLane({ width: 1148, plan: null }), null)
    assert.equal(r.panelLane(), null)
  })

  test('Derek’s panel: the heading says “Hold for its knobs” where the hold opens it and “Hold to switch channels” where it is still the pop-up, and a tap is always on or off', async () => {
    const r = await rules()
    const words = await import('../shared/play-words.mjs')
    const stage = code(read('mobile/src/screens/Stage.js'))
    assert.equal(r.HOLD_FOR_KNOBS, 'Hold for its knobs')
    assert.equal(words.HOLD_FOR_CHANNELS, 'Hold to switch channels')
    assert.equal(r.PANEL_FOOT, 'Hold another block to show its knobs here. One tap on a block still turns it on or off.')
    /* The phone's own words, not the browser's too: shared/ is inside the computer app, and this is no computer release. */
    assert.doesNotMatch(read('shared/play-words.mjs'), /knobs/i)
    /* One line over the blocks, by whether the hold opens knobs here. */
    assert.match(stage, /\{knobsHere \? HOLD_FOR_KNOBS : popKnobs \? HOLD_FOR_QUICK_EDIT : HOLD_FOR_CHANNELS\}/)
    /* "Have it say hold for quick edit": where the pop-up carries the knobs, and only there. A VP4, or a copy whose Edit is shut over Bluetooth, edits nothing by a hold and still says channels. */
    assert.match(read('mobile/src/lib/holdPop.js'), /^export const HOLD_FOR_QUICK_EDIT = 'Hold for quick edit'$/m)
    assert.equal(stage.match(/HOLD_FOR_QUICK_EDIT/g).length, 2, 'quick edit is said somewhere a hold may not edit')
    assert.doesNotMatch(read('shared/play-words.mjs'), /quick edit/i, 'the browser, whose hold is the channels alone, says quick edit')
    assert.equal(stage.match(/HOLD_FOR_KNOBS/g).length, 2, 'the knobs’ words are said somewhere else on Play')
    /* Nobody is told about knobs, or given them, unless App says so: the default is the pop-up. */
    assert.match(stage, /holdOpens = null,\n\s*knobsAt = null,\n\s*onHoldBlock = null,\n\s*onCloseKnobs = null,\n/)
    assert.match(stage, /const lanePlan = \(holdOpens === 'lane' \|\| knobsAt !== null\) && fillOwn \? panelLane\(\{ width: fillRow, plan: fillOwn, gap: space\.sm, beside: space\.xl \}\) : null\n/)
    assert.match(stage, /const knobsHere = holdOpens === 'lane' \? lanePlan !== null : Boolean\(holdOpens\)\n/)
    /* The hold: the knobs where they open, and exactly today's pop-up everywhere else; never on the outline. */
    assert.match(stage, /onLongPress=\{\s*channels\?\.length > 1 && !chainNow\.outline\s*\? \(\) => \(knobsHere \? holdForKnobs\(idOf\(block\)\) : setPicking\(picking === idOf\(block\) \? null : idOf\(block\)\)\)\s*: undefined\s*\}/)
    assert.match(stage, /const holdForKnobs = \(eid\) => \{[^}]*\{[^}]*\}\s*onHoldBlock\?\.\(eid\)\s*\}/)
    assert.match(stage, /<ChannelSheet\s+block=\{chainNow\.elsewhere \|\| chainNow\.outline \? null : blocks\.find\(\(b\) => sameBlock\(b, picking\)\) \|\| null\}\s+channels=\{channels\}\s+onClose=\{\(\) => setPicking\(null\)\}/, 'today’s pop-up changed')
    /* One tap on a block turns it on or off, panel open or not: the tap knows nothing of the panel. */
    const tap = stage.match(/onPress=\{\(\) => \{\s*if \(chainNow\.outline && typeof block\.bypassed !== 'boolean'\) return\s*if \(boost\) tapBoost\(idOf\(block\)\)\s*else writeBypass\(idOf\(block\), !block\.bypassed\)\s*\}\}/)
    assert.ok(tap, 'a tap on a block is not on or off any more')
    assert.doesNotMatch(tap[0], /knobs|holdOpens|onHoldBlock/i)
  })

  test('Derek’s panel is Edit’s own block view, without Copy channel, the on/off button or Color, with Level still read-only and nothing new sent to the unit', async () => {
    const r = await rules()
    const edit = code(read('mobile/src/screens/Edit.js'))
    const side = code(read('mobile/src/components/BlockSide.js'))
    assert.deepEqual(r.PANEL_LEAVES_OUT, ['copy', 'engaged', 'colour'])
    /* Edit's block view, exported and drawn again with `panel`; Edit's own screen draws it without. */
    assert.match(edit, /export function BlockPanel\(\{/)
    assert.match(edit, /overBle = false,\s*panel = false,[^]*?onModelInfo = null,\s+onHoldKnob = null\n\}\) \{/)
    assert.match(side, /import \{ BLE_NOTE, BlockPanel \} from '\.\.\/screens\/Edit'/)
    assert.match(side, /<BlockPanel\s+key=\{`\$\{idOf\(block\)\}:\$\{block\.channel \|\| ''\}:\$\{scene\}:\$\{bufferRev\}`\}\s+panel\s/, 'the panel is not Edit’s block view, or is not drawn again at a new channel, scene or preset')
    assert.equal(edit.match(/<BlockPanel\b/g).length, 1)
    const own = edit.slice(edit.indexOf('<BlockPanel'), edit.indexOf('/>', edit.indexOf('<BlockPanel')))
    assert.doesNotMatch(own, /\bpanel\b/, 'the Edit screen draws its block as the panel, without Copy channel or the on/off button')
    /* What the panel leaves out: the name's row with Color, Copy channel, and Engaged. */
    const view = edit.slice(edit.indexOf('export function BlockPanel({'), edit.indexOf('function BlockColour('))
    assert.match(view, /\{panel \|\| tidy \? null : \(\s*<View[\s\S]*?\{paintable\(block\.slug\) \? <BlockColour slug=\{block\.slug\} \/> : null\}\s*<\/View>\s*\)\}/)
    assert.match(view, /\{!panel && channels\?\.length > 1 && block\.channel && !overBle \? \(\s*<ChannelCopy/)
    assert.match(view, /\{panel \|\| tidy \|\| \['input', 'output'\]\.includes\(block\.slug\) \? null : \(\s*<Press\s+label=\{unsure \? 'Turn it off' : engaged \? 'Engaged' : 'Bypassed'\}/)
    /* And nothing else: `panel` is read in those three places only, and once more where the tidier Edit's one row is ruled out for a panel. */
    assert.match(view, /const tidy = tidyOn && !panel && !bare && !knobless\n/)
    assert.equal(view.match(/\bpanel\b/g).length, 5, 'the panel changes something else in Edit’s block view')
    /* What it keeps: channels A to D, the knob pages, the model, and Level as a number nobody can turn. */
    assert.match(view, /const editable = params\.filter\(\(p\) => !isSilencingParam\(p\.name\)\)/, 'Level is a knob')
    assert.match(view, /<Text[^>]*>read-only<\/Text>/)
    assert.match(view, /await writeChannel\(eid, ch\)/)
    assert.match(view, /caption="Model"/)
    assert.match(view, /pages\.map\(\(pg\) => \(/)
    /* No second copy of the knob code, and nothing of its own on the wire: the panel only finds the block and hands it to Edit's view, whose senders are all marked as Edit's (lib/device EDITING). */
    assert.match(side, /import \{ idOf, sameBlock \} from '\.\.\/lib\/device'/)
    assert.equal(side.match(/from '\.\.\/lib\/device'/g).length, 1)
    assert.doesNotMatch(side, /setParam|setEnum|setType|blockParams|blockTypes|remoteRequest|writeChannel|writeBlockBypass|writeBypass|<Knob\b|ValueBox|ChannelCopy|BlockColour/, 'the panel reads or writes the unit itself, or draws a control of its own')
    const device = read('mobile/src/lib/device.js')
    for (const sender of ['blockParams', 'blockTypes', 'setType', 'setEnum']) assert.match(device, new RegExp(`export const ${sender} = [^\\n]*\\n?[^\\n]*EDITING\\)`), `${sender} is not marked as Edit’s`)
    assert.match(device, /export async function setParamConfirmed\([\s\S]{0,500}?put\(`\/preset\/blocks\/\$\{eid\}\/params\/\$\{paramId\}`, \{ value: norm, continuous \}, EDITING\)/, 'a knob’s checked write is not marked as Edit’s')
    /* Save only with something to save on this slot, which only the computer's path marks; no Done, a Close. */
    assert.match(side, /const pending = !!unsaved && unsaved\.number === preset\?\.number\n/)
    assert.match(side, /\{pending \? <SaveButton s=\{saveTo\} waiting \/> : null\}/)
    assert.match(side, /<Press label="Close" height=\{44\} onPress=\{onClose\}/)
    /* It stays until Close: nothing in it closes it on a timer, and only a preset without the block closes it otherwise. */
    assert.equal(side.match(/onClose/g).length, 5, 'something else in the panel closes it')
    assert.doesNotMatch(side.slice(side.indexOf('export function KnobsFollow')), /setTimeout|setInterval/)
    assert.match(side, /const says = panelFollows\(\{ found, elsewhere: chainNow\.elsewhere, acts: chainActs\(chainNow\.view\) \}\)/)
    assert.match(side, /if \(says === 'close'\) close\.current\?\.\(\)/)
    /* As Edit: another preset's blocks, or this one's from memory, are not opened. */
    assert.match(side, /const chainNow = useChain\(\{ editing: true \}\)\n\s*const block = chainNow\.elsewhere \? null : blocks\.find\(\(b\) => sameBlock\(b, eid\)\) \|\| null\n/)
    assert.match(side, /\{PANEL_FOOT\}/)
    /* The panel never draws a second Play. */
    for (const f of ['mobile/src/components/BlockSide.js', 'mobile/src/screens/Edit.js']) assert.doesNotMatch(code(read(f)), /<Stage\b|screens\/Stage/, `${f} draws Play`)
  })

  test('App opens Derek’s panel behind Edit’s own door and the two sides’ gate, draws it in the side it borrows or hands it to Play, and closes it with its place', () => {
    const app = code(read('mobile/App.js'))
    const stage = code(read('mobile/src/screens/Stage.js'))
    const sides = code(read('mobile/src/components/Sides.js'))
    const edit = code(read('mobile/src/screens/Edit.js'))
    /* The gate: his account, or the two sides' own with HOLD_KNOBS_FOR_EVERYONE, Edit's own door, never a VP4, on a window that shows two sides. */
    assert.match(app, /const noKnobs = vp4Here\(\) \|\| \(demo && demoUnitNow === 'vp4'\)\n\s*const knobsAllowed = sidesAdmin \|\| \(sidesAllowed && HOLD_KNOBS_FOR_EVERYONE\)\n\s*const holdAsks = \{ allowed: knobsAllowed, vp4: noKnobs, wide: big, beside: playBeside, screen \}\n\s*const holdOpens = holdGoes\(\{ \.\.\.holdAsks, editOpens \}\)\n/, 'the panel opens on a VP4, or on the demo’s')
    assert.match(app, /const demoUnitNow = useDemoUnit\(\)\n/)
    assert.match(app, /const editOpens = editHere\.opens\n/)
    /* Open, it stays through a blink of the link, and only where it was opened. */
    assert.match(app, /const blockKept = panelKeeps\(\{ screen, goes: holdGoes\(\{ \.\.\.holdAsks, editOpens: !editHere\.shuts \}\), opened: blockIn\.current \}\)\n/)
    assert.match(app, /useEffect\(\(\) => \{\s*if \(blockAt !== null \? !blockKept : screen === BLOCK\) closeBlock\(\)\s*\}, \[blockAt, blockKept, screen\]\)/)
    /* Never at launch: which block is in memory only. */
    assert.match(app, /const \[blockAt, setBlockAt\] = useState\(null\)\n/)
    assert.doesNotMatch(app, /AsyncStorage/)
    /* The hold: Edit jumps; a side is borrowed from what was there, or from what the tuner there had borrowed; another block moves the panel. */
    assert.match(app, /const holdBlock = \(eid\) => \{\s*if \(holdOpens === 'edit' \|\| \(holdOpens && thirdEdit\)\) return setEditJump\(\{ eid, at: Date\.now\(\) \}\)\s*if \(!holdOpens\) return undefined\s*blockIn\.current = holdOpens\s*if \(holdOpens === 'side' && screen !== BLOCK\) \{\s*blockLent\.current = sideUnder\(screen, \{ tunerLent: tunerLent\.current \}\)\s*setScreen\(BLOCK\)\s*\}\s*return setBlockAt\(eid\)\s*\}/)
    /* Close gives the side back. */
    assert.match(app, /const closeBlock = \(\) => \{\s*setBlockAt\(null\)\s*if \(screen === BLOCK\) setScreen\(blockGivesBack\(blockLent\.current\)\)\s*\}/)
    /* In the side: the panel, with that Close; Edit told which block to jump to; neither kept for Two sides. */
    assert.match(app, /\) : sideTool === BLOCK \? \(\s*blockAt !== null \? <BlockSide eid=\{blockAt\} onClose=\{closeBlock\} \/> : null\s*\) : \(\s*<Edit\s+onBack=\{closeSide\}\s+jump=\{editJump\}/)
    assert.match(app, /useEffect\(\(\) => \{\s*if \(screen !== 'edit' && third !== 'edit'\) setEditJump\(null\)\s*\}, \[screen, third\]\)/)
    assert.match(edit, /export default function Edit\(\{ onBack, onOpenGear, jump = null, beside = false \}\)/)
    assert.match(edit, /if \(!jumpAt \|\| jump\?\.eid == null\) return\s*setOpenEid\(jump\.eid\)\s*setFocus\(\{ eid: jump\.eid, paramId: null, nonce: jumpAt \}\)/)
    /* Play is told where a hold opens knobs, and which block only when they are where the scenes were. */
    assert.match(app, /holdOpens=\{holdOpens\}\s+knobsAt=\{blockKept && screen === 'stage' \? blockAt : null\}\s+onHoldBlock=\{holdBlock\}\s+onCloseKnobs=\{closeBlock\}/)
    /* And follows its block, wherever it is drawn. */
    assert.match(app, /\{blockAt !== null \? <KnobsFollow eid=\{blockAt\} onClose=\{closeBlock\} \/> : null\}/)
    /* Android's back is its Close, before anything else leaves the screen. */
    assert.match(app, /if \(auth !== 'in'\) return false\s*if \(blockAt !== null\) \{\s*closeBlock\(\)\s*return true\s*\}\s*if \(thirdUp\) \{\s*setThird\(null\)\s*return true\s*\}\s*if \(twoSidesUp && backUnwinds\(/)
    /* One Save on screen: the panel's own, as Edit's. */
    assert.match(app, /saveHere=\{screen !== 'edit' && blockAt === null && !thirdEdit\}/)
    /* Where the scenes were: the panel in their place, as tall as the room under the preset, the scenes away while it is up, and Play's page still while a knob is held. */
    assert.match(stage, /const knobsLane = lanePlan && knobsAt !== null && \(lanePlan\.stays \|\| laneAgain\) \? lanePlan : null\n/)
    assert.match(stage, /const fill = knobsLane \? \{ \.\.\.\(knobsLane\.stays \? fillOwn : laneAgain\), beside: true \} : low \? lowFill : fillOwn\n/)
    /* The blocks beside a panel with a column of its own are planned in what is left of the row, for the whole room, with no scenes. */
    assert.match(stage, /const laneAgain =\s*lanePlan && knobsAt !== null && !lanePlan\.stays\s*\? tilePlan\(\{\s*width: lanePlan\.chain,\s*room: fillRoom,\s*scenes: 0,\s*pedals: fitBlocks,\s*\.\.\.fillAsk\s*\}\)\s*: null\n/)
    assert.match(stage, /\{knobsLane \? \(\s*<View style=\{\[KNOBS_BOX, \{ borderColor: color\.rule, width: knobsLane\.panel, height: Math\.max\(0, fillRoom\) \}\]\}>\s*<BlockSide eid=\{knobsAt\} onClose=\{onCloseKnobs\} onScrollLock=\{setKnobHeld\} \/>\s*<\/View>\s*\) : null\}/)
    assert.match(stage, /\{scenes\.hasScenes && !knobsLane \? \(\s*<View style=\{sceneLane\}>/)
    assert.match(stage, /scrollEnabled=\{!\(knobHeld && knobsLane\)\}/)
    assert.match(stage, /const LANES_KNOBS = \{ \.\.\.LANES, justifyContent: 'flex-start' \}\n/)
    /* The side's buttons, in the top bar: named Knobs, no Full screen (Play is where the next block is held), and still nothing for anybody else. */
    const lead = code(read('mobile/src/components/SidesLead.js'))
    assert.match(lead, /const knobs = tool === BLOCK\n\s*const name = knobs \? BLOCK_NAME : TOOL_NAMES\[tool\] \|\| ''\n/)
    assert.match(lead, /knobs \? null : <Press key="full" label=\{fills\}/)
    assert.match(sides, /if \(!allowed\) return children\n/)
  })

  /*
   * A PHONE HELD ON ITS SIDE (10 November 2026): "let's split the screen in
   * half kind of like the iPhone duo even though things will be smaller.
   * It'll still look better instead of just stretching everything", and
   * "Can you make the icons more square looking instead of stretched?"
   * (Justin, on an iPhone 17 Pro Max on its side). Its own answer beside
   * twoSidesOn, his account until features PHONE_SIDEWAYS_FOR_EVERYONE.
   */
  test('a phone held on its side is its own answer: the big iPhones and the 17, never a phone upright, a small phone, a tablet or the Duo, whose own answer does not move', async () => {
    const r = await rules()
    const side = (w, h, insets) => r.phoneSidewaysOn(frameOf(w, h, insets))
    assert.equal(r.SIDEWAYS_AT, 2 * r.SIDE_LEAST, 'a phone on its side splits under two sides of the least a side may be')
    /* On its side, wide enough for two halves of at least SIDE_LEAST. */
    assert.equal(side(956, 440, { left: 62, right: 62 }), true, 'an iPhone 17 Pro Max on its side')
    assert.equal(side(932, 430, { left: 59, right: 59 }), true, 'an iPhone 16 Plus on its side')
    assert.equal(side(852, 393, { left: 59, right: 59 }), true, 'an iPhone 17 on its side')
    assert.equal(side(914.29, 411.43), true, 'an Android phone on its side')
    assert.deepEqual(frameOf(956, 440, { left: 62, right: 62 }), { width: 832, height: 332, left: 62, right: 62 })
    assert.deepEqual(r.splitSides({ width: 832, left: 62, right: 62 }), { first: 416, second: 416 })
    assert.deepEqual(r.splitSides({ width: 734, left: 59, right: 59 }), { first: 367, second: 367 })
    /* Too narrow for two halves: one screen, as today. */
    assert.equal(side(812, 375, { left: 50, right: 50 }), false, 'an iPhone 13 mini on its side: 712 across')
    assert.equal(side(667, 375), false, 'an iPhone SE on its side')
    assert.equal(side(568, 320), false, 'the smallest iPhone on its side')
    /* Held upright: never. */
    for (const [w, h] of [
      [320, 568],
      [375, 667],
      [390, 844],
      [393, 852],
      [411.43, 914.29],
      [430, 932],
      [440, 956]
    ]) {
      assert.equal(side(w, h), false, `a ${w}-point phone held upright`)
      /* And the big-screen rule still says no to it either way up, exactly as before. */
      assert.equal(r.twoSidesOn(frameOf(w, h)), false)
      assert.equal(r.twoSidesOn(frameOf(h, w)), false)
    }
    /* A tablet, a Fold and the Duo are not phones on their sides: their own answer stands, and this one is no. */
    for (const [w, h, insets, two, what] of [
      [951, 669, { right: 84 }, true, 'the iPhone Duo opened like a book'],
      [669, 951, {}, false, 'the Duo opened and held tall'],
      [466, 678, { right: 44 }, false, 'the Duo closed'],
      [1180, 820, {}, true, 'an 11-inch iPad on its side'],
      [820, 1180, {}, false, 'an 11-inch iPad upright'],
      [1133, 744, {}, true, 'an iPad mini on its side'],
      [744, 1133, {}, false, 'an iPad mini upright'],
      [1366, 1024, {}, true, 'a 13-inch iPad on its side'],
      [841, 673, {}, true, 'a Galaxy Fold opened'],
      [1280, 800, {}, true, 'an Android tablet sideways'],
      [590, 820, {}, false, 'half an iPad']
    ]) {
      assert.equal(side(w, h, insets), false, `${what} is taken for a phone on its side`)
      assert.equal(r.twoSidesOn(frameOf(w, h, insets)), two, `${what}: the big-screen rule’s own answer moved`)
    }
    /* Nothing measured yet: one screen, never a guess. */
    assert.equal(r.phoneSidewaysOn({}), false)
    assert.equal(r.phoneSidewaysOn({ width: 0, height: 0 }), false)
    assert.equal(r.phoneSidewaysOn(), false)
  })

  test('a phone on its side: each line goes off 40 past where it came on, and it is never a window as tall as a tablet', async () => {
    const r = await rules()
    const at = (width, height, was) => r.phoneSidewaysOn({ width, height }, was)
    /* Across. */
    assert.equal(at(r.SIDEWAYS_AT - 1, 330, false), false)
    assert.equal(at(r.SIDEWAYS_AT, 330, false), true)
    assert.equal(at(r.SIDEWAYS_AT - r.LETS_GO, 330, true), true)
    assert.equal(at(r.SIDEWAYS_AT - r.LETS_GO - 1, 330, true), false)
    /* Tall enough to be worth it. */
    assert.equal(at(800, r.SIDEWAYS_LOW - 1, false), false)
    assert.equal(at(800, r.SIDEWAYS_LOW, false), true)
    assert.equal(at(800, r.SIDEWAYS_LOW - r.LETS_GO, true), true)
    assert.equal(at(800, r.SIDEWAYS_LOW - r.LETS_GO - 1, true), false)
    /* And UNDER the big screens' line: at it, the answer is theirs. */
    assert.equal(at(800, r.SIDES_TALL - 1, false), true)
    assert.equal(at(800, r.SIDES_TALL, false), false)
    assert.equal(at(800, r.SIDES_TALL + r.LETS_GO - 1, true), true)
    assert.equal(at(800, r.SIDES_TALL + r.LETS_GO, true), false)
    /* No size is ever both, asked fresh: where the big-screen rule says yes, this says no. */
    for (let w = 300; w <= 1400; w += 20) {
      for (let h = 200; h <= 1100; h += 20) {
        const f = { width: w, height: h }
        assert.ok(!(r.twoSidesOn(f) && r.phoneSidewaysOn(f)), `${w} by ${h} is a big screen and a phone on its side at once`)
        if (r.phoneSidewaysOn(f)) assert.ok(w > h && w / 2 >= r.SIDE_LEAST && h < r.SIDES_TALL, `${w} by ${h} is no phone on its side`)
      }
    }
    /* Holding a block there is the channel pop-up: App asks holdGoes with the big-screen answer, never this one. */
    assert.equal(r.holdGoes({ allowed: true, editOpens: true, wide: false, screen: 'stage' }), null)
    assert.equal(r.holdGoes({ allowed: true, editOpens: true, wide: false, beside: true, screen: 'presets' }), null)
  })

  test('on a phone on its side every tile is a square: an FM3’s eight and eight are four across by two in each half, an AM4’s four and four are two by two, and nothing shrinks under a thumb', async () => {
    const r = await rules()
    /* Play alone on an iPhone 17 Pro Max on its side: a row of 800, about 230 under the preset's row, which with its gap is 52. */
    const alone = { width: 800, room: 230, headRow: 52, canHeadUp: true }
    const fm3 = r.sidewaysPlan({ ...alone, scenes: 8, pedals: 8 })
    assert.deepEqual([fm3.beside, fm3.sceneCols, fm3.chainCols, fm3.scrolls, fm3.headUp], [true, 4, 4, false, false], 'an FM3 is not four across by two in each half, its preset’s row over them')
    assert.deepEqual(fm3.scene, { wide: 91, high: 91 })
    assert.deepEqual(fm3.pedal, fm3.scene)
    const am4 = r.sidewaysPlan({ ...alone, scenes: 4, pedals: 4 })
    assert.deepEqual([am4.beside, am4.sceneCols, am4.chainCols, am4.scrolls, am4.headUp], [true, 2, 2, false, true], 'an AM4 is not two by two in each half, its preset’s row up in the top bar')
    assert.deepEqual(am4.scene, { wide: 124, high: 124 })
    /* The row goes up by what it buys, never by the unit: the AM4's squares are 98 with the row in the page. */
    const am4Down = r.sidewaysPlan({ ...alone, canHeadUp: false, scenes: 4, pedals: 4 })
    assert.deepEqual([am4Down.headUp, am4Down.scene.wide], [false, 98])
    assert.ok(am4.scene.wide >= r.HEAD_UP_BUYS * am4Down.scene.wide)
    /* And once up it stays while it still buys a little, so a point of measuring does not send it up and down. */
    assert.ok(r.HEAD_UP_KEEPS > 1 && r.HEAD_UP_KEEPS < r.HEAD_UP_BUYS)
    const edge = { width: 800, room: 230, scenes: 4, pedals: 4, canHeadUp: true, headRow: 26 }
    assert.equal(r.sidewaysPlan(edge).headUp, false, 'a row that buys under HEAD_UP_BUYS goes up')
    assert.equal(r.sidewaysPlan({ ...edge, headWas: true }).headUp, true, 'a row already up comes down for a few points')
    /* On an iPhone 17 on its side, the same shapes a little smaller. */
    const small = { width: 702, room: 190, headRow: 52, canHeadUp: true }
    assert.deepEqual(r.sidewaysPlan({ ...small, scenes: 8, pedals: 8 }).scene, { wide: 78, high: 78 })
    assert.deepEqual([r.sidewaysPlan({ ...small, scenes: 4, pedals: 4 }).sceneCols, r.sidewaysPlan({ ...small, scenes: 4, pedals: 4 }).headUp], [2, true])
    /* In a half beside a tool: the scenes over the chain, never side by side, and the row never up (the bar holds the sides' names). */
    const half = { width: 384, room: 260, split: false }
    const am4Half = r.sidewaysPlan({ ...half, scenes: 4, pedals: 4 })
    assert.deepEqual([am4Half.beside, am4Half.sceneCols, am4Half.chainCols, am4Half.scrolls, am4Half.headUp], [false, 4, 4, false, false], 'an AM4 in a half is not a row of four over a row of four with no scroll')
    const fm3Half = r.sidewaysPlan({ ...half, scenes: 8, pedals: 8 })
    assert.deepEqual([fm3Half.beside, fm3Half.sceneCols, fm3Half.scrolls], [false, 4, true], 'an FM3 in a half is not four across, its chain a scroll under its scenes')
    assert.equal(r.sidewaysPlan({ ...half, scenes: 8, pedals: 8, canHeadUp: true, headRow: 52, split: false }).beside, false)
    /* Only pedals (a unit with no scenes): one grid, the whole row. */
    const only = r.sidewaysPlan({ ...alone, scenes: 0, pedals: 4 })
    assert.deepEqual([only.beside, only.sceneCols, only.chainCols], [false, 0, 4])
    /* Nothing to draw, nothing measured: null, and Play draws as it did. */
    assert.equal(r.sidewaysPlan({ ...alone, scenes: 0, pedals: 0 }), null)
    assert.equal(r.sidewaysPlan({ width: 0, room: 230, scenes: 8, pedals: 8 }), null)
    assert.equal(r.sidewaysPlan({ width: 800, room: 0, scenes: 8, pedals: 8 }), null)
    assert.equal(r.sidewaysPlan(), null)

    /* Every rig, every phone on its side: squares, never under a thumb, never over SQUARE_BIGGEST, and what is said to fit does fit. */
    const gap = 8
    const head = 26
    const tall = (n, cols, side) => (cols ? Math.ceil(n / cols) * side + (Math.ceil(n / cols) - 1) * gap : 0)
    for (const width of [640, 702, 760, 800, 880]) {
      for (const room of [150, 190, 230, 280]) {
        for (let scenes = 0; scenes <= 8; scenes += 4) {
          for (let pedals = 0; pedals <= 24; pedals++) {
            if (!scenes && !pedals) continue
            for (const split of [true, false]) {
              const w = split ? width : (width - 24) / 2 - 16
              const plan = r.sidewaysPlan({ width: w, room, scenes, pedals, gap, head, beside: 24, between: 16, headRow: 52, split, canHeadUp: split })
              const said = `${scenes} scenes and ${pedals} pedals in ${w} by ${room}${split ? '' : ' (a half)'}`
              for (const [kind, n, cols] of [
                [plan.scene, scenes, plan.sceneCols],
                [plan.pedal, pedals, plan.chainCols]
              ]) {
                if (!n) {
                  assert.deepEqual([kind, cols], [{ wide: 0, high: 0 }, 0], said)
                  continue
                }
                assert.equal(kind.wide, kind.high, `${said}: a tile is not a square`)
                assert.ok(kind.wide >= r.SQUARE_SMALLEST && kind.wide <= r.SQUARE_BIGGEST, `${said}: a ${kind.wide}-point square`)
                assert.ok(cols >= 1 && cols <= n, said)
              }
              assert.equal(plan.capped, false)
              if (!split) assert.equal(plan.headUp, false, `${said}: the preset’s row went up from a half`)
              if (plan.scrolls) continue
              const has = room + (plan.headUp ? 52 : 0)
              const halfWide = plan.beside ? (w - 24) / 2 : w
              if (scenes) assert.ok(plan.sceneCols * plan.scene.wide + (plan.sceneCols - 1) * gap <= halfWide + 0.001, `${said}: the scenes are wider than their half`)
              if (pedals) assert.ok(plan.chainCols * plan.pedal.wide + (plan.chainCols - 1) * gap <= halfWide + 0.001, `${said}: the pedals are wider than their half`)
              const needs = plan.beside
                ? head + Math.max(tall(scenes, plan.sceneCols, plan.scene.high), tall(pedals, plan.chainCols, plan.pedal.high))
                : (scenes ? head + tall(scenes, plan.sceneCols, plan.scene.high) : 0) + (scenes && pedals ? 16 : 0) + (pedals ? head + tall(pedals, plan.chainCols, plan.pedal.high) : 0)
              assert.ok(needs <= has + 0.001, `${said}: said to fit, and is ${needs} in ${has}`)
            }
          }
        }
      }
    }
  })

  test('App, the top bar, the sides and Play draw a phone on its side for his account only, and each thing they change is a branch beside the one that was there', () => {
    const app = code(read('mobile/App.js'))
    const stage = code(read('mobile/src/screens/Stage.js'))
    const sides = code(read('mobile/src/components/Sides.js'))
    const bar = code(read('mobile/src/components/TopBar.js'))
    const lead = code(read('mobile/src/components/SidesLead.js'))
    const head = code(read('mobile/src/components/PlayHead.js'))
    const features = read('mobile/src/lib/features.js')
    /* His account until he has seen it on a phone; then everyone the two sides are open to. */
    assert.match(features, /^export const PHONE_SIDEWAYS_FOR_EVERYONE = false$/m, 'a phone on its side splits in two for everyone; that needs his own look first, and its line in What’s new')
    assert.match(app, /const sidewaysAllowed = sidesAdmin \|\| \(sidesAllowed && PHONE_SIDEWAYS_FOR_EVERYONE\)\n/)
    /* Asked only where the big-screen rule said no, with its own memory; and `wide` is either. */
    assert.match(app, /const low = sidewaysAllowed && !big && phoneSidewaysOn\(frame \|\| \{\}, lowWas\.current\)\n\s*lowWas\.current = low\n\s*const wide = big \|\| low\n/)
    /* Play is told by `low`; the sides have no bar of their own on any window (since 10 November 2026, the next test), and the top bar carries their buttons. */
    assert.match(app, /inSide=\{playBeside\}\s*awake=\{!playHidden\}\s*tunerBeside=\{tunerBeside\}\s*low=\{low\}/)
    assert.match(app, /tools=\{toolsOffered\}\s*onPick=\{openTool\}\s*list=\{sideList\}\s*onList=\{setSideList\}/)
    assert.match(app, /slim=\{low && \(screen === 'stage' \|\| twoSidesUp\)\}\s*lead=\{sideLead\}/)
    /* There the bar's left is the two sides' buttons, or Play's own preset and Setlists; and the account's photo gives way to them only there. */
    assert.match(app, /const sideLead = !wide \? null : twoSidesUp \? \(\s*<SidesLead frame=\{frame\} tool=\{sideTool\} full=\{sideFull\} playOnRight=\{playOnRight\} big=\{big\} onName=\{setSideList\} onSwap=\{swapSides\} onFull=\{setSideFull\} handle=\{sideHandle\} share=\{sideShare\} three=\{thirdUp \? third : null\} onAdd=\{thirdCanOpen \? openThirdList : null\} onThird=\{openThirdList\} \/>\s*\) : low \? \(/, 'the bar carries the sides’ buttons on a window that shows one side')
    assert.match(app, /\) : low \? \(\s*screen === 'stage' && playHeadUp \? \(\s*<PlayHead onOpenPresets=\{demo \|\| link\.link === 'connected' \? \(\) => setScreen\('presets'\) : null\} onOpenSetlists=\{\(\) => setScreen\('setlists'\)\} \/>\s*\) : null\s*\) : playOnScreen \? \(/, 'the preset in the bar does not open what Play’s own does, or is drawn off a phone on its side')
    assert.match(app, /onOpenAccount=\{low && sideLead \? null : openAccount\}/)
    /* The bar: something on its left in the version's place, and less padding, only when App says. */
    assert.match(bar, /onOpenAccount = null, lead = null, slim = false, leadKeepsVersion = false, leadWide = 0 \}\)/)
    assert.match(bar, /\{lead \? \(\s*<View style=\{LEAD_ROW\}>\s*\{leadKeepsVersion \? \(/)
    assert.match(bar, /const LEAD_ROW = \{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space\.md \}\n/)
    /* The two sides' buttons there: the names for the list, Swap between them, Full or Two sides; a block's knobs never fill the window. Every line a big screen changes is behind `big`, so with it false this is what #850 drew. */
    assert.match(lead, /if \(!tool\) \{\s*if \(!big\) return null\n/, 'Play alone on a phone on its side has something in the bar from the sides')
    assert.match(lead, /const measured = big\s*\? \{\s*onLayout: \(e\) => \{\s*setAt\(Math\.round\(e\.nativeEvent\.layout\.x\)\)\s*setRow\(Math\.round\(e\.nativeEvent\.layout\.width\)\)\s*\}\s*\}\s*: null\n/, 'a phone on its side measures its row, which nothing is in front of')
    assert.match(lead, /const reach = Math\.max\(0, line - space\.lg - \(big \? at : 0\) - SWAP_WIDE \/ 2 - space\.sm\)\n/, 'Swap is off the line between the sides on a phone on its side')
    assert.match(lead, /const first = big && row !== null \? Math\.min\(reach, Math\.max\(0, row - SWAP_WIDE - space\.sm\)\) : reach\n/, 'Swap can be drawn under the pill on a big screen, or is held short of the line on a phone on its side')
    assert.match(lead, /const fills = big \? fullSays\(widths\.tool\) : SIDEWAYS_FULL\n/, 'a phone on its side says more than Full, which its bar has no room for')
    assert.match(lead, /knobs \? null : <Press key="full" label=\{fills\}/)
    assert.match(lead, /const moved = big && rest !== null && !chipsFit\(/)
    assert.match(lead, /\{big \? \(\s*<View style=\{REST_ALL\} onLayout=\{\(e\) => setRest\(Math\.round\(e\.nativeEvent\.layout\.width\)\)\}>\s*\{moved \? null : after\}\s*<\/View>\s*\) : \(\s*<View style=\{REST\}>\{after\}<\/View>\s*\)\}/)
    assert.match(lead, /const REST = \{ flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space\.sm \}\n/)
    assert.match(lead, /<Press label=\{SIDE_WORDS\.two\}[^\n]*onPress=\{\(\) => onFull\?\.\(false\)\}/)
    assert.match(lead, /<Press label=\{SIDE_WORDS\.swap\}[^\n]*onPress=\{onSwap\}/)
    /* Play's preset and Setlists in the bar: nothing while Play has them in its page. */
    assert.match(head, /const head = usePlayHead\(\)\n\s*if \(!head\) return null\n/)

    /* PLAY. The squares take the place of the plan only there. */
    assert.match(stage, /\n  low = false,\n/)
    assert.match(stage, /const lowFill =\s*low && viewport > 0 && lowTop >= 0\s*\? sidewaysPlan\(\{/)
    assert.match(stage, /split: !inSide,\s*canHeadUp: !inSide && awake,\s*headWas: headWas\.current/)
    assert.match(stage, /const headUp = low && lowFill\?\.headUp === true\n/)
    assert.match(stage, /const fill = knobsLane \? \{ \.\.\.\(knobsLane\.stays \? fillOwn : laneAgain\), beside: true \} : low \? lowFill : fillOwn\n/)
    /* One row of five, 44 tall, short in a half: laid over the list every other Play is handed. */
    assert.match(stage, /if \(low\) Object\.assign\(footing, \{ lined: true, foot: LOW_HEAD, short: inSide \}\)\n/)
    assert.match(stage, /if \(lined && short\) \{\s*return \(\s*<View style=\{FOOT_ROW\}>\s*\{shortOf\(previous, SHORT_PREVIOUS\)\}\s*\{shortOf\(tuner, \{ label: tunerOn \? 'Stop' : 'Tuner' \}\)\}\s*\{shortOf\(edit\)\}\s*\{shortOf\(tap\)\}\s*\{shortOf\(next\)\}/)
    assert.match(stage, /const shortOf = \(button, more\) => \(button \? cloneElement\(button, \{ \.\.\.SHORT, \.\.\.more, style: \[button\.props\.style, SHORT_PAD\] \}\) : null\)\n/, 'a short button is not the button itself with fewer things in it')
    /* The page, the halves and the strip: each its own, said after or over the one that was there. */
    assert.match(stage, /\{\.\.\.\(low \? \{ contentContainerStyle: shape\.wide \? \[LOW_PAGE_WIDE, \{ paddingLeft: space\.lg \+ centre\.left, paddingRight: space\.lg \+ centre\.right \}\] : LOW_PAGE \} : null\)\}/)
    assert.match(stage, /\{\.\.\.\(low && !inSide && halves && fill \? \{ style: LANES_LOW \} : null\)\}/)
    assert.match(stage, /\}, low \? LOW_STRIP : null\]\}/)
    /* The preset's row: its own there, or none while it is up in the bar; everywhere else the block that was always drawn. */
    assert.match(stage, /\{low \? <View collapsable=\{false\} onLayout=\{\(e\) => setLowTop\(e\.nativeEvent\.layout\.y\)\} style=\{LOW_MARK\} \/> : null\}\s*\{low \? \(\s*headUp \? null : \(/)
    assert.match(stage, /\)\s*\) : \(\s*<View style=\{\{ gap: space\.sm \}\}>\s*<View style=\{\{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' \}\}>\s*<Text style=\{\{ color: color\.silkFaint, fontSize: font\.micro, letterSpacing: 1\.5 \}\}>/, 'off a phone on its side, the preset is not the block it always was')
    /* Said to the bar only while it is up there, and taken out when Play goes. */
    assert.match(stage, /sayPlayHead\(\s*headUp\s*\?/)
    assert.match(stage, /useEffect\(\(\) => \(\) => sayPlayHead\(null\), \[\]\)\n/)
    /* Nothing in Play reads a LOW_ size, the squares or the short buttons but behind `low` (or `short`, which only `low` sets). */
    const body = stage.slice(stage.indexOf('export default function Stage('))
    for (const line of body.split('\n')) {
      if (!/\b(LOW_[A-Z_]+|lowFill|LANES_LOW|PRESET_HALVES|SETLISTS_IN_HALF|SHORT_PREVIOUS)\b/.test(line)) continue
      if (/^const [A-Z_]+ = /.test(line) || /^\s*const lowFill =$/.test(line)) continue
      assert.match(line, /\blow\b|\bshort\b|lowTop|headTall|inSide \? PRESET_ROW : PRESET_HALVES|style=\{inSide \? SETLISTS_IN_HALF : LOW_PRESS\}|style=\{\[LOW_PRESET,|height=\{LOW_HEAD\}|room: viewport - lowTop|\{shortOf\(previous, SHORT_PREVIOUS\)\}/, `Play reads a phone-on-its-side size outside its branch: ${line.trim()}`)
    }
  })

  /*
   * THE TWO SIDES' BUTTONS ARE IN THE APP'S TOP BAR ON A BIG SCREEN TOO
   * (10 November 2026): "The play and two sides buttons take up a whole row
   * on iPad. What other options for those?" (Justin, on his iPad; offered
   * the top bar: "Yes do that now"). For everyone the two sides are open to:
   * it moves buttons that were there, and adds none.
   */
  test('on a big screen the two sides have no bar of their own: their names, Swap and Full screen or Two sides are in the app’s top bar, Swap on the line between them', async () => {
    const r = await rules()
    /* The words: whole over a side with room for them, short over a narrow one, as on every phone. */
    assert.equal(r.FULL_WORDS_AT, 480)
    const ipad = frameOf(1180, 820)
    const duo = frameOf(951, 669, { left: 84 })
    const fold = frameOf(841, 720)
    const max = frameOf(956, 440, { left: 62, right: 62 })
    const toolWide = (frame, more) => r.sideWidths({ ...frame, ...more }).tool
    assert.equal(r.fullSays(toolWide(ipad, { tool: 'edit' })), 'Full screen', 'an iPad on its side has the room and says Full')
    assert.equal(r.fullSays(toolWide(frameOf(1366, 1024), { tool: 'presets' })), 'Full screen')
    assert.equal(r.fullSays(toolWide(ipad, { tool: 'tuner' })), 'Full', 'the tuner’s narrow column is 360: two words do not fit over it')
    for (const playOnRight of [true, false]) assert.equal(r.fullSays(toolWide(duo, { tool: 'edit', playOnRight })), 'Full', 'the Duo’s sides are about an iPhone wide')
    assert.equal(r.fullSays(toolWide(fold, { tool: 'setlists' })), 'Full')
    assert.equal(r.fullSays(toolWide(max, { tool: 'edit' })), 'Full', 'a phone on its side')
    assert.equal(r.fullSays(0), 'Full')
    assert.equal(r.fullSays(undefined), 'Full')
    /* How far the buttons reach along the bar: to the far edge of Swap, which is centred on the real line between the sides. */
    assert.equal(r.SWAP_WIDE, 64)
    assert.equal(r.leadReach({ ...ipad, tool: 'edit' }), 590 + 32)
    assert.equal(r.leadReach({ ...ipad, tool: 'edit', playOnRight: false }), 590 + 32)
    /* The tuner's column: 360 on the tool's side, wherever that is. */
    assert.equal(r.leadReach({ ...ipad, tool: 'tuner' }), 360 + 32)
    assert.equal(r.leadReach({ ...ipad, tool: 'tuner', playOnRight: false }), 1180 - 360 + 32)
    /* The Duo: the fold, not the frame's middle (475.5 and 391.5 with the strip on the left). */
    assert.equal(r.leadReach({ ...duo, tool: 'presets' }), 391.5 + 32)
    assert.equal(r.leadReach({ ...duo, tool: 'presets', playOnRight: false }), 391.5 + 32)
    assert.equal(r.leadReach({ ...frameOf(951, 669, { right: 84 }), tool: 'presets' }), 475.5 + 32)
    /* Always where the sides themselves are divided. */
    for (const frame of [ipad, duo, fold, frameOf(1366, 1024), frameOf(1280, 800)]) {
      for (const tool of ['edit', 'setlists', 'presets', 'tuner', r.BLOCK]) {
        for (const playOnRight of [true, false]) {
          const w = r.sideWidths({ ...frame, tool, playOnRight })
          assert.equal(r.leadReach({ ...frame, tool, playOnRight }), (playOnRight ? w.tool : w.play) + r.SWAP_WIDE / 2, `${frame.width} ${tool} ${playOnRight}`)
        }
      }
    }
    /* A tool filling the window, or Play alone: room for a name and Two sides. */
    assert.equal(r.leadReach({ ...ipad, tool: 'edit', full: true }), r.LEAD_ALONE)
    assert.equal(r.leadReach({ ...ipad, tool: null }), r.LEAD_ALONE)
    assert.equal(r.leadReach(), r.LEAD_ALONE)
    /* Whether a side's buttons fit what the bar has left past Swap; where they do not, they are moved before Swap, never cut. */
    assert.equal(r.chipsFit({ room: 300, labels: ['Play ▾'] }), true)
    assert.equal(r.chipsFit({ room: 60, labels: ['Tuner ▾', 'Full'] }), false, 'the tuner’s buttons are said to fit beside the pill in 60 points')
    assert.equal(r.chipsFit({ room: 0, labels: ['Play ▾'] }), false)
    assert.equal(r.chipsFit({ room: 0, labels: [] }), true)
    assert.equal(r.chipsFit({ room: 0, labels: [null, ''] }), true, 'a button that is not drawn needs room')
    /* 7 letters at 8 with 24 round them is 80, and 4 at 8 with 24 is 56, with 8 between: 144. */
    assert.equal(r.chipsFit({ room: 144, labels: ['Tuner ▾', null, 'Full'] }), true)
    assert.equal(r.chipsFit({ room: 143, labels: ['Tuner ▾', null, 'Full'] }), false)
    assert.equal(r.chipsFit({ room: 143, labels: ['Tuner ▾', 'Full'], letter: 7 }), true)

    const app = code(read('mobile/App.js'))
    const sides = code(read('mobile/src/components/Sides.js'))
    const bar = code(read('mobile/src/components/TopBar.js'))
    const lead = code(read('mobile/src/components/SidesLead.js'))
    /* The sides draw no bar and keep no list of their own: both are App's and the top bar's now. */
    assert.doesNotMatch(sides, /SideBar|BAR_TALL|useState|SIDE_WORDS/, 'a side has a bar of its own again')
    assert.match(sides, /onPick,\s*list = null,\s*onList = null,\s*children\s*\}\) \{\s*if \(!allowed\) return children\n/)
    assert.match(sides, /<Sheet open=\{list !== null\} onClose=\{\(\) => onList\?\.\(null\)\} title=\{list === 'play' \? 'Beside Play' : 'This side'\} note=\{PLAY_ALWAYS\}>/)
    assert.match(sides, /const pick = \(t\) => \{\s*onList\?\.\(null\)\s*onPick\?\.\(t\)\s*\}/)
    /* Play's slot holds Play and nothing over it, in every mode. */
    assert.match(sides, /importantForAccessibility=\{playHidden \? 'no-hide-descendants' : 'auto'\}\s*>\s*\{\s*\}\s*<EdgeBack onBack=\{beside \? swallow : null\} style=\{\{ flex: 1 \}\}>/)
    assert.match(sides, /<View key="side" style=\{\[beside \? \{ width: widths\.tool \} : \{ flex: 1 \}, beside \? DIVIDED\[playOnRight \? 'left' : 'right'\] : null\]\}>\s*<View style=\{\{ flex: 1 \}\}>\{side\}<\/View>/)
    /* App: the lead wherever the window shows two; with Play alone on a big screen, Two sides, which brings the kept tool back or opens the list. */
    assert.match(app, /\) : playOnScreen \? \(\s*<>\s*(?:\{\s*\}\s*)?\{stageViewAllowed \? <Press label=\{STAGE_VIEW_NAME\} [^\n]* \/> : null\}\s*<SidesLead big onTwo=\{sideKept \? \(\) => openTool\(sideKept\) : \(\) => setSideList\('play'\)\} \/>\s*<\/>\s*\) : null\n/, 'Play alone on a big screen has no way to bring the other side back, or has it off Play')
    assert.match(app, /const playOnScreen = screen === 'stage' && !settling\n/)
    /* The version stays in front on a big screen, the bar is told how far the buttons reach, and the photo keeps its way in. */
    assert.match(app, /lead=\{sideLead\}\s*leadKeepsVersion=\{big\}\s*leadWide=\{sideLeadWide\}/)
    assert.match(app, /const sideLeadWide = big && sideLead \? leadReach\(\{ width: frame\?\.width, left: frame\?\.left, right: frame\?\.right, playOnRight, tool: twoSidesUp \? sideTool : null, full: sideFull, share: sideShare \}\) : 0\n/)
    assert.match(app, /onOpenAccount=\{low && sideLead \? null : openAccount\}/, 'the account’s photo is taken off a big screen’s bar, which has the room for it')
    /* The list closes with the window's second side, and a side's own list with that side; Play's list stays open over Play alone. */
    assert.match(app, /if \(!wide \|\| \(sideList === 'tool' && !twoSidesUp\)\) setSideList\(null\)\n\s*\}, \[wide, twoSidesUp, sideList\]\)/)
    /* The bar: the version, as wide as its words, then the buttons; and the photo only where the pill still fits beside what they keep. */
    assert.match(bar, /\{leadKeepsVersion \? \(\s*<Text numberOfLines=\{1\} style=\{\{ color: color\.silkFaint, fontSize: font\.micro, fontFamily: face, letterSpacing: 1 \}\}>\s*\{`v\$\{APP_VERSION\}`\}\s*<\/Text>\s*\) : null\}\s*\{lead\}/)
    assert.match(bar, /const leadKeeps = Math\.max\(0, \(Number\(leadWide\) \|\| 0\) - space\.lg\)\n/)
    assert.match(bar, /\(hasOutput \? space\.md \+ 24 : 0\) - leadKeeps\n/)
    /* Only `slim` is laid over the bar's style: its height on a big screen is what it was. */
    assert.match(bar, /zIndex: 3\s*\}, slim \? SLIM : null\]\}/)
    /* The buttons: Play alone, Two sides; a tool filling the window, its name and Two sides; beside Play, measured from where the row starts so Swap is on the line. */
    assert.match(lead, /if \(!tool\) \{\s*if \(!big\) return null\s*return \(\s*<View style=\{ROW\} \{\.\.\.measured\}>\s*<Press label=\{SIDE_WORDS\.two\} height=\{HIGH\} labelSize=\{font\.small\} onPress=\{onTwo\} accessibilityLabel="Show Split View" style=\{CHIP\} \/>/)
    assert.match(lead, /const \[at, setAt\] = useState\(big \? VERSION_ROOM : 0\)\n/)
    assert.match(lead, /const line = playOnRight \? widths\.tool : widths\.play\n/)
    assert.match(lead, /style=\{\[CHIP, \{ width: SWAP_WIDE \}\]\}/)
    /* Moved: both sides' buttons in the first half, the far side's at its end beside Swap, and nothing past Swap. */
    assert.match(lead, /<View style=\{\[moved \? HALF_APART : HALF, \{ width: first \}\]\}>\s*\{moved \? <View style=\{HALF\}>\{before\}<\/View> : before\}\s*\{moved \? <View style=\{HALF\}>\{after\}<\/View> : null\}\s*<\/View>/)
    assert.match(lead, /const afterSays = playOnRight \? \[`\$\{TOOL_NAMES\.play\} ▾`\] : \[`\$\{name\} ▾`, knobs \? null : fills\]\n/)
  })
}
