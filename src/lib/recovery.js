/**
 * CHOOSE A NEW PASSWORD: THE SAVE, AND THE PAGE'S WORDS.
 *
 * The Reset password link in the account service's email lands on the
 * website with a sign-in for the account in the address
 * (lib/recoveryLanding.js reads it and wipes the address). That sign-in is
 * good for one thing here: setting the new password. So the save is made on
 * a client of its own that keeps nothing, never the website's:
 *
 *   - persistSession false: nothing is written to this browser's storage, so
 *     the browser is not signed in to the account by having changed its
 *     password, and the website's own sign-in (src/lib/remote.js) is not
 *     touched, whoever it belongs to;
 *   - autoRefreshToken false: nothing keeps it alive in the background;
 *   - detectSessionInUrl false: it never reads the address itself.
 *
 * setSession with the landing's two tokens, then updateUser with the new
 * password. Done, that one sign-in is signed out (scope 'local', which ends
 * it at the account service too), so the link's sign-in cannot be used
 * again. The account service ends the account's other sign-ins too when its
 * password changes (each at its next renewal, within the hour), which is one
 * more reason the page says to sign in with the new one.
 *
 * Refused for a password that will not do, the same client is kept and
 * asked again with the next one: a sign-in from a link can be renewed only
 * once, and a second client made from the same tokens would be refused.
 */
import { DEFAULT_PROJECT } from '../../desktop/lib/project.mjs'
import { explainAuth } from '../../shared/relay-rules.mjs'
import { PASSWORD_MIN } from '../../shared/password-reset.mjs'

/** The client the save is made on: it keeps nothing, renews nothing, and reads nothing out of the address. */
export const KEEP_NOTHING = Object.freeze({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false })

/* The page's words, in plain English for a guitarist. */
export const RESET_TITLE = 'Choose a new password'
export const resetFor = (email) => (email ? `For ${email}` : null)
export const RESET_FIELD = 'New password'
export const RESET_AGAIN = 'Type it again'
export const RESET_SHOW = 'Show password'
export const RESET_SAVE = 'Save'
export const RESET_SAVING = 'Saving…'
export const RESET_HINT = `At least ${PASSWORD_MIN} characters.`
export const RESET_TOO_SHORT = `Your new password needs at least ${PASSWORD_MIN} characters.`
export const RESET_MISMATCH = 'The two passwords are not the same. Type the new one in both boxes.'
export const RESET_DONE_TITLE = 'Password changed'
export const RESET_DONE = 'Your password is changed. Sign in with it in the app on your phone, tablet or computer.'
export const RESET_TO_SIGN_IN = 'Sign in on the website'
export const RESET_EXPIRED_TITLE = 'This link has expired'
export const RESET_EXPIRED = 'This reset link has expired or was already used. In the app, tap Forgot password? again and use the newest email.'
/** The account service's own rule, said so the next link is used in time: each works once, for an hour (its setting, 3600 seconds). */
export const RESET_LASTS = 'Each reset link works once, within an hour of the email.'
export const RESET_TO_SITE = 'Go to the website'
export const RESET_OFFLINE = 'No connection to the account service. Check the internet and try again.'
export const RESET_SAME = 'That is already this account’s password, so it still works. Sign in with it, or choose a different one here.'
export const RESET_GUESSABLE = 'That password is too easy to guess. Choose a different one.'
export const resetTooShortThere = (n) => `That password is too short. Use at least ${n} characters.`
export const RESET_MIX = 'That password needs more kinds of characters: mix lower-case and capital letters, numbers and symbols.'

/** What is wrong with the two boxes before anything is sent, or null. */
export function passwordProblem(password, again) {
  if (String(password || '').length < PASSWORD_MIN) return RESET_TOO_SHORT
  if (password !== again) return RESET_MISMATCH
  return null
}

const lower = (e) => String(e?.message || e || '').toLowerCase()

