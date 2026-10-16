/**
 * WHAT TO CALL THE THING IN THE PLAYER'S HAND.
 *
 * Asked, 16 October 2026, from an iPad: "the app pretty much always uses the
 * word phone instead of device. This app will work on phones, iPads, tablets
 * … is there a way to detect what device they're using and change what it
 * says from phone to tablet or iPad or what not?" And: "a sound guy might
 * just want to use another computer to be able to control things remotely."
 *
 * There is, and none of it needs a new build:
 *
 *   - an iPhone app knows when it is running on an iPad (Platform.isPad),
 *   - Android does not say "tablet", but a screen whose short side is 600
 *     points or more is one; that is the line Android's own layouts draw,
 *   - a browser says what it is on in its user agent, and an iPad's Safari,
 *     which calls itself a Mac, still owns up to a touch screen.
 *
 * So each end says what it is once, at the start (setDevice), and every
 * sentence that talks about "this phone" asks here instead. Where the app is
 * talking about itself it names the device: THIS iPad, This tablet. The
 * computer app is not a remote, so where it talks about one it means
 * whatever the player holds: "phone or tablet".
 *
 * Kinds:
 *   'phone'     the default, and what every test reads without setting one
 *   'ipad'      the iPhone app on an iPad, or Safari on one
 *   'tablet'    an Android tablet, in the app or the browser
 *   'browser'   the website as the remote on a laptop or desktop: the sound
 *               engineer's case. "This computer" would be the wrong word
 *               there, since the computer is the one with the unit on it.
 *   'computer'  the computer app itself, talking about the remote
 *
 * MY WORDING throughout; he can change any of it.
 */

const KINDS = ['phone', 'ipad', 'tablet', 'browser', 'computer']

const NOUN = {
  phone: 'phone',
  ipad: 'iPad',
  tablet: 'tablet',
  browser: 'browser',
  computer: 'phone or tablet'
}

let current = 'phone'

/** Say, once, which end this is. Anything unknown is a phone, as before. */
export function setDevice(kind) {
  current = KINDS.includes(kind) ? kind : 'phone'
  return current
}

/** Which kind this end said it is. */
export function deviceKind() {
  return current
}

/** The word in a sentence: phone, iPad, tablet, browser, or "phone or tablet". */
export function deviceNoun(kind = current) {
  return NOUN[kind] || NOUN.phone
}

/** At the start of a sentence. "iPad" keeps its small i. */
export function DeviceNoun(kind = current) {
  const noun = deviceNoun(kind)
  return noun.startsWith('iP') ? noun : noun[0].toUpperCase() + noun.slice(1)
}

/**
 * In capitals, the way the cards are labelled: THIS PHONE, THIS TABLET. But
 * THIS iPad: Apple's marketing guidelines say never to set its product names
 * in capitals, nor to follow a small i with capitals, so "iPad" stays as it is.
 */
export function DEVICE_NOUN(kind = current) {
  const noun = deviceNoun(kind)
  return noun.startsWith('iP') ? noun : noun.toUpperCase()
}

/** "in this browser", "on this iPad": things are in a browser, and on a phone. */
export function onThis(kind = current) {
  return `${kind === 'browser' ? 'in' : 'on'} this ${deviceNoun(kind)}`
}

/** "Phone & computer", "iPad & computer": the Settings page about the two of them. */
export function pairTitle(kind = current) {
  return kind === 'computer' ? 'Phone & computer' : `${DeviceNoun(kind)} & computer`
}

/** The shortest side of a screen, in points, at which an Android one is a tablet. */
export const TABLET_SIDE = 600

/**
 * Which kind of device the app is on, from what React Native says.
 *
 * `width` and `height` are the whole screen's (Dimensions.get('screen')),
 * not the window's, so an app made narrow on a tablet is still on a tablet.
 */
export function appDevice({ os, pad = false, width = 0, height = 0 } = {}) {
  if (os === 'ios') return pad ? 'ipad' : 'phone'
  if (os === 'android') return Math.min(width, height) >= TABLET_SIDE ? 'tablet' : 'phone'
  return 'phone'
}

/**
 * Which kind of device a browser is on, from its user agent.
 *
 * iPadOS Safari says "Macintosh" unless asked for the mobile site, so a Mac
 * that answers to more than one finger at once is an iPad, unless its screen
 * is a phone's: an iPhone asking for the desktop site says "Macintosh" too. A
 * phone is said outright by every phone browser; an Android browser without
 * "Mobile" is a tablet's. Chrome on a big Android tablet asks for the desktop
 * site by default and then says only "Linux", so a Linux touch screen that
 * is not a Chromebook is a tablet, or a phone by its size. Anything else is a
 * computer's browser.
 */
export function browserDevice({ userAgent = '', touchPoints = 0, width = 0, height = 0 } = {}) {
  const small = Boolean(width && height && Math.min(width, height) < TABLET_SIDE)
  if (/iPad/.test(userAgent)) return 'ipad'
  if (/Macintosh/.test(userAgent) && touchPoints > 1) return small ? 'phone' : 'ipad'
  if (/iPhone|iPod/.test(userAgent)) return 'phone'
  if (/Android/.test(userAgent)) return /Mobile/.test(userAgent) ? 'phone' : 'tablet'
  if (/Mobi/.test(userAgent)) return 'phone'
  if (/Linux/.test(userAgent) && !/CrOS/.test(userAgent) && touchPoints > 0) return small ? 'phone' : 'tablet'
  if (touchPoints > 0 && small) return 'phone'
  return 'browser'
}
