/**
 * What may travel over the relay, how long to wait for it, and what to say
 * when it can't.
 *
 * These rules used to live in `src/lib/remote.js`, which was fine while the
 * browser was the only thing at the far end of the channel. It isn't any more:
 * the phone apps in `mobile/` speak the same protocol to the same host, and a
 * second copy of an allowlist is a second copy that drifts. That has already
 * happened once inside this repo — eight routes disagreed with ForgeFX by the
 * time anyone compared them — and the two failure modes are both bad. Allowing
 * something the host refuses turns a friendly sentence into a bare status code
 * mid-song; refusing something the host allows leaves a dead panel with no
 * explanation at all.
 *
 * So one file, imported by both ends, in the shape `desktop/lib/project.mjs`
 * already proved works: zero imports, plain ESM, readable by Node in the
 * launchers, by Vite for the web bundle, and by Metro for the phone.
 */

/**
 * A verbatim port of the host's own rule — ForgeFX server/src/remote.ts,
 * remoteAllowed(). Keep the two in lockstep, character for character where the
 * shapes allow.
 *
 * ForgeFX refuses everything outside this with a 403 and it is right to: a
 * phone on a dark stage should not be able to overwrite slot 67 or move
 * firmware around. Naming the rule here lets both apps say so plainly instead
 * of surfacing a status code halfway through a song.
 */
export function hostAllows(method, p) {
  if (method === 'GET') return !p.startsWith('/cloud') && !p.startsWith('/remote') && p !== '/debug/raw'
  if (method === 'PUT')
    return (
      /^\/preset\/blocks\/\d+\/params(\/\d+)?$/.test(p) ||
      /^\/preset\/grid\/cell$/.test(p) ||
      /^\/am4\/param$/.test(p) ||
      /^\/device\/param$/.test(p) ||
      p === '/telemetry/config' ||
      /^\/store\/config\/[^/]+$/.test(p)
    )
  if (method === 'POST')
    return (
      /^\/preset\/blocks\/\d+\/(bypass|channel|type|read|readrange)$/.test(p) ||
      p === '/preset/meters' ||
      p === '/preset/select' ||
      p === '/preset/grid/cable' ||
      p === '/preset/grid/select' ||
      p === '/scene' ||
      p === '/tempo' ||
      p === '/tempo/tap' ||
      p === '/tuner' ||
      /*
       * Whether this client is drawing meter bars.
       *
       * Added to the host on the pinned fork for a phone, and then missing
       * from this mirror, so the one client it was built for was the one
       * client refused it — "POST /telemetry/meters failed" on every remote
       * session since. The supervisor starts its meter loop on the first
       * listener and a phone opening the app is one, which at the balanced
       * default is four output-meter round trips every 100ms at a unit that
       * is also making sound: the audio cutting out for as long as the app is
       * open and settling the moment it is closed. Saying "not drawing it"
       * takes that to two reads every 800ms. It touches no preset and reaches
       * no slot.
       */
      p === '/telemetry/meters' ||
      p === '/mod/bind' ||
      p === '/preset/name' ||
      p === '/scene/name' ||
      /*
       * The looper's buttons. Added to the host on the pinned fork (see
       * desktop/forgefx.lock.json): a performance control like a scene tap,
       * which moves the looper's own audio, writes no parameter and reaches
       * no slot.
       */
      p === '/preset/looper/control' ||
      /^\/am4\/(bypass|scene|preset)$/.test(p)
    )
  /*
   * DELETE /device/cache. Added to the host on the pinned fork — see
   * desktop/forgefx.lock.json — as "dropping the parameter cache", and
   * mirrored here so the two agree about what the relay carries.
   *
   * It is not that. On the pinned server a block's values are read off the
   * unit every time (gen3.ts blockParams), and this route deletes the
   * computer's saved profile of the unit (services/deviceCache.ts
   * deleteCache) — which touches no preset and reaches no slot, but is missed
   * at the next reconnect. So neither app sends it any more; the rule stays
   * only because the host still allows it.
   */
  if (method === 'DELETE') return p === '/device/cache'
  return false
}

