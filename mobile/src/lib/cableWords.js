/**
 * A UNIT ON A USB CABLE, IN WORDS: the phone's own, and nowhere else.
 *
 * "I've already used my iPhone and it does connect. It just says it's a
 * Bluetooth connection and not USB, even though it is USB." (Justin, 3
 * November 2026.) An iPhone has always talked to a unit plugged straight
 * into it, the AM4 on a USB-C cable or a USB-MIDI cable into the phone: the
 * module lists every two-way MIDI port, and the Bluetooth page's Connect
 * used it. Every line then said Bluetooth and adapter. Since 3 November 2026
 * a port on Apple's USB MIDI driver (lib/bleAdapters isCable) is named for
 * what it is wherever the app says how it is connected: the Bluetooth page,
 * the Live pill and its note, Settings' rows, Phone & computer and its
 * cards, the waiting screen, Fixes and the log.
 *
 * "USB cable" means the phone's end is USB: a unit straight in, or a
 * USB-MIDI cable straight into the phone. Both are the same thing to the
 * phone, and both are said the same way.
 *
 * PHONE-ONLY, ON PURPOSE. Nothing here is in shared/: the website and the
 * computer app import the shared words (pill-words, link-chain, no-computer,
 * report-rules), and a change there is a new computer release for a phone
 * feature. A browser never has a cable to the unit.
 *
 * WHAT IS SAID, AND WHAT IS NOT. Only how it is connected: no new way to
 * connect is offered, nothing says a cable works on a unit it has not run
 * on, and no line says what has been tried (that is the Developer page's).
 * No lag claim either: nothing has measured one. The FM3 is the one unit
 * that can never be on one: its USB port is the computer's kind, not MIDI,
 * so it says so (fm3NoCable). The device in hand is named by the caller
 * (lib/device-word deviceNoun), never "this phone".
 *
 * Pure: no imports, so a test reads it as it is.
 */

/* The pill's second line, where Bluetooth's says "over Bluetooth". */
export const CABLE_WHERE = 'by USB cable'

/* Settings → Bluetooth's row while it is on, and Phone & computer's button to the page. */
export const CABLE_ROW_ON = 'On · USB cable'
export const CABLE_PAGE_SUB = 'By USB cable: open its page'

/* The page's list, beside a unit on a cable. */
export const CABLE_ROW = 'USB cable'
export const CABLE_ROW_AWAY = 'USB cable · not plugged in'

/* The waiting screen's, the Phone & computer page's and the pill note's one way out, and Look again. */
export const CABLE_LOOK_AGAIN = 'Look for the unit again'
export const CABLE_OFF = 'Use the computer instead'

/* The page, while it connects. */
export const CABLE_CONNECTING_HINT = 'If this stays here, check the USB cable is in at both ends and the unit is switched on.'
/* A cable chosen that is not plugged in now: it connects by itself when it is (bleLink heardDevices). */
export const CABLE_AWAY = 'The USB cable isn’t plugged in. Plug it back in and it connects by itself.'
/* The waiting screen, after fifteen seconds. */
export const CABLE_WAITING = 'Check the USB cable is in at both ends, and the unit is switched on.'
/* Still nothing after a replug: what worked for the adapter (shared/bluetooth-gear CLOSE_AND_REOPEN), for the cable. */
export const CABLE_CLOSE_AND_REOPEN =
  'Still not connecting after unplugging and plugging the USB cable back in? Close the app completely (swipe it away) and open it again.'
/* A VP4 on a cable says nothing back, as over Bluetooth (lib/bleVp4.js): the line says the cable is connected, never that it answers. */
export const CABLE_VP4_CONNECTED = 'Connected by USB cable · sending to the VP4'
export const CABLE_VP4_CANT_HEAR =
  'The app can’t hear a VP4, so this only says the USB cable is connected. If presets don’t change, check on the VP4 that SETUP > MIDI/Remote has Receive MIDI PC ON.'

/** The page's Connect hint, with the cable kept from last time. */
export const cableKeptHint = (name) => `Uses ${name || 'the unit'}, plugged in by USB cable, from last time.`

/** The same, with none kept and the cables plugged in now (lib/bleAdapters cablesIn). */
export function cableListedHint(cables) {
  const list = Array.isArray(cables) ? cables : []
  if (list.length === 1) return `Uses ${list[0]?.name || 'the unit'}, plugged in by USB cable.`
  return 'More than one is plugged in by USB cable. Tap Connect, then tap yours.'
}

/**
 * The page's big line once it is connected by cable: the unit answering, a
 * VP4 sent to (never answering: it cannot be heard), not answering, or
 * being asked. `name` is the unit's name as the page writes it.
 */
