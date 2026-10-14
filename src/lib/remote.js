/**
 * Driving the unit from somewhere that isn't the machine holding the cable.
 *
 * ForgeFX can act as a host agent: signed in to Supabase, it subscribes to the
 * private channel `remote:<uid>` and executes allowlisted requests against its
 * own local server, replying on the same channel. This is the other end of that
 * — the phone in your hand at the far side of a stage.
 *
 * The channel is private and RLS-scoped to one user, so both ends must be signed
 * in as the same person. That is the whole of the security model, and it is a
 * good one: nobody else can join, by construction rather than by convention.
 *
 * Credentials live in this browser rather than in the deployed build. The app is
 * hosted, the Supabase project is the player's own, and baking one person's
 * project into a public bundle would be wrong even when that person is the only
 * user.
 */

const STORE_KEY = 'fractal.remote.config'

/**
 * The project this app relays through.
 *
 * Baked in rather than typed each time. The anon key is designed to be public —
 * it identifies the project, it authorises nothing on its own, and every table
 * and channel behind it is governed by RLS.
 *
 * Specifically: the realtime policy on this project allows a signed-in user to
 * read and write only the channel `remote:<their own uid>`. So a stranger who
 * takes this key and signs up gets a channel of their own with no host on it.
 * They cannot see this one, and no amount of knowing the key changes that.
 * Safety comes from the policy, not from the key being secret.
 *
 * Both can still be overridden, for a second project or a rotated key.
 */
/*
 * Defined beside the Mac launchers rather than here, because they need it too:
 * ForgeFX is started already pointed at this project, so nobody edits a
 * `.env` on the Mac. One constant, imported from both ends, cannot drift.
 */
export { DEFAULT_PROJECT } from '../../desktop/lib/project.mjs'
import { DEFAULT_PROJECT } from '../../desktop/lib/project.mjs'


/**
 * What the host will and won't do from a distance, how long to wait, and the
 * words for a refusal.
 *
 * All of it lives in `shared/relay-rules.mjs` now, because the browser is no
 * longer the only client of this protocol — the phone apps under `mobile/`
 * speak it too, to the same host, and a second copy of an allowlist is a
 * second copy that drifts. Re-exported here so every existing caller and every
 * test keeps its import.
 */
export {
  REMOTE_FORBIDDEN,
  forbiddenRemotely,
  timeoutFor,
  repeatable,
  RELAY_GRACE,
  explainAuth,
  NOT_IN_INBOX,
  sentAgain,
  /* A tap's deadline and the words for one dropped, for the screens that press things. */
  NOT_CONNECTED,
  NOT_SENT,
  NOT_SENT_SHOWN_MS,
  notSentError,
  tapDeadline,
  /* And whether a setlist song's scene and tempo would land late after a load the link held up. */
  songNotSent,
  songWouldLandLate
} from '../../shared/relay-rules.mjs'
import {
  forbiddenRemotely,
  timeoutFor,
  repeatable,
  RELAY_GRACE,
  explainAuth,
  notConfirmed,
  hostConflict as conflictBetween,
  hostNamesFrom as namesFrom,
  firstUnitHost,
  unitChoices,
  unitFrom,
  notSentError,
  pastDeadline,
  newestPresses,
  tapDeadline
} from '../../shared/relay-rules.mjs'
import { CODE_DIDNT_WORK, CODE_NOT_DIGITS, cleanCode, codeRefused } from '../../shared/confirm-code.mjs'

export const loadRemoteConfig = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
  } catch {
    return null
  }
}

export const saveRemoteConfig = (config) => {
  if (config) localStorage.setItem(STORE_KEY, JSON.stringify(config))
  else localStorage.removeItem(STORE_KEY)
}

/**
 * Whether to rejoin the host automatically on load.
 *
 * Having signed in once isn't the same as wanting to be remote. Someone sitting
 * at the Mac with the cable in it should stay local, so this records the last
 * thing chosen rather than inferring it from a session that happens to exist.
 */
export const setAutoConnect = (on) => {
  const config = loadRemoteConfig() || {}
  saveRemoteConfig({ ...config, autoConnect: !!on })
}

/*
 * Absent means yes. A phone that signed in wants to be a remote — that is
 * what signing in on a phone is for — and only a deliberate Disconnect says
 * otherwise. It used to be the other way round, and a single failed rejoin
 * (the Mac merely asleep) also switched it off for good.
 */
export const wantsAutoConnect = () => loadRemoteConfig()?.autoConnect !== false

/**
 * Whether a sign-in was saved here — without loading the client to ask.
 *
 * The client is a few hundred KB fetched on demand, and asking it means a
 * network round trip. A phone that signed in last time should say
 * "Connecting…" from its first frame, not "Connect" for the second it takes
 * to find out; this reads the key the client wrote and answers at once.
 */
export function hasSavedSession({ url, storage } = {}) {
  try {
    const ref = new URL(url || DEFAULT_PROJECT.url).hostname.split('.')[0]
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null)
    const raw = store?.getItem(`sb-${ref}-auth-token`)
    if (!raw) return false
    const saved = JSON.parse(raw)
    return !!(saved?.access_token || saved?.currentSession?.access_token)
  } catch {
    return false
  }
}