/** Friendly phrasings for the refusals people will actually hit. */
export const REMOTE_FORBIDDEN = [
  { match: (m, p) => m === 'POST' && p === '/preset/store', why: 'save to a slot' },
  { match: (m, p) => p.startsWith('/preset/backup'), why: 'back up a preset' },
  { match: (m, p) => p.startsWith('/preset/restore'), why: 'restore a preset' },
  { match: (m, p) => p.startsWith('/backup'), why: 'back up the device' },
  { match: (m, p) => p.startsWith('/version'), why: 'load or restore a version' },
  { match: (m, p) => p.startsWith('/local'), why: 'reach the library on your computer' },
  { match: (m, p) => m !== 'GET' && p.startsWith('/ports'), why: 'change which port is used' },
  { match: (m, p) => p.startsWith('/firmware'), why: 'touch firmware' },
  { match: (m, p) => p.startsWith('/debug/raw'), why: 'send raw SysEx' }
]

/** One path, one shape, whatever the caller wrote — query strings and trailing slashes off. */
export const cleanPath = (path) => (String(path).split('?')[0] || '').replace(/\/+$/, '') || '/'

/** Why this request can't travel, or null if it can. */
export function forbiddenRemotely(method, path) {
  const clean = cleanPath(path)
  const m = method.toUpperCase()
  if (hostAllows(m, clean)) return null
  // The host will refuse it; say why in words if we have them.
  return (
    /* Read as "You can't do that from your phone — do that at the computer."
       It used to say "from a distance — it only works at the computer" here
       as well, which came out as one sentence with two endings. */
    REMOTE_FORBIDDEN.find((r) => r.match(m, clean))?.why || 'do that'
  )
}

/**
 * How long to wait for the host, by what was asked of it.
 *
 * Fifteen seconds was fine for the requests that motivated it — a scene change,
 * a parameter write, a preset select. It is not fine for a read that makes the
 * unit dump its whole preset over serial before answering. On an AM4 the block
 * list is exactly that read, and the relay was giving up on it mid-answer,
 * which the gig screen then showed as a preset with no blocks in it.
 *
 * The cost of waiting longer is only ever waiting longer. The cost of giving up
 * early is being told something false about the unit.
 */
const SLOW_READS = [
  /^\/preset\/blocks$/,
  /^\/preset\/blocks\/\d+\/(params|raw|cab)$/,
  /^\/preset\/grid$/,
  /^\/presets\/\d+(\/|$)/,
  /^\/preset\/locations$/,
  /^\/device\/cache/,
  /*
   * One footswitch. About twenty-nine questions to the unit in a row, each
   * allowed 800ms by the host before it gives up on that one (gen3.ts
   * fcReadState) — so a unit slow to answer can take longer than twenty
   * seconds and still come back right. See shared/footswitches.mjs.
   */
  /^\/fc\/state$/
]

export function timeoutFor(method, path) {
  return SLOW_READS.some((re) => re.test(cleanPath(path))) ? 45000 : 20000
}

/**
 * How long a request waits for a dropped relay before giving up on it.
 *
 * Long enough for realtime-js's own rejoin, which is a couple of seconds on a
 * phone that just came back; short enough that a Mac genuinely gone still says
 * so while someone is still looking at the screen.
 */
export const RELAY_GRACE = 8000

