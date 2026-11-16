/**
 * WHERE A KNOB POINTS (shared/knob-dial.mjs, both ends).
 *
 * "The design of the parameter knob does not match the actual one. This is
 * very irritating. So min on left side and max on right." (A customer on an
 * FM9, 16 November 2026.) Both knobs had the right start and sweep and each
 * turned its drawing a further quarter turn on the way to the screen: the
 * lowest setting pointed to half past ten, the middle straight right and the
 * highest to half past seven. Nothing asked where a knob points, so two
 * copies drifted the same way unseen. These tests ask it: of the rule, of
 * the phone's knob (which turns its marks and pointer by the rule and by
 * nothing else), and of the browser's, drawn.
 */
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

/* A clock reading for an angle clockwise from twelve: -135 is 7.5 (half past seven). */
const clock = (deg) => {
  const h = (((deg / 30) % 12) + 12) % 12
  return h === 0 ? 12 : h
}

export function run(test) {
  test('a knob points from half past seven (lowest) through twelve (middle) to half past four (highest), the gap at the bottom', async () => {
    const { DIAL_START, DIAL_SWEEP, dialAngle } = await import('../shared/knob-dial.mjs')
    assert.equal(clock(dialAngle(0)), 7.5, 'the lowest setting does not point to half past seven')
    assert.equal(clock(dialAngle(0.5)), 12, 'the middle does not point straight up')
    assert.equal(clock(dialAngle(1)), 4.5, 'the highest setting does not point to half past four')
    /* A quarter of the way along 270° is 67.5° past the start: quarter to ten, and three quarters is quarter past two. */
    assert.equal(clock(dialAngle(0.25)), 9.75)
    assert.equal(clock(dialAngle(0.75)), 2.25)
    /* Clockwise as it turns up, and the 90° it does not cover is the bottom's: half past four round to half past seven. */
    assert.ok(dialAngle(0.6) > dialAngle(0.5) && dialAngle(0.4) < dialAngle(0.5), 'turning up does not go clockwise')
    assert.equal(DIAL_SWEEP, 270)
    assert.equal(DIAL_START + DIAL_SWEEP / 2, 0, 'the sweep is not centred on twelve')
    /* Off the travel, or not a number, it stays on the dial. */
    assert.deepEqual([dialAngle(-1), dialAngle(2), dialAngle(NaN), dialAngle(undefined)], [-135, 135, -135, -135])
  })

  test('a setting the same either side of nought is lit from twelve; one that only crosses nought, or a frequency, from its lowest', async () => {
    const { centred, litFrom, litMarks } = await import('../shared/knob-dial.mjs')
    const knobs = [
      [{ name: 'Balance', min: -100, max: 100 }, true],
      [{ name: 'Pan', min: -100, max: 100 }, true],
      [{ name: 'Tone', min: -10.00014, max: 10.00014 }, true],
      [{ name: 'Feedback', min: -99.99, max: 99.99 }, true],
      [{ name: 'Bias', min: -1, max: 1 }, true],
      [{ name: 'Level', min: -80, max: 20 }, false],
      [{ name: 'Threshold', min: -60, max: 20 }, false],
      [{ name: 'Gain', min: 0, max: 10 }, false],
      [{ name: 'Cut', min: -60, max: 0 }, false],
      [{ name: 'Odd', min: -20, max: 20.5 }, false],
      [{ name: 'Freq', min: -20, max: 20, log: true }, false],
      [{ name: 'Flat', min: 0, max: 0 }, false],
      [{ name: 'None' }, false],
      [null, false]
    ]
    for (const [param, yes] of knobs) {
      assert.equal(centred(param), yes, `${param?.name}: ${yes ? 'not' : ''} lit from twelve`)
      assert.equal(litFrom(param), yes ? 0.5 : 0, param?.name)
    }
    /* The phone's 21 marks: lit from the first up to the value, or from the one at twelve (the 11th) out to it. */
    const plain = { min: 0, max: 10 }
    const pan = { min: -100, max: 100 }
    assert.deepEqual(litMarks(0, plain, 21), [0, 0])
    assert.deepEqual(litMarks(1, plain, 21), [0, 20])
    assert.deepEqual(litMarks(0.5, plain, 21), [0, 10])
    assert.deepEqual(litMarks(0.5, pan, 21), [10, 10], 'a centred knob at nought lights more than its middle mark')
    assert.deepEqual(litMarks(0.25, pan, 21), [5, 10], 'a centred knob under nought is not lit from twelve to the left')
    assert.deepEqual(litMarks(0.75, pan, 21), [10, 15], 'a centred knob over nought is not lit from twelve to the right')
    assert.deepEqual(litMarks(0, pan, 21), [0, 10])
    assert.deepEqual(litMarks(2, plain, 21), [0, 20])
  })

  test('the phone’s knob turns its marks and its pointer by the rule, and by nothing else', () => {
    const knob = read('mobile/src/components/Knob.js')
    assert.match(knob, /import \{ dialAngle, litMarks \} from '\.\.\/lib\/knob-dial'/)
    assert.match(knob, /const \[lo, hi\] = litMarks\(norm, param, TICKS\)/, 'the ring is not lit by the rule')
    assert.match(knob, /const angle = dialAngle\(norm\)/, 'the pointer is not placed by the rule')
    assert.match(knob, /<Pointer size=\{size\} angle=\{angle\} \/>/, 'the pointer is handed something besides the rule')
    /* Each mark at its own place along the travel, and the pointer at the value's, with no turn added: a view turned by an angle is turned clockwise, and its mark sits at its top, so this IS clockwise from twelve. */
    assert.match(knob, /transform: \[\{ rotate: `\$\{dialAngle\(i \/ \(TICKS - 1\)\)\}deg` \}\]/, 'the marks are turned by something besides the rule')
    assert.match(knob, /transform: \[\{ rotate: `\$\{angle\}deg` \}\]/, 'the pointer is turned by something besides the rule')
    assert.match(knob, /const on = i >= lo && i <= hi/)
    assert.equal((knob.match(/rotate:/g) || []).length, 2, 'something else on the knob is turned')
    assert.ok(!/\bSTART\b|\bSWEEP\b|- 180|\+ 90/.test(knob), 'the knob keeps a start, a sweep or a turn of its own')
    /* Odd, so one mark sits at twelve: the middle of a centred knob. */
    assert.match(knob, /const TICKS = 21\n/)
  })

  test('the browser’s knob, drawn: the dot at half past seven, twelve and half past four, the track along the bottom’s gap, and a centred knob lit from twelve', async () => {
    const knob = read('src/components/Knob.jsx')
    assert.match(knob, /import \{ DIAL_START, DIAL_SWEEP, dialAngle, litFrom \} from '\.\.\/\.\.\/shared\/knob-dial\.mjs'/)
    assert.ok(!/const START|const SWEEP|function toRad|\+ 90\)/.test(knob), 'the knob keeps a start, a sweep or a turn of its own')
    const { build } = await import('esbuild')
    const out = await build({
      stdin: {
        contents: "export { default as Knob } from './src/components/Knob.jsx'\nexport { renderToStaticMarkup } from 'react-dom/server'\nexport { createElement } from 'react'",
        resolveDir: root,
        loader: 'js'
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      jsx: 'automatic',
      logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"production"' }
    })
    const dir = mkdtempSync(join(tmpdir(), 'knob-dial-'))
    try {
      const file = join(dir, 'knob.cjs')
      writeFileSync(file, out.outputFiles[0].text)
      const { Knob, renderToStaticMarkup, createElement } = createRequire(import.meta.url)(file)
      const size = 100
      const c = size / 2
      const draw = (param, value) => {
        const html = renderToStaticMarkup(createElement(Knob, { param, value, onChange: () => {}, onCommit: () => {}, size }))
        const paths = [...html.matchAll(/<path d="M ([-\d.e]+) ([-\d.e]+) A [-\d.e]+ [-\d.e]+ 0 ([01]) 1 ([-\d.e]+) ([-\d.e]+)" class="knob-(track|arc)"/g)].map((m) => ({ kind: m[6], from: { x: +m[1], y: +m[2] }, large: +m[3], to: { x: +m[4], y: +m[5] } }))
        const dot = html.match(/<circle cx="([-\d.e]+)" cy="([-\d.e]+)" r="2" class="knob-dot"/)
        assert.ok(paths.length === 2 && dot, `the knob did not draw its track, arc and dot: ${html}`)
        return { track: paths.find((p) => p.kind === 'track'), arc: paths.find((p) => p.kind === 'arc'), dot: { x: +dot[1], y: +dot[2] } }
      }
      /* Where a point is, as a clock reading round the knob's middle (up is less y on a page). */
      const at = (p) => clock((Math.atan2(p.x - c, -(p.y - c)) * 180) / Math.PI)
      const near = (h, want, why) => assert.ok(Math.abs(h - want) < 0.05 || Math.abs(h - want) > 11.95, `${why}: at ${h} o'clock, not ${want}`)
      const gain = { name: 'Gain', min: 0, max: 10 }
      const low = draw(gain, 0)
      near(at(low.dot), 7.5, 'the lowest setting')
      near(at(draw(gain, 5).dot), 12, 'the middle')
      near(at(draw(gain, 10).dot), 4.5, 'the highest setting')
      near(at(draw(gain, 2.5).dot), 9.75, 'a quarter up')
      /* The track runs clockwise from half past seven over the top to half past four: 270°, the long way. */
      near(at(low.track.from), 7.5, 'the track’s start')
      near(at(low.track.to), 4.5, 'the track’s end')
      assert.equal(low.track.large, 1, 'the track takes the short way round, through the bottom')
      /* Lit from the lowest to the value, clockwise. */
      const half = draw(gain, 5)
      near(at(half.arc.from), 7.5, 'the lit part of a plain knob does not start at its lowest')
      near(at(half.arc.to), 12, 'the lit part does not end at the value')
      assert.equal(draw(gain, 10).arc.large, 1)
      assert.equal(half.arc.large, 0)
      /* A centred one from twelve: out to the right over nought, to the left under it, nothing either side at nought. */
      const pan = { name: 'Pan', min: -100, max: 100 }
      const right = draw(pan, 50)
      near(at(right.arc.from), 12, 'a centred knob over nought is not lit from twelve')
      near(at(right.arc.to), 2.25, 'a centred knob over nought is not lit to its value')
      const left = draw(pan, -50)
      near(at(left.arc.from), 9.75, 'a centred knob under nought is not lit from its value')
      near(at(left.arc.to), 12, 'a centred knob under nought is not lit to twelve')
      const none = draw(pan, 0)
      assert.ok(Math.abs(none.arc.from.x - none.arc.to.x) < 1e-9 && Math.abs(none.arc.from.y - none.arc.to.y) < 1e-9, 'a centred knob at nought lights some of its arc')
      near(at(none.dot), 12, 'a centred knob at nought does not point straight up')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}
