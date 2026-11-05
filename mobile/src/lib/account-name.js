/* Generated from shared/account-name.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * The name on an account: a first name and a last name, asked for when the
 * account is made, and only then.
 *
 * "I do also wanna start collecting the user's name so when they create an
 * account have them put in their first name and last name and email
 * address." (Justin, 5 November 2026.) So that a support email, a sale or a
 * stuck sign-in on his Developer pages says who it is, not only an address.
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
 * account made before this is never asked afterwards: it simply has no name,
 * and the lookup says so. Nothing else makes an account through these
 * sign-ups (the old pairing accounts were made by the computer, and Apple's
 * review login by hand), so nothing else needs one.
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

/** The words on the two fields, at both ends. */
export const NAME_LABELS = { first: 'First name', last: 'Last name' }

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
 * both will do: each is needed, and each is NAME_MAX characters at most.
 * Asked first name first, the order the fields are in.
 */
export function nameProblem({ first, last } = {}) {
  for (const [key, typed] of [['first', first], ['last', last]]) {
    const name = cleanName(typed)
    const word = NAME_LABELS[key].toLowerCase()
    if (!name) return `Type your ${word}.`
    if (name.length > NAME_MAX) return `Your ${word} can be ${NAME_MAX} characters at most.`
  }
  return null
}

/**
 * What goes onto the account as it is made: the sign-up's `options.data`.
 * Throws the form's own words if the names would not do, so no sign-up can
 * make an account without them.
 */
export function nameData({ first, last } = {}) {
  const problem = nameProblem({ first, last })
  if (problem) throw new Error(problem)
  return { [NAME_KEYS.first]: cleanName(first), [NAME_KEYS.last]: cleanName(last) }
}

/**
 * The name the account service kept, as one line ("Jane Smith"), or '' for
 * an account made before names were asked for. `meta` is the user's
 * user_metadata.
 */
export function nameOn(meta) {
  if (!meta || typeof meta !== 'object') return ''
  return [meta[NAME_KEYS.first], meta[NAME_KEYS.last]].map(cleanName).filter(Boolean).join(' ')
}
