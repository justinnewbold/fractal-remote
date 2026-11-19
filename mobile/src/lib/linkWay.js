/*
 * HOW THE APP IS CONNECTED, AS ONE WORD FOR A REPORT.
 *
 * "Can't tell if this was on a computer or Bluetooth." (Justin, 19 November
 * 2026, of a customer's report whose details said "role: connected" and
 * nothing of which way.) A report's details had the link's own word for its
 * state and never the road it was on, so a report with no log (a suggestion,
 * or one with the log unticked) could not say.
 *
 * THE WAY ONLY, NEVER THE ADAPTER'S OR THE CABLE'S NAME. The privacy page's
 * list for a report says "how the app is connected", which this is; an
 * adapter's name goes only in a log, which the player can read and leave out.
 *
 * A unit on a USB cable into the device goes over the same wire as Bluetooth
 * (lib/link linkVia says 'bluetooth'); lib/bluetooth cableNow tells it apart,
 * as the gear notes do (lib/gearShare factsNow).
 */
import { cableNow } from './bluetooth'
import { linkVia } from './link'

/** The word for a way. Pure: a test runs it. Anything unknown is left out of the report. */
export const wayWord = (via, cable = false) =>
  via === 'bluetooth' ? (cable === true ? 'USB cable' : 'Bluetooth') : via === 'computer' ? 'computer' : via === 'demo' ? 'demo' : undefined

/** How this device is connected now. */
export const connectionWord = () => wayWord(linkVia(), cableNow())
