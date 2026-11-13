/**
 * THE BLOCKS THE ENGINE HAS NO NAME FOR, ON PLAY IN THE BROWSER AND THE
 * COMPUTER'S OWN WINDOW (shared/own-blocks.mjs, src/components/Gig.jsx).
 *
 * "Nam blocks are showing in the APP but not computer" (Justin, 13 November
 * 2026, the computer app's window on his Raspberry Pi with an Axe-Fx III on
 * a preset called NAM, and no NAM tile). The phone names an Axe-Fx III's
 * NAM block and five more for itself; this end drew only blocks with a slug.
 * Now Play here names them from the same list: the same ids, names and
 * pictures as the phone's, his account first, and a New block still to
 * everything else on the page.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

const own = () => import('../shared/own-blocks.mjs')

/** An Axe-Fx III's chain as the engine sends it: its own blocks with their place, on and off, channel and id, and no slug. */
const III = () => [
  { slug: 'comp', name: 'Comp 1', effectId: 46, bypassed: false, channel: 'A', row: 1, col: 1 },
  { slug: '', name: 'eid_206', effectId: 206, bypassed: false, channel: 'B', row: 1, col: 2 },
  { slug: '', name: 'eid_207', effectId: 207, bypassed: true, channel: 'A', row: 1, col: 3 },
  { slug: '', name: 'eid_195', effectId: 195, bypassed: false, channel: 'A', row: 1, col: 4 },
  { slug: '', name: 'eid_134', effectId: 134, bypassed: true, channel: 'A', row: 1, col: 5 },
  { slug: '', name: 'eid_143', effectId: 143, bypassed: false, channel: 'A', row: 1, col: 6 },
  { slug: '', name: 'eid_170', effectId: 170, bypassed: false, channel: 'A', row: 1, col: 7 },
  { slug: '', name: 'eid_202', effectId: 202, bypassed: false, channel: 'A', row: 1, col: 8 },
  /* The preset's Performance page, and a block nobody has a name for: neither is one of these. */
  { slug: '', name: 'eid_201', effectId: 201, bypassed: false, channel: 'A', row: 2, col: 1 },
  { slug: '', name: 'eid_240', effectId: 240, bypassed: false, channel: 'A', row: 2, col: 2 },
  { slug: 'cab', name: 'Cab 1', effectId: 62, bypassed: false, channel: 'A', row: 1, col: 9 }
]

