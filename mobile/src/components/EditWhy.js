import Note from './Note'
import Toast, { useStillNews } from './Toast'
import { EDIT_WHY_MS, editThroughComputer } from '../lib/editWords'

/**
 * PLAY'S EDIT, TAPPED WHERE EDIT DOES NOT OPEN over Bluetooth or a USB
 * cable: why, in one line, floated over Play the way the fault card is and
 * never in it, so nothing under a thumb moves (components/Toast). App.js
 * hands the moment of the tap (`at`, zero for none) and whether the unit is
 * on a USB cable; the words are lib/editWords's, the one place they live.
 *
 * For a few seconds (EDIT_WHY_MS), and until its ✕ with a screen reader on
 * (useStillNews). It `yields`: a fault or the computer's advice up on Play
 * keeps its place, and this waits behind it.
 */
export default function EditWhy({ at = 0, cable = false, onDismiss }) {
  const words = at ? editThroughComputer({ cable }) : null
  const left = at ? Math.max(0, at + EDIT_WHY_MS - Date.now()) : 0
  const showing = useStillNews(words, at, left)
  return (
    <Toast open={showing} yields>
      {showing ? (
        <Note tone="warn" onDismiss={onDismiss}>
          {words}
        </Note>
      ) : null}
    </Toast>
  )
}
