/**
 * WHICH OF THE PORTS IS THE ADAPTER. Pure, so it is tested without a phone;
 * lib/bluetooth uses it on the list the native module gives.
 */

/*
 * NOT AN ADAPTER: Apple's own Wi-Fi MIDI. Every iPhone lists "Network Session
 * 1" as a two-way port, and on the first AM4 test it was offered first,
 * picked, took every message and answered none — "Adapter connected, but the
 * AM4 isn't answering", with the real adapter sitting just below it. Told by
 * its driver, Apple's network (RTP) one, and by its name in case the driver
 * ever reads differently.
 *
 * IN EVERY LANGUAGE, since the 2 November 2026 audit. The name was matched in
 * English only, and iOS writes the network half of it in the iPhone's own
 * language: a report from an iPhone set to Romanian (30 October 2026) had
 * "Rețea Session 1" as the only port. The phone picked it as the adapter by
 * itself (pickAdapter, the only one there is), and the page said the FM3 was
 * not answering, when the truth was that no adapter was connected. A driver
 * that reads empty says nothing either way, so the name has to, in any
 * language. Apple's network device leads it with its own word for network
 * ("Network", "Rețea", "Netzwerk", "Réseau"), and the session's name after it
 * is a session and a number ("Session 1", and "Sitzung 1" or "Sesiune 1"
 * should a language ever translate that half too).
 *
 * A word for network counts only as the FIRST word, where Apple puts it: one
 * further in can be anybody's ("Red" is Spanish for network, and a WIDI can
 * be renamed). A word for session counts anywhere. Japanese, Chinese, Korean
 * and Thai are found anywhere in the name, since those words do not sit
 * between spaces.
 *
 * And a port on what should be Apple's Bluetooth or USB MIDI driver is kept
 * as an adapter whatever its name: an adapter Apple's Bluetooth screen
 * connected, or a unit on a USB cable (an AM4 plugged straight in). The
 * iPhone module reads the driver from CoreMIDI (kMIDIPropertyDriverOwner,
 * FractalBleMidiModule.swift devices()); Android sends none, and its USB
 * entries say what they are by their transport (isCable, below).
 *
 * THE TWO DRIVER NAMES, AS A REAL iPHONE SAYS THEM. Apple does not write
 * them down; Justin's logs did (27 to 29 October 2026, store copy 1.89.3,
 * the device log's "ports after Apple's Bluetooth screen" line). An AM4
 * plugged straight into the iPhone, and a USB-MIDI cable (a C2MIDI Pro)
 * straight into it, are both "com.apple.AppleMIDIUSBDriver". Every adapter
 * Apple's Bluetooth screen connected (a Uhost, a Master) and the iPhone's
 * own "iPhone Bluetooth" port are "com.apple.AppleMIDIBluetoothDriver".
 * Apple's network session reads '' (or its RTP driver). They KEEP a port,
 * never drop one, as before.
 */
export const USB_DRIVER = /AppleMIDIUSBDriver/i
export const BLUETOOTH_DRIVER = /AppleMIDIBluetoothDriver/i
const ADAPTER_DRIVER = new RegExp(`${USB_DRIVER.source}|${BLUETOOTH_DRIVER.source}`, 'i')
const NETWORK_DRIVER = /RTP/i

/**
 * A UNIT ON A USB CABLE, not a Bluetooth adapter: the phone's end is USB, a
 * unit straight in or a USB-MIDI cable straight into the phone. The two are
 * the same to the phone, and said the same way (lib/cableWords).
 *
 *   - iPhone: a port on Apple's USB MIDI driver (USB_DRIVER, above);
 *   - Android: an entry from the build that lists USB MIDI devices (waiting
 *     as docs/pending/android-usb-midi.patch): { id: 'usb:<vvvv>:<pppp>',
 *     name, transport: 'usb' }. Today's Android builds list Bluetooth scan
 *     results only, { id: <its Bluetooth address>, name, rssi }, which are
 *     never a cable: that is the feature detection, and nothing here fires
 *     on a copy without the new build.
 *
 * Everything else about the link is the same wire with a different cable:
 * every rule the unit is held to over Bluetooth holds over it unchanged.
 */
