/**
 * SAVING A PRESET FROM THE PHONE, OVER BLUETOOTH OR THE UNIT'S USB CABLE:
 * the two messages, and the rule that holds them.
 *
 * "It still says we can't save in Bluetooth when you pull up the quick edit
 * menus and stuff. Please enable that and remove the warning." (Justin, 13
 * November 2026.) Saving was the computer's: through a computer the phone
 * leaves a request and the app at the computer writes the slot
 * (lib/saveViaComputer). Over Bluetooth there is no computer, so a change
 * played and was lost at the next preset change unless it was saved on the
 * unit's own front panel.
 *
 * WHAT IS SENT is what the computer app sends for its own Save, byte for
 * byte, and nothing else:
 *
 *   - an FM3, FM9 or Axe-Fx III: function 0x01, sub-action 26 00, at no
 *     block and no setting, the slot as a fourteen-bit number
 *     (forgefx-midi buildStorePreset, which ForgeFX's gen-3 driver sends for
 *     POST /preset/store);
 *   - an AM4: action 0x1B on register 0, the location as a whole number
 *     (forgefx-midi buildSaveToLocation, "hardware-confirmed byte-exact
 *     against a live AM4 capture" in ForgeFX's own words).
 *
 * Both are held by test/bluetooth.mjs to frames those builders made at the
 * pinned commit. NEVER A VP4: the only save a VP4 has been seen to accept
 * writes Y1 whatever slot was picked (lib/vp4-safety), and a VP4's wire
 * sends nothing of this file's.
 *
 * ONLY OVER THE PRESET THE UNIT IS ON. A save writes the unit's whole edit
 * buffer over a slot, and the only slot that is ever right is the one it was
 * loaded from: this file builds no "save to another slot". The wire asks the
 * unit which preset it is on straight before it sends, and sends only if
 * that is the slot the screen meant (bleWire storePreset); and its way out
 * passes a frame of either shape only when it is, byte for byte, the save
 * to that one slot (`saveAllowed`), for as long as that save is being sent.
 * Any other frame of the shape, a save with no save going, a save to
 * another slot: refused, with nothing sent.
 *
 * Pure: it imports the phone's own byte helpers and nothing else.
 */
import { AM4, FN, MODELS, am4Frame, am4U32, encode14, frame, sameBytes } from './fractal-sysex.mjs'

/** A gen-3 unit's save: function 0x01 with this sub-action (forgefx-midi buildStorePreset). */
export const STORE_SUB = Object.freeze([0x26, 0x00])
/** An AM4's save: this action (forgefx-midi buildSaveToLocation). */
export const AM4_SAVE = 0x1b

/** The gen-3 units a save is built for, by model byte. */
const GEN3 = Object.freeze([MODELS.fm3, MODELS.fm9, MODELS.axefx3])
/* A slot's number on the wire is fourteen bits; no unit has more than 1024 presets. */
const SLOT_MOST = 1023

/** Save the edit buffer over preset `slot` on an FM3, FM9 or Axe-Fx III. */
export function buildGen3Store(model, slot) {
  if (!GEN3.includes(model)) throw new Error(`0x${Number(model).toString(16)} is not a unit a save is built for`)
  if (!Number.isInteger(slot) || slot < 0 || slot > SLOT_MOST) throw new Error(`preset ${slot} is not one a unit has`)
  return frame(model, FN.PARAM, [...STORE_SUB, 0, 0, 0, 0, ...encode14(slot), 0, 0, 0, 0, 0, 0, 0])
}

/** Save the edit buffer over location `location` on an AM4 (0 to 103). */
export function buildAm4Save(location) {
  if (!Number.isInteger(location) || location < 0 || location >= AM4.LOCATIONS) throw new Error(`location ${location} is not 0..${AM4.LOCATIONS - 1}`)
  return am4Frame({ pidLow: 0, pidHigh: 0, action: AM4_SAVE, hdr4: 4, payload: am4U32(location) })
}

/** The save for this unit, by its model byte, or null where none is built. */
export function buildSave(model, slot) {
  try {
    return model === MODELS.am4 ? buildAm4Save(slot) : buildGen3Store(model, slot)
  } catch {
    return null
  }
}

/**
 * Whether these bytes have the shape of a save for this model, whatever slot
 * they name: the way out refuses every frame of the shape that is not the
 * one save being sent.
 */
export function saveShaped(bytes, model) {
  if (!Array.isArray(bytes) || bytes[0] !== 0xf0 || bytes[4] !== model || bytes[5] !== FN.PARAM) return false
  if (model === MODELS.am4) return bytes.length >= 12 && bytes[10] === AM4_SAVE && bytes[11] === 0x00
  return GEN3.includes(model) && bytes[6] === STORE_SUB[0] && bytes[7] === STORE_SUB[1]
}

/** Whether these bytes are, byte for byte, the save over `slot` on this model. */
export const saveAllowed = (bytes, model, slot) => Number.isInteger(slot) && sameBytes(bytes, buildSave(model, slot) || [])

/** What Save says when the unit has moved to another preset since the change. */
export const saveElsewhere = (on) =>
  Number.isInteger(on) && on >= 0 ? 'The unit is on another preset now, so nothing was saved. Go back to the preset you changed and save again.' : 'The unit didn’t say which preset it is on, so nothing was saved. Try again.'

/** What Save says where saving from the app is not open on this connection. */
export const SAVE_NOT_OPEN = 'Saving from the app isn’t available on this connection. Save on the unit itself.'
