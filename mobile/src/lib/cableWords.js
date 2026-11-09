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
 * phone, and both are said the same way, until something has to be checked:
 * a USB MIDI cable on the unit's MIDI jacks (`jacks`, lib/bluetooth
 * midiJacks: its port is named for no unit, a "C2MIDI Pro") has MIDI plugs
 * that can be swapped, and keeps the plug checks; a unit on its own USB
 * cable has none.
 *
 * PHONE-ONLY, ON PURPOSE. Nothing here is in shared/: the website and the
 * computer app import the shared words (pill-words, link-chain, no-computer,
 * report-rules), and a change there is a new computer release for a phone
 * feature. A browser never has a cable to the unit.
 *
 * WHAT IS SAID, AND WHAT IS NOT. How it is connected, and, since 9
 * November 2026, the one cable way the app has run on that nobody would
 * guess: a USB MIDI cable on the FM3's MIDI ports, the U2MIDI Pro, straight
 * into the device in hand (fm3CableLine, FM3_CABLE_WAY), with Use the USB
 * cable on the page for any cable plugged in that Connect is not using
 * (CABLE_USE_HERE). Nothing says a cable works on a unit it has not run on,
 * and no line says what has been tried (that is the Developer page's).
 * No lag claim either: nothing has measured one. The FM3's own USB port is
 * the computer's kind, not MIDI, so it can never plug in by that, and says
 * so (fm3CableLine). The device in hand is named by the caller
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
/*
 * And the other way off a cable, beside it: "Use computer instead should say
 * use Bluetooth or computer instead" (Justin, 6 November 2026). The adapter
 * kept before the cable when there is one, or the Bluetooth page's Connect
 * (lib/bluetooth adapterInsteadOfCable).
 */
export const CABLE_TO_ADAPTER = 'Use a Bluetooth adapter instead'
export const CABLE_TO_ADAPTER_SUB = 'Instead of the USB cable'

/**
 * THE BLUETOOTH PAGE'S WAY OFF, WHILE IT IS ON, said for what is connected
 * now. "It says stop using Bluetooth when it was last connected with USB.
 * Nothing should say stop using a device that's not plugged in." (Justin, 6
 * November 2026.) So: Stop using the USB cable, or Stop using Bluetooth,
 * only while that one is connected; while it is not (unplugged, or an
 * adapter not there), the way it goes instead, the computer. The same
 * switch either way (setBluetooth(false)).
 */
export function leaveWords({ cable = false, connected = false } = {}) {
  if (!connected) return { label: 'Use the computer instead', sub: cable ? 'The USB cable isn’t plugged in' : 'Goes back to the computer' }
  return { label: cable ? 'Stop using the USB cable' : 'Stop using Bluetooth', sub: 'Goes back to the computer' }
}

/*
 * EDIT'S NOTE ON A USB CABLE, where it says BLE_NOTE over a Bluetooth
 * adapter (screens/Edit.js): the same wire, so the same three things and
 * the same no saving, said for the cable that is in.
 */
export const CABLE_EDIT_NOTE =
  'On the USB cable you can turn knobs, change models and switch blocks on and off. Changes play right away, but the app can’t save them over the USB cable yet: to keep a change, save it on the unit itself before you change presets.'

/* The page, while it connects. */
export const CABLE_CONNECTING_HINT = 'If this stays here, check the USB cable is in at both ends and the unit is switched on.'
/* A cable chosen that is not plugged in now: it connects by itself when it is (bleLink heardDevices). */
export const CABLE_AWAY = 'The USB cable isn’t plugged in. Plug it back in and it connects by itself.'
/* The page's Connect hint, off, with the cable kept not plugged in: Connect uses a Bluetooth adapter then (lib/bluetooth adapterInsteadOfCable). */
export const cableAwayHint = (adapter) =>
  adapter
    ? `The USB cable isn’t plugged in. Plug it in to use it, or tap Connect to use ${adapter} again.`
    : 'The USB cable isn’t plugged in. Plug it in to use it, or tap Connect to find a Bluetooth adapter.'
/* The waiting screen, after fifteen seconds. */
export const CABLE_WAITING = 'Check the USB cable is in at both ends, and the unit is switched on.'
/* Still nothing after a replug: what worked for the adapter (shared/bluetooth-gear CLOSE_AND_REOPEN), for the cable. */
export const CABLE_CLOSE_AND_REOPEN =
  'Still not connecting after unplugging and plugging the USB cable back in? Close the app completely (swipe it away) and open it again.'
/* A VP4 on a cable says nothing back, as over Bluetooth (lib/bleVp4.js): the line says the cable is connected, never that it answers. */
export const CABLE_VP4_CONNECTED = 'Connected by USB cable · sending to the VP4'
export const CABLE_VP4_CANT_HEAR =
  'The app can’t hear a VP4, so this only says the USB cable is connected. If presets don’t change, check on the VP4 that SETUP > MIDI/Remote has Receive MIDI PC ON.'
/* The same, for a USB MIDI cable on the VP4's MIDI jacks: its black plug in MIDI IN first, as VP4_CANT_HEAR says for an adapter's. */
export const CABLE_VP4_CANT_HEAR_JACKS =
  'The app can’t hear a VP4, so this only says the USB cable is connected. If presets don’t change, check the black plug is in the VP4’s MIDI IN, and on the VP4 that SETUP > MIDI/Remote has Receive MIDI PC ON.'

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
 * being asked. `name` is the unit's name as the page writes it. Not
 * answering through a USB MIDI cable on its jacks (`jacks`) is the MIDI
 * plugs first, as it is for an adapter (shared/bluetooth-gear
 * notAnsweringLine): the Axe-Fx III's white plug in MIDI OUT, not THRU.
 */
export function cableStatus({ unit, name, unitState, jacks = false } = {}) {
  if (unit === 'vp4') return { line: CABLE_VP4_CONNECTED, tone: 'ok' }
  if (unitState === 'present') return { line: `Connected by USB cable · ${name} answering`, tone: 'ok' }
  if (unitState === 'missing' || unitState === 'silent') {
    if (jacks) {
      const plugs = unit === 'axefx3' ? 'Check both MIDI plugs: the white one goes in MIDI OUT, not THRU.' : 'Check both MIDI plugs, and that MIDI Thru is off.'
      return { line: `Connected by USB cable, but the ${name} isn’t answering. ${plugs}`, tone: 'fault' }
    }
    return { line: `Connected by USB cable, but the ${name} isn’t answering. Check it’s switched on and the cable is in at both ends.`, tone: 'fault' }
  }
  return { line: `Connected by USB cable · asking the ${name}…`, tone: 'dim' }
}

/** The page's big line while a cable connects. */
export const cableConnectingLine = (name) => `Connecting to ${name || 'the unit'} by USB cable…`

/*
 * THE FM3: NOT BY ITS OWN USB PORT, BUT BY A USB MIDI CABLE ON ITS MIDI
 * PORTS. Its USB is the computer's kind (serial ports for FM3-Edit), not
 * MIDI, so no phone lists it. A USB MIDI cable on its MIDI jacks is MIDI,
 * and the U2MIDI Pro, the FM3's own cable (shared/bluetooth-gear FM3_NEVER),
 * plugs straight into the device in hand: "Lots of issues connecting FM3
 * with U2midi pro. Finally did connect though" (Justin, 9 November 2026,
 * iPad), after this line had said only the computer or Bluetooth. Said
 * whenever the FM3 is picked on a copy where a unit can plug in by cable at
 * all (lib/bluetooth cablesHere: an iPhone or iPad, and Android from the
 * build that lists USB), beside its own red warning, which is about what
 * goes on its MIDI ports and stays exactly as it is.
 */
/*
 * THE BUTTON THAT TAKES IT, NAMED. Connect goes to a Bluetooth adapter kept
 * from last time, or to Apple's screen beside one already connected, and
 * never to the cable then: the path from bug 8519c338. Use the USB cable
 * (CABLE_USE_HERE) is drawn for the cable in exactly those states, and where
 * it is not drawn, Connect takes the cable itself. So the line names that
 * button first, and Connect for when it is not there.
 *
 * ONLY THE U2MIDI PRO, never "any USB MIDI cable": Troubleshooting draws the
 * line without the red FM3_NEVER beside it, and the C2MIDI Pro, a USB MIDI
 * cable too, got very hot on an FM3.
 */
export const fm3CableLine = (noun) =>
  `The FM3’s own USB port can’t plug into this ${noun}, but the U2MIDI Pro on its MIDI ports can. Plug it straight in, then tap ${CABLE_USE_HERE} (or Connect, when that button isn’t there), or use Bluetooth with an adapter.`

/* How to connect, for the FM3, under its Bluetooth way: the same cable with no adapter, its plugs as the Uhost way's steps say them (shared/bluetooth-gear hookupFor), and the same button as fm3CableLine. */
export const FM3_CABLE_WAY = (noun) =>
  `No Bluetooth adapter? Plug the U2MIDI Pro’s USB plug straight into this ${noun} (with a USB plug adapter if it doesn’t fit), its black plug in the FM3’s MIDI IN and the white in MIDI OUT/THRU, then tap ${CABLE_USE_HERE} on the Bluetooth page (or Connect, when that button isn’t there).`

/*
 * USE THE USB CABLE: the Bluetooth page's button for a cable plugged in now
 * that Connect is not using (lib/bluetooth cablesToOffer), under the cable's
 * own name. Never with the Bluetooth symbol: a cable is not Bluetooth.
 */
export const CABLE_USE_HERE = 'Use the USB cable'

/**
 * Troubleshooting, with a cable chosen: what to check, in the order worth
 * trying. A USB MIDI cable on the unit's MIDI jacks (`jacks`) is its plugs
 * first, the colours as PLUGS_CHECK says them for an adapter's, and that it
 * carries both ways; the unit's own USB port is not in it.
 */
export const cableSteps = (noun, { jacks = false } = {}) =>
  jacks
    ? [
        `Plug the USB MIDI cable straight into this ${noun}, with no hub in between, and its MIDI plugs into the unit’s MIDI jacks: the black plug in MIDI IN and the white in MIDI OUT. Swapped, nothing gets through.`,
        'The cable has to carry MIDI both ways: one with a single MIDI plug only carries one way. Use one with two plugs, in the unit’s MIDI IN and MIDI OUT.',
        `If its USB plug doesn’t fit this ${noun}’s socket, use a USB plug adapter for it.`,
        'Switch the unit on, and wait for it to finish starting up.',
        CABLE_CLOSE_AND_REOPEN
      ]
    : [
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

/**
 * Phone & computer's note at its top, while it is on by cable. Said as the
 * way it is set, never as connected: it is drawn whatever the link is doing,
 * the cable pulled out included (the cards under it say that). The computer
 * stays the best way here, as BLUETOOTH_WAYS said for Bluetooth until 7
 * November 2026, when Bluetooth went first everywhere: the cable is not open
 * to customers yet, and its words wait for its own store version. No lag
 * claim: nothing has measured one.
 */
export const cableComputerNote = (noun) =>
  `On a USB cable: this ${noun} talks to the unit itself, not through the computer. The computer is still the best way, and some things only work through it.`

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
 * A USB MIDI cable on the unit's MIDI jacks (`jacks`) keeps link-chain's
 * plug line, since its plugs can be swapped.
 */
export function cableChain(cards, { link, unitState, unit, jacks = false } = {}) {
  const name = unit || 'Your unit'
  const reached = link === 'connected'
  const kept = (Array.isArray(cards) ? cards : []).filter((c) => c && c.key !== 'adapter')
  const mapped = kept.map((c) => {
    if (c.key !== 'unit') return c
    if (!reached) return { ...c, ...(link === 'joining' ? { body: `Looking for ${unit || 'the unit'} on the USB cable…`, tone: 'busy' } : { body: 'Reached by USB cable', tone: 'dim' }), wire: 'USB CABLE' }
    if (unitState === 'missing') {
      const check = jacks ? 'Check it is on, and the black plug is in its MIDI IN and the white in MIDI OUT.' : 'Check it is switched on, and the cable is in at both ends.'
      return { ...c, body: `${name} isn’t answering on the USB cable. ${check}`, tone: 'bad', wire: 'USB CABLE' }
    }
    return { ...c, wire: 'USB CABLE' }
  })
  return mapped.map((card, i, all) => ({ ...card, lit: card.wire ? card.tone === 'good' && all[i + 1]?.tone === 'good' : undefined }))
}

/*
 * PLUGGED IN WHILE CONNECTED ANOTHER WAY (lib/cablePlugIn, bleAdapters
 * cablePlugIn): Play's card. From a Bluetooth adapter the app switches by
 * itself, and says so; through the computer it asks, since the computer is
 * still the best way, and Not now puts the card away until the cable is
 * plugged in again. `name` is the unit's name as the page writes it.
 */
export const CABLE_SWITCHED = 'Switched to the USB cable.'
/* And unplugged, back the way it was before the cable (lib/cablePlugIn, lib/bluetooth leaveCable): `to` 'adapter' or 'computer', `name` the adapter's. */
export const cableLeftWords = ({ to, name } = {}) =>
  to === 'adapter' ? `USB cable unplugged. Back to ${name || 'the Bluetooth adapter'}.` : 'USB cable unplugged. Back to the computer.'
export const cablePluggedIn = (name) => `${name || 'Your unit'} plugged in by USB cable.`
export const CABLE_OFFER_NOTE = 'The computer is still the best way, and some things only work through it.'
export const CABLE_USE = 'Use USB cable'
export const CABLE_NOT_NOW = 'Not now'
