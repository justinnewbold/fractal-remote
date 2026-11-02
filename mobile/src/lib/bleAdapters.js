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
 * NEVER A PORT ON APPLE'S BLUETOOTH OR USB MIDI DRIVER, whatever its name:
 * that is an adapter Apple's Bluetooth screen connected, or a unit on a USB
 * cable (an AM4 plugged straight in, on com.apple.AppleMIDIUSBDriver). The
 * iPhone module reads the driver from CoreMIDI (kMIDIPropertyDriverOwner,
 * FractalBleMidiModule.swift devices()); Android sends none.
 */
const ADAPTER_DRIVER = /AppleMIDI(Bluetooth|USB)Driver/i
const NETWORK_DRIVER = /RTP/i

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
  if (ADAPTER_DRIVER.test(driver)) return false
  return NETWORK_DRIVER.test(driver) || sessionName(d?.name)
}

/** Something the page may offer as the adapter. */
export const isAdapter = (d) => !!d && typeof d.id === 'string' && !isNetworkSession(d)

/**
 * THE ONE TO USE, when there is no question about it, or null.
 *
 * "Setting up the Bluetooth is kind of weird. A lot of different buttons to
 * press." So the phone picks the adapter itself when only one could be meant:
 * the one just connected in Apple's screen, or else the only one there is.
 * Two or more, and nothing new among them, is a real question, and the page
 * asks it with a list.
 */
export function pickAdapter(list, fresh = new Set()) {
  const here = (Array.isArray(list) ? list : []).filter((d) => isAdapter(d) && !d.offline)
  const just = here.filter((d) => fresh.has(d.id))
  if (just.length === 1) return just[0]
  if (!just.length && here.length === 1) return here[0]
  return null
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
