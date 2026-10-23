/**
 * Keeping the phone joined to the Mac, without anyone having to think about it.
 *
 * A phone is not a browser tab. It gets locked, put in a pocket, carried out of
 * range, handed from wifi to cellular and back, and backgrounded for the length
 * of a song. Every one of those closes the socket, and none of them mean the
 * player wanted to disconnect.
 *
 * So the link is a loop rather than a button: join, prove the Mac answers, and
 * keep proving it. Backs off while nothing answers so a phone in a bag is not
 * hammering a sleeping Mac, and never goes quiet for good — a Mac waking up is
 * found within half a minute of it doing so.
 *
 * The same three constants as the web app's link.js, because they were chosen
 * against the same failure: a green lamp that is lying is worse than a red one.
 */
import { AppState } from 'react-native'
import { isDemo } from './demo'
import { logDebug } from './debugLog'
import { bluetoothOn } from './bleSwitch'
import { pokeBluetooth, startBluetoothLink, stopBluetoothLink } from './bleLink'
import { setLinkAway, setLinkDown } from './tapGate'
import { LINK_DOWN_HOLD_MS, linkDownAt, METERS_OFF_PATH, metersOffBody, metersRefused, timeToQuietMeters } from './relay-rules'

import {
  censusHosts,
  hostConflict,
  hostResponds,
  lastAnswerAt,
  remoteActive,
  remoteChosenHost,
  remoteConnect,
  remoteDisconnect,
  remoteCountDue,
  remoteCountOwed,
  remoteMayBeTwo,
  remoteHostSeen,
  remoteHosts,
  remoteReadsAskedOf,
  remoteRequest,
  remoteUnits,
  pickHost,
  restoreSession,
  subscribeHostSeen,
  subscribeSwitching,
  subscribeRemoteState
} from './relay'
import { computerChanged, listen, refreshAll, reset as resetRig, startClean, unitReadSince, watchUnit, stopWatching } from './rig'
import { PHONE_NOTE_PATH, phoneNote, timeToTell } from './phone-note'

export const PROBE_FIRST = 3000
export const PROBE_CAP = 30000
/**
 * How long a connected phone goes without hearing from the Mac before it asks.
 *
 * Playing makes no traffic while nobody touches the screen, so this is the only
 * way a Mac that went to sleep shows up as red — and eight seconds plus the
 * six-second question is as long as anyone should look at a lamp that is lying.
 */
export const KEEPALIVE = 8000

export function nextDelay(previous) {
  if (!previous || previous < PROBE_FIRST) return PROBE_FIRST
  return Math.min(previous * 2, PROBE_CAP)
}

/** 'off' | 'joining' | 'no-answer' | 'connected' */
const initial = {
  link: 'off',
  macName: null,
  /*
   * What version the app on the computer is.
   *
   * "Does the Mac app need to be updated to the latest version? Or would that
   * affect how the app performs?" A fair question with an answer nobody could
   * reach: the computer has been writing its version into `host.name` beside
   * its own name all along, and this end read the name and threw the version
   * away.
   *
   * It matters. That app is the thing holding the cable to the unit and doing
   * every read this phone asks for, so an old one is slow here for reasons that
   * look, from a phone, exactly like this app being slow. Null until it says,
   * and an old enough launcher never says — which is itself an answer.
   */
  hostVersion: null,
  hosts: [],
  units: {},
  chosenHost: null,
  clash: null,
  /*
   * WHETHER THE LINK IS DOWN, as Play says it: NOT CONNECTED over dimmed
   * tiles, and every tap refused at once (tapGate). Not the same as "not
   * connected this instant" — see LINK_DOWN_HOLD_MS in relay-rules, which
   * says how long the link may be away before this is true, and why that is
   * long enough never to dim a working rig and short enough to be honest.
   * Never in the demo.
   */
  down: false
}

let state = initial
const watchers = new Set()

/*
 * WHEN THE LINK LEFT 'connected', and the one timer that says it has been
 * away long enough. The time it LEFT, not its last change: joining, no
 * answer and joining again in one stretch are one outage, and a clock that
 * started again at each of them would never reach the hold.
 */
let lostAt = 0
let downTimer = null

