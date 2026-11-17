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
 *
 * ONLY TONE3000'S OWN PAGES ARE SHOWN IN IT (17 November 2026, for the store
 * version that opens TONE3000 to everybody). Their example lets the web view
 * go anywhere on the web, and TONE3000's sign-in page links out to its
 * Instagram, Facebook, YouTube, TikTok, X, GitHub and Discord (read off
 * www.tone3000.com/signin that day): followed inside the app, that is a web
 * browser in an app whose age rating says it has none. So every page the
 * web view is asked to show as the whole page (`pageRule`) is one of:
 *
 *   - TONE3000's return: the sign-in is over (as before);
 *   - TONE3000's own site, https://www.tone3000.com and https://tone3000.com
 *     (which sends a visitor on to www): shown. Its sign-in, an email and
 *     then a six-digit code, is all on www.tone3000.com, and so are the
 *     authorize address and its sign-in pages (lib/tone3000 `authorizeUrl`,
 *     and /signin answering on www that day). Its scripts and styles come
 *     from www.tone3000.com/_next/static (the sign-in page, read that day),
 *     and those are not pages and are not asked about;
 *   - any other https address: not shown here, handed to the device's own
 *     browser, out of the app;
 *   - anything else (http, mail, a phone number, another app's link):
 *     not shown and not handed on.
 *
 * A part of a page (a frame inside TONE3000's page, which an iPhone asks
 * about too and says so with `isTopFrame` false) is not a page anybody
 * browses to: https and the page's own blank and inline frames load, as
 * they did, so a check TONE3000's page puts in a frame is not broken.
 * Android says every question is the whole page's (react-native-webview
 * 13.16.1 TopShouldStartLoadWithRequestEvent), and asks about a frame only
 * where its address is not http or https: so on Android the question is
 * of a page NOT KNOWN to be the whole (`topFrame` null), where the page's
 * own inline and blob frames load as they did before, and everything else
 * is ruled as the whole page.
 *
 * The web view's own list of origins lets EVERY address through to this
 * rule (`pageOrigins`, '*'): an address it does not list, it hands to the
 * phone by itself without asking anybody (react-native-webview,
 * WebViewShared createOnShouldStartLoadWithRequest, 13.16.1), which would
 * open an http address in the browser and a frame's address there too.
 */
import { readCallback, T3K_ORIGIN, T3K_REDIRECT } from './tone3000.js'

/** The sheet's title (their terms: everything browsed is TONE3000's own page, under its name) and its button. */
export const T3K_PAGE_TITLE = 'TONE3000'
export const T3K_PAGE_CLOSE = 'Close'

/** A page that would not load. */
export const PAGE_UNREACHED = 'TONE3000 couldn’t be reached. Check the internet and try again.'
/** TONE3000 answered the sign-in with an error page. The number it answered with is for the log, not the screen. Names no button: the way in is Continue before a sign-in and Browse TONE3000 after. */
export const PAGE_REFUSED = 'TONE3000 turned the sign-in down. Try again.'

/**
 * The web view's own list of origins: everything, so that every address
 * comes to `pageRule` (the head of this file says why). The return's scheme
 * is on it with the rest, so the web view never hands it to the phone.
 */
export const pageOrigins = () => ['*']

/** TONE3000's own site: the only hosts whose pages are shown in the web view. */
export const T3K_PAGE_HOSTS = Object.freeze(['www.tone3000.com', 'tone3000.com'])

/** The host of an https address, in small letters, or null for anything that is not a plain https address. A name and password in front of the host is not plain. */
function httpsHost(url) {
  const m = /^https:\/\/([^/?#\\]*)/i.exec(url)
  if (!m || m[1].includes('@')) return null
  const host = m[1].toLowerCase().replace(/:443$/, '').replace(/\.$/, '')
  return host || null
}

/**
 * What the web view does with an address it is asked to load: 'return'
 * (TONE3000's return), 'load', 'browser' (the device's own browser, out of
 * the app) or 'refuse'. `topFrame` false is a frame inside the page; null
 * is not known (Android), where the page's own data: and blob: frames load;
 * anything else is the whole page.
 */
export function pageRule(url, { topFrame = true, redirect = T3K_REDIRECT } = {}) {
  if (typeof url !== 'string' || !url) return 'refuse'
  if (pageReturn(url, redirect)) return 'return'
  if (/^about:(blank|srcdoc)$/i.test(url)) return 'load'
  const host = httpsHost(url)
  if (topFrame === false) return host || /^(data|blob):/i.test(url) ? 'load' : 'refuse'
  if (topFrame === null && /^(data|blob):/i.test(url)) return 'load'
  if (!host) return 'refuse'
  return T3K_PAGE_HOSTS.includes(host) ? 'load' : 'browser'
}

/** Whether an address is TONE3000's return. */
export const pageReturn = (url, redirect = T3K_REDIRECT) => typeof url === 'string' && readCallback(url, redirect) !== null

/** TONE3000's own sign-in addresses: where an error answer means the sign-in was turned down. */
const signInAddress = (url) => typeof url === 'string' && url.startsWith(`${T3K_ORIGIN}/api/v1/oauth/`)

/**
 * One showing of the page. `onReturn(url)`, `onClosed()` and
 * `onFault(words, status)`: exactly one of them is called, once. `status`
 * is the number TONE3000 answered with, where there was one.
 */
/** How long the same address asked again is taken for the same tap, not a second one (a web view asks more than once). */
export const PAGE_OUT_AGAIN_MS = 2000

export function pageFlow({ onReturn, onClosed, onFault, outside, redirect = T3K_REDIRECT, now = () => Date.now() }) {
  let over = false
  /* The address last handed to the browser, and when: one tap opens it once. */
  let outUrl = null
  let outAt = 0
  const end = (tell, what, more) => {
    if (over) return
    over = true
    tell?.(what, more)
  }
  return {
    /**
     * May the web view load this address? Never the return (which ends the
     * page), nothing once the page is over, and only what `pageRule` says
     * loads: an https page that is not TONE3000's goes to `outside(url)`
     * (the device's browser) instead, and the page stays as it was.
     */
    mayLoad(url, topFrame = true) {
      if (over) return false
      const what = pageRule(url, { topFrame, redirect })
      if (what === 'return') {
        end(onReturn, url)
        return false
      }
      if (what === 'browser') {
        const at = now()
        if (url === outUrl && at - outAt < PAGE_OUT_AGAIN_MS) return false
        outUrl = url
        outAt = at
        try {
          outside?.(url)
        } catch {
          /* nothing more to do: the page stays where it was */
        }
        return false
      }
      return what === 'load'
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
