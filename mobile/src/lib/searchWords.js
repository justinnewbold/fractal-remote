/*
 * WHAT THE BLUETOOTH PAGE SAYS WHILE CONNECT IS LOOKING (screens/Bluetooth,
 * beside a turning circle, from the tap). Justin's log of 22 November 2026:
 * about ten seconds of nothing before the adapters were listed, and Connect
 * pressed twice. Android looks for ten seconds (lib/bluetooth SCAN_SECONDS),
 * so its line says how long; an iPhone or iPad has Apple's screen in front
 * for most of it, and takes a moment after.
 *
 * Pure, and imports nothing.
 */
export const SEARCHING = 'Looking for your adapter…'
export const SEARCHING_LONG = 'Looking for your adapter… this can take about ten seconds.'
export const searchingLine = (os) => (os === 'android' ? SEARCHING_LONG : SEARCHING)
