import { NOT_AFFILIATED, STARTUP_NOTICE_TITLE, SUPPORT_LINE } from '../../shared/affiliation.mjs'

/*
 * "An independent app", once per browser, in this browser's own storage. The
 * phone's card has its own key in the phone's storage
 * (mobile/src/components/IndependentNotice.js); one browser is one device.
 * Remembered in memory too, so a visit that has pressed OK is never shown it
 * again while the page stays open, whatever the storage does.
 */
const KEY = 'fractal.independent.v1'
let settled = false

export function independentNoticeSeen() {
  if (settled) return true
  try {
    return localStorage.getItem(KEY) === 'done'
  } catch {
    /*
     * No storage (a private window, site data blocked): shown, every visit.
     * The colours note makes the opposite choice, because a note said every
     * time is a nuisance; this one is what Fractal Audio asked to be shown
     * at startup, and the failure that matters is the visit that never saw it.
     */
    return false
  }
}

export function markIndependentNotice() {
  settled = true
  try {
    localStorage.setItem(KEY, 'done')
  } catch {
    // A private window throws; this visit still knows (settled).
  }
}

/**
 * WHOSE APP THIS IS NOT, SAID AT STARTUP, ONCE.
 *
 * Fractal Audio's letter of 18 October 2026 asks for "a clear statement on
 * startup" that the app "is independently developed and is not affiliated
 * with, endorsed by, or supported by Fractal Audio Systems, LLC", and for
 * support through Justin's own channels. The browser, and the computer app,
 * whose window is this same web app, showed a disclaimer only on the
 * walkthrough's first screen and in About, so a returning visitor and every
 * computer already set up never met one.
 *
 * So the phone's card, in the same words: the heading, Fractal's sentence,
 * where help comes from, and OK. Once per browser, under a key of its own, so
 * every browser and computer that had the app before sees it once after this
 * update, and a first visit sees it before the walkthrough.
 *
 * A PAGE OVER EVERYTHING, OPAQUE, WITH THE APP STILL RUNNING UNDER IT. The
 * phone draws its card in place of the other screens. Here it covers them
 * instead, from the first render, so the page's own work (the link to the
 * computer, the update check) carries on while it waits for OK rather than
 * starting only after it. Covered from the first frame, nothing behind it
 * is seen or reached until OK, so it comes before the walkthrough, the
 * connecting screen and Play, and is never laid over a Play somebody was
 * using. The walkthrough waits under it, and is there when it goes.
 *
 * NEVER A DIALOG WHERE NOBODY IS LOOKING. A computer app started with no
 * window (a Raspberry Pi on a pedalboard, `--hidden`) has no page at all
 * until somebody opens the window, so nothing waits on this there: the
 * device server answers the phones regardless, and the card is shown the
 * first time the window is opened. The phone or tablet in the player's hand
 * shows its own.
 */
export default function IndependentNotice({ onDone }) {
  return (
    <div className="independent" role="dialog" aria-modal="true" aria-labelledby="independent-title">
      <div className="independent-card">
        <h1 id="independent-title" className="independent-title">
          {STARTUP_NOTICE_TITLE}
        </h1>
        <p className="independent-words">{NOT_AFFILIATED}</p>
        <p className="independent-help">{SUPPORT_LINE}</p>
        {/* autoFocus: the one thing to do here, under a thumb or the Return key. */}
        <button type="button" className="primary independent-ok" autoFocus onClick={() => onDone?.()}>
          OK
        </button>
      </div>
    </div>
  )
}
