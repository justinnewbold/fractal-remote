/**
 * When a fault on screen stops being true, as two pure functions and nothing
 * else.
 *
 * Separated from rig.js for the same reason unlock-rule.js is separated from
 * purchases.js: that file imports React and the device layer, so node cannot
 * load it and a rule inside it could only ever be checked by reading the
 * source as text. This is the part that matters — get it backwards and either
 * a working rig carries a red note about being disconnected, or a real fault
 * is swallowed by a reconnect — so it lives here, where a test can call it.
 *
 * Nothing in this file imports anything. That is the point of it.
 */

/**
 * A fault on screen, and whether the link going away is what put it there.
 *
 * `aboutLink` is set by the relay on the two errors that mean the channel was
 * not there: nothing joined yet, and nothing answered. It is deliberately NOT
 * the same flag as `linkDown`, which decides whether a request is sent again
 * — the tap tempo route is excluded from retries because a beat sent twice is
 * a beat that never happened.
 */
export const faultFrom = (err) =>
  err?.notSent
    ? {
        /*
         * A TAP THAT WAS DROPPED (`notSent`: "Not sent — not connected") is
         * not a fault at all, and never touches the fault's fields. It has a
         * field of its own, said briefly — "a dropped tap is said on screen
         * briefly" — under NOT CONNECTED, which already says the lasting part.
         * Kept apart because the card it would otherwise replace can be the
         * only thing on screen saying the tap before it may have reached the
         * unit ("The connection dropped before your computer answered."), with
         * its What to try: one more tap during the outage swapped that for a
         * three-second note, and after the note nothing was left. `droppedLate`
         * is the one dropped with the link still up ("it would have landed
         * late"), which the link coming back does not make untrue.
         */
        dropped: err.message || 'Not sent — not connected',
        droppedLate: err.late === true
      }
    : {
        error: err?.message || 'Something went wrong.',
        errorLink: Boolean(err?.aboutLink)
      }

/**
 * Is this fault withdrawn by the link reaching `link`?
 *
 * "Says I'm not connected to the computer, but it also says I'm connected."
 *
 * Only a complaint ABOUT the link, and only on `connected`. A unit that
 * refused a write is still worth reading after a reconnect, and clearing
 * every message on every reconnect would lose exactly the ones somebody needs
 * on a bad night.
 */
export const withdrawsFault = ({ error = null, errorLink = false } = {}, link) =>
  Boolean(error) && Boolean(errorLink) && link === 'connected'

/*
 * HOW LONG THE PLAY SCREEN SHOWS A FAULT.
 *
 * "Can we just have it be like an overlay toast notification that doesn't
 * move the screen at all?" It floats now, so it no longer moves anything —
 * but a note floating over the preset is only welcome while it is news. Eight
 * seconds is long enough to read between songs and gone before the next one:
 * the same eight App gives "Picked up …".
 */
export const FAULT_SHOWN_MS = 8000

/**
 * How much longer a fault is shown at `now`, in ms: 0 once it has had its
 * time (or there is none), Infinity while it is about the link — that one
 * describes a live condition, and goes when the link is back or on its ✕.
 */
export const faultLeft = ({ error = null, errorLink = false, faultAt = 0 } = {}, now = 0) =>
  !error ? 0 : errorLink ? Infinity : Math.max(0, faultAt + FAULT_SHOWN_MS - now)

/*
 * AND A DROPPED TAP FOR LESS. Long enough to read "Not sent — not connected"
 * at a glance from the floor, short enough to be gone before the next bar:
 * the dimmed tiles and NOT CONNECTED stay up for as long as it is true, so
 * this only has to say what happened to the one tap.
 */
export const NOT_SENT_SHOWN_MS = 3000

/** How much longer a dropped tap is said at `now`, in ms: 0 once it has had its time, or there is none. */
export const droppedLeft = ({ dropped = null, droppedAt = 0 } = {}, now = 0) =>
  !dropped ? 0 : Math.max(0, droppedAt + NOT_SENT_SHOWN_MS - now)

/**
 * Is a dropped tap's note withdrawn by the link reaching `link`? "Not
 * connected" is, on `connected`: left up, it would go on saying so under a
 * bar that says connected. "It would have landed late" is not — it was
 * dropped with the link up, and is still what happened.
 */
export const withdrawsDropped = ({ dropped = null, droppedLate = false } = {}, link) =>
  Boolean(dropped) && !droppedLate && link === 'connected'
