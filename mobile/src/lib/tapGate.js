/**
 * WHETHER THE LINK TO THE RIG IS KNOWN TO BE DOWN, for the writes to ask.
 *
 * "When the link drops, Play says so right away. The tiles go dim under NOT
 * CONNECTED, and a scene tap that can't get through is dropped." link.js
 * decides when the link is down (LINK_DOWN_HOLD_MS in relay-rules) and says
 * so here; device.js and rig.js read it before a tap, and refuse the tap at
 * once with the same words the screen shows, rather than putting it in a
 * queue to land when the link comes back — in the wrong bar of the song.
 *
 * A module of its own with no imports, the way bleSwitch.js is, for two
 * reasons. link.js imports rig.js, so rig.js cannot import link.js back. And
 * device.js and rig.js are copied onto the tests' benches as they are: every
 * import they gain is another stand-in to carry, and this one is one line.
 *
 * Down only ever means down: off the demo, which link.js never marks, and
 * false from the start, so a phone that has not decided yet sends exactly as
 * it always did.
 */

let down = false

/** Whether the link has been down long enough to say so. */
export const linkIsDown = () => down

/** link.js, whenever its answer changes. Anything but true is up. */
export const setLinkDown = (v) => {
  down = v === true
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
