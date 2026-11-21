import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

/* Play's four big pedals, two by two, on a phone held upright (mobile/src/lib/bigFour.js). */
export function run(test) {
  test('big four: only on a plain upright Play with four pedals and four scenes or fewer, and only while the choice is on', async () => {
    const b = await import('../mobile/src/lib/bigFour.js')
    assert.equal(b.bigFourOn({ on: true, plain: true, scenes: 4, pedals: 4 }), true)
    assert.equal(b.bigFourOn({ on: true, plain: true, scenes: 0, pedals: 3 }), true)
    assert.equal(b.bigFourOn({ on: false, plain: true, scenes: 4, pedals: 4 }), false, 'the choice off still drew them')
    assert.equal(b.bigFourOn({ on: true, plain: false, scenes: 4, pedals: 4 }), false, 'a big screen, a side or a phone on its side is drawn this way')
    assert.equal(b.bigFourOn({ on: true, plain: true, scenes: 8, pedals: 4 }), false, 'an FM3 with eight scenes is drawn this way')
    assert.equal(b.bigFourOn({ on: true, plain: true, scenes: 4, pedals: 5 }), false)
    assert.equal(b.bigFourOn({ on: true, plain: true, scenes: 4, pedals: 0 }), false)
  })

  test('big four: every tile shares the room left, never taller than it is wide, never shorter than it was, and as it was until Play is measured', async () => {
    const b = await import('../mobile/src/lib/bigFour.js')
    /* 500 points for four rows with two gaps of 8: 121 each, less the spare point. */
    assert.equal(b.bigFourTile({ room: 500, sceneRows: 2, pedalRows: 2, gap: 8, least: 96, wide: 200 }), 120)
    assert.equal(b.bigFourTile({ room: 1200, sceneRows: 2, pedalRows: 2, gap: 8, least: 96, wide: 200 }), 200, 'a tile taller than it is wide')
    assert.equal(b.bigFourTile({ room: 300, sceneRows: 2, pedalRows: 2, gap: 8, least: 96, wide: 200 }), 96, 'tiles smaller than they were')
    assert.equal(b.bigFourTile({ room: 0, sceneRows: 2, pedalRows: 2, gap: 8, least: 96, wide: 200 }), 96)
    /* Four rows and their gaps never come to more than the room. */
    for (let room = 420; room < 900; room += 7) {
      const t = b.bigFourTile({ room, sceneRows: 2, pedalRows: 2, gap: 8, least: 44, wide: 400 })
      assert.ok(4 * t + 16 <= room, `room ${room}: ${t}`)
    }
  })

  test('big four: on out of the box, kept under its own key, and off only when chosen', async () => {
    const b = await import('../mobile/src/lib/bigFour.js')
    const kept = new Map()
    const store = { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => kept.set(k, v) }
    assert.equal(b.loadBigFour(store), true)
    b.saveBigFour(false, store)
    assert.equal(kept.get('fractal.play.bigFour'), '0')
    assert.equal(b.loadBigFour(store), false)
    b.saveBigFour(true, store)
    assert.equal(b.loadBigFour(store), true)
    assert.equal(b.loadBigFour({ getItem: () => { throw new Error('no') } }), true)
  })

  test('big four: Play asks the rule and Settings has the choice; the browser’s tile file is not touched', () => {
    const stage = read('mobile/src/screens/Stage.js')
    assert.ok(stage.includes('const big = bigFourOn({ on: loadBigFour(sync), plain: !lined && !inSide && !shape.wide,'))
    assert.ok(stage.includes('const pedalsAcross = lined ? plan.chainCols : big ? BIG_FOUR_ACROSS : fxCols'))
    assert.ok(stage.includes('const sceneHigh = fillScenes ? fillScenes.high : big ? bigTall : sceneTall'))
    assert.ok(stage.includes('const pedalHigh = fillPedals ? fillPedals.high : big ? bigTall : pedalTall'))
    const settings = read('mobile/src/screens/Settings.js')
    assert.ok(settings.includes('<Choice on={bigFour} label={BIG_FOUR_LABEL} sub={BIG_FOUR_SUB} onPress={() => saveBigFour(!bigFour, sync)} />'))
    assert.ok(!/^import /m.test(read('mobile/src/lib/bigFour.js')), 'the rule imports something')
  })
}