/** The `down` the link has now, moving lostAt and its timer with it. */
function downNow(link) {
  const now = Date.now()
  /* And the time it is away, added up, for a setlist song's setup to ask (tapGate linkAwayMs). */
  setLinkAway(link !== 'connected' && !isDemo(), now)
  if (link === 'connected' || isDemo()) {
    lostAt = 0
    if (downTimer) clearTimeout(downTimer)
    downTimer = null
    return false
  }
  if (!lostAt) {
    lostAt = now
    if (downTimer) clearTimeout(downTimer)
    downTimer = null
  }
  const down = linkDownAt({ link, lostAt, demo: isDemo() }, now)
  /*
   * Not down yet: one timer for the rest of the hold, armed again whenever it
   * has gone off short of it. A timer can fire a millisecond early by
   * Date.now() — Node's did, 47 times in 300 in a test — and then
   * the hold reads 1999 ms, nothing else is due, and NOT CONNECTED would wait
   * for whatever happened to call set() next: up to the loop's next turn,
   * eight seconds on. "Play says so right away" has to mean every time.
   */
  if (!down && !downTimer) {
    downTimer = setTimeout(() => {
      downTimer = null
      set({})
    }, Math.max(1, lostAt + LINK_DOWN_HOLD_MS - now))
  }
  return down
}

/*
 * THE HOLD STARTS AGAIN WHEN THE APP DOES.
 *
 * "connected → joining" twelve seconds after the last tap is the phone's
 * screen going off: Android cuts the connection when the app is put to sleep
 * (the AppState handler in startLink says more). The clock above started
 * then, so by the time the phone was out of the pocket its two seconds had
 * long run out, and Play came back already saying NOT CONNECTED — on every
 * unlock — and refused the first tap at once, though the link was back a
 * third of a second later and that tap would have waited for it inside its
 * own deadline and gone. Before any of this, the first tap after an unlock
 * waited a second for the rejoin and landed. It still should.
 *
 * Nobody was looking while the app slept, so whatever happened to the link
 * in there is not an outage anybody has been told about. Coming back on
 * screen, and the loop starting, are a fresh start: the link has its two
 * seconds again from here, like any link that has only just gone, and NOT
 * CONNECTED comes up only if the rejoin really does fail.
 *
 * The computer's loop only. Over Bluetooth, Play is not on screen to say
 * anything while the adapter is being looked for — the waiting screen covers
 * it from the moment the adapter goes (App.js's `settling`) — and the adapter
 * arriving is 'connected', which clears all of this at once.
 */
function holdAgain() {
  if (isDemo() || state.link === 'connected') return
  lostAt = Date.now()
  if (downTimer) clearTimeout(downTimer)
  downTimer = null
  set({})
}

/*
 * WHAT PLAY WAS SAYING AS THE APP WENT TO SLEEP: the outage it was already
 * showing as NOT CONNECTED (its lostAt), or 0. Coming back to the same outage
 * keeps the band up rather than starting the hold again: taking NOT CONNECTED
 * down for two seconds only to put it back would be the band flickering over
 * a link that never came back, which is the one thing it must not do.
 */
let asleep = false
let downAsleep = 0

const set = (patch) => {
  const next = { ...state, ...patch }
  next.down = downNow(next.link)
  if (
    next.down === state.down &&
    next.link === state.link &&
    next.macName === state.macName &&
    // The computer's version as well: the red "update the computer app" line
    // reads it, and an updated computer keeps the same name, so a check
    // without it left that line up after the update had already happened.
    next.hostVersion === state.hostVersion &&
    next.clash === state.clash &&
    next.chosenHost === state.chosenHost &&
    next.hosts.length === state.hosts.length &&
    next.units === state.units
  ) {
    return
  }
  /*
   * Every change of mind about the Mac, in the log.
   *
   * This is the spine of a bad evening: joining, connected, no-answer,
   * connected again. The screen only ever shows the latest one, and "it kept
   * dropping" is unanswerable without the sequence. Only when the STATE moved —
   * the guard above has already thrown away the no-ops.
   */
  const was = state.link
  const wasDown = state.down
  state = next
  if (next.link !== was) {
    logDebug('link', `${was} → ${next.link}`, next.macName || undefined)
  }
  if (next.down !== wasDown) {
    setLinkDown(next.down)
    logDebug(
      'link',
      next.down
        ? `down — Play says not connected (${next.link})`
        : next.link === 'connected' || isDemo()
          ? 'up — Play is live again'
          : `not down yet — the link has its two seconds again (${next.link})`
    )
  }
  for (const fn of watchers) fn(state)
}

export const linkState = () => state

export function subscribeLink(fn) {
  watchers.add(fn)
  return () => watchers.delete(fn)
}

/**
 * What the app should show, given the loop's own view of things.
 *
 * NOTHING ONCE THE LOOP HAS STOPPED. It used to say 'off' then, and that was
 * a late answer overwriting a newer truth: a probe still out when the demo
 * started (or, in the Bluetooth beta, when Bluetooth took over the link)
 * finished afterwards, came back here, and turned the demo's CONNECTED into
 * NO COMPUTER. Whatever stopped the loop has already said what the link is:
 * stopLink resets it, the demo and Bluetooth set their own.
 */
