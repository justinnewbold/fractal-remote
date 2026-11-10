/**
 * PLAY'S TILES FILL THE SCREEN ON A BIG SCREEN, AS CLOSE TO SQUARE AS
 * FILLING ALLOWS (mobile/src/lib/squarePlay.js, drawn by screens/Stage.js).
 * "I'm on my iPad. We need to fix this view. That's not right." and "What I
 * meant was it's not right is that it should be taking full advantage of the
 * iPad screen and all scenarios." (Justin, 9 November 2026, after the square
 * tiles of the same day left an AM4's Play mostly empty on an iPad held
 * upright.) The rule is run as it is (it imports nothing); Stage is read for
 * how it draws with it. A phone held upright is never asked.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const rule = () => import('../mobile/src/lib/squarePlay.js')

/* Stage's own numbers: the gap between tiles, each heading with the gap under it, the gap one over the other, the gap side by side. */
const ASK = { gap: 8, head: 26, between: 16, beside: 24 }
/* Every big Play there is: the row its tiles share, and the room from the top of the scenes' heading to the bottom of the page. */
const ROOMS = [
  ['an iPad upright', 780, 898],
  ['an iPad on its side, Play alone', 1148, 560],
  ['half an iPad on its side', 558, 620],
  ['beside the tuner', 788, 620],
  ['the Duo’s half', 360, 420],
  ['a Fold opened', 809, 520],
  ['a small tablet upright', 568, 760],
  ['an iPad Pro 12.9 upright', 970, 1070]
]
/* Scenes and pedals: an AM4, an FM3, and the rest of what a rig can be, down to no scenes or no pedals at all. */
const RIGS = [[4, 4], [8, 7], [4, 5], [8, 12], [2, 3], [8, 4], [4, 1], [0, 6], [8, 0]]

/** How far a plan's tiles reach across the row and down the room, as Stage lays them out, in points. */
function reach(r, plan, { scenes, pedals }, ask = ASK) {
  const { gap, head, between, beside } = ask
  const chainHead = ask.chainHead ?? head
  const chainFoot = ask.chainFoot ?? 0
  const sr = scenes ? Math.ceil(scenes / plan.sceneCols) : 0
  const cr = pedals ? Math.ceil(pedals / plan.chainCols) : 0
  const sceneWide = r.gridWide(plan.sceneCols, plan.scene.wide, gap)
  const chainWide = r.gridWide(plan.chainCols, plan.pedal.wide, gap)
  const sceneTall = scenes ? head + r.gridTall(sr, plan.scene.high, gap) : 0
  const chainTall = pedals ? chainHead + r.gridTall(cr, plan.pedal.high, gap) + chainFoot : 0
  if (plan.beside) return { across: sceneWide + beside + chainWide, down: Math.max(sceneTall, chainTall) }
  return { across: Math.max(sceneWide, chainWide), down: sceneTall + (scenes && pedals ? between : 0) + chainTall }
}
/** The kinds a plan draws, for this rig. */
const kinds = (plan, { scenes, pedals }) => [scenes ? ['a scene', plan.scene] : null, pedals ? ['a pedal', plan.pedal] : null].filter(Boolean)

