import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Keyboard, PanResponder, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { at as tint } from '../lib/vivid'

import { color, font, mono, radius, space, TAP } from '../lib/theme'
import { classic, glassField } from '../lib/glass'
import {
  bindModifier,
  blockCatalog,
  blockHelp,
  blockParams,
  blockTypes,
  cabState,
  clearCell,
  editBlocks,
  idOf,
  listIrBanks,
  modifierModel,
  placeBlock,
  sameBlock,
  setEnum,
  setParam,
  setParamConfirmed,
  setType
} from '../lib/device'
import { vp4Here } from '../lib/device'
import { demoUnit, isDemo } from '../lib/demo'
import { overBluetooth } from '../lib/bleSwitch'
import { useCableNow } from '../lib/bluetooth'
import { CABLE_EDIT_NOTE } from '../lib/cableWords'
import { editNoteUp } from '../lib/editWords'
import { bleEditNoteSeen, markBleEditNote } from '../lib/coach'
import { VP4_NO_EDITS, VP4_NO_KNOBS } from '../lib/vp4-safety'
import { NAM_ON_THE_UNIT, NO_KNOBS_YET } from '../lib/gen3Catalog'
import { OWN_KNOBS_NEED_COMPUTER } from '../lib/ownBlocks'
import {
  CAB_REFUSED,
  CAB_UNDO_LOST,
  MODEL_REFUSED,
  cabAfter,
  cabBackTo,
  cabElsewhere,
  cabHidden,
  cabLost,
  cabShowing,
  cabShows,
  cabWas,
  irBanks,
  irNow,
  pickCab,
  readCab,
  restoreCab,
  taken
} from '../lib/cab-pick'
import { MODEL_HINT, modelSnapshot, restoreModel, undoOffer, undoProgress, undoResult } from '../lib/model-undo'
import { copyChannel } from '../lib/copy-tools'
import { colLabel, doubtfulWrite, gapCols, gridShape, isSplitChain, laneItems, lanesShown, rowLabel } from '../lib/grid-plan'
import { NEW_BLOCK_NAME, NEW_BLOCK_NOTE, knownBlocks } from '../lib/new-block'
import { blockPositions, landingIndex, reorderPlan, settledItems } from '../lib/laneOrder'
import { isSilencingParam } from '../lib/guardrails'
import { blockLevel, levelFloor, levelToSend, levelTypes, LEVEL_HINT } from '../lib/blockLevel'
import { editPages, pageFor, pageHolding } from '../lib/editPages'
import { withUnit } from '../lib/param-fixes'
import { asOnPages, buildParamIndex, findControls, indexFor } from '../lib/paramIndex'
import { beginChainWrite, chainChanged, endChainWrite, getState, noteEdited, orStop, refreshBlocks, useRig, writeBlockBypass, writeChannel } from '../lib/rig'
import { useKeepAwake } from 'expo-keep-awake'
import { logDebug } from '../lib/debugLog'
import { oneWriteAtATime } from '../lib/knob-keys'
import { blockColor, quietEnd } from '../lib/blockColors'
import { familyTarget, paintable, presetFamilies, presetSpelling } from '../lib/colourPage'
import { presetLabel } from '../lib/presetName'
import { shortBlock } from '../lib/shortName'
import { thud } from '../lib/feedback'
import Knob, { fmt } from '../components/Knob'
import Note from '../components/Note'
import Grip from '../components/Grip'
import IrPicker from '../components/IrPicker'
import RowsPanel from '../components/RowsPanel'
import SwipeAway from '../components/SwipeAway'
import SideScroll from '../components/SideScroll'
import LooperAtEnd from '../components/LooperAtEnd'
import { readPutBack, useChainUndo } from '../components/ChainUndo'
import ModAttached from '../components/ModAttached'
import RenamePreset from '../components/RenamePreset'
import Looper from '../components/Looper'
import Press from '../components/Press'
import { SaveButton, SaveNotes, useSaveToSlot } from '../components/SaveToSlot'
import Tile from '../components/Tile'
import ColourSheet from '../components/ColourSheet'
import ChainWait, { ChainUpdating, useChain } from '../components/ChainWait'
import { HEAD_TALL, headShape, knobCell, knobSize } from '../lib/tidyEdit'
import { blockSettings, settingsByPage } from '../lib/editSettings'
import { useEditSettings } from '../lib/useEditSettings'
import { fieldNumber, fieldSelection, fieldSelectionMoved, fieldTyped, openField } from '../lib/value-field'
import { useTidyEdit } from '../lib/useTidyEdit'
import { CHAIN_TILE, FIND_LABEL, MORE_LABEL, MORE_ROWS, MORE_TITLE, firstOpen, gearStart } from '../lib/editMore'
import Sheet from '../components/Sheet'
import BlockSettings from '../components/BlockSettings'
import searchIcon from '../../assets/icons/search.png'
import moreIcon from '../../assets/icons/more.png'
import moreAndroidIcon from '../../assets/icons/more-vertical.png'

const face = Platform.select(mono)

/*
 * EDIT'S VP4 RULES, THE DEMO'S VP4 INCLUDED. A real VP4 through the computer
 * gets its chain and its effects on and off here, and nothing else: no
 * knobs or models (VP4_NO_KNOBS), no Edit chain, no Modifiers and no Rename
 * (VP4_NO_EDITS). The demo's VP4 offered all of them, so the demo showed a
 * VP4 owner an Edit their own unit would never give them. On this screen
 * only: Play, and device.js's VP4 handling that drives it and every
 * request, keep vp4Here, which is never the demo's.
 */
const vp4Bench = () => vp4Here() || (isDemo() && demoUnit() === 'vp4')
/* The block last open in each preset, by preset number, while the app runs: where Edit opens next time (lib/editMore firstOpen). */
const keptOpen = new Map()

const ofBlocks = (s) => s.allBlocks
const ofScene = (s) => s.sceneIndex
const ofBufferRev = (s) => s.bufferRev
const ofSceneNames = (s) => s.sceneNames
const ofCaps = (s) => s.capabilities
const ofChain = (s) => s.chain
const ofPreset = (s) => s.preset
const ofUnsaved = (s) => s.unsaved

/**
 * Why a knob did not take, in words that say whose doing it is.
 *
 * "Says Time 1 didn't take when I adjusted a preset." It did not: the unit
 * read back a different number, and on a delay the usual reason is the
 * block's own Tempo control. Set to a note value, it holds the time to the
 * song's tempo and the time knob is decoration — the unit accepts the write,
 * then puts its own number back. The old message stopped at "didn't take",
 * which reads as the app failing. Now it says what the unit is holding, and
 * when there is a Tempo control on the block that is not at its lowest
 * setting (None), it says that is why and what to do about it.
 */
const didNotTake = (p, actual, params) => {
  const held = typeof actual === 'number' ? ` The unit is holding it at ${fmt(actual)}${p.unit ? ` ${p.unit}` : ''}.` : ''
  const tempo = (params || []).find((q) => /^tempo$/i.test(q?.name || ''))
  const lowest = typeof tempo?.min === 'number' ? tempo.min : 0
  /* By the name on the knob, not the catalog's. */
  const called = p.label || p.name
  if (/time/i.test(p.name || '') && tempo && typeof tempo.value === 'number' && tempo.value > lowest) {
    return `${called} didn’t take.${held} This block’s Tempo is set to a note value, so its time follows the song tempo. Set Tempo to None to set the time by hand.`
  }
  return `${called} didn’t take.${held}`
}

/**
 * A word about a model whose name says nothing.
 *
 * "In the edit menu it says Null on the current effect." It does: the Filter
 * block's flat type is called Null on the unit itself — no filtering at all,
 * the block passing the sound through unchanged, which is what you pick when
 * a Filter is there to be a level or pan control. A real name, read as an
 * error by anyone who has not met it. So it is explained where it is shown.
 */
const modelNote = (name) =>
  typeof name === 'string' && name.trim().toLowerCase() === 'null'
    ? 'Flat: the sound passes through unchanged. For a level or pan control.'
    : null

/**
 * The bench, not the stand.
 *
 * The stage screen is for the things you do mid-song with your eyes somewhere
 * else. This is the other half: the chain as a thing to work THROUGH — tap a
 * block and its controls open underneath, turn them, hear it.
 *
 * WHY THE CHAIN IS DRAWN TWICE IN THIS APP, once here and once on the stage
 * screen, and why that is not a duplicate. They do opposite things with a tap.
 * On the stage a tap toggles the block, because that is the press you make
 * between two bars. Here a tap OPENS it, because nothing on this screen is
 * pressed mid-song. Merging them would mean one of the two gestures losing, and
 * both of them are right where they are.
 *
 * AND THE ENDS ARE HERE. The stage screen hides the input, the output, the
 * looper and the gate; this one shows them, quieter and with no on/off, because
 * a chain being looked at that silently drops two of its blocks is a diagram
 * that disagrees with the unit. Tapping one is how you find out what the gate
 * is doing or where the output sits.
 *
 * WHICH SCENE THE EDIT LANDS IN is said at the top and is not decoration. Every
 * knob turned here writes into the scene that is live, and a footswitch on the
 * floor changes every value on this screen without touching anything in it.
 */
