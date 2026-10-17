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
    assert.equal(c.PALETTES.gen3.amp, '#865d3c', 'the brown amp of the FM3’s own screen')
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
  })

  test('the face is shaded away from its letters, never toward them, on both ends', async () => {
    const css = read('src/styles.css')
    const rule = (sel) => css.slice(css.indexOf(sel + ' {'), css.indexOf('}', css.indexOf(sel + ' {')))
    assert.match(rule('button.fx-tile'), /color: var\(--tile-ink, #fff\);/, 'the strip writes white letters on every tile again')
    assert.match(rule("[data-theme='light'] button.fx-tile"), /color: var\(--tile-ink, #fff\);/, 'the Light strip writes white letters on every tile again')
    const console_ = read('src/components/Console.jsx')
    assert.match(console_, /'--tile-ink': inkFor\(block\.slug\)/, 'the strip does not hand its tiles their letters')
    assert.match(console_, /data-shade=\{shadeFor\(block\.slug\)\}/, 'the strip does not say which way a tile is shaded')
    assert.match(console_, /isFractalRemoteLook\(\) \? undefined : inkFor\(slug\) === LIGHT_INK \? 'down' : 'up'/, 'Fractal Remote is shaded like the new looks')
    const tile = read('mobile/src/components/Tile.js')
    assert.match(tile, /const shadeBelow = !asBefore && lit === LIGHT_INK/, 'the phone lays a white sheen over white letters')
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
    for (const { look, unit } of everyLookAndUnit(c)) {
      for (const { slug, fill } of resolved(c, look, unit)) if (!c.quietEnd(slug)) check(`${look.name} on ${unit}: ${slug}`, fill)
      for (let i = 0; i < 8; i++) check(`${look.name}: scene ${i + 1}`, c.sceneColor(i).fill)
    }
    for (const s of c.swatchesFor('#cc0000', { scene: true }).slice(1)) check(`scene swatch ${s.name}`, s.fill)
    assert.deepEqual(near, [], `too close to the amber:\n  ${near.join('\n  ')}`)
    assert.deepEqual(c.AMBERS, ['#f0a73c', '#a8650a'], 'the ambers this checks against are not the app’s')
    assert.ok(!c.swatchesFor('#cc0000', { scene: true }).some((s) => s.name === 'Orange'), 'a scene is offered the amber-like orange')
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
      ['gen3 megatap (the tile’s body)', c.PALETTES.gen3.megatap, '#2b403b'],
      ['gen3 NAM (the tile’s body)', c.PALETTES.gen3.nam, '#3c197a'],
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
    /* The AM4 draws white letters on these, and so does the app now. */
    for (const slug of ['chorus', 'comp', 'phaser']) assert.equal(c.inkOn(c.PALETTES.am4[slug]), c.LIGHT_INK, `AM4 ${slug} has black letters where the unit has white`)
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
    assert.deepEqual(c.blockColor('Delay 2'), { fill: '#ff99cc', ink: c.inkOn('#ff99cc') }, 'your colour is not on top of the look')
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
    c.setColourUnit('vp4')
    assert.equal(JSON.parse(store.kept['fractal.colours']).palette.id, 'vp4')

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
    assert.equal(c.quietEnd('input'), false, 'the phone draws the ends differently in the old look')
    assert.ok(c.isFractalRemoteLook())

    /* Drawn as it was: the phone lifts it, and only it, and keeps its edges. */
    const tile = read('mobile/src/components/Tile.js')
    assert.match(tile, /const asBefore = isFractalRemoteLook\(\)/)
    assert.match(tile, /const hue = asBefore \? vivid\(fill\) : fill/, 'Fractal Remote is not lifted on the phone, or every look is')
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
    assert.match(forge, /if \(label\) unitSlug = deviceSlug\(label\)[\s\S]{0,300}setColourUnit\(unitSlug, \{ demo: !!mock \}\)/, 'the browser does not tell the colours which unit it found')
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

  test('the store words say what is true on every unit', () => {
    const store = read('docs/app-store.md')
    assert.ok(!/match your unit's own screen/.test(store), 'the store says every colour is off the unit’s own screen, which is not true on an FM3')
    assert.match(store, /Colors that match your Fractal unit and its editor/)
  })
}
