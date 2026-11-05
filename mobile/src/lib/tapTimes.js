/**
 * HOW QUICKLY THE UNIT ANSWERS A TAP, handed from where the taps go
 * (lib/device: a preset, a scene, an effect's on and off and its channel,
 * pressed by the player) to whoever is listening (lib/gearShare, for What
 * works). In milliseconds, from the moment the request went to the moment
 * it came back taken. Nothing is asked of the unit for it: it is the tap the
 * player made anyway, timed.
 *
 * Its own file, with no imports, so lib/device takes nothing with it, and a
 * listener that throws can never break a tap.
 */
let listener = null

/** The one listener, or null to stop. */
export function onTapTime(fn) {
  listener = typeof fn === 'function' ? fn : null
}

/** One tap's time. Never throws. */
export function tapTime(ms) {
  if (!listener) return
  try {
    listener(ms)
  } catch {
    /* What works is never worth a tap. */
  }
}
