/**
 * Hold a thing, or right-click it.
 *
 * "If you can hold one of the effects for a few seconds, it would be cool to
 * have a pop-up where you can quickly switch channels from ABCD. If the web
 * version doesn't support it at least do it on the mobile iOS and android
 * versions. On the Mac version, maybe we can do a right click."
 *
 * The web supports it, on all three. A hold is a pointer that goes down and
 * stays put, which is arithmetic, and a right-click is an event browsers have
 * always sent. Nothing here needs a native app — which matters, because the
 * phone apps do not exist yet and this works on the page they would wrap.
 *
 * Pointer events rather than touch events, deliberately. The three surfaces in
 * this app that bind `touchstart` themselves each carry a paragraph explaining
 * why, and the reason is always the same: React registers touch listeners as
 * passive, so cancelling the gesture means going around React. A hold never
 * needs to cancel anything — it only needs to know the finger did not move —
 * so it stays inside React and out of that whole category of bug.
 */
import { useCallback, useEffect, useRef } from 'react'

/** How long is a hold. Long enough not to fire on a tap, short enough to feel deliberate. */
export const HOLD_MS = 450

/**
 * How far a finger may wander and still count as holding still.
 *
 * Not zero: a thumb on a tile resting against a guitar moves a few pixels
 * without anybody intending it to. Past this it is a scroll, and a scroll that
 * opens a menu is worse than a hold that does not.
 */
export const HOLD_SLOP = 10

/**
 * Whether this press can become a hold.
 *
 * A right-click has its own path, and a middle-click is not a hold — but a
 * touch and a pen report no meaningful button, so only a mouse is asked.
 */
export const holdStarts = (e) => !(e.pointerType === 'mouse' && e.button !== 0)

/** Whether the finger has wandered far enough to be scrolling rather than holding. */
export function movedOut(from, x, y) {
  if (!from) return false
  return Math.hypot(x - from.x, y - from.y) > HOLD_SLOP
}

/** How long after the finger lifts a click may still come from it. */
export const SWALLOW_MS = 400

/* Heard on the way down, before anything on the page; written as an object, which every EventTarget reads alike on the way off too. */
const CAPTURE = { capture: true }

/**
 * AND THE CLICK A HOLD ENDS IN, WHEREVER IT LANDS.
 *
 * The held thing's own onClickCapture (below) only hears a click aimed at
 * it. After a touch the browser aims that click at whatever is under the
 * finger when it lifts — and a hold that opened something over the finger
 * has put that something there. In the preset list a hold opens the colour
 * sheet, and the lift pressed whatever square or button of it was under the
 * thumb: Use it, and the preset was red before anybody had chosen a colour.
 * On Play it would be a channel picked from the menu the hold opened.
 *
 * So from the moment a hold fires with the finger still down, the next click
 * anywhere on the page is swallowed, once. It stands down at the next press,
 * or a moment after the finger lifts if no click came: a click that never
 * arrives must not take the Enter key's click on the sheet later. `done` is
 * told when it stands down, either way. Returns the way to stand it down now.
 */
export function swallowNextClick(on, { ms = SWALLOW_MS, done } = {}) {
  if (!on?.addEventListener) return () => {}
  let timer = null
  let over = false
  const off = () => {
    if (over) return
    over = true
    clearTimeout(timer)
    on.removeEventListener('click', eat, CAPTURE)
    on.removeEventListener('pointerdown', off, CAPTURE)
    on.removeEventListener('pointerup', soon, CAPTURE)
    on.removeEventListener('pointercancel', soon, CAPTURE)
    done?.()
  }
  function eat(e) {
    e.preventDefault()
    e.stopPropagation()
    off()
  }
  function soon() {
    clearTimeout(timer)
    timer = setTimeout(off, ms)
  }
  on.addEventListener('click', eat, CAPTURE)
  on.addEventListener('pointerdown', off, CAPTURE)
  on.addEventListener('pointerup', soon, CAPTURE)
  on.addEventListener('pointercancel', soon, CAPTURE)
  return off
}

/**
 * Returns props to spread on the element that can be held.
 *
 * `onLong` is called once per press, from the timer or from a right-click,
 * never twice for the same one — Android fires its own contextmenu on a long
 * press, which would otherwise open the thing and immediately reopen it.
 *
 * The click that a press produces afterwards is swallowed, wherever it lands
 * (swallowNextClick, above). Without that, the tile you held to change its
 * channel also toggles the block off, which on a stage is the failure that
 * matters: silence, mid-song, from a gesture meant to be safe.
 */
export function useLongPress(onLong, { enabled = true } = {}) {
  const timer = useRef(null)
  const from = useRef(null)
  const fired = useRef(false)
  const latest = useRef(onLong)
  latest.current = onLong

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    from.current = null
  }, [])

  // A component that unmounts mid-press must not wake up 450ms later.
  useEffect(() => stop, [stop])

  const fire = useCallback(() => {
    /* Still pressing: the timer, or Android's own long-press menu arriving
       with the finger down. A right-click comes with no press behind it,
       and no click after it either. */
    const pressing = from.current !== null
    stop()
    if (pressing) {
      fired.current = true
      swallowNextClick(globalThis.window, {
        done: () => {
          fired.current = false
        }
      })
    }
    latest.current?.()
  }, [stop])

  if (!enabled) {
    /* Nothing to hold: a tile with no channels opens an empty menu, which is
       worse than a gesture that does nothing. The click still works. */
    return {}
  }

  return {
    onPointerDown: (e) => {
      /* Only the plain press. A right-click has its own path below, and a
         middle-click is not a hold. */
      if (!holdStarts(e)) return
      fired.current = false
      /* Any press before this one put away first, then this one's start kept:
         the other way round, stop() forgot where the finger went down, so a
         drag never stopped a hold and a hold never knew a finger was on it. */
      stop()
      from.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(fire, HOLD_MS)
    },
    onPointerMove: (e) => {
      if (!from.current) return
      if (movedOut(from.current, e.clientX, e.clientY)) stop()
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onContextMenu: (e) => {
      /* Two jobs. On a desktop this is the right-click the request asked for.
         On Android it is the long-press menu the browser would have shown over
         the top of ours, and preventing it is the only way to stop that. (iOS
         sends no contextmenu at all; its callout is suppressed in CSS.) */
      e.preventDefault()
      if (fired.current) return
      fire()
    },
    onClickCapture: (e) => {
      if (!fired.current) return
      /* The press already did something. Letting the click through as well
         would toggle the block — silence, mid-song, from a safe gesture. */
      e.preventDefault()
      e.stopPropagation()
      fired.current = false
    }
  }
}
