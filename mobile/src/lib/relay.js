/**
 * The phone end of the link to the Mac.
 *
 * ForgeFX on the Mac acts as a host agent: signed in to Supabase, it subscribes
 * to the private channel `remote:<uid>` and executes allowlisted requests
 * against its own local server, replying on the same channel. This is the other
 * end of that — the phone in your hand at the far side of a stage.
 *
 * The channel is private and RLS-scoped to one user, so both ends must be
 * signed in as the same person. That is the whole of the security model, and it
 * is a good one: nobody else can join, by construction rather than by
 * convention.
 *
 * This is a port of src/lib/remote.js, not a redesign. Every behaviour here was
 * paid for on a stage — the grace period around a dropped socket, the roll call
 * that counts how many Macs are listening, the refusal to write while more than
 * one is. Three things differ, and only because the platform differs: the
 * session is kept in AsyncStorage rather than localStorage, payloads are
 * decoded without browser APIs (see decode.js), and the rules that must match
 * the host word for word are a generated copy (see relay-rules.js).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { logDebug } from './debugLog'

import { DEFAULT_PROJECT } from './project'
import { decode } from './decode'
import { withRetry } from './retry'
import { notForever } from './notForever'
import {
  RELAY_GRACE,
  NOT_IN_INBOX,
  explainAuth,
  forbiddenRemotely,
  notConfirmed,
  sentAgain,
  hostConflict as conflictBetween,
  hostNamesFrom as namesFrom,
  firstUnitHost,
  rollCallLine,
  unitChoices,
  unitFrom,
  repeatable,
  timeoutFor,
  notSentError,
  pastDeadline,
  newestPresses,
  sendsOnce,
  tapDeadline,
  readPicks,
  writePicks,
  pickEntry
} from './relay-rules'
import { CODE_DIDNT_WORK, CODE_NOT_DIGITS, CONFIRMED_SIGN_IN, cleanCode, codeRefused } from './confirm-code'
import { deviceNoun } from './device-word'

export { DEFAULT_PROJECT, RELAY_GRACE, forbiddenRemotely, explainAuth, NOT_IN_INBOX, sentAgain }

let client = null
let channel = null // the joined channel, and null the moment it stops being joined
let session = null // what we built: the channel object and the client it belongs to
let userId = null
/*
 * A rejoin is under way. Between disconnect tearing the old session down and
 * the new one being registered there is no session at all, and a request caught
 * in that window would otherwise be told "not connected" and give up — over a
 * link that was seconds from coming back.
 */
let connecting = false
let hostSeen = false
let answeredAt = 0

const waiting = new Map()
const listeners = new Set()
const watchers = new Set()
const seers = new Set()

/* Every Mac that answered the last roll call, by the name it calls itself. */
let hosts = []
/** Which of them requests are addressed to. Null while there is only one. */
let chosen = null
/** How that one was chosen, for the log: 'pick' or 'first' (see rollCallLine). */
let chosenWhy = null
/** Whether addressing one Mac has been PROVED to leave the others out. */
let targeted = false
/** Which unit each of them is driving, by name, when it could be told: see readUnits. */
let units = {}
/** Roll calls in progress: an id, and every answer that has come back to it. */
const censuses = new Map()
/*
 * The computer picked under Which unit on this account, and whether the last
 * roll call this account finished heard two or more (readPick): null until
 * the disk has been read for the account signed in.
 */
let pickRecord = null
/** Reads waiting for the roll call to say who they are asked of: see holdReads. */
let readsHeld = null
/** The computer a read is asked of by name before the proof is in, or null: see holdReads. */
let readsTo = null
/** Who each read since the link came up was asked of ('' for nobody in particular), to the end of its roll call. */
let readsAsked = null
/** The same, for the last roll call that finished: see remoteReadsAskedOf. */
let rollCallAsked = null
/** Whether a roll call has been started on this link, and whether one has finished with anybody in it. */
let countTried = false
let countedOnLink = false
/** When the last roll call on this link ended, and when the last one taken on evidence began: see remoteCountDue. */
let lastCountAt = 0
let evidenceCountAt = 0
/** When a second answer to a request asked of nobody was heard while fewer than two were counted: see anotherAnswered. */
let anotherHeardAt = 0
/** Requests asked of nobody that have had their answer, by id, for telling a second one: see anotherAnswered. */
const answeredOpen = new Map()
/** Told when a roll call is due on evidence (link.js counts again then). */
const dueWatchers = new Set()

/* ------------------------------------------------------------------ */
/* Signing in                                                          */
/* ------------------------------------------------------------------ */

/**
 * One client for the life of the app.
 *
 * supabase-js writes its session through the storage adapter it was built
 * with, so building a second one mid-session gives you two views of the same
 * account that disagree about whether it is signed in. `remoteConnect` already
 * refuses to reuse a channel that belongs to a different client; this keeps
 * there from being a different client to begin with.
 */
function supabase() {
  if (!client) {
    client = createClient(DEFAULT_PROJECT.url, DEFAULT_PROJECT.anonKey, {
      global: { fetch: notForever },
      /*
       * A socket that died quietly — the phone stepped from wifi to cellular,
       * the screen locked — is only found out by a missed heartbeat, and the
       * default is one every twenty-five seconds. Ten, so a dead link is
       * noticed inside twenty seconds rather than fifty.
       */
      realtime: { heartbeatIntervalMs: HEARTBEAT_MS },
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        /*
         * A phone has no URL to read a session out of. Left on, supabase-js
         * looks for one at startup and, on some versions, warns about a
         * `window` it will never find.
         */
        detectSessionInUrl: false
      }
    })
  }
  return client
}

export const supabaseClient = () => supabase()

export async function signIn({ email, password }) {
  const { data, error } = await supabase().auth.signInWithPassword({ email, password })
  /* `noMatch` says it was the details, not the line: on a phone that paid
     before any account existed, the likeliest reason is that there is no
     account with that email yet (SignIn says so). `notConfirmed` is the
     email never confirmed, which SignIn offers to send again. */
  if (error) {
    throw Object.assign(new Error(explainAuth(error.message)), {
      noMatch: error.code === 'invalid_credentials' || /invalid login/i.test(error.message || ''),
      notConfirmed: notConfirmed(error)
    })
  }
  userId = data?.user?.id || null
  if (!userId) throw new Error('Signed in but the account service returned no id.')
  return userId
}

/** Create the account, when there isn't one yet. Same project, same policies. */
export async function signUp({ email, password }) {
  const { data, error } = await supabase().auth.signUp({ email, password })
  if (error) throw new Error(explainAuth(error.message))
  /*
   * An address that already has an account is not an error to the account
   * service: it answers as if it had made one — a user with no identities and
   * no session — so a stranger cannot learn which addresses are taken. Read
   * as a new account, that told somebody coming back "Account made, confirm
   * it from the email" for an email that never comes. Their details are the
   * sign-in they meant, so this signs them in, as the browser does
   * (src/lib/link.js, createAccount); only a wrong password gets a message.
   */
  if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
    try {
      return { needsConfirmation: false, userId: await signIn({ email, password }) }
    } catch {
      throw new Error('That email already has an account. Sign in with it, or reset the password.')
    }
  }
  // Confirmation may be required, in which case there is no session yet.
  if (data?.session?.user?.id) userId = data.session.user.id
  return { needsConfirmation: !data?.session, userId: data?.user?.id || null }
}

/**
 * Pick up the session left over from last time.
 *
 * Returns the user id when one is still good, null otherwise. Never throws and
 * never prompts: an expired session is a normal thing to find, and the answer
 * is to show the sign-in form, not an error.
 */
