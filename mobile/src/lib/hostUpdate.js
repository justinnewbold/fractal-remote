/*
 * THE COMPUTER APP'S OWN UPDATE, AS THE PHONE SAYS IT, AND UPDATE NOW.
 *
 * "I will update the pis but we need to figure out how to have them auto
 * update" (Justin, 17 November 2026). From computer app 1.92.0 a Raspberry
 * Pi puts in its own updates once nobody has used it for half an hour, says
 * how its update is going in the document it already writes for its name
 * (host.name, an `update` note: desktop/lib/updates.mjs updateNote), and acts
 * on a phone's request written into its store (HOST_UPDATE_ID there, judged
 * by its updateAsk). This file is the phone's half of that, and only rules
 * and words: no React, no wire, so the tests run every function whole and
 * hand the computer's own rule what these build.
 *
 * HIS ACCOUNT FIRST, EVERY ACCOUNT SINCE 2.0.0 (features
 * COMPUTER_UPDATE_FOR_EVERYONE, lib/hostUpdateHere useComputerUpdate; on
 * since 17 November 2026). NOTHING HERE HAS RUN AGAINST A REAL PI YET: how
 * long the restart takes, and whether the unit keeps sounding through it,
 * are not known, so no sentence here says either.
 *
 * WHOSE COMPUTER, FOR THE DAY'S WAIT (`owner`). A computer puts a new
 * version in by itself only once it has been out for a day, except one
 * signed in to his own account, which skips the day (desktop/lib/updates.mjs
 * OWNER_ACCOUNTS, autostart's `ownerBox`). The computer a device drives is
 * signed in to the device's own account (it acts only for that one), so the
 * device's sign-in says which: `owner` is his (lib/admin isAdmin), and the
 * ready line and the give-up line leave the day out for him and say it for
 * everybody else.
 *
 * Phone-only: not in the computer app, so changing it makes no computer
 * release. NOT mobile/src/lib/computer-update.js, which is generated from
 * shared/computer-update.mjs (the Updating the computer app page) and never
 * edited by hand.
 */
import { isOlder } from './versions.js'

/** The store document a phone writes to ask the computer to put its update in now: desktop/lib/updates.mjs HOST_UPDATE_ID, held equal by a test. */
export const HOST_UPDATE_ID = 'host.update'
/** Where that document is written, through the relay (allowed by `PUT /store/config/[^/]+`). */
export const HOST_UPDATE_PATH = `/store/config/${HOST_UPDATE_ID}`

/** The first computer app that says how its update is going and answers Update now (the computer half's release). */
export const UPDATE_SAYS_FROM = '1.92.0'
/** The first computer app on which a Raspberry Pi with a window puts a downloaded update in when it is switched on. */
export const OFF_AND_ON_FROM = '1.90.86'

/** How long after this device last sent the computer something the request still waits: a save, a capture or a change just sent is let land. */
export const SENT_QUIET_MS = 10 * 1000
/** How often the computer's document is read again while a request is out (the computer looks for one every ten seconds). */
export const LOOK_EVERY_MS = 15 * 1000
/** With no answer by then, and the update still offered, the request is written once more: a computer that had only just started learns the first one without acting on it. */
export const RETRY_AFTER_MS = 30 * 1000
/** And only before this long after the tap: a look the device held back (the app in the background) never writes long after the tap, under a request nobody is waiting on. */
export const RETRY_UNTIL_MS = 2 * RETRY_AFTER_MS
/** And no more than that: never a third write for one tap. */
export const MOST_WRITES = 2
/** How long the phone waits for the computer to come back on the new version before it says it did not. */
export const GIVE_UP_MS = 3 * 60 * 1000

/** Whether an account has the computer's update on Phone & computer: his (`admin`, the sign-in kept on the device), or everyone once the switch says so. */
export const computerUpdateOn = ({ admin = false, everyone = false } = {}) => everyone === true || admin === true

const KINDS = ['checking', 'downloading', 'ready', 'current', 'building', 'trouble', 'stuck', 'misplaced']
const GOES_IN = ['idle', 'password', 'quit']

/**
 * The computer's `update` note as read, kept to what it can say
 * (updateNote's keys and no others), or null. A shape it does not know is
 * nothing to say, never a guess.
 */
