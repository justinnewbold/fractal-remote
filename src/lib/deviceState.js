import { useSyncExternalStore } from 'react'
import { invalidateSchema, resetSchemaCache } from './schemaCache.js'
import {
  CHAIN_FRESH_MS,
  OWN_SETTLE_MS,
  PRESET_SETTLE_MS,
  announcementKind,
  classifyGridNews,
  createOwnEchoes,
  judgeCopy
} from '../../shared/own-echo.mjs'

export { CHAIN_FRESH_MS, OWN_ECHO_MS, OWN_SETTLE_MS, PRESET_SETTLE_MS } from '../../shared/own-echo.mjs'

/**
 * One device, one copy of what it is doing.
 *
 * Before this, the unit's state lived in as many places as there were panels
 * that cared. App held the blocks, the preset, the scene, the tempo and the
 * tuner. Gig held its own blocks, its own scene, its own tuner and its own
 * event subscription — it was not a view over App's state, it was a second
 * client to the same serial port. Scenes read the scene once at mount and never
 * again, so changing scenes anywhere else left that panel confidently wrong
 * until it remounted.
 *
 * Two subscriptions to one event stream is the part that actually bites: a
 * scene change on a footswitch arrived twice, and each listener answered it by
 * re-reading the block list down a port that serialises every request. So the
 * store owns the subscription, and everything else reads.
 *
 * The visible win: today only the gig screen follows a scene changed on the
 * floor. Afterwards every surface does.
 *
 * ## Why the device functions are injected
 *
 * This module deliberately does not import the device client. That client
 * imports the mock, and the mock imports JSON, which node cannot load — so
 * anything that reaches it becomes untestable outside a browser, which is
 * exactly what happened to App.jsx. With the driver injected, the whole write
 * path — optimistic set, confirm, roll back on refusal, and the echo guard —
 * runs against a fake in `test/run.mjs` with no hardware and no browser.
 */

/* Shared empties, so an unchanged snapshot is referentially unchanged and
   useSyncExternalStore doesn't re-render the app forever. */
const NO_BLOCKS = Object.freeze([])
const NO_NAMES = Object.freeze([])

const BLANK = {
  preset: null,
  blocks: NO_BLOCKS,
  sceneIndex: 0,
  sceneNames: NO_NAMES,
  bpm: null,
  tunerOn: false,
  tuning: null,
  /*
   * Which load of the edit buffer this is.
   *
   * On the play test a Gain turned to 25 still read 25 after Revert. The
   * open editor re-reads when its block, channel or scene changes — and a
   * Revert changes none of them: it is the same slot loaded again, the same
   * amp on the same channel on the same scene, with every value underneath
   * put back. So the knob went on saying what the unit no longer had.
   *
   * A number that moves every time the buffer is loaded again — a preset
   * chosen here, one changed at the unit, a Revert, a pre-edit copy put back
   * — is what tells an editor its values are someone else's now. See
   * bufferReloaded.
   */
  editRev: 0
}

let state = BLANK
const listeners = new Set()
let driver = null
let stopEvents = null

/** The current snapshot. Frozen in practice: never mutate it, replace it. */
export const getSnapshot = () => state

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Apply a patch, and say whether anything actually moved.
 *
 * The equality check is not an optimisation. useSyncExternalStore compares
 * snapshots by identity and re-reads on every notify, so a set() that always
 * built a new object would loop the app on every inbound event — and the tuner
 * pushes several a second.
 */
export function set(patch) {
  let next = null
  for (const key of Object.keys(patch)) {
    if (Object.is(state[key], patch[key])) continue
    if (!next) next = { ...state }
    next[key] = patch[key]
  }
  if (!next) return false
  state = next
  for (const listener of [...listeners]) listener()
  return true
}

/**
 * The edit buffer has just been loaded again, so every value read off it
 * before now is stale. Anything showing values keys its read on `editRev`.
 */
export function bufferReloaded() {
  set({ editRev: state.editRev + 1 })
}

/**
 * The echo guard.
 *
 * A local write and the device's own event for that write are the same fact
 * arriving twice. Without this the optimistic set lands, the SSE echo lands a
 * beat later, and a scene button flickers through the old value on its way back
 * to the one you pressed — or worse, a second write races the first.
 *
 * Time-boxed rather than counted: a dropped echo must not leave the guard armed
 * against a genuine footswitch press a minute later.
 */
export const ECHO_MS = 600
const recent = new Map()

export function markLocal(field, value, now = Date.now()) {
  recent.set(field, { value, at: now })
}

export function isEcho(field, value, now = Date.now()) {
  const seen = recent.get(field)
  if (!seen) return false
  if (now - seen.at > ECHO_MS) {
    recent.delete(field)
    return false
  }
  if (!Object.is(seen.value, value)) return false
  // One echo per write. A second event carrying the same value is the device
  // saying it again, and the screen should follow it.
  recent.delete(field)
  return true
}

/*
 * The clock the preset reads wait on. Handed in by the tests, so "a second
 * and a half later" costs nothing to run; the real one otherwise.
 */
const REAL_CLOCK = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id)
}
let clock = REAL_CLOCK

export function attachClock(next) {
  clock = next || REAL_CLOCK
}

/*
 * THIS WINDOW'S OWN WRITES, WAITING FOR THEIR ANNOUNCEMENT.
 *
 * Not the same thing as the guard above, which keeps a button from flickering
 * back through a value. This one decides whether an announcement is worth
 * reading the unit over: a scene, bypass or preset written here is announced
 * straight back by the computer, and each write owes exactly one. See
 * shared/own-echo.mjs, which the phone uses too.
 */
const echoes = createOwnEchoes({ now: () => clock.now() })

/** Everything the store needs from the device, so tests can hand it a fake. */
export function attachDriver(next) {
  driver = next
}

export const attachedDriver = () => driver

/**
 * Inbound device events, from the one subscription.
 *
 * Exported rather than closed over so the event handling is testable on its
 * own — this is where a footswitch, a tap tempo and a tuner reading all land.
 */
