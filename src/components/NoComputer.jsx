import { NO_COMPUTER_ADDRESS, NO_COMPUTER_GO, NO_COMPUTER_TITLE, noComputerSteps } from '../../shared/no-computer.mjs'

/**
 * "No computer is signed in with this account yet", where "make sure the
 * computer is awake" would have been, once the account server has said so
 * for certain (lib/noComputer.js).
 *
 * The phone's words (shared/no-computer.mjs), with one difference: here the
 * address is a link, because a browser may be on the very computer it is
 * about. On the phone it is plain words — the download is for the computer.
 */
export default function NoComputer({ email, className }) {
  /* `no-computer` gives the address a colour that reads on the dark page
     (styles.css): the browser's own link blue was about 2:1 on it, on the
     one thing here a new customer has to click. */
  return (
    <p className={className ? `no-computer ${className}` : 'no-computer'} role="status">
      <strong>{NO_COMPUTER_TITLE}</strong>
      <br />
      {noComputerSteps(email)} {NO_COMPUTER_GO}{' '}
      <a href={`https://${NO_COMPUTER_ADDRESS}`} target="_blank" rel="noreferrer noopener">
        {NO_COMPUTER_ADDRESS}
      </a>
      .
    </p>
  )
}