export function run(test) {
  test('filling the screen: the rule says what it does now, in his words', () => {
    const lib = read('mobile/src/lib/squarePlay.js')
    const head = lib.slice(0, lib.indexOf('*/')).replace(/\n\s*\*\s*/g, ' ').replace(/\s+/g, ' ')
    assert.match(head, /"I'm on my iPad\. We need to fix this view\. That's not right\."/)
    assert.match(head, /"What I meant was it's not right is that it should be taking full advantage of the iPad screen and all scenarios\."/)
    assert.match(head, /FILL THE SCREEN ON A BIG SCREEN, AS CLOSE TO SQUARE AS FILLING ALLOWS/)
    assert.match(head, /Filling wins over squareness; squareness picks the arrangement\./)
    /* It still runs on its own. */
    assert.doesNotMatch(lib, /^import /m)
  })

  test('filling the screen: only where Play is big, never a phone held upright', async () => {
    const r = await rule()
    assert.equal(r.bigTilesOn({ wide: true }), true, 'Play opened up')
    assert.equal(r.bigTilesOn({ inSide: true }), true, 'Play in a side, the Duo’s half among them')
    assert.equal(r.bigTilesOn({ wide: false, inSide: false }), false, 'a phone held upright')
    assert.equal(r.bigTilesOn(), false)
    assert.equal(r.bigTilesOn({ wide: 'yes' }), false, 'only a plain true')
  })

  test('filling the screen: on every big screen, with every rig, the tiles reach the right-hand edge and the bottom of the page, and none runs past either', async () => {
    const r = await rule()
    assert.equal(r.SQUARE_LEAST, 72)
    assert.equal(r.ASPECT_MOST, 2)
    assert.equal(r.SQUARE_MOST, undefined, 'a tile is held to 220 points again, which is what left the screen empty')
    let asked = 0
    for (const [name, width, room] of ROOMS) {
      for (const [scenes, pedals] of RIGS) {
        const rig = { scenes, pedals }
        const at = `${name}, ${scenes} scenes and ${pedals} pedals`
        const plan = r.tilePlan({ width, room, ...rig, ...ASK })
        assert.ok(plan, `${at}: no plan`)
        asked++
        if (!scenes || !pedals) assert.equal(plan.beside, false, `${at}: side by side with nothing on one side`)
        if (scenes) assert.ok(plan.sceneCols >= 1 && plan.sceneCols <= scenes, `${at}: ${plan.sceneCols} scenes across`)
        else assert.deepEqual([plan.sceneCols, plan.scene], [0, { wide: 0, high: 0 }], `${at}: scenes planned with none to draw`)
        if (pedals) assert.ok(plan.chainCols >= 1 && plan.chainCols <= pedals, `${at}: ${plan.chainCols} pedals across`)
        else assert.deepEqual([plan.chainCols, plan.pedal], [0, { wide: 0, high: 0 }], `${at}: pedals planned with none to draw`)
        for (const [what, tile] of kinds(plan, rig)) {
          assert.ok(Number.isInteger(tile.wide) && Number.isInteger(tile.high), `${at}: ${what} is ${tile.wide} by ${tile.high}, not whole points`)
          assert.ok(tile.wide >= r.SQUARE_LEAST && tile.high >= r.SQUARE_LEAST, `${at}: ${what} is ${tile.wide} by ${tile.high}, under the least`)
          const shape = tile.wide / tile.high
          assert.ok(shape <= r.ASPECT_MOST && shape >= 1 / r.ASPECT_MOST, `${at}: ${what} is ${tile.wide} by ${tile.high}, a banner`)
        }
        const { across, down } = reach(r, plan, rig)
        /* Never past the right-hand edge, on any plan. */
        assert.ok(across <= width + 0.01, `${at}: the tiles run ${across - width} points off the row`)
        if (plan.scrolls) {
          /* Nothing fits: the least height, and the page scrolls. */
          assert.equal(plan.beside, false, `${at}: a page that scrolls is side by side`)
          for (const [what, tile] of kinds(plan, rig)) assert.equal(tile.high, r.SQUARE_LEAST, `${at}: ${what} on a page that scrolls is ${tile.high} tall`)
          assert.ok(down > room, `${at}: said to scroll with room for it all`)
          continue
        }
        /* Inside the room... */
        assert.ok(down <= room + 0.01, `${at}: the tiles run ${down - room} points off the bottom`)
        /* ...and filling it, both ways, unless a tile had to be held back from being a banner. */
        if (plan.capped) continue
        assert.ok(across >= width * 0.95, `${at}: the tiles reach only ${(across / width).toFixed(2)} of the row`)
        assert.ok(down >= room * 0.95, `${at}: the tiles reach only ${(down / room).toFixed(2)} of the room`)
        /* One over the other, BOTH grids reach the edge: neither is left narrow under a full one. */
        if (!plan.beside) for (const [cols, tile] of [[plan.sceneCols, plan.scene], [plan.chainCols, plan.pedal]]) if (cols) assert.ok(r.gridWide(cols, tile.wide, ASK.gap) >= width * 0.95, `${at}: one grid stops short of the edge`)
      }
    }
    assert.equal(asked, ROOMS.length * RIGS.length)
  })

  test('filling the screen: his iPad, held upright, with an AM4 and with an FM3', async () => {
    const r = await rule()
    /* His report (9 November 2026): an AM4's four scenes and four pedals were squares in the middle of the screen. Now two rows of two scenes over its four pedals in a row, to every edge. */
    const am4 = r.tilePlan({ width: 780, room: 898, scenes: 4, pedals: 4, ...ASK })
    assert.deepEqual(am4, { beside: false, sceneCols: 2, chainCols: 4, scene: { wide: 386, high: 274 }, pedal: { wide: 189, high: 274 }, capped: false, scrolls: false })
    const am4Reach = reach(r, am4, { scenes: 4, pedals: 4 })
    assert.ok(am4Reach.across >= 780 * 0.95 && am4Reach.across <= 780, `an AM4’s tiles reach ${am4Reach.across} of 780 across`)
    assert.ok(am4Reach.down >= 898 * 0.95 && am4Reach.down <= 898, `an AM4’s tiles reach ${am4Reach.down} of 898 down`)
    /* An FM3's eight scenes and seven pedals: four across, four rows, every tile 189 by 203. */
    const fm3 = r.tilePlan({ width: 780, room: 898, scenes: 8, pedals: 7, ...ASK })
    assert.deepEqual(fm3, { beside: false, sceneCols: 4, chainCols: 4, scene: { wide: 189, high: 203 }, pedal: { wide: 189, high: 203 }, capped: false, scrolls: false })
    const fm3Reach = reach(r, fm3, { scenes: 8, pedals: 7 })
    assert.ok(fm3Reach.across >= 780 * 0.95 && fm3Reach.across <= 780)
    assert.ok(fm3Reach.down >= 898 * 0.95 && fm3Reach.down <= 898)
    /* And on its side: the AM4 side by side, two and two, nearly square; the FM3 side by side, three across each. */
    assert.deepEqual(r.tilePlan({ width: 1148, room: 560, scenes: 4, pedals: 4, ...ASK }), { beside: true, sceneCols: 2, chainCols: 2, scene: { wide: 277, high: 263 }, pedal: { wide: 277, high: 263 }, capped: false, scrolls: false })
    assert.deepEqual(r.tilePlan({ width: 1148, room: 560, scenes: 8, pedals: 7, ...ASK }), { beside: true, sceneCols: 3, chainCols: 3, scene: { wide: 182, high: 172 }, pedal: { wide: 182, high: 172 }, capped: false, scrolls: false })
  })

  test('filling the screen: the arrangement is the one closest to square, with the two kinds a like size and no tile left alone on a row where it need not be', async () => {
    const r = await rule()
    const off = (tile) => Math.abs(Math.log(tile.wide / tile.high))
    for (const [name, width, room] of ROOMS) {
      for (const [scenes, pedals] of RIGS) {
        const rig = { scenes, pedals }
        const at = `${name}, ${scenes} scenes and ${pedals} pedals`
        const plan = r.tilePlan({ width, room, ...rig, ...ASK })
        if (plan.scrolls || plan.capped) continue
        /* Four of a kind are one row, two rows of two, or a column: never three and one. */
        if (scenes === 4) assert.ok([1, 2, 4].includes(plan.sceneCols), `${at}: four scenes ${plan.sceneCols} across`)
        if (pedals === 4) assert.ok([1, 2, 4].includes(plan.chainCols), `${at}: four pedals ${plan.chainCols} across`)
        /* Neither kind is a giant beside the other. */
        if (scenes && pedals) {
          const areas = [plan.scene.wide * plan.scene.high, plan.pedal.wide * plan.pedal.high]
          assert.ok(Math.max(...areas) / Math.min(...areas) <= 2.2, `${at}: one kind’s tiles are ${(Math.max(...areas) / Math.min(...areas)).toFixed(1)} times the other’s`)
        }
        /* A rig that divides evenly (four and four, eight and four, eight and twelve) is well inside a banner's shape. */
        if (scenes % 4 === 0 && pedals % 4 === 0 && scenes && pedals) for (const [what, tile] of kinds(plan, rig)) assert.ok(off(tile) < Math.log(1.75), `${at}: ${what} is ${tile.wide} by ${tile.high}`)
      }
    }
    /* Squareness picks: an iPad on its side could put an AM4's eight tiles in one row over another (281 by 246), and takes two and two side by side (277 by 263), which is squarer. */
    const side = r.tilePlan({ width: 1148, room: 560, scenes: 4, pedals: 4, ...ASK })
    assert.ok(off(side.scene) < off({ wide: 281, high: 246 }))
    /* A tie goes to the bigger scenes: upright, two-and-two scenes over four pedals in a row, never the pedals big and the scenes small. */
    const upright = r.tilePlan({ width: 780, room: 898, scenes: 4, pedals: 4, ...ASK })
    assert.ok(upright.scene.wide * upright.scene.high > upright.pedal.wide * upright.pedal.high)
    /* A tile may be as big as filling needs: nothing holds it at 220 any more. */
    assert.ok(upright.scene.wide > 220 && upright.scene.high > 220)
  })

  test('filling the screen: a tile is never a banner, and a rig too long for the room scrolls at the least height', async () => {
    const r = await rule()
    /* One scene and one pedal in a wide, shallow room: each would be 562 by 174. Held at twice as wide as tall, and the room left. */
    const few = r.tilePlan({ width: 1148, room: 200, scenes: 1, pedals: 1, ...ASK })
    assert.deepEqual(few, { beside: true, sceneCols: 1, chainCols: 1, scene: { wide: 348, high: 174 }, pedal: { wide: 348, high: 174 }, capped: true, scrolls: false })
    assert.ok(reach(r, few, { scenes: 1, pedals: 1 }).across < 1148 * 0.95, 'held back, and still said to fill the row')
    /* The same the other way up: one scene over one pedal in a tall, narrow room is held at twice as tall as wide. */
    const tall = r.tilePlan({ width: 150, room: 900, scenes: 1, pedals: 1, ...ASK })
    assert.equal(tall.capped, true)
    assert.deepEqual([tall.scene, tall.pedal], [{ wide: 150, high: 300 }, { wide: 150, high: 300 }])
    /* A plan that fills without holding anything back always beats one that does. */
    for (const [, width, room] of ROOMS) assert.equal(r.tilePlan({ width, room, scenes: 4, pedals: 4, ...ASK }).capped, false)
    /* The Duo's half with eight scenes and twelve pedals: nothing fits at 72, so 72 tall, four across, to the edge, and the page scrolls. */
    const long = r.tilePlan({ width: 360, room: 420, scenes: 8, pedals: 12, ...ASK })
    assert.deepEqual(long, { beside: false, sceneCols: 4, chainCols: 4, scene: { wide: 84, high: 72 }, pedal: { wide: 84, high: 72 }, capped: false, scrolls: true })
    const longer = r.tilePlan({ width: 360, room: 300, scenes: 8, pedals: 30, ...ASK })
    assert.equal(longer.scrolls, true)
    assert.equal(longer.pedal.high, r.SQUARE_LEAST)
    assert.ok(r.gridWide(longer.chainCols, longer.pedal.wide, 8) <= 360 && r.gridWide(longer.sceneCols, longer.scene.wide, 8) <= 360, 'the least tiles run off the side')
    /* Nothing to draw, nothing measured: no plan, never a guess. */
    assert.equal(r.tilePlan({ width: 0, room: 600, scenes: 8, pedals: 7 }), null)
    assert.equal(r.tilePlan({ width: 600, room: 0, scenes: 8, pedals: 7 }), null)
    assert.equal(r.tilePlan({ width: 600, room: 600, scenes: 0, pedals: 0 }), null)
    assert.equal(r.tilePlan(), null)
  })

  test('filling the screen: a note over the pedals or a sentence under them comes out of the pedals’ room, and the tiles still end at the bottom', async () => {
    const r = await rule()
    for (const [name, width, room] of ROOMS) {
      for (const [scenes, pedals] of [[4, 4], [8, 7], [0, 6], [8, 12]]) {
        /* The quick tip over the pedals (a card), and a VP4's sentence under them. */
        for (const round of [{ chainHead: 26 + 120 }, { chainFoot: 44 }, { chainHead: 26 + 60, chainFoot: 26 }]) {
          const ask = { ...ASK, ...round }
          const rig = { scenes, pedals }
          const plan = r.tilePlan({ width, room, ...rig, ...ask })
          if (plan.scrolls) continue
          const { across, down } = reach(r, plan, rig, ask)
          const at = `${name}, ${scenes} scenes and ${pedals} pedals, ${JSON.stringify(round)}`
          assert.ok(across <= width + 0.01 && down <= room + 0.01, `${at}: the tiles run off the page`)
          if (!plan.capped) assert.ok(down >= room * 0.95, `${at}: the tiles reach only ${(down / room).toFixed(2)} of the room`)
        }
      }
    }
    /* Left out, the chain's half is its heading alone: the same plan as saying so. */
    assert.deepEqual(r.tilePlan({ width: 780, room: 898, scenes: 8, pedals: 7, ...ASK }), r.tilePlan({ width: 780, room: 898, scenes: 8, pedals: 7, ...ASK, chainHead: 26, chainFoot: 0 }))
    /* And what is taken is the pedals' own: side by side, the scenes keep their height. */
    const plain = r.tilePlan({ width: 1148, room: 560, scenes: 4, pedals: 4, ...ASK })
    const noted = r.tilePlan({ width: 1148, room: 560, scenes: 4, pedals: 4, ...ASK, chainFoot: 44 })
    assert.equal(noted.beside, true)
    assert.equal(noted.scene.high, plain.scene.high)
    assert.equal(noted.pedal.high, plain.pedal.high - 22)
  })

  test('filling the screen: Stage draws every tile at the plan’s own width and height on a big screen and as it always did everywhere else', () => {
    const stage = code(read('mobile/src/screens/Stage.js'))
    assert.match(stage, /import \{ bigTilesOn, gridWide, tilePlan \} from '\.\.\/lib\/squarePlay'/)
    assert.match(stage, /const bigTiles = bigTilesOn\(\{ wide: shape\.wide, inSide \}\)\n/)
    /* Asked only once Play knows its height and where the scenes start; never on a phone held upright. */
    assert.match(stage, /bigTiles && viewport > 0 && lanesAt > 0\s*\? tilePlan\(\{/)
    assert.equal(stage.match(/tilePlan\(\{/g).length, 2, 'the tiles are planned somewhere else')
    /* Its numbers are Stage's own layout's: the heading and its gap, the gap between, the gap beside. */
    assert.match(stage, /const fillAsk = \{\s*gap: space\.sm,\s*head: LANE_HEAD \+ space\.sm,\s*between: tight \? space\.md : space\.lg,\s*beside: space\.xl,\s*chainHead: round\.current\.head \?\? LANE_HEAD \+ space\.sm,\s*chainFoot: vp4Says && round\.current\.foot != null \? round\.current\.foot \+ space\.sm : 0\s*\}/)
    assert.match(stage, /const LANES = \{ flexDirection: 'row', gap: space\.xl,/, 'the gap side by side is not the one the tiles were sized with')
    /* The room ends at the page's own padding, whichever of its two shapes the page has. */
    assert.match(stage, /const pageFoot = shape\.wide \? \(tight \? space\.md : space\.lg\) : tight \? space\.lg : space\.xxl\n/)
    assert.match(stage, /const fillRoom = viewport - lanesAt - pageFoot\n/)
    assert.match(stage, /contentContainerStyle=\{\s*shape\.wide\s*\?\s*\{[^}]*paddingBottom: tight \? space\.md : space\.lg\s*\}\s*:\s*\{[^}]*paddingBottom: tight \? space\.lg : space\.xxl\s*\}\s*\}/, 'the page’s padding under the tiles is not the one their room was measured to')
    /* Each kind is drawn at its own size from the plan; a kind the plan has none of, as it always was. */
    assert.match(stage, /const fillScenes = fill && fill\.sceneCols > 0 \? fill\.scene : null\n/)
    assert.match(stage, /const fillPedals = fill && fill\.chainCols > 0 \? fill\.pedal : null\n/)
    for (const [name, kind, high, wide] of [['scene', 'fillScenes', 'sceneHigh', 'sceneWide'], ['pedal', 'fillPedals', 'pedalHigh', 'pedalWide']]) {
      assert.match(stage, new RegExp(`const ${high} = ${kind} \\? ${kind}\\.high : `), `a ${name} is not the plan’s height`)
      assert.match(stage, new RegExp(`const ${wide} = ${kind} \\? ${kind}\\.wide : tileWidth\\(laneRow, `), `a ${name} is not the plan’s width`)
    }
    /* No tile is drawn by any other width or height. */
    assert.doesNotMatch(stage, /height=\{sceneTall\}|height=\{pedalTall\}|style=\{\{ width: tileWidth\(/, 'a tile is drawn past the plan')
    /* The grids are their tiles' own width, so they never wrap to more across than the plan; a half with no tiles has the row. */
    assert.match(stage, /const fillGrid = \(cols, wide\) => \[FILL_LANE, fill\.beside \? null : CENTRED, \{ width: cols > 0 \? gridWide\(cols, wide, space\.sm\) : fillRow \}\]/)
    /* With no pedals the chain's heading and note are still under the scenes, and come out of their room. */
    assert.match(stage, /const chainAlone = fitBlocks > 0 \? 0 : \(tight \? space\.md : space\.lg\) \+ \(round\.current\.alone \?\? LANE_HEAD\)\n/)
    assert.match(stage, /room: fillRoom - chainAlone,/)
    /* What sits round the pedals is measured only where the tiles fill the screen: a phone held upright listens for nothing new. */
    assert.match(stage, /const noteChainHead = bigTiles\s*\? \(e\) => \{\s*if \(!chainNow\.late\) noteRound\('head', e\.nativeEvent\.layout\.y\)\s*\}\s*: undefined\n/)
    assert.match(stage, /const noteChainFoot = bigTiles \? \(e\) => noteRound\('foot', e\.nativeEvent\.layout\.height\) : undefined\n/)
    assert.match(stage, /const noteChainAlone = bigTiles\s*\? \(e\) => \{\s*if \(fitBlocks === 0\) noteRound\('alone', e\.nativeEvent\.layout\.height\)\s*\}\s*: undefined\n/)
    assert.match(stage, /: noteChainHead\s*\? \{ onLayout: noteChainHead \}\s*: \{\}\n/)
    /* And a measure that keeps going back and forth stops: past a few changes in a row it only ever grows. */
    assert.match(stage, /if \(r\.moves > ROUND_MOVES && r\[part\] != null && value < r\[part\]\) return\n/)
  })

  test('filling the screen: a pedal’s picture and name are sized by its tile’s shorter side, never stretched with a long tile', async () => {
    const tile = code(read('mobile/src/components/Tile.js'))
    const stage = code(read('mobile/src/screens/Stage.js'))
    /* The picture: a third of the shorter side on a big tile, the height everywhere else, and never past 40. */
    assert.match(tile, /const shortSide = nameSize && typeof tileWide === 'number' \? Math\.min\(height, tileWide\) : height\n/)
    assert.match(tile, /const picture = icon \? Math\.max\(14, Math\.min\(nameSize \? 40 : 28, Math\.round\(shortSide \* 0\.32\)\)\) : 0\n/)
    /* The name: lib/linedPlay's rule, which takes the smaller of the two sides' shares, handed the tile's own two sides. */
    assert.match(stage, /const pedalWords = fillPedals \? linedName\(\{ height: fillPedals\.high, width: fillPedals\.wide \}\) : lined \? linedName\([^\n]*\) : undefined\n/)
    const lined = await import('../mobile/src/lib/linedPlay.js')
    /* An AM4's pedal on an iPad upright (189 by 274) and the same tile turned round have one name size, the narrow side's; a long tile's name is no bigger than a square's of its short side. */
    assert.equal(lined.linedName({ height: 274, width: 189 }), lined.linedName({ height: 189, width: 189 }))
    assert.ok(lined.linedName({ height: 212, width: 386 }) <= lined.linedName({ height: 212, width: 212 }))
    assert.ok(lined.linedName({ height: 84, width: 176 }) <= lined.linedName({ height: 84, width: 84 }) + 1)
    /* The tile centres what is in it, both ways, whatever its shape; and a scene's name is fitted to the tile's own width and height (lib/name-fit), so it is never stretched either. */
    assert.match(tile, /minHeight: height,\s*alignItems: 'center',\s*justifyContent: 'center',/)
    assert.match(tile, /width: tileWide - 2 \* BORDER - 2 \* space\.sm,\s*height: height - 2 \* BORDER - 2 \* space\.sm - \(caption \? captionTall \+ 1 : 0\) - \(bar \? BAR : 0\),/)
  })
}