export function handleEvent(event) {
  if (!event) return

  if (event.type === 'scene' && typeof event.index === 'number') {
    if (!isEcho('sceneIndex', event.index)) set({ sceneIndex: event.index })
  }

  if (event.type === 'tempo' && typeof event.bpm === 'number') {
    if (!isEcho('bpm', event.bpm)) set({ bpm: event.bpm })
  }

  /*
   * The tuner pushes readings rather than answering requests, so the stream is
   * the only thing that makes the display move — but only while the tuner is
   * actually on. ForgeFX starts its poll for any client and the demo device
   * pushes a reading every 400ms unconditionally, so an ungated store would
   * re-render every surface holding a reading two and a half times a second,
   * forever, with no tuner open anywhere.
   */
  if ((event.type === 'tuner' || event.note !== undefined) && state.tunerOn) {
    set({ tuning: event })
  }

  /*
   * WHAT AN ANNOUNCEMENT IS ALLOWED TO COST THE UNIT.
   *
   * "The Fractals are set up to have gapless switching of scenes and effects
   * ... the sound should never cut out." Every scene and every announcement
   * used to read the chain here — a whole preset dumped down the port, about
   * 24KB, landing on a unit still in the middle of the switch. And the Mac
   * window heard the phone's switches too, so it added its own dump to every
   * tap on the phone.
   *
   *   - this window's own scene, bypass and preset writes are consumed here;
   *     the write that caused them makes whatever small read it needs.
   *   - a scene from anywhere else is the small status read, and a one-line
   *     "which preset is this" to catch a preset change that came with it.
   *   - a preset changed somewhere else gets ONE chain read, a moment later.
   *   - a "changed the chain" from anywhere else is asked about first with
   *     the small status read, because the computer says exactly that about
   *     an effect switched on the phone. A block added, moved, removed or
   *     swapped really did change the chain, and still reads it — once, a
   *     moment later.
   */
  const kind = announcementKind(event)
  if (!kind) return
  if (echoes.take(kind, kind === 'scene' ? event.index : undefined)) return
  if (kind === 'scene') followScene()
  else if (kind === 'preset') followPresetNews()
  else followGridNews()
}

/*
 * ANOTHER CLIENT CHANGED THE CHAIN — or says it did. An effect tapped on the
 * phone is announced here as a change to the chain, with nothing to say whose
 * it was, and reading the chain over it was a dump of the preset on every
 * phone tap while the Mac window was open. The status read says which it was;
 * see classifyGridNews. One in the air at a time, and one chain read a moment
 * later however many announcements arrive in the moment.
 */
let gridFollowing = null
let gridAgain = false
let gridTimer = null
/* Whether a read in this run of announcements has found a switch. */
let gridSwitched = false
/* What the last status read listed, for a block it lists and the chain does not draw. */
let statusIds = new Set()
async function followGridNews() {
  if (gridFollowing) {
    gridAgain = true
    return gridFollowing
  }
  gridFollowing = (async () => {
    /* A preset change's own chain read is coming, and carries all of it. */
    if (presetBusy()) return
    let states = null
    if (driver?.sceneState) {
      try {
        states = await driver.sceneState()
      } catch {
        states = null
      }
    }
    if (presetBusy()) return
    const news = classifyGridNews(state.blocks, states, statusIds)
    /* Known from here on, so a block the status read lists and the chain
       never draws is not taken for a new one at every announcement. */
    if (Array.isArray(states) && states.length) statusIds = new Set(states.map((x) => x.effectId))
    if (news === 'switch') {
      layStates(states)
      gridSwitched = true
      return
    }
    /* Nothing new, straight after a read that found a switch: that read
       already carried this one too, the pair having landed together. */
    if (news === 'same' && gridSwitched) return
    chainSoon()
  })()
  try {
    await gridFollowing
  } finally {
    gridFollowing = null
    if (gridAgain) {
      gridAgain = false
      followGridNews()
    } else gridSwitched = false
  }
}

/*
 * One chain read a moment from now; a further ask inside the moment starts it
 * again. `read` is what that read is: the chain on its own, or the whole read
 * of a preset when the last one of those failed.
 */
function chainSoon(read = () => refreshBlocks()) {
  clock.clearTimeout(gridTimer)
  gridTimer = clock.setTimeout(() => {
    gridTimer = null
    if (presetBusy()) return
    read()
  }, PRESET_SETTLE_MS)
}

/*
 * Whether the chain on screen was read for another preset than the one on
 * screen: the read after a preset change failed, however many times it was
 * asked, and the last song's blocks are still up. Not while a preset change
 * is being read, or while the computer's copy is being waited out.
 */
const otherPresetsChain = () =>
  !presetBusy() && staleTimer === null && !!chainRead && chainRead.number !== state.preset?.number

/*
 * Whether the computer keeps a copy of the loaded preset that a second read
 * costs the unit nothing: a gen-3, whose copy lasts a quarter of a minute.
 * See forgefx.hostKeepsCopy. null when the driver cannot say.
 */
const hostKeepsCopy = () => {
  const says = driver?.hostKeepsCopy?.()
  return typeof says === 'boolean' ? says : null
}

/*
 * Which unbroken run of listening this is. Everything announced reached this
 * store while it stays the same, so a chain read in it has been kept up to
 * date since, however long ago it was read. The event stream dropping starts
 * a new run: whatever was announced in the gap was lost. See chainFollowed.
 */
let followGen = 0
const gap = () => {
  followGen += 1
}

/** Start the one subscription. Safe to call repeatedly; only the first binds. */
export function listen() {
  if (stopEvents || !driver?.subscribeEvents) return stopListening
  gap()
  stopEvents = driver.subscribeEvents(handleEvent, { onGap: gap })
  return stopListening
}

export function stopListening() {
  if (!stopEvents) return
  const off = stopEvents
  stopEvents = null
  gap()
  off()
}

