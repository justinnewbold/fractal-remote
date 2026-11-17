/**
 * THE METRONOME LINED UP: the light and the click nudged by hand or by
 * tapping along (mobile/src/lib/lineUp.js, lib/metronome.js,
 * components/LineUp.js), the beat's frame inside the glass's curve
 * (lib/screenCorners.js beatFrame), and where the phone's beats fall, for
 * the watch (shared/watch-link.mjs WHERE THE BEATS FALL, lib/watchBridge).
 *
 * "Can we set the watch to do the tap and the outside edge independently
 * from the phone? I got it working, but also the light on the phone cuts
 * off on the corners. Also, the watch is not in sync with the phone with
 * the flashes and the taps and the sound. ... Will you make sure
 * everything's in sync properly somehow or have a way for a user to
 * calibrate" (Justin, 16 November 2026).
 *
 * The rules are run here; the real beat, with the nudges and Tap along on
 * it, runs on the click bench in test/mobile.mjs.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const read = (p) => readFileSync(repo(p), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

/** A rule file that imports nothing, run from a copy. */
async function standalone(path) {
  const dir = mkdtempSync(join(tmpdir(), 'line-up-'))
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

/*
 * THE GLASS'S CORNER, AND THE FRAME'S. An iPhone's screen, and a view with
 * borderCurve 'continuous', are Apple's continuous corner: for radius r, a
 * straight edge that starts to bend 1.53 r from the corner, through three
 * curves. These are PaintCode's reading of UIBezierPath's own (iOS 7 and
 * later), in units of r: (distance from the side edge, distance from the
 * top edge), from the top edge round to the side. Android draws a circle.
 */
const CONTINUOUS = [
  [[1.52866471, 0], [1.08849323, 0], [0.86840689, 0], [0.66993427, 0.065496]],
  [[0.66993427, 0.065496], [0.66993427, 0.065496], [0.63149399, 0.074911], [0.63149399, 0.074911]],
  [[0.63149399, 0.074911], [0.37282392, 0.16905899], [0.16905899, 0.37282392], [0.074911, 0.63149399]],
  [[0.074911, 0.63149399], [0.074911, 0.63149399], [0.065496, 0.66993427], [0.065496, 0.66993427]],
  [[0.065496, 0.66993427], [0, 0.86840689], [0, 1.08849323], [0, 1.52866471]]
]
function unitCorner(kind, n = 120) {
  if (kind === 'circle') return Array.from({ length: 4 * n + 1 }, (_, i) => [1 - Math.sin((i / (4 * n)) * (Math.PI / 2)), 1 - Math.cos((i / (4 * n)) * (Math.PI / 2))])
  const pts = []
  for (const [p0, p1, p2, p3] of CONTINUOUS) {
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const u = 1 - t
      pts.push([0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]))
    }
  }
  return pts
}
/** A corner's edge in points, `inset` in from both edges, `r` round: the curve, with the two straight edges out past it. */
function cornerEdge(kind, r, inset) {
  const reach = 200
  if (!(r > 0)) return [[reach, inset], [inset, inset], [inset, reach]]
  const curve = unitCorner(kind).map(([x, y]) => [inset + r * x, inset + r * y])
  return [[reach, inset], ...curve, [inset, reach]]
}
/** How deep the edge is at `x` from the side: where a point at `x` has to be below to be on the screen. */
function depthAt(edge, x) {
  if (x < edge.at(-1)[0]) return Infinity
  for (let i = 1; i < edge.length; i++) {
    const [x0, y0] = edge[i - 1]
    const [x1, y1] = edge[i]
    if (x <= x0 && x >= x1) return x0 === x1 ? Math.min(y0, y1) : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  }
  return edge[0][1]
}
/** How far the frame's corner sits inside the glass's, along the corner's diagonal, in points. */
function cornerGap(glass, frame) {
  const apex = (edge) => edge.reduce((best, [x, y]) => (Math.abs(x - y) < Math.abs(best[0] - best[1]) ? [x, y] : best))
  return Math.hypot(...apex(frame)) - Math.hypot(...apex(glass))
}
/** The least distance from the frame's outside edge to the glass's, in points: plus where the frame is all inside, minus where any of it is cut off. */
function clearance(glass, frame) {
  let least = Infinity
  for (const [x, y] of frame) {
    let d = Infinity
    for (let i = 1; i < glass.length; i++) {
      const [ax, ay] = glass[i - 1]
      const [bx, by] = glass[i]
      const vx = bx - ax
      const vy = by - ay
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1)))
      d = Math.min(d, Math.hypot(x - (ax + t * vx), y - (ay + t * vy)))
    }
    least = Math.min(least, y >= depthAt(glass, x) - 1e-9 ? d : -d)
  }
  return least
}

