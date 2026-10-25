import { Text } from 'react-native'

import { NO_COMPUTER_BLUETOOTH, NO_COMPUTER_TITLE, noComputerBody } from '../lib/no-computer'
import { useBluetoothOffered } from '../lib/useBluetoothOffered'

/**
 * "No computer is signed in with this account yet", said inside a Note where
 * "make sure the computer is awake" would have been, once the account server
 * has said so for certain (lib/useNoComputer.js).
 *
 * THE ADDRESS IS WORDS, NOT A LINK. The download is for the computer, and a
 * phone sent to the downloads page lands on a page of computer installers it
 * cannot run; the sentence says to go there on that computer. The words are
 * shared/no-computer.mjs's, so the website says the same thing.
 *
 * AND, WHERE THIS COPY OFFERS BLUETOOTH (BETA), THE OTHER WAY, for an AM4,
 * under the computer's: "make it clear that there's multiple ways to connect
 * the device, but also make it clear that the computer is the preferred
 * method". After the computer's steps, never before them, and in the same
 * note rather than one of its own, so the waiting screen, Settings → Phone &
 * computer and the card on Play all say it the same way from this one place.
 * Where Bluetooth is not offered (every customer's copy today: see
 * lib/useBluetoothOffered.js) nothing is added, and the note is word for word
 * what it was. The website's copy (src/components/NoComputer.jsx) never says
 * it: a browser has no Bluetooth (beta).
 */
export default function NoComputerWords({ email }) {
  const bluetooth = useBluetoothOffered()
  return (
    <>
      <Text style={{ fontWeight: '700' }}>{NO_COMPUTER_TITLE}</Text>
      {'\n'}
      {noComputerBody(email)}
      {bluetooth ? `\n\n${NO_COMPUTER_BLUETOOTH}` : null}
    </>
  )
}