export const isListening = () => !!stopEvents

/* ---------------------------------------------------------------- reads --- */

/**
 * Re-read the chain.
 *
 * Returns the list, or null if the unit wouldn't answer. The event path ignores
 * the result — it runs behind every scene change and a lost race for the port
 * is not worth a message — but the gig screen shows "couldn't read the chain"
 * rather than an empty row, because an empty row reads as an empty preset.
 */
/**
 * How many times a unit that was answering gets asked again before it is
 * declared gone, and how long between asks.
 *
 * A real unplug is still reported inside a second and a half. A preset change
 * on an FM3 takes a fraction of that, which is the whole problem this exists
 * for.
 */
export const SETTLE_TRIES = 3
export const SETTLE_MS = 700

/**
 * How many times a phone asks before believing "no unit".
 *
 * "Says it's connected but says no unit. The unit is connected — if I hit Try
 * again like five or six times it will actually connect."
 *
 * Every ask from a phone becomes a real handshake down the Mac's serial port
 * with a 1.5-second window, on a port the Mac's own page is polling for meters
 * every half second and an AM4 answers with 500ms structure reads. A handshake
 * that lands in the middle of one of those misses, and a miss reads as "no
 * unit". Five or six taps is what it took by hand; this is those taps, taken
 * automatically, with a gap between them so each lands at a different phase
 * of whatever the port is doing.
 */
export const RELAY_TRIES = 5

/**
 * The asking a read is worth when the app itself just told the unit to do
 * something slow, and how long between asks.
 *
 * "The screen popped up while it was saving a preset" — THE MAC CAN'T SEE
 * YOUR UNIT, over a save that was going through.
 *
 * A save is the one thing the app asks for that takes the unit away for
 * seconds rather than milliseconds: the whole preset goes to flash and
 * nothing is answered while it does. Both ends re-read the moment the save
 * reports done — the Mac from its own write, the phone from the Mac's word
 * that it landed — so that read is aimed at a port that is still busy with
 * the very thing it was asked to do. The answer is "no unit", and the app
 * was replacing a working screen with a cable to go and check.
 *
 * A unit the app was talking to a second ago has not been unplugged in the
 * meantime. So a read that follows an order the app gave keeps asking for
 * several seconds before it believes a no — five and a bit, here, which is a
 * long time to wait only in the case where the unit really did go.
 */
export const SETTLING_TRIES = 6
export const SETTLING_MS = 900

/**
 * Whether a failure means the Mac never heard the question.
 *
 * `linkDown` is set by remote.js on anything that did not leave the phone; a
 * request that left and was never answered rejects with the sentence below and
 * carries no flag, and the two mean the same thing here — nobody at the other
 * end. Worth telling apart from a unit that answered "no", because asking a
 * dead line again is a twenty-second timeout each time and the screen cannot
 * say anything true until they are all spent.
 */
export const macSilent = (err) =>
  err?.linkDown === true || /didn’t answer|didn't answer/i.test(err?.message || '')

/**
 * Ask whether the unit is there, and do not take the first no for an answer.
 *
 * "I'm on the FM3. As soon as I hit next or select a scene, it goes to the
 * screen where it says not connected again."
 *
 * Next tells the unit to load a preset and then immediately reads back what is
 * loaded. On real hardware that read lands while the unit is still working —
 * a preset load takes the port for a moment — and the answer that comes back
 * is "no unit". The app believed it: one negative answer, and a working rig
 * became a No unit found screen with the guitar still plugged in.
 *
 * A unit that answered a second ago has almost certainly not been unplugged in
 * the meantime; it is busy doing the thing it was just told to do. So a no is
 * confirmed before it is acted on — but only when there was something to
 * confirm. Nothing was ever live, and the first answer stands, so a genuinely
 * empty rig still says so as fast as it always did.
 *
 * Except from a phone. There the question travels a relay to a Mac whose port
 * is already busy with its own page, and a first no is the least trustworthy
 * answer in the app — see RELAY_TRIES. A rig that really is empty costs a few
 * extra seconds on the phone to say so; a rig that is not costs six taps of
 * Try again without this.
 *
 * Takes its detect and its wait, so the whole policy is tested in node against
 * a fake that never touches a port.
 */
export async function confirmedDetect({
  detect,
  wait,
  wasLive,
  remote = false,
  tries = SETTLE_TRIES,
  relayTries = RELAY_TRIES,
  gap = SETTLE_MS,
  least = 1,
  /*
   * How many times it has now asked, as it asks.
   *
   * The notice a phone gets said the unit was asked five times whatever
   * happened, and how many asks this makes depends on every reason to be
   * patient that applies — so the only honest way to say it is to count.
   * Reported as it goes, so a failure on the third ask still knows it was
   * the third.
   */
  onAsk
}) {
  /*
   * Every reason to keep asking, and the most patient one wins.
   *
   * This used to read `wasLive ? tries : remote ? relayTries : 1`, which hands
   * the fewest asks to the case that needs the most: a phone, on a unit that
   * was answering a moment ago, got three asks over a second and a half —
   * while a phone that had never seen the unit at all got five. The two
   * reasons are not alternatives. A live unit deserves confirming AND a
   * relayed ask is the least trustworthy answer in the app, so a read that is
   * both takes the larger budget, and `least` raises the floor again for a
   * read that follows an order the app itself gave.
   */
  const attempts = Math.max(
    1,
    Math.floor(least) || 1,
    wasLive ? Math.max(1, tries) : 1,
    remote ? Math.max(1, relayTries) : 1
  )
  let info = null
  let failure = null

  for (let i = 0; i < attempts; i++) {
    if (i) await wait(gap)
    onAsk?.(i + 1)
    try {
      info = await detect()
      failure = null
      if (info?.connected) return info
    } catch (err) {
      failure = err
      info = null
      /*
       * A dead line is not a busy port, and this is the difference between a
       * screen that says something true in six seconds and one that says
       * nothing for a minute and a half.
       *
       * The asking exists because a unit answers "no" while it is loading a
       * preset. A Mac that is switched off does not answer at all: every
       * attempt spends its whole timeout, five of them back to back, and for
       * all of that time the screen is still showing what it last knew — a
       * green light, and a notice about a unit — with no way to know it is
       * out of date. One attempt is enough to learn that nobody is there.
       */
      if (macSilent(err)) break
    }
  }

  // Every attempt threw: that is the caller's to report, not a quiet null.
  if (failure) throw failure
  return info
}

