/**
 * A TUNER READING'S CENTS ARE WHOLE BEFORE ANYTHING DRAWS THEM.
 *
 * "A#2 −9.249712944030762 cents" on the phone's tuner (Justin, 25 November
 * 2026). Through a computer an AM4's reading came with the unit's own float
 * for its cents, and the tuner drew it as it came. The computer app rounds it
 * from ForgeFX 8154957; each end rounds it too where a reading enters its
 * store, for a computer app that does not yet.
 *
 * (The other half of that picture, two computers' tuners on one screen, is
 * each end's relay dropping the events of a computer it is not driving:
 * test/link-now.mjs runs both.)
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

export function run(test) {
  const rig = read('mobile/src/lib/rig.js')
  /* The phone's rule, taken out of the store's file as it is written and run. */
  const body = rig.match(/export function wholeCents\(reading\) \{[\s\S]*?\n\}\n/)
  const wholeCents = body ? new Function(`${body[0].replace('export function', 'return function')}`)() : null

  test('phone: a tuner reading’s cents are rounded to a whole number, and a reading with none is left alone', () => {
    assert.ok(wholeCents, 'rig.js has no wholeCents')
    const am4 = { type: 'tuner', freq: 116.54, note: 'A#', octave: 2, cents: -9.249712944030762 }
    assert.deepEqual(wholeCents(am4), { type: 'tuner', freq: 116.54, note: 'A#', octave: 2, cents: -9 })
    assert.equal(am4.cents, -9.249712944030762, 'the reading handed in was written on')
    assert.equal(wholeCents({ note: 'E', cents: 3.5 }).cents, 4)
    assert.equal(wholeCents({ note: 'E', cents: -49.6 }).cents, -50)
    /* Just under nought rounds to a plain 0, which draws "0 cents", never "-0". */
    assert.ok(Object.is(wholeCents({ note: 'E', cents: -0.2 }).cents, 0))
    /* Already whole: the same object, nothing copied. */
    const whole = { type: 'tuner', note: 'C#', octave: 2, cents: -36 }
    assert.equal(wholeCents(whole), whole)
    /* No note sounding, and what is no reading at all. */
    const silent = { type: 'tuner', note: '', octave: undefined, cents: null }
    assert.equal(wholeCents(silent), silent)
    assert.equal(wholeCents(undefined), undefined)
    const odd = { note: 'A', cents: NaN }
    assert.equal(wholeCents(odd), odd)
  })

  test('phone: every reading that enters the store through an event goes through that rule', () => {
    assert.equal((rig.match(/set\(\{ tuning: wholeCents\(event\) \}\)/g) || []).length, 1, 'a reading is stored as it came')
    assert.equal((rig.match(/set\(\{ tuning: event \}\)/g) || []).length, 0, 'a reading is stored as it came somewhere else')
    /* And the one place is the event's own branch: another unit's reading is passed over first, then the rest is stored whole. */
    assert.match(
      rig.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' '),
      /if \(\(event\.type === 'tuner' \|\| event\.note !== undefined\) && state\.tunerOn\) \{ if \(anotherUnitsTuner\(event, \{ slug: state\.deviceSlug, settled: unitSettled \}\)\) \{ if \(!otherTunerSaid\) \{ otherTunerSaid = true logDebug\('tuner', `[^`]*`\) \} \} else \{ set\(\{ tuning: wholeCents\(event\) \}\) \} \}/
    )
  })

  /*
   * For a computer app too old to say whose its events are. Only the AM4's
   * driver ever sent cents that are not whole, so such a reading while
   * another unit is driven is another computer's. One way round only.
   */
  test('phone: a reading with part of a cent is another computer’s AM4 while another unit is driven, and never the other way round', () => {
    const rule = rig.match(/export function anotherUnitsTuner\(reading, \{ slug, settled \} = \{\}\) \{[\s\S]*?\n\}\n/)
    assert.ok(rule, 'rig.js has no anotherUnitsTuner')
    const anotherUnitsTuner = new Function('DEFAULT_SLUG', 'isAm4', rule[0].replace('export function', 'return function'))('device', (slug) => String(slug || '').toLowerCase() === 'am4')
    const am4 = { type: 'tuner', note: 'A#', octave: 2, cents: -9.249712944030762 }
    const gen3 = { type: 'tuner', note: 'C#', octave: 2, cents: -36 }
    for (const slug of ['fm3', 'fm9', 'axe-fx-iii']) {
      assert.equal(anotherUnitsTuner(am4, { slug, settled: true }), true, `an AM4’s reading was drawn on the tuner of the ${slug}`)
      assert.equal(anotherUnitsTuner(gen3, { slug, settled: true }), false, `the ${slug}’s own reading was dropped`)
    }
    /* An AM4 driven: its own reading, part of a cent or whole, and a whole one that may be another's: nothing is dropped. */
    assert.equal(anotherUnitsTuner(am4, { slug: 'am4', settled: true }), false)
    assert.equal(anotherUnitsTuner(gen3, { slug: 'am4', settled: true }), false)
    assert.equal(anotherUnitsTuner(am4, { slug: 'AM4', settled: true }), false)
    /* A unit that has not said what it is, or is being read again: nothing is dropped. */
    assert.equal(anotherUnitsTuner(am4, { slug: 'device', settled: true }), false)
    assert.equal(anotherUnitsTuner(am4, { slug: 'fm3', settled: false }), false)
    assert.equal(anotherUnitsTuner(am4, { slug: '', settled: true }), false)
    assert.equal(anotherUnitsTuner(am4), false)
    /* No note sounding, and what is no reading. */
    assert.equal(anotherUnitsTuner({ type: 'tuner', note: '', cents: null }, { slug: 'fm3', settled: true }), false)
    assert.equal(anotherUnitsTuner(undefined, { slug: 'fm3', settled: true }), false)
    /* The rule's own words for the default slug and the AM4 are the store's. */
    assert.match(rig, /import \{ DEFAULT_SLUG, deviceSlug, unitMoved \} from '\.\/device-slug'/)
    assert.equal(read('mobile/src/lib/device-slug.js').match(/export const DEFAULT_SLUG = '([^']+)'/)?.[1], 'device')
    /* And each opening of the tuner may say it once more. */
    assert.match(rig, /otherTunerSaid = false\n  set\(\{ tunerOn: on,/)
  })

  test('browser: a reading’s cents are rounded where it enters the store', () => {
    const state = read('src/lib/deviceState.js')
    assert.match(
      state,
      /const cents = typeof event\.cents === 'number' && Number\.isFinite\(event\.cents\) \? Math\.round\(event\.cents\) : event\.cents\s*set\(\{ tuning: cents === event\.cents \? event : \{ \.\.\.event, cents \} \}\)/,
      'the browser stores a reading as it came'
    )
    assert.equal((state.match(/set\(\{ tuning: event \}\)/g) || []).length, 0)
  })
}
