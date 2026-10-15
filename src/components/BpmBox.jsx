import { useRef, useState } from 'react'
import { checkBpm } from '../../shared/tempo.mjs'

/**
 * The tempo readout you can type into.
 *
 * Tap gets you close; typing gets you exact. Shows "120 BPM" at rest; a tap
 * into it drops the unit and selects the number so typing replaces it. Enter
 * or tapping away commits, Escape abandons, and the unit's own range (24–250 on a Fractal)
 * is enforced (in shared/tempo.mjs, with the phone apps) so an impossible
 * tempo is refused with words rather than silently clamped downstream.
 *
 * It lived in App.jsx with nothing rendering it. Now it is the box that opens
 * when the Tap button is held or right-clicked, so it takes `autoFocus` and
 * tells its owner when it is finished either way.
 *
 * "Make it so it highlights it so that they can just start typing." The
 * number is in the field from its first render and selected the moment the
 * field has focus — by setSelectionRange, which Safari on an iPhone honours
 * where select() has not always been, and once more on the press that put
 * the focus there: Safari moves the cursor to the finger when that press
 * lets go, undoing the selection it had just been given, unless the let-go
 * is stopped from doing it.
 *
 * And once more on the first press into the field after the box opens,
 * whether or not that press is the one that focused it. On an iPhone the
 * box opens from the hold's timer, not from a touch, and Safari gives the
 * field focus then but no keyboard: the player has to tap the field to type,
 * and that tap lands on a field that already has focus — so it is not a
 * focusing press, it brings up no focus event, and it put the cursor at the
 * finger: "120|", the very thing that was asked to go. So until something is
 * typed, the first press into the field selects the number again, and again
 * just after its own events, because an iPhone places its caret after them.
 * Only the first: a second press is somebody putting the cursor somewhere.
 *
 * `keepOpen` is asked when the field loses focus to something other than
 * Enter or Escape. The Tap box holds the metronome switch too, and pressing
 * that used to be a blur like any other: the tempo was sent and the box shut
 * under the finger reaching for the switch.
 */
export default function BpmBox({ bpm, onSet, onError, onDone, autoFocus = false, range, keepOpen }) {
  const [text, setText] = useState(autoFocus && Number.isFinite(bpm) ? String(Math.round(bpm)) : null)
  const abandon = useRef(false)
  /* Enter, on its way out: a set, whatever keepOpen would say. */
  const entered = useRef(false)
  /* The press that is focusing the field, whose let-go must not move the cursor. */
  const pressFocus = useRef(false)
  /* Nothing typed and nothing pressed in the field since the box opened (see above). */
  const fresh = useRef(autoFocus)

  const finish = () => {
    if (abandon.current) {
      abandon.current = false
      setText(null)
      onDone?.()
      return
    }
    if (text === null) return
    const typed = text
    setText(null)
    const checked = checkBpm(typed, range)
    if (checked.error) {
      onError?.(checked.error)
    } else if (checked.bpm !== undefined && checked.bpm !== Math.round(bpm)) {
      onSet(checked.bpm)
    }
    onDone?.()
  }

  return (
    <input
      className="bpm-box mono"
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      value={text !== null ? text : Number.isFinite(bpm) ? `${Math.round(bpm)} BPM` : ''}
      placeholder="BPM"
      onFocus={(e) => {
        if (text === null) setText(Number.isFinite(bpm) ? String(Math.round(bpm)) : '')
        const el = e.target
        /* After the value above has been drawn, so all of it is selected. */
        requestAnimationFrame(() => selectAll(el))
      }}
      onMouseDown={(e) => {
        pressFocus.current = document.activeElement !== e.currentTarget
      }}
      onMouseUp={(e) => {
        if (!pressFocus.current && !fresh.current) return
        pressFocus.current = false
        e.preventDefault()
        const el = e.currentTarget
        selectAll(el)
        if (!fresh.current) return
        /* After this press's own events, once, and then the cursor is the player's. */
        setTimeout(() => {
          if (fresh.current) selectAll(el)
          fresh.current = false
        }, 0)
      }}
      onChange={(e) => {
        fresh.current = false
        setText(e.target.value.replace(/[^0-9]/g, ''))
      }}
      onBlur={(e) => {
        if (!entered.current && !abandon.current && keepOpen?.(e)) return
        entered.current = false
        finish()
      }}
      onKeyDown={(e) => {
        fresh.current = false
        if (e.key === 'Enter') {
          entered.current = true
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          abandon.current = true
          e.currentTarget.blur()
        }
      }}
      aria-label="Tempo in BPM"
    />
  )
}

/** The whole number, selected. setSelectionRange rather than select(): see above. */
export function selectAll(el) {
  if (!el || document.activeElement !== el) return
  el.setSelectionRange(0, el.value.length)
}
