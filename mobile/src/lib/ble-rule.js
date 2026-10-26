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
 * TestFlight 1.88.3 and Google Play 1.88.0 (the App Store's 1.87.11 is
 * frozen on update 1.87.60, and 1.88.3 is never sent to it: "Wait till the
 * Bluetooth version"). Their review notes say customers do not see
 * Bluetooth. Switching it on for them by an update is what Apple's
 * 2.5.19 and 2.3.1(a) and Google's rule on features "designed to be
 * activated remotely" forbid, and the fingerprint cannot be leaned on to
 * keep them apart: the version number is left out of it (mobile/
 * fingerprint.config.js), and the one native piece waiting for the next
 * build (docs/pending/watch-fill.patch) moves the watch's line alone, so the
 * phones' fingerprints stay where they are and every update keeps reaching
 * every copy, the new build's and the old ones alike.
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
 * pair, and on both phones together: the pair builds both, and one left null
 * would be reviewed with notes that say Bluetooth is there on a copy that
 * keeps it closed (the ledger's rule refuses one phone alone). A number set
 * earlier is a copy that opens too early: apk.yml makes a public APK at
 * every version, and anything at or above the number opens.
 * test/bluetooth.mjs asks the threshold the ledger's own question
 * (test/ledger.mjs thresholdProblems), so the build pull request goes green
 * with nothing in the tests rewritten.
 *
 * AND THAT PULL REQUEST WAITS FOR JUSTIN'S YES, GREEN OR NOT. Its phones'
 * fingerprint says Unchanged (the version is left out of it, and the watch
 * patch moves only the watch), so by the merge rule alone it would be
 * merged the moment it is green. It must not be: the merge itself puts out
 * apk-v1.89.0 on the Releases page, a public APK that opens Bluetooth, and
 * the website pages that say so, before Apple or Google has seen it. So:
 * say what the build is for, wait for the yes, apply the pending patches in
 * that same pull request, and merge it only right before the build pair is
 * started (CLAUDE.md, "It is switched on for customers").
 * test/bluetooth.mjs holds it to docs/expo-builds.md: null, or this app's
 * own version in the build pull request, until the opening row is written
 * ("Bluetooth (beta) for customers" in What it was for), and, once it is,
 * set and opening on that row's version, so no later update can take it
 * back from the copies that were reviewed with it.
 *
 * THE OPENING ROW GOES IN BEFORE, OR WITH, THE FIRST MERGE AFTER THE BUILD
 * IS STARTED. Every pull request moves the version, so the next one after
 * the build pull request is 1.89.1, and the ledger test then finds a
 * threshold of 1.89.0 that is neither null nor this app's version. If a
 * build was started from it, the fix is that row, never this number: once a
 * build exists, the threshold is never moved to match the next version.
 * Moved to 1.89.1, or set back to null, it would close Bluetooth by update
 * on every 1.89.0 copy whose review notes say it is there, the reviewer's
 * own among them. Only if no build was ever made from it (the yes never
 * came) is it set back to null, or moved with the version.
 *
 * AND THE ROW, ONCE WRITTEN, IS PINNED. The ledger test trusts the ledger,
 * so a later change that took the row out and set this back to null
 * together would pass it. The pull request that writes the row also sets
 * OPENED_AT in test/ledger.mjs to that build ({ version: '1.89.0', ios:
 * '1.89.0', android: '1.89.0' }), and a test fails until it does: from then
 * on the ledger has to keep that row on both phones, this has to stay
 * exactly what the pin says, and a store live at that version or later has
 * to keep its phone open.
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
 * THE UNITS A CUSTOMER CAN PICK: EVERY ONE THE PAGE OFFERS, FROM THE SAME
 * STORE VERSION.
 *
 * "I don't wanna wait for the FM3 test. Just get it built and pushed to
 * Apple. as long as there's warnings for user that it's in beta and they're
 * free to test it and submit feedback, but it might not work properly."
 * And: "I'm curious why the VP4 is not listed? ... it uses the same
 * architecture as the AM4." (Justin, 25 October 2026.) So the store version
 * that opens Bluetooth (beta) to customers opens it on all five units the
 * page offers: the AM4, which it has run; the FM9, Axe-Fx III and VP4,
 * which nobody here has, each marked "not tried yet"; and the FM3, which
 * has not run yet (the one cable tried on it got very hot), with that
 * warning kept in front of it. Every untried unit says so, and has the
 * report button beside it (shared/bluetooth-gear untried).
 *
 * KEYED BY STORE VERSION, NEVER A PLAIN LIST. A unit added to a plain list
 * here would reach every copy already out, by update, whose review notes
 * name the units it was reviewed with: the switch by update the threshold
 * above exists to prevent. So each unit carries the store version it opens
 * from, compared against the version built into the copy, exactly as
 * Bluetooth itself is. All five open together, in the one store version
 * that opens Bluetooth, so all five are keyed to BLUETOOTH_FROM_STORE
 * itself: null until the build pull request, and set with it.
 *
 * A SIXTH UNIT, OR ONE TAKEN OUT. A unit the page offers that is not keyed
 * here stays his (unitOffered, below), and test/bluetooth.mjs fails until
 * somebody decides. Once the opening build's row is written, test/ledger.mjs
 * pins the units it opened (OPENED_AT.units, unitProblems): a later unit is
 * keyed to a later store version of its own, never to this threshold, and
 * an opened unit is never closed by update on the copies reviewed with it.
 */
export const UNITS_FROM_STORE = Object.freeze({
  am4: BLUETOOTH_FROM_STORE,
  fm3: BLUETOOTH_FROM_STORE,
  fm9: BLUETOOTH_FROM_STORE,
  axefx3: BLUETOOTH_FROM_STORE,
  vp4: BLUETOOTH_FROM_STORE
})

/** The units keyed above, in the page's order: every one a customer can be offered, on a copy that opens it. */
export const CUSTOMER_UNITS = Object.freeze(Object.keys(UNITS_FROM_STORE))

/**
 * Whether this unit is offered to this account on this copy: his account,
 * every unit the page knows, on every copy; anybody else, a unit keyed in
 * UNITS_FROM_STORE on a copy whose built-in version opens it (the same
 * question as bluetoothOpen, asked of that unit's own threshold).
 *
 * `units` is the keying, passed only by the tests that try the rule as the
 * build will set it; the app always takes UNITS_FROM_STORE.
 */
export function unitOffered(unit, { admin = false, platform = null, installed = null, units = UNITS_FROM_STORE } = {}) {
  if (admin === true) return true
  if (typeof unit !== 'string' || !Object.prototype.hasOwnProperty.call(units, unit)) return false
  return bluetoothOpen({ platform, installed, admin: false, from: units[unit] })
}
