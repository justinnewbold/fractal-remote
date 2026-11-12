/**
 * ALL PRESETS AS A WHEEL, A CHOICE BESIDE THE LIST
 * (mobile/src/lib/presetWheel.js, lib/usePresetWheel.js, lib/wheelClick.js,
 * lib/audioMode.js, components/PresetWheel.js, screens/Presets.js,
 * screens/Settings.js).
 *
 * "Can we do preset scrolling option a as a setting? So we can have both
 * the original and that one." (Justin, 11 November 2026.) Made four times
 * on his phone's word: a ring to run a thumb round, a list that glides
 * under a bar as it turns, faster the faster the thumb goes and coasting
 * after a flick, a click and a tap for each preset that passes, and a
 * middle button that loads the preset under the bar. His account
 * until features PRESET_WHEEL_FOR_EVERYONE; for every other account, and
 * for a device that has not chosen it, All presets is the list it always
 * was.
 *
 * The rule file imports nothing and is run as it is. The rest is read for
 * how it is wired: the app moves the list itself, and nothing here is a
 * scrolling list.
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
    assert.deepEqual(r.wheelSetting(storage()), { on: false, clicks: true, feel: 'both' })
    /* Anything unreadable is the default, never a wheel nobody chose. */
    for (const junk of ['', 'nonsense', '[]', '"on"', '{"on":"yes","clicks":0}', 'null']) {
      assert.deepEqual(r.wheelSetting(storage({ [r.WHEEL_KEY]: junk })), { on: false, clicks: true, feel: 'both' }, junk)
    }
    assert.deepEqual(r.wheelSetting(null), { on: false, clicks: true, feel: 'both' })

    const kept = storage()
    assert.deepEqual(r.saveWheel({ on: true }, kept), { on: true, clicks: true, feel: 'both' })
    assert.deepEqual(r.saveWheel({ clicks: false }, kept), { on: true, clicks: false, feel: 'both' })
    assert.deepEqual(r.wheelSetting(kept), { on: true, clicks: false, feel: 'both' })
    assert.deepEqual(r.saveWheel({ on: false }, kept), { on: false, clicks: false, feel: 'both' })
    /* A patch that says nothing changes nothing. */
    assert.deepEqual(r.saveWheel({ on: 'true', clicks: null }, kept), { on: false, clicks: false, feel: 'both' })
    /* The phone's storage only carries keys that start `fractal.`. */
    assert.match(r.WHEEL_KEY, /^fractal\./)
  })

  test('preset wheel: turned slowly a notch is a preset, the same from anywhere on the ring, and crossing nine o’clock is not a spin backward', async () => {
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

    /* Slow turning is the list moving with the thumb, part of a row for part of a notch: nothing waits for a whole notch, and nothing is lost. */
    let out = r.wheelFlow(r.wheelFlowStart(0, 0), 7.5, 300)
    assert.equal(out.rows, 0.5)
    out = r.wheelFlow(out.state, 15, 600)
    assert.equal(out.rows, 0.5)
    /* The same turn is the same rows wherever on the ring it starts. */
    for (const from of [-170, -90, 0, 90, 170]) {
      const turned = r.wheelFlow(r.wheelFlowStart(from, 0), ((from + 45 + 180) % 360) - 180, 500)
      assert.deepEqual([turned.turned, turned.rows], [45, 3], `from ${from}`)
    }
    /* Anticlockwise goes back up the list. */
    assert.equal(r.wheelFlow(r.wheelFlowStart(0, 0), -30, 500).rows, -2)
  })

  test('preset wheel: "if I flicked it, it would go fast if I went slow, it go slow": the faster the thumb, the more a turn is worth, smoothly', async () => {
    const r = await rules()
    /* A thumb going round at a steady speed, a touch every sixteenth of a second or so, as a screen reports it. */
    const spin = (degreesASecond, turns, count = 512, every = 16) => {
      let state = r.wheelFlowStart(0, 0)
      let [angle, now, rows] = [0, 0, 0]
      const each = (degreesASecond * every) / 1000
      for (let gone = 0; gone < turns * 360 - 1e-6; gone += Math.abs(each)) {
        now += every
        angle += each
        const out = r.wheelFlow(state, ((angle + 180) % 360) - 180, now, count)
        state = out.state
        rows += out.rows
      }
      return { rows, state, now, notches: angle / r.WHEEL_NOTCH_DEG }
    }
    const near = (got, want, what) => assert.ok(Math.abs(got - want) < 1e-6, `${what}: ${got}, not ${want}`)
    /* Looking for a preset: a notch is a preset, for as long as you like, right up to the easy speed. */
    near(spin(90, 2).rows, 48, 'two slow turns')
    const easy = spin(r.WHEEL_EASY_DEG_S, 3)
    assert.ok(easy.notches >= 72)
    near(easy.rows, easy.notches, 'three turns at the easy speed')
    assert.equal(r.wheelGain(0), 1)
    assert.equal(r.wheelGain(r.WHEEL_EASY_DEG_S), 1)
    /* Over it, a turn is worth more the faster it is made: no step, no waiting for a long spin first. */
    const aTurn = [240, 300, 360, 480, 600, 720].map((speed) => spin(speed, 4).rows / 4)
    for (let i = 1; i < aTurn.length; i += 1) assert.ok(aTurn[i] > aTurn[i - 1], `a turn at a faster speed is worth no more: ${aTurn.join(', ')}`)
    assert.ok(aTurn[1] < 24 * 1.25, `a little faster is a great deal more: ${aTurn[1]} presets a turn at 300`)
    assert.ok(r.wheelGain(260) - r.wheelGain(240) < 0.05, 'the speed-up comes in with a jump')
    /* A real spin flies: four turns at two a second reach the far end of 512. */
    assert.ok(spin(720, 4).rows >= 400, `four fast turns only reach ${spin(720, 4).rows}`)
    /* Never a blur past reading, and never slower for a faster thumb. */
    let before = 0
    for (const speed of [120, 240, 480, 720, 1000, 1500, 3000]) {
      const went = spin(speed, 6)
      const aSecond = went.rows / (went.now / 1000)
      /* (A twentieth over, for the moment the thumb's speed is still being read as it gets going.) */
      assert.ok(aSecond <= r.WHEEL_ROWS_MOST * 1.05, `${speed} degrees a second is ${aSecond} presets a second`)
      assert.ok(aSecond >= before - 1, `a faster thumb moved the list slower at ${speed}`)
      before = aSecond
    }
    /* A short list is not thrown from end to end: a full turn at the most is never more than half of it. */
    assert.equal(r.wheelGainMost(24), 1)
    assert.ok(spin(1000, 1, 104).rows <= 52 + 1e-6, `a turn of an AM4's 104 went ${spin(1000, 1, 104).rows}`)
    assert.ok(r.wheelGainMost(512) > 8 && r.wheelGainMost(100000) === r.WHEEL_GAIN_MOST)
    /* A pause puts it back to one a notch, and so does turning back: none of the last spin is carried on. */
    const fast = spin(720, 2)
    assert.ok(Math.abs(fast.state.speed - 720) < 30, `the thumb's speed is read as ${fast.state.speed}`)
    const after = r.wheelFlow(fast.state, fast.state.angle + r.WHEEL_NOTCH_DEG, fast.now + r.WHEEL_STILL_MS + 200)
    near(after.rows, 1, 'a notch after a pause')
    const back = r.wheelFlow(fast.state, fast.state.angle - 3, fast.now + 16)
    near(back.rows, -3 / r.WHEEL_NOTCH_DEG, 'the first move back')
    assert.ok(back.state.speed < 0 && back.state.speed > -r.WHEEL_EASY_DEG_S)
    /* One late touch is not a spin: a single sudden move from rest is worth what it turned and no more. */
    near(r.wheelFlow(r.wheelFlowStart(0, 0), 15, 4).rows, 1, 'one sudden move')
    /* Lifting the thumb: the list is going as fast as the thumb had it, and not at all if the thumb had stopped first. */
    near(r.wheelLetGo(fast.state, fast.now + 8, 512), (fast.state.speed / r.WHEEL_NOTCH_DEG) * r.wheelGain(fast.state.speed, 512), 'the speed at letting go')
    assert.ok(r.wheelLetGo(fast.state, fast.now + 8, 512) > 150)
    assert.equal(r.wheelLetGo(fast.state, fast.now + r.WHEEL_STILL_MS + 1, 512), 0, 'a thumb that stopped and then lifted flicked the list')
    assert.equal(r.wheelLetGo(null, 0, 512), 0)
    const up = spin(-720, 2)
    assert.ok(up.rows < -48 && r.wheelLetGo(up.state, up.now, 512) < -150, 'a flick back up the list')
  })

  test('preset wheel: a click can be the sound, the tap or both, and a list moving fast is flying until it slows', async () => {
    const r = await rules()
    /* "Maybe there's an option we can add also that we're just the sound. Is there instead of the haptic feedback or vice versa?" */
    assert.deepEqual(r.WHEEL_FEELS, ['both', 'sound', 'tap'])
    assert.deepEqual(r.wheelFeel({ clicks: true, feel: 'both' }), { sound: true, tap: true })
    assert.deepEqual(r.wheelFeel({ clicks: true, feel: 'sound' }), { sound: true, tap: false })
    assert.deepEqual(r.wheelFeel({ clicks: true, feel: 'tap' }), { sound: false, tap: true })
    assert.deepEqual(r.wheelFeel({ clicks: true }), { sound: true, tap: true }, 'a device that chose before there was a choice has both, as it had')
    assert.deepEqual(r.wheelFeel({ clicks: true, feel: 'loud' }), { sound: true, tap: true })
    for (const feel of r.WHEEL_FEELS) assert.deepEqual(r.wheelFeel({ clicks: false, feel }), { sound: false, tap: false }, 'the tick box off is everything off')
    assert.deepEqual(r.wheelFeel(null), { sound: false, tap: false })
    /* Kept with the rest of the choice, each part on its own. */
    const kept = { getItem: (k) => kept[k] ?? null, setItem: (k, v) => { kept[k] = v } }
    assert.equal(r.wheelSetting(kept).feel, 'both')
    assert.deepEqual(r.saveWheel({ feel: 'tap' }, kept), { on: false, clicks: true, feel: 'tap' })
    assert.deepEqual(r.saveWheel({ on: true }, kept), { on: true, clicks: true, feel: 'tap' })
    assert.equal(r.saveWheel({ feel: 'nonsense' }, kept).feel, 'tap', 'a feel that is not one is not kept')
    assert.equal(r.wheelSetting({ getItem: () => '{"on":true,"clicks":false,"feel":7}' }).feel, 'both')
    assert.deepEqual(Object.keys(r.WHEEL_WORDS.feels), r.WHEEL_FEELS)

    /* How fast the list is moving, from one move to the next: a steady pace is read as it is, and a move after a rest starts from nothing. */
    let pace = null
    let now = 1000
    for (let i = 0; i < 40; i += 1) {
      now += 16
      pace = r.wheelPace(pace, 1.6, now)
    }
    assert.ok(Math.abs(pace.rate - 100) < 3, `a hundred presets a second is read as ${pace.rate}`)
    assert.equal(r.wheelPace(pace, 5, now + r.WHEEL_STILL_MS + 1).rate, 0, 'a move after a rest carries the last spin’s speed')
    assert.equal(r.wheelPace(null, 5, 50).rate, 0)
    assert.equal(r.wheelPace(pace, 3, now), pace, 'two moves in the same instant are counted as a spin')
    assert.ok(r.wheelPace(pace, -1.6, now + 16).rate > 90, 'back up the list is as fast as down it')
    /* Flying from one speed and landing at a lower one, so it does not flick in and out. */
    assert.equal(r.wheelFlying(false, r.WHEEL_FLY_FROM - 1), false)
    assert.equal(r.wheelFlying(false, r.WHEEL_FLY_FROM), true)
    assert.equal(r.wheelFlying(true, r.WHEEL_FLY_FROM - 1), true)
    assert.equal(r.wheelFlying(true, r.WHEEL_FLY_UNTIL), false)
    assert.ok(r.WHEEL_FLY_UNTIL < r.WHEEL_FLY_FROM / 1.5)
    /* A thumb looking for a preset never flies: it is under the speed where a notch is a preset. */
    assert.ok(r.WHEEL_FLY_FROM > (r.WHEEL_EASY_DEG_S / r.WHEEL_NOTCH_DEG) * 2, 'the rows are put away under a thumb that is reading them')
    assert.ok(r.WHEEL_FLY_SAY_MS >= 30 && r.WHEEL_FLY_SAY_MS <= 120)
  })

  test('preset wheel: the list never leaves its ends, and the preset under the bar does not chatter on the line between two', async () => {
    const r = await rules()
    assert.equal(r.wheelPlace(5.4, 512), 5.4, 'between two rows is a place')
    assert.equal(r.wheelPlace(-3, 512), 0)
    assert.equal(r.wheelPlace(600, 512), 511)
    assert.equal(r.wheelPlace(2, 0), -1)
    assert.equal(r.wheelPlace(undefined, 4), 0)
    assert.equal(r.wheelRow(5.4, 512), 5)
    assert.equal(r.wheelRow(5.6, 512), 6)
    assert.equal(r.wheelRow(99, 4), 3, 'a list that shrank keeps the bar on a row it has')
    assert.equal(r.wheelRow(0, 0), -1)
    assert.equal(r.wheelMove(5, 3, 512), 8)
    assert.equal(r.wheelMove(5, -9, 512), 0)
    assert.equal(r.wheelMove(510, 10, 512), 511)
    assert.equal(r.wheelMove(0, 1, 0), -1)
    /* The one under the bar stays under it until the list is a little past half-way to the next, in either direction. */
    assert.equal(r.wheelUnder(5.5, 5, 512), 5)
    assert.equal(r.wheelUnder(5.55, 5, 512), 5)
    assert.equal(r.wheelUnder(5.65, 5, 512), 6)
    assert.equal(r.wheelUnder(5.45, 6, 512), 6)
    assert.equal(r.wheelUnder(5.35, 6, 512), 5)
    assert.equal(r.wheelUnder(9.2, 5, 512), 9, 'a list that has moved on names the row it is at')
    assert.equal(r.wheelUnder(3.4, -1, 512), 3)
    assert.equal(r.wheelUnder(3, 900, 512), 3)
    assert.equal(r.wheelUnder(1, 0, 0), -1)
    assert.ok(r.WHEEL_STICK > 0 && r.WHEEL_STICK <= 0.2)
  })

  test('preset wheel: a flick coasts from the speed it had, slows like a wheel, and comes to rest exactly on a row', async () => {
    const r = await rules()
    /* Not a flick: the list settles on the nearest row, quickly, and a list already on a row does nothing. */
    const settle = r.wheelCoast(100.3, 2, 512)
    assert.deepEqual([settle.kind, settle.to, settle.ms], ['settle', 100, r.WHEEL_SETTLE_MS])
    assert.equal(r.wheelCoast(100.7, 0, 512).to, 101)
    assert.equal(r.wheelCoast(100, 0, 512).ms, 0)
    assert.equal(r.wheelCoast(5, 50, 0), null)
    assert.equal(r.wheelGlideAt(settle, 0), 100.3)
    assert.equal(r.wheelGlideAt(settle, r.WHEEL_SETTLE_MS), 100)
    assert.ok(r.wheelGlideAt(settle, r.WHEEL_SETTLE_MS / 2) < 100.15, 'settling is quick at first and soft at the end')
    assert.ok(r.WHEEL_SETTLE_MS <= 200)

    let farthest = 0
    assert.equal(r.wheelCoast(100, r.WHEEL_COAST_LEAST - 1, 2000).kind, 'settle', 'a thumb lifted from a slow turn sends the list on')
    for (const speed of [8, 10, 20, 45, 100, 240]) {
      const coast = r.wheelCoast(100, speed, 2000)
      assert.equal(coast.kind, 'coast', `${speed} a second is not a flick`)
      assert.ok(Number.isInteger(coast.to), `a coast from ${speed} stops between two rows`)
      assert.ok(coast.to - 100 >= farthest && coast.to > 100, `a faster flick went no farther: ${speed}`)
      farthest = coast.to - 100
      assert.ok(coast.ms > 100 && coast.ms <= 2500, `a coast from ${speed} takes ${coast.ms} ms`)
      /* It sets off at the speed it was let go at, near enough that the thumb leaving is not felt. */
      const first = (r.wheelGlideAt(coast, 20) - 100) / 0.02
      assert.ok(first > speed * 0.6 && first < speed * 1.4, `let go at ${speed}, it set off at ${first}`)
      /* It only ever goes the way it was going, slower and slower, and is still from its end on. */
      let [at, stride] = [100, Infinity]
      for (let ms = 100; ms <= coast.ms + 300; ms += 100) {
        const now = r.wheelGlideAt(coast, ms)
        assert.ok(now >= at && now <= coast.to, `it turned back or overshot at ${ms} ms`)
        assert.ok(now - at <= stride + 1e-9, `it sped up at ${ms} ms`)
        stride = now - at
        at = now
      }
      assert.equal(r.wheelGlideAt(coast, coast.ms), coast.to)
      assert.equal(r.wheelGlideAt(coast, coast.ms + 5000), coast.to)
      /* And the same back up the list. */
      assert.equal(1000 - r.wheelCoast(1000, -speed, 2000).to, coast.to - 100)
    }
    /* A list flick's feel: let go at 45 presets a second it carries on for ten to twenty-five of them. */
    const flick = r.wheelCoast(100, 45, 2000)
    assert.ok(flick.to - 100 >= 10 && flick.to - 100 <= 25, `a flick at 45 went ${flick.to - 100}`)
    /* The last row is not a creep: the list is within a third of a row of rest well before the end. */
    let slow = flick.ms
    while (r.wheelGlideAt(flick, slow - 10) > flick.to - 1) slow -= 10
    assert.ok(flick.ms - slow < 500, `the last row takes ${flick.ms - slow} ms`)
    /* The end of the list is a wall: it gets there still moving and stops, and never passes it. */
    const wall = r.wheelCoast(500, 100, 512)
    assert.deepEqual([wall.kind, wall.to], ['coast', 511])
    assert.ok(wall.ms < r.wheelCoast(100, 100, 2000).ms)
    assert.ok(r.wheelGlideAt(wall, wall.ms - 10) > 510 && r.wheelGlideAt(wall, wall.ms - 10) <= 511)
    assert.equal(r.wheelCoast(3, -100, 512).to, 0)
    /* Nothing is let go faster than can be read. */
    assert.equal(r.wheelCoast(100, 5000, 2000).speed, r.WHEEL_ROWS_MOST)
    assert.equal(r.wheelCoast(100, 5000, 2000).to, r.wheelCoast(100, r.WHEEL_ROWS_MOST, 2000).to)
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
    /* Which presets are on the strip: the rows round the one they were last drawn round, inside the list. */
    assert.deepEqual(r.wheelDrawn(1, 3, 512), [0, 1, 2, 3, 4])
    assert.deepEqual(r.wheelDrawn(511, 2, 512), [509, 510, 511])
    assert.deepEqual(r.wheelDrawn(0, 1, 1), [0])
    assert.deepEqual(r.wheelDrawn(-1, 3, 0), [])
    /* They are drawn again before the bar can reach the last of them, with rows to spare for a list that is moving. */
    assert.ok(r.WHEEL_REDRAW >= 2 && r.WHEEL_SPARE >= r.WHEEL_REDRAW + 4)
    /* "Make the size of the preset names a little smaller": under the first wheel's 22, over the list's 15. One size under the bar and round it, or a name half in the bar is two sizes at once. */
    assert.ok(r.WHEEL_NAME < 22 && r.WHEEL_NAME > 15)
    assert.equal(r.WHEEL_NAME_ROUND, r.WHEEL_NAME)
    assert.ok(r.WHEEL_ROW >= 44, 'a row is a thumb tall')
  })

  test('preset wheel: the names asked for are the rows around the bar, inside the list, and a thumb looking for a preset hears every one', async () => {
    const r = await rules()
    assert.deepEqual(r.wheelAround(5, 512, 2), [3, 4, 5, 6, 7])
    assert.deepEqual(r.wheelAround(0, 512, 2), [0, 1, 2])
    assert.deepEqual(r.wheelAround(511, 512, 2), [509, 510, 511])
    assert.deepEqual(r.wheelAround(-1, 0), [])
    assert.equal(r.wheelAround(200, 512).length, 2 * r.WHEEL_REACH + 1)
    assert.ok(r.WHEEL_REACH >= 6 && r.WHEEL_REACH <= 16, 'each name is a read of the unit: a couple of dozen at rest, never hundreds')
    assert.ok(r.WHEEL_REST_MS >= 80 && r.WHEEL_REST_MS <= 400)
    /* Up to the easy speed every preset that passes clicks; a spin or a coast faster than that is a purr, never a buzz. */
    assert.equal(r.clickDue(1000, 0), true)
    assert.equal(r.clickDue(1000, 1000 - r.WHEEL_CLICK_GAP_MS), true)
    assert.equal(r.clickDue(1000, 1000 - r.WHEEL_CLICK_GAP_MS + 1), false)
    assert.ok(r.WHEEL_CLICK_GAP_MS < 1000 / (r.WHEEL_EASY_DEG_S / r.WHEEL_NOTCH_DEG) - 10, 'a click is dropped from a thumb looking for a preset')
    assert.ok(r.WHEEL_CLICK_GAP_MS >= 25, 'more than forty clicks a second is a buzz')
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
    assert.doesNotMatch(wheel, /loadPreset|lib\/rig|lib\/device|lib\/lists/, 'the wheel draws and moves; it never loads, stars or saves')
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
    /* The middle button presses the row under the bar as it is that instant, and nothing else: no load of its own. Pressed on a list still coasting, it stops the list on that row first. */
    const flatWheel = flat(src)
    assert.match(
      flatWheel,
      /onPress=\{\(\) => \{ thud\(\) if \(stop\(\)\) \{ put\(on\.current, false\) calm\(\) \} const under = on\.current >= 0 && on\.current < count \? row\(data\[on\.current\]\) : null fire\(`press \$\{said\(WHEEL_LOAD, under\?\.label\)\}`, under\?\.onPress\) \}\}/,
      'the middle button does something other than the row\'s own press'
    )
    assert.match(src, /export const WHEEL_LOAD = 'Load'/)
    /* Moving the list, by a turn, a drag or a coast, presses nothing. */
    const moving = flatWheel.slice(flatWheel.indexOf('const put = useCallback('), flatWheel.indexOf('const nudge = useCallback('))
    assert.ok(moving.length > 2500, 'the code that moves the list is not where this looks for it')
    assert.doesNotMatch(moving, /\bonPress\b|\brow\(|look\.current/, 'moving the list presses something')
  })

  test('preset wheel: the app moves the list itself, and the click and the tap are in the line that moves it, turning or coasting', () => {
    const src = read('mobile/src/components/PresetWheel.js')
    const wheel = flat(src)
    /*
     * "When you scroll fast, it doesn't click at the right time when it slows
     * down or at all sometimes": that was a list the system scrolled and the
     * app watched. Nothing here scrolls on its own, and nothing is handed to
     * an animation to move while the app is not looking.
     */
    assert.doesNotMatch(code(src), /FlatList|ScrollView|onScroll|snapToInterval|decelerationRate|Animated\.event|Animated\.decay|Animated\.spring|Animated\.timing|useNativeDriver/, 'something other than the app\'s own code is moving the list')
    const put = wheel.slice(wheel.indexOf('const put = useCallback('), wheel.indexOf('const glide = useRef(null)'))
    assert.match(
      put,
      /const next = wheelPlace\(place, counted\.current\) if \(next < 0\) return const now = Date\.now\(\) pace\.current = wheelPace\(pace\.current, next - where\.current, now\) where\.current = next slide\.setValue\(-next \* WHEEL_ROW\) const under = wheelUnder\(next, on\.current, counted\.current\) const passed = under !== on\.current on\.current = under if \(passed && loud && clicking\.current && clickDue\(now, lastClick\.current\)\) \{ lastClick\.current = now wheelClick\(feeling\.current\) \}/,
      'the click is not in the same line as the move'
    )
    assert.equal(wheel.match(/wheelClick\(/g)?.length, 1, 'something else clicks')
    assert.equal(wheel.match(/slide\.setValue\(/g)?.length, 2, 'the strip is slid from somewhere other than a move and a jump')
    /* A coast and a settle are that same move, a frame at a time, from the plan of where the list is at each moment. */
    const run = wheel.slice(wheel.indexOf('const run = useCallback('), wheel.indexOf('const go = useCallback('))
    assert.match(run, /const place = wheelGlideAt\(course, ms\) roll\(\(\(place - going\.last\) \* WHEEL_NOTCH_DEG\) \/ per\) going\.last = place put\(place\) if \(ms >= course\.ms\) \{ glide\.current = null calm\(\) return \} going\.frame = requestAnimationFrame\(frame\)/)
    assert.match(wheel, /useEffect\(\(\) => stop, \[stop\]\)/, 'a coast outlives the wheel')
    /* The ring reads the thumb itself, at the speed it turns; a thumb landing stops a coast, and nothing takes the ring from a thumb that is turning it. */
    assert.match(wheel, /const turned = wheelFlow\(flow\.current, angle, stamp\(e\), counted\.current\) flow\.current = turned\.state dot\.setValue\(angle\) roll\(turned\.turned\) if \(turned\.rows\) put\(where\.current \+ turned\.rows\)/)
    assert.match(wheel, /onPanResponderGrant: \(e\) => \{ stop\(\) const d = size\.current\.ring/)
    assert.match(wheel, /flow\.current = wheelFlowStart\(angle, stamp\(e\)\)/, 'a new touch carries the last one\'s speed')
    assert.match(wheel, /onPanResponderTerminationRequest: \(\) => false/)
    /* Lifted while turning, the list coasts from the thumb's own speed; taken away, it only settles. */
    assert.match(wheel, /const speed = flick \? wheelLetGo\(flow\.current, stamp\(e\), counted\.current\) : 0 const per = wheelGain\(flow\.current\?\.speed, counted\.current\) flow\.current = null run\(wheelCoast\(where\.current, speed, counted\.current\), per\)/)
    assert.match(wheel, /onPanResponderRelease: \(e\) => letGo\(e, true\), onPanResponderTerminate: \(e\) => letGo\(e, false\)/)
    /* "If I went slow, it go slow": the list is never settled under a thumb that has only paused, which would throw away the part of a notch already turned. */
    const ring = wheel.slice(wheel.indexOf('const flow = useRef(null)'), wheel.indexOf('const pull = useRef('))
    assert.ok(ring.length > 800)
    assert.doesNotMatch(ring, /setTimeout|wheelSettle/, 'the ring settles the list while the thumb is still on it')
    /* Opening, a jump and a search move the list without a click: nobody turned the wheel. */
    const go = wheel.slice(wheel.indexOf('const go = useCallback('), wheel.indexOf('useImperativeHandle('))
    assert.ok(go.length > 80)
    assert.doesNotMatch(go, /wheelClick|\bput\(/)
    assert.match(go, /stop\(\)/, 'a jump is carried off by a coast')
    assert.match(wheel, /useImperativeHandle\(listRef, \(\) => \(\{ toRow: \(index\) => go\(index\), toTop: \(\) => go\(0\) \}\), \[go\]\)/)
    /* The rows can be dragged, a row for a row, and flicked; a touch on a coasting list stops it and presses nothing; a tap on a list at rest is still the row's. */
    assert.match(wheel, /onStartShouldSetPanResponderCapture: \(\) => glide\.current\?\.course\.kind === 'coast'/)
    assert.match(wheel, /onMoveShouldSetPanResponder: \(_, g\) => Math\.abs\(g\.dy\) > 8 && Math\.abs\(g\.dy\) > Math\.abs\(g\.dx\)/)
    assert.match(wheel, /put\(pull\.current\.from - \(g\.dy - pull\.current\.base\) \/ WHEEL_ROW\)/)
    assert.match(wheel, /onPanResponderRelease: \(_, g\) => run\(wheelCoast\(where\.current, Date\.now\(\) - pull\.current\.at > WHEEL_STILL_MS \? 0 : \(-g\.vy \* 1000\) \/ WHEEL_ROW, counted\.current\)\)/, 'a thumb that stopped before it lifted flicks the list with a speed it no longer has')
    /* No sound is loaded for a wheel that does not click. */
    assert.match(wheel, /const heard = clicks && feel\?\.sound !== false useEffect\(\(\) => \{ if \(!heard\) return undefined openWheelClick\(\) return closeWheelClick \}, \[heard\]\)/, 'a wheel that only taps, or does not click, loads a sound')
    assert.match(flat(read('mobile/src/screens/Presets.js')), /clicks=\{wheelKept\.clicks\}/)
    /* A screen reader turns it a preset at a time. */
    assert.match(wheel, /accessibilityRole="adjustable"/)
    assert.match(wheel, /const nudge = useCallback\( \(by\) => \{ stop\(\) put\(on\.current \+ by\) calm\(\) \}/)
    assert.match(wheel, /onAccessibilityAction=\{\(e\) => nudge\(e\.nativeEvent\.actionName === 'increment' \? 1 : -1\)\}/)
  })

  test('preset wheel: the list is one strip slid under a fixed bar, drawn again only every few rows, and a name turns dark as it slides into the bar', () => {
    const src = read('mobile/src/components/PresetWheel.js')
    const wheel = flat(src)
    /* "Let's figure out how to get it smoother": the rows are not drawn again for every preset that passes. The strip is slid by one number, set straight from the move. */
    assert.match(
      wheel,
      /<Animated\.View style=\{\{ position: 'absolute', left: space\.lg, right: space\.lg, top: plan\.middle \* WHEEL_ROW, height: count \* WHEEL_ROW, opacity: flying \? 0 : 1, transform: \[\{ translateY: slide \}\] \}\}> \{strip\.map\(\(index\) => \( <WheelSlot key=\{index % pool\} index=\{index\} item=\{data\[index\]\} look=\{look\} handed=\{handed\.current\} \/> \)\)\}/
    )
    assert.match(wheel, /if \(passed && Math\.abs\(under - drawn\.current\) >= WHEEL_REDRAW\) redraw\(\)/)
    assert.match(wheel, /const redraw = useCallback\(\(\) => \{ if \(drawn\.current === on\.current\) return drawn\.current = on\.current setCentre\(on\.current\) \}, \[\]\)/)
    assert.equal(wheel.match(/setCentre\(/g)?.length, 1, 'the rows are drawn again somewhere other than the one place')
    assert.equal(wheel.match(/\bredraw\(\)/g)?.length, 2, 'the rows are drawn again somewhere other than every few rows and on landing')
    assert.match(wheel, /const reach = plan\.middle \+ WHEEL_SPARE const strip = wheelDrawn\(centre, reach, count\) const pool = 2 \* reach \+ 1/)
    /* A place on the strip is kept and handed the next preset, and is drawn again only for a new preset or new rows from the screen. */
    assert.match(wheel, /const WheelSlot = memo\(function WheelSlot\(\{ index, item, look, under = false \}\) \{ const says = look\.current\(item\)/)
    assert.match(wheel, /if \(look\.current !== row\) \{ look\.current = row handed\.current \+= 1 \}/)
    assert.match(wheel, /top: index \* WHEEL_ROW, height: WHEEL_ROW \}\}>\{under \? <WheelName \{\.\.\.says\} \/> : <WheelPreset \{\.\.\.says\} \/>\}/)
    /* The bar is fixed on the middle row and takes no touch (a tap on it is the row's under it); the same strip is inside it in dark ink, slid by the same number. */
    assert.match(
      wheel,
      /<View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style=\{\{ position: 'absolute', left: space\.lg, right: space\.lg, top: plan\.middle \* WHEEL_ROW, height: WHEEL_ROW, borderRadius: 10, backgroundColor: color\.silk, overflow: 'hidden', opacity: flying \? 0 : 1 \}\} > <Animated\.View style=\{\{ position: 'absolute', left: 0, right: 0, top: 0, height: count \* WHEEL_ROW, transform: \[\{ translateY: slide \}\] \}\}> \{wheelDrawn\(centre, WHEEL_SPARE, count\)\.map\(\(index\) => \( <WheelSlot key=\{index % \(2 \* WHEEL_SPARE \+ 1\)\} index=\{index\} item=\{data\[index\]\} look=\{look\} handed=\{handed\.current\} under \/> \)\)\}/
    )
    /*
     * "It also lags quite a bit too if you scroll really fast, it doesn't
     * keep up": while the list flies nothing is drawn again. The rows are
     * put away, one line says the slot it is passing, and they come back
     * once when it slows, rests, or stops dead under a thumb.
     */
    assert.match(wheel, /const fly = wheelFlying\(soaring\.current, pace\.current\.rate\) if \(fly && !soaring\.current\) \{ soaring\.current = true setFlying\(true\) \} else if \(!fly && soaring\.current\) land\(\) if \(soaring\.current\) \{ if \(now - lineSaid\.current >= WHEEL_FLY_SAY_MS\) \{ lineSaid\.current = now line\.current\?\.say\(under\) \} clearTimeout\(landing\.current\) landing\.current = setTimeout\(land, WHEEL_STILL_MS\) return \}/, 'rows are drawn again while the list flies, or it never lands')
    assert.match(wheel, /const land = useCallback\(\(\) => \{ clearTimeout\(landing\.current\) if \(soaring\.current\) \{ soaring\.current = false setFlying\(false\) \} redraw\(\) \}, \[redraw\]\)/)
    assert.match(wheel, /<WheelFlying ref=\{line\} shown=\{flying\} items=\{items\} look=\{look\} start=\{on\.current\} \/>/)
    const flyingLine = wheel.slice(wheel.indexOf('const WheelFlying = forwardRef('), wheel.indexOf('const WheelSlot = memo('))
    assert.match(flyingLine, /useImperativeHandle\(ref, \(\) => \(\{ say: \(index\) => setAt\(index\) \}\), \[\]\) if \(!shown\) return null/)
    assert.match(flyingLine, /pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/)
    assert.doesNotMatch(flyingLine, /Pressable|onPress/)
    /* The names around the bar are asked for when the list rests, never during a spin or a coast. */
    const calm = wheel.slice(wheel.indexOf('const calm = useCallback('), wheel.indexOf('const lastClick = useRef(0)'))
    assert.match(calm, /pace\.current = null land\(\)/, 'a list at rest is still flying')
    assert.match(calm, /rest\.current = setTimeout\(\(\) => around\.current\?\.\(wheelAround\(on\.current, counted\.current\)\), WHEEL_REST_MS\)/)
    assert.equal(wheel.match(/around\.current\?\.\(/g)?.length, 1)
    /* The marks on the ring go round with the thumb and with a coast, and are never what a thumb lands on. */
    assert.match(wheel, /<Animated\.View pointerEvents="none" style=\{\{ position: 'absolute', left: 0, top: 0, width: d, height: d, transform: \[\{ rotate: marks\.interpolate\(\{ inputRange: \[0, 360\], outputRange: \['0deg', '360deg'\] \}\) \}\] \}\}>/)
  })

  test('preset wheel: a preset on the wheel has no box round it, the bar shows the same line in dark ink, and nothing is drawn in the glass', () => {
    const src = read('mobile/src/components/PresetWheel.js')
    const preset = flat(src.slice(src.indexOf('export function WheelPreset('), src.indexOf('export function WheelName(')))
    /* "Remove the boxes around the outside edge of the presets." */
    assert.doesNotMatch(preset, /borderWidth|borderColor|boxShadow|<Press\b|backgroundColor: (?!bar\b)/, 'a box is back round a preset on the wheel')
    assert.match(preset, /const ink = here \? color\.signal : color\.silk/, 'the one being played is amber, as its row in the list is')
    assert.match(preset, /fontSize: WHEEL_NAME_ROUND, fontWeight: '700'/)
    /* The bar's copy: dark ink for the light bar, laid out the same to the point, and nothing to press. */
    const name = flat(src.slice(src.indexOf('export function WheelName(')))
    assert.doesNotMatch(name, /Pressable|onPress|onLongPress|borderWidth|backgroundColor: (?!bar\b)/)
    assert.match(name, /color: color\.chassis, fontSize: WHEEL_NAME, fontWeight: '700'/)
    for (const same of ["flex: 1, height: WHEEL_ROW, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.md", "width: WHEEL_END, height: WHEEL_ROW, alignItems: 'center', justifyContent: 'center'", "<Text numberOfLines={1} style={{ flex: 1, color: ", 'fontSize: font.small, fontFamily: face', 'fontSize: font.lead, fontFamily: face']) {
      assert.ok(preset.includes(same) && name.includes(same), `a preset and its copy in the bar are laid out differently: ${same}`)
    }
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
    assert.match(click, /Haptics\.performAndroidHapticsAsync\(Haptics\.AndroidHaptics\.Clock_Tick\)/, 'Android\'s own tick for a dial being turned')
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
        'haptics.js': 'export let taps = 0\nexport let ticks = 0\nexport const selectionAsync = async () => { taps++ }\nexport const AndroidHaptics = { Clock_Tick: "clock-tick" }\nexport const performAndroidHapticsAsync = async (kind) => { if (kind === "clock-tick") ticks++ }\n',
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
      assert.deepEqual([ios.haptics.taps, ios.haptics.ticks], [1, 0], 'the tap is felt even with no sound loaded')
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
      assert.deepEqual([android.haptics.taps, android.haptics.ticks], [0, 2], 'Android feels the tick of a dial')
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
    assert.match(settings, /\{wheel\.on && wheel\.clicks \? WHEEL_FEELS\.map\(\(feel\) => \( <Choice key=\{feel\} role="radio" on=\{wheel\.feel === feel\} label=\{WHEEL_WORDS\.feels\[feel\]\} sub=\{feel === 'tap' \? WHEEL_WORDS\.feelSub : undefined\} onPress=\{\(\) => saveWheel\(\{ feel \}, sync\)\} \/> \)\) : null\}/, 'sound, tap or both is not a choice while it clicks')
    assert.match(flat(read('mobile/src/screens/Presets.js')), /clicks=\{wheelKept\.clicks\} feel=\{wheelFeel\(wheelKept\)\}/)

    const words = Object.values(r.WHEEL_WORDS).join(' ')
    assert.match(r.WHEEL_WORDS.wheelSub, /Nothing loads until you do\./)
    assert.match(r.WHEEL_WORDS.wheelSub, /Load/)
    assert.match(r.WHEEL_WORDS.clicksSub, /silent mode/)
    assert.match(r.WHEEL_WORDS.wheelSub, /slowly[^.]*flick/, 'the choice does not say that speed matters')
    /* The house rules for words on a screen. */
    assert.doesNotMatch(words, /this phone|your phone|\bbeta\b|\btried\b|official|iPod/i)
  })
}
