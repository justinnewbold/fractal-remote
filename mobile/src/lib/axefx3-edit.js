/**
 * AN AXE-FX III BLOCK'S KNOBS, READ AND TURNED BY THE PHONE ITSELF.
 *
 * lib/gen3-edit.js, bound to the Axe-Fx III's catalog (lib/axefx3-knobs.js,
 * written from the codec by ForgeFX's Axe-Fx III profile: scripts/
 * gen3-knobs.mjs) and its model byte. Everything Edit reads and writes on an
 * Axe-Fx III goes through here, and every frame of it is held to
 * axefx3EditAllowed before it goes (bleWire gen3Sender).
 */
import { AXE3_BLOCKS, AXE3_FAMILIES, AXE3_PAGES, AXE3_ROSTERS } from './axefx3-knobs.js'
import { AXE3_OWN_BLOCKS, AXE3_OWN_FAMILIES } from './axefx3-own-knobs.js'
import { MODELS } from './fractal-sysex.mjs'
import { gen3Edit } from './gen3-edit.js'

export { KNOB, READ_ALL, TYPED, buildKnob, buildReadAll, buildTyped, readAllCollector, readAllPart, shownKnob, sliceOf } from './gen3-edit.js'

const axefx3 = gen3Edit({ model: MODELS.axefx3, blocks: AXE3_BLOCKS, families: AXE3_FAMILIES, rosters: AXE3_ROSTERS, pages: AXE3_PAGES })

export const { editBlock, modelsOf, layoutFor, blockParamsOf, knobFrame, modelFrame, editAllowed } = axefx3
/** Whether an Axe-Fx III may be sent this frame because it is one of Edit's (gen3-edit editAllowed): a name for it, or null. */
export const axefx3EditAllowed = editAllowed

/**
 * THE SAME, WITH THE NAM BLOCK'S KNOBS IN IT (lib/axefx3-own-knobs.js: NAM 1
 * and NAM 2, 206 and 207, which the codec's catalog does not carry). A second
 * Edit of the III's, not a change to the first: everything above is the
 * codec's catalog alone, as it was, and stays what every account gets. The
 * wire reads and guards through this one only while the NAM block's knobs are
 * open to the account (bleWire `namKnobs`, asked at each request and each
 * send; lib/features NAM_KNOBS_FOR_EVERYONE), so closed, a NAM's read or
 * write is refused where it always was.
 *
 * The codec's rows go on last: an id or a family it ever carries itself is
 * the codec's, never the hand-written one's.
 */
export const withNam = gen3Edit({
  model: MODELS.axefx3,
  blocks: { ...AXE3_OWN_BLOCKS, ...AXE3_BLOCKS },
  families: { ...AXE3_OWN_FAMILIES, ...AXE3_FAMILIES },
  rosters: AXE3_ROSTERS,
  pages: AXE3_PAGES
})

/**
 * AND WITH THE NAM BLOCK ALONE (13 November 2026). "Open them to everyone":
 * the NAM block's knobs had been turned on his own Axe-Fx III and held, and
 * the other five blocks in the hand-written list had not been turned at all.
 * So every account gets the codec's catalog and the NAM block, and nothing
 * else of that list; the whole of it (`withNam`, above, whose name is from
 * when NAM was the only one in it) stays his account's until one of the five
 * has been turned (lib/features OWN_KNOBS_FOR_EVERYONE).
 */
const NAM_BLOCKS = Object.fromEntries(Object.entries(AXE3_OWN_BLOCKS).filter(([, b]) => b[1] === 'NAM'))
export const namOnly = gen3Edit({
  model: MODELS.axefx3,
  blocks: { ...NAM_BLOCKS, ...AXE3_BLOCKS },
  families: { NAM: AXE3_OWN_FAMILIES.NAM, ...AXE3_FAMILIES },
  rosters: AXE3_ROSTERS,
  pages: AXE3_PAGES
})