export default function Edit({ onBack, onOpenGear, jump = null, beside = false }) {
  /*
   * `beside`: beside Play on a big screen or a phone on its side (App:
   * `playBeside`), not filling the window. False everywhere else.
   *
   * THE TIDIER EDIT (lib/tidyEdit; his account until features
   * TIDY_EDIT_FOR_EVERYONE): the page a little closer set, and beside Play
   * the title row without the preset's name and the scene, which Play is
   * showing a hand's width away ("it just feels a little clunky still",
   * Justin, 9 November 2026: the preset and the scene were named on both
   * sides). Full screen and on a phone, Edit still says which preset it is
   * editing. The open block's own rows are BlockPanel's, below. Closed to
   * an account, every line here draws what it drew.
   */
  const tidy = useTidyEdit()
  const nameOnPlay = tidy && beside
  /*
   * Whether a knob has the finger, and the screen therefore must not scroll.
   *
   * On iOS the scroll view's gesture recogniser is native and does not lose to
   * a JavaScript responder — it takes the touch and terminates the drag. That
   * is the whole of "the knobs just scroll the screen up and down when trying
   * to change them", and turning scrolling off while a knob is held is the only
   * thing that reliably stops it. See components/Knob.
   */
  const [held, setHeld] = useState(false)
  /* Bench work takes minutes and a chain move takes long enough for the
     screen to lock — which suspended the app mid-write. The stage screen
     already stays awake; so does this one. */
  useKeepAwake()
  /*
   * The whole chain, blocks newer than the app among them (lib/new-block),
   * for the chain editor, where their cells must read as taken; and the
   * blocks the app knows, for everything here that opens, turns or names one.
   */
  const chainAll = useRig(ofBlocks)
  const blocks = useMemo(() => editBlocks(chainAll), [chainAll])
  /* Modifiers go by the blocks the app knows: never one the phone named for itself (lib/ownBlocks `turns`). */
  const modBlocks = useMemo(() => knownBlocks(blocks), [blocks])
  const scene = useRig(ofScene)
  /* The preset loaded again: same block, channel and scene, other values. */
  const bufferRev = useRig(ofBufferRev)
  const sceneNames = useRig(ofSceneNames)
  const caps = useRig(ofCaps)
  const chain = useRig(ofChain)
  /*
   * Whose blocks these are. Between a preset change and its chain arriving
   * they were the last song's, and a tile opened the last song's amp with
   * its knobs writing to this song's, found by the same number. They are not
   * drawn then, and neither is anything opened from them. See lib/chain-view.
   */
  const chainNow = useChain({ editing: true })
  /* Unsaved work on THIS slot, for the Save button's fill. Same flag the
     rename screen uses: a moved knob is lost at the next preset change
     exactly as a typed name is. */
  const preset = useRig(ofPreset)
  const unsaved = useRig(ofUnsaved)
  const pending = !!unsaved && unsaved.number === preset?.number
  /* Over Bluetooth: knobs, models and on/off; and Save only where the wire says the app can (lib/bleSave: rig.noteEdited marks nothing unsaved anywhere else). See BLE_NOTE. */
  const viaBle = overBluetooth(caps)
  /* Whether the unit can be told to attach a modifier, as the computer says (capabilities.modifiers.bind); absent, from an older computer, it is offered as before. */
  const modifiersBind = caps?.modifiers?.bind !== false
  /* A unit on its own USB cable is the same wire, and its note says the cable that is in, not Bluetooth (lib/cableWords CABLE_EDIT_NOTE). */
  const onCable = useCableNow()
  /* Up until its cross is pressed, once per device; hidden until storage has answered, so it never flashes up for somebody who put it away. */
  const [bleNoteUp, setBleNoteUp] = useState(false)
  useEffect(() => {
    if (!viaBle) return undefined
    let alive = true
    bleEditNoteSeen().then((seen) => {
      if (alive && !seen) setBleNoteUp(true)
    })
    return () => {
      alive = false
    }
  }, [viaBle])

  const [openEid, setOpenEid] = useState(null)
  const [error, setError] = useState(null)
  /*
   * KNOBS FIRST (lib/editMore): Find a control behind the magnifier
   * (`finding`), the four buttons that sat under the knobs behind More
   * (`moreOpen`), and the one of them that is open (`tool`: 'chain',
   * 'modifiers' or 'rename'), drawn under the chain in the open block's
   * place until its Close. `modStart` is the block and control a held knob
   * opened Modifiers on.
   */
  const [finding, setFinding] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [tool, setTool] = useState(null)
  const [modStart, setModStart] = useState(null)
  /* SAVE, and it asks twice. The same piece the naming section in Setup
     uses; see components/SaveToSlot. */
  const saveTo = useSaveToSlot()
  /*
   * Search hands over by naming a control, not by editing one. Tapping a result
   * opens the block that holds it and puts your eyes on it — so there stays
   * exactly one place in this app where a value changes, with its verified
   * write behind it.
   */
  const [focus, setFocus] = useState(null)
  /*
   * The way back from the last model pick, held here rather than in the panel.
   *
   * The panel is rebuilt whenever the block's channel or the scene changes —
   * a footswitch on the floor is enough — and an Undo kept inside it vanished
   * with it, halfway through somebody auditioning amps. Here it lasts until
   * another model is picked, another block is opened, the preset loads again
   * (a Revert, or another preset, has put other settings on the block), or
   * the editor closes. And a pick still on the wire when the preset loaded
   * again made its offer for the preset just left, so the offer carries the
   * load it was made under and is only shown under that one.
   */
  const [modelUndo, setModelUndo] = useState(null)
  useEffect(() => setModelUndo(null), [openEid, bufferRev])
  /* The Undo under way, per block, and what the last one came to — up here
     for the same reason. The channel or scene change that stops an Undo also
     rebuilds the panel, and a new panel with the button live again would
     start a second Undo on top of the first. */
  const [restoring, setRestoring] = useState({})
  const [undoSaid, setUndoSaid] = useState(null)
  /* A good one says its piece and goes; one that missed stays, so the names
     in it can be found and turned by hand. */
  useEffect(() => {
    if (!undoSaid || undoSaid.bad) return undefined
    const t = setTimeout(() => setUndoSaid(null), 10000)
    return () => clearTimeout(t)
  }, [undoSaid])

  /*
   * The warning cannot outlive the button that raised it. Arming, then
   * changing preset from the bar above, would take the Save button away and
   * leave "This will overwrite the current preset" sitting over a screen with
   * nothing to confirm.
   */
  useEffect(() => {
    if (!pending && saveTo.armed) saveTo.disarm()
  }, [pending, saveTo])

  const block = chainNow.elsewhere ? null : blocks.find((b) => sameBlock(b, openEid)) || null

  /*
   * And brings the page to it. A search result is tapped with the keyboard
   * up and the page somewhere else: "it'll pull up the parameters but then
   * clicking on it does nothing." It did — out of sight. So a tap on a
   * result also scrolls the page to the block it opened, once that block has
   * been laid out, which is the moment its position is known.
   *
   * WHILE THE SEARCH BOX WAS AT THE FOOT OF THE PAGE (10 November 2026; it
   * is behind the magnifier at the top since that evening, lib/editMore),
   * the block was ABOVE the results, and nothing over it moved when they
   * went. So a block already drawn may not be laid out again by a pick
   * (the same block, or another whose panel is the same height), and the
   * layout alone would leave the page at the search box with the block out
   * of sight above it. Where the panel is already on the page (`panelAt`),
   * the page goes to it as soon as the keyboard is out of the way
   * (afterKeyboard); a panel drawn for the first time, or moved, still
   * brings the page itself from its layout, as it always did.
   */
  const page = useRef(null)
  const bringTo = useRef(null)
  /* Where the open block's panel sits on the page, as last laid out; null with none drawn. */
  const panelAt = useRef(null)
  if (!block) panelAt.current = null
  useEffect(() => {
    if (focus?.nonce) bringTo.current = focus.nonce
    const nonce = focus?.nonce
    if (!nonce || panelAt.current === null) return undefined
    return afterKeyboard(() => {
      if (bringTo.current !== nonce || panelAt.current === null) return
      bringTo.current = null
      const y = Math.max(0, panelAt.current - space.md)
      page.current?.scrollTo({ y, animated: true })
    })
  }, [focus])
  const panelLaid = (e) => {
    panelAt.current = e.nativeEvent.layout.y
    if (!bringTo.current) return
    bringTo.current = null
    const y = Math.max(0, e.nativeEvent.layout.y - space.md)
    page.current?.scrollTo({ y, animated: true })
  }
  /*
   * A BLOCK HELD ON PLAY, WITH EDIT BESIDE IT (docs/two-sides, "Derek's
   * idea"; lib/twoSides holdGoes 'edit'): Edit jumps to that block, the way
   * a search result does, naming no control. `jump` is { eid, at }, from
   * App; each hold has its own `at`, so holding the block already open
   * brings the page back to it.
   */
  const jumpAt = jump?.at
  useEffect(() => {
    if (!jumpAt || jump?.eid == null) return
    setOpenEid(jump.eid)
    setFocus({ eid: jump.eid, paramId: null, nonce: jumpAt })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpAt])

  /*
   * A BLOCK OPEN BEFORE ANYTHING IS TAPPED (lib/editMore firstOpen): "I kind
   * of want this to mainly be to edit knob presets quickly" (Justin, 10
   * November 2026). Once for each preset this screen sees: the block last
   * open in it (`keptOpen`, kept while the app runs), else the amp, else the
   * first that is not an end. A block already open that this preset has too
   * stays open (a hold's jump among them, set just before this). Closed by
   * its own tile, it stays closed until the next preset. Never on a VP4,
   * whose knobs the app cannot read, and never from the last song's chain.
   */
  const presetNumber = preset?.number ?? null
  const autoFor = useRef(undefined)
  useEffect(() => {
    if (chainNow.elsewhere || vp4Bench() || !blocks.length || autoFor.current === presetNumber) return
    autoFor.current = presetNumber
    setOpenEid((was) =>
      was !== null && blocks.some((b) => sameBlock(b, was))
        ? was
        : firstOpen(
            blocks.map((b) => ({ id: idOf(b), slug: b.slug })),
            keptOpen.get(presetNumber)
          )
    )
  }, [blocks, chainNow.elsewhere, presetNumber])
  useEffect(() => {
    if (openEid !== null && presetNumber !== null) keptOpen.set(presetNumber, openEid)
  }, [openEid, presetNumber])

  /* What this preset, this unit and this connection let More offer: the same rules the buttons under the knobs had. */
  const chainTools = !vp4Bench() && !viaBle && !chainNow.elsewhere
  const modsHere = chainTools && modifiersBind
  const renameHere = !vp4Bench() && !viaBle && !chainNow.elsewhere
  /* One of More's rows, or a shortcut: opened under the chain, with the page brought up to it. */
  const openTool = (which, start = null) => {
    setMoreOpen(false)
    setFinding(false)
    setModStart(start)
    setTool(which)
    page.current?.scrollTo({ y: 0, animated: true })
  }
  /* A tool this preset no longer offers (a move to Bluetooth, a chain still on its way) closes. */
  const toolShown = tool === 'chain' ? chainTools : tool === 'modifiers' ? modsHere : tool === 'rename' ? renameHere : false

  return (
    <ScrollView
      ref={page}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}
      /* The tidier Edit: the same page with less between its rows, said after the page's own so it takes its place there and nowhere else. */
      {...(tidy ? { contentContainerStyle: PAGE_TIDY } : null)}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!held}
      /* The page makes room for the keyboard itself, so a box typed in near its foot (Find a control, a knob's number, the rename boxes) is never left under it. iPhone and iPad only: Android resizes the window. */
      automaticallyAdjustKeyboardInsets
      /*
       * NOT the scroll view's cancel-content-touches rule. It was here for the knobs — the
       * native rule that a scroll may not take a touch a child is tracking —
       * and on iOS it applies to every child, not just a knob. This page is
       * buttons from top to bottom, so a finger that landed on any of them
       * could never become a scroll: "On edit screen I can't scroll at all
       * down to edit the parameters." The knob claims its touch in the
       * capture phase and refuses to hand it back (see components/Knob);
       * that, with the lock above, is what keeps a knob drag off the page.
       */
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <View style={{ flexShrink: 1 }}>
          {/*
            (BETA), because it is. "I don't feel like the edit screen is ready
            yet can we add to the screen that it's a beta feature. Next to edit
            on the edit screen have (Beta) then have a notice at the bottom of
            the page." Smaller and in the accent colour, so the screen's name
            is still the first thing read. The notice is at the foot of the
            page (BETA_NOTE).
          */}
          <Text
            accessibilityRole="header"
            accessibilityLabel="Edit, beta"
            style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}
          >
            Edit <Text style={{ color: color.signal, fontSize: font.lead, fontWeight: '700' }}>(Beta)</Text>
          </Text>
          {/*
            WHERE YOU ARE, not a sentence about it.

            "Can we show what preset name and scene they're on... maybe we
            don't even say the word changes land on, just show the preset name
            and scene name that they're currently on."

            It read "Changes land in scene 8 — Lead Mid…", which spent its
            first three words explaining the screen and then ran out of room
            for the only part that identifies anything — and never said which
            PRESET at all. Somebody deep in a drive block, deciding whether to
            save, could not tell from this screen what they were about to save
            over.

            Two lines rather than a longer one: the preset and the scene are
            two different answers, and one line could only ever truncate the
            second. The buttons beside this are centred on the row, so the
            extra line costs nothing but height.
          */}
          {/*
            Tapped, the names rename (`renameHere`): the shortcut to More's
            Rename preset and scenes, where a player looks for it. A pencil
            after the preset's name says so.
          */}
          <Pressable
            disabled={!renameHere}
            accessibilityRole={renameHere ? 'button' : undefined}
            accessibilityHint={renameHere ? 'Rename the preset and its scenes' : undefined}
            onPress={() => openTool('rename')}
          >
          {/* Not beside Play in the tidier Edit (`nameOnPlay`, above): Play says both. */}
          {nameOnPlay ? null : (
          <Text
            numberOfLines={1}
            style={{ color: color.silk, fontSize: font.small, fontWeight: '600' }}
          >
            {/* The same dodge the Play screen uses: a preset still being read
                has no name yet, and "Untitled" for half a second is a lie. */}
            {preset?.pending && !preset?.name ? '…' : presetLabel(preset)}
            {renameHere ? <Text style={{ color: color.silkFaint, fontWeight: '400' }}>{'  ✎'}</Text> : null}
          </Text>
          )}
          {nameOnPlay || caps?.hasScenes === false ? null : (
            /* Two lines for the scene: "Scene names cut short." The name
               is the only part of this line that identifies anything. */
            <Text numberOfLines={2} style={{ color: color.silkDim, fontSize: font.small }}>
              {`Scene ${scene + 1}${sceneNames[scene] ? ` — ${sceneNames[scene]}` : ''}`}
            </Text>
          )}
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {/*
            ONLY WHEN THERE IS SOMETHING TO SAVE.

            "The save button is visible and able to be clicked even though
            there's nothing that I change and nothing to save. Can we set that
            to only show up after a parameter has been changed?"

            It was always there, and pressing it on an untouched preset wrote
            the preset back over itself — harmless, and indistinguishable from
            the press that matters. A button that is sometimes a no-op teaches
            you to ignore it, which is the last thing this one can afford:
            everything this screen does is in the unit's edit buffer and gone
            at the next preset change.

            So it appears at the first change and leaves when the change is
            saved, which makes its presence the answer to "is there anything
            here I would lose". See rig.noteEdited for what counts as one.

            Not disabled-but-visible: a greyed button still has to be read and
            ruled out. Absent is read at a glance.
          */}
          {/* Find a control and More, beside Done (lib/editMore). Not the magnifier on a VP4, whose knobs the app cannot read. */}
          {vp4Bench() ? null : (
            <RoundButton icon={searchIcon} label={FIND_LABEL} on={finding} onPress={() => setFinding((was) => !was)} />
          )}
          <RoundButton icon={Platform.OS === 'android' ? moreAndroidIcon : moreIcon} label={MORE_LABEL} on={moreOpen} onPress={() => setMoreOpen(true)} />
          {pending ? <SaveButton s={saveTo} waiting /> : null}
          <Press label="Done" height={40} onPress={onBack} />
        </View>
      </View>

      <SaveNotes s={saveTo} />

      {/*
        FIND A CONTROL, BEHIND THE MAGNIFIER (lib/editMore), at the top of
        the page, where the keyboard leaves it in sight: the box and its
        results, until a result is tapped or the magnifier is tapped again.
        NOT ON A VP4, whose knobs the app cannot read (VP4_NO_KNOBS).
      */}
      {finding && !vp4Bench() ? (
        <FindControl
          autoFocus
          blocks={blocks}
          onError={setError}
          onPick={(eid, paramId) => {
            setTool(null)
            setFinding(false)
            setOpenEid(eid)
            setFocus({ eid, paramId, nonce: Date.now() })
          }}
        />
      ) : null}

      {error ? (
        <Note tone="fault" onDismiss={() => setError(null)}>
          {error}
        </Note>
      ) : null}

      {chain === 'reading' && !chainAll.length && !chainNow.elsewhere ? (
        <Note>Reading what’s in this preset…</Note>
      ) : null}
      {chain === 'failed' && !chainNow.elsewhere ? (
        <Note tone="warn">
          The unit didn’t answer when we asked what’s in this preset, so these are whatever it last
          told us.
        </Note>
      ) : null}
      {!chainAll.length && chain === 'ok' && !chainNow.elsewhere ? <Note>This preset is empty.</Note> : null}

      {/*
        THE KNOBS COME AS HIGH AS THE CHAIN ALLOWS. "In edit move search bar
        and amp and pedal names to the bottom. Have the Bluetooth warning also
        move to the bottom. We want as many knobs visible in edit." (Justin,
        10 November 2026.) The three sat here, over the chain: about 130
        points on a phone held upright before the first block tile, and about
        280 over Bluetooth with its note up. They are under the open block now
        (Find a control and Amp & pedal names) and at the foot of the page
        (the note); see below.
      */}
      {/* ----------------------------------------------------------- chain */}
      {/*
        THE CHAIN READS LEFT TO RIGHT, the way the signal goes and the way the
        browser has always drawn it.
        
        "The chain shows up differently from the web version compared to on the
        phone. I'd like the web version better, where it shows the chain and you
        can swipe left to right to view it."
        
        It was a wrapped grid — four across, then a new line, then a new line —
        which fits more on a screen and throws away the one thing the row is
        for. A chain is an ORDER: what the guitar hits first and what it hits
        last. Wrapped, the block after the fourth is underneath the first, and
        nothing on screen says the rows join up. The unit draws it in a line,
        the browser draws it in a line, and there is no reason a phone cannot
        scroll.
        
        The input, the output, the looper and the gate stay IN the row, where
        this screen has always put them — see the note at the top of this file
        about why the bench shows the ends and the stage hides them. The
        browser lifts them out of the strip; here they are part of it, and
        scrolling is what makes that affordable.
      */}
      <ChainUpdating chain={chainNow} />
      {chainNow.elsewhere ? <ChainWait chain={chainNow} height={TAP} /> : null}
      <SideScroll
        showsHorizontalScrollIndicator={false}
        style={{ display: chainNow.elsewhere ? 'none' : 'flex', opacity: chainNow.late ? 0.55 : 1 }}
        /* The chain is wider than the phone by design now, so the last tile
           needs somewhere to end that is not flush against the bezel. */
        contentContainerStyle={{ flexDirection: 'row', gap: space.sm, paddingRight: space.lg }}
      >
        {blocks.map((b) => {
          const hue = blockColor(b.slug)
          const open = sameBlock(b, openEid)
          /* A real VP4's on/off is not read: no word, and unlit, until the player's own tap (lib/vp4-safety VP4_ON_OFF_UNKNOWN). */
          const unsure = vp4Here() && typeof b.bypassed !== 'boolean'
          const engaged = !unsure && !b.bypassed
          /* Named rather than written inline: the word the unit uses for a
             block that is off has no business sitting next to the text that
             gets drawn. */
          const state = unsure ? '\u00a0' : engaged ? 'On' : 'Off'
          const under = open ? 'Open' : b.channel || state
          return (
            <Tile
              key={idOf(b)}
              label={shortBlock(b)}
              sub={under}
              fill={hue.fill}
              ink={hue.ink}
              picked={hue.picked}
              /* Input and Output: an outline, as the browser's strip draws them. */
              quiet={quietEnd(b.slug)}
              on={open}
              height={TAP}
              haptic={thud}
              /* With a tool from More up, a tile closes it and shows that block's knobs. */
              onPress={() => {
                if (toolShown) {
                  setTool(null)
                  setOpenEid(idOf(b))
                } else setOpenEid(open ? null : idOf(b))
              }}
              /* Fixed rather than shared out across the width: in a row that
                 scrolls there is no width to share, and tiles that sized
                 themselves to their own label would make a ragged strip. */
              style={{ width: 84, opacity: engaged ? 1 : 0.55 }}
            />
          )
        })}
        {/* ＋ Chain, the last tile: the shortcut to More's Edit chain, where the chain is. */}
        {chainTools && blocks.length ? (
          <Tile
            label={CHAIN_TILE.label}
            sub={CHAIN_TILE.sub}
            quiet
            on={toolShown && tool === 'chain'}
            height={TAP}
            haptic={thud}
            accessibilityLabel={MORE_ROWS.chain.label}
            onPress={() => (toolShown && tool === 'chain' ? setTool(null) : openTool('chain'))}
            style={{ width: 84 }}
          />
        ) : null}
      </SideScroll>

      {/*
        "If you click the looper pedal, it pops up the looper controls." Above
        its knobs rather than instead of them: the knobs are still how the
        loop's level and mix are set.
      */}
      {/*
        THE TOOL OPEN FROM MORE, OR FROM ITS SHORTCUT, in the open block's
        place under the chain (lib/editMore), until its Close: Edit chain,
        Modifiers (on a held knob's control when a knob opened it), or the
        rename boxes. Each draws what its door under the knobs opened.
      */}
      {toolShown && tool === 'chain' ? <ChainEditor blocks={chainAll} caps={caps} onError={setError} onScrollLock={setHeld} onClose={() => setTool(null)} /> : null}
      {toolShown && tool === 'modifiers' ? (
        <Modifiers key={modStart ? `${modStart.eid}:${modStart.paramId}` : 'more'} blocks={modBlocks} onError={setError} start={modStart} onClose={() => setTool(null)} />
      ) : null}
      {toolShown && tool === 'rename' ? <RenameDoor onClose={() => setTool(null)} /> : null}

      {block?.slug === 'looper' && !toolShown ? <Looper block={block} /> : null}

      {/*
        A VP4's knobs, said once, in words, where the line below says to tap
        a block — and above an opened block, so opening one moves nothing. Its
        panel has the on/off and nothing else (BlockPanel), and nothing raises
        the knobs refusal as a fault: it went up red over the page and pushed
        the chain down, for a tap the screen had just invited.
      */}
      {vp4Bench() && blocks.length && !chainNow.elsewhere ? <Note>{VP4_NO_KNOBS}</Note> : null}

      {block && !toolShown ? (
        <View onLayout={panelLaid}>
          <BlockPanel
            key={`${idOf(block)}:${block.channel || ''}:${scene}:${bufferRev}`}
            block={block}
            channels={caps?.channelNames}
            focus={focus}
            onError={setError}
            onScrollLock={setHeld}
            modelUndo={modelUndo && sameBlock(block, modelUndo.eid) && modelUndo.rev === bufferRev ? modelUndo.snap : null}
            /* A finished Undo takes back its own block's offer, not one
               picked on another block while it ran. */
            onModelUndo={(snap) =>
              setModelUndo((u) => (snap ? { eid: idOf(block), rev: bufferRev, snap } : u && sameBlock(block, u.eid) ? null : u))
            }
            restoring={restoring[idOf(block)] || null}
            onRestoring={(p) =>
              setRestoring((all) => {
                const next = { ...all }
                if (p) next[idOf(block)] = p
                else delete next[idOf(block)]
                return next
              })
            }
            undoSaid={undoSaid && sameBlock(block, undoSaid.eid) && undoSaid.rev === bufferRev ? undoSaid : null}
            onUndoSaid={(said) => setUndoSaid(said ? { ...said, eid: idOf(block), rev: bufferRev } : null)}
            overBle={viaBle}
            /* The i beside the model: Amp & pedal names, on that model (lib/editMore gearStart). */
            onModelInfo={onOpenGear ? (start) => onOpenGear(start) : null}
            /* A knob held still: Modifiers, on that knob (lib/editMore HOLD_MS). Only where More offers Modifiers. */
            onHoldKnob={modsHere && block.turns !== true ? (eid, paramId) => openTool('modifiers', { eid, paramId }) : null}
          />
        </View>
      ) : !toolShown && blocks.length && !chainNow.elsewhere && !vp4Bench() ? (
        <Note>Tap a block to open its controls.</Note>
      ) : null}


      {/*
        WHAT EDIT DOES OVER BLUETOOTH (or on the USB cable), at the foot of
        the page since 10 November 2026, where it was the first thing under
        the title: under the line that says what needs the computer, so the
        two are read together, and out of the knobs' way. Up until its cross
        is pressed, once per device, as before.
      */}
      {editNoteUp({ viaBle, up: bleNoteUp, saves: caps?.supportsSave === true }) ? (
        <Note
          onDismiss={() => {
            setBleNoteUp(false)
            markBleEditNote()
          }}
        >
          {onCable ? CABLE_EDIT_NOTE : BLE_NOTE}
        </Note>
      ) : null}

      {/*
        MORE (lib/editMore): the four buttons that sat under the knobs until
        10 November 2026, by the same rules (`chainTools`, `modsHere`,
        `renameHere`), and what Edit cannot do here said once, where the
        chain editor's row would be (VP4_NO_EDITS on a VP4, BLE_NO_CHAIN over
        Bluetooth or a USB cable). And the beta note, which was a box at the
        foot of the page.
      */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={MORE_TITLE}>
        <View style={{ gap: space.sm }}>
          {chainTools ? <Press label={MORE_ROWS.chain.label} sub={MORE_ROWS.chain.sub} onPress={() => openTool('chain')} /> : null}
          {modsHere ? <Press label={MORE_ROWS.modifiers.label} sub={MORE_ROWS.modifiers.sub} onPress={() => openTool('modifiers')} /> : null}
          {renameHere ? <Press label={MORE_ROWS.rename.label} sub={MORE_ROWS.rename.sub} onPress={() => openTool('rename')} /> : null}
          {onOpenGear ? (
            <Press
              label={MORE_ROWS.gear.label}
              sub={MORE_ROWS.gear.sub}
              onPress={() => {
                setMoreOpen(false)
                onOpenGear(null)
              }}
            />
          ) : null}
          {vp4Bench() ? <Note tone="hint">{VP4_NO_EDITS}</Note> : viaBle ? <Note tone="hint">{BLE_NO_CHAIN}</Note> : null}
          <Note tone="warn">{BETA_NOTE}</Note>
        </View>
      </Sheet>
    </ScrollView>
  )
}