export async function restoreSession() {
  try {
    const { data } = await supabase().auth.getSession()
    userId = data?.session?.user?.id || null
    return userId
  } catch {
    return null
  }
}

/** Who is signed in, or null. Email included because that is what a person recognises. */
export async function currentAccount() {
  try {
    const { data } = await supabase().auth.getUser()
    if (!data?.user) return null
    return { id: data.user.id, email: data.user.email || '' }
  } catch {
    return null
  }
}

/**
 * Whether a computer on this wifi is signed into a different account.
 *
 * "I was signed into the wrong account, but it didn't notify me at all." A
 * phone and a computer on two accounts never hear each other, and to the
 * phone that looks exactly like a computer that is off. The account server
 * can tell them apart, and answers yes or no and nothing more
 * (supabase/migrations/20260923_computer_elsewhere.sql). Any failure is a
 * no, so this can only ever add a sentence.
 */
export async function computerElsewhere() {
  try {
    const { data, error } = await supabase().rpc('computer_elsewhere')
    return !error && data === true
  } catch {
    return false
  }
}

/**
 * Whether any computer has signed in with this phone's account: true, false,
 * or null for can't tell.
 *
 * "No computer is signed in with this account yet, here's the download"
 * instead of "make sure it's awake", for the customers who never set one up
 * (supabase/migrations/20261014_account_has_computer.sql). It answers only
 * about the caller's own account. Null is never a no: an error, no signal, a
 * database without the function, or no caller all keep today's words. The
 * same reading as shared/no-computer.mjs's hasComputerFrom, written out here
 * so the relay imports nothing new.
 */
export async function accountHasComputer() {
  try {
    const { data, error } = await supabase().rpc('account_has_computer')
    if (error) return null
    return data === true ? true : data === false ? false : null
  } catch {
    return null
  }
}

/**
 * Who the session kept on this phone belongs to, read off the phone: no
 * question to the account server, so it answers with no signal as well.
 */
export async function sessionAccount() {
  try {
    const { data } = await supabase().auth.getSession()
    const user = data?.session?.user
    return user?.id ? { id: user.id, email: user.email || '' } : null
  } catch {
    return null
  }
}

/**
 * Sign out here, and nowhere else.
 *
 * Scope 'local' on purpose: signing out on a phone must not sign out the Mac
 * that is hosting, which would drop the link for everyone mid-set.
 */
export async function signOut() {
  await remoteDisconnect()
  try {
    await supabase().auth.signOut({ scope: 'local' })
  } finally {
    userId = null
    /* The pick was this account's: the next to sign in reads its own (readPick). */
    forgetPick()
  }
}

/**
 * Delete this account for good: Apple's Guideline 5.1.1(v). The server
 * (supabase/functions/delete-account) deletes the account its own session token
 * names, and everything saved under it goes with it. Throws a sentence for the
 * screen if it could not; on success the caller signs out as usual.
 */