function refresh() {
  if (!running) return
  if (!remoteActive()) return set({ link: 'joining' })
  set({ link: remoteHostSeen() ? 'connected' : 'no-answer' })
}

let running = false
let timer = null
let delay = 0
let unbind = []

/** Ask again NOW — the screen came back, the network came back, someone tapped. */
export function probeNow() {
  /* Over Bluetooth "again" means the adapter: the waiting screen's button and a watch tap both come here. */
  if (bluetoothOn() && !isDemo()) return pokeBluetooth()
  if (!running) return
  delay = 0
  schedule(0)
}

/**
 * Wait until the computer answers, asking at once, for at most `ms`.
 *
 * For a watch tap that woke the app with the phone locked: the connection to
 * the computer went to sleep with the app, and the tap must not be sent into
 * it before it is back. True when connected, false when it gave up.
 */
export function untilConnected(ms = 8000) {
  if (state.link === 'connected') return Promise.resolve(true)
  probeNow()
  return new Promise((resolve) => {
    let off = () => {}
    const t = setTimeout(() => {
      off()
      resolve(false)
    }, ms)
    off = subscribeLink((s) => {
      if (s.link !== 'connected') return
      clearTimeout(t)
      off()
      resolve(true)
    })
  })
}

function schedule(ms) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(tick, ms)
}

/*
 * ASK AGAIN THE MOMENT THERE IS DOUBT, so one slow answer is not an outage.
 *
 * The link turns to "no answer" on any request that went unanswered — a read
 * the unit was too busy for, one keepalive the computer missed — and until
 * now nothing asked again for sixteen seconds: the loop's next turn, backed
 * off. With Play saying NOT CONNECTED after two seconds of that, a working
 * rig would have been dimmed mid-song by one slow read. So the computer is
 * asked once more at once (/healthz, which never waits on the serial port),
 * and a computer that is there puts the link back inside the hold.
 *
 * Two moments only: the computer stopped answering while the channel is up,
 * and the channel came back with nothing heard on it yet. Not when the
 * channel drops: realtime-js is already rejoining, and joining over it would
 * tear its rejoin down. And once per doubt, not a loop: hostSeen is only
 * announced on change, so a re-ask that also goes unanswered raises none,
 * and the ordinary backoff carries on from there. A rig that answers sends
 * nothing extra at all.
 */
let doubted = false
function doubt() {
  if (!running || isDemo() || !remoteActive()) return
  /* A turn on the network now reschedules itself when it ends; it asks again then instead. */
  if (turns > 0) {
    doubted = true
    return
  }
  schedule(0)
}

/*
 * HOW MANY TURNS OF THE LOOP ARE OUT ON THE NETWORK, for one question:
 * whether the phone is in the middle of reaching the computer.
 *
 * lib/updates.js asks it before switching to a downloaded version by itself
 * (see lib/update-rule.js), and the link's own word cannot answer it. The
 * word says 'joining' whenever the phone is not joined, and that is also what
 * it says after a phone's sleep: Android cuts the connection while the app is
 * put away, so a phone coming back after a night reads 'joining' with nothing
 * being joined at all until it is back on screen. This counts the attempts
 * actually under way instead. A count rather than a flag, because Look again
 * can start a turn while another is still waiting on the network.
 */
let turns = 0

/** True while a turn is out finding the computer: joining, or asking whether it is there. */
export const joiningNow = () => turns > 0 && state.link !== 'connected'

/*
 * WHAT THE LINK IS TO, AND WHEN THE COMPUTER LAST ANSWERED, for the same
 * question. An iPhone freezes the app while it is put away, so the word comes
 * back as it was before the freeze, 'connected' included; these two are what
 * tell a link from a word left over from the night (lib/update-rule.js). In
 * the order startLink decides it: the demo first, then Bluetooth.
 */
export const linkVia = () => (isDemo() ? 'demo' : bluetoothOn() ? 'bluetooth' : 'computer')
export const lastHeardAt = () => lastAnswerAt()

/*
 * WHICH RUN OF THE LOOP A TURN BELONGS TO. App.js stops the link and starts
 * it again when the demo or Bluetooth flips, and a turn of the loop that
 * stopped can still be out on the network when the new one begins: that
 * turn ends without touching the new loop, whose first turn it used to put
 * three seconds back with a schedule of its own. Moved by startLink.
 */
let generation = 0

function tick() {
  turns += 1
  return turn(generation).finally(() => {
    turns -= 1
  })
}

/**
 * One turn of the loop.
 *
 *   - no channel        → join
 *   - channel, no answer → ask
 *   - answering          → a keepalive only if nothing has been heard for a
 *     while; ordinary traffic is proof enough and costs nothing extra
 */