/* The tidier Edit's page: the page's own padding, with the smaller gap between its rows. */
const PAGE_TIDY = { padding: space.lg, gap: space.md, paddingBottom: space.xxl }

/**
 * What the foot of the Edit screen says, while it is a beta.
 *
 * Plain about what can go wrong (a control that is missing, or that moves
 * differently from the unit) and where to say so, rather than a word that
 * only says "unfinished". Feedback is the row in Settings.
 */
const BETA_NOTE =
  'Edit is a beta feature. Some blocks and controls may be missing, or may not change the same way they do on your unit yet. If something looks wrong, tell us with Feedback in Settings.'

/*
 * WHAT EDIT DOES OVER BLUETOOTH, said once at the foot of the page (at the
 * top until 10 November 2026: "Have the Bluetooth warning also move to the
 * bottom"), and what it leaves to the computer, said once where the chain
 * editor would be, just over it.
 *
 * "I have an FM3 and AM4 I can test on." Over Bluetooth the phone reads and
 * turns the unit's knobs itself (bleWire's edit routes, lib/am4-edit.js, and
 * lib/gen3-edit.js for the FM3, FM9 and Axe-Fx III): knobs, models and
 * on/off. On a unit's own USB cable it is the same wire, and the note says
 * the cable instead (lib/cableWords CABLE_EDIT_NOTE). Saving is the
 * computer's (lib/saveViaComputer), so a change made here plays and is lost
 * at the next preset change unless it is saved on the unit; and moving
 * blocks, modifiers and names are not built over Bluetooth yet. Plain about both, rather than a Save that cannot
 * work and doors that open on refusals.
 */
export const BLE_NOTE =
  'Over Bluetooth you can turn knobs, change models and switch blocks on and off. Changes play right away, but the app can’t save them over Bluetooth yet: to keep a change, save it on the unit itself before you change presets.'
export const BLE_NO_CHAIN = 'Moving, adding and removing blocks, modifiers and renaming need the computer for now.'

/**
 * One block's controls.
 *
 * Keyed from above on the block, its channel and the scene — the three things
 * that genuinely change what a knob here MEANS — and on the preset being
 * loaded again, which changes every value under all three (bufferRev). Not on the block object: every
 * commit ends in a re-read that hands this an identical block under a new
 * identity, and keying on that threw the knobs away and read them again for
 * nothing, once per knob.
 */
