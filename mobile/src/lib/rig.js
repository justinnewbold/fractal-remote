/**
 * What the phone believes about the unit, and the one place it changes.
 *
 * A screen per fact would mean a subscription per screen, and every one of them
 * asking the Mac the same questions — down a serial port that answers one at a
 * time. The gig screen in the web app was built that way once and a single
 * footswitch press produced two full preset dumps.
 *
 * So: one store, one event subscription, and every screen a view over it.
 *
 * Writes here are optimistic and roll back. On stage the difference between a
 * button that responds now and one that responds after a round trip to a Mac in
 * the wings is the difference between usable and not — but a change that the
 * unit then refuses must not be left on screen, because the whole point of this
 * app is that what it shows is what the unit holds.
 */
import { useSyncExternalStore } from 'react'
import { firmwareOf } from './firmware'
import { faultFrom, faultLeft, withdrawsFault } from './fault-rule'

import * as device from './device'
import { idOf, sameBlock } from './unit.mjs'
import { TAP_REREAD_MS, keepTaps, tappedBpm, tempoRange, tempoSender } from './tempo'
import { watchEvery, probeSays, countQuiet, unitGone } from './unit-watch'
import { DEFAULT_SLUG, deviceSlug } from './device-slug'
import { adopt as adoptNames, forget as forgetNames, learn as learnName, nameOf } from './presetNames'
import { forget as forgetControls } from './paramIndex'
import { forgetSceneNames, recallSceneNames, rememberSceneNames, sceneNamesKnown } from './sceneNameCache'
import { subscribeHostSeen, subscribeRemoteEvents, subscribeRemoteState } from './relay'
import { demoUnit, isDemo } from './demo'
import { logDebug } from './debugLog'
import { NO_TEMPO, isUnsupported } from './unsupported'
import {
  CHAIN_FRESH_MS,
  OWN_SETTLE_MS,
  PRESET_SETTLE_MS,
  announcementKind,
  classifyGridNews,
  createOwnEchoes,
  judgeCopy
} from './own-echo'
import { chainActs, chainSwitches, chainView } from './chain-view'
import { OUTLINE_AFTER_MS, READ_AHEAD_ON, aheadChain, createReadAhead, fillOutline, outlineChain } from './chain-outline'
import { blockCatalog } from './blockCatalog'
import { unitByKey } from './demoUnits'

export { CHAIN_FRESH_MS, OWN_ECHO_MS, OWN_SETTLE_MS, PRESET_SETTLE_MS } from './own-echo'
export { OUTLINE_AFTER_MS, READ_AHEAD_MS } from './chain-outline'

const initial = {
  /** null until the unit has said what it is. */
  capabilities: null,
  firmware: null,
  deviceName: '',
  /*
   * Whether the unit is there and answering, as distinct from whether the
   * computer is. 'unknown' until asked; 'missing' when the computer has no
   * unit; 'silent' when it has one that stopped answering (a frozen FM3
   * answers nothing: no preset number, no chain, every read times out);
   * 'present' when it answers. The bar and Setup say this before they say
   * "connected" -- see shared/link-word unitWord.
   */
  unit: 'unknown',
  /*
   * The same unit, as the key its setlists and stars are filed under.
   *
   * Kept beside the name rather than derived at each call site, because the
   * derivation has to match the Mac's exactly — see lib/device-slug, which both
   * apps are handed a copy of. A screen that rolled its own would build a
   * perfectly good setlist in a drawer the Mac never opens.
   *
   * The shared default until the unit has said what it is, and that default is
   * a real bucket rather than null: a unit that answered without naming itself
   * still has setlists worth keeping.
   */
  deviceSlug: DEFAULT_SLUG,
  preset: null,
  /**
   * Names renamed on this phone and not yet saved to a slot: which preset,
   * and what the names were before. See noteSceneName.
   */
  unsaved: null,
  /** What the stage screen draws: everything but the four you never kick. */
  blocks: [],
  /** What the edit screen draws: the chain as the unit reports it, ends and all. */
  allBlocks: [],
  sceneIndex: 0,
  sceneNames: [],
  bpm: null,
  tunerOn: false,
  tuning: null,
  /** 'idle' | 'reading' | 'ok' | 'failed' — a failed read and an empty preset are not the same. */
  chain: 'idle',
  /*
   * Which preset the blocks on screen were read for, and whether a read of
   * the chain is on its way — a wait before one included.
   *
   * The name of a preset picked here goes up on the tap, and its chain a
   * moment later, on purpose (see readPresetSoon). In between, the stage
   * tiles were the last song's and live: a tap switched whatever the new
   * preset has under the same number. These say so, so the screens can draw
   * grey cards instead and the writes below refuse. See lib/chain-view.
   */
  chainFor: null,
  chainBusy: false,
  /*
   * The preset whose chain is on screen from memory rather than from a read:
   * the chain it had the last time it was loaded, put up on the tap (see
   * knownChain). The read after the switch confirms it or replaces it, and
   * until then it is this preset's chain — drawn, and live. null otherwise.
   */
  chainKnown: null,
  /*
   * The preset whose chain on screen is only its outline: the pedals the
   * small status read listed, drawn before the chain read has landed (see
   * drawOutline). Always also chainKnown — it is this preset's, up before its
   * read — and gone with it: whatever puts chainKnown to anything else takes
   * this with it (see set). A tap on one switches it on or off; a channel,
   * a knob or a move waits for the read.
   */
  chainOutline: null,
  error: null,
  /* Whether `error` is a complaint about the link, and so is withdrawn
     when the link comes back. See faultFrom. */
  errorLink: false,
  /* When `error` was raised, so the Play screen can let it go after a while
     (lib/fault-rule faultLeft) without clearing it. */
  faultAt: 0,
  /*
   * Whether what answered is the simulation rather than a rig.
   *
   * Held because the SLUG cannot tell them apart: the demo's FM3 and a real
   * FM3 both answer 'fm3', so leaving the demo with an FM3 plugged in looked
   * to this store like the same unit it already had — and the 512 preset
   * names read off the simulation stayed on screen over the real one's slots.
   */
  simulated: false,
  /*
   * Which load of the edit buffer this is — moved every time the preset is
   * loaded again, the same slot included.
   *
   * The block editor re-reads when its block, channel or scene changes. The
   * same slot chosen again changes none of those and puts every value back,
   * and a different preset with its amp in the same place on the same
   * channel and scene changes none of them either: the knobs went on showing
   * the preset that was. The browser's editor had exactly this after a
   * Revert. See Edit.js, which keys the panel on it.
   */
  bufferRev: 0
}

let state = initial
const subscribers = new Set()

const emit = () => {
  for (const fn of subscribers) fn()
}

export function set(patch) {
  /*
   * A preset change drops a rename that was never saved — on the unit, which
   * throws its edit buffer away, so here too. Caught at the one place every
   * change of preset passes through, whichever route it came by.
   */
  if (patch.preset && state.unsaved && patch.preset.number !== state.unsaved.number) {
    patch = { ...patch, unsaved: null }
    discardUnsaved(state.unsaved)
  }
  /* An outline is a chain up before its read, and goes when that one does. */
  if ('chainKnown' in patch && !('chainOutline' in patch) && patch.chainKnown !== state.chainOutline) {
    patch = { ...patch, chainOutline: null }
  }
  /* Stamped where every fault passes. The same words raised again are news
     again, and get their full time on screen. */
  if (patch.error) patch = { ...patch, faultAt: Date.now() }
  state = { ...state, ...patch }
  emit()
}

export const getState = () => state

/** 'ready', 'updating', 'loading' or 'failed' for the chain on screen; see lib/chain-view. */
export const chainViewOf = (s) =>
  chainView({ want: s.preset?.number, chainFor: s.chainFor, busy: s.chainBusy, known: s.chainKnown, outline: s.chainOutline })
/*
 * Back to nothing: on sign-out, and on the way into or out of the demo.
 *
 * The store is not all there is to put back. A preset read still waiting to
 * go, a status read owed, this phone's own writes waiting for their echo —
 * each of those belongs to the rig that was, and left running it lands on
 * the one that is: a read of the simulation, or a chain marked current that
 * this store has never read. `presetLoads` is left alone on purpose; each
 * load in the air takes itself off it when it finishes, and zeroing it here
 * would leave it at -1 for good.
 */
export function reset() {
  clearTimeout(settleTimer)
  settleTimer = null
  for (const done of settleWaiting.splice(0)) done()
  settleAlso.preset = false
  settleAlso.scene = false
  settleAlso.names = false
  settleAlso.reloaded = false
  bufferOwed = false
  sceneMissed = false
  /* A load, a follow or a settled read still in the air stops at its next check. */
  presetRun += 1
  chainRead = null
  lastRead = null
  earlyNames = null
  knownChains.clear()
  aheadChains.clear()
  ahead.stop()
  clearTimeout(staleTimer)
  staleTimer = null
  staleAgain = null
  clearTimeout(gridTimer)
  gridTimer = null
  clearTimeout(sceneRetryTimer)
  sceneRetryTimer = null
  statusIds = new Set()
  gridSwitched = false
  sceneFollowing = null
  sceneAgain = false
  followGen += 1
  chainWork = 0
  chainEra += 1
  judging = null
  staleOwn = false
  chainForBefore = null
  following = null
  namesRead = null
  clearTimeout(quietTimer)
  quietTimer = null
  pressedAt = 0
  echoes.clear()
  set(initial)
}

/**
 * Put the last failure away.
 *
 * Nothing else clears an error until the next thing goes wrong or the next
 * write succeeds, and on a rig that is working again neither may happen for a
 * song — so the red bar stays above the preset being played, about a read that
 * has since been answered. The ✕ on it comes here.
 */
export const clearError = () => set({ error: null, errorLink: false })

/*
 * "Says I'm not connected to the computer, but it also says I'm connected."
 *
 * Both were drawn from the truth at the time and only one of them had been
 * kept up to date. At launch the relay is not joined yet, the first read
 * throws "Not connected to your computer.", and that sentence goes on the
 * screen — correctly. A second later the channel joins, the bar turns green,
 * the chain arrives, and the note is still sitting under it saying the
 * opposite, with a "what to try" button under THAT, because nothing ever told
 * it the thing it describes had stopped being true.
 *
 * The rule itself is in lib/fault-rule, where node can call it.
 */

/** The link is back, so a complaint about it having gone is over. */
export function clearLinkFault(link = 'connected') {
  if (!withdrawsFault(state, link)) return
  set({ error: null, errorLink: false })
}

function subscribe(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

/**
 * A view over one fact.
 *
 * The selector must be defined outside a component or the store is re-read on
 * every notify — useSyncExternalStore compares the selected value by identity,
 * and a selector rebuilt each render defeats that.
 */
export function useRig(select) {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(state)
  )
}

/* ---------------------------------------------------------------- */
/* Events                                                            */
/* ---------------------------------------------------------------- */

/**
 * Our own writes come back as events. Ignore the echo, follow everything else.
 *
 * Without this a write is applied twice — once optimistically, once when the
 * unit reports it — which is invisible for a scene index and very visible for
 * anything that toggles: the button flickers back and forth as the echo lands.
 */
const ECHO_MS = 1200
const recent = new Map()

export const expect = (field, value) => recent.set(field, { value, at: Date.now() })

function isEcho(field, value) {
  const seen = recent.get(field)
  if (!seen) return false
  if (Date.now() - seen.at > ECHO_MS) {
    recent.delete(field)
    return false
  }
  if (!Object.is(seen.value, value)) return false
  // One echo per write. A second event carrying the same value is the unit
  // saying it again, and the screen should follow it.
  recent.delete(field)
  return true
}

/*
 * A document in the computer's store changed, as the computer announces it.
 *
 * The computer tells every screen the moment something is written to its
 * store, and until now the phone threw that away. A save asked for from here
 * waits on exactly such a write — the computer's answer — so the answer is
 * heard as it lands instead of on the next three-second look. Matched on the
 * document's name, never on who wrote it: both ends write as the same app.
 */
const configWatchers = new Set()
export function onConfigDoc(fn) {
  configWatchers.add(fn)
  return () => configWatchers.delete(fn)
}

/**
 * Everything the unit says while nobody asked.
 *
 * A footswitch press, the front panel, another app — all of it arrives here,
 * and all of it is worth following. This is what makes the phone a view of the
 * unit rather than a record of what the phone last did to it.
 */
