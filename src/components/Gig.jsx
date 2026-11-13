import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { isDemo, liveMeters, setChannel, setMetersWanted, vp4Capabilities, vp4Here } from '../lib/forgefx'
import { stageKey } from '../../shared/device-slug.mjs'
import { VP4_ON_OFF_UNKNOWN, aboutVp4, vp4StepWords } from '../../shared/vp4-safety.mjs'
import {
  useDevice,
  refreshBlocks as reReadChain,
  confirmedChain,
  chainIsCurrent,
  chainFollowed,
  loadPreset,
  presetReadPending,
  readAhead,
  refreshScene,
  refreshSceneState,
  refreshLoadedSceneNames,
  writeScene,
  writeTempo,
  writeBypass,
  writeTuner,
  retryChain,
  tapBoost,
  boostKey,
  rereadSceneNames
} from '../lib/deviceState'
import ChainWait, { ChainUpdating, useChain } from './ChainWait'
import {
  NOT_CONNECTED,
  NOT_SENT,
  NOT_SENT_SHOWN_MS,
  notSentError,
  remoteActive,
  songNotSent,
  songWouldLandLate,
  tapDeadline
} from '../lib/remote'
import ComputerCard from './ComputerCard'
import { linkAwayMs } from '../lib/tapGate'
import { downBandTop } from '../lib/downBand'
import { STAGE_HIDDEN } from '../lib/guardrails'
import { nameOwnBlocks } from '../../shared/own-blocks.mjs'
import { findLooper, LOOPER_LABEL } from '../../shared/looper.mjs'
import { cornerFit, mustSayFit } from '../../shared/tile-corners.mjs'
import { BOOST, boostLabel, boostTitle, boostWord, pedalBoost, pedalUnit } from '../../shared/am4-boost.mjs'
import Looper from './Looper'
import { blockColor } from '../lib/blockColors'
import { blockIcon } from '../lib/blockIcons'
import { sceneColor } from '../lib/sceneColors'
import { useSceneNameSizes } from '../lib/sceneNameFit'
import { useStepLineSize } from '../lib/lineFit'
import { useLooks } from '../lib/useLooks'
import { offMode } from '../lib/looks'
import { presetTag } from '../lib/colourPage'
import ColoursNotice from './ColoursNotice'
import { shortBlock } from '../lib/shortName'
import { presetLabel } from '../lib/presetName'
import { setlistCloudReady } from '../lib/cloudSetlists'
import { marksFor, CHANGED as MARKS_CHANGED } from '../lib/presetMarks'
import {
  listsFor,
  sourceFor,
  orderFor,
  stepTarget,
  nextWords,
  previousWords,
  sourceLabel,
  positionIn,
  songFor,
  applySongSorted,
  CHANGED as SETLISTS_CHANGED
} from '../lib/setlists'
import Setlists from './Setlists'
import { tick as haptic } from '../lib/feedback'
import { useLongPress } from '../lib/longPress'
import { Tuner } from './Console'
import TapTempo from './TapTempo'
import Sheet from './Sheet'
import { sizeVars, SIZES, fitTiles, sceneColsFor, sceneOrderFor } from '../lib/gigSize'
import { webSidewaysPlan, SIDE_GAP, SIDE_HEAD, SIDE_HEAD_ROW, SIDE_NAME_ROOM } from '../lib/sidewaysPlay'
import SideHead from './SideHead'
import { deviceNoun } from '../../shared/device-word.mjs'
import { slotCount, slotLabel, stepSlot } from '../lib/slots'
/* Play's words, the phone's too (shared/play-words.mjs). */
import {
  ALL_PRESETS,
  CHAIN_EMPTY,
  CHAIN_OUT_OF_DATE,
  HOLD_FOR_CHANNELS,
  REFRESH_NAMES,
  REFRESH_NAMES_SAID_MS,
  chainHeading,
  presetLine
} from '../../shared/play-words.mjs'
/* The phone's own pictures for the preset button, the chain's heading and the bar (mobile/assets/icons). */
import chevronIcon from '../../mobile/assets/icons/chevron.png'
import chainIcon from '../../mobile/assets/icons/chain.png'
import tunerIcon from '../../mobile/assets/icons/tuner.png'
import editIcon from '../../mobile/assets/icons/edit.png'
import Picture from './Picture'
import Coach from './Coach'
import UnlockOffer from './UnlockOffer'

/**
 * The stand, not the bench.
 *
 * Nothing here designs anything. On stage you need to know what preset you're
 * on, get to the next one, and see that signal is arriving — with targets big
 * enough to hit without looking closely, on a phone, in the dark, possibly
 * mid-song.
 *
 * Everything else in this app is deliberately absent. A generate button within
 * reach of a stage tap is a hazard.
 */
/* Hoisted: a selector rebuilt each render re-reads the store on every notify. */
const ofScene = (s) => s.sceneIndex
const ofSceneNames = (s) => s.sceneNames
const ofBlocks = (s) => s.blocks
const ofTunerOn = (s) => s.tunerOn
const ofTuning = (s) => s.tuning
const ofBoost = (s) => s.boost
const ofLastUnit = (s) => s.lastUnit

/* How long a preset's scenes stay nameless before Play says how to name them. */
const UNNAMED_AFTER_MS = 1500
/* How long a VP4's refusal stays over Play: its longest sentence, read at an easy pace (see onError). */
const VP4_SAID_MS = 9000
/*
 * THE BOTTOM BUTTONS' LOOK, IN ONE PLACE. 'tall' is the phone app's, 56 high
 * (48 at Smallest) with the tempo under Tap, in styles.css under
 * .gig-bar[data-look='tall']: Justin's pick on 4 November 2026 ("Go with
 * your picks", the pick being the phone app's taller buttons). 'short' is
 * the website's old look: "Make the bottom tab bar buttons smaller", the
 * 44px touch floor with the tempo beside Tap. This is the one line to change.
 */
const BAR_LOOK = 'tall'
/* What the hold tip leaves between the first row of pedals and the buttons at the bottom when it brings that row into sight (the grids' own gap). */
const TIP_ROW_ROOM = 8
/*
 * A PHONE'S PEDAL AT THE COMPACT SIZE is the scenes' height less 12, never
 * under 44 (styles.css .gig[data-phone][data-compact]: the phone's Stage.js
 * `tileH - 12`). The scenes are Fit's tile, or 56 at Smallest. Under 49px a
 * pedal cannot hold its picture and a 15px name (test/styles.mjs adds it up),
 * so there, and only there, the name goes a size down: on Fit's big pedals
 * it stays the size the phone draws it.
 */
const COMPACT_SCENE = 56
const PHONE_PEDAL_LESS = 12
const PEDAL_NAME_ROOM = 49