export function noteOf(raw) {
  if (!raw || typeof raw !== 'object' || !KINDS.includes(raw.kind)) return null
  const note = { kind: raw.kind }
  if (typeof raw.version === 'string' && raw.version.trim()) note.version = raw.version.trim().slice(0, 20)
  if (note.kind === 'downloading' && Number.isFinite(raw.percent)) note.percent = Math.max(0, Math.min(100, Math.round(raw.percent)))
  note.goesIn = GOES_IN.includes(raw.goesIn) ? raw.goesIn : 'quit'
  note.canNow = raw.canNow === true && note.kind === 'ready' && Boolean(note.version)
  if (raw.asked && typeof raw.asked === 'object' && Number.isFinite(raw.asked.at) && typeof raw.asked.result === 'string') {
    note.asked = { at: raw.asked.at, result: raw.asked.result.slice(0, 20) }
  }
  return note
}

/**
 * What each computer said in the roll call, from the answers already
 * collected (relay.js takeCensus), with no request of its own: one
 * { name, version, os, update } per answer, in the order hostNamesFrom gives
 * its names, and under the same names (an answer that cannot be read is
 * 'a computer', shared relay-rules NO_NAME). hostNamesFrom is left as it is.
 */
export async function hostFactsFrom(answers = [], read) {
  const facts = []
  for (const answer of answers || []) {
    let body = null
    try {
      body = JSON.parse(await read(answer))
    } catch {
      // Unreadable, but present: a name nobody has, and nothing else.
    }
    const data = body?.data && typeof body.data === 'object' ? body.data : body
    const name = data?.name || body?.name || null
    facts.push({
      name: typeof name === 'string' && name.trim() ? name.trim() : 'a computer',
      version: typeof data?.version === 'string' && data.version ? data.version : data?.version ? String(data.version) : null,
      os: data?.os ? String(data.os).slice(0, 40) : null,
      update: noteOf(data?.update)
    })
  }
  return facts
}

/** Whether more than one computer in the roll call answers to `name` (names, or facts with a name). A write reaches both of them (relay-rules hostConflict never refuses one), so nothing is asked of either. */
export function sameNameTwice(list = [], name) {
  if (!name) return false
  return (list || []).filter((one) => (typeof one === 'string' ? one : one?.name) === name).length > 1
}

/** Whether this device sent the computer something just now: a request still out, or one finished in the last SENT_QUIET_MS (relay.js sendingHere). */
export const busySending = ({ out = 0, at = 0 } = {}, now = Date.now()) => out > 0 || (at > 0 && now - at < SENT_QUIET_MS)

/**
 * Whether Update now may be written, and if not, why:
 *
 *   null        — it may
 *   'off'       — the switch is off for this account
 *   'not-ready' — the computer does not offer it now (`canNow`)
 *   'link'      — not driving a computer just now (Bluetooth, the demo, or the link down)
 *   'account'   — nobody signed in on this device to say whose computer it is
 *   'clash'     — two computers answer to the driven one's name
 *   'busy'      — this device is sending the computer something, or just was
 */
export function whyNotAsk({ update = null, switchOn = false, clash = false, busyHere = false, name = null, account = null, linked = false } = {}) {
  if (switchOn !== true) return 'off'
  const note = noteOf(update)
  if (!note?.canNow) return 'not-ready'
  if (linked !== true || !name) return 'link'
  if (typeof account !== 'string' || !account) return 'account'
  if (clash) return 'clash'
  if (busyHere) return 'busy'
  return null
}

/** Whether Update now may be written now: whyNotAsk says nothing against it. */
export const mayAskUpdate = (facts = {}) => whyNotAsk(facts) === null

/**
 * The request, exactly as the computer as built reads it (updateAsk): the
 * computer's own name as it writes it in host.name, the version it has
 * ready, the signed-in account's id (the computer acts only for the account
 * it is signed in to), and a number of this device's own (`at`), which the
 * computer gives back with its answer. Nothing else.
 */
export function updateRequest({ name, version, account, at }) {
  return { data: { host: String(name), version: String(version), account: String(account), at }, origin: 'fractal' }
}

/* ------------------------------------------------------------------ WORDS */

const isPi = (os) => /^raspberry pi/i.test(String(os || '').trim())
const v = (version) => (version ? `version ${version}` : 'a new version')
const V = (version) => (version ? `Version ${version}` : 'A new version')

/** The confirm before Update now. No time and nothing about the sound: neither has been seen on a real Pi. */
export const confirmWords = (name) => ({
  title: `Update ${name} now?`,
  body: `The remote stops while ${name} restarts, then comes back by itself. Don't save or send a capture until it's back.`,
  yes: 'Update now',
  no: 'Not now'
})

