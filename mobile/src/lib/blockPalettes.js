/* Generated from src/lib/blockPalettes.js by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * The colours Fractal paints its blocks, one set per kind of unit, and the
 * looks a player can pick instead.
 *
 * "I feel like the button and effects pedal colors dont match the colors on
 * real fractal units. Can you research all the fractal units, the official
 * fractal editors and let's make the colors match better?"
 *
 * They did not, and could not have: four of the old colours were read off an
 * AM4 photo, five off one FM3-Edit screenshot, and the rest were the app's own
 * guesses carried forward. These are read out of Fractal's own pictures:
 *
 *   - FM3, FM9 and Axe-Fx III: the block pictures inside FM3-Edit 1.07.17,
 *     FM9-Edit 1.03.22 and Axe-Edit III 1.14.34 (the three ship identical
 *     files), and the unit's own screen in the owner's manual where it draws
 *     one (amp, cab and the two ends).
 *   - AM4 and VP4: the block pictures on page 25 of each owner's manual, the
 *     bright end of each tile, which is the end a lit block shows.
 *   - Axe-Fx II, AX8 and FX8: the block pictures inside Axe-Edit II 3.15,
 *     AX8-Edit and FX8-Edit (identical again). The units' own screens are
 *     monochrome, so the editors are all there is.
 *
 * WHY MOST OF THEM ARE LIGHTER THAN FRACTAL'S. The gen-3 editors draw very
 * dark tiles on a grey window; on a black stage a lit tile that dark is hard
 * to tell from an unlit one. So a colour is kept exactly when its letters
 * read at 4.5:1 and a lit tile stands 3:1 clear of an unlit one, and
 * otherwise only its LIGHTNESS moves — the hue and how saturated it is stay
 * Fractal's — into one of the two windows in lib/ink (white letters, or
 * black). The comment on each line says where it came from and whether it
 * moved.
 *
 * WHY A FEW MOVED MORE THAN THAT. The amber is this app's own colour: it
 * marks the audio path, the block you have selected and the scene you are in.
 * A tile within 10 (CIEDE2000) of it, in either theme, on either end, hides
 * the very ring that says which one is selected. Fractal's gate and PEQ are
 * amber on every generation, so those few are taken a step lighter or a step
 * yellower — the AM4's PEQ a step towards red, which keeps the white letters
 * the unit gives it and still clears the amber — and a few browns a shade off the
 * browser's darker Light-page amber. Each says so where it sits.
 *
 * WHAT THE LIFT COSTS. Lifted into a window that narrow, two pedals Fractal
 * tells apart only by how dark they are can end up close: gen-3's Graphic EQ,
 * Multitap and Mixer are all a mid blue at nearly one lightness here, and the
 * AM4's Chorus (darkened for its white letters) sits 7.5 from its Tremolo
 * (lifted to be seen). Moving the lighter one of each pair up means black
 * letters where the unit draws white, or a new pair as close as the old, so
 * they are left as they are and named in a test that lets no other pair join
 * them.
 *
 * Keys are block FAMILIES — the slug ForgeFX reports, with the other
 * spellings in ALIASES. The letters are never stored here: lib/ink picks
 * them from the colour drawn.
 */

/**
 * A block the app cannot name. It used to be the CSS variable `--panel-hi`,
 * which React Native cannot draw: on the phone an unknown block had no fill
 * at all, and RN's black border and letters on the dark stage. A real colour
 * now: a quiet blue-grey, at least 5 from every effect's colour on every
 * unit, so it is not mistaken for an amp or a wah.
 *
 * Not apart from the plumbing, though. Fractal gives Return a blue-grey too
 * (#394048 in the editors), and lifted for the stage that sits 2.7 from this;
 * the utility greys — shunt, Scene MIDI — are 6. An unknown block and a Return look alike
 * and are told apart by the name on the tile, which is how anybody tells two
 * of the greys apart on the unit itself.
 */
export const NEUTRAL = Object.freeze({ fill: '#5b616b', ink: '#ffffff' })

/**
 * Fractal's own Red: the fill of FM3-Edit's footswitch/led-ring-red.svg, and
 * the colour every Scene switch on an FM3, FM9 or Axe-Fx III (and FC-6/FC-12)
 * lights by default (Footswitch Functions Guide, p7). The AM4 and VP4 light
 * all four bars red in Scene mode.
 */
export const SCENE_RED = '#cc0000'

/**
 * The signal amber: the dark page's, the phone's Light page, and the
 * browser's Light page, which is darker still (styles.css says why: it is
 * used as text on the cream there). No scene colour, and no swatch a scene or
 * a preset is offered, sits within 10 of any of the three; nor does any colour
 * a look gives an effect, but one — gen-2's gate, which says why where it
 * sits.
 */
export const AMBERS = Object.freeze(['#f0a73c', '#a8650a', '#9c5f12'])

/** Every family the palettes paint, by the one name each is filed under. */
export const FAMILIES = Object.freeze([
  'drive', 'amp', 'delay', 'reverb', 'comp', 'chorus', 'flanger', 'phaser', 'wah', 'filter', 'cab', 'geq', 'peq',
  'tremolo', 'rotary', 'pitch', 'synth', 'multitap', 'megatap', 'plex', 'gate', 'volpan', 'mixer', 'looper',
  'enhancer', 'input', 'output', 'ringmod', 'formant', 'multicomp', 'crossover', 'tentap', 'resonator', 'send',
  'return', 'multiplexer', 'shunt', 'irplayer', 'vocoder', 'tonematch', 'rta', 'nam', 'dynadist', 'scenemidi',
  'controllers', 'fxloop'
])

