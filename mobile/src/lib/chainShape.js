/*
 * TWO FACTS ABOUT A UNIT'S CHAIN THAT THE COMPUTER DOES NOT HAND THE PHONE
 * IN THE SHAPE THE PHONE USES. Pure, so a test runs them; lib/device asks
 * both on the way in (`detect`, `presetBlocks`).
 *
 * 1. WHETHER BLOCKS CAN BE PLACED IN THE GRID (`gridEdit`). ForgeFX's
 *    drivers carry it (gen3.ts, am4.ts: true; vp4.ts: false), but the
 *    capabilities /device/detect serves are a curated subset that leaves it
 *    out (registryCore #capabilitiesDto): what reaches the phone is
 *    `gridRouting` (cables: gen-3 and Axe-Fx II) and `slotModel`. So it is
 *    said here from those: a unit that can be cabled can be placed on, and
 *    a linear unit that is not a VP4 is an AM4, whose four slots the
 *    computer places (am4.ts placeCell). The demo answers every route but
 *    on a VP4. A wire that says `gridEdit` itself (the Bluetooth wire, the
 *    day it answers the grid's routes) is believed as it is, and one that
 *    says nothing and is not the computer's (no `gridRouting`) is left with
 *    nothing: Quick build (lib/quickBuild) is offered only on a yes.
 *
 * 2. AN AM4'S COLUMNS COUNT FROM ONE. ForgeFX's am4.ts placedBlocks()
 *    answers `col: sl.slot`, slots 1 to 4, while its grid() answers
 *    `slot - 1` and its placeCell takes 1 to 4 on the wire, which the
 *    phone's toWireCell adds one to. The browser has put the chain back to
 *    zero since September (src/lib/forgefx.js zeroBasedChain); the phone
 *    never did, so through the computer its chain editor drew an AM4's slot
 *    1 as slot 2, and a block taken out of the first slot cleared the
 *    second ("It shows five blocks when there's only four... if you add one,
 *    it actually saves it to the first block, but overwrites the one that is
 *    listed as number two", slots.js, of the browser). The Bluetooth wire
 *    reads an AM4 the same way (bleWire am4Placed, `col: i + 1`), so the
 *    same rule takes both. Not the demo, whose AM4 counts from zero, and
 *    not a VP4, whose chain the phone builds itself (lib/vp4-safety).
 */
import { zeroBasedChain } from './slots.js'

/** The capabilities with `gridEdit` said, where it can be (above). */
export function withGridEdit(caps, { demo = false, vp4 = false } = {}) {
  if (!caps || typeof caps !== 'object' || typeof caps.gridEdit === 'boolean') return caps
  if (vp4) return { ...caps, gridEdit: false }
  if (demo) return { ...caps, gridEdit: true }
  if (typeof caps.gridRouting !== 'boolean') return caps
  return { ...caps, gridEdit: caps.gridRouting === true || caps.slotModel === 'linear' }
}

/** The chain read, counted from zero on every unit (above). */
export const chainFromZero = (list, caps, { demo = false, vp4 = false } = {}) => (demo || vp4 ? list : zeroBasedChain(list, caps))
