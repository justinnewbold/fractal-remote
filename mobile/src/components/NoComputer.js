import { Text } from 'react-native'

import { NO_COMPUTER_TITLE, noComputerBody } from '../lib/no-computer'

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