/**
 * WAITING FOR FORGEFX. These have their own pictures in Fractal's editors and
 * their own colours here, but the ForgeFX the computer runs does not name them
 * yet: on an FM3, FM9 or Axe-Fx III any of them arrives with an empty slug and
 * is drawn NEUTRAL. They sit in the tables so the day ForgeFX learns them they
 * are already right — and until then nothing anybody reads may claim them.
 * Teaching ForgeFX is a change to its pin, which makes a computer release.
 */
export const DORMANT = Object.freeze(['irplayer', 'vocoder', 'tonematch', 'rta', 'nam', 'dynadist', 'scenemidi', 'controllers', 'fxloop'])

/**
 * The other names a family arrives under.
 *
 * The first five are the app's own older spellings. The rest are what
 * ForgeFX's names become once lib/blockColors squeezes them: gen-2 blocks are
 * their editor names lowercased ("Tremolo/Panner 1" is tremolopanner), and
 * display names come with spaces and slashes. "Input Noise Gate" is the
 * Axe-Fx II's Input block, not a gate.
 */
export const ALIASES = Object.freeze({
  compressor: 'comp',
  plexdelay: 'plex',
  volume: 'volpan',
  eq: 'geq',
  ingate: 'gate',
  quadchorus: 'chorus',
  multidelay: 'multitap',
  multitapdelay: 'multitap',
  megatapdelay: 'megatap',
  tentapdelay: 'tentap',
  dynamicdistortion: 'dynadist',
  namplayer: 'nam',
  gateexpander: 'gate',
  inputnoisegate: 'input',
  pantremolo: 'tremolo',
  tremolopanner: 'tremolo',
  rotaryspeaker: 'rotary',
  graphiceq: 'geq',
  parametriceq: 'peq',
  volumepan: 'volpan',
  ringmodulator: 'ringmod',
  multibandcompressor: 'multicomp',
  multibandcomp: 'multicomp',
  feedbacksend: 'send',
  feedbackreturn: 'return'
})

/**
 * MATCH MY UNIT, one table per kind of unit.
 *
 * The Axe-Fx II's own Quad Chorus has a picture of its own in Axe-Edit II, so
 * that one table carries it; everywhere else Quad Chorus is a chorus.
 */
