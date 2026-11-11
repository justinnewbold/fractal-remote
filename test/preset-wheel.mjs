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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
      assert.ok(steps[k].scale >= 0.5 && steps[k].opacity > 0.1, `step ${k} can still be read`)
    }
    /* Never larger than drawn: a row is scaled down, never up. */
    assert.ok(steps.every((s) => s.scale <= 1))
    assert.ok(r.WHEEL_SLOT > r.WHEEL_ROW, 'a slot is the row and the space under it')
    /* "Make the size of the preset names a little smaller": under the first wheel's 22, over the list's 15, and a row a thumb can still land on. */
    assert.ok(r.WHEEL_NAME < 22 && r.WHEEL_NAME > 15, 'the name is a little smaller than the first wheel\'s, and still the headline')
    assert.ok(r.WHEEL_ROW >= 44 && r.WHEEL_SLOT <= 64, 'a row is a thumb tall, and short enough that a small drag is a preset')
  })

  test('preset wheel: a row is never moved from where the scroll puts it, so it follows a thumb exactly', async () => {
    const r = await rules()
    /* The first wheel moved its rows toward the middle, and a preset under a thumb slid at half the thumb's speed: "very clunky". */
    const c = r.wheelCurve(7)
    assert.deepEqual(Object.keys(c).sort(), ['input', 'opacity', 'scale'], 'the scroll tells a row how big and how bright, and nothing else')
    assert.equal(r.WHEEL_PLACES, undefined, 'rows are placed again')
    /* What the animation is handed: an input that only rises, and as many outputs as inputs. */
    assert.ok(c.input.every((x, i) => i === 0 || x > c.input[i - 1]), 'the input rises')
    for (const out of [c.scale, c.opacity]) assert.equal(out.length, c.input.length)
    /* Full size exactly where the row is in the middle, and the same either side of it. */
    const mid = (c.input.length - 1) / 2
    assert.equal(c.input[mid], r.wheelOffset(7))
    assert.deepEqual([c.scale[mid], c.opacity[mid]], [1, 1])
    for (let k = 1; k <= mid; k += 1) {
      assert.equal(c.scale[mid - k], c.scale[mid + k])
      assert.equal(c.opacity[mid - k], c.opacity[mid + k])
      assert.equal(c.input[mid + k] - c.input[mid], k * r.WHEEL_SLOT, 'a step is one slot of scroll')
    }

    const wheel = flat(read('mobile/src/components/PresetWheel.js'))
    assert.doesNotMatch(wheel, /translateY|translateX/, 'the wheel moves a row')
    assert.match(wheel, /transform: \[\{ scale: drawn\.scale \}\]/, 'a row is only drawn smaller')
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
    assert.match(presets, /renderItem=\{\(\{ item: n \}\) => rowOf\(n\)\}/, 'the list draws its own row')
    assert.match(presets, /row=\{\(n\) => rowOf\(n, true\)\}/, 'the wheel draws its own')
    /*
     * "Let's make sure we don't touch the other ones": the list's row is
     * the button and the star it was before there was a wheel, at its own
     * height and gap, with nothing of the wheel's in it. The wheel's is
     * returned before it, and is another component.
     */
    const row = presets.slice(presets.indexOf('const rowOf = (n, tall = false) =>'), presets.indexOf('const emptyRows ='))
    const wheels = row.slice(row.indexOf('if (tall) {'), row.indexOf('return ( <View style='))
    const lists = row.slice(row.indexOf('return ( <View style='))
    assert.ok(wheels.length > 200 && lists.length > 400, 'the two rows are not where this looks for them')
    assert.match(wheels, /^if \(tall\) \{ return \( <WheelPreset /)
    assert.match(lists, /^return \( <View style=\{\{ flexDirection: 'row', gap: space\.sm, height: ROW, marginBottom: GAP \}\}> (?:\{ \} )?<Press grow height=\{ROW\} /)
    assert.doesNotMatch(lists, /tall|WHEEL_|WheelPreset|labelSize|\bfit\b/, 'something of the wheel\'s is in the list\'s row')
    assert.match(lists, /bar flat style=\{tagEdge\(tag\)\} \/> <Star on=\{starred\}/)
    /* The list's hooks are made where both branches run, or choosing the wheel would change how many there are. */
    assert.doesNotMatch(presets, /viewabilityConfig=\{useRef\(/, 'no hook inside the branch the wheel replaces')
  })

  test('preset wheel: nothing loads until a row is tapped, and a row does what it does in the list', () => {
    const wheel = code(read('mobile/src/components/PresetWheel.js'))
    assert.doesNotMatch(wheel, /loadPreset|lib\/rig|lib\/device|lib\/lists/, 'the wheel draws and scrolls; it never loads, stars or saves')
    const presets = flat(read('mobile/src/screens/Presets.js'))
    /* The same words, press, hold and star, once for each row: the list's, and the wheel's beside it. */
    const twice = (what, pattern) => assert.equal(presets.match(pattern)?.length, 2, `${what} is not the same for the list and the wheel`)
    twice('the press', /loadPreset\(n\) if \(!stay\) onBack\?\.\(\)/g)
    twice('the name', /=\{typeof name === 'string' \? \(name \|\| 'Empty'\) : `Slot \$\{slotLabel\(n, addressing\)\}`\}/g)
    twice('the line under it', /=\{here \? `\$\{slotLabel\(n, addressing\)\} · Playing` : slotLabel\(n, addressing\)\}/g)
    twice('the hold', /onLongPress=\{addOpen \? \(\) => hold\(\{ n, words, target \}\) : target \? \(\) => setPainting\(target\) : undefined\}/g)
    twice('the hold\'s hint', /=\{addOpen \? ADD_WORDS\.hint : target \? TAG_HOLD\.hint : undefined\}/g)
    twice('the star\'s words', /=\{`\$\{starred \? 'Unstar' : 'Star'\} \$\{name \|\| `slot \$\{slotLabel\(n, addressing\)\}`\}`\}/g)
    twice('the star', /=\{\(\) => toggleFavourite\(device, n\)\}/g)
    assert.equal(presets.match(/loadPreset\(/g)?.length, 2, 'a third thing on this screen loads a preset')
  })

  test('preset wheel: a preset on the wheel is a name with no box round it, and its star is the star alone', () => {
    const src = read('mobile/src/components/PresetWheel.js')
    const preset = flat(src.slice(src.indexOf('export function WheelPreset(')))
    /* "Remove the boxes around the outside edge of the presets." */
    assert.doesNotMatch(preset, /borderWidth|borderColor|boxShadow|glass|<Press\b|radius\./, 'a box is back round a preset on the wheel')
    assert.equal(preset.match(/backgroundColor/g)?.length, 1, 'the only fill is the colour tag\'s short bar')
    assert.match(preset, /\{bar \? <View style=\{\{ width: 4, height: WHEEL_ROW - 22, borderRadius: 2, backgroundColor: bar \}\} \/> : null\}/)
    assert.match(preset, /fontSize: WHEEL_NAME, fontWeight: '700'/, 'the name is the wheel\'s own size')
    assert.match(preset, /numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.7\}/, 'a long name is drawn smaller before it is cut')
    assert.match(preset, /const ink = here \? color\.signal : color\.silk/, 'the one being played is amber, as its row in the list is')
    /* It does what it is handed, with the tap you feel, and writes the press down as every button does. */
    assert.match(preset, /onPress=\{\(\) => \{ thud\(\) fire\(`press \$\{said\(label\)\}`, onPress\) \}\}/)
    assert.match(preset, /onLongPress=\{ onLongPress \? \(\) => \{ thud\(\) fire\(`hold \$\{said\(label\)\}`, onLongPress\) \} : undefined \}/)
    assert.match(preset, /onPress=\{\(\) => \{ tick\(\) onStar\?\.\(\) \}\}/)
    /* The star on a thumb's worth of its own, away from the part that loads the preset. */
    assert.match(src, /const WHEEL_END = 44\b/)
    assert.match(preset, /width: WHEEL_END, height: WHEEL_ROW, alignItems: 'center', justifyContent: 'center'/)

    const wheel = flat(src.slice(0, src.indexOf('export function WheelPreset(')))
    /* Two faint lines mark the middle slot, never in the way of a press, and not in the glass (Classic has none). */
    assert.match(wheel, /<View pointerEvents="none" style=\{\{ position: 'absolute', left: space\.lg, right: space\.lg, top: room \/ 2 - WHEEL_SLOT \/ 2, height: WHEEL_SLOT, borderTopWidth: 1, borderBottomWidth: 1, borderColor: color\.rule \}\} \/>/)
    /* Driven straight from the scroll, so it keeps up with a thumb, and it stops on a row. */
    assert.match(wheel, /Animated\.event\(\[\{ nativeEvent: \{ contentOffset: \{ y \} \} \}\], \{ useNativeDriver: true, listener: scrolled \}\)/)
    assert.match(wheel, /snapToInterval=\{WHEEL_SLOT\}/, 'it stops on a row')
    assert.match(wheel, /getItemLayout=\{\(_, i\) => \(\{ length: WHEEL_SLOT, offset: WHEEL_SLOT \* i, index: i \}\)\}/)
  })

  test('preset wheel: it clicks only under a thumb or its flick, and only where the tick box says so', () => {
    const wheel = flat(read('mobile/src/components/PresetWheel.js'))
    assert.match(wheel, /onScrollBeginDrag=\{\(\) => \{ dragging\.current = true moving\.current = true \}\}/)
    /* A thumb that pauses on the glass and carries on is one drag: it keeps clicking, and stops only once the thumb is up and the flick has run out. */
    assert.match(wheel, /onScrollEndDrag=\{\(\) => \{ dragging\.current = false settle\(\) \}\}/)
    assert.match(wheel, /if \(!dragging\.current\) moving\.current = false/, 'a pause under the thumb ends the clicks for the rest of the drag')
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

  test('preset wheel: the click sounds when the name crosses the line: a player rewound ahead of its turn, and the sound kept awake', async () => {
    /* "Doesn't match up with the clicks properly": the first try rewound a player and played it in one breath, and let the device's sound sleep between clicks. */
    const dir = mkdtempSync(join(tmpdir(), 'wheel-click-'))
    const bench = async (os) => {
      const files = {
        'package.json': '{ "type": "module" }',
        'audio.js': `
          export const said = []
          export const made = []
          export const createAudioPlayer = (src, opts = {}) => {
            const id = made.length
            const p = { id, src, opts, volume: 1, at: 0, seekTo: async () => { said.push('seek ' + id); p.at = 0 }, play() { said.push('play ' + id + (p.at ? ' (not rewound)' : '')); p.at = 1 }, remove() { said.push('gone ' + id) } }
            made.push(p)
            return p
          }
          export const setAudioModeAsync = async (m) => { said.push('mode ' + JSON.stringify(m)) }
          export const setIsAudioActiveAsync = async (on) => { said.push('session ' + on) }
        `,
        'haptics.js': 'export let taps = 0\nexport const selectionAsync = async () => { taps++ }\n',
        'rn.js': `export const Platform = { OS: ${JSON.stringify(os)} }\n`,
        'click.js': 'export default "click"\n',
        'click-pad.js': 'export default "click-pad"\n',
        'audioMode.js': read('mobile/src/lib/audioMode.js'),
        'wheelClick.js': read('mobile/src/lib/wheelClick.js')
          .replace("from 'react-native'", "from './rn.js'")
          .replace("from 'expo-audio'", "from './audio.js'")
          .replace("from 'expo-haptics'", "from './haptics.js'")
          .replace("from '../../assets/click.wav'", "from './click.js'")
          .replace("from '../../assets/click-pad.wav'", "from './click-pad.js'")
          .replace("from './audioMode'", "from './audioMode.js'")
      }
      const sub = join(dir, os)
      mkdirSync(sub)
      for (const [name, text] of Object.entries(files)) writeFileSync(join(sub, name), text)
      const at = (f) => pathToFileURL(join(sub, f)).href
      return { click: await import(at('wheelClick.js')), audio: await import(at('audio.js')), haptics: await import(at('haptics.js')), mode: await import(at('audioMode.js')) }
    }
    try {
      const ios = await bench('ios')
      ios.click.wheelClick()
      assert.equal(ios.haptics.taps, 1, 'the tap is felt even with no sound loaded')
      assert.deepEqual(ios.audio.said, [], 'a sound before a wheel has opened')

      ios.click.openWheelClick()
      assert.equal(ios.audio.made.length, 4, 'four players take turns on an iPhone')
      assert.ok(ios.audio.made.every((p) => p.src === 'click' && p.opts.keepAudioSessionActive === true && p.volume < 1), 'the sound is kept awake between clicks, and quiet')
      assert.deepEqual(ios.audio.said, ['mode {"playsInSilentMode":false,"interruptionMode":"mixWithOthers"}'])
      ios.audio.said.length = 0
      for (let i = 0; i < 12; i += 1) ios.click.wheelClick()
      const plays = ios.audio.said.filter((x) => x.startsWith('play'))
      assert.equal(plays.length, 12)
      assert.ok(plays.every((x) => !/not rewound/.test(x)), `a player was played from its end: ${plays.join(', ')}`)
      /* Played first, and only then another one rewound: never a seek in front of the click it would delay. */
      for (let i = 0; i < ios.audio.said.length; i += 2) {
        const [play, seek] = [ios.audio.said[i], ios.audio.said[i + 1]]
        assert.match(play, /^play \d$/)
        assert.match(seek, /^seek \d$/)
        assert.notEqual(play.slice(5), seek.slice(5), 'the player that is sounding is rewound under itself')
      }
      /* Two wheels on screen share the players, and the last to close lets them and the sound go. */
      ios.click.openWheelClick()
      assert.equal(ios.audio.made.length, 4)
      ios.audio.said.length = 0
      ios.click.closeWheelClick()
      assert.deepEqual(ios.audio.said, [])
      ios.click.closeWheelClick()
      await new Promise((r) => setImmediate(r))
      assert.deepEqual(ios.audio.said, ['gone 0', 'gone 1', 'gone 2', 'gone 3', 'session false'])
      /* With the metronome's mode in force, the wheel neither sets its own nor puts the device's sound to sleep under it. */
      ios.mode.markLoud()
      ios.audio.said.length = 0
      ios.click.openWheelClick()
      ios.click.closeWheelClick()
      await new Promise((r) => setImmediate(r))
      assert.ok(!ios.audio.said.some((x) => x.startsWith('mode') || x.startsWith('session')), `the wheel changed the metronome's sound: ${ios.audio.said.join(', ')}`)

      const android = await bench('android')
      android.click.openWheelClick()
      assert.equal(android.audio.made.length, 1, 'one player on Android')
      assert.equal(android.audio.made[0].src, 'click-pad', 'Android\'s fade-in takes the click with it')
      android.audio.said.length = 0
      android.click.wheelClick()
      android.click.wheelClick()
      assert.deepEqual(android.audio.said, ['seek 0', 'play 0', 'seek 0', 'play 0'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
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
