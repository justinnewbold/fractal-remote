import { useSyncExternalStore } from 'react'

import { notForever } from './notForever'
import { WHATS_NEW_JSON_URL } from './whats-new-rule'

/**
 * THE LINES OF THE UPDATE THAT IS WAITING, read from the website.
 *
 * A downloaded update brings its own What's new lines inside it, so until the
 * restart the list on the phone is the running one's (lib/whats-new-rule.js
 * says why and how the two are put together). This asks the website's copy
 * once for each waiting update, the moment its card is shown, so the page
 * already has it when the card's What's new is tapped.
 *
 * Fails silent, like the store check (lib/storeVersion.js): no signal, a slow
 * website, a file that will not read, and the page shows the phone's own
 * list, exactly as before. Nothing is kept on the phone's storage: after the
 * restart the lines are in the list the update brought.
 */

/** As short as the store check's ask: a page that fills a moment late is fine, one that waits is not. */
const ASK_MS = 8000

let state = { file: null, forVersion: null }
let asked = null
const watchers = new Set()
const set = (next) => {
  state = { ...state, ...next }
  for (const fn of watchers) fn()
}
const subscribe = (fn) => {
  watchers.add(fn)
  return () => watchers.delete(fn)
}
const read = () => state

/** Ask once for the update waiting at `version` (null when its version is not known). Never throws. */
export async function askWaiting(version = null) {
  const key = version || 'unknown'
  if (asked === key) return
  asked = key
  try {
    const res = await notForever(WHATS_NEW_JSON_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' }, ASK_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    set({ file: await res.json(), forVersion: version })
  } catch {
    /* Asked again the next time What's new opens: the page has the phone's own list meanwhile. */
    asked = null
  }
}

/** What the website said, and for which waiting update. */
export const useWaitingList = () => useSyncExternalStore(subscribe, read, read)