export const PALETTES = Object.freeze({
  gen3: Object.freeze({
    drive: '#bf2f23', // the editors' picture #771a12, lifted
    amp: '#876042', // the unit's own screen (manual p49) #492401, lifted, and a shade off the browser's Light-page amber
    delay: '#2266b6', // the editors' picture #14457e, lifted
    reverb: '#8349bc', // the editors' picture #562e7e, lifted
    comp: '#776a00', // the editors' picture #776a00
    chorus: '#257ea0', // the editors' picture #2784a8, lifted
    flanger: '#974d7a', // the editors' picture #6a3455, lifted
    phaser: '#23751d', // the editors' picture #185814, lifted
    wah: '#666666', // the editors' picture #494949, lifted
    filter: '#9f6278', // the editors' picture #8b5569, lifted
    cab: '#0e7365', // the unit's own screen (manual p49) #03332c, lifted
    geq: '#6d6dab', // the editors' picture #464385, lifted
    peq: '#d3732a', // the editors' #9e5b1f, made lighter: kept clear of the app's amber
    tremolo: '#306e79', // the editors' picture #1e4b53, lifted
    rotary: '#73644e', // the editors' picture #483a26, lifted
    pitch: '#846d38', // the editors' picture #846d38
    synth: '#437136', // the editors' picture #39612d, lifted
    multitap: '#57629b', // the editors' picture, its body #1f2549 (not the glow in the middle), lifted
    /* The editors' picture at its edge, #2b403b (not the olive glow in the
       middle), lifted. Fractal's flat block inventory draws Megatap a darker
       blue-teal, #0b212e — but lifted for the stage that is Looper's colour,
       5.8 from it, so this keeps the edge's greener teal, about 40° round
       from Fractal's own. */
    megatap: '#4b6c64',
    plex: '#0091aa', // the editors' picture #0091aa
    gate: '#a47d4d', // the editors' #744a00, made lighter: at its own depth it was the app's amber on the Light page
    volpan: '#777460', // the editors' picture #5a5748, lifted
    mixer: '#5e6f8c', // the editors' picture #5e6f8c
    looper: '#3d6c7e', // the editors' picture #294c59, lifted
    enhancer: '#7d7eb4', // the editors' picture #6c6caa, lifted
    input: '#000066', // the unit's own screen #000066, as it is: the ends are drawn as an outline
    output: '#003300', // the unit's own screen #003300, as it is: the ends are drawn as an outline
    ringmod: '#895673', // the editors' picture #583549, lifted
    formant: '#8e5657', // the editors' picture #734545, lifted
    multicomp: '#ad4246', // the editors' picture #561d1f, lifted
    crossover: '#62898d', // the editors' picture #62898d
    tentap: '#a73e7f', // the editors' picture #7b2c5d, lifted
    resonator: '#7b5a85', // the editors' picture #674b70, lifted
    send: '#7c5e5e', // the editors' picture #493636, lifted
    return: '#5f676f', // the editors' picture #394048, lifted
    multiplexer: '#5c695b', // the editors' picture #5b685a, lifted
    shunt: '#666666', // the editors' picture #282828, lifted
    irplayer: '#61745a', // the editors' picture #61745a
    vocoder: '#07827b', // the editors' picture #055752, lifted
    tonematch: '#2b7254', // the editors' picture #1d513b, lifted
    rta: '#416897', // the editors' picture #3e6391, lifted
    nam: '#7742e0', // Axe-Edit III's picture, its body #3c197a (not the glow in the middle), lifted
    dynadist: '#95553b', // Axe-Edit III's picture #6f3219, lifted
    scenemidi: '#666666', // the editors' picture #535353, lifted
    controllers: '#666666', // the editors' picture #535353, lifted
    fxloop: '#696181' // no gen-3 block; the gen-2 editors' picture #3b364a, lifted
  }),
  am4: Object.freeze({
    drive: '#ce0201', // the AM4 manual's picture, the bright end of its tile
    /* Silver off the AM4, taken a few shades deeper: at #b9bec6 an amp that
       was ON read as switched off next to the pale off tiles on Play. */
    amp: '#7d8591',
    delay: '#1451ff', // the AM4 manual's picture, the bright end of its tile
    reverb: '#8520ff', // the AM4 manual's picture, the bright end of its tile
    comp: '#867502', // the unit's #a59100, darkened just enough to carry white letters, as the unit does
    chorus: '#037ea8', // the unit's #0092c2, darkened just enough to carry white letters, as the unit does
    flanger: '#a93a87', // the AM4 manual's picture, the bright end of its tile
    phaser: '#018901', // the unit's #009e00, darkened just enough to carry white letters, as the unit does
    wah: '#506691', // the AM4 manual's picture, the bright end of its tile
    filter: '#a8416b', // the AM4 manual's picture, the bright end of its tile
    cab: '#0e7365', // not on this unit; borrowed from gen-3
    geq: '#5c4aec', // the AM4 manual's picture, the bright end of its tile
    /* The unit's #b96d00 takes white letters like every tile on the AM4's
       screen, but darkened at its own hue for them it lands on the app's
       Light-page amber (0.7 from it). So it is darkened a step towards red
       instead, about 17°: white letters at 5:1, and 10 clear of all three
       ambers. */
    peq: '#b7510b',
    tremolo: '#056f89', // the unit's, kept a step darker than Chorus, as the unit draws it
    rotary: '#825f3f', // the AM4 manual's picture #865d35, a shade off the browser's Light-page amber
    pitch: '#8e843a', // not on an AM4; the VP4 manual's picture, the bright end of its tile
    synth: '#167542', // not on an AM4; the VP4 manual's picture, the bright end of its tile
    multitap: '#03717c', // not on an AM4; the VP4 manual's picture, the bright end of its tile
    megatap: '#566d3b', // not on an AM4; the VP4 manual's picture, the bright end of its tile
    plex: '#0070b0', // not on an AM4; the VP4 manual's picture, the bright end of its tile
    gate: '#806202', // the unit's, kept a step darker than Comp, as the unit draws it
    volpan: '#706f5f', // the AM4 manual's picture, the bright end of its tile
    mixer: '#5e6f8c', // not on this unit; borrowed from gen-3
    looper: '#3d6c7e', // not on this unit; borrowed from gen-3
    enhancer: '#646194', // the AM4 manual's picture, the bright end of its tile
    input: '#000066', // not on this unit; the gen-3 ends, drawn as an outline
    output: '#003300', // not on this unit; the gen-3 ends, drawn as an outline
    ringmod: '#6b7b4f', // not on an AM4; the VP4 manual's picture, the bright end of its tile
    formant: '#a26451', // not on an AM4; the VP4 manual's picture, the bright end of its tile
    multicomp: '#ad4246', // not on this unit; borrowed from gen-3
    crossover: '#62898d', // not on this unit; borrowed from gen-3
    tentap: '#a73e7f', // not on this unit; borrowed from gen-3
    resonator: '#894e9d', // not on an AM4; the VP4 manual's picture, the bright end of its tile
    send: '#7c5e5e', // not on this unit; borrowed from gen-3
    return: '#5f676f', // not on this unit; borrowed from gen-3
    multiplexer: '#5c695b', // not on this unit; borrowed from gen-3
    shunt: '#666666', // not on this unit; borrowed from gen-3
    irplayer: '#61745a', // not on this unit; borrowed from gen-3
    vocoder: '#07827b', // not on this unit; borrowed from gen-3
    tonematch: '#2b7254', // not on this unit; borrowed from gen-3
    rta: '#416897', // not on this unit; borrowed from gen-3
    nam: '#7742e0', // not on this unit; the gen-3 colour (waits for ForgeFX)
    dynadist: '#95553b', // not on this unit; borrowed from gen-3
    scenemidi: '#666666', // not on this unit; borrowed from gen-3
    controllers: '#666666', // not on this unit; borrowed from gen-3
    fxloop: '#696181' // not on this unit; borrowed from gen-3
  }),
  vp4: Object.freeze({
    drive: '#ce0201', // the same tile as the AM4's
    /* Silver off the AM4, taken a few shades deeper: at #b9bec6 an amp that
       was ON read as switched off next to the pale off tiles on Play. */
    amp: '#7d8591',
    delay: '#1451ff', // the same tile as the AM4's
    reverb: '#8520ff', // the same tile as the AM4's
    comp: '#867502', // the unit's #a59100, darkened just enough to carry white letters, as the unit does
    chorus: '#037ea8', // the unit's #0092c2, darkened just enough to carry white letters, as the unit does
    flanger: '#a93a87', // the same tile as the AM4's
    phaser: '#018901', // the unit's #009e00, darkened just enough to carry white letters, as the unit does
    wah: '#646575', // the VP4 manual's picture, the bright end of its tile
    filter: '#a8416b', // the same tile as the AM4's
    cab: '#0e7365', // not on this unit; borrowed from gen-3
    geq: '#5c4aec', // the same tile as the AM4's
    peq: '#b7510b', // the same tile as the AM4's, a step towards red for its white letters
    tremolo: '#056f89', // the unit's, kept a step darker than Chorus, as the unit draws it
    rotary: '#825f3f', // the same tile as the AM4's
    pitch: '#8e843a', // the VP4 manual's picture, the bright end of its tile
    synth: '#167542', // the VP4 manual's picture, the bright end of its tile
    multitap: '#03717c', // the VP4 manual's picture, the bright end of its tile
    megatap: '#566d3b', // the VP4 manual's picture, the bright end of its tile
    plex: '#0070b0', // the VP4 manual's picture, the bright end of its tile
    gate: '#806202', // the unit's, kept a step darker than Comp, as the unit draws it
    volpan: '#706f5f', // the same tile as the AM4's
    mixer: '#5e6f8c', // not on this unit; borrowed from gen-3
    looper: '#3d6c7e', // not on this unit; borrowed from gen-3
    enhancer: '#646194', // the same tile as the AM4's
    input: '#000066', // not on this unit; the gen-3 ends, drawn as an outline
    output: '#003300', // not on this unit; the gen-3 ends, drawn as an outline
    ringmod: '#6b7b4f', // the VP4 manual's picture, the bright end of its tile
    formant: '#a26451', // the VP4 manual's picture, the bright end of its tile, a step lighter to stay apart from its neighbour
    multicomp: '#ad4246', // not on this unit; borrowed from gen-3
    crossover: '#62898d', // not on this unit; borrowed from gen-3
    tentap: '#a73e7f', // not on this unit; borrowed from gen-3
    resonator: '#894e9d', // the VP4 manual's picture, the bright end of its tile
    send: '#7c5e5e', // not on this unit; borrowed from gen-3
    return: '#5f676f', // not on this unit; borrowed from gen-3
    multiplexer: '#5c695b', // not on this unit; borrowed from gen-3
    shunt: '#666666', // not on this unit; borrowed from gen-3
    irplayer: '#61745a', // not on this unit; borrowed from gen-3
    vocoder: '#07827b', // not on this unit; borrowed from gen-3
    tonematch: '#2b7254', // not on this unit; borrowed from gen-3
    rta: '#416897', // not on this unit; borrowed from gen-3
    nam: '#7742e0', // not on this unit; the gen-3 colour (waits for ForgeFX)
    dynadist: '#95553b', // not on this unit; borrowed from gen-3
    scenemidi: '#666666', // not on this unit; borrowed from gen-3
    controllers: '#666666', // not on this unit; borrowed from gen-3
    fxloop: '#696181' // not on this unit; borrowed from gen-3
  }),
  gen2: Object.freeze({
    drive: '#bf2f23', // the gen-2 editors' picture #771a12, lifted
    amp: '#806c4a', // the gen-2 editors' picture #6a593c, lifted
    delay: '#0063cb', // the gen-2 editors' picture #003777, lifted
    reverb: '#7d4bc1', // the gen-2 editors' picture #5c3690, lifted
    comp: '#776a00', // the gen-2 editors' picture #776a00
    chorus: '#257ea0', // the gen-2 editors' picture #2784a8, lifted
    flanger: '#b05198', // the gen-2 editors' picture #6e305e, lifted
    phaser: '#23751e', // the gen-2 editors' picture #195915, lifted
    wah: '#636765', // the gen-2 editors' picture #525654, lifted
    filter: '#ab5d7c', // the gen-2 editors' picture #af5f7f, lifted
    cab: '#4b6c6c', // the gen-2 editors' picture #1e2e2e, lifted
    geq: '#676091', // the gen-2 editors' picture #363152, lifted
    peq: '#d3732a', // the gen-2 editors' #9e5c20, made lighter like gen-3's: kept clear of the app's amber
    tremolo: '#367b87', // the gen-2 editors' picture #1e4b53, lifted
    rotary: '#73644e', // the gen-2 editors' picture #483a26, lifted
    pitch: '#7f7550', // the gen-2 editors' picture #807651, lifted
    synth: '#427136', // the gen-2 editors' picture #39622e, lifted
    multitap: '#536497', // the gen-2 editors' picture #1a2444, lifted
    megatap: '#496e59', // the gen-2 editors' picture #203429, lifted
    plex: '#0091aa', // not a gen-2 block; borrowed from gen-3
    /* The gen-2 editors' #774d00, a step towards yellow: at its own depth it
       was the app's amber. It still sits 9.3 from the browser's darker
       Light-page amber, the one fill that does: clear of that too, it would
       be a mustard 6 further from Fractal's gate, and no further from Comp. */
    gate: '#826003',
    volpan: '#696656', // the gen-2 editors' picture #4f4d40, lifted
    mixer: '#7084a5', // the gen-2 editors' picture #6c80a2, lifted
    looper: '#246f79', // the gen-2 editors' picture #0c3439, lifted
    enhancer: '#767099', // the gen-2 editors' picture #7b769d, lifted
    input: '#2b2a2b', // the gen-2 editors' picture #2b2a2b, as it is: drawn as an outline
    output: '#312f31', // the gen-2 editors' picture #312f31, as it is: drawn as an outline
    ringmod: '#8c5474', // the gen-2 editors' picture #4a2a3c, lifted
    formant: '#8b5858', // the gen-2 editors' picture #5c3939, lifted
    multicomp: '#ad4245', // the gen-2 editors' picture #571d1f, lifted
    crossover: '#79958c', // the gen-2 editors' picture #79958c
    tentap: '#a73e7f', // not a gen-2 block; borrowed from gen-3
    resonator: '#81618e', // the gen-2 editors' picture #694e74, lifted
    send: '#7e5e5e', // the gen-2 editors' picture #4a3636, lifted
    return: '#5f6670', // the gen-2 editors' picture #394049, lifted
    multiplexer: '#5c695b', // not a gen-2 block; borrowed from gen-3
    shunt: '#666666', // not a gen-2 block; borrowed from gen-3
    irplayer: '#61745a', // not a gen-2 block; borrowed from gen-3
    vocoder: '#03726c', // the gen-2 editors' picture #005853, lifted
    tonematch: '#147607', // the gen-2 editors' picture #063e02, lifted
    rta: '#416897', // not a gen-2 block; borrowed from gen-3
    nam: '#7742e0', // not a gen-2 block; the gen-3 colour (waits for ForgeFX)
    dynadist: '#95553b', // not a gen-2 block; borrowed from gen-3
    scenemidi: '#666666', // not a gen-2 block; borrowed from gen-3
    controllers: '#676567', // the gen-2 editors' picture #1f1e1f, lifted
    fxloop: '#696181', // the gen-2 editors' picture #3b364a, lifted
    quadchorus: '#016ba6' // Axe-Edit II's own Quad Chorus picture #004b77, lifted
  })
})

