/*
 * WHOSE NAME IS IT? (lib/link readMacName.)
 *
 * The phone reads the computer's name from a small document on that computer
 * (host.name). That read is never held for the roll call (lib/relay
 * neverHeld), so with two computers on one account it is answered by
 * whichever is quicker, while everything about the unit is read off the one
 * picked. Justin's log of 22 November 2026, after Turn off Bluetooth: "the
 * computer is MacBook Pro …", then "the computer has a unit — AM4", and four
 * seconds later "driving raspberry pi 3". The AM4 was the Pi's.
 *
 * So a name is used only where it can be said to be the driven computer's:
 *
 *   'use'    it is: one computer, or the one the roll call chose, by name
 *   'wait'   not known yet: the count has still to say which is driven
 *   'other'  it is another computer's, and the count is over
 *
 * Pure, and imports nothing: test/host-name.mjs runs it whole.
 */
export function nameIsOf({ name, hosts = [], chosen = null, pending = false, mayBeTwo = false } = {}) {
  const many = Array.isArray(hosts) && hosts.length > 1
  if (many) {
    /* Two computers of one name cannot be told apart by it (lib/relay hostConflict says so on screen): the name is right either way. */
    if (chosen && name === chosen) return 'use'
    return pending || !chosen ? 'wait' : 'other'
  }
  /* One heard, or none yet. Only an account whose record says it may have two waits for the count; every other is one computer, named at once as it always was. */
  return pending && mayBeTwo ? 'wait' : 'use'
}