/**
 * Why the last chain read failed, or null if it didn't.
 *
 * The read itself answers with a list or a null, which is all a caller needs
 * to draw something — but "the port was busy for a moment" and "there is no
 * port any more" are the same null, and they deserve opposite treatment. One
 * is worth asking again five times; the other is worth stopping.
 */
let lastReadFailure = null

export const chainReadFailure = () => lastReadFailure

export async function refreshBlocks({ reloaded = false } = {}) {
  if (!driver?.presetBlocks) return null
  lastReadFailure = null
  const number = state.preset?.number
  const gen = followGen
  try {
    const list = await driver.presetBlocks()
    if (!Array.isArray(list)) return null
    chainWasRead(number, gen)
    /*
     * A block that changed channel changed its values.
     *
     * The chat's parameter cache is keyed by block, and a value belongs to the
     * block's channel — so after a scene change that moves the amp from C to
     * D, the cached Treble is scene 1's, and the next "brighten it a little"
     * is computed from and labelled with a number scene 2 is not playing.
     * Dropped per block rather than wholesale: re-reading every block down a
     * serial port is the slowest thing this app does, and most scene changes
     * move no channels at all.
     */
    const before = new Map((state.blocks || []).map((b) => [b.effectId, b.channel]))
    for (const b of list) {
      if (before.has(b.effectId) && before.get(b.effectId) !== b.channel) invalidateSchema(b.effectId)
    }
    /* A preset loaded again moves editRev in the same change that puts its
       chain up. Apart, an editor whose block changed channel read once for
       the new chain and again for the new rev — two reads at a unit that has
       just loaded, the first one thrown away. */
    set(reloaded ? { blocks: list, editRev: state.editRev + 1 } : { blocks: list })
    return list
  } catch (err) {
    // The last known chain stays on screen: better than emptying it because
    // one poll lost a race for the port.
    lastReadFailure = err
    return null
  }
}

/**
 * Read the chain, and do not take the first no for an answer.
 *
 * "Now I'm switching seems I keep getting this error message. Couldn't read
 * the chain from the phone... Hitting the try again button always fixes it,
 * but it really shouldn't happen."
 *
 * Right on both counts. This is the same fault confirmedDetect exists for, on
 * a different read: a chain read fired straight after a preset change lands
 * while the unit is still loading that preset, the port is busy, and the read
 * comes back empty. One empty answer became "couldn't read the chain". Try
 * again works because trying again is all that was ever needed — the second
 * ask lands after the unit has finished.
 *
 * The presence check was hardened against exactly this and this read never
 * was, so it kept the old behaviour: one ask, one verdict.
 *
 * Retries cost nothing when the read works, because a good read returns on the
 * first attempt. They only spend time on the case that used to show an error.
 *
 * Takes its read and its wait, so the policy is tested in node against a fake
 * that never touches a port.
 */
export async function confirmedChain({
  read,
  wait,
  remote = false,
  tries = SETTLE_TRIES,
  relayTries = RELAY_TRIES,
  gap = SETTLE_MS,
  /*
   * Whether the last read failed because the unit is not reachable at all.
   *
   * Asking again is for a port that was busy. A Mac that has lost its port
   * answers every ask the same way, instantly, and on a phone each one is a
   * round trip down the relay — so a single tap on a dead link spent five of
   * them before showing anything, and the debug log from a stage is pages of
   * exactly that. Injected so the policy is testable without a port.
   */
  gone = () => chainReadFailure()?.unitGone === true
}) {
  const attempts = remote ? Math.max(1, relayTries) : Math.max(1, tries)
  for (let i = 0; i < attempts; i++) {
    if (i) await wait(gap)
    const list = await read()
    if (Array.isArray(list)) return list
    if (gone()) return null
  }
  return null
}

export async function refreshScene() {
  if (!driver?.getScene) return
  try {
    const res = await driver.getScene()
    const patch = {}
    if (typeof res?.index === 'number' && res.index >= 0) patch.sceneIndex = res.index
    if (Array.isArray(res?.names)) patch.sceneNames = res.names
    set(patch)
  } catch {
    /* a unit without scenes just shows none */
  }
}

export async function refreshTempo() {
  if (!driver?.getTempo) return
  try {
    const res = await driver.getTempo()
    if (typeof res?.bpm === 'number') set({ bpm: res.bpm })
  } catch {
    /* keep the last known value */
  }
}

/**
 * One tap, forwarded to the unit for the unit to make sense of.
 *
 * NOT USED BY THE TAP BUTTON ANY MORE, and the reason is worth keeping where
 * anybody reaching for it will read it. The unit computes the tempo from the
 * spacing between taps as they ARRIVE, and over a network that spacing is the
 * thumb's plus whatever the wifi, the relay and the computer's queue added to
 * each press — different every time. So the unit answered, correctly, with
 * the tempo of something nobody played: "I tap it a few times slowly, it'll
 * send a number and then I'm done tapping and it sends back a different one."
 *
 * The timing is destroyed on the way, so nothing at the far end can recover
 * it. The gaps are measured in the app now and the tempo goes over as a
 * NUMBER — see Gig.jsx and shared/tempo.mjs.
 *
 * This is kept because it is the right call for a unit on the end of a cable
 * in the same room, with no network in between, if that case ever wants it.
 */
export function tapBeat() {
  return driver.tapTempo()
}

