/**
 * THE VOLUME POP-UP, RUN: a drag on the slider, from the launch that draws it
 * before the chain is read to the thumb coming off
 * (mobile/src/components/Volume.js).
 *
 * "When I tried to turn the decibels up or down, it gave me an error, which
 * is showing on the play screen right now": No output level to move yet — the
 * chain is still loading. (Justin, 16 November 2026, an Axe-Fx III through a
 * Raspberry Pi, with the pop-up showing 0.0 dB.)
 *
 * The slider's touch handler is made once, on the pop-up's first render, and
 * the top bar draws that first render when the app opens: before any chain
 * has been read. The landing it called at the end of a drag was that first
 * render's, holding no Output block for the life of the screen. So the drag
 * moved the level (the writer reads the block off a ref) and then said there
 * was nothing to move; the value the thumb came off on was never confirmed,
 * and Save was never told.
 *
 * Every other check on this file reads it as text, and the text was right
 * line by line: two guards, both refusing. What was wrong is WHICH render's
 * guard ran, and only running it over several renders shows that. So the
 * real file is bundled here with stand-ins for everything it draws with and
 * everything it sends through, and driven the way the top bar drives it.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const read = (p) => readFileSync(repo(p), 'utf8')

/*
 * Hooks kept by the order they are called in, for one pop-up: a state keeps
 * its value between renders, a ref is the same object every render, and an
 * effect runs after the render when what it depends on changed. Setting a
 * state draws nothing by itself: the bench says when the pop-up is drawn
 * again, which is what lets it leave a drag between two draws.
 *
 * AND AN EFFECT CAN RUN LATER THAN ITS DRAW. On a phone, the draw a
 * touch-move asks for leaves its after-work for later, and the next move of
 * the thumb can run first. \`draw\` runs it at once, as a press's draw does;
 * \`render\` draws and leaves it waiting, and \`flush\` runs what waits. A
 * check that only ever used \`draw\` could not see a value the after-work
 * put back over a newer one, and for one commit that was exactly the fault.
 */
const STANDINS = `
export const H = { slots: [], i: 0, effects: [], log: [], made: 0, window: { width: 390, height: 844 } }
export function useState(init) {
  const k = H.i++
  if (!(k in H.slots)) H.slots[k] = { v: typeof init === 'function' ? init() : init }
  const s = H.slots[k]
  return [s.v, (n) => { s.v = typeof n === 'function' ? n(s.v) : n }]
}
export function useRef(init) {
  const k = H.i++
  if (!(k in H.slots)) H.slots[k] = { current: init }
  return H.slots[k]
}
export function useEffect(fn, deps) {
  const k = H.i++
  const prev = H.slots[k]
  const changed = !prev || !deps || deps.some((d, j) => !Object.is(d, prev.deps[j]))
  if (changed) H.effects.push(() => { prev?.cleanup?.(); const cleanup = fn(); H.slots[k] = { deps, cleanup } })
}
export const createElement = (type, props, ...children) => ({ type, props: props || {}, children })
export const Fragment = 'Fragment'
/* react-native: the touch handler is the handlers it was made with, so the bench can call them as a thumb does. */
export const PanResponder = { create: (handlers) => { H.made++; return { panHandlers: handlers } } }
export const Platform = { select: (o) => o?.ios ?? o?.default, OS: 'ios' }
export const Modal = 'Modal', Pressable = 'Pressable', ScrollView = 'ScrollView', Text = 'Text', View = 'View', BlurView = 'BlurView'
export const useWindowDimensions = () => H.window
export const useSafeAreaInsets = () => H.insets || { top: 0, bottom: 0, left: 0, right: 0 }
/* The look: any colour, any size. */
export const color = new Proxy({}, { get: () => '#000' }), font = new Proxy({}, { get: () => 12 }), mono = {}, radius = { lg: 8 }, space = new Proxy({}, { get: () => 8 }), TAP = 44
export const paneRim = () => '#fff', ANY_WAY_UP = [], clearSides = () => ({ paddingLeft: 16, paddingRight: 16 })
export const at = () => '#000'
/* Note, Press and the metronome's switch: drawn as their names. */
export default 'Drawn'
/*
 * The unit: an Output level per block, answered as it stands when it is
 * asked, and everything sent to it written down in order. A write is
 * written down as it goes out and takes when it lands, \`unit.slow\`
 * milliseconds later (none, unless a test says the wire is slow).
 */
export const unit = { level: 0, levels: {}, holds: null, slow: 0 }
const landed = () => (unit.slow ? new Promise((done) => setTimeout(done, unit.slow)) : null)
export const idOf = (b) => b?.effectId
export const blockParams = async (eid) => { H.log.push(['read', eid]); return { named: [{ id: 0, name: 'Level', unit: 'dB', min: -80, max: 20, value: eid in unit.levels ? unit.levels[eid] : unit.level }] } }
export const setParam = async (block, id, v) => { H.log.push(['write', block, v]); await landed(); unit.level = v }
export const setParamConfirmed = async (block, id, v) => {
  H.log.push(['confirmed', block, v])
  await landed()
  if (unit.holds !== null) return { ok: false, actual: unit.holds }
  unit.level = v
  return { ok: true, actual: v }
}
export const noteEdited = () => { H.log.push(['edited']) }
export const tick = () => {}
export const logDebug = (...said) => { H.log.push(['log', ...said]) }
`

