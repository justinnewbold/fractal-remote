/**
 * What the Colours page offers, and what each of its choices does.
 *
 * "Additionally i want to make a section where a user can edit the colors of
 * the blocks/presets and effects. Let's figure out the best way to implement
 * that as well. Maybe even make some preset themes?"
 *
 * The page itself is drawn twice, once at each end, in each end's own
 * materials. What it OFFERS is decided once, here: which effects a unit has,
 * which swatches the colour sheet shows and in what order, how far Lighter
 * and Darker go, when a pick is too close to the block beside it, and the
 * words a screen reader says for each swatch. Two ends deciding those for
 * themselves would offer a player one set of colours on the phone and
 * another at the computer, for tiles that have to agree about which one is
 * the delay.
 *
 * Shared with the phone by `npm run sync:rules`, so it imports only its
 * neighbours, by explicit './x.js' paths, and no React.
 */
import { AMBERS, DORMANT, FRACTAL_REMOTE_LOOK, LOOKS, SCENE_RED, SWATCHES, familyOf, lookById, swatchesFor } from './blockPalettes.js'
import { contrast, darker, deltaE, inkOn, lighter, luminance, paperEdge, readable, seenWith, VISIONS, WHITE_WINDOW } from './ink.js'
import {
  SCENE_SLOTS,
  colourUnit,
  currentPaletteId,
  lookId,
  ownColourCount,
  presetColour,
  setFamily,
  setLook,
  setPresetColour,
  setScene,
  setScenes,
  yourFamily,
  yourScene
} from './looks.js'
import { blockColor, lookColour } from './blockColors.js'
import { sceneColor } from './sceneColors.js'

/* ------------------------------------------------------------------ */
/* What things are called                                               */
/* ------------------------------------------------------------------ */

/** A family's name, as a player says it. */
export const FAMILY_NAMES = Object.freeze({
  drive: 'Drive',
  amp: 'Amp',
  cab: 'Cab',
  delay: 'Delay',
  reverb: 'Reverb',
  comp: 'Compressor',
  gate: 'Gate',
  wah: 'Wah',
  chorus: 'Chorus',
  flanger: 'Flanger',
  phaser: 'Phaser',
  tremolo: 'Tremolo',
  rotary: 'Rotary',
  pitch: 'Pitch',
  filter: 'Filter',
  geq: 'Graphic EQ',
  peq: 'Parametric EQ',
  volpan: 'Volume/Pan',
  enhancer: 'Enhancer',
  multitap: 'Multitap Delay',
  megatap: 'Megatap Delay',
  plex: 'Plex Delay',
  tentap: 'Ten-Tap Delay',
  synth: 'Synth',
  formant: 'Formant',
  ringmod: 'Ring Mod',
  resonator: 'Resonator',
  multicomp: 'Multiband Comp',
  mixer: 'Mixer',
  looper: 'Looper',
  crossover: 'Crossover',
  send: 'Send',
  return: 'Return',
  multiplexer: 'Multiplexer',
  vocoder: 'Vocoder',
  tonematch: 'Tone Match',
  fxloop: 'FX Loop',
  input: 'Input',
  output: 'Output',
  shunt: 'Shunt',
  irplayer: 'IR Player',
  rta: 'RTA',
  nam: 'NAM',
  dynadist: 'Dynamic Distortion',
  scenemidi: 'Scene MIDI',
  controllers: 'Controllers'
})

/** The name a slug goes by here, or null for a block nobody here can name. */
export const familyName = (slug) => {
  const family = familyOf(slug)?.family
  return family ? FAMILY_NAMES[family] || family : null
}

/** The same name inside a sentence: "drive", "graphic EQ", "IR player" — the letters that are always capitals stay so. */
const inSentence = (name) =>
  String(name)
    .split(' ')
    .map((w) => (/^[A-Z]{2,}/.test(w) ? w : w.toLowerCase()))
    .join(' ')

/** Whose colours "Match my unit" is wearing, for the Settings row. */
export const PALETTE_NAMES = Object.freeze({ gen3: 'FM3, FM9 and Axe-Fx III', am4: 'AM4', vp4: 'VP4', gen2: 'Axe-Fx II' })

