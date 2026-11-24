/**
 * THE AM4'S NAM PLAYER BLOCK'S SETTINGS (firmware 3.00), WRITTEN BY HAND.
 *
 * "And go ahead and build it out for the computer and the raspberry pie and
 * do the knobs and edit" (Justin, 18 November 2026). The codec's catalog
 * (am4-knobs.js, generated, never hand-edited) has no NAM block, so its
 * settings are here, laid beside the catalog in am4-edit.js, as the Axe-Fx
 * III's are in axefx3-own-knobs.js.
 *
 * WHERE EACH CAME FROM: his recording of AM4-Edit with a NAM block's page
 * open (docs/am4-nam.md; the recording is not in the repository). AM4-Edit
 * read these settings of block 0xD1 one at a time (action 0x0D), and each
 * answer carries the value and the AM4's own words for it:
 *
 *    0  "0.0 dB" at 0.8 of its travel        Level, -80 to +20 dB
 *   11  "0.00 dB" at half                    Input Gain, -20 to +20 dB
 *   12  "NORMAL" (0)                         Phase Invert
 *   13  "POST" (1)                           Tone Stack Location
 *   14  "ACTIVE" (0)                         Tone Stack Type
 *   15, 16, 17  "5.00" at half               Bass, Mid, Treble, 0 to 10
 *   19  "0.00" at half                       Bright, -10 to +10
 *
 * THE NAMES AND THE RANGES ARE THE AXE-FX III'S NAM BLOCK'S, which his AX3
 * said itself (axefx3-own-knobs.js): the same settings in the same order,
 * and every value above reads as that block's would (Level 0.8 of -80 to
 * +20 is 0 dB, POST is 1, ACTIVE is the first tone stack). The AM4 does not
 * say a setting's NAME, and one point does not prove a range's two ends:
 * so the wire lays the AM4's own words beside what the app works out, in
 * the log, at every read (bleWire am4EachParams). READ THAT LINE FIRST.
 * The switches' other choices (INVERT, PRE, OFF, the eleven other tone
 * stacks) are the III's numbering, not seen on an AM4.
 *
 * LEFT OUT: 10, the capture (the captures' own pick, lib/am4-nam; it never
 * gets a row here, which would be a second way to write it); 3, the on and
 * off, which Play's switch does; 18 and 20, which AM4-Edit did not read
 * (the III has Input Mode and Bright Cap about there: not known on an AM4);
 * and 42, which read "8 Band" and is not understood.
 *
 * `each: true`: this block is read ONE SETTING AT A TIME, by AM4-Edit's own
 * question, the only read of it ever recorded. The catalog's blocks are
 * read whole (fn 0x1F), which nobody has seen this block answer.
 */
import { AM4_NEW_BLOCKS } from './fractal-sysex.mjs'

const NAM = AM4_NEW_BLOCKS.nam

/*
 * THE AM4'S PITCH BLOCK (firmware 3.00, block 0x6E). "The pitch block shows
 * up weird and then also doesn't show any parameters on it. Can we get that
 * all fixed up?" (Justin, 24 November 2026.)
 *
 * NOT READ OFF A UNIT, AND NO RECORDING: the list is the FM3's Pitch block
 * (lib/fm3-knobs, names and ranges), with each setting's number worked out
 * by the rule every AM4 block the codec knows follows against its gen-3
 * twin (checked on Chorus, Delay and Reverb): Level 0, Mix 1, Balance 2,
 * on and off 3, Bypass Mode 4; every other setting is its gen-3 number plus
 * ten, less one for each of the six mixer settings (Mix, Level, Balance,
 * Bypass Mode, Global Mix, Bypass) that comes before it in the gen-3 list.
 * So Type is 10, Master Pitch 12, Shift 1 25. Read one at a time, as the
 * NAM block is, so EVERY READ LOGS THE AM4'S OWN WORDS beside the app's
 * number, and "THE APP'S RANGE IS WRONG for …" where they differ. READ
 * THOSE LINES FIRST in his first log. The two voices only (a Quad type's
 * third and fourth are not here), and no setting that runs along a
 * logarithmic travel. IN STEP WITH ForgeFX server/src/am4Nam.ts.
 */