export default function Gig({
  preset,
  device,
  deviceKey,
  slots,
  capabilities,
  size,
  /*
   * Whether the screen decides the tile height instead of the size step.
   *
   * "It would be nice just to have everything static on the screen without
   * being able to scroll." On, this screen wears the Smallest layout — the
   * chrome trimmed, the names clipped — and measures what is left for the
   * two grids, then shares it out so the last row of blocks sits above the
   * footer. See fitTiles in lib/gigSize.
   */
  fit = false,
  /* The effect pictures on the chain tiles, unless turned off in Settings. */
  icons = true,
  /* Where the scenes sit — across, down the two sides, four to a row like
     the unit, or his own order — and that order. See gigSize. */
  sceneLayout = 'across',
  sceneOrder = null,
  /*
   * The link to the rig is down (a phone on the web app only; App says, from
   * link.js). "When the link drops, Play says so right away. The tiles go dim
   * under NOT CONNECTED." Dimmed by the stylesheet off one attribute, and one
   * floating word: nothing on the screen moves.
   */
  down = false,
  /* Another of Play's one-time notes is up above this screen (App's hold tip,
     the demo's line), so the colours' one waits its turn. */
  noteAbove = false,
  /*
   * A browser on a phone, or on a phone-sized screen, and never the computer
   * app's own window (App phoneScreen): Play drawn as the phone app draws it,
   * with no LEVEL bar, pedals a little shorter than the scenes and
   * three-letter names. Everywhere else keeps what it had.
   */
  phoneScreen = false,
  /*
   * A phone's browser with the phone held on its side, for an account that
   * is let in (App `sidewaysPlay`, lib/sidewaysPlay): Play in two halves of
   * square tiles, the scenes left and the chain right, and the five buttons
   * in one row along the bottom. False, and this is the Play it always was.
   */
  sideways = false,
  /* Whether the blocks the engine has no name for are named on this screen (App `ownBlocksOpenTo`, shared/own-blocks.mjs): an Axe-Fx III's NAM block and five more. False, and Play leaves them out, as it always did. */
  ownOpen = false,
  /* The place in the top bar for the preset's name and Setlists, when moving them up there buys bigger squares (TopBar `headSlot`). */
  headSlot = null,
  /*
   * The tip about holding a pedal is due (App holdTipDue: never seen, a unit
   * whose blocks have channels, and Play's other one-time notes put away).
   * Drawn here, over the pedals, as the phone's Coach: see tipUp.
   * onHoldTipSeen remembers it without closing it (Try it, and the hold
   * itself); onHoldTipClosed puts it away (Skip, Got it).
   */
  holdTip = false,
  onHoldTipSeen,
  onHoldTipClosed,
  /* The demo's card at the top of Play (components/UnlockOffer), { price, trial, onUnlock, onPutAway }, while App says it is up (offerShown); null otherwise. */
  demoCard = null,
  /* The free trial's line or the demo's card about it: { kind: 'line' | 'nudge', text, go, onGo, onPutAway }, or null. */
  trialNote = null,
  /* Settings → Colors, which the colours' one-time line opens when pressed. */
  onOpenColours,
  onError: raiseInPage,
  /*
   * Which computer this is on, when that is the question (App: a pick under
   * Which unit that never answers, the one driven in its place): its words
   * and its buttons, { words, buttons }, at the top of the screen. Null
   * otherwise, and always with one computer. See components/ComputerCard.
   */
  card = null,
  /* A VP4's words App was handed — a preset picked from the list — for the band below: { words, at }. */
  said = null,
  onChanged,
  /* A preset stepped to here has been loaded and read, for what App keeps. */
  onPresetLoaded,
  onPickPreset,
  /*
   * The way to the chain and its knobs.
   *
   * Absent, not disabled, when there is no unit to edit. It does not go with
   * play mode: editing the chain is not asking anything of anybody. It used
   * to, and play mode is
   * on — because it is the same kind of thing: work you do between songs, not
   * during one. On a phone this is the ONLY way in, since the Edit screen is
   * deliberately unreachable there (see BENCH in Screens.jsx); on a wide screen
   * it goes to that screen instead of opening a second copy of it.
   */
  onChain
}) {
  /* Repaint the scenes when the colours change (lib/useLooks); each block tile subscribes for itself. */
  useLooks()
  /* Smallest, or Fit: both are the trimmed layout. The literal is what the
     meter poll and the tests read. */
  const compact = fit || size === 0
  /* The LEVEL bar: not at the compact size, and never on a phone, where the phone app's Play has none. The computer keeps it. */
  const meterShown = !compact && !phoneScreen
  /*
   * How big the buttons are is decided in the tab bar, a row this screen does
   * not own, so the step arrives as a prop. Only the CSS variables are applied
   * here — on the element the two grids actually read them from. See App's
   * `size` state and lib/gigSize.
   */
  /*
   * A view over the one device state, not a second client to the unit.
   *
   * This screen used to keep its own scene, its own block list, its own tuner
   * and its own subscription to the event stream — so two clients contended
   * for a serial port that serialises every request, and a footswitch press
   * arrived twice and was answered with two preset dumps.
   */
  const scene = useDevice(ofScene)
  const names = useDevice(ofSceneNames)
  const allBlocks = useDevice(ofBlocks)
  const tunerOn = useDevice(ofTunerOn)
  const tuning = useDevice(ofTuning)
  /* On an AM4, what its amp's boost is: the amp's pedal shows it (shared/am4-boost.mjs). */
  const boostKept = useDevice(ofBoost)
  /* The last real unit, which the pedals on screen are judged by while the computer says no unit is there (shared/am4-boost.mjs pedalUnit). */
  const lastUnit = useDevice(ofLastUnit)
  /* What an AM4 amp's pedal shows (its boost), or null for every other pedal. */
  const boostOf = (block) => pedalBoost(pedalUnit(deviceKey, lastUnit), block, boostKept, boostKey())
  /*
   * Whose blocks these are. The name of a new preset is up the moment it is
   * picked and its blocks a moment later, and in between the tiles here were
   * the last song's, live: a tap switched whatever the new preset has under
   * the same number. See shared/chain-view.mjs.
   */
  const shown = useChain()
  /*
   * WHERE PLAY STANDS: the preset the last press is going to (the store's
   * chainGoing, set on the tap, which useChain reads as `number`), or with
   * nothing in the air the one on screen. The phone puts the new slot up on
   * the tap (rig.loadPreset); this is the same place, so the PRESET line, the
   * name, Previous and Next all step on from the press, not from the unit's
   * last answer, and two quick presses of Next are two presets.
   */
  const here = Number.isInteger(shown.number) ? shown.number : preset?.number
  /* A preset on its way, which the unit has not named yet: see nameShown. */
  const naming = Number.isInteger(here) && here !== preset?.number

  // Input, output and looper are not stage controls. The gate is — see STAGE_HIDDEN.
  /* And the ones the engine has no name for, named here for an FM9 or an Axe-Fx III (shared/own-blocks.mjs: its NAM block and five more), for whoever they are open to. Still a New block to everything but this screen. */
  const blocks = useMemo(
    () => nameOwnBlocks(allBlocks, deviceKey, ownOpen).filter((b) => b.slug && !STAGE_HIDDEN.includes(b.slug)),
    [allBlocks, deviceKey, ownOpen]
  )

  const [meters, setMeters] = useState([])
  const [toggling, setToggling] = useState(null)
  /*
   * Whether readings are actually arriving while the tuner is on.
   *
   * The tuner can be genuinely running on the unit with nothing reaching this
   * screen: ForgeFX starts the poll for any client, but its remote relay
   * deliberately doesn't bridge the tuner stream (it filters high-frequency
   * telemetry), so on a phone the overlay would sit at "Play a string" forever
   * while the Mac quietly polls the port. That silence needs words. Tracked by
   * time rather than a boolean so a patched or newer ForgeFX that does bridge
   * the stream lights this screen up with no app change.
   */
  const [tunerStalled, setTunerStalled] = useState(false)
  const lastTunerAt = useRef(0)
  /*
   * 'reading' | 'ok' | 'failed'.
   *
   * A read that fell over and a preset with nothing in it used to look the same
   * on this screen: no buttons, no explanation. They are not the same, and the
   * difference matters most on the one where you can't see the unit — a phone at
   * the far side of a stage, where the read travels a relay and can time out.
   */
  const [chain, setChain] = useState('reading')
  /*
   * What the CHAIN heading says (shared/play-words chainHeading), the phone's
   * three: Reading the chain while another preset's is on its way, out of
   * date where the read for this one failed (the card below says Try again),
   * and otherwise as this screen's own read goes. By the chain's view, not
   * by `shown.elsewhere`, which is also true of a read that failed.
   */
  const chainSaid = shown.view === 'loading' ? 'reading' : shown.view === 'failed' ? 'failed' : chain

  /**
   * What's on and what's off, as the unit currently has it.
   *
   * Read rather than remembered. Each scene carries its own bypass states, so
   * the answer changes the moment a scene does — and it can change without this
   * app doing anything, from a footswitch or the unit's own front panel.
   */
  const refreshBlocks = async ({ quiet = false } = {}) => {
    if (!quiet) setChain('reading')
    /*
     * The list lives in the store; what's local is whether the last read
     * worked. A unit that won't report its chain still gets scenes and preset
     * steps — but it says so rather than showing an empty row and letting you
     * assume the preset is empty.
     *
     * One empty answer is not a verdict. This runs straight after a preset
     * change, which is exactly when the unit is still loading that preset and
     * its port is busy — so the ask has to survive a first no the same way the
     * presence check does. Hitting Try again always worked because trying
     * again was the whole fix; confirmedChain does it without the tap.
     */
    const list = await confirmedChain({
      read: reReadChain,
      wait: (ms) => new Promise((go) => setTimeout(go, ms)),
      /* From a phone the read travels a relay to a Mac whose port is already
         busy with its own polling, so a first no there means even less. */
      remote: remoteActive()
    })
    setChain(list ? 'ok' : 'failed')
    return list
  }

  /* Try again on a preset whose chain never arrived: the read a preset
     change makes, with its scene names out of the same copy. */
  const retryHere = async () => {
    const list = await retryChain()
    setChain(Array.isArray(list) ? 'ok' : 'failed')
  }

  /*
   * A scene changed by footswitch is still a scene change — and it is the store
   * that hears it now, for every screen at once. What is left here is noting
   * that a reading arrived, which is how this screen tells a running tuner from
   * a silent one.
   */
  useEffect(() => {
    if (!tuning) return
    lastTunerAt.current = Date.now()
    setTunerStalled(false)
  }, [tuning])

  // Five seconds of a running tuner with no reading is not "play louder".
  useEffect(() => {
    if (!tunerOn) {
      setTunerStalled(false)
      return
    }
    const since = Date.now()
    const timer = setTimeout(() => {
      if (lastTunerAt.current < since) setTunerStalled(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [tunerOn])

  const sceneCount = capabilities?.sceneCount || 8
  const hasScenes = capabilities?.hasScenes !== false
  /* What a block can be switched between, straight off the unit's own report —
     the same list the block sheet on Edit has always used. */
  const channels = capabilities?.channelNames

  /*
   * What this screen reads when it appears, or when the preset changes.
   *
   * Keyed on the slot, not on the preset object, which every read replaces:
   * this used to read the chain and dump the slot for its scene names each
   * time App re-read the preset — straight after a preset change, on top of
   * the reads that change was already making, while the unit was loading.
   * A preset change that is still being read is waited for, and a chain read
   * for this slot a moment ago is not read again.
   */
  useEffect(() => {
    let stop = false
    ;(async () => {
      const pending = presetReadPending()
      if (pending) {
        setChain('reading')
        const list = await pending
        if (!stop) setChain(Array.isArray(list) ? 'ok' : 'failed')
        return
      }
      /* Read a moment ago, or followed since: the store listens whichever
         screen is up, so Play appearing a minute later is no reason to dump
         the preset. See deviceState.chainFollowed. */
      if (chainIsCurrent() || chainFollowed()) {
        setChain('ok')
        return
      }
      await refreshScene()
      const list = stop ? null : await refreshBlocks()
      // Names aren't in the scene query on either device family — they live in
      // the preset body. On stage the name is the whole point of the button:
      // "Lead" is findable at a glance, "3" means remembering what 3 was.
      // Asked after the chain, whose read already carries them — and not after
      // one that failed, when asking is one more dump at a unit still loading.
      if (!stop && Array.isArray(list)) await refreshLoadedSceneNames(preset?.number)
    })()
    return () => {
      stop = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.number])

  /*
   * The signal bar, at a cadence the connection can afford — and asking for
   * ONE block, not all of them.
   *
   * This asked for every block's monitors twice a second. The host can only
   * answer that by fetching the whole grid first, and its own note in
   * gen3.ts liveMonitors() says what that costs: grid()'s cache lasts 500ms,
   * so an all-blocks call on a 500ms tick fires "a full ~24KB preset dump on
   * every tick", serialised ahead of every other read on a port that takes one
   * request at a time. That author called the all-blocks form "(rare)". This
   * screen made it the resting state, and on a phone this screen is the app.
   *
   * The unit was doing all of that while also making sound — reported as the
   * audio cutting out whenever the app was open and stopping the moment it was
   * closed.
   *
   * One block is all this bar ever needed. It draws a single number, the peak,
   * and the output block is where the signal leaving the unit actually is. If
   * the chain has not arrived yet there is nothing to ask about, and asking
   * anyway is what fetched the grid.
   */
  const meterEid = useMemo(
    () => allBlocks.find((b) => b.slug === 'output')?.effectId ?? null,
    [allBlocks]
  )

  /*
   * And tell the HOST, which is the expensive half — and tell it OFF, always,
   * even while the bar below is on screen.
   *
   * Stopping this screen's own poll stops one request every 500ms. The host's
   * telemetry supervisor is the other thing, and it does not watch this
   * screen: it starts on its first event listener and runs four output-meter
   * round trips every 100ms for as long as anything is subscribed — about
   * forty SysEx transactions a second at a unit that is also making sound.
   *
   * This used to say ON whenever the bar was drawn, and the bar never needed
   * it. The bar is the output block's own monitor, read by liveMeters()
   * (GET /preset/monitors/live) straight off the unit; the supervisor's output
   * meters are a different reading, and nothing in this app has ever drawn
   * one. So ON bought the unit forty reads a second for nobody — and since
   * the host keeps one setting for everybody, every Play that opened turned
   * it back on under a phone that had just said off. "Stop the computer
   * asking the unit for level readings nobody is looking at." (Justin, 15
   * October 2026; shared/relay-rules.mjs METERS_OFF_PATH says the rest.)
   *
   * Off, it keeps the front-panel scene and channel watches (a footswitch
   * press still lands, exactly as fast) and drops to two reads every 800ms.
   * Said when Play opens: in the computer's own window and on its wifi page,
   * where nothing else here says it, and through the account as well.
   */
  useEffect(() => {
    setMetersWanted(false).catch(() => {
      /* An older host without the route keeps the behaviour it already had. */
    })
  }, [])

  useEffect(() => {
    // Hidden at the smallest size, and a bar nobody can see is not worth a
    // round trip to the unit — let alone one every half second, on the size
    // step whose whole reason to exist is a rig that has to fit. Nor on a
    // phone, which draws none (meterShown).
    if (meterEid === null || !meterShown) {
      setMeters([])
      return undefined
    }
    let stop = false
    const tick = async () => {
      const remote = remoteActive()
      if (!(typeof document !== 'undefined' && document.hidden)) {
        try {
          const data = await liveMeters(meterEid)
          if (!stop) setMeters(Array.isArray(data) ? data : data?.blocks || [])
        } catch {
          /* meters are a nicety here, not worth surfacing an error over */
        }
      }
      if (!stop) setTimeout(tick, remote ? 2000 : 500)
    }
    tick()
    return () => {
      stop = true
    }
  }, [meterEid, size, meterShown])

  /*
   * A DROPPED TAP, SAID OVER THE TILES. "Not sent — not connected", briefly.
   * Not through onError: App's notice is in the page above Play, and a row
   * appearing there pushes every tile down under a thumb already on its way
   * to the next one. This floats, takes no touch and goes on its own.
   */
  const [dropped, setDropped] = useState(null)
  /*
   * AND A VP4'S REFUSALS, THE SAME WAY. On a VP4 a scene with no number set,
   * Previous with no setlist, the tempo and a number held after a miss all
   * come back in words, and through App's notice each one pushed the preset
   * bar, the scenes and the pedals down — 280 pixels at 320 wide, so the
   * notice sat where scene 2 had been and a quick second tap landed on a
   * pedal. Said over the screen instead, like the phone's toast: no room
   * taken, no touch taken, gone on its own once there has been time to read
   * it (VP4_SAID_MS, not a dropped tap's three seconds). It is the band a
   * dropped tap is said in, so the two never sit on top of each other.
   * Everything else still goes to App's notice, as before.
   */
  const onError = (err) => {
    if (vp4Here() && aboutVp4(err)) setDropped({ words: typeof err === 'string' ? err : err?.message, at: Date.now(), ms: VP4_SAID_MS })
    else raiseInPage(err)
  }
  /* Not one a newer press of the same control took over: that press is the news, and its tile is up (shared/relay-rules newestPresses). */
  const sayNotSent = (err) => {
    if (!err?.overtaken) setDropped({ words: err?.message || NOT_SENT, at: Date.now() })
  }
  /*
   * And one App was handed (`said`): the same band, for what is left of its
   * time. Each new one by when it was said; one from before Play was last
   * left is not said again on coming back to it.
   */
  useEffect(() => {
    const left = said?.words ? VP4_SAID_MS - (Date.now() - said.at) : 0
    if (left > 0) setDropped({ words: said.words, at: said.at, ms: left })
  }, [said?.at])
  useEffect(() => {
    if (!dropped) return undefined
    const t = setTimeout(() => setDropped(null), dropped.ms || NOT_SENT_SHOWN_MS)
    return () => clearTimeout(t)
  }, [dropped])
  /* And taken down the moment the link is back: "not connected" over a screen that is live again would be the very disagreement this app keeps out. */
  useEffect(() => {
    if (!down) setDropped(null)
  }, [down])

  /**
   * The tuner, on this screen, where tuning actually happens.
   *
   * There is nothing to open on the unit — the AM4's tuner block is always
   * live, and what "the tuner works in Axis" turned out to mean is a display in
   * the app, fed by the same poll. So that is what this is.
   *
   * The line that used to sit here said the readings travel the relay "so it
   * works the same from a phone". They did not, and it did not: the host bridged
   * five kinds of event and dropped the tuner with the meter cadence, so a phone
   * got a display and no numbers. Two comments in this one file disagreed about
   * it, and the wrong one was the one next to the code. The host relays them now
   * (forgefx.lock.json), which is what makes this true rather than intended.
   */
  const toggleTuner = async () => {
    const next = !tunerOn
    try {
      // ForgeFX answers {ok:false} — not an error — when the attached unit has
      // no tuner path in this build. The store turns the tuner back off for
      // that answer; silence here looked exactly like a tuner that was warming
      // up, forever.
      const res = await writeTuner(next)
      if (next && res && res.ok === false) {
        onError('The unit refused the tuner — the Fractal Remote app on the computer may need updating.')
      }
    } catch (err) {
      if (err?.notSent) sayNotSent(err)
      else onError(err.message)
    }
  }

  /*
   * Leaving gig mode with the tuner running would leave the poll running for a
   * display nobody can see. Cleanup turns it off with the same best-effort
   * shrug as the toggle itself.
   */
  useEffect(() => {
    if (!tunerOn) return undefined
    // Through the store, so the shared tunerOn goes down with it. Turning the
    // unit's tuner off while the store still believed it was on left the top
    // bar's tuner button lit for a tuner nobody could see.
    return () => {
      writeTuner(false).catch(() => {})
    }
  }, [tunerOn])

  const pickScene = async (index) => {
    haptic()
    try {
      // Optimistic inside the store: the footswitch feel matters more than the
      // round trip, and a refusal puts the old scene back. The new scene's
      // on/off states come with it, from the small status read the store
      // makes — not the chain, which is the whole preset dumped mid-switch.
      await writeScene(index)
    } catch (err) {
      if (err?.notSent) sayNotSent(err)
      else onError(err)
    }
  }

  /**
   * Turn one block on or off.
   *
   * Optimistic, and read back only when it fails. On a stage the tap has to
   * look like it worked immediately. It used to read the whole chain after
   * every tap to confirm it, which is a preset dump on a unit that is
   * switching an effect — the drop "the sound should never cut out" is about.
   */
  const toggle = async (block) => {
    /* A pedal read ahead of the switch, whose on or off the unit has not said
       yet: a tap would be a guess, so it waits the moment for the status read. */
    if (shown.outline && typeof block.bypassed !== 'boolean') return
    haptic()
    const eid = block.effectId
    const wanted = !block.bypassed
    /*
     * On an AM4 the amp's pedal is its boost (shared/am4-boost.mjs): it
     * switches that, and never turns the amp off. Not held disabled while
     * its write is answered: the boost goes up at once and puts itself back
     * if it fails, and an older computer takes over half a second to answer
     * one, which lost a quick second tap.
     */
    const boosts = boostOf(block) !== null
    if (!boosts) setToggling(eid)
    try {
      if (boosts) await tapBoost(eid)
      else await writeBypass(eid, wanted)
    } catch (err) {
      /* A tap on a tile drawn for the preset just left: nothing was sent,
         so there is nothing to report and nothing to read back. */
      if (err?.notThisChain) return
      /* Dropped before it left: the tile is still what the unit is on, and there is nothing to read back. */
      if (err?.notSent) {
        sayNotSent(err)
        return
      }
      /* A boost tap that sent nothing, and says why (the amp off in this scene, a boost that could not be read): said over the tiles for long enough to read, with nothing to read back. */
      if (err?.nothingSent) {
        setDropped({ words: err.message, at: Date.now(), ms: VP4_SAID_MS })
        return
      }
      // The error itself: the app reads `unitGone` off it to tell a refused
      // write from a Mac that has lost the unit altogether, and a flattened
      // message cannot carry that.
      onError(err)
      // What the unit actually has on: the status read, not the chain.
      if (!err?.unitGone) await refreshSceneState()
    } finally {
      if (!boosts) setToggling(null)
    }
  }

  /*
   * Which block's channels are up, as a sheet.
   *
   * "It's tiny right now. Maybe pull up a slide-up menu when you hold the
   * button down to switch between A B C D?" The hold used to open four thin
   * pills inside the tile it was held on — thirty pixels each across a
   * phone-width tile, on the one screen whose whole premise is a target you
   * can hit in the dark. One sheet for the whole grid, holding the block
   * being changed, so a fourteen-block preset does not mount fourteen.
   */
  const [chanEid, setChanEid] = useState(null)
  /*
   * THE TIP ABOUT HOLDING A PEDAL, over the pedals it is about (the phone's
   * Coach). Only where a hold does something, on this preset's read chain:
   * the phone's holdDoesSomething (Stage.js), and the hold's own rule
   * (BlockTile `has`). Declared here, after `chain`, `channels` and
   * `chanEid`, which it reads.
   */
  const holdDoesSomething = chain === 'ok' && blocks.length > 0 && (channels?.length || 0) > 1 && !shown.elsewhere && !shown.outline
  /*
   * The words beside CHAIN on the same terms, less the outline (a moment
   * between two reads, where the words going and coming would flicker): only
   * over pedals that are drawn and read. Never over the waiting cards or a
   * read that failed, where a hold does nothing, and where on a phone the
   * words took the room "Reading the chain…" and "out of date" need.
   */
  const holdHint = chain === 'ok' && blocks.length > 0 && (channels?.length || 0) > 1 && !shown.elsewhere
  /*
   * And once up, it stays up, as the phone's does (its `coach` is set once):
   * through every preset change until Skip or Got it. Worked out on every
   * draw, it went the moment Next was pressed and came back when the chain
   * was read, and every pedal under it jumped up and back down by its
   * height, and under Fit was re-sized twice a press.
   */
  const [tipOpen, setTipOpen] = useState(false)
  useEffect(() => {
    if (!holdTip) setTipOpen(false)
    else if (holdDoesSomething) setTipOpen(true)
  }, [holdTip, holdDoesSomething])
  const tipUp = holdTip && tipOpen
  /* 'tip', then 'trying' after Try it, then 'done' once a channel sheet opens: the phone's three. */
  const [tipStage, setTipStage] = useState('tip')
  /* Try it is remembered at once (the phone's rule: a tip somebody has tried is not offered again), and the card waits for the hold. */
  const tryTip = () => {
    onHoldTipSeen?.()
    setTipStage('trying')
  }
  /* A channel sheet opening is the hold having worked (a right-click opens one too): said once, then Got it. */
  useEffect(() => {
    if (chanEid !== null && tipUp && tipStage !== 'done') {
      onHoldTipSeen?.()
      setTipStage('done')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chanEid, tipUp, tipStage])
  /* The looper's buttons, opened from the Looper button under the tiles. */
  const [looping, setLooping] = useState(false)
  const looperHere = findLooper(allBlocks)
  /* A channel sheet opened on the last preset's block does not stay up over this one's. */
  const chanBlock = chanEid === null || shown.elsewhere || shown.outline ? null : blocks.find((b) => b.effectId === chanEid) || null
  /* Closed, not only hidden: kept, it came back over the new song's tiles the
     moment its chain landed — same block number, new preset. */
  useEffect(() => {
    if (shown.elsewhere) setChanEid(null)
  }, [shown.elsewhere])
  /* And on any other preset: a chain up from memory is drawn at once, and a
     sheet left open would be over the new song's block of the same number. */
  useEffect(() => setChanEid(null), [shown.number])

  /*
   * What Previous and Next step through.
   *
   * The slots, the starred presets, or a setlist — chosen on the sheet behind
   * the button between the two, kept per unit in this browser. Read back from
   * storage whenever either file changes, because the star is pressed in the
   * picker, over this screen, and the count on the button has to follow it.
   * See lib/setlists for the order each source gives.
   *
   * In the demo's own drawer while the demo is on (shared/device-slug
   * stageKey): the demo's FM3 and a real FM3 are both 'fm3', and looking
   * round the demo was editing the real gig setlist (the 2 November 2026
   * audit). The pedals above still go by the unit's own slug.
   */
  const stage = stageKey(deviceKey, isDemo())
  const [marksRev, setMarksRev] = useState(0)
  useEffect(() => {
    const bump = () => setMarksRev((n) => n + 1)
    window.addEventListener(MARKS_CHANGED, bump)
    window.addEventListener(SETLISTS_CHANGED, bump)
    return () => {
      window.removeEventListener(MARKS_CHANGED, bump)
      window.removeEventListener(SETLISTS_CHANGED, bump)
    }
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const favourites = useMemo(() => marksFor(stage).favourites, [stage, marksRev])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lists = useMemo(() => listsFor(stage), [stage, marksRev])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const source = useMemo(() => sourceFor(stage), [stage, marksRev])
  const order = orderFor(source, { favourites, lists })
  const [setlistOpen, setSetlistOpen] = useState(false)

  /*
   * Where a press would land, or null when the button has nothing to do. NOT
   * SLOT BY SLOT ON A VP4, which cannot say which preset it is on: a setlist
   * or the stars know their own order and send the preset itself, and with
   * neither the buttons say why (VP4_NO_STEP, or on a computer too old for
   * any of it the update words: vp4StepWords) — the phone's rule.
   */
  /*
   * And slot by slot, the phone's rule (lib/slots stepSlot): one on or one
   * back from where Play stands, and nothing past the unit's last slot or
   * before its first. The AM4 demo used to go on from 103 to a "104
   * Untitled" that does not exist.
   */
  const noSlotSteps = vp4Here()
  const landing = (delta) =>
    order
      ? stepTarget({ source, current: here, delta, favourites, lists })
      : noSlotSteps
        ? null
        : stepSlot(here, delta, capabilities)

  /*
   * And the pedals of where each would land, read while nothing else is going
   * on, so the tap puts them up with the name. "Preload the next one and keep
   * the previous one." See deviceState.readAhead.
   */
  const nextAt = landing(1)
  const lastAt = landing(-1)
  useEffect(() => readAhead([nextAt, lastAt]), [nextAt, lastAt])
  useEffect(() => () => readAhead([]), [])

  /*
   * The line under Next: the name of what it will load, or at the end of a
   * setlist that the set starts over. "'Next: song name' under the Next
   * button. You see what's coming before the count-in, so a wrong running
   * order gets caught in time." The phone's line, by the phone's rule (see
   * lib/setlists nextWords).
   *
   * Out of `slots`, which is the preset list's own (App hands the picker and
   * this screen the same allSlots), so the line says what the list says for
   * the slot Next loads, and nothing is asked of the unit for it. By number,
   * not by place in the array: before the unit has said how many slots it
   * has, the list is only the slots with names. Not known, or past the last
   * slot, is a blank line, never a guess.
   */
  const slotNames = useMemo(() => new Map((slots || []).map((s) => [s.number, s.name])), [slots])
  const ahead = nextWords({ order, current: here, next: nextAt, nameOf: (n) => slotNames.get(n) })
  /*
   * THE PRESET'S NAME, as the phone puts it up on the tap (rig.loadPreset):
   * the preset's own name, or for one on its way the name the preset list
   * already has for that slot, and "…" only where the list does not know it
   * yet, never "Untitled" for a preset that is only still loading.
   */
  const goingName = naming ? slotNames.get(here) : undefined
  const nameShown = !naming ? presetLabel(preset) : typeof goingName === 'string' ? presetLabel({ number: here, name: goingName }) : '…'

  /*
   * And the line under Previous, by the same rule the other way round: the
   * name of what it will load, or on song 1 of a setlist that it goes to the
   * end. "Can we add that to the previous button as well?" The phone's line
   * (lib/setlists previousWords), asked about `lastAt` and nothing else.
   */
  const behind = previousWords({ order, current: here, previous: lastAt, nameOf: (n) => slotNames.get(n) })

  /* Each name drawn smaller rather than cut where its button is too narrow for it (lib/lineFit, shared/line-fit.mjs). */
  const behindLine = useRef(null)
  const aheadLine = useRef(null)
  const behindSize = useStepLineSize(behindLine, behind.shown)
  const aheadSize = useStepLineSize(aheadLine, ahead.shown)

  /*
   * NOR LATE. A link that was away while the preset loaded held its reads,
   * and the song's scene would go out seconds after Next, mid-verse. When it
   * was away for longer than a tap's deadline in all, the scene and tempo are
   * not sent, and that is said like a dropped tap (shared/relay-rules
   * songWouldLandLate — the phone's rule too). A link that stayed up changes
   * nothing, however long the reads took.
   */
  const songLate = (song, awayAtNext) => {
    if (!songWouldLandLate(linkAwayMs(Date.now()) - awayAtNext)) return false
    sayNotSent(notSentError({ late: true, words: songNotSent({ scene: Number.isInteger(song.scene), tempo: Number.isFinite(song.bpm) }) }))
    return true
  }

  /*
   * TWO QUICK PRESSES ARE TWO PRESETS, as on the phone: the buttons are never
   * held while a load is answered, and each press steps on from where the
   * last one is going (`here`), so Next, Next skips a song. Which press is
   * the newest is counted (the phone's stepsRef): a song pressed past is
   * never set up on the one after it, and an older press that fails says
   * nothing over the newer one (the phone's rig.loadPreset: "Only the newest
   * tap decides what is on screen"). loadPreset already answers null for a
   * load a newer press took over; this is the second guard, as on the phone.
   *
   * And the song's own scene and tempo, when the setlist gives it some: one
   * tap is the whole change between songs. See songFor. Not on a select the
   * unit has not said it took (null; see loadPreset), and only for the
   * newest press.
   */
  const stepsRef = useRef(0)
  /* The bottom row's buttons, and what a screen reader calls the row: the ones drawn, so a unit with no tuner is never told it has one. */
  const tunerHere = capabilities?.tuner !== false
  const barParts = [tunerHere ? 'Tuner' : null, onChain ? 'Edit' : null, 'Tap'].filter(Boolean)
  const barSays = barParts.length > 1 ? `${barParts.slice(0, -1).join(', ')} and ${barParts[barParts.length - 1]}` : barParts[0]
  const step = async (delta) => {
    const next = landing(delta)
    if (next === null) {
      /* And on a computer that can't change a VP4's presets at all, only that (vp4StepWords). */
      if (!order && noSlotSteps) onError(vp4StepWords(vp4Capabilities()))
      return
    }
    const mine = ++stepsRef.current
    const awayAtNext = linkAwayMs(Date.now())
    try {
      /* The select, which preset, which scene, and one chain read once the
         unit has settled — the store's, shared with the preset list. A whole
         re-read here was the chain and a dump of the slot while the unit was
         still loading it. */
      const landed = await loadPreset(next)
      onPresetLoaded?.()
      /* And the song's own scene and tempo (see the comment over stepsRef). */
      const song = songFor(source, lists, next)
      if (mine !== stepsRef.current) return
      if (song && landed !== null) {
        if (songLate(song, awayAtNext)) return
        /* A half never sent is said over the tiles, not in App's notice (applySongSorted). */
        const { refused, unsent } = await applySongSorted(song, { scene: writeScene, tempo: writeTempo })
        if (unsent) sayNotSent(unsent)
        if (refused.length) onError(`The song’s ${refused.join(' and ')} didn’t take. Set it by hand for this one.`)
      }
    } catch (err) {
      if (mine !== stepsRef.current) return
      if (err?.notSent) sayNotSent(err)
      else onError(err.message)
    }
  }

  /*
   * The button between the two: what they walk, and where you are in it.
   * "Starred 3/7" is the third starred preset of seven; a setlist shows its
   * name. Off the list altogether it shows only the count, and Next goes to
   * the first song.
   */
  const sourceName = sourceLabel(source, { favourites, lists })
  const at = order ? positionIn(order, here) : 0
  const sourceWhere = order ? (at ? `${at}/${order.length}` : `${order.length}`) : ''
  const sourceAria = order
    ? `Previous and Next step through ${sourceName}${at ? `, song ${at} of ${order.length}` : `, ${order.length} songs`}. Change setlist.`
    : 'Previous and Next step through every preset. Choose a setlist.'

  // `norm`, not `level` — the monitor route reports a normalised 0..1 per
  // monitored parameter. Reading the field the old mock invented pinned this
  // bar at zero on hardware, so the one thing on this screen that says "signal
  // is getting through" always said it wasn't.
  const peak = meters.length ? Math.max(...meters.map((m) => m.norm ?? 0)) : 0

  /*
   * Fit: measure, then share out.
   *
   * Everything on this screen that is not a tile — the preset name, the notes,
   * the footer — is chrome, and its height does not depend on the tile size.
   * So it is measured once as the screen's own height less the two grids, and
   * whatever the viewport has left after it is what the grids get. Measured
   * again on a resize (rotation, the browser bar coming and going) and when the
   * number of scenes or blocks changes, which are the only things that move
   * the answer. A frame later each time, so the measure sees a drawn screen.
   */
  const gigRef = useRef(null)
  const scenesRef = useRef(null)
  const blocksRef = useRef(null)
  /*
   * AND THE PEDALS IT IS ABOUT, IN SIGHT. The card stands over the pedals,
   * and in a phone's browser, with its own bars taking their share of the
   * height, that put the first row of them under the buttons at the bottom:
   * a tip about holding a block with no block to hold, on a screen that
   * looked fitted. So when it comes up, and again after Try it, the page is
   * moved just far enough for that row to stand whole above the buttons,
   * and never so far that the card's own top goes off the screen. Once the
   * screen has settled (two frames: Fit measures a frame after a change),
   * and only ever down, by what is missing.
   */
  const footRef = useRef(null)
  /*
   * And a card put away from the keyboard (the demo's ×, the tip's Skip or
   * Got it) took the focus with its button, and the next Tab started again
   * at the top bar. Once the button has gone the focus goes on, to the
   * first pedal from the tip (what it is about), and to the preset button,
   * the first thing on Play after it, from the demo's card.
   */
  const keepFocusOnPlay = (e) => {
    const pressed = e.target?.closest?.('.coach button, .demo-card button')
    if (!pressed) return
    const fromTip = !!pressed.closest('.coach')
    requestAnimationFrame(() => {
      if (pressed.isConnected || (document.activeElement && document.activeElement !== document.body)) return
      const next = (fromTip ? gigRef.current?.querySelector('.gig-blocks button') : null) || gigRef.current?.querySelector('button.gig-name')
      next?.focus()
    })
  }
  useEffect(() => {
    if (!tipUp || tipStage === 'done') return undefined
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        /* The pedals themselves, not the waiting cards that stand in for them. */
        const grid = blocksRef.current
        const row = grid?.classList.contains('gig-blocks') ? grid.firstElementChild : null
        const card = gigRef.current?.querySelector('.coach')
        const foot = footRef.current
        if (!row || !card || !foot) return
        /* The card's top stays under the top bar where that stays on screen (as the band's floor, below). */
        const bar = document.querySelector('.topbar')
        const top = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0
        const room = foot.getBoundingClientRect().top - TIP_ROW_ROOM
        const short = Math.min(row.getBoundingClientRect().bottom - room, card.getBoundingClientRect().top - top - TIP_ROW_ROOM)
        if (short <= 0) return
        let still = false
        try {
          still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        } catch {
          still = false
        }
        /* Whatever scrolls Play: its own screen where that scrolls, else the page. */
        let box = gigRef.current.parentElement
        while (box && !(box.scrollHeight > box.clientHeight && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement
        const scroller = box || window
        scroller.scrollBy({ top: Math.ceil(short), behavior: still ? 'auto' : 'smooth' })
      })
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipUp, tipStage])
  const [fitVars, setFitVars] = useState(null)
  /* How tall a phone's compact pedal is drawn (styles.css), and whether its name has to go a size down for it. */
  const phonePedal = Math.max(44, (fitVars ? fitVars.tile : COMPACT_SCENE) - PHONE_PEDAL_LESS)
  const pedalTight = phoneScreen && compact && phonePedal < PEDAL_NAME_ROOM
  /*
   * Each scene's name as big as its tile has room for (lib/sceneNameFit,
   * shared/name-fit): "the text is bigger on screens that allow it, and if
   * there's more scenes like on an FM3, the text can shrink."
   */
  const nameSizes = useSceneNameSizes(scenesRef, names, sceneCount)
  /*
   * WHERE NOT CONNECTED FLOATS: over the scenes, wherever they are in the
   * window (lib/downBand says why — at 42% of the window it sat on Tap on an
   * iPad and under everything on a big screen). Measured while the band is
   * up, and again on anything that moves the tiles in the window: a resize,
   * a scroll of the page or of Play's own screen (caught on the way down,
   * since a scroll does not bubble), and a grid or the band changing size.
   * Only the band moves; nothing it is drawn over does.
   */
  const bandRef = useRef(null)
  const [bandAt, setBandAt] = useState(null)
  const bandUp = down || !!dropped
  useLayoutEffect(() => {
    if (!bandUp) return undefined
    let raf = 0
    const box = (el) => {
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { top: b.top, bottom: b.bottom }
    }
    const place = () => {
      const bar = document.querySelector('.topbar')
      const next = downBandTop({
        viewport: window.visualViewport?.height || window.innerHeight,
        floor: bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0,
        scenes: box(scenesRef.current),
        blocks: box(blocksRef.current),
        /* The word is what is centred; a dropped tap's note hangs under it. */
        height: bandRef.current?.firstElementChild?.offsetHeight || 0,
        whole: bandRef.current?.offsetHeight || 0
      })
      setBandAt((was) => (was === next ? was : next))
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(place)
    }
    place()
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    const sized = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
    for (const el of [scenesRef.current, blocksRef.current, bandRef.current, gigRef.current]) if (el) sized?.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      sized?.disconnect()
    }
  }, [bandUp, down, !!dropped, hasScenes])
  /*
   * A PRESET WHOSE SCENES REALLY HAVE NO NAMES — not one whose names are on
   * their way. On the play test the "Those are scenes" note flashed up for a
   * frame on every Next: the names are cleared on the press and arrive a
   * moment later, and for that moment the note pushed everything under it
   * down fifty pixels and back. So it waits for the chain to be this
   * preset's and for the names to have stayed empty a second and a half.
   */
  const noNames = hasScenes && !names.some((n) => (n || '').trim()) && !shown.elsewhere && !shown.outline
  const [unnamedSettled, setUnnamedSettled] = useState(false)
  useEffect(() => {
    if (!noNames) {
      setUnnamedSettled(false)
      return undefined
    }
    const timer = setTimeout(() => setUnnamedSettled(true), UNNAMED_AFTER_MS)
    return () => clearTimeout(timer)
  }, [noNames, shown.number])
  /*
   * THE PEDALS' SPACE, HELD WHILE THE NEXT PRESET'S CHAIN IS COMING.
   *
   * "Every time you do go previous or next the screen shrinks for a second and
   * then goes back down." While another preset's chain was on its way the
   * pedals went and the waiting cards took their place — a different height,
   * and not counted as tile space, so the fit gave the scenes less room and
   * shrank them, and gave it back when the pedals came. The phone was put
   * right in 1.86.29; this is the same fix. The last chain's height and count
   * are kept, and the cards wait in a box exactly that tall, which the fit
   * counts as the pedals.
   */
  const heldBlocks = useRef({ count: 0, height: 0 })
  const tileCount = blocks.length + (looperHere ? 1 : 0)
  useLayoutEffect(() => {
    if (shown.elsewhere || !blocksRef.current || !tileCount) return
    heldBlocks.current = { count: tileCount, height: blocksRef.current.offsetHeight }
  })
  const held = shown.elsewhere && heldBlocks.current.height > 0 ? heldBlocks.current : null
  const fitCount = held ? held.count : tileCount
  useEffect(() => {
    if (!fit) {
      setFitVars(null)
      return undefined
    }
    let raf = 0
    const measure = () => {
      const el = gigRef.current
      if (!el) return
      const grids = (scenesRef.current?.offsetHeight || 0) + (blocksRef.current?.offsetHeight || 0)
      const chrome = el.scrollHeight - grids
      const top = el.getBoundingClientRect().top + window.scrollY
      const viewport = window.visualViewport?.height || window.innerHeight
      const next = fitTiles({
        available: viewport - top - chrome,
        scenes: hasScenes ? sceneCount : 0,
        blocks: fitCount,
        sceneCols: sceneColsFor(null, sceneLayout),
        /* How wide the effects row is, so a phone's browser is not sent six
           across with tiles too narrow for a picture — see fitTiles. */
        width: blocksRef.current?.clientWidth || 0
      })
      setFitVars((was) => (was && was.tile === next.tile && was.fxCols === next.fxCols ? was : next))
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    schedule()
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    /*
     * AND WHENEVER ANYTHING AROUND THE GRIDS CHANGES SIZE.
     *
     * "When I switch presets, it shrinks it on the screen a little bit, and
     * then if I pull down on the phone, then it expands." The measure used to
     * run only on a resize or when the number of scenes or blocks changed.
     * Everything else that takes height was missed: a note over the screen
     * closing, the preset name wrapping to a second line for a moment while
     * the new one loads. A measure taken during one of those moments stayed
     * until something else happened to trigger another, and pulling the page
     * down was the something else.
     *
     * So this screen and everything it sits inside are watched, up to the
     * page: a note closing above it shrinks the box that holds both, even
     * when the page itself stays the height of the phone. Changing the tiles
     * changes those heights too, and that triggers one more measure, which
     * gets the same answer and stops, because what is measured is the space
     * around the grids, not the grids themselves.
     */
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    for (let box = gigRef.current; watch && box && box !== document.documentElement; box = box.parentElement) {
      watch.observe(box)
    }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      watch?.disconnect()
    }
  }, [fit, hasScenes, sceneCount, fitCount, sceneLayout])

  /*
   * ON ITS SIDE: THE SQUARES (lib/sidewaysPlay webSidewaysPlan).
   *
   * Measured the way Fit is: the window's height, less everything from the
   * top of the page to the top of the two headings, less the bottom row. The
   * plan is worked out as if the preset's row were in the page, and says
   * whether it belongs in the top bar instead (`headUp`), so while it is up
   * there its height is taken back off what was measured. The headings' own
   * margin is the room the plan left over, shared above and below, and is
   * not part of what is measured.
   */
  const [sidePlan, setSidePlan] = useState(null)
  useEffect(() => {
    if (!sideways) {
      setSidePlan(null)
      return undefined
    }
    let raf = 0
    const measure = () => {
      const el = gigRef.current
      /* SCENES, or CHAIN where there are no scenes: the two are one row. */
      const top = el?.querySelector(':scope > .gig-head')
      if (!el || !top) return
      const viewport = window.visualViewport?.height || window.innerHeight
      const foot = footRef.current
      /* The bottom row and the gap over it; its margin beyond that gap is room the plan left over, and not measured. */
      const footTall = foot ? foot.offsetHeight + SIDE_GAP : 0
      const headTop = top.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(top).marginTop) || 0)
      const upNow = el.dataset.headUp === 'yes'
      const room = viewport - headTop - footTall - (upNow ? SIDE_HEAD_ROW : 0)
      const next = webSidewaysPlan({
        width: el.clientWidth,
        /* Never nothing: with the tuner up there may be no room left at all, and that is a page that scrolls, not a page not measured yet. */
        room: Math.max(1, room),
        scenes: hasScenes ? sceneCount : 0,
        pedals: fitCount,
        canHeadUp: !!headSlot,
        headWas: upNow
      })
      if (next) {
        /* What the plan leaves over, down the page: half of it goes above the halves. */
        const rows = (n, cols) => (cols ? Math.ceil(n / cols) : 0)
        const tall = (n, cols, side) => (cols ? rows(n, cols) * side + (rows(n, cols) - 1) * SIDE_GAP : 0)
        const used = SIDE_HEAD + Math.max(tall(hasScenes ? sceneCount : 0, next.sceneCols, next.scene), tall(fitCount, next.chainCols, next.pedal))
        const spare = next.scrolls ? 0 : Math.max(0, Math.floor(room + (next.headUp ? SIDE_HEAD_ROW : 0) - used))
        next.above = Math.floor(spare / 2)
        next.below = spare - next.above
      }
      const same = (a, b) => (!a || !b ? a === b : Object.keys(b).every((k) => a[k] === b[k]))
      setSidePlan((was) => (same(was, next) ? was : next))
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    schedule()
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    for (let box = gigRef.current; watch && box && box !== document.documentElement; box = box.parentElement) {
      watch.observe(box)
    }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      watch?.disconnect()
    }
  }, [sideways, hasScenes, sceneCount, fitCount, headSlot])
  /* The preset's row is in the top bar: only while the bar has the place for it. */
  const headUp = sideways && !!sidePlan?.headUp && !!headSlot
  /* The preset's name and Setlists on a phone on its side, wherever they are drawn. */
  const sideHead = sideways ? (
    <SideHead
      up={headUp}
      name={nameShown}
      slot={Number.isInteger(here) ? slotLabel(here, capabilities?.presets?.addressing) : null}
      count={slotCount(capabilities)}
      tag={presetTag(preset?.number)}
      said={`Preset ${Number.isInteger(here) ? here : '--'} — ${nameShown} — choose another preset`}
      onPickPreset={onPickPreset}
      setlist={order ? sourceName : 'All'}
      setlistOn={!!order}
      setlistWhere={sourceWhere}
      setlistSaid={sourceAria}
      onSetlists={() => setSetlistOpen(true)}
    />
  ) : null

  return (
    /*
     * At the smallest step this is not just smaller tiles: the chrome above
     * the grids gives way too. Measured on a 440x790 phone, that chrome was
     * 441px — more than half the screen — before a single scene appeared, and
     * the preset name inside it is already in the bar at the top of the app.
     * Smallest is the setting for someone who wants the whole rig on one
     * screen, so it spends the screen on the rig.
     */
    <div
      ref={gigRef}
      className="gig"
      onClickCapture={keepFocusOnPlay}
      data-compact={compact || sideways ? 'yes' : undefined}
      data-fit={fit && !sideways ? 'yes' : undefined}
      data-scene-layout={sceneLayout !== 'across' ? sceneLayout : undefined}
      /* A phone on its side: two halves of squares (styles.css). `data-one` when there are only scenes or only pedals, and the one grid has the whole row. */
      data-sideways={sideways ? 'yes' : undefined}
      data-head-up={headUp ? 'yes' : undefined}
      data-one={sideways && sidePlan && !sidePlan.beside ? 'yes' : undefined}
      /* On a phone, Play as the phone app draws it (phoneScreen): the pedals a little shorter than the scenes, and no LEVEL bar. */
      data-phone={phoneScreen ? 'yes' : undefined}
      /* Three letters on a phone at every size, as the phone app ("DRV, AMP");
         elsewhere, three effects to a row still fits a name and four does not.
         The switch rides the column count rather than a width guess, and the
         names swap only under the stylesheet's 620px line either way. */
      data-fx-abbr={phoneScreen || (fitVars?.fxCols ?? SIZES[fit ? 0 : size].fx) >= 4 ? 'yes' : undefined}
      /* A phone's compact pedal too short for its picture and a 15px name (PEDAL_NAME_ROOM). */
      data-fx-tight={pedalTight ? 'yes' : undefined}
      /* On its side, a square too narrow for "REVERB 1" says REV, as an upright phone's tiles do. */
      data-side-abbr={sideways && sidePlan && sidePlan.pedal < SIDE_NAME_ROOM ? 'yes' : undefined}
      /* NOT CONNECTED: the stylesheet dims the tiles and the buttons that send, by opacity alone. */
      data-link-down={down ? 'yes' : undefined}
      style={{
        ...sizeVars(fit ? 0 : size),
        ...(fitVars
          ? { '--gig-fit-tile': `${fitVars.tile}px`, '--gig-fx-cols': String(fitVars.fxCols) }
          : {}),
        ...(sideways && sidePlan
          ? {
              '--side-scene': `${sidePlan.scene}px`,
              '--side-pedal': `${sidePlan.pedal}px`,
              '--side-scene-cols': String(sidePlan.sceneCols || 1),
              '--side-chain-cols': String(sidePlan.chainCols || 1),
              '--side-above': `${sidePlan.above || 0}px`,
              '--side-below': `${sidePlan.below || 0}px`
            }
          : {}),
        ...(sideways ? { '--side-bar': String((tunerHere ? 1 : 0) + (onChain ? 1 : 0) + 1) } : {})
      }}
    >
      {/* The first thing on the first screen, as the phone's: where an eye starts. */}
      {demoCard ? <UnlockOffer price={demoCard.price} trial={demoCard.trial} onUnlock={demoCard.onUnlock} onPutAway={demoCard.onPutAway} /> : null}
      {/*
        THE FREE TRIAL ON PLAY (7 November 2026), as the phone's: while one
        runs, "Trial: 3 days left · Unlock", tappable to the unlock page; in
        the demo after a few minutes, its one card, put away with its ×.
      */}
      {trialNote?.kind === 'line' ? (
        <button type="button" className="chip trial-line" onClick={trialNote.onGo}>
          {trialNote.text}
        </button>
      ) : trialNote?.kind === 'nudge' ? (
        <div className="demo-card" role="region" aria-label={trialNote.text}>
          <div className="demo-card-words">
            <p className="demo-card-body">{trialNote.text}</p>
          </div>
          <button type="button" className="demo-card-unlock" onClick={trialNote.onGo}>
            {trialNote.go}
          </button>
          <button type="button" className="demo-card-close" onClick={trialNote.onPutAway} aria-label="Put this away">
            ×
          </button>
        </div>
      ) : null}
      {card ? <ComputerCard words={card.words} buttons={card.buttons} /> : null}
      {/*
        The name, big, with the slot in the small line over it: "PRESET 000
        OF 104", the phone's. The name stays large because that is this
        screen's job: it is the thing you read from arm's length, in the dark,
        to know where you are.
      */}
      {/*
        The biggest word on the screen was the one thing you could not press.
        Everyone tries — it names the preset, so it should be the way to a
        different one. It opens the same menu the top bar opens rather than a
        second list of its own: one preset picker, two ways in.
      */}
      {/*
        The volume is not here any more; it is behind the speaker in the bar.

        "Can we set that to be a slide-up menu? Put a sound button that looks
        like a speaker in the header." It had been a permanent row above the
        preset tile, which is a strip of the one screen whose currency is scene
        buttons you can hit without looking — for a control wanted twice a
        night. App renders it in a sheet now; TopBar opens it.
      */}

      {/*
        And why it isn't there, when it isn't.
        "The volume slider disappeared and no presets have sound." Both of
        those are one fact: the slider moves the output block's level, and this
        preset has no output block — so there is no level to move and nothing
        reaches the amp either. A control that vanishes without a word turns
        that into a mystery about the app. A unit whose outputs aren't a block
        on a grid is not accused of anything.
      */}
      {/* "Match your unit’s colors in Settings", once, in its turn: pressed, it opens Settings → Colors. */}
      <ColoursNotice waiting={noteAbove} onOpen={onOpenColours} />

      {meterEid === null && chain === 'ok' && !shown.elsewhere && blocks.length && capabilities?.slotModel !== 'linear' ? (
        <p className="gig-note">
          This preset has no Output block, so nothing reaches your amp and there is no volume to
          move — which is why the speaker is missing from the bar. Add one at the end of the chain
          on Edit, or build the preset again.
        </p>
      ) : null}

      {/* On its side the preset's name and Setlists are one short row (SideHead), here or up in the top bar. */}
      {sideways && !headUp ? sideHead : null}
      {sideways && headUp ? createPortal(sideHead, headSlot) : null}
      {sideways ? null : (
      <div className="gig-preset">
        {/*
          A tile, like the scenes under it, under the phone's line.

          "Make this button smaller, the same size as the presets, and add
          the preset number to it as well as the name." It was a headline —
          a name at 52px that wrapped to three lines on a phone, with the
          size steps crammed beside it. Now it is a tile, the height of one
          scene at the smallest size, with the name in it and the slot in the
          line directly above it: "PRESET 000 A01 OF 104", as the phone app
          says it, from where Play stands (`here`), so a press of Next moves
          it at once. The number was beside the name ("put the number inline
          with the name"); it sits over it now, as on the phone, and is not
          said twice. The same tap opens the same preset picker as the bar,
          and the line under the name and the arrow say so.
        */}
        <p className="gig-preset-line">
          {presetLine(Number.isInteger(here) ? slotLabel(here, capabilities?.presets?.addressing) : null, slotCount(capabilities))}
        </p>
        <button
          type="button"
          className="gig-name"
          onClick={onPickPreset}
          disabled={!onPickPreset}
          aria-label={`Preset ${Number.isInteger(here) ? here : '--'} — ${nameShown} — choose another preset`}
        >
          {/* The preset's colour tag, down its left edge, as it is on its row
              in the list and in a setlist (lib/colourPage tagFill: the one rule
              both ends draw the bar by). Nothing at all for a preset without
              one, so Play is as it was for everybody who never tags one. */}
          {presetTag(preset?.number) ? (
            <span className="gig-name-tag" aria-hidden="true" style={{ '--tag': presetTag(preset.number) }} />
          ) : null}
          {/* The name and the line under it, centred as a pair; the button centres the pair in the box. */}
          <span className="gig-name-row">
            <span className="gig-name-word">{nameShown}</span>
            <span className="gig-name-sub">{ALL_PRESETS}</span>
          </span>
          <Picture src={chevronIcon} className="gig-name-chevron" />
        </button>
        {/*
          The pencil that stood here — rename this preset or its scenes — is
          in Setup now, beside Read the unit again: "move the rename presets
          and scenes button to the settings menu". Renaming is bench work,
          and the tile row is the one a thumb crosses between songs.
        */}
      </div>
      )}

      {/* Named. A thin coloured line under the preset tile was the one thing on
          Play that never said what it was. Not on a phone (meterShown). */}
      {meterShown ? (
        <div className="gig-signal" aria-label="Signal level">
          <span className="gig-signal-word">Level</span>
          <div className="gig-signal-track">
            <div className="gig-signal-fill" style={{ width: `${Math.round(peak * 100)}%` }} />
          </div>
        </div>
      ) : null}

      {/*
        Two modes, one row.
        They were a stacked pair of full-width buttons — 98px of the screen,
        between the preset you just changed and the scenes you are about to
        press, for two things you enter occasionally and never mid-phrase. Side
        by side they cost one row, and the panel each opens still lands
        directly underneath, in view, where the tap was.

        Same rule as scenes for the tuner: a unit whose driver reports none
        doesn't get a button that can only disappoint. Absent means unknown —
        an older ForgeFX predating the flag — and unknown still gets to try.
      */}

      {tunerOn ? (
        <div className="gig-tuner">
          <Tuner reading={tuning} on={tunerOn} />
        </div>
      ) : null}

      {/*
        Your unit's screen not changing is not a fault.

        "On the AM4, hitting the tuner doesn't turn the tuner on the device."
        Correct, and deliberate — in the device server, not here. A gen-3 unit
        is sent a tuner-page open, which is why an FM3 lights up; the AM4's
        tuner block is always live, so it is simply polled and the unit is
        never switched into tuner mode. Same readings, no page. Said here
        because from the outside it looks exactly like a button that missed.
      */}
      {tunerOn && device?.gen ? (
        device.gen !== 3 ? (
          <p className="gig-note">
            Your {device.short || device.name || 'unit'} stays on the screen it&rsquo;s on &mdash; the
            app reads its tuner without switching the unit into tuner mode. Nothing is wrong.
          </p>
        ) : null
      ) : null}

      {/* The tuner is running — POST /tuner said ok — but nothing has arrived. */}
      {tunerOn && tunerStalled ? (
        <p className="gig-note">
          {remoteActive() ? (
            <>
              {/*
                This has been wrong twice, in opposite directions, and both cost
                somebody an evening. First "only the app at the Mac. Tune there."
                — false, a phone on the same wifi always worked. Then "readings
                don't cross the phone-remote link" — true when written, and no
                longer: the host bridges them now, throttled.

                So it stops naming a cause it cannot see. What is left is the two
                things that are actually still possible, in the order worth
                trying, and neither of them is a guess about the unit.
              */}
              No readings are reaching this {deviceNoun()}. The computer needs to be running this version of the
              app too &mdash; older ones don&rsquo;t send tuner readings over the link at all. On the
              same wifi as the computer it works either way.
            </>
          ) : (
            <>
              No readings are arriving from the unit. Some units only send them while their own tuner
              is engaged &mdash; on an AM4 that is holding the footswitch down rather than tapping
              it. If it is already engaged and making sound, the Fractal Remote app on the computer may need
              updating.
            </>
          )}
        </p>
      ) : null}

      {/* Scenes lead. A scene is the bigger move and it sets every block state
          below it, so cause sits above effect rather than under it. */}
      {hasScenes ? (
        <>
        {/*
          SCENES, with Refresh names beside it, the phone's: "Keep having
          issues showing the scene names on the AM4. Have a way to refresh
          them." The size of the heading: a thing reached for now and then,
          not a control on the stage. A class of its own (gig-head), never one
          that starts gig-scenes, which the tests find the grid by.
        */}
        <div className="gig-head" data-for="scenes">
          <h2 className="gig-head-word">Scenes</h2>
          <RefreshNames />
        </div>
        {/* Named as a group. On screen the grid is obvious enough in context;
            read aloud it was eight buttons called "1" through "8", between two
            other grids of buttons, with nothing saying what any of them do. */}
        <div className="gig-scenes" role="group" aria-label="Scenes" ref={scenesRef}>
          {/* Drawn in the layout's order; each tile is still its own scene —
              "5" says 5, wears 5's colour and picks scene 5 wherever it sits. */}
          {sceneOrderFor(sideways && sceneLayout !== 'mine' ? 'across' : sceneLayout, sceneCount, sceneOrder).map((i) => (
            <button
              key={i}
              className={`gig-scene ${i === scene ? 'current' : ''} ${
                names[i] ? 'named' : ''
              }`}
              /* Identity, not state. See sceneColors: the fill says which
                 scene, the edge-against-fill says whether it is the live one.
                 In this preset's own colour where it has one ("Just this
                 preset"), then yours for every preset, then the look's. */
              style={{
                '--scene-fill': sceneColor(i, preset?.number).fill,
                '--scene-ink': sceneColor(i, preset?.number).ink,
                ...(nameSizes[i] ? { '--name-size': `${nameSizes[i]}px` } : null)
              }}
              /* Its name is fitted (lib/sceneNameFit), which the styles let win over the compact Play's smaller sizes. */
              data-fit={nameSizes[i] ? 'yes' : undefined}
              /* Which scene this tile is, for the name's fit to find it by (lib/sceneNameFit). */
              data-scene={i}
              /* A colour somebody picked, which Fractal Remote draws at full
                 strength like every other look (styles.css, data-picked). */
              data-picked={sceneColor(i, preset?.number).picked ? 'yes' : undefined}
              /* The word "Scene" belongs in the label even though it is left
                 off the face, for the same reason the group is named: a bare
                 "3" is not a control anyone can identify. */
              aria-label={`Scene ${i + 1}${names[i] ? ` — ${names[i]}` : ''}`}
              /* The whole name on a hover, for one too long for the tile.
                 "Scene names cut short" — and a hold here is NOT the answer:
                 on Play a scene tile is a footswitch, and a long press that
                 does not switch the scene is the wrong surprise mid-song. */
              title={names[i] || undefined}
              aria-pressed={i === scene}
              onClick={() => pickScene(i)}
            >
              <span className="gig-scene-num mono">{i + 1}</span>
              {/* No name means no name — repeating the number as "Scene 3"
                  fills the row with a word that carries nothing, and makes an
                  unnamed scene look identical to a named one. */}
              {names[i] ? <span className="gig-scene-name">{names[i]}</span> : null}
              {/* The bar under the name, the phone's (components/Tile.js `bar`), on every scene, named or not: a piece of the scene's own colour where the eye is. */}
              <span className="gig-scene-bar" aria-hidden="true" />
            </button>
          ))}
        </div>
        </>
      ) : null}

      {/*
        What that grid of numbers is, said once, to the only people who cannot
        tell.

        A preset whose scenes are named explains itself — "1 Rhythm, 2 Lead"
        needs no caption, and adding one would put a permanent line of grey
        text above the control every player uses most. A preset where none of
        them are named is eight numbered buttons between two other grids of
        buttons, which is exactly where a newcomer stalls. So the caption is
        tied to the ambiguity rather than to being new: name one scene and it
        goes, for good.

        Not from a remote, where blank names can also be names the unit has
        and this end could not read: there Refresh names beside SCENES asks
        the unit again, and says in words what it found ("No names on the
        unit", "Couldn't read them"). The note that used to say they were not
        readable from away went when the names started coming over the link.
      */}
      {unnamedSettled && !remoteActive() ? (
        <p className="gig-note">
          {/* The route named here is one that really exists: the Scenes sheet
              on Edit renames one directly. The line that sent people to the
              AI's Create screen for named scenes went with the AI. */}
          Those are scenes &mdash; the same blocks, switched on and off in different combinations.
          {/* Not on a VP4, which the app cannot rename on yet (shared/vp4-safety.mjs VP4_NO_EDITS). */}
          {vp4Here() ? ' Tap one to hear it.' : ' Tap one to hear it. Name them yourself under Scenes on Edit.'}
        </p>
      ) : null}

      {/*
        CHAIN, with "Hold to switch channels" beside it, the phone's: "Where it
        says chain above the pedals, also put hold to switch channels. So
        users know that they can just hold the things to switch between
        channels, A B C and D." The heading follows the chain's read: Reading
        the chain while another preset's is on its way, out of date when a
        read failed. The hold's words only where a hold does something, by
        the hold's own rule (BlockTile `has`), over pedals read and drawn
        (holdHint).
      */}
      <div className="gig-head" data-for="chain">
        <h2 className="gig-head-word">
          <Picture src={chainIcon} className="gig-head-icon" />
          <span className="gig-head-text">{chainHeading(chainSaid)}</span>
        </h2>
        {holdHint ? <span className="gig-head-hint">{HOLD_FOR_CHANNELS}</span> : null}
      </div>

      {/* What the chain read said, in the phone's sentences, over the tip and the pedals as on the phone. */}
      {shown.elsewhere ? null : chain === 'failed' ? (
        <div className="gig-note gig-note-action">
          {/* The phone's sentence; not its "Pull down to ask again": this page does not pull to refresh (styles.css, overscroll), so its button asks. While the chain is read again only the heading says so. */}
          <span>{CHAIN_OUT_OF_DATE}</span>
          <button onClick={() => refreshBlocks()}>Try again</button>
        </div>
      ) : chain === 'ok' && !blocks.length ? (
        <p className="gig-note">{CHAIN_EMPTY}</p>
      ) : null}

      {!shown.elsewhere ? <ChainUpdating chain={shown} /> : null}

      {/*
        The tip about holding a pedal, directly over the pedals it is about
        (tipUp): "this tip appears here" is a promise about where. Over the
        waiting cards too, which stand where the pedals were, so a Next
        moves neither the card nor what is under it (the phone's Coach is
        over its grid, and the waiting cards are in the grid).
      */}
      {tipUp ? <Coach stage={tipStage} slug={deviceKey} onTry={tryTip} onSkip={onHoldTipClosed} onDone={onHoldTipClosed} /> : null}

      {held ? (
        <div className="gig-blocks-held" ref={blocksRef} style={{ height: held.height }}>
          <ChainWait chain={shown} cards={held.count} className="gig-chain-wait" onRetry={retryHere} />
        </div>
      ) : shown.elsewhere ? (
        <ChainWait chain={shown} className="gig-chain-wait" onRetry={retryHere} />
      ) : null}

      {/* Dimmed a little while they are only the outline: this preset's
          pedals, the chain read still finishing behind them. */}
      {!shown.elsewhere && blocks.length ? (
        <div className={`gig-blocks ${shown.late ? 'chain-updating' : shown.outline ? 'chain-outline' : ''}`} ref={blocksRef}>
          {blocks.map((block) => (
            <BlockTile
              key={block.effectId}
              block={block}
              channels={channels}
              busy={toggling === block.effectId}
              outline={shown.outline}
              /* An AM4 amp's pedal is its boost: what it shows (shared/am4-boost.mjs), or null for any other pedal. */
              boost={boostOf(block)}
              onToggle={() => toggle(block)}
              onHold={() => setChanEid(block.effectId)}
              icon={icons ? blockIcon(block.slug) : null}
            />
          ))}
          {/*
            THE LOOPER IS A PEDAL IN THE CHAIN, last, where the unit puts it.
            "Looper button should show up as a button in the chain like all
            the other effects — it should not be visible as its own button all
            the time. Then tapping the looper pedal button is what will bring
            up the controls." It is not an on/off switch (STAGE_HIDDEN still
            keeps the looper out of those): tapping it opens Record, Play and
            Stop, and never bypasses the block. The phone's Play does the same.
          */}
          {looperHere ? (
            <BlockTile
              key="looper"
              block={looperHere}
              door
              onToggle={() => setLooping(true)}
              icon={icons ? blockIcon('looper') : null}
            />
          ) : null}
        </div>
      ) : null}
      {/* Why a VP4's pedals say nothing until tapped: said once, and always there on a VP4, so nothing moves when it would go (the phone says the same). */}
      {!shown.elsewhere && blocks.length && vp4Here() ? <p className="gig-note">{VP4_ON_OFF_UNKNOWN}</p> : null}

      <Sheet open={looping && !!looperHere && !shown.elsewhere} onClose={() => setLooping(false)} title="Looper">
        {looperHere ? <Looper block={looperHere} presetNumber={preset?.number} /> : null}
      </Sheet>

      <ChannelSheet
        block={chanBlock}
        channels={channels}
        onClose={() => setChanEid(null)}
        onError={onError}
        onDropped={sayNotSent}
        /* A channel is a switch like a scene: the status read says what it
           changed, where a whole re-read would dump the preset. */
        onChanged={() => refreshSceneState()}
      />

      <Setlists
        open={setlistOpen}
        onClose={() => setSetlistOpen(false)}
        deviceKey={stage}
        preset={preset}
        slots={slots}
        addressing={capabilities?.presets?.addressing}
        favourites={favourites}
        lists={lists}
        source={source}
        /* Whether what is built here follows the account or stays on this
           phone — the note at the foot of the sheet says which. */
        synced={setlistCloudReady()}
      />

      {/*
        The bar along the bottom: the two things you press between songs.
        Sticky rather than fixed. Fixed would float over the last row of
        effects and, on iOS, fight the URL bar for the same strip of glass;
        sticky keeps its place in the layout — so nothing is ever underneath
        it — and still holds the bottom of the screen while the page scrolls at
        the larger sizes. At Smallest the page fits, and it simply sits where a
        bar should.

        Tuner only where the unit has one. Absent means unknown, an older host
        predating the flag, and unknown still gets to try.
      */}
      {/*
        The foot of the screen: Previous / Next, then Tuner, Edit and Tap,
        with Tap on the right where the thumb is (the phone's order: "move the
        edit button to the center and the tap tempo button to the right").

        "Move Previous / Next directly above the bottom tap bar." They sat
        between the volume and the scenes, which is where you read, not where
        your thumb rests. Both rows are one sticky footer now, so stepping
        presets is always where the bar is — at the bottom, under the thumb —
        however far the effects have scrolled.
      */}
      <div className="gig-foot" ref={footRef}>
      {/*
        Previous, the setlist, Next.

        "Hitting next or previous cycles through songs on the favorites or
        setlists." The two buttons walked the slots one at a time, which is
        the unit's order and never the night's. The button between them says
        what they walk now and opens the sheet that changes it; it sits in
        the same row so the footer costs the screen nothing more.
      */}
      <div className="gig-nav">
        <button className="gig-nav-step" onClick={() => step(-1)} disabled={landing(-1) === null && !(noSlotSteps && !order)} aria-label={behind.said}>
          ‹ Previous
          {/* What Previous will load, as tall as Next's line so the two words sit level. Always drawn, blank until a name is known. */}
          <span className="gig-nav-ahead" aria-hidden="true" ref={behindLine} style={behindSize ? { fontSize: behindSize } : undefined}>
            {behind.shown}
          </span>
        </button>
        {/* On its side Setlists is in the preset's row (SideHead), and these two stand at the ends of one row of five. */}
        {sideways ? null : (
        <button
          type="button"
          className={`gig-nav-source ${order ? 'on' : ''}`}
          onClick={() => setSetlistOpen(true)}
          aria-label={sourceAria}
        >
          {/* The word above the name: a lone "All" between Previous and Next
              read as a caption, not as the button that picks what those two
              step through. It says Setlist rather than Source because that is
              the name of the thing on every other screen; "source" named the
              mechanism, which is the app's business and not the player's. */}
          <span className="gig-nav-source-kind">Setlists</span>
          <span className="gig-nav-source-name">{order ? sourceName : 'All'}</span>
          {sourceWhere ? <span className="gig-nav-source-pos mono">{sourceWhere}</span> : null}
        </button>
        )}
        <button className="gig-nav-step" onClick={() => step(1)} disabled={landing(1) === null && !(noSlotSteps && !order)} aria-label={ahead.said}>
          Next ›
          {/* What Next will load. Always drawn, blank until a name is known, so nothing moves when one arrives. */}
          <span className="gig-nav-ahead" aria-hidden="true" ref={aheadLine} style={aheadSize ? { fontSize: aheadSize } : undefined}>
            {ahead.shown}
          </span>
        </button>
      </div>

      {/*
        The bar's look is BAR_LOOK's, the one line to change (see its comment).

        Tuner, then Edit: what is actually in the preset, which until now a
        phone could not see at all. "We need to be able to see what chain was
        written or what chain is currently on a setting." The tiles above
        this bar say which blocks are on and off; they do not say what order
        they are in, what is wired to what, or what any knob is set to. Edit
        opens the chain itself. Called Edit, because that is the tab it
        stands in for: a phone has no Play / Edit row, so this button IS the
        way to the chain and its knobs, and "Chain" did not say so: "EDIT is
        easy to miss."

        Then Tap, and the tempo on it, on the right where the thumb is. The
        same button Edit has beside its scene — see TapTempo, which says why
        there is one of them and not two.

        Each with the phone's picture and word, in the phone's order.
      */}
      <div className="gig-bar" data-look={BAR_LOOK} role="group" aria-label={barSays}>
        {tunerHere ? (
          /* Not aria-pressed: the words say it is on ("Stop tuner"), and a toggle whose name changes as well was read as Stop, pressed. */
          <button className={`gig-bar-btn ${tunerOn ? 'on' : ''}`} onClick={toggleTuner}>
            <Picture src={tunerIcon} className="gig-bar-icon" />
            {/* The words say it is on, as the phone's do; two lines where the button is narrow, never cut. */}
            <span className="gig-bar-word">{tunerOn ? 'Stop tuner' : 'Tuner'}</span>
          </button>
        ) : null}
        {onChain ? (
          <button
            className="gig-bar-btn gig-edit"
            onClick={onChain}
            aria-label="Edit — see the chain and its controls"
          >
            <Picture src={editIcon} className="gig-bar-icon" />
            <span>Edit</span>
          </button>
        ) : null}
        <TapTempo onError={onError} onChanged={onChanged} onDropped={sayNotSent} />
      </div>
      </div>

      {/*
        NOT CONNECTED, AND A DROPPED TAP, OVER THE SCREEN AND NEVER IN IT.
        Fixed in the middle of the window, where the eye already is, taking no
        touch and no room: the tiles under it do not move a pixel, and a tap
        through it still reaches its tile — and is told, here, that it went
        nowhere.

        Put on the page itself, as Sheet does, and not left inside Play. The
        screen Play is drawn in carries `will-change: transform` for its swipe
        (styles.css .screen), and that makes it the box anything "fixed"
        inside it is fixed to: the band sat 42% of the way down the Play
        SCREEN, not the window, and scrolled away with it. On a small phone
        held sideways, scrolled down to the pedals, a refused pedal tap was
        told nothing anyone could see — only the dimming showed. Gig is drawn
        only while Play is the screen on show, so this goes when Play does.
      */}
      {down || dropped
        ? createPortal(
            <div
              className="gig-down-band"
              role="status"
              aria-live="polite"
              ref={bandRef}
              /* Over the scenes, measured above; the stylesheet's 42% until it has been. */
              style={bandAt === null ? undefined : { top: bandAt }}
            >
              {down ? <span className="gig-down-word">{NOT_CONNECTED}</span> : null}
              {dropped ? <span className="gig-down-note">{dropped.words}</span> : null}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

/**
 * REFRESH NAMES, beside SCENES: the phone's (Stage.js RefreshNames). This
 * preset's scene names asked of the unit again, past anything kept, and the
 * answer said in the link's own place for a moment ("Names updated", "No
 * names on the unit", "Couldn't read them"), then Refresh names again. A
 * press while it reads does nothing. The words are shared/play-words.mjs's.
 */
function RefreshNames() {
  const [said, setSaid] = useState('idle')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const press = async () => {
    if (said === 'reading') return
    clearTimeout(timer.current)
    setSaid('reading')
    const out = await rereadSceneNames().catch(() => 'failed')
    setSaid(out)
    timer.current = setTimeout(() => setSaid('idle'), REFRESH_NAMES_SAID_MS)
  }
  return (
    <button type="button" className="gig-head-action" data-said={said} onClick={press} aria-label="Refresh scene names">
      {REFRESH_NAMES[said] || REFRESH_NAMES.idle}
    </button>
  )
}

/**
 * Which of a tile's corner words have room beside its picture, measured.
 *
 * "Looks like we need to fix the overlapping play word on the looper." The
 * browser draws the phone's tile and had the phone's fault: the corner row
 * costs the tile no height, the picture is centred in the rest, and at the
 * default size the picture rose into the corner row under the words. The
 * rule is the phone's too, in shared/tile-corners.mjs. This is only the
 * measuring, in the tile's own pixels from its outer edge.
 *
 * Measured again whenever the tile, its picture or a corner word changes
 * size — a resize, a step of the size control, the compact layout's shorter
 * tiles and smaller picture, On turning into Off — and once the fonts have
 * arrived, since a word measured in the fallback face is a different width.
 * A word that is not drawn keeps its place in the row but gives its room to
 * the one that is (styles.css), so its box can come out narrower than its
 * text; what is measured is the text, which no answer changes, so a second
 * measure gets the same answer. And the answer is only set when it changes.
 */
function useCornerFit({ tile, picture, band, left, right, middle = null }, pair, again) {
  const [fit, setFit] = useState(null)
  const measure = useRef(null)
  measure.current = () => {
    const box = tile.current
    if (!box || !box.offsetWidth) return
    const at = box.getBoundingClientRect()
    /* A tile under a finger is drawn at 97% (the press rule in styles.css),
       and a rect is measured as drawn. Every distance is put back at full
       size, so the tap that turns On into Off is measured like a tile at
       rest. */
    const k = at.width / box.offsetWidth || 1
    const rel = (el) => {
      const r = el.getBoundingClientRect()
      return {
        left: (r.left - at.left) / k,
        right: (at.right - r.right) / k,
        top: (r.top - at.top) / k,
        bottom: (r.bottom - at.top) / k,
        width: r.width / k
      }
    }
    /* The whole word, not what is left of its box: .gig-block-word cuts
       itself to its box, a hidden word hands its room to the word across
       from it, and the question is whether all of it fits. So the text is
       measured on its own and the pill's padding and border are put back
       from the stylesheet — not read from scrollWidth, which in some
       browsers leaves out the right-hand padding of a box its text overflows,
       and a pill measured short would be drawn, measured whole, hidden, and
       round again every frame. */
    const whole = (el) => {
      const s = getComputedStyle(el)
      const px = (v) => parseFloat(v) || 0
      const text = document.createRange()
      text.selectNodeContents(el)
      return text.getBoundingClientRect().width / k + px(s.paddingLeft) + px(s.paddingRight) + px(s.borderLeftWidth) + px(s.borderRightWidth)
    }
    const icon = picture.current ? rel(picture.current) : null
    const row = band.current ? rel(band.current) : null
    const l = left.current
    const r = right.current
    /* The two edges the words start from are the same distance in by the
       stylesheet; the larger of the two is the careful one to use. */
    const insets = [l ? rel(l).left : null, r ? rel(r).right : null].filter((n) => n !== null)
    /* The row's own gap between its two words, which the rule keeps clear
       too: two words that only fit by being squeezed into it are cut short. */
    const between = band.current ? parseFloat(getComputedStyle(band.current).columnGap) : NaN
    const corners = {
      width: box.offsetWidth,
      picture: icon ? icon.width : 0,
      pictureTop: icon?.top,
      bandBottom: row?.bottom,
      inset: insets.length ? Math.max(...insets) : undefined,
      left: l ? whole(l) : null,
      right: r ? whole(r) : null,
      between: Number.isFinite(between) ? between : 0,
      pair
    }
    let next = { ...cornerFit(corners), middle: false, at: null, top: 0, height: 0 }
    /*
     * A WORD THAT MUST BE SEEN (an AM4 amp's boost), placed by the phone's
     * rule (shared/tile-corners.mjs mustSayFit): beside the picture where it
     * fits there; otherwise in its own corner with the picture cleared from
     * under it (`at` 'corner'), the channel beside it where the row holds
     * both; only a word too wide for its row goes across the tile, over the
     * picture's box (`at` 'across'), the channel measured against where the
     * word is drawn there. The picture keeps its box, unseen, so nothing the
     * rule measured moves.
     *
     * Drawn here at every placement, beside the picture too, in the body
     * face, and measured as itself: drawn beside the picture in the corner's
     * own face, wider than the body's, a tap changed the face and the channel
     * with the word. With pictures off, Boost on in the corner's face fitted
     * its row and Boost off did not, so Boost off was drawn in the body face
     * and Boost on in the corner's, and at 390 Medium the channel came and
     * went with each tap. The phone's word is in one face at every placement
     * too.
     *
     * Taken on the unlit tile's corner row, lit or not: an unlit tile's 2px
     * edge (styles.css button.gig-block.off) sets the row a pixel lower and
     * further in than a lit tile's 1px, and measured as drawn the picture
     * was in the row when unlit and under it when lit, so every tap moved the
     * word, the picture and the channel.
     */
    const m = middle?.current
    if (m && Number.isFinite(corners.inset)) {
      const lift = Math.max(0, UNLIT_EDGE - (parseFloat(getComputedStyle(box).borderTopWidth) || 0))
      const word = m.firstElementChild || m
      const spot = icon || row
      const top = spot ? spot.top : 0
      const height = spot ? spot.bottom - spot.top : 0
      const tall = word.getBoundingClientRect().height / k
      /* The word as it is drawn, in the body face, is the one the rule places, beside the picture too. */
      corners.left = whole(word)
      const say = mustSayFit(corners, { moved: whole(word), movedTop: top + Math.max(0, (height - tall) / 2), lift })
      /* Drawn here wherever it goes ('beside' the picture too); the picture cleared only when it has moved. */
      next = { left: false, right: say.right, middle: !!say.at, at: say.at || 'beside', top, height }
    }
    setFit((was) =>
      was && was.left === next.left && was.right === next.right && was.middle === next.middle && was.at === next.at && was.top === next.top && was.height === next.height
        ? was
        : next
    )
  }
  /* Before the first paint, so the words are never drawn in the wrong place
     even for a frame. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    measure.current()
  }, again)
  useEffect(() => {
    let gone = false
    /* Answered before the frame is drawn, not after. A ResizeObserver is
       told between the layout and the paint, but a state set there is drawn
       a frame later — and a window going from wide to phone-width drew that
       frame with the wide answer, Play on the looper's picture: "the
       overlapping play word on the looper", for one frame on every resize.
       flushSync puts the answer on the screen before the paint. */
    const now = () => {
      if (!gone) flushSync(() => measure.current())
    }
    /* Only when the tile itself changed size. Hiding a word changes the size
       of the word boxes (it hands its room across), and a browser that sees
       a box change size at the depth it was just told about, inside the same
       frame, gives up with an error — which the crash log would keep. Words
       are deeper in the tile than the tile, so a tile's change is safe to
       answer at once; a word's or the picture's alone is answered in the
       ordinary way, a frame later, where nothing moves under it. */
    const look = (seen) => {
      if (gone) return
      if (seen.some((e) => e.target === tile.current)) now()
      else measure.current()
    }
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(look)
    for (const ref of [tile, picture, left, right, middle]) if (watch && ref?.current) watch.observe(ref.current)
    /* Outside the frame's own work, so at once is always safe here. */
    document.fonts?.ready?.then(now)
    return () => {
      gone = true
      watch?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, again)
  /* Hidden until measured: a word that will not fit never flashes over the
     picture on the first frame. */
  return fit || { left: false, right: false, middle: false, at: null, top: 0, height: 0 }
}

/* The edge of an unlit block tile (styles.css button.gig-block.off), which a word that must be seen is measured with, lit or not (useCornerFit). */
const UNLIT_EDGE = 2

/**
 * One block on the stage screen: tap to switch it, hold to change its channel.
 *
 * "If you can hold one of the effects for a few seconds, it would be cool to
 * have a pop-up where you can quickly switch channels from ABCD... On the Mac
 * version, maybe we can do a right click."
 *
 * Both, and on the web — a hold is a pointer that stays put and a right-click
 * is an event browsers have always sent, so none of this waits on the phone
 * apps that do not exist yet.
 *
 * The channels were reachable already, on the Edit screen, three taps into a
 * sheet. That is the right place to study a block and the wrong one to change
 * it between two bars of a song, which is the whole reason this screen exists.
 *
 * The hold is answered by Gig, which owns the one channel sheet; the tile
 * only says it was held.
 */
function BlockTile({ block, channels, busy, outline = false, onToggle, onHold, icon, door = false, boost = null }) {
  /* Repaint when the colours change (lib/useLooks). */
  useLooks()
  /* Only where there is something to choose. Not every block is channelled,
     and a menu with one entry in it is a menu that wasted a gesture. And not
     on the outline drawn ahead of the chain read: a channel waits for it. */
  const has = (channels?.length || 0) > 1 && !outline && !door
  const hold = useLongPress(
    () => {
      haptic()
      onHold?.()
    },
    { enabled: has && !busy }
  )

  /*
   * A pedal read ahead of the switch whose on or off the unit has not said
   * yet. On the play test every one of them read On for a quarter of a second
   * and half of them then flipped to Off. Drawn dim with no word instead, the
   * ones that are on light up when the status read lands, and nothing is
   * contradicted.
   */
  /*
   * The looper's door says Rec and Play, except on a real VP4: there it opens
   * one sentence (VP4_NO_LOOPER, components/Looper), since no computer app can
   * work a VP4's looper, and it is drawn like the VP4's other pedals. It was
   * lit, as if on, over an on/off nobody had read. The phone's does the same.
   */
  const rec = door && !vp4Here()
  /* And every pedal of a real VP4 that the player has not tapped: nothing reads a VP4's on/off (shared/vp4-safety.mjs VP4_ON_OFF_UNKNOWN). */
  /*
   * And an AM4's amp, whose pedal is its boost (shared/am4-boost.mjs):
   * `boost` is what it shows, Boost on, Boost off, Amp off while the amp
   * itself is off in this scene, or nothing until the unit has said. Lit for
   * Boost on only. The amp's own on and off stays in the editor.
   */
  const unknown = boost ? boost === BOOST.unknown || boost === BOOST.other : !rec && (outline || vp4Here()) && typeof block.bypassed !== 'boolean'
  const dark = boost ? boost !== BOOST.on : unknown || block.bypassed
  /* Its word, which is always seen: in its corner, or in the picture's place where the corner has no room. */
  const said = boost ? boostWord(boost) : null

  /*
   * THE TWO CORNERS. An effect says On or Off at the top left and its channel
   * at the top right; the looper's door says Rec at the top left and Play at
   * the top right, with its picture between them. "Looks like we need to fix
   * the overlapping play word on the looper": the whole of "Rec · Play" in
   * one corner reached past the middle of the tile, under the picture. The
   * door's two words are one phrase, so they show together or not at all.
   *
   * Measured again when what they say changes — On to Off, a channel arriving
   * — as well as when anything changes size.
   */
  const tileRef = useRef(null)
  const pictureRef = useRef(null)
  const bandRef = useRef(null)
  const wordRef = useRef(null)
  const acrossRef = useRef(null)
  const middleRef = useRef(null)
  const shows = useCornerFit(
    { tile: tileRef, picture: pictureRef, band: bandRef, left: wordRef, right: acrossRef, middle: said ? middleRef : null },
    rec,
    [rec, unknown, block.bypassed, block.channel, !!icon, boost]
  )

  return (
    <div className="gig-block-cell">
      <button
        ref={tileRef}
        className={`gig-block ${dark ? 'off' : 'on'}`}
        /* A VP4 pedal nobody has tapped is drawn with a dashed ring, so it is
           never mistaken for an Off: at a narrow width the corner word has no
           room, and the two were the same tile, so a first tap (which sends
           Off) looked like it did nothing and invited a second (styles.css).
           No apostrophes in here: test/both-ends.mjs reads this tag by hand. */
        data-unknown={unknown && (vp4Here() || boost) ? 'yes' : undefined}
        /* Grey when off, if that is the choice in Settings → Colours: a dark
           tile with a grey edge, as the unit draws a bypassed block (styles.css). */
        data-off={offMode() === 'grey' ? 'grey' : undefined}
        style={{
          '--block-fill': blockColor(block.slug).fill,
          '--block-ink': blockColor(block.slug).ink
        }}
        onClick={onToggle}
        disabled={busy}
        /* The looper pedal opens its buttons rather than switching it, so it
           is not a toggle and does not say it is one. */
        aria-pressed={door || unknown ? undefined : !dark}
        /* Said in words rather than left to the corners: a corner word with
           no room is hidden, and a hidden word is not read out either. The
           same three things the tile read before, in the order it drew them. */
        aria-label={
          rec
            ? 'Looper — open Record, Play and Stop'
            : [block.name || block.slug, boost ? boostLabel(boost) : unknown ? null : block.bypassed ? 'Off' : 'On', block.channel].filter(Boolean).join(', ')
        }
        /* The heading says it beside CHAIN ("Hold to switch channels"); a
           mouse resting on a tile is told too, with right-click. */
        title={boost ? boostTitle(boost, has) : has ? 'Tap to switch on or off. Hold, or right-click, to switch channels.' : undefined}
        {...hold}
      >
        {/*
          Two names, one shown at a time by CSS.

          Four effects to a row leaves about ninety pixels a tile, and a whole
          name in ninety pixels is an ellipsis. The abbreviation is what a
          player reads at that width; the full name is what a mouse hovers and
          what a screen reader says, so both are here and neither is faked with
          a character count in JavaScript.
        */}
        <span className="gig-block-name" title={block.name || block.slug}>
          {/*
            The picture, above the name, the way the AM4 draws it — and the
            phone too, at every size. The same file at both ends — see
            shared/block-icons.mjs.
          */}
          {icon ? (
            <span
              ref={pictureRef}
              className="gig-block-icon"
              aria-hidden="true"
              /* Kept in its place, unseen, while a word that must be seen is in its place or over it. */
              data-said={shows.middle ? 'yes' : undefined}
              style={{ WebkitMaskImage: `url(${icon})`, maskImage: `url(${icon})` }}
            />
          ) : null}
          <span className="gig-block-full">{block.name || block.slug}</span>
          <span className="gig-block-abbr mono" aria-hidden="true">
            {shortBlock(block)}
          </span>
        </span>
        <span className="gig-block-state" ref={bandRef}>
          {/* One line, always, and never cut short: a word with no room
              beside the picture is not drawn at all (data-crowded). The
              door's words are the looper's own names for the two buttons
              it opens, so the tile and the sheet cannot disagree. */}
          <span className="gig-block-word" ref={wordRef} data-crowded={shows.left ? undefined : 'yes'}>
            {rec ? LOOPER_LABEL.record : boost ? boostWord(boost) || '\u00a0' : unknown ? '\u00a0' : block.bypassed ? 'Off' : 'On'}
          </span>
          {/* The door's other half, in the corner an effect keeps for its
              channel — set like the word across from it, not like the
              channel's pill, because it is the rest of the same phrase. */}
          {rec ? (
            <span className="gig-block-word gig-block-word-end" ref={acrossRef} data-crowded={shows.right ? undefined : 'yes'}>
              {LOOPER_LABEL.play}
            </span>
          ) : null}
          {/*
            The channel, in the top right corner, across from the on/off in
            the top left.

            A scene remembers a channel per block, and each channel holds its
            own models and values — so which one a block is on is half of what
            the scene is, and the tile said nothing about it. "On this screen,
            also list the channels (A/B/C/D) on each block."

            Only when the block has one: not every block is channelled, and a
            bare letter on something without channels would be a lie about the
            hardware.
          */}
          {/* Not on the looper's door: its top right says Play, and a looper
              has no channel worth a letter. The phone's has none either. */}
          {block.channel && !door ? (
            <span className="gig-block-channel" ref={acrossRef} data-crowded={shows.right ? undefined : 'yes'}>
              {block.channel}
            </span>
          ) : null}
        </span>
        {/*
          An AM4 amp's Boost on, Boost off or Amp off, which is the whole of
          what its tap does, and so is always seen: where its corner has no
          room beside the picture (most phone widths), it is drawn here, in
          its own corner with the picture kept unseen under it and the
          channel beside it where the row holds both, or, too wide for the
          row, across the tile over the picture's box (useCornerFit). Laid
          out always so it is measured before it is needed.
        */}
        {said ? (
          <span
            className="gig-block-state gig-block-said"
            ref={middleRef}
            aria-hidden="true"
            data-shown={shows.at ? 'yes' : undefined}
            data-at={shows.middle ? shows.at : undefined}
            style={shows.at === 'across' ? { top: `${shows.top}px`, height: `${shows.height}px` } : undefined}
          >
            <span>{said}</span>
          </span>
        ) : null}
      </button>
    </div>
  )
}

/**
 * The channels of one block, as a sheet that slides up from the bottom.
 *
 * "It's tiny right now. Maybe pull up a slide-up menu when you hold the
 * button down to switch between A B C D?" Four buttons the height of a
 * scene tile and a quarter of the screen wide each, under the block's name,
 * on the same sheet every other picker in the app uses — so it slides up
 * the same way, is dragged down the same way, and Escape and Back close it
 * the same way. The one that is live is lit; a tap on another writes it,
 * and the sheet goes down on the way out rather than on the way back: the
 * write goes down a serial port, and a sheet that sits there through it
 * reads as a tap that missed.
 */
function ChannelSheet({ block, channels, onClose, onError, onDropped, onChanged }) {
  const [writing, setWriting] = useState(null)
  const name = block?.name || block?.slug || ''

  const pick = async (ch) => {
    if (!block) return
    /* A press, with its deadline from now; refused at once while the link is down (forgefx request). */
    const deadline = tapDeadline()
    haptic()
    setWriting(ch)
    try {
      await setChannel(block.effectId, ch, { deadline })
      onClose()
      onChanged?.(`${name} → channel ${ch}`)
    } catch (err) {
      if (err?.notSent && onDropped) {
        onClose()
        onDropped(err)
      } else onError?.(err.message)
    } finally {
      setWriting(null)
    }
  }

  return (
    <Sheet open={!!block} onClose={onClose} title={name} note="Channel">
      <div className="gig-chan" role="group" aria-label={`Channel for ${name}`}>
        {(channels || []).map((ch) => (
          <button
            key={ch}
            className={`gig-chan-btn ${block?.channel === ch ? 'current' : ''}`}
            onClick={() => pick(ch)}
            disabled={writing !== null}
            aria-pressed={block?.channel === ch}
            aria-label={`Channel ${ch}`}
          >
            {ch}
          </button>
        ))}
      </div>
      <p className="hint">
        {block?.channel ? `${name} is on channel ${block.channel}.` : ''} Each channel keeps its own
        model and settings; the scene remembers which one this block plays.
      </p>
    </Sheet>
  )
}
