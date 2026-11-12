/*
 * THE HOLD POP-UP CARRIES THE BLOCK'S KNOBS, OVER ITS CHANNELS.
 *
 * "Also when not in landscape mode on all devices and screens instead of
 * just having channels pop up to change have the knobs only pop up above
 * the channels so some one can quick change a setting." (Justin, 10
 * November 2026.)
 *
 * On Play a tap turns a block on or off and a hold opens its channels, A to
 * D, in a small pop-up. On a big screen, for an account it is open to, the
 * hold opens the block's whole panel beside Play instead (lib/twoSides
 * holdGoes, Derek's idea). Everywhere else the pop-up was the channels
 * alone, and one knob a touch too hot meant leaving Play for Edit. So the
 * pop-up itself gets the block's knobs: the knobs first, then the channels
 * under them where a thumb already is, always on screen however many knobs
 * scroll above them.
 *
 * WHERE. Wherever the hold is the pop-up: every phone held upright or on
 * its side, a tablet held upright, and a big screen where the panel is not
 * open to the account or has no room. Where the hold opens the panel, no
 * pop-up opens at all (screens/Stage: a hold is one or the other, never
 * both), so there is nothing here to ask and nothing there changes.
 *
 * ONLY WHERE EDITING WORKS. The knobs are Edit's own (components/PopKnobs
 * draws Edit's block view), read and written by Edit's own senders, so they
 * show exactly where Edit's door opens for this account, unit and connection
 * (lib/editDoor `opens`): through the computer with the full version, in the
 * demo, and over Bluetooth or a USB cable only where Edit is open there.
 * Never on a VP4, which has no knobs anywhere. Everywhere else the pop-up
 * is the channels alone, exactly as it was, with not a word about knobs.
 *
 * HIS ACCOUNT FIRST (`allowed`: App.js, features HOLD_POPUP_KNOBS_FOR_
 * EVERYONE). Closed to an account, the pop-up it gets is today's.
 *
 * Pure: no imports. test/hold-pop.mjs runs it as it is.
 */

/**
 * Whether the hold pop-up shows a block's knobs over its channels:
 * `allowed` for this account, `editOpens` Edit's door for this unit and
 * connection, and `vp4` a VP4 (the demo's included). Every one has to be
 * exactly right: an answer not yet in is a no, and the pop-up is the
 * channels alone.
 */
export function popKnobsOn({ allowed = false, editOpens = false, vp4 = false } = {}) {
  return allowed === true && editOpens === true && vp4 !== true
}

/**
 * What Play says beside CHAIN where a hold opens this pop-up with knobs in
 * it. "On the gig screen where it says, hold the switch channels, have it
 * say hold for quick edit" (Justin, 12 November 2026). Where the pop-up is
 * the channels alone (a VP4, or Bluetooth on a copy from before Edit opened
 * over it) Play still says shared/play-words HOLD_FOR_CHANNELS, because
 * there a hold edits nothing; the browser says that too, and its words are
 * not touched (shared/ is inside the computer app).
 */
export const HOLD_FOR_QUICK_EDIT = 'Hold for quick edit'

/**
 * And for one block, once the pop-up is open on it: not a block the wire
 * has no knobs for (`knobs: false`, an Axe-Fx III's NAM and IR Player over
 * Bluetooth), whose pop-up stays its channels. Nothing held: no.
 */
export const popKnobsFor = (on, block) => on === true && Boolean(block) && block.knobs !== false

/**
 * What the pop-up leaves out of Edit's block view (screens/Edit BlockPanel
 * `bare`), his "the knobs only": the name and Color (the pop-up has the
 * name for its title), the channels (the pop-up's own are under the knobs,
 * always on screen), Copy channel, the on/off button (one tap on the block
 * does it), the read-only Level, the model and the IR. A block's own knob
 * pages stay: they are how its other knobs are reached.
 */
export const POP_LEAVES_OUT = ['name', 'colour', 'channels', 'copy', 'engaged', 'level', 'model', 'ir']

/** How tall each channel is with the knobs over it: a thumb's 44 and a little, where alone it is 72. Every point saved is a knob's. */
export const POP_CHANNEL_TALL = 56