const PITCH = AM4_NEW_BLOCKS.pitch
const HARMONY = { 0: '-25', 1: '-24', 2: '-23', 3: '-22', 4: '-21', 5: '-20', 6: '-19', 7: '-18', 8: '-17', 9: '-16', 10: '-15', 11: '-14', 12: '-13', 13: '-12', 14: '-11', 15: '-10', 16: '-9', 17: '-8', 18: '-7', 19: '-6', 20: '-5', 21: '-4', 22: '-3', 23: '-2', 24: '1', 25: '2', 26: '3', 27: '4', 28: '5', 29: '6', 30: '7', 31: '8', 32: '9', 33: '10', 34: '11', 35: '12', 36: '13', 37: '14', 38: '15', 39: '16', 40: '17', 41: '18', 42: '19', 43: '20', 44: '21', 45: '22', 46: '23', 47: '24', 48: '25' }
const PITCH_PARAMS = [
  ['level', 'Level', PITCH, 0, 'db', -80, 20, 0],
  ['mix', 'Mix', PITCH, 1, 'percent', 0, 100, 0],
  ['master_pitch', 'Master Pitch', PITCH, 12, 'bipolar_percent', -100, 100, 0],
  ['control', 'Control', PITCH, 13, 'percent', 0, 100, 0],
  ['detune_1', 'Detune 1', PITCH, 21, 'count', -50, 50, 0],
  ['detune_2', 'Detune 2', PITCH, 22, 'count', -50, 50, 0],
  ['shift_1', 'Shift 1', PITCH, 25, 'semitones', -24, 24, 0],
  ['shift_2', 'Shift 2', PITCH, 26, 'semitones', -24, 24, 0],
  ['level_1', 'Level 1', PITCH, 29, 'percent', 0, 100, 0],
  ['level_2', 'Level 2', PITCH, 30, 'percent', 0, 100, 0],
  ['pan_1', 'Pan 1', PITCH, 33, 'bipolar_percent', -100, 100, 0],
  ['pan_2', 'Pan 2', PITCH, 34, 'bipolar_percent', -100, 100, 0],
  ['delay_1', 'Delay 1', PITCH, 37, 'ms', 0, 2000, 0],
  ['delay_2', 'Delay 2', PITCH, 38, 'ms', 0, 2000, 0],
  ['feedback_1', 'Feedback 1', PITCH, 41, 'percent', 0, 100, 0],
  ['feedback_2', 'Feedback 2', PITCH, 42, 'percent', 0, 100, 0],
  ['pitch_type', 'Type', PITCH, 10, 'enum', 0, 15, 0, { 0: 'Dual Detune', 1: 'Quad Detune', 2: 'Dual Chromatic', 3: 'Quad Chromatic', 4: 'Dual Diatonic', 5: 'Quad Diatonic', 6: 'Classic Whammy', 7: 'Octave Divider', 8: 'Crystal Echoes', 9: 'Advanced Whammy', 10: 'Arpeggiator', 11: 'Custom Shifter', 12: 'Quad Chromatic Delay', 13: 'Quad Diatonic Delay', 14: 'Virtual Capo', 15: 'Dual Detune Delay' }],
  ['mode', 'Mode', PITCH, 11, 'enum', 0, 5, 0, { 0: 'UP 1 OCT', 1: 'DOWN 1 OCT', 2: 'UP 2 OCT', 3: 'DOWN 2 OCT', 4: 'UP|DN 1 OCT', 5: 'UP|DN 2 OCT' }],
  ['harmony_1', 'Harmony 1', PITCH, 14, 'enum', 0, 48, 0, HARMONY],
  ['harmony_2', 'Harmony 2', PITCH, 15, 'enum', 0, 48, 0, HARMONY],
  ['key', 'Key', PITCH, 18, 'enum', 0, 11, 0, { 0: 'A', 1: 'Bb', 2: 'B', 3: 'C', 4: 'Db', 5: 'D', 6: 'Eb', 7: 'E', 8: 'F', 9: 'Gb', 10: 'G', 11: 'Ab' }],
  ['scale', 'Scale', PITCH, 19, 'enum', 0, 17, 0, { 0: 'IONIAN MAJ', 1: 'DORIAN', 2: 'PHRYGIAN', 3: 'LYDIAN', 4: 'MIXOLYDIAN', 5: 'AEOLIAN MIN', 6: 'LOCRIAN', 7: 'MEL. MINOR', 8: 'HARM. MINOR', 9: 'DIMINISHED', 10: 'WHOLE TONE', 11: 'DOM. SEVEN', 12: 'DIM. WHOLE', 13: 'PENTA. MAJ', 14: 'PENTA. MIN', 15: 'BLUES', 16: 'CHROMATIC', 17: 'CUSTOM' }],
  ['pitch_quantize', 'Pitch Quantize', PITCH, 20, 'enum', 0, 1, 0, { 0: 'SMOOTH', 1: 'STEPPED' }]
]

export const AM4_OWN_KNOBS = Object.freeze({
  nam: {
    each: true,
    reads: [NAM],
    params: [
      ['level', 'Level', NAM, 0, 'db', -80, 20, 0],
      ['input_gain', 'Input Gain', NAM, 11, 'db', -20, 20, 0],
      ['bass', 'Bass', NAM, 15, 'knob_0_10', 0, 10, 0],
      ['mid', 'Mid', NAM, 16, 'knob_0_10', 0, 10, 0],
      ['treble', 'Treble', NAM, 17, 'knob_0_10', 0, 10, 0],
      ['bright', 'Bright', NAM, 19, 'knob_0_10', -10, 10, 0],
      ['phase_invert', 'Phase Invert', NAM, 12, 'enum', 0, 1, 0, { 0: 'NORMAL', 1: 'INVERT' }],
      ['tone_stack_location', 'Tone Stack Location', NAM, 13, 'enum', 0, 2, 0, { 0: 'PRE', 1: 'POST', 2: 'OFF' }],
      ['tone_stack_type', 'Tone Stack Type', NAM, 14, 'enum', 0, 11, 0, { 0: 'ACTIVE', 1: 'BROWNFACE', 2: 'BLACKFACE', 3: 'BASSGUY', 4: 'TOP BOOST', 5: 'PLEXI', 6: 'USA MARK IV', 7: 'USA PRE LD2', 8: 'RECTO ORANGE', 9: 'RECTO RED', 10: 'SKYLINE', 11: 'PVH 6160' }]
    ]
  },
  pitch: { each: true, reads: [PITCH], params: PITCH_PARAMS }
})
