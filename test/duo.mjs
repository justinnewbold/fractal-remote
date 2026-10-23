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
}