export function run(test) {
  test('line up: a nudge is whole steps of 10 ms within 200 either way, kept on the device, said in his words, and his account’s until its switch', async () => {
    const r = await standalone('mobile/src/lib/lineUp.js')
    assert.deepEqual({ ...r.LINE_UP }, { min: -200, max: 200, step: 10 })
    assert.equal(r.lineUpNudge(20), 20)
    assert.equal(r.lineUpNudge(24), 20)
    assert.equal(r.lineUpNudge(25), 30)
    assert.equal(r.lineUpNudge(-36), -40)
    assert.equal(r.lineUpNudge(1000), 200)
    assert.equal(r.lineUpNudge(-1000), -200)
    assert.equal(r.lineUpNudge('nonsense'), 0)
    assert.ok(Object.is(r.lineUpNudge(-4), 0), 'a nudge of minus nought is kept, and reads "-0 ms"')
    /* Kept on the device, none until one is moved. */
    for (const raw of [null, undefined, '', 'nonsense']) assert.equal(r.lineUpKept(raw), 0)
    assert.equal(r.lineUpKept(r.lineUpToKeep(-30)), -30)
    assert.equal(r.lineUpKept('999'), 200)
    assert.deepEqual(Object.keys(r.LINE_UP_KEYS), ['light', 'click', 'watch'])
    for (const key of Object.values(r.LINE_UP_KEYS)) assert.match(key, /^fractal\.metronome\./)
    assert.equal(new Set(Object.values(r.LINE_UP_KEYS)).size, 3)
    /* In his words. */
    assert.equal(r.lineUpWords(20), '20 ms later')
    assert.equal(r.lineUpWords(-30), '30 ms earlier')
    assert.equal(r.lineUpWords(0), 'Not moved')
    /* His account until the switch; the switch is off. */
    assert.equal(r.lineUpOpen({ admin: true }), true)
    assert.equal(r.lineUpOpen({ admin: false, everyone: false }), false)
    assert.equal(r.lineUpOpen({ everyone: true }), true)
    assert.equal(r.lineUpOpen({ admin: 'yes' }), false)
    assert.match(read('mobile/src/lib/features.js'), /^export const METRONOME_LINE_UP_FOR_EVERYONE = false$/m, 'the line-up is open to every account before he has said so')
    /* Opened to everyone, the beat lock has to be too: without it nobody else's beat is ever held on the unit's, and Tap along is offered to nobody. */
    {
      const features = read('mobile/src/lib/features.js')
      const on = (name) => new RegExp(`^export const ${name} = true$`, 'm').test(features)
      if (on('METRONOME_LINE_UP_FOR_EVERYONE')) assert.ok(on('BEAT_LOCK_FOR_EVERYONE'), 'the line-up is open to everyone and the beat lock is not')
    }
    const metronome = flat(read('mobile/src/lib/metronome.js'))
    assert.equal((metronome.match(/lineUpOpen\(\{ admin: useBluetoothAdmin\(\), everyone: METRONOME_LINE_UP_FOR_EVERYONE \}\)/g) || []).length, 2, 'the beat and the page ask different questions of who is offered it')
    assert.match(metronome, /const times = \(\) => lineUpTimes\(\{ sound, lead: lead\(\), light: lining \? lined\.light : 0, click: lining \? lined\.click : 0 \}\)/, 'the nudges are applied for an account not offered them')
  })

  test('line up: each nudge moves exactly its own: the light the light, the click the click and the tap felt with it; nothing moved is every beat as it was', async () => {
    const r = await standalone('mobile/src/lib/lineUp.js')
    /* Nothing moved: the click at the beat, the tap and the light when it is heard, as before there were nudges, and nothing run early. */
    assert.deepEqual(r.lineUpTimes({ sound: true, lead: 40 }), { clickAt: 0, tapAt: 40, lightAt: 40, early: 0 })
    assert.deepEqual(r.lineUpTimes({ sound: false, lead: 40 }), { clickAt: null, tapAt: null, lightAt: 0, early: 0 }, 'a beat in silence waits for a sound it does not make, or taps')
    /* The light alone. */
    assert.deepEqual(r.lineUpTimes({ sound: true, lead: 40, light: 30 }), { clickAt: 0, tapAt: 40, lightAt: 70, early: 0 })
    /* The click alone, and its tap with it. */
    assert.deepEqual(r.lineUpTimes({ sound: true, lead: 40, click: 30 }), { clickAt: 30, tapAt: 70, lightAt: 40, early: 0 })
    /* Earlier than the beat: the beat's code runs that much before, so nothing is booked in the past. */
    assert.deepEqual(r.lineUpTimes({ sound: true, lead: 40, click: -50 }), { clickAt: -50, tapAt: -10, lightAt: 40, early: 50 })
    assert.deepEqual(r.lineUpTimes({ sound: true, lead: 40, light: -100 }), { clickAt: 0, tapAt: 40, lightAt: -60, early: 60 })
    assert.deepEqual(r.lineUpTimes({ sound: false, light: -100, click: -200 }), { clickAt: null, tapAt: null, lightAt: -100, early: 100 }, 'the click’s nudge moves a beat that has no click')
    /* Kept to range whatever is handed in. */
    assert.equal(r.lineUpTimes({ sound: true, click: -5000 }).early, 200)
  })

  test('tap along: the middle of the taps, one far out dropped, set only when steady, and said in his words', async () => {
    const r = await standalone('mobile/src/lib/lineUp.js')
    assert.deepEqual({ ...r.TAP_ALONG }, { least: 8, most: 16, wide: 60, steady: 25, kept: 0.75 })
    /* Held against the nearest beat, in the half beat either side. */
    assert.equal(r.offBeat(1030, 1000, 500), 30)
    assert.equal(r.offBeat(1480, 1000, 500), -20)
    assert.equal(r.offBeat(-470, 1000, 500), 30)
    assert.equal(r.offBeat(1000, 1000, 0), null)
    assert.equal(r.samePhase(1000, 3000.4, 500), true)
    assert.equal(r.samePhase(1000, 3003, 500), false)
    assert.equal(r.samePhase(1000, 1499.5, 500), true, 'a beat apart is not the same beat')
    /* Steady, with one tap far out: dropped, and the middle is what is set. */
    const taps = [28, 31, 35, 26, 33, 29, 30, 34, 160, 27]
    const steady = r.tapAlong(taps)
    assert.equal(steady.steady, true)
    assert.equal(steady.ms, 30)
    assert.equal(steady.dropped, 1, 'the late tap is not dropped')
    assert.equal(steady.kept, 9)
    /* The middle, not the average: the far tap would pull an average 13 ms later. */
    assert.equal(r.tapAlong([-42, -38, -40, -45, -37, -41, -39, -44]).ms, -40)
    /* Too few. */
    assert.equal(r.tapAlong(taps.slice(0, 7)).why, 'few')
    assert.equal(r.tapAlong(taps.slice(0, 7)).ms, null)
    /* Too spread out. */
    const uneven = r.tapAlong([-50, 40, -10, 55, -45, 20, 0, -30, 45, -55])
    assert.equal(uneven.steady, false)
    assert.equal(uneven.why, 'uneven')
    assert.equal(uneven.ms, null, 'an uneven run sets something')
    /* Too many dropped, however close the rest. */
    assert.equal(r.tapAlong([30, 31, 29, 30, 30, 31, 29, 30, 200, -200, 240, -150]).why, 'uneven')
    /* Further than a nudge can move. */
    assert.equal(r.tapAlong([230, 231, 229, 232, 228, 230, 231, 229]).why, 'far')
    assert.equal(r.tapAlong(['x', NaN, null]).why, 'few')
    /* Offered only beside a click from the unit, with the device keeping its own beat to hold the taps against, and that beat held on the unit's. */
    const ok = { on: true, where: 'unit', can: true, quiet: false, running: true, held: true, noun: 'iPad' }
    assert.deepEqual(r.tapAlongHere(ok), { offered: true, why: null })
    assert.equal(r.tapAlongHere({ ...ok, where: 'both' }).offered, true)
    for (const [no, said] of [
      [{ can: false }, /can’t switch/],
      [{ where: 'phone' }, /pick Unit or Both/],
      [{ quiet: true }, /pick Unit or Both/],
      [{ on: false }, /Switch the metronome on/],
      [{ running: false }, /this iPad’s click keeping time/],
      /* Not held on the unit's beat: a nudge measured there is one start's gap, wrong by the next (lib/lineUp tapAlongHere). Through a computer, the only place it is asked: the cause that is so, in his words. */
      [{ held: false }, /^Still finding where the unit’s beat falls, so Tap along waits\.$/],
      [{ held: undefined }, /^Still finding where the unit’s beat falls/],
      [{ held: false, why: 'old' }, /^Update the computer app to tap along: this one doesn’t say where the unit’s beat falls\.$/],
      [{ held: false, why: 'none' }, /^Switch Send Realtime Sysex on at the unit to tap along: Setup → MIDI\/Remote\.$/],
      [{ held: false, why: 'stale' }, /^The unit has stopped sending its beat, so there is nothing to tap along to\.$/],
      [{ held: false, why: 'tempo' }, /^The unit’s beat is at another tempo than this iPad’s, so Tap along waits until they match\.$/],
      [{ held: false, why: 'slow' }, /^The connection to the computer is too slow to place the unit’s beat, so Tap along can’t be used\.$/],
      [{ held: false, why: 'failed' }, /^The computer isn’t answering about the unit’s beat, so Tap along waits\.$/],
      [{ held: false, why: 'bad' }, /^The computer isn’t answering about the unit’s beat, so Tap along waits\.$/],
      [{ held: false, why: 'off' }, /^Tap along needs this iPad to follow the unit’s beat, and it doesn’t here\.$/],
      /* A why the follower never gives: still finding, never another cause's words. */
      ...['old', 'none', 'stale', 'tempo', 'slow', 'failed', 'off'].map((why) => [{ held: false, why: `${why}x` }, /^Still finding/])
    ]) {
      const here = r.tapAlongHere({ ...ok, ...no })
      assert.equal(here.offered, false, JSON.stringify(no))
      assert.match(here.why, said)
    }
    for (const why of [null, 'old', 'none', 'stale', 'tempo', 'slow', 'failed', 'bad', 'off']) assert.deepEqual(r.tapAlongHere({ ...ok, why }), { offered: true, why: null }, `held on the unit’s beat and not offered (${why})`)
    /* Only the old computer app is told to update; only a unit sending no beat is told to switch Send Realtime Sysex on. */
    for (const why of [null, 'none', 'stale', 'tempo', 'slow', 'failed', 'bad', 'off']) assert.doesNotMatch(r.tapAlongClosedWords(why, 'iPad'), /Update|update/, `told to update a computer app that answers (${why})`)
    for (const why of [null, 'old', 'stale', 'tempo', 'slow', 'failed', 'bad', 'off']) assert.doesNotMatch(r.tapAlongClosedWords(why, 'iPad'), /Realtime Sysex/, `told to switch Send Realtime Sysex on (${why})`)
    /* The words. */
    assert.equal(r.tapAlongWords(steady, 'iPad'), 'Your taps came 30 ms after this iPad’s beat, so the light and the click are now 30 ms later.')
    assert.equal(r.tapAlongWords({ steady: true, ms: -40 }, 'tablet'), 'Your taps came 40 ms before this tablet’s beat, so the light and the click are now 40 ms earlier.')
    assert.match(r.tapAlongWords({ steady: true, ms: 0 }, 'phone'), /set to not moved\.$/)
    assert.match(r.tapAlongWords(uneven), /^Your taps were too uneven to go by, so nothing was changed\./)
    assert.match(r.tapAlongWords({ why: 'few' }), /at least 8 times/)
    assert.match(r.tapAlongWords({ why: 'far' }, 'phone'), /more than 200 ms/)
    /* A run whose beat moved or left the unit's (lib/metronome finishTapAlong): nothing set, and tap again. */
    assert.equal(r.tapAlongWords({ steady: false, ms: null, why: 'moved' }, 'iPad'), 'This iPad’s beat moved or lost the unit’s while you tapped, so nothing was set. Tap along again.')
    /* And the hint says what a nudge does with a beat from the unit to follow, and without one. */
    assert.match(r.LINE_UP_WORDS.hint('iPad'), / Nothing here changes the unit\. A nudge lines them up while this iPad is following the unit’s beat; where it has no beat from the unit to follow, the light keeps the tempo and starts wherever it falls, and a nudge just moves it that much\.$/)
    assert.doesNotMatch(r.LINE_UP_WORDS.hint('iPad'), /in step/i)
    const said = [
      ...Object.values(r.LINE_UP_WORDS).map((w) => (typeof w === 'function' ? w('iPad') : w)),
      ...[steady, uneven, { why: 'few' }, { why: 'far' }, { why: 'moved' }, { steady: true, ms: 0 }].map((x) => r.tapAlongWords(x, 'iPad')),
      ...[{ can: false }, { where: 'phone' }, { on: false }, { running: false }, { held: false }].map((no) => r.tapAlongHere({ ...ok, ...no }).why),
      ...[null, 'old', 'none', 'stale', 'tempo', 'slow', 'failed', 'bad', 'off'].map((why) => r.tapAlongClosedWords(why, 'iPad'))
    ].join(' ')
    assert.doesNotMatch(said, /this phone|your phone|\bbeta\b|\btried\b|\btested\b|official|\bsoon\b|coming|calibrat/i)
    assert.doesNotMatch(read('mobile/src/lib/lineUp.js').replace(/\/\*[\s\S]*?\*\//g, ''), /this phone/i)
  })

  test('the beat’s frame: in from the edge, and rounder than a measured glass, so its corners sit wholly inside the visible curve on every listed size, still inside a glass a fifth rounder, and no more than a few points inside the screen’s corner', async () => {
    /*
     * "Also the light on the phone cuts off on the corners" (Justin, 16
     * November 2026, an iPhone 17 Pro Max, 440 × 956). The frame's outside
     * edge was the glass's own: nothing to spare. Worked out here on the
     * curves themselves, not on the numbers.
     */
    const { beatFrame, cornerRadius, glassCorner, BEAT_INSET, BEAT_LINE, BEAT_CLEAR, BEAT_ROUNDER, BEAT_CORNER } = await import('../mobile/src/lib/screenCorners.js')
    assert.equal(BEAT_CORNER, 8)
    assert.equal(BEAT_LINE, 4)
    assert.ok(BEAT_INSET >= 2 && BEAT_INSET <= 3, 'the frame is not "a couple of points" in from the edge')
    assert.ok(BEAT_ROUNDER > 1, 'the frame is no rounder than the glass')
    /* His phone. */
    const his = { os: 'ios', width: 440, height: 956, top: 62, bottom: 34 }
    assert.equal(cornerRadius(his), 62)
    assert.deepEqual(beatFrame(his), { inset: BEAT_INSET, radius: 72, line: 4 })
    /* Every size the file lists, read from the file itself, and the ones it works out: Display Zoom, an iPhone not listed yet, an iPad, and Android's. */
    const listed = [...read('mobile/src/lib/screenCorners.js').matchAll(/'(\d+)x(\d+)': [\d.]+/g)].map((m) => ({ os: 'ios', width: Number(m[1]), height: Number(m[2]), top: 59, bottom: 34 }))
    assert.ok(listed.length >= 10, `only ${listed.length} sizes were read from the table`)
    const screens = [
      ...listed,
      { os: 'ios', width: 375, height: 812, top: 53, bottom: 34, why: 'Display Zoom' },
      { os: 'ios', width: 812, height: 375, top: 0, left: 53, right: 53, bottom: 21, why: 'Display Zoom on its side' },
      { os: 'ios', width: 375, height: 812, top: 44, bottom: 34, why: 'an X' },
      { os: 'ios', width: 812, height: 375, top: 0, left: 44, right: 44, bottom: 21, why: 'an X on its side' },
      { os: 'ios', width: 812, height: 375, top: 0, left: 50, right: 50, bottom: 21, why: 'a 13 mini on its side' },
      { os: 'ios', width: 999, height: 2000, top: 62, bottom: 34, why: 'an iPhone not listed yet' },
      { os: 'ios', width: 1024, height: 1366, top: 24, bottom: 20, pad: true, why: 'an iPad' },
      ...[360, 393, 411, 448, 800].map((width) => ({ os: 'android', width, height: 2 * width, top: 24, bottom: 24, why: 'Android' }))
    ]
    for (const s of screens) {
      const name = `${s.why || 'iPhone'} ${s.width} × ${s.height}`
      const glassR = cornerRadius(s)
      const frame = beatFrame(s)
      assert.ok(glassR > 0, `${name}: no corner`)
      /* Android draws a circle whatever borderCurve says; an iPhone, Apple's curve. */
      const kind = s.os === 'android' ? 'circle' : 'continuous'
      const glass = cornerEdge(kind, glassR, 0)
      const outside = cornerEdge(kind, frame.radius, frame.inset)
      const clear = clearance(glass, outside)
      assert.ok(clear >= BEAT_CLEAR, `${name}: the frame’s corner is ${clear.toFixed(2)} pt inside the glass, under ${BEAT_CLEAR}`)
      const { measured } = glassCorner(s)
      /* And with the frame drawn as a plain circle, should a phone ignore borderCurve: still inside, by BEAT_CLEAR on a measured glass and by a point on a guess, which is rounder than the glass already. */
      const asCircle = clearance(glass, cornerEdge('circle', frame.radius, frame.inset))
      assert.ok(asCircle >= (measured ? BEAT_CLEAR : 1), `${name}: a frame drawn as a circle is cut off (${asCircle.toFixed(2)} pt)`)
      if (measured) {
        /* ERRS ROUND: a measured corner, still all on the screen if the glass is a fifth rounder than the table says. */
        const rounder = clearance(cornerEdge(kind, glassR * 1.2, 0), outside)
        assert.ok(rounder >= 0.5, `${name}: a glass a fifth rounder than the table cuts the frame’s corner (${rounder.toFixed(2)} pt)`)
      } else {
        /* A guess already errs round, and is not rounded again: the frame is the guess moved in, its corner as far in as its sides and no further. */
        assert.equal(frame.radius, Math.ceil(glassR), `${name}: a guessed corner rounded again`)
      }
      /* The line is a line all the way round: its inside edge still curves. */
      assert.ok(frame.radius - frame.line > 0, `${name}: the frame’s inside corner is square`)
      /* And the price, a sliver of dark at the corner, is a few points at most: BEAT_CORNER. */
      const sliver = cornerGap(glass, outside)
      assert.ok(sliver > 0 && sliver <= BEAT_CORNER, `${name}: ${sliver.toFixed(1)} pt of dark at the corner`)
      if (!measured) assert.ok(sliver <= BEAT_INSET * Math.SQRT2 + 0.1, `${name}: a guessed corner sits ${sliver.toFixed(1)} pt in, further than its sides`)
      /* The frame that was drawn before, to the edge with the glass's own curve: nothing to spare, which this check sees. */
      assert.ok(clearance(glass, cornerEdge(kind, glassR, 0)) < BEAT_CLEAR, `${name}: the check cannot tell the old frame from the new`)
    }
    /*
     * An X on its side is an X, not a big phone zoomed (Display Zoom is read
     * from the notch's inset, which is on the left and right then); and on
     * its real glass, 39, the corner is no further in than BEAT_CORNER. Read
     * as zoomed and rounded again, it was 14 points in.
     */
    const sideways = { os: 'ios', width: 812, height: 375, top: 0, left: 44, right: 44, bottom: 21 }
    assert.equal(cornerRadius(sideways), 44)
    assert.equal(cornerRadius({ ...sideways, left: 53, right: 53 }), 58)
    assert.ok(cornerGap(cornerEdge('continuous', 39, 0), cornerEdge('continuous', beatFrame(sideways).radius, BEAT_INSET)) <= BEAT_CORNER)
    /* And Android's guess, on the glass the file names (a Pixel 8 Pro, 30, at 412 wide): no further in than the guess itself puts it, plus the inset. */
    const pixel = { os: 'android', width: 412, height: 892, top: 24, bottom: 24 }
    const guessGap = cornerGap(cornerEdge('circle', 30, 0), cornerEdge('circle', cornerRadius(pixel), 0))
    assert.ok(cornerGap(cornerEdge('circle', 30, 0), cornerEdge('circle', beatFrame(pixel).radius, BEAT_INSET)) <= guessGap + BEAT_INSET * Math.SQRT2 + 0.1)
    /* A square screen gets a square frame, in from the edges all the same. */
    assert.deepEqual(beatFrame({ os: 'ios', width: 375, height: 667, top: 20, bottom: 0 }), { inset: BEAT_INSET, radius: 0, line: 4 })
    /* And it is what the beat draws (test/mobile.mjs holds the drawing to it). */
    assert.match(flat(read('mobile/src/components/MetronomeBeat.js')), /const \{ top, bottom, left, right \} = useSafeAreaInsets\(\) const frame = beatFrame\(\{ os: Platform\.OS, width, height, top, bottom, left, right, pad: Platform\.isPad \}\)/)
  })

  test('where the beats fall, for the watch: { at, bpm, nudge } in the metronome, only to a watch that knows `beat`, only while on, and a move of nothing sends nothing', async () => {
    const link = await import('../shared/watch-link.mjs')
    /* No watch out today says it: the list the 2.0.0 build's hello says word for word is unchanged, and `beat` is only listened for. */
    assert.deepEqual(link.WATCH_KNOWS, ['pages', 'tempo', 'stay', 'here', 'quick'])
    assert.deepEqual(link.WATCH_KNOWS_NEXT, ['beat'])
    assert.deepEqual(link.watchKnows(['beat', 'pages', 'x']), ['pages', 'beat'])
    const patch = read('docs/pending/watch-page-order.patch')
    const helloes = [...(read('mobile/targets/watch/Model.swift') + patch).matchAll(/"do":"hello"[^}]*\}/g)].map((m) => m[0])
    assert.ok(helloes.length > 0)
    for (const hello of helloes) assert.doesNotMatch(hello, /beat/, 'a watch out today says it knows `beat`, and would be sent what it cannot read')
    /*
     * And were it sent to them, both read the metronome with Swift's own
     * decoder, which passes over a key it does not know, into a two-field
     * WatchMetronome whose == is those two: so `.onChange(of: metronome)`
     * would not fire for it either.
     */
    /*
     * The store copies' Model.swift, and the 2.0.0 build's: main's with the
     * waiting patch put in, as the build was. The check runs the tests a
     * second time with every waiting patch already in (PENDING_APPLIED):
     * there the tree's file IS the build's, and the store copies' is that
     * with the patch taken back out.
     */
    const applied = Boolean(process.env.PENDING_APPLIED)
    const built = mkdtempSync(join(tmpdir(), 'line-up-watch-'))
    let other
    try {
      mkdirSync(join(built, 'mobile/targets/watch'), { recursive: true })
      writeFileSync(join(built, 'mobile/targets/watch/Model.swift'), read('mobile/targets/watch/Model.swift'))
      execFileSync('git', ['apply', ...(applied ? ['--reverse'] : []), '--include=mobile/targets/watch/Model.swift', repo('docs/pending/watch-page-order.patch')], { cwd: built, stdio: 'pipe' })
      other = readFileSync(join(built, 'mobile/targets/watch/Model.swift'), 'utf8')
    } finally {
      rmSync(built, { recursive: true, force: true })
    }
    assert.notEqual(other, read('mobile/targets/watch/Model.swift'), applied ? 'the patch was not taken back out' : 'the patch was not put in')
    for (const swift of [read('mobile/targets/watch/Model.swift'), other]) {
      assert.match(swift, /struct WatchMetronome: Codable, Equatable \{\s*var on: Bool\s*var bpm: Double\s*\}/)
      assert.match(swift, /try\? JSONDecoder\(\)\.decode\(WatchState\.self, from: data\)/)
      assert.doesNotMatch(swift, /init\(from decoder/, 'a watch reads the picture with its own decoder, which may refuse a key it does not know')
    }

    /* The contract, made safe. */
    assert.deepEqual(link.beatForWatch({ at: 1763300000123.6, bpm: 120.00049, nudge: 27 }), { at: 1763300000124, bpm: 120, nudge: 30 })
    assert.deepEqual(link.beatForWatch({ at: 5, bpm: 97.4567 }), { at: 5, bpm: 97.457, nudge: 0 })
    assert.equal(link.beatForWatch({ at: 5, bpm: 500 }), null)
    assert.equal(link.beatForWatch({ at: NaN, bpm: 120 }), null)
    assert.equal(link.beatForWatch(null), null)
    assert.equal(link.beatForWatch({ at: 5, bpm: 120, nudge: -900 }).nudge, -200)
    /* In the picture's metronome, only while the wrist's metronome is on; and with no beat given, the metronome is field for field what it was. */
    const beat = { at: 1763300000000, bpm: 120, nudge: 0 }
    const on = { metronome: { on: true, bpm: 120 }, at: 1 }
    assert.deepEqual(link.watchState({ ...on, beat }).metronome, { on: true, bpm: 120, beat })
    assert.deepEqual(link.watchState({ ...on, beat: null }).metronome, { on: true, bpm: 120 })
    assert.deepEqual(link.watchState({ metronome: { on: false, bpm: 120 }, beat, at: 1 }).metronome, { on: false, bpm: 0 }, 'where the beats fall is sent with the wrist’s metronome off')
    /* The sender: the same beat again sends nothing, a moved one goes. */
    const sent = []
    const sender = link.createWatchSender({ send: (s) => sent.push(s), now: () => 0, schedule: () => 1, cancel: () => {} })
    sender.push(link.watchState({ ...on, beat }))
    sender.push(link.watchState({ ...on, beat: { ...beat }, at: 2 }))
    assert.equal(sent.length, 1, 'the same beat woke the watch again')
    /* And to a watch that does not know it (beat null), a moved beat is the same picture: nothing goes. */
    assert.ok(link.sameWatchState(link.watchState({ ...on, beat: null }), link.watchState({ ...on, beat: null, at: 9 })))

    /* The bridge: the beat only for a watch that knows it, a new picture when it moves, and the contract written where it is sent. */
    const bridge = read('mobile/src/lib/watchBridge.js')
    assert.match(bridge, /beat: watchKnowsBeat\(\) \? from\.beat : null \}\)/, 'the beat is sent to a watch that has not said it knows it')
    assert.match(flat(bridge), /const unbeat = onPhoneBeatMoved\(\(\) => \{ if \(!lastFrom\.current \|\| !sender\.current\) return lastFrom\.current = \{ \.\.\.lastFrom\.current, beat: phoneBeat\(\) \} last\.current = pictured\(lastFrom\.current\) sender\.current\.push\(last\.current\) \}\)/)
    assert.match(flat(bridge), /onQuickChange\(null\) unbeat\(\)/, 'the bridge goes on listening for the beat after Play has gone')
    /* And Play's own redraw carries it, or every redraw drops it from a watch that knows it until the beat next moves. */
    assert.match(flat(bridge), /lastFrom\.current = \{ \.\.\.rest, pedals, metronome: \{ on: beat\.on && beat\.watch, bpm: getState\(\)\.bpm \}, beat: phoneBeat\(\), tempo,/, 'Play’s redraw does not carry where the beats fall')
    assert.match(bridge, /metronome\.beat = \{ at, bpm, nudge \}/)
    assert.match(read('shared/watch-link.mjs'), /metronome\.beat = \{ at, bpm, nudge \}[\s\S]*Milliseconds since 1 January 1970 UTC on the[\s*]+PHONE'S clock \(Date\.now\(\)\)/)
    assert.match(code(read('mobile/src/lib/watchPages.js')), /export const watchKnowsBeat = \(\) => knows\.includes\('beat'\)/)
    /* The watch's nudge is kept and sent, and drawn nowhere until a watch build reads it. */
    assert.doesNotMatch(code(read('mobile/src/components/LineUp.js')), /watch/i, 'the watch’s nudge is drawn before any watch reads it')
  })

  test('line up on Settings → Metronome: drawn for an account offered it, the two nudges and Reset, and Tap along with a pad that takes the touch as it lands', async () => {
    const b = await lineUpBench()
    /* Not offered: nothing. */
    b.world.lined = { offered: false, light: 30, click: 0, watch: 0 }
    assert.equal(b.draw(), null, 'the line-up is drawn for an account it is not offered to')
    /* Offered, nothing moved: both rows, no Reset, and why Tap along is not offered (the metronome is off). */
    b.world.lined = { offered: true, light: 0, click: 0, watch: 0 }
    let d = b.draw()
    assert.ok(d.words.includes('LINE UP THE LIGHT AND CLICK') || d.words.includes('Line up the light and click'))
    assert.ok(d.words.includes('The light: Not moved'), JSON.stringify(d.words))
    assert.ok(d.words.includes('This phone’s click: Not moved'), JSON.stringify(d.words))
    assert.equal(d.button('Reset'), null, 'Reset is drawn with nothing to reset')
    assert.equal(d.button('Tap along'), null, 'Tap along is offered with the metronome off')
    assert.ok(d.words.includes('Switch the metronome on to tap along.'))
    /* Earlier and Later move each by a step, from where it is, and the screen-reader says which. */
    const presses = d.buttons.filter((x) => /^(Earlier|Later)$/.test(x.props.label))
    assert.deepEqual(presses.map((x) => x.props.accessibilityLabel), ['The light: Earlier', 'The light: Later', 'This phone’s click: Earlier', 'This phone’s click: Later'])
    for (const p of presses) p.props.onPress()
    assert.deepEqual(b.world.asked, [['nudge', 'light', -10], ['nudge', 'light', 10], ['nudge', 'click', -10], ['nudge', 'click', 10]])
    /* At the ends, the press that would go further is greyed. */
    b.world.lined = { offered: true, light: 200, click: -200, watch: 0 }
    d = b.draw()
    assert.deepEqual(d.buttons.filter((x) => /^(Earlier|Later)$/.test(x.props.label)).map((x) => x.props.disabled), [false, true, true, false])
    assert.ok(d.words.includes('The light: 200 ms later') && d.words.includes('This phone’s click: 200 ms earlier'))
    /* Reset, once something is moved: both back, the watch's left alone. */
    b.world.asked.length = 0
    d.button('Reset').props.onPress()
    assert.deepEqual(b.world.asked, [['set', { light: 0, click: 0 }]])
    /* And with only one moved, either one. */
    for (const lined of [{ light: 0, click: 30 }, { light: -20, click: 0 }]) {
      b.world.lined = { offered: true, watch: 0, ...lined }
      assert.ok(b.draw().button('Reset'), `no Reset with ${JSON.stringify(lined)} moved`)
    }
    b.world.lined = { offered: true, light: 0, click: 0, watch: 0 }
    /* Where the unit clicks and the device keeps its beat beside it, but that beat is not held on the unit's: no Tap along, and the cause the follower learned, each its own line. */
    Object.assign(b.world, { clicking: true, held: false, why: null })
    d = b.draw({ setting: { on: true, where: 'both' }, can: true, quiet: false })
    assert.equal(d.button('Tap along'), null, 'Tap along is offered off the unit’s beat')
    assert.ok(d.words.includes('Still finding where the unit’s beat falls, so Tap along waits.'), JSON.stringify(d.words))
    for (const [why, line] of [
      ['old', 'Update the computer app to tap along: this one doesn’t say where the unit’s beat falls.'],
      ['none', 'Switch Send Realtime Sysex on at the unit to tap along: Setup → MIDI/Remote.'],
      ['stale', 'The unit has stopped sending its beat, so there is nothing to tap along to.'],
      ['tempo', 'The unit’s beat is at another tempo than this phone’s, so Tap along waits until they match.'],
      ['slow', 'The connection to the computer is too slow to place the unit’s beat, so Tap along can’t be used.']
    ]) {
      b.world.why = why
      d = b.draw({ setting: { on: true, where: 'both' }, can: true, quiet: false })
      assert.equal(d.button('Tap along'), null)
      assert.ok(d.words.includes(line), `${why}: ${JSON.stringify(d.words)}`)
    }
    b.world.why = null
    d = b.draw({ setting: { on: true, where: 'both' }, can: true, quiet: false })
    assert.match(d.words.join(' '), /A nudge lines them up while this phone is following the unit’s beat/)
    /* A run open when the beat leaves the unit's: no pad to tap, the why, and Cancel and Done to put it away. */
    b.world.tapping = { open: true, offsets: [1, 2, 3, 4, 5, 6, 7, 8], said: null }
    d = b.draw({ setting: { on: true, where: 'both' }, can: true, quiet: false })
    assert.equal(d.all((n) => n.type === 'Pressable').length, 0, 'a pad is drawn off the unit’s beat')
    assert.ok(d.words.some((w) => /^Still finding where the unit’s beat falls/.test(w)))
    assert.ok(d.button('Cancel') && d.button('Done'))
    b.world.tapping = { open: false, offsets: [], said: { steady: false, ms: null, why: 'moved' } }
    d = b.draw({ setting: { on: true, where: 'both' }, can: true, quiet: false })
    assert.ok(d.words.includes('This phone’s beat moved or lost the unit’s while you tapped, so nothing was set. Tap along again.'), JSON.stringify(d.words))
    b.world.tapping = { open: false, offsets: [], said: null }
    /* Held on the unit's beat, whatever the follower last said: Tap along. */
    Object.assign(b.world, { held: true, why: 'slow' })
    d = b.draw({ setting: { on: true, where: 'both' }, can: true, quiet: false })
    assert.ok(d.button('Tap along'), 'Tap along is not offered beside the unit’s click')
    b.world.asked.length = 0
    d.button('Tap along').props.onPress()
    assert.deepEqual(b.world.asked, [['start']])
    /* Open: the pad takes the touch as it lands, never as the finger lifts; Done waits for eight taps. */
    b.world.tapping = { open: true, offsets: [1, 2, 3], said: null }
    d = b.draw({ setting: { on: true, where: 'both' }, can: true, quiet: false })
    const pad = d.all((n) => n.type === 'Pressable')[0]
    assert.ok(pad, 'no pad')
    assert.equal(typeof pad.props.onPressIn, 'function')
    assert.equal(pad.props.onPress, undefined, 'the pad counts a tap when the finger lifts')
    assert.ok(pad.props.style({ pressed: false }).minHeight >= 120, 'the pad is not big enough to hit without looking')
    b.world.asked.length = 0
    pad.props.onPressIn()
    assert.deepEqual(b.world.asked, [['tap']])
    assert.ok(d.words.includes('3 taps'))
    assert.equal(d.button('Done').props.disabled, true, 'Done goes with fewer than eight taps')
    b.world.tapping = { open: true, offsets: [1, 2, 3, 4, 5, 6, 7, 8], said: null }
    d = b.draw({ setting: { on: true, where: 'both' }, can: true, quiet: false })
    assert.equal(d.button('Done').props.disabled, false)
    d.button('Cancel').props.onPress()
    assert.deepEqual(b.world.asked.at(-1), ['cancel'])
    /* Done: what it set, in his words. */
    b.world.tapping = { open: false, offsets: [], said: { steady: true, ms: 30 } }
    d = b.draw({ setting: { on: true, where: 'both' }, can: true, quiet: false })
    assert.ok(d.words.includes('Your taps came 30 ms after this phone’s beat, so the light and the click are now 30 ms later.'), JSON.stringify(d.words))
    /* Leaving the page puts Tap along away, open or answered. */
    b.world.asked.length = 0
    b.world.effect()()
    assert.deepEqual(b.world.asked, [['cancel']], 'a run of taps is left open when the page is left')
    /* And Settings draws it on the Metronome page, handed what Tap along needs. */
    assert.match(flat(read('mobile/src/screens/Settings.js')), /<LineUp setting=\{clickSetting\} can=\{unitCan\.can\} quiet=\{edgeChoice\.quiet\} \/>/)
  })
}

const STANDINS = `
export const world = { lined: { offered: true, light: 0, click: 0, watch: 0 }, tapping: { open: false, offsets: [], said: null }, clicking: false, held: false, why: null, asked: [] }
export const createElement = (type, props, ...children) => ({ type, props: props || {}, children })
export const Fragment = 'Fragment'
/* The one effect: what the page does when it is put away, kept to be run by the test. */
export const useEffect = (fn) => { world.effect = fn }
export const Text = 'Text', View = 'View', Pressable = 'Pressable'
export const color = new Proxy({}, { get: () => '#000' }), font = new Proxy({}, { get: () => 12 }), space = new Proxy({}, { get: () => 8 }), radius = new Proxy({}, { get: () => 10 })
export default 'Drawn'
export const tick = () => {}
export const useLineUp = () => world.lined
export const useTapAlong = () => world.tapping
export const usePhoneClicking = () => world.clicking
export const useBeatHeld = () => world.held
export const useBeatWhy = () => world.why
export const nudgeLineUp = (part, by) => { world.asked.push(['nudge', part, by]) }
export const setLineUp = (patch) => { world.asked.push(['set', patch]) }
export const startTapAlong = () => { world.asked.push(['start']) }
export const cancelTapAlong = () => { world.asked.push(['cancel']) }
export const finishTapAlong = () => { world.asked.push(['finish']) }
export const tapAlongTap = () => { world.asked.push(['tap']) }
`

/** components/LineUp.js drawn by its real source, with the real rules and the device's word, beside stand-ins that write down what is asked. */
async function lineUpBench() {
  const { build } = await import('esbuild')
  const dir = mkdtempSync(join(tmpdir(), 'line-up-bench-'))
  try {
    const lib = repo('mobile/src/lib/')
    const REAL = ['../lib/lineUp', '../lib/device-word']
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    writeFileSync(join(dir, 'standins.mjs'), STANDINS)
    writeFileSync(join(dir, 'LineUp.js'), read('mobile/src/components/LineUp.js'))
    await build({
      entryPoints: [join(dir, 'LineUp.js')],
      bundle: true,
      format: 'esm',
      outfile: join(dir, 'out.mjs'),
      loader: { '.js': 'jsx' },
      jsx: 'transform',
      jsxFactory: '__h',
      jsxFragment: '__F',
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
    const { default: LineUp } = await import(pathToFileURL(join(dir, 'out.mjs')).href)
    const { world } = await import(pathToFileURL(join(dir, 'standins.mjs')).href)
    const walk = (n, is, found = []) => {
      if (!n || typeof n !== 'object') return found
      if (Array.isArray(n)) {
        for (const c of n) walk(c, is, found)
        return found
      }
      if (n.props && is(n)) found.push(n)
      walk(n.children, is, found)
      walk(n.props?.children, is, found)
      return found
    }
    const text = (n) => (typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join('') : n && typeof n === 'object' ? text(n.children) : '')
    return {
      world,
      draw(props = {}) {
        const tree = LineUp({ setting: { on: false, where: 'unit' }, can: true, quiet: false, ...props })
        if (tree === null) return null
        const buttons = walk(tree, (n) => n.type === 'Drawn' && typeof n.props.label === 'string')
        return {
          all: (is) => walk(tree, is),
          buttons,
          button: (label) => buttons.find((x) => x.props.label === label) || null,
          words: walk(tree, (n) => n.type === 'Text').map(text)
        }
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