export function handleEvent(event) {
  if (!event) return

  if (event.type === 'config' && typeof event.id === 'string') {
    for (const fn of [...configWatchers]) {
      try {
        fn(event.id, event.data)
      } catch {
        // One screen's listener cannot stop the others hearing it.
      }
    }
    return
  }

  if (event.type === 'scene' && typeof event.index === 'number') {
    if (!isEcho('sceneIndex', event.index)) set({ sceneIndex: event.index })
  }

  if (event.type === 'tempo' && typeof event.bpm === 'number') {
    if (!isEcho('bpm', event.bpm)) set({ bpm: event.bpm })
  }

  /*
   * Gated on the tuner actually being open. ForgeFX starts its poll for any
   * client, so an ungated store would re-render every screen holding a reading
   * several times a second with no tuner in sight.
   */
  if ((event.type === 'tuner' || event.note !== undefined) && state.tunerOn) {
    set({ tuning: event })
  }

  /*
   * WHAT AN ANNOUNCEMENT IS ALLOWED TO COST THE UNIT.
   *
   * "The Fractals are set up to have gapless switching of scenes and effects
   * ... the sound should never cut out." And from a tester: "the preset
   * changes almost immediately on the unit, but after that there is drop in
   * sound, until the android app loads the new page."
   *
   * The switch was never the problem; what followed it was. Every scene and
   * every announcement used to ask for the chain, and the chain is the whole
   * preset dumped down the port, about 24KB, landing on a unit that is still
   * in the middle of the switch. So:
   *
   *   - this phone's own scene, bypass and preset writes come back as
   *     announcements, and those are consumed here (see owe). The write that
   *     caused them makes whatever small read it needs itself.
   *   - a scene from the front panel or a foot controller is the small status
   *     read, and a one-line "which preset is this" to catch a preset change
   *     that came with it. No dump.
   *   - a preset changed somewhere else gets ONE chain read, after the unit
   *     has had a moment to finish loading it.
   *   - a "changed the chain" from another client is asked about first with
   *     the small status read. The computer says exactly that about an
   *     effect switched on at the Mac, and reading the chain over it was the
   *     same dump as reading it over this phone's own tap. A block added,
   *     moved, removed or swapped really did change the chain, and still
   *     reads it — once, after the moment the unit needs.
   */
  const kind = announcementKind(event)
  if (!kind) return
  if (ownEcho(kind, kind === 'scene' ? event.index : undefined)) return
  if (chainWrites) {
    chainAsked = true
    return
  }
  if (kind === 'scene') followScene()
  else if (kind === 'preset') followPresetNews()
  else followGridNews()
}

/*
 * THIS PHONE'S OWN WRITES, WAITING FOR THEIR ANNOUNCEMENT.
 *
 * Each scene, bypass and preset write owes one announcement, noted just
 * before it is sent, and the first matching one pays it off. The ledger and
 * its timings are shared with the browser (shared/own-echo.mjs), because the
 * Mac window re-reading the chain after a phone tap is the same dump on the
 * same unit.
 */
const echoes = createOwnEchoes({ now: () => Date.now() })
const owe = (kind, value) => echoes.owe(kind, value)
const restamp = (token) => echoes.restamp(token)
const disown = (token) => echoes.disown(token)
const ownEcho = (kind, value) => echoes.take(kind, value)

/*
 * A SCENE THIS PHONE DID NOT ASK FOR — a footswitch, the front panel, another
 * app. Which blocks are on is the small status read. And it is the only sign
 * the phone gets of a preset changed on the unit itself, because a preset
 * that opens on a different scene is announced as nothing but that scene; so
 * a one-line "which preset is this" goes with it.
 *
 * One at a time: a run of footswitch presses is one read in the air and one
 * more after it, the way refreshBlocks does it.
 */