/** The kinds, in the order the tables are written. */
export const PALETTE_IDS = Object.freeze(Object.keys(PALETTES))

/**
 * Which table a unit wears, by the slug setlists and stars file it under
 * (shared/device-slug). An unknown unit, and 'device' — a unit that answered
 * without naming itself — get gen-3's, the family most units are.
 *
 * The AX8 and FX8 rows are here for completeness: ForgeFX cannot drive them
 * yet, so nothing reaches the app from one today.
 */
const BY_SLUG = {
  fm3: 'gen3',
  fm9: 'gen3',
  axefxiii: 'gen3',
  axefx3: 'gen3',
  device: 'gen3',
  am4: 'am4',
  vp4: 'vp4',
  axefxii: 'gen2',
  iixl: 'gen2',
  ax8: 'gen2',
  fx8: 'gen2',
  fx8ii: 'gen2'
}

export const paletteFor = (deviceSlug) => BY_SLUG[String(deviceSlug || '').toLowerCase()] || 'gen3'

/* ------------------------------------------------------------------ */
/* Fractal Remote: the app's colours as they have always been           */
/* ------------------------------------------------------------------ */

/*
 * "OK, make sure you preserve the current colors and make a theme on that one
 * called fractal remote. I just don't wanna lose all the colors and current
 * color scheme cause I like those also."
 *
 * So the tables below are what lib/blockColors held up to 1.87.38, moved here
 * unchanged, letters and all — including the two that miss 4.5:1, which is
 * why this look is the one the readability tests leave alone and a test pins
 * to these exact values instead. Only an unknown block differs, because the
 * old answer for one was the CSS variable the phone could not draw.
 *
 * What the old file said about them, kept with them:
 *
 * The point is recognition on a dark stage: on the AM4's own screen the drive
 * is red and the delay is blue, and a screen pretending to be that hardware
 * should agree with it.
 *
 * Two grades of confidence live here, deliberately. drive, amp, delay and
 * reverb are read straight off an AM4's display. Everything else carries the
 * hue this app has always used for that family — continuity for families the
 * photo doesn't show — and is meant to be tuned by holding the app next to the
 * unit, not defended.
 */
