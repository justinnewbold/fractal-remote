import { useEffect, useState } from 'react'

import { COLOURS_NOTICE } from '../lib/colourPage'
import { isFractalRemoteLook } from '../lib/looks'

/*
 * "Match your unit’s colors in Settings", once — the phone's key, in this
 * browser's own storage. A new key on 19 October 2026: the line before it
 * ("Colours now match your unit", under 'fractal.coloursNoticed') said
 * something that stopped being true when Fractal Remote became the default
 * look, so everybody hears this one once, whoever heard that one.
 * Remembered in memory too, so a private window, whose storage throws on a
 * write, still says it only once in the visit.
 */
const KEY = 'fractal.coloursOffer.v1'
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
 * WHERE THE UNIT'S COLOURS ARE, SAID ONCE, ON PLAY.
 *
 * "Can we change it so the fractal remote colors scene is the default? But
 * then the first time the app loads, also let people know that they can
 * change the theme to match their actual unit in settings?" The tiles start
 * in the app's own colours (Fractal Remote) now, and Match my unit is a look
 * on Settings → Colors. Pressing the line opens that page (`onOpen`, from
 * App through Gig); its cross puts it away.
 *
 * For a first visit too, after the startup card and the walkthrough, which
 * is where somebody new meets it. Only to somebody wearing Fractal Remote:
 * somebody who chose another look has found the page already, so the line is
 * put away for him unsaid, the moment it would have been his turn.
 *
 * Remembered the moment it is shown rather than when it is put away, like the
 * phone's: one visit with it at the top of Play, never a line that stays above
 * the preset name for good because nobody pressed its cross. And it waits
 * while another of Play's one-time notes is up (`waiting`) — one note at a
 * time, as the hold tip waits for the demo's — and while the startup card,
 * the walkthrough or the sign-in sheet is (App's `noteAbove`), so it is never
 * said, and never remembered, under any of them. Once shown it steps aside
 * for a note that comes up after it (the hold tip waits for a unit that has
 * channels), and is back when that one is put away.
 */
export default function ColoursNotice({ waiting = false, onOpen }) {
  const [shown, setShown] = useState(visit === 'showing')
  /* Gig repaints on a change of look (useLooks), and this with it. */
  const elsewhere = !isFractalRemoteLook()

  useEffect(() => {
    if (visit === 'gone') return undefined
    if (elsewhere) {
      /* Another look, chosen: he has been to the page. Put away for good, at his turn or once said. */
      if (visit === 'showing' || !(waiting || coloursNoticeSeen())) {
        markColoursNotice()
        visit = 'gone'
        setShown(false)
      }
      return undefined
    }
    if (visit === 'showing') return setShown(true)
    if (waiting || coloursNoticeSeen()) return undefined
    markColoursNotice()
    visit = 'showing'
    setShown(true)
    return undefined
  }, [waiting, elsewhere])

  if (!shown || waiting || elsewhere) return null

  const away = () => {
    visit = 'gone'
    setShown(false)
  }

  return (
    <p className="play-hint colours-notice" role="status">
      <button
        type="button"
        className="colours-notice-open"
        onClick={() => {
          away()
          onOpen?.()
        }}
      >
        {COLOURS_NOTICE}
      </button>
      <button type="button" className="chip colours-notice-close" aria-label="Dismiss" onClick={away}>
        <span aria-hidden="true">×</span>
      </button>
    </p>
  )
}

/*
 * THIS VISIT'S ANSWER, kept outside the screen. Play is drawn afresh more than
 * once while a unit comes up — the chain read, a reconnect — and a line marked
 * seen the first time it was drawn would be gone by the time anybody looked.
 * So it stays for the whole visit once shown, as the phone's stays for the
 * launch, until it is pressed or put away. The next visit, it is seen.
 */
let visit = null
