/* Generated from src/lib/sceneColors.js by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * A colour per scene, so a scene is recognised rather than read.
 *
 * The blocks below have had this since blockColors — on a dark stage a player
 * finds the drive by its red long before the three letters resolve. Scenes had
 * nothing: eight identical panels distinguished by a numeral and, if you named
 * them, some small type. Between two bars of a song that is a reading task.
 *
 * WHAT THE UNITS DO, which is not that. Every Scene switch on an FM3, FM9 or
 * Axe-Fx III lights Fractal's red by default — the one you are on bright, the
 * rest dim — and the AM4 and VP4 light all four bars red in Scene mode. So
 * Match my unit and Footswitch lights draw every scene red, the live one
 * solid and the others the same pale wash with a red edge: the unit's own
 * bright and dim. The numbers and names say which, as they do on the unit.
 * The other looks give each scene its own colour (lib/blockPalettes), and so
 * can a player, for every preset or for one: Fractal's own PERFORM layout
 * makes Clean green, Crunch yellow and Lead red in exactly that way.
 *
 * Which scene is LIVE is carried by fill against edge — the same grammar the
 * block tiles use for on against off — so colour stays identity and
 * brightness stays state. None of the colours on offer is the amber --signal:
 * that colour means the audio path in this app and a scene tile is not
 * allowed to borrow it.
 *
 * Fixed to the index, not to the name. A scene keeps its colour when it is
 * renamed, and scene 3 is the same colour in every preset on the unit unless
 * you gave that one preset its own, which is what makes it learnable at all.
 *
 * In this order: this preset's colour for the scene, then your colour for it
 * in every preset, then the look's.
 */
import { FRACTAL_REMOTE_LOOK, lookById } from './blockPalettes.js'
import { inkOn } from './ink.js'
import { SCENE_SLOTS, colourUnit, lookId, looksVersion, yourScene } from './looks.js'

let keptFor = null
const kept = new Map()

function resolve(slot, preset) {
  const own = (preset !== undefined && preset !== null && yourScene(slot, { preset })) || yourScene(slot)
  if (own) return Object.freeze({ fill: own, ink: inkOn(own) })
  const id = lookId()
  const fill = lookById(id).scenes[slot]
  /* The app's own look keeps the letters it always had: white on all eight. */
  return Object.freeze({ fill, ink: id === FRACTAL_REMOTE_LOOK ? '#ffffff' : inkOn(fill) })
}

/**
 * The colour for a 0-based scene index — in `preset` when one is given. Wraps,
 * for a unit with more than eight.
 */
export function sceneColor(i, preset) {
  const stamp = `${looksVersion()}|${colourUnit()}`
  if (stamp !== keptFor) {
    kept.clear()
    keptFor = stamp
  }
  const slot = ((i % SCENE_SLOTS) + SCENE_SLOTS) % SCENE_SLOTS
  const k = `${slot}|${preset ?? ''}`
  let hit = kept.get(k)
  if (!hit) {
    hit = resolve(slot, preset)
    kept.set(k, hit)
  }
  return hit
}

export const SCENE_COLOR_COUNT = SCENE_SLOTS