/*
 * A TAP HAS A DEADLINE, AND A TAP THAT CANNOT MAKE IT IS DROPPED.
 *
 * "When the link drops, Play says so right away. The tiles go dim under NOT
 * CONNECTED, and a scene tap that can't get through is dropped. Today a tap
 * can be held and land up to 8 seconds late, mid-verse." (Justin, 13 October
 * 2026.) RELAY_GRACE above is what held it: a request made while the channel
 * was down waited for it to come back and was SENT when it did, up to eight
 * seconds after the press — and the roll call's wait and a second attempt
 * could each add more. A read that lands late costs nothing. A scene that
 * lands late lands in the wrong bar of the song.
 *
 * So everything the player PRESSED — a scene, a preset, a pedal, a channel,
 * a tempo, the tuner opening, a looper button — carries a deadline from the
 * moment of the press, and nothing puts it on the wire after that. Reads keep
 * their grace and their retries; they are not bound by any of this.
 *
 * WHY A SECOND AND A HALF. The relay's own reconnect is the one retry worth
 * waiting for: realtime-js opens a new socket 1000 ms after one closes, and
 * the rejoin on it is a tenth to half a second more, so a sub-second blip is
 * back inside 1.5 s and the tap still goes, as it does today. Its next try is
 * two seconds after that, three in all — a real outage, and by then the song
 * has moved on: "a scene that lands later than that mid-verse is worse than
 * one that never lands". A connected rig never comes near it; a tap there is
 * on the wire in milliseconds.
 *
 * WHAT IT CANNOT REACH. The deadline is kept on the phone and in the browser
 * and is never sent: computer app 1.87.4 has no clock in common with the
 * phone and reads nothing but { id, method, path, body } from a request, so
 * the request is the same bytes it always was. Once a tap is on the wire it
 * can still wait at the computer behind a read on the one serial port, and a
 * socket that died quietly can still deliver it late by TCP retransmission.
 * Neither end can call those back; only a new computer app could age a
 * request on arrival, and that is not this change.
 */
export const TAP_DEADLINE_MS = 1500

/** When a tap pressed at `at` must be on the wire by. */
export const tapDeadline = (at = Date.now()) => (Number.isFinite(at) ? at : Date.now()) + TAP_DEADLINE_MS

/** Whether a deadline is set and has passed at `now`. */
export const pastDeadline = (deadline, now = Date.now()) => Number.isFinite(deadline) && now >= deadline

/*
 * HOW LONG THE LINK HAS TO BE DOWN BEFORE PLAY SAYS NOT CONNECTED.
 *
 * The link stops being 'connected' for more than one reason, and two of them
 * are not outages. One slow answer — a read the unit was too busy to answer
 * in time — and one keepalive the computer missed both turn the link to "no
 * answer" for a moment, and each is put right by asking again: /healthz never
 * touches the serial port, so a computer that is there answers it in well
 * under a second even with the unit busy. Each end now asks again the moment
 * it doubts (link.js), so that moment is short. And a channel that drops and
 * heals by itself is back in about 1.0 s of reconnect, plus the rejoin, plus
 * that one /healthz: 1.2 to 1.8 s.
 *
 * Two seconds covers all three, so a working rig is never dimmed mid-song,
 * and is short enough that a computer genuinely gone is said almost at once
 * rather than after the eight to sixteen seconds the bar took on its own.
 *
 * It is longer than the tap deadline on purpose: the band never says NOT
 * CONNECTED while a tap could still have made it. Between the two — 1.5 to
 * 2 s into an outage — a tap is dropped while the band is not up yet; the bar
 * at the top already says CONNECTING or DISCONNECTED by then, and the dropped
 * tap says why in its own words.
 */
export const LINK_DOWN_HOLD_MS = 2000

/**
 * Whether the link has been down long enough to say so: off the demo, not
 * 'connected', and away since `lostAt` (when it LEFT 'connected' — it can go
 * joining, no answer, joining in one stretch, and that is one outage) for
 * LINK_DOWN_HOLD_MS. The demo is never down: it has no far end to lose.
 */
export const linkDownAt = ({ link, lostAt = 0, demo = false } = {}, now = Date.now()) =>
  !demo && link !== 'connected' && lostAt > 0 && now - lostAt >= LINK_DOWN_HOLD_MS

/* The words. The band is drawn as it is written; the note is a sentence. */
export const NOT_CONNECTED = 'NOT CONNECTED'
export const NOT_SENT = 'Not sent — not connected'
/*
 * And the one for a tap dropped while the link still reads as up: the roll
 * call after a join still counting, the tempo before it still unanswered, a
 * Bluetooth unit still busy sending a stored preset. "Not connected" would be
 * a claim the bar disagrees with; what is true is that it would have landed
 * late, which is the reason it was dropped.
 */
export const NOT_SENT_LATE = 'Not sent — it would have landed late'

/*
 * And how long a dropped tap is said for: "a dropped tap is said on screen
 * briefly". Long enough to read at a glance from the floor, gone before the
 * next bar; NOT CONNECTED over the tiles says the lasting part for as long as
 * it is true. The phone's fault-rule.js keeps the same number (it imports
 * nothing), and a test holds the two together.
 */