export const isCable = (d) =>
  !!d && (d.transport === 'usb' || USB_DRIVER.test(String(d.driver || '')) || (typeof d.id === 'string' && d.id.startsWith('usb:')))

/* The first word of Apple's network port, in the languages an iPhone can be set to. Lower case; Romanian with both its t's. */
export const NETWORK_WORDS = Object.freeze([
  'network', 'rețea', 'reţea', 'retea', 'netzwerk', 'réseau', 'reseau', 'red', 'rede', 'rete', 'netwerk', 'sieć', 'siec',
  'nätverk', 'netværk', 'nettverk', 'verkko', 'síť', 'sieť', 'hálózat', 'ağ', 'mreža', 'xarxa', 'mạng', 'jaringan', 'rangkaian',
  'сеть', 'мережа', 'δίκτυο', 'רשת', 'شبكة', 'الشبكة', 'नेटवर्क'
])

/* A session, in the same languages: anywhere in the name. */
export const SESSION_WORDS = Object.freeze([
  'session', 'sesiune', 'sitzung', 'sesión', 'sesion', 'sessão', 'sessao', 'sessione', 'sessie', 'sesja', 'istunto', 'økt',
  'relace', 'relácia', 'munkamenet', 'oturum', 'sesija', 'sessió', 'phiên', 'sesi', 'сеанс', 'сессия', 'сесія', 'συνεδρία',
  'جلسة', 'सत्र'
])

/* Network and session where words are not spaced apart: Japanese, Chinese (both scripts), Korean, Thai. */
export const UNSPACED_WORDS = Object.freeze(['ネットワーク', 'セッション', '网络', '網路', '網絡', '会话', '會話', '工作階段', '네트워크', '세션', 'เครือข่าย', 'เซสชัน'])

/* One way of writing each letter: "ț" can come as one character or as a t and its comma. */
const composed = (text) => {
  try {
    return text.normalize('NFC')
  } catch {
    return text
  }
}