const VERIFIED = {
  drive: { fill: '#c23b26', ink: '#ffffff' },
  /* Silver off the AM4, taken a few shades deeper: at #b9bec6 an amp that
     was ON read as switched off next to the pale off tiles on Play. */
  amp: { fill: '#7d8591', ink: '#ffffff' },
  delay: { fill: '#2857c9', ink: '#ffffff' },
  reverb: { fill: '#5a3fc0', ink: '#ffffff' }
}

/*
 * Read off an FM3-Edit screenshot of a full chain. Note the one conflict found:
 * FM3-Edit draws the amp tile dark graphite where the AM4's screen draws it
 * silver — the generations genuinely differ. Silver wins here because the AM4
 * is the unit on the board and its photo is device truth; if a per-device
 * palette is ever wanted, this is the entry that motivates it.
 */
const VERIFIED_FM3EDIT = {
  comp: { fill: '#8f8a2f', ink: '#ffffff' },
  compressor: { fill: '#8f8a2f', ink: '#ffffff' },
  chorus: { fill: '#2f8f9c', ink: '#ffffff' },
  flanger: { fill: '#a2439a', ink: '#ffffff' },
  phaser: { fill: '#3f8a4f', ink: '#ffffff' }
}

const APPROXIMATE = {
  wah: { fill: '#3f63c8', ink: '#ffffff' },
  filter: { fill: '#3f63c8', ink: '#ffffff' },
  cab: { fill: '#3f8f5c', ink: '#ffffff' },
  geq: { fill: '#c07a2a', ink: '#ffffff' },
  peq: { fill: '#c07a2a', ink: '#ffffff' },
  eq: { fill: '#c07a2a', ink: '#ffffff' },
  tremolo: { fill: '#8a5fb0', ink: '#ffffff' },
  rotary: { fill: '#8a5fb0', ink: '#ffffff' },
  pitch: { fill: '#a04f8a', ink: '#ffffff' },
  synth: { fill: '#a04f8a', ink: '#ffffff' },
  multitap: { fill: '#2a7f9c', ink: '#ffffff' },
  megatap: { fill: '#2a7f9c', ink: '#ffffff' },
  plex: { fill: '#2a7f9c', ink: '#ffffff' },
  plexdelay: { fill: '#2a7f9c', ink: '#ffffff' },
  gate: { fill: '#6f7480', ink: '#ffffff' },
  ingate: { fill: '#6f7480', ink: '#ffffff' },
  volume: { fill: '#6f7480', ink: '#ffffff' },
  volpan: { fill: '#6f7480', ink: '#ffffff' },
  mixer: { fill: '#6f7480', ink: '#ffffff' },
  looper: { fill: '#6f7480', ink: '#ffffff' },
  enhancer: { fill: '#4a8f7a', ink: '#ffffff' },
  input: { fill: '#555b66', ink: '#ffffff' },
  output: { fill: '#555b66', ink: '#ffffff' },

  /*
   * Families learned from Axis's category map — its coverage, not its colours.
   * Axis paints by its own design language (an orange amp, one hue for all of
   * time), which is a choice for their app and the wrong one for this one: the
   * brief here is to agree with the unit's screen. So these take the hue of the
   * family Axis groups them with, in our palette.
   */
  ringmod: { fill: '#4a5fb8', ink: '#ffffff' },
  formant: { fill: '#4a5fb8', ink: '#ffffff' },
  multicomp: { fill: '#2f8f8f', ink: '#ffffff' },
  crossover: { fill: '#2f8f8f', ink: '#ffffff' },
  tentap: { fill: '#2a7f9c', ink: '#ffffff' },
  resonator: { fill: '#2a7f9c', ink: '#ffffff' },
  send: { fill: '#555b66', ink: '#ffffff' },
  return: { fill: '#555b66', ink: '#ffffff' },
  multiplexer: { fill: '#555b66', ink: '#ffffff' },
  shunt: { fill: '#555b66', ink: '#ffffff' }
}

