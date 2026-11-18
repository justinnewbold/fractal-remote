/**
 * THE LOOPER'S BUTTONS AND THE UNIT'S OWN METRONOME CLICK FROM THE DEVICE'S
 * OWN WIRE: over Bluetooth, or the unit's USB cable into the phone.
 *
 * "Let's get the rest of the computer only items implemented for over
 * Bluetooth." (Justin, 18 November 2026.) Through the computer the looper's
 * buttons and the unit's click are two of the computer app's routes; over
 * Bluetooth neither was sent. These are the computer app's own messages,
 * byte for byte (ForgeFX drivers/gen3.ts looperControl, looperTelemetry,
 * setParam and readRange; forgefx-midi gen3/axe-fx-iii/telemetry.ts
 * buildLooperControl, buildBlockMonitorPoll and buildLooperWaveformPoll),
 * held to the pinned codec's frames by a test:
 *
 *   A looper button      function 0x01, 10 00, the Looper block, the
 *                        button's setting, and 1.0 (down) or 0.0 (up).
 *   Where the loop is    function 0x01, 19 00, the Looper block, setting 14:
 *                        the playhead, 0 to 1 along the loop.
 *   What the loop looks  function 0x01, 23 00, the Looper block: some six
 *   like                 hundred heights in one answer.
 *   The unit's click     function 0x01, 09 00 (a typed write), block 1 (the
 *                        unit's Global settings), the Metronome switch's own
 *                        number on that unit, 1 or 0.
 *   The click read back  function 0x01, 1A 00, block 1, the same number: the
 *                        switch as 0 to 1.
 *
 * THE FM3, FM9 AND AXE-FX III ONLY. An AM4 has no looper block and its click
 * is never written (shared/metronome.mjs says why: his AM4 froze on SAVING);
 * a VP4's wire (bleVp4.js) has none of this.
 *
 * THE BUTTONS' NUMBERS are the codec's, the same on all three units
 * (LOOPER_RECORD and the rest in each unit's own table: checked equal on the
 * FM3, the FM9 and the Axe-Fx III at the pinned commit, and held there by
 * the test). The Metronome switch's number is NOT the same on any two, and
 * comes from shared/metronome.mjs, where the computer's request gets it.
 *
 * The way out (bleWire gen3Sender) passes a frame of these shapes only as,
 * byte for byte, the one the wire is sending at that moment (`toolAllowed`).
 *
 * Pure: bytes in, bytes out.
 */
import { FN, MODELS, encode14, frame, sameBytes } from './fractal-sysex.mjs'

const GEN3 = [MODELS.fm3, MODELS.fm9, MODELS.axefx3]

/** The sub-actions under function 0x01. */
export const LOOPER_CONTROL_SUB = 0x10
export const FC_READ_SUB = 0x1b
export const KNOB_SUB = 0x52
export const MONITOR_SUB = 0x19
export const RANGE_READ_SUB = 0x1a
export const WAVEFORM_SUB = 0x23
export const TYPED_SUB = 0x09

/** The unit's Global settings: the block the Metronome switch is a setting of. */
export const GLOBAL_BLOCK = 1

/** The looper's buttons by the name the screens use, each the codec's own setting number. */
export const LOOPER_BUTTONS = Object.freeze({ record: 8, play: 9, stop: 14, overdub: 12, undo: 10, once: 11, reverse: 7, half: 20 })
/** Where the playhead is: the setting the monitor read asks. */
export const LOOPER_POSITION = 14

/* 1.0 and 0.0 as a float32, five bytes of seven bits, low first. */
const ONE = [0x00, 0x00, 0x00, 0x7c, 0x03]
const NOUGHT = [0x00, 0x00, 0x00, 0x00, 0x00]

const known = (model) => GEN3.includes(model)
const id = (n) => Number.isInteger(n) && n >= 0 && n <= 0x3fff

/** One looper button down (`on`) or up: forgefx-midi buildLooperControl. Null for anything that is no button. */
export function buildLooperButton(model, eid, action, on) {
  const pid = Object.prototype.hasOwnProperty.call(LOOPER_BUTTONS, action) ? LOOPER_BUTTONS[action] : null
  if (!known(model) || !id(eid) || pid === null) return null
  return frame(model, FN.PARAM, [LOOPER_CONTROL_SUB, 0x00, ...encode14(eid), ...encode14(pid), ...(on === true ? ONE : NOUGHT)])
}

/** Where the playhead is: forgefx-midi buildBlockMonitorPoll at the looper's setting 14. */
export function buildLooperPosition(model, eid) {
  if (!known(model) || !id(eid)) return null
  return frame(model, FN.PARAM, [MONITOR_SUB, 0x00, ...encode14(eid), ...encode14(LOOPER_POSITION), 0, 0, 0, 0, 0, 0, 0, 0, 0])
}

/** What the loop looks like: forgefx-midi buildLooperWaveformPoll. */
export function buildLooperWave(model, eid) {
  if (!known(model) || !id(eid)) return null
  return frame(model, FN.PARAM, [WAVEFORM_SUB, 0x00, ...encode14(eid), 0, 0, 0, 0, 0, 0, 0, 0, 0])
}

const at14 = (f, i) => ((f[i] ?? 0) & 0x7f) | (((f[i + 1] ?? 0) & 0x7f) << 7)
const from = (f, model, sub) => Array.isArray(f) && f[0] === 0xf0 && f[4] === model && f[5] === FN.PARAM && f[6] === sub && f[7] === 0x00

