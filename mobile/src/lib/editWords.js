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
 * else in Edit needs the computer (Edit's own noChainLine, below, and copying a
 * channel). So what Edit DOES is the paragraph's (`EDIT_DOES`), and what it
 * does not is the list's first line, said once each.
 */
export const EDIT_DOES = 'In Edit: knobs, models and effects on and off.'
export const EDITING_LINE = 'No saving over Bluetooth: save on the unit itself. Moving, adding and removing blocks, modifiers, renaming and copying a channel need the computer.'
/*
 * AND WHERE THE APP SAVES OVER BLUETOOTH (lib/bleSave; `saves`, lib/features
 * SAVE_OVER_BLUETOOTH_FOR_EVERYONE): "It still says we can't save in
 * Bluetooth ... Please enable that and remove the warning." (Justin, 13
 * November 2026.) Save joins what Edit does, and the list's first line
 * loses its sentence about saving.
 *
 * AND QUICK BUILD WITH IT, since 2.0.0 (17 November 2026: "Enable all new
 * features for all users that were on my account"). Saving, the chain over
 * Bluetooth (CHAIN_OVER_BLUETOOTH_FOR_EVERYONE) and Quick build
 * (QUICK_BUILD_FOR_EVERYONE) open together, for his account and for every
 * account (a test holds the three switches equal), so where the app saves
 * Quick build puts blocks into an empty preset and joins them, and what
 * still needs the computer is the chain EDITOR: one block moved, added or
 * removed in a chain that has blocks (Edit's noChainLine, below, says the same).
 * Where it does not save, the two lines above, word for word as before.
 */
export const EDIT_DOES_SAVES = 'In Edit: knobs, models, effects on and off, Save, and Quick build on an empty preset.'
export const EDITING_LINE_SAVES = 'Moving, adding or removing a block in a chain that has blocks, modifiers, renaming and copying a channel need the computer.'
/*
 * EDIT → MORE'S OWN LINE over Bluetooth or a USB cable (Edit draws it where
 * the chain editor's row would be): what is not there. It follows whether
 * Quick build is offered on this connection (`quick`: lib/quickBuild
 * quickBuildHere, which wants the account to have Quick build and the wire
 * to say `gridEdit`), so the line never names Quick build where it is not
 * drawn. Said plainly either way, no "for now".
 */
export const NO_CHAIN_LINE = 'Moving, adding and removing blocks, modifiers and renaming need the computer.'
export const NO_CHAIN_LINE_QUICK = 'Quick build fills an empty preset. Moving, adding or removing a block in a chain that has blocks, modifiers and renaming need the computer.'
/*
 * AND WHERE MORE OF THE COMPUTER'S TOOLS ARE HERE (18 November 2026: "I want
 * to enable all of the items currently available to computer bridge users to
 * Bluetooth like chain editing"): the chain editor (`editor`: the wire's
 * capabilities `chainEditor`, lib/features
 * CHAIN_EDITOR_OVER_BLUETOOTH_FOR_EVERYONE) and Rename with Copy channel
 * (`tools`: capabilities `namesWritable`, lib/features
 * EDIT_TOOLS_OVER_BLUETOOTH_FOR_EVERYONE). Each line names only what is
 * still the computer's on this connection. With neither, the two lines
 * above, word for word as before.
 */
export const NO_CHAIN_LINE_EDITOR = 'Modifiers and renaming need the computer.'
export const NO_CHAIN_LINE_TOOLS = 'Moving, adding and removing blocks, and modifiers, need the computer.'
export const NO_CHAIN_LINE_TOOLS_QUICK = 'Quick build fills an empty preset. Moving, adding or removing a block in a chain that has blocks, and modifiers, need the computer.'
export const NO_CHAIN_LINE_BOTH = 'Modifiers need the computer.'
/*
 * AND WHERE MODIFIERS ARE HERE TOO (`mods`: the wire's capabilities
 * `modifiers.overWire`, lib/features MODIFIERS_OVER_BLUETOOTH_FOR_EVERYONE):
 * each line as above with modifiers left out of it, and with everything
 * here there is no line at all (null).
 */
export const NO_CHAIN_LINE_MODS = 'Moving, adding and removing blocks, and renaming, need the computer.'
export const NO_CHAIN_LINE_MODS_QUICK = 'Quick build fills an empty preset. Moving, adding or removing a block in a chain that has blocks, and renaming, need the computer.'
export const NO_CHAIN_LINE_MODS_EDITOR = 'Renaming needs the computer.'
export const NO_CHAIN_LINE_MODS_TOOLS = 'Moving, adding and removing blocks needs the computer.'
export const NO_CHAIN_LINE_MODS_TOOLS_QUICK = 'Quick build fills an empty preset. Moving, adding or removing a block in a chain that has blocks needs the computer.'
export const noChainLine = (quick = false, { editor = false, tools = false, mods = false } = {}) => {
  if (mods === true) {
    if (editor === true) return tools === true ? null : NO_CHAIN_LINE_MODS_EDITOR
    if (tools === true) return quick === true ? NO_CHAIN_LINE_MODS_TOOLS_QUICK : NO_CHAIN_LINE_MODS_TOOLS
    return quick === true ? NO_CHAIN_LINE_MODS_QUICK : NO_CHAIN_LINE_MODS
  }
  if (editor === true) return tools === true ? NO_CHAIN_LINE_BOTH : NO_CHAIN_LINE_EDITOR
  if (tools === true) return quick === true ? NO_CHAIN_LINE_TOOLS_QUICK : NO_CHAIN_LINE_TOOLS
  return quick === true ? NO_CHAIN_LINE_QUICK : NO_CHAIN_LINE
}

