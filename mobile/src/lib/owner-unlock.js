/* Generated from shared/owner-unlock.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * Accounts that are unlocked without paying.
 *
 * "Is there any way we can set it up so that my email unlocks the app
 * automatically? I still wanna be able to test with live connections and I'm
 * blocked now by the gate for the unlock."
 *
 * Somebody has to be able to drive a real rig before the thing is on sale,
 * and the person who wrote it is the obvious one. A store cannot help: there
 * is no product to buy yet, and once there is, buying your own app is a
 * refund request waiting to happen.
 *
 * HOW THIS IS SAFE, which is the only interesting part. The list below is
 * PUBLIC — this repository is public and anybody can read it. It grants
 * nothing on its own, because it is a list of ACCOUNTS, and the app only
 * consults it for an account somebody is already signed in as. Reading the
 * list tells you whose account is unlocked; it does not let you become them.
 * The password is the gate, exactly as it is for everything else that account
 * can reach.
 *
 * ACCOUNT IDS, NOT A HASH OF THE ADDRESS. The first version kept an eight-
 * character djb2 hash of the email here, so that no inbox sat in a public
 * file. That made the list a lock it could not be: eight hex characters is 32
 * bits, and djb2 runs backwards, so a DIFFERENT address with the same eight
 * characters can be made in about a second. Sign up with one of those,
 * confirm it, and you were on the list. Found on 8 October 2026, the day the
 * repository went public, before anybody had used it (no account but his own
 * matched either hash).
 *
 * An account's id is the one thing a stranger cannot make: Supabase picks it
 * when the account is created and puts it in every token the account signs
 * in with. Knowing it does not let you become it. And it holds nobody's inbox.
 *
 * Empty for now. The address the old hash stood for has never had an account,
 * so the list never unlocked anybody; his own account is unlocked through
 * RevenueCat like everybody else's. Add one by pasting an account's id (Supabase
 * dashboard → Authentication → Users), and paste the same line into
 * supabase/functions/entitlement — test/server.mjs holds the two together.
 */
export const OWNERS = []

/** An account id as Supabase writes it, a lowercase uuid; anything else is nobody. */
export const accountId = (id) => {
  const at = String(id || '').trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(at) ? at : ''
}

/**
 * Whether this signed-in account is one of them.
 *
 * Takes the id the ACCOUNT SERVICE reports, never anything typed into a box:
 * the caller is `currentAccount()`, which reads it back from the session.
 * Anything that is not an account id is nobody.
 */
export const isOwner = (id) => {
  const at = accountId(id)
  return Boolean(at) && OWNERS.includes(at)
}
