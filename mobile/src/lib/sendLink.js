/**
 * "SEND ME THE DOWNLOAD LINK", UNDER "NO COMPUTER IS SIGNED IN WITH THIS
 * ACCOUNT YET", AND WHAT IT SAYS WHILE IT WORKS.
 *
 * "Get new buyers past 'no computer yet.' About 12 of your first 40 paying
 * customers never got the computer app signed in. Add a 'Send me the
 * download link' button on the three screens where they get stuck" — what
 * Justin approved on 15 October 2026. Somebody standing at a gig with a
 * phone that has just told them the computer app was never set up is not at
 * that computer, and typing an address into it later is the step they never
 * took. One tap, and the link is waiting in their inbox when they sit down.
 *
 * THE ADDRESS IS THE ACCOUNT'S. It goes to the email the phone is signed in
 * with, the one the words above it name (useNoComputer), never anything
 * typed: the person who is stuck is the person on this account. The sending
 * is the download-link function the walkthrough's form already uses
 * (lib/downloadLink.js), unchanged.
 *
 * ONE MEMORY FOR THE WHOLE APP, NOT ONE PER SCREEN. The same three words are
 * on the waiting screen, the play screen's card and Phone & computer, and the
 * link sent from one must read as sent on the other two — or the next tap
 * sends nothing anyway: the function answers "sent" to a second ask inside
 * ten minutes without sending it (supabase/migrations/20260920_download_link_rate.sql).
 * So "Sent" is held for those same ten minutes, then the button is a button
 * again.
 *
 * ONE LINE, ALWAYS. The play screen's card floats, and NOT CONNECTED below it
 * is placed from the card's bottom edge (lib/tileGrid bandTop). A label that
 * grew to two lines on "Sending…" would move that band under somebody's thumb
 * mid-song, so every label here is short enough for one line on the smallest
 * phone, and anything longer — the reason a send failed — is said to a screen
 * reader rather than drawn.
 *
 * Nothing in this file imports anything, so a test can run it as it is
 * (test/no-computer.mjs).
 */

/** How long "Sent" stays: the download-link function's own window. */
export const SENT_FOR_MS = 10 * 60 * 1000

/** What the button says, one short line each. */
export const SEND_LINK = {
  idle: 'Send me the download link',
  sending: 'Sending…',
  sent: 'Sent. Check your email',
  failed: 'Didn’t send. Tap to try again'
}

const keyOf = (email) => String(email || '').trim().toLowerCase()

/**
 * The words for one moment: the label drawn, the sentence a screen reader
 * says instead, and `busy`, which is only while it is on its way: the button
 * is dimmed then and a tap does nothing.
 *
 * "Sent" is NOT busy. It is the one line that says it worked, and a dimmed
 * button draws its words faint, so it was hard to read and looked broken.
 * A tap on it still sends nothing (press() ignores one inside the ten
 * minutes), so it can be drawn at full strength.
 */
export function sendLinkSaid(phase, email, why = '') {
  const to = String(email || '').trim()
  const spoken = {
    idle: `Send me the download link. It goes to ${to}.`,
    sending: 'Sending the download link.',
    sent: `Sent the download link to ${to}. Open it on the computer your Fractal is plugged into.`,
    failed: `The download link didn’t send.${why ? ` ${why}` : ''} Tap to try again.`
  }
  const at = SEND_LINK[phase] ? phase : 'idle'
  return { label: SEND_LINK[at], spoken: spoken[at], busy: at === 'sending' }
}

/**
 * The memory, around `send` (sendDownloadLink: never throws, answers
 * { ok } or { ok: false, message }). `clock` is the time, for a test to turn.
 *
 *   phase(email)    'idle', 'sending', 'sent' or 'failed'
 *   sentLeft(email) how long "Sent" has left, or 0
 *   why(email)      what the last failure said, for the screen reader
 *   press(email)    send it, unless it is on its way or was just sent
 *   watch(fn)       told whenever anything changes; returns the way to stop
 */
export function linkSender(send, clock = () => Date.now()) {
  const memory = new Map()
  const watchers = new Set()
  const tell = () => {
    for (const fn of [...watchers]) fn()
  }
  const phase = (email) => {
    const m = memory.get(keyOf(email))
    if (!m) return 'idle'
    if (m.phase === 'sent' && clock() - m.at >= SENT_FOR_MS) return 'idle'
    return m.phase
  }
  const sentLeft = (email) => {
    const m = memory.get(keyOf(email))
    return m && m.phase === 'sent' ? Math.max(0, SENT_FOR_MS - (clock() - m.at)) : 0
  }
  const why = (email) => memory.get(keyOf(email))?.message || ''
  const press = async (email) => {
    const key = keyOf(email)
    if (!key) return null
    const now = phase(email)
    /* Twice is once: a second tap while it is on its way, or inside the window, sends nothing. */
    if (now === 'sending' || now === 'sent') return null
    memory.set(key, { phase: 'sending', at: clock() })
    tell()
    let out
    try {
      out = await send(String(email).trim())
    } catch (err) {
      /* sendDownloadLink never throws; a stand-in that did still says it did not send. */
      out = { ok: false, message: String(err?.message || err || '') }
    }
    memory.set(key, out?.ok ? { phase: 'sent', at: clock() } : { phase: 'failed', at: clock(), message: String(out?.message || '') })
    tell()
    return out
  }
  const watch = (fn) => {
    watchers.add(fn)
    return () => watchers.delete(fn)
  }
  return { phase, sentLeft, why, press, watch }
}