async function turn(gen) {
  /* This loop's turn, and only while it runs: see generation. Asked again after every wait on the network. */
  const ours = () => running && gen === generation
  if (!ours()) return
  /* A real loop has no business running under the demo. See startLink. */
  if (isDemo()) return enterDemo()

  if (!remoteActive()) {
    /* Waited on another turn's join: that turn carries on from it, and says when the next one is (see join). */
    const shared = await join(gen)
    if (!ours() || shared) return
  } else if (!remoteHostSeen()) {
    await hostResponds()
    if (!ours()) return
    refresh()
    if (remoteHostSeen()) await readMacName()
  } else if (Date.now() - lastAnswerAt() > KEEPALIVE) {
    await hostResponds()
    if (!ours()) return
    refresh()
  }
  if (!ours()) return

  /* A link where no roll call was taken: counted now (countIfDue). */
  countIfDue()
  // A computer that was updated while this phone watched says so within a
  // couple of minutes, rather than at the next join.
  if (running && state.link === 'connected' && Date.now() - namedAt > NAME_AGAIN) await readMacName()
  if (!ours()) return
  // And the computer hears that a phone is using it, so it does not go to sleep under the song.
  if (running) tellComputer()
  // And that nobody here is looking at the unit's level readings, so it stops asking the unit for them.
  if (running) quietMeters()

  /* Stopped while this turn was waiting on the network: no next turn. A turn
     that rescheduled itself after stopLink is a loop nobody can see running. */
  if (!running) return
  delay = state.link === 'connected' ? KEEPALIVE : doubted ? delay : nextDelay(delay)
  /* Doubted while this turn was out: ask again now, the backoff left where it was for the turn after (see doubt). */
  if (doubted) {
    doubted = false
    if (state.link !== 'connected' && remoteActive()) return schedule(0)
  }
  schedule(delay)
}

/*
 * ONE JOIN AT A TIME. A turn that finds one already under way waits for that
 * one and starts nothing of its own. iOS says the app is back on screen while
 * the launch is still joining (134 ms in, in Justin's log of 22 October
 * 2026), probeNow starts a second turn, and nothing was joined yet, so it
 * joined again: the second join took the first one's channel, the first
 * could then only end on its twelve-second timer, and its clean-up closed
 * the socket both were on. The link dropped twelve seconds after launch, for
 * sixteen, under a Which unit tap. The browser has always had this guard
 * (src/lib/link.js, `if (joining) return`).
 *
 * WHILE ITS CHANNEL IS BEING JOINED, AND NO LONGER. Joined, a join goes on
 * reading the unit and taking the roll call for seconds, and a channel lost
 * under those reads (Android cutting it as the app is put away) is joined
 * again by the next turn at once, as 1.87.48 did, with a fresh roll call.
 * Waited on instead, the app back on screen sat out every one of those reads
 * on a channel that was gone, NOT CONNECTED for up to forty seconds, and a
 * roll call cut short by the drop was kept for the rest of the link: writes
 * to both computers.
 *
 * True when this turn waited on a join that another turn of its own run of
 * the loop began: that turn carries on from it, the reads after it and the
 * next turn's time, so one failed join puts the backoff up once. A turn of
 * a loop started since carries on itself, because the turn that began the
 * join ends without a word to the new loop (generation).
 */
async function join(gen) {
  const now = joinRun
  if (now && now.connecting) {
    await now.done
    return now.gen === gen
  }
  const run = { gen, connecting: true, done: null }
  joinRun = run
  joinBusy = true
  /* Two can overlap once the first is past its channel: only the newer one's end clears these. */
  run.done = joinOnce(run).finally(() => {
    if (joinRun !== run) return
    joinBusy = false
    joinRun = null
  })
  await run.done
  return false
}

/* Inside join, which takes the roll call itself: countIfDue leaves it to it. */
let joinBusy = false
/* The join under way, { gen, connecting, done }: a second turn waits on it while its channel is being joined (see join). */
let joinRun = null