/** Why Update now was not written, in words, for the reasons a person can do something about. */
export function notAskedWords(why, name) {
  if (why === 'clash') return `Two computers are called ${name}. Rename one to update it.`
  if (why === 'busy') return `Something is still being sent to ${name}. Try again in a moment.`
  if (why === 'account') return `Sign in to update ${name} from here.`
  if (why === 'not-ready') return `${name} has no update ready to put in now.`
  return null
}

/** The computer's answer to a request (`asked.result`), in words. */
export function answerWords(result, { name, version } = {}) {
  switch (result) {
    case 'installing':
      return `Updating ${name}… The remote comes back by itself.`
    case 'screen':
      return `Somebody is using the screen on ${name}. Try again in a couple of minutes.`
    case 'busy':
      return `Somebody is using ${name} right now. Try again in a few minutes.`
    case 'not-ready':
      return `${name} has no update ready to put in now.`
    case 'stuck':
      return `${V(version)} didn't go in last time, so ${name} won't put it in from here. Use Restart to update on its own screen.`
    case 'pulled':
      return `${V(version)} was taken back, so ${name} won't put it in by itself.`
    case 'attended':
      return `${name} puts its update in when the computer app is quit and opened again.`
    case 'password':
      return `${name} needs its password to update, so put it in at the computer.`
    case 'other-account':
      return `${name} is signed in to another account, so it can't be updated from here.`
    default:
      return `${name} didn't update.`
  }
}

/**
 * The line under the computer's card on Phone & computer, and whether Update
 * now is offered:
 *
 *   { line, button, link, tone }
 *
 * `line` null for nothing to add (the card already names the computer and its
 * version). `link` is 'updating' where the line opens the Updating the
 * computer app page (shared/computer-update.mjs UPDATE_STEPS). `sending` is
 * where a tap made here has got to ('asking' or 'installing'); `result` how
 * it ended (askUpdate's answer). Both say more than the computer's note, so
 * they come first.
 */
export function computerUpdateWords({ name, version = null, os = null, update = null, sending = null, result = null, owner = false } = {}) {
  /* When a ready version goes in by itself: a customer's computer waits for it to have been out a day, his own does not (`owner`, above). */
  const goesIn = owner === true ? `once nobody has used ${name} for half an hour` : `once it has been out for a day and nobody has used ${name} for half an hour`
  const none = { line: null, button: false, link: null, tone: 'hint' }
  if (!name) return none
  if (result) {
    /* Said only while it still describes the computer (runSays); Update now stays where the computer still offers it, so "try again" can be done. A run that 'left' says nothing. */
    const again = noteOf(update)?.canNow === true
    /* Back on the new version and already offering a newer one: the computer's own words and button, as if no run had ended. */
    const newer = noteOf(update)
    const offersNewer = newer?.kind === 'ready' && isOlder(result.version, newer.version) === true
    if (result.state === 'updated' && !offersNewer) return { ...none, line: `${name} is on ${v(result.version)}.`, tone: 'hint' }
    if (result.state === 'refused') return { ...none, line: answerWords(result.result, { name, version: result.asked }), tone: 'warn', button: again }
    if (result.state === 'gave-up') return { ...none, line: `${name} didn't update. It stays on ${v(result.version)}. The new version goes in by itself ${goesIn}.`, tone: 'warn', button: again }
    if (result.state === 'no-take') return { ...none, line: `${name} didn't update. It stays on ${v(result.version)}.`, tone: 'warn', button: again }
    if (result.state === 'not-sent') return { ...none, line: notAskedWords(result.why, name) || `${name} wasn't asked. Try again.`, tone: 'warn', button: again }
  }
  if (sending === 'installing') return { ...none, line: answerWords('installing', { name }) }
  if (sending === 'asking') return { ...none, line: `Asking ${name} to update…` }
  const note = noteOf(update)
  if (!note) {
    if (!version) return none
    /* A computer new enough to say, saying nothing: no update news yet (the computer's updateNote is null before its first look). */
    if (isOlder(version, UPDATE_SAYS_FROM) === false) return none
    if (isPi(os) && isOlder(version, OFF_AND_ON_FROM) === false) {
      return { ...none, line: `v${version}, an older computer app. Switch ${name} off and on and give it five minutes. If it's still on this version, do it once more.`, link: 'updating' }
    }
    return { ...none, line: `v${version}, an older computer app.`, link: 'updating' }
  }
  switch (note.kind) {
    case 'checking':
      return { ...none, line: 'Looking for updates…' }
    case 'downloading':
      return { ...none, line: `${note.version ? `Downloading version ${note.version}…` : 'Downloading an update…'}${Number.isFinite(note.percent) ? ` ${note.percent}%` : ''}` }
    case 'current':
      return { ...none, line: 'Up to date' }
    case 'building':
      return { ...none, line: `${V(note.version)} is still being built` }
    case 'trouble':
      return { ...none, line: "Couldn't look for updates. It tries again by itself." }
    case 'stuck':
      return { ...none, line: `${V(note.version)} didn't go in. Get it from fractal.newbold.cloud/downloads.`, tone: 'warn' }
    case 'misplaced':
      return { ...none, line: `Move Fractal Remote to Applications on ${name} to get updates.`, link: 'updating', tone: 'warn' }
    case 'ready':
      /* A customer's computer: the computer's own window's words (src/lib/desktop.js), the day's wait in them. His own: the same, with no day (`owner`). */
      if (note.canNow) return { ...none, line: `${V(note.version)} is ready. It goes in by itself ${goesIn}.`, button: true }
      if (note.goesIn === 'idle') return { ...none, line: `${V(note.version)} is ready, but it didn't go in last time. Put it in at ${name}: Restart to update on its own screen.`, tone: 'warn' }
      if (note.goesIn === 'password') return { ...none, line: `${V(note.version)} is ready. It needs the computer's password, so put it in at ${name}.` }
      return { ...none, line: `${V(note.version)} is ready. It goes in the next time the computer app is quit and opened again.` }
    default:
      return none
  }
}

