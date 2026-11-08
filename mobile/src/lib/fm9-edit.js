/**
 * AN FM9 BLOCK'S KNOBS, READ AND TURNED BY THE PHONE ITSELF.
 *
 * lib/gen3-edit.js, bound to the FM9's catalog (lib/fm9-knobs.js, written
 * from the codec by ForgeFX's FM9 profile: scripts/gen3-knobs.mjs) and its
 * model byte. Everything Edit reads and writes on an FM9 goes through here,
 * and every frame of it is held to fm9EditAllowed before it goes (bleWire
 * gen3Sender).
 */
import { FM9_BLOCKS, FM9_FAMILIES, FM9_PAGES, FM9_ROSTERS } from './fm9-knobs.js'
import { MODELS } from './fractal-sysex.mjs'
import { gen3Edit } from './gen3-edit.js'

export { KNOB, READ_ALL, TYPED, buildKnob, buildReadAll, buildTyped, readAllCollector, readAllPart, shownKnob, sliceOf } from './gen3-edit.js'

const fm9 = gen3Edit({ model: MODELS.fm9, blocks: FM9_BLOCKS, families: FM9_FAMILIES, rosters: FM9_ROSTERS, pages: FM9_PAGES })

export const { editBlock, modelsOf, layoutFor, blockParamsOf, knobFrame, modelFrame, editAllowed } = fm9
/** Whether an FM9 may be sent this frame because it is one of Edit's (gen3-edit editAllowed): a name for it, or null. */
export const fm9EditAllowed = editAllowed
