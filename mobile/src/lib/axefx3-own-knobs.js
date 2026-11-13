/**
 * THE AXE-FX III'S OWN BLOCKS' KNOBS, WRITTEN BY HAND: THE NAM BLOCK FIRST,
 * AND THEN THE REST THE CODEC HAS NONE FOR (below the NAM block's notes).
 *
 * The III's knob catalog (lib/axefx3-knobs.js) is written from the codec the
 * computer app carries, and that codec is from before firmware 33: it has no
 * NAM block. So Edit over Bluetooth had a name and an on and off for NAM 1
 * and NAM 2 (effect ids 206 and 207, lib/gen3Catalog OWN) and no knobs.
 * These are the block's settings as Justin's own Axe-Fx III (a Mark II on
 * firmware 33.01) said them to the block reader on 13 November 2026, named
 * from Axe-Edit III's NAM page the same day. docs/ax3-readings.md is the
 * record of both.
 *
 * NOT GENERATED, and never written into axefx3-knobs.js, which a test holds
 * to its script. lib/axefx3-edit.js lays these beside the codec's catalog
 * (`withNam`), and the wire reads the III through that only for the accounts
 * the NAM block's knobs are open to (lib/features NAM_KNOBS_FOR_EVERYONE:
 * his account until it says otherwise). For everybody else the III's Edit is
 * the codec's catalog alone, exactly as it was. If the codec ever carries
 * these ids itself, its rows win (axefx3-edit.js) and this file goes.
 *
 * ONLY WHAT IS CERTAIN. A setting is here when its range is known from the
 * unit, its name from Axe-Edit, and the number read off the unit comes out
 * as what Axe-Edit showed for it (two reads of channel A, before and after
 * he changed four switches in Axe-Edit, which test/bluetooth.mjs holds
 * these rows to). Each is setting N of the block's 18 values a channel, four
 * channels.
 *
 * THE KNOBS:
 *
 *   1  Level        -80 to 20 dB. Entered as every block's Level is, so Edit
 *                   treats it as one: a box to type in, never a knob, never
 *                   below the floor (lib/blockLevel, lib/guardrails).
 *   2  Balance      -100 to 100, as every block's Balance is entered, and
 *                   like every block's it is not a knob on the phone
 *                   (lib/guardrails isSilencingParam).
 *   5  Input Gain   -20 to 20 dB; 32767 read as 0.00 dB.
 *   10 Bass, 11 Mid, 12 Treble   0 to 10; 32767 read as 5.00.
 *   14 Bright       -10 to 10; 32767 read as 0.00.
 *   15 Bright Cap   10 to 10000 pF, along a logarithmic travel: 36526 read
 *                   as 470.0 pF, and 10 × 1000^(36526 ÷ 65534) is 469.98.
 *
 * THE SWITCHES, each numbered as the unit numbers it (Axe-Edit sorts its
 * menus by the alphabet, so its order is not the unit's), and which numbers
 * were READ off the unit and which are BY ELIMINATION:
 *
 *   3  Bypass Mode          0 THRU, 1 MUTE. Both read (0 said "THRU", 1
 *                           said "MUTE"), and Axe-Edit's menu has those two
 *                           and no more. The unit describes this one as 0 to
 *                           1 in steps of 0.001 (type code 176) rather than
 *                           as a plain list, yet it reads 0 and 1 as a list
 *                           does, never 0 and 65534 as a knob would. Entered
 *                           as the codec's catalog enters an amp's Bypass
 *                           Mode: a switch of the same two. Its two numbers
 *                           are also the two ends of its range, so a typed
 *                           0 or 1 is THRU or MUTE whichever way the unit
 *                           takes it.
 *   6  Phase Invert         0 NORMAL, 1 INVERT. Both read; the unit's own
 *                           names for them. "Phase Invert" is Axe-Edit's
 *                           name for the control.
 *   8  Tone Stack Location  0 PRE, 1 POST, 2 OFF. 1 and 2 read ("POST",
 *                           "OFF"); 0 is PRE BY ELIMINATION: three choices,
 *                           and Axe-Edit's menu is Off, Post, Pre. (An amp's
 *                           own Tonestack Location starts PRE, POST too.)
 *   9  Tone Stack Type      a list of twelve, every name read off the unit
 *                           in its own order.
 *   13 Input Mode           0 LEFT, 1 RIGHT, 2 SUM L+R. 0 and 2 read
 *                           ("LEFT", "SUM L+R"); 1 is RIGHT BY ELIMINATION:
 *                           Axe-Edit's menu is Left, Right, Sum L+R. (An
 *                           amp's own Input Select runs LEFT, RIGHT, SUM L+R
 *                           too.)
 *
 * LEFT OUT, EVERY ONE, so no frame can be built for it and the sender's
 * guard has no row to pass it on (gen3-edit editAllowed):
 *
 *   0  Type, the NAM capture. A list of 257 slots whose names are whatever
 *      is loaded on that unit, so the app has no list to offer. With no
 *      model setting here (`typeId: null`) the block has no model picker and
 *      no model write, as a Mixer or a Looper has none.
 *   4  the block's own bypass: Play's on and off does that, by the
 *      published message, as for every block.
 *   7  a switch that reads OFF or ON, whose name nobody knows. It is not
 *      Phase Invert (that is 6: it moved when he switched Phase Invert on,
 *      and 7 stayed OFF).
 *   16, 17  two values in every channel's read with no setting behind them.
 *      They follow the capture: they moved when he chose another capture
 *      and changed nothing else of theirs. Never written.
 *
 * NOTHING HERE HAS BEEN TURNED ON A UNIT. Every number above was READ off
 * his; no write of Edit's has gone to a NAM block yet. The writes are the
 * ones gen3-edit builds for any knob or switch on any gen-3 block, nothing
 * new on the wire, and fewer of them: a knob here is sent its place along
 * its travel (fn 0x01, 52 00) and never the typed write of the same place
 * that the app falls back to on other blocks when a write does not read
 * back as asked (`typedKnobs: false`; gen3-edit ONE WAY ONLY). One kind of
 * frame for a knob, one for a switch (its number, typed: 09 00), until the
 * unit has shown it takes them.
 *
 * The rows are the generated catalogs' own shape (scripts/gen3-knobs.mjs),
 * so gen3-edit reads them as it reads those. No pages: without them Edit
 * falls back to one page of the knobs in this order (lib/editPages), which
 * is nobody's layout but the list's.
 */

