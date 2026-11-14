/*
 * TONE3000'S PAGE INSIDE THE APP: what the page may load, when it is over,
 * and what is said when it goes wrong. No phone in here: the web view
 * (components/Tone3000Page) asks these and does what they say.
 *
 * FROM TONE3000'S OWN EXAMPLE, never memory (github.com/tone-3000/api,
 * react-native/src/t3k/auth.tsx, with ios/App/T3K/AuthBrowser.swift and
 * android/.../AuthBrowser.kt beside it):
 *
 *   - the page is a web view in a sheet with a title and a Close button;
 *   - the address TONE3000 sends the player back to is caught BEFORE the
 *     web view loads it, so nothing has to leave the app and come back;
 *   - that address's scheme has to be on the web view's list of origins,
 *     or the web view hands it to the phone instead of asking;
 *   - a page that fails to load ends it, and so does TONE3000 turning the
 *     sign-in down with an error page instead of a return;
 *   - a failed load OF the return address is the return (their iPhone
 *     example: the web view may report it as a failure, having nothing to
 *     show for that scheme).
 *
 * ONE THING OF OURS: their example ends the page on any error answer at
 * all. Here only an error from TONE3000's own sign-in addresses does, which
 * is the case their comment gives (a key or return address TONE3000 does
 * not accept). A tone's page that has gone, part-way through browsing,
 * shows TONE3000's own "not found" and the player goes back from it.
 *
 * The page is over ONCE: a return, a close or a failure, whichever comes
 * first, and nothing after it is told to anybody. A web view asks about the
 * same address more than once.
 */
import { readCallback, T3K_ORIGIN, T3K_REDIRECT } from './tone3000.js'

/** The sheet's title (their terms: everything browsed is TONE3000's own page, under its name) and its button. */
export const T3K_PAGE_TITLE = 'TONE3000'
export const T3K_PAGE_CLOSE = 'Close'

/** A page that would not load. */
export const PAGE_UNREACHED = 'TONE3000 couldn’t be reached. Check the internet and try again.'
/** TONE3000 answered the sign-in with an error page. The number it answered with is for the log, not the screen. Names no button: the way in is Continue before a sign-in and Browse TONE3000 after. */
export const PAGE_REFUSED = 'TONE3000 turned the sign-in down. Try again.'

/** The origins the web view may load itself: the web, and the scheme TONE3000 sends the player back by. */
export const pageOrigins = (redirect = T3K_REDIRECT) => ['https://*', 'http://*', `${String(redirect).split(':')[0]}://*`]

/** Whether an address is TONE3000's return. */
export const pageReturn = (url, redirect = T3K_REDIRECT) => typeof url === 'string' && readCallback(url, redirect) !== null

/** TONE3000's own sign-in addresses: where an error answer means the sign-in was turned down. */
const signInAddress = (url) => typeof url === 'string' && url.startsWith(`${T3K_ORIGIN}/api/v1/oauth/`)

/**
 * One showing of the page. `onReturn(url)`, `onClosed()` and
 * `onFault(words, status)`: exactly one of them is called, once. `status`
 * is the number TONE3000 answered with, where there was one.
 */
export function pageFlow({ onReturn, onClosed, onFault, redirect = T3K_REDIRECT }) {
  let over = false
  const end = (tell, what, more) => {
    if (over) return
    over = true
    tell?.(what, more)
  }
  return {
    /** May the web view load this address? Never the return (which ends the page), and nothing once the page is over. */
    mayLoad(url) {
      if (over) return false
      if (pageReturn(url, redirect)) {
        end(onReturn, url)
        return false
      }
      return true
    },
    /** A page answered with an error status. */
    httpError(status, url) {
      const n = Number(status)
      if (!(n >= 400) || pageReturn(url, redirect) || !signInAddress(url)) return
      end(onFault, PAGE_REFUSED, n)
    },
    /** A page did not load at all. */
    loadError(url) {
      if (pageReturn(url, redirect)) end(onReturn, url)
      else end(onFault, PAGE_UNREACHED)
    },
    /** The player closed it. */
    close() {
      end(onClosed)
    },
    over: () => over
  }
}