export async function refreshSceneNames(number) {
  if (!driver?.readSceneNames) return
  try {
    const found = await driver.readSceneNames(number)
    set({ sceneNames: Array.isArray(found) ? found : NO_NAMES })
  } catch {
    set({ sceneNames: NO_NAMES })
  }
}

/**
 * The LOADED preset's scene names, out of the read the chain has just made.
 *
 * refreshSceneNames asks for /presets/{n}/summary first, which on a gen-3 is
 * the stored slot dumped again from scratch: a second 24KB read of the preset
 * the chain read dumped a moment before. GET /preset/grid hands the names
 * over out of the computer's copy of that first dump, with the name that says
 * whether the copy is this preset at all (see judgeCopy). The summary is asked
 * only when that has nothing — an AM4, whose chain carries no names, or a
 * computer that could not answer — and then once, after the chain.
 *
 * A copy of another preset is neither shown nor kept, and the chain read out
 * of it is read again once that copy has run out.
 */
export async function refreshLoadedSceneNames(number) {
  if (!Number.isInteger(number)) return
  /* Only where the copy is free: on an Axe-Fx II GET /preset/grid is a whole
     second read of the preset, and a gen-1 has no copy at all. */
  if (driver?.presetCopy && hostKeepsCopy() === true) {
    let copy = null
    try {
      copy = await driver.presetCopy()
    } catch {
      copy = null
    }
    if (state.preset?.number !== number) return
    const here = judgeCopy(copy, state.preset?.name)
    if (here === 'stale') {
      copyWasStale(number)
      return
    }
    if (here?.length) {
      /* Named: kept for this slot. All blank: the unit says the scenes are
         unnamed, and a name this browser kept for the slot is shown. */
      if (here.some((n) => n)) {
        driver.keepSceneNames?.(number, here)
        set({ sceneNames: here })
      } else {
        const kept = rememberedNames(number)
        set({ sceneNames: kept.length ? kept : here })
      }
      return
    }
  }
  if (state.preset?.number !== number) return
  await refreshSceneNames(number)
}

/*
 * THE COMPUTER ANSWERED WITH THE LAST SONG: its copy of the preset carries no
 * preset number, and a dump of the one just left can land in it after the
 * next was chosen, or a front-panel change never reaches it. One more read
 * once that copy has certainly run out, and only one — off the preset-change
 * timer, which would hold back every footswitch scene meanwhile. A second
 * mismatch after that is this preset's copy with another name on it (a
 * rename), and the chain stands.
 */
let staleTimer = null
let staleAgain = null
function copyWasStale(number) {
  if (staleAgain === number) return
  chainRead = null
  clock.clearTimeout(staleTimer)
  staleTimer = clock.setTimeout(async () => {
    staleTimer = null
    if (state.preset?.number !== number || presetBusy()) return
    staleAgain = number
    try {
      await readChainAndNames()
    } catch {
      /* each read keeps its own failure */
    } finally {
      staleAgain = null
    }
  }, CHAIN_FRESH_MS + 250)
}

/**
 * Which blocks are on, and on which channel, without reading the chain.
 *
 * A scene moves no block; it only switches them. The small status read says
 * exactly that, where the chain is the whole preset. If the status read
 * cannot be had, the chain is read instead, as it always was.
 */
export async function refreshSceneState() {
  if (!driver?.sceneState) return refreshBlocks()
  /* This read answers for any retry still waiting. */
  clock.clearTimeout(sceneRetryTimer)
  sceneRetryTimer = null
  let states = null
  try {
    states = await driver.sceneState()
  } catch (err) {
    /* Only a computer that cannot answer this read at all gets the chain. A
       read that timed out was most likely a unit busy switching, and a dump
       of the whole preset then is the drop this read exists to avoid. */
    if (err?.status === 404 || err?.status === 501) return refreshBlocks()
    sceneStateSoon()
    return state.blocks
  }
  /* An older computer answers a route it does not have with its web page. */
  if (!Array.isArray(states)) return refreshBlocks()
  if (!states.length) {
    sceneStateSoon()
    return state.blocks
  }
  layStates(states)
  return state.blocks
}

/*
 * THE STATUS READ ONCE MORE, when the unit was too busy to answer it. A scene
 * changes no bypass or channel on screen by itself, so a miss left the last
 * scene's on/off and channels under the new scene's number. The small read
 * again, a moment later — never the chain. A second miss marks the chain as
 * not followed, so the Play screen reads it when it next appears.
 */
export const SCENE_RETRY_MS = 600
let sceneRetryTimer = null
function sceneStateSoon() {
  clock.clearTimeout(sceneRetryTimer)
  const run = presetRun
  sceneRetryTimer = clock.setTimeout(async () => {
    sceneRetryTimer = null
    if (presetBusy() || run !== presetRun) return
    let states = null
    try {
      states = await driver?.sceneState?.()
    } catch {
      states = null
    }
    if (presetBusy() || run !== presetRun) return
    if (Array.isArray(states) && states.length) layStates(states)
    else chainRead = null
  }, SCENE_RETRY_MS)
}

/** A status read, laid over the chain on screen. */
function layStates(states) {
  statusIds = new Set(states.map((s) => s.effectId))
  const byId = new Map(states.map((s) => [s.effectId, s]))
  const before = state.blocks
  let moved = false
  const next = before.map((b) => {
    const s = byId.get(b.effectId)
    if (!s) return b
    const bypassed = s.bypassed ?? b.bypassed
    const channel = s.channel ?? b.channel
    if (bypassed === b.bypassed && channel === b.channel) return b
    /* A value belongs to the block's channel; see refreshBlocks. */
    if (channel !== b.channel) invalidateSchema(b.effectId)
    moved = true
    return { ...b, bypassed, channel }
  })
  if (moved) set({ blocks: next })
}

/* ------------------------------------------------- a preset change, once --- */

