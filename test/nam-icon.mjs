/**
 * THE NAM BLOCK'S OWN PICTURE (scripts/nam-icon.mjs, mobile/assets/icons/
 * nam.png and nam-rainbow.png).
 *
 * "Make the NAM block look similar to this. but with the same aesthetics
 * that we use in our app now. But like with the rainbow type color in that
 * same type of glyph." (Justin, 14 November 2026, with a picture of the
 * block as his editor draws it.)
 *
 * A small neural network over the word NAM, in a rainbow, on the app's own
 * tile. What is held here:
 *
 *   - both files are what the script draws, dot for dot, so neither can be
 *     swapped for a picture taken from anybody's editor
 *   - the white one is white, the coloured one runs red to violet
 *   - the phone's tile draws the coloured one untinted, and the white one
 *     tinted wherever a tile is plainly one colour (grey when off, quiet)
 *   - the browser draws the same two, by the same rule
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import zlib from 'node:zlib'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const bytes = (p) => readFileSync(new URL(`../${p}`, import.meta.url))
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

/** A PNG's size and its RGBA dots, for the plain kind the script writes: eight bits, with alpha, every row unfiltered. */
function dotsOf(png) {
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'not a PNG')
  let at = 8
  let head = null
  const data = []
  const types = []
  while (at < png.length) {
    const length = png.readUInt32BE(at)
    const type = png.subarray(at + 4, at + 8).toString('latin1')
    const body = png.subarray(at + 8, at + 8 + length)
    types.push(type)
    if (type === 'IHDR') head = body
    if (type === 'IDAT') data.push(body)
    at += 12 + length
  }
  /* A header, the dots and the end, and nothing else: no colour profile to shift the rainbow in a browser, and no note from another program. */
  assert.deepEqual(types, ['IHDR', 'IDAT', 'IEND'], 'the file carries something the script does not write')
  const size = head.readUInt32BE(0)
  assert.equal(head.readUInt32BE(4), size, 'not square')
  assert.deepEqual([head[8], head[9], head[12]], [8, 6, 0], 'not eight bits with alpha, or interlaced')
  const raw = zlib.inflateSync(Buffer.concat(data))
  const row = size * 4 + 1
  assert.equal(raw.length, size * row)
  const dots = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    assert.equal(raw[y * row], 0, 'a row is filtered')
    raw.copy(dots, y * size * 4, y * row + 1, (y + 1) * row)
  }
  return { size, dots }
}

