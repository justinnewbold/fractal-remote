/* Generated from shared/password-reset.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * FORGOT PASSWORD?: WHAT IS SAID ONCE THE EMAIL HAS GONE, AT BOTH ENDS.
 *
 * "This app's password reset function does not work... I received the link
 * to reset my password but when I clicked it, it did not ever take me to a
 * page where I can actually make the password change. I tried this on both
 * my computer and my phone." (a customer on the forum, 8 November 2026)
 *
 * He was right, at both ends. Forgot password? asks the account service for
 * the email, and its Reset password button checks the email's token and then
 * opens the website, fractal.newbold.cloud, with a sign-in for the account in
 * the address. Nothing on the website read it: there was no page to type a new
 * password on, and the website's own sign-in quietly took the session out of
 * the address, so the person saw the ordinary site and nothing about a
 * password. That page is src/components/ResetPassword.jsx now, opened before
 * anything else on the website reads the address (src/lib/recoveryLanding.js).
 * The account service and its email are as they were, so every email already
 * sent works from the moment the website does.
 *
 * And the line under Forgot password? said only that a link was coming, with
 * no word of what the link does or where the new password goes. So it says
 * the three steps: the button in the email, the page it opens, then signing
 * in here with the new password. "Here" rather than a device's name, because
 * the line is read on a phone, a tablet, a browser and the computer app.
 *
 * Plain ESM and zero imports, for the browser, Node and Metro alike; the
 * phone's copy is mobile/src/lib/password-reset.js, made by npm run sync:rules.
 */

/** The shortest password either end takes, as Sign in says (src/components/SignIn.jsx, mobile/src/screens/SignIn.js). */
export const PASSWORD_MIN = 6

/** What to do with the email, once it is on its way: its button, the page it opens, then sign in here. */
export const RESET_NEXT = 'Tap Reset password in it, choose a new password on the page that opens, then sign in here with it.'

/** The phone's line under Forgot password? once the account service has taken the request. */
export const RESET_SENT = `Check your email. ${RESET_NEXT}`

/**
 * The website's: the same, with the account service's own caution kept. It
 * answers the same for an address with no account, so nobody can learn from
 * the website which addresses have one.
 */
export const RESET_SENT_IF_ACCOUNT = `If that address has an account, a reset email is on its way. ${RESET_NEXT}`

/*
 * Email me a link to reset it, from an account that is signed in (Settings →
 * your account on the phone, the account page on the website).
 *
 * "When I went to my profile and went send a link to reset password, it didn't
 * do anything. I did not receive an email." (Justin, 8 November 2026.) It had
 * gone, delivered, to the address signed in on that phone, which was not the
 * inbox he looked in; and the line saying so landed on the page behind the
 * sheet as it closed. So the row names the address before the tap, and the
 * tap ends on a message in front of everything that names it again and says
 * what the link does.
 */

/** Under the row, before the tap: where the link will go. */
export const RESET_ROW_SUB = (email) => (email ? `Goes to ${email}` : 'For when the old one is forgotten')

/** The message's title once the account service has taken the request. */
export const RESET_CHECK = 'Check your email'

/** And its words: the address, the email's button, the page it opens. */
export const RESET_SENT_TO = (email) => `A link is on its way to ${email}. Tap Reset password in it and choose a new password on the page that opens.`

/** The title if the account service refused (too soon after the last one, no connection). */
export const RESET_NOT_SENT = 'It did not send'
