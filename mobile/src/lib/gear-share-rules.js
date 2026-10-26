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
 * WHAT ONE NOTE IS. One combination of gear that connected: how (a computer
 * or Bluetooth), the unit and its firmware, the Bluetooth adapter's name, or
 * the computer app's version (and the computer's system once the computer app
 * says it; today it says only its name and version, and the name is never
 * sent), whether the unit answered, which kind of phone or tablet and its
 * system version, and the app's version. Every field is short text, cut to
 * the same lengths the database checks (supabase/migrations/
 * 20261026_gear_reports.sql), so a long adapter name is cut rather than
 * refused.
 */
import { ago } from './admin.js'
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
  `Share which gear works with Fractal Remote, so we can put together a list of everything that works. When your unit connects, this ${deviceNoun()} sends one short note: which unit and its firmware, whether it went through a computer or Bluetooth, the computer app’s version or the Bluetooth adapter’s name, whether the unit answered, the kind of ${deviceNoun()} and its system version, and the app’s version. The same gear is sent once a month at most.`,
  'Never sent: preset or song names, anything you type, where you are, or your account or email. It is not linked to you, there is no advertising, and nothing goes to anyone else.',
  'It stays off unless you tap Yes, share. You can change it any time in Settings → Troubleshooting.'
]

export const SHARE_YES = 'Yes, share'
export const SHARE_NO = 'No thanks'

/** The row in Settings → Troubleshooting. */
export const SHARE_ROW = 'Share what gear works'
export const shareRowLine = (on) =>
  on
    ? 'On. When your unit connects, a short note says which gear it was and whether it answered. Not linked to you.'
    : 'Off. Nothing about your gear is sent. Turn it on to help build the list of gear that works.'

/* ------------------------------------------------------------------------ */
/* The answer, kept on the device                                            */
/* ------------------------------------------------------------------------ */

/** Yes or no, on this device. Absent until the card is answered. */
export const SHARE_KEY = 'fractal.gearShare.v1'
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
export const FIELDS = Object.keys(LIMITS)

export const VIAS = ['computer', 'bluetooth']
export const OUTCOMES = ['answered', 'not answering']

const clip = (value, max) => {
  if (value === null || value === undefined) return null
  const text = String(value).replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : null
}

/**
 * The note, field by field from LIMITS and nothing else. Null when it is not
 * a note worth sending: no unit named, or a way or an outcome that is not one
 * of the two.
 */
export function gearRecord(facts = {}) {
  const f = facts && typeof facts === 'object' ? facts : {}
  if (!VIAS.includes(f.via) || !OUTCOMES.includes(f.outcome)) return null
  const record = {}
  for (const field of FIELDS) record[field] = clip(f[field], LIMITS[field])
  if (!record.unit) return null
  /* The adapter belongs to Bluetooth and the computer's details to a computer: never the other way's leftovers. */
  if (record.via === 'bluetooth') {
    record.computer_os = null
    record.computer_version = null
  } else {
    record.adapter = null
  }
  return record
}

/**
 * Which combination a note is, for counting on the phone. Everything but the
 * app's version: an update to the app is not new gear, and sending every
 * combination again after each update would count one rig many times.
 * FNV-1a, because there is no crypto to lean on here and this guards nothing:
 * it is only a name for "sent already", kept on the device.
 */