export const NOT_SENT_SHOWN_MS = 3000

/**
 * A tap that never left: dropped at its deadline, or refused because the
 * link is down. Deliberately NOT `linkDown`, which is what makes the relay
 * send a request again — a dropped tap must stay dropped — and not
 * `aboutLink`, which keeps a note up until the link is back; this one is
 * said briefly (see fault-rule) and goes.
 *
 * `overtaken` is one dropped because a newer press of the same control was
 * made before it could go (see newestPresses, below). Anything that does not
 * read the flag takes it for a tap that would have landed late, which it is.
 */
export const notSentError = ({ late = false, words = null, overtaken = false } = {}) =>
  Object.assign(
    new Error(words || (late ? NOT_SENT_LATE : NOT_SENT)),
    { notSent: true, late: late === true },
    overtaken === true ? { overtaken: true } : {}
  )

/*
 * THE NEWEST PRESS OF A CONTROL WINS, WHATEVER ORDER THE WIRE TAKES THEM IN.
 *
 * Two presses of one control inside one drop of the channel — scene 2, then
 * scene 3 — each waited for it on a timer of its own, and when it came back
 * they went out in whichever order those timers fell: the older after the
 * newer, both inside their deadlines, and the unit left on scene 2 under a
 * tile that said 3. A pedal pressed on and off, the same.
 *
 * So each end's relay keeps, for every control, when its newest tap was
 * pressed, and a tap that would go after a newer press of the same control is
 * dropped instead, at the last look before the wire. Nothing lands for it,
 * and the screens neither put its tile back nor say it: the newer press is
 * the one the player meant, and it is the one on screen.
 *
 * A control is a route: the scene, the preset, the tempo, the tuner, one
 * block's bypass, one block's channel, one looper button (which travels in
 * the body). Presses of different controls are never held against each
 * other — a scene and then a pedal are both wanted. Only taps are ever
 * dropped. A write with no deadline — closing the tuner, a looper button's
 * release, a save — counts as a press of its route made as it is handed to
 * the relay, and is never dropped itself: so the tuner opened in a drop and
 * closed a moment later is not opened after the close went, leaving the unit
 * muted on its tuner screen under a Play that shows it closed. A release
 * goes once its press has been answered, so it never takes the press over.
 * The tap tempo sends one number at a time already, so it never has two
 * waiting. And a working link never meets any of this: a tap there is on the
 * wire before the next can be pressed. (Two held by the roll call after a
 * join are let go together, and there too the older is the one dropped. And
 * a tap the clock drops while a newer press of its control is still waiting
 * is that press's business the same way: `overtaken`.)
 *
 * A tap's press is its deadline less TAP_DEADLINE_MS, so a watch tap the
 * phone sends a moment after the wrist is as old as the wrist, not as the
 * moment it reached the relay. Two presses at the same instant both go.
 */
export function pressRoute(path, body) {
  const clean = String(path || '').split('?')[0]
  if (clean !== '/preset/looper/control') return clean
  try {
    const { eid, action } = JSON.parse(body)
    return `${clean} ${eid} ${action}`
  } catch {
    return clean
  }
}

export function newestPresses() {
  const newest = new Map()
  const pressedAt = (deadline) => deadline - TAP_DEADLINE_MS
  return {
    /** A tap handed to the relay: written down as the newest press of its control, unless one newer is already. */
    made(path, body, deadline) {
      if (!Number.isFinite(deadline)) return
      const route = pressRoute(path, body)
      if (!(newest.get(route) >= pressedAt(deadline))) newest.set(route, pressedAt(deadline))
    },
    /** Whether a newer press of this tap's control has been made since it was. */
    overtaken(path, body, deadline) {
      return Number.isFinite(deadline) && newest.get(pressRoute(path, body)) > pressedAt(deadline)
    }
  }
}

