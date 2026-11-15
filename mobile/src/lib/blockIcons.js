/*
 * The picture above a block's letters on Play, white in the file and tinted
 * to the tile — see components/Tile. Which picture a kind of block gets is
 * decided once, in lib/block-icons (shared/block-icons.mjs), for both ends.
 */
import amp from '../../assets/icons/amp.png'
import cab from '../../assets/icons/cab.png'
import comp from '../../assets/icons/comp.png'
import delay from '../../assets/icons/delay.png'
import drive from '../../assets/icons/drive.png'
import flanger from '../../assets/icons/flanger.png'
import phaser from '../../assets/icons/phaser.png'
import reverb from '../../assets/icons/reverb.png'
import wah from '../../assets/icons/wah.png'
import chorus from '../../assets/icons/chorus.png'
import enhancer from '../../assets/icons/enhancer.png'
import filter from '../../assets/icons/filter.png'
import formant from '../../assets/icons/formant.png'
import gate from '../../assets/icons/gate.png'
import geq from '../../assets/icons/geq.png'
import looper from '../../assets/icons/looper.png'
import mixer from '../../assets/icons/mixer.png'
import multiplexer from '../../assets/icons/multiplexer.png'
import peq from '../../assets/icons/peq.png'
import pitch from '../../assets/icons/pitch.png'
import resonator from '../../assets/icons/resonator.png'
import ringmod from '../../assets/icons/ringmod.png'
import rotary from '../../assets/icons/rotary.png'
import synth from '../../assets/icons/synth.png'
import tremolo from '../../assets/icons/tremolo.png'
import volpan from '../../assets/icons/volpan.png'
import sendfx from '../../assets/icons/sendfx.png'
import returnfx from '../../assets/icons/returnfx.png'
import nam from '../../assets/icons/nam.png'
import namRainbow from '../../assets/icons/nam-rainbow.png'
import { blockIconName } from './block-icons'

/* The files, by the name lib/block-icons (shared/block-icons.mjs) gives them. */
const FILES = { amp, cab, comp, delay, drive, flanger, phaser, reverb, wah, chorus, enhancer, filter, formant, gate, geq, looper, mixer, multiplexer, peq, pitch, resonator, ringmod, rotary, synth, tremolo, volpan, sendfx, returnfx, nam }

/*
 * THE PHONE'S OWN, for the blocks that only reach Play over Bluetooth
 * (lib/gen3Catalog OWN), each wearing the picture of the family it stands in
 * for, and no new picture: the IR Player plays cabinet responses and wears
 * the cab's. Here and not in shared/block-icons.mjs, which is inside the
 * computer app, whose blocks never come with these names: they stay a New
 * block there (shared/new-block.mjs).
 *
 * THE NAM BLOCK HAS ITS OWN SINCE 1.90.72 (it wore the amp's): "Make the NAM
 * block look similar to this. but with the same aesthetics that we use in
 * our app now. But like with the rainbow type color in that same type of
 * glyph" (Justin, 14 November 2026, with a picture of the block as his
 * editor draws it). A small neural network, drawn by scripts/nam-icon.mjs
 * (which says why it is ours and not theirs): white like every other
 * picture, and a second file in its own rainbow (`blockIconOwn`, below).
 *
 * And the four named on 13 November 2026, the same way: Dynamic Distortion
 * is a distortion and wears the drive's; a crossover is a pair of filters
 * that splits the lows from the highs, and wears the filter's; Tone Match
 * is an EQ curve matched to another sound, and wears the graphic EQ's; the
 * Vocoder shapes a sound with a voice, as the formant filter does with a
 * vowel, and wears the formant's.
 */
export const PHONE_ONLY = Object.freeze({ nam: 'nam', irplayer: 'cab', dynadist: 'drive', crossover: 'filter', tonematch: 'geq', vocoder: 'formant' })

/*
 * A PICTURE IN ITS OWN COLOURS, for the one block that has one: the NAM
 * block's rainbow. Every other picture is white and takes the tile's
 * colour; this one is drawn as it is, lit or not, and components/Tile goes
 * back to the white one wherever a picture is plainly tinted (grey when
 * off, the quiet outline). The browser keeps the same list for its end,
 * held equal to this one by a test (test/nam-icon.mjs).
 */
export const OWN_COLOURS = Object.freeze({ nam: namRainbow })

export function blockIcon(slug) {
  const name = blockIconName(slug) || PHONE_ONLY[String(slug || '').toLowerCase()] || null
  return name ? FILES[name] || null : null
}

/** The block's picture in its own colours, where it has one (the NAM block's rainbow); null for every other block. */
export function blockIconOwn(slug) {
  return OWN_COLOURS[String(slug || '').toLowerCase()] || null
}