/**
 * The line under a computer's card in Which unit, read-only: its version and
 * how its update is going, and, for one not driven that has Update now on
 * offer, how to get to it (a write reaches only the computer driven).
 * Null for a name two computers answer to (whose is whose cannot be said).
 */
export function hostCardLine(fact, { driven = false, twice = false, owner = false } = {}) {
  if (!fact?.name || twice) return null
  const said = computerUpdateWords({ name: fact.name, version: fact.version, os: fact.os, update: fact.update, owner })
  const head = fact.version ? `v${fact.version}` : null
  /* The older computer's line already starts with its version. */
  const parts = said.line && head && said.line.startsWith(`${head},`) ? [said.line] : [head, said.line]
  if (said.button && !driven) parts.push('Pick it to update it.')
  const line = parts.filter(Boolean).join(' · ')
  return line || null
}

/* ------------------------------------------------------------------ THE LOG */

/** What the computer said about its update, as one log line (written when it changes). */
export function noteSaid(name, raw) {
  const note = noteOf(raw)
  if (!note) return `${name || 'the computer'} says nothing about its update`
  const bits = [note.kind, note.version || null, note.kind === 'downloading' && Number.isFinite(note.percent) ? `${note.percent}%` : null].filter(Boolean)
  const how = note.kind === 'ready' ? `, goes in: ${note.goesIn}${note.canNow ? ', Update now offered' : ''}` : ''
  const asked = note.asked ? `, answered request ${note.asked.at}: ${note.asked.result}` : ''
  return `${name || 'the computer'} says its update: ${bits.join(' ')}${how}${asked}`
}

/** What changes the log line: the note's own words, not a percentage creeping up. */
export const noteKey = (raw) => {
  const note = noteOf(raw)
  if (!note) return null
  return JSON.stringify([note.kind, note.version ?? null, note.goesIn, note.canNow, note.asked?.at ?? null, note.asked?.result ?? null])
}

/* ------------------------------------------------------------ STILL SO? */

/** What the card was showing when something was said: the computer driven, its version and its note (noteKey). */
export const factsAt = (s) => ({ name: s?.macName || null, version: s?.hostVersion ?? null, note: noteKey(s?.hostUpdate) })

/** Whether something said against `at` (factsAt) still describes the computer `s` drives: the same computer, the same version, the same note. */
export const stillSo = (at, s) => Boolean(at?.name) && at.name === (s?.macName || null) && at.version === (s?.hostVersion ?? null) && at.note === noteKey(s?.hostUpdate)

/**
 * What a tap's run ({ name, phase, result, at }) adds to the card of the
 * computer `s` drives: where it has got to, and how it ended, only while
 * that still describes the computer (stillSo). Nothing on another
 * computer's card.
 */
