/* Generated from shared/no-computer.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * "No computer is signed in with this account yet", and when it may be said.
 *
 * WHY THIS EXISTS. About twelve of the first forty paid accounts had never
 * signed in on a computer, and when the phone (or the website away from
 * home) could not find one it told them to open the Fractal Remote app on
 * the computer and make sure the computer was awake — advice about a
 * computer that was never set up. What Justin approved on 13 October 2026:
 * "Clearer help for new customers. 'No computer is signed in with this
 * account yet, here's the download' instead of 'make sure it's awake.'"
 *
 * The account server can tell (supabase/migrations/20261014_account_has_computer.sql):
 * true when a computer app has signed in with the caller's own account and
 * not signed out, false when none has, nothing when there is no caller.
 *
 * UNKNOWN IS NEVER A NO. No signal, an error, a database without the
 * function yet, no session: each of those keeps today's words exactly, and
 * so does a computer on this wifi on another account, whose own message
 * (computer_elsewhere) is the truer one and always wins. Only a definite
 * false from the account server, about the account signed in here, changes
 * the advice.
 *
 * ASKED RARELY. Only once the link has been looking for a while without an
 * answer — the moment the old advice comes up — no more than once a minute,
 * and never again once the answer has been yes: a computer that has signed
 * in once stays signed in for the rest of the run, and so does one that has
 * just answered on the relay (`seen`).
 *
 * Plain ESM and zero imports, for the browser, Node and Metro alike; the
 * phone's copy is mobile/src/lib/no-computer.js, made by npm run sync:rules.
 * Each end has one `computerCheck` for the whole run: mobile/src/lib/useNoComputer.js
 * and src/lib/noComputer.js.
 */

/**
 * Where the computer app is downloaded, said as an address to type ON the
 * computer. The same address as DOWNLOADS_URL in mobile/src/lib/downloadLink.js,
 * and a test holds the two together.
 */
export const NO_COMPUTER_ADDRESS = 'fractal.newbold.cloud/downloads'

/** The first line, said on its own. */
export const NO_COMPUTER_TITLE = 'No computer is signed in with this account yet.'

/**
 * What to do about it, naming the account to sign in with. With no email to
 * name (never expected: every account here is an email), the same sentence
 * says "this same account".
 */
export function noComputerSteps(email) {
  const who = String(email || '').trim() || 'this same account'
  return `Install the Fractal Remote computer app on the computer your Fractal is plugged into, and sign in there with ${who}.`
}

/** And where, up to the address — the browser makes the address a link, the phone does not. */
export const NO_COMPUTER_GO = 'On that computer, go to'

/** Everything after the first line, as the phone shows it: the address as plain text. */
export const noComputerBody = (email) => `${noComputerSteps(email)} ${NO_COMPUTER_GO} ${NO_COMPUTER_ADDRESS}.`

/** How long after one question before another may be asked. */
export const ASK_EVERY_MS = 60 * 1000

/**
 * The account server's answer, read the only way it may be: true and false
 * are answers, and everything else — an error, a missing function, a null
 * for no caller, anything unexpected — is "can't tell".
 */
export function hasComputerFrom(reply) {
  if (!reply || reply.error) return null
  if (reply.data === true) return true
  if (reply.data === false) return false
  return null
}

/**
 * One end's memory of the answer, for the whole run.
 *
 * `ask()` asks the account server about the account signed in there and
 * resolves true, false, or null for can't tell; it may throw, which is a
 * can't tell. `now` is the clock.
 *
 *   poke({ id, email })  asks, when it may: somebody signed in, no yes yet
 *                        for them, and a minute since the last question
 *   seen(id)             a computer on this account just answered: yes
 *   none(id)             { email } when the last answer about this account
 *                        was a definite no, and null otherwise
 *   subscribe(fn)        told when an answer lands
 *
 * A different account starts again from nothing: one account's yes is not
 * another's, and nor is its no.
 */
export function computerCheck(ask, now = () => Date.now()) {
  let who = null
  let email = ''
  let yes = false
  let no = false
  let askedAt = null
  let out = null
  const listeners = new Set()
  const tell = () => {
    for (const fn of listeners) {
      try {
        fn()
      } catch {
        // One bad listener shouldn't stop the others.
      }
    }
  }
  const meet = (id, mail) => {
    if (id === who) {
      if (mail) email = mail
      return
    }
    who = id
    email = mail || ''
    yes = false
    no = false
    askedAt = null
    out = null
  }
  /*
   * Whether a question may go now. A clock that went backwards asks again
   * rather than waiting for ever; one still out after a minute is given up
   * on, and its answer, if it ever comes, is not listened to.
   */
  const due = (id, at) => {
    if (!id) return false
    if (id !== who) return true
    if (yes) return false
    if (askedAt === null || at < askedAt) return true
    return at - askedAt >= ASK_EVERY_MS
  }
  async function poke(me) {
    const id = me?.id || null
    const at = now()
    if (!due(id, at)) return
    meet(id, me.email)
    askedAt = at
    const mine = (out = Promise.resolve()
      .then(ask)
      .then(
        (v) => (v === true ? true : v === false ? false : null),
        () => null
      ))
    const has = await mine
    if (who !== id || out !== mine) return
    out = null
    if (has === true) yes = true
    no = !yes && has === false
    tell()
  }
  function seen(id) {
    if (!id) return
    meet(id)
    if (yes && !no) return
    yes = true
    no = false
    tell()
  }
  /* The same object for as long as the answer and the email stay the same,
     so a screen handed it is not handed a new one on every draw. */
  let said = null
  function none(id) {
    if (!id || id !== who || yes || !no) return null
    if (!said || said.email !== email) said = { email }
    return said
  }
  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
  return { poke, seen, none, subscribe }
}
