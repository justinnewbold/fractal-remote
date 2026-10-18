/**
 * The colours: that they are Fractal's, that they can be read, and that the
 * ones a player chooses are kept and come back.
 *
 * "I feel like the button and effects pedal colors dont match the colors on
 * real fractal units." Every colour here is a claim about something — the
 * unit's own screen, the editors' pictures, a look somebody picked for a
 * bright stage — and every one of them is drawn behind letters, at the far
 * end of a stage, in the dark and in daylight. A number in a script that says
 * the letters read is not the same as a test that fails the day they stop
 * reading, so the sums the palettes were built by are run again here, against
 * the colours as each end actually draws them: the browser's gradients read
 * out of styles.css, the phone's glass read out of its Tile.
 *
 * And "make sure you preserve the current colors and make a theme on that one
 * called fractal remote": that look is the one thing here held to exact
 * values rather than to rules, because it is the app as it was and Justin
 * likes it as it was.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/* The pages the tiles sit on, both ends, both themes (styles.css :root and
   [data-theme='light']; mobile/src/lib/theme.js DARK and LIGHT). */
const DARK_PAGES = ['#0d0f12', '#15181d']
const LIGHT_PAGES = ['#f2efe9', '#faf8f4', '#f4f2ee', '#ffffff']

/* Every slug the app coloured up to 1.87.38, with the fill it had: Fractal
   Remote is held to these exactly. Copied from src/lib/blockColors.js as it
   was on main, so a change to the look has to change this too, on purpose. */
const BEFORE = {
  drive: '#c23b26', amp: '#7d8591', delay: '#2857c9', reverb: '#5a3fc0', comp: '#8f8a2f', compressor: '#8f8a2f',
  chorus: '#2f8f9c', flanger: '#a2439a', phaser: '#3f8a4f', wah: '#3f63c8', filter: '#3f63c8', cab: '#3f8f5c',
  geq: '#c07a2a', peq: '#c07a2a', eq: '#c07a2a', tremolo: '#8a5fb0', rotary: '#8a5fb0', pitch: '#a04f8a',
  synth: '#a04f8a', multitap: '#2a7f9c', megatap: '#2a7f9c', plex: '#2a7f9c', plexdelay: '#2a7f9c', gate: '#6f7480',
  ingate: '#6f7480', volume: '#6f7480', volpan: '#6f7480', mixer: '#6f7480', looper: '#6f7480', enhancer: '#4a8f7a',
  input: '#555b66', output: '#555b66', ringmod: '#4a5fb8', formant: '#4a5fb8', multicomp: '#2f8f8f',
  crossover: '#2f8f8f', tentap: '#2a7f9c', resonator: '#2a7f9c', send: '#555b66', return: '#555b66',
  multiplexer: '#555b66', shunt: '#555b66'
}
const BEFORE_SCENES = ['#b5502f', '#8f6a24', '#4f7a35', '#2f7a6b', '#2f5f9c', '#56409c', '#94357a', '#5d626b']

/* A unit slug for each palette, to put the colours on that kind of unit. */
const UNIT_OF = { gen3: 'fm3', am4: 'am4', vp4: 'vp4', gen2: 'axefxii' }

/** An empty store the colours can be written to and read back from, like localStorage. */
const memory = (seed = {}) => {
  const kept = { ...seed }
  return { kept, getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => (kept[k] = String(v)) }
}