/*
 * THE CHAIN AFTER A PRESET CHANGE IS READ ONCE, AND NOT STRAIGHT AWAY.
 *
 * "The preset changes almost immediately on the unit, but after that there is
 * drop in sound, until the android app loads the new page." From this window
 * a preset change was a presence check, the preset, the chain, a dump of the
 * slot for its scene names, then the Play screen noticing a new preset and
 * reading the chain and the slot again, and the announcement reading the
 * chain a third time — all while the unit was loading.
 *
 * Now: the select, which preset, which scene, and after a moment ONE chain
 * read with the names out of it. A further change inside the wait starts the
 * wait again, so three presses of Next are one read of where they ended up.
 */
let presetRun = 0
let presetLoads = 0
let settleTimer = null
let settleWaiting = []
let settleReading = null
/* A scene heard while a settled read was already reading, owed its status read. */
let sceneMissed = false
/* What else the waiting read has been asked to re-check, kept across
   restarts; `names` is whether it reads the scene names too (see
   followPresetNews). */
const settleAlso = { preset: false, scene: false, names: false, reloaded: false }
/* The last chain read, and for which preset. */
let chainRead = null

const presetBusy = () => presetLoads > 0 || settleTimer !== null || settleReading !== null

/** A chain read for this preset has just landed. App's own read calls it too. */
export function chainWasRead(number = state.preset?.number, gen = followGen) {
  chainRead = { number, at: clock.now(), gen }
}

/**
 * Whether a screen that has just appeared needs to read the chain.
 *
 * Not while a preset change is being read — that read is coming — and not
 * when the chain on screen was read for this preset within the time the
 * computer keeps its own copy anyway. The Try again button still reads,
 * because that is somebody asking.
 */
export function chainIsCurrent() {
  if (presetBusy()) return true
  return !!chainRead && chainRead.number === state.preset?.number && clock.now() - chainRead.at < CHAIN_FRESH_MS
}

/**
 * Whether the chain on screen has been FOLLOWED since it was read: read for
 * this preset, and every announcement since has reached this store, which
 * kept it up to date. Its age says nothing about that — the store listens
 * whichever screen is up, so the Play screen appearing a minute after the
 * last read is not a reason to dump the preset. Not after a read that
 * failed, and not across a gap in the event stream.
 */
export function chainFollowed() {
  if (presetBusy()) return true
  return (
    !!stopEvents &&
    !lastReadFailure &&
    !!chainRead &&
    chainRead.number === state.preset?.number &&
    chainRead.gen === followGen
  )
}

/**
 * The chain read a preset change is waiting on, or null when there is none.
 * Resolves with the chain, or null if it could not be read.
 */
export function presetReadPending() {
  if (settleReading) return settleReading
  if (presetLoads > 0 || settleTimer !== null) return new Promise((resolve) => settleWaiting.push(resolve))
  return null
}

function readPresetSoon(wait, { scene = false, preset = false, names = true, reloaded = false } = {}) {
  clock.clearTimeout(settleTimer)
  if (scene) settleAlso.scene = true
  if (preset) settleAlso.preset = true
  if (names) settleAlso.names = true
  if (reloaded) settleAlso.reloaded = true
  const done = new Promise((resolve) => settleWaiting.push(resolve))
  settleTimer = clock.setTimeout(() => {
    settleTimer = null
    const waiting = settleWaiting.splice(0)
    const also = { ...settleAlso }
    settleAlso.preset = false
    settleAlso.scene = false
    settleAlso.names = false
    settleAlso.reloaded = false
    const reading = (async () => {
      let list = null
      const was = state.preset?.number
      const rev = state.editRev
      try {
        if (also.preset) await refreshPresetOnly()
        if (also.scene) await refreshScene()
        /* A scene heard from here on comes after whatever the chain read carries. */
        sceneMissed = false
        /* A preset the unit turned out to have moved to is read whole. */
        const moved = state.preset?.number !== was
        list = await readChainAndNames({ names: also.names || moved, reloaded: also.reloaded || moved })
      } catch {
        /* Each read keeps its own failure; this is only so a timer never
           throws where nobody is listening. */
      }
      /* Once the unit has settled, not the moment it was asked: an editor
         that re-read mid-load would read the preset being left. Carried by
         the chain read when that worked; on its own only when it didn't. */
      if (state.editRev === rev && (also.reloaded || state.preset?.number !== was)) bufferReloaded()
      return list
    })()
    settleReading = reading
    reading.then((list) => {
      /* Only this read's own mark: a newer one may have started meanwhile,
         and this one finishing does not mean that one is done. */
      const mine = settleReading === reading
      if (mine) settleReading = null
      for (const resolve of waiting) resolve(list)
      if (mine && sceneMissed) {
        sceneMissed = false
        followScene()
      }
    })
  }, wait)
  return done
}

/** The one read of a preset: the chain, then the names out of it, then its tempo. */
async function readChainAndNames({ names = true, reloaded = false } = {}) {
  const number = state.preset?.number
  const list = await confirmedChain({
    read: () => refreshBlocks({ reloaded }),
    wait: (ms) => new Promise((go) => clock.setTimeout(go, ms)),
    /* A first no means even less from a phone's browser; see RELAY_TRIES. */
    remote: driver?.isRemote?.() === true
  })
  /* Not after a read that failed: on a gen-3 the names come out of the same
     copy of the preset, which a failed read did not leave, so asking was one
     more dump, and the summary after it another, at a unit still loading. */
  if (names && Array.isArray(list) && state.preset?.number === number) await refreshLoadedSceneNames(number)
  await refreshTempo()
  return list
}

/** GET /preset onto the screen, and what changes with it when it moved. */
async function refreshPresetOnly() {
  if (!driver?.currentPreset) return
  try {
    const fresh = await driver.currentPreset()
    if (!Number.isInteger(fresh?.number) || fresh.number < 0) return
    if (fresh.number !== state.preset?.number) enterPreset(fresh)
    else set({ preset: fresh })
  } catch {
    /* the name on screen stays until the next read */
  }
}

/* A different preset means different blocks, values and scene names. */
function enterPreset(fresh) {
  resetSchemaCache()
  set({ preset: fresh, sceneNames: rememberedNames(fresh.number) })
}

