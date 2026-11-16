/**
 * BLUETOOTH (BETA): THE UNIT, ANSWERED BY THE PHONE ITSELF.
 *
 * Over the relay, every request the app makes — GET /preset, POST /scene —
 * goes to the computer, and ForgeFX there turns it into MIDI. With Bluetooth
 * on there is no computer, so this file does ForgeFX's part: it takes the
 * same requests at the same door (device.js's remoteRequest, the seam the demo
 * already uses), turns each into the frames in fractal-sysex.mjs, sends them
 * through the adapter, and answers in the shapes the screens already know.
 *
 * Nothing above device.js can tell which of the three it is talking to, which
 * is the property worth having: the Play screen is the same Play screen.
 *
 * HANDED ITS TRANSPORT RATHER THAN FETCHING IT, for the reason demoWire is
 * handed the mock: the native module and React Native do not exist in the
 * test runner, and the request-to-bytes mapping is the whole risk. `send` is
 * the adapter, `catalog` the block names, `clock` the timers. So Node can
 * drive this against a pretend FM3 and a pretend AM4, byte by byte.
 *
 * WHAT NOBODY HERE CAN DO is try it on every unit: so far only an AM4 has
 * been on the other end. (This file was written for a test build that took
 * no updates over the air; in the store builds it is JavaScript like the
 * rest and takes them, but a fix still needs somebody with the unit to find
 * it.) So where the FM3 is known to ignore a published command, both ways
 * are in here, the "auto" setting tries one and checks, and whichever worked
 * is remembered on the phone (`remember`). The check panel can force either.
 */
import { SAVE_NOT_OPEN, buildSave, saveAllowed, saveElsewhere, saveShaped } from './bleSave.js'
import {
  AM4,
  AM4_BLOCKS,
  FN,
  MODELS,
  am4Allowed,
  am4Block,
  am4CcOk,
  am4ChannelSaid,
  am4DumpPart,
  am4LocationCode,
  am4Note,
  am4ShortAllowed,
  am4TunerCcNamed,
  buildAm4AmpBoost,
  buildAm4Bypass,
  buildAm4BypassRead,
  buildAm4Channel,
  buildAm4ChannelRead,
  buildAm4MidiChannelRead,
  buildAm4Preset,
  buildAm4Scene,
  buildAm4StoredDump,
  buildAm4StoredName,
  buildAm4Structure,
  buildAm4Tempo,
  buildAm4TempoRead,
  buildAm4TunerCc,
  buildAm4TunerCcRead,
  buildAm4TunerPoll,
  buildGetPreset,
  buildGetPresetName,
  buildGetScene,
  buildGetSceneName,
  buildGetTempo,
  buildProgramChange,
  buildSetBypass,
  buildSetChannel,
  buildSetChannelEdit,
  buildSetScene,
  buildSetSceneEdit,
  buildSetTempo,
  buildSetTempoEdit,
  buildStatusDump,
  buildSwitchPreset,
  buildTap,
  buildTuner,
  buildTunerPage,
  buildTunerPoll,
  channelIndex,
  channelLetter,
  hzToNote,
  isBeatPush,
  isFractal,
  parseAm4Bypass,
  parseAm4Channel,
  parseAm4DumpSceneNames,
  parseAm4GlobalLong,
  parseAm4StoredName,
  parseAm4Structure,
  parseAm4Tempo,
  parseAm4TunerPoll,
  parsePresetName,
  parseRejected,
  parseScene,
  parseSceneName,
  parseStatusDump,
  parseTempo,
  parseTunerPoll,
  parseTunerPush,
  rejectedWords,
  sameBytes,
  toHex
} from './fractal-sysex.mjs'
import { outlineChain } from './chain-outline.js'
import { am4EditAllowed, blockParamsOf, buildAm4ReadAll, editBlock, knobFrame, modelFrame, modelsOf, readAllCollector, readsOf } from './am4-edit.js'
import * as fm3Edit from './fm3-edit.js'
import * as fm9Edit from './fm9-edit.js'
import * as axefx3Edit from './axefx3-edit.js'
import { ANSWER_MS, describeAllowed, describeBlock, describeEcho } from './gen3-describe.js'
import {
  NAM_BLOCKS,
  NAM_HEADS_MOST,
  NAM_RECORD_WORDS,
  NAM_SLOTS,
  NAM_SLOT_PROVEN_MOST,
  namAllowed,
  namAnswer,
  namBusyAnswer,
  namBusyFrame,
  namPickFrame,
  namShaped,
  namSlotQuery,
  namSlotSaid,
  namUploadFrames,
  readNamPick,
  readNamSlot
} from './nam-install.js'
import { presetMissLine } from './bluetooth-gear.js'
import { PRESET_SETTLE_MS } from './own-echo.js'
import { NOT_BLOCKS } from './gen3Catalog.js'
import {
  GRID_SUB,
  SHUNT_FROM,
  buildGridCable,
  buildGridDump,
  buildGridPut,
  buildGridRead,
  buildGridSelect,
  cableKnown,
  cellOnGrid,
  gridAllowed,
  gridDumpPart,
  gridFromLive,
  gridHand,
  gridProof,
  gridShaped,
  gridSize,
  noProof,
  parseGridDump,
  parseGridLive
} from './gen3-grid.js'
import { AM4_PALETTE, AM4_SLOTS, am4SlotAllowed, buildAm4Slot } from './am4-chain.js'
import { createVp4Wire } from './bleVp4.js'

/* ------------------------------------------------------------------ */
/* The units, and how long each question is given                      */
/* ------------------------------------------------------------------ */

/**
 * The units the Bluetooth page offers, in the order it offers them. The VP4
 * last, since 25 October 2026 ("I'm curious why the VP4 is not listed?"):
 * presets and scenes only, by plain MIDI, and its own wire (bleVp4.js).
 */
export const BLE_UNITS = [
  { key: 'am4', name: 'AM4' },
  { key: 'fm3', name: 'FM3' },
  { key: 'fm9', name: 'FM9' },
  { key: 'axefx3', name: 'Axe-Fx III' },
  { key: 'vp4', name: 'VP4' }
]

/*
 * `maxPreset` is the last slot the unit holds; a III Mark II has 1024. Every
 * Gen 3 unit takes Program Change's bank in CC0 (see buildProgramChange): the
 * III's own manual says so, in its table of "MIDI Bank Select (CC#0) Value,
 * Midi Program Change = Axe-Fx III Preset Number".
 */
const SPEC = {
  fm3: { name: 'FM3', short: 'FM3', maxPreset: 511 },
  fm9: { name: 'FM9', short: 'FM9', maxPreset: 511 },
  axefx3: { name: 'Axe-Fx III', short: 'Axe-Fx III', maxPreset: 1023 },
  am4: { name: 'AM4', short: 'AM4', maxPreset: AM4.LOCATIONS - 1 }
}

/*
 * Every unit a Fractal message can come from, by its model byte, said with
 * its article for the log. The page is told the bare name (`modelName`), and
 * says the article itself (shared/bluetooth-gear withArticle, held to these
 * by a test), so "An an FM9" can never be written.
 */
export const MODEL_NAMES = { 0x10: 'an Axe-Fx III', 0x11: 'an FM3', 0x12: 'an FM9', 0x14: 'a VP4', 0x15: 'an AM4' }
/** A model byte's bare name ("FM9", "VP4"), or null for one this file does not know. */
export const modelName = (byte) => (MODEL_NAMES[byte] ? MODEL_NAMES[byte].replace(/^an? /, '') : null)

/*
 * How long each question waits, in milliseconds. ForgeFX's own numbers where
 * it has them, and the "slow link" ones for the AM4, because a Bluetooth
 * adapter on 5-pin MIDI is exactly what ForgeFX calls slow: 31,250 baud.
 */
export const WAIT = {
  detect: 1200,
  scene: 700,
  tempo: 700,
  preset: 1500,
  sceneName: 1000,
  status: 1500,
  tunerPoll: 300,
  /* A write that worked gets no answer; one that did not gets a refusal within this. */
  watch: 120,
  sceneEcho: 500,
  /* How long after a preset switch the unit is asked where it landed. */
  landed: 300,
  /* How long the published tuner is given to start sending before the phone asks instead. */
  push: 1200,
  am4Structure: 1500,
  am4Name: 1200,
  am4Bypass: 600,
  am4Channel: 1200,
  am4Tempo: 800,
  am4Tuner: 400,
  /* An AM4 write is not answered; the line is held this long so its echo passes first. */
  am4Settle: 40,
  /*
   * A stored preset, whole (the scene names): the longest the AM4 may go
   * quiet between its six frames, and the most the whole may take. A 3,082-byte
   * frame is about a second at 31,250 baud, and the whole about four.
   */
  am4DumpGap: 2500,
  am4DumpAll: 20000,
  /*
   * A block's settings for Edit (am4-edit.js): the longest the AM4 may go
   * quiet partway through its answer, and the most the whole may take. An
   * amp's is a couple of thousand bytes, about a second at 31,250 baud.
   */
  am4ReadAllGap: 2500,
  am4ReadAll: 10000,
  /* The same for an FM3's block (fm3-edit.js): an amp is about 1,700 bytes, half a second at 31,250 baud. */
  gen3ReadAllGap: 2500,
  gen3ReadAll: 10000,
  /*
   * AND THE FIRST BYTE OF EDIT'S READ OF A BLOCK, within this (16 November
   * 2026). A healthy read is done in 0.3 to 0.7 s on his units, its first
   * byte back long before that; one that has not begun in a second is one
   * the unit is not going to answer, and waiting the 2.5 s the gap gets held
   * the line from everything else, while a Play tap gives up in 1.5 s. Once
   * anything comes, the gap above is the wait again.
   */
  gen3ReadAllFirst: 1000,
  /* An Axe-Fx III's captures (lib/nam-install): one slot's head (334 bytes back, a ninth of a second down an adapter), and one message of an upload (650 bytes out and the unit's answer). */
  namSlot: 2500,
  namChunk: 4000,
  /*
   * The grid (lib/gen3-grid). The live read is one answer of about 755
   * bytes, a quarter of a second down an adapter. The preset whole is 24,680
   * bytes from an FM3 or FM9 and 49,336 from an Axe-Fx III: eight seconds
   * and sixteen at 31,250 baud, and a Bluetooth link can be slower than the
   * jack, so the whole is given a minute and a half and timed by its bytes
   * (the longest the unit may go quiet between two frames is the gap).
   */
  gridLive: 2500,
  gridDumpGap: 2500,
  gridDumpAll: 90000
}

/** A frame identical to one just sent, arriving within this, is the phone hearing itself. */
export const ECHO_MS = 250
/** The AM4 is asked one stored name at a time, at least this far apart. */
export const NAME_GAP_MS = 600
/** An answer this late is not taken as an answer to the next question. */
export const LATE_MS = 2000
/** How many times in all a capture slot is asked before it is called silent (namSlotSure). */
export const NAM_SLOT_ASKS = 3
/** The AM4's preset answer is reused for this long, so one screen load is one read. */
export const STRUCTURE_FRESH_MS = 400
/**
 * A block Edit has read is kept this long after its last read, so a knob let
 * go is one register read, not three whole blocks (editKept); and never longer
 * than EDIT_WHOLE_MS after it was last read whole.
 */
export const EDIT_FRESH_MS = 5000
export const EDIT_WHOLE_MS = 30000
/*
 * PLAY GOES FIRST (see editWaits). After a scene or a preset changed, Edit
 * waits for Play to read the blocks again, but never longer than this past
 * the change or Play's last request, whichever came later, in case Play
 * reads nothing. Clearly longer than both waits Play takes before that read
 * (lib/own-echo): OWN_SETTLE_MS after a preset this phone chose, and
 * PRESET_SETTLE_MS after one changed on the unit (a footswitch, a Program
 * Change), counted from Play's own read of the preset as it heard the news.
 * Equal to the second, Edit's hold ran out just before Play's read, every
 * time. A test holds it to both.
 */
export const REREAD_MAX_MS = PRESET_SETTLE_MS + 1000
/*
 * And a request of Play's still being answered holds Edit off for no longer
 * than this from its start: longer than any of them takes on a unit that
 * answers, so it only ever lets go of one that went wrong.
 */
export const PLAY_HOLD_MAX_MS = 10000

/*
 * THE FOOTSWITCH WATCH. A unit says nothing when its own footswitch changes
 * scene or preset (ForgeFX found none over USB), so the phone asks: scene
 * every second, preset every two, tempo every four — about 2% of what 5-pin
 * MIDI carries. The AM4's one preset answer carries both, every two.
 */
export const POLL_MS = { scene: 1000, preset: 2000, tempo: 4000, am4: 2000 }
export const TUNER_MS = 150
/*
 * A GEN 3 UNIT THAT STOPS ANSWERING IS LEFT IN PEACE. The adapter runs on its
 * own charger, so it stays connected while the unit is switched off and on,
 * and the watch went on asking three times every four seconds. Fractal's
 * release notes: on Axe-Fx III firmware before 25.00 and FM9 before 7.00,
 * "global settings not recalled if MIDI data is present on the MIDI In jack
 * during bootup", and III 1.09 "Fixed crash if flooding unit with MIDI data
 * during boot". So after QUIET_AFTER watch questions in a row go unanswered,
 * the wire goes quiet: the watch asks nothing, and the rig's own check
 * (detect) is answered "not connected" with nothing sent for QUIET_MS, then
 * asks once each time it comes round, about every ten seconds. Anything the
 * unit says ends it.
 */
export const QUIET_AFTER = 3
export const QUIET_MS = 30000
/*
 * How often the AM4's own tuner is opened again while the phone's tuner is
 * open, so it stays up until Close (keepUnitTuner). The same three seconds
 * as the computer's (ForgeFX AM4_TUNER_KEEP_MS).
 */
export const AM4_TUNER_KEEP_MS = 3000

/* ------------------------------------------------------------------ */
/* How each command is sent                                            */
/* ------------------------------------------------------------------ */

/*
 * 'published' is Fractal's third-party command, 'edit' the frame FM3-Edit
 * itself sends, 'auto' tries the first and checks, then the second. The
 * preset has no published SysEx switch, so its two are the unpublished 0x27
 * frame and Program Change; the tuner's are asking for the frequency, or
 * listening for what the unit sends with "Send Realtime Sysex" on.
 */
export const WAYS = {
  scene: ['auto', 'published', 'edit'],
  channel: ['auto', 'published', 'edit'],
  tempo: ['auto', 'published', 'edit'],
  preset: ['auto', 'sysex', 'pc'],
  tuner: ['auto', 'poll', 'push']
}

export const DEFAULT_METHODS = { scene: 'auto', channel: 'auto', tempo: 'auto', preset: 'auto', tuner: 'auto', pcChannel: 1, learned: {} }

/** A stored set of choices, with anything unknown dropped: storage can hold an older shape. */
export function settleMethods(m) {
  const out = { ...DEFAULT_METHODS, learned: {} }
  for (const key of Object.keys(WAYS)) {
    if (WAYS[key].includes(m?.[key])) out[key] = m[key]
    const learned = m?.learned?.[key]
    if (learned !== 'auto' && WAYS[key].includes(learned)) out.learned[key] = learned
  }
  const ch = Number(m?.pcChannel)
  if (Number.isInteger(ch) && ch >= 1 && ch <= 16) out.pcChannel = ch
  return out
}

/* ------------------------------------------------------------------ */
/* The check panel's steps                                             */
/* ------------------------------------------------------------------ */

/*
 * Each says what it does before it does it. The reads change nothing; each
 * write puts things back the way they were.
 */
export const CHECK_STEPS = {
  gen3: {
    reads: [
      { step: 'model', label: 'Does the unit answer?' },
      { step: 'preset', label: 'Preset number and name' },
      { step: 'scene', label: 'Scene' },
      { step: 'scene-names', label: 'Scene names 1 to 8' },
      { step: 'tempo', label: 'Tempo' },
      { step: 'blocks', label: 'Blocks' },
      { step: 'stored-name', label: 'Another preset’s name' },
      { step: 'echo', label: 'Echo test (MIDI Thru)' }
    ],
    writes: [
      { step: 'write-scene', label: 'Scene: go to 2 and back', does: 'Changes to scene 2, then back to the scene you were on.' },
      { step: 'write-channel', label: 'Channel: Amp to B and back', does: 'Puts the amp on B, then back where it was.' },
      { step: 'write-tempo', label: 'Tempo: up 1 and back', does: 'Raises the tempo by one, then puts it back.' },
      {
        step: 'write-bypass',
        label: 'Effect: off and back',
        does: 'Switches the first effect off, or on, then puts it back as it was.',
        warn: 'If the preset has only an amp and a cab, it switches the amp, so the sound changes for a moment until it is back on.'
      },
      { step: 'write-preset', label: 'Preset: next and back', does: 'Loads the next preset, then the one you were on.' },
      { step: 'write-tuner', label: 'Tuner: 3 seconds', does: 'Opens the tuner for three seconds and counts the readings.' }
    ]
  },
  am4: {
    reads: [
      { step: 'structure', label: 'Preset, name, scene and blocks' },
      { step: 'tempo', label: 'Tempo' },
      { step: 'blocks', label: 'Each block on or off, and its channel' },
      { step: 'stored-name', label: 'The next preset’s name' },
      { step: 'echo', label: 'Echo test (MIDI Thru)' }
    ],
    writes: [
      { step: 'write-scene', label: 'Scene: go to 2 and back', does: 'Changes to scene 2, then back to the scene you were on.' },
      { step: 'write-tempo', label: 'Tempo: up 1 BPM and back', does: 'Raises the tempo by one, then puts it back.' },
      { step: 'write-bypass', label: 'Effect: turn the first block off and back on', does: 'Switches the first block, then switches it back.' },
      {
        step: 'write-preset',
        label: 'Preset: next and back',
        does: 'Loads the next preset, then the one you were on.',
        warn: 'Changing preset on the AM4 drops any unsaved changes on the unit.'
      }
    ]
  },
  /* A VP4 is only ever sent presets and scenes, and never answers over Bluetooth: there is nothing to check (bleVp4.js). */
  vp4: { reads: [], writes: [] }
}

/* ------------------------------------------------------------------ */
/* Errors, in the shapes the app already reads                         */
/* ------------------------------------------------------------------ */

const failure = (message, status, extra = {}) => Object.assign(new Error(message), { status, bluetooth: true, ...extra })
/* The shape shared/unsupported.mjs's isUnsupported reads. */
const unsupported = () => failure('unsupported', 501, { unsupported: true })
const notHere = () => failure('Not over Bluetooth.', 404)
const timedOut = () => failure('The unit did not answer in time.', 504)
const badInput = (what) => failure(what, 400)
const notConnected = () => failure('The Bluetooth adapter is not connected.', 503)
/* A tap still waiting for the line at its deadline: never sent (device.js says it in the words every dropped tap is said in). */
const tooLate = () => failure('Not sent in time.', 504, { late: true })
/* One of Edit's writes, asked before a scene or preset change and not sent after it (moved). */
const movedFirst = () => failure('The scene or preset changed before that was sent. Try it again.', 409)
const refusedBy = (code) => failure(`The unit refused it: ${rejectedWords(code)}.`, 502, { code })

/* A poll that found the line busy, told apart from one the unit did not answer. */
const SKIPPED = Symbol('skipped')

/*
 * The rests in a capture's upload, in milliseconds, from the recording of
 * Axe-Edit III (lib/nam-install): it sent the opening message 28 ms after
 * the unit answered "a transfer is under way" (`begin`; everywhere else
 * between the 130 it sent the next within 2 ms of an answer), said "it is
 * over" 124 ms after the unit answered the last message (`over`), and read
 * its list of slots 335 ms after that (`read`), with nothing sent in
 * between. `again` is the app's own: a slot that reads empty is asked once
 * more, this long after. The computer's are the same numbers (ForgeFX
 * namCaptures.ts NAM_REST).
 */
export const NAM_REST = Object.freeze({ begin: 30, over: 150, read: 350, again: 1000 })

const realClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t)
}

/* What the stage never shows over Bluetooth: no volume, no looper, no input. */
const OFF_STAGE = ['input', 'output', 'looper']

const silentTuner = () => ({ type: 'tuner', note: '', octave: undefined, cents: null })


/**
 * WHICH EDIT OF THE UNIT'S an account is read, written and guarded through,
 * by what `namKnobs` answers (lib/bluetooth): `true`, the whole hand-written
 * list of an Axe-Fx III's own blocks (axefx3-edit `withNam`: his account,
 * until lib/features OWN_KNOBS_FOR_EVERYONE); `'nam'`, the NAM block alone
 * (`namOnly`: every account since lib/features NAM_KNOBS_FOR_EVERYONE said
 * true); anything else, or a unit with no such list, the codec's catalog as
 * it was.
 */
export const ownEditOf = (edit, level) => (level === true && edit?.withNam ? edit.withNam : level === 'nam' && edit?.namOnly ? edit.namOnly : edit)

/**
 * THE AM4'S ONE WAY OUT. Every message for the AM4 passes through this. A
 * SysEx frame goes only if it is on AM4_ALLOWED, or, while Edit is open to
 * this account over Bluetooth, if it is one of Edit's reads and writes for a
 * block the AM4 has just said is in its preset (`placed`, the codes of the
 * last answer this connection believed; see am4EditAllowed). Anything
 * shorter goes only if it is the tuner's CC on the number and channel THIS
 * connection read from the AM4 (`learned`, see am4ShortAllowed): before that
 * read, nothing short goes at all. Anything else is logged and dropped.
 * 'sent', 'refused' or 'failed' (the adapter would not take it).
 */
export function am4Sender(send, log = () => {}, learned = () => null, placed = () => null, saving = () => null, slotting = () => null) {
  return (bytes) => {
    const sysex = Array.isArray(bytes) && bytes[0] === 0xf0
    /*
     * A save (lib/bleSave) goes only as the one save being sent, over the location the AM4 has just said it is on (`saving`): never on the lists below, which know no save.
     * And a block put in a slot (lib/am4-chain) only as the one slot write the wire is sending at this moment (`slotting`), one of the four slots and a block the AM4 itself names: on neither list, and never while nothing of the chain's is going.
     */
    const ok = sysex ? (saveShaped(bytes, MODELS.am4) ? saveAllowed(bytes, MODELS.am4, saving()) : am4Allowed(bytes) || am4EditAllowed(bytes, placed()) || am4SlotAllowed(bytes, slotting())) : am4ShortAllowed(bytes, learned())
    if (!ok) {
      log(`refused to send the AM4 ${toHex(bytes)}: it is not one of the messages the AM4 is ever sent`)
      return 'refused'
    }
    return send(bytes) === false ? 'failed' : 'sent'
  }
}

/*
 * EACH GEN-3 UNIT'S EDIT, BY ITS MODEL BYTE: its own catalog (lib/
 * gen3-edit.js bound to it), since a setting's number on one is another
 * setting on the next (an amp's Gain is 7 on an FM3, 11 on an FM9, 1 on an
 * Axe-Fx III).
 */
export const GEN3_EDIT = Object.freeze({ fm3: fm3Edit, fm9: fm9Edit, axefx3: axefx3Edit })
const GEN3_EDIT_BY_MODEL = Object.freeze({ [MODELS.fm3]: fm3Edit, [MODELS.fm9]: fm9Edit, [MODELS.axefx3]: axefx3Edit })

/*
 * A GEN-3 UNIT'S EDIT FRAMES, HELD AS THE AM4'S ARE. Everything the gen-3
 * wire has always sent still goes as it went: it has no frozen unit on
 * record and no list of its own. What it never sent before Edit came, a
 * block's whole read (fn 0x1F), a knob (fn 0x01 52 00) and a typed write
 * to a block's setting (fn 0x01 09 00 at a block the catalog names), goes
 * only as one of Edit's, to a block the unit has just listed in its preset
 * (`placed`) and a setting the unit's own catalog names (its editAllowed:
 * fm3EditAllowed, fm9EditAllowed, axefx3EditAllowed). The tempo's typed
 * write is at the Controllers (2), not a block, and goes as before.
 *
 * THE AXE-FX III'S NAM BLOCK (lib/axefx3-own-knobs.js) is in none of those
 * catalogs, so a read or a write of Edit's at 206 or 207 is refused here, as
 * it always was. It goes only while `namKnobs` says the NAM block's knobs are
 * open to this account, asked at each send: then the III's frames are held
 * to the catalog with NAM in it (axefx3-edit `withNam`), which names eight
 * knobs and five switches of that block and nothing else of it, and passes
 * a knob of it only as its place (52 00), never the typed way.
 */
export function gen3Sender(send, log = () => {}, model, placed = () => null, reading = () => null, namKnobs = () => false, saving = () => null, capturing = () => null, gridding = () => null) {
  /* The unit's own Edit; a model with none has nothing of Edit's that may go. Which ids are blocks is the codec's, the same on every gen-3 unit, and the III's NAM with them whoever is asking: a typed write at one is Edit's to hold, open or closed. */
  const edit = GEN3_EDIT_BY_MODEL[model] || null
  const blockAt = (edit?.withNam || edit || fm3Edit).editBlock
  const editNow = () => ownEditOf(edit, namKnobs())
  const editShaped = (b) =>
    Array.isArray(b) &&
    b[0] === 0xf0 &&
    b[4] === model &&
    (b[5] === fm3Edit.READ_ALL || (b[5] === FN.PARAM && ((b[6] === fm3Edit.KNOB[0] && b[7] === fm3Edit.KNOB[1]) || (b[6] === fm3Edit.TYPED[0] && b[7] === fm3Edit.TYPED[1] && !!blockAt((b[8] & 0x7f) | ((b[9] & 0x7f) << 7))))))
  /*
   * THE DEVELOPER'S READER'S ONE FRAME OF THIS SHAPE (lib/gen3-describe, the
   * wire's gen3Describe): the whole read of the one block it has open, a
   * block the unit has just listed, which no catalog names yet (the Axe-Fx
   * III's NAM). Byte for byte the read Edit sends, and nothing else: never a
   * knob, never a typed write.
   */
  const readersOwn = (b) => {
    const eid = reading()
    return Number.isInteger(eid) && sameBytes(b, fm3Edit.buildReadAll(model, eid))
  }
  return (bytes) => {
    /*
     * AN AXE-FX III'S CAPTURES (lib/nam-install): a message of an upload, the
     * list's question, "a transfer is under way", a NAM block pointed at a
     * slot. Each goes only as the very thing the wire is doing with captures
     * at this moment (`capturing`): an upload's own frames byte for byte, a
     * slot's question while the list is read, the one pick being made.
     * Anything else of those shapes, or one with nothing going, is refused.
     * Nothing this file sent before had any of them, and the pick is asked
     * here ahead of Edit, whose catalog has no such setting and refuses it.
     */
    if (namShaped(bytes, model)) {
      if (!namAllowed(bytes, model, capturing())) {
        log(`refused to send ${toHex(bytes.slice(0, 24))}${bytes.length > 24 ? ' …' : ''}: it is one of the capture messages, and not one being sent now`)
        return 'refused'
      }
      return send(bytes) === false ? 'failed' : 'sent'
    }
    /*
     * A SAVE (lib/bleSave: function 0x01, 26 00) goes only as the one save
     * being sent, over the preset the unit has just said it is on (`saving`).
     * Any other frame of that shape, or one with no save going, is refused:
     * nothing else this file sends has the shape, so nothing that went before
     * is held by this.
     */
    if (saveShaped(bytes, model)) {
      if (!saveAllowed(bytes, model, saving())) {
        log(`refused to send ${toHex(bytes)}: it is a save, and not the one save being sent over the preset the unit is on`)
        return 'refused'
      }
      return send(bytes) === false ? 'failed' : 'sent'
    }
    /*
     * THE GRID (lib/gen3-grid: the live read, a cell selected, a block put
     * in one, a cable): goes only as, byte for byte, one of the frames of
     * the grid job the wire has in hand at this moment (`gridding`). Any
     * other frame of those shapes, or one with no such job going, is
     * refused. Nothing this file sent before had any of them.
     */
    if (gridShaped(bytes, model)) {
      if (!gridAllowed(bytes, gridding())) {
        log(`refused to send ${toHex(bytes)}: it is one of the grid’s messages, and not one being sent now`)
        return 'refused'
      }
      return send(bytes) === false ? 'failed' : 'sent'
    }
    if (editShaped(bytes) && !(edit && editNow().editAllowed(bytes, placed(), model)) && !readersOwn(bytes)) {
      log(`refused to send ${toHex(bytes)}: it is not one of Edit’s reads or writes for a block in this preset`)
      return 'refused'
    }
    return send(bytes) === false ? 'failed' : 'sent'
  }
}

/* ------------------------------------------------------------------ */
/* The wire                                                            */
/* ------------------------------------------------------------------ */

/**
 * @param {object} o
 * @param {(bytes:number[]) => boolean} o.send  one message to the adapter; false when it would not take it
 * @param {'am4'|'fm3'|'fm9'|'axefx3'|'vp4'} o.unit   the unit the player picked (a VP4 gets its own wire, bleVp4.js)
 * @param {Array} [o.catalog]   block names by effect id (data/blocks.json)
 * @param {object} [o.methods]  how each command is sent, and what auto has learned
 * @param {{now, setTimeout, clearTimeout}} [o.clock]
 * @param {(line:string) => void} [o.log]
 * @param {(methods:object) => void} [o.remember]  called when auto learns a way, to keep it on the phone
 * @param {(name:string|null) => void} [o.onForeign]  called once, with its bare name, when another unit answers a connection before the one picked has, so the page can say which; and with null when the one picked answers after it (heardFromIt)
 * @param {() => boolean} [o.edit]  whether Edit is open over Bluetooth to this account on this unit (ble-rule editOffered), asked at each request
 * @param {() => boolean} [o.reader]  whether the developer's block reader is open to this account (his alone: lib/bluetooth bluetoothAdmin), asked at each request
 * @param {() => boolean} [o.captures]  whether an Axe-Fx III's captures may be listed, sent and picked from this device (lib/nam-install; his account's alone: lib/bluetooth), asked at every request
 * @param {() => boolean} [o.namKnobs]  whether an Axe-Fx III's NAM block has its knobs in Edit for this account (lib/features NAM_KNOBS_FOR_EVERYONE, his account until then), asked at each request and each send
 * @param {() => boolean} [o.chain]  whether the chain may be read as a grid and changed from this device (lib/gen3-grid, lib/am4-chain; his account until lib/features CHAIN_OVER_BLUETOOTH_FOR_EVERYONE), asked at every request and every send
 */
