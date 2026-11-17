/*
 * A NAM BLOCK SWITCHED ON, SO A CAPTURE PLAYED IN IT IS HEARD.
 *
 * "If the NAM block is off when you hold it to browse tone 3000, does it
 * turn it on so you can listen to it, or does it leave it off? need to make
 * sure that it turns it on automatically to listen" (Justin, 17 November
 * 2026). It left it off: the pick only chooses the capture, so a preview in
 * a block that was off made no sound.
 *
 * The rule and its words are lib/namPlaying's (`switchOnToHear`,
 * `pickedLine`); this is the reach. The TONE3000 card reaches a unit by the
 * captures' three calls and by this one: the rig's own switch, the one
 * Edit's block page uses, so it is sent, timed, refused and put back as any
 * tap on a tile is. ON ONLY: this file has no way to switch a block off,
 * and a test holds it to that.
 */
import { blockIsOff, writeBlockBypass } from './rig'

/** Whether the chain on screen, this preset's own, has the block switched off: true, false, or null where it does not say. Nothing is sent. */
export const namOffHere = (block) => blockIsOff(block)

/** The block switched on, in the scene the unit is on: true once the unit took it, false where it was refused or did not land. */
export const namOnHere = (block) => writeBlockBypass(block, false)