export function run(test) {
  test('the list is the phone’s own: the same ids, the same names and the same borrowed pictures, on an FM9 and an Axe-Fx III', async () => {
    const { OWN_BLOCKS, OWN_ICON, ownBlock } = await own()
    const { catalogFor } = await import('../mobile/src/lib/gen3Catalog.js')
    const { OWN_FAMILIES } = await import('../mobile/src/lib/ownBlocks.js')
    const { PHONE_ONLY } = await import('../mobile/src/lib/blockIcons.js').catch(() => ({ PHONE_ONLY: null }))
    assert.deepEqual(Object.keys(OWN_BLOCKS), ['fm9', 'axefxiii'])
    for (const [unitSlug, unit] of [['fm9', 'fm9'], ['axefxiii', 'axefx3']]) {
      /* Every block the phone names for itself on this unit, by its id, is named the same here. */
      const phones = catalogFor(unit).filter((b) => OWN_FAMILIES.includes(b.slug))
      assert.ok(phones.length > 0, unit)
      for (const b of phones) assert.deepEqual(ownBlock(unitSlug, b.page), { slug: b.slug, name: b.name }, `${unit} ${b.page}`)
      /* And nothing here that the phone does not name. */
      const ids = OWN_BLOCKS[unitSlug].flatMap((fam) => Array.from({ length: fam.count }, (_, i) => fam.id + i))
      assert.deepEqual(ids.slice().sort((a, b) => a - b), phones.map((b) => b.page).sort((a, b) => a - b), unit)
    }
    assert.deepEqual(ownBlock('axefxiii', 206), { slug: 'nam', name: 'NAM 1' })
    assert.deepEqual(ownBlock('axefxiii', 207), { slug: 'nam', name: 'NAM 2' })
    assert.deepEqual(ownBlock('axefxiii', 134), { slug: 'vocoder', name: 'Vocoder' })
    /* An FM9 has no NAM block, and no other unit has any of them. */
    assert.equal(ownBlock('fm9', 206), null)
    for (const other of ['fm3', 'am4', 'vp4', 'axefxii', '', null, undefined]) assert.equal(ownBlock(other, 206), null, String(other))
    for (const not of [201, 174, 208, 205, 199, 144, 133, '206', 206.5, null]) assert.equal(ownBlock('axefxiii', not), null, String(not))

    /* The pictures: the phone's own choice, read from its file (it imports pictures, so it is read as text where it cannot be loaded). */
    const phoneIcons = PHONE_ONLY || Function(`return (${/export const PHONE_ONLY = Object\.freeze\((\{[^}]*\})\)/.exec(read('mobile/src/lib/blockIcons.js'))[1]})`)()
    assert.deepEqual({ ...OWN_ICON }, { ...phoneIcons })
    /* Each is a picture this end has, and the browser's lookup falls back to it. */
    const icons = read('src/lib/blockIcons.js')
    const files = /const FILES = \{([^}]*)\}/.exec(icons)[1].split(',').map((s) => s.trim())
    for (const pic of Object.values(OWN_ICON)) assert.ok(files.includes(pic), pic)
    assert.match(flat(code(icons)), /const name = blockIconName\(slug\) \|\| OWN_ICON\[String\(slug \|\| ''\)\.toLowerCase\(\)\] \|\| null/)
    /* And a colour of its own at this end already. */
    const palettes = read('src/lib/blockPalettes.js')
    for (const slug of Object.keys(OWN_ICON)) assert.match(palettes, new RegExp(`\\b${slug}: '#[0-9a-f]{6}'`), slug)
  })

  test('Play’s chain names them by effect id, keeps each a New block, and leaves every other unnamed block alone', async () => {
    const { nameOwnBlocks } = await own()
    const { isNewBlock, markNewBlocks } = await import('../shared/new-block.mjs')
    const chain = III()
    const named = nameOwnBlocks(chain, 'axefxiii', true)
    assert.notEqual(named, chain)
    assert.deepEqual(
      named.map((b) => [b.effectId, b.slug, b.name]),
      [
        [46, 'comp', 'Comp 1'],
        [206, 'nam', 'NAM 1'],
        [207, 'nam', 'NAM 2'],
        [195, 'irplayer', 'IR Player 1'],
        [134, 'vocoder', 'Vocoder'],
        [143, 'crossover', 'Crossover 2'],
        [170, 'tonematch', 'Tone Match'],
        [202, 'dynadist', 'Dynamic Distortion 1'],
        [201, '', 'eid_201'],
        [240, '', 'eid_240'],
        [62, 'cab', 'Cab 1']
      ]
    )
    /* What the unit said of each is carried as it came: on and off, channel, place. */
    const nam2 = named.find((b) => b.effectId === 207)
    assert.deepEqual([nam2.bypassed, nam2.channel, nam2.row, nam2.col], [true, 'A', 1, 3])
    /* Still a New block to everything that moves or edits the chain, and marked as Play's. */
    for (const b of named.filter((x) => [206, 207, 195, 134, 143, 170, 202].includes(x.effectId))) {
      assert.equal(b.unknown, true, b.name)
      assert.equal(b.onPlay, true, b.name)
      assert.equal(isNewBlock(b), true, b.name)
    }
    /* The chain handed in is not changed: the rest of the page keeps its New blocks. */
    assert.deepEqual(chain, III())
    assert.deepEqual(nameOwnBlocks(markNewBlocks(III()), 'axefxiii', true).map((b) => b.slug), named.map((b) => b.slug))

    /* The same list back, the very same, where there is nothing to do. */
    assert.equal(nameOwnBlocks(chain, 'axefxiii', false), chain)
    assert.equal(nameOwnBlocks(chain, 'axefxiii', undefined), chain)
    assert.equal(nameOwnBlocks(chain, 'axefxiii', 'yes'), chain)
    for (const other of ['fm3', 'am4', 'vp4', '', null]) assert.equal(nameOwnBlocks(chain, other, true), chain, String(other))
    const plain = [{ slug: 'amp', name: 'Amp 1', effectId: 58 }, { slug: '', name: 'eid_240', effectId: 240 }]
    assert.equal(nameOwnBlocks(plain, 'axefxiii', true), plain)
    assert.equal(nameOwnBlocks(null, 'axefxiii', true), null)
    /* An FM9 gets its three families and no NAM. */
    assert.deepEqual(
      nameOwnBlocks(chain, 'fm9', true).filter((b) => b.onPlay).map((b) => b.name),
      ['Vocoder', 'Crossover 2', 'Tone Match']
    )
    /* The computer's name for the unit, squeezed the way the page squeezes it. */
    const { deviceSlug } = await import('../shared/device-slug.mjs')
    assert.equal(deviceSlug('Axe-Fx III'), 'axefxiii')
    assert.equal(deviceSlug('FM9'), 'fm9')
  })

  test('his account first: the switch is off, and nobody else’s Play, signed out or the demo’s, changes', async () => {
    const { OWN_BLOCKS_ON_THE_WEB_FOR_EVERYONE, ownBlocksOpenTo } = await own()
    const { ADMINS } = await import('../shared/admin.mjs')
    assert.equal(OWN_BLOCKS_ON_THE_WEB_FOR_EVERYONE, false)
    assert.equal(ownBlocksOpenTo(ADMINS[0]), true)
    for (const other of ['11111111-2222-3333-4444-555555555555', '', null, undefined]) assert.equal(ownBlocksOpenTo(other), false, String(other))
    /* The switch thrown opens it to everybody, and only `true` is thrown. */
    assert.equal(ownBlocksOpenTo(null, true), true)
    assert.equal(ownBlocksOpenTo(null, 'true'), false)
  })

  test('only Play asks it: the page’s own chain, Edit, the chain editor and the report still see a New block', () => {
    const app = flat(code(read('src/App.jsx')))
    const gig = flat(code(read('src/components/Gig.jsx')))
    /* Play is told who it is open to, by the account the Developer rows go by. */
    assert.match(app, /ownOpen=\{ownBlocksOpenTo\(link\.account\?\.id\)\}/)
    assert.equal((app.match(/ownBlocksOpenTo/g) || []).length, 2, 'the import and Play’s one prop')
    /* And names the chain it draws, once, off by default. */
    assert.match(gig, /sideways = false, ownOpen = false, headSlot = null,/)
    assert.match(gig, /const blocks = useMemo\( \(\) => nameOwnBlocks\(allBlocks, deviceKey, ownOpen\)\.filter\(\(b\) => b\.slug && !STAGE_HIDDEN\.includes\(b\.slug\)\), \[allBlocks, deviceKey, ownOpen\] \)/)
    assert.equal((gig.match(/nameOwnBlocks/g) || []).length, 2, 'the import and the one chain Play draws')
    /* Nothing else on this end reads the list: no other screen, and never the state the page keeps. */
    for (const f of ['src/components/Console.jsx', 'src/lib/deviceState.js', 'shared/new-block.mjs', 'shared/grid-plan.mjs']) {
      assert.ok(!/own-blocks|nameOwnBlocks|ownBlocksOpenTo/.test(read(f)), f)
    }
    /* The list imports the account check and nothing else, so it brings nothing new into the computer app. */
    assert.equal(read('shared/own-blocks.mjs').match(/^import .*$/gm).join('\n'), "import { isAdmin } from './admin.mjs'")
    /* Nothing under mobile/ imports it: the phone has its own (lib/ownBlocks), and this one is the computer's. */
    for (const f of ['mobile/src/lib/ownBlocks.js', 'mobile/src/lib/ownBlocksHere.js', 'mobile/src/lib/blockIcons.js']) assert.ok(!/own-blocks/.test(read(f)), f)
  })
}