/*
 * WHAT A TAP THAT NEVER LANDED PUTS BACK: WHAT THE UNIT IS ON.
 *
 * A tap goes on screen at once and keeps what was there before it, to put
 * back if it does not land. Alone, that is what the unit is on. But two
 * presses of one control in one drop — scene 2, then scene 3 — and the
 * second kept the first's tile, which never reached the unit either: both
 * dropped, the screen went back to scene 2 over a unit on scene 1. Two Nexts,
 * the same: the preset passed on the way, never loaded, under the scene taps
 * after it.
 *
 * So each end keeps, for every control, its presses still in the air, and
 * one that fails puts back what was on screen before the oldest of them the
 * unit has not taken: the last one it did take, or what was there before
 * them all. Only the newest of a control puts anything back — an older one
 * failing while a newer is in the air leaves the newer's tile alone — and
 * presses of different controls never put back each other's: a pedal
 * dropped puts back that pedal, not the whole row as it was when it was
 * pressed, over a second pedal that landed after it.
 */
export function pressesInTheAir() {
  const newest = new Map()
  return {
    /** A press of `control` going on screen; `before` is what was there. */
    press(control, before) {
      const press = { control, before, prev: newest.get(control) || null, landed: false }
      newest.set(control, press)
      return press
    },
    /** It reached the unit: a press after it that fails puts back what this one left on screen. */
    landed(press) {
      press.landed = true
      press.prev = null
      if (newest.get(press.control) === press) newest.delete(press.control)
    },
    /**
     * It did not, or may not have: the press whose `before` the unit is on —
     * this one, or an older one of its control the unit never took either —
     * or null when a newer press of the control is in the air and owns the
     * screen.
     */
    failed(press) {
      if (newest.get(press.control) !== press) return null
      newest.delete(press.control)
      let from = press
      while (from.prev && !from.prev.landed) from = from.prev
      return from
    }
  }
}

/*
 * A SETLIST SONG'S SCENE AND TEMPO, WHEN THE LINK WAS AWAY WHILE ITS PRESET
 * LOADED.
 *
 * Next in a setlist is one press for the whole change between songs: the
 * preset, then — once the unit has loaded it and been read — the song's own
 * scene and tempo. Those two wait for the preset's reads on purpose, so they
 * land on the song just loaded and never on the last one, and so they cannot
 * be held to Next's own second and a half: on a working link they go one to
 * three seconds after it, and each gets a deadline of its own as it goes.
 *
 * But each of those reads keeps the relay's grace (RELAY_GRACE, above): a
 * channel that dropped just after the select had every one of them wait for
 * it, and when it came back the song's scene went out eight seconds after
 * Next, with the song under way — "a scene that lands later than that
 * mid-verse is worse than one that never lands".
 *
 * So they are dropped, and said, when the link was away from 'connected' for
 * more than a tap's own deadline, in all, between Next and the moment they
 * would go. That is how much later than usual they would land, near enough:
 * the reads wait while the link is away and go on as soon as it is back. The
 * same allowance a tap has, for the same reason — a blip that heals inside it
 * costs nothing, as it costs a tap nothing. And a rig whose link stayed up is
 * never touched, however long its own reads take: an AM4 over Bluetooth reads
 * for longer than this, and that is the unit, not the link.
 */
export const songWouldLandLate = (awayMs) => Number.isFinite(awayMs) && awayMs > TAP_DEADLINE_MS

/** What is said for it: which halves of the song were not sent, and why, in plain words. */
export const songNotSent = ({ scene = false, tempo = false } = {}) =>
  `Not sent — the song’s ${[scene && 'scene', tempo && 'tempo'].filter(Boolean).join(' and ') || 'setup'} would have landed late`

/**
 * Requests that must not be sent twice.
 *
 * Everything else the app relays is a statement of where something should end
 * up — this parameter is 4.5, this block is on channel B, load preset 12 — and
 * arriving twice leaves the unit exactly where arriving once did. Tap tempo is
 * the one that is not: it is a beat, and a resend is a beat that never
 * happened. So the retry covers the whole relay except this.
 */
const NOT_REPEATABLE = [
  /^\/tempo\/tap$/,
  /*
   * A looper button is a press, and a press sent twice is two presses: Record
   * on, off, on again, or a second Undo taking away a layer nobody asked to
   * lose. Same as a tap of the tempo.
   */
  /^\/preset\/looper\/control$/
]

