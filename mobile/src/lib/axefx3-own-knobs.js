/**
 * THE AXE-FX III'S OWN BLOCKS' KNOBS, WRITTEN BY HAND: THE NAM BLOCK.
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

/** NAM 1 and NAM 2: [slug, family, name, palette page], as AXE3_BLOCKS has every other block. */
export const AXE3_OWN_BLOCKS = Object.freeze({
  206: ['nam', 'NAM', 'NAM', 206],
  207: ['nam', 'NAM', 'NAM', 206]
})

/** The NAM family: knobs as [setting, name, min, max, logarithmic, unit], switches as [setting, name, first, last, names]. */
export const AXE3_OWN_FAMILIES = Object.freeze({
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
