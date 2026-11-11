import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { WATCH_PAGES, watchKnows, watchPageHid, watchPageMoved, watchPagesKept } from './watch-link'
import { logDebug } from './debugLog'

/*
 * THE WATCH'S PAGES, AS CHOSEN, KEPT ON THE IPHONE.
 *
 * "On the watch, can we add a way for a user to select which order their
 * pages show up in on the Watch app?" and "Yes, add hiding pages." (Justin,
 * 11 November 2026.) The rules and who they are sent to are lib/watch-link's
 * (shared/watch-link.mjs, THE WATCH'S PAGES); this is the phone keeping
 * three things on the device:
 *
 *   the order   the pages as chosen in Settings → Apple Watch → Watch
 *               pages, repaired to every page whatever was kept: the shown
 *               ones in their order, then the hidden ones. The first is the
 *               page the watch opens on.
 *   hidden      the pages not drawn on the watch. Never every one: the last
 *               shown page cannot be hidden, and a kept list that names
 *               them all is read as none.
 *   what the    the last thing the watch said it knows, in its hello
 *   watch knows (lib/watchBridge takes it there). `pages` among them is the
 *               watch saying it draws the pages it is told, in the order it
 *               is told; `tempo`, that it has the Tempo page; `stay`, that
 *               it can leave the tuner on when its page is left.
 *   stays       the "stays on when you swipe away" switch for the watch's
 *               tuner (Settings → Apple Watch, components/WatchTunerStays).
 *               Off unless it is turned on.
 *
 * INERT UNTIL A WATCH SAYS SO. A watch from before the build that carries
 * this draws its four pages in the usual order whatever it is sent, and says
 * nothing of what it knows. So until one says `pages`, Settings shows
 * nothing for this (`can` is false) and the picture carries neither field
 * (pagesToSend is null), until one says `tempo` it carries no tempo
 * either (watchHasTempo), and until one says `stay` the tuner's switch is
 * neither shown nor sent (tunerStaysToSend is null): for everybody today,
 * nothing here does anything.
 *
 * Kept on the device, like the metronome's setting: the watch is paired with
 * this iPhone, not with the account.
 */

const ORDER_KEY = 'fractal.watch.pages'
const HIDDEN_KEY = 'fractal.watch.hidden'
const KNOWS_KEY = 'fractal.watch.knows'
const STAYS_KEY = 'fractal.watch.tunerStays'

let order = WATCH_PAGES
let hidden = []
let knows = []
let stays = false
let both = { order, hidden, can: false, stays, canStay: false }
const watchers = new Set()

const announce = () => {
  both = { order, hidden, can: knows.includes('pages'), stays, canStay: knows.includes('stay') }
  for (const fn of watchers) fn()
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

/* Whether a hello has been heard since the app started: its answer is newer than anything kept. */
let heard = false

AsyncStorage.multiGet([ORDER_KEY, HIDDEN_KEY, KNOWS_KEY, STAYS_KEY])
  .then((kept) => {
    const read = (key) => {
      try {
        return JSON.parse(kept.find(([k]) => k === key)?.[1] || 'null')
      } catch {
        return null
      }
    }
    ;({ order, hidden } = watchPagesKept(read(ORDER_KEY), read(HIDDEN_KEY)))
    /* On only if it was kept as on: anything else, and nothing kept, is off. */
    stays = read(STAYS_KEY) === true
    /* A hello that came in before the read finished is newer than what was kept. */
    if (!heard) knows = watchKnows(read(KNOWS_KEY))
    announce()
  })
  .catch(() => {})

/** Whether the watch has said it draws the pages it is told, in the order it is told. */
export const watchOrdersPages = () => knows.includes('pages')

/** Whether the watch has said it checks in while it is on screen (its hello's `here`), so the iPhone is held awake while the watch is looked at. */
export const watchChecksIn = () => knows.includes('here')

/** Whether the watch has said it has the Tempo page (its hello's `tempo`): the picture's `tempo` is for that watch only. */
export const watchHasTempo = () => knows.includes('tempo')

/** What goes in the picture: the order and the hidden pages, for a watch that has said it does this; null, and neither field, for any other. */
export const pagesToSend = () => (watchOrdersPages() ? { pages: order, hidden } : null)

/** What goes in the picture for the tuner's switch: on or off, for a watch that has said it knows `stay`; null, and no field, for any other. */
export const tunerStaysToSend = () => (knows.includes('stay') ? stays : null)

/** The tuner's "stays on when you swipe away" switch, on or off. Kept on the device, like the pages. */
export function setTunerStays(on) {
  const next = on === true
  if (next === stays) return
  stays = next
  announce()
  AsyncStorage.setItem(STAYS_KEY, JSON.stringify(stays)).catch(() => {})
}

/** { order, hidden, can, stays, canStay }: the pages as chosen and the tuner's switch, and whether the watch can take each. Settings draws from it, and the bridge sends from it. */
export function useWatchPages() {
  return useSyncExternalStore(
    (fn) => {
      watchers.add(fn)
      return () => watchers.delete(fn)
    },
    () => both,
    () => both
  )
}

function keep(next) {
  const fixed = watchPagesKept(next.order, next.hidden)
  if (same(fixed.order, order) && same(fixed.hidden, hidden)) return
  ;({ order, hidden } = fixed)
  announce()
  AsyncStorage.multiSet([
    [ORDER_KEY, JSON.stringify(order)],
    [HIDDEN_KEY, JSON.stringify(hidden)]
  ]).catch(() => {})
}

/** One shown page a place up (-1) or down (+1) among the shown ones. */
export const moveWatchPage = (name, by) => keep(watchPageMoved(order, hidden, name, by))

/** One page hidden (true) or shown again (false). The last shown page stays. */
export const hideWatchPage = (name, hide) => keep(watchPageHid(order, hidden, name, hide))

/** Every page, in the usual order. */
export const usualWatchPages = () => keep({ order: WATCH_PAGES, hidden: [] })

/**
 * What the watch said it knows, from its hello: kept, so the rows are there
 * the next time Settings is opened with the watch out of reach. A hello
 * that says nothing is a watch from before, and takes the answer back.
 */
export function noteWatchKnows(list) {
  heard = true
  const next = watchKnows(list)
  if (same(next, knows)) return
  knows = next
  logDebug('watch', 'the watch says it knows', next.length ? next.join(', ') : 'nothing new')
  announce()
  AsyncStorage.setItem(KNOWS_KEY, JSON.stringify(knows)).catch(() => {})
}
