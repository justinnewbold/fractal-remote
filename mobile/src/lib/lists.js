/**
 * Setlists and stars, already told where the bytes live.
 *
 * The shared modules take their storage as a last argument so the browser can
 * hand them localStorage and the phone can hand them something else. That is
 * the right shape for the modules and the wrong one for a screen: every call
 * site would end in `, sync`, and the one that forgot would not fail — it would
 * quietly read the browser's storage, which on a phone is nothing at all. An
 * empty setlist and a setlist nobody looked up are the same picture.
 *
 * So the binding happens once, here, and screens import from this file.
 *
 * WHAT IS NOT WRAPPED is anything pure. `orderFor`, `stepTarget`, `positionIn`,
 * `nextWords`, `previousWords`, `sourceLabel`, `addTo`, `removeFrom` and `moveIn` are handed
 * what they need and touch no storage, so they pass straight through and are
 * re-exported as they are.
 *
 * AND WHICH DRAWER, ALSO ONCE, HERE. The demo's FM3 and a real FM3 are both
 * 'fm3', so the demo was starring and editing the real unit's presets and
 * setlists, and a star tapped in the demo before a sign-in replaced the
 * account's real stars at the first sync (the 2 November 2026 audit). In the
 * demo every function below reads and writes the demo's own drawer instead
 * (shared/device-slug stageKey: `fm3:demo`, as the preset names already are),
 * which never goes to the account. Asked at the moment of each read and
 * write, not when the screen was drawn, so a tap can never land in the real
 * unit's drawer while the demo is on; App redraws every screen when the demo
 * goes on or off (useDemo), so what is drawn follows it.
 */
import { sync } from './store'
import { isDemo } from './demo'
import { stageKey } from './device-slug'
import {
  ALL,
  STARRED,
  createList as createListIn,
  deleteList as deleteListIn,
  listsFor as listsForIn,
  setSource as setSourceIn,
  sourceFor as sourceForIn,
  updateList as updateListIn
} from './setlists'
import {
  marksFor as marksForIn,
  remember as rememberIn,
  toggleFavourite as toggleFavouriteIn
} from './presetMarks'

export { ALL, STARRED } from './setlists'
export { addAll, addTo, applySong, moveIn, nextWords, orderFor, pickMatches, positionIn, previousWords, removeFrom, songFor, songIn, songsWith, songWords, sourceLabel, stepTarget, togglePick, NEXT_WRAPS, PREVIOUS_WRAPS, SCENES, SONG_BPM } from './setlists'
export { deviceSlug } from './device-slug'

/* The drawer for this unit: its own, or in the demo the demo's. */
const drawer = (device) => stageKey(device, isDemo())

/** Every setlist this unit has, in the order they were made. */
export const listsFor = (device) => listsForIn(drawer(device), sync)

/** What Previous and Next step through: 'all', 'starred', or a setlist's id. */
export const sourceFor = (device) => sourceForIn(drawer(device), sync)

/** Change it. Returns what it now is, which is not always what was asked for. */
export const setSource = (device, source) => setSourceIn(drawer(device), source, sync)

/** A new, empty setlist, named for you. */
export const createList = (device, name) => createListIn(drawer(device), name, sync)

/** Rename one, or replace the songs in it. */
export const updateList = (device, id, patch) => updateListIn(drawer(device), id, patch, sync)

/** Remove one, leaving the mark that stops the Mac's copy coming back. */
export const deleteList = (device, id) => deleteListIn(drawer(device), id, sync)

/** What is starred on this unit, and what was played recently. */
export const marksFor = (device) => marksForIn(drawer(device), sync)

/** Star or unstar a slot. Returns the stars as they now stand. */
export const toggleFavourite = (device, n) => toggleFavouriteIn(drawer(device), n, sync)

/** Note that a slot was loaded, for the recents list. */
export const remember = (device, n) => rememberIn(drawer(device), n, sync)