async function joinOnce(run) {
  set({ link: 'joining' })
  const began = Date.now()
  try {
    await remoteConnect()
  } catch (err) {
    /*
     * Replaced, not failed: its channel was taken down for a newer join's
     * (relay.js joinChannel), which says how it went. Nothing said when the
     * loop was stopped instead, with no newer join to come.
     */
    if (err?.replaced) {
      if (running) logDebug('link', 'join replaced by a newer one')
      refresh()
      return
    }
    // A join that failed is a Mac that isn't there yet. The loop is the retry.
    // Said in the log with why and how long, because "joining" for minutes
    // with nothing between the state lines was a log that could not be read.
    logDebug('link', `join failed after ${Math.round((Date.now() - began) / 100) / 10}s`, err?.message || String(err))
    refresh()
    return
  } finally {
    /* Joined or not, its channel is no longer being joined: a turn from here on joins again rather than wait on what follows (see join). */
    run.connecting = false
  }
  if (!running) return
  listen()
  /* When this link came up: a count owed on it goes by every read since (countIfDue). */
  joinedAt = Date.now()
  refresh()

  /* Not answered yet: the roll call is taken when it does (countIfDue, from the loop and from the first answer). */
  const answered = await hostResponds()
  refresh()
  if (!answered) return

  /*
   * The moment the computer answers, before the roll call holds every write
   * for up to six seconds and before refreshAll's reads queue up on the
   * unit's one port: from here on it stops asking the unit for its levels.
   * Sent to every computer on the account, which is what is wanted. Not
   * awaited. See quietMeters.
   *
   * And the roll call, not awaited: it costs a second and a half of
   * listening and the ordinary case has nothing to report, so it must not
   * stand between someone and their unit. Writes are refused from the moment
   * the count lands. Begun before the computer's name is read on an account
   * that may have two (relay.js remoteMayBeTwo): a tap made while that read
   * was out went to every computer on the account, both units. Every other
   * account goes in 1.87.47's order, the name first, so its taps are held
   * exactly when they were then: one whose last count heard one, one never
   * counted, and one whose record is not off the disk yet.
   */
  if (!remoteMayBeTwo()) {
    await readMacName()
    quietMeters()
    countHosts()
  } else {
    quietMeters()
    countHosts()
    await readMacName()
  }

  try {
    await refreshAll()
  } catch {
    // The rig store keeps what it learned, including the failure.
  }

  /*
   * And from here on, keep asking.
   *
   * refreshAll is the only thing that ever established whether the unit is
   * there, and it runs once, here. "I purposefully unplugged the FM3 from
   * the computer and it still said connected" — it had, because after this
   * line nothing on a stage screen asks the unit anything: everything those
   * screens draw is already in the store. See rig.watchUnit.
   */
  watchUnit()
}

async function countHosts() {
  await afterCount(remoteChosenHost(), censusHosts())
}

/** When the link now up was joined: see countIfDue. */
let joinedAt = 0

/** What a roll call found, put to use: `run` is the count, `was` the computer driven as it began, `began` when the reads it goes by began. */
async function afterCount(was, run, began = Date.now()) {
  try {
    let before = was
    await run
    heardHosts()
    /* Cut short by a drop, and owed: taken again now if the computer is answering, else when it does (countIfDue). Nothing it found is put to use. */
    if (remoteCountOwed()) return countIfDue()
    /* The roll call picked a computer: that one is told about the level readings, whatever answered first before (see metersAgain). */
    if (remoteChosenHost() !== before) {
      metersAgain()
      quietMeters()
    }
    /*
     * One of two picked: its name, for Settings and the log's header, read
     * again now that it is asked of that computer alone (the read at join
     * went to whichever answered first). Then what was read while the roll
     * call listened: where every one of those reads was asked of this
     * computer (a pick made before, relay.js holdReads), it is this unit's
     * already, and once the unit has answered it (rig.unitReadSince) nothing
     * is read twice. One whose detect was lost or refused is read again, as
     * 1.87.47 always did: nothing else would ever ask, and Play would wait on
     * "Asking your unit what it is" for good. Otherwise it came from
     * whichever computer answered first, and it goes, names, chain, tempo
     * and all (rig.startClean), before the unit is read again.
     */
    if (remoteHosts().length > 1 && remoteChosenHost() !== before) {
      readMacName()
      if (remoteReadsAskedOf() !== remoteChosenHost()) startClean()
      else if (unitReadSince(began)) before = remoteChosenHost()
    }
    /* The roll call picked one of two (firstUnitHost): what was read while it
       listened came from whichever answered first, so read it again. */
    if (remoteHosts().length > 1 && remoteChosenHost() !== before) await refreshAll()
  } catch {
    // A roll call that fails is not a reason to distrust the link.
  }
}

/*
 * THE ROLL CALL IS TAKEN WHEN THE COMPUTER FIRST ANSWERS, whenever that is.
 * Join takes it once the first /healthz is answered; a join whose first
 * /healthz went unanswered (the Pis still starting) returned without one,
 * and nothing took it after: every read went to whoever answered first and
 * every write to every computer, for the life of the link. So the first
 * answer on a link with no count takes it, from wherever the answer came,
 * and the loop asks too. Once per link and never again on it: a count
 * mid-set holds every tap for its window (relay.js remoteCountDue). Not
 * held at all for an account whose last count heard one computer, which
 * 1.87.47 sent at once here (`late`, relay.js censusHosts). Never in the
 * demo or over Bluetooth, and never inside join, which takes its own.
 */