export function createBleWire({ send, unit, catalog = [], methods, clock, log, remember, onForeign, edit, reader, namKnobs, save, captures, chain, liveGrid } = {}) {
  /* A VP4 is sent presets and scenes by plain MIDI, and nothing this file sends: its own wire, with its own one way out. */
  if (unit === 'vp4') return createVp4Wire({ send, clock, log, onForeign, nameOf: modelName })
  const spec = SPEC[unit]
  if (!spec) throw new Error(`Bluetooth does not know a unit called ${unit}.`)
  if (typeof send !== 'function') throw new Error('Bluetooth needs a way to send.')
  const model = MODELS[unit]
  const am4 = unit === 'am4'
  const time = clock || realClock
  const blocks = Array.isArray(catalog) ? catalog : []
  let ways = settleMethods(methods)

  const say = (line) => {
    try {
      if (log) log(line)
    } catch {
      // The log is for reading afterwards; it can never stop a request.
    }
  }
  /*
   * EDIT, OVER BLUETOOTH OR THE UNIT'S OWN USB CABLE: open to this account on
   * this unit or not, asked at every request and every send rather than
   * once, so an account signed out mid-connection takes it with it. The
   * AM4's knobs are built, and every gen-3 unit's, each from its own catalog
   * (GEN3_EDIT): the FM3's, the FM9's and the Axe-Fx III's.
   */
  const g3Edit = am4 ? null : GEN3_EDIT[unit] || null
  const editHere = am4 || !!g3Edit
  const editOn = () => editHere && (typeof edit === 'function' ? edit() === true : edit === true)
  /*
   * THE NAM BLOCK'S KNOBS (lib/axefx3-own-knobs.js), on an Axe-Fx III: open
   * to this account or not, asked at every request and every send, as Edit
   * is. Open, the III is read, written and guarded through its catalog with
   * NAM in it (axefx3-edit `withNam`); closed, or on any other unit, through
   * the codec's catalog alone (g3Edit), exactly as before there was one.
   */
  const namOn = () => (typeof namKnobs === 'function' ? namKnobs() : false)
  const g3 = () => ownEditOf(g3Edit, namOn())
  /*
   * SAVING FROM THE PHONE (lib/bleSave), where Edit is open: open to this
   * account or not (`save`, lib/bluetooth: his account until lib/features
   * SAVE_OVER_BLUETOOTH_FOR_EVERYONE), asked at every request, as Edit is.
   * `savingSlot` is the one preset a save is being sent over, for exactly as
   * long as it is being sent: the way out passes a save to that slot only.
   */
  const saveOn = () => editOn() && typeof save === 'function' && save() === true
  let savingSlot = null
  /*
   * THE CHAIN, READ AS A GRID AND CHANGED FROM HERE (lib/gen3-grid on an
   * FM3, FM9 or Axe-Fx III; lib/am4-chain on an AM4): open to this account
   * or not (`chain`, lib/bluetooth: his account until lib/features
   * CHAIN_OVER_BLUETOOTH_FOR_EVERYONE), where Edit is open, asked at every
   * request and every send. `chainHand` holds the frames of the one grid
   * job in hand, for exactly as long as it is being done (lib/gen3-grid
   * gridHand): the way out passes a frame of the grid's shapes only if it
   * is one of them, byte for byte.
   */
  const chainOn = () => editOn() && typeof chain === 'function' && chain() === true
  const chainHand = gridHand()
  /* The block codes of the last preset answer believed (readStructure), which Edit's frames are held to. */
  let editPlaced = null
  /* The developer's reader (gen3Describe): his account's, on a gen-3 unit, and the one block whose whole read it has out. */
  const readerOn = () => !am4 && !!g3Edit && typeof reader === 'function' && reader() === true
  let readerOpen = null
  /*
   * AN AXE-FX III'S CAPTURES (lib/nam-install; namEmptySlot, namInstall,
   * namPick below): his account's, on an Axe-Fx III only. `capturing` is
   * what the way out is held to, for exactly as long as one of the three is
   * at work; `captureBusy` is an upload in flight, during which the watch
   * asks nothing and nothing else is written; `captureTurn` keeps two of
   * them from running at once.
   */
  const captureOn = () => unit === 'axefx3' && typeof captures === 'function' && captures() === true
  let capturing = null
  let captureBusy = false
  let captureTurn = false
  /*
   * EDIT'S BLOCKS, KEPT FOR A MOMENT. A knob let go is a write, a read to see
   * it took, and the screen's own read straight after: three whole reads of
   * the block, five seconds and more down an adapter. So a block's read is
   * kept for EDIT_FRESH_MS after it was last read (and no more than
   * EDIT_WHOLE_MS after it was last read whole), and a write marks only the
   * register it went to as needing reading again. A scene, a preset, a
   * channel, an on/off or a model makes the block read afresh.
   */
  const editKept = new Map()
  const forgetEdits = (code) => (code === undefined ? editKept.clear() : editKept.delete(code))
  /*
   * Asked at each send, so a short message is held to what this connection
   * has read by then (see the tuner below). A gen-3 unit's own frames go as
   * they always went; one shaped like Edit's goes only as one of Edit's
   * (gen3Sender).
   */
  const sendFrame = am4
    ? am4Sender(send, say, () => tuner.unitCc, () => (editOn() ? editPlaced : null), () => (saveOn() ? savingSlot : null), () => (chainOn() ? chainHand.now() : null))
    : gen3Sender(send, say, model, () => (editOn() ? editPlaced : null), () => (readerOn() && readerOpen !== null && Array.isArray(editPlaced) && editPlaced.includes(readerOpen) ? readerOpen : null), namOn, () => (saveOn() ? savingSlot : null), () => (captureOn() ? capturing : null), () => (chainOn() ? chainHand.now() : null))

  const handlers = new Set()
  const emit = (event) => {
    for (const fn of [...handlers]) {
      try {
        fn(event)
      } catch {
        // One listener cannot stop the others hearing it.
      }
    }
  }

  /* What the phone was last told, so the footswitch watch knows a change when it sees one. */
  const last = { scene: null, preset: null, name: '', bpm: null }
  /* The blocks this app has no name for, last said in the log (gen3Blocks): said again only when they change. */
  let strangersSaid = ''

  /* ---------------- sending, one question at a time ---------------- */

  /*
   * ONE EXCHANGE AT A TIME, and in this order: Play's presses, then Play's
   * own reads, then Edit's knob turns, then Edit's reads, then the watch.
   * 5-pin MIDI is slow and a unit answers one thing at a time; two questions
   * in flight is two answers nobody can tell apart. A watch poll that finds
   * anything waiting is simply not asked.
   *
   * Edit's are its own (editWrite, editRead): only its routes ask for them
   * (routeFor, the ones a request says are Edit's), so on a copy where Edit
   * is not open over Bluetooth nothing is ever in them, and Play's traffic
   * goes in the order it always went.
   */
  const PRI = { write: 0, read: 1, editWrite: 2, editRead: 3, poll: 4 }
  const isWrite = (p) => p === 'write' || p === 'editWrite'
  const edits = (job) => job.priority === PRI.editWrite || job.priority === PRI.editRead
  const waiting = []
  let current = null
  let closed = false
  let tracing = null

  /*
   * PLAY GOES FIRST, AND ITS READS STAY TOGETHER. With Edit beside Play both
   * want the one line, and the order above is not enough by itself: Play's
   * requests are several exchanges each, asked one after another, and the
   * moment one exchange ends the next in the queue goes, before Play has
   * asked its next. So nothing of Edit's starts while (editWaits):
   *
   *   - a request of Play's is still being answered (playRuns), up to
   *     PLAY_HOLD_MAX_MS from its start;
   *   - a scene or a preset has changed (moved: by Play, or on the unit, as
   *     the watch or a Program Change says) and Play has not read the blocks
   *     again since (/preset/scene-state or /preset/blocks, begun after the
   *     change and ended), up to REREAD_MAX_MS past the change or Play's
   *     last request. Edit's block is read after Play's, on what Play read.
   *
   * A tap never waits behind anything of Edit's that has not started: it
   * goes ahead of them in the queue. Only the exchange already on its way
   * finishes first, as it always has.
   */
  const playRuns = new Set()
  let playEnded = -Infinity
  /* Scene and preset changes on this connection, and how many of them Play has read the blocks after. */
  let moves = 0
  let movedAt = -Infinity
  let reread = 0
  let editTimer = null
  function moved() {
    forgetEdits()
    /* And a gen-3 unit's list Edit keeps a moment: its channels are the last scene's (gen3PlacedHere). */
    statusKept = null
    moves += 1
    movedAt = time.now()
    /*
     * And Edit's knob turns and model picks still waiting for the line were
     * meant for what was there before: a knob frame names no channel, so one
     * sent after the move changes the new scene's channel or the next
     * preset. Never sent; the player turns it again (the routes themselves
     * check the same for one still finding its block, movedSince).
     */
    for (let i = 0; i < waiting.length; ) {
      const job = waiting[i]
      if (job.priority !== PRI.editWrite) {
        i++
        continue
      }
      waiting.splice(i, 1)
      if (job.late !== undefined) {
        time.clearTimeout(job.late)
        job.late = undefined
      }
      say(`not sent, the scene or preset changed first: ${job.opts.what || 'a write'}`)
      job.reject(movedFirst())
    }
  }
  /* Edit's write, asked when `at` was the count: refused if a scene or preset changed since (moved). */
  function movedSince(at, what) {
    if (moves === at) return
    say(`not sent, the scene or preset changed first: ${what}`)
    throw movedFirst()
  }
  /** How long Edit's next exchange must wait for Play, in ms; 0 when it may go. */
  function editWaits() {
    const now = time.now()
    let wait = 0
    for (const run of playRuns) wait = Math.max(wait, run.at + PLAY_HOLD_MAX_MS - now)
    if (moves > reread) {
      const left = Math.max(movedAt, playEnded) + REREAD_MAX_MS - now
      if (left > 0) wait = Math.max(wait, left)
      else {
        reread = moves
        say('Edit goes on: Play read nothing after the scene or preset changed')
      }
    }
    return wait
  }
  function playBegins(blocks) {
    const run = { at: time.now(), moves: blocks ? moves : null }
    playRuns.add(run)
    return run
  }
  function playEnds(run) {
    playRuns.delete(run)
    playEnded = time.now()
    if (run.moves !== null) reread = Math.max(reread, run.moves)
    /* Only for Edit: with nothing of Edit's waiting, the line goes on exactly as it did. */
    if (waiting.length && edits(waiting[0])) pump()
  }

  /*
   * What was sent last, for the echo guard: the last frame ONLY, not
   * everything lately. The published scene change and the answer to the
   * "which scene?" asked straight after it are the same bytes (0C 02 both
   * ways), so a guard with a longer memory throws away the answer.
   */
  let lastSent = { messages: [], copies: [], at: -Infinity }
  let echoes = 0
  let thruTold = false
  let foreign = null
  let pushes = 0
  /* Whether the unit has answered anything on this connection: the footswitch watch waits for it. */
  let answered = false
  /* An AM4 answered a connection made for another unit: nothing more is sent. See heardAnAm4. */
  let wrongUnit = false
  /* The page has been told which other unit answered (onForeign): once a connection. */
  let foreignTold = false
  /* A tuner close refused unsent because the unit had not answered yet: it goes the moment it does (see heardFromIt). */
  let closeWhenHeard = false
  /* Watch questions unanswered in a row, and when the wire went quiet (QUIET_AFTER), or null. Gen 3 only. */
  let misses = 0
  let quietSince = null
  /*
   * EVERY BYTE THAT CAME BACK ON THIS CONNECTION, whatever it was. "The
   * tablet heard nothing" and "the unit answered with something the app
   * could not read" looked the same in the log (7 November 2026: a first
   * connection to a WIDI Jack that stayed up for 101 s with 21 questions
   * unanswered). bleLink reads it: nothing at all is a connection to make
   * afresh, once (bleLink connected()).
   */
  let bytesIn = 0

  /*
   * A QUESTION THAT WENT UNANSWERED MAY STILL BE ANSWERED, late, and that
   * answer must not be taken for the next one of the same kind. Each kind
   * (the function byte) that timed out is remembered here until when its
   * answer would be too late to arrive.
   */
  const lateUntil = new Map()
  let holdTimer = null
  /* Until when an answer given up on part-way may still be coming (see heardBytes). */
  let drainUntil = 0
  let drainCap = 0
  const draining = () => drainUntil > time.now()
  const lateFor = (fn) => (lateUntil.get(fn) ?? -Infinity) - time.now()

  /*
   * How long a gen-3 question must wait for a late answer to its kind to pass.
   * A current-preset answer that arrived late was being taken for a stored
   * name, which turned stored names off for the whole connection; a stored
   * name that arrived late was taken for the loaded preset. Not the tuner's
   * frequency question: a reading that comes late is still a reading, and
   * holding it would put a two-second gap in the needle. Not the AM4, whose
   * every answer is told apart by the address it carries (and whose one that
   * is not, the stored name, waits on its own: see am4NameOf).
   */
  const heldFor = (job) => (am4 || !job.opts.match || job.opts.fn === undefined || job.opts.fn === FN.PARAM ? 0 : lateFor(job.opts.fn))

  const isEcho = (bytes, now) => now - lastSent.at <= ECHO_MS && lastSent.messages.some((m) => sameBytes(m, bytes))
  /*
   * A SET THE UNIT ANSWERS WITH THE SET ITSELF, BYTE FOR BYTE. On these
   * units a block's on and off (0A), its channel (0B), the scene (0C) and
   * the tempo (14) are one message each way: sent with a value it sets,
   * with 7F in the value's place it asks, and the unit answers in the same
   * shape with the value it is now on. So the answer to a SET that was
   * taken is the phone's own bytes, and it is no echo.
   *
   * It was counted as one. Justin's Axe-Fx III, 15 November 2026: a channel
   * change and two blocks switched off, each answered while it was still
   * the last message sent (the third within 46 ms), and the third wrote
   * "the unit is echoing what it receives: the white plug may be in the
   * Axe-Fx III's MIDI THRU, not OUT" into the log of a rig wired right. And
   * a count that is not nought is what makes a preset with no blocks wait
   * for a second copy of its answer (`opts.same`, below), which never
   * comes: after one block switched on or off, an empty preset read as the
   * unit not answering, the very thing that rule was written to mend.
   *
   * Never a question (7F in the value's place): an echoed "which tempo?"
   * is the echo this guard exists for.
   *
   * WHAT EACH RESTS ON. On and off and the channel: seen on a unit (that
   * log, three of three). The tempo: NOT SEEN, and nothing in the codec's
   * notes quotes Fractal's document for it; it is here on the pattern of
   * the other three, and if a unit does not answer a tempo so, all that is
   * lost is the count of one copy of a tempo set through a THRU plug. THE
   * SCENE IS NOT IN THIS LIST: the document's "Returns" line for it is
   * quoted in the codec, its set waits for exactly that answer and takes
   * it itself (allowEcho), as it always has, so its first copy never comes
   * this far.
   */
  const answersItself = (m) =>
    !am4 &&
    Array.isArray(m) &&
    m[4] === model &&
    (((m[5] === FN.BYPASS || m[5] === FN.CHANNEL) && m.length === 11 && m[8] !== 0x7f) || (m[5] === FN.TEMPO && m.length === 10 && !(m[6] === 0x7f && m[7] === 0x7f)))
  /*
   * EVERY OTHER UNIT'S QUESTION askAround SENT ON THIS CONNECTION. A frame
   * identical to one is the phone's own coming back, however late: the
   * echo guard holds for ECHO_MS, and a slower echo of the AM4's question (a
   * busy link resending, a THRU plug) was read as an AM4 answering. No unit
   * answers with another unit's question, byte for byte (an AM4's answer is
   * its STRUCTURE_FRAME, a Gen 3 scene answer carries 0 to 7, not 7F), so
   * no answer is lost to it.
   */
  const askedAround = []
  const askedAroundEcho = (bytes) => askedAround.some((m) => sameBytes(m, bytes))

  const wrongUnitError = () => failure(`An AM4 answered, not the ${spec.name}. Pick AM4 on the Bluetooth page in Settings.`, 409)

  /*
   * NOTHING BUT "ARE YOU THERE?" GOES TO A UNIT THAT HAS NEVER ANSWERED.
   *
   * The wrong-unit guard above only trips when an AM4 SAYS something. One
   * picked as an FM3 might say nothing to an FM3's messages instead, and
   * then the guard never trips: the full read on connecting and every check
   * after it went on sending it FM3 messages, and both freezes on record
   * came from messages an AM4 did not expect. So until this connection has
   * had an answer of any kind, only the unit's own probe goes out (the
   * detect question, `probe: true`). A read held here comes back as nothing
   * came, so every screen shows what it shows for a unit that is not
   * answering; a write is refused, so nothing is learned from it and the
   * player is told why. The first answer opens the line for everything.
   *
   * Not for the AM4's own connection: what it protects is the AM4, and the
   * gen-3 units have no freezes on record.
   */
  const unheard = () =>
    failure(`The ${spec.name} has not answered yet, so nothing is sent to it. Check the unit picked on the Bluetooth page, and how it is plugged in.`, 504, { unheard: true })

  /*
   * A TAP'S DEADLINE, ON ITS WAY FROM request() TO THE FIRST MESSAGE IT SENDS.
   *
   * A write waits here for the exchange in flight — up to a second and a half
   * on a gen-3 unit, and on an AM4 sending a stored preset (its scene names),
   * a good deal longer. Something the player pressed (`options.deadline`,
   * relay-rules TAP_DEADLINE_MS) must not go out after that, or a scene lands
   * in the wrong bar of the song. So the first exchange a tap's route queues
   * carries the deadline: it is taken out of the queue at the deadline if its
   * turn has not come, and pump() never starts it once the deadline is past.
   *
   * The FIRST is found by itself, as the one queued while request() is still
   * running the route: there is no way to follow a request through its
   * awaits, and a later exchange could as well belong to something else. For
   * every write the phone has learned the way of, the first exchange IS the
   * write. A route that waits before its write reads `tapUntil` before its
   * first message takes it, and hands it on by name (`opts.deadline`): the
   * AM4's tuner opening (am4TunerOpen), which waits its turn behind a close
   * and reads two settings before its 127 goes.
   *
   * ONE THING IS LET THROUGH LATE, ON PURPOSE: a write being learned. The
   * first of its kind for this unit on this phone, or the one after a
   * learned way was refused, tries the published way, reads the unit back, and then tries
   * FM3-Edit's (trialScene and the rest), and only its first exchange is
   * bound. Its second way comes after a read-back, and on a unit that does
   * not answer the published way that read waits out the hold for a late
   * answer (lateUntil): two seconds and more after the press, every time.
   * Held to the deadline, it would never go, the way would never be
   * learned, and every tap of that kind after it would be dropped too — a
   * scene that never works rather than one that once came late. So it goes,
   * once; the way it found is remembered on the phone from then on, and the
   * taps after it are the first exchange of their route, bound as above.
   *
   * The reads after a write that went are never bound: that write may have
   * landed, and a read is how the phone finds out.
   */
  let tapUntil = null

  function ex(out, opts = {}) {
    const deadline = Number.isFinite(opts.deadline) ? opts.deadline : tapUntil
    tapUntil = null
    if (closed) return Promise.reject(notConnected())
    if (wrongUnit) return Promise.reject(wrongUnitError())
    if (!am4 && !answered && !opts.probe) {
      if (opts.priority !== 'poll') say(`held until the ${spec.name} answers: ${opts.what || 'a message'}`)
      return isWrite(opts.priority) ? Promise.reject(unheard()) : Promise.resolve(null)
    }
    const priority = PRI[opts.priority] ?? PRI.read
    /*
     * A capture is going to the unit (namInstall): the watch does not ask
     * meanwhile, and nothing else is written until it is over. A READ asked
     * meanwhile is taken and waits its turn in pump(), which starts nothing
     * but the capture's own messages until "it is over" has been answered.
     */
    if (captureBusy && opts.capture !== true) {
      if (priority === PRI.poll) return Promise.resolve(SKIPPED)
      if (isWrite(opts.priority)) return Promise.reject(failure(`The ${spec.name} is taking a capture. Try again when it has finished.`, 409))
    }
    if (priority === PRI.poll && (current || waiting.length || draining())) return Promise.resolve(SKIPPED)
    if (deadline !== null && time.now() >= deadline) {
      say(`not sent, past its deadline: ${opts.what || 'a message'}`)
      return Promise.reject(tooLate())
    }
    return new Promise((resolve, reject) => {
      const job = { out, opts, priority, resolve, reject, back: null, deadline }
      if (deadline !== null) {
        job.late = time.setTimeout(() => {
          job.late = undefined
          const i = waiting.indexOf(job)
          if (i < 0) return
          waiting.splice(i, 1)
          say(`not sent, still waiting for the line at its deadline: ${opts.what || 'a message'}`)
          reject(tooLate())
        }, deadline - time.now())
      }
      const at = waiting.findIndex((j) => j.priority > priority)
      waiting.splice(at < 0 ? waiting.length : at, 0, job)
      pump()
    })
  }

  function pump() {
    if (current || closed || wrongUnit || !waiting.length) return
    /*
     * WHILE A CAPTURE GOES, NOTHING ELSE LEAVES THE PHONE. Axe-Edit sent
     * not one other message between "a transfer is under way" and the
     * unit's answer to the last of the 130. The first build let reads
     * through: the rig's half-minute "which preset are you on?" went between
     * two lots of a capture that takes half a minute over Bluetooth, and a
     * pretend unit showed a preset, a blocks and a scene question inside
     * one upload. Whether that is why Justin's first send was not kept is
     * not known (lib/nam-install: the name's check byte is the likelier
     * reason); it is not what Axe-Edit does, so it is not done. What was
     * asked meanwhile stays in the line and goes when the capture is over.
     */
    if (captureBusy) {
      const mine = waiting.findIndex((j) => j.opts.capture === true)
      if (mine < 0) return
      if (mine > 0) waiting.unshift(waiting.splice(mine, 1)[0])
    }
    /* An AM4 still sending a preset nobody waited out is sent nothing until it stops. */
    const still = drainUntil - time.now()
    if (still > 0) {
      if (holdTimer === null) {
        holdTimer = time.setTimeout(() => {
          holdTimer = null
          pump()
        }, still)
      }
      return
    }
    /*
     * Edit's, while Play holds the line (editWaits): Play's own never wait
     * here. NOR DOES A CAPTURE'S OWN while it holds everything else: its
     * slot reads are asked the way Edit asks (namSlotHead), and a Play
     * request asked during the upload is held by the capture, so the Play
     * run it opened cannot end. The slot's read back then waited out Play's
     * whole limit, ten seconds of nothing sent after "it is over" where
     * Axe-Edit left a third of a second (found in review, 14 November 2026,
     * before it went out).
     */
    if (edits(waiting[0]) && !(captureBusy && waiting[0].opts.capture === true)) {
      const wait = editWaits()
      if (wait > 0) {
        if (editTimer !== null) time.clearTimeout(editTimer)
        editTimer = time.setTimeout(() => {
          editTimer = null
          pump()
        }, wait)
        return
      }
    }
    const hold = heldFor(waiting[0])
    if (hold > 0) {
      /* A watch poll is not worth waiting for: the next one asks. Anything else waits it out, and a write still goes ahead of it. */
      if (waiting[0].priority === PRI.poll) {
        waiting.shift().resolve(SKIPPED)
        return pump()
      }
      if (holdTimer === null) {
        holdTimer = time.setTimeout(() => {
          holdTimer = null
          pump()
        }, hold)
      }
      return
    }
    const job = waiting.shift()
    if (job.late !== undefined) {
      time.clearTimeout(job.late)
      job.late = undefined
    }
    /* Its turn came after its deadline: dropped, and the next in line goes. */
    if (job.deadline !== null && job.deadline !== undefined && time.now() >= job.deadline) {
      say(`not sent, its turn came after its deadline: ${job.opts.what || 'a message'}`)
      job.reject(tooLate())
      return pump()
    }
    current = job
    job.started = time.now()
    /* What comes in while it is out, by kind: said if it goes unanswered (`cameBack`). `framed` is how many of the bytes the messages counted account for. */
    job.came = { bytes: 0, framed: 0, own: 0, elsewhere: 0, parts: 0, short: 0, others: 0, last: null }
    /* Whoever asked may need to know when it really left, which can be long after it was asked for (a capture slot's question waits behind Play: namSlotHead). */
    if (typeof job.opts.sent === 'function') job.opts.sent(job.started)
    const messages = job.opts.messages ? job.out : [job.out]
    lastSent = { messages: [], copies: [], at: job.started }
    for (const m of messages) {
      /*
       * A THROW ON THE WAY OUT IS A SEND THAT FAILED. Nothing caught one
       * here, so the request would reject with the raw error and `current`
       * would stay this job for good: no timer, no end, and every request
       * after it waiting for ever. And a send the adapter would not take
       * wrote nothing in the log, so it read like a unit that said nothing.
       */
      let result
      try {
        result = sendFrame(m)
      } catch (err) {
        result = 'failed'
        say(`sending ${job.opts.what || 'a message'} threw: ${err?.message || err}`)
      }
      if (result !== 'sent') {
        if (result === 'failed') say(`the adapter would not take ${job.opts.what || 'a message'}: not sent`)
        return end(job, null, result === 'refused' ? failure('That message is never sent to the AM4.', 500, { refused: true }) : notConnected())
      }
      lastSent.messages.push(m)
      /* How many times this message has come back, byte for byte (heard: the first copy of a SET is the unit's answer). */
      lastSent.copies.push(0)
    }
    if (job.priority === PRI.write || job.priority === PRI.editWrite) say(`sent ${job.opts.what || 'a write'}: ${messages.map(toHex).join(' | ')}`)
    /* The wait for the first byte back: `firstMs` where the question says (Edit's whole-block read), else the wait every byte after it gets. */
    const firstWait = job.opts.firstMs ?? job.opts.ms ?? 0
    job.expire = () => {
      if (current !== job) return
      if (job.opts.match || job.opts.collect) {
        if (job.opts.fn !== undefined) lateUntil.set(job.opts.fn, time.now() + LATE_MS)
        if (job.priority !== PRI.poll) say(`no answer to ${job.opts.what || toHex(messages[0])} in ${job.came.bytes ? job.opts.ms : firstWait} ms${cameBack(job)}`)
      }
      /* Given up on part-way through: the unit may still be sending the rest of it. */
      if (job.opts.collect && job.back) {
        drainUntil = time.now() + job.opts.ms
        drainCap = drainUntil + (job.opts.cap ?? 0)
      }
      end(job, null)
    }
    job.timer = time.setTimeout(job.expire, firstWait)
  }

  /*
   * WHAT CAME BACK WHILE A QUESTION WENT UNANSWERED, for the log. "No
   * answer" was one line for three different things (Justin's Axe-Fx III
   * over a WIDI Uhost, 15 November 2026: four capture slots of ninety-seven
   * unanswered, a different one each time): nothing at all came back (the
   * question never reached the unit, or its answer never left the adapter),
   * an answer came and was not taken (damaged on the way: its length and
   * whether its checksum held are said), or part of one came and never
   * finished.
   *
   * EVERYTHING THAT CAME IS SAID AS WHAT IT WAS, counted on the question
   * itself (`job.came`), because the line is read to decide where an answer
   * was lost. A timing clock's bytes are not counted (a unit may send them
   * for ever). The phone's own message come back (MIDI Thru), a message
   * from another unit on the line, and the frames a long answer got before
   * it stalled are whole messages too, and each is named: said as "made no
   * whole message", an echo read as an answer cut short (found in review
   * before it went out). So is a short MIDI message (a Program Change when
   * a footswitch is pressed): no part of any answer. Only bytes that none
   * of those account for are said to have made no whole message.
   */
  function cameBack(job) {
    const c = job.came
    if (!c || (!c.bytes && !c.framed)) return ': nothing came in meanwhile'
    const n = (count, one, many) => `${count} ${count === 1 ? one : many}`
    const what = []
    if (c.parts) what.push(n(c.parts, 'message that was part of its answer', 'messages that were part of its answer'))
    if (c.own) what.push(n(c.own, 'copy of what was sent', 'copies of what was sent'))
    if (c.elsewhere) what.push(n(c.elsewhere, 'message not from this unit', 'messages not from this unit'))
    if (c.short) what.push(n(c.short, 'short MIDI message', 'short MIDI messages'))
    if (c.others) {
      const last = c.last
      const sum = Array.isArray(last) && last.length >= 8 ? (checksumHeld(last) ? 'its checksum right' : 'ITS CHECKSUM WRONG') : 'too short to check'
      what.push(`${n(c.others, 'whole message that was', 'whole messages that were')} not its answer (the last ${Array.isArray(last) ? last.length : 0} bytes, function 0x${Array.isArray(last) ? (last[5] & 0xff).toString(16).padStart(2, '0') : '??'}, ${sum})`)
    }
    if (!what.length) return `: ${n(c.bytes, 'byte', 'bytes')} came in meanwhile and made no whole SysEx message`
    /* What the messages counted do not account for: the start of one that never finished (an answer cut short), beside whatever else came. */
    const loose = c.bytes - c.framed
    if (loose > 0) what.push(`${n(loose, 'byte', 'bytes')} that made no whole message`)
    return `: ${n(Math.max(c.bytes, c.framed), 'byte', 'bytes')} came in meanwhile, ${what.join(', ')}`
  }
  /* A Fractal frame's check byte is the XOR of everything before it, kept to seven bits. */
  const checksumHeld = (f) => {
    let x = 0
    for (let i = 0; i < f.length - 2; i++) x ^= f[i]
    return (x & 0x7f) === f[f.length - 2]
  }

  function end(job, value, err) {
    if (current !== job) return
    if (job.timer !== undefined) time.clearTimeout(job.timer)
    current = null
    if (tracing) {
      const messages = job.opts.messages ? job.out : [job.out]
      tracing.push({ out: messages.map(toHex).join(' | '), back: job.back ? toHex(job.back) : '', ms: time.now() - job.started })
    }
    if (err) job.reject(err)
    else job.resolve(value)
    pump()
  }

  const pause = (ms) => new Promise((resolve) => time.setTimeout(resolve, ms))

  /** A read: the answer `match` makes of a frame, {rejected: code}, or null when nothing came. */
  const ask = (out, match, ms, what, extra = {}) => ex(out, { match, ms, fn: out[5], what, priority: 'read', ...extra })

  /**
   * A write, sent and watched: null when nothing came back (a gen-3 unit
   * answers an accepted write with nothing), {rejected: code} for a refusal.
   */
  const fire = (out, what, extra = {}) => ex(out, { fn: out[5], ms: am4 ? WAIT.am4Settle : WAIT.watch, what, priority: 'write', ...extra })

  const rejected = (r) => r !== null && typeof r === 'object' && r.rejected !== undefined

  /* ---------------- hearing ---------------- */

  /*
   * A LONG ANSWER IS TIMED BY ITS BYTES, NOT ITS FRAMES.
   *
   * A stored preset is four frames of 3,082 bytes. Timed frame to frame, a
   * Bluetooth link slower than about 1.2 KB/s could never finish one: the
   * wait ran out mid-frame, the read gave up, and the next message went to an
   * AM4 still sending — the one thing it must never be. So every byte that
   * arrives (not the real-time ones, which a unit may send for ever) starts
   * the wait again; and an answer given up on part-way holds the line until
   * the unit has been quiet for as long again, up to the most it may take.
   */
  function heardBytes(bytes) {
    if (closed || bytes == null || typeof bytes.length !== 'number') return
    /* Every byte, a timing clock's too: whether anything at all came back on this connection (bytesIn). */
    bytesIn += bytes.length
    let real = 0
    /* The status bytes of short messages (a controller, a Program Change): never inside a SysEx frame, so each is one byte a short message accounts for. */
    let statuses = 0
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i] & 0xff
      if (b >= 0xf8) continue
      real++
      if (b >= 0x80 && b < 0xf0) statuses++
    }
    if (!real) return
    const now = time.now()
    const job = current
    /* For the question that is out, if it goes unanswered (cameBack): never a timing clock's. */
    if (job && job.came) {
      job.came.bytes += real
      job.came.framed += statuses
    }
    if (job && job.opts.collect && job.timer !== undefined) {
      time.clearTimeout(job.timer)
      const left = (job.opts.cap ?? Infinity) - (now - job.started)
      job.timer = time.setTimeout(job.expire, Math.max(0, Math.min(job.opts.ms, left)))
    } else if (drainUntil > now) {
      drainUntil = Math.min(now + WAIT.am4DumpGap, drainCap)
    }
  }

  /** A whole SysEx frame from the joiner. */
  function heard(f) {
    if (closed) return
    const now = time.now()
    const job = current
    /* Each kind of message that is not the answer is counted for the question that is out, with its bytes (cameBack). */
    const came = job && job.came ? job.came : null
    const count = (kind) => {
      if (!came) return
      came[kind]++
      came.framed += Array.isArray(f) ? f.length : 0
    }
    if (!isFractal(f)) {
      count('elsewhere')
      return
    }
    /*
     * THE ECHO GUARD. With MIDI Thru on, the unit hands the phone its own
     * message straight back, and an echoed "which scene?" (0C 7F) reads as
     * scene 8. A frame identical to the one just sent is dropped — except
     * while a write is waiting for the one answer that IS identical: the
     * published scene change, which the unit answers with the same bytes.
     *
     * BEFORE ANY OTHER UNIT IS HEARD, since 7 November 2026: the other units'
     * own questions (askAround) carry their model bytes, and the AM4's,
     * echoed back by a white plug in an Axe-Fx III's THRU or an adapter that
     * loops, read as an AM4 answering. That named an AM4 on the adapter and
     * stopped the connection. The phone's own message coming back is never
     * another unit.
     *
     * And askAround's own questions however late (askedAround), on their own
     * test, never under allowEcho: a slow echo of the AM4's question never
     * names an AM4, nor stops a connection whose unit has since answered.
     */
    /* Which of the messages just sent this is, byte for byte, and which copy of it to come back: counted whoever takes it, so a scene change's answer taken by its own wait (allowEcho) is the first copy, and a THRU plug's is the second. */
    const sentAs = now - lastSent.at <= ECHO_MS ? lastSent.messages.findIndex((m) => sameBytes(m, f)) : -1
    const copy = sentAs >= 0 ? ++lastSent.copies[sentAs] : 0
    const ownEcho = sentAs >= 0 && !(job && job.opts.allowEcho)
    /*
     * THE ANSWER THAT IS THE QUESTION, BYTE FOR BYTE. "Which blocks?" is the
     * status frame with nothing in it, and a preset with no blocks answers
     * with the status frame with nothing in it: the same bytes. The echo
     * guard dropped that answer as the phone's own message coming back, so
     * an empty preset read as "no answer to the blocks in 1500 ms" and Play
     * said the unit did not answer in time (a customer's FM3, 13 November
     * 2026: the same preset, twice, and nothing else unanswered around it).
     *
     * So a question that says what its own bytes coming back mean
     * (`opts.same`) is answered by them, on a unit that has answered
     * something else on this connection, so a plug that loops with no unit
     * behind it is never an empty preset. Where nothing has been echoed on
     * this connection, the first copy is the unit's answer. Where something
     * has (MIDI Thru on), the first copy is the echo, dropped as ever, and
     * the second is the answer; a full list behind the echo is still read
     * as the list it is.
     */
    if (ownEcho && job && job.opts.same !== undefined && answered && sameBytes(f, job.out)) {
      job.sames = (job.sames || 0) + 1
      if (echoes === 0 || job.sames >= 2) {
        job.back = f
        return end(job, job.opts.same)
      }
    }
    if (ownEcho || (f[4] !== model && askedAroundEcho(f))) {
      count('own')
      /*
       * The first copy of a SET the unit answers with the set itself is
       * that answer (answersItself): dropped as ever, since whoever sent it
       * waits for nothing, and COUNTED AS NO ECHO. A second copy of the same
       * message is one: with a plug in THRU both come, and the count still
       * climbs a write at a time. A plug that only loops, with no unit
       * behind it, gives one copy of a SET and is not counted for it; its
       * copies of the questions are, as ever.
       */
      if (ownEcho && copy === 1 && answersItself(f)) return
      echoes++
      if (echoes >= 3 && !thruTold) {
        thruTold = true
        /* The Axe-Fx III has no MIDI Thru setting: what echoes there is a white plug in its THRU jack, which repeats what comes in. */
        say(unit === 'axefx3' ? 'the unit is echoing what it receives: the white plug may be in the Axe-Fx III’s MIDI THRU, not OUT' : 'the unit is echoing what it receives: MIDI Thru is on')
      }
      return
    }
    if (f[4] !== model) {
      count('elsewhere')
      if (f[4] === 0x7f) return
      foreign = { model: f[4], at: now }
      if (!am4 && f[4] === MODELS.am4) heardAnAm4()
      else heardAnother(f[4])
      return
    }
    heardAgain()
    /*
     * An answer in several frames (an AM4's stored preset): each one that is
     * part of it is kept, and the wait starts again from it, up to the most
     * the whole may take. Nothing else is sent meanwhile — the queue holds.
     */
    if (job && job.opts.collect) {
      const got = job.opts.collect(f)
      if (got !== undefined) {
        job.back = f
        heardFromIt()
        if (got !== null) return end(job, got)
        count('parts')
        time.clearTimeout(job.timer)
        const left = (job.opts.cap ?? Infinity) - (now - job.started)
        job.timer = time.setTimeout(job.expire, Math.max(0, Math.min(job.opts.ms, left)))
        return
      }
    }
    if (job && job.opts.match) {
      const got = job.opts.match(f)
      if (got !== null && got !== undefined) {
        job.back = f
        heardFromIt()
        return end(job, got)
      }
    }
    if (job && job.opts.fn !== undefined) {
      const no = parseRejected(f, model)
      if (no && no.fn === job.opts.fn) {
        job.back = f
        heardFromIt()
        /*
         * 64 10 00 AFTER A TAP, 64 11 00 AFTER THE TUNER SWITCH: what
         * developers on Fractal's forum report a III sending back, and 0x64
         * itself is in none of Fractal's documents ("if the byte after the
         * command is 0, then it's probably a success message"). So on those
         * two, a 00 is written down as what it is and taken as no refusal:
         * never an error, and never the tuner put down. Anywhere else a 00
         * still reads as the codec reads it (a damaged message).
         *
         * AND 64 12 00 AFTER THE TUNER PAGE, on an FM3: a customer's log of
         * 13 November 2026 has it after every open and every close, four of
         * four, each frame's checksum right and every other message on that
         * connection taken clean. The log said "the unit refused the tuner
         * page: the message arrived damaged", which nothing bore out. Nothing
         * is done with the page's answer either way (startAsking,
         * gen3TunerOff), so this changes the line in the log and no more.
         */
        if ((no.fn === FN.TAP || no.fn === FN.TUNER || no.fn === FN.PAGE) && no.code === 0x00) {
          say(`the unit answered ${job.opts.what || 'it'} with ${toHex([0x64, no.fn, 0x00])}, whose meaning Fractal has not published: not taken as a refusal`)
          return end(job, null)
        }
        say(`the unit refused ${job.opts.what || 'it'}: ${rejectedWords(no.code)}`)
        return end(job, { rejected: no.code })
      }
    }
    /* Heard while a question was out and not its answer: counted, for the line if it goes unanswered (cameBack). */
    if (came) {
      count('others')
      came.last = f
    }
    unasked(f, now)
  }

  /*
   * AN AM4 ON THE OTHER END OF A CONNECTION MADE FOR ANOTHER UNIT: the wrong
   * unit was picked. The AM4 has frozen on messages it did not expect, and
   * how it takes another unit's is not known, so from here nothing more goes
   * out on this connection — the watch stops, everything waiting is refused
   * unsent, and every request after it is refused with the reason. Picking
   * AM4 makes a new connection, and that one is the AM4's own.
   */
  function heardAnAm4() {
    if (wrongUnit) return
    wrongUnit = true
    stopPolls()
    say(`an AM4 answered, not the ${spec.name}: nothing more is sent on this connection`)
    while (waiting.length) waiting.shift().reject(wrongUnitError())
    tellForeign('AM4')
  }

  /*
   * ANY OTHER UNIT ON THE OTHER END, before the one picked has answered: an
   * FM9 on a connection made for an FM3, an FM3 on the AM4's, a VP4 on
   * anybody's. Until now only an AM4 was named, and every other wrong
   * pairing read on the page as "isn't answering", which sends a player to
   * the plugs. Nothing more needs stopping for it: a gen-3 connection sends
   * nothing but its probe until the unit picked answers (`unheard`), and a
   * gen-3 unit refuses a message for another model. So this is the page's
   * words only, said once, and only before the unit picked has answered: a
   * stray message from a second unit on a connection that works is the
   * log's, not the page's. A model byte nobody knows is the log's too.
   */
  function heardAnother(byte) {
    /* Once: a wrong unit refuses every message it is sent, a poll's included, and the log keeps 400 lines (debugLog). */
    if (answered || foreignTold) return
    const name = modelName(byte)
    if (!name) return
    say(`${MODEL_NAMES[byte]} answered, not ${am4 ? 'the AM4' : `the ${spec.name}`}`)
    tellForeign(name)
  }

  /*
   * THE UNIT PICKED ANSWERS FOR THE FIRST TIME ON THIS CONNECTION. The line
   * opens for everything (`unheard`), and two things wait for this moment:
   *
   *   - another unit named to the page before it (heardAnother): the
   *     player moved the cable onto the right unit without tapping Stop,
   *     say, and it works now, so "An FM9 answered, not the FM3" is taken
   *     off the page (onForeign(null)). Not after an AM4 on another unit's
   *     connection, which stops the wire (heardAnAm4): that line stays true.
   *   - a tuner close refused unsent because the unit had not answered yet
   *     (closeWhenHeard): the link's close of what the connection before
   *     left on a Gen 3 unit's tuner, asked once as the connection comes up,
   *     with the unit silent through the wake and the rig's read. Nothing
   *     asks again, so the unit stayed on its tuner, muted, under a Play that
   *     said closed (task 161). It goes now, in its turn, and a Tuner pressed
   *     after it goes after it. Only a close: an open refused the same way
   *     is not sent late, because the phone's tuner went down with its
   *     refusal (rig writeTuner, and the link's reopen in bleLink connected()
   *     puts it down through that), and a late one would mute the unit under
   *     a Play that says closed.
   */
  function heardFromIt() {
    if (answered) return
    answered = true
    if (foreignTold && !wrongUnit) {
      say(`the ${spec.name} answers after all: the other unit is no longer named on the page`)
      try {
        if (onForeign) onForeign(null)
      } catch {
        // Telling the page is a courtesy; the wire goes on as it was.
      }
    }
    if (closeWhenHeard) {
      closeWhenHeard = false
      if (!am4 && !tuner.on && (owedFromBefore() || tuner.pushSent || tuner.pageOpen)) {
        say(`the ${spec.name} answers now: sending the tuner close that was held until it did`)
        gen3TunerInTurn(false).catch((err) => say(`the tuner close after the first answer did not go: ${err?.message || err}`))
      }
    }
  }

  /* A watch question the unit did not answer; the third in a row puts the wire quiet (QUIET_AFTER). */
  function missedPoll() {
    if (am4) return
    misses++
    if (misses >= QUIET_AFTER && quietSince === null) {
      quietSince = time.now()
      say(`the ${spec.name} has not answered ${misses} questions in a row: it may be switched off or starting up, so nothing is sent for ${QUIET_MS / 1000} s, then one question at each check until it answers`)
    }
  }
  /* Anything the unit said: the line is not quiet any more. */
  function heardAgain() {
    misses = 0
    if (quietSince === null) return
    quietSince = null
    say(`the ${spec.name} answers again: the watch starts again`)
  }
  const quiet = () => quietSince !== null

  function tellForeign(name) {
    if (foreignTold) return
    foreignTold = true
    try {
      if (onForeign) onForeign(name)
    } catch {
      // Telling the page is a courtesy; the wire goes on as it was.
    }
  }

  /*
   * IS ANOTHER UNIT ON THIS ADAPTER? "Not answering · FM3 over Bluetooth",
   * with the WIDI Jack plugged into his AM4 (Justin, 7 November 2026): the
   * FM3 picked, the adapter on another unit, and an AM4 does not answer an
   * FM3's question, so nothing ever named it and the page sent him to the
   * plugs. So, once the unit picked has said nothing at all, each other
   * unit's own detect question is asked, one at a time: the AM4's (its
   * preset, the very frame am4Detect sends, and held to the AM4's list
   * before it goes) and the other Gen 3 units' (the scene, as gen3Detect
   * asks it, on their own model byte). An answer is heard as any other
   * unit's is (heard: heardAnAm4, heardAnother), which names it to the page,
   * and an AM4 stops this connection sending anything more.
   *
   * Only from a Gen 3 connection, and only questions each unit is already
   * sent. Never from an AM4's: what may be on the other end is an AM4, and
   * an AM4 is never sent anything off its list (am4Sender), so an AM4
   * connection asks nothing else. Never from a VP4's, which has its own
   * wire and sends nothing of this file's (bleVp4.js), and never a question
   * for a VP4, which answers nothing over Bluetooth. Answers the bare name
   * of the unit that answered, or null.
   */
  async function askAround() {
    if (am4 || closed || wrongUnit || answered || foreignTold) return null
    const others = [
      { name: 'AM4', frame: buildAm4Structure(), am4: true },
      ...['fm3', 'fm9', 'axefx3'].filter((k) => k !== unit).map((k) => ({ name: SPEC[k].name, frame: buildGetScene(MODELS[k]) }))
    ]
    say(`nothing came back from the ${spec.name}: asking whether another unit is on this adapter`)
    for (const o of others) {
      if (closed || wrongUnit || answered || foreignTold) break
      /* The AM4's own question, held to the AM4's own list as everything an AM4 is sent is. */
      if (o.am4 && !am4Allowed(o.frame)) continue
      askedAround.push(o.frame)
      await ex(o.frame, { probe: true, match: () => null, ms: WAIT.detect, what: `the ${o.name}’s own question, to see whether ${MODEL_NAMES[o.frame[4]] || 'another unit'} is on this adapter` }).catch(() => null)
    }
    const who = foreignTold && foreign ? modelName(foreign.model) : null
    say(who ? `${MODEL_NAMES[foreign.model]} is on this adapter, not the ${spec.name}` : `no other unit answered on this adapter either`)
    return who
  }

  /* When this device last sent a tap (gen3Tap): a beat is not handed on for BEAT_TAP_QUIET_MS after one (the computer app keeps the same quiet, ForgeFX unitBeat.ts). */
  let tapAt = -Infinity
  const BEAT_TAP_QUIET_MS = 400

  /** What the unit said that nobody was waiting for. */
  function unasked(f, now) {
    /*
     * A capture slot's answer in the quiet after a slot went unanswered or
     * was asked again, when no slot's question is waiting: an answer that
     * was only late, and said so, since "no answer" alone reads as a unit
     * that said nothing. Counted from when a slot was last asked, which is
     * all that is known: after a slot asked twice, which asking it answers
     * is not.
     */
    if (!am4 && namQuietUntil > now && readNamSlot(f, model)) {
      say(`a capture slot’s answer came with no question waiting, ${Math.round(now - namAskedAt)} ms after a slot was last asked: dropped`)
      return
    }
    if (lateFor(f[5]) >= 0) return
    if (am4) return
    const push = parseTunerPush(f, model)
    if (push) {
      pushes++
      if (tuner.on && tuner.way === 'push') tunerPushed(push)
      return
    }
    if (isBeatPush(f, model)) {
      /*
       * The unit's tempo beat, handed on with the moment it came, for
       * whoever is keeping this device's beat (lib/unitBeat, lib/beatLock).
       * Never just after a tap this device sent: the unit's answer to one,
       * or an adapter's echo of it, is this same message and no beat.
       * Nothing is sent for it and nothing here acts on it.
       */
      if (now - tapAt >= BEAT_TAP_QUIET_MS) emit({ type: 'beat', at: now })
      return
    }
    const scene = parseScene(f, model)
    if (scene !== null) return noteScene(scene, true)
    const preset = parsePresetName(f, model)
    if (preset) notePreset(preset, true)
  }

  /** A short message: only Program Change means anything here. */
  function heardShort(msg) {
    if (closed || !Array.isArray(msg) || !msg.length) return
    /*
     * For the question that is out, if it goes unanswered (cameBack): a
     * short message is no part of any answer, and its bytes are not an
     * answer cut short. ITS DATA BYTES ONLY: the joiner hands on a whole
     * message, status byte and all, for each one of a run sent with the
     * status said once (running status), and counted by that length seven
     * controller messages hid the seven bytes of an answer cut short beside
     * them (found in the third review). The status bytes are counted as
     * they come (heardBytes).
     */
    if (current && current.came) {
      current.came.short++
      current.came.framed += msg.length - 1
    }
    if (isEcho(msg, time.now())) return
    if ((msg[0] & 0xf0) >= 0x80 && (msg[0] & 0xf0) < 0xf0) heardAgain()
    if ((msg[0] & 0xf0) === 0xc0) {
      say(`the unit sent Program Change ${msg[1]}: its preset changed`)
      sceneCache = null
      structure = null
      editPlaced = null
      moved()
      emit({ type: 'changed', scope: 'preset' })
    }
  }

  function noteScene(s, tell) {
    /* Another scene can put a block on another channel. Not the first answer: nothing was kept before the scene was known. */
    if (last.scene !== null && s !== last.scene) moved()
    if (tell && last.scene !== null && s !== last.scene) {
      say(`scene ${s + 1}, changed on the unit`)
      last.scene = s
      return emit({ type: 'scene', index: s })
    }
    last.scene = s
  }

  function notePreset(p, tell) {
    const changed = last.preset !== null && p.number !== last.preset
    if (p.number !== last.preset) {
      sceneCache = null
      if (last.preset !== null) moved()
      /* A new preset whose name is not known yet has no name, not the last one's. */
      last.name = ''
    }
    last.preset = p.number
    if (typeof p.name === 'string') last.name = p.name
    if (tell && changed) {
      say(`preset ${p.number}, changed on the unit`)
      emit({ type: 'changed', scope: 'preset' })
    }
  }

  function noteTempo(bpm, tell) {
    if (tell && last.bpm !== null && bpm !== last.bpm) {
      last.bpm = bpm
      say(`tempo ${bpm}, changed on the unit`)
      return emit({ type: 'tempo', bpm })
    }
    last.bpm = bpm
  }

  const foreignWords = () =>
    foreign && time.now() - foreign.at < 5000
      ? `a different unit answered: ${MODEL_NAMES[foreign.model] || `model ${toHex([foreign.model])}`}, not ${am4 ? 'an AM4' : `the ${spec.name}`}`
      : ''

  /* ---------------- learning which way works ---------------- */

  const methodsCopy = () => ({ ...ways, learned: { ...ways.learned } })
  const keep = () => {
    try {
      if (remember) remember(methodsCopy())
    } catch {
      // Not remembered is asked again next time: slower, never wrong.
    }
  }
  /*
   * FM3-EDIT'S MESSAGES BY THEMSELVES, ON THE FM3 ONLY. Scene, channel and
   * tempo each have two ways: Fractal's published message, and the one
   * FM3-Edit sends, captured from an FM3 and never published. The computer
   * app sends FM3-Edit's scene and channel to an FM3 alone ("other Gen3
   * units stay on spec frames until capture-confirmed", forgefx
   * devices.ts sceneChannelWriteMode, drivers/gen3.ts setScene and
   * setChannel). Nobody has caught what FM9-Edit or Axe-Edit III send, so on
   * an FM9 or an Axe-Fx III, Auto uses the published message only, for all
   * three, and learns nothing else: a published message that does not land
   * says so. FM3-Edit's way still goes when it is chosen by hand in the
   * testing tools (his account only), which is how it would be tried. The
   * FM3 keeps both, as it always has. (The computer app does send its
   * FM3-Edit-style tempo to every Gen 3 unit; the phone, which has driven
   * none of the other two, holds back from that too until one has.)
   */
  const editByAuto = unit === 'fm3'
  const EDIT_KEYS = ['scene', 'channel', 'tempo']
  /*
   * AND THE SAME FOR THE PRESET AND THE TUNER. Fractal publishes no SysEx
   * preset switch for any of its units ("Controller 0 + PC" is the way its
   * manuals give), and the codec calls FM3-Edit's 0x27 frame "FM3-confirmed,
   * III/FM9 … hardware-unverified". The tuner page (0x12) and the frequency
   * question (0x01 sub 0x19) are FM3-Edit's too, "LIVE-VALIDATED on FM3
   * hardware" only; Fractal's own way is the tuner switch (0x11), whose
   * readings the unit sends with Send Realtime Sysex on. So on an FM9 or an
   * Axe-Fx III, Auto sends a preset by Program Change alone and the tuner by
   * its switch alone, and learns neither of FM3-Edit's. Each still goes when
   * it is picked in the testing tools (his account only), which is how it
   * would be tried on a real one. The FM3 keeps both, as it always has.
   */
  const sysexPresetByAuto = unit === 'fm3'
  const pollTunerByAuto = unit === 'fm3'
  /* Whether a way is FM3-Edit's, on a unit whose Auto never sends FM3-Edit's. */
  const notForAuto = (key, w) =>
    (w === 'edit' && !editByAuto && EDIT_KEYS.includes(key)) || (key === 'preset' && w === 'sysex' && !sysexPresetByAuto) || (key === 'tuner' && w === 'poll' && !pollTunerByAuto)
  /* Whether a trial may go on to FM3-Edit's way when the published one did not land. */
  const mayTryEdit = (key) => editByAuto || ways[key] === 'edit'
  /* What auto has learned for `key`, and may use: never FM3-Edit's on an FM9 or an Axe-Fx III. */
  const learnedWay = (key) => {
    const w = ways.learned[key] || null
    return notForAuto(key, w) ? null : w
  }
  /* A way a check found, as the panel says it was remembered: only what learn() kept. */
  const remembered = (key, way) => (way && ways.learned[key] === way ? way : null)

  function learn(key, way) {
    if (notForAuto(key, way)) return
    if (ways.learned[key] === way) return
    ways.learned[key] = way
    say(`${key}: ${way === 'edit' ? 'FM3-Edit’s way' : way} works on this ${spec.name}; remembered`)
    keep()
  }
  function forget(key) {
    if (!ways.learned[key]) return
    say(`${key}: ${ways.learned[key]} stopped working; trying again`)
    delete ways.learned[key]
    keep()
  }
  /* The way to use now: the one the player chose, or the one auto found, or null to find out. */
  const wayFor = (key) => (ways[key] !== 'auto' ? ways[key] : learnedWay(key))

  /* ---------------- saving ---------------- */

  /**
   * SAVE THE EDIT BUFFER OVER THE PRESET THE UNIT IS ON (lib/bleSave, which
   * says what is sent and why it is only ever this).
   *
   * The unit is asked which preset it is on straight before, on this
   * connection, and the save goes only if that is the slot the screen meant:
   * a preset changed on the unit's own switches since the knob was turned
   * would otherwise be written over with another preset's sound. Then the
   * one frame, through the way out that passes it only while `savingSlot`
   * names its slot. A gen-3 unit answers an accepted write with nothing and
   * a refused one with a refusal, which is said in its own words.
   *
   * Answers {ok: true, number} or throws a failure in words.
   */
  async function storePreset(slot) {
    if (!saveOn()) throw failure(SAVE_NOT_OPEN, 403)
    if (!Number.isInteger(slot) || slot < 0) throw badInput('No preset is loaded to save.')
    const out = buildSave(model, slot)
    if (!out) throw badInput('No preset is loaded to save.')
    /* Asked now, never from a copy kept a moment ago: an AM4's structure read afresh, a gen-3 unit's preset name. */
    const here = am4 ? await readStructure({ priority: 'write', fresh: true }) : await presetNow('write')
    const on = am4 ? (here && here !== SKIPPED ? here.location : null) : here && !rejected(here) ? here.number : null
    if (on !== slot) {
      say(`save over preset ${slot} stopped: the unit ${Number.isInteger(on) ? `is on preset ${on}` : 'did not say which preset it is on'}`)
      throw failure(saveElsewhere(on), 409)
    }
    savingSlot = slot
    let answer
    try {
      answer = await fire(out, `the save over preset ${slot}`)
    } finally {
      savingSlot = null
    }
    if (rejected(answer)) throw refusedBy(answer.rejected)
    say(`saved over preset ${slot}`)
    return { ok: true, number: slot }
  }

  /* ---------------- the answers both families give ---------------- */

  const CH = ['A', 'B', 'C', 'D']
  function capabilities() {
    /*
     * The shapes the demo's mock gives for the same units, plus `via`, which
     * is how Edit, Save and the looper know to stay out of the way. No
     * `meters`, so the app never asks for the computer's copy of the grid.
     * `addressing` is ForgeFX's own: it is what letters the AM4's slots.
     */
    const common = {
      via: 'bluetooth',
      hasScenes: true,
      hasChannels: true,
      channelNames: [...CH],
      cabIrs: false,
      fc: { model: false, liveState: false },
      tuner: true,
      /* Save from the phone (lib/bleSave), where it is open to this account: asked when the app asks what the unit can do. */
      supportsSave: saveOn(),
      /* The chain read as a grid and changed from here (lib/gen3-grid, lib/am4-chain), where it is open to this account: the computer app's own word for it. */
      gridEdit: chainOn()
    }
    if (am4) {
      return { ...common, slotModel: 'linear', slotCount: AM4_SLOTS, sceneCount: AM4.SCENES, presets: { count: AM4.LOCATIONS, addressing: 'bankLetter', canScanNames: false } }
    }
    /*
     * 512 PRESETS ON EVERY GEN 3 UNIT, the Axe-Fx III too, as the computer
     * app offers them ("512 numbered slots on every gen-3 unit", forgefx
     * drivers/gen3.ts presetLocations). An Axe-Fx III Mark II holds 1024, and
     * the wire lets a number up to 1023 through to one (SPEC maxPreset), but
     * the original III holds 512 and nothing here can tell the two apart, so
     * the list stays at what both agree on until the computer app says more.
     */
    /*
     * THE GRID: 12×4 on the FM3, 14×6 on the FM9 and Axe-Fx III, in Fractal's
     * words ("The FM9 has a 14x6 grid for effects blocks versus 12x4 on the
     * FM3"), and as the computer app gives it (6 rows of 14). Only Edit's
     * chain editor reads it, and that stays off over Bluetooth (Edit's
     * BLE_NO_CHAIN), so this is for the day it is not.
     */
    const grid = unit === 'fm3' ? { rows: 4, cols: 12 } : { rows: 6, cols: 14 }
    return { ...common, slotModel: 'grid', grid, sceneCount: 8, presets: { count: 512, addressing: 'numeric', canScanNames: false } }
  }

  const detectAnswer = (connected) => ({
    connected,
    name: spec.name,
    short: spec.short,
    gen: 3,
    supported: true,
    simulated: false,
    port: 'bluetooth',
    capabilities: capabilities()
  })

  const presetNumber = (n) => {
    if (!Number.isInteger(n) || n < 0 || n > spec.maxPreset) throw badInput(`There is no preset ${n} on the ${spec.name}.`)
    return n
  }
  const tempoNumber = (bpm) => {
    const n = Math.round(Number(bpm))
    if (!Number.isFinite(Number(bpm)) || n < AM4.TEMPO_MIN || n > AM4.TEMPO_MAX) throw badInput(`A tempo of ${bpm} is outside 24 to 250.`)
    return n
  }
  const blockNumber = (eid) => {
    if (!Number.isInteger(eid) || eid < 1 || eid > 0x3fff || (am4 && !am4Block(eid))) throw badInput(`There is no block ${eid} here.`)
    return eid
  }

  /* ================================================================ */
  /* Gen 3: FM3, FM9, Axe-Fx III                                      */
  /* ================================================================ */

  let numberedOff = false
  let sceneNamesOff = false
  let sceneCache = null

  const sceneNow = (priority = 'read') => ask(buildGetScene(model), (f) => parseScene(f, model), WAIT.scene, 'the scene', { priority })
  const presetNow = (priority = 'read') => ask(buildGetPreset(model), (f) => parsePresetName(f, model), WAIT.preset, 'the preset', { priority })
  const tempoNow = (priority = 'read') => ask(buildGetTempo(model), (f) => parseTempo(f, model), WAIT.tempo, 'the tempo', { priority })
  /* Every answer also says which blocks Edit's frames may go to (gen3Sender): the ones in the preset now. */
  const statusNow = (priority = 'read') =>
    ask(buildStatusDump(model), (f) => parseStatusDump(f, model), WAIT.status, 'the blocks', { priority, same: [] }).then((list) => {
      if (Array.isArray(list)) editPlaced = list.map((b) => b.effectId)
      return list
    })

  async function channelNow(eid) {
    const list = await statusNow()
    if (!Array.isArray(list)) return null
    const b = list.find((x) => x.effectId === eid)
    return b ? b.channel : null
  }

  async function gen3Detect() {
    /* Quiet (QUIET_AFTER): nothing goes for QUIET_MS, then this probe alone, once each time the rig's check asks. */
    if (quiet() && time.now() - quietSince < QUIET_MS) return detectAnswer(false)
    const got = await ask(buildGetScene(model), (f) => parseScene(f, model), WAIT.detect, 'the scene, to see whether the unit answers', { probe: true })
    const answered = Number.isInteger(got) || rejected(got)
    if (Number.isInteger(got)) last.scene = got
    say(answered ? `the ${spec.name} answers` : foreignWords() || `the ${spec.name} did not answer`)
    return detectAnswer(answered)
  }

  async function gen3Preset() {
    /*
     * A TUNER CLOSE HELD FOR THE UNIT'S FIRST ANSWER (closeWhenHeard) is
     * sent by nothing but an answer, and before one only the probe goes:
     * this read, the rig's timed check (unit-watch probeUnit) and its
     * refreshPreset, was held unsent, so a unit that missed both probes as
     * the connection came up stayed on its tuner, muted, until a pull-down.
     * The probe first, then: answered, the close goes in its turn
     * (heardFromIt) and this reads as it always did.
     */
    if (!answered && closeWhenHeard) await gen3Detect()
    const got = await presetNow()
    if (!got || rejected(got)) return { number: -1, name: '' }
    notePreset(got, false)
    return { number: got.number, name: got.name }
  }

  async function gen3Scene() {
    const got = await sceneNow()
    if (!Number.isInteger(got)) return { index: -1 }
    noteScene(got, false)
    return { index: got }
  }

  async function gen3Tempo() {
    const got = await tempoNow()
    if (!Number.isInteger(got)) return { bpm: 0 }
    noteTempo(got, false)
    return { bpm: got }
  }

  async function gen3Blocks() {
    const list = await statusNow()
    if (rejected(list)) throw refusedBy(list.rejected)
    if (!Array.isArray(list)) throw timedOut()
    /* outlineChain names by effect id and wants the channel as a letter. */
    const states = list.map((b) => ({ effectId: b.effectId, bypassed: b.bypassed, channel: channelLetter(b.channel) }))
    sayStrangers(states)
    return (outlineChain(states, blocks) || []).filter((b) => !OFF_STAGE.includes(b.slug)).map(knobsSaid)
  }

  /*
   * A BLOCK PLAY SWITCHES AND EDIT HAS NO KNOBS FOR: `knobs: false`. The
   * Axe-Fx III's NAM and IR Player (lib/gen3Catalog OWN) are named and
   * switched here, and its knob catalog (lib/axefx3-knobs.js) carries neither,
   * so Edit opens them on their on and off alone and says why, rather than
   * ask for a read that is refused (gen3Params) and put the refusal up red.
   * Every block the catalog's knobs do name is handed on exactly as before.
   *
   * The NAM block is marked only for an account its knobs are closed to
   * (namOn, above): open, the catalog this asks has NAM in it, so the block
   * is handed on as any block with knobs is, and Edit, Play's hold pop-up
   * and the watch's quick edit, which all read this mark, open its knobs.
   * The IR Player has none for anybody.
   *
   * And so, by the same question and nothing written for them here, the
   * blocks named on 13 November 2026 (lib/gen3Catalog OWN): the Crossover,
   * the Vocoder and Tone Match on an FM9 and an Axe-Fx III, and the III's
   * Dynamic Distortion. No knob catalog names one, so each is marked, for
   * every account.
   */
  const knobsSaid = (b) => (g3Edit && !g3().editBlock(b.effectId) ? { ...b, knobs: false } : b)

  /* An id that is not a block a player switches (lib/gen3Catalog NOT_BLOCKS): refused with nothing sent, as forgefx-midi refuses it. */
  const switchable = (eid) => {
    if (NOT_BLOCKS.includes(eid)) throw badInput(`Block ${eid} is not one the app switches.`)
    return eid
  }

  /*
   * A BLOCK THIS APP HAS NO NAME FOR, SAID IN THE LOG BY ITS NUMBER.
   *
   * The unit's status answer lists every block in the preset by its effect
   * id, and outlineChain leaves out an id the catalog does not know, rather
   * than guess at it. So the Axe-Fx III's NAM block (firmware 33) was in
   * every answer and in no log: the one thing needed to name it, its number,
   * never reached anybody. Now each such id goes in the log with whether it
   * is on and its channel, once, and again only when that changes (a preset
   * changed, or the block switched on the unit), so a report sent from a
   * preset with one in it carries the number. Nothing is sent to the unit for
   * it, and Play still leaves the block out.
   *
   * Known, and so not said: every id the unit's list names (on an Axe-Fx
   * III, NAM 1 and 2 at 206 and 207 and the IR Player at 195 to 198, named
   * in 1.89.73 from what this line said in a customer's log), and the ids
   * that are not blocks at all (lib/gen3Catalog NOT_BLOCKS: the III's
   * Preset FC, 200, was in every preset's line, and so was 201, which his
   * own III said is the preset's Performance page; and the RTA, 174, which
   * has no on and off). And since 13 November 2026 the Crossover, the
   * Vocoder, Tone Match and the III's Dynamic Distortion, named from what
   * his own III answered. Anything else still is.
   */
  function sayStrangers(states) {
    const known = new Set([...blocks.filter((c) => Number.isInteger(c?.page) && c.slug).map((c) => c.page), ...NOT_BLOCKS])
    const strangers = states.filter((s) => Number.isInteger(s?.effectId) && !known.has(s.effectId))
    const line = strangers
      .map((s) => `id ${s.effectId} (${s.bypassed === true ? 'off' : s.bypassed === false ? 'on' : 'on or off not said'}${s.channel ? `, channel ${s.channel}` : ''})`)
      .join('; ')
    const key = `${last.preset}|${line}`
    if (!line || key === strangersSaid) return
    strangersSaid = key
    say(`blocks this app has no name for yet, on preset ${Number.isInteger(last.preset) ? last.preset : '?'}: ${line}`)
  }

  async function gen3SceneState() {
    const list = await statusNow()
    if (!Array.isArray(list)) return []
    return list.map((b) => ({ effectId: b.effectId, bypassed: b.bypassed, channel: channelLetter(b.channel) }))
  }

  /*
   * A STORED SLOT'S NAME, OR NOTHING — NEVER A BLANK.
   *
   * The phone files whatever this answers under the unit's name, on disk. A
   * blank for a slot that has a name would wipe one learned over the relay.
   * So the answer has to be for the slot asked about; one for another slot
   * means this unit cannot say, and it is not asked again on this connection.
   * (After any preset question goes unanswered, this one waits for the late
   * answer to pass rather than take it: see heldFor.)
   */
  async function gen3StoredName(n) {
    presetNumber(n)
    if (numberedOff) throw unsupported()
    const got = await ask(buildGetPresetName(model, n), (f) => parsePresetName(f, model), WAIT.preset, `preset ${n}’s name`)
    if (got === null) throw timedOut()
    if (rejected(got) || got.number !== n) {
      numberedOff = true
      say(`the ${spec.name} answered for another preset when asked for ${n}’s name: stored names are not read on this connection`)
      throw unsupported()
    }
    return { number: n, name: got.name }
  }

  /*
   * The loaded preset's scene names, eight small questions, kept until the
   * preset changes. Only for the preset that is loaded: a gen-3 unit can only
   * name the scenes it is playing.
   */
  async function gen3SceneNames(n) {
    if (sceneNamesOff || !Number.isInteger(n) || n < 0 || n !== last.preset) throw unsupported()
    if (sceneCache && sceneCache.number === n) return sceneCache.names
    const names = []
    let missing = 0
    for (let i = 0; i < 8; i++) {
      const got = await ask(
        buildGetSceneName(model, i),
        (f) => {
          const s = parseSceneName(f, model)
          return s && s.index === i ? s : null
        },
        WAIT.sceneName,
        `scene ${i + 1}’s name`
      )
      if (rejected(got)) {
        sceneNamesOff = true
        throw unsupported()
      }
      /* The first one unanswered: a busy unit, not one to wait eight seconds on. */
      if (!got && i === 0) throw timedOut()
      if (!got) missing++
      names.push(got ? got.name : '')
    }
    if (n !== last.preset) throw unsupported()
    if (!missing) sceneCache = { number: n, names }
    return names
  }

  /* ---- scene ---- */

  /* The published scene change is answered with the scene: the same bytes as the change itself. */
  const sendPublishedScene = (i) =>
    fire(buildSetScene(model, i), `scene ${i + 1}`, { ms: WAIT.sceneEcho, allowEcho: true, match: (f) => parseScene(f, model) })
  const sendEditScene = (i) => fire(buildSetSceneEdit(model, i), `scene ${i + 1} (FM3-Edit’s way)`)

  /*
   * WHAT A TRIAL CAN LEARN FROM. Each trial below sends one way, reads the
   * unit back, and tries the other way if it did not land. But a write to
   * where the unit already is lands whether it worked or not — the first
   * scene of a setlist song, a tempo it is already at — and a way learned
   * from that is remembered on the phone and sent from then on unchecked,
   * so every later write would fail without a word. So the unit is asked
   * where it is first (or the caller says, having just asked), and a way is
   * only learned from a write that moved it. The writes still go out either
   * way: the player asked for them.
   */
  const movedFrom = (from, to) => Number.isInteger(from) && from !== to

  /**
   * Try the published scene change, and FM3-Edit's if that did not land.
   * Which one worked, or null when the unit would not say where it ended up
   * or was already there.
   */
  async function trialScene(i, before) {
    const from = before === undefined ? await sceneNow() : before
    let moved = movedFrom(from, i)
    const r = await sendPublishedScene(i)
    if (!rejected(r)) {
      /*
       * Checked, because an echo from MIDI Thru looks exactly like the unit's
       * answer, and because a unit can take it and say nothing.
       */
      const now = await sceneNow()
      if (now === i) return moved ? 'published' : null
      if (now === null) return null
      if (!mayTryEdit('scene')) throw failure(`The unit stayed on scene ${now + 1}.`, 502)
      moved = true
    } else if (!mayTryEdit('scene')) throw refusedBy(r.rejected)
    const e = await sendEditScene(i)
    if (rejected(e)) throw refusedBy(e.rejected)
    const now = await sceneNow()
    if (now === i) return moved ? 'edit' : null
    if (now === null) return null
    throw failure(`The unit stayed on scene ${now + 1}.`, 502)
  }

  /* One way, sent: null when nothing came back, {rejected} for a refusal. */
  const sceneBy = (way, i) => (way === 'published' ? sendPublishedScene(i) : sendEditScene(i))

  async function changeScene(i) {
    const way = wayFor('scene')
    if (way) {
      const r = await sceneBy(way, i)
      if (!rejected(r)) return
      if (ways.scene !== 'auto') throw refusedBy(r.rejected)
      forget('scene')
    }
    const found = await trialScene(i)
    if (found) learn('scene', found)
  }

  async function gen3WriteScene(index) {
    if (!Number.isInteger(index) || index < 0 || index > 7) throw badInput(`There is no scene ${index}.`)
    moved()
    await changeScene(index)
    last.scene = index
    emit({ type: 'scene', index })
    return { ok: true }
  }

  /* ---- channel ---- */

  /* A refusal about the block itself is not a reason to try the other way. */
  const aboutTheBlock = (code) => code === 0x05 || code === 0x07

  /* As trialScene: only a write that moved the block teaches anything. */
  async function trialChannel(eid, c, before) {
    const from = before === undefined ? await channelNow(eid) : before
    let moved = movedFrom(from, c)
    const p = await fire(buildSetChannel(model, eid, c), `block ${eid} to ${CH[c]}`)
    if (rejected(p) && aboutTheBlock(p.rejected)) throw refusedBy(p.rejected)
    if (!rejected(p)) {
      const now = await channelNow(eid)
      if (now === c) return moved ? 'published' : null
      if (now === null) return null
      if (!mayTryEdit('channel')) throw failure(`The block stayed on ${CH[now] || now}.`, 502)
      moved = true
    } else if (!mayTryEdit('channel')) throw refusedBy(p.rejected)
    const e = await fire(buildSetChannelEdit(model, eid, c), `block ${eid} to ${CH[c]} (FM3-Edit’s way)`)
    if (rejected(e)) throw refusedBy(e.rejected)
    const now = await channelNow(eid)
    if (now === c) return moved ? 'edit' : null
    if (now === null) return null
    throw failure(`The block stayed on ${CH[now] || now}.`, 502)
  }

  async function changeChannel(eid, c) {
    const way = wayFor('channel')
    if (way) {
      const r = await fire(way === 'published' ? buildSetChannel(model, eid, c) : buildSetChannelEdit(model, eid, c), `block ${eid} to ${CH[c]}`)
      if (!rejected(r)) return
      if (ways.channel !== 'auto' || aboutTheBlock(r.rejected)) throw refusedBy(r.rejected)
      forget('channel')
    }
    const found = await trialChannel(eid, c)
    if (found) learn('channel', found)
  }

  async function gen3WriteChannel(eid, channel) {
    switchable(blockNumber(eid))
    const c = channelIndex(channel)
    if (c === null) throw badInput(`${channel} is not A, B, C or D.`)
    forgetEdits(eid)
    /* And the list Edit keeps a moment (gen3PlacedHere), which says the channel each block was on: the next read of this block is cut at the new one, not the one it was on a moment ago. */
    statusKept = null
    await changeChannel(eid, c)
    statusKept = null
    /* No announcement: the app's channel write expects none. */
    return { ok: true }
  }

  /* ---- tempo ---- */

  async function trialTempo(bpm, before) {
    /*
     * EXACTLY, not within one: a gen-3 unit answers a whole BPM, and the
     * check panel moves the tempo by one — within one of the target is also
     * within one of where it started, which would call a write that did
     * nothing a success. And as trialScene, only from a tempo it was not
     * already at.
     */
    const from = before === undefined ? await tempoNow() : before
    let moved = movedFrom(from, bpm)
    const p = await fire(buildSetTempo(model, bpm), `tempo ${bpm}`)
    if (!rejected(p)) {
      const now = await tempoNow()
      if (now === bpm) return moved ? 'published' : null
      if (!Number.isInteger(now)) return null
      if (!mayTryEdit('tempo')) throw failure(`The tempo stayed at ${now}.`, 502)
      moved = true
    } else if (!mayTryEdit('tempo')) throw refusedBy(p.rejected)
    const e = await fire(buildSetTempoEdit(model, bpm), `tempo ${bpm} (FM3-Edit’s way)`)
    if (rejected(e)) throw refusedBy(e.rejected)
    const now = await tempoNow()
    if (now === bpm) return moved ? 'edit' : null
    if (!Number.isInteger(now)) return null
    throw failure(`The tempo stayed at ${now}.`, 502)
  }

  async function changeTempo(bpm) {
    /* The published tempo SET does not take on an FM3; FM3-Edit's way is the FM3's default. */
    const way = ways.tempo !== 'auto' ? ways.tempo : unit === 'fm3' ? 'edit' : learnedWay('tempo')
    if (way) {
      const r = await fire(way === 'published' ? buildSetTempo(model, bpm) : buildSetTempoEdit(model, bpm), `tempo ${bpm}`)
      if (!rejected(r)) return
      if (ways.tempo !== 'auto' || unit === 'fm3') throw refusedBy(r.rejected)
      forget('tempo')
    }
    const found = await trialTempo(bpm)
    if (found) learn('tempo', found)
  }

  async function gen3WriteTempo(value) {
    const bpm = tempoNumber(value)
    await changeTempo(bpm)
    last.bpm = bpm
    emit({ type: 'tempo', bpm })
    return { ok: true }
  }

  /* ---- preset ---- */

  const sendPc = (n) =>
    ex(buildProgramChange(n, { channel: ways.pcChannel }), {
      messages: true,
      ms: WAIT.watch,
      what: `preset ${n} by Program Change`,
      priority: 'write'
    })
  const sendSysexPreset = (n) => fire(buildSwitchPreset(model, n), `preset ${n}`)

  /* Where the unit is, asked a moment after the switch. */
  async function landedOn() {
    await pause(WAIT.landed)
    const got = await presetNow()
    return got && !rejected(got) ? got.number : null
  }

  /*
   * As trialScene: choosing the preset that is already loaded teaches nothing.
   *
   * ON AN FM9 OR AN AXE-FX III, PROGRAM CHANGE ALONE (sysexPresetByAuto), and
   * one that did not land says which setting on the unit to look at
   * (presetMissLine): Program Change Off or another MIDI channel leave it
   * where it was, and PC Mapping or a MIDI PC Offset send it somewhere else,
   * which is said as where it went.
   */
  async function trialPreset(n, before) {
    let from = before
    if (from === undefined) {
      const got = await presetNow()
      from = got && !rejected(got) ? got.number : null
    }
    let moved = movedFrom(from, n)
    if (!sysexPresetByAuto && ways.preset !== 'sysex') {
      await sendPc(n)
      const at = await landedOn()
      if (at === n) return moved ? 'pc' : null
      if (at === null) return null
      const where = at === from ? `The unit stayed on preset ${at}.` : `The unit went to preset ${at}, not ${n}.`
      throw failure(`${where} ${presetMissLine(unit, ways.pcChannel)}`, 502)
    }
    const s = await sendSysexPreset(n)
    if (!rejected(s)) {
      const at = await landedOn()
      if (at === n) return moved ? 'sysex' : null
      if (at === null) return null
      moved = true
    }
    await sendPc(n)
    const at = await landedOn()
    if (at === n) return moved ? 'pc' : null
    if (at === null) return null
    throw failure(`The unit stayed on preset ${at}.`, 502)
  }

  /* One way, sent: Program Change is never answered, so only the SysEx switch can be refused. */
  const presetBy = (way, n) => (way === 'pc' ? sendPc(n) : sendSysexPreset(n))

  async function changePreset(n) {
    const way = wayFor('preset')
    if (way) {
      const r = await presetBy(way, n)
      if (!rejected(r)) return
      if (ways.preset !== 'auto') throw refusedBy(r.rejected)
      forget('preset')
    }
    const found = await trialPreset(n)
    if (found) learn('preset', found)
  }

  async function gen3SelectPreset(number) {
    const n = presetNumber(number)
    /* Another preset's blocks: nothing of Edit's goes until the unit has listed them. */
    editPlaced = null
    moved()
    await changePreset(n)
    notePreset({ number: n }, false)
    emit({ type: 'changed', scope: 'preset' })
    return { ok: true }
  }

  /* ---- bypass and tap ---- */

  async function gen3WriteBypass(eid, bypassed) {
    switchable(blockNumber(eid))
    const r = await fire(buildSetBypass(model, eid, bypassed === true), `block ${eid} ${bypassed === true ? 'off' : 'on'}`)
    forgetEdits(eid)
    if (rejected(r)) throw refusedBy(r.rejected)
    emit({ type: 'changed', scope: 'grid' })
    return { ok: true }
  }

  async function gen3Tap() {
    tapAt = time.now()
    const r = await fire(buildTap(model), 'a tap')
    if (rejected(r)) throw refusedBy(r.rejected)
    return { ok: true }
  }

  /* ---- tuner ---- */

  /*
   * The rest are the AM4's own tuner screen, which this phone opens and
   * closes with the CC its MIDI pedal would send. `unitCc` is what THIS
   * connection read of that setting, {cc, channel} or null, and the only CC
   * the AM4 may be sent: a read that names NONE, or a number the tuner may
   * not be sent, clears it; one that names another number moves it there;
   * one that is silent or unclear leaves it as it was. `unitOpen` that a 127
   * went out on it and its 0 is still owed. `unitRead` that the setting has
   * been asked about on this connection. `unitAsk` the verdict: false once
   * an answer was missing or unclear, so an open does not ask again — a
   * close with a 0 owed always asks, and a number it confirms makes it true
   * again. `unitChannel` the channel the AM4 last named in plain words on
   * this connection. `unitSays` what the last open found; `unitClosing` that
   * a close is reading the setting before its 0 can go; `unitShapes` the
   * AM4's raw answers already put in the log on this connection.
   * `unitKeepAt` when the 127 is next sent again (keepUnitTuner), and
   * `unitKeepNote` why the last time it was not, said once.
   *
   * `before` is a Gen 3 unit's only: what the connection BEFORE this one
   * left its tuner on and never closed, {push, page}, handed over by the
   * link as this one starts (oweGen3Tuner). This connection never opened
   * those, so its own opens leave them alone, and the next close closes
   * them with its own (gen3TunerOff).
   */
  const tuner = {
    on: false,
    way: null,
    run: 0,
    timer: null,
    pushSent: false,
    pageOpen: false,
    before: { push: false, page: false },
    lastNote: null,
    polled: 0,
    unitCc: null,
    unitOpen: false,
    unitRead: false,
    unitAsk: true,
    unitChannel: null,
    unitSays: null,
    unitClosing: false,
    unitShapes: new Map(),
    unitKeepAt: 0,
    unitKeepNote: null,
    unitKeepAway: null
  }
  /* The app off screen (screenOff/screenOn, from the link's AppState): the AM4's own tuner is not kept up meanwhile. */
  let offScreen = false

  function reading(event) {
    const word = event.note ? `${event.note}${event.octave ?? ''}` : ''
    if (word !== tuner.lastNote) {
      tuner.lastNote = word
      say(word ? `tuner: ${word} ${event.cents > 0 ? '+' : ''}${event.cents}` : 'tuner: no note')
    }
    emit(event)
  }

  const fromHz = (hz) => {
    const n = hzToNote(hz)
    return n ? { type: 'tuner', freq: Math.round(hz * 100) / 100, note: n.note, octave: n.octave, cents: n.cents } : silentTuner()
  }

  /*
   * WHAT A PUSHED TUNER READING MEANS, in Fractal's third-party MIDI document
   * (Rev 1.4): "nn = note (0 – 11) ss = string (0 – 5, 0 = low E) cc = cents
   * (offset binary, 63 = 0, 62 = -1, 64 = +1, etc.)". So the cents are the
   * byte less 63, one cent a step, held to the needle's ±50. It was scaled
   * by 50/63 until 25 October 2026, which read +50 cents as +40.
   *
   * WHICH NOTE 0 IS, the document does not say. Counting from A is believed,
   * not known, so each new note goes to the log with its byte and its string
   * (the string is Fractal's own count, 0 the low E): the first report from a
   * real unit shows whether an open low E reads E.
   */
  const FROM_A = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
  let pushTold = null
  function tunerPushed(p) {
    const which = `${p.note}/${p.string}`
    if (which !== pushTold) {
      pushTold = which
      say(`tuner data from the unit: note byte ${p.note}, string ${p.string}, cents byte ${p.fine} (${toHex([p.note, p.string, p.fine])})`)
    }
    if (p.note > 11) return reading(silentTuner())
    reading({ type: 'tuner', note: FROM_A[p.note], octave: undefined, cents: Math.max(-50, Math.min(50, p.fine - 63)) })
  }

  function tunerLater(run, ms, fn) {
    if (!tuner.on || tuner.run !== run) return
    tuner.timer = time.setTimeout(() => {
      tuner.timer = null
      if (tuner.on && tuner.run === run) fn()
    }, ms)
  }

  /* The tuner's ticks run on their own, so a tick that fails (the adapter went) ends quietly. */
  async function gen3TunerTick(run) {
    try {
      const hz = await ex(buildTunerPoll(model), { match: (f) => parseTunerPoll(f, model), ms: WAIT.tunerPoll, fn: FN.PARAM, priority: 'poll' })
      if (tuner.on && tuner.run === run && typeof hz === 'number') {
        tuner.polled++
        reading(fromHz(hz))
      }
    } catch {
      return
    }
    tunerLater(run, TUNER_MS, () => gen3TunerTick(run))
  }

  /* `deadline` is an open's (see gen3TunerOpen); the fall-back to asking, from a timer, has none. */
  async function startAsking(run, deadline = null) {
    tuner.way = 'poll'
    if (!tuner.pageOpen) {
      tuner.pageOpen = true
      await fire(buildTunerPage(model, true), 'the tuner page', { deadline })
    }
    if (tuner.on && tuner.run === run) gen3TunerTick(run)
  }

  /*
   * THE PUBLISHED TUNER FIRST, ON AN FM9 OR AN AXE-FX III (pollTunerByAuto):
   * Fractal's switch, 0x11 01, and the readings the unit sends with Send
   * Realtime Sysex on. With none in 1.2 s the log says why, and nothing else
   * goes: the page and the frequency question are FM3-Edit's, and go to these
   * two only when Poll is picked in the testing tools. A refusal of the
   * switch (any reason but the 00 developers report after it, whose meaning
   * Fractal has not published: see heard) puts the phone's tuner down, with
   * the unit's reason. The FM3 asks, as it always has, and falls back to
   * asking from the switch.
   */
  async function gen3TunerOn(deadline) {
    const run = tuner.run
    const way = wayFor('tuner') || (pollTunerByAuto ? 'poll' : 'push')
    if (way === 'push') {
      tuner.way = 'push'
      tuner.pushSent = true
      const r = await fire(buildTuner(model, true), 'the tuner', { deadline })
      /*
       * Refused, but 11 01 HAS gone, and Fractal has not published 0x64 or
       * its codes: so the unit may be on its tuner (and Tuner Mute) all the
       * same. The off stays owed (tunerSent), and the next Close sends the
       * published 11 00.
       */
      if (!pollTunerByAuto && rejected(r)) {
        const err = refusedBy(r.rejected)
        err.tunerSent = true
        throw err
      }
      const seen = pushes
      tunerLater(run, WAIT.push, () => {
        if (pushes !== seen) return
        if (!pollTunerByAuto && ways.tuner !== 'poll') {
          say(`no tuner data from the ${spec.name} in 1.2 s: Send Realtime Sysex may be off on it (Setup → MIDI/Remote). Nothing else is sent`)
          return
        }
        say('no tuner data from the unit in 1.2 s; asking for the frequency instead')
        startAsking(run).catch(() => {})
      })
      return
    }
    await startAsking(run, deadline)
  }

  /*
   * What the unit was left on, closed, each part put down as its own message
   * goes: a page close the adapter would not take leaves the page owed, and
   * the off that went before it is not sent again for nothing. With them,
   * what the connection before left open (`tuner.before`): the off goes for a
   * published tuner either opened, and the page close, which moves the
   * unit's screen, only for a page one of them really opened.
   */
  async function gen3TunerOff() {
    if (tuner.pushSent || tuner.before.push) {
      await fire(buildTuner(model, false), 'the tuner off')
      tuner.pushSent = false
      tuner.before.push = false
    }
    if (tuner.pageOpen || tuner.before.page) {
      await fire(buildTunerPage(model, false), 'the tuner page closed')
      tuner.pageOpen = false
      tuner.before.page = false
    }
  }

  /* Anything on the unit's tuner from before this connection, not yet closed (see oweGen3Tuner). */
  const owedFromBefore = () => tuner.before.push || tuner.before.page

  /*
   * THE OPEN IS A TAP, AND ITS TURN CAN COME LATE (gen3TunerInTurn), long
   * after request() let go of the tap's deadline: so the deadline is taken
   * by name (writeTuner) and goes with its one message, which is dropped
   * past it, as am4TunerOpen's 127 is. An open whose message did not go
   * (dropped, or not taken by the adapter) puts back what the unit was on
   * before it: a page it marked open and never opened would have the next
   * open skip the page, and ask one that is shut.
   */
  async function gen3TunerOpen(deadline) {
    if (tuner.on) return { ok: true }
    const was = { pushSent: tuner.pushSent, pageOpen: tuner.pageOpen }
    tuner.on = true
    tuner.run++
    tuner.lastNote = null
    try {
      await gen3TunerOn(deadline)
    } catch (err) {
      tuner.on = false
      tuner.run++
      /* A switch that went and was refused still owes its off (gen3TunerOn). */
      tuner.pushSent = err?.tunerSent ? true : was.pushSent
      tuner.pageOpen = was.pageOpen
      throw err
    }
    return { ok: true }
  }

  /*
   * A CLOSE WHOSE MESSAGE DID NOT GO IS STILL OWED. The phone's tuner is
   * down by then, so the next Close (the player's again, the watch's retry,
   * the link's on a new connection) goes by what the unit was left on, not
   * by that, and that includes what the connection before left on it.
   */
  async function gen3TunerClose() {
    if (!tuner.on && !tuner.pushSent && !tuner.pageOpen && !owedFromBefore()) return { ok: true }
    tuner.on = false
    tuner.run++
    if (tuner.timer !== null) time.clearTimeout(tuner.timer)
    tuner.timer = null
    try {
      await gen3TunerOff()
    } catch (err) {
      /* Refused unsent because the unit has not answered yet: sent the moment it does (heardFromIt). */
      if (err?.unheard) closeWhenHeard = true
      throw err
    }
    closeWhenHeard = false
    return { ok: true }
  }

  /*
   * ONE AFTER ANOTHER, as the AM4's are (am4TunerInTurn). A Close and then a
   * Tuner pressed without waiting ran side by side: the close's off went,
   * the open's on after it, and only then did the close put down what it
   * believed the unit had open, over the open's, so the next Close sent
   * nothing and the unit stayed on its tuner, muted. On the asked-for way
   * the open found the page still marked open by the close not yet done,
   * never opened it, and asked a page the close then shut. In turn, each
   * starts from what the one before it left.
   */
  let gen3TunerTurns = Promise.resolve()
  function gen3TunerInTurn(on, deadline) {
    const turn = gen3TunerTurns.then(() => (on ? gen3TunerOpen(deadline) : gen3TunerClose()))
    gen3TunerTurns = turn.catch(() => {})
    return turn
  }

  /* ================================================================ */
  /* AM4                                                               */
  /* ================================================================ */

  /*
   * THE PRESET ANSWER, reused for a moment: a screen load asks for the
   * preset, the scene and the blocks one after the other, and on an AM4 all
   * three are this one read. Any write throws it away.
   */
  let structure = null
  let structureTold = false
  let slotsHeard = null

  /*
   * THE SLOT CODES, ONLY FROM AN ANSWER THAT HELD TOGETHER. They are not just
   * shown: they are the blocks the AM4 is asked about and the ones the
   * player's taps switch, so a damaged answer must not choose them. One with
   * a bad checksum keeps its preset, scene and name (each held to its range
   * in the codec, so the page is not left blind), but its slots are only
   * believed when the answer before it said the same — which is also what
   * keeps a unit whose checksum turns out always to be off working. Until
   * then they are null, and whoever needs them asks again.
   */
  function believeSlots(got) {
    const agrees = slotsHeard !== null && sameBytes(slotsHeard, got.slots)
    slotsHeard = got.slots
    return got.checksumOk || agrees ? got : { ...got, slots: null }
  }

  async function readStructure({ priority = 'read', fresh = false } = {}) {
    if (!fresh && structure && time.now() - structure.at < STRUCTURE_FRESH_MS) return structure.value
    const got = await ask(buildAm4Structure(), parseAm4Structure, WAIT.am4Structure, 'the preset', { priority })
    if (got === SKIPPED) return SKIPPED
    if (!got || rejected(got)) return null
    if (!structureTold) {
      structureTold = true
      /* Nobody has checked this answer's checksum on a real AM4: say what it was, once. */
      say(got.checksumOk ? 'the AM4’s preset answer carries a good checksum' : 'the AM4’s preset answer did not carry a good checksum; its numbers were in range, so it is used')
    }
    const value = believeSlots(got)
    structure = { value, at: time.now() }
    editPlaced = value.slots ? value.slots.filter((c) => Number.isInteger(c) && c > 0) : null
    return value
  }

  async function am4Detect() {
    const got = await readStructure({ fresh: true })
    const answered = !!got
    if (got) {
      last.preset = got.location
      last.name = got.name
      last.scene = got.scene
    }
    say(answered ? 'the AM4 answers' : foreignWords() || 'the AM4 did not answer')
    return detectAnswer(answered)
  }

  async function am4Preset() {
    const s = await readStructure()
    if (!s) return { number: -1, name: '' }
    notePreset({ number: s.location, name: s.name }, false)
    return { number: s.location, name: s.name }
  }

  async function am4Scene() {
    const s = await readStructure()
    if (!s) return { index: -1 }
    noteScene(s.scene, false)
    return { index: s.scene }
  }

  const am4TempoNow = (priority = 'read') => ask(buildAm4TempoRead(), parseAm4Tempo, WAIT.am4Tempo, 'the tempo', { priority })

  async function am4Tempo() {
    const got = await am4TempoNow()
    if (!Number.isInteger(got)) return { bpm: 0 }
    noteTempo(got, false)
    return { bpm: got }
  }

  const am4BypassNow = (code, priority = 'read') => ask(buildAm4BypassRead(code), (f) => parseAm4Bypass(f, code), WAIT.am4Bypass, `block ${toHex([code])} on or off`, { priority })
  const am4ChannelNow = (code, priority = 'read') => ask(buildAm4ChannelRead(code), (f) => parseAm4Channel(f, code), WAIT.am4Channel, `block ${toHex([code])}’s channel`, { priority })

  /*
   * The four slots, each with its on/off and channel. A code nobody has seen
   * is listed under its own number and asked nothing: the AM4 is never sent a
   * question about a block that is not on the list.
   */
  async function am4Placed() {
    let s = await readStructure()
    /* Slots not believed yet (see believeSlots): asked once more, and believed if the two agree. */
    if (s && !s.slots) s = await readStructure({ fresh: true })
    if (!s || !s.slots) return null
    const out = []
    for (let i = 0; i < s.slots.length; i++) {
      const code = s.slots[i]
      if (!code) continue
      const block = am4Block(code)
      if (!block) {
        const name = `0x${code.toString(16)}`
        out.push({ slug: name, name, effectId: code, row: 1, col: i + 1, fromRows: [], bypassed: null, channel: null })
        continue
      }
      const off = await am4BypassNow(code)
      const ch = await am4ChannelNow(code)
      out.push({
        slug: block.slug,
        name: block.slug,
        effectId: code,
        row: 1,
        col: i + 1,
        fromRows: [],
        bypassed: typeof off === 'boolean' ? off : null,
        channel: Number.isInteger(ch) ? channelLetter(ch) : null
      })
    }
    return out
  }

  async function am4Blocks() {
    const list = await am4Placed()
    if (!list) throw timedOut()
    return list
  }

  async function am4SceneState() {
    const list = await am4Placed()
    return (list || []).map((b) => ({ effectId: b.effectId, bypassed: b.bypassed, channel: b.channel }))
  }

  /*
   * A STORED NAME, one at a time and never closer than NAME_GAP_MS. The
   * answer does not say which location it is for — only its order does — so
   * after one goes unanswered the next waits out LATE_MS, or a late answer
   * could be filed under the wrong slot.
   */
  let nameAt = -Infinity
  let quietUntil = 0
  let nameChain = Promise.resolve()
  function am4NameOf(n) {
    const run = nameChain.then(async () => {
      const wait = Math.max(nameAt + NAME_GAP_MS, quietUntil) - time.now()
      if (wait > 0) await pause(wait)
      try {
        const got = await ask(buildAm4StoredName(n), parseAm4StoredName, WAIT.am4Name, `${am4LocationCode(n)}’s name`)
        if (got === null) quietUntil = time.now() + LATE_MS
        return got
      } finally {
        nameAt = time.now()
      }
    })
    nameChain = run.catch(() => {})
    return run
  }

  async function am4StoredName(n) {
    presetNumber(n)
    const got = await am4NameOf(n)
    if (rejected(got)) throw refusedBy(got.rejected)
    if (!got) throw timedOut()
    /* '<EMPTY>' is a slot the unit says is empty: that blank is the truth. */
    return { number: n, name: got.name }
  }

  /*
   * AN AM4'S SCENE NAMES, THE SLOW WAY, ONCE.
   *
   * "Let's make them load even if it's slower on Bluetooth, but it doesn't
   * have to constantly be rereading them once it reads them once, it can go
   * off the remembered names unless they hit refresh." They are only inside
   * the whole stored preset (parseAm4DumpSceneNames), four seconds of it at
   * 5-pin speed. The phone remembers what this finds (rig.refreshSceneNames),
   * so it runs the first time a preset is seen and when Refresh names is
   * pressed, never on every change.
   *
   * NOTHING ELSE IS SENT WHILE IT COMES. The AM4 has frozen on things it did
   * not expect, and nobody has seen what it does with a message arriving
   * while it is sending a preset out — the computer never does that either.
   * So this is one exchange like any other, and a press made during it waits
   * for it to end. A unit that does not even start answering is not asked
   * again on this connection.
   */
  const am4Names = new Map()
  /* A second ask for a slot already coming is the same read, not another four seconds. */
  const am4NamesComing = new Map()
  /* A slot given up on part-way (a link too slow, a unit that stalled) is not read again by itself: only Refresh names asks. */
  const am4NamesGaveUp = new Set()
  let am4DumpsOff = false
  function am4SceneNames(n) {
    presetNumber(n)
    if (am4Names.has(n)) return Promise.resolve({ number: n, names: am4Names.get(n) })
    if (am4NamesGaveUp.has(n)) return Promise.reject(unsupported())
    if (!am4NamesComing.has(n)) {
      const coming = readAm4SceneNames(n).finally(() => am4NamesComing.delete(n))
      am4NamesComing.set(n, coming)
    }
    return am4NamesComing.get(n)
  }
  async function readAm4SceneNames(n) {
    if (am4DumpsOff) throw unsupported()
    const frames = []
    let heardHead = false
    const started = time.now()
    const got = await ask(
      buildAm4StoredDump(n),
      null,
      WAIT.am4DumpGap,
      `the scene names of ${am4LocationCode(n)}`,
      {
        cap: WAIT.am4DumpAll,
        collect: (f) => {
          const part = am4DumpPart(f)
          if (!part || (part === 'head' && heardHead)) return undefined
          if (part === 'head') heardHead = true
          else if (!heardHead) return undefined
          frames.push(f)
          if (part !== 'foot') return null
          return parseAm4DumpSceneNames(frames, n) || { broken: true }
        }
      }
    )
    if (rejected(got)) throw refusedBy(got.rejected)
    if (!got) {
      if (!heardHead) {
        am4DumpsOff = true
        say('the AM4 did not answer a request for a stored preset; its scene names are not asked for again on this connection')
      } else {
        am4NamesGaveUp.add(n)
        say(`gave up on the scene names of ${am4LocationCode(n)} part-way; Refresh names asks again`)
      }
      throw timedOut()
    }
    if (got.broken) {
      say(`the scene names of ${am4LocationCode(n)} came back damaged; not used`)
      throw timedOut()
    }
    say(`read the scene names of ${am4LocationCode(n)} in ${((time.now() - started) / 1000).toFixed(1)} s`)
    am4Names.set(n, got.names)
    return { number: n, names: got.names }
  }

  async function am4SelectPreset(number) {
    const n = presetNumber(number)
    moved()
    const r = await fire(buildAm4Preset(n), `preset ${am4LocationCode(n)}`)
    if (rejected(r)) throw refusedBy(r.rejected)
    structure = null
    /* Another preset's blocks: nothing of Edit's goes until the AM4 has said what they are. */
    editPlaced = null
    notePreset({ number: n }, false)
    emit({ type: 'changed', scope: 'preset' })
    /* Checked a moment later, for the log: the AM4 answers a switch with nothing. */
    pause(WAIT.landed)
      .then(() => readStructure({ fresh: true }))
      .then((s) => {
        if (s && s !== SKIPPED) say(s.location === n ? `the AM4 is on ${am4LocationCode(n)}` : `the AM4 is on ${am4LocationCode(s.location)}, not ${am4LocationCode(n)}`)
      })
      .catch(() => {})
    return { ok: true }
  }

  async function am4WriteScene(index) {
    if (!Number.isInteger(index) || index < 0 || index >= AM4.SCENES) throw badInput(`There is no scene ${index} on the AM4.`)
    /* Before it goes, as on a gen-3 unit: Edit's block, asked while the scene is on its way, is read after it, never kept from the last scene. */
    moved()
    const r = await fire(buildAm4Scene(index), `scene ${index + 1}`)
    if (rejected(r)) throw refusedBy(r.rejected)
    structure = null
    last.scene = index
    emit({ type: 'scene', index })
    return { ok: true }
  }

  async function am4WriteBypass(eid, bypassed) {
    blockNumber(eid)
    const r = await fire(buildAm4Bypass(eid, bypassed === true), `block ${toHex([eid])} ${bypassed === true ? 'off' : 'on'}`)
    forgetEdits(eid)
    if (rejected(r)) throw refusedBy(r.rejected)
    emit({ type: 'changed', scope: 'grid' })
    return { ok: true }
  }

  /*
   * THE AMP'S OUT BOOST: on an AM4 the amp's pedal on Play is its boost (lib/
   * am4-boost). Written only, at the amp's own code, 0 or 1 exactly: a whole
   * value, never a toggle, and nothing else in the body. There is no read of
   * it over Bluetooth, so the phone shows what it sent.
   */
  async function am4WriteBoost(eid, body) {
    /* The same words as Play's (lib/am4-boost OTHER_AMP_SAYS; a test holds the two together, so this file imports only what it is allowed to). */
    if (eid !== AM4_BLOCKS.amp) throw badInput('The app can’t switch this amp’s boost yet.')
    if (!body || body.continuous !== false || (body.value !== 0 && body.value !== 1)) throw badInput('The boost is set on or off, never anything else.')
    const on = body.value === 1
    const r = await fire(buildAm4AmpBoost(on), `amp boost ${on ? 'on' : 'off'}`)
    if (rejected(r)) throw refusedBy(r.rejected)
    return { ok: true }
  }

  async function am4WriteChannel(eid, channel) {
    blockNumber(eid)
    const c = channelIndex(channel)
    if (c === null) throw badInput(`${channel} is not A, B, C or D.`)
    const r = await fire(buildAm4Channel(eid, c), `block ${toHex([eid])} to ${CH[c]}`)
    forgetEdits(eid)
    if (rejected(r)) throw refusedBy(r.rejected)
    return { ok: true }
  }

  async function am4WriteTempo(value) {
    const bpm = tempoNumber(value)
    const r = await fire(buildAm4Tempo(bpm), `tempo ${bpm}`)
    if (rejected(r)) throw refusedBy(r.rejected)
    /* Read back, as ForgeFX does: within one BPM is taken. */
    const now = await am4TempoNow()
    if (Number.isInteger(now) && Math.abs(now - bpm) > 1) throw failure(`The AM4 stayed at ${now} BPM.`, 502)
    last.bpm = bpm
    emit({ type: 'tempo', bpm })
    return { ok: true }
  }

  /* ---------------- Edit's reads and writes (am4-edit.js) ---------------- */

  /* Every exchange below goes in Edit's own place in the line, after Play's (PRI, editWaits). */
  const EDIT_WRITE = Object.freeze({ priority: 'editWrite' })

  /*
   * THE BLOCK IS IN THE PRESET THE AM4 IS ON, by an answer from just now.
   * Before every one of Edit's frames, because those are held to the blocks
   * the last answer named (am4EditAllowed): a footswitch can have changed
   * the preset since the block was opened, and the frame then goes nowhere
   * rather than to the next song's block of the same kind.
   */
  async function placedHere(code) {
    let s = await readStructure({ priority: 'editRead' })
    if (s && !s.slots) s = await readStructure({ priority: 'editRead', fresh: true })
    if (!s || s === SKIPPED) throw timedOut()
    if (!s.slots) throw failure('The AM4 didn’t say what’s in this preset. Try again in a moment.', 504)
    if (!s.slots.includes(code)) throw failure('That block isn’t in the preset the AM4 is on now.', 409)
    return s
  }

  /* One register's settings, the whole answer: {count, values}, {damaged}, {rejected}, or null when nothing came. */
  const readRegister = (wire, name) =>
    ask(buildAm4ReadAll(wire), null, WAIT.am4ReadAllGap, `the settings of ${name}`, { cap: WAIT.am4ReadAll, collect: readAllCollector(wire), priority: 'editRead' })

  /*
   * GET /preset/blocks/<code>/params, as the computer answers it: the
   * block's on/off and channel (two reads the AM4 has answered all along),
   * then each of its registers read whole, and the knobs on the channel it
   * is on. The block's own register is the read: nothing from it is a fault
   * said on screen. The amp's cab section is a second register: nothing from
   * that one leaves its knobs out, and says so in the log.
   */
  async function am4Params(eid) {
    const code = blockNumber(eid)
    const b = editBlock(code)
    if (!b) throw badInput(`The app can’t open block ${toHex([code])} from here yet.`)
    /* Kept from a moment ago (editKept): nothing to send, or only the registers written since. */
    const kept = editKept.get(code)
    const fresh = !!kept && time.now() - kept.at < EDIT_FRESH_MS && time.now() - kept.whole < EDIT_WHOLE_MS
    if (fresh && !kept.stale.size) return blockParamsOf(code, kept.chunks, { channel: kept.channel, bypassed: kept.bypassed })
    /* A scene or preset changed while this was read: answered, but not kept for the next read, which is the new scene's (moved). */
    const at = moves
    await placedHere(code)
    const started = time.now()
    const ch = fresh ? kept.channel : await am4ChannelNow(code, 'editRead')
    const off = fresh ? kept.bypassed : await am4BypassNow(code, 'editRead')
    const chunks = fresh ? new Map(kept.chunks) : new Map()
    for (const r of readsOf(code)) {
      if (fresh && chunks.has(r.key) && !kept.stale.has(r.key)) continue
      chunks.delete(r.key)
      const name = r.wire === code ? `the ${b.slug}` : `the ${b.slug}’s ${toHex([r.wire])} section`
      const got = await readRegister(r.wire, name)
      const own = r.wire === code
      if (rejected(got)) {
        if (own) throw refusedBy(got.rejected)
        say(`the AM4 refused ${name}: ${rejectedWords(got.rejected)}; its settings are left out`)
        continue
      }
      if (!got) {
        if (own) throw failure(`The AM4 didn’t send the ${b.slug}’s settings. Try again.`, 504)
        say(`no answer for ${name}; its settings are left out`)
        continue
      }
      if (got.damaged) {
        if (own) throw failure(`The ${b.slug}’s settings came back damaged. Try again.`, 502)
        say(`${name} came back damaged; its settings are left out`)
        continue
      }
      chunks.set(r.key, got)
    }
    const channel = Number.isInteger(ch) ? ch : 0
    const bypassed = typeof off === 'boolean' ? off : undefined
    if (moves === at) editKept.set(code, { at: time.now(), whole: fresh ? kept.whole : time.now(), channel, bypassed, chunks, stale: new Set() })
    const out = blockParamsOf(code, chunks, { channel, bypassed })
    say(`read the ${b.slug}’s settings in ${((time.now() - started) / 1000).toFixed(1)} s${fresh ? ' (the register written)' : ''}: ${out.named.length} knobs, channel ${Number.isInteger(ch) ? CH[ch] : 'A (not read)'}`)
    return out
  }

  /*
   * PUT /preset/blocks/<code>/params/<id>: one knob or switch, the frame the
   * computer sends for it. Answered ok when it went; Edit reads the block
   * back to see whether it took, as it does over the computer.
   */
  async function am4WriteKnob(eid, id, body) {
    const at = moves
    const code = blockNumber(eid)
    if (!editBlock(code)) throw badInput(`The app can’t change block ${toHex([code])} from here yet.`)
    const made = knobFrame(code, Number(id), body)
    if (made.refused) throw badInput(made.refused)
    await placedHere(code)
    movedSince(at, made.what)
    const r = await fire(made.frame, made.what, EDIT_WRITE)
    /* Sent or refused, that register is read again next time; the rest of the block is as it was. */
    editKept.get(code)?.stale.add(made.register)
    if (rejected(r)) throw refusedBy(r.rejected)
    return { ok: true }
  }

  /* POST /preset/blocks/<code>/type: the block's model, the computer's own write for it. */
  async function am4WriteModel(eid, value) {
    const at = moves
    const code = blockNumber(eid)
    const made = modelFrame(code, value)
    if (made.refused) throw badInput(made.refused)
    await placedHere(code)
    movedSince(at, made.what)
    const r = await fire(made.frame, made.what, EDIT_WRITE)
    /* A new model is new settings, every one. */
    forgetEdits(code)
    if (rejected(r)) throw refusedBy(r.rejected)
    structure = null
    emit({ type: 'changed', scope: 'grid' })
    return { ok: true }
  }

  /* ---------------- Edit's gen-3 reads and writes (gen3-edit.js, the unit's own catalog) ---------------- */

  /*
   * THE BLOCK IS IN THE PRESET THE UNIT IS ON, by its status answer from
   * just now (STRUCTURE_FRESH_MS), which is also where its channel comes
   * from and what Edit's frames are held to (gen3Sender, statusNow).
   */
  let statusKept = null
  async function gen3PlacedHere(eid) {
    let list = statusKept && time.now() - statusKept.at < STRUCTURE_FRESH_MS ? statusKept.list : null
    if (!list) {
      /* Its channels are the scene's it was read in: not kept past a scene or preset change while it was on its way (moved). */
      const at = moves
      list = await statusNow('editRead')
      if (!Array.isArray(list)) throw failure(`The ${spec.name} didn’t say what’s in this preset. Try again in a moment.`, 504)
      if (moves === at) statusKept = { list, at: time.now() }
    }
    const b = list.find((x) => x.effectId === eid)
    if (!b) throw failure(`That block isn’t in the preset the ${spec.name} is on now.`, 409)
    return b
  }

  /* ---------------- the chain: where the blocks are, a block placed, a cable (lib/gen3-grid, lib/am4-chain) ---------------- */

  /*
   * "I need everything with the chain builder to work over Bluetooth also"
   * (15 November 2026). Four routes, the computer app's own and answered as
   * it answers them, only where the chain is open to this account (chainOn):
   *
   *   GET  /blocks             the blocks this unit can be given
   *   GET  /preset/grid        every cell that holds something, and its cables
   *   PUT  /preset/grid/cell   {row, col, blockId}: a block into a cell (0 empties it), counted from one
   *   POST /preset/grid/cable  {srcRow, srcCol, destRow, connect}: a cable into the next column (never an AM4, which has none)
   *
   * ONE GRID JOB AT A TIME (inGrid), each with its own frames in hand for
   * the way out (withFrames), in Edit's place in the line, after Play's. A
   * write asked before a scene or preset change is not sent after it
   * (movedSince, and moved() drops the ones still waiting): a block meant
   * for one preset never lands in the next.
   *
   * AND A WRITE IS TAKEN ONLY FOR THE CHAIN AS IT WAS LAST READ (chainSeen):
   * the grid has to have been read since the last scene or preset change,
   * or the write is refused before anything is sent. A plan is several
   * requests, each its own, and a preset stepped to by a footswitch after
   * its second step would otherwise get the other seven, each taking the
   * new count as its own. Whoever changes the chain reads it first, so this
   * costs them nothing; after a move they read it again.
   *
   * A REFUSAL IS ANSWERED, NOT THROWN: {ok: false}, as the computer answers
   * one, so a plan of several steps goes on to the rest (a unit with no room
   * left for the fifth block still gets the first four joined up) and
   * whoever asked reads the chain back to see what landed.
   */
  let gridLane = Promise.resolve()
  const inGrid = (run) => {
    const next = gridLane.then(run, run)
    gridLane = next.then(
      () => {},
      () => {}
    )
    return next
  }
  const withFrames = (frames, run) => chainHand.during(frames, run)
  /* What the dump has borne out of the live read on this connection (lib/gen3-grid gridProof), and the grid kept a moment. */
  let gridProved = noProof()
  let gridSaid = ''
  let liveTold = false
  let liveSilent = 0
  /*
   * THE LIVE READ IS TAKEN AND WRITTEN IN THE LOG, AND NOT BELIEVED, until
   * a unit's own log has shown what it says (`liveGrid`, which nothing in
   * the app hands the wire yet; the tests do, so the path stays run). Its
   * layout is the codec's reading of two recordings, an Axe-Fx III's has
   * never been captured, and lib/gen3-grid's proof can be satisfied by one
   * chain on one row. A grid the app acts on (an Undo puts a shunt's id
   * back) is the preset's own, the read the computer uses. So until then
   * it is asked only while the log still wants it: until the proof has
   * settled either way, and not again after two silences.
   */
  const liveSettled = () => gridProved.cells === false || gridProved.rowBit === false || (gridProved.cells === true && typeof gridProved.rowBit === 'number')
  /* And a handful of times at most: an answer this app cannot read at all (an Axe-Fx III's may be one) settles nothing however often it is asked for, and the log has it from the first. */
  let liveAsks = 0
  const LIVE_ASKS_MOST = 4
  const liveWanted = () => liveGrid === true || (liveSilent < 2 && liveAsks < LIVE_ASKS_MOST && !liveSettled())
  /* The count of scene and preset changes the chain was last read at (null: not read on this connection). */
  let gridSeenAt = null
  function chainSeen(what) {
    if (gridSeenAt === moves) return
    if (gridSeenAt === null) {
      /* A wire is made new for each connection: nothing changed on the unit, and the words do not say it did. */
      say(`not sent, the chain has not been read on this connection: ${what}`)
      throw failure('The app has not read the chain on this connection yet. Try it again.', 409)
    }
    say(`not sent, the chain has not been read since the scene or preset last changed: ${what}`)
    throw failure('The scene or preset changed since the app read the chain. Try it again.', 409)
  }
  const movedInRead = () => failure('The scene or preset changed while the app was reading the chain. Try it again.', 409)
  /*
   * WHICH PRESET THE UNIT IS ON, ASKED AT THE END OF A GRID READ. A gen-3
   * unit says nothing when its own footswitch changes preset: the phone
   * learns of it by asking, on a clock, and that clock's questions are
   * skipped while anything else is on the line, which the preset is for
   * eight or sixteen seconds. So a unit stepped on during the read was not
   * counted as moved, the read vouched for the chain (chainSeen), and the
   * first writes of a build went into the preset it had been stepped to.
   * Asked here, off the clock, the move is counted before the read vouches
   * for anything; a unit that will not say is not vouched for either.
   */
  async function gen3PresetAsked(when) {
    const got = await presetNow('editRead')
    if (!got || got === SKIPPED || rejected(got) || !Number.isInteger(got.number)) {
      say(`the unit did not say which preset it is on ${when} the chain was read; the read is not used`)
      throw failure(`The ${spec.name} didn’t say which preset it is on, so the app can’t tell whose chain it read. Try again in a moment.`, 504)
    }
    notePreset(got, true)
  }
  /* The question at the end means something only if the preset was known at the start: on a connection that has not learned it yet, it is asked first. */
  const gen3KnownFirst = () => (last.preset === null ? gen3PresetAsked('before') : null)
  async function gen3StillHere(at) {
    await gen3PresetAsked('after')
    if (moves !== at) {
      say('the scene or preset changed while the chain was being read; the read is not used')
      throw movedInRead()
    }
  }
  /* Kept for a moment, and only while nothing has moved: another preset's is another grid (`moves`), and a write to this one makes it read again (chainChanged). */
  let gridKept = null
  function chainChanged() {
    gridKept = null
    statusKept = null
    forgetEdits()
    if (am4) structure = null
    emit({ type: 'changed', scope: 'grid' })
  }
  const blockNamed = (eid) => blocks.find((b) => b.page === eid)?.name || `Block ${eid}`
  const gen3Palette = () =>
    blocks
      .filter((b) => Number.isInteger(b.page) && typeof b.slug === 'string' && b.slug && !NOT_BLOCKS.includes(b.page))
      .map((b) => ({ slug: b.slug, family: b.family || b.slug, instance: Number.isInteger(b.instance) ? b.instance : 1, name: b.name, page: b.page }))

  /* The live read: its answer as it came, and what this app makes of it (null where it makes nothing). */
  async function gen3LiveGrid() {
    const out = buildGridRead(model)
    const got = await withFrames([out], () =>
      ask(out, (f) => (f[5] === FN.PARAM && f[6] === GRID_SUB.READ && f.length > out.length ? { frame: f } : undefined), WAIT.gridLive, 'where the blocks are', { priority: 'editRead' })
    )
    if (!got || got === SKIPPED || rejected(got)) return { frame: null, live: null }
    return { frame: got.frame, live: parseGridLive(got.frame, model) }
  }

  /* The preset as it is being edited, whole, for the grid in it: the read the computer app uses. */
  async function gen3DumpGrid() {
    /* The request for the preset is no grid frame, so the way out does not hold it to the job in hand: asked here, as the chain's own frames are asked there. */
    if (!chainOn()) throw unsupported()
    const frames = []
    let head = false
    const started = time.now()
    const got = await ask(buildGridDump(model), null, WAIT.gridDumpGap, 'the preset, for where its blocks are', {
      cap: WAIT.gridDumpAll,
      priority: 'editRead',
      collect: (f) => {
        const part = gridDumpPart(f, model)
        if (!part || (part === 'head' && head)) return undefined
        if (part === 'head') head = true
        else if (!head) return undefined
        frames.push(f)
        if (part !== 'foot') return null
        return parseGridDump(frames, model) || { broken: true }
      }
    })
    if (rejected(got)) throw refusedBy(got.rejected)
    if (!got || got === SKIPPED) {
      say(head ? 'gave up on the preset part-way' : `the ${spec.name} did not answer a request for the preset it is on`)
      throw failure(`The ${spec.name} didn’t send its preset, so the app can’t see where its blocks are. Try again in a moment.`, 504)
    }
    if (got.broken) {
      say('the preset came back damaged; not used')
      throw failure(`The ${spec.name}’s preset came back damaged, so the app can’t see where its blocks are. Try again in a moment.`, 504)
    }
    say(`read the preset for its grid in ${((time.now() - started) / 1000).toFixed(1)} s`)
    return got
  }

  /**
   * GET /preset/grid on a gen-3 unit: the live read where the preset has
   * borne it out on this connection, the preset itself where it has not
   * (lib/gen3-grid says why both). Answered as the computer answers it:
   * rows and columns from zero, a shunt by the block id the unit files it
   * under, `fromRows` the rows of the column before that feed a cell.
   */
  function gen3Grid() {
    return inGrid(async () => {
      /* (A grid kept is one read at this same count, so the chain has been seen at it: chainSeen.) */
      if (gridKept && gridKept.moves === moves && time.now() - gridKept.at < STRUCTURE_FRESH_MS) return gridKept.value
      await gen3KnownFirst()
      const at = moves
      const started = time.now()
      const asked = liveWanted()
      const { frame: liveFrame, live } = asked ? await gen3LiveGrid() : { frame: null, live: null }
      if (asked) {
        liveAsks += 1
        liveSilent = liveFrame ? 0 : liveSilent + 1
      }
      /* The live answer itself, once a connection and before the preset is asked for (which a unit may not send down this wire at all): what settles its layout on a unit nobody has read it from. */
      if (liveFrame && !liveTold) {
        liveTold = true
        say(`the live grid answer, as it came: ${toHex(liveFrame)}`)
      }
      let grid = liveGrid === true ? gridFromLive(live, gridProved) : null
      const source = grid ? 'live' : 'preset'
      if (!grid) {
        grid = await gen3DumpGrid()
        /* Is the unit still on the preset these were read from? Asked BEFORE anything is made of the two reads together: a live answer from one preset laid against the next one's grid would settle the proof on nothing, and write "DISAGREES" in the log he reads it from. */
        await gen3StillHere(at)
        if (asked) {
          const { proof, said } = gridProof(gridProved, live, grid)
          gridProved = proof
          if (said !== gridSaid) {
            gridSaid = said
            /* With the preset's own grid beside it, so the two can be laid side by side by hand where they disagree. */
            say(`${said} (the preset has: ${grid.cells.map((c) => `r${c.row + 1}c${c.col + 1} ${c.effectId}${c.fromRows.length ? ` from ${c.fromRows.map((r) => r + 1).join('+')}` : ''}`).join(', ') || 'nothing'})`)
          }
        }
      }
      /* (And where the live read was believed, asked here: a gen-3 unit does not say it has moved, gen3StillHere.) */
      if (source === 'live') await gen3StillHere(at)
      const cells = grid.cells.map((c) => ({ row: c.row, col: c.col, effectId: c.effectId, name: c.isShunt ? `Shunt ${c.effectId - SHUNT_FROM + 1}` : blockNamed(c.effectId), isShunt: c.isShunt, fromRows: c.fromRows }))
      const value = { rows: grid.rows, cols: grid.cols, cells, source }
      gridKept = { value, at: time.now(), moves }
      /* What a write is then held to (chainSeen): the count this read began at and ended at. */
      gridSeenAt = at
      const shunts = cells.filter((c) => c.isShunt).length
      say(`the grid, read ${source === 'live' ? 'live' : 'from the preset'} in ${((time.now() - started) / 1000).toFixed(1)} s: ${cells.length - shunts} block${cells.length - shunts === 1 ? '' : 's'}${shunts ? `, ${shunts} shunt${shunts === 1 ? '' : 's'}` : ''}`)
      return value
    })
  }

  /* A block id a cell may be sent: 0 for empty, a block this unit's own list names, or a shunt (put back by an Undo). */
  const placeable = (id) => {
    if (id === 0) return true
    if (!Number.isInteger(id) || id < 0) return false
    const size = gridSize(model)
    if (id >= SHUNT_FROM) return id < SHUNT_FROM + size.rows * size.cols
    return !NOT_BLOCKS.includes(id) && blocks.some((b) => b.page === id)
  }

  /** PUT /preset/grid/cell on a gen-3 unit: "select the cell", then "put the block in it", the computer's own two frames. */
  async function gen3PlaceCell(body) {
    const at = moves
    const row = body?.row
    const col = body?.col
    const blockId = body?.blockId
    if (!cellOnGrid(model, row, col)) throw badInput(`The ${spec.name}’s grid has no row ${row}, column ${col}.`)
    if (!placeable(blockId)) throw badInput(`Block ${blockId} is not one the app places on the ${spec.name}.`)
    const what = blockId === 0 ? `row ${row}, column ${col} emptied` : `${blockId >= SHUNT_FROM ? 'a shunt' : blockNamed(blockId)} into row ${row}, column ${col}`
    chainSeen(what)
    return inGrid(async () => {
      movedSince(at, what)
      const select = buildGridSelect(model, row, col)
      const put = buildGridPut(model, row, col, blockId)
      let answer
      try {
        answer = await withFrames([select, put], async () => {
          const first = await fire(select, `row ${row}, column ${col} selected`, EDIT_WRITE)
          if (rejected(first)) return first
          /* Asked again between the two: a preset stepped to while the cell was being selected would otherwise get the block (moved() drops only what is already waiting, and the put is not yet). The select alone moves a cursor and nothing else. */
          movedSince(at, what)
          return fire(put, what, EDIT_WRITE)
        })
      } finally {
        chainChanged()
      }
      return rejected(answer) ? { ok: false, refused: rejectedWords(answer.rejected) } : { ok: true }
    })
  }

  /** POST /preset/grid/cable on a gen-3 unit: one cable into the next column, joined or parted. */
  async function gen3Cable(body) {
    const at = moves
    const srcRow = body?.srcRow
    const srcCol = body?.srcCol
    const destRow = body?.destRow
    const join = body?.connect !== false
    const out = buildGridCable(model, srcRow, srcCol, destRow, join)
    if (!out) {
      /* On a six-row grid, out of the top row from an even column is the one cable nobody has decoded (lib/gen3-grid cableKnown). */
      const undecoded = cellOnGrid(model, srcRow, srcCol + 1) && cellOnGrid(model, destRow, srcCol + 1) && !cableKnown(model, srcRow, srcCol, destRow)
      throw badInput(undecoded ? `A cable out of the top row from column ${srcCol} is one the app can’t make on the ${spec.name}. Use another row.` : `The ${spec.name}’s grid has no cable from row ${srcRow}, column ${srcCol} to row ${destRow} of the next column.`)
    }
    const what = `row ${srcRow}, column ${srcCol} ${join ? 'joined to' : 'parted from'} row ${destRow} of column ${srcCol + 1}`
    chainSeen(what)
    return inGrid(async () => {
      movedSince(at, what)
      let answer
      try {
        answer = await withFrames([out], () => fire(out, what, EDIT_WRITE))
      } finally {
        chainChanged()
      }
      return rejected(answer) ? { ok: false, refused: rejectedWords(answer.rejected) } : { ok: true }
    })
  }

  const am4Named = (code) => AM4_PALETTE.find((b) => b.page === code)?.name || am4Block(code)?.slug || `0x${Number(code).toString(16)}`
  /* The AM4's four slots as it has just said them, read again where one answer is not yet believed (believeSlots). */
  /*
   * The same answer says WHICH PRESET they are (its location), and that is
   * heeded: an AM4 stepped to another preset is otherwise only counted as
   * moved by the clock's next question, up to two seconds on, and until
   * then another preset's slots would be read as this one's.
   */
  async function am4SlotsNow(fresh) {
    let s = await readStructure({ priority: 'editRead', fresh })
    if (s && s !== SKIPPED && !s.slots) s = await readStructure({ priority: 'editRead', fresh: true })
    if (!s || s === SKIPPED || !s.slots) return null
    if (Number.isInteger(s.location)) notePreset({ number: s.location, name: s.name }, true)
    return s.slots
  }

  /** GET /preset/grid on an AM4: its four slots in a line, as the computer answers it (row 0, slot 1 at column 0). */
  async function am4Grid() {
    const at = moves
    const slots = await am4SlotsNow(false)
    if (!slots) throw timedOut()
    if (moves !== at) {
      say('the scene or preset changed while the slots were being read; the read is not used')
      throw movedInRead()
    }
    gridSeenAt = at
    const cells = []
    slots.forEach((code, i) => {
      if (code) cells.push({ row: 0, col: i, effectId: code, name: am4Named(code), isShunt: false, fromRows: [] })
    })
    return { rows: 1, cols: AM4_SLOTS, cells, source: 'preset' }
  }

  /**
   * PUT /preset/grid/cell on an AM4: a block's code into slot `col` (1 to
   * 4; the row is not used, as on the computer), 0 to empty it. The AM4
   * answers this write with nothing, so the preset is read back a moment
   * later and the slot itself says whether it took.
   */
  async function am4PlaceSlot(body) {
    const at = moves
    const slot = body?.col
    const code = body?.blockId
    const out = buildAm4Slot(slot, code)
    if (!out) throw badInput(Number.isInteger(slot) && slot >= 1 && slot <= AM4_SLOTS ? `Block ${code} is not one the app places on the AM4.` : `The AM4 has no slot ${slot}.`)
    const what = code === 0 ? `slot ${slot} emptied` : `${am4Named(code)} into slot ${slot}`
    chainSeen(what)
    return inGrid(async () => {
      movedSince(at, what)
      let answer
      try {
        answer = await withFrames([out], () => fire(out, what, EDIT_WRITE))
      } finally {
        chainChanged()
      }
      if (rejected(answer)) return { ok: false, refused: rejectedWords(answer.rejected) }
      await pause(WAIT.landed)
      const slots = await am4SlotsNow(true)
      if (!slots) {
        say(`${what}: the AM4 did not say what its slots hold afterwards`)
        return { ok: true, unread: true }
      }
      /* A preset stepped to since: these are another preset's slots, and say nothing of where the write went. */
      if (moves !== at) {
        say(`${what}: the scene or preset changed before the slots were read back, so they are not taken as its answer`)
        return { ok: true, unread: true }
      }
      const holds = slots[slot - 1]
      say(holds === code ? `${what}: the AM4 says so` : `${what}: the AM4 says slot ${slot} holds ${holds ? am4Named(holds) : 'nothing'}`)
      /* And what was just read is not kept: whoever asks next which preset the AM4 is on (a build asks before its every step) is answered by the unit, not by this answer a moment old. */
      structure = null
      return holds === code ? { ok: true } : { ok: false, refused: `slot ${slot} holds ${holds ? am4Named(holds) : 'nothing'}` }
    })
  }

  /*
   * GET /preset/blocks/<eid>/params on a gen-3 unit, as the computer answers
   * it: the block's channel from the status answer, the block read whole, and
   * its knobs on that channel, named by the unit's own catalog. Kept a moment
   * as an AM4's are (editKept); a gen-3 block is one register, so a write has
   * it read whole again.
   */
  async function gen3Params(eid) {
    const e = blockNumber(eid)
    /* The unit's Edit for this request, taken once (g3: with the III's NAM in it or not), so one read is named by one catalog from start to end; the way out asks again at each send. */
    const ed = g3()
    const b = ed.editBlock(e)
    if (!b) throw badInput(`The app can’t open block ${e} from here yet.`)
    const kept = editKept.get(e)
    if (kept && !kept.stale.size && time.now() - kept.at < EDIT_FRESH_MS && time.now() - kept.whole < EDIT_WHOLE_MS) {
      return ed.blockParamsOf(e, kept.bulk, { channel: kept.channel })
    }
    const started = time.now()
    /* As on an AM4: a scene or preset changed while this was read, and it is answered but not kept (moved). */
    const at = moves
    const st = await gen3PlacedHere(e)
    const got = await ask(g3Edit.buildReadAll(model, e), null, WAIT.gen3ReadAllGap, `the settings of the ${b.name}`, {
      cap: WAIT.gen3ReadAll,
      /* A read that has not begun in a second is given up, and the line goes to what is waiting (WAIT.gen3ReadAllFirst). */
      firstMs: WAIT.gen3ReadAllFirst,
      collect: g3Edit.readAllCollector(model, e),
      priority: 'editRead'
    })
    if (rejected(got)) throw refusedBy(got.rejected)
    if (!got) throw failure(`The ${spec.name} didn’t send the ${b.name}’s settings. Try again.`, 504)
    if (got.damaged) throw failure(`The ${b.name}’s settings came back damaged. Try again.`, 502)
    if (moves === at) editKept.set(e, { at: time.now(), whole: time.now(), channel: st.channel, bulk: got, stale: new Set() })
    const out = ed.blockParamsOf(e, got, { channel: st.channel })
    /* And where the channel was cut from: the unit's count, the values that came, how many a channel and where this one starts (gen3-edit sliceOf). A read sliced in the wrong place is a knob that "didn't take" on every channel but A, and the log could not say so. */
    const cut = ed.sliceFor(e, got, { channel: st.channel })
    say(
      `read the ${b.name}’s settings in ${((time.now() - started) / 1000).toFixed(1)} s: ${out.named.length} knobs, channel ${CH[st.channel] ?? st.channel}` +
        `; the unit said ${got.count} values and sent ${got.values.length}, ${cut.stride} a channel, ${cut.channels} channel${cut.channels === 1 ? '' : 's'}, this one from value ${cut.base}`
    )
    return out
  }

  /* PUT /preset/blocks/<eid>/params/<id> on a gen-3 unit: one knob or switch, the computer's frame for it. */
  async function gen3WriteKnob(eid, id, body) {
    const at = moves
    const e = blockNumber(eid)
    const ed = g3()
    if (!ed.editBlock(e)) throw badInput(`The app can’t change block ${e} from here yet.`)
    const made = ed.knobFrame(model, e, id, body)
    if (made.refused) throw badInput(made.refused)
    /* The typed way asked of a knob, which a gen-3 knob is never sent (gen3-edit ONE WAY ONLY): nothing goes, and it is answered as not sent rather than refused, so the checked write (lib/device setParamConfirmed) goes no further with it and says what its own check read. */
    if (made.unsent) {
      say(`${made.unsent}: nothing sent`)
      return { ok: false, unsent: true }
    }
    await gen3PlacedHere(e)
    movedSince(at, made.what)
    const r = await fire(made.frame, made.what, EDIT_WRITE)
    editKept.get(e)?.stale.add('block')
    if (rejected(r)) throw refusedBy(r.rejected)
    return { ok: true }
  }

  /* POST /preset/blocks/<eid>/type on a gen-3 unit: the block's model, the computer's own write for it. */
  async function gen3WriteModel(eid, value) {
    const at = moves
    const e = blockNumber(eid)
    const made = g3().modelFrame(model, e, value)
    if (made.refused) throw badInput(made.refused)
    await gen3PlacedHere(e)
    movedSince(at, made.what)
    const r = await fire(made.frame, made.what, EDIT_WRITE)
    forgetEdits(e)
    if (rejected(r)) throw refusedBy(r.rejected)
    emit({ type: 'changed', scope: 'grid' })
    return { ok: true }
  }

  /*
   * GET /reader/blocks: what the reader may be pointed at, out of the
   * unit's own list of what is in its preset now. Every block but the ids
   * that are not blocks (NOT_BLOCKS: the Controllers, the Foot Controller,
   * the Performance page, the RTA),
   * each with the name the catalog has for it, or none, and whether Edit
   * already has its knobs: the ones it has none for come first, and one it
   * does have is there to check the reader against what is already known.
   */
  async function gen3ReaderList() {
    const list = await statusNow('editRead')
    if (rejected(list)) throw refusedBy(list.rejected)
    if (!Array.isArray(list)) throw timedOut()
    const states = list.filter((b) => !NOT_BLOCKS.includes(b.effectId)).map((b) => ({ effectId: b.effectId, bypassed: b.bypassed, channel: channelLetter(b.channel) }))
    const names = new Map((outlineChain(states, blocks) || []).map((b) => [b.effectId, b.name]))
    return states
      .map((b) => ({ effectId: b.effectId, name: names.get(b.effectId) || null, known: !!g3().editBlock(b.effectId) }))
      .sort((x, y) => Number(x.known) - Number(y.known) || x.effectId - y.effectId)
  }

  /*
   * THE DEVELOPER'S READER: GET /reader/blocks/<eid>, his account's alone.
   * A block the unit has just listed in its preset, read whole (the read
   * Edit sends) and then asked to describe its own settings, one question
   * at a time (lib/gen3-describe: only questions, fewer than the computer's
   * walk asks, and it stops at the second in a row with no answer). For the
   * blocks no catalog names yet: the Axe-Fx III's NAM. Nothing is written,
   * nothing is kept, and Play's own messages go ahead of it.
   */
  async function gen3Describe(eid) {
    const e = blockNumber(eid)
    if (NOT_BLOCKS.includes(e)) throw badInput(`Block ${e} is not one the reader asks about.`)
    const list = await statusNow('editRead')
    if (!Array.isArray(list)) throw failure(`The ${spec.name} didn’t say what’s in this preset. Try again in a moment.`, 504)
    const st = list.find((b) => b.effectId === e)
    if (!st) throw failure(`That block isn’t in the preset the ${spec.name} is on now.`, 409)
    const started = time.now()
    let bulk
    readerOpen = e
    try {
      const got = await ask(fm3Edit.buildReadAll(model, e), null, WAIT.gen3ReadAllGap, `the whole of block ${e}`, {
        cap: WAIT.gen3ReadAll,
        collect: fm3Edit.readAllCollector(model, e),
        priority: 'editRead'
      })
      bulk = rejected(got) ? { note: `refused (${rejectedWords(got.rejected)})` } : !got ? { note: 'no answer' } : got.damaged ? { note: 'came back damaged' } : got
    } catch (err) {
      bulk = { note: err?.message || 'not sent' }
    } finally {
      readerOpen = null
    }
    const out = await describeBlock({
      model,
      block: e,
      pause,
      ask: async (q) => {
        /* The one way out for the reader's questions, asked again here where they leave. */
        if (!describeAllowed(q, model)) return { refused: 'not one of the reader’s questions' }
        const echo = describeEcho(q)
        let back = null
        try {
          back = await ex(q, { match: (f) => (echo(f) ? f : undefined), ms: ANSWER_MS, fn: FN.PARAM, what: `block ${e}’s own account of itself`, priority: 'editRead' })
        } catch {
          /* Not sent (the line went, or the sender would not take it): the same as no answer, and two of those end the walk. */
          return null
        }
        if (rejected(back)) return { refused: rejectedWords(back.rejected) }
        return Array.isArray(back) ? back : null
      }
    })
    say(`the reader asked block ${e} ${out.asked} questions in ${((time.now() - started) / 1000).toFixed(1)} s: ${out.settings.length} settings${out.stopped ? `, stopped: ${out.stopped}` : ''}`)
    return { ...out, bulk, channel: st.channel, channels: st.channels, bypassed: st.bypassed, unit: spec.name }
  }

  /*
   * AN AXE-FX III'S NAM CAPTURES, FROM THE PHONE (lib/nam-install, which has
   * the messages and where they came from: a recording of Axe-Edit III
   * loading one, 13 November 2026). His account's alone, and only when the
   * request says it is theirs.
   *
   *   GET  /nam/empty               the first empty slot, read from slot 001
   *                                 up, stopping at the first that says
   *                                 <EMPTY>
   *   POST /nam/slots/<slot>        { words, replace }: a capture's record
   *                                 into that slot
   *   POST /nam/blocks/<eid>/slot   { slot }: NAM 1 or NAM 2 pointed at it
   *
   * AN UPLOAD IS AXE-EDIT'S, MESSAGE FOR MESSAGE: "a transfer is under way",
   * the 130 messages each sent only when the unit has answered the one
   * before, "it is over". A slot is read first and is only written when it
   * says <EMPTY>, unless the request says to replace what is there. A unit
   * that stops answering part-way has been sent part of a capture: the
   * failure says so, and that the same slot should be sent again.
   */
  const captureRun = async (going, run) => {
    if (!captureOn()) throw unsupported()
    if (captureTurn) throw failure('The capture tools are already at work. Try again in a moment.', 409)
    captureTurn = true
    capturing = going
    try {
      return await run()
    } finally {
      captureTurn = false
      capturing = null
      captureBusy = false
      /* Anything a capture held back goes now, however the capture ended. */
      pump()
    }
  }

  /*
   * A SLOT'S ANSWER DOES NOT SAY WHICH SLOT IT IS: only its order does. So
   * after one goes unanswered, no slot is asked until its answer can no
   * longer come (LATE_MS, as after a stored name on an AM4): the next
   * question, of any slot and from anyone (the list, the slot a block is
   * on, the first empty slot, an upload's own looks at its slot), would be
   * handed the late one, and a name would be filed under the wrong slot.
   * An answer that arrives during the wait has nobody waiting and is
   * dropped.
   */
  let namQuietUntil = 0
  /* When a slot's question last left the phone, answered or not: what the quiet after a slot asked again is counted from (namSlotSure), and how late a stray answer is said to be (unasked). */
  let namAskedAt = 0
  /* What is left of that quiet, waited out: never longer than the longest quiet there is (a slot asked again, namSlotSure), whatever the clock does. */
  const namQuiet = async () => {
    const wait = Math.min(namQuietUntil - time.now(), WAIT.namSlot + LATE_MS)
    if (wait > 0) await pause(wait)
  }
  /*
   * HOW FAR UP FROM THE FIRST SLOT EVERY SLOT HAS READ FULL, ON THIS
   * CONNECTION: -1 for none. Kept by every slot's read, whoever asked it
   * (the search, the list, an upload's own looks), and it is all the search
   * for an empty slot remembers: where to start.
   *
   * His Axe-Fx III has thirty-odd captures in a row from the first slot
   * (15 November 2026), so every Preview and Get began with thirty-odd
   * questions over Bluetooth, about ten seconds of them, and one that went
   * unanswered threw all of it away: four taps, each starting again at the
   * first slot, each stopped at a different one, none ever reaching an
   * empty slot. Now a search goes on from where the last one got to.
   *
   * ONLY "FULL", NEVER "EMPTY", AND NEVER KEPT PAST THE CONNECTION. The slot
   * the search answers is one it has just read, and an upload reads its slot
   * again and writes only where that says <EMPTY> (namInstall), so nothing
   * is written on the strength of this. The worst a wrong "full" can do is
   * pass over a slot emptied on the unit since (on its front panel, or from
   * Axe-Edit): the capture goes into a later empty slot, where Axe-Edit
   * would have taken the first. A slot under the mark that reads <EMPTY>
   * (to the list, say) brings the mark back down to it, and a search that
   * finds no empty slot above the mark reads the ones under it again before
   * it says there is none (namEmptySlot).
   */
  let namFullTo = -1
  async function namSlotHead(slot) {
    await namQuiet()
    /*
     * WHEN THE QUESTION LEFT THE PHONE, not when it was asked for (`sent`,
     * told by pump as it goes). A search's question is Edit's kind of read,
     * and after a scene or preset change those wait for Play, two seconds
     * and more: counted from the asking, the quiet after a slot asked again
     * ended that much before its answer's time was up, and the next slot
     * took the answer (found in the second review, with a scene tapped in
     * the quiet, before it went out).
     */
    const got = await ex(namSlotQuery(model, slot), { match: (f) => readNamSlot(f, model) || undefined, ms: WAIT.namSlot, fn: FN.PARAM, what: `capture slot ${namSlotSaid(slot)}`, priority: 'editRead', capture: true, sent: (at) => (namAskedAt = at) })
    if (rejected(got)) throw failure(`The ${spec.name} would not say what is in capture slot ${namSlotSaid(slot)} (${rejectedWords(got.rejected)}). Its firmware may be older than the NAM block.`, 502)
    if (!got) {
      namQuietUntil = time.now() + LATE_MS
      throw failure(`The ${spec.name} didn’t say what is in capture slot ${namSlotSaid(slot)}.`, 504)
    }
    if (got.empty) {
      if (slot <= namFullTo) namFullTo = slot - 1
    } else if (slot === namFullTo + 1) namFullTo = slot
    return got
  }

  /*
   * A SLOT ASKED AGAIN WHEN IT SAYS NOTHING, up to NAM_SLOT_ASKS times in
   * all: for the search for an empty slot and an upload's first look at its
   * slot, where one unanswered question used to end the whole errand. (The
   * list asks again by itself, lib/captureList, and is left as it is.)
   *
   * Asking a slot is only a read, so asking it again changes nothing on the
   * unit. THE QUIET IS KEPT, TWICE. Before it is asked again, the quiet
   * after the silence is waited out as ever (namSlotHead), so the answer
   * that was only late cannot be handed to the next question. And after a
   * slot asked again has answered, no OTHER slot is asked until that last
   * asking's own answer can no longer come either: the answer taken may
   * have been the first question's, later than anything allowed for, and
   * then the second question's own answer is still on its way with nobody
   * waiting. Both answers are this slot's, so this slot is never misfiled;
   * the next slot, asked at once, would have been handed the second one,
   * and every slot after it read one late.
   *
   * THAT QUIET IS COUNTED FROM WHEN THE SLOT'S QUESTION LAST LEFT THE
   * PHONE (namAskedAt), not from when an answer was taken: the wait and
   * the quiet from the asking, which is how long an answer is allowed for
   * everywhere else here. Counted from
   * the answer (the first cut), an answer taken a tenth of a second after
   * the second asking left the next slot asked two seconds later, with the
   * second asking's own answer still allowed two and a half more: handed
   * that answer, an empty slot read as full, and was passed over for the
   * rest of the connection (found in review, with a stand-in unit, before
   * it went out). A lost answer costs some four seconds more for it.
   *
   * A slot that refuses (502) is not asked again: that is an answer.
   *
   * `held`, for an upload's first look: told true before each asking and
   * false after a silence, so the upload's hold on the line is not kept
   * through the quiet before the slot is asked again (namInstall).
   */
  async function namSlotSure(slot, onAgain, held) {
    for (let n = 1; ; n++) {
      try {
        if (held) {
          await namQuiet()
          held(true)
        }
        const head = await namSlotHead(slot)
        if (n > 1) namQuietUntil = Math.max(namQuietUntil, namAskedAt + WAIT.namSlot + LATE_MS)
        return head
      } catch (err) {
        if (held) held(false)
        if (err?.status !== 504) throw err
        if (n >= NAM_SLOT_ASKS) throw failure(`The ${spec.name} didn’t say what is in capture slot ${namSlotSaid(slot)}, asked ${n} times.`, 504, { slot, asked: n })
        say(`asking capture slot ${namSlotSaid(slot)} again (${n + 1} of ${NAM_SLOT_ASKS})`)
        try {
          if (typeof onAgain === 'function') onAgain(n + 1)
        } catch {
          // A screen that has gone cannot stop the search it started.
        }
      }
    }
  }

  /*
   * THE FIRST EMPTY SLOT, from where this connection has read every slot
   * full (namFullTo), each slot asked again if it says nothing
   * (namSlotSure). `from` is the first slot it asked: the heads are only
   * the ones read this time. `onProgress(slot, again)` is told the slot
   * about to be asked, and which asking of it this is when it is not the
   * first, for the line on the screen: thirty-odd questions over Bluetooth
   * are ten seconds, and the screen said nothing in them.
   *
   * "NONE EMPTY" IS ONLY EVER SAID OF SLOTS READ IN THIS SEARCH. Where the
   * search began past the first slot and found nothing empty above, the
   * slots under where it began are read too before it answers: one may
   * have been cleared on the unit since it read full, which is what the
   * screen then tells the player to do ("Clear one on the unit, then send
   * again"). The first cut answered "all taken" from the mark alone, and
   * once every slot had read full it asked the unit nothing ever again on
   * that connection (found in review before it went out). Then `from` is
   * the first slot and the heads are all of them, in order.
   */
  const namEmptySlot = (onProgress) =>
    captureRun({ list: true }, async () => {
      let heads = []
      let from = Math.min(namFullTo + 1, NAM_SLOT_PROVEN_MOST + 1)
      const started = time.now()
      let again = 0
      /* How many slots have answered in this search, whichever part of it read them. */
      let answered = 0
      /* Where a search asked for now would begin: after what has read full, or at the first slot once that is all of them. */
      const next = () => (namFullTo + 1 > NAM_SLOT_PROVEN_MOST ? 0 : namFullTo + 1)
      const tell = (slot, n) => {
        try {
          if (typeof onProgress === 'function') onProgress(slot, n)
        } catch {
          // A screen that has gone cannot stop the search it started.
        }
      }
      const done = (found) => {
        say(`looked for an empty capture slot from ${namSlotSaid(from)}: ${answered} answered in ${((time.now() - started) / 1000).toFixed(1)} s${again ? `, ${again} asked again` : ''}; ${found === null ? `none empty up to ${namSlotSaid(NAM_SLOT_PROVEN_MOST)}` : `${namSlotSaid(found)} is empty`}`)
        return { slot: found, heads, from }
      }
      /* The slots from `a` to `b`, in order, up to the first that says <EMPTY>: that slot, or null. */
      const look = async (a, b) => {
        for (let slot = a; slot <= b; slot++) {
          tell(slot, 1)
          let head
          try {
            head = await namSlotSure(slot, (n) => {
              again++
              tell(slot, n)
            })
          } catch (err) {
            if (err?.status === 504 && err?.asked) {
              /* "On this connection": what has read full is not kept past it (namFullTo), and the screen's words promise no slot. */
              say(`gave up looking for an empty capture slot at ${namSlotSaid(slot)}: ${answered} answered in ${((time.now() - started) / 1000).toFixed(1)} s; the next search on this connection starts at ${namSlotSaid(next())}`)
              throw failure(`${err.message} Nothing was sent. Tap again to keep looking.`, 504, { slot, asked: err.asked })
            }
            throw err
          }
          heads.push({ slot, name: head.name, empty: head.empty })
          answered++
          if (head.empty) return slot
        }
        return null
      }
      let found = await look(from, NAM_SLOT_PROVEN_MOST)
      if (found === null && from > 0) {
        const under = from - 1
        say(`${from > NAM_SLOT_PROVEN_MOST ? `every capture slot up to ${namSlotSaid(NAM_SLOT_PROVEN_MOST)} has read full on this connection` : `no capture slot is empty from ${namSlotSaid(from)} up`}: reading ${under === 0 ? namSlotSaid(0) : `${namSlotSaid(0)} to ${namSlotSaid(under)}`} again, in case one has been cleared on the unit`)
        const above = heads
        heads = []
        from = 0
        found = await look(0, under)
        heads = [...heads, ...above]
      }
      return done(found)
    })

  /*
   * GET /nam/heads/<from>/<count>: some of the slots' heads, in order, for
   * the picker in Edit. Each slot is asked as Axe-Edit asks it when it reads
   * its list, one question a slot, and a piece is one turn of the capture
   * tools: the picker asks for the list a piece at a time, so a pick, a tap
   * on Play and the footswitch watch each get in between two.
   *
   * A SLOT THAT SAYS NOTHING ENDS THE PIECE THERE (`stopped`). A slot's answer
   * does not say which slot it is, so after one that was not answered in time
   * the next slot's question could be handed the answer that came late: no
   * slot is asked until it can no longer come (namSlotHead), and the picker
   * asks from that slot again.
   *
   * It reads and nothing else: no "a transfer is under way", so nothing is
   * held back for it (a list read never sets captureBusy).
   */
  function namHeads(from, count) {
    if (!Number.isInteger(from) || from < 0 || from >= NAM_SLOTS) throw badInput('There is no such capture slot.')
    if (!Number.isInteger(count) || count < 1 || count > NAM_HEADS_MOST) throw badInput(`The list is read ${NAM_HEADS_MOST} slots at a time at most.`)
    return captureRun({ list: true }, async () => {
      const heads = []
      for (let slot = from; slot < Math.min(NAM_SLOTS, from + count); slot++) {
        let head
        try {
          head = await namSlotHead(slot)
        } catch (err) {
          if (err?.status === 504) return { from, heads, stopped: slot }
          throw err
        }
        heads.push({ slot, name: head.name, by: head.by, make: head.make, model: head.model, gearType: head.gearType, toneType: head.toneType, empty: head.empty })
      }
      return { from, heads }
    })
  }

  function namInstall(slot, body, onProgress) {
    const words = body?.words
    if (!Number.isInteger(slot) || slot < 0 || slot > NAM_SLOT_PROVEN_MOST) throw badInput(`A capture can go into slots 001 to ${namSlotSaid(NAM_SLOT_PROVEN_MOST)} from here.`)
    if (!Array.isArray(words) || words.length !== NAM_RECORD_WORDS || !words.every((w) => Number.isInteger(w) && w >= 0 && w <= 0xffffffff)) throw badInput('That isn’t a capture’s record.')
    const said = namSlotSaid(slot)
    const frames = namUploadFrames(model, slot, words)
    const on = namBusyFrame(model, true)
    const off = namBusyFrame(model, false)
    const busy = (f) => (namBusyAnswer(f, model) ? true : undefined)
    return captureRun({ list: true, frames: [on, off, ...frames] }, async () => {
      /* What is left of the quiet after a slot said nothing is waited out BEFORE the hold is taken: nothing is going to the unit during it, and a tap should not be refused for it. No other slot question can start a new quiet meanwhile: this run has the capture tools. */
      await namQuiet()
      const started = time.now()
      /*
       * Held from the slot's own read on, as the computer holds it: nothing
       * goes between that read and the start either. captureRun lets go
       * however this ends. The slot is asked again if it says nothing
       * (namSlotSure): nothing has been written yet, and nothing is until
       * this slot has said <EMPTY>. THE HOLD IS LET GO OF AT EACH SILENCE
       * AND TAKEN AGAIN AT THE NEXT ASKING, as it is not taken for the
       * first quiet above: kept through three askings it refused every tap
       * for eleven seconds in which nothing went to the unit but a slot's
       * question (found in review before it went out).
       */
      const hold = (on) => {
        captureBusy = on
        /* What a silence held back goes now, in the quiet. */
        if (!on) pump()
      }
      const before = await namSlotSure(slot, null, hold).catch((err) => {
        if (err?.status === 504 && err?.asked) throw failure(`${err.message} Nothing was sent.`, 504, { slot, asked: err.asked })
        throw err
      })
      if (!before.empty && body?.replace !== true) throw failure(`Capture slot ${said} already holds “${before.name}”. Nothing was sent.`, 409, { holds: before.name })
      const told = await ex(on, { match: busy, ms: WAIT.namSlot, fn: FN.PARAM, what: 'that a capture is coming', priority: 'write', capture: true })
      if (rejected(told)) throw failure(`The ${spec.name} refused the start of the transfer (${rejectedWords(told.rejected)}). Nothing was sent.`, 502)
      if (!told) {
        /*
         * The unit may have TAKEN "a transfer is under way" and its answer
         * been lost: left at that, nothing the app sends later says it is
         * over (the next capture begins with another "under way"), and what
         * a unit does while left there is not known. Axe-Edit always pairs
         * the two, so "it is over" is said before giving up.
         */
        await ex(off, { match: busy, ms: WAIT.namSlot, fn: FN.PARAM, what: 'that the capture is over', priority: 'write', capture: true }).catch(() => null)
        throw failure(`The ${spec.name} didn’t answer the start of the transfer. Nothing was sent.`, 504)
      }
      let sent = 0
      /* When the unit answered the last message: how long the send took, without the rests and the read-back after it. */
      let took = null
      /*
       * How long the unit took to answer the closing message, in ms, for the
       * log. In the recording his unit took 272 over USB, against under 3 on
       * average and never over 28 for the messages before it: most likely
       * the time it spent filing the capture (not proven). One answered as
       * fast as the rest was likely not filed, which is worth knowing when a
       * slot reads back empty.
       */
      let closing = null
      let after = null
      const readBack = () => namSlotHead(slot).catch(() => null)
      try {
        try {
          /* The moment Axe-Edit left between the unit's answer and the opening message. */
          await pause(NAM_REST.begin)
          for (const f of frames) {
            const asked = time.now()
            const again = sent > 0 ? ` Slot ${said} may hold part of a capture now: send it again to the same slot.` : ' Nothing was kept.'
            const a = await ex(f, {
              match: (g) => {
                const x = namAnswer(g, model)
                return x && x.fn === f[5] ? x : undefined
              },
              ms: WAIT.namChunk,
              what: `message ${sent + 1} of ${frames.length} of a capture`,
              priority: 'write',
              capture: true
            }).catch((err) => {
              /* The line went part-way (the adapter dropped, Bluetooth was switched off): said like a unit that stopped answering, with the slot it may have left half-filled. */
              throw failure(`${err?.message || 'The connection was lost.'} That was after ${sent} of ${frames.length} messages.${again}`, err?.status || 503, { partial: sent > 0, slot })
            })
            if (!a) throw failure(`The ${spec.name} stopped answering after ${sent} of ${frames.length} messages.${again}`, 504, { partial: sent > 0, slot })
            if (!a.ok) throw failure(`The ${spec.name} refused the capture at message ${sent + 1} of ${frames.length} (it answered ${a.code}).${again}`, 502, { partial: sent > 0, slot })
            sent++
            if (sent === frames.length) {
              took = time.now()
              closing = took - asked
            }
            try {
              if (typeof onProgress === 'function') onProgress(sent, frames.length)
            } catch {
              // A screen that has gone cannot stop the upload it started.
            }
          }
        } finally {
          /* "It is over", whether it went or not, as Axe-Edit says it after the last message, and after the moment Axe-Edit left first. */
          await pause(NAM_REST.over)
          await ex(off, { match: busy, ms: WAIT.namSlot, fn: FN.PARAM, what: 'that the capture is over', priority: 'write', capture: true }).catch(() => null)
        }
        /*
         * The slot read back, after the rest Axe-Edit took before it read
         * its list (a third of a second, with nothing sent in it). STILL
         * HELD: the first thing the unit hears after "it is over" is the
         * slot's question, as it was Axe-Edit's, and what was asked
         * meanwhile goes after that.
         */
        await pause(NAM_REST.read)
        after = await readBack()
      } finally {
        captureBusy = false
        /* What was asked meanwhile goes now. */
        pump()
      }
      /*
       * A slot that still says <EMPTY>, or says nothing (a unit still
       * filing it is as likely to do one as the other), is asked once more
       * a second later before it is called not kept: nothing is known of
       * how long a unit takes to file a capture that arrived over half a
       * minute. What the first read said stands if the second says nothing.
       */
      if (!after || after.empty) {
        await pause(NAM_REST.again)
        after = (await readBack()) || after
      }
      const seconds = ((took ?? time.now()) - started) / 1000
      /* A slot that still reads empty after every message was taken was not kept: said so here, and by the card. */
      const reads = !after ? 'the slot did not read back' : after.empty ? `the slot STILL READS “${after.name}”: the unit took every message and did not keep it` : `the slot now reads “${after.name}”`
      /* How long the name is goes in the log with its check byte: the recording proves the byte for a name that fills all 31 places, and a shorter one is the same rule on trust. */
      let named = 0
      while (named < 31 && ((words[named >> 2] >>> ((named & 3) * 8)) & 0xff) !== 0) named++
      /* A name filled out with spaces to all 31 places (namRecord's `fill`) is said so: which shape a unit kept is the thing to know. The request says it; read off the name's last place, a long name cut at a space said it too. */
      const filledOut = body?.filled === true
      say(`a capture went to slot ${said} in ${seconds.toFixed(1)} s, ${frames.length} messages, its name ${named} characters${filledOut ? ' (filled out with spaces)' : ''}, check byte 0x${((words[7] >>> 24) & 0xff).toString(16).padStart(2, '0')}, the closing message answered in ${closing ?? '?'} ms: ${reads}`)
      /* `nameByte`: the 32nd byte of the name as it went (the wire sends the record as packed). `closing`: how long the unit took over the closing message, in ms. Both for the sender's log (lib/captureSend); the computer answers the same two. */
      return { slot, name: after ? after.name : null, replaced: before.empty ? null : before.name, seconds, nameByte: (words[7] >>> 24) & 0xff, closing }
    })
  }

  function namPick(eid, body) {
    const slot = body?.slot
    if (!NAM_BLOCKS.includes(eid)) throw badInput('Only a NAM block plays a capture.')
    if (!Number.isInteger(slot) || slot < 0 || slot >= NAM_SLOTS) throw badInput('There is no such capture slot.')
    const which = `NAM ${NAM_BLOCKS.indexOf(eid) + 1}`
    return captureRun({ pick: { block: eid, slot } }, async () => {
      const list = await statusNow('editRead')
      if (!Array.isArray(list)) throw failure(`The ${spec.name} didn’t say what’s in this preset. Try again in a moment.`, 504)
      if (!list.some((b) => b.effectId === eid)) throw failure(`${which} isn’t in the preset the ${spec.name} is on now.`, 409)
      const got = await ex(namPickFrame(model, eid, slot), { match: (f) => readNamPick(f, model, eid) || undefined, ms: WAIT.namSlot, fn: FN.PARAM, what: `${which} pointed at capture slot ${namSlotSaid(slot)}`, priority: 'write', capture: true })
      /* Whatever came back, the block's kept read is no longer to be trusted: a pick with no answer may still have landed, and Edit's next read must be the unit's. */
      forgetEdits(eid)
      if (rejected(got)) throw failure(`The ${spec.name} refused it (${rejectedWords(got.rejected)}).`, 502)
      if (!got) throw failure(`The ${spec.name} didn’t answer, so ${which} may not have changed.`, 504)
      if (got.slot !== slot) throw failure(`The ${spec.name} says ${which} is on capture slot ${namSlotSaid(got.slot)}, not ${namSlotSaid(slot)}.`, 502)
      say(`${which} is on capture slot ${namSlotSaid(slot)} now: “${got.name}”`)
      return { block: eid, slot: got.slot, name: got.name }
    })
  }

  async function am4TunerTick(run) {
    const values = []
    try {
      for (const which of [1, 2, 3, 4]) {
        const v = await ex(buildAm4TunerPoll(which), { match: (f) => parseAm4TunerPoll(f, which), ms: WAIT.am4Tuner, fn: FN.PARAM, priority: 'poll' })
        if (v === SKIPPED || !tuner.on || tuner.run !== run) break
        values.push(typeof v === 'number' ? v : null)
      }
    } catch {
      return
    }
    if (values.length === 4 && tuner.on && tuner.run === run) {
      const [index, hz, cents] = values
      /* A set with a reading missing is skipped, not drawn half-known. */
      if (index !== null && hz !== null && cents !== null) {
        tuner.polled++
        if (!(hz > 0)) reading(silentTuner())
        else {
          const n = am4Note(index)
          reading({ type: 'tuner', freq: Math.round(hz * 100) / 100, note: n.note, octave: n.octave, cents: Math.round(cents) })
        }
      }
    }
    if (tuner.on && tuner.run === run) {
      try {
        await keepUnitTuner(run)
      } catch {
        /* The adapter went, or the 127 was refused: the readings go on, and the next one is tried in its time. */
      }
    }
    tunerLater(run, TUNER_MS, () => am4TunerTick(run))
  }

  /*
   * THE AM4'S OWN TUNER, ON THE UNIT ITSELF.
   *
   * "On the AM4 the tuner doesn't activate on the device, it only shows it on
   * the phone ... I know that it has MIDI support for activating and
   * deactivating a tuner because I have a MIDI device that does it. Works
   * fine on the FM3." The readings never needed the tuner screen open, so
   * the phone tuned and the AM4 sat on its preset. What his pedal sends is
   * the Control Change under SETUP > MIDI/Remote > Tuner: 127 to open, 0 to
   * close.
   *
   * That number is the player's own choice, with no factory one, so it is
   * read from the AM4 each time the tuner opens, never guessed: a number
   * that means something else on his rig would fire that instead, every time
   * the tuner opened and closed. If the AM4 says NONE, or anything not
   * plainly a number, nothing is sent and the readings go on exactly as
   * before. Nothing is ever written to the AM4 here.
   */

  /*
   * ONE READ OF THE TUNER SETTING'S NUMBER. {named, heard, words, why}:
   * `named` is n (one the tuner may be sent or not), 'none', or null for an
   * answer that is silent or unclear, as am4TunerCcNamed has it. A missing or
   * unclear answer, or a number the tuner may not be sent, turns the verdict
   * against asking again at an open (`unitAsk`). What the answer does to
   * what is remembered is for the caller to say.
   */
  async function askTunerNumber(deadline) {
    const asked = tuner.unitRead
    tuner.unitRead = true
    let a
    try {
      a = await ask(buildAm4TunerCcRead(), (f) => parseAm4GlobalLong(f, AM4.TUNER_CC), WAIT.am4Tempo, 'the AM4’s Tuner setting', { deadline })
    } catch (err) {
      /* An open dropped at its deadline before this was asked: it has not been asked. */
      if (err?.late) tuner.unitRead = asked
      throw err
    }
    const heard = !!a && !rejected(a)
    if (heard) sayShape('its Tuner setting', a)
    const words = heard ? `“${a.text ?? ''}”` : ''
    const named = heard ? am4TunerCcNamed(a) : null
    const why = rejected(a) ? `the AM4 refused the question: ${rejectedWords(a.rejected)}` : heard ? `it reads ${words}` : 'no answer'
    if (named === null || (named !== 'none' && !am4CcOk(named))) tuner.unitAsk = false
    return { named, heard, words, why }
  }

  /*
   * NO LONGER THE TUNER'S NUMBER. A read that names NONE, or a number the
   * tuner may not be sent, means the number remembered is not the tuner's
   * any more: the player may have given it to Output Volume, and a 0 there
   * silences the rig. So it is forgotten, and with it the 127 that went out
   * on it: no 0 ever follows on that number, not even as the connection
   * closes.
   */
  function forgetUnitTuner(words) {
    const was = tuner.unitCc
    if (was && tuner.unitOpen) say(`the AM4’s Tuner setting reads ${words} now, not CC ${was.cc}: no 0 goes out on CC ${was.cc}, which may do something else on the AM4 now`)
    tuner.unitCc = null
    tuner.unitOpen = false
  }

  /*
   * ANOTHER NUMBER THE TUNER MAY BE SENT, read with a 127 still owing its 0:
   * that is the AM4's own Tuner number now, and the 0 belongs there. Moved
   * at once, before the channel is asked, so a connection let go of in
   * between sends its last 0 on the number the AM4 names now, never on the
   * old one.
   */
  function moveUnitTuner(named, words) {
    const was = tuner.unitCc
    if (!tuner.unitOpen || !was || named === was.cc) return
    say(`the AM4’s Tuner setting reads ${words} now, not CC ${was.cc}: its 0 goes on CC ${named}, the AM4’s own Tuner number now, and none on CC ${was.cc}`)
    tuner.unitCc = { cc: named, channel: was.channel }
  }

  /*
   * ONE READ OF THE MIDI CHANNEL. `said` is the channel its words plainly
   * name (am4ChannelSaid), kept as the one known on this connection, or null
   * when the answer is silent or says nothing plain: then the caller keeps
   * the channel it already knows. `words` for the log.
   */
  async function askChannel(deadline) {
    const c = await ask(buildAm4MidiChannelRead(), (f) => parseAm4GlobalLong(f, AM4.MIDI_CHANNEL), WAIT.am4Tempo, 'the AM4’s MIDI channel', { deadline })
    const told = !!c && !rejected(c)
    if (told) sayShape('its MIDI channel', c)
    const said = told ? am4ChannelSaid(c) : null
    if (said !== null) tuner.unitChannel = said
    return { said, words: told ? c.text ?? '' : 'no answer' }
  }

  /*
   * The setting read whole, for an open (or a close on a connection that has
   * never asked): its number, then its MIDI channel only when there is a
   * number to send on it. A channel read that is silent, or not plain
   * channel words, keeps the channel already known on this connection, and
   * only a connection that knows none takes the AM4's factory 1: one unclear
   * answer must not move the CC off the channel the AM4 listens on.
   * {cc, channel}, 'none', or null when the answer was missing or unclear —
   * and then an open does not ask again on this connection, so a unit that
   * cannot answer is asked once, not at every press. An open's `deadline`
   * goes to both reads (see am4TunerOpen); a close has none.
   */
  async function readUnitTuner(deadline) {
    if (!tuner.unitAsk) return null
    const { named, heard, words, why } = await askTunerNumber(deadline)
    if (named === 'none') {
      forgetUnitTuner(words)
      say(`the AM4’s Tuner setting reads ${words}: no MIDI number, so its own tuner is left as it is (SETUP > MIDI/Remote > Tuner)`)
      return 'none'
    }
    if (named === null || !am4CcOk(named)) {
      if (named !== null) forgetUnitTuner(words)
      say(`the AM4’s own tuner is left as it is: about its Tuner setting, ${heard ? `${why}, which is not a number its tuner may be sent` : why}. Not asked again on this connection`)
      return null
    }
    moveUnitTuner(named, words)
    const c = await askChannel(deadline)
    const channel = c.said ?? tuner.unitChannel ?? 1
    tuner.unitCc = { cc: named, channel }
    say(`the AM4’s Tuner setting reads ${words}, its MIDI channel “${c.words}”: CC ${named} on channel ${channel}`)
    return tuner.unitCc
  }

  /*
   * WHAT THE AM4 ACTUALLY SAID, IN FULL. How it answers these two settings
   * has not been seen on his unit: which of the whole number, the float and
   * the words carries what. So each answer goes into the log as the three of
   * them, once a connection (again only if it changes), and a pasted log
   * shows the real shape rather than what the phone made of it.
   */
  function sayShape(what, a) {
    const f = Number.isFinite(a.float) ? String(Number(a.float.toPrecision(7))) : String(a.float)
    const shape = `whole number ${a.whole}, float ${f}, words “${a.text ?? ''}”`
    if (tuner.unitShapes.get(what) === shape) return
    tuner.unitShapes.set(what, shape)
    say(`the AM4 answered about ${what}: ${shape}`)
  }

  /*
   * The CC as a write: ahead of the polls, and held behind a stored preset
   * coming back rather than sent into it. A 127 puts the next keepUnitTuner
   * AM4_TUNER_KEEP_MS off; `again` is that one's own, which the log says.
   */
  const sendUnitTuner = (on, setting, deadline, again = false) => {
    if (on) tuner.unitKeepAt = time.now() + AM4_TUNER_KEEP_MS
    return ex(buildAm4TunerCc(on, setting), {
      ms: WAIT.am4Settle,
      what: `the AM4’s own tuner ${on ? (again ? 'kept open' : 'open') : 'closed'} (CC ${setting.cc} at ${on ? 127 : 0}, channel ${setting.channel})`,
      priority: 'write',
      deadline
    })
  }

  async function openUnitTuner(run, deadline) {
    const setting = await readUnitTuner(deadline)
    if (setting === 'none') return 'none'
    if (!setting) return 'unknown'
    /* Let go of while it was being read: no 127 for a tuner nobody has open. */
    if (!tuner.on || tuner.run !== run) return 'unknown'
    /* Owed from here: the wire's close() sends the 0 if it lets go before this is answered. */
    tuner.unitOpen = true
    try {
      await sendUnitTuner(true, setting, deadline)
    } catch (err) {
      /* Dropped at its deadline, so never sent: no 0 is owed for it. */
      if (err?.late) tuner.unitOpen = false
      throw err
    }
    return 'opened'
  }

  /*
   * KEPT UP UNTIL CLOSE. "On the AM4 when turning on the tuner it stays on
   * for about 15 seconds on the unit and then turns off. On the phone it
   * stays on until you hit close. We want it to stay on until the user hits
   * close." (23 October 2026) Nothing sent is timed from the open: the
   * readings and the footswitch watch go far more often, and the screen
   * outlasts them. So the AM4 lets go of a tuner its CC opened, and while
   * the phone's tuner is open its 127 goes again every AM4_TUNER_KEEP_MS,
   * from the readings' own ticks, as the computer does (ForgeFX keepTuner).
   * A screen the AM4 let go of is back within that; one still up stays up.
   *
   * Safe because the CC is a level, not a toggle (closeUnitTuner): a 127 to
   * a tuner already open leaves it open. And each time the setting is read
   * again first, the number and then the channel, the two reads an open
   * makes, without changing what the open and the close go by (`unitAsk`,
   * `unitCc`'s number): the 127 goes only when the AM4 still names the
   * number it went out on, on the channel it names now or the one it went
   * out on. A number moved on the AM4 may be Output Volume now, where a 127
   * is full volume. Anything else sends nothing, and says why once.
   *
   * Never once the tuner is closing: the close takes `tuner.on` and
   * `tuner.run` the moment its turn comes, and they are asked before the
   * reads, after each, and just before the 127, which then goes into the
   * line ahead of the close's own reads and its 0. Nor once the 0 has gone
   * (`unitOpen`), nor on a connection that opened nothing.
   */
  async function keepUnitTuner(run) {
    /*
     * And only while the app has stayed on screen through this tuner
     * (`unitKeepAway`, the run it went off screen in). On an iPhone the code
     * stops in a pocket and the AM4 lets go; the first tick back found the
     * keep overdue and put the AM4 back on its tuner, muted, before Close
     * could be tapped. On Android the ticks go on in a pocket, holding the
     * AM4 on its tuner against a footswitch. Off screen even once, this tuner
     * is not kept up again; opening it again starts afresh.
     */
    if (offScreen) tuner.unitKeepAway = run
    const owed = () => tuner.on && tuner.run === run && tuner.unitOpen && !!tuner.unitCc && !tuner.unitClosing && tuner.unitKeepAway !== run
    if (!owed() || time.now() < tuner.unitKeepAt) return false
    const was = tuner.unitCc
    tuner.unitKeepAt = time.now() + AM4_TUNER_KEEP_MS
    const a = await ask(buildAm4TunerCcRead(), (f) => parseAm4GlobalLong(f, AM4.TUNER_CC), WAIT.am4Tempo, 'the AM4’s Tuner setting')
    if (!owed() || tuner.unitCc !== was) return false
    const heard = !!a && !rejected(a)
    const named = heard ? am4TunerCcNamed(a) : null
    if (named !== was.cc) {
      const why = `the AM4’s own tuner is not opened again: its Tuner setting ${heard ? `reads “${a.text ?? ''}”` : 'did not answer'}, not plainly CC ${was.cc}, which it was opened on`
      if (tuner.unitKeepNote !== why) say(why)
      tuner.unitKeepNote = why
      return false
    }
    const c = await askChannel()
    if (!owed() || tuner.unitCc !== was) return false
    tuner.unitKeepNote = null
    const setting = c.said !== null && c.said !== was.channel ? { cc: was.cc, channel: c.said } : was
    tuner.unitCc = setting
    await sendUnitTuner(true, setting, null, true)
    return true
  }

  /*
   * THE 0, OWED OR NOT. 0 is a level, not a toggle, so a 0 to a tuner
   * already closed does nothing — and 127 is never sent to close one.
   *
   *   - A 127 this connection sent and still owes a 0 for: the setting is
   *     read again first, whole (closeOpened).
   *   - Nothing open, on a connection that has asked already: nothing at
   *     all. Its 0, if it had one to send, has gone.
   *   - A connection that has never asked (a restart, or back from a drop
   *     with the AM4 still on its tuner): the setting is read, then the 0.
   *
   * 'closed' when the 0 went, 'none' for NONE, 'unknown' when nothing was
   * sent for any other reason. Only 'closed' and 'none' settle a 0 the link
   * holds owed from an earlier connection (see bleLink): 'unknown' hands it
   * on to the next one.
   */
  async function closeUnitTuner() {
    if (tuner.unitOpen) return closeOpened()
    if (tuner.unitRead) return 'unknown'
    /* The AM4 may be on its tuner while this reads: let go of meanwhile, the 0 is still owed (see close()). */
    tuner.unitClosing = true
    let read = null
    try {
      read = await readUnitTuner()
    } finally {
      tuner.unitClosing = false
    }
    if (read === 'none') return 'none'
    if (!read) return 'unknown'
    tuner.unitOpen = true
    await sendUnitTuner(false, read)
    tuner.unitOpen = false
    return 'closed'
  }

  /*
   * THE CLOSE OF A TUNER THIS CONNECTION OPENED. The player may have changed
   * the Tuner setting with the tuner up, so it is read again before the 0,
   * whole, number then channel — even when an open would not ask again,
   * since a 0 is about to go out:
   *
   *   - the same number: the 0 goes on it, on the channel the AM4 names now;
   *   - another number the tuner may be sent: that is the AM4's own Tuner
   *     number now, so the 0 goes there, on the channel it names now, and
   *     none on the old one (moveUnitTuner);
   *   - NONE, or a number the tuner may not be sent: nothing goes, and what
   *     was open is forgotten (forgetUnitTuner);
   *   - silent, or nothing plainly a number: the 0 goes on the number and
   *     channel remembered from the open, the one way that screen is known
   *     to close.
   *
   * A channel read that is silent, or not plain channel words, keeps the
   * channel remembered from the open. And a number confirmed here puts the
   * verdict back (`unitAsk`): one silent read at a re-open does not leave
   * the AM4's own tuner shut out for the rest of the connection.
   */
  async function closeOpened() {
    const { named, words, why } = await askTunerNumber()
    if (named === 'none' || (named !== null && !am4CcOk(named))) {
      forgetUnitTuner(words)
      return named === 'none' ? 'none' : 'unknown'
    }
    if (named === null) {
      say(`about the AM4’s Tuner setting, ${why}: its 0 goes on CC ${tuner.unitCc.cc}, the number its tuner was opened on. Not asked again at an open on this connection`)
    } else {
      moveUnitTuner(named, words)
      const { said } = await askChannel()
      if (said !== null) tuner.unitCc = { cc: named, channel: said }
      tuner.unitAsk = true
    }
    /* Still owed until it has gone: let go of while it waits its turn, the wire's close() sends it instead. */
    await sendUnitTuner(false, tuner.unitCc)
    tuner.unitOpen = false
    return 'closed'
  }

  /*
   * THE OPEN IS A TAP, AND IT CAN COME LATE IN TWO WAYS. Its turn waits for a
   * close ahead of it (am4TunerInTurn), long after request() let go of the
   * tap's deadline; and its two reads wait behind whatever holds the line —
   * on an AM4 that can be a stored preset coming back, up to twenty seconds.
   * A 127 that went out then would mute the unit a while after the player
   * pressed, perhaps after the tuner was closed again and he had started to
   * play. So the deadline is taken by name (writeTuner) and held to: past it
   * at the turn, nothing at all; past it at a read or at the 127, the whole
   * open is dropped — the phone's tuner with it, so the screen goes back to
   * what the unit is on — and said as a dropped tap, never swallowed like
   * the other reasons the AM4's own screen does not open.
   */
  async function am4TunerOpen(deadline = null) {
    if (tuner.on) return { ok: true, unitTuner: tuner.unitSays || 'unknown' }
    if (deadline !== null && time.now() >= deadline) {
      say('not sent, its turn came after its deadline: the tuner')
      throw tooLate()
    }
    tuner.on = true
    tuner.run++
    tuner.lastNote = null
    const run = tuner.run
    /* Opened with the app off screen (a watch, a drop healed in a pocket): not kept up (keepUnitTuner). */
    if (offScreen) tuner.unitKeepAway = run
    let says = 'unknown'
    try {
      says = await openUnitTuner(run, deadline)
    } catch (err) {
      if (err?.late) {
        if (tuner.on && tuner.run === run) {
          tuner.on = false
          tuner.run++
        }
        throw err
      }
      /* Only the AM4's own screen is lost: the phone still tunes. */
      say(`the AM4’s own tuner was not opened: ${err?.message || err}`)
    }
    tuner.unitSays = says
    if (tuner.on && tuner.run === run) am4TunerTick(run)
    return { ok: true, unitTuner: says }
  }

  async function am4TunerClose() {
    if (tuner.on) {
      tuner.on = false
      tuner.run++
      if (tuner.timer !== null) time.clearTimeout(tuner.timer)
      tuner.timer = null
    }
    tuner.unitSays = null
    let says = 'unknown'
    try {
      says = await closeUnitTuner()
    } catch (err) {
      say(`the AM4’s own tuner was not closed: ${err?.message || err}`)
    }
    return { ok: true, unitTuner: says }
  }

  /*
   * ONE AFTER ANOTHER. An open waits on two answers before its 127 goes, and
   * a close pressed meanwhile must not overtake it: the 0 would go first, the
   * late 127 after it, and the AM4 would be left on its tuner with the
   * phone's closed.
   */
  let am4TunerTurns = Promise.resolve()
  function am4TunerInTurn(on, deadline = null) {
    const turn = am4TunerTurns.then(() => (on ? am4TunerOpen(deadline) : am4TunerClose()))
    am4TunerTurns = turn.catch(() => {})
    return turn
  }

  /* ================================================================ */
  /* The routes                                                        */
  /* ================================================================ */

  /* In turn, on and off alike, on every unit (see am4TunerInTurn and gen3TunerInTurn). */
  async function writeTuner(on) {
    /* An open's deadline, taken now: its turn comes after request() has let go of it (see am4TunerOpen and gen3TunerOpen). */
    const deadline = on === true ? tapUntil : null
    if (am4) return am4TunerInTurn(on === true, deadline)
    return gen3TunerInTurn(on === true, deadline)
  }

  const isNum = (s) => /^\d+$/.test(String(s ?? ''))
  /* One of Edit's routes, which request() does not count as Play's (editWaits). */
  const editRoute = (run) => Object.assign(run, { edit: true })
  /* Play's reads of the blocks, which a scene or preset change waits on before Edit reads again (editWaits). */
  const BLOCK_READS = ['/preset/scene-state', '/preset/blocks']

  /** The handler for a request, or null when Bluetooth does not answer it. */
  function routeFor(method, path, part, body, opts) {
    /*
     * EDIT'S, ONLY FROM EDIT. The block reads and writes below go only when
     * Edit is open to this account on this unit (editOn) AND the request
     * says it is Edit's (device.js EDITING): Play asks for the amp's
     * settings too, for its boost (lib/am4-boost), and over Bluetooth Play
     * stays exactly as it was.
     */
    const editing = opts?.editing === true && editOn()
    if (editing && part[0] === 'preset' && part[1] === 'blocks' && isNum(part[2])) {
      const eid = Number(part[2])
      if (method === 'GET' && part.length === 4 && part[3] === 'params') return editRoute(() => (am4 ? am4Params(eid) : gen3Params(eid)))
      if (method === 'PUT' && part.length === 5 && part[3] === 'params' && isNum(part[4]) && !(am4 && eid === AM4_BLOCKS.amp && Number(part[4]) === AM4.OUT_BOOST)) {
        return editRoute(() => (am4 ? am4WriteKnob(eid, Number(part[4]), body) : gen3WriteKnob(eid, Number(part[4]), body)))
      }
      if (method === 'POST' && part.length === 4 && part[3] === 'type') return editRoute(() => (am4 ? am4WriteModel(eid, body?.value) : gen3WriteModel(eid, body?.value)))
    }
    if (editing && method === 'GET' && part[0] === 'blocks' && part.length === 3 && part[2] === 'types') {
      return editRoute(() => (am4 ? modelsOf(decodeURIComponent(part[1])) : g3().modelsOf(decodeURIComponent(part[1]))))
    }
    /* The developer's reader, only when the request says it is the reader's and it is open to this account (readerOn): his alone. */
    if (opts?.reading === true && readerOn() && method === 'GET' && part[0] === 'reader' && part[1] === 'blocks') {
      if (part.length === 2) return editRoute(gen3ReaderList)
      if (part.length === 3 && isNum(part[2])) return editRoute(() => gen3Describe(Number(part[2])))
    }
    /* An Axe-Fx III's captures (lib/nam-install), only when the request says it is theirs and they are open to this account (captureOn): his alone. */
    if (opts?.capturing === true && captureOn() && part[0] === 'nam') {
      if (method === 'GET' && part.length === 2 && part[1] === 'empty') return editRoute(() => namEmptySlot(opts.onProgress))
      if (method === 'GET' && part.length === 4 && part[1] === 'heads' && isNum(part[2]) && isNum(part[3])) return editRoute(() => namHeads(Number(part[2]), Number(part[3])))
      if (method === 'POST' && part.length === 3 && part[1] === 'slots' && isNum(part[2])) return editRoute(() => namInstall(Number(part[2]), body, opts.onProgress))
      if (method === 'POST' && part.length === 4 && part[1] === 'blocks' && isNum(part[2]) && part[3] === 'slot') return editRoute(() => namPick(Number(part[2]), body))
    }
    /* The chain read as a grid and changed from here, only where it is open to this account (chainOn): his alone so far. Nobody else is ever answered, and a wire made without `chain` answers these as it always did, "not over Bluetooth". */
    if (chainOn()) {
      if (method === 'GET' && path === '/blocks') return editRoute(async () => (am4 ? AM4_PALETTE.map((b) => ({ ...b })) : gen3Palette()))
      if (method === 'GET' && path === '/preset/grid') return editRoute(() => (am4 ? am4Grid() : gen3Grid()))
      if (method === 'PUT' && path === '/preset/grid/cell') return editRoute(() => (am4 ? am4PlaceSlot(body) : gen3PlaceCell(body)))
      if (method === 'POST' && path === '/preset/grid/cable' && !am4) return editRoute(() => gen3Cable(body))
    }
    if (method === 'GET') {
      if (path === '/device/detect') return am4 ? am4Detect : gen3Detect
      if (path === '/preset') return am4 ? am4Preset : gen3Preset
      if (path === '/scene') return am4 ? am4Scene : gen3Scene
      if (path === '/tempo') return am4 ? am4Tempo : gen3Tempo
      if (path === '/preset/blocks') return am4 ? am4Blocks : gen3Blocks
      if (path === '/preset/scene-state') return am4 ? am4SceneState : gen3SceneState
      if (part[0] === 'presets' && isNum(part[1])) {
        const n = Number(part[1])
        if (part.length === 2) return () => (am4 ? am4StoredName(n) : gen3StoredName(n))
        /* The AM4 keeps scene names only in its 12 KB stored preset: read for the
           names alone, and never as a summary, which Play asks of the slots
           either side of this one. */
        if (am4) return part.length === 3 && part[2] === 'scenes' ? () => am4SceneNames(n) : null
        if (part.length === 3 && part[2] === 'summary') {
          return async () => ({ number: n, name: last.name, scenes: await gen3SceneNames(n) })
        }
        if (part.length === 3 && part[2] === 'scenes') return async () => ({ number: n, names: await gen3SceneNames(n) })
      }
      return null
    }
    if (method === 'POST') {
      if (path === '/preset/select') return () => (am4 ? am4SelectPreset(body?.number) : gen3SelectPreset(body?.number))
      if (path === '/scene') return () => (am4 ? am4WriteScene(body?.index) : gen3WriteScene(body?.index))
      if (path === '/tempo') return () => (am4 ? am4WriteTempo(body?.bpm) : gen3WriteTempo(body?.bpm))
      /* The AM4 has no tap message; the phone works the BPM out and sends that. */
      if (path === '/tempo/tap') return am4 ? null : gen3Tap
      if (path === '/tuner') return () => writeTuner(body?.on === true)
      if (part[0] === 'preset' && part[1] === 'blocks' && isNum(part[2]) && part.length === 4) {
        const eid = Number(part[2])
        if (part[3] === 'bypass') return () => (am4 ? am4WriteBypass(eid, body?.bypassed) : gen3WriteBypass(eid, body?.bypassed))
        if (part[3] === 'channel') return () => (am4 ? am4WriteChannel(eid, body?.channel) : gen3WriteChannel(eid, body?.channel))
      }
    }
    /* One PUT only, on an AM4 only: the amp's Out Boost (lib/am4-boost). Every other setting stays at the computer. */
    if (method === 'PUT' && am4 && path === `/preset/blocks/${AM4_BLOCKS.amp}/params/${AM4.OUT_BOOST}`) {
      return () => am4WriteBoost(AM4_BLOCKS.amp, body)
    }
    return null
  }

  /**
   * One request, as device.js makes it: answered from the unit, or refused
   * here with nothing sent. A refusal never falls through to the computer —
   * with Bluetooth on, there is no computer to fall through to.
   */
  const toldNot = new Set()
  async function request(path, options = {}) {
    if (closed) throw notConnected()
    /* Handed to the first exchange the route queues; see tapUntil. */
    const deadline = Number.isFinite(options?.deadline) ? options.deadline : null
    const method = String(options?.method || 'GET').toUpperCase()
    const clean = String(path || '').split('?')[0]
    const part = clean.split('/').filter(Boolean)
    let body = null
    try {
      body = typeof options?.body === 'string' ? JSON.parse(options.body) : options?.body ?? null
    } catch {
      body = null
    }
    const route = method === 'GET' || method === 'POST' || method === 'PUT' ? routeFor(method, clean, part, body, options) : null
    if (!route) {
      /*
       * WHAT BLUETOOTH NEVER ANSWERS IS SAID ONCE A CONNECTION. "Don't know if
       * you can see any issues from this log." Most of it was this line. What
       * routeFor refuses once it refuses for the whole connection: still
       * refused every time with nothing sent, but written down for the first
       * of each kind only (preset 98's and 99's are one kind).
       */
      const kind = `${method} ${clean.replace(/(\/|%3A|:)\d+(?=\/|$)/gi, '$1n')}`
      if (!toldNot.has(kind)) {
        toldNot.add(kind)
        say(`not over Bluetooth: ${method} ${clean}`)
      }
      /* The computer's own documents simply do not exist here, which the app already handles. */
      throw method === 'GET' && (clean === '/device' || clean.startsWith('/store/')) ? notHere() : unsupported()
    }
    /*
     * A capture is going (namInstall): what would change the unit is refused
     * here, whole, before its route asks anything. A route that reads before
     * it writes (a scene tap asks where the unit is first) would otherwise
     * have its read held with the others and then write once the capture is
     * over: a scene landing half a minute after the tap.
     */
    if (captureBusy && method !== 'GET' && options?.capturing !== true) throw failure(`The ${spec.name} is taking a capture. Try again when it has finished.`, 409)
    /* Play's, counted while it is answered: nothing of Edit's starts meanwhile (editWaits). */
    const play = route.edit === true ? null : playBegins(method === 'GET' && BLOCK_READS.includes(clean))
    tapUntil = deadline
    let answer
    try {
      answer = route()
    } catch (err) {
      answer = Promise.reject(err)
    } finally {
      tapUntil = null
    }
    if (!play) return answer
    try {
      return await answer
    } finally {
      playEnds(play)
    }
  }

  /* ================================================================ */
  /* The footswitch watch                                              */
  /* ================================================================ */

  const polls = { on: false, timer: null, tick: 0, run: 0 }
  let checking = false

  async function gen3Poll(n) {
    const s = await sceneNow('poll')
    if (s === SKIPPED) return
    /* Unanswered: the next question waits for the next tick, and three in a row put the wire quiet. */
    if (s === null) return missedPoll()
    if (Number.isInteger(s)) noteScene(s, true)
    if (n % (POLL_MS.preset / POLL_MS.scene) === 0) {
      const p = await presetNow('poll')
      if (p === SKIPPED) return
      if (p && !rejected(p)) notePreset(p, true)
    }
    if (n % (POLL_MS.tempo / POLL_MS.scene) === 0) {
      const t = await tempoNow('poll')
      if (Number.isInteger(t)) noteTempo(t, true)
    }
  }

  async function am4Poll() {
    const s = await readStructure({ priority: 'poll', fresh: true })
    if (!s || s === SKIPPED) return
    if (last.preset !== null && s.location !== last.preset) {
      notePreset({ number: s.location, name: s.name }, true)
      last.scene = s.scene
      return
    }
    notePreset({ number: s.location, name: s.name }, false)
    noteScene(s.scene, true)
  }

  /*
   * EACH START IS ITS OWN RUN, the way rig's watchUnit has watchRun. The
   * screen goes off and on in a blink — Control Center, a notification, Face
   * ID, every Android unlock — and a tick still waiting for its answer when
   * that happens would otherwise wake up, see the watch on again, and start a
   * second loop beside the new one: one more for every blink, each a 238-byte
   * answer on a 31,250-baud line, for as long as the adapter stayed connected.
   * A tick from an older run ends where it is.
   *
   * And nothing is asked until the unit has answered something on this
   * connection. A unit that never has may be the wrong one (an AM4 picked as
   * an FM3), and the rig's own ten-second check is enough for a silent one.
   */
  async function pollTick(run) {
    if (run !== polls.run) return
    polls.timer = null
    if (!polls.on || closed) return
    const n = polls.tick++
    try {
      if (!tuner.on && !checking && answered && !quiet()) await (am4 ? am4Poll() : gen3Poll(n))
    } catch {
      // A missed poll is the next poll's job.
    }
    if (polls.on && !closed && run === polls.run) polls.timer = time.setTimeout(() => pollTick(run), am4 ? POLL_MS.am4 : POLL_MS.scene)
  }

  /** Start watching for footswitch changes, with a poll straight away. The link layer calls this when the screen comes on. */
  function startPolls() {
    if (polls.on || closed || wrongUnit) return
    polls.on = true
    const run = ++polls.run
    polls.timer = time.setTimeout(() => pollTick(run), 0)
  }

  /** Stop watching: the screen went off, or the adapter went away. */
  function stopPolls() {
    polls.on = false
    polls.run++
    if (polls.timer !== null) time.clearTimeout(polls.timer)
    polls.timer = null
  }

  /** The app went off screen: the AM4's own tuner open now is not kept up again (keepUnitTuner). */
  function screenOff() {
    offScreen = true
    if (tuner.on) tuner.unitKeepAway = tuner.run
  }

  /** Back on screen. A tuner that was open while it was away stays not kept up; a new one is. */
  function screenOn() {
    offScreen = false
  }

  /* ================================================================ */
  /* The check panel                                                   */
  /* ================================================================ */

  const nameOf = (eid) => blocks.find((b) => b?.page === eid)?.name || `block ${eid}`
  /* A write's row: sent, or what the unit said about it. */
  const sentWords = (v) => (rejected(v) ? `refused: ${rejectedWords(v.rejected)}` : 'sent')
  const said = (v, words) => (v === null || v === undefined ? 'no answer' : rejected(v) ? `refused: ${rejectedWords(v.rejected)}` : words(v))

  /* Gen 3, step by step. Each `row` is one question as the panel shows it. */
  const GEN3_CHECKS = {
    model: (row) =>
      row(`The scene, asked as the ${spec.name}`, () => ask(buildGetScene(model), (f) => parseScene(f, model), WAIT.detect, 'the scene'), (v) =>
        v === null ? foreignWords() || 'no answer' : said(v, (s) => `it answers: scene ${s + 1}`)
      ),
    preset: (row) => row('Preset number and name', () => presetNow(), (v) => said(v, (p) => `preset ${p.number}, ${p.name || '(no name)'}`)),
    scene: (row) => row('Scene', () => sceneNow(), (v) => said(v, (s) => `scene ${s + 1}`)),
    'scene-names': async (row) => {
      for (let i = 0; i < 8; i++) {
        await row(`Scene ${i + 1}’s name`, () => ask(buildGetSceneName(model, i), (f) => parseSceneName(f, model), WAIT.sceneName, `scene ${i + 1}’s name`), (v) =>
          said(v, (s) => (s.index === i ? s.name || '(no name)' : `answered for scene ${s.index + 1} instead`))
        )
      }
    },
    tempo: (row) => row('Tempo', () => tempoNow(), (v) => said(v, (b) => `${b} BPM`)),
    /* An FM9 lists its effects from firmware 3.00 ("3rd Party MIDI Command "Status Dump" is now enabled", Fractal's FM9 release notes). */
    blocks: (row) =>
      row('Blocks', () => statusNow(), (v) =>
        v === null && unit === 'fm9'
          ? 'no answer: an FM9 lists its effects only from firmware 3.00 on'
          : said(v, (list) => list.map((b) => `${nameOf(b.effectId)} · ${CH[b.channel] || b.channel} · ${b.bypassed ? 'off' : 'on'}`).join(', ') || 'none')
      ),
    'stored-name': async (row) => {
      const now = await row('Preset number and name', () => presetNow(), (v) => said(v, (p) => `preset ${p.number}`))
      if (!now || rejected(now)) return
      const n = now.number >= spec.maxPreset ? now.number - 1 : now.number + 1
      await row(`Preset ${n}’s name`, () => ask(buildGetPresetName(model, n), (f) => parsePresetName(f, model), WAIT.preset, `preset ${n}’s name`), (v) => {
        if (v === null) return 'nothing came back'
        if (rejected(v)) return `refused: ${rejectedWords(v.rejected)}`
        if (v.number !== n) {
          numberedOff = true
          return `answered for preset ${v.number} instead: this unit cannot say another preset’s name`
        }
        return `answered for that preset: ${v.name || '(no name)'}`
      })
    },
    /*
     * The echo test's question goes as a probe: a white plug in an Axe-Fx
     * III's THRU hears only the phone's own frames, never an answer, so a
     * question held until the unit answers would never go. It is the same
     * published 0x0C 7F scene question detect sends as its probe.
     */
    echo: (row) => echoRow(row, () => ask(buildGetScene(model), (f) => parseScene(f, model), WAIT.scene, 'the scene, for the echo test', { probe: true })),
    'write-scene': async (row) => {
      const from = await row('Scene', () => sceneNow(), (v) => said(v, (s) => `scene ${s + 1}`))
      if (!Number.isInteger(from)) throw failure('The unit did not say which scene it is on.', 504)
      const to = from === 1 ? 0 : 1
      const way = await row(`Scene ${to + 1}`, () => trialScene(to, from), (w) => wayWords(w))
      if (way) learn('scene', way)
      await row(`Back to scene ${from + 1}`, () => (way ? sceneBy(way, from) : trialScene(from)), sentWords)
      last.scene = from
      return { way: remembered('scene', way) }
    },
    'write-channel': async (row) => {
      const list = await row('Blocks', () => statusNow(), (v) => said(v, (l) => `${l.length} blocks`))
      if (!Array.isArray(list)) throw failure('The unit did not list its blocks.', 504)
      const amp = list.find((b) => b.effectId === 58) || list.find((b) => b.channels > 1)
      if (!amp) throw failure('There is no block with channels in this preset.', 409)
      const to = amp.channel === 1 ? 0 : 1
      const way = await row(`${nameOf(amp.effectId)} to ${CH[to]}`, () => trialChannel(amp.effectId, to, amp.channel), (w) => wayWords(w))
      if (way) learn('channel', way)
      await row(`${nameOf(amp.effectId)} back to ${CH[amp.channel]}`, () => (way ? changeChannelBy(way, amp.effectId, amp.channel) : trialChannel(amp.effectId, amp.channel)), sentWords)
      return { way: remembered('channel', way) }
    },
    'write-tempo': async (row) => {
      const from = await row('Tempo', () => tempoNow(), (v) => said(v, (b) => `${b} BPM`))
      if (!Number.isInteger(from)) throw failure('The unit did not say its tempo.', 504)
      const to = from >= AM4.TEMPO_MAX ? from - 1 : from + 1
      const way = await row(`Tempo ${to}`, () => trialTempo(to, from), (w) => wayWords(w))
      if (way) learn('tempo', way)
      await row(`Tempo back to ${from}`, () => (way ? tempoBy(way, from) : trialTempo(from)), sentWords)
      last.bpm = from
      return { way: remembered('tempo', way) }
    },
    /*
     * EFFECTS ON AND OFF, the one way they go (gen3WriteBypass), checked as
     * the AM4's is: the block read, switched, read again, and put back as it
     * was. The first effect the catalog names, before the amp and the cab
     * (an amp switched off is a silent rig for the moment it takes) and
     * the Axe-Fx III's NAM and IR Player, which stand where they do, and
     * before the Crossover, the Vocoder, Tone Match and Dynamic Distortion
     * (lib/gen3Catalog OWN), so the check switches what it switched before
     * they had names: a crossover splits a rig between two speakers, and
     * the check is not the place to find out what one does switched off.
     * Never the input, output or looper, which Play does not show. With
     * nothing but the amp and the cab, the amp, by name, whichever the unit
     * lists first: the step's `warn` says so before it is tapped.
     */
    'write-bypass': async (row) => {
      const list = await row('Blocks', () => statusNow(), (v) => said(v, (l) => `${l.length} blocks`))
      if (!Array.isArray(list)) throw failure('The unit did not list its blocks.', 504)
      const slugOf = (b) => blocks.find((c) => c?.page === b.effectId)?.slug
      const known = list.filter((b) => slugOf(b) && !OFF_STAGE.includes(slugOf(b)))
      const block = known.find((b) => !['amp', 'cab', 'nam', 'irplayer', 'crossover', 'vocoder', 'tonematch', 'dynadist'].includes(slugOf(b))) || known.find((b) => slugOf(b) === 'amp') || known[0]
      if (!block) throw failure('There is no effect to switch in this preset.', 409)
      const eid = block.effectId
      const name = nameOf(eid)
      const was = block.bypassed === true
      const set = (off) => fire(buildSetBypass(model, eid, off), `${name} ${off ? 'off' : 'on'}`).then((r) => {
        if (rejected(r)) throw refusedBy(r.rejected)
        return r
      })
      await row(`${name} ${was ? 'on' : 'off'}`, () => set(!was), sentWords)
      await row(`${name} now`, () => statusNow(), (v) =>
        said(v, (l) => {
          const now = l.find((b) => b.effectId === eid)
          if (!now) return 'not in the list any more'
          return now.bypassed !== was ? `${now.bypassed ? 'off' : 'on'}: it worked` : 'it did not change'
        })
      )
      await row(`${name} back ${was ? 'off' : 'on'}`, () => set(was), sentWords)
      emit({ type: 'changed', scope: 'grid' })
      return {}
    },
    'write-preset': async (row) => {
      const now = await row('Preset', () => presetNow(), (v) => said(v, (p) => `preset ${p.number}, ${p.name || '(no name)'}`))
      if (!now || rejected(now)) throw failure('The unit did not say which preset it is on.', 504)
      const scene = await row('Scene', () => sceneNow(), (v) => said(v, (s) => `scene ${s + 1}`))
      const from = now.number
      const to = from >= spec.maxPreset ? from - 1 : from + 1
      const way = await row(`Preset ${to}`, () => trialPreset(to, from), (w) => (w === 'sysex' ? 'the SysEx switch worked' : w === 'pc' ? 'Program Change worked' : 'sent; the unit did not say where it landed'))
      if (way) learn('preset', way)
      await row(`Back to preset ${from}`, () => (way ? presetBy(way, from) : trialPreset(from)), sentWords)
      /* Loading a preset puts it on its own first scene; "back" means the scene too. */
      if (Number.isInteger(scene)) {
        await pause(WAIT.landed)
        await row(`Back to scene ${scene + 1}`, () => changeScene(scene), sentWords)
        last.scene = scene
      }
      notePreset({ number: from }, false)
      emit({ type: 'changed', scope: 'preset' })
      return { way }
    },
    'write-tuner': async (row) => {
      const before = { polled: tuner.polled, pushes }
      /*
       * ON AN FM9 OR AN AXE-FX III, THE PUBLISHED SWITCH ALONE (see
       * pollTunerByAuto): on, three seconds counting the readings the unit
       * sends, and off. The page and the frequency question go only with Poll
       * picked here.
       */
      if (!pollTunerByAuto && ways.tuner !== 'poll') {
        const on = await row('Tuner on', () => fire(buildTuner(model, true), 'the tuner'), sentWords)
        try {
          if (rejected(on)) throw refusedBy(on.rejected)
          await pause(3000)
        } finally {
          await row('Tuner off', () => fire(buildTuner(model, false), 'the tuner off'), () => `${pushes - before.pushes} readings sent by the unit`)
        }
        const pushed = pushes - before.pushes
        const way = pushed ? 'push' : null
        if (way) learn('tuner', way)
        if (!pushed) say(`no tuner data from the ${spec.name} in 3 s: Send Realtime Sysex may be off on it (Setup → MIDI/Remote)`)
        return { way, polled: 0, pushed }
      }
      await row('Tuner on', () => fire(buildTunerPage(model, true), 'the tuner page'), () => 'tuner page open')
      await row('Tuner data, asked for', () => fire(buildTuner(model, true), 'the tuner'), sentWords)
      let polled = 0
      const until = time.now() + 3000
      while (time.now() < until) {
        const hz = await ex(buildTunerPoll(model), { match: (f) => parseTunerPoll(f, model), ms: WAIT.tunerPoll, fn: FN.PARAM, priority: 'read' })
        if (typeof hz === 'number') polled++
        await pause(TUNER_MS)
      }
      const pushed = pushes - before.pushes
      await row('Tuner off', () => fire(buildTuner(model, false), 'the tuner off').then(() => fire(buildTunerPage(model, false), 'the tuner page closed')), () =>
        `${polled} readings asked for, ${pushed} sent by the unit`
      )
      const way = polled ? 'poll' : pushed ? 'push' : null
      if (way) learn('tuner', way)
      return { way, polled, pushed }
    }
  }

  const wayWords = (w) => (w === 'published' ? 'the published way worked' : w === 'edit' ? 'FM3-Edit’s way worked' : 'sent; the unit did not say whether it took')

  async function changeChannelBy(way, eid, c) {
    const r = await fire(way === 'published' ? buildSetChannel(model, eid, c) : buildSetChannelEdit(model, eid, c), `block ${eid} to ${CH[c]}`)
    if (rejected(r)) throw refusedBy(r.rejected)
  }
  async function tempoBy(way, bpm) {
    const r = await fire(way === 'published' ? buildSetTempo(model, bpm) : buildSetTempoEdit(model, bpm), `tempo ${bpm}`)
    if (rejected(r)) throw refusedBy(r.rejected)
  }

  /* Ask something harmless and listen for our own bytes coming back. */
  async function echoRow(row, askIt) {
    const before = echoes
    await row('Echo test', async () => {
      await askIt()
      await pause(ECHO_MS)
      return echoes - before
    }, (n) =>
      n > 0
        ? unit === 'axefx3'
          ? 'the phone’s own message came back: the white plug may be in the Axe-Fx III’s MIDI THRU. Move it to MIDI OUT.'
          : 'the unit sent the phone’s own message back: MIDI Thru is on. Turn it off on the unit.'
        : 'no echo'
    )
  }

  /* The AM4, step by step: reads from the list, and four writes that each put things back. */
  const slotWords = (codes) =>
    codes ? codes.map((c) => (c ? am4Block(c)?.slug || `0x${c.toString(16)}` : 'empty')).join(', ') : 'not taken from an answer that did not hold together'
  const AM4_CHECKS = {
    structure: (row) =>
      row('Preset, name, scene and blocks', () => readStructure({ fresh: true }), (s) =>
        s
          ? `${am4LocationCode(s.location)} ${s.name || '(no name)'}, scene ${s.scene + 1}, slots ${slotWords(s.slots)}${s.checksumOk ? '' : ' (its checksum did not hold)'}`
          : foreignWords() || 'no answer'
      ),
    tempo: (row) => row('Tempo', () => am4TempoNow(), (v) => said(v, (b) => `${b} BPM`)),
    blocks: async (row) => {
      const s = await row('Preset', () => readStructure({ fresh: true }), (v) => (v ? `slots ${slotWords(v.slots)}` : 'no answer'))
      if (!s) return
      for (const code of s.slots || []) {
        const block = am4Block(code)
        if (!block) continue
        await row(`${block.slug} on or off`, () => am4BypassNow(code), (v) => said(v, (off) => (off ? 'off' : 'on')))
        await row(`${block.slug} channel`, () => am4ChannelNow(code), (v) => said(v, (c) => CH[c]))
      }
    },
    'stored-name': async (row) => {
      const s = await row('Preset', () => readStructure({ fresh: true }), (v) => (v ? am4LocationCode(v.location) : 'no answer'))
      if (!s) return
      const n = s.location >= AM4.LOCATIONS - 1 ? s.location - 1 : s.location + 1
      await row(`${am4LocationCode(n)}’s name`, () => am4NameOf(n), (v) => said(v, (got) => (got.empty ? 'an empty slot' : got.name || '(no name)')))
    },
    echo: (row) => echoRow(row, () => am4TempoNow()),
    'write-scene': async (row) => {
      const s = await row('Scene', () => readStructure({ fresh: true }), (v) => (v ? `scene ${v.scene + 1}` : 'no answer'))
      if (!s) throw failure('The AM4 did not say which scene it is on.', 504)
      const to = s.scene === 1 ? 0 : 1
      await row(`Scene ${to + 1}`, () => fire(buildAm4Scene(to), `scene ${to + 1}`), sentWords)
      await row('Where it landed', () => readStructure({ fresh: true }), (v) => (v ? (v.scene === to ? `scene ${to + 1}: it worked` : `still scene ${v.scene + 1}`) : 'no answer'))
      await row(`Back to scene ${s.scene + 1}`, () => fire(buildAm4Scene(s.scene), `scene ${s.scene + 1}`), sentWords)
      structure = null
      moved()
      last.scene = s.scene
    },
    'write-tempo': async (row) => {
      const from = await row('Tempo', () => am4TempoNow(), (v) => said(v, (b) => `${b} BPM`))
      if (!Number.isInteger(from)) throw failure('The AM4 did not say its tempo.', 504)
      const to = from >= AM4.TEMPO_MAX ? from - 1 : from + 1
      await row(`Tempo ${to}`, () => fire(buildAm4Tempo(to), `tempo ${to}`), sentWords)
      /* Exactly: the check moves it by one, so "within one" would pass a write that did nothing. */
      await row('Tempo now', () => am4TempoNow(), (v) => said(v, (b) => (b === to ? `${b} BPM: it worked` : `${b} BPM: it did not take`)))
      await row(`Tempo back to ${from}`, () => fire(buildAm4Tempo(from), `tempo ${from}`), sentWords)
      last.bpm = from
    },
    'write-bypass': async (row) => {
      const s = await row('Preset', () => readStructure({ fresh: true }), (v) => (v ? `slots ${slotWords(v.slots)}` : 'no answer'))
      if (s && !s.slots) throw failure('The AM4’s answer came through damaged, so no block was switched. Run it again.', 502)
      const code = s ? s.slots.find((c) => am4Block(c)) : undefined
      if (!code) throw failure('There is no block to switch in this preset.', 409)
      const slug = am4Block(code).slug
      const was = await row(`${slug} on or off`, () => am4BypassNow(code), (v) => said(v, (off) => (off ? 'off' : 'on')))
      if (typeof was !== 'boolean') throw failure(`The AM4 did not say whether the ${slug} is on.`, 504)
      await row(`${slug} ${was ? 'on' : 'off'}`, () => fire(buildAm4Bypass(code, !was), `the ${slug}`), sentWords)
      await row(`${slug} now`, () => am4BypassNow(code), (v) => said(v, (off) => (off !== was ? `${off ? 'off' : 'on'}: it worked` : 'it did not change')))
      await row(`${slug} back ${was ? 'off' : 'on'}`, () => fire(buildAm4Bypass(code, was), `the ${slug}`), sentWords)
    },
    'write-preset': async (row) => {
      const s = await row('Preset', () => readStructure({ fresh: true }), (v) => (v ? `${am4LocationCode(v.location)} ${v.name}` : 'no answer'))
      if (!s) throw failure('The AM4 did not say which preset it is on.', 504)
      const from = s.location
      const to = from >= AM4.LOCATIONS - 1 ? from - 1 : from + 1
      await row(`Preset ${am4LocationCode(to)}`, () => fire(buildAm4Preset(to), `preset ${am4LocationCode(to)}`), sentWords)
      await pause(WAIT.landed)
      await row('Where it landed', () => readStructure({ fresh: true }), (v) =>
        v ? (v.location === to ? `${am4LocationCode(to)}: it worked` : `still ${am4LocationCode(v.location)}`) : 'no answer'
      )
      await row(`Back to ${am4LocationCode(from)}`, () => fire(buildAm4Preset(from), `preset ${am4LocationCode(from)}`), sentWords)
      /* Loading a preset puts it on its own first scene; "back" means the scene too. */
      await pause(WAIT.landed)
      await row(`Back to scene ${s.scene + 1}`, () => fire(buildAm4Scene(s.scene), `scene ${s.scene + 1}`), sentWords)
      structure = null
      moved()
      last.scene = s.scene
      notePreset({ number: from }, false)
      /* The unsaved changes are gone: the app reads the preset afresh. */
      emit({ type: 'changed', scope: 'preset' })
    }
  }

  /**
   * One step of the check panel, by its key from CHECK_STEPS (or 'all' for
   * every read). Answers {step, ok, rows, …}: each row is what was asked, the
   * bytes out and back in hex, what it means, and how long it took. The
   * footswitch watch waits while a check runs, so the rows are the check's own.
   */
  async function check(step) {
    const table = am4 ? AM4_CHECKS : GEN3_CHECKS
    const reads = CHECK_STEPS[am4 ? 'am4' : 'gen3'].reads.map((s) => s.step)
    const steps = step === 'all' ? reads : [step]
    if (!steps.every((s) => typeof table[s] === 'function')) throw badInput(`There is no check called ${step}.`)
    if (checking) throw failure('A check is already running.', 409)
    if (closed) throw notConnected()
    checking = true
    tracing = []
    const rows = []
    const row = async (asked, go, meaning) => {
      const mark = tracing.length
      const started = time.now()
      let value
      let error = null
      try {
        value = await go()
      } catch (err) {
        error = err
      }
      const seen = tracing.slice(mark)
      rows.push({
        asked,
        out: seen.map((e) => e.out).join(' | '),
        back: seen.map((e) => e.back).filter(Boolean).join(' | '),
        meaning: error ? `failed: ${error.message}` : meaning(value),
        ms: time.now() - started
      })
      if (error) throw error
      return value
    }
    try {
      let extra = {}
      for (const s of steps) extra = { ...extra, ...((await table[s](row)) || {}) }
      return { step, ok: true, rows, ...extra }
    } catch (err) {
      return { step, ok: false, rows, error: err.message }
    } finally {
      checking = false
      tracing = null
    }
  }

  /* ================================================================ */
  /* Lifetime                                                          */
  /* ================================================================ */

  /* Set as the wire closes: a 0 the AM4's own tuner may still be owed (see close()). */
  let unitOwed = false
  /* Set as a Gen 3 wire closes: what its tuner left the unit on, {push, page}, or null (see close()). */
  let gen3Owed = null

  /*
   * WHAT THE CONNECTION BEFORE LEFT A GEN 3 UNIT'S TUNER ON, handed over by
   * the link the moment this one is made (bleLink connected), before
   * anything is asked: {push, page}. Kept in this wire from then on, so it is
   * closed by this connection's next close, whoever asks for it, and if this
   * wire goes first its close() hands it back with whatever it left open
   * itself. Nothing here sends it: the link asks for the close when the
   * phone's tuner is down, and a tuner the phone opens again keeps it for
   * that tuner's own Close. Ignored on an AM4, whose owed 0 is its own.
   */
  function oweGen3Tuner(owed) {
    if (am4 || closed || !owed) return
    if (owed.push === true) tuner.before.push = true
    if (owed.page === true) tuner.before.page = true
    if (owedFromBefore()) say(`the ${spec.name} may still be on its tuner from the connection before: it is closed by the next close`)
  }

  /**
   * Stop everything and answer anything waiting with "not connected": the
   * adapter has gone. Says whether the AM4's own tuner may have been left
   * open, {unitTunerOwed}, for the link to close it from the next connection.
   */
  function close() {
    if (closed) return { unitTunerOwed: unitOwed }
    closed = true
    stopPolls()
    if (holdTimer !== null) time.clearTimeout(holdTimer)
    holdTimer = null
    if (editTimer !== null) time.clearTimeout(editTimer)
    editTimer = null
    /*
     * Let go of with the AM4's own tuner open: its 0 is the last thing sent,
     * straight out, on the number remembered, with no read first. Only the
     * fallback: when the adapter is still there (Disconnect, Bluetooth off,
     * another unit or adapter picked), the link first has this wire close
     * the tuner in its turn, reading the setting again (bleLink,
     * letGoOfWireInTurn), and this is for a line that went before that
     * could finish. Never into a stored preset still coming back — the AM4
     * is sent nothing while it is sending — so then it stays on its tuner,
     * for its own footswitch. After a drop the adapter has already gone and
     * this reaches nothing: the 0 is then owed (below).
     */
    let zero = null
    if (am4 && tuner.unitOpen && tuner.unitCc && !current?.opts.collect && !draining()) {
      zero = sendFrame(buildAm4TunerCc(false, tuner.unitCc))
      say(`the AM4’s own tuner closed as the connection closes: ${zero}`)
    }
    /*
     * OWED ACROSS THE DROP. When the 0 could not go (the adapter had already
     * gone, or a stored preset was still coming back), or a close was still
     * reading the setting, the AM4 may be left on its own tuner. The link
     * keeps that (unitTunerOwed, below), and if the phone's tuner is closed
     * by the time the next connection comes up — closed while Bluetooth was
     * away, say — that connection closes the AM4's. No press on the phone
     * would ever send that 0 again.
     */
    unitOwed = am4 && ((tuner.unitOpen && zero !== 'sent') || tuner.unitClosing)
    if (unitOwed) say('the AM4 may still be on its own tuner: it is closed from the next connection')
    /*
     * A GEN 3 UNIT LEFT ON ITS TUNER, taken before anything waiting is
     * answered (an open answered "not connected" puts back what it marked).
     * Closed on the phone while the adapter is away, it would stay on its
     * tuner, muted: the next connection starts with nothing marked open, and
     * its Close would find nothing to close. So this is handed to the link,
     * which hands it to the next connection to the same unit. The published
     * off is a level, so it is owed whenever the on may have gone; the page
     * close moves the unit's screen, so it is owed only for a page whose open
     * went, not one still waiting its turn. With it, whatever the connection
     * before left and this one never closed.
     */
    if (!am4) {
      const pageWent = tuner.pageOpen && !waiting.some((j) => !j.opts.messages && sameBytes(j.out, buildTunerPage(model, true)))
      const push = tuner.pushSent || tuner.before.push
      const page = pageWent || tuner.before.page
      gen3Owed = push || page ? { push, page } : null
      if (gen3Owed) say(`the ${spec.name} may still be on its tuner: it is closed from the next connection`)
    }
    tuner.unitOpen = false
    tuner.on = false
    tuner.run++
    if (tuner.timer !== null) time.clearTimeout(tuner.timer)
    tuner.timer = null
    const err = notConnected()
    if (current) {
      const job = current
      current = null
      if (job.timer !== undefined) time.clearTimeout(job.timer)
      job.reject(err)
    }
    while (waiting.length) waiting.shift().reject(err)
    handlers.clear()
    return { unitTunerOwed: unitOwed }
  }

  return {
    unit,
    model,
    request,
    /** Events the unit sends unasked, and the echoes of this phone's own writes, in rig.handleEvent's shapes. */
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {}
      handlers.add(fn)
      return () => handlers.delete(fn)
    },
    heard,
    heardShort,
    /** Every chunk of bytes from the adapter, before the joiner: a long answer is timed by them. */
    heardBytes,
    /** How many bytes have come back on this connection, of any kind (bleLink: nothing at all is a connection to make afresh). */
    bytesIn: () => bytesIn,
    /** Gen 3, with nothing heard from the unit picked: each other unit's own detect question, to name the one on this adapter (null when none answers). */
    askAround,
    /** Once closed: whether the AM4's own tuner may have been left open, its 0 owed to the next connection. */
    unitTunerOwed: () => unitOwed,
    /** While open: whether the AM4 may be on its own tuner from this connection, its 0 not yet sent (see bleLink). */
    unitTunerOpen: () => am4 && !closed && (tuner.unitOpen || tuner.unitClosing),
    /** Gen 3: what the connection before left the unit's tuner on, {push, page}, handed over as this one starts (see bleLink). */
    oweGen3Tuner,
    /** Gen 3, while open: whether something the connection before left on the unit's tuner is still to be closed. */
    gen3TunerOwes: () => !am4 && !closed && owedFromBefore(),
    /** Gen 3, while open: whether the unit may be on its tuner from this connection or the one before, not yet closed (see bleLink letGoOfWireInTurn). */
    gen3TunerLeftOn: () => !am4 && !closed && (tuner.on || tuner.pushSent || tuner.pageOpen || owedFromBefore()),
    /** Once closed: what a Gen 3 unit's tuner was left on, {push, page}, for the next connection to close; null when nothing. */
    gen3TunerOwed: () => gen3Owed,
    startPolls,
    stopPolls,
    screenOff,
    screenOn,
    check,
    /** How each command is sent now, and what auto has learned. */
    methods: methodsCopy,
    /** Change how commands are sent (the check panel's choices). */
    setMethods(next) {
      ways = settleMethods({ ...methodsCopy(), ...next, learned: { ...ways.learned, ...(next?.learned || {}) } })
      keep()
      return methodsCopy()
    },
    /** For the log and the panel: how many of our own messages came back, and how many tuner pushes arrived. */
    counts: () => ({ echoes, pushes }),
    /*
     * Refresh names asked: the next read of the scene names goes to the unit.
     * Kept until the preset changes otherwise, so a scene renamed on the
     * unit's own screen never showed, under a button promising a fresh read.
     */
    /** Save the unit's edit buffer over the preset it is on (lib/bleSave): see storePreset, above. */
    storePreset,
    forgetSceneNames() {
      sceneCache = null
      am4Names.clear()
      /* Refresh names is asked for: an AM4 that once did not answer is asked again. */
      am4DumpsOff = false
      am4NamesGaveUp.clear()
    },
    close
  }
}
