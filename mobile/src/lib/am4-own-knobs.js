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
  }
})
