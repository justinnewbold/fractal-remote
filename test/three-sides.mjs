/**
 * THREE ACROSS ON A VERY WIDE WINDOW: Play and two tools at once
 * (mobile/src/lib/threeSides.js, components/Sides.js,
 * components/SidesLead.js, App.js).
 *
 * "Three across on the big iPad Pro: Play, Edit and a list at once" was one
 * of the ideas Justin said yes to on 10 November 2026 ("yes to all your
 * other non build suggestions as well"). His account until features
 * THREE_SIDES_FOR_EVERYONE opens it; closed to an account, every window is
 * what it was, a 13-inch iPad on its side included.
 *
 * The rule file imports nothing and is run as it is, beside lib/twoSides,
 * whose answer has to be yes first. The rest is read for how it is wired.
 * Nobody here has a 13-inch iPad: its numbers are its window's, less what
 * the phone and the app's own bar keep, as test/two-sides.mjs counts them.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* Comments out, so a check reads the code and not its explanation. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

/** lib/threeSides and lib/twoSides, each run from a copy: neither imports anything. */
async function rules() {
  const dir = mkdtempSync(join(tmpdir(), 'three-sides-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    const out = {}
    for (const f of ['twoSides', 'threeSides']) {
      const src = read(`mobile/src/lib/${f}.js`)
      assert.doesNotMatch(src, /^import /m, `lib/${f} imports something; this check runs it on its own`)
      writeFileSync(join(dir, `${f}.js`), src)
      Object.assign(out, await import(pathToFileURL(join(dir, `${f}.js`)).href))
    }
    return out
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* A device's frame under the app's top bar, as test/two-sides.mjs counts it: its window less the phone's own top and bottom and the bar (108 together), and less what it keeps down each side. */
const CHROME = 108
const frameOf = (width, height, { left = 0, right = 0 } = {}) => ({ width: width - left - right, height: height - CHROME, left, right })

/* Every window the app is known to run in: [name, width, height, what the phone keeps down its sides]. */
const PHONES = [
  [320, 568],
  [375, 667],
  [375, 812],
  [390, 844],
  [393, 852],
  [402, 874],
  [411.43, 914.29],
  [430, 932],
  [440, 956]
]
const ONE_OR_TWO = [
  ['an iPad mini on its side', 1133, 744],
  ['an iPad mini upright', 744, 1133],
  ['a 10.9-inch iPad on its side', 1180, 820],
  ['an 11-inch iPad Pro on its side', 1194, 834],
  ['the newest 11-inch iPad Pro on its side', 1210, 834],
  ['an 11-inch iPad upright', 834, 1194],
  ['a 13-inch iPad Pro upright', 1024, 1366],
  ['the newest 13-inch iPad Pro upright', 1032, 1376],
  ['an Android tablet sideways', 1280, 800],
  ['a Galaxy Fold opened', 841, 673],
  ['the iPhone Duo opened, strip on the right', 951, 669, { right: 84 }],
  ['the iPhone Duo opened, strip on the left', 951, 669, { left: 84 }],
  ['the Duo opened and held tall', 669, 951],
  ['the Duo closed', 466, 678, { right: 44 }],
  ['half a 13-inch iPad, sharing its screen', 678, 1024],
  ['two thirds of a 13-inch iPad on its side', 981, 1024]
]

export function run(test) {
  test('three across: a 13-inch iPad Pro on its side and nothing smaller; every phone, an 11-inch iPad, the Duo and a fold are what they were', async () => {
    const r = await rules()
    const three = (w, h, insets) => r.threeSidesOn(frameOf(w, h, insets), false, r.SIDES_TALL)
    assert.equal(r.SIDES_TALL, 500, 'lib/twoSides’ own height, which App hands in')
    assert.equal(r.THREE_AT, 1290, 'three sides of 430, an iPhone Pro Max’s own width')
    assert.equal(r.THREE_LETS_GO, r.LETS_GO, 'the same memory as the two sides')
    /* Three. */
    assert.equal(three(1366, 1024), true, 'a 13-inch iPad Pro on its side')
    assert.equal(three(1376, 1032), true, 'the newest 13-inch iPad Pro on its side')
    assert.equal(three(1848, 1155), true, 'the biggest Android tablet sideways')
    /* Wherever it says three, the two sides said yes first: the third is an addition to them. */
    for (const [w, h] of [
      [1366, 1024],
      [1376, 1032],
      [1848, 1155]
    ])
      assert.equal(r.twoSidesOn(frameOf(w, h)), true, `${w} by ${h} shows two sides`)
    /* Two sides or one, exactly as today. */
    for (const [name, w, h, insets] of ONE_OR_TWO) assert.equal(three(w, h, insets), false, name)
    for (const [w, h] of PHONES) {
      assert.equal(three(w, h), false, `a ${w}-point phone held upright`)
      assert.equal(three(h, w, { left: 59, right: 59 }), false, `a ${w}-point phone on its side`)
      assert.equal(three(h, w), false, `a ${w}-point phone on its side, nothing kept down its sides`)
    }
    /* The numbers the report quotes. */
    assert.deepEqual(frameOf(1366, 1024), { width: 1366, height: 916, left: 0, right: 0 })
    assert.deepEqual(r.threeWidths(frameOf(1366, 1024)), { tool: 455, third: 455, play: 456 })
    assert.deepEqual(frameOf(1210, 834), { width: 1210, height: 726, left: 0, right: 0 })
    assert.deepEqual(frameOf(951, 669, { right: 84 }), { width: 867, height: 561, left: 0, right: 84 })
    assert.deepEqual(frameOf(956, 440, { left: 62, right: 62 }), { width: 832, height: 332, left: 62, right: 62 })
    /* Never on a fold, however wide: the line between two sides is the crease, and a third would put an edge off it. */
    assert.equal(r.threeSidesOn({ width: 1500, height: 900, left: 0, right: 84 }, false, 500), false, 'a strip down one side')
    assert.equal(r.threeSidesOn({ width: 1500, height: 900, left: 84, right: 0 }, true, 500), false, 'and never by memory either')
    assert.equal(r.threeSidesOn({ width: 1500, height: 900, left: 20, right: 20 }, false, 500), true, 'the same down both sides is no fold')
    /* Wide enough but taller than wide, or too short: no. */
    assert.equal(r.threeSidesOn({ width: 1300, height: 1400 }, false, 500), false)
    assert.equal(r.threeSidesOn({ width: 1300, height: 480 }, false, 500), false)
    /* Nothing measured yet: never a guess. */
    assert.equal(r.threeSidesOn(), false)
    assert.equal(r.threeSidesOn({}), false)
    assert.equal(r.threeSidesOn({ width: 0, height: 0 }, true), false)
  })

  test('three across: each line goes off 40 under where it came on, and an 11-inch iPad is under even that', async () => {
    const r = await rules()
    const on = (width, was, height = 900) => r.threeSidesOn({ width, height }, was, 500)
    assert.equal(on(1289, false), false)
    assert.equal(on(1290, false), true)
    assert.equal(on(1289, true), true, 'on already: it stays')
    assert.equal(on(1250, true), true)
    assert.equal(on(1249, true), false)
    assert.equal(on(1250, false), false, 'and does not come on there')
    /* The height's line and the wider-than-tall line, the same way. */
    assert.equal(r.threeSidesOn({ width: 1400, height: 499 }, false, 500), false)
    assert.equal(r.threeSidesOn({ width: 1400, height: 460 }, true, 500), true)
    assert.equal(r.threeSidesOn({ width: 1400, height: 459 }, true, 500), false)
    assert.equal(r.threeSidesOn({ width: 1300, height: 1320 }, false, 500), false)
    assert.equal(r.threeSidesOn({ width: 1300, height: 1320 }, true, 500), true)
    assert.equal(r.threeSidesOn({ width: 1300, height: 1341 }, true, 500), false)
    /* The widest 11-inch iPad is 1210: under the line with the memory on, so it can never be left showing three. */
    for (const w of [1180, 1194, 1210]) {
      assert.ok(w < r.THREE_AT - r.THREE_LETS_GO, `${w} is not clear of the line`)
      assert.equal(on(w, true, 726), false, `an 11-inch iPad ${w} across`)
    }
    /* And each of three sides is never under the least a side may be. */
    assert.ok(Math.floor((r.THREE_AT - r.THREE_LETS_GO) / 3) >= r.SIDE_LEAST, 'a third of the narrowest window that shows three is under SIDE_LEAST')
  })

  test('three across: the third side holds a tool with a screen of its own, never the one the first has, the tuner or a block’s knobs', async () => {
    const r = await rules()
    assert.deepEqual(r.THIRD_TOOLS, ['edit', 'setlists', 'presets', 'notes'])
    for (const t of r.THIRD_TOOLS) assert.ok(r.isTool(t), `${t} is not one of the two sides’ own tools`)
    assert.equal(r.isThirdTool('tuner'), false)
    assert.equal(r.isThirdTool(r.BLOCK), false)
    assert.equal(r.isThirdTool(null), false)
    const all = ['edit', 'setlists', 'presets', 'tuner', 'notes']
    assert.deepEqual(r.thirdTools({ tools: all, first: 'edit' }), ['setlists', 'presets', 'notes'])
    assert.deepEqual(r.thirdTools({ tools: all, first: 'setlists' }), ['edit', 'presets', 'notes'])
    assert.deepEqual(r.thirdTools({ tools: all, first: 'tuner' }), ['edit', 'setlists', 'presets', 'notes'])
    /* Only what the first side's own list offers now: no Edit where its door is shut, no All presets off the rig. */
    assert.deepEqual(r.thirdTools({ tools: ['setlists'], first: 'setlists' }), [])
    assert.deepEqual(r.thirdTools({ tools: ['setlists', 'tuner'], first: 'edit' }), ['setlists'])
    assert.deepEqual(r.thirdTools(), [])
    assert.deepEqual(r.thirdTools({ tools: null, first: 'edit' }), [])

    /* Drawn: room for three, a first tool beside Play, and a third that is not the first's. */
    const up = { three: true, beside: true, first: 'edit', third: 'setlists' }
    assert.equal(r.thirdShown(up), true)
    assert.equal(r.thirdShown({ ...up, three: false }), false, 'a window with room for two')
    assert.equal(r.thirdShown({ ...up, beside: false }), false, 'the first tool filling the window, or Play alone')
    assert.equal(r.thirdShown({ ...up, first: null }), false)
    assert.equal(r.thirdShown({ ...up, third: null }), false)
    assert.equal(r.thirdShown({ ...up, third: 'edit' }), false, 'a tool is never open twice')
    assert.equal(r.thirdShown({ ...up, third: 'tuner' }), false)
    assert.equal(r.thirdShown({ ...up, third: r.BLOCK }), false)
    assert.equal(r.thirdShown(), false)
    /* The tuner and a held block's knobs borrow the FIRST side: the third stays where it is meanwhile. */
    assert.equal(r.thirdShown({ ...up, first: 'tuner' }), true)
    assert.equal(r.thirdShown({ ...up, first: r.BLOCK }), true)

    /* Add a side: room for three, a first tool of its own beside Play, no third yet, and something to offer. */
    const ask = { three: true, beside: true, first: 'edit', third: null, tools: ['setlists', 'presets'] }
    assert.equal(r.thirdOffered(ask), true)
    assert.equal(r.thirdOffered({ ...ask, three: false }), false, 'an 11-inch iPad has no Add a side')
    assert.equal(r.thirdOffered({ ...ask, beside: false }), false)
    assert.equal(r.thirdOffered({ ...ask, first: null }), false, 'Play alone: the first tool comes first')
    assert.equal(r.thirdOffered({ ...ask, first: 'tuner' }), false, 'the tuner is only borrowing that side')
    assert.equal(r.thirdOffered({ ...ask, first: r.BLOCK }), false, 'and so are a block’s knobs')
    assert.equal(r.thirdOffered({ ...ask, third: 'setlists' }), false, 'one is open already')
    assert.equal(r.thirdOffered({ ...ask, tools: [] }), false, 'nothing to put in it')
    assert.equal(r.thirdOffered({ ...ask, first: 'setlists', tools: ['setlists'] }), false, 'only the first side’s own tool is on offer')
    assert.equal(r.thirdOffered(), false)
    /* The words: never the device in hand, never what has or has not been tried. */
    for (const w of Object.values(r.THIRD_WORDS)) {
      assert.equal(typeof w, 'string')
      assert.doesNotMatch(w, /this phone|beta|tried|official/i)
    }
    assert.equal(r.THIRD_WORDS.add, 'Add a side')
    assert.equal(r.THIRD_WORDS.close, 'Close this side')
  })

  test('three across: the third side follows the first as it changes: they change places, it takes a closed side’s place, it is kept through a narrow window and forgotten after Settings', async () => {
    const r = await rules()
    /* App's own loop: ask while drawing with what was seen last, keep the answer, and say whether the third was on screen. */
    const app = ({ three = true } = {}) => {
      const s = { third: null, screen: 'stage', wide: true, three, seen: null, shown: false }
      const first = () => (['edit', 'setlists', 'presets', 'tuner', 'notes', r.BLOCK].includes(s.screen) ? s.screen : null)
      const draw = () => {
        /* A step can ask for a screen (the third taking the first's place): App sets it and draws again. */
        for (let i = 0; i < 4; i++) {
          const now = r.thirdStep({ third: s.third, first: first(), screen: s.screen, wide: s.wide, shown: s.shown, seen: s.seen })
          s.seen = now.seen
          const again = now.third !== s.third || (now.screen && now.screen !== s.screen)
          s.third = now.third
          if (now.screen) s.screen = now.screen
          if (!again) break
        }
        s.shown = r.thirdShown({ three: s.three && s.wide, beside: s.wide && first() !== null, first: first(), third: s.third })
        return s
      }
      return {
        s,
        draw,
        go: (screen) => {
          s.screen = screen
          return draw()
        },
        pick: (third) => {
          s.third = third
          return draw()
        },
        size: ({ wide = s.wide, three: room = s.three } = {}) => {
          s.wide = wide
          s.three = room
          return draw()
        }
      }
    }
    const sides = (a) => [a.s.screen, a.s.third, a.s.shown]

    /* Edit beside Play, then Setlists added as a third. */
    let a = app()
    a.draw()
    a.go('edit')
    a.pick('setlists')
    assert.deepEqual(sides(a), ['edit', 'setlists', true])
    /* Setlists picked for the first side (its list, or Play's own Setlists button): the two change places, and neither is open twice. */
    a.go('setlists')
    assert.deepEqual(sides(a), ['setlists', 'edit', true])
    a.go('edit')
    assert.deepEqual(sides(a), ['edit', 'setlists', true])
    /* A tool neither side has: the first changes, the third stays. */
    a.go('presets')
    assert.deepEqual(sides(a), ['presets', 'setlists', true])
    /* The tuner borrows the first side and gives it back: the third never moves. */
    a.go('tuner')
    assert.deepEqual(sides(a), ['tuner', 'setlists', true])
    a.go('presets')
    assert.deepEqual(sides(a), ['presets', 'setlists', true])
    /* And a held block's knobs, the same. */
    a.go(r.BLOCK)
    assert.deepEqual(sides(a), [r.BLOCK, 'setlists', true])
    a.go('presets')
    assert.deepEqual(sides(a), ['presets', 'setlists', true])
    /* The first side's Done: the third takes its place, Play and one tool, and no third is left. */
    a.go('stage')
    assert.deepEqual(sides(a), ['setlists', null, false])
    /* The third's own Done: just the third. */
    a.pick('edit')
    assert.deepEqual(sides(a), ['setlists', 'edit', true])
    a.pick(null)
    assert.deepEqual(sides(a), ['setlists', null, false])

    /* The tuner borrowing the first side, and the third's tool picked for that side: the tuner is no tool for the third, so it closes. */
    a = app()
    a.go('edit')
    a.pick('setlists')
    a.go('tuner')
    a.go('setlists')
    assert.deepEqual(sides(a), ['setlists', null, false])

    /* THE WINDOW NARROWS TO TWO: the third is not drawn, and comes back with the room. */
    a = app()
    a.go('edit')
    a.pick('setlists')
    a.size({ three: false })
    assert.deepEqual(sides(a), ['edit', 'setlists', false])
    a.size({ three: true })
    assert.deepEqual(sides(a), ['edit', 'setlists', true])
    /* Closed while there was only room for two: Play alone, and nothing pops in from a side nobody could see. */
    a.size({ three: false })
    a.go('stage')
    assert.deepEqual(sides(a), ['stage', null, false])

    /* THE WINDOW NARROWS TO ONE SCREEN: Play shows (App's own shrink), and the third is kept to come back with the first. */
    a = app()
    a.go('edit')
    a.pick('setlists')
    a.size({ wide: false })
    a.go('stage')
    assert.deepEqual(sides(a), ['stage', 'setlists', false], 'kept')
    /* Still kept through a song or two on Play, and through Settings on the narrow window. */
    a.draw()
    a.go('settings')
    a.go('stage')
    assert.deepEqual(sides(a), ['stage', 'setlists', false])
    /* Wide again: one draw with Play alone, then App brings the first tool back, and the third is with it. */
    a.size({ wide: true })
    assert.deepEqual(sides(a), ['stage', 'setlists', false])
    a.go('edit')
    assert.deepEqual(sides(a), ['edit', 'setlists', true])

    /* Wide again while Settings is open: the first tool is left for Two sides (App), and the third is forgotten with it. */
    a = app()
    a.go('edit')
    a.pick('setlists')
    a.size({ wide: false })
    a.go('stage')
    a.go('settings')
    a.size({ wide: true })
    assert.deepEqual(sides(a), ['settings', null, false])
    a.go('stage')
    a.go('edit')
    assert.deepEqual(sides(a), ['edit', null, false])

    /* Narrow, and the kept tool itself opened as the one screen: it is the first now, and there is no third. */
    a = app()
    a.go('edit')
    a.pick('setlists')
    a.size({ wide: false })
    a.go('stage')
    a.go('setlists')
    assert.deepEqual(sides(a), ['setlists', null, false])

    /* Play left for Settings with three up: nothing comes back by itself afterwards. */
    a = app()
    a.go('edit')
    a.pick('setlists')
    a.go('settings')
    assert.deepEqual(sides(a), ['settings', null, false])
    a.go('stage')
    assert.deepEqual(sides(a), ['stage', null, false])

    /* The first tool filling the window hides the third and keeps it; Done from there is Play alone. */
    a = app()
    a.go('edit')
    a.pick('setlists')
    a.s.shown = false
    a.draw()
    assert.equal(a.s.third, 'setlists', 'kept while the first fills the window')
    a.s.shown = false
    a.go('stage')
    assert.deepEqual([a.s.screen, a.s.third], ['stage', null])

    /* Never a third that is not one of its tools, whatever it is handed. */
    for (const bad of ['tuner', r.BLOCK, 'settings', '', undefined]) assert.equal(r.thirdStep({ third: bad, first: 'edit', screen: 'edit', wide: true }).third, null)
    assert.deepEqual(r.thirdStep(), { third: null, screen: null, seen: { first: null, prev: null, held: false } })
  })

  test('three across: three even columns with Play at the end it has, and the top bar gives up Full screen first and Play’s name second', async () => {
    const r = await rules()
    assert.deepEqual(r.threeWidths({ width: 1366 }), { tool: 455, third: 455, play: 456 })
    assert.deepEqual(r.threeWidths({ width: 1250 }), { tool: 416, third: 416, play: 418 })
    assert.deepEqual(r.threeWidths({}), { tool: 0, third: 0, play: 0 })
    for (const width of [1250, 1290, 1366, 1376, 1848]) {
      const w = r.threeWidths({ width })
      assert.equal(w.tool + w.third + w.play, width, 'the three fill the window')
      assert.equal(w.tool, w.third)
      assert.ok(w.play - w.tool >= 0 && w.play - w.tool <= 2, 'only the odd points go to Play')
      assert.ok(w.tool >= r.SIDE_LEAST)
    }
    assert.deepEqual(r.threeOrder(true), ['tool', 'third', 'play'])
    assert.deepEqual(r.threeOrder(false), ['play', 'third', 'tool'])
    assert.deepEqual(r.threeOrder(), ['tool', 'third', 'play'], 'Play on the right, as with two')

    /* The bar: 8 points a letter, 24 round a button, 8 between two. */
    const says = { first: 'Setlists ▾', third: 'All presets ▾', play: 'Play ▾', full: 'Full', swap: 'Swap' }
    const need = (labels) => labels.reduce((n, l) => n + l.length * 8 + 24, 0) + (labels.length - 1) * 8
    const all = need([says.first, says.full, says.third, says.play, says.swap])
    const noFull = need([says.first, says.third, says.play, says.swap])
    assert.deepEqual(r.threeLead({ ...says, room: null }), { full: true, play: true }, 'not measured yet: everything')
    assert.deepEqual(r.threeLead({ ...says, room: all }), { full: true, play: true })
    assert.deepEqual(r.threeLead({ ...says, room: all - 1 }), { full: false, play: true }, 'Full screen goes first: the side’s own Done and the handle are other ways')
    assert.deepEqual(r.threeLead({ ...says, room: noFull }), { full: false, play: true })
    assert.deepEqual(r.threeLead({ ...says, room: noFull - 1 }), { full: false, play: false }, 'then Play’s name, whose list is the first side’s list')
    assert.deepEqual(r.threeLead({ ...says, room: 0 }), { full: false, play: false })
    /* A block's knobs have no Full screen to give up. */
    assert.deepEqual(r.threeLead({ ...says, full: null, room: 5000 }), { full: false, play: true })
    /* On a 13-inch iPad the bar's row has room for everything in the longest words there are (about 700 points are left beside the version, the pill and Settings). */
    const longest = { first: 'All presets ▾', third: 'Setlists ▾', play: 'Play ▾', full: 'Full', swap: 'Swap' }
    assert.deepEqual(r.threeLead({ ...longest, room: 600, letter: 0.62 * 13, pad: 24, gap: 8 }), { full: true, play: true })
  })

  test('three across: his account only, and closed to an account nothing is drawn, offered or kept', () => {
    const features = code(read('mobile/src/lib/features.js'))
    assert.match(features, /export const THREE_SIDES_FOR_EVERYONE = true\n/, 'three across is closed to customers again')
    const app = flat(read('mobile/App.js'))
    assert.match(app, /import \{ THREE_SIDES_FOR_EVERYONE \} from '\.\/src\/lib\/features'/)
    /* His account, or everyone the two sides are open to once the switch says so; and only where the two sides' own rule said yes on the measured frame. */
    assert.match(app, /const threeAllowed = sidesAdmin \|\| \(sidesAllowed && THREE_SIDES_FOR_EVERYONE\) /)
    assert.match(app, /const three = threeAllowed && big && threeSidesOn\(frame \|\| \{\}, threeWas\.current, SIDES_TALL\) threeWas\.current = three /)
    /* An account it is closed to never keeps a third: whatever the state holds, the step is asked with none. */
    assert.match(app, /const thirdNow = thirdStep\(\{ third: threeAllowed \? third : null, first: sideTool, screen, wide, shown: thirdWasUp\.current, seen: thirdSeen\.current \}\) thirdSeen\.current = thirdNow\.seen if \(thirdNow\.third !== third\) setThird\(thirdNow\.third\) if \(thirdNow\.screen && thirdNow\.screen !== screen\) setScreen\(thirdNow\.screen\) /)
    assert.match(app, /const thirdUp = thirdShown\(\{ three, beside: playBeside, first: sideTool, third \}\) thirdWasUp\.current = thirdUp /)
    /* Everything the bar and the frame are handed is null or false unless `three` or `thirdUp` says otherwise. */
    assert.match(app, /const thirdCanOpen = thirdOffered\(\{ three, beside: playBeside, first: sideTool, third, tools: thirdToolsOffered \}\)/)
    assert.match(app, /three=\{thirdUp \? third : null\} onAdd=\{thirdCanOpen \? openThirdList : null\} onThird=\{openThirdList\} \/>/)
    assert.match(app, /three=\{three\} third=\{thirdUp \? third : null\} thirdTools=\{thirdToolsOffered\} thirdList=\{thirdList\} onThirdList=\{setThirdList\} onPickThird=\{setThird\} onCloseThird=\{closeThird\} thirdSide=\{ !thirdUp \? null : /)
    /* The first side's own close is untouched: it knows nothing of the third. */
    assert.match(app, /const closeSide = \(\) => setScreen\('stage'\) /)
    assert.match(app, /const closeThird = \(\) => setThird\(null\) /)

    /* Sides: with no third, the tree is the two sides' own; the third's list is in it only where there is room for three. */
    const sides = flat(read('mobile/src/components/Sides.js'))
    assert.match(sides, /three = false, third = null, thirdSide = null, thirdTools = \[\], thirdList = false, onThirdList = null, onPickThird = null, onCloseThird = null, onPick,/)
    assert.match(sides, /if \(!allowed\) return children /, 'an account the sides are closed to: Play and nothing round it')
    assert.match(sides, /if \(beside && third && thirdSide\) \{/)
    assert.match(sides, /\{three \? thirdSheet : null\} <\/View> \) \}/)
    /* SidesLead: the three-up row only with a third, Add a side only when handed what it does. */
    const lead = flat(read('mobile/src/components/SidesLead.js'))
    assert.match(lead, /three = null, onAdd = null, onThird = null, handle = false, share = null \}\) \{/)
    assert.match(lead, /if \(three\) \{ const thirdName = TOOL_NAMES\[three\] \|\| ''/)
    assert.match(lead, /onAdd \? <Press key="add" label=\{THIRD_WORDS\.add\} [^>]* onPress=\{onAdd\} [^>]*\/> : null/)
  })

  test('three across: Play is never drawn afresh for a third side, each side has its own Done, and the tuner and a held block go where they always went', () => {
    const sides = flat(read('mobile/src/components/Sides.js'))
    /* The same keyed Play and the same keyed first tool, as three children of the row itself: an array of them would be a new parent, and Play would be drawn afresh. */
    assert.match(sides, /play: cloneElement\(play, \{ style: \{ width: wide3\.play \} \}\)/)
    assert.match(sides, /tool: \( <View key="side" style=\{\[\{ width: wide3\.tool \}, edge\]\}> <View style=\{\{ flex: 1 \}\}>\{side\}<\/View> <\/View> \)/)
    assert.match(sides, /third: \( <View key="third" style=\{\[\{ width: wide3\.third \}, edge\]\}> <View style=\{\{ flex: 1 \}\}>\{thirdSide\}<\/View> <\/View> \)/)
    assert.match(sides, /const \[left, middle, right\] = threeOrder\(playOnRight\) return \( <View style=\{\{ flex: 1, flexDirection: 'row' \}\}> \{ \} \{column\[left\]\} \{column\[middle\]\} \{column\[right\]\} <Sheet open=\{list !== null\}/)
    assert.match(sides, /const play = \( <View key="play" /)
    /* No handle with three up (two lines to drag is a later pass): the three-up branch returns before the handle is reached, and Swap is the top bar's. */
    const threeUp = sides.slice(sides.indexOf('if (beside && third && thirdSide) {'), sides.indexOf("{playOnRight ? other : play}"))
    assert.ok(threeUp.length > 0)
    assert.doesNotMatch(threeUp, /SidesHandle/)
    const lead = flat(read('mobile/src/components/SidesLead.js'))
    const row = lead.slice(lead.indexOf('if (three) {'), lead.indexOf('const widths = sideWidths('))
    assert.match(row, /<Press key="swap" label=\{SIDE_WORDS\.swap\} [^>]* onPress=\{onSwap\}/, 'Swap is in the bar with three up, handle or no handle')
    assert.doesNotMatch(row, /handle/)
    /* The names in the order of the sides; what gives way is the rule's answer on the measured row. */
    assert.match(row, /const fits = threeLead\(\{ room: row, \.\.\.says, full: knobs \? null : fills, swap: SIDE_WORDS\.swap, letter: LETTER \* font\.small \* \(fontScale \|\| 1\), pad: CHIP_ROUND, gap: space\.sm \}\)/)
    assert.match(row, /\{playOnRight \? firstSide : playName\} \{thirdSide\} \{playOnRight \? playName : firstSide\}/)
    assert.match(row, /onPress=\{onThird\}/)
    /* The third's own list: its tools, the one it holds lit, and its way out. */
    assert.match(sides, /<Sheet key="third-list" open=\{thirdList === true\} onClose=\{\(\) => onThirdList\?\.\(false\)\} title=\{THIRD_WORDS\.title\} note=\{THIRD_WORDS\.note\}>/)
    assert.match(sides, /\{thirdTools\.map\(\(t\) => \( <Press key=\{t\} label=\{TOOL_NAMES\[t\]\} tone="signal" on=\{t === third\} onPress=\{\(\) => pickThird\(t\)\} \/> \)\)\}/)
    assert.match(sides, /\{third \? \( <Press label=\{THIRD_WORDS\.close\} onPress=\{\(\) => \{ onThirdList\?\.\(false\) onCloseThird\?\.\(\) \}\} \/> \) : null\}/)

    const app = flat(read('mobile/App.js'))
    /* Each third tool is the screen the first side draws, with the third's own Done. */
    assert.match(app, /thirdSide=\{ !thirdUp \? null : third === 'presets' \? \( <Presets onBack=\{closeThird\} stay \/> \) : third === 'setlists' \? \( <Setlists onBack=\{closeThird\} notes=\{notesAllowed\} \/> \) : third === 'notes' \? \( <NotesSide onBack=\{closeThird\} \/> \) : \( <Edit onBack=\{closeThird\} jump=\{editJump\} /)
    /* What it may hold is the first side's own list (the same conditions Play's buttons use), Edit only behind the bench's switch as its route is. */
    assert.match(app, /const thirdToolsOffered = thirdTools\(\{ tools: toolsOffered\.filter\(\(t\) => t !== 'edit' \|\| BENCH\), first: sideTool \}\)/)
    /* It closes when what it holds goes: Edit's door shut under it, or notes closed to the account. */
    assert.match(app, /useEffect\(\(\) => \{ if \(\(third === 'edit' && editHere\.shuts\) \|\| \(third === 'notes' && !notesAllowed\)\) setThird\(null\) \}, \[third, editHere\.shuts, notesAllowed\]\)/)
    /* Edit in the third side: a held block opens there, and its Save is the one Save on screen. */
    assert.match(app, /const thirdEdit = thirdUp && third === 'edit' /)
    assert.match(app, /if \(holdOpens === 'edit' \|\| \(holdOpens && thirdEdit\)\) return setEditJump\(/)
    assert.match(app, /saveHere=\{screen !== 'edit' && blockAt === null && !thirdEdit\}/)
    /* Android's back: a block's knobs first, then the third, then the first as it always went. */
    assert.match(app, /if \(blockAt !== null\) \{ closeBlock\(\) return true \} if \(thirdUp\) \{ setThird\(null\) return true \} if \(twoSidesUp && backUnwinds\(/)
    /* The tuner and a block's knobs still go by the first side alone: nothing in their rules is asked about the third. */
    for (const rule of ['tunerGoes', 'tunerGivesBack', 'tunerStops', 'whenNarrow', 'backUnwinds', 'holdGoes', 'panelKeeps', 'sideUnder', 'blockGivesBack']) {
      const calls = app.match(new RegExp(`${rule}\\(\\{?[^)]*\\)`, 'g')) || []
      assert.ok(calls.length > 0, `${rule} is not asked in App any more`)
      for (const call of calls) assert.doesNotMatch(call, /third/i, `${rule} is asked about the third side`)
    }
  })
}
