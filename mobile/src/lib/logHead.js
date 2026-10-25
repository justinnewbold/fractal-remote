import { Platform } from 'react-native'

import { APP_VERSION } from './version'
import { linkState } from './link'
import { bluetoothOn } from './bleSwitch'
import { builtInVersion, openForCustomersHere } from './bluetooth'
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

/** The head, as `key: value` pairs; a pair with nothing in it is left out when it is written. */
export function logHeader({ deviceName, preset } = {}) {
  const link = linkState()
  /* Over Bluetooth (beta) no computer is in the chain: the far end is the
     adapter, whose name link.js keeps as macName, and it has no version. */
  const throughAdapter = bluetoothOn() && !isDemo()
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
     */
    'store copy': `${builtInVersion() || 'not readable'} · Bluetooth for customers: ${openForCustomersHere() ? 'open' : 'closed'}`,
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
        })
  }
}

/** The runs before this one, each under its heading, newest first (lib/logKeep pastRuns). */
export const runsBefore = (runs) => beforeBlocks(runs, ended)