let client = null
let channel = null // the joined channel, and null the moment it stops being joined
let session = null // what we built: the channel object and the client it belongs to
let userId = null
/*
 * A rejoin is under way. Between remoteDisconnect tearing the old session down
 * and the new one being registered there is no session at all, and a request
 * caught in that window would otherwise be told "not connected" and give up —
 * over a link that was seconds from coming back, and coming back BECAUSE of
 * the drop it is reacting to. See relayReady.
 */
let connecting = false
let hostSeen = false
let answeredAt = 0
const waiting = new Map()
const listeners = new Set()
const watchers = new Set()
const seers = new Set()

/*
 * Every Mac that answered the last roll call, by the name it calls itself.
 *
 * Normally one, and everything below is a no-op. See censusHosts.
 */
let hosts = []
/** Which of them requests are addressed to. Null while there is only one. */
let chosen = null
/** Whether addressing one Mac has been PROVED to leave the others out. */
let targeted = false
/** Which unit each of them is driving, by name, when it could be told: see readUnits. */
let units = {}
/** Roll calls in progress: an id, and every answer that has come back to it. */
const censuses = new Map()

/**
 * Which Macs are answering for this account.
 *
 * Empty until a roll call has been taken, one entry in the ordinary case, and
 * more than one only in the situation this exists for.
 */
export const remoteHosts = () => hosts

/** Which unit each answering computer has, by its name: { model, plugged }. */
export const remoteUnits = () => units

export { unitChoices }

/*
 * Who is answering, as it changes.
 *
 * The roll call used to be taken in one place — on joining — and read in
 * another, so anything that re-took it had to remember to push the result back
 * into the screen state by hand. The write gate below re-takes it, and the
 * notice it clears is drawn from link.js, which has no way to know. Announced,
 * every re-take reaches the screen for free.
 */
const hostWatchers = new Set()

export function subscribeHosts(fn) {
  hostWatchers.add(fn)
  return () => hostWatchers.delete(fn)
}

function hostsChanged() {
  for (const fn of hostWatchers) {
    try {
      fn(hosts, chosen, targeted)
    } catch {
      // One bad watcher shouldn't stop the others.
    }
  }
}

/**
 * Count the Macs on the channel, and learn what each is called.
 *
 * A request is a broadcast on one channel per ACCOUNT — `remote:<uid>` — and it
 * carries an id but no address. It is not sent to a Mac; it is shouted, and
 * every Mac signed into that account hears it and answers. With one Mac that is
 * a perfectly good design and nobody would build it differently.
 *
 * With two it is a fault, and the two halves fail differently. A read gets two
 * answers, and remoteRequest resolves on the first and silently drops the
 * second — so which unit you are looking at is decided by whichever Mac was
 * quicker, and can change between one request and the next. A write is worse,
 * because it is not a race: both Macs carry it out. "Turn the drive on" is
 * executed on the AM4 and on the FM3.
 *
 * Nothing detected that, because the app had no way to ask "how many of you are
 * there?" — the one thing every reply looks identical for. This is that
 * question. It sends one ordinary read and, instead of taking the first answer,
 * keeps listening for the rest of a short window and counts what arrives. The
 * read is the Mac's own name, so the same round trip that counts them also says
 * which they are, which is what a person needs in order to do anything about it.
 *
 * Slow on purpose: it has to wait out the window even when the first answer
 * comes back instantly, because "no second answer yet" and "no second answer at
 * all" are the same thing until the clock runs out. Taken once per connect.
 */
