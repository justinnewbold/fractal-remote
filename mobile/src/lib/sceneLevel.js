/*
 * THIS SCENE'S LEVEL, AND WHICH OUTPUT THE VOLUME MOVES.
 *
 * "Scenes levels and IN and OUT blocks" (a customer with an FM9 over
 * Bluetooth through a WIDI Master, 16 November 2026). On an FM3, FM9 and
 * Axe-Fx III a scene's own volume is a setting of the Output block: Scene 1
 * Level to Scene 8 Level, -20 to +20 dB with 0 in the middle (ids 18 to 25
 * on all three, by each unit's own catalog: lib/fm3-knobs.js,
 * lib/fm9-knobs.js, lib/axefx3-knobs.js). The app read them with every read
 * of the Output block and never drew one: Edit keeps every setting named
 * "...Level" off its knobs (lib/guardrails isSilencingParam), and the
 * volume pop-up moved the block's own Level alone.
 *
 * So, for an account lib/bluetooth outputAndSceneLevels opens (his, until
 * lib/features OUTPUT_AND_SCENE_LEVELS_FOR_EVERYONE):
 *
 *   - the volume pop-up (components/Volume) has a row for the scene the
 *     unit is on: its level, and − and + a whole dB at a time, written as
 *     any knob is (lib/device setParam, then setParamConfirmed);
 *   - Edit's Output block has the eight as typed boxes (screens/Edit,
 *     `sceneRows`), never knobs: a level is typed, never dragged
 *     (lib/blockLevel);
 *   - and the volume moves Output 1, whatever order the chain lists the
 *     Output blocks in (`volumeOutput`).
 *
 * THE RULES, which are the main level's (lib/volume, lib/blockLevel):
 * never below the floor (LEVEL_FLOOR_DB, which is also a scene level's own
 * bottom, so a scene level can never silence a preset); never past its own
 * top; and never stepped from a level that is not known. A value outside
 * the range is not sent at all rather than pulled into it.
 *
 * WHICH SCENE IS BY NAME, never by a number worked out here: "Scene 3
 * Level" out of the read the unit's own catalog named. A unit or a computer
 * app whose read names no such setting gets no row.
 *
 * Nothing here imports anything but lib/blockLevel's floor, so the tests
 * run it as it is.
 */
import { LEVEL_FLOOR_DB } from './blockLevel.js'

/** How many scenes an FM3, FM9 or Axe-Fx III has, and so how many levels its Output block keeps. */
export const SCENE_LEVELS = 8

/** A scene's level by the name the unit's catalog gives it: "Scene 1 Level" for the first (index 0). */
export const sceneLevelName = (index) => `Scene ${index + 1} Level`

/** One press of − or +: a whole dB, as the main level's buttons (lib/volume volumeNudge). */
export const SCENE_NUDGE_DB = 1

/* Where a press lands: on the half dB, as the main level's slider does (lib/volume volumeStep). */
const STEP_DB = 0.5

const ranged = (p) => !!p && Number.isInteger(p.id) && typeof p.min === 'number' && typeof p.max === 'number' && p.max > p.min
const known = (v) => typeof v === 'number' && Number.isFinite(v)

/** The scene's own level out of the Output block's read, by its name; null for no scene (an index the unit has not said names none), or a read with none. */
export function sceneLevelParam(named, sceneIndex) {
  /* A whole number or nothing: "Scene ${null + 1}" is Scene 1, and a scene not said is never scene 1. */
  if (!Number.isInteger(sceneIndex)) return null
  const want = sceneLevelName(sceneIndex)
  return (Array.isArray(named) ? named : []).find((p) => ranged(p) && String(p.name || '').trim() === want) || null
}

/** Every scene's level the read names, in scene order, each with the scene it is for (`index`, from 0): Edit's Output block. */
export function sceneLevelParams(named) {
  const out = []
  for (let i = 0; i < SCENE_LEVELS; i++) {
    const p = sceneLevelParam(named, i)
    if (p) out.push({ ...p, index: i })
  }
  return out
}

/** The lowest a scene level is sent: the floor, or its own bottom where that is higher. */
export const sceneFloor = (p) => Math.max(ranged(p) ? p.min : LEVEL_FLOOR_DB, LEVEL_FLOOR_DB)

/** A value that may go to the unit for this scene level: a number inside the floor and its own top. Anything else is null, and nothing is sent. */
export function sceneLevelToSend(p, value) {
  if (!ranged(p) || !known(value)) return null
  if (value < sceneFloor(p) || value > p.max) return null
  return Math.round(value * 100) / 100
}

/**
 * Where one press of − (`direction` -1) or + (1) lands, from the level as
 * last known: on the half dB, held at the floor and the top. Null, and
 * nothing is sent, from a level that is not known, or at the end the press
 * points past.
 */
export function sceneNudged(from, p, direction) {
  if (!ranged(p) || !known(from) || (direction !== 1 && direction !== -1)) return null
  const step = Math.round((from + SCENE_NUDGE_DB * direction) / STEP_DB) * STEP_DB
  const next = Math.min(p.max, Math.max(sceneFloor(p), Math.round(step * 1000) / 1000))
  return next === from ? null : sceneLevelToSend(p, next)
}

/** Output 1: the Output block with the lowest effect id (42 on an FM3, FM9 and Axe-Fx III), whatever order the chain lists them in. */
export function outputOne(blocks) {
  let one
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (b?.slug !== 'output' || !Number.isInteger(b.effectId)) continue
    if (!one || b.effectId < one.effectId) one = b
  }
  return one
}

/**
 * The Output block the volume moves, for the speaker and the pop-up alike:
 * Output 1 for an account the switch opens (`open`); for every other
 * account, the first Output block the chain lists, as it always was.
 */
export const volumeOutput = (blocks, open) => (open === true ? outputOne(blocks) : (blocks || []).find((b) => b?.slug === 'output'))

/**
 * The scene levels Edit draws in an Output block, as typed boxes (screens/Edit
 * BlockPanel): for an account the levels are open to (`open`), in an Output
 * block, the ones its read names. Any other block, and every other account:
 * none, and Edit draws what it always drew.
 */
export const sceneRowsFor = (slug, named, open) => (open === true && slug === 'output' ? sceneLevelParams(named) : [])
