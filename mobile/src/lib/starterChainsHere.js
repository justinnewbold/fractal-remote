/*
 * STARTER CHAINS, already told where the bytes live (shared/starter-chains
 * has the rules and takes its storage as an argument; this binds the
 * phone's own, as lib/notesHere does for song notes).
 *
 * ONE DRAWER PER UNIT: the unit's own, or in the demo the demo's
 * (shared/device-slug stageKey), asked at the moment of each read and write,
 * so a chain made in the demo never lands on a real unit's list. Kept on
 * this device only.
 */
import { useMemo } from 'react'
import { sync, useStored } from './store'
import { isDemo } from './demo'
import { DEFAULT_SLUG, stageKey } from './device-slug'
import { getState, useRig } from './rig'
import {
  addStarter,
  adoptStarters,
  keepPalette,
  moveStarter,
  paletteKept,
  removeStarter,
  renameStarter,
  replaceStarterBlocks,
  roomForStarter,
  setDefaultStarter,
  starterList
} from './starter-chains'

const drawer = (device = getState().deviceSlug) => stageKey(device, isDemo())

export const startersHere = () => starterList(sync, drawer())
export const addStarterHere = (chain) => addStarter(sync, drawer(), chain)
export const renameStarterHere = (id, name) => renameStarter(sync, drawer(), id, name)
export const replaceStarterHere = (id, blocks) => replaceStarterBlocks(sync, drawer(), id, blocks)
export const removeStarterHere = (id) => removeStarter(sync, drawer(), id)
export const moveStarterHere = (id, by) => moveStarter(sync, drawer(), id, by)
export const defaultStarterHere = (id) => setDefaultStarter(sync, drawer(), id)
export const roomForStarterHere = () => roomForStarter(sync, drawer())
/** The unit's list of blocks, as last read here: what a picker offers with no unit linked. */
export const keepPaletteHere = (palette) => keepPalette(sync, drawer(), palette)
export const paletteKeptHere = () => paletteKept(sync, drawer())

const ofSlug = (s) => s.deviceSlug

/**
 * Chains made with no unit known yet (Settings, on the couch) are filed
 * under no unit's name, and a unit's own drawer never opened that one. So
 * the first real unit Quick build is offered on takes them (shared
 * adoptStarters). CALLED ONLY BY QUICK BUILD, once a real unit has just
 * answered with its list of blocks: never on a slug alone, which outlives
 * the demo (the rig keeps the demo unit's after it is left) and is also set
 * by units with no Quick build at all (a VP4). Never in the demo, whose
 * drawer is its own. One thing it cannot tell apart: a real unit that
 * answered without naming itself files under the same name as no unit.
 */
export function adoptUnlinkedHere(device = getState().deviceSlug) {
  if (isDemo() || !device || device === DEFAULT_SLUG) return 0
  return adoptStarters(sync, stageKey(DEFAULT_SLUG, false), stageKey(device, false))
}

/** This unit's starter chains, the default first, drawn again whenever they change. */
export function useStarterChains() {
  const rev = useStored()
  const slug = useRig(ofSlug)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => starterList(sync, drawer(slug)), [rev, slug])
}
