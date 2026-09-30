import { blockParams, disambiguate } from './forgefx'
import { EXCLUDED_BLOCKS, isSilencingParam } from './guardrails'
import { namedAsOnPages } from './editPages'

/*
 * Under the names the knobs wear, not the catalog's: a search for "bright
 * cap" finds the knob that says Bright Cap, and a meter — which the pages do
 * not draw — is not offered to turn. Levels are taken out by the catalog's
 * name, which is the one the silencing rule knows.
 */
export const asOnPages = (res) => {
  const named = (res?.named || []).filter((p) => !isSilencingParam(p.name))
  return disambiguate(namedAsOnPages(named, res?.layout).map((p) => ({ ...p, name: p.label })))
}

/**
 * Every editable control in the preset, one flat list.
 *
 * Extracted from the search box the moment a second feature (the XY pad)
 * needed the same walk — two copies of "what controls exist" would disagree
 * the first time one of them learned something.
 */
export async function buildParamIndex(blocks) {
  const editable = (blocks || []).filter((b) => !EXCLUDED_BLOCKS.includes(b.slug))
  const out = []
  for (const block of editable) {
    try {
      const res = await blockParams(block.effectId)
      /*
       * The player's own list, so it holds the player's rule rather than the
       * model's: levels reach the model now, bounded, but a level found in a
       * search box and dragged by a finger is the silent preset by another
       * route. They stay where the knob list keeps them, off the quick surfaces.
       */
      for (const param of asOnPages(res).filter((p) => !isSilencingParam(p.name))) {
        out.push({ block, param })
      }
    } catch {
      // A block that won't list its params just isn't offered.
    }
  }
  return out
}

/** A stable key for one control, fit for select values and storage. */
export const controlKey = (eid, paramId) => `${eid}:${paramId}`
