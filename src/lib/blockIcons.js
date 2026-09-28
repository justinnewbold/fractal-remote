/**
 * The effect pictures for the browser's Play screen: the phone's own files,
 * picked by the one shared list (shared/block-icons.mjs) so a delay wears the
 * same picture at both ends. The phone's copy is mobile/src/lib/blockIcons.js.
 */
import { blockIconName } from '../../shared/block-icons.mjs'
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

const FILES = { amp, cab, comp, delay, drive, flanger, phaser, reverb, wah, chorus, enhancer, filter, formant, gate, geq, looper, mixer, multiplexer, peq, pitch, resonator, ringmod, rotary, synth, tremolo, volpan, sendfx, returnfx }

export function blockIcon(slug) {
  const name = blockIconName(slug)
  return name ? FILES[name] || null : null
}
