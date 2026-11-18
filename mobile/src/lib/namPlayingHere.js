/*
 * WHERE THE UNIT IS, for what the TONE3000 card keeps of which capture a NAM
 * block is on (lib/namPlaying has the rule and its words): the preset and
 * scene on screen, the load of it (`bufferRev`, which moves when the same
 * preset is loaded again and an unsaved pick is thrown away), and whether
 * the link is up. Read off the rig's store and
 * the link; it sends nothing and asks the unit nothing, so the card still
 * reaches a unit by the captures' three calls alone (test/tone3000.mjs).
 */
import { getState, useRig } from './rig'
import { linkState, subscribeLink } from './link'

const presetOf = (st) => st.preset?.number ?? null
const sceneOf = (st) => st.sceneIndex ?? null
const revOf = (st) => st.bufferRev ?? null
const linkedOf = (st) => st?.link === 'connected'

/** Where the unit is now, at a tap or an answer: `{ preset, scene, rev, linked }`. */
export const unitNow = () => ({ preset: presetOf(getState()), scene: sceneOf(getState()), rev: revOf(getState()), linked: linkedOf(linkState()) })
/** The preset and scene on screen, and the load of it, as they change. */
export const usePresetAndScene = () => ({ preset: useRig(presetOf), scene: useRig(sceneOf), rev: useRig(revOf) })
/** Whether the link is up now. */
export const linkedNow = () => linkedOf(linkState())
/** Be told whether the link is up, each time it changes. Returns the way to stop. */
export const watchLinked = (fn) => subscribeLink((st) => fn(linkedOf(st)))
/** The name the rig has for the unit linked ('AM4', 'Axe-Fx III', …): which unit's NAM blocks the Developer page plays in (lib/captureUnit). */
export const useDeviceName = () => useRig((st) => st.deviceName || '')