export function cableStatus({ unit, name, unitState } = {}) {
  if (unit === 'vp4') return { line: CABLE_VP4_CONNECTED, tone: 'ok' }
  if (unitState === 'present') return { line: `Connected by USB cable · ${name} answering`, tone: 'ok' }
  if (unitState === 'missing' || unitState === 'silent') {
    return { line: `Connected by USB cable, but the ${name} isn’t answering. Check it’s switched on and the cable is in at both ends.`, tone: 'fault' }
  }
  return { line: `Connected by USB cable · asking the ${name}…`, tone: 'dim' }
}

/** The page's big line while a cable connects. */
export const cableConnectingLine = (name) => `Connecting to ${name || 'the unit'} by USB cable…`

/*
 * THE FM3 CANNOT PLUG IN BY ITS USB PORT. Its USB is the computer's kind
 * (serial ports for FM3-Edit), not MIDI, so no phone lists it. Said
 * whenever the FM3 is picked, beside its own red warning, which is about
 * Bluetooth adapters and stays exactly as it is.
 */
export const fm3NoCable = (noun) =>
  `The FM3’s own USB port can’t plug into this ${noun}. It connects through the computer, or by Bluetooth with an adapter on its MIDI ports.`

/** Troubleshooting, with a cable chosen: what to check, in the order worth trying. */
export const cableSteps = (noun) => [
  `Plug the USB cable straight into the unit’s USB port and this ${noun}’s, with no hub in between.`,
  `If the plugs don’t fit, use a cable with the right plug at each end, or a USB plug adapter for this ${noun}’s socket.`,
  'Switch the unit on, and wait for it to finish starting up.',
  CABLE_CLOSE_AND_REOPEN
]

/** The Settings row's line under Phone & computer, while it is on by cable. */
export function cableRowWord({ link, unitState, unit } = {}) {
  if (link === 'connected') return unitState === 'missing' || unitState === 'silent' ? `USB cable · ${unit || 'unit'} not answering` : `${unit || 'Unit'} · USB cable`
  return link === 'joining' ? 'USB cable · looking for the unit' : 'USB cable · not connected'
}

/** Phone & computer's note at its top, while it is on by cable. No lag claim: nothing has measured one. */
export const cableComputerNote = (noun) =>
  `Connected by USB cable: this ${noun} talks to the unit itself, not through the computer. Some things still need the computer app.`

/** Playing with no internet, while it is on by cable: nothing to change. */
export const CABLE_NO_SIGNAL = 'You’re on a USB cable to the unit, which needs no internet, so there is nothing to change.'

/** Fixes, under the computer's version line. */
export const cableFixesLine = (noun) => `Over a USB cable this ${noun} talks to the unit itself, so no computer app is in use.`

/** The Live pill's note: how it is connected, in each state of the link. */
export function cableNote(link) {
  const name = link?.macName || 'the unit'
  if (link?.link === 'connected') return `Connected by USB cable, to ${name}.`
  if (link?.link === 'joining') return `Finding ${name}…`
  return 'The USB cable isn’t connected.'
}

/**
 * PHONE & COMPUTER'S CARDS, ON A CABLE. lib/link-chain, which the browser
 * draws from too, knows the computer and the Bluetooth adapter. A cable is
 * neither: the unit and this device, with the cable between them. So the
 * cards it makes for Bluetooth are mapped here: the adapter's card goes,
 * the unit's wire is the USB cable, and the unit's own lines say the cable
 * where they said the adapter and its MIDI plugs. The device's card is
 * link-chain's, untouched. A wire is lit when both its ends answer, as there.
 */
export function cableChain(cards, { link, unitState, unit } = {}) {
  const name = unit || 'Your unit'
  const reached = link === 'connected'
  const kept = (Array.isArray(cards) ? cards : []).filter((c) => c && c.key !== 'adapter')
  const mapped = kept.map((c) => {
    if (c.key !== 'unit') return c
    if (!reached) return { ...c, ...(link === 'joining' ? { body: `Looking for ${unit || 'the unit'} on the USB cable…`, tone: 'busy' } : { body: 'Reached by USB cable', tone: 'dim' }), wire: 'USB CABLE' }
    if (unitState === 'missing') return { ...c, body: `${name} isn’t answering on the USB cable. Check it is switched on, and the cable is in at both ends.`, tone: 'bad', wire: 'USB CABLE' }
    return { ...c, wire: 'USB CABLE' }
  })
  return mapped.map((card, i, all) => ({ ...card, lit: card.wire ? card.tone === 'good' && all[i + 1]?.tone === 'good' : undefined }))
}
