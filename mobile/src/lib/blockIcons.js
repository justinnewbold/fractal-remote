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
import { blockIconName } from './block-icons'

/* The files, by the name lib/block-icons (shared/block-icons.mjs) gives them. */
const FILES = { amp, cab, comp, delay, drive, flanger, phaser, reverb, wah, chorus, enhancer, filter, formant, gate, geq, looper, mixer, multiplexer, peq, pitch, resonator, ringmod, rotary, synth, tremolo, volpan, sendfx, returnfx }

/*
 * THE PHONE'S OWN TWO, for the Axe-Fx III's blocks that only reach Play over
 * Bluetooth (lib/gen3Catalog OWN), each wearing the picture of the family it
 * stands in for, and no new picture: the NAM block is an amp (a captured amp,
 * where an amp sits) and wears the amp's; the IR Player plays cabinet
 * responses and wears the cab's. Here and not in shared/block-icons.mjs,
 * which is inside the computer app, whose blocks never come with these
 * names: they stay a New block there (shared/new-block.mjs).
 */
export const PHONE_ONLY = Object.freeze({ nam: 'amp', irplayer: 'cab' })

export function blockIcon(slug) {
  const name = blockIconName(slug) || PHONE_ONLY[String(slug || '').toLowerCase()] || null
  return name ? FILES[name] || null : null
}
