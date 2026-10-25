import { bluetoothSupported, useBluetoothAllowed } from './bluetooth'
import { usePurchase } from './purchases'
import { mayDrive } from './unlock-rule'

/**
 * Whether this copy of the app offers Bluetooth (beta) to the account signed
 * in here: true exactly when the Bluetooth (beta) row under Settings → My rig
 * is drawn, and so when a sentence may send somebody to it.
 *
 * WHY IT EXISTS. "No computer is signed in with this account yet" told every
 * buyer the computer was the only way. Once Bluetooth (beta) opens to
 * customers (store version 1.89.0, the AM4 only), an AM4 owner may never sign
 * a computer in, and the no-computer words and the Fixes page name the other
 * way (shared/no-computer.mjs NO_COMPUTER_BLUETOOTH) — but only where it is
 * really there to be found. A line pointing at a row that is not drawn sends
 * somebody looking for nothing, and on a copy reviewed without Bluetooth it
 * would be the hidden feature Apple's 2.5.19 and Google's rule on features
 * activated remotely forbid, said out loud.
 *
 * THE ROW'S OWN GATE, word for word and in its order (Settings.js, the
 * `mayDrive(purchase) && bluetoothAllowed && bluetoothSupported()` over the
 * row, held to this by test/no-computer.mjs): the full version, then who may
 * have it, then whether the phone can do it. Asked in that order so a phone
 * it is not open to is never even asked whether it can do Bluetooth, as the
 * row is not.
 *
 * WHO MAY HAVE IT is useBluetoothAllowed(), and nothing here decides it. Today
 * that is Justin's account alone (lib/bluetooth.js allowBluetooth), so on
 * every customer's copy this is false and the words are exactly what they
 * were. The rule that opens it in the new store version goes in behind that
 * same hook, so nothing here changes the day it does.
 */
export function useBluetoothOffered() {
  const purchase = usePurchase()
  const allowed = useBluetoothAllowed()
  return mayDrive(purchase) && allowed && bluetoothSupported()
}