export function run(test) {
  const load = async () => {
    const [palettes, ink, looks, blocks, scenes] = await Promise.all([
      import('../src/lib/blockPalettes.js'),
      import('../src/lib/ink.js'),
      import('../src/lib/looks.js'),
      import('../src/lib/blockColors.js'),
      import('../src/lib/sceneColors.js')
    ])
    /* A clean start: nothing chosen, no unit. Every test here begins from it,
       because the colours are one module-wide store and other tests (the
       demo's detect among them) tell it which unit answered. */
    looks.loadLooks(memory())
    looks.setColourUnit(null)
    return { ...palettes, ...ink, ...looks, ...blocks, ...scenes }
  }

  /** Every look but Fractal Remote, with the table it wears on each kind of unit. */
  const everyLookAndUnit = (c) => {
    const out = []
    for (const look of c.LOOKS) {
      if (look.id === c.FRACTAL_REMOTE_LOOK) continue
      for (const unit of c.PALETTE_IDS) out.push({ look, unit })
    }
    return out
  }

  /** Each family's colour as the app resolves it for that look on that unit. */
  const resolved = (c, look, unit) => {
    c.setLook(look.id)
    c.setColourUnit(UNIT_OF[unit])
    const slugs = [...c.FAMILIES, ...(unit === 'gen2' ? ['quadchorus'] : [])]
    return slugs.map((slug) => ({ slug, ...c.blockColor(slug) }))
  }

  /*
   * THE GRADIENTS AS THE STYLESHEET WRITES THEM. Each end of the edit strip's
   * tile is `var(--tile)` or `color-mix(in srgb, var(--tile) N%, white|black)`;
   * this reads both ends of the rule named and returns what each one draws for
   * a given fill — the same sRGB mix the browser does.
   */
  const gradient = (c, css, selector) => {
    const at = css.indexOf(`${selector} {`)
    assert.ok(at >= 0, `styles.css has no ${selector} rule for this test to read`)
    const body = css.slice(at, css.indexOf('}', at))
    const m = /background: linear-gradient\(180deg, ([^;]+)\);/.exec(body)
    assert.ok(m, `${selector} is no longer a gradient this test can read`)
    /* Split on the commas between stops, not the ones inside a color-mix(). */
    const stops = []
    let depth = 0
    let from = 0
    for (let i = 0; i < m[1].length; i++) {
      if (m[1][i] === '(') depth++
      else if (m[1][i] === ')') depth--
      else if (m[1][i] === ',' && depth === 0) {
        stops.push(m[1].slice(from, i).trim())
        from = i + 1
      }
    }
    stops.push(m[1].slice(from).trim())
    assert.equal(stops.length, 2, `${selector} has ${stops.length} stops; this reads two`)
    return (fill) =>
      stops.map((stop) => {
        if (stop.trim() === 'var(--tile)') return fill
        const mix = /color-mix\(in srgb, var\(--tile\) (\d+)%, (white|black)\)/.exec(stop)
        assert.ok(mix, `${selector}: a stop this test cannot read — ${stop}`)
        return c.mix(fill, mix[2] === 'white' ? '#ffffff' : '#000000', 1 - Number(mix[1]) / 100)
      })
  }

  /* The phone's glass: a white sheen over a black-lettered tile, a dark shade under a white-lettered one. */
  const glass = () => {
    const tile = read('mobile/src/components/Tile.js')
    const alpha = (name) => {
      const m = new RegExp(`const ${name} = 'rgba\\((\\d+),(\\d+),(\\d+),([\\d.]+)\\)'`).exec(tile)
      assert.ok(m, `Tile.js has no ${name} this test can read`)
      return { rgb: m[1] === '255' ? '#ffffff' : '#000000', alpha: Number(m[4]) }
    }
    return { sheen: alpha('SHEEN'), shade: alpha('SHADE') }
  }

  /** Every surface a lit tile in this colour is drawn on, both ends, both themes. */
  const surfaces = (c, css, fill, ink) => {
    const white = ink === c.LIGHT_INK
    const dark = gradient(c, css, white ? "button.fx-tile[data-shade='down']" : 'button.fx-tile')(fill)
    const light = gradient(c, css, white ? "[data-theme='light'] button.fx-tile" : "[data-theme='light'] button.fx-tile[data-shade='up']")(fill)
    const { sheen, shade } = glass()
    const phone = white ? [fill, c.mix(fill, shade.rgb, shade.alpha)] : [c.mix(fill, sheen.rgb, sheen.alpha), fill]
    return { 'Play (flat)': [fill], 'edit strip, dark': dark, 'edit strip, light': light, phone }
  }

  test('every colour in every palette, look and swatch is plain #rrggbb', async () => {
    /* A Cyrillic а slipped into a hex once: identical on screen, invalid to
       CSS and to React Native, and the colour just never appears. And the
       phone cannot draw a CSS variable at all, which is what an unknown block
       used to be. */
    const c = await load()
    const hex = /^#[0-9a-f]{6}$/
    const all = []
    for (const [id, table] of Object.entries(c.PALETTES)) for (const [k, v] of Object.entries(table)) all.push([`${id}.${k}`, v])
    for (const look of c.LOOKS) {
      for (const [k, v] of Object.entries(look.families)) all.push([`${look.id}.${k}`, v])
      for (const [u, table] of Object.entries(look.byUnit || {})) for (const [k, v] of Object.entries(table)) all.push([`${look.id}.${u}.${k}`, v])
      look.scenes.forEach((v, i) => all.push([`${look.id}.scene${i + 1}`, v]))
      assert.equal(look.scenes.length, 8, `${look.id} has ${look.scenes.length} scene colours`)
    }
    for (const s of c.SWATCHES) all.push([`swatch ${s.name}`, s.fill])
    all.push(['NEUTRAL', c.NEUTRAL.fill])
    for (const [where, v] of all) assert.match(v, hex, `${where}: "${v}" is not a colour both ends can draw`)
    assert.ok(all.length > 800, `only ${all.length} colours were checked`)
  })

  test('every look has a name a guitarist reads, no brand in it, and Match my unit comes first, Fractal Remote second', async () => {
    const c = await load()
    assert.deepEqual(
      c.LOOKS.map((l) => l.name),
      ['Match my unit', 'Fractal Remote', 'Footswitch lights', 'Colour-blind safe', 'Sunlight', 'Stompbox']
    )
    assert.equal(c.DEFAULT_LOOK, 'unit')
    assert.equal(c.lookId(), 'unit', 'somebody who never chose a look is not in Match my unit')
    /* App Store 4.1 and 5.2.1: a look named after a pedal maker's pedal is a trademark in a menu. */
    const brands = /tube ?screamer|ibanez|boss|mxr|electro-?harmonix|strymon|eventide|fulltone|klon|line ?6|helix|kemper|neural|marshall|fender|vox|mesa|tc electronic|dunlop|ehx/i
    for (const l of c.LOOKS) {
      assert.ok(!brands.test(`${l.name} ${l.why}`), `${l.name} names a brand`)
      assert.ok(l.why && l.why.length < 200, `${l.name} has no short why, or a long one`)
      assert.ok(!/this phone/i.test(l.why), `${l.name} says "this phone" (CLAUDE.md: deviceNoun)`)
    }
    assert.ok(!c.LOOKS.some((l) => /classic/i.test(`${l.id} ${l.name}`)), 'the app’s own look is called Classic again')
  })

  test('the palette follows the unit, by the slug setlists are filed under', async () => {
    const c = await load()
    for (const slug of ['fm3', 'fm9', 'axefxiii', 'axefx3', 'device']) assert.equal(c.paletteFor(slug), 'gen3', slug)
    assert.equal(c.paletteFor('am4'), 'am4')
    assert.equal(c.paletteFor('vp4'), 'vp4')
    for (const slug of ['axefxii', 'iixl', 'ax8', 'fx8', 'fx8ii']) assert.equal(c.paletteFor(slug), 'gen2', slug)
    assert.equal(c.paletteFor('somethingnew'), 'gen3', 'a unit nobody has heard of has no colours')
    assert.equal(c.paletteFor(undefined), 'gen3')
    /* And the slug is the one shared/device-slug makes of what the unit says. */
    const { deviceSlug } = await import('../shared/device-slug.mjs')
    assert.equal(c.paletteFor(deviceSlug({ short: 'Axe-Fx III' })), 'gen3')
    assert.equal(c.paletteFor(deviceSlug({ short: 'AM4' })), 'am4')
    assert.equal(c.paletteFor(deviceSlug({ short: 'II XL+' })), 'gen2')
  })

  test('the colours Fractal draws are pinned where the whole look rests on them', async () => {
    const c = await load()
    assert.equal(c.PALETTES.am4.drive, '#ce0201', 'the AM4’s pure red drive')
    assert.equal(c.PALETTES.am4.delay, '#1451ff', 'the AM4’s royal blue delay')
    assert.equal(c.PALETTES.gen3.amp, '#876042', 'the brown amp of the FM3’s own screen, a shade off the browser’s Light-page amber')
    /* Silver off the AM4, a few shades deeper — the app's own reading of it. */
    assert.equal(c.PALETTES.am4.amp, '#7d8591')
    assert.equal(c.PALETTES.vp4.amp, '#7d8591')
    assert.equal(c.SCENE_RED, '#cc0000', 'FM3-Edit’s led-ring-red.svg')
    for (const id of ['unit', 'rings']) assert.deepEqual([...c.lookById(id).scenes], Array(8).fill('#cc0000'), `${id}: every scene is the scene switches’ red`)
    c.setColourUnit('am4')
    assert.deepEqual(c.blockColor('drive'), { fill: '#ce0201', ink: '#ffffff' })
    assert.deepEqual(c.sceneColor(5), { fill: '#cc0000', ink: '#ffffff' })
    /* The amp's letters are the app's choice, black on the pale silver. */
    assert.equal(c.blockColor('amp').ink, c.DARK_INK)
  })

  test('every look, on every unit, has letters at 4.5:1 on every surface a lit tile is drawn on', async () => {
    /*
     * Not just the flat colour. The edit strip draws a gradient and the phone
     * lays glass over the tile, and the plan's own numbers came in at 3.4–3.9
     * once a gradient's lighter end was under white letters. Both ends of
     * every gradient, read out of styles.css and Tile.js, dark and light.
     */
    const c = await load()
    const css = read('src/styles.css')
    const misses = []
    let checked = 0
    for (const { look, unit } of everyLookAndUnit(c)) {
      for (const { slug, fill, ink } of resolved(c, look, unit)) {
        assert.equal(ink, c.inkOn(fill), `${look.id}/${unit}/${slug}: letters not chosen by the app`)
        for (const [where, ends] of Object.entries(surfaces(c, css, fill, ink))) {
          for (const end of ends) {
            checked++
            const r = c.contrast(ink, end)
            if (r < 4.5) misses.push(`${look.name} on ${unit}: ${slug} ${fill} (${where}, ${end}) ${r.toFixed(2)}:1`)
          }
        }
      }
      for (let i = 0; i < 8; i++) {
        const { fill, ink } = c.sceneColor(i)
        for (const [where, ends] of Object.entries(surfaces(c, css, fill, ink))) {
          if (where.startsWith('edit strip')) continue
          for (const end of ends) {
            checked++
            const r = c.contrast(ink, end)
            if (r < 4.5) misses.push(`${look.name}: scene ${i + 1} ${fill} (${where}) ${r.toFixed(2)}:1`)
          }
        }
      }
    }
    assert.deepEqual(misses, [], `letters under 4.5:1:\n  ${misses.join('\n  ')}`)
    assert.ok(checked > 5000, `only ${checked} surfaces were measured`)
    /* Measured at full strength because that is how they are drawn: the live
       scene's words were its letters at 85%, 4.45:1 on Fractal's red. */
    assert.match(
      css,
      /:root:not\(\[data-look='fractalremote'\]\) button\.gig-scene\.named\.current \.gig-scene-num,\n:root:not\(\[data-look='fractalremote'\]\) button\.gig-scene\.current \.gig-scene-name \{\n  opacity: 1;\n\}/,
      'the live scene’s words are drawn faded again in the new looks'
    )
  })

  test('the quiet words on an unlit tile — a scene’s number, Off, the channel — read at 4.5:1 on its wash', async () => {
    /*
     * An unlit tile is a seventh of its colour over the page, and the brighter
     * colours of the new looks lift it: the dim grey on it came to 4.2 on the
     * phone's Light page in Match my unit and 3.2 on the browser's dark page
     * in Sunlight. The phone takes the grey toward the lettering colour just
     * far enough for the tile it is on (lib/ink enoughOn); the browser's dark
     * page draws the unlit scene number half way there for every look.
     */
    const c = await load()
    const misses = []
    const phone = { dark: { page: ['#0d0f12', '#15181d'], dim: '#878d97', full: '#e6e3dc' }, light: { page: ['#f4f2ee', '#ffffff'], dim: '#5b626c', full: '#1b1e23' } }
    const BROWSER_DARK_NUMBER = c.mix('#e6e3dc', '#878d97', 0.5)
    for (const { look, unit } of everyLookAndUnit(c)) {
      const fills = [...resolved(c, look, unit).filter(({ slug }) => !c.quietEnd(slug)).map((r) => r.fill), ...Array.from({ length: 8 }, (_, i) => c.sceneColor(i).fill)]
      for (const fill of fills) {
        for (const [theme, t] of Object.entries(phone)) {
          const grounds = t.page.map((p) => c.mix(p, fill, 0.14))
          const ink = c.enoughOn(t.dim, t.full, grounds)
          for (const g of grounds) if (c.contrast(ink, g) < 4.5) misses.push(`phone ${theme}: ${look.name} ${fill} ${c.contrast(ink, g).toFixed(2)}:1`)
        }
      }
      for (let i = 0; i < 8; i++) {
        const fill = c.sceneColor(i).fill
        const dark = c.contrast(BROWSER_DARK_NUMBER, c.mix('#15181d', fill, 0.14))
        if (dark < 4.5) misses.push(`browser dark: ${look.name} scene ${i + 1} ${fill} ${dark.toFixed(2)}:1`)
        const light = c.contrast('#4d525a', c.mix('#faf8f4', fill, 0.14))
        if (light < 4.5) misses.push(`browser light: ${look.name} scene ${i + 1} ${fill} ${light.toFixed(2)}:1`)
      }
    }
    assert.deepEqual(misses, [], `quiet words under 4.5:1:\n  ${misses.join('\n  ')}`)
    /* Only as far as it has to go: on the dark stage most tiles keep the grey itself. */
    assert.equal(c.enoughOn('#878d97', '#e6e3dc', ['#15181d']), '#878d97')
    /* And drawn that way. */
    const tile = read('mobile/src/components/Tile.js')
    assert.match(tile, /: enoughOn\(color\.silkDim, color\.silk, \[mix\(color\.chassis, hue, 0\.14\), mix\(color\.panel, hue, 0\.14\)\]\)/, 'the phone’s quiet words are the dim grey whatever the tile')
    assert.equal((tile.match(/on \? lit : quietWords/g) || []).length, 3, 'the number, the line under the name and the corner words are not all drawn readable')
    const css = read('src/styles.css')
    assert.match(css, /:root:not\(\[data-theme='light'\]\):not\(\[data-look='fractalremote'\]\) button\.gig-scene\.named:not\(\.current\) \.gig-scene-num \{\n  color: color-mix\(in srgb, var\(--silk\) 50%, var\(--silk-dim\)\);/, 'the browser’s unlit scene number is the faint grey again')
  })

  test('the face is shaded away from its letters, never toward them, on both ends', async () => {
    const css = read('src/styles.css')
    const rule = (sel) => css.slice(css.indexOf(sel + ' {'), css.indexOf('}', css.indexOf(sel + ' {')))
    assert.match(rule('button.fx-tile'), /color: var\(--tile-ink, #fff\);/, 'the strip writes white letters on every tile again')
    assert.match(rule("[data-theme='light'] button.fx-tile"), /color: var\(--tile-ink, #fff\);/, 'the Light strip writes white letters on every tile again')
    const console_ = read('src/components/Console.jsx')
    assert.match(console_, /'--tile-ink': inkFor\(block\.slug\)/, 'the strip does not hand its tiles their letters')
    assert.match(console_, /data-shade=\{shadeFor\(block\.slug\)\}/, 'the strip does not say which way a tile is shaded')
    assert.match(console_, /isFractalRemoteLook\(\) && !blockColor\(slug\)\.picked \? undefined : inkFor\(slug\) === LIGHT_INK \? 'down' : 'up'/, 'Fractal Remote is shaded like the new looks, or a colour picked on top of it the old way')
    const tile = read('mobile/src/components/Tile.js')
    assert.match(tile, /const shadeBelow = !lift && lit === LIGHT_INK/, 'the phone lays a white sheen over white letters')
    assert.match(tile, /backgroundColor: shadeBelow \? SHADE : SHEEN/)
  })

  test('a switched-off tile’s edge stands 3:1 off the page in both themes, on both ends', async () => {
    /*
     * The phone's off edge was the colour at 55%, 1.7:1 on the stage; the
     * browser's unlit scene 40%, 1.34:1; a pale look on the Light page 1.13:1.
     * The edge is the only thing still naming an unlit tile.
     */
    const c = await load()
    const misses = []
    const edges = (where, fill) => {
      for (const page of DARK_PAGES) {
        const r = c.contrast(fill, page)
        if (r < 3) misses.push(`${where} ${fill} on ${page}: ${r.toFixed(2)}:1`)
      }
      for (const page of LIGHT_PAGES) {
        const r = c.contrast(c.paperEdge(fill), page)
        if (r < 3) misses.push(`${where} ${fill} (edge ${c.paperEdge(fill)}) on ${page}: ${r.toFixed(2)}:1`)
      }
    }
    for (const { look, unit } of everyLookAndUnit(c)) {
      for (const { slug, fill } of resolved(c, look, unit)) {
        /* The two ends are an outline in the page's own rule colour, never their fill. */
        if (c.quietEnd(slug)) continue
        edges(`${look.name} on ${unit}: ${slug}`, fill)
      }
      for (let i = 0; i < 8; i++) edges(`${look.name}: scene ${i + 1}`, c.sceneColor(i).fill)
    }
    for (const s of c.SWATCHES) edges(`swatch ${s.name}`, s.fill)
    assert.deepEqual(misses, [], `edges under 3:1:\n  ${misses.join('\n  ')}`)

    /* As drawn: the stylesheet's half-way-to-black is lib/ink's, and the phone uses lib/ink's. */
    assert.equal(c.PAPER_EDGE, 0.5)
    const css = read('src/styles.css')
    const paper = css.match(/\[data-theme='light'\]:not\(\[data-look='fractalremote'\]\)[^{]*\{\s*border-color: color-mix\(in srgb, var\(--[\w-]+(?:, var\(--rule\))?\) (\d+)%, black\);/g) || []
    assert.ok(paper.length >= 3, 'the Light page’s darker edges are gone')
    for (const r of paper) assert.match(r, /50%, black/, `a Light-page edge is not half way to black: ${r}`)
    assert.match(css, /:root:not\(\[data-look='fractalremote'\]\) button\.gig-scene \{\s*border-color: var\(--scene-fill, var\(--rule\)\);/, 'an unlit scene’s edge is faint again')
    assert.match(css, /button\.gig-block\.off \{\s*border: 2px solid var\(--block-fill, var\(--rule\)\);/, 'a switched-off effect lost its full-colour ring')
    const tile = read('mobile/src/components/Tile.js')
    assert.match(tile, /if \(!isDark\(\)\) return paperEdge\(hue\)/, 'the phone’s Light page has no darker edge')
    assert.match(tile, /return on \? at\(hue, 0\.85\) : hue\n/, 'the phone’s unlit edge is not the colour itself')
  })

  test('every swatch on offer has letters at 4.5:1, and there are twenty-four', async () => {
    const c = await load()
    for (const s of c.SWATCHES) {
      const ink = c.inkOn(s.fill)
      assert.ok(c.contrast(s.fill, ink) >= 4.5, `${s.name} ${s.fill}: ${c.contrast(s.fill, ink).toFixed(2)}:1`)
    }
    assert.equal(c.RING_SWATCHES.length, 11, 'Fractal has eleven ring colours')
    assert.equal(c.UNIT_SWATCHES.length, 12)
    const grid = c.swatchesFor('#bf2f23')
    assert.equal(grid.length, 24, 'the colour sheet is not six by four')
    assert.deepEqual(grid[0], { name: 'Unit', fill: '#bf2f23', own: true }, 'the look’s own colour is not first')
    /* Never the same colour twice: a sheet that opens with two squares ticked reads as two colours picked. */
    for (const own of ['#cc0000', '#CC0000', c.PALETTES.am4.delay]) {
      const twice = c.swatchesFor(own, { scene: true }).filter((s) => s.fill === own.toLowerCase() || s.fill === own)
      assert.equal(twice.length, 1, `${own} is offered twice`)
    }
    assert.equal(c.swatchesFor('#cc0000', { scene: true }).length, 22, 'a scene in Match my unit is not offered the twenty-two')
    /* Fractal's own ring fills, from FM3-Edit's led-ring-*.svg; Purple lifted so a lit one stands off an unlit one. */
    assert.deepEqual(
      c.RING_SWATCHES.map((s) => s.fill),
      ['#cc0000', '#ff9933', '#ffff00', '#66cc33', '#0055ff', '#00ccff', '#7345dd', '#ffffff', '#ff99cc', '#009999', '#ccff33']
    )
    /* The unit's colours as the app draws them, not as some other table has them. */
    assert.equal(c.UNIT_SWATCHES.find((s) => s.name === 'Amp silver').fill, c.PALETTES.am4.amp)
    assert.equal(c.UNIT_SWATCHES.find((s) => s.name === 'Chorus blue').fill, c.PALETTES.am4.chorus)
  })

  test('nothing any look paints, and no swatch a scene is offered, is the app’s amber', async () => {
    /*
     * Amber is the audio path, the selected block and the live scene's ring.
     * A tile within 10 of it (CIEDE2000), in either theme, hides the very
     * ring that says it is the one selected.
     */
    const c = await load()
    const near = []
    const check = (where, fill) => {
      for (const amber of c.AMBERS) {
        const d = c.deltaE(fill, amber)
        if (d < 10) near.push(`${where} ${fill} is ${d.toFixed(1)} from ${amber}`)
      }
    }
    /*
     * The one effect let off, and only off the browser's darker Light-page
     * amber: gen-2's gate, which is already a step yellower than Fractal's
     * and would be a mustard 6 further from it to clear this one too
     * (blockPalettes says so where it sits). Held where it is, so it cannot
     * creep closer. Scenes and the swatches a scene is offered have no such
     * excuse.
     */
    const LET_OFF = { 'Match my unit on gen2: gate': '#9c5f12' }
    for (const { look, unit } of everyLookAndUnit(c)) {
      for (const { slug, fill } of resolved(c, look, unit)) {
        if (c.quietEnd(slug)) continue
        const where = `${look.name} on ${unit}: ${slug}`
        if (LET_OFF[where]) {
          assert.ok(c.deltaE(fill, LET_OFF[where]) >= 9.2, `${where} has crept closer to ${LET_OFF[where]}`)
          for (const amber of c.AMBERS.filter((a) => a !== LET_OFF[where])) assert.ok(c.deltaE(fill, amber) >= 10, `${where} is ${c.deltaE(fill, amber).toFixed(1)} from ${amber}`)
          continue
        }
        check(where, fill)
      }
      for (let i = 0; i < 8; i++) check(`${look.name}: scene ${i + 1}`, c.sceneColor(i).fill)
    }
    for (const s of c.SWATCHES.filter((x) => x.scene !== false)) check(`scene swatch ${s.name}`, s.fill)
    assert.deepEqual(near, [], `too close to the amber:\n  ${near.join('\n  ')}`)

    /*
     * AND AS DRAWN, not only flat. The edit strip lightens the top of a tile
     * with black letters by an eighth of white, and that is the half the
     * amber ring sits round when the block is selected: Stompbox's phaser and
     * Sunlight's ring mod were 10.6 and 11.0 flat and 7.0 at the top. Both
     * ends of the strip's gradient against the ring's amber in each theme,
     * and the phone's glass on a scene against the phone's two (the live
     * scene is the one ringed there).
     */
    const styles = read('src/styles.css')
    const drawn = []
    const against = (where, ends, ambers) => {
      for (const end of ends) for (const amber of ambers) {
        const d = c.deltaE(end, amber)
        if (d < 10) drawn.push(`${where} drawn ${end} is ${d.toFixed(1)} from ${amber}`)
      }
    }
    const { sheen, shade } = glass()
    for (const { look, unit } of everyLookAndUnit(c)) {
      for (const { slug, fill, ink } of resolved(c, look, unit)) {
        if (c.quietEnd(slug)) continue
        const white = ink === c.LIGHT_INK
        const where = `${look.name} on ${unit}: ${slug}`
        against(where, gradient(c, styles, white ? "button.fx-tile[data-shade='down']" : 'button.fx-tile')(fill), ['#f0a73c'])
        const light = gradient(c, styles, white ? "[data-theme='light'] button.fx-tile" : "[data-theme='light'] button.fx-tile[data-shade='up']")(fill)
        if (LET_OFF[where]) for (const end of light) assert.ok(c.deltaE(end, LET_OFF[where]) >= 9.2, `${where} has crept closer to ${LET_OFF[where]} as drawn`)
        else against(where, light, ['#9c5f12'])
      }
      for (let i = 0; i < 8; i++) {
        const { fill, ink } = c.sceneColor(i)
        const phone = ink === c.LIGHT_INK ? [fill, c.mix(fill, shade.rgb, shade.alpha)] : [c.mix(fill, sheen.rgb, sheen.alpha), fill]
        against(`${look.name}: scene ${i + 1}`, phone, ['#f0a73c', '#a8650a'])
      }
    }
    assert.deepEqual(drawn, [], `too close to the amber as drawn:\n  ${drawn.join('\n  ')}`)
    /* All three: the dark page's, the phone's Light page (theme.js) and the browser's (styles.css), which is darker still. */
    assert.deepEqual(c.AMBERS, ['#f0a73c', '#a8650a', '#9c5f12'], 'the ambers this checks against are not the app’s')
    const css = read('src/styles.css')
    assert.match(css, /:root \{[\s\S]*?--signal: #f0a73c;/)
    assert.match(css, /\[data-theme='light'\] \{[\s\S]*?--signal: #9c5f12;/, 'the browser’s Light-page amber is not the one checked')
    assert.match(read('mobile/src/lib/theme.js'), /signal: '#a8650a'/, 'the phone’s Light-page amber is not the one checked')
    assert.ok(!c.swatchesFor('#cc0000', { scene: true }).some((s) => s.name === 'Orange'), 'a scene is offered the amber-like orange')
  })

  test('Colour-blind safe keeps scenes side by side apart in every vision, and a four-scene unit’s four', async () => {
    /*
     * The look is named for exactly this, and an AM4 or a VP4 has four scenes:
     * the orange and the olive were scenes 1 and 4, and to a red-green
     * colour-blind eye they are one colour (3.5 apart). Side by side is one,
     * two or four places apart — beside or above one another on Play.
     */
    const c = await load()
    const far = (a, b) => Math.min(...c.VISIONS.map((v) => c.deltaE(c.seenWith(a, v), c.seenWith(b, v))))
    const scenes = c.lookById('cvd').scenes
    const misses = []
    for (let i = 0; i < 8; i++) {
      for (let j = i + 1; j < 8; j++) {
        const d = far(scenes[i], scenes[j])
        if ([1, 2, 4].includes(j - i) && d < 30) misses.push(`scenes ${i + 1} and ${j + 1}, side by side, ${d.toFixed(1)}`)
        if (j < 4 && d < 20) misses.push(`scenes ${i + 1} and ${j + 1}, two of a four-scene unit’s, ${d.toFixed(1)}`)
      }
    }
    assert.deepEqual(misses, [], `too alike for some colour-blind players:\n  ${misses.join('\n  ')}`)
  })

  test('two of a unit’s own effects closer than 8 are only the pairs named here', async () => {
    /*
     * Fractal draws some pairs close itself — the gen-3 Flanger and Ten-Tap,
     * the AM4's Delay and EQ — and the stage lift draws more close, because a
     * window that narrow leaves little lightness to tell pedals apart by
     * (blockPalettes, WHAT THE LIFT COSTS). They are written down rather than
     * hidden, so a change that crowds two more pedals together fails here, and
     * one that separates a pair says so by asking to be taken off the list.
     */
    const c = await withPage()
    const FRACTALS_OWN = {
      gen3: ['wah return', 'flanger tentap', 'flanger ringmod', 'phaser synth', 'tremolo looper'],
      am4: ['delay geq', 'reverb geq', 'flanger filter'],
      vp4: ['delay geq', 'reverb geq', 'flanger filter'],
      gen2: ['cab looper', 'wah volpan', 'phaser synth', 'tremolo looper', 'geq multitap', 'geq fxloop', 'formant send']
    }
    const THE_LIFTS = {
      gen3: ['filter ringmod', 'geq enhancer', 'geq multitap', 'geq mixer', 'multitap mixer', 'megatap multiplexer', 'formant send', 'ringmod resonator'],
      am4: ['wah enhancer', 'chorus tremolo'],
      vp4: ['comp pitch', 'chorus tremolo', 'chorus plex', 'tremolo multitap', 'megatap ringmod'],
      gen2: [
        'amp rotary', 'amp pitch', 'comp gate', 'wah return', 'chorus tremolo', 'phaser tonematch', 'rotary volpan', 'filter ringmod',
        'geq enhancer', 'geq resonator', 'enhancer fxloop', 'synth tonematch', 'resonator fxloop'
      ]
    }
    for (const id of c.PALETTE_IDS) {
      const fams = c.unitFamilies(id)
      const close = []
      for (let i = 0; i < fams.length; i++) {
        for (let j = i + 1; j < fams.length; j++) if (c.deltaE(c.PALETTES[id][fams[i]], c.PALETTES[id][fams[j]]) < 8) close.push(`${fams[i]} ${fams[j]}`)
      }
      const named = [...FRACTALS_OWN[id], ...THE_LIFTS[id]]
      assert.deepEqual(close.filter((p) => !named.includes(p)), [], `${id}: two more of its effects are under 8 apart`)
      assert.deepEqual(named.filter((p) => !close.includes(p)), [], `${id}: these are 8 or more apart now; take them off the list`)
    }
  })

  test('CIEDE2000 here agrees with the reference pairs', async () => {
    /* Sharma, Wu and Dalal's test data, through sRGB: the neighbour and amber checks rest on this. */
    const c = await load()
    assert.equal(c.deltaE('#ffffff', '#ffffff'), 0)
    assert.ok(Math.abs(c.deltaE('#000000', '#ffffff') - 100) < 0.01)
    assert.ok(Math.abs(c.deltaE('#ff0000', '#00ff00') - 86.6) < 0.2, String(c.deltaE('#ff0000', '#00ff00')))
    assert.ok(Math.abs(c.deltaE('#865d3c', '#a8650a') - 12.0) < 0.2, 'the amp brown is not 12 from the light amber')
  })

  test('the unknown block is a real colour of its own, on both ends', async () => {
    /*
     * It was `var(--panel-hi)`, which React Native cannot draw: on the phone
     * an unknown block had no fill at all, and the watch showed it as amp
     * silver. A blue-grey of its own now, apart from every grey amp and wah.
     */
    const c = await load()
    assert.deepEqual(c.NEUTRAL, { fill: '#5b616b', ink: '#ffffff' })
    assert.deepEqual(c.blockColor('definitely-new-block'), c.NEUTRAL)
    assert.deepEqual(c.blockColor(''), c.NEUTRAL, 'ForgeFX’s empty slug for a block it cannot name')
    assert.deepEqual(c.blockColor(null), c.NEUTRAL)
    for (const look of c.LOOKS) {
      for (const table of [look.families, ...Object.values(look.byUnit || {})]) {
        for (const slug of ['amp', 'wah']) {
          const d = c.deltaE(c.NEUTRAL.fill, table[slug] || table.amp)
          assert.ok(d >= 5, `${look.name}: the unknown block is only ${d.toFixed(1)} from the ${slug}`)
        }
      }
    }
    /*
     * And in Match my unit, on every unit, from every effect: an unknown block
     * is not mistaken for any of them. Return is the one it looks like — the
     * blue-grey Fractal gives a Return, 2.7 from it (1.9 on gen-2) — and that is said where
     * NEUTRAL is written down rather than passed over here.
     */
    for (const id of c.PALETTE_IDS) {
      for (const [slug, fill] of Object.entries(c.PALETTES[id])) {
        if (slug === 'return') continue
        const d = c.deltaE(c.NEUTRAL.fill, fill)
        assert.ok(d >= 5, `${id}: the unknown block is only ${d.toFixed(1)} from the ${slug}`)
      }
      assert.ok(c.deltaE(c.NEUTRAL.fill, c.PALETTES[id].return) < 5, `${id}: Return is apart from the unknown block now; say so in blockPalettes and take this out`)
    }
    assert.match(read('src/lib/blockPalettes.js'), /An unknown block and a Return look alike/, 'the comment on NEUTRAL claims a grey of its own again')
  })

  test('a block’s name, in any shape it arrives, finds its family', async () => {
    const c = await load()
    const same = (a, b) => assert.deepEqual(c.blockColor(a), c.blockColor(b), `${a} is not ${b}`)
    /* Axis's map: spaces, hyphens, slashes, instance numbers. */
    same('Plex Delay', 'plex')
    same('Ten-Tap', 'tentap')
    same('Vol/Pan', 'volpan')
    same('RingMod', 'ringmod')
    same('delay2', 'delay')
    same('drive1', 'drive')
    /* ForgeFX's gen-3 display names and the Axe-Fx III's newer ones. */
    same('Multitap Delay', 'multitap')
    same('Multiband Comp', 'multicomp')
    same('Dynamic Distortion', 'dynadist')
    same('NAM Player', 'nam')
    /* The Axe-Fx II's blocks are their editor names, lowercased: gen2.ts slugInstance. */
    c.setColourUnit('axefxii')
    for (const [name, family] of [
      ['Tremolo/Panner 2', 'tremolo'], ['Volume/Pan 3', 'volpan'], ['Ring Modulator', 'ringmod'],
      ['Multiband Compressor 1', 'multicomp'], ['Megatap Delay', 'megatap'], ['Feedback Send', 'send'],
      ['Feedback Return', 'return'], ['Gate Expander 2', 'gate'], ['Graphic EQ 3', 'geq'], ['Parametric EQ 4', 'peq'],
      ['Rotary Speaker 1', 'rotary'], ['Compressor 2', 'comp'], ['Multi Delay 1', 'multitap'], ['FX Loop', 'fxloop'],
      ['Input Noise Gate', 'input'], ['Tone Match', 'tonematch']
    ]) {
      assert.equal(c.familyOf(name)?.family, family, `${name} is not a ${family}`)
      assert.notDeepEqual(c.blockColor(name), c.NEUTRAL, `${name} is drawn as a block nobody knows`)
    }
    /* Quad Chorus has a picture of its own on the Axe-Fx II, and is a chorus everywhere else. */
    assert.equal(c.blockColor('Quad Chorus 1').fill, c.PALETTES.gen2.quadchorus)
    assert.notEqual(c.PALETTES.gen2.quadchorus, c.PALETTES.gen2.chorus)
    c.setColourUnit('fm3')
    same('Quad Chorus 1', 'chorus')
    /* Every slug the app coloured before still has a colour, in every look. */
    for (const look of c.LOOKS) {
      c.setLook(look.id)
      for (const slug of Object.keys(BEFORE)) assert.notDeepEqual(c.blockColor(slug), c.NEUTRAL, `${look.name}: ${slug} lost its colour`)
    }
  })

  test('every family a palette paints is one ForgeFX names, or waits for it to', async () => {
    /*
     * ForgeFX at the pinned commit names 35 gen-3 families (roster.ts
     * BASE_SLUG); anything else arrives with an empty slug and is drawn
     * NEUTRAL. So a colour for IR Player or NAM is a colour nobody sees yet,
     * and must be marked as waiting rather than claimed.
     */
    const c = await load()
    const FORGEFX_GEN3 = ['input', 'output', 'comp', 'geq', 'peq', 'amp', 'cab', 'reverb', 'delay', 'multitap', 'chorus', 'flanger', 'rotary', 'phaser', 'wah', 'formant', 'volume', 'tremolo', 'pitch', 'filter', 'drive', 'enhancer', 'mixer', 'synth', 'megatap', 'gate', 'ringmod', 'multicomp', 'tentap', 'resonator', 'looper', 'plex', 'send', 'return', 'multiplexer']
    const OTHERS = ['volpan', 'crossover', 'shunt']
    for (const family of c.FAMILIES) {
      const named = FORGEFX_GEN3.includes(family) || OTHERS.includes(family) || Object.values(c.ALIASES).includes(family)
      assert.ok(named || c.DORMANT.includes(family), `${family} is painted but ForgeFX sends no such block and it is not marked as waiting`)
    }
    for (const family of FORGEFX_GEN3) assert.ok(c.familyOf(family), `ForgeFX's ${family} has no colour`)
    for (const id of c.PALETTE_IDS) {
      const keys = Object.keys(c.PALETTES[id]).sort()
      const want = [...c.FAMILIES, ...(id === 'gen2' ? ['quadchorus'] : [])].sort()
      assert.deepEqual(keys, want, `${id} does not paint exactly the families`)
    }
  })

  test('the colours Fractal tells apart by lightness keep their hue when they move', async () => {
    /* Only lightness moves for the stage; a grey has no hue to keep, so greys are skipped. */
    const c = await load()
    const pairs = [
      ['gen3 drive', c.PALETTES.gen3.drive, '#771a12'],
      ['gen3 delay', c.PALETTES.gen3.delay, '#14457e'],
      ['gen3 reverb', c.PALETTES.gen3.reverb, '#562e7e'],
      ['gen3 multitap (the tile’s body)', c.PALETTES.gen3.multitap, '#1f2549'],
      /* The edge of the editors' picture, not Fractal's flat inventory: lifted, that one is Looper's colour (blockPalettes). */
      ['gen3 megatap (the edge of its picture)', c.PALETTES.gen3.megatap, '#2b403b'],
      /* The violet streaks across Axe-Edit III's picture, not its indigo body, which lifted is Multitap's colour (blockPalettes). */
      ['gen3 NAM (the violet across its picture)', c.PALETTES.gen3.nam, '#3c197a'],
      ['AM4 chorus', c.PALETTES.am4.chorus, '#0092c2'],
      ['AM4 comp', c.PALETTES.am4.comp, '#a59100'],
      ['AM4 phaser', c.PALETTES.am4.phaser, '#009e00'],
      ['gen3 wah (grey)', c.PALETTES.gen3.wah, '#494949']
    ]
    for (const [what, fill, official] of pairs) {
      const a = c.hueOf(fill)
      const b = c.hueOf(official)
      if (a === null || b === null) continue
      const d = Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
      assert.ok(d <= 3, `${what}: ${fill} is ${d.toFixed(1)}° from Fractal's ${official}`)
    }
    /* The AM4 and VP4 draw white letters on every effect, and so does the app
       now — the PEQ too, which takes a step towards red for it rather than
       land on the app's amber at its own hue, and the VP4's Pitch, which had
       black. Every effect each unit has, but the amp: its silver is taken a
       few shades deeper than the AM4's screen already, and its letters are
       whichever reads (blockPalettes). */
    const { unitFamilies } = await import('../src/lib/colourPage.js')
    for (const id of ['am4', 'vp4']) {
      for (const slug of unitFamilies(id).filter((f) => f !== 'amp')) {
        assert.equal(c.inkOn(c.PALETTES[id][slug]), c.LIGHT_INK, `${id} ${slug} has black letters where the unit has white`)
        assert.ok(c.contrast(c.PALETTES[id][slug], c.LIGHT_INK) >= 4.5, `${id} ${slug}`)
      }
    }
    assert.equal(c.PALETTES.am4.pitch, c.PALETTES.vp4.pitch, 'the AM4 borrows a Pitch that is not the VP4’s')
    assert.equal(c.PALETTES.am4.peq, '#b7510b')
  })

  test('a colour is resolved in order: yours, the look on this unit, the look, then neutral', async () => {
    const c = await load()
    c.setColourUnit('am4')
    assert.equal(c.blockColor('delay').fill, c.PALETTES.am4.delay, 'Match my unit on an AM4 is not the AM4’s')
    c.setLook('rings')
    assert.equal(c.blockColor('delay').fill, '#0098ff', 'Footswitch lights on an AM4 is not Effects-mode blue')
    c.setColourUnit('fm3')
    assert.equal(c.blockColor('delay').fill, '#00ccff', 'Footswitch lights on an FM3 is not the Effect ring’s cyan')
    c.setLook('sunlight')
    assert.equal(c.blockColor('delay').fill, c.lookById('sunlight').families.delay, 'a look with no table per unit is not its own colour')
    assert.ok(c.setFamily('delay', '#FF99CC'))
    assert.deepEqual(c.blockColor('Delay 2'), { fill: '#ff99cc', ink: c.inkOn('#ff99cc'), picked: true }, 'your colour is not on top of the look, or not marked as yours')
    c.setLook('unit')
    assert.equal(c.blockColor('delay').fill, '#ff99cc', 'your colour did not survive a change of look')
    assert.ok(c.setFamily('delay', null))
    assert.equal(c.blockColor('delay').fill, c.PALETTES.gen3.delay, 'putting it back did not put the unit’s back')
    assert.equal(c.setFamily('delay', 'pink'), false, 'a colour that is not a colour was taken')
    assert.equal(c.setFamily('nosuchblock', '#123456'), false)
    assert.equal(c.setLook('classic'), false, 'a look that does not exist was worn')

    /* Scenes: this preset's, then yours for every preset, then the look's. */
    c.setColourUnit('fm3')
    assert.equal(c.sceneColor(2).fill, '#cc0000')
    c.setScene(2, '#66cc33')
    assert.equal(c.sceneColor(2).fill, '#66cc33')
    assert.equal(c.sceneColor(10).fill, '#66cc33', 'scene 11 does not wrap onto scene 3')
    c.setScene(2, '#ffff00', { preset: 12 })
    assert.equal(c.sceneColor(2, 12).fill, '#ffff00', 'Just this preset is not on this preset')
    assert.equal(c.sceneColor(2, 13).fill, '#66cc33', 'Just this preset is on every preset')
    assert.equal(c.yourScene(2, { unit: 'fm3', preset: 12 }), '#ffff00')
    c.setColourUnit('am4')
    assert.equal(c.sceneColor(2, 12).fill, '#66cc33', 'an FM3’s preset 12 is colouring an AM4’s')
    c.setColourUnit('fm3', { demo: true })
    assert.equal(c.sceneColor(2, 12).fill, '#66cc33', 'the demo’s FM3 wears the real FM3’s per-preset colours')
    assert.equal(c.colourUnit(), 'fm3:demo')
    c.setColourUnit('fm3')
    c.setScene(2, null, { preset: 12 })
    assert.equal(c.sceneColor(2, 12).fill, '#66cc33', 'putting one preset back did not fall back to every preset')

    /* A preset's colour tag, kept per unit like a star. */
    assert.ok(c.setPresetColour('fm3', 45, '#0055ff'))
    assert.equal(c.presetColour('fm3', 45), '#0055ff')
    assert.equal(c.presetColour('am4', 45), null)
    assert.ok(c.setPresetColour('fm3', 45, null))
    assert.equal(c.presetColour('fm3', 45), null)

    assert.equal(c.offMode(), 'colour')
    assert.ok(c.setOffMode('grey'))
    assert.equal(c.offMode(), 'grey')
    assert.equal(c.setOffMode('invisible'), false)
  })

  test('the colours are kept under one key, and junk in it is dropped rather than drawn', async () => {
    const c = await load()
    const store = memory()
    c.loadLooks(store)
    c.setLook('sunlight')
    c.setFamily('drive', '#AA0000')
    c.setScene(0, '#00ccff', { unit: 'am4', preset: 3 })
    const kept = JSON.parse(store.kept['fractal.colours'])
    assert.equal(kept.v, 1)
    assert.equal(kept.theme.id, 'sunlight')
    assert.equal(kept.families.drive.fill, '#aa0000', 'a colour is not kept as six lower-case digits')
    assert.ok(Number.isFinite(kept.families.drive.at), 'a colour carries no time, so a later sync cannot tell which came last')
    assert.equal(kept.presetScenes.am4['3']['0'].fill, '#00ccff')
    assert.ok(Object.keys(store.kept).every((k) => k.startsWith('fractal.')), 'the phone’s store only carries fractal. keys')

    /* What comes back in is cleaned. */
    const doc = c.parseLooks(
      JSON.stringify({
        v: 1,
        theme: { id: 'nonsense', at: 5 },
        palette: { id: 'am4', at: 5 },
        families: {
          drive: { fill: 'red', at: 1 },
          amp: { fill: 'var(--panel-hi)', at: 1 },
          delay: { fill: '#abc', at: 1 },
          reverb: { fill: '#12345g', at: 1 },
          chorus: { fill: '#2266B6', at: 1 },
          flanger: { fill: '#2266b6' },
          phaser: { fill: null, at: 7 },
          wah: { fill: null },
          nosuchblock: { fill: '#123456', at: 1 },
          compressor: { fill: '#654321', at: 2 }
        },
        scenes: { 0: { fill: '#cc0000', at: 1 }, 8: { fill: '#cc0000', at: 1 }, x: { fill: '#cc0000', at: 1 } },
        presetScenes: { fm3: { 12: { 1: { fill: '#ff0000', at: 1 }, 9: { fill: '#ff0000', at: 1 } }, nope: 'x' }, 'Bad Key': { 1: { 0: { fill: '#ff0000', at: 1 } } } },
        presets: { fm3: { 45: { fill: '#0055ff', at: 1 }, 46: { fill: 'blue', at: 1 } } },
        off: { mode: 'transparent', at: 1 }
      })
    )
    assert.equal(doc.theme, null, 'a look that does not exist was kept')
    assert.deepEqual(doc.palette, { id: 'am4', at: 5 })
    assert.deepEqual(doc.families, { chorus: { fill: '#2266b6', at: 1 }, phaser: { fill: null, at: 7 }, comp: { fill: '#654321', at: 2 } })
    assert.deepEqual(doc.scenes, { 0: { fill: '#cc0000', at: 1 } })
    assert.deepEqual(doc.presetScenes, { fm3: { 12: { 1: { fill: '#ff0000', at: 1 } } } })
    assert.deepEqual(doc.presets, { fm3: { 45: { fill: '#0055ff', at: 1 } } })
    assert.equal(doc.off, null)
    assert.deepEqual(c.parseLooks('{"families":{"__proto__":{"fill":"#123456","at":1}}}').families, {}, 'a key that is not a family was kept')
    for (const junk of ['', 'not json', 'null', '[]', '42', '{"families": "drive"}']) {
      assert.deepEqual(Object.keys(c.parseLooks(junk).families), [], `${junk || 'nothing'} broke the reading`)
    }
    /* A storage that throws is a session with nothing saved, never a crash. */
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
    assert.equal(c.loadLooks(broken), 'unit')
    assert.ok(c.setLook('cvd'), 'a full store refused the look for this session too')
    assert.equal(c.lookId(), 'cvd')
  })

  test('putting every colour back leaves a reset with a time on everything, not a gap', async () => {
    const c = await load()
    const store = memory()
    c.loadLooks(store)
    c.setColourUnit('vp4')
    c.setLook('stompbox')
    c.setFamily('drive', '#123456')
    c.setScene(1, '#00ccff')
    c.setScene(1, '#ffff00', { preset: 4 })
    c.setPresetColour('vp4', 4, '#66cc33')
    c.setOffMode('grey')
    assert.equal(c.ownColourCount(), 2)
    c.resetAll()
    const kept = JSON.parse(store.kept['fractal.colours'])
    assert.equal(kept.theme.id, null)
    assert.ok(Number.isFinite(kept.theme.at))
    assert.equal(kept.families.drive.fill, null)
    assert.ok(Number.isFinite(kept.families.drive.at), 'a reset with no time can be undone by an older copy')
    assert.equal(kept.scenes['1'].fill, null)
    assert.equal(kept.presetScenes.vp4['4']['1'].fill, null)
    assert.equal(kept.presets.vp4['4'].fill, null)
    assert.equal(kept.off.mode, 'colour')
    assert.equal(kept.palette.id, 'vp4', 'putting colours back forgot which unit this is')
    assert.equal(c.lookId(), 'unit')
    assert.equal(c.blockColor('drive').fill, c.PALETTES.vp4.drive)
    assert.equal(c.sceneColor(1, 4).fill, '#cc0000')
    assert.equal(c.ownColourCount(), 0)
    /* And the resets read back as resets. */
    const back = c.parseLooks(store.kept['fractal.colours'])
    assert.deepEqual(back.families.drive.fill, null)
    assert.equal(back.theme.id, null)
  })

  test('the last unit’s palette is kept, so an AM4 opens in AM4 colours before it answers', async () => {
    const c = await load()
    const store = memory()
    c.loadLooks(store)
    c.setColourUnit('am4')
    assert.equal(JSON.parse(store.kept['fractal.colours']).palette.id, 'am4', 'the unit’s palette was not written down')
    /* Next launch: the phone is 'device' until the unit answers. */
    c.setColourUnit(null)
    c.loadLooks(store)
    assert.equal(c.currentPaletteId(), 'am4', 'the remembered palette is not used at launch')
    assert.equal(c.blockColor('drive').fill, c.PALETTES.am4.drive)
    c.setColourUnit('device')
    assert.equal(c.currentPaletteId(), 'am4', 'a unit that did not say what it is put gen-3 colours up')
    /* The demo's FM3 is worn while it is on and never written down. */
    c.setColourUnit('fm3', { demo: true })
    assert.equal(c.currentPaletteId(), 'gen3')
    assert.equal(JSON.parse(store.kept['fractal.colours']).palette.id, 'am4', 'trying the demo left an AM4 owner in FM3 colours')
    /* And turning the demo off while the AM4 is not answering yet — an
       answer that names no unit — is not the demo's FM3 carried on. */
    c.setColourUnit('device')
    assert.equal(c.currentPaletteId(), 'am4', 'after the demo, a unit that did not say what it is wore the demo’s FM3 colours')
    assert.equal(JSON.parse(store.kept['fractal.colours']).palette.id, 'am4', 'after the demo, the demo’s FM3 colours were written down as the AM4 owner’s')
    c.setColourUnit('vp4')
    assert.equal(JSON.parse(store.kept['fractal.colours']).palette.id, 'vp4')
    /* A real unit's palette still carries over a moment it does not say its name. */
    c.setColourUnit('device')
    assert.equal(c.currentPaletteId(), 'vp4')

    /* A unit that answers before the store has landed is not allowed to write over it. */
    c.setColourUnit(null)
    const early = memory({ 'fractal.colours': JSON.stringify({ v: 1, theme: { id: 'cvd', at: 1 }, families: { drive: { fill: '#123456', at: 1 } } }) })
    const fresh = await import(`../src/lib/looks.js?early=${Date.now()}`)
    fresh.setColourUnit('axefxii')
    assert.equal(early.kept['fractal.colours'].includes('"palette"'), false, 'the unit wrote before the colours were read')
    fresh.loadLooks(early)
    const after = JSON.parse(early.kept['fractal.colours'])
    assert.equal(after.palette.id, 'gen2', 'the unit that answered first is not remembered once it is safe to')
    assert.equal(after.theme.id, 'cvd', 'the colours that were there were written over')
    assert.equal(after.families.drive.fill, '#123456')
  })

  test('Fractal Remote is the app’s colours exactly as they were, drawn as they were', async () => {
    /*
     * "OK, make sure you preserve the current colors and make a theme on that
     * one called fractal remote." Held to the old values one by one, and left
     * out of the readability sums above: it is the look as it was, two
     * letters that miss 4.5:1 and all, because that is what was asked for.
     */
    const c = await load()
    c.setLook('fractalremote')
    for (const unit of ['fm3', 'am4', 'vp4', 'axefxii']) {
      c.setColourUnit(unit)
      for (const [slug, fill] of Object.entries(BEFORE)) {
        assert.deepEqual(c.blockColor(slug), { fill, ink: '#ffffff' }, `${unit}: ${slug} is not the colour it always was`)
      }
      BEFORE_SCENES.forEach((fill, i) => assert.deepEqual(c.sceneColor(i), { fill, ink: '#ffffff' }, `${unit}: scene ${i + 1} moved`))
    }
    /* The one thing allowed to differ: an unknown block is a colour the phone can draw. */
    assert.deepEqual(c.blockColor('somethingnew'), c.NEUTRAL)
    /*
     * And unknown means unknown to the old table: the Axe-Fx II's own names,
     * learned since, had no colour in it, so they are the unknown block here
     * — and their family's colour in every other look.
     */
    const LEARNED_SINCE = [
      'Tremolo/Panner 1', 'Graphic EQ 2', 'Parametric EQ 1', 'Rotary Speaker', 'Multiband Compressor', 'Ring Modulator',
      'Volume/Pan 3', 'Quad Chorus 1', 'Multi Delay 1', 'Megatap Delay', 'Feedback Send', 'Feedback Return', 'Gate/Expander 1',
      'Input Noise Gate', 'Multitap Delay', 'NAM Player', 'Dynamic Distortion'
    ]
    c.setColourUnit('axefxii')
    for (const name of LEARNED_SINCE) assert.deepEqual(c.blockColor(name), c.NEUTRAL, `${name} has a colour in Fractal Remote that it never had`)
    /* Every spelling the old table did know is exactly as it was, in whatever shape it comes. */
    for (const [name, slug] of [['Plex Delay', 'plex'], ['Ten-Tap', 'tentap'], ['Vol/Pan', 'volpan'], ['delay2', 'delay'], ['Compressor 2', 'compressor'], ['eq', 'eq']]) {
      assert.deepEqual(c.blockColor(name), { fill: BEFORE[slug], ink: '#ffffff' }, `${name} is not the colour it always was`)
    }
    c.setLook('unit')
    for (const name of LEARNED_SINCE) assert.notDeepEqual(c.blockColor(name), c.NEUTRAL, `${name} lost its family in Match my unit`)
    c.setLook('fractalremote')
    assert.equal(c.quietEnd('input'), false, 'the phone draws the ends differently in the old look')
    assert.ok(c.isFractalRemoteLook())

    /* Drawn as it was: the phone lifts it, and only it, and keeps its edges. */
    const tile = read('mobile/src/components/Tile.js')
    assert.match(tile, /const asBefore = asLook \? liftedLook\(asLook\) : isFractalRemoteLook\(\)/)
    assert.match(tile, /const lift = asBefore && !picked\n\s+const hue = lift \? vivid\(fill\) : fill/, 'Fractal Remote is not lifted on the phone, or every look is, or a colour picked on top of it is')
    assert.match(tile, /if \(asBefore\) return at\(hue, on \? 0\.85 : 0\.55\)/, 'Fractal Remote lost the edges it always had')
    const { vivid } = await import('../mobile/src/lib/vivid.js')
    assert.notEqual(vivid(BEFORE.drive), BEFORE.drive, 'the lift lifts nothing')
    /* And the browser leaves it out of every new edge and gradient. */
    const css = read('src/styles.css')
    const fresh = css.match(/:not\(\[data-look='fractalremote'\]\)/g) || []
    assert.ok(fresh.length >= 6, 'the new edges reach Fractal Remote in the browser')
    assert.match(read('src/lib/useLooks.js'), /document\.documentElement\.dataset\.look = lookId\(\)/, 'the page does not say which look it wears')
  })

  test('both ends are told which unit answered, load the colours at start, and repaint on a change', async () => {
    /* Phone. */
    const rig = read('mobile/src/lib/rig.js')
    assert.match(rig, /import \{ setColourUnit \} from '\.\/looks'/)
    assert.match(rig, /const slug = deviceSlug\(caps\)[\s\S]{0,1600}setColourUnit\(slug, \{ demo: simulated \}\)/, 'the phone does not tell the colours which unit it found')
    const app = read('mobile/App.js')
    assert.match(app, /useSyncExternalStore\(watchTheme, themeVersion, themeVersion\)[\s\S]{0,600}useSyncExternalStore\(watchLooks, looksVersion, looksVersion\)/, 'the phone does not repaint from its root on a colour change')
    assert.match(app, /hydrate\(\)\.then\(\(\) => loadLooks\(sync\)\)/, 'the phone forgets its colours between launches')
    /* Browser. */
    const forge = read('src/lib/forgefx.js')
    assert.match(forge, /if \(label\) unitSlug = deviceSlug\(label\)[\s\S]{0,600}setColourUnit\(label \? unitSlug : DEFAULT_SLUG, \{ demo: !!mock \}\)/, 'the browser does not tell the colours which unit it found, or tells them the demo’s FM3 when nothing was named')
    assert.match(read('src/main.jsx'), /apply\(getMode\(\)\)[\s\S]{0,200}startLooks\(\)/, 'the browser does not load the colours beside the theme')
    for (const f of ['src/components/Gig.jsx', 'src/components/Console.jsx', 'src/components/RowsPanel.jsx', 'src/components/SceneArrange.jsx']) {
      assert.match(read(f), /\n\s+useLooks\(\)\n/, `${f} does not repaint when the colours change`)
    }
    /* The ends, quiet on both. */
    assert.match(read('mobile/src/screens/Edit.js'), /quiet=\{quietEnd\(b\.slug\)\}/, 'the phone’s strip lights Input and Output like pedals')
    assert.match(read('mobile/src/components/RowsPanel.js'), /const quiet = quietEnd\(c\.slug\)/)
    assert.match(read('src/components/RowsPanel.jsx'), /\$\{quiet \? ' io' : ''\}/)
    assert.match(read('src/styles.css'), /button\.rows-cell\.io \{\s*background: none;/)
    /* The live scene ringed on the phone too, now that every scene can be one red. */
    const stage = read('mobile/src/screens/Stage.js')
    assert.match(stage.slice(stage.indexOf('caption={String(i + 1)}'), stage.indexOf('/>', stage.indexOf('caption={String(i + 1)}'))), /\n\s+ring\n/)
    /* The copies the phone carries are the browser's, generated (test/mobile.mjs checks they are fresh). */
    const sync = read('scripts/sync-relay-rules.mjs')
    for (const f of ['ink.js', 'blockPalettes.js', 'looks.js', 'blockColors.js', 'sceneColors.js']) {
      assert.match(sync, new RegExp(`source: '\\.\\./src/lib/${f.replace('.', '\\.')}'`), `${f} is not copied to the phone`)
    }
    /* And the shared files import only each other, by explicit paths. */
    for (const f of ['ink.js', 'blockPalettes.js', 'looks.js', 'blockColors.js', 'sceneColors.js']) {
      for (const [, from] of read(`src/lib/${f}`).matchAll(/from '([^']+)'/g)) {
        assert.match(from, /^\.\/(ink|blockPalettes|looks)\.js$/, `${f} imports ${from}, which the phone's copy cannot reach`)
      }
    }
  })

  test('the footswitch lights are the editors’ own colours, and Default is the colour of the switch’s kind', async () => {
    const { describeSwitch, lightWords, RING_COLOURS } = await import('../shared/footswitches.mjs')
    assert.deepEqual(
      Object.values(RING_COLOURS).map((r) => `${r.name} ${r.hex}`),
      ['Red #cc0000', 'Orange #ff9933', 'Yellow #ffff00', 'Green #66cc33', 'Blue #0055ff', 'Cyan #00ccff', 'Purple #6633cc', 'White #ffffff', 'Pink #ff99cc', 'Teal #009999', 'Lime #ccff33', 'Off #777777']
    )
    /* The host's table is not what is shown, even where it has an entry. */
    const model = { categories: { 2: 'Preset', 3: 'Scene', 4: 'Effect', 5: 'Utility', 8: 'Looper' }, colors: { 1: { name: 'Red', hex: '#e23b3b' }, 10: { name: 'Turquoise', hex: '#2fd6c2' } } }
    const at = (fields) => describeSwitch({ switch: 0, fields, tapLabel: '', holdLabel: '' }, model)
    assert.deepEqual(at({ tapCategory: 3, color: 1 }).light, { name: 'Red', hex: '#cc0000' })
    assert.deepEqual(at({ tapCategory: 3, color: 10 }).light, { name: 'Teal', hex: '#009999' }, 'Teal is called Turquoise again')
    for (const [kind, shade] of [[3, 'Red'], [4, 'Cyan'], [2, 'Green'], [5, 'Blue']]) {
      const light = at({ tapCategory: kind, color: 0 }).light
      assert.equal(light.name, 'Default')
      assert.equal(light.shade, shade, `a ${model.categories[kind]} switch on Default is not ${shade}`)
      assert.equal(lightWords(light), `${shade} light (the default)`)
    }
    const looper = at({ tapCategory: 8, color: 0 }).light
    assert.deepEqual(looper, { name: 'Default', hex: null, shade: null }, 'a looper switch, which has no one default, is given one')
    assert.equal(lightWords(looper), 'Default light')
    assert.equal(lightWords(at({ tapCategory: 3, color: 42 }).light), 'Light: a colour this app can’t name yet')
    const mock = read('src/lib/mockDevice.js')
    assert.ok(!/#e23b3b|#9b59f5|#35c9d6/.test(mock), 'the demo still has the host’s approximate colours')
  })

  /*
   * ONE PRESET'S COLOURS. "Make a section where a user can edit the colors of
   * the blocks/presets and effects." A scene can be painted for every preset
   * or just the one that is loaded — Fractal's own PERFORM layout makes
   * Clean, Crunch and Lead green, yellow and red in one preset and leaves the
   * rest red — and a preset can wear a colour tag, the editors' Assign Color.
   * These are held through lib/colourPage, the rules both ends' colour sheets
   * paint by, rather than through the store underneath it, because the sheet
   * is where the order has to come out right.
   */
  const withPage = async () => ({ ...(await load()), ...(await import('../src/lib/colourPage.js')) })

  test('a scene is coloured in order: this preset’s, then yours for every preset, then the look’s', async () => {
    const c = await withPage()
    const store = memory()
    c.loadLooks(store)
    c.setColourUnit('fm3')
    const lead = { number: 12, words: '012 Lead Rig' }
    const three = c.sceneTarget(2, { preset: lead, only: true })
    assert.deepEqual([three.preset, three.only], [{ number: 12, words: '012 Lead Rig' }, true])
    assert.equal(c.SCOPE_WORDS.only, 'Just this preset')
    assert.equal(c.SCOPE_WORDS.every, 'Every preset')
    /* No preset loaded: there is nothing for "just this one" to mean. */
    assert.equal(c.sceneTarget(2, { only: true }).only, false, 'a scene with no preset loaded opens on just this preset')
    assert.equal(c.sceneTarget(2, { preset: { number: null }, only: true }).preset, null)

    /* The look's: every scene red on Match my unit. */
    assert.equal(c.colourNow(three, { only: true }), c.SCENE_RED)
    /* This preset's own. */
    assert.ok(c.paint(three, '#66cc33', { only: true }))
    assert.equal(c.sceneColor(2, 12).fill, '#66cc33', 'Just this preset is not on this preset')
    assert.equal(c.sceneColor(2, 13).fill, c.SCENE_RED, 'Just this preset is on another preset')
    assert.equal(c.sceneColor(2).fill, c.SCENE_RED, 'Just this preset is every preset’s colour')
    assert.equal(c.yoursFor(three, { only: true }), '#66cc33')
    assert.equal(c.yoursFor(three), null)
    /* Yours for every preset, under this preset's own. */
    assert.ok(c.paint(three, '#ffff00', { only: false }))
    assert.equal(c.sceneColor(2, 13).fill, '#ffff00', 'every preset’s colour did not reach another preset')
    assert.equal(c.sceneColor(2, 12).fill, '#66cc33', 'every preset’s colour went over this preset’s own')
    assert.equal(c.colourNow(three), '#ffff00')
    assert.equal(c.colourNow(three, { only: true }), '#66cc33')
    /* A look changes the look's colour and leaves both of yours. */
    c.setLook('sunlight')
    assert.equal(c.sceneColor(2, 12).fill, '#66cc33')
    assert.equal(c.sceneColor(2, 13).fill, '#ffff00')
    c.setLook('unit')
    /* Picking for this preset the colour every preset has puts this preset's away, so the next change of every preset's reaches it. */
    assert.ok(c.paint(three, '#ffff00', { only: true }))
    assert.equal(c.yourScene(2, { preset: 12 }), null, 'this preset pinned a copy of every preset’s colour')
    c.paint(three, '#00ccff', { only: false })
    assert.equal(c.sceneColor(2, 12).fill, '#00ccff', 'a change to every preset missed the preset that had been put back')
    /* And Back, from this preset's own: to every preset's, said so. */
    c.paint(three, '#ff99cc', { only: true })
    assert.equal(c.backWords(three, { only: true }), 'Same as every preset')
    assert.equal(c.backWords(three), 'Back to the unit’s colour')
    assert.equal(c.sheetNote(three, { only: true }), 'For this scene in 012 Lead Rig only')
    assert.equal(c.sheetNote(three), 'For this scene in every preset')
    assert.ok(c.paint(three, null, { only: true }))
    assert.equal(c.sceneColor(2, 12).fill, '#00ccff', 'putting this preset back did not fall back to every preset’s colour')

    /* The scenes either side, as this preset draws them, are what a pick is held against. */
    c.paint(c.sceneTarget(1, { preset: lead, only: true }), '#66cc33', { only: true })
    assert.equal(c.nextToWarning(three, '#66cc33', { only: true }), 'Hard to tell from scene 2 next to it', 'this preset’s own scene 2 is not what scene 3 sits next to')
    assert.equal(c.nextToWarning(three, '#66cc33', { only: false }), null, 'every preset’s scene 3 is held against this preset’s scene 2')

    /* Kept per unit, the demo's apart, and back from storage. */
    c.setColourUnit('am4')
    assert.equal(c.sceneColor(2, 12).fill, '#00ccff', 'an FM3’s preset 12 is colouring an AM4’s')
    c.setColourUnit('fm3', { demo: true })
    assert.equal(c.sceneColor(1, 12).fill, c.SCENE_RED, 'the demo’s FM3 wears the real FM3’s preset colours')
    c.setColourUnit('fm3')
    c.loadLooks(store)
    assert.equal(c.sceneColor(1, 12).fill, '#66cc33', 'this preset’s own scene colour did not come back from storage')
  })

  test('a preset’s colour tag is kept per unit and preset number, like a star, and the demo’s apart', async () => {
    const c = await withPage()
    const store = memory()
    c.loadLooks(store)
    /* Before any unit has answered there is nothing to file a tag under. */
    assert.equal(c.presetTarget(45, { words: '045 Clean' }), null)
    assert.equal(c.presetTag(45), null)
    c.setColourUnit('fm3')
    const clean = c.presetTarget(45, { words: '045 Clean' })
    assert.deepEqual(clean, { kind: 'preset', number: 45, unit: 'fm3', name: '045 Clean' })
    assert.equal(c.presetTarget(-1), null)
    /* Offered the scene's grid — no amber-like orange, no look's colour first — and kept off the amber that marks the preset you are on. */
    const grid = c.sheetSwatches(clean)
    assert.equal(grid.length, 22, 'a tag is not offered the twenty-three without the orange')
    assert.ok(!grid.some((s) => s.own || s.fill === '#ff9933'), 'a tag is offered the look’s colour, or the orange beside the amber')
    assert.equal(c.offAmber(clean), true)
    assert.equal(c.offAmber(c.familyTarget('peq')), false, 'an effect is kept off the amber the AM4’s own PEQ wears')
    assert.equal(c.nextToWarning(clean, '#cc0000'), null, 'a tag is warned about a neighbour it does not have')
    /* No tag: the sheet opens on the first colour, with no way back to show. */
    assert.equal(c.colourNow(clean), grid[0].fill)
    assert.equal(c.yoursFor(clean), null)
    assert.equal(c.tagButtonWords('045 Clean', null), 'Give 045 Clean a colour')
    assert.ok(c.paint(clean, '#0055ff'))
    assert.equal(c.presetTag(45), '#0055ff')
    assert.equal(c.yoursFor(clean), '#0055ff')
    assert.equal(c.backWords(clean), 'Take the colour off')
    assert.equal(c.sheetNote(clean), 'Kept for this preset on this unit, like its star')
    assert.equal(c.tagButtonWords('045 Clean', '#0055ff'), 'Colour for 045 Clean: Blue. Change it')
    assert.equal(c.tagName('#123456'), 'a colour of your own')
    /* Per unit and per number. */
    assert.equal(c.presetTag(46), null, 'a tag reached the preset next to it')
    c.setColourUnit('am4')
    assert.equal(c.presetTag(45), null, 'an FM3’s preset 45 tags an AM4’s')
    assert.equal(c.presetTarget(45).unit, 'am4')
    c.setColourUnit('fm3', { demo: true })
    assert.equal(c.presetTag(45), null, 'the demo’s FM3 wears the real FM3’s tags')
    c.paint(c.presetTarget(45), '#cc0000')
    c.setColourUnit('fm3')
    assert.equal(c.presetTag(45), '#0055ff', 'a tag given in the demo went onto the real FM3')
    /* Back from storage; Clear them leaves tags; Put every colour back takes them, with a time. */
    c.loadLooks(store)
    assert.equal(c.presetTag(45), '#0055ff')
    c.clearYours()
    assert.equal(c.presetTag(45), '#0055ff', 'Clear them took a preset’s tag')
    c.resetAll()
    assert.equal(c.presetTag(45), null)
    assert.ok(Number.isFinite(JSON.parse(store.kept['fractal.colours']).presets.fm3['45'].at), 'a tag taken off has no time on it')
    /* And Take the colour off is a reset with a time too. */
    c.paint(clean, '#66cc33')
    c.paint(clean, null)
    assert.deepEqual(Object.keys(JSON.parse(store.kept['fractal.colours']).presets.fm3['45']).sort(), ['at', 'fill'])
    assert.equal(c.presetTag(45), null)
  })

  /*
   * A COLOUR PICKED ON TOP OF FRACTAL REMOTE IS THE PLAYER'S. The look is
   * drawn as it always was — the phone lifts its colours, the browser's strip
   * keeps its old face — and that is right for its own colours only. Lifted,
   * a White he chose came out grey, and five of the colours on the sheet fell
   * under 4.5:1; the browser's old face put white letters on his mustard at
   * 3.7. So every swatch he can pick there, and every step lighter or darker
   * from one, is measured as each end now draws it.
   */
  test('a colour picked on top of Fractal Remote is drawn as picked, and reads at 4.5:1 as each end draws it', async () => {
    const c = await withPage()
    const css = read('src/styles.css')
    c.setLook('fractalremote')
    const misses = []
    let checked = 0
    for (const unit of ['fm3', 'am4', 'axefxii']) {
      c.setColourUnit(unit)
      for (const t of [c.familyTarget('drive'), c.sceneTarget(0)]) {
        for (const s of c.sheetSwatches(t)) {
          const { darker, lighter } = c.shades(s.fill, { scene: t.kind === 'scene' })
          for (const fill of [s.fill, ...darker, ...lighter]) {
            c.paint(t, fill)
            const hue = t.kind === 'scene' ? c.sceneColor(0) : c.blockColor('drive')
            if (fill === String(c.lookOwn(t)).toLowerCase()) {
              assert.ok(!hue.picked, `${t.name}: the look’s own colour is marked as picked`)
              continue
            }
            assert.equal(hue.picked, true, `${unit} ${t.name} ${fill}: a picked colour is not marked as picked`)
            assert.equal(hue.ink, c.inkOn(fill), `${t.name} ${fill}: its letters were not chosen for it`)
            for (const [where, ends] of Object.entries(surfaces(c, css, hue.fill, hue.ink))) {
              if (t.kind === 'scene' && where.startsWith('edit strip')) continue
              for (const end of ends) {
                checked++
                const r = c.contrast(hue.ink, end)
                if (r < 4.5) misses.push(`${unit} ${t.name} ${s.name} ${fill} (${where}, ${end}) ${r.toFixed(2)}:1`)
              }
            }
          }
          c.paint(t, null)
        }
      }
    }
    assert.deepEqual(misses, [], `a picked colour under 4.5:1 on Fractal Remote:\n  ${misses.join('\n  ')}`)
    assert.ok(checked > 1000, `only ${checked} surfaces were measured`)
    /* The Scenes choice is picked too: Fractal's red over the look's eight. */
    c.chooseScenes(false)
    assert.equal(c.sceneColor(3).fill, c.SCENE_RED)
    assert.equal(c.sceneColor(3).picked, true, 'All red on Fractal Remote would be lifted on the phone')
    assert.equal(c.sceneColor(3).ink, c.inkOn(c.SCENE_RED))
    c.chooseScenes(true)
    assert.deepEqual(c.sceneColor(3), { fill: BEFORE_SCENES[3], ink: '#ffffff' }, 'Fractal Remote’s own scenes are not as they were once the choice is back')
    c.setLook('unit')
    c.setColourUnit(null)

    /* And drawn so: the phone lifts only what is not picked, and every tile that can wear a picked colour says so. */
    const tile = read('mobile/src/components/Tile.js')
    assert.match(tile, /\n  picked = false,\n/, 'the phone’s tile cannot be told a colour was picked')
    assert.match(tile, /const shadeBelow = !lift && lit === LIGHT_INK/, 'a picked colour’s glass falls over its letters')
    for (const [f, n] of [['mobile/src/screens/Stage.js', 3], ['mobile/src/screens/Edit.js', 1], ['mobile/src/components/SceneArrange.js', 1], ['mobile/src/components/Colours.js', 3], ['mobile/src/components/ColourSheet.js', 2]]) {
      const got = (read(f).match(/picked=\{(hue|looperHue)\.picked\}|picked=\{picked\}/g) || []).length
      assert.equal(got, n, `${f}: ${got} of its ${n} tiles are told when a colour was picked`)
    }
    assert.match(read('mobile/src/components/ColourSheet.js'), /const picked = open \? pickIsPicked\(target, pick, \{ only \}\) : false/)
    /* The browser: the strip shades a picked colour away from its letters, and a live scene's words are at full strength. */
    assert.match(read('src/components/Gig.jsx'), /data-picked=\{sceneColor\(i, preset\?\.number\)\.picked \? 'yes' : undefined\}/, 'Play does not say a scene’s colour was picked')
    assert.match(read('src/components/ColourSheet.jsx'), /data-picked=\{picked \? 'yes' : undefined\}/)
    assert.match(read('src/components/Colours.jsx'), /data-picked=\{hue\.picked \? 'yes' : undefined\}/)
    assert.match(css, /button\.gig-scene\.named\.current\[data-picked='yes'\] \.gig-scene-num,\nbutton\.gig-scene\.current\[data-picked='yes'\] \.gig-scene-name \{\n  opacity: 1;\n\}/, 'a picked scene colour’s words are faded on Fractal Remote')
  })

  /*
   * THE SCENES CHOICE IS ONE CHOICE. "A colour for each scene" on an AM4 said
   * "8 of your own colours on top" and marked all four scenes "yours": it was
   * written as eight colours of the player's own, for one tap on a unit with
   * four scenes.
   */
  test('the Scenes choice is one choice, never eight of your own colours, and the sheet calls its colour by it', async () => {
    const c = await withPage()
    const store = memory()
    c.loadLooks(store)
    c.setColourUnit('am4')
    const am4 = { sceneCount: 4 }
    c.chooseScenes(true)
    assert.equal(c.sceneChoice(), 'each')
    assert.equal(c.scenesAllRed(4), false)
    for (let i = 0; i < 8; i++) assert.equal(c.yourScene(i), null, `scene ${i + 1} is marked as yours for a choice`)
    assert.equal(c.ownColourCount({ scenes: 4 }), 0)
    assert.equal(c.coloursStatus({ unitName: 'AM4', capabilities: am4 }), 'Match my unit · AM4 colours', 'a choice is counted as colours of your own')
    assert.deepEqual(Array.from({ length: 4 }, (_, i) => c.sceneColor(i).fill), c.lookById('cvd').scenes.slice(0, 4), 'a colour each is not Colour-blind safe’s')
    assert.equal(JSON.parse(store.kept['fractal.colours']).sceneChoice.mode, 'each', 'the choice is not kept for the next launch')
    /* One scene painted by hand is one of your own, and only the scenes the unit has are counted. */
    const two = c.sceneTarget(1)
    assert.equal(c.lookOwn(two), c.lookById('cvd').scenes[1], 'Back would not give the scene its colour from the choice')
    assert.deepEqual(c.sheetSwatches(two)[0], { name: 'Each', fill: c.lookById('cvd').scenes[1], own: true, said: 'the colour for each scene' }, 'the first square is called the unit’s colour, which it is not')
    c.paint(two, '#ffff00')
    assert.equal(c.backWords(two), 'Back to the colour for each scene')
    assert.equal(c.coloursStatus({ unitName: 'AM4', capabilities: am4 }), 'Match my unit · AM4 colours · 1 of your own')
    c.setScene(6, '#ffffff')
    assert.equal(c.ownColourCount({ scenes: 4 }), 1, 'a scene the AM4 does not have is counted')
    assert.equal(c.ownColourCount(), 2)
    /* Picking the choice's own colour back is putting yours away. */
    c.paint(two, c.lookById('cvd').scenes[1])
    assert.equal(c.yourScene(1), null)
    /* All red over a look with a colour each, and its words. */
    c.setLook('sunlight')
    assert.equal(c.scenesAllRed(4), false, 'Sunlight’s scenes are not its own colour each')
    c.chooseScenes(false)
    assert.equal(c.sceneChoice(), 'red')
    assert.equal(c.yourScene(6), null, 'All red left a scene painted by hand')
    assert.equal(c.scenesAllRed(4), true)
    assert.equal(c.sheetSwatches(two)[0].name, 'Red')
    c.paint(two, '#00ccff')
    assert.equal(c.backWords(two), 'Back to red, like the unit')
    /* Clear them leaves the choice, like the look; Put every colour back takes it, with a time. */
    c.clearYours()
    assert.equal(c.sceneChoice(), 'red', 'Clear them took the Scenes choice')
    c.resetAll()
    assert.equal(c.sceneChoice(), null)
    const kept = JSON.parse(store.kept['fractal.colours'])
    assert.equal(kept.sceneChoice.mode, null)
    assert.ok(Number.isFinite(kept.sceneChoice.at), 'the choice was put back with no time on it')
    /* Only the two choices, or null, come back from storage. */
    assert.equal(c.parseLooks({ sceneChoice: { mode: 'pink', at: 1 } }).sceneChoice, null)
    assert.deepEqual(c.parseLooks({ sceneChoice: { mode: 'each', at: 1 } }).sceneChoice, { mode: 'each', at: 1 })
    assert.equal(c.setSceneChoice('pink'), false)
    c.setColourUnit(null)
    /* Both pages count and mark only what was painted by hand, of the scenes the unit has. */
    for (const f of ['src/components/Colours.jsx', 'mobile/src/components/Colours.js']) {
      assert.match(read(f), /const own = ownColourCount\(\{ scenes: sceneCount \}\)/, `${f} counts scenes the unit does not have`)
      assert.match(read(f), /const allRed = scenesAllRed\(sceneCount\)/)
    }
  })

  test('leaving or entering the demo forgets the unit the colours were told', async () => {
    const c = await load()
    const store = memory()
    c.loadLooks(store)
    c.setColourUnit('am4')
    c.setColourUnit('fm3', { demo: true })
    assert.equal(c.colourUnit(), 'fm3:demo')
    /* The demo goes off with the computer out of reach: nothing answers, so nothing else tells the colours. */
    c.setColourUnit(null)
    assert.equal(c.currentPaletteId(), 'am4', 'the demo’s FM3 colours stayed on an AM4 owner’s app')
    assert.equal(c.colourUnit(), null, 'a tag would still be filed under the demo')
    /* Both ends tell them at the switch. */
    const phone = read('mobile/src/lib/demo.js')
    assert.match(phone, /import \{ setColourUnit \} from '\.\/looks'/)
    assert.match(phone, /if \(want === isDemo\(\)\) return\n\s+mock = want \? createMockDevice\(unit\) : null[\s\S]{0,700}setColourUnit\(null\)\n\s+announce\(\)/, 'the phone’s demo switch does not tell the colours')
    assert.match(read('src/lib/forgefx.js'), /const was = !!mock\n\s+mock = on \? createMockDevice\(demoUnit\(\)\) : null[\s\S]{0,700}if \(was !== !!mock\) setColourUnit\(null\)/, 'the browser’s demo switch does not tell the colours, or tells them when nothing changed')
    c.setColourUnit(null)
  })

  test('Footswitch lights on an Axe-Fx II are its MFC-101’s green, and every look’s words are true of the unit', async () => {
    const c = await withPage()
    c.setLook('rings')
    c.setColourUnit('axefxii')
    assert.equal(c.blockColor('drive').fill, '#66cc33', 'an Axe-Fx II’s effects are an FC’s cyan, which it cannot use')
    assert.equal(c.currentPaletteId(), 'gen2')
    const rings = c.lookById('rings')
    assert.match(c.lookWhy(rings), /MFC-101/)
    assert.ok(!/scene switch red/.test(c.lookWhy(rings)), 'an Axe-Fx II owner is told his scene switches light red')
    assert.ok(!/like the scene switches/.test(c.lookWhy(c.lookById('unit'))), 'Match my unit tells an Axe-Fx II owner his scene switches light red')
    c.setColourUnit('fm3')
    assert.equal(c.lookWhy(rings), rings.why)
    assert.equal(c.blockColor('drive').fill, '#00ccff')
    c.setLook('unit')
    c.setColourUnit(null)
    /* The same rules for every line a look has, by unit too. */
    const brands = /tube ?screamer|ibanez|boss|mxr|electro-?harmonix|strymon|eventide|fulltone|klon|line ?6|helix|kemper|neural|marshall|fender|vox|mesa|tc electronic|dunlop|ehx/i
    for (const l of c.LOOKS) {
      for (const why of [l.why, ...Object.values(l.whyByUnit || {})]) {
        assert.ok(!brands.test(why), `${l.name} names a brand`)
        assert.ok(why.length < 200, `${l.name}: a long why`)
        assert.ok(!/this phone/i.test(why), `${l.name} says "this phone"`)
      }
    }
    /* Both pages show the unit's line. */
    assert.match(read('src/components/Colours.jsx'), /\{lookWhy\(look\)\}/)
    assert.match(read('mobile/src/components/Colours.js'), /\{lookWhy\(look\)\}/)
  })

  test('every colour that names Fractal’s own says which way it moved', async () => {
    /*
     * These comments are the only record of where each colour came from, and
     * the next person to tune one reads them first. A line that says "lifted"
     * over a colour taken darker, or names the plan's own value as the
     * manual's, sends him the wrong way.
     */
    const ink = await import('../src/lib/ink.js')
    const moved = { lighter: [], darker: [] }
    const wrong = []
    read('src/lib/blockPalettes.js').split('\n').forEach((line, i) => {
      const m = /^\s+(\w+): '(#[0-9a-f]{6})',? \/\/ (.*)$/.exec(line)
      const named = m && /(#[0-9a-f]{6})/.exec(m[3])
      if (!named || named[1] === m[2]) return
      const way = ink.luminance(m[2]) > ink.luminance(named[1]) ? 'lighter' : 'darker'
      const says = way === 'lighter' ? /lifted|lighter/.test(m[3]) : /darker|darkened/.test(m[3])
      moved[way].push(m[1])
      if (!says) wrong.push(`line ${i + 1}: ${m[1]} ${m[2]} is ${way} than ${named[1]}, and its comment says "${m[3]}"`)
    })
    assert.deepEqual(wrong, [], `comments that say the wrong way:\n  ${wrong.join('\n  ')}`)
    assert.ok(moved.lighter.length > 60 && moved.darker.length >= 5, 'this no longer reads the palette lines')
    assert.match(read('src/lib/blockPalettes.js'), /rotary: '#825f3f', \/\/ the AM4 manual's picture #5a3406, lifted/, 'the AM4 rotary’s source is the plan’s value again')
  })

  test('on the colour sheet the neighbour line and Lighter and Darker sit by the pick, above the grid, on both ends', () => {
    /*
     * "Hard to tell from Drive next to it" was under the grid and under
     * Lighter and Darker, which on most phones is below the bottom of the
     * sheet: Red tapped for the amp, the line said where nobody saw it.
     */
    const finder = (f) => {
      const sheet = read(f)
      return [
        sheet,
        (s) => {
          const i = sheet.indexOf(s)
          assert.ok(i >= 0, `${f}: no ${s} for this test to find`)
          return i
        }
      ]
    }
    {
      const f = 'src/components/ColourSheet.jsx'
      const [sheet, at] = finder(f)
      assert.ok(at('<p className="colour-said">') < at("{warning || ''}") && at("{warning || ''}") < at('aria-label="A step darker"') && at('aria-label="A step darker"') < at('className="colour-swatches"'), `${f}: the neighbour line and Lighter and Darker are not between the pick’s name and the grid`)
      assert.equal(sheet.split("{warning || ''}").length, 2, `${f} says the neighbour line twice`)
    }
    {
      /*
       * The phone's go further: Darker and Lighter either side of the tiles,
       * the name and the neighbour line under them, all in the sheet's head,
       * which does not scroll — and only the grid scrolls, between it and
       * Cancel and Use it. On a 568-point phone the grid had started under the
       * fold, and the sheet opened with no colour in it to pick.
       */
      const f = 'mobile/src/components/ColourSheet.js'
      const [sheet, at] = finder(f)
      assert.ok(
        at('head={') < at('label="Darker"') &&
          at('label="Darker"') < at('label="Lighter"') &&
          at('label="Lighter"') < at('{shadeWords(capital(baseName), step)}') &&
          at('{shadeWords(capital(baseName), step)}') < at("{warning || ''}") &&
          at("{warning || ''}") < at('foot={') &&
          at('foot={') < at('onLayout={(e) => setGrid('),
        `${f}: the tiles, Lighter and Darker, the pick’s name and the neighbour line are not in the head above a grid that scrolls`
      )
      assert.equal(sheet.split("{warning || ''}").length, 2, `${f} says the neighbour line twice`)
      assert.match(sheet, /^\s+tall$/m, 'the colour sheet is four fifths of a small phone again')
      assert.match(read('mobile/src/components/Sheet.js'), /\{head \? <View[^>]*>\{head\}<\/View> : null\}\s+<ScrollView/, 'the sheet’s head scrolls with the rest')
    }
    assert.match(read('mobile/src/components/ColourSheet.js'), /style=\{\{ color: color\.signal, fontSize: font\.small, minHeight: 40, lineHeight: 20 \}\}/, 'the phone’s neighbour line does not keep two lines of room')
    assert.match(read('src/styles.css'), /\.colour-warning \{\n  min-height: 2\.8em;\n\}/, 'the browser’s neighbour line does not keep two lines of room')
  })

  test('the phone’s Colours page draws its scenes two across on the narrowest phones, as Play does', () => {
    const page = read('mobile/src/components/Colours.js')
    assert.match(page, /const sceneWidth = quarter !== undefined && quarter < 72 \? half : quarter/, '"IIC+ Hot Lead" is cut short at 320 wide again')
    assert.match(page, /style=\{\{ width: sceneWidth \}\}/)
  })

  test('the words under Put every colour back and Keep their colour say it once, plainly', async () => {
    const c = await withPage()
    assert.equal(c.PUT_BACK_WORDS, 'Back to Match my unit: every scene red, switched-off effects in their own colour')
    assert.equal(c.OFF_WORDS.colour, 'A faint wash of the effect’s own colour with an edge in that colour, so you still know which it is.')
    assert.match(read('src/components/Colours.jsx'), /<span className="hint">\{PUT_BACK_WORDS\}<\/span>/)
    assert.match(read('mobile/src/components/Colours.js'), /<Press label="Put every colour back" sub=\{PUT_BACK_WORDS\} onPress=\{\(\) => setAsking\('all'\)\} \/>/)
    for (const f of ['src/components/Colours.jsx', 'mobile/src/components/Colours.js']) assert.ok(!/the unit’s colours, and switched-off/.test(read(f)), `${f} says Match my unit twice again`)
  })

  test('the store words say what is true on every unit', () => {
    const store = read('docs/app-store.md')
    assert.ok(!/match your unit's own screen/.test(store), 'the store says every colour is off the unit’s own screen, which is not true on an FM3')
    assert.match(store, /Colors that match your Fractal unit and its editor/)
  })

  test('on an Axe-Fx II the Colours page and the sheet show each effect in the colour Play draws it, in every look', async () => {
    /*
     * The Axe-Fx II names its blocks the long way, and in Fractal Remote those
     * names have no colour: its "Tremolo/Panner 1" is drawn NEUTRAL on Play.
     * The page showed the tremolo family's old purple for it, and the sheet
     * offered that purple as the way back — a colour no tile on that unit
     * ever wore. Names from ForgeFX's gen-2 block list (ax2blockTypes.ts).
     */
    const c = await withPage()
    const GEN2_NAMES = {
      drive: 'Drive 1', amp: 'Amp 1', cab: 'Cab 1', delay: 'Delay 1', reverb: 'Reverb 1', comp: 'Compressor 1',
      gate: 'Gate Expander', wah: 'Wah 1', chorus: 'Chorus 1', flanger: 'Flanger 1', phaser: 'Phaser 1',
      tremolo: 'Tremolo/Panner 1', rotary: 'Rotary Speaker 1', pitch: 'Pitch 1', filter: 'Filter 1', geq: 'Graphic EQ 1',
      peq: 'Parametric EQ 1', volpan: 'Volume/Pan 1', enhancer: 'Enhancer', multitap: 'Multi Delay 1',
      megatap: 'Megatap Delay', synth: 'Synth 1', formant: 'Formant', ringmod: 'Ring Modulator', resonator: 'Resonator 1',
      multicomp: 'Multiband Compressor 1', mixer: 'Mixer', looper: 'Looper', crossover: 'Crossover 1',
      send: 'Feedback Send', return: 'Feedback Return', vocoder: 'Vocoder', tonematch: 'Tone Match', fxloop: 'FX Loop',
      input: 'Input Noise Gate'
    }
    c.setColourUnit('axefxii')
    const wrong = []
    for (const look of c.LOOKS) {
      c.setLook(look.id)
      for (const f of c.unitFamilies('gen2')) {
        const name = GEN2_NAMES[f]
        assert.ok(name, `the gen-2 page shows ${f}, which this test has no Axe-Fx II name for`)
        assert.equal(c.familyOf(name).family, f, `${name} is not the ${f} family`)
        const play = c.blockColor(name).fill
        if (c.pageColour(f).fill !== play) wrong.push(`${look.name}: the page’s ${f} is ${c.pageColour(f).fill}, Play draws ${name} ${play}`)
        const t = c.familyTarget(f)
        if (c.colourNow(t) !== play) wrong.push(`${look.name}: the sheet opens ${f} on ${c.colourNow(t)}, Play draws ${play}`)
        if (c.lookOwn(t) !== c.lookColour(name)) wrong.push(`${look.name}: the way back for ${f} is ${c.lookOwn(t)}, not the look’s ${c.lookColour(name)}`)
      }
    }
    assert.deepEqual(wrong, [], wrong.join('\n'))
    /* The case it was found by: Fractal Remote's tremolo on an Axe-Fx II is the unknown block's colour, page and Play alike. */
    c.setLook('fractalremote')
    assert.deepEqual(c.pageColour('tremolo'), c.NEUTRAL)
    /* And a colour of yours for the family still reaches the block by its long name. */
    c.paint(c.familyTarget('tremolo'), '#ff99cc')
    assert.equal(c.blockColor('Tremolo/Panner 2').fill, '#ff99cc')
    assert.equal(c.pageColour('tremolo').fill, '#ff99cc')
    /* And the block open on Edit opens the sheet on the colour it wears, by the name it came by: Match my unit paints an Axe-Fx II's Quad Chorus apart from its Chorus. */
    c.setLook('unit')
    const quad = c.familyTarget('Quad Chorus 1')
    assert.equal(quad.slug, 'chorus')
    assert.equal(c.colourNow(quad), c.blockColor('Quad Chorus 1').fill)
    assert.equal(c.lookOwn(quad), c.PALETTES.gen2.quadchorus)
    assert.notEqual(c.lookOwn(quad), c.lookOwn(c.familyTarget('chorus')))
    /* Every other unit sends the family's own name. */
    for (const id of ['gen3', 'am4', 'vp4']) for (const f of c.unitFamilies(id)) assert.equal(c.sentAs(f, id), f)
    for (const name of Object.values(c.SENT_AS.gen2)) assert.ok(c.ALIASES[name], `${name} is not a name familyOf knows`)
    /* Both pages draw their effect tiles by it. */
    for (const f of ['src/components/Colours.jsx', 'mobile/src/components/Colours.js']) assert.match(read(f), /const hue = pageColour\(f\)/, `${f} draws an effect in a colour Play may not`)
    c.setColourUnit(null)
  })

  test('Colour-blind safe keeps every pair of neighbours the app knows apart, in every vision', async () => {
    /*
     * The look is named for telling neighbours apart, and the sheet's
     * neighbour line works from the same list (lib/colourPage NEXT_TO). Its
     * Multitap and Plex were one aqua, side by side in that very list.
     */
    const c = await withPage()
    const t = c.lookById('cvd').families
    const far = (a, b) => Math.min(...c.VISIONS.map((v) => c.deltaE(c.seenWith(a, v), c.seenWith(b, v))))
    const close = []
    for (const [a, list] of Object.entries(c.NEXT_TO)) {
      for (const b of list) if (a < b && far(t[a], t[b]) < c.NEIGHBOUR_GAP) close.push(`${a} and ${b}, ${far(t[a], t[b]).toFixed(1)}`)
    }
    assert.deepEqual(close, [], `side by side and too alike:\n  ${close.join('\n  ')}`)
  })

  test('a preset’s tag sheet keeps the word colour in its title, however long the name', async () => {
    const c = await withPage()
    c.setColourUnit('fm3')
    const long = c.presetTarget(12, { words: '012 Shine On You Crazy Diamond Solo' })
    assert.equal(c.sheetTitle(long), 'Colour for 012 Shine On You Crazy Diamond Solo')
    assert.equal(c.sheetTitle(c.familyTarget('drive')), 'Drive colour')
    assert.equal(c.sheetTitle(c.sceneTarget(1)), 'Scene 2 colour')
    assert.equal(c.spokenSwatch(long, c.sheetSwatches(long)[0]), 'Colour for 012 Shine On You Crazy Diamond Solo, Red')
    for (const f of ['src/components/ColourSheet.jsx', 'mobile/src/components/ColourSheet.js']) assert.match(read(f), /title=\{target \? sheetTitle\(target\) : ''\}/, `${f} titles its sheet another way`)
    c.setColourUnit(null)
  })

  test('every page of the phone’s Settings opens at its top, and going back up returns to the row', () => {
    /*
     * One scroll holds every Settings page, so Colours — opened from near the
     * bottom of the list — came up part-way down itself, its title, its way
     * back and its Looks heading above the screen.
     */
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /const scroller = useRef\(null\)/)
    assert.match(settings, /const up = upFrom\(from\) === page\s+scroller\.current\?\.scrollTo\(\{ y: up \? offsets\.current\[page \?\? ''\] \|\| 0 : 0, animated: false \}\)\s+\}, \[page\]\)/, 'a page opens where the last one was scrolled to')
    assert.match(settings, /<ScrollView\s+ref=\{scroller\}/)
    assert.match(settings, /onScroll=\{\(e\) => \{\s+offsets\.current\[page \?\? ''\] = e\.nativeEvent\.contentOffset\.y\s+\}\}/)
    /* The effect reads `page` after it is declared: Hermes forgives the other order, a browser does not. */
    assert.ok(settings.indexOf('const [page, setPage] = useState(startPage)') < settings.indexOf('const lastPage = useRef(page)'))
  })
}
