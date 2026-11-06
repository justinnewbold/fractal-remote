/**
 * WHAT WORKS: WHICH GEAR HAS CONNECTED, SHARED ONLY BY PEOPLE WHO SAY YES.
 *
 * "Build the analytics opt-in, opt out, and whatever needs to be built so
 * that we can collect which devices have been connected and tested for all
 * devices, whether they're computers, Bluetooth devices, so that it helps us
 * put together a list of everything that works." (Justin, 26 October 2026.)
 *
 * The design agreed before that: the app's OWN question ("Help make Fractal
 * Remote better?", Yes / No thanks), off unless somebody taps Yes, and
 * changeable any time in Settings → Troubleshooting. Not Apple's tracking
 * prompt: nothing here follows anybody anywhere, nothing goes to a third
 * party, and a note carries nothing that says whose it was.
 *
 * THIS FILE IS THE RULES, AND NOTHING THE PHONE HAS TO BE RUNNING FOR. No
 * react-native, no storage, no network: the storage and the send are handed
 * in (lib/gearShare.js does that on the phone), so test/gear-share.mjs can
 * drive all of it with a pretend storage and a pretend database, and hold the
 * promises the card makes to what the code does:
 *
 *   - off until Yes (no answer is a no, and so is storage that will not answer);
 *   - nothing sent while off, whatever connects;
 *   - one note per combination of gear in 30 days, counted on the phone;
 *   - no account, no install number, nothing typed, no preset names, no
 *     location: the note is built field by field from the list below, so a
 *     field that is not on it cannot ride along by accident.
 *
 * WHAT ONE NOTE IS. One combination of gear that connected: how (a computer,
 * Bluetooth or, from 4 November 2026, a USB cable), the unit, and its
 * firmware when a computer read it (over Bluetooth or a cable the unit's
 * answer carries none, and asking for it is a message the phone never
 * sends), the kind of computer and its system (computerKind in the computer
 * app, from 1.89.8: "macOS 27.0 (Apple silicon)", "Raspberry Pi 5 · Debian
 * 12 (64-bit)", never its name) and the computer app's version, or the
 * Bluetooth adapter's or the cable's name with an owner's name taken off
 * (ownerless), whether the unit answered, which kind of phone or tablet and
 * its system version, and the app's version. And, on a note that answered,
 * how long the unit took to answer once the link started trying, and,
 * through a computer, the middle of how long the player's own taps took to
 * come back (createGearClock): from what the phone already does, never a
 * new request, and rounded (TIME_STEPS). Every text field is cut to the same
 * lengths the database checks (supabase/migrations/20261026_gear_reports.sql),
 * so a long adapter name is cut rather than refused, and the two times are
 * numbers in the range the table holds (20261104_gear_reports_usb_and_times.sql)
 * or nothing.
 */
import { ago } from './admin.js'
import { sessionName } from './bleAdapters.js'
import { deviceNoun } from './device-word.js'

/* ------------------------------------------------------------------------ */
/* The words                                                                 */
/* ------------------------------------------------------------------------ */

/** The card's heading, and the question it asks. */
export const SHARE_TITLE = 'Help make Fractal Remote better?'

/**
 * What the card says: what goes, then what never does. Read when the card is
 * drawn, because it names the device in the player's hand (shared/
 * device-word.mjs): this iPad, this tablet.
 */
export const shareWords = () => [
  `When your unit connects, this ${deviceNoun()} sends a short note: which unit and its firmware, how it connected (computer, Bluetooth adapter or USB cable, by name and version), whether it answered and how quickly, and which app and system versions you have. Once a month at most.`,
  'Never your presets, songs, anything you type, where you are, or your account. It is not linked to you, and nothing goes to anyone else.',
  'Off unless you tap Yes, share. Change it any time in Settings → Troubleshooting.'
]

/*
 * THE WHOLE OF IT, ON THE WEBSITE. "We need to shorten this a lot. That's a
 * massive amount of text ... we could provide a link to the full text on the
 * website" (Justin, 6 November 2026). So the card says it in three short
 * lines that fit on a phone's screen, and this link opens the privacy page
 * at the section that lists every field, word for word.
 */
export const SHARE_DETAILS = 'See exactly what’s sent'
export const SHARE_DETAILS_URL = 'https://fractal.newbold.cloud/privacy.html#which-gear'

