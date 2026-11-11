/**
 * ALL PRESETS AS A WHEEL, A CHOICE BESIDE THE LIST
 * (mobile/src/lib/presetWheel.js, lib/usePresetWheel.js, lib/wheelClick.js,
 * lib/audioMode.js, components/PresetWheel.js, screens/Presets.js,
 * screens/Settings.js).
 *
 * "Can we do preset scrolling option a as a setting? So we can have both
 * the original and that one." (Justin, 11 November 2026.) The preset in the
 * middle big and bright, the rest shrinking and fading away from it, and a
 * click and a small tap as each one crosses the middle. His account until
 * features PRESET_WHEEL_FOR_EVERYONE; for every other account, and for a
 * device that has not chosen it, All presets is the list it always was.
 *
 * The rule file imports nothing and is run as it is. The rest is read for
 * how it is wired: nothing here can scroll a list.
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

/** A rule file that imports nothing, run from a copy. */
async function alone(path) {
  const dir = mkdtempSync(join(tmpdir(), 'preset-wheel-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    const src = read(path)
    assert.doesNotMatch(src, /^import /m, `${path} imports something; this check runs it on its own`)
    writeFileSync(join(dir, 'rule.js'), src)
    return await import(pathToFileURL(join(dir, 'rule.js')).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
const rules = () => alone('mobile/src/lib/presetWheel.js')

const storage = (start = {}) => {
  const kept = new Map(Object.entries(start))
  return { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => kept.set(k, String(v)), removeItem: (k) => kept.delete(k) }
}

export function run(test) {
  test('preset wheel: his account only until its switch, and the switch is off', async () => {
    const r = await rules()
    assert.equal(r.presetWheelOn({ admin: true, everyone: false }), true)
    assert.equal(r.presetWheelOn({ admin: false, everyone: false }), false)
    assert.equal(r.presetWheelOn({ admin: false, everyone: true }), true)
    assert.equal(r.presetWheelOn(), false)
    /* Truthy is not yes: only true opens it. */
    assert.equal(r.presetWheelOn({ admin: 'yes', everyone: 1 }), false)

    const features = code(read('mobile/src/lib/features.js'))
    assert.match(features, /export const PRESET_WHEEL_FOR_EVERYONE = false\b/, 'the wheel opens to everyone only when Justin says so')
    const hook = flat(read('mobile/src/lib/usePresetWheel.js'))
    assert.match(hook, /presetWheelOn\(\{ admin: useBluetoothAdmin\(\), everyone: PRESET_WHEEL_FOR_EVERYONE \}\)/, 'the hook asks the rule with the kept sign-in and the switch')
  })

  test('preset wheel: a device has the list until somebody chooses the wheel, and each half of the choice is kept on its own', async () => {
    const r = await rules()
    assert.deepEqual(r.wheelSetting(storage()), { on: false, clicks: true })
    /* Anything unreadable is the default, never a wheel nobody chose. */
    for (const junk of ['', 'nonsense', '[]', '"on"', '{"on":"yes","clicks":0}', 'null']) {
      assert.deepEqual(r.wheelSetting(storage({ [r.WHEEL_KEY]: junk })), { on: false, clicks: true }, junk)
    }
    assert.deepEqual(r.wheelSetting(null), { on: false, clicks: true })

    const kept = storage()
    assert.deepEqual(r.saveWheel({ on: true }, kept), { on: true, clicks: true })
    assert.deepEqual(r.saveWheel({ clicks: false }, kept), { on: true, clicks: false })
    assert.deepEqual(r.wheelSetting(kept), { on: true, clicks: false })
    assert.deepEqual(r.saveWheel({ on: false }, kept), { on: false, clicks: false })
    /* A patch that says nothing changes nothing. */
    assert.deepEqual(r.saveWheel({ on: 'true', clicks: null }, kept), { on: false, clicks: false })
    /* The phone's storage only carries keys that start `fractal.`. */
    assert.match(r.WHEEL_KEY, /^fractal\./)
  })

  test('preset wheel: the middle row is full size and bright, and each step away is smaller and fainter', async () => {
    const r = await rules()
    const steps = r.WHEEL_STEPS
    assert.ok(steps.length >= 4, 'the middle and at least three steps either side, as the picture he chose')
    assert.deepEqual([steps[0].scale, steps[0].opacity], [1, 1], 'the middle is the row as it is drawn')
    for (let k = 1; k < steps.length; k += 1) {
      assert.ok(steps[k].scale < steps[k - 1].scale, `step ${k} is smaller than the one before`)
      assert.ok(steps[k].opacity < steps[k - 1].opacity, `step ${k} is fainter than the one before`)
      assert.ok(steps[k].scale > 0.3 && steps[k].opacity > 0.1, `step ${k} can still be read`)
      assert.ok(steps[k].gap >= 4, `step ${k} leaves a gap`)
    }
    /* Never larger than drawn: a row is scaled down, never up. */
    assert.ok(steps.every((s) => s.scale <= 1))
    assert.ok(r.WHEEL_SLOT > r.WHEEL_ROW, 'a slot is the row and the space under it')
    /* A thumb's worth even one step from the middle. */
    assert.ok(steps[1].scale * r.WHEEL_ROW >= 56, 'the row beside the middle is still a full tap tall')
  })

  test('preset wheel: rows close up without ever touching, at every step and at every place between two steps', async () => {
    const r = await rules()
    const { WHEEL_STEPS: steps, WHEEL_PLACES: places, WHEEL_ROW: row, WHEEL_SLOT: slot } = r
    assert.equal(places.length, steps.length)
    assert.equal(places[0], 0)
    for (let k = 1; k < steps.length; k += 1) {
      const gap = places[k] - places[k - 1] - (steps[k].scale * row) / 2 - (steps[k - 1].scale * row) / 2
      assert.ok(Math.abs(gap - steps[k].gap) < 1e-9, `step ${k} sits its own gap from the one before`)
      assert.ok(places[k] <= k * slot, `step ${k} is drawn no further out than it is laid out`)
    }

    /* The curve for one row, walked through a scroll in small steps, against its neighbour's. */
    const at = (curve, y, values, extend) => {
      const x = curve.input
      if (y <= x[0]) return extend ? values[0] + ((values[1] - values[0]) / (x[1] - x[0])) * (y - x[0]) : values[0]
      const n = x.length - 1
      if (y >= x[n]) return extend ? values[n] + ((values[n] - values[n - 1]) / (x[n] - x[n - 1])) * (y - x[n]) : values[n]
      let i = 0
      while (y > x[i + 1]) i += 1
      return values[i] + ((values[i + 1] - values[i]) / (x[i + 1] - x[i])) * (y - x[i])
    }
    const drawn = (index, y) => {
      const c = r.wheelCurve(index)
      const scale = at(c, y, c.scale, false)
      /* Where its middle is on screen, from the middle of the room: laid out (index × slot − y) away, and moved by its shift. */
      const centre = index * slot - y + at(c, y, c.shift, true)
      return { top: centre - (scale * row) / 2, bottom: centre + (scale * row) / 2, scale }
    }
    for (let y = 40 * slot; y <= 42 * slot; y += slot / 16) {
      for (let i = 28; i < 54; i += 1) {
        const a = drawn(i, y)
        const b = drawn(i + 1, y)
        assert.ok(b.top - a.bottom >= 4, `rows ${i} and ${i + 1} keep apart at ${y} (${(b.top - a.bottom).toFixed(2)})`)
        assert.ok(b.top - a.bottom <= 12, `rows ${i} and ${i + 1} leave no hole at ${y} (${(b.top - a.bottom).toFixed(2)})`)
      }
    }
    /* In the middle a row is exactly where it is laid out, at full size. */
    const mid = drawn(41, 41 * slot)
    assert.ok(Math.abs(mid.top + row / 2) < 1e-9 && mid.scale === 1)

    /* What the animation is handed: an input that only rises, and as many outputs as inputs. */
    const c = r.wheelCurve(7)
    assert.ok(c.input.every((x, i) => i === 0 || x > c.input[i - 1]), 'the input rises')
    for (const out of [c.scale, c.opacity, c.shift]) assert.equal(out.length, c.input.length)
    /* Past its place the row is above the middle and is moved down; before it, up. */
    assert.ok(c.shift[c.shift.length - 1] > 0 && c.shift[0] < 0)
    assert.equal(c.shift[(c.shift.length - 1) / 2], 0)
  })

  test('preset wheel: row i is in the middle at i slots, and the middle row is never past either end', async () => {
    const r = await rules()
    const slot = r.WHEEL_SLOT
    assert.equal(r.wheelOffset(0), 0)
    assert.equal(r.wheelOffset(99), 99 * slot)
    assert.equal(r.wheelOffset(-3), 0)
    assert.equal(r.wheelOffset(undefined), 0)
    for (const i of [0, 1, 99, 511]) assert.equal(r.wheelCentre(r.wheelOffset(i), 512), i)
    /* Nearer the next row than this one: the next row. */
    assert.equal(r.wheelCentre(10 * slot + slot / 2 - 1, 512), 10)
    assert.equal(r.wheelCentre(10 * slot + slot / 2 + 1, 512), 11)
    /* A list pulled past its ends (iOS bounces) is still on its first or last row. */
    assert.equal(r.wheelCentre(-200, 512), 0)
    assert.equal(r.wheelCentre(9e6, 512), 511)
    assert.equal(r.wheelCentre(0, 0), -1)
    assert.equal(r.wheelCentre(NaN, 4), 0)
    /* Half the room over the first row, so it can reach the middle; never less than nothing. */
    assert.equal(r.wheelPad(600), (600 - slot) / 2)
    assert.equal(r.wheelPad(40), 0)
    assert.equal(r.wheelPad(undefined), 0)
  })

  test('preset wheel: the names asked for are the rows around the middle, inside the list', async () => {
    const r = await rules()
    assert.deepEqual(r.wheelAround(5, 512, 2), [3, 4, 5, 6, 7])
    assert.deepEqual(r.wheelAround(0, 512, 2), [0, 1, 2])
    assert.deepEqual(r.wheelAround(511, 512, 2), [509, 510, 511])
    assert.deepEqual(r.wheelAround(1, 2, 10), [0, 1])
    assert.deepEqual(r.wheelAround(-1, 0), [])
    assert.deepEqual(r.wheelAround(3, 0), [])
    assert.equal(r.wheelAround(200, 512).length, 2 * r.WHEEL_REACH + 1)
    /* Each name is a read of the unit: a couple of dozen at rest, never hundreds. */
    assert.ok(r.WHEEL_REACH >= 6 && r.WHEEL_REACH <= 16)
  })

  test('preset wheel: a flick is a purr, not a click for every preset', async () => {
    const r = await rules()
    assert.equal(r.clickDue(1000, 0), true, 'the first is always due')
    assert.equal(r.clickDue(1000, 1000 - r.WHEEL_CLICK_GAP_MS), true)
    assert.equal(r.clickDue(1000, 1000 - r.WHEEL_CLICK_GAP_MS + 1), false)
    assert.ok(r.WHEEL_CLICK_GAP_MS >= 20 && r.WHEEL_CLICK_GAP_MS <= 60, 'between a buzz and a stutter')
    assert.ok(r.WHEEL_REST_MS >= 80 && r.WHEEL_REST_MS <= 400)
  })

  test('preset wheel: the list is untouched for an account the wheel is not offered to, and for a device that has not chosen it', () => {
    const presets = flat(read('mobile/src/screens/Presets.js'))
    assert.match(presets, /const wheelOffered = usePresetWheelOffered\(\)/)
    assert.match(presets, /const wheel = wheelOffered && wheelKept\.on\b/, 'offered AND chosen, or it is the list')
    /* One or the other, by that one answer. */
    assert.match(presets, /\{wheel \? \( <PresetWheel [^]*?\/> \) : \( <FlatList /, 'the wheel is drawn in the list\'s place, never beside it')
    /* The list's rows are what they were: its own height, its own gap, no fitted name. */
    assert.match(presets, /renderItem=\{\(\{ item: n \}\) => rowOf\(n\)\}/, 'the list draws the row as it is')
    assert.match(presets, /row=\{\(n\) => rowOf\(n, true\)\}/, 'the wheel draws the same row, tall')
    assert.match(presets, /const rowOf = \(n, tall = false\) =>/)
    assert.match(presets, /const tallRow = tall \? WHEEL_ROW : ROW\b/)
    assert.match(presets, /marginBottom: tall \? 0 : GAP\b/)
    assert.match(presets, /labelSize=\{tall \? WHEEL_NAME : undefined\}/)
    assert.match(presets, /fit=\{tall \|\| undefined\}/)
    /* The list's hooks are made where both branches run, or choosing the wheel would change how many there are. */
    assert.doesNotMatch(presets, /viewabilityConfig=\{useRef\(/, 'no hook inside the branch the wheel replaces')
  })

  test('preset wheel: nothing loads until a row is tapped, and a row does what it does in the list', () => {
    const wheel = code(read('mobile/src/components/PresetWheel.js'))
    assert.doesNotMatch(wheel, /loadPreset|lib\/rig|lib\/device|lib\/lists/, 'the wheel lays rows out; it never loads, stars or saves')
    const presets = read('mobile/src/screens/Presets.js')
    /* One row for both, so its press, hold and star cannot differ: one loadPreset in the whole screen. */
    assert.equal(code(presets).match(/loadPreset\(n\)/g)?.length, 1)
    assert.equal(code(presets).match(/<Star\b/g)?.length, 1)
  })

  test('preset wheel: a row drawn away from its place can still be seen and pressed', () => {
    const wheel = flat(read('mobile/src/components/PresetWheel.js'))
    assert.match(wheel, /removeClippedSubviews=\{false\}/, 'Android would take out the small rows drawn in from beyond the edges')
    assert.match(wheel, /CellRendererComponent=\{Cell\}/)
    assert.match(wheel, /function Cell\([^)]*\) \{ return \( <View style=\{style\} onLayout=\{onLayout\} pointerEvents="box-none">/, 'a row\'s place is never what a finger lands on')
    assert.match(wheel, /<Animated\.View pointerEvents="box-none" style=\{\{ height: WHEEL_SLOT\b/, 'nor is the row\'s own slot')
    assert.match(wheel, /pointerEvents="none" style=\{\{ position: 'absolute'/, 'the bright edge is never in the way of a press')
    /* Driven straight from the scroll, so it keeps up with a thumb. */
    assert.match(wheel, /Animated\.event\(\[\{ nativeEvent: \{ contentOffset: \{ y \} \} \}\], \{ useNativeDriver: true, listener: scrolled \}\)/)
    assert.match(wheel, /snapToInterval=\{WHEEL_SLOT\}/, 'it stops on a row')
    assert.match(wheel, /getItemLayout=\{\(_, i\) => \(\{ length: WHEEL_SLOT, offset: WHEEL_SLOT \* i, index: i \}\)\}/)
    const presets = flat(read('mobile/src/screens/Presets.js'))
    assert.match(presets, /<View pointerEvents=\{tall \? 'box-none' : undefined\}/, 'on the wheel only the button and the star take a press')
  })

  test('preset wheel: it clicks only under a thumb or its flick, and only where the tick box says so', () => {
    const wheel = flat(read('mobile/src/components/PresetWheel.js'))
    assert.match(wheel, /onScrollBeginDrag=\{\(\) => \{ moving\.current = true \}\}/)
    assert.match(wheel, /if \(!moving\.current \|\| !clicking\.current\) return/, 'a jump the app makes is not somebody turning the wheel')
    assert.match(wheel, /if \(!clickDue\(now, lastClick\.current\)\) return/)
    assert.match(wheel, /if \(!clicks\) return undefined openWheelClick\(\) return closeWheelClick/, 'no sound is loaded for a wheel that does not click')
    const presets = flat(read('mobile/src/screens/Presets.js'))
    assert.match(presets, /clicks=\{wheelKept\.clicks\}/)
  })

  test('preset wheel: its click is quiet, mixes with what is playing, and never takes the metronome out of silent mode', async () => {
    const click = flat(read('mobile/src/lib/wheelClick.js'))
    assert.match(click, /if \(!isLoud\(\)\) setAudioModeAsync\(\{ playsInSilentMode: false, interruptionMode: 'mixWithOthers' \}\)/, 'silent when the device is, over a backing track, and only while the metronome has not asked otherwise')
    assert.match(click, /Haptics\.selectionAsync\(\)/, 'the system\'s own picker tap')
    assert.match(click, /const VOLUME = 0\.\d+/, 'quieter than the metronome\'s beat')
    assert.match(click, /player\.volume = VOLUME/)
    assert.match(click, /player\.remove\(\)/, 'let go when the wheel closes')

    const metronome = flat(read('mobile/src/lib/metronome.js'))
    assert.match(metronome, /markLoud\(\) await setAudioModeAsync\(\{ playsInSilentMode: true, interruptionMode: 'mixWithOthers' \}\)/, 'the metronome says it has spoken before it sets its mode')

    const mode = await alone('mobile/src/lib/audioMode.js')
    assert.equal(mode.isLoud(), false)
    mode.markLoud()
    assert.equal(mode.isLoud(), true)
  })

  test('preset wheel: the choice is on Tiles & scenes, only for an account it is offered to, and says nothing loads', async () => {
    const r = await rules()
    const settings = flat(read('mobile/src/screens/Settings.js'))
    assert.match(settings, /\{wheelOffered \? \( <> <Section>\{WHEEL_WORDS\.section\}<\/Section>/, 'nothing is drawn for an account it is not offered to')
    assert.match(settings, /<Choice role="radio" on=\{!wheel\.on\} label=\{WHEEL_WORDS\.list\}[^>]*onPress=\{\(\) => saveWheel\(\{ on: false \}, sync\)\} \/>/)
    assert.match(settings, /<Choice role="radio" on=\{wheel\.on\} label=\{WHEEL_WORDS\.wheel\}[^>]*onPress=\{\(\) => saveWheel\(\{ on: true \}, sync\)\} \/>/)
    assert.match(settings, /\{wheel\.on \? \( <Choice on=\{wheel\.clicks\} label=\{WHEEL_WORDS\.clicks\}/, 'the click\'s tick box only while the wheel is chosen')

    const words = Object.values(r.WHEEL_WORDS).join(' ')
    assert.match(r.WHEEL_WORDS.wheelSub, /Nothing loads until you tap one\./)
    assert.match(r.WHEEL_WORDS.clicksSub, /silent mode/)
    /* The house rules for words on a screen. */
    assert.doesNotMatch(words, /this phone|your phone|\bbeta\b|\btried\b|official|iPod/i)
  })
}
