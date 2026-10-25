import { Platform } from 'react-native'

import { APP_VERSION } from './version'
import { linkState } from './link'
import { bluetoothOn } from './bleSwitch'
import { bluetoothAdmin, bluetoothAllowed, bluetoothFacts, builtInVersion, openForCustomersHere } from './bluetooth'
import { bluetoothHead } from './bleReport'
import { isDemo } from './demo'
import { beforeBlocks } from './report-rules'

/**
 * The head of the phone's log, and its runs before: what Copy Logs puts in
 * a paste and what a report now carries, from one place.
 *
 * These lived in the log screen, inside Copy Logs, and a report had none of
 * them: "Is this all the information the logs send?" A report sent from the
 * log screen or the Feedback form starts with the same head now, and carries
 * the runs before under the same headings, so the email and a paste say the
 * same things.
 */

/** When a kept run last reached the disk, as a clock time. */
export const ended = (at) => (at ? new Date(at).toLocaleTimeString() : 'at an unknown time')

/* What a customer is shown on this copy, after the store copy's number: said on a copy that opens it, or on his account (see THE NUMBER FOR EVERYBODY, below). */
const forCustomers = () => (openForCustomersHere() ? ' · Bluetooth for customers: open' : bluetoothAdmin() ? ' · Bluetooth for customers: closed' : '')

/**
 * The head, as `key: value` pairs; a pair with nothing in it is left out when it is written.
 *
 * `bluetooth` is a report about Bluetooth (beta) (screens/BluetoothReport):
 * its head says how Bluetooth stood even with Bluetooth off, which is where
 * "It won't connect" is sent from, but only to an account Bluetooth is open
 * to (lib/bluetooth bluetoothAllowed), the only one that report is reached by.
 */
export function logHeader({ deviceName, preset, bluetooth = false } = {}) {
  const link = linkState()
  /* Over Bluetooth (beta) no computer is in the chain: the far end is the
     adapter, whose name link.js keeps as macName, and it has no version. */
  const throughAdapter = bluetoothOn() && !isDemo()
  /*
   * HOW BLUETOOTH STOOD, IN THE LOG AND NEVER IN THE DETAILS. Which unit was
   * picked, which answered instead, where the link stood and what was in its
   * way, and the adapter by its name (lib/bleReport bluetoothHead). Over
   * Bluetooth, on every report and every Copy Logs; with it off, only on a
   * report about Bluetooth from an account it is open to. Never on anybody
   * else's: a customer whose copy does not offer Bluetooth gets a head that
   * says nothing about it, as THE NUMBER FOR EVERYBODY, below, says of the
   * store copy. In the log's head and not lib/reports context, which goes
   * with a suggestion too and is listed, field by field, on the privacy page
   * and under the Feedback form's Send.
   */
  const aboutBluetooth = throughAdapter || (bluetooth && bluetoothAllowed())
  return {
    app: `Fractal Remote (phone) v${APP_VERSION}`,
    /*
     * THE STORE COPY UNDER THE UPDATE, and what it means for Bluetooth (beta).
     * `app` above is the update's number, which moves with every merge; this
     * is the version built into the copy the store installed (lib/storeVersion,
     * read once by lib/bluetooth), which no update changes, and which alone
     * decides whether a customer is shown Bluetooth (lib/ble-rule.js). His
     * own account sees it on every copy, so without this line nothing he can
     * read would say the number is read right on a real phone, long before
     * a customer's Bluetooth depends on it. "not readable" is the rule's
     * closed.
     *
     * THE NUMBER FOR EVERYBODY, THE SWITCH ONLY WHERE IT IS NO SECRET. A
     * customer's Copy Logs and every report carry this head, pasted into an
     * email, a forum or a reply to Apple, and "Bluetooth for customers:
     * closed" there names a feature their copy's review notes say they are
     * not shown, and reads as one waiting to be switched on. So the half
     * about Bluetooth is said on a copy that opens it, where it is in the
     * notes, and on his own account; anybody else's head says the number
     * alone, which is all the proof the threshold waits for.
     */
    'store copy': `${builtInVersion() || 'not readable'}${forCustomers()}`,
    platform: `${Platform.OS} ${Platform.Version}`,
    unit: deviceName || 'not detected',
    preset: Number.isInteger(preset?.number) ? `${preset.number} ${preset.name || ''}`.trim() : 'none',
    ...(throughAdapter
      ? { link: `Bluetooth (beta), ${link.link}${link.macName && link.link !== 'off' ? `, through ${link.macName}` : ''}` }
      : {
          computer: link.macName || 'none',
          /*
           * The version at the other end, which is the thing that could not be
           * answered from a pasted log before: "Does the Mac app need to be updated
           * to the latest version?" A computer too old to say so is itself the
           * answer, so that case is named rather than left blank.
           */
          'computer app': link.hostVersion || 'did not say (older than 7.205.0, or could not write it)',
          link: link.link,
          /*
           * And with more than one on the account, which answered and which
           * is driven: "computer: fractalpi" in a log from the AM4's Pi was
           * whichever answered first. Absent with one computer, as before.
           */
          computers: link.hosts?.length > 1 ? `${link.hosts.join(', ')}; driving ${link.chosenHost || 'none of them'}` : undefined
        }),
    ...(aboutBluetooth ? bluetoothHead(bluetoothFacts()) : {})
  }
}

/** The runs before this one, each under its heading, newest first (lib/logKeep pastRuns). */
export const runsBefore = (runs) => beforeBlocks(runs, ended)
