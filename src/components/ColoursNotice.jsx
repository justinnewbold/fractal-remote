import { useEffect, useState } from 'react'

import { COLOURS_NOTICE } from '../lib/colourPage'

/*
 * "Colours now match your unit · Settings → Colours", once, after the update
 * that changed them — the phone's key, in this browser's own storage.
 * Remembered in memory too, because the first run marks it during App's very
 * first render and Play must never read the storage as it was before that.
 */
const KEY = 'fractal.coloursNoticed'
let settled = false

export function coloursNoticeSeen() {
  if (settled) return true
  try {
    return localStorage.getItem(KEY) === 'done'
  } catch {
    /* No storage, no way to remember: better never said than said every time. */
    return true
  }
}

export function markColoursNotice() {
  settled = true
  try {
    localStorage.setItem(KEY, 'done')
  } catch {
    // A private window throws; this session still knows (settled).
  }
}

/**
 * THE COLOURS CHANGED, SAID ONCE, ON PLAY.
 *
 * "I feel like the button and effects pedal colors dont match the colors on
 * real fractal units." They match now, which means every tile on the stage
 * came back from one update a different colour. A player who had the old
 * ones in his eye is told why, and where to go — Settings → Colours, where
 * Fractal Remote is the old look exactly, one click away.
 *
 * Remembered the moment it is shown rather than when it is put away, like the
 * phone's: one visit with it at the top of Play, never a line that stays above
 * the preset name for good because nobody pressed Got it. Nothing here for a
 * first run, which never saw the old colours: App marks it then. And it waits
 * while another of Play's one-time notes is up (`waiting`) — one note at a
 * time, as the hold tip waits for the demo's — and while the startup card,
 * the walkthrough or the sign-in sheet is (App's `noteAbove`), so it is never
 * said, and never remembered, under any of them. Once shown it steps aside
 * for a note that comes up after it (the hold tip waits for a unit that has
 * channels), and is back when that one is put away.
 */
export default function ColoursNotice({ waiting = false }) {
  const [shown, setShown] = useState(visit === 'showing')

  useEffect(() => {
    if (visit === 'showing') return setShown(true)
    if (waiting || coloursNoticeSeen()) return undefined
    markColoursNotice()
    visit = 'showing'
    setShown(true)
    return undefined
  }, [waiting])

  if (!shown || waiting) return null

  return (
    <p className="play-hint colours-notice" role="status">
      <span>{COLOURS_NOTICE}</span>
      <button
        type="button"
        className="chip"
        onClick={() => {
          visit = 'gone'
          setShown(false)
        }}
      >
        Got it
      </button>
    </p>
  )
}

/*
 * THIS VISIT'S ANSWER, kept outside the screen. Play is drawn afresh more than
 * once while a unit comes up — the chain read, a reconnect — and a line marked
 * seen the first time it was drawn would be gone by the time anybody looked.
 * So it stays for the whole visit once shown, as the phone's stays for the
 * launch, until Got it. The next visit, it is seen.
 */
let visit = null