/* What this browser already knows about a slot's scenes, costing the unit nothing. */
function rememberedNames(number) {
  const known = driver?.rememberedSceneNames?.(number)
  return Array.isArray(known) && known.some((n) => (n || '').trim()) ? known : NO_NAMES
}

/** What a select the unit answered with {ok:false} says. */
export const SELECT_REFUSED = "The unit didn't load that preset."

/**
 * Load a preset from this window: the select, which preset, which scene, and
 * ONE chain read a moment later. Resolves once that read is done; throws only
 * when the unit refused the select. `selected` is called the moment the unit
 * has taken it, for whatever the caller keeps about where it has been.
 */
export async function loadPreset(number, { selected } = {}) {
  const run = ++presetRun
  presetLoads += 1
  /* A read still waiting to go is for a preset this tap has just left. */
  clock.clearTimeout(settleTimer)
  settleTimer = null
  const hadStale = staleTimer !== null
  clock.clearTimeout(staleTimer)
  staleTimer = null
  clock.clearTimeout(sceneRetryTimer)
  sceneRetryTimer = null
  const token = echoes.owe('preset')
  let again = false
  try {
    try {
      /*
       * A no is a no whichever way it arrives. The computer answers a select
       * the unit did not take with {ok:false} and a 200, and that was read as
       * a yes: the slot was logged as loaded, and a Revert said it had put
       * the saved preset back with nothing put back at all.
       */
      const res = await driver.selectPreset(number)
      if (res && res.ok === false) throw new Error(SELECT_REFUSED)
    } catch (err) {
      echoes.disown(token)
      /* The preset still loaded may be one whose read this tap called off —
         the settled read, or the one more read the computer's copy of
         another preset was owed. */
      if (run === presetRun) {
        if (settleWaiting.length) readPresetSoon(OWN_SETTLE_MS)
        else if (hadStale && Number.isInteger(state.preset?.number)) copyWasStale(state.preset.number)
      }
      throw err
    }
    echoes.restamp(token)
    /* A chain read owed to the preset just left: this one's read carries it. */
    clock.clearTimeout(gridTimer)
    gridTimer = null
    selected?.()
    /* A newer tap owns the reads from here. */
    if (run !== presetRun) return state.preset
    /*
     * Asked this soon, a unit still loading can answer with the preset it is
     * leaving. That answer is not put over the one just chosen; it is asked
     * again with the chain, once the unit has settled.
     */
    /* Only the slot just chosen is taken from this answer: the preset being
       left, or -1 (the unit too busy loading to say its name in time), is
       asked again once it has settled. */
    try {
      const fresh = await driver.currentPreset()
      if (!(Number.isInteger(fresh?.number) && fresh.number === number)) again = true
      else if (run === presetRun) enterPreset(fresh)
    } catch {
      again = true
    }
    if (run !== presetRun) return state.preset
    await refreshScene()
    if (run !== presetRun) return state.preset
  } finally {
    /* Never below nothing: reset() zeroes it under a load still in the air. */
    presetLoads = Math.max(0, presetLoads - 1)
  }
  await readPresetSoon(OWN_SETTLE_MS, { preset: again, reloaded: true })
  return state.preset
}

/*
 * A SCENE THIS WINDOW DID NOT ASK FOR — a footswitch, the front panel, the
 * phone. The small status read, and "which preset is this", because a preset
 * changed on the unit that opens on a different scene is announced as
 * nothing but that scene. One at a time: a run of presses is one read in the
 * air and one more after it.
 */
let sceneFollowing = null
let sceneAgain = false
async function followScene() {
  if (sceneFollowing) {
    sceneAgain = true
    return sceneFollowing
  }
  sceneFollowing = (async () => {
    /* A preset still being read has its chain read coming, which carries all
       of this; the scene number is already on screen from the event. Unless
       that read is already under way: then it is owed when that is done. */
    if (presetBusy()) {
      if (settleReading) sceneMissed = true
      return
    }
    const run = presetRun
    /* The chain on screen is another preset's, its read having failed:
       this scene's states laid over it would light the wrong song's blocks. */
    if (otherPresetsChain()) {
      chainSoon(() => readChainAndNames())
      return
    }
    await refreshSceneState()
    if (presetBusy() || run !== presetRun) return
    await askUnitsPreset(run)
  })()
  try {
    await sceneFollowing
  } finally {
    sceneFollowing = null
    if (sceneAgain) {
      sceneAgain = false
      followScene()
    }
  }
}

/* ANOTHER CLIENT CHANGED THE PRESET. The name now, which is small; the chain
   once, a moment later. */
async function followPresetNews() {
  const run = presetRun
  if (presetLoads) return
  if (await askUnitsPreset(run, { hostForgot: true })) return
  if (run !== presetRun || presetLoads) return
  /*
   * Asked this soon the unit may still name the preset it is leaving, so the
   * settled read asks again. The same number is not a preset change, and the
   * scene names are not read again: on an AM4 this is the unit's own edit
   * watch — a knob at the front panel, a channel, a save, a rename — and its
   * names come out of a dump of the STORED slot, one more each time, carrying
   * the old names over a rename not yet saved.
   */
  readPresetSoon(PRESET_SETTLE_MS, { preset: true, names: false })
}

async function askUnitsPreset(run, how) {
  if (!driver?.currentPreset) return false
  let fresh = null
  try {
    fresh = await driver.currentPreset()
  } catch {
    return false
  }
  return presetMovedAtUnit(fresh, run, how)
}

/**
 * What the timed presence check heard, for the preset it names.
 *
 * A preset changed on the front panel that opens on the same scene is
 * announced by nothing at all, and this read always knew which preset it was
 * on and threw the answer away.
 */
export function presetHeard(fresh) {
  /* Not while a preset change is settling: a unit still loading can answer
     with the preset it is leaving, and the read to come asks again anyway. */
  if (presetBusy()) return false
  return presetMovedAtUnit(fresh, presetRun)
}

