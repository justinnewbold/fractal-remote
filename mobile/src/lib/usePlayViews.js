import { useSyncExternalStore } from 'react'

import { useBluetoothAdmin } from './bluetooth'
import { PLAY_VIEWS_FOR_EVERYONE } from './features'

/**
 * Whether whoever is signed in on this device has Play's views (lib/playView:
 * the round View button on the top bar and the preset tiles on Play): his
 * account, by the sign-in kept here, until features PLAY_VIEWS_FOR_EVERYONE.
 */
export const usePlayViews = () => {
  const his = useBluetoothAdmin()
  return PLAY_VIEWS_FOR_EVERYONE || his
}

/*
 * HOW PLAY IS HELD, said by Play itself (screens/Stage, from its own shape)
 * and read by the View sheet on the top bar, so the two never disagree about
 * which posture's view is being chosen. And what the tiles fell back to.
 */
let now = { posture: 'phone', fell: null }
const heard = new Set()
export function notePlayPosture(posture, fell = null) {
  if (now.posture === posture && now.fell === fell) return
  now = { posture, fell }
  for (const fn of heard) fn()
}
const subscribe = (fn) => {
  heard.add(fn)
  return () => heard.delete(fn)
}
const get = () => now
export const usePlayPosture = () => useSyncExternalStore(subscribe, get, get)