/** Every family the app knew before these colours, fill and letters as they were. */
export const FRACTAL_REMOTE = Object.freeze({ ...APPROXIMATE, ...VERIFIED_FM3EDIT, ...VERIFIED })

/*
 * And its scenes, which the old lib/sceneColors explained:
 *
 * Eight hues, evenly spread and deliberately muted to sit beside the block
 * palette rather than shout over it. None of them is the amber --signal: that
 * colour means the audio path in this app and a scene tile is not allowed to
 * borrow it.
 */
const FRACTAL_REMOTE_SCENES = Object.freeze([
  '#b5502f', // 1 terracotta
  '#8f6a24', // 2 ochre
  '#4f7a35', // 3 moss
  '#2f7a6b', // 4 teal
  '#2f5f9c', // 5 blue
  '#56409c', // 6 violet
  '#94357a', // 7 magenta
  '#5d626b' // 8 slate
])

/* ------------------------------------------------------------------ */
/* The other looks                                                       */
/* ------------------------------------------------------------------ */

/** One colour for every family. */
const every = (fill) => Object.freeze(Object.fromEntries(FAMILIES.map((f) => [f, fill])))

/*
 * Each of these was built and checked by a script, not picked by eye. Four
 * colours moved after that, because they sat too close to the amber: the
 * colour-blind look's gate (it was 3.6 from it), Sunlight's looper, and
 * Stompbox's phaser and rotary. Each moved as little as it could while staying
 * as far from its neighbours as before. And three more by a shade (1 to 2.3)
 * once the browser's darker Light-page amber was checked as well: the
 * colour-blind look's drive, Stompbox's cab, and its rotary again.
 */
const COLOUR_BLIND = Object.freeze({
  drive: '#b84e02',
  amp: '#d5dae4',
  delay: '#8e8dfc',
  reverb: '#a25380',
  comp: '#fed394',
  chorus: '#307594',
  flanger: '#b04d60',
  phaser: '#75cf86',
  wah: '#6560ca',
  filter: '#81c4e6',
  cab: '#aa9a44',
  geq: '#696e77',
  peq: '#a69c01',
  tremolo: '#0273b3',
  rotary: '#dedf7c',
  pitch: '#b14978',
  synth: '#dedf7c',
  multitap: '#88ecd9',
  megatap: '#88ecd9',
  plex: '#88ecd9',
  gate: '#f8c42b',
  volpan: '#cdbc67',
  mixer: '#b7bcc5',
  looper: '#7e6d0b',
  enhancer: '#fea2ae',
  input: '#b7bcc5',
  output: '#b7bcc5',
  ringmod: '#ecdb85',
  formant: '#777004',
  multicomp: '#fed394',
  crossover: '#b7bcc5',
  tentap: '#88ecd9',
  resonator: '#d4d7fe',
  send: '#b7bcc5',
  return: '#b7bcc5',
  multiplexer: '#b7bcc5',
  shunt: '#b7bcc5',
  irplayer: '#aa9a44',
  vocoder: '#dedf7c',
  tonematch: '#b7bcc5',
  rta: '#b7bcc5',
  nam: '#d5dae4',
  dynadist: '#b84e02',
  scenemidi: '#b7bcc5',
  controllers: '#b7bcc5',
  fxloop: '#b7bcc5'
})