export function run(test) {
  test('nam picture: both files are what the script draws, dot for dot, a white one and one in a rainbow', async () => {
    const { NAM_FILES, NAM_LAYERS, NAM_RAINBOW, namPixels, namShape, pngOf } = await import('../scripts/nam-icon.mjs')
    assert.deepEqual(
      NAM_FILES.map((f) => [f.file, f.size, f.own]),
      [
        ['mobile/assets/icons/nam.png', 96, false],
        ['mobile/assets/icons/nam-rainbow.png', 192, true]
      ]
    )
    for (const { file, size, own } of NAM_FILES) {
      const got = dotsOf(bytes(file))
      assert.equal(got.size, size, file)
      assert.ok(got.dots.equals(namPixels(size, { own })), `${file} is not what scripts/nam-icon.mjs draws. Run: node scripts/nam-icon.mjs`)
      /* And the writer's own file reads back as the dots it was given. */
      assert.ok(dotsOf(pngOf(namPixels(size, { own }), size)).dots.equals(got.dots))
    }

    /* Our own drawing: three columns of dots, three, four and three, every dot joined to every dot of the next column. */
    assert.deepEqual([...NAM_LAYERS], [3, 4, 3])
    const shape = namShape()
    assert.deepEqual(shape.dots.map((c) => c.length), [3, 4, 3])
    assert.equal(shape.lines.length, 3 * 4 + 4 * 3)
    /* Inside the square, the columns left to right, each centred top to bottom, and the whole thing the same mirrored left to right. */
    for (const col of shape.dots) {
      for (const d of col) assert.ok(d.x > 0.1 && d.x < 0.9 && d.y > 0.1 && d.y < 0.9, 'a dot is off the picture')
      assert.ok(Math.abs(col.reduce((sum, d) => sum + d.y, 0) / col.length - 0.5) < 1e-9, 'a column is not centred')
    }
    assert.ok(shape.dots[0][0].x < shape.dots[1][0].x && shape.dots[1][0].x < shape.dots[2][0].x)
    assert.ok(Math.abs(shape.dots[0][0].x + shape.dots[2][0].x - 1) < 1e-9 && Math.abs(shape.dots[1][0].x - 0.5) < 1e-9)

    /* The white one is white wherever it is anything: it is tinted like every other block's picture. */
    const white = dotsOf(bytes('mobile/assets/icons/nam.png'))
    let seen = 0
    for (let i = 0; i < white.dots.length; i += 4) {
      if (!white.dots[i + 3]) continue
      seen++
      assert.deepEqual([white.dots[i], white.dots[i + 1], white.dots[i + 2]], [255, 255, 255])
    }
    assert.ok(seen > 96 * 96 * 0.15 && seen < 96 * 96 * 0.7, `the white picture covers ${seen} dots`)
    /* Its corners are clear, and its middle dot is solid. */
    for (const [x, y] of [[0, 0], [95, 0], [0, 95], [95, 95]]) assert.equal(white.dots[(y * 96 + x) * 4 + 3], 0)
    const mid = shape.dots[1][1]
    assert.equal(white.dots[(Math.round(mid.y * 96) * 96 + Math.round(mid.x * 96)) * 4 + 3], 255)

    /* The coloured one: red at the left column, green in the middle, violet at the right, by the script's own stops. */
    assert.deepEqual([...NAM_RAINBOW], ['#ff5252', '#ff9f43', '#ffd93d', '#4cd97b', '#38c6f4', '#6f7bff', '#c86bff'])
    const own = dotsOf(bytes('mobile/assets/icons/nam-rainbow.png'))
    const dotAt = (d) => {
      const o = (Math.round(d.y * 192) * 192 + Math.round(d.x * 192)) * 4
      return [own.dots[o], own.dots[o + 1], own.dots[o + 2], own.dots[o + 3]]
    }
    const [lr, lg, lb, la] = dotAt(shape.dots[0][1])
    assert.ok(la === 255 && lr > 220 && lr > lg + 60 && lr > lb + 60, `the left column is ${[lr, lg, lb]}`)
    const [mr, mg, mb, ma] = dotAt(shape.dots[1][1])
    assert.ok(ma === 255 && mg > mr + 60 && mg > mb + 40, `the middle column is ${[mr, mg, mb]}`)
    const [rr, rg, rb, ra] = dotAt(shape.dots[2][1])
    assert.ok(ra === 255 && rb > 220 && rb > rg + 60 && rr > rg, `the right column is ${[rr, rg, rb]}`)
    /* And a dark edge under it, so the blue end reads on a lit purple tile: dots that are there in the coloured one, dark, where the shape itself is not. */
    let edge = 0
    let lit = 0
    for (let i = 0; i < own.dots.length; i += 4) {
      const a = own.dots[i + 3]
      if (!a) continue
      if (own.dots[i] + own.dots[i + 1] + own.dots[i + 2] === 0) edge++
      else lit++
    }
    assert.ok(edge > 500 && edge < lit, `the dark edge is ${edge} dots beside ${lit}`)
    /* A line lets none of the tile through: the edge's black is under it, so the middle of a line is solid enough to read on any fill (it was a fifth clear). */
    const [la0, lb0] = shape.lines[0]
    const half = (Math.round(((la0.y + lb0.y) / 2) * 192) * 192 + Math.round(((la0.x + lb0.x) / 2) * 192)) * 4
    assert.ok(own.dots[half + 3] >= 235, `the middle of a line is ${own.dots[half + 3]} of 255`)
    /* And the edge reaches past the shape by enough to hold the violet end on the block's own purple at the smallest picture: the outermost dot's edge, straight out to the right. */
    const last = shape.dots[2][1]
    const past = (Math.round(last.y * 192) * 192 + Math.round((last.x + 0.09 + 0.02) * 192)) * 4
    assert.deepEqual([own.dots[past], own.dots[past + 1], own.dots[past + 2]], [0, 0, 0])
    assert.ok(own.dots[past + 3] >= 170, `the edge beside the last dot is ${own.dots[past + 3]} of 255`)
    /* Small enough for a phone on a signal. */
    assert.ok(bytes('mobile/assets/icons/nam-rainbow.png').length < 20000 && bytes('mobile/assets/icons/nam.png').length < 4000)
    /* Drawn the same on every machine: no Math.hypot (only promised to be close) and nothing random or timed, so the run on GitHub draws what this one did. */
    assert.ok(!/Math\.(hypot|random)|Date\.|performance\./.test(read('scripts/nam-icon.mjs').replace(/\/\*[\s\S]*?\*\//g, ' ')))
    /* The script takes nothing from anywhere: zlib, a file to write, and its own path. */
    assert.deepEqual([...read('scripts/nam-icon.mjs').matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]), ['node:zlib', 'node:fs', 'node:url'])
  })

  test('nam picture: the phone’s tile draws the rainbow as it is, and the white one tinted wherever a tile is plainly one colour', async () => {
    const icons = flat(code(read('mobile/src/lib/blockIcons.js')))
    assert.match(icons, /import nam from '\.\.\/\.\.\/assets\/icons\/nam\.png' import namRainbow from '\.\.\/\.\.\/assets\/icons\/nam-rainbow\.png'/)
    assert.match(icons, /export const PHONE_ONLY = Object\.freeze\(\{ nam: 'nam', irplayer: 'cab', dynadist: 'drive', crossover: 'filter', tonematch: 'geq', vocoder: 'formant' \}\)/)
    assert.match(icons, /export const OWN_COLOURS = Object\.freeze\(\{ nam: namRainbow \}\)/)
    assert.match(icons, /export function blockIconOwn\(slug\) \{ return OWN_COLOURS\[String\(slug \|\| ''\)\.toLowerCase\(\)\] \|\| null \}/)
    /* The white file is in the list the block's name is looked up in. */
    assert.match(icons, /const FILES = \{[^}]*\breturnfx, nam \}/)

    const tile = flat(code(read('mobile/src/components/Tile.js')))
    assert.match(tile, /\bicon, iconOwn, bar = false,/)
    /* Its own colours unless the tile is one colour by rule: grey when off, and the quiet outline. */
    assert.match(tile, /const ownPicture = iconOwn && !quiet && !grey \? iconOwn : null/)
    assert.match(tile, /<Image key=\{ownPicture \? 'own' : 'tint'\} source=\{ownPicture \|\| icon\}/)
    /* No tint on it: a tint would paint the rainbow, and its dark edge, one flat colour. */
    assert.match(tile, /style=\{\{ width: picture, height: picture, marginBottom: 2, \.\.\.\(ownPicture \? null : \{ tintColor: quiet \? foreground : pictureTint \}\), \.\.\.\(cleared \? \{ opacity: 0 \} : null\) \}\}/)
    assert.equal((tile.match(/tintColor/g) || []).length, 1, 'the picture is tinted somewhere else')

    /* Every place the phone draws a block's picture hands the tile both. */
    for (const [file, call] of [
      ['mobile/src/screens/Stage.js', /icon=\{showIcons \? blockIcon\(block\.slug\) : undefined\} iconOwn=\{showIcons \? blockIconOwn\(block\.slug\) : undefined\}/],
      ['mobile/src/components/Colours.js', /icon=\{icons \? blockIcon\(f\) : undefined\} iconOwn=\{icons \? blockIconOwn\(f\) : undefined\}/],
      ['mobile/src/components/ColourSheet.js', /icon=\{loadIcons\(sync\) \? blockIcon\(target\.slug\) : undefined\} iconOwn=\{loadIcons\(sync\) \? blockIconOwn\(target\.slug\) : undefined\}/]
    ]) {
      const text = flat(code(read(file)))
      assert.match(text, call, file)
      assert.match(text, /import \{ blockIcon, blockIconOwn \} from '\.\.\/lib\/blockIcons'/, file)
    }
    /* And nowhere else on the phone asks for a block's picture without it (the looper's has none of its own). */
    const stage = flat(code(read('mobile/src/screens/Stage.js')))
    assert.equal((stage.match(/blockIcon\(/g) || []).length, 2)
    assert.match(stage, /icon=\{showIcons \? blockIcon\('looper'\) : undefined\}/)
  })

  test('nam picture: the browser draws the same two by the same rule, and its list is the phone’s', async () => {
    const { OWN_COLOURS, OWN_ICON } = await import('../shared/own-blocks.mjs')
    assert.deepEqual([...OWN_COLOURS], ['nam'])
    assert.equal(OWN_ICON.nam, 'nam')
    /* The phone's list, name for name. */
    const phones = /export const OWN_COLOURS = Object\.freeze\(\{([^}]*)\}\)/.exec(read('mobile/src/lib/blockIcons.js'))[1]
    assert.deepEqual([...phones.matchAll(/(\w+):/g)].map((m) => m[1]), [...OWN_COLOURS])
    /* Every block with a picture of its own colours has a white one too, at both ends. */
    for (const slug of OWN_COLOURS) assert.equal(OWN_ICON[slug], slug)

    const icons = flat(code(read('src/lib/blockIcons.js')))
    assert.match(icons, /import nam from '\.\.\/\.\.\/mobile\/assets\/icons\/nam\.png' import namRainbow from '\.\.\/\.\.\/mobile\/assets\/icons\/nam-rainbow\.png'/)
    assert.match(icons, /const OWN_FILES = \{ nam: namRainbow \}/)
    assert.match(icons, /export function blockIconOwn\(slug\) \{ const key = String\(slug \|\| ''\)\.toLowerCase\(\) return OWN_COLOURS\.includes\(key\) \? OWN_FILES\[key\] \|\| null : null \}/)
    /* What the picture's element wears, run: the function has no picture in it, so it is lifted out and called. */
    const body = /export function pictureWears\(icon, own\) \{([\s\S]*?)\n\}/.exec(read('src/lib/blockIcons.js'))[1]
    const pictureWears = Function('icon', 'own', body)
    assert.deepEqual(pictureWears('/a.png', null), { className: 'gig-block-icon', style: { WebkitMaskImage: 'url(/a.png)', maskImage: 'url(/a.png)' } })
    assert.deepEqual(pictureWears('/a.png', '/b.png'), { className: 'gig-block-icon gig-block-icon-own', style: { '--pic': 'url(/a.png)', '--pic-own': 'url(/b.png)' } })

    /* The three places the browser draws a block's picture. */
    const gig = flat(code(read('src/components/Gig.jsx')))
    assert.match(gig, /icon=\{icons \? blockIcon\(block\.slug\) : null\} own=\{icons \? blockIconOwn\(block\.slug\) : null\}/)
    assert.match(gig, /function BlockTile\(\{ block, channels, busy, outline = false, onToggle, onHold, icon, own = null, door = false, boost = null \}\)/)
    assert.match(gig, /<span ref=\{pictureRef\} \{\.\.\.pictureWears\(icon, own\)\} aria-hidden="true" data-said=\{shows\.middle \? 'yes' : undefined\} \/>/)
    assert.match(flat(code(read('src/components/Colours.jsx'))), /<span \{\.\.\.pictureWears\(icon, blockIconOwn\(f\)\)\} aria-hidden="true" \/>/)
    assert.match(flat(code(read('src/components/ColourSheet.jsx'))), /<span \{\.\.\.pictureWears\(blockIcon\(target\.slug\), blockIconOwn\(target\.slug\)\)\} \/>/)
    /* No picture element left that is a mask whatever the block. */
    for (const f of ['src/components/Gig.jsx', 'src/components/Colours.jsx', 'src/components/ColourSheet.jsx']) assert.ok(!/className="gig-block-icon"/.test(read(f)), f)

    /* The styles: drawn as it is, outranking the rules that colour a mask (an unlit tile's), and its white twin in the grey when the tile is grey when off. */
    const css = flat(read('src/styles.css').replace(/\/\*[\s\S]*?\*\//g, ' '))
    assert.match(css, /\.gig-block-icon\.gig-block-icon-own\.gig-block-icon-own, button\.gig-block\.off \.gig-block-icon\.gig-block-icon-own \{ background-color: transparent; background-image: var\(--pic-own\); background-size: contain; background-repeat: no-repeat; background-position: center; -webkit-mask-image: none; mask-image: none; \}/)
    assert.match(css, /:root button\.gig-block\.off\[data-off='grey'\] \.gig-block-icon\.gig-block-icon-own \{ background-image: none; background-color: var\(--off-ink\); -webkit-mask-image: var\(--pic\); mask-image: var\(--pic\); \}/)
    /* The rules it has to outrank are still the ones it was written against. */
    assert.match(css, /button\.gig-block\.off \.gig-block-icon \{ background-color: color-mix\(in srgb, var\(--block-fill, currentColor\) 65%, var\(--silk\)\); \}/)
    assert.match(css, /:root button\.gig-block\.off\[data-off='grey'\] \.gig-block-icon \{ background-color: var\(--off-ink\); \}/)
  })
}