/*
 * AND THE REST THE CODEC HAS NO KNOBS FOR (1.90.49): the IR Player, the
 * Vocoder, the Crossover, Tone Match and Dynamic Distortion. "Want to get it
 * all done" (Justin, 13 November 2026). Read off the same unit the same day,
 * each with Axe-Edit III's page beside it; docs/ax3-readings.md has every
 * setting of each, these and the ones left out.
 *
 * The same rule, ONLY WHAT IS CERTAIN, and here it leaves more out, because
 * each block was read once, as it came out of the box:
 *
 * - A KNOB is here when Axe-Edit names it, the unit gave its range, and the
 *   number in the block's whole read comes out as what the unit showed for
 *   it. Where that number sits part-way along the travel, it also says how
 *   the travel runs: the Crossover's Freq (20045 read as 100.0 Hz of 40 to
 *   800) and Dynamic Distortion's Frequency (30538 as 500.0 Hz of 20 to
 *   20000) can only be logarithmic, and a NAM's Bass (32767 as 5.00 of 0 to
 *   10) only a straight line. test/bluetooth.mjs holds every row to its read.
 * - WHERE THE NUMBER SAT AT AN END (a Mix at 100 %, a Low Cut at 20 Hz), the
 *   read does not say how the travel runs. A cut frequency takes the travel
 *   of the unit's own type code for it, which three other settings with the
 *   same code proved logarithmic (577: the Vocoder's Min Frequency and
 *   Dynamic Distortion's Frequency; 576: the Vocoder's Max Frequency). A
 *   percentage is a straight line, as every percentage in the codec's table
 *   for this unit is. Each such row says so beside it: "end only".
 * - A SWITCH is here only when the unit itself listed its choices, in its
 *   own order. One whose choices were never listed (the IR Player's Input
 *   Select, Dynamic Distortion's Clip Shape) is left out, however plain its
 *   name.
 * - LEFT OUT: anything read the same as its neighbours, so which is which
 *   is not known (the Crossover's four levels and four pans, the IR Player's
 *   two IR levels and pans, the Vocoder's 24 band levels and 24 band pans);
 *   anything with no name on Axe-Edit's page; every bank, number and length
 *   of an impulse response; the Vocoder's Master Pan, which read "100.0 %";
 *   Tone Match's start, match and export controls, which do things rather
 *   than hold a value; and each block's own bypass, which Play does.
 *
 * Dynamic Distortion's Type is entered as a switch, not as the block's
 * model: a model change is its own kind of write, and nobody has seen this
 * block take one.
 *
 * Every family is sent one way only, as the NAM block is (`typedKnobs:
 * false`), and NOTHING HERE HAS BEEN TURNED ON A UNIT.
 */

