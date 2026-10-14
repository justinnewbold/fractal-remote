/**
 * WHETHER THE LINK TO THE RIG IS KNOWN TO BE DOWN, for the writes to ask —
 * the browser's half of mobile/src/lib/tapGate.js.
 *
 * "When the link drops, Play says so right away. The tiles go dim under NOT
 * CONNECTED, and a scene tap that can't get through is dropped." link.js
 * decides when the link is down and says so here; forgefx.js reads it before
 * a tap and refuses the tap at once, with the words the screen shows, rather
 * than sending it into a relay that would hold it and land it late.
 *
 * ONLY A PHONE ON THE WEB APP, the 'remote' role, is ever marked down or
 * relayed. The computer's own window ('mac') and a phone on the computer's
 * wifi page ('wifi') reach the device server directly, and there 'off' means
 * the phone remote is switched off, not that the rig is out of reach. Both
 * stay false there, so those two ends send exactly as they always did.
 *
 * No imports, so forgefx.js and link.js can both read it without either
 * importing the other, and the tests can load it as it is.
 */

let down = false
let relayed = false

/** Whether the link has been down long enough to say so. */
export const linkIsDown = () => down

/** Whether this browser reaches the rig through the relay at all: the 'remote' role. */
export const tapsRelayed = () => relayed

/** link.js, whenever its answer changes. Anything but true is up. */
export const setLinkDown = (v) => {
  down = v === true
}

/** link.js, once the role is known. Anything but true is the computer's own window or its wifi page. */
export const setTapsRelayed = (v) => {
  relayed = v === true
}

/*
 * HOW LONG THE LINK HAS BEEN AWAY, IN ALL — every stretch it spent off
 * 'connected', added together — for a setlist song's scene and tempo to ask
 * whether the preset before them was held up by it (relay-rules
 * songWouldLandLate). link.js says when the link leaves and comes back; the
 * clock is the caller's, so the benches' hand-turned one runs it too.
 */
let awayFrom = 0
let awayBefore = 0

/** The time the link has spent away from 'connected', up to `now`. */
export const linkAwayMs = (now) => awayBefore + (awayFrom ? Math.max(0, now - awayFrom) : 0)

/** link.js: away (true) as the link leaves 'connected', back (false) as it arrives. */
export const setLinkAway = (away, now) => {
  if (away === true && !awayFrom) awayFrom = now
  if (away !== true && awayFrom) {
    awayBefore += Math.max(0, now - awayFrom)
    awayFrom = 0
  }
}