const SUNLIGHT = Object.freeze({
  drive: '#fe362e',
  amp: '#cbcfd5',
  delay: '#80c1ff',
  reverb: '#a067fa',
  comp: '#ccbf0c',
  chorus: '#308bd7',
  flanger: '#db5989',
  phaser: '#9de303',
  wah: '#fec296',
  filter: '#03cdf2',
  cab: '#a88108',
  geq: '#9ea2a8',
  peq: '#ff9f5a',
  tremolo: '#4fa7f6',
  rotary: '#e1d201',
  pitch: '#938906',
  synth: '#3b82fe',
  multitap: '#059879',
  megatap: '#059879',
  plex: '#059879',
  gate: '#ffc72a',
  volpan: '#f1c980',
  mixer: '#b8bcc2',
  looper: '#bf9852',
  enhancer: '#079c2d',
  input: '#b8bcc2',
  output: '#b8bcc2',
  ringmod: '#f58403',
  formant: '#83878c',
  multicomp: '#ccbf0c',
  crossover: '#b8bcc2',
  tentap: '#059879',
  resonator: '#a68038',
  send: '#b8bcc2',
  return: '#b8bcc2',
  multiplexer: '#b8bcc2',
  shunt: '#b8bcc2',
  irplayer: '#a88108',
  vocoder: '#3b82fe',
  tonematch: '#b8bcc2',
  rta: '#b8bcc2',
  nam: '#cbcfd5',
  dynadist: '#fe362e',
  scenemidi: '#b8bcc2',
  controllers: '#b8bcc2',
  fxloop: '#b8bcc2'
})

const STOMPBOX = Object.freeze({
  drive: '#83bf66',
  amp: '#a9adb4',
  delay: '#d5cab8',
  reverb: '#6f6d70',
  comp: '#0275ba',
  chorus: '#28a5c1',
  flanger: '#ab559b',
  phaser: '#ea8419',
  wah: '#c0c4ca',
  filter: '#55ba64',
  cab: '#8f6548',
  geq: '#aca49e',
  peq: '#aca49e',
  tremolo: '#0c8185',
  rotary: '#836141',
  pitch: '#097da3',
  synth: '#097da3',
  multitap: '#c9364b',
  megatap: '#c9364b',
  plex: '#c9364b',
  gate: '#d6d5db',
  volpan: '#9c8f7a',
  mixer: '#686e79',
  looper: '#c4c7cc',
  enhancer: '#76aad2',
  input: '#686e79',
  output: '#686e79',
  ringmod: '#94624a',
  formant: '#55ba64',
  multicomp: '#0275ba',
  crossover: '#686e79',
  tentap: '#c9364b',
  resonator: '#6f6d70',
  send: '#686e79',
  return: '#686e79',
  multiplexer: '#686e79',
  shunt: '#686e79',
  irplayer: '#8f6548',
  vocoder: '#097da3',
  tonematch: '#686e79',
  rta: '#686e79',
  nam: '#a9adb4',
  dynadist: '#83bf66',
  scenemidi: '#686e79',
  controllers: '#686e79',
  fxloop: '#686e79'
})

const red = Object.freeze(Array(8).fill(SCENE_RED))

/**
 * The looks, in the order the Colours page offers them.
 *
 * `families` is the look's own colour for each family; `byUnit`, where a look
 * has it, is the colour for the unit you are on, and wins. `scenes` is the
 * eight scene colours. No brand names anywhere, in a name or in a why: these
 * go in front of the App Store's reviewers too.
 */
export const LOOKS = Object.freeze([
  {
    id: 'unit',
    name: 'Match my unit',
    why: 'Each effect in the colour your unit gives it, a little brighter where a dark one would be lost on a dark stage. Every scene is red, like the scene switches.',
    families: PALETTES.gen3,
    byUnit: PALETTES,
    scenes: red
  },
  {
    id: 'fractalremote',
    name: 'Fractal Remote',
    why: 'The app’s own colours, as they have always been.',
    families: Object.freeze(Object.fromEntries(Object.entries(FRACTAL_REMOTE).map(([k, v]) => [k, v.fill]))),
    scenes: FRACTAL_REMOTE_SCENES
  },
  {
    /* The FC system's defaults: every Effect switch Cyan (led-ring-cyan.svg),
       every Scene switch Red. The AM4 and VP4 light Effects mode blue. */
    id: 'rings',
    name: 'Footswitch lights',
    why: 'What your feet see: every effect switch lights the same colour and every scene switch red. Effects are told apart by their names.',
    families: every('#00ccff'),
    byUnit: Object.freeze({ gen3: every('#00ccff'), gen2: every('#00ccff'), am4: every('#0098ff'), vp4: every('#0098ff') }),
    scenes: red
  },
  {
    /* From the Okabe-Ito and Paul Tol colour-blind palettes, light and dark.
       Neighbouring effects in a chain stay at least 8 apart in all three
       colour-blind simulations (the old colours came to 2).

       Scenes side by side — one, two or four places apart, which is beside
       or above one another on Play — stay at least 30 apart in every one,
       and the first four, which are all an AM4 or a VP4 has, at least 23
       from each other. The eight are in this order for that: the orange was
       scene 1 and the olive scene 4, and to a red-green colour-blind eye
       those two are one colour (3.5 apart), which on a four-scene unit was a
       quarter of the colours he could see. Three places apart is not held:
       the orange and the olive are scenes 2 and 5 now, a diagonal step on
       Play. */
    id: 'cvd',
    name: 'Colour-blind safe',
    why: 'Chosen so effects side by side stay easy to tell apart with red-green or blue-yellow colour blindness. Each scene gets its own colour.',
    families: COLOUR_BLIND,
    scenes: Object.freeze(['#0273b3', '#b84e02', '#fed0ba', '#68c5fb', '#777004', '#eade39', '#8e8dfc', '#b04d60'])
  },
  {
    id: 'sunlight',
    name: 'Sunlight',
    why: 'Light, bright tiles with black letters, for outdoor gigs and bright stages.',
    families: SUNLIGHT,
    scenes: Object.freeze(['#ff5443', '#07a295', '#cdc5fe', '#e76e00', '#febbb0', '#997bfe', '#6d9f03', '#35e2d2'])
  },
  {
    /* Scene 3 is the one darker red the script picked, a step lighter here so
       an unlit one still has an edge on the dark stage. */
    id: 'stompbox',
    name: 'Stompbox',
    why: 'Each effect in the colour of the pedal everybody pictures for it: green overdrive, cyan chorus, purple flanger, orange phaser, cream delay.',
    families: STOMPBOX,
    scenes: Object.freeze(['#e4ce65', '#28a5c1', '#c42041', '#e8732c', '#ab579b', '#d5cab8', '#83bf66', '#0275ba'])
  }
])