export function BlockPanel({
  block,
  channels,
  focus,
  onError,
  onScrollLock,
  modelUndo,
  onModelUndo,
  restoring,
  onRestoring,
  undoSaid,
  onUndoSaid,
  /*
   * DRAWN IN PLAY'S HOLD POP-UP (components/PopKnobs; lib/holdPop): "have
   * the knobs only pop up above the channels" (Justin, 10 November 2026).
   * The knobs and their pages, read and written by the same code, and
   * nothing else (lib/holdPop POP_LEAVES_OUT). The pop-up draws it as the
   * panel below too, which takes out the name's row, Copy channel and the
   * on/off button, and hands it no channels, since its own are under the
   * knobs. What `bare` adds is the rest: no model list and no cab state
   * are asked for, so no model and no IR picker are drawn, and the Level
   * is left to Edit. False everywhere else.
   */
  bare = false,
  overBle = false,
  /*
   * DRAWN AS DEREK'S PANEL (components/BlockSide: a block held on Play, on a
   * big screen). The same channels, knobs, Level and model, read and written
   * by the same code; without the name's row (the panel has its own, with
   * Close), Copy channel and the on/off button, because one tap on the block
   * on Play already does that (lib/twoSides PANEL_LEAVES_OUT). False on the
   * Edit screen, which draws everything it always did.
   */
  panel = false,
  /*
   * ON THE EDIT SCREEN ONLY (lib/editMore): the i beside the model, which
   * opens Amp & pedal names on it (`onModelInfo`, handed { family, name }),
   * and a knob held still, which opens Modifiers on it (`onHoldKnob`, handed
   * the block and the control). Null in every other view of these knobs.
   */
  onModelInfo = null,
  onHoldKnob = null
}) {
  /* Read once and used everywhere below: see unit.mjs on why this is not
     `block.eid`, and what it cost to find out. */
  const eid = idOf(block)
  /*
   * THE TIDIER EDIT (lib/tidyEdit; lib/useTidyEdit: his account until
   * features TIDY_EDIT_FOR_EVERYONE). "We want as many knobs visible in
   * edit" (Justin, 10 November 2026). Two things, both by this panel's own
   * measured width (`wide`) and never by the kind of device:
   *
   *   the knobs, in every view of this panel (Edit, Derek's panel, the hold
   *   pop-up): as many across as fit, three on a phone held upright, five
   *   in half an iPad on its side, eight across the whole of it;
   *
   *   and on the Edit screen itself (`tidy`, below: not `panel`, not
   *   `bare`, not a block with no knobs to read), ONE row for the block:
   *   its name, its channels and its on/off, with the model picker in it
   *   too where the panel is wide enough (headShape). The pages' row is
   *   shorter, and Color goes under the knobs with Copy channel.
   *
   * Closed to an account, and until the panel is measured, every line
   * below draws what it always drew.
   */
  const tidyOn = useTidyEdit()
  const [wide, setWide] = useState(0)
  const cell = tidyOn ? knobCell(wide, space.md) : 0
  const [params, setParams] = useState([])
  /* The editor's own pages for this block, as the unit sent them. */
  const [layout, setLayout] = useState(null)
  const [models, setModels] = useState([])
  /* Which model this block is on. It comes back on the params read and nowhere
     else — /preset/blocks has never carried one. */
  const [type, setType_] = useState(null)
  /* What a cab block is really playing, from the host's cab state. A cab has
     no model for the picker to write — see lib/cab-pick.js — so for a cab this
     is what the picker reads and writes through. Null for every other block,
     and for a unit with no cab state to give. */
  const [cab, setCab] = useState(null)
  /* The unit's IR names by bank, for the IR picker: asked for once, when a
     cab with cab state first opens here. They are the unit's, not the
     preset's, and some three thousand names down a relay. */
  const [irs, setIrs] = useState(null)
  const irsAsked = useRef(false)
  const [tab, setTab] = useState('main')
  const [picking, setPicking] = useState(false)
  /* What is typed into the model find box. */
  const [hunt, setHunt] = useState('')
  const [loading, setLoading] = useState(false)
  /* The block's read has come back at least once (for the line that says its knobs need a newer computer app, below). */
  const [answered, setAnswered] = useState(false)
  /*
   * THE BLOCK'S LIST SETTINGS (lib/editSettings): what its read said they
   * are, and the choice just tapped on one while its write is out. Drawn
   * under the knobs for the accounts lib/useEditSettings opens them to.
   */
  const [enums, setEnums] = useState([])
  const [choosing, setChoosing] = useState({})
  const settingsOn = useEditSettings()
  /* Values a finger has moved but the unit has not confirmed yet. */
  const [local, setLocal] = useState({})
  /* One checked write per control at a time — see commit. */
  const writes = useRef(null)
  const writeOne = useRef(null)
  if (!writes.current)
    writes.current = oneWriteAtATime((job) => writeOne.current?.(job), {
      same: (a, b) => Object.is(a.next, b.next)
    })
  /* The cab this block was on before the last pick, for the eight seconds
     during which taking it back is one tap. A model's way back is held a
     level up — see modelUndo in Edit — because it has to outlive this panel. */
  const [undo, setUndo] = useState(null)
  const undoTimer = useRef(null)
  /* A model Undo under way (restoring, for the line beside the button) and
     what the last one came to (undoSaid) are held in Edit too. Twenty
     settings down a relay take seconds, and the panel can be rebuilt in them. */
  /* The channel this block is on now, from the store rather than the render
     this panel was drawn in: a pick or an Undo outlives the render. */
  const liveChannel = () => (getState().allBlocks || []).find((b) => sameBlock(b, eid))?.channel ?? null

  /* What each knob does, from the computer's help; a "?" under the knob opens it. */
  const [help, setHelp] = useState(() => KNOB_HELP.get(block.slug) ?? null)
  const [helpOn, setHelpOn] = useState(null)
  useEffect(() => {
    if (KNOB_HELP.has(block.slug)) {
      setHelp(KNOB_HELP.get(block.slug))
      return undefined
    }
    let live = true
    blockHelp(block.slug).then((h) => {
      KNOB_HELP.set(block.slug, h)
      if (live) setHelp(h)
    })
    return () => {
      live = false
    }
  }, [block.slug])

  /* Moved by a channel copy, so the panel reads the block again. */
  const [readAgain, setReadAgain] = useState(0)
  /* A VP4's knobs and models have no read the app can make (lib/vp4-safety VP4_NO_KNOBS, said once above): nothing is asked, and nothing raised. */
  /* Nor a block the wire has no knob catalog for (bleWire `knobs: false`: an Axe-Fx III's NAM and IR Player over Bluetooth): its on and off, and NO_KNOBS_YET under them. */
  const noKnobsYet = block.knobs === false
  const knobless = vp4Bench() || noKnobsYet
  useEffect(() => {
    if (knobless) return undefined
    let stop = false
    ;(async () => {
      setLoading(true)
      setLocal({})
      try {
        const [p, t] = await Promise.all([
          blockParams(eid),
          /* The pop-up's knobs (`bare`) draw no model, so no list of them is asked for. */
          bare ? [] : blockTypes(block.slug).catch(() => [])
        ])
        /* After the params, not beside them: both are a read of the whole
           block down one relay. And a cab state that cannot be had is the
           panel as it always was, not an error on screen. */
        const c = bare ? null : block.slug === 'cab' ? await readCab(() => cabState(eid), p) : null
        if (stop) return
        setParams(p?.named || [])
        setEnums(p?.enums || [])
        setAnswered(true)
        setLayout(p?.layout || null)
        setModels(t || [])
        setType_(p?.type ?? null)
        setCab(c)
      } catch (err) {
        if (!stop) onError(err.message)
      } finally {
        if (!stop) setLoading(false)
      }
    })()
    return () => {
      stop = true
    }
  }, [eid, block.slug, onError, readAgain, knobless, bare])

  useEffect(() => () => clearTimeout(undoTimer.current), [])

  useEffect(() => {
    if (!cab || irsAsked.current) return
    irsAsked.current = true
    listIrBanks()
      .then((b) => setIrs(b && typeof b === 'object' && !b.error ? b : null))
      .catch(() => {
        // Asked again the next time, rather than never.
        irsAsked.current = false
      })
  }, [cab])

  /*
   * Levels are kept out of the knobs, and typed instead.
   *
   * The same rule the browser holds, and it is not about tidiness: a block
   * level set to -60 dB makes a preset that looks right and is silent, and the
   * one place that is easy to do by accident is a knob under a thumb. So the
   * level sits under the deck as a number. It was read-only there; since 10
   * November 2026 a level in decibels can be typed, never below the floor
   * (lib/blockLevel, which says who asked and what the rule is).
   */
  /* And a cab's IR numbers and banks, which are choices out of a list rather
     than knobs — found by the ids the cab state names. */
  const offDeck = cabHidden(cab)
  const editable = params.filter((p) => !isSilencingParam(p.name)).filter((p) => !offDeck.has(p.id))
  const level = blockLevel(params)

  /* Split into the pages Fractal's editor uses, where the unit says what
     they are — see lib/editPages.js. */
  const pages = editPages(editable, layout)
  const onPage = pageFor(pages, tab)
  const shown = onPage?.params || []

  /*
   * The list settings that go with the page of knobs showing (lib/editSettings
   * settingsByPage). Not in the hold pop-up, which is knobs over channels and
   * nothing else, and not where the block has no knobs to read.
   */
  const settings = settingsOn && !bare && !knobless ? blockSettings(enums, block.slug) : []
  const pageSettings = settings.length ? settingsByPage(settings, layout, pages).get(onPage?.key) || [] : []
  /*
   * A choice tapped: the write Edit already has for a list setting (lib/device
   * setEnum, the unit's own number for the choice), then the block read again,
   * since a choice can change what other settings read (and, on some blocks,
   * which pages there are). What the read says is what the buttons show: a
   * choice the unit did not take goes back by itself.
   */
  const pickSetting = async (setting, value) => {
    if (restoring) return
    setChoosing((prev) => ({ ...prev, [setting.id]: value }))
    try {
      await setEnum(eid, setting.id, value)
      noteEdited()
      const fresh = await blockParams(eid)
      setParams(fresh?.named || [])
      setEnums(fresh?.enums || [])
      setLayout(fresh?.layout || null)
    } catch (err) {
      onError(err.message)
    } finally {
      setChoosing((prev) => {
        const copy = { ...prev }
        delete copy[setting.id]
        return copy
      })
    }
  }

  /*
   * Search opens the right block, then puts your eyes on the control you named.
   *
   * Two steps, because a control on the second page is unreachable until that
   * page is showing: the tab moves first, and the knob is marked once the read
   * has finished and the cell it names actually exists. Marking before that is
   * marking nothing, which looks exactly like a search result that did nothing.
   */
  const [lit, setLit] = useState(null)
  /* Which search has already turned the page, so a tab pressed after it stays
     pressed instead of being turned back to the search's page. */
  const turned = useRef(null)
  useEffect(() => {
    if (!focus?.nonce || focus.eid !== eid) return undefined
    if (loading) return undefined
    const holding = pageHolding(pages, focus.paramId)
    if (holding && turned.current !== focus.nonce) {
      turned.current = focus.nonce
      setTab(holding.key)
      return undefined
    }
    if (!shown.some((p) => p.id === focus.paramId)) return undefined
    setLit(focus.paramId)
    const clear = setTimeout(() => setLit(null), 2500)
    return () => clearTimeout(clear)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, eid, loading, tab])

  const valueOf = (p) => (local[p.id] !== undefined ? local[p.id] : p.value)

  /*
   * A knob's value to the unit, checked — the browser's rule, for the same
   * bug. The value is handed in by whatever moved it, because reading it out
   * of `local` here read the value from before the move: a VoiceOver swipe
   * sent the swipe before it, and the last one never went at all. And one
   * write per control at a time, the newest waiting value next, with the
   * value on the knob let go only once the unit has caught up with it.
   */
  const commit = (p, override) => {
    /* For the length of an Undo the knobs show the new model's values, which
       the unit no longer holds, and a turn there would be pulled back or
       named as a miss. */
    if (restoring) return
    const next = override !== undefined ? override : local[p.id]
    if (next === undefined) return
    if (next === p.value && !writes.current.busy(p.id)) return
    return writes.current.send(p.id, { p, next })
  }

  writeOne.current = async ({ p, next }) => {
    try {
      const res = await setParamConfirmed(eid, p.id, next, p)
      /* Before the read-back, not after: the write is out and the unit is
         holding a value the slot does not, whatever the read says next. */
      noteEdited()
      const fresh = await blockParams(eid)
      setParams(fresh?.named || [])
      setEnums(fresh?.enums || [])
      if (!res.ok) onError(didNotTake(p, res.actual, fresh?.named || []))
      setLocal((prev) => {
        if (prev[p.id] !== next) return prev
        const copy = { ...prev }
        delete copy[p.id]
        return copy
      })
      /*
       * And nothing about the chain has changed, so nothing is re-read. Every
       * commit used to end in a full read of the unit for a knob that changed
       * none of it — five round trips down one channel per knob, competing
       * with the writes for the same port.
       */
    } catch (err) {
      onError(err.message)
    }
  }

  /**
   * Swapping the model, and being able to take it back.
   *
   * A swap is structural: it replaces the whole parameter set, so every knob
   * here means something different afterwards. That argues for a confirm — but
   * a dialog in front of a tone control is the ceremony that sends people back
   * to the hardware editor, and the one thing you want after hearing a wrong
   * amp is to be somewhere else, quickly. So it writes now and offers the way
   * back — the whole block as it was read just before the pick, because the
   * unit loads a new model's own settings and an Undo that only put the model
   * back gave you the old amp with the new amp's settings. See
   * lib/model-undo.js, shared with the browser.
   */
  const applyModel = async (value, { undoable = true } = {}) => {
    if (cab && block.slug === 'cab') return applyCab(value, { undoable })
    const was = type
    onUndoSaid(null)
    /* Where the pick was made. A preset loaded again, or a channel changed,
       while the read below is on the wire is not the block that was tapped. */
    const rev0 = getState().bufferRev
    const ch0 = liveChannel()
    /* The preset number moves the moment another preset is picked; the
       buffer's revision only once its chain has been read. */
    const n0 = getState().preset?.number
    const moved = () => getState().bufferRev !== rev0 || getState().preset?.number !== n0 || liveChannel() !== ch0
    /* Fresh, not what is on show: the switches are never kept here, and a
       read that fails falls back to the knobs on screen rather than to no
       Undo at all. */
    let before = null
    if (undoable && was && was.value !== Number(value)) {
      const now = await blockParams(eid).catch((err) => {
        if (err?.linkDown) throw err
        return null
      })
      before =
        modelSnapshot(now, { channel: block.channel ?? null }) ||
        modelSnapshot({ named: params, type: was }, { channel: block.channel ?? null })
      if (before?.type.value === Number(value)) before = null
      /* Named as the knobs are drawn, so a setting that didn't go back can be
         found on screen by the name the Undo gives it. */
      if (before) {
        const drawnAs = new Map()
        for (const pg of pages) for (const q of pg.params) if (!drawnAs.has(q.id)) drawnAs.set(q.id, q.label)
        before = { ...before, knobs: before.knobs.map((k) => ({ ...k, name: drawnAs.get(k.id) || k.name })) }
      }
      /* The model would land there, on settings no Undo could reach. */
      if (moved()) return
    }
    const sent = await setType(eid, Number(value))
    noteEdited()
    /* A new model is a new tile; the chain kept for this preset is not it. */
    chainChanged()
    const fresh = await blockParams(eid)
    /* The answer is what the unit shows afterwards, not what it said. */
    logDebug(
      'write',
      `block ${eid} model after the change`,
      fresh?.type?.value === Number(value) ? 'unit shows it' : `unit shows ${fresh?.type?.value ?? 'nothing'}, asked ${Number(value)}`
    )
    setParams(fresh?.named || [])
    /* A new model can bring different pages with it. */
    setLayout(fresh?.layout || null)
    setType_(fresh?.type ?? null)
    setLocal({})
    /* A refusal went in the log and nowhere else. Said on screen now, unless
       the read just taken shows the model on the block anyway. The block is
       still on the model it was on, so an offer already made stays. */
    if (sent?.ok === false && fresh?.type?.value !== Number(value)) {
      onError(MODEL_REFUSED)
      return
    }
    /* No timer: eight seconds is not long enough to hear an amp and decide.
       And none for a preset loaded again since: Edit has cleared the offer
       for that, and a late one would offer the last preset's amp to this. */
    if (before && getState().bufferRev === rev0) onModelUndo(before)
  }

  /**
   * Picking a cab, which is not a model change.
   *
   * The browser's, step for step: the mode to DynaCab if the block is playing
   * an IR, then slot 1's cabinet, both as plain numbers and never through
   * setType. Then the block is read again — cab state and knobs, because a
   * change of mode changes which controls there are — and the log says what
   * the CAB STATE shows. It used to compare against the model read back,
   * which on a cab is the Preamp Type, and so it said "unit shows it" about a
   * cab that had never been sent.
   */
  const applyCab = async (value, { undoable = true, back = null } = {}) => {
    const before = cab
    const write = (paramId, ordinal) => setEnum(eid, paramId, ordinal)
    let res
    try {
      res = back ? await restoreCab(before, back, write) : await pickCab(before, value, write)
    } catch (err) {
      /* The browser's: a write that timed out may have landed, so the panel
         reads again, or stops trusting the numbers it held. */
      const p = await blockParams(eid).catch(() => null)
      setCab(cabLost(before, await readCab(() => cabState(eid), p)))
      throw err
    }
    noteEdited()
    const fresh = await blockParams(eid)
    const now = await readCab(() => cabState(eid), fresh)
    /* A read that failed, or one the params read contradicts, is not an
       answer — what the writes left is. Dropping the cab state instead would
       put the next pick back on the model change, to the Preamp Type. */
    const read = now && !now.unsure ? now : null
    const landed = back ? cabBackTo(read, back) : cabShows(read, value)
    const shows = cabShowing(read, models)
    logDebug(
      'write',
      `block ${eid} model after the change`,
      landed
        ? 'unit shows it'
        : read
          ? `unit shows ${shows?.name ?? 'nothing'}, asked ${back ? back.name : (value?.name ?? Number(value))}`
          : "sent, couldn't read the cab back to check"
    )
    setParams(fresh?.named || [])
    setLayout(fresh?.layout || null)
    setType_(fresh?.type ?? null)
    setCab(read || cabAfter(before, taken(res)))
    setLocal({})
    clearTimeout(undoTimer.current)
    if (!res.ok && !landed) {
      setUndo(null)
      onError(CAB_REFUSED)
      return
    }
    /* Taken, and the unit reads as something else: said, not only logged. */
    if (read && !landed) onError(cabElsewhere(read, models))
    /* Told which pick this was: an IR's undo holds the bank and the IR too. */
    const was = cabWas(before, models, value)
    if (undoable && !back && was && !cabShows(before, value)) {
      setUndo({ name: was.name, cab: was })
      undoTimer.current = setTimeout(() => setUndo(null), 8000)
    } else {
      setUndo(null)
    }
  }

  const swap = async (value) => {
    setPicking(false)
    setHunt('')
    try {
      await applyModel(value)
    } catch (err) {
      onError(err.message)
    }
  }

  /* An IR out of the IR picker: {bank, ir, name}, through the cab pick. */
  const swapIr = async (pick) => {
    try {
      await applyCab(pick)
    } catch (err) {
      onError(err.message)
    }
  }

  /* The undo is a cab put back where it was, mode and all. */
  const takeBack = async () => {
    const back = undo
    if (!back) return
    setUndo(null)
    if (!cab || block.slug !== 'cab') return onError(CAB_UNDO_LOST)
    try {
      await applyCab(null, { undoable: false, back: back.cab })
    } catch (err) {
      onError(err.message)
    }
  }

  /*
   * Or a model put back, with every setting the app could see on it.
   *
   * This used to be `swap(back.value)` — a fresh pick of the old model, which
   * offered an Undo of its own, so taking a pick back offered to take the
   * taking back back. It is its own path now, and it offers nothing after.
   */
  const takeModelBack = async () => {
    const back = modelUndo
    if (!back || restoring) return
    setPicking(false)
    setHunt('')
    onUndoSaid(null)
    onRestoring({ step: 'model' })
    /* Every write lands on whichever channel is live. A footswitch, a channel
       tap or another preset in the seconds this runs stops it before the next
       one, rather than sending the rest of A's settings to B. */
    const at = getState()
    const ch0 = liveChannel()
    /* Another preset puts its number up at once, but its chain — and so the
       buffer's revision and the channel read from it — only seconds later.
       Without this the rest of the old song's settings land on the new one. */
    const n0 = at.preset?.number
    try {
      const r = await restoreModel(back, {
        channel: block.channel ?? null,
        setType: (v) => setType(eid, v),
        read: () => blockParams(eid),
        write: (p, v) => setParam(eid, p.id, v, p),
        writeEnum: (id, v) => setEnum(eid, id, v),
        writeChecked: (p, v) => setParamConfirmed(eid, p.id, v, p),
        progress: onRestoring,
        stillHere: () => {
          const s = getState()
          return liveChannel() === ch0 && s.sceneIndex === at.sceneIndex && s.bufferRev === at.bufferRev && s.preset?.number === n0
        }
      })
      if (!r.refused || (r.refused === 'unread' && r.modelSent)) {
        noteEdited()
        chainChanged()
      }
      if (r.last) {
        setParams(r.last.named || [])
        setLayout(r.last.layout || null)
        setType_(r.last.type ?? null)
        setLocal({})
      }
      const said = undoResult(r, back)
      if (!said.keep) onModelUndo(null)
      onUndoSaid(said)
    } catch (err) {
      onError(err.message)
    } finally {
      onRestoring(null)
    }
  }

  const engaged = !block.bypassed
  /* A real VP4's on/off is not read (lib/vp4-safety): the button says what a press does, not a state nobody read. */
  const unsure = vp4Here() && typeof block.bypassed !== 'boolean'
  const hue = blockColor(block.slug)

  /* What the picker says the block is on: for a cab with cab state, what the
     cab state says — and one playing an IR marks nothing in the list. */
  const cabNow = cabShowing(cab, models)
  const current = cabNow ? { value: cabNow.value, name: cabNow.name } : type
  /* And which IR it holds, out of the unit's banks in the unit's order. */
  const irList = cab && block.slug === 'cab' && irs ? irBanks(cab, irs, { named: params }) : []
  const irHere = irNow(cab, irList)

  /*
   * The models worth drawing. Capped rather than paged: the list is scrolled
   * with a thumb, and a cap with a count under it is honest about what is
   * missing in a way a list that just stops is not.
   */
  const needle = hunt.trim().toLowerCase()
  const found = needle
    ? models.filter(
        (m) =>
          m.name?.toLowerCase().includes(needle) || m.basedOn?.toLowerCase().includes(needle)
      )
    : models
  const matches = found.slice(0, 40)
  const more = found.length - matches.length
  /* The block's one row, on the Edit screen only (the tidier Edit, at the top of this panel): never Derek's panel, the hold pop-up, or a block with no knobs to read. */
  const tidy = tidyOn && !panel && !bare && !knobless
  /* The row's own on and off (the button under the knobs is not drawn then). */
  const flip = () => writeBlockBypass(eid, engaged)
  /* A NAM whose knobs the wire does have (an Axe-Fx III over Bluetooth, for an account lib/features NAM_KNOBS_FOR_EVERYONE opens them to): it opens like any block, with NAM_ON_THE_UNIT under its knobs for what is left to the unit. Not in the hold pop-up, which is the knobs only. */
  const namOnUnit = block.slug === 'nam' && !knobless && !bare
  /* The model picker in that row (a panel wide enough): then it is not under the knobs. */
  const modelUp = tidy && headShape(wide).model && models.length > 0
  /* The i beside the model, for a kind Amp & pedal names has a page for (lib/editMore gearStart): only the Edit screen hands onModelInfo over. */
  const infoAt = onModelInfo ? gearStart(block.slug, current?.name) : null
  const modelInfo = infoAt ? () => onModelInfo(infoAt) : null
  const pickChannel = async (ch) => {
    try {
      await writeChannel(eid, ch)
    } catch (err) {
      onError(err.message)
    }
  }
  /*
   * The models to pick from, with their find box: drawn under the Model
   * button where that is under the knobs, and straight under the block's
   * row where the model picker is up there (`modelUp`), so the list opens
   * beside the button that opened it.
   */
  const modelList = !picking ? null : (
            <View style={{ gap: space.sm }}>
              {/*
                A find box, because an amp block offers three hundred and
                thirty-one models. The browser scrolls its list to the one you
                are on and lets you read; a thumb cannot read three hundred
                rows, and drawing them all is a screen that stutters while you
                try.
              */}
              <TextInput
                value={hunt}
                onChangeText={setHunt}
                placeholder="Find a model"
                placeholderTextColor={color.silkFaint}
                autoCorrect={false}
                autoCapitalize="none"
                accessibilityLabel="Find a model"
                style={{
                  minHeight: TAP,
                  paddingHorizontal: space.md,
                  borderWidth: 1,
                  /* A frosted glass field (lib/glass): rounded like a card, rimmed, no shadow. */
                  ...glassField(),
                  color: color.silk,
                  fontSize: font.body
                }}
              />
              {matches.map((m) => (
                <Press
                  key={m.value}
                  label={m.name}
                  /* The amp beside the name, in the list where the choosing
                     happens. The maker alone is deliberately not used here: as
                     a suffix on forty rows it would say "Mesa/Boogie" beside
                     all of them and tell nobody which one is the Rectifier. */
                  sub={m.basedOn || modelNote(m.name) || undefined}
                  tone="signal"
                  on={m.value === current?.value}
                  onPress={() => swap(m.value)}
                />
              ))}
              {more > 0 ? (
                <Text style={{ color: color.silkDim, fontSize: font.micro }}>
                  {`${more} more — type to narrow it down.`}
                </Text>
              ) : null}
              {!matches.length ? <Note>Nothing named like that.</Note> : null}
            </View>
  )

  return (
    <View style={{ gap: space.md }} {...(tidyOn ? { onLayout: (e) => setWide(Math.round(e.nativeEvent.layout.width)) } : null)}>
      {/*
        THE BLOCK'S ONE ROW (the tidier Edit, above): its name, the model
        where there is room, its channels and its on/off. A long name takes
        a second line sooner than it is cut. The two ends of the chain have
        no on/off, as below.
      */}
      {tidy ? (
        <View style={TIDY_HEAD}>
          <View style={[TIDY_NAME, { borderLeftColor: hue.fill }]}>
            <Text accessibilityRole="header" numberOfLines={2} style={{ color: color.silk, fontSize: font.lead, fontWeight: '700' }}>
              {block.name}
            </Text>
          </View>
          {modelUp ? (
            <Press
              label={current?.name || `${models.length} to choose from`}
              height={HEAD_TALL}
              labelSize={font.small}
              on={picking}
              accessibilityLabel={`Model: ${current?.name || 'not read yet'}. ${picking ? 'Close the list' : 'Tap to change'}`}
              onPress={() => {
                if (!restoring) setPicking((v) => !v)
              }}
              style={TIDY_MODEL}
            />
          ) : null}
          {channels?.length > 1 ? (
            <View style={TIDY_CHANNELS}>
              {channels.map((ch) => (
                <Press
                  key={ch}
                  label={ch}
                  tone="signal"
                  on={block.channel === ch}
                  height={HEAD_TALL}
                  labelSize={font.small}
                  accessibilityLabel={`Channel ${ch}`}
                  /* Not while an Undo is putting this channel's settings back, as below. */
                  disabled={!!restoring}
                  onPress={() => pickChannel(ch)}
                  style={TIDY_CHIP}
                />
              ))}
            </View>
          ) : null}
          {['input', 'output'].includes(block.slug) ? null : (
            <Press
              label={unsure ? 'Turn it off' : engaged ? 'On' : 'Off'}
              tone="signal"
              on={engaged && !unsure}
              height={HEAD_TALL}
              labelSize={font.small}
              accessibilityLabel={`${block.name} is ${engaged ? 'on' : 'off'}. Turn it ${engaged ? 'off' : 'on'}`}
              onPress={flip}
              style={TIDY_CHIP}
            />
          )}
        </View>
      ) : null}
      {/* And the models, straight under that row, while its picker is open. */}
      {modelUp && picking ? (
        <View style={{ gap: space.sm }}>
          {!(cab && block.slug === 'cab') ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{MODEL_HINT}</Text> : null}
          {modelList}
        </View>
      ) : null}
      {/* Not in Derek's panel, which has the name in its own row beside Close, and no Color. Nor in the tidier Edit, whose one row above has the name. */}
      {panel || tidy ? null : (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          borderLeftWidth: 4,
          borderLeftColor: hue.fill,
          paddingLeft: space.md
        }}
      >
        <Text accessibilityRole="header" style={{ flex: 1, color: color.silk, fontSize: font.lead, fontWeight: '700' }}>
          {block.name}
        </Text>
        {/*
          ITS COLOUR, from here as well as from Settings → Colours: the bench
          is where a player looks at a block and decides it should not be the
          same red as the drive beside it. The colour is the family's — every
          drive, in every preset — so the sheet says so. Not for the chain's
          two ends, which are outlines nobody sees a colour on.
        */}
        {paintable(block.slug) ? <BlockColour slug={block.slug} /> : null}
      </View>
      )}

      {/* ------------------------------------------------ channel and state */}
      {/* (In the block's one row in the tidier Edit, above.) */}
      {channels?.length > 1 && !tidy ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {channels.map((ch) => (
            <Press
              key={ch}
              grow
              label={ch}
              tone="signal"
              on={block.channel === ch}
              /* Not while an Undo is putting this channel's settings back:
                 the rest of them would land on the channel tapped. */
              disabled={!!restoring}
              onPress={async () => {
                try {
                  await writeChannel(eid, ch)
                } catch (err) {
                  onError(err.message)
                }
              }}
            />
          ))}
        </View>
      ) : null}

      {noKnobsYet ? <Note>{NO_KNOBS_YET}</Note> : null}
      {/* One the computer answers the knobs of (lib/ownBlocks `turns`), on a computer app from before it could: its read came back with none. */}
      {block.turns === true && answered && !loading && !params.length ? <Note>{OWN_KNOBS_NEED_COMPUTER}</Note> : null}

      {/* ------------------------------------------------------------ knobs */}
      {/*
        One tab per page. An amp has ten, more than a phone is wide, so the
        row scrolls sideways rather than squeezing the words.
      */}
      {pages.length > 1 ? (
        <SideScroll showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {pages.map((pg) => (
            <Press
              key={pg.key}
              label={pg.name}
              tone="signal"
              on={pg.key === onPage?.key}
              height={tidy ? HEAD_TALL : 44}
              onPress={() => setTab(pg.key)}
            />
          ))}
        </SideScroll>
      ) : null}

      {/*
        The knobs stay up while they are being read again. Swapping a deck of
        six for one line of text takes 200 points out of a screen that is as
        tall as its contents, so it lurches down and back up — for a read that
        is usually over in a second, on values that are usually the same ones.
      */}
      {/* Hidden says why its settings are there, once, above them. */}
      {onPage?.note ? <Note>{onPage.note}</Note> : null}

      {loading && !shown.length ? (
        <Note>{`Reading ${block.name}…`}</Note>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {shown.map((p) => (
            <View
              key={p.id}
              style={{
                /* Three to a row, as always; in the tidier Edit, as many as the panel's measured width takes (lib/tidyEdit knobCell). */
                width: cell || '30%',
                alignItems: 'center',
                gap: space.xs,
                /* The one you searched for, said with a ring for a couple of
                   seconds rather than a colour change that outstays it. */
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: lit === p.id ? color.live : 'transparent',
                paddingVertical: 2
              }}
            >
              <Knob
                param={p}
                label={p.label || p.name}
                value={valueOf(p)}
                onChange={(v) => {
                  if (!restoring) setLocal((prev) => ({ ...prev, [p.id]: v }))
                }}
                onCommit={(v) => commit(p, v)}
                onScrollLock={onScrollLock}
                {...(cell ? { size: knobSize(cell) } : null)}
                onHold={onHoldKnob ? () => onHoldKnob(eid, p.id) : null}
              />
              <ValueBox param={p} value={valueOf(p)} onCommit={(v) => commit(p, v)} />
              {help?.params?.[p.id]?.blurb ? (
                <Press
                  label={helpOn === p.id ? 'Hide' : '?'}
                  height={32}
                  accessibilityLabel={`What does ${p.label || p.name} do?`}
                  onPress={() => setHelpOn((was) => (was === p.id ? null : p.id))}
                />
              ) : null}
            </View>
          ))}
        </View>
      )}
      {(() => {
        const open = helpOn !== null ? shown.find((p) => p.id === helpOn) : null
        const h = open ? help?.params?.[open.id] : null
        return h?.blurb ? <Note>{`${open.label || open.name}: ${h.blurb}${h.tip ? ` ${h.tip}` : ''}`}</Note> : null
      })()}

      {level && !bare ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>LEVEL</Text>
          {levelTypes(level) ? (
            <>
              {/* Typed, never dragged, and held at the floor on its way out (lib/blockLevel). The box shows dB where the unit says nothing; what is sent is the level as it was read. */}
              <View style={{ width: 104 }}>
                <ValueBox
                  param={{ ...level, min: levelFloor(level), unit: level.unit || 'dB' }}
                  value={valueOf(level)}
                  onCommit={(v) => {
                    const next = levelToSend(level, v)
                    if (restoring || next === null) return
                    setLocal((prev) => ({ ...prev, [level.id]: next }))
                    commit(level, next)
                  }}
                />
              </View>
              <Text style={{ color: color.silkFaint, fontSize: font.micro }}>{LEVEL_HINT}</Text>
            </>
          ) : (
            <>
              <Text style={{ color: color.silk, fontSize: font.body, fontFamily: face }}>
                {`${fmt(level.value)}${level.unit ? ` ${level.unit}` : ''}`}
              </Text>
              <Text style={{ color: color.silkFaint, fontSize: font.micro }}>read-only</Text>
            </>
          )}
        </View>
      ) : null}

      {/* The page's list settings, under its knobs and its Level (lib/editSettings; "Menu style B"). */}
      {pageSettings.length ? <BlockSettings settings={pageSettings} choosing={choosing} disabled={!!restoring} onPick={pickSetting} /> : null}

      {namOnUnit ? <Note>{NAM_ON_THE_UNIT}</Note> : null}

      {/*
        UNDER THE KNOBS: copying the channel, on and off, and the model.
        "On the edit screens, let's move the copy channel, engaged and the
        pedal model name down below the actual knobs" (Justin, 9 November
        2026): the knobs are what a player opens a block for, so they come
        straight under the channel buttons, and these follow them.
      */}
      {/* Copy this channel onto another — see ChannelCopy below. Not over Bluetooth, where it is not built yet. Not in Derek's panel. */}
      {!panel && channels?.length > 1 && block.channel && !overBle ? (
        <ChannelCopy
          eid={eid}
          block={block}
          channels={channels}
          disabled={!!restoring}
          onDone={() => setReadAgain((n) => n + 1)}
          onError={onError}
        />
      ) : null}

      {/*
        The two ends of the chain have no on/off, and that is the unit's rule
        rather than a choice: a preset with its output bypassed is a preset
        nobody can hear.

        The block itself, always: on an AM4 the amp's pedal on Play is its
        boost (lib/am4-boost), so this is where its real on and off is.
      */}
      {/* Its colour, which the tidier Edit's one row has no room for: here, under the knobs. */}
      {tidy && paintable(block.slug) ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <BlockColour slug={block.slug} />
        </View>
      ) : null}
      {/* Nor in Derek's panel: one tap on the block on Play turns it on and off. Nor in the tidier Edit, whose one row above has it. */}
      {panel || tidy || ['input', 'output'].includes(block.slug) ? null : (
        <Press
          label={unsure ? 'Turn it off' : engaged ? 'Engaged' : 'Bypassed'}
          tone="signal"
          on={engaged && !unsure}
          onPress={() => writeBlockBypass(eid, engaged)}
        />
      )}
      {/* ------------------------------------------------------------ model */}
      {/* With the picker up in the block's row (`modelUp`), what the model is based on still reads here, under the knobs. */}
      {modelUp && !picking && (gearLine(type) || cabNow?.hint || modelInfo) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1, gap: space.xs }}>
            {gearLine(type) ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{gearLine(type)}</Text> : null}
            {cabNow?.hint ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{cabNow.hint}</Text> : null}
          </View>
          {modelInfo ? <ModelInfo onPress={modelInfo} /> : null}
        </View>
      ) : null}
      {models.length && !modelUp ? (
        <View style={{ gap: space.sm }}>
          <Press
            caption="Model"
            label={current?.name || `${models.length} to choose from`}
            sub={picking ? 'Close' : modelNote(current?.name) || 'Tap to change'}
            onPress={() => {
              if (!restoring) setPicking((v) => !v)
            }}
          />
          {/*
            What a model is based on, under the control and in every row of the
            list. "Search for the real life names that each AMP and all other
            effects are based off of and list them next to the name" — the line
            under the control only ever described the model already chosen,
            which is the one nobody is wondering about.
          */}
          {/* With the i beside it (lib/editMore): Amp & pedal names, on this model. */}
          {!picking && (gearLine(type) || modelInfo) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text style={{ flex: 1, color: color.silkDim, fontSize: font.small }}>{gearLine(type) || ''}</Text>
              {modelInfo ? <ModelInfo onPress={modelInfo} /> : null}
            </View>
          ) : null}
          {cabNow?.hint ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{cabNow.hint}</Text> : null}
          {/* Instead of a question on every pick: auditioning is many picks
              in a row. Not for a cab, which changes the cabinet and nothing
              else. */}
          {picking && !(cab && block.slug === 'cab') ? (
            <Text style={{ color: color.silkDim, fontSize: font.small }}>{MODEL_HINT}</Text>
          ) : null}
          {picking ? modelList : null}
        </View>
      ) : null}

      {/* ------------------------------------------------------------ IR */}
      {irHere && irList.length ? (
        <IrPicker banks={irList} now={irHere} onPick={swapIr} disabled={!!restoring} />
      ) : null}

      {undo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Text style={{ color: color.silkDim, fontSize: font.small, flex: 1 }}>
            {`Was ${undo.name}`}
          </Text>
          <Press label="Undo" height={44} onPress={takeBack} />
        </View>
      ) : modelUndo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Text accessibilityLiveRegion="polite" style={{ color: color.silkDim, fontSize: font.small, flex: 1 }}>
            {restoring ? undoProgress(restoring, modelUndo) : undoOffer(modelUndo)}
          </Text>
          <Press label="Undo" height={44} disabled={!!restoring} onPress={takeModelBack} />
        </View>
      ) : null}
      {undoSaid ? <Note tone={undoSaid.bad ? 'warn' : undefined}>{undoSaid.text}</Note> : null}

    </View>
  )
}