export async function deleteAccount() {
  const { data } = await supabase().auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in again, then delete the account.')
  let res
  try {
    res = await fetch(`${DEFAULT_PROJECT.url}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: DEFAULT_PROJECT.anonKey,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ confirm: 'delete' })
    })
  } catch {
    throw new Error('No connection to the account server. Check the internet and try again.')
  }
  const body = await res.json().catch(() => ({}))
  logDebug(`delete account: ${res.status}`)
  if (!res.ok || !body?.deleted) throw new Error(body?.error || 'The account could not be deleted. Try again in a minute.')
  /* Its pick, and what its last roll call heard, go with it. */
  await dropPick(data?.session?.user?.id)
}

export async function changePassword(password) {
  const { error } = await supabase().auth.updateUser({ password })
  if (error) throw new Error(explainAuth(error.message))
}

/** A fresh "confirm your email" link, for an address that never tapped the first. */
export async function resendConfirmation(email) {
  const { error } = await supabase().auth.resend({ type: 'signup', email })
  if (error) throw new Error(explainAuth(error.message))
}

/**
 * Confirm a new account with the code in its email, and be signed in by it.
 *
 * The second way past the confirmation email, beside its link: the same
 * email carries a code, and typing it here confirms the account without
 * leaving the app (shared/confirm-code.mjs says why). The account service
 * answers a good code with a session, so this is a sign-in as much as
 * signIn is, and it ends the same way — the id kept, and returned.
 *
 * What was typed is checked first, so a letter or a short code is said
 * without a round trip; a code the service turns down is said in plain
 * words rather than as "Token has expired or is invalid".
 */
export async function confirmWithCode({ email, code }) {
  const token = cleanCode(code)
  if (!token) throw new Error(CODE_NOT_DIGITS)
  const { data, error } = await supabase().auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw new Error(codeRefused(error) ? CODE_DIDNT_WORK : explainAuth(error.message))
  userId = data?.session?.user?.id || null
  /* Confirmed but not signed in: unheard of, and the password still works. */
  if (!userId) throw new Error(CONFIRMED_SIGN_IN)
  return userId
}

export async function sendPasswordReset(email) {
  const { error } = await supabase().auth.resetPasswordForEmail(email)
  if (error) throw new Error(explainAuth(error.message))
}

/* ------------------------------------------------------------------ */
/* What the link is doing                                              */
/* ------------------------------------------------------------------ */

export const remoteUserId = () => userId
export const remoteActive = () => !!channel
export const remoteLinked = () => !!session
export const remoteHostSeen = () => hostSeen
export const lastAnswerAt = () => answeredAt
export const remoteHosts = () => hosts

/** Which unit each answering computer has, by its name: { model, plugged }. */
export const remoteUnits = () => units

export { unitChoices }
export const remoteChosenHost = () => chosen

/**
 * The computer every read since the link came up, to the end of the last
 * roll call, was asked of by name, or null when any of them went elsewhere
 * or to nobody in particular (a hold that ran out lets them go that way).
 * With a pick on an account of two, the reads wait for the roll call and go
 * to the pick (holdReads), so the unit on screen was read off the computer
 * driven and link.js has nothing to read again. Only once the roll call has
 * PROVED that asking it by name leaves the others out: a computer app too
 * old to honour a name answers everything, and its answers may have been the
 * first in.
 */
export const remoteReadsAskedOf = () =>
  Array.isArray(rollCallAsked) && rollCallAsked.length === 1 && rollCallAsked[0] && rollCallAsked[0] === chosen && targeted ? chosen : null

/**
 * Whether link.js should take the roll call now, with the computer
 * answering: none on this link yet, or, at most once a minute, a second
 * computer heard answering since the last one counted fewer than two
 * (anotherAnswered), or a roll call that found nobody. Never on a timer
 * alone.
 */
export const RECOUNT_MS = 60 * 1000
export function remoteCountDue(now = Date.now()) {
  if (!channel || !isJoined(channel) || !hostSeen || counting) return false
  if (!countTried) return true
  if (!countedOnLink) return now - lastCountAt >= RECOUNT_MS
  return hosts.length < 2 && anotherHeardAt > lastCountAt && now - evidenceCountAt >= RECOUNT_MS
}

export function subscribeCountDue(fn) {
  dueWatchers.add(fn)
  return () => dueWatchers.delete(fn)
}

export const hostConflict = (list = hosts, pick = chosen, proved = targeted) =>
  conflictBetween(list, pick, proved)

export const hostNamesFrom = (answers, read = decode) => namesFrom(answers, read)

/**
 * The one way `hostSeen` changes, so anyone who cares hears about it.
 *
 * Every answered request is proof the Mac is there and every timeout is proof
 * it is not. Announced on change, ordinary traffic keeps every indicator honest
 * for free — a screen that went red turns green again on the next thing that
 * works, without polling for it.
 */
function seen(v) {
  const now = !!v
  if (now) answeredAt = Date.now()
  if (now === hostSeen) return
  hostSeen = now
  for (const fn of seers) {
    try {
      fn(now)
    } catch {
      // One bad listener shouldn't stop the others.
    }
  }
}

export function subscribeHostSeen(fn) {
  seers.add(fn)
  return () => seers.delete(fn)
}

let lastState = false
function announce() {
  const up = !!channel
  if (up === lastState) return
  lastState = up
  for (const fn of watchers) {
    try {
      fn(up)
    } catch {
      // One bad watcher shouldn't stop the others.
    }
  }
}

export function subscribeRemoteState(fn) {
  watchers.add(fn)
  return () => watchers.delete(fn)
}

/** Device events bridged from the host, same shape as the Mac's own event stream. */
export function subscribeRemoteEvents(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Ask the Mac whether it's there, and remember the answer.
 *
 * Short-fused on purpose: this is asked at moments someone is waiting through —
 * just after connecting, and on a screen already saying something is wrong. A
 * host that is there answers /healthz in well under a second, so a probe that
 * took eight seconds to answer "no" would itself be the reason a lamp was slow.
 */
export async function hostResponds() {
  if (!channel) {
    seen(false)
    return false
  }
  try {
    await remoteRequest('/healthz', { timeoutMs: 6000, graceMs: 0 })
    seen(true)
  } catch {
    seen(false)
  }
  return hostSeen
}

/* ------------------------------------------------------------------ */
/* Joining                                                             */
/* ------------------------------------------------------------------ */

/** realtime-js keeps its own channel state; 'joined' is the only one that can carry a request. */
const isJoined = (chan) => {
  try {
    return chan?.state === 'joined'
  } catch {
    return false
  }
}

/**
 * Whether an existing channel is worth keeping instead of rebuilding.
 *
 * A channel whose socket has closed is still an object and still truthy, and a
 * channel wired to a client the app no longer holds has nothing keeping its
 * socket alive. Both look connected and neither can carry a request.
 */
export function canReuseChannel(chan, sess, c) {
  return !!chan && !!c && sess?.client === c && isJoined(chan)
}

/** How often the relay socket proves it is alive. See supabase(). */
export const HEARTBEAT_MS = 10000

export async function remoteConnect() {
  if (!userId) await restoreSession()
  if (!userId) throw new Error('Sign in first.')
  /* This account's pick, off the disk while the link is being joined: see holdReads. */
  readPick()
  if (canReuseChannel(channel, session, supabase())) return userId
  connecting = true
  try {
    return await joinChannel()
  } finally {
    connecting = false
  }
}

async function joinChannel() {
  await remoteDisconnect()
  const c = supabase()

  /*
   * Clear out anything left from a previous attempt first.
   *
   * client.channel(topic) returns the EXISTING channel when one is registered
   * for that topic rather than making a new one. So a connect that failed after
   * subscribing leaves a joined channel behind, every retry is handed that same
   * joined channel, and registering presence on it throws — an error that
   * repeats until the app is force-quit.
   */
  for (const existing of c.getChannels()) {
    try {
      await c.removeChannel(existing)
    } catch {
      // Already gone is the outcome we wanted anyway.
    }
  }

  /*
   * Presence has to be declared before subscribe, not after. realtime-js
   * decides whether to enable presence at join time, and the host only bridges
   * live device events while it can see something watching — so getting this
   * wrong means a screen that never updates itself, which is worse than a crash
   * because it looks like it is working.
   */
  const chan = c.channel(`remote:${userId}`, {
    config: { private: true, broadcast: { ack: false }, presence: { key: 'phone', enabled: true } }
  })

  chan.on('broadcast', { event: 'res' }, ({ payload }) => {
    /*
     * A roll call keeps every answer; an ordinary request keeps the first.
     * `waiting.delete` runs before the resolve, so a duplicate finds nothing
     * pending and is dropped without trace — which is exactly how two Macs went
     * unnoticed for as long as they did.
     */
    const census = payload?.id && censuses.get(payload.id)
    if (census) census.push(payload)
    census?.heard?.(payload)

    const pending = payload?.id && waiting.get(payload.id)
    if (pending) {
      waiting.delete(payload.id)
      if (pending.open) heardOnce(payload.id)
      pending.resolve(payload)
    } else if (payload?.id && !census && answeredOpen.has(payload.id)) {
      /* A second answer to a question asked of nobody: another computer is answering (anotherAnswered). */
      anotherAnswered()
    }
  })

  /*
   * Bound, and deliberately says nothing. The Mac never tracks presence, so the
   * only key ever in the state is our own — reading that as "nobody else here"
   * turns a working link red on every sync. The binding stays because presence
   * has to be enabled for the Mac to bridge events to us; the conclusion is
   * gone.
   */
  chan.on('presence', { event: 'sync' }, () => {})

  chan.on('broadcast', { event: 'evt' }, ({ payload }) => {
    for (const fn of listeners) {
      try {
        fn(payload)
      } catch {
        // One bad listener shouldn't stop the others.
      }
    }
  })

  /*
   * The callback stays live for the life of the channel, not just the join.
   * realtime-js calls it again on every state change — which is the only notice
   * we get that a socket died, and the only notice that it came back.
   */
  session = { chan, client: c }
  let settled = false
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('Finding your computer timed out.'))
    }, 12000)

    /*
     * AND WHY IT DROPPED, IN THE LOG. On 12 October 2026 a phone's channel
     * dropped about five seconds after every rejoin, for minutes, and the log
     * could only show the link flipping: this callback threw away the reason
     * realtime-js hands it as the second argument. A drop and a rejoin are now
     * both written down, with that reason, so the next log names the cause.
     */
    chan.subscribe((status, err) => {
      if (session?.chan !== chan) return // a channel we've already replaced

      if (status === 'SUBSCRIBED') {
        if (settled && channel !== chan) logDebug('relay', 'channel back')
        channel = chan
        chan.track({ at: Date.now() }).catch(() => {})
        if (!settled) {
          /* A fresh link, on an account of two with a pick: no read goes to whoever answers first (holdReads). Before anybody hears it is up. */
          holdForPick()
          settled = true
          clearTimeout(timer)
          resolve()
        }
        announce()
        return
      }

      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (channel === chan || !settled) logDebug('relay', `channel ${status.toLowerCase().replace('_', ' ')}`, err?.message)
        if (channel === chan) {
          channel = null
          seen(false)
          failWaiting('The connection dropped before your computer answered.')
        }
        if (!settled) {
          settled = true
          clearTimeout(timer)
          reject(new Error(`Couldn’t connect (${status.toLowerCase().replace('_', ' ')}).`))
        }
        announce()
      }
    })
  }).catch(async (err) => {
    // Leave nothing registered on the way out, or the next attempt inherits it.
    if (session?.chan === chan) session = null
    await c.removeChannel(chan).catch(() => {})
    /*
     * AND THE SOCKET GOES TOO. A join that failed was handing the next attempt
     * the same socket, and a socket that has quietly died — the phone moved
     * from wifi to cellular, or was locked — stays dead until a heartbeat
     * finds it out. Every attempt in between waited its twelve seconds on it
     * and backed off: one log has the link "joining" for two and a half
     * minutes, another for six. Closed here, the next subscribe opens a fresh
     * socket, which is the one thing a dead one cannot become.
     */
    await c.realtime?.disconnect?.().catch?.(() => {})
    throw err
  })

  return userId
}

export async function remoteDisconnect() {
  const going = session
  session = null
  channel = null
  seen(false)
  // Who answered belongs to the channel that is going away. Carrying it over
  // would keep writes refused on a link where the second Mac is long gone.
  hosts = []
  units = {}
  chosen = null
  targeted = false
  censuses.clear()
  chosenWhy = null
  /* Reads held for a roll call on this link are let go: the link they were waiting on has gone. */
  readsHeld?.open()
  readsTo = null
  readsAsked = null
  rollCallAsked = null
  /* And the next link counts again from the start (remoteCountDue). */
  countTried = false
  countedOnLink = false
  lastCountAt = 0
  evidenceCountAt = 0
  anotherHeardAt = 0
  answeredOpen.clear()
  failWaiting('Disconnected.')
  announce()

  if (going?.chan) {
    try {
      // Removed, not merely unsubscribed: a channel left registered is handed
      // back by the next `client.channel(topic)`, already joined.
      await going.client.removeChannel(going.chan)
    } catch {
      // Already gone is the outcome we wanted anyway.
    }
  }
}

/* ------------------------------------------------------------------ */
/* How many Macs are listening                                         */
/* ------------------------------------------------------------------ */

/**
 * Count the Macs on the channel, and learn what each is called.
 *
 * A request is a broadcast on one channel per ACCOUNT — `remote:<uid>` — and it
 * carries an id but no address. It is not sent to a Mac; it is shouted, and
 * every Mac signed into that account hears it and answers. With one Mac that is
 * a perfectly good design. With two it is a fault, and the halves fail
 * differently: a read resolves on whichever Mac was quicker, and a write is
 * carried out on both units.
 *
 * Slow on purpose — it waits out the window even when the first answer is
 * instant, because "no second answer yet" and "no second answer at all" are the
 * same thing until the clock runs out. Taken once per link, when the computer
 * first answers on it, and again only on evidence (remoteCountDue).
 */
async function takeCensus({
  windowMs = 1500,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms))
} = {}) {
  if (!channel || !isJoined(channel)) return hosts
  const link = session
  countTried = true
  /* Taken on the evidence of a second computer: the next on evidence waits a minute (remoteCountDue). */
  if (anotherHeardAt > lastCountAt) evidenceCountAt = Date.now()
  /*
   * Reads while it counts: on to the pick already proved, held for this
   * account's pick when its last roll call heard two or more, or as they
   * always went (see holdReads).
   */
  const proved = Boolean(hosts.length > 1 && chosen && targeted)
  const record = await readPick()
  if (session !== link) return hosts
  const picked = record?.name || null
  const held = !proved && holdsFor(record) ? holdReads() : null
  readsTo = proved ? chosen : null
  if (!readsAsked) readsAsked = []
  try {
    /*
     * The pick's own answer, as it comes in: reads are asked of it by name
     * from that moment rather than from the end of the window. With only the
     * pick switched on tonight, that answer is the whole of the wait.
     */
    const heard =
      held && picked
        ? (payload) => {
            namesFrom([payload], decode).then(
              ([name]) => {
                if (name !== picked || readsHeld !== held || session !== link) return
                readsTo = picked
                held.open()
              },
              () => {}
            )
          }
        : null
    // A read every host allows and every host answers differently: its own name,
    // written into its store by the launcher on that Mac.
    const answers = await collectAnswers({ path: '/store/config/host.name', windowMs, sleep, heard })
    /* A link that went while it counted: what it heard is not the next link's. */
    if (session !== link) return hosts
    hosts = await namesFrom(answers, decode)

    // A choice made before is honoured if that Mac is still one of the answers.
    if (!hosts.includes(chosen)) chosen = null
    if (hosts.length > 1 && !chosen && hosts.includes(picked)) {
      chosen = picked
      chosenWhy = 'pick'
    }
    /*
     * The first window is in. The pick among two or more: reads are asked of
     * it from here on, while the count goes on. One computer: reads go as
     * they always went. A pick that did not answer: they wait for the end of
     * the count, which says where they go.
     */
    readsTo = hosts.length > 1 && chosen ? chosen : null
    if (held && (hosts.length < 2 || chosen)) held.open()
    units = hosts.length > 1 ? await readUnits({ windowMs, sleep }) : {}
    if (session !== link) return hosts
    /*
     * Nobody said which: drive one rather than all of them (firstUnitHost).
     * A pick is never left for another, not even for one with a unit when the
     * pick has none: nothing would bring the taps back when its unit comes on.
     */
    if (hosts.length > 1 && !chosen) chosenWhy = 'first'
    if (hosts.length > 1 && !chosen) chosen = firstUnitHost(hosts, units)
    targeted = false
    if (hosts.length > 1 && chosen) await confirmTargeting({ windowMs, sleep })
    /* Said once, so a log shows which computer the phone drives and why (rollCallLine). */
    const missing = !proved && picked && !hosts.includes(picked) && (hosts.length > 1 || record?.many === true) ? picked : null
    if (hosts.length > 1 || missing) logDebug('link', rollCallLine({ hosts, units, chosen, why: chosenWhy, addressed: targeted, missing }))
    /* Counted on this link; and whether it heard two or more, which the next fresh link's first reads go by (holdsFor). */
    if (session === link && hosts.length) {
      countedOnLink = true
      noteCount(hosts.length > 1)
    }
    return hosts
  } finally {
    /* A link that went while it counted is not this one's to tidy: the next has its own (holdForPick). */
    if (session === link) {
      readsTo = null
      rollCallAsked = readsAsked
      readsAsked = null
      lastCountAt = Date.now()
    }
    held?.open()
  }
}

/*
 * NO READ GOES TO WHOEVER ANSWERS FIRST, ON AN ACCOUNT OF TWO COMPUTERS WITH A PICK.
 *
 * Two Raspberry Pis on one account, an FM3 on "fractalpi" and an AM4 on
 * "raspberry pi 3", the AM4 picked under Which unit. At every launch the
 * first reads went to nobody in particular, the FM3's computer answered them
 * first, and for the first few seconds the phone was on the FM3: the AM4's
 * chain blanked for about fifteen seconds, the FM3's scene names for slot 53
 * on the AM4's preset 53, the tempo 180 and then 0, and the log naming the
 * wrong computer.
 *
 * So on a fresh link, where this account has a pick written down and the
 * last roll call it finished heard two or more computers, a read waits for
 * the roll call. The moment the pick's own answer to it comes in, reads are
 * asked of the pick by name, while the rest of the count goes on. A pick
 * that is not heard in the first window holds them for the rest of the
 * count, which then says where they go; a first window that hears one
 * computer lets them go as they always went. A read waits no longer than
 * COUNT_WAIT_MS from when it was made, and no hold outlasts COUNT_WAIT_MS
 * from when it was made: a link where no count comes reads as it always did,
 * and what was read that way is counted as asked of nobody, so it is read
 * again once the count has picked (remoteReadsAskedOf).
 *
 * A tap waits the same way on a link where no roll call has finished yet
 * (countDone), and is dropped at its deadline rather than sent to both
 * units. Other writes wait for the count and its proof, as they always did.
 *
 * ONE COMPUTER IS NEVER HELD. An account that has never picked, or whose
 * last roll call heard one computer, waits for nothing and is addressed to
 * nobody, exactly as in 1.87.47, and that includes a pick left over from
 * when there were two: the first launch that counts one is the last that
 * waits. The pick is the account's own (readPick), so another account
 * signed in on this phone never waits for it. Two reads are never held:
 * /healthz, which only asks whether anything is there, and the computer's
 * own name, which link.js reads again once the count has picked
 * (countHosts).
 */
function holdReads() {
  if (readsHeld && Date.now() < readsHeld.until) return readsHeld
  /* One that ran out is over: a count after it holds again, for its own six seconds. */
  readsHeld?.open()
  let open = null
  const gate = new Promise((go) => (open = go))
  const held = { gate, until: Date.now() + COUNT_WAIT_MS }
  held.open = () => {
    if (readsHeld === held) readsHeld = null
    open()
  }
  readsHeld = held
  return held
}

/*
 * On a fresh link, before anybody hears it is up: held when this account's
 * pick holds reads (holdsFor), and let go at once when the disk says it does
 * not. And from here on, who each read is asked of is written down, for the
 * roll call to come (remoteReadsAskedOf).
 */
function holdForPick() {
  readsAsked = []
  const record = pickOf()
  if (record) {
    if (holdsFor(record)) holdReads()
    return
  }
  const held = holdReads()
  readPick().then(
    (found) => !holdsFor(found) && held.open(),
    () => held.open()
  )
}

const neverHeld = (path) => path === '/healthz' || path === '/store/config/host.name'

/** Resolves once reads may go (holdReads), or at the hold's end, or at a read's own deadline, and never more than COUNT_WAIT_MS after it was asked. */
async function readsWait(deadline) {
  const most = Date.now() + COUNT_WAIT_MS
  for (;;) {
    const held = readsHeld
    if (!held) return
    const end = Math.min(held.until, most, Number.isFinite(deadline) ? deadline : Infinity)
    if (Date.now() >= end) return
    let timer = null
    await Promise.race([held.gate, new Promise((go) => (timer = setTimeout(go, end - Date.now())))])
    clearTimeout(timer)
  }
}

/*
 * A WRITE WAITS FOR THE ROLL CALL, so it lands on one unit and not two.
 *
 * Until the roll call has picked a computer (firstUnitHost), nothing is
 * addressed, so a press made in those first seconds went to every computer on
 * the account. Reads are left alone — they are re-read from the one chosen —
 * but a write is held until the count is in, and no longer than it can take.
 */
let counting = null
/** The link that count (or proof) is on. */
let countingLink = null
const COUNT_WAIT_MS = 6000

/*
 * One at a time. A roll call asked for while another, or the proof of a
 * pick under Which unit, is still running starts when that one ends, so two
 * never write over each other's answers; writes wait for both.
 */
export function censusHosts(options) {
  /* Only one on this link: a count left running by a link that has gone is nothing to wait for. */
  const before = counting && countingLink === session ? counting : null
  const run = before ? before.catch(() => {}).then(() => takeCensus(options)) : takeCensus(options)
  counting = run
  countingLink = session
  run.finally(() => {
    if (counting === run) counting = null
  }).catch(() => {})
  return run
}

/**
 * Resolves once no roll call (or proof) is running, or after COUNT_WAIT_MS at most.
 *
 * A TAP WAITS NO LONGER THAN ITS DEADLINE. The roll call runs after every
 * full join — launch, Android coming back, a join that failed — and a tap in
 * the second and a half after one can find it still counting. It is not cut
 * short for the tap: it is what stops one write landing on two units. The
 * tap waits for it inside its own deadline instead, and if the count outlasts
 * that, the tap is dropped (see remoteRequest) rather than sent late.
 *
 * AND A TAP BEFORE THE FIRST COUNT, on an account of two with a pick, waits
 * as its reads do (holdReads): between the link coming up and the count
 * beginning, nothing is counted yet, and a tap sent then went to both units.
 */
async function countDone(deadline) {
  const most = Math.min(Date.now() + COUNT_WAIT_MS, Number.isFinite(deadline) ? deadline : Infinity)
  for (;;) {
    const run = counting
    const held = run ? null : pickHeld(deadline)
    if (!run && !held) return
    const end = held ? Math.min(most, held.until) : most
    const left = end - Date.now()
    if (left <= 0) return
    let timer = null
    await Promise.race([run ? run.catch(() => {}) : held.gate, new Promise((go) => (timer = setTimeout(go, left)))])
    clearTimeout(timer)
  }
}

/** The hold a tap waits on before the first roll call of a link has finished: see countDone. */
const pickHeld = (deadline) => (Number.isFinite(deadline) && !countedOnLink && readsHeld && Date.now() < readsHeld.until ? readsHeld : null)

/** Shout one read and keep every answer, rather than the first; `heard` hears each as it comes. */
async function collectAnswers({ path, host = null, windowMs, sleep, heard = null }) {
  const id = `census-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const answers = []
  if (heard) answers.heard = heard
  censuses.set(id, answers)
  try {
    const payload = { id, method: 'GET', path, body: null }
    if (host) payload.host = host
    await channel.send({ type: 'broadcast', event: 'req', payload })
    await sleep(windowMs)
  } catch {
    // A question that could not be asked tells us nothing, which is what the
    // empty answer list already says.
  } finally {
    censuses.delete(id)
  }
  return answers
}

/**
 * Ask each computer, by name, what it has plugged in.
 *
 * Only when there is more than one: with one computer there is nothing to
 * choose, and the unit is on the screen already. All at once, so the wait is
 * one window however many there are. A name two computers share cannot be
 * addressed to one of them, so it is not asked; see unitFrom for why an
 * answer that does not come back alone is not believed either.
 */
async function readUnits({ windowMs, sleep }) {
  const once = hosts.filter((name, i) => hosts.indexOf(name) === i && hosts.lastIndexOf(name) === i)
  const found = await Promise.all(
    once.map(async (name) => {
      const [health, device] = await Promise.all([
        collectAnswers({ path: '/healthz', host: name, windowMs, sleep }),
        collectAnswers({ path: '/device', host: name, windowMs, sleep })
      ])
      return [name, await unitFrom(health, decode, device)]
    })
  )
  return Object.fromEntries(found.filter(([, unit]) => unit))
}

/**
 * Prove that addressing a request to one Mac actually leaves the others out.
 *
 * The host end of this only exists in a new enough ForgeFX; an older one has
 * never heard of an addressed request and answers it like any other. So the app
 * does not take the feature on trust — it asks the chosen Mac one addressed
 * question and counts the answers. Exactly one means every other Mac stayed out
 * of it, which is the only evidence that a write will land in one place.
 */
async function confirmTargeting({ windowMs, sleep }) {
  if (!chosen) return false
  const answers = await collectAnswers({
    path: '/store/config/host.name',
    host: chosen,
    windowMs,
    sleep
  })
  targeted = answers.length === 1
  return targeted
}

/**
 * Drive this Mac and no other.
 *
 * Remembered, because the answer does not change between one visit and the
 * next: the phone in your pocket belongs to the rig you play, not to whichever
 * Mac happened to answer first.
 *
 * A pick tapped while a roll call is still running waits for it to end, so
 * nothing the count decides lands over the tap; and writes wait for the
 * count and for the pick's proof (whileProving), unaddressed for not a
 * moment in between.
 */
export async function pickHost(
  name,
  { windowMs = 1500, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}
) {
  if (!hosts.includes(name)) return false
  return whileProving(provePick(name, countingLink === session ? counting : null, { windowMs, sleep }))
}

async function provePick(name, before, { windowMs, sleep }) {
  if (before) await before.catch(() => {})
  if (!hosts.includes(name)) return false
  chosen = name
  chosenWhy = 'pick'
  targeted = false
  if (hosts.length > 1) readsTo = name
  await rememberHost(name)
  if (hosts.length > 1) await confirmTargeting({ windowMs, sleep })
  return targeted
}

/*
 * AND A PICK UNDER WHICH UNIT IS PROVED BEFORE A WRITE GOES. Between the tap
 * and the proof (confirmTargeting), nothing was addressed: a scene tapped in
 * that second and a half went to every computer on the account, both units.
 * Now a write waits for the proof as it waits for the roll call (countDone),
 * and a read goes to the one just picked.
 */
function whileProving(run) {
  counting = run
  countingLink = session
  run
    .finally(() => {
      if (counting !== run) return
      counting = null
      readsTo = null
    })
    .catch(() => {})
  return run
}

/*
 * THE PICK IS THE ACCOUNT'S, NOT THE PHONE'S. Kept under the account's own id,
 * with what its last roll call heard beside it (two or more, or one), so
 * another account signed in on this phone never waits for a computer it has
 * never seen, nor finds that computer's name in its log; Sign out forgets it
 * from memory, and Delete account from the disk too. All in the one key the
 * pick was always kept in (shared/relay-rules readPicks): the one bare name
 * 1.87.47 and earlier kept for the whole phone is taken as the account's
 * that reads it first, and then is gone.
 */
const HOST_KEY = 'fractal.remote.host'
/* The key as last read or written: every account's entry, and a bare name not yet taken. */
let book = null
let bookReading = null

/** The record for the account signed in, once read; null before. */
const pickOf = () => (pickRecord && pickRecord.uid === userId ? pickRecord : null)
/** Reads wait for a pick only when the account's last roll call heard two or more: never for one computer. */
const holdsFor = (record) => Boolean(record?.name && record.many === true)

function loadBook() {
  if (book) return Promise.resolve(book)
  if (!bookReading) {
    bookReading = (async () => {
      await null
      let text = null
      try {
        text = await AsyncStorage.getItem(HOST_KEY)
      } catch {
        // A disk that cannot be read is no pick: everything goes as it always did.
      }
      if (!book) book = readPicks(text)
      bookReading = null
      return book
    })()
  }
  return bookReading
}

function saveBook() {
  if (!book) return Promise.resolve()
  try {
    return Promise.resolve(AsyncStorage.setItem(HOST_KEY, writePicks(book.accounts))).catch(() => {})
  } catch {
    // A choice we cannot write down still holds for this session.
    return Promise.resolve()
  }
}

function readPick() {
  const uid = userId
  if (!uid) return Promise.resolve(null)
  if (pickOf()) return Promise.resolve(pickOf())
  return loadBook().then((kept) => {
    if (userId !== uid) return null
    /* A pick written while the disk was being read wins over what the read finds. */
    if (pickOf()) return pickOf()
    if (!kept.accounts[uid] && kept.legacy) {
      kept.accounts[uid] = { name: kept.legacy, many: null }
      kept.legacy = null
      saveBook()
    }
    pickRecord = { uid, ...pickEntry(kept.accounts[uid]) }
    return pickRecord
  })
}

const rememberHost = async (name) => {
  const uid = userId
  if (!uid) return
  const record = { uid, name, many: pickOf()?.many ?? null }
  pickRecord = record
  const kept = await loadBook()
  kept.accounts[uid] = { name, many: record.many }
  await saveBook()
}

/** Whether the roll call just finished heard two or more: kept for the account's next launch, written down when it has a pick. */
function noteCount(many) {
  const record = pickOf()
  if (!record || record.many === many) return
  record.many = many
  if (!record.name) return
  loadBook().then((kept) => {
    kept.accounts[record.uid] = { name: record.name, many }
    return saveBook()
  })
}

/** Signed out: the next account reads its own. */
function forgetPick() {
  pickRecord = null
}

/** The account is gone: its pick and its count go from the disk too. */
async function dropPick(uid) {
  forgetPick()
  if (!uid) return
  const kept = await loadBook()
  if (!(uid in kept.accounts)) return
  delete kept.accounts[uid]
  await saveBook()
}

/*
 * A SECOND COMPUTER, HEARD. A roll call that heard one computer leaves every
 * request asked of nobody, and a second computer that came up afterwards (a
 * Pi still starting at launch) answers them too: it carries out every write.
 * Its answer is the evidence, a second one to the same question, and link.js
 * counts again on it (remoteCountDue), at most once a minute. Never while two
 * or more are counted: then every question asked of nobody has two answers
 * by design.
 */
function heardOnce(id) {
  answeredOpen.set(id, Date.now())
  if (answeredOpen.size > 32) answeredOpen.delete(answeredOpen.keys().next().value)
}

function anotherAnswered() {
  if (!countedOnLink || hosts.length > 1) return
  anotherHeardAt = Date.now()
  if (!remoteCountDue()) return
  for (const fn of dueWatchers) {
    try {
      fn()
    } catch {
      // One bad watcher shouldn't stop the others.
    }
  }
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

/**
 * The socket went, as an error anything upstream can recognise without reading
 * English.
 *
 * Several sentences mean "the relay dropped", and every one of them used to
 * arrive at a caller as an ordinary failure indistinguishable from "the unit
 * refused this". The flag is what lets a caller tell "this never left the
 * phone" from "the unit said no".
 */
function linkDown(message) {
  const err = new Error(message)
  err.linkDown = true
  /*
   * A SECOND FLAG, DELIBERATELY NOT THE SAME ONE.
   *
   * `linkDown` decides whether `request` tries again, and adding anything to
   * that set changes what gets RESENT — which for the tap tempo route means a
   * beat sent twice, and a beat sent twice is a beat that never happened. So
   * "the link is why this failed" is said separately from "ask again", and
   * only the screens read it. See rig.clearLinkFault.
   */
  err.aboutLink = true
  return err
}

/** Nothing can be answered on a channel that has gone. Fail them now, loudly. */
function failWaiting(message) {
  for (const [, pending] of waiting) pending.reject(linkDown(message))
  waiting.clear()
}

/**
 * Wait for the relay to come back, for a little while.
 *
 * realtime-js rejoins on its own after a socket closes — a phone locked, a hand
 * from wifi to cellular, a tunnel — and it takes a second or two. On a phone
 * that is not an edge case, it is Tuesday. Polled rather than subscribed
 * because the case this exists for is realtime-js flipping its own channel back
 * to joined underneath us.
 */
export async function waitForRelay(
  ms = RELAY_GRACE,
  step = 150,
  sleep = (n) => new Promise((r) => setTimeout(r, n)),
  { socket = false } = {}
) {
  const until = Date.now() + ms
  for (;;) {
    const chan = session?.chan || channel
    /* A tap waits for the socket as well as the channel: see socketUp. */
    if (chan && isJoined(chan) && (!socket || socketUp())) {
      if (channel !== chan) {
        channel = chan
        announce()
      }
      return true
    }
    if (Date.now() >= until) return false
    await sleep(step)
  }
}

/**
 * Send one request over the relay and wait for its reply.
 *
 * Every message carries an id because replies arrive on a shared broadcast
 * channel with no ordering guarantee — matching on id is the only way to know
 * which answer belongs to which question.
 *
 * A dropped socket is not a failed request. A request that could not travel
 * waits for the relay to come back and goes again, once. Repeating is safe
 * because everything relayed says where something should END UP rather than
 * what should happen next — see `repeatable`, and the one route that isn't.
 */
export async function remoteRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  /* The newest press of its control, written down before anything can hold it: see relaySend.
     A write with no deadline is a press made now, never dropped itself — closing the tuner, so an
     opening still waiting in a drop is not sent after the close (shared/relay-rules newestPresses). */
  presses.made(path, options.body, method === 'GET' || Number.isFinite(options.deadline) ? options.deadline : tapDeadline(Date.now()))
  /* Held while the roll call picks a computer: see countDone. */
  if (method !== 'GET') await countDone(options.deadline)
  /*
   * A tap the roll call held past its deadline is dropped, not sent late —
   * and so is one the roll call is STILL holding, whatever the clock says. A
   * timer can go off a millisecond early by Date.now() (link.js downNow says
   * how often Node's did), and then the clock alone read "a millisecond to
   * spare" and let the tap through mid-count, addressed to nobody: on an
   * account with two computers, computer app 1.87.4 carries out a write
   * addressed to nobody on both, which is the one thing the roll call is
   * there to stop. A count that has finished is never mistaken for one still
   * running: censusHosts lets go of `counting` before countDone's wait ends.
   */
  if (Number.isFinite(options.deadline) && ((method !== 'GET' && (counting || pickHeld(options.deadline))) || pastDeadline(options.deadline, Date.now()))) {
    logDebug('wire', `${method} ${path} not sent — past its deadline while the computers were counted`)
    /* With a newer press of its control held too, that one's business: see requestOnce's end. */
    const over = presses.overtaken(path, options.body, options.deadline)
    throw notSentError({ late: over || linkLooksUp(), overtaken: over })
  }
  /*
   * A dump that arrived in the wrong order is asked for again, not shown.
   *
   * See lib/retry.js for what that message is and why it happens. The browser
   * has wrapped its requests this way for as long as the message has existed;
   * the phone showed it raw, on stage, in the codec's own words. Wrapped here
   * rather than in device.js because every read that wants a preset dump —
   * the block list, the scene names, the volume slider's level — passes
   * through this one function.
   *
   * A tap asked again goes in with `went` set: the unit answered the first
   * one, so the tap reached it, and nothing after may call it "not sent".
   */
  return withRetry((again) => requestOnce(path, method, options, { went: again > 0 }), {
    method,
    path,
    deadline: options.deadline,
    /* An answer that came back garbled went: a VP4's preset or scene is not sent again for it. */
    once: sendsOnce(method, path, options.body)
  })
}

/**
 * Whether the link reads as up right now: joined, its socket open, and the
 * computer answering. Only for choosing the words a dropped tap is said in.
 */
const linkLooksUp = () => !!channel && isJoined(channel) && socketUp() && hostSeen

/* When each control's newest tap was pressed (shared/relay-rules newestPresses). */
const presses = newestPresses()

/*
 * WHETHER THE SOCKET UNDER THE CHANNEL IS OPEN, which 'joined' does not say.
 *
 * realtime-js keeps a channel 'joined' across a socket that has closed, and a
 * broadcast sent on it then is not refused: it is posted to the relay server
 * over HTTPS instead (RealtimeChannel.send, "falling back to REST API"), with
 * a ten-second timeout, and this end has never read whether that worked. A
 * tap that went that way could reach the computer ten seconds after the
 * press. So a tap waits for the socket, inside its deadline, and is never
 * handed to that fallback. Reads keep going as they always went.
 *
 * True when the client cannot say — an older realtime-js, or a test's
 * stand-in — so nothing that worked before is held up by not knowing.
 */
function socketUp() {
  try {
    const rt = session?.client?.realtime ?? client?.realtime
    return typeof rt?.isConnected === 'function' ? rt.isConnected() !== false : true
  } catch {
    return true
  }
}

/*
 * WHETHER A SEND ON THIS CHANNEL GOES ON ITS SOCKET, asked the way
 * realtime-js itself asks before choosing (RealtimeChannel.send:
 * `channelAdapter.canPush()`), not the way socketUp does. On the socket, with
 * `ack: false`, a send always answers 'ok'. Off it, send() posts the message
 * over HTTPS, and that road answers 'error' for any fetch that failed —
 * including one that failed after the relay server had taken the post and
 * passed it on. For a VP4's preset or scene that 'error' is the one answer
 * that must not be read as "never left" (see relaySend).
 *
 * Asked of the channel, so it cannot disagree with send(). A channel with no
 * adapter to ask (a test's stand-in) is read as socketUp reads it.
 */
function pushesNow(chan) {
  try {
    const adapter = chan?.channelAdapter
    if (typeof adapter?.canPush === 'function') return adapter.canPush() === true
  } catch {
    return false
  }
  return isJoined(chan) && socketUp()
}

async function requestOnce(path, method, options, trip = { went: false }) {
  /*
   * Nothing is changed while two Macs are listening. A write is not sent to the
   * wrong unit — it is carried out on both. Reads are left alone deliberately:
   * they are a coin flip rather than a hazard, and the screen that has to
   * explain this is built out of reads.
   */
  if (method !== 'GET') {
    const clash = hostConflict()
    if (clash) {
      const err = new Error(clash)
      err.status = 409
      err.hostConflict = true
      throw err
    }
  }

  const why = forbiddenRemotely(method, path)
  if (why) {
    const err = new Error(`You can't ${why} from your ${deviceNoun()} — do that at the computer.`)
    err.status = 403
    err.remoteBlocked = true
    logDebug('wire', `${method} ${path} refused here`, why)
    throw err
  }

  /*
   * One budget for the whole request, not one per attempt. A flapping link
   * would otherwise cost double on every request, and the screen deciding
   * whether a unit is really gone asks several in a row.
   */
  const graceUntil = Date.now() + (options.graceMs ?? RELAY_GRACE)
  /*
   * A TAP'S BUDGET ENDS AT ITS DEADLINE, not at the grace. Everything below
   * is the same for a tap as for anything else — the wait for a channel
   * coming back, the second attempt after a drop — only shorter: what fits
   * inside the deadline still happens, so a connected rig, and a sub-second
   * blip, go exactly as they always did. What does not fit is not sent.
   */
  const tap = Number.isFinite(options.deadline)
  const until = tap ? Math.min(graceUntil, options.deadline) : graceUntil
  const attempts = repeatable(path) ? 2 : 1
  /*
   * A VP4'S PRESET OR SCENE GOES ON THE WIRE ONCE. A second Program Change
   * loads the preset again, losing what the player had not saved, and the
   * computer cannot tell it from the first (shared/relay-rules sendsOnce). So
   * the second try is only for one that never left.
   */
  const once = sendsOnce(method, path, options.body)

  /*
   * Every request passes here, which is why the log is written here and nowhere
   * else. A phone has no console to open — a failure on a stage had nowhere at
   * all to go, and a bad evening could not be reconstructed afterwards.
   *
   * What is kept is the shape of the trip, not its contents: the method, the
   * path, how long it took, and what went wrong. Bodies are deliberately left
   * out — this log is written to be pasted into a chat, and a preset dump is
   * neither readable nor anybody else's business.
   */
  const began = Date.now()
  let last = null
  let overtaken = false
  for (let attempt = 0; attempt < attempts; attempt++) {
    /* The second attempt is checked too: it is the one that used to land late. */
    if (tap && pastDeadline(options.deadline, Date.now())) break
    if (attempt > 0 && once && trip.went) break
    try {
      await relayReady(until - Date.now(), tap)
      /* A read on a fresh link waits for the roll call to say who it is asked of: see holdReads. */
      if (method === 'GET' && readsHeld && !neverHeld(path)) await readsWait(options.deadline)
      const answer = await relaySend(method, path, options, trip)
      const took = Date.now() - began
      /* Only the slow ones. Logging every read would bury the one line that
         matters under four hundred that do not. */
      if (took > 1500) logDebug('wire', `${method} ${path} — ${took}ms`)
      return answer
    } catch (err) {
      /* Too late to put on the wire, or a newer press of the same control was made: no attempt after this one either. */
      if (err?.late) {
        overtaken = err.overtaken === true
        break
      }
      // Only a relay that went missing is worth repeating. A 403, a 409, a unit
      // that answered "no" — those are answers, and asking again gets the same
      // one a second slower.
      if (!err?.linkDown) {
        logDebug('wire', `${method} ${path} failed`, err?.message)
        throw err
      }
      last = err
      logDebug('wire', `${method} ${path} — link down, attempt ${attempt + 1} of ${attempts}`)
    }
  }
  /*
   * A TAP THAT NEVER LEFT IS SAID AS ONE, and a tap that did is not. One that
   * went on the wire and lost its answer to a drop may well have landed, so
   * it keeps the sentence it always had — "The connection dropped before your
   * computer answered." — and is never sent again past its deadline. Only one
   * that never went is "Not sent".
   */
  /*
   * And one a newer press of its control took over, whether or not a first
   * try of it went, is dropped as late and marked `overtaken`: the screen
   * leaves the newer press's tile up and says nothing for it (see
   * shared/relay-rules newestPresses).
   */
  /*
   * And one the clock dropped — its deadline passed waiting for the channel —
   * while a newer press of its control was made: the same, since it is that
   * newer press the player meant. Said as plainly not sent, its screen put
   * back the tile the newer press had lit, over a unit on the newer one.
   */
  if (tap && !overtaken && !trip.went) overtaken = presses.overtaken(path, options.body, options.deadline)
  if (tap && (overtaken || !trip.went)) {
    logDebug('wire', `${method} ${path} not sent${trip.went ? ' again' : ''} — ${overtaken ? 'a newer press of it was made' : 'the link could not carry it before its deadline'}`)
    throw notSentError({ late: overtaken || linkLooksUp(), overtaken })
  }
  logDebug('wire', `${method} ${path} gave up`, last?.message)
  throw last || linkDown('The connection dropped before your computer answered.')
}

async function relayReady(grace, tap = false) {
  if (channel && isJoined(channel)) {
    if (!tap || socketUp()) return
    /* Joined over a socket that has closed: a tap waits for the socket, inside its deadline. */
    if (grace > 0 && (await waitForRelay(grace, 150, undefined, { socket: true }))) return
    throw linkDown('The connection to your computer dropped.')
  }
  if (channel) {
    channel = null
    seen(false)
    announce()
  }
  // Nothing was ever set up, and nothing is coming: say so now rather than
  // making someone watch a grace period elapse over an empty session.
  if (!session && !connecting) throw linkDown('Not connected to your computer.')
  if (grace > 0 && (await waitForRelay(grace, 150, undefined, { socket: tap }))) return
  throw linkDown('The connection to your computer dropped.')
}

/** Too late to send: said by relaySend, read by requestOnce, never shown. */
const tooLate = (overtaken = false) => Object.assign(linkDown('Too late to send.'), { late: true }, overtaken ? { overtaken } : {})

/** One trip: shout the question, match the answer by id, unwrap it. */
async function relaySend(method, path, options, trip = { went: false }) {
  const tap = Number.isFinite(options.deadline)
  /*
   * THE LAST LOOK AT THE CLOCK before a tap goes on the wire, whichever way
   * it got here: the first attempt, the second after a drop, or a dump asked
   * for again. relayReady returns at once on a joined channel however long
   * the request has waited, so this is the one check every send passes.
   */
  if (tap && pastDeadline(options.deadline, Date.now())) throw tooLate()
  /* And not after a newer press of the same control: it would land over the newer one (shared/relay-rules newestPresses). */
  if (tap && presses.overtaken(path, options.body, options.deadline)) throw tooLate(true)
  /*
   * A VP4'S PRESET OR SCENE NEVER TAKES THE HTTPS ROAD. A send there that
   * answers 'error' may already be on the computer, and below an 'error' is
   * read as refused, so the second try would send it again: a second Program
   * Change, which reloads the preset and loses what the player had not saved.
   * relayReady has already waited for the socket, so this is the last look,
   * asked the way send() will ask. Not on the socket: not sent, and nothing
   * went, so a second try inside the deadline is its first.
   */
  if (tap && sendsOnce(method, path, options.body) && !pushesNow(channel)) {
    throw linkDown('The connection to your computer dropped.')
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  let doubt = null
  const reply = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(id)
      // Nothing came back: whatever we last believed about the Mac being there,
      // this is better evidence.
      seen(false)
      const quiet = new Error('Your computer didn’t answer.')
      /* About the link, but NOT retryable — see linkDown above. */
      quiet.aboutLink = true
      reject(quiet)
    }, options.timeoutMs || timeoutFor(method, path))
    const done = () => {
      clearTimeout(timer)
      if (doubt) clearTimeout(doubt)
    }
    waiting.set(id, {
      resolve: (v) => {
        done()
        resolve(v)
      },
      reject: (e) => {
        done()
        reject(e)
      }
    })
  })

  /*
   * Addressed once there is more than one Mac to address, and never before. A
   * single-host session sends exactly what it always sent, so nothing depends
   * on the host being new until the moment two are listening — and by then
   * confirmTargeting has proved they understand it.
   *
   * The deadline is not in it. Computer app 1.87.4 reads these four fields
   * and the host and nothing else, and has no clock in common with this
   * phone to read a deadline by.
   */
  const ask = { id, method, path, body: options.body ?? null }
  if (hosts.length > 1 && chosen && targeted) ask.host = chosen
  /* A read while the pick is still being proved: asked of it already (holdReads). A write never is. */
  else if (method === 'GET' && readsTo) ask.host = readsTo
  /* Who the roll call's reads were asked of, for link.js (remoteReadsAskedOf). */
  if (readsAsked && method === 'GET' && !neverHeld(path) && !readsAsked.includes(ask.host || '')) readsAsked.push(ask.host || '')
  /* Asked of nobody: a second answer to it is a second computer (anotherAnswered). */
  const entry = waiting.get(id)
  if (entry) entry.open = !ask.host

  const before = trip.went
  try {
    const msg = { type: 'broadcast', event: 'req', payload: ask }
    trip.went = true
    /* A tap is given the time it has left, should realtime-js ever have to post it the slow way. */
    const said = tap ? await channel.send(msg, { timeout: Math.max(1, options.deadline - Date.now()) }) : await channel.send(msg)
    /* Refused before it left: not on the wire, and the link is why. */
    if (tap && said === 'error') throw new Error('the relay would not take it')
  } catch (err) {
    trip.went = before
    /*
     * A send that throws never reached the wire, and the promise above is still
     * parked in `waiting` holding a timer. Left there it fires twenty seconds
     * later against a request nobody made — and, forgotten but not stopped, it
     * still did: twenty seconds on it called the computer unanswered, which
     * would now dim a working rig for a request that was never asked. So it
     * is settled here, which stops the timer, as well as forgotten.
     */
    waiting.get(id)?.resolve?.(null)
    waiting.delete(id)
    throw linkDown(
      err?.message ? `Couldn’t reach your computer — ${err.message}` : 'Couldn’t reach your computer.'
    )
  }

  /*
   * A TAP WITH NO ANSWER BY ITS DEADLINE IS A REASON TO ASK. Computer app
   * 1.87.4 can go deaf on a channel the relay server closed under it — sleep,
   * a network change — while this end still reads joined; a tap sent into it
   * is lost, and the bar went on saying connected until a keepalive missed,
   * up to fourteen seconds later. One /healthz at the deadline finds out now.
   * It changes nothing about the tap, and a computer that is merely busy
   * answers it at once: /healthz never waits on the serial port.
   */
  if (tap && hostSeen) {
    doubt = setTimeout(() => {
      doubt = null
      if (waiting.has(id) && hostSeen) hostResponds().catch(() => {})
    }, Math.max(0, options.deadline - Date.now()))
  }

  const payload = await reply
  // An answer is proof the Mac is on the channel — better proof than any probe,
  // and free. Every request the app makes keeps this current.
  seen(true)
  const text = await decode(payload)

  let parsed = null
  if (typeof text === 'string' && text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  } else if (text) {
    parsed = text
  }

  if (payload.status >= 400) {
    const err = new Error(parsed?.message || parsed?.error || `Host returned ${payload.status}`)
    err.status = payload.status
    if (payload.status === 403) err.remoteBlocked = true
    throw err
  }
  return parsed
}