/* ------------------------------------------------------------------ */
/* Which effects the page shows                                         */
/* ------------------------------------------------------------------ */

/*
 * THE EFFECTS EACH KIND OF UNIT HAS, in the order a chain usually runs.
 *
 * Every palette paints every family, because a block borrowed from another
 * generation still needs a colour if it ever turns up. The page shows only
 * the ones the unit really has: an AM4 owner scrolling past Plex Delay and
 * Multiplexer to find his drive would be reading a list for some other
 * unit. Read off the same sources the palettes were (each palette line says
 * "not on this unit" where it is borrowed).
 *
 * Never the chain's two ends or a shunt — they are outlines, so a colour
 * there is never seen — and never the blocks ForgeFX does not name yet
 * (DORMANT in lib/blockPalettes): a colour offered for a block the app can
 * never draw is a promise nothing keeps. The Axe-Fx II's own Vocoder, Tone
 * Match and FX Loop are named, so its list has them.
 */
const CHAIN_ORDER = [
  'drive', 'amp', 'cab', 'delay', 'reverb', 'comp', 'gate', 'wah', 'chorus', 'flanger', 'phaser', 'tremolo',
  'rotary', 'pitch', 'filter', 'geq', 'peq', 'volpan', 'enhancer', 'multitap', 'megatap', 'plex', 'tentap',
  'synth', 'formant', 'ringmod', 'resonator', 'multicomp', 'mixer', 'looper', 'crossover', 'send', 'return',
  'multiplexer', 'vocoder', 'tonematch', 'fxloop'
]
const ON_UNIT = Object.freeze({
  gen3: CHAIN_ORDER.filter((f) => !DORMANT.includes(f)),
  am4: ['drive', 'amp', 'delay', 'reverb', 'comp', 'gate', 'wah', 'chorus', 'flanger', 'phaser', 'tremolo', 'rotary', 'filter', 'geq', 'peq', 'volpan', 'enhancer'],
  vp4: [
    'drive', 'delay', 'reverb', 'comp', 'gate', 'wah', 'chorus', 'flanger', 'phaser', 'tremolo', 'rotary', 'pitch',
    'filter', 'geq', 'peq', 'volpan', 'enhancer', 'multitap', 'megatap', 'plex', 'synth', 'formant', 'ringmod', 'resonator'
  ],
  gen2: CHAIN_ORDER.filter((f) => !['plex', 'tentap', 'multiplexer'].includes(f))
})

/** The effects a kind of unit has, by family, in chain order. Gen-3's for one this does not know. */
export const unitFamilies = (palette = currentPaletteId()) => [...(ON_UNIT[palette] || ON_UNIT.gen3)]

const quietFamily = (family) => family === 'input' || family === 'output' || family === 'shunt'

/**
 * The families in the loaded preset, in the order its blocks came, each
 * once: what the page shows first, "the drive in THIS preset". A second
 * delay is the same family as the first, so it is one tile.
 */
