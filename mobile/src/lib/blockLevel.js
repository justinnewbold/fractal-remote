/*
 * A BLOCK'S OWN LEVEL IN EDIT: TYPED, NEVER DRAGGED, AND NEVER BELOW THE FLOOR.
 *
 * It was a number with "read-only" beside it, on purpose: a level dragged to
 * the bottom by a thumb makes a preset that looks right and is silent. The
 * browser let it be typed again long ago, with a floor; the phone never got
 * that, and a player on the Fractal forum asked why (SASouth, 10 November
 * 2026): "I'm interested in knowing why levels in the output blocks are
 * marked read-only. I often want to tweak the volume of a preset without
 * changing the amps gain." Justin, the same day: "Yes, do an update for that
 * right now, please."
 *
 * SO THE RULE IS the browser's (src/components/Console.jsx, "THE BLOCK'S
 * OUTPUT LEVEL"), on the phone:
 *
 *   - It is still kept out of the knobs (lib/guardrails isSilencingParam): a
 *     knob under a thumb is the slip the old rule was about. It is a box to
 *     type a number into, under the knobs, where the read-only number was.
 *   - Only a level in decibels can be typed. One that says no unit is taken
 *     for decibels by its name, as the volume slider takes it (lib/volume
 *     inDecibels: the FM3's Output Level says none). A level in anything
 *     else stays a number with "read-only" beside it.
 *   - Never below LEVEL_FLOOR_DB, the same number lib/guardrails holds: under
 *     that a block is out of the mix. A level the unit already holds below
 *     the floor is shown as it is; typing brings it up to the floor or over.
 *   - Never over the level's own top.
 *
 * WHICH LEVEL. A block can have several settings that end in "Level" (the
 * Output block has one for each row and each scene as well as its own). The
 * one called exactly "Level" is the block's own, so it is taken first; with
 * none, the first that ends in "Level". Never a boost's or an input's, which
 * drive gain rather than volume and are knobs like any other.
 *
 * Nothing here imports anything, so the tests run it as it is.
 */

/** Below this a block is out of the mix. lib/guardrails' own number: a test holds the two equal. */
export const LEVEL_FLOOR_DB = -20

/** What is said beside the box. */
export const LEVEL_HINT = `not below ${LEVEL_FLOOR_DB} dB`

const named = (p) => (typeof p?.name === 'string' ? p.name.trim() : '')
const isLevel = (p) => /^.*\bLevel$/i.test(named(p)) && !/boost|input/i.test(named(p))
const ranged = (p) => typeof p?.min === 'number' && typeof p?.max === 'number' && p.max > p.min

/** The block's own level out of its settings: the one called exactly "Level", else the first that ends in it; null with none. */
export function blockLevel(params) {
  const list = Array.isArray(params) ? params : []
  return list.find((p) => /^Level$/i.test(named(p))) || list.find(isLevel) || null
}

/** Whether a level is in decibels: by its unit when it says one, by its name when it says none. */
export function levelInDecibels(level) {
  if (!ranged(level) || !isLevel(level)) return false
  const unit = String(level.unit || '').trim()
  return unit ? /db/i.test(unit) : true
}

/** The lowest that may be typed: the floor, or the level's own bottom where that is higher. */
export const levelFloor = (level) => Math.max(typeof level?.min === 'number' ? level.min : LEVEL_FLOOR_DB, LEVEL_FLOOR_DB)

/** Whether the level can be typed: in decibels, with room over the floor. */
export const levelTypes = (level) => levelInDecibels(level) && level.max > levelFloor(level)

/** What a typed number becomes on its way to the unit: held between the floor and the level's own top. Not a number: null, and nothing is sent. */
export function levelToSend(level, typed) {
  const n = Number(typed)
  if (!levelTypes(level) || typed === null || typed === '' || !Number.isFinite(n)) return null
  return Math.min(level.max, Math.max(levelFloor(level), n))
}
