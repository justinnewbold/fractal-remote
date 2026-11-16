/**
 * THE DEVICE'S BEAT ON THE UNIT'S BEAT (mobile/src/lib/beatLock.js, the
 * rules; lib/unitBeat.js, the follower; lib/beatBus.js, the hand-off).
 *
 * "The metronome is not matching up properly into the sound coming out of
 * speakers. There's a delay." (Justin, 16 November 2026: his Axe-Fx III
 * clicking through his Raspberry Pi, his phone lighting.) The app kept the
 * unit's tempo and never knew its beat. Now, for his account, the device
 * listens for the unit's own beat and moves its own onto it: through the
 * computer by asking how long ago the last one was and timing the question,
 * over Bluetooth or the cable by hearing it.
 *
 * These run the rules and the follower as they are. The phone's own click
 * moved by them is run in test/mobile.mjs (the click bench), the Bluetooth
 * wire handing the beat on in test/bluetooth.mjs, and the computer app's
 * half in ForgeFX (test/drivers/unit-beat.test.ts).
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

/** The same "random" numbers on every run and every Node. */
function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** The rule file imports nothing, and is run from a copy. */
async function rules() {
  const dir = mkdtempSync(join(tmpdir(), 'beat-lock-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    const src = read('mobile/src/lib/beatLock.js')
    assert.doesNotMatch(src, /^import /m, 'lib/beatLock.js imports something; this check runs it on its own')
    writeFileSync(join(dir, 'rule.js'), src)
    return await import(pathToFileURL(join(dir, 'rule.js')).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * THE FOLLOWER ON A BENCH: lib/unitBeat.js as the phone runs it, beside the
 * real rules and the real hand-off, with stand-ins for the two things that
 * drag the rest of the app in (lib/device, lib/debugLog). Its clock, its
 * timers, its road and its question are the test's, handed in the way the
 * file takes them.
 *
 * `unit` is a pretend unit beating every `period` ms from `phase`, and
 * `computer(there, back)` a pretend computer app that has heard every beat
 * and answers after `there` ms on the way and `back` ms on the way home
 * (each a number or a function), on the bench's clock.
 */
let benches = 0
async function follower() {
  const dir = mkdtempSync(join(tmpdir(), 'unit-beat-'))
  const esm = (src) => src.replace(/from '\.\/([\w.-]+)'/g, (whole, name) => (/\.m?js$/.test(name) ? whole : `from './${name}.js'`))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    writeFileSync(join(dir, 'beatLock.js'), read('mobile/src/lib/beatLock.js'))
    writeFileSync(join(dir, 'beatBus.js'), read('mobile/src/lib/beatBus.js'))
    writeFileSync(join(dir, 'debugLog.js'), 'export const said = []\nexport const logDebug = (source, line) => { said.push(String(line)) }\n')
    /* Never reached: every test hands in its own road and its own question. */
    writeFileSync(join(dir, 'device.js'), "export const unitBeatRoad = () => { throw new Error('the bench has no road of its own') }\nexport const askUnitBeat = async () => { throw new Error('the bench has no computer of its own') }\n")
    writeFileSync(join(dir, 'unitBeat.js'), esm(read('mobile/src/lib/unitBeat.js')))
    const at = (f) => `${pathToFileURL(join(dir, f)).href}?bench=${++benches}`
    const mod = await import(at('unitBeat.js'))
    /* The follower's own copies, by the address it imported them at. */
    const bus = await import(pathToFileURL(join(dir, 'beatBus.js')).href)
    const lock = await import(pathToFileURL(join(dir, 'beatLock.js')).href)
    const log = await import(pathToFileURL(join(dir, 'debugLog.js')).href)
    log.said.length = 0
    mod.__askAgain()

    let t = 100000
    let seq = 0
    const timers = new Map()
    const flush = async () => {
      for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r))
    }
    const clock = {
      now: () => t,
      wait: (fn, ms = 0) => {
        const id = ++seq
        timers.set(id, { id, at: t + Math.max(0, ms), fn })
        return id
      },
      unwait: (id) => timers.delete(id),
      pending: () => timers.size,
      async advance(ms) {
        const end = t + ms
        await flush()
        for (;;) {
          let next = null
          for (const x of timers.values()) if (x.at <= end && (!next || x.at < next.at || (x.at === next.at && x.id < next.id))) next = x
          if (!next) break
          timers.delete(next.id)
          t = next.at
          next.fn()
          await flush()
        }
        t = end
        await flush()
      }
    }
    const pause = (ms) => new Promise((resolve) => clock.wait(resolve, ms))
    /* Beating since before the bench's clock began (100000), so the first question finds a beat. */
    const unit = { period: 500, phase: 95123, beating: true }
    const asks = []
    const of = (d) => (typeof d === 'function' ? d() : d)
    const computer = (there = 0, back = 0) => async () => {
      const asked = clock.now()
      asks.push(asked)
      await pause(of(there))
      /* The answer as the computer app makes it: how long ago the unit's last beat was, right now. */
      const since = clock.now() - unit.phase
      const answer = unit.beating && since >= unit.period ? { ok: true, count: Math.floor(since / unit.period), age: since % unit.period, gap: unit.period } : { ok: true, count: 0, age: null, gap: null }
      await pause(of(back))
      return { answer, asked, answered: clock.now() }
    }
    const follow = (beat, o = {}) => {
      const windows = []
      const stop = mod.followUnitBeat({ beat, onWindow: (w) => windows.push({ ...w, heardAt: clock.now() }) }, { now: clock.now, wait: clock.wait, unwait: clock.unwait, road: () => o.road ?? 'computer', ask: o.ask ?? computer() })
      return { windows, stop }
    }
    /* How far a belief's middle is from the unit's true beat, in the half beat either side. */
    const off = (w, beat = unit.period) => lock.wrap(w.mid - unit.phase, beat)
    return { mod, bus, lock, said: log.said, clock, unit, asks, computer, follow, off, done: () => rmSync(dir, { recursive: true, force: true }) }
  } catch (err) {
    rmSync(dir, { recursive: true, force: true })
    throw err
  }
}

export function run(test) {
  test('beat lock: his account only until the switch says everyone, and the rules import nothing', async () => {
    const r = await rules()
    assert.equal(r.beatLockOn(), false)
    assert.equal(r.beatLockOn({ admin: false, everyone: false }), false, 'every other account has it')
    assert.equal(r.beatLockOn({ admin: true, everyone: false }), true, 'his account does not')
    assert.equal(r.beatLockOn({ admin: false, everyone: true }), true, 'the switch does not open it')
    assert.equal(r.beatLockOn({ admin: 'yes', everyone: 1 }), false, 'something that is not true opened it')
    const features = flat(read('mobile/src/lib/features.js'))
    assert.match(features, /export const BEAT_LOCK_FOR_EVERYONE = false/, 'the switch shipped on: it is his account’s until he has seen it line up')
    /* And the one place it is asked: beside a unit that is clicking, never in the demo. */
    const click = flat(read('mobile/src/lib/metronome.js'))
    assert.match(click, /const follow = beatLockOn\(\{ admin: useBluetoothAdmin\(\), everyone: BEAT_LOCK_FOR_EVERYONE \}\) && clicks\(s, can, heardOn\)\.unit && !isDemo\(\)/)
    assert.match(click, /const unfollow = follow \? followUnitBeat\(\{/, 'the unit’s beat is followed whoever is signed in')
  })

  test('beat lock: a part of a beat either side of nought, and how many beats apart the unit’s messages come', async () => {
    const { wrap, beatsApart } = await rules()
    assert.equal(wrap(0, 500), 0)
    assert.equal(wrap(240, 500), 240)
    assert.equal(wrap(250, 500), 250, 'half a beat is half a beat later')
    assert.equal(wrap(260, 500), -240)
    assert.equal(wrap(-260, 500), 240)
    assert.equal(wrap(5 * 500 + 30, 500), 30)
    assert.equal(wrap(-7 * 500 - 30, 500), -30)
    assert.equal(wrap(30, 0), 0, 'no beat is no distance')
    assert.equal(wrap(NaN, 500), 0)

    assert.equal(beatsApart(500, 500), 1, 'a message every beat')
    assert.equal(beatsApart(2000, 500), 4, 'a message every bar of four')
    assert.equal(beatsApart(4000, 500), 8)
    assert.equal(beatsApart(4500, 500), 0, 'nine beats apart is past what is believed')
    assert.equal(beatsApart(512, 500), 1, 'a few milliseconds of wobble is the same tempo')
    assert.equal(beatsApart(516, 500), 0, 'three percent out is another tempo')
    assert.equal(beatsApart(250, 500), 0, 'twice as fast is another tempo')
    assert.equal(beatsApart(480, 500), 0, '125 BPM is not 120')
    assert.equal(beatsApart(0, 500), 0)
    assert.equal(beatsApart(500, 0), 0)
    assert.equal(beatsApart(null, 500), 0)
  })

  test('beat lock: the computer’s answer is a window that holds the unit’s beat, however lopsided the road', async () => {
    const { windowFromAnswer, BEAT_LOCK, wrap } = await rules()
    const beat = 500
    const random = seeded(11)
    /* A unit beating from 1000, a question that left at `asked`, got there after `there` and home after `back`. */
    for (let i = 0; i < 400; i++) {
      const phase = 1000 + random() * beat
      const asked = 50000 + random() * 5000
      const there = random() * 120
      const back = random() * 120
      const made = asked + there
      const age = (made - phase) % beat
      const got = windowFromAnswer({ ok: true, count: 9, age, gap: beat }, asked, made + back, beat)
      assert.ok(got.window, `no window for a ${Math.round(there + back)} ms round trip`)
      const miss = Math.abs(wrap(got.window.mid - phase, beat))
      assert.ok(miss <= got.window.half - BEAT_LOCK.slackMs + 1e-6, `the beat fell ${miss.toFixed(2)} ms from the middle of a window ${got.window.half.toFixed(2)} ms wide each side`)
      assert.equal(got.window.at, made + back, 'the window is not dated when the answer came')
    }
    /* A quick, even road: the middle is the beat itself. */
    const even = windowFromAnswer({ ok: true, count: 3, age: 120, gap: 500 }, 1000, 1020, 500).window
    assert.equal(even.mid, 890)
    assert.equal(even.half, 10 + BEAT_LOCK.slackMs)

    /* What says nothing, and why. */
    const why = (answer, asked = 1000, answered = 1020, b = 500) => windowFromAnswer(answer, asked, answered, b).why
    assert.equal(why({ ok: true, count: 0, age: null, gap: null }), 'none', 'no beat heard')
    assert.equal(why({ ok: true, count: 1, age: 40, gap: null }), 'none', 'one beat is no tempo yet')
    assert.equal(why({ ok: true, count: 9, age: 40, gap: 480 }), 'tempo', 'beats at another tempo')
    assert.equal(why({ ok: true, count: 9, age: 900, gap: 500 }), 'stale', 'the beats stopped')
    assert.equal(why({ ok: true, count: 9, age: 3200, gap: 2000 }), 'stale', 'a bar’s first beat that is a bar and a half old')
    assert.equal(windowFromAnswer({ ok: true, count: 9, age: 2900, gap: 2000 }, 1000, 1020, 500).window.mid, 1010 - 2900, 'a beat every bar is still a beat to stand on')
    assert.equal(why({ ok: true, count: 9, age: 40, gap: 500 }, 1000, 1400), 'slow', 'a round trip of most of a beat')
    assert.ok(windowFromAnswer({ ok: true, count: 9, age: 40, gap: 500 }, 1000, 1000 + 2 * (500 * BEAT_LOCK.widestOfBeat - BEAT_LOCK.slackMs), 500).window, 'the widest window that still says something is refused')
    assert.equal(why(null), 'bad')
    assert.equal(why({ ok: false, age: 40, gap: 500 }), 'bad')
    assert.equal(why({ ok: true, age: -1, gap: 500 }), 'bad')
    assert.equal(why({ ok: true, age: 'soon', gap: 500 }), 'bad')
    assert.equal(why({ ok: true, age: 40, gap: 500 }, 1020, 1000), 'bad', 'an answer before its question')
    assert.equal(why({ ok: true, age: 40, gap: 500 }, 1000, 1020, 0), 'bad', 'no tempo here to line up')
  })

  test('beat lock: windows joined narrow onto the beat, stay beside the newest one, follow a drift and say when the beat moved', async () => {
    const { joined, windowFromAnswer, BEAT_LOCK, wrap } = await rules()
    const beat = 500
    const phase = 1234
    const random = seeded(5)
    let held = null
    let at = 60000
    const halves = []
    for (let i = 0; i < 40; i++) {
      const there = 5 + random() * 90
      const back = 5 + random() * 90
      const made = at + there
      const next = windowFromAnswer({ ok: true, count: 9, age: (made - phase) % beat, gap: beat }, at, made + back, beat).window
      held = joined(held, next, beat)
      assert.equal(held.moved, false, `sample ${i} was taken for the beat moving`)
      const miss = Math.abs(wrap(held.mid - phase, beat))
      assert.ok(miss <= held.half + 1e-6, `after ${i + 1} windows the beat is ${miss.toFixed(2)} ms from a belief ${held.half.toFixed(2)} ms wide`)
      assert.ok(Math.abs(held.mid - next.mid) <= beat / 2 + 1e-6, 'the belief is not said beside the newest window')
      assert.equal(held.at, next.at)
      halves.push(held.half)
      at += 6000
    }
    assert.ok(halves[halves.length - 1] < halves[0] / 2, `forty windows did not narrow the belief (${halves[0].toFixed(1)} to ${halves[halves.length - 1].toFixed(1)} ms)`)
    assert.ok(halves[halves.length - 1] >= BEAT_LOCK.floorMs, 'a belief closer than the floor')

    /* The first window is the belief. */
    const one = { mid: 1000, half: 20, at: 1100 }
    assert.deepEqual(joined(null, one, beat), { ...one, moved: false })
    assert.equal(joined(one, null, beat), one, 'no new window loses the old one')
    assert.equal(joined(null, null, beat), null)

    /* Two windows that overlap: where they overlap, beside the newest. */
    const two = joined({ mid: 1000, half: 20, at: 1100 }, { mid: 1000 + 12 * beat + 30, half: 20, at: 7100 }, beat)
    assert.equal(two.moved, false)
    const doubt = 20 + (BEAT_LOCK.driftPerSec * 6000) / 1000
    assert.ok(Math.abs(two.mid - (1000 + 12 * beat + (10 + doubt) / 2)) < 1e-6, `the overlap’s middle is at ${two.mid}`)
    assert.ok(Math.abs(two.half - (doubt - 10) / 2) < 1e-6)

    /* Two that miss by a little: the same beat, drifted. The answer is between them, and nothing "moved". */
    const near = joined({ mid: 1000, half: 5, at: 1100 }, { mid: 1000 + 12 * beat + 30, half: 5, at: 7100 }, beat)
    assert.equal(near.moved, false, 'a drift of twenty milliseconds was taken for the beat moving')
    assert.ok(near.mid > 1000 + 12 * beat + 5 && near.mid < 1000 + 12 * beat + 25, `between the two: ${near.mid}`)

    /* Two that miss by a lot: the unit's beat moved, and only the newest says where it is. */
    const next = { mid: 1000 + 12 * beat + 200, half: 10, at: 7100 }
    assert.deepEqual(joined({ mid: 1000, half: 10, at: 1100 }, next, beat), { ...next, moved: true })

    /* Two that barely overlap: the belief is never closer than the floor, however thin the overlap. */
    const thin = joined({ mid: 1000, half: 20, at: 7100 }, { mid: 1000 + 12 * beat + 39.5, half: 20, at: 7100 }, beat)
    assert.equal(thin.moved, false)
    assert.equal(thin.half, BEAT_LOCK.floorMs, 'half a millisecond of overlap was believed to half a millisecond')
    assert.ok(Math.abs(thin.mid - (1000 + 12 * beat + 19.75)) < 1e-6)

    /* A window kept gains doubt: one that would have missed yesterday overlaps after a long quiet. */
    const kept = joined({ mid: 1000, half: 5, at: 0 }, { mid: 1000 + 1200 * beat + 60, half: 5, at: 600000 }, beat)
    assert.equal(kept.moved, false, 'ten minutes of two clocks is not the beat moving')
  })

  test('beat lock: the move puts the click heard, or in silence the light, on the unit’s beat, by the least there is', async () => {
    const { moveFor, notTooSoon, BEAT_LOCK, wrap } = await rules()
    const beat = 500
    const random = seeded(3)
    for (let i = 0; i < 300; i++) {
      const startedAt = 70000 + random() * 3000
      const window = { mid: 90000 + random() * beat, half: 5, at: 90100 }
      const lead = [0, 40, 100, 140][i % 4]
      const by = moveFor(startedAt, window, beat, lead)
      assert.ok(Math.abs(by) <= beat / 2 + 1e-6, `a move of ${by} ms is more than half a beat`)
      /* After it, a beat counted from there is heard `lead` later, on the unit's. */
      const left = wrap(window.mid - (startedAt + by + lead), beat)
      if (by !== 0) assert.ok(Math.abs(left) < 1e-6, `after the move the heard click is ${left.toFixed(3)} ms off the unit’s beat`)
      else assert.ok(Math.abs(left) < BEAT_LOCK.ignoreMs, `no move was made with ${left.toFixed(1)} ms to make up`)
    }
    assert.equal(moveFor(1000, { mid: 1000 + 4 * beat + 5, half: 3, at: 0 }, beat, 0), 0, 'five milliseconds is not worth a move')
    assert.equal(moveFor(1000, { mid: 1000 + 4 * beat + 60, half: 3, at: 0 }, beat, 0), 60)
    assert.equal(moveFor(1000, { mid: 1000 + 4 * beat + 60, half: 3, at: 0 }, beat, 40), 20, 'the click heard forty after its beat starts forty sooner')
    assert.equal(moveFor(1000, { mid: 1000 + 4 * beat - 60, half: 3, at: 0 }, beat, 0), -60)
    assert.equal(moveFor(1000, null, beat, 0), 0)
    assert.equal(moveFor(1000, { mid: 1060, half: 3, at: 0 }, 0, 0), 0)

    /* Never a second click within half a beat of the last. */
    assert.equal(notTooSoon(1200, 1000, 500), 1700, 'a click 200 ms after the last')
    assert.equal(notTooSoon(1250, 1000, 500), 1250, 'half a beat on is soon enough')
    assert.equal(notTooSoon(1600, 1000, 500), 1600)
    assert.equal(notTooSoon(1200, null, 500), 1200, 'nothing clicked yet: nothing to be too soon after')
  })

  test('following through the computer: a few quick questions, then one every few seconds, and each window holds the beat', async () => {
    const b = await follower()
    try {
      const random = seeded(21)
      /* A lopsided road: quick there, slow back, never the same twice. */
      const f = b.follow(500, { ask: b.computer(() => 5 + random() * 20, () => 40 + random() * 60) })
      await b.clock.advance(1500)
      const first = b.asks.map((t) => t - b.asks[0])
      assert.equal(b.asks.length, 4, `asked ${b.asks.length} times in the first second and a half`)
      for (let i = 1; i < first.length; i++) assert.ok(first[i] - first[i - 1] >= b.lock.BEAT_LOCK.quickGapMs, 'the quick questions overlap')
      await b.clock.advance(30000)
      const later = b.asks.slice(4)
      assert.ok(later.length >= 4 && later.length <= 5, `asked ${later.length} times in the next thirty seconds`)
      for (let i = 1; i < later.length; i++) assert.ok(later[i] - later[i - 1] >= b.lock.BEAT_LOCK.everyMs, 'asked more often than every few seconds')

      assert.equal(f.windows.length, b.asks.length, 'an answer with a beat in it was not handed on')
      for (const w of f.windows) assert.ok(Math.abs(b.off(w)) <= w.half + 1e-6, `the unit’s beat is ${b.off(w).toFixed(1)} ms from a belief ${w.half.toFixed(1)} ms wide`)
      assert.ok(f.windows[f.windows.length - 1].half < f.windows[0].half, 'more answers did not narrow the belief')
      assert.ok(Math.abs(b.off(f.windows[f.windows.length - 1])) < 25, 'a lopsided road left the belief far from the beat')
      /* The log says it once. */
      assert.equal(b.said.filter((l) => /the unit’s beat is heard through the computer/.test(l)).length, 1, `said: ${b.said.join(' | ')}`)
      assert.match(b.said[0], /ms there and back, a beat every 500 ms/)

      /* Stopped: nothing more is asked, and nothing is left waiting. */
      const asked = b.asks.length
      assert.equal(b.clock.pending(), 1, 'the next question is not booked while it runs')
      f.stop()
      assert.equal(b.clock.pending(), 0, 'the next question is still booked the moment it is stopped')
      await b.clock.advance(60000)
      assert.equal(b.asks.length, asked, 'asked after it was stopped')
      assert.equal(b.clock.pending(), 0, 'a timer was left behind')
    } finally {
      b.done()
    }
  })

  test('following through the computer: a unit that sends no beat changes nothing, the log says why once, and its beat is taken up when it comes', async () => {
    const b = await follower()
    try {
      b.unit.beating = false
      const f = b.follow(500, { ask: b.computer(10, 10) })
      await b.clock.advance(20000)
      assert.equal(f.windows.length, 0, 'a belief was made from no beat')
      assert.ok(b.asks.length >= 6, 'the question stopped being asked')
      const why = b.said.filter((l) => /not lined up with the unit’s beat: the unit has sent no beat \(Send Realtime Sysex may be off on it: Setup → MIDI\/Remote\)/.test(l))
      assert.equal(why.length, 1, `the log said it ${why.length} times: ${b.said.join(' | ')}`)

      /* Switched on at the unit: the beats come, and the device takes them up. */
      b.unit.beating = true
      b.unit.phase = b.clock.now() + 77
      await b.clock.advance(8000)
      assert.ok(f.windows.length >= 1, 'the unit’s beat was not taken up when it began')
      assert.ok(Math.abs(b.off(f.windows[f.windows.length - 1])) <= f.windows[f.windows.length - 1].half)
      assert.equal(b.said.filter((l) => /the unit’s beat is heard/.test(l)).length, 1)

      /* And a tempo the device is not keeping says nothing either. */
      b.said.length = 0
      b.unit.period = 480
      const before = f.windows.length
      await b.clock.advance(13000)
      assert.equal(f.windows.length, before, 'beats at another tempo moved the belief')
      assert.equal(b.said.filter((l) => /come at another tempo than this device is keeping/.test(l)).length, 1, `said: ${b.said.join(' | ')}`)
      f.stop()
    } finally {
      b.done()
    }
  })

  test('following through the computer: a computer app with no such answer is asked once, and not again for ten minutes', async () => {
    const b = await follower()
    try {
      const old = async () => {
        b.asks.push(b.clock.now())
        throw Object.assign(new Error('Route GET:/tempo/beat not found'), { status: 404 })
      }
      const f = b.follow(500, { ask: old })
      await b.clock.advance(30000)
      assert.equal(b.asks.length, 1, `an old computer app was asked ${b.asks.length} times`)
      assert.equal(f.windows.length, 0)
      assert.equal(b.said.length, 1)
      assert.match(b.said[0], /this computer app does not say when the beat falls yet\. Update the computer app/)
      assert.equal(b.clock.pending(), 0, 'a question is still booked')
      f.stop()

      /* The click stopped and started again, a minute on: still not asked. */
      const again = b.follow(500, { ask: old })
      await b.clock.advance(60000)
      assert.equal(b.asks.length, 1, 'a new beat asked the old computer again inside ten minutes')
      again.stop()

      /* Ten minutes on (the computer app may have updated itself): asked afresh. */
      await b.clock.advance(b.lock.BEAT_LOCK.notAskedMs)
      const later = b.follow(500, { ask: b.computer(10, 10) })
      await b.clock.advance(1000)
      assert.ok(b.asks.length > 1, 'never asked again')
      assert.ok(later.windows.length >= 1, 'an updated computer app’s answer was not used')
      later.stop()

      /* A unit with no such thing (501) is the same as a computer with no such answer. */
      b.mod.__askAgain()
      b.asks.length = 0
      const none = b.follow(500, {
        ask: async () => {
          b.asks.push(b.clock.now())
          throw Object.assign(new Error('unsupported'), { status: 501 })
        }
      })
      await b.clock.advance(30000)
      assert.equal(b.asks.length, 1)
      none.stop()
    } finally {
      b.done()
    }
  })

  test('following through the computer: a question that did not get through is asked again later, said once, and an answer after the stop is dropped', async () => {
    const b = await follower()
    try {
      let down = true
      const good = b.computer(10, 10)
      const flaky = async () => {
        if (down) {
          b.asks.push(b.clock.now())
          throw new Error('the link is down')
        }
        return good()
      }
      const f = b.follow(500, { ask: flaky })
      await b.clock.advance(20000)
      assert.ok(b.asks.length >= 5, 'a link that was down ended the asking')
      assert.equal(b.said.filter((l) => /the question did not get through \(the link is down\)/.test(l)).length, 1, `said: ${b.said.join(' | ')}`)
      down = false
      await b.clock.advance(7000)
      assert.ok(f.windows.length >= 1, 'the link came back and the beat was not taken up')
      f.stop()

      /* An answer on its way home when the click stops goes nowhere. */
      const slow = b.follow(500, { ask: b.computer(10, 200) })
      await b.clock.advance(50)
      slow.stop()
      await b.clock.advance(5000)
      assert.equal(slow.windows.length, 0, 'an answer that came after the stop was used')
      assert.equal(b.clock.pending(), 0)
    } finally {
      b.done()
    }
  })

  test('following over Bluetooth or the cable: the beats this device hears are weighed, two in time first, and nothing is asked', async () => {
    const b = await follower()
    try {
      assert.equal(b.bus.unitBeatListeners(), 0)
      const f = b.follow(500, { road: 'wire', ask: async () => assert.fail('the computer was asked over Bluetooth') })
      assert.equal(b.bus.unitBeatListeners(), 1, 'nothing is listening for the unit’s beat')
      const { wireLateMs, wireDoubtMs, wireEveryMs } = b.lock.BEAT_LOCK
      /* The unit's beats as the adapter delivers them. */
      const hear = async (at) => {
        await b.clock.advance(at - b.clock.now())
        b.bus.unitBeatHeard(at)
      }
      const t0 = b.clock.now() + 40
      await hear(t0)
      assert.equal(f.windows.length, 0, 'one beat alone is no tempo')
      await hear(t0 + 500)
      assert.equal(f.windows.length, 1, 'two beats in time are not used')
      assert.equal(f.windows[0].mid, t0 + 500 - wireLateMs)
      assert.equal(f.windows[0].half, wireDoubtMs)
      /* Not every beat: one every couple of seconds. */
      for (let i = 2; i <= 12; i++) await hear(t0 + i * 500)
      const times = f.windows.map((w) => w.heardAt)
      for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= wireEveryMs, 'a beat was weighed inside two seconds of the last')
      assert.ok(f.windows.length >= 3 && f.windows.length <= 4, `weighed ${f.windows.length} of thirteen beats`)
      assert.ok(!f.windows.some((w) => w.moved), 'steady beats were taken for the beat moving')
      assert.equal(b.said.filter((l) => /the unit’s beat is heard over the adapter or the cable/.test(l)).length, 1)

      /* Beats at another tempo are not this tempo's. */
      const before = f.windows.length
      let at = t0 + 12 * 500
      for (let i = 0; i < 8; i++) await hear((at += 430))
      assert.equal(f.windows.length, before, 'beats 430 ms apart moved a 500 ms beat')

      /* A beat that is not a time is nothing. */
      b.bus.unitBeatHeard(undefined)
      b.bus.unitBeatHeard(NaN)

      /* Stopped: it stops listening, and is not left on the hand-off. */
      f.stop()
      assert.equal(b.bus.unitBeatListeners(), 0, 'a stopped follower is still listening')
      await hear(at + 500)
      await hear(at + 1000)
      await hear(at + 4000)
      assert.equal(f.windows.length, before, 'a beat after the stop was used')
      assert.equal(b.asks.length, 0)
    } finally {
      b.done()
    }
  })

  test('following: with no road to the unit’s beat, no tempo or nobody to tell, nothing is asked and nothing listens', async () => {
    const b = await follower()
    try {
      const asked = async () => assert.fail('asked with nothing to follow')
      const stops = [
        b.mod.followUnitBeat({ beat: 500, onWindow: () => {} }, { now: b.clock.now, wait: b.clock.wait, unwait: b.clock.unwait, road: () => null, ask: asked }),
        b.mod.followUnitBeat({ beat: 0, onWindow: () => {} }, { now: b.clock.now, wait: b.clock.wait, unwait: b.clock.unwait, road: () => 'computer', ask: asked }),
        b.mod.followUnitBeat({ beat: 500 }, { now: b.clock.now, wait: b.clock.wait, unwait: b.clock.unwait, road: () => 'computer', ask: asked })
      ]
      await b.clock.advance(10000)
      assert.equal(b.clock.pending(), 0)
      for (const stop of stops) assert.equal(typeof stop, 'function', 'no way to stop it was handed back')
      for (const stop of stops) stop()
      /* A beat with nobody listening goes nowhere. */
      b.bus.unitBeatHeard(123)
    } finally {
      b.done()
    }
  })

  test('the hand-off: a beat reaches every listener, one that throws does not stop the next, and a listener let go hears no more', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'beat-bus-'))
    try {
      writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
      const src = read('mobile/src/lib/beatBus.js')
      assert.doesNotMatch(src, /^import /m, 'lib/beatBus.js imports something: the store hands a beat on without knowing who wants it')
      writeFileSync(join(dir, 'bus.js'), src)
      const bus = await import(pathToFileURL(join(dir, 'bus.js')).href)
      const a = []
      const c = []
      const stopA = bus.onUnitBeat((at) => a.push(at))
      bus.onUnitBeat(() => {
        throw new Error('a listener broke')
      })
      bus.onUnitBeat((at) => c.push(at))
      bus.unitBeatHeard(10)
      assert.deepEqual([a, c], [[10], [10]])
      stopA()
      bus.unitBeatHeard(20)
      assert.deepEqual([a, c], [[10], [10, 20]])
      assert.equal(typeof bus.onUnitBeat('nothing'), 'function')
      assert.equal(bus.unitBeatListeners(), 2, 'something that is not a listener was kept, or one let go is still counted')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('the words: "in step" only in place of "can be apart", only while it is so, on both screens', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'beat-words-'))
    try {
      writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
      writeFileSync(join(dir, 'rule.js'), read('mobile/src/lib/edgeFlash.js'))
      const e = await import(pathToFileURL(join(dir, 'rule.js')).href)
      assert.equal(e.EDGE_WORDS.inStep, 'In step with the unit’s beat')
      assert.equal(e.apartOrInStep(true), e.EDGE_WORDS.inStep)
      assert.equal(e.apartOrInStep(false), e.EDGE_WORDS.apart)
      assert.equal(e.apartOrInStep(undefined), e.EDGE_WORDS.apart, 'in step is said without being so')
      assert.equal(e.apartOrInStep('yes'), e.EDGE_WORDS.apart)
      const line = (o) => e.soundLine({ quiet: false, edge: true, where: 'unit', note: 'Clicks on the unit', unit: true, noun: 'phone', ...o })
      assert.equal(line({}), `Clicks on the unit. ${e.EDGE_WORDS.apart}`)
      assert.equal(line({ inStep: true }), `Clicks on the unit. ${e.EDGE_WORDS.inStep}`)
      assert.equal(line({ inStep: true, where: 'both', note: 'Both' }), `Both. ${e.EDGE_WORDS.inStep}`)
      /* Nowhere the "apart" sentence is not said: the device alone, the flash off, a unit whose click is not the app's, the sound Off. */
      assert.doesNotMatch(line({ inStep: true, where: 'phone', note: 'On the phone' }), /In step/)
      assert.doesNotMatch(line({ inStep: true, edge: false }), /In step/)
      assert.doesNotMatch(line({ inStep: true, unit: false }), /In step/)
      assert.doesNotMatch(line({ inStep: true, quiet: true }), /In step/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
    /* Both screens hand the rule what the click's own store says. */
    const sw = flat(read('mobile/src/components/MetronomeSwitch.js'))
    assert.match(sw, /const inStep = useInStep\(\)/)
    assert.match(sw, /noun: deviceNoun\(\), inStep \}\)/)
    const settings = flat(read('mobile/src/screens/Settings.js'))
    assert.match(settings, /const beatInStep = useInStep\(\)/)
    assert.match(settings, /\$\{apartOrInStep\(beatInStep\)\}/)
    assert.doesNotMatch(settings, /EDGE_WORDS\.apart/, 'Settings says "apart" without asking whether it is so')
  })
}
