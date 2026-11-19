/*
 * SWITCH UNIT IN ONE TAP, WHILE BLUETOOTH IS ON. Pure: a test runs it.
 *
 * "Users need to be able to switch almost immediately from Bluetooth device
 * to a new Bluetooth device" (Justin, 19 November 2026, reports bf90bfd6 and
 * d9a2f5fe). Changing unit was Stop, pick the unit, Connect, and with the
 * other unit's adapter not connected, Apple's screen as well.
 *
 * So the page that is drawn while Bluetooth is on has the units on it, and a
 * tap on another one switches. BLUETOOTH ALWAYS STOPS FIRST: the page keeps
 * its unit chips shut while it is on because a new unit's messages sent to
 * whatever is on the adapter froze an AM4 once. It comes straight back on
 * ONLY where that is safe and can work: the unit tapped has an adapter of
 * its own, it is another adapter than the one just in use, it is a Bluetooth
 * adapter and not a cable, and it is connected to the device now. Anything
 * else lands on Connect with the unit already picked, one tap from there.
 */

export { switchPlan } from './bleAdapters.js'

/** Over the units, while it is on. */
export const SWITCH_UNIT = 'Switch unit'
/** Under them: what a tap does, with nothing promised that the tap may not do. */
export const SWITCH_UNIT_HINT = 'Tap another unit to switch to it. Bluetooth stops first, and connects again by itself when that unit’s own adapter is connected.'