/**
 * The Colour button in an open block's header, and the colour sheet it opens
 * for that block's family. The loaded preset's own chain goes with it, so the
 * sheet can say when a colour is hard to tell from the block beside it.
 */
function BlockColour({ slug }) {
  const blocks = useRig(ofBlocks)
  const [painting, setPainting] = useState(null)
  return (
    <>
      <Press label="Color" height={40} onPress={() => setPainting(familyTarget(slug))} />
      <ColourSheet target={painting} chain={presetFamilies(blocks)} spelt={presetSpelling(blocks)} onClose={() => setPainting(null)} />
    </>
  )
}

/**
 * Add, remove and move blocks.
 *
 * THE GRID IS NOT DRAWN AS A GRID, deliberately. Forty-eight cells of which
 * five hold anything is three cells visible on a phone and a scroll to find the
 * one you want — the browser had exactly that and the report was blunt: "the
 * rest you can't really add anything or change anything… let's rethink that
 * whole thing." So each row of the grid is a LANE: what is actually in it, in
 * signal order, with the free cells between it shown as gaps you can tap.
 * Nothing is hidden — the column number is on every card and a preset with
 * parallel rows gets a lane each — but nothing is drawn that isn't there.
 *
 * TWO THINGS ABOUT WRITING HERE ARE WORTH KNOWING BEFORE CHANGING ANY OF IT.
 *
 * Placement writes STRUCTURE rather than a value, so a bad write mangles a
 * preset rather than mis-setting a knob. Which is why the column arithmetic is
 * `lib/grid-plan`, shared with the Mac rather than done again here: getting it
 * wrong once already put slot 1 of an AM4 into column 2.
 *
 * And this hardware answers `ok:false` to writes that landed. The browser's old
 * editor took that at its word and rolled back moves that had worked — "delete
 * works, the rest doesn't". So nothing here acts on it: the answer is shown,
 * the chain is re-read from the unit, and you look.
 *
 * Folded away until asked for. It is the least-reached-for thing on the bench
 * and the easiest to press by accident.
 */
