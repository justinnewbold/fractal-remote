/**
 * Play on a screen of any shape: the groundwork, with a phone held upright
 * left exactly as it was.
 *
 * The iPhone Duo folds. Closed, it is a phone screen with a strip down one
 * side where it keeps its clock and camera; open, a near-square screen nearly
 * twice as wide, and folding or opening it while a song plays resizes the app
 * in place. iPads beside another app, and Android tablets and Galaxy Folds
 * that set the upright lock aside, already do the same today. Before any of
 * that can show a bigger Play, five things about the app had to stop assuming
 * a phone held upright:
 *
 *   - the app's frame kept clear of the top and the bottom only;
 *   - every pop-up turned only upright on an iPhone, whatever the screen did;
 *   - a sheet's foot was a fixed 32 points, whatever the phone's bottom edge;
 *   - Play's fit kept its overflow correction when only the width changed,
 *     and the room it keeps for the pedals while a preset loads too;
 *   - the tempo box, the channel picker, the Looper and the tuner lived inside
 *     Play's scrolling page, so anything that drew the page again in another
 *     shape could take one away, and a tempo typed half-way with it.
 *
 * Each case here is also a case of nothing changing on a phone held upright:
 * it has nothing down its sides, it cannot turn while the app is locked
 * upright, its width is measured once and never changes again, and a pop-up
 * that is a modal moves nothing wherever it sits.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from '@babel/parser'
import babelTraverse from '@babel/traverse'

const traverse = babelTraverse.default || babelTraverse

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* Comments out, so a check reads the code and not its explanation. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const jsx = (src) => parse(src, { sourceType: 'module', plugins: ['jsx'] })

/** Every .js the phone app is made of: App.js and everything under src. */
function phoneFiles() {
  const out = [fileURLToPath(new URL('../mobile/App.js', import.meta.url))]
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const at = join(dir, name)
      if (statSync(at).isDirectory()) walk(at)
      else if (/\.js$/.test(name)) out.push(at)
    }
  }
  walk(fileURLToPath(new URL('../mobile/src/', import.meta.url)))
  return out
}

