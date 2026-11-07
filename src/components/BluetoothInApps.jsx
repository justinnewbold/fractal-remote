import { BLUETOOTH_IN_APPS, STORES } from '../../shared/stores.mjs'
import { inDesktopApp } from '../lib/desktop'

/**
 * One line: Bluetooth is in the iPhone, iPad and Android apps, and a web
 * browser connects through a computer only, with the stores it is in
 * (shared/stores.mjs BLUETOOTH_IN_APPS says why). Drawn wherever the website
 * explains connecting: first, under the heading, on every screen of the
 * connect page (the first screen, Connecting…, Your computer isn't answering
 * and Connect to your computer), on Phone & computer and in Troubleshooting;
 * and under How it works in the walkthrough and on the unlock page. Nothing
 * in the computer app's own window, which is the computer, and only the
 * stores that are open.
 */
export default function BluetoothInApps({ className = 'hint' }) {
  if (inDesktopApp()) return null
  const open = STORES.filter((s) => s.live)
  return (
    <p className={`${className} bluetooth-in-apps`}>
      {BLUETOOTH_IN_APPS}
      {open.map((s, i) => (
        <span key={s.key}>
          {i ? ' · ' : ' '}
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.store}
          </a>
        </span>
      ))}
    </p>
  )
}
