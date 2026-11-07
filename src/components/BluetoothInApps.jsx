import { BLUETOOTH_IN_APPS, STORES } from '../../shared/stores.mjs'
import { inDesktopApp } from '../lib/desktop'

/**
 * One line: Bluetooth is in the phone apps, and a web browser connects
 * through a computer only, with the stores it is in (shared/stores.mjs
 * BLUETOOTH_IN_APPS says why). Drawn wherever the website explains
 * connecting: the first screen and the connecting screen, How it works in
 * the walkthrough, Phone & computer, and the unlock page. Nothing in the
 * computer app's own window, which is the computer, and only the stores that
 * are open.
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
