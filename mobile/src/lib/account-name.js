/* Generated from shared/account-name.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * The name on an account: a first name and a last name, both optional, asked
 * for when the account is made and added or changed later in the profile.
 *
 * "I do also wanna start collecting the user's name so when they create an
 * account have them put in their first name and last name and email
 * address." (Justin, 5 November 2026.) So that a support email, a sale or a
 * stuck sign-in on his Developer pages says who it is, not only an address.
 *
 * OPTIONAL SINCE 8 NOVEMBER 2026. "On the sign-up asking first and last
 * name, we can get rid of that if we want and just do that in a profile that
 * they can add later ... But we can make it optional as well. I don't really
 * need their names, it just helps sometimes to have it from communicating
 * with them or finding a user when something's wrong." (Justin, 8 November
 * 2026.) And Apple's guideline 5.1.1 lets an app require only the data that
 * is relevant to what it does, which a name is not: so a required name at
 * sign-up was a review risk for the next store version. The two fields stay
 * on Create account, saying "(optional)" (NAME_HINTS), and either or both may
 * be left empty: nameProblem refuses only a name that is too long, and
 * nameData puts onto the account only the names actually typed, never ''.
 *
 * WHERE IT GOES. Into the account itself, as the account service's own
 * metadata on the user (`options.data` on the sign-up, which it keeps as
 * user_metadata): no table of its own, no new row anywhere. So deleting the
 * account deletes the name with it, the same request that deletes the
 * account (supabase/functions/_shared/forget-account.ts), and nothing else
 * has to be told.
 *
 * WHO IS ASKED. Only the Create account side of the two sign-in forms, the
 * phone's (mobile/src/screens/SignIn.js) and the website's, which is the
 * computer app's too (src/components/SignIn.jsx). Sign in never asks, and an
 * account made before 5 November 2026, or made since with the fields left
 * empty, is never asked afterwards: it simply has no name. Nothing else
 * makes an account through these sign-ups (the old pairing accounts were
 * made by the computer, and Apple's review login by hand), so nothing else
 * needs one. Since 7 November 2026 an account can add, change or clear its
 * name in the phone app (Settings → your account,
 * mobile/src/components/NameBox.js, relay.js changeName, by nameChange
 * below), with the same rules; until it adds one, it has none.
 *
 * WHEN THERE IS NONE. The Developer pages' Customer lookup says so in its
 * Name row (NO_NAME in shared/admin.mjs: none given, a name is optional);
 * the lookup is found by the email, and every list there (Everyone with an
 * account, the trials, the sign-ups) leads with the email and adds the name
 * under it only when there is one.
 *
 * Shared because both forms take it, and a name one end refuses must be
 * refused by the other in the same words. Plain ESM and zero imports, for the
 * browser, Node and Metro alike; the phone's copy is
 * mobile/src/lib/account-name.js, made by npm run sync:rules.
 */

/** The most characters either name may have, once trimmed. */
export const NAME_MAX = 50

/** The two keys the account service keeps them under, read back by the Developer pages' lookup. */
export const NAME_KEYS = { first: 'first_name', last: 'last_name' }

/** What each name is called: the profile's two fields, and the words of what is said about one. */
export const NAME_LABELS = { first: 'First name', last: 'Last name' }

/** The words on Create account's two fields, at both ends, which say either may be left empty. */
export const NAME_HINTS = { first: 'First name (optional)', last: 'Last name (optional)' }

/**
 * A name as it is kept: the spaces at either end taken off, and a run of
 * spaces inside it made one ("Mary  Ann" is "Mary Ann"). Never null.
 */
export function cleanName(typed) {
  return String(typed ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * What is said about the two names before anything is sent, or null when
 * both will do. Either may be empty (since 8 November 2026); each is
 * NAME_MAX characters at most. Asked first name first, the order the fields
 * are in.
 */
export function nameProblem({ first, last } = {}) {
  for (const [key, typed] of [['first', first], ['last', last]]) {
    if (cleanName(typed).length > NAME_MAX) return `Your ${NAME_LABELS[key].toLowerCase()} can be ${NAME_MAX} characters at most.`
  }
  return null
}

/**
 * What goes onto the account as it is made: the sign-up's `options.data`.
 * Only the names actually typed, cleaned; one left empty is left out, never
 * sent as '', so an account made with none has no name at all ({}). Throws
 * the form's own words if a name would not do, so no sign-up can make an
 * account with one the form refuses.
 */
export function nameData({ first, last } = {}) {
  const problem = nameProblem({ first, last })
  if (problem) throw new Error(problem)
  const out = {}
  for (const [key, typed] of [['first', first], ['last', last]]) {
    const name = cleanName(typed)
    if (name) out[NAME_KEYS[key]] = name
  }
  return out
}

/**
 * What changes on the account when the profile saves the name: both keys,
 * each the name typed, cleaned, or null for one left empty. The account
 * service merges `data` into what the account already keeps and takes a key
 * set to null off it, so emptying a field clears that name rather than
 * keeping the old one (and never keeps ''). The same rules and words as
 * nameData.
 */
export function nameChange({ first, last } = {}) {
  const problem = nameProblem({ first, last })
  if (problem) throw new Error(problem)
  return { [NAME_KEYS.first]: cleanName(first) || null, [NAME_KEYS.last]: cleanName(last) || null }
}

/**
 * The name the account service kept, as one line ("Jane Smith"), or '' for
 * an account with none (made before names were asked, or with them left
 * empty). `meta` is the user's user_metadata.
 */
export function nameOn(meta) {
  if (!meta || typeof meta !== 'object') return ''
  return [meta[NAME_KEYS.first], meta[NAME_KEYS.last]].map(cleanName).filter(Boolean).join(' ')
}