/* The name in words: lower case, cut at spaces, punctuation and numbers ("Session1" is "session"). */
const wordsOf = (text) =>
  text
    .toLowerCase()
    .split(/[\s\d.,:;!?'"‘’“”()\[\]{}<>\/\\|_+=*&^%$#@~`\-–—·•]+/)
    .filter(Boolean)

/** Whether a port's name is Apple's network session's, in any language (see above). */
export function sessionName(name) {
  const text = composed(String(name || ''))
  if (UNSPACED_WORDS.some((w) => text.includes(w))) return true
  const words = wordsOf(text)
  if (!words.length) return false
  return NETWORK_WORDS.includes(words[0]) || words.some((w) => SESSION_WORDS.includes(w))
}

export const isNetworkSession = (d) => {
  const driver = String(d?.driver || '')
  if (ADAPTER_DRIVER.test(driver) || isCable(d)) return false
  return NETWORK_DRIVER.test(driver) || sessionName(d?.name)
}

/** Something the page may offer as the adapter. */
export const isAdapter = (d) => !!d && typeof d.id === 'string' && !isNetworkSession(d)

/** The units on a USB cable in a list, plugged in now (not offline). */
export const cablesIn = (list) => (Array.isArray(list) ? list : []).filter((d) => isAdapter(d) && isCable(d) && !d.offline)

/*
 * THE UNIT A CABLE'S PORT IS NAMED FOR, if any: a unit straight in calls its
 * port by its own name (an AM4 on its USB-C cable is "AM4", on an iPhone and
 * by Android's product name), a USB MIDI cable on a unit's MIDI jacks by the
 * cable's (a "C2MIDI Pro"). `units` are the units the page offers, as
 * bleWire BLE_UNITS lists them ({ key, name }); passed in, so this file
 * imports nothing. Case, spaces and hyphens do not count ("Axe-Fx III").
 */
const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
export function cableUnit(d, units) {
  const name = squash(d?.name)
  if (!name) return null
  return (Array.isArray(units) ? units : []).find((u) => squash(u?.name) && name.startsWith(squash(u.name)))?.key ?? null
}

/** A USB MIDI cable on the unit's MIDI jacks, not the unit itself on its own USB cable: its MIDI plugs can be swapped, a unit's own USB port cannot. */
export const onMidiJacks = (d, units) => isCable(d) && !cableUnit(d, units)

/* A cable whose port is named for a unit other than the one picked: an AM4 on its cable, with the FM3 picked. Never taken without a tap. */
const anotherUnit = (d, { unit = null, units = null } = {}) => {
  const named = isCable(d) ? cableUnit(d, units) : null
  return !!named && !!unit && named !== unit
}

/* A Bluetooth adapter connected to the phone now: only an iPhone's list says so (`offline: false`). An Android scan result is only seen nearby. */
const bluetoothUp = (d) => isAdapter(d) && !isCable(d) && d.offline === false

/**
 * THE CABLES CONNECT TAKES WITHOUT A WORD ABOUT BLUETOOTH (lib/bluetooth
 * findAdapters): one is chosen straight away, two or more are listed for a
 * tap, and none means Apple's screen, or Android's search, as before. Only
 * when nothing else could be meant:
 *
 *   - no Bluetooth adapter connected to the phone now. A Uhost already
 *     connected beside a cable is a real choice, and Apple's screen and
 *     pickAdapter's "the one just connected first" settle it as they always
 *     did;
 *   - not a cable let go of by hand (`skip`: Troubleshooting's Forget the
 *     USB cable), or Connect after it could never pair an adapter while the
 *     cable is in;
 *   - not a cable named for another unit than the one picked (`unit`,
 *     `units`): with the FM3 picked, an AM4 on its cable would be sent the
 *     FM3's first messages.
 */
export function cablesFirst(list, { unit = null, units = null, skip = null } = {}) {
  const all = Array.isArray(list) ? list : []
  if (all.some(bluetoothUp)) return []
  return cablesIn(all).filter((d) => !skip?.has?.(d.id) && !anotherUnit(d, { unit, units }))
}

/**
 * THE ONE TO USE, when there is no question about it, or null.
 *
 * "Setting up the Bluetooth is kind of weird. A lot of different buttons to
 * press." So the phone picks the adapter itself when only one could be meant:
 * the one just connected in Apple's screen, or else the only one there is.
 * Two or more, and nothing new among them, is a real question, and the page
 * asks it with a list.
 *
 * NEVER BY ITSELF ONE `refused` for the unit picked: for an FM3, the WIDI
 * Master, the C2MIDI Pro and the other adapters never offered for one
 * (shared/bluetooth-gear neverOnFm3, passed in by lib/bluetooth pickRule).
 * It is still listed, and still counts as one of the choices, so the
 * question is the same; only the answer is left to a tap, under the red
 * FM3 note. A cable is not refused here: it is the unit itself.
 */
export function pickAdapter(list, fresh = new Set(), { unit = null, units = null, refused = null, taken = null } = {}) {
  /* A cable named for another unit than the one picked is listed, never chosen for the player (anotherUnit, above). */
  const here = (Array.isArray(list) ? list : []).filter((d) => isAdapter(d) && !d.offline && !anotherUnit(d, { unit, units }))
  const just = here.filter((d) => fresh.has(d.id))
  const pick = just.length === 1 ? just[0] : !just.length && here.length === 1 ? here[0] : null
  if (pick && !isCable(pick) && typeof refused === 'function' && refused(pick.name)) return null
  /*
   * NOR ONE KEPT FOR ANOTHER UNIT (`taken`, its ids: lib/bluetooth keeps an
   * adapter for each unit), as the only one there: it is on that unit. "The
   * WIDI Jack is on my AM4" (Justin, 7 November 2026): with the FM3 picked,
   * the AM4's WIDI Jack, the one port connected, was the FM3's by itself.
   * Listed, for a tap. One just connected in Apple's screen is the player's
   * own choice, and is taken.
   */
  if (pick && !fresh.has(pick.id) && taken?.has?.(pick.id)) return null
  return pick
}

/*
 * The iPhone's or iPad's own Bluetooth MIDI port ("iPhone Bluetooth" in his
 * logs, on Apple's Bluetooth driver like an adapter): never another adapter.
 */
const OWN_PORT = /\b(iphone|ipad)\b[^]*\bbluetooth\s*$/i

/**
 * ANOTHER ADAPTER HERE, WHILE THE ONE KEPT IS NOT ANSWERING, or null.
 *
 * "It was trying to only let me connect to a Widi master cause that's what I
 * connected to previously and I had a widi jack hooked up now." (Justin, 3
 * November 2026, Android.) The link went on trying the WIDI Master for ever,
 * with the WIDI Jack lit beside it. So the Bluetooth page offers the one it
 * can see, by name, for a tap (lib/bluetooth otherAdapterNow and
 * switchAdapter), and never takes it by itself:
 *
 *   - never the one kept (`kept`), a unit on a USB cable (isCable: a cable is
 *     its own, with Forget the USB cable), or Apple's network session;
 *   - iPhone (`os` 'ios'): a port on Apple's Bluetooth driver that is
 *     connected now (`offline: false`), never the iPhone's own port;
 *   - Android: a scan result, seen nearby;
 *   - none `refused`: for an FM3, the adapters never offered for one
 *     (shared/bluetooth-gear neverOnFm3), passed in, so this file imports
 *     nothing.
 *
 * Exactly one, or null: two or more is a real question, and Use a different
 * adapter asks it with the list.
 */
export function otherAdapterHere(list, kept, { os = null, refused = null } = {}) {
  if (!kept || typeof kept.id !== 'string' || isCable(kept)) return null
  const here = (Array.isArray(list) ? list : []).filter((d) => {
    if (!isAdapter(d) || isCable(d) || d.id === kept.id || d.offline) return false
    if (os === 'ios' && (d.offline !== false || !BLUETOOTH_DRIVER.test(String(d.driver || '')) || OWN_PORT.test(String(d.name || '')))) return false
    return !(typeof refused === 'function' && refused(d.name))
  })
  return here.length === 1 ? here[0] : null
}

/*
 * APPLE'S BLUETOOTH SCREEN CRASHES ON iOS 27, in a build without Apple's fix.
 *
 * "iPhone App crashed when trying to enable Bluetooth." (24 October 2026,
 * TestFlight 1.88.0 (28), iOS 27.0.1.) iOS 27's own screen builds its list
 * from the status bar's height, which iOS 27 no longer answers, and the app
 * is gone the moment Connect opens it, in every app that uses that screen.
 * Apple's workaround is native code, so it waits for the next iPhone build
 * (docs/pending/ble-pair-ios27.patch); the build that has it answers true to
 * pairsOnIOS27(). Until then, on iOS 27 the screen stays shut and the page
 * says why. `version` is Platform.Version: '27.0.1' on an iPhone.
 */
export function pairScreenCrashes({ os, version, fixed } = {}) {
  if (os !== 'ios') return false
  const major = parseInt(String(version ?? ''), 10)
  return major >= 27 && fixed !== true
}

/*
 * What the Bluetooth page says instead, naming the device in hand (`noun`,
 * lib/device-word deviceNoun, asked when it is said): an iPad on iOS 27 has
 * the same screen, and was told its adapter had to be on "the iPhone".
 */
export const pairScreenShutWords = (noun) =>
  `Apple’s Bluetooth screen crashes on iOS 27, so it stays closed until the next build of the app, which has Apple’s fix. Until then, Connect can only use an adapter that is already connected to this ${noun}.`

/**
 * A UNIT PLUGGED IN BY USB CABLE WHILE CONNECTED ANOTHER WAY: what to do
 * about it, or null.
 *
 * "Is it set up to automatically detect when the USB cord has been plugged
 * in and switch to that connection? Or at least add that as an option to
 * switch to once it's plugged in?" (Justin, 6 November 2026.) It was not:
 * through the computer, or through a Bluetooth adapter, a unit plugged in
 * by cable did nothing until Settings → Bluetooth → Connect. So
 * lib/cablePlugIn watches the module's list while the app runs, and asks
 * this what the list means:
 *
 *   - `{ act: 'switch' }` on a Bluetooth ADAPTER (`mode` 'adapter'), for a
 *     cable to the unit already picked: the same unit and the same features,
 *     one wire fewer, so it is taken by itself and Play says so;
 *   - `{ act: 'offer' }` on the COMPUTER (`mode` 'computer'), which does
 *     more than the phone alone, so never by itself: Play asks, with Use USB
 *     cable and Not now. The same on an adapter for a cable to ANOTHER unit
 *     than the one picked: a different rig is never swapped in unasked.
 *
 * Never anything for:
 *
 *   - an account or a copy Bluetooth is not open to (`open` false: the
 *     Bluetooth row's own gate, and a copy a unit can plug into at all);
 *   - any other mode: already on a cable ('cable'), Bluetooth on with
 *     nothing kept or after Disconnect ('off'), the demo;
 *   - a cable let go of by hand this session (`skip`: Troubleshooting's
 *     Forget the USB cable), or put off with Not now until it is unplugged
 *     (`dismissed`);
 *   - a USB MIDI interface nobody chose: a port named for no unit (a
 *     keyboard, a C2MIDI Pro bought for something else) is taken only when it
 *     is the cable kept from last time (`kept`), for the unit picked then;
 *   - a cable for a unit this account is not offered (`offered`, lib/ble-rule
 *     unitOffered as lib/bluetooth asks it);
 *   - two or more that could be meant: which one is a real question, and the
 *     Bluetooth page asks it with its list.
 *
 * And `back`, { id, unit }: the cable the app was on until it was pulled out
 * and the app went back the way it was before it (lib/cablePlugIn
 * UNPLUGGED, AND BACK THE WAY IT WAS). Plugged back in, it is switched to by
 * itself, through the computer too, for the unit it was on: it was the one
 * in use, and only being pulled out took the app off it. A cable let go of
 * by hand or put off with Not now since is still never taken.
 *
 * `units` are bleWire BLE_UNITS ({ key, name }), passed in so this file
 * imports nothing. Nothing here touches Bluetooth: the list is CoreMIDI's
 * ports on an iPhone and Android's USB MIDI devices, which need no
 * permission and open no screen.
 */
export function cablePlugIn(list, { open = false, mode = null, kept = null, unit = null, units = null, offered = null, skip = null, dismissed = null, back = null } = {}) {
  if (open !== true || (mode !== 'computer' && mode !== 'adapter')) return null
  if (mode === 'adapter' && (!kept || isCable(kept))) return null
  const keptCable = kept && isCable(kept) ? kept.id : null
  const may = (key) => !!key && typeof offered === 'function' && offered(key) === true
  const here = []
  for (const d of cablesIn(list)) {
    if (skip?.has?.(d.id) || dismissed?.has?.(d.id)) continue
    const named = cableUnit(d, units)
    const again = !!back && d.id === back.id
    const key = again && back.unit ? back.unit : named || (d.id === keptCable ? unit : null)
    if (may(key)) here.push({ cable: d, unit: key, again })
  }
  if (here.length !== 1) return null
  const [{ cable, unit: key, again }] = here
  return { act: again || (mode === 'adapter' && key === unit) ? 'switch' : 'offer', cable, unit: key }
}
