import { useRef, useState } from 'react'
import { SWIPE_CLAIM, SWIPE_OPEN, swipeLanding } from '../../shared/swipe-hint.mjs'
import { tick as haptic } from '../lib/feedback'

/**
 * A list row that swipes left to remove — the phone's SwipeAway, in the browser.
 *
 * "Make it so you can swipe left on a song in the set list to delete it and
 * then remove the exes from the right side of the hamburger drag icon." The
 * phone already worked this way; the browser still carried a ✕ on every row.
 *
 * Same gesture, same numbers (shared/swipe-hint.mjs): a short pull parks the
 * row open over a ✕ to tap, a long pull removes it straight away. Pointer
 * events, so a mouse drag does it on a computer too.
 *
 *   - Never on touch-down, and never from a button inside the row, so the
 *     drag grip keeps its own gesture.
 *   - Only once the movement is clearly sideways: `touch-action: pan-y`
 *     leaves an up-and-down drag to the page, so the sheet still scrolls.
 *   - The ✕ is always in the page, behind the row. Tabbing to it slides the
 *     row open, so the list never needs a pointer to edit.
 *
 * `demo` is the first-time hint: the row slides part of the way open and back
 * until the hint is confirmed.
 */
export default function SwipeRow({ rowRef, wrapClass = '', className = '', style, label, onRemove, demo = false, children }) {
  const [dx, setDx] = useState(0)
  const [moving, setMoving] = useState(false)
  const at = useRef(0)
  const start = useRef(null)
  const face = useRef(null)

  const place = (to) => {
    at.current = to
    setDx(to)
  }

  const away = () => {
    setMoving(false)
    place(-(face.current?.offsetWidth || 400))
    window.setTimeout(() => onRemove?.(), 160)
  }

  const down = (e) => {
    if (e.button > 0 || e.target.closest?.('button')) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, base: at.current, claimed: false }
  }

  const move = (e) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const ddx = e.clientX - s.x
    const ddy = e.clientY - s.y
    if (!s.claimed) {
      if (Math.abs(ddx) > SWIPE_CLAIM && Math.abs(ddx) > Math.abs(ddy) * 2) {
        s.claimed = true
        setMoving(true)
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* the row still moves, it just loses the pointer at its edge */
        }
      } else if (Math.abs(ddy) > SWIPE_CLAIM) {
        start.current = null
      }
      return
    }
    place(Math.min(0, s.base + ddx))
  }

  const up = () => {
    const s = start.current
    start.current = null
    if (!s?.claimed) return
    setMoving(false)
    const landing = swipeLanding(at.current)
    if (landing === 'remove') return away()
    if (landing === 'open') haptic()
    place(landing === 'open' ? -SWIPE_OPEN : 0)
  }

  const cancel = () => {
    const s = start.current
    start.current = null
    setMoving(false)
    if (s) place(s.base)
  }

  return (
    <li ref={rowRef} className={`swipe-row ${wrapClass}`} style={style}>
      <button
        type="button"
        className="swipe-row-remove"
        aria-label={label}
        onFocus={() => place(-SWIPE_OPEN)}
        onBlur={() => {
          if (at.current === -SWIPE_OPEN) place(0)
        }}
        onClick={() => {
          haptic()
          away()
        }}
      >
        ✕
      </button>
      <div
        ref={face}
        className={`${className} swipe-row-face${moving ? ' moving' : ''}${demo && !dx ? ' swipe-demo' : ''}`}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
      >
        {children}
      </div>
    </li>
  )
}