/*
 * THE CARD AGAIN, FOR A YES GIVEN TO THE WORDS BEFORE 4 NOVEMBER 2026, which
 * said nothing of a USB cable or of the two times. Shown once, over the
 * card's own words, and until it is answered the phone sends only what those
 * words promised (createGearSharer `given`).
 */
export const SHARE_AGAIN = 'The note now also says when you used a USB cable, how long your unit took to connect and how quickly it answers a tap. Until you answer, it sends only what it did before.'

export const SHARE_YES = 'Yes, share'
export const SHARE_NO = 'No thanks'

/** The row in Settings → Troubleshooting. */
export const SHARE_ROW = 'Share what gear works'
export const shareRowLine = (on) =>
  on
    ? 'On. When your unit connects through a computer, Bluetooth or a USB cable, a short note says which gear it was, whether it answered and how quickly. Not linked to you.'
    : 'Off. Nothing about your gear is sent. Turn it on to help build the list of gear that works.'

/* ------------------------------------------------------------------------ */
/* The answer, kept on the device                                            */
/* ------------------------------------------------------------------------ */

/**
 * Yes or no, on this device, to the card's words as they are since 4
 * November 2026. Absent until the card is answered.
 */
export const SHARE_KEY = 'fractal.gearShare.v2'
/*
 * The answer given to the words before them (no USB cable, no times). A No
 * there is a No still, never asked again. A Yes there is a Yes to less: the
 * card is shown once more (SHARE_AGAIN), and until it is answered a note goes
 * as those words said, with no times and nothing for a cable. Written beside
 * SHARE_KEY at every answer, so a copy of the app from before reads the
 * newest answer too.
 */
export const SHARE_KEY_BEFORE = 'fractal.gearShare.v1'
/** Which combinations were sent, and when: { key: ms }. Never sent anywhere. */
export const SENT_KEY = 'fractal.gearShare.sent.v1'

/** A combination is sent again only after this long. */
export const RESEND_MS = 30 * 24 * 60 * 60 * 1000
/** How long a combination has to hold before it is a result rather than a moment of starting up. */
export const SETTLE_MS = 15 * 1000

/** What was stored, as an answer: 'yes', 'no', or null for never asked. Anything else is never asked. */
export const answerFrom = (stored) => (stored === 'yes' || stored === 'no' ? stored : null)
/** Whether anything may be sent: only a Yes. */
export const sharing = (answer) => answer === 'yes'

/* ------------------------------------------------------------------------ */
/* One note                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Every field a note may carry, and the longest each may be. The database
 * holds the same lengths (the migration's checks); test/gear-share.mjs reads
 * the migration and holds the two together.
 */
export const LIMITS = {
  via: 16,
  unit: 40,
  firmware: 40,
  adapter: 80,
  outcome: 16,
  computer_os: 40,
  computer_version: 24,
  phone_os: 16,
  phone_os_version: 24,
  phone_model: 80,
  app_version: 24
}
/*
 * And the two times, in milliseconds, each no more than the table's check
 * allows (20261104_gear_reports_usb_and_times.sql): how long the unit took to
 * answer once the link started trying, and the middle of the player's own
 * taps (createGearClock). Numbers, never text: LIMITS stays the text fields
 * alone, so its lengths are what the table checks.
 */
export const TIMES = {
  connect_ms: 600000,
  tap_ms: 600000
}
/*
 * AND ROUNDED BEFORE THEY GO: a connection to the nearest tenth of a second,
 * a tap to the nearest hundredth. The debug log stamps its lines to the
 * thousandth, and a bug report sends the log with the email address ticked:
 * a connect time to the millisecond would be the gap between two of its
 * lines, exactly, and say whose note it was. What works shows a connection
 * in tenths of a second anyway.
 */
export const TIME_STEPS = {
  connect_ms: 100,
  tap_ms: 10
}
export const FIELDS = [...Object.keys(LIMITS), ...Object.keys(TIMES)]

/* 'usb' from 4 November 2026: a unit on a USB cable is its own kind of connection, never Bluetooth. */
export const VIAS = ['computer', 'bluetooth', 'usb']
export const OUTCOMES = ['answered', 'not answering']

const clip = (value, max) => {
  if (value === null || value === undefined) return null
  const text = String(value).replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : null
}

/* A time, rounded to its step, inside the table's range, or nothing. */
const msOf = (value, max, step = 1) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? Math.min(max, Math.round(value / step) * step) : null

