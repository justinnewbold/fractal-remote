/**
 * WHICH OF THE PORTS IS THE ADAPTER. Pure, so it is tested without a phone;
 * lib/bluetooth uses it on the list the native module gives.
 */

/*
 * NOT AN ADAPTER: Apple's own Wi-Fi MIDI. Every iPhone lists "Network Session
 * 1" as a two-way port, and on the first AM4 test it was offered first,
 * picked, took every message and answered none — "Adapter connected, but the
 * AM4 isn't answering", with the real adapter sitting just below it. Told by
 * its driver, Apple's network (RTP) one, and by its name in case the driver
 * ever reads differently.
 */
export const isNetworkSession = (d) => /RTP/i.test(String(d?.driver || '')) || /^network session\b/i.test(String(d?.name || ''))

/** Something the page may offer as the adapter. */
export const isAdapter = (d) => !!d && typeof d.id === 'string' && !isNetworkSession(d)

/**
 * THE ONE TO USE, when there is no question about it, or null.
 *
 * "Setting up the Bluetooth is kind of weird. A lot of different buttons to
 * press." So the phone picks the adapter itself when only one could be meant:
 * the one just connected in Apple's screen, or else the only one there is.
 * Two or more, and nothing new among them, is a real question, and the page
 * asks it with a list.
 */
export function pickAdapter(list, fresh = new Set()) {
  const here = (Array.isArray(list) ? list : []).filter((d) => isAdapter(d) && !d.offline)
  const just = here.filter((d) => fresh.has(d.id))
  if (just.length === 1) return just[0]
  if (!just.length && here.length === 1) return here[0]
  return null
}

/*
 * APPLE'S BLUETOOTH SCREEN CRASHES ON iOS 27, in a build without Apple's fix.
 *
 * "iPhone App crashed when trying to enable Bluetooth." (24 October 2026,
 * TestFlight 1.88.0 (28), iOS 27.0.1.) iOS 27's own screen builds its list
 * from the status bar's height, which iOS 27 no longer answers, and the app
 * is gone the moment Connect opens it, in every app that uses that screen.
 * Apple's workaround is native code, so it waits for the next iPhone build
 * (docs/pending/ble-pair-ios27.patch); the build that has it answers true to
 * pairsOnIOS27(). Until then, on iOS 27 the screen stays shut and the page
 * says why. `version` is Platform.Version: '27.0.1' on an iPhone.
 */
export function pairScreenCrashes({ os, version, fixed } = {}) {
  if (os !== 'ios') return false
  const major = parseInt(String(version ?? ''), 10)
  return major >= 27 && fixed !== true
}

/* What the Bluetooth page says instead (the developer's own page). */
export const PAIR_SCREEN_IOS27 =
  'Apple’s Bluetooth screen crashes on iOS 27, so it stays closed until the next build of the app, which has Apple’s fix. Until then, Connect can only use an adapter that is already connected to the iPhone.'
