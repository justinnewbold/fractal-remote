/**
 * WHAT THE COMPUTER APP'S WINDOW MAY OPEN, AND WHAT IT MAY USE.
 *
 * The window is a browser of the app's own: Electron 33, a line that has had
 * no release since April 2025, so whatever has been found in its Chromium
 * since has not been mended in it. It is there to show one page, the app's own, which
 * the device server serves at http://localhost:<port>. Nothing kept it to
 * that (the audit of 2 November 2026, computer-5):
 *
 *   - Every link to the website (What's new, Help with this app, a store
 *     chip, ForgeFX on GitHub) opens with target=_blank or window.open, and
 *     Electron's answer to either was a second window of the app's own, with
 *     no address bar and the app's bridge to the computer loaded in it, from
 *     which a player could click on to anywhere on the web.
 *   - Electron's answer to a page asking for the camera, the location, or
 *     MIDI with SysEx (raw messages straight to the AM4 or FM3 on the USB
 *     cable) is yes, without asking anybody.
 *
 * So the web opens in the computer's own browser, where it belongs, and the
 * window stays on the app's page; and the window may use the two things the
 * page really uses, for the page itself, and nothing else. A newer Electron is
 * the rest of the cure, and a bigger change than this; this is what can go out
 * today with nothing else moved.
 *
 * Decisions only, with everything handed in, the same trade lib/host.mjs and
 * lib/autostart.mjs make: main.js does the opening and the refusing, and
 * these can be tested on any machine with no Electron.
 */

/**
 * The origin of the app's own page, from the address the window loads
 * (`where.local` in main.js), or null while that is not known yet. Before
 * it is, nothing is the app's own: the window is still blank then, with
 * nothing in it to click.
 */
export function ownOrigin(local) {
  if (!local) return null
  try {
    const origin = new URL(String(local)).origin
    return origin && origin !== 'null' ? origin : null
  } catch {
    return null
  }
}

/* What the computer's own browser or mail app is handed. Nothing else leaves the app. */
const OUTSIDE = new Set(['http:', 'https:', 'mailto:'])

/**
 * What to do with an address the window was asked to open, or to go to.
 *
 *   'own'     the app's own page (another path on it, the same page with
 *             something new on the end, a file it made itself): the window
 *             does it, as before.
 *   'browser' a web page or an email address anywhere else: the computer's
 *             own browser or mail app opens it, and the window stays put.
 *   'refuse'  anything else: a file on the disk, a script, a blank page,
 *             another program's own kind of link, or something that is not
 *             an address at all. Nothing opens it.
 *
 * The computer's other addresses for itself (its wifi address, its .local
 * name, 127.0.0.1) are not the window's page, which is always localhost, so
 * they go to the browser like any other page: the tray's own copies of them
 * do the same.
 */
export function linkVerdict(url, local) {
  let at
  try {
    at = new URL(String(url ?? ''))
  } catch {
    return 'refuse'
  }
  const own = ownOrigin(local)
  // A blob: address carries the origin of the page that made it, which is the same question.
  if (own && at.origin === own) return 'own'
  return OUTSIDE.has(at.protocol) ? 'browser' : 'refuse'
}

/*
 * WHAT THE PAGE REALLY USES, read out of src/ on 2 November 2026:
 *
 *   - copying to the clipboard (navigator.clipboard.writeText: Copy logs,
 *     the preset report, the downloads address), which Chromium asks as
 *     'clipboard-sanitized-write';
 *   - keeping the screen on through a long send (src/lib/awake.js, Screen
 *     Wake Lock), asked as 'screen-wake-lock', and carried on without when
 *     it is refused.
 *
 * And nothing else: no camera since the QR scanner went, no microphone, no
 * location, no notifications, no MIDI (the device server talks to the unit,
 * never the page), no reading the clipboard, no full screen. A new use is
 * added here, by name, in the change that brings it.
 */
export const PAGE_PERMISSIONS = Object.freeze(['clipboard-sanitized-write', 'screen-wake-lock'])

/**
 * Whether a page may have a permission it asked for, or was checked for.
 *
 *   permitted({ permission, from, local }) → true | false
 *
 * `from` is whatever Electron says asked: the frame's address, or its
 * origin (which it writes with a slash on the end). Only the app's own page,
 * and only for what PAGE_PERMISSIONS names; everything else, and anything
 * at all before the app's own address is known, is no.
 */
export function permitted({ permission, from, local } = {}) {
  if (!PAGE_PERMISSIONS.includes(permission)) return false
  const own = ownOrigin(local)
  if (!own || !from) return false
  try {
    return new URL(String(from)).origin === own
  } catch {
    return false
  }
}
