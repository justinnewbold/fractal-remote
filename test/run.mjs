/**
 * Tests for the conversion and validation logic.
 *
 * Every case here comes from a real failure. The write path produced presets
 * that reported success and were silently wrong for an entire evening, and none
 * of it was reproducible without hardware. Now it is.
 */
import assert from 'node:assert/strict'
import { toNormalized, fromNormalized } from '../src/lib/scale.js'
import { isForbiddenParam, isLevelParam, isSilencingParam, levelLimits } from '../src/lib/guardrails.js'
import { validateSpec, countWrites, countSceneWrites } from '../src/lib/validate.js'
import { preferredEncoding, rememberEncoding, disambiguate } from '../src/lib/encoding.js'
import { forbiddenRemotely, explainAuth, timeoutFor, hostNamesFrom, hostConflict } from '../src/lib/remote.js'
import * as link from '../src/lib/link.js'
import * as slots from '../src/lib/slots.js'
import * as names from '../src/lib/presetName.js'
import * as hold from '../src/lib/longPress.js'
import * as lineage from '../src/lib/lineage.js'
import * as gigSize from '../src/lib/gigSize.js'
import * as marks from '../src/lib/presetMarks.js'
import * as setlists from '../src/lib/setlists.js'
import * as palette from '../src/lib/palette.js'
import { readFileSync as readSrc } from 'node:fs'
/*
 * The platform's own join, used by the findForgeFX tests below.
 *
 * Those tests hand in POSIX paths and compared against POSIX strings, which
 * made them fail on Windows for a reason that has nothing to do with the app:
 * findForgeFX builds its guesses with join(), and on Windows join gives
 * backslashes. The app is right either way — a Windows machine's HOME is
 * C:\Users\x and the result is a path Windows can open. Joining the expected
 * value the same way asks about the behaviour rather than about separators.
 */
import { join as joinPath } from 'node:path'
import {
  patchSchemaValue,
  invalidateSchema,
  resetSchemaCache,
  seedSchemaCache,
  cachedSchema
} from '../src/lib/schemaCache.js'

let passed = 0
let failed = 0

/*
 * Async tests are awaited, not fired and forgotten.
 *
 * This used to call fn() and count the test passed on the spot. A test written
 * `async () => {…}` therefore returned a promise nobody held: a failed
 * assertion inside one became an unhandled rejection, which node turns into a
 * crash — so instead of one FAIL line you got a stack trace, no tally, and
 * every test after it never ran at all.
 */
let queue = Promise.resolve()
const test = (name, fn) => {
  const ok = () => {
    passed++
    console.log(`  ok  ${name}`)
  }
  const bad = (err) => {
    failed++
    console.error(`FAIL  ${name}\n      ${err.message}`)
    process.exitCode = 1
  }

  /*
   * An async test is queued behind the ones before it, not started alongside
   * them. Awaiting a set of already-running promises is not the same as
   * running them in order: the device-state tests share one module-level
   * store, so concurrent bodies reset it out from under each other and the
   * failure looks like a bug in the code under test rather than in the runner.
   */
  if (fn.constructor?.name === 'AsyncFunction') {
    queue = queue.then(fn).then(ok, bad)
    return
  }

  try {
    const out = fn()
    if (out && typeof out.then === 'function') queue = queue.then(() => out).then(ok, bad)
    else ok()
  } catch (err) {
    bad(err)
  }
}

/**
 * Every queued test, settled, before anything counts the score.
 *
 * It awaits the queue AGAIN for as long as the queue keeps moving, and that
 * loop is not paranoia — it is a bug this file shipped with.
 *
 * `test()` appends to `queue`. Every call is meant to happen while this file is
 * being read, so by the time anything is awaited the chain is complete. But a
 * missing `})` once left two `test(...)` calls sitting INSIDE another test's
 * body, where they ran when that test ran — appending to the chain after this
 * function had already handed its promise over. The await finished, the tally
 * printed, and the stray async test settled afterwards.
 *
 * What that cost was the summary line. A run with a genuine failure in that
 * test printed "808 passed", with no mention of the failure, and the FAIL line
 * appeared below it — which is precisely the thing the tally at the foot of
 * this file was rewritten to stop. The exit code stayed right throughout, so
 * CI was never fooled; a person reading the log was.
 *
 * It also made the count depend on the Node version. The straggler landed
 * before the summary on Node 22 and after it on Node 20 and 24, so the same
 * commit reported 809 on one and 808 on another, and an upgrade looked like it
 * had eaten a test.
 *
 * Re-awaiting until the chain stops growing costs one extra microtask on a
 * healthy run and cannot be got wrong by a future stray brace.
 */
const settle = async () => {
  let seen
  do {
    seen = queue
    await seen
  } while (queue !== seen)
}

const close = (a, b, tol = 0.0005) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${b}, got ${a}`)

console.log('\nscale')

test('linear midpoint', () => close(toNormalized(5, { min: 0, max: 10 }), 0.5))

test('linear dB matches device report', () =>
  // device reported Amp1 Level -8.001 at norm 0.7199
  close(toNormalized(-8.001, { min: -80, max: 20 }), 0.71999))

test('log matches the device own norm for low cut', () =>
  // device reported 71.999 Hz at norm 0.42866 on a 10-1000 log range
  close(toNormalized(71.999, { min: 10, max: 1000, log: true }), 0.42866, 0.0001))

test('log matches the device own norm for high cut', () =>
  // device reported 10399.685 Hz at norm 0.70748 on 400-40000 log
  close(toNormalized(10399.685, { min: 400, max: 40000, log: true }), 0.70748, 0.0001))

test('log is not linear — the bug that pinned frequencies', () => {
  const log = toNormalized(72, { min: 10, max: 1000, log: true })
  const linear = toNormalized(72, { min: 10, max: 1000 })
  assert.ok(Math.abs(log - linear) > 0.3, 'log and linear should diverge sharply')
})

test('out of range clamps rather than exceeding', () => {
  assert.equal(toNormalized(999, { min: 0, max: 10 }), 1)
  assert.equal(toNormalized(-999, { min: 0, max: 10 }), 0)
})

test('refuses to guess without a range', () =>
  assert.equal(toNormalized(7.5, {}), null))

test('passes through a value already normalised when range is unknown', () =>
  assert.equal(toNormalized(0.5, {}), 0.5))

test('round trips', () => {
  const p = { min: 10, max: 1000, log: true }
  close(fromNormalized(toNormalized(72, p), p), 72, 0.01)
})

console.log('\nguardrails')

test('keeps the controls that can silence a preset out of the quick knob list', () => {
  for (const n of ['Amp1 Level', 'Level', 'Out Level', 'Balance', 'Pan L'])
    assert.ok(isSilencingParam(n), n)
})

test('allows real tone controls', () => {
  for (const n of ['Gain 1', 'Bass 1', 'Master Volume', 'Boost Level', 'Input Level', 'Mix'])
    assert.ok(!isSilencingParam(n), n)
})

test('balance and routing are never the AI to set; a level is', () => {
  for (const n of ['Balance', 'Pan L', 'Output Mode', 'Bypass Mode'])
    assert.ok(isForbiddenParam(n), n)
  for (const n of ['Amp1 Level', 'Level', 'Out Level']) {
    assert.ok(!isForbiddenParam(n), `${n} is refused outright`)
    assert.ok(isLevelParam(n), n)
  }
  // Named a level, but not one: these move a tone, not the output.
  for (const n of ['Boost Level', 'Input Level']) assert.ok(!isLevelParam(n), n)
})

test('a level window is a nudge from where it sits, never near the floor', () => {
  /*
   * The two ends have different jobs. The ceiling keeps a change to a nudge —
   * a lead scene louder than the rhythm one, not a new gain structure. The
   * floor is the one that matters: a preset can be musically perfect and
   * silent, and that failure looks identical to a good one until you play it.
   */
  /*
   * In decibels, in decibels. A block Level runs -80 to +20 dB, and a fifth of
   * that range is -60 dB — silence, not a floor — while 15% of it is a 15 dB
   * step, which is not a nudge. Both ends are read in dB on a dB control: six
   * either way from where it sits.
   */
  const amp = levelLimits({ name: 'Amp 1 Level', value: 0, min: -80, max: 20 })
  assert.deepEqual(amp, { floor: -6, ceiling: 6 })

  const drive = levelLimits({ name: 'Drive Level', value: 5, min: 0, max: 10 })
  assert.deepEqual(drive, { floor: 3.5, ceiling: 6.5 })

  /*
   * Sitting below the floor already — the player's own doing. The window runs
   * from where it sits up to a nudge above, so the only move offered is a
   * raise. The app never drags a level back up on its own; it just will not go
   * down.
   */
  const low = levelLimits({ name: 'Amp 1 Level', value: -70, min: -80, max: 20 })
  assert.deepEqual(low, { floor: -70, ceiling: 0 })

  /*
   * "Amp 1 / Amp1 Level: levels can be nudged, not reset — 0 is outside -80 to
   * -60, so it was skipped." Five of those in one session, across two blocks.
   *
   * A level sitting at the very bottom of a dB range is a block that makes no
   * sound, and the only useful thing to do with it is bring it back to normal.
   * The old window let it climb to -60 dB, which is still silence, and refused
   * every value a tone would actually want. So unity is always in reach from
   * below: no raise towards it can make a preset quiet, which is the one thing
   * this rule exists to prevent.
   */
  for (const at of [-80, -70, -40, -12]) {
    const w = levelLimits({ name: 'Amp1 Level', value: at, min: -80, max: 20, unit: 'dB' })
    assert.ok(w.ceiling >= 0, `a level at ${at} dB cannot be brought back to unity: ${w.ceiling}`)
  }

  /* And it is still a one-way door out of the quiet end: nowhere in the range
     may a write be offered a step down past -20 dB, which is the point a block
     leaves the mix. Above that a level may still be trimmed, which is what the
     control is for. */
  for (const at of [20, 10, 0, -6, -20, -55, -80]) {
    const w = levelLimits({ name: 'Amp1 Level', value: at, min: -80, max: 20, unit: 'dB' })
    assert.ok(
      w.floor >= Math.min(at, -20),
      `a level at ${at} dB can be written down to ${w.floor}`
    )
  }

  /*
   * "Drive 1 / Level: levels can be nudged, not reset — 5 is outside 2 to 1.5,
   * so it was skipped."
   *
   * A range with no numbers in it, printed to a player mid-session. The two
   * ends were worked out independently, so a control already at the very bottom
   * got a floor above its own ceiling and nothing at all could be written —
   * which made a level sitting at zero the one value in the app that could
   * never be raised, on exactly the preset that needs it raised.
   */
  const floored = levelLimits({ name: 'Drive 1 Level', value: 0, min: 0, max: 10 })
  assert.deepEqual(floored, { floor: 0, ceiling: 2 })

  /*
   * And that is a property, not one repaired case: wherever a level sits, that
   * is a value the window admits. Any window that excludes it is a rejection
   * with no number that would have been accepted, printed as a range that reads
   * backwards.
   */
  for (const min of [-80, -20, 0, 1]) {
    for (const max of [-10, 0, 10, 20, 100]) {
      if (max <= min) continue
      for (const at of [0, 0.01, 0.05, 0.2, 0.5, 0.8, 1]) {
        const value = min + (max - min) * at
        const w = levelLimits({ name: 'Amp 1 Level', value, min, max })
        assert.ok(
          w.floor <= value && value <= w.ceiling,
          `${value} of ${min}-${max} is outside its own window ${w.floor} to ${w.ceiling}`
        )
        assert.ok(w.floor >= min && w.ceiling <= max, `the window leaves the parameter's range`)
      }
    }
  }

  assert.equal(levelLimits({ name: 'Bass', value: 5, min: 0, max: 10 }), null)
  assert.equal(levelLimits({ name: 'Amp 1 Level', value: 0 }), null, 'no range, no window')
})

console.log('\nvalidate')

const schema = [
  {
    eid: 58,
    name: 'Amp 1',
    slug: 'amp',
    bypassed: false,
    models: [{ value: 82, name: '5153 100W Blue' }],
    params: [
      { id: 7, name: 'Gain 1', value: 5, min: 0, max: 10 },
      { id: 12, name: 'Low Cut Frequency', value: 10, min: 10, max: 1000, log: true }
    ]
  }
]

test('accepts a good spec and carries the range through', () => {
  const r = validateSpec(
    { presetName: 'test', blocks: [{ eid: 58, type: 82, params: [{ id: 7, value: 7.5 }] }] },
    schema
  )
  assert.equal(r.changes.length, 1)
  assert.equal(r.changes[0].params[0].to, 7.5)
  assert.deepEqual(r.changes[0].params[0].range, { min: 0, max: 10, log: undefined })
})

test('drops an unknown model rather than writing it', () => {
  const r = validateSpec({ blocks: [{ eid: 58, type: 9999, params: [] }] }, schema)
  assert.equal(r.changes.length, 0)
  assert.match(r.problems[0], /isn't in this unit's list/)
})

test('drops an out-of-range value', () => {
  const r = validateSpec({ blocks: [{ eid: 58, params: [{ id: 7, value: 50 }] }] }, schema)
  assert.equal(r.changes.length, 0)
  assert.match(r.problems[0], /outside/)
})

test('drops an unknown block, and says so once', () => {
  const r = validateSpec({ blocks: [{ eid: 999, params: [] }] }, schema)
  assert.equal(r.changes.length, 0)
  assert.match(r.problems[0], /not in this preset/)
  assert.match(r.problems[0], /Amp 1 \(58\)/, 'the ids the preset does hold are the half that names the mismatch')

  /*
   * The same sentence per rejected change turned a preset with nothing in it
   * into six identical lines under a heading reading REJECTED DURING CHECKING.
   * The reader learns nothing from the second copy. The count stays, because
   * how much of the answer went missing is the part worth knowing.
   */
  const many = validateSpec(
    { blocks: [94, 118, 58, 58, 66].map((eid) => ({ eid, params: [] })) },
    []
  )
  const dropped = many.problems.filter((p) => /dropped/.test(p))
  assert.equal(dropped.length, 1, `said ${dropped.length} times: ${dropped.join(' / ')}`)
  assert.match(dropped[0], /all 5 changes/, 'the number dropped is not said')
  assert.match(dropped[0], /empty/, 'an empty preset is not named as the reason')
  assert.ok(
    many.problems.some((p) => /add an amp and a cab/.test(p)),
    'nothing says how to get blocks into an empty preset'
  )
})

/*
 * A block the tone wanted and the preset does not have.
 *
 * "Skipped effect 70 — no such block in this preset." The AM4 run that reported
 * that was asking for three blocks its four slots never held, and every change
 * riding on them died at the check above. The ids are constrained at the schema
 * now; this is where the intent behind them is supposed to land instead.
 */
test('carries what the tone wanted but could not reach', () => {
  const r = validateSpec({ blocks: [], wanted: ['delay', 'Wah'] }, schema)
  assert.deepEqual(r.wanted, ['delay', 'wah'])
  assert.equal(r.problems.length, 0, 'a gap in the chain is not a rejection')
})

test('a wanted list is names only, capped and deduplicated', () => {
  const r = validateSpec(
    {
      blocks: [],
      wanted: ['delay', 'DELAY', '  pitch  ', 7, null, 'a'.repeat(80), 'b', 'c', 'd', 'e', 'f', 'g']
    },
    schema
  )
  assert.ok(r.wanted.length <= 6, `capped, got ${r.wanted.length}`)
  assert.equal(new Set(r.wanted).size, r.wanted.length, 'deduplicated')
  assert.ok(r.wanted.includes('pitch'), 'trimmed')
  assert.ok(
    r.wanted.every((w) => typeof w === 'string' && w.length <= 24),
    'every entry is a short string'
  )
})

test('no wanted list at all is an empty one, never undefined', () => {
  assert.deepEqual(validateSpec({ blocks: [] }, schema).wanted, [])
  assert.deepEqual(validateSpec(null, schema).wanted, [])
})

test('keeps preset names within the 31-char hardware limit', () => {
  const long = validateSpec(
    { presetName: 'a preset name far longer than any Fractal unit will store', blocks: [] },
    schema
  )
  assert.equal(long.presetName.length, 31)
})

test('preserves case and normal punctuation in preset names', () => {
  // Units ship with names like "Leon's Live AM4" — mixed case, apostrophes.
  const r = validateSpec({ presetName: "Leon's Live AM4", blocks: [] }, schema)
  assert.equal(r.presetName, "Leon's Live AM4")
})

test('strips characters the hardware will not store', () => {
  const r = validateSpec({ presetName: 'Drop A  <metal>\n rhythm', blocks: [] }, schema)
  assert.equal(r.presetName, 'Drop A metal rhythm')
})

console.log('\npresets that follow the account')



function buildEntryShape() {
  // The local shape, from history.js — usage is local-only (token cost of the
  // run that made it) and deliberately not stored per account.
  return ['id', 'at', 'name', 'description', 'summary', 'spec', 'device', 'blockNames']
}





/*
 * Copying up, twice, and from the store the Mac actually uses.
 *
 * Both sides of the network are injected here, so what is under test is the
 * rule about what gets sent — which is the part that was wrong — rather than
 * Supabase.
 */
const tone = (name, description, spec = { blocks: [] }) => ({ name, description, spec })











console.log('\nthe order a tone is written in')

const steps = await import('../shared/tone-steps.mjs')

const oneBlock = (extra) => [{ eid: 3, name: 'Amp 1', params: [], ...extra }]

test('a channel is set before the values that belong to it', () => {
  /*
   * A block's parameters belong to the channel it is on. Dial gain on A and
   * then move the block to B and you have dialled a channel nobody hears — and
   * nothing errors, which is what makes this worth pinning.
   */
  const order = steps
    .stepsFor(oneBlock({ channel: 1, params: [{ id: 1, name: 'Gain', to: 6 }] }))
    .map((s) => s.kind)
  assert.deepEqual(order, ['channel', 'reread', 'param'])
})

test('a model is swapped before anything is dialled on it', () => {
  /* Swapping a model replaces the whole parameter set. */
  const order = steps
    .stepsFor(oneBlock({ type: 42, typeName: 'Recto', params: [{ id: 1, name: 'Gain', to: 6 }] }))
    .map((s) => s.kind)
  assert.deepEqual(order, ['type', 'reread', 'param'])
})

test('ranges are re-read whenever the block moved, and never when it did not', () => {
  /*
   * Ranges belong to the model on the channel — a Plexi's gain and a Recto's
   * gain are the same word over a different span, so a value computed against
   * the old range lands somewhere else entirely.
   *
   * It is a STEP rather than something the executor is trusted to remember,
   * because leaving it out is silent: every value still writes.
   */
  const moved = steps.stepsFor(oneBlock({ channel: 2, params: [{ id: 1, name: 'Gain', to: 6 }] }))
  assert.ok(moved.some((s) => s.kind === 'reread'), 'a moved block is dialled against the ranges it used to have')

  const still = steps.stepsFor(oneBlock({ params: [{ id: 1, name: 'Gain', to: 6 }] }))
  assert.ok(!still.some((s) => s.kind === 'reread'), 'a block that did not move pays for a read it does not need')
})

test('bypass is last, so nothing is briefly audible half-dialled', () => {
  /*
   * A block switched on before its values land is a noise through the amp at
   * exactly the moment somebody is listening to hear whether the tone worked.
   */
  const order = steps
    .stepsFor(oneBlock({ bypassed: false, params: [{ id: 1, name: 'Gain', to: 6 }] }))
    .map((s) => s.kind)
  assert.deepEqual(order, ['param', 'bypass'])
})

test('the whole order, on a block that changes everything at once', () => {
  const order = steps
    .stepsFor(
      oneBlock({
        channel: 1,
        type: 42,
        typeName: 'Recto',
        bypassed: false,
        params: [{ id: 1, name: 'Gain', to: 6 }, { id: 2, name: 'Master', to: 5 }]
      })
    )
    .map((s) => s.kind)
  assert.deepEqual(order, ['channel', 'type', 'reread', 'param', 'param', 'bypass'])
})

test('the count a progress line shows includes the re-read', () => {
  /*
   * A bar that skips it stalls visibly on every block that changed model while
   * claiming nothing is happening.
   */
  assert.equal(steps.stepCount(oneBlock({ channel: 1, params: [{ id: 1, name: 'G', to: 1 }] })), 3)
  assert.equal(steps.stepCount([]), 0)
  assert.equal(steps.stepCount(null), 0)
})

test('a step says what it is doing in words both apps will use', () => {
  const [channel] = steps.stepsFor(oneBlock({ channel: 2 }))
  assert.equal(channel.label, 'Amp 1 → channel 2')
  const [, , param] = steps.stepsFor(
    oneBlock({ channel: 2, params: [{ id: 1, name: 'Gain', to: 6, unit: 'dB' }] })
  )
  assert.equal(param.label, 'Amp 1 · Gain → 6 dB', 'a number and its unit run together')
})

test('rubbish in the plan is skipped rather than written somewhere', () => {
  /* A change with no block id cannot name a target, and guessing one writes to
     whatever block happens to be there. */
  assert.deepEqual(steps.stepsFor([null, {}, { eid: 'two' }]), [])
})

test('scenes go after the rig, never with it', () => {
  /*
   * A scene records WHICH BLOCKS ARE ON, not what they sound like. Write them
   * the other way round and every scene is a pattern over a preset that has not
   * been dialled yet.
   */
  assert.equal(steps.rigBeforeScenes([{ eid: 1 }], [{ index: 0 }]), true)
  assert.equal(steps.rigBeforeScenes([], [{ index: 0 }]), false)
  assert.equal(steps.rigBeforeScenes([{ eid: 1 }], []), false)
})

test('the browser still writes in the order the phone does', () => {
  /*
   * The one place these can drift. forgefx.js has carried this order since
   * before it was written down, in numbered comments; the phone reads it off
   * shared/tone-steps.mjs. If somebody reorders the loop over there, the two
   * apps write different presets from the same plan and neither errors.
   */
  const src = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')
  const body = src.slice(src.indexOf('export async function applyChanges'))
  const marks = [
    '1. the channel these values belong to',
    '2. the model on it',
    '3. re-read ranges if either moved',
    '4. parameters, then bypass'
  ]
  let at = -1
  for (const mark of marks) {
    const found = body.indexOf(mark)
    assert.ok(found > -1, `applyChanges no longer says "${mark}" — the order it writes in is unpinned`)
    assert.ok(found > at, `applyChanges moved "${mark}" out of order, so the two apps write differently`)
    at = found
  }
})

console.log('\nplay mode')

const play = await import('../src/lib/playMode.js')

/* A store that behaves like the real one, and one that throws like a private
   window does. */
const playStore = () => {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  }
}
const blockedStore = {
  getItem: () => {
    throw new Error('site data is blocked')
  },
  setItem: () => {
    throw new Error('site data is blocked')
  }
}







console.log('\nserving it locally')

const host = await import('../desktop/lib/host.mjs')

test('the phone is offered an address a phone can reach', () => {
  /*
   * Loopback is useless here by definition — the whole point is a second
   * device. The QR carries the IP rather than the .local name because iOS
   * resolves .local natively and Android often does not, and a scanned code
   * that fails is the worst possible first impression.
   */
  const w = host.addresses({ port: 5056, name: 'fractal', ip: '10.0.0.191' })
  assert.equal(w.forPhone, 'http://10.0.0.191:5056')
  assert.ok(w.all.includes('http://fractal.local:5056'))
  assert.ok(w.all.includes('http://localhost:5056'))
})

test('with no network there is nothing to scan, and it says so rather than lying', () => {
  const w = host.addresses({ port: 5056, ip: null })
  assert.equal(w.forPhone, null)
  assert.equal(w.lan, null)
  // localhost still works for the machine itself.
  assert.ok(w.all.includes('http://localhost:5056'))
})

test('a loopback-only machine yields no phone address', () => {
  const only = () => ({ lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }] })
  assert.equal(host.lanAddress(only), null)
})

test('the first real interface is the one offered', () => {
  const nics = () => ({
    lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    en0: [
      { family: 'IPv6', address: 'fe80::1', internal: false },
      { family: 'IPv4', address: '192.168.1.44', internal: false }
    ]
  })
  assert.equal(host.lanAddress(nics), '192.168.1.44')
})

test('ForgeFX is only found where the server actually is', () => {
  /*
   * A half-finished clone that merely exists is worse than no match: it fails
   * later, further from the cause. So the check is for server/package.json,
   * not for the directory.
   */
  const found = joinPath('/Users/x', 'src/forgefx')
  const exists = (p) => p === joinPath(found, 'server', 'package.json')
  assert.equal(host.findForgeFX({ env: { HOME: '/Users/x' }, exists }), found)
  assert.equal(host.findForgeFX({ env: { HOME: '/Users/x' }, exists: () => false }), null)
})

test('npm can be started on Windows, where npm is not a program', () => {
  /*
   * "Do you actually have to have an app for Windows or is it just a script you
   * can paste into the Windows terminal?"
   *
   * A script, and one already existed — `npm run serve`. It died on its first
   * line on Windows and nowhere else, for a reason that has nothing to do with
   * this app: `npm` there is `npm.cmd`, a batch file, and Node will not spawn
   * one. It used to; the fix for a command-injection flaw (CVE-2024-27980)
   * made it refuse instead.
   *
   * The shell is only ever asked for on the platform that needs it, because
   * turning it on everywhere would change how arguments are parsed on the two
   * platforms this is known to work on.
   */
  assert.deepEqual(host.npmSpawn({ platform: 'win32' }), { shell: true })
  assert.deepEqual(host.npmSpawn({ platform: 'darwin' }), {})
  assert.deepEqual(host.npmSpawn({ platform: 'linux' }), {})
})

test('the serve script actually asks for that, at both places it starts npm', () => {
  /*
   * Two spawns, and missing either one is a Windows-only failure nobody here
   * can see: the build, and the device server itself.
   */
  const src = readSrc(new URL('../scripts/serve.mjs', import.meta.url), 'utf8')
  const code = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ')
  assert.match(code, /import \{[\s\S]*?npmSpawn[\s\S]*?\} from '\.\.\/desktop\/lib\/host\.mjs'/,
    'serve.mjs no longer imports npmSpawn, so npm cannot start on Windows')
  /* Balanced, not a regex. `spawn('npm', ['run','dev'], { cwd: join(a, b) })`
     ends at a bracket the naive pattern took for the end of the call. */
  const calls = []
  for (let i = code.indexOf('spawn('); i !== -1; i = code.indexOf('spawn(', i + 1)) {
    let depth = 0
    for (let j = i + 'spawn'.length; j < code.length; j++) {
      if (code[j] === '(') depth++
      else if (code[j] === ')' && --depth === 0) {
        calls.push(code.slice(i, j + 1))
        break
      }
    }
  }
  assert.ok(calls.length >= 2, `the serve script starts ${calls.length} things, not the build and the server`)
  for (const call of calls) {
    assert.match(call, /npmSpawn\(\)/, `a spawn in serve.mjs skips npmSpawn: ${call.slice(0, 60)}`)
  }
})

test('and so does the script that puts the server inside the app', () => {
  /*
   * THE SAME BUG, IN A SECOND PLACE, and it survived here because nothing on
   * this side of the project had ever run on Windows. The first Windows build
   * got through the entire test suite and died in the vendor script with
   * `spawnSync npm ENOENT` — npm being npm.cmd, which Node will not spawn.
   *
   * npm has its own runner there rather than the option being folded into the
   * general one, because that one also starts git, and a shell would change
   * how git's arguments are parsed on the two platforms this has always
   * worked on — the credential helper in particular.
   */
  const src = readSrc(new URL('../scripts/vendor-forgefx.mjs', import.meta.url), 'utf8')
  const code = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ')
  assert.match(
    code,
    /import \{ npmSpawn \} from '\.\.\/desktop\/lib\/host\.mjs'/,
    'the vendor script no longer imports npmSpawn, so vendoring fails on Windows'
  )
  assert.match(code, /npmSpawn\(\)/, 'the vendor script imports npmSpawn and never asks for it')
  /* And npm is never started through the runner that also starts git. */
  assert.ok(
    !/run\(\s*'npm'/.test(code),
    'npm is started through the git runner again, which spawns no shell and fails on Windows'
  )
})

test('a phone that cannot reach the computer is told the likely reason', async () => {
  /*
   * The address in the menu works from the Mac and fails from a phone, and
   * nothing said why. macOS asks separately about connections arriving from
   * other machines, and until that is allowed the server is listening at a
   * door nobody can knock on.
   *
   * Best effort on purpose: it adds a line to a menu, so anything unclear says
   * nothing. An app that cries wolf about a firewall is worse than a quiet one.
   */
  const say = (out) => () => out
  assert.deepEqual(
    host.readFirewall({ run: say('Firewall is disabled. (State = 0)') }),
    { known: true, on: false, blocked: false }
  )

  // On, and this app explicitly allowed through: nothing to report.
  const allowed = host.readFirewall({
    appPath: '/Applications/Fractal Remote.app',
    run: (_cmd, args) =>
      args[0] === '--getglobalstate'
        ? 'Firewall is enabled. (State = 1)'
        : 'ALF: Fractal Remote is set to allow incoming connections'
  })
  assert.deepEqual(allowed, { known: true, on: true, blocked: false })

  // On and blocking: the case worth a line in the menu.
  const blocked = host.readFirewall({
    appPath: '/Applications/Fractal Remote.app',
    run: (_cmd, args) =>
      args[0] === '--getglobalstate'
        ? 'Firewall is enabled. (State = 1)'
        : 'ALF: Fractal Remote is set to block all incoming connections'
  })
  assert.equal(blocked.blocked, true)

  // Anything it cannot read is not guessed at.
  assert.deepEqual(host.readFirewall({}), { known: false }, 'it guesses when it cannot run the tool')
  assert.deepEqual(
    host.readFirewall({
      run: () => {
        throw new Error('no such tool')
      }
    }),
    { known: false },
    'a missing tool is reported as a firewall answer'
  )
  assert.deepEqual(host.readFirewall({ run: say('something unexpected') }), { known: false })
})

test('the window waits for the server to answer, rather than racing it', async () => {
  /*
   * Spawning is not starting. Fastify listens a second or two after the
   * process exists, and a window opened into that gap gets a refused
   * connection and shows nothing at all — for ever, because a page that failed
   * to load is not retried.
   *
   * That is what the first genuinely working install did: a blank window, no
   * error, and an app that had started correctly. It had looked fine before
   * only because a ForgeFX someone else had running answered instantly.
   */
  let asked = 0
  const up = await host.waitForServer({
    sleep: async () => {},
    fetch: async () => {
      asked += 1
      if (asked < 4) throw new Error('connection refused')
      return { ok: true }
    }
  })
  assert.equal(up, true)
  assert.equal(asked, 4, 'it gave up before the server had a chance to wake')

  // And it does not wait for ever.
  const never = await host.waitForServer({
    attempts: 3,
    sleep: async () => {},
    fetch: async () => {
      throw new Error('connection refused')
    }
  })
  assert.equal(never, false, 'a server that never answers would hang the launch')
})

test('the app refuses to serve from a port something else already holds', async () => {
  /*
   * The first person to run this app got a bare 404 in the window, and the
   * cause was ForgeFX being helpful: it catches EADDRINUSE and re-listens on a
   * port the OS picks. Started by hand that is kind. Started by an app it is a
   * trap, because the app still opens a window on the port it asked for — and
   * a ForgeFX the person already had running answered it, knowing nothing
   * about serving the page.
   *
   * Two of them must not both hold the serial port either, so the launcher
   * asks before it starts anything, and distinguishes a ForgeFX from anything
   * else because the two need different sentences.
   */
  const free = await host.whoHasPort({ connect: (_p, done) => done(false) })
  assert.deepEqual(free, { free: true })

  const theirs = await host.whoHasPort({
    connect: (_p, done) => done(true),
    fetch: async () => ({ ok: true })
  })
  assert.deepEqual(theirs, { free: false, forgefx: true })

  const stranger = await host.whoHasPort({
    connect: (_p, done) => done(true),
    fetch: async () => {
      throw new Error('connection refused')
    }
  })
  assert.deepEqual(stranger, { free: false, forgefx: false })

  assert.match(host.PORT_TAKEN(5056), /already running on this computer, on port 5056/)
  assert.match(host.PORT_TAKEN(), /serial port/, 'the reason two cannot share is not explained')
})






test('two computers on one account cannot quietly write to two units', async () => {
  /*
   * "If I have one Mac connected to an AM4 and one Mac connected to an FM3 and
   * I try to do a remote connection on my phone, how does the app differentiate
   * which device is connected?"
   *
   * It did not. A request is a broadcast on one channel per ACCOUNT —
   * `remote:<uid>` — carrying an id and no address, so every Mac signed into
   * that account hears it and answers. ForgeFX's host agent handles every req
   * it sees without checking whether it was meant for it.
   *
   * A read was therefore a coin flip: two answers, the first resolves and the
   * second is dropped by a `waiting.delete` that runs before it. A write was
   * worse, because it is not a race — BOTH Macs carry it out. One tap, two
   * units.
   *
   * Nothing could detect it either, because every reply looks the same. So the
   * roll call keeps every answer instead of the first, and the read it sends is
   * each Mac's own name — the same round trip counts them and says which.
   */
  const answer = (name) => ({ id: 'x', status: 200, body: JSON.stringify({ data: { name } }) })
  const read = async (p) => p.body

  const two = await hostNamesFrom(
    [answer('Justins MacBook Pro'), answer('Studio computer')],
    read
  )
  assert.deepEqual(two, ['Justins MacBook Pro', 'Studio computer'])

  // A Mac that answered in a shape we did not expect is still a Mac that would
  // carry out the next write, so it counts. Dropping it turns the fault back
  // into the silence this whole thing exists to end.
  const odd = await hostNamesFrom([answer('Studio computer'), { id: 'x', body: 'not json' }], read)
  assert.deepEqual(odd, ['Studio computer', 'a computer'], 'a computer that answered was not counted')

  // The census still counts them. What it no longer does is refuse — see the
  // test below, and hostConflict in shared/relay-rules.mjs.
  assert.equal(hostConflict(['Justins MacBook Pro']), null)
  assert.equal(hostConflict([]), null)
})

test('more than one computer answering is not a reason to refuse', () => {
  /*
   * This used to be the guard rail: two Macs answering meant a write might
   * land on two units, so the app refused until one was chosen and the choice
   * was proved to be honoured.
   *
   * The detection was never wrong — a host is anything signed into the account
   * that answers the census, so an old install or a stray tab answers exactly
   * like the Mac doing the work. The consequence was. What it guarded against
   * needs two hosts each with an amp plugged in; answering a broadcast is not
   * that, and conflating the two left a one-amp rig being asked to choose
   * between two Macs, over and over, with no choice that settled it.
   *
   * Removed by the owner's decision for a rig with one unit. The cost is real
   * and is not hidden: with two hosts each holding an amp, a write reaches
   * both and nothing here says so.
   *
   * Every shape that used to produce a sentence is checked, so restoring the
   * guard is a deliberate act rather than something that comes back by
   * accident on the next edit.
   */
  const two = ['Justins MacBook Pro', 'Studio computer']

  assert.equal(hostConflict(two, null, false), null, 'two computers still refuse a write')
  assert.equal(hostConflict(two, 'Studio computer', false), null, 'an unproved choice still refuses')
  assert.equal(hostConflict(two, 'Studio computer', true), null)
  assert.equal(hostConflict(['MacBook Pro', 'MacBook Pro'], null, false), null, 'a name clash still refuses')
  assert.equal(hostConflict(['MacBook Pro', 'MacBook Pro'], 'MacBook Pro', true), null)
  assert.equal(hostConflict(['a', 'b', 'c'], null, false), null, 'three computers still refuse')
  assert.equal(hostConflict(['Studio computer'], null, false), null)
  assert.equal(hostConflict([]), null)

  // The phone carries its own copy of this rule and the two must not drift:
  // a banner gone on one surface and still up on the other is the same bug
  // reported in half the places. test/mobile.mjs holds them to each other.
  assert.equal(typeof hostConflict, 'function', 'the signature callers rely on is gone')
})

test('nothing is written while two computers are listening', () => {
  /*
   * The sentence above is the explanation; this is the guarantee. A write is
   * refused at the one place every write goes through, so it holds for the
   * chat, the knobs, the generator and anything added later — none of which
   * knows this problem exists.
   *
   * Reads are deliberately still allowed. They are a coin flip rather than a
   * hazard, and the screen that has to explain the fault is built out of them.
   */
  const src = readSrc(new URL('../src/lib/remote.js', import.meta.url), 'utf8')

  /*
   * Asked again at the gate, not remembered from the join. The roll call used
   * to be taken once and every refusal after it answered from that one moment,
   * so a second Mac that had since slept or quit went on blocking writes for
   * the rest of the session. See conflictNow.
   */
  assert.match(
    src,
    /if \(method !== 'GET'\) \{[\s\S]{0,80}const clash = await conflictNow\(\)/,
    'a write can travel again while two computers are answering'
  )
  assert.match(src, /export async function conflictNow\(maxAgeMs = 4000\)/)
  assert.match(src, /if \(!clash\) return null/, 'the ordinary case pays for a roll call it does not need')
  assert.match(
    src,
    /if \(Date\.now\(\) - countedAt < maxAgeMs\) return clash/,
    'a burst of writes re-counts the computers on every one of them'
  )
  // The collector has to run before the resolve, because `waiting.delete` is
  // what makes the second answer invisible.
  assert.match(
    src,
    /const census = payload\?\.id && censuses\.get\(payload\.id\)[\s\S]{0,120}const pending = payload\?\.id && waiting\.get/,
    'the second answer is dropped before anything counts it'
  )
  // Requests name the Mac they are meant for, but only once there is more than
  // one to name and only once that has been proved to work.
  assert.match(
    src,
    /if \(hosts\.length > 1 && chosen && targeted\) ask\.host = chosen/,
    'a request is sent to every computer again, or to one that cannot understand being addressed'
  )
  assert.match(
    src,
    /targeted = answers\.length === 1/,
    'addressing a computer is taken on trust instead of proved'
  )
  // The count, the choice and the proof all belong to the channel they were
  // taken on.
  assert.match(
    src,
    /hosts = \[\]\s*\n\s*units = \{\}\s*\n\s*chosen = null\s*\n\s*targeted = false\s*\n\s*censuses\.clear\(\)/,
    'a stale count outlives its connection'
  )

  const link = readSrc(new URL('../src/lib/link.js', import.meta.url), 'utf8')
  assert.match(link, /countHosts\(\)/, 'the roll call is never taken')
  assert.match(link, /clash: hostConflict\(\)/, 'the app is never told')
  assert.match(link, /export async function chooseHost/, 'there is no way to choose between them')
})

test('each computer advertises itself under its own name', async () => {
  /*
   * The other half, and it bites even when the two Macs are on different
   * accounts. Every Mac asked to be `fractal.local`. bonjour-service probes
   * first, finds the name taken, quietly stops advertising and logs a line to a
   * console nobody reads — so the second Mac has no name, while its own menu
   * goes on offering `http://fractal.local:5056`, built from the name it asked
   * for rather than the one it got. Tapping it opens the other Mac.
   */
  assert.equal(host.mdnsName('Justins-MacBook-Pro.local'), 'fractal-justins-macbook-pro')
  assert.equal(host.mdnsName('Studio Mac'), 'fractal-studio-mac')
  // A DNS label carries letters, digits and hyphens, and nothing else.
  assert.equal(host.mdnsName('MacBook Air (2)'), 'fractal-macbook-air-2')
  assert.ok(!/[^a-z0-9-]/.test(host.mdnsName('Åsa’s computer!!')), 'an illegal character reached a DNS label')
  assert.ok(!/-$/.test(host.mdnsName('x'.repeat(60))), 'a truncated name can end in a hyphen')
  // Nothing to go on is the one case where the old constant is still right.
  assert.equal(host.mdnsName(''), 'fractal')

  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')
  assert.match(main, /FRACTAL_MDNS_NAME \|\| mdnsName\(\)/, 'the computer app still advertises a constant')
})

test('a model roster with no lineage on it gets one', () => {
  /*
   * The unit does not know what its own models are in real life. ForgeFX's AM4
   * driver returns `manufacturer: null, basedOn: null` for every one of them —
   * the catalog fields are gen-3-only — and even an FM3's ordinary read path
   * returns nulls. So the app has carried a lineage for 149 amps and 80 pedals
   * since the beginning and shown it to nobody: the demo read the data files,
   * every real unit got a blank line.
   *
   * This is that roster: names, and nothing else.
   */
  const fromTheUnit = [
    { value: 14, name: 'Brit 800 2204 High', manufacturer: null, basedOn: null },
    { value: 324, name: 'USA MK V Red XT', manufacturer: null, basedOn: null },
    { value: 22, name: 'USA MK IIC+ Bright', manufacturer: null, basedOn: null }
  ]
  const [brit, markV, iic] = lineage.withLineage('amp', fromTheUnit)

  assert.equal(brit.basedOn, '50W Marshall JCM 800 2204', 'the roster came back as bare as it went in')
  /*
   * This one used to answer "Mesa" and nothing more, which is true and is not
   * what anybody wanted to know from a menu of forty Mesas. The family catalog
   * names the amp. See "a family names the amp behind a whole run of models".
   */
  assert.equal(markV.basedOn, 'Mesa/Boogie Mark V')
  // A voicing of a model we know is that model.
  assert.equal(iic.basedOn, 'MESA/Boogie Mark IIC+')

  assert.equal(lineage.gearLine('drive', 'Rat Distortion'), 'Pro Co RAT', 'the pedals say nothing')
  assert.equal(lineage.gearLine('amp', 'USA MK V Red XT'), 'Mesa/Boogie Mark V')

  // The unit is the better authority on its own models: a roster that already
  // carries lineage keeps it.
  const [kept] = lineage.withLineage('amp', [
    { value: 14, name: 'Brit 800 2204 High', manufacturer: 'Marshall', basedOn: 'what the unit said' }
  ])
  assert.equal(kept.basedOn, 'what the unit said')

  // A family with no catalog says nothing rather than something plausible.
  assert.equal(lineage.gearLine('cab', '4x12 CITRUS'), null)
  assert.equal(lineage.gearLine('delay', 'Digital Mono'), null)
})

test('a model we cannot name is left unnamed', () => {
  /*
   * The guard that matters most here, because the failure it prevents is worse
   * than the gap it leaves. A wrong attribution in a guitar app is read by
   * somebody who knows the gear better than the app does.
   *
   * The tempting rule is to take the longest name prefix some sibling shares.
   * It resolves three times as many models and it is confidently wrong: "USA MK
   * IV Lead" becomes a Mark IIC+ because they share "USA MK", and "Mr Z Highway
   * 66" becomes a Dr. Z Maz 38 because they share "Mr Z". Neither is true.
   *
   * So the rule only crosses words that describe a voicing of the same amp —
   * the bright input, the deep switch, the jumpered jacks — and the rest of the
   * name has to match a model in the data exactly.
   */
  /*
   * Both of these are now named, and named CORRECTLY — which is the whole
   * point. The danger was never that they stayed blank; it was the two wrong
   * answers above. A written-down family cannot produce either, because "USA MK
   * IV" and "USA MK IIC+" are two entries and the longer match wins.
   */
  assert.equal(lineage.gearLine('amp', 'USA MK IV Lead'), 'Mesa/Boogie Mark IV')
  assert.equal(lineage.gearLine('amp', 'Mr Z Highway 66'), 'Dr. Z Route 66')
  assert.equal(lineage.gearLine('amp', 'USA MK IIC+ Deep'), 'MESA/Boogie Mark IIC+')

  // Still nothing invented: a name nobody sourced gets no answer at all.
  assert.equal(lineage.gearLine('drive', 'Nobelium OVD-1'), null, 'a pedal with no recorded lineage was given one')
  assert.equal(lineage.gearLine('amp', 'A Model That Does Not Exist'), null)
  assert.equal(lineage.gearLine('amp', ''), null)
  assert.equal(lineage.gearLine('amp', undefined), null)
})

test('the picker keeps what the native menu did for free', () => {
  /*
   * Replacing a <select> means inheriting its whole job, and the parts that
   * cost nothing to have are the parts easiest to lose: it opened at the model
   * you were on, closed on a tap outside and on Escape, took arrow keys, and
   * gave a row you could hit on a dark stage. Losing any of them to get a green
   * caption would be a bad trade.
   */
  const src = readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8')

  // Outside tap and Escape, from the same helper every other popover uses.
  assert.match(src, /useDismiss\(picker, \(\) => setPicking\(false\), \{ open: picking, ignore: '\.type-open' \}\)/)
  // Opens where you already are, rather than at the top of three hundred names.
  assert.match(src, /querySelector\('\[aria-selected="true"\]'\)/)
  assert.match(src, /scrollIntoView\(\{ block: 'center' \}\)/)
  // Arrows, Home and End, wrapping at both ends.
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
    assert.ok(src.includes(`e.key === '${key}'`), `${key} does nothing in the model list`)
  }
  // Over the rows the search left, not the whole list behind them: wrapping
  // round three hundred names while five are on show lands on one you cannot see.
  assert.match(src, /pickAt\(\(i - 1 \+ listed\.length\) % listed\.length\)/, 'arrowing up off the top does not wrap')
  assert.match(src, /pickAt\(listed\.length - 1\)/, 'End goes to the end of the whole list, past what the search shows')

  // Announced as what it is, so it is a listbox to a screen reader too.
  assert.match(src, /aria-haspopup="listbox"/)
  assert.match(src, /aria-expanded=\{picking\}/)
  assert.match(src, /role="listbox" aria-label="Model"/)
  assert.match(src, /aria-selected=\{m\.value === chosenValue\}/)

  const css = readSrc(new URL('../src/styles.css', import.meta.url), 'utf8')
  const rule = (sel) => css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)))
  // A stage-sized target. The blanket 44px floor is on `button`, and this is a
  // button, but the rule sets its own padding so it says the floor out loud.
  assert.match(rule('.type-row {'), /min-height: 44px/)
  // Three hundred rows scroll inside the list rather than running off the end.
  assert.match(rule('.type-list {'), /max-height: min\(55vh, 380px\)/)
  assert.match(rule('.type-list {'), /overflow-y: auto/)
  assert.match(rule('.type-list {'), /overscroll-behavior: contain/)
  /*
   * And it takes its own space rather than floating over the panel. The panel
   * sits inside a sheet whose body scrolls, and a scroll container clips
   * absolutely positioned children at its edge — the first build came out with
   * its last row sliced in half at the bottom of the sheet, and would have lost
   * more of itself on a shorter phone. No z-index fixes that; only not being
   * inside the clip does.
   */
  assert.ok(!/position: absolute/.test(rule('.type-list {')), 'the list floats again, so the sheet can clip it')
})

test('the model picker has a search box above its list', async () => {
  /*
   * "Model pickers have no search." Three hundred and thirty-one amps is a
   * list you scroll for a minute to find the one Plexi you meant, and the
   * phone has had a find box over its list all along.
   */
  const src = readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8')

  // The box, and above the list rather than under three hundred rows.
  const box = src.indexOf('className="type-search"')
  assert.ok(box > 0, 'the model list has no search box')
  assert.ok(box < src.indexOf('role="listbox" aria-label="Model"'), 'the search box is under the list')
  assert.match(src, /aria-label="Search models"/)

  // The rows drawn are the ones the search left.
  assert.match(src, /\{listed\.map\(\(m, i\) => \(/, 'the list still draws every model whatever is typed')
  assert.ok(!/\{models\.map\(\(m, i\) => \(/.test(src), 'the list still draws every model whatever is typed')
  /*
   * Word by word, on the name or the amp it is based on, through the same
   * match as the gear sheet in Settings so the two cannot disagree. `gear` is
   * the lineage alone: the maker would put all forty Mesas under "mesa".
   */
  assert.match(src, /import \{ searchGear \} from '\.\.\/lib\/gearCatalog'/)
  assert.match(src, /searchGear\(models\.map\(\(m\) => \(\{ \.\.\.m, gear: m\.basedOn \}\)\), hunt\)/)

  const { GEAR_GROUPS, searchGear } = await import('../src/lib/gearCatalog.js')
  const amps = GEAR_GROUPS.find((g) => g.key === 'amp').entries.map((e, value) => ({
    value,
    name: e.name,
    basedOn: e.basedOn,
    manufacturer: e.manufacturer
  }))
  const search = (q) => searchGear(amps.map((m) => ({ ...m, gear: m.basedOn })), q)
  const plexi = search('marshall plexi')
  assert.ok(plexi.length, 'the real amp’s name finds nothing')
  assert.ok(plexi.every((m) => /marshall/i.test(`${m.name} ${m.basedOn}`)))
  assert.equal(search('plexi marshall').length, plexi.length, 'the order the words were typed in matters')
  assert.ok(search('brit 800').length, 'the model’s own name finds nothing')
  assert.equal(search('  ').length, amps.length, 'an empty box hides models')
  assert.equal(search('zzzz nothing').length, 0)
  // Rows keep what they are, so a pick still sends the model's own number.
  assert.ok(plexi.every((m) => Number.isInteger(m.value)))

  // And an empty answer says so, in the same words the phone uses.
  assert.match(src, /\{picking && !listed\.length \? <p className="hint type-none">Nothing named like that\.<\/p> : null\}/)

  // Every opening starts from the whole list.
  assert.match(src, /if \(!picking\) setHunt\(''\)/)

  /*
   * The box takes the typing only when a mouse opened the list. A focused box
   * on a phone brings the keyboard up over the list you opened to look at.
   */
  assert.match(src, /onPointerDown=\{\(e\) => \{\s*openedWith\.current = e\.pointerType/)
  assert.match(src, /if \(how === 'mouse'\) huntRef\.current\?\.focus\(\{ preventScroll: true \}\)\s*else here\?\.focus/)

  // Enter in the box picks nothing: a model change is a sound change.
  const keys = src.slice(src.indexOf('const onHuntKey = '), src.indexOf('const valueOf = '))
  assert.ok(keys.includes("e.key === 'Enter'"), 'Enter in the box is not handled')
  assert.ok(!/swapModel|applyModel|setPicking/.test(keys), 'Enter in the search box picks a model on its own')
  assert.match(src, /onKeyDown=\{onHuntKey\}/)
  // Down from an empty box goes to the model you are on, not row 1 of 331.
  assert.match(keys, /hunt\.trim\(\) \? -1 : listed\.findIndex\(\(m\) => m\.value === chosenValue\)/, 'Down from the box goes to the top of the list instead of the model you are on')
  assert.ok(!/'ArrowDown'\) \{\s*e\.preventDefault\(\)\s*pickAt\(0\)/.test(keys), 'Down from the box always goes to the top of the list')

  // Wide enough for a phone: the bare field rule's 230px is wider than the panel.
  const css = readSrc(new URL('../src/styles.css', import.meta.url), 'utf8')
  const rule = css.slice(css.indexOf('input.type-search {'), css.indexOf('}', css.indexOf('input.type-search {')))
  assert.match(rule, /min-width: 0/)
  assert.match(rule, /width: 100%/)
})

test('the block panel calls every hook before it can return early', () => {
  /*
   * The picker's hooks sat below `if (!block) return`, which is one number of
   * hooks on a render with no block and another on the render one arrives.
   * React throws on that and the editor goes blank.
   */
  const src = readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8')
  const start = src.indexOf('export function BlockPanel(')
  const rest = src.slice(start + 1)
  const body = src.slice(start, start + 1 + rest.search(/\n(?:export )?function /))
  const early = body.indexOf('  if (!block) {')
  assert.ok(early > 0, 'the empty panel’s early return has moved; point this test at it')
  const after = [...body.slice(early).matchAll(/\buse[A-Z]\w*\(/g)].map((m) => m[0])
  assert.deepEqual(after, [], 'a hook is called after the panel can return early')
  for (const hook of ['const [picking, setPicking] = useState(false)', "const [hunt, setHunt] = useState('')", 'useDismiss(picker,']) {
    assert.ok(body.indexOf(hook) > 0 && body.indexOf(hook) < early, `${hook} is below the early return`)
  }
})

test('a family names the amp behind a whole run of models', async () => {
  /*
   * "Search for the real life names that each AMP and all other effects are
   * based off of and list them next to the name."
   *
   * Two thirds of the roster used to answer with a maker: "Mesa/Boogie", forty
   * times over, in a menu whose whole difficulty is telling forty Mesas apart.
   * The names are built family-then-voicing throughout — "Recto2" is the amp,
   * "Orange Vintage" is which channel in which mode — so the family is the part
   * worth translating and one line covers every model on it.
   */
  const amps = (await import('../src/data/amp-types.json', { with: { type: 'json' } })).default
  const named = amps.filter((m) => lineage.lineageFor('amp', m.name)?.basedOn)
  assert.equal(named.length, amps.length, `${amps.length - named.length} amp models still cannot say what they are`)

  assert.equal(lineage.gearLine('amp', 'Recto1 Orange Normal'), 'Mesa/Boogie two-channel Dual Rectifier')
  assert.equal(lineage.gearLine('amp', 'Recto2 Red Modern'), 'Mesa/Boogie three-channel Dual Rectifier')
  assert.equal(lineage.gearLine('amp', 'Archean Clean'), 'PRS Archon')
  assert.equal(lineage.gearLine('amp', 'Triple Crest 3'), 'Mesa/Boogie Triple Crown')
})

test('the longest family wins, so one amp never answers for another', () => {
  /*
   * The guard that makes a prefix rule safe at all. "USA MK IIC++" is a modded
   * IIC+ and its name begins with "USA MK IIC+"; "Plexi Studio 20" is a 20-watt
   * head and its name begins with "Plexi". Shortest-match would get both wrong
   * with total confidence.
   */
  assert.equal(lineage.familyFor('amp', 'USA MK IIC++').family, 'USA MK IIC++')
  assert.equal(lineage.familyFor('amp', 'USA MK IIC+ Deep').family, 'USA MK IIC+')
  assert.equal(lineage.familyFor('amp', 'Plexi Studio 20').family, 'Plexi Studio 20')
  assert.equal(lineage.familyFor('amp', 'Plexi 50W Jumped').family, 'Plexi')
  assert.equal(lineage.familyFor('amp', 'Euro Uber').family, 'Euro Uber')

  // Whole words only. Without that a family claims any name it merely begins.
  // A model named exactly for its family is that family: "Mr Z Highway 66" and
  // "5F1 Tweed" are both the whole name and the whole family.
  assert.equal(lineage.familyFor('amp', 'Recto1').family, 'Recto1')
  assert.equal(lineage.familyFor('amp', 'Rectofoo Bright'), null, '"Recto1" claimed a name it only spells the start of')
  assert.equal(lineage.familyFor('amp', 'Recto1x Red'), null, 'the match crossed the middle of a word')
  assert.equal(lineage.familyFor('amp', 'Nothing At All'), null)
  assert.equal(lineage.familyFor('amp', ''), null)
  assert.equal(lineage.familyFor('nosuchblock', 'Recto1 Orange Normal'), null)
})

test('a model the unit already named is never overruled by a family', () => {
  // The per-model catalog is the more specific of the two, and where the unit
  // itself supplies one it is the better authority still.
  assert.equal(
    lineage.gearLine('amp', 'Brit 800 2204 High'),
    '50W Marshall JCM 800 2204',
    'a family answered over a model that named itself more precisely'
  )
  const [kept] = lineage.withLineage('amp', [
    { value: 1, name: 'Recto1 Orange Normal', manufacturer: null, basedOn: 'what the unit said' }
  ])
  assert.equal(kept.basedOn, 'what the unit said')
})

test('the pedals and the wahs say what they are too', () => {
  /*
   * "…and all other effects." Drives already had a catalog; the wahs had none
   * and every one of them is a code word for a real pedal. Both come from
   * Fractal's own Blocks Guide, which names them outright.
   */
  assert.equal(lineage.gearLine('wah', 'Cry Babe'), 'Dunlop Cry Baby')
  assert.equal(lineage.gearLine('wah', 'Clyde'), 'Vox Clyde McCoy wah')
  assert.equal(lineage.gearLine('comp', 'DynamiComp'), 'MXR Dyna Comp')
  assert.equal(lineage.gearLine('delay', 'Graphite Copy Delay'), 'MXR Carbon Copy analog delay')
  assert.equal(lineage.gearLine('drive', "Box o' Crunch"), 'MI Audio Crunch Box')

  // withLineage guarded on the per-model catalog, which wah and comp do not
  // have — guarding on that alone skipped the new families whole.
  const [wah] = lineage.withLineage('wah', [{ value: 0, name: 'Cry Babe', manufacturer: null, basedOn: null }])
  assert.equal(wah.basedOn, 'Dunlop Cry Baby')

  /*
   * And the families that genuinely have nothing to translate keep saying
   * nothing. A Fractal reverb type is called "Medium Plate" — it is already in
   * plain English, and inventing a machine for it would be the one failure this
   * whole file exists to avoid.
   */
  assert.equal(lineage.gearLine('reverb', 'Medium Plate'), null)
  assert.equal(lineage.gearLine('chorus', 'Analog Stereo'), null)
  assert.equal(lineage.gearLine('cab', '4x12 CITRUS'), null)
})

test('the list itself says what each model is, not just the one already chosen', () => {
  /*
   * The line under the control describes the model already selected, which is
   * the one model nobody is wondering about. Two hundred code words in the menu
   * above it were the actual question.
   */
  const src = readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8')
  /*
   * Two elements, not one string. It WAS one string — "Name — Real Amp" inside
   * an <option> — and that is as far as a native menu goes: an option is a
   * single run of text, and on iOS the system draws it and ignores the rest.
   * There was no half of it to make smaller and no half to make green, so the
   * list is ours and the two halves are two spans.
   */
  assert.match(src, /<span className="type-row-name">\{m\.name\}<\/span>/)
  assert.match(src, /\{m\.basedOn \? <span className="type-row-gear">\{m\.basedOn\}<\/span> : null\}/)
  // The maker alone is not used here on purpose: "Mesa/Boogie" under forty rows
  // tells nobody which one is the Rectifier.
  assert.ok(!/type-row-gear">\{m\.manufacturer/.test(src), 'every row is being captioned with its maker')
  assert.ok(!/<option /.test(src), 'a native option is back, and cannot carry two sizes')

  const css = readSrc(new URL('../src/styles.css', import.meta.url), 'utf8')
  const rule = (sel) => css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)))

  // Smaller, and green: --f-1 is the smallest step the app keeps and --ok is
  // the green it already says a sure thing in, tuned for both themes.
  assert.match(rule('.type-row-gear {'), /font-size: var\(--f-1\)/)
  assert.match(rule('.type-row-gear {'), /color: var\(--ok\)/)
  assert.match(rule('.type-row-name {'), /font-size: var\(--f-3\)/)

  // The name still leads on the closed control, so what cannot fit is trimmed
  // off the far end — the half spelled out underneath it anyway.
  assert.match(rule('.type-open-name {'), /text-overflow: ellipsis/)
})

test('what a model really is reaches the screen', () => {
  /*
   * The catalog is worth nothing sitting in a file. The roster read off the
   * unit is where the picker gets it, and until it did, that picker listed 331
   * amps and knew none of them by a name a person would use.
   *
   * There was a third place: the row that asked you to accept a model change
   * the AI proposed. That went with the AI. The lineage did not — it is what
   * the gear sheet is built on.
   */
  const src = (p) => readSrc(new URL(p, import.meta.url), 'utf8')

  assert.match(
    src('../src/lib/forgefx.js'),
    /withLineage\(\s*slug,/,
    'the roster is read straight off the unit again, so it carries no lineage'
  )
  // Two verbs on purpose: "Based on Mesa" is not English, and no article fixes
  // it for a maker called Custom Audio Amplifiers.
  assert.match(
    src('../src/components/Console.jsx'),
    /Modelled on \$\{chosen\.manufacturer\}/,
    'the picker says nothing for a model whose maker is all we know'
  )
})

test('quitting always finishes, and never leaves the server holding the port', async () => {
  /*
   * Reported from a real Mac: "after closing it, it won't let you reopen it.
   * You have to force close then restart."
   *
   * Two halves of that are here. The quit handler cancelled the quit, awaited
   * the mDNS teardown and then asked to quit again — so anything thrown in
   * between left an app that would not close. And the server was sent SIGINT
   * and abandoned, so a child that ignores it outlives the app still holding
   * port 5056, and the next launch finds a ForgeFX it did not start, says so,
   * and quits.
   */
  const sleep = async () => {}

  // An advert that throws on the way down must not stop anything.
  const angry = await host.shutdown({
    advert: {
      stop: async () => {
        throw new Error('the network went away')
      }
    }
  })
  assert.equal(angry.advert, 'failed', 'a thrown teardown was not contained')

  // A server that goes on SIGINT is left alone.
  const signals = []
  let running = true
  const polite = await host.shutdown({
    server: {},
    kill: (_p, sig) => {
      signals.push(sig)
      running = false
    },
    alive: () => running,
    sleep
  })
  assert.deepEqual(signals, ['SIGINT'])
  assert.equal(polite.server, 'stopped')

  // One that ignores it is killed, so the port is free for the next launch.
  const stubborn = []
  const killed = await host.shutdown({
    server: {},
    kill: (_p, sig) => stubborn.push(sig),
    alive: () => true,
    sleep,
    grace: 300,
    step: 100
  })
  assert.deepEqual(stubborn, ['SIGINT', 'SIGKILL'], 'a server that ignores SIGINT is left running')
  assert.equal(killed.server, 'killed')

  // A server that is already gone is not signalled at all.
  const dead = []
  const gone = await host.shutdown({
    server: {},
    kill: (_p, sig) => dead.push(sig),
    alive: () => false,
    sleep
  })
  assert.deepEqual(dead, [])
  assert.equal(gone.server, 'already gone')

  // Nothing to do is a normal answer, not a throw.
  assert.deepEqual(await host.shutdown(), { advert: 'none', server: 'none' })
})

test('an advert that never answers cannot hold the app open', async () => {
  /*
   * The one that came back, on a real Mac, months later: "closing the app
   * doesn't close it all the way — the only way is to force close."
   *
   * Underneath advert.stop() is bonjour-service putting a goodbye packet on the
   * network and calling back when it has gone out. That callback is not
   * guaranteed to arrive: a wifi network that changed, a socket that errored, a
   * machine that slept. It was awaited with no deadline, so when it did not
   * come the promise never settled, app.quit() was never reached, and there was
   * no way out but Force Quit.
   *
   * Which by then cost more than a nuisance. An update installs when the app
   * quits; Force Quit is SIGKILL, so it never installs, and the same "an update
   * is ready" line is waiting the next time.
   *
   * Raced against a clock here rather than simply awaited, so that the old
   * behaviour fails this test instead of hanging the whole suite on it.
   */
  const answer = await Promise.race([
    host.shutdown({
      advert: { stop: () => new Promise(() => {}) },
      sleep: async () => {}
    }),
    new Promise((r) => setTimeout(() => r('never finished'), 500))
  ])

  assert.notEqual(answer, 'never finished', 'a teardown that never answers stops the app quitting')
  assert.equal(answer.advert, 'gave up')

  // And an advert that answers normally is still waited for, not abandoned.
  const polite = await host.shutdown({ advert: { stop: async () => {} }, sleep: async () => {} })
  assert.equal(polite.advert, 'stopped')
})

test('clicking the app again opens its window', () => {
  /*
   * macOS does not start a second copy when the app is clicked again; it
   * activates the running one and sends `activate`. With nothing listening for
   * that, the click did nothing and the app looked dead. (Closing the window
   * now quits — see the test below — but the tray icon still opens it.)
   */
  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')
  assert.match(main, /app\.on\('activate', \(\) => \{\s*\n\s*if \(where\) openWindow\(\)/, 'clicking the app again opens nothing')
  assert.match(main, /tray\.on\('click', openWindow\)/, 'clicking the menu-bar icon opens nothing')
  // And the quit path no longer cancels a quit it might never re-ask for.
  assert.match(main, /let quitting = false/, 'the quit handler can cancel its own second quit again')
  assert.match(main, /shutdown\(\{ server, advert \}\)/, 'quitting does not go through the tested shutdown')
  assert.ok(!/await advert\.stop\(\)/.test(main), 'the un-caught teardown that could block a quit is back')
})

test('an update never depends on the quit working', () => {
  /*
   * The loop this breaks, seen on a real Mac and reported with a Force Quit
   * window open next to the notice:
   *
   *   the update installs when you quit
   *     -> quitting does not finish
   *       -> Force Quit, which is a hard kill and installs nothing
   *         -> the same version is offered at the next launch, for ever
   *
   * And the fix for the quit was inside the version that could not be
   * installed, so nothing in that loop could ever break it from the inside. It
   * had to be broken by hand, once, with a disk image.
   *
   * Installing on quit stays the default: nothing restarts itself on a machine
   * with a guitar plugged into it. What is added is a second way out that a
   * PERSON presses — which was never the thing the design was against.
   */
  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')
  const preload = readSrc(new URL('../desktop/preload.js', import.meta.url), 'utf8')
  const updates = readSrc(new URL('../desktop/lib/updates.mjs', import.meta.url), 'utf8')
  const ui = readSrc(new URL('../src/components/Updates.jsx', import.meta.url), 'utf8')

  // The channel exists end to end, or the button is a button that does nothing.
  assert.match(updates, /install: \(\) => \{/, 'the updater cannot be told to install')
  assert.match(updates, /updater\.quitAndInstall\(\)/, 'installing does not install')
  assert.match(preload, /install: \(\) => ipcRenderer\.invoke\('updates:install'\)/, 'the page cannot ask')
  assert.match(main, /ipcMain\.handle\('updates:install'/, 'nothing answers the page')
  assert.match(ui, /bridge\.updates\.install\(\)/, 'the notice never offers it')

  // And only for an update that is actually sitting there, so this cannot
  // become a way to restart the app for any other reason.
  assert.match(
    main,
    /if \(update\?\.kind !== 'ready'\) return \{ ok: false, reason: 'nothing-ready' \}/,
    'the app can be restarted with no update to install'
  )

  // The server goes down first either way. A ForgeFX left holding port 5056
  // stops the next launch dead, and the next launch is the whole point here.
  assert.match(main, /await stopServing\(\)\s*\n/, 'installing leaves the device server running')
  assert.match(main, /async function stopServing\(\)/, 'the teardown is not shared with the quit')
})

test('the update offers a restart in the words every other computer app uses', () => {
  /*
   * "On most Mac apps that update it usually says refresh app to update and
   * they click one button and it closes the app for them. Is it possible for
   * us to do that?" It already did — but the notice led with "installs when
   * you quit" and the button said "Install now", so the one-button restart
   * read as a technicality under a wait.
   */
  const ui = readSrc(new URL('../src/components/Updates.jsx', import.meta.url), 'utf8')
  const notice = ui.slice(ui.indexOf('export function UpdateReadyNotice'))
  assert.match(notice, /Restart to update/, 'the button does not say what it does')
  assert.match(notice, /closes and reopens/, 'nothing says the app comes back on its own')
  assert.match(notice, /className="primary"[\s\S]*?Restart to update/, 'the restart is a chip beside Later rather than the thing to press')
  assert.ok(!/'Install now'/.test(ui), 'the button still says Install now')
  // The quiet default is unchanged: Later still leaves it to install on quit.
  assert.match(notice, /installs the next time you quit/)
  assert.match(notice, /Later/)
  // And Setup offers the same button, so the notice being dismissed is not the end of it.
  const panel = ui.slice(ui.indexOf('export default function Updates'), ui.indexOf('export function UpdateReadyNotice'))
  assert.match(panel, /updateReady\(state\) && bridge\.updates\.install[\s\S]*?Restart to update/, 'Setup has no way to finish an update that is sitting there')
})

test('nothing can stop the app closing', () => {
  /*
   * Three separate ways the quit could stall, each of which read to the person
   * holding the Mac as "it will not close". The deadline inside shutdown is
   * tested above; these are the two in the shell, plus the backstop that covers
   * whatever turns out to be next.
   */
  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')

  // A server dying because we just killed it is not news, and a modal box
  // during a quit is a box with no window and no dock icon to belong to.
  assert.match(
    main,
    /if \(code && !quitting\)/,
    'a server stopped by the quit still opens a dialog in the middle of it'
  )

  // The dock is not ours to touch on the way out.
  assert.match(main, /if \(quitting \|\| !app\.dock\) return/, 'the dock is still changed while quitting')

  // And the promise that outranks all of it.
  assert.match(main, /setTimeout\(\(\) => app\.exit\(0\), QUIT_DEADLINE_MS\)/, 'there is no backstop on the quit')
  assert.match(main, /const QUIT_DEADLINE_MS = \d+/, 'the quit deadline is not a named number')
})

test('an installed app uses the server it shipped with', () => {
  /*
   * The packaged app hands findForgeFX the copy inside its own bundle. That has
   * to beat the developer locations, or an app installed on a machine that also
   * has a checkout would run the checkout — which is the kind of thing that
   * works on the machine it was built on and nowhere else.
   *
   * FORGEFX_PATH still wins over both: it is somebody deliberately saying where.
   */
  const exists = () => true
  const vendored = '/Applications/Fractal Remote.app/Contents/Resources/vendor/forgefx'
  assert.equal(host.findForgeFX({ env: { HOME: '/Users/x' }, exists, extra: [vendored] }), vendored)
  assert.equal(
    host.findForgeFX({ env: { HOME: '/Users/x', FORGEFX_PATH: '/opt/ff' }, exists, extra: [vendored] }),
    '/opt/ff',
    'pointing FORGEFX_PATH at a checkout no longer overrides the bundled copy'
  )
  // And with nothing bundled, the old behaviour is untouched.
  assert.equal(host.findForgeFX({ env: { HOME: '/Users/x' }, exists }), joinPath('/Users/x', 'src/forgefx'))
})

test('FORGEFX_PATH wins over the guesses', () => {
  const exists = () => true
  assert.equal(
    host.findForgeFX({ env: { HOME: '/Users/x', FORGEFX_PATH: '/opt/ff' }, exists }),
    '/opt/ff'
  )
})

test('the server is told to serve this app — the whole of local mode', () => {
  // FORGEFX_STATIC is what makes the page and the device API the same origin,
  // which is what lets a phone skip the account entirely.
  const env = host.serverEnv({ env: { PATH: '/bin' }, port: 5056, dist: '/app/dist' })
  assert.equal(env.FORGEFX_STATIC, '/app/dist')
  assert.equal(env.PORT, '5056')
  assert.equal(env.PATH, '/bin', 'the rest of the environment must survive')
})

test('ForgeFX is started already able to host a phone', async () => {
  /*
   * The three account variables used to be a `.env` edit on the Mac — the one
   * step that stopped anyone who was not a developer. Set by the launcher,
   * every launch, they are simply true. An operator's own values still win.
   */
  const { DEFAULT_PROJECT } = await import('../desktop/lib/project.mjs')
  const env = host.serverEnv({ env: { PATH: '/bin' }, port: 5056, dist: '/app/dist' })
  assert.equal(env.AXIS_CLOUD, '1', 'ForgeFX will not host a phone without this')
  assert.equal(env.SUPABASE_URL, DEFAULT_PROJECT.url)
  assert.equal(env.SUPABASE_ANON_KEY, DEFAULT_PROJECT.anonKey)

  const own = host.serverEnv({
    env: { SUPABASE_URL: 'https://mine.supabase.co', SUPABASE_ANON_KEY: 'k', AXIS_CLOUD: '0' },
    port: 5056,
    dist: '/d'
  })
  assert.equal(own.SUPABASE_URL, 'https://mine.supabase.co', "an operator's own project was overwritten")
  assert.equal(own.SUPABASE_ANON_KEY, 'k')
  assert.equal(own.AXIS_CLOUD, '0', 'an operator turning the cloud off was overruled')
})

test('the packaged app starts a device server, not a second copy of itself', () => {
  /*
   * `process.execPath` in a packaged Electron app is the Electron binary, so
   * spawning it with a script launches the app again rather than running the
   * script. The whole of the fix is one variable, and the failure it prevents
   * is the app opening perfectly and never finding the unit — which reads like
   * a cable problem and is not one.
   *
   * The terminal launcher is already Node and must not set it: Node exits on
   * an unknown flag it does not have, and more to the point it would be a lie.
   */
  const asNode = host.serverEnv({ env: {}, port: 5056, dist: '/d', asNode: true })
  assert.equal(asNode.ELECTRON_RUN_AS_NODE, '1')
  const plain = host.serverEnv({ env: {}, port: 5056, dist: '/d' })
  assert.equal(plain.ELECTRON_RUN_AS_NODE, undefined, 'the terminal launcher claims to be Electron')
})

test('the web app and the launchers name the same project', async () => {
  // Two copies of a URL and a key drift; the phone then signs into one
  // project and the Mac hosts on another, and neither ever hears the other.
  const { DEFAULT_PROJECT } = await import('../desktop/lib/project.mjs')
  const remote = await import('../src/lib/remote.js')
  assert.equal(remote.DEFAULT_PROJECT, DEFAULT_PROJECT, 'remote.js carries its own copy of the project again')
})

test('a hostname reads like a name', () => {
  assert.equal(host.prettyHostname('Justins-MacBook-Pro.local'), 'Justins MacBook Pro')
  assert.equal(host.prettyHostname('studio_mac'), 'studio mac')
  assert.equal(host.prettyHostname(''), 'your computer')
})

/**
 * A ForgeFX to arm: answers the routes armHost calls, records what was asked,
 * and can be told to be slow to start, signed out, already on, or refusing.
 */
function fakeForgeFX({ healthzFails = 0, cloud = { enabled: true, user: { email: 'j@x.com' } }, enabled = false, doc = null, enableFails = 0 } = {}) {
  const calls = []
  let health = 0
  let enables = 0
  const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
  const fetch = async (url, init = {}) => {
    const path = new URL(url).pathname
    const method = init.method || 'GET'
    calls.push(`${method} ${path}${init.body ? ' ' + init.body : ''}`)
    if (path === '/healthz') return health++ < healthzFails ? reply(503, {}) : reply(200, { ok: true })
    if (path === '/store/config/host.name' && method === 'PUT') return reply(200, {})
    if (path === '/cloud/status') return reply(200, cloud)
    if (path === '/remote/status') return reply(200, { enabled, connected: enabled, userId: 'u' })
    if (path === '/store/config/remote.host') return doc ? reply(200, { data: doc }) : reply(404, { error: 'not found' })
    if (path === '/remote/enable') {
      if (enables++ < enableFails) return reply(200, { enabled: true, connected: false, error: 'realtime TIMED_OUT' })
      return reply(200, { enabled: true, connected: true, userId: 'u' })
    }
    return reply(404, {})
  }
  return { fetch, calls }
}
const arm = (unit, extra = {}) =>
  host.armHost({ port: 5056, fetch: unit.fetch, hostname: 'Studio computer', sleep: async () => {}, ...extra })

test('the launcher turns the phone remote on once the server is up', async () => {
  const unit = fakeForgeFX({ healthzFails: 2 })
  const result = await arm(unit)
  assert.deepEqual(result, { on: true, email: 'j@x.com' })
  assert.deepEqual(unit.calls, [
    'GET /healthz',
    'GET /healthz',
    'GET /healthz',
    'PUT /store/config/host.name {"data":{"name":"Studio computer"},"origin":"fractal"}',
    'GET /cloud/status',
    'GET /remote/status',
    'GET /store/config/remote.host',
    'POST /remote/enable {"on":true}'
  ])
})

test('a switch turned off on purpose stays off', async () => {
  const unit = fakeForgeFX({ doc: { wanted: false, at: 1 } })
  const result = await arm(unit)
  assert.equal(result.on, false)
  assert.equal(result.reason, 'turned-off')
  assert.ok(!unit.calls.some((c) => c.startsWith('POST /remote/enable')), 'it overruled a person who turned it off')
})

test('nobody signed in means nothing to turn on, said plainly', async () => {
  const lines = []
  const unit = fakeForgeFX({ cloud: { enabled: true, user: null } })
  const result = await arm(unit, { log: (l) => lines.push(l) })
  assert.equal(result.reason, 'signed-out')
  assert.ok(!unit.calls.some((c) => c.startsWith('POST')), 'it tried to enable with nobody signed in')
  assert.match(lines.join('\n'), /sign in once/i)
})

test('already on is left alone', async () => {
  const unit = fakeForgeFX({ enabled: true })
  const result = await arm(unit)
  assert.equal(result.on, true)
  assert.ok(!unit.calls.some((c) => c.startsWith('POST')), 'it re-enabled a host that was already on, which drops the live channel')
})

test('a slow account service gets a few tries', async () => {
  const unit = fakeForgeFX({ enableFails: 2 })
  const result = await arm(unit)
  assert.equal(result.on, true)
  assert.equal(unit.calls.filter((c) => c.startsWith('POST /remote/enable')).length, 3)
})

test('a server that never comes up does not take the launcher with it', async () => {
  const unit = fakeForgeFX({ healthzFails: 999 })
  const result = await arm(unit, { attempts: 3 })
  assert.equal(result.reason, 'no-server')
  assert.equal(unit.calls.length, 3)
})

test('a preset can be renamed by hand, and the save sheet follows a rename', () => {
  /*
   * "Rename preset to Tool" — done, said the chat; six seconds later the save
   * sheet asked the Mac to save it as "Tool - Adam Jones", and the Mac
   * renames before it stores, so the old name went straight back on. And:
   * "Would also like to be able to rename presets and scenes in the app
   * directly without having to ask the chat."
   */
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const gig = readSrc(new URL('../src/components/Gig.jsx', import.meta.url), 'utf8')
  const field = readSrc(new URL('../src/components/RenamePreset.jsx', import.meta.url), 'utf8')

  // The way to the sheet where names are typed is in Setup — "move the rename
  // presets and scenes button to the settings menu". The pencil that stood
  // beside the preset tile on Play is gone.
  //
  // It was a button in DeviceDetail's row of connection buttons, where it was
  // the only one of them that changed anything on the unit. Now it is a row
  // of its own called Rename presets and scenes, and its page is the button.
  assert.ok(!/gig-rename/.test(gig), 'the pencil is back beside the preset tile on Play')
  const detail = readSrc(new URL('../src/components/DeviceDetail.jsx', import.meta.url), 'utf8')
  assert.ok(!/onRename/.test(detail), 'the rename button is back in among the connection buttons')
  /* On the chain sheet now, beside the preset: "move rename presets and scenes out of settings onto the edit screen". */
  const renamePage = app.slice(app.indexOf('chain-rename'), app.indexOf('chain-rename') + 600)
  assert.match(renamePage, /Rename preset and scenes/, 'Edit has no way to rename a preset or its scenes')
  assert.match(renamePage, /setSheetBack\('chain'\)\s*setSheet\('scenes'\)/, 'the rename button does not open the names sheet, or closing it does not come back to Edit')
  const sheet = app.slice(app.indexOf("open={sheet === 'scenes'}"), app.indexOf('<SceneMatrix'))
  assert.match(sheet, /<RenamePreset preset=\{preset\} busy=\{busy\} onRename=\{rename\} \/>/, 'the preset name is not in the sheet')
  assert.match(sheet, /alert=\{sheetAlert\}/, 'a refused rename would be explained under the sheet, where nobody can see it')
  assert.match(field, /maxLength=\{31\}/, 'a name longer than the unit allows can be typed')
  assert.match(field, /disabled=\{busy \|\| !changed\}/, 'the button offers to rename to the name it already has')

  // A rename by hand is honest about a refusal, and the save follows it.
  const rename = app.slice(app.indexOf('const rename = async (name) => {'), app.indexOf('const rename = async (name) => {') + 700)
  assert.match(rename, /if \(res && res\.ok === false\) throw new Error\('The unit refused the rename\.'\)/)
  assert.match(rename, /setSaveName\(name\)/, 'the save sheet would still propose the old name')
  assert.match(rename, /setDirty\(true\)/, 'a renamed buffer is not marked as differing from its slot')

  // And a rename from anywhere else — the chat, the Mac — moves the save name
  // only when the field still says what the unit used to.
  const follow = app.slice(app.indexOf('const followUnitName = '), app.indexOf('const followUnitName = ') + 400)
  assert.match(follow, /setSaveName\(\(field\) => \(field\.trim\(\) === was \? now : field\)\)/, 'a name somebody typed would be overwritten')
  assert.match(app, /setPreset\(p\)\n\s*followUnitName\(p\)/, 'the unit’s name is not followed on a read')
})

test('the debug report carries the computer’s own account of its port', async () => {
  /*
   * "port not open" on the phone, live tuner readings at the same time, a
   * preset change that reached the unit — and nothing to read on the Mac,
   * whose server's stdout goes nowhere when the app is opened from the
   * Finder. The Copy Logs button now asks the Mac's server how it is (its
   * /diag: port open or not, the last ten times it lost the port and why,
   * its last lines) and puts that under the log.
   */
  const { formatMacDiag } = await import('../src/lib/debugLog.js')
  const out = formatMacDiag({
    transportOpen: false,
    transportLabel: '/dev/cu.usbmodem1019',
    resolved: { transport: 'serial', id: '/dev/cu.usbmodem1019' },
    ports: { serial: [{ id: '/dev/cu.usbmodem1019', fractal: true }, { id: '/dev/cu.Bluetooth', fractal: false }] },
    detected: true,
    profile: { key: 'fm3' },
    telemetryMode: 'reduced',
    uptime: 601,
    traffic: { txMsgs: 40, rxMsgs: 38, since: '2026-09-12T15:00:00.000Z' },
    reopens: [{ at: '2026-09-12T15:34:10.000Z', label: '/dev/cu.usbmodem1019', reason: 'the device went away (Disconnected)' }],
    recent: ['2026-09-12T15:34:10.000Z warn [forgefx] serial /dev/cu.usbmodem1019 closed — the device went away (Disconnected)']
  })
  assert.match(out, /^COMPUTER'S DEVICE SERVER/)
  assert.match(out, /port to the unit: NOT OPEN · \/dev\/cu\.usbmodem1019/)
  assert.match(out, /serial ports: \/dev\/cu\.usbmodem1019 \(Fractal\), \/dev\/cu\.Bluetooth/)
  assert.match(out, /server up: 10 min/)
  assert.match(out, /traffic: 40 sent, 38 received/)
  assert.match(out, /port lost and reopened: 1 time\n  2026-09-12T15:34:10\.000Z \/dev\/cu\.usbmodem1019 — the device went away/)
  assert.match(out, /server log, last 1 lines:\n2026-09-12T15:34:10\.000Z warn/)
  // Nothing to say is nothing, not a heading over an empty list.
  assert.equal(formatMacDiag(null), '')
  assert.match(formatMacDiag({}), /port to the unit: NOT OPEN\nresolved: no unit found\nserial ports: none/)
  // An older Mac app has no port history to give, and "0 times" is not what that means.
  assert.match(formatMacDiag({}), /port lost and reopened: this computer app does not say/)
  assert.match(formatMacDiag({}), /server log: this computer app does not keep one/)
  assert.match(formatMacDiag({ reopens: [], recent: [] }), /port lost and reopened: 0 times\nserver log: nothing said yet/)

  const panel = readSrc(new URL('../src/components/DebugLog.jsx', import.meta.url), 'utf8')
  assert.match(panel, /const t = text\(await macReport\(\)\)/, 'Copy Logs does not ask the computer')
  assert.match(panel, /formatMacDiag\(await serverDiag\(\)\)/)
  assert.match(panel, /could not be asked/, 'a computer that does not answer is not said so')
  const fx = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')
  assert.match(fx, /export const serverDiag = \(\) => request\('\/diag'/, 'the diag has to travel the relay like every other GET, so a phone can ask')
})

test('the computer app says which version it is, where the phone already looks', async () => {
  /*
   * A phone on today's web build against a Mac still running last week's
   * app is the shape of every "the fix didn't work", and the debug report
   * said only the Mac's name. The version rides beside it; a launcher that
   * gives none (the dev server) writes the doc exactly as before.
   */
  const unit = fakeForgeFX()
  await arm(unit, { version: '7.190.0' })
  assert.ok(
    unit.calls.includes('PUT /store/config/host.name {"data":{"name":"Studio computer","version":"7.190.0"},"origin":"fractal"}'),
    'the version did not reach the host doc'
  )
  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')
  assert.match(main, /armHost\(\{ port, version: app\.getVersion\(\), log: phoneLog \}\)/, 'the computer app does not say which version it is, or says nothing when it cannot')
  /*
   * AND AGAIN EVERY FEW MINUTES. "The app on the computer is running the
   * latest version, so I'm not sure why it's saying this." A write that failed
   * once at launch, quietly, left an older launcher's name standing — without
   * a version — for good. Now it is written again on a timer, a failure is
   * said, and the menu says which version the phones are told.
   */
  assert.match(main, /setInterval\(tell, TELL_PHONES_MS\)/, 'the name and version are written once and never again')
  assert.match(main, /told = await tellPhonesChecked\(\{ port, version: app\.getVersion\(\), log: phoneLog \}\)/, 'the write is not read back')
  assert.match(main, /this app is v\$\{app\.getVersion\(\)\}/, 'the menu does not say which version the phones are told')
  assert.match(main, /phonesHearLine\(told, app\.getVersion\(\)\)/, 'the menu does not say what the phones hear')
  assert.equal(host.TELL_PHONES_MS, 5 * 60 * 1000)
  /* A failed write is said, not swallowed. */
  const lines = []
  const refusing = { fetch: async () => ({ ok: false, status: 400, json: async () => ({}) }) }
  assert.equal(await host.tellPhones({ port: 5056, fetch: refusing.fetch, hostname: 'Studio computer', version: '7.281.0', log: (l) => lines.push(l) }), false)
  assert.match(lines[0], /couldn't tell the phones this is Studio computer, v7\.281\.0 \(HTTP 400\)/)
  const dead = { fetch: async () => { throw new Error('ECONNREFUSED') } }
  assert.equal(await host.tellPhones({ port: 5056, fetch: dead.fetch, hostname: 'Studio computer', log: (l) => lines.push(l) }), false)
  assert.match(lines[1], /couldn't tell the phones this is Studio computer \(ECONNREFUSED\)/)
  const fine = fakeForgeFX()
  assert.equal(await host.tellPhones({ port: 5056, fetch: fine.fetch, hostname: 'Studio computer', version: '7.281.0' }), true)
  assert.deepEqual(fine.calls, ['PUT /store/config/host.name {"data":{"name":"Studio computer","version":"7.281.0"},"origin":"fractal"}'])
  const link = readSrc(new URL('../src/lib/link.js', import.meta.url), 'utf8')
  assert.match(link, /macVersion: doc\.version \? String\(doc\.version\) : null/, 'the phone does not read the version back')

  /*
   * AND READ BACK. "My Mac is on the correct version 7.281" — and the phone
   * still said the computer app did not say. So the write is read back the
   * way a phone reads it, and the menu says what a phone would hear.
   */
  const store = (doc, { refuse = false } = {}) => {
    const calls = []
    return {
      calls,
      fetch: async (url, init = {}) => {
        const path = new URL(url).pathname
        const method = init.method || 'GET'
        calls.push(`${method} ${path}`)
        if (method === 'PUT') {
          if (refuse) return { ok: false, status: 403, json: async () => ({}) }
          doc = JSON.parse(init.body)
          return { ok: true, status: 200, json: async () => ({ ok: true }) }
        }
        return { ok: true, status: 200, json: async () => doc }
      }
    }
  }
  const kept = store(null)
  const checked = await host.tellPhonesChecked({ port: 5056, fetch: kept.fetch, hostname: 'Studio computer', version: '7.295.0', now: () => 7 })
  assert.deepEqual(kept.calls, ['PUT /store/config/host.name', 'GET /store/config/host.name'], 'the write is not followed by a read-back')
  assert.deepEqual(checked, { at: 7, wrote: true, heard: { name: 'Studio computer', version: '7.295.0' }, why: null })
  assert.equal(host.phonesHearLine(checked, '7.295.0'), 'phones hear v7.295.0')

  /* The write is accepted and the server goes on serving an older copy: the
     shape of a Mac on the right version whose phones still hear nothing. */
  const stale = {
    fetch: async (url, init = {}) =>
      (init.method || 'GET') === 'PUT'
        ? { ok: true, status: 200, json: async () => ({ ok: true }) }
        : { ok: true, status: 200, json: async () => ({ data: { name: 'Studio computer' } }) }
  }
  const nameOnly = await host.tellPhonesChecked({ port: 5056, fetch: stale.fetch, hostname: 'Studio computer', version: '7.295.0' })
  assert.equal(nameOnly.wrote, true)
  assert.deepEqual(nameOnly.heard, { name: 'Studio computer', version: null })
  assert.match(host.phonesHearLine(nameOnly, '7.295.0'), /^phones hear Studio computer with no version — the device server is not keeping what this app writes$/)
  const older = { ...nameOnly, heard: { name: 'Studio computer', version: '7.190.0' } }
  assert.equal(host.phonesHearLine(older, '7.295.0'), 'phones hear v7.190.0, not v7.295.0 — the device server is serving an older copy')

  /* A refused write is said in the menu, with the reason. */
  const refused = await host.tellPhonesChecked({ port: 5056, fetch: store({ data: { name: 'Studio computer' } }, { refuse: true }).fetch, hostname: 'Studio computer', version: '7.295.0', log: () => {} })
  assert.equal(refused.wrote, false)
  assert.equal(host.phonesHearLine(refused, '7.295.0'), 'the phones can’t be told which app this is — couldn\'t tell the phones this is Studio computer, v7.295.0 (HTTP 403).')

  /* And a dead server: the write fails and so does the read-back, and the read-back cannot be believed. */
  const gone = await host.tellPhonesChecked({ port: 5056, fetch: async () => { throw new Error('ECONNREFUSED') }, hostname: 'Studio computer', version: '7.295.0' })
  assert.equal(gone.wrote, false)
  assert.equal(gone.heard, null)
  assert.equal(host.phonesHearLine(null, '7.295.0'), null)
  const report = readSrc(new URL('../src/components/DebugLog.jsx', import.meta.url), 'utf8')
  assert.match(report, /computer app \$\{link\.macVersion \? `v\$\{link\.macVersion\}` : 'older than 7\.190\.0/, 'the report does not say which computer app answered')
})

test('the name is written even when there is nobody to host for', async () => {
  // The phone shows this name; a Mac that is signed out today may be signed
  // in tomorrow, and the name should already be there.
  const unit = fakeForgeFX({ cloud: { enabled: true, user: null } })
  await arm(unit)
  assert.ok(unit.calls.some((c) => c.startsWith('PUT /store/config/host.name')))
})

test('the advert answers for its own name, never for the computer’s', async () => {
  /*
   * "This computer's local hostname 'Justins-MacBook-Pro-958.local' is
   * already in use on this network. The name has been changed to
   * 'Justins-MacBook-Pro-1019.local'." After every restart, and only once the
   * app had been running. bonjour-service is a responder of its own and,
   * given no host, publishes the service at the machine's hostname — so this
   * app was answering for the Mac's own name, and macOS, which checks that
   * nobody else does, kept renaming itself out of the way.
   */
  const published = []
  class FakeBonjour {
    publish(config) {
      published.push(config)
      return { stop: (cb) => cb() }
    }
    destroy() {}
  }
  const ad = host.publish(FakeBonjour, { port: 5056, name: 'fractal-justins-macbook-pro' })
  assert.equal(published.length, 1)
  assert.equal(published[0].host, 'fractal-justins-macbook-pro.local', 'the advert is answering for the computer’s own hostname')
  assert.equal(published[0].name, 'fractal-justins-macbook-pro')
  assert.equal(published[0].port, 5056)
  await ad.stop()
})

test('publishing without mDNS available still gives a usable stop', async () => {
  // The desktop app treats bonjour as optional — without it the IP still
  // works and only the .local name is lost, so this must not throw.
  const ad = host.publish(null, { port: 5056 })
  await ad.stop()
})

console.log('\nkeeping the computer app up to date')

const updates = await import('../desktop/lib/updates.mjs')

/** An updater that records what it was told and lets a test fire its events. */
function fakeUpdater() {
  const handlers = new Map()
  return {
    handlers,
    checked: 0,
    on(event, fn) {
      handlers.set(event, fn)
    },
    emit(event, payload) {
      handlers.get(event)?.(payload)
    },
    async checkForUpdates() {
      this.checked += 1
    }
  }
}

test('the update installs when you quit, and never before', () => {
  /*
   * The rule the whole feature is shaped around. This runs on a machine with a
   * guitar plugged into it, and the moment a restart is worst is exactly the
   * moment someone is using it — so it downloads quietly and swaps itself in
   * when the person quits, which they do when they are finished by definition.
   */
  const u = fakeUpdater()
  updates.wireUpdates({ updater: u, onState: () => {} })
  assert.equal(u.autoInstallOnAppQuit, true, 'the download would sit there forever')
  assert.equal(u.autoDownload, true, 'the update waits on a decision nobody was offered')
})

test('the menu follows the download', async () => {
  const seen = []
  const u = fakeUpdater()
  const { check } = updates.wireUpdates({ updater: u, onState: (s) => seen.push(s) })

  await check()
  assert.equal(u.checked, 1)

  u.emit('checking-for-update')
  u.emit('update-available', { version: '7.29.0' })
  u.emit('download-progress', { percent: 41.6 })
  u.emit('update-downloaded', { version: '7.29.0' })

  assert.deepEqual(
    seen.map((s) => s.kind),
    ['checking', 'found', 'downloading', 'ready']
  )
  assert.equal(seen[2].percent, 42, 'a percentage nobody asked for is at least a whole number')
  assert.match(updates.updateLine(seen[3]), /installs when you quit/i)
  assert.match(updates.updateLine(seen[3]), /7\.29\.0/)
})

test('a failed check is a line, not a problem', () => {
  /*
   * The network was down, or GitHub was slow. The app still serves the unit,
   * which is the whole job — so this is never a dialog and never throws.
   */
  const seen = []
  const u = fakeUpdater()
  updates.wireUpdates({ updater: u, onState: (s) => seen.push(s) })
  u.emit('error', new Error('getaddrinfo ENOTFOUND'))
  assert.deepEqual(seen, [{ kind: 'trouble' }])
  assert.match(updates.updateLine({ kind: 'trouble' }), /couldn.t check/i)
})

test('a check that throws does not leave the menu stuck', async () => {
  const seen = []
  const u = fakeUpdater()
  u.checkForUpdates = async () => {
    throw new Error('no network')
  }
  const { check } = updates.wireUpdates({ updater: u, onState: (s) => seen.push(s) })
  await check()
  assert.deepEqual(seen, [{ kind: 'trouble' }], 'the menu would say "Checking…" for ever')
})

test('nothing is said until there is something to say', () => {
  // A menu line of null means the item is not drawn at all.
  assert.equal(updates.updateLine(), null)
  assert.equal(updates.updateLine({ kind: 'idle' }), null)
  assert.equal(updates.updateLine({ kind: 'current' }), 'Up to date')
})

test('no updater at all is survivable', async () => {
  // A checkout has nothing to update from; the app must still run.
  const { check } = updates.wireUpdates({ updater: null, onState: () => {} })
  await check()
})

console.log('\nwhere this copy of the app is running')

const platform = await import('../src/lib/platform.js')

test('the phone app announces itself rather than being guessed at', () => {
  /*
   * Guessing the device from its user agent is forbidden elsewhere in this
   * codebase for good reasons — an iPad claims to be a Mac, and every WebView
   * claims to be Safari. The shell says what it is, so nothing has to guess.
   */
  const phone = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }
  assert.equal(platform.isCapacitor(phone), true)
  assert.equal(platform.nativePlatform(phone), 'ios')
  assert.equal(platform.platform(phone), 'ios')

  // A browser has no such global, which is the common case and not an error.
  const browser = { location: { hostname: 'fractal.newbold.cloud' } }
  assert.equal(platform.isCapacitor(browser), false)
  assert.equal(platform.nativePlatform(browser), null)
  assert.equal(platform.platform(browser), 'web')
})

test('a shell that answers nonsense is not believed', () => {
  // Present but not native: a browser with the library loaded is still a browser.
  const web = { Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } }
  assert.equal(platform.isCapacitor(web), false)
  assert.equal(platform.nativePlatform(web), null)

  // Native but naming a platform we do not ship: no answer beats a wrong one.
  const odd = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'electron' } }
  assert.equal(platform.nativePlatform(odd), null)

  // And a shell that throws is a browser as far as anything here is concerned.
  const angry = { Capacitor: { isNativePlatform: () => { throw new Error('no') } } }
  assert.equal(platform.isCapacitor(angry), false)
})

test('only the hosted site thinks it is the hosted site', () => {
  /*
   * What the service worker and the "add to home screen" nudge hang off. The
   * Mac serves this bundle too, and so does the phone app, and neither should
   * be offering to install itself or caching a shell it cannot update.
   */
  assert.equal(platform.isHostedOrigin({ location: { hostname: 'fractal.newbold.cloud' } }), true)
  assert.equal(platform.isHostedOrigin({ location: { hostname: '192.168.1.44' } }), false)
  assert.equal(platform.isHostedOrigin({ location: { hostname: 'localhost' } }), false)
  assert.equal(platform.isHostedOrigin(null), false)
})

test('nothing here needs a window', () => {
  // These modules load on a server and in this test runner, where there is none.
  assert.equal(platform.isCapacitor(null), false)
  assert.equal(platform.isStandalone(null), false)
  assert.equal(platform.platform(null), 'server')
})

test('the phone app counts as standalone without being asked twice', () => {
  const phone = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }
  assert.equal(platform.isStandalone(phone), true)

  // iOS says so on navigator; everyone else reports a display mode.
  assert.equal(platform.isStandalone({ navigator: { standalone: true } }), true)
  assert.equal(
    platform.isStandalone({ matchMedia: () => ({ matches: true }) }),
    true
  )
  assert.equal(
    platform.isStandalone({ matchMedia: () => ({ matches: false }) }),
    false
  )
})

console.log('\nwho may call the model')







console.log('\nscenes')

/* A preset with an amp, a cab and two pedals — enough to have a scene plan
   that means something, and enough for a scene to be wrong in each way. */
const sceneSchema = [
  // The amp and the drive carry channels, as they do on the unit; the cab and
  // the delay here do not, which is the other half of what has to be checked.
  { eid: 58, name: 'Amp 1', slug: 'amp', channel: 'A', models: [], params: [] },
  { eid: 106, name: 'Cab 1', slug: 'cab', models: [], params: [] },
  { eid: 118, name: 'Drive 1', slug: 'drive', channel: 'A', models: [], params: [] },
  { eid: 132, name: 'Delay 1', slug: 'delay', models: [], params: [] }
]
const scened = (scenes, count = 8) =>
  validateSpec({ blocks: [], scenes }, sceneSchema, count)

test('a scene plan becomes explicit per-block bypass', () => {
  // The model says what is ON; the hardware is told what is OFF. That
  // inversion happens once, in validation, not at every call site.
  const r = scened([{ index: 0, name: 'Rhythm', engaged: [58, 106, 118] }])
  assert.equal(r.scenes.length, 1)
  const off = r.scenes[0].blocks.filter((b) => b.bypassed).map((b) => b.eid)
  assert.deepEqual(off, [132], 'the delay was not listed, so it should be off')
})

test('a scene that forgets the amp is repaired, not shipped', () => {
  /*
   * The silent-scene case. The prompt tells the model amp and cab belong in
   * every scene and it can still drop one on the eighth scene of a long reply
   * — and the failure is inaudible until someone stands on a footswitch
   * mid-set, which is the worst possible moment to find it.
   */
  const r = scened([{ index: 2, name: 'Lead', engaged: [118, 132] }])
  const on = r.scenes[0].blocks.filter((b) => !b.bypassed).map((b) => b.eid)
  assert.ok(on.includes(58) && on.includes(106), 'amp and cab should be switched back on')
  assert.match(r.problems.join(' '), /would have silenced it/)
})

test('a scene past the end of the unit is dropped', () => {
  // An AM4 has fewer scenes than an FM3. Writing scene 8 to a unit with four
  // is eight round trips that end in a refusal, or worse.
  const r = scened([{ index: 6, name: 'Too far', engaged: [58, 106] }], 4)
  assert.deepEqual(r.scenes, [])
  assert.match(r.problems.join(' '), /outside this unit/)
})

test('the same scene described twice keeps the first', () => {
  const r = scened([
    { index: 1, name: 'First', engaged: [58, 106] },
    { index: 1, name: 'Second', engaged: [58, 106, 132] }
  ])
  assert.equal(r.scenes.length, 1)
  assert.equal(r.scenes[0].name, 'First')
})

test('scenes come back in the order the unit holds them', () => {
  const r = scened([
    { index: 3, name: 'Solo', engaged: [58, 106] },
    { index: 0, name: 'Clean', engaged: [58, 106] }
  ])
  assert.deepEqual(r.scenes.map((x) => x.index), [0, 3])
})

test('an unknown effect id in a scene is ignored, not written', () => {
  const r = scened([{ index: 0, name: 'Ghost', engaged: [58, 106, 9999] }])
  assert.ok(!r.scenes[0].blocks.some((b) => b.eid === 9999))
})

test('no scenes is a normal answer, not an error', () => {
  const r = scened([])
  assert.deepEqual(r.scenes, [])
  assert.deepEqual(r.problems, [])
})

/*
 * The half of a scene that had no way through the app at all.
 *
 * A scene remembers a channel per block as well as a bypass, and the device
 * layer has always been able to write one — setSceneBlock takes it. Nothing
 * ever passed it, because the generator was told scenes could not carry one.
 */
test('a scene carries the channel it plays, block by block', () => {
  const r = scened([
    { index: 0, name: 'Rhythm', engaged: [58, 106, 118], channels: [{ eid: 58, channel: 'A' }] },
    { index: 1, name: 'Lead', engaged: [58, 106, 118], channels: [{ eid: 58, channel: 'b' }] }
  ])
  assert.deepEqual(r.problems, [])
  const amp = (i) => r.scenes[i].blocks.find((b) => b.eid === 58)
  assert.equal(amp(0).channel, 'A')
  assert.equal(amp(1).channel, 'B', 'a lower-case letter is the same channel')
  assert.equal(
    r.scenes[1].blocks.find((b) => b.eid === 118).channel,
    undefined,
    'a block the scene said nothing about was moved anyway'
  )
})

test('a scene cannot be sent to a channel this tone never dialled', () => {
  /*
   * "Two of the four generated scenes had no sound whatsoever."
   *
   * A scene does not carry a sound, it points at one. A build that dials the
   * rhythm on channel A and the lead on B, and then sends two of its four
   * scenes to C and D, has pointed them at channels it never wrote — they play
   * whatever was lying there in the preset underneath, which is nothing
   * anybody designed and can be nothing at all.
   */
  const r = validateSpec(
    {
      blocks: [
        { eid: 58, channel: 'A', params: [] },
        { eid: 58, channel: 'B', params: [] }
      ],
      scenes: [
        { index: 0, name: 'Verse', engaged: [58, 106], channels: [{ eid: 58, channel: 'A' }] },
        { index: 1, name: 'Lead', engaged: [58, 106], channels: [{ eid: 58, channel: 'B' }] },
        { index: 2, name: 'Solo', engaged: [58, 106], channels: [{ eid: 58, channel: 'C' }] }
      ]
    },
    sceneSchema,
    8
  )
  const amp = (i) => r.scenes[i].blocks.find((b) => b.eid === 58)
  assert.equal(amp(0).channel, 'A', 'a channel this tone dialled is played')
  assert.equal(amp(1).channel, 'B')
  assert.equal(amp(2).channel, 'A', 'the scene was left on a channel nobody built')
  assert.match(r.problems.join(' '), /never dialled/)

  /*
   * Only for a block this build moves. A preset can have channels dialled by
   * hand months ago and this cannot see them — reading a block reads the
   * channel it is on and no other — so a scene naming a channel of a block
   * this build leaves alone is the only word on the subject and is taken at it.
   */
  const untouched = scened([
    { index: 0, name: 'Rhythm', engaged: [58, 106], channels: [{ eid: 58, channel: 'A' }] },
    { index: 1, name: 'Lead', engaged: [58, 106], channels: [{ eid: 58, channel: 'D' }] }
  ])
  assert.equal(untouched.scenes[1].blocks.find((b) => b.eid === 58).channel, 'D')
  assert.deepEqual(untouched.problems, [])

  /* When the channel a block sits on is not one this build dialled either, the
     scene goes to one that was — never to the one nobody wrote. */
  const away = validateSpec(
    {
      blocks: [{ eid: 58, channel: 'B', params: [] }],
      scenes: [{ index: 0, name: 'Lead', engaged: [58, 106], channels: [{ eid: 58, channel: 'C' }] }]
    },
    sceneSchema,
    8
  )
  assert.equal(away.scenes[0].blocks.find((b) => b.eid === 58).channel, 'B')
})

test('two scenes that play the same thing are called out, not shipped as two tones', () => {
  /*
   * "All the songs generated here absolutely don't match these songs in real
   * life." Eight scenes named after eight songs, over three amp voicings, one
   * drive setting and one delay setting — because a scene carries no sound of
   * its own. It records which blocks are on and which channel each plays, and
   * what a channel sounds like is written once. Two scenes with the same blocks
   * on the same channels are one tone with two names on the footswitch.
   *
   * Not repaired — the app cannot invent the sound that was missing — but said
   * while the tone is still a proposal, by name, rather than discovered
   * standing on a footswitch between two songs that sound identical.
   */
  const r = validateSpec(
    {
      blocks: [
        { eid: 58, channel: 'A', params: [] },
        { eid: 58, channel: 'B', params: [] }
      ],
      scenes: [
        { index: 0, name: 'RIOT', engaged: [58, 106, 118], channels: [{ eid: 58, channel: 'B' }] },
        { index: 1, name: 'I HATE U', engaged: [58, 106], channels: [{ eid: 58, channel: 'A' }] },
        { index: 2, name: 'HOME', engaged: [58, 106, 118], channels: [{ eid: 58, channel: 'B' }] }
      ]
    },
    sceneSchema,
    8
  )
  const said = r.problems.join(' | ')
  assert.match(said, /HOME/, said)
  assert.match(said, /RIOT/, 'the scene it duplicates is not named')
  assert.match(said, /same sound under a second name/)
  // Only the copy is reported, and the one that differs is left alone.
  assert.equal(r.problems.filter((p) => /same sound/.test(p)).length, 1)
  assert.ok(!/I HATE U/.test(said), 'a scene that really is different was called a duplicate')
  // Nothing is dropped — all three still reach the unit, because the player
  // may well want two footswitches onto one sound.
  assert.equal(r.scenes.length, 3)

  // Different blocks on is a different sound, and so is a different channel.
  const differs = validateSpec(
    {
      blocks: [{ eid: 58, channel: 'A', params: [] }],
      scenes: [
        { index: 0, name: 'One', engaged: [58, 106], channels: [] },
        { index: 1, name: 'Two', engaged: [58, 106, 118], channels: [] }
      ]
    },
    sceneSchema,
    8
  )
  assert.ok(!differs.problems.some((p) => /same sound/.test(p)), differs.problems.join(' | '))
})

test('a scene channel the unit cannot honour is dropped, not sent', () => {
  const r = scened([
    {
      index: 0,
      name: 'Odd',
      engaged: [58, 106, 132],
      channels: [
        { eid: 132, channel: 'B' },
        { eid: 58, channel: 'Q' }
      ]
    }
  ])
  assert.ok(!r.scenes[0].blocks.some((b) => b.channel), 'a channel that cannot be written was kept')
  assert.match(r.problems.join(' | '), /Delay 1 has no channels/)
  assert.match(r.problems.join(' | '), /no channel "Q"/)
})

test('a block spec carries the channel its values belong to', () => {
  const withChannel = validateSpec(
    { blocks: [{ eid: 58, channel: 'b', params: [] }] },
    sceneSchema
  )
  assert.equal(withChannel.changes.length, 1, 'a channel on its own is not a change worth writing')
  assert.equal(withChannel.changes[0].channel, 'B')

  // Two entries for one block: the lead sound on its own channel, which is the
  // whole point — one amp block, two sounds, a scene each.
  const two = validateSpec(
    {
      blocks: [
        { eid: 58, channel: 'A', params: [] },
        { eid: 58, channel: 'D', params: [] }
      ]
    },
    sceneSchema
  )
  assert.deepEqual(two.changes.map((c) => c.channel), ['A', 'D'])

  const none = validateSpec({ blocks: [{ eid: 132, channel: 'B', params: [] }] }, sceneSchema)
  assert.equal(none.changes.length, 0)
  assert.match(none.problems[0] || '', /no channels/)

  const bad = validateSpec({ blocks: [{ eid: 58, channel: 'Z', params: [] }] }, sceneSchema)
  assert.equal(bad.changes.length, 0)
  assert.match(bad.problems[0] || '', /no channel "Z"/)
})

test('a scene written without a name says so rather than keeping a stranger\u2019s', () => {
  /*
   * A blank name is not a blank scene: applyScenes skips setSceneName, so the
   * scene keeps whatever it was called. On a preset somebody laid out that
   * leaves a scene called "Lead" which is no longer the lead — the exact
   * confusion this whole round is about.
   */
  const r = scened([
    { index: 0, name: 'Rhythm', engaged: [58, 106] },
    { index: 1, name: '   ', engaged: [58, 106, 118] }
  ])
  assert.equal(r.scenes.length, 2, 'the unnamed scene was dropped instead of reported')
  assert.equal(r.scenes[1].name, '')
  assert.match(r.problems.join(' | '), /Scene 2 came back with no name/)
  assert.ok(!/Scene 1 came back with no name/.test(r.problems.join(' | ')), 'a named scene was reported too')
})

test('the cost of a scene plan is a switch plus a bypass each', () => {
  // Shown on the button before anything is written, because this is the half
  // that walks the unit through every scene.
  const r = scened([
    { index: 0, name: 'A', engaged: [58, 106] },
    { index: 1, name: 'B', engaged: [58, 106, 118] }
  ])
  assert.equal(countSceneWrites(r.scenes), 2 * (1 + 4))

  // A channel is a write of its own, and the count is what the button promises.
  const withChannels = scened([
    { index: 0, name: 'A', engaged: [58, 106], channels: [{ eid: 58, channel: 'A' }] },
    { index: 1, name: 'B', engaged: [58, 106, 118], channels: [{ eid: 58, channel: 'D' }] }
  ])
  assert.equal(countSceneWrites(withChannels.scenes), 2 * (1 + 4 + 1))
})

test('counts writes including model and bypass', () => {
  const r = validateSpec(
    { blocks: [{ eid: 58, type: 82, bypassed: true, params: [{ id: 7, value: 7 }] }] },
    schema
  )
  assert.equal(countWrites(r.changes), 3)
})



console.log('command plan')


const cmdBlocks = [
  {
    eid: 58,
    name: 'Amp 1',
    slug: 'amp',
    row: 1,
    col: 4,
    models: [{ value: 82, name: '5153 100W Blue' }],
    params: [
      { id: 7, name: 'Gain 1', value: 5, min: 0, max: 10 },
      { id: 1, name: 'Amp1 Level', value: -8, min: -80, max: 20 }
    ]
  },
  { eid: 118, name: 'Drive 1', slug: 'drive', row: 1, col: 6, models: [], params: [] }
]
const caps = { grid: { rows: 4, cols: 12 }, sceneCount: 8, channelNames: ['A', 'B', 'C', 'D'] }










/*
 * "Brighten scene 2" with scene 3 live used to nudge Amp Treble on scene 3.
 * A value belongs to the channel a block is on, not to a scene, so writing it
 * "for scene 2" reaches every scene playing that channel — and nothing refused
 * the ask or said where the write would land. Then it was refused outright,
 * which was honest and useless: the player asked for a thing the unit can do.
 *
 * Now a value aimed at another scene is written standing in that scene, the
 * way a bypass is; every value label names the scene it lands in; and a write
 * that reaches other scenes — known to, or not known not to — is flagged so
 * the chat asks first, with a sentence saying which scenes.
 */
const sceneCaps = { ...caps, activeScene: 2, sceneNames: ['Rhythm', 'Lead', 'Clean'] }









test('writes start on the continuous path', () => {
  // Every parameter the app can reach comes from a block's `named` list, which
  // is ForgeFX's continuous-knob half. Defaulting to discrete floored AM4
  // controls to their minimum on the first attempt.
  assert.equal(preferredEncoding(58, 17), true)
})

test('a remembered encoding still wins over the default', () => {
  rememberEncoding(58, 99, false)
  assert.equal(preferredEncoding(58, 99), false)
})

test('leaves distinct parameter names alone', () => {
  const out = disambiguate([
    { id: 11, name: 'Gain', value: 6.5, min: 0, max: 10, unit: '' },
    { id: 15, name: 'Master', value: 6, min: 0, max: 10, unit: '' }
  ])
  assert.deepEqual(out.map((p) => p.name), ['Gain', 'Master'])
  assert.equal(out[0].subBlockId, null)
})

test('Presence Frequency is kHz, and the catalog’s other wrong units are put right where a read lands', async () => {
  /*
   * "Presence Frequency — 1 Hz." The number was right and the word was not:
   * the catalog guesses Hz for a 0.1 to 10 control that is kHz. Keyed by
   * block and setting number, and checked against what it expects to find.
   */
  const { fixRead, withUnit, UNIT_FIXES } = await import('../shared/param-fixes.mjs')
  const amp = fixRead(JSON.parse(readSrc(new URL('../src/data/amp-params.json', import.meta.url), 'utf8')))
  const by = (id) => amp.named.find((p) => p.id === id)
  assert.equal(by(28).unit, 'kHz', 'Presence Frequency still says Hz')
  assert.equal(by(31).unit, 'Hz', 'Depth Frequency, which is in hertz, was moved')
  assert.equal(by(91).unit, 'Hz', 'the amp’s Tremolo Frequency still says dB')
  for (const id of [119, 120, 121, 122, 123, 132]) assert.equal(by(id).unit, undefined, `a 0-to-1 amp setting (${id}) still says dB`)
  assert.equal(by(97).name, 'Dynamic Damping', 'DYNIMP is still called DYNIMP')
  assert.ok(UNIT_FIXES.every((f) => f.slug && Number.isInteger(f.id)), 'a unit fix is keyed by name instead of by setting')

  /* Only what it expects: another block's 28, or a 28 already right, is left alone. */
  const other = { slug: 'drive', named: [{ id: 28, name: 'Tone', unit: 'Hz', min: 0.1, max: 10 }] }
  assert.equal(fixRead(other), other, 'a block with nothing to correct was copied or changed')
  const right = fixRead({ slug: 'amp', named: [{ id: 28, name: 'Presence Frequency', unit: 'kHz', min: 0.1, max: 10 }] })
  assert.equal(right.named[0].unit, 'kHz')
  const elsewhere = fixRead({ slug: 'amp', named: [{ id: 28, name: 'Something', unit: 'Hz', min: 20, max: 20000 }] })
  assert.equal(elsewhere.named[0].unit, 'Hz', 'a setting 28 with another range was corrected as if it were Presence Frequency')
  assert.equal(fixRead(null), null)

  /* Every read goes through it, at both ends. */
  assert.match(readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8'), /export const blockParams = async \(eid\) =>\s*fixRead\(/, 'the browser shows the catalog’s units')
  assert.match(readSrc(new URL('../mobile/src/lib/device.js', import.meta.url), 'utf8'), /export const blockParams = async \(eid\) => fixRead\(await remoteRequest/, 'the phone shows the catalog’s units')
  assert.match(readSrc(new URL('../scripts/sync-relay-rules.mjs', import.meta.url), 'utf8'), /source: '\.\.\/shared\/param-fixes\.mjs'/, 'the phone has no copy of the fixes')

  /* And a space between a number and its unit, everywhere. */
  assert.equal(withUnit(1, 'kHz'), '1 kHz')
  assert.equal(withUnit(4, ''), '4')
  const { disambiguate } = await import('../src/lib/encoding.js')
  assert.match(disambiguate([{ id: 1, name: 'Cut', min: 0, max: 10, unit: 'Hz' }, { id: 2, name: 'Cut', min: 0, max: 20, unit: 'Hz' }])[0].name, /0-10 Hz\)$/)
  const search = readSrc(new URL('../src/components/ParamSearch.jsx', import.meta.url), 'utf8')
  assert.match(search, /withUnit\(Math\.round\(param\.value \* 100\) \/ 100, param\.unit\)/, 'the browser’s search runs a number into its unit')
  const phone = readSrc(new URL('../mobile/src/screens/Edit.js', import.meta.url), 'utf8')
  assert.match(phone, /sub=\{withUnit\(fmt\(param\.value\), param\.unit\)\}/, 'the phone’s search runs a number into its unit')
  assert.match(readSrc(new URL('../src/lib/presetReport.js', import.meta.url), 'utf8'), /return `\$\{rounded\}\$\{param\.unit \? ` \$\{param\.unit\}` : ''\}`/, 'the report runs a number into its unit')
})

test('separates a sub-block parameter that collides by name', () => {
  // The AM4 amp page carries its integrated cab, so both report a "High Cut".
  const out = disambiguate([
    { id: 17, name: 'High Cut', value: 8000, min: 400, max: 40000, unit: 'Hz' },
    { id: 4063264, name: 'High Cut', value: 4016, min: 200, max: 20000, unit: 'Hz' }
  ])
  assert.notEqual(out[0].name, out[1].name)
  assert.equal(out[0].subBlockId, null)
  assert.equal(out[1].subBlockId, 62)
  assert.ok(out[1].name.includes('sub-block 62'))
})







test('the stage screen is sized by whoever is holding it', () => {
  /*
   * One size was chosen once, for a phone at arm's length in the dark. That is
   * the right default and the wrong rule: eight scenes and nine blocks do not
   * fit at it, and two scenes waste the screen at it. Which you have changes
   * with the preset, so it is a setting.
   *
   * The default used to be "the screen exactly as it shipped" -- 62px tiles in
   * 110px columns -- which was right while this control only resized what was
   * already there. It now also carries the LAYOUT he picked from a screenshot:
   * scenes two across in colour, effects four across in three letters. The
   * pixel figures are unchanged; the column counts are the new part, and they
   * are what a floor could never express, since a floor says "at least this
   * wide" and lets the viewport pick the rest.
   */
  const { SIZES, DEFAULT_SIZE, clampSize, sizeVars, loadSize, saveSize, fitTiles, loadFit, saveFit } = gigSize

  /*
   * Fit: the screen decides the height. Eight scenes two across and nine
   * blocks four across are seven rows; 560px of room less six 8px gaps is
   * 512px, so 73px a tile. A rig too big for four across stays four across
   * and scrolls: five and six made every name unreadable on an Android phone.
   */
  assert.deepEqual(fitTiles({ available: 560, scenes: 8, blocks: 9 }), { tile: 73, fxCols: 4 })
  assert.deepEqual(fitTiles({ available: 900, scenes: 2, blocks: 4 }), { tile: 96, fxCols: 4 }, 'a small rig grows past the biggest step')
  assert.deepEqual(fitTiles({ available: 300, scenes: 8, blocks: 16 }), { tile: 44, fxCols: 4 }, 'a rig that cannot fit does not drop under the tap floor')
  /* "Only a max of four across." A tight rig that used to go five or six
     stays at four, and at the tap floor. */
  for (const blocks of [9, 12, 16, 24]) {
    assert.equal(fitTiles({ available: 340, scenes: 8, blocks, width: 500 }).fxCols, 4, `${blocks} effects went more than four across`)
  }
  /* A size that starts narrower can still widen, up to four, to fit. */
  assert.equal(fitTiles({ available: 340, scenes: 8, blocks: 12, fxCols: 2 }).fxCols, 4)
  assert.deepEqual(fitTiles({ available: 500, scenes: 0, blocks: 0 }), { tile: 96, fxCols: 4 }, 'an empty preset should not divide by zero')

  /*
   * "On smaller phones, it looks like the tiles are too small to see the
   * glyphs… it looks like having six across might be too many."
   *
   * His FM3: eight scenes, eight blocks, a screen with too little room for
   * 44px at four across. Eight blocks are two rows at four, five or six, so
   * going wider saved nothing and cost the pictures their room. It stays at
   * four.
   */
  assert.equal(fitTiles({ available: 300, scenes: 8, blocks: 8 }).fxCols, 4, 'a wider row that saves no row was taken anyway')
  /* And a row too narrow for four tiles with a picture stops short of four. */
  assert.equal(fitTiles({ available: 300, scenes: 8, blocks: 18, fxCols: 2, width: 190 }).fxCols, 3, 'a very narrow row was sent four across')
  /* Never narrower than the size he chose, whatever the width says. */
  assert.equal(fitTiles({ available: 300, scenes: 8, blocks: 18, fxCols: 4, width: 200 }).fxCols, 4)
  {
    const mem = new Map()
    const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }
    assert.equal(loadFit(store), false, 'fit is on by default')
    saveFit(true, store)
    assert.equal(loadFit(store), true, 'fit did not stick')
    saveFit(false, store)
    assert.equal(loadFit(store), false, 'fit could not be turned off')
  }

  /*
   * The default is the SMALLEST step, so the whole rig is on the screen the
   * first time somebody sees it.
   *
   * "Make the default play screen button sizes (smallest) so that everything
   * fits on the screen. Currently, it's set to small, as the default. You have
   * to scroll up and down a little to see everything."
   *
   * It used to be one step up, which pushed the effects under the bottom of a
   * phone — and a stage screen you have to scroll is one you cannot use with a
   * guitar on. Bigger targets are still a tap away and the choice is
   * remembered; it is the untouched default that has to fit.
   */
  assert.equal(DEFAULT_SIZE, 0, 'the default is no longer the step that fits on a phone')
  assert.deepEqual(sizeVars(DEFAULT_SIZE), {
    '--gig-tile': '48px',
    '--gig-col': '88px',
    '--gig-col-block': '92px',
    '--gig-scene-cols': '2',
    '--gig-fx-cols': '4'
  }, 'the default step no longer reproduces the screen as it shipped')

  // The ladder only ever gets roomier. A step that put MORE on a row than the
  // one below it would make the minus button add clutter.
  for (let i = 1; i < SIZES.length; i += 1) {
    assert.ok(SIZES[i].scenes <= SIZES[i - 1].scenes, `step ${i} fits more scenes per row than step ${i - 1}`)
    assert.ok(SIZES[i].fx <= SIZES[i - 1].fx, `step ${i} fits more effects per row than step ${i - 1}`)
    assert.ok(SIZES[i].tile > SIZES[i - 1].tile, `step ${i} is not taller than step ${i - 1}`)
  }
  /*
   * A scene is WIDER than an effect at every step — "try making them wider".
   * Two grids of identically sized tiles read as one grid however they are
   * coloured, and size is the difference you notice before looking at anything.
   */
  for (const [i, step] of SIZES.entries()) {
    assert.ok(
      step.scenes <= step.fx,
      `at ${step.name} a scene is NARROWER than an effect (${step.scenes} vs ${step.fx} per row)`
    )
    // Strictly wider at the three steps a phone is actually used at. The top
    // two are already tiles you could hit with a boot, and there the wash does
    // the telling apart on its own.
    if (i <= 2) {
      assert.ok(
        step.scenes < step.fx,
        `at ${step.name} a scene is no wider than an effect (${step.scenes} vs ${step.fx} per row)`
      )
    }
  }

  // Bigger is bigger and smaller is smaller, the whole way up.
  for (let i = 1; i < SIZES.length; i++) {
    assert.ok(SIZES[i].tile > SIZES[i - 1].tile, `step ${i} is not taller than ${i - 1}`)
    assert.ok(SIZES[i].col > SIZES[i - 1].col, `step ${i} is not wider than ${i - 1}`)
  }

  // Every step clears the floor for something pressed on a dark stage.
  for (const s of SIZES) assert.ok(s.tile >= 44, `${s.name} is under the tap floor at ${s.tile}px`)

  // Nothing out of storage can put the screen in a state with no buttons on it.
  assert.equal(clampSize(99), SIZES.length - 1)
  assert.equal(clampSize(-5), 0)
  assert.equal(clampSize('nonsense'), DEFAULT_SIZE)
  assert.equal(clampSize(null), DEFAULT_SIZE)

  // Kept across a reload, on this device.
  const mem = new Map()
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v)
  }
  assert.equal(loadSize(store), DEFAULT_SIZE, 'a device that has never chosen gets the default')
  saveSize(3, store)
  assert.equal(loadSize(store), 3)
  saveSize(99, store)
  assert.equal(loadSize(store), SIZES.length - 1, 'an out-of-range save was stored out of range')

  /*
   * A private window throws on both, and has done since the first iOS that
   * had one. The stage screen renders at the default rather than not at all.
   */
  const hostile = {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('denied')
    }
  }
  assert.equal(loadSize(hostile), DEFAULT_SIZE, 'a blocked read takes the screen down')
  assert.equal(saveSize(2, hostile), false, 'a blocked write is reported as a success')
})

test('the quick jumps fit the unit that is plugged in', async () => {
  /*
   * One rule, not a table of devices: about five stops, each on a round
   * number. The two he named are the two ends of it — a gen-3 unit's 512
   * presets want hundreds, an AM4's 104 want twenties — and a unit nobody has
   * plugged in yet gets whatever its own count deserves without this file
   * being edited again.
   */
  const { jumpStep, jumpsFor } = await import('../src/lib/presetJumps.js')

  assert.equal(jumpStep(512), 100, 'a 512-slot unit is not jumping in hundreds')
  assert.deepEqual(jumpsFor(512), [100, 200, 300, 400, 500])

  assert.equal(jumpStep(104), 20, 'an AM4 is not jumping in twenties')
  assert.deepEqual(jumpsFor(104), [20, 40, 60, 80, 100])

  // An Axe-Fx II holds 384. Nobody wrote that number down here; the rule
  // reaches it on its own.
  assert.equal(jumpStep(384), 50)
  assert.ok(jumpsFor(384).every((n) => n < 384), 'a jump points past the last slot')

  // Short lists get nothing. A VP4's handful of slots is already one flick
  // from top to bottom, and a row of buttons over it would be furniture.
  assert.deepEqual(jumpsFor(4), [])
  assert.deepEqual(jumpsFor(40), [])
  assert.deepEqual(jumpsFor(0), [])

  // A count that never arrived must not become a row of NaN.
  assert.deepEqual(jumpsFor(undefined), [])
  assert.deepEqual(jumpsFor(null), [])

  // Five stops is the shape, wherever the count lands.
  for (const total of [104, 128, 256, 384, 512, 1024]) {
    const n = jumpsFor(total).length
    assert.ok(n >= 3 && n <= 9, `${total} slots gave ${n} buttons, which is not a row you can read`)
  }
})

test('every unit the server can detect is addressed on its own terms', async () => {
  /*
   * Six units, one app. The shapes are not close to each other — 6x14 against
   * 1x4, 512 slots against 104 against a count nobody has ever taken — and
   * every one of them arrives as a capability payload rather than a branch in
   * this code. That is the whole design, so this is the test that says the
   * design holds rather than that one device works.
   *
   * The VP4 row is the one that matters most. It used to be handed the AM4's
   * 104 locations and its A01..Z04 bank letters, purely because both units run
   * a linear chain — see ForgeFX's driver capabilities. A null count has to
   * stay null all the way through: no jumps, no bound to refuse a save
   * against, and no bank letters on a unit that has no banks.
   */

  const { slotCount, slotLabel, slotOutside } = await import('../src/lib/slots.js')
  const { jumpsFor } = await import('../src/lib/presetJumps.js')

  const grid = (rows, cols, count) => ({
    slotModel: 'grid',
    grid: { rows, cols },
    sceneCount: 8,
    presets: { count, addressing: 'numeric' }
  })

  const units = {
    'Axe-Fx III': grid(6, 14, 512),
    FM3: grid(4, 12, 512),
    FM9: grid(6, 14, 512),
    'Axe-Fx II': grid(4, 12, 384),
    AM4: { slotModel: 'linear', slotCount: 4, sceneCount: 4, presets: { count: 104, addressing: 'bankLetter' } },
    VP4: { slotModel: 'linear', slotCount: 4, sceneCount: 4, presets: { count: null, addressing: 'numeric' } }
  }

  // The count each unit actually holds, taken from what it says rather than
  // from the gen-3 number the app used to assume.
  assert.equal(slotCount(units['Axe-Fx III']), 512)
  assert.equal(slotCount(units.FM9), 512)
  assert.equal(slotCount(units['Axe-Fx II']), 384)
  assert.equal(slotCount(units.AM4), 104)
  assert.equal(slotCount(units.VP4), null, 'a VP4 is being told how many presets it has')

  // Banks only where there are banks. A gen-3 unit numbers its slots and has
  // none; the AM4 shows A01..Z04 on its own display.
  assert.equal(slotLabel(0, units.FM9.presets.addressing), '000')
  assert.equal(slotLabel(103, units.AM4.presets.addressing), '103 Z04')
  assert.equal(slotLabel(0, units.VP4.presets.addressing), '000', 'a VP4 is being given bank letters')

  // The guard that stops a save being aimed at a slot the unit has not got.
  for (const [name, caps] of Object.entries(units)) {
    const count = slotCount(caps)
    if (count === null) {
      assert.equal(slotOutside(500, caps), false, `${name} refuses a slot on a count it never stated`)
      continue
    }
    assert.equal(slotOutside(count - 1, caps), false, `${name} refuses its own last slot`)
    assert.equal(slotOutside(count, caps), true, `${name} accepts one past its last slot`)
  }

  // And the jumps, per unit, from the same one rule.
  assert.deepEqual(jumpsFor(slotCount(units.FM9)), [100, 200, 300, 400, 500])
  assert.deepEqual(jumpsFor(slotCount(units.AM4)), [20, 40, 60, 80, 100])
  assert.deepEqual(jumpsFor(slotCount(units.VP4) ?? 0), [], 'a VP4 gets jump buttons over a list of four')
})

test('the chat is told what the unit holds, and what nobody has looked at', async () => {
  /*
   * "What presets do we have named Metallica?" — "I don't have a way to browse
   * your slot list or library by name from here." The list was on screen at
   * the time, and three things in one conversation failed for the same reason:
   * a preset could not be found by name, an empty slot could not be found at
   * all, and "switch to an empty preset first" came back as an offer to delete
   * every block on the one that was loaded.
   */
  const { runsOf, slotsForChat } = await import('../src/lib/slots.js')

  assert.deepEqual(runsOf([0, 1, 2, 5, 7, 8]), ['0-2', '5', '7-8'])
  assert.deepEqual(runsOf([3, 3, 1]), ['1', '3'], 'a run list is sorted and says each slot once')
  assert.deepEqual(runsOf([]), [])
  assert.deepEqual(runsOf([1, null, 'x', 2]), ['1-2'], 'a slot that is not a number is not a slot')

  const caps = { presets: { count: 12 } }
  const seen = [
    { number: 0, name: 'USA Mk IV' },
    { number: 2, name: 'Metallica' },
    { number: 3, name: '' },
    { number: 4, name: '' },
    { number: 5, name: '' }
  ]
  const view = slotsForChat(seen, caps, { number: 2, name: 'Metallica' })
  assert.equal(view.count, 12)
  assert.deepEqual(view.named, ['0 USA Mk IV', '2 Metallica'], 'a name cannot be looked up')
  // A slot the unit answered "nothing stored here" about.
  assert.deepEqual(view.empty, ['3-5'])
  /*
   * The half that matters. Learning a name costs a preset dump on a gen-3
   * unit, so a partly-read list is the ordinary case — and without this the
   * honest answer "slots 6 to 11 have not been read" comes out as "you have no
   * preset called that".
   */
  assert.deepEqual(view.unread, ['1', '6-11'])

  // The loaded preset's name came from the unit a moment ago and is the one
  // name certainly right, so it counts even when nothing has been scanned.
  const fresh = slotsForChat([], caps, { number: 7, name: 'Eva Under Fire' })
  assert.deepEqual(fresh.named, ['7 Eva Under Fire'])
  assert.deepEqual(fresh.unread, ['0-6', '8-11'])
  // And a loaded slot with nothing in it is empty, not a preset called nothing.
  assert.deepEqual(slotsForChat([], caps, { number: 1, empty: true }).empty, ['1'])

  // A unit that has never said how many slots it has cannot have unread ones
  // counted — see slotCount. Saying "0-511 unread" about a VP4 is the guess
  // that rule exists to stop.
  const quiet = slotsForChat(seen, null, null)
  assert.equal(quiet.count, null)
  assert.deepEqual(quiet.unread, [])
  assert.deepEqual(quiet.named, ['0 USA Mk IV', '2 Metallica'])

  // A slot past the end of this unit is not one of its slots.
  assert.deepEqual(
    slotsForChat([{ number: 500, name: 'Ghost' }], caps, null).named,
    [],
    'a slot this unit does not have was offered as one it does'
  )

  // A cut list says it was cut, because a cap that is silent is a list the
  // model answers "no" from.
  const many = Array.from({ length: 30 }, (_, i) => ({ number: i, name: `P${i}` }))
  const capped = slotsForChat(many, { presets: { count: 30 } }, null, 10)
  assert.equal(capped.named.length, 10)
  assert.equal(capped.moreNamed, 20)
  assert.equal(slotsForChat(many, { presets: { count: 30 } }, null).moreNamed, undefined)
})


test('recent presets and favourites, per unit', () => {
  /*
   * A 512-slot unit is forty screens of list. Range jumps get you to a
   * neighbourhood; these get you to a preset.
   */
  const { pushRecent, toggleIn, MAX_RECENT, marksFor, remember, toggleFavourite } = marks

  // Most recent first, and playing something again moves it up rather than
  // listing it twice — the difference between eight presets and one preset
  // eight times.
  assert.deepEqual(pushRecent([], 5), [5])
  assert.deepEqual(pushRecent([3, 2, 1], 2), [2, 3, 1])
  assert.deepEqual(pushRecent([1, 2, 3], 4), [4, 1, 2, 3])

  // Eight, and the ninth pushes the oldest off the end.
  const many = [9, 8, 7, 6, 5, 4, 3, 2, 1].reduce((l, n) => pushRecent(l, n), [])
  assert.equal(many.length, MAX_RECENT)
  assert.equal(many[0], 1, 'the newest is not first')
  assert.ok(!many.includes(9), 'the ninth-oldest survived the cap')

  // Slot 0 is a real slot. Anything that is not a slot number is not one.
  assert.deepEqual(pushRecent([], 0), [0])
  assert.deepEqual(pushRecent([1], null), [1])
  assert.deepEqual(pushRecent([1], -2), [1])
  assert.deepEqual(pushRecent([1], 1.5), [1])

  // Stars go on and off, and read back in slot order.
  assert.deepEqual(toggleIn([1, 5], 3), [1, 3, 5])
  assert.deepEqual(toggleIn([1, 3, 5], 3), [1, 5])
  assert.deepEqual(toggleIn([], 0), [0])

  /*
   * Kept per unit. Slot 4 on an FM3 and slot 4 on an AM4 are different
   * sounds, and this was got wrong once already: the marks were keyed on a
   * field the device object does not carry, so every unit shared one bucket.
   */
  const mem = new Map()
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v)
  }
  remember('fm3', 7, store)
  remember('fm3', 4, store)
  toggleFavourite('fm3', 4, store)
  remember('am4', 1, store)

  assert.deepEqual(marksFor('fm3', store).recent, [4, 7])
  assert.deepEqual(marksFor('fm3', store).favourites, [4])
  assert.deepEqual(marksFor('am4', store).recent, [1], 'one unit is reading another unit\'s history')
  assert.deepEqual(marksFor('am4', store).favourites, [], 'a star crossed between two units')

  // A unit that has never been seen is empty, not a crash.
  assert.deepEqual(marksFor('vp4', store), { recent: [], favourites: [] })

  /*
   * A private window throws on both reads and writes, and has since the first
   * iOS that had one. An empty list is the right answer; a broken picker is
   * not.
   */
  const hostile = {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('denied')
    }
  }
  assert.deepEqual(marksFor('fm3', hostile), { recent: [], favourites: [] })
  assert.deepEqual(remember('fm3', 3, hostile), [3], 'a blocked write loses the list it just built')

  // And nonsense in storage reads as empty rather than throwing.
  const junk = { getItem: () => '{"fm3":{"recent":"nope","favourites":[2,"x",2]}}', setItem: () => {} }
  assert.deepEqual(marksFor('fm3', junk), { recent: [], favourites: [2] })
})

test('a confirmed write updates the cached value in place', () => {
  resetSchemaCache()
  const params = [{ id: 7, name: 'Gain', value: 5, min: 0, max: 10 }]
  seedSchemaCache(58, params)
  patchSchemaValue(58, 7, 8)
  assert.equal(params[0].value, 8)
})

test('patching a block that was never cached is harmless', () => {
  resetSchemaCache()
  assert.doesNotThrow(() => patchSchemaValue(999, 1, 5))
})

test('invalidating one block leaves the others cached', () => {
  resetSchemaCache()
  seedSchemaCache(58, [{ id: 7, value: 5 }])
  seedSchemaCache(118, [{ id: 2, value: 3 }])
  invalidateSchema(58)
  // The swapped block must be re-read; the untouched one must not.
  assert.equal(cachedSchema(58), undefined)
  assert.ok(cachedSchema(118))
})






test('the relay refuses what the host refuses', () => {
  assert.ok(forbiddenRemotely('POST', '/preset/store'))
  assert.ok(forbiddenRemotely('POST', '/preset/backup'))
  assert.ok(forbiddenRemotely('POST', '/ports/select'))
  // Version moves are host-refused too; the mirror used to allow them, so the
  // request died as a raw relay error instead of an explanation.
  assert.ok(forbiddenRemotely('POST', '/version/3/restore'))
  /*
   * The cache clear travels now — the pinned fork gives remoteAllowed() a
   * DELETE branch for this one path. Without it nothing a phone wrote could be
   * verified, because verifying means clearing this cache and reading back.
   */
  assert.equal(forbiddenRemotely('DELETE', '/device/cache'), null)
  // And DELETE opened for that path and nothing else.
  assert.ok(forbiddenRemotely('DELETE', '/store/config/layouts'))
  assert.ok(forbiddenRemotely('DELETE', '/preset/blocks/58/params/1'))
  assert.ok(forbiddenRemotely('DELETE', '/device'))
})

test('live performance edits travel fine', () => {
  assert.equal(forbiddenRemotely('PUT', '/preset/blocks/58/params/17'), null)
  assert.equal(forbiddenRemotely('POST', '/scene'), null)
  assert.equal(forbiddenRemotely('POST', '/tempo'), null)
  assert.equal(forbiddenRemotely('POST', '/preset/select'), null)
  /*
   * Naming travels now. It was refused by the host — absent from the writes
   * remoteAllowed() permits and absent from the list of things it says are
   * never remotely reachable, which was an oversight rather than a boundary.
   * It is an edit-buffer write like every other one allowed here, and putting
   * anything in a slot is still /preset/store, which stays refused below.
   */
  assert.equal(forbiddenRemotely('POST', '/preset/name'), null)
  assert.equal(forbiddenRemotely('POST', '/scene/name'), null)
  // GETs are broadly allowed by the host — the old mirror needlessly killed the
  // backup and port lists on the phone, and these assertions encoded that bug.
  assert.equal(forbiddenRemotely('GET', '/backups'), null)
  assert.equal(forbiddenRemotely('GET', '/ports'), null)
  assert.equal(forbiddenRemotely('GET', '/local/presets'), null)
  // Trailing slashes and query strings must not sneak past the check.
  assert.ok(forbiddenRemotely('POST', '/preset/store/'))
  assert.ok(forbiddenRemotely('POST', '/preset/backup?x=1'))
})

test('the mirror agrees with the host about every route this app calls', () => {
  /*
   * The host's rule, transcribed from ForgeFX server/src/remote.ts
   * remoteAllowed() and verified against that file this session. If ForgeFX
   * changes its allowlist, update BOTH this transcription and hostAllows() in
   * src/lib/remote.js — this test exists because the two drifted on eight
   * routes before anyone compared them.
   */
  const hostAllows = (method, p) => {
    if (method === 'GET')
      return !p.startsWith('/cloud') && !p.startsWith('/remote') && p !== '/debug/raw'
    if (method === 'PUT')
      return (
        /^\/preset\/blocks\/\d+\/params(\/\d+)?$/.test(p) ||
        /^\/preset\/grid\/cell$/.test(p) ||
        /^\/am4\/param$/.test(p) ||
        /^\/device\/param$/.test(p) ||
        p === '/telemetry/config' ||
        /^\/store\/config\/[^/]+$/.test(p)
      )
    if (method === 'POST')
      return (
        /^\/preset\/blocks\/\d+\/(bypass|channel|type|read|readrange)$/.test(p) ||
        [
          '/preset/meters',
          '/preset/select',
          '/preset/grid/cable',
          '/preset/grid/select',
          '/scene',
          '/tempo',
          '/tempo/tap',
          '/tuner',
          '/mod/bind',
          // Added to the host in the pinned fork — see desktop/forgefx.lock.json.
          // Whether this client draws meter bars. Touches no preset and reaches
          // no slot; it is what stops a phone costing the unit forty SysEx
          // transactions a second while it is also making sound.
          '/telemetry/meters',
          // Edit-buffer writes; putting anything in a slot is still refused.
          '/preset/name',
          '/scene/name',
          // The looper's buttons: a performance control, like a scene tap.
          '/preset/looper/control'
        ].includes(p) ||
        /^\/am4\/(bypass|scene|preset)$/.test(p)
      )
    // Added to the host on the pinned fork — see desktop/forgefx.lock.json.
    // A read-side hint: it stores no value and reaches no slot, and without it
    // a remote client cannot verify a single write.
    if (method === 'DELETE') return p === '/device/cache'
    return false
  }

  const calls = [
    ['DELETE', '/device/cache'],
    ['DELETE', '/store/config/x'],
    ['GET', '/backups'],
    ['GET', '/blocks'],
    ['GET', '/device/detect'],
    ['GET', '/ports'],
    ['GET', '/preset'],
    ['GET', '/preset/blocks'],
    ['GET', '/preset/blocks/1/params'],
    ['GET', '/preset/grid'],
    ['GET', '/presets/1'],
    ['GET', '/scene'],
    ['GET', '/store/config/x'],
    ['GET', '/tempo'],
    ['POST', '/backup/device'],
    ['POST', '/mod/bind'],
    ['POST', '/ports/select'],
    ['POST', '/preset/backup'],
    ['POST', '/preset/blocks/1/bypass'],
    ['POST', '/preset/blocks/1/channel'],
    ['POST', '/preset/blocks/1/type'],
    ['POST', '/preset/grid/cable'],
    ['POST', '/preset/grid/select'],
    ['POST', '/preset/name'],
    ['POST', '/preset/looper/control'],
    ['POST', '/preset/select'],
    ['POST', '/preset/store'],
    ['POST', '/scene'],
    ['POST', '/scene/name'],
    ['POST', '/tempo'],
    ['POST', '/telemetry/meters'],
    ['POST', '/tempo/tap'],
    ['POST', '/tuner'],
    ['POST', '/version/1/load'],
    ['POST', '/version/1/restore'],
    ['PUT', '/preset/blocks/1/params/1'],
    ['PUT', '/preset/grid/cell'],
    ['PUT', '/store/config/x']
  ]

  for (const [m, p] of calls) {
    const mirror = forbiddenRemotely(m, p) === null
    assert.equal(
      mirror,
      hostAllows(m, p),
      `${m} ${p}: mirror says ${mirror ? 'allowed' : 'blocked'}, host says the opposite`
    )
  }
})

test('an unconfirmed account is not reported as a bad password', () => {
  // Supabase's own wording sends people off changing credentials that were
  // right all along.
  const msg = explainAuth('Email not confirmed')
  assert.ok(/confirm/i.test(msg))
  assert.ok(!/password/i.test(msg))
})

test('unrecognised auth errors pass through unchanged', () => {
  assert.equal(explainAuth('Rate limit exceeded'), 'Rate limit exceeded')
})

test('an account service that has fallen over says so, and points at the demo', () => {
  /*
   * "I can't log into supper base anymore. It says server error, so now I can
   * just do the demo."
   *
   * The project had run out of its disk allowance and every request to it was
   * timing out. Sign-in sat there for twenty seconds, three times, and then
   * said "server error" — which is true, tells a guitarist nothing, and looks
   * exactly like a wrong password. He worked out the demo on his own.
   *
   * None of these are the person's fault and none of them get better by
   * retyping anything, so each one says whose end it is and what still works.
   */
  for (const said of ['The account service timed out.', 'Aborted', 'signal is aborted without reason']) {
    const msg = explainAuth(said)
    assert.match(msg, /didn’t answer in time/, `a timeout still reads as "${said}"`)
    assert.match(msg, /demo/, 'nothing tells them the demo still works')
    assert.doesNotMatch(msg, /password/i, 'a dead service is being blamed on their password')
  }

  const off = explainAuth('Network request failed')
  assert.match(off, /internet connection/, 'no wifi reads as an account problem')
  assert.doesNotMatch(off, /password/i)

  for (const said of ['server error', 'unexpected_failure', 'HTTP 503']) {
    const msg = explainAuth(said)
    assert.match(msg, /trouble at its end/, `"${said}" is still being handed to the person raw`)
    assert.match(msg, /demo/)
  }

  /* And the two that ARE the person's to fix stay that way. */
  assert.match(explainAuth('Invalid login credentials'), /didn’t match/)
  assert.match(explainAuth('Email not confirmed'), /confirm/i)
})

test('a preset backup is refused remotely, matching the host', () => {
  // Which is why scene names have to be cached: on an AM4 they only exist
  // inside the dump, and the dump cannot cross the relay.
  assert.ok(forbiddenRemotely('POST', '/preset/backup'))
  // The summary is a GET and does travel — that's the FM3's path to names.
  assert.equal(forbiddenRemotely('GET', '/presets/12/summary'), null)
})

test('a preset name is made safe to use as a filename', async () => {
  // This writes to a real folder on someone's Mac, so a name with a slash in it
  // must not become a path.
  let written = null
  const folder = {
    getFileHandle: async (file) => {
      written = file
      return { createWritable: async () => ({ write: async () => {}, close: async () => {} }) }
    }
  }
  const { writePresetFile } = await import('../src/lib/localFolder.js')
  await writePresetFile(folder, 'Drop A / "Lead" *rhythm*', [1, 2, 3])
  assert.ok(!written.includes('/'))
  assert.ok(!written.includes('"'))
  assert.ok(written.endsWith('.syx'))
})

test('an empty name still produces a usable file', async () => {
  let written = null
  const folder = {
    getFileHandle: async (file) => {
      written = file
      return { createWritable: async () => ({ write: async () => {}, close: async () => {} }) }
    }
  }
  const { writePresetFile } = await import('../src/lib/localFolder.js')
  await writePresetFile(folder, '   ', [1])
  assert.equal(written, 'preset.syx')
})

test('a name of dots cannot produce a hidden file', async () => {
  let written = null
  const folder = {
    getFileHandle: async (file) => {
      written = file
      return { createWritable: async () => ({ write: async () => {}, close: async () => {} }) }
    }
  }
  const { writePresetFile } = await import('../src/lib/localFolder.js')
  await writePresetFile(folder, '...', [1])
  assert.ok(!written.startsWith('.'))
})

// Panel order is stored per screen and read back into whatever panels exist
// today, so it has to survive ids appearing, vanishing and repeating.
const sortIds = (order, ids) => [
  ...new Set([...order.filter((x) => ids.includes(x)), ...ids.filter((x) => !order.includes(x))])
]

test('with no saved order panels keep their natural order', () => {
  assert.deepEqual(sortIds([], ['a', 'b', 'c']), ['a', 'b', 'c'])
})

test('a saved order is applied and unknown panels follow', () => {
  assert.deepEqual(sortIds(['c', 'a'], ['a', 'b', 'c']), ['c', 'a', 'b'])
})

test('a panel that no longer exists is ignored', () => {
  // A unit without scenes shows fewer panels than the one that saved the order.
  assert.deepEqual(sortIds(['gone', 'b'], ['a', 'b']), ['b', 'a'])
})

test('a repeated id cannot render a panel twice', () => {
  // React throws on duplicate keys, and the panel would appear twice.
  const out = sortIds(['b', 'b', 'a'], ['a', 'b'])
  assert.equal(out.length, new Set(out).size)
  assert.deepEqual(out, ['b', 'a'])
})

test('dropping a panel moves it without losing any', () => {
  const drop = (sorted, dragging, target) => {
    const next = sorted.filter((x) => x !== dragging)
    next.splice(next.indexOf(target), 0, dragging)
    return next
  }
  assert.deepEqual(drop(['a', 'b', 'c', 'd'], 'd', 'b'), ['a', 'd', 'b', 'c'])
  assert.equal(drop(['a', 'b', 'c'], 'a', 'c').length, 3)
})

// The gig screen on a phone. Both failures here were silent: a read that timed
// out looked like a preset with no blocks, and names that couldn't travel the
// relay looked like scenes nobody had named.
console.log('\ngig over the relay')

test('a preset dump read gets longer than a scene change', () => {
  assert.ok(timeoutFor('GET', '/preset/blocks') > timeoutFor('POST', '/scene'))
})

test('the block list read is treated as slow — it dumps the preset on an AM4', () => {
  assert.equal(timeoutFor('GET', '/preset/blocks'), 45000)
  assert.equal(timeoutFor('GET', '/preset/blocks?fresh=1'), 45000)
  assert.equal(timeoutFor('GET', '/presets/97/summary'), 45000)
})

test('an ordinary write keeps the short timeout', () => {
  assert.equal(timeoutFor('POST', '/scene'), 20000)
  assert.equal(timeoutFor('PUT', '/preset/grid/cell'), 20000)
})

test('a block that looks slow but is a plain write is not given the long wait', () => {
  // The bypass toggle is the one thing that has to feel instant on stage.
  assert.equal(timeoutFor('POST', '/preset/blocks/58/bypass'), 20000)
})

test('scene names still travel to the host, which is why the phone can read them', () => {
  // GET of a stored doc is allowed; the config PUT is on the host allowlist.
  assert.equal(forbiddenRemotely('GET', '/store/config/scene-names-am4:97'), null)
  assert.equal(forbiddenRemotely('PUT', '/store/config/scene-names-am4:97'), null)
})

test('the dump those names come from still does not', () => {
  // Which is the whole reason for the host copy.
  assert.ok(forbiddenRemotely('POST', '/preset/backup'))
})

// Cached names are keyed per unit. An AM4 and an FM3 both have a slot 97 and
// they are not the same preset.
const key = (model, n) => `${model}:${n}`

test('two units cannot share one preset cache entry', () => {
  assert.notEqual(key('am4', 97), key('fm3', 97))
})

// What the gig screen shows for the block row, given how the read went.
const chainState = (state, count) =>
  state === 'failed' ? 'explain' : state === 'reading' && !count ? 'reading' : count ? 'buttons' : 'empty'

test('a failed read explains itself rather than showing nothing', () => {
  assert.equal(chainState('failed', 0), 'explain')
})

test('a preset that genuinely has no blocks says so', () => {
  assert.equal(chainState('ok', 0), 'empty')
})

test('blocks that arrived are just buttons', () => {
  assert.equal(chainState('ok', 4), 'buttons')
})

test('a refresh that fails after blocks were showing still explains itself', () => {
  // The old code cleared the row and left it looking like an empty preset.
  assert.equal(chainState('failed', 4), 'explain')
})

// Saving. Both complaints were about the button, not the write: it couldn't be
// found, and when it was found it appeared to do nothing.
console.log('\nsaving')

// What the bar offers, given where the app is running and what it's waiting on.
const saveButton = (remote, busy, queued) =>
  queued ? 'waiting' : busy ? 'working' : remote ? 'ask the computer' : 'save'

test('a slot write is offered when the cable is on this machine', () => {
  assert.equal(saveButton(false, false, null), 'save')
})

test('a remote session saves through the computer rather than refusing', () => {
  // ForgeFX refuses POST /preset/store over the relay — correctly, and still.
  // The request goes by the road that IS open, and the page at the Mac writes
  // it; the button says who does the writing instead of being dead.
  assert.equal(saveButton(true, false, null), 'ask the computer')
  assert.ok(forbiddenRemotely('POST', '/preset/store'))
  // The road: config docs are the one write the host takes from a distance.
  assert.equal(forbiddenRemotely('PUT', '/store/config/fractal.pendingSave.fm3'), null)
  assert.equal(forbiddenRemotely('GET', '/store/config/fractal.saveResult.fm3'), null)
  // And the clean-up stays at the Mac, which is why the phone never deletes.
  assert.ok(forbiddenRemotely('DELETE', '/store/config/fractal.pendingSave.fm3'))
})

test('a queued save says it is waiting rather than offering to ask twice', () => {
  assert.equal(saveButton(true, false, { id: 'x', slot: 12 }), 'waiting')
})

// The bar is present whether or not the app believes anything changed.
const barShown = (status, view) => status === 'live' && view !== 'gig'

test('the save bar is there before anything is edited', () => {
  // dirty is the app's belief; a knob turned on the front panel doesn't set it,
  // and a button that comes and goes by an invisible rule can't be learned.
  assert.ok(barShown('live', 'design'))
  assert.ok(barShown('live', 'edit'))
})

test('gig keeps no slot write within reach of a mis-tap', () => {
  assert.ok(!barShown('live', 'gig'))
})

test('nothing to save to when no unit is attached', () => {
  assert.ok(!barShown('fault', 'design'))
})

// An empty slot field means the slot already loaded, so the common save needs
// nothing typed at all.
const target = (slot, loaded) => (slot === '' ? loaded : Number(slot))

test('an untouched slot field saves over the preset you are playing', () => {
  assert.equal(target('', 97), 97)
})

test('a typed slot saves a copy elsewhere', () => {
  assert.equal(target('12', 97), 12)
})

test('slot zero is a real slot, not an empty field', () => {
  // `slot || preset.number` would have sent this to 97.
  assert.equal(target('0', 97), 0)
})

console.log('\nthe relay coming and going')

test('the host can be asked whether it is there', () => {
  // The probe that replaced presence: the host joins the channel but never
  // tracks presence, so "is anyone else here?" was always answered no. A
  // relayed GET is the test instead, and it has to be one the host allows.
  assert.equal(forbiddenRemotely('GET', '/healthz'), null)
})

test('a channel whose socket closed is never handed back', async () => {
  const { canReuseChannel } = await import('../src/lib/remote.js')
  const client = { id: 'a' }
  const joined = { state: 'joined' }
  const closed = { state: 'closed' }
  assert.equal(canReuseChannel(joined, { client, chan: joined }, client), true)
  // The bug: connect returned this one, so every request went into a dead
  // socket and only reloading the page ever fixed it.
  assert.equal(canReuseChannel(closed, { client, chan: closed }, client), false)
})

test('a channel belonging to a previous sign-in is never handed back', async () => {
  const { canReuseChannel } = await import('../src/lib/remote.js')
  const old = { id: 'old' }
  const fresh = { id: 'fresh' }
  const chan = { state: 'joined' }
  assert.equal(canReuseChannel(chan, { client: old, chan }, fresh), false)
})

test('nothing to reuse is not something to reuse', async () => {
  const { canReuseChannel } = await import('../src/lib/remote.js')
  const client = { id: 'a' }
  assert.equal(canReuseChannel(null, null, client), false)
  assert.equal(canReuseChannel({ state: 'joined' }, null, client), false)
})

test('a request that could not travel is told apart from one the unit refused', async () => {
  /*
   * "Disconnected from phone remote when sending presets to FM3."
   *
   * A send is hundreds of writes down one serial port over minutes, and the
   * phone locks part-way through. Every remaining write then failed instantly
   * with a message about the link, and applyChanges recorded each as a
   * refusal — ninety failure lines for writes that never left the handset.
   * The flag is what lets the write loop stop instead.
   */
  const src = readSrc(new URL('../src/lib/remote.js', import.meta.url), 'utf8')
  assert.match(src, /function linkDown\(message\)[\s\S]*err\.linkDown = true/, 'the relay has no way to say "this never left the phone"')
  assert.match(src, /failWaiting\(message\) \{[\s\S]*pending\.reject\(linkDown\(message\)\)/, 'requests killed by a closing socket arrive as ordinary failures')

  const forge = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')
  assert.match(forge, /if \(cause\?\.linkDown\) this\.linkDown = true/, 'the flag is flattened away crossing into ForgeError')
  // The same crossing used to drop remoteBlocked, so the one branch that reads
  // it — the rename a phone is not allowed to make — could never be true.
  assert.match(forge, /if \(cause\?\.remoteBlocked\) this\.remoteBlocked = true/)
})

test('everything the relay carries may be sent twice, except a tap', async () => {
  const { repeatable } = await import('../src/lib/remote.js')
  /*
   * Retrying is only safe because these say where something should END UP.
   * Arriving twice leaves the unit exactly where arriving once did.
   */
  for (const path of [
    '/preset/blocks/58/params',
    '/preset/blocks/58/channel',
    '/preset/blocks/58/type',
    '/preset/blocks/58/bypass',
    '/preset/select',
    '/scene',
    '/tempo',
    '/healthz'
  ]) {
    assert.equal(repeatable(path), true, `${path} is a value, not an event`)
  }
  // A beat is not a destination: a resent tap is a beat that never happened.
  assert.equal(repeatable('/tempo/tap'), false)
  assert.equal(repeatable('/tempo/tap?x=1'), false, 'a query string is not a different route')
  assert.equal(repeatable('/tempo/tap/'), false, 'nor is a trailing slash')
  // A looper button is a press: a resent one is Record on, off and on again.
  assert.equal(repeatable('/preset/looper/control'), false)
  assert.equal(repeatable('/preset/looper'), true, 'where the playhead is, is a read')
})

test('the looper\u2019s buttons latch, press and stop the way Axiom drives the same block', async () => {
  const L = await import('../shared/looper.mjs')
  /* Record, Play, Dub, Reverse and Half latch: one write, and the next tap undoes it. */
  let t = L.looperTap(L.IDLE_LATCH, 'record')
  assert.deepEqual(t.sends, [true])
  assert.equal(t.next.record, true)
  t = L.looperTap(t.next, 'record')
  assert.deepEqual(t.sends, [false], 'a second tap on Rec does not let it go')
  assert.equal(t.next.record, false)
  /* Stop, Undo and Once are a press and a release. */
  for (const action of ['stop', 'undo', 'once']) assert.deepEqual(L.looperTap(L.IDLE_LATCH, action).sends, [true, false], `${action} is not a quick press`)
  /* Stop puts out every light that means sound is moving. */
  const lit = { ...L.IDLE_LATCH, record: true, play: true, overdub: true, reverse: true }
  const stopped = L.looperTap(lit, 'stop').next
  assert.deepEqual([stopped.record, stopped.play, stopped.overdub, stopped.reverse], [false, false, false, true], 'Stop leaves Rec, Play or Dub lit, or turns Reverse off')
  assert.equal(L.looperTap(lit, 'undo').next, lit, 'Undo changes what is lit')
  /* Every button in the panel has a word and every word is a button. */
  assert.deepEqual(L.LOOPER_ROWS.flat().sort(), Object.keys(L.LOOPER_LABEL).sort())
  /* The emergency stop: Stop pressed and let go, then everything that plays written off. Never a write that turns something ON except the press of Stop itself. */
  assert.deepEqual(L.STOP_EVERYTHING.slice(0, 2), [['stop', true], ['stop', false]])
  assert.ok(L.STOP_EVERYTHING.slice(2).every(([, on]) => on === false), 'the emergency stop switches something on')
  assert.deepEqual(L.STOP_EVERYTHING.slice(2).map(([a]) => a).sort(), ['overdub', 'play', 'record'])
  /* The status word. */
  assert.equal(L.looperStatus(L.IDLE_LATCH, false), 'Stopped')
  assert.equal(L.looperStatus(L.IDLE_LATCH, true), 'Playing', 'a moving playhead is not called playing')
  assert.equal(L.looperStatus({ ...L.IDLE_LATCH, record: true }, true), 'Recording')
  assert.equal(L.looperStatus(null, false), 'Stopped')
  /* One latch per preset and block. */
  assert.notEqual(L.looperKey(1, 158), L.looperKey(2, 158))
  /* The telemetry, made safe to draw. */
  assert.deepEqual(L.readTelemetry({ wave: [2, -1, 0.5, 'x'], position: 1.4 }), { wave: [1, 0, 0.5, 0], position: 1 })
  assert.deepEqual(L.readTelemetry(null), { wave: [], position: null })
  assert.deepEqual(L.readTelemetry({ position: 'soon' }).position, null)
  const many = Array.from({ length: 595 }, (_, i) => (i === 300 ? 1 : 0.1))
  const bars = L.waveBars(many, 60)
  assert.equal(bars.length, 60)
  assert.equal(Math.max(...bars), 1, 'the loudest point of the loop vanished in the cut-down')
  assert.deepEqual(L.waveBars([0.2, 0.4], 60), [0.2, 0.4])
  assert.deepEqual(L.waveBars(null), [])
  /* Gentle on the unit: never faster than the meter gate that ended the dropouts. */
  assert.ok(L.TELEMETRY_MS >= 1000, 'the looper asks the unit more than once a second')
})

test('the looper\u2019s buttons are at both ends: the pedal on Edit, a button on Play, and a stop in Setup', () => {
  const bare = (t) => t.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ')
  const app = bare(readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8'))
  assert.match(app, /\{openBlock\?\.slug === 'looper' \? <Looper block=\{openBlock\} presetNumber=\{preset\?\.number\} \/> : null\}/, 'tapping the Looper pedal in the browser does not open its buttons')
  assert.match(app, /title="Stop the looper"/, 'Setup has no way to stop a looper that keeps playing')
  assert.match(app, /await stopLooper\(looper\.effectId\)/)
  const edit = bare(readSrc(new URL('../mobile/src/screens/Edit.js', import.meta.url), 'utf8'))
  assert.match(edit, /\{block\?\.slug === 'looper' \? <Looper block=\{block\} \/> : null\}/, 'tapping the Looper pedal on the phone does not open its buttons')
  const settings = bare(readSrc(new URL('../mobile/src/screens/Settings.js', import.meta.url), 'utf8'))
  assert.match(settings, /title="Stop the looper"/, 'the phone\u2019s Settings has no way to stop a looper that keeps playing')
  assert.match(settings, /await stopLooper\(looper\.effectId\)/)
  /* Both ends send the same route, and the demo answers it rather than throwing. */
  const phone = readSrc(new URL('../mobile/src/lib/device.js', import.meta.url), 'utf8')
  const web = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')
  for (const src of [phone, web]) {
    assert.match(src, /'\/preset\/looper\/control'/)
    assert.match(src, /`\/preset\/looper\?eid=\$\{eid\}`/)
  }
  const demo = readSrc(new URL('../mobile/src/lib/demoWire.js', import.meta.url), 'utf8')
  assert.match(demo, /path === '\/preset\/looper\/control'\) return \{ ok: true \}/, 'the demo throws on a looper button')
})

test('a request waits for the relay to come back rather than failing into the gap', async () => {
  const { waitForRelay } = await import('../src/lib/remote.js')
  /*
   * realtime-js reopens the socket a second or two after it closes. For that
   * second or two every request failed outright, which is survivable under a
   * finger and fatal in the middle of a send.
   */
  let slept = 0
  const sleep = async (ms) => {
    slept += ms
  }
  // No session at all: nothing is coming back, and the wait ends rather than
  // hanging on for ever.
  assert.equal(await waitForRelay(600, 150, sleep), false)
  assert.ok(slept >= 600, 'the grace period was not actually waited out')
})

test('the health probe asks for no grace, because it is what decides the grace', async () => {
  const src = readSrc(new URL('../src/lib/remote.js', import.meta.url), 'utf8')
  const probe = src.slice(src.indexOf('export async function hostResponds'))
  assert.match(probe.slice(0, 900), /graceMs: 0/, 'the probe that tests the link would wait out the link’s own grace period')
})




test('every model on the unit can be looked up by what it really is', async () => {
  /*
   * "Add an info page like this to settings listing the real life equivalents
   * of each amp and effects pedals."
   *
   * The catalog has been in the repo since the model picker learned to print a
   * lineage; what it could not do was answer "what have I got", because every
   * route into lineage.js needs a model name you already know.
   */
  const { GEAR_GROUPS, GEAR_TOTAL, searchGear } = await import('../src/lib/gearCatalog.js')

  const byKey = Object.fromEntries(GEAR_GROUPS.map((g) => [g.key, g]))
  assert.ok(byKey.amp && byKey.drive, 'the two lists anybody came here for are missing')

  /*
   * Cabinets were the absence that had to stay an absence: all 45 carried a
   * blank lineage, so a Cabs tab would have been 45 rows of nothing, and the
   * rule this inherits from lineage.js is silence over a plausible guess.
   *
   * Then all 45 got a description — what the cabinet sounds like, which is the
   * thing anybody choosing one actually wants — and a dozen got a photograph.
   * A row with a paragraph behind it is not a blank row, so they are listed.
   *
   * What is still absent is the attribution, and that is a fact about how
   * Fractal names cabinets rather than a hole in the research: "1x12 Deluxe
   * Tweed" already says what it is. `lineage: false` is how the lists know not
   * to print "nobody has recorded what this one is based on" 45 times about
   * something that was never missing.
   */
  assert.ok(byKey.cab, 'the cabs are not listed, so nothing can reach their descriptions')
  assert.equal(byKey.cab.lineage, false, 'the cab list will apologise under every row for an attribution that does not exist')
  assert.equal(byKey.cab.entries.length, 45, `the cab list holds ${byKey.cab.entries.length} rows`)
  const { descriptionFor } = await import('../src/lib/lineage.js')
  const describedCabs = byKey.cab.entries.filter((e) => descriptionFor('cab', e.name)).length
  assert.equal(
    describedCabs,
    byKey.cab.entries.length,
    `${describedCabs} of ${byKey.cab.entries.length} cabs say what they sound like`
  )

  // Every amp names a real amp. That is the state of the data and the thing
  // most worth noticing if it ever stops being true.
  const ampsNamed = byKey.amp.entries.filter((e) => e.gear).length
  assert.equal(ampsNamed, byKey.amp.entries.length, ampsNamed + ' of ' + byKey.amp.entries.length + ' amps name their real amp')
  assert.ok(byKey.amp.entries.length > 300, 'the amp list came back short: ' + byKey.amp.entries.length)
  assert.ok(GEAR_TOTAL > 400, 'only ' + GEAR_TOTAL + ' models can be named')

  // Fractal's own designs say so rather than borrowing somebody's amp.
  const fas = byKey.amp.entries.find((e) => e.name === 'FAS Modern')
  assert.match(fas?.gear || '', /custom model/i, 'a FAS original claims a real amp')

  // No model is listed twice — the same amp sits at more than one value on
  // some units, and a reference sheet that repeats itself reads as a bug.
  const names = byKey.amp.entries.map((e) => e.name)
  assert.equal(names.length, new Set(names).size, 'the amp list repeats itself')

  // Sorted, because 331 rows in catalog order is a list you scroll past.
  const sorted = [...names].sort((a, b) => a.localeCompare(b))
  assert.deepEqual(names, sorted, 'the list is not in an order anybody can scan')
  /*
   * Plain alphabetical, not numeric collation: that reads "5F1 Tweed" as 5 and
   * "59 Bassguy" as 59, and files every 5F, 5E and 5C amp ahead of the Bassman.
   */
  assert.ok(
    names.indexOf('59 Bassguy Bright') < names.indexOf('5F1 Tweed'),
    'the Bassman is filed after the amps whose names merely start with 5'
  )

  /*
   * The search has to read BOTH columns. What a person types is the REAL name
   * — "tube screamer" — which appears nowhere in the unit's own "T808 OD". A
   * search over the model names alone answers nothing for every query anyone
   * actually has, which is the whole reason the sheet exists.
   */
  const ts = searchGear(byKey.drive.entries, 'tube screamer')
  assert.ok(ts.length >= 2, 'searching the real name found ' + ts.length + ' of the Tube Screamers')
  assert.ok(ts.every((e) => !/tube screamer/i.test(e.name)), 'that search matched on the model name, so it proves nothing')

  // And still by the unit's own word for it.
  assert.ok(searchGear(byKey.amp.entries, 'brit 800').length, 'the unit’s own name finds nothing')

  // Every word has to match, so a second word narrows rather than widens.
  const marshall = searchGear(byKey.amp.entries, 'marshall')
  const plexi = searchGear(byKey.amp.entries, 'marshall plexi')
  assert.ok(plexi.length && plexi.length < marshall.length, 'a second word did not narrow the search')

  // An empty query is the whole list, not nothing.
  assert.equal(searchGear(byKey.amp.entries, '  ').length, byKey.amp.entries.length)

  /*
   * And a search says where its answers are. Somebody types "tube screamer"
   * with Amps open — the tab they land on by default — and every hit is in
   * Drives. Tabs still reading their full contents give no hint of that, so
   * the counts follow the search and the empty state names the tab.
   */
  const { searchAll } = await import('../src/lib/gearCatalog.js')
  const steer = searchAll('tube screamer')
  assert.equal(steer.find((g) => g.key === 'amp').hits.length, 0, 'the amps claim to hold a Tube Screamer')
  assert.ok(steer.find((g) => g.key === 'drive').hits.length >= 2, 'the drives lost them')
  assert.equal(steer.length, GEAR_GROUPS.length, 'searching all of them skipped one')
})

test('a write nobody could check is not written again on a guess', async () => {
  /*
   * From a debug log off an iPhone: Drive 1, Tone, Level, Mix and Treble each
   * written twice, the second time in the opposite encoding, every one of them
   * reported "NOT CHECKED".
   *
   * The retry is for one fault — the device silently ignoring an encoding it
   * does not take — and the evidence for it is a read that came back wrong. A
   * read that could not be MADE is not that evidence, and a second write to
   * the hardware chosen on the strength of nothing is not a check.
   *
   * And no check deletes anything first. Every checked write used to send
   * DELETE /device/cache to "clear the parameter cache"; on the pinned device
   * server a block's values are read off the unit every time, and that route
   * deletes the computer's saved profile of the FM3, which is only missed at
   * the next reconnect.
   */
  const store = { 'forgefx.host': 'http://unit.test' }
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v)
    },
    removeItem: (k) => {
      delete store[k]
    }
  }
  const seen = []
  let readable = false
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET'
    const path = String(url).replace('http://unit.test', '')
    seen.push(method + ' ' + path)
    // The read-back: the block will not answer, or answers with what was sent.
    if (method === 'GET' && path.endsWith('/params')) {
      if (!readable) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => JSON.stringify({ error: 'bulk read timed out' })
        }
      }
      return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify({ named: [{ id: 3, name: 'Tone', value: 5 }] }) }
    }
    return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify({ ok: true }) }
  }

  try {
    const fx = await import('../src/lib/forgefx.js')
    const res = await fx.setParamConfirmed(9, 3, 5, { name: 'Tone', min: 0, max: 10 })

    assert.equal(res.ok, false, 'a check that proved nothing was reported as a success')
    assert.equal(res.unverified, true, 'the caller cannot tell "unchecked" from "the unit ignored it"')
    assert.equal(res.retried, false, 'it retried on a check that proved nothing')

    const writes = seen.filter((c) => c.startsWith('PUT '))
    assert.equal(writes.length, 1, 'the value went to the hardware ' + writes.length + ' times')
    assert.deepEqual(seen.filter((c) => c.includes('/device/cache')), [], 'a checked write deletes the computer’s profile of the unit')

    /* A read that answers is believed, and still costs no delete. */
    readable = true
    seen.length = 0
    const good = await fx.setParamConfirmed(9, 3, 5, { name: 'Tone', min: 0, max: 10 })
    assert.equal(good.ok, true, 'a value read back as sent was not believed')
    assert.deepEqual(
      seen.filter((c) => !c.startsWith('POST /telemetry')),
      ['PUT /preset/blocks/9/params/3', 'GET /preset/blocks/9/params'],
      'a checked write is more than the write and one read'
    )
  } finally {
    delete globalThis.fetch
    delete globalThis.localStorage
  }
})

test('“port not open” becomes something a guitarist can act on', async () => {
  /*
   * Eighty lines of one debug log, all of them this:
   *
   *   POST /preset/blocks/58/bypass failed — port not open
   *
   * That is the device server saying it has no serial port to the unit any
   * more. What reached the screen was those four words, and only when the
   * screen showing them was not covered by a sheet — so tapping a block's On
   * button did nothing, said nothing, and put the button back the way it was.
   *
   * Two things are fixed here and both are asserted: the sentence a player
   * reads, and the flag the app needs to know the difference between "that
   * write was refused" and "nothing reaches the unit any more".
   */
  const store = { 'forgefx.host': 'http://unit.test' }
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v)
    },
    removeItem: (k) => {
      delete store[k]
    }
  }
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    text: async () => JSON.stringify({ error: 'port not open' })
  })

  try {
    const fx = await import('../src/lib/forgefx.js')
    const err = await fx.setBypass(58, true).then(
      () => null,
      (e) => e
    )
    assert.ok(err, 'a write to a unit that is not there came back a success')
    assert.equal(err.unitGone, true, 'the app cannot tell this from a write the unit refused')
    assert.ok(!/port/i.test(err.message), 'the server’s own words went to the screen: ' + err.message)
    assert.match(err.message, /lost its connection to the unit/)
    assert.match(err.message, /Try again/, 'it says what is wrong and not what to do about it')
    assert.equal(err.detail, 'port not open', 'the debug log lost what the server actually said')

    // A refusal is not this. The old state still stands and the screen must
    // keep it rather than tearing itself down.
    assert.equal(fx.unitUnreachable("You can't do that from a distance"), false)
    assert.equal(fx.unitUnreachable('Port is not open'), true, 'the same fault in the serial layer’s words')
  } finally {
    delete globalThis.fetch
    delete globalThis.localStorage
  }
})

test('a dropped link stops the send instead of failing every write after it', () => {
  const forge = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')
  assert.match(forge, /function relayGone\(err, done, total, what\)/)
  assert.match(forge, /if \(!err\?\.linkDown\) return null/, 'a unit that refused a write must not stop the send')
  assert.match(forge, /dropped after \$\{done\} of \$\{total\}/, 'how far it got is the number that decides what to do next')

  // Every loop that talks to the unit over the relay: the write pass, the
  // scene pass, the read-back, and the schema read the generator designs from.
  const uses = forge.match(/relayGone\(/g) || []
  assert.ok(uses.length >= 10, `only ${uses.length} call sites — a loop was left grinding through a dead link`)

  // The schema read is the subtle one: its catch was empty, so a relay that
  // went away produced blocks with no parameters and the generator designed a
  // tone against a preset nobody could read.
  const schema = forge.slice(forge.indexOf('export async function readSchema'), forge.indexOf('export async function applyChanges'))
  assert.match(schema, /const stop = relayGone\(err, i, editable\.length, 'blocks read'\)/)
})

test('Try again rejoins before it reads, which is all a reload ever did', () => {
  /*
   * "Hitting try again did nothing. Refreshing browser reconnect."
   *
   * pokeLink schedules a timer; it does not connect. So the read ran first,
   * over a socket that had already closed, failed instantly, and put the same
   * fault screen straight back up — while the rejoin it had asked for landed
   * seconds later with nothing looking at it.
   */
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const fn = app.slice(app.indexOf('const reconnect = useCallback'), app.indexOf('const linkAction = useCallback'))
  assert.match(fn, /await reconnectPhone\(\{ fresh: true \}\)/, 'the button asks for a rejoin it does not wait for')
  assert.ok(
    fn.indexOf('await reconnectPhone({ fresh: true })') < fn.indexOf('await read()'),
    'the read still runs before the rejoin'
  )
  assert.ok(!/pokeLink\(\)/.test(fn), 'a scheduled poke is not a reconnection')
})

test('Try again asks for a new socket, which is the rest of what a force-quit did', async () => {
  /*
   * "I have to force close the app completely and then reopen it for it to
   * connect again." Rejoining before the read fixed the case where the socket
   * had visibly closed. This is the other one: a socket realtime-js still
   * calls joined that the server let go of long ago. Nothing in here can tell
   * that from a working link — the phone sends into it and simply hears
   * nothing — so a reconnect that reuses "a channel that looks fine" reads
   * down the same dead line every time, and only killing the app ever helped.
   *
   * The keepalive still reuses a good channel: it runs every few seconds and
   * a teardown on each turn would be a link that never settles.
   */
  const remoteMod = await import('../src/lib/remote.js')
  const chan = { state: 'joined' }
  const client = {}
  assert.equal(remoteMod.canReuseChannel(chan, { client }, client), true, 'a joined channel stopped being reusable')

  const remoteSrc = readSrc(new URL('../src/lib/remote.js', import.meta.url), 'utf8')
  assert.match(
    remoteSrc,
    /export async function remoteConnect\(\{ fresh = false \} = \{\}\)/,
    'connect cannot be asked for a new socket'
  )
  assert.match(
    remoteSrc,
    /if \(!fresh && canReuseChannel\(channel, session, client\)\) return userId/,
    'a forced rejoin is still handed the channel it was trying to replace'
  )

  const linkSrc = readSrc(new URL('../src/lib/link.js', import.meta.url), 'utf8')
  assert.match(linkSrc, /async function join\(\{ fresh = false \} = \{\}\)/)
  assert.match(linkSrc, /await remoteConnect\(\{ fresh \}\)/, 'the flag stops at the door')
  /*
   * Both Try agains, not just the one on the fault screen. The connect screen
   * is where someone lands when the Mac has stopped answering, which is
   * exactly when the channel is most likely to be the zombie this is about.
   */
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.equal(
    (app.match(/reconnectPhone\(\{ fresh: true \}\)/g) || []).length,
    2,
    'one of the two Try agains still reuses the socket it is trying to replace'
  )

  const at = linkSrc.indexOf('async function tick()')
  assert.notEqual(at, -1, 'the keepalive loop is gone, so nothing here is being checked')
  const loop = linkSrc.slice(at, at + 900)
  assert.match(loop, /await join\(\)/, 'the loop no longer joins at all')
  assert.ok(!/join\(\{/.test(loop), 'the keepalive tears the link down every few seconds')
})

test('a poke asks now, not in three seconds', () => {
  const src = readSrc(new URL('../src/lib/link.js', import.meta.url), 'utf8')
  const poke = src.slice(src.indexOf('export function pokeLink'), src.indexOf('export function pokeLink') + 200)
  assert.match(poke, /schedule\(0\)/, 'a screen just unlocked waits three seconds before anything happens')
  // And a socket that closed is chased at once rather than at the next turn of
  // the loop — up to thirty seconds while backed off, never while hidden.
  assert.match(src, /if \(!up && state\.role === 'remote'[\s\S]{0,120}pokeLink\(\)/)
})

test('the screen is held awake for as long as the unit is being written to', async () => {
  const { keepAwake } = await import('../src/lib/awake.js')

  let taken = 0
  let released = 0
  const listeners = {}
  let onRelease = null
  const nav = {
    wakeLock: {
      request: async () => {
        taken++
        return {
          addEventListener: (name, fn) => {
            if (name === 'release') onRelease = fn
          },
          release: async () => {
            released++
          }
        }
      }
    }
  }
  const doc = {
    hidden: false,
    addEventListener: (name, fn) => {
      listeners[name] = fn
    },
    removeEventListener: (name) => {
      delete listeners[name]
    }
  }

  const release = keepAwake({ nav, doc })
  await Promise.resolve()
  assert.equal(taken, 1, 'a send runs for minutes with nobody touching the screen; auto-lock ends it')

  /*
   * The system drops the lock whenever the page is hidden and does NOT hand it
   * back. One glance at a notification would otherwise end the protection for
   * the rest of the send, silently — so it is re-taken on the way back.
   */
  doc.hidden = true
  onRelease()
  listeners.visibilitychange()
  await Promise.resolve()
  assert.equal(taken, 1, 'a hidden page asked for a lock it cannot hold')

  doc.hidden = false
  listeners.visibilitychange()
  await Promise.resolve()
  assert.equal(taken, 2, 'the lock the system took back was never asked for again')

  // A lock we still hold is not asked for twice.
  listeners.visibilitychange()
  await Promise.resolve()
  assert.equal(taken, 2)

  release()
  assert.equal(released, 1, 'a finished send leaves the screen on for the rest of the night')
  assert.equal(listeners.visibilitychange, undefined, 'the listener outlives the send')
})

test('a request caught between one channel and the next waits for the next one', () => {
  /*
   * The rejoin the drop itself triggers tears the old session down before it
   * registers the new one. A request landing in that window would have been
   * told "not connected" and given up — over a link that was a second from
   * coming back, and coming back because of the very drop it was reacting to.
   */
  const src = readSrc(new URL('../src/lib/remote.js', import.meta.url), 'utf8')
  assert.match(src, /if \(!session && !connecting\) throw linkDown\('Not connected to your computer\.'\)/)
  assert.match(src, /connecting = true\n  try \{\n    return await joinChannel\(\)\n  \} finally \{\n    connecting = false\n  \}/)
})

test('the grace period is one budget for the request, not one per attempt', () => {
  /*
   * The screen that decides whether a unit is really gone asks five reads in a
   * row. A retry that could double each one's wait would turn a flapping link
   * into eighty seconds of nothing.
   */
  const src = readSrc(new URL('../src/lib/remote.js', import.meta.url), 'utf8')
  assert.match(src, /const graceUntil = Date\.now\(\) \+ \(options\.graceMs \?\? RELAY_GRACE\)/)
  assert.match(src, /await relayReady\(graceUntil - Date\.now\(\)\)/, 'each attempt starts its own grace period')
})



test('a browser with no wake lock is not a browser that cannot send', async () => {
  const { keepAwake } = await import('../src/lib/awake.js')
  // Older Safari, and any context that refuses. The relay's own patience
  // covers the lock that then happens anyway.
  const release = keepAwake({ nav: {}, doc: { addEventListener: () => {} } })
  assert.equal(typeof release, 'function')
  release()
})

test('the save guard asks the unit which preset is loaded, not the screen', () => {
  /*
   * "I keep seeing the 'Mac has moved to slot 7' but it had never moved."
   *
   * It hadn't. What had moved was the Mac page's idea of it, in the opposite
   * direction — the unit was on 501 and the page still remembered 7.
   *
   * `preset.number` is React state, filled by read() and by nothing else. The
   * device event stream carries scene, tempo and tuner and has never carried a
   * preset change, so selecting a preset from the phone — or turning the knob
   * on the unit — moves the hardware and leaves the page's number where it was,
   * indefinitely. The guard compared a phone that knew the truth against a Mac
   * that did not, and refused a save that was perfectly good.
   */
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const guard = app.slice(app.indexOf('const req = await takeParkedSave()'))
  const scope = guard.slice(0, guard.indexOf('const timer = setInterval(look'))

  // One live read, and the decision made on its answer.
  assert.match(scope, /const now = await currentPreset\(\)/)
  assert.match(scope, /loaded = now\.number/)
  assert.match(
    scope,
    /const sameBuffer = req\.fromSlot == null \|\| req\.fromSlot === loaded/,
    'the decision is still made against the page state'
  )
  // And the sentence names what is actually loaded, rather than the stale
  // number it used to accuse the Mac of having moved to.
  assert.match(scope, /The computer had moved to slot \$\{loaded \?\? 'another preset'\}/)
  assert.ok(
    !/moved to slot \$\{preset\?\.number/.test(scope),
    'the message still reports the number that was wrong in the first place'
  )

  // The screen was wrong too, so it is corrected rather than left disagreeing
  // with the decision just made from it.
  /* Handed to the store's follow, so the chain is read once for it: moved on
     its own, the number left the chain the last preset's and the screen said
     a read had failed that was never tried. */
  assert.match(scope, /if \(now\.number !== preset\?\.number && !presetHeard\(now\)\) setPreset\(now\)/)
  assert.doesNotMatch(scope, /if \(now\.number !== preset\?\.number\) setPreset\(now\)/, 'the save look moves the number alone, and the chain says it could not be read')
  // A unit that will not answer falls back to what the page has, which is what
  // this used for everything before.
  assert.match(scope, /let loaded = preset\?\.number \?\? null/)
  // Nothing acted on after the component has gone.
  assert.match(scope, /\}\n\s*if \(stop\) return/)
})

test('no event names the preset, so the guard still asks the unit', () => {
  /*
   * The reason the guard has to ask. The store now follows a preset changed
   * elsewhere, but only by asking the unit after a scene or an announcement —
   * no event carries the number, and a front-panel change that opens on the
   * same scene carries nothing at all until the timed check. If an event ever
   * starts naming the preset, this test is the thing to revisit.
   */
  const ds = readSrc(new URL('../src/lib/deviceState.js', import.meta.url), 'utf8')
  const handler = ds.slice(ds.indexOf('export function handleEvent'), ds.indexOf('export function listen'))
  for (const known of ['scene', 'tempo', 'tuner']) {
    assert.ok(handler.includes(`'${known}'`) || handler.includes(known), `${known} stopped being handled`)
  }
  assert.ok(
    !/set\(\{ preset/.test(handler),
    'the event stream sets the preset now — the guard can stop reading it live'
  )
})

console.log('\nscene names surviving the phone')

test('a scene name is written down, not forgotten, by the hand that set it', async () => {
  /*
   * "After writing a scene, saving a scene and the unit confirmed it was saved,
   * when I go back on the phone and then forward again it's not there anymore."
   *
   * Renaming called forgetSceneNames — sound reasoning where a name changed
   * somewhere else, and exactly wrong where we are the one who changed it. On a
   * phone those caches are the ONLY copy: scene names live in a preset dump,
   * dumps are refused over the relay, and the summary does not carry them. So
   * the name reached the hardware and became unreadable from the handset that
   * had just written it.
   */
  const store = {}
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v)
    },
    removeItem: (k) => {
      delete store[k]
    }
  }
  const fx = await import('../src/lib/forgefx.js')
  try {
    // What the panel had on screen, and the one being changed.
    fx.noteSceneName(501, 2, 'Lead', ['Clean', 'Rhythm', '', '', '', '', '', ''])

    const cache = JSON.parse(store['fractal.sceneNames'] || '{}')
    const kept = Object.values(cache)[0]
    assert.ok(Array.isArray(kept), 'nothing was written down at all')
    assert.equal(kept[2], 'Lead', 'the name just set was not kept')
    assert.equal(kept[0], 'Clean', 'the names already known were thrown away')
    assert.equal(kept[1], 'Rhythm')

    // A slot with nothing on screen still keeps what it was told.
    fx.noteSceneName(502, 0, 'Verse', [])
    const second = JSON.parse(store['fractal.sceneNames'] || '{}')
    assert.equal(Object.values(second).find((v) => v[0] === 'Verse')?.[0], 'Verse')

    // Past the end of what was known, rather than dropped.
    fx.noteSceneName(503, 5, 'Solo', ['One'])
    const third = Object.values(JSON.parse(store['fractal.sceneNames'] || '{}')).find((v) => v[5] === 'Solo')
    assert.equal(third[5], 'Solo')
    assert.equal(third[0], 'One')
    assert.equal(third[3], '', 'the gap was filled with something other than a blank')

    // Nothing to say, nothing written: a plan that named no scene must not
    // stamp an empty list over names a previous session managed to read.
    const before = store['fractal.sceneNames']
    fx.noteSceneNames(501, new Map())
    fx.noteSceneNames(null, new Map([[0, 'Nope']]))
    assert.equal(store['fractal.sceneNames'], before, 'an empty rename overwrote what was known')
  } finally {
    delete globalThis.localStorage
  }
})


test('a save writes down what the slot is called, on every route to one', () => {
  /*
   * "The preset screens keep showing the wrong preset. It says TIGHT MODERN on
   * 98 when it's Three Days Grace. Even if I force close the app and reopen
   * it, it shows the wrong preset on the phone, even though the Mac is loaded
   * on the correct preset."
   *
   * Three routes end in a preset landing in a slot — a save at the Mac, the
   * Mac carrying out one the phone asked for, and the phone hearing back that
   * it landed — and every one of them answered it the same way: forget that
   * slot's name, and let somebody read it again. On a phone nobody can. An AM4
   * will not dump a preset over the relay, so the name the phone already had
   * was the name it kept, through a restart and for good.
   */
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const fx = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')

  // The name that just went into the slot is written down rather than dropped.
  assert.match(fx, /export function notePresetName\(number, name\)/)
  const note = fx.slice(fx.indexOf('export function notePresetName('), fx.indexOf('export function forgetPresetName('))
  assert.match(note, /nameCache\.set\(number, kept\)/)
  assert.match(note, /persistNames\(\)/, 'the name is gone again on the next launch')
  assert.match(note, /publishNames\(\)/, 'the computer keeps the new name to itself')

  // All three routes, and each one says which name it is asserting.
  assert.equal(
    (app.match(/keepSavedName\(/g) || []).length,
    4,
    'one of the three saves still forgets the slot instead of naming it — or the helper went'
  )
  for (const route of [
    /await storePreset\(number\)[\s\S]{0,400}?keepSavedName\(number, name \|\| preset\?\.name\)/,
    /await storePreset\(req\.slot\)[\s\S]{0,400}?keepSavedName\(req\.slot, name \|\| preset\?\.name\)/,
    /keepSavedName\(res\.slot, queuedSave\.name\)[\s\S]{0,300}?The computer saved it to slot/
  ]) {
    assert.match(app, route)
  }

  /*
   * A buffer with no name of its own is the one case with nothing to state,
   * and asserting an empty name would be worse than forgetting.
   */
  const helper = app.slice(app.indexOf('function keepSavedName('), app.indexOf('function keepSavedScenes('))
  assert.match(helper, /if \(kept\) notePresetName\(number, kept\)/)
  assert.match(helper, /else forgetPresetName\(number\)/)

  /*
   * And the phone carries the name and the scenes with the request, because
   * when the Mac says it landed, that is the only description of the slot the
   * phone will ever have.
   */
  const park = app.slice(app.indexOf('setQueuedSave({'), app.indexOf('record(\'save\', `Asked the computer to save'))
  /* Capped at the unit's 31 on the way, however the text got into the box. */
  assert.match(park, /name: saveName\.trim\(\)\.slice\(0, 31\) \|\| preset\?\.name \|\| ''/)
  assert.match(park, /scenes: Array\.isArray\(sceneNames\) \? \[\.\.\.sceneNames\] : \[\]/)

  // The list on screen is rebuilt from the cache, so the new name shows now
  // rather than after the next scan.
  assert.ok(
    !/setSlots\(\(prev\) => prev\.filter\(\(s\) => s\.number !== (number|req\.slot)\)\)/.test(app),
    'a saved slot is still dropped from the list instead of renamed in it'
  )
})

test('the list can be read off the unit again from nothing, and the loaded slot is always right', () => {
  /*
   * "Unit is showing the wrong preset name compared to what's actually on
   * the device compared to what it shows in the preset menu. I think we need
   * an option to manually refresh the preset menu from the device as it's
   * stale and stays that way for days sometimes."
   *
   * Two things. The app writes a name down at the moments it can see — a
   * save it made, a slot it read — and nothing else ever touched the copy,
   * so a preset stored from AM4-Edit kept its old name here for good. ⟳ could
   * not help: it reads what has not been read, and a wrong name has been.
   * So there is a way to forget the lot and read it all again. And the one
   * name the app can always be sure of — the slot the unit says it is on,
   * under the name it says it has, in one answer — is written down on every
   * read, so the row for the loaded preset never disagrees with the header.
   */
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const fx = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')
  const con = readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8')

  // Forgetting everything: the cache, its copy on disk, the route flags, and the host's copy.
  assert.match(fx, /export function forgetAllPresetNames\(\)/)
  const all = fx.slice(fx.indexOf('export function forgetAllPresetNames('), fx.indexOf('/** Whether this slot'))
  assert.match(all, /nameCache = new Map\(\)/)
  assert.match(all, /resetNameRoutes\(\)/, 'a re-read still trusts what the last unit taught it about the routes')
  assert.match(all, /persistNames\(\)/, 'the old names would be back on the next launch')
  assert.match(all, /publishNames\(\)/, 'a phone would take the old names straight back off the computer')

  // The app forgets, then reads eagerly — and a scan already running is restarted, not joined.
  const again = app.slice(app.indexOf('const rereadNames = '), app.indexOf('useEffect(() => {', app.indexOf('const rereadNames = ')))
  assert.match(again, /forgetAllPresetNames\(\)/)
  assert.match(again, /namesHeld\.current = false/, '■ would still be holding the scan')
  assert.match(again, /if \(scan\?\.running\) \{[\s\S]*?namesAgain\.current = true[\s\S]*?scan\.stop\(\)/)
  assert.match(again, /readNames\(true\)/)
  const done = app.slice(app.indexOf('onDone: () => {'), app.indexOf('scan.setHold('))
  assert.match(done, /if \(namesAgain\.current\) \{[\s\S]*?readNames\(true\)/, 'a stopped scan never starts over')

  // Both pickers offer it, and the list draws it.
  for (const site of [...app.matchAll(/<PresetList/g)]) {
    const props = app.slice(site.index, app.indexOf('/>', site.index))
    assert.match(props, /onReread=\{rereadNames\}/, 'a picker cannot ask for the names again')
  }
  const list = con.slice(con.indexOf('export function PresetList'), con.indexOf('export function BlockPanel'))
  assert.match(list, /onReread && !scanning \?[\s\S]*?onClick=\{onReread\}[\s\S]*?Read them again/)

  // The loaded slot's name is written down on every read — unless this app edited the buffer.
  assert.match(app, /function noteLoadedName\(p\)/)
  const note = app.slice(app.indexOf('function noteLoadedName('), app.indexOf('function keepSavedScenes('))
  assert.match(note, /if \(kept\) notePresetName\(p\.number, kept\)/)
  assert.doesNotMatch(note, /forgetPresetName/, 'an unnamed buffer must not erase what the slot is called')
  assert.match(app, /setPreset\(p\)\n[\s\S]{0,900}?if \(!dirtyRef\.current\) noteLoadedName\(p\)/)
})

test('the computer wins where the two disagree about a slot', () => {
  /*
   * The other half, and what heals a phone that already has a wrong name in
   * it. The Mac is the end with the cable; the phone only ever knows what the
   * Mac told it. Importing used to skip any slot this browser already had a
   * name for, so a name that went wrong stayed wrong — the phone had TIGHT
   * MODERN for 98, the Mac had the name that overwrote it, and the two never
   * met.
   *
   * Only a slot the host actually names is touched: a partial host copy — the
   * Mac has not scanned that far — must not empty the list on the phone.
   */
  const fx = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')
  const imp = fx.slice(fx.indexOf('export async function importHostNames'), fx.indexOf('/** One slot\'s name'))
  assert.ok(!/nameCache\.has\(number\)/.test(imp), 'a name this browser already has still wins over the computer\'s')
  assert.match(imp, /if \(nameCache\.get\(number\) === name\) continue/, 'every import counts every slot as changed')
  assert.match(imp, /if \(!doc \|\| typeof doc !== 'object'\) return 0/, 'a missing host copy is treated as an answer')
  /* And the host's "empty" never wipes out a name: only a read of the slot says it is empty. */
  assert.match(imp, /if \(!name && nameCache\.get\(number\)\) continue/, 'a stale empty on the computer wipes out a name the unit gave')
})

console.log('\nwriting one amp on three channels')

test('a value checked on the wrong channel is not a value that did not stick', async () => {
  /*
   * "15 values read back different from what was sent" — and the list named
   * Amp 1 Gain 1 three times, wanting 6.5, then 3, then 8.5, and reading 8
   * every time. One readout, held up against three different intentions.
   *
   * A preset that dials a rhythm and a lead out of one amp lists that block
   * once per channel, which is the documented way to do it: values belong to a
   * channel, not to a block. applyChanges honours that. verifyChanges did not —
   * it read whichever channel the write pass finished on and compared it
   * against every change for that block, so every channel but the last was
   * reported wrong, in full, with real-looking numbers. Nothing had failed to
   * stick; the checking was looking in one place for three answers.
   *
   * Run against the demo device rather than asserted about the source, because
   * the demo keeps its values keyed by "effectId:channel" — which is the very
   * thing the bug ignored.
   */
  const store = {}
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v)
    },
    removeItem: (k) => {
      delete store[k]
    }
  }
  const fx = await import('../src/lib/forgefx.js')
  fx.setDemo(true)
  try {
    const blocks = await fx.presetBlocks()
    const amp = blocks.find((b) => b.slug === 'amp')
    assert.ok(amp, 'the demo has no amp to dial')
    const read = async () => (await fx.blockParams(amp.effectId))?.named || []
    const gain = (await read()).find((p) => /gain/i.test(p.name))
    assert.ok(gain, 'the demo amp has no gain control')

    // One block, two channels, deliberately far apart — the shape the report
    // came from.
    const changes = [
      {
        eid: amp.effectId,
        name: amp.name,
        channel: 'A',
        params: [{ id: gain.id, name: gain.name, to: 3, unit: '', range: { min: gain.min, max: gain.max } }]
      },
      {
        eid: amp.effectId,
        name: amp.name,
        channel: 'B',
        params: [{ id: gain.id, name: gain.name, to: 9, unit: '', range: { min: gain.min, max: gain.max } }]
      }
    ]

    const failures = await fx.applyChanges(changes)
    assert.deepEqual(failures, [], 'the write pass could not dial two channels')

    const mismatches = await fx.verifyChanges(changes)
    assert.deepEqual(
      mismatches,
      [],
      `channel A was checked against channel B's readout — ${JSON.stringify(mismatches)}`
    )

    // And checking did not move the rig: the block is left where the write
    // pass left it, which is the last channel the plan named.
    const after = await fx.blockParams(amp.effectId)
    const nowGain = (after?.named || []).find((p) => p.id === gain.id)
    assert.equal(Math.round(nowGain.value), 9, 'verifying left the amp on a different channel than the write did')
  } finally {
    fx.setDemo(false)
    delete globalThis.localStorage
  }
})

test('the demo can be turned off where there is no browser to remember it', async () => {
  /*
   * setDemo wrote the demo flag to localStorage without checking there was
   * one. In a browser there always is; in the tests there is not, except where
   * a test installs a fake — and the tests drive the mock device through this
   * very function to check the write and verify paths without hardware.
   *
   * So turning the demo ON worked (the caller had installed a fake by then)
   * and turning it OFF threw, in a `finally`, after the real assertions had
   * passed. It read as the code under test failing. It surfaced only on Node
   * 20, which is what CI runs and which drains the test queue in a different
   * order from Node 22, so it passed on the machine it was written on and was
   * red on main from the commit that added it.
   *
   * Run with the global genuinely absent, which is the condition that broke
   * it, and put back whatever was there for whoever runs next.
   */
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage')
  const saved = had ? globalThis.localStorage : undefined
  delete globalThis.localStorage
  try {
    const fx = await import('../src/lib/forgefx.js')
    fx.setDemo(true)
    assert.equal(fx.isDemo(), true, 'the demo will not start without somewhere to write it down')
    fx.setDemo(false)
    assert.equal(fx.isDemo(), false, 'the demo cannot be turned off without somewhere to write it down')
  } finally {
    if (had) globalThis.localStorage = saved
  }
})

test('a value written for another scene lands on that scene’s channel and nowhere else', async () => {
  /*
   * The demo, driven the way the chat drives it. Scene 2 (Lead) plays the amp
   * on channel D; scene 1 (Rhythm) on C. "Brighten scene 2" from scene 1 has
   * to move D's Treble, leave C's alone, and put the unit back in scene 1 —
   * which is what the QA saw not happening: "the same values also show on
   * scene 1".
   */
  const fx = await import('../src/lib/forgefx.js')
  fx.setDemo(true)
  try {
    await fx.setScene(0)
    const blocks = await fx.presetBlocks()
    const amp = blocks.find((b) => b.slug === 'amp')
    const read = async () => (await fx.blockParams(amp.effectId))?.named || []
    const treble = (await read()).find((p) => /treble/i.test(p.name))
    assert.ok(treble, 'the demo amp has no treble control')
    const before = treble.value
    const target = before > 5 ? 2.5 : 7.5

    const map = await fx.sceneChannels()
    assert.ok(map && Array.isArray(map[amp.effectId]), 'the demo hands over no channel map')
    /*
     * THE TWO SCENES ARE ON DIFFERENT CHANNELS. Which letters they are is the
     * opening preset's business, not this test's: it read 'D' while the demo
     * opened on the invented slot 500 and its generic chain, and the demo now
     * opens on the first preset the unit really ships with, whose lead scene
     * is somewhere else. What this is about is a write to one scene landing on
     * that scene's channel and nowhere else, which needs the two to differ and
     * does not care how.
     */
    assert.ok(map[amp.effectId][1], 'the lead scene is not on a channel at all')
    assert.notEqual(
      map[amp.effectId][0],
      map[amp.effectId][1],
      'both scenes are on one channel, so this proves nothing about writing to one of them'
    )

    const res = await fx.setSceneParam(1, amp.effectId, treble.id, target, treble)
    assert.equal(res?.ok, true, 'the write into scene 2 did not land')
    assert.equal((await fx.getScene())?.index, 0, 'the unit was left standing in scene 2')

    const still = (await read()).find((p) => p.id === treble.id)
    assert.equal(still.value, before, 'scene 1’s treble moved for a change asked of scene 2')

    await fx.setScene(1)
    const moved = (await read()).find((p) => p.id === treble.id)
    assert.ok(Math.abs(moved.value - target) < 0.05, `scene 2’s treble is ${moved.value}, not ${target}`)
    await fx.setScene(0)
  } finally {
    fx.setDemo(false)
  }
})


console.log('\nthe conversation surviving the phone')

const sessionMod = await import('../src/lib/session.js')

const fakeStore = (seed = {}) => {
  const items = { ...seed }
  return {
    items,
    getItem: (k) => (k in items ? items[k] : null),
    setItem: (k, v) => {
      items[k] = String(v)
    },
    removeItem: (k) => {
      delete items[k]
    }
  }
}

test('the chat and the tone come back after the phone drops the page', () => {
  /*
   * "I was also in the middle of generating a tone and the chat and tone
   * disappeared." iOS evicts a backgrounded web page whenever it wants the
   * memory, and what comes back is a fresh load. Ten seconds in another app
   * was enough to lose a whole conversation.
   */
  const { saveSession, loadSession } = sessionMod
  const store = fakeStore()
  const turns = [
    { role: 'user', text: 'warmer' },
    { role: 'assistant', text: 'Dropped the presence.' }
  ]
  assert.equal(saveSession({ turns, result: { presetName: 'Lead' }, saveName: 'Lead', lastPrompt: 'warmer' }, store), true)

  const back = loadSession(store)
  assert.deepEqual(back.turns, turns, 'the conversation did not survive')
  assert.equal(back.result.presetName, 'Lead', 'the tone on screen did not survive')
  assert.equal(back.saveName, 'Lead')
  assert.equal(back.lastPrompt, 'warmer')
  // renamePreset defaults ON, so absent must not read as off.
  assert.equal(loadSession(fakeStore({ 'fab.session.v1': JSON.stringify({ v: 1, turns: [] }) })).renamePreset, true)
})

test('a reloaded page comes back knowing which conversation it is in', () => {
  /*
   * The chat id was written down and never read back, so every reload restored
   * the transcript, found no id, and made a new one — and the shelf took
   * another row for the same conversation. Ten rows all called "Make me a
   * three days grace full preset", one per time the phone reloaded the page.
   */
  const { saveSession, loadSession } = sessionMod
  const store = fakeStore()
  const turns = [{ role: 'user', text: 'make me a lead tone' }]
  saveSession({ turns, chatId: 'chat-7' }, store)
  assert.equal(loadSession(store).chatId, 'chat-7', 'the reloaded page forgot which chat it was in')

  // A session with no chat yet reads as no chat, not as the string "null".
  saveSession({ turns }, store)
  assert.equal(loadSession(store).chatId, null)
  assert.equal(
    loadSession(fakeStore({ 'fab.session.v1': JSON.stringify({ v: 1, turns: [], chatId: 7 }) })).chatId,
    null,
    'an id that is not an id is not an id'
  )

  /* And when a chat was last put down here, which is what stops New chat
     filling back up from the account. */
  saveSession({ turns: [], chatId: null, clearedAt: 1234 }, store)
  assert.equal(loadSession(store).clearedAt, 1234, 'the page forgot that a chat was put down')
  assert.equal(loadSession(fakeStore({ 'fab.session.v1': JSON.stringify({ v: 1, turns: [] }) })).clearedAt, 0)
})

test('a transcript that cannot be read is no transcript, not a crash', () => {
  const { loadSession, saveSession } = sessionMod
  assert.equal(loadSession(fakeStore()), null, 'nothing saved is not an error')
  assert.equal(loadSession(fakeStore({ 'fab.session.v1': 'not json' })), null)
  // A record from a future shape is ignored rather than half-read.
  assert.equal(loadSession(fakeStore({ 'fab.session.v1': JSON.stringify({ v: 9, turns: [] }) })), null)
  assert.equal(loadSession(fakeStore({ 'fab.session.v1': JSON.stringify({ v: 1, turns: 'nope' }) })), null)
  // A private window throws on the accessor, not on use. Saving must not fail
  // a render over it.
  const hostile = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
    removeItem: () => {}
  }
  assert.equal(saveSession({ turns: [] }, hostile), false)
  assert.equal(loadSession(hostile), null)
  assert.doesNotThrow(() => sessionMod.clearSession(hostile))
})

test('a long conversation is trimmed from the old end, not the new', () => {
  const { saveSession, loadSession, MAX_TURNS } = sessionMod
  const store = fakeStore()
  const many = Array.from({ length: MAX_TURNS + 20 }, (_, i) => ({ role: 'user', text: `turn ${i}` }))
  saveSession({ turns: many }, store)
  const back = loadSession(store)
  assert.equal(back.turns.length, MAX_TURNS)
  // The newest survive: an old turn has already been acted on.
  assert.equal(back.turns.at(-1).text, `turn ${MAX_TURNS + 19}`)
  assert.equal(back.turns[0].text, 'turn 20')
})

test('a generation cut off by the phone says so instead of waiting for ever', () => {
  /*
   * The request died with the page and cannot be resumed — it was an HTTP
   * request held open by a page that no longer exists. What can be saved is
   * the knowledge that an answer was owed, so the app does not come back
   * looking as though nothing had been happening.
   */
  const { interrupted } = sessionMod
  assert.equal(interrupted(null), null, 'a session that ended between thoughts apologises for nothing')
  assert.equal(interrupted({}), null)
  assert.equal(interrupted({ description: '   ' }), null)
  const turn = interrupted({ description: 'a doom tone' })
  assert.equal(turn.role, 'system')
  assert.match(turn.text, /background/)
  assert.match(turn.text, /Nothing reached the unit/, 'somebody has to be told their unit was not half-written')
})








test('the account chat is readable only by the account that wrote it', () => {
  const sql = readSrc(new URL('../supabase/migrations/20260906_chats.sql', import.meta.url), 'utf8')
  assert.match(sql, /alter table public\.chats enable row level security/)
  // Every policy keyed to auth.uid(), matching presets and scene_names.
  assert.match(sql, /for select using \(user_id = auth\.uid\(\)\)/, 'reads are not keyed to the signed-in user')
  assert.match(sql, /for insert with check \(user_id = auth\.uid\(\)\)/, 'writes are not keyed to the signed-in user')
  assert.match(sql, /for update using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\)/, 'updates are not keyed to the signed-in user')
  // One row per person: the app has one running conversation, and a table
  // shaped that way cannot drift into meaning a filing system.
  assert.match(sql, /user_id uuid primary key/)
})

test('a shelved conversation is readable only by the account that wrote it', () => {
  const sql = readSrc(new URL('../supabase/migrations/20260911_chat_logs.sql', import.meta.url), 'utf8')
  assert.match(sql, /alter table public\.chat_logs enable row level security/)
  assert.match(sql, /for select using \(user_id = auth\.uid\(\)\)/, 'reads are not keyed to the signed-in user')
  assert.match(sql, /for insert with check \(user_id = auth\.uid\(\)\)/, 'writes are not keyed to the signed-in user')
  assert.match(sql, /for update using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\)/)
  /* Unlike `chats`, this one deletes: it is a list somebody browses, and a
     list you cannot throw anything out of fills up. */
  assert.match(sql, /for delete using \(user_id = auth\.uid\(\)\)/, 'a past chat cannot be thrown away')
  /* One row per conversation, not one per person — the opposite of `chats`,
     deliberately, and the id comes from the client so a chat keeps its
     identity when it moves from this browser to the account. */
  assert.match(sql, /id text primary key/)
})

/*
 * The band-lookup cache went with the AI that used it.
 *
 * src/lib/rigCache.js kept what a band was found to play, so a second request
 * about the same band cost no tokens. Nothing has imported it since the tone
 * builder came out in 7.336.0 — it was left behind rather than removed, and
 * its test kept passing, which is how dead code survives a deletion.
 *
 * Found while writing the privacy policy, by asking what the app actually
 * writes to the database rather than what it used to. The `rig_lookups` table
 * it wrote to still holds rows; whether to drop it is Justin's call, because
 * dropping a table is not something to do on a hunch.
 */



console.log('\nwhat made this sound')





console.log('\nhow many scenes')











console.log('\nparameter matching')

const ampSchema = [
  {
    eid: 58,
    name: 'Amp 1',
    slug: 'amp',
    params: [
      { id: 3, name: 'Bass', value: 5, min: 0, max: 10 },
      { id: 12, name: 'Low Cut Frequency', value: 20, min: 10, max: 1000, log: true },
      { id: 4, name: 'Amp 1 Level', value: 0, min: -80, max: 20 }
    ],
    models: []
  }
]

test('a control named right and addressed wrong is still written', () => {
  // The FM3 run that prompted this: "Amp 1 / Low Cut Frequency: 5.5 is outside
  // 10-1000" was a Bass of 5.5 sent to the id the model believed Bass was.
  const res = validateSpec(
    { blocks: [{ eid: 58, params: [{ id: 12, name: 'Bass', value: 5.5 }] }] },
    ampSchema
  )
  assert.equal(res.changes[0].params[0].id, 3)
  assert.equal(res.changes[0].params[0].to, 5.5)
  assert.equal(res.problems.length, 0)
  assert.match(res.repairs[0], /Low Cut Frequency/)
})

test('a name that matches nothing is still a rejection', () => {
  const res = validateSpec(
    { blocks: [{ eid: 58, params: [{ id: 99, name: 'Sparkle', value: 4 }] }] },
    ampSchema
  )
  assert.equal(res.changes.length, 0)
  assert.match(res.problems[0], /no parameter 99/)
})

test('an output level can be nudged but never reset to silence', () => {
  /*
   * Levels used to be withheld from the model entirely, and the reason was
   * sound: a Level sits in the same list as Bass and Treble, so a generation
   * that is otherwise musically right will set it to -60 dB and hand back a
   * preset that looks perfect and makes no sound.
   *
   * What that cost was worse. "I told the AI that the amp should be louder
   * when it's on compared to when it's off and it told me I was wrong." The
   * one control that does that was invisible, so the model argued rather than
   * refused. It is reachable now, within a window: a nudge, not a reset.
   */
  const silence = validateSpec(
    { blocks: [{ eid: 58, params: [{ id: 3, name: 'Amp 1 Level', value: -60 }] }] },
    ampSchema
  )
  assert.equal(silence.changes.length, 0, 'a level was walked to silence in one write')
  assert.match(silence.problems[0], /nudged, not reset/)

  /*
   * And the thing the player actually asked for goes through. Addressed by the
   * Level's own id here, where the case above deliberately arrives with the
   * wrong one so the name-matching path is covered too — both routes reach the
   * same control, and the window has to hold on either.
   */
  const louder = validateSpec(
    { blocks: [{ eid: 58, params: [{ id: 4, name: 'Amp 1 Level', value: 3 }] }] },
    ampSchema
  )
  assert.equal(louder.changes.length, 1, 'a few dB of make-up gain is still refused')
  assert.equal(louder.changes[0].params[0].to, 3)
})

test('a name matched to the right id is not reported as a correction', () => {
  const res = validateSpec(
    { blocks: [{ eid: 58, params: [{ id: 3, name: 'Bass', value: 7 }] }] },
    ampSchema
  )
  assert.equal(res.repairs.length, 0)
  assert.equal(res.changes[0].params[0].id, 3)
})

test('a matched name is still checked against that control own range', () => {
  const res = validateSpec(
    { blocks: [{ eid: 58, params: [{ id: 12, name: 'Bass', value: 50 }] }] },
    ampSchema
  )
  assert.equal(res.changes.length, 0)
  assert.match(res.problems[0], /Bass: 50 is outside 0–10/)
})

console.log('\nslot addressing')

test('a gen-3 slot is a number, not a bank letter', async () => {
  const { slotLabel } = await import('../src/lib/slots.js')
  assert.equal(slotLabel(0, 'numeric'), '000')
  assert.equal(slotLabel(2, 'numeric'), '002')
  assert.equal(slotLabel(511, 'numeric'), '511')
})

test('the AM4 keeps its lettered banks of four', async () => {
  /*
   * Both, and the number first.
   *
   * "Can we also add the slot number in front of the A to Z bank numbers."
   * Everything else in this app talks in numbers — save to slot 5, the bar
   * says SLOT 99 — while the unit's front panel and this list talked in
   * letters. Reading one and typing the other meant doing the arithmetic, and
   * the arithmetic is only obvious once you know a bank holds four.
   */
  const { slotLabel } = await import('../src/lib/slots.js')
  assert.equal(slotLabel(0, 'bankLetter'), '000 A01')
  assert.equal(slotLabel(7, 'bankLetter'), '007 B04')
  assert.equal(slotLabel(103, 'bankLetter'), '103 Z04')
  // The number is the one you type, so it leads.
  assert.match(slotLabel(4, 'bankLetter'), /^004 /)
})

test('past Z there is no letter, so it falls back to the number', async () => {
  // 512 slots lettered in fours ran off the end of the alphabet: slot 200 was
  // labelled "s1" and slot 460 "À1", addresses that name nothing.
  const { slotLabel } = await import('../src/lib/slots.js')
  assert.equal(slotLabel(200, 'bankLetter'), '200')
  assert.equal(slotLabel(460, 'bankLetter'), '460')
})

test('bank rules are drawn only where there are banks', async () => {
  const { startsBank } = await import('../src/lib/slots.js')
  assert.equal(startsBank(4, 3, 'bankLetter'), true)
  assert.equal(startsBank(5, 4, 'bankLetter'), false)
  assert.equal(startsBank(0, null, 'bankLetter'), true)
  assert.equal(startsBank(4, 3, 'numeric'), false)
})

test('a scan says how long it has left, in words', async () => {
  const { timeLeft } = await import('../src/lib/slots.js')
  assert.equal(timeLeft(400, 300), 'about 2 minutes left')
  assert.equal(timeLeft(100, 600), 'about 1 minute left')
  assert.equal(timeLeft(10, 300), 'under a minute left')
  // Nothing to say before anything has been timed.
  assert.equal(timeLeft(400, null), null)
  assert.equal(timeLeft(0, 300), null)
})


/* ------------------------------------------------------------------
   The first frame on a phone
   ------------------------------------------------------------------ */

const remoteMod = await import('../src/lib/remote.js')

test('a saved sign-in is known before the client is loaded', () => {
  const store = (items) => ({ getItem: (k) => (k in items ? items[k] : null) })
  const key = 'sb-biznwrqeckviawjuhvyg-auth-token'
  assert.equal(remoteMod.hasSavedSession({ storage: store({}) }), false)
  assert.equal(remoteMod.hasSavedSession({ storage: store({ [key]: JSON.stringify({ access_token: 'a.b.c' }) }) }), true)
  assert.equal(remoteMod.hasSavedSession({ storage: store({ [key]: 'not json' }) }), false, 'a corrupt token is not a session')
  assert.equal(
    remoteMod.hasSavedSession({ url: 'https://other.supabase.co', storage: store({ [key]: JSON.stringify({ access_token: 'x' }) }) }),
    false,
    'the key follows the project'
  )
  assert.equal(
    remoteMod.hasSavedSession({ storage: { getItem: () => { throw new Error('blocked') } } }),
    false,
    'blocked storage is no session, not a crash'
  )
})

test('the fault notice speaks to the end it is on', () => {
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like computer OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  const crios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like computer OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1'
  const macSafari = 'Mozilla/5.0 (Macintosh; Intel computer OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
  const chrome = 'Mozilla/5.0 (Macintosh; Intel computer OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

  assert.equal(link.faultCopy({ role: 'unknown' }), null, 'a notice was written before anyone knew which end this is')

  const mac = link.faultCopy({ role: 'mac', secure: true, userAgent: macSafari })
  assert.match(mac.body, /this computer/)
  assert.match(mac.body, /Safari/, 'Safari on an https page at the computer is the one case the advice is for')
  assert.ok(!/Safari/.test(link.faultCopy({ role: 'mac', secure: true, userAgent: chrome }).body), 'Chrome was told to try Chrome')
  assert.ok(!/Safari/.test(link.faultCopy({ role: 'mac', secure: false, userAgent: macSafari }).body), 'Safari over plain http can talk to the computer fine')
  assert.equal(link.whySafari({ secure: true, userAgent: ios }), '', 'an iPhone was told to try Chrome, which is Safari underneath')
  assert.equal(link.whySafari({ secure: true, userAgent: crios }), '')

  const phone = link.faultCopy({ role: 'remote', secure: true, userAgent: ios })
  assert.ok(phone && !/this computer|Safari/.test(phone.body), 'a phone was told to open an app on "this computer"')
  assert.match(link.faultCopy({ role: 'wifi' }).title, /Lost the computer/)
  /*
   * A unit that answered "not connected" wins over the role copy — but not
   * with the same words at every end. At the Mac the cable is an arm's length
   * away and worth checking. On a phone it is in another room, and by the time
   * this shows the unit has already been asked five times: "says it's
   * connected but says no unit... if I hit Try again like five or six times it
   * will actually connect."
   */
  for (const role of ['mac', 'wifi']) {
    assert.equal(link.faultCopy({ role, device: { connected: false } }).title, 'No unit found')
  }
  const noUnit = link.faultCopy({ role: 'remote', device: { connected: false }, asks: 5 })
  assert.match(noUnit.title, /can’t see your unit/, 'a phone is still told to check a cable it cannot reach')
  assert.match(noUnit.body, /asked five times/, 'a phone is not told the asking already happened')
  /*
   * And the number is the number it actually asked. Five is what a phone that
   * was not already live does; a unit that WAS answering a moment ago gets
   * three, and a screen at the Mac gets one — so the same "five times" was
   * being shown over two asks that never happened.
   */
  assert.match(
    link.faultCopy({ role: 'remote', device: { connected: false }, asks: 3 }).body,
    /asked three times/
  )
  assert.match(link.faultCopy({ role: 'remote', device: { connected: false }, asks: 1 }).body, /asked once/)
  assert.ok(
    !/times/.test(link.faultCopy({ role: 'remote', device: { connected: false } }).body),
    'a count nobody counted is still stated as fact'
  )
  assert.ok(
    !/tap Try again/.test(noUnit.body),
    'Try again is offered as the fix for the thing that just failed five times'
  )
})

test('a computer that answered and has no port to the unit says exactly that', () => {
  /*
   * "When I tap one of the buttons it will turn it off on the unit, but
   * there's no way to turn it back on, and the buttons always say on." The
   * Mac was answering fine — every call came back, and what came back was
   * `port not open`. So it is neither a Mac that went quiet nor a read that
   * lost a race: there is nothing at the end of the cable to read, and it is
   * the one fault that means what is on screen can no longer be trusted.
   */
  const phone = link.faultCopy({ role: 'remote', reason: 'unit-gone' })
  assert.match(phone.title, /lost the unit/i)
  assert.match(phone.body, /At the computer/, 'the phone was not told which end to go to')
  assert.ok(
    !/stopped answering|hasn’t gone to sleep/i.test(phone.body),
    'the computer answering is what raised this — it cannot also be the thing to fix'
  )

  const here = link.faultCopy({ role: 'mac', reason: 'unit-gone' })
  assert.match(here.title, /Lost the unit/)
  assert.ok(!/At the computer/.test(here.body), 'the computer was told to go to the computer it is already at')

  // It wins over a stale device, the same way every other reason does.
  assert.match(
    link.faultCopy({ role: 'remote', reason: 'unit-gone', device: { connected: true, short: 'AM4' } }).title,
    /lost the unit/i
  )
})

/*
 * "This keeps saying I'm not connected, but yet the Mac app says I am
 * connected to the remote." Both screens were drawn from one fault with three
 * quite different things behind it, and only one of them is about the rig.
 */
test('a question that never came back is not blamed on the unit', () => {
  const gone = link.faultCopy({ role: 'remote', reason: 'no-answer' })
  assert.match(gone.title, /stopped answering/, 'a silent computer is still described as a computer that answered')
  assert.ok(
    !/plugged in|cable|unit is on/i.test(gone.body),
    'a phone is sent to check a cable when it was the computer that went quiet'
  )

  const unread = link.faultCopy({ role: 'remote', reason: 'unreadable' })
  assert.match(unread.title, /wouldn’t read/)
  assert.match(unread.body, /holding the port|another editor/, 'the likely cause is not named')

  /*
   * The reason wins over a stale `device`, which is the whole bug: the object
   * left over from the last good answer said "connected", and the notice read
   * it as proof this answer had happened too.
   */
  const stale = link.faultCopy({ role: 'remote', reason: 'no-answer', device: { connected: true, short: 'AM4' } })
  assert.match(stale.title, /stopped answering/)

  // And a Mac that really did answer "nothing here" still says so.
  assert.match(
    link.faultCopy({ role: 'remote', reason: 'no-unit', device: { connected: false } }).title,
    /can’t see your unit/
  )
})

test('the bar names what is missing, not always the unit', () => {
  const bar = (reason) =>
    link.describeUnit({ role: 'remote', link: 'connected', status: 'fault', reason }).unit
  assert.equal(bar('no-answer'), 'No answer', 'a silent computer reads as an empty rig')
  assert.equal(bar('unreadable'), 'Can’t read')
  assert.equal(bar('no-unit'), 'No unit')
  assert.equal(bar(null), 'No unit', 'the old reading stands where no reason was given')
})

test('a phone restoring its sign-in reads as connecting, never as signed out', () => {
  const linkSrc = readSrc(new URL('../src/lib/link.js', import.meta.url), 'utf8')
  const boot = linkSrc.slice(linkSrc.indexOf('export async function bootLink'))
  const published = boot.indexOf('refresh({ role })')
  const restored = boot.indexOf('await restoreSession(')
  assert.ok(
    published !== -1 && restored !== -1 && published < restored,
    'bootLink withholds the role until the session round-trip is done — a phone gets the computer’s error in the meantime'
  )
  assert.match(linkSrc, /restoring = role === 'remote' && hasSavedSession\(/, 'a phone that signed in last time is asked to Connect while its session is picked up')
  assert.match(linkSrc, /hasSession: !!merged\.account \|\| restoring/)
  assert.match(linkSrc, /joining: joining \|\| restoring/)
})

/* ------------------------------------------------------------------
   Scenes in the simulated unit
   ------------------------------------------------------------------ */

const { createSceneState } = await import('../src/lib/sceneState.js')

test('a scene is its own pattern of what is off', () => {
  const scenes = createSceneState({ count: 8, seeds: { default: [46, 70], 1: [94], 2: [94, 118] } })
  assert.deepEqual(scenes.snapshot(0), [46, 70])
  assert.deepEqual(scenes.snapshot(1), [94], 'a seeded scene took the default')
  assert.deepEqual(scenes.snapshot(5), [46, 70], 'an unseeded scene starts as the default')
  assert.ok(scenes.isOff(0, 46) && !scenes.isOff(1, 46), 'the same block reads the same in every scene — that is the bug')

  // A bypass written in one scene is that scene's.
  scenes.set(1, 118, true)
  assert.ok(scenes.isOff(1, 118))
  assert.ok(!scenes.isOff(0, 118), 'switching a block off in scene 2 switched it off in scene 1')
  scenes.set(1, 118, false)
  assert.ok(!scenes.isOff(1, 118))

  // A block just placed is on everywhere; out-of-range scenes clamp rather than throw.
  scenes.set(3, 46, true)
  scenes.forget(46)
  for (let i = 0; i < 8; i++) assert.ok(!scenes.isOff(i, 46))
  assert.equal(scenes.isOff(99, 70), scenes.isOff(7, 70))
})

/*
 * The half that was missing. A scene remembers which channel each block plays,
 * and a channel holds its own model and its own values — which is why a lead
 * scene can have a genuinely hotter amp rather than the rhythm amp with a
 * boost in front of it. Everything above this line was true of the old file;
 * none of this was possible in it.
 */
test('a scene remembers which channel each block plays', () => {
  const scenes = createSceneState({ count: 8, seeds: {}, channels: { 1: { 58: 'D' } } })
  assert.equal(scenes.channelOf(1, 58), 'D', 'a seeded scene channel was lost')
  assert.equal(scenes.channelOf(0, 58), null, 'a scene that never chose a channel claims one anyway')

  scenes.setChannel(2, 58, 'B')
  assert.equal(scenes.channelOf(2, 58), 'B')
  assert.equal(scenes.channelOf(1, 58), 'D', 'a channel written in scene 3 followed the block into scene 2')
  assert.equal(scenes.channelOf(0, 58), null, 'a channel written in scene 3 leaked into scene 1')

  // A block just placed plays whatever channel it was placed on, everywhere.
  scenes.forget(58)
  for (let i = 0; i < 8; i++) assert.equal(scenes.channelOf(i, 58), null)
})

test('the simulated unit answers for the chain from the scene it is in', () => {
  const mock = readSrc(new URL('../src/lib/mockDevice.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
  assert.match(mock, /createSceneState\(/, 'the mock keeps one bypass flag per block again')
  const map = mock.slice(mock.indexOf('sceneStateNow:'), mock.indexOf('sceneStateNow:') + 700)
  assert.ok(!/% 3|state\.scene === 0 \?/.test(map), 'the scene map is a made-up pattern again, disagreeing with Play')
  assert.ok(!/b\.bypassed/.test(mock), 'something in the mock reads a per-block bypass flag, which no longer follows the scene')
  /* Not the summary: a stored preset's summary lists every block placed in
     it, whatever the scene, as the hardware's does — Play's read-ahead draws
     the next preset's pedals from it (shared/chain-outline.mjs). */
  for (const answer of ['presetBlocks', 'meters', 'sceneStateNow']) {
    const body = mock.slice(mock.indexOf(`${answer}:`), mock.indexOf(`${answer}:`) + 700)
    assert.match(body, /off\(b\.effectId\)/, `${answer} does not ask the scene which blocks are off`)
  }
  const setBypass = mock.slice(mock.indexOf('setBypass:'), mock.indexOf('setBypass:') + 300)
  assert.match(setBypass, /state\.scenes\.set\(state\.scene/, 'a bypass write no longer lands in the scene the unit is in')
})

test('the simulated unit gives each scene its own channel, and each channel its own values', () => {
  /*
   * The demo used to keep one channel per block and one set of values per
   * block, so the tour's own claim — a scene can carry a different amp — was
   * untestable in the only unit most people will ever run this against.
   */
  const mock = readSrc(new URL('../src/lib/mockDevice.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
  const setChannel = mock.slice(mock.indexOf('setChannel:'), mock.indexOf('setChannel:') + 300)
  assert.match(
    setChannel,
    /state\.scenes\.setChannel\(state\.scene/,
    'a channel write still lands on the block, so every scene shares it'
  )
  for (const answer of ['presetBlocks', 'sceneStateNow']) {
    const body = mock.slice(mock.indexOf(`${answer}:`), mock.indexOf(`${answer}:`) + 700)
    assert.match(body, /chan\(b\.effectId\)/, `${answer} reports a channel that does not follow the scene`)
  }
  assert.match(mock, /params\.set\(`\$\{eid\}:\$\{chan\(eid\)\}`/, 'a model swap writes over every channel of the block')
  assert.ok(
    !/state\.params\.get\(eid\)/.test(mock),
    'something reads a block\u2019s values without asking which channel it is playing'
  )
})

/* ------------------------------------------------------------------
   One history ledger for sheets and screens
   ------------------------------------------------------------------ */

const nav = await import('../src/lib/nav.js')

test('a closing sheet takes its own entry and owes a pop only to a sheet that is listening', () => {
  // A fake window: history entries, and popstate delivered to listeners.
  const entries = [{}]
  const handlers = new Set()
  const w = {
    history: {
      get state() { return entries[entries.length - 1] },
      pushState: (st) => entries.push(st),
      replaceState: (st) => { entries[entries.length - 1] = st },
      back: () => { entries.pop(); for (const h of [...handlers]) h({ state: w.history.state }) }
    },
    addEventListener: (_, h) => handlers.add(h),
    removeEventListener: (_, h) => handlers.delete(h)
  }
  globalThis.window = w
  nav._resetNav()
  const now = (fn) => fn()

  // The app's own screen entries.
  nav.replaceEntry({ view: 'play' })
  nav.pushEntry({ view: 'shape' })
  assert.deepEqual(entries, [{ view: 'play' }, { view: 'shape' }])

  // One sheet, closed by its button: the entry goes, nobody is owed a pop.
  let closedA = 0
  const backA = () => { if (nav.swallowedPop()) return; closedA++ }
  const stopA = nav.listen(backA)
  nav.pushEntry({ sheet: true })
  stopA()
  nav.popSelf(now)
  assert.deepEqual(entries, [{ view: 'play' }, { view: 'shape' }], 'the sheet did not take its entry with it')
  assert.equal(nav._ledger().selfPops, 0, 'a pop is owed with no sheet there to be owed it — the next real Back would be swallowed')
  assert.equal(closedA, 0)

  // A handoff: sheet A closes as sheet B opens. A's teardown pops B's entry; B must not take that for a Back gesture.
  let closedB = 0
  let remarked = 0
  const stopA2 = nav.listen(() => {})
  nav.pushEntry({ sheet: true })
  const backB = () => { if (nav.swallowedPop()) { remarked++; nav.pushEntry({ sheet: true }); return } closedB++ }
  const stopB = nav.listen(backB)
  nav.pushEntry({ sheet: true })
  stopA2()
  nav.popSelf(now)
  assert.equal(closedB, 0, 'the sheet that had just opened closed itself — the introduction bug')
  assert.equal(remarked, 1, 'the incoming sheet did not put its entry back')
  assert.equal(nav._ledger().selfPops, 0)
  // Now a real Back closes B, and the screen entry is what is left.
  w.history.back()
  assert.equal(closedB, 1)
  stopB()
  assert.equal(nav._ledger().listening, 0)
  delete globalThis.window
})


/**
 * A fetch whose body arrives on a schedule: [{ at, chunk }] then done, or
 * silence forever (`end: false`). Reads reject when the caller aborts, as a
 * real body does.
 */
function scheduledFetch(scripts) {
  let calls = 0
  const fetch = (_url, init) => {
    const script = scripts[Math.min(calls, scripts.length - 1)]
    calls++
    const signal = init.signal
    let i = 0
    const t0 = Date.now()
    const reader = {
      read: () =>
        new Promise((resolve, reject) => {
          if (signal.aborted) return reject(new Error('aborted'))
          const onAbort = () => reject(new Error('aborted'))
          signal.addEventListener('abort', onAbort, { once: true })
          if (i < script.steps.length) {
            const step = script.steps[i++]
            setTimeout(() => {
              signal.removeEventListener('abort', onAbort)
              // A dropped line: the browser's own words for it.
              if (step.drop) return reject(new Error('Load failed'))
              resolve({ value: new TextEncoder().encode(step.chunk), done: false })
            }, Math.max(0, step.at - (Date.now() - t0)))
          } else if (script.end !== false) {
            setTimeout(() => {
              signal.removeEventListener('abort', onAbort)
              resolve({ value: undefined, done: true })
            }, 0)
          }
          // else: silence forever — only an abort ends this read
        })
    }
    return Promise.resolve({ ok: true, status: 200, body: { getReader: () => reader } })
  }
  return { fetch, calls: () => calls }
}
const DONE = JSON.stringify({ type: 'done', object: { blocks: [] } }) + '\n'
const PARTIAL = JSON.stringify({ type: 'partial', object: { blocks: [{ slug: 'amp' }] } }) + '\n'
/** The server's hello, written before the model is asked anything. */
const OPEN = JSON.stringify({ type: 'open' }) + '\n'
const timing = { stallMs: 60, firstMs: 60, capMs: 400 }

const WAITING = (ms) => JSON.stringify({ type: 'waiting', ms }) + '\n'



















/* ------------------------------------------------------------------
   Names that read themselves
   ------------------------------------------------------------------ */

const { createNameScan } = await import('../src/lib/nameScan.js')

/** A scan over a fake unit: what was read, how it slept, and a hold you can set. */
function scanRig({ total = 8, known = [], failAt = [], onRead, sleep } = {}) {
  const cache = new Set(known)
  const reads = []
  const sleeps = []
  let held = false
  const scan = createNameScan({
    total,
    isKnown: (n) => cache.has(n),
    read: async (n) => {
      reads.push(n)
      onRead?.(n)
      if (failAt.includes(n)) throw new Error('no answer')
      cache.add(n)
    },
    sleep: async (ms) => {
      sleeps.push(ms)
      await sleep?.(ms)
    },
    quietGap: 600,
    holdPoll: 250,
    giveUpAfter: 3
  })
  scan.setHold(() => held)
  return { scan, reads, sleeps, cache, hold: (v) => (held = v) }
}

test('the quiet scan reads only what is unknown and leaves the port alone between slots', async () => {
  const r = scanRig({ known: [0, 2, 4] })
  assert.equal(await r.scan.run(), 'done')
  assert.deepEqual(r.reads, [1, 3, 5, 6, 7])
  assert.deepEqual(r.sleeps, [600, 600, 600, 600], 'a quiet scan slept somewhere other than between reads')
})

test('the quiet scan waits while the unit is in use; the eager one reads back to back', async () => {
  let polls = 0
  const r = scanRig({ total: 3, sleep: async (ms) => { if (ms === 250 && ++polls === 3) r.hold(false) } })
  r.hold(true)
  assert.equal(await r.scan.run(), 'done')
  assert.equal(polls, 3, 'the hold was not polled')
  assert.deepEqual(r.reads, [0, 1, 2])

  const e = scanRig({ total: 3 })
  e.hold(true)
  e.scan.setEager(true)
  assert.equal(await e.scan.run(), 'done')
  assert.deepEqual(e.reads, [0, 1, 2])
  assert.deepEqual(e.sleeps, [], 'an eager scan waited on the hold or slept between slots')
})

test('one slot failing is one slot; a run of them is a unit that has gone', async () => {
  const one = scanRig({ total: 6, failAt: [2] })
  assert.equal(await one.scan.run(), 'done')
  assert.deepEqual(one.reads, [0, 1, 2, 3, 4, 5])
  const gone = scanRig({ total: 10, failAt: [3, 4, 5, 6, 7] })
  assert.equal(await gone.scan.run(), 'failed')
  assert.deepEqual(gone.reads, [0, 1, 2, 3, 4, 5], 'three failures in a row and it kept asking')
})

test('stop ends the run after the read in flight, and the next run resumes from what is known', async () => {
  const r = scanRig({ total: 6, onRead: (n) => n === 2 && r.scan.stop() })
  assert.equal(await r.scan.run(), 'stopped')
  assert.deepEqual(r.reads, [0, 1, 2])
  assert.equal(r.scan.running, false)
  assert.equal(await r.scan.run(), 'done')
  assert.deepEqual(r.reads, [0, 1, 2, 3, 4, 5], 'the second run re-read what the first had learned')
})

test('a scan already running is not started twice', async () => {
  let release
  const r = scanRig({ total: 2, sleep: () => new Promise((res) => (release = res)) })
  const first = r.scan.run()
  await new Promise((res) => setTimeout(res, 0))
  assert.equal(r.scan.running, true)
  assert.equal(await r.scan.run(), 'running')
  release()
  assert.equal(await first, 'done')
})

/* ------------------------------------------------------------------
   The demo remembers its scene names, and its tuner holds a note
   ------------------------------------------------------------------ */

{
  const { storedSceneNames, keepSceneNames, DEFAULT_SCENE_NAMES, DEMO_SCENE_NAMES } = await import('../src/lib/demoMemory.js')
  const { createTunerStream } = await import('../src/lib/tunerStream.js')

  test('a demo scene name survives the mock being rebuilt', () => {
    /*
     * The localStorage stub lives inside the test, installed and removed in
     * one tick. It used to sit at block scope: installed, then the block
     * awaited two imports — and every async test already queued ran in that
     * gap with a localStorage that vanished from under it when the block
     * finished. Which test that happened to be depended on how many ticks
     * the imports above took, so it passed on one Node and failed on
     * another ("localStorage is not defined", from a test 3000 lines away).
     */
    const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage')
    const saved = globalThis.localStorage
    const store = new Map()
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    }
    try {
    // "Solo" was "4" again after a reload: the array came from a literal every time.
    assert.equal(storedSceneNames(500), null, 'a fresh demo has kept names from nowhere')
    const names = DEFAULT_SCENE_NAMES.slice()
    names[3] = 'Solo'
    keepSceneNames(500, names)
    assert.deepEqual(storedSceneNames(500), names)
    assert.ok(store.has(DEMO_SCENE_NAMES), 'the demo did not keep its own key')
    assert.ok(!store.has('fractal.sceneNames'), 'the demo wrote into the real-device cache')

    /*
     * PER PRESET, because the demo holds twelve of them and each carries its
     * own four names. One global list meant renaming a scene on one preset
     * renamed it on all of them, and the seeded names — Verse, Chorus, Bridge,
     * Lead on one, Jangle, Room, Bite, Hall on another — would have been
     * flattened into whichever was saved last.
     */
    assert.equal(storedSceneNames(0), null, 'a rename on one preset reached another')
    const other = DEFAULT_SCENE_NAMES.slice()
    other[0] = 'Verse'
    keepSceneNames(0, other)
    assert.deepEqual(storedSceneNames(0), other)
    assert.deepEqual(storedSceneNames(500), names, 'keeping one preset\u2019s names lost another\u2019s')

    store.set(DEMO_SCENE_NAMES, '"not an object"')
    assert.equal(storedSceneNames(500), null, 'a bad key is survived')
    store.set(DEMO_SCENE_NAMES, JSON.stringify({ 500: ['a', 'b'] }))
    assert.equal(storedSceneNames(500), null, 'the wrong number of names is survived')
    /* The shape this key held before it was keyed by preset. Not recognised,
       so the seeded names stand — which costs a rename made before the change
       and nothing else. */
    store.set(DEMO_SCENE_NAMES, JSON.stringify(DEFAULT_SCENE_NAMES))
    assert.equal(storedSceneNames(500), null, 'the old single-list shape is read as one preset\u2019s')
    store.clear()
    // And the mock reads them: pinned by the structure guard on mockDevice.js.
    } finally {
      if (had) globalThis.localStorage = saved
      else delete globalThis.localStorage
    }
  })

  test('the demo tuner never changes note while a string is still ringing', () => {
    /*
     * "The note hops randomly, E2 → D3 → E4; looks broken."
     *
     * The stream held a string and drifted toward pitch, which was most of the
     * way there — but it could also swap strings at any poll, on a 4% roll,
     * mid-note. Rare enough to look like a glitch rather than a design, which
     * is worse than doing it constantly.
     *
     * A real tuner cannot do that: while a string is ringing there is one pitch
     * to detect and the detector holds it. The note changes after the note
     * STOPS. So between any two consecutive readings that both have a note, the
     * note is the same one — not usually, always.
     */
    let seed = 11
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const tuner = createTunerStream(random)
    const readings = Array.from({ length: 600 }, () => tuner.next())
    let midNote = 0
    for (let i = 1; i < readings.length; i++) {
      const [a, b] = [readings[i - 1], readings[i]]
      if (!a.note || !b.note) continue
      if (a.note !== b.note || a.octave !== b.octave) midNote++
    }
    assert.equal(midNote, 0, `the note changed ${midNote} times with the string still sounding`)

    // And it is not simply frozen on one string for ever: a new one is picked
    // coming out of a quiet gap, which is what re-detection looks like.
    const played = new Set(readings.filter((r) => r.note).map((r) => `${r.note}${r.octave}`))
    assert.ok(played.size > 1, `only ${[...played]} was ever shown — the demo never re-detects`)
  })

  test('the demo tuner holds a string, drifts a little and sometimes goes quiet', () => {
    // A seeded generator so the run is the same every time.
    let seed = 7
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const tuner = createTunerStream(random)
    const readings = Array.from({ length: 300 }, () => tuner.next())
    const sounding = readings.filter((r) => r.note)
    assert.ok(sounding.length >= 200, `the tuner was quiet ${300 - sounding.length} of 300 ticks`)
    assert.ok(readings.some((r) => r.note === '' && r.cents === null), 'the tuner never goes quiet, so the panel never shows "Play a string"')
    let changes = 0
    let jumps = 0
    for (let i = 1; i < readings.length; i++) {
      const a = readings[i - 1]
      const b = readings[i]
      if (!a.note || !b.note) continue
      if (a.note !== b.note || a.octave !== b.octave) changes++
      else if (Math.abs(a.cents - b.cents) > 4) jumps++
    }
    assert.ok(changes < sounding.length * 0.2, `the string changed on ${changes} of ${sounding.length} sounding ticks`)
    assert.equal(jumps, 0, `cents jumped by more than 4 between ticks ${jumps} times while the string held`)
    assert.ok(sounding.every((r) => Number.isInteger(r.cents) && Math.abs(r.cents) <= 50), 'a reading is not an integer within ±50 cents')
  })
}

/* ------------------------------------------------------------------
   Leaving a popover
   ------------------------------------------------------------------ */

test('useDismiss: a tap outside or Escape closes, the trigger is ignored, focus goes back', async () => {
  // React's useEffect/useRef, driven by hand: run the effect, collect its cleanup.
  const listeners = new Map()
  let focused = null
  const trigger = { closest: (sel) => (sel === '.trigger' ? trigger : null) }
  const inside = { closest: () => null }
  const outside = { closest: () => null }
  const origin = { focus: () => (focused = origin) }
  globalThis.document = {
    activeElement: origin,
    contains: () => true,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type)
  }
  const React = await import('react')
  let cleanup = null
  const effects = []
  const fakeReact = {
    useRef: (v) => ({ current: v }),
    useEffect: (fn) => effects.push(fn)
  }
  // The hook imports React's hooks by name; run it against the fakes by re-binding.
  const src = readSrc(new URL('../src/lib/dismiss.js', import.meta.url), 'utf8')
    .replace("import { useEffect, useRef } from 'react'", '')
    .replace('export function useDismiss', 'function useDismiss')
  const useDismiss = new Function('useEffect', 'useRef', src + '\nreturn useDismiss')(fakeReact.useEffect, fakeReact.useRef)
  const closes = []
  const ref = { current: { contains: (el) => el === inside } }

  useDismiss(ref, () => closes.push('closed'), { open: true, ignore: '.trigger' })
  cleanup = effects.pop()()
  listeners.get('pointerdown')({ target: inside })
  assert.equal(closes.length, 0, 'a tap inside closed it')
  listeners.get('pointerdown')({ target: trigger })
  assert.equal(closes.length, 0, 'a tap on the trigger closed it (and would reopen it on the same tap)')
  listeners.get('pointerdown')({ target: outside })
  assert.equal(closes.length, 1, 'a tap outside did not close it')
  let stopped = false
  listeners.get('keydown')({ key: 'Escape', stopPropagation: () => (stopped = true) })
  assert.equal(closes.length, 2, 'Escape did not close it')
  assert.ok(stopped, 'Escape was let through to whatever else listens')
  listeners.get('keydown')({ key: 'Enter', stopPropagation: () => {} })
  assert.equal(closes.length, 2, 'a key other than Escape closed it')
  cleanup()
  assert.equal(listeners.size, 0, 'the listeners outlive the popover')
  assert.equal(focused, origin, 'focus did not go back to where it was')

  // Closed: nothing is listened for.
  effects.length = 0
  useDismiss(ref, () => closes.push('never'), { open: false })
  assert.equal(effects.pop()(), undefined)
  assert.equal(listeners.size, 0)
  delete globalThis.document
  void React
})

console.log('\nthe volume slider on Play')
/*
 * "Add volume slider to the play screen to quickly turn volume up or down."
 * The slider moves the Output block's Level. What is checked here is the part
 * that does not need a browser: which parameter it picks, what it says, and
 * how a stream of drag values becomes writes a serial port can keep up with.
 */
const volume = await import('../src/lib/volume.js')

test('the slider drives the Output block\u2019s Level and nothing else', () => {
  const named = [
    { id: 3, name: 'Balance', value: 0, min: -100, max: 100, unit: '%' },
    { id: 1, name: 'Level', value: -3, min: -80, max: 20, unit: 'dB' },
    { id: 9, name: 'Boost Level', value: 0, min: 0, max: 10 }
  ]
  assert.equal(volume.outputLevelParam(named)?.id, 1, 'the Level is not the one picked')
  // A driver that says "Out Level" still gets a slider.
  assert.equal(volume.outputLevelParam([{ id: 4, name: 'Out Level', min: -80, max: 20 }])?.id, 4)
  // "Boost Level" and "Input Level" are gain, not volume — never the slider's.
  assert.equal(volume.outputLevelParam([{ id: 9, name: 'Boost Level', min: 0, max: 10 }]), null)
  assert.equal(volume.outputLevelParam([{ id: 5, name: 'Input Level', min: 0, max: 10 }]), null)
  // No range, no slider: a write without a range is a guessed value, and setParam refuses those.
  assert.equal(volume.outputLevelParam([{ id: 1, name: 'Level' }]), null)
  assert.equal(volume.outputLevelParam(null), null)
  assert.equal(volume.outputLevelParam(undefined), null)
})

test('the figure beside the slider carries a sign and a unit', () => {
  const p = { min: -80, max: 20, unit: 'dB' }
  assert.equal(volume.volumeLabel(-6.5, p), '\u22126.5 dB')
  assert.equal(volume.volumeLabel(2, p), '+2.0 dB')
  assert.equal(volume.volumeLabel(0, p), '0.0 dB')
  assert.equal(volume.volumeLabel(undefined, p), '\u2014')
  assert.equal(volume.volumeStep(p), 0.5, 'a dB slider moves in half-dB notches')
  assert.equal(volume.volumeStep({ min: 0, max: 10 }), 0.1)
  assert.equal(volume.volumePercent(-30, p), 50)
  assert.equal(volume.volumePercent(-80, p), 0)
  assert.equal(volume.volumePercent(20, p), 100)
  assert.equal(volume.volumePercent(99, p), 100, 'a value past the end is not past the end')
})

test('the buttons either side of the slider move it one dB, and stop at the ends', () => {
  const p = { min: -80, max: 20, unit: 'dB' }
  assert.equal(volume.volumeNudge(p), 1, 'a press is not one dB')
  assert.equal(volume.nudged(-6.5, p, 1), -5.5)
  assert.equal(volume.nudged(-6.5, p, -1), -7.5)
  assert.equal(volume.nudged(19.5, p, 1), 20, 'a press past the top is not held at the top')
  assert.equal(volume.nudged(-79.5, p, -1), -80, 'a press past the bottom is not held at the bottom')
  assert.equal(volume.nudged(undefined, p, 1), -79, 'with no value known a press counts from the bottom')
  // A control that is not in dB: ten notches, the same idea.
  assert.equal(volume.volumeNudge({ min: 0, max: 10 }), 1)
  assert.equal(volume.nudged(0.37, { min: 0, max: 10 }, 1), 1.4, 'the landing is not on a notch')
})

test('the read-back after a burst of presses waits for the burst to end', () => {
  /* Four presses in half a second, each checked on its own, read back each
     other's values. The presses go now; the check waits. */
  assert.equal(volume.NUDGE_SETTLE_MS, 350)
})

test('a Level the unit sends with no unit still moves one dB a press', () => {
  // The FM3's Output Level arrives with no unit at all. "When adjusting the
  // volume, it's going up by 10 decibels. It should just go up one decibel at
  // a time when hitting plus or minus."
  const p = { name: 'Level', min: -80, max: 20 }
  assert.equal(volume.inDecibels(p), true, 'a Level with no unit is not taken for dB')
  assert.equal(volume.volumeNudge(p), 1, 'a press is ten dB, not one')
  assert.equal(volume.volumeStep(p), 0.5, 'the slider notch is not half a dB')
  assert.equal(volume.nudged(20, p, -1), 19)
  assert.equal(volume.nudged(19.5, p, 1), 20)
  assert.equal(volume.volumeLabel(20, p), '+20.0 dB', 'the figure does not say dB')
  assert.equal(volume.inDecibels({ name: 'Out Level', min: -80, max: 20 }), true)
  // A unit that says otherwise is believed over the name.
  assert.equal(volume.inDecibels({ name: 'Level', min: 0, max: 100, unit: '%' }), false)
  assert.equal(volume.volumeNudge({ name: 'Level', min: 0, max: 100, unit: '%' }), 10)
  // And a knob that is not a level and says nothing is not in dB.
  assert.equal(volume.inDecibels({ name: 'Mix', min: 0, max: 100 }), false)
  assert.equal(volume.volumeLabel(50, { name: 'Mix', min: 0, max: 100 }), '+50.0')
})

test('a drag sends one write at a time and the newest value wins', async () => {
  const sent = []
  let release = null
  const write = (v) => {
    sent.push(v)
    return new Promise((done) => {
      release = done
    })
  }
  const w = volume.latestWriter(write)
  w.send(1)
  w.send(2)
  w.send(3)
  assert.deepEqual(sent, [1], 'a second write went out while the first was still on the wire')
  assert.ok(w.busy)
  const settled = w.settled()
  release()
  await new Promise((go) => setTimeout(go, 0))
  assert.deepEqual(sent, [1, 3], 'the value in the middle of the drag was written; only the newest should be')
  release()
  const err = await settled
  assert.equal(err, null)
  assert.deepEqual(sent, [1, 3])
  assert.ok(!w.busy)
  // Nothing in flight: settled answers at once.
  assert.equal(await w.settled(), null)
})

test('a write that fails mid-drag does not stop the next one, and is reported once at the release', async () => {
  const sent = []
  const write = async (v) => {
    sent.push(v)
    if (v === 1) throw new Error('port busy')
  }
  const w = volume.latestWriter(write)
  w.send(1)
  w.send(2)
  const err = await w.settled()
  assert.deepEqual(sent, [1, 2], 'the failure stopped the value behind it')
  assert.match(err?.message || '', /port busy/, 'the failure was swallowed rather than handed to the release')
  assert.equal(await w.settled(), null, 'the same failure was reported twice')
})

console.log('\na garbled preset dump is asked for again')
/*
 * "PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78" on switching
 * presets. The read came while the unit was still loading; asking again gets
 * the dump. lib/retry.js holds the rule, forgefx.js applies it at the one
 * place every request passes through.
 */
const retry = await import('../src/lib/retry.js')

test('the words the codec uses for a garbled dump are recognised, and nothing else is', () => {
  assert.ok(retry.isGarbledDump('PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78'))
  assert.ok(retry.isGarbledDump('expected func 0x77 at offset 0, got 0x78'))
  assert.ok(!retry.isGarbledDump('Can’t reach the Fractal app on your computer.'))
  assert.ok(!retry.isGarbledDump('No unit'))
  assert.ok(!retry.isGarbledDump(undefined))
})

test('reads and selects may be asked twice; writes may not', () => {
  assert.ok(retry.canAskAgain('GET', '/preset/blocks'))
  assert.ok(retry.canAskAgain('GET', '/preset/blocks/42/params?x=1'))
  assert.ok(retry.canAskAgain('POST', '/preset/select'))
  assert.ok(retry.canAskAgain('POST', '/scene'))
  assert.ok(!retry.canAskAgain('POST', '/preset/store'), 'a save was re-sent')
  assert.ok(!retry.canAskAgain('PUT', '/preset/blocks/42/params/1'), 'a parameter write was re-sent')
  assert.ok(!retry.canAskAgain('POST', '/tempo/tap'), 'a tap was re-sent')
  assert.ok(!retry.canAskAgain('DELETE', '/device/cache'))
})

test('a read that garbles twice and lands the third time is one answer, not an error', async () => {
  const waits = []
  let calls = 0
  const out = await retry.withRetry(
    async () => {
      calls++
      if (calls < 3) throw new Error('PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78')
      return { ok: true, calls }
    },
    { method: 'GET', path: '/preset/blocks', wait: async (ms) => waits.push(ms) }
  )
  assert.deepEqual(out, { ok: true, calls: 3 })
  assert.deepEqual(waits, [400, 800], 'the waits do not grow while the unit loads')
})

test('a read that garbles every time is still reported, in the codec’s own words, after the last try', async () => {
  let calls = 0
  await assert.rejects(
    retry.withRetry(
      async () => {
        calls++
        throw new Error('PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78')
      },
      { method: 'GET', path: '/preset/blocks', wait: async () => {} }
    ),
    /PRESET_DUMP_HEADER/
  )
  assert.equal(calls, 1 + retry.RETRIES)
})

test('a different failure, or a write, is not asked again', async () => {
  let calls = 0
  await assert.rejects(
    retry.withRetry(async () => { calls++; throw new Error('No unit') }, { method: 'GET', path: '/x', wait: async () => {} }),
    /No unit/
  )
  assert.equal(calls, 1, 'an unrelated failure was retried')
  calls = 0
  await assert.rejects(
    retry.withRetry(
      async () => { calls++; throw new Error('PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78') },
      { method: 'PUT', path: '/preset/blocks/42/params/1', wait: async () => {} }
    ),
    /PRESET_DUMP_HEADER/
  )
  assert.equal(calls, 1, 'a write was re-sent on a garbled read-back')
})

test('every request the app makes passes through the retry, at the computer and over the relay', () => {
  const src = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')
  assert.match(src, /import \{ withRetry \} from '\.\/retry\.js'/, 'forgefx.js does not import the retry')
  assert.match(
    src,
    /async function request\(path, options = \{\}\) \{[\s\S]*?return withRetry\(\(\) => requestOnce\(path, options\), \{ method: options\.method \|\| 'GET', path \}\)/,
    'request() no longer asks again on a garbled dump'
  )
  const once = src.slice(src.indexOf('async function requestOnce('))
  assert.match(once, /remoteRequest\(path, options\)/, 'the relay path is outside the retry')
  assert.match(once, /return directRequest\(path, options\)/, 'the local path is outside the retry')
  // And the slider reads the level on a new preset, not on every re-read of it.
  const vol = readSrc(new URL('../src/components/Volume.jsx', import.meta.url), 'utf8')
  assert.match(vol, /const slot = preset\?\.number/, 'the slider no longer keys its read on the preset number')
  assert.match(vol, /\}, \[eid, slot\]\)/, 'the slider re-reads the output block on every preset re-read again')
})

console.log('\nthe scene plan names the amp on each channel')


console.log('\nstructure')
const { run: structure } = await import('./structure.mjs')
structure(test)

console.log('\nthe dimensional system')
const { run: styles } = await import('./styles.mjs')
styles(test)

console.log('\ntouch')
const { run: touch } = await import('./touch.mjs')
touch(test)

console.log('\nlimits')
const { run: limits } = await import('./limits.mjs')
limits(test)

console.log('\nthe phone apps')
const { run: mobile } = await import('./mobile.mjs')
mobile(test)

console.log('\nboth ends')
const { run: bothEnds } = await import('./both-ends.mjs')
bothEnds(test)

console.log('\nthe server')
const { run: server } = await import('./server.mjs')
server(test)

test('both file kinds are listed and told apart', async () => {
  // A .syx goes back to the unit verbatim; a design re-validates first. Load
  // treating one as the other would either corrupt or silently no-op.
  const files = [
    { kind: 'file', name: 'Drop A.syx', getFile: async () => ({ size: 3, lastModified: 2 }) },
    { kind: 'file', name: 'Lead.design.json', getFile: async () => ({ size: 9, lastModified: 5 }) },
    { kind: 'file', name: 'notes.txt', getFile: async () => ({ size: 1, lastModified: 9 }) },
    { kind: 'directory', name: 'versions' }
  ]
  const handle = { values: async function* () { for (const f of files) yield f } }
  const { listPresetFiles } = await import('../src/lib/localFolder.js')
  const out = await listPresetFiles(handle)
  assert.deepEqual(out.map((e) => [e.name, e.kind]), [['Lead', 'design'], ['Drop A', 'capture']])
})

test('a re-run of the version sync writes nothing twice', async () => {
  // Idempotence lives in the filename: the version id rides at the end, and the
  // synced-id scan reads it back.
  const { writeVersionFile, syncedVersionIds } = await import('../src/lib/localFolder.js')
  const written = []
  const dir = {
    getFileHandle: async (name) => {
      written.push(name)
      return { createWritable: async () => ({ write: async () => {}, close: async () => {} }) }
    },
    values: async function* () {
      for (const name of written) yield { kind: 'file', name }
    }
  }
  await writeVersionFile(dir, { id: 'bk-abc123', capturedAt: 0, location: 5, name: 'Rig' }, new Uint8Array([1]))
  const have = await syncedVersionIds(dir)
  assert.ok(have.has('bk-abc123'))
})

test('a design file survives the round trip', async () => {
  const store = {}
  const dir = {
    getFileHandle: async (name, opts) => {
      if (!opts?.create && !(name in store)) throw new Error('not found')
      return {
        createWritable: async () => ({ write: async (t) => { store[name] = t }, close: async () => {} }),
        getFile: async () => ({ text: async () => store[name] })
      }
    }
  }
  const { writeDesignFile, readDesignFile } = await import('../src/lib/localFolder.js')
  const entry = { id: 'x', name: 'Lead / "Solo"', spec: { amp: { gain: 7 } } }
  const file = await writeDesignFile(dir, entry)
  assert.ok(file.endsWith('.design.json') && !file.includes('/'))
  const back = await readDesignFile(dir, file)
  assert.deepEqual(back.spec, entry.spec)
})

test('every block colour is real CSS', async () => {
  // A Cyrillic а slipped into the reverb hex on first writing: identical on
  // screen, invalid to CSS, and the colour just never appears — no error, no
  // clue. Colour strings must be plain ASCII hex or a var() reference.
  const { blockColor } = await import('../src/lib/blockColors.js')
  for (const slug of ['drive', 'amp', 'delay', 'reverb', 'cab', 'chorus', 'pitch', 'mystery']) {
    const { fill, ink } = blockColor(slug)
    for (const value of [fill, ink]) {
      assert.ok(
        /^#[0-9a-f]{6}$/.test(value) || /^var\(--[\w-]+\)$/.test(value),
        `${slug}: "${value}" is not valid CSS`
      )
    }
  }
})

test('display-name shapes resolve to their family', async () => {
  // Axis's category map showed which shapes actually arrive: spaces, hyphens,
  // slashes, instance numbers.
  const { blockColor } = await import('../src/lib/blockColors.js')
  assert.deepEqual(blockColor('Plex Delay'), blockColor('plex'))
  assert.deepEqual(blockColor('Ten-Tap'), blockColor('tentap'))
  assert.deepEqual(blockColor('Vol/Pan'), blockColor('volpan'))
  assert.deepEqual(blockColor('RingMod'), blockColor('ringmod'))
})

test('instance suffixes and unknowns resolve sensibly', async () => {
  const { blockColor } = await import('../src/lib/blockColors.js')
  assert.deepEqual(blockColor('delay2'), blockColor('delay'))
  assert.deepEqual(blockColor('drive1'), blockColor('drive'))
  assert.equal(blockColor('definitely-new-block').fill, 'var(--panel-hi)')
  assert.equal(blockColor(null).fill, 'var(--panel-hi)')
})


test('a chain built into an empty preset gets an input and an output', async () => {
  const { chainPlan } = await import('../src/lib/actions.js')

  /*
   * The whole of "what happens when you create a new preset on an empty
   * preset". Nothing on the row at all: the input takes column 0, the chain
   * follows it, and the output lands after the chain — so the guitar reaches
   * the first pedal and the last one reaches the jack.
   *
   * Getting this wrong is silent. Every value lands, the unit reads them back,
   * the preset saves, and the player hears nothing.
   */
  const empty = chainPlan({ onRow: [], width: 12, count: 3, canInput: true, canOutput: true })
  assert.equal(empty.input, 0)
  assert.deepEqual(empty.cols, [1, 2, 3])
  assert.equal(empty.output, 4)
  assert.equal(empty.wireTo, 4, 'the cabling stops short of the output block')

  // A preset that already has both is not given a second of either, and the
  // chain goes in the free cells BETWEEN them rather than over the top.
  const furnished = chainPlan({
    onRow: [
      { slug: 'input', col: 0 },
      { slug: 'output', col: 5 }
    ],
    width: 12,
    count: 2,
    canInput: false,
    canOutput: false
  })
  assert.equal(furnished.input, 0)
  assert.deepEqual(furnished.cols, [1, 2])
  assert.equal(furnished.output, 5)

  // Half furnished: the output is there, the input is not — which is exactly
  // the shape that made a built chain silent.
  const noIn = chainPlan({
    onRow: [{ slug: 'output', col: 6 }],
    width: 12,
    count: 2,
    canInput: true,
    canOutput: false
  })
  assert.equal(noIn.input, 0)
  assert.deepEqual(noIn.cols, [1, 2])
  assert.equal(noIn.output, 6)

  // A unit that offers neither as a block routes its signal some other way and
  // has nothing invented for it — and the cabling then runs to the end of the
  // row, because that is where the signal has to get to either way.
  const linearish = chainPlan({ onRow: [], width: 4, count: 4, canInput: false, canOutput: false })
  assert.equal(linearish.input, null)
  assert.equal(linearish.output, null)
  assert.deepEqual(linearish.cols, [0, 1, 2, 3])
  assert.equal(linearish.wireTo, 3)

  // An existing block that is neither is stepped around, not written over.
  const occupied = chainPlan({
    onRow: [{ slug: 'amp', col: 2 }],
    width: 6,
    count: 2,
    canInput: true,
    canOutput: true
  })
  assert.equal(occupied.input, 0)
  assert.deepEqual(occupied.cols, [1, 3])
  assert.equal(occupied.output, 4)
})

console.log('\nadd a block')

test('the free cell is on the chain row, judged against every block', async () => {
  const { firstFreeCell } = await import('../src/lib/actions.js')
  // Input and output count as occupants — the raw-versus-editable lesson,
  // pointed the other way.
  const blocks = [
    { slug: 'input', row: 0, col: 0 },
    { slug: 'drive', row: 0, col: 1 },
    { slug: 'amp', row: 0, col: 2 }
  ]
  assert.deepEqual(firstFreeCell(blocks, 1, 4), { row: 0, col: 3 })
  // A full row says so rather than inventing a cell.
  assert.equal(firstFreeCell([...blocks, { slug: 'delay', row: 0, col: 3 }], 1, 4), null)
  // An empty grid starts at the top left.
  assert.deepEqual(firstFreeCell([], 1, 4), { row: 0, col: 0 })
})


test('the block list is remembered per unit, and a failed read says so', async () => {
  /*
   * GET /blocks is a fixed list on the server and cannot be empty on an FM3.
   * The chat was handed an empty one anyway — App called blockCatalog()
   * without importing it, the catch swallowed "not defined", and every
   * request from every device went out with nothing placeable. Now the read
   * is remembered once it works, and a failure with nothing remembered is a
   * failure, with words, not an empty unit.
   */
  const { normalizePalette, cachedPalette, rememberPalette, paletteFor } = palette
  assert.deepEqual(normalizePalette(null), [])
  assert.deepEqual(normalizePalette({ error: 'x' }), [])
  assert.equal(normalizePalette([{ slug: 'amp', name: 'Amp', page: 58 }, { name: 'no slug' }, null]).length, 1)
  assert.equal(normalizePalette({ blocks: [{ slug: 'cab' }] })[0].slug, 'cab')

  const mem = new Map()
  const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) }
  assert.equal(cachedPalette('fm3', store), null)
  assert.equal(rememberPalette('fm3', [], store), false, 'an empty list was kept as a list')
  assert.equal(rememberPalette('fm3', [{ slug: 'pitch', name: 'Pitch', page: 110 }], store), true)
  assert.equal(cachedPalette('fm3', store)[0].slug, 'pitch')
  assert.equal(cachedPalette('am4', store), null, 'one unit reads another unit’s list')

  // A good read is kept and served; a bad read serves what was kept.
  const good = await paletteFor('am4', async () => [{ slug: 'amp', name: 'Amp', page: 1 }], store)
  assert.equal(good.fromCache, false)
  assert.equal(cachedPalette('am4', store)[0].slug, 'amp')
  const bad = await paletteFor('am4', async () => { throw new Error('Your computer didn’t answer.') }, store)
  assert.equal(bad.fromCache, true)
  assert.equal(bad.list[0].slug, 'amp')
  assert.match(bad.error, /didn’t answer/)
  const empty = await paletteFor('am4', async () => [], store)
  assert.equal(empty.fromCache, true, 'an empty answer replaced the remembered list')
  // Nothing remembered: the failure is the answer.
  await assert.rejects(paletteFor('vp4', async () => { throw new Error('no answer') }, store), /no answer/)
  await assert.rejects(paletteFor('vp4', async () => [], store), /empty block list/)
  // Unreadable storage is no storage, never a throw.
  const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.equal(cachedPalette('fm3', broken), null)
  assert.equal((await paletteFor('fm3', async () => [{ slug: 'amp' }], broken)).list.length, 1)
})

console.log('\nxy pad')

test('the write gate holds against a fast finger', async () => {
  const { gateWrite } = await import('../src/lib/xy.js')
  // First touch always writes.
  assert.ok(gateWrite({ now: 0, lastAt: 0, lastFrac: null, frac: 0.5, interval: 60 }))
  // A twitch below the epsilon never writes, no matter how much time passed.
  assert.ok(!gateWrite({ now: 9999, lastAt: 0, lastFrac: 0.5, frac: 0.502, interval: 60 }))
  // Real movement too soon after the last write waits.
  assert.ok(!gateWrite({ now: 30, lastAt: 0, lastFrac: 0.5, frac: 0.7, interval: 60 }))
  // Real movement after the interval goes through.
  assert.ok(gateWrite({ now: 61, lastAt: 0, lastFrac: 0.5, frac: 0.7, interval: 60 }))
})

test('pointer positions clamp to the pad and up means more', async () => {
  const { padFraction } = await import('../src/lib/xy.js')
  const rect = { left: 100, top: 100, width: 200, height: 200 }
  assert.deepEqual(padFraction(200, 200, rect), { x: 0.5, y: 0.5 })
  // Top edge of the pad is full value, not zero.
  assert.deepEqual(padFraction(100, 100, rect), { x: 0, y: 1 })
  // A drag that leaves the pad pins to the edge instead of overshooting.
  assert.deepEqual(padFraction(999, -50, rect), { x: 1, y: 1 })
  assert.deepEqual(padFraction(-50, 999, rect), { x: 0, y: 0 })
})

console.log('\ndevice state')

/*
 * The store is a pure module on purpose — it takes its device functions rather
 * than importing them — so the whole write path is exercisable here, with no
 * hardware, no browser and no mock. These are the cases that cost real
 * evenings: an optimistic write that never rolls back, and an echo that fights
 * the write that caused it.
 */
const ds = await import('../src/lib/deviceState.js')

/** A fake unit: records what it was told, and can be made to refuse. */
function fakeUnit(overrides = {}) {
  const calls = []
  const record = (name) => (...args) => {
    calls.push([name, ...args])
    return Promise.resolve({ ok: true })
  }
  return {
    calls,
    setScene: record('setScene'),
    setTempo: record('setTempo'),
    setBypass: record('setBypass'),
    setTuner: record('setTuner'),
    presetBlocks: () => Promise.resolve([]),
    getScene: () => Promise.resolve({ index: 0, names: [] }),
    ...overrides
  }
}

const fresh = (unit) => {
  ds.reset()
  ds.attachDriver(unit)
  return unit
}

test('a snapshot that did not change is the same snapshot', () => {
  fresh(fakeUnit())
  const before = ds.getSnapshot()
  assert.equal(ds.set({ bpm: null }), false, 'setting a field to what it already is reported a change')
  assert.equal(ds.getSnapshot(), before, 'an unchanged store handed back a new object')
  assert.equal(ds.set({ bpm: 120 }), true)
  assert.notEqual(ds.getSnapshot(), before)
})

test('subscribers hear a real change and only a real change', () => {
  fresh(fakeUnit())
  let heard = 0
  const off = ds.subscribe(() => heard++)
  ds.set({ bpm: 140 })
  ds.set({ bpm: 140 })
  assert.equal(heard, 1, 'an idempotent set woke every listener')
  off()
  ds.set({ bpm: 90 })
  assert.equal(heard, 1, 'a listener kept being called after unsubscribing')
})

test('a scene write shows immediately and reaches the device', async () => {
  const unit = fresh(fakeUnit())
  const done = ds.writeScene(3)
  assert.equal(ds.getSnapshot().sceneIndex, 3, 'the scene did not move until the device answered')
  await done
  assert.deepEqual(unit.calls, [['setScene', 3]])
})

test('a refused write rolls back to what was on screen before it', async () => {
  fresh(fakeUnit({ setScene: () => Promise.reject(new Error('port busy')) }))
  ds.set({ sceneIndex: 2 })
  await assert.rejects(() => ds.writeScene(5), /port busy/)
  assert.equal(ds.getSnapshot().sceneIndex, 2, 'a refusal left the optimistic value on screen')
})

test('a refused bypass restores the whole chain, not a rebuilt one', async () => {
  fresh(fakeUnit({ setBypass: () => Promise.reject(new Error('nope')) }))
  const chain = [
    { effectId: 1, bypassed: false },
    { effectId: 2, bypassed: false }
  ]
  ds.set({ blocks: chain })
  await assert.rejects(() => ds.writeBypass(1, true), /nope/)
  assert.equal(ds.getSnapshot().blocks, chain, 'the chain came back as a copy, not the array it was')
})

test("the device's echo of a local write does not fight it", () => {
  fresh(fakeUnit())
  ds.markLocal('sceneIndex', 4)
  ds.set({ sceneIndex: 4 })
  // The unit reports the scene it just changed to. Acting on it is harmless
  // here, but the same echo arriving for a value already superseded is what
  // makes a button flicker back through the old scene.
  ds.handleEvent({ type: 'scene', index: 4 })
  assert.equal(ds.getSnapshot().sceneIndex, 4)
})

test('a footswitch press is followed, an echo is not', () => {
  fresh(fakeUnit())
  ds.markLocal('sceneIndex', 1)
  ds.set({ sceneIndex: 1 })
  // Someone moves on to scene 6 in the app before the echo for 1 arrives.
  ds.set({ sceneIndex: 6 })
  ds.handleEvent({ type: 'scene', index: 1 })
  assert.equal(ds.getSnapshot().sceneIndex, 6, 'a stale echo dragged the screen back')
  // A genuine press on the floor is a different fact and must be followed.
  ds.handleEvent({ type: 'scene', index: 2 })
  assert.equal(ds.getSnapshot().sceneIndex, 2, 'a real footswitch press was ignored')
})

test('the guard is spent by one echo and expires on its own', () => {
  fresh(fakeUnit())
  ds.markLocal('sceneIndex', 7, 1000)
  assert.equal(ds.isEcho('sceneIndex', 7, 1100), true)
  assert.equal(ds.isEcho('sceneIndex', 7, 1150), false, 'one write silenced two echoes')

  // An echo that never arrives must not leave the guard armed against a press
  // a minute later.
  ds.markLocal('sceneIndex', 8, 2000)
  assert.equal(ds.isEcho('sceneIndex', 8, 2000 + ds.ECHO_MS + 1), false)
})

test('a chain read that fails says so and keeps the last chain', async () => {
  fresh(fakeUnit({ presetBlocks: () => Promise.reject(new Error('timeout')) }))
  const chain = [{ effectId: 1, slug: 'amp' }]
  ds.set({ blocks: chain })
  assert.equal(await ds.refreshBlocks(), null, 'a failed read reported success')
  assert.equal(ds.getSnapshot().blocks, chain, 'a failed read emptied the chain on screen')
})

test('a chain read that fails because the unit has gone is asked once, not five times', async () => {
  /*
   * From an iPhone log on a Mac whose port had shut: one tap on a block's On
   * button, and then "GET /preset/blocks failed — port not open" five times
   * over four seconds, every one of them a round trip down the relay to a Mac
   * that had already said there was no port. Seventy-nine lines of the log are
   * that, over and over, and the screen never said a word.
   *
   * Asking again is for a port that was busy for a moment. A port that is gone
   * gives the same answer instantly, so the first one is the answer.
   */
  const gone = Object.assign(new Error('The computer has lost the unit'), { unitGone: true })
  fresh(fakeUnit({ presetBlocks: () => Promise.reject(gone) }))
  let asks = 0
  const list = await ds.confirmedChain({
    read: async () => {
      asks++
      return ds.refreshBlocks()
    },
    wait: async () => {},
    remote: true
  })
  assert.equal(list, null, 'a unit that cannot be reached was passed off as read')
  assert.equal(asks, 1, 'a dead link was asked ' + asks + ' times')
  assert.equal(ds.chainReadFailure(), gone, 'why the read failed was thrown away')

  // And an ordinary busy port still gets every ask it ever did.
  fresh(fakeUnit({ presetBlocks: () => Promise.reject(new Error('timeout')) }))
  let busy = 0
  await ds.confirmedChain({
    read: async () => {
      busy++
      return ds.refreshBlocks()
    },
    wait: async () => {},
    remote: true
  })
  assert.equal(busy, ds.RELAY_TRIES, 'a busy port lost the retries it needs')
})

test('a reading with the tuner off is not a reading', () => {
  fresh(fakeUnit())
  ds.handleEvent({ type: 'tuner', note: 'E', cents: 3 })
  assert.equal(ds.getSnapshot().tuning, null, 'a reading landed with no tuner open')
  ds.set({ tunerOn: true })
  ds.handleEvent({ type: 'tuner', note: 'E', cents: 3 })
  assert.equal(ds.getSnapshot().tuning?.note, 'E')
})

test('a unit that counts its chain from one is brought back to zero', () => {
  /*
   * "It shows five blocks when there's only four and it says add empty one —
   * if you add one, it actually saves it to the first block, but overwrites
   * the one that is listed as number two."
   *
   * The AM4 reports its four slots as 1..4 while the app counts from zero and
   * adds the wire's one back at the boundary. So every column arrived one too
   * high: four blocks drew five slots, the phantom one labelled 1, and filling
   * it wrote to wire slot 1 — on top of the block the screen was calling 2.
   */
  const linear = { slotModel: 'linear', slotCount: 4 }
  const am4 = [
    { name: 'Chorus', col: 1 },
    { name: 'Amp', col: 2 },
    { name: 'Delay', col: 3 },
    { name: 'Reverb', col: 4 }
  ]
  assert.deepEqual(
    slots.zeroBasedChain(am4, linear).map((b) => b.col),
    [0, 1, 2, 3],
    'the chain still starts at one, so the screen draws a slot that is not there'
  )

  // A grid unit already counts from zero and must be left exactly as it is.
  const grid = [{ name: 'Amp', col: 0 }, { name: 'Cab', col: 3 }]
  assert.deepEqual(slots.zeroBasedChain(grid, { slotModel: 'grid' }).map((b) => b.col), [0, 3])
  assert.equal(slots.zeroBasedChain(grid, { slotModel: 'grid' }), grid, 'a grid chain was needlessly rebuilt')

  /*
   * And the correction is not applied twice. A driver fixed upstream, or an
   * app that runs this on its own output, would otherwise shift a chain into
   * slot -1 — which the unit refuses outright.
   */
  const once = slots.zeroBasedChain(am4, linear)
  assert.deepEqual(slots.zeroBasedChain(once, linear).map((b) => b.col), [0, 1, 2, 3],
    'a chain already counting from zero was shifted below it')

  // Nothing to shift is not something to break on.
  assert.deepEqual(slots.zeroBasedChain([], linear), [])
  assert.equal(slots.zeroBasedChain(null, linear), null)
  assert.equal(slots.isLinearChain(linear), true)
  assert.equal(slots.isLinearChain({ slotModel: 'grid' }), false)
  assert.equal(slots.isLinearChain(undefined), false)
})

test('a hold is a press that stays put, and a right-click is not a middle-click', () => {
  /*
   * "If you can hold one of the effects for a few seconds... on the Mac
   * version, maybe we can do a right click."
   *
   * The two decisions a hold makes, held here because both are the kind that
   * fail quietly: a menu that opens while somebody is scrolling the stage
   * screen, and one that opens on a scroll-wheel click.
   */
  assert.equal(hold.holdStarts({ pointerType: 'touch' }), true)
  assert.equal(hold.holdStarts({ pointerType: 'pen' }), true)
  assert.equal(hold.holdStarts({ pointerType: 'mouse', button: 0 }), true)
  assert.equal(hold.holdStarts({ pointerType: 'mouse', button: 1 }), false, 'a middle-click opens a menu')
  assert.equal(hold.holdStarts({ pointerType: 'mouse', button: 2 }), false, 'a right-click would fire twice')

  const from = { x: 100, y: 100 }
  assert.equal(hold.movedOut(from, 100, 100), false)
  /* A thumb resting against a guitar moves a few pixels without anybody
     meaning it to; past the slop it is a scroll. */
  assert.equal(hold.movedOut(from, 106, 100), false, 'a resting thumb cancels the hold')
  assert.equal(hold.movedOut(from, 100, 118), true, 'a scroll still opens the menu')
  // Diagonal, so the distance is the hypotenuse rather than the larger axis.
  assert.equal(hold.movedOut(from, 108, 108), true, 'a diagonal drag is measured one axis at a time')
  assert.equal(hold.movedOut(null, 999, 999), false, 'a move with no press behind it counts as one')
})

test('a tuner the unit cannot run turns itself back off', async () => {
  fresh(fakeUnit({ setTuner: () => Promise.resolve({ ok: false }) }))
  await ds.writeTuner(true)
  assert.equal(ds.getSnapshot().tunerOn, false, 'a refused tuner stayed lit, waiting forever')
})

test('there is one event subscription, however many times it is asked for', () => {
  let bound = 0
  let unbound = 0
  fresh(
    fakeUnit({
      subscribeEvents: () => {
        bound++
        return () => unbound++
      }
    })
  )
  ds.listen()
  ds.listen()
  ds.listen()
  assert.equal(bound, 1, 'the store subscribed to the event stream more than once')
  assert.equal(ds.isListening(), true)
  ds.stopListening()
  assert.equal(unbound, 1)
  assert.equal(ds.isListening(), false)
})

console.log('\nwhat a switch costs the unit, from the Mac window')

/*
 * "The Fractals are set up to have gapless switching of scenes and effects
 * ... the sound should never cut out." And from a tester: "the preset changes
 * almost immediately on the unit, but after that there is drop in sound,
 * until the android app loads the new page."
 *
 * The switches were right. What followed them was a preset dump — the chain
 * read, about 24KB — landing on a unit still switching, and the Mac window
 * made its own on top of the phone's: every announcement it heard, the
 * phone's taps included, read the chain. These run the real store against a
 * pretend computer that writes down every request, with a clock turned by
 * hand, and count what reaches the unit.
 */
function handClock() {
  let t = 1000000
  let seq = 0
  const timers = new Map()
  const flush = async () => {
    for (let i = 0; i < 12; i++) await new Promise((go) => setImmediate(go))
  }
  return {
    now: () => t,
    setTimeout(fn, ms = 0) {
      const id = ++seq
      timers.set(id, { id, at: t + Math.max(0, Number(ms) || 0), fn })
      return id
    },
    clearTimeout(id) {
      timers.delete(id)
    },
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
}

const CHAIN = 'GET /preset/blocks'
const SUMMARY = /^GET \/presets\/\d+\/summary$/
const STATE = 'GET /preset/scene-state'
const WHICH = 'GET /preset'

/* The block catalog App hands the store, whose `page` is each block's effect id. */
const BLOCK_CATALOG = JSON.parse(readSrc(new URL('../src/data/blocks.json', import.meta.url), 'utf8'))

/** An FM3 on slot 12, scene 1, as App's first read leaves the store. */
function windowOnTheBench(over = {}) {
  const unit = {
    number: 12,
    scene: 0,
    scenes: ['VERSE', 'CHORUS', '', '', '', '', '', ''],
    /* False is an AM4: its chain carries no names, only its summary does. */
    namesInChain: true,
    blocks: [
      { slug: 'drive', name: 'Drive 1', effectId: 133, bypassed: true, channel: 'A' },
      { slug: 'amp', name: 'Amp 1', effectId: 58, bypassed: false, channel: 'A' }
    ],
    ...over
  }
  const wire = []
  /* Scene names this window kept for a slot, for good. */
  const kept = []
  /* When each request reached the computer, and `unit.lag` how long it took over it. */
  const heard = []
  const answer = async (line, value) => {
    wire.push(line)
    heard.push([clock.now(), line])
    const lag = unit.lag?.(line)
    if (lag) await new Promise((go) => clock.setTimeout(go, lag))
    await null
    return typeof value === 'function' ? value() : value
  }
  const nameOf = (n) => `SONG ${n}`
  const clock = handClock()
  ds.reset()
  ds.attachClock(clock)
  ds.attachDriver({
    presetBlocks: () => answer(CHAIN, () => (unit.chain ? unit.chain() : unit.blocks.map((b) => ({ ...b })))),
    sceneState: () =>
      answer(STATE, () =>
        unit.status ? unit.status() : unit.blocks.map((b) => ({ effectId: b.effectId, bypassed: b.bypassed, channel: b.channel }))
      ),
    currentPreset: () =>
      answer(WHICH, () => (unit.which ? unit.which() : { number: unit.number, name: unit.presetName ?? nameOf(unit.number) })),
    selectPreset: (n) =>
      answer('POST /preset/select', () => {
        if (unit.refuseSelect) throw Object.assign(new Error('The unit refused that preset.'), { status: 409 })
        unit.number = n
        return { ok: true }
      }),
    getScene: () => answer('GET /scene', () => ({ index: unit.scene })),
    setScene: (i) => answer('POST /scene', () => ((unit.scene = i), { ok: true })),
    setBypass: (eid) => answer(`POST /preset/blocks/${eid}/bypass`, () => (unit.hold ? unit.hold() : { ok: true })),
    getTempo: () => answer('GET /tempo', { bpm: 120 }),
    setTempo: () => answer('POST /tempo', { ok: true }),
    setTuner: () => answer('POST /tuner', { ok: true }),
    /* What forgefx.readSceneNames asks first: the stored slot, dumped. */
    readSceneNames: (n) => answer(`GET /presets/${n}/summary`, () => [...unit.scenes]),
    /* The computer's copy of the loaded preset, which the chain and its scene names come out of. */
    presetCopy: () =>
      answer('GET /preset/grid', () =>
        unit.copy ? unit.copy() : { name: unit.presetName ?? nameOf(unit.number), scenes: unit.namesInChain ? [...unit.scenes] : [] }
      ),
    keepSceneNames: (n, names) => kept.push([n, [...names]]),
    rememberedSceneNames: (n) => unit.keptNames?.[n] || [],
    /* Which unit a remembered chain is filed under; see deviceState.knownChain. */
    unitKey: () => unit.unitKey ?? 'rig:fm3',
    /* A gen-3 by default: the computer's copy of the preset is free to read again. */
    hostKeepsCopy: () => (unit.keepsCopy === undefined ? true : unit.keepsCopy),
    /* A stored slot decoded without loading it — only where a test hands one over. See readAhead. */
    ...(unit.summary ? { presetSummary: (n) => answer(`GET /presets/${n}/summary`, () => unit.summary(n)) } : {}),
    /* What a status read's ids are named by ahead of the chain read; none on an AM4. See drawOutline. */
    outlineCatalog: () => (unit.outlines === false || unit.keepsCopy === false ? null : BLOCK_CATALOG),
    /* The event stream; `unit.gap()` is it dropping. */
    subscribeEvents: (fn, { onGap } = {}) => {
      unit.gap = () => onGap?.()
      return () => {}
    }
  })
  ds.put({
    preset: { number: unit.number, name: unit.presetName ?? nameOf(unit.number) },
    blocks: unit.blocks.map((b) => ({ ...b })),
    sceneIndex: unit.scene,
    sceneNames: [...unit.scenes]
  })
  ds.chainWasRead(unit.number)
  const asked = (line) => wire.filter((l) => (line instanceof RegExp ? line.test(l) : l === line)).length
  return { clock, unit, wire, asked, nameOf, kept, heard }
}

/* Registered at the top level like every other test; the clock goes back afterwards. */
const onTheBench = (name, body) =>
  test(name, async () => {
    try {
      await body()
    } finally {
      ds.reset()
      ds.attachClock(null)
    }
  })

/*
 * THE PRESETS EITHER SIDE. "The amp pedal names are blank for about half a
 * second... preload the previous preset and preload the next preset with
 * those names so it instantly changes." Play says where Previous and Next
 * would land; the store reads those slots once the unit is quiet, one at a
 * time, and a tap on one puts its pedals up at once — as an outline, because
 * a summary does not say which are on, and the status read and the chain read
 * still go and replace it.
 */
onTheBench('Previous and Next never read another slot — reading one moved the computer’s idea of the loaded preset', async () => {
  /* Justin's log: on 507, the unit "changed" to 508, then 506, then 508 —
     the two slots either side, read ahead. See READ_AHEAD_ON. */
  const { clock, asked } = windowOnTheBench({ summary: (n) => ({ number: n, name: `SONG ${n}`, blocks: [{ effectId: 58, slug: 'amp', name: 'Amp' }] }) })
  ds.readAhead([13, 11])
  await clock.advance(ds.READ_AHEAD_MS * 10)
  assert.equal(asked(SUMMARY), 0, 'a slot other than the loaded one was read ahead')
  const load = ds.loadPreset(13)
  await clock.advance(ds.OWN_SETTLE_MS + 100)
  await load
  assert.equal(ds.chainViewOf(ds.getSnapshot()), 'ready', 'a preset change does not still work without the read-ahead')
  assert.equal(asked(SUMMARY), 0)
})

onTheBench('a slot nothing can be read ahead for waits for the status read, as before', async () => {
  const { clock } = windowOnTheBench()
  ds.readAhead([13])
  await clock.advance(ds.READ_AHEAD_MS * 3)
  const load = ds.loadPreset(13)
  assert.equal(ds.chainViewOf(ds.getSnapshot()), 'loading', 'a preset never read had pedals on the tap')
  await clock.advance(ds.OWN_SETTLE_MS + 100)
  await load
  assert.equal(ds.chainViewOf(ds.getSnapshot()), 'ready')
})

test('the read-ahead goes one slot at a time, waits for quiet, and stops for a unit that cannot', async () => {
  const { createReadAhead } = await import('../shared/chain-outline.mjs')
  const clock = handClock()
  const reads = []
  let quiet = false
  let refuse = false
  const kept = new Map()
  const ahead = createReadAhead({
    read: async (n) => {
      reads.push(n)
      if (refuse) throw Object.assign(new Error('no dump here'), { status: 501 })
      return [{ slug: 'amp', effectId: 58 }]
    },
    has: (n) => kept.has(n),
    keep: (n, list) => kept.set(n, list),
    ready: () => quiet,
    wait: (go, ms) => clock.setTimeout(go, ms),
    clear: (t) => clock.clearTimeout(t),
    after: 1000
  })
  ahead.want([5, 3, 5, null, -1])
  await clock.advance(5000)
  assert.deepEqual(reads, [], 'a slot was read while the unit was busy')
  quiet = true
  await clock.advance(1100)
  assert.deepEqual(reads, [5], 'not the first slot first, or not one at a time')
  await clock.advance(1100)
  assert.deepEqual(reads, [5, 3])
  ahead.want([7, 3])
  refuse = true
  await clock.advance(1100)
  ahead.want([9])
  await clock.advance(5000)
  assert.deepEqual(reads, [5, 3, 7], 'a unit that has no such read was asked again')
})

onTheBench('a scene tapped in the Mac window costs one small read and no preset dump', async () => {
  const { clock, asked } = windowOnTheBench()
  /* The computer's announcement lands before the tap's own answer, as it can. */
  const tap = ds.writeScene(2)
  ds.handleEvent({ type: 'scene', index: 2 })
  await tap
  await clock.advance(ds.OWN_ECHO_MS - 100)
  assert.equal(asked(CHAIN), 0, 'a scene tap still makes the unit dump the whole preset')
  assert.equal(asked(SUMMARY), 0, 'a scene tap reads a stored slot')
  assert.equal(asked(STATE), 1, 'a scene tap should cost exactly the one status read')
  assert.equal(asked(WHICH), 0, 'the window asked which preset is loaded after its own scene tap')
  assert.equal(ds.getSnapshot().sceneIndex, 2)

  /* The same scene said AGAIN is somebody else — a footswitch — and is followed. */
  ds.handleEvent({ type: 'scene', index: 2 })
  await clock.advance(100)
  assert.equal(asked(STATE), 2, 'one announcement paid off two taps')
  assert.equal(asked(CHAIN), 0)
})

onTheBench('an effect tapped in the Mac window makes no chain read at all', async () => {
  const { clock, asked } = windowOnTheBench()
  await ds.writeBypass(133, false)
  /* The computer calls a bypass a change to the chain. It is this tap. */
  ds.handleEvent({ type: 'changed', scope: 'grid' })
  await clock.advance(3000)
  assert.equal(asked(CHAIN), 0, 'an effect tap makes the unit dump the whole preset')
  assert.ok(asked(STATE) <= 1, `an effect tap cost ${asked(STATE)} status reads`)
  assert.equal(ds.getSnapshot().blocks.find((b) => b.effectId === 133).bypassed, false, 'the tile did not keep what was sent')

  /* A tap never announced does not swallow a real change for good. */
  await ds.writeBypass(133, true)
  await clock.advance(ds.OWN_ECHO_MS + 100)
  ds.handleEvent({ type: 'changed', scope: 'grid' })
  await clock.advance(ds.PRESET_SETTLE_MS + 100)
  assert.equal(asked(CHAIN), 1, 'a stale expectation hid a change made by somebody else')
})

onTheBench('a block moved by another client still reads the chain in the Mac window', async () => {
  const { clock, unit, asked } = windowOnTheBench()
  unit.blocks = [...unit.blocks, { slug: 'delay', name: 'Delay 1', effectId: 70, bypassed: false, channel: 'A' }]
  ds.handleEvent({ type: 'changed', scope: 'grid' })
  await clock.advance(100)
  assert.equal(asked(CHAIN), 0, 'the chain was read in the same moment the unit changed')
  await clock.advance(ds.PRESET_SETTLE_MS)
  assert.equal(asked(CHAIN), 1, 'a structural change from another client no longer reaches the window')
  assert.ok(ds.getSnapshot().blocks.some((b) => b.slug === 'delay'), 'the new block is not on screen')
})

onTheBench('a scene from the phone or a footswitch is the status read and which preset, never the chain', async () => {
  const { clock, unit, asked } = windowOnTheBench()
  unit.scene = 3
  unit.blocks = unit.blocks.map((b) => (b.slug === 'drive' ? { ...b, bypassed: false } : b))
  ds.handleEvent({ type: 'scene', index: 3 })
  await clock.advance(20000)
  assert.equal(ds.getSnapshot().sceneIndex, 3)
  assert.equal(asked(STATE), 1, 'the lit blocks were not re-read for the new scene')
  assert.equal(asked(WHICH), 1, 'nothing checked whether the preset changed with the scene')
  assert.equal(asked(CHAIN), 0, 'a scene from somewhere else makes the unit dump the whole preset')
  assert.equal(ds.getSnapshot().blocks.find((b) => b.slug === 'drive').bypassed, false, 'the scene’s bypass states are not on screen')
})

onTheBench('a preset changed at the front panel is named at once in the Mac window, and its chain read once', async () => {
  const { clock, unit, asked, nameOf } = windowOnTheBench()
  /* Well after the last read, so the computer's own copy has run out. */
  await clock.advance(20000)
  unit.number = 40
  unit.scene = 1
  unit.scenes = ['INTRO', 'SOLO', '', '', '', '', '', '']
  ds.handleEvent({ type: 'scene', index: 1 })
  await clock.advance(10)
  assert.equal(ds.getSnapshot().preset.number, 40, 'the preset changed on the unit and the window did not notice')
  assert.equal(ds.getSnapshot().preset.name, nameOf(40), 'the old song’s name is still on screen')
  assert.equal(asked(CHAIN), 0, 'the chain was read while the unit was still loading')
  await clock.advance(ds.PRESET_SETTLE_MS - 200)
  assert.equal(asked(CHAIN), 0, 'the chain read did not wait for the unit to settle')
  await clock.advance(400)
  assert.equal(asked(CHAIN), 1, 'the new preset’s chain was never read')
  await clock.advance(30000)
  assert.equal(asked(CHAIN), 1, `a front-panel preset change cost ${asked(CHAIN)} chain reads`)
  assert.equal(asked(SUMMARY), 0, 'the loaded slot was dumped a second time for its scene names')
  assert.deepEqual(ds.getSnapshot().sceneNames.slice(0, 2), ['INTRO', 'SOLO'], 'the new preset’s scene names are not on the tiles')

  /* Inside the computer's copy, the one read waits it out rather than
     putting the last song's blocks under this song's name. */
  await ds.refreshBlocks()
  const before = asked(CHAIN)
  unit.number = 41
  unit.scene = 2
  ds.handleEvent({ type: 'scene', index: 2 })
  await clock.advance(ds.CHAIN_FRESH_MS - 1000)
  assert.equal(ds.getSnapshot().preset.number, 41)
  assert.equal(asked(CHAIN), before, 'the chain was read out of the computer’s copy of the last preset')
  await clock.advance(2000)
  assert.equal(asked(CHAIN), before + 1)
})

onTheBench('the timed check in the Mac window notices a front-panel preset with no scene change', async () => {
  const { clock, unit, asked, nameOf } = windowOnTheBench()
  /* The check runs every few seconds; this one lands after the computer's
     own copy of the last chain has run out. */
  await clock.advance(20000)
  unit.number = 77
  /* What App's timed check does with its GET /preset answer. */
  assert.equal(ds.presetHeard({ number: 77, name: nameOf(77) }), true)
  assert.equal(ds.getSnapshot().preset.name, nameOf(77))
  await clock.advance(ds.PRESET_SETTLE_MS + 100)
  assert.equal(asked(CHAIN), 1, 'the new preset’s chain was not read once')
  /* The same answer again is not a change. */
  assert.equal(ds.presetHeard({ number: 77, name: nameOf(77) }), false)
  await clock.advance(30000)
  assert.equal(asked(CHAIN), 1, 'the timed check reads the chain when nothing changed')
})

onTheBench('the phone choosing a preset costs the Mac window one late chain read', async () => {
  const { clock, unit, asked, nameOf } = windowOnTheBench()
  unit.number = 60
  ds.handleEvent({ type: 'changed', scope: 'preset' })
  await clock.advance(10)
  assert.equal(ds.getSnapshot().preset.name, nameOf(60))
  assert.equal(asked(CHAIN), 0)
  await clock.advance(ds.PRESET_SETTLE_MS + 100)
  assert.equal(asked(CHAIN), 1)
  await clock.advance(30000)
  assert.equal(asked(CHAIN), 1)
  assert.equal(asked(SUMMARY), 0, 'the window dumped the slot the phone had just loaded')
})

onTheBench('presses of Next in the Mac window read the chain once, for where they landed', async () => {
  const { clock, asked, wire } = windowOnTheBench()
  const taps = [ds.loadPreset(13), ds.loadPreset(14), ds.loadPreset(15)]
  for (let i = 0; i < 3; i++) ds.handleEvent({ type: 'changed', scope: 'preset' })
  /* The unit opening the new preset on another scene, noticed by the computer. */
  ds.handleEvent({ type: 'scene', index: 4 })
  await clock.advance(3000)
  await Promise.all(taps)
  assert.equal(ds.getSnapshot().preset.number, 15)
  assert.equal(asked(CHAIN), 1, `three quick presses cost ${asked(CHAIN)} chain reads`)
  assert.equal(asked('POST /preset/select'), 3, 'a press was not sent')
  assert.equal(asked(SUMMARY), 0)
  /* One status read: the pedals of where they landed, drawn ahead of the chain. */
  assert.equal(asked(STATE), 1, 'the scene the new preset opened on was read on its own, mid-load')

  /* Spaced out, the way a thumb does it. */
  wire.length = 0
  ds.loadPreset(16)
  await clock.advance(300)
  ds.loadPreset(17)
  await clock.advance(300)
  ds.loadPreset(18)
  await clock.advance(3000)
  assert.equal(ds.getSnapshot().preset.number, 18)
  assert.equal(asked(CHAIN), 1, `three presses 300ms apart cost ${asked(CHAIN)} chain reads`)
})

onTheBench('a preset chosen in the Mac window costs one chain read, and Play appearing adds nothing', async () => {
  const { clock, asked, wire } = windowOnTheBench()
  /* What Gig does when it appears or the slot changes. See its preset effect. */
  const arrive = async () => {
    const pending = ds.presetReadPending()
    if (pending) return pending
    if (!ds.chainIsCurrent()) await ds.refreshBlocks()
  }
  const load = ds.loadPreset(20)
  ds.handleEvent({ type: 'changed', scope: 'preset' })
  const waiting = arrive()
  await clock.advance(ds.OWN_SETTLE_MS - 100)
  assert.equal(asked(CHAIN), 0, 'the chain was read before the unit had settled')
  await clock.advance(3000)
  await load
  assert.ok(Array.isArray(await waiting), 'Play waited on the preset read and was not handed the chain')
  await arrive()
  assert.equal(asked(CHAIN), 1, `a preset change cost ${asked(CHAIN)} chain reads`)
  assert.equal(asked(SUMMARY), 0, 'the loaded slot was dumped again for names its chain read already carried')
  assert.equal(asked('DELETE /device/cache'), 0)
  assert.deepEqual(
    wire,
    ['POST /preset/select', WHICH, 'GET /scene', STATE, CHAIN, 'GET /preset/grid', 'GET /tempo'],
    'a preset change is not the select, which preset, which scene, the pedals and one chain read'
  )
  assert.equal(ds.getSnapshot().sceneNames[0], 'VERSE')
  /* Long after, appearing does read — the copy is not current any more. */
  await clock.advance(ds.CHAIN_FRESH_MS + 1000)
  assert.equal(ds.chainIsCurrent(), false)
})

/*
 * "Presets are loading much slower now when switching, taking about 3 seconds
 * to load scene name and pedals." The same in this window: a preset loaded
 * here before goes up on the tap, name, scene names and chain, and the one
 * chain read after the switch still goes when it did.
 */
const windowTwoSongs = (unit) => {
  const chains = {
    12: unit.blocks,
    20: [
      { slug: 'comp', name: 'Compressor 1', effectId: 150, bypassed: false, channel: 'A' },
      { slug: 'delay', name: 'Delay 1', effectId: 70, bypassed: false, channel: 'B' }
    ]
  }
  unit.chain = () => (chains[unit.number] || []).map((b) => ({ ...b }))
  return chains
}
const effectIds = (list) => list.map((b) => b.effectId)

onTheBench('a preset loaded in the Mac window before is back on the tap, chain and names, for one chain read', async () => {
  const { clock, unit, asked, wire, nameOf } = windowOnTheBench({ keptNames: { 20: ['INTRO', 'SOLO', '', '', '', '', '', ''] } })
  const chains = windowTwoSongs(unit)
  /* The first time: the cards, and the kept names once the unit has said which preset it is on. */
  ds.loadPreset(20)
  assert.equal(ds.chainViewOf(ds.getSnapshot()), 'loading', 'a preset never read showed a chain')
  await clock.advance(3000)
  assert.equal(asked(CHAIN), 1)
  ds.loadPreset(12)
  await clock.advance(3000)
  assert.equal(asked(CHAIN), 2)

  /* Back to 20: up on the tap, before the unit has answered anything. */
  unit.lag = (line) => (line === 'POST /preset/select' ? 300 : 0)
  wire.length = 0
  ds.loadPreset(20)
  await clock.advance(0)
  const s = ds.getSnapshot()
  assert.deepEqual(wire, ['POST /preset/select'])
  assert.equal(s.preset?.number, 20, 'the preset tapped is not on screen until the unit answers')
  assert.equal(s.preset?.name, nameOf(20))
  assert.deepEqual(s.sceneNames.slice(0, 2), ['INTRO', 'SOLO'], 'the kept scene names wait for the unit')
  assert.deepEqual(effectIds(s.blocks), [150, 70], 'the chain up on the tap is not the one this preset had')
  assert.equal(ds.chainViewOf(s), 'ready', 'a preset read a moment ago waits behind the grey cards')
  await clock.advance(ds.OWN_SETTLE_MS - 100)
  assert.equal(asked(CHAIN), 0, 'the chain up from memory made the unit dump the preset while it loaded')
  await clock.advance(3000)
  assert.equal(asked(CHAIN), 1, `a known preset cost ${asked(CHAIN)} chain reads`)
  assert.equal(ds.getSnapshot().chainKnown, null, 'the read after the switch did not confirm the chain')
  /* The unit's own names, out of the copy, still go over the kept ones. */
  assert.deepEqual(ds.getSnapshot().sceneNames.slice(0, 2), ['VERSE', 'CHORUS'])

  /* A chain that changed on the unit meanwhile: the read replaces it. */
  unit.lag = null
  ds.loadPreset(12)
  await clock.advance(3000)
  chains[20] = [{ slug: 'reverb', name: 'Reverb 1', effectId: 66, bypassed: false, channel: 'A' }]
  ds.loadPreset(20)
  assert.deepEqual(effectIds(ds.getSnapshot().blocks), [150, 70])
  await clock.advance(3000)
  assert.deepEqual(effectIds(ds.getSnapshot().blocks), [66], 'the read after the switch did not replace a chain that had changed')
})

onTheBench('the Mac window counts the wait before the chain read from the select', async () => {
  const { clock, unit, heard } = windowOnTheBench()
  unit.lag = (line) => (line === 'POST /preset/select' || line === WHICH || line === 'GET /scene' ? 200 : 0)
  ds.loadPreset(20)
  await clock.advance(5000)
  const at = (line) => heard.find(([, l]) => l === line)?.[0]
  const waited = at(CHAIN) - at('POST /preset/select')
  assert.ok(at('GET /scene') - at('POST /preset/select') >= 400)
  assert.ok(waited >= ds.OWN_SETTLE_MS, `the chain was read ${waited}ms after the select, before the unit had settled`)
  assert.ok(waited < ds.OWN_SETTLE_MS + 200, `the chain was read ${waited}ms after the select: the wait began after the small reads`)
})

onTheBench('the Mac window does not put up a chain it changed, saved over, or that is not this preset’s', async () => {
  const { clock, unit, nameOf } = windowOnTheBench()
  const chains = windowTwoSongs(unit)
  const visit = async (n) => {
    ds.loadPreset(n)
    await clock.advance(3000)
  }
  await visit(20)
  await visit(12)
  /* A block added, moved or removed on 12. */
  ds.chainChanged()
  await visit(20)
  ds.loadPreset(12)
  assert.equal(ds.chainViewOf(ds.getSnapshot()), 'loading', 'a chain edited here was put up from memory')
  await clock.advance(3000)
  /* A save over 20. */
  ds.presetSaved(20, nameOf(20))
  await clock.advance(ds.SETTLING_MS * ds.SETTLING_TRIES + 1000)
  ds.loadPreset(20)
  assert.equal(ds.chainViewOf(ds.getSnapshot()), 'loading', 'a chain from before a save over the slot was put up')
  await clock.advance(3000)
  await visit(12)

  /* The computer answering out of its copy of 12: the known chain stays up, live. */
  unit.copy = () => ({ name: nameOf(12), scenes: [...unit.scenes] })
  const real = chains[20]
  chains[20] = chains[12]
  ds.loadPreset(20)
  await clock.advance(3000)
  assert.deepEqual(effectIds(ds.getSnapshot().blocks), effectIds(real), 'the last song’s blocks went up under this song’s name')
  assert.equal(ds.chainViewOf(ds.getSnapshot()), 'ready')
  unit.copy = null
  chains[20] = real
  await clock.advance(ds.CHAIN_FRESH_MS + 1000)
  assert.equal(ds.getSnapshot().chainKnown, null)

  /* A refused select puts back what was up, preset and chain together. */
  unit.refuseSelect = true
  await assert.rejects(ds.loadPreset(12))
  assert.equal(ds.getSnapshot().preset.number, 20)
  assert.deepEqual(effectIds(ds.getSnapshot().blocks), effectIds(real), 'a refused select left the other preset’s chain up')
  assert.equal(ds.chainViewOf(ds.getSnapshot()), 'ready')
})

onTheBench('a remembered chain goes when the read cannot confirm it, or the unit is on another preset', async () => {
  const { clock, unit, nameOf } = windowOnTheBench()
  const chains = windowTwoSongs(unit)
  const visit = async (n) => {
    ds.loadPreset(n)
    await clock.advance(3000)
  }
  await visit(20)
  await visit(12)
  /* The unit never left 12: the chain up for 20 is not put under 12's name. */
  unit.which = () => ({ number: 12, name: nameOf(12) })
  unit.presetName = nameOf(12)
  unit.chain = () => chains[12].map((b) => ({ ...b }))
  ds.loadPreset(20)
  assert.equal(ds.getSnapshot().chainKnown, 20)
  await clock.advance(3000)
  const s = ds.getSnapshot()
  assert.equal(s.preset.number, 12)
  assert.deepEqual(effectIds(s.blocks), effectIds(chains[12]), 'another preset’s chain is on screen under this one’s name')
  assert.equal(ds.chainViewOf(s), 'ready')
  unit.which = null
  unit.presetName = undefined
  unit.chain = () => (chains[unit.number] || []).map((b) => ({ ...b }))
  /* A read that fails: the chain up from memory is not left standing as this preset's. */
  await visit(20)
  await visit(12)
  unit.chain = () => null
  ds.loadPreset(20)
  assert.equal(ds.chainViewOf(ds.getSnapshot()), 'ready')
  await clock.advance(ds.OWN_SETTLE_MS + ds.SETTLE_MS * ds.SETTLE_TRIES + 3000)
  assert.equal(ds.getSnapshot().chainKnown, null)
  assert.notEqual(ds.chainViewOf(ds.getSnapshot()), 'ready', 'an unconfirmed chain stayed up after its read failed')
})

onTheBench('a remembered chain belongs to one unit', async () => {
  const { clock, unit } = windowOnTheBench()
  windowTwoSongs(unit)
  ds.loadPreset(20)
  await clock.advance(3000)
  ds.loadPreset(12)
  await clock.advance(3000)
  /* The same slot on the demo, or on another unit: nothing is known. */
  unit.unitKey = 'demo:fm3'
  ds.loadPreset(20)
  assert.equal(ds.chainViewOf(ds.getSnapshot()), 'loading', 'one unit’s chain was put up on another')
  await clock.advance(3000)
})

onTheBench('when only the summary has the names, the Mac window asks it once and after the chain', async () => {
  const { clock, asked, wire } = windowOnTheBench({ namesInChain: false })
  ds.loadPreset(21)
  ds.handleEvent({ type: 'changed', scope: 'preset' })
  await clock.advance(3000)
  assert.equal(asked(CHAIN), 1)
  assert.equal(asked(SUMMARY), 1, `the summary was asked ${asked(SUMMARY)} times`)
  assert.ok(wire.indexOf(CHAIN) < wire.findIndex((l) => SUMMARY.test(l)), 'the summary dump went out alongside the chain dump')
})

onTheBench('a unit that answers the Mac window early with the preset it is leaving is asked again', async () => {
  const { clock, unit, nameOf } = windowOnTheBench()
  let early = true
  const was = unit.number
  const select = ds.loadPreset(30)
  Object.defineProperty(unit, 'number', {
    configurable: true,
    get: () => (early ? was : 30),
    set: () => {}
  })
  await clock.advance(10)
  early = false
  await clock.advance(3000)
  await select
  assert.equal(ds.getSnapshot().preset.number, 30, 'the unit’s early answer stayed on screen')
  assert.equal(ds.getSnapshot().preset.name, nameOf(30), 'the preset was not asked for again once the unit settled')
})

onTheBench('an effect tapped on the phone costs the Mac window the status read, not the chain', async () => {
  /*
   * The computer announces the phone's bypass to the Mac window as "the chain
   * changed", with nothing to say it was the phone. Read as news, that was a
   * whole preset dump on every phone effect tap while the Mac app was open.
   */
  const { clock, unit, asked } = windowOnTheBench()
  unit.blocks = unit.blocks.map((b) => (b.effectId === 133 ? { ...b, bypassed: false } : b))
  ds.handleEvent({ type: 'changed', scope: 'grid' })
  await clock.advance(ds.PRESET_SETTLE_MS + 500)
  assert.equal(asked(CHAIN), 0, 'a phone effect tap made the Mac window dump the whole preset')
  assert.equal(asked(STATE), 1)
  assert.equal(ds.getSnapshot().blocks.find((b) => b.effectId === 133).bypassed, false, 'the phone’s switch is not on the Mac’s tile')

  /* Two quick switches: still no chain. */
  unit.blocks = unit.blocks.map((b) => ({ ...b, bypassed: !b.bypassed }))
  ds.handleEvent({ type: 'changed', scope: 'grid' })
  ds.handleEvent({ type: 'changed', scope: 'grid' })
  await clock.advance(ds.PRESET_SETTLE_MS + 500)
  assert.equal(asked(CHAIN), 0, `two switches made on the phone cost ${asked(CHAIN)} chain reads`)

  /* A block the status read lists that nobody has seen was added: one chain read, later. */
  unit.blocks = [...unit.blocks, { slug: 'delay', name: 'Delay 1', effectId: 70, bypassed: false, channel: 'A' }]
  ds.handleEvent({ type: 'changed', scope: 'grid' })
  await clock.advance(100)
  assert.equal(asked(CHAIN), 0)
  ds.handleEvent({ type: 'changed', scope: 'grid' })
  await clock.advance(ds.PRESET_SETTLE_MS + 500)
  assert.equal(asked(CHAIN), 1, `a block added elsewhere cost ${asked(CHAIN)} chain reads`)
})

onTheBench('a status read the unit could not answer in time is not turned into a dump in the Mac window', async () => {
  const { clock, unit, asked } = windowOnTheBench()
  unit.status = () => []
  await ds.writeScene(2)
  await clock.advance(ds.OWN_ECHO_MS + 100)
  assert.equal(asked(CHAIN), 0, 'an empty status answer after a scene tap dumped the whole preset')
  unit.status = () => {
    throw Object.assign(new Error('timed out'), { status: 503 })
  }
  await ds.writeScene(3)
  await clock.advance(100)
  assert.equal(asked(CHAIN), 0, 'a status read that timed out dumped the whole preset')
  /* A computer that has no such read, or answers it with its web page, still gets the chain. */
  unit.status = () => {
    throw Object.assign(new Error('unsupported'), { status: 501 })
  }
  await ds.writeScene(4)
  await clock.advance(100)
  assert.equal(asked(CHAIN), 1, 'a computer without the status read gets no chain at all')
  unit.status = () => '<!doctype html>'
  await ds.writeScene(5)
  await clock.advance(100)
  assert.equal(asked(CHAIN), 2, 'an older computer that answers with its page gets no chain at all')
})

onTheBench('a chain the Mac window could not read after a preset change is not followed by more dumps', async () => {
  const { clock, unit, asked } = windowOnTheBench()
  unit.chain = () => null
  ds.loadPreset(21)
  ds.handleEvent({ type: 'changed', scope: 'preset' })
  await clock.advance(5000)
  assert.ok(asked(CHAIN) >= 1)
  assert.equal(asked('GET /preset/grid'), 0, 'the names were asked out of a copy the failed read never left')
  assert.equal(asked(SUMMARY), 0, 'the slot was dumped for its names after the chain read failed')
})

onTheBench('the Mac window neither shows nor keeps scene names out of another preset’s copy', async () => {
  const { clock, unit, asked, nameOf, kept } = windowOnTheBench()
  unit.copy = () => ({ name: nameOf(12), scenes: ['VERSE', 'CHORUS', '', '', '', '', '', ''] })
  ds.loadPreset(40)
  ds.handleEvent({ type: 'changed', scope: 'preset' })
  await clock.advance(3000)
  assert.equal(asked(CHAIN), 1)
  assert.equal(kept.length, 0, 'the last song’s scene names were kept under this one')
  assert.ok(!ds.getSnapshot().sceneNames.some((n) => n), 'the last song’s scene names are on this song’s tiles')
  assert.equal(ds.chainIsCurrent(), false, 'a chain out of another preset’s copy counts as current')
  assert.equal(asked(SUMMARY), 0)
  unit.copy = null
  unit.scenes = ['INTRO', 'SOLO', '', '', '', '', '', '']
  await clock.advance(ds.CHAIN_FRESH_MS + 300)
  assert.equal(asked(CHAIN), 2, 'the chain out of the wrong copy was not read again once it ran out')
  assert.deepEqual(ds.getSnapshot().sceneNames.slice(0, 2), ['INTRO', 'SOLO'])
  assert.deepEqual(kept, [[40, ['INTRO', 'SOLO', '', '', '', '', '', '']]])
})

onTheBench('a preset read that finishes first does not say a newer one is done', async () => {
  const { clock, unit } = windowOnTheBench()
  /* The first read retries a busy unit; the second tap's read is still going when the first gives up. */
  let calls = 0
  let release = null
  unit.chain = () => {
    calls += 1
    if (calls === 3) return new Promise((done) => (release = () => done(unit.blocks.map((b) => ({ ...b })))))
    return null
  }
  ds.loadPreset(13)
  await clock.advance(ds.OWN_SETTLE_MS + 100)
  ds.loadPreset(14)
  await clock.advance(ds.SETTLE_MS * 2 + 200)
  assert.equal(calls, 4, 'the reads did not overlap the way this test means them to')
  assert.ok(ds.presetReadPending(), 'the first read finishing said the second one was done')
  assert.equal(ds.chainIsCurrent(), true)
  unit.chain = null
  release()
  await clock.advance(100)
  assert.equal(ds.presetReadPending(), null)
})

onTheBench('a scene heard while the Mac window finishes a preset read still gets its status read', async () => {
  const { clock, unit, asked, nameOf } = windowOnTheBench()
  let release = null
  unit.copy = () => new Promise((done) => (release = () => done({ name: nameOf(22), scenes: [...unit.scenes] })))
  ds.loadPreset(22)
  ds.handleEvent({ type: 'changed', scope: 'preset' })
  await clock.advance(ds.OWN_SETTLE_MS + 100)
  assert.equal(asked(CHAIN), 1)
  /* The one status read so far is the pedals, drawn ahead of the chain. */
  assert.equal(asked(STATE), 1)
  unit.scene = 5
  ds.handleEvent({ type: 'scene', index: 5 })
  await clock.advance(100)
  assert.equal(asked(STATE), 1)
  unit.copy = null
  release()
  await clock.advance(1000)
  assert.equal(asked(STATE), 2, 'a footswitch scene during the end of a preset read was dropped')
  assert.equal(asked(CHAIN), 1)
  assert.equal(asked(SUMMARY), 0)
})

onTheBench('a slow effect tap in the Mac window is still this tap when its announcement comes first', async () => {
  const { clock, unit, asked } = windowOnTheBench()
  let release = null
  unit.hold = () => new Promise((done) => (release = () => done({ ok: true })))
  const tap = ds.writeBypass(133, false)
  await clock.advance(1900)
  ds.handleEvent({ type: 'changed', scope: 'grid' })
  await clock.advance(100)
  unit.hold = null
  release()
  await tap
  await clock.advance(3000)
  assert.equal(asked(CHAIN), 0, 'a slow effect tap was taken for a change from another client')
  assert.equal(asked(STATE), 0)
})

/* What the unit is holding for each block, as its status read answers it. */
const statusOf = (unit) => unit.blocks.map((b) => ({ effectId: b.effectId, bypassed: b.bypassed, channel: b.channel }))
const timedOut = () => Object.assign(new Error('The unit did not answer in time.'), { status: 503 })

onTheBench('a status read the Mac window missed after a scene is asked once more, and the tiles follow the scene', async () => {
  const { clock, unit, asked, wire } = windowOnTheBench()
  ds.listen()
  /* Read while listening, so the chain on screen counts as followed. */
  await ds.refreshBlocks()
  wire.length = 0
  unit.blocks = unit.blocks.map((b) => (b.effectId === 133 ? { ...b, bypassed: false } : b))
  let asks = 0
  unit.status = () => (asks++ ? statusOf(unit) : [])
  await ds.writeScene(2)
  await clock.advance(ds.SCENE_RETRY_MS + 100)
  assert.equal(asked(STATE), 2, 'a status read that missed was never asked again')
  assert.equal(ds.getSnapshot().blocks.find((b) => b.effectId === 133).bypassed, false, 'the tiles kept the last scene’s on and off')
  assert.equal(asked(CHAIN), 0)

  /* A footswitch whose status read timed out, the same. */
  asks = 0
  unit.status = () => {
    if (!asks++) throw timedOut()
    return statusOf(unit)
  }
  unit.blocks = unit.blocks.map((b) => (b.effectId === 58 ? { ...b, bypassed: true } : b))
  ds.handleEvent({ type: 'scene', index: 4 })
  await clock.advance(ds.SCENE_RETRY_MS + 100)
  assert.equal(ds.getSnapshot().blocks.find((b) => b.effectId === 58).bypassed, true, 'a footswitch whose status read timed out left the last scene on the tiles')
  assert.equal(asked(CHAIN), 0)

  /* Missed twice: no dump, but the chain no longer counts as followed. */
  assert.equal(ds.chainFollowed(), true)
  unit.status = () => []
  ds.handleEvent({ type: 'scene', index: 5 })
  await clock.advance(5000)
  assert.equal(asked(CHAIN), 0, 'a status read that missed twice dumped the preset')
  assert.equal(ds.chainFollowed(), false, 'tiles the status read never confirmed count as followed')
})

onTheBench('after a preset read that failed, a footswitch in the Mac window reads the chain, not the new states over the old song', async () => {
  const { clock, unit, asked } = windowOnTheBench()
  unit.chain = () => null
  ds.loadPreset(21)
  await clock.advance(ds.OWN_SETTLE_MS + ds.SETTLE_MS * 3 + 500)
  const tries = asked(CHAIN)
  assert.ok(tries >= 1)
  /* The pedals drawn ahead of it were never confirmed, so they went with it. */
  assert.notEqual(ds.chainViewOf(ds.getSnapshot()), 'outline', 'pedals drawn ahead of a chain read that failed stayed up')
  const listed = asked(STATE)
  unit.chain = null
  unit.blocks = [{ slug: 'delay', name: 'Delay 1', effectId: 70, bypassed: false, channel: 'B' }, unit.blocks[1]]
  ds.handleEvent({ type: 'scene', index: 3 })
  await clock.advance(100)
  assert.equal(asked(STATE), listed, 'the new preset’s states were laid over the last song’s tiles')
  await clock.advance(ds.PRESET_SETTLE_MS + 100)
  assert.equal(asked(CHAIN), tries + 1, 'the tiles stayed on the last song after a footswitch')
  assert.ok(ds.getSnapshot().blocks.some((b) => b.slug === 'delay'))
  ds.handleEvent({ type: 'scene', index: 4 })
  await clock.advance(ds.PRESET_SETTLE_MS + 100)
  assert.equal(asked(STATE), listed + 1, 'this preset’s footswitch is not the status read again')
  assert.equal(asked(CHAIN), tries + 1)
})

onTheBench('a preset tap the unit refuses in the Mac window does not call off the read a stale copy was owed', async () => {
  const { clock, unit, asked, nameOf } = windowOnTheBench()
  unit.copy = () => ({ name: nameOf(12), scenes: ['VERSE', 'CHORUS', '', '', '', '', '', ''] })
  unit.number = 60
  ds.handleEvent({ type: 'changed', scope: 'preset' })
  await clock.advance(ds.PRESET_SETTLE_MS + 500)
  assert.equal(asked(CHAIN), 1)
  unit.refuseSelect = true
  await assert.rejects(ds.loadPreset(61))
  unit.copy = null
  await clock.advance(ds.CHAIN_FRESH_MS + 500)
  assert.equal(asked(CHAIN), 2, 'a refused tap called off the read the stale copy was owed')
})

onTheBench('a unit too busy to say which preset after a tap in the Mac window is asked again, never shown as slot -1', async () => {
  const { clock, unit, asked, nameOf } = windowOnTheBench()
  let first = true
  unit.which = () => {
    if (!first) return { number: unit.number, name: nameOf(unit.number) }
    first = false
    return { number: -1, name: '' }
  }
  const seen = []
  const off = ds.subscribe(() => seen.push(ds.getSnapshot().preset?.number))
  try {
    const load = ds.loadPreset(30)
    await clock.advance(3000)
    await load
  } finally {
    off()
  }
  assert.ok(!seen.includes(-1), 'slot -1 was put on screen')
  assert.equal(ds.getSnapshot().preset.number, 30)
  assert.equal(ds.getSnapshot().preset.name, nameOf(30))
  assert.equal(asked(/^GET \/presets\/-1\//), 0, 'slot -1 was dumped for its scene names')
})

onTheBench('an empty slot in the Mac window is not dumped for scene names it does not have', async () => {
  const { clock, asked } = windowOnTheBench({ presetName: '', scenes: ['', '', '', '', '', '', '', ''] })
  ds.loadPreset(200)
  await clock.advance(3000)
  assert.equal(asked(CHAIN), 1)
  /* And every read App makes while somebody builds in it. */
  await ds.refreshLoadedSceneNames(200)
  await ds.refreshLoadedSceneNames(200)
  assert.equal(asked(SUMMARY), 0, 'an empty slot was dumped for its scene names')
})

onTheBench('Play appearing in the Mac window long after the last read reads nothing, unless the stream dropped', async () => {
  const { clock, unit } = windowOnTheBench()
  ds.listen()
  await ds.refreshBlocks()
  await clock.advance(ds.CHAIN_FRESH_MS + 30000)
  assert.equal(ds.chainIsCurrent(), false)
  assert.equal(ds.chainFollowed(), true, 'a chain followed all along is read again for being old')
  unit.gap()
  assert.equal(ds.chainFollowed(), false, 'a chain read before a gap in the event stream counts as followed')
  await ds.refreshBlocks()
  assert.equal(ds.chainFollowed(), true)
  ds.stopListening()
  assert.equal(ds.chainFollowed(), false, 'a store that is not listening says it has followed the unit')
})

onTheBench('on an Axe-Fx II the Mac window never asks for the computer’s copy of the preset', async () => {
  const { clock, asked } = windowOnTheBench({ keepsCopy: false })
  ds.loadPreset(21)
  await clock.advance(3000)
  await ds.refreshLoadedSceneNames(21)
  assert.equal(asked('GET /preset/grid'), 0, 'an Axe-Fx II was asked for a second full read of the preset')
})

onTheBench('an AM4 saying its own preset was edited costs the Mac window the chain, not a dump of the stored slot', async () => {
  const { clock, asked } = windowOnTheBench({ keepsCopy: false, namesInChain: false, scenes: ['', '', '', ''] })
  for (let i = 0; i < 3; i++) {
    ds.handleEvent({ type: 'changed', scope: 'preset' })
    await clock.advance(ds.PRESET_SETTLE_MS + 500)
  }
  assert.equal(asked(CHAIN), 3)
  assert.equal(asked(SUMMARY), 0, 'an edit of the preset on screen dumped the stored slot for its scene names')
})

onTheBench('where the computer keeps no long copy, the Mac window reads a front-panel preset after the usual moment', async () => {
  const { clock, unit, asked, nameOf } = windowOnTheBench({ keepsCopy: false })
  await ds.refreshBlocks()
  unit.number = 40
  assert.equal(ds.presetHeard({ number: 40, name: nameOf(40) }), true)
  await clock.advance(ds.PRESET_SETTLE_MS + 300)
  assert.equal(asked(CHAIN), 2, 'a quarter of a minute was waited out for a copy this unit’s computer does not keep')
})

/*
 * A Gain turned to 25 still read 25 after Revert on the play test. The open
 * editor re-reads on its block, channel and scene; a Revert is the same slot
 * loaded again and moves none of them. editRev is what does move.
 */
onTheBench('loading the same slot again tells an open editor its values are stale, once, after the unit settles', async () => {
  const { clock } = windowOnTheBench()
  const start = ds.getSnapshot().editRev
  const load = ds.loadPreset(12)
  await clock.advance(ds.OWN_SETTLE_MS - 100)
  assert.equal(ds.getSnapshot().editRev, start, 'the editor was told to re-read while the unit was still loading')
  await clock.advance(3000)
  await load
  assert.equal(ds.getSnapshot().editRev, start + 1, 'the same slot loaded again leaves the open editor on the old values')
  await clock.advance(30000)
  assert.equal(ds.getSnapshot().editRev, start + 1, 'one load moved the edit buffer more than once')
})

onTheBench('a preset changed at the unit moves the edit buffer too; a scene does not', async () => {
  const { clock, unit, nameOf } = windowOnTheBench()
  const start = ds.getSnapshot().editRev
  await ds.writeScene(3)
  await clock.advance(5000)
  assert.equal(ds.getSnapshot().editRev, start, 'a scene tap made the editor read again as if the preset had been reloaded')
  await clock.advance(20000)
  unit.number = 77
  assert.equal(ds.presetHeard({ number: 77, name: nameOf(77) }), true)
  await clock.advance(ds.PRESET_SETTLE_MS + 100)
  assert.equal(ds.getSnapshot().editRev, start + 1, 'the editor kept the last preset’s values when the unit moved on')
})

/* A Revert on the phone reaches this window as news of the same preset. */
onTheBench('the same slot loaded again from the other device tells an open editor too, at no extra chain read', async () => {
  const { clock, unit, asked } = windowOnTheBench()
  await clock.advance(ds.CHAIN_FRESH_MS + 1000)
  const start = ds.getSnapshot().editRev
  const chains = asked(CHAIN)
  ds.handleEvent({ type: 'changed', scope: 'preset' })
  await clock.advance(ds.PRESET_SETTLE_MS + 500)
  assert.equal(ds.getSnapshot().editRev, start + 1, 'a Revert from the other device left the open editor on the old values')
  assert.equal(asked(CHAIN), chains + 1, 'following a reload from elsewhere cost more than one chain read')
  /* An AM4's news is its own edit watch, and says nothing was reloaded. */
  unit.keepsCopy = false
  await clock.advance(ds.CHAIN_FRESH_MS + 1000)
  const later = ds.getSnapshot().editRev
  ds.handleEvent({ type: 'changed', scope: 'preset' })
  await clock.advance(ds.PRESET_SETTLE_MS + 500)
  assert.equal(ds.getSnapshot().editRev, later, 'an AM4 knob turned at the unit was taken as the preset loaded again')
})

/*
 * The editor's read key is the block, its channel, the scene and editRev. A
 * load that moved the amp to another channel changed the channel in one set
 * and editRev in another, and the editor read its block twice at a unit
 * that had just loaded — the first answer thrown away.
 */
onTheBench('a load that moves the open block to another channel makes the editor read once', async () => {
  const { clock, unit } = windowOnTheBench()
  const keyNow = () => {
    const s = ds.getSnapshot()
    const b = s.blocks.find((x) => x.effectId === 58)
    return `${b?.channel}:${s.sceneIndex}:${s.editRev}`
  }
  const seen = []
  let last = keyNow()
  const off = ds.subscribe(() => {
    /* The pedals drawn ahead of the chain: an editor waits through those,
       so there is none then to read. */
    const s = ds.getSnapshot()
    if (s.chainOutline === ds.chainNumberOf(s)) return
    const k = keyNow()
    if (k !== last) seen.push((last = k))
  })
  try {
    unit.blocks = unit.blocks.map((b) => (b.effectId === 58 ? { ...b, channel: 'C' } : b))
    const load = ds.loadPreset(20)
    await clock.advance(5000)
    await load
    assert.equal(seen.length, 1, `the editor read its block more than once for one load: ${seen.join(' then ')}`)
    assert.match(seen[0], /^C:/)
    /* A chain that could not be read still tells the editor, on its own. */
    seen.length = 0
    unit.chain = () => {
      throw new Error('PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78')
    }
    const again = ds.loadPreset(20)
    await clock.advance(5000)
    await again
    assert.equal(seen.length, 1, 'a load whose chain read failed told the editor nothing, or told it twice')
  } finally {
    off()
  }
})

onTheBench('a select the unit answers with {ok:false} is a refusal, not a load', async () => {
  const { clock, unit } = windowOnTheBench()
  const start = ds.getSnapshot().editRev
  const said = []
  unit.refuseSelect = false
  ds.attachDriver({
    ...ds.attachedDriver(),
    selectPreset: async () => ({ ok: false, number: 12 })
  })
  /* Settled by hand rather than awaited: a load taken for a yes waits on the clock. */
  const outcome = ds.loadPreset(12, { selected: () => said.push('taken') }).then(() => 'loaded', (err) => err.message)
  await clock.advance(5000)
  assert.equal(await outcome, ds.SELECT_REFUSED, 'a select the unit answered {ok:false} was taken for a load')
  assert.deepEqual(said, [], 'a select the unit refused was taken for one it loaded')
  assert.equal(ds.getSnapshot().editRev, start, 'a refused load told the editor its values were stale')
})

test('the knobs turned since the save are kept as a list, one entry per control and channel', async () => {
  const rc = await import('../src/lib/revertCheck.js')
  let list = []
  list = rc.noteEdit(list, { eid: 58, paramId: 1, channel: 'A', block: 'Amp 1', param: 'Gain', from: 5, fromNorm: 0.5, to: 7, min: 0, max: 10 })
  list = rc.noteEdit(list, { eid: 58, paramId: 1, channel: 'A', block: 'Amp 1', param: 'Gain', from: 7, fromNorm: 0.7, to: 9, min: 0, max: 10 })
  list = rc.noteEdit(list, { eid: 58, paramId: 1, channel: 'B', block: 'Amp 1', param: 'Gain', from: 3, to: 4, min: 0, max: 10 })
  assert.equal(list.length, 2, 'a second turn of one knob became a second knob, or channel B was folded into A')
  assert.equal(list[0].from, 5, 'the second turn forgot where the knob was before the first')
  assert.equal(list[0].fromNorm, 0.5)
  assert.equal(list[0].to, 9)
  /* A sentence with no control behind it is not something to read back. */
  assert.equal(rc.noteEdit(list, { block: 'Amp 1', param: 'Gain', from: 1, to: 2 }), list)
  assert.equal(rc.noteEdit(list, undefined), list)
})

test('a Revert is only called done once the knobs read back where they were', async () => {
  const rc = await import('../src/lib/revertCheck.js')
  const gain = { eid: 58, paramId: 1, channel: 'A', block: 'Amp 1', param: 'Gain', from: 5, fromNorm: 0.5, to: 7.5, min: 0, max: 10 }
  const bass = { eid: 58, paramId: 2, channel: 'A', block: 'Amp 1', param: 'Bass', from: 4, fromNorm: 0.4, to: 6, min: 0, max: 10 }
  const live = (g, b) => async () => ({ named: [{ id: 1, name: 'Gain', value: g, norm: g / 10 }, { id: 2, name: 'Bass', value: b, norm: b / 10 }] })
  let dumps = 0
  const slot = (g, b) => async () => {
    dumps += 1
    return { blocks: [{ effectId: 58, channel: 0, params: [{ paramId: 1, raw: Math.round((g / 10) * 65534), value: g }, { paramId: 2, raw: Math.round((b / 10) * 65534), value: b }] }] }
  }
  const onA = () => 'A'

  /* The reload took, on a preset that was clean before the first turn. */
  let check = await rc.checkRevert({ edits: [gain, bass], readBlock: live(5, 4), readSaved: slot(5, 4), channelOf: onA })
  assert.equal(check.state, 'back')
  assert.equal(rc.revertTook(check), true)
  assert.equal(dumps, 0, 'the whole slot was dumped when every knob was already back where it started')

  /* The unit answered yes and loaded nothing: the knobs are where they were turned. */
  check = await rc.checkRevert({ edits: [gain, bass], readBlock: live(7.5, 6), readSaved: slot(5, 4), channelOf: onA })
  assert.equal(check.state, 'stuck', 'a Revert that left every knob where it was turned was called done')
  assert.equal(rc.revertTook(check), false)
  assert.deepEqual(rc.stuckLines(check), ['Amp 1 · Gain is still 7.5', 'Amp 1 · Bass is still 6'])
  assert.equal(dumps, 1, 'the slot was read more than once for one check')

  /* Turned on top of something never saved: "before" is not the saved value, the slot is. */
  dumps = 0
  const onTop = { ...gain, from: 8, fromNorm: 0.8 }
  check = await rc.checkRevert({ edits: [onTop], readBlock: live(5, 4), readSaved: slot(5, 4), channelOf: onA })
  assert.equal(check.state, 'back', 'a Revert back to the saved slot was called stuck because the knob started somewhere unsaved')
  assert.equal(dumps, 1)
  /* And with no slot to ask, a knob that moved but not to anything known is not a failure it can name. */
  check = await rc.checkRevert({ edits: [onTop], readBlock: live(5, 4), readSaved: async () => { throw new Error('404') }, channelOf: onA })
  assert.equal(check.state, 'unknown')
  assert.equal(rc.revertTook(check), false, 'Save and Revert went away on a Revert nothing could confirm')

  /* Nothing could be read back at all. */
  check = await rc.checkRevert({ edits: [gain], readBlock: async () => { throw new Error('timed out') }, readSaved: slot(5, 4), channelOf: onA })
  assert.equal(check.state, 'unknown')
  assert.equal(rc.revertTook(check), false)

  /* No knob turned, or turned and turned back: the unit's own answer is the check. */
  assert.equal((await rc.checkRevert({ edits: [], readBlock: live(0, 0), channelOf: onA })).state, 'nothing')
  check = await rc.checkRevert({ edits: [{ ...gain, to: 5 }], readBlock: live(9, 9), channelOf: onA })
  assert.equal(check.state, 'nothing')
  assert.equal(rc.revertTook(check), true)

  /* A knob on a channel the block is not showing now is not read by switching to it — and not a yes either. */
  check = await rc.checkRevert({ edits: [{ ...gain, channel: 'B' }], readBlock: live(7.5, 6), channelOf: onA, channelBefore: onA })
  assert.equal(check.state, 'unknown')
  assert.equal(rc.revertTook(check), false, "Save and Revert went away when the only knob turned was on a channel the unit isn't showing")
  /* The unit ignored it and is showing A, where Gain happens to sit where B's started: A's value says nothing about B. */
  check = await rc.checkRevert({ edits: [{ ...gain, channel: 'B' }], readBlock: live(5, 4), readSaved: slot(5, 4), channelOf: onA, channelBefore: onA })
  assert.equal(check.state, 'unknown', 'a knob turned on channel B was read off channel A')
  assert.equal(rc.revertTook(check), false)
  /* Tapped over to B before the Revert, and back on A after it: that is the buffer loaded again. */
  check = await rc.checkRevert({ edits: [{ ...gain, channel: 'B' }], readBlock: live(7.5, 6), channelOf: onA, channelBefore: () => 'B' })
  assert.equal(check.state, 'back', 'a Revert that moved the amp back to its saved channel could not be called done')
  assert.equal(rc.revertTook(check), true)
  /* One off-channel knob beside one that read back: the one that read back decides. */
  check = await rc.checkRevert({ edits: [{ ...bass, channel: 'B' }, gain], readBlock: live(5, 6), readSaved: slot(5, 4), channelOf: onA })
  assert.equal(check.state, 'back')
  /* A control the read did not carry is not known. */
  check = await rc.checkRevert({ edits: [{ ...gain, paramId: 99 }], readBlock: live(7.5, 6), channelOf: onA })
  assert.equal(check.state, 'unknown', 'a knob missing from the read was left out, and the Revert called done')

  /* Turned from somewhere unsaved back onto the saved value, with no slot to ask: nothing says the change is still on it. */
  check = await rc.checkRevert({ edits: [{ ...gain, from: 8, fromNorm: 0.8, to: 5 }], readBlock: live(5, 4), readSaved: async () => { throw new Error('501') }, channelOf: onA })
  assert.equal(check.state, 'unknown', 'a knob turned onto the saved value was called stuck with no slot to say so')
  assert.equal(rc.revertTook(check), false)
})

test('a read the unit never answered, every knob at zero, is not a Revert seen done', async () => {
  const rc = await import('../src/lib/revertCheck.js')
  const low = { eid: 58, paramId: 3, channel: 'A', block: 'Amp 1', param: 'Low Cut', from: 20, fromNorm: 0, to: 120, min: 20, max: 2000 }
  const gain = { eid: 58, paramId: 1, channel: 'A', block: 'Amp 1', param: 'Gain', from: 5, fromNorm: 0.5, to: 7.5, min: 0, max: 10 }
  /* What the server hands back when its bulk read timed out: gen3.ts blockParams' catch. */
  const zeroed = async () => ({ named: [{ id: 1, name: 'Gain', value: 0, norm: 0 }, { id: 3, name: 'Low Cut', value: 0, norm: 0 }], enums: [], type: null })
  const slot = async () => ({ blocks: [{ effectId: 58, channel: 0, params: [{ paramId: 1, raw: 32767, value: 5 }, { paramId: 3, raw: 0, value: 20 }] }] })
  const onA = () => 'A'
  let check = await rc.checkRevert({ edits: [low, gain], readBlock: zeroed, readSaved: slot, channelOf: onA })
  assert.equal(check.state, 'unknown', 'a knob that started at its minimum matched a read of nothing, and the Revert was called done')
  assert.equal(rc.revertTook(check), false)
  check = await rc.checkRevert({ edits: [{ ...gain, to: 0 }], readBlock: zeroed, readSaved: slot, channelOf: onA })
  assert.equal(check.state, 'unknown', 'a read of nothing said a knob turned to zero was still there')
  /* A real read, with the block's type on it, and Low Cut really at its minimum. */
  const real = async () => ({ named: [{ id: 1, name: 'Gain', value: 5, norm: 0.5 }, { id: 3, name: 'Low Cut', value: 20, norm: 0 }], enums: [], type: { value: 3, name: 'x' } })
  check = await rc.checkRevert({ edits: [low], readBlock: real, readSaved: slot, channelOf: onA })
  assert.equal(check.state, 'back')
})

test('in the demo, the preset chosen again goes back to what was saved, and walking away keeps an edit', async () => {
  /*
   * The demo kept each preset's working copy for good, the one it was on
   * included — so a Revert there put nothing back, and once Revert read the
   * knobs to check, every Revert in the demo said the FM3 hadn't gone back.
   */
  const store = {}
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v)
    },
    removeItem: (k) => {
      delete store[k]
    }
  }
  const fx = await import('../src/lib/forgefx.js')
  const rc = await import('../src/lib/revertCheck.js')
  fx.setDemo(true)
  try {
    const number = (await fx.currentPreset()).number
    const amp = (await fx.presetBlocks()).find((b) => b.slug === 'amp')
    assert.ok(amp, 'the demo has no amp to dial')
    const gainNow = async () => ((await fx.blockParams(amp.effectId))?.named || []).find((p) => /gain/i.test(p.name))
    const gain = await gainNow()
    assert.ok(gain, 'the demo amp has no gain control')
    const to = gain.value > (gain.min + gain.max) / 2 ? gain.min : gain.max
    const near = (a, b) => Math.abs(a - b) <= Math.abs(gain.max - gain.min) * 0.01
    await fx.setParam(amp.effectId, gain.id, to, gain)
    assert.ok(near((await gainNow()).value, to), 'the demo did not take the turn')
    const edits = rc.noteEdit([], { eid: amp.effectId, paramId: gain.id, channel: amp.channel ?? null, block: amp.name, param: gain.name, from: gain.value, fromNorm: gain.norm, to, min: gain.min, max: gain.max })

    await fx.selectPreset(number)
    assert.ok(near((await gainNow()).value, gain.value), 'the same slot chosen again kept the knob where it was turned')
    const check = await rc.checkRevert({
      edits,
      readBlock: fx.blockParams,
      readSaved: () => fx.presetParams(number),
      channelOf: () => amp.channel ?? null
    })
    assert.equal(check.state, 'back', `a Revert in the demo was said not to have taken: ${JSON.stringify(check)}`)
    assert.equal(rc.revertTook(check), true)

    /* Another preset and back is not a reload: the edit is still there. */
    await fx.setParam(amp.effectId, gain.id, to, gain)
    await fx.selectPreset(number + 1)
    await fx.selectPreset(number)
    assert.ok(near((await gainNow()).value, to), 'the demo forgot an edit as soon as another preset was visited')
  } finally {
    fx.setDemo(false)
    delete globalThis.localStorage
  }
})

test('the saved slot is read per channel, and never on a guess about which channel it is', async () => {
  const { savedParam } = await import('../src/lib/revertCheck.js')
  const amp = [0, 1, 2, 3].map((channel) => ({ effectId: 58, channel, params: [{ paramId: 1, raw: channel * 100, value: channel }] }))
  const drive = [{ effectId: 133, params: [{ paramId: 1, raw: 9, value: 9 }] }]
  assert.equal(savedParam(amp, 58, 'C', 1).value, 2, 'channel C read channel A’s value')
  assert.equal(savedParam(amp, 58, null, 1).value, 0)
  assert.equal(savedParam(drive, 133, 'A', 1).value, 9)
  assert.equal(savedParam(drive, 133, 'B', 1), null, 'one unmarked copy of a block was taken as channel B’s')
  assert.equal(savedParam(drive, 999, 'A', 1), null)
  assert.equal(savedParam(null, 58, 'A', 1), null)
})

test('a Revert that did not take says so in plain words', async () => {
  const { revertSaid } = await import('../src/lib/revertCheck.js')
  assert.equal(revertSaid('stuck', 'FM3'), "The FM3 didn't go back to the saved preset — your changes are still on it.")
  assert.match(revertSaid('stuck', null), /^The unit didn't go back/)
  assert.match(revertSaid('unknown', 'FM3'), /couldn't read the FM3 back/)
  assert.match(revertSaid('unknown', 'FM3'), /Save and Revert are still here/)
})

test('Revert reloads through the store and keeps Save and Revert until the knobs read back', () => {
  const bare = (t) => t.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')
  const app = bare(readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8'))
  const revert = app.slice(app.indexOf('const revert = async'), app.indexOf('const restoreSafety = async'))
  assert.ok(revert.length > 200, 'Revert moved; this check reads it')
  assert.match(revert, /await loadPresetInStore\(number\)/, 'Revert does not go through the store, so a refusal is a yes again and no editor re-reads')
  assert.ok(!/revertPreset|await read\(\)/.test(revert), 'Revert went back to asking and not looking')
  const check = revert.indexOf('await checkRevert(')
  const clean = revert.indexOf('setDirty(false)')
  assert.ok(check > 0 && clean > check, 'Save and Revert go away before anything was read back')
  assert.ok(revert.indexOf('if (!took) return refused(') > check && revert.indexOf('if (!took) return refused(') < clean, 'a Revert that did not take still puts Save and Revert away')
  assert.match(revert, /readSaved: \(\) => presetParams\(number\)/, 'the slot is not what a knob turned on an unsaved buffer is checked against')
  assert.match(revert, /if \(err\?\.message === SELECT_REFUSED\) return refused\(revertSaid\('stuck', unit\), \[err\.message\]\)/, "only the unit's refusal is said as a definite didn't-go-back")
  assert.equal((revert.match(/revertSaid\('stuck'/g) || []).length, 1, "a timeout or a Mac that couldn't be reached is told the FM3 didn't go back")
  assert.match(revert, /if \(macSilent\(err\) && !err\.linkDown\) \{ bufferReloaded\(\) return refused\(revertSaid\('unknown', unit\), \[err\.message\]\) \}/, 'a Revert whose answer never came back is told as a certain no, or leaves the editor on the old knobs')
  assert.match(revert, /return refused\(err\.message, \[err\.message\]\)/, 'a Mac that could not be reached no longer says why')
  assert.match(app, /loadPreset as loadPresetInStore, SELECT_REFUSED,/)
  /* The list handed to the check is the one the knobs filled, read against the channels the unit shows. */
  assert.match(revert, /const turned = edits\.current/, 'Revert no longer checks the knobs that were turned')
  assert.ok(revert.indexOf('const turned = edits.current') < revert.indexOf('await loadPresetInStore(number)'), 'the turned knobs are taken after the reload')
  assert.match(revert, /edits: turned,/, 'Revert checks an empty list, so it always passes')
  assert.match(revert, /channelOf: \(eid\) => deviceSnapshot\(\)\.blocks\.find\(\(b\) => b\.effectId === eid\)\?\.channel/, 'every knob is skipped as being on another channel')
  assert.match(revert, /channelBefore: \(eid\) => chanBefore\.get\(eid\) \?\? null/, 'a block that came back on another channel is not taken as the reload')
  assert.ok(revert.indexOf('const chanBefore = new Map(deviceSnapshot().blocks') > 0 && revert.indexOf('const chanBefore') < revert.indexOf('await loadPresetInStore(number)'), 'the channels "before" are read after the reload')
  /* The slot's name is written down only once the Revert is shown to have taken. */
  assert.ok(!/presetLanded\(\{ fresh: true \}\)/.test(revert), 'a Revert that did not take writes the edited name into the preset list')
  assert.match(revert, /const took = revertTook\(check\) presetLanded\(\{ fresh: took \}\) if \(!took\) return refused\(/, 'the slot’s name is written down before the Revert is known to have taken')
  assert.match(revert, /setSaveError\(msg\)/, 'the save sheet Revert was pressed on does not say it failed')
  assert.ok(!/clearDeviceCache|\/device\/cache/.test(revert), 'Revert deletes the computer’s profile of the unit')
  /* The list it checks is the one the knobs fill, and it empties with the preset. */
  assert.match(app, /record\('edit', summary\) edits\.current = noteEdit\(edits\.current, change\)/, 'a knob turn is only a sentence in the log again')
  assert.match(app, /useEffect\(\(\) => \{ if \(!dirty\) edits\.current = \[\] \}, \[dirty\]\)/, 'the list outlives the save or load that made it clean')
  assert.match(app, /useEffect\(\(\) => \{ edits\.current = \[\] \}, \[preset\?\.number\]\)/, 'the knobs turned on one preset are checked against the next one')
  const restore = app.slice(app.indexOf('const restoreSafety = async'), app.indexOf('finally', app.indexOf('const restoreSafety = async')))
  assert.match(restore, /edits\.current = \[\] await read\(\) bufferReloaded\(\)/, 'the pre-edit copy leaves an open editor on the values it replaced')
})

test('the block editor hands over which knob it turned, on which channel, and where it stood', () => {
  const bare = (t) => t.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')
  const con = bare(readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8'))
  const panel = con.slice(con.indexOf('export function BlockPanel('))
  const write = panel.slice(panel.indexOf('writeOne.current = async'), panel.indexOf('const applyModel = async'))
  assert.match(write, /writeOne\.current = async \(\{ p, next, key, eid, name, slug, channel \}\)/)
  assert.match(write, /eid, paramId: p\.id, channel, fromNorm: p\.norm \}/, 'a knob turn reaches App without the control, the channel or the unit’s own scale')
  assert.match(panel, /channel: block\.channel \?\? null \}\)/, 'the channel the knob was turned on is not the one it was on when it was turned')
})

test('the Mac window switches, steps and appears through the store, with no read of its own', () => {
  const bare = (t) => t.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')
  const gig = bare(readSrc(new URL('../src/components/Gig.jsx', import.meta.url), 'utf8'))
  const pick = gig.slice(gig.indexOf('const pickScene = async'), gig.indexOf('const toggle = async'))
  assert.ok(pick.includes('await writeScene(index)'))
  assert.ok(!/refreshBlocks\(/.test(pick), 'a scene tap on Play reads the chain after it')
  const toggle = gig.slice(gig.indexOf('const toggle = async'), gig.indexOf('finally', gig.indexOf('const toggle = async')))
  assert.ok(!/refreshBlocks\(/.test(toggle), 'an effect tap on Play reads the chain after it')
  const step = gig.slice(gig.indexOf('const step = async'), gig.indexOf('finally', gig.indexOf('const step = async')))
  assert.match(step, /await loadPreset\(next\)/, 'Next does not go through the store’s one read of a preset')
  assert.ok(!/clearDeviceCache|onChanged\(\)/.test(step), 'Next still re-reads everything, or deletes the computer’s profile of the unit')
  assert.match(gig, /\}, \[preset\?\.number\]\)/, 'Play re-reads the chain every time the preset object is replaced')
  assert.match(gig, /const pending = presetReadPending\(\) if \(pending\)/, 'Play reads again while a preset change is being read')
  assert.match(gig, /if \(chainIsCurrent\(\) \|\| chainFollowed\(\)\) \{ setChain\('ok'\) return \}/, 'Play reads a chain read a moment ago, or one the store has followed since')

  const app = bare(readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8'))
  const jump = app.slice(app.indexOf('const jumpTo = async'), app.indexOf('const rename = async'))
  assert.match(jump, /await loadPresetInStore\(number, \{/, 'the preset list does not go through the store’s one read')
  assert.ok(!/await read\(\)|clearDeviceCache/.test(jump), 'loading a preset from the list still re-reads everything')
  assert.match(app, /chainWasRead\(p\?\.number\)/, 'App’s own chain read is not known to the screens that appear after it')
  /* Play's typed tempo is logged; it is not a reason to read the whole rig, a chain dump straight after the write. */
  const play = app.slice(app.indexOf('<Gig'), app.indexOf('/>', app.indexOf('<Gig')))
  assert.match(play, /onChanged=\{\(summary\) => record\('tempo', summary\)\}/, 'a tempo typed on Play re-reads the whole rig')
  assert.ok(!/refreshSceneNames\(p\.number\)/.test(app), 'App’s read dumps the loaded slot for its scene names')

  /* The Scenes sheet: a switch there reads what it switched, not the whole preset. */
  const scenes = bare(readSrc(new URL('../src/components/Scenes.jsx', import.meta.url), 'utf8'))
  const jumpS = scenes.slice(scenes.indexOf('const jump = async'), scenes.indexOf('catch', scenes.indexOf('const jump = async')))
  assert.match(jumpS, /await writeScene\(index\) onChanged\(`Switched to scene \$\{index \+ 1\}`, \{ reread: false \}\)/, 'a scene switched in the Scenes sheet re-reads the whole preset after it')
  const chan = scenes.slice(scenes.indexOf('const channel = async'), scenes.indexOf('catch', scenes.indexOf('const channel = async')))
  assert.match(chan, /\{ reread: false \}\) await refreshSceneState\(\)/, 'a channel switched in the Scenes sheet re-reads the whole preset instead of the status read')
  assert.match(app, /onChanged=\{\(summary, \{ reread = true \} = \{\}\) => \{ record\('scene', summary\) if \(reread\) read\(\) \}\}/, 'the Scenes sheet re-reads the whole preset whatever it is told')

  /* The block sheet's own bypass and channel buttons, through the store and with no whole re-read. */
  const consoleSrc = bare(readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8'))
  const panel = consoleSrc.slice(consoleSrc.indexOf('className="block-switches"'), consoleSrc.indexOf('className="undo-strip"'))
  assert.match(panel, /await writeBypass\(block\.effectId, wanted\) onChanged\([^;]*?, undefined, \{ chain: false \}\)/, 'the block sheet’s bypass re-reads the whole preset, or goes round the store')
  assert.ok(!/setBypass\(/.test(panel), 'the block sheet’s bypass goes round the store, so its announcement is read as news')
  assert.match(panel, /await setChannel\(block\.effectId, ch\) await refreshSceneState\(\) onChanged\([^;]*?, undefined, \{ chain: false \}\)/, 'the block sheet’s channel re-reads the whole preset')
})

test('the phone and the Mac window keep one rule for their own announcements', async () => {
  const echo = await import('../shared/own-echo.mjs')
  let t = 0
  const ledger = echo.createOwnEchoes({ now: () => t })
  const token = ledger.owe('scene', 2)
  assert.equal(ledger.take('scene', 3), false, 'a different scene was taken for this tap')
  assert.equal(ledger.take('scene', 2), true)
  assert.equal(ledger.take('scene', 2), false, 'one write paid off two announcements')
  ledger.restamp(ledger.owe('grid'))
  t += echo.OWN_ECHO_MS + 1
  assert.equal(ledger.take('grid'), false, 'an expectation outlived its window')
  /* A write still in the air keeps its expectation: the computer announces a
     write before it answers it, and the write can wait seconds in the queue. */
  ledger.owe('grid')
  t += 3000
  assert.equal(ledger.take('grid'), true, 'a write still waiting for its answer lost its announcement')
  const late = ledger.owe('scene', 4)
  t += 3000
  ledger.restamp(late)
  t += echo.OWN_ECHO_MS + 1
  assert.equal(ledger.take('scene', 4), false, 'an answered write kept its expectation past the window')
  ledger.owe('grid')
  t += echo.OWN_PENDING_MS + 1
  assert.equal(ledger.take('grid'), false, 'a write that never came back swallowed a real change for good')
  const refused = ledger.owe('preset')
  ledger.disown(refused)
  assert.equal(ledger.take('preset'), false, 'a refused write swallowed somebody else’s change')
  void token

  assert.equal(echo.announcementKind({ type: 'scene', index: 1 }), 'scene')
  assert.equal(echo.announcementKind({ type: 'changed', scope: 'grid' }), 'grid')
  assert.equal(echo.announcementKind({ type: 'changed', scope: 'preset' }), 'preset')
  assert.equal(echo.announcementKind({ type: 'changed' }), 'grid')
  assert.equal(echo.announcementKind({ type: 'tempo', bpm: 120 }), null)

  const rig = readSrc(new URL('../mobile/src/lib/rig.js', import.meta.url), 'utf8')
  const store = readSrc(new URL('../src/lib/deviceState.js', import.meta.url), 'utf8')
  assert.match(rig, /from '\.\/own-echo'/, 'the phone keeps its own copy of the rule')
  assert.match(store, /from '\.\.\/\.\.\/shared\/own-echo\.mjs'/, 'the Mac window keeps its own copy of the rule')
})

ds.reset()

/* ------------------------------------------------------------------
   Taste — what the generator is told about the player's own history.

   This is the one feature whose failure mode is quiet. A wrong figure here
   does not throw; it just steers every future generation slightly wrong, and
   nobody can tell that from a tone they merely did not love.
   ------------------------------------------------------------------ */

/** A kept preset, shaped as history.js and cloudPresets.js both produce them. */
const keptPreset = (name, description, blocks, at = Date.now()) => ({
  id: name,
  at,
  name,
  description,
  spec: { blocks },
  blockNames: blocks.map((b) => b.blockName).filter(Boolean)
})

const amp = (typeName, drive, extra = {}) => ({
  eid: 1,
  blockName: 'Amp 1',
  typeName,
  params: [
    { id: 1, name: 'Drive', value: drive },
    ...Object.entries(extra).map(([name, value], i) => ({ id: i + 2, name, value }))
  ]
})










/* ------------------------------------------------------------------
   Corrections — what the player fixes by hand, and what that is allowed
   to teach.

   Same quiet failure mode as taste, and a worse one: taste steers a
   generation, this one tells the model it has been getting something wrong.
   A pattern claimed from too little evidence is the app inventing a habit
   and then acting on it for good.
   ------------------------------------------------------------------ */

const fix = (param, from, to, extra = {}) => ({
  at: Date.now(),
  block: 'Amp 1',
  slug: 'amp',
  param,
  from,
  to,
  min: 0,
  max: 10,
  ...extra
})

console.log('\ncorrections')










/* ------------------------------------------------------------------
   The phone remote — which end this is, and whether the other end answers.

   The correction this whole module exists for: "connected" used to mean a
   channel had been joined, which is true with the Mac off and nothing
   answering. Nothing here may say connected unless the Mac answered.
   ------------------------------------------------------------------ */

/*
 * A marker is not a name.
 *
 * "Empty scene is still showing previous preset name" — slot 495, shown as
 * `<EMPTY>k Album Chug`. An empty gen-3 slot reports `<EMPTY>` written over the
 * front of a fixed run of characters rather than clearing it, so a short marker
 * on top of a longer old name leaves the old name's tail hanging off the end.
 * The app cannot fix that buffer; it can stop repeating it.
 */
console.log('\npreset names')

test('a marker with somebody else preset stuck to it is not a name', () => {
  assert.equal(names.isEmptySlotName('<EMPTY>k Album Chug'), true)
  assert.equal(names.cleanPresetName('<EMPTY>k Album Chug'), '', 'the rubble is kept')
  assert.equal(names.presetLabel({ name: '<EMPTY>k Album Chug' }), 'Empty')
})

test('the marker is recognised however the unit spaces it', () => {
  for (const raw of ['<EMPTY>', ' <EMPTY> ', '<empty>', '< Empty >'])
    assert.equal(names.isEmptySlotName(raw), true, raw)
})

test('a preset somebody named is left alone', () => {
  /*
   * The negative that matters. Matching anywhere in the string would rename
   * somebody's own preset, which is a worse failure than the one being fixed —
   * it is their work, and they chose the word.
   */
  for (const raw of ['Empty Room Verb', 'Nearly <EMPTY> Chug', 'JN Metal Zone'])
    assert.equal(names.isEmptySlotName(raw), false, raw)
  assert.equal(names.cleanPresetName('  JN Metal Zone  '), 'JN Metal Zone')
  assert.equal(names.presetLabel({ name: 'Empty Room Verb' }), 'Empty Room Verb')
})

test('an empty slot and an unnamed preset do not read the same', () => {
  // Untitled is something somebody made and did not name. Empty is nothing.
  assert.equal(names.presetLabel({ name: '' }), 'Untitled')
  assert.equal(names.presetLabel({ name: '   ' }), 'Untitled')
  assert.equal(names.presetLabel({ name: '', empty: true }), 'Empty')
  assert.equal(names.presetLabel(null), 'Untitled')
})

/*
 * Slots the unit does not have.
 *
 * "Tries switching scenes to slot 500 and it didn't work — Preset location
 * index must be integer 0..103, got 500."
 *
 * Not the scenes: a save parked from one machine and carried out on another,
 * aimed at a slot the attached unit has never had. It came from `?? 512` — the
 * gen-3 count, used as a default for every unit including the ones whose
 * driver reports no count at all — and it reappeared every six seconds,
 * because a parked save that fails is retried.
 */
console.log('\nslot ranges')

test('a unit that has not said how many it holds is not given a number', () => {
  assert.equal(slots.slotCount({}), null)
  assert.equal(slots.slotCount({ presets: {} }), null)
  assert.equal(slots.slotCount({ presets: { count: 0 } }), null)
  assert.equal(slots.slotCount({ presets: { count: 104 } }), 104)
})

test('a slot past the end is refused once the unit has said where the end is', () => {
  const am4 = { presets: { count: 104 } }
  assert.equal(slots.slotOutside(500, am4), true)
  assert.equal(slots.slotOutside(103, am4), false)
  assert.equal(slots.slotOutside(104, am4), true)
  assert.equal(slots.slotOutside(-1, am4), true)
})

test('a unit that has said nothing still gets the benefit of the doubt', () => {
  /*
   * The negative that keeps this from being worse than the bug. Refusing every
   * slot on a unit whose driver never reports a count would turn one wrong
   * save into a Save button that never works.
   */
  assert.equal(slots.slotOutside(500, {}), false)
  assert.equal(slots.slotOutside(5, undefined), false)
})

test('a unit that states its size while refusing is listened to', () => {
  assert.equal(
    slots.countFromRefusal('Preset location index must be integer 0..103, got 500.'),
    104,
    'the one place some units ever say how big they are'
  )
  assert.equal(slots.countFromRefusal('location (0..511) required'), 512)
})

test('a refusal that states no range teaches nothing', () => {
  // Narrow on purpose: a number in an unrelated message must not become the
  // unit's size, which would be a worse wrong answer than having none.
  assert.equal(slots.countFromRefusal('the port is busy, try again'), null)
  assert.equal(slots.countFromRefusal('slot 500 is empty'), null)
  assert.equal(slots.countFromRefusal(''), null)
  assert.equal(slots.countFromRefusal(null), null)
})

/*
 * A unit that is busy is not a unit that is gone.
 *
 * "I'm on the FM3. As soon as I hit next or select a scene, it goes to the
 * screen where it says not connected again."
 *
 * Next tells the unit to load a preset and then reads back what is loaded.
 * On hardware that read lands while the unit is still working, the answer is
 * "no unit", and the app believed it — a working rig replaced by a No unit
 * found screen with the guitar still plugged in.
 */
console.log('\nsettling')

const never = async () => {
  throw new Error('this should not have been asked')
}

test('a unit that answers on the second ask is not declared gone', async () => {
  const answers = [{ connected: false }, { connected: true, short: 'FM3' }]
  let waited = 0
  const info = await ds.confirmedDetect({
    detect: async () => answers.shift(),
    wait: async (ms) => {
      waited += ms
    },
    wasLive: true
  })
  assert.equal(info.short, 'FM3')
  assert.ok(waited > 0, 'it asked again with no pause at all, which asks the same busy port')
})

test('a unit that throws once is not declared gone either', async () => {
  // The likelier shape on a relay: the call does not answer false, it fails.
  let n = 0
  const info = await ds.confirmedDetect({
    detect: async () => {
      if (++n === 1) throw new Error('timed out')
      return { connected: true }
    },
    wait: async () => {},
    wasLive: true
  })
  assert.equal(info.connected, true)
  assert.equal(n, 2)
})

test('a unit that really is gone is still reported', async () => {
  let n = 0
  const info = await ds.confirmedDetect({
    detect: async () => {
      n++
      return { connected: false }
    },
    wait: async () => {},
    wasLive: true
  })
  assert.equal(info.connected, false, 'a missing unit was reported as present')
  assert.equal(n, ds.SETTLE_TRIES, 'it gave up early or kept asking for ever')
})

test('a failure every time is the caller own to report, not a quiet null', async () => {
  await assert.rejects(
    ds.confirmedDetect({
      detect: async () => {
        throw new Error('the computer stopped answering')
      },
      wait: async () => {},
      wasLive: true
    }),
    /stopped answering/
  )
})

test('names that came back for another preset are not believed, or kept', () => {
  /*
   * "On the Cowboys From Hell rig it's still showing the Distortion Rigs
   * scenes."
   *
   * Slot 97 showed 96's scene names and kept showing them. The app asked for
   * 97, was answered about 96, believed it, and cached it under 97 — and on a
   * phone the cache is the only source there is, because an AM4 cannot be
   * dumped over the relay. So one bad answer outlived the read that made it.
   *
   * The rule is one-sided on purpose. Only a stated, disagreeing identity
   * counts; a driver that does not say which slot it read says nothing either
   * way, and treating silence as a mismatch would throw away every name on
   * every unit that does not report it.
   */
  assert.equal(slots.wrongSlot(97, 96), true, 'an answer about another preset was believed')
  assert.equal(slots.wrongSlot(97, 97), false)

  /* An AM4 stored dump reports its location; null means it dumped the active
     buffer instead, which is not the slot that was asked for either. */
  assert.equal(slots.wrongSlot(97, null), true, 'an active-buffer dump passed as slot 97')

  /* Silence is not disagreement. */
  assert.equal(slots.wrongSlot(97, undefined), false, 'a driver that reports no location lost its names')

  /* And nothing to compare against cannot disagree: asking for the loaded
     preset with no number is the active-buffer read, which is correct. */
  assert.equal(slots.wrongSlot(undefined, null), false)
  assert.equal(slots.wrongSlot(undefined, 96), false)
})

test('a phone does not take the first no from a busy port', async () => {
  /*
   * "Says it's connected but says no unit. The unit is connected — if I hit
   * Try again like five or six times it will actually connect."
   *
   * Nothing was live, so the wasLive rule does not apply and one no would have
   * stood. But a phone's ask is a handshake down a port the Mac's own page is
   * already polling, and a handshake that lands mid-poll misses. Five or six
   * taps by hand is the evidence; this is those taps.
   */
  let n = 0
  const info = await ds.confirmedDetect({
    detect: async () => ({ connected: ++n >= 4 }),
    wait: async () => {},
    wasLive: false,
    remote: true
  })
  assert.equal(info.connected, true, 'the phone believed the first no and showed "no unit"')
  assert.equal(n, 4, 'it kept asking after it had its answer')
})

test('a phone gives up eventually rather than asking for ever', async () => {
  let n = 0
  let waited = 0
  const info = await ds.confirmedDetect({
    detect: async () => ({ connected: false }),
    wait: async (ms) => {
      n++
      waited += ms
    },
    wasLive: false,
    remote: true
  })
  assert.equal(info.connected, false, 'an empty rig was reported as present')
  assert.equal(n, ds.RELAY_TRIES - 1, `it asked ${n + 1} times, not ${ds.RELAY_TRIES}`)
  assert.ok(waited > 0, 'it asked again with no pause, which asks the same busy port')
})

test('a phone that was live gets the relay asks, not the fewest of the two', async () => {
  /*
   * The two reasons to keep asking were written as alternatives — wasLive OR
   * remote — so the case with both reasons got the smaller budget. A phone
   * whose unit was answering a moment ago asked three times over a second and
   * a half, while a phone that had never seen the unit asked five. Backwards,
   * and it is the live one that is mid-gig.
   */
  let n = 0
  const info = await ds.confirmedDetect({
    detect: async () => ({ connected: ++n >= ds.RELAY_TRIES }),
    wait: async () => {},
    wasLive: true,
    remote: true
  })
  assert.equal(info.connected, true, 'a live phone gave up before the relay budget was spent')
  assert.equal(n, ds.RELAY_TRIES)
})

test('a read that follows an order this app gave keeps asking through it', async () => {
  /*
   * "The screen popped up while it was saving a preset" — THE MAC CAN'T SEE
   * YOUR UNIT, over a save that was going through. A save takes the unit away
   * for seconds while the preset goes to flash, and both ends re-read the
   * moment it reports done: that read is aimed at a port still busy with the
   * very thing it was asked to do.
   */
  let n = 0
  let waited = 0
  const info = await ds.confirmedDetect({
    detect: async () => ({ connected: ++n >= ds.SETTLING_TRIES }),
    wait: async (ms) => {
      waited += ms
    },
    wasLive: true,
    remote: true,
    least: ds.SETTLING_TRIES,
    gap: ds.SETTLING_MS
  })
  assert.equal(info.connected, true, 'the save still ended on a "no unit" screen')
  assert.equal(n, ds.SETTLING_TRIES)
  assert.equal(waited, ds.SETTLING_MS * (ds.SETTLING_TRIES - 1), 'the asks are not spread across the save')
  // Long enough to cover a save, and no longer than that.
  assert.ok(ds.SETTLING_MS * (ds.SETTLING_TRIES - 1) >= 4000)
  assert.ok(ds.SETTLING_MS * (ds.SETTLING_TRIES - 1) <= 8000)
})

test('a unit that really is gone is still reported after a save', async () => {
  // The other half: the patience is bounded, so an unplugged unit is still
  // named as one rather than asked about for ever.
  let n = 0
  const info = await ds.confirmedDetect({
    detect: async () => {
      n++
      return { connected: false }
    },
    wait: async () => {},
    wasLive: true,
    remote: true,
    least: ds.SETTLING_TRIES
  })
  assert.equal(info.connected, false)
  assert.equal(n, ds.SETTLING_TRIES)
})

test('a save ends with the number and the name, not a whole read of the unit', () => {
  /*
   * "Save takes 60-90 s and locks the page." Three places used to read the
   * whole unit the moment a save landed — the Mac from its own write, the Mac
   * carrying out a save the phone asked for, and the phone hearing back that
   * it landed — with the page busy throughout, to learn which slot the unit
   * is on and what it is called. The save had just settled both. Each of the
   * three now hands the store the answer and a quiet check follows it.
   */
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  /* The patience is still there for the reads that need it. */
  assert.match(app, /const settling = opts\?\.settling === true/, 'read() has no settling read again')
  assert.match(
    app,
    /\.\.\.\(settling \? \{ least: SETTLING_TRIES, gap: SETTLING_MS \} : \{\}\)/,
    'the flag no longer reaches confirmedDetect'
  )
  assert.equal(
    (app.match(/read\(\{ settling: true \}\)/g) || []).length,
    0,
    'a save is followed by a whole read of the unit again, which is what locked the page'
  )
  // Each of the three sits under the record() line for the save it follows.
  for (const after of [
    /Saved "\$\{name \|\| preset\?\.name\}" to slot \$\{req\.slot\}[\s\S]{0,400}?presetSaved\(req\.slot, name \|\| preset\?\.name\)/,
    /The computer saved it to slot \$\{res\.slot\}[\s\S]{0,400}?presetSaved\(res\.slot, queuedSave\.name\)/,
    /Saved "\$\{name \|\| preset\?\.name\}" to slot \$\{number\}[\s\S]{0,700}?presetSaved\(number, name \|\| preset\?\.name\)/
  ]) {
    assert.match(app, after)
  }
})

test('at the computer the first no still stands', async () => {
  /*
   * The other half. There is no relay and no second client on the port, so a
   * no is a no — and putting several seconds in front of everybody who opens
   * the app with nothing plugged in is the cost this avoids.
   */
  let n = 0
  await ds.confirmedDetect({
    detect: async () => {
      n++
      return { connected: false }
    },
    wait: never,
    wasLive: false,
    remote: false
  })
  assert.equal(n, 1, 'the computer now waits out a retry loop for an empty rig')
})

/*
 * The same fault, on the chain read.
 *
 * "Now I'm switching seems I keep getting this error message. Couldn't read
 * the chain from the phone, so there's nothing to switch here yet. Hitting the
 * try again button always fixes it, but it really shouldn't happen."
 *
 * Right on both counts. The presence check was hardened against a busy port
 * and this read never was, so it kept the old behaviour: one ask, one verdict,
 * an error on the screen and a button whose only job was to ask again.
 */
test('a chain that comes back on the second ask is not an error on screen', async () => {
  const answers = [null, [{ id: 1 }]]
  let waited = 0
  const list = await ds.confirmedChain({
    read: async () => answers.shift(),
    wait: async (ms) => {
      waited += ms
    }
  })
  assert.deepEqual(list, [{ id: 1 }], 'the first empty answer was taken as the verdict')
  assert.ok(waited > 0, 'it asked again with no pause at all, which asks the same busy port')
})

test('a chain read that works costs nothing extra', async () => {
  /*
   * Retries are only allowed to spend time on the case that used to show an
   * error. Every preset change runs this, so a pause on the good path would be
   * a pause on every preset change.
   */
  let n = 0
  const list = await ds.confirmedChain({
    read: async () => {
      n++
      return []
    },
    wait: never
  })
  assert.deepEqual(list, [], 'an empty preset is a real answer, not a failed read')
  assert.equal(n, 1, 'a good read was asked for more than once')
})

test('a chain that never reads still reports it, rather than asking for ever', async () => {
  let n = 0
  const list = await ds.confirmedChain({
    read: async () => {
      n++
      return null
    },
    wait: async () => {}
  })
  assert.equal(list, null, 'a unit that will not report its chain was passed off as read')
  assert.equal(n, ds.SETTLE_TRIES, 'it gave up early or kept asking for ever')
})

test('from a phone the chain read gets the relay allowance', async () => {
  /*
   * The read travels a relay to a Mac whose port is already busy with its own
   * polling — the same reason the presence check asks more times from a phone.
   */
  let n = 0
  const list = await ds.confirmedChain({
    read: async () => (++n >= 4 ? [] : null),
    wait: async () => {},
    remote: true
  })
  assert.deepEqual(list, [], 'the phone gave up before the computer was free to answer')
  assert.equal(n, 4)
})

test('nothing was live, so the first answer stands', async () => {
  /*
   * The other half of the rule, and the reason this is not just a retry: an
   * empty rig at startup must still say so at once. Asking three times would
   * put a second and a half in front of every person who opens the app with
   * nothing plugged in.
   */
  let n = 0
  const info = await ds.confirmedDetect({
    detect: async () => {
      n++
      return { connected: false }
    },
    wait: never,
    wasLive: false
  })
  assert.equal(info.connected, false)
  assert.equal(n, 1, 'a rig that was never live was asked more than once')
})

/*
 * The bar, the chip and the notice have to tell one story.
 *
 * A real phone showed all three at once: "NOT CONNECTED" on the left, a chip
 * reading "connected", and a red notice explaining that the Mac was connected
 * and no unit was plugged into it. Every one of them was true about a
 * different thing, and together they were nonsense.
 */
test('a computer that answered with no unit on it does not read as not connected', () => {
  const said = link.describeUnit({
    role: 'remote',
    link: 'connected',
    status: 'fault',
    device: { connected: false }
  })
  assert.equal(said.unit, 'No unit', 'the bar contradicts the chip beside it')
  assert.equal(said.lamp, 'fault', 'a cable the player can go and check is not a quiet state')
})

test('a phone that has not reached the computer stays quiet about it', () => {
  // The reason the bar went quiet in the first place: red over a screen that
  // is calmly asking you to connect is the loud wrong answer.
  for (const state of ['off', 'joining', 'no-answer']) {
    const said = link.describeUnit({ role: 'remote', link: state, status: 'fault' })
    /* A dash, as the phone draws it — the word beside it already says the link is down. */
    assert.equal(said.unit, '—', state)
    assert.equal(said.lamp, 'idle', state)
  }
})

test('a connected phone still reading the unit says so', () => {
  const said = link.describeUnit({ role: 'remote', link: 'connected', status: 'idle' })
  assert.equal(said.unit, 'Looking…')
})

test('a live unit is named, wherever the app is running', () => {
  assert.equal(
    link.describeUnit({ role: 'remote', link: 'connected', status: 'live', device: { short: 'AM4' } })
      .unit,
    'AM4'
  )
  assert.equal(
    link.describeUnit({ role: 'mac', link: 'connected', status: 'live', device: { short: 'FM3' } })
      .unit,
    'FM3'
  )
})

test('at the computer, a missing unit is still a missing device', () => {
  // Nothing above changes the end with the cable in it.
  const said = link.describeUnit({ role: 'mac', link: 'connected', status: 'fault' })
  assert.equal(said.unit, 'No device')
  assert.equal(said.lamp, 'fault')
})

test('the demo lamp outranks whatever the unit is doing', () => {
  assert.equal(link.describeUnit({ demo: true, role: 'mac', status: 'live' }).lamp, 'demo')
  assert.equal(
    link.describeUnit({ demo: true, role: 'remote', link: 'connected', status: 'fault' }).lamp,
    'demo'
  )
})

test('connected means the computer answered, never merely that a channel was joined', () => {
  const base = { role: 'remote', hasSession: true, joining: false, channelUp: true }
  assert.equal(
    link.deriveLink({ ...base, hostSeen: false }),
    'no-answer',
    'a joined channel with nothing answering on it was called connected — the exact lie this replaces'
  )
  assert.equal(link.deriveLink({ ...base, hostSeen: true }), 'connected')
  assert.equal(link.deriveLink({ ...base, channelUp: false, hostSeen: true }), 'no-answer', 'a dropped socket is not connected')
  assert.equal(link.deriveLink({ ...base, joining: true }), 'joining')
  assert.equal(link.deriveLink({ ...base, hasSession: false }), 'signed-out')
  assert.equal(
    link.deriveLink({ ...base, hostSeen: true, wantsAuto: false }),
    'off',
    'a deliberate Disconnect was reported as the computer not answering'
  )
})

test('connected means answered recently, not answered once', () => {
  /*
   * "This is lying saying that a Mac is connected. My Mac is turned off
   * completely so it can't be connected."
   *
   * `hostSeen` is a latch: something answered once and it stays true until a
   * request fails and flips it. While nothing is being asked — which on this
   * screen is most of the time — the word is a memory, and it can be minutes
   * old with the machine it names switched off at the wall.
   */
  const base = { role: 'remote', hasSession: true, joining: false, channelUp: true, hostSeen: true }
  assert.equal(link.deriveLink({ ...base, answeredAgo: 0 }), 'connected')
  assert.equal(
    link.deriveLink({ ...base, answeredAgo: link.STALE_MS + 1 }),
    'no-answer',
    'a computer that has said nothing for twenty seconds is still being called connected'
  )
  // The keepalive asks every eight seconds and gives up after six, so anything
  // inside that plus slack has genuinely been answered and must not flicker.
  assert.equal(link.deriveLink({ ...base, answeredAgo: link.KEEPALIVE + 5000 }), 'connected')
  assert.ok(link.STALE_MS > link.KEEPALIVE + 6000, 'the window is tighter than one unanswered question')
})

test('a computer that never heard the question is asked once, not five times', async () => {
  /*
   * Five attempts at twenty seconds each is a hundred seconds in which the
   * screen can say nothing true — it goes on showing the last thing it knew,
   * which is how a green "connected" survives the Mac being switched off.
   *
   * The asking is for a unit that answers "no" while it loads a preset. A Mac
   * that is off does not answer at all, and one attempt is enough to learn it.
   */
  const silent = Object.assign(new Error('Your computer didn’t answer.'), {})
  assert.equal(ds.macSilent(silent), true, 'a question that was never answered reads as the unit refusing')
  assert.equal(ds.macSilent(Object.assign(new Error('nope'), { linkDown: true })), true)
  assert.equal(ds.macSilent(new Error('port not open')), false, 'a unit that answered is treated as a dead line')

  let asked = 0
  await assert.rejects(
    () =>
      ds.confirmedDetect({
        detect: async () => {
          asked++
          throw silent
        },
        wait: async () => {},
        wasLive: true,
        remote: true
      }),
    /didn’t answer/
  )
  assert.equal(asked, 1, `a dead line was asked ${asked} times`)

  // And a unit that is merely busy still gets every ask it ever had.
  let busy = 0
  await assert.rejects(
    () =>
      ds.confirmedDetect({
        detect: async () => {
          busy++
          throw new Error('timeout')
        },
        wait: async () => {},
        wasLive: false,
        remote: true
      }),
    /timeout/
  )
  assert.equal(busy, ds.RELAY_TRIES, 'a busy port lost the asking it needs')
})

test('the computer is connected when it is listening, and wifi always is', () => {
  assert.equal(link.deriveLink({ role: 'mac', cloudUser: null, hostOn: true }), 'signed-out')
  assert.equal(link.deriveLink({ role: 'mac', cloudUser: { email: 'j@x' }, hostOn: false }), 'off')
  assert.equal(link.deriveLink({ role: 'mac', cloudUser: { email: 'j@x' }, hostOn: true }), 'connected')
  assert.equal(link.deriveLink({ role: 'wifi', hasSession: false, hostSeen: false }), 'connected')
})

test('a wifi phone is not mistaken for the computer', () => {
  /*
   * A page served from the Mac has the helper as its own origin, so the
   * "is the helper at localhost" probe answers yes on the phone too. Only
   * the hostname tells the Mac app's own window from a phone that scanned
   * the QR.
   */
  assert.equal(link.detectRole({ demo: false, served: true, hostname: 'localhost', helperAlive: true }), 'mac')
  assert.equal(link.detectRole({ demo: false, served: true, hostname: '10.0.0.5', helperAlive: true }), 'wifi', 'a phone on wifi was told it is the computer')
  assert.equal(link.detectRole({ demo: false, served: false, hostname: 'fractal.newbold.cloud', helperAlive: true }), 'mac')
  assert.equal(link.detectRole({ demo: false, served: false, hostname: 'fractal.newbold.cloud', helperAlive: false }), 'remote')
  assert.equal(link.detectRole({ demo: true, served: false, hostname: 'x', helperAlive: false }), 'mac', 'demo simulates the computer')
})

test('asking again backs off but never stops', () => {
  const seq = []
  let d = 0
  for (let i = 0; i < 7; i++) {
    d = link.nextDelay(d)
    seq.push(d)
  }
  assert.deepEqual(seq, [3000, 6000, 12000, 24000, 30000, 30000, 30000])
})

test('what the link says contains no plumbing', () => {
  const jargon = /supabase|relay|channel|helper|npm|\.env|uid|anon|realtime|forgefx/i
  const states = []
  for (const role of ['mac', 'wifi', 'remote']) {
    for (const l of ['off', 'signed-out', 'joining', 'no-answer', 'connected']) {
      states.push({ role, link: l, account: { email: 'j@x.com' }, macName: null })
      states.push({ role, link: l, account: null, macName: 'Studio computer' })
    }
  }
  for (const st of states) {
    const said = link.describeLink(st)
    for (const key of ['word', 'sentence', 'note']) {
      assert.ok(!jargon.test(said[key]), `${st.role}/${st.link} ${key}: "${said[key]}"`)
    }
  }
  assert.match(link.describeLink({ role: 'remote', link: 'connected', macName: 'Studio computer' }).sentence, /Connected to Studio computer/)
  assert.equal(link.describeLink({ role: 'remote', link: 'connected' }).tone, 'good')
  assert.equal(link.describeLink({ role: 'remote', link: 'no-answer' }).tone, 'bad', 'no answer must read as a fault, not as connected')
  // The Mac's chip names the thing, not the chore: "set up" beside Save read as another verb.
  assert.equal(link.describeLink({ role: 'mac', link: 'signed-out', account: null }).word, 'remote')
})


console.log('\npairing')
/*
 * The phone was asked for an email and a password before it would do
 * anything. "User shouldn't be required to sign in unless they want to save
 * and sync across the cloud. It's requiring a login to connect." The relay
 * still needs an account at both ends; the code stands for one nobody sees.
 */
import * as pairing from '../shared/pairing.mjs'




test('a paired account is told apart from a person’s, so no screen shows it as an email', () => {
  assert.ok(pairing.isPairAccount('pair-abcdefgh@pair.fractal.newbold.cloud'))
  assert.ok(!pairing.isPairAccount('justin@example.com'))
  assert.ok(!pairing.isPairAccount('pair-abcdefgh@example.com'), 'anyone with a pair- address would be shown as paired')
  assert.ok(!pairing.isPairAccount(null))
  const paired = { email: 'pair-abcdefgh@pair.fractal.newbold.cloud' }
  for (const l of ['connected', 'off']) {
    const said = link.describeLink({ role: 'mac', link: l, account: paired })
    assert.ok(!/pair-abcdefgh|@/.test(said.sentence + said.note), `${l}: ${said.sentence} / ${said.note}`)
  }
  assert.match(link.describeLink({ role: 'mac', link: 'connected', account: paired }).sentence, /paired/i)
  assert.match(link.describeLink({ role: 'mac', link: 'connected', account: { email: 'j@x.com' } }).sentence, /for j@x.com/)
})




console.log('\ntyping a tempo')
/*
 * "On the tap button, let's do where they hold the tap button they can
 * manually enter in the beats per minute they want. On the Mac let them right
 * click to pull up the text box to enter the BPM." The check on what was typed
 * is shared with the phone apps, so both refuse the same things in the same
 * words.
 */
import * as tempo from '../shared/tempo.mjs'

test('a typed tempo is a whole number inside the unit’s range', () => {
  assert.deepEqual(tempo.checkBpm('120'), { bpm: 120 })
  assert.deepEqual(tempo.checkBpm(' 132 '), { bpm: 132 })
  assert.deepEqual(tempo.checkBpm('99.6'), { bpm: 100 }, 'a decimal is rounded, not refused')
  assert.deepEqual(tempo.checkBpm(''), { empty: true }, 'nothing typed is not an error')
  assert.deepEqual(tempo.checkBpm(null), { empty: true })
  assert.equal(tempo.BPM_MIN, 20)
  assert.equal(tempo.BPM_MAX, 400)
})

test('an impossible tempo is refused in words, never clamped', () => {
  for (const bad of ['19', '401', '0', '9999']) {
    const out = tempo.checkBpm(bad)
    assert.ok(out.error, `${bad} was accepted`)
    assert.match(out.error, /20 to 400/, `${bad}: the range is not named`)
    assert.equal(out.bpm, undefined, `${bad} was clamped into a tempo nobody typed`)
  }
  assert.match(tempo.checkBpm('fast').error, /number/i)
  assert.match(tempo.checkBpm('1x0').error, /number/i)
})

test('the Tap button opens the tempo box on a hold or a right-click, at both ends', () => {
  /* The button is TapTempo's now — Play and Edit both draw it — so that is where its hold is read. */
  const gig = readSrc(new URL('../src/components/TapTempo.jsx', import.meta.url), 'utf8')
  assert.match(gig, /const holdTap = useLongPress\(/, 'Tap cannot be held')
  assert.match(gig, /className=\{`\$\{where === 'row' \? 'chip' : 'gig-bar-btn'\} gig-tap`\}[^>]*\{\.\.\.holdTap\}/, 'the hold is not on the Tap button')
  /* The hold leaves the tap's read-back running: that read is what takes the
     tapped figure off the button. Cancelled, the figure stayed there over a
     tempo typed straight after, and looked like the typing had not taken. */
  const hold = gig.slice(gig.indexOf('const holdTap = useLongPress'), gig.indexOf('useDismiss(tapCell'))
  assert.match(hold, /setTyping\(true\)/, 'a hold does not open the box')
  assert.ok(!/clearTimeout\(reread\.current\)/.test(hold), 'a hold throws away the read-back, so the tapped number stays on the button over a typed tempo')
  assert.match(gig, /<BpmBox bpm=\{bpm\} autoFocus onSet=\{typeTempo\}/, 'the box does not open with the tempo selected')
  assert.match(gig, /await setTempo\(n\)\s*\n\s*await refreshTempo\(\)/, 'a typed tempo is sent but the number on the button is not re-read')
  assert.match(gig, /useDismiss\(tapCell, \(\) => setTyping\(false\), \{ open: typing \}\)/, 'nothing closes the box on a tap elsewhere or Escape')
  // The box itself refuses with the shared words, and no longer sits unused in App.
  const box = readSrc(new URL('../src/components/BpmBox.jsx', import.meta.url), 'utf8')
  assert.match(box, /checkBpm\(typed\)/, 'the box has its own idea of a valid tempo')
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.ok(!/function BpmBox/.test(app), 'the tempo box is still defined in App.jsx, where nothing renders it')
  // The phone app: the same hold, the same check, from the same source.
  const press = readSrc(new URL('../mobile/src/components/Press.js', import.meta.url), 'utf8')
  assert.match(press, /onLongPress=\{\s*onLongPress/, 'the phone’s button cannot be held')
  const stage = readSrc(new URL('../mobile/src/screens/Stage.js', import.meta.url), 'utf8')
  assert.match(stage, /label="Tap"[^>]*onLongPress=\{\(\) => setTyping\(true\)\}/, 'holding Tap on the phone does nothing')
  /*
   * The box moved out of the stage screen and into an overlay of its own — the
   * keyboard was covering it where it was, at the foot, which is exactly where
   * iOS opens one. The rule being checked is unchanged: the phone must not have
   * its own idea of a valid tempo.
   */
  const tempoBox = readSrc(new URL('../mobile/src/components/TempoBox.js', import.meta.url), 'utf8')
  assert.match(tempoBox, /checkBpm\(typed\)/, 'the phone checks a typed tempo by its own rule')
  assert.match(tempoBox, /<Modal visible=\{!!open\}/, 'the tempo box is back in the page, where the keyboard covers it')
  /* The write is the screen's to hand down and the box's to call, so both ends
     of that are checked: a box wired to nothing looks identical to one that
     works until somebody types into it. */
  assert.match(stage, /onSet=\{writeTempo\}/, 'the tempo box is handed no way to write a tempo')
  assert.match(tempoBox, /await onSet\(checked\.bpm\)/, 'a typed tempo on the phone goes nowhere')
  const sync = readSrc(new URL('../scripts/sync-relay-rules.mjs', import.meta.url), 'utf8')
  assert.match(sync, /shared\/tempo\.mjs.*mobile\/src\/lib\/tempo\.js/, 'the phone’s copy of the tempo rule is not generated')
})


console.log('\nthe computer app closes, updates, and reopens')
/*
 * "It does say that there's an update available and then it says install.
 * After installing it says to close the app or you clicked the button and it
 * closes the app and restarts and then it still says the same update is
 * available. … It said that ForgeFX was currently using the port. The only way
 * to get around it was to restart the Mac completely. … The app does not close
 * out all the way when you click the close button."
 */

test('closing the window quits the app, through the same shutdown as ⌘Q', () => {
  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')
  assert.match(main, /app\.on\('window-all-closed', \(\) => \{\s*\n\s*if \(!quitting\) app\.quit\(\)/, 'closing the window leaves the app running with nothing on screen')
  assert.ok(!/app\.on\('window-all-closed', \(\) => \{\}\)/.test(main), 'the window-close no-op is back')
})

test('a device server this app left behind is stopped, not reported', async () => {
  const bundle = '/Applications/Fractal Remote.app/Contents/Resources/vendor/forgefx/server/dist/index.js'
  const exe = '/Applications/Fractal Remote.app/Contents/MacOS/Fractal Remote'
  assert.ok(host.isOurServer(`${exe} ${bundle}`), 'the server inside our own bundle is not recognised as ours')
  assert.ok(host.isOurServer(`${exe} /Applications/Fractal Remote.app/Contents/Resources/app/lib/child.cjs ${bundle}`), 'the server run through our wrapper is not recognised')
  assert.ok(!host.isOurServer('node /Users/j/src/forgefx/server/dist/index.js'), 'somebody’s own ForgeFX in a Terminal would be killed')
  assert.ok(!host.isOurServer(`${exe} something-else.js`), 'a process of ours that is not the server would be killed')
  assert.ok(!host.isOurServer(''))

  // lsof says who listens; ps says what they are. Only ours are touched.
  const ps = { 4242: `${exe} ${bundle}`, 5151: 'node /Users/j/src/forgefx/server/dist/index.js' }
  const run = (cmd, args) => {
    if (cmd === 'lsof') return '4242\n5151\n'
    if (cmd === 'ps') return ps[args[args.length - 1]] || ''
    throw new Error(`unexpected ${cmd}`)
  }
  assert.deepEqual(host.listeners({ port: 5056, run }).map((p) => p.pid), [4242, 5151])
  assert.deepEqual(host.listeners({ port: 5056, run: () => { throw new Error('no lsof') } }), [], 'a computer without lsof is a crash instead of a no-op')

  const signals = []
  let living = new Set([4242, 5151])
  const polite = await host.reclaimPort({
    port: 5056,
    run,
    kill: (pid, sig) => {
      signals.push([pid, sig])
      if (sig === 'SIGTERM') living.delete(pid)
    },
    alive: (pid) => living.has(pid),
    sleep: async () => {}
  })
  assert.equal(polite, 'reclaimed')
  assert.deepEqual(signals, [[4242, 'SIGTERM']], 'the stranger’s ForgeFX was signalled, or ours was killed without being asked first')

  // One that ignores SIGTERM is killed; one that survives even that is reported, never waited on for ever.
  signals.length = 0
  living = new Set([4242])
  const forced = await host.reclaimPort({
    port: 5056,
    run,
    kill: (pid, sig) => {
      signals.push([pid, sig])
      if (sig === 'SIGKILL') living.delete(pid)
    },
    alive: (pid) => living.has(pid),
    sleep: async () => {}
  })
  assert.equal(forced, 'reclaimed')
  assert.deepEqual(signals, [[4242, 'SIGTERM'], [4242, 'SIGKILL']])
  const immortal = await host.reclaimPort({ port: 5056, run, kill: () => {}, alive: () => true, sleep: async () => {} })
  assert.equal(immortal, 'failed')
  assert.equal(await host.reclaimPort({ port: 5056, run: () => '' }), 'none')

  // And the app tries this before it gives up and shows the box.
  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')
  const check = main.slice(main.indexOf('if (held.forgefx)'), main.indexOf('const forgefx = findForgeFX'))
  assert.match(check, /await reclaimPort\(/, 'a stray server of ours still stops the app opening')
  assert.ok(check.indexOf('reclaimPort(') < check.indexOf("showErrorBox('ForgeFX is already running'"), 'the box is shown before the sweep')
})

test('the device server leaves when the app does, however the app goes', () => {
  const wrapper = readSrc(new URL('../desktop/lib/child.cjs', import.meta.url), 'utf8')
  assert.match(wrapper, /process\.ppid !== parent\) process\.exit\(0\)/, 'the wrapper never notices its parent has gone')
  assert.match(wrapper, /import\(pathToFileURL\(entry\)\.href\)/, 'the wrapper does not start the server')
  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')
  assert.match(main, /spawn\(process\.execPath, \[wrapperPath\(\), join\(forgefx, 'server', 'dist', 'index\.js'\)\]/, 'the server is started bare, so a Force Quit orphans it')
  // It has to ship as a real file: the shell is packed into app.asar, and a
  // script run by the Electron binary as Node needs a plain path.
  const builder = readSrc(new URL('../desktop/electron-builder.yml', import.meta.url), 'utf8')
  assert.match(builder, /- lib\/\*\*/, 'lib/ is not packaged, so the wrapper is missing from the installed app')
  assert.match(builder, /asarUnpack:\s*\n\s*- lib\/child\.cjs/, 'the wrapper is inside app.asar, where a Node child cannot be started from')
  assert.match(main, /app\.asar\.unpacked/, 'the spawn points into app.asar rather than at the unpacked file')
})

test('an install that did not take is said so, with why', async () => {
  assert.equal(updates.installOutcome({ marker: { version: '7.113.0' }, version: '7.82.0' }), 'stuck')
  assert.equal(updates.installOutcome({ marker: { version: '7.113.0' }, version: '7.113.0' }), 'installed')
  assert.equal(updates.installOutcome({ marker: { version: '7.113.0' }, version: '7.114.0' }), 'installed', 'a newer version than expected reads as a failure')
  assert.equal(updates.installOutcome({ marker: null, version: '7.113.0' }), null)
  assert.equal(updates.installOutcome({ marker: { version: null }, version: '7.113.0' }), null)
  assert.equal(updates.compareVersions('7.9.0', '7.10.0'), -1, 'versions are compared as text, so 7.9 beats 7.10')
  assert.equal(updates.compareVersions('7.10.0', '7.10'), 0)
  assert.match(updates.updateLine({ kind: 'stuck', version: '7.113.0' }), /7\.113\.0 didn’t install/)
  assert.match(updates.updateLine({ kind: 'misplaced' }), /Applications/)
  assert.match(updates.updateLine({ kind: 'staging', version: '7.113.0' }), /Preparing 7\.113\.0/)
  assert.match(updates.updateLine({ kind: 'trouble', message: 'Code signature did not pass validation' }), /Code signature/, 'macOS’s reason is dropped from the menu')

  // The note is written before the app starts shutting anything down.
  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')
  const install = main.slice(main.indexOf("ipcMain.handle('updates:install'"), main.indexOf('updates.install()'))
  assert.match(install, /writeMarker\(\{ version: update\.version/, 'nothing records which version the install was meant to reach')
  assert.ok(install.indexOf('writeMarker(') < install.indexOf('await stopServing()'), 'the note is written after the server is already going down')
  // And read back on the way in, before any new download is started.
  const begin = main.slice(main.indexOf('async function beginUpdates'), main.indexOf('app.whenReady'))
  assert.match(begin, /installOutcome\(\{ marker, version: app\.getVersion\(\) \}\)/, 'the note is never read back')
  assert.match(begin, /if \(outcome === 'stuck'\) \{[\s\S]*?shipItLog\(\)\.then[\s\S]*?return/, 'a stuck install is followed by the same download again')
  assert.ok(!/detail: await shipItLog/.test(begin), 'reading the system log holds the window up')
  assert.match(begin, /if \(misplaced\) \{\s*\n\s*publish\(\{ kind: 'misplaced' \}\)\s*\n\s*return/, 'an app macOS cannot replace still downloads updates it cannot install')
})

test('ready means macOS has the update, not merely that we downloaded it', async () => {
  /*
   * The library downloads the file and says "downloaded"; then macOS's own
   * updater takes a copy and checks it, and only then can anything install.
   * The app called the first one ready, so Restart pressed in between did
   * nothing but close the app.
   */
  const seen = []
  const u = fakeUpdater()
  const n = fakeUpdater()
  updates.wireUpdates({ updater: u, native: n, onState: (s) => seen.push(s) })
  u.emit('update-available', { version: '7.113.0' })
  u.emit('update-downloaded', { version: '7.113.0' })
  assert.equal(seen.at(-1).kind, 'staging', 'the library’s download is called ready before macOS has it')
  assert.equal(seen.at(-1).version, '7.113.0')
  n.emit('update-downloaded')
  assert.deepEqual(seen.at(-1), { kind: 'ready', version: '7.113.0' })
  n.emit('error', new Error('Code signature at URL file:///x did not pass validation\nmore'))
  assert.equal(seen.at(-1).kind, 'trouble')
  assert.equal(seen.at(-1).message, 'Code signature at URL file:///x did not pass validation', 'macOS’s reason is not carried to the screen')
  // Without the native updater (tests, other platforms) the library's word is the only one.
  const plain = []
  const p = fakeUpdater()
  updates.wireUpdates({ updater: p, onState: (s) => plain.push(s) })
  p.emit('update-downloaded', { version: '7.113.0' })
  assert.equal(plain.at(-1).kind, 'ready')
  // main.js hands the native updater in.
  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')
  assert.match(main, /const \{ autoUpdater: native \} = require\('electron'\)/, 'the native updater is never listened to')
  assert.match(main, /wireUpdates\(\{\s*\n\s*updater: autoUpdater,\s*\n\s*native,/, 'the native updater is not handed to wireUpdates')
})

test('Check for updates after one is ready keeps it ready, and never asks macOS twice', async () => {
  /*
   * "It should update when I go to the settings and click check for updates.
   * That isn't working. Only force closing and restarting works." macOS takes
   * one update per run; asking again found the same version (or a newer one),
   * said Preparing… for ever, and took the Restart button with it.
   */
  const seen = []
  const u = fakeUpdater()
  const n = fakeUpdater()
  const { check } = updates.wireUpdates({ updater: u, native: n, onState: (s) => seen.push(s) })
  await check()
  u.emit('update-available', { version: '1.86.73' })
  u.emit('update-downloaded', { version: '1.86.73' })
  n.emit('update-downloaded')
  assert.deepEqual(seen.at(-1), { kind: 'ready', version: '1.86.73' })
  await check()
  await check()
  assert.equal(u.checked, 1, 'asked again once macOS already holds an update')
  assert.deepEqual(seen.at(-1), { kind: 'ready', version: '1.86.73' }, 'the Restart button went away')
  // Before anything is held, a check is a check — and "staging" alone is not held.
  const p = fakeUpdater()
  const pn = fakeUpdater()
  const later = updates.wireUpdates({ updater: p, native: pn, onState: () => {} })
  p.emit('update-downloaded', { version: '1.86.74' })
  await later.check()
  assert.equal(p.checked, 1)
})

test('a check asks GitHub what is there now, and says when the Mac version is still being built', async () => {
  /*
   * "I keep clicking check for updates and it says no updates available. The
   * only way I can check for an update is to force close the app and restart
   * it." A release is on GitHub ten minutes before its Mac files are, and the
   * web pages the library reads can be minutes old.
   */
  const release = (tag, names) => ({
    tag_name: tag,
    html_url: `https://github.com/justinnewbold/fractal-remote/releases/tag/${tag}`,
    assets: names.map((name) => ({ name }))
  })
  const done = ['latest-mac.yml', 'Fractal-Remote-1.86.76-arm64-mac.zip', 'Fractal-Remote-1.86.76-mac.zip']
  assert.deepEqual(updates.releaseVerdict(release('v1.86.76', done), '1.86.75'), {
    kind: 'newer',
    version: '1.86.76',
    feed: 'https://github.com/justinnewbold/fractal-remote/releases/download/v1.86.76'
  })
  assert.deepEqual(updates.releaseVerdict(release('v1.86.76', ['Fractal-Remote-1.86.76.AppImage']), '1.86.75'), { kind: 'building', version: '1.86.76' })
  assert.deepEqual(updates.releaseVerdict(release('v1.86.75', done), '1.86.75'), { kind: 'same', version: '1.86.75' })
  assert.equal(updates.releaseVerdict({ ...release('v1.86.76', done), draft: true }, '1.86.75'), null)
  assert.equal(updates.releaseVerdict(null, '1.86.75'), null)
  assert.equal(updates.newerThan('1.86.10', '1.86.9'), true, 'compared as text')
  assert.equal(updates.newerThan('1.86.9', '1.86.10'), false)

  // Still being built: said, and the library is not asked to fail at it.
  const seen = []
  const u = fakeUpdater()
  const building = updates.wireUpdates({ updater: u, onState: (s) => seen.push(s), running: '1.86.75', lookup: async () => release('v1.86.76', []) })
  await building.check()
  assert.equal(u.checked, 0)
  assert.deepEqual(seen.at(-1), { kind: 'building', version: '1.86.76' })
  assert.match(updates.updateLine(seen.at(-1)), /1\.86\.76 is still being built/)

  // Ready on GitHub: the library is pointed at exactly that release, then asked.
  const v = fakeUpdater()
  let feed = null
  v.setFeedURL = (f) => {
    feed = f
  }
  const ready = updates.wireUpdates({ updater: v, onState: () => {}, running: '1.86.75', lookup: async () => release('v1.86.76', done) })
  await ready.check()
  assert.deepEqual(feed, { provider: 'generic', url: 'https://github.com/justinnewbold/fractal-remote/releases/download/v1.86.76' })
  assert.equal(v.checked, 1)

  // No answer from the API: the library's own check still happens.
  const w = fakeUpdater()
  const offline = updates.wireUpdates({ updater: w, onState: () => {}, running: '1.86.75', lookup: async () => { throw new Error('offline') } })
  await offline.check()
  assert.equal(w.checked, 1)

  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')
  assert.match(main, /api\.github\.com\/repos\/justinnewbold\/fractal-remote\/releases\/latest/)
  assert.match(main, /running: app\.getVersion\(\),\s*\n\s*lookup: async/)
})

test('an app run from Downloads is offered a home in Applications first', () => {
  assert.deepEqual(updates.installPlace({ exePath: '/private/var/folders/zz/T/AppTranslocation/ABC/d/Fractal Remote.app/Contents/MacOS/Fractal Remote', inApplications: false }), { ok: false, reason: 'translocated' })
  assert.deepEqual(updates.installPlace({ exePath: '/Users/j/Downloads/Fractal Remote.app/Contents/MacOS/Fractal Remote', inApplications: false }), { ok: false, reason: 'not-applications' })
  assert.deepEqual(updates.installPlace({ exePath: '/Applications/Fractal Remote.app/Contents/MacOS/Fractal Remote', inApplications: true }), { ok: true })
  const main = readSrc(new URL('../desktop/main.js', import.meta.url), 'utf8')
  assert.match(main, /if \(!\(await settleInPlace\(\)\)\) return/, 'the app starts serving before asking where it lives')
  assert.ok(main.indexOf('await settleInPlace()') < main.indexOf('const answering = await start()'), 'the move is offered after the server is already running from the wrong place')
  assert.match(main, /app\.moveToApplicationsFolder\(\{ conflictHandler: \(\) => true \}\)/, 'moving never replaces the older copy already in Applications')
  assert.match(main, /buttons: \['Move to Applications', 'Not now'\]/, 'the move is done without asking, or asked in other words')
  const ui = readSrc(new URL('../src/components/Updates.jsx', import.meta.url), 'utf8')
  assert.match(ui, /moveToApplications/, 'Setup offers no way to move the app once the launch-time offer was declined')
  assert.match(ui, /Download from GitHub/, 'a stuck install offers no other way to the new version')
  assert.match(ui, /state\?\.detail[\s\S]*?Technical details/, 'what macOS wrote about the failed install is not shown anywhere')
})


console.log('\nasking for less volume')











test('Previous and Next step through the slots, the stars, or a setlist', () => {
  /*
   * "Hitting next or previous cycles through songs on the favorites or
   * setlists." The two buttons walked the slots one at a time, which is the
   * unit's order and never the night's.
   */
  const { nextIn, stepTarget, positionIn, orderFor, sourceLabel, ALL, STARRED } = setlists

  // A list is walked in its own order, and it wraps: the encore is followed
  // by the opener, not by a dead button.
  assert.equal(nextIn([40, 7, 200], 40, 1), 7)
  assert.equal(nextIn([40, 7, 200], 7, 1), 200)
  assert.equal(nextIn([40, 7, 200], 200, 1), 40, 'the last song does not wrap to the first')
  assert.equal(nextIn([40, 7, 200], 40, -1), 200, 'the first song does not wrap back to the last')
  assert.equal(nextIn([40, 7, 200], 7, -1), 40)

  // Off the list, Next goes to the first song and Previous to the last —
  // what choosing a setlist mid-song on a stray preset should do.
  assert.equal(nextIn([40, 7, 200], 99, 1), 40)
  assert.equal(nextIn([40, 7, 200], 99, -1), 200)
  assert.equal(nextIn([40, 7, 200], undefined, 1), 40)
  assert.equal(nextIn([], 5, 1), null, 'an empty list has somewhere to go')
  assert.equal(nextIn([5], 5, 1), 5, 'a list of one goes nowhere but itself')

  assert.equal(positionIn([40, 7, 200], 7), 2)
  assert.equal(positionIn([40, 7, 200], 99), 0)

  // The slots view is what it always was: one step, no wrap, never below 0.
  assert.equal(stepTarget({ source: ALL, current: 44, delta: 1 }), 45)
  assert.equal(stepTarget({ source: ALL, current: 44, delta: -1 }), 43)
  assert.equal(stepTarget({ source: ALL, current: 0, delta: -1 }), null, 'Previous goes below slot 0')
  assert.equal(stepTarget({ source: ALL, current: undefined, delta: 1 }), 1)

  // Starred steps the stars in slot order, however they were starred.
  const favourites = [300, 12, 45]
  assert.deepEqual(orderFor(STARRED, { favourites }), [300, 12, 45])
  assert.equal(stepTarget({ source: STARRED, current: 12, delta: 1, favourites, lists: [] }), 45)
  assert.equal(stepTarget({ source: STARRED, current: 45, delta: 1, favourites, lists: [] }), 300)
  assert.equal(stepTarget({ source: STARRED, current: 12, delta: 1, favourites: [], lists: [] }), null, 'nothing starred, and Next still has somewhere to go')

  // A setlist steps in its own order, and a deleted one falls back to the slots.
  const lists = [{ id: 'sat', name: 'Saturday', presets: [45, 12, 300] }]
  assert.equal(stepTarget({ source: 'sat', current: 45, delta: 1, favourites, lists }), 12)
  assert.equal(stepTarget({ source: 'sat', current: 45, delta: -1, favourites, lists }), 300)
  assert.equal(stepTarget({ source: 'gone', current: 45, delta: 1, favourites, lists }), 46, 'a missing setlist killed the buttons')
  assert.equal(orderFor(ALL, { favourites, lists }), null)

  assert.equal(sourceLabel(ALL, { lists }), 'All presets')
  assert.equal(sourceLabel(STARRED, { lists }), 'Starred')
  assert.equal(sourceLabel('sat', { lists }), 'Saturday')
  assert.equal(sourceLabel('gone', { lists }), 'All presets')
})

test('a setlist is built, reordered and kept per unit', () => {
  const { addTo, removeFrom, moveIn, createList, updateList, deleteList, listsFor, sourceFor, setSource, ALL, STARRED } = setlists

  // Building: no song twice, and the order is the order it was built in.
  assert.deepEqual(addTo([], 45), [45])
  assert.deepEqual(addTo([45], 12), [45, 12])
  assert.deepEqual(addTo([45, 12], 45), [45, 12], 'the same song was added twice')
  assert.deepEqual(addTo([45], -1), [45])
  assert.deepEqual(addTo([45], 1.5), [45])
  assert.deepEqual(removeFrom([45, 12, 300], 12), [45, 300])

  // Nudging: up, down, and nowhere past the ends.
  assert.deepEqual(moveIn([1, 2, 3], 0, 1), [2, 1, 3])
  assert.deepEqual(moveIn([1, 2, 3], 2, 1), [1, 3, 2])
  assert.deepEqual(moveIn([1, 2, 3], 0, -1), [1, 2, 3], 'the first song moved above the top')
  assert.deepEqual(moveIn([1, 2, 3], 2, 3), [1, 2, 3], 'the last song moved below the bottom')

  // Stored per unit, like the stars, and read back clean.
  const mem = new Map()
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v)
  }
  assert.deepEqual(listsFor('fm3', store), [])
  assert.equal(sourceFor('fm3', store), ALL, 'a fresh unit does not step the slots')

  const sat = createList('fm3', 'Saturday', store)
  assert.equal(sat.name, 'Saturday')
  assert.deepEqual(sat.presets, [])
  const untitled = createList('fm3', '   ', store)
  assert.equal(untitled.name, 'Setlist 2', 'a blank name is not given a name')
  assert.notEqual(sat.id, untitled.id)

  updateList('fm3', sat.id, { presets: [45, 12, 45, -3, 'x', 300] }, store)
  assert.deepEqual(listsFor('fm3', store).find((l) => l.id === sat.id).presets, [45, 12, 300], 'junk in a stored list survived the read')
  updateList('fm3', sat.id, { name: 'Sat night' }, store)
  assert.equal(listsFor('fm3', store)[0].name, 'Sat night')

  assert.deepEqual(listsFor('am4', store), [], 'one unit is reading another unit\'s setlists')

  // The chosen source sticks, and a setlist that goes takes its choice with it.
  assert.equal(setSource('fm3', sat.id, store), sat.id)
  assert.equal(sourceFor('fm3', store), sat.id)
  assert.equal(sourceFor('am4', store), ALL, 'a choice crossed between two units')
  assert.equal(setSource('fm3', STARRED, store), STARRED)
  assert.equal(setSource('fm3', 'nonsense', store), ALL, 'an unknown setlist id was kept as the source')
  setSource('fm3', sat.id, store)
  deleteList('fm3', sat.id, store)
  assert.equal(listsFor('fm3', store).length, 1)
  assert.equal(sourceFor('fm3', store), ALL, 'the buttons still follow a deleted setlist')

  // Nothing readable is nothing, never a throw.
  assert.deepEqual(listsFor('fm3', { getItem: () => '{not json', setItem: () => {} }), [])
  assert.equal(sourceFor('fm3', { getItem: () => '[]', setItem: () => {} }), ALL)
  assert.deepEqual(listsFor('fm3', { getItem: () => { throw new Error('blocked') }, setItem: () => {} }), [])
})





console.log('\nwhy a preset makes no sound')

test('the report names what would keep a preset quiet, in a player\'s words', async () => {
  const { silenceFaults, atMinimum } = await import('../src/lib/presetReport.js')

  // A preset with no output block: the fault Justin's built presets had, and
  // the reason the volume slider had nothing to move.
  const noOut = silenceFaults({
    blocks: [
      { slug: 'input', name: 'Input 1', effectId: 37, col: 0, fromRows: [] },
      { slug: 'drive', name: 'Drive 1', effectId: 100, col: 1, fromRows: [1] },
      { slug: 'amp', name: 'Amp 1', effectId: 106, col: 2, fromRows: [1] }
    ]
  })
  assert.equal(noOut.length, 1)
  assert.match(noOut[0], /no Output block/i)

  // And the same fault from the other end, which is the one a chain built into
  // a genuinely empty preset used to have: every block there, every value set,
  // and the guitar never reaching the first of them.
  const noIn = silenceFaults({
    blocks: [
      { slug: 'drive', name: 'Drive 1', effectId: 100, col: 0, fromRows: [] },
      { slug: 'amp', name: 'Amp 1', effectId: 106, col: 1, fromRows: [1] },
      { slug: 'output', name: 'Out 1', effectId: 2, col: 2, fromRows: [1] }
    ]
  })
  assert.equal(noIn.length, 1)
  assert.match(noIn[0], /no Input block/i)

  // A unit with no grid takes its signal in some other way; a four-slot block
  // list with no Input in it is not a broken preset.
  assert.deepEqual(
    silenceFaults({
      blocks: [
        { slug: 'amp', name: 'Amp 1', effectId: 106 },
        { slug: 'output', name: 'Out 1', effectId: 2 }
      ]
    }),
    []
  )

  // A block nothing is wired into. The leftmost is fed by the input, not by a
  // row, so it is never accused; a driver that reports no rows at all is not
  // either.
  const orphan = silenceFaults({
    blocks: [
      { slug: 'input', name: 'Input 1', effectId: 37, col: 0, fromRows: [] },
      { slug: 'amp', name: 'Amp 1', effectId: 106, col: 1, fromRows: [1] },
      { slug: 'cab', name: 'Cab 1', effectId: 111, col: 2, fromRows: [] },
      { slug: 'output', name: 'Out 1', effectId: 2, col: 3, fromRows: [1] }
    ]
  })
  assert.equal(orphan.length, 1)
  assert.match(orphan[0], /Cab 1/)
  assert.ok(!/Amp 1/.test(orphan[0]), 'the first block in the row is accused of having nothing before it')
  assert.deepEqual(
    silenceFaults({
      blocks: [
        { slug: 'input', name: 'Input 1', effectId: 37, col: 0 },
        { slug: 'amp', name: 'Amp 1', effectId: 106, col: 1 },
        { slug: 'output', name: 'Out 1', effectId: 2, col: 2 }
      ]
    }),
    [],
    'a unit that does not report its wiring is told it has none'
  )

  // Everything off in this scene, said with the scene's own name.
  const off = silenceFaults({
    blocks: [
      { slug: 'input', name: 'Input 1', effectId: 37, col: 0, fromRows: [] },
      { slug: 'amp', name: 'Amp 1', effectId: 106, col: 1, fromRows: [1], bypassed: true },
      { slug: 'cab', name: 'Cab 1', effectId: 111, col: 2, fromRows: [1], bypassed: true },
      { slug: 'output', name: 'Out 1', effectId: 2, col: 3, fromRows: [1] }
    ],
    sceneName: 'KILLING'
  })
  assert.equal(off.length, 1)
  assert.match(off[0], /Every block is off in KILLING/)

  // A level sitting on its floor — a preset that is perfect and inaudible.
  const down = silenceFaults({
    blocks: [
      { slug: 'input', name: 'Input 1', effectId: 37, col: 0, fromRows: [] },
      { slug: 'amp', name: 'Amp 1', effectId: 106, col: 1, fromRows: [1] },
      { slug: 'output', name: 'Out 1', effectId: 2, col: 2, fromRows: [1] }
    ],
    params: {
      2: [{ id: 1, name: 'Level', value: -80, min: -80, max: 20, unit: 'dB' }],
      106: [{ id: 2, name: 'Gain 1', value: 0, min: 0, max: 10 }]
    }
  })
  assert.equal(down.length, 1, 'a gain at zero is not silence and a level at -80 is')
  assert.match(down[0], /Out 1 — Level is all the way down at -80 dB\./)

  assert.equal(atMinimum({ value: -80, min: -80, max: 20 }), true)
  assert.equal(atMinimum({ value: -79, min: -80, max: 20 }), false)
  assert.equal(atMinimum({ value: 5, min: 5, max: 5 }), false, 'a range of nothing is a minimum of nothing')

  // And a preset with nothing wrong says so by saying nothing.
  assert.deepEqual(
    silenceFaults({
      blocks: [
        { slug: 'input', name: 'Input 1', effectId: 37, col: 0, fromRows: [] },
        { slug: 'amp', name: 'Amp 1', effectId: 106, col: 1, fromRows: [1] },
        { slug: 'output', name: 'Out 1', effectId: 2, col: 2, fromRows: [1] }
      ],
      params: { 2: [{ id: 1, name: 'Level', value: 0, min: -80, max: 20, unit: 'dB' }] }
    }),
    []
  )
})

test('the report carries the grid in the unit\'s own words', async () => {
  const { formatPresetReport } = await import('../src/lib/presetReport.js')
  const text = formatPresetReport({
    header: { app: 'test' },
    preset: { number: 492, name: 'RATM Morello Rig' },
    sceneIndex: 0,
    sceneName: 'KILLING',
    blocks: [{ slug: 'amp', name: 'Amp 1', effectId: 106, row: 1, col: 0, channel: 'D', fromRows: [] }],
    params: { 106: [{ id: 2, name: 'Gain 1', value: 8.5, min: 0, max: 10 }] },
    grid: { rows: 4, cols: 12, cells: [{ row: 1, col: 0, effectId: 106 }] },
    faults: ['There is no Output block in this preset.']
  })
  assert.match(text, /preset: 492 RATM Morello Rig/)
  assert.match(text, /scene: 1 KILLING/)
  assert.match(text, /- There is no Output block/)
  assert.match(text, /Amp 1 \| row 1 col 0 \| on \| D \| nothing/, 'the blocks table lost where a block is or what feeds it')
  assert.match(text, /Amp 1 \| Gain 1 \| 8\.5 \| 0–10/, 'the values table lost a value or its range')
  // Raw, not paraphrased: the shape of this is the thing being investigated.
  assert.match(text, /\{"rows":4,"cols":12/, 'the grid is summarised instead of quoted')
  // And a preset with nothing wrong still says that out loud.
  assert.match(
    formatPresetReport({ blocks: [], faults: [] }),
    /Nothing this read can see/
  )
})

console.log('\nsetlists that follow the account')

test('two devices merge per setlist and per star, not per device', async () => {
  const { mergeUnit, mergeUnits, gained } = await import('../src/lib/cloudSetlists.js')

  // A list built on each device: both survive meeting each other. The device
  // asking keeps its own order and the other's are appended.
  const mine = { lists: [{ id: 'a', name: 'Friday', presets: [1, 2], at: 100 }], at: 100 }
  const theirs = { lists: [{ id: 'b', name: 'Saturday', presets: [7], at: 90 }], at: 90 }
  const both = mergeUnit(mine, theirs)
  assert.deepEqual(both.lists.map((l) => l.id), ['a', 'b'], 'a setlist built on the other device was dropped')

  // The same list edited on both: the later edit wins, whole.
  const edited = mergeUnit(
    { lists: [{ id: 'a', name: 'Friday', presets: [1], at: 100 }] },
    { lists: [{ id: 'a', name: 'Friday night', presets: [1, 2, 3], at: 200 }] }
  )
  assert.deepEqual(edited.lists[0].presets, [1, 2, 3])
  assert.equal(edited.lists[0].name, 'Friday night')

  /* A delete travels, and does not resurrect. Real times, because a tombstone
     is kept for sixty days and then dropped — see TOMBSTONE_MS. */
  const now = Date.now()
  const deleted = mergeUnit(
    { lists: [], removed: [{ id: 'a', at: now - 1000 }] },
    { lists: [{ id: 'a', name: 'Friday', presets: [1], at: now - 2000 }] }
  )
  assert.deepEqual(deleted.lists, [], 'a setlist deleted here came back from the account')
  assert.equal(deleted.removed.length, 1, 'the delete was forgotten immediately')

  // Unless it was edited on the other device AFTER the delete: then it is a
  // list somebody is using, not a list somebody threw away.
  const revived = mergeUnit(
    { lists: [], removed: [{ id: 'a', at: now - 2000 }] },
    { lists: [{ id: 'a', name: 'Friday', presets: [1], at: now - 1000 }] }
  )
  assert.equal(revived.lists.length, 1, 'an edit made after the delete was thrown away')

  // A delete nobody has thought about in months stops being carried, and stops
  // holding a setlist off a device that still has it.
  const old = mergeUnit(
    { lists: [], removed: [{ id: 'a', at: now - 61 * 24 * 60 * 60 * 1000 }] },
    { lists: [{ id: 'a', name: 'Friday', presets: [1], at: now - 62 * 24 * 60 * 60 * 1000 }] },
    now
  )
  assert.deepEqual(old.removed, [], 'a two-month-old delete is still being carried')

  // Stars are a toggle, so the later tap wins whole — an unstar has to travel.
  const stars = mergeUnit(
    { favourites: [1, 2], starredAt: 500 },
    { favourites: [1, 2, 3], starredAt: 400 }
  )
  assert.deepEqual(stars.favourites, [1, 2], 'an unstar here was undone by the account')
  const later = mergeUnit(
    { favourites: [1, 2], starredAt: 400 },
    { favourites: [9], starredAt: 500 }
  )
  assert.deepEqual(later.favourites, [9])

  // Before either side has ever stamped a tap there is nothing to compare, and
  // both sets of stars should survive their first meeting.
  const first = mergeUnit({ favourites: [3, 1] }, { favourites: [2] })
  assert.deepEqual(first.favourites, [1, 2, 3], 'a first sync picked one device\'s stars by a coin toss')

  // The chosen source is a preference: the later choice.
  assert.equal(mergeUnit({ source: 'a', at: 10 }, { source: 'starred', at: 20 }).source, 'starred')
  assert.equal(mergeUnit({ source: 'a', at: 30 }, { source: 'starred', at: 20 }).source, 'a')

  // Units are merged one at a time and never mixed: an FM3's setlists are not
  // an AM4's.
  const units = mergeUnits(
    { fm3: { lists: [{ id: 'a', name: 'F', presets: [1], at: 1 }] } },
    { am4: { lists: [{ id: 'b', name: 'A', presets: [2], at: 1 }] } }
  )
  assert.deepEqual(Object.keys(units).sort(), ['am4', 'fm3'])
  assert.deepEqual(units.fm3.lists.map((l) => l.id), ['a'])
  assert.deepEqual(units.am4.lists.map((l) => l.id), ['b'])

  // And what arrived is countable, so the app can say what it picked up.
  assert.deepEqual(gained({ fm3: { lists: [], favourites: [] } }, units.fm3 ? { fm3: units.fm3 } : {}), {
    lists: 1,
    stars: 0
  })
})

test('two devices stop writing to each other once they agree', async () => {
  /*
   * THE ONE THAT SPENT A DATABASE.
   *
   * The account is a single row holding one person's setlists. It came back
   * holding 109,508 tombstones for ONE setlist, called "Hello", deleted once —
   * five megabytes of JSON, read and written by every device every few seconds
   * for hours. Thousands of reads and writes, until Supabase cut the project
   * off for exhausting its disk allowance and the app could no longer sign in.
   *
   * Two faults, and either one alone is a loop with no exit:
   *
   *   1. Merging ran the two `removed` lists together and deduped nothing, so
   *      every round put another copy of each tombstone in and the next round
   *      doubled that.
   *   2. `sameUnits` compared stringified JSON, and Postgres `jsonb` does not
   *      keep key order — it sorts keys by length. So the copy that came back
   *      never matched the copy that went up, whatever was in it, and every
   *      sync wrote what was already there. Which the other device read, and
   *      wrote back.
   *
   * SO THIS RUNS IT rather than checking either fix in isolation: two devices,
   * a store between them that reorders keys the way jsonb does, and a count of
   * the writes. A sync that has nothing to do must do nothing.
   */
  const { syncStage, localUnits } = await import('../src/lib/setlistMerge.js')
  const { createList, deleteList } = await import('../src/lib/setlists.js')

  const store = () => ({
    data: new Map(),
    getItem(k) { return this.data.has(k) ? this.data.get(k) : null },
    setItem(k, v) { this.data.set(k, v) }
  })

  /* jsonb sorts an object's keys by length, then bytewise. Nothing in the app
     asked for that; it is simply what the column does on the way back. */
  const asJsonb = (v) => {
    if (Array.isArray(v)) return v.map(asJsonb)
    if (v && typeof v === 'object') {
      const out = {}
      const keys = Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
      for (const k of keys) out[k] = asJsonb(v[k])
      return out
    }
    return v
  }

  let row = null
  let writes = 0
  const cloud = {
    load: async () => (row ? { units: asJsonb(row), at: 1, device: 'the other one' } : null),
    save: async (units) => { writes += 1; row = JSON.parse(JSON.stringify(units)); return true }
  }

  /* One setlist, made on the phone and then deleted — which is exactly what
     was in the account that blew up. */
  const phone = store()
  const made = createList('fm3', 'Hello', [], phone)
  deleteList('fm3', made.id, phone)
  const mac = store()

  await syncStage(cloud, phone)
  await syncStage(cloud, mac)
  const settled = writes

  /* Now nothing changes on either device. Ten rounds of a sync with nothing
     to do, which on a stage is a couple of minutes of sitting still. */
  for (let i = 0; i < 10; i++) {
    await syncStage(cloud, phone)
    await syncStage(cloud, mac)
  }

  assert.equal(writes, settled, `a sync with nothing to do wrote ${writes - settled} times over ten rounds`)

  /* And the delete is remembered exactly once, on both devices and in the
     account — not once per round. */
  const gone = row.fm3.removed
  assert.equal(gone.length, 1, `one delete left ${gone.length} tombstones behind`)
  assert.equal(gone[0].id, made.id)
  assert.equal(localUnits(phone).fm3.removed.length, 1, 'the phone is keeping its own pile of duplicates')
  assert.equal(localUnits(mac).fm3.removed.length, 1)

  /*
   * And once each device has a delete of its own, the two lists get run
   * together in opposite orders — mine first on one, mine first on the other.
   * Same deletes, different order, which reads as a change on both sides and
   * is the same loop again with nothing duplicated.
   */
  const one = createList('fm3', 'Set one', [], phone)
  const two = createList('fm3', 'Set two', [], mac)
  await syncStage(cloud, phone)
  await syncStage(cloud, mac)
  await syncStage(cloud, phone)
  deleteList('fm3', one.id, phone)
  deleteList('fm3', two.id, mac)
  for (let i = 0; i < 4; i++) {
    await syncStage(cloud, phone)
    await syncStage(cloud, mac)
  }
  const quiet = writes
  for (let i = 0; i < 10; i++) {
    await syncStage(cloud, phone)
    await syncStage(cloud, mac)
  }
  assert.equal(
    writes,
    quiet,
    `with a delete from each device, a sync with nothing to do wrote ${writes - quiet} times over ten rounds`
  )
  assert.equal(row.fm3.removed.length, 3, 'three deletes are not being remembered as three')
})

test('a device already carrying the duplicates heals itself', async () => {
  /*
   * There are real devices out there holding the 109,508, and a fix that only
   * stops NEW duplicates would leave them carrying it forever — still five
   * megabytes up and down every sync. Cleaning the list on every read means
   * the first look after the update is the one that fixes it, with nobody
   * clearing anything.
   */
  const { cleanGoneList } = await import('../src/lib/setlists.js')
  const at = Date.now() - 1000
  const pile = Array.from({ length: 5000 }, () => ({ id: 'smu526vwj1td3', at }))
  const clean = cleanGoneList(pile)
  assert.equal(clean.length, 1, `5000 copies of one delete came back as ${clean.length}`)
  assert.equal(clean[0].id, 'smu526vwj1td3')

  /* The latest delete of an id is the one kept: an older one would let a copy
     of that setlist made in between come back from another device. */
  const mixed = cleanGoneList([{ id: 'x', at: at }, { id: 'x', at: at + 500 }, { id: 'y', at }])
  assert.equal(mixed.length, 2)
  assert.equal(mixed.find((g) => g.id === 'x').at, at + 500, 'an older delete is winning over a newer one')
})

test('a setlist knows when it changed, and a delete leaves a mark', async () => {
  const {
    createList,
    updateList,
    deleteList,
    listsFor,
    goneFor,
    unitFor,
    putUnit
  } = await import('../src/lib/setlists.js')

  // A Map is enough of a storage for this: getItem/setItem and nothing else.
  const store = {
    data: new Map(),
    getItem(k) { return this.data.has(k) ? this.data.get(k) : null },
    setItem(k, v) { this.data.set(k, v) }
  }

  const made = createList('fm3', 'Friday', store)
  assert.ok(made.at > 0, 'a new setlist carries no time, so a merge cannot place it')
  const before = listsFor('fm3', store)[0].at
  await new Promise((r) => setTimeout(r, 2))
  updateList('fm3', made.id, { presets: [4, 5] }, store)
  assert.ok(listsFor('fm3', store)[0].at > before, 'editing a setlist does not move its time')

  deleteList('fm3', made.id, store)
  assert.deepEqual(listsFor('fm3', store), [], 'the setlist is still there after a delete')
  assert.deepEqual(goneFor('fm3', store).map((g) => g.id), [made.id], 'the delete left no mark to travel')

  // And a merged copy can be written back without being re-stamped, or two
  // devices would keep handing the same lists back and forth for ever.
  const settled = { lists: [{ id: 'z', name: 'Sunday', presets: [1], at: 42 }], removed: [], source: 'all', at: 42 }
  putUnit('fm3', settled, store)
  assert.equal(unitFor('fm3', store).at, 42, 'writing a merged copy back stamped it as new work')
  assert.deepEqual(listsFor('fm3', store).map((l) => l.name), ['Sunday'])
})

console.log('\na tone with more scenes than the unit holds')











console.log('\nwhat a refine is sent')




console.log('\nthe band book')

const bookSchemaA = [
  { eid: 106, name: 'Amp 1', slug: 'amp', bypassed: false, channel: 'A',
    models: [{ value: 5, name: 'Recto2 Red Modern' }, { value: 9, name: 'USA Clean 1' }],
    params: [{ id: 1, name: 'Input Drive', value: 5, min: 0, max: 10 }, { id: 3, name: 'Bass', value: 5, min: 0, max: 10 }] },
  { eid: 100, name: 'Drive 1', slug: 'drive', bypassed: true, channel: 'A',
    models: [{ value: 2, name: 'T808 OD' }],
    params: [{ id: 7, name: 'Drive', value: 3, min: 0, max: 10 }] },
  { eid: 133, name: 'Delay 1', slug: 'delay', bypassed: true, channel: 'A',
    models: [{ value: 1, name: 'Digital Mono' }],
    params: [{ id: 20, name: 'Time', value: 300, min: 0, max: 2000 }, { id: 21, name: 'Mix', value: 20, min: 0, max: 100 }] }
]
// The same families on a different preset: different ids, a second amp, no delay.
const bookSchemaB = [
  { eid: 58, name: 'Amp 1', slug: 'amp', bypassed: false, channel: 'A',
    models: [{ value: 41, name: 'Recto2 Red Modern' }, { value: 3, name: 'USA Clean 1' }],
    params: [{ id: 11, name: 'Input Drive', value: 2, min: 0, max: 10 }, { id: 12, name: 'Bass', value: 5, min: 0, max: 10 }, { id: 13, name: 'Treble', value: 5, min: 0, max: 10 }] },
  { eid: 59, name: 'Amp 2', slug: 'amp', bypassed: true, channel: 'A', models: [], params: [] },
  { eid: 62, name: 'Drive 1', slug: 'drive', bypassed: true, channel: 'A',
    models: [{ value: 8, name: 'T808 OD' }],
    params: [{ id: 30, name: 'Drive', value: 1, min: 0, max: 10 }] }
]
const bookValidated = {
  presetName: 'Three Days Grace', summary: 'Recto and a screamer.', notes: '', artist: 'Three Days Grace',
  changes: [
    { eid: 106, name: 'Amp 1', slug: 'amp', wasBypassed: false, channel: 'B', type: 5, typeName: 'Recto2 Red Modern',
      params: [{ id: 1, name: 'Input Drive', from: 5, to: 7.5 }, { id: 3, name: 'Bass', from: 5, to: 6 }] },
    { eid: 106, name: 'Amp 1', slug: 'amp', wasBypassed: false, channel: 'C', type: 9, typeName: 'USA Clean 1',
      params: [{ id: 1, name: 'Input Drive', from: 5, to: 2 }] },
    { eid: 100, name: 'Drive 1', slug: 'drive', wasBypassed: true, bypassed: false, type: 2, typeName: 'T808 OD',
      params: [{ id: 7, name: 'Drive', from: 3, to: 4 }] },
    { eid: 133, name: 'Delay 1', slug: 'delay', wasBypassed: true, params: [{ id: 20, name: 'Time', from: 300, to: 420 }] }
  ],
  scenes: [
    { index: 0, name: 'Animal I', why: 'Drop-D Recto', blocks: [
      { eid: 106, name: 'Amp 1', bypassed: false, channel: 'B' }, { eid: 100, name: 'Drive 1', bypassed: false }, { eid: 133, name: 'Delay 1', bypassed: true } ] },
    { index: 1, name: 'Never Too Late', blocks: [
      { eid: 106, name: 'Amp 1', bypassed: false, channel: 'C' }, { eid: 100, name: 'Drive 1', bypassed: true }, { eid: 133, name: 'Delay 1', bypassed: false } ] },
    { index: 2, name: 'Riot', blocks: [
      { eid: 106, name: 'Amp 1', bypassed: false, channel: 'B' }, { eid: 100, name: 'Drive 1', bypassed: false }, { eid: 133, name: 'Delay 1', bypassed: true } ] }
  ]
}



test('the account row tidies its own delete-marks, whatever writes it', () => {
  /*
   * 7.271.0 fixed the app; the row was back to 131,072 marks within hours,
   * written by a phone still on 7.268.0. Every device that has not been
   * updated carries the pile and pushes it straight back up, and the fixed
   * app cannot stop it because the phone writes last. So the database keeps
   * one mark per setlist itself, before every write, and never refuses one.
   */
  const sql = readSrc(new URL('../supabase/migrations/20260917_stage_lists_tidy.sql', import.meta.url), 'utf8')
  assert.match(sql, /create trigger stage_lists_tidy\s+before insert or update on public\.stage_lists/, 'the row is not tidied on the way in')
  assert.match(sql, /group by g->>'id'/, 'the marks are not reduced to one per setlist')
  assert.match(sql, /max\(\(g->>'at'\)::numeric\)/, 'the latest delete does not win, so a setlist made in between comes back')
  assert.match(sql, /60\.0 \* 24 \* 60 \* 60 \* 1000/, 'marks are kept for a different time than the app remembers a delete (TOMBSTONE_MS)')
  assert.match(sql, /order by d\.at desc, d\.id/, 'the marks come back in an order the app reads as a change, so a fixed device writes them again')
  assert.match(sql, /exception when others then/, 'a row the trigger cannot tidy is refused, which turns the sync off')
})

test('the Edit button on the stage screen is there whenever there is a unit', async () => {
  /*
   * "add edit to the web version so I can test the chain editor there first
   * before spending ANOTHER expo build slot." It was there, behind the same
   * rule as Ask: play mode on, or the AI switched off, and the chain editor
   * was gone from the web version. Editing the chain is not asking the AI.
   *
   * Ask, play mode and the AI switch have all gone, so the only thing left
   * that can take the Edit button away is having nothing to edit — which is
   * what this has always been protecting.
   */
  const { editButtonShows } = await import('../shared/play-mode.mjs')
  assert.equal(editButtonShows({ status: 'live' }), true)
  assert.equal(editButtonShows({ status: 'live', playing: true }), true, 'something still takes the chain editor away')
  assert.equal(editButtonShows({ status: 'off' }), false, 'there is an Edit button with no unit')
})

test('the web chain editor draws, and moves a block the way the phone does', async () => {
  /*
   * "Add, remove and move blocks couldn't draw — Can't find variable: rows."
   * Three names were read and never defined, so on a grid unit the panel
   * threw before it drew a thing. And "how does moving the blocks in the
   * chain work on the web version? Can we set it up like the phone." A grip
   * to hold and drag, the same lane maths as the phone, one shared copy.
   */
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../src/components/GridEditor.jsx', import.meta.url), 'utf8')
  assert.match(src, /const \{ linear, rows, cols \} = gridShape\(capabilities\)/, 'rows and cols are read without being defined')
  assert.ok(!/\blanes\.some\(/.test(src), 'the Move chip reads a lanes that does not exist')
  assert.match(src, /from '\.\.\/\.\.\/shared\/lane-order\.mjs'/, 'the web editor has its own copy of the lane maths')
  assert.match(src, /className="chain-grip"/, 'there is no grip to drag a block by')
  assert.match(src, /onPointerDown=\{\(e\) => gripDown\(e, lane, index\)\}/)
  assert.match(src, /const reorder = async \(lane, fromIndex, toIndex\) => \{/)
  assert.match(src, /const now = await presetBlocks\(\)\.catch\(\(\) => null\)/, 'a move is not checked against the unit')
  assert.match(src, /The unit did not keep the move: /, 'a move the unit dropped is silent')
  const shared = await import('../shared/lane-order.mjs')
  const phone = await import('../mobile/src/lib/laneOrder.js')
  assert.deepEqual(
    shared.reorderPlan([{ col: 1, block: 'a' }, { col: 2, block: 'b' }, { col: 4, block: 'c' }], 0, 2),
    phone.reorderPlan([{ col: 1, block: 'a' }, { col: 2, block: 'b' }, { col: 4, block: 'c' }], 0, 2),
    'the two apps would move the same drag to different columns'
  )
  const sync = readFileSync(new URL('../scripts/sync-relay-rules.mjs', import.meta.url), 'utf8')
  assert.match(sync, /source: '\.\.\/shared\/lane-order\.mjs', target: '\.\.\/mobile\/src\/lib\/laneOrder\.js'/, 'the phone copy of the lane maths is not generated')
})


test('removing a block asks on the page, and a block the unit kept is said out loud', () => {
  /*
   * "CHAIN Remove does nothing." The write was there and allowed over the
   * relay. What vanished was the question in front of it: the browser's own
   * pop-up, which a blocked pop-up answers "no" without ever showing. And
   * whatever the unit did, the panel closed and the history said "Cleared".
   */
  const src = readSrc(new URL('../src/components/GridEditor.jsx', import.meta.url), 'utf8')
  assert.ok(!/window\.confirm\(/.test(src), 'Remove still asks in a pop-up a blocked pop-up answers “no” to')
  const remove = src.slice(src.indexOf('const remove = async (row, col, name) => {'), src.indexOf('const buildStarter = async'))
  assert.ok(remove.length > 200, 'the remove moved; retarget this test')
  assert.match(remove, /const r = await clearCell\(row, col\)[\s\S]*?const now = await presetBlocks\(\)\.catch\(\(\) => null\)/, 'the chain is not read back after a remove')
  assert.match(remove, /now\.find\(\(b\) => b\.row === row && b\.col === col\)/, 'the read-back does not look in the cell that was cleared')
  assert.match(remove, /The unit did not remove it: /, 'a block the unit kept is silent')
  /* A block still there is not recorded as cleared, and the panel stays open to say so. */
  const kept = remove.slice(remove.indexOf('if (still) {'), remove.indexOf('const cleared'))
  assert.match(kept, /setIssue\([\s\S]*?\)\s*return\s*\}/, 'a remove the unit did not take still closes the panel as done')
  assert.ok(!/onChanged\(/.test(kept), 'a remove the unit did not take is recorded as cleared')
  /* And no DELETE /device/cache on the way: it deletes the computer's saved
     profile of the FM3, and the phone's copy of this never needed one. */
  assert.ok(!/clearDeviceCache/.test(src), 'the chain editor deletes the computer’s profile of the unit again')
})

test('one arrow press is one write, of the value it reached', async () => {
  /*
   * "Knobs ignore the keyboard." The arrow moved the knob and asked for the
   * write in the same instant, and the write read the value from before the
   * move: every other press missed, the knob flicked back, and the last press
   * was never sent. The rules are in shared/knob-keys.mjs, one copy for both
   * apps; these drive them with a clock the test holds.
   */
  const { keyTarget, settleWrites, oneWriteAtATime, KEY_SETTLE_MS } = await import('../shared/knob-keys.mjs')
  assert.equal(KEY_SETTLE_MS, 250)

  /* Where each key goes, from a knob at 0.5 of its range. */
  const near = (a, b) => Math.abs(a - b) < 1e-9
  assert.ok(near(keyTarget('ArrowRight', 0.5), 0.51) && near(keyTarget('ArrowUp', 0.5), 0.51))
  assert.ok(near(keyTarget('ArrowLeft', 0.5), 0.49) && near(keyTarget('ArrowDown', 0.5), 0.49))
  assert.ok(near(keyTarget('ArrowRight', 0.5, { fine: true }), 0.502), 'Shift is no longer the fine step')
  assert.ok(near(keyTarget('PageUp', 0.5), 0.6) && near(keyTarget('PageDown', 0.5), 0.4), 'Page Up and Down do not take a tenth of the range')
  assert.equal(keyTarget('Home', 0.5), 0, 'Home does not go to the bottom')
  assert.equal(keyTarget('End', 0.5), 1, 'End does not go to the top')
  assert.equal(keyTarget('PageUp', 0.95), 1, 'a step runs past the end of the range')
  assert.equal(keyTarget('Tab', 0.5), null, 'a key that is not for knobs turns the knob')
  assert.ok(near(keyTarget('increment', 0.5), 0.51) && near(keyTarget('decrement', 0.5), 0.49), 'VoiceOver’s swipes are not the arrows')

  /* A clock the test turns by hand. */
  let now = 0
  const timers = []
  const later = (fn, ms) => {
    const t = { fn, at: now + ms, live: true }
    timers.push(t)
    return t
  }
  const cancel = (t) => {
    if (t) t.live = false
  }
  const advance = (ms) => {
    now += ms
    for (const t of timers) if (t.live && t.at <= now) {
      t.live = false
      t.fn()
    }
  }

  /* One press: nothing on the wire until the keys are still, then exactly one
     write, of the value the press reached. */
  const sent = []
  const keys = settleWrites((v) => sent.push(v), { later, cancel })
  keys.push(5.1)
  assert.deepEqual(sent, [], 'a press is written before the keys have stopped')
  assert.equal(keys.held(), 5.1, 'the next press cannot start from where this one reached')
  advance(KEY_SETTLE_MS)
  assert.deepEqual(sent, [5.1], 'one ArrowRight did not produce exactly one write of its own value')
  advance(KEY_SETTLE_MS * 4)
  assert.deepEqual(sent, [5.1], 'one press was written twice')

  /* Five quick presses are one write, of the last. */
  sent.length = 0
  for (const v of [5.2, 5.3, 5.4, 5.5, 5.6]) {
    keys.push(v)
    advance(100)
  }
  assert.deepEqual(sent, [], 'a run of presses is written press by press')
  advance(KEY_SETTLE_MS)
  assert.deepEqual(sent, [5.6], 'a run of presses did not end in one write of where it got to')

  /* Leaving the knob, or the editor closing, sends what is waiting at once. */
  sent.length = 0
  keys.push(6)
  keys.flush()
  assert.deepEqual(sent, [6], 'tabbing away leaves the last press unsent')
  advance(KEY_SETTLE_MS)
  assert.deepEqual(sent, [6], 'a flushed press is written again when its timer fires')
  keys.flush()
  assert.deepEqual(sent, [6], 'a flush with nothing waiting writes something')

  /* One checked write per control: values that arrive while one is out
     wait, and only the newest of them goes next. */
  const wire = []
  const gates = []
  const lanes = oneWriteAtATime(async (v) => {
    wire.push(v)
    await new Promise((r) => gates.push(r))
  })
  const done = lanes.send('amp:3', 1)
  assert.equal(lanes.busy('amp:3'), true)
  assert.equal(lanes.busy('amp:4'), false, 'one control’s write holds up another’s')
  lanes.send('amp:3', 2)
  lanes.send('amp:3', 3)
  await Promise.resolve()
  assert.deepEqual(wire, [1], 'a second write to the same control went out while the first was still being checked')
  gates.shift()()
  await new Promise((r) => setTimeout(r, 0))
  assert.deepEqual(wire, [1, 3], 'the newest waiting value was not the one written next')
  gates.shift()()
  await done
  assert.deepEqual(wire, [1, 3], 'a superseded value was written after all')
  assert.equal(lanes.busy('amp:3'), false, 'the lane never empties')

  /* A write that throws does not strand what was waiting behind it. */
  const after = []
  let first = true
  const shaky = oneWriteAtATime(async (v) => {
    after.push(v)
    if (first) {
      first = false
      await Promise.resolve()
      throw new Error('port not open')
    }
  })
  const going = shaky.send('x', 'a')
  shaky.send('x', 'b')
  await going
  assert.deepEqual(after, ['a', 'b'], 'a failed write strands the value waiting behind it')

  /* Both apps send a fresh job per turn, so the skip-if-same needs its own
     test of sameness: a tap on a knob with no movement, while its last
     value is still out, must not write that value a second time. */
  const jobs = []
  const jobGates = []
  const byJob = oneWriteAtATime(
    async (job) => {
      jobs.push(job)
      await new Promise((r) => jobGates.push(r))
    },
    { same: (a, b) => a.next === b.next && a.key === b.key }
  )
  const tick = () => new Promise((r) => setTimeout(r, 0))
  const drain = async () => {
    while (jobGates.length) {
      jobGates.shift()()
      await tick()
    }
  }
  byJob.send('amp:3', { next: 5.1, key: 'k' })
  byJob.send('amp:3', { next: 5.1, key: 'k' })
  await drain()
  assert.equal(jobs.length, 1, 'a waiting job equal to the one just written was written again')
  byJob.send('amp:3', { next: 5.1, key: 'k' })
  byJob.send('amp:3', { next: 5.1, key: 'k2' })
  await drain()
  assert.equal(byJob.busy('amp:3'), false, 'the lane never empties')
  assert.deepEqual(jobs.map((j) => j.key), ['k', 'k', 'k2'], 'the same number after a scene or channel change was dropped')

  const conSrc = readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8')
  const editSrc = readSrc(new URL('../mobile/src/screens/Edit.js', import.meta.url), 'utf8')
  assert.match(conSrc, /oneWriteAtATime\([^]*?\{\s*same: \(a, b\) => a\.next === b\.next && a\.key === b\.key\s*\}\)/, 'the browser’s knob writes lost their test of sameness')
  assert.match(editSrc, /oneWriteAtATime\([^]*?\{\s*same: \(a, b\) => Object\.is\(a\.next, b\.next\)\s*\}\)/, 'the phone’s knob writes lost their test of sameness')
})

test('the browser’s knob writes what a press reached, once the keys stop', () => {
  /* The knob and its editor, held to the rules above. */
  const knob = readSrc(new URL('../src/components/Knob.jsx', import.meta.url), 'utf8')
  assert.match(knob, /from '\.\.\/\.\.\/shared\/knob-keys\.mjs'/, 'the knob keeps its own copy of the key rules')
  const nudge = knob.slice(knob.indexOf('const nudge = (event) => {'), knob.indexOf('const r = size / 2 - 4'))
  assert.ok(nudge.length > 100, 'the key handler moved; retarget this test')
  assert.match(nudge, /keyTarget\(event\.key, from, \{ fine: event\.shiftKey \}\)/, 'the keys do not go through the shared steps')
  assert.match(nudge, /onChange\(v\)\s*keys\.current\.push\(v\)/, 'a press does not hand its own value to the write')
  assert.ok(!/onCommit/.test(nudge), 'a press asks for the write in the same instant again, which reads the value from before it')
  assert.match(knob, /onBlur=\{\(\) => keys\.current\.flush\(\)\}/, 'tabbing away leaves the last press unsent')
  assert.match(knob, /useEffect\(\(\) => \(\) => keys\.current\.flush\(\), \[\]\)/, 'closing the editor leaves the last press unsent')
  assert.match(knob, /const release = useCallback\(\(\) => \{\s*const v = dragged\.current\s*dragged\.current = undefined\s*live\.current\.onCommit\?\.\(v\)/, 'a drag does not hand over the value it reached')
  assert.match(knob, /dragged\.current = v\s*change\(v\)/, 'a drag does not keep the value it reached')
  assert.match(nudge, /const from = waiting !== undefined \?/, 'a fast run of presses starts each one from the screen, a step behind')

  const con = readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8')
  assert.match(con, /onCommit=\{\(v\) => commit\(p, v\)\}/, 'the knob’s value is read back out of state a render behind')
  const commit = con.slice(con.indexOf('const commit = (p, override) => {'), con.indexOf('Swapping the model, and being able to take it back'))
  assert.ok(commit.length > 200, 'the commit moved; retarget this test')
  assert.match(commit, /if \(next === p\.value && !writes\.current\.busy\(lane\)\) return/, 'turning a knob back to where it was, while a write is out, never reaches the unit')
  assert.match(commit, /writes\.current\.send\(lane, /, 'two checked writes to one control can race again')
  assert.match(commit, /if \(prev\[p\.id\] !== next\) return prev/, 'a knob still being turned flicks back to an older read')
  assert.match(commit, /if \(liveKey\.current === key\) \{/, 'a write that finishes after another block opened hands that block its values')
  assert.match(commit, /res\.unverified\s*\?\s*`\$\{called\} was sent, but the app couldn't read it back to check\.`\s*:\s*`\$\{called\} didn't take\.`/, 'a knob nobody could read back is announced as one the unit refused')
  assert.match(commit, /const called = p\.label \|\| p\.name/, 'a knob that did not take is named by the catalog, not by what the knob says')
})

console.log('\ncab picker')

/*
 * A cab is not a model change.
 *
 * On an FM3 the list the cab picker offers is the DynaCab list, and the model
 * change it sent reached the block's Preamp Type — the only thing on a cab
 * block with TYPE in its name. A tester picked "1x12 G12T-100", nothing
 * changed, and the picker read the Preamp Type back and named his cab. These
 * hold the picker to the cab state the host serves instead.
 */
const cabFixture = (mode, dyna = 3) => ({
  modeParam: 31,
  mode: { value: mode, label: mode === 1 ? 'DYNA-CAB' : 'LEGACY' },
  slots: [
    { slot: 1, bankParam: 0, irParam: 4, dynaParam: 85, bank: { value: 0, label: 'FACTORY 1' }, irIndex: 12, irName: '4x12 Recto', dyna: { value: dyna, label: `Cab ${dyna}` } },
    { slot: 2, bankParam: 1, irParam: 5, dynaParam: 86, bank: { value: 0, label: 'FACTORY 1' }, irIndex: 34, irName: '2x12 Blue', dyna: { value: 0, label: 'Cab 0' } }
  ]
})

test('picking a cab on an IR writes the mode, then slot 1’s DynaCab, as whole numbers', async () => {
  const { pickCab } = await import('../shared/cab-pick.mjs')
  const sent = []
  const res = await pickCab(cabFixture(0), 11, async (id, v) => (sent.push([id, v]), { ok: true }))
  assert.equal(res.ok, true)
  assert.deepEqual(sent, [[31, 1], [85, 11]], 'the mode has to go first, or the cab is stored and not heard')
  for (const [, v] of sent) assert.ok(Number.isInteger(v), `${v} is a position, not an ordinal`)

  /* Already on DynaCab: the cab alone. */
  sent.length = 0
  await pickCab(cabFixture(1), 7, async (id, v) => (sent.push([id, v]), { ok: true }))
  assert.deepEqual(sent, [[85, 7]], 'a block already on DynaCab had its mode written again')

  /* A refused mode stops there, rather than leaving a cab half-changed. */
  sent.length = 0
  const no = await pickCab(cabFixture(0), 11, async (id, v) => (sent.push([id, v]), { ok: id !== 31 }))
  assert.equal(no.ok, false, 'a refusal was reported as done')
  assert.deepEqual(sent, [[31, 1]], 'the cab went out after the mode was refused')
})

test('undoing a cab pick puts back the cab AND the mode, so an IR plays again', async () => {
  const { pickCab, restoreCab, cabWas } = await import('../shared/cab-pick.mjs')
  const before = cabFixture(0, 3)
  const was = cabWas(before)
  assert.deepEqual([was.mode, was.dyna, was.name], [0, 3, '4x12 Recto'])
  await pickCab(before, 11, async () => ({ ok: true }))
  const sent = []
  const res = await restoreCab(cabFixture(1, 11), was, async (id, v) => (sent.push([id, v]), { ok: true }))
  assert.equal(res.ok, true)
  assert.deepEqual(sent, [[85, 3], [31, 0]], 'the undo left the block on DynaCab, or lost the cab it had')
})

test('the cab’s IR numbers and banks are off the knob deck, found by the ids the host names', async () => {
  const { cabHidden, cabReady, cabShowing } = await import('../shared/cab-pick.mjs')
  assert.deepEqual([...cabHidden(cabFixture(1))].sort((a, b) => a - b), [0, 1, 4, 5])
  /* No cab state, no change: every knob that was there stays. */
  for (const none of [null, { error: 'unsupported' }, { slots: [] }, {}]) {
    assert.equal(cabReady(none), false, `${JSON.stringify(none)} was taken for a cab state`)
    assert.equal(cabHidden(none).size, 0, 'a unit without cab state lost knobs')
    assert.equal(cabShowing(none, []), null)
  }
  /* What the picker says: the DynaCab by the roster's name, or the IR with a word on what a pick does. */
  const dyna = cabShowing(cabFixture(1, 11), [{ value: 11, name: '1x12 G12T-100' }])
  assert.deepEqual([dyna.value, dyna.name, dyna.legacy], [11, '1x12 G12T-100', false])
  const ir = cabShowing(cabFixture(0), [{ value: 3, name: 'x' }])
  assert.equal(ir.value, null, 'a cab in the list was marked while the block plays an IR')
  assert.equal(ir.name, '4x12 Recto')
  assert.match(ir.hint, /switches this block to DynaCab/)
})

/* A cab state that read as all zeros because the read failed, beside a params read that did not. */
const zeroedCab = () => {
  const c = cabFixture(0, 0)
  c.slots = c.slots.map((s) => ({ ...s, irIndex: 0, irName: '#0' }))
  return c
}

test('a cab state the params read contradicts is read again, and kept as unsure rather than trusted', async () => {
  const { cabAgrees, readCab, cabWas, cabShowing, pickCab } = await import('../shared/cab-pick.mjs')
  const params = { enums: [{ id: 31, value: 1 }, { id: 85, value: 7 }] }
  assert.equal(cabAgrees(zeroedCab(), params), false, 'a zeroed read was taken for the block on DynaCab 7')
  assert.equal(cabAgrees(cabFixture(1, 7), params), true)
  /* Nothing to check against: the cab state stands, so a demo still picks through it. */
  for (const none of [{ enums: [] }, {}, null]) assert.equal(cabAgrees(zeroedCab(), none), true)

  let reads = 0
  const bad = await readCab(async () => (reads++, zeroedCab()), params)
  assert.equal(reads, 2, 'a disagreeing cab state was not read a second time')
  assert.equal(bad.unsure, true, 'a cab state that disagreed twice was trusted')
  assert.equal(cabWas(bad), null, 'an undo was offered from numbers that were never read')
  const says = cabShowing(bad, [{ value: 0, name: 'Cab 0' }])
  assert.deepEqual([says.name, says.hint, says.value], [null, null, null], 'an unsure read named a cab or said "Playing an IR"')
  /* And its mode is written rather than believed, so the pick is heard. */
  const sent = []
  await pickCab({ ...cabFixture(1, 7), unsure: true }, 11, async (id, v) => (sent.push([id, v]), { ok: true }))
  assert.deepEqual(sent, [[31, 1], [85, 11]])

  reads = 0
  const good = await readCab(async () => (reads++, reads === 1 ? zeroedCab() : cabFixture(1, 7)), params)
  assert.equal(good.unsure, undefined, 'a second read that agreed was still marked unsure')
  assert.equal(await readCab(async () => { throw new Error('gone') }, params), null, 'a failed read is not the old panel')
})

test('a cab re-read that fails keeps the block on the cab path, as the writes left it, and the undo still works', async () => {
  const { pickCab, restoreCab, cabAfter, cabWas, cabShows, cabHidden, taken } = await import('../shared/cab-pick.mjs')
  const before = cabFixture(0, 3)
  const was = cabWas(before)
  const res = await pickCab(before, 11, async () => ({ ok: true }))
  const after = cabAfter(before, taken(res))
  assert.ok(cabShows(after, 11), 'the state kept after a failed re-read does not show the pick')
  assert.deepEqual([...cabHidden(after)].sort((a, b) => a - b), [0, 1, 4, 5], 'the IR numbers came back onto the deck')
  /* The next pick is a cab write, not a model change. */
  const next = []
  await pickCab(after, 20, async (id, v) => (next.push([id, v]), { ok: true }))
  assert.deepEqual(next, [[85, 20]])
  const back = []
  await restoreCab(after, was, async (id, v) => (back.push([id, v]), { ok: true }))
  assert.deepEqual(back, [[85, 3], [31, 0]], 'the undo sent nothing after a failed re-read')
  /* A refusal: only what got through counts. */
  const half = await pickCab(before, 11, async (id) => ({ ok: id !== 85 }))
  const left = cabAfter(before, taken(half))
  assert.equal(left.mode.value, 1)
  assert.equal(left.slots[0].dyna.value, 3, 'a refused cab was counted as on the block')
})

test('an undo writes the cab and the mode even when a bad read says they are already there', async () => {
  const { restoreCab } = await import('../shared/cab-pick.mjs')
  const sent = []
  const res = await restoreCab(zeroedCab(), { mode: 0, dyna: 0 }, async (id, v) => (sent.push([id, v]), { ok: true }))
  assert.equal(res.ok, true)
  assert.deepEqual(sent, [[85, 0], [31, 0]], 'an undo skipped its writes on the word of a zeroed read')
})

test('the browser writes a cab on the discrete path and never posts a model change for it', async () => {
  const store = { 'forgefx.host': 'http://unit.test' }
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v)
    },
    removeItem: (k) => {
      delete store[k]
    }
  }
  const seen = []
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET'
    const path = String(url).replace('http://unit.test', '')
    seen.push({ method, path, body: options.body ? JSON.parse(options.body) : null })
    const answer = path.endsWith('/cab') ? cabFixture(0) : { ok: true }
    return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify(answer) }
  }
  try {
    const fx = await import('../src/lib/forgefx.js')
    const { pickCab } = await import('../shared/cab-pick.mjs')
    const cab = await fx.cabState(62)
    assert.equal(seen[0].path, '/preset/blocks/62/cab')
    await pickCab(cab, 11, (id, v) => fx.setEnum(62, id, v))
    const writes = seen.filter((c) => c.method !== 'GET')
    assert.deepEqual(
      writes.map((c) => [c.method, c.path, c.body]),
      [
        ['PUT', '/preset/blocks/62/params/31', { value: 1, continuous: false }],
        ['PUT', '/preset/blocks/62/params/85', { value: 11, continuous: false }]
      ]
    )
    assert.ok(!seen.some((c) => c.path.endsWith('/type')), 'a cab pick posted a model change')
  } finally {
    delete globalThis.fetch
    delete globalThis.localStorage
  }
})

test('the cab panel picks through the cab state, and every other block still swaps its model', () => {
  const src = readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8')
  const panel = src.slice(src.indexOf('export function BlockPanel'), src.indexOf('function fmt('))
  const apply = panel.slice(panel.indexOf('const applyModel = async'), panel.indexOf('const applyCab = async'))
  const cabWrite = panel.slice(panel.indexOf('const applyCab = async'), panel.indexOf('const swapModel = async'))
  assert.ok(apply.length > 100 && cabWrite.length > 100, 'the model swap moved; this check reads it')
  assert.match(apply, /if \(cab && block\.slug === 'cab'\) return applyCab\(value, \{ undoable \}\)/, 'a cab block with cab state still goes through setType')
  assert.match(apply, /const sent = await setType\(block\.effectId, Number\(value\)\)/, 'an amp or a drive no longer swaps its model')
  assert.match(apply, /onError\(MODEL_REFUSED\)/, 'a refused model change is still dropped')
  assert.ok(!/setType\(/.test(cabWrite), 'the cab pick calls setType')
  assert.match(cabWrite, /setEnum\(block\.effectId, paramId, ordinal\)/, 'the cab pick does not write on the discrete path')
  assert.match(cabWrite, /const now = await readCab\(\(\) => cabState\(block\.effectId\), fresh\)/, 'the cab is not read again after a pick')
  /* A re-read that fails keeps the block on the cab path, as the writes left it. */
  assert.match(cabWrite, /setCab\(read \|\| cabAfter\(before, taken\(res\)\)\)/, 'a failed re-read drops the block back onto setType')
  assert.ok(!/setCab\(null\)/.test(cabWrite), 'a cab pick can still forget the cab state')
  /* A pick that finishes after another block came up leaves that block alone. */
  assert.match(panel, /liveKey\.current = readKey/)
  for (const [name, body] of [['cab pick', cabWrite], ['model swap', apply]]) {
    const guard = body.indexOf('if (liveKey.current !== key)', Math.max(0, body.indexOf('const sent = await setType(')))
    assert.ok(guard > 0, `a ${name} that finishes late lands on whatever block is open`)
    assert.ok(guard < body.indexOf('setParams('), `the ${name} sets the panel before checking it is still the same block`)
  }
  assert.match(cabWrite, /onError\(CAB_REFUSED\)/, 'a refused cab is not said')
  assert.match(cabWrite, /setUndo\(\{ name: was\.name, cab: was \}\)/, 'the undo does not hold the mode and the cab')
  assert.match(panel, /applyCab\(null, \{ undoable: false, back: back\.cab \}\)/, 'undo does not put the cab back')
  assert.match(panel, /\.filter\(\(p\) => !offDeck\.has\(p\.id\)\)/, 'the IR numbers are still on the knob deck')
  assert.match(panel, /block\.slug === 'cab' \? await readCab\(\(\) => cabState\(block\.effectId\), p\) : null/, 'a failed cab read is not the old panel')
  assert.match(panel, /if \(!cab \|\| block\.slug !== 'cab'\) return onError\(CAB_UNDO_LOST\)/, 'an undo with no cab state does nothing and says nothing')
})

test('the demo FM3’s cab state is shaped and numbered like the unit’s, and the cab picker moves it', async () => {
  const { createMockDevice } = await import('../src/lib/mockDevice.js')
  const { pickCab, restoreCab, cabWas, cabShows, cabBackTo } = await import('../shared/cab-pick.mjs')
  const unit = createMockDevice('fm3')
  const blocks = await unit.presetBlocks()
  const cabBlock = blocks.find((b) => b.slug === 'cab')
  const amp = blocks.find((b) => b.slug === 'amp')
  assert.ok(cabBlock, 'the demo FM3 has no cab')
  assert.deepEqual(unit.cabState(amp.effectId), { error: 'not a cab block' }, 'an amp answered with cab state')

  const cab = unit.cabState(cabBlock.effectId)
  assert.equal(cab.modeParam, 31)
  assert.deepEqual(cab.modeOptions.map((o) => o.label), ['LEGACY', 'DYNA-CAB'])
  assert.deepEqual(
    cab.slots.map((s) => [s.bankParam, s.irParam, s.dynaParam]),
    [[0, 4], [1, 5]].map(([b, i], n) => [b, i, 85 + n]),
    'the demo numbers the cab’s selectors differently from an FM3'
  )
  assert.equal(cab.dynaOptions.length, (await unit.blockTypes('cab')).length, 'the DynaCab list is not the cab list')

  /* Put it on an IR, then pick a cab the way the panel does. */
  unit.setEnum(cabBlock.effectId, 31, 0)
  const legacy = unit.cabState(cabBlock.effectId)
  assert.equal(legacy.mode.value, 0)
  const was = cabWas(legacy)
  await pickCab(legacy, 11, (id, v) => unit.setEnum(cabBlock.effectId, id, v))
  const picked = unit.cabState(cabBlock.effectId)
  assert.ok(cabShows(picked, 11), 'the demo does not show the cab that was picked')
  assert.equal(picked.slots[0].dyna.label, '1x12 G12T-100')
  await restoreCab(picked, was, (id, v) => unit.setEnum(cabBlock.effectId, id, v))
  assert.ok(cabBackTo(unit.cabState(cabBlock.effectId), was), 'the undo did not put the demo back on its IR')
  /* And none of it reached the knob list. */
  assert.ok(!(await unit.blockParams(cabBlock.effectId)).named.some((p) => [31, 85, 86].includes(p.id)))
})

/*
 * "Pick a cab IR by name."
 *
 * Neither app could put an IR on a cab: the IR number and the bank are off
 * the knobs, and nothing took their place. These hold the IR picker to the
 * unit's own bank order, the order of the writes, and an Undo that puts back
 * all three of bank, IR and mode.
 */
const FM3_BANKS = ['FACTORY 1', 'FACTORY 2', 'USER', 'LEGACY', 'SCRATCHPAD']
const fm3Irs = () => ({
  'FACTORY 1': ['1x4 Pig 57', '1x4 Pig 121', '4x12 Recto'],
  'FACTORY 2': ['2x12 Double Verb', 'TOTALLY-FLAT'],
  LEGACY: ['1x6 OVAL', '1x8 TWEED', '4x12 G12H CREAMBACK MIX (CEL)'],
  SCRATCHPAD: ['OH 412 MES V30 CHUNK', '<EMPTY>']
})
const irCab = (mode, bank = 0, ir = 2) => {
  const c = cabFixture(mode, 3)
  c.modeOptions = [{ value: 0, label: 'LEGACY' }, { value: 1, label: 'DYNA-CAB' }]
  c.bankOptions = FM3_BANKS
  c.slots[0] = { ...c.slots[0], bank: { value: bank, label: FM3_BANKS[bank] }, irIndex: ir, irName: bank === 2 ? `#${ir}` : 'x' }
  return c
}
const irKnobs = { named: [{ id: 4, name: 'Type 1', value: 2, min: 0, max: 1023 }] }

test('the IR banks are the unit’s, in the unit’s order, and USER is offered by number', async () => {
  const { irBanks, irNow, cabShowing, slotIr } = await import('../shared/cab-pick.mjs')
  const banks = irBanks(irCab(0), fm3Irs(), irKnobs)
  /* /cab/irs has no USER: counting down its keys made Legacy bank 2, which is USER. */
  assert.deepEqual(
    banks.map((b) => [b.value, b.name]),
    [[0, 'Factory 1'], [1, 'Factory 2'], [2, 'User'], [3, 'Legacy'], [4, 'Scratchpad']],
    'the banks were numbered by the order of /cab/irs'
  )
  const legacy = banks.find((b) => b.name === 'Legacy')
  assert.equal(legacy.names[0], '1x6 OVAL', 'the Legacy bank carries another bank’s names')
  const user = banks.find((b) => b.user)
  assert.equal(user.count, 1024, 'his own IRs are not offered as many as the IR control holds')
  /* The host's "#5" is not a name; counted from one, as a person counts. */
  assert.deepEqual(irNow(irCab(0, 2, 5), banks), { bank: 2, ir: 5, name: 'IR 6', bankName: 'User', playing: true })
  assert.equal(irNow(irCab(0, 3, 1), banks).name, '1x8 TWEED')
  assert.equal(irNow(irCab(1, 0, 2), banks).playing, false, 'a block on DynaCab was said to be playing its IR')
  assert.equal(irNow({ ...irCab(0), unsure: true }, banks), null, 'an unsure read named an IR')
  /* Scratchpad is his own bank. The FM3's list names it out of another unit's
     IRs (the codec: "the donor unit's own IR library"), so it is by number. */
  const scratch = banks.find((b) => b.value === 4)
  assert.deepEqual([scratch.names, scratch.user, scratch.count], [[], true, 2], 'Scratchpad showed another unit’s IR names')
  const donor = irCab(0, 4, 0)
  donor.slots[0].irName = 'OH 412 MES V30 CHUNK'
  assert.equal(irNow(donor, banks).name, 'IR 1', 'the IR control named a Scratchpad slot with another unit’s IR')
  assert.equal(irNow(donor, []).name, 'IR 1', 'with no bank list, the host’s Scratchpad name came through')
  assert.equal(cabShowing(donor).name, 'IR 1', 'the cab picker named a Scratchpad slot with another unit’s IR')
  assert.equal(slotIr(donor.slots[0]), 'IR 1')
  /* A firmware bank's name is still the host's. */
  const legacySlot = irCab(0, 3, 1)
  legacySlot.slots[0].irName = '1x8 TWEED'
  assert.equal(cabShowing(legacySlot).name, '1x8 TWEED')
  assert.equal(irNow(legacySlot, []).name, '1x8 TWEED')
  /* No IR list, no names: the named banks drop out rather than showing as numbers. */
  assert.deepEqual(irBanks(irCab(0), null, irKnobs).map((b) => b.name), ['User'])
  assert.deepEqual(irBanks(null, fm3Irs(), irKnobs), [])
})

test('the IR search finds by name or number across the banks, and counts what it does not draw', async () => {
  const { irBanks, findIrs, irLabel } = await import('../shared/cab-pick.mjs')
  const banks = irBanks(irCab(0), fm3Irs(), irKnobs)
  const browse = findIrs(banks, '', 3, 40)
  assert.deepEqual(browse.rows.map((r) => r.name), ['1x6 OVAL', '1x8 TWEED', '4x12 G12H CREAMBACK MIX (CEL)'])
  assert.equal(browse.more, 0)
  const recto = findIrs(banks, '4x12 recto', 0, 40).rows
  assert.deepEqual(recto.map((r) => [r.bank, r.ir, r.name, r.bankName]), [[0, 2, '4x12 Recto', 'Factory 1']])
  const four = findIrs(banks, '4x12', 0, 40).rows.map((r) => r.bankName)
  assert.deepEqual(four, ['Factory 1', 'Legacy'], 'a search stayed in one bank')
  assert.deepEqual(findIrs(banks, 'user 700', 0, 40).rows.map((r) => [r.bank, r.ir, r.name]), [[2, 699, 'IR 700']])
  /* A number on his own bank: his IR, not the factory names with "12" in them. */
  const twelve = findIrs(banks, '12', 2, 40).rows[0]
  assert.deepEqual([twelve.bank, twelve.ir, twelve.name], [2, 11, 'IR 12'], 'a number typed on his own bank found factory names first')
  assert.deepEqual(findIrs(banks, 'oh 412', null, 40).rows, [], 'the search found another unit’s Scratchpad IRs')
  const user = findIrs(banks, '', 2, 40)
  assert.equal(user.rows.length, 40)
  assert.equal(user.more, 1024 - 40, 'the rows not drawn were not counted')
  assert.equal(irLabel('<EMPTY>', 1), 'IR 2 (empty)')
  assert.equal(irLabel('#12', 12), 'IR 13')
  assert.equal(irLabel('', undefined), 'IR —')
})

test('picking an IR writes the bank, then the IR, then the mode last, all as whole numbers', async () => {
  const { pickCab, pickIr } = await import('../shared/cab-pick.mjs')
  const sent = []
  const write = async (id, v) => (sent.push([id, v]), { ok: true })
  const res = await pickCab(irCab(1, 0, 2), { bank: 3, ir: 1, name: '1x8 TWEED' }, write)
  assert.equal(res.ok, true)
  assert.deepEqual(sent, [[0, 3], [4, 1], [31, 0]], 'the mode has to go last, once the IR it switches to is there')
  for (const [, v] of sent) assert.ok(Number.isInteger(v), `${v} is a position, not an ordinal`)
  assert.ok(!sent.some(([id]) => id === 85), 'an IR pick touched the DynaCab')

  /* Already on the bank, and already playing an IR: the number alone. */
  sent.length = 0
  await pickIr(irCab(0, 3, 0), { bank: 3, ir: 2 }, write)
  assert.deepEqual(sent, [[4, 2]])
  /* An unsure state is trusted for nothing. */
  sent.length = 0
  await pickIr({ ...irCab(0, 3, 0), unsure: true }, { bank: 3, ir: 2 }, write)
  assert.deepEqual(sent, [[0, 3], [4, 2], [31, 0]])

  /* A refused bank stops there. */
  sent.length = 0
  const noBank = await pickIr(irCab(1, 0, 2), { bank: 3, ir: 1 }, async (id, v) => (sent.push([id, v]), { ok: id !== 0 }))
  assert.equal(noBank.ok, false)
  assert.deepEqual(sent, [[0, 3]], 'the IR went out after the bank was refused')
  /* A refused IR puts the bank back, rather than leaving the old number in a new bank. */
  sent.length = 0
  const noIr = await pickIr(irCab(0, 0, 2), { bank: 3, ir: 1 }, async (id, v) => (sent.push([id, v]), { ok: id !== 4 }))
  assert.equal(noIr.ok, false)
  assert.deepEqual(sent, [[0, 3], [4, 1], [0, 0]], 'the bank was not put back after the IR was refused')
  assert.ok(!sent.some(([id]) => id === 31), 'the mode went out after the IR was refused')
})

test('undoing an IR pick puts back the bank and the IR, the mode first back to a DynaCab and last back to an IR', async () => {
  const { pickCab, restoreCab, cabWas, cabShows, cabBackTo, cabAfter, taken } = await import('../shared/cab-pick.mjs')
  const pick = { bank: 2, ir: 9, name: 'IR 10' }
  const before = irCab(1, 0, 2)
  const was = cabWas(before, [{ value: 3, name: '1x12 Blue' }], pick)
  assert.deepEqual([was.kind, was.bank, was.ir, was.mode, was.name], ['ir', 0, 2, 1, '1x12 Blue'])
  /* A DynaCab pick's undo is what it always was. */
  assert.equal(cabWas(before, [], 11).kind, undefined)

  const res = await pickCab(before, pick, async () => ({ ok: true }))
  /* A read-back that failed: what the writes left, which shows the pick. */
  const after = cabAfter(before, taken(res))
  assert.ok(cabShows(after, pick), 'the state kept after a failed re-read does not show the IR')
  assert.deepEqual([after.slots[0].bank.label, after.slots[0].irIndex, after.mode.value], ['USER', 9, 0])
  assert.equal(cabShows(after, 11), false, 'an IR was taken for a DynaCab')

  const sent = []
  const back = await restoreCab(after, was, async (id, v) => (sent.push([id, v]), { ok: true }))
  assert.equal(back.ok, true)
  assert.deepEqual(sent, [[31, 1], [0, 0], [4, 2]], 'undoing back to a DynaCab played the IRs on the way')
  /* Back to an IR, the mode stays last, as in a pick. */
  const fromIr = irCab(0, 0, 2)
  const wasIr = cabWas(fromIr, [], pick)
  const onIr = []
  await restoreCab(cabAfter(fromIr, taken(await pickCab(fromIr, pick, async () => ({ ok: true })))), wasIr, async (id, v) => (onIr.push([id, v]), { ok: true }))
  assert.deepEqual(onIr, [[0, 0], [4, 2], [31, 0]], 'the undo left the old number in the new bank, or switched before the IR was back')
  assert.ok(cabBackTo(before, was))
  assert.equal(cabBackTo(irCab(1, 2, 2), was), false, 'a block in another bank was taken as put back')
  /* A refused IR pick counts only the bank it put back. */
  const half = await pickCab(irCab(0, 0, 2), pick, async (id) => ({ ok: id !== 4 }))
  assert.equal(cabAfter(irCab(0, 0, 2), taken(half)).slots[0].bank.value, 0)
})

test('the browser picks an IR on the discrete path, and every route it uses travels from a phone', async () => {
  const store = { 'forgefx.host': 'http://unit.test' }
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v)
    },
    removeItem: (k) => {
      delete store[k]
    }
  }
  const seen = []
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET'
    const path = String(url).replace('http://unit.test', '')
    seen.push({ method, path, body: options.body ? JSON.parse(options.body) : null })
    const answer = path.endsWith('/cab') ? irCab(1, 0, 2) : path === '/cab/irs' ? fm3Irs() : { ok: true }
    return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify(answer) }
  }
  try {
    const fx = await import('../src/lib/forgefx.js')
    const { pickCab, irBanks, findIrs } = await import('../shared/cab-pick.mjs')
    const cab = await fx.cabState(62)
    const banks = irBanks(cab, await fx.listIrBanks(), irKnobs)
    const row = findIrs(banks, 'tweed', null, 40).rows[0]
    await pickCab(cab, row, (id, v) => fx.setEnum(62, id, v))
    const writes = seen.filter((c) => c.method !== 'GET')
    assert.deepEqual(
      writes.map((c) => [c.method, c.path, c.body]),
      [
        ['PUT', '/preset/blocks/62/params/0', { value: 3, continuous: false }],
        ['PUT', '/preset/blocks/62/params/4', { value: 1, continuous: false }],
        ['PUT', '/preset/blocks/62/params/31', { value: 0, continuous: false }]
      ]
    )
    assert.ok(!seen.some((c) => c.path.endsWith('/type')), 'an IR pick posted a model change')
    for (const c of seen) assert.equal(forbiddenRemotely(c.method, c.path), null, `${c.method} ${c.path} is refused over the relay`)
  } finally {
    delete globalThis.fetch
    delete globalThis.localStorage
  }
})

test('the cab editor offers the IR picker and picks through the cab pick, with an undo that knows it', () => {
  const src = readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8')
  const panel = src.slice(src.indexOf('export function BlockPanel'), src.indexOf('function fmt('))
  const cabWrite = panel.slice(panel.indexOf('const applyCab = async'), panel.indexOf('const swapModel = async'))
  /* Taken, and the cab reads as something else: said on screen, after the
     change line, whose read clears the error line. */
  const elsewhere = cabWrite.search(/if \(read && !landed\) onError\(cabElsewhere\(read, models\)\)/)
  assert.ok(elsewhere > 0, 'a cab the unit did not keep is reported as done')
  assert.ok(elsewhere > cabWrite.indexOf('onChanged(`${block.name} → ${name}${read'), 'the word that the cab did not land is cleared by the change line after it')
  /* The DynaCab's name, words and photo stay together; the IR control after them. */
  assert.ok(panel.indexOf('<IrPicker ') > panel.indexOf('className="gear-photo"'), 'the IR picker sits between the DynaCab picker and the DynaCab’s own description and photo')
  assert.match(panel, /listIrBanks\(\)/, 'the cab editor never reads the IR names')
  assert.match(panel, /irBanks\(cab, irs, \{ named: params \}\)/, 'the IR banks are not built from the cab state')
  assert.match(panel, /<IrPicker banks=\{irList\} now=\{irHere\} onPick=\{swapIr\}/, 'the cab editor has no IR picker')
  assert.match(panel.replace(/\s+/g, ' '), /const swapIr = async \(pick\) => \{ try \{ await applyCab\(pick\)/, 'an IR pick does not go through the cab pick')
  assert.match(cabWrite, /const was = cabWas\(before, models, value\)/, 'the undo is not told an IR was picked, so it cannot put the bank back')
  const picker = readSrc(new URL('../src/components/IrPicker.jsx', import.meta.url), 'utf8')
  assert.match(picker, /findIrs\(banks, hunt, onBank, SHOWN\)/, 'the IR list has no search')
  assert.match(picker, /onPick\(\{ bank: r\.bank, ir: r\.ir, name: r\.name \}\)/)
  assert.match(picker, /USER_IRS_NOTE/, 'nothing says why his own IRs are numbers')
})

test('the demo FM3 has the unit’s bank gap, and an IR picked in it lands and comes back', async () => {
  const { createMockDevice } = await import('../src/lib/mockDevice.js')
  const { pickCab, restoreCab, cabWas, cabShows, cabBackTo, irBanks, irNow, findIrs } = await import('../shared/cab-pick.mjs')
  const unit = createMockDevice('fm3')
  const cabBlock = (await unit.presetBlocks()).find((b) => b.slug === 'cab')
  const eid = cabBlock.effectId
  const write = (id, v) => unit.setEnum(eid, id, v)
  const cab = unit.cabState(eid)
  assert.equal(cab.bankOptions[2], 'USER', 'the demo has no USER bank where an FM3 has one')
  assert.ok(!('USER' in unit.irs()), 'the demo names his own IRs, which the unit does not')
  const banks = irBanks(cab, unit.irs(), await unit.blockParams(eid))
  const legacy = banks.find((b) => b.name === 'Legacy')
  assert.equal(legacy.value, 3)
  const row = findIrs(banks, '', legacy.value, 40).rows[1]
  const was = cabWas(cab, [], row)
  await pickCab(cab, row, write)
  const picked = unit.cabState(eid)
  assert.ok(cabShows(picked, row), 'the demo does not show the IR that was picked')
  assert.equal(irNow(picked, banks).name, row.name)
  assert.equal(picked.slots[0].irName, row.name, 'the demo named the IR out of another bank')
  await restoreCab(picked, was, write)
  assert.ok(cabBackTo(unit.cabState(eid), was), 'the undo did not put the demo back on its DynaCab')
  /* A User IR has no name, and says its number. */
  await pickCab(unit.cabState(eid), { bank: 2, ir: 4 }, write)
  assert.equal(irNow(unit.cabState(eid), banks).name, 'IR 5')
})

test('an IR pick the unit took but did not keep says what the unit is on', async () => {
  const { createMockDevice } = await import('../src/lib/mockDevice.js')
  const { pickCab, cabShows, cabShowing, cabElsewhere, irBanks, findIrs, CAB_REFUSED } = await import('../shared/cab-pick.mjs')
  const unit = createMockDevice('fm3')
  const eid = (await unit.presetBlocks()).find((b) => b.slug === 'cab').effectId
  const cab = unit.cabState(eid)
  const irParam = cab.slots[0].irParam
  const banks = irBanks(cab, unit.irs(), await unit.blockParams(eid))
  const pick = findIrs(banks, '', banks.find((b) => b.name === 'Legacy').value, 40).rows[1]
  /* Every write answered ok, and the unit stores the next IR along. */
  const res = await pickCab(cab, pick, (id, v) => unit.setEnum(eid, id, id === irParam ? v + 1 : v))
  const read = unit.cabState(eid)
  assert.equal(res.ok, true)
  assert.equal(cabShows(read, pick), false, 'the demo kept the IR it was meant to miss')
  const shown = cabShowing(read).name
  assert.notEqual(shown, pick.name)
  assert.equal(cabElsewhere(read, []), `The unit shows ${shown} instead.`)
  assert.equal(cabElsewhere(null), CAB_REFUSED)
})

test('after a write throws part way through an IR pick, the next pick writes the bank again', async () => {
  const { pickCab, cabLost } = await import('../shared/cab-pick.mjs')
  const before = irCab(0, 0, 5)
  const thrown = await pickCab(before, { bank: 1, ir: 10 }, async (id) => {
    if (id === 4) throw new Error("Your computer didn't answer.")
    return { ok: true }
  }).catch((e) => e)
  assert.ok(thrown instanceof Error)
  /* The re-read failed too: the old numbers are kept, but not trusted. */
  const held = cabLost(before, null)
  assert.equal(held.unsure, true, 'the panel still trusts the bank the unit moved off')
  const sent = []
  await pickCab(held, { bank: 0, ir: 7 }, async (id, v) => (sent.push([id, v]), { ok: true }))
  assert.deepEqual(sent, [[0, 0], [4, 7], [31, 0]], 'the next pick into the old bank skipped the bank write')
  /* A good re-read is the answer. */
  const fresh = irCab(0, 1, 5)
  assert.equal(cabLost(before, fresh), fresh)
  assert.equal(cabLost(before, { ...fresh, unsure: true }).slots[0].bank.value, 0)
  assert.equal(cabLost(null, null), null)
})



/*
 * "Amp model change resets the tone; Undo only restores the model."
 *
 * The FM3 loads a new model's own settings when the model changes, and the
 * Undo remembered the model's number and nothing else. These drive the shared
 * rule against a unit that does what the FM3 does: a model write puts every
 * setting on the block back to that model's own.
 */
function modelBench({ knobs = 6, enums = 2, deaf = [], stubborn = [], refuseModel = false, blindAfter = Infinity } = {}) {
  const own = (model) => ({
    named: Array.from({ length: knobs }, (_, i) => ({
      id: i,
      name: ['Gain', 'Bass', 'Mid', 'Treble', 'Presence', 'Master', 'Bright', 'Depth'][i] || `Knob ${i}`,
      value: model === 0 ? 2 : 5,
      norm: model === 0 ? 0.2 : 0.5,
      min: 0,
      max: 10
    })),
    enums: Array.from({ length: enums }, (_, i) => ({ id: 100 + i, name: `Switch ${i}`, value: model === 0 ? 0 : 1, options: [] }))
  })
  const unit = { model: 0, ...own(0) }
  const log = []
  let reads = 0
  const read = async () => {
    reads++
    if (reads > blindAfter) throw new Error('timeout')
    return JSON.parse(JSON.stringify({ named: unit.named, enums: unit.enums, type: { value: unit.model, name: unit.model ? 'Plexi' : 'USA Clean' } }))
  }
  const knob = (id, v) => {
    const k = unit.named.find((p) => p.id === id)
    k.value = v
    k.norm = v / 10
  }
  const io = (channel = 'A') => ({
    channel,
    setType: async (v) => {
      log.push(['type', v])
      if (refuseModel) return { ok: false }
      unit.model = v
      Object.assign(unit, own(v))
      return { ok: true }
    },
    read,
    write: async (p, v) => {
      log.push(['knob', p.id, v])
      /* A deaf knob ignores the plain write; the checked one reaches it. */
      if (!deaf.includes(p.id) && !stubborn.includes(p.id)) knob(p.id, v)
      return { ok: true }
    },
    writeChecked: async (p, v) => {
      log.push(['checked', p.id, v])
      if (!stubborn.includes(p.id)) knob(p.id, v)
      return { ok: !stubborn.includes(p.id) }
    },
    writeEnum: async (id, v) => {
      log.push(['enum', id, v])
      unit.enums.find((e) => e.id === id).value = v
      return { ok: true }
    },
    progress: (p) => log.push(['said', p.step, p.done, p.total])
  })
  return { unit, log, read, knob, io, reads: () => reads }
}

test('Undo after a model change puts back the model, every knob and every switch', async () => {
  const { modelSnapshot, restoreModel, undoResult, undoOffer, settingsIn } = await import('../shared/model-undo.mjs')
  const bench = modelBench()
  /* His own tone on the old model: not the model's settings. */
  bench.knob(1, 7.5)
  bench.knob(4, 3.1)
  bench.unit.enums[1].value = 3
  const snap = modelSnapshot(await bench.read(), { channel: 'A' })
  assert.equal(settingsIn(snap), 8, 'the switches were left out of the snapshot')
  assert.match(undoOffer(snap), /^Was USA Clean — Undo puts back the model and the 8 settings the app can see\.$/)

  /* The pick: the unit loads the new model's own settings. */
  await bench.io().setType(1)
  assert.equal(bench.unit.named[1].value, 5, 'the bench does not do what the FM3 does')

  bench.log.length = 0
  const r = await restoreModel(snap, bench.io('A'))
  assert.equal(bench.unit.model, 0, 'the old model did not go back')
  assert.deepEqual(bench.unit.named.map((k) => k.value), [2, 7.5, 2, 2, 3.1, 2], 'the knobs are still the new model’s')
  assert.deepEqual(bench.unit.enums.map((e) => e.value), [0, 3], 'the switches are still the new model’s')
  assert.deepEqual(r.missed, [])
  assert.equal(undoResult(r, snap).text, 'Put back all 8 settings the app can see.')
  assert.equal(undoResult(r, snap).bad, false)
  /* The model first, then only what the model write moved — and no checked
     writes, because nothing missed. */
  assert.deepEqual(bench.log[1], ['type', 0], 'the settings went out before the model')
  const writes = bench.log.filter(([k]) => k === 'knob' || k === 'enum' || k === 'checked')
  assert.deepEqual(
    writes.map(([k, id]) => `${k}:${id}`),
    ['knob:1', 'knob:4', 'enum:101'],
    'settings the model write left alone were written again'
  )
  assert.ok(bench.log.some(([k, step]) => k === 'said' && step === 'settings'), 'nothing was said while it ran')
})

test('a setting that ignores the plain write gets the checked one; one that ignores both is named', async () => {
  const { modelSnapshot, restoreModel, undoResult } = await import('../shared/model-undo.mjs')
  /* Twenty-three settings, the way an amp has them. */
  const bench = modelBench({ knobs: 8, enums: 15, deaf: [0], stubborn: [1, 6] })
  for (let i = 0; i < 8; i++) bench.knob(i, 8)
  const snap = modelSnapshot(await bench.read(), { channel: 'A' })
  await bench.io().setType(1)
  bench.log.length = 0
  const r = await restoreModel(snap, bench.io('A'))
  const checked = bench.log.filter(([k]) => k === 'checked').map(([, id]) => id)
  assert.deepEqual(checked, [0, 1, 6], 'only the misses get the checked write, and every miss gets it')
  assert.equal(bench.unit.named[0].value, 8, 'the checked write did not reach the deaf knob')
  assert.deepEqual(r.missed, ['Bass', 'Bright'])
  const said = undoResult(r, snap)
  assert.equal(said.text, "Put back 21 of 23 — Bass and Bright didn't take.")
  assert.equal(said.bad, true)
  assert.equal(said.keep, false, 'an Undo that ran is offered again')
})

test('Undo refuses on another channel, and says so without writing anything', async () => {
  const { modelSnapshot, restoreModel, undoResult } = await import('../shared/model-undo.mjs')
  const bench = modelBench()
  const snap = modelSnapshot(await bench.read(), { channel: 'A' })
  await bench.io().setType(1)
  bench.log.length = 0
  const r = await restoreModel(snap, bench.io('B'))
  assert.equal(r.refused, 'channel')
  assert.deepEqual(bench.log, [], 'channel A’s tone was written onto channel B')
  const said = undoResult(r, snap)
  assert.equal(said.keep, true, 'the offer went, so switching back to A cannot use it')
  assert.match(said.text, /channel A/)
})

test('a model the unit will not go back to leaves every setting alone, and an unreadable finish says so', async () => {
  const { modelSnapshot, restoreModel, undoResult } = await import('../shared/model-undo.mjs')
  const refused = modelBench({ refuseModel: true })
  const snap = modelSnapshot(await refused.read(), { channel: 'A' })
  refused.unit.model = 1
  refused.log.length = 0
  const r = await restoreModel(snap, refused.io('A'))
  assert.equal(r.refused, 'model')
  assert.ok(!refused.log.some(([k]) => k === 'knob' || k === 'enum'), 'settings were written onto the wrong model')
  assert.equal(undoResult(r, snap).keep, true)

  /* The settings went out, and the read that would check them never came back. */
  const blind = modelBench({ blindAfter: 2 })
  blind.knob(2, 9)
  const snap2 = modelSnapshot(await blind.read(), { channel: 'A' })
  await blind.io().setType(1)
  const r2 = await restoreModel(snap2, blind.io('A'))
  assert.equal(r2.unchecked, true)
  assert.match(undoResult(r2, snap2).text, /couldn't read them back to check/)
  assert.doesNotMatch(undoResult(r2, snap2).text, /Put back all/, 'an unchecked Undo was called done')
  /* The panel is drawn from what the writes left, not from the read taken
     before them — a knob drawn at the new model's 5 would be dragged from 5. */
  assert.equal(blind.unit.named[2].value, 9)
  assert.equal(r2.last.named.find((k) => k.id === 2).value, 9, 'the panel shows the new model’s settings after they were put back')
})

test('an Undo whose every write threw says nothing was sent, and keeps the way back', async () => {
  const { modelSnapshot, restoreModel, undoResult } = await import('../shared/model-undo.mjs')
  const bench = modelBench({ blindAfter: 2 })
  bench.knob(2, 9)
  const snap = modelSnapshot(await bench.read(), { channel: 'A' })
  await bench.io().setType(1)
  const cut = () => {
    throw new Error("Can't reach the Fractal app")
  }
  const r = await restoreModel(snap, { ...bench.io('A'), write: cut, writeChecked: cut, writeEnum: cut })
  assert.equal(r.unsent, true, 'writes that all threw were counted as sent')
  const said = undoResult(r, snap)
  assert.equal(said.keep, true, 'the snapshot of his tone was thrown away with nothing put back')
  assert.doesNotMatch(said.text, /sent your settings/)
  assert.match(said.text, /Try Undo again/)
  /* The unit has the old model's own 2 on it, and so does the panel. */
  assert.equal(bench.unit.named[2].value, 2)
  assert.equal(r.last.named.find((k) => k.id === 2).value, 2, 'the panel shows settings that never went')
})

test('an Undo where some writes threw and the check could not be read says so, and keeps the way back', async () => {
  const { modelSnapshot, restoreModel, undoResult } = await import('../shared/model-undo.mjs')
  const bench = modelBench({ knobs: 4, enums: 0, blindAfter: 2 })
  for (let i = 0; i < 4; i++) bench.knob(i, 8)
  const snap = modelSnapshot(await bench.read(), { channel: 'A' })
  await bench.io().setType(1)
  const io = bench.io('A')
  let n = 0
  const write = io.write
  /* A relay that times out on every other write. */
  io.write = async (p, v) => {
    if (n++ % 2) throw new Error("Your computer didn't answer.")
    return write(p, v)
  }
  const r = await restoreModel(snap, io)
  assert.equal(r.unchecked, true)
  assert.equal(r.partial, true, 'writes that threw were counted as sent')
  assert.deepEqual(bench.unit.named.map((k) => k.value), [8, 2, 8, 2])
  const said = undoResult(r, snap)
  assert.doesNotMatch(said.text, /sent your settings/, 'settings that never went were called sent')
  assert.match(said.text, /Try Undo again/)
  assert.equal(said.keep, true, 'the only record of his old settings was thrown away with half of them not sent')
})

test('an Undo whose every setting write threw, though the reads came back, keeps the way back', async () => {
  const { modelSnapshot, restoreModel, undoResult } = await import('../shared/model-undo.mjs')
  const bench = modelBench({ knobs: 4, enums: 1 })
  for (let i = 0; i < 4; i++) bench.knob(i, 8)
  const snap = modelSnapshot(await bench.read(), { channel: 'A' })
  await bench.io().setType(1)
  const cut = () => {
    throw new Error("Your computer didn't answer.")
  }
  const r = await restoreModel(snap, { ...bench.io('A'), write: cut, writeChecked: cut, writeEnum: cut })
  assert.equal(r.unchecked, false)
  assert.equal(r.retry, true)
  const said = undoResult(r, snap)
  assert.equal(said.keep, true, 'an Undo that sent nothing threw its snapshot away')
  assert.match(said.text, /Try Undo again/)
})

test('a model write that threw is not said to have been sent', async () => {
  const { modelSnapshot, restoreModel, undoResult } = await import('../shared/model-undo.mjs')
  const bench = modelBench()
  const snap = modelSnapshot(await bench.read(), { channel: 'A' })
  await bench.io().setType(1)
  const blind = () => {
    throw new Error('timeout')
  }
  const r = await restoreModel(snap, {
    ...bench.io('A'),
    setType: () => {
      throw new Error("Can't reach the Fractal app")
    },
    read: blind
  })
  assert.equal(r.refused, 'unread')
  assert.equal(r.modelSent, false, 'a model write that threw was counted as sent')
  const said = undoResult(r, snap)
  assert.doesNotMatch(said.text, /was sent/)
  assert.equal(said.keep, true)
  /* And one that went, with the read after it lost, is said to have gone. */
  const r2 = await restoreModel(snap, { ...bench.io('A'), read: blind })
  assert.equal(r2.refused, 'unread')
  assert.equal(r2.modelSent, true)
  assert.match(undoResult(r2, snap).text, /was sent/)
})

test('a knob with no known range is not taken as put back because its position reads 0 at both ends', async () => {
  const { modelSnapshot, restoreModel, undoResult } = await import('../shared/model-undo.mjs')
  /* The Axe-Fx II reports a position of 0 for a knob the catalog gives no range. */
  const unit = { model: 0, sag: 30000, bass: 0.7 }
  const read = async () => ({
    type: { value: unit.model, name: unit.model ? 'Plexi' : 'USA Clean' },
    named: [
      { id: 1, name: 'Bass', value: unit.bass * 10, norm: unit.bass, min: 0, max: 10 },
      { id: 2, name: 'Supply Sag', value: unit.sag, norm: 0 }
    ],
    enums: []
  })
  const snap = modelSnapshot(await read(), { channel: 'A' })
  unit.model = 1
  unit.sag = 12000
  unit.bass = 0.5
  const noRange = () => {
    throw new Error('No range known')
  }
  const r = await restoreModel(snap, {
    channel: 'A',
    setType: async (v) => {
      unit.model = v
      return { ok: true }
    },
    read,
    write: async (p, v) => {
      if (p.id !== 1) return noRange()
      unit.bass = v / 10
      return { ok: true }
    },
    writeChecked: async (p, v) => {
      if (p.id !== 1) return noRange()
      unit.bass = v / 10
      return { ok: true }
    },
    writeEnum: async () => ({ ok: true })
  })
  assert.deepEqual(r.missed, ['Supply Sag'], 'a knob still off was counted as back')
  assert.doesNotMatch(undoResult(r, snap).text, /Put back all/)
})

test('an Undo stops the moment the block changes channel or preset, and sends nothing after', async () => {
  const { modelSnapshot, restoreModel, undoResult } = await import('../shared/model-undo.mjs')
  const bench = modelBench()
  for (let i = 0; i < 6; i++) bench.knob(i, 8)
  const snap = modelSnapshot(await bench.read(), { channel: 'A' })
  await bench.io().setType(1)
  bench.log.length = 0
  /* A footswitch on the floor after the second setting went back. */
  let here = true
  let readsAtFlip = null
  const io = bench.io('A')
  const write = io.write
  let writes = 0
  io.write = async (p, v) => {
    const r = await write(p, v)
    if (++writes === 2) {
      here = false
      readsAtFlip = bench.reads()
    }
    return r
  }
  const r = await restoreModel(snap, { ...io, stillHere: () => here })
  const after = bench.log.filter(([k]) => k === 'knob' || k === 'enum' || k === 'checked')
  assert.equal(after.length, 2, 'channel A’s settings went on landing after the channel changed')
  assert.equal(bench.reads(), readsAtFlip, 'the block was read again after it changed')
  assert.equal(r.stopped, true)
  const said = undoResult(r, snap)
  assert.equal(said.keep, true, 'the way back went, with half of it undone')
  assert.match(said.text, /channel A/)
  /* And one that has changed before the first write sends nothing at all. */
  bench.log.length = 0
  const r0 = await restoreModel(snap, { ...bench.io('A'), stillHere: () => false })
  assert.equal(r0.stopped, true)
  assert.deepEqual(bench.log.filter(([k]) => k !== 'said'), [], 'the model went out onto a block that had moved')
})

test('the demo FM3 loses its knobs on a model change, and Undo puts them back', async () => {
  const { createMockDevice } = await import('../src/lib/mockDevice.js')
  const { modelSnapshot, restoreModel } = await import('../shared/model-undo.mjs')
  const unit = createMockDevice('fm3')
  const amp = (await unit.presetBlocks()).find((b) => b.slug === 'amp')
  const eid = amp.effectId
  const first = await unit.blockParams(eid)
  const turned = first.named.find((p) => !p.log && p.max > p.min)
  const want = turned.min + (turned.max - turned.min) * 0.83
  await unit.setParam(eid, turned.id, toNormalized(want, turned))
  const snap = modelSnapshot(await unit.blockParams(eid), { channel: amp.channel ?? null })
  const other = (await unit.blockTypes('amp')).find((m) => m.value !== snap.type.value)
  await unit.setType(eid, other.value)
  const moved = (await unit.blockParams(eid)).named.find((p) => p.id === turned.id)
  assert.ok(Math.abs(moved.value - want) > 0.01, 'the demo keeps a knob across a model change, which the FM3 does not')
  const r = await restoreModel(snap, {
    channel: amp.channel ?? null,
    setType: (v) => unit.setType(eid, v),
    read: () => unit.blockParams(eid),
    write: (p, v) => unit.setParam(eid, p.id, toNormalized(v, p)),
    writeChecked: (p, v) => unit.setParam(eid, p.id, toNormalized(v, p)),
    writeEnum: (id, v) => unit.setEnum(eid, id, v)
  })
  assert.deepEqual(r.missed, [])
  const back = await unit.blockParams(eid)
  assert.equal(back.type.value, snap.type.value)
  assert.ok(Math.abs(back.named.find((p) => p.id === turned.id).value - want) < 0.05, 'the turned knob did not come back')
})

test('the browser snapshots the block before a model pick, and its Undo puts the settings back', () => {
  const src = readSrc(new URL('../src/components/Console.jsx', import.meta.url), 'utf8')
  const panel = src.slice(src.indexOf('export function BlockPanel'), src.indexOf('function fmt('))
  const apply = panel.slice(panel.indexOf('const applyModel = async'), panel.indexOf('const applyCab = async'))
  const undo = panel.slice(panel.indexOf('const undoModel = async'), panel.indexOf('return (\n    <div className="block-panel">'))
  assert.ok(apply.length > 100 && undo.length > 100, 'the model swap moved; this check reads it')
  /* The snapshot is a fresh read, taken before the write that loses it. */
  const snapAt = apply.indexOf('modelSnapshot(')
  assert.ok(snapAt > 0, 'a model pick keeps no snapshot of the settings')
  assert.ok(apply.indexOf('await blockParams(block.effectId)') < snapAt, 'the snapshot is not a fresh read')
  assert.ok(snapAt < apply.indexOf('await setType(block.effectId'), 'the snapshot is taken after the model write')
  assert.match(apply, /channel: block\.channel \?\? null/, 'the snapshot does not know which channel it is for')
  /* No eight seconds: it stays until the next pick or the editor closing. */
  assert.doesNotMatch(apply, /setTimeout/, 'a model Undo still runs out on a timer')
  assert.match(apply, /if \(before\) setUndo\(before\)/)
  /* Undo is the restore, not a fresh pick of the old model. */
  assert.match(undo, /await restoreModel\(back, \{/)
  assert.doesNotMatch(undo, /applyModel\(/, 'Undo is a pick of the old model again, settings and all lost')
  assert.match(undo, /writeChecked: \(p, v\) => setParamConfirmed\(eid, p\.id, v, p\)/, 'the misses are not retried with the checked write')
  assert.match(undo, /channel: block\.channel \?\? null/, 'Undo cannot tell the channel has moved')
  assert.match(undo, /progress: \(p\) => setRestoring\(\{ eid, \.\.\.p \}\)/, 'Undo shows nothing while it runs')
  /* Every write lands on whichever channel is live: another one stops it. */
  assert.match(undo, /stillHere: here\b/, 'an Undo goes on writing channel A’s settings after the channel changed')
  /* The pre-pick read is a round trip; a block that moved in it is not the one tapped. */
  const recheck = apply.indexOf('if (liveKey.current !== key) return')
  assert.ok(recheck > snapAt && recheck < apply.indexOf('await setType(block.effectId'), 'the model goes to a channel or preset that came up during the read')
  /* Said to the block it happened to, and locking only that block. */
  const flatUndo = undo.replace(/\s+/g, ' ')
  assert.match(flatUndo, /if \(onThis\(\)\) \{ if \(!said\.keep\) setUndo\(null\) setUndoSaid\(said\)/, 'an Undo’s answer shows up under another block')
  assert.match(panel, /const restoringHere = restoring && block && restoring\.eid === block\.effectId \? restoring : null/)
  assert.doesNotMatch(panel, /disabled=\{[^}]*!!restoring\}/, 'another block’s picker is locked by this one’s Undo')
  assert.match(panel, /disabled=\{busy \|\| !!restoringHere\}\s*>\s*\{ch\}/, 'a channel can be changed under a running Undo')
  /* And it says so on screen: the offer, the progress, the outcome, the hint. */
  assert.match(panel, /restoringHere \? undoProgress\(restoringHere, undo\) : undoOffer\(undo\)/)
  assert.match(panel, /\{undoSaid\.text\}/)
  assert.match(panel, /\{MODEL_HINT\}/, 'the hint under the picker is gone')
  /* Its state is kept above the early return, or the first empty panel crashes. */
  const early = panel.indexOf('if (!block) {')
  for (const hook of ['const [restoring, setRestoring] = useState', 'const [undoSaid, setUndoSaid] = useState']) {
    assert.ok(panel.indexOf(hook) > 0 && panel.indexOf(hook) < early, `${hook} is below the early return`)
  }
  /* A Revert or another preset puts other settings on the block: the offer goes. */
  assert.match(panel, /\}, \[block\?\.effectId, rev\]\)/, 'an Undo outlives the preset loading again')
})

console.log('\nsaving from away')

const saveWait = await import('../shared/save-wait.mjs')

/* A hand-turned clock for the wait: `sleep` never resolves on its own, so
   only an announcement or the test turning the clock moves anything. */
function waitBench() {
  let t = 5000
  const naps = []
  const sleep = (ms) =>
    new Promise((go) => {
      naps.push({ at: t + ms, go })
    })
  const turn = async (ms) => {
    const end = t + ms
    for (;;) {
      naps.sort((a, b) => a.at - b.at)
      const next = naps[0]
      if (!next || next.at > end) break
      naps.shift()
      t = next.at
      next.go()
      for (let i = 0; i < 20; i++) await null
    }
    t = end
    for (let i = 0; i < 20; i++) await null
  }
  const docs = { result: null, progress: null }
  const heard = new Set()
  const listen = (fn) => (heard.add(fn), () => heard.delete(fn))
  const announce = (id, data) => heard.forEach((fn) => fn(id, data))
  const written = []
  return {
    now: () => t,
    sleep,
    turn,
    docs,
    heard,
    announce,
    written,
    opts: (over = {}) => ({
      id: 'r1',
      resultDoc: 'fractal.saveResult.fm3',
      progressDoc: 'fractal.saveProgress.fm3',
      readResult: async () => docs.result,
      readProgress: async () => docs.progress,
      cancelRequest: async () => written.push(saveWait.cancelledSave('r1')),
      listen,
      sleep,
      now: () => t,
      ...over
    })
  }
}

test('a save stops before it is sent when the unit has moved to another preset', async () => {
  const { stillOnPreset, movedOffWords } = saveWait
  assert.deepEqual(await stillOnPreset(async () => ({ number: 12 }), 12), { ok: true })
  const moved = await stillOnPreset(async () => ({ number: 13 }), 12)
  assert.equal(moved.ok, false)
  assert.equal(moved.on, 13)
  assert.equal(moved.error, movedOffWords(13, 12))
  assert.match(moved.error, /preset 13 now, not 12\. Nothing was saved/)
  /* A read that fails, or says nothing, leaves the computer's own check to it. */
  assert.equal((await stillOnPreset(async () => { throw new Error('gone') }, 12)).ok, true)
  assert.equal((await stillOnPreset(async () => null, 12)).ok, true)
  assert.equal((await stillOnPreset(async () => ({ number: 4 }), null)).ok, true)
  /* Both ends ask before the request is parked. */
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const ask = app.indexOf('await stillOnPreset(currentPreset, preset?.number)')
  assert.ok(ask > 0 && ask < app.indexOf('const parked = await parkSave('), 'the browser parks a save without asking where the unit is')
  const phone = readSrc(new URL('../mobile/src/components/SaveToSlot.js', import.meta.url), 'utf8')
  const there = phone.indexOf('await stillOnPreset(currentPreset, preset?.number)')
  assert.ok(there > 0 && there < phone.indexOf('const run = startComputerSave('), 'the phone sends a save without asking where the unit is')
})

test('a save from away is answered the moment the computer writes, not on the next look', async () => {
  /*
   * "Save takes 60-90 s." The write is one message to the unit; the minute was
   * the looking. The computer announces every write to its store, and the
   * wait now hears its answer in that announcement. Here the timed look never
   * comes at all — the clock does not move — so only the announcement can
   * have ended it.
   */
  const b = waitBench()
  const w = saveWait.startSaveWait(b.opts())
  let said = null
  w.done.then((x) => (said = x))
  for (let i = 0; i < 20; i++) await null
  assert.equal(said, null)
  /* Somebody else's answer, and another document: neither is this one. */
  b.announce('fractal.saveResult.fm3', { id: 'other', ok: true, slot: 3 })
  b.announce('scene-names-fm3:12', { id: 'r1', ok: true })
  for (let i = 0; i < 20; i++) await null
  assert.equal(said, null, 'an answer to another request, or another document, ended this wait')
  b.announce('fractal.saveResult.fm3', { id: 'r1', ok: true, slot: 12 })
  for (let i = 0; i < 20; i++) await null
  assert.deepEqual(said, { ok: true, slot: 12 }, 'the announced answer was not taken')
  assert.equal(b.heard.size, 0, 'the wait keeps listening after it has its answer')
})

test('a save from away that nobody picks up says so, then gives up and writes over the request', async () => {
  const b = waitBench()
  /* The Mac leaves the last save's note in place: that one is not this one. */
  b.docs.progress = { id: 'r0', picked: true }
  const states = []
  const w = saveWait.startSaveWait(b.opts({ onState: (s) => states.push({ ...s }) }))
  let said = null
  w.done.then((x) => (said = x))
  await b.turn(saveWait.SAVE_LATE_MS - 1000)
  assert.deepEqual(states.filter((s) => s.late), [], 'it spoke up before it was late')
  await b.turn(2000 + saveWait.SAVE_POLL_MS)
  assert.ok(states.some((s) => s.late && !s.picked), 'a late save says nothing about it')
  assert.equal(said, null)
  await b.turn(saveWait.SAVE_WAIT_MS)
  assert.ok(said, 'the wait goes on for ever')
  assert.equal(said.ok, false)
  assert.equal(said.timedOut, true)
  assert.equal(said.error, saveWait.SAVE_TIMED_OUT)
  /* Written over, since a phone cannot delete: an old or a sleeping computer
     that wakes later passes over a request with no slot in it. */
  assert.deepEqual(b.written, [{ id: 'r1', cancelled: true }], 'the request is left for a computer to carry out later')
  assert.ok(!('slot' in saveWait.cancelledSave('r1')))
})

test('a computer that has picked the save up gets longer, and its answer after a cancel is believed', async () => {
  const b = waitBench()
  const w = saveWait.startSaveWait(b.opts())
  let said = null
  w.done.then((x) => (said = x))
  /* In its own document: phones already out there take any answer as final. */
  b.docs.progress = { id: 'r1', picked: true }
  b.announce('fractal.saveProgress.fm3', b.docs.progress)
  await b.turn(saveWait.SAVE_WAIT_MS + 1000)
  assert.equal(said, null, 'a computer part-way through a save is given up on at the same moment as one that never answered')
  assert.equal(b.written.length, 0, 'a computer part-way through a save had its request written over at two minutes')
  assert.notEqual(saveWait.saveProgressDoc('fm3'), saveWait.saveResultDoc('fm3'))
  /* Cancel while it is writing, and it answers in the next moment. */
  w.cancel()
  for (let i = 0; i < 20; i++) await null
  b.docs.result = { id: 'r1', ok: true, slot: 40 }
  await b.turn(2000)
  assert.deepEqual(said, { ok: true, slot: 40 }, 'a save that happened was reported as cancelled')
  assert.equal(b.written.length, 1, 'the cancel was not written over the request')
})

test('a Cancel the computer may be too late for waits to hear what it did', async () => {
  /*
   * The computer checks the request one last time, then stores. A cancel that
   * lands just after that check cannot stop it, and "Nothing was saved" over a
   * slot that was just written is the one answer that loses a preset.
   */
  const b = waitBench()
  const w = saveWait.startSaveWait(b.opts())
  let said = null
  w.done.then((x) => (said = x))
  b.docs.progress = { id: 'r1', picked: true }
  b.announce('fractal.saveProgress.fm3', b.docs.progress)
  await b.turn(700)
  w.cancel()
  for (let i = 0; i < 40; i++) await null
  await b.turn(2000)
  for (let i = 0; i < 200; i++) await null
  assert.equal(said, null, 'a slow answer after a cancel was taken for nothing saved')
  b.docs.result = { id: 'r1', ok: true, slot: 40 }
  b.announce('fractal.saveResult.fm3', b.docs.result)
  for (let i = 0; i < 40; i++) await null
  assert.deepEqual(said, { ok: true, slot: 40 }, 'a save that happened was reported as cancelled')

  /* Picked up only as the cancel lands, and heard of only by looking. The
     computer that obeyed says so, and that is what is said. */
  const b2 = waitBench()
  const w2 = saveWait.startSaveWait(
    b2.opts({ cancelRequest: async () => { b2.docs.progress = { id: 'r1', picked: true } } })
  )
  let said2 = null
  w2.done.then((x) => (said2 = x))
  await b2.turn(500)
  w2.cancel()
  for (let i = 0; i < 40; i++) await null
  assert.equal(said2, null, 'a pickup seen only after the cancel was not looked for')
  b2.docs.result = { id: 'r1', ok: false, cancelled: true, error: saveWait.SAVE_CANCELLED }
  await b2.turn(2000)
  assert.deepEqual(said2, { ok: false, error: saveWait.SAVE_CANCELLED, cancelled: true }, 'the computer’s own cancel reads as a failure')

  /* And one that never answers is not said to have saved nothing. */
  const b3 = waitBench()
  const w3 = saveWait.startSaveWait(b3.opts())
  let said3 = null
  w3.done.then((x) => (said3 = x))
  b3.docs.progress = { id: 'r1', picked: true }
  b3.announce('fractal.saveProgress.fm3', b3.docs.progress)
  await b3.turn(700)
  w3.cancel()
  for (let i = 0; i < 40; i++) await null
  await b3.turn(saveWait.SAVE_WORKING_MS + 2000)
  assert.ok(said3, 'a cancel after pickup waits for ever')
  assert.equal(said3.error, saveWait.SAVE_UNSURE)
  assert.ok(!said3.cancelled, 'a save that may have happened is shown as a quiet cancel')
})

test('a computer that took the save and then went quiet is not said to have saved nothing', async () => {
  const b = waitBench()
  const w = saveWait.startSaveWait(b.opts())
  let said = null
  w.done.then((x) => (said = x))
  b.docs.progress = { id: 'r1', picked: true }
  b.announce('fractal.saveProgress.fm3', b.docs.progress)
  for (let i = 0; i < 20; i++) await null
  await b.turn(saveWait.SAVE_WAIT_MS + saveWait.SAVE_WORKING_MS + saveWait.SAVE_POLL_MS + 2000)
  assert.ok(said, 'the wait goes on for ever')
  assert.equal(said.ok, false)
  assert.equal(said.timedOut, true)
  assert.equal(said.error, saveWait.SAVE_UNSURE, 'a computer that had the save is said to have saved nothing')
  assert.deepEqual(b.written, [{ id: 'r1', cancelled: true }])
})

test('a cancel that could not reach the computer does not promise nothing was saved', async () => {
  const failing = { cancelRequest: async () => { throw new Error('relay') } }
  const b = waitBench()
  const w = saveWait.startSaveWait(b.opts(failing))
  let said = null
  w.done.then((x) => (said = x))
  await b.turn(saveWait.SAVE_POLL_MS)
  w.cancel()
  for (let i = 0; i < 40; i++) await null
  assert.equal(said.error, saveWait.SAVE_UNSENT)
  assert.ok(!said.cancelled, 'a request still parked on the computer is shown as a quiet cancel')
  assert.ok(!/Nothing was saved/i.test(said.error))
  /* The same when it gives up on its own. */
  const b2 = waitBench()
  const w2 = saveWait.startSaveWait(b2.opts(failing))
  let said2 = null
  w2.done.then((x) => (said2 = x))
  await b2.turn(saveWait.SAVE_WAIT_MS + 1000)
  assert.equal(said2.error, saveWait.SAVE_UNSENT, 'a timeout whose overwrite failed says nothing was saved')
  assert.equal(said2.timedOut, true)
  /* And an answer that turns up on the last look is still what happened. */
  const b3 = waitBench()
  const w3 = saveWait.startSaveWait(
    b3.opts({ cancelRequest: async () => { b3.docs.result = { id: 'r1', ok: true, slot: 9 }; throw new Error('relay') } })
  )
  let said3 = null
  w3.done.then((x) => (said3 = x))
  await b3.turn(saveWait.SAVE_POLL_MS)
  w3.cancel()
  for (let i = 0; i < 40; i++) await null
  assert.deepEqual(said3, { ok: true, slot: 9 })
})

test('Cancel ends the wait at once and says nothing was saved', async () => {
  const b = waitBench()
  const w = saveWait.startSaveWait(b.opts())
  let said = null
  w.done.then((x) => (said = x))
  await b.turn(saveWait.SAVE_POLL_MS * 2)
  w.cancel()
  for (let i = 0; i < 40; i++) await null
  assert.deepEqual(said, { ok: false, error: saveWait.SAVE_CANCELLED, cancelled: true })
  assert.deepEqual(b.written, [{ id: 'r1', cancelled: true }])
  /* And a screen going away is not a cancel: nothing is written. */
  const b2 = waitBench()
  const w2 = saveWait.startSaveWait(b2.opts())
  let said2 = null
  w2.done.then((x) => (said2 = x))
  w2.stop()
  for (let i = 0; i < 40; i++) await null
  assert.equal(said2.stopped, true)
  assert.deepEqual(b2.written, [])
})

/*
 * "Put back" and "Play it" from the phone, or the website on one.
 *
 * Both went to the unit as /version/…, which the relay refuses — so from away
 * both buttons failed. Now the phone leaves a request in the computer's store
 * and the Mac window carries it out, as it does a save. And the panel's
 * promise that a copy is taken before a slot is overwritten is kept: a Put
 * back snapshots the slot first, or does not write it.
 */
const restoreMod = await import('../src/lib/restoreViaComputer.js')

function restoreBench({ versions, snapshot, bytes = [0xf0, 1, 2, 0xf7], slug = 'fm3', outside = () => false, slotName } = {}) {
  const calls = []
  const api = {
    listVersions: async () => {
      calls.push('list')
      return { versions: versions ?? [{ id: 'v1', location: 12, model: 'FM3', name: 'Clean' }] }
    },
    versionBytes: async (id) => {
      calls.push(`bytes ${id}`)
      return bytes
    },
    snapshotSlot: async (n) => {
      calls.push(`snapshot ${n}`)
      if (snapshot) return snapshot(n)
      return { version: { id: 'kept', location: n } }
    },
    loadPresetBytes: async (b) => {
      calls.push(`load ${b.length}`)
      return { ok: true }
    },
    storePreset: async (n) => {
      calls.push(`store ${n}`)
      return { ok: true }
    },
    slotName: async (n) => {
      calls.push(`name ${n}`)
      return slotName ? slotName(n) : 'Clean'
    },
    unitSlug: () => slug,
    slotOutside: outside
  }
  return { api, calls }
}

test('Put back reads the snapshot, keeps a copy of the slot, then writes it — in that order', async () => {
  const { api, calls } = restoreBench()
  const done = await restoreMod.restoreNow({ versionId: 'v1', mode: 'put', slot: 12, model: 'FM3' }, api)
  /*
   * The bytes before the copy: the computer keeps thirty snapshots a slot and
   * the copy is a thirty-first, so putting back the oldest would push out the
   * very snapshot being put back.
   */
  assert.deepEqual(calls, ['list', 'bytes v1', 'snapshot 12', 'load 4', 'store 12'])
  assert.equal(done.ok, true)
  assert.equal(done.kept, true)
  assert.equal(done.slot, 12)
  assert.match(done.said, /kept as a snapshot/)
})

const unprocessable = () => {
  const err = new Error('empty/invalid preset')
  err.status = 422
  throw err
}

test('an empty slot has nothing to keep, and any other failure to keep a copy writes nothing', async () => {
  /* The unit's own word for an empty slot, with the old name's tail on it. */
  const empty = restoreBench({ snapshot: unprocessable, slotName: () => '<EMPTY>k Album Chug' })
  const done = await restoreMod.restoreNow({ versionId: 'v1', mode: 'put', slot: 12 }, empty.api)
  assert.equal(done.kept, false)
  assert.deepEqual(empty.calls.slice(-2), ['load 4', 'store 12'], 'an empty slot stopped the Put back')
  assert.match(done.said, /empty, so there was nothing to keep/)

  const broken = restoreBench({
    snapshot: () => {
      const err = new Error('unit busy')
      err.status = 503
      throw err
    }
  })
  await assert.rejects(
    restoreMod.restoreNow({ versionId: 'v1', mode: 'put', slot: 12 }, broken.api),
    /Couldn’t keep a copy of what’s in slot 12 first, so nothing was changed/
  )
  assert.ok(!broken.calls.some((c) => c.startsWith('load') || c.startsWith('store')), 'a slot was written over with no copy kept')
})

test('a 422 on a slot with a preset in it is a copy that failed, not an empty slot', async () => {
  /*
   * The computer answers 422 for "empty/invalid preset" — and a real preset
   * whose dump came back failing its checksum is the invalid half. A name, a
   * blank name (what an unread name comes back as), or no name at all: none
   * is the unit saying the slot is empty, so nothing is written.
   */
  for (const slotName of [() => 'Clean Lead', () => '', () => { throw new Error('no answer') }]) {
    const bench = restoreBench({ snapshot: unprocessable, slotName })
    await assert.rejects(
      restoreMod.restoreNow({ versionId: 'v1', mode: 'put', slot: 12 }, bench.api),
      /Couldn’t keep a copy of what’s in slot 12 first, so nothing was changed/
    )
    assert.ok(!bench.calls.some((c) => /^(load|store)/.test(c)), 'a real preset was written over with no copy kept')
  }

  /* A damaged dump is usually a one-off: asked for once more, and kept. */
  let tries = 0
  const again = restoreBench({
    slotName: () => 'Clean Lead',
    snapshot: (n) => (++tries === 1 ? unprocessable() : { version: { id: 'kept', location: n } })
  })
  const done = await restoreMod.restoreNow({ versionId: 'v1', mode: 'put', slot: 12 }, again.api)
  assert.equal(done.kept, true)
  assert.deepEqual(again.calls.filter((c) => !/^(list|bytes|name)/.test(c)), ['snapshot 12', 'snapshot 12', 'load 4', 'store 12'])
  assert.ok(!/empty/.test(done.said))
})

test('a restore leaves Play it unsaved and Put back saved, wherever it was carried out', () => {
  assert.equal(restoreMod.dirtyAfterRestore('play'), true, 'Play it says "save it to keep it" with no Save button to do it')
  assert.equal(restoreMod.dirtyAfterRestore('put'), false, 'Put back still shows edits it just wrote over as unsaved')
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /const afterRestore = \(mode\) => \{\s*const unsaved = dirtyAfterRestore\(mode\)\s*dirtyRef\.current = unsaved\s*setDirty\(unsaved\)/)
  const ask = app.slice(app.indexOf('const restoreFromVersion'), app.indexOf('const cancelQueuedRestore'))
  assert.match(ask, /const done = await restoreNow\([\s\S]*?\)\s*afterRestore\(done\.mode\)/, 'at the Mac')
  assert.match(ask, /if \(said\.ok\) \{\s*afterRestore\(said\.mode \|\| mode\)/, 'from the phone')
  const mac = app.slice(app.indexOf('const handledRestores'), app.indexOf('}, [status, remote, restoreApi])'))
  assert.match(mac, /if \(out\.ok\) \{\s*afterRestoreLater\.current\(out\.mode\)/, 'at the Mac, for the phone')
})

test('a snapshot that has gone, moved, or belongs to another unit is refused before anything is written', async () => {
  const writes = (calls) => calls.filter((c) => /^(snapshot|load|store)/.test(c))
  const gone = restoreBench({ versions: [] })
  await assert.rejects(restoreMod.restoreNow({ versionId: 'v1', mode: 'put', slot: 12 }, gone.api), { message: restoreMod.RESTORE_GONE })
  assert.deepEqual(writes(gone.calls), [])
  /* A list that could not be read is not a snapshot that has gone. */
  const unread = restoreBench()
  unread.api.listVersions = async () => {
    unread.calls.push('list')
    throw new Error('Can’t reach the Fractal app on your computer.')
  }
  await assert.rejects(restoreMod.restoreNow({ versionId: 'v1', mode: 'put', slot: 12 }, unread.api), { message: restoreMod.RESTORE_NO_LIST })
  assert.notEqual(restoreMod.RESTORE_NO_LIST, restoreMod.RESTORE_GONE)
  assert.ok(!unread.calls.some((c) => /^(bytes|snapshot|load|store)/.test(c)))

  const moved = restoreBench()
  await assert.rejects(restoreMod.restoreNow({ versionId: 'v1', mode: 'put', slot: 13 }, moved.api), { message: restoreMod.RESTORE_MOVED })
  await assert.rejects(restoreMod.restoreNow({ versionId: 'v1', mode: 'play', slot: 12, model: 'FM9' }, moved.api), { message: restoreMod.RESTORE_MOVED })
  assert.deepEqual(writes(moved.calls), [])

  const other = restoreBench({ slug: 'axefxiii' })
  await assert.rejects(restoreMod.restoreNow({ versionId: 'v1', mode: 'play', slot: 12 }, other.api), /from an FM3/)
  assert.deepEqual(writes(other.calls), [])
  /* A unit nobody has named yet, or a model the computer could not place, is not evidence. */
  const unnamed = restoreBench({ slug: 'device', versions: [{ id: 'v1', location: 12, model: 'model_0x99' }] })
  assert.equal((await restoreMod.restoreNow({ versionId: 'v1', mode: 'play', slot: 12 }, unnamed.api)).ok, true)

  const outside = restoreBench({ outside: (n) => n > 3 })
  await assert.rejects(restoreMod.restoreNow({ versionId: 'v1', mode: 'put', slot: 12 }, outside.api), /isn’t on this unit/)
  assert.deepEqual(writes(outside.calls), [])

  const unreadable = restoreBench({ bytes: null })
  await assert.rejects(restoreMod.restoreNow({ versionId: 'v1', mode: 'put', slot: 12 }, unreadable.api), { message: restoreMod.RESTORE_UNREADABLE })
  assert.deepEqual(writes(unreadable.calls), [], 'a copy was taken of a slot whose Put back was never going to happen')
})

test('Play it loads the snapshot and writes no slot', async () => {
  const { api, calls } = restoreBench()
  const done = await restoreMod.restoreNow({ versionId: 'v1', mode: 'play', slot: 12 }, api)
  assert.deepEqual(calls, ['list', 'bytes v1', 'load 4'])
  assert.equal(done.mode, 'play')
  assert.match(done.said, /isn’t saved to a slot/)
})

function macBench(parked, over = {}) {
  const { api, calls } = restoreBench(over)
  const told = []
  let doc = parked
  Object.assign(api, {
    take: async () => doc,
    clear: async () => {
      calls.push('clear')
      doc = null
      return true
    },
    picked: async (id) => calls.push(`picked ${id}`),
    report: async (r) => told.push(r)
  })
  return { api, calls, told, set: (d) => (doc = d) }
}

test('the Mac carries out a parked Put back once, says it has it first, and tells the phone how it went', async () => {
  const req = { id: 'r1', mode: 'put', versionId: 'v1', slot: 12, model: 'FM3', at: 1000 }
  const m = macBench(req)
  const handled = new Set()
  const out = await restoreMod.carryOutRestore(req, m.api, { handled, now: () => 2000 })
  assert.ok(handled.has('r1'))
  assert.ok(m.calls.indexOf('picked r1') > -1 && m.calls.indexOf('picked r1') < m.calls.indexOf('store 12'), 'the phone is not told the computer has it before the write')
  assert.equal(out.ok, true)
  assert.equal(m.told.length, 1)
  assert.equal(m.told[0].id, 'r1')
  assert.match(m.told[0].said, /slot 12/)
  assert.ok(m.calls.includes('clear'))
  /* Looked at again after it ran: not done twice. */
  assert.equal(await restoreMod.carryOutRestore(req, m.api, { handled, now: () => 2000 }), null)
  assert.equal(m.calls.filter((c) => c === 'store 12').length, 1)
  /* Looked at again while it is still running (an effect run again partway through): the mark comes before the first wait, so only one carries it out. */
  const both = macBench(req)
  const twice = new Set()
  const [a, b] = await Promise.all([
    restoreMod.carryOutRestore(req, both.api, { handled: twice, now: () => 2000 }),
    restoreMod.carryOutRestore(req, both.api, { handled: twice, now: () => 2000 })
  ])
  assert.equal([a, b].filter((x) => x === null).length, 1, 'a second look partway through carried it out as well')
  assert.equal(both.calls.filter((c) => c === 'store 12').length, 1)
  assert.equal(both.told.length, 1)
})

test('the Mac passes over a cancelled, stale or failed restore and says so every time', async () => {
  /* Cancelled: the phone wrote over it with no version in it. */
  assert.equal(await restoreMod.carryOutRestore(restoreMod.cancelledRestore('r1'), macBench(null).api, { handled: new Set() }), null)

  const req = { id: 'r1', mode: 'put', versionId: 'v1', slot: 12, at: 1000 }
  const stale = macBench(req)
  const out = await restoreMod.carryOutRestore(req, stale.api, { handled: new Set(), now: () => 1000 + restoreMod.RESTORE_FRESH_MS })
  assert.deepEqual([out.ok, out.error], [false, restoreMod.RESTORE_STALE])
  assert.ok(!stale.calls.some((c) => /^(bytes|snapshot|load|store)/.test(c)))

  /* Called off after the Mac first saw it: asked once more, before writing. */
  const late = macBench(restoreMod.cancelledRestore('r1'))
  const off = await restoreMod.carryOutRestore(req, late.api, { handled: new Set(), now: () => 2000 })
  assert.equal(off.cancelled, true)
  assert.equal(late.told[0].error, restoreMod.RESTORE_CANCELLED)
  assert.ok(!late.calls.some((c) => /^(snapshot|load|store)/.test(c)), 'a cancelled Put back was written')

  const gone = macBench(req, { versions: [] })
  const refused = await restoreMod.carryOutRestore(req, gone.api, { handled: new Set(), now: () => 2000 })
  assert.equal(refused.ok, false)
  assert.equal(gone.told[0].error, restoreMod.RESTORE_GONE, 'the phone is left waiting on a request the computer refused')
})

test('the phone waits for a restore with the save’s rules and its own words', async () => {
  const b = waitBench()
  const w = restoreMod.startRestoreWait({ ...b.opts(), slug: 'fm3' })
  let said = null
  w.done.then((x) => (said = x))
  /* An old Mac window never answers. The phone says so, sooner than a save does. */
  await b.turn(restoreMod.RESTORE_WAIT_MS + 1000)
  assert.ok(restoreMod.RESTORE_WAIT_MS < saveWait.SAVE_WAIT_MS)
  assert.equal(said?.error, restoreMod.RESTORE_TIMED_OUT)
  assert.match(restoreMod.RESTORE_TIMED_OUT, /may need updating/)
  assert.deepEqual(b.written, [{ id: 'r1', cancelled: true }], 'a Mac woken later can still carry out what the phone gave up on')

  /* And the computer's own words for what it did come through. */
  const b2 = waitBench()
  const w2 = restoreMod.startRestoreWait({ ...b2.opts(), slug: 'fm3' })
  let said2 = null
  w2.done.then((x) => (said2 = x))
  b2.announce('fractal.saveResult.fm3', { id: 'r1', ok: true, slot: 1 })
  for (let i = 0; i < 20; i++) await null
  assert.equal(said2, null, 'a save’s answer ended a restore’s wait')
  b2.announce(restoreMod.restoreResultDoc('fm3'), { id: 'r1', ok: true, slot: 12, said: 'Put it back.' })
  for (let i = 0; i < 20; i++) await null
  assert.deepEqual(said2, { ok: true, slot: 12, said: 'Put it back.' })
  assert.ok(restoreMod.RESTORE_FRESH_MS >= restoreMod.RESTORE_WAIT_MS + restoreMod.RESTORE_WORKING_MS)
})

test('a restore travels the store, and the relay still refuses /version itself', () => {
  assert.equal(forbiddenRemotely('PUT', `/store/config/${restoreMod.pendingRestoreDoc('fm3')}`), null)
  assert.equal(forbiddenRemotely('GET', `/store/config/${restoreMod.restoreResultDoc('fm3')}`), null)
  assert.equal(forbiddenRemotely('GET', `/store/config/${restoreMod.restoreProgressDoc('fm3')}`), null)
  assert.ok(forbiddenRemotely('POST', '/version/v1/restore'), 'the relay was opened to /version')
  assert.ok(forbiddenRemotely('POST', '/version/v1/load'))
  assert.notEqual(restoreMod.pendingRestoreDoc('fm3'), saveWait.pendingSaveDoc('fm3'))

  const panel = readSrc(new URL('../src/components/Versions.jsx', import.meta.url), 'utf8')
  const versions = panel.slice(0, panel.indexOf('export function DeviceBackup'))
  assert.ok(!/restoreVersion|loadVersion/.test(versions), 'the panel reaches the unit itself again, which fails from a phone')
  assert.ok(!/One is taken before a slot is overwritten/.test(versions), 'the panel promises a copy nothing takes')
  assert.match(versions, /const play = \(version\) => \(dirty \? setConfirming\(\{ id: version\.id, mode: 'play' \}\) : run\(version, 'play'\)\)/, 'Play it drops unsaved changes without a word')
  assert.match(versions, /Your unsaved changes to the sound you’re on will be lost/)
  assert.match(versions, /so you can put it back\.\{lost\}/, 'Put back writes over unsaved edits without a word')
  assert.match(versions, /formatWhen\(version\.at \?\? version\.capturedAt\)/, 'snapshots from the computer show Invalid Date')
  /* The phone cannot back up every slot — the relay refuses it — so the hint does not send it to the button that says no. */
  assert.match(versions, /export function Versions\(\{[^}]*\bremote\b/)
  const hint = versions.slice(versions.indexOf('{remote'), versions.indexOf('</p>', versions.indexOf('{remote')))
  assert.match(hint, /^\{remote\s*\?\s*'No snapshots yet\. Back up all slots at the computer/, 'the phone is sent to a backup it cannot do')

  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const ask = app.slice(app.indexOf('const restoreFromVersion'), app.indexOf('const cancelQueuedRestore'))
  assert.match(ask, /if \(!remoteActive\(\)\) \{[\s\S]*?await restoreNow\(/, 'at the Mac, Put back skips the copy')
  assert.match(ask, /if \(!\(await parkRestore\(req\)\)\) throw new Error\(RESTORE_UNREACHED\)/, 'a request that never reached the computer is waited on')
  assert.ok(ask.indexOf('parkRestore(req)') < ask.indexOf('startRestoreWait('))
  const mac = app.slice(app.indexOf('const handledRestores'), app.indexOf('}, [status, remote, restoreApi])'))
  assert.match(mac, /if \(status !== 'live' \|\| remote \|\| isDemo\(\)\) return/)
  assert.match(mac, /onConfigDoc\(\(id\) => \{\s*if \(id === pendingRestoreKey\(\)\) look\(\)/, 'the Mac only finds a restore on its next look')
  assert.match(mac, /const timer = setInterval\(look, 6000\)/)
  assert.match(mac, /await carryOutRestore\(req, api, \{ handled: handledRestores\.current \}\)/)
  assert.match(app, /onRestore=\{restoreFromVersion\}/)
  assert.match(app, /waiting=\{queuedRestore\}/)
  assert.match(app, /<Versions[^>]*\bremote=\{remote\}/, 'the panel cannot tell it is on a phone')

  /* The copy before a Put back, at the route the computer serves, and handed to restoreNow. */
  const fx = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')
  assert.match(fx, /export const snapshotSlot = \(n\) =>[\s\S]{0,160}request\(`\/backup\/preset\/\$\{n\}`, \{ method: 'POST'/, 'a Put back asks the computer for its copy at a route it does not serve')
  const handed = app.slice(app.indexOf('const restoreApi'), app.indexOf('const [queuedRestore'))
  assert.match(handed, /\bsnapshotSlot,/, 'a Put back is handed nothing to keep a copy with, so every one is refused')
  assert.match(handed, /slotName: \(n\) => storedSlotName\(n\)\.then\(\(r\) => r\?\.name\)/, 'a 422 can never be shown to be an empty slot')
  assert.match(fx, /\/\^\\\/backup\\\/preset\\\/\\d\+\$\/\.test\(path\) && err\?\.status === 422/)

  /*
   * The wrappers App calls, not only the names they are built from. The block
   * is a copy of the save's, and a restore left in the save's document is
   * carried out as a save: whatever is loaded goes over the slot, no copy kept,
   * and the phone is told nothing was changed.
   */
  const wires = fx.slice(fx.indexOf('export const pendingRestoreKey'), fx.indexOf('\n', fx.indexOf('export const readRestoreProgress')))
  assert.match(fx, /export const pendingRestoreKey = \(\) => pendingRestoreDoc\(unitSlug\)/)
  assert.match(fx, /export const restoreResultKey = \(\) => restoreResultDoc\(unitSlug\)/)
  assert.match(fx, /export const restoreProgressKey = \(\) => restoreProgressDoc\(unitSlug\)/)
  assert.match(fx, /export const parkRestore = \(request\) => writeHostDoc\(pendingRestoreKey\(\)/, 'a restore is left where the Mac looks for a save')
  assert.match(fx, /export const takeParkedRestore = \(\) => readHostDoc\(pendingRestoreKey\(\)\)/)
  assert.match(fx, /export const clearParkedRestore = \(\) => deleteHostDoc\(pendingRestoreKey\(\)\)/)
  assert.match(fx, /export const cancelParkedRestore = \(id\) => parkRestore\(cancelledRestore\(id\)\)/, 'a cancel from a phone is a DELETE, which never arrives')
  assert.match(fx, /export const reportRestore = \(result\) => writeHostDoc\(restoreResultKey\(\)/)
  assert.match(fx, /export const readRestoreResult = \(\) => readHostDoc\(restoreResultKey\(\)\)/)
  assert.match(fx, /export const reportRestorePicked = \(id\) => writeHostDoc\(restoreProgressKey\(\)/)
  assert.match(fx, /export const readRestoreProgress = \(\) => readHostDoc\(restoreProgressKey\(\)\)/)
  assert.ok(!/pendingSave|saveResult|saveProgress|Save\(/.test(wires), 'a restore wrapper reads or writes a save’s document')
})

test('"✓ Saved" goes after its ten seconds even when the timer fires early', async () => {
  /*
   * "'✓ Saved' never goes away." The one real way: a browser may fire a timer
   * a hair early, the word was still due, it was drawn again — and nothing set
   * another timer, because nothing the bar watches had changed.
   */
  const { SAVED_FOR_MS, saidSaved, whenSavedGoes } = await import('../src/lib/savedFor.js')
  assert.equal(SAVED_FOR_MS, 10000)
  let t = 100000
  const timers = []
  const setTimer = (fn, ms) => (timers.push({ fn, ms }), timers.length)
  const savedAt = t
  let gone = 0
  whenSavedGoes(savedAt, () => gone++, { now: () => t, setTimer, clearTimer: () => {} })
  assert.equal(timers.length, 1)
  assert.equal(timers[0].ms, SAVED_FOR_MS)
  /* It fires 3 ms early. */
  t += SAVED_FOR_MS - 3
  timers[0].fn()
  assert.equal(gone, 0, 'the word went before its time')
  assert.ok(saidSaved(savedAt, t), 'the word is not still due at that moment')
  assert.equal(timers.length, 2, 'a timer that fired early set no other — "✓ Saved" stays for ever')
  assert.equal(timers[1].ms, 3)
  t += 3
  timers[1].fn()
  assert.equal(gone, 1)
  assert.ok(!saidSaved(savedAt, t))
  /* A bar that goes away first cancels it. */
  const cancel = whenSavedGoes(t, () => gone++, { now: () => t, setTimer, clearTimer: () => {} })
  cancel()
  t += SAVED_FOR_MS
  timers[timers.length - 1].fn()
  assert.equal(gone, 1, 'a cancelled timer still fired')
})

test('a slot nobody has read is not an empty slot, and a different name takes a second tap', async () => {
  /*
   * "Save has no overwrite guard." Worse than reported: every slot counted as
   * holding something whether or not its name had been read, so an unread one
   * was "an empty slot" — over the relay, most of them — and saving over the
   * loaded slot under a new name said nothing. Both wrote on the first tap.
   */
  const { overwriteCheck, overwriteAsk } = await import('../src/lib/overwrite.js')
  /* "The app couldn't draw — null is not an object (evaluating
     'z.current.name')": with no preset loaded both numbers were undefined, so
     the name was read off a null ref and the whole web app went down. */
  assert.match(readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8'), /loadedAs\.current && Number\.isInteger\(preset\?\.number\) && loadedAs\.current\.number === preset\.number/, 'the Save check reads a name off a preset that was never loaded')
  assert.doesNotMatch(readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8'), /loadedAs\.current\?\.number === preset\?\.number \? loadedAs\.current\.name/, 'the crash on a web app with no preset loaded is back')
  const at = (holds, over = {}) => overwriteCheck({ target: 40, loaded: 12, loadedName: 'SONG 12', holds, saveAs: 'My Lead', ...over })
  assert.equal(at(null).need, 'checking', 'a slot still being asked about saves on one tap')
  assert.equal(at({ number: 39, name: '', known: true }).need, 'checking', 'the answer about another slot was taken for this one')
  assert.equal(at({ number: 40, name: '', known: false }).need, 'unknown', 'a slot that could not be read is taken for empty')
  assert.equal(at({ number: 40, name: '', known: true }).need, 'none', 'an empty slot asks twice')
  assert.deepEqual(at({ number: 40, name: 'Tool Rhythm', known: true }), { need: 'confirm', name: 'Tool Rhythm' })
  assert.equal(at({ number: 40, name: 'my lead', known: true }).need, 'none', 'the same preset saved again asks twice')
  /* The loaded slot holds what it was loaded as, whatever the buffer is called now. */
  assert.deepEqual(at(null, { target: 12, saveAs: 'Renamed' }), { need: 'confirm', name: 'SONG 12' }, 'a rename writes over the loaded preset on one tap')
  assert.equal(at(null, { target: 12, saveAs: 'SONG 12' }).need, 'none', 'saving the loaded preset over itself asks twice')
  assert.equal(at({ number: 12, name: '', known: false }, { target: 12, loadedName: null, saveAs: 'SONG 12' }).need, 'unknown')
  assert.equal(overwriteAsk({ need: 'confirm', name: 'Tool Rhythm' }, 40), 'Overwrite “Tool Rhythm”?')
  assert.equal(overwriteAsk({ need: 'unknown', name: '' }, 40), 'Overwrite slot 40?')

  /* And the sheet uses it: the button asks before it writes. */
  const sheet = readSrc(new URL('../src/components/SaveSheet.jsx', import.meta.url), 'utf8')
  const foot = sheet.slice(sheet.indexOf('export function SaveFooter'), sheet.indexOf('export default function SaveSheet'))
  assert.match(foot, /if \(guard\.need !== 'none' && !armed\) \{\s*setArmed\(true\)\s*return/, 'the footer writes on the first tap')
  assert.match(foot, /onClick=\{press\}/)
  assert.match(foot, /armed \? overwriteAsk\(guard, targetLabel\)/, 'the second tap does not name what goes')
  assert.ok(!/occupant \? 'an empty slot'/.test(sheet), 'a slot that exists is still called empty because it exists')
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /lookUpName\(saveTarget\)/, 'the slot is never looked up')
  assert.match(app, /loadedName:\s*loadedAs\.current && Number\.isInteger\(preset\?\.number\) && loadedAs\.current\.number === preset\.number\s*\? loadedAs\.current\.name\s*: null/)
  /* And it is written: at the load, and at each of the three saves. Without
     these loadedName is always null and the loaded-slot rule never runs. */
  assert.match(app, /const noteLoadedAs = \(p\) => \{\s*if \(Number\.isInteger\(p\?\.number\) && typeof p\?\.name === 'string'\) loadedAs\.current = \{ number: p\.number, name: p\.name\.trim\(\) \}/, 'the loaded slot’s name is never kept')
  assert.match(app, /if \(!dirtyRef\.current\) noteLoadedName\(p\)\s*if \(!dirtyRef\.current\) noteLoadedAs\(p\)/, 'a read no longer keeps the loaded slot’s name')
  assert.match(app, /if \(fresh \|\| !dirtyRef\.current\) \{\s*noteLoadedName\(p\)\s*noteLoadedAs\(p\)/, 'a preset loaded from the list no longer keeps its name')
  assert.match(app, /loadedAs\.current = \{ number: req\.slot, name: [^\n]*\}\s*presetSaved\(req\.slot/, 'a save the phone asked for leaves the old name')
  assert.match(app, /loadedAs\.current = \{ number: res\.slot, name: [^\n]*\}\s*presetSaved\(res\.slot/, 'a save from away leaves the old name')
  assert.match(app, /loadedAs\.current = \{ number, name: [^\n]*\}\s*presetSaved\(number, /, 'a save at the computer leaves the old name')
  assert.match(app, /<SaveFooter[\s\S]*?check=\{saveCheck\}/, 'the footer is not told what the slot holds')
  /* "Couldn't read it" is kept apart from empty where names are looked up. */
  const fx = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')
  const look = fx.slice(fx.indexOf('export async function lookUpName'))
  assert.match(look.slice(0, 600), /return \{ name: known \? name : '', known \}/)
})

onTheBench('the computer announcing a document is not news about the unit, and reaches whoever listens for it', async () => {
  const { clock, wire } = windowOnTheBench()
  const heard = []
  const off = ds.onConfigDoc((id, data) => heard.push([id, data]))
  ds.handleEvent({ type: 'config', id: 'fractal.pendingSave.fm3', data: { id: 'p1', slot: 4 }, origin: 'fractal' })
  await clock.advance(3000)
  off()
  ds.handleEvent({ type: 'config', id: 'fractal.pendingSave.fm3', data: { id: 'p2' } })
  /* Matched on the document, not on who wrote it: origin is not looked at. */
  assert.deepEqual(heard, [['fractal.pendingSave.fm3', { id: 'p1', slot: 4 }]])
  assert.deepEqual(wire, [], 'a store write made the Mac window read the unit')
})

onTheBench('after a save the number and the name go up at once, and the chain is not read again', async () => {
  /*
   * The lock after a save was a whole read of the unit to learn two things the
   * save had just settled. The chain on screen is the chain that was saved; it
   * belongs to the new slot now, so a screen opened next must not take it for
   * another preset's and read it.
   */
  const { clock, unit, asked } = windowOnTheBench()
  unit.number = 40
  unit.presetName = 'My Lead'
  const done = ds.presetSaved(40, 'My Lead')
  assert.equal(ds.getSnapshot().preset.number, 40, 'the slot saved to is not what the screen says')
  assert.equal(ds.getSnapshot().preset.name, 'My Lead')
  assert.ok(ds.chainIsCurrent(), 'the chain that was saved is taken for another preset’s')
  await clock.advance(ds.SETTLING_MS * ds.SETTLING_TRIES + 1000)
  await done
  assert.equal(asked(CHAIN), 0, 'a save dumped the preset again')
  assert.equal(asked(SUMMARY), 0)
  assert.equal(asked(WHICH), 1, 'the quiet check did not ask which preset, or asked more than once')
  assert.equal(ds.getSnapshot().blocks.length, 2)
})

onTheBench('a unit still writing to flash is asked again, quietly, and a preset changed meanwhile wins', async () => {
  const { clock, unit, asked } = windowOnTheBench()
  let busy = 2
  unit.which = () => {
    if (busy-- > 0) throw new Error('no answer')
    return { number: 40, name: 'My Lead' }
  }
  const done = ds.presetSaved(40, 'My Lead')
  await clock.advance(ds.SETTLING_MS * ds.SETTLING_TRIES + 1000)
  await done
  assert.equal(asked(WHICH), 3)
  assert.equal(ds.getSnapshot().preset.number, 40)
})

/*
 * WHOSE CHAIN IS ON SCREEN. On the play test the new preset's name went up at
 * once and the last preset's blocks stayed under it, live: a double-tap on an
 * old tile switched a block on the new preset, found by its number. The chain
 * is still read once, a moment after the switch — that is the sound-dropout
 * fix — so what changes is only what the screens are told about the wait.
 */
const chainOnScreen = () => ds.chainViewOf(ds.getSnapshot())

onTheBench('a preset chosen in the Mac window is not drawn with the last song’s chain, and its tiles cannot switch it', async () => {
  const { clock, asked } = windowOnTheBench()
  assert.equal(chainOnScreen(), 'ready')
  const load = ds.loadPreset(503)
  /* From the tap, before the unit has answered anything. */
  assert.equal(chainOnScreen(), 'loading', 'the last song’s chain is drawn while the select is in the air')
  assert.equal(ds.chainNumberOf(ds.getSnapshot()), 503, 'the wait is not for the preset asked for')
  /* The second half of a double-tap on a tile drawn before the switch. */
  await assert.rejects(() => ds.writeBypass(133, false), (err) => err.notThisChain === true, 'a tile drawn for the last preset switched a block on this one')
  assert.equal(asked('POST /preset/blocks/133/bypass'), 0, 'the refused tap still reached the unit')
  assert.equal(ds.getSnapshot().blocks.find((b) => b.effectId === 133).bypassed, true, 'the refused tap still moved a tile')
  await clock.advance(10)
  assert.equal(ds.getSnapshot().preset.number, 503)
  assert.equal(chainOnScreen(), 'loading', 'the name went up and the old chain was taken for this one')
  await clock.advance(ds.OWN_SETTLE_MS + 100)
  await load
  assert.equal(chainOnScreen(), 'ready')
  assert.equal(ds.getSnapshot().chainFor, 503)
  assert.equal(ds.getSnapshot().chainGoing, null)
  /* And it cost what it cost before: one chain read, a moment later. */
  assert.equal(asked(CHAIN), 1, `the wait cost ${asked(CHAIN)} chain reads`)
  await ds.writeBypass(133, false)
  assert.equal(asked('POST /preset/blocks/133/bypass'), 1, 'this preset’s own chain cannot be switched once it is read')
})

/*
 * "Is there any way to pull like the label in the pedal outline or something
 * real fast first before it actually pulls the rest of the info from the
 * device." The Mac window's half of the phone's pedals-first: the status read
 * a moment after the select, and the one chain read after it, unchanged.
 */
const SONG_30 = [
  { slug: 'input', name: 'Input 1', effectId: 37, bypassed: false, channel: null },
  { slug: 'reverb', name: 'Reverb 1', effectId: 66, bypassed: true, channel: 'B' },
  { slug: 'amp', name: 'Amp 1', effectId: 58, bypassed: false, channel: 'C' },
  { slug: 'drive', name: 'Drive 1', effectId: 118, bypassed: false, channel: 'A' },
  { slug: 'output', name: 'Output 1', effectId: 42, bypassed: false, channel: null }
]
const songs = (unit) => {
  const chains = { 12: unit.blocks, 30: SONG_30, 31: SONG_30 }
  Object.defineProperty(unit, 'blocks', { configurable: true, get: () => chains[unit.number] || [], set: (v) => (chains[unit.number] = v) })
  return chains
}

onTheBench('a preset never loaded in the Mac window shows its pedals before the chain read answers, and costs one chain read', async () => {
  const { clock, unit, asked } = windowOnTheBench()
  songs(unit)
  unit.lag = (line) => (line === CHAIN ? 1500 : 0)
  const load = ds.loadPreset(30)
  assert.equal(chainOnScreen(), 'loading')
  await clock.advance(ds.OUTLINE_AFTER_MS - 50)
  assert.equal(asked(STATE), 0, 'the pedals were listed before the unit had a moment to take the select')
  await clock.advance(100)
  assert.equal(asked(STATE), 1)
  assert.equal(asked(CHAIN), 0)
  assert.equal(chainOnScreen(), 'outline', 'the pedals the unit listed are not on screen')
  assert.deepEqual(ds.getSnapshot().blocks.map((b) => b.slug), ['input', 'drive', 'amp', 'reverb', 'output'])
  /* Play plays them; an editor waits for the chain. */
  assert.equal(ds.chainKnownOf(ds.getSnapshot()), true, 'an editor would open on the outline')
  await clock.advance(ds.OWN_SETTLE_MS + 3000)
  await load
  assert.equal(chainOnScreen(), 'ready')
  assert.equal(ds.getSnapshot().chainOutline, null)
  assert.deepEqual(ds.getSnapshot().blocks.map((b) => b.slug), ['input', 'reverb', 'amp', 'drive', 'output'], 'the chain read did not replace the outline')
  await clock.advance(30000)
  assert.equal(asked(CHAIN), 1, `a preset change with its pedals up first cost ${asked(CHAIN)} chain reads`)
  assert.equal(asked(STATE), 1)
  assert.equal(asked(SUMMARY), 0)
  /* Back to 12 and to 30 again: the remembered chain, and no status read for it. */
  ds.loadPreset(12)
  await clock.advance(3000)
  const listed = asked(STATE)
  ds.loadPreset(30)
  assert.equal(chainOnScreen(), 'ready', 'a remembered chain waited behind the pedals')
  await clock.advance(3000)
  assert.equal(asked(STATE), listed, 'a preset whose chain is remembered was listed again')

  /* A tap on one of those pedals goes by its effect id; one from the last song's tile does not. */
  unit.lag = (line) => (line === CHAIN ? 1500 : 0)
  ds.loadPreset(31)
  await clock.advance(ds.OUTLINE_AFTER_MS + 50)
  assert.equal(chainOnScreen(), 'outline')
  await ds.writeBypass(66, false)
  assert.equal(asked('POST /preset/blocks/66/bypass'), 1, 'a tap on a pedal drawn ahead of the chain did not reach the unit by its id')
  assert.equal(ds.getSnapshot().blocks.find((b) => b.effectId === 66).bypassed, false)
  await assert.rejects(() => ds.writeBypass(133, false), (err) => err.notThisChain === true, 'a tap from the last song’s tile switched a block on this one')
  assert.equal(asked('POST /preset/blocks/133/bypass'), 0)
  await clock.advance(5000)
  assert.equal(chainOnScreen(), 'ready')
})

onTheBench('in the Mac window a status read with nothing to draw keeps the cards, and an AM4 is never asked', async () => {
  /* Empty, failed, an AM4 — and slow, answering only after the chain read, which it must not be drawn over. */
  for (const over of [{ status: () => [] }, { status: () => { throw new Error('timed out') } }, { keepsCopy: false }, { lag: (line) => (line === STATE ? 3000 : 0) }]) {
    const { clock, unit, asked } = windowOnTheBench(over)
    songs(unit)
    const seen = []
    const off = ds.subscribe(() => seen.push(chainOnScreen()))
    const load = ds.loadPreset(30)
    await clock.advance(ds.OUTLINE_AFTER_MS + 50)
    assert.equal(chainOnScreen(), 'loading', 'a status read with nothing to draw put something up')
    await clock.advance(ds.OWN_SETTLE_MS + 3000)
    await load
    off()
    assert.ok(!seen.includes('outline'))
    assert.equal(chainOnScreen(), 'ready')
    assert.equal(asked(CHAIN), 1)
    assert.equal(asked(STATE), over.keepsCopy === false ? 0 : 1)
    ds.reset()
  }
})

onTheBench('the Mac window’s Play offers no channel hold on pedals drawn ahead of the chain', () => {
  const gig = readSrc(new URL('../src/components/Gig.jsx', import.meta.url), 'utf8')
  assert.match(gig, /const has = \(channels\?\.length \|\| 0\) > 1 && !outline/, 'a pedal drawn ahead of the chain offers its channels')
  assert.match(gig, /outline=\{shown\.outline\}/)
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /blocks=\{chainNow\.outline \? \[\] : blocks\}/, 'the Scenes sheet switches channels on the outline')
})

onTheBench('a new preset whose chain could not be read says so, and Try again reads it', async () => {
  /* No pedals ahead of the chain here: this is about the chain read itself. */
  const { clock, unit, asked } = windowOnTheBench({ outlines: false })
  unit.chain = () => {
    throw new Error('PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78')
  }
  const load = ds.loadPreset(7)
  await clock.advance(ds.OWN_SETTLE_MS + 100)
  /* Between the asks a failed chain read makes, it is still on its way. */
  assert.equal(chainOnScreen(), 'loading', 'the chain said it could not be read before it had finished asking')
  await clock.advance(ds.SETTLE_MS * ds.SETTLE_TRIES + 1000)
  await load
  assert.equal(chainOnScreen(), 'failed', 'a chain that never came is drawn as this preset’s, or waited on for ever')
  await assert.rejects(() => ds.writeBypass(58, true), (err) => err.notThisChain === true)
  unit.chain = null
  const reads = asked(CHAIN)
  const again = ds.retryChain()
  assert.equal(chainOnScreen(), 'loading', 'Try again says nothing while it reads')
  await clock.advance(10)
  assert.ok(Array.isArray(await again))
  assert.equal(asked(CHAIN), reads + 1, 'Try again is not one read of the chain')
  assert.equal(chainOnScreen(), 'ready')
})

onTheBench('the same preset read again keeps its chain on screen, marked as updating', async () => {
  const { clock, unit } = windowOnTheBench()
  /* App's own read after an Add or a Remove. */
  const done = ds.beginChainRead()
  assert.equal(chainOnScreen(), 'updating', 'a re-read of this preset’s chain hides it, or does not say so')
  done()
  done()
  assert.equal(chainOnScreen(), 'ready', 'a read marked over twice, or never unmarked')
  /* A Revert: the same slot loaded again is not another song. */
  const load = ds.loadPreset(12)
  assert.equal(chainOnScreen(), 'updating', 'Revert took this preset’s chain for another one’s')
  await clock.advance(ds.OWN_SETTLE_MS + 500)
  await load
  assert.equal(chainOnScreen(), 'ready')
  /* A save to another slot moves the chain with the number, in one change. */
  unit.number = 40
  unit.presetName = 'My Lead'
  const seen = []
  const off = ds.subscribe(() => seen.push(chainOnScreen()))
  const saved = ds.presetSaved(40, 'My Lead')
  assert.deepEqual(seen, ['ready'], 'a save made the chain on screen another preset’s, even for a moment')
  off()
  await clock.advance(ds.SETTLING_MS * ds.SETTLING_TRIES + 1000)
  await saved
  assert.equal(ds.getSnapshot().chainFor, 40)
})

onTheBench('a chain that turns out to be the computer’s copy of the last song is not drawn under this one', async () => {
  /* No pedals ahead of the chain here: this is about the chain read itself. */
  const { clock, unit, nameOf } = windowOnTheBench({ outlines: false })
  /* The computer answers out of its copy of the preset just left. */
  unit.copy = () => ({ name: nameOf(12), scenes: ['VERSE', '', '', '', '', '', '', ''] })
  const load = ds.loadPreset(30)
  await clock.advance(ds.OWN_SETTLE_MS + 500)
  await load
  assert.equal(chainOnScreen(), 'loading', 'the last song’s chain, read out of the computer’s copy, is drawn as this one’s')
  unit.copy = null
  await clock.advance(ds.CHAIN_FRESH_MS + 1000)
  assert.equal(chainOnScreen(), 'ready')
  assert.equal(ds.getSnapshot().chainFor, 30)
})

onTheBench('the last song’s chain out of the computer’s copy is never drawn live under this one, not even while the copy is asked', async () => {
  /* No pedals ahead of the chain here: this is about the chain read itself. */
  const { clock, unit, nameOf, asked } = windowOnTheBench({ outlines: false })
  /* The copy answers when the test says, so the moment between the chain
     landing and the copy being judged can be looked at. */
  let answerCopy
  const copyAsked = new Promise((go) => (answerCopy = go))
  unit.copy = () => copyAsked.then(() => ({ name: nameOf(12), scenes: ['VERSE', '', '', '', '', '', '', ''] }))
  const seen = []
  const off = ds.subscribe(() => seen.push(`${chainOnScreen()}/${ds.getSnapshot().chainFor}`))
  const load = ds.loadPreset(30)
  await clock.advance(ds.OWN_SETTLE_MS + 500)
  assert.equal(asked(CHAIN), 1)
  assert.equal(asked('GET /preset/grid'), 1, 'the copy was never asked, so this is not the moment in question')
  assert.equal(chainOnScreen(), 'loading', 'the last song’s tiles are up, live, while the copy is asked')
  await assert.rejects(() => ds.writeBypass(133, false), (err) => err.notThisChain === true, 'a tap on the last song’s tile switched this song’s block')
  assert.equal(asked('POST /preset/blocks/133/bypass'), 0)
  answerCopy()
  await clock.advance(10)
  await load
  assert.equal(chainOnScreen(), 'loading')
  const before = seen.length
  unit.copy = null
  await clock.advance(ds.CHAIN_FRESH_MS + 1000)
  off()
  const early = seen.slice(0, before).filter((v) => /^(ready|updating)\//.test(v))
  assert.deepEqual(early, [], `the last song’s chain was drawn as this one’s on the way: ${seen.slice(0, before)}`)
  assert.equal(chainOnScreen(), 'ready')
  assert.equal(ds.getSnapshot().chainFor, 30)
})

onTheBench('a copy that still carries another name after the wait is this preset’s, renamed, and its chain goes up', async () => {
  /* No pedals ahead of the chain here: this is about the chain read itself. */
  const { clock, unit, nameOf, asked } = windowOnTheBench({ outlines: false })
  unit.copy = () => ({ name: nameOf(12), scenes: ['VERSE', '', '', '', '', '', '', ''] })
  const load = ds.loadPreset(30)
  await clock.advance(ds.OWN_SETTLE_MS + 500)
  await load
  assert.equal(chainOnScreen(), 'loading')
  await clock.advance(ds.CHAIN_FRESH_MS + 1000)
  assert.equal(asked(CHAIN), 2)
  assert.equal(chainOnScreen(), 'ready', 'a second mismatch left the chain waiting for ever')
  assert.equal(ds.getSnapshot().chainFor, 30)
})

onTheBench('a preset renamed keeps its chain up and live while the computer’s copy still has the old name', async () => {
  const { clock, unit, nameOf, asked } = windowOnTheBench()
  /* What App's rename() does: the unit has the new name, the computer's copy
     of the chain the old one, for up to a quarter of a minute. */
  unit.presetName = 'NEW NAME'
  unit.copy = () => ({ name: nameOf(12), scenes: ['VERSE', 'CHORUS', '', '', '', '', '', ''] })
  ds.put({ preset: { number: 12, name: 'NEW NAME' } })
  ds.chainWasRead(12)
  await ds.refreshLoadedSceneNames(12)
  assert.equal(chainOnScreen(), 'ready', 'a rename greyed this preset’s own chain')
  /* Longer than a re-read goes unmentioned: still nothing on its way. */
  await clock.advance(1000)
  assert.equal(chainOnScreen(), 'ready', 'a rename said “Updating…” for a quarter of a minute')
  await ds.writeBypass(133, false)
  assert.equal(asked('POST /preset/blocks/133/bypass'), 1, 'a tap after a rename was refused')
  const reads = asked(CHAIN)
  await clock.advance(ds.CHAIN_FRESH_MS + 250 + 100)
  assert.equal(asked(CHAIN), reads + 1, `the copy with the old name cost ${asked(CHAIN) - reads} more reads`)
  await clock.advance(30000)
  assert.equal(asked(CHAIN), reads + 1)
  assert.equal(chainOnScreen(), 'ready')
})

onTheBench('a Try again that has to ask twice does not say it failed between the asks', async () => {
  /* No long copy, so nothing but the read itself holds the chain on its way. */
  const { clock, unit } = windowOnTheBench({ keepsCopy: false })
  unit.chain = () => {
    throw new Error('PRESET_DUMP_HEADER: expected func 0x77 at offset 0, got 0x78')
  }
  const load = ds.loadPreset(7)
  await clock.advance(ds.OWN_SETTLE_MS + ds.SETTLE_MS * ds.SETTLE_TRIES + 2000)
  await load
  assert.equal(chainOnScreen(), 'failed')
  const again = ds.retryChain()
  await clock.advance(10)
  assert.equal(chainOnScreen(), 'loading', 'Try again said it failed between its asks')
  unit.chain = null
  await clock.advance(ds.SETTLE_MS * ds.SETTLE_TRIES + 1000)
  assert.ok(Array.isArray(await again))
  assert.equal(chainOnScreen(), 'ready')
})

onTheBench('a chain read from before a reset neither holds the chain busy nor ends a later one', async () => {
  windowOnTheBench()
  const busy = () => ds.getSnapshot().chainBusy
  const d1 = ds.beginChainRead()
  ds.reset()
  const d2 = ds.beginChainRead()
  assert.equal(busy(), true)
  d2()
  assert.equal(busy(), false, 'a read from before the reset holds the chain busy for ever')
  const d3 = ds.beginChainRead()
  d1()
  assert.equal(busy(), true, 'a read from before the reset ended a later one')
  d3()
  assert.equal(busy(), false)
})

test('the pedals drawn ahead of the chain are named from the catalog, in signal order, and nothing is guessed', async () => {
  const { outlineChain } = await import('../shared/chain-outline.mjs')
  const view = await import('../shared/chain-view.mjs')
  const list = outlineChain(
    [
      { effectId: 42, bypassed: false, channel: null },
      { effectId: 66, bypassed: true, channel: 'B' },
      { effectId: 9999, bypassed: false, channel: 'A' },
      { effectId: 58, bypassed: false, channel: 'C' },
      { effectId: 58, bypassed: true, channel: 'D' },
      { effectId: 94, bypassed: false, channel: 'A' },
      { effectId: 37, bypassed: false, channel: null }
    ],
    BLOCK_CATALOG
  )
  assert.deepEqual(list.map((b) => b.slug), ['input', 'wah', 'amp', 'reverb', 'output'], 'not in the order a chain runs, or an unknown id was guessed at')
  assert.deepEqual(list.find((b) => b.slug === 'amp'), { slug: 'amp', name: 'Amp', effectId: 58, bypassed: false, channel: 'C' })
  assert.equal(outlineChain([], BLOCK_CATALOG), null)
  assert.equal(outlineChain(null, BLOCK_CATALOG), null)
  assert.equal(outlineChain([{ effectId: 9999 }], BLOCK_CATALOG), null)
  /* This preset's, drawn; a tap may switch one, nothing else may act. */
  assert.equal(view.chainView({ want: 30, chainFor: 30, busy: true, known: 30, outline: 30 }), 'outline')
  assert.equal(view.chainView({ want: 30, chainFor: 30, busy: true, known: null, outline: 30 }), 'updating', 'an outline outlived the chain it stood in for')
  assert.equal(view.chainSwitches('outline'), true)
  assert.equal(view.chainActs('outline'), false)
  assert.equal(view.chainElsewhere('outline'), false)
})

test('the words for a chain that is on its way are one set, and the stores draw them from the same rule', async () => {
  const view = await import('../shared/chain-view.mjs')
  const { chainView, chainActs, chainElsewhere, CHAIN_WORDS } = view
  assert.equal(chainView({ want: 503, chainFor: 12, busy: true }), 'loading')
  assert.equal(chainView({ want: 503, chainFor: 12, busy: false }), 'failed')
  assert.equal(chainView({ want: 503, chainFor: null, busy: false }), 'failed')
  assert.equal(chainView({ want: 12, chainFor: 12, busy: true }), 'updating')
  assert.equal(chainView({ want: 12, chainFor: 12, busy: false }), 'ready')
  /* A unit too busy to name its preset, or none known yet: nothing to hold them to. */
  assert.equal(chainView({ want: -1, chainFor: 12, busy: false }), 'ready')
  assert.equal(chainView({ want: undefined, chainFor: null, busy: false }), 'ready')
  assert.ok(chainActs('ready') && chainActs('updating') && !chainActs('loading') && !chainActs('failed'))
  assert.ok(chainElsewhere('loading') && chainElsewhere('failed') && !chainElsewhere('updating'))
  assert.equal(CHAIN_WORDS.loading(503), 'Loading preset 503’s chain…')
  assert.equal(CHAIN_WORDS.failed, 'Couldn’t read this preset’s chain')
  assert.equal(CHAIN_WORDS.retry, 'Try again')
  assert.equal(CHAIN_WORDS.updating, 'Updating…')
  /* Only after long enough to notice; before that the chain just stays. */
  assert.ok(view.UPDATING_AFTER_MS >= 250 && view.UPDATING_AFTER_MS <= 1000)
  assert.match(readSrc(new URL('../mobile/src/lib/chain-view.js', import.meta.url), 'utf8'), /Generated from shared\/chain-view\.mjs/, 'the phone keeps its own copy of the rule')
})

test('every browser panel that draws the chain draws another preset’s as a wait, not as tiles', () => {
  const src = (f) => readSrc(new URL(`../src/${f}`, import.meta.url), 'utf8')
  const con = src('components/Console.jsx')
  const chain = con.slice(con.indexOf('export function Chain('), con.indexOf('export function PresetList('))
  assert.match(chain, /const shown = useChain\(\)[\s\S]*?if \(shown\.elsewhere\) \{\s*return \(\s*<div className="fx-panel">\s*<ChainWait chain=\{shown\} \/>/, 'the chain strip draws the last song’s tiles under this song’s name')
  assert.ok(chain.indexOf('if (shown.elsewhere)') < chain.indexOf('chain.map((block)'), 'the tiles are drawn before the check')
  assert.match(chain, /lastTap\.current\.of === shown\.number/, 'a tap on the last song and one on this pair up as a double-tap')
  const grid = src('components/GridEditor.jsx')
  assert.match(grid, /if \(chainNow\.elsewhere\) \{\s*return \([\s\S]*?<ChainWait chain=\{chainNow\}/, 'the chain editor offers Remove on the last song’s blocks')
  const gig = src('components/Gig.jsx')
  assert.match(
    gig,
    /\{held \? \(\s*<div className="gig-blocks-held" ref=\{blocksRef\} style=\{\{ height: held\.height \}\}>\s*<ChainWait chain=\{shown\} cards=\{held\.count\}[\s\S]*?\) : shown\.elsewhere \? \(\s*<ChainWait chain=\{shown\}/,
    'Play says nothing about a chain on its way, or the wait does not hold the pedals’ space'
  )
  assert.match(gig, /\{!shown\.elsewhere && blocks\.length \? \(\s*<div className=\{`gig-blocks/, 'Play draws the last song’s tiles under this song’s name')
  assert.match(gig, /if \(err\?\.notThisChain\) return/, 'a refused tap on Play reads the unit back or says it failed')
  const app = src('App.jsx')
  assert.match(app, /const openBlock = selectedBlock && !chainNow\.elsewhere \?/, 'the last song’s block stays open over this one')
  assert.match(app, /doneReading = beginChainRead\(\)\s*const \[p, b\] = await Promise\.all\(\[currentPreset\(\), presetBlocks\(\)\]\)/, 'App’s own read of the chain is not marked while it is in the air')
  assert.match(app, /doneReading\?\.\(\)\s*setBusy\(false\)/, 'App’s read is marked for ever')
  /* Both places the chain sheet and Edit draw from are the one strip. */
  assert.equal((app.match(/<Chain\s/g) || []).length, 2)
  assert.match(gig, /<ChainWait chain=\{shown\} className="gig-chain-wait" onRetry=\{retryHere\} \/>/, 'a Try again that worked on Play still says it could not read the chain')
  assert.match(gig, /const retryHere = async \(\) => \{\s*const list = await retryChain\(\)\s*setChain\(Array\.isArray\(list\) \? 'ok' : 'failed'\)/)
  assert.match(gig, /const chanBlock = chanEid === null \|\| shown\.elsewhere(?: \|\| shown\.outline)? \? null :/, 'the last song’s channel sheet stays up, switching this song’s block by its number')
  assert.match(gig, /useEffect\(\(\) => \{\s*if \(shown\.elsewhere\) setChanEid\(null\)/, 'the channel sheet comes back by itself over the new song’s tiles')
  /* The strip above the editor says it; the editor only holds the space. */
  assert.match(grid, /<ChainWait chain=\{chainNow\}[^>]*\squiet\b/, 'the Edit screen says the chain is loading twice')
  assert.doesNotMatch(grid, /<ChainUpdating/, '“Updating…” shows twice on the Edit screen')
  const scenes = app.slice(app.indexOf('<SceneMatrix'), app.indexOf('/>', app.indexOf('<SceneMatrix')))
  assert.match(scenes, /key=\{chainNow\.number/, 'the scene map read for the last song switches this song’s blocks by number')
  assert.match(scenes, /busy=\{[^}]*chainNow\.elsewhere/, 'the scene map can be read or tapped while the chain is another preset’s')
  const wait = src('components/ChainWait.jsx')
  assert.match(wait, /quiet \? null : \(\s*<p className="hint chain-wait-words">/, 'a quiet wait still speaks')
  assert.match(wait, /from '\.\.\/\.\.\/shared\/chain-view\.mjs'/, 'the browser words its own wait')
  assert.match(wait, /setTimeout\(\(\) => setLate\(true\), UPDATING_AFTER_MS\)/, '“Updating…” flickers up on every Add')
})

test('the Mac hears a request the moment it is left, looks once at a time, and honours a cancel', () => {
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const watcher = app.slice(app.indexOf('const req = await takeParkedSave()'))
  const scope = watcher.slice(0, watcher.indexOf('}, [status, remote, preset?.number, carryOutSave])'))
  assert.match(scope, /onConfigDoc\(\(id\) => \{\s*if \(id === pendingSaveKey\(\)\) look\(\)/, 'the Mac window still waits for its next look')
  assert.match(scope, /const timer = setInterval\(look, 6000\)/, 'the timed look went, and a lost announcement is a lost save')
  assert.match(scope, /offAsk\(\)/, 'the announcement listener outlives the window')
  assert.match(scope, /if \(looking\) \{\s*again = true\s*return/, 'two looks at one request can both carry it out')
  assert.match(scope, /Date\.now\(\) - \(req\.at \|\| 0\) < SAVE_FRESH_MS/, 'a request nobody is waiting for any more can still be written')
  assert.ok(saveWait.SAVE_FRESH_MS >= saveWait.SAVE_WAIT_MS + saveWait.SAVE_WORKING_MS, 'the computer drops a request somebody is still waiting on')
  assert.ok(saveWait.SAVE_FRESH_MS <= 5 * 60 * 1000, 'a save can land long after the phone said nothing was saved')
  const carry = app.slice(app.indexOf('const carryOutSave'), app.indexOf('At the Mac: anything the phone has asked for'))
  assert.ok(carry.indexOf('await reportSavePicked(req.id)') > -1, 'the phone is never told the computer has it')
  assert.ok(carry.indexOf('await reportSavePicked(req.id)') < carry.indexOf('await storePreset(req.slot)'))
  assert.match(carry, /const still = await takeParkedSave\(\)\s*if \(still && \(still\.id !== req\.id \|\| still\.cancelled\)\)/, 'a cancelled request is still written')
  /* And says it passed it over: the phone saw "picked up" and is waiting. */
  const skip = carry.slice(carry.indexOf('const still = await takeParkedSave()'), carry.indexOf('await storePreset(req.slot)'))
  assert.match(skip, /await reportSave\(\{ id: req\.id, ok: false, cancelled: true[^\n]*\}\)[^\n]*\s*return/, 'a phone whose cancel was obeyed is left waiting')
  assert.ok(carry.indexOf('const still = await takeParkedSave()') < carry.indexOf('await storePreset(req.slot)'))
  /* The browser on a phone waits with the phone app's rule, and can stop. */
  assert.match(app, /const wait = startSaveWait\(\{/)
  assert.match(app, /cancelRequest: async \(\) => \{\s*if \(!\(await cancelParkedSave\(queuedSave\.id\)\)\) throw/, 'a cancel that never landed says nothing was saved')
  assert.match(app, /listen: onConfigDoc/)
  /* Late, either way, is said — "it just kept saying saving the whole time": a
     computer that has it and is slow says so, with Cancel, and so does one
     that has not answered. */
  assert.match(app, /onState: \(\{ late, picked \}\) => live && setSaveLate\(late \? \(picked \? 'working' : 'waiting'\) : false\)/, 'a late save the computer has picked up says nothing again')
  assert.match(app, /const parked = await parkSave\([\s\S]{0,300}?if \(!parked\) throw/, 'a request that never reached the computer is waited on for two minutes')
  assert.match(app, /setSaveError\(said\.error\)\s*setError\(said\.error\)/, 'a save that failed from away says so only inside a closed sheet')
  assert.match(app, /\{queuedSave && saveLate \? \(\s*<SaveLate onCancel=\{cancelQueuedSave\} words=\{saveLate === 'working' \? SAVE_WORKING_WORDS : undefined\} \/>/, 'a late save has nothing to say and nothing to press')
  assert.match(app, /onCancel=\{cancelQueuedSave\}/)
  const fx = readSrc(new URL('../src/lib/forgefx.js', import.meta.url), 'utf8')
  assert.match(fx, /export const cancelParkedSave = \(id\) => parkSave\(cancelledSave\(id\)\)/, 'a cancel from a phone is a DELETE, which never arrives')
})

test('Edit has the same Tap as Play, beside the scene, and a tapped tempo leaves the preset unsaved', async () => {
  /*
   * "There's no tempo control on the Edit screen." It went when Home and
   * Controls merged, and Edit is where a delay's time is set — exactly when
   * you want to tap one in. It came back as Play's own button rather than a
   * second one, because the one on Play is what four rounds of "the number
   * lags", "it sends back a different one" were about, and a copy would have
   * to learn all of it again.
   */
  const bare = (t) => t.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ')
  const app = bare(readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8'))
  const gig = bare(readSrc(new URL('../src/components/Gig.jsx', import.meta.url), 'utf8'))
  const tap = bare(readSrc(new URL('../src/components/TapTempo.jsx', import.meta.url), 'utf8'))
  /* Edit's box opens downward off the row: the cell carries tap-row, which test/styles.mjs holds the rule for. */
  assert.match(tap, /className=\{`gig-tap-cell \$\{where === 'row' \? 'tap-row' : ''\}`\}/, 'Edit’s Tap box opens upward over the chain — the cell never gets tap-row')

  const row = app.slice(app.indexOf('className="shape-row"'), app.indexOf('Presets and backups'))
  assert.ok(row.length > 0, 'Edit’s row beside the scene is gone')
  assert.ok(row.indexOf('scene-now') !== -1 && row.indexOf('scene-now') < row.indexOf('<TapTempo'), 'Tap is not beside the scene on Edit')
  assert.match(row, /<TapTempo where="row" onError=\{setError\} onChanged=\{\(summary\) => record\('tempo', summary\)\} \/>/, 'a tempo set on Edit is not logged as a change to the preset')
  assert.match(gig, /<TapTempo onError=\{onError\} onChanged=\{onChanged\} \/>/, 'Play draws a Tap of its own again, or stops reporting it')
  for (const [where, text] of [['App.jsx', app], ['Gig.jsx', gig]]) {
    assert.ok(!/tappedBpm\(|tempoSender\(/.test(text), `${where} works out a tapped tempo on its own again — there are two taps now`)
  }
  /* A tempo is a change to the preset, and Save shows for it. */
  assert.match(app, /const UNSAVES_PRESET = new Set\(\[[^\]]*'tempo'/, 'a tempo change does not leave the preset unsaved')
  /*
   * And the next song is not unsaved because of it. Tapping on Play is the
   * everyday thing, and Previous and Next never cleared Unsaved: tap on song
   * one, press Next, and song two carried Save and Revert, song after song,
   * with its name never noted for the save sheet. The unit throws its edit
   * buffer away on a preset change, as the phone has always known.
   */
  const landed = app.slice(app.indexOf('onPresetLoaded={'), app.indexOf('onPickPreset={'))
  assert.ok(landed.length > 0, 'Play no longer says when it has moved the preset')
  assert.match(landed, /setDirty\(false\)/, 'a tempo tapped on the last song leaves the next one showing Save')
  assert.match(landed, /presetLanded\(\{ fresh: true \}\)/, 'the preset Next lands on is never noted, because Unsaved was still true this tick')

  /*
   * TAPPED as well as typed. Only a typed tempo reported itself, so a tempo
   * tapped in left Save hidden and the new tempo was gone at the next preset.
   * The phone has always counted a tap. Once per burst, not per tap — the
   * history is for what was done, and tapping 120 in is one thing done.
   */
  const tapFn = tap.slice(tap.indexOf('const tap = async'), tap.indexOf('const tapSettled'))
  assert.match(tapFn, /sender\.current\.push\(guess\)\s*burst\.current = guess/, 'a tap that sent a tempo is not remembered as a change')
  assert.ok(!/said\.current|onChanged/.test(tapFn), 'every single tap is reported, so tapping 120 in is eight lines')
  const settled = tap.slice(tap.indexOf('const tapSettled'), tap.indexOf('useEffect(() => () => clearTimeout'))
  assert.match(settled, /reportBurst\(\)/, 'a burst of taps that settled is never reported, so Save stays hidden')
  const report = tap.slice(tap.indexOf('const reportBurst'), tap.indexOf('const tap = async'))
  assert.match(report, /if \(burst\.current == null\) return/, 'a burst is reported twice, or with nothing tapped')
  assert.match(report, /dropBurst\(\)/, 'the same burst is reported again at the next chance')
  const drop = tap.slice(tap.indexOf('const dropBurst'), tap.indexOf('const sender'))
  assert.match(drop, /burst\.current = null/, 'the same burst is reported again at the next chance')
  /*
   * Only what the unit took. A write it refused (port shut, unit gone) showed
   * the banner and then, a second later, logged the tempo anyway and lit Save
   * for a change that never happened. The typed tempo only reports once the
   * write has worked; so does a tapped one.
   */
  assert.match(tap, /await setTempo\(bpm\)\s*landed\.current = bpm/, 'a tempo the unit refused still counts as tapped in')
  assert.match(report, /const got = landed\.current/, 'the report names the number tapped rather than the one the unit took')
  assert.match(report, /if \(got == null\) return/, 'a burst that reached nothing is still reported, and lights Save')
  /* Closed with the last write still on its way: reported when it lands, not guessed at. */
  assert.match(report, /if \(!sender\.current\.idle\) \{\s*closing\.current = true\s*return/, 'a burst closed mid-write is reported before anyone knows it landed')
  assert.match(tap, /finally \{[^}]*if \(closing\.current\) setTimeout\(\(\) => reportBurst\(\), 0\)/, 'a burst closed mid-write is never reported once it lands')
  /*
   * On the preset it was tapped on. Tap, then pick the next song inside the
   * second before the read-back, and the report landed on the NEW song: a
   * hand edit logged against a preset nobody touched, and Save lit on it.
   * Keyed on chainNumberOf, which moves the moment a switch starts —
   * preset.number moves only after jumpTo has already cleared Unsaved.
   */
  assert.match(tapFn, /if \(burst\.current == null\) \{[^}]*burstOn\.current = chainNumberOf\(getSnapshot\(\)\)/, 'a burst does not remember which preset it was tapped on')
  assert.match(report, /if \(chainNumberOf\(getSnapshot\(\)\) !== on\) return/, 'taps on the last song are reported against the one just picked, and mark it unsaved')
  assert.ok(report.indexOf('!== on) return') < report.indexOf('said.current'), 'the preset is checked after the report has gone')
  assert.match(tap, /const going = useDevice\(chainNumberOf\)/, 'a preset change is not seen by the Tap button')
  assert.match(tap, /useEffect\(\(\) => \{\s*dropBurst\(\)\s*setTapped\(null\)\s*\}, \[going\]\)/, 'a burst tapped on the last song survives the switch to the next')
  assert.ok(!/preset\?\.number/.test(tap), 'the Tap button waits on preset.number, which moves after Unsaved was already cleared')
  assert.match(report, /said\.current\?\.\(`Tempo → \$\{n\} BPM \(tapped\)`\)/, 'the tapped tempo does not reach the screen that logs it')
  /* A screen switched away from inside the second after the last tap still owes the report. */
  assert.match(tap, /useEffect\(\(\) => \(\) => reportBurst\(\), \[\]\)/, 'taps on Edit followed by a swipe to Play are never counted')
  assert.match(tap, /said\.current = onChanged/, 'a report after the screen changed goes to the first render’s idea of who logs it')
  const hold = tap.slice(tap.indexOf('const holdTap = useLongPress'), tap.indexOf('useDismiss(tapCell'))
  assert.match(hold, /reportBurst\(\)/, 'a hold drops the read-back and the report of the taps before it with it')
})

test('scene names show whole, and nothing on Play waits for a hold to show one', () => {
  /*
   * "Scene names cut short." Edit's chip wraps to two lines and carries the
   * whole name on a hover, and Play's tiles carry it too. NOT a long press:
   * on Play a scene tile is a footswitch, and a hold that does not switch the
   * scene is the wrong surprise mid-song.
   */
  const bare = (t) => t.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ')
  const app = bare(readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8'))
  const gig = bare(readSrc(new URL('../src/components/Gig.jsx', import.meta.url), 'utf8'))
  const chip = app.slice(app.indexOf("className={`chip ${hasScenes ? 'scene-now' : ''}`}"), app.indexOf('</button>', app.indexOf('scene-now')))
  assert.match(chip, /title=\{hasScenes \? sceneNames\[scene\] \|\| undefined : undefined\}/, 'the scene chip on Edit has no hover with the whole name')
  const tile = gig.slice(gig.indexOf('className={`gig-scene '), gig.indexOf('</button>', gig.indexOf('className={`gig-scene ')))
  assert.ok(tile.length > 0, 'Play’s scene tiles are not where this test reads them')
  assert.match(tile, /title=\{names\[i\] \|\| undefined\}/, 'Play’s scene tiles have no hover with the whole name')
  assert.ok(!/\{\.\.\.hold|onContextMenu|useLongPress/.test(tile), 'a scene tile on Play does something on a hold, which is a footswitch that does not switch')
})

test('Play says where the looper went, and still never draws one', async () => {
  /*
   * "PLAY leaves out the Looper." On purpose — input, output and the looper
   * are never stage tiles, because an on/off switch under a thumb can mute
   * the rig mid-song and on/off is not what a looper wants. But thirteen
   * blocks drawn as ten reads as three gone missing, so Play says where it is.
   */
  const { STAGE_HIDDEN } = await import('../src/lib/guardrails.js')
  const { findLooper } = await import('../shared/looper.mjs')
  for (const slug of ['input', 'output', 'looper']) assert.ok(STAGE_HIDDEN.includes(slug), `${slug} is a tile on Play now`)
  assert.equal(findLooper([{ slug: 'amp' }, { slug: 'looper', effectId: 158 }])?.effectId, 158)
  assert.equal(findLooper([{ slug: 'amp' }, { slug: 'delay' }]), null, 'a preset with no looper is offered a Looper button')
  assert.equal(findLooper(null), null)

  const bare = (t) => t.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ')
  const gig = bare(readSrc(new URL('../src/components/Gig.jsx', import.meta.url), 'utf8'))
  /* From every block, not the tiles: the tiles are exactly what leaves it out. */
  assert.match(gig, /const looperHere = findLooper\(allBlocks\)/, 'the Looper button asks the tiles, which never hold one')
  /* A pedal in the chain, not its own button: tapping it opens the buttons, never bypasses the block. */
  assert.match(gig, /\{looperHere \? \(\s*<BlockTile\s+key="looper"\s+block=\{looperHere\}\s+door\s+onToggle=\{\(\) => setLooping\(true\)\}/, 'the looper is not a pedal in the chain, or tapping it does not open its buttons')
  assert.ok(!/gig-note-action">\s*<button type="button" onClick=\{\(\) => setLooping/.test(gig), 'the looper still has its own button under the chain')
  assert.match(gig, /const tileCount = blocks\.length \+ \(looperHere \? 1 : 0\)/, 'the fit does not count the looper pedal')
  assert.match(gig, /blocks: fitCount,/, 'the fit does not count the looper pedal')
  assert.match(gig, /allBlocks\.filter\(\(b\) => b\.slug && !STAGE_HIDDEN\.includes\(b\.slug\)\)/, 'Play draws a tile for the looper, input or output')
})

console.log('\nwhat the footswitches do')

test('the footswitch panel is only for a unit that says its switches can be read', async () => {
  /*
   * "See what the footswitches do." The host serves the words for an FM9's
   * and a III's switches but cannot read one (liveState false), and an AM4
   * has none — so a panel drawn on any of those would open onto a refusal.
   */
  const { fcReadable } = await import('../shared/footswitches.mjs')
  assert.equal(fcReadable({ fc: { model: true, liveState: true } }), true)
  assert.equal(fcReadable({ fc: { model: true, liveState: false } }), false, 'an FM9 is offered a read it cannot answer')
  assert.equal(fcReadable({ fc: { model: false, liveState: false } }), false)
  assert.equal(fcReadable({}), false)
  assert.equal(fcReadable(null), false)
  assert.equal(fcReadable({ fc: { liveState: 'yes' } }), false, 'only the host’s own true opens it')

  const { createMockDevice } = await import('../src/lib/mockDevice.js')
  assert.equal(fcReadable(createMockDevice('fm3').detect().capabilities), true, 'the demo FM3 has no footswitch panel')
  for (const key of ['fm9', 'axefx3', 'am4', 'vp4']) {
    assert.equal(fcReadable(createMockDevice(key).detect().capabilities), false, `the demo ${key} offers a switch read the real one refuses`)
  }
})

test('a switch is said in words: tap, hold, a typed label, and the light', async () => {
  const { describeSwitch, lightWords, FC_BUSY_WARNING } = await import('../shared/footswitches.mjs')
  assert.match(FC_BUSY_WARNING, /between songs/, 'the panel no longer says when to read the switches')
  const model = {
    categories: { 0: 'Unassigned', 3: 'Scene', 4: 'Effect', 5: 'Utility', 9: 'Per-Preset' },
    functions: { 3: [{ ord: 0, name: 'Select' }], 4: [{ ord: 0, name: 'Bypass' }], 5: [{ ord: 1, name: 'Tap Tempo' }], 9: [{ ord: 0, name: 'Placeholder' }] },
    colors: { 1: { name: 'Red', hex: '#e23b3b' }, 12: { name: 'Off', hex: '#3a3a44' } }
  }
  const at = (fields, extra = {}) => describeSwitch({ switch: 1, fields, tapLabel: '', holdLabel: '', ...extra }, model)

  const one = at({ tapCategory: 3, tapFunction: 0, holdCategory: 5, holdFunction: 1, color: 1 }, { tapLabel: 'CLEAN      ' })
  assert.equal(one.number, 2, 'switches are counted from 1 on screen')
  assert.equal(one.tap.action, 'Scene · Select')
  assert.equal(one.tap.label, 'CLEAN', 'a stored label is shown, without its padding')
  assert.equal(one.hold.action, 'Tap Tempo', '“Utility · Tap Tempo” is two words for one thing')
  assert.equal(one.hold.label, null, 'an empty label is drawn as a label')
  assert.deepEqual(one.light, { name: 'Red', hex: '#e23b3b' })
  assert.equal(lightWords(one.light), 'Red light')
  assert.equal(one.unread, false)

  /* The label-mode number is not trusted, so a label shows whatever it says. */
  assert.equal(at({ tapCategory: 4, tapFunction: 0, tapDisplay: 0, holdCategory: 0, color: 12 }, { tapLabel: 'DRIVE' }).tap.label, 'DRIVE')

  const empty = at({ tapCategory: 0, tapFunction: 0, holdCategory: 0, holdFunction: 0, color: 12 })
  assert.equal(empty.tap.action, 'Nothing')
  assert.equal(lightWords(empty.light), 'Light off', '“Off” is a colour the unit has, not a missing one')

  /* A question the unit did not answer is not "nothing on this switch". */
  const gap = at({ tapCategory: null, tapFunction: null, holdCategory: 4, holdFunction: 0, color: null })
  assert.equal(gap.tap.action, 'Couldn’t read')
  assert.equal(gap.hold.action, 'Effect · Bypass')
  assert.equal(gap.light, null)
  assert.equal(lightWords(gap.light), 'Light: couldn’t read')
  assert.equal(at({ tapCategory: null, holdCategory: null, color: null }).unread, true)

  assert.equal(at({ tapCategory: 9, tapFunction: 0, holdCategory: 0, color: 1 }).tap.action, 'Per-Preset', '“Per-Preset · Placeholder” says nothing')
  assert.equal(at({ tapCategory: 4, tapFunction: 7, holdCategory: 0, color: 1 }).tap.action, 'Effect', 'a function this app has no word for hides the kind it does know')
  assert.equal(at({ tapCategory: 42, holdCategory: 0, color: 1 }).tap.action, 'Something this app can’t name yet')

  /* The FM3's colour list starts at 1, so a 0 is an answer with no name, not a failed read. */
  const odd = at({ tapCategory: 3, tapFunction: 0, holdCategory: 0, color: 0 })
  assert.deepEqual(odd.light, { name: null, hex: null }, 'a colour the unit did report is not a failed read')
  assert.equal(lightWords(odd.light), 'Light: a colour this app can’t name yet')
})

test('the demo FM3 answers a switch in the host’s shape', async () => {
  const { createMockDevice } = await import('../src/lib/mockDevice.js')
  const { describeSwitch, fcGeometry } = await import('../shared/footswitches.mjs')
  const unit = createMockDevice('fm3')
  const model = unit.fcModel()
  assert.deepEqual(fcGeometry(model), { layouts: 9, views: 4, switches: 3 })
  const state = unit.fcState(0, 0, 0)
  for (const k of ['tapCategory', 'tapFunction', 'holdCategory', 'holdFunction', 'color']) {
    assert.ok(k in state.fields, `the demo’s switch has no ${k}, which the host always sends`)
  }
  const sw = describeSwitch(state, model)
  assert.equal(sw.tap.action, 'Scene · Select')
  assert.equal(sw.hold.label, 'BOOST')
  assert.ok(sw.light?.name, 'the demo’s light has no colour the dictionary knows')
  /* Every view reads as words, never as "can’t name". */
  for (let view = 0; view < 4; view++) {
    for (let s = 0; s < 3; s++) {
      const said = describeSwitch(unit.fcState(0, view, s), model)
      assert.ok(!/can’t name|Couldn’t/.test(said.tap.action + said.hold.action), `view ${view + 1} switch ${s + 1}: ${said.tap.action} / ${said.hold.action}`)
    }
  }
})

test('one view is read one switch at a time, with a breath between, and stops when asked', async () => {
  /*
   * About twenty-nine questions to the unit per switch. Three at once would
   * be eighty-odd questions landing on a unit that is also making sound.
   */
  const { readView, fcStatePath, FC_PAUSE_MS } = await import('../shared/footswitches.mjs')
  assert.equal(fcStatePath(2, 1, 0), '/fc/state?layout=2&view=1&switch=0')

  const log = []
  let inFlight = 0
  let most = 0
  const get = async (path) => {
    inFlight++
    most = Math.max(most, inFlight)
    log.push(path)
    await Promise.resolve()
    inFlight--
    return { switch: Number(path.split('switch=')[1]), fields: {} }
  }
  const waits = []
  const wait = async (ms) => {
    waits.push(ms)
    log.push(`wait ${ms}`)
  }
  const landed = []
  const done = await readView(get, { layout: 0, view: 3, wait, onSwitch: (i) => landed.push(i) })
  assert.equal(done.error, null)
  assert.equal(done.states.length, 3)
  assert.deepEqual(landed, [0, 1, 2])
  assert.equal(most, 1, 'two switches were asked for at once')
  assert.deepEqual(log, [
    '/fc/state?layout=0&view=3&switch=0',
    `wait ${FC_PAUSE_MS}`,
    '/fc/state?layout=0&view=3&switch=1',
    `wait ${FC_PAUSE_MS}`,
    '/fc/state?layout=0&view=3&switch=2'
  ])
  assert.ok(FC_PAUSE_MS >= 200, 'no breath between switches')

  /* Closing the panel stops the next question. */
  let asked = 0
  let shut = false
  const closed = await readView(async () => {
    asked++
    shut = true
    return { fields: {} }
  }, { layout: 0, view: 0, wait: async () => {}, stopped: () => shut })
  assert.equal(asked, 1, 'the unit was asked again after the panel closed')
  assert.equal(closed.stopped, true)

  /* The first refusal ends it: the next switch would be refused for the same reason. */
  let tries = 0
  const refused = await readView(async () => {
    tries++
    throw new Error('The Fractal app on your computer has lost its connection to the unit')
  }, { layout: 0, view: 0, wait: async () => {} })
  assert.equal(tries, 1, 'a failed read went on asking')
  assert.match(refused.error, /lost its connection/)
  const said = await readView(async () => ({ error: 'fcLiveRead not supported' }), { layout: 0, view: 0, wait: async () => {} })
  assert.equal(said.states.length, 0)
  assert.match(said.error, /not supported/)
})

test('a footswitch read travels the relay and is given the long wait', () => {
  /* GET is the host's rule for both; the read is twenty-nine answers long. */
  assert.equal(forbiddenRemotely('GET', '/fc/model'), null)
  assert.equal(forbiddenRemotely('GET', '/fc/state?layout=0&view=0&switch=0'), null)
  assert.equal(timeoutFor('GET', '/fc/state?layout=0&view=0&switch=2'), 45000, 'a slow unit’s switch read is cut off at twenty seconds')
  assert.equal(timeoutFor('GET', '/fc/model'), 20000, 'the dictionary is one answer, not a slow read')
})

test('the Footswitches fold reads only while it is open, and never on a timer', () => {
  const bare = (t) => t.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ')
  const app = readSrc(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /const switchesReadable = fcReadable\(device\?\.capabilities\)/, 'the panel is not gated on the unit saying it can be read')
  assert.match(
    app,
    /\{switchesReadable \? \(\s*<Section key="footswitches" title="Footswitches"[^>]*>\s*<Footswitches \/>/,
    'the Footswitches fold is gone from Edit, or drawn for a unit that cannot answer it'
  )
  const panel = bare(readSrc(new URL('../src/components/Footswitches.jsx', import.meta.url), 'utf8'))
  assert.match(panel, /closest\('details'\)/, 'the panel no longer knows whether its fold is open')
  assert.match(panel, /addEventListener\('toggle'/, 'the panel does not hear its fold open or close')
  assert.match(panel, /if \(!open\) return undefined/, 'the panel reads while folded away')
  assert.match(panel, /stopped: \(\) => stop/, 'closing the fold does not stop the read')
  assert.match(panel, /readView\(fcSwitch,/, 'the switches are not read through the paced reader')
  assert.ok(!/setInterval|setTimeout/.test(panel), 'the footswitch panel polls the unit')
  assert.match(panel, /\{FC_BUSY_WARNING\}/, 'the panel does not say reading is best done between songs')
  /* Opening the fold starts the read, so the warning has to be seen while it is still shut. */
  assert.match(app, /<Section key="footswitches" title="Footswitches" note="[^"]*between songs[^"]*"/, 'the warning is only seen once the fold is open, when the unit is already being asked')
  /* A picker change stops the old read on its own; locking them made reaching View 4 read View 1 first. */
  assert.ok(!/<select[^>]*\bdisabled=/.test(panel), 'the Layout and View pickers are locked for a whole view, so reaching View 4 of a layout reads View 1 first')
})


test('the browser’s setlist swipes a song away like the phone’s, with no ✕ beside the grip', () => {
  /*
   * "Make it so you can swipe left on a song in the set list to delete it and
   * then remove the exes from the right side of the hamburger drag icon."
   */
  const list = readSrc(new URL('../src/components/Setlists.jsx', import.meta.url), 'utf8')
  const row = readSrc(new URL('../src/components/SwipeRow.jsx', import.meta.url), 'utf8')
  const css = readSrc(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.ok(!/className="setlist-remove"/.test(list), 'the ✕ is still on every row beside the grip')
  assert.match(list, /<SwipeRow\s+key=\{n\}/, 'a song in the browser cannot be swiped away')
  assert.match(list, /onRemove=\{\(\) => setPresets\(removeFrom\(chosen\.presets, n\)\)\}/, 'a swipe does not take the song out')
  /* Same numbers as the phone, and a button inside the row keeps its own gesture. */
  assert.match(row, /from '\.\.\/\.\.\/shared\/swipe-hint\.mjs'/, 'the browser swipes by its own numbers')
  assert.match(row, /const landing = swipeLanding\(at\.current\)/)
  assert.match(row, /\(!fromButtons && e\.target\.closest\?\.\('button'\)\)\) return/, 'dragging the grip slides the row instead of moving the song')
  assert.match(row, /if \(e\.target\.closest\?\.\('\.grip, \.chain-grip, \[data-grip\]'\)\) return/, 'a chain card’s grip slides it instead of moving it')
  assert.match(row, /Math\.abs\(ddx\) > Math\.abs\(ddy\) \* 2/, 'a scroll can swipe a song away')
  assert.match(row, /place\(Math\.min\(0, s\.base \+ ddx\)\)/, 'the row can be dragged to the right, where there is nothing')
  /* The ✕ stays in the page behind the row, so a keyboard can still remove a song. */
  assert.match(row, /className="swipe-row-remove"\s+aria-label=\{label\}\s+onFocus=\{\(\) => place\(-SWIPE_OPEN\)\}/, 'without a pointer a song can no longer be removed')
  const face = css.slice(css.indexOf('.swipe-row-face {'))
  assert.match(face.slice(0, face.indexOf('}')), /touch-action: pan-y/, 'a sideways swipe on a phone is taken by the browser, or the sheet no longer scrolls')
  const song = css.slice(css.indexOf('.setlist-song {'))
  assert.match(song.slice(0, song.indexOf('}')), /background: var\(--panel\)/, 'the row is see-through, so the ✕ shows through every song')
  assert.match(song.slice(0, song.indexOf('}')), /grid-template-columns: 2ch minmax\(0, 1fr\) auto;/, 'the row still keeps a column for the ✕')

  /* The first-time hint, once per browser, with the first song showing the gesture. */
  assert.match(list, /const swipeHint = !!chosen && showSwipeHint\(swipeSeen, chosen\.presets\.length\)/)
  assert.match(list, /demo=\{i === 0 && swipeHint\}/, 'the hint describes the gesture without showing it')
  assert.match(list, /window\.localStorage\.setItem\(SWIPE_HINT_KEY, 'done'\)/, 'Got it does not put the hint away for good')
  assert.match(css, /@keyframes swipe-demo/)
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.swipe-row-face\.swipe-demo/, 'the demo slides for somebody who asked for less motion')
})


test('split chains: the rows and their joins are read, and a parallel path is planned, built and taken away', async () => {
  const S = await import('../shared/split-chain.mjs')
  /* One row: input, drive, amp, delay, reverb, cab, output — each fed from its own row. */
  const chain = ['input', 'drive', 'amp', 'delay', 'reverb', 'cab', 'output']
  const ids = { input: 37, drive: 118, amp: 58, delay: 70, reverb: 66, cab: 62, output: 42 }
  const blocks = chain.map((slug, col) => ({ slug, name: slug.toUpperCase(), effectId: ids[slug], row: 0, col, fromRows: col ? [0] : [] }))
  const cells = blocks.map((b) => ({ row: b.row, col: b.col, effectId: b.effectId, name: b.name, fromRows: b.fromRows }))
  const map = S.gridMap(cells, blocks, { rows: 4, cols: 12 })
  assert.equal(S.mainRow(map), 0)
  assert.deepEqual(S.branches(map), [], 'a single row is drawn as having a parallel path')
  assert.equal(S.joins(map).known, true)
  assert.equal(S.joins(map).edges.length, 6)

  /* Dry beside the delay: leaves after the amp, rejoins at the reverb, on the first free row. */
  const dry = S.planParallel(map, { first: 3, last: 3 })
  assert.equal(dry.ok, true)
  assert.equal(dry.row, 1)
  assert.deepEqual(dry.steps, [
    { kind: 'cable', srcRow: 0, srcCol: 2, destRow: 1, connect: true },
    { kind: 'cable', srcRow: 1, srcCol: 3, destRow: 0, connect: true }
  ])
  /* A wider path wires along its own row in between, and blocks go in before the cables. */
  const wide = S.planParallel(map, { first: 2, last: 4, put: [{ col: 3, blockId: 71, name: 'Delay 2' }] })
  assert.deepEqual(wide.steps.map((x) => x.kind), ['place', 'cable', 'cable', 'cable', 'cable'], 'a cable reaches an empty cell before the block it was meant for')
  assert.deepEqual(wide.steps[0], { kind: 'place', row: 1, col: 3, blockId: 71, name: 'Delay 2' })
  assert.deepEqual(wide.steps.slice(1).map((x) => [x.srcRow, x.srcCol, x.destRow]), [[0, 1, 1], [1, 2, 1], [1, 3, 1], [1, 4, 0]])
  /* And refuses what cannot be wired. */
  assert.equal(S.planParallel(map, { first: 0, last: 0 }).ok, false, 'a path before the first column has nothing to split from')
  assert.equal(S.planParallel(map, { first: 6, last: 6 }).ok, false, 'a path after the output has nothing to join back into')
  assert.equal(S.planParallel(map, { first: 4, last: 3 }).ok, false)

  /* Run it against the demo unit and read it back: the path is there, joined at both ends. */
  const { createMockDevice } = await import('../src/lib/mockDevice.js')
  const mock = createMockDevice()
  for (const b of mock.presetBlocks().filter((x) => x.row !== undefined)) mock.placeBlock(b.row, b.col, 0)
  for (const b of blocks) mock.placeBlock(b.row, b.col, b.effectId)
  const wire = { setCable: mock.cable, placeBlock: mock.placeBlock, clearCell: (r, c) => mock.placeBlock(r, c, 0) }
  const ran = await S.runPlan(S.layoutsAround(map, map.at(0, 3), [{ family: 'delay', name: 'Delay 2', page: 71, instance: 2 }]).find((l) => l.key === 'second').plan.steps, wire)
  assert.equal(ran.ok, true)
  const after = S.gridMap(mock.grid().cells, mock.presetBlocks(), { rows: 4, cols: 12 })
  const [path] = S.branches(after)
  assert.ok(path, 'the demo does not keep a parallel path')
  assert.deepEqual([path.row, path.start, path.end, path.from, path.to, path.open], [1, 3, 3, [0], [0], false])
  assert.deepEqual(path.blocks.map((b) => b.effectId), [71])
  assert.equal(after.at(0, 4).fromRows.includes(1), true, 'the path does not mix back into the main row')

  /* Taking it away cuts both joins first, then clears the row — and says what goes. */
  const gone = S.planRemoveBranch(after, 1)
  assert.equal(gone.ok, true)
  assert.deepEqual(gone.losing, ['Delay 2'])
  assert.deepEqual(gone.steps.slice(0, 2), [
    { kind: 'cable', srcRow: 0, srcCol: 2, destRow: 1, connect: false },
    { kind: 'cable', srcRow: 1, srcCol: 3, destRow: 0, connect: false }
  ], 'the main row keeps feeding a half-removed path')
  assert.equal(gone.steps.at(-1).kind, 'clear')
  await S.runPlan(gone.steps, wire)
  const back = S.gridMap(mock.grid().cells, mock.presetBlocks(), { rows: 4, cols: 12 })
  assert.deepEqual(S.branches(back), [], 'the path is still on the unit after it was taken away')
  assert.deepEqual(back.at(0, 4).fromRows, [0])
  assert.equal(S.planRemoveBranch(back, 0).ok, false, 'the main row can be removed as though it were a branch')

  /* Delay and reverb side by side: the reverb moves, its old cell carries the wire. */
  const choices = S.layoutsAround(map, map.at(0, 3), [])
  assert.deepEqual(choices.map((c) => c.key), ['dry', 'second', 'delay-reverb'])
  assert.equal(choices.find((c) => c.key === 'second').plan.ok, false, 'a second delay is offered on a unit with no spare one')
  const side = choices.find((c) => c.key === 'delay-reverb').plan
  assert.equal(side.ok, true)
  await S.runPlan(side.steps, wire)
  const sbs = S.gridMap(mock.grid().cells, mock.presetBlocks(), { rows: 4, cols: 12 })
  assert.equal(sbs.at(1, 3)?.effectId, 66, 'the reverb is not beside the delay')
  assert.equal(sbs.at(0, 4)?.kind, S.CELL.shunt, 'the reverb’s old cell does not carry the main row on')
  assert.deepEqual(sbs.at(0, 4).fromRows, [0, 1], 'the delay and the reverb do not mix back together')
  assert.equal(sbs.at(0, 5).fromRows.includes(0), true, 'the chain stops where the reverb was')

  /* Never offered around the ends of the chain or the looper, or on a branch row. */
  assert.deepEqual(S.layoutsAround(map, map.at(0, 0), []), [])
  assert.deepEqual(S.layoutsAround(map, map.at(0, 6), []), [])
  assert.deepEqual(S.layoutsAround(sbs, sbs.at(1, 3), []), [])

  /* A unit that reports no joins is drawn as plain rows, and says the joins are a guess. */
  const blind = S.gridMap(cells.map(({ fromRows, ...c }) => c), blocks.map(({ fromRows, ...b }) => b))
  assert.equal(S.joins(blind).known, false)

  /* Every step has words, and a step that throws stops the plan there. */
  assert.match(S.stepWords({ kind: 'cable', srcRow: 0, srcCol: 2, destRow: 1, connect: true }), /join row 1, column 3 → row 2/)
  const stopped = await S.runPlan(dry.steps, { setCable: async () => { throw new Error('port not open') } })
  assert.deepEqual([stopped.ok, stopped.done, stopped.error], [false, 0, 'port not open'])
  const doubtful = await S.runPlan(dry.steps, { setCable: async () => ({ ok: false }) })
  assert.deepEqual([doubtful.ok, doubtful.doubtful], [true, 2], 'an ok:false answer stops the plan, though some units say it of writes that landed')
})

/*
 * THE LOOPER, AT THE END OF THE CHAIN. "Let's make it easier to add just a
 * looper block... can you tell me where a looper block should go in the
 * chain?" One tap puts it after the last effect, right before the Output, on
 * the row the guitar comes in on, and wires it in — never on a spare row
 * joined to nothing, which is where picking a cell had put it.
 */
test('one tap puts the looper at the end of the chain, before the Output, and wires it in', async () => {
  const { gridMap, planLooper } = await import('../shared/split-chain.mjs')
  const catalog = JSON.parse(readSrc(new URL('../src/data/blocks.json', import.meta.url), 'utf8'))
  const chain = [
    { slug: 'input', name: 'Input 1', effectId: 37, row: 1, col: 0 },
    { slug: 'amp', name: 'Amp 1', effectId: 58, row: 1, col: 1 },
    { slug: 'cab', name: 'Cab 1', effectId: 62, row: 1, col: 2 },
    { slug: 'reverb', name: 'Reverb 1', effectId: 66, row: 1, col: 3 },
    { slug: 'output', name: 'Output 1', effectId: 42, row: 1, col: 11 }
  ]
  const wires = Array.from({ length: 7 }, (_, i) => ({ row: 1, col: 4 + i, effectId: 1001 + i, isShunt: true, fromRows: [1] }))
  const plan = planLooper(gridMap(wires, chain, { rows: 4, cols: 12 }), catalog)
  assert.equal(plan.ok, true, plan.why)
  assert.deepEqual([plan.row, plan.col], [1, 4], 'the looper is not straight after the last effect, on the chain’s own row')
  assert.deepEqual(plan.steps[0], { kind: 'place', row: 1, col: 4, blockId: 166, name: 'Looper' })
  const cables = plan.steps.filter((s) => s.kind === 'cable')
  assert.deepEqual(cables.map((c) => c.srcCol), [3, 4, 5, 6, 7, 8, 9, 10], 'the looper is not wired from the reverb all the way to the Output')
  assert.ok(cables.every((c) => c.srcRow === 1 && c.destRow === 1 && c.connect))

  /* Already on the chain: left alone, and said so. */
  const has = planLooper(gridMap([], [...chain, { slug: 'looper', name: 'Looper 1', effectId: 166, row: 1, col: 5 }]), catalog)
  assert.equal(has.ok, false)
  assert.equal(has.here, true)

  /* On a spare row, joined to nothing — the screenshot: taken out and put at the end. */
  const stray = planLooper(gridMap([], [...chain, { slug: 'looper', name: 'Looper 1', effectId: 166, row: 0, col: 0 }]), catalog)
  assert.equal(stray.ok, true)
  assert.equal(stray.moved, true)
  assert.deepEqual(stray.steps[0], { kind: 'clear', row: 0, col: 0, name: 'Looper 1' })
  assert.deepEqual([stray.row, stray.col], [1, 4])

  /* No room before the Output: the Output steps one along and the looper takes its cell. */
  const tight = chain.map((b) => (b.slug === 'output' ? { ...b, col: 4 } : b))
  const shuffled = planLooper(gridMap([], tight), catalog)
  assert.equal(shuffled.ok, true, shuffled.why)
  assert.deepEqual(shuffled.steps.slice(0, 3), [
    { kind: 'clear', row: 1, col: 4, name: 'Output 1' },
    { kind: 'place', row: 1, col: 5, blockId: 42, name: 'Output 1' },
    { kind: 'place', row: 1, col: 4, blockId: 166, name: 'Looper' }
  ])

  /* A full row says why rather than guessing. */
  const full = Array.from({ length: 12 }, (_, col) => ({ slug: col === 11 ? 'output' : 'amp', name: `B${col}`, effectId: 500 + col, row: 0, col }))
  const none = planLooper(gridMap([], full), catalog)
  assert.equal(none.ok, false)
  assert.match(none.why, /no free space/)
})

/*
 * "Undo for the last chain change." A block swiped out goes back in its own
 * cell, wired to what fed it and what it fed; a looper put in comes out again,
 * and an Output that stepped along for it steps back.
 */
test('Undo puts a block taken out back where it was, wired in, and takes a looper back out', async () => {
  const { gridMap, planLooper, planPutBack, putBackWords, takeOutWords, UNDO_STALE } = await import('../shared/split-chain.mjs')
  const catalog = JSON.parse(readSrc(new URL('../src/data/blocks.json', import.meta.url), 'utf8'))
  const chain = [
    { slug: 'input', name: 'Input 1', effectId: 37, row: 1, col: 0 },
    { slug: 'drive', name: 'Drive 1', effectId: 50, row: 1, col: 1 },
    { slug: 'amp', name: 'Amp 1', effectId: 58, row: 1, col: 2 },
    { slug: 'delay', name: 'Delay 1', effectId: 70, row: 2, col: 2 },
    { slug: 'output', name: 'Output 1', effectId: 42, row: 1, col: 4 }
  ]
  /* The drive feeds both the amp and the delay below it. */
  const cells = [
    { row: 1, col: 1, effectId: 50, fromRows: [1] },
    { row: 1, col: 2, effectId: 58, fromRows: [1] },
    { row: 2, col: 2, effectId: 70, fromRows: [1] }
  ]
  const back = planPutBack(gridMap(cells, chain, { rows: 4, cols: 12 }), 1, 1)
  assert.equal(back.ok, true)
  assert.equal(back.name, 'Drive 1')
  assert.deepEqual(back.steps, [
    { kind: 'place', row: 1, col: 1, blockId: 50, name: 'Drive 1' },
    { kind: 'cable', srcRow: 1, srcCol: 0, destRow: 1, connect: true },
    { kind: 'cable', srcRow: 1, srcCol: 1, destRow: 1, connect: true },
    { kind: 'cable', srcRow: 1, srcCol: 1, destRow: 2, connect: true }
  ])
  /* Nothing there, nothing to put back. */
  assert.equal(planPutBack(gridMap(cells, chain), 3, 3).ok, false)

  /* The looper's way back. */
  const wires = Array.from({ length: 7 }, (_, i) => ({ row: 1, col: 4 + i, effectId: 1001 + i, isShunt: true, fromRows: [1] }))
  const roomy = [...chain.filter((b) => b.slug !== 'output'), { slug: 'output', name: 'Output 1', effectId: 42, row: 1, col: 11 }]
  const plan = planLooper(gridMap(wires, roomy, { rows: 4, cols: 12 }), catalog)
  assert.deepEqual(plan.undo, [{ kind: 'clear', row: 1, col: plan.col, name: 'Looper' }])
  const tight = planLooper(gridMap([], chain.filter((b) => b.slug !== 'delay').map((b) => (b.slug === 'output' ? { ...b, col: 3 } : b))), catalog)
  assert.deepEqual(tight.undo, [
    { kind: 'clear', row: 1, col: 3, name: 'Looper' },
    { kind: 'clear', row: 1, col: 4, name: 'Output 1' },
    { kind: 'place', row: 1, col: 3, blockId: 42, name: 'Output 1' },
    { kind: 'cable', srcRow: 1, srcCol: 2, destRow: 1, connect: true }
  ])
  /* A looper moved off a spare row has no way back: its settings went with it. */
  const stray = planLooper(gridMap([], [...roomy, { slug: 'looper', name: 'Looper 1', effectId: 166, row: 0, col: 0 }]), catalog)
  assert.equal(stray.undo, null)

  /* What it says. */
  assert.equal(putBackWords('Drive 1', { res: { ok: true }, landed: true, kept: true }).text, 'Put Drive 1 back, with its settings.')
  assert.equal(putBackWords('Drive 1', { res: { ok: true }, landed: true, kept: false }).bad, true)
  assert.match(putBackWords('Drive 1', { res: { ok: true }, landed: false, kept: null }).text, /didn’t take Drive 1 back/)
  assert.equal(takeOutWords('the looper', { res: { ok: true }, gone: true }).text, 'Took the looper out again.')
  assert.match(UNDO_STALE, /Nothing was changed/)

  /* Both ends offer it, and only for the preset it was made on. */
  for (const [file, from] of [
    ['../src/components/ChainUndo.jsx', '../../shared/split-chain.mjs'],
    ['../mobile/src/components/ChainUndo.js', '../lib/split-chain']
  ]) {
    const src = readSrc(new URL(file, import.meta.url), 'utf8')
    assert.ok(src.includes(`from '${from}'`), `${file} has its own plan`)
    assert.match(src, /const live = undo && undo\.n === (n|number) \? undo : null/, `${file} offers an Undo on another preset`)
    assert.match(src, /setSaid\(\{ bad: true, text: UNDO_STALE \}\)/, `${file} runs an Undo over a chain changed since`)
  }
  const grid = readSrc(new URL('../src/components/GridEditor.jsx', import.meta.url), 'utf8')
  const edit = readSrc(new URL('../mobile/src/screens/Edit.js', import.meta.url), 'utf8')
  for (const [name, src] of [['GridEditor', grid], ['Edit', edit]]) {
    const read = src.indexOf('await readPutBack(row, col,')
    assert.ok(read > 0 && read < src.indexOf('await clearCell(row, col)', read), `${name} reads the block after it is gone`)
    assert.match(src, /\{chainUndo\.bar\}/, `${name} has no Undo to press`)
  }
})

/*
 * "Show what's attached to each modifier." Each slot is read off the unit and
 * said in a line — but only when its numbers name a listed source and a block
 * in this preset. Anything else is "can't tell", never a guess.
 */
test('the modifier slots are read back and said in a line, and a slot that does not decode is not guessed at', async () => {
  const { readAttached, slotBinding, attachedSummary, modSlotEid } = await import('../shared/mod-read.mjs')
  const model = {
    effectId: 3,
    slotCount: 4,
    fields: { source: { pid: 0 }, targetEffectId: { pid: 8 }, targetParam: { pid: 9 } },
    sources: [{ ordinal: 0, name: 'None' }, { ordinal: 5, name: 'Expression 1' }, { ordinal: 1, name: 'LFO 1' }]
  }
  assert.equal(modSlotEid(model, 1), 3)
  assert.equal(modSlotEid(model, 4), 6)
  assert.equal(slotBinding({}, model).used, false)
  const blocks = [{ effectId: 50, name: 'Drive 1' }, { effectId: 58, name: 'Amp 1' }]
  const raw = { 3: { 0: 5, 8: 50, 9: 1 }, 4: {}, 5: { 0: 1, 8: 999, 9: 2 } }
  const read = []
  const res = await readAttached({
    model,
    blocks,
    readRaw: async (eid) => {
      read.push(eid)
      if (eid === 6) throw new Error('timed out')
      return { eid, values: raw[eid] }
    },
    readControls: async (eid) => ({ named: eid === 50 ? [{ id: 1, name: 'Gain' }] : [] }),
    log: () => {}
  })
  assert.deepEqual(read, [3, 4, 5, 6])
  assert.equal(res.lines.length, 2)
  assert.equal(res.lines[0].text, 'Expression 1 → Drive 1 · Gain')
  assert.equal(res.lines[1].known, false, 'a block not in this preset was guessed at')
  assert.match(res.lines[1].text, /Slot 3 is set up, but the app can’t tell/)
  assert.equal(res.unread, 1)
  assert.equal(attachedSummary(res), '1 slot couldn’t be read.')
  assert.equal(attachedSummary({ stopped: false, lines: [], unread: 0, total: 4 }), 'Nothing is attached in this preset.')
  /* Another preset loaded mid-read stops it. */
  let calls = 0
  const stop = await readAttached({ model, blocks, readRaw: async () => ({ values: {} }), stillHere: () => calls++ < 2 })
  assert.equal(stop.stopped, true)
  /* On a tap, in both apps, inside the Modifiers panel. */
  assert.match(readSrc(new URL('../src/components/Modifiers.jsx', import.meta.url), 'utf8'), /<ModAttached model=\{model\} blocks=\{blocks\} \/>/)
  assert.match(readSrc(new URL('../mobile/src/screens/Edit.js', import.meta.url), 'utf8'), /<ModAttached model=\{model\} blocks=\{blocks\} \/>/)
  for (const f of ['../src/components/ModAttached.jsx', '../mobile/src/components/ModAttached.js']) {
    const src = readSrc(new URL(f, import.meta.url), 'utf8')
    assert.match(src, /'Show what’s attached'/, `${f} reads on opening rather than on a tap`)
    assert.match(src, /stillHere: \(\) => alive\.current &&/)
  }
})

test('the sign-up totals in Developer leave out the pairing accounts', async () => {
  const { PAIR_DOMAIN } = await import('../shared/pairing.mjs')
  const sql = readSrc(new URL('../supabase/migrations/20261001_overview_without_pairing.sql', import.meta.url), 'utf8')
  assert.ok(sql.includes(`not like '%@${PAIR_DOMAIN}'`), 'the totals count a pairing domain other than the app’s')
  for (const k of ['accounts', 'accounts_day', 'accounts_week']) assert.match(sql, new RegExp(`'${k}', \\(select count\\(\\*\\) from people`), `${k} counts every account again`)
  assert.match(sql, /grant execute on function public\.owner_overview\(\) to service_role/)
})

/*
 * "It saves it but doesn't register it immediately." A chain read already on
 * its way when the looper was placed was kept as the computer's copy, so the
 * gig screen showed the chain from before it until the preset changed.
 */
test('after a chain change or a save the phone reads the chain once more when the computer’s copy has run out, and the Mac carries the fixed server', () => {
  const rig = readSrc(new URL('../mobile/src/lib/rig.js', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.match(rig, /if \(asked && refresh\) refreshBlocks\(\{ quiet: true \}\) readOnceCopyRunsOut\(\) \}/, 'a chain write does not read again once the copy has run out')
  assert.match(rig, /export function savedToSlot\(slot\) \{ forgetChain\(slot\) \/\*[^*]*\*\/ if \(slot === state\.preset\?\.number\) readOnceCopyRunsOut\(\)/, 'a save does not read the chain again')
  assert.match(rig, /\}, CHAIN_FRESH_MS \+ 250\) \} /)
  assert.match(rig, /if \(state\.preset\?\.number !== number \|\| chainWrites \|\| presetBusy\(\)\) return/, 'the late read lands on another preset')
  const lock = JSON.parse(readSrc(new URL('../desktop/forgefx.lock.json', import.meta.url), 'utf8'))
  assert.match(lock.forgefx.tag, /\+gridgen(\+|$)/, 'the computer app carries the server that keeps a read from before a placement')
})

/*
 * "For some reason on the AM4, it's not reading the unit's tap tempo until you
 * actually hit the tap button." ForgeFX had no AM4 tempo at all: GET /tempo
 * answered 501. The server the Mac carries adds it on its own opt-in routes, so
 * nothing that already reads /tempo or caps.tempo sees a difference.
 */
test('the computer app carries the server with the AM4 tempo on its own routes', () => {
  const lock = JSON.parse(readSrc(new URL('../desktop/forgefx.lock.json', import.meta.url), 'utf8'))
  assert.match(lock.forgefx.tag, /\+am4tempo(\+|$)/, 'the computer app does not carry the AM4 tempo')
  // "Have it actually show the firmware version here" — /device answered null for an AM4.
  assert.match(lock.forgefx.tag, /\+am4fw(\+|$)/, 'the computer app does not read the AM4 firmware')
  assert.equal(lock.forgefx.branch, 'claude/am4-tempo')
  assert.match(lock.forgefx.commit, /^[0-9a-f]{40}$/, 'the pin is not a full commit')
})

/*
 * THE APPLE WATCH. "Maybe three different screens that you can swipe between
 * … just simple actions from the watch." The phone sends the whole picture;
 * the watch asks for one of five things, and anything else is dropped.
 */
test('the watch is sent the stage as one small picture, and may ask for only five things', async () => {
  const { watchState, watchCommand, sameWatchState, WATCH_PEDALS_MAX } = await import('../shared/watch-link.mjs')
  const fixture = JSON.parse(readSrc(new URL('../mobile/watch-ci/Tests/WatchModelTests/state.json', import.meta.url), 'utf8'))
  const again = watchState({ at: 1759363200000, linked: true, preset: { number: 12, name: 'Crunch Rhythm' }, label: '012', scene: 1,
    sceneNames: ['Clean', 'Crunch', 'Lead'], sceneCount: 8, canPrevious: true, canNext: false,
    pedals: [{ id: 50, name: 'Drive 1', short: 'DRV', on: true, fill: '#c0392b', ink: '#ffffff' }, { id: 70, name: 'Delay 1', short: 'DLY', on: false, fill: 'nope', ink: '#ffffff' }],
    tunerOn: true, tuning: { note: 'E', octave: 2, cents: -2.4 }, metronome: { on: true, bpm: 120 } })
  assert.deepEqual(again, fixture, 'the watch’s test fixture is not what the phone sends any more — write it again')

  /* Every field the phone sends is one the watch reads, by the same name. */
  const swift = readSrc(new URL('../mobile/targets/watch/Model.swift', import.meta.url), 'utf8')
  const fields = (o, out = new Set()) => {
    for (const [k, v] of Object.entries(o)) {
      out.add(k)
      if (v && typeof v === 'object' && !Array.isArray(v)) fields(v, out)
      if (Array.isArray(v) && v[0] && typeof v[0] === 'object') fields(v[0], out)
    }
    return out
  }
  for (const k of fields(fixture)) assert.match(swift, new RegExp(`\\bvar ${k}: `), `the watch does not read "${k}"`)

  /* Nothing missing is ever "undefined" on the watch. */
  const bare = watchState()
  assert.equal(bare.preset.number, -1)
  assert.equal(bare.scene, -1)
  assert.deepEqual(bare.scenes, [])
  assert.equal(bare.tuner.note, '')
  /* The tuner reads nothing while it is off, and clamps a wild reading. */
  assert.equal(watchState({ tunerOn: false, tuning: { note: 'A', cents: 3 } }).tuner.note, '')
  assert.equal(watchState({ tunerOn: true, tuning: { note: 'A', cents: 300 } }).tuner.cents, 50)
  assert.equal(watchState({ pedals: Array.from({ length: 30 }, (_, i) => ({ id: i, name: 'x' })) }).pedals.length, WATCH_PEDALS_MAX)

  /* The five requests, and only the ones the watch could have been shown. */
  const shown = watchState({ sceneCount: 4, pedals: [{ id: 50, name: 'Drive' }] })
  assert.deepEqual(watchCommand({ do: 'scene', index: 3 }, shown), { do: 'scene', index: 3 })
  assert.equal(watchCommand({ do: 'scene', index: 4 }, shown), null)
  assert.deepEqual(watchCommand({ do: 'pedal', id: 50, on: false }, shown), { do: 'pedal', id: 50, on: false })
  assert.equal(watchCommand({ do: 'pedal', id: 51, on: false }, shown), null, 'a pedal the watch was never shown was switched')
  assert.deepEqual(watchCommand({ do: 'preset', step: -1 }, shown), { do: 'preset', step: -1 })
  assert.equal(watchCommand({ do: 'preset', step: 5 }, shown), null)
  assert.deepEqual(watchCommand({ do: 'tuner', on: true }, shown), { do: 'tuner', on: true })
  assert.deepEqual(watchCommand({ do: 'hello' }, null), { do: 'hello' })
  for (const bad of [null, 'scene', { do: 'save' }, { do: 'select', number: 5 }, { do: 'tuner', on: 'yes' }]) assert.equal(watchCommand(bad, shown), null)

  /* The watch's own words for them are these same five. */
  for (const [msg] of [[{ do: 'hello' }], [{ do: 'scene', index: 2 }], [{ do: 'pedal', id: 50, on: false }], [{ do: 'preset', step: -1 }], [{ do: 'tuner', on: true }]]) {
    assert.ok(swift.includes(`"do":"${msg.do}"`), `the watch cannot ask for ${msg.do}`)
  }
  assert.equal(sameWatchState({ ...fixture, at: 1 }, { ...fixture, at: 2 }), true)
})

test('the phone sends the watch a tuner reading ten times a second and anything else four, and nothing twice', async () => {
  const { createWatchSender, watchState, WATCH_TUNER_MS, WATCH_STATE_MS } = await import('../shared/watch-link.mjs')
  let t = 0
  const timers = []
  const sent = []
  const sender = createWatchSender({
    send: (s, o) => sent.push({ s, urgent: o.urgent, at: t }),
    now: () => t,
    schedule: (fn, ms) => {
      const x = { fn, at: t + ms }
      timers.push(x)
      return x
    },
    cancel: (x) => {
      const i = timers.indexOf(x)
      if (i >= 0) timers.splice(i, 1)
    }
  })
  const turn = (ms) => {
    t += ms
    for (const x of [...timers]) if (x.at <= t) {
      timers.splice(timers.indexOf(x), 1)
      x.fn()
    }
  }
  const at = (cents, scene = 0) => watchState({ sceneCount: 8, scene, tunerOn: true, tuning: { note: 'E', cents } })
  sender.push(at(1))
  assert.equal(sent.length, 1, 'the first picture waits')
  sender.push(at(1))
  assert.equal(sent.length, 1, 'the same picture was sent twice')
  sender.push(at(2))
  sender.push(at(3))
  assert.equal(sent.length, 1)
  turn(WATCH_TUNER_MS)
  assert.equal(sent.length, 2)
  assert.equal(sent[1].s.tuner.cents, 3, 'an old reading was sent rather than the latest')
  assert.equal(sent[1].urgent, false, 'a tuner-only picture is kept as the phone’s lasting copy')
  sender.push(at(3, 2))
  turn(WATCH_TUNER_MS)
  assert.equal(sent.length, 2, 'a scene change went at the tuner’s pace')
  turn(WATCH_STATE_MS)
  assert.equal(sent.length, 3)
  assert.equal(sent[2].urgent, true)
  /* The watch opening asks for it now. */
  sender.flush(at(3, 2))
  assert.equal(sent.length, 4)
  sender.stop()
})

test('the stage screen keeps the watch, which is inert until the watch is built in, and CI builds and photographs the watch for free', () => {
  const stage = readSrc(new URL('../mobile/src/screens/Stage.js', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.match(stage, /useWatchBridge\( \{ preset, label:/)
  assert.match(stage, /chain: chainNow\.elsewhere \? \[\] : blocks,/, 'the watch is handed another preset’s pedals')
  assert.match(stage, /canPrevious: lastAt !== null, canNext: nextAt !== null \}, step \)/, 'the watch’s Previous and Next are not the stage screen’s')
  const bridge = readSrc(new URL('../mobile/src/lib/watchBridge.js', import.meta.url), 'utf8').replace(/\s+/g, ' ')
  assert.match(bridge, /requireOptionalNativeModule\('FractalWatch'\)/, 'a build without the watch would fail to start')
  assert.match(bridge, /const watch = link\(\) if \(!watch\) return undefined/)
  assert.match(bridge, /if \(cmd\.do === 'scene'\) return writeScene\(cmd\.index\) if \(cmd\.do === 'pedal'\) return writeBypass\(cmd\.id, !cmd\.on\) if \(cmd\.do === 'preset'\) return stepRef\.current\?\.\(cmd\.step\)/)
  /* Wake on tap: a tap that woke the phone rejoins the computer before it is
     sent, and the phone holds the app up long enough to send it. */
  assert.match(bridge, /AppState\.currentState !== 'active'/, 'a tap that woke a locked phone is sent into a sleeping connection')
  assert.match(bridge, /untilConnected\(\)/)
  /* The tuner mutes the unit: the watch never turns it on by being swiped to. */
  const pages = readSrc(new URL('../mobile/targets/watch/Pages.swift', import.meta.url), 'utf8')
  assert.match(pages, /\.onDisappear \{\s*if state\.tuner\.on \{ link\.send\(\.tuner\(on: false\)\) \}/)
  assert.ok(!/onAppear[^}]*tuner\(on: true\)/.test(pages), 'the tuner turns on by being swiped to')
  const wf = readSrc(new URL('../.github/workflows/watch.yml', import.meta.url), 'utf8')
  for (const step of ['swift test', 'xcodegen generate', '-sdk watchsimulator', 'screens.sh', 'watch-screens']) assert.ok(wf.includes(step), `the watch check has no ${step}`)
})

test('the iPhone build carries the watch app and the phone’s half of the link', () => {
  const app = JSON.parse(readSrc(new URL('../mobile/app.json', import.meta.url), 'utf8')).expo
  assert.ok(app.plugins.includes('@bacons/apple-targets'), 'the watch app is not built into the iPhone app')
  assert.equal(app.ios.appleTeamId, '3KA9RC7YE6', 'the watch app has no team to be signed for')
  const target = readSrc(new URL('../mobile/targets/watch/expo-target.config.js', import.meta.url), 'utf8')
  assert.match(target, /type: 'watch'/)
  assert.match(target, /bundleIdentifier: '\.watchkitapp'/, 'the watch app is not cloud.newbold.fractalremote.watchkitapp')
  /* The module the JavaScript asks for by name, and the two calls and one event it uses. */
  const mod = JSON.parse(readSrc(new URL('../mobile/modules/fractal-watch/expo-module.config.json', import.meta.url), 'utf8'))
  assert.deepEqual(mod.apple.modules, ['FractalWatchModule'])
  const swift = readSrc(new URL('../mobile/modules/fractal-watch/ios/FractalWatchModule.swift', import.meta.url), 'utf8')
  assert.match(swift, /Name\("FractalWatch"\)/)
  assert.match(swift, /beginBackgroundTask/, 'the phone is not kept awake long enough to send a watch tap')
  assert.match(swift, /OnStartObserving/, 'a tap that launched the app is dropped before anything listens')
  assert.match(swift, /Events\("onCommand"\)/)
  assert.match(swift, /Function\("sendState"\) \{ \(json: String, urgent: Bool\) in/)
  const bridge = readSrc(new URL('../mobile/src/lib/watchBridge.js', import.meta.url), 'utf8')
  assert.match(bridge, /watch\.sendState\(JSON\.stringify\(state\), urgent\)/)
  assert.match(bridge, /addListener\?\.\('onCommand'/)
  /* Both ends use the same key for a picture and for a request. */
  const watch = readSrc(new URL('../mobile/targets/watch/PhoneLink.swift', import.meta.url), 'utf8')
  assert.ok(swift.includes('["state": json]') && watch.includes('message["state"]'), 'the phone and the watch name the picture differently')
  assert.ok(watch.includes('["json": command.json]') && swift.includes('message["json"]'), 'the phone and the watch name a request differently')
  const wf = readSrc(new URL('../.github/workflows/watch.yml', import.meta.url), 'utf8')
  assert.match(wf, /npx expo prebuild -p ios --no-install/)
  assert.match(wf, /-scheme FractalRemote/)
})

test('a run of free cells in a lane is one gap, not a button per cell', async () => {
  const { laneItems, gapCols } = await import('../shared/grid-plan.mjs')
  const items = laneItems({ row: 0, blocks: [{ col: 0, name: 'Amp' }, { col: 4, name: 'Cab' }], gaps: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11] })
  assert.deepEqual(
    items.map((i) => (i.kind === 'gap' ? `gap${i.col}-${i.last}` : `block${i.col}`)),
    ['block0', 'gap1-3', 'block4', 'gap5-11']
  )
  assert.equal(gapCols(items[1]), '2–4')
  assert.equal(gapCols({ col: 6, last: 6 }), '7')
  const empty = laneItems({ row: 0, blocks: [], gaps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })
  assert.equal(empty.length, 1, 'an empty row is still twelve buttons')
})

/*
 * THE BROWSER TAKES A NEW VERSION ON ITS OWN — when it comes back to the
 * front, or after ten minutes untouched; never while something is being
 * typed, and never twice for the same version.
 */
test('a tab on an old version reloads itself at a quiet moment, never mid-typing or twice', () => {
  const src = readSrc(new URL('../src/components/UpdateNotice.jsx', import.meta.url), 'utf8')
  assert.match(src, /export const IDLE_RELOAD_MS = 10 \* 60 \* 1000/, 'the idle wait is not ten minutes')
  assert.match(src, /if \(typing\(\) \|\| triedFor\(stale\)\) return/, 'it can reload over a box being typed in, or try twice')
  assert.match(src, /markTried\(stale\)\s*\n\s*refresh\(\)/, 'it does not remember the version it tried')
  assert.match(src, /Date\.now\(\) - shownAt < FRONT_GRACE_MS\) go\(\)/, 'a version found on coming back to the front waits for the next time')
  for (const k of ['pointerdown', 'keydown', 'touchstart']) assert.ok(src.includes(`'${k}'`), `a ${k} does not count as somebody using the app`)
})

/*
 * COPY A SCENE, COPY A CHANNEL. "Build scene 2 starting from scene 1, instead
 * of switching every pedal by hand"; "copy one channel to another (A → B)".
 */
test('a scene copied onto another takes its on/off and channels, and the unit stays on the copy', async () => {
  const { copyScene, sceneCopyPlan } = await import('../shared/copy-tools.mjs')
  const scenes = [
    [{ effectId: 58, bypassed: false, channel: 'A' }, { effectId: 66, bypassed: true, channel: 'A' }, { effectId: 70, bypassed: false, channel: 'B' }],
    [{ effectId: 58, bypassed: false, channel: 'C' }, { effectId: 66, bypassed: false, channel: 'A' }, { effectId: 70, bypassed: false, channel: 'B' }]
  ]
  assert.deepEqual(sceneCopyPlan(scenes[0], scenes[1]), [{ effectId: 58, channel: 'A' }, { effectId: 66, bypassed: true }])
  let at = 0
  const sent = []
  const wire = {
    setScene: async (i) => void (at = i, sent.push(`scene ${i}`)),
    sceneState: async () => scenes[at].map((x) => ({ ...x })),
    setBypass: async (eid, b) => void (scenes[at].find((x) => x.effectId === eid).bypassed = b, sent.push(`bypass ${eid} ${b}`)),
    setChannel: async (eid, c) => void (scenes[at].find((x) => x.effectId === eid).channel = c, sent.push(`channel ${eid} ${c}`))
  }
  const res = await copyScene({ from: 0, to: 1, wire })
  assert.deepEqual(res, { ok: true, changed: 2 })
  assert.equal(at, 1, 'the unit was not left on the scene copied to')
  assert.deepEqual(scenes[1], scenes[0], 'scene 2 is not scene 1 after the copy')
  assert.deepEqual(sent.slice(0, 2), ['scene 0', 'scene 1'], 'the copy did not read the first scene before writing the second')
  assert.equal((await copyScene({ from: 2, to: 2, wire })).ok, false, 'a scene was copied onto itself')
  const broken = await copyScene({ from: 0, to: 1, wire: { ...wire, sceneState: async () => (at === 0 ? [{ effectId: 58, bypassed: true, channel: 'D' }] : scenes[1]), setChannel: async () => { throw new Error('link lost') } } })
  assert.equal(broken.ok, false)
  assert.match(broken.error, /link lost/)
})

test('a channel copied onto another takes the model first, then every knob and switch that differs', async () => {
  const { copyChannel, channelCopyPlan } = await import('../shared/copy-tools.mjs')
  const range = { min: 0, max: 10 }
  const ch = {
    A: { type: { value: 7, name: 'Plexi' }, named: [{ id: 1, value: 6.5, ...range }, { id: 2, value: 3, ...range }], enums: [{ id: 9, value: 1 }] },
    B: { type: { value: 3, name: 'Tweed' }, named: [{ id: 1, value: 2, ...range }, { id: 2, value: 3, ...range }], enums: [{ id: 9, value: 0 }] }
  }
  const plan = channelCopyPlan(ch.A, ch.B)
  assert.deepEqual(plan.type, { value: 7, name: 'Plexi' })
  assert.deepEqual(plan.knobs.map((k) => [k.id, k.value]), [[1, 6.5]], 'a knob that already matched was written, or one that did not was missed')
  assert.deepEqual(plan.switches, [{ id: 9, value: 1 }])
  let on = 'A'
  const sent = []
  const wire = {
    setChannel: async (eid, c) => void (on = c, sent.push(`channel ${c}`)),
    readBlock: async () => JSON.parse(JSON.stringify(ch[on])),
    /* A new model brings its defaults: knob 2 moves, and must be put back. */
    setType: async (eid, v) => void (ch[on].type = { value: v, name: 'Plexi' }, ch[on].named[1].value = 9, sent.push(`type ${v}`)),
    setParam: async (eid, id, v) => void (ch[on].named.find((p) => p.id === id).value = v, sent.push(`param ${id} ${v}`)),
    setEnum: async (eid, id, v) => void (ch[on].enums.find((e) => e.id === id).value = v, sent.push(`enum ${id} ${v}`))
  }
  const res = await copyChannel({ eid: 58, from: 'A', to: 'B', wire })
  assert.equal(res.ok, true, res.error)
  assert.equal(on, 'B', 'the block was not left on the channel copied to')
  assert.deepEqual(ch.B, ch.A, 'channel B is not channel A after the copy')
  assert.ok(sent.indexOf('type 7') < sent.findIndex((x) => x.startsWith('param')), 'the knobs went before the model, which then reset them')
  assert.ok(sent.includes('param 2 3'), 'a knob the new model reset was not put back')
  assert.equal((await copyChannel({ eid: 58, from: 'A', to: 'A', wire })).ok, false)
})

await settle()
/*
 * The tally has to say when it is red.
 *
 * It used to print "141 passed" and nothing else, with the FAIL lines scrolled
 * off above it — so the last line of a failing run read exactly like the last
 * line of a passing one. The exit code was right the whole time; the summary
 * was the part a person actually looks at.
 */
console.log(
  process.exitCode ? `\n${passed} passed, ${failed} FAILED\n` : `\n${passed} passed\n`
)