function countIfDue() {
  /*
   * AND A COUNT CUT SHORT BY A DROP IS TAKEN AGAIN the moment the computer
   * answers on the channel that came back (relay.js recountOwed), the
   * join that took it still reading the unit or not: every write waits for
   * it. What it goes by is every read since the link came up, which the one
   * cut short kept asking of the pick: a unit read off it then is not read
   * again (afterCount).
   */
  const owed = remoteCountOwed()
  if (!running || (joinBusy && !owed) || isDemo() || bluetoothOn() || !remoteHostSeen() || !remoteCountDue()) return
  afterCount(remoteChosenHost(), censusHosts({ late: true }), owed ? joinedAt : Date.now())
}

/*
 * Which unit moved to another computer (relay.js subscribeSwitching), told
 * before a read is asked of it: what is on its way from the one left is
 * dropped, and nothing is filed until the new unit is read (rig
 * computerChanged); chooseHost starts clean once the pick is proved.
 */
let switchOwed = false
function switchedComputer() {
  switchOwed = true
  computerChanged()
}

/** What the roll call found, into the link's state, for Settings and Which unit. */
const heardHosts = () => set({ hosts: remoteHosts(), units: remoteUnits(), chosenHost: remoteChosenHost(), clash: hostConflict() })

/**
 * Drive this unit and no other: the Which unit buttons.
 *
 * Then read the unit again, start to finish. Moving from the computer with
 * the AM4 to the one with the FM3 is a different unit, with a different
 * chain and different presets in the same slots, and everything on screen
 * was read off the other one. refreshAll is what tells a new unit from an
 * old one and drops the names that belonged to it.
 *
 * Another computer than the one driven is a clean start (rig.startClean):
 * the scene names, the chain and the tempo on screen were the other unit's,
 * and a row of named tiles is never asked again. And its name, for Settings
 * and the log's header, read off it.
 *
 * Told by relay.js the moment it switches, before any read is asked of the
 * new computer (rig.computerChanged): a read made during the proof was asked
 * of the new one and filed under the unit on screen, the old one's. Only a
 * computer actually switched to starts clean: a tap that found nothing to
 * switch (the name not listed) leaves the screen as it is.
 *
 * A proof the link dropped under, its answer lost, proved nothing: the
 * computers are counted again (relay.js provePick), now if the computer is
 * answering and as soon as it does if not (countIfDue).
 */
export async function chooseHost(name) {
  const ok = await pickHost(name)
  const moved = switchOwed
  switchOwed = false
  heardHosts()
  if (remoteCountOwed()) countIfDue()
  metersAgain()
  quietMeters()
  if (moved) startClean()
  readMacName()
  try {
    await refreshAll()
  } catch {
    // The rig store keeps what it learned, including the failure.
  }
  return ok
}

/**
 * How long the phone goes before asking the computer again what it is.
 *
 * The computer rewrites its name and version every five minutes (see
 * TELL_PHONES_MS in desktop/lib/host.mjs), and this end used to read it once,
 * at join, and never again. So a computer whose app was updated while the
 * phone sat connected kept answering with whatever it had said hours earlier —
 * including nothing at all, from a launcher too old to write a version.
 *
 * Asking again costs one small document read a couple of minutes, next to a
 * keepalive that already runs every eight seconds. That buys a phone that
 * notices a computer being updated while it watches.
 */
export const NAME_AGAIN = 2 * 60 * 1000

/** When the computer was last asked what it is. */
let namedAt = 0
/*
 * The last answer, so asking again every couple of minutes does not write the
 * same line into the log thirty times an hour. The log is read by being pasted
 * into a chat, and a line repeated that often buries the one that matters.
 * What is worth saying is the first answer and every time it changes.
 */
let namedSaid = null

/**
 * What the Mac calls itself, so a screen can say "Connected to Studio Mac".
 *
 * Written into the host's own document store by the launcher on that Mac, which
 * is also the read the roll call counts answers to. Since 7.205.0 the launcher
 * writes its own version beside the name, which is what the Setup screen and a
 * pasted log report as the computer app's version.
 *
 * Every outcome goes in the log, because "did not say" on the Setup screen has
 * three different causes and the pasted log could not tell them apart: a read
 * that never got an answer, a computer that has written nothing, and a computer
 * that wrote a name with no version beside it. Only the last of those is the
 * old launcher the screen blames.
 */
async function readMacName() {
  try {
    const doc = await remoteRequest('/store/config/host.name')
    const data = doc?.data && typeof doc.data === 'object' ? doc.data : doc
    namedAt = Date.now()
    const name = data?.name
    const version = data?.version
    if (!name) {
      say('the computer has not written its name yet')
      return
    }
    /*
     * Both together, and the version cleared when it is absent, the way the
     * browser has always read it. A version that is kept after the computer
     * stopped saying one is a screen reporting an app that may not be running
     * any more.
     */
    set({ macName: String(name), hostVersion: version ? String(version) : null })
    say(version ? `the computer is ${name}, v${version}` : `the computer is ${name} and did not say its version`)
  } catch (err) {
    // "your Mac" is a fine name. The log still says the asking failed.
    say(`could not read what the computer is — ${err?.message || String(err)}`)
  }
}

