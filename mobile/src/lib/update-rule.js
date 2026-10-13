/**
 * WHEN THE PHONE SWITCHES TO A DOWNLOADED VERSION BY ITSELF, as one pure
 * function and nothing else.
 *
 * "How can I be sure it would never do it midsong?" (13 October 2026.) Until
 * then the app downloaded every update in the background and only ever
 * OFFERED it — a Restart now bar — so a phone that was never closed carried
 * an old version for as long as nobody tapped the bar. Justin's own sat on
 * 1.87.12 while 1.87.21 was out.
 *
 * So now it switches by itself, and only when every one of these is true at
 * that moment:
 *
 *   - the new version has finished downloading ('ready');
 *   - the app is COMING BACK to the screen, after at least two hours away —
 *     closed, in the background, or the phone locked. Two hours is longer
 *     than any break between sets. The switch happens in the moment it comes
 *     back, never while it is already on screen, and never on a timer while
 *     it is open;
 *   - it is not on the rig: not connected to the computer, not connected to
 *     the Bluetooth adapter, and not in the middle of joining either — now,
 *     or when it went away (unless that was a night ago: see below).
 *
 * If any one is false it waits, and the Restart now offer stays exactly as it
 * was. Waiting is always the safe answer: the version on the phone works, and
 * the next time all of it is true the switch happens then.
 *
 * WHY A SWITCH OUTSIDE A SONG IS SAFE AT ALL: the sound never depends on this
 * app. The unit plays on its own, whatever the phone is doing — the phone only
 * tells it which preset and scene to be on. A switch takes the app away for a
 * second and brings it back, and the worst it can cost is a tap that waits
 * for it. These rules are there so that it never costs even that in the
 * middle of a song.
 *
 * WHY "WHEN IT WENT AWAY" AS WELL AS "NOW". What the link says when the app
 * comes back is not always what is true. Android cuts the connection while an
 * app is put away, so a phone that was on the rig comes back saying 'joining'
 * (not joined) with the rig still standing there; an iPhone comes back with
 * whatever it said before it was frozen. So the rig as it was when the app
 * left the screen decides as much as the rig now: a phone put away while
 * connected, or while reaching for the rig, waits, whatever it says on the
 * way back. So does one that connected at any point while it was away — a
 * tap on the watch reaches the rig with the phone still locked, and the
 * phone taken out mid-song after it is exactly the moment this is for
 * (lib/updates.js writes that down).
 *
 * BUT ONLY FOR A NIGHT. "Connected" means the computer app answers, not that
 * a song is playing, and a computer that is always on — a Pi started at boot,
 * a Mac kept awake — answers every time the phone is put down. Held for ever,
 * a phone like that would never switch by itself, which is how Justin's sat
 * on 1.87.12 in the first place. So what the rig was when the phone went away
 * holds the switch for eight hours from the last time it was on the rig (put
 * away connected, or a connection heard while away), and no longer. Eight
 * hours is a night, and longer than any set or the breaks between them; a
 * watch tap mid-song starts the eight hours again, so a phone picked up just
 * after one still waits. What the rig says NOW holds it whatever the hour —
 * with one exception, the next paragraph.
 *
 * THE 'connected' AN IPHONE WAKES UP WITH. An iPhone freezes the app while it
 * is put away: nothing in it runs, so the link cannot change its word, and
 * it comes back saying 'connected' because that is what it said before the
 * freeze. Taken at its word, an iPhone always put away connected — Justin's,
 * once the computer is kept awake — would never switch, the eight hours
 * above notwithstanding. So over the computer that word holds the switch only
 * if the computer has answered within the last eight hours. A link that is
 * really up is asked every eight seconds while the app runs (KEEPALIVE in
 * lib/link.js) and says 'no-answer' the moment a question goes unanswered, so
 * 'connected' with nothing heard for a night is a word left over from the
 * freeze, never a live link; and the phone must have been away for a night
 * too. A watch tap with the phone locked brings answers, so a phone picked
 * up after one still waits, as above. Over Bluetooth the word is taken as it
 * is: the phone's own Bluetooth holds the adapter while the app sleeps, so
 * there it may be true. And the only turn of the link that can be out under
 * the word 'connected' is that eight-second question to a link that has
 * been silent all night: a join says 'joining' first, and is counted.
 *
 * And 'joining' NOW only counts when a join is really under way (link.js
 * joiningNow, bleLink bluetoothJoining): otherwise every Android phone signed
 * in to a computer would come back 'joining' and never switch.
 *
 * The demo says 'connected' (lib/link.js) and is treated as it says: a phone
 * left in the demo waits for a fresh start or the Restart now button.
 *
 * Nothing in this file imports anything, so the rules can be called with
 * every combination by test/mobile.mjs, and a loosened rule fails there.
 */

/** Two hours: longer than any break between sets. */
export const AWAY_MS = 2 * 60 * 60 * 1000

/** Eight hours: a night. After this, the rig as it was when the phone went away stops holding the switch (see above). */
export const NIGHT_MS = 8 * 60 * 60 * 1000

