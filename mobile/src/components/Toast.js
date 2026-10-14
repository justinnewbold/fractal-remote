import { useEffect, useState, useSyncExternalStore } from 'react'
import { AccessibilityInfo, Platform, View } from 'react-native'

import { color, radius, space } from '../lib/theme'

/**
 * Something said OVER a screen, never in it.
 *
 * "If you tap too fast on the tap tempo, it moves the screen down and you
 * accidentally hit the next button because it's giving the error the top of
 * the screen. Can we just have it be like an overlay toast notification that
 * doesn't move the screen at all?" A note in the scrolling content is one
 * more row above everything, so every button under it slides down the moment
 * it appears — and a thumb already on its way to Tap lands on Next instead.
 * His log has it twice, 206 and 142 ms after the note came up.
 *
 * So this floats, inside its parent's bounds (unlike TopBar's strips, which
 * hang below the bar), over the top of the screen. It is only as big as what
 * is in it, so a press anywhere else still reaches the screen beneath.
 *
 * ONE CARD AT A TIME, IN THE SAME PLACE. The play screen's fault and its
 * advice already take turns (Stage says so). A toast that `yields` — the
 * new-version note, which App floats over the play screen from outside it —
 * stands aside while any other toast is up, rather than being drawn on top of
 * it or under it, and comes back when that one goes.
 *
 * `onLayout` is the card's own, for a screen that floats something else and
 * must keep it clear of the card: Play's NOT CONNECTED, which on the smallest
 * phones sat under the advice's Troubleshooting button.
 */
export default function Toast({ open, yields = false, onLayout, children }) {
  const others = useSlot(open && !yields)
  if (!open || (yields && others)) return null
  return (
    <View
      onLayout={onLayout}
      style={{
        position: 'absolute',
        top: space.sm,
        left: space.lg,
        right: space.lg,
        zIndex: 2,
        gap: space.xs,
        borderRadius: radius.md,
        backgroundColor: color.chassis,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        /* Above a tile's own 3, so the card is never drawn under a scene. */
        elevation: 6
      }}
    >
      {children}
    </View>
  )
}

/* The toasts up now that do not yield. Never the rig store: hiding a card must not touch what it says. */
const up = new Set()
const slotWatchers = new Set()
const slotTaken = () => up.size > 0
const watchSlot = (fn) => {
  slotWatchers.add(fn)
  return () => slotWatchers.delete(fn)
}

/** Holds the place while `claim` is true; says whether anything holds it. */
function useSlot(claim) {
  useEffect(() => {
    if (!claim) return undefined
    const mine = {}
    up.add(mine)
    for (const fn of slotWatchers) fn()
    return () => {
      up.delete(mine)
      for (const fn of slotWatchers) fn()
    }
  }, [claim])
  return useSyncExternalStore(watchSlot, slotTaken, slotTaken)
}

function useScreenReader() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let live = true
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => live && setOn(Boolean(v)))
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (v) => setOn(Boolean(v)))
    return () => {
      live = false
      sub?.remove?.()
    }
  }, [])
  return on
}

/**
 * Whether `said` is still news: for `left` ms (the caller's rule — see
 * lib/fault-rule faultLeft), and then not. News again whenever `stamp` moves,
 * which is how the same words raised twice get their time twice.
 *
 * It only HIDES. Whatever owns `said` keeps it: the Play screen's fault is
 * also what App reads to tell a rig that failed its first read from one still
 * waking, and a timer that cleared it would swap the screen out from under
 * somebody.
 *
 * Never on a timer with a screen reader on. A message that goes before it can
 * be heard has not been said; it stays until its ✕, as every note did before.
 */
export function useStillNews(said, stamp, left) {
  const reader = useScreenReader()
  const [, recheck] = useState(0)
  const wait = reader ? Infinity : left
  useEffect(() => {
    /* VoiceOver does not read live regions; Note's own covers TalkBack. */
    if (said && wait > 0 && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(said)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [said, stamp])
  useEffect(() => {
    if (!said || !(wait > 0) || wait === Infinity) return undefined
    const t = setTimeout(() => recheck((n) => n + 1), wait)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [said, stamp, reader])
  return Boolean(said) && wait > 0
}
