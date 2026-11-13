/**
 * EDIT OVER BLUETOOTH AND A USB CABLE, IN WORDS: what Play says when Edit
 * does not open there, and what the Bluetooth page says editing does there.
 *
 * "Why isn't the edit buttons working on iPad? They should work on all
 * devices now." (Justin, 8 November 2026.) Nothing was wrong with the iPad:
 * over Bluetooth, or a unit on a USB cable into the phone (the same wire,
 * lib/bleAdapters isCable), Play drew no Edit button at all wherever Edit is
 * not open there (lib/ble-rule.js editOffered: every customer on every unit
 * until a store version opens it), and nothing said why. So the button stays
 * where it always is, and a tap says why in one line (App.js editExplained),
 * on the four units whose editing is built: the AM4, FM3, FM9 and Axe-Fx
 * III. Never on a VP4, which has no knob editing anywhere.
 *
 * WHAT IS SAID, AND WHAT IS NOT. Only what is true on every copy out today:
 * editing works through a computer, and what Play does without one. Never
 * "yet" or "coming", and no unit named as one that edits over Bluetooth:
 * every copy was reviewed with notes, and a listing, that say editing does
 * not work over Bluetooth, and a promise of it is a feature described
 * before its review. The device in hand is never named: nothing here needs
 * it, and "this phone" is never written (lib/device-word).
 *
 * ONE PLACE, held by test/bluetooth.mjs: Play's line on a cable and over an
 * adapter are one sentence with the connection's own words in it, and the
 * Bluetooth page's two forms are chosen here by the one switch, so a copy
 * whose Edit is closed says today's words exactly.
 *
 * Pure: no imports, so a test reads it as it is. Phone-only, like
 * lib/cableWords: nothing in shared/, which the computer app carries.
 */

/**
 * PLAY'S EDIT, TAPPED WHERE EDIT DOES NOT OPEN over Bluetooth or a USB
 * cable: why, in one line, said over Play for a few seconds
 * (components/EditWhy). `cable` when the unit is on a USB cable into the
 * phone, so the line says the cable that is in, never Bluetooth.
 */
export const editThroughComputer = ({ cable = false } = {}) =>
  `Editing works through a computer. ${cable ? 'On the USB cable' : 'Over Bluetooth'}, Play changes presets and scenes and turns effects on and off.`

/* How long Play says it, unless a screen reader is on (components/Toast useStillNews). */
export const EDIT_WHY_MS = 5000

/*
 * THE BLUETOOTH PAGE'S EDITING LINES, for the unit picked on it
 * (screens/Bluetooth.js), by the same switch as Play's Edit
 * (lib/bluetooth editOverBluetooth): closed, today's words exactly, which is
 * what every customer copy shows until a store version opens editing on the
 * unit; open, what Edit does there (his account, and a unit a store version
 * has opened, lib/ble-rule.js EDIT_FROM_STORE).
 */
export const NO_EDITING_LINE = 'No editing or saving over Bluetooth.'
/*
 * THE OPEN FORM, REVIEWED 12 NOVEMBER 2026. "Review this section again now
 * that we've made lots of changes to Bluetooth I think we can actually save
 * on Bluetooth now and I don't know that there's really anything else that
 * we can't do on Bluetooth so we can do on the computer yet correct? If so,
 * what are those items?" (Justin, with a picture of the page.) Saving over
 * Bluetooth is not built (bleWire says `supportsSave: false`; saving is the
 * computer's, lib/saveViaComputer), so the page was right about that. It
 * was wrong two other ways: it said the same sentence twice, once in the
 * paragraph and again as the first line of the list, and it left out what
 * else in Edit needs the computer (Edit's own BLE_NO_CHAIN, and copying a
 * channel). So what Edit DOES is the paragraph's (`EDIT_DOES`), and what it
 * does not is the list's first line, said once each.
 */
export const EDIT_DOES = 'In Edit: knobs, models and effects on and off.'
export const EDITING_LINE = 'No saving over Bluetooth: save on the unit itself. Moving, adding and removing blocks, modifiers, renaming and copying a channel need the computer.'
/*
 * AND WHERE THE APP SAVES OVER BLUETOOTH (lib/bleSave; `saves`: his account
 * until a store version opens it, lib/features
 * SAVE_OVER_BLUETOOTH_FOR_EVERYONE): "It still says we can't save in
 * Bluetooth ... Please enable that and remove the warning." (Justin, 13
 * November 2026.) Save joins what Edit does, and the list's first line
 * loses its sentence about saving. Every other account reads the two lines
 * above, word for word as before.
 */
export const EDIT_DOES_SAVES = 'In Edit: knobs, models, effects on and off, and Save.'
export const EDITING_LINE_SAVES = 'Moving, adding and removing blocks, modifiers, renaming and copying a channel need the computer.'
/** "What's different from USB", its first line. */
export const editingLine = (open, saves = false) => (open !== true ? NO_EDITING_LINE : saves === true ? EDITING_LINE_SAVES : EDITING_LINE)

/**
 * WHETHER EDIT'S ONE-TIME NOTE IS UP over Bluetooth or a USB cable (Edit's
 * BLE_NOTE and lib/cableWords CABLE_EDIT_NOTE, in Edit, the panel beside
 * Play and the hold pop-up). The note says a change plays and is not kept
 * unless it is saved on the unit itself: where the app saves there
 * (`saves`), that is not true, and the note is not drawn at all. `up` is
 * whether it has not been put away on this device (lib/coach).
 */
export const editNoteUp = ({ viaBle = false, up = false, saves = false } = {}) => viaBle === true && up === true && saves !== true

/* What Bluetooth does, the page's paragraph over that list, for every unit but the VP4 (which has its own, VP4_OVER_BLUETOOTH). */
export const LIMITS_DOES = 'Presets, scenes, names, effects on and off, channels, tempo and the tuner, with no computer.'
export const LIMITS_CLOSED = `${LIMITS_DOES} No editing or saving.`
export const LIMITS_OPEN = `${LIMITS_DOES} ${EDIT_DOES}`
export const LIMITS_SAVES = `${LIMITS_DOES} ${EDIT_DOES_SAVES}`
/** The paragraph: closed, open, or open with the app's own Save. */
export const limitsLine = (open, saves = false) => (open !== true ? LIMITS_CLOSED : saves === true ? LIMITS_SAVES : LIMITS_OPEN)