let sceneFollowing = null
let sceneAgain = false
async function followScene() {
  if (sceneFollowing) {
    sceneAgain = true
    return sceneFollowing
  }
  sceneFollowing = (async () => {
    /* A preset still being read has its chain read coming, which carries
       all of this; the scene number is already on screen from the event.
       Unless that read is already under way, and has read the chain: then
       the scene is owed its status read when it is done. */
    if (presetBusy()) {
      if (settleReads) sceneMissed = true
      return
    }
    const run = presetRun
    /* The tiles are another preset's, because the read after the last preset
       change failed: laying this scene's states over them would light the
       wrong song's blocks, and a tap would switch whatever shares an id. */
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

/*
 * ANOTHER CLIENT CHANGED THE PRESET, or an AM4 marked its own as edited. The
 * name is asked for now, which is small; the chain once, a moment later.
 */
async function followPresetNews() {
  const run = presetRun
  if (presetLoads) return
  if (await askUnitsPreset(run, { hostForgot: true })) return
  if (run !== presetRun || presetLoads) return
  /*
   * Asked this soon the unit may still name the preset it is leaving, so
   * the settled read asks again.
   *
   * The same preset number is not a preset change, and its scene names are
   * not read again. On an AM4 this announcement is the unit's own edit watch
   * — a knob turned at the front panel, a channel, a save, a rename — fired
   * again and again while a knob moves; the names there come out of a dump
   * of the STORED slot, which is one more dump each time, and the old names
   * over a rename that has not been saved.
   *
   * On a unit whose computer keeps a copy of the preset (a gen-3) this news
   * only ever comes from a select, so the same number is the buffer loaded
   * again — a Revert from the other device — and an open editor has to be
   * told. The AM4's is its edit watch, left alone.
   */
  readPresetSoon(PRESET_SETTLE_MS, { preset: true, names: false, reloaded: hostKeepsCopy() === true })
}

/*
 * ANOTHER CLIENT CHANGED THE CHAIN — or says it did. The computer announces an
 * effect switched on at the Mac exactly as it announces a block moved, so the
 * small status read goes first and says which. A switch is laid over the
 * tiles and costs nothing more. Anything else is one chain read, after the
 * moment the unit needs, however many announcements arrive in it. See
 * classifyGridNews.
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
    try {
      states = await device.sceneState()
    } catch {
      states = null
    }
    if (presetBusy()) return
    const news = classifyGridNews(state.allBlocks, states, statusIds, idOf)
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
function chainSoon(read = () => refreshBlocks({ quiet: true })) {
  clearTimeout(gridTimer)
  gridTimer = setTimeout(() => {
    gridTimer = null
    syncChainBusy()
    if (presetBusy()) return
    if (chainWrites) {
      chainAsked = true
      return
    }
    read()
  }, PRESET_SETTLE_MS)
  syncChainBusy()
}

/*
 * WHETHER THE CHAIN IS ON ITS WAY: a read in the air, or a wait before one —
 * a preset change settling, another client's change given its moment, the
 * computer's copy of another preset waited out, or the whole rig being read.
 * Put in the store whenever one of those moves, so the screens can say so.
 * It counts reads; it never makes one.
 */
let chainWork = 0
/* Moved by reset(), so work from before it cannot take one off after it. */
let chainEra = 0
function chainWorking() {
  chainWork += 1
  syncChainBusy()
  const era = chainEra
  return () => {
    if (era !== chainEra) return
    chainWork = Math.max(0, chainWork - 1)
    syncChainBusy()
  }
}
function syncChainBusy() {
  const busy = presetBusy() || (staleTimer !== null && !staleOwn) || gridTimer !== null || !!blocksInFlight || chainWork > 0 || judging !== null
  if (state.chainBusy !== busy) set({ chainBusy: busy })
}

/**
 * Try again, on a preset whose chain never arrived: the read a preset change
 * makes, with the scene names out of the same copy, asked for by somebody.
 */
export async function retryChain() {
  const done = chainWorking()
  try {
    return await readChainAndNames()
  } catch {
    return false
  } finally {
    done()
  }
}

/*
 * Whether the chain on screen was read for another preset than the one on
 * screen: the read after a preset change failed, and the last song's blocks
 * are still up. Not while a preset change is being read (its read is coming)
 * or while the computer's copy is being waited out (see copyWasStale).
 */
const otherPresetsChain = () => !presetBusy() && staleTimer === null && !!chainRead && chainRead.key !== chainKey()

/** GET /preset, and what to do when the answer is not the preset on screen. True when it moved. */
async function askUnitsPreset(run, how) {
  let fresh = null
  try {
    fresh = await device.currentPreset()
  } catch {
    return false
  }
  return presetMovedAtUnit(fresh, run, how)
}

/*
 * WHILE THIS PHONE IS WRITING THE CHAIN, ITS OWN WRITES ARE NOT NEWS.
 *
 * A move is six cell writes, and the unit announces every one; each
 * announcement asked for the chain, and each of those is a preset dump down
 * the same serial port the writes are waiting on. A log showed the read after
 * a move taking thirty seconds, the phone locking its screen while it waited,
 * and the pending write coming back as "your computer didn't answer" — so
 * the move was rolled back: "it just put it right back where it was."
 *
 * So the screen doing the writing says when it starts and when it is done,
 * announcements in between are noted rather than acted on, and the chain is
 * read once at the end — by the writer, which drops the computer's copy first.
 */
let chainWrites = 0
let chainAsked = false
export function beginChainWrite() {
  /* Every add, move and remove comes through here, which is why the mark
     goes here rather than on each of them. */
  noteEdited()
  chainChanged()
  chainWrites += 1
}
export function endChainWrite({ refresh = true } = {}) {
  if (!chainWrites) return
  chainWrites -= 1
  if (chainWrites) return
  const asked = chainAsked
  chainAsked = false
  if (asked && refresh) refreshBlocks({ quiet: true })
  readOnceCopyRunsOut()
}

/*
 * ONE MORE READ ONCE THE COMPUTER'S COPY HAS RUN OUT, after the chain was
 * changed or saved.
 *
 * "After adding the looper … it takes you back to the gig screen but doesn't
 * register the looper, but then if I hit previous or next and go back, then it
 * shows the looper." The computer keeps a fifteen-second copy of the chain,
 * and a read already on its way when a block was placed — the Mac window's
 * own, say — finished after the placement and was kept as the copy. Every read
 * for the next fifteen seconds was the chain from before the looper, and the
 * phone kept the last of those until the preset changed. The computer no
 * longer keeps a read like that (ForgeFX, gen3 grid()); this puts it right on
 * a Mac that has not been updated yet, quietly, once the copy has certainly
 * gone. Not when the preset has moved on, and not while it is being read.
 */
let copyOutTimer = null
function readOnceCopyRunsOut() {
  const number = state.preset?.number
  if (!Number.isInteger(number) || isDemo()) return
  clearTimeout(copyOutTimer)
  copyOutTimer = setTimeout(() => {
    copyOutTimer = null
    if (state.preset?.number !== number || chainWrites || presetBusy()) return
    logDebug('chain', `reading ${number} again now the computer's copy has run out`, '')
    refreshBlocks({ quiet: true }).catch(() => {})
  }, CHAIN_FRESH_MS + 250)
}

let stopEvents = null

/*
 * Which unbroken run of listening this is. Everything the unit announced
 * reached this store while it stays the same, so a chain read in it has been
 * kept up to date since, however long ago it was. The relay going down or
 * coming back, or the computer going quiet, starts a new run: whatever was
 * announced in the gap was lost. See chainFollowed.
 */
let followGen = 0
const gap = () => {
  followGen += 1
}

/** Start the one subscription. Safe to call repeatedly; only the first binds. */
export function listen() {
  if (stopEvents) return stopListening
  gap()
  const offs = [
    subscribeRemoteEvents(handleEvent),
    subscribeRemoteState(gap),
    subscribeHostSeen((up) => {
      if (!up) gap()
    })
  ]
  stopEvents = () => offs.forEach((off) => off())
  return stopListening
}

export function stopListening() {
  if (!stopEvents) return
  const off = stopEvents
  stopEvents = null
  gap()
  off()
  stopWatching()
}

/* ---------------------------------------------------------------- */
/* Is the unit still there?                                          */
/* ---------------------------------------------------------------- */

/*
 * "I purposefully unplugged the FM3 from the computer and it still said
 * connected. I waited a few minutes, went ahead and tried to click some
 * buttons, go to different presets, still said connected, so it's lying."
 *
 * Nothing asked. `unit` was set by refreshAll at the moment of connecting
 * and by whatever reads a screen happened to make after that — and the
 * screens that matter most on stage make none, because everything they draw
 * is already in this store.
 *
 * Pressing buttons could not settle it either. A preset change, a bypass, a
 * scene: those are writes, and a write into a port whose far end has been
 * pulled out does not have to come back as an error. Only an ANSWER proves
 * anybody is home, so this asks for one on a timer — which preset is loaded,
 * the first thing a unit that has gone stops being able to say.
 *
 * refreshPreset already knows that rule (-1 means the computer asked and the
 * unit said nothing) and already sets `unit: 'silent'`, which the top bar
 * already draws in red. Everything needed was here except somebody asking.
 */
let watchTimer = null
/*
 * Which run of the watch this is.
 *
 * A read is in the air for as long as the far end takes, and stopWatching can
 * land in the middle of one. Clearing the timer does not reach that read, so
 * without a generation the tick it belongs to would come back and arm the
 * next one — a watch that carries on after it was stopped, invisibly, and a
 * second watchUnit() would then leave two of them running.
 */
let watchRun = 0

/** Ask about the unit from now on. Safe to call repeatedly. */
export function watchUnit() {
  if (watchTimer) return stopWatching
  const run = ++watchRun
  let quiet = 0
  const tick = async () => {
    watchTimer = null
    let said = 'quiet'
    let heard = null
    const loadRun = presetRun
    try {
      heard = await device.currentPreset()
      said = probeSays({ preset: heard })
    } catch {
      said = probeSays({ failed: true })
    }
    if (run !== watchRun) return
    /*
     * AND WHICH PRESET IT IS, which this read always knew and threw away. A
     * preset changed on the front panel that opens on the same scene is
     * announced by nothing at all, so this is the only thing that notices —
     * the name on screen follows within the half-minute instead of staying on
     * the last song until somebody pulls down. Not while a preset change is
     * settling: a unit still loading can answer with the preset it is
     * leaving, and the read that is coming asks again anyway.
     */
    if (said === 'answering' && state.unit === 'present' && !presetBusy()) presetMovedAtUnit(heard, loadRun)
    /*
     * AND BACK AGAIN, WITHOUT A TAP. "If they do have the fractal software
     * open when they first try to connect and then they close that app, will
     * they have to like refresh or something?" They did: this only ever
     * decided a unit had GONE, and a unit that started answering again — the
     * editor quit, the cable back in — stayed "no unit" until somebody
     * pressed Look for the computer again. An answer after a quiet spell is
     * now the cue to read the whole rig again.
     */
    if (said === 'answering' && (state.unit === 'missing' || state.unit === 'silent')) {
      logDebug('unit', 'the unit is answering again')
      quiet = 0
      try {
        await refreshAll()
      } catch {
        /* refreshAll records its own failure; the next tick tries again. */
      }
      if (run !== watchRun) return
      watchTimer = setTimeout(tick, nextWatch())
      return
    }
    quiet = countQuiet(quiet, said)
    /*
     * One quiet answer is not evidence — the computer asks this same port
     * several times a second and a question that loses that race looks
     * exactly like a unit that has gone. Two in a row is not a race.
     */
    if (unitGone(quiet)) {
      quiet = 0
      if (state.unit !== 'silent' && state.unit !== 'missing') {
        logDebug('unit', 'the unit stopped answering the timed check')
      }
      /* refreshPreset is what decides the word, so it decides it here too
         rather than this reaching into the store with its own opinion. */
      await refreshPreset()
      if (run !== watchRun) return
    }
    watchTimer = setTimeout(tick, nextWatch())
  }
  watchTimer = setTimeout(tick, nextWatch())
  return stopWatching
}

/*
 * Sooner while the unit is missing. The half-minute is for checking a unit
 * that is there is still there; somebody who has just quit FM3-Edit is
 * looking at the screen waiting for it to come back, and ten seconds is the
 * browser's "every few seconds".
 */
const MISSING_WATCH_MS = 10000
const nextWatch = () =>
  state.unit === 'missing' || state.unit === 'silent' ? MISSING_WATCH_MS : watchEvery(true)

export function stopWatching() {
  watchRun += 1
  if (!watchTimer) return
  clearTimeout(watchTimer)
  watchTimer = null
}

/* ---------------------------------------------------------------- */
/* Reads                                                             */
/* ---------------------------------------------------------------- */

/**
 * Ask the unit everything, in the order a screen needs it.
 *
 * Sequential because every one of these travels down the same serial port at
 * the far end; firing them together only queues them somewhere less visible.
 * Capabilities first, because the shape of every other answer depends on what
 * the unit turns out to be.
 */
export async function refreshAll() {
  /* The preset goes up before its chain is read; in between, this is the
     chain on its way rather than another preset's that nobody is reading. */
  const done = chainWorking()
  try {
    await readAll()
  } finally {
    done()
  }
}

async function readAll() {
  const caps = await device.detect()
  const slug = deviceSlug(caps)
  /*
   * A different unit means the names read off the last one are wrong, not
   * merely old. Slot 45 on an FM3 and slot 45 on an AM4 are different presets,
   * and a picker showing one unit's names over the other's slots would send
   * somebody to the wrong song by its right name.
   */
  /*
   * A different unit means the names read off the last one are wrong — and so
   * does the same unit arriving from the other side of the demo switch.
   *
   * "It's also still showing demo presets when I'm no longer in the demo."
   * The demo's FM3 and his FM3 share a slug, so this comparison said nothing
   * had changed and the simulation's names were served over the real rig's
   * slots. They are lazily filled and never re-read wholesale, so nothing
   * later corrected them; signing out was the only thing that cleared them,
   * which is exactly what he had to do.
   */
  const simulated = isDemo()
  if (slug !== state.deviceSlug || simulated !== state.simulated) forgetNames()
  const unit = caps?.connected === false ? 'missing' : 'present'
  /* Over Bluetooth (beta) the answer came through the adapter, not a computer
     (bleWire's detect carries capabilities.via 'bluetooth'). */
  const blue = caps?.capabilities?.via === 'bluetooth'
  if (unit !== state.unit) {
    logDebug(
      'unit',
      blue
        ? unit === 'missing'
          ? 'the unit does not answer through the Bluetooth adapter'
          : 'the unit answers through the Bluetooth adapter'
        : unit === 'missing'
          ? 'the computer has no unit'
          : 'the computer has a unit',
      caps?.short || caps?.name || undefined
    )
  }
  set({
    capabilities: caps?.capabilities ?? null,
    deviceName: caps?.short || caps?.name || '',
    /* Kept rather than dropped on the floor, which is what happened to the
       computer's own version for eighty releases. A unit that does not report
       one leaves this null and the screen draws nothing. */
    firmware: firmwareOf(caps),
    deviceSlug: slug,
    simulated,
    unit,
    /*
     * The old failure is over, because this one worked.
     *
     * "Says I'm not connected but I'm clearly connected based on the green
     * FM3 and connected button." Both were true: the bar reads the live link
     * and was right, and the note reads this field, which no successful read
     * ever cleared. So a message from a minute ago sat over a working rig
     * until the app was signed out. A detect that answers IS the evidence
     * that whatever failed before is no longer failing; anything that fails
     * after this sets its own.
     *
     * NOT ENOUGH ON ITS OWN, as it turned out: this clears the note when a
     * detect SUCCEEDS, and the note he photographed was set by a read that
     * failed a moment after one did — while the relay was still joining. The
     * link coming back is the other half of the same evidence; see
     * clearLinkFault.
     */
    error: null,
    errorLink: false
  })
  /*
   * The preset names, from disk now and from the computer's list when it
   * answers — one small request that never touches the unit, so it is not
   * waited on and not in the port's queue. See presetNames.adopt.
   */
  adoptNames(device.nameOwner(slug)).catch(() => {})
  await refreshPreset()
  await refreshScene()
  await readChainAndNames()
}

/**
 * The chain, and the scene names if nobody has them, and the tempo: the one
 * read of a preset.
 *
 * Shared by the first read of the unit and by every preset change, so the two
 * cannot drift into asking for different things. The tempo is in it because
 * a preset carries its own and nothing announces it: the BPM tile stayed on
 * the last song's once coming back to the stage screen stopped reading it.
 */
async function readChainAndNames({ names = true } = {}) {
  const number = state.preset?.number
  /* The names this phone or the computer already has, before the chain: a
     small read, and the tiles are named while the chain is still coming. */
  const quick = names ? await quickSceneNames() : true
  /* The chain first: it is most of what the stage screen draws, and the scene
     names are the least urgent thing on it. */
  /* Where the copy is judged, the chain is this preset's only once it has
     been: see readBlocks. */
  if (names && hostKeepsCopy() === true && Number.isInteger(number)) {
    judging = number
    syncChainBusy()
  }
  let read = false
  try {
    read = await refreshBlocks()
    /*
     * Nothing more when the chain could not be read. On a gen-3 the names come
     * out of the same copy of the preset, which a failed read did not leave
     * behind, so asking was another dump — and then the summary, a third — at a
     * unit still loading. The next read that works fills them in.
     */
    if (names && read && state.preset?.number === number) {
      /* Whether the copy the chain came out of is this preset at all. */
      const copy = await loadedCopy()
      if (state.preset?.number !== number) return read
      if (copy === 'stale' && copyWasStale(number)) return read
      markJudged(number)
      /* The chain this preset had, for the next time it is chosen. */
      keepChain(number)
      if (copy !== 'stale' && !quick) {
        /* An AM4's over Bluetooth hold the line for seconds: they wait for a quiet moment. */
        if (bluetoothAm4()) namesWhenQuiet(number, copy)
        else await refreshSceneNames(copy)
      }
    }
  } finally {
    if (judging === number) {
      judging = null
      syncChainBusy()
    }
  }
  followComputerNames()
  await refreshTempo()
  return read
}

/*
 * Whether the computer keeps a copy of the loaded preset that a second read
 * costs the unit nothing: a gen-3 (FM3, FM9, Axe-Fx III), whose copy lasts a
 * quarter of a minute. The one family that reports its output meters is the
 * same one, and it is what the computer's report tells them apart by. An
 * Axe-Fx II keeps its copy for half a second, and GET /preset/grid there is a
 * whole second read of the preset; a gen-1 has no copy at all. null while
 * the unit has not said what it is.
 */
function hostKeepsCopy() {
  if (isDemo()) return true
  if (!state.capabilities) return null
  return state.capabilities.meters?.outputLevels === true
}

/*
 * judgeCopy's answer for the loaded preset, asking only where the copy is
 * free. A name this phone has not learned yet (a slot tapped before its
 * name was known) is not a blank name, and cannot say either way.
 */
async function loadedCopy() {
  if (hostKeepsCopy() !== true) return null
  return judgeCopy(await device.presetCopy(), state.preset?.pending ? undefined : state.preset?.name)
}

/*
 * THE COMPUTER ANSWERED WITH THE LAST SONG. Its copy of the preset is a
 * quarter of a minute long and carries no preset number: a dump of the preset
 * just left can land in it after the next one was chosen, and a preset changed
 * at the front panel never reaches it. So the chain just read is not this
 * preset's, and the names in it are not either — those are not shown or kept,
 * because kept names are what every later load puts on the tiles.
 *
 * One more read once the copy has certainly run out, and only one. Not on the
 * preset-change timer: that would hold back every footswitch scene for
 * fifteen seconds. True when that read is now coming.
 */
let staleTimer = null
let staleAgain = null
/*
 * Whether the copy found stale is of this preset's own chain — already up as
 * this preset's before the read, as after a rename in Settings. That was
 * taken for the last song's, and the stage tiles went grey for fifteen
 * seconds and refused every tap. The one more read still goes; the chain
 * stays up and live meanwhile.
 */
let staleOwn = false
/* What the chain on screen was for just before the last read put it up. */
let chainForBefore = null
/* The preset whose chain came out of a copy not yet judged; see readBlocks. */
let judging = null
function markJudged(n) {
  if (judging !== n) return
  judging = null
  /* The chain up from memory waited for the read to be judged; this is it. */
  if (state.chainKnown === n && lastRead?.key === keyFor(n)) {
    const patch = { allBlocks: lastRead.all, blocks: device.stageBlocks(lastRead.all), chainFor: n, chainKnown: null }
    /* And the load it carries, in the same change: apart, an open panel
       remounted for the chain and again for the load. See readBlocks. */
    if (bufferOwed) {
      bufferOwed = false
      patch.bufferRev = state.bufferRev + 1
    }
    set(patch)
  } else set({ chainFor: n })
  syncChainBusy()
}
function copyWasStale(number) {
  if (staleAgain === number) {
    /* The second time, after the copy had certainly run out: that copy is this
       preset's and the names differ for some other reason, a rename perhaps.
       The chain stands; the names come from elsewhere. */
    logDebug('chain', `the computer's copy of ${number} still carries another name; keeping the chain`)
    set({ chain: 'ok' })
    return false
  }
  logDebug('chain', `the computer's copy of the preset was not ${number}; reading it again once that copy runs out`)
  chainRead = null
  /* The blocks just read came out of that copy too: the last song's — unless
     they were already up as this one's, and it is this one's with its old name. */
  staleOwn = chainForBefore === number
  set(staleOwn ? { chain: 'reading' } : { chain: 'reading', chainFor: null })
  clearTimeout(staleTimer)
  staleTimer = setTimeout(async () => {
    staleTimer = null
    syncChainBusy()
    if (state.preset?.number !== number || presetBusy()) return
    staleAgain = number
    try {
      await readChainAndNames()
    } catch {
      /* each read records its own failure */
    } finally {
      staleAgain = null
    }
  }, CHAIN_FRESH_MS + 250)
  syncChainBusy()
  return true
}

/*
 * WHETHER THE STAGE SCREEN NEEDS TO READ THE UNIT WHEN IT APPEARS.
 *
 * It read everything every time it was shown — back from the preset list,
 * back from Settings — and the preset list is where a preset change comes
 * from, so the rig was already reading the new preset when the screen came
 * back and asked for all of it again, plus a dump of the slot for its scene
 * names: two or three preset dumps landing on a unit that was still loading.
 *
 * Not needed while a preset change is being read, or when the chain on screen
 * was read for this same preset within the time the computer keeps its own
 * copy anyway. Pulling down still reads everything, because that is somebody
 * asking.
 */
let chainRead = null
/* Which unit, which side of the demo switch, which slot: slot 97 on an AM4 is not slot 97 on an FM3. */
const keyFor = (number) => `${isDemo() ? `demo:${demoUnit()}` : 'rig'}:${state.deviceSlug}:${number}`
const chainKey = () => keyFor(state.preset?.number)

/*
 * THE CHAIN EACH PRESET HAD, the last time it was loaded here.
 *
 * "Presets are loading much slower now when switching, taking about 3
 * seconds to load scene name and pedals." The grey cards stand in for a
 * chain nobody has read yet — right for a preset never seen, and a wait for
 * nothing on one played a song ago, whose chain was on screen then. So the
 * chain read straight after a preset is loaded — the slot as stored, nothing
 * edited yet — is kept for that slot, and a tap on it puts it up at once as
 * this preset's (chainKnown). The one read after the switch still goes, at
 * the same moment it always did, and whatever it finds replaces it.
 *
 * Kept for this run of the app only, and not for a chain that was edited:
 * a read made while this preset has unsaved changes is not kept, a change
 * this app makes to the chain's structure forgets it (chainChanged), and so
 * does a save over the slot. Another client's save is not heard of here; the
 * read after the switch is what puts that right.
 */
const KNOWN_CHAINS_MAX = 128
const knownChains = new Map()
/* The last chain read: which key it was read for, and what came back. */
let lastRead = null

function keepChain(number) {
  if (!Number.isInteger(number) || number < 0) return
  if (!lastRead || lastRead.key !== keyFor(number)) return
  if (state.unsaved && state.unsaved.number === number) return
  knownChains.delete(lastRead.key)
  knownChains.set(lastRead.key, lastRead.all.map((b) => ({ ...b })))
  while (knownChains.size > KNOWN_CHAINS_MAX) knownChains.delete(knownChains.keys().next().value)
}

function knownChain(number) {
  if (!Number.isInteger(number) || number < 0) return null
  return knownChains.get(keyFor(number)) || null
}

function forgetChain(number) {
  if (!Number.isInteger(number)) return
  knownChains.delete(keyFor(number))
  aheadChains.delete(keyFor(number))
  if (state.chainKnown === number) set({ chainKnown: null })
}

/*
 * THE PRESETS EITHER SIDE — the slots Previous and Next would land on, read
 * once the unit is quiet and kept like the chains above, so a tap on one puts
 * its pedals up at once. See lib/chain-outline (shared/chain-outline.mjs), the
 * browser's own. Play says which slots those are (readAhead).
 */
const aheadChains = new Map()
const ahead = createReadAhead({
  read: async (n) => aheadChain(await device.presetSummary(n), n, blockCatalog),
  /* Off: reading another slot moved the computer's idea of the loaded one — see READ_AHEAD_ON. */
  has: (n) =>
    !READ_AHEAD_ON || !outlinesHere() || n === state.preset?.number || knownChains.has(keyFor(n)) || aheadChains.has(keyFor(n)),
  keep: (n, list) => {
    const key = keyFor(n)
    aheadChains.delete(key)
    aheadChains.set(key, list)
    while (aheadChains.size > KNOWN_CHAINS_MAX) aheadChains.delete(aheadChains.keys().next().value)
  },
  ready: () => !presetBusy() && state.chain !== 'reading' && !state.tunerOn,
  wait: (go, ms) => setTimeout(go, ms),
  clear: (timer) => clearTimeout(timer)
})

/** Where Previous and Next would land now, for their pedals to be read ahead. */
export function readAhead(numbers) {
  ahead.want(numbers)
}

/**
 * This app has just changed the loaded preset's structure — a block added,
 * moved or removed, a model changed or put back. The chain kept for it is
 * the slot as stored; forgotten anyway, so no tap can put up a chain this
 * app has seen go out of date.
 */
export function chainChanged() {
  forgetChain(state.preset?.number)
}

export function chainIsCurrent() {
  /* A store that has read nothing — just after a reset — has nothing current. */
  if (!state.preset) return false
  if (presetBusy()) return true
  return !!chainRead && chainRead.key === chainKey() && Date.now() - chainRead.at < CHAIN_FRESH_MS
}

/*
 * Whether the chain on screen has been FOLLOWED since it was read: read for
 * this preset, and every announcement since has reached this store, which
 * has kept it up to date — the scenes, the switches, another client's
 * changes. Its age says nothing about that. The store listens across every
 * screen, so coming back to the stage screen from Settings or a setlist a
 * minute later is not a reason to dump the preset over a song.
 *
 * Not after the read failed, and not across a gap in listening (see
 * followGen), when announcements may have been lost.
 */
export function chainFollowed() {
  if (!state.preset) return false
  if (presetBusy()) return true
  return (
    !!stopEvents &&
    !!chainRead &&
    chainRead.key === chainKey() &&
    chainRead.gen === followGen &&
    state.chain !== 'failed'
  )
}

/**
 * What the stage screen appearing costs. True when it needs nothing more:
 * the chain was read a moment ago, or has been followed since (then one
 * "which preset is this", for a preset changed at the front panel that
 * nothing announced; the timed check would find it too, only later). False
 * when it has to read everything.
 */
export async function arrivedCurrent() {
  if (chainIsCurrent()) return true
  if (!chainFollowed()) return false
  await askUnitsPreset(presetRun)
  return true
}

/**
 * A rename this phone just made, taken as true without asking.
 *
 * "Renaming a preset doesn't work, just goes right back to the original
 * name." It did not go back: the write landed, and the read that followed it
 * came back out of the computer's cache with the old name, which then
 * overwrote the new one on screen. The write is better evidence than any
 * read, so it is what the screen and the name list are told. And the name
 * the next Save carries is this one — the computer renames the preset to
 * whatever the save request says, so a stale name here would have undone
 * the rename on the way into the slot.
 */
export function notePresetName(name) {
  const preset = state.preset
  if (!preset || typeof name !== 'string') return
  const unsaved = pendingFor(preset.number)
  if (unsaved && unsaved.presetName === null) unsaved.presetName = preset.name || ''
  set({ preset: { ...preset, name }, unsaved })
  if (Number.isInteger(preset.number)) learnName(preset.number, name)
}

/**
 * The same for a scene: on the tiles now, and kept on this phone so the
 * tiles still say it after a trip to another screen.
 *
 * NOT KEPT FOR GOOD UNTIL IT IS SAVED. "I renamed two scenes, then switched
 * to a different preset without saving, and when I went back it still showed
 * those names." The unit had dropped them with its edit buffer; the phone
 * had written them to its disk and to the computer's store as if they were
 * the preset's. So a rename is pending: what the names were is remembered,
 * a preset change puts them back (see set), and only a save that succeeds
 * sends them to the computer's store, where every phone reads them from.
 */
export function noteSceneName(index, name) {
  if (!Number.isInteger(index) || index < 0 || typeof name !== 'string') return
  const names = [...(state.sceneNames || [])]
  while (names.length <= index) names.push('')
  names[index] = name
  const number = state.preset?.number
  const unsaved = pendingFor(number)
  set({ sceneNames: names, unsaved })
  const slug = state.deviceSlug
  if (!Number.isInteger(number) || !slug) return
  rememberSceneNames(device.nameOwner(slug), number, names)
}

/**
 * Something changed on this preset that a save would keep.
 *
 * "The save button is visible and able to be clicked even though there's
 * nothing that I change and nothing to save. Can we set that to only show up
 * after a parameter has been changed?"
 *
 * There was already a flag for this and it only knew about NAMES — a renamed
 * preset or scene, because those are the two the phone has to remember for
 * itself in order to put them back. A moved knob needs no remembering: the
 * unit is holding it and drops it at the next preset change, all by itself.
 * So nothing marked the preset as touched when the thing that touched it was
 * a knob, and the Save button had no way to know whether there was anything
 * to save.
 *
 * This is that mark, and it deliberately shares the one record. A save writes
 * the unit's whole edit buffer, so knobs and names are not two kinds of
 * unsaved work with two kinds of button — they are one question, "is there
 * anything here that dies at the next preset change", and one answer.
 *
 * WHAT COUNTS is anything that ends up in the edit buffer: a parameter, a
 * bypass, a channel, a model, a chain move, a modifier, a tempo, a name.
 * What does NOT count is changing scene or preset, or turning the tuner on —
 * those move you around the rig rather than altering it.
 */
export function noteEdited() {
  const number = state.preset?.number
  if (!Number.isInteger(number)) return
  const unsaved = pendingFor(number)
  /* Over Bluetooth (beta) nothing can be saved, so nothing is left unsaved:
     a Save button there would be one that cannot work. */
  if (state.capabilities?.via === 'bluetooth') return
  /* Already marked: the record is the same object, and setting it again
     would re-render every screen watching it on every knob of a drag. */
  if (unsaved === state.unsaved) return
  set({ unsaved })
}

/** The pending record for this preset, started from what the names are now. */
function pendingFor(number) {
  if (!Number.isInteger(number)) return state.unsaved
  if (state.unsaved && state.unsaved.number === number) return state.unsaved
  return { number, sceneNames: [...(state.sceneNames || [])], presetName: null }
}

/** The preset moved on without a save: the names go back to what they were. */
function discardUnsaved(unsaved) {
  const slug = state.deviceSlug
  if (!unsaved || !slug) return
  /* A slot that had no names before the rename gets none back — remembering
     eight blanks writes nothing, which would have left the renamed ones. */
  if (!rememberSceneNames(device.nameOwner(slug), unsaved.number, unsaved.sceneNames)) {
    forgetSceneNames(device.nameOwner(slug), unsaved.number)
  }
  if (typeof unsaved.presetName === 'string') learnName(unsaved.number, unsaved.presetName)
}

/** A save landed in `slot`: what was pending there is the preset's now. */
/* What was kept for the slot is what it held before this save: forgotten. */
export function savedToSlot(slot) {
  forgetChain(slot)
  /* The gig screen comes back after a save: what it shows is read fresh. */
  if (slot === state.preset?.number) readOnceCopyRunsOut()
  const unsaved = state.unsaved
  if (!unsaved || unsaved.number !== slot) return
  const slug = state.deviceSlug
  if (slug) device.keepSceneNames(slug, slot, state.sceneNames)
  set({ unsaved: null })
}

export async function refreshPreset() {
  try {
    takePreset(await device.currentPreset())
  } catch (err) {
    /* The unit watch asks this on a timer: the same fault again, while it is
       still on screen, is not news, and raising it again would bring the
       toast back every few seconds. Once it has gone, the same fault later
       is a new outage, and is said. */
    const fault = faultFrom(err)
    if (fault.error === state.error && fault.errorLink === state.errorLink && faultLeft(state, Date.now()) > 0) return
    set(fault)
  }
}

/** What GET /preset said, onto the screen, with the unit's word to go with it. */
function takePreset(fresh) {
  /* A name this phone renamed and has not saved outranks the read: the
     read can come out of the computer's copy from before the rename, and
     the next Save carries whatever name is here. */
  const pending = state.unsaved
  if (fresh && pending && pending.number === fresh.number && typeof pending.presetName === 'string') {
    fresh.name = state.preset?.name ?? fresh.name
  }
  /*
   * A preset number of -1 is the computer saying the unit did not answer
   * its own name -- the first thing a frozen unit stops doing. Said on the
   * bar as "unit not answering" rather than a slot -1 under a green word.
   */
  const answered = Number.isInteger(fresh?.number) && fresh.number >= 0
  if (fresh?.number === -1 && state.unit !== 'silent') {
    logDebug('unit', viaBluetooth() ? 'the unit did not answer through the Bluetooth adapter' : 'the unit did not answer the computer', 'no preset number')
  }
  if (answered && state.unit === 'silent') logDebug('unit', 'the unit is answering again')
  set({ preset: fresh, ...(fresh?.number === -1 ? { unit: 'silent' } : answered && state.unit !== 'missing' ? { unit: 'present' } : {}) })
}

export async function refreshScene() {
  try {
    const res = await device.getScene()
    const index = typeof res === 'number' ? res : res?.index
    if (Number.isInteger(index)) set({ sceneIndex: index })
    /*
     * Some units hand the names over with the scene. A gen-3 does not — see
     * device.sceneNames, which is why the tiles were numbered squares.
     */
    if (Array.isArray(res?.names) && res.names.some((n) => (n || '').trim())) {
      set({ sceneNames: res.names })
    }
  } catch {
    // A unit that won't report its scene still gets buttons; it just starts on
    // the one the app last saw rather than pretending to know.
  }
}

/**
 * How long a tempo this phone just set on the unit outranks a read of it.
 *
 * "After doing tap tempo, if I go to the edit screen and then go back to the
 * main screen, the tap tempo doesn't save." It had saved — on the unit. The
 * main screen re-reads everything when it appears, and the computer answers
 * a tempo read out of the preset copy it took for the chain, which is good
 * for fifteen seconds and was taken before the taps. So the old figure came
 * back onto the button over the one the unit was actually playing.
 *
 * A tempo the phone set — by tapping or by typing — is therefore held for a
 * while: a read that disagrees inside this window is the stale copy, not
 * news. Longer than the copy lives, and short enough that a tempo changed at
 * the front panel is followed within the minute.
 */
export const TEMPO_KEEP_MS = 20 * 1000
let tempoSetAt = 0
const tempoJustSet = () => Date.now() - tempoSetAt < TEMPO_KEEP_MS

export async function refreshTempo() {
  try {
    const res = await device.getTempo()
    const bpm = typeof res === 'number' ? res : res?.bpm
    if (!Number.isFinite(bpm)) return
    if (tempoJustSet() && Number.isFinite(state.bpm) && bpm !== state.bpm) return
    set({ bpm })
  } catch {
    // Tempo is a nice-to-have on this screen; its absence is not a fault worth
    // a banner over a preset someone is about to play.
  }
}

/**
 * Re-read the chain.
 *
 * A read that fell over and a preset with nothing in it used to look the same:
 * no buttons, no explanation. They are not the same, and the difference matters
 * most where you can't see the unit.
 */
/**
 * The LOADED preset's scene names, from the read the chain has just made.
 *
 * This used to ask for /presets/{n}/summary, which on a gen-3 is the stored
 * slot dumped again from scratch — a second 24KB read of the preset the chain
 * read had dumped a moment before, and it went out on every preset change and
 * every return to the stage screen, while the unit was loading. The names are
 * in that first dump, and the computer keeps it: GET /preset/grid hands them
 * over out of its copy, with the name that says the copy is this preset.
 *
 * The summary is only asked when that has nothing (an AM4, whose chain read
 * carries no names, or a computer that could not answer), and then once. An
 * AM4's own read of the slot comes last, as it always did.
 *
 * `copy` is judgeCopy's answer when the caller has just asked for it.
 *
 * null when nothing could be read, or the computer's copy is another preset;
 * a list, possibly all blank, when the unit answered.
 */
async function namesOfLoaded(number, copy) {
  const here = copy === undefined ? await loadedCopy() : copy
  if (state.preset?.number !== number) return null
  if (here === 'stale') {
    copyWasStale(number)
    return null
  }
  if (here?.length) return here
  /* An AM4 over Bluetooth has no summary to give: its names are read whole,
     straight off the unit (lib/bleWire am4SceneNames). */
  if (!bluetoothAm4()) {
    const summary = await device.sceneNames(number)
    if (summary.length || state.preset?.number !== number) return summary
  }
  return device.unitSceneNames(number)
}

/* Whether the unit is reached over Bluetooth (beta): no computer, no computer's store.
   Read off the capabilities, as noteEdited does, so the bench can say so too. */
const viaBluetooth = () => state.capabilities?.via === 'bluetooth'
/* An AM4 over Bluetooth, whose names are slow to read. */
const bluetoothAm4 = () => viaBluetooth() && state.deviceSlug === 'am4'

/**
 * What this preset's scenes are called, when the unit did not volunteer them.
 *
 * Its own read because it belongs to the PRESET rather than to the scene: it is
 * worth doing once when a preset loads and not again when somebody steps
 * between scenes with a footswitch. Never fails a screen — a unit with no scene
 * names gets numbered tiles, which is what it had before.
 */
/*
 * One read of a preset's scene names at a time: a second pass over the same
 * preset (both out of the one chain read together, refreshBlocks handing the
 * second the first's promise) waits on the first instead of asking again. On
 * an AM4 a read is a whole stored preset, four seconds of the line over
 * Bluetooth, so two at once was eight.
 */
let namesRead = null
export async function refreshSceneNames(copy) {
  const number = state.preset?.number
  if (!Number.isInteger(number)) return
  const key = keyFor(number)
  if (namesRead?.key === key) return namesRead.done
  const done = readNamesOf(number, copy)
  namesRead = { key, done }
  try {
    await done
  } finally {
    if (namesRead?.done === done) namesRead = null
  }
}

async function readNamesOf(number, copy) {
  const names = await namesOfLoaded(number, copy)
  /* Over Bluetooth, a slot read and found unnamed is written down too, so
     it is not read again after the next reconnect. */
  if (Array.isArray(names) && names.length && !names.some((n) => n) && viaBluetooth() && state.preset?.number === number) {
    rememberSceneNames(device.nameOwner(state.deviceSlug), number, names, { blank: true })
  }
  /* Still the same preset: a slow read that lands after the next tap would
     otherwise put the last song's names on this song's tiles. */
  if (!names?.some((n) => n) || state.preset?.number !== number) return
  set({ sceneNames: names })
  /* Read the slow way once; never again on this phone, and not on the next
     device either. */
  const slug = state.deviceSlug
  rememberSceneNames(device.nameOwner(slug), number, names)
  device.keepSceneNames(slug, number, names)
}

/**
 * READ THEM AGAIN, NOW, whatever is remembered.
 *
 * "The presets have a way to refresh — have a way to refresh them." Names are
 * kept once read, on this phone and on the computer, which is what makes a
 * preset change instant — and what makes a wrong or missing copy stick. This
 * goes past both to the unit, and writes what it finds over them.
 *
 * 'found' with names, 'none' when the unit answered and every scene is
 * unnamed, 'failed' when nothing could be read (an older computer app, a unit
 * that did not answer). Only a real answer replaces what is on the tiles.
 */
export async function rereadSceneNames() {
  const number = state.preset?.number
  if (!Number.isInteger(number)) return 'failed'
  device.freshSceneNames?.()
  const names = await namesOfLoaded(number)
  if (names === null || state.preset?.number !== number) return 'failed'
  if (!names.some((n) => n)) return 'none'
  set({ sceneNames: names })
  const slug = state.deviceSlug
  rememberSceneNames(device.nameOwner(slug), number, names)
  device.keepSceneNames(slug, number, names)
  logDebug('scenes', `re-read the scene names for ${number} off the unit`)
  return 'found'
}

/**
 * The scene names without asking the unit: this phone's disk first, then the
 * computer's store. True when the computer had them, in which case the dump
 * is not needed at all.
 *
 * "When you switch preset, it takes about 5 to 10 seconds for the scene names
 * to load." That was the summary read, a preset dump, queued behind the chain
 * read, another dump. Names hardly ever change, so what was read last time
 * goes on the tiles at once and the slow read only runs when nobody has them.
 */
export async function quickSceneNames() {
  const number = state.preset?.number
  if (!Number.isInteger(number)) return false
  /* A unit that handed the names over with the scene has already answered,
     and fresher than any copy: nothing to fetch and no dump to run. */
  /* Not the ones this phone put up on the tap: those are its own copy, and
     the computer's store is still asked. */
  if (state.sceneNames !== earlyNames && (state.sceneNames || []).some((n) => (n || '').trim())) return true
  const slug = state.deviceSlug
  const owner = device.nameOwner(slug)
  const kept = await recallSceneNames(owner, number)
  if (kept.length && state.preset?.number === number) set({ sceneNames: kept })
  /*
   * Over Bluetooth there is no computer's store to ask, and what this phone
   * kept IS the record. "It doesn't have to constantly be rereading them once
   * it reads them once, it can go off the remembered names unless they hit
   * refresh." A preset whose names are kept is not read again.
   */
  if (viaBluetooth()) return (kept.length > 0 || (await sceneNamesKnown(owner, number))) && state.preset?.number === number
  let held = null
  try {
    held = await device.storedSceneNames(slug, number)
  } catch {
    held = null
  }
  if (!held || state.preset?.number !== number) return false
  set({ sceneNames: held })
  rememberSceneNames(owner, number, held)
  return true
}

/**
 * AND AGAIN IN A MOMENT, when the computer is still reading them.
 *
 * "It's not showing the scene names." On an AM4 the phone cannot read them at
 * all: they are only in a full preset dump, which the host will not run for a
 * phone. The computer app can, and does, the moment the preset changes — then
 * files them where the phone looks (storedSceneNames). But that dump takes a
 * few seconds, and the phone looked once, straight away, found nothing, and
 * never looked again: numbered tiles for a preset whose scenes were named on
 * the unit's own screen.
 *
 * So, while the tiles have no names and this is still the preset, the
 * computer's store is asked again a few times. One small read each, no unit
 * involved, and it stops the moment names arrive or the preset changes.
 */
export const COMPUTER_NAMES_AFTER_MS = [4000, 9000, 18000]

const named = () => (state.sceneNames || []).some((n) => (n || '').trim())

/* The preset change whose names are being followed, and when its last ask is due. */
let following = null

/*
 * AN AM4'S SCENE NAMES OVER BLUETOOTH WAIT FOR A QUIET MOMENT.
 *
 * Reading them is the whole stored preset, about four seconds of the line,
 * and nothing else is sent to an AM4 while it comes — so a press made then
 * waits for the end of it. Straight after landing on a preset is exactly when
 * the next press comes: in his log, two taps and a Next within three seconds
 * of the song changing. So the first read of a preset's names waits until
 * nothing has been pressed for AM4_NAMES_QUIET_MS, and is dropped if the
 * preset changes first. Refresh names does not wait: it was asked for.
 */
export const AM4_NAMES_QUIET_MS = 5000
let pressedAt = 0
let quietTimer = null
const pressed = () => {
  pressedAt = Date.now()
}

function namesWhenQuiet(number, copy) {
  clearTimeout(quietTimer)
  const check = () => {
    quietTimer = null
    if (state.preset?.number !== number || named() || !bluetoothAm4()) return
    /* Not while tuning either: four seconds of a frozen needle mid-string. */
    const wait = state.tunerOn ? AM4_NAMES_QUIET_MS : pressedAt + AM4_NAMES_QUIET_MS - Date.now()
    if (wait > 0) {
      quietTimer = setTimeout(check, wait)
      return
    }
    refreshSceneNames(copy).catch(() => {})
  }
  quietTimer = setTimeout(check, Math.max(AM4_NAMES_QUIET_MS - (Date.now() - pressedAt), 0))
}

function followComputerNames() {
  const number = state.preset?.number
  /* Over Bluetooth there is no computer to have them: every ask was refused. */
  if (viaBluetooth()) return
  if (!Number.isInteger(number) || named()) return
  /* Two passes over one preset change (the settled read, and a pull-down
     landing meanwhile) are one follow, not two sets of asks in one millisecond. */
  const key = `${presetRun}:${keyFor(number)}`
  if (following?.key === key && Date.now() < following.until) return
  following = { key, until: Date.now() + COMPUTER_NAMES_AFTER_MS[COMPUTER_NAMES_AFTER_MS.length - 1] }
  for (const wait of COMPUTER_NAMES_AFTER_MS) {
    setTimeout(async () => {
      if (state.preset?.number !== number || named()) return
      const slug = state.deviceSlug
      let held = null
      try {
        held = await device.storedSceneNames(slug, number)
      } catch {
        held = null
      }
      if (!held || state.preset?.number !== number || named()) return
      set({ sceneNames: held })
      rememberSceneNames(device.nameOwner(slug), number, held)
      logDebug('scenes', `the computer had the scene names for ${number} after ${wait / 1000}s`)
    }, wait)
  }
}

export async function refreshBlocks({ quiet = false } = {}) {
  /*
   * ONE READ AT A TIME, HOWEVER MANY TIMES WE ARE ASKED — and this is the
   * reason the whole app felt slow.
   *
   * "App is very laggy especially on the set list screen." The log said why,
   * and it was nothing to do with setlists:
   *
   *   23:02:50.187 [wire] GET /preset/blocks — 2878ms
   *   23:02:50.748 [wire] GET /preset/blocks — 3123ms
   *   23:03:00.265 [wire] GET /preset/blocks — 3219ms
   *
   * Three of the same slow read, two of them half a second apart. The unit
   * emits an event per change, `handleEvent` asked for the chain on each one,
   * and every one of those asks is a preset dump down a serial port with a
   * relay in front of it — one at a time, in a queue. A preset change that
   * fires six events puts twenty seconds of reading in front of the next thing
   * anybody presses, on any screen. That is what "laggy" was.
   *
   * So: while one is in flight, another ask does not queue. It notes that the
   * answer now on its way is already out of date and asks ONE more time when
   * that lands — once, no matter how many asks arrived meanwhile. The last read
   * is still the true one, which is the only thing that has to stay true.
   */
  if (blocksInFlight) {
    blocksAgain = true
    return blocksInFlight
  }
  blocksInFlight = readBlocks(quiet)
  syncChainBusy()
  try {
    return await blocksInFlight
  } finally {
    blocksInFlight = null
    syncChainBusy()
    if (blocksAgain) {
      blocksAgain = false
      /* Quiet: the chain on screen is a moment old, not missing, and flipping
         it to 'reading' would blank a row of buttons somebody is aiming at. */
      refreshBlocks({ quiet: true })
    }
  }
}

/** Whether a chain read is on the wire, and whether one more is owed after it. */
let blocksInFlight = null
let blocksAgain = false
/* The preset was loaded again, and the next chain that lands carries the new
   bufferRev with it — one change, so an open panel remounts once, not twice. */
let bufferOwed = false

async function readBlocks(quiet) {
  /* A chain up from memory is this preset's already; the read confirms it quietly. */
  if (!quiet && state.chainKnown !== state.preset?.number) set({ chain: 'reading' })
  const key = chainKey()
  /* Which preset these are, for the screens: see chainViewOf. */
  const number = state.preset?.number
  try {
    /*
     * One read, two lists. The unit is asked once — it is a slow read and the
     * relay is one channel — and each screen is handed the blocks it is for.
     * See device.presetBlocks for why the two differ.
     */
    const gen = followGen
    const all = await device.presetBlocks()
    chainRead = { key, at: Date.now(), gen }
    lastRead = { key, all }
    /* Not while the copy they came out of is still to be judged, or is being
       waited out as another preset's: up at once, they were the last song's
       tiles, live, under this song's name for a whole round trip. */
    const held = judging === number || (staleTimer !== null && !staleOwn)
    /*
     * And never over a chain up from memory, by a read that may not be its
     * preset's: one for the preset this phone has since left, or one whose
     * copy is still to be judged. The known chain stays until a read that is
     * this preset's replaces it (see markJudged).
     */
    const known = state.chainKnown
    if (Number.isInteger(known) && known === state.preset?.number && state.chainFor === known && (held || number !== known)) {
      if (number === known) chainForBefore = state.chainFor
      set({ chain: 'ok' })
      return true
    }
    const patch = { allBlocks: all, blocks: device.stageBlocks(all), chain: 'ok' }
    if (!held) {
      patch.chainFor = Number.isInteger(number) ? number : null
      patch.chainKnown = null
    }
    if (bufferOwed) {
      bufferOwed = false
      patch.bufferRev = state.bufferRev + 1
    }
    chainForBefore = state.chainFor
    set(patch)
    return true
  } catch (err) {
    // The last chain stays on screen. It is the best thing anyone knows, and a
    // row of buttons vanishing mid-song is worse than a row that is a moment
    // out of date and says so.
    /* Said in the log as well as on screen: "Chain — out of date" and the
       note under it used to be the only record that this read failed. */
    logDebug('chain', 'the chain could not be read — buttons kept from the last read', err.message)
    /* Not a chain up from memory, though: unconfirmed, it is not kept up as
       this preset's past a read that could not say so. The cards, and a way
       to ask again, as for a preset never read. */
    const unconfirmed = state.chainKnown === number && state.preset?.number === number
    set({ chain: 'failed', ...faultFrom(err), ...(unconfirmed ? { chainKnown: null, chainFor: null } : {}) })
    return false
  }
}

/* ---------------------------------------------------------------- */
/* Writes                                                            */
/* ---------------------------------------------------------------- */

/**
 * Show it, send it, and put it back if the unit says no.
 *
 * `revert` is captured before the optimistic change rather than rebuilt after
 * the failure: rebuilding it re-derives from a state that has already moved,
 * which is how a refused bypass once restored a chain that never existed.
 */
async function optimistic(patch, revert, send) {
  pressed()
  set({ ...patch, error: null, errorLink: false })
  try {
    await send()
    return true
  } catch (err) {
    set({ ...revert, ...faultFrom(err) })
    return false
  }
}

export function writeScene(index) {
  const was = state.sceneIndex
  expect('sceneIndex', index)
  /* The computer announces this scene straight back; that announcement is
     this tap, not news, and the read below is the only one it costs. */
  const token = owe('scene', index)
  return optimistic({ sceneIndex: index }, { sceneIndex: was }, async () => {
    try {
      await device.setScene(index)
    } catch (err) {
      disown(token)
      throw err
    }
    restamp(token)
    /* The tiles are the last preset's, its read having failed: the new
       scene's states laid over them would light the wrong song's blocks. */
    if (otherPresetsChain()) {
      chainSoon(() => readChainAndNames())
      return
    }
    // Bypass states belong to the scene, so the chain on screen is about the
    // one we just left until this comes back. A scene moves no block, so this
    // is the small status read, not a dump of the whole preset -- see
    // device.sceneState for what the dump did here.
    await refreshSceneState()
  })
}

/**
 * Re-read each block's bypass and channel and lay them over the chain on
 * screen. Falls back to the full read only when the computer cannot answer
 * the small one at all, so an older Mac still gets the right picture, just
 * slower.
 *
 * NOT when the unit simply did not answer it in time. That happens most while
 * the unit is busy switching, and turning the one small read into a dump of
 * the whole preset at that moment is the drop this read exists to avoid. The
 * tiles keep what was sent; the next status read puts them right.
 */
export async function refreshSceneState() {
  /* This read answers for any retry still waiting. */
  clearTimeout(sceneRetryTimer)
  sceneRetryTimer = null
  let states = null
  try {
    states = await device.sceneState()
  } catch (err) {
    if (err?.status === 404 || err?.status === 501) return refreshBlocks({ quiet: true })
    logDebug('chain', 'scene state could not be read; asking once more in a moment', err?.message)
    sceneStateSoon()
    return false
  }
  /* An older computer, which answered with its web page. */
  if (states === null) return refreshBlocks({ quiet: true })
  if (!states.length) {
    sceneStateSoon()
    return false
  }
  layStates(states)
  return true
}

/*
 * THE STATUS READ ONCE MORE, when the unit was too busy to answer it.
 *
 * A scene tap never changes a bypass or a channel on screen by itself, so a
 * status read that missed left the last scene's on/off and channels under
 * the new scene's number until the next scene or a pull-down. The small read
 * again, a moment later when the switch is done — never the chain. A second
 * miss marks the chain as not followed, so the stage screen reads it when it
 * next appears.
 */
export const SCENE_RETRY_MS = 600
let sceneRetryTimer = null
function sceneStateSoon() {
  clearTimeout(sceneRetryTimer)
  const run = presetRun
  sceneRetryTimer = setTimeout(async () => {
    sceneRetryTimer = null
    if (presetBusy() || run !== presetRun) return
    let states = null
    try {
      states = await device.sceneState()
    } catch {
      states = null
    }
    if (presetBusy() || run !== presetRun) return
    if (Array.isArray(states) && states.length) layStates(states)
    else chainRead = null
  }, SCENE_RETRY_MS)
}

/** A status read, laid over both lists. */
function layStates(states) {
  statusIds = new Set(states.map((s) => s.effectId))
  const byId = new Map(states.map((s) => [s.effectId, s]))
  const lay = (b) => {
    const s = byId.get(idOf(b))
    return s ? { ...b, bypassed: s.bypassed ?? b.bypassed, channel: s.channel ?? b.channel } : b
  }
  set({ blocks: state.blocks.map(lay), allBlocks: state.allBlocks.map(lay) })
}

/*
 * Both lists move together, because they are one chain seen by two screens.
 * Toggling a drive on the stage screen and then opening it on the edit screen
 * must not show it still engaged.
 */
const patchBlock = (id, patch) => ({
  blocks: state.blocks.map((b) => (sameBlock(b, id) ? { ...b, ...patch } : b)),
  allBlocks: state.allBlocks.map((b) => (sameBlock(b, id) ? { ...b, ...patch } : b))
})

const asWas = () => ({ blocks: state.blocks, allBlocks: state.allBlocks })

/*
 * Not from a tile drawn for another preset. The screens stop drawing those
 * the moment a preset is picked, but a tap already on its way used to land
 * and switch whatever block the NEW preset has under that number. Nothing is
 * sent, and nothing is marked as edited.
 */
const notThisChain = () => !chainActs(chainViewOf(state))
/*
 * A switch on or off may come from an outline's tiles too: their effect ids
 * are this preset's own, out of its own status read (see drawOutline). Only
 * an id the chain on screen holds, though, whichever chain that is — a tap
 * from the last song's tile, still on its way when this song's pedals went
 * up, is not one of this preset's.
 */
const notSwitchable = (id) => !chainSwitches(chainViewOf(state)) || !state.allBlocks.some((b) => sameBlock(b, id))

export function writeBypass(id, bypassed) {
  if (notSwitchable(id)) return Promise.resolve(false)
  const was = asWas()
  noteEdited()
  /*
   * The computer announces a bypass as a change to the chain, which it is
   * not: a block switched on or off has not moved. Read as news, that was a
   * whole preset dump after every effect tap, while the unit was switching.
   * The tile is already showing what was sent, so this costs no read at all.
   */
  const token = owe('grid')
  return optimistic(patchBlock(id, { bypassed }), was, async () => {
    try {
      await device.setBypass(id, bypassed)
    } catch (err) {
      disown(token)
      throw err
    }
    restamp(token)
  })
}

export function writeChannel(id, channel) {
  if (notThisChain()) return Promise.resolve(false)
  const was = asWas()
  noteEdited()
  return optimistic(patchBlock(id, { channel }), was, () => device.setChannel(id, channel))
}

/**
 * One tap of the tempo.
 *
 * Nothing optimistic here and nothing expected back: a tap is not a statement
 * about where the tempo should end up, it is one beat among several, and the
 * unit works out the BPM from the spacing. The number on screen follows what
 * the unit reports rather than anything this app computed.
 */
/**
 * One tap, and the number that follows it.
 *
 * THE TAP GOES NOW; THE READ-BACK WAITS FOR THE BURST TO END. The unit works
 * the tempo out from the SPACING between taps, so a tap held back by a debounce
 * is a different rhythm, not a late one. And the figure can only be read once
 * tapping has stopped — reading mid-burst answers with the tempo of the taps
 * before this one and puts a stale number on the button still under your thumb.
 *
 * WHY THE PHONE NEEDS THIS AND THE BROWSER GOT AWAY WITHOUT IT FOR LONGER.
 * There is a `tempo` event, and the phone was relying on it entirely: tap, and
 * wait to be told. Over the relay that event is not reliably carried — the same
 * filtering that keeps the tuner's readings at the Mac — so the unit's tempo
 * changed and the screen did not. "Tap tempo isn't changing on the phone screen,
 * but it does update the unit."
 *
 * The event still works where it arrives; this just stops the screen depending
 * on it. The delay is shared with the browser so the two cannot drift.
 */
let reread = null

/** The read after a burst of taps: the tempo the unit settled on, held from then. */
async function readTappedTempo() {
  tempoSetAt = 0
  await refreshTempo()
  tempoSetAt = Date.now()
}

/* When each tap happened, so the tempo they mean can be shown at once rather
   than waited for. Module-level beside `reread` because a burst of taps is one
   rhythm however many screens come and go during it. */
let taps = []
/* Which preset they were tapped on: another song starts another count. */
let tapsOn = null

/*
 * What crosses the network is the NUMBER, not the taps.
 *
 * "Right now after I tap it a few times slowly, it'll send a number and then
 * I'm done tapping and it sends back a different one."
 *
 * Because every press was forwarded as a tap — POST /tempo/tap — and the unit
 * worked the tempo out from the spacing between them AS THEY ARRIVED. That is
 * the thumb's spacing plus whatever the wifi, the relay server and the
 * computer's own queue added to each press, differently each time, and the
 * further apart the taps the more of it accumulates. The unit then reported,
 * correctly, the tempo of what it had actually heard.
 *
 * Nothing at the far end can undo that; the timing is gone by the time it
 * arrives. The only clock that knows the rhythm is the one in the hand. So
 * the gaps are measured here and the answer is SET, with the same call a
 * typed tempo uses. See shared/tempo.mjs.
 *
 * One write in the air at a time, newest number wins — a burst of taps must
 * not queue five writes and have the last one land after the read-back.
 */
const sendTempo = tempoSender(
  (bpm) => device.setTempo(bpm),
  (err) => set(faultFrom(isUnsupported(err) ? { message: NO_TEMPO } : err))
)

export async function tapTempo() {
  pressed()
  clearTimeout(reread)
  /* A unit that has said it has no tempo the app can set: say so, send nothing. */
  if (device.refusedAlready('POST', '/tempo')) {
    set(faultFrom({ message: NO_TEMPO }))
    return false
  }
  /*
   * WHAT THE TAPS MEAN, SHOWN NOW AND SENT NOW.
   *
   * "It should change the tempo based on the tap and change the number
   * immediately … you can't even tell the tempo you're tapping at."
   *
   * tempoSetAt is stamped so the ordinary stale-read guard protects this the
   * same way it protects a typed tempo. readTappedTempo clears it deliberately,
   * which is how the unit's own answer gets to win a moment later — and now
   * that answer is the number this sent, so it agrees.
   */
  /* The unit's own range: an AM4 refuses past 250, and a mis-tap is not a tempo. */
  const range = tempoRange(state.deviceSlug, state.capabilities?.via)
  /* "Press Next by accident, then one tap" sent the new song 200, worked out
     from the last song's taps. A new preset is a new count. */
  const on = chainKey()
  if (on !== tapsOn) {
    taps = []
    tapsOn = on
  }
  taps = keepTaps(taps, Date.now(), range)
  const guess = tappedBpm(taps, range)
  if (guess != null) {
    /* The tempo lives in the preset, so a tap is a change to it — and a save
       that dropped the tempo somebody just set would be a save that lied. */
    noteEdited()
    set({ bpm: guess })
    tempoSetAt = Date.now()
    expect('bpm', guess)
    sendTempo.push(guess)
  }
  /* The read after the burst confirms what the unit ended up on. It waits for
     the last write to land, or it answers about the one before it. */
  reread = setTimeout(function settle() {
    if (!sendTempo.idle) {
      reread = setTimeout(settle, TAP_REREAD_MS)
      return
    }
    readTappedTempo()
  }, TAP_REREAD_MS)
  return true
}

export function writeTempo(bpm) {
  const was = state.bpm
  noteEdited()
  expect('bpm', bpm)
  tempoSetAt = Date.now()
  return optimistic({ bpm }, { bpm: was }, () =>
    device.setTempo(bpm).catch((err) => {
      throw isUnsupported(err) ? Object.assign(new Error(NO_TEMPO), { status: 501 }) : err
    })
  )
}

/*
 * The demo's tuner, which on a phone was a needle that never moved.
 *
 * "Demo tuner animations." The simulation has had a proper tuner in it the
 * whole time — lib/tunerStream, which holds a note for the life of a ring and
 * only picks a new string coming out of a quiet gap, because a real detector
 * cannot hop mid-note. The browser subscribes to it and animates.
 *
 * The phone never did. Its readings arrive as events off the relay, and in
 * the demo there is no relay to carry them — so the tuner opened, the timer
 * ran, and nothing ever reached the needle. Which is the one screen in the
 * app where "nothing happens" and "it is broken" look identical.
 *
 * So in the demo the phone drives the same stream itself, at the same 400ms
 * the browser polls it, straight into the same handleEvent every real reading
 * goes through. Nothing downstream can tell the difference, which is the
 * point: the tuner screen is being demonstrated, not a second copy of it.
 */
let tunerTimer = null

function stopDemoTuner() {
  if (!tunerTimer) return
  clearInterval(tunerTimer)
  tunerTimer = null
}

function startDemoTuner() {
  stopDemoTuner()
  const source = device.demoTuner?.()
  if (!source) return
  tunerTimer = setInterval(() => handleEvent(source.next()), 400)
}

/**
 * Turn the tuner on or off.
 *
 * The flag goes down before the request, not after: a tuner the unit refuses to
 * start must not leave a screen waiting for readings that are never coming.
 */
export async function writeTuner(on) {
  pressed()
  set({ tunerOn: on, tuning: on ? state.tuning : null, error: null, errorLink: false })
  if (!on) stopDemoTuner()
  try {
    await device.setTuner(on)
    /* Only once the unit has agreed, and only in the demo — on a real rig the
       readings come off the relay and a second source would fight them. */
    if (on) startDemoTuner()
    return true
  } catch (err) {
    stopDemoTuner()
    set({ tunerOn: false, tuning: null, ...faultFrom(err) })
    return false
  }
}

/**
 * Load another slot.
 *
 * Everything about the preset changes, so everything is re-read rather than
 * patched — including the name, which is the one thing on this screen read from
 * arm's length.
 */
/**
 * Load a stored slot, and show it before the unit has finished saying so.
 *
 * "When tapping a preset there is about a 2 second delay before it highlights
 * it and goes back to the main screen."
 *
 * It waited for the lot: the select, then the preset, the scene, the scene
 * names and the whole chain — six round trips, two of them among the SLOW reads
 * that make the unit dump a preset over serial. Only then did anything move. A
 * control that waits that long before acknowledging a press reads as a control
 * that did not register it, which is how a preset gets loaded twice.
 *
 * So it is optimistic, like every other write in this file. The new slot is on
 * screen on the press; the reads that confirm it happen behind that. If the
 * unit refuses the select, the old preset goes back — captured before the
 * change rather than rebuilt after the failure, for the reason `optimistic`
 * gives above.
 *
 * THE NAME COMES FROM WHAT HAS ALREADY BEEN READ. The picker has it — it is
 * drawn on the row somebody just tapped — and lib/presetNames is where it is
 * kept, so this looks there rather than taking it as an argument. When nothing
 * is known, `pending` says so and the screen shows the slot rather than
 * inventing "Untitled" for the one round trip it takes to find out.
 */
export async function loadPreset(number) {
  pressed()
  const was = state.preset
  /*
   * The control index is about the preset that was loaded, not this one. Slot
   * 45's Presence is not slot 46's, and a search box answering from the last
   * preset sends somebody to a control that is not there.
   */
  forgetControls()
  const known = nameOf(number)
  /*
   * This preset's chain as it was the last time it was loaded, if it has
   * been: up now, as this preset's, rather than grey cards for as long as the
   * unit takes to settle and the read to come back. Not for the same slot
   * chosen again — a Revert — whose chain is on screen already and is being
   * put back to the stored one. See knownChain.
   */
  const recall = number !== was?.number ? knownChain(number) : null
  /* Never played here, but read ahead as the next or the last slot: its pedals, as an outline. */
  const readFirst = !recall && number !== was?.number ? aheadChains.get(keyFor(number)) || null : null
  ahead.nudge()
  const wasChain = {
    allBlocks: state.allBlocks,
    blocks: state.blocks,
    chainFor: state.chainFor,
    chainKnown: state.chainKnown,
    chainOutline: state.chainOutline
  }
  /*
   * The scene names go with it too. They belong to the preset being left, so
   * carrying them across would put the last song's names on this song's tiles —
   * which is worse than the numbers, because numbers are never wrong.
   */
  set({
    error: null,
    errorLink: false,
    chain: recall || readFirst ? 'ok' : 'reading',
    sceneNames: [],
    /* The same slot tapped twice keeps whatever it has; another has nothing known unless recalled. */
    ...(recall
      ? { allBlocks: recall, blocks: device.stageBlocks(recall), chainFor: number, chainKnown: number }
      : readFirst
        ? {
            allBlocks: readFirst.map((b) => ({ ...b })),
            blocks: device.stageBlocks(readFirst.map((b) => ({ ...b }))),
            chainFor: number,
            chainKnown: number,
            chainOutline: number
          }
        : number === was?.number
        ? {}
        : { chainKnown: null }),
    preset: {
      number,
      name: typeof known === 'string' ? known : '',
      empty: false,
      pending: typeof known !== 'string'
    }
  })
  const run = ++presetRun
  namesAtOnce(number, run)
  presetLoads += 1
  /* A read still waiting to go is for a preset this tap has just left. */
  clearTimeout(settleTimer)
  settleTimer = null
  const hadStale = staleTimer !== null
  clearTimeout(staleTimer)
  staleTimer = null
  clearTimeout(sceneRetryTimer)
  sceneRetryTimer = null
  syncChainBusy()
  const token = owe('preset')
  /* When the unit was asked: the wait before the chain read counts from here. */
  const sentAt = Date.now()
  try {
    try {
      await device.selectPreset(number)
    } catch (err) {
      disown(token)
      /* Only the newest tap decides what is on screen. */
      if (run === presetRun) {
        /* The chain that was up goes back with the preset it belongs to —
           and what it was: up from memory, or only the outline. */
        set(recall || readFirst ? wasChain : { chainKnown: wasChain.chainKnown, chainOutline: wasChain.chainOutline })
        set({ ...faultFrom(err), chain: 'ok', preset: was })
        /* The preset put back may be one whose read this tap called off —
           the settled read, or the one more read the computer's copy of
           another preset was owed (which puts 'reading' back up). */
        if (settleWaiting.length) readPresetSoon(OWN_SETTLE_MS)
        else if (hadStale && Number.isInteger(was?.number)) copyWasStale(was.number)
      }
      return false
    }
    restamp(token)
    /* A chain read owed to the preset just left: this one's read carries it. */
    clearTimeout(gridTimer)
    gridTimer = null
    syncChainBusy()
    /*
     * NO CACHE DROP HERE ANY MORE. This sent DELETE /device/cache first, to
     * make the computer forget a fifteen-second copy of "which preset is
     * loaded". The device server keeps no such copy — its preset read goes to
     * the unit every time, and choosing a preset already throws its copy of
     * the chain away — and that DELETE is something else entirely: it deletes
     * the saved profile of the unit. One more request in the pile after every
     * preset change, doing the wrong thing.
     *
     * And a newer tap owns the reads from here: three presses of Next are one
     * read of the preset landed on, not one of each slot passed on the way.
     */
    if (run !== presetRun) return true
    /*
     * Asked this soon, a unit still loading can answer with the preset it
     * is leaving. That answer is not put over the one just chosen; it is
     * asked again with the chain, once the unit has settled, and whatever
     * the unit says then is what the screen says.
     */
    /*
     * Only the slot just chosen is taken from this answer. The preset being
     * left, or -1 (the unit too busy loading to say its name in time), or no
     * answer at all is asked again once the unit has settled — and a -1 that
     * is still there then is what the bar reports.
     */
    let again = false
    try {
      const fresh = await device.currentPreset()
      if (!(Number.isInteger(fresh?.number) && fresh.number === number)) again = true
      else if (run === presetRun) takePreset(fresh)
    } catch {
      again = true
    }
    if (run !== presetRun) return true
    if (again) settleAlso.preset = true
    await refreshScene()
    if (run !== presetRun) return true
    /* The pedals, from one small read, while the chain read waits for the
       unit. Only for a preset whose chain nothing on screen knows yet, and
       only once the unit has said it is on it. See drawOutline. */
    /* Never past the moment the chain read is due: a status read the relay
       lost holds nothing up, and one that lands late is still drawn if the
       chain has not beaten it there. */
    if (!recall && !again && number !== was?.number) {
      await Promise.race([drawOutline(number, run, sentAt), new Promise((go) => setTimeout(go, settleFrom(sentAt)))])
    }
    if (run !== presetRun) return true
    /* What is already known about this slot's scenes, at once — off this
       phone and the computer's store, not the unit. See quickSceneNames. */
    await quickSceneNames()
  } finally {
    presetLoads -= 1
    syncChainBusy()
  }
  await readPresetSoon(settleFrom(sentAt), { reloaded: true })
  return true
}

/*
 * THE WAIT BEFORE THE CHAIN READ, COUNTED FROM THE SELECT.
 *
 * The unit starts loading when it is asked, not when the phone has finished
 * asking it which preset and which scene. Counted from the end of those, the
 * wait was OWN_SETTLE_MS on top of three round trips down the relay — most
 * of the three seconds on the play test. Counted from the select, the small
 * reads happen inside it, and the one chain read still lands on a unit that
 * has had the whole wait to settle.
 */
const settleFrom = (sentAt) => Math.max(0, OWN_SETTLE_MS - (Date.now() - sentAt))

/*
 * THE PEDALS FIRST, THE CHAIN AFTER. "Is there any way to pull like the label
 * in the pedal outline or something real fast first before it actually pulls
 * the rest of the info from the device."
 *
 * A preset never seen here had grey cards until the one chain read — a whole
 * preset dump, on purpose not asked for until the unit has settled. The status
 * read is not a dump: every placed block's effect id, bypass and channel,
 * about forty bytes, the same read a scene tap makes. An id is enough to name
 * and colour a tile, so the tiles go up from it a moment after the select,
 * in the order chains usually run (lib/chain-outline), dimmed a little. The
 * chain read still goes when it always did, and replaces them.
 *
 * Only where the ids are the catalog's — a gen-3 on a rig, a grid unit in the
 * demo — and only for the tap that is still the newest, on the preset the unit
 * has said it is on. Nothing is put up for a read that failed, came back
 * empty, or listed nothing a stage draws: the cards stay, as they did.
 */
const outlinesHere = () => hostKeepsCopy() === true && (!isDemo() || !!unitByKey(demoUnit())?.grid)

async function drawOutline(number, run, sentAt) {
  if (!outlinesHere()) return
  const wait = OUTLINE_AFTER_MS - (Date.now() - sentAt)
  if (wait > 0) await new Promise((go) => setTimeout(go, wait))
  /* Whose chain is up may have been settled meanwhile: a newer tap, or a read. */
  /* And only while the read after the switch is still to come: drawn after
     it, an outline would be left standing with nothing to replace it. */
  /* Pedals read ahead are up already, with no states: the status read still fills those in. */
  const stillWanted = () =>
    run === presetRun &&
    presetBusy() &&
    state.preset?.number === number &&
    (state.chainFor !== number || state.chainOutline === number)
  if (!stillWanted()) return
  let states = null
  try {
    states = await device.sceneState()
  } catch (err) {
    logDebug('chain', 'the pedals could not be listed ahead of the chain', err?.message)
    return
  }
  if (!stillWanted()) return
  /* Over pedals read ahead, their order and names stay: see fillOutline. */
  const all =
    state.chainFor === number && state.chainOutline === number
      ? fillOutline(state.allBlocks, states, blockCatalog)
      : outlineChain(states, blockCatalog)
  const blocks = all ? device.stageBlocks(all) : []
  if (!blocks.length) return
  statusIds = new Set(states.map((s) => s?.effectId))
  set({ allBlocks: all, blocks, chain: 'ok', chainFor: number, chainKnown: number, chainOutline: number })
}

/*
 * The scene names this phone kept for the slot, on the tap — before the
 * select has gone, let alone been answered. What the computer's store and the
 * unit say later still goes over them (see quickSceneNames, which knows these
 * by `earlyNames` and asks anyway).
 */
let earlyNames = null
function namesAtOnce(number, run) {
  const owner = device.nameOwner(state.deviceSlug)
  recallSceneNames(owner, number)
    .then((kept) => {
      if (run !== presetRun || state.preset?.number !== number || !kept.length) return
      if ((state.sceneNames || []).some((n) => (n || '').trim())) return
      earlyNames = kept
      set({ sceneNames: kept })
    })
    .catch(() => {})
}

/* ---------------------------------------------------------------- */
/* A preset change, read once                                        */
/* ---------------------------------------------------------------- */

/*
 * THE CHAIN AFTER A PRESET CHANGE IS READ ONCE, AND NOT STRAIGHT AWAY.
 *
 * "The preset changes almost immediately on the unit, but after that there is
 * drop in sound, until the android app loads the new page." That drop was the
 * reading: fourteen requests in the first few seconds after a tap, two or
 * three of them whole preset dumps, all landing while the unit was loading
 * the preset from memory.
 *
 * So the chain read waits for the unit to settle, and a further change inside
 * the wait starts the wait again — however many presses of Next, one read of
 * where they ended up. The name and the scene are already on screen by then;
 * it is the row of blocks that follows a moment later.
 *
 * Longer for a change made somewhere else: the phone hears of it late, and it
 * is somebody else's change to finish.
 */

/** Which preset change is the newest, and how many loads from this phone are in the air. */
let presetRun = 0
let presetLoads = 0
let settleTimer = null
let settleWaiting = []
/* Counted rather than a flag: a second read can start while the first is
   still going, and the first finishing must not say the second is done. */
let settleReads = 0
/* A scene heard while a settled read was already reading, owed its status read. */
let sceneMissed = false
/*
 * What else the waiting read has been asked to re-check, kept across
 * restarts. `names` is whether it reads the scene names too: not for an
 * announcement about the preset already on screen (see followPresetNews).
 */
const settleAlso = { preset: false, scene: false, names: false, reloaded: false }

/** A preset change whose chain has not been read yet. */
const presetBusy = () => presetLoads > 0 || settleTimer !== null || settleReads > 0

function readPresetSoon(wait, { scene = false, preset = false, names = true, reloaded = false } = {}) {
  clearTimeout(settleTimer)
  if (scene) settleAlso.scene = true
  if (preset) settleAlso.preset = true
  if (names) settleAlso.names = true
  if (reloaded) settleAlso.reloaded = true
  return new Promise((resolve) => {
    settleWaiting.push(resolve)
    settleTimer = setTimeout(async () => {
      settleTimer = null
      const waiting = settleWaiting.splice(0)
      const also = { ...settleAlso }
      settleAlso.preset = false
      settleAlso.scene = false
      settleAlso.names = false
      settleAlso.reloaded = false
      settleReads += 1
      syncChainBusy()
      const was = state.preset?.number
      const rev = state.bufferRev
      try {
        if (also.preset) await settledPreset()
        if (also.scene) await refreshScene()
        /* A scene heard from here on comes after whatever the chain read carries. */
        sceneMissed = false
        const number = state.preset?.number
        if (also.reloaded || number !== was) bufferOwed = true
        /* A preset the unit turned out to have moved to is read whole. */
        const read = await readChainAndNames({ names: also.names || number !== was })
        /*
         * A chain that could not be read — "PRESET_DUMP_HEADER ... got 0x78",
         * a unit still loading — is asked for once more, a moment later.
         * Nothing else would: a footswitch scene only lays its states over
         * the tiles, and those are the last song's until a read works.
         */
        if (read === false && state.preset?.number === number) chainSoon(() => readChainAndNames())
      } catch (err) {
        /* Each read records its own failure; this is only so a timer never
           throws where nobody is listening. */
        logDebug('preset', 'the read after a preset change stopped', err?.message || String(err))
      } finally {
        /* Once the unit has settled, not when it was asked: a panel that
           re-read mid-load would read the preset being left. Carried by the
           chain read when that worked; on its own only when it didn't. */
        bufferOwed = false
        if (state.bufferRev === rev && (also.reloaded || state.preset?.number !== was)) set({ bufferRev: state.bufferRev + 1 })
        settleReads -= 1
        syncChainBusy()
        for (const done of waiting) done()
        if (sceneMissed && !settleReads) {
          sceneMissed = false
          followScene()
        }
      }
    }, wait)
    syncChainBusy()
  })
}

/*
 * Which preset the unit settled on, once it has. When that is not the one on
 * screen, the scene names and controls on screen belong to another preset:
 * they go, the way they do in presetMovedAtUnit, so the read that follows
 * fetches this one's rather than keeping the last song's on its tiles.
 */
async function settledPreset() {
  let fresh = null
  try {
    fresh = await device.currentPreset()
  } catch (err) {
    set(faultFrom(err))
    return
  }
  const n = fresh?.number
  if (Number.isInteger(n) && n >= 0 && state.preset && n !== state.preset.number) {
    forgetControls()
    set({ sceneNames: [], chainKnown: null })
  }
  takePreset(fresh)
}

/*
 * THE UNIT IS ON ANOTHER PRESET THAN THE ONE ON SCREEN, and this phone did
 * not put it there — the front panel, a foot controller, another app. The
 * name goes up at once, from the small read that noticed; the chain follows
 * once, after the wait above.
 *
 * `hostForgot` is for a change the computer made itself, which throws away
 * its copy of the chain. One made at the unit's front panel does not reach
 * the computer at all, so for a quarter of a minute after the last read the
 * computer would answer with the preset just left; the read waits that out
 * rather than putting the last song's blocks under this song's name.
 */
function presetMovedAtUnit(fresh, run, { hostForgot = false } = {}) {
  const number = fresh?.number
  if (run !== presetRun || presetLoads) return false
  if (!Number.isInteger(number) || number < 0 || !state.preset || number === state.preset.number) return false
  presetRun += 1
  logDebug('preset', `the unit is on preset ${number} now, changed away from this phone`)
  forgetControls()
  set({ sceneNames: [], chain: 'reading', chainKnown: null })
  takePreset(fresh)
  clearTimeout(staleTimer)
  staleTimer = null
  clearTimeout(sceneRetryTimer)
  sceneRetryTimer = null
  clearTimeout(gridTimer)
  gridTimer = null
  quickSceneNames().catch(() => {})
  /*
   * The wait only knows this phone's own last read; another client's can have
   * refreshed the computer's copy since. So the read that follows checks the
   * copy is this preset before believing it (see judgeCopy), and asks which
   * preset again: a second change at the front panel inside the wait is
   * announced by nothing this phone is listening for.
   */
  /* Only a unit whose computer keeps its copy that long: an Axe-Fx II's
     lasts half a second, an AM4's a couple, and waiting out a quarter of a
     minute there held every footswitch scene back for nothing. Unknown is
     taken as the long one. */
  const longCopy = hostKeepsCopy() !== false
  const stale = hostForgot || !chainRead || !longCopy ? 0 : chainRead.at + CHAIN_FRESH_MS + 250 - Date.now()
  readPresetSoon(Math.max(PRESET_SETTLE_MS, stale), { scene: true, preset: true, reloaded: true })
  return true
}
