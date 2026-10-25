import { Text } from 'react-native'

import { NO_COMPUTER_BLUETOOTH, NO_COMPUTER_TITLE, noComputerBody } from '../lib/no-computer'
import { useBluetoothOffered } from '../lib/useBluetoothOffered'
import Note from './Note'

/**
 * "No computer is signed in with this account yet", said inside a Note where
 * "make sure the computer is awake" would have been, once the account server
 * has said so for certain (lib/useNoComputer.js).
 *
 * THE ADDRESS IS WORDS, NOT A LINK. The download is for the computer, and a
 * phone sent to the downloads page lands on a page of computer installers it
 * cannot run; the sentence says to go there on that computer. The words are
 * shared/no-computer.mjs's, so the website says the same thing.
 */
export default function NoComputerWords({ email }) {
  return (
    <>
      <Text style={{ fontWeight: '700' }}>{NO_COMPUTER_TITLE}</Text>
      {'\n'}
      {noComputerBody(email)}
    </>
  )
}

/**
 * AND, WHERE THIS COPY OFFERS BLUETOOTH (BETA), THE OTHER WAY, for an AM4:
 * "make it clear that there's multiple ways to connect the device, but also
 * make it clear that the computer is the preferred method". Where Bluetooth
 * is not offered (every customer's copy today: see lib/useBluetoothOffered.js)
 * nothing is drawn, and the screen is exactly what it was. The website's copy
 * (src/components/NoComputer.jsx) never says it: a browser has no Bluetooth
 * (beta).
 *
 * A NOTE OF ITS OWN, drawn after the computer's words AND after the "Send me
 * the download link" button under them, on Settings → Phone & computer. It
 * was once the last lines of the words themselves, so the last thing read
 * before that button was "Bluetooth (beta) says what to buy", and the
 * button, which emails the computer app, read as the link for the Bluetooth
 * parts.
 *
 * NOT ON THE WAITING SCREEN, which has its own way there: "No computer? Use
 * Bluetooth (beta)", after the computer's button, with what it costs under
 * it (App.js Waking). The two together said the same thing twice, in two
 * wordings, the note sending somebody the long way round through Settings to
 * the page the button two rows down opens in one tap.
 *
 * NEVER ON PLAY'S FLOATING CARD (Stage's 'advice' Toast). That card does not
 * scroll and keeps one height so NOT CONNECTED under it stays put; with these
 * lines in it, it roughly doubled, and on a 320-point phone, or with large
 * text, NOT CONNECTED went off the bottom of the screen. Its Troubleshooting
 * button opens It will not connect at all, which says the same line
 * (screens/Fixes.js).
 */
export function NoComputerOtherWay() {
  const offered = useBluetoothOffered()
  return offered ? <Note tone="hint">{NO_COMPUTER_BLUETOOTH}</Note> : null
}