/** No answer at all: the fetch failed in one of the ways a browser says so. */
function offline(error) {
  if (error?.name === 'AuthRetryableFetchError' || error?.status === 0) return true
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed/.test(lower(error))
}

/** The link's sign-in is over: used, ended, or past renewing. */
function ended(error) {
  const code = String(error?.code || '')
  if (['session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt', 'otp_expired', 'user_not_found'].includes(code)) return true
  if (error?.status === 401 || error?.status === 403) return true
  return /session missing|refresh token|already used|jwt|expired|session.*not found|does not exist/.test(lower(error))
}

/**
 * The account service's refusal of a new password, in plain words, the way
 * explainAuth (shared/relay-rules.mjs) says a sign-in's: what it means and
 * what to do. `stage` is 'session' for the link's sign-in, where anything
 * but no connection means the link will not work, and 'password' for the
 * save itself.
 *
 * Returns { problem } for one the page shows under the boxes, and
 * { expired: true, problem } for one that ends the page on This link has
 * expired.
 */
export function explainReset(error, stage = 'password') {
  if (offline(error)) return { problem: RESET_OFFLINE }
  if (stage === 'session' || ended(error)) return { expired: true, problem: RESET_EXPIRED }
  const code = String(error?.code || '')
  const m = lower(error)
  if (code === 'same_password' || m.includes('should be different')) return { problem: RESET_SAME }
  const reasons = Array.isArray(error?.reasons) ? error.reasons : []
  if (reasons.includes('pwned') || /known to be weak|easy to guess|pwned|leaked/.test(m)) return { problem: RESET_GUESSABLE }
  const short = m.match(/at least (\d+) characters/)
  if (reasons.includes('length') || short) return { problem: resetTooShortThere(short ? Number(short[1]) : PASSWORD_MIN) }
  if (code === 'weak_password' || reasons.includes('characters') || m.includes('should contain')) return { problem: RESET_MIX }
  return { problem: explainAuth(error?.message || String(error || '')) || RESET_OFFLINE }
}

/**
 * The save, for one landing, as the page uses it: `save(password, again)`
 * resolves to { ok: true }, { ok: false, problem } or { ok: false, expired:
 * true, problem }, and never throws.
 *
 * `createClient` is supabase-js's, loaded when Save is first pressed (the
 * page opens without it); a test hands in its own.
 */
export function makeReset({ landing, createClient, project = DEFAULT_PROJECT } = {}) {
  let client = null
  let signedIn = false
  let done = false
  const make = async () => {
    if (client) return client
    const create = createClient || (await import('@supabase/supabase-js')).createClient
    client = create(project.url, project.anonKey, { auth: { ...KEEP_NOTHING } })
    return client
  }
  return {
    async save(password, again) {
      const fault = passwordProblem(password, again)
      if (fault) return { ok: false, problem: fault }
      if (done) return { ok: true }
      if (landing?.kind !== 'recovery') return { ok: false, expired: true, problem: RESET_EXPIRED }
      let c
      try {
        c = await make()
      } catch (err) {
        return { ok: false, ...explainReset(err) }
      }
      try {
        if (!signedIn) {
          const { data, error } = await c.auth.setSession({ access_token: landing.accessToken, refresh_token: landing.refreshToken })
          if (error || !data?.session) return { ok: false, ...explainReset(error || { message: 'Auth session missing!' }, 'session') }
          signedIn = true
        }
        const { error } = await c.auth.updateUser({ password })
        if (error) return { ok: false, ...explainReset(error) }
      } catch (err) {
        return { ok: false, ...explainReset(err) }
      }
      done = true
      /* Its one job done: that sign-in ends here and at the account service. */
      try {
        await c.auth.signOut({ scope: 'local' })
      } catch {
        // Changed all the same; the sign-in it rode on runs out on its own.
      }
      return { ok: true }
    }
  }
}

/** Where the page's buttons go: the website itself, its sign-in for anybody not signed in, the address plain. */
export const SITE_HOME = '/'