/** The rename boxes, opened from More or the preset's name (lib/editMore), with their Close. */
function RenameDoor({ onClose }) {
  /* Not on a VP4, the demo's included, which the app cannot rename on: More says VP4_NO_EDITS instead. */
  if (vp4Bench()) return null
  return (
    <View style={{ gap: space.md }}>
      <RenamePreset />
      <Press label="Close" height={40} onPress={onClose} />
    </View>
  )
}

/** The chain editor, opened from More or the ＋ tile at the end of the chain (lib/editMore); its Close is `onClose`. */
function ChainEditor({ blocks, caps, onError, onScrollLock, onClose }) {
  const open = true
  const setOpen = (on) => {
    if (!on) onClose?.()
  }
  const [palette, setPalette] = useState(null)
  /* Which card's actions are showing, as "row:col". One at a time. */
  const [acting, setActing] = useState(null)
  /* Add: the card whose next free space a picked block goes into. */
  const [addAfter, setAddAfter] = useState(null)
  /* Which block a tapped gap would receive, by its own type code. */
  const [choice, setChoice] = useState(null)
  const [busy, setBusy] = useState(false)
  /* Said beside the control that caused it, never at the top of the screen. */
  const [issue, setIssue] = useState(null)
  const [hunt, setHunt] = useState('')
  /*
   * A block being dragged: which lane, which item, how far the finger has
   * gone, and where that puts it. Measured heights per lane item, because a
   * card and a free space are different heights and a lane can hold both.
   */
  const [drag, setDrag] = useState(null)
  /*
   * A move that has been let go of and is being written: which row, and the
   * block positions it is going between. The lane is drawn in its new order
   * from this until the unit has been asked again — see settledItems.
   */
  const [settling, setSettling] = useState(null)
  const heights = useRef({})
  /* The last chain change, and the one tap that takes it back. */
  const chainUndo = useChainUndo()

  const { linear } = gridShape(caps)
  const lanes = lanesShown(blocks, caps)
  const splitChain = isSplitChain(blocks, caps)

  useEffect(() => {
    if (!open || palette !== null) return undefined
    let stop = false
    ;(async () => {
      try {
        const list = await blockCatalog()
        if (!stop) setPalette(list)
      } catch {
        /* An empty catch left Place disabled with nothing to explain it. */
        if (!stop) setPalette([])
      }
    })()
    return () => {
      stop = true
    }
  }, [open, palette])

  const where = (row, col) =>
    linear ? `slot ${colLabel(col)}` : `row ${rowLabel(row)}, column ${colLabel(col)}`
  /* A run of free cells, said as one: "row 1, columns 2–12". */
  const whereGap = (row, item) => {
    const many = item.last > item.col ? 's' : ''
    return linear ? `slot${many} ${gapCols(item, colLabel)}` : `row ${rowLabel(row)}, column${many} ${gapCols(item, colLabel)}`
  }

  /* A write is done when the unit has been asked AND the chain re-read. */
  const after = async (res) => {
    /*
     * A structure write, then a read of the chain off the unit: "When I
     * rearranged with the slider and moved it up, it didn't take, it just put
     * it right back where it was." The computer keeps a fifteen-second copy
     * of the preset's layout, and every placement and clear drops it itself.
     * This used to send DELETE /device/cache first to drop it again, and that
     * route never touched the copy — it deleted the computer's saved profile
     * of the FM3.
     */
    endChainWrite({ refresh: false })
    await refreshBlocks({ quiet: true })
    setIssue(doubtfulWrite(res))
    if (!doubtfulWrite(res)) setActing(null)
  }

  /* Whether the unit now holds a block at (row, col) — its own answer, off
     the fresh read `after` makes. */
  const holds = (row, col) => (getState().allBlocks || []).some((b) => b.row === row && b.col === col)

  /*
   * Where the unit has a block now, whichever row it is in.
   *
   * A block asked into one row and found in another is the one answer that
   * tells a wrong row number from a write the unit ignored: both leave the
   * cell you asked for empty, and only one of them puts the block somewhere
   * else. So the add and the move say where the unit put it, not just that
   * it is not where it was asked to go.
   */
  const placeOf = (eid) => (getState().allBlocks || []).find((b) => idOf(b) === eid) || null

  const add = async (row, col, page = choice) => {
    if (page === null || page === undefined) return
    chainUndo.clear()
    setBusy(true)
    setIssue(null)
    beginChainWrite()
    try {
      const r = await placeBlock(row, col, Number(page))
      logDebug('chain', `add block ${page} at ${where(row, col)}`, refusedAnswer(r) ? 'refused' : r?.ok === true ? 'ok' : 'no answer')
      await after(r)
      setAddAfter(null)
      logDebug('chain', `${where(row, col)} after the add`, holds(row, col) ? 'holds the block' : 'still empty')
      if (!holds(row, col)) {
        const put = placeOf(Number(page))
        logDebug('chain', `block ${page} after the add`, put ? `unit has it at ${where(put.row, put.col)}` : 'unit has it nowhere')
        setIssue(
          `The unit did not add it: ${where(row, col)} is still empty${refusedAnswer(r) ? ', and the unit answered “refused”' : ''}.${
            put ? ` The unit put it at ${where(put.row, put.col)} instead.` : ''
          }`
        )
      }
    } catch (err) {
      endChainWrite()
      setIssue(err.message)
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Add, from a card: the picked block goes into the first free space after
   * that card in its row. "Change Move to Add, to add a new block."
   */
  const addAfterCard = (lane, col, page) => {
    const free = (lane.gaps || []).filter((c) => c > col).sort((a, b) => a - b)[0]
    if (free === undefined) {
      setIssue(`No free space after ${where(lane.row, col)} in this row.`)
      return
    }
    add(lane.row, free, page)
  }

  /**
   * A drag, landed: the blocks of the lane dealt back into the same columns
   * in their new order. See lib/laneOrder for why the columns stay put.
   *
   * ORDER MATTERS AND THE SAFE ORDER IS NOT OBVIOUS. A block instance exists
   * once — a unit has one Amp — so placing it in a second cell while it still
   * occupies the first may be refused or may do something undefined. Every
   * moving block is cleared first, then every one is placed, so no target is
   * occupied when it is written to. The cost is a moment where they exist
   * nowhere, so they go back if a placement THROWS. Not on `ok:false`: that
   * answer means nothing on this hardware, and undoing a move because of it
   * is the bug this panel was reported for.
   */
  /* Whether the unit sent a rejection frame for a write. Counted and said,
     never acted on: see doubtfulWrite for why that answer undoes nothing. */
  const refusedAnswer = (r) => !!r && r.ok === false

  const reorder = async (lane, fromItem, toItem) => {
    const items = laneItems(lane)
    const pos = blockPositions(items, fromItem, toItem)
    if (!pos) return
    const moves = reorderPlan(
      items.filter((it) => it.kind === 'block').map((it) => ({ col: it.col, block: it.block })),
      pos.from,
      pos.to
    )
    if (!moves.length) return
    chainUndo.clear()
    /* Where the finger left it, held on screen through the writes below. */
    setSettling({ row: lane.row, from: pos.from, to: pos.to })
    setBusy(true)
    setIssue(null)
    beginChainWrite()
    let last = null
    /*
     * EVERY ANSWER IS WRITTEN DOWN. The server only calls a write refused
     * when the unit sends a rejection frame within a tenth of a second; a
     * unit that quietly ignores a command answers exactly like one that took
     * it. So each clear and each placement is logged with what the unit
     * said, and a "refused" anywhere in the six is said on screen too.
     */
    const answers = []
    const said = (r) => (refusedAnswer(r) ? 'refused' : r?.ok === true ? 'ok' : 'no answer')
    try {
      for (const m of moves) {
        const r = await clearCell(lane.row, m.from)
        answers.push(r)
        logDebug('chain', `clear ${m.block.name} from column ${m.from + 1}`, said(r))
      }
      try {
        for (const m of moves) {
          last = await placeBlock(lane.row, m.to, idOf(m.block))
          answers.push(last)
          logDebug('chain', `place ${m.block.name} at column ${m.to + 1}`, said(last))
        }
      } catch (err) {
        for (const m of moves) await placeBlock(lane.row, m.from, idOf(m.block)).catch(() => {})
        throw err
      }
      await after(last)
      /* The unit has been asked again, so the lane is drawn from its answer
         rather than from where the finger left it. Dropped here rather than in
         the `finally` below: by this line the two agree, and holding it any
         longer would deal the move a second time on top of itself. */
      setSettling(null)
      const refused = answers.filter(refusedAnswer).length
      /*
       * And checked, in numbers, against the unit's own answer. A move the
       * unit did not keep used to look exactly like one that was never made:
       * the cards went back and nothing said why. Now each moved block is
       * looked for where it was put, and the ones that are not there are
       * named on screen and in the log.
       */
      const now = getState().allBlocks || []
      const colOf = (m) => now.find((b) => idOf(b) === idOf(m.block) && b.row === lane.row)?.col
      const astray = moves.filter((m) => colOf(m) !== m.to)
      /* Not in this row is not the same as nowhere: a block the unit put in
         another row is named with the row it went to. */
      const elsewhere = (m) => (colOf(m) === undefined ? placeOf(idOf(m.block)) : null)
      const found = (m) => {
        const put = elsewhere(m)
        return put ? `unit has it at ${where(put.row, put.col)}` : `unit has it at ${colOf(m) ?? 'nowhere'}`
      }
      for (const m of moves) {
        logDebug('chain', `${m.block.name}: column ${m.from} → ${m.to}`, astray.includes(m) ? found(m) : 'landed')
      }
      if (astray.length) {
        setIssue(
          `The unit did not keep the move: ${astray
            .map((m) => {
              const put = elsewhere(m)
              if (put) return `${m.block.name} is in ${where(put.row, put.col)}`
              return `${m.block.name} is ${colOf(m) === undefined ? 'not in this row' : `still in column ${colOf(m) + 1}`}`
            })
            .join(', ')}. ${
            refused
              ? `The unit answered “refused” to ${refused} of the ${answers.length} steps.`
              : `The unit answered every step without refusing it. Copy Logs from Setup — it has each answer.`
          }`
        )
      }
    } catch (err) {
      setIssue(err.message)
      onError(err.message)
    } finally {
      /* A throw on the way past the line above leaves it set, and a lane drawn
         for ever in an order the unit never took is worse than one that snaps
         back. The truth wins whenever this ends badly. */
      setSettling(null)
      endChainWrite()
      setBusy(false)
    }
  }

  const remove = async (row, col) => {
    chainUndo.clear()
    setBusy(true)
    setIssue(null)
    /* What it would take to put it back, read while it is still there. */
    const putBack = await readPutBack(row, col, caps, blocks).catch(() => null)
    beginChainWrite()
    try {
      const r = await clearCell(row, col)
      logDebug('chain', `remove block at ${where(row, col)}`, refusedAnswer(r) ? 'refused' : r?.ok === true ? 'ok' : 'no answer')
      await after(r)
      logDebug('chain', `${where(row, col)} after the remove`, holds(row, col) ? 'still holds a block' : 'empty now')
      if (holds(row, col)) {
        setIssue(`The unit did not remove it: ${where(row, col)} still holds a block${refusedAnswer(r) ? ', and the unit answered “refused”' : ''}.`)
      } else if (putBack) {
        chainUndo.offer({ ...putBack, label: `put ${putBack.back.name} back` })
      }
    } catch (err) {
      setIssue(err.message)
      onError(err.message)
    } finally {
      endChainWrite()
      setBusy(false)
    }
  }

  /* The drag itself. The grip in each card reports; this decides. */
  const dragStart = (row, index) => {
    onScrollLock?.(true)
    setDrag({ row, index, dy: 0, to: index })
  }
  const dragMove = (row, index, dy) => {
    const laneHeights = heights.current[row] || []
    const to = landingIndex(laneHeights, index, dy, space.sm)
    setDrag({ row, index, dy, to })
  }
  const dragEnd = (row, index) => {
    onScrollLock?.(false)
    const lane = lanes.find((l) => l.row === row)
    const to = drag?.to ?? index
    setDrag(null)
    if (lane && to !== index) reorder(lane, index, to)
  }

  /*
   * EVERY KIND OF BLOCK, ONE BUTTON EACH.
   *
   * "Is there a way to put all available blocks at the bottom there so that
   * you could quickly just add one of the other available ones… I know
   * there's a lot available, like Drive 1, Drive 2." So one button per kind,
   * and it is the next one the chain has not used: Drive 2 when Drive 1 is
   * already in, and no Drive button once both are. A search still shows every
   * block that matches, numbers and all.
   */
  const needle = hunt.trim().toLowerCase()
  const used = new Set((blocks || []).map((b) => idOf(b)).filter(Number.isInteger))
  const offered = needle
    ? (palette || []).filter((b) => (b.name || '').toLowerCase().includes(needle)).slice(0, 40)
    : nextOfEachKind(palette || [], used)
  const picked = (palette || []).find((b) => b.page === Number(choice))

  const paletteBox = (onPick, hint) => (
    <View style={{ gap: space.sm }}>
      {palette === null ? (
        <Note>Asking your unit what it can add…</Note>
      ) : !palette.length ? (
        <Note tone="warn">Couldn’t read the list of blocks from your unit.</Note>
      ) : (
        <>
          <TextInput
            value={hunt}
            onChangeText={setHunt}
            placeholder="Find a block"
            placeholderTextColor={color.silkFaint}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Find a block to add"
            style={{
              minHeight: TAP,
              paddingHorizontal: space.md,
              borderWidth: 1,
              /* A frosted glass field (lib/glass): rounded like a card, rimmed, no shadow. */
              ...glassField(),
              color: color.silk,
              fontSize: font.body
            }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {offered.map((b) => (
              <Press
                key={b.page}
                label={b.name}
                tone="signal"
                on={b.page === Number(choice)}
                height={44}
                disabled={busy}
                style={{ paddingHorizontal: space.md }}
                onPress={() => onPick(b)}
              />
            ))}
          </View>
          <Text style={{ color: color.silkDim, fontSize: font.micro }}>{hint}</Text>
        </>
      )}
    </View>
  )

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <Label>The chain</Label>
        <Press label="Close" height={40} onPress={() => setOpen(false)} />
      </View>

      {issue ? <Note tone="warn">{issue}</Note> : null}

      {/*
        A SPLIT CHAIN, SAID OUT LOUD.

        The app knows where every block sits. It does not know how the rows are
        JOINED — there is no read for the cables anywhere, only a write — so on
        a preset that runs down two rows it can describe half of what is there
        and has no way to tell a deliberate split from two unrelated rows.

        Drawing that silently is the problem. Two lanes with no comment reads
        either as one chain that happens to wrap, or as an editor that
        understands the routing and is showing it to you. Neither is true, and
        the second is the one that gets a preset rebuilt. Moving blocks WITHIN a
        row is safe and stays available — cells and cables are different writes,
        and shuffling a row cannot disturb what joins it to another.
      */}
      {/*
        EVERY ROW AND EVERY JOIN. "We can only edit blocks in a single row,
        even though the Forge effects I believe has capabilities just like
        the FM3 edit software does where you can do split chains." It did —
        this drew a note saying it could not. See components/RowsPanel.
      */}
      {linear ? null : <RowsPanel blocks={blocks} caps={caps} palette={palette} onError={onError} />}
      {/* The block somebody wants in every preset, in one tap and in the right place. */}
      {linear ? null : (
        <LooperAtEnd
          blocks={blocks}
          caps={caps}
          palette={palette}
          busy={busy || chainUndo.running}
          onError={onError}
          onAdded={(plan) => chainUndo.offer(plan.undo ? { kind: 'out', name: 'the looper', label: 'take the looper out', row: plan.row, col: plan.col, steps: plan.undo } : null)}
        />
      )}
      {/* Undo for the last chain change: a block taken out, a looper put in. */}
      {chainUndo.bar}
      {splitChain ? (
        <Note>This preset uses more than one row. Each row’s blocks are listed below; the joins between them are in Rows and splits above.</Note>
      ) : null}

      <Text style={{ color: color.silkFaint, fontSize: font.micro }}>
        Hold ≡ and drag to move a block. Swipe left to remove it, or tap it for Add and Remove.
      </Text>

      {lanes.map((lane) => {
        /* While a move is being written the lane is drawn where the finger
           left it, not where the unit last said it was. */
        const resting = laneItems(lane)
        const items =
          settling && settling.row === lane.row ? settledItems(resting, settling.from, settling.to) : resting
        const dragging = drag && drag.row === lane.row ? drag : null
        const lift = dragging ? (heights.current[lane.row] || [])[dragging.index] || 0 : 0
        return (
          <View key={lane.row} style={{ gap: space.sm }}>
            {linear ? null : <Label>{`Row ${rowLabel(lane.row)}`}</Label>}
            {items.map((item, index) => {
              /* Where this item is drawn while a drag is on: the dragged one
                 follows the finger; the ones it has passed step out of its
                 way by its own height. */
              let shift = 0
              if (dragging) {
                if (index === dragging.index) shift = dragging.dy
                else if (dragging.to > dragging.index && index > dragging.index && index <= dragging.to)
                  shift = -(lift + space.sm)
                else if (dragging.to < dragging.index && index >= dragging.to && index < dragging.index)
                  shift = lift + space.sm
              }
              return (
                <View
                  key={item.kind === 'block' ? `b${item.col}` : item.kind === 'held' ? `h${item.col}` : `g${item.col}`}
                  onLayout={(e) => {
                    const h = heights.current[lane.row] || (heights.current[lane.row] = [])
                    h[index] = e.nativeEvent.layout.height
                  }}
                  style={{
                    transform: [{ translateY: shift }],
                    zIndex: dragging && index === dragging.index ? 2 : 0,
                    opacity: dragging && index === dragging.index ? 0.92 : 1
                  }}
                >
                  {item.kind === 'block' ? (
                    /*
                     * SWIPE LEFT TO TAKE IT OUT. "Let's add swipe to delete on
                     * the chain instead of having to tap on it and hit remove…
                     * maybe with a confirmation X." The setlist's swipe, with
                     * one difference: a block's settings go with it, so a full
                     * swipe and the ✕ both ask first (SwipeAway's `ask`). The
                     * ends of the chain cannot be taken out, and do not slide.
                     */
                    <Swipeable
                      on={!['input', 'output'].includes(item.block?.slug) && !dragging}
                      label={`Remove ${item.block?.name || 'this block'}`}
                      onRemove={() => remove(lane.row, item.col)}
                      ask={(go, keep) => confirmRemove(item.block?.name, go, keep)}
                    >
                    <BlockCard
                      block={item.block}
                      at={where(lane.row, item.col)}
                      busy={busy}
                      acting={acting === `${lane.row}:${item.col}`}
                      lifted={!!dragging && index === dragging.index}
                      onToggleActions={() => {
                        setActing(acting === `${lane.row}:${item.col}` ? null : `${lane.row}:${item.col}`)
                        setAddAfter(null)
                      }}
                      onAdd={() => setAddAfter(addAfter === `${lane.row}:${item.col}` ? null : `${lane.row}:${item.col}`)}
                      onRemove={() => confirmRemove(item.block?.name, () => remove(lane.row, item.col))}
                      onDragStart={() => dragStart(lane.row, index)}
                      onDragMove={(dy) => dragMove(lane.row, index, dy)}
                      onDragEnd={() => dragEnd(lane.row, index)}
                      adding={
                        addAfter === `${lane.row}:${item.col}`
                          ? paletteBox(
                              (b) => addAfterCard(lane, item.col, b.page),
                              `Tap a block to put it right after ${item.block.name}.`
                            )
                          : null
                      }
                    />
                    </Swipeable>
                  ) : item.kind === 'held' ? (
                    /*
                     * A block newer than the app (lib/new-block): where it is,
                     * in words, and nothing to press. Its cell is not a gap,
                     * so nothing is put on it, and a drag deals the other
                     * blocks round it.
                     */
                    <View style={{ gap: space.xs }}>
                      <Press caption={where(lane.row, item.col)} label={NEW_BLOCK_NAME} disabled height={48} onPress={() => {}} />
                      <Text style={{ color: color.silkDim, fontSize: font.micro }}>{NEW_BLOCK_NOTE}</Text>
                    </View>
                  ) : (
                    <Press
                      caption={whereGap(lane.row, item)}
                      label={picked ? `Put ${picked.name} here` : 'Empty'}
                      disabled={busy || !picked}
                      height={48}
                      onPress={() => add(lane.row, item.col)}
                    />
                  )}
                </View>
              )
            })}
          </View>
        )
      })}

      {/* ---------------------------------------------------- what to place */}
      <View style={{ gap: space.sm }}>
        <Label>Put a block in an empty space</Label>
        {paletteBox(
          (b) => setChoice(b.page === Number(choice) ? null : b.page),
          picked ? `Now tap an empty space to put ${picked.name} in it.` : 'Pick a block, then tap an empty space.'
        )}
      </View>
    </View>
  )
}

/**
 * One block in a lane: its name, a grip to drag it by, and Add and Remove
 * folded under it on a tap.
 *
 * "Remove the words What can I do with this from each of the block's name."
 * The card says what it is and no more; the line under the lane says how the
 * cards work, once.
 */
function BlockCard({
  block,
  at,
  busy,
  acting,
  lifted,
  adding,
  onToggleActions,
  onAdd,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd
}) {
  const hue = blockColor(block.slug)
  return (
    /*
     * On the ground of the page, opaque: the red ✕ of SwipeAway sits behind the
     * whole card, and the frosted glass of what folds out under it (the
     * finder, the blocks to add, a note) would let it through. In Classic
     * those are opaque, and the card has no ground of its own, as before.
     */
    <View style={{ gap: space.sm, backgroundColor: classic() ? undefined : color.chassis }}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: space.sm }}>
        <Press
          grow
          caption={at}
          label={block.name}
          on={lifted}
          tone="signal"
          bar="solid"
          style={{ borderLeftWidth: 4, borderLeftColor: hue.fill }}
          onPress={onToggleActions}
        />
        <Grip label={`Drag ${block.name}`} disabled={busy} onStart={onDragStart} onMove={onDragMove} onEnd={onDragEnd} />
      </View>
      {acting ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {/* Green to add, red to take away: "color these red green maybe?" */}
          <Press
            grow
            label="Add"
            sub="A new block after this one"
            height={48}
            disabled={busy}
            onPress={onAdd}
            style={{ borderColor: color.ok, backgroundColor: tint(color.ok, 0.16) }}
          />
          <Press
            grow
            label="Remove"
            sub="Delete this block"
            height={48}
            disabled={busy}
            onPress={onRemove}
            style={{ borderColor: color.fault, backgroundColor: tint(color.fault, 0.16) }}
          />
        </View>
      ) : null}
      {acting && adding ? adding : null}
    </View>
  )
}