/** lib/screenShape, run: a copy as .mjs, since the phone's .js is not a module to node. */
async function screenShape() {
  const dir = mkdtempSync(join(tmpdir(), 'screen-shape-'))
  try {
    const file = join(dir, 'screenShape.mjs')
    writeFileSync(file, read('mobile/src/lib/screenShape.js'))
    return await import(pathToFileURL(file).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Every element called `tag` in the phone app, each with the file it is in,
 * the expression its `prop` is given ({ name } for a plain identifier), and
 * whether that name is imported from lib/screenShape in that file.
 */
function everyUse(tag, prop) {
  const found = []
  for (const file of phoneFiles()) {
    const src = readFileSync(file, 'utf8')
    if (!src.includes(`<${tag}`)) continue
    const ast = jsx(src)
    const fromShape = new Set()
    for (const node of ast.program.body) {
      if (node.type === 'ImportDeclaration' && /lib\/screenShape$/.test(node.source.value)) {
        for (const s of node.specifiers) fromShape.add(s.local.name)
      }
    }
    traverse(ast, {
      JSXOpeningElement(path) {
        if (path.node.name.type !== 'JSXIdentifier' || path.node.name.name !== tag) return
        const attr = path.node.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === prop)
        const value = attr?.value?.type === 'JSXExpressionContainer' ? attr.value.expression : null
        const name = value?.type === 'Identifier' ? value.name : null
        found.push({ file: file.replace(/^.*\/mobile\//, 'mobile/'), line: path.node.loc.start.line, name, imported: !!name && fromShape.has(name) })
      }
    })
  }
  return found
}

/**
 * A run of Stage.js's own lines, as a function of the names it reads, with
 * React's useRef stood in for: the same ref object on every "render", by the
 * order the refs are asked for, as React keeps them.
 */
function stageLines(from, to, names) {
  const stage = read('mobile/src/screens/Stage.js')
  const start = stage.indexOf(from)
  assert.ok(start > 0, `Stage.js no longer has ${from.trim()}; this check reads it`)
  const end = stage.indexOf(to, start)
  assert.ok(end > start, `Stage.js no longer has ${to.trim()} after ${from.trim()}; this check reads it`)
  const body = stage.slice(start, end + to.length)
  const refs = []
  return (values, result) => {
    let at = 0
    const useRef = (initial) => {
      if (!refs[at]) refs[at] = { current: initial }
      return refs[at++]
    }
    // eslint-disable-next-line no-new-func
    return new Function('useRef', ...names, `${body}\nreturn ${result}`)(useRef, ...names.map((n) => values[n]))
  }
}

export function run(test) {
  test('the app’s frame and Add songs keep clear of the phone’s own on every side, not only the top and the bottom', async () => {
    /*
     * The iPhone Duo keeps its clock and camera in a strip down one side, and
     * a tablet on its side has its camera there. With the top and the bottom
     * only, the top bar's light and unit name went under them. A phone held
     * upright has nothing down its sides, so its insets there are 0 and
     * nothing on it moves.
     */
    const { SAFE_EDGES } = await screenShape()
    assert.deepEqual([...SAFE_EDGES].sort(), ['bottom', 'left', 'right', 'top'])
    const frames = everyUse('SafeAreaView', 'edges')
    assert.deepEqual(frames.map((f) => f.file).sort(), ['mobile/App.js', 'mobile/src/components/SongPicker.js'], 'a frame was added or lost; each one keeps clear of every side')
    for (const f of frames) {
      assert.equal(f.name, 'SAFE_EDGES', `${f.file}:${f.line} keeps clear of some sides only`)
      assert.ok(f.imported, `${f.file}:${f.line} has its own SAFE_EDGES, not lib/screenShape's`)
    }
  })

  test('every pop-up may turn every way up, so none is held upright on a screen turned on its side', async () => {
    /*
     * An iPhone pop-up (a React Native Modal) turns only upright unless it is
     * told otherwise (RCTModalHostViewComponentView: portrait on an iPhone, all
     * four on an iPad). On a screen that is sideways, the Duo open or a Fold,
     * a sheet came up turned against the app under it. A pop-up turns only the
     * ways the app may (app.json's "portrait" on an iPhone), so an iPhone held
     * upright sees no change, and an iPad gets by name what it already had.
     */
    const { ANY_WAY_UP } = await screenShape()
    assert.deepEqual([...ANY_WAY_UP].sort(), ['landscape-left', 'landscape-right', 'portrait', 'portrait-upside-down'])
    const popups = everyUse('Modal', 'supportedOrientations')
    assert.deepEqual(
      popups.map((p) => p.file).sort(),
      [
        'mobile/src/components/PasswordBox.js',
        'mobile/src/components/Sheet.js',
        'mobile/src/components/SongPicker.js',
        'mobile/src/components/TempoBox.js',
        'mobile/src/components/Tuner.js',
        'mobile/src/components/Volume.js'
      ],
      'a pop-up was added or lost; each one turns every way up'
    )
    for (const p of popups) {
      assert.equal(p.name, 'ANY_WAY_UP', `${p.file}:${p.line} turns only upright on an iPhone`)
      assert.ok(p.imported, `${p.file}:${p.line} has its own ANY_WAY_UP, not lib/screenShape's`)
    }
    /* The app itself is still locked upright on an iPhone: this is the pop-ups following it, not the lock lifted. */
    assert.equal(JSON.parse(read('mobile/app.json')).expo.orientation, 'portrait')
  })

  test('a sheet’s foot clears the phone’s own bottom edge, and is never shorter than the 32 it always had', () => {
    /*
     * It was a fixed 32 points, whatever the bottom edge. Android draws a
     * sheet behind its three buttons (48), and a screen turned or opened has
     * a bottom edge of its own. So the phone's measure, with today's 32 as the
     * floor: a phone that had 32 has it still, and only a bottom edge taller
     * than that adds to it.
     */
    const sheet = code(read('mobile/src/components/Sheet.js'))
    assert.match(sheet, /const \{ top, bottom \} = useSafeAreaInsets\(\)/, 'the sheet does not ask the phone where its bottom edge is')
    assert.match(sheet, /const FOOT_AT_LEAST = space\.xxl\b/, 'the floor is not the 32 every sheet had')
    assert.match(sheet, /paddingBottom: Math\.max\(bottom, FOOT_AT_LEAST\)/, 'the foot is not the bottom edge with the floor under it')
    assert.doesNotMatch(sheet, /paddingBottom: space\.xxl/, 'the fixed 32 is still there')
    assert.match(read('mobile/src/lib/theme.js'), /export const space = \{[^}]*\bxxl: 32\b/, 'the floor moved: it has to be the 32 the sheets had')
    /* What it comes to, by the phone's own bottom edge: today's 32 everywhere up to 32. */
    const foot = (bottom) => Math.max(bottom, 32)
    assert.deepEqual([0, 20, 21, 24, 32, 34, 48].map(foot), [32, 32, 32, 32, 32, 34, 48])
  })

  test('Play’s width is measured on Play, in the same moment as its height, and never read from the window', () => {
    const stage = code(read('mobile/src/screens/Stage.js'))
    assert.match(
      stage,
      /onLayout=\{\(e\) => \{\s*setViewport\(e\.nativeEvent\.layout\.height\)\s*setPlayWidth\(Math\.round\(e\.nativeEvent\.layout\.width\)\)\s*\}\}/,
      'Play’s width is not measured with its height, so the two can change in different moments'
    )
    assert.equal(stage.match(/setPlayWidth\(/g).length, 1, 'Play’s width is set from something other than its own measurement')
    assert.match(stage, /const \[playWidth, setPlayWidth\] = useState\(0\)/)
    /* The window is read once, for the first frame's tile width only, as it always was. */
    assert.equal(stage.match(/useWindowDimensions\(\)/g).length, 1)
    assert.equal(stage.match(/\bscreen\b/g).length, 2, 'the window’s width is used for more than the first frame')
    assert.match(stage, /const row = grid \|\| Math\.max\(0, screen - space\.lg \* 2\)/)
    assert.doesNotMatch(stage, /Platform\.isPad|isTablet|orientation/, 'Play decides something by the kind of device or which way up it is')
  })

  test('Play’s fit throws its correction away when Play only changes width, and keeps it while nothing changes', () => {
    /*
     * The trim is an overflow measured at one size, and it only ever grows.
     * Its key held the height and not the width, so an iPad's divider dragged
     * wider, or a Duo opened sideways, kept the narrow screen's correction:
     * every tile smaller than it had room for until the next preset.
     */
    const fit = stageLines(
      '  const fitKey = `',
      '    if (trim !== 0) setTrim(0)\n  }\n',
      ['viewport', 'playWidth', 'scenes', 'fitBlocks', 'fitOn', 'sceneCols', 'chainNow', 'trim', 'setTrim']
    )
    const resets = []
    const at = (viewport, playWidth, trim) =>
      fit(
        {
          viewport,
          playWidth,
          scenes: { hasScenes: true, count: 8 },
          fitBlocks: 9,
          fitOn: true,
          sceneCols: 2,
          chainNow: { late: false },
          trim,
          setTrim: (n) => resets.push(n)
        },
        'fitKey'
      )
    /* A phone held upright: measured once, then the correction is kept, render after render. */
    at(0, 0, 0)
    at(707, 393, 0)
    for (let i = 0; i < 50; i += 1) at(707, 393, 18)
    assert.deepEqual(resets, [], 'a phone held upright lost its fit correction with nothing changed')
    /* Only wider: thrown away. */
    at(707, 820, 18)
    assert.deepEqual(resets, [0], 'a screen that only got wider kept the narrow screen’s correction')
    /* And kept again at the new width, until the next change. */
    at(707, 820, 6)
    at(707, 820, 6)
    assert.deepEqual(resets, [0])
    /* Only narrower, then only taller, as before. */
    at(707, 466, 6)
    at(951, 466, 6)
    assert.deepEqual(resets, [0, 0, 0])
    /* The key tells widths apart and nothing else changed in it. */
    assert.notEqual(at(707, 393, 0), at(707, 394, 0))
  })

  test('the room kept for the pedals while a preset loads is forgotten when Play changes width, and kept while it does not', () => {
    /*
     * While the next preset loads, grey cards stand where its pedals will be,
     * in the last chain's height, so nothing under them jumps. That height was
     * measured at one width: an iPad's divider dragged, or a Duo folded, while
     * a preset loaded drew the cards at the old screen's height and the fit
     * counted it until the chain landed.
     */
    const held = stageLines(
      '  const heldGrid = useRef(',
      '  const held = chainNow.elsewhere && heldGrid.current.height > 0 ? heldGrid.current : null\n',
      ['playWidth', 'chainNow', 'tiles', 'blockGrid']
    )
    const here = { elsewhere: false }
    const loading = { elsewhere: true }
    /* Mounted, then measured: nothing kept yet, nothing to forget. */
    assert.equal(held({ playWidth: 0, chainNow: here, tiles: 9, blockGrid: 0 }, 'held'), null)
    assert.equal(held({ playWidth: 393, chainNow: here, tiles: 9, blockGrid: 212 }, 'held'), null)
    /* A phone held upright: Next pressed, and the room is kept exactly, as it always was. */
    assert.deepEqual(held({ playWidth: 393, chainNow: loading, tiles: 0, blockGrid: 212 }, 'held'), { count: 9, height: 212 })
    assert.deepEqual(held({ playWidth: 393, chainNow: loading, tiles: 0, blockGrid: 212 }, 'held'), { count: 9, height: 212 })
    /* Folded or dragged while it loads: the old screen's room is forgotten. */
    assert.equal(held({ playWidth: 669, chainNow: loading, tiles: 0, blockGrid: 212 }, 'held'), null, 'the grey cards kept the old screen’s height')
    assert.equal(held({ playWidth: 669, chainNow: loading, tiles: 0, blockGrid: 180 }, 'held'), null)
    /* The chain lands at the new width, and its room is kept from then on. */
    assert.equal(held({ playWidth: 669, chainNow: here, tiles: 7, blockGrid: 140 }, 'held'), null)
    assert.deepEqual(held({ playWidth: 669, chainNow: loading, tiles: 0, blockGrid: 140 }, 'held'), { count: 7, height: 140 })

    /* Changed width while the chain is up: measured again at once, from the grid as it now stands. */
    const again = stageLines(
      '  const heldGrid = useRef(',
      '  const held = chainNow.elsewhere && heldGrid.current.height > 0 ? heldGrid.current : null\n',
      ['playWidth', 'chainNow', 'tiles', 'blockGrid']
    )
    again({ playWidth: 393, chainNow: here, tiles: 9, blockGrid: 212 }, 'held')
    again({ playWidth: 820, chainNow: here, tiles: 9, blockGrid: 140 }, 'held')
    assert.deepEqual(again({ playWidth: 820, chainNow: loading, tiles: 0, blockGrid: 140 }, 'held'), { count: 9, height: 140 })
  })

  test('the tempo box, the channel picker, the Looper, the tuner and the watch tip sit on Play’s own frame, outside its scrolling page', () => {
    /*
     * Each is a modal, so where it sits moves nothing on the screen. What it
     * sits IN decides what can take it away: inside the scrolling page,
     * anything that draws the page again in another shape (the Duo opened or
     * folded, an iPad's divider dragged, a wider layout) could take an open
     * picker with it, and a tempo typed half-way into the box. Play's frame is
     * the one part every shape keeps.
     */
    const ast = jsx(read('mobile/src/screens/Stage.js'))
    let frame = null
    traverse(ast, {
      ExportDefaultDeclaration(path) {
        path.traverse({
          ReturnStatement(ret) {
            if (ret.getFunctionParent()?.node !== path.node.declaration) return
            const root = ret.node.argument
            if (root?.type !== 'JSXElement') return
            if (root.children.some((c) => c.type === 'JSXElement' && c.openingElement.name.name === 'ScrollView')) frame = root
          }
        })
      }
    })
    assert.ok(frame, 'Play’s own frame, with its scrolling page in it, was not found; this check reads it')
    assert.equal(frame.openingElement.name.name, 'View')
    /* Its own children, drawn as they are and not behind a condition: each
       opens and closes by its own `open`, so it is there in every shape. */
    const kids = frame.children.filter((c) => c.type === 'JSXElement')
    const named = (el) => el.openingElement.name.name
    const title = (el) => el.openingElement.attributes.find((a) => a.name?.name === 'title')?.value?.value
    for (const want of ['TempoBox', 'ChannelSheet', 'Tuner']) {
      assert.ok(kids.some((k) => named(k) === want), `${want} is not on Play’s own frame`)
    }
    assert.ok(kids.some((k) => named(k) === 'Sheet' && title(k) === 'Looper'), 'the Looper’s sheet is not on Play’s own frame')
    /* And the Apple Watch's one-time tip, the one other sheet Play has. */
    assert.ok(kids.some((k) => named(k) === 'Sheet' && title(k) === 'Your Apple Watch'), 'the Apple Watch tip is not on Play’s own frame')
    /* And nothing that comes up over the screen is left inside the page. */
    const page = kids.find((k) => named(k) === 'ScrollView')
    const inside = []
    const look = (node) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(look)
      if (node.type === 'JSXOpeningElement' && node.name.type === 'JSXIdentifier') inside.push(node.name.name)
      for (const [key, value] of Object.entries(node)) if (key !== 'loc' && key !== 'leadingComments' && key !== 'trailingComments') look(value)
    }
    look(page)
    const overlays = ['TempoBox', 'ChannelSheet', 'Tuner', 'Sheet', 'Modal', 'Volume', 'PasswordBox']
    assert.ok(inside.length > 20, 'the scrolling page was not read; this check reads it')
    assert.deepEqual(inside.filter((n) => overlays.includes(n)), [], 'something that comes up over the screen is still inside the scrolling page')
  })


  /* ------------------------------------------------------------------ */
  /* The opened-up Play                                                  */
  /* ------------------------------------------------------------------ */

  test('under 621 points of row Play is today’s Play exactly, at every size, every scene layout and every width', async () => {
    /*
     * Every phone, the Duo closed, and half of the Duo open beside another
     * app. The shape there is the size step's own counts, the scene layout's
     * own columns, Fit's own four and 96, three letters, and the buttons at
     * the end of the page: what the phone drew before any of this.
     */
    const g = await import('../mobile/src/lib/gigSize.js')
    const today = (step, layout) => ({
      wide: false,
      spread: false,
      sceneCols: g.sceneColsFor(g.SIZES[step], layout),
      fxCols: g.SIZES[step].fx,
      fxMost: g.FX_MAX,
      tileMax: 96,
      names: false,
      footFixed: false,
      footRow: false,
      foldPad: false
    })
    const bare = ({ lines, ...rest }) => rest
    for (let step = 0; step < g.SIZES.length; step += 1) {
      for (const layout of ['across', 'down', 'four', 'mine']) {
        let was = null
        for (let row = 0; row < g.OPENS_AT; row += 1) {
          const fresh = g.playShape(row, step, layout, null)
          assert.deepEqual(bare(fresh), today(step, layout), `${g.SIZES[step].name}, ${layout}, ${row}: not today’s Play`)
          /* And the same with the memory of the row before it, as a phone that only ever measured under the line has. */
          was = g.playShape(row, step, layout, was)
          assert.deepEqual(bare(was), today(step, layout), `${g.SIZES[step].name}, ${layout}, ${row} after ${row - 1}: not today’s Play`)
        }
      }
    }
    /* The phone's own widths, as Play measures them (its width less its 16 a side). */
    for (const width of [320, 375, 390, 393, 402, 412, 430, 440, 466, 600, 652]) {
      assert.equal(g.playShape(g.pageRow(width), 0, 'across', null).wide, false, `a ${width}-point Play opened up`)
    }
    /* Today's values handed to fitTiles change nothing: its own four and 96 are what it had. */
    for (const available of [120, 300, 340, 512, 560, 707, 900]) {
      for (const [scenes, blocks] of [[0, 0], [2, 4], [4, 8], [8, 8], [8, 9], [8, 12], [8, 16], [8, 24]]) {
        for (const width of [0, 190, 200, 343, 361, 398, 500]) {
          for (const fxCols of [1, 2, 3, 4]) {
            const args = { available, scenes, blocks, sceneCols: 2, fxCols, gap: 8, width }
            assert.deepEqual(g.fitTiles({ ...args, most: g.FX_MAX, max: 96 }), g.fitTiles(args), `fitTiles moved under 621 for ${JSON.stringify(args)}`)
          }
        }
      }
    }
  })

  test('Play opens up at 621, spreads at 700 and takes two more pedals at 936, at the widths the iPhone Duo, iPads and phones have', async () => {
    const g = await import('../mobile/src/lib/gigSize.js')
    /*
     * As rows (what the lines are measured on), at Smallest with the scenes
     * Across, the default. 637 is the Duo open and held tall (669 less 32),
     * 712 an iPad mini upright (744 less 32).
     */
    const asRow = {
      375: [false, false, 2, 4],
      393: [false, false, 2, 4],
      440: [false, false, 2, 4],
      466: [false, false, 2, 4],
      637: [true, false, 2, 4],
      669: [true, false, 2, 4],
      712: [true, true, 4, 6],
      744: [true, true, 4, 6],
      820: [true, true, 4, 6],
      880: [true, true, 4, 6],
      951: [true, true, 4, 8],
      1133: [true, true, 4, 8],
      1366: [true, true, 4, 8]
    }
    for (const [row, [wide, spread, sceneCols, fxCols]] of Object.entries(asRow)) {
      const s = g.playShape(Number(row), 0, 'across', null)
      assert.deepEqual([s.wide, s.spread, s.sceneCols, s.fxCols], [wide, spread, sceneCols, fxCols], `a ${row}-point row`)
      assert.equal(s.names, wide)
      assert.equal(s.footFixed, wide)
      assert.equal(s.tileMax, wide ? g.WIDE_TILE : 96)
      assert.equal(s.footRow, spread)
      assert.equal(s.foldPad, spread)
      assert.equal(s.fxMost, spread ? fxCols : g.FX_MAX, `a ${row}-point row: Fit may go past the count it starts from`)
    }
    /*
     * And the same numbers as Play's own width, which is what Play measures:
     * the row is the width less 16 a side, and never more than the 1180 page.
     */
    assert.equal(g.pageRow(1366), g.PAGE_MAX - 32, 'the page is wider than 1180')
    assert.equal(g.pageRow(951), 919)
    const asWidth = {
      375: [false, false, 4],
      393: [false, false, 4],
      440: [false, false, 4],
      466: [false, false, 4], // the Duo closed
      637: [false, false, 4],
      669: [true, false, 4], // the Duo open, held tall: names and the fixed buttons
      712: [true, false, 4],
      744: [true, true, 6], // an iPad mini upright
      820: [true, true, 6],
      880: [true, true, 6],
      951: [true, true, 6], // the Duo open like a book
      1133: [true, true, 8], // an iPad on its side
      1366: [true, true, 8]
    }
    for (const [width, [wide, spread, fxCols]] of Object.entries(asWidth)) {
      const s = g.playShape(g.pageRow(Number(width)), 0, 'across', null)
      assert.deepEqual([s.wide, s.spread, s.fxCols], [wide, spread, fxCols], `a ${width}-point Play`)
    }
    /* Six pedals at the narrowest spread row are each still wider than a pedal on an iPhone today (four in 361 points). */
    const { tileWidth } = await import('../mobile/src/lib/tileGrid.js')
    assert.ok(tileWidth(g.SPREADS_AT, g.WIDE_PEDALS, 8) > tileWidth(361, 4, 8), 'six pedals across are narrower than four on an iPhone')
    assert.ok(tileWidth(g.TWO_MORE_AT, g.WIDEST_PEDALS, 8) > tileWidth(361, 4, 8))
    /* And four scenes stay wider than six pedals, his "scenes wider" rule. */
    assert.ok(tileWidth(g.SPREADS_AT, g.WIDE_SCENES, 8) > tileWidth(g.SPREADS_AT, g.WIDE_PEDALS, 8))
  })

  test('only Smallest and Small, with the scenes Across or Like the unit, spread; the rest gain only the names and the fixed buttons', async () => {
    const g = await import('../mobile/src/lib/gigSize.js')
    for (const row of [712, 820, 1101]) {
      for (let step = 0; step < g.SIZES.length; step += 1) {
        for (const layout of ['across', 'four', 'down', 'mine']) {
          const s = g.playShape(row, step, layout, null)
          const spreads = step <= 1 && (layout === 'across' || layout === 'four')
          assert.equal(s.spread, spreads, `${g.SIZES[step].name}, ${layout}, ${row}`)
          assert.equal(s.wide, true)
          assert.equal(s.names, true)
          assert.equal(s.footFixed, true)
          if (!spreads) {
            /* Their own counts: Down and My own order two scene columns, each size its own pedals, and the buttons in two rows. */
            assert.equal(s.sceneCols, g.sceneColsFor(g.SIZES[step], layout), `${g.SIZES[step].name}, ${layout}: the scenes moved`)
            assert.equal(s.fxCols, g.SIZES[step].fx, `${g.SIZES[step].name}, ${layout}: the pedals moved`)
            assert.equal(s.fxMost, g.FX_MAX)
            assert.equal(s.footRow, false)
            assert.equal(s.foldPad, false)
          }
        }
      }
    }
    assert.equal(g.playShape(820, 0, 'down', null).sceneCols, 2, 'Down is no longer two columns')
    assert.equal(g.playShape(820, 1, 'mine', null).sceneCols, 2, 'My own order is no longer two columns')
    assert.equal(g.playShape(820, 1, 'four', null).sceneCols, 4)
  })

  test('each line goes off 40 points under where it came on, so a divider dragged across one never flickers', async () => {
    const g = await import('../mobile/src/lib/gigSize.js')
    const flips = (rows) => {
      const out = { wide: [], spread: [], eight: [] }
      let was = null
      let last = null
      for (const row of rows) {
        was = g.playShape(row, 0, 'across', was)
        const now = { wide: was.wide, spread: was.spread, eight: was.fxCols === g.WIDEST_PEDALS }
        if (last) for (const k of Object.keys(out)) if (now[k] !== last[k]) out[k].push([row, now[k]])
        last = now
      }
      return out
    }
    const up = Array.from({ length: 1101 }, (_, i) => 300 + i)
    const down = [...up].reverse()
    assert.deepEqual(flips(up), { wide: [[621, true]], spread: [[700, true]], eight: [[936, true]] }, 'a row widening point by point did not switch each line on once, at its number')
    assert.deepEqual(flips(down), { wide: [[580, false]], spread: [[659, false]], eight: [[895, false]] }, 'a row narrowing point by point did not switch each line off once, 40 under it')
    /* Jiggled either side of a line, a point or two at a time or up to 39, it stays as it was. */
    for (const line of [g.OPENS_AT, g.SPREADS_AT, g.TWO_MORE_AT]) {
      const wobble = [line - 100, line + 5]
      for (let i = 0; i < 40; i += 1) wobble.push(line + (i % 2 ? 3 : -(i % 39)))
      const f = flips(wobble)
      const flipped = Object.values(f).flat()
      assert.ok(flipped.length <= 2 && flipped.every(([, on]) => on), `wobbling round ${line} flipped Play back and forth: ${JSON.stringify(f)}`)
    }
    assert.equal(g.LETS_GO, 40)
    /* A change of size or scene layout keeps the memory of where the row is: back at Smallest inside the gap, it spreads again. */
    let was = g.playShape(720, 0, 'across', null)
    was = g.playShape(690, 2, 'across', was)
    assert.equal(was.spread, false)
    was = g.playShape(690, 0, 'across', was)
    assert.equal(was.spread, true, 'the line forgot the row was past it when the size changed')
  })

  test('six pedals to a row on a wide row is one named number, and four there is a one-number change', async () => {
    const src = read('src/lib/gigSize.js')
    assert.match(src, /^export const WIDE_PEDALS = 6$/m)
    assert.equal(src.match(/^export const WIDE_PEDALS = /gm).length, 1)
    /* Nothing else in the rule names a pedal count: the eight is worked out from it. */
    const rule = src.slice(src.indexOf('THE OPENED-UP PLAY'))
    assert.match(rule, /export const WIDEST_PEDALS = WIDE_PEDALS > FX_MAX \? WIDE_PEDALS \+ 2 : WIDE_PEDALS/)
    assert.doesNotMatch(rule.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' '), /fxCols: [0-9]|\? 6\b|\? 8\b|= 8\b/, 'a pedal count is written into the rule beside WIDE_PEDALS')
    /* The rule run with the one number changed to four: four everywhere, even from 936, and never past four in Fit. */
    const dir = mkdtempSync(join(tmpdir(), 'wide-pedals-'))
    try {
      const file = join(dir, 'gigSize.mjs')
      writeFileSync(file, src.replace(/^export const WIDE_PEDALS = 6$/m, 'export const WIDE_PEDALS = 4'))
      const four = await import(pathToFileURL(file).href)
      for (const row of [700, 820, 951, 1148]) {
        const s = four.playShape(row, 0, 'across', null)
        assert.deepEqual([s.spread, s.sceneCols, s.fxCols, s.fxMost], [true, 4, 4, 4], `with four, a ${row}-point row`)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('fitTiles takes more than four pedals to a row only when it is asked to, and never fewer than four as its most', async () => {
    const g = await import('../mobile/src/lib/gigSize.js')
    /* Asked for six, six: the spread layout's start and its most. */
    assert.equal(g.fitTiles({ available: 500, scenes: 8, blocks: 9, sceneCols: 4, fxCols: 6, most: 6, width: 700 }).fxCols, 6)
    assert.equal(g.fitTiles({ available: 500, scenes: 8, blocks: 9, sceneCols: 4, fxCols: 8, most: 8, width: 1100 }).fxCols, 8)
    /* Not asked, six is four, as the browser and every phone have it. */
    assert.equal(g.fitTiles({ available: 500, scenes: 8, blocks: 9, sceneCols: 4, fxCols: 6, width: 700 }).fxCols, 4)
    /* A most under four is four. */
    assert.equal(g.fitTiles({ available: 300, scenes: 8, blocks: 24, fxCols: 4, most: 2, width: 500 }).fxCols, 4)
    /* The taller ceiling from 621. */
    assert.equal(g.fitTiles({ available: 900, scenes: 2, blocks: 4, max: 120 }).tile, 120)
    assert.equal(g.fitTiles({ available: 900, scenes: 2, blocks: 4 }).tile, 96)
  })

  test('on the spread layout the side without the Duo’s strip is padded to match, so the middle of every row is the middle of the screen', async () => {
    const g = await import('../mobile/src/lib/gigSize.js')
    assert.deepEqual(g.foldInset(0, 0), { left: 0, right: 0 })
    assert.deepEqual(g.foldInset(0, 44), { left: 44, right: 0 })
    assert.deepEqual(g.foldInset(44, 0), { left: 0, right: 44 })
    assert.deepEqual(g.foldInset(20, 44), { left: 24, right: 0 })
    assert.deepEqual(g.foldInset(undefined, null), { left: 0, right: 0 })
    /*
     * Worked through for a screen W wide with the strip on either side: the
     * app keeps clear of both insets, Play's page is 16 plus the fold's
     * padding on each side, and the middle of its row is W / 2 — under the
     * page's 1180 and over it.
     */
    for (const W of [951, 1133, 1366]) {
      for (const [l, r] of [[0, 0], [0, 44], [44, 0], [20, 44], [59, 0]]) {
        const play = W - l - r
        const page = Math.min(play, g.PAGE_MAX)
        const pageLeft = l + (play - page) / 2
        const f = g.foldInset(l, r)
        const rowLeft = pageLeft + 16 + f.left
        const rowRight = pageLeft + page - 16 - f.right
        assert.equal((rowLeft + rowRight) / 2, W / 2, `a ${W}-point screen with ${l} and ${r} down its sides is not centered on its fold`)
      }
    }
  })
}
