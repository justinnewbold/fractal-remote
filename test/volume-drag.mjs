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
export const H = { slots: [], i: 0, effects: [], log: [], made: 0, window: { width: 390, height: 844 }, rig: { deviceSlug: 'fm3', preset: { number: 12 } }, levels: false }
/* The rig's store: which unit, which preset is on it, and (where a test says) which scene and the scenes' names. */
export const useRig = (pick) => pick(H.rig)
/* Whether the Output block's levels are open to this account (lib/bluetooth): his, or the switch. Closed unless a test opens them. */
export const useOutputAndSceneLevels = () => H.levels === true
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
 *
 * AND EACH SCENE'S LEVEL where a test gives the unit some (\`unit.scenes\`,
 * by setting id: the Output block's Scene N Level, as each unit's catalog
 * has them), read with the block and written down with the setting it went
 * to: ['write', block, v, id]. The main level's lines are as they always were.
 */
export const unit = { level: 0, levels: {}, holds: null, slow: 0, scenes: null, sceneHolds: null, sceneCheckSlow: 0, readFails: false }
const landed = () => (unit.slow ? new Promise((done) => setTimeout(done, unit.slow)) : null)
export const idOf = (b) => b?.effectId
const sceneRows = () => (unit.scenes ? Object.entries(unit.scenes).map(([id, value]) => ({ id: Number(id), name: \`Scene \${Number(id) - 17} Level\`, min: -20, max: 20, value })) : [])
export const blockParams = async (eid) => { H.log.push(['read', eid]); if (unit.readFails) throw new Error('The unit didn’t answer.'); return { named: [{ id: 0, name: 'Level', unit: 'dB', min: -80, max: 20, value: eid in unit.levels ? unit.levels[eid] : unit.level }, ...sceneRows()] } }
export const setParam = async (block, id, v) => {
  if (id !== 0) { H.log.push(['write', block, v, id]); await landed(); unit.scenes[id] = v; return }
  H.log.push(['write', block, v]); await landed(); unit.level = v
}
export const setParamConfirmed = async (block, id, v) => {
  if (id !== 0) {
    /* A scene level's check takes \`unit.sceneCheckSlow\` ms where a test says so, and says when it is over: ['checked', block, v, id]. */
    H.log.push(['confirmed', block, v, id])
    await landed()
    if (unit.sceneCheckSlow) await new Promise((done) => setTimeout(done, unit.sceneCheckSlow))
    H.log.push(['checked', block, v, id])
    if (unit.sceneHolds !== null) return { ok: false, actual: unit.sceneHolds }
    unit.scenes[id] = v
    return { ok: true, actual: v }
  }
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
      /* By its name beside the bundle, never by its path: a Windows path ("C:\\…") is no address Node will import from. */
      banner: { js: `import { createElement as __h, Fragment as __F } from './standins.mjs';` },
      logLevel: 'silent',
      plugins: [
        {
          name: 'standins',
          setup(b) {
            b.onResolve({ filter: /.*/ }, (a) => {
              if (a.kind === 'entry-point') return undefined
              /* The slider's own rules are the real ones: the writer that coalesces a drag, the step of a press, the label. */
              if (a.path === '../lib/volume') return { path: repo('mobile/src/lib/volume.js') }
              /* And the scene levels' and the Output's own rules (lib/sceneLevel), the real file too. */
              if (a.path === '../lib/sceneLevel') return { path: repo('mobile/src/lib/sceneLevel.js') }
              if (a.importer === repo('mobile/src/lib/volume.js')) return { path: repo(`mobile/src/lib/${a.path.replace(/^\.\//, '')}`) }
              if (a.importer.startsWith(repo('mobile/src/lib/'))) return undefined
              return { path: './standins.mjs', external: true }
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
      /* What went to the unit, in order: writes, and the confirmed ones. */
      sent: () => H.log.filter((l) => l[0] === 'write' || l[0] === 'confirmed'),
      /* How many times Save was told there is something to save. */
      told: () => H.log.filter((l) => l[0] === 'edited').length,
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
    assert.deepEqual(b.sent(), [['write', 46, 10], ['confirmed', 46, 10]], 'the value the thumb came off on was not confirmed on the Output block')
    assert.ok(b.told() > 0, 'Save was not told')
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
    assert.deepEqual(b.sent(), [['write', 46, 10], ['confirmed', 46, 10]], 'the landing confirmed the level from before the last move')

    /* Taken away (a call coming in, the system's own gesture): the same landing. */
    b.H.log.length = 0
    await b.draw({ blocks: OUTPUT, open: true })
    const again = b.slider()
    again.props.onPanResponderGrant()
    again.props.onPanResponderMove({}, { dx: -15 })
    again.props.onPanResponderTerminate()
    await b.wait(20)
    assert.deepEqual(b.errors, [])
    assert.deepEqual(b.sent(), [['write', 46, 5], ['confirmed', 46, 5]])
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
    assert.deepEqual(b.sent(), [['write', 46, 10], ['write', 46, 15], ['confirmed', 46, 15]], 'the level confirmed is one the thumb had already left')
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
    /* Less this scene's row where it is drawn (lib/sceneLevel; the scene levels' own test runs it). */
    assert.match(src, /style=\{\{ flexGrow: 0, maxHeight: metronomeRoom\(height0, insets, sceneRow\) \}\}/)
    assert.match(src, /const SCENE_ROW = space\.lg \+ CLOSE_LINE \+ space\.xs \+ TAP\n/)
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
    assert.deepEqual(b.sent(), [['write', 46, 1]], 'the press on the old block was landed on the new one')
    assert.equal(b.told(), 1, 'Save was lit for a change nobody made on the new block, or never told of the press')
    assert.deepEqual(b.errors, [])
    /* And the next press steps from what the new block holds. */
    b.button('Volume up').props.onPress()
    await b.draw({ blocks: other, open: true })
    await b.wait(420)
    assert.deepEqual(b.sent().slice(1), [['write', 47, 6], ['confirmed', 47, 6]], 'the next press did not step from the new block’s level')
  })

  test('volume: another preset under the same Output block is another level: read again, and a press still waiting is not confirmed on it', async () => {
    /*
     * On an FM3, FM9 or Axe-Fx III the Output block is the same id in every
     * preset. A press of +, then a footswitch to the next preset inside the
     * same second: the wait used to fire and confirm +1 on a preset that
     * was at −6, with Save lit, and the slider went on showing the last
     * preset's level.
     */
    const b = await bench()
    await b.open(OUTPUT)
    b.H.log.length = 0
    b.button('Volume up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(10)
    /* The footswitch: the same block, another preset, holding −6. */
    b.unit.level = -6
    b.H.rig = { deviceSlug: 'fm3', preset: { number: 13 } }
    await b.draw({ blocks: OUTPUT, open: true })
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(10)
    await b.draw({ blocks: OUTPUT, open: true })
    assert.equal(b.slider()?.props.accessibilityValue.now, -6, 'the last preset’s level is still on the slider')
    await b.wait(420)
    assert.deepEqual(b.sent(), [['write', 46, 1]], 'a press made on the last preset was confirmed on this one')
    assert.equal(b.unit.level, -6)
    assert.deepEqual(b.errors, [])
    /* Save was told once, at the press, for the preset it was made on: nothing is told for this one, which nobody changed. */
    assert.equal(b.told(), 1, 'Save was told of a change on a preset nobody changed, or never told of the press')
    /* The same for another unit with the same preset number and the same block. */
    b.H.rig = { deviceSlug: 'fm9', preset: { number: 13 } }
    b.unit.level = 3
    await b.draw({ blocks: OUTPUT, open: true })
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(10)
    await b.draw({ blocks: OUTPUT, open: true })
    assert.equal(b.slider()?.props.accessibilityValue.now, 3, 'another unit’s level is not read')
    /* And nothing is read again for a draw that changes neither. */
    const reads = b.H.log.filter((l) => l[0] === 'read').length
    await b.draw({ blocks: OUTPUT, open: true })
    await b.draw({ blocks: [...OUTPUT], open: true })
    assert.equal(b.H.log.filter((l) => l[0] === 'read').length, reads, 'the level is read again with nothing changed')
  })

  test('volume: a preset change that did not happen (put up at once, then put back) drops the press’s wait, and Save still knows of the level that went', async () => {
    /*
     * The watch's Next puts the new preset number up at once; the unit
     * refuses it, and the old number is put back. The level is the preset's,
     * so it is dropped and read again both times, and the press's wait to
     * be confirmed goes with it. The unit is still on the same preset,
     * holding the level the press sent: it is on the slider again once
     * read, and Save was told as it was sent.
     */
    const b = await bench()
    await b.open(OUTPUT)
    b.H.log.length = 0
    b.button('Volume up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(10)
    b.H.rig = { deviceSlug: 'fm3', preset: { number: 13 } }
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(10)
    b.H.rig = { deviceSlug: 'fm3', preset: { number: 12 } }
    await b.draw({ blocks: OUTPUT, open: true })
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(10)
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(420)
    assert.deepEqual(b.sent(), [['write', 46, 1]])
    assert.ok(b.told() > 0, 'the unit holds a level Save has never heard of')
    assert.equal(b.slider()?.props.accessibilityValue.now, 1, 'the level the unit holds is not on the slider')
    assert.deepEqual(b.errors, [])
    /* The same for a unit that stops answering for a moment (no preset number), then is back. */
    b.H.log.length = 0
    b.button('Volume up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    b.H.rig = { deviceSlug: 'fm3', preset: { number: -1 } }
    await b.draw({ blocks: OUTPUT, open: true })
    b.H.rig = { deviceSlug: 'fm3', preset: { number: 12 } }
    await b.draw({ blocks: OUTPUT, open: true })
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(10)
    await b.draw({ blocks: OUTPUT, open: true })
    assert.ok(b.told() > 0)
    assert.equal(b.slider()?.props.accessibilityValue.now, 2)
  })

  test('volume: a chain read again while a drag is still being confirmed leaves the slider working, on the level the unit has', async () => {
    /*
     * The drag's confirm is still out on a slow wire when the chain is
     * emptied and read again, the Output block back under the same id. The
     * read of it used to be held back for the landing from before it went:
     * the slider read "—", and every press was dropped with nothing said,
     * until the pop-up was closed and opened.
     */
    const b = await bench()
    await b.open(OUTPUT)
    b.unit.slow = 120
    b.H.log.length = 0
    const slider = b.slider()
    slider.props.onPanResponderGrant()
    slider.props.onPanResponderMove({}, { dx: 30 })
    slider.props.onPanResponderRelease()
    await b.wait(20)
    await b.draw({ blocks: [], open: true })
    b.unit.slow = 0
    b.unit.levels[46] = -6
    await b.draw({ blocks: OUTPUT, open: true })
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(300)
    await b.draw({ blocks: OUTPUT, open: true })
    assert.equal(b.slider()?.props.accessibilityValue.now, -6, 'the slider is left with no level after the chain was read again')
    assert.deepEqual(b.errors, [])
    b.H.log.length = 0
    b.button('Volume up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(420)
    assert.deepEqual(b.sent(), [['write', 46, -5], ['confirmed', 46, -5]], 'a press is dropped after the chain was read again')
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
    assert.ok(b.told() > 0, 'a level that went out was never told to Save: its confirm was dropped, and that was the only place Save heard')
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
    assert.equal(b.told(), 0, 'Save was told of a level that was never sent')
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
    assert.deepEqual(b.sent(), [['write', 46, 10], ['write', 46, 15], ['confirmed', 46, 15]])
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
    assert.deepEqual(b.sent(), [['write', 50, 10], ['confirmed', 50, 10]], 'the landing went to the Output block of the unit that was there first')
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
    assert.ok(b.told() > 0, 'Save was not told')
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

  /*
   * THIS SCENE'S LEVEL, AND OUTPUT 1 (lib/sceneLevel), for an account the
   * levels are open to (lib/bluetooth outputAndSceneLevels: his, until
   * lib/features OUTPUT_AND_SCENE_LEVELS_FOR_EVERYONE). "Scenes levels" was
   * a customer's ask (an FM9 over Bluetooth): the Output block's Scene 1 to
   * 8 Level, at ids 18 to 25, -20 to +20 dB. Run on the real pop-up.
   */
  const SCENES = { 18: 1, 19: 2, 20: 3, 21: 4, 22: 5, 23: 6, 24: 7, 25: 8 }
  const said = (n) => [n?.children].flat(Infinity).filter((x) => typeof x === 'string').join('')
  async function onAScene(index, { levels = true, scenes = SCENES, names = ['CLEAN', 'CRUNCH', 'LEAD'] } = {}) {
    const b = await bench()
    b.H.levels = levels
    b.H.rig = { deviceSlug: 'fm9', preset: { number: 12 }, sceneIndex: index, sceneNames: names }
    b.unit.scenes = scenes === null ? null : { ...scenes }
    await b.open(OUTPUT)
    return b
  }
  const sceneShown = (b, n) => said(b.find((x) => x.props.accessibilityLabel === `Scene ${n} level`))

  test('volume: this scene’s row reads the level of the scene the unit is on out of the same read, writes that scene’s own setting a dB a press, confirms it once the presses stop, and follows a scene change', async () => {
    const b = await onAScene(2)
    assert.equal(sceneShown(b, 3), '+3.0 dB', 'the row does not show scene 3’s level as the unit holds it')
    assert.ok(b.find((n) => said(n) === 'Scene 3 · LEAD'), 'the row does not name the scene')
    assert.deepEqual(b.H.log.filter((l) => l[0] === 'read'), [['read', 46]], 'the scene’s level asked the unit something more than the one read of the Output block')
    b.H.log.length = 0
    b.button('Scene 3 level up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    b.button('Scene 3 level up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    assert.equal(sceneShown(b, 3), '+5.0 dB')
    await b.wait(420)
    assert.deepEqual(b.sent(), [['write', 46, 4, 20], ['write', 46, 5, 20], ['confirmed', 46, 5, 20]], 'two presses on scene 3 did not go to Scene 3 Level, each at once, and confirmed once on where they ended')
    /* Told at each press, as the level is sent, and once more as it is confirmed: the main level's own rule. */
    assert.equal(b.told(), 3, 'Save was not told at each press and at the landing')
    assert.deepEqual(b.errors, [])
    /* A footswitch to scene 5: its own level, out of the read already made, and its own setting. */
    b.H.log.length = 0
    b.H.rig = { ...b.H.rig, sceneIndex: 4 }
    await b.draw({ blocks: OUTPUT, open: true })
    assert.equal(b.button('Scene 3 level up'), null, 'scene 3’s row is still up on scene 5')
    assert.equal(sceneShown(b, 5), '+5.0 dB', 'scene 5’s level is not shown on scene 5')
    b.button('Scene 5 level down').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(420)
    assert.deepEqual(b.sent(), [['write', 46, 4, 22], ['confirmed', 46, 4, 22]], 'a press on scene 5 did not go to Scene 5 Level')
    assert.deepEqual(b.H.log.filter((l) => l[0] === 'read'), [], 'a scene change read the Output block again')
    /* And the main level is untouched by all of it. */
    assert.equal(b.slider().props.accessibilityValue.now, 0)
    assert.equal(b.unit.level, 0)
  })

  test('volume: this scene’s row never goes past −20 or +20 dB, never steps from a level it does not know, and never shows for a scene the unit has not said', async () => {
    /* At the top, + sends nothing; − comes down. At the bottom (the floor), − sends nothing. */
    const top = await onAScene(2, { scenes: { ...SCENES, 20: 20 } })
    top.H.log.length = 0
    top.button('Scene 3 level up').props.onPress()
    await top.draw({ blocks: OUTPUT, open: true })
    await top.wait(420)
    assert.deepEqual(top.sent(), [], 'a press of + at +20 dB was sent')
    assert.equal(sceneShown(top, 3), '+20.0 dB')
    top.button('Scene 3 level down').props.onPress()
    await top.draw({ blocks: OUTPUT, open: true })
    await top.wait(420)
    assert.deepEqual(top.sent(), [['write', 46, 19, 20], ['confirmed', 46, 19, 20]])
    const bottom = await onAScene(2, { scenes: { ...SCENES, 20: -19.7 } })
    bottom.H.log.length = 0
    bottom.button('Scene 3 level down').props.onPress()
    await bottom.draw({ blocks: OUTPUT, open: true })
    bottom.button('Scene 3 level down').props.onPress()
    await bottom.draw({ blocks: OUTPUT, open: true })
    await bottom.wait(420)
    assert.deepEqual(bottom.sent(), [['write', 46, -20, 20], ['confirmed', 46, -20, 20]], 'a scene level went under the floor, or the press at the floor was sent')
    /* A level the read did not give as a number: drawn as not known, and no press sends anything. */
    const unknown = await onAScene(2, { scenes: { ...SCENES, 20: null } })
    unknown.H.log.length = 0
    assert.equal(sceneShown(unknown, 3), '—')
    unknown.button('Scene 3 level up').props.onPress()
    unknown.button('Scene 3 level down').props.onPress()
    await unknown.draw({ blocks: OUTPUT, open: true })
    await unknown.wait(420)
    assert.deepEqual(unknown.sent(), [], 'a press stepped from a scene level nobody read')
    assert.equal(unknown.told(), 0)
    /* No scene said (the unit has not answered which), a scene past the eighth, or a read that names no scene levels: no row at all. */
    for (const [index, scenes] of [[undefined, SCENES], [-1, SCENES], [8, SCENES], [2, null], [2, { 18: 1 }]]) {
      const b = await onAScene(index, { scenes })
      assert.equal(b.find((n) => said(n) === 'THIS SCENE'), null, `a scene row was drawn for scene ${index} with ${JSON.stringify(scenes)}`)
    }
  })

  test('volume: a scene level the unit will not hold is said with what it holds and shown, and a press still waiting is not confirmed on another preset', async () => {
    const b = await onAScene(2)
    b.unit.sceneHolds = 1.5
    b.H.log.length = 0
    b.button('Scene 3 level up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(420)
    await b.draw({ blocks: OUTPUT, open: true })
    assert.deepEqual(b.errors, ['Scene 3’s level didn’t take. You asked for +4.0 dB; the unit says +1.5 dB.'])
    assert.equal(sceneShown(b, 3), '+1.5 dB', 'the row is left on a level the unit refused')
    /* A press, then a footswitch to another preset inside the same second: the press is not confirmed there, and the new preset's levels are read. */
    const moved = await onAScene(2)
    moved.H.log.length = 0
    moved.button('Scene 3 level up').props.onPress()
    await moved.draw({ blocks: OUTPUT, open: true })
    moved.unit.scenes = { ...SCENES, 20: -6 }
    moved.H.rig = { ...moved.H.rig, preset: { number: 13 } }
    await moved.draw({ blocks: OUTPUT, open: true })
    await moved.draw({ blocks: OUTPUT, open: true })
    await moved.wait(420)
    await moved.draw({ blocks: OUTPUT, open: true })
    assert.deepEqual(moved.sent(), [['write', 46, 4, 20]], 'a press made on the last preset was confirmed on this one')
    assert.equal(sceneShown(moved, 3), '−6.0 dB', 'the last preset’s scene level is still shown')
    assert.equal(moved.told(), 1)
    assert.deepEqual(moved.errors, [])
  })

  test('volume: the levels open, the speaker moves Output 1 whatever order the chain lists the Outputs in; closed, the pop-up sees and sends exactly what it always did', async () => {
    const TWO = [{ slug: 'output', name: 'Output 2', effectId: 43 }, { slug: 'output', name: 'Output 1', effectId: 42 }]
    /* Open: Output 1, block 42. */
    const open = await onAScene(2)
    await open.open(TWO)
    open.H.log.length = 0
    open.button('Volume up').props.onPress()
    open.button('Scene 3 level up').props.onPress()
    await open.draw({ blocks: TWO, open: true })
    await open.wait(420)
    assert.deepEqual(open.sent().filter((l) => l.length === 3), [['write', 42, 1], ['confirmed', 42, 1]], 'the volume did not move Output 1')
    assert.deepEqual(open.sent().filter((l) => l.length === 4), [['write', 42, 4, 20], ['confirmed', 42, 4, 20]], 'the scene’s level did not go to Output 1')
    /* Closed, with the unit holding scene levels and a scene said: the first Output listed, no row, and the same reads and writes, line for line, as with no scene levels at all. */
    const run = async (levels, scenes) => {
      const b = await onAScene(2, { levels, scenes })
      await b.open(TWO)
      b.H.log.length = 0
      b.button('Volume up').props.onPress()
      await b.draw({ blocks: TWO, open: true })
      await b.wait(420)
      const slider = b.slider()
      slider.props.onPanResponderGrant()
      slider.props.onPanResponderMove({}, { dx: 30 })
      slider.props.onPanResponderRelease()
      await b.wait(20)
      await b.draw({ blocks: TWO, open: false })
      await b.draw({ blocks: TWO, open: true })
      await b.draw({ blocks: TWO, open: true })
      return { log: b.H.log.filter((l) => l[0] !== 'edited'), row: b.find((n) => said(n) === 'THIS SCENE'), tree: b }
    }
    const closed = await run(false, SCENES)
    const none = await run(false, null)
    assert.equal(closed.row, null, 'a scene row is drawn for an account the levels are closed to')
    assert.deepEqual(closed.log, none.log, 'an account the levels are closed to sees or sends something it did not before')
    assert.deepEqual(closed.log.filter((l) => l[0] !== 'read').map((l) => l[1]), [43, 43, 43, 43], 'the volume left the first Output the chain lists, for an account the levels are closed to')
    assert.ok(closed.log.every((l) => l.length === 3 || l[0] === 'read'), 'a scene level went to the unit')
  })

  test('volume: another preset while a scene press is still going out: its check is not sent to the new preset, and a check already out says nothing there', async () => {
    /* The write is still on its way when the press's wait runs out, and the preset changes before it lands. */
    const b = await onAScene(2)
    b.unit.slow = 600
    b.H.log.length = 0
    b.button('Scene 3 level up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(400)
    b.H.rig = { ...b.H.rig, preset: { number: 13 } }
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(900)
    await b.draw({ blocks: OUTPUT, open: true })
    assert.deepEqual(b.sent().filter((l) => l.length === 4), [['write', 46, 4, 20]], 'a press made on the last preset was checked on this one')
    assert.deepEqual(b.errors, [])
    /* The check is already out when the preset changes, the unit holds +1.5 for it, and the new preset happens to be at +4 on scene 3. */
    const out = await onAScene(2)
    out.unit.sceneCheckSlow = 500
    out.unit.sceneHolds = 1.5
    out.H.log.length = 0
    out.button('Scene 3 level up').props.onPress()
    await out.draw({ blocks: OUTPUT, open: true })
    await out.wait(400)
    out.unit.scenes = { ...SCENES, 20: 4 }
    out.H.rig = { ...out.H.rig, preset: { number: 13 } }
    await out.draw({ blocks: OUTPUT, open: true })
    await out.draw({ blocks: OUTPUT, open: true })
    await out.wait(700)
    await out.draw({ blocks: OUTPUT, open: true })
    assert.deepEqual(out.errors, [], 'the last preset’s check spoke over the new one')
    assert.equal(sceneShown(out, 3), '+4.0 dB', 'the last preset’s check put its level on the new preset’s row')
  })

  test('volume: another preset whose read fails shows none of the last preset’s scene levels, and a press steps from nothing', async () => {
    const b = await onAScene(2)
    b.unit.readFails = true
    b.H.rig = { ...b.H.rig, preset: { number: 13 } }
    await b.draw({ blocks: OUTPUT, open: true })
    await b.draw({ blocks: OUTPUT, open: true })
    await b.draw({ blocks: OUTPUT, open: true })
    assert.deepEqual(b.errors, ['The unit didn’t answer.'])
    assert.equal(b.find((n) => said(n) === 'THIS SCENE'), null, 'the last preset’s scene level is drawn on this one')
    assert.equal(b.button('Scene 3 level up'), null)
  })

  test('volume: an account signed out with the pop-up open takes this scene’s row with it, and a press already in hand sends nothing', async () => {
    const b = await onAScene(2)
    const up = b.button('Scene 3 level up').props.onPress
    b.H.log.length = 0
    b.H.levels = false
    await b.draw({ blocks: OUTPUT, open: true })
    assert.equal(b.find((n) => said(n) === 'THIS SCENE'), null, 'the row is still up for an account the levels are closed to')
    up()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(420)
    assert.deepEqual(b.sent(), [], 'a press went for an account the levels are closed to')
    assert.equal(b.told(), 0)
  })

  test('volume: a read that comes back while a scene press is still landing does not put the older level over it', async () => {
    const b = await onAScene(2)
    /* The write takes a moment to land, and the pop-up is closed and opened inside it: the read asks the unit, which still holds +3. */
    b.unit.slow = 100
    b.H.log.length = 0
    b.button('Scene 3 level up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.draw({ blocks: OUTPUT, open: false })
    await b.draw({ blocks: OUTPUT, open: true })
    await b.draw({ blocks: OUTPUT, open: true })
    assert.ok(b.H.log.some((l) => l[0] === 'read'), 'the open did not read the block again')
    assert.equal(sceneShown(b, 3), '+4.0 dB', 'the read put scene 3’s older level over the press')
    await b.wait(520)
    assert.deepEqual(b.sent(), [['write', 46, 4, 20], ['confirmed', 46, 4, 20]])
  })

  test('volume: one scene level’s check at a time, and a check overtaken by a newer press says nothing of its own', async () => {
    /* A check that takes half a second, and a unit that holds +1.5 whatever is asked. */
    const b = await onAScene(2)
    b.unit.sceneCheckSlow = 500
    b.unit.sceneHolds = 1.5
    b.H.log.length = 0
    b.button('Scene 3 level up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(370)
    /* The first check is out; a second press, and its own wait runs out while the first is still out. */
    b.button('Scene 3 level up').props.onPress()
    await b.draw({ blocks: OUTPUT, open: true })
    await b.wait(1400)
    await b.draw({ blocks: OUTPUT, open: true })
    const checks = b.H.log.filter((l) => l[0] === 'confirmed' || l[0] === 'checked')
    assert.deepEqual(checks, [['confirmed', 46, 4, 20], ['checked', 46, 4, 20], ['confirmed', 46, 5, 20], ['checked', 46, 5, 20]], 'two checks of scene 3’s level ran at once, or the second never ran')
    assert.deepEqual(b.errors, ['Scene 3’s level didn’t take. You asked for +5.0 dB; the unit says +1.5 dB.'], 'the check overtaken by the second press spoke, or the second did not')
    assert.equal(sceneShown(b, 3), '+1.5 dB')
  })

  test('scene levels, the rules on their own: a press from what is known, a whole dB, the floor and the top; Output 1 by its id', async () => {
    const s = await import('../mobile/src/lib/sceneLevel.js')
    const p = { id: 20, name: 'Scene 3 Level', min: -20, max: 20 }
    assert.equal(s.sceneNudged(3, p, 1), 4)
    assert.equal(s.sceneNudged(3, p, -1), 2)
    assert.equal(s.sceneNudged(2.3, p, 1), 3.5, 'a press does not land on the half dB')
    assert.equal(s.sceneNudged(19.6, p, 1), 20)
    assert.equal(s.sceneNudged(-19.6, p, -1), -20)
    for (const [from, d] of [[20, 1], [-20, -1], [null, 1], [undefined, -1], [NaN, 1], ['3', 1], [3, 0], [3, 2], [3, undefined]]) assert.equal(s.sceneNudged(from, p, d), null, `${from} ${d}`)
    assert.equal(s.sceneNudged(3, { id: 20, name: 'Scene 3 Level', min: 0, max: 0 }, 1), null, 'a level with no range is stepped')
    assert.equal(s.sceneNudged(3, { name: 'Scene 3 Level', min: -20, max: 20 }, 1), null, 'a level with no setting to write is stepped')
    /* By its name, the scene the unit says. */
    const named = [{ id: 12, name: 'Level', min: -80, max: 20 }, ...Array.from({ length: 8 }, (_, i) => ({ id: 18 + i, name: `Scene ${i + 1} Level`, min: -20, max: 20, value: i }))]
    for (let i = 0; i < 8; i++) assert.equal(s.sceneLevelParam(named, i).id, 18 + i)
    for (const i of [-1, 8, 2.5, null, undefined, '2']) assert.equal(s.sceneLevelParam(named, i), null, `scene ${i}`)
    assert.equal(s.sceneLevelParam(null, 2), null)
    /* Output 1: the lowest id of an Output block that has one, wherever it is listed. */
    const chain = [{ slug: 'amp', effectId: 58 }, { slug: 'output', effectId: 44 }, { slug: 'output' }, { slug: 'output', effectId: 42 }, { slug: 'output', effectId: 43 }]
    assert.equal(s.outputOne(chain).effectId, 42)
    assert.equal(s.outputOne([{ slug: 'output' }, { slug: 'output', effectId: 43 }]).effectId, 43)
    assert.equal(s.outputOne(null), undefined)
    assert.equal(s.volumeOutput(chain, true).effectId, 42)
    /* Closed: the first Output listed, as it always was, id or none. */
    assert.equal(s.volumeOutput(chain, false).effectId, 44)
    assert.equal(s.volumeOutput([{ slug: 'output' }, { slug: 'output', effectId: 43 }], false).effectId, undefined)
    for (const v of [undefined, 1, 'yes']) assert.equal(s.volumeOutput(chain, v).effectId, 44, `${v} opens Output 1`)
    assert.equal(s.volumeOutput(null, false), undefined)
  })

  test('volume: the metronome’s room is less this scene’s row where the row is drawn, and only there', async () => {
    const room = async (levels) => {
      const b = await onAScene(2, { levels })
      b.H.window = { width: 390, height: 844 }
      b.render({ blocks: OUTPUT, open: true })
      return b.find((n) => n.type === 'ScrollView').props.style.maxHeight
    }
    /* The bench's theme has every space 8 and TAP 44: the row is its gap, its heading's line, its gap and its buttons. */
    assert.equal((await room(false)) - (await room(true)), 8 + 16 + 8 + 44, 'the scene row takes room the metronome’s part still counts as its own')
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
      ['if (!Number.isInteger(block)) {\n      noOutput(present, say)\n      return\n    }\n    const turn = settle.current.turn\n    try {', 'if (!Number.isInteger(eid)) {\n      noOutput(!!output, onError)\n      return\n    }\n    const turn = settle.current.turn\n    try {'],
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
