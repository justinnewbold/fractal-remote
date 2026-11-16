/**
 * THE UNIT'S OWN BEAT, HANDED ON.
 *
 * Over Bluetooth or the USB cable a gen-3 unit's tempo beat reaches this
 * device itself (bleWire hands it to rig.handleEvent as `{ type: 'beat',
 * at }`). The store passes it on here, and whoever is keeping this device's
 * beat beside the unit listens (lib/unitBeat, lib/beatLock). Nothing else
 * hears it, and with nobody listening it goes nowhere.
 *
 * Its own file, importing nothing, so the store can hand a beat on without
 * knowing who wants it.
 */
const listeners = new Set()

/** Listen for the unit's beat: `fn(at)`, `at` this device's clock when it came. Answers a function that stops. */
export function onUnitBeat(fn) {
  if (typeof fn !== 'function') return () => {}
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** A beat this device heard itself, at `at` on its own clock. */
export function unitBeatHeard(at) {
  for (const fn of [...listeners]) {
    try {
      fn(at)
    } catch {
      // One listener cannot stop another hearing the beat.
    }
  }
}
