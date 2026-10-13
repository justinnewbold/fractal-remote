/**
 * Confirming a new account with the code in its email, as well as its link.
 *
 * WHY THIS EXISTS. A new account is confirmed by tapping the link in the
 * email the account service sends, and about one new customer in seven never
 * does. The link is the hard part on a phone: it opens a browser, the browser
 * opens the website, and the person is then asked to come back to the app
 * and sign in — three hops, any of which can lose them. So the same email
 * carries a short code too, and the app lets them type it where they already
 * are. The link keeps working exactly as before; this is a second way, not a
 * replacement.
 *
 * Shared because both ends offer it, and somebody who types a code on the
 * phone and then on the website should be refused the same code for the same
 * reason in the same words. The rule for what counts as a code is the
 * account service's: numbers only, six to ten of them (its code length is
 * set on the project, so this does not pin one). Spaces and dashes are taken
 * out first, because a code read off one screen and typed into another
 * picks them up — "123 456", "123-456".
 *
 * Plain ESM and zero imports, for the browser, Node and Metro alike; the
 * phone's copy is mobile/src/lib/confirm-code.js, made by npm run sync:rules.
 * The sign-ins that use it are confirmWithCode in mobile/src/lib/relay.js and
 * in src/lib/remote.js.
 */

/** The fewest and the most digits the account service's code can have. */
export const CODE_DIGITS = { min: 6, max: 10 }

/**
 * The code as the account service wants it, or null when what was typed is
 * not one: spaces and dashes out, then nothing but six to ten digits.
 */
export function cleanCode(typed) {
  const token = String(typed ?? '').replace(/[\s‐-―-]/g, '')
  const { min, max } = CODE_DIGITS
  return new RegExp(`^\\d{${min},${max}}$`).test(token) ? token : null
}

/** What is said, before anything is asked, about something that is not a code. */
export const CODE_NOT_DIGITS = 'Type the code from the email — it is all numbers.'

/** What is said about a code the account service turned down: mistyped, used, or too old. */
export const CODE_DIDNT_WORK = 'That code didn’t work. Check it against the email, or send a new one.'

/**
 * What is said when the code worked and there is still nothing to sign in
 * with: the account service handed back no session (the phone), or the
 * password is no longer in the form (the website). The account is confirmed
 * either way, so the password is all it takes now.
 */
export const CONFIRMED_SIGN_IN = 'Your account is confirmed. Sign in with your email and password.'

/**
 * Whether the account service turned the code itself down.
 *
 * It answers a wrong code and an expired one alike — "Token has expired or is
 * invalid", code otp_expired — and nothing the person can see tells the two
 * apart either, so both get CODE_DIDNT_WORK. Anything else (no signal, the
 * service down) is not about the code, and is said the way every other
 * sign-in failure is (explainAuth).
 */
export const codeRefused = (error) =>
  error?.code === 'otp_expired' || /expired or is invalid/i.test(String(error?.message || ''))