/*
 * AN OWNER'S NAME, TAKEN OFF AN ADAPTER'S OR A CABLE'S NAME. The name is the
 * one the adapter offers, and somebody may have given it theirs ("Justin’s
 * WIDI Jack"), or it may be another phone, tablet or Mac offering Bluetooth
 * MIDI, under the name its owner's phone made for it: "Maria's iPad",
 * "MacBook Pro de Justin", "Justins iPad" (Swedish, Danish, Norwegian),
 * "Justin的iPad", "JustinのMacBook Pro", "Galaxy Tab S9 de Maria". The
 * privacy page promises no name you gave your device, so:
 *
 *   - a phone's, tablet's or computer's own kind of name says that kind and
 *     nothing else ("iPad", "MacBook Pro", "Galaxy", "Pixel"), wherever the
 *     owner's name was put;
 *   - a possessive of up to three words comes off the front ("Mary Ann
 *     Smith’s WIDI Master" is "WIDI Master"), and a name that is nothing but
 *     one ("Justin’s") is no name at all.
 *
 * A factory name ("WIDI Uhost Bluetooth", "C2MIDI Pro", "AM4") is left as it
 * is. A name somebody made up for an adapter ("Justin Rig") cannot be told
 * from a factory one, and the privacy page says so.
 */
const DEVICE_KIND = /(?:^|[^A-Za-z])(iPhone|iPad|iPod|iMac|MacBook(?: Pro| Air)?|Mac (?:mini|Studio|Pro)|Galaxy|Pixel)(?![A-Za-z])/
const POSSESSIVE = /^[^\s'’]+(?:\s[^\s'’]+){0,2}['’]s?(?:\s+|$)/u
export function ownerless(name) {
  if (name === null || name === undefined) return null
  const text = String(name).replace(/\s+/g, ' ').trim()
  const kind = text.match(DEVICE_KIND)
  if (kind) return kind[1]
  return text.replace(POSSESSIVE, '').trim() || null
}

/**
 * The note, field by field from LIMITS and TIMES and nothing else. Null when
 * it is not a note worth sending: no unit named, or a way or an outcome that
 * is not on the lists.
 */
export function gearRecord(facts = {}) {
  const f = facts && typeof facts === 'object' ? facts : {}
  if (!VIAS.includes(f.via) || !OUTCOMES.includes(f.outcome)) return null
  const record = {}
  for (const field of Object.keys(LIMITS)) record[field] = clip(field === 'adapter' ? ownerless(f[field]) : f[field], LIMITS[field])
  for (const field of Object.keys(TIMES)) record[field] = msOf(f[field], TIMES[field], TIME_STEPS[field])
  if (!record.unit) return null
  /* The adapter or the cable belongs to Bluetooth or a cable, and the computer's details to a computer: never the other way's leftovers. */
  if (record.via === 'bluetooth' || record.via === 'usb') {
    record.computer_os = null
    record.computer_version = null
  } else {
    record.adapter = null
  }
  return record
}

/* What a combination is not told apart by: the app's version (below) and the two times (a different time is not new gear). */
const UNKEYED = ['app_version', ...Object.keys(TIMES)]

/**
 * Which combination a note is, for counting on the phone. Everything but the
 * app's version and the times: an update to the app is not new gear, and
 * sending every combination again after each update would count one rig many
 * times. A system or computer app update is a new combination, so the card
 * says "on the same versions". FNV-1a, because there is no crypto to lean on
 * here and this guards nothing: it is only a name for "sent already", kept on
 * the device.
 */
export function gearKey(record) {
  if (!record) return null
  const text = FIELDS.filter((f) => !UNKEYED.includes(f))
    .map((f) => `${f}=${record[f] ?? ''}`)
    .join('\u0001')
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `g${h.toString(16).padStart(8, '0')}`
}

/** The sent list as stored, with anything past its 30 days (or unreadable) left out. */
export function sentFrom(raw, now = Date.now()) {
  let list = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch {
      list = null
    }
  }
  if (!list || typeof list !== 'object' || Array.isArray(list)) return {}
  const kept = {}
  for (const [key, at] of Object.entries(list)) {
    if (Number.isFinite(at) && at <= now && now - at < RESEND_MS) kept[key] = at
  }
  return kept
}

/* ------------------------------------------------------------------------ */
/* What the app knows, as a note                                             */
/* ------------------------------------------------------------------------ */

