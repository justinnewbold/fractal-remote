/* Generated from shared/versions.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * Which of two versions is older, for the one question it is asked.
 *
 * "Does the Mac app need to be updated to the latest version? Or would that
 * affect how the app performs?"
 *
 * Both ends of this project share one numbering — `desktop/package.json`
 * moves with the root one and a test holds them to each other — so "the
 * computer is on 1.87.4 and the phone is on 1.87.28" is a real comparison.
 * What it no longer is, is a gap to close by itself: a new computer version
 * is made only when the computer's own part changed (see COMPUTER_NEEDED
 * below and scripts/computer-fingerprint.mjs), so a computer a few numbers
 * behind the phone is usually the newest there is.
 *
 * Deliberately strict about what it will answer. Anything that is not three
 * plain numbers comes back null: a version this code cannot parse is a version
 * it has no business having an opinion about, and telling somebody to update a
 * perfectly current app is worse than saying nothing.
 */
const parts = (v) => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '').trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** true when `a` is behind `b`, false when it is not, null when unknowable. */
export function isOlder(a, b) {
  const left = parts(a)
  const right = parts(b)
  if (!left || !right) return null
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] < right[i]
  }
  return false
}

/**
 * THE OLDEST COMPUTER APP THIS PHONE APP NEEDS, and the only version the red
 * "Update the computer app" line is measured against.
 *
 * "The red line only shows when the phone really needs something the
 * computer doesn't have yet."
 *
 * It used to be measured against the phone's own version, which moves on
 * every merge — so any computer not on the very newest release was told to
 * update, most of the time, and people learn to ignore a line that is on
 * most of the time. Now a computer version is made only when the computer's
 * own part changes, which would have made that line permanent. So it is
 * measured against this instead.
 *
 * Raised only by a change that gives a phone feature something it cannot
 * work without on the computer, and set to the computer release that carries
 * it (CLAUDE.md says the rule; a test holds it to three numbers and to no
 * higher than this app's own version).
 *
 * 1.87.23, from a walk of every computer-side change the phone uses
 * (desktop/, the ForgeFX pin in desktop/forgefx.lock.json, the relay
 * allowlist in relay-rules.mjs), as of 1.87.28:
 *
 *   1.87.23  the laptop stays awake while a phone is using it. The phone
 *            writes the phone.seen note (phone-note.mjs); an older computer
 *            ignores it, and a laptop can go to sleep mid-song. NEEDED.
 *   1.87.19  the relay heals itself (ForgeFX +relayheal, checkRelay in
 *            desktop/lib/host.mjs). Older, a computer whose channel the server
 *            closed stops answering phones until it is restarted. NEEDED,
 *            and carried by 1.87.23.
 *   1.87.7   the AM4's own tuner screen opens. Older, the phone's tuner
 *            still reads; only the unit's screen stays put. Degrades.
 *   1.86.79  the AM4's tempo and firmware. Older, Tap says the unit has no
 *            tempo and the firmware reads unknown. Degrades.
 *   1.86.70  two computers on one account: drive one, never both. Older,
 *            writes stay refused with two computers; one is unaffected.
 *   1.86.28  the last route a phone sends that the computer must allow (the
 *            looper's buttons). The allowlist has not changed since.
 *   1.87.24 to 1.87.28 need nothing from the computer.
 */
export const COMPUTER_NEEDED = '1.87.23'