/** When the computer was last told a phone is using it; 0 for not yet on this link. */
let toldAt = 0

/**
 * Tell the computer this phone is using it, every couple of minutes while
 * connected.
 *
 * Laptops idle-sleep at gigs, and the computer app keeps one awake while a
 * phone is using it — but it cannot see this app's requests at all: they
 * come through the relay, from inside the computer's device server. So the
 * phone leaves a note in the computer's store instead, and the computer
 * stays awake for half an hour after the last one. See shared/phone-note.mjs.
 *
 * Not awaited, and nothing said if it fails: a note that missed is the next
 * one two minutes later, and nothing on screen depends on it. relay.js
 * already writes a failed request into the log.
 */
function tellComputer() {
  const now = Date.now()
  // A link that dropped and came back — a computer that slept, say — says so at once.
  if (state.link !== 'connected') toldAt = 0
  if (!timeToTell({ link: state.link, clash: state.clash, toldAt, now })) return
  toldAt = now
  remoteRequest(PHONE_NOTE_PATH, { method: 'PUT', body: JSON.stringify(phoneNote(now)) }).catch(() => {})
}

/** When the computer was last told nobody here is looking at its level readings; 0 for not yet on this link. */
let quietAt = 0
/** It refused (a computer too old to have the route): not asked again until the link drops or another is picked. */
let quietRefused = false
/** Which link an answer belongs to, so a refusal that lands after a drop is not held against the next. */
let quietLink = 0

/**
 * Tell the computer nobody here is looking at the unit's level readings: at
 * once when it answers, every couple of minutes while connected, and at once
 * again after any drop. See METERS_OFF_PATH in relay-rules — what it costs
 * the unit when nobody says so, why both apps only ever say off, and what an
 * old computer does with it.
 *
 * "With an FM3, FM9 or Axe-Fx III, the computer asks the unit for its output
 * level about 40 times a second the whole time it's online ... The website
 * already says 'stop' when it doesn't need them; the phone never does." (The
 * pick Justin approved, 15 October 2026.)
 *
 * Its own clock, not tellComputer's: that one starts again only on a turn
 * that finds the link down, and a drop that heals between two turns — a
 * computer app restarted, which comes back with the readings on — would wait
 * out the two minutes. metersAgain, from the link's own news in startLink,
 * catches those.
 *
 * Not awaited, and nothing said: relay.js writes a failed request into the
 * log once, and a computer that refused it is not asked again on this link.
 * The demo and Bluetooth have no computer, and never run the loop that calls
 * this.
 */
function quietMeters() {
  if (isDemo() || bluetoothOn()) return
  const now = Date.now()
  if (state.link !== 'connected') quietAt = 0
  if (!timeToQuietMeters({ link: state.link, clash: state.clash, refused: quietRefused, quietAt, now })) return
  quietAt = now
  const asked = quietLink
  remoteRequest(METERS_OFF_PATH, { method: 'POST', body: metersOffBody() }).catch((err) => {
    if (asked === quietLink && metersRefused(err)) quietRefused = true
  })
}

/** The link dropped, or the computer it drives changed: say it again as soon as it answers, and ask one that refused again. */
function metersAgain() {
  quietAt = 0
  quietRefused = false
  quietLink += 1
}

/** Said once, and again only when the answer is a different one. */
function say(line) {
  if (line === namedSaid) return
  namedSaid = line
  logDebug('link', line)
}