/** [slug, family, name, palette page], as AXE3_BLOCKS has every other block. */
export const AXE3_OWN_BLOCKS = Object.freeze({
  134: ['vocoder', 'VOCODER', 'Vocoder', 134],
  142: ['crossover', 'CROSSOVER', 'Crossover', 142],
  143: ['crossover', 'CROSSOVER', 'Crossover', 142],
  170: ['tonematch', 'TONEMATCH', 'Tone Match', 170],
  195: ['irplayer', 'IRPLAYER', 'IR Player', 195],
  196: ['irplayer', 'IRPLAYER', 'IR Player', 195],
  197: ['irplayer', 'IRPLAYER', 'IR Player', 195],
  198: ['irplayer', 'IRPLAYER', 'IR Player', 195],
  202: ['dynadist', 'DYNADIST', 'Dynamic Distortion', 202],
  203: ['dynadist', 'DYNADIST', 'Dynamic Distortion', 202],
  206: ['nam', 'NAM', 'NAM', 206],
  207: ['nam', 'NAM', 'NAM', 206]
})

/** Each family: knobs as [setting, name, min, max, logarithmic, unit], switches as [setting, name, first, last, names]. */
export const AXE3_OWN_FAMILIES = Object.freeze({
  /* The Vocoder: 67 settings and no channels (its whole read is one set of 67). */
  VOCODER: {
    stride: 67,
    typeId: null,
    typedKnobs: false,
    knobs: [
      [3, 'Min Frequency', 20, 2000, 1, 'Hz'], // 32767 read as 200.0 Hz
      [4, 'Max Frequency', 2000, 20000, 1, 'Hz'], // 26079 read as 5000 Hz
      [5, 'Filter Resonance', 0.5, 2, 1, null], // 32767 read as 1.000
      [7, 'Master Level', 0, 100, 0, '%'], // end only: 65534 read as 100.0 %
      [9, 'Frequency Shift', 0.2, 5, 1, null], // 32767 read as 1.000
      [10, 'Attack', 5, 1000, 1, 'ms'], // 8573 read as 10.00 ms
      [11, 'Decay', 5, 1000, 1, 'ms'], // 28480 read as 50.00 ms
      [12, 'Highpass Mix', 0, 100, 0, '%'], // end only: 0 read as 0.0 %
      [13, 'Mix', 0, 100, 0, '%'], // end only: 65534 read as 100.0 %
      [14, 'Level', -80, 20, 0, 'dB'], // 52427 read as 0.0 dB
      [15, 'Balance', -100, 100, 0, '%'] // 32767 read as 0.0
    ],
    switches: [
      [1, 'Analysis Channel', 0, 1, ['LEFT', 'RIGHT']],
      [6, 'Freeze', 0, 1, ['OFF', 'ON']],
      [16, 'Bypass Mode', 0, 2, ['THRU', 'MUTE FX OUT', 'MUTE OUT']]
    ],
    selectors: {}
  },
  /* The Crossover: 15 settings, channels A and B only (its whole read is two sets of 15). */
  CROSSOVER: {
    stride: 15,
    typeId: null,
    typedKnobs: false,
    knobs: [
      [0, 'Freq', 40, 800, 1, 'Hz'], // 20045 read as 100.0 Hz
      [11, 'Level', -80, 20, 0, 'dB'], // 52427 read as 0.0 dB
      [12, 'Balance', -100, 100, 0, '%'] // 32767 read as 0.0
    ],
    switches: [
      [1, 'Freq Multiplier', 0, 1, ['X 1', 'X 10']],
      [13, 'Bypass Mode', 0, 1, ['THRU', 'MUTE']]
    ],
    selectors: {}
  },
  /* Tone Match: 22 settings and no channels. */
  TONEMATCH: {
    stride: 22,
    typeId: null,
    typedKnobs: false,
    knobs: [
      [0, 'Amount', 0, 100, 0, '%'], // end only: 65534 read as 100.0 %
      [1, 'Smoothing', 0, 100, 0, '%'], // end only: 0 read as 0.0 %
      [5, 'Level', -80, 20, 0, 'dB'], // 52427 read as 0.0 dB
      [6, 'Balance', -100, 100, 0, '%'], // 32767 read as 0.0
      [10, 'Averaging Time', 0.1, 100, 1, null], // 37113 read as 5.000
      [20, 'Reference Level', -40, 20, 0, 'dB'] // 43689 read as 0.00 dB
    ],
    switches: [[21, 'Mode', 0, 1, ['LIVE', 'OFF-LINE']]],
    selectors: {}
  },
  /* The IR Player: 20 settings, four channels. */
  IRPLAYER: {
    stride: 20,
    typeId: null,
    typedKnobs: false,
    knobs: [
      [2, 'Low Cut', 20, 2000, 1, 'Hz'], // end only: 0 read as 20.0 Hz
      [3, 'High Cut', 200, 20000, 1, 'Hz'], // end only: 65534 read as 20000 Hz
      [7, 'Level', -80, 20, 0, 'dB'], // 52427 read as 0.0 dB
      [8, 'Balance', -100, 100, 0, '%'], // 32767 read as 0.0
      [18, 'Mix', 0, 100, 0, '%'] // end only: 65534 read as 100.0 %
    ],
    switches: [
      [4, 'Filter Slope', 0, 1, ['6 dB/OCT', '12 dB/OCT']],
      [19, 'Mode', 0, 1, ['PARALLEL', 'SERIES']]
    ],
    selectors: {}
  },
  /* Dynamic Distortion: 14 settings, four channels. */
  DYNADIST: {
    stride: 14,
    typeId: null,
    typedKnobs: false,
    knobs: [
      [1, 'Frequency', 20, 20000, 1, 'Hz'], // 30538 read as 500.0 Hz
      [2, 'Q', 0.1, 10, 1, null], // 22903 read as 0.500
      [3, 'Gain', -20, 20, 0, 'dB'], // 32767 read as 0.00 dB
      [6, 'Bias', 0, 10, 0, null], // end only: 0 read as 0.00
      [7, 'Drive', 0, 10, 0, null], // 43689 read as 6.67: its place along the travel, times ten
      [8, 'Level', -80, 20, 0, 'dB'], // 52427 read as 0.0 dB
      [9, 'Pan', -100, 100, 0, '%'] // 32767 read as 0.0. Axe-Edit calls this one Pan
    ],
    switches: [
      [10, 'Bypass Mode', 0, 1, ['THRU', 'MUTE']],
      [12, 'Mono/Stereo', 0, 1, ['MONO', 'STEREO']],
      [13, 'Type', 0, 6, ['Flat', 'Dynamic Mid Boost', 'Dynamic Mid Cut', 'Dynamic Presence Boost', 'Dynamic Presence Cut', 'Dynamic Depth Boost', 'Dynamic Depth Cut']]
    ],
    selectors: {}
  },
  NAM: {
    stride: 18,
    typeId: null,
    typedKnobs: false,
    knobs: [
      [1, 'Level', -80, 20, 0, 'dB'],
      [2, 'Balance', -100, 100, 0, '%'],
      [5, 'Input Gain', -20, 20, 0, 'dB'],
      [10, 'Bass', 0, 10, 0, null],
      [11, 'Mid', 0, 10, 0, null],
      [12, 'Treble', 0, 10, 0, null],
      [14, 'Bright', -10, 10, 0, null],
      [15, 'Bright Cap', 10, 10000, 1, 'pF']
    ],
    switches: [
      [3, 'Bypass Mode', 0, 1, ['THRU', 'MUTE']],
      [6, 'Phase Invert', 0, 1, ['NORMAL', 'INVERT']],
      [8, 'Tone Stack Location', 0, 2, ['PRE', 'POST', 'OFF']],
      [9, 'Tone Stack Type', 0, 11, ['ACTIVE', 'BROWNFACE', 'BLACKFACE', 'BASSGUY', 'TOP BOOST', 'PLEXI', 'USA MARK IV', 'USA PRE LD2', 'RECTO ORANGE', 'RECTO RED', 'SKYLINE', 'PVH 6160']],
      [13, 'Input Mode', 0, 2, ['LEFT', 'RIGHT', 'SUM L+R']]
    ],
    selectors: {}
  }
})
