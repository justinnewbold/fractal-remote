/**
 * AN FM3 BLOCK'S KNOBS, READ AND TURNED BY THE PHONE ITSELF.
 *
 * lib/gen3-edit.js, bound to the FM3's catalog (lib/fm3-knobs.js, written
 * from the codec by ForgeFX's FM3 profile: scripts/gen3-knobs.mjs) and its
 * model byte. Everything Edit reads and writes on an FM3 goes through here,
 * and every frame of it is held to fm3EditAllowed before it goes (bleWire
 * gen3Sender).
 */
import { FM3_BLOCKS, FM3_FAMILIES, FM3_PAGES, FM3_ROSTERS } from './fm3-knobs.js'
import { MODELS } from './fractal-sysex.mjs'
import { gen3Edit } from './gen3-edit.js'

export { KNOB, READ_ALL, TYPED, buildKnob, buildReadAll, buildTyped, readAllCollector, readAllPart, shownKnob, sliceOf } from './gen3-edit.js'

const fm3 = gen3Edit({ model: MODELS.fm3, blocks: FM3_BLOCKS, families: FM3_FAMILIES, rosters: FM3_ROSTERS, pages: FM3_PAGES })

export const { editBlock, modelsOf, layoutFor, blockParamsOf, knobFrame, modelFrame, editAllowed } = fm3
/** Whether an FM3 may be sent this frame because it is one of Edit's (gen3-edit editAllowed): a name for it, or null. */
export const fm3EditAllowed = editAllowed