/**
 * The facts for a note, from what the app already knows at the moment, or
 * null when there is nothing to say yet.
 *
 *   rig        lib/rig.js state: `unit` ('present' when the unit answered,
 *              'missing' or 'silent' when it did not), `deviceName`,
 *              `firmware`, `simulated`, `capabilities`
 *   via        'computer', 'bluetooth', 'usb' (lib/link.js linkVia(), with a
 *              cable told apart from Bluetooth, lib/gearShare) or 'demo'
 *   link       lib/link.js state: `link`, `hostVersion`, and `hostOs`, the
 *              kind of computer, which its app says from 1.89.8
 *   bluetooth  { phase, unit: the unit's name picked on the Bluetooth page,
 *              adapter: the adapter's or the cable's name or '', answeredAs:
 *              the unit that answered instead of it, or null }
 *   phone      { os, osVersion, model }, appVersion
 *   times      { connectMs, tapMs } from createGearClock, on a note that
 *              answered only, and the tap time through a computer only
 *
 * The demo is never a note: nothing real connected. Through a computer, only
 * a unit that answered is one (a computer with no unit plugged in says
 * nothing about any gear), and only once the computer has said its version
 * (a first read of it that failed is asked again a little later, lib/link,
 * and a note before it would go with no computer in it, then again with
 * one). Over Bluetooth or a cable, an adapter that connected to a unit that
 * never answered is one too, because "this adapter, that unit, no answer" is
 * exactly what the list needs to know.
 */
export function noteFacts({ rig = {}, via, link = {}, bluetooth = {}, phone = {}, appVersion, times = {} } = {}) {
  if (via !== 'computer' && via !== 'bluetooth' && via !== 'usb') return null
  if (rig.simulated) return null
  const base = {
    via,
    phone_os: phone.os,
    phone_os_version: phone.osVersion,
    phone_model: phone.model,
    app_version: appVersion
  }
  /* The times go only with a unit that answered: a unit that did not has none to say. */
  const timed = { connect_ms: times?.connectMs ?? null, tap_ms: times?.tapMs ?? null }
  if (via === 'computer') {
    if (rig.unit !== 'present' || link.link !== 'connected' || !link.hostVersion) return null
    return {
      ...base,
      ...timed,
      outcome: 'answered',
      unit: rig.deviceName,
      firmware: rig.firmware,
      computer_os: link.hostOs,
      computer_version: link.hostVersion
    }
  }
  /*
   * NO NOTE FOR A VP4 OVER BLUETOOTH OR A CABLE. The phone cannot hear one:
   * its wire only sends (lib/bleVp4 sendOnly), and says "connected" for an
   * adapter plugged into nothing at all, so every note would read "VP4 ·
   * answered" whatever was on the end, and a closed wire "not answering"
   * about a VP4 that may be fine. A third outcome, "sent, not heard", needs
   * the table's outcome check changed, which is Justin's to agree. A VP4
   * through a computer is a note as before: the computer really hears it.
   */
  if (rig.capabilities?.sendOnly === true || bluetooth.unit === 'VP4') return null
  if (bluetooth.phase !== 'connected') return null
  /*
   * A DIFFERENT UNIT ANSWERED: a mix-up, not a result for either unit. His
   * own first note was "AM4 · bluetooth · not answering" (29 October 2026)
   * from the WIDI Uhost plugged into his FM3, with the AM4 picked and the
   * page saying "An FM3 answered, not the AM4": true of nothing. The page
   * says how to fix it, and the note waits for the right unit.
   */
  if (bluetooth.answeredAs) return null
  const adapter = bluetooth.adapter || null
  /*
   * NO TAP TIME OVER BLUETOOTH OR A CABLE. An accepted write gets no answer
   * there: the wire calls it taken when the unit's refusal has not come in
   * its short watch (bleWire fire: 40 ms on an AM4, 120 ms on gen 3), so a
   * tap would time the phone's own wait, the same whatever the unit did,
   * and What works would show Bluetooth quicker than a computer. lib/device
   * does not time one, and none is sent. The connect time is a real answer,
   * the unit's own detect, and goes.
   */
  if (rig.unit === 'present') {
    return { ...base, ...timed, tap_ms: null, outcome: 'answered', unit: rig.deviceName || bluetooth.unit, firmware: rig.firmware, adapter }
  }
  if ((rig.unit === 'missing' || rig.unit === 'silent') && bluetooth.unit) {
    return { ...base, connect_ms: null, tap_ms: null, outcome: 'not answering', unit: bluetooth.unit, firmware: null, adapter }
  }
  return null
}

