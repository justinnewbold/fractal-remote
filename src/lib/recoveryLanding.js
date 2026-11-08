/**
 * A PASSWORD-RESET LINK'S LANDING, TAKEN OUT OF THE ADDRESS BEFORE ANYTHING
 * ELSE ON THE WEBSITE CAN READ IT.
 *
 * The Reset password button in the account service's email opens
 * https://fractal.newbold.cloud/ with a sign-in for the account in the part
 * of the address after the #:
 *
 *   #access_token=…&expires_at=…&expires_in=3600&refresh_token=…&token_type=bearer&type=recovery
 *
 * and an old or used one opens it with the reason instead:
 *
 *   #error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
 *
 * Every Forgot password? lands here, the phone's and the website's alike: the
 * phone asks for no address of its own, and the website's (its own origin)
 * is the site itself, so both fall on the account service's site address.
 *
 * WHY FIRST, AND WHY IT IS WIPED AT ONCE. supabase-js reads the address when
 * a client is made, and the website's own sign-in (restoreSession in
 * src/lib/remote.js, on every load) would take the sign-in out of it, keep it
 * as this browser's, wipe the address and show the ordinary site. That is
 * what a customer saw on 8 November 2026: "it did not ever take me to a page
 * where I can actually make the password change." So this module has no
 * imports and is the first thing src/main.jsx imports: it runs before the
 * app's own modules, reads the landing, and puts the address back to the
 * plain page with history.replaceState, so no client ever sees it, a reload
 * is the ordinary site, and nothing with a sign-in in it is left in the
 * address bar, the history or a bookmark. main.jsx then draws the Choose a
 * new password page (components/ResetPassword.jsx) instead of the app.
 *
 * The sign-in is kept in memory only, for that page, and only there. A link
 * from the account service can be used once, so a reload of that page is the
 * ordinary site, and the same link opened again says it has expired, which is
 * the page's way back to a new email.
 *
 * NOT TAKEN: any other sign-in in the address (a confirmation link of the
 * kind the account service sent before 7 November 2026), which the website
 * picks up as it always has; and a ?code= for supabase-js's other way of
 * signing in by link, which never comes from this project's emails. Neither
 * end makes its client that way (flowType is left at supabase-js's own,
 * the link above), and a code from one would need the secret its own device
 * kept, which a page opened in a browser does not have.
 */

/** The address's part after the #, and its query, read as the account service writes them. */
function partsOf(href) {
  let url
  try {
    url = new URL(String(href))
  } catch {
    return null
  }
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : ''
  let fromHash
  try {
    fromHash = new URLSearchParams(hash.includes('=') ? hash : '')
  } catch {
    fromHash = new URLSearchParams('')
  }
  return { url, fromHash, fromQuery: url.searchParams }
}

/** The account's email, out of the sign-in's own token, for the page to say whose password it is. Null when it cannot be read. */
export function emailOf(accessToken) {
  try {
    const body = String(accessToken).split('.')[1]
    if (!body) return null
    const b64 = body.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((body.length + 3) % 4)
    const text = decodeURIComponent(
      Array.from(atob(b64), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    )
    const email = JSON.parse(text)?.email
    return typeof email === 'string' && email.includes('@') ? email : null
  } catch {
    return null
  }
}

/** The account service's reasons for a link that did not work, read from either part of the address. */
const ERROR_KEYS = ['error', 'error_code', 'error_description']

/**
 * What the address says, as one of:
 *
 *   { kind: 'recovery', accessToken, refreshToken, expiresIn, expiresAt, email }
 *   { kind: 'error', code, description, expired }
 *   null: not a landing; the address is left as it is.
 *
 * An error is the account service's (an error_code or an error_description
 * with it), from the part after the # or the query, which is where it puts
 * one for the other way of signing in. A recovery is the part after the #
 * with type=recovery; one without its two tokens is a link that will not
 * work, and is said as one rather than left in the address.
 */
export function parseLanding(href) {
  const parts = partsOf(href)
  if (!parts) return null
  const { fromHash, fromQuery } = parts
  const either = (key) => fromQuery.get(key) || fromHash.get(key) || ''
  if (either('error_code') || either('error_description')) {
    const code = either('error_code') || either('error') || 'unknown'
    const description = either('error_description')
    return { kind: 'error', code, description, expired: code === 'otp_expired' || /expired|invalid/i.test(description) }
  }
  if (fromHash.get('type') !== 'recovery') return null
  const accessToken = fromHash.get('access_token') || ''
  const refreshToken = fromHash.get('refresh_token') || ''
  if (!accessToken || !refreshToken) {
    return { kind: 'error', code: 'incomplete', description: '', expired: true }
  }
  const number = (key) => {
    const n = Number(fromHash.get(key))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return {
    kind: 'recovery',
    accessToken,
    refreshToken,
    expiresIn: number('expires_in'),
    expiresAt: number('expires_at'),
    email: emailOf(accessToken)
  }
}

/**
 * The same address with the landing taken off it: nothing after the #, and
 * none of the account service's reasons in the query. Everything else in the
 * query is kept. As a path, query and nothing else, for history.replaceState.
 */
export function addressWithout(href) {
  const parts = partsOf(href)
  if (!parts) return '/'
  const { url } = parts
  for (const key of ERROR_KEYS) url.searchParams.delete(key)
  const query = url.searchParams.toString()
  return `${url.pathname || '/'}${query ? `?${query}` : ''}`
}

/**
 * Read the landing and wipe it from the address bar, once, now. Returns what
 * parseLanding returned. `win` is the page's window; outside a browser (the
 * tests, the server) there is none and nothing is taken.
 */
export function takeLanding(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win?.location) return null
  const found = parseLanding(win.location.href)
  if (!found) return null
  const plain = addressWithout(win.location.href)
  try {
    win.history.replaceState(win.history.state, '', plain)
  } catch {
    /* A history the page may not touch: the hash, at least, goes. */
    try {
      win.location.hash = ''
    } catch {
      // Nothing else left to try; the page still opens on the reset.
    }
  }
  return found
}

/** This page's landing, read the moment this module runs: before the app's, because src/main.jsx imports it first. */
export const landing = takeLanding()
