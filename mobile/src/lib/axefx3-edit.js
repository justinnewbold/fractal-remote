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
import { MODELS } from './fractal-sysex.mjs'
import { gen3Edit } from './gen3-edit.js'

export { KNOB, READ_ALL, TYPED, buildKnob, buildReadAll, buildTyped, readAllCollector, readAllPart, shownKnob, sliceOf } from './gen3-edit.js'

const axefx3 = gen3Edit({ model: MODELS.axefx3, blocks: AXE3_BLOCKS, families: AXE3_FAMILIES, rosters: AXE3_ROSTERS, pages: AXE3_PAGES })

export const { editBlock, modelsOf, layoutFor, blockParamsOf, knobFrame, modelFrame, editAllowed } = axefx3
/** Whether an Axe-Fx III may be sent this frame because it is one of Edit's (gen3-edit editAllowed): a name for it, or null. */
export const axefx3EditAllowed = editAllowed