export const repeatable = (path) => !NOT_REPEATABLE.some((re) => re.test(cleanPath(path)))

/**
 * Why this account's requests cannot be trusted right now, or null.
 *
 * Always null: this app no longer refuses to drive a unit because more than
 * one host answered.
 *
 * The detection was never wrong. A host is anything signed into the account
 * that answers a broadcast within the census window — it does not need a unit
 * attached, or to be the Mac in front of you. So an old install, a stray tab
 * left open, or a machine signed in months ago answers exactly like the Mac
 * doing the work, and the banner was right that two things replied.
 *
 * It was the consequence that was wrong. What it protected against is a write
 * landing on two units at once, which needs two hosts each with an amp plugged
 * into it. Answering a census is not that, and the two were treated as the
 * same thing — so a setup with one amp was told to choose between two Macs,
 * repeatedly, with no choice that settled it and a stage in front of it.
 *
 * Removed deliberately and by the owner's decision, for a rig with one unit.
 * The cost is named rather than hidden: with two hosts each holding an amp, a
 * write now reaches both and nothing here will say so. Host addressing is
 * untouched and still narrows a request to the chosen Mac where the hosts are
 * new enough to honour it — this only stops the refusal.
 *
 * The signature is kept so callers and the host-picker still work unchanged.
 */
export function hostConflict() {
  return null
}

/*
 * WHERE THE CONFIRMATION EMAIL GOES. A customer signed up, both confirmation
 * emails were delivered to his Gmail, and he never saw either: most likely
 * filed under Spam or Promotions. So every place that says "confirm it from
 * the email" says where else to look, in the same words on both ends.
 */
export const NOT_IN_INBOX = 'If it isn’t in your inbox, look in Spam, Junk or Promotions for an email from Fractal Remote.'

/** Sign-in refused because the email was never confirmed: the one a "send it again" button answers. */
export const notConfirmed = (error) =>
  error?.code === 'email_not_confirmed' || /not confirmed/i.test(String(error?.message || ''))

/** What both ends say once the confirmation email has gone again. */
export const sentAgain = (email) => `A new confirmation email is on its way to ${email}. ${NOT_IN_INBOX}`

/**
 * Supabase's auth errors are terse and one of them is actively misleading.
 *
 * An unconfirmed account fails with wording that sounds like a wrong password,
 * which sends you off changing credentials that were right all along.
 */
export function explainAuth(message) {
  const m = (message || '').toLowerCase()
  if (m.includes('not confirmed') || m.includes('email not confirmed')) {
    return `That email hasn’t been confirmed yet. Look for the confirmation email, then try again. ${NOT_IN_INBOX}`
  }
  if (m.includes('invalid login')) {
    return 'Email or password didn’t match.'
  }
  /*
   * AND THE ONE THAT SAID NOTHING AT ALL. The account service ran out of its
   * disk allowance and stopped answering; sign-in sat there for twenty seconds
   * three times over and then said "server error", which is true and useless:
   *
   *   sign in — 19874ms
   *   sign in — 19661ms
   *   sign in — 19735ms
   *
   * Nothing about that is the password, and nothing the person does will help,
   * so the message has to say so and point at the one thing that still works.
   */
  if (m.includes('abort') || m.includes('timed out') || m.includes('timeout')) {
    return 'The account service didn’t answer in time. It may be overloaded — wait a few minutes and try again. The demo works without it.'
  }
  if (m.includes('network request failed') || m.includes('failed to fetch') || m.includes('load failed')) {
    return 'Couldn’t reach the account service. Check your internet connection and try again.'
  }
  if (m.includes('server error') || m.includes('503') || m.includes('504') || m.includes('unexpected_failure')) {
    return 'The account service is having trouble at its end. Try again in a few minutes. The demo works without it.'
  }
  return message
}

/**
 * Turn the answers to a roll call into names, one per Mac that replied.
 *
 * An answer that cannot be read still counts. The count is the part that
 * matters — it is what decides whether anything may be written — and a Mac that
 * answered in a shape we did not expect is still a Mac that would carry out the
 * next write. Losing it from the list would turn a fault back into silence.
 */
