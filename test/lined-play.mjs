/**
 * PLAY LINED UP (mobile/src/lib/linedPlay.js): Justin's "A1" for an iPad, an
 * Android tablet and the iPhone Duo opened. Scenes on the left, the chain on
 * the right, the same rows on both sides; Previous and Next at the two ends of
 * one row of buttons. Every phone keeps today's Play.
 *
 * The rule is run as it is (it imports nothing), with lib/playShape beside it
 * for Play's own width line; and Stage is read for what it draws with it:
 * the same scene and pedal tiles as every other Play, never a second copy.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* Comments out, so a check reads the code and not its explanation. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

/** lib/linedPlay and lib/playShape (with the lib/gigSize it reads), run from copies. */
async function rules() {
  const lined = read('mobile/src/lib/linedPlay.js')
  assert.doesNotMatch(lined, /^import /m, 'lib/linedPlay imports something; this check runs it on its own')
  const dir = mkdtempSync(join(tmpdir(), 'lined-play-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    writeFileSync(join(dir, 'linedPlay.js'), lined)
    writeFileSync(join(dir, 'gigSize.js'), read('mobile/src/lib/gigSize.js'))
    writeFileSync(join(dir, 'playShape.js'), read('mobile/src/lib/playShape.js').replace("from './gigSize'", "from './gigSize.js'"))
    const l = await import(pathToFileURL(join(dir, 'linedPlay.js')).href)
    const p = await import(pathToFileURL(join(dir, 'playShape.js')).href)
    return { ...l, ...p }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/*
 * A device's window as Play gets it: its width less nothing down the sides,
 * and its height less the clock, the app's top bar and the strip of buttons
 * fixed to the bottom of an opened-up Play, about 200 points on all of them.
 */
const CHROME = 200
function playOn(g, width, height, was = null) {
  const shape = g.playShape(g.pageRow(width), 0, 'across', was?.shape)
  const lined = g.linedOn({ wide: shape.wide, tall: height - CHROME, across: width }, was?.lined)
  return { shape, lined }
}

export function run(test) {
  test('Play lines up only where it has room both ways and is wider than tall: a tablet on its side, the Duo and a Fold opened, never a phone or a tablet upright', async () => {
    const g = await rules()
    /* Phones held upright, at every width they come in: today's Play. */
    for (const [w, h] of [
      [320, 568],
      [375, 667],
      [390, 844],
      [393, 852],
      [411.43, 914.29],
      [430, 932],
      [440, 956]
    ]) assert.equal(playOn(g, w, h).lined, false, `a ${w} by ${h} phone lined up`)
    /* An iPhone on its side (and the few Android phones that turn): wide, and far too short. */
    assert.equal(playOn(g, 844, 390).lined, false, 'an iPhone on its side lined up')
    assert.equal(playOn(g, 932, 430).lined, false, 'a big iPhone on its side lined up')
    assert.equal(playOn(g, 915, 412).lined, false, 'an Android phone on its side lined up')
    /* A tablet on its side, a small one too, the Duo and a Fold opened (nearly square, so Play is wider than tall). */
    for (const [w, h, what] of [
      [1180, 820, 'an iPad on its side'],
      [1194, 834, 'an iPad Pro 11 on its side'],
      [1133, 744, 'an iPad mini on its side'],
      [1366, 1024, 'an iPad Pro 13 on its side'],
      [700, 830, 'the iPhone Duo opened'],
      [1280, 800, 'an Android tablet on its side'],
      [673, 841, 'a Galaxy Fold opened']
    ]) assert.equal(playOn(g, w, h).lined, true, `${what} (${w} by ${h}) did not line up`)
    /*
     * A tablet held upright: the phone's own Play, bigger, as before A1. "The
     * iPad portrait view was already fine back before a few updates ago. It
     * should basically look just like the phone does portrait view, just
     * bigger" (7 November 2026, on an iPad Pro held upright).
     */
    for (const [w, h, what] of [
      [820, 1180, 'an iPad upright'],
      [834, 1194, 'an iPad Pro 11 upright'],
      [744, 1133, 'an iPad mini upright'],
      [1024, 1366, 'an iPad Pro upright'],
      [800, 1280, 'an Android tablet upright']
    ]) {
      const p = playOn(g, w, h)
      assert.equal(p.lined, false, `${what} (${w} by ${h}) lined up, where it should be the phone's Play, bigger`)
      assert.equal(p.shape.wide, true, `${what} lost the opened-up Play it had before A1`)
    }
    /* An iPad sharing the screen: lined up while its half is wide enough, today's Play when it is a slim third. */
    assert.equal(playOn(g, 320, 1180).lined, false, 'an iPad’s slim third lined up')
    assert.equal(playOn(g, 507, 820).lined, false, 'half an iPad mini lined up')
    /* The height's line goes off 40 under where it came on. */
    const on = g.LINED_TALL
    assert.equal(g.linedOn({ wide: true, tall: on - 1, across: 1200 }), false)
    assert.equal(g.linedOn({ wide: true, tall: on, across: 1200 }), true)
    assert.equal(g.linedOn({ wide: true, tall: on - 20, across: 1200 }, true), true, 'a screen a little shorter flips straight back')
    assert.equal(g.linedOn({ wide: true, tall: on - g.LINED_LETS_GO - 1, across: 1200 }, true), false)
    /* And Play's width against its height: on at least as wide as tall, off 40 narrower than that. */
    assert.equal(g.linedOn({ wide: true, tall: 700, across: 699 }), false)
    assert.equal(g.linedOn({ wide: true, tall: 700, across: 700 }), true)
    assert.equal(g.linedOn({ wide: true, tall: 700, across: 670 }, true), true, 'a split-view drag a little narrower flips straight back')
    assert.equal(g.linedOn({ wide: true, tall: 700, across: 700 - g.LINED_LETS_GO - 1 }, true), false)
    /* Never without Play's own width line, however tall, nor before Play has measured its width. */
    assert.equal(g.linedOn({ wide: false, tall: 2000, across: 3000 }), false)
    assert.equal(g.linedOn({ wide: true, tall: on }), false, 'a Play with no width lined up')
    assert.equal(g.linedOn({}), false)
  })

  test('the scenes and the chain have the same rows: an AM4 two big rows, an FM3 four, an Axe-Fx III four with the chain four across', async () => {
    const g = await rules()
    /* AM4: four scenes, four pedals. */
    assert.deepEqual(g.linedPlan({ scenes: 4, pedals: 4 }), { sceneCols: 2, chainCols: 2, sceneRows: 2, chainRows: 2, rows: 2, scrolls: false })
    /* FM3: eight scenes, seven pedals and the looper's. */
    assert.deepEqual(g.linedPlan({ scenes: 8, pedals: 8 }), { sceneCols: 2, chainCols: 2, sceneRows: 4, chainRows: 4, rows: 4, scrolls: false })
    /* Eight pedals stay two across; nine go four. */
    assert.equal(g.linedPlan({ scenes: 8, pedals: 9 }).chainCols, 4)
    assert.equal(g.linedPlan({ scenes: 8, pedals: 9 }).rows, 4)
    /* Axe-Fx III: eight scenes, sixteen pedals four across. */
    assert.deepEqual(g.linedPlan({ scenes: 8, pedals: 16 }), { sceneCols: 2, chainCols: 4, sceneRows: 4, chainRows: 4, rows: 4, scrolls: false })
    /* A chain of twenty: the tiles stay the scenes' size and the chain scrolls a row. */
    assert.deepEqual(g.linedPlan({ scenes: 8, pedals: 20 }), { sceneCols: 2, chainCols: 4, sceneRows: 4, chainRows: 5, rows: 4, scrolls: true })
    /* An AM4 with a long chain: rows up to four before anything scrolls. */
    assert.deepEqual(g.linedPlan({ scenes: 4, pedals: 7 }), { sceneCols: 2, chainCols: 2, sceneRows: 2, chainRows: 4, rows: 4, scrolls: false })
    /* Nothing read yet: one row, nothing to scroll. */
    assert.equal(g.linedPlan({}).rows, 1)
    assert.equal(g.linedPlan({ scenes: 0, pedals: 3 }).rows, 2)
  })

  test('every tile lined up is one height, filling its room, and never under 44 or past the ceiling', async () => {
    const g = await rules()
    /* Four rows in 700 points with 8 between: 169 each, and the rows exactly fill it or come in under. */
    const tile = g.linedTile({ room: 700, rows: 4, gap: 8 })
    assert.equal(tile, 169)
    assert.ok(g.linedRowsTall(4, tile, 8) <= 700)
    /* Two rows on an iPad held upright would be absurd: held to the ceiling. */
    assert.equal(g.linedTile({ room: 1000, rows: 2, gap: 8 }), g.LINED_TILE_MAX)
    /* A room squeezed by the notes at the top: never under the platforms' 44 (the page scrolls). */
    assert.equal(g.linedTile({ room: 100, rows: 4, gap: 8 }), g.LINED_TILE_MIN)
    assert.equal(g.linedTile({ room: -50, rows: 0 }), g.LINED_TILE_MIN)
    /* A pedal's name: today's 15 on a narrow tile, bigger on a big one, never past 22. */
    assert.equal(g.linedName({ height: 169, width: 80 }), 15)
    assert.equal(g.linedName({ height: 169, width: 180 }), 20)
    assert.equal(g.linedName({ height: 320, width: 400 }), 22)
    assert.equal(g.linedName({}), 15)
  })

  test('Play lined up draws the same scene and pedal tiles as every other Play, with its rows level and its five buttons in A1’s order', () => {
    const src = read('mobile/src/screens/Stage.js')
    const stage = code(src)
    /* One scene tile, one pedal tile and the looper's: the lined-up Play is these same tiles, never a second copy. */
    assert.equal(stage.match(/<Tile\b/g).length, 3, 'Play has a second set of tiles')
    assert.match(stage, /caption=\{String\(i \+ 1\)\}[\s\S]{0,900}height=\{sceneTall\}[\s\S]{0,200}onPress=\{\(\) => writeScene\(i\)\}/, 'the scene tiles are not drawn at the lined-up height')
    assert.equal(stage.split('height={pedalTall}').length - 1, 3, 'the pedals, the looper and the grey cards are not one height')
    /* Lined up, a scene and a pedal are the same cell, so the rows line up; otherwise exactly today's numbers. */
    assert.match(stage, /const sceneTall = lined \? cell : tileH\n/)
    assert.match(stage, /const pedalTall = lined \? cell : Math\.max\(tight \|\| fitted \? 44 : TAP, tileH - 12\)\n/)
    assert.match(stage, /const sceneAcross = lined \? plan\.sceneCols : sceneCols\n/)
    assert.match(stage, /const pedalsAcross = lined \? plan\.chainCols : fxCols\n/)
    assert.match(stage, /const pedalWords = lined \? linedName\([^\n]*\) : undefined\n/)
    assert.match(stage, /const lined = linedOn\(\{ wide: shape\.wide, tall: viewport, across: playWidth \}, linedWas\.current\)\n/, 'lined up is decided by something other than Play’s own size')
    assert.match(stage, /const plan = linedPlan\(\{ scenes: scenes\.hasScenes \? scenes\.count : 0, pedals: fitBlocks \}\)\n/, 'the rows do not count the looper, or the cards while a preset loads')
    /* Both halves start level: each heading the same height. */
    assert.equal(stage.match(/style=\{lined \? LANE_HEADING : /g).length, 2, 'the two headings are not one height lined up')
    assert.equal(stage.match(/style=\{lined \? laneBox : \{ gap: space\.sm \}\}/g).length, 2, 'the scenes and the chain are not the two halves')
    /*
     * Each half its own width, never flex: on an iPad Pro on its side
     * (7 November 2026) flex: 1 came out 661 points for the scenes and 463
     * for the chain: Yoga kept the stacked first frame's heights as the
     * halves' flex basis, and the chain's pedals went one to a row off the
     * bottom of the screen. A width is worked out again on every pass.
     */
    assert.match(stage, /const LANE = \{ flexGrow: 1, flexShrink: 1, gap: space\.sm \}\n/, 'a half is left to flex or a flex basis, which Yoga keeps from the stacked first frame')
    assert.doesNotMatch(stage.slice(stage.indexOf('const LANE ='), stage.indexOf('const LANE_HEADING')), /\bflex:|flexBasis/, 'a half has a flex or a flex basis again')
    assert.match(stage, /const laneBox = lined \? \[LANE, \{ width: laneRow \}\] : null\n/, 'the halves are not each the row their tiles were sized from')
    assert.match(stage, /\{lined && !scenes\.hasScenes \? <View style=\{laneBox\} \/> : null\}/, 'with no scenes the chain does not keep its own half')
    /* And the two widths and the gap are exactly the page inside its padding, the padding the page is drawn with. */
    assert.match(stage, /const laneRow = lined \? Math\.max\(0, \(pageRow\(playWidth, space\.lg\) - centre\.left - centre\.right - space\.xl\) \/ 2\) : row\n/)
    assert.match(stage, /maxWidth: PAGE_MAX,\s*alignSelf: 'center',\s*paddingTop: space\.lg,\s*paddingLeft: space\.lg \+ centre\.left,\s*paddingRight: space\.lg \+ centre\.right,/, 'Play’s page is padded by other numbers than the halves are worked out from')
    assert.match(stage, /const LANES = \{ flexDirection: 'row', gap: space\.xl, alignItems: 'flex-start' \}\n/, 'the gap between the halves is not the one their widths leave')
    assert.match(stage, /style=\{lined \? LANES : \{ gap: tight \? space\.md : space\.lg \}\}/, 'the halves are not side by side lined up, or today’s page moved')
    /* The preset across the top with Setlists at its end, lined up only. */
    assert.match(stage, /<View style=\{lined \? PRESET_ROW : undefined\}>\s*<Press\s+grow=\{lined\}/)
    assert.match(stage, /\{lined \? <SetlistsPress \{\.\.\.footing\}[^\n]*\/> : null\}/, 'Setlists is out of reach lined up')
    /* The bottom row: Previous far left, Tuner, Edit, Tap, Next far right. */
    const foot = stage.slice(stage.indexOf('function PlayFoot('), stage.indexOf('const FOOT_HALF'))
    assert.match(foot.replace(/\s+/g, ' '), /if \(lined\) \{ return \( <View style=\{FOOT_ROW\}> \{previous\} \{tuner\} \{edit\} \{tap\} \{next\} <\/View> \) \}/, 'the lined-up buttons are not in A1’s order')
    /* The spread shape's two halves never inherit the two-row shape's rows, and their heights as a flex basis. */
    assert.match(foot, /<View key="one-row" style=\{FOOT_ONE_ROW\}>/, 'the spread buttons reuse the two-row shape’s Views')
    assert.match(foot, /<View key="two-rows" style=\{\{ gap: space\.sm \}\}>/, 'the two-row buttons reuse the spread shape’s Views')
    assert.match(stage, /lined,\n/, 'the buttons are not told Play is lined up')
    /* The Duo's fold down the middle gap, and nothing decided by the kind of device or which way up it is. */
    assert.match(stage, /const centre = lined \? foldInset\(insets\.left, insets\.right\) : fold\n/)
    assert.doesNotMatch(stage, /Platform\.isPad|isTablet|orientation|Dimensions\.get/)
    /* The chain scrolls inside itself past the scenes' rows, and only lined up. */
    assert.match(stage, /const chainScrolls = lined && plan\.scrolls\n/)
    assert.match(stage, /<ChainFrame \{\.\.\.chainFrame\}>/)
  })
}