/*
 * The Bluetooth page's two lines where the chain editor or the smaller tools
 * are here too (`editor`, `tools`, as noChainLine above; only ever with
 * `saves`, since both stand on the chain being open, which opens with
 * saving). What Edit does gains them, and the list's first line loses them.
 */
export const EDIT_DOES_EDITOR = 'In Edit: knobs, models, effects on and off, Save, Quick build, and blocks moved, added and removed.'
export const EDIT_DOES_TOOLS = 'In Edit: knobs, models, effects on and off, Save, Quick build on an empty preset, renaming and copying a channel.'
export const EDIT_DOES_BOTH = 'In Edit: knobs, models, effects on and off, Save, Quick build, blocks moved, added and removed, renaming and copying a channel.'
export const EDITING_LINE_EDITOR = 'Modifiers, renaming and copying a channel need the computer.'
export const EDITING_LINE_TOOLS = 'Moving, adding or removing a block in a chain that has blocks, and modifiers, need the computer.'
export const EDITING_LINE_BOTH = 'Modifiers need the computer.'
const more = (saves, { editor = false, tools = false } = {}) => (saves === true ? (editor === true ? (tools === true ? 'both' : 'editor') : tools === true ? 'tools' : null) : null)

/* The same lines where modifiers are here too (`here.mods`): modifiers left out, and with everything here no line at all (null). */
export const EDITING_LINE_MODS = 'No saving over Bluetooth: save on the unit itself. Moving, adding and removing blocks, renaming and copying a channel need the computer.'
export const EDITING_LINE_MODS_SAVES = 'Moving, adding or removing a block in a chain that has blocks, renaming and copying a channel need the computer.'
export const EDITING_LINE_MODS_EDITOR = 'Renaming and copying a channel need the computer.'
export const EDITING_LINE_MODS_TOOLS = 'Moving, adding or removing a block in a chain that has blocks needs the computer.'
/** And what Edit does, with modifiers: the sentence after whichever of the others applies. */
export const EDIT_DOES_MODS = 'Modifiers can be attached.'

/** "What's different from USB", its first line, or null where nothing of Edit's is left to the computer. */
export const editingLine = (open, saves = false, here = {}) => {
  if (open !== true) return NO_EDITING_LINE
  if (here?.mods === true) {
    const m = more(saves, here)
    if (m) return { both: null, editor: EDITING_LINE_MODS_EDITOR, tools: EDITING_LINE_MODS_TOOLS }[m]
    return saves === true ? EDITING_LINE_MODS_SAVES : EDITING_LINE_MODS
  }
  const m = more(saves, here)
  if (m) return { both: EDITING_LINE_BOTH, editor: EDITING_LINE_EDITOR, tools: EDITING_LINE_TOOLS }[m]
  return saves === true ? EDITING_LINE_SAVES : EDITING_LINE
}

/*
 * "WHAT'S DIFFERENT FROM USB", ITS LAST LINE: what is not there over
 * Bluetooth at all. Found by their absence until the line was written:
 * every one of them is hidden over Bluetooth, not broken. And where the
 * volume button IS there (`volume`, lib/bluetooth volumeOverBluetooth: the
 * Output block handed on by the wire, every account's since lib/features
 * OUTPUT_AND_SCENE_LEVELS_FOR_EVERYONE (2.0.0, 17 November 2026; his alone before), on an FM3, FM9 or Axe-Fx III with
 * Edit open), the line does not say it is missing. An AM4, and a unit
 * whose Edit is not open over Bluetooth, reads the first, word for word as
 * before.
 */
export const NOT_OVER_BLUETOOTH = 'No looper, volume button, unit metronome click or Footswitches page.'
export const NOT_OVER_BLUETOOTH_VOLUME = 'No looper, unit metronome click or Footswitches page.'
/* What may be missing, in the line's order. */
const NOT_THERE = [
  ['looper', 'looper'],
  ['volume', 'volume button'],
  ['click', 'unit metronome click'],
  ['footswitches', 'Footswitches page']
]
/**
 * The line, less whatever IS there: the volume button (`volume`), and of
 * `here` the looper, the unit's click and the Footswitches page (lib/bluetooth
 * looperOverBluetooth, unitClickOverBluetooth). With nothing more than the
 * volume button it is one of the two sentences above, word for word; with
 * everything there, there is no line (null).
 */
export const notOverBluetoothLine = (volume = false, here = {}) => {
  const there = { volume: volume === true, looper: here?.looper === true, click: here?.click === true, footswitches: here?.footswitches === true }
  const missing = NOT_THERE.filter(([key]) => !there[key]).map(([, words]) => words)
  if (!missing.length) return null
  if (missing.length === 1) return `No ${missing[0]}.`
  return `No ${missing.slice(0, -1).join(', ')} or ${missing[missing.length - 1]}.`
}

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
/** The paragraph: closed, open, or open with the app's own Save, and with the chain editor or the smaller tools where they are here (`here`: { editor, tools }). */
export const limitsLine = (open, saves = false, here = {}) => {
  if (open !== true) return LIMITS_CLOSED
  const m = more(saves, here)
  const line = m ? `${LIMITS_DOES} ${{ both: EDIT_DOES_BOTH, editor: EDIT_DOES_EDITOR, tools: EDIT_DOES_TOOLS }[m]}` : saves === true ? LIMITS_SAVES : LIMITS_OPEN
  /* And modifiers, where they are here (`here.mods`). */
  return here?.mods === true ? `${line} ${EDIT_DOES_MODS}` : line
}
