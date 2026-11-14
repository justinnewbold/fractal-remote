/**
 * The effect pictures for the browser's Play screen: the phone's own files,
 * picked by the one shared list (shared/block-icons.mjs) so a delay wears the
 * same picture at both ends. The phone's copy is mobile/src/lib/blockIcons.js.
 */
import { blockIconName } from '../../shared/block-icons.mjs'
import { OWN_COLOURS, OWN_ICON } from '../../shared/own-blocks.mjs'
import amp from '../../mobile/assets/icons/amp.png'
import cab from '../../mobile/assets/icons/cab.png'
import comp from '../../mobile/assets/icons/comp.png'
import delay from '../../mobile/assets/icons/delay.png'
import drive from '../../mobile/assets/icons/drive.png'
import flanger from '../../mobile/assets/icons/flanger.png'
import phaser from '../../mobile/assets/icons/phaser.png'
import reverb from '../../mobile/assets/icons/reverb.png'
import wah from '../../mobile/assets/icons/wah.png'
import chorus from '../../mobile/assets/icons/chorus.png'
import enhancer from '../../mobile/assets/icons/enhancer.png'
import filter from '../../mobile/assets/icons/filter.png'
import formant from '../../mobile/assets/icons/formant.png'
import gate from '../../mobile/assets/icons/gate.png'
import geq from '../../mobile/assets/icons/geq.png'
import looper from '../../mobile/assets/icons/looper.png'
import mixer from '../../mobile/assets/icons/mixer.png'
import multiplexer from '../../mobile/assets/icons/multiplexer.png'
import peq from '../../mobile/assets/icons/peq.png'
import pitch from '../../mobile/assets/icons/pitch.png'
import resonator from '../../mobile/assets/icons/resonator.png'
import ringmod from '../../mobile/assets/icons/ringmod.png'
import rotary from '../../mobile/assets/icons/rotary.png'
import synth from '../../mobile/assets/icons/synth.png'
import tremolo from '../../mobile/assets/icons/tremolo.png'
import volpan from '../../mobile/assets/icons/volpan.png'
import sendfx from '../../mobile/assets/icons/sendfx.png'
import returnfx from '../../mobile/assets/icons/returnfx.png'
import nam from '../../mobile/assets/icons/nam.png'
import namRainbow from '../../mobile/assets/icons/nam-rainbow.png'

const FILES = { amp, cab, comp, delay, drive, flanger, phaser, reverb, wah, chorus, enhancer, filter, formant, gate, geq, looper, mixer, multiplexer, peq, pitch, resonator, ringmod, rotary, synth, tremolo, volpan, sendfx, returnfx, nam }
/* The pictures drawn in their own colours, by the block's name (shared/own-blocks.mjs OWN_COLOURS says which blocks). */
const OWN_FILES = { nam: namRainbow }

export function blockIcon(slug) {
  /* And the blocks Play names for itself (shared/own-blocks.mjs), each in the picture it wears: the NAM block its own, the IR Player the cab's. */
  const name = blockIconName(slug) || OWN_ICON[String(slug || '').toLowerCase()] || null
  return name ? FILES[name] || null : null
}

/** The block's picture in its own colours, where it has one (the NAM block's rainbow); null for every other block. */
export function blockIconOwn(slug) {
  const key = String(slug || '').toLowerCase()
  return OWN_COLOURS.includes(key) ? OWN_FILES[key] || null : null
}

/**
 * What a tile's picture element wears: its class and its style. A white
 * picture is a mask over the tile's lettering colour, as always. One with
 * its own colours (`own`) is drawn as it is, and keeps the white one by, for
 * the one state every picture is plainly grey in (grey when off:
 * styles.css).
 */
export function pictureWears(icon, own) {
  return own
    ? { className: 'gig-block-icon gig-block-icon-own', style: { '--pic': `url(${icon})`, '--pic-own': `url(${own})` } }
    : { className: 'gig-block-icon', style: { WebkitMaskImage: `url(${icon})`, maskImage: `url(${icon})` } }
}