/* ------------------------------------------------------------------------ */
/* How long things take                                                      */
/* ------------------------------------------------------------------------ */

/* The middle value, or the middle two's average; null for none. */
const median = (values) => {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!v.length) return null
  const mid = v.length >> 1
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

/* The most taps kept for the middle one: the newest, so a long set says how it is now. */
export const TAPS_KEPT = 25

/**
 * HOW LONG IT TOOK TO CONNECT, AND HOW QUICKLY THE UNIT ANSWERS A TAP, from
 * what the phone already does and nothing it asks for (4 November 2026,
 * Justin: "Go with your picks").
 *
 *   step({ link, unit, readSince })  every change of the link or the unit:
 *        `link` is lib/link's ('off', 'joining', 'no-answer', 'connected',
 *        the same for a computer, Bluetooth and a cable), `unit` the rig's,
 *        and `readSince(t)` rig.unitReadSince, whether the unit has said what
 *        it is since t (and nothing has changed since, such as another
 *        computer being driven).
 *   tap(ms)    one of the player's own taps (a preset, a scene, an effect),
 *        from the moment it went to the unit's answer (lib/tapTimes). Only
 *        through a computer: over Bluetooth or a cable lib/device does not
 *        time one (noteFacts says why).
 *
 * The clock starts when the link leaves 'off', and stops the first time the
 * link is connected, the unit present, and the unit has been read since the
 * start. Taps count only after that, the newest TAPS_KEPT of them.
 *
 * A BREAK IS NOT ALWAYS A NEW CONNECTION. An answered link that stops being
 * connected with the unit present (a request that timed out says the
 * computer is not answering, relay.js seen(false); the realtime channel
 * drops and comes back by itself) usually comes back without the unit being
 * read again, and that is the same connection healed: its times and its taps
 * carry on. Only a link that comes back with the unit read again since the
 * break (a rejoin, another computer, the unit unplugged and back) is a new
 * connection, timed from the break, with no taps. Until it is known which,
 * the times of the connection before stand. 'off' starts again from nothing.
 * Nothing here sends anything.
 */
