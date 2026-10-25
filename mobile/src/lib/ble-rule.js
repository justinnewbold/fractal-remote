import { isOlder } from './versions.js'

/**
 * BLUETOOTH (BETA): WHO IT IS OPEN TO, AND WHICH UNITS, AS PURE RULES.
 *
 * "I have tried it from an android phone and it works great." (Justin, 25
 * October 2026.) It has run his AM4 from an iPhone and from an Android
 * phone, and it is to reach paying customers in the next store version, on
 * both phones, and only there. Until then it is his account's alone, as it
 * has been since 11 October ("I just feel like it's not ready to have
 * public").
 *
 * WHY THE STORE VERSION, AND NEVER AN UPDATE OR AN ACCOUNT. Every merge to
 * main is an over-the-air update to every copy on the current runtime: today
 * TestFlight 1.88.3, Google Play 1.88.0 (in Google's review) and the App
 * Store's 1.88.3 once Apple approves it. Their review notes say customers do
 * not see Bluetooth. Switching it on for them by an update is what Apple's
 * 2.5.19 and 2.3.1(a) and Google's rule on features "designed to be
 * activated remotely" forbid, and the fingerprint cannot be leaned on to
 * keep them apart: the version number is left out of it (mobile/
 * fingerprint.config.js), and nothing native is waiting for the next build.
 *
 * So it opens by a fact about the copy itself: the version BUILT INTO it
 * (lib/storeVersion installedStoreVersion, read off the app config inside
 * the binary, which no update touches). A copy whose built-in version is at
 * or above BLUETOOTH_FROM_STORE opens it to every account with the full
 * version; every copy below it, and every copy that cannot say, stays as its
 * review notes describe it. The Siri links do the same on Android
 * (siri-rule.js LINKS_AFTER_STORE).
 *
 * NULL ON BOTH PHONES UNTIL THE BUILD. Set to '1.89.0' only in the pull
 * request that moves the version to 1.89.0, the last merge before the build
 * pair. A number set earlier is a copy that opens too early: apk.yml makes a
 * public APK at every version, and anything at or above the number opens.
 * test/bluetooth.mjs holds it to docs/expo-builds.md: null, or this app's
 * own version in the build pull request, until the opening row is written
 * ("Bluetooth (beta) for customers" in What it was for), and, once it is,
 * set and opening on that row's version, so no later update can take it
 * back from the copies that were reviewed with it.
 *
 * THE OPENING ROW GOES IN BEFORE, OR WITH, THE FIRST MERGE AFTER THE BUILD
 * IS STARTED. Every pull request moves the version, so the next one after
 * the build pull request is 1.89.1, and the ledger test then finds a
 * threshold of 1.89.0 that is neither null nor this app's version. The fix
 * is that row, never this number: once a build exists, the threshold is
 * never moved to match the next version. Moved to 1.89.1, or set back to
 * null, it would close Bluetooth by update on every 1.89.0 copy whose review
 * notes say it is there, the reviewer's own among them.
 *
 * AND ONLY ONCE THE STORE COPY IS SEEN TO BE READ RIGHT. Everything here
 * leans on installedStoreVersion reading the number built into the copy,
 * not the running update's. So the threshold is set only after Justin's
 * logs from iPhone 1.88.3 and Android 1.88.0, running an update with a
 * higher number, show "store copy: 1.88.3" and "store copy: 1.88.0" (the
 * log's head, lib/logHead.js), not the update's 1.88.x.
 *
 * Nothing here knows about a phone: it imports the version rule and nothing
 * else, and everything about the copy in hand is passed in, so a test can
 * call it.
 */
export const BLUETOOTH_FROM_STORE = Object.freeze({ ios: null, android: null })

/**
 * Whether Bluetooth (beta) is open to this account on this copy of the app.
 *
 * `installed` is the version built into the copy (installedStoreVersion,
 * never APP_VERSION or expoConfig, which are the update's). Justin's account
 * (`admin`) is open on every copy, as it has been. Anybody else needs a
 * threshold for this platform and a copy at or above it: `=== false`,
 * never `!isOlder(…)`, because isOlder says null for a version it cannot
 * read, and `!null` would open it on a copy that cannot say what it is.
 *
 * `from` is the threshold, passed only by the tests that try the rule as the
 * build will set it; the app always takes BLUETOOTH_FROM_STORE.
 */
export function bluetoothOpen({ platform = null, installed = null, admin = false, from = BLUETOOTH_FROM_STORE } = {}) {
  if (admin === true) return true
  const at = platform === 'ios' || platform === 'android' ? from?.[platform] : null
  return typeof at === 'string' && at !== '' && isOlder(installed, at) === false
}

/*
 * THE UNITS A CUSTOMER CAN PICK: THE AM4, AND ONLY THE AM4, FOR NOW.
 *
 * "It seems to be working just fine on my AM four. I haven't been able to
 * test it on an FM three." Only the AM4 has ever run over Bluetooth. The FM3
 * ran a cable hot when the parts went straight in, and the FM9 and Axe-Fx
 * III have never been tried, with one known open fault (a tuner left on,
 * muted, after a reconnect: task 161). So the three stay on his account,
 * where they have always been offered, and each opens to customers only in
 * a later store version whose notes say so.
 */
export const CUSTOMER_UNITS = Object.freeze(['am4'])

/** Whether this unit is offered to this account: his, every one the page knows; anybody else's, CUSTOMER_UNITS. */
export const unitOffered = (unit, admin = false) => admin === true || CUSTOMER_UNITS.includes(unit)