export function gearKey(record) {
  if (!record) return null
  const text = FIELDS.filter((f) => f !== 'app_version')
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
 *              `firmware`, `simulated`
 *   via        lib/link.js linkVia(): 'computer', 'bluetooth' or 'demo'
 *   link       lib/link.js state: `link`, `hostVersion` (and `hostOs` if the
 *              computer app ever says it)
 *   bluetooth  { phase, unit: the unit's name picked on the Bluetooth page,
 *              adapter: the adapter's name or '' }
 *   phone      { os, osVersion, model }, appVersion
 *
 * The demo is never a note: nothing real connected. Through a computer, only
 * a unit that answered is one (a computer with no unit plugged in says
 * nothing about any gear). Over Bluetooth, an adapter that connected to a
 * unit that never answered is one too, because "this adapter, that unit, no
 * answer" is exactly what the list needs to know.
 */
export function noteFacts({ rig = {}, via, link = {}, bluetooth = {}, phone = {}, appVersion } = {}) {
  if (via !== 'computer' && via !== 'bluetooth') return null
  if (rig.simulated) return null
  const base = {
    via,
    phone_os: phone.os,
    phone_os_version: phone.osVersion,
    phone_model: phone.model,
    app_version: appVersion
  }
  if (via === 'computer') {
    if (rig.unit !== 'present' || link.link !== 'connected') return null
    return {
      ...base,
      outcome: 'answered',
      unit: rig.deviceName,
      firmware: rig.firmware,
      computer_os: link.hostOs,
      computer_version: link.hostVersion
    }
  }
  if (bluetooth.phase !== 'connected') return null
  const adapter = bluetooth.adapter || null
  if (rig.unit === 'present') {
    return { ...base, outcome: 'answered', unit: rig.deviceName || bluetooth.unit, firmware: rig.firmware, adapter }
  }
  if ((rig.unit === 'missing' || rig.unit === 'silent') && bluetooth.unit) {
    return { ...base, outcome: 'not answering', unit: bluetooth.unit, firmware: null, adapter }
  }
  return null
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
 */
export function createGearSharer({ storage, insert, now = Date.now, log = () => {} }) {
  let answer
  let busy = Promise.resolve()

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
    if (answer === undefined) answer = answerFrom(await read(SHARE_KEY))
    return answer
  }

  async function setAnswer(yes) {
    answer = yes ? 'yes' : 'no'
    await write(SHARE_KEY, answer)
    log(yes ? 'sharing what gear works: on' : 'sharing what gear works: off')
    return answer
  }

  async function sendOne(facts) {
    if (!sharing(await getAnswer())) return { sent: false, why: 'off' }
    const record = gearRecord(facts)
    if (!record) return { sent: false, why: 'nothing to say' }
    const key = gearKey(record)
    const at = now()
    const sent = sentFrom(await read(SENT_KEY), at)
    if (sent[key]) return { sent: false, why: 'sent already' }
    let error = null
    try {
      error = (await insert(record))?.error || null
    } catch (err) {
      error = err
    }
    if (error) {
      log('a gear note did not go', String(error?.message || error))
      return { sent: false, why: 'not sent' }
    }
    sent[key] = at
    await write(SENT_KEY, JSON.stringify(sent))
    log('a gear note went', `${record.unit} · ${record.via} · ${record.outcome}`)
    return { sent: true, key }
  }

  /* One at a time, so two changes landing together cannot both find the combination unsent. */
  const report = (facts) => {
    const run = busy.then(() => sendOne(facts))
    busy = run.catch(() => {})
    return run
  }

  return { answer: getAnswer, setAnswer, report }
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

/** How a note came in, in a line: "Bluetooth · WIDI Uhost", "Computer · macOS", "Computer". */
export const wayOf = (r) =>
  r.via === 'bluetooth'
    ? `Bluetooth · ${r.adapter || 'an adapter with no name'}`
    : r.computer_os
      ? `Computer · ${r.computer_os}`
      : 'Computer'

const timeOf = (at) => {
  const t = new Date(at).getTime()
  return Number.isFinite(t) ? t : 0
}
const listed = (set) => [...set].filter(Boolean).join(', ')

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
    const unit = String(r.unit || 'Unknown unit')
    if (!units.has(unit)) units.set(unit, { newest: 0, ways: new Map() })
    const u = units.get(unit)
    const at = timeOf(r.created_at)
    u.newest = Math.max(u.newest, at)
    const way = wayOf(r)
    if (!u.ways.has(way)) u.ways.set(way, { worked: 0, silent: 0, newest: 0, firmware: new Set(), phones: new Set() })
    const w = u.ways.get(way)
    if (r.outcome === 'answered') w.worked += 1
    else w.silent += 1
    w.newest = Math.max(w.newest, at)
    if (r.firmware) w.firmware.add(r.firmware)
    if (r.phone_os) w.phones.add(r.phone_os === 'ios' ? 'iOS' : r.phone_os === 'android' ? 'Android' : r.phone_os)
  }
  return [...units.entries()]
    .sort((a, b) => b[1].newest - a[1].newest)
    .map(([unit, u]) => {
      const ways = [...u.ways.entries()].sort((a, b) => b[1].newest - a[1].newest)
      return {
        title: unit,
        rows: ways.map(([way, w]) => {
          const extra = [
            `newest ${ago(w.newest, now)}`,
            w.firmware.size ? `firmware ${listed(w.firmware)}` : null,
            w.phones.size ? listed(w.phones) : null
          ]
            .filter(Boolean)
            .join(' · ')
          return { label: way, value: `${w.worked} worked · ${w.silent} didn’t answer\n${extra}` }
        })
      }
    })
}