export function createGearClock(now = Date.now) {
  /* 'off' | 'trying' | 'answered' | 'broken' */
  let phase = 'off'
  let startedAt = null
  let answeredAt = null
  let brokeAt = null
  let taps = []

  const fresh = (at) => {
    startedAt = at
    answeredAt = null
    taps = []
  }

  function step({ link, unit, readSince } = {}) {
    if (link === undefined) return
    if (link === 'off') {
      phase = 'off'
      fresh(null)
      return
    }
    const live = link === 'connected' && unit === 'present'
    const readAfter = (t) => t !== null && typeof readSince === 'function' && readSince(t) === true
    if (phase === 'off') {
      fresh(now())
      phase = 'trying'
    }
    if (phase === 'trying') {
      if (live && readAfter(startedAt)) {
        answeredAt = now()
        phase = 'answered'
      }
      return
    }
    if (phase === 'answered') {
      if (live && readAfter(startedAt)) return
      phase = 'broken'
      brokeAt = now()
      return
    }
    /* Broken: back, read again since the break (a new connection), or back as it was (healed). */
    if (!live) return
    if (readAfter(brokeAt)) {
      fresh(brokeAt)
      answeredAt = now()
      phase = 'answered'
    } else if (readAfter(startedAt)) {
      phase = 'answered'
    }
  }

  function tap(ms) {
    if (answeredAt === null || typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return
    taps.push(ms)
    if (taps.length > TAPS_KEPT) taps = taps.slice(-TAPS_KEPT)
  }

  function times() {
    const connect = answeredAt !== null && startedAt !== null ? answeredAt - startedAt : null
    const middle = median(taps)
    return {
      connectMs: connect !== null && connect >= 0 && connect <= TIMES.connect_ms ? connect : null,
      tapMs: middle === null ? null : Math.round(middle)
    }
  }

  return { step, tap, times, tapCount: () => taps.length }
}

/* ------------------------------------------------------------------------ */
/* When the note goes                                                        */
/* ------------------------------------------------------------------------ */

/* A note that answered through a computer waits for this many taps, so the tap time is in it ... */
export const TAPS_FOR_NOTE = 3
/* ... or this long after the gear first held, whichever comes first, so a connection with no taps still sends one. */
export const NOTE_AFTER_MS = 2 * 60 * 1000
/* A note the server did not take is tried again no sooner than this. */
export const RETRY_MS = 5 * 60 * 1000

/**
 * Whether a note that has held its SETTLE_MS is due. A unit that did not
 * answer has no times to wait for, and nor has Bluetooth or a cable, which
 * sends no tap time (noteFacts); one that answered through a computer waits
 * for a few taps or two minutes, and is due at once when the app is leaving
 * the screen (it may not come back), whichever comes first. lib/gearShare
 * never loses a note that is waiting: gear that changes or goes sends it as
 * it was.
 */
export const noteDue = ({ outcome, via, taps = 0, waited = 0, leaving = false } = {}) =>
  outcome !== 'answered' || via === 'bluetooth' || via === 'usb' || leaving === true || taps >= TAPS_FOR_NOTE || waited >= NOTE_AFTER_MS

/*
 * AND A NOTE THAT IS DUE GOES A WHILE LATER, AT A MOMENT OF ITS OWN: between
 * 20 seconds and a minute and a half, at random. The table stamps each note
 * with when it came in, and the debug log stamps its lines to the thousandth
 * of a second: a note sent the moment the gear held, or inside a tap, would
 * land at a fixed distance from a line in any log that covers it, and a bug
 * report sends the log with the email address ticked.
 */
export const SEND_AFTER_MS = Object.freeze({ least: 20 * 1000, most: 90 * 1000 })
export const sendDelay = (random = Math.random) => {
  const r = random()
  const share = typeof r === 'number' && r >= 0 && r < 1 ? r : 0.5
  return SEND_AFTER_MS.least + Math.floor(share * (SEND_AFTER_MS.most - SEND_AFTER_MS.least))
}

/* ------------------------------------------------------------------------ */
/* The sharer                                                                */
/* ------------------------------------------------------------------------ */

/**
 * The part that decides and remembers, with the storage and the database
 * handed in:
 *
 *   storage  { getItem(key), setItem(key, value) }, both may be async
 *   insert   (record) => Promise; resolves { error } like supabase-js
 *   now      the clock
 *
 * `report(facts)` sends a note only when the answer on this device is Yes,
 * the facts make a note, and the same combination was not sent in the last
 * 30 days. It never throws: what it did comes back as { sent, why }.
 *
 * `owed()` says whether the card is owed: 'first' for never answered,
 * 'again' for a Yes given to the words before 4 November 2026
 * (SHARE_KEY_BEFORE), false otherwise.
 */
export function createGearSharer({ storage, insert, now = Date.now, log = () => {} }) {
  let answer
  /* 'now' for an answer to today's words, 'before' for a Yes given to the words before them. */
  let given = 'now'
  let busy = Promise.resolve()
  /*
   * What went from here, kept in memory beside the stored list: storage that
   * will not take the write (a full disk) must not make every report send the
   * same combination again.
   */
  const sentHere = {}
  /* When each combination the server did not take was tried: not again sooner than RETRY_MS. In memory only. */
  const triedAt = {}

  const read = async (key) => {
    try {
      return await storage.getItem(key)
    } catch {
      return null
    }
  }
  const write = async (key, value) => {
    try {
      await storage.setItem(key, value)
      return true
    } catch {
      return false
    }
  }

  async function getAnswer() {
    if (answer === undefined) {
      const today = answerFrom(await read(SHARE_KEY))
      if (today !== null) {
        answer = today
        given = 'now'
      } else {
        answer = answerFrom(await read(SHARE_KEY_BEFORE))
        given = answer === 'yes' ? 'before' : 'now'
      }
    }
    return answer
  }

  async function owed() {
    const a = await getAnswer()
    if (a === null) return 'first'
    return a === 'yes' && given === 'before' ? 'again' : false
  }

  async function setAnswer(yes) {
    answer = yes ? 'yes' : 'no'
    given = 'now'
    await write(SHARE_KEY, answer)
    await write(SHARE_KEY_BEFORE, answer)
    log(yes ? 'sharing what gear works: on' : 'sharing what gear works: off')
    return answer
  }

  /* The phone's own twelve seconds ran out (lib/notForever): the server may have taken the note before the answer was cut off. */
  const cutOff = (error) => /timed out/i.test(String(error?.message || error))

  async function sendOne(facts) {
    if (!sharing(await getAnswer())) return { sent: false, why: 'off' }
    let record = gearRecord(facts)
    if (!record) return { sent: false, why: 'nothing to say' }
    /* A Yes to the words before: only what they said. Nothing for a cable (none went then), and no times. */
    if (given === 'before') {
      if (record.via === 'usb') return { sent: false, why: 'not on the card that was said yes to' }
      record = { ...record, connect_ms: null, tap_ms: null }
    }
    const key = gearKey(record)
    const at = now()
    const sent = { ...sentFrom(await read(SENT_KEY), at), ...sentFrom(sentHere, at) }
    if (sent[key]) return { sent: false, why: 'sent already' }
    if (Number.isFinite(triedAt[key]) && at >= triedAt[key] && at - triedAt[key] < RETRY_MS) return { sent: false, why: 'tried just now' }
    let error = null
    try {
      error = (await insert(record))?.error || null
    } catch (err) {
      error = err
    }
    /*
     * CUT OFF IS COUNTED AS SENT. A refusal says the row is not there; a send
     * the phone cut off after its twelve seconds may have landed all the
     * same, and sending it again would put the same gear in the table twice,
     * against "once a month at most". A note lost now and then is the
     * smaller harm: it goes again the next time the gear connects after its
     * 30 days.
     */
    if (error && !cutOff(error)) {
      triedAt[key] = at
      log('a gear note did not go', String(error?.message || error))
      return { sent: false, why: 'not sent' }
    }
    sent[key] = at
    sentHere[key] = at
    await write(SENT_KEY, JSON.stringify(sent))
    /*
     * Nothing in the log when a note goes, or may have: no line names a note,
     * or sits at the moment one went (and lib/gearShare sends each at a
     * random moment of its own, sendDelay).
     */
    return error ? { sent: false, why: 'cut off', key } : { sent: true, key }
  }

  /* One at a time, so two changes landing together cannot both find the combination unsent. */
  const report = (facts) => {
    const run = busy.then(() => sendOne(facts))
    busy = run.catch(() => {})
    return run
  }

  return { answer: getAnswer, owed, setAnswer, report }
}

/* ------------------------------------------------------------------------ */
/* Developer → What works                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Ask the server for the notes. The server is supabase/functions/gear-reports,
 * with the same lock as owner-messages: his account, read from a token
 * Supabase signed. Never throws.
 */
export async function gearAction({ url, anonKey, token, fetchImpl }) {
  if (!token) return { ok: false, message: 'Sign in first.' }
  try {
    const res = await (fetchImpl || globalThis.fetch)(`${url}/functions/v1/gear-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'list' })
    })
    const body = await res.json().catch(() => ({}))
    return { ...body, ok: Boolean(body?.ok), ...(body?.ok ? {} : { message: body?.message || `The server answered ${res.status}.` }) }
  } catch (err) {
    return { ok: false, message: `Could not reach the server (${err?.message || err}).` }
  }
}

/** How a note came in, in a line: "Bluetooth · WIDI Uhost", "USB cable · AM4", "Computer · macOS", "Computer". */
export const wayOf = (r) =>
  r.via === 'bluetooth'
    ? `Bluetooth · ${r.adapter || 'an adapter with no name'}`
    : r.via === 'usb'
      ? `USB cable · ${r.adapter || 'a unit with no name'}`
      : r.computer_os
        ? `Computer · ${r.computer_os}`
        : /* A computer app from before 29 October 2026 said nothing of its system (desktop/lib/host.mjs computerKind). */
          'Computer · system not said'

/*
 * EVERYTHING A NOTE CARRIES, ON THE PAGE (3 November 2026): "Can we get more
 * information about the computers being used at all? ... Is there anything
 * else that we can add to this that we're not yet?" The notes had carried
 * the computer app's version, the phone's system version, an Android's make
 * and model and the app's own version all along, and the page showed none
 * of them. Each is a line now, newest versions first, a few at most.
 */
const versionOrder = (a, b) => {
  const pa = String(a).split(/[^\d]+/).map(Number)
  const pb = String(b).split(/[^\d]+/).map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pb[i] || 0) - (pa[i] || 0)
    if (d) return d
  }
  return String(a).localeCompare(String(b))
}
const few = (set, most = 3) => {
  const all = [...set].filter(Boolean).sort(versionOrder)
  return all.length > most ? `${all.slice(0, most).join(', ')} and ${all.length - most} older` : all.join(', ')
}
/* "iPhone · iOS 27.2", "HUAWEI CLT-L29 · Android 10", or the system alone for a note that named no device. */
const phoneOf = (r) => {
  const system = r.phone_os === 'ios' ? 'iOS' : r.phone_os === 'android' ? 'Android' : r.phone_os ? String(r.phone_os) : ''
  const said = [system, r.phone_os_version].filter(Boolean).join(' ')
  return [r.phone_model, said].filter(Boolean).join(' · ')
}

/* "connects in about 2.4 s · a tap about 140 ms", the middle of each way's notes, either half left out with none. */
const timesOf = (w) => {
  const connect = median(w.connects)
  const tap = median(w.taps)
  return [connect === null ? null : `connects in about ${(connect / 1000).toFixed(1)} s`, tap === null ? null : `a tap about ${Math.round(tap)} ms`]
    .filter(Boolean)
    .join(' · ')
}

const timeOf = (at) => {
  const t = new Date(at).getTime()
  return Number.isFinite(t) ? t : 0
}

/**
 * The page: one group per unit, newest first, and in each a row per way it
 * came in (the computer's system, or the Bluetooth adapter), newest first,
 * with how many notes said it worked and how many said the unit did not
 * answer.
 */
export function gearSections(answer, now = Date.now()) {
  if (!answer?.ok) return []
  const reports = Array.isArray(answer.reports) ? answer.reports : []
  if (!reports.length) return [{ title: 'What works', rows: [{ label: '', value: 'Nothing has come in yet.' }] }]
  const units = new Map()
  for (const r of reports) {
    /*
     * Not an adapter: Apple's own network session, which an iPhone from
     * before 30 October 2026 could take for one ("Rețea Session 1",
     * lib/bleAdapters sessionName). A note about it says nothing about
     * which gear works.
     */
    if (r.via === 'bluetooth' && sessionName(r.adapter)) continue
    /*
     * Nor a mix-up from before 1.89.8, when a different unit answering was
     * still sent as the picked one not answering (noteFacts answeredAs): his
     * own first note, "AM4 · WIDI Uhost Bluetooth · not answering" (29
     * October 2026), came from the adapter in his FM3, and the AM4 works
     * through the WIDI Uhost. The table is not changed from the app, so the
     * page leaves such a note out. versionOrder sorts newest first: above
     * nought is older than 1.89.8.
     */
    if (r.via === 'bluetooth' && r.outcome === 'not answering' && r.app_version && versionOrder(r.app_version, '1.89.8') > 0) continue
    const unit = String(r.unit || 'Unknown unit')
    if (!units.has(unit)) units.set(unit, { newest: 0, ways: new Map() })
    const u = units.get(unit)
    const at = timeOf(r.created_at)
    u.newest = Math.max(u.newest, at)
    const way = wayOf(r)
    if (!u.ways.has(way)) u.ways.set(way, { worked: 0, silent: 0, newest: 0, firmware: new Set(), phones: new Set(), computerApp: new Set(), app: new Set(), connects: [], taps: [] })
    const w = u.ways.get(way)
    if (r.outcome === 'answered') w.worked += 1
    else w.silent += 1
    w.newest = Math.max(w.newest, at)
    if (r.firmware) w.firmware.add(r.firmware)
    const phone = phoneOf(r)
    if (phone) w.phones.add(phone)
    if (r.computer_version) w.computerApp.add(r.computer_version)
    if (r.app_version) w.app.add(r.app_version)
    if (Number.isFinite(r.connect_ms)) w.connects.push(r.connect_ms)
    if (Number.isFinite(r.tap_ms)) w.taps.push(r.tap_ms)
  }
  return [...units.entries()]
    .sort((a, b) => b[1].newest - a[1].newest)
    .map(([unit, u]) => {
      const ways = [...u.ways.entries()].sort((a, b) => b[1].newest - a[1].newest)
      return {
        title: unit,
        rows: ways.map(([way, w]) => {
          const lines = [
            `${w.worked} worked · ${w.silent} didn’t answer`,
            [`newest ${ago(w.newest, now)}`, w.firmware.size ? `firmware ${few(w.firmware)}` : null].filter(Boolean).join(' · '),
            timesOf(w) || null,
            w.computerApp.size ? `computer app ${few(w.computerApp)}` : null,
            w.phones.size ? [...w.phones].sort().join(', ') : null,
            w.app.size ? `Fractal Remote ${few(w.app)}` : null
          ]
          return { label: way, value: lines.filter(Boolean).join('\n') }
        })
      }
    })
}
