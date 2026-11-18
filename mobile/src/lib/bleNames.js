/**
 * NAMING THE PRESET AND ITS SCENES FROM THE DEVICE'S OWN WIRE: over
 * Bluetooth, or the unit's USB cable into the phone.
 *
 * "I want to enable all of the items currently available to computer bridge
 * users to Bluetooth" (Justin, 18 November 2026). Through the computer Edit
 * → More → Rename preset and scenes writes the names into the unit's edit
 * buffer; over Bluetooth it was not offered. These are the computer app's
 * own messages, byte for byte (ForgeFX drivers gen3.ts setPresetName and
 * setSceneName, am4.ts the same; forgefx-midi buildRenamePreset,
 * buildSetSceneName, and the AM4's buildSetPresetName and
 * buildSetSceneName), held to the pinned codec's frames by a test:
 *
 *   FM3, FM9, Axe-Fx III   function 0x01, 28 00 (the preset) or 2B 00 (a
 *                          scene, its number where a setting's would be),
 *                          no block, no value, a tail of 32 bytes: the name,
 *                          padded with spaces, packed seven bytes to eight.
 *   AM4                    function 0x01 at CE 01, action 0x0C: the preset's
 *                          at 0B 00 with the location it is on in the first
 *                          four bytes, a scene's at 37 00 + its number with
 *                          those four at nought (the edit buffer's own).
 *
 * THE EDIT BUFFER ONLY. A name is real the moment it is written and kept
 * only by a save, the same as through the computer. NEVER A VP4, whose wire
 * (bleVp4.js) has no such message.
 *
 * A NAME IS PRINTABLE ASCII, 32 PLACES AT MOST: anything else is taken out
 * and the rest cut, as the computer does before it builds the frame
 * (`cleanName`). The way out (bleWire gen3Sender, am4Sender) passes a frame
 * of these shapes only as, byte for byte, the one name being written at
 * that moment (`nameAllowed`).
 *
 * Pure: bytes in, bytes out.
 */
import { AM4, FN, MODELS, am4Frame, encode14, frame, packChunked, sameBytes } from './fractal-sysex.mjs'

/** The most places a name has, on every unit. */
export const NAME_PLACES = 32
/** A gen-3 unit's two name writes: function 0x01, then these. */
export const PRESET_NAME_SUB = Object.freeze([0x28, 0x00])
export const SCENE_NAME_SUB = Object.freeze([0x2b, 0x00])
/** The AM4's: where the names are, the action that writes one, and the two registers. */
export const AM4_NAMES = Object.freeze({ LOW: 0x00ce, ACTION: 0x000c, PRESET: 0x000b, SCENE_BASE: 0x0037 })

const GEN3 = [MODELS.fm3, MODELS.fm9, MODELS.axefx3]

/** A name as it may be written: printable ASCII only, 32 places at most. The computer's own rule (ForgeFX setPresetName). */
export const cleanName = (name) =>
  String(name ?? '')
    .replace(/[^\x20-\x7e]/g, '')
    .slice(0, NAME_PLACES)

/* The 32-byte field: the name, then spaces. */
const field = (name) => {
  const clean = cleanName(name)
  return Array.from({ length: NAME_PLACES }, (_, i) => (i < clean.length ? clean.charCodeAt(i) : 0x20))
}

const sceneOk = (model, index) => Number.isInteger(index) && index >= 0 && index < (model === MODELS.am4 ? AM4.SCENES : 8)

/** A gen-3 unit's name frame: `sub` and the number that goes where a setting's would (a scene's, or 0). */
const gen3Name = (model, sub, index, name) =>
  frame(model, FN.PARAM, [...sub, 0x00, 0x00, ...encode14(index), 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, ...encode14(NAME_PLACES), ...packChunked(field(name))])

/* The AM4's: four bytes (the location, low byte first, or nought) and the 32-byte field, packed. */
const am4Name = (pidHigh, location, name) => {
  const raw = [location & 0xff, (location >>> 8) & 0xff, (location >>> 16) & 0xff, (location >>> 24) & 0xff, ...field(name)]
  return am4Frame({ pidLow: AM4_NAMES.LOW, pidHigh, action: AM4_NAMES.ACTION, hdr3: 0, hdr4: raw.length, payload: packChunked(raw) })
}

/**
 * The frame that names the preset in the edit buffer. `location` is an AM4's
 * own: the location it has just said it is on (0 to 103), which its frame
 * carries; a gen-3 unit's frame names no preset. Null for a model with none,
 * or an AM4 with no location.
 */
export function buildPresetName(model, name, location = null) {
  if (GEN3.includes(model)) return gen3Name(model, PRESET_NAME_SUB, 0, name)
  if (model === MODELS.am4) return Number.isInteger(location) && location >= 0 && location < AM4.LOCATIONS ? am4Name(AM4_NAMES.PRESET, location, name) : null
  return null
}

/** The frame that names scene `index` (from nought) in the edit buffer, or null for a scene the unit has not got. */
export function buildSceneName(model, index, name) {
  if (!sceneOk(model, index)) return null
  if (GEN3.includes(model)) return gen3Name(model, SCENE_NAME_SUB, index, name)
  if (model === MODELS.am4) return am4Name(AM4_NAMES.SCENE_BASE + index, 0, name)
  return null
}

/** Whether these bytes have the shape of a name write for `model`, whatever they name. */
export function nameShaped(bytes, model) {
  if (!Array.isArray(bytes) || bytes[0] !== 0xf0 || bytes[4] !== model || bytes[5] !== FN.PARAM) return false
  if (model === MODELS.am4) return bytes[6] === (AM4_NAMES.LOW & 0x7f) && bytes[7] === (AM4_NAMES.LOW >> 7) && bytes[10] === AM4_NAMES.ACTION && bytes[11] === 0
  return (bytes[6] === PRESET_NAME_SUB[0] || bytes[6] === SCENE_NAME_SUB[0]) && bytes[7] === 0x00
}

/** The one name frame that may go: byte for byte the one being written now (`naming`), and nothing else of the shape. */
export const nameAllowed = (bytes, naming) => Array.isArray(naming) && sameBytes(bytes, naming)

/**
 * An AM4's answer to a name write it took: eighteen bytes, the write's own
 * address and action, and nothing after (forgefx-midi isCommandAck).
 */
export function am4NameTaken(write, answer) {
  if (!Array.isArray(write) || !Array.isArray(answer) || answer.length !== 18 || answer[0] !== 0xf0 || answer[17] !== 0xf7) return false
  for (let i = 0; i < 12; i++) if (answer[i] !== write[i]) return false
  for (let i = 12; i < 16; i++) if (answer[i] !== 0x00) return false
  return true
}

export const NAMES_NOT_OPEN = 'Renaming from the app isn’t available on this connection.'
