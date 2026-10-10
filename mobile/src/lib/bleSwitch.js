/**
 * WHETHER THE PHONE IS TALKING TO THE UNIT OVER BLUETOOTH, AND THROUGH WHAT.
 *
 * The one thing device.js and link.js need to know about Bluetooth (beta),
 * and nothing more. It imports nothing on purpose: device.js is copied onto
 * the rig bench by the tests, and every import it gains is another stand-in
 * the bench has to carry. A switch with no imports is one line of stand-in.
 *
 * The mode is OFF unless somebody turns it on, and while it is off every
 * answer here is the one that leaves the app exactly as it was: no wire, not
 * on, not over Bluetooth.
 */

let on = false
let live = null

/*
 * WHILE THE ADAPTER IS NOT CONNECTED, A WIRE THAT SAYS SO.
 *
 * With the mode on, nothing may fall through to the computer: a request the
 * phone sends while it is still connecting would otherwise go out over the
 * internet to a computer that may not be there, and answer for a unit the
 * player is not looking at. So between connections the wire is this one, and
 * it refuses everything without sending a byte.
 */
const NOT_YET = {
  request: () =>
    Promise.reject(Object.assign(new Error('The Bluetooth adapter is not connected.'), { status: 503, bluetooth: true }))
}

/**
 * The wire to ask while Bluetooth is on — the live one, or one that refuses
 * while the adapter is not connected — and null when Bluetooth is off, which
 * is the answer that sends every request the usual way.
 */
export const bluetoothWire = () => (on ? live || NOT_YET : null)

/** Whether the player has Bluetooth (beta) turned on. */
export const bluetoothOn = () => on

/** Whether a unit's capabilities came over Bluetooth: the screens that hide editing and saving ask this. */
export const overBluetooth = (caps) => caps?.via === 'bluetooth'

/**
 * Turn the mode on or off, and hand over the wire once the adapter is
 * connected (or null when it drops). Turning it off forgets the wire too, so
 * a stale one can never answer after the player has switched back.
 */
export function setSwitch({ on: next = false, wire = null } = {}) {
  on = next === true
  live = on && wire && typeof wire.request === 'function' ? wire : null
}
