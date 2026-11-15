/*
 * TWO FACTS ABOUT A UNIT'S CHAIN THAT THE COMPUTER DOES NOT HAND THE PHONE
 * IN THE SHAPE THE PHONE USES. Pure, so a test runs them; lib/device asks
 * both on the way in (`detect`, `presetBlocks`).
 *
 * 1. WHETHER BLOCKS CAN BE PLACED IN THE GRID (`gridEdit`). ForgeFX's
 *    drivers carry it (gen3.ts, am4.ts: true; vp4.ts: false), but the
 *    capabilities /device/detect serves are a curated subset that leaves it
 *    out (registryCore #capabilitiesDto): what reaches the phone is
 *    `gridRouting` (whether its driver lays cables: the gen-3 units),
 *    `slotModel` and `slotCount`. So it is said here from those: a unit
 *    that can be cabled can be placed on, and a linear unit of FOUR slots
 *    that is not a VP4 is an AM4, whose slots the computer places (am4.ts
 *    placeCell). NOT an Axe-Fx II: its driver places blocks (gen2.ts) and
 *    lays no cables, so the computer says `gridRouting: false`, and a row
 *    built there could not be joined or said to be; it is left a no until
 *    the plan can build a row with no cables on a grid. NOT an Axe-Fx
 *    Standard or Ultra: linear, 48 slots, and no way to place a block at
 *    all (gen1.ts), so "linear and not a VP4" is not the test. The demo
 *    answers every route but on a VP4. A wire that says `gridEdit` itself (the Bluetooth wire, the
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
 *
 *    AND ITS ROW IS PUT TO ZERO TOO. placedBlocks() answers `row: 1` for
 *    every slot (and bleWire the same), while a linear unit has ONE row,
 *    row 0, and the grid read answers row 0. Left at 1, the chain editor
 *    drew a second, empty lane over a full AM4 (the row the blocks were
 *    not on), a block added there went over the one already in that slot,
 *    and the check after it looked on row 0 for blocks filed on row 1 and
 *    said the unit had not added it.
 */
import { isLinearChain, zeroBasedChain } from './slots.js'

/** The capabilities with `gridEdit` said, where it can be (above). */
export function withGridEdit(caps, { demo = false, vp4 = false } = {}) {
  if (!caps || typeof caps !== 'object' || typeof caps.gridEdit === 'boolean') return caps
  if (vp4) return { ...caps, gridEdit: false }
  if (demo) return { ...caps, gridEdit: true }
  if (typeof caps.gridRouting !== 'boolean') return caps
  return { ...caps, gridEdit: caps.gridRouting === true || (caps.slotModel === 'linear' && caps.slotCount === 4) }
}

/** The chain read, counted from zero on every unit (above). */
export function chainFromZero(list, caps, { demo = false, vp4 = false } = {}) {
  if (demo || vp4) return list
  const zeroed = zeroBasedChain(list, caps)
  if (!Array.isArray(zeroed) || !isLinearChain(caps)) return zeroed
  return zeroed.map((b) => (Number.isInteger(b?.row) && b.row !== 0 ? { ...b, row: 0 } : b))
}
