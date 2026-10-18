import { useEffect, useRef } from 'react'

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
 * is seen until OK, so it comes before the walkthrough, the connecting
 * screen and Play, and is never laid over a Play somebody was using. The
 * walkthrough waits under it, and is there when it goes.
 *
 * AND NOTHING BEHIND IT IS REACHED, BY THE KEYBOARD EITHER. Covering the
 * page stops a mouse and a finger, and aria-modal stops a screen reader, but
 * neither stops Tab: from OK it walked on into the page underneath, to
 * Settings, NO DEVICE, and on Play to Next, where Enter changed the preset
 * on a unit nobody could see. On the computer app, with a unit plugged in,
 * that is a real preset change made blind. So while the card is up,
 * everything else on the page is inert (nothingBehind, below), and Tab has
 * nowhere to go but OK.
 *
 * NEVER A DIALOG WHERE NOBODY IS LOOKING. A computer app started with no
 * window (a Raspberry Pi on a pedalboard, `--hidden`) has no page at all
 * until somebody opens the window, so nothing waits on this there: the
 * device server answers the phones regardless, and the card is shown the
 * first time the window is opened. The phone or tablet in the player's hand
 * shows its own.
 */
export default function IndependentNotice({ onDone }) {
  const own = useRef(null)
  useNothingBehind(own)
  return (
    <div ref={own} className="independent" role="dialog" aria-modal="true" aria-labelledby="independent-title">
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

/**
 * EVERYTHING ON THE PAGE BUT THE CARD, INERT, FOR AS LONG AS IT IS UP.
 * Returns what puts it back, which the card runs as it goes.
 *
 * `inert` is the browser's own word for "not there": nothing in it takes
 * focus, a click, a key or a screen reader, and Electron's Chromium has it as
 * the browsers do. Set on every sibling of the card and of each element it
 * sits in, up to the body, which is everything else on the page: the rest
 * of the app beside it, and the sheets, which are drawn straight into the
 * body (components/Sheet). Anything that arrives while the card is up (a
 * screen changing under it, a sheet opening by itself) is made inert as it
 * arrives, because a page that is still running under the card keeps adding
 * things. When the card goes, only what this made inert is given back.
 *
 * Set on the elements themselves rather than written into App.jsx as an
 * attribute, so the card brings it and takes it away, and no other screen
 * has to know.
 */
export function nothingBehind(card) {
  if (typeof MutationObserver === 'undefined') return () => {}
  const made = []
  const shut = (el) => {
    /* Elements only (nodeType 1): text and comments have nothing to shut. */
    if (el?.nodeType !== 1 || el === card || el.contains(card) || el.inert) return
    el.inert = true
    made.push(el)
  }
  const watching = []
  for (let at = card; at.parentElement && at !== document.body; at = at.parentElement) {
    const parent = at.parentElement
    for (const other of parent.children) shut(other)
    const watch = new MutationObserver((changes) => {
      for (const change of changes) for (const added of change.addedNodes) shut(added)
    })
    watch.observe(parent, { childList: true })
    watching.push(watch)
  }
  return () => {
    for (const watch of watching) watch.disconnect()
    for (const el of made) el.inert = false
  }
}

function useNothingBehind(own) {
  useEffect(() => (own.current ? nothingBehind(own.current) : undefined), [own])
}