/**
 * Modifiers — what makes a preset respond instead of sit still.
 *
 * A modifier attaches a source to a control: an envelope follower on drive so
 * it cleans up when you back off, an LFO on a filter, an expression pedal on
 * delay mix. Everything else this app writes is a static value; this is the
 * part that reacts to playing.
 *
 * NOT EVERY UNIT CAN BE TOLD TO DO THIS. An AM4 serves the modifier list and
 * reports the wire binding unsupported — the data is there, the binding is not.
 * So this reads the flag and says so in a sentence rather than drawing an
 * Attach button that cannot attach. It is the specific mistake the browser made
 * twice: once by guarding on a field the host has never served, and once by
 * returning nothing at all, which left a heading over blank space and read as
 * "broken" to everyone who opened it.
 *
 * Folded away until asked for. Four pickers and a button is most of a phone
 * screen, and this is the least-reached-for thing on the bench.
 */
/** Modifiers, opened from More, or from a knob held still with that block and control already picked (`start`, lib/editMore); its Close is `onClose`. */
function Modifiers({ blocks, onError, onClose, start = null }) {
  const open = true
  const setOpen = (on) => {
    if (!on) onClose?.()
  }
  const [model, setModel] = useState(undefined)
  const [slot, setSlot] = useState(1)
  const [eid, setEid] = useState(start?.eid ?? null)
  const [paramId, setParamId] = useState(start?.paramId ?? null)
  const [source, setSource] = useState(null)
  const [params, setParams] = useState([])
  const [loading, setLoading] = useState(false)
  const [said, setSaid] = useState(null)

  /* Read on opening, not on mount: a fold nobody opens should cost nothing. */
  useEffect(() => {
    if (!open || model !== undefined) return undefined
    let stop = false
    ;(async () => {
      try {
        const m = await modifierModel()
        if (!stop) setModel(m?.error ? null : m)
      } catch {
        if (!stop) setModel(null)
      }
    })()
    return () => {
      stop = true
    }
  }, [open, model])

  useEffect(() => {
    if (eid === null) {
      setParams([])
      return undefined
    }
    let stop = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await blockParams(eid)
        if (!stop) setParams(asOnPages(res))
      } catch (err) {
        if (!stop) onError(err.message)
      } finally {
        if (!stop) setLoading(false)
      }
    })()
    return () => {
      stop = true
    }
  }, [eid, onError])

  const ready = eid !== null && paramId !== null && source !== null

  /*
   * What is still to pick, said beside the button rather than left to a
   * disabled button that says nothing.
   */
  const missing = [
    eid === null && 'a block',
    paramId === null && 'a control',
    source === null && 'a source'
  ].filter(Boolean)
  const why =
    missing.length === 0
      ? null
      : missing.length === 1
        ? `Pick ${missing[0]} to attach.`
        : `Pick ${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]} to attach.`

  const attach = async () => {
    try {
      await bindModifier(Number(slot), Number(eid), Number(paramId), Number(source))
      noteEdited()
      const b = blocks.find((x) => sameBlock(x, Number(eid)))
      const p = params.find((x) => x.id === Number(paramId))
      const src = model.sources?.find((x) => x.ordinal === Number(source))
      setSaid(`${src?.name} now moves ${b?.name} ${p?.name}.`)
    } catch (err) {
      onError(err.message)
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <Label>Modifiers</Label>
        <Press label="Close" height={40} onPress={() => setOpen(false)} />
      </View>

      {model === undefined ? (
        <Note>Asking your unit what it can attach…</Note>
      ) : !model ? (
        <Note tone="warn">Couldn’t read the list of things to attach from your unit.</Note>
      ) : model.bindingSupported === false ? (
        <Note>
          This unit doesn’t let an app attach a modifier. Set one up on the unit itself.
        </Note>
      ) : (
        <>
          <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 20 }}>
            Attach a source to a control so it moves while you play — your picking on a drive, a
            pedal on delay mix.
          </Text>
          {/* What each slot is attached to now, before attaching another. */}
          <ModAttached model={model} blocks={blocks} />

          <Pick
            title="Slot"
            options={Array.from({ length: model.slotCount || 4 }, (_, i) => ({
              key: i + 1,
              label: String(i + 1)
            }))}
            chosen={slot}
            onPick={setSlot}
          />

          <Pick
            title="Block"
            options={blocks.map((b) => ({ key: idOf(b), label: b.name }))}
            chosen={eid}
            onPick={(k) => {
              setEid(k)
              setParamId(null)
            }}
          />

          <Pick
            title={loading ? 'Control — reading…' : 'Control'}
            options={params.map((p) => ({ key: p.id, label: p.name }))}
            chosen={paramId}
            onPick={setParamId}
            empty={eid === null ? 'Pick a block first.' : loading ? null : 'Nothing to attach to here.'}
          />

          <Pick
            title="Source"
            /* `ordinal`, not `value`. A source has never carried a `value`, and
               reading one gave the device a NaN where an ordinal belonged. */
            options={(model.sources || []).map((x) => ({ key: x.ordinal, label: x.name }))}
            chosen={source}
            onPick={setSource}
            empty={model.sourcesNote || 'This unit didn’t list any sources.'}
          />

          <Press label="Attach" tone="signal" on={ready} disabled={!ready} onPress={attach} />
          {why ? (
            <Text accessibilityLiveRegion="polite" style={{ color: color.silkDim, fontSize: font.small }}>
              {why}
            </Text>
          ) : null}
          {said ? <Note>{said}</Note> : null}
        </>
      )}
    </View>
  )
}