/* A float32 out of five bytes of seven bits, low first. */
function float5(f, i) {
  const bits = (((f[i] ?? 0) & 0x7f) | (((f[i + 1] ?? 0) & 0x7f) << 7) | (((f[i + 2] ?? 0) & 0x7f) << 14) | (((f[i + 3] ?? 0) & 0x7f) << 21) | (((f[i + 4] ?? 0) & 0x0f) << 28)) >>> 0
  return new Float32Array(new Uint32Array([bits]).buffer)[0]
}

/** The playhead out of the unit's answer, 0 to 1, or undefined for any other message (forgefx-midi isBlockMonitorResponse, parseBlockMonitorNorm). */
export function readLooperPosition(f, model, eid) {
  if (!from(f, model, MONITOR_SUB) || f.length !== 23 || at14(f, 8) !== eid || at14(f, 10) !== LOOPER_POSITION) return undefined
  const v = float5(f, 12)
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0
}

/** The loop's heights out of the unit's answer, each 0 to 1, or undefined for any other message (forgefx-midi isLooperWaveformResponse, parseLooperWaveform). */
export function readLooperWave(f, model, eid) {
  if (!from(f, model, WAVEFORM_SUB) || f.length <= 100 || at14(f, 8) !== eid) return undefined
  const out = []
  for (let i = 12; i < f.length - 2; i++) out.push(((f[i] ?? 0) & 0x7f) / 127)
  return out
}

/** The unit's Metronome switch on or off: forgefx-midi buildSetParameter at block 1. */
export function buildUnitClick(model, pid, on) {
  if (!known(model) || !id(pid)) return null
  return frame(model, FN.PARAM, [TYPED_SUB, 0x00, ...encode14(GLOBAL_BLOCK), ...encode14(pid), ...(on === true ? ONE : NOUGHT), 0, 0, 0, 0])
}

/** The switch read back: the frame ForgeFX's readRange sends. */
export function buildUnitClickRead(model, pid) {
  if (!known(model) || !id(pid)) return null
  return frame(model, FN.PARAM, [RANGE_READ_SUB, 0x00, ...encode14(GLOBAL_BLOCK), ...encode14(pid), 0, 0, 0, 0, 0, 0, 0, 0, 0])
}

/** The switch out of the unit's answer, as 0 to 1, or undefined for any other message. */
export function readUnitClick(f, model, pid) {
  if (!from(f, model, RANGE_READ_SUB) || f.length < 19 || at14(f, 8) !== GLOBAL_BLOCK || at14(f, 10) !== pid) return undefined
  const v = float5(f, 12)
  return Number.isFinite(v) ? v : undefined
}

/**
 * ONE OF THE FOOTSWITCH SETUP'S VALUES, ASKED (ForgeFX gen3.ts #fcRead):
 * function 0x01, 1B 00, the Foot Controller's block and a setting of it. A
 * read, and the only message the Footswitches page ever sends.
 */
export function buildFcRead(model, eid, pid) {
  if (!known(model) || !id(eid) || !id(pid)) return null
  return frame(model, FN.PARAM, [FC_READ_SUB, 0x00, ...encode14(eid), ...encode14(pid), 0, 0, 0, 0, 0, 0, 0, 0, 0])
}

/** The value out of the unit's answer, a whole number (an ordinal, or a letter of a label), or undefined for any other message. */
export function readFcValue(f, model, eid, pid) {
  if (!from(f, model, FC_READ_SUB) || f.length < 16 || at14(f, 8) !== eid || at14(f, 10) !== pid) return undefined
  return at14(f, 12)
}

/**
 * WHETHER A FRAME IS ONE OF THESE SHAPES, for the way out: a looper button
 * (10 00), a looper's picture (23 00), a range read (1A 00), a footswitch
 * read (1B 00), a monitor read (19 00) at a block that is a looper
 * (`isLooper`: the tuner's own question is 19 00 at block 35, and is not
 * this file's), or a write, typed (09 00) or a knob's (52 00), at the unit's
 * Global settings (block 1) or at one of the unit's setup blocks (`isSetup`:
 * a modifier's slot, the Foot Controller). Nothing the wire sent before this
 * file has any of them but "a capture is coming" (a typed write at block 1),
 * which the way out asks about first (namShaped).
 */
export function toolShaped(bytes, model, isLooper = () => false, isSetup = () => false) {
  if (!Array.isArray(bytes) || bytes[0] !== 0xf0 || bytes[4] !== model || bytes[5] !== FN.PARAM || bytes[7] !== 0x00) return false
  const sub = bytes[6]
  if (sub === LOOPER_CONTROL_SUB || sub === WAVEFORM_SUB || sub === RANGE_READ_SUB || sub === FC_READ_SUB) return true
  if (sub === TYPED_SUB || sub === KNOB_SUB) return at14(bytes, 8) === GLOBAL_BLOCK || isSetup(at14(bytes, 8)) === true
  if (sub === MONITOR_SUB) return isLooper(at14(bytes, 8)) === true
  return false
}

/** Whether a frame of those shapes is, byte for byte, one in hand: `hand` is the frame, or a list of the frames in hand at this moment (a looper's button goes beside whatever else is being asked). */
export const toolAllowed = (bytes, hand) => Array.isArray(hand) && (Array.isArray(hand[0]) ? hand.some((h) => sameBytes(bytes, h)) : sameBytes(bytes, hand))
