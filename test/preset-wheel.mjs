/**
 * ALL PRESETS AS A WHEEL, A CHOICE BESIDE THE LIST
 * (mobile/src/lib/presetWheel.js, lib/usePresetWheel.js, lib/wheelClick.js,
 * lib/audioMode.js, components/PresetWheel.js, screens/Presets.js,
 * screens/Settings.js).
 *
 * "Can we do preset scrolling option a as a setting? So we can have both
 * the original and that one." (Justin, 11 November 2026.) Made three times
 * on his phone's word; the third is a real click wheel: a ring to run a
 * thumb round, a bar that moves one preset a notch with a click and a tap,
 * and a middle button that loads the preset under the bar. His account
 * until features PRESET_WHEEL_FOR_EVERYONE; for every other account, and
 * for a device that has not chosen it, All presets is the list it always
 * was.
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

  test('preset wheel: a turn of the ring is notches, the same from anywhere on it, and crossing nine o’clock is not a spin backward', async () => {
    const r = await rules()
    assert.equal(360 / r.WHEEL_NOTCH_DEG, 24, 'twenty-four notches to a turn')
    /* Where a touch is round the middle: 0 at three o'clock, rising clockwise on a screen. */
    assert.equal(r.wheelAngle(10, 0), 0)
    assert.equal(r.wheelAngle(0, 10), 90)
    assert.equal(Math.abs(r.wheelAngle(-10, 0)), 180)
    assert.equal(r.wheelAngle(0, -10), -90)
    /* The short way round, signed: clockwise is positive. */
    assert.equal(r.wheelTurn(10, 40), 30)
    assert.equal(r.wheelTurn(40, 10), -30)
    assert.equal(r.wheelTurn(170, -170), 20, 'through nine o’clock clockwise')
    assert.equal(r.wheelTurn(-170, 170), -20, 'and back')
    /* On the ring: outside the middle button, not past the rim. */
    assert.equal(r.onWheelRing(100, 0, 125, 48), true)
    assert.equal(r.onWheelRing(10, 10, 125, 48), false, 'the middle button is not the ring')
    assert.equal(r.onWheelRing(130, 0, 125, 48), false)

    /* Slow turning adds up: seven and a half degrees twice is one notch, and nothing is lost between moves. */
    let s = r.wheelSpinStart(0, 0)
    let out = r.wheelSpin(s, 7.5, 300)
    assert.deepEqual([out.notches, out.moves], [0, 0])
    out = r.wheelSpin(out.state, 15, 600)
    assert.deepEqual([out.notches, out.moves], [1, 1])
    /* The same turn is the same notches wherever on the ring it starts. */
    for (const from of [-170, -90, 0, 90, 170]) {
      const turned = r.wheelSpin(r.wheelSpinStart(from, 0), ((from + 45 + 180) % 360) - 180, 500)
      assert.deepEqual([turned.notches, turned.moves], [3, 3], `from ${from}`)
    }
    /* Anticlockwise goes back up the list. */
    out = r.wheelSpin(r.wheelSpinStart(0, 0), -30, 500)
    assert.deepEqual([out.notches, out.moves], [-2, -2])
  })

  test('preset wheel: slowly it is one preset a notch, and a long fast spin gears up so five hundred presets are a few turns', async () => {
    const r = await rules()
    const spinFor = (notches, every, { from = 0, at = 0, state = null, t = 0 } = {}) => {
      let s = state || r.wheelSpinStart(0, t)
      let angle = 0
      let where = from
      let now = t
      let clicks = 0
      for (let i = 0; i < notches; i += 1) {
        now += every
        angle += r.WHEEL_NOTCH_DEG
        const out = r.wheelSpin(s, ((angle + 180) % 360) - 180, now)
        s = out.state
        if (out.moves) clicks += 1
        where = r.wheelMove(where, out.moves, 512)
      }
      return { where, state: s, now, clicks }
    }
    /* Slow: a notch is a preset, for as long as you like. */
    const slow = spinFor(60, 200)
    assert.equal(slow.where, 60)
    assert.equal(slow.clicks, 60, 'a click for every notch')
    assert.equal(slow.state.run, 0)
    /* Fast: the first turn is still about one a notch, then it gears up, and four turns reach the far end of 512. */
    const oneTurn = spinFor(24, 30)
    assert.ok(oneTurn.where >= 24 && oneTurn.where <= 30, `the first fast turn runs away: ${oneTurn.where}`)
    const fourTurns = spinFor(96, 30)
    assert.ok(fourTurns.where >= 400, `four fast turns only reach ${fourTurns.where}`)
    assert.equal(fourTurns.clicks, 96, 'still one click a notch, whatever a notch is worth')
    /* Slowing down, turning back, or a new touch puts it back to one a notch. */
    const eased = r.wheelSpin(fourTurns.state, r.wheelTurn(0, fourTurns.state.angle + r.WHEEL_NOTCH_DEG), fourTurns.now + r.WHEEL_SLOW_MS + 1)
    assert.deepEqual([eased.notches, eased.moves, eased.state.run], [1, 1, 0], 'a pause keeps the gear')
    const back = r.wheelSpin(fourTurns.state, fourTurns.state.angle - r.WHEEL_NOTCH_DEG, fourTurns.now + 20)
    assert.deepEqual([back.notches, back.moves, back.state.run], [-1, -1, 0], 'turning back keeps the gear')
    assert.equal(r.wheelSpinStart(0, 0).run, 0)
    /* The gears only rise, and start at one. */
    assert.equal(r.wheelGear(0), 1)
    assert.ok(r.WHEEL_GEARS.every((g, i) => i === 0 || (g.from > r.WHEEL_GEARS[i - 1].from && g.worth > r.WHEEL_GEARS[i - 1].worth)))
    assert.ok(r.WHEEL_GEARS[1].from >= 18, 'a gear before most of a turn would make one preset hard to land on')
    assert.ok(r.WHEEL_FAST_MS < r.WHEEL_SLOW_MS)
  })

  test('preset wheel: the bar never leaves the list, and a dragged row is a row of list with nothing carried away', async () => {
    const r = await rules()
    assert.equal(r.wheelMove(5, 3, 512), 8)
    assert.equal(r.wheelMove(5, -9, 512), 0)
    assert.equal(r.wheelMove(510, 10, 512), 511)
    assert.equal(r.wheelMove(99, 0, 4), 3, 'a list that shrank keeps the bar on a row it has')
    assert.equal(r.wheelMove(0, 1, 0), -1)
    assert.equal(r.wheelMove(undefined, 0, 4), 0)
    /* Down the screen is back up the list, a whole row at a time, and the rest is carried. */
    assert.deepEqual(r.wheelDrag(0, 100), { carry: 100 - 2 * r.WHEEL_ROW, moves: -2 })
    assert.deepEqual(r.wheelDrag(0, -50), { carry: -50 + r.WHEEL_ROW, moves: 1 })
    assert.deepEqual(r.wheelDrag(30, 10), { carry: 40, moves: 0 })
    assert.deepEqual(r.wheelDrag(40, 10), { carry: 50 - r.WHEEL_ROW, moves: -1 })
  })

  test('preset wheel: the ring gets a thumb’s room, and the list over it is a whole odd number of rows with the bar on the middle one', async () => {
    const r = await rules()
    for (const [w, h] of [[390, 500], [390, 560], [360, 420], [320, 300], [420, 700], [700, 1000], [360, 220]]) {
      const plan = r.wheelLayout(w, h)
      assert.ok(plan.ring >= r.WHEEL_RING_LEAST && plan.ring <= r.WHEEL_RING_MOST, `${w}x${h}: the ring is ${plan.ring}`)
      assert.equal(plan.rows % 2, 1, `${w}x${h}: ${plan.rows} rows has no middle`)
      assert.ok(plan.rows >= 3 && plan.rows <= 11)
      assert.equal(plan.middle, (plan.rows - 1) / 2)
      assert.ok(plan.inner * 2 >= 56, `${w}x${h}: the middle button is under a thumb’s 56`)
      assert.ok(plan.ring / 2 - plan.inner >= 44, `${w}x${h}: the ring is too thin to run a thumb round`)
    }
    /* A phone's room: the ring and at least five rows fit in it. */
    const phone = r.wheelLayout(390, 500)
    assert.ok(phone.rows >= 5 && phone.rows * r.WHEEL_ROW + phone.ring + 2 * r.WHEEL_GAP <= 500)
    /* Which presets the rows show: the bar's own in the middle, blanks past either end. */
    assert.deepEqual(r.wheelWindow(1, 7, 512), [null, null, 0, 1, 2, 3, 4])
    assert.deepEqual(r.wheelWindow(511, 5, 512), [509, 510, 511, null, null])
    assert.deepEqual(r.wheelWindow(0, 3, 1), [null, 0, null])
    /* "Make the size of the preset names a little smaller": under the first wheel's 22, over the list's 15. */
    assert.ok(r.WHEEL_NAME < 22 && r.WHEEL_NAME > 15 && r.WHEEL_NAME_ROUND <= r.WHEEL_NAME && r.WHEEL_NAME_ROUND > 15)
    assert.ok(r.WHEEL_ROW >= 44, 'a row is a thumb tall')
  })

  test('preset wheel: the names asked for are the rows around the bar, inside the list, and a click is never held back from a notch', async () => {
    const r = await rules()
    assert.deepEqual(r.wheelAround(5, 512, 2), [3, 4, 5, 6, 7])
    assert.deepEqual(r.wheelAround(0, 512, 2), [0, 1, 2])
    assert.deepEqual(r.wheelAround(511, 512, 2), [509, 510, 511])
    assert.deepEqual(r.wheelAround(-1, 0), [])
    assert.equal(r.wheelAround(200, 512).length, 2 * r.WHEEL_REACH + 1)
    assert.ok(r.WHEEL_REACH >= 6 && r.WHEEL_REACH <= 16, 'each name is a read of the unit: a couple of dozen at rest, never hundreds')
    assert.ok(r.WHEEL_REST_MS >= 80 && r.WHEEL_REST_MS <= 400)
    /* The fastest a thumb turns is about fifty notches a second: no click may be dropped at that. */
    assert.equal(r.clickDue(1000, 0), true)
    assert.equal(r.clickDue(1000, 1000 - r.WHEEL_CLICK_GAP_MS), true)
    assert.ok(r.WHEEL_CLICK_GAP_MS <= 16, 'a click is dropped from a fast spin')
  })

  test('preset wheel: the list is untouched for an account the wheel is not offered to, and for a device that has not chosen it', () => {
    const presets = flat(read('mobile/src/screens/Presets.js'))
    assert.match(presets, /const wheelOffered = usePresetWheelOffered\(\)/)
    assert.match(presets, /const wheel = wheelOffered && wheelKept\.on\b/, 'offered AND chosen, or it is the list')
    /* One or the other, by that one answer. */
    assert.match(presets, /\{wheel \? \( <PresetWheel [^]*?\/> \) : \( <FlatList /, 'the wheel is drawn in the list\'s place, never beside it')
    assert.match(presets, /renderItem=\{\(\{ item: n \}\) => rowOf\(n\)\}/, 'the list draws its own row')
    assert.match(presets, /row=\{\(n\) => rowOf\(n, true\)\}/, 'the wheel is handed what a row says and does')
    /*
     * "Let's make sure we don't touch the other ones": the list's row is
     * the button and the star it was before there was a wheel, at its own
     * height and gap, with nothing of the wheel's in it. What the wheel is
     * handed is returned before it, and is not a row at all.
     */
    const row = presets.slice(presets.indexOf('const rowOf = (n, tall = false) =>'), presets.indexOf('const emptyRows ='))
    const wheels = row.slice(row.indexOf('if (tall) {'), row.indexOf('return ( <View style='))
    const lists = row.slice(row.indexOf('return ( <View style='))
    assert.ok(wheels.length > 200 && lists.length > 400, 'the two rows are not where this looks for them')
    assert.match(wheels, /^if \(tall\) \{ return \{ label: /)
    assert.match(lists, /^return \( <View style=\{\{ flexDirection: 'row', gap: space\.sm, height: ROW, marginBottom: GAP \}\}> (?:\{ \} )?<Press grow height=\{ROW\} /)
    assert.doesNotMatch(lists, /tall|WHEEL_|WheelPreset|labelSize|\bfit\b/, 'something of the wheel\'s is in the list\'s row')
    assert.match(lists, /bar flat style=\{tagEdge\(tag\)\} \/> <Star on=\{starred\}/)
    /* The list's hooks are made where both branches run, or choosing the wheel would change how many there are. */
    assert.doesNotMatch(presets, /viewabilityConfig=\{useRef\(/, 'no hook inside the branch the wheel replaces')
  })

  test('preset wheel: nothing loads until the middle button or a row is pressed, and both are the list\'s own press', () => {
    const src = read('mobile/src/components/PresetWheel.js')
    const wheel = code(src)
    assert.doesNotMatch(wheel, /loadPreset|lib\/rig|lib\/device|lib\/lists/, 'the wheel draws and counts notches; it never loads, stars or saves')
    const presets = flat(read('mobile/src/screens/Presets.js'))
    /* The same words, press, hold and star, once for the list's row and once for the wheel's. */
    const twice = (what, pattern) => assert.equal(presets.match(pattern)?.length, 2, `${what} is not the same for the list and the wheel`)
    twice('the press', /loadPreset\(n\) if \(!stay\) onBack\?\.\(\)/g)
    twice('the name', /typeof name === 'string' \? \(name \|\| 'Empty'\) : `Slot \$\{slotLabel\(n, addressing\)\}`/g)
    twice('the line beside it', /here \? `\$\{slotLabel\(n, addressing\)\} · Playing` : slotLabel\(n, addressing\)/g)
    twice('the hold', /addOpen \? \(\) => hold\(\{ n, words, target \}\) : target \? \(\) => setPainting\(target\) : undefined/g)
    twice('the hold\'s hint', /addOpen \? ADD_WORDS\.hint : target \? TAG_HOLD\.hint : undefined/g)
    twice('the star\'s words', /`\$\{starred \? 'Unstar' : 'Star'\} \$\{name \|\| `slot \$\{slotLabel\(n, addressing\)\}`\}`/g)
    twice('the star', /\(\) => toggleFavourite\(device, n\)/g)
    assert.equal(presets.match(/loadPreset\(/g)?.length, 2, 'a third thing on this screen loads a preset')
    /* The middle button presses the row under the bar, and nothing else: no load of its own. */
    const flatWheel = flat(src)
    assert.match(flatWheel, /const under = at >= 0 && at < count \? row\(data\[at\]\) : null/)
    assert.match(flatWheel, /onPress=\{\(\) => \{ thud\(\) fire\(`press \$\{said\(WHEEL_LOAD, under\?\.label\)\}`, under\?\.onPress\) \}\}/, 'the middle button does something other than the row\'s own press')
    assert.match(src, /export const WHEEL_LOAD = 'Load'/)
    /* Turning the ring only moves the bar. */
    const step = flatWheel.slice(flatWheel.indexOf('const step = useCallback('), flatWheel.indexOf('const spin = useRef(null)'))
    assert.ok(step.length > 200)
    assert.doesNotMatch(step, /onPress|row\(/, 'a notch presses something')
  })

  test('preset wheel: the bar moving, the click and the tap are one step, with no scrolling list to fall behind', () => {
    const src = read('mobile/src/components/PresetWheel.js')
    const wheel = flat(src)
    /* "When you scroll fast, it doesn't click at the right time when it slows down or at all sometimes": nothing scrolls and nothing coasts any more. */
    assert.doesNotMatch(code(src), /FlatList|ScrollView|onScroll|snapToInterval|decelerationRate|Animated\.event/, 'a scrolling list is back under the clicks')
    const step = wheel.slice(wheel.indexOf('const step = useCallback('), wheel.indexOf('const spin = useRef(null)'))
    assert.match(step, /const next = wheelMove\(where\.current, moves, counted\.current\) if \(next === where\.current \|\| next < 0\) return where\.current = next setAt\(next\)/, 'the bar moves from where the code knows it is, and a wheel that moved nothing stops there')
    assert.match(step, /if \(clicking\.current && clickDue\(now, lastClick\.current\)\) \{ lastClick\.current = now wheelClick\(\) \}/, 'the click is not in the same step as the bar')
    /* The ring reads the thumb itself, and nothing takes it from a thumb that is turning it. */
    assert.match(wheel, /const turned = wheelSpin\(spin\.current, angle, Date\.now\(\)\) spin\.current = turned\.state dot\.setValue\(angle\) if \(turned\.moves\) step\(turned\.moves\)/)
    assert.match(wheel, /onPanResponderTerminationRequest: \(\) => false/)
    assert.match(wheel, /spin\.current = wheelSpinStart\(angle, Date\.now\(\)\)/, 'a new touch carries the last one\'s gear')
    /* Opening, a jump and a search move the bar without a click: nobody turned the wheel. */
    const go = wheel.slice(wheel.indexOf('const go = useCallback('), wheel.indexOf('useImperativeHandle('))
    assert.ok(go.length > 80)
    assert.doesNotMatch(go, /wheelClick/)
    assert.match(wheel, /useImperativeHandle\(listRef, \(\) => \(\{ toRow: \(index\) => go\(index\), toTop: \(\) => go\(0\) \}\), \[go\]\)/)
    /* The rows can be dragged, a row for a row, by the same step; a tap is still the row's. */
    assert.match(wheel, /onMoveShouldSetPanResponder: \(_, g\) => Math\.abs\(g\.dy\) > 8 && Math\.abs\(g\.dy\) > Math\.abs\(g\.dx\)/)
    assert.match(wheel, /const moved = wheelDrag\(pull\.current\.carry, g\.dy - pull\.current\.last\) pull\.current = \{ carry: moved\.carry, last: g\.dy \} if \(moved\.moves\) step\(moved\.moves\)/)
    /* No sound is loaded for a wheel that does not click. */
    assert.match(wheel, /if \(!clicks\) return undefined openWheelClick\(\) return closeWheelClick/)
    assert.match(flat(read('mobile/src/screens/Presets.js')), /clicks=\{wheelKept\.clicks\}/)
    /* A screen reader turns it a preset at a time. */
    assert.match(wheel, /accessibilityRole="adjustable"/)
    assert.match(wheel, /onAccessibilityAction=\{\(e\) => step\(e\.nativeEvent\.actionName === 'increment' \? 1 : -1\)\}/)
  })

  test('preset wheel: a preset on the wheel has no box round it, the row under the bar is the bar, and nothing is drawn in the glass', () => {
    const src = read('mobile/src/components/PresetWheel.js')
    const preset = flat(src.slice(src.indexOf('export function WheelPreset(')))
    /* "Remove the boxes around the outside edge of the presets." */
    assert.doesNotMatch(preset, /borderWidth|borderColor|boxShadow|<Press\b/, 'a box is back round a preset on the wheel')
    assert.match(preset, /backgroundColor: under \? color\.silk : 'transparent'/, 'the bar is the row under it, and no other row has a ground')
    assert.match(preset, /const ink = under \? color\.chassis : here \? color\.signal : color\.silk/, 'the one being played is amber, as its row in the list is; the one under the bar is dark on the bar')
    assert.match(preset, /fontSize: under \? WHEEL_NAME : WHEEL_NAME_ROUND, fontWeight: '700'/)
    assert.match(preset, /\{bar \? <View style=\{\{ width: 4, height: WHEEL_ROW - 20, borderRadius: 2, backgroundColor: bar \}\} \/> : null\}/)
    /* It does what it is handed, with the tap you feel, and writes the press down as every button does. */
    assert.match(preset, /onPress=\{\(\) => \{ thud\(\) fire\(`press \$\{said\(label\)\}`, onPress\) \}\}/)
    assert.match(preset, /onLongPress=\{ onLongPress \? \(\) => \{ thud\(\) fire\(`hold \$\{said\(label\)\}`, onLongPress\) \} : undefined \}/)
    assert.match(preset, /onPress=\{\(\) => \{ tick\(\) onStar\?\.\(\) \}\}/)
    assert.match(src, /const WHEEL_END = 44\b/)
    /* Classic has no glass: the wheel is drawn in the plain colours, so it is the same in both looks. */
    assert.doesNotMatch(code(src), /color\.glass|glassCard|radius\.card|capsule\(|classic\(\)/)
    /* The spot that follows the thumb is never what the thumb lands on: the ring is, which is how the ring's middle is found. */
    const wheel = flat(src.slice(0, src.indexOf('export function WheelPreset(')))
    assert.match(wheel, /<Animated\.View pointerEvents="none"/)
    assert.match(wheel, /middle\.current = \{ x: e\.nativeEvent\.pageX - e\.nativeEvent\.locationX \+ d \/ 2, y: e\.nativeEvent\.pageY - e\.nativeEvent\.locationY \+ d \/ 2 \}/)
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

  test('preset wheel: the click sounds with the notch: a player rewound ahead of its turn, and the sound kept awake', async () => {
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
    assert.match(r.WHEEL_WORDS.wheelSub, /Nothing loads until you do\./)
    assert.match(r.WHEEL_WORDS.wheelSub, /Load/)
    assert.match(r.WHEEL_WORDS.clicksSub, /silent mode/)
    /* The house rules for words on a screen. */
    assert.doesNotMatch(words, /this phone|your phone|\bbeta\b|\btried\b|official|iPod/i)
  })
}
