/*
 * ANOTHER UNIT'S ADAPTER, THE ONLY ONE CONNECTED: the words that make the
 * offer the first thing on the page. Pure: a test runs it.
 *
 * "I can't switch over Bluetooth either." (Justin, 19 November 2026, report
 * bf90bfd6.) He stopped Bluetooth on his Axe-Fx III, picked the AM4 and then
 * the FM3, and tapped Connect eight times. Each time Apple's screen showed
 * the one adapter connected, the Axe-Fx III's WIDI Master, the app would not
 * take another unit's adapter without a tap (the 7 November rule), and the
 * one tap that moves it was a smaller button UNDER Connect and its hint,
 * which he never pressed. A customer the same morning, with one adapter and
 * two units: "couldn't find an option to change device".
 *
 * The rule stands: never taken by itself. What changes is where the answer
 * is. With such an adapter here the page says so in a sentence, the button
 * that uses it is the big one, and Connect under it becomes what it does
 * then: look for a different adapter.
 *
 * Kept on the phone, not in shared/bluetooth-gear, which is inside the
 * computer app: a browser has no Bluetooth to say this of.
 */

/** Over the button: why Connect chose nothing, and what the button does. `noun` is the device in hand (shared/device-word). */
export const offerNote = (adapter, unit, other, noun = 'phone') =>
  `${adapter || 'The adapter'} is the only adapter connected to this ${noun}, and it was set up for your ${other || 'other unit'}. If it is plugged into your ${unit || 'unit'} now, use it here.`

/** Connect's own label while the offer is up: what a tap on it does then. */
export const OFFER_LOOK = 'Look for a different adapter'

/**
 * This unit has an adapter of its own and it is not connected (report
 * d9a2f5fe: an FM3 whose WIDI Uhost the iPhone did not have, offered the
 * Axe-Fx III's WIDI Master). Said in the fault's colour over Connect, which
 * stays the big button; the other unit's adapter is offered small, under it.
 */
export const ownAwayNote = (own, unit, noun = 'phone') =>
  `${own || 'Its adapter'}, your ${unit || 'unit'}’s adapter, isn’t connected to this ${noun}. Tap Connect and choose it. If it isn’t there, it is switched off, or another phone, tablet or computer is connected to it.`
