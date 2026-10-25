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
 * THE UNITS A CUSTOMER CAN PICK: THE AM4, AND ONLY THE AM4, FOR NOW.
 *
 * "It seems to be working just fine on my AM four. I haven't been able to
 * test it on an FM three." Only the AM4 has ever run over Bluetooth. The FM3
 * ran a cable hot when the parts went straight in, and the FM9 and Axe-Fx
 * III have never been tried, with one known open fault (a tuner left on,
 * muted, after a reconnect: task 161). So the three stay on his account,
 * where they have always been offered, and each opens to customers only in
 * a later store version whose notes say so.
 *
 * WHICH THIS LIST CANNOT DO AS IT IS. It is a plain list: 'fm9' added here
 * in the next build's pull request would reach every 1.89.0 copy too, by
 * update, whose review notes say the AM4 alone, which is the very switch
 * by update the threshold above exists to prevent. So before a second unit
 * opens, it is keyed the way Bluetooth itself is: a store version for that
 * unit, compared against the copy's built-in version, and the list grows
 * only that way, never by adding a name here.
 */
export const CUSTOMER_UNITS = Object.freeze(['am4'])

/** Whether this unit is offered to this account: his, every one the page knows; anybody else's, CUSTOMER_UNITS. */
export const unitOffered = (unit, admin = false) => admin === true || CUSTOMER_UNITS.includes(unit)
