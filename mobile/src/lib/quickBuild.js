/*
 * QUICK BUILD'S DOOR (shared/starter-chains.mjs has the rules and the plan;
 * components/QuickBuild draws it).
 *
 * Two answers, kept apart so each reads as a name where it is asked:
 *
 * `quickBuildOn`: whether this account has it at all, his (`admin`, the
 * sign-in kept on the device) until features QUICK_BUILD_FOR_EVERYONE.
 *
 * `quickBuildHere`: whether it is offered on what is on screen now. Never on
 * a VP4 (nothing places a block on one), only where the unit's own
 * capabilities say `gridEdit === true`, and only on this preset's own chain,
 * not the last song's while the new one is read (`elsewhere`). NOTHING HERE
 * ASKS WHICH WIRE IS UNDER IT: the five calls Quick build makes (lib/device
 * blockCatalog, gridCells, placeBlock, clearCell, setCable) go by whatever
 * the link is, and the day the Bluetooth wire answers the grid's routes and
 * says `gridEdit`, this opens there with no change.
 *
 * And the hand-off from Play: a tap on Play's Quick build asks for the sheet
 * (`askQuickBuild`) and opens Edit, whose Quick build takes the ask once
 * (`takeQuickBuildAsk`) when it is drawn on a bare preset.
 */

/** Whether an account has Quick build: his (`admin`), or everyone once the switch says so. */
export const quickBuildOn = ({ admin = false, everyone = false } = {}) => everyone === true || admin === true

/** Whether Quick build is offered on what is on screen: the account has it, not a VP4, the unit edits its grid, and the chain is this preset's. */
export const quickBuildHere = ({ on = false, vp4 = false, caps = null, elsewhere = false } = {}) =>
  on === true && vp4 !== true && caps?.gridEdit === true && elsewhere !== true

/* Play's tap, waiting for Edit. Ten seconds at most: an ask left over from a tap long ago never opens a sheet on its own. */
const ASK_FOR_MS = 10000
let askedAt = 0
export const askQuickBuild = (now = Date.now()) => {
  askedAt = now
}
export const takeQuickBuildAsk = (now = Date.now()) => {
  const fresh = askedAt > 0 && now - askedAt <= ASK_FOR_MS
  askedAt = 0
  return fresh
}
