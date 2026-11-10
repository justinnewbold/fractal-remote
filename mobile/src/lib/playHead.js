import { useSyncExternalStore } from 'react'

/*
 * PLAY'S PRESET AND SETLISTS, WHEN THEY ARE UP IN THE APP'S TOP BAR.
 *
 * On a phone held on its side, Play's preset row goes up into the top bar
 * where that buys bigger squares (lib/sidewaysPlay `headUp`: an AM4's four
 * scenes and four pedals). Play knows what the two buttons say; the top bar
 * is App's. So Play says it here, in plain words and numbers, and
 * components/PlayHead draws it in the bar. Null whenever the row is in
 * Play's own page, which is everywhere else.
 *
 * Only words: what the buttons DO stays with App, which already owns both
 * ways out of Play (All presets, Setlists), so nothing here can open
 * anything by itself.
 */
let head = null
let said = 'null'
const heard = new Set()

/** What the two buttons say now, or null to take them out of the bar. Says nothing when nothing changed. */
export function sayPlayHead(next) {
  const now = JSON.stringify(next ?? null)
  if (now === said) return
  said = now
  head = next ?? null
  for (const hear of heard) hear()
}

const listen = (hear) => {
  heard.add(hear)
  return () => heard.delete(hear)
}
const now = () => head

/** What Play last said, for the bar: `{ preset, sub, edge, setlists, where, on }`, or null. */
export const usePlayHead = () => useSyncExternalStore(listen, now, now)