/*
 * THE COMPUTER'S LAST ANSWER IS A TIME ON THE RIG TOO. The words above only
 * move when the link changes its word, and a link that keeps answering under
 * one 'connected' moves nothing — so a phone whose word dropped to
 * 'no-answer' a minute before it was picked up would count its night from
 * the first connection, not from the answer a minute ago. And a phone put
 * down during a missed keepalive (the word 'no-answer' for a few seconds,
 * the computer heard just before) would be written down as off the rig. So
 * an answer from the computer while the phone was away, or in the twenty
 * seconds before it went (one keepalive and the question's own wait), counts
 * as the phone being on the rig at that moment.
 */
export const LEFT_GRACE_MS = 20 * 1000

/*
 * The rig in the words that decide this. `link` is lib/link.js's word ('off',
 * 'joining', 'no-answer', 'connected'); `joining` is whether an attempt to
 * reach the computer or the adapter is under way right now; `bluetooth` is
 * lib/bluetooth.js's phase ('connected', 'connecting', 'idle', 'off', …).
 * The rig NOW has two more: `via`, what the link is to ('computer',
 * 'bluetooth' or 'demo'), and `heardAgoMs`, how long since the computer last
 * answered anything (lib/relay.js lastAnswerAt).
 */

/** Why the rig, as it stood when the app went away, says wait — or null. Said while it was on screen, so its words are true. */
function onRigWhenLeft(rig) {
  if (rig.link === 'connected') return 'it was connected when it went away, or while it was away'
  if (rig.link === 'joining' || rig.joining) return 'it was joining the rig when it went away'
  if (rig.bluetooth === 'connected') return 'it was on Bluetooth when it went away'
  if (rig.bluetooth === 'connecting') return 'it was looking for the Bluetooth adapter when it went away'
  return null
}

/**
 * Whether the word 'connected' NOW is the one an iPhone wakes up with rather
 * than a link (see above): over the computer, back after a night away, and
 * nothing heard from the computer for a night either. Anything it cannot
 * read — no `via`, no number — is a link, and holds the switch.
 */
function leftOverFromSleep(rig, awayMs) {
  if (rig.via !== 'computer') return false
  if (!(Number.isFinite(rig.heardAgoMs) && rig.heardAgoMs >= NIGHT_MS)) return false
  return Number.isFinite(awayMs) && awayMs >= NIGHT_MS
}

/** Why the rig, now, says wait — or null. Only what a sleep cannot have made up. */
function onRigNow(rig, awayMs) {
  if (!rig) return 'the rig cannot be read'
  if (rig.link === 'connected' && !leftOverFromSleep(rig, awayMs)) return 'it is connected'
  if (rig.joining) return 'it is joining the rig'
  if (rig.bluetooth === 'connected') return 'it is on Bluetooth'
  return null
}

const hours = (ms) => (Number.isFinite(ms) ? `${Math.floor(ms / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min` : 'for an unknown time')

/**
 * Switch to the downloaded version now? `{ yes, why }`, where `why` is a
 * sentence for the log either way.
 *
 *   phase      lib/updates.js's phase; only 'ready' is a version waiting
 *   back       true only for the moment the app comes back on screen
 *   awayMs     how long it was off the screen before that
 *   left       the rig as it was when the app went away, and 'connected'
 *              if it connected at any point while it was away
 *   leftAgoMs  how long ago the rig was last as `left` says: since the app
 *              went away, or since the last connection heard while away.
 *              Missing or unreadable counts as just now
 *   now        the rig at this moment, with `via` and `heardAgoMs`
 */
export function shouldApplyNow({ phase, back = false, awayMs = 0, left = null, leftAgoMs = 0, now = null } = {}) {
  if (phase !== 'ready') return { yes: false, why: 'no new version has finished downloading' }
  if (back !== true) return { yes: false, why: 'the app is already on screen' }
  if (!(Number.isFinite(awayMs) && awayMs >= AWAY_MS)) {
    return { yes: false, why: `away ${hours(Math.max(0, Number(awayMs) || 0))}, under 2 h` }
  }
  if (!left) return { yes: false, why: 'nothing was written down when it went away' }
  let then = onRigWhenLeft(left)
  /* Never longer ago than it went away: the rig cannot have been heard before that. */
  let since = Number.isFinite(leftAgoMs) ? Math.max(0, Math.min(leftAgoMs, awayMs)) : 0
  if (now && now.via === 'computer' && Number.isFinite(now.heardAgoMs) && now.heardAgoMs >= 0 && now.heardAgoMs <= awayMs + LEFT_GRACE_MS) {
    const ago = Math.min(now.heardAgoMs, awayMs)
    since = then ? Math.min(since, ago) : ago
    then = then || 'the computer answered it just before it went away, or while it was away'
  }
  if (then && since < NIGHT_MS) return { yes: false, why: `${then}, ${hours(since)} ago (under 8 h)` }
  const here = onRigNow(now, awayMs)
  if (here) return { yes: false, why: here }
  /* Said, so a log shows the one 'connected' that did not hold it, and why. */
  const woke = now.link === 'connected' ? ` (it says connected, but the computer has not answered for ${hours(now.heardAgoMs)}: the word from before the phone slept)` : ''
  if (then) return { yes: true, why: `away ${hours(awayMs)}, last on the rig ${hours(since)} ago, and not on it now${woke}` }
  return { yes: true, why: `away ${hours(awayMs)}, and not on the rig then or now${woke}` }
}
