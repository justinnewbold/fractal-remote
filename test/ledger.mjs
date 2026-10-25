/**
 * THE BUILD LEDGER, READ ONE WAY, AND THE RULE IT HOLDS BLUETOOTH (BETA)'S
 * THRESHOLD TO, for every test that reads either.
 *
 * Not a test file: run.mjs never runs it. test/bluetooth.mjs (the version
 * rule and the ledger) and test/server.mjs (the setup emails' switch) each
 * read docs/expo-builds.md, and each had its own copy of the reader, with
 * the same columns and the same marker. A change to the ledger's table fixed
 * in one and not the other would have left the other reading something else,
 * so there is one, here.
 */
import { bluetoothOpen } from '../mobile/src/lib/ble-rule.js'
import { isOlder } from '../shared/versions.mjs'

/* The words a row says when it is the build that opened Bluetooth (beta) to customers (docs/expo-builds.md's header). */
export const OPENING = /Bluetooth \(beta\) for customers/

/* Every build in docs/expo-builds.md, once for each phone it built: a cell that starts with a number is a build on that phone. */
export const ledgerBuilds = (text) => {
  const out = []
  for (const line of String(text).split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 7 || !/^\d+\.\d+\.\d+$/.test(cells[2])) continue
    const opening = OPENING.test(cells[5])
    for (const [platform, cell] of [['ios', cells[3]], ['android', cells[4]]]) {
      if (/^\d/.test(cell)) out.push({ date: cells[1], version: cells[2], platform, opening })
    }
  }
  return out
}

/*
 * The ledger as it was before any build opened Bluetooth (beta): every row
 * marked as the opening taken out. For the checks that try the rule on
 * made-up ledgers, which must go on meaning the same thing the day the real
 * opening row is written, rather than finding it there and breaking.
 */
export const withoutOpening = (text) =>
  String(text)
    .split('\n')
    .filter((line) => !(line.trim().startsWith('|') && OPENING.test(line)))
    .join('\n')

/**
 * What is wrong with this threshold (`from`, BLUETOOTH_FROM_STORE's shape),
 * against these builds, for an app at `appVersion`: a list of sentences,
 * empty when nothing is.
 *
 * Designed so that it does not break the day the 1.89.0 row is written, nor
 * on the build pull request itself, and so that no later update can quietly
 * set the threshold back:
 *
 *   - every build older than the first one marked as the opening (every
 *     build, while none is) is closed to a customer;
 *   - a build marked as the opening ("Bluetooth (beta) for customers" in
 *     its row, docs/expo-builds.md's header says so) has the threshold
 *     set for each phone it built, and opens on its version: null, or a
 *     higher number, would take Bluetooth away from the copies reviewed
 *     with it, which only a store version whose notes say so may do;
 *   - with no build marked, the threshold is null, or exactly this app's
 *     own version: the build pull request, whose build is the opening.
 *     A number set any earlier would open every APK apk.yml makes from
 *     then on, and would be wrong by the next version anyway;
 *   - so a threshold with no build marked, and not this app's version,
 *     is one of two things, and the message says both. If a build has
 *     already been started from that threshold (the build pull request
 *     merged, the pair built, and the next pull request moved the
 *     version as every one does), the fix is that build's row in
 *     docs/expo-builds.md, marked as the opening, with the threshold
 *     left as it is: moved to match the version, or set back to null,
 *     it would close Bluetooth by update on the copies under review.
 *     Only if no build was ever made from it is it moved with the
 *     version or set back to null;
 *   - never above this app's version, which a build from here would not
 *     reach.
 *
 * The rule test in test/bluetooth.mjs asks this of the threshold as it is,
 * so the two can never disagree about what the build pull request may say.
 */
export const thresholdProblems = (builds, from, appVersion) => {
  const out = []
  for (const platform of ['ios', 'android']) {
    const at = from[platform] ?? null
    const open = (v) => bluetoothOpen({ platform, installed: v, admin: false, from })
    const mine = builds.filter((b) => b.platform === platform)
    const first = mine.filter((b) => b.opening).sort((a, b) => (isOlder(a.version, b.version) ? -1 : 1))[0] || null
    for (const b of mine) {
      const before = !first || isOlder(b.version, first.version) === true
      if (before && open(b.version)) out.push(`${platform} ${b.version} (${b.date}) is open to a customer, and no build before it is marked as the opening`)
    }
    if (first && !at) out.push(`${platform}: ${first.version} is marked as the opening, and the threshold is null`)
    if (first && at && !open(first.version)) out.push(`${platform}: ${first.version} is marked as the opening, and the threshold ${at} does not open on it`)
    if (!first && at && at !== appVersion) {
      out.push(
        `${platform}: the threshold is ${at} with no build marked as the opening, and it is not this app’s version ${appVersion}. ` +
          `If a build has already been started from threshold ${at}, add its row to docs/expo-builds.md with "Bluetooth (beta) for customers" in What it was for, and leave the threshold as it is: moving it or setting it to null would close Bluetooth by update on the copies under review. ` +
          `Only if no build was ever made from ${at}, move it with the version or set it back to null.`
      )
    }
    if (at && isOlder(appVersion, at) !== false) out.push(`${platform}: the threshold ${at} is above this app’s version ${appVersion}, so a build from here would not open it`)
  }
  return out
}