async function takeCensus({
  windowMs = 1500,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms))
} = {}) {
  if (!channel || !isJoined(channel)) return hosts
  // A read every host allows and every host answers differently: its own name,
  // written into its store by the launcher on that Mac.
  const answers = await collectAnswers({ path: '/store/config/host.name', windowMs, sleep })
  hosts = await hostNamesFrom(answers)

  // A choice made before is honoured if that Mac is still one of the answers.
  if (!hosts.includes(chosen)) chosen = null
  if (hosts.length > 1 && !chosen) {
    const remembered = recallHost()
    if (hosts.includes(remembered)) chosen = remembered
  }
  units = hosts.length > 1 ? await readUnits({ windowMs, sleep }) : {}
  /* Nobody said which: drive one rather than all of them (firstUnitHost). */
  if (hosts.length > 1 && !chosen) chosen = firstUnitHost(hosts, units)
  targeted = false
  if (hosts.length > 1 && chosen) await confirmTargeting({ windowMs, sleep })
  countedAt = Date.now()
  hostsChanged()
  return hosts
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
const COUNT_WAIT_MS = 6000

export function censusHosts(options) {
  const run = takeCensus(options)
  counting = run
  run.finally(() => {
    if (counting === run) counting = null
  }).catch(() => {})
  return run
}

/**
 * Resolves once no roll call is running, or after COUNT_WAIT_MS at most — and
 * for a tap no later than its deadline, as on the phone (mobile/src/lib/relay.js):
 * the count is not cut short for it, the tap is dropped if it outlasts it.
 */
function countDone(deadline) {
  if (!counting) return Promise.resolve()
  const most = Number.isFinite(deadline) ? Math.max(0, Math.min(COUNT_WAIT_MS, deadline - Date.now())) : COUNT_WAIT_MS
  return Promise.race([counting.catch(() => {}), new Promise((r) => setTimeout(r, most))])
}

/**
 * When the roll call was last taken, so a stale one can be told from a fresh one.
 *
 * Zero means never. See `conflictNow` for the whole of why this matters.
 */
let countedAt = 0

/**
 * Shout one read and keep every answer, rather than the first.
 *
 * The whole of counting hosts is here: replies are indistinguishable, so the
 * only question that can be asked of them is how many. Waits out the window
 * even when the first answer is instant, because "no second answer yet" and "no
 * second answer at all" are the same thing until the clock runs out.
 */
async function collectAnswers({ path, host = null, windowMs, sleep }) {
  const id = `census-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const answers = []
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
 * The host end of this only exists in a new enough ForgeFX: an older one has
 * never heard of an addressed request and answers it like any other. So the app
 * does not take the feature on trust — it asks the chosen Mac one addressed
 * question and counts the answers. Exactly one means every other Mac stayed
 * out of it, which is the only evidence that a write will land in one place.
 * Anything else means at least one Mac on this account is too old, and writes
 * stay refused.
 *
 * Which makes a mixed pair fail safe rather than fail quietly: the dangerous
 * case and the un-upgraded case produce the same answer, and it is the careful
 * one.
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
 */
export async function pickHost(name, { windowMs = 1500, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  if (!hosts.includes(name)) return false
  chosen = name
  rememberHost(name)
  targeted = false
  if (hosts.length > 1) await confirmTargeting({ windowMs, sleep })
  return targeted
}

/** Which Mac requests are addressed to, or null when there is only one to ask. */
export const remoteChosenHost = () => chosen

const HOST_KEY = 'fab.remote.host'
const recallHost = () => {
  try {
    return localStorage.getItem(HOST_KEY)
  } catch {
    return null
  }
}
const rememberHost = (name) => {
  try {
    localStorage.setItem(HOST_KEY, name)
  } catch {
    // A choice we cannot write down still holds for this visit.
  }
}

/**
 * Turn the answers to a roll call into names, and read the conflict between
 * them. Both are rules the phone needs word for word, so both live in
 * `shared/relay-rules.mjs`; what stays here is this module's own state —
 * `decode` knows the host's framing, and the three variables are what a roll
 * call last found.
 */
export const hostNamesFrom = (answers, read = decode) => namesFrom(answers, read)

export const hostConflict = (list = hosts, pick = chosen, proved = targeted) =>
  conflictBetween(list, pick, proved)

/**
 * The clash as it is NOW, not as it was when this phone connected.
 *
 * "Only one Mac connected to anything, but I got this notification."
 *
 * The roll call was taken once, inside join, and never again. Everything after
 * it — the notice on screen, and the refusal of every write — was answered from
 * that one moment. So a second Mac that was awake when the phone connected and
 * has since slept, quit, or been signed out went on blocking writes for the
 * rest of the session, describing a room that had emptied. The only way out was
 * to notice the "Check again" button, or to reconnect.
 *
 * A refusal is the one moment where being right actually matters, so that is
 * where the question gets asked again. It costs the roll call's window — a
 * second and a half — and only when a clash is currently believed, which in the
 * ordinary case is never. A write that was going to be refused can afford to
 * find out it doesn't have to be.
 */
export async function conflictNow(maxAgeMs = 4000) {
  const clash = hostConflict()
  if (!clash) return null
  // Just taken, by a gate a moment ago or by the screen: asking again would
  // add three seconds to a burst of writes and learn nothing.
  if (Date.now() - countedAt < maxAgeMs) return clash
  try {
    await censusHosts()
  } catch {
    // A roll call that could not be taken leaves the last one standing, which
    // is the careful direction: it keeps writes refused rather than letting
    // them through on a link we just failed to question.
  }
  return hostConflict()
}

/**
 * The one way `hostSeen` changes, so anyone who cares hears about it.
 *
 * Every answered request is proof the Mac is there and every timeout is proof
 * it is not, and until now that proof went into a variable nothing watched:
 * the bar polled it every two seconds and a screen that had gone red had no
 * way to turn green again except by asking. Announced on change, ordinary
 * traffic keeps every indicator honest for free.
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

/** When the Mac last answered anything, so a keepalive can be skipped while traffic flows. */
export const lastAnswerAt = () => answeredAt

export const remoteActive = () => !!channel

/**
 * Which account this browser joined as.
 *
 * The channel is named after the user id, so the two ends meeting at all
 * depends on this matching what the Mac signed in as — and a browser holds a
 * Supabase session of its own, which survives everything and is not necessarily
 * the address anyone remembers typing. Printed at both ends, a mismatch is a
 * thing you can see; unprinted, it is a connection that simply never happens.
 */
export const remoteUserId = () => userId

/** A session that exists, joined or not — the difference between "dropped" and "never set up". */
export const remoteLinked = () => !!session

/**
 * Whether the Mac answered the last time we asked it something.
 *
 * This used to count presence — "is anything else on the channel?" — and the
 * answer was always no, on a working session as much as a broken one. The host
 * joins the channel but never tracks presence, so it is not in the state we
 * were reading, and there is nothing it could do about it from here. What that
 * check produced was a line saying "nothing else is on this channel, turn the
 * host on at the Mac" every single time someone connected, including with the
 * host on and answering.
 *
 * A relayed request is the only honest test of a relay, so that is the test:
 * ask the host for its health and see whether an answer comes back.
 *
 * Our own presence still matters and is still tracked — the host bridges live
 * device events only while it can see a browser watching.
 *
 * Kept current by ordinary traffic rather than by asking: every answered
 * request is proof, and every request that times out is proof of the opposite.
 */
export const remoteHostSeen = () => hostSeen

/**
 * Ask the Mac whether it's there, and remember the answer.
 *
 * Short-fused on purpose: this is asked at moments someone is waiting through
 * — just after connecting, and on a screen that is already saying something is
 * wrong. A host that is there answers /healthz in well under a second.
 */
export async function hostResponds() {
  if (!channel) {
    seen(false)
    return false
  }
  try {
    /*
     * No grace: this is the question that decides whether the relay is worth
     * being patient about, so it must not itself wait out a grace period.
     * The loop in link.js asks it every few seconds; a probe that took eight
     * seconds to answer "no" would be the reason a red lamp was slow.
     */
    await remoteRequest('/healthz', { timeoutMs: 6000, graceMs: 0 })
    seen(true)
  } catch {
    seen(false)
  }
  return hostSeen
}

/**
 * Whether the relay is up, as it changes.
 *
 * A socket can close under a phone that's locked, carried out of range, or
 * handed from wifi to cellular, and nothing here noticed: `channel` stayed set,
 * so the app went on believing it was connected and every request went into a
 * dead socket and waited for its timeout. Worse, a manual reconnect saw that
 * same channel and returned it unchanged, which is why only a page reload ever
 * fixed it — a reload is the one thing that clears this module's state.
 *
 * So the join status is watched rather than sampled once, and anyone who cares
 * is told. realtime-js rejoins on its own when the network comes back; this is
 * what turns that rejoin into the app catching up rather than a stale screen.
 */
export function subscribeRemoteState(fn) {
  watchers.add(fn)
  return () => watchers.delete(fn)
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

/**
 * The socket went, as an error anything upstream can recognise without reading
 * English.
 *
 * Four different sentences mean "the relay dropped" — thrown from four places
 * here — and every one of them used to arrive at the write loop as an ordinary
 * failure indistinguishable from "the unit refused this parameter". So a
 * hundred-write send met a two-second blip and produced ninety failures, one
 * per remaining change, none of which had been tried. The flag is what lets a
 * caller tell "this never left the phone" from "the unit said no".
 */
function linkDown(message) {
  const err = new Error(message)
  err.linkDown = true
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
 * realtime-js rejoins on its own after a socket closes — a phone unlocked, a
 * hand-off from wifi to cellular, a tunnel. It takes a second or two, and for
 * that second or two every request in flight and every request after it failed
 * outright. That is survivable when someone is tapping a control; it is not
 * survivable in the middle of a send, where three hundred writes go down one
 * serial port and the whole thing is abandoned at write forty.
 *
 * Polled rather than subscribed on purpose: `announce` only fires when the
 * module's own `channel` changes, and the case this exists for is realtime-js
 * flipping its channel back to joined underneath us.
 */
export async function waitForRelay(
  ms = RELAY_GRACE,
  step = 150,
  sleep = (n) => new Promise((r) => setTimeout(r, n)),
  { socket = false } = {}
) {
  const until = Date.now() + ms
  for (;;) {
    // The session's channel is the one realtime-js rejoins; `channel` is our
    // own view of it, cleared the moment it stopped being joined. Either being
    // back is the relay being back. A tap waits for its socket too: see socketUp.
    const chan = session?.chan || channel
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
 * Two ways it isn't, and connect used to fall for both. A channel whose socket
 * has closed is still an object and still truthy. And signing in again builds a
 * new client, which leaves the channel wired to the old one — a client the app
 * no longer holds and whose socket nothing is keeping alive.
 */
export function canReuseChannel(channel, session, client) {
  return !!channel && !!client && session?.client === client && isJoined(channel)
}

/** Create the account, when there isn't one yet. Same project, same policies. */
export async function remoteSignUp({ url, anonKey, email, password }) {
  const { createClient } = await import('@supabase/supabase-js')
  const c = createClient(url || DEFAULT_PROJECT.url, anonKey || DEFAULT_PROJECT.anonKey)
  const { data, error } = await c.auth.signUp({ email, password })
  if (error) throw new Error(explainAuth(error.message))
  /*
   * An address that already has an account is not an error to the account
   * service: it answers as if it had made one — a user with no identities
   * and no session — so a stranger cannot learn which addresses are taken.
   * Said here, so the form does not tell somebody coming back "Account made,
   * check your email" for an email that will never arrive.
   */
  const existing = Array.isArray(data?.user?.identities) && data.user.identities.length === 0
  // Confirmation may be required, in which case there is no session yet.
  return { needsConfirmation: !data?.session, existing, userId: data?.user?.id || null }
}

/**
 * Pick up a session left over from last time.
 *
 * Supabase already persists the session — signing in writes it to localStorage
 * and it stays there. What was missing is this: nothing ever asked for it, so a
 * refresh looked like a sign-out and the password got typed again.
 *
 * Returns the user id when a session is still good, null otherwise. Never
 * throws and never prompts: a stale or expired session is a normal thing to
 * find, and the answer is to show the sign-in form, not an error.
 */
export async function restoreSession({ url, anonKey } = {}) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const c = createClient(url || DEFAULT_PROJECT.url, anonKey || DEFAULT_PROJECT.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
    const { data } = await c.auth.getSession()
    if (!data?.session?.user?.id) return null
    client = c
    userId = data.session.user.id
    return userId
  } catch {
    return null
  }
}

/**
 * The signed-in client, for everything that is not the relay.
 *
 * Signing in and joining a channel are separate things, and this is the seam
 * between them: an account is enough to keep presets, change a password or
 * sign out, none of which need a host at the other end. `restoreSession` sets
 * this without joining anything, so a browser that signed in weeks ago has it
 * on the next load.
 */
export const supabaseClient = () => client

/** Who is signed in, or null. Email included because that is what a person recognises. */
export async function currentAccount() {
  if (!client) return null
  try {
    const { data } = await client.auth.getUser()
    if (!data?.user) return null
    return { id: data.user.id, email: data.user.email || '' }
  } catch {
    return null
  }
}

/**
 * Whether a computer on this wifi is signed into a different account.
 *
 * The phone's question, asked from the browser: see mobile/src/lib/relay.js.
 * Yes or no and nothing more, and any failure is a no.
 */
export async function computerElsewhere() {
  if (!client) return false
  try {
    const { data, error } = await client.rpc('computer_elsewhere')
    return !error && data === true
  } catch {
    return false
  }
}

/**
 * Whether any computer has signed in with this browser's account: true,
 * false, or null for can't tell.
 *
 * The phone's question, asked from the browser: see mobile/src/lib/relay.js
 * and supabase/migrations/20261014_account_has_computer.sql. Null is never a
 * no — not signed in, an error, no signal, or a database without the
 * function all keep today's words.
 */
export async function accountHasComputer() {
  if (!client) return null
  try {
    const { data, error } = await client.rpc('account_has_computer')
    if (error) return null
    return data === true ? true : data === false ? false : null
  } catch {
    return null
  }
}

/**
 * Sign out here, and everywhere the session was written.
 *
 * Scope 'local' rather than 'global' on purpose: signing out on a phone should
 * not sign out the Mac that is hosting, which would drop the link for everyone
 * mid-set. Signing out of every device is a different request and deserves to
 * be asked for explicitly.
 */
export async function signOut() {
  if (!client) return
  try {
    await client.auth.signOut({ scope: 'local' })
  } finally {
    client = null
    userId = null
  }
}

/**
 * Delete the signed-in account for good, and everything stored under it.
 *
 * The browser's copy of the phone's deleteAccount (mobile/src/lib/relay.js),
 * the same server: supabase/functions/delete-account, which deletes only the
 * account its session token names. Throws a sentence for the screen.
 */
export async function deleteAccount() {
  if (!client) throw new Error('Sign in again, then delete the account.')
  const { data } = await client.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in again, then delete the account.')
  const c = loadRemoteConfig() || {}
  let res
  try {
    res = await fetch(`${c.url || DEFAULT_PROJECT.url}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: c.anonKey || DEFAULT_PROJECT.anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ confirm: 'delete' })
    })
  } catch {
    throw new Error('No connection to the account server. Check the internet and try again.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.deleted) throw new Error(body?.error || 'The account could not be deleted. Try again in a minute.')
}

/** Change the password of the account already signed in. */
export async function changePassword(password) {
  if (!client) throw new Error('Sign in first.')
  const { error } = await client.auth.updateUser({ password })
  if (error) throw new Error(explainAuth(error.message))
}

/**
 * Start a reset for an account nobody can get into.
 *
 * Needs no session by definition, so it builds its own client. The redirect
 * goes to this app rather than to Supabase's own page, and has to be on the
 * project's allow-list or the link in the mail lands nowhere.
 */
export async function sendPasswordReset({ url, anonKey, email, redirectTo } = {}) {
  const { createClient } = await import('@supabase/supabase-js')
  const c = createClient(url || DEFAULT_PROJECT.url, anonKey || DEFAULT_PROJECT.anonKey)
  const { error } = await c.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined)
  if (error) throw new Error(explainAuth(error.message))
}

