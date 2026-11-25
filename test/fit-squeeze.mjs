import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

/* Fit to screen when the tiles alone cannot do it (mobile/src/lib/fitSqueeze.js). */
export function run(test) {
  test('fit squeeze: only with Fit on, on a phone’s plain page, the tile at its floor and the page still over', async () => {
    const f = await import('../mobile/src/lib/fitSqueeze.js')
    assert.equal(f.squeezeNow({ fitOn: true, plain: true, tile: 44, over: 50 }), true)
    assert.equal(f.squeezeNow({ fitOn: false, plain: true, tile: 44, over: 50 }), false, 'a size chosen by hand was squeezed')
    assert.equal(f.squeezeNow({ fitOn: true, plain: false, tile: 44, over: 50 }), false, 'a wide window, a side or a phone on its side was squeezed')
    assert.equal(f.squeezeNow({ fitOn: true, plain: true, tile: 45, over: 50 }), false, 'the tiles still had room to give')
    assert.equal(f.squeezeNow({ fitOn: true, plain: true, tile: 44, over: 2 }), false, 'rounding was taken for an overflow')
    assert.equal(f.squeezeNow({ fitOn: true, plain: true, tile: 0, over: 50 }), false, 'squeezed before Fit had answered')
    assert.equal(f.squeezeNow(), false)
    assert.equal(f.FIT_FLOOR, 44)
  })

  test('fit squeeze: kept while the screen and the tile counts stand, loading or not', async () => {
    const f = await import('../mobile/src/lib/fitSqueeze.js')
    const at = (o) => f.squeezeKey({ viewport: 794, width: 440, scenes: 8, blocks: 12, fitOn: true, sceneCols: 2, ...o })
    assert.equal(at({}), at({}))
    assert.equal(at({ late: true }), at({ late: false }), 'a chain still loading let go of the squeeze, so the buttons jump at every preset')
    for (const o of [{ viewport: 700 }, { width: 393 }, { scenes: 4 }, { blocks: 8 }, { fitOn: false }, { sceneCols: 1 }]) {
      assert.notEqual(at(o), at({}), `kept across ${JSON.stringify(o)}`)
    }
  })

  test('fit squeeze: his Axe-Fx III preset, eight scenes and twelve pedals, fits an iPhone 17 Pro Max once the page gives too', async () => {
    const f = await import('../mobile/src/lib/fitSqueeze.js')
    /* fitTiles: fitWide's answer on a phone held upright, answer for answer (lib/playShape). */
    const { fitTiles: fitWide } = await import('../mobile/src/lib/gigSize.js')
    /* Play's own sums, as Stage makes them, over a page whose tiles are never shorter than what is drawn on them (a scene 68, a pedal 52, measured off his picture). */
    const page = ({ viewport, squeezeOn }) => {
      let trim = 0
      let squeezed = false
      let content = 0
      let tile = 0
      for (let pass = 0; pass < 60; pass += 1) {
        const tight = squeezed
        const gap = tight ? 12 : 16
        /* The page's padding over and under, the preset's label and button, two headings, the two rows of buttons, and the gaps between the sections. */
        const chrome = 16 + (tight ? 16 : 32) + 20 + (tight ? 56 : 68) + 2 * 24 + 2 * (tight ? 48 : 56) + 8 + 5 * gap
        const fitted = fitWide({ available: viewport - chrome - trim, scenes: 8, blocks: 12, sceneCols: 2, fxCols: 4, gap: 8, width: 408 })
        const scene = Math.max(fitted.tile, 68)
        const pedal = Math.max(Math.max(44, fitted.tile - 12), 52)
        const next = chrome + 4 * scene + 3 * 8 + 3 * pedal + 2 * 8
        const same = next === content && fitted.tile === tile
        content = next
        tile = fitted.tile
        const over = content - viewport
        if (squeezeOn && !squeezed && f.squeezeNow({ fitOn: true, plain: true, tile, over })) {
          squeezed = true
          trim = 0
          continue
        }
        if (over > 2) trim += over
        else if (same) break
        if (same && tile <= 44) break
      }
      return { content, squeezed, over: content - viewport }
    }
    const before = page({ viewport: 794, squeezeOn: false })
    assert.ok(before.over > 20, `the model of his screen does not overflow as his picture does (${before.over})`)
    const after = page({ viewport: 794, squeezeOn: true })
    assert.equal(after.squeezed, true, 'the page never gave')
    assert.ok(after.over <= 2, `still ${after.over} points over with the page squeezed`)
    /* A preset that fits is never squeezed. */
    const roomy = page({ viewport: 900, squeezeOn: true })
    assert.equal(roomy.squeezed, false, 'a preset that fits was drawn tight')
  })

  test('fit squeeze: Play asks the rule, draws tight on its answer, and lets go only when the screen or the counts change', () => {
    const stage = read('mobile/src/screens/Stage.js').replace(/\s+/g, ' ')
    assert.match(stage, /const tight = size === SIZES\[0\] \|\| squeezed === true/, 'a squeeze does not make Play tight')
    assert.match(stage, /squeezeNow\(\{ fitOn, plain: !shape\.wide && !inSide && !low, tile: fitTile\.current, over \}\)/, 'the rule is not asked, or is asked off a phone’s plain page')
    assert.match(stage, /setSqueezed\(true\) setTrim\(0\) return/, 'Fit does not start its sums again in the room the squeeze frees')
    assert.match(stage, /if \(lastSqueeze\.current !== squeezeAt\) \{ lastSqueeze\.current = squeezeAt if \(squeezed\) setSqueezed\(false\) \}/, 'a squeeze is never let go of, or is let go of every draw')
    assert.match(stage, /fitTile\.current = fitted \? fitted\.tile : 0/, 'the check never hears what Fit answered')
    assert.doesNotMatch(read('mobile/src/lib/fitSqueeze.js'), /^import /m, 'the rule reaches for something')
  })
}