export function runSays(run, s) {
  const none = { sending: null, result: null }
  if (!run?.name || !s?.macName || run.name !== s.macName) return none
  if (run.phase) return { sending: run.phase, result: null }
  return run.result && stillSo(run.at, s) ? { sending: null, result: run.result } : none
}

/* ------------------------------------------------------------------ THE ASK */

/**
 * One tap's Update now, start to finish: written, the computer's document
 * read again every LOOK_EVERY_MS, written once more at RETRY_AFTER_MS when no
 * answer to either has come and the update is still offered, and given up at
 * GIVE_UP_MS. Never a third write, and never a write `mayWrite()` refuses at
 * that moment (a save or capture going out, two computers by that name, the
 * switch gone off).
 *
 * Everything it touches is handed in: `write(body)` sends the request,
 * `readNote()` reads host.name ({ version, update } or undefined when it
 * could not be read, as while the computer restarts), `now`, `sleep`, `log`
 * and `onState(phase)` ('asking' or 'installing').
 *
 * Answers, by `state`:
 *   'updated'  — the computer came back on a newer version ({ version })
 *   'refused'  — it answered no ({ result, asked: the version asked for })
 *   'no-take'  — it said it was installing and is still on the old version
 *   'gave-up'  — no answer to either request ({ version: the old one })
 *   'left'     — the last read was another computer's (another one driven): nothing is known about this one, so nothing is said
 *   'not-sent' — nothing was written ({ why })
 *
 * A read whose name is not `name` is no read: the relay reads whichever
 * computer is driven now, and another one's version is never this one's.
 * The second write goes only between RETRY_AFTER_MS and RETRY_UNTIL_MS after
 * the tap, so never once GIVE_UP_MS has passed either.
 */
export async function askUpdate({ name, version, from = null, account, write, readNote, mayWrite = () => null, now = Date.now, sleep, log = () => {}, onState = () => {} }) {
  const ats = []
  const send = async (attempt) => {
    const why = mayWrite()
    if (why) {
      log(`Update now: not written to ${name}${attempt > 1 ? ' again' : ''} (${why})`)
      return why
    }
    const at = now()
    ats.push(at)
    try {
      await write(updateRequest({ name, version, account, at }))
      log(`Update now: asked ${name} to put in version ${version} (request ${at}, ${attempt} of ${MOST_WRITES})`)
      return null
    } catch (err) {
      log(`Update now: could not write the request to ${name} — ${err?.message || String(err)}`)
      return 'write'
    }
  }
  const first = await send(1)
  if (first) return { state: 'not-sent', why: first }
  onState('asking')
  /* The tap: when the first request was written. */
  const began = ats[0]
  let installing = false
  let elsewhere = false
  while (now() - began < GIVE_UP_MS) {
    await sleep(Math.min(LOOK_EVERY_MS, Math.max(0, GIVE_UP_MS - (now() - began))))
    let note
    try {
      note = await readNote()
    } catch {
      note = undefined
    }
    if (!note) continue
    if (note.name !== name) {
      elsewhere = true
      continue
    }
    elsewhere = false
    if (note.version && from && isOlder(from, note.version) === true) {
      log(`Update now: ${name} is on version ${note.version} (was ${from})`)
      return { state: 'updated', version: note.version }
    }
    const said = noteOf(note.update)
    if (said?.asked && ats.includes(said.asked.at)) {
      if (said.asked.result === 'installing') {
        if (!installing) log(`Update now: ${name} answered: installing`)
        installing = true
        onState('installing')
      } else {
        log(`Update now: ${name} answered: not now (${said.asked.result})`)
        return { state: 'refused', result: said.asked.result, asked: version }
      }
    }
    /* Once more, and only once: no answer to either, the update still offered, the same version, and still close to the tap. A write the rules held back is tried at the next look. */
    const since = now() - began
    if (!installing && ats.length < MOST_WRITES && since >= RETRY_AFTER_MS && since < RETRY_UNTIL_MS && said?.canNow && said.version === String(version)) await send(2)
  }
  if (elsewhere) {
    log(`Update now: stopped waiting for ${name} — another computer was being driven, so whether ${name} updated is not known`)
    return { state: 'left' }
  }
  if (installing) {
    log(`Update now: ${name} said it was installing, and is still on version ${from || 'it had'} after ${GIVE_UP_MS / 60000} minutes`)
    return { state: 'no-take', version: from }
  }
  log(`Update now: gave up — ${name} did not answer in ${GIVE_UP_MS / 60000} minutes, and is still on version ${from || 'it had'}`)
  return { state: 'gave-up', version: from }
}