/** A fresh "confirm your email" link, for an address that never tapped the first. */
export async function resendConfirmation({ url, anonKey, email } = {}) {
  const { createClient } = await import('@supabase/supabase-js')
  const c = createClient(url || DEFAULT_PROJECT.url, anonKey || DEFAULT_PROJECT.anonKey)
  const { error } = await c.auth.resend({ type: 'signup', email })
  if (error) throw new Error(explainAuth(error.message))
}

/**
 * Confirm a new account with the code in its email: the phone's
 * confirmWithCode (mobile/src/lib/relay.js), by the same rules and in the
 * same words (shared/confirm-code.mjs). The email's link keeps working as it
 * always has; this is the second way past it.
 *
 * WHAT IT DOES NOT DO is sign this browser in, and on purpose. Signing in
 * here is more than a session — it is whatever errand the form was opened
 * for (connect this phone, or sign the computer's device server in with the
 * same password), and the form's caller does that. So this confirms the
 * account on a client of its own that keeps nothing, and the form then
 * signs in through its caller exactly as Sign in does, with the password
 * still in it (SignIn.jsx, confirm). Nothing is left half signed in if that
 * second step fails: the account is confirmed, and Sign in works.
 */
export async function confirmWithCode({ url, anonKey, email, code } = {}) {
  const token = cleanCode(code)
  if (!token) throw new Error(CODE_NOT_DIGITS)
  const { createClient } = await import('@supabase/supabase-js')
  const c = createClient(url || DEFAULT_PROJECT.url, anonKey || DEFAULT_PROJECT.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const { data, error } = await c.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw new Error(codeRefused(error) ? CODE_DIDNT_WORK : explainAuth(error.message))
  return data?.session?.user?.id || data?.user?.id || null
}

export async function remoteSignIn({ url, anonKey, email, password }) {
  // Loaded on demand: a realtime client is a couple of hundred KB and most
  // sessions are local, sitting at the machine with the cable in it.
  const { createClient } = await import('@supabase/supabase-js')
  client = createClient(url || DEFAULT_PROJECT.url, anonKey || DEFAULT_PROJECT.anonKey, {
    // autoRefreshToken keeps a long session alive rather than expiring it
    // mid-set, which is the worst possible moment to be handed a login form.
    auth: { persistSession: true, autoRefreshToken: true }
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  /* `notConfirmed`: the email was never confirmed, and the form offers to send it again. */
  if (error) throw Object.assign(new Error(explainAuth(error.message)), { notConfirmed: notConfirmed(error) })
  userId = data?.user?.id
  if (!userId) throw new Error('Signed in but Supabase returned no user id.')
  return userId
}

/**
 * Join the host's channel and start relaying.
 *
 * Presence matters: the host only bridges device events while at least one
 * remote is watching, so joining with a presence track is what makes live
 * updates arrive rather than an optional nicety.
 */
export async function remoteConnect({ fresh = false } = {}) {
  if (!client || !userId) throw new Error('Sign in first.')

  /*
   * Only a channel that is joined AND belongs to the client we're holding can
   * be reused. This used to be `if (channel) return userId`, which handed back
   * whatever was left over: a socket that had dropped, or — after signing in
   * again, which builds a new client — a channel wired to the old one. Connect
   * returned instantly, the app said it was connected, and every request sat
   * there until it timed out. Anything else gets torn down and rebuilt.
   *
   * `fresh` refuses even a channel that looks perfect, and exists because of
   * the one state this cannot see: a socket the phone believes is joined and
   * the server has long since let go of. Nothing local can tell that from a
   * working one — the phone sends into it and hears nothing back — so the only
   * cure is a new socket, which until now meant force-quitting the app. That
   * is what Try again asks for. Nothing automatic passes it: the keepalive
   * runs every few seconds and must not tear down a link that is fine.
   */
  if (!fresh && canReuseChannel(channel, session, client)) return userId
  connecting = true
  try {
    return await joinChannel()
  } finally {
    connecting = false
  }
}

async function joinChannel() {
  await remoteDisconnect()

  /*
   * Clear out anything left from a previous attempt first.
   *
   * client.channel(topic) returns the EXISTING channel when one is already
   * registered for that topic rather than making a new one. So a connect that
   * failed after subscribing leaves a joined channel behind, and every retry is
   * handed that same joined channel — where registering presence throws. The
   * symptom is an error that repeats forever until the page is reloaded, which
   * is a miserable thing to hand someone mid-setup.
   */
  for (const existing of client.getChannels()) {
    try {
      await client.removeChannel(existing)
    } catch {
      // Already gone is the outcome we wanted anyway.
    }
  }

  /*
   * Presence has to be declared before subscribe, not after.
   *
   * realtime-js decides whether to enable presence at join time, from the
   * bindings registered so far plus `presence.enabled`. Calling track() on an
   * already-joined channel throws, and — worse than the crash — presence would
   * have been off on the server side, so the host would never have seen anyone
   * watching and would never have bridged a single device event.
   */
  const chan = client.channel(`remote:${userId}`, {
    config: { private: true, broadcast: { ack: false }, presence: { key: 'browser', enabled: true } }
  })

  chan.on('broadcast', { event: 'res' }, ({ payload }) => {
    /*
     * A roll call keeps every answer; an ordinary request keeps the first.
     *
     * This is the only place a second answer to the same id is visible at all.
     * Below, `waiting.delete` runs before the resolve, so a duplicate finds
     * nothing pending and is dropped without trace — which is exactly how two
     * Macs went unnoticed.
     */
    const census = payload?.id && censuses.get(payload.id)
    if (census) census.push(payload)

    const pending = payload?.id && waiting.get(payload.id)
    if (pending) {
      waiting.delete(payload.id)
      pending.resolve(payload)
    }
  })

  /*
   * Presence is bound but deliberately says nothing.
   *
   * The Mac never tracks presence, so the only key ever in the state is our
   * own — and this handler used to read that as "nobody else here" and set
   * hostSeen false on every sync, undoing what answered traffic had just
   * proved. The chip went red over a link that was working. The binding
   * stays because presence has to be enabled for the Mac to see a phone
   * watching and bridge live events to it; the conclusion is gone.
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
   * realtime-js calls it again every time the channel's state changes — which
   * is the only notice we get that a socket died, and the only notice that it
   * came back. Settling the join promise is a one-off; keeping `channel`
   * truthful is the ongoing job.
   */
  session = { chan, client }
  let settled = false
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('Joining the channel timed out.'))
    }, 12000)

    chan.subscribe((status) => {
      if (session?.chan !== chan) return // a channel we've already replaced

      if (status === 'SUBSCRIBED') {
        channel = chan
        chan.track({ at: Date.now() }).catch(() => {})
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve()
        }
        announce()
        return
      }

      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
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
    await client.removeChannel(chan).catch(() => {})
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
  failWaiting('Disconnected.')
  announce()

  if (going?.chan) {
    try {
      // Removed, not merely unsubscribed: a channel left registered on the
      // client is handed back by the next `client.channel(topic)`, already
      // joined, and registering presence on it throws.
      await going.client.removeChannel(going.chan)
    } catch {
      // Already gone is the outcome we wanted anyway.
    }
  }
}

/** Device events bridged from the host, same shape as the local SSE stream. */
export function subscribeRemoteEvents(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Decode whatever framing the host used. */
async function decode(payload) {
  const { body, encoding } = payload
  if (encoding === 'utf8') return body

  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  if (encoding === 'base64') return bytes

  // gzip: the host compresses anything over a couple of KB, which is most of
  // the interesting payloads — catalogs, grids, block lists.
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

/**
 * Send one request over the relay and wait for its reply.
 *
 * Every message carries an id because replies arrive on a shared broadcast
 * channel with no ordering guarantee — matching on id is the only way to know
 * which answer belongs to which question.
 *
 * A dropped socket is not a failed request. Sending a preset is three hundred
 * of these down one serial port over several minutes, and for all of that time
 * the phone is a phone: it gets locked, it gets carried, it moves from wifi to
 * cellular. Any one of those closes the socket, realtime-js opens another a
 * second or two later, and in between every remaining write failed instantly
 * without ever leaving the handset. One blip forty writes in used to end the
 * send and leave the preset half-written, which is the worst place to leave it.
 *
 * So a request that could not travel waits for the relay to come back and goes
 * again, once. Repeating is safe because everything the app relays says where
 * something should END UP rather than what should happen next — see
 * `repeatable`, and the one route that is the exception.
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
   * A TAP HAS A DEADLINE (`options.deadline`; see TAP_DEADLINE_MS in
   * shared/relay-rules.mjs), and nothing here puts it on the wire after it.
   * The roll call holding it past that is the first place it can be dropped
   * — and one the roll call is STILL holding is dropped whatever the clock
   * says, as on the phone (mobile/src/lib/relay.js says why: a timer that
   * goes off a millisecond early let a tap through mid-count, addressed to
   * nobody, and computer app 1.87.4 carries that out on every computer).
   */
  if (Number.isFinite(options.deadline) && ((method !== 'GET' && counting) || pastDeadline(options.deadline, Date.now()))) {
    /* With a newer press of its control held too, that one's business: see the end of this function. */
    const over = presses.overtaken(path, options.body, options.deadline)
    throw notSentError({ late: over || linkLooksUp(), overtaken: over })
  }

  /*
   * Nothing is changed while two Macs are listening.
   *
   * A request is shouted on one channel per account, so with two Macs on it a
   * write is not sent to the wrong unit — it is carried out on both. Reads are
   * left alone deliberately: they are a coin flip rather than a hazard, and the
   * screen that has to explain this is built out of reads.
   */
  if (method !== 'GET') {
    // Asked again rather than remembered — see conflictNow.
    const clash = await conflictNow()
    if (clash) {
      const err = new Error(clash)
      err.status = 409
      err.hostConflict = true
      throw err
    }
  }

  const why = forbiddenRemotely(method, path)
  if (why) {
    const err = new Error(`You can't ${why} from your phone — do that at the computer.`)
    err.status = 403
    err.remoteBlocked = true
    throw err
  }

  /*
   * One budget for the whole request, not one per attempt.
   *
   * The retry must not be able to double the wait: a link that is flapping
   * would otherwise cost sixteen seconds a request, and the screen that has to
   * decide whether a unit is really gone asks five of them in a row. The
   * health probe passes zero, because it is the question that decides whether
   * there is anything to be patient about.
   */
  const graceUntil = Date.now() + (options.graceMs ?? RELAY_GRACE)
  /*
   * A tap's budget ends at its deadline instead. What fits inside it still
   * happens — the wait for a channel coming back, the second attempt after a
   * drop — so a connected rig and a sub-second blip go as they always did;
   * what does not fit is not sent. `trip.went` is whether it ever went on the
   * wire: a tap asked again after the unit answered it once already has.
   */
  const tap = Number.isFinite(options.deadline)
  const until = tap ? Math.min(graceUntil, options.deadline) : graceUntil
  const attempts = repeatable(path) ? 2 : 1
  const trip = { went: options.went === true }

  let last = null
  let overtaken = false
  for (let attempt = 0; attempt < attempts; attempt++) {
    /* The second attempt is checked too: it is the one that used to land late. */
    if (tap && pastDeadline(options.deadline, Date.now())) break
    try {
      await relayReady(until - Date.now(), tap)
      return await relaySend(method, path, options, trip)
    } catch (err) {
      /* Too late, or a newer press of the same control was made: no attempt after this one either. */
      if (err?.late) {
        overtaken = err.overtaken === true
        break
      }
      // Only a relay that went missing is worth repeating. A 403, a 409, a
      // unit that answered "no" — those are answers, and asking again gets
      // the same one a second slower.
      if (!err?.linkDown) throw err
      last = err
    }
  }
  /*
   * Never left: "Not sent". Went, and lost its answer: it may have landed,
   * and keeps the sentence it had. Taken over by a newer press of its
   * control, whether or not a first try went: marked `overtaken`, so Play
   * leaves the newer press's tile up and says nothing for it
   * (shared/relay-rules newestPresses).
   */
  /* And one the clock dropped while a newer press of its control was made: the same (mobile/src/lib/relay.js says why). */
  if (tap && !overtaken && !trip.went) overtaken = presses.overtaken(path, options.body, options.deadline)
  if (tap && (overtaken || !trip.went)) throw notSentError({ late: overtaken || linkLooksUp(), overtaken })
  throw last || linkDown('The connection dropped before your computer answered.')
}

/** Whether the link reads as up right now, for choosing the words a dropped tap is said in. */
const linkLooksUp = () => !!channel && isJoined(channel) && socketUp() && hostSeen

/* When each control's newest tap was pressed (shared/relay-rules newestPresses). */
const presses = newestPresses()

/*
 * Whether the socket under the channel is open, which 'joined' does not say.
 * A broadcast on a joined channel over a closed socket is posted over HTTPS
 * instead, with a ten-second timeout, and could land that late; a tap waits
 * for the socket, inside its deadline, and is never handed to that. True when
 * the client cannot say. See mobile/src/lib/relay.js for the whole of it.
 */
function socketUp() {
  try {
    const rt = session?.client?.realtime ?? client?.realtime
    return typeof rt?.isConnected === 'function' ? rt.isConnected() !== false : true
  } catch {
    return true
  }
}

/**
 * Don't send into a socket that isn't there — wait for the one coming back.
 *
 * `channel` is cleared the instant realtime-js reports the channel left the
 * joined state, so this is also the place that picks it up again when the
 * rejoin lands.
 */
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
  // making someone watch a grace period elapse over an empty session. A
  // rejoin in flight is something coming, so that waits like any other drop.
  if (!session && !connecting) throw linkDown('Not connected to your computer.')
  if (grace > 0 && (await waitForRelay(grace, 150, undefined, { socket: tap }))) return
  throw linkDown('The connection to your computer dropped.')
}

/** Too late to send: said by relaySend, read by remoteRequest, never shown. */
const tooLate = (overtaken = false) => Object.assign(linkDown('Too late to send.'), { late: true }, overtaken ? { overtaken } : {})

/** One trip: shout the question, match the answer by id, unwrap it. */
async function relaySend(method, path, options, trip = { went: false }) {
  const tap = Number.isFinite(options.deadline)
  /* The last look at the clock before a tap goes on the wire, on every attempt. */
  if (tap && pastDeadline(options.deadline, Date.now())) throw tooLate()
  /* And not after a newer press of the same control: it would land over the newer one (shared/relay-rules newestPresses). */
  if (tap && presses.overtaken(path, options.body, options.deadline)) throw tooLate(true)
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  let doubt = null
  const reply = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(id)
      // Nothing came back: whatever we last believed about the Mac being there,
      // this is better evidence.
      seen(false)
      reject(new Error('Your computer didn’t answer.'))
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
   * Addressed once there is more than one Mac to address, and never before.
   *
   * A single-host session sends exactly what it always sent, so nothing here
   * depends on the host being new until the moment two of them are listening —
   * and by then confirmTargeting has proved the hosts understand it.
   */
  /* The deadline is not in it: the computer reads these fields and nothing else, and shares no clock with this browser. */
  const ask = { id, method, path, body: options.body ?? null }
  if (hosts.length > 1 && chosen && targeted) ask.host = chosen

  const before = trip.went
  try {
    const msg = { type: 'broadcast', event: 'req', payload: ask }
    trip.went = true
    const said = tap ? await channel.send(msg, { timeout: Math.max(1, options.deadline - Date.now()) }) : await channel.send(msg)
    if (tap && said === 'error') throw new Error('the relay would not take it')
  } catch (err) {
    trip.went = before
    /*
     * A send that throws never reached the wire, and the promise above is
     * still parked in `waiting` holding a timer. Left there it would fire
     * twenty seconds later against a request nobody made — so it is settled
     * here, which stops the timer, as well as forgotten.
     */
    waiting.get(id)?.resolve?.(null)
    waiting.delete(id)
    throw linkDown(err?.message ? `Couldn’t reach your computer — ${err.message}` : 'Couldn’t reach your computer.')
  }

  /* A tap with no answer by its deadline: ask the computer whether it is there (see the phone's relay.js). */
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