/**
 * One row of choices.
 *
 * A wrapped row of buttons rather than a dropdown: a phone's native picker is a
 * modal that covers the four other things you are in the middle of choosing,
 * and the whole point of this panel is that you can see all four at once.
 */
function Pick({ title, options, chosen, onPick, empty }) {
  return (
    <View style={{ gap: space.sm }}>
      <Label>{title}</Label>
      {options.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {options.map((o) => (
            <Press
              key={o.key}
              label={o.label}
              tone="signal"
              on={o.key === chosen}
              height={44}
              style={{ paddingHorizontal: space.md }}
              onPress={() => onPick(o.key)}
            />
          ))}
        </View>
      ) : empty ? (
        <Text style={{ color: color.silkDim, fontSize: font.small }}>{empty}</Text>
      ) : null}
    </View>
  )
}

/**
 * Runs `run` once the keyboard is out of the way: when it has gone (or after
 * a moment, if the device never says so), and with none up, a few frames
 * on, so a block whose panel did move has been laid out first and brought
 * the page itself. Answers a way to call it off. For a scroll the keyboard's
 * own leaving would otherwise be fighting.
 */
function afterKeyboard(run) {
  let done = false
  let gone = null
  const go = () => {
    if (done) return
    done = true
    gone?.remove()
    clearTimeout(wait)
    run()
  }
  const up = Keyboard.isVisible()
  if (up) gone = Keyboard.addListener('keyboardDidHide', go)
  const wait = setTimeout(go, up ? 600 : 80)
  return () => {
    done = true
    gone?.remove()
    clearTimeout(wait)
  }
}

/**
 * Find a control by name, across every block at once.
 *
 * "Where does the presence live" has one good answer per preset and this is it.
 * Typing three letters beats opening four blocks in turn to look — and on a
 * phone each of those is a round trip to the Mac, so it beats it by more.
 *
 * THE LIST IS NOT BUILT UNTIL SOMEBODY ASKS FOR IT. Building it means reading
 * every block's controls, one at a time, and each of those is a slow read that
 * can make the unit dump its preset over serial. A find box nobody touches must
 * not cost that, so nothing happens until two letters are typed.
 *
 * AND IT SAYS WHAT IT IS DOING WHILE IT DOES IT. Seven of those reads on a
 * relay is several seconds, and a search box that sits there for several
 * seconds with no explanation is a search box that looks broken. It counts them
 * off instead.
 *
 * Results navigate rather than edit. Tapping one opens that block with the
 * control marked, so there stays exactly one place in this app where a value
 * changes, with its verified write behind it. And the tap is the end of the
 * search: the keyboard goes, the results go with it, and the page is left to
 * the block that opened — with the results still up and the keyboard still
 * over the bottom half, the block opened somewhere nobody could see.
 */
function FindControl({ blocks, onPick, onError, onLaid = null, onSeek = null, autoFocus = false }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(() => indexFor(blocks))
  const [progress, setProgress] = useState(null)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const needle = query.trim()
  const hits = findControls(index, needle)

  const change = async (text) => {
    setQuery(text)
    if (text.trim().length < 2 || index) return
    const ready = indexFor(blocks)
    if (ready) {
      setIndex(ready)
      return
    }
    try {
      const built = await buildParamIndex(blocks, (done, total) => {
        if (alive.current) setProgress({ done, total })
      })
      if (alive.current) setIndex(built)
    } catch (err) {
      if (alive.current) onError(err.message)
    } finally {
      if (alive.current) setProgress(null)
    }
  }

  const reading = progress && progress.done < progress.total

  /*
   * AT THE FOOT OF THE PAGE, WHERE THE KEYBOARD OPENS (Edit, above). While
   * the box is typed in, the page is asked to bring it to the top of the
   * room left (`onSeek`): once the keyboard is up, since only then is that
   * room known, and again whenever what is drawn under the box changes (the
   * reading line, the results, the line that says there are none), a frame
   * later so the page has their height. Not for the tap into an empty box
   * alone: the keyboard's arrival moves the page once, and with a keyboard
   * that is not on the glass (an iPad's own) nothing covers the box until
   * there is something under it. `onLaid` says where the box is.
   */
  const [typing, setTyping] = useState(false)
  const seek = useRef(onSeek)
  seek.current = onSeek
  const under = reading ? -2 : needle.length >= 2 && index ? hits.length : -1
  useEffect(() => {
    if (!typing) return undefined
    const up = Keyboard.addListener('keyboardDidShow', () => seek.current?.())
    return () => up.remove()
  }, [typing])
  useEffect(() => {
    if (!typing || under === -1) return undefined
    const frame = requestAnimationFrame(() => seek.current?.())
    return () => cancelAnimationFrame(frame)
  }, [typing, under])

  const pick = (eid, paramId) => {
    Keyboard.dismiss()
    setQuery('')
    onPick(eid, paramId)
  }

  return (
    <View style={{ gap: space.sm }} onLayout={(e) => onLaid?.(e.nativeEvent.layout.y)}>
      <TextInput
        value={query}
        autoFocus={autoFocus}
        onChangeText={change}
        onFocus={() => setTyping(true)}
        onBlur={() => setTyping(false)}
        placeholder="Find a control — gain, mix, presence…"
        placeholderTextColor={color.silkFaint}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Find a control by name"
        style={{
          minHeight: TAP,
          paddingHorizontal: space.md,
          borderWidth: 1,
          /* A frosted glass field (lib/glass): rounded like a card, rimmed, no shadow. */
          ...glassField(),
          color: color.silk,
          fontSize: font.body
        }}
      />

      {reading ? (
        <Text style={{ color: color.silkDim, fontSize: font.micro, fontFamily: face }}>
          {`Reading block ${progress.done + 1} of ${progress.total}…`}
        </Text>
      ) : null}

      {needle.length >= 2 && index ? (
        hits.length ? (
          <View style={{ gap: space.sm }}>
            {hits.map(({ block, param }) => (
              <Press
                key={`${idOf(block)}-${param.id}`}
                caption={block.name}
                label={param.name}
                sub={withUnit(fmt(param.value), param.unit)}
                onPress={() => pick(idOf(block), param.id)}
              />
            ))}
          </View>
        ) : (
          <Note>{`No control called “${needle}” in this preset.`}</Note>
        )
      ) : null}
    </View>
  )
}

/**
 * A round button with a picture and no word, beside Done: Find a control
 * and More (lib/editMore). The glass of the top bar's round buttons, its rim
 * in the app's amber while what it opens is open. Named for VoiceOver and
 * TalkBack by `label`.
 */
function RoundButton({ icon, label, on = false, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: on }}
      hitSlop={4}
      onPress={() => {
        thud()
        onPress()
      }}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: on ? color.signal : color.glassRim,
        backgroundColor: pressed ? color.glassFillHi : color.glassFill
      })}
    >
      <Image source={icon} style={{ width: 18, height: 18, tintColor: color.silk }} />
    </Pressable>
  )
}

/** The i beside a model: Amp & pedal names, open on that model (lib/editMore gearStart). */
function ModelInfo({ onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="What this model really is"
      hitSlop={6}
      onPress={() => {
        thud()
        onPress()
      }}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: color.glassRim,
        backgroundColor: pressed ? color.glassFillHi : color.glassFill
      })}
    >
      <Text style={{ color: color.signal, fontSize: font.lead, fontWeight: '800', fontStyle: 'italic', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}>i</Text>
    </Pressable>
  )
}

/** What a model is modelled on, in a sentence, or nothing when nobody recorded it. */
function gearLine(model) {
  if (!model) return null
  if (model.basedOn) return `Based on ${model.basedOn}`
  /*
   * Two verbs, because one sentence will not carry both. "Based on Mesa" is not
   * English — "based on" wants a thing, and an article does not save it.
   * "Modelled on Mesa" reads correctly for every maker in the catalog.
   */
  if (model.manufacturer) return `Modeled on ${model.manufacturer}`
  return null
}

/**
 * The number under a knob, and a way to just type it.
 *
 * A knob is right for sweeping; a thumb is wrong for landing on exactly 4.00.
 * Tap the number and type one — it commits through the same verified write the
 * knob uses, clamped to the control's own range, which is the rule the unit
 * applies to every write anyway.
 */
function ValueBox({ param, value, onCommit }) {
  /* What is typed and how much of it is selected: lib/value-field. Null until the box is tapped. */
  const [field, setField] = useState(null)
  const input = useRef(null)

  const finish = () => {
    if (!field) return
    const n = fieldNumber(field)
    setField(null)
    if (n === null || n === value) return
    const lo = typeof param.min === 'number' ? param.min : -Infinity
    const hi = typeof param.max === 'number' ? param.max : Infinity
    onCommit(Math.min(hi, Math.max(lo, n)))
  }

  /*
   * THE WHOLE NUMBER SELECTED AS THE BOX OPENS, so "-3" typed straight in
   * replaces it. The `selection` below goes down with the swapped text; this
   * says it once more by hand, for the number whose text did not change as
   * the box opened (nothing is sent for a text that is the same).
   */
  const opened = field ? field.at : null
  useEffect(() => {
    if (opened === null) return
    const at = fieldSelection(field)
    if (at) input.current?.setSelection?.(at.start, at.end)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  return (
    <TextInput
      ref={input}
      value={field ? field.typed : `${fmt(value)}${param?.unit ? ` ${param.unit}` : ''}`}
      onFocus={() =>
        /* The unit drops out, so typing replaces rather than appends to "6.70 dB". */
        setField(openField(value, Date.now()))
      }
      /* The whole number while it is held: a thumb's tap on an iPhone selects nothing by itself. */
      selection={fieldSelection(field)}
      onSelectionChange={(e) => {
        const at = e?.nativeEvent?.selection
        setField((f) => fieldSelectionMoved(f, at, Date.now()))
      }}
      onChangeText={(t) => setField((f) => fieldTyped(f, t))}
      onBlur={finish}
      onSubmitEditing={finish}
      selectTextOnFocus
      keyboardType="numbers-and-punctuation"
      returnKeyType="done"
      accessibilityLabel={`${param?.label || param?.name} value`}
      style={{
        width: '100%',
        minHeight: 32,
        textAlign: 'center',
        /* Frosted glass (lib/glass), at the small corner it fits under a knob with, and no shadow. */
        borderRadius: classic() ? radius.sm : radius.md,
        borderWidth: 1,
        borderColor: color.glassRim,
        backgroundColor: color.glassFill,
        color: color.silk,
        fontSize: font.micro,
        fontFamily: face,
        paddingHorizontal: 2,
        paddingVertical: 2
      }}
    />
  )
}

/** A small heading over a group of controls. */
function Label({ children }) {
  return (
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
}

/*
 * ASKED FIRST, because there is no taking it back.
 *
 * "How can I undo? Accidentally removed a block, can't get it back." A block
 * taken out loses its settings with it, and the unit has no undo to offer, so
 * the one safe place to stop a slip is before it happens. Re-adding it gives
 * the same block with every knob back at its default.
 */
/* Knob help per kind of block, kept while the app is open. */
const KNOB_HELP = new Map()

/* THE TIDIER EDIT'S ONE ROW FOR THE OPEN BLOCK (lib/tidyEdit): the name takes what the rest leaves, and the rest keep their own widths. */
const TIDY_HEAD = { flexDirection: 'row', alignItems: 'center', gap: space.sm }
const TIDY_NAME = { flex: 1, minWidth: 0, borderLeftWidth: 4, paddingLeft: space.sm, minHeight: HEAD_TALL, justifyContent: 'center' }
/* The channels, close together so they read as one control. */
const TIDY_CHANNELS = { flexDirection: 'row', gap: space.xs }
/* A channel's letter, or On / Off: as wide as a thumb with little round the word. */
const TIDY_CHIP = { minWidth: 38, paddingHorizontal: space.sm, paddingVertical: 2 }
/* The model's name: its own width, up to a share of the row, so a long one is cut before it takes the block's name off the row. */
const TIDY_MODEL = { maxWidth: '38%', paddingHorizontal: space.md, paddingVertical: 2 }

/**
 * COPY THIS CHANNEL ONTO ANOTHER — the browser's ChannelCopy, on the phone.
 * The model and every knob and switch go across (lib/copy-tools, the same
 * copy the browser runs), and the block is left on the channel copied to, so
 * the scene plays the copy. Asked first: the other channel's settings go.
 */
function ChannelCopy({ eid, block, channels, disabled, onDone, onError }) {
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [said, setSaid] = useState(null)
  const from = block.channel
  const run = async (to) => {
    setWorking(true)
    setSaid(null)
    try {
      const res = await copyChannel({
        eid,
        from,
        to,
        /* A channel switch that did not go stops the copy (rig orStop), rather than reading the wrong channel, copying it onto itself and saying this scene is on the new one. */
        wire: { setChannel: orStop(writeChannel), readBlock: blockParams, setType, setParam, setEnum }
      })
      setSaid(
        res.ok
          ? { bad: false, text: `Channel ${from} copied onto ${to} — ${res.changed} change${res.changed === 1 ? '' : 's'}. This scene is on ${to} now.` }
          : { bad: true, text: `Copying stopped: ${res.error}` }
      )
      onDone?.()
    } catch (err) {
      onError?.(err?.message || String(err))
    } finally {
      setWorking(false)
      setOpen(false)
    }
  }
  const ask = (to) =>
    Alert.alert(
      `Copy channel ${from} onto ${to}?`,
      `${to}’s model and settings are replaced, and this scene switches to ${to}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Copy onto ${to}`, onPress: () => run(to) }
      ]
    )
  return (
    <View style={{ gap: space.sm }}>
      {open ? (
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Text style={{ color: color.silkDim, fontSize: font.small }}>Copy {from} onto</Text>
          {channels
            .filter((c) => c !== from)
            .map((c) => (
              <Press key={c} label={c} height={44} disabled={disabled || working} onPress={() => ask(c)} />
            ))}
          <Press label="Cancel" height={44} onPress={() => setOpen(false)} />
        </View>
      ) : (
        <Press
          label={working ? 'Copying…' : `Copy channel ${from} to…`}
          height={44}
          disabled={disabled || working}
          onPress={() => setOpen(true)}
        />
      )}
      {said ? <Note tone={said.bad ? 'warn' : undefined}>{said.text}</Note> : null}
    </View>
  )
}

function confirmRemove(name, go, keep) {
  Alert.alert(
    `Remove ${name || 'this block'}?`,
    'Its settings go with it. Adding it again brings it back with every knob at its default.',
    [
      { text: 'Cancel', style: 'cancel', onPress: keep },
      { text: 'Remove', style: 'destructive', onPress: go }
    ],
    /* Dismissed by tapping outside it, on Android: the row goes back too. */
    { onDismiss: keep }
  )
}

/** SwipeAway where a row can be taken out, the row as it is where it cannot. */
function Swipeable({ on, children, ...rest }) {
  return on ? <SwipeAway {...rest}>{children}</SwipeAway> : children
}

/** The first block of each kind the chain has not used, in the unit's order. */
function nextOfEachKind(palette, used) {
  const seen = new Set()
  const out = []
  for (const b of palette) {
    const kind = b.family || b.slug || b.name
    if (seen.has(kind) || used.has(b.page)) continue
    seen.add(kind)
    out.push(b)
  }
  return out
}