/**
 * The pop-up on a bench. `source` is the file's text, so a check can run a
 * copy with the fault put back and see that the bench catches it.
 */
async function bench(source = read('mobile/src/components/Volume.js')) {
  const { build } = await import('esbuild')
  const dir = mkdtempSync(join(tmpdir(), 'volume-drag-'))
  try {
    const standins = join(dir, 'standins.mjs')
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    writeFileSync(standins, STANDINS)
    writeFileSync(join(dir, 'Volume.js'), source)
    await build({
      entryPoints: [join(dir, 'Volume.js')],
      bundle: true,
      format: 'esm',
      outfile: join(dir, 'out.mjs'),
      loader: { '.js': 'jsx' },
      jsx: 'transform',
      jsxFactory: '__h',
      jsxFragment: '__F',
      banner: { js: `import { createElement as __h, Fragment as __F } from ${JSON.stringify(standins)};` },
      logLevel: 'silent',
      plugins: [
        {
          name: 'standins',
          setup(b) {
            b.onResolve({ filter: /.*/ }, (a) => {
              if (a.kind === 'entry-point') return undefined
              /* The slider's own rules are the real ones: the writer that coalesces a drag, the step of a press, the label. */
              if (a.path === '../lib/volume') return { path: repo('mobile/src/lib/volume.js') }
              if (a.importer === repo('mobile/src/lib/volume.js')) return { path: repo(`mobile/src/lib/${a.path.replace(/^\.\//, '')}`) }
              if (a.importer.startsWith(repo('mobile/src/lib/'))) return undefined
              return { path: standins, external: true }
            })
          }
        }
      ]
    })
    const { default: Volume } = await import(pathToFileURL(join(dir, 'out.mjs')).href)
    const { H, unit } = await import(pathToFileURL(standins).href)
    const errors = []
    /* The top bar hands over one function for errors, the same one every render. */
    const onError = (m) => errors.push(m)
    const wait = (ms) => new Promise((done) => setTimeout(done, ms))
    let tree = null
    const find = (n, is) => {
      if (!n || typeof n !== 'object') return null
      if (Array.isArray(n)) {
        for (const c of n) {
          const f = find(c, is)
          if (f) return f
        }
        return null
      }
      if (n.props && is(n)) return n
      return find(n.children, is) || find(n.props?.children, is)
    }
    /* Draw, and leave the after-work waiting. */
    const render = (props) => {
      H.i = 0
      tree = Volume({ onClose() {}, onError, ...props })
    }
    /* Run the after-work that waits, oldest first. */
    const flush = async () => {
      const run = H.effects
      H.effects = []
      for (const fn of run) fn()
      await wait(2)
    }
    const draw = async (props) => {
      render(props)
      await flush()
    }
    return {
      H,
      unit,
      errors,
      wait,
      draw,
      render,
      flush,
      find: (is) => find(tree, is),
      slider: () => find(tree, (n) => n.props.accessibilityRole === 'adjustable'),
      button: (label) => find(tree, (n) => n.props.accessibilityLabel === label),
      /** As the top bar does it: drawn at launch with no chain, then with the chain, then opened and its level read. */
      async open(blocks, { launch = [] } = {}) {
        await draw({ blocks: launch, open: false })
        await draw({ blocks, open: false })
        await draw({ blocks, open: true })
        await draw({ blocks, open: true })
        const track = find(this.slider(), (n) => typeof n.props.onLayout === 'function')
        track?.props.onLayout({ nativeEvent: { layout: { width: 300 } } })
        await draw({ blocks, open: true })
      },
      sent: () => H.log.filter((l) => l[0] !== 'read' && l[0] !== 'log'),
      said: () => H.log.filter((l) => l[0] === 'log')
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const OUTPUT = [{ slug: 'output', name: 'Output 1', effectId: 46 }]
const LOADING = 'No output level to move yet — the chain is still loading.'

export function run(test) {
  test('volume: a drag on the slider lands on the Output block the unit has now, confirmed, with no error, though the pop-up was first drawn before the chain was read', async () => {
    const b = await bench()
    await b.open(OUTPUT)
    const slider = b.slider()
    assert.ok(slider, 'the slider was not drawn with an Output block and its level read')
    /* A track 300 wide over 100 dB: 30 across is 10 dB up from 0. */
    slider.props.onPanResponderGrant()
    slider.props.onPanResponderMove({}, { dx: 30 })
    await b.draw({ blocks: OUTPUT, open: true })
    slider.props.onPanResponderRelease()
    await b.wait(20)
    assert.deepEqual(b.errors, [], 'letting go of the slider said there was nothing to move')
    assert.deepEqual(b.sent(), [['write', 46, 10], ['confirmed', 46, 10], ['edited']], 'the value the thumb came off on was not confirmed on the Output block, or Save was not told')
    assert.deepEqual(b.said(), [], 'the log says the chain has not been read')
  })

  test('volume: the thumb can come off before the screen has drawn the last value, and a drag that is taken away lands as one let go does', async () => {
    const b = await bench()
    await b.open(OUTPUT)
    const slider = b.slider()
    slider.props.onPanResponderGrant()
    slider.props.onPanResponderMove({}, { dx: 30 })
    /* No draw between the move and the release: the value is only on the ref. */
    slider.props.onPanResponderRelease()
    await b.wait(20)
    assert.deepEqual(b.errors, [])
    assert.deepEqual(b.sent(), [['write', 46, 10], ['confirmed', 46, 10], ['edited']], 'the landing confirmed the level from before the last move')

    /* Taken away (a call coming in, the system's own gesture): the same landing. */
    b.H.log.length = 0
    await b.draw({ blocks: OUTPUT, open: true })
    const again = b.slider()
    again.props.onPanResponderGrant()
    again.props.onPanResponderMove({}, { dx: -15 })
    again.props.onPanResponderTerminate()
    await b.wait(20)
    assert.deepEqual(b.errors, [])
    assert.deepEqual(b.sent(), [['write', 46, 5], ['confirmed', 46, 5], ['edited']])
  })

  test('volume: a draw’s after-work that runs late never puts an older level back over the one the thumb has moved to', async () => {
    /*
     * The draw of +10 leaves its after-work waiting; the thumb moves on to
     * +15; the after-work of the +10 draw runs; the thumb comes off. What is
     * confirmed is where the thumb came off, +15: not the +10 that was drawn
     * last, which would leave the unit at +10 under a slider showing +15.
     */
    const b = await bench()
    await b.open(OUTPUT)
    const slider = b.slider()
    slider.props.onPanResponderGrant()
    slider.props.onPanResponderMove({}, { dx: 30 })
    b.render({ blocks: OUTPUT, open: true })
    slider.props.onPanResponderMove({}, { dx: 45 })
    await b.flush()
    slider.props.onPanResponderRelease()
    await b.wait(20)
    assert.deepEqual(b.errors, [])
    assert.deepEqual(b.sent(), [['write', 46, 10], ['write', 46, 15], ['confirmed', 46, 15], ['edited']], 'the level confirmed is one the thumb had already left')
    await b.draw({ blocks: OUTPUT, open: true })
    assert.equal(b.slider().props.accessibilityValue.now, 15)

    /* The same for presses: three quick ones with a late draw between them step from each other, never from what was last drawn. */
    b.H.log.length = 0
    b.button('Volume up').props.onPress()
    b.render({ blocks: OUTPUT, open: true })
    b.button('Volume up').props.onPress()
    await b.flush()
    b.button('Volume up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(420)
    assert.deepEqual(b.errors, [])
    assert.deepEqual(b.sent().filter((l) => l[0] === 'confirmed'), [['confirmed', 46, 18]], 'three presses of + from +15 did not land on +18')
  })

  test('volume: a chain that goes away under the thumb takes its level with it: nothing is confirmed on a block that is not there', async () => {
    /*
     * The unit drops off mid-drag: the chain is emptied, and the thumb comes
     * off after it. The level belonged to the block that went, and is
     * forgotten with it, so there is nothing to land and nothing to say.
     * (The two "nothing to write to" sentences are for a slider and a chain
     * that disagree, which the drawing rules out: they are checked as words
     * below, and cannot be reached from here.)
     */
    for (const gone of [[], [{ slug: 'output', name: 'Output 1' }]]) {
      const b = await bench()
      await b.open(OUTPUT)
      const slider = b.slider()
      slider.props.onPanResponderGrant()
      slider.props.onPanResponderMove({}, { dx: 30 })
      await b.draw({ blocks: gone, open: true })
      slider.props.onPanResponderRelease()
      await b.wait(20)
      assert.deepEqual(b.sent(), [['write', 46, 10]], 'a level was confirmed on a block that is no longer there')
      assert.deepEqual(b.errors, [])
      await b.draw({ blocks: gone, open: true })
      assert.equal(b.slider(), null, 'the slider is still drawn with no Output block to move')
    }
  })

  test('volume: the metronome’s part scrolls on its own in what the window leaves, and the slider is never inside anything that scrolls', async () => {
    const b = await bench()
    await b.open(OUTPUT)
    const inside = (n, is) => {
      if (!n || typeof n !== 'object') return false
      if (Array.isArray(n)) return n.some((c) => inside(c, is))
      return (n.props && is(n)) || inside(n.children, is) || inside(n.props?.children, is)
    }
    const scrolls = b.find((n) => n.type === 'ScrollView')
    assert.ok(scrolls, 'the metronome’s part cannot be scrolled: on a short window Done is pushed off the bottom')
    /* Only the metronome is in it. The slider is dragged sideways, and a scroll view under a drag is the fight this pop-up was made to end. */
    assert.ok(!inside(scrolls, (n) => n.props.accessibilityRole === 'adjustable'), 'the slider is inside a scroll view')
    assert.ok(!inside(scrolls, (n) => n.props.label === 'Done'), 'Done scrolls away with the metronome')
    assert.equal(scrolls.children.flat().filter(Boolean).length, 1, 'more than the metronome scrolls')
    /* No taller than the window leaves once everything round it is drawn, and it does not grow to fill the panel when it is short. */
    const around = (height, insets) => {
      b.H.window = { width: 390, height }
      b.H.insets = insets
      b.render({ blocks: OUTPUT, open: true })
      return height - (insets?.top || 0) - (insets?.bottom || 0) - b.find((n) => n.type === 'ScrollView').props.style.maxHeight
    }
    const fixed = around(844, { top: 0, bottom: 0, left: 0, right: 0 })
    assert.ok(fixed > 0)
    for (const height of [640, 667, 740, 956]) {
      assert.equal(around(height, { top: 0, bottom: 0, left: 0, right: 0 }), fixed, `${height}: what is left for the metronome does not follow the window`)
      assert.equal(around(height, { top: 47, bottom: 34, left: 0, right: 0 }), fixed, `${height}: the screen’s own edges are not left clear`)
    }
    assert.equal(b.find((n) => n.type === 'ScrollView').props.style.flexGrow, 0)
    /* On a window with no room at all, the switch and a line of words are still whole. */
    b.H.window = { width: 844, height: 300 }
    b.H.insets = null
    b.render({ blocks: OUTPUT, open: true })
    assert.ok(b.find((n) => n.type === 'ScrollView').props.style.maxHeight >= 44, 'no room is left for the switch itself')
    /* The sizes round it are the theme’s, so they move with it. */
    const src = read('mobile/src/components/Volume.js')
    assert.match(src, /const AROUND_METRONOME = 4 \* space\.xl \+ 4 \* space\.lg \+ VOLUME_ROW \+ 2 \* TAP \+ CLOSE_LINE\n/)
    assert.match(src, /style=\{\{ flexGrow: 0, maxHeight: metronomeRoom\(height0, insets\) \}\}/)
  })

  test('volume: a press still settling when the Output block changes is dropped with its block, and the new block’s level is shown and stepped from', async () => {
    /*
     * A press of +, then inside the same second a footswitch to a preset
     * whose Output is another block, holding +5. The read of the new block
     * used to be held back for the press still waiting (a press on the OLD
     * block), so its level was never shown: the slider read "—", and the
     * next + stepped from the bottom of the range and wrote −79 dB.
     */
    const b = await bench()
    await b.open(OUTPUT)
    b.unit.levels[47] = 5
    const other = [{ slug: 'output', name: 'Output 1', effectId: 47 }]
    b.H.log.length = 0
    b.button('Volume up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.draw({ blocks: other, open: true })
    await b.draw({ blocks: other, open: true })
    await b.wait(20)
    await b.draw({ blocks: other, open: true })
    assert.equal(b.slider()?.props.accessibilityValue.now, 5, 'the new block’s level is not shown: a press on the block before it is still being waited for')
    await b.wait(420)
    await b.draw({ blocks: other, open: true })
    assert.deepEqual(b.sent(), [['write', 46, 1]], 'the press on the old block was landed on the new one, or lit Save for a change nobody made')
    assert.deepEqual(b.errors, [])
    /* And the next press steps from what the new block holds. */
    b.button('Volume up').props.onPress()
    await b.draw({ blocks: other, open: true })
    await b.wait(420)
    assert.deepEqual(b.sent().slice(1), [['write', 47, 6], ['confirmed', 47, 6], ['edited']], 'the next press did not step from the new block’s level')
  })

  test('volume: a drag still going out when the Output block changes is not confirmed on the block that has gone', async () => {
    const b = await bench()
    await b.open(OUTPUT)
    b.unit.levels[47] = 5
    const other = [{ slug: 'output', name: 'Output 1', effectId: 47 }]
    /* A slow wire: the drag's write is still on its way when the other unit's preset arrives. */
    b.unit.slow = 60
    b.H.log.length = 0
    const slider = b.slider()
    slider.props.onPanResponderGrant()
    slider.props.onPanResponderMove({}, { dx: 30 })
    slider.props.onPanResponderRelease()
    await b.draw({ blocks: other, open: true })
    await b.draw({ blocks: other, open: true })
    await b.wait(250)
    await b.draw({ blocks: other, open: true })
    assert.deepEqual(b.sent(), [['write', 46, 10]], 'the old block’s level was confirmed after its block had gone')
    assert.deepEqual(b.errors, [])
    assert.equal(b.slider()?.props.accessibilityValue.now, 5, 'the new block’s level is not shown')
  })

  test('volume: a level the unit did not give is never stepped or dragged from: nothing is sent from the bottom of the range', async () => {
    const b = await bench()
    b.unit.level = undefined
    await b.open(OUTPUT)
    b.H.log.length = 0
    assert.ok(b.slider(), 'this check needs the slider drawn with no level known')
    b.button('Volume up').props.onPress()
    b.button('Volume down').props.onPress()
    const slider = b.slider()
    slider.props.onPanResponderGrant()
    slider.props.onPanResponderMove({}, { dx: 30 })
    slider.props.onPanResponderRelease()
    await b.wait(420)
    assert.deepEqual(b.sent(), [], 'a level was sent with none known to count from')
    assert.deepEqual(b.errors, [])
  })

  test('volume: a quick close and open while a drag is still landing keeps the level the thumb left, not the one the unit held when the open asked', async () => {
    const b = await bench()
    await b.open(OUTPUT)
    /* A slow wire: each write takes 30 ms to land. +10 is going out and +15 waits behind it when the thumb comes off. */
    b.unit.slow = 30
    b.H.log.length = 0
    const slider = b.slider()
    slider.props.onPanResponderGrant()
    slider.props.onPanResponderMove({}, { dx: 30 })
    slider.props.onPanResponderMove({}, { dx: 45 })
    slider.props.onPanResponderRelease()
    await b.draw({ blocks: OUTPUT, open: false })
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(150)
    await b.draw({ blocks: OUTPUT, open: true })
    assert.deepEqual(b.errors, [])
    assert.deepEqual(b.sent(), [['write', 46, 10], ['write', 46, 15], ['confirmed', 46, 15], ['edited']])
    assert.equal(b.unit.level, 15)
    assert.equal(b.slider().props.accessibilityValue.now, 15, 'the slider shows the level the unit held when the open asked, under the one it now has')
    /* And a press steps from it. */
    b.unit.slow = 0
    b.button('Volume up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(420)
    assert.deepEqual(b.sent().slice(4).filter((l) => l[0] === 'confirmed'), [['confirmed', 46, 16]])

    /* A drag let go while presses still wait lands once for both, on where the thumb came off. */
    b.H.log.length = 0
    b.button('Volume up').props.onPress()
    const again = b.slider()
    again.props.onPanResponderGrant()
    again.props.onPanResponderMove({}, { dx: -30 })
    again.props.onPanResponderRelease()
    await b.wait(450)
    assert.deepEqual(b.sent().filter((l) => l[0] === 'confirmed'), [['confirmed', 46, 7]], 'the presses’ own landing came after the drag’s, a second time')
  })

  test('volume: after another unit’s chain is read, a drag lands on that unit’s Output block, not the one the pop-up first saw', async () => {
    const b = await bench()
    /* First drawn WITH an Output block this time: a touch handler that kept the first render’s block would write to 46 for good. */
    await b.open(OUTPUT, { launch: OUTPUT })
    const other = [{ slug: 'output', name: 'Output 1', effectId: 50 }]
    await b.draw({ blocks: other, open: true })
    await b.draw({ blocks: other, open: true })
    await b.draw({ blocks: other, open: true })
    b.H.log.length = 0
    const slider = b.slider()
    assert.ok(slider, 'the slider is gone after the other unit’s level was read')
    slider.props.onPanResponderGrant()
    slider.props.onPanResponderMove({}, { dx: 30 })
    await b.draw({ blocks: other, open: true })
    slider.props.onPanResponderRelease()
    await b.wait(20)
    assert.deepEqual(b.errors, [])
    assert.deepEqual(b.sent(), [['write', 50, 10], ['confirmed', 50, 10], ['edited']], 'the landing went to the Output block of the unit that was there first')
  })

  test('volume: a press of + and a turn of the screen reader’s dial are written, confirmed once the presses stop, and say nothing', async () => {
    const b = await bench()
    await b.open(OUTPUT)
    b.H.log.length = 0
    b.button('Volume up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    b.slider().props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } })
    await b.wait(420)
    assert.deepEqual(b.errors, [])
    const sent = b.sent()
    assert.deepEqual(sent[0], ['write', 46, 1], 'a press of + did not go to the unit at once')
    assert.deepEqual(sent.filter((l) => l[0] === 'confirmed'), [['confirmed', 46, 0]], 'the burst was not confirmed once, on the value it ended on')
    assert.ok(sent.some((l) => l[0] === 'edited'), 'Save was not told')
  })

  test('volume: a level the unit will not hold is said where errors are said NOW, with what it holds, and the slider goes back to it', async () => {
    const b = await bench()
    await b.open(OUTPUT)
    b.unit.holds = 0.8
    /* Whoever draws the pop-up may hand it another place to say errors: the landing says them there, not where the first render was told. */
    const now = []
    const props = { blocks: OUTPUT, open: true, onError: (m) => now.push(m) }
    await b.draw(props)
    await b.draw(props)
    const slider = b.slider()
    slider.props.onPanResponderGrant()
    slider.props.onPanResponderMove({}, { dx: 30 })
    await b.draw(props)
    slider.props.onPanResponderRelease()
    await b.wait(20)
    assert.deepEqual(now, ['The volume didn’t take. You asked for +10.0 dB; the unit says +0.8 dB.'])
    assert.deepEqual(b.errors, [], 'the error was said where the first render was told to say it')
    await b.draw(props)
    assert.equal(b.slider().props.accessibilityValue.now, 0.8, 'the slider is left pointing at a level the unit refused')
  })

  test('volume: with no chain read there is no slider to drag, and the two reasons for nothing to write to keep their own words', async () => {
    const b = await bench()
    await b.draw({ blocks: [], open: false })
    await b.draw({ blocks: [], open: true })
    await b.draw({ blocks: [], open: true })
    assert.equal(b.slider(), null, 'a slider is drawn with no Output block to move')
    assert.equal(b.button('Volume up'), null)
    const src = read('mobile/src/components/Volume.js')
    assert.ok(src.includes(`'${LOADING}'`), 'the still-loading sentence changed: the check below looks for it')
    assert.match(src, /'This preset’s Output block came back without a level this app can move\.'/)
  })

  test('volume: this bench catches the fault when it is put back', async () => {
    /*
     * A check that cannot fail is not a check. The landing is given back the
     * render it was made in, as it had it, and the same drag is run: the
     * bench has to see the error he saw, or nothing above proves anything.
     */
    const now = read('mobile/src/components/Volume.js')
    const fixed = [
      ['const { param: p, eid: block, present, onError: say } = live.current\n    const v = level.current', 'const { param: p } = live.current\n    const v = level.current'],
      ['if (!Number.isInteger(block)) {\n      noOutput(present, say)\n      return\n    }\n    try {', 'if (!Number.isInteger(eid)) {\n      noOutput(!!output, onError)\n      return\n    }\n    try {'],
      ['if (failed) say?.(failed.message)', 'if (failed) onError?.(failed.message)'],
      ['await setParamConfirmed(block, p.id, v, p)', 'await setParamConfirmed(eid, p.id, v, p)']
    ]
    let old = now
    for (const [is, was] of fixed) {
      assert.equal(old.split(is).length, 2, `the landing no longer reads “${is}”: this check puts the old line back by its text`)
      old = old.replace(is, was).replace(/\bsay\?\.\(\n/g, 'onError?.(\n').replace('say?.(err.message)', 'onError?.(err.message)')
    }
    const b = await bench(old)
    await b.open(OUTPUT)
    const slider = b.slider()
    slider.props.onPanResponderGrant()
    slider.props.onPanResponderMove({}, { dx: 30 })
    await b.draw({ blocks: OUTPUT, open: true })
    slider.props.onPanResponderRelease()
    await b.wait(20)
    assert.deepEqual(b.errors, [LOADING], 'the old landing ran clean on this bench, so the bench does not see what he saw')
    assert.deepEqual(b.sent(), [['write', 46, 10]], 'the old landing confirmed the level after all')
  })
}