/*
 * THE UNIT IS ON ANOTHER PRESET THAN THE ONE ON SCREEN, and this window did
 * not put it there. The name goes up at once; the chain follows once.
 *
 * `hostForgot` is for a change the computer made itself, which throws away
 * its copy of the chain. One made at the unit's front panel does not reach
 * the computer, so for a quarter of a minute after the last read the computer
 * would answer with the preset just left; the read waits that out rather than
 * putting the last song's blocks under this song's name.
 */
function presetMovedAtUnit(fresh, run, { hostForgot = false } = {}) {
  const number = fresh?.number
  if (run !== presetRun || presetLoads) return false
  if (!Number.isInteger(number) || number < 0 || !state.preset || number === state.preset.number) return false
  presetRun += 1
  enterPreset(fresh)
  clock.clearTimeout(staleTimer)
  staleTimer = null
  clock.clearTimeout(sceneRetryTimer)
  sceneRetryTimer = null
  clock.clearTimeout(gridTimer)
  gridTimer = null
  /* The wait knows only this window's own last read; the read after it checks
     the computer's copy is this preset (judgeCopy), and asks which preset
     again, for a second change at the front panel inside the wait. */
  /* Only where the computer keeps its copy that long (a gen-3); unknown is
     taken as the long one. An Axe-Fx II's lasts half a second, an AM4's a
     couple, and a quarter of a minute there held every footswitch back. */
  const longCopy = hostKeepsCopy() !== false
  const stale = hostForgot || !chainRead || !longCopy ? 0 : chainRead.at + CHAIN_FRESH_MS + 250 - clock.now()
  readPresetSoon(Math.max(PRESET_SETTLE_MS, stale), { scene: true, preset: true, reloaded: true })
  return true
}

/* --------------------------------------------------------------- writes --- */

/**
 * Every write follows the same three steps: show it immediately, send it, and
 * put it back if the device refuses.
 *
 * Optimistic because these are stage controls — a scene button that waits for a
 * serial round trip before it looks pressed reads as a button that didn't work,
 * and gets pressed again.
 */
async function write(field, value, send) {
  const before = state[field]
  set({ [field]: value })
  markLocal(field, value)
  try {
    return await send()
  } catch (err) {
    set({ [field]: before })
    recent.delete(field)
    throw err
  }
}

export function writeScene(index) {
  /* The computer announces this scene straight back; that announcement is
     this tap, not news, and the status read below is the only read it costs.
     A scene moves no block, so it is not a dump of the whole preset. */
  const token = echoes.owe('scene', index)
  return write('sceneIndex', index, async () => {
    let res
    try {
      res = await driver.setScene(index)
    } catch (err) {
      echoes.disown(token)
      throw err
    }
    echoes.restamp(token)
    await refreshSceneState()
    return res
  })
}

export function writeTempo(bpm) {
  return write('bpm', bpm, () => driver.setTempo(bpm))
}

/**
 * Bypass, which is a write into an array rather than to a field.
 *
 * Rolls back to the exact array it started from, not to a recomputed one: a
 * refresh that landed while the write was in flight must not be undone by a
 * failure that has nothing to do with it.
 */
export async function writeBypass(effectId, bypassed) {
  const before = state.blocks
  set({
    blocks: before.map((b) => (b.effectId === effectId ? { ...b, bypassed } : b))
  })
  /*
   * The computer announces a bypass as a change to the chain, which it is
   * not: a block switched on or off has not moved. Read as news, that was a
   * whole preset dump after every effect tap. The tile already shows what was
   * sent, so this costs no read at all.
   */
  const token = echoes.owe('grid')
  try {
    const res = await driver.setBypass(effectId, bypassed)
    echoes.restamp(token)
    return res
  } catch (err) {
    echoes.disown(token)
    if (state.blocks !== before) set({ blocks: before })
    throw err
  }
}

/**
 * The tuner is a mode, not a value: the device answers {ok:false} rather than
 * failing when the attached unit has no tuner path, and a silent refusal looked
 * exactly like a tuner warming up, forever.
 */
export async function writeTuner(on) {
  const before = state.tunerOn
  set({ tunerOn: on, tuning: on ? state.tuning : null })
  try {
    const res = await driver.setTuner(on)
    if (on && res && res.ok === false) {
      set({ tunerOn: false, tuning: null })
      return res
    }
    return res
  } catch (err) {
    set({ tunerOn: before, tuning: null })
    throw err
  }
}

/* --------------------------------------------------------------- plumbing -- */

/** Fields the app owns outright — a read it performed, not a write it made. */
export function put(patch) {
  return set(patch)
}

/** Back to blank. Tests use it; so does losing the device. */
export function reset() {
  recent.clear()
  echoes.clear()
  lastReadFailure = null
  clock.clearTimeout(settleTimer)
  settleTimer = null
  settleWaiting = []
  settleReading = null
  settleAlso.preset = false
  settleAlso.scene = false
  settleAlso.names = false
  settleAlso.reloaded = false
  sceneMissed = false
  presetLoads = 0
  presetRun += 1
  chainRead = null
  clock.clearTimeout(staleTimer)
  staleTimer = null
  staleAgain = null
  clock.clearTimeout(gridTimer)
  gridTimer = null
  clock.clearTimeout(sceneRetryTimer)
  sceneRetryTimer = null
  statusIds = new Set()
  gridSwitched = false
  sceneFollowing = null
  sceneAgain = false
  gridFollowing = null
  gridAgain = false
  stopListening()
  state = BLANK
  for (const listener of [...listeners]) listener()
}

/* ------------------------------------------------------------------ react -- */

const identity = (s) => s

/**
 * Read the store from a component.
 *
 * The selector must return something stable — a field, or a value derived with
 * Object.is-stable parts. Returning a fresh object each call re-renders on
 * every notify, which with a running tuner is several times a second.
 */
export function useDevice(selector = identity) {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(BLANK)
  )
}
