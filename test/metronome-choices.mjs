/**
 * THE METRONOME'S SOUND AND FLASH IN THE VOLUME POP-UP, DRAWN AND PRESSED
 * (mobile/src/components/MetronomeSwitch.js).
 *
 * "Add a feature where you can either have sound on, sound off, or you can
 * have it flash on the phone with sound or flash on the phone without sound
 * on the phone only with sound playing on the phone, or on the device only
 * playing with sound." (Justin, 16 November 2026, with the pop-up's
 * Metronome section on screen: one button, Metronome off.)
 *
 * The rules are run in test/edge-flash.mjs and the metronome itself in
 * test/mobile.mjs. This draws the component: the real file, bundled with the
 * real rules (lib/edgeFlash, the shared places, the device's word), beside
 * stand-ins for what it draws with and for the metronome's store, which
 * writes down what it is asked. So what is checked is what is on the screen
 * and what a press does, for his account, for every other, in the tempo box
 * and on a window too short for it.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const read = (p) => readFileSync(repo(p), 'utf8')

const STANDINS = `
/* What the component is told, set by the test before each draw; and everything it asks for, in order. */
export const world = {
  setting: { on: false, where: 'unit', watch: false },
  choice: { offered: false, on: true, quiet: false },
  heard: true,
  slug: 'fm3',
  bpm: 120,
  demo: false,
  bluetooth: false,
  height: 844,
  asked: [],
  answer: { ok: true }
}
export const useState = (init) => [typeof init === 'function' ? init() : init, (v) => { world.asked.push(['said', v]) }]
export const createElement = (type, props, ...children) => ({ type, props: props || {}, children })
export const Fragment = 'Fragment'
export const Platform = { select: (o) => o?.ios ?? o?.default, OS: 'ios' }
export const Text = 'Text', View = 'View'
export const useWindowDimensions = () => ({ width: 390, height: world.height })
export const color = new Proxy({}, { get: () => '#000' }), font = new Proxy({}, { get: () => 12 }), mono = {}, space = new Proxy({}, { get: () => 8 }), TAP = 44
/* Note and Press: drawn as their names, with what they were handed. */
export default 'Drawn'
/* The metronome's store. */
export const useMetronome = () => world.setting
export const useUnitHeardOn = () => world.heard
export const useEdgeFlash = () => world.choice
/* Whether the device's beat is on the unit's right now (lib/beatLock): not, unless a test says so. */
export const useInStep = () => world.inStep === true
export const setMetronome = async (...a) => { world.asked.push(['setMetronome', ...a]); return world.answer }
export const setMetronomeSound = async (...a) => { world.asked.push(['setMetronomeSound', ...a]); return world.answer }
export const setEdgeFlash = (on) => { world.asked.push(['setEdgeFlash', on]) }
export const useRig = (pick) => pick({ deviceSlug: world.slug, bpm: world.bpm })
export const useDemo = () => world.demo
export const useBluetoothOn = () => world.bluetooth
`

async function bench() {
  const { build } = await import('esbuild')
  const dir = mkdtempSync(join(tmpdir(), 'metronome-choices-'))
  try {
    const standins = join(dir, 'standins.mjs')
    const lib = repo('mobile/src/lib/')
    /* The rules it draws by, as they are: none of them reaches the phone itself. */
    const REAL = ['../lib/edgeFlash', '../lib/metronome-rules', '../lib/device-word']
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    writeFileSync(standins, STANDINS)
    writeFileSync(join(dir, 'MetronomeSwitch.js'), read('mobile/src/components/MetronomeSwitch.js'))
    await build({
      entryPoints: [join(dir, 'MetronomeSwitch.js')],
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
              if (REAL.includes(a.path)) return { path: `${lib}${a.path.replace('../lib/', '')}.js` }
              if (a.importer.startsWith(lib)) return { path: `${lib}${a.path.replace(/^\.\//, '').replace(/\.js$/, '')}.js` }
              return { path: './standins.mjs', external: true }
            })
          }
        }
      ]
    })
    const { default: MetronomeSwitch } = await import(pathToFileURL(join(dir, 'out.mjs')).href)
    const { world } = await import(pathToFileURL(standins).href)
    const all = (n, is, found = []) => {
      if (!n || typeof n !== 'object') return found
      if (Array.isArray(n)) {
        for (const c of n) all(c, is, found)
        return found
      }
      if (n.props && is(n)) found.push(n)
      all(n.children, is, found)
      all(n.props?.children, is, found)
      return found
    }
    const text = (n) => (typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join('') : n && typeof n === 'object' ? text(n.children) : '')
    return {
      world,
      /** Draw it as the world stands, and read it back: the buttons by their words, the sound row, the lines of words. */
      draw(props = {}) {
        const tree = MetronomeSwitch(props)
        const buttons = all(tree, (n) => n.type === 'Drawn' && typeof n.props.label === 'string')
        const row = all(tree, (n) => n.props.accessibilityRole === 'radiogroup')[0] || null
        const sounds = row ? all(row, (n) => typeof n.props.label === 'string') : []
        return {
          buttons,
          button: (label) => buttons.find((b) => b.props.label === label) || null,
          row,
          sounds,
          lit: sounds.filter((b) => b.props.on === true).map((b) => b.props.label),
          words: all(tree, (n) => n.type === 'Text').map(text)
        }
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const FLASH_ON = 'Flash the edge of the screen: on'
const FLASH_OFF = 'Flash the edge of the screen: off'

export function run(test) {
  test('metronome choices: for an account offered them the pop-up has the sound as one row of four words, one lit, and the flash’s own switch', async () => {
    const b = await bench()
    Object.assign(b.world, { setting: { on: true, where: 'unit', watch: false }, choice: { offered: true, on: true, quiet: false } })
    const d = b.draw()
    assert.ok(d.row, 'no sound row is drawn for an account offered the choice')
    assert.deepEqual(d.sounds.map((s) => s.props.label), ['Off', 'Unit', 'Phone', 'Both'], 'the row is not Off and then the shared rule’s places, in words')
    assert.deepEqual(d.lit, ['Unit'], 'the place the metronome is on is not the one lit')
    /* Said to a screen reader as what it is a choice of, and each the picked one or not. */
    assert.equal(d.row.props.accessibilityLabel, 'Sound')
    assert.deepEqual(d.sounds.map((s) => s.props.accessibilityLabel), ['Sound: Off', 'Sound: Unit', 'Sound: Phone', 'Sound: Both'])
    /* One row across the pop-up: each grows to its share and its word is fitted to it, at one size with the others. */
    assert.equal(d.row.props.style.flexDirection, 'row')
    for (const s of d.sounds) {
      assert.equal(s.props.grow, true)
      assert.equal(s.props.fit, true)
      assert.deepEqual([...s.props.fitWith, s.props.label].sort(), ['Both', 'Off', 'Phone', 'Unit'])
    }
    /* The flash under it, and the switch above it as it always was. */
    assert.ok(d.button(FLASH_ON), 'the flash’s switch is not in the pop-up')
    assert.equal(d.button(FLASH_ON).props.on, true)
    assert.ok(d.button('Metronome on'))
    assert.ok(d.words.includes('SOUND'), 'the row has no heading')
    /* The unit clicking with the edge lit is two clocks, alone or with the device, and the line says so. */
    assert.ok(d.words.includes('Clicks through the unit’s own outputs. The light keeps the unit’s tempo, not its exact beat.'), `the line under them: ${JSON.stringify(d.words)}`)
    b.world.setting = { on: true, where: 'both', watch: false }
    assert.ok(b.draw().words.includes('The unit clicks and the phone keeps time with it. The light keeps the unit’s tempo, not its exact beat.'), 'Both reads as if the light were on the unit’s beat')
    b.world.setting = { on: true, where: 'unit', watch: false }
  })

  test('metronome choices: a press on the row goes to the one picker with where the unit is, and the flash’s switch turns the flash', async () => {
    const b = await bench()
    Object.assign(b.world, { setting: { on: true, where: 'unit', watch: false }, choice: { offered: true, on: true, quiet: false } })
    let d = b.draw()
    for (const s of d.sounds) await s.props.onPress()
    assert.deepEqual(
      b.world.asked.filter((a) => a[0] === 'setMetronomeSound'),
      ['none', 'unit', 'phone', 'both'].map((key) => ['setMetronomeSound', key, 'fm3', { bluetooth: false, demo: false }, { start: true }]),
      'a press on the row does not pick that sound, on this unit, through the computer'
    )
    assert.ok(!b.world.asked.some((a) => a[0] === 'setMetronome'), 'a pick wrote the setting past the picker')
    d.button(FLASH_ON).props.onPress()
    assert.deepEqual(b.world.asked.at(-1), ['setEdgeFlash', false])
    b.world.choice = { offered: true, on: false, quiet: false }
    d = b.draw()
    assert.equal(d.button(FLASH_OFF).props.on, false)
    d.button(FLASH_OFF).props.onPress()
    assert.deepEqual(b.world.asked.at(-1), ['setEdgeFlash', true])
    /* The unit not taking it is said, as the switch says it. */
    b.world.answer = { ok: false }
    await d.sounds[1].props.onPress()
    assert.deepEqual(b.world.asked.at(-1), ['said', 'The unit didn’t take it. Check it’s connected, then try again.'])
    /* And a unit that has no click to switch is not a unit that failed. */
    b.world.asked.length = 0
    b.world.answer = { ok: false, unsupported: true }
    await d.sounds[1].props.onPress()
    assert.deepEqual(b.world.asked.filter((a) => a[0] === 'said'), [['said', null]])
  })

  test('metronome choices: with the sound Off, Off is lit and the line says what is left; with the flash off too, that nothing keeps time', async () => {
    const b = await bench()
    Object.assign(b.world, { setting: { on: true, where: 'phone', watch: false }, choice: { offered: true, on: true, quiet: true } })
    let d = b.draw()
    assert.deepEqual(d.lit, ['Off'], 'the device is lit under Off, though it is silent')
    assert.ok(d.words.includes('No sound. The edge of the screen lights on every beat.'), JSON.stringify(d.words))
    b.world.choice = { offered: true, on: false, quiet: true }
    d = b.draw()
    assert.ok(d.words.includes('No sound and no flash, so nothing keeps time. Pick a sound, or switch the flash on.'), JSON.stringify(d.words))
    /* No tempo yet: nothing to flash to, never "nothing to click to" with no click. */
    Object.assign(b.world, { bpm: null, choice: { offered: true, on: true, quiet: true } })
    d = b.draw()
    assert.ok(d.words.some((w) => /No tempo from the unit yet, so the phone has nothing to flash to\.$/.test(w)), JSON.stringify(d.words))
    assert.ok(!d.words.some((w) => /nothing to click to/.test(w)))
    /* And with the flash off as well there is nothing waiting on a tempo: only that nothing keeps time. */
    b.world.choice = { offered: true, on: false, quiet: true }
    d = b.draw()
    assert.ok(!d.words.some((w) => /nothing to flash to|nothing to click to/.test(w)), `a tempo is waited for with no sound and no flash: ${JSON.stringify(d.words)}`)
    assert.ok(d.words.includes('No sound and no flash, so nothing keeps time. Pick a sound, or switch the flash on.'))
    /* The metronome switched off says nothing about a tempo either. */
    Object.assign(b.world, { setting: { on: false, where: 'phone', watch: false }, choice: { offered: true, on: true, quiet: true } })
    assert.ok(!b.draw().words.some((w) => /No tempo/.test(w)))
    b.world.setting = { on: true, where: 'phone', watch: false }
    /* The device clicking with the flash switched off is not "with a flash". */
    Object.assign(b.world, { bpm: 120, choice: { offered: true, on: false, quiet: false } })
    d = b.draw()
    assert.deepEqual(d.lit, ['Phone'])
    assert.ok(d.words.includes('Clicks out loud on this phone, with no flash.'), JSON.stringify(d.words))
  })

  test('metronome choices: where the unit’s own click cannot be switched the row is Off and the device, and the device is lit whatever place is kept', async () => {
    const b = await bench()
    Object.assign(b.world, { setting: { on: true, where: 'unit', watch: false }, choice: { offered: true, on: true, quiet: false }, bluetooth: true })
    let d = b.draw()
    assert.deepEqual(d.sounds.map((s) => s.props.label), ['Off', 'Phone'])
    assert.deepEqual(d.lit, ['Phone'], 'nothing is lit over Bluetooth with Unit kept, though the device is what clicks')
    await d.sounds[0].props.onPress()
    assert.deepEqual(b.world.asked.at(-1), ['setMetronomeSound', 'none', 'fm3', { bluetooth: true, demo: false }, { start: true }])
    assert.ok(d.words.some((w) => /^Over Bluetooth/.test(w)), 'why the unit is not offered is no longer said')
    /*
     * Off over Bluetooth silences the device and nothing else: the app
     * cannot switch the unit's own click from there, so a unit that was
     * clicking still is. The line says whose sound is off, and what to do
     * about the unit, rather than "No sound" over a click in the speakers.
     */
    Object.assign(b.world, { setting: { on: true, where: 'phone', watch: false }, choice: { offered: true, on: true, quiet: true } })
    d = b.draw()
    assert.deepEqual(d.lit, ['Off'])
    assert.ok(
      d.words.includes('No sound from this phone. The edge of the screen lights on every beat. The app can’t switch the unit’s own click from here: if the unit is clicking, switch its Metronome off on the unit.'),
      `Off over Bluetooth: ${JSON.stringify(d.words)}`
    )
    Object.assign(b.world, { setting: { on: true, where: 'unit', watch: false }, choice: { offered: true, on: true, quiet: false } })
    /* In the demo the link is not Bluetooth, whatever the device has kept: the demo is why. */
    Object.assign(b.world, { demo: true })
    d = b.draw()
    await d.sounds[1].props.onPress()
    assert.deepEqual(b.world.asked.at(-1), ['setMetronomeSound', 'phone', 'fm3', { bluetooth: false, demo: true }, { start: true }])
    /* And Off there is plain No sound: the demo's unit makes none to warn about. */
    Object.assign(b.world, { setting: { on: true, where: 'phone', watch: false }, choice: { offered: true, on: true, quiet: true } })
    assert.ok(b.draw().words.includes('No sound. The edge of the screen lights on every beat.'))
    Object.assign(b.world, { setting: { on: true, where: 'unit', watch: false }, choice: { offered: true, on: true, quiet: false } })
    /* An AM4 through the computer: the same two. */
    Object.assign(b.world, { demo: false, bluetooth: false, slug: 'am4' })
    assert.deepEqual(b.draw().sounds.map((s) => s.props.label), ['Off', 'Phone'])
  })

  test('metronome choices: with the metronome off, a sound picked in the pop-up starts it, Off included; the flash’s switch never does; and the line says it is off and what starting gives', async () => {
    /*
     * Report 8be38966 (16 November 2026): Phone, Unit, Both and the flash
     * pressed with the metronome off, under a line that read as if it were
     * running, and nothing flashed.
     */
    const b = await bench()
    Object.assign(b.world, { setting: { on: false, where: 'unit', watch: false }, choice: { offered: true, on: true, quiet: false } })
    let d = b.draw()
    assert.ok(d.words.includes('The metronome is off. Tap a sound to start it. As set now, the unit clicks, with a flash.'), `the line under the row: ${JSON.stringify(d.words)}`)
    assert.ok(!d.words.some((w) => /^Clicks through|keeps time with it|tempo, not its exact beat/.test(w)), 'the line still reads as if it were running')
    /* Every pick starts it, Off among them: one call each, with `start`. */
    for (const s of d.sounds) await s.props.onPress()
    assert.deepEqual(
      b.world.asked.filter((a) => a[0] === 'setMetronomeSound').map((a) => [a[1], a[4]]),
      ['none', 'unit', 'phone', 'both'].map((key) => [key, { start: true }]),
      'a pick in the pop-up does not start the metronome'
    )
    assert.ok(!b.world.asked.some((a) => a[0] === 'setMetronome'), 'a pick started the metronome by a second write, past the picker')
    /* The flash's switch is a light, and nothing else: it starts nothing and asks nothing of the unit. */
    b.world.asked.length = 0
    d.button('Flash the edge of the screen: on').props.onPress()
    assert.deepEqual(b.world.asked, [['setEdgeFlash', false]], 'the flash’s switch did more than switch the flash')
    /* What starting gives, as things are set. */
    const line = (setting, choice, props) => {
      Object.assign(b.world, { setting: { watch: false, ...setting }, choice: { offered: true, ...choice } })
      return b.draw(props).words.filter((w) => /^The metronome is off\./.test(w))
    }
    assert.deepEqual(line({ on: false, where: 'phone' }, { on: true, quiet: true }), ['The metronome is off. Tap a sound to start it. As set now, the edge flashes, with no sound.'])
    assert.deepEqual(line({ on: false, where: 'phone' }, { on: false, quiet: true }), ['The metronome is off. Tap a sound to start it. As set now, nothing keeps time: no sound, no flash.'])
    assert.deepEqual(line({ on: false, where: 'phone' }, { on: false, quiet: false }), ['The metronome is off. Tap a sound to start it. As set now, the phone clicks, with no flash.'])
    assert.deepEqual(line({ on: false, where: 'both' }, { on: true, quiet: false }), ['The metronome is off. Tap a sound to start it. As set now, the unit and the phone click, with a flash.'])
    /* Over Bluetooth the device is what is lit, and what starts. */
    b.world.bluetooth = true
    assert.deepEqual(line({ on: false, where: 'unit' }, { on: true, quiet: false }), ['The metronome is off. Tap a sound to start it. As set now, the phone clicks, with a flash.'])
    b.world.bluetooth = false
    /* In the tempo box, and on a window too short for the row, there is no row to tap: the button above, in two lines at most. */
    for (const props of [{ compact: true, lines: 2 }, {}]) {
      if (!props.compact) b.world.height = 599
      for (const where of ['unit', 'phone', 'both']) {
        for (const quiet of [true, false]) {
          for (const on of [true, false]) {
            const said = line({ on: false, where }, { on, quiet }, props)
            assert.equal(said.length, 1, JSON.stringify(said))
            assert.match(said[0], /^The metronome is off\. Tap above to start: /)
            assert.ok(said[0].length <= 88, `${said[0].length} characters, more than two lines in the tempo box: ${said[0]}`)
          }
        }
      }
      b.world.height = 844
    }
    /* Running, it says what it does, as before. */
    assert.ok(!line({ on: true, where: 'unit' }, { on: true, quiet: false }).length)
    /* And every other account reads what it always read. */
    Object.assign(b.world, { setting: { on: false, where: 'unit', watch: false }, choice: { offered: false, on: true, quiet: false } })
    assert.ok(b.draw().words.includes('Clicks through the unit’s own outputs.'), 'another account’s line changed')
  })

  test('metronome choices: every other account, the tempo box and a window too short for them see the switch and its line, as they were', async () => {
    const b = await bench()
    const only = (d) => {
      assert.equal(d.row, null, 'the sound row is drawn')
      assert.deepEqual(d.buttons.map((x) => x.props.label), ['Metronome on'], 'more than the one switch is drawn')
    }
    /* Not offered: whatever the device has kept. */
    Object.assign(b.world, { setting: { on: true, where: 'unit', watch: false }, choice: { offered: false, on: false, quiet: false } })
    let d = b.draw()
    only(d)
    assert.ok(d.words.includes('Clicks through the unit’s own outputs.'), `another account’s line changed: ${JSON.stringify(d.words)}`)
    b.world.setting = { on: true, where: 'phone', watch: false }
    assert.ok(b.draw().words.includes('Clicks out loud on this phone, with a flash.'), 'another account’s line changed')
    /* Offered, in the tempo box: one switch and one block of words. */
    Object.assign(b.world, { setting: { on: true, where: 'unit', watch: false }, choice: { offered: true, on: true, quiet: false } })
    only(b.draw({ compact: true, lines: 2 }))
    /* Offered, in the pop-up, on a window with no room: the pop-up does not scroll, and Done must stay on the screen. */
    b.world.height = 599
    only(b.draw())
    b.world.height = 600
    assert.ok(b.draw().row, 'the row is not drawn on a window that has the room')
  })
}
