/**
 * PLAY'S TILES AS SQUARES ON A BIG SCREEN (mobile/src/lib/squarePlay.js,
 * drawn by screens/Stage.js). "It would be better if they looked like square
 * boxes as much as possible" and "Yes do the square tiles as shown" (Justin,
 * 9 November 2026). The rule is run as it is (it imports nothing); Stage is
 * read for how it draws with it. A phone held upright is never asked.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const rule = () => import('../mobile/src/lib/squarePlay.js')

/* Stage's own numbers: the gap between tiles, each heading with the gap under it, the gap one over the other, the gap side by side. */
const ASK = { gap: 8, head: 26, between: 16, beside: 24 }
/** Every square of a plan fits its width and room, as Stage lays it out. */
function fits(r, plan, { width, room, scenes, pedals }) {
  const { gap, head, between, beside } = ASK
  const sr = scenes ? Math.ceil(scenes / plan.sceneCols) : 0
  const cr = pedals ? Math.ceil(pedals / plan.chainCols) : 0
  if (plan.beside) {
    const across = r.gridWide(plan.sceneCols, plan.side, gap) + beside + r.gridWide(plan.chainCols, plan.side, gap)
    const down = head + r.gridTall(Math.max(sr, cr), plan.side, gap)
    return across <= width + 0.01 && down <= room + 0.01
  }
  const across = Math.max(r.gridWide(plan.sceneCols, plan.side, gap), r.gridWide(plan.chainCols, plan.side, gap))
  const parts = (scenes ? 1 : 0) + (pedals ? 1 : 0)
  const down = parts * head + (parts - 1) * between + r.gridTall(sr, plan.side, gap) + r.gridTall(cr, plan.side, gap)
  return across <= width + 0.01 && down <= room + 0.01
}

export function run(test) {
  test('squares: only where Play is big, never a phone held upright', async () => {
    const r = await rule()
    assert.equal(r.squaresOn({ wide: true }), true, 'Play opened up')
    assert.equal(r.squaresOn({ inSide: true }), true, 'Play in a side, the Duo’s half among them')
    assert.equal(r.squaresOn({ wide: false, inSide: false }), false, 'a phone held upright')
    assert.equal(r.squaresOn(), false)
    assert.equal(r.squaresOn({ wide: 'yes' }), false, 'only a plain true')
  })

  test('squares: the biggest that fit, side by side or one over the other, and every one inside the room', async () => {
    const r = await rule()
    const rooms = [
      ['half an iPad on its side', 558, 620],
      ['beside the tuner', 788, 620],
      ['an iPad upright', 788, 880],
      ['the Duo’s half', 360, 420],
      ['an iPad on its side, Play alone', 1148, 560],
      ['a Fold opened', 809, 520],
      ['a small tablet upright', 568, 760]
    ]
    for (const [name, width, room] of rooms) {
      for (const [scenes, pedals] of [[8, 7], [4, 5], [8, 12], [0, 6], [8, 0], [4, 1]]) {
        const ask = { width, room, scenes, pedals }
        const plan = r.squarePlan({ ...ask, ...ASK })
        assert.ok(plan, `${name}: no plan`)
        assert.equal(plan.side, Math.floor(plan.side), `${name}: not a whole number of points`)
        assert.ok(plan.side >= r.SQUARE_LEAST && plan.side <= r.SQUARE_MOST, `${name}: ${plan.side} out of bounds`)
        if (plan.side > r.SQUARE_LEAST) assert.ok(fits(r, plan, ask), `${name}, ${scenes} scenes and ${pedals} pedals: the squares overrun the room`)
        if (!scenes) assert.equal(plan.beside, false, `${name}: side by side with nothing on one side`)
        if (scenes) assert.ok(plan.sceneCols >= 1 && plan.sceneCols <= scenes)
        if (pedals) assert.ok(plan.chainCols >= 1 && plan.chainCols <= pedals)
      }
    }
    /* The mockups: half an iPad is four across, the Duo's half too, an iPad upright scenes over the chain. */
    const half = r.squarePlan({ width: 558, room: 620, scenes: 8, pedals: 7, ...ASK })
    assert.ok(half.side >= 120, `half an iPad’s squares are ${half.side}`)
    const upright = r.squarePlan({ width: 788, room: 880, scenes: 8, pedals: 7, ...ASK })
    assert.equal(upright.beside, false)
    assert.ok(upright.side > half.side, 'an iPad upright has smaller squares than half of one on its side')
  })

  test('squares: nothing to draw or nothing measured is no plan, and a chain too long scrolls at the least square', async () => {
    const r = await rule()
    assert.equal(r.squarePlan({ width: 0, room: 600, scenes: 8, pedals: 7 }), null)
    assert.equal(r.squarePlan({ width: 600, room: 0, scenes: 8, pedals: 7 }), null)
    assert.equal(r.squarePlan({ width: 600, room: 600, scenes: 0, pedals: 0 }), null)
    assert.equal(r.squarePlan(), null)
    const long = r.squarePlan({ width: 360, room: 300, scenes: 8, pedals: 30, ...ASK })
    assert.equal(long.side, r.SQUARE_LEAST)
    assert.equal(long.beside, false)
    assert.ok(r.gridWide(long.chainCols, long.side, 8) <= 360 && r.gridWide(long.sceneCols, long.side, 8) <= 360, 'the least squares run off the side')
  })

  test('squares: Stage draws every tile as the square on a big screen and as it always did everywhere else', () => {
    const stage = code(read('mobile/src/screens/Stage.js'))
    assert.match(stage, /import \{ gridWide, squarePlan, squaresOn \} from '\.\.\/lib\/squarePlay'/)
    assert.match(stage, /const squares = squaresOn\(\{ wide: shape\.wide, inSide \}\)\n/)
    /* Asked only once Play knows its height and where the scenes start. */
    assert.match(stage, /squares && viewport > 0 && lanesAt > 0\s*\? squarePlan\(\{/)
    /* Its numbers are Stage's own layout's: the heading and its gap, the gap between, the gap beside. */
    assert.match(stage, /gap: space\.sm,\s*head: LANE_HEAD \+ space\.sm,\s*between: tight \? space\.md : space\.lg,\s*beside: space\.xl/)
    assert.match(stage, /const LANES = \{ flexDirection: 'row', gap: space\.xl,/, 'the gap side by side is not the one the squares were sized with')
    for (const [name, high, wide] of [['scene', 'sceneHigh', 'sceneWide'], ['pedal', 'pedalHigh', 'pedalWide']]) {
      assert.match(stage, new RegExp(`const ${high} = sq \\? sq\\.side : `), `a ${name} is not the square’s height`)
      assert.match(stage, new RegExp(`const ${wide} = sq \\? sq\\.side : tileWidth\\(laneRow, `), `a ${name} is not the square’s width`)
    }
    /* No tile is drawn by any other width or height. */
    assert.doesNotMatch(stage, /height=\{sceneTall\}|height=\{pedalTall\}|style=\{\{ width: tileWidth\(/, 'a tile is drawn past the squares')
    /* The grids are their squares' own width, so they never wrap to more across than the plan. */
    assert.match(stage, /const squareGrid = \(cols\) => \[SQUARE_LANE, sq\.beside \? null : CENTRED, \{ width: gridWide\(cols, sq\.side, space\.sm\) \}\]/)
  })
}