export const DEFAULT_LOOK = 'unit'
/** The look drawn exactly as the app drew before there were looks — see Tile on the phone. */
export const FRACTAL_REMOTE_LOOK = 'fractalremote'

const BY_ID = Object.fromEntries(LOOKS.map((l) => [l.id, l]))
/** A look by its id, or Match my unit for anything else. */
export const lookById = (id) => BY_ID[id] || BY_ID[DEFAULT_LOOK]
export const isLookId = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(BY_ID, id)

/* ------------------------------------------------------------------ */
/* The swatches the colour sheet offers                                 */
/* ------------------------------------------------------------------ */

/*
 * Fractal's eleven footswitch ring colours, the fills of FM3-Edit's
 * footswitch/led-ring-*.svg — the colours a player already gives his own
 * switches. Only Purple moves, and not for its letters (#6633cc carries white
 * at 7.2:1): a lit purple tile stood only 2.5:1 off an unlit one.
 *
 * `scene: false` marks one a scene tile is never offered. Orange is 7.4 from
 * the amber, and the scene you are in is ringed in amber.
 */
export const RING_SWATCHES = Object.freeze([
  { name: 'Red', fill: '#cc0000' },
  { name: 'Orange', fill: '#ff9933', scene: false },
  { name: 'Yellow', fill: '#ffff00' },
  { name: 'Green', fill: '#66cc33' },
  { name: 'Blue', fill: '#0055ff' },
  { name: 'Cyan', fill: '#00ccff' },
  { name: 'Purple', fill: '#7345dd' },
  { name: 'White', fill: '#ffffff' },
  { name: 'Pink', fill: '#ff99cc' },
  { name: 'Teal', fill: '#009999' },
  { name: 'Lime', fill: '#ccff33' }
])

/*
 * And twelve of the units' own block colours, as this app draws them: the
 * AM4's, plus the brown amp of the FM3's own screen (its manual's figure of
 * the grid, not FM3-Edit, which draws the amp near black).
 */
export const UNIT_SWATCHES = Object.freeze([
  { name: 'Delay blue', fill: PALETTES.am4.delay },
  { name: 'Reverb violet', fill: PALETTES.am4.reverb },
  { name: 'Chorus blue', fill: PALETTES.am4.chorus },
  { name: 'Comp mustard', fill: PALETTES.am4.comp },
  { name: 'Phaser green', fill: PALETTES.am4.phaser },
  { name: 'Flanger plum', fill: PALETTES.am4.flanger },
  { name: 'Filter raspberry', fill: PALETTES.am4.filter },
  { name: 'EQ indigo', fill: PALETTES.am4.geq },
  { name: 'PEQ orange', fill: PALETTES.am4.peq },
  { name: 'Tremolo teal', fill: PALETTES.am4.tremolo },
  { name: 'Amp silver', fill: PALETTES.am4.amp },
  { name: 'Amp brown', fill: PALETTES.gen3.amp }
])

/** The twenty-three that never change. */
export const SWATCHES = Object.freeze([...RING_SWATCHES, ...UNIT_SWATCHES])

/**
 * The sheet's grid: the look's own colour for the thing being painted first,
 * then the twenty-three. Twenty-four in all for an effect; a scene is not
 * offered the amber-like ones.
 *
 * And never the same colour twice. Every scene in Match my unit is Fractal's
 * Red, which is also the first ring swatch, and an AM4's delay is the Delay
 * blue swatch: with both in the grid the sheet opened with two squares
 * ticked, which reads as two colours picked and is two checked buttons to a
 * screen reader. The look's own goes first and the twin is left out.
 */
export function swatchesFor(own, { scene = false } = {}) {
  const mine = String(own || '').toLowerCase()
  const rest = SWATCHES.filter((s) => !(scene && s.scene === false) && s.fill !== mine)
  return [{ name: 'Unit', fill: own, own: true }, ...rest]
}

/* ------------------------------------------------------------------ */
/* Which family a slug is                                               */
/* ------------------------------------------------------------------ */

const KNOWN = new Set([...FAMILIES, ...Object.keys(ALIASES), ...Object.keys(FRACTAL_REMOTE)])

/**
 * The family a block's slug belongs to, as { key, family } — `key` the name it
 * matched (a table may have its own colour for it, as the Axe-Fx II's Quad
 * Chorus does), `family` the one it is filed under. Null for a block nobody
 * here can name.
 *
 * Slugs sometimes carry an instance suffix — delay2, drive1. Display names
 * arrive with spaces, hyphens and slashes — "Plex Delay", "Ten-Tap",
 * "Vol/Pan" — a normalisation Axis's map taught us to expect; ForgeFX's gen-2
 * names are the same shape ("Tremolo/Panner 1").
 */
export function familyOf(slug) {
  if (!slug) return null
  const key = String(slug).toLowerCase()
  const bare = key.replace(/\d+$/, '')
  const squeezed = bare.replace(/[^a-z]/g, '')
  for (const k of [key, bare, squeezed]) {
    if (KNOWN.has(k)) return { key: k, family: ALIASES[k] || k }
  }
  return null
}