export function presetFamilies(blocks) {
  const out = []
  for (const b of Array.isArray(blocks) ? blocks : []) {
    const family = familyOf(b?.slug)?.family
    if (family && !quietFamily(family) && !DORMANT.includes(family) && !out.includes(family)) out.push(family)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* What is being painted                                                */
/* ------------------------------------------------------------------ */

/** An effect family, as the colour sheet is handed it. Null for a block nobody here can name. */
export function familyTarget(slug) {
  const family = familyOf(slug)?.family
  return family ? Object.freeze({ kind: 'family', slug: family, name: FAMILY_NAMES[family] || family }) : null
}

/**
 * Whether a block's colour is one anybody would see: a family the app can
 * name, and not one of the chain's two ends or a shunt, which are drawn as
 * outlines (the plumbing, not the tone). What the Edit screen's Colour
 * button is offered for, so it is never offered for a colour nobody sees.
 */
export function paintable(slug) {
  const family = familyOf(slug)?.family
  return !!family && !quietFamily(family)
}

const slotOf = (i) => ((Number(i) % SCENE_SLOTS) + SCENE_SLOTS) % SCENE_SLOTS

/** One preset, as a scene or a tag is handed it: its number, and the words it goes by ("012 Lead Rig"). */
const presetHere = (preset) =>
  preset && Number.isInteger(preset.number) && preset.number >= 0
    ? Object.freeze({ number: preset.number, words: String(preset.words || '').trim() || String(preset.number) })
    : null

/**
 * A scene, by its index from 0, as the colour sheet is handed it — and the
 * preset that is loaded, where there is one, so the sheet can offer "Just
 * this preset (012 Lead Rig)" beside "Every preset". `only` is which of the
 * two the sheet opens on: every preset from the Colours page, whose scenes
 * are the ones every preset wears; just this one from the scene names on
 * Edit, which are this preset's.
 *
 * `called` is the scene's own name where it has one, "Pushed AC": the sheet's
 * tiles show what Play will draw, and Play draws the name. The title stays
 * "Scene 2 colour", which says what is being painted whatever it is called.
 */
export function sceneTarget(i, { preset, only = false, called } = {}) {
  const index = slotOf(i)
  const here = presetHere(preset)
  const name = `Scene ${index + 1}`
  return Object.freeze({ kind: 'scene', index, name, label: String(called || '').trim() || name, preset: here, only: !!(here && only) })
}

/**
 * How many scenes the Colours page shows: as many as Play does, which is as
 * many as the unit has — an AM4 has four, and four more tiles for scenes it
 * does not have would be colours nobody ever sees. Eight, the most there are,
 * before a unit has said.
 */
export const pageSceneCount = (capabilities) => {
  const n = capabilities?.sceneCount
  return Number.isInteger(n) && n > 0 ? Math.min(n, SCENE_SLOTS) : SCENE_SLOTS
}

/*
 * "JUST THIS PRESET". Fractal's own PERFORM layout forces Clean, Crunch and
 * Lead to green, yellow and red in the one preset that wants them and leaves
 * every other preset's scenes red: so a scene's colour is the same in every
 * preset unless one preset has its own, and the sheet asks which it is
 * painting. The preset's number is the one with the unit it is on (lib/looks
 * files it under the unit setlists and stars use, the demo's apart), so an
 * FM3's preset 12 never colours an AM4's.
 */
const within = (t, only) => (t.kind === 'scene' && only && t.preset ? t.preset.number : null)

/** The colour it is drawn in now, yours included — in this preset when the sheet is painting just this one. */
export function colourNow(t, { only = false } = {}) {
  if (t.kind === 'preset') return presetColour(t.unit, t.number) || TAG_SWATCHES[0].fill
  if (t.kind === 'scene') return sceneColor(t.index, within(t, only)).fill
  return blockColor(t.slug).fill
}

/** The look's own colour for it: what it is with nothing of yours on top. A preset's tag has none: no look tags a preset. */
export const lookOwn = (t) => (t.kind === 'preset' ? null : t.kind === 'scene' ? lookById(lookId()).scenes[t.index] : lookColour(t.slug))

/** Your own colour for it, or null — this preset's own, when the sheet is painting just this one. */
export function yoursFor(t, { only = false } = {}) {
  if (t.kind === 'preset') return presetColour(t.unit, t.number)
  if (t.kind === 'scene') {
    const p = within(t, only)
    return p === null ? yourScene(t.index) : yourScene(t.index, { preset: p })
  }
  return yourFamily(t.slug)
}

const same = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase()

/**
 * Paint it. Null is "Back to the unit's colour".
 *
 * Picking the look's own colour is putting yours away, not pinning a copy of
 * the look's: the next look you wear should still repaint it. And in the same
 * way, picking for just this preset the colour the scene has in every preset
 * is putting this preset's away — so that changing the every-preset colour
 * later still reaches this preset, which is what it looked like it would.
 */
export function paint(t, fill, { only = false } = {}, storage) {
  if (t.kind === 'preset') return setPresetColour(t.unit, t.number, fill || null, storage)
  const p = within(t, only)
  if (p !== null) {
    const f = fill && same(fill, sceneColor(t.index).fill) ? null : fill || null
    return setScene(t.index, f, { preset: p }, storage)
  }
  const f = fill && same(fill, lookOwn(t)) ? null : fill || null
  if (t.kind === 'scene') return setScene(t.index, f, {}, storage)
  return setFamily(t.slug, f, storage)
}

/**
 * Whether the sheet keeps it off the amber: a scene, because the scene you
 * are on is ringed in it, and a preset's tag, because the preset you are on
 * is marked in it in every list a tag is drawn in. An effect is not: its
 * colour is the unit's, and an AM4's PEQ is the AM4's orange.
 */
export const offAmber = (t) => !!t && t.kind !== 'family'

/** What the sheet says it is painting, under its title. */
export function sheetNote(t, { only = false } = {}) {
  if (t.kind === 'preset') return 'Kept for this preset on this unit, like its star'
  if (t.kind === 'scene') return within(t, only) === null ? 'For this scene in every preset' : `For this scene in ${t.preset.words} only`
  return `For every ${inSentence(t.name)}, in every preset`
}

/** The words on the way back from a colour of your own: to the look's, to every preset's, or no tag at all. */
export function backWords(t, { only = false } = {}) {
  if (t.kind === 'preset') return 'Take the colour off'
  if (within(t, only) !== null) return 'Same as every preset'
  const look = lookById(lookId())
  return look.id === 'unit' ? 'Back to the unit’s colour' : `Back to ${look.name}’s colour`
}

/**
 * The two answers to "which presets?", for a scene painted while a preset is
 * loaded. The preset's own words go under "Just this preset" — "012 Lead Rig"
 * — on a line of their own: in a button half a phone wide, "Just this preset
 * (012 Lead Rig)" on one line is "Just this preset (012 Le…".
 */
export const SCOPE_WORDS = Object.freeze({ every: 'Every preset', only: 'Just this preset' })

/* ------------------------------------------------------------------ */
/* A preset's colour tag                                                */
/* ------------------------------------------------------------------ */

/*
 * A COLOUR FOR A PRESET, the editors' "Assign Color": a thin bar on its row
 * in the preset list and in a setlist, and beside its name on Play, so a set
 * of presets can be grouped by eye — the clean ones blue, the heavy ones red.
 * Kept per unit and preset number, like a star: preset 12 on an FM3 and
 * preset 12 on an AM4 are different sounds.
 *
 * Nothing but a bar, never a fill: the row is still the row, its letters
 * still the app's own, and the amber that marks the preset you are on still
 * the only thing in the list that says so. So a tag is offered what a scene
 * is — the twenty-three without the amber-like orange — less the look's own
 * colour first, because no look tags a preset: twenty-two.
 */

/** The swatches a tag is offered: the twenty-three, without the one like the amber. */
export const TAG_SWATCHES = Object.freeze(SWATCHES.filter((s) => s.scene !== false))

/**
 * One preset on the unit that is connected, as the colour sheet is handed it.
 * Null before any unit has answered: there is nothing to file the tag under.
 */
export function presetTarget(number, { words, unit = colourUnit() } = {}) {
  const here = presetHere({ number, words })
  if (!here || !unit) return null
  return Object.freeze({ kind: 'preset', number: here.number, unit, name: here.words })
}

/** That preset's tag on the unit that is connected, or null. */
export const presetTag = (number, unit = colourUnit()) => (Number.isInteger(number) && unit ? presetColour(unit, number) : null)

/** How wide the bar is, in points on the phone and pixels in the browser. */
export const TAG_WIDTH = 4

/**
 * THE BAR IS DRAWN BY ONE RULE AT BOTH ENDS. On the dark page it is the
 * colour itself: everything on offer stands 3:1 off the black. On the Light
 * page a pale one — white, yellow, lime — would be a stripe of nothing on
 * paper, so there it is the colour taken half way to black: the edge a lit
 * tile gets on paper (lib/ink paperEdge), which styles.css writes as
 * `color-mix(… 50%, black)` and a test holds the two to each other.
 */
export const tagFill = (fill, { light = false } = {}) => (fill ? (light ? paperEdge(fill) : String(fill).toLowerCase()) : null)

/** What a tag is called, for a screen reader: "Blue", or "a colour of your own" for one typed in. */
export const tagName = (fill) => SWATCHES.find((s) => same(s.fill, fill))?.name || 'a colour of your own'

/**
 * What a screen reader says for the Colour button beside a preset's star:
 * what it is now, and what a press does.
 */
export const tagButtonWords = (words, fill) => (fill ? `Colour for ${words}: ${tagName(fill)}. Change it` : `Give ${words} a colour`)

/* ------------------------------------------------------------------ */
/* The sheet's swatches                                                 */
/* ------------------------------------------------------------------ */

/**
 * The grid, in order: the look's own colour first, then Fractal's eleven
 * footswitch ring colours, then twelve of the units' own block colours
 * (lib/blockPalettes, where each is checked to carry its letters). A scene is
 * not offered the one that looks like the amber, which rings the scene you
 * are in. Nothing else, and no free picker on the phone: there is no package
 * for one that does not move the fingerprint, and these plus Lighter and
 * Darker cover it.
 */
export function sheetSwatches(t) {
  /* A tag has no look of its own to start the grid with (TAG_SWATCHES). */
  if (t.kind === 'preset') return TAG_SWATCHES.map((s) => ({ ...s, said: s.name }))
  const scene = t.kind === 'scene'
  const lookName = lookById(lookId()).name
  return swatchesFor(lookOwn(t), { scene }).map((s) =>
    s.own ? { ...s, name: lookId() === 'unit' ? 'Unit' : 'Look', said: lookId() === 'unit' ? 'the unit’s own colour' : `${lookName}’s own colour` } : { ...s, said: s.name }
  )
}

/**
 * What a screen reader says for one swatch: "Drive colour, Red", and
 * "your own" on the one that is yours now — "Drive colour, raspberry, your
 * own" in the plan's words. The grid is two dozen squares of colour, and
 * without names it is two dozen identical buttons.
 */
export const spokenSwatch = (t, swatch, { yours = false } = {}) =>
  `${t.name} colour, ${swatch.said || swatch.name}${yours ? ', your own' : ''}`

/* ------------------------------------------------------------------ */
/* Lighter and Darker                                                   */
/* ------------------------------------------------------------------ */

const STEPS = [0.15, 0.3, 0.45]
/** A step the eye can see, side by side: smaller ones are dropped. */
const VISIBLE = 3
/** How close to the amber a scene's colour may come (it rings the scene you are in). */
const AMBER_GAP = 10

const reads = (c) => contrast(c, inkOn(c)) >= 4.5
const nearAmber = (c) => AMBERS.some((a) => deltaE(c, a) < AMBER_GAP)

/**
 * Up to three steps each way from a swatch, every one of them a colour whose
 * letters still read.
 *
 * Each step is the swatch with black or white mixed in, then put through
 * readable() (lib/ink) — the hue kept, only the lightness nudged back into a
 * window where one of the two inks reads at 4.5:1 and a lit tile still
 * stands clear of an unlit one. So a step can come back no darker than the
 * last, or too close to it to see: those are dropped rather than offered,
 * and when none is left that way, the button says so by doing nothing. Red
 * has no Darker at all: any darker and an unlit red tile would be lost on
 * the black stage.
 */
export function shades(fill, { scene = false } = {}) {
  const base = String(fill || '').toLowerCase()
  const L0 = luminance(base)
  const out = { darker: [], lighter: [] }
  if (L0 === null) return out
  for (const [way, move, further] of [
    ['darker', darker, (L, was) => L < was - 0.004],
    ['lighter', lighter, (L, was) => L > was + 0.004]
  ]) {
    let last = base
    let lastL = L0
    for (const k of STEPS) {
      const c = readable(move(base, k))
      const L = luminance(c)
      if (!further(L, lastL) || deltaE(c, last) < VISIBLE || !reads(c) || (scene && nearAmber(c))) continue
      out[way].push(c)
      last = c
      lastL = L
    }
  }
  return out
}

/** The colour `step` steps from `fill` (minus is darker), or the nearest one there is. */
export function shadeOf(fill, step, opts) {
  if (!step) return String(fill || '').toLowerCase()
  const s = shades(fill, opts)
  const list = step < 0 ? s.darker : s.lighter
  const n = Math.min(Math.abs(step), list.length)
  return n ? list[n - 1] : String(fill || '').toLowerCase()
}

/** "Red", "Red, a step lighter", "Red, 2 steps darker". */
export const shadeWords = (name, step) =>
  !step ? name : `${name}, ${Math.abs(step) === 1 ? 'a step' : `${Math.abs(step)} steps`} ${step < 0 ? 'darker' : 'lighter'}`

/* ------------------------------------------------------------------ */
/* Any colour, in the browser                                           */
/* ------------------------------------------------------------------ */

/**
 * A colour code as somebody types one: "#cc0000", "cc0000", or the short
 * "#c00" a web page writes. Six figures, lower case, with the #; null for
 * anything that is not a colour yet, which is every keystroke but the last
 * while one is being typed.
 */
export function colourCode(text) {
  const s = String(text ?? '').trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`
  if (/^[0-9a-f]{3}$/.test(s)) return `#${[...s].map((c) => c + c).join('')}`
  return null
}

/*
 * ANY COLOUR AT ALL, MADE SAFE TO WEAR. Only the browser offers one: it has a
 * colour picker of its own (<input type="color">), and the phone would need a
 * package with native code for one, which moves the fingerprint and costs a
 * build. But the rule a free pick goes through is here, beside the grid's,
 * so the two ends paint by the same rules and a colour chosen at the computer
 * is one the phone would have let through.
 *
 * The pick goes through readable() (lib/ink): its hue kept, only its
 * lightness moved, into a window where its letters read at 4.5:1 and a lit
 * tile still stands clear of an unlit one on the black stage. `moved` says
 * which way it went, for the line that says why the tile is not quite what
 * was picked — a sheet that quietly paints something else reads as a sheet
 * that is broken. And a scene is never given a colour within reach of the
 * amber that rings the scene you are in, by the same measure the swatches
 * and Lighter and Darker are held to: `amber` says so, and the sheet will not
 * use it.
 *
 * `offered` is the sheet's own swatches: a code typed that is one of them —
 * Fractal's red is #cc0000 whichever way it is reached — is the grid's
 * colour, already checked, and is used as it is rather than moved a shade
 * by a rule stricter than the one the grid was chosen by.
 */
export function freePick(text, { scene = false, offered = [] } = {}) {
  const raw = colourCode(text)
  if (!raw) return null
  const fill = offered.some((o) => String(o).toLowerCase() === raw) ? raw : String(readable(raw)).toLowerCase()
  const moved = fill === raw ? null : luminance(fill) > luminance(raw) ? 'lighter' : 'darker'
  /* Why it moved: too dark for a lit tile to show on the dark stage, or in
     between, where neither black letters nor white quite read. */
  const why = !moved ? null : luminance(raw) < WHITE_WINDOW[0] ? 'stage' : 'letters'
  return Object.freeze({ raw, fill, moved, why, amber: scene && nearAmber(fill) })
}

/*
 * What the sheet says under a free pick that was moved, or that a scene
 * cannot have. A dark pick is brightened for the stage, not for its letters —
 * white letters read better on #330066 than on what it becomes — and by more
 * than a little sometimes (#202020 comes back #696969), so it says what is
 * true: a lit tile has to stand out from an unlit one on the black.
 */
export const FREE_PICK_WORDS = Object.freeze({
  stage: 'Brightened so it shows on a dark stage',
  lighter: 'Brightened a little so its letters stay readable',
  darker: 'Darkened a little so its letters stay readable',
  amber: 'Too close to the amber ring that marks the scene you are on. Pick another colour for a scene.',
  notYet: 'A colour code is a # and six letters or numbers, like #cc0000'
})

/** The line for a free pick: refused for a scene, moved and why, or nothing. */
export function freePickSaid(got) {
  if (!got) return ''
  if (got.amber) return FREE_PICK_WORDS.amber
  if (!got.moved) return ''
  return got.why === 'stage' ? FREE_PICK_WORDS.stage : FREE_PICK_WORDS[got.moved]
}

/* ------------------------------------------------------------------ */
/* Too close to the one beside it                                       */
/* ------------------------------------------------------------------ */

/*
 * WHICH EFFECTS USUALLY SIT SIDE BY SIDE: the chain the looks themselves were
 * built and checked against (colours/synth build.py), a typical guitar rig
 * from compressor to EQ, plus the pairs that meet in nearly every preset.
 * The loaded preset's own order is added to it where the page knows it.
 */
const CHAIN = [
  'comp', 'wah', 'drive', 'amp', 'cab', 'geq', 'chorus', 'flanger', 'phaser', 'tremolo', 'rotary', 'pitch',
  'delay', 'multitap', 'plex', 'reverb', 'volpan', 'enhancer', 'filter', 'gate', 'peq'
]
const PAIRS = [
  ...CHAIN.slice(1).map((f, i) => [CHAIN[i], f]),
  ['delay', 'reverb'],
  ['drive', 'amp'],
  ['amp', 'cab'],
  ['chorus', 'delay'],
  ['geq', 'peq']
]
export const NEXT_TO = Object.freeze(
  PAIRS.reduce((map, [a, b]) => {
    for (const [x, y] of [[a, b], [b, a]]) map[x] = [...new Set([...(map[x] || []), y])]
    return map
  }, {})
)

/** How far apart (CIEDE2000) two tiles side by side have to be: 10 is two colours nobody mistakes at arm's length. */
export const NEIGHBOUR_GAP = 10

/** The families beside this one: the usual ones, and the ones beside it in `chain` (families, in order). */
export function neighboursOf(family, chain = []) {
  const out = new Set(NEXT_TO[family] || [])
  const at = chain.indexOf(family)
  if (at > 0) out.add(chain[at - 1])
  if (at >= 0 && at < chain.length - 1) out.add(chain[at + 1])
  out.delete(family)
  return [...out]
}

/**
 * A line for the sheet when a pick is hard to tell from what sits beside it,
 * or null. "Hard to tell from Drive next to it", and "(for some colour-blind
 * players)" when it is only so in one of the three kinds of colour blindness
 * the looks were checked for.
 *
 * Only ever a line: a player may want his amp the same red as his drive,
 * and this is the app saying what it sees, not refusing. And never about the
 * look's own colour — the sheet warns about what you bring, not about what
 * the unit already does.
 *
 * `chain` is the loaded preset's families in order; `colourOf` what each
 * neighbour is drawn in now (blockColor, or sceneColor for a scene).
 */
export function nextToWarning(t, pick, { chain = [], colourOf, only = false } = {}) {
  /* A tag is a bar beside a name, with no neighbour it could be mistaken for. */
  if (t.kind === 'preset') return null
  if (!pick || same(pick, lookOwn(t))) return null
  /* In just this preset, the scenes either side as this preset draws them. */
  const p = within(t, only)
  const around =
    t.kind === 'scene'
      ? [t.index - 1, t.index + 1].filter((j) => j >= 0 && j < SCENE_SLOTS).map((j) => ({ name: `scene ${j + 1}`, fill: (colourOf || ((x) => sceneColor(x, p).fill))(j) }))
      : neighboursOf(t.slug, chain).map((f) => ({ name: FAMILY_NAMES[f] || f, fill: (colourOf || ((x) => blockColor(x).fill))(f) }))
  let seen = null
  let hidden = null
  for (const n of around) {
    const far = VISIONS.map((v) => deltaE(seenWith(pick, v), seenWith(n.fill, v)))
    if (far[0] !== null && far[0] < NEIGHBOUR_GAP && (!seen || far[0] < seen.by)) seen = { name: n.name, by: far[0] }
    const worst = Math.min(...far.slice(1).filter((d) => d !== null))
    if (worst < NEIGHBOUR_GAP && (!hidden || worst < hidden.by)) hidden = { name: n.name, by: worst }
  }
  if (seen) return `Hard to tell from ${seen.name} next to it`
  if (hidden) return `Hard to tell from ${hidden.name} next to it (for some colour-blind players)`
  return null
}

/* ------------------------------------------------------------------ */
/* The looks, and Undo                                                  */
/* ------------------------------------------------------------------ */

/** How long "Now: Sunlight · Undo" stays, after one tap put a whole look on. */
export const UNDO_MS = 8000

/**
 * Wear a look, and say what to go back to. One tap repaints the whole app,
 * which is the point and also the danger — so the page keeps `was` for
 * UNDO_MS and Undo wears it again. Null for a look there is no such thing as.
 */
export function wearLook(id, storage) {
  const was = lookId()
  return setLook(id, storage) ? { was, now: id } : null
}

/**
 * What a look's card shows: Drive, Amp, Delay and Reverb lit, and scene 1,
 * in the look's own colours on this unit — yours left off, because the card
 * is there to show the look. Play draws them with the same tile.
 */
export function lookCard(id, palette = currentPaletteId()) {
  const look = lookById(id)
  return [
    ...['drive', 'amp', 'delay', 'reverb'].map((slug) => ({ slug, fill: lookColour(slug, { look: look.id, palette }) })),
    { scene: 0, fill: look.scenes[0] }
  ]
}

/** The looks, in the order the page offers them, with Fractal Remote second. */
export const LOOK_ORDER = Object.freeze(LOOKS.map((l) => l.id))

/**
 * The line under the Settings row: "Match my unit · AM4 colours", "Sunlight ·
 * 2 of your own". `unitName` is the connected unit's own name where there is
 * one, which is shorter and truer than the three a gen-3 palette covers.
 */
export function coloursStatus({ unitName, palette = currentPaletteId() } = {}) {
  const look = lookById(lookId())
  const count = ownColourCount()
  const whose = unitName || PALETTE_NAMES[palette] || PALETTE_NAMES.gen3
  return [look.name, look.id === 'unit' ? `${whose} colours` : null, count ? `${count} of your own` : null].filter(Boolean).join(' · ')
}

/* ------------------------------------------------------------------ */
/* Scenes: all red, or a colour each                                    */
/* ------------------------------------------------------------------ */

const allRed = (fills) => fills.every((f) => String(f).toLowerCase() === SCENE_RED)

/** Whether every scene is drawn red now, as on the unit. */
export const scenesAllRed = () => allRed(Array.from({ length: SCENE_SLOTS }, (_, i) => sceneColor(i).fill))

/**
 * "All red, like the unit" or "A colour for each scene", as one write.
 *
 * Whichever of the two the look already is, choosing it puts your scene
 * colours away. The other one is written as your own: all red on a look that
 * gives each scene a colour, or a colour each — the look's eight if it has
 * them, Colour-blind safe's if it is all red — on one that does not.
 */
export function chooseScenes(each, storage) {
  const look = lookById(lookId())
  const lookRed = allRed(look.scenes)
  if (each === !lookRed) return setScenes(Array(SCENE_SLOTS).fill(null), storage)
  return setScenes(each ? [...lookById('cvd').scenes] : Array(SCENE_SLOTS).fill(SCENE_RED), storage)
}

/* ------------------------------------------------------------------ */
/* Grey when off, and the one-time line                                 */
/* ------------------------------------------------------------------ */

/*
 * GREY WHEN OFF, the other way a switched-off effect can be drawn: as the
 * units draw a bypassed block — an FM3's is a black tile, a #666666 outline
 * and dim letters — rather than a pale wash of its own colour. One grey for
 * every unit. The letters are lifted from the FM3's own dim grey (about
 * 2.4:1) to 4.5:1, and the outline stands 3:1 off the page, on both pages.
 * These are the phone's own panel and greys, so a grey tile looks like part
 * of the app rather than a hole in it; a test holds the sums.
 */
export const OFF_GREY = Object.freeze({
  dark: Object.freeze({ fill: '#15181d', edge: '#666666', ink: '#878d97' }),
  light: Object.freeze({ fill: '#e9e6e0', edge: '#767d87', ink: '#5b626c' })
})

/**
 * What the two choices for a switched-off effect say, on both ends. Not "a
 * pale tile" or "a dark tile": the tile is dark on the stage and pale on the
 * Light page in both ways, and in each theme one of those sentences said the
 * opposite of the picture beside it.
 */
export const OFF_WORDS = Object.freeze({
  colour: 'A faint wash of the effect’s own colour, with an edge in it, so you still know which it is.',
  grey: 'Greyed out, with a grey edge, the way the unit draws an effect that is off.'
})

/** The one-time line on Play after the colours changed, for somebody who had the app before. */
export const COLOURS_NOTICE = 'Colours now match your unit · Settings → Colours'

/** Whether a look is the one the phone still lifts (Tile), for a card drawn in a look not being worn. */
export const liftedLook = (id) => id === FRACTAL_REMOTE_LOOK