/** Start the loop. Idempotent — a second call is a probe, not a second loop. */
export function startLink() {
  /*
   * BLUETOOTH (BETA): NO COMPUTER TO FIND, so none is looked for. The phone
   * connects to the adapter on the unit instead (bleLink.js), and the link
   * says 'connected' once the adapter is; whether the unit answers is the
   * rig's `unit`, the same as over the computer. The demo still wins, as it
   * does in device.js: somebody looking around is not driving a rig.
   */
  if (bluetoothOn() && !isDemo()) {
    running = false
    startBluetoothLink(set)
    return stopLink
  }
  /*
   * The demo has no far end, so there is nothing to find and nothing to poll.
   *
   * Said as 'connected' because that is what it is from every screen's point of
   * view: the questions get answered. Leaving it as 'no-answer' would have the
   * whole app refuse to open the preset list over a unit that is right there.
   * The name is what tells anybody it is not a real rig, and the bar shows it.
   */
  if (isDemo()) {
    enterDemo()
    return stopLink
  }
  if (running) {
    probeNow()
    return stopLink
  }
  running = true
  /* A new run of the loop: a turn of the one before that is still out ends without touching this one (see generation). */
  generation += 1
  delay = 0
  /*
   * The loop starting is a fresh start too: a link left 'off' by a sign-out,
   * or set early in a launch before the loop began, has had its two seconds
   * run out already, and the first join must not open with every tap
   * refused. See holdAgain.
   */
  holdAgain()
  asleep = AppState.currentState != null && AppState.currentState !== 'active'
  downAsleep = 0

  unbind = [
    // The channel coming back under us is the app catching up rather than a
    // stale screen; realtime-js rejoins on its own and this is what notices.
    subscribeRemoteState((up) => {
      /* Gone: whatever answers when it is back may have restarted with the level readings on. See quietMeters. */
      if (!up) metersAgain()
      refresh()
      /* Back, and nothing heard on it yet: ask now rather than at the next turn. See doubt. */
      if (up && !remoteHostSeen()) doubt()
    }),
    subscribeHostSeen((seen) => {
      if (!seen) metersAgain()
      refresh()
      /* Stopped answering on a channel that is up: ask once more, at once. See doubt. */
      if (!seen) doubt()
      /* Answering, on a link that has had no roll call: taken now (countIfDue). */
      if (seen) countIfDue()
    }),
    /* Which unit moving to another computer, before a read is asked of it (switchedComputer). */
    subscribeSwitching(switchedComputer),
    AppState.addEventListener('change', (status) => {
      /*
       * Said in the log, because without it a paste reads as a link that
       * keeps dropping: "connected → joining" twelve seconds after the last
       * tap, "→ connected" a second before the next. That is the phone's
       * screen going off — Android cuts the connection when the app is put
       * to sleep — and this is the app coming back. Six of those in one
       * evening's log, none of them a fault, and nothing in it said so.
       */
      logDebug('app', status === 'active' ? 'back on screen' : `put to sleep (${status})`)
      /*
       * And Play's two seconds start again on the way back (holdAgain), so
       * the connection Android cut in the pocket is not NOT CONNECTED the
       * instant the screen comes on — unless Play was already saying it as
       * the phone went to sleep, over the same outage, which it still is.
       */
      if (status !== 'active' && !asleep) {
        asleep = true
        downAsleep = state.down ? lostAt : 0
      }
      if (status === 'active' && asleep) {
        asleep = false
        if (!downAsleep || downAsleep !== lostAt) holdAgain()
        downAsleep = 0
      }
      // Back from a locked screen or another app: ask now rather than waiting
      // out whatever backoff the loop had reached while nobody was looking.
      if (status === 'active') probeNow()
      /*
       * A phone in a pocket has no screen to be wrong on, so the unit check
       * stops with it — and starts again on the way back, where its first
       * answer lands before anybody has read anything. Android cuts the
       * connection on sleep anyway, so the checks that would run in there
       * would only be a column of failures in the log.
       */
      if (status === 'active') watchUnit()
      else stopWatching()
    })
  ]

  schedule(0)
  return stopLink
}

/*
 * THE DEMO IS ALWAYS CONNECTED, and nothing that finishes late may say otherwise.
 *
 * "I'm in the demo and the preset is greyed out and can't be pressed." The
 * preset list opens only while the link says connected. Entering the demo runs
 * stopLink and then startLink — and stopLink used to reset the link AFTER
 * awaiting the channel's disconnect, so its tail landed after startLink had
 * already said connected, and put 'off' back:
 *
 *   [link] no-answer → connected — the demo
 *   [link] connected → off
 *
 * So the reset now happens before the wait, and a real loop found running
 * under the demo is stopped here rather than left to join a computer the
 * demo does not use.
 */
function enterDemo() {
  running = false
  if (timer) clearTimeout(timer)
  timer = null
  set({ link: 'connected', macName: 'the demo', hostVersion: null })
}

export async function stopLink() {
  /* First: Bluetooth lets go of the adapter before the link and the rig are reset; with the AM4 on its own tuner, a second at most after (bleLink). */
  stopBluetoothLink()
  running = false
  if (timer) clearTimeout(timer)
  timer = null
  for (const off of unbind) {
    try {
      off?.remove ? off.remove() : off?.()
    } catch {
      // Unbinding twice is not a failure worth reporting.
    }
  }
  unbind = []
  namedAt = 0
  namedSaid = null
  toldAt = 0
  metersAgain()
  /* Reset first, then wait: see enterDemo. */
  resetRig()
  set({ ...initial })
  await remoteDisconnect()
}

/** Whether a session was left over from last time, without joining anything. */
export const haveSession = () => restoreSession()
