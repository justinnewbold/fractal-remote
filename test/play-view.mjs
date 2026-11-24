import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const flat = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')
const store = () => {
  const kept = new Map()
  return { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => kept.set(k, String(v)), kept }
}

/* Play's views: preset tiles on Play, and the round View button (mobile/src/lib/playView.js). */
export function run(test) {
  test('play view: each way of holding the device keeps its own view, and is offered only what it can draw', async () => {
    const v = await import('../mobile/src/lib/playView.js')
    assert.equal(v.postureOf({ wide: false, across: 390, tall: 700 }), 'phone')
    assert.equal(v.postureOf({ wide: true, across: 1100, tall: 700 }), 'wide')
    assert.equal(v.postureOf({ wide: true, across: 700, tall: 900 }), 'tall')
    assert.equal(v.postureOf({ wide: true, across: 700, tall: 0 }), 'wide', 'a height not measured yet')
    assert.deepEqual([...v.viewsFor('phone')], ['rig', 'top', 'both', 'presets'])
    assert.deepEqual([...v.viewsFor('wide')], ['rig', 'top'])
    assert.deepEqual([...v.viewsFor('tall')], ['rig', 'top'])
    const s = store()
    assert.equal(v.loadView(s, 'phone'), 'rig', 'Play is not as it was until a view is chosen')
    assert.equal(v.saveView('presets', 'phone', s), true)
    assert.equal(v.loadView(s, 'phone'), 'presets')
    assert.equal(v.loadView(s, 'wide'), 'rig', 'a phone\'s view was carried to a big screen')
    assert.equal(v.saveView('both', 'wide', s), false, 'a big screen kept a view it is not offered')
    s.setItem(v.viewKey('wide'), 'presets')
    assert.equal(v.loadView(s, 'wide'), 'rig', 'a view kept by hand that the posture cannot draw was drawn')
    assert.equal(v.loadSource(s), 'around')
    assert.equal(v.loadCount(s), 8)
    assert.equal(v.saveCount(5, s), false)
    assert.equal(v.saveCount(12, s), true)
    assert.equal(v.loadCount(s), 12)
    assert.equal(v.saveSource('starred', s), true)
    assert.equal(v.loadSource(s), 'starred')
    assert.equal(v.loadView({ getItem() { throw new Error('no') } }, 'phone'), 'rig')
  })

  test('play view: the two views that hide something are only a plain phone page\'s, and a phone on its side stays as it was', async () => {
    const v = await import('../mobile/src/lib/playView.js')
    for (const view of v.VIEWS) assert.equal(v.viewDrawn(view, { plain: true }), view)
    assert.equal(v.viewDrawn('both', { plain: false }), 'top')
    assert.equal(v.viewDrawn('presets', { plain: false }), 'top')
    assert.equal(v.viewDrawn('rig', { plain: false }), 'rig')
    for (const view of v.VIEWS) assert.equal(v.viewDrawn(view, { plain: false, short: true }), 'rig')
    assert.equal(v.viewDrawn('nonsense'), 'rig')
    assert.deepEqual(v.VIEWS.map((x) => [v.showsPresets(x), v.showsScenes(x), v.showsPedals(x)]), [
      [false, true, true],
      [true, true, true],
      [true, true, false],
      [true, false, false]
    ])
  })

  test('play view: the tiles are a page that holds the preset the unit is on, and stand still while it moves within the page', async () => {
    const v = await import('../mobile/src/lib/playView.js')
    const around = (current, count = 8, slots = 512) => v.tilesFor({ source: 'around', count, current, slots }).numbers
    assert.deepEqual(around(47), [40, 41, 42, 43, 44, 45, 46, 47])
    assert.deepEqual(around(40), around(47), 'the tiles moved when the preset moved within its page')
    assert.deepEqual(around(48), [48, 49, 50, 51, 52, 53, 54, 55])
    assert.deepEqual(around(510), [504, 505, 506, 507, 508, 509, 510, 511])
    assert.deepEqual(around(102, 4, 104), [100, 101, 102, 103])
    assert.deepEqual(around(1, 16, 5), [0, 1, 2, 3, 4], 'tiles past the last preset')
    assert.deepEqual(around(null, 4), [0, 1, 2, 3])
    assert.deepEqual(v.tilesFor({ source: 'around', count: 8, current: 3, slots: 0 }).numbers, [], 'tiles before the unit said how many presets it has')
    for (let n = 0; n < 512; n++) assert.ok(around(n, 12).includes(n), `preset ${n} is not among its own tiles`)
  })

  test('play view: a setlist, the starred and one color are paged the same way, and fall back to the presets around this one when empty', async () => {
    const v = await import('../mobile/src/lib/playView.js')
    const order = [30, 4, 200, 17, 9, 88]
    const set = v.tilesFor({ source: 'setlist', count: 4, current: 9, slots: 512, order })
    assert.deepEqual(set, { numbers: [9, 88], source: 'setlist', fell: false })
    assert.deepEqual(v.tilesFor({ source: 'setlist', count: 4, current: 4, slots: 512, order }).numbers, [30, 4, 200, 17], 'a setlist is not in its own order')
    assert.deepEqual(v.tilesFor({ source: 'setlist', count: 4, current: 300, slots: 512, order }).numbers, [30, 4, 200, 17], 'off the setlist, its first page')
    assert.deepEqual(v.tilesFor({ source: 'setlist', count: 4, current: 9, slots: 512, order: null }), { numbers: [8, 9, 10, 11], source: 'around', fell: true })
    assert.deepEqual(v.tilesFor({ source: 'starred', count: 4, current: 9, slots: 512, starred: [70, 3, 9, 3, 600, -1, 2.5] }).numbers, [3, 9, 70], 'the starred are not in slot order, once each, and only real slots')
    assert.equal(v.tilesFor({ source: 'starred', count: 4, current: 9, slots: 512, starred: [] }).fell, true)
    assert.deepEqual(v.tilesFor({ source: 'colour', count: 4, current: 9, slots: 512, sameColour: [5, 9, 12, 40, 41] }).numbers, [5, 9, 12, 40])
    assert.equal(v.tilesFor({ source: 'colour', count: 4, current: 9, slots: 512, sameColour: [] }).source, 'around')
    for (const s of ['setlist', 'starred', 'colour']) assert.ok(v.SOURCE_EMPTY[s], `no words for an empty ${s}`)
  })

  test('play view: how many tiles to a row, and how tall, for each view', async () => {
    const v = await import('../mobile/src/lib/playView.js')
    assert.equal(v.presetCols('top', { posture: 'phone', count: 8 }), 4)
    assert.equal(v.presetCols('both', { posture: 'phone', count: 8 }), 2)
    assert.equal(v.presetCols('presets', { posture: 'phone', count: 8 }), 2)
    assert.equal(v.presetCols('top', { posture: 'wide', count: 16 }), 8)
    assert.equal(v.presetCols('top', { posture: 'wide', count: 4 }), 4)
    assert.equal(v.presetCols('top', { posture: 'tall', count: 12 }), 6)
    assert.equal(v.presetTall({ view: 'top', room: 900, presetRows: 2 }), v.TOP_TILE, 'the block on top is not a fixed height')
    /* Alone: four rows share 600 with three gaps of 8, less the spare point. */
    assert.equal(v.presetTall({ view: 'presets', room: 600, presetRows: 4, gap: 8 }), 143)
    assert.equal(v.presetTall({ view: 'presets', room: 100, presetRows: 4, gap: 8 }), v.TILE_LEAST, 'a tile under a thumb\'s 44')
    /* With the scenes: half of 600 for four rows of each. */
    assert.equal(v.presetTall({ view: 'both', room: 600, presetRows: 4, sceneRows: 4, gap: 8, most: 96 }), 68)
    assert.equal(v.presetTall({ view: 'both', room: 2000, presetRows: 2, sceneRows: 2, gap: 8, most: 96 }), 96)
    assert.equal(v.presetTall({ view: 'both', room: 0, presetRows: 4, sceneRows: 4, plainTall: 72 }), 72, 'before Play is measured')
    assert.equal(v.presetTall({ view: 'presets', room: 600, presetRows: 4, plainTall: 72, fit: false }), 72, 'Fit off still filled the screen')
    /* The rows and their gaps never come to more than the room they were given. */
    for (let room = 300; room < 1000; room += 13) {
      for (const rows of [1, 2, 4, 6, 8]) {
        const tall = v.presetTall({ view: 'presets', room, presetRows: rows, gap: 8 })
        if (tall > v.TILE_LEAST) assert.ok(rows * tall + (rows - 1) * 8 <= room, `${rows} rows of ${tall} in ${room}`)
      }
    }
  })

  test('play view: his account only, the button between the speaker and the gear on Play, and nothing changes for any other account', () => {
    assert.match(read('mobile/src/lib/features.js'), /export const PLAY_VIEWS_FOR_EVERYONE = false\n/, 'Play\'s views are open to everybody before he said so')
    assert.match(flat('mobile/src/lib/usePlayViews.js'), /export const usePlayViews = \(\) => \{ const his = useBluetoothAdmin\(\) return PLAY_VIEWS_FOR_EVERYONE \|\| his \}/)
    const bar = flat('mobile/src/components/TopBar.js')
    assert.match(bar, /const viewHere = Boolean\(onPlay\) && views /, 'the View button is drawn off Play, or for an account the views are not open to')
    assert.ok(bar.indexOf('accessibilityLabel="Volume"') < bar.indexOf('{viewHere ? <PlayViewButton /> : null}'), 'the View button is before the speaker')
    assert.ok(bar.indexOf('{viewHere ? <PlayViewButton /> : null}') < bar.indexOf('accessibilityLabel="Connection and setup"'), 'the View button is after the gear')
    assert.match(bar, /const PHOTO = 30 /, 'the photo is not the size of the round of glass behind the speaker and the gear')
    assert.match(flat('mobile/src/components/PlayViewButton.js'), /<GlassDisc size=\{30\} box=\{BOX\} \/>/, 'the View button is not the speaker\'s round of glass')
    assert.match(flat('mobile/App.js'), /onPlay=\{screen === 'stage'\}/)
    const stage = flat('mobile/src/screens/Stage.js')
    assert.match(stage, /const view = playViews \? viewDrawn\(loadView\(sync, posture\), \{ plain: posture === 'phone' && !inSide && !low, short: low \}\) : 'rig' /, 'an account the views are not open to is drawn a view')
    assert.match(stage, /\{showsPresets\(view\) && presetTiles\.numbers\.length \? \( <PresetTiles /)
    assert.match(stage, /onPick=\{\(n\) => goTo\(n\)\}/, 'a preset tile does not load its preset the way Next does')
    /* The tiles never ask the unit for a name: Play is no reason to read a preset mid-song. */
    assert.doesNotMatch(read('mobile/src/components/PresetTiles.js'), /\bwant\(|wantOnly|refresh\(/)
    /* The block runs across both lanes, so its tiles are sized from its own measured width, never only Play's lane (a Pixel Fold's eight tiles filled half the row). */
    assert.match(flat('mobile/src/components/PresetTiles.js'), /const wide = tileWidth\(own \|\| row, cols, space\.sm\)/, 'the preset tiles are sized from the lane, not their own width')
    assert.match(flat('mobile/src/components/PresetTiles.js'), /setOwn\(w\)/)
    assert.doesNotMatch(read('mobile/src/lib/playView.js'), /^import /m, 'the rules import something, so the test no longer runs them whole')
  })
}
