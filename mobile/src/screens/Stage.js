import { useCallback, useEffect, useRef, useState } from 'react'
import { Image, PixelRatio, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { useKeepAwake } from 'expo-keep-awake'

import { color, font, radius, space, TAP } from '../lib/theme'
import { bandTop, tileWidth as tileWidthIn } from '../lib/tileGrid'
import { hostConflict, remoteChosenHost, remoteHosts } from '../lib/relay'
import { idOf, presetLabel, sameBlock, sceneShape, slotCount, slotLabel, stepSlot, vp4Here } from '../lib/device'
import { VP4_ON_OFF_UNKNOWN, vp4StepWords } from '../lib/vp4-safety'
import {
  applySong,
  listsFor,
  marksFor,
  nextWords,
  orderFor,
  positionIn,
  previousWords,
  songFor,
  sourceFor,
  sourceLabel,
  stepTarget
} from '../lib/lists'
import { sync, useStored } from '../lib/store'
import { nameOf, useNamesHeard } from '../lib/presetNames'
import {
  SIZES,
  fitTiles,
  loadFit,
  loadIcons,
  loadSceneLayout,
  loadSceneOrder,
  loadSize,
  sceneColsFor,
  sceneOrderFor
} from '../lib/gigSize'
import {
  arrivedCurrent,
  clearError,
  loadPreset,
  readAhead,
  refreshAll,
  awayNow,
  rereadSceneNames,
  sayFault,
  songLate,
  tapTempo,
  useRig,
  writeBypass,
  writeChannel,
  writeScene,
  writeTempo,
  writeTuner
} from '../lib/rig'
import { useDemoUnit } from '../lib/demo'
import { coachSeen, markCoach, markWatchTip, watchTipSeen } from '../lib/coach'
import { nope, thud } from '../lib/feedback'
import { blockColor } from '../lib/blockColors'
import { blockIcon } from '../lib/blockIcons'
/*
 * The pictures, cut out of Justin's own mockup of this screen. Assets rather
 * than an icon font on purpose: a font is native code, and native code costs a
 * build — see mobile/assets/icons. These are white in the file and tinted
 * wherever they land.
 */
import chevronIcon from '../../assets/icons/chevron.png'
import chainIcon from '../../assets/icons/chain.png'
import editIcon from '../../assets/icons/edit.png'
import tempoIcon from '../../assets/icons/tempo.png'
import tunerIcon from '../../assets/icons/tuner.png'
import { sceneColor } from '../lib/sceneColors'
import { shortBlock } from '../lib/shortName'
import { useWatchBridge, watchHow, watchPaired } from '../lib/watchBridge'
import { findLooper } from '../lib/looper'
import UnlockOffer from '../components/UnlockOffer'
import Vp4DemoNote from '../components/Vp4DemoNote'
import OnlyOnThisPhone from '../components/OnlyOnThisPhone'
import ColoursNotice from '../components/ColoursNotice'
import Toast, { useStillNews } from '../components/Toast'
import { droppedLeft, faultLeft } from '../lib/fault-rule'
import { NOT_CONNECTED } from '../lib/relay-rules'
import Note from '../components/Note'
import NoComputerWords from '../components/NoComputer'
import SendLinkButton from '../components/SendLinkButton'
import { fixById, fixFor } from '../lib/troubleshooting'
import Press from '../components/Press'
import TempoDot from '../components/TempoDot'
import Tile from '../components/Tile'
import Coach from '../components/Coach'
import Looper from '../components/Looper'
import Sheet from '../components/Sheet'
import TempoBox from '../components/TempoBox'
import { tempoRange } from '../lib/tempo'
import Tuner from '../components/Tuner'
import ChainWait, { ChainUpdating, useChain } from '../components/ChainWait'
import { deviceNoun } from '../lib/device-word'

/* Hoisted: a selector rebuilt each render re-reads the store on every notify. */
const ofPreset = (s) => s.preset
const ofBlocks = (s) => s.blocks
const ofAllBlocks = (s) => s.allBlocks
const ofScene = (s) => s.sceneIndex
const ofSceneNames = (s) => s.sceneNames
const ofCaps = (s) => s.capabilities
const ofChain = (s) => s.chain
const ofTunerOn = (s) => s.tunerOn
const ofTuning = (s) => s.tuning
const ofBpm = (s) => s.bpm
const ofError = (s) => s.error
const ofErrorLink = (s) => s.errorLink
const ofDropped = (s) => s.dropped
const ofDroppedAt = (s) => s.droppedAt
const ofFaultAt = (s) => s.faultAt
const ofSlug = (s) => s.deviceSlug

/**
 * The stand, not the bench.
 *
 * Nothing here designs anything. On stage you need to know what preset you're
 * on, get to the next one, switch scenes, turn a block off, and check you're in
 * tune — with targets big enough to hit without looking closely, on a phone, in
 * the dark, possibly mid-song.
 *
 * Everything the desktop app can do and this cannot is deliberate. A generate
 * button within reach of a stage tap is a hazard, and saving to a slot is
 * refused by the Mac anyway.
 */
export default function Stage({
  onOpenPresets,
  onOpenSetlists,
  onOpenEdit,
  onOpenFix,
  onUnlock,
  onAccount,
  /*
   * NO COMPUTER HAS EVER SIGNED IN WITH THIS ACCOUNT, for certain: the email
   * to name, from App (lib/useNoComputer.js), and null for anything less
   * than a definite no. The advice card below then says that instead of
   * "make sure the computer is awake", which for somebody who never set one
   * up was advice about nothing.
   */
  noComputer = null,
  /*
   * THE LINK TO THE RIG IS DOWN (`down`, from App: link.js's own word for it,
   * never in the demo). "When the link drops, Play says so right away. The
   * tiles go dim under NOT CONNECTED." Opacity and one floating word, below:
   * nothing moves, and a tap still says why it went nowhere.
   */
  down = false,
  lost = false,
  lostAway = false,
  onPutAway,
  onLookAgain
}) {
  // The screen is the instrument panel for as long as this is open. A phone
  // that locks itself between songs is a phone you have to wake and unlock
  // while the count-in is happening.
  useKeepAwake()

  const preset = useRig(ofPreset)
  const blocks = useRig(ofBlocks)
  /* Every block, the three the stage leaves out included — for the looper line. */
  const allBlocks = useRig(ofAllBlocks)
  const scene = useRig(ofScene)
  const sceneNames = useRig(ofSceneNames)
  const caps = useRig(ofCaps)
  const chain = useRig(ofChain)
  /*
   * Whose tiles these are. A preset picked here goes up by name on the tap
   * and its chain a moment later; in between the tiles were the last song's,
   * live, and a tap switched whatever the new preset has under the same
   * number. Now grey cards stand in for them. See lib/chain-view.
   */
  const chainNow = useChain()
  const tunerOn = useRig(ofTunerOn)
  const tuning = useRig(ofTuning)
  const bpm = useRig(ofBpm)
  const device = useRig(ofSlug)
  /*
   * What Previous and Next step through, and where you are in it.
   *
   * Re-read on every write to storage — the star is pressed on the picker and
   * the setlist is chosen on the screen behind this one, and the count between
   * the two buttons has to follow both. `useStored` is the phone's version of
   * the browser's two window listeners and its counter in state.
   */
  useStored()
  const favourites = marksFor(device).favourites
  const lists = listsFor(device)
  const source = sourceFor(device)
  const order = orderFor(source, { favourites, lists })
  /*
   * Whether somebody is typing a tempo. The box itself, what is in it and what
   * it refuses all live in components/TempoBox — it is an overlay, and holding
   * its state out here is how the keyboard came to be covering it.
   */
  const [typing, setTyping] = useState(false)
  const fault = useRig(ofError)
  const faultLink = useRig(ofErrorLink)
  const faultAt = useRig(ofFaultAt)
  const dropped = useRig(ofDropped)
  const droppedAt = useRig(ofDroppedAt)
  /* The fault while it is still news (lib/fault-rule faultLeft). Hidden, never
     cleared: App tells a rig that failed its first read by the store's copy.
     And kept up while nothing has been read at all: on an empty screen it is
     the only thing saying why. */
  const left = caps ? faultLeft({ error: fault, errorLink: faultLink, faultAt }, Date.now()) : Infinity
  const news = useStillNews(fault, faultAt, left)
  /* And a dropped tap's note while it is still news: briefly (lib/fault-rule droppedLeft). */
  const droppedNews = useStillNews(dropped, droppedAt, droppedLeft({ dropped, droppedAt }, Date.now()))
  /*
   * THE COMPUTER GONE FOR FIFTEEN SECONDS (`lost`, from App: a rig on this
   * screen, the link down that long, not over Bluetooth). A complaint about
   * the link itself gives way to the advice card (the second Toast, below),
   * which says the same thing and what to do about it; anything else wrong is
   * still said first, and the advice waits behind it.
   */
  /*
   * A DROPPED TAP IS SAID UNDER NOT CONNECTED, NEVER IN THE CARD
   * (`dropped`: "Not sent — not connected", lib/fault-rule). In the one
   * card at the top it did four things wrong: its words matched the
   * troubleshooting guide's "not connected", so every refused tap also put
   * up a big "What to try" button over the preset button for a thumb on its
   * way there; it pushed the fifteen-second advice and its Look for the
   * computer again off the screen for as long as somebody kept tapping; with
   * a screen reader on, which holds a note until its ✕, one refused tap kept
   * the advice away until the link was back; and it took the place of the
   * card about the link — "The connection dropped before your computer
   * answered.", the one thing saying the tap before may have landed — which
   * never came back after it. So it has its own field in the store, floats
   * in the middle with NOT CONNECTED (below), takes no touch, and the card
   * is left for faults and the advice. The browser says it in the same place.
   */
  const error = news && !(lost && faultLink) ? fault : null
  const droppedNote = droppedNews ? dropped : null
  /* Put away with its ✕ until the computer has answered again (`lostAway`).
     Held by App, not here: a look at Setlists or Settings takes this screen
     away, and the card came straight back with it. */

  const [refreshing, setRefreshing] = useState(false)
  /*
   * How wide a row of tiles actually is. Measured rather than assumed, because
   * the answer is the phone's width less this screen's padding, and neither is
   * a number worth writing down twice.
   */
  const [grid, setGrid] = useState(0)
  /*
   * And what to draw with until the measurement lands.
   *
   * "After going to setlists and going back it shows this screen sized wrong
   * for a split second." It did, every time, and on every cold start too — a
   * screen that comes back is a screen that mounts again, so `grid` was 0 for
   * the first frame, `tileWidth` had no width to divide, and every tile fell
   * back to the width of the word on it. Eight scenes six across, then a jump.
   *
   * The honest width is no mystery: this screen is the window less its own
   * padding, and both numbers are right here. So that is what the first frame
   * uses, and the measurement corrects it the moment it arrives — which keeps
   * `onLayout` the authority for anything this arithmetic cannot know about,
   * a tablet in split view among them.
   */
  const { width: screen } = useWindowDimensions()
  const row = grid || Math.max(0, screen - space.lg * 2)
  /*
   * How big the tiles are, chosen in Setup and kept under the browser's own
   * key. Read here rather than passed down, because `useStored` above already
   * re-renders this screen on every write to storage.
   */
  const size = SIZES[loadSize(sync)] || SIZES[1]
  /* The effect pictures, unless they were turned off in Settings. */
  const showIcons = loadIcons(sync)
  /* Across, down the two sides, like the unit, or in his own order — chosen
     on the Appearance page and only there. See gigSize. */
  const sceneLayout = loadSceneLayout(sync)
  const sceneCols = sceneColsFor(size, sceneLayout)
  /*
   * SMALLEST MEANS IT FITS. "On the smallest setting, if we could make it so
   * the screen won't scroll and everything fits on the screen — it's barely
   * hanging off the edge." The tiles were already at their smallest, but
   * everything around them was at its ordinary size: the gaps between
   * sections, the padding under the foot, the preset button's extra height,
   * and a chain tile that would not go below the stage floor of 56 even when
   * the scene tiles beside it were 48. At the smallest step the screen is
   * being asked to fit, so all of that gives too — and nothing pressable goes
   * below the platform's own 44.
   */
  const tight = size === SIZES[0]

  /*
   * FIT ON SCREEN: the screen decides the height, not a step on the ladder.
   *
   * "Make one that says fit on screen, and if they click that, it'll just make
   * sure whatever size device they're on, all of those will fit onto the
   * screen so they don't have to manually push up and down for sizes and then
   * go back to the play screen to see what it did and then go back."
   *
   * That round trip is the whole complaint, and no fixed step can end it: a
   * step is a number of pixels, and whether a rig fits at that number depends
   * on the preset in front of you and the phone in your hand. So this measures
   * instead — the browser has done it this way since "everything static on the
   * screen without being able to scroll", and this is the same arithmetic
   * against React Native's measurements rather than the DOM's.
   *
   * CHROME IS WHAT IS LEFT OVER. Everything here that is not a tile — the
   * preset button, the notes, the tempo and tuner at the foot — has a height
   * that does not depend on the tile size. So it is the content's whole height
   * less the two grids, and whatever the viewport has left after THAT is what
   * the grids may share.
   *
   * It settles rather than oscillating: the grids are subtracted out of the
   * measurement, so the chrome figure does not move when the tiles resize.
   */
  const scenes = sceneShape(caps)
  const [viewport, setViewport] = useState(0)
  const [content, setContent] = useState(0)
  const [sceneGrid, setSceneGrid] = useState(0)
  const [blockGrid, setBlockGrid] = useState(0)
  const fitOn = loadFit(sync, true)
  const chrome = Math.max(0, content - sceneGrid - blockGrid)
  /*
   * WHAT THE PREDICTION MISSED, MEASURED RATHER THAN GUESSED AT AGAIN.
   *
   * "This is set to the fit to screen setting but the tempo numbers are
   * cutting off."
   *
   * fitTiles works out how tall a tile may be and assumes every row comes out
   * that tall. Tiles take it as a MINIMUM — a scene tile carrying a number
   * over a name grows past it — so the grids landed taller than the budget
   * they were given, and the footer went off the bottom of the screen. Worse,
   * it was STABLE there: chrome and the budget both stay put, so it settled
   * overflowing and stayed overflowing.
   *
   * Rather than teach the prediction about every way a tile can grow — the
   * two-line name, the block rows being 12 shorter, whatever is added next —
   * this measures what actually happened and takes it off the budget. It only
   * ever grows within a layout, so it converges in a frame or two instead of
   * oscillating, and it is thrown away whenever the thing being fitted
   * changes.
   */
  const [trim, setTrim] = useState(0)
  /*
   * THE PEDALS' ROOM IS KEPT WHILE THE NEXT PRESET LOADS.
   *
   * "When changing presets using previous or Next it shrinks the screen down
   * for about a half a second." Between a preset change and its chain the
   * tiles go and grey cards stand in — and the cards were a different size
   * from the tiles, so the pedal area shrank, the fit worked the screen out
   * again for a chain of no blocks, and Previous, Next, Tap and the rest
   * jumped up the screen and back down when the chain landed.
   *
   * So the wait takes the last drawn chain's place exactly: as many cards as
   * there were tiles, in the same height, and the fit keeps counting those
   * blocks until the real ones arrive.
   */
  /*
   * THE LOOPER IS A PEDAL IN THE CHAIN. "Looper button should show up as a
   * button in the chain like all the other effects — it should not be visible
   * as its own button all the time. Then tapping the looper pedal button is
   * what will bring up the controls." So it is one more tile, last in the
   * chain where the unit puts it, and the fit counts it like any other.
   */
  const looperHere = findLooper(allBlocks)
  const looperTile = !chainNow.elsewhere && !!looperHere
  /*
   * ON A REAL VP4 IT OPENS ONE SENTENCE, not Rec and Play. No computer app can
   * work a VP4's looper (each of its eight buttons was refused, "The app can't
   * do that on a VP4 yet"), and nothing reads a VP4's on/off, so the pedal was
   * drawn lit, as if on, right above "The app can't see whether a VP4's
   * effects are on or off". So on a VP4 it is drawn like the other pedals:
   * lit only when the VP4's on/off is known to be on, with no Rec and no Play,
   * and a tap opens the sheet with lib/vp4-safety VP4_NO_LOOPER in it
   * (components/Looper). The browser's Play does the same.
   */
  const vp4Looper = looperTile && vp4Here()
  const looperState = typeof looperHere?.bypassed === 'boolean' ? (looperHere.bypassed ? 'Off' : 'On') : '\u00a0'
  const tiles = blocks.length + (looperTile ? 1 : 0)
  const heldGrid = useRef({ count: 0, height: 0 })
  if (!chainNow.elsewhere && tiles > 0 && blockGrid > 0) heldGrid.current = { count: tiles, height: blockGrid }
  const held = chainNow.elsewhere && heldGrid.current.height > 0 ? heldGrid.current : null
  const fitBlocks = held ? held.count : tiles
  /* The "Updating…" line stands in for a moment and goes: a trim measured
     over it is not the grid's, and is dropped with it. The grey cards no
     longer count — they hold the grid's own height. */
  const fitKey = `${viewport}:${scenes.hasScenes ? scenes.count : 0}:${fitBlocks}:${fitOn}:${sceneCols}:${chainNow.late}`
  const lastKey = useRef(fitKey)
  if (lastKey.current !== fitKey) {
    lastKey.current = fitKey
    if (trim !== 0) setTrim(0)
  }
  useEffect(() => {
    if (!fitOn || !viewport || !content) return
    const over = content - viewport
    /* A pixel or two is rounding, not an overflow worth another pass. */
    if (over > 2) setTrim((was) => was + over)
  }, [fitOn, content, viewport])
  /* Only once every piece has been measured. Fitting against a chrome of
     zero would hand the grids the whole screen for one frame, which is the
     flash of wrong sizes this screen already learned to avoid. */
  const fitted =
    fitOn && viewport > 0 && content > 0 && (sceneGrid > 0 || blockGrid > 0)
      ? fitTiles({
          available: viewport - chrome - trim,
          scenes: scenes.hasScenes ? scenes.count : 0,
          blocks: fitBlocks,
          sceneCols,
          fxCols: size.fx,
          gap: space.sm,
          /* The row the blocks sit in, so a small phone is not sent six
             across with tiles too narrow for a picture — see fitTiles. */
          width: row
        })
      : null
  /** The two numbers the tiles are actually drawn with. */
  const tileH = fitted ? fitted.tile : size.tile
  const fxCols = fitted ? fitted.fxCols : size.fx
  /** Which block's channel picker is open, by effect id. */
  const [picking, setPicking] = useState(null)
  /* Closed, not only hidden: kept, the sheet came back over the new song's
     tiles the moment its chain landed, and a tap changed its block. */
  useEffect(() => {
    if (chainNow.elsewhere) setPicking(null)
  }, [chainNow.elsewhere])
  /* And on any other preset: a chain up from memory is drawn at once, and a
     sheet left open would be over the new song's block of the same number. */
  useEffect(() => setPicking(null), [chainNow.number])
  /* The looper's buttons, opened from the Looper pedal in the chain. */
  const [looping, setLooping] = useState(false)

  const channels = caps?.channelNames
  const slots = slotCount(caps)
  const conflict = hostConflict(remoteHosts(), remoteChosenHost())

  /*
   * The channel tip, and the conditions it waits for.
   *
   * "This tip appears here - exactly when the gesture becomes useful." So it
   * does not open on the first launch, or the first time this screen is
   * drawn: it opens on the first preset that has blocks to hold AND a unit
   * with more than one channel to choose between. On anything else the tip
   * would be teaching a gesture that does nothing — the same hold is wired to
   * `undefined` down in the grid for exactly that reason.
   *
   * The chain has to have been read, too. A chain that failed leaves the last
   * blocks it knew on screen, and a tip over stale tiles is a tip about a
   * preset that may not be loaded.
   */
  const holdDoesSomething = chain === 'ok' && blocks.length > 0 && channels?.length > 1 && !chainNow.elsewhere && !chainNow.outline
  const [coach, setCoach] = useState(false)
  /* 'tip', then after Try it 'trying' until a block is held, then 'done'. */
  const [coachStage, setCoachStage] = useState('tip')

  useEffect(() => {
    if (!holdDoesSomething) return undefined
    let live = true
    coachSeen().then((seen) => {
      if (live && !seen) setCoach(true)
    })
    return () => {
      live = false
    }
  }, [holdDoesSomething])

  /*
   * HOW THE WATCH IS USED, once, the first time a paired watch with the app on
   * it is seen from here. "We don't need to do a swipe left and right as long
   * as there's a thing that pops up the first time explaining how the user
   * uses the Apple Watch." Waits for the channel tip, so two cards never stack.
   */
  const [watchTip, setWatchTip] = useState(false)
  useEffect(() => {
    if (coach || !watchPaired()) return undefined
    let live = true
    watchTipSeen().then((seen) => {
      if (live && !seen) {
        markWatchTip()
        setWatchTip(true)
      }
    })
    return () => {
      live = false
    }
  }, [coach])

  /* Shown once, and remembered the moment it is shown rather than when it is
     answered — killing the app with the card up is not an accident to correct
     on the next launch. */
  const closeCoach = useCallback(() => {
    markCoach()
    setCoach(false)
  }, [])

  /* Try it waits for the hold rather than closing like Skip — see P5.trying. */
  const tryCoach = useCallback(() => {
    markCoach()
    setCoachStage('trying')
  }, [])

  /* And it notices the moment somebody does the thing: a channel picker
     opening is the hold having worked, so the card says so, once, and goes
     when Got it is pressed. */
  useEffect(() => {
    if (picking && coach && coachStage !== 'done') {
      markCoach()
      setCoachStage('done')
    }
  }, [picking, coach, coachStage])

  /*
   * `arriving` is the screen being shown again rather than pulled down, and
   * then it reads only when the rig has nothing current: coming back from
   * the preset list, the preset just chosen is already being read, and doing
   * it all again here was two more preset dumps landing on a unit that was
   * still loading — the sound dropping "until the android app loads the new
   * page". Nor when the store has followed the unit since its last read,
   * however long ago: it listens on every screen. See rig.arrivedCurrent.
   */
  const reload = useCallback(async ({ arriving = false } = {}) => {
    if (arriving && (await arrivedCurrent())) return
    setRefreshing(true)
    try {
      await refreshAll()
      /* Pulling down reads the scene names fresh too, past anything kept. */
      if (!arriving) await rereadSceneNames()
    } catch {
      // refreshAll puts what it learned in the store, including the failure.
      // Nothing to add here that the screen is not already showing.
    } finally {
      setRefreshing(false)
    }
  }, [])

  /*
   * And again when the demo becomes a different unit.
   *
   * "It's not letting you switch to a different demo. It's stuck on the FM3."
   * Picking one rebuilt the simulated unit immediately — but this read ran
   * once, on mount, so the screen went on showing the old unit's presets, its
   * scenes and its chain. The rig underneath had changed and nothing had asked
   * it anything since.
   *
   * Harmless outside the demo: `demoUnit` never moves there, so this is the
   * same single read on mount it has always been.
   */
  const demoIs = useDemoUnit()

  useEffect(() => {
    reload({ arriving: true })
  }, [reload, demoIs])

  /*
   * Where a press of Previous or Next would land, or null when the button has
   * nothing to do.
   *
   * Two rules, not one, and the split is deliberate. Inside a setlist or the
   * stars the order wraps, because a running order does come back round to the
   * first song — that is `stepTarget`, the browser's own. Slot by slot has no
   * such order to come back to, so it stops at the ends: `stepSlot` knows how
   * many slots the unit reported and greys the button rather than sending a
   * press the unit is going to refuse.
   */
  /*
   * AND NOT SLOT BY SLOT ON A VP4. It cannot say which preset it is on, so
   * "the next slot" is a guess from the last one this phone picked, and one
   * changed at its footswitch since makes Next land somewhere nobody meant.
   * A setlist or the stars know their own order and send the preset itself,
   * so those still step. With neither, the buttons say why (VP4_NO_STEP, or
   * on a computer too old for any of it the update words: vp4StepWords)
   * rather than doing nothing. Never in the demo, whose VP4 knows.
   */
  const noSlotSteps = vp4Here()
  const landing = (by) =>
    order
      ? stepTarget({ source, current: preset?.number, delta: by, favourites, lists })
      : noSlotSteps
        ? null
        : stepSlot(preset?.number, by, caps)

  /*
   * And the pedals of where each would land, read while nothing else is going
   * on, so the press puts them up with the name. "Preload the next one and
   * keep the previous one." See rig.readAhead.
   */
  const nextAt = landing(1)
  const lastAt = landing(-1)
  useEffect(() => readAhead([nextAt, lastAt]), [nextAt, lastAt])
  useEffect(() => () => readAhead([]), [])

  /*
   * The line under Next: the name of what it will load, or at the end of a
   * setlist that the set starts over. "'Next: song name' under the Next
   * button. You see what's coming before the count-in, so a wrong running
   * order gets caught in time."
   *
   * Asked about `nextAt` and nothing else, the same landing(1) the button is
   * greyed by and steps to, so it cannot name a different slot from the one
   * a press loads. And it is the preset list's own name for that slot
   * (presetNames.nameOf, the list Presets draws), for this unit: a change of
   * unit empties that list (rig readAll, forgetNames) before the new one's
   * names come in. `useNamesHeard` redraws as names arrive and never asks the
   * unit for one, because a name read from here is a preset dump down the
   * serial port in the middle of a song. Not known yet is a blank line,
   * never a guess. See nextWords.
   */
  useNamesHeard()
  const ahead = nextWords({ order, current: preset?.number, next: nextAt, nameOf })

  /*
   * And the line under Previous, by the same rule the other way round: the
   * name of what it will load, or on song 1 of a setlist that it goes to the
   * end. "Can we add that to the previous button as well?" Asked about
   * `lastAt` and nothing else, the landing(-1) Previous steps to.
   */
  const behind = previousWords({ order, current: preset?.number, previous: lastAt, nameOf })

  /*
   * Which press of Previous or Next is the newest, from these buttons or the
   * watch's (both come through `step`). Two quick Nexts had the skipped
   * song's scene and tempo sent onto the unit loading the next song. Only
   * the newest press's song is set up: rig.loadPreset answers false for a
   * load any newer one took over — from here, the preset list or Setlists'
   * Play — and this count is the second guard, for two from this screen.
   */
  const stepsRef = useRef(0)

  /* `at` is when it was pressed: now from the buttons, or when the phone heard a watch's Previous or Next. */
  const step = async (by, at = Date.now()) => {
    const next = landing(by)
    if (next === null) {
      // The end of the list. Wrapping round to slot 0 mid-set is worse than a
      // button that does nothing, so it does nothing and says so in the case.
      /* And on a computer that can't change a VP4's presets at all, only that (vp4StepWords). */
      if (!order && noSlotSteps) sayFault(vp4StepWords(caps))
      nope()
      return
    }
    thud()
    /* How long the link has been away so far, for the song's setup to ask after the load (rig.songLate). */
    const awayAtNext = awayNow()
    const mine = ++stepsRef.current
    /* Not awaited: the rig puts the new slot on screen immediately and confirms
       it behind that. Waiting here would make Next feel like it missed. */
    const loading = loadPreset(next, at)
    /* And the song's own scene and tempo, once its preset is in, when the
       setlist gives it some: one tap is the whole change between songs.
       ONLY ONCE THE SELECT HAS LANDED. A select that was dropped or refused
       leaves the unit on the last song, and that song's preset would be
       handed this song's scene. AND NOT LATE: a link that was away while the
       preset loaded held its reads, and the scene would go out seconds after
       Next, mid-verse (relay-rules songWouldLandLate) — so it is not sent,
       and said (rig.songLate). A link that stayed up changes nothing. AND
       ONLY FOR THE NEWEST PRESS (stepsRef, above): a song skipped past is
       not set up on the next one. */
    const song = order ? songFor(source, lists, next) : null
    if (song) {
      Promise.resolve(loading)
        .then((landed) =>
          landed === true && mine === stepsRef.current && !songLate(song, awayAtNext) ? applySong(song, { scene: writeScene, tempo: writeTempo }) : null
        )
        .catch(() => {})
    }
  }

  /*
   * DIMMED, NEVER MOVED. Opacity only — on the two grids and on the four
   * buttons at the foot that send something — so nothing on the screen is a
   * pixel out of place while the link is down, and nothing jumps when it is
   * back. Press's own `disabled` is not used: it recolours the words and
   * blocks the press, and a press while NOT CONNECTED is still answered, with
   * "Not sent — not connected". The tuner is left alone while it is open:
   * Stop tuner always goes. Setlists and Edit need no rig and stay as they are.
   */
  const dim = down ? DOWN_DIM : null
  const dimmed = dim ? { opacity: dim } : undefined

  /*
   * AND NOT CONNECTED NEVER UNDER A CARD. Each card at the top says where its
   * bottom edge is, and the word floats below whichever one is up (see
   * lib/tileGrid bandTop): on the smallest phones the fifteen-second advice
   * reached past a third of the way down and covered it.
   */
  const [cardEnd, setCardEnd] = useState({ fault: 0, advice: 0 })
  const endOf = (which) => (e) => {
    const { y, height } = e.nativeEvent.layout
    const end = Math.ceil(y + height)
    setCardEnd((was) => (was[which] === end ? was : { ...was, [which]: end }))
  }
  const adviceUp = lost && !lostAway && !error
  const bandAt = bandTop(viewport, error ? cardEnd.fault : adviceUp ? cardEnd.advice : 0, space.sm)

  /*
   * The button between the two: what they walk, and where you are in it.
   *
   * "Starred 3/7" is the third starred preset of seven; a setlist shows its
   * name. Off the list altogether it shows only the count, and Next goes to the
   * The word SETLIST sits above it because a lone "All" between Previous and
   * Next reads as a caption rather than as the button that decides what those
   * two do — and because setlist is what the thing IS called everywhere else
   * in the app. "Source" was the word for the mechanism: All, Starred or a
   * list, three things a programmer would group and nobody else would.
   */
  const at = order ? positionIn(order, preset?.number) : 0
  const where = order ? (at ? `${at}/${order.length}` : `${order.length}`) : ''

  /* The foot's buttons: the stage floor, or 48 when the screen is asked to fit. */
  const foot = tight ? 48 : TAP

  /*
   * The Apple Watch's four pages, drawn from this screen and worked by its own
   * buttons: the scenes, the pedals, Previous and Next, the tuner. Nothing at
   * all on a build without the watch in it. See lib/watchBridge.
   */
  useWatchBridge(
    {
      preset,
      label: Number.isInteger(preset?.number) ? slotLabel(preset.number, caps?.presets?.addressing) : '',
      scene,
      sceneNames,
      sceneCount: scenes.hasScenes ? scenes.count : 0,
      /* Not another preset's: a tap would switch whatever shares the id. */
      chain: chainNow.elsewhere ? [] : blocks,
      tunerOn,
      tuning,
      /*
       * Not while NOT CONNECTED: the watch shows its own "isn't connected"
       * page instead of buttons that would only be refused — EXCEPT WHILE
       * THE TUNER IS ON. Taking the watch's pages away takes its Tuner page
       * with them, and that page turns the tuner off as it goes (Pages.swift,
       * onDisappear: "Leaving the tuner page turns it back off"). That close
       * is never dropped, so it waited for the link and shut the unit's tuner
       * the moment the link came back, mid-tuning, or failed and left the
       * unit muted on it with both screens saying off. The watch can only
       * change by a build, so the phone keeps its pages up instead; a tap on
       * them is still refused at once by the rig while the link is down.
       */
      linked: Number.isInteger(preset?.number) && (!down || tunerOn),
      canPrevious: lastAt !== null,
      canNext: nextAt !== null
    },
    step
  )

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        /* The viewport, and everything in it: fit is the difference between
           the two, less the grids. */
        onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContent(h)}
        contentContainerStyle={{
          padding: space.lg,
          gap: tight ? space.md : space.lg,
          paddingBottom: tight ? space.lg : space.xxl
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => reload()} tintColor={color.silkDim} />
        }
      >
        {/* The first thing on the first screen, because the top of it is where
            an eye starts. A fault is not in here any more: it floats over the
            screen (the Toast at the end), so it never moves what is under it. */}
        <UnlockOffer onUnlock={onUnlock} />
        {/* The demo's VP4 says what a real one doesn't do from the app yet, once, as the browser's banner does. */}
        <Vp4DemoNote />
        {/* Paid in the demo with no account yet: see the component. */}
        <OnlyOnThisPhone onAccount={onAccount} />
        {/* "Colours now match your unit", once, for somebody who had the app before. */}
        <ColoursNotice />
        {conflict ? <Note tone="fault">{conflict}</Note> : null}

        {/* ---------------------------------------------------------- preset */}
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>
              {Number.isInteger(preset?.number)
                ? `PRESET ${slotLabel(preset.number, caps?.presets?.addressing)}`
                : 'PRESET —'}
              {slots ? ` OF ${slots}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {/*
                What is up here rather than down among the scenes.

                This corner takes you OFF the screen, which is the honest
                grouping: everything below the preset name acts on the rig you
                are playing, and this does not. It is also the corner furthest
                from where a thumb rests during a song.

                The speaker and Setup used to be in this row too. They are on the
                bar at the top of the app now, where the browser keeps them — see
                components/TopBar.

                A ✦ Tone button stood here until the tone designer was taken out
                of the app. A row that closes up around a button it was not given
                is the same row either way.
              */}
              {/*
                EDIT IS NOT HERE ANY MORE. "On the phone versions move the edit
                button down to the bottom tab bar exactly like it's set up on the
                web app." It sat up here beside the preset name on the reasoning
                that neither of them acts on the rig you are playing — true, and
                it put the way to the bench in the row your eye goes to first,
                at 36 points, above everything you actually press on a stage.

                The browser has always had it on the bottom bar beside the tuner
                and the tempo. That bar is the strip for what you do BETWEEN
                songs rather than during one, which is exactly what opening the
                chain is.
              */}
            </View>
          </View>

          {/*
            The preset is a button now, not a heading.

            It reads the same and does the thing the browser's does: tapping it
            opens every slot by name. Previous and Next stay either side of it
            because they are the mid-song controls and a list is not — but
            "get me to SCHISM" was unanswerable on this screen until now.
          */}
          {/*
            "…" rather than "Untitled" for the one round trip between pressing a
            preset and the unit saying what it is called. The slot is already in
            the line above, so nothing here is a guess. See rig.loadPreset.
          */}
          <Press
            label={preset?.pending && !preset?.name ? '…' : presetLabel(preset)}
            sub={onOpenPresets ? 'Tap for all presets' : undefined}
            /* No list picture on the left any more: "take that off of that
               one", and make the name "a little bit bigger". The chevron on
               the right still says the tap opens something. */
            after={onOpenPresets ? chevronIcon : undefined}
            labelSize={font.lead + 2}
            height={tight ? TAP : TAP + 12}
            disabled={!onOpenPresets}
            onPress={onOpenPresets}
            style={{ paddingHorizontal: space.lg }}
          />

        </View>

        {/* ---------------------------------------------------------- scenes */}
        {/*
          Two across, named, and each one its own colour — the browser's Play
          screen, tile for tile.

          Four across with nothing but a numeral was a reading task: eight
          identical panels, and between two bars of a song you are counting
          squares. Two across buys the width for the NAME, which is the thing a
          player actually thinks in — RHYTHM, LEAD, CLEAN — and the colour means
          the right tile is found before any of it is read.

          The number stays, small, above the name. It is what the unit calls the
          scene and what a setlist written on paper says.
        */}
        {scenes.hasScenes ? (
          <View style={{ gap: space.sm }}>
            {/*
              "Keep having issues showing the scene names on the AM4. Have a way to
              refresh them." Beside the heading, the size of the heading: a thing
              reached for now and then, not a control on the stage.
            */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Label>Scenes</Label>
              {/*
                On an AM4 over Bluetooth too, now. "It does say refresh names
                already right above the scenes, so if they click refresh names,
                it should do it." Its names come in the whole stored preset, a
                few seconds of it there (lib/bleWire am4SceneNames): read once
                when a preset is first seen, remembered after, and read again
                only from here.
              */}
              <RefreshNames />
            </View>
            <View
              onLayout={(e) => {
                setGrid(e.nativeEvent.layout.width)
                setSceneGrid(e.nativeEvent.layout.height)
              }}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, opacity: dim ?? 1 }}
            >
              {/* Drawn in the layout's order, but each tile is still its own
                  scene: "5" says 5, wears 5's colour and selects scene 5. */}
              {sceneOrderFor(sceneLayout, scenes.count, loadSceneOrder(sync)).map((i) => {
                const hue = sceneColor(i)
                return (
                  <Tile
                    key={i}
                    caption={String(i + 1)}
                    label={sceneNames[i] || ''}
                    /* The rule under the name, from his mockup of this screen.
                       Scenes wear one; the chain tiles below do not, which is
                       how he drew them. */
                    bar
                    fill={hue.fill}
                    ink={hue.ink}
                    on={i === scene}
                    height={tileH}
                    haptic={thud}
                    onPress={() => writeScene(i)}
                    /* Amber round the live one, as in the browser: every scene
                       can be the same red now, and so can an AM4's drive. */
                    ring
                    /* Two lines, a size down, at every width: "Scene names
                       cut short." Wrapping fixes it for everyone — a hold to
                       show the name would be a footswitch that doesn't switch. */
                    wrap
                    style={{ width: tileWidth(row, sceneCols) }}
                  />
                )
              })}
            </View>
          </View>
        ) : null}

        {/* ---------------------------------------------------------- blocks */}
        <View style={{ gap: space.sm }}>
          {/*
            "Where it says chain above the pedals, also put hold to switch
            channels. So users know that they can just hold the things to switch
            between channels, A B C and D." Beside the heading, in the heading's
            own size, the way Refresh names sits beside Scenes. Only when a hold
            does something: a unit with no channels has nothing to switch.
          */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Label icon={chainIcon}>
              {chain === 'reading' ? 'Reading the chain…' : chain === 'failed' ? 'Chain — out of date' : 'Chain'}
            </Label>
            {channels?.length > 1 && blocks.length ? (
              <Text style={{ color: color.silkDim, fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                {HOLD_FOR_CHANNELS}
              </Text>
            ) : null}
          </View>

          {chain === 'failed' && !chainNow.elsewhere ? (
            <Note tone="warn">
              The unit didn’t answer when we asked what’s in this preset, so these buttons are
              whatever it last told us. Pull down to ask again.
            </Note>
          ) : null}

          <ChainUpdating chain={chainNow} />

          {blocks.length === 0 && chain === 'ok' && !chainNow.elsewhere ? (
            <Note>Nothing in this preset but input and output.</Note>
          ) : null}

          {/*
            The channel tip, directly over the tiles it is about.

            Inside the chain's own block rather than at the top of the screen,
            because "this tip appears here" is a promise about WHERE: the
            gesture it describes belongs to the squares eight points below it,
            and a card up by the preset name would be describing something off
            the bottom of somebody's phone.
          */}
          <Coach open={coach} stage={coachStage} onTry={tryCoach} onSkip={closeCoach} onDone={closeCoach} />
          <Sheet open={watchTip && !coach} onClose={() => setWatchTip(false)} title="Your Apple Watch" note="Fractal Remote is on your watch">
            <View style={{ gap: space.md }}>
              {watchHow().map((line) => (
                <Text key={line} style={{ color: color.silk, fontSize: font.small, lineHeight: 21 }}>
                  {line}
                </Text>
              ))}
              <Press label="Got it" tone="signal" on onPress={() => setWatchTip(false)} />
            </View>
          </Sheet>

          {/*
            A wrapped grid of coloured tiles, which is the browser's chain and
            also the unit's own screen.

            A full-width row per block was honest and unreadable: seven rows of
            "Delay 1 / Channel A" is a list to be read top to bottom, and it
            pushed the tempo and the tuner off the bottom of the phone. Four
            across fits the whole chain in the space two rows used to take, and
            the colour does the finding — the drive is red on the AM4's display,
            so it is red here.

            The abbreviation is shortName's, shared with the browser: DLY, and
            DLY 2 only when there is more than one, because a preset can hold a
            second delay without holding the first.

            Tapping still toggles. The channel moved into the tile as a sub-line
            and onto a hold, because a separate square per block doubled the
            number of targets on the busiest part of the screen.
          */}
          <View
            /* Both grids measure, because a unit that reports no scenes never
               draws the other one and these tiles would have no width. */
            onLayout={(e) => {
              setGrid(e.nativeEvent.layout.width)
              setBlockGrid(e.nativeEvent.layout.height)
            }}
            /* Dimmed a little while they are only the outline: this preset's
               pedals, the chain read still finishing behind them. */
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, opacity: dim ?? (chainNow.late ? 0.55 : chainNow.outline ? 0.72 : 1) }}
          >
            {chainNow.elsewhere ? (
              <View style={{ width: '100%', height: held ? held.height : undefined, overflow: 'hidden' }}>
                <ChainWait
                  chain={chainNow}
                  height={Math.max(tight || fitted ? 44 : TAP, tileH - 12)}
                  cards={held ? held.count : 4}
                  width={held ? tileWidth(row, fxCols) : 84}
                  overlay={!!held}
                />
              </View>
            ) : blocks.map((block) => {
              const hue = blockColor(block.slug)
              /* Named here rather than inline: the word the unit uses for this is
                 not a word anybody says out loud, and it has no business sitting
                 next to the text that gets drawn. */
              /* Read ahead of the switch, on or off not said yet: dim and no
                 word, so the ones that are on light up rather than half of
                 them flipping from On to Off. */
              /* And every pedal of a real VP4 the player has not tapped: nothing
                 reads a VP4's on/off (lib/vp4-safety VP4_ON_OFF_UNKNOWN). Its
                 tap still goes — it turns the effect off first. */
              const unknown = (chainNow.outline || vp4Here()) && typeof block.bypassed !== 'boolean'
              const engaged = !unknown && !block.bypassed
              const state = unknown ? '\u00a0' : engaged ? 'On' : 'Off'
              return (
                <Tile
                  key={idOf(block)}
                  label={shortBlock(block)}
                  icon={showIcons ? blockIcon(block.slug) : undefined}
                  topLeft={state}
                  topRight={block.channel || undefined}
                  fill={hue.fill}
                  ink={hue.ink}
                  on={engaged}
                  /* A switch: grey when off, if that is the choice in Settings → Colours. */
                  effect
                  height={Math.max(tight || fitted ? 44 : TAP, tileH - 12)}
                  /* A pedal read ahead of the switch, whose on or off the unit
                     has not said yet: a tap would be a guess, so it waits. */
                  onPress={() => {
                    if (chainNow.outline && typeof block.bypassed !== 'boolean') return
                    writeBypass(idOf(block), !block.bypassed)
                  }}
                  /* Not on the outline: a channel waits for the chain read. */
                  onLongPress={
                    channels?.length > 1 && !chainNow.outline
                      ? () => setPicking(picking === idOf(block) ? null : idOf(block))
                      : undefined
                  }
                  style={{ width: tileWidth(row, fxCols) }}
                />
              )
            })}
            {/*
              The Looper's pedal. Not an on/off switch like the others — see
              STAGE_HIDDEN, which still keeps the looper out of the on/off
              tiles — but the door to Record, Play and Stop. Tapping it opens
              the looper's buttons; it never bypasses the block.

              Rec in the top left and Play in the top right, the two corners
              an effect uses for On/Off and its channel, with the picture
              between them. "Looks like we need to fix the overlapping play
              word on the looper": the whole phrase in one corner reached past
              the middle of the tile at three and four across, and the picture
              sat on top of Play. They are one phrase, so they are a pair:
              where either has no room beside the picture, neither is drawn.
            */}
            {looperTile ? (
              <Tile
                key="looper"
                label={shortBlock(looperHere)}
                icon={showIcons ? blockIcon('looper') : undefined}
                topLeft={vp4Looper ? looperState : 'Rec'}
                topRight={vp4Looper ? undefined : 'Play'}
                pair={!vp4Looper}
                fill={blockColor('looper').fill}
                ink={blockColor('looper').ink}
                on={vp4Looper ? looperHere.bypassed === false : !looperHere.bypassed}
                effect
                height={Math.max(tight || fitted ? 44 : TAP, tileH - 12)}
                onPress={() => setLooping(true)}
                onLongPress={() => setLooping(true)}
                style={{ width: tileWidth(row, fxCols) }}
              />
            ) : null}
          </View>
          {/* Why a real VP4's pedals say nothing until tapped. Always there on
              a VP4, so nothing moves when it would go; the browser says the same. */}
          {vp4Here() && blocks.length && !chainNow.elsewhere ? (
            <Text style={{ color: color.silkDim, fontSize: font.small }}>{VP4_ON_OFF_UNKNOWN}</Text>
          ) : null}

        </View>

        {/* ------------------------------------------------------------ foot */}
        {/*
          Previous / Next, then Tuner and Tap. One block at the bottom, which is
          the browser's own arrangement and was Justin's correction to it:

          "Move Previous / Next directly above the bottom tap bar."

          They sat up by the preset name, which is where you READ, not where your
          thumb rests. The phone had them there too — the same mistake, made a
          second time — so stepping presets was at the top of the screen and the
          tuner was off the bottom of it.
        */}
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Press
              grow
              label="Previous"
              icon={chevronIcon}
              flip
              /* What Previous will load, on a line as tall as Next's, so the two words sit level. */
              under={behind.shown}
              accessibilityLabel={behind.said}
              height={foot}
              disabled={landing(-1) === null && !(noSlotSteps && !order)}
              onPress={() => step(-1)}
              style={dimmed}
            />
            <Press
              grow
              caption="Setlists"
              label={order ? sourceLabel(source, { favourites, lists }) : 'All'}
              sub={where || undefined}
              tone="signal"
              on={Boolean(order)}
              height={foot}
              disabled={!onOpenSetlists}
              onPress={onOpenSetlists}
            />
            <Press
              grow
              label="Next"
              after={chevronIcon}
              under={ahead.shown}
              accessibilityLabel={ahead.said}
              height={foot}
              disabled={landing(1) === null && !(noSlotSteps && !order)}
              onPress={() => step(1)}
              style={dimmed}
            />
          </View>

          {/*
            Tuner and Tap on one row, and the tempo ON the Tap button rather than
            beside it as its own heading with a forty-point number. That number
            was answering "what is this preset at" with a third of the screen; on
            the button it answers the same question and costs nothing.

            Tuner only where the unit has one. Absent means unknown — an older
            host predating the flag — and unknown still gets to try.
          */}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {caps?.tuner !== false ? (
              <Press
                grow
                label={tunerOn ? 'Stop tuner' : 'Tuner'}
                icon={tunerIcon}
                tone="live"
                on={tunerOn}
                height={foot}
                onPress={() => writeTuner(!tunerOn)}
                style={tunerOn ? undefined : dimmed}
              />
            ) : null}
            {/*
              The way to the bench, in the middle. "Let's move the edit button to
              the center and the tap tempo button to the right."

              It sat on the right because it is the only one of the three that
              leaves this screen, and last felt like the place for that. What
              that reasoning missed is which hand is holding the phone: the
              right edge is where a thumb rests, and the button under the thumb
              should be the one pressed mid-song, not the one pressed between
              them.
            */}
            {onOpenEdit ? (
              <Press grow label="Edit" icon={editIcon} height={foot} onPress={onOpenEdit} />
            ) : null}
            {/*
              Tap Tempo on the right, where the thumb is.

              The one thing in this app that must never be sent twice. A parameter
              arriving twice leaves the unit where it was; a beat arriving twice is
              a beat that never happened, so the relay excludes this route from its
              retry.

              Hold it to type a tempo: "on the tap button, let's do where they hold
              the tap button they can manually enter in the beats per minute they
              want."
            */}
            <Press
              grow
              /* "Change the label on the tap tempo button to just say Tap." */
              label="Tap"
              accessibilityLabel={Number.isFinite(bpm) ? `Tap tempo, ${Math.round(bpm)}` : 'Tap tempo'}
              sub={Number.isFinite(bpm) ? String(Math.round(bpm)) : undefined}
              icon={tempoIcon}
              tone="signal"
              height={foot}
              onPress={tapTempo}
              onLongPress={() => setTyping(true)}
              /* "A green light dot ... that flashes at the current tempo." */
              badge={<TempoDot bpm={bpm} />}
              style={dimmed}
            />
          </View>


        </View>

        {/*
          NO FOOTER. "Get rid of the everything you change here text at the bottom
          of the screen."

          It explained where changes land — true, and the kind of thing you read
          once and then scroll past for the rest of the app's life. The bar at the
          top already says which unit is being driven and that the link is up,
          which is the part that goes on mattering.
        */}

        {/*
          The two things that cover the screen rather than sitting in it, drawn
          last and outside the foot because both are modals.

          The volume is not among them any more: the speaker moved to the bar at
          the top of the app, which is where the browser keeps it, and the sheet
          moved with the button that opens it. See components/TopBar.
        */}
        {/*
          The channel picker, over the screen rather than inside it.

          "When holding a block to change channel have it be an overlay on the
          screen instead of inserting itself into the screen like the web
          version." It opened underneath the chain, which pushed everything below
          it down — so the tiles a thumb was aimed at moved while the thumb was on
          its way, on the one screen where that can happen mid-song.
        */}
        {/*
          Typing a tempo, high on the screen.

          "When holding tap button to manually enter tempo the keyboard blocks the
          numbers so you can see what your typing." It was in the foot — which is
          where a thumb rests and therefore exactly where the keyboard opens.
        */}
        <TempoBox
          open={typing}
          bpm={bpm}
          range={tempoRange(device, caps?.via)}
          onSet={writeTempo}
          onClose={() => setTyping(false)}
        />

        <ChannelSheet
          block={chainNow.elsewhere || chainNow.outline ? null : blocks.find((b) => sameBlock(b, picking)) || null}
          channels={channels}
          onClose={() => setPicking(null)}
          onPick={(ch) => {
            writeChannel(picking, ch)
            setPicking(null)
          }}
        />

        <Sheet open={looping && !!looperHere && !chainNow.elsewhere} onClose={() => setLooping(false)} title="Looper">
          {looperHere ? <Looper block={looperHere} /> : null}
        </Sheet>

        {/* Closing the tuner stops it at the unit, which is what the button does. It says NOT CONNECTED itself: nothing here is drawn over it. */}
        <Tuner on={tunerOn} reading={tuning} onClose={() => writeTuner(false)} down={down} />
      </ScrollView>

      {/*
        NOT CONNECTED, OVER THE TILES AND NEVER AMONG THEM. "When the link
        drops, Play says so right away. The tiles go dim under NOT
        CONNECTED." A word floating in the middle of the screen, where the
        eye already is, rather than a row that would push the scenes down
        under a thumb on its way to one. Not a Toast: the top of the screen
        is the fault's and the advice's, one card at a time, and this is not
        a card — it says what is true for as long as it is true, and goes the
        moment the link is back. It takes no touch, so a tap through it
        reaches the tile beneath and is told, in a note under the word, that
        it went nowhere.
      */}
      {down || droppedNote ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          /* Above the tiles, whose own elevation is 3, as the Toast is: on Android the higher one is drawn on top. */
          style={{ position: 'absolute', left: space.lg, right: space.lg, top: bandAt, alignItems: 'center', gap: space.sm, zIndex: 1, elevation: 6 }}
        >
          {down ? (
            <View
              style={{
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: color.fault,
                backgroundColor: color.chassis
              }}
            >
              <Text style={{ color: color.fault, fontSize: font.small, fontWeight: '700', letterSpacing: 2 }}>{NOT_CONNECTED}</Text>
            </View>
          ) : null}
          {/* And a tap that went nowhere, for its few seconds: under the word while the link is down, on its own when it was dropped as late with the link up. */}
          {droppedNote ? (
            <View style={{ paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: color.panel }}>
              <Text style={{ color: color.silk, fontSize: font.small, textAlign: 'center' }}>{droppedNote}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/*
        THE FAULT, OVER THE SCREEN AND NEVER IN IT. "Can we just have it be
        like an overlay toast notification that doesn't move the screen at
        all?" In the scrolling content it was one more row above everything,
        and the foot slid down under a thumb already on its way to Tap. It
        also counted toward the fit, so every tile shrank to make room for it.
      */}
      <Toast open={!!error} onLayout={endOf('fault')}>
        {error ? (
          <Note tone="fault" onDismiss={clearError}>
            {error}
          </Note>
        ) : null}
        {/*
          And what to do about it, when this app can tell.

          A message that says what went wrong and offers nothing to do next is
          where the guide came from. fixFor reads the message for a handful of
          plain signals; anything it cannot place gets no button, which is the
          honest answer — a wrong fix offered confidently costs more than no fix
          offered at all.

          Its own conditional rather than a fragment inside the note's: the note
          above is read by a test for the exact shape that makes it dismissible,
          and wrapping it was how that broke.
        */}
        {error && onOpenFix && fixFor(error) ? (
          <Press
            label={fixById(fixFor(error)).title}
            sub="What to try"
            height={44}
            onPress={() => onOpenFix(fixFor(error))}
          />
        ) : null}
      </Toast>

      {/*
        AND WHAT TO CHECK WHEN THE COMPUTER HAS GONE, over the screen like the
        fault and never in it. "App keeps jumping back-and-forth from this
        page every few seconds instead of offering suggestions on what to
        check." The waiting screen used to cover this screen at every drop;
        now this one stays, DISCONNECTED says the link is down, and after
        fifteen seconds of it the waiting screen's own advice and buttons
        float here, until the computer answers or the ✕ puts them away.
        Never with the fault up: one card at a time, in the same place.
      */}
      <Toast open={lost && !lostAway && !error} onLayout={endOf('advice')}>
        <Note tone="warn" onDismiss={() => onPutAway?.()}>
          {noComputer ? (
            <NoComputerWords email={noComputer.email} />
          ) : (
            <>
              The {deviceNoun()} can’t reach your computer. Open the Fractal Remote app on the computer and make sure the
              computer is awake. This keeps trying on its own.
            </>
          )}
        </Note>
        {/* The download link to their inbox, under the words that say no
            computer was ever set up, and only then. A label at 44 like the
            two below, so the card is one height whatever it says and NOT
            CONNECTED under it stays put (components/SendLinkButton.js). */}
        {noComputer ? <SendLinkButton email={noComputer.email} height={44} /> : null}
        <Press label="Look for the computer again" height={44} onPress={() => onLookAgain?.()} />
        {onOpenFix ? <Press label="Troubleshooting" height={44} onPress={() => onOpenFix('connect')} /> : null}
      </Toast>
    </View>
  )
}

/**
 * How wide a tile is when `n` of them share a row.
 *
 * A percentage rather than a measured width: the gap between tiles is real
 * pixels and the row is however wide the phone is, so asking for exactly 100/n
 * puts the last tile of every row on a line of its own. Two points of slack per
 * tile is what leaves room for the gaps at every one of the five sizes.
 */
/**
 * How wide one tile is when `n` share a row of `width` points.
 *
 * MEASURED RATHER THAN A PERCENTAGE, for two reasons that only show up on
 * hardware. `flexGrow: 1` fills the row, which is right until the last row is
 * short — nine blocks four across leaves one on its own, and it stretched the
 * whole width of the screen: a reverb the size of the preset name beside four
 * normal tiles. And a percentage cannot pay for the gaps, so four at 22% leave
 * a ragged strip down the right.
 *
 * The browser gets both for free from a CSS grid, which has real columns. This
 * is a wrapped row, so the arithmetic is done here: the row less its gaps,
 * divided by the tiles in it, and rounded down to the screen's pixels — see
 * lib/tileGrid for the tablet that wrapped every row without it.
 */
const tileWidth = (width, n) => tileWidthIn(width, n, space.sm, PixelRatio.get())

/**
 * Which channel a block is on.
 *
 * Each channel keeps its own model and settings, and the SCENE remembers which
 * one this block plays — which is the fact worth having in front of somebody
 * before they change it, because it is the difference between "this sounds
 * different now" and "scene 2 sounds different now".
 *
 * The same words the browser uses, because they are the same fact.
 */
function ChannelSheet({ block, channels, onClose, onPick }) {
  const name = block?.name || block?.slug || ''
  return (
    <Sheet open={!!block && channels?.length > 1} onClose={onClose} title={name} note="Channel">
      <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
        {(channels || []).map((ch) => (
          <Press
            key={ch}
            grow
            label={ch}
            height={TAP + 28}
            tone="live"
            on={block?.channel === ch}
            accessibilityLabel={`Channel ${ch}`}
            onPress={() => onPick(ch)}
          />
        ))}
      </View>
      <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 20 }}>
        {block?.channel ? `${name} is on channel ${block.channel}. ` : ''}
        Each channel keeps its own model and settings; the scene remembers which one this block
        plays.
      </Text>
    </Sheet>
  )
}

/*
 * How far the tiles dim while NOT CONNECTED: further than an outline's 0.72
 * and a late chain's 0.55, so it reads as "not now" and not as "still
 * loading", and still enough to read every name through it.
 */
export const DOWN_DIM = 0.35

/** Beside CHAIN: what holding a block does. */
export const HOLD_FOR_CHANNELS = 'Hold to switch channels'

/** What the Refresh names link says, before and after a press. */
export const REFRESH_NAMES = {
  idle: 'Refresh names',
  reading: 'Reading…',
  found: 'Names updated',
  none: 'No names on the unit',
  failed: "Couldn't read them"
}

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
    timer.current = setTimeout(() => setSaid('idle'), 4000)
  }
  return (
    <Pressable
      onPress={press}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Refresh scene names"
    >
      <Text
        style={{
          color: said === 'failed' ? color.fault : said === 'idle' ? color.silkDim : color.silk,
          fontSize: font.micro,
          letterSpacing: 1.5,
          textTransform: 'uppercase'
        }}
      >
        {REFRESH_NAMES[said] || REFRESH_NAMES.idle}
      </Text>
    </Pressable>
  )
}

function Label({ children, icon }) {
  const word = (
    <Text
      accessibilityRole="header"
      style={{
        color: color.silkFaint,
        fontSize: font.micro,
        letterSpacing: 1.5,
        textTransform: 'uppercase'
      }}
    >
      {children}
    </Text>
  )
  /*
   * The link beside CHAIN, which is the only heading in the mockup that has a
   * picture. Wrapped only when there is one so every other heading stays the
   * bare Text it has always been.
   */
  if (!icon) return word
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image
        source={icon}
        accessible={false}
        resizeMode="contain"
        style={{ width: 13, height: 13, tintColor: color.silkFaint }}
      />
      {word}
    </View>
  )
}