export async function hostNamesFrom(answers, read) {
  const named = []
  for (const answer of answers) {
    let name = null
    try {
      const body = JSON.parse(await read(answer))
      name = body?.data?.name || body?.name || null
    } catch {
      // Unreadable, but present. See above.
    }
    named.push(typeof name === 'string' && name.trim() ? name.trim() : 'a computer')
  }
  return named
}

/**
 * WHICH UNIT EACH COMPUTER HAS, from one addressed /healthz each.
 *
 * "Instead of which computer, have it say which unit, and list the units
 * online." Two computers on one account, an AM4 on one and an FM3 on the
 * other: the person choosing is choosing a unit, and the computer it hangs
 * off is the detail. Each computer's /device says which unit it detected,
 * and its /healthz whether one is plugged in at all.
 *
 * Only an answer that came back ALONE can be tied to the computer it was
 * addressed to. A computer too old to honour addressing answers for itself
 * whatever name was asked, so two answers mean nothing here can say whose is
 * whose — and a guess would put the FM3's name on the AM4's button. That is
 * null, and the button says the computer instead.
 */
export async function unitFrom(answers, read, deviceAnswers = []) {
  if (!Array.isArray(answers) || answers.length !== 1) return null
  const body = async (list) => {
    if (!Array.isArray(list) || list.length !== 1) return null
    try {
      const b = JSON.parse(await read(list[0]))
      return b?.data && typeof b.data === 'object' ? b.data : b
    } catch {
      return null
    }
  }
  const health = await body(answers)
  /*
   * THE MODEL FROM /device, NOT /healthz, when the computer says it.
   *
   * "It's just showing both listed as FM3." /healthz names the profile the
   * server started with — the gen-3 one, FM3 — and an AM4 is driven by a
   * driver of its own without that ever changing, so a computer with an AM4
   * on it answered FM3 there. /device names the unit it actually detected
   * (registryCore deviceInfo: "the provisional gen-3 profile can't identify
   * an AM4"). /healthz still says whether one is plugged in at all.
   */
  const device = await body(deviceAnswers)
  const detected = typeof device?.model === 'string' ? device.model.trim() : ''
  const named = typeof health?.device === 'string' ? health.device.trim() : ''
  const model = detected || named
  if (!health || !model) return null
  return { model, plugged: health.ok !== false }
}

/**
 * The buttons under Which unit, one per computer that answered.
 *
 * The unit leads and the computer follows: "FM3", then "on Justin's MacBook
 * Pro". A computer with nothing plugged in still gets a button — it answered,
 * and it is the one somebody plugs a unit into next — but says so, and goes
 * after the ones with a unit on them.
 */
export function unitChoices(hostNames = [], units = {}, chosen = null) {
  const rows = hostNames.map((name, i) => {
    const unit = units?.[name] || null
    return {
      name,
      key: `${name}-${i}`,
      label: unit ? (unit.plugged ? unit.model : 'No unit plugged in') : name,
      detail: unit ? `on ${name}` : 'Unit not known. Update the computer app on it to see which.',
      plugged: Boolean(unit?.plugged),
      on: name === chosen
    }
  })
  return [...rows.filter((r) => r.plugged), ...rows.filter((r) => !r.plugged)]
}

/**
 * Which computer to drive when more than one answers and nobody has said.
 *
 * "unit: AM4 … POST /preset/select failed — Preset location index must be
 * integer 0..103, got 495." A browser that had never been told which unit to
 * drive addressed nothing, so every request went to BOTH computers: the FM3's
 * answered the reads first (preset 494 of 512) and the AM4's refused the
 * writes those reads led to — and the ones it did not refuse landed on both
 * units. Not choosing is the dangerous answer, so one is chosen: the first
 * computer with a unit plugged in, else the first that answered. Not
 * remembered — a choice somebody makes under Which unit is, and outranks it.
 */
export function firstUnitHost(hostNames = [], units = {}) {
  const once = hostNames.filter((name, i) => hostNames.indexOf(name) === i && hostNames.lastIndexOf(name) === i)
  return once.find((name) => units?.[name]?.plugged) || once[0] || null
}
