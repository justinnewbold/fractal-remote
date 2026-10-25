/**
 * REPORTING A BLUETOOTH (BETA) PROBLEM IN ONE TAP: what the answers are, the
 * message one of them sends, and what the log's head says about Bluetooth.
 *
 * "Super easy for all users to submit bugs and feedback" (Justin, 25 October
 * 2026, deciding that Bluetooth (beta) goes to every customer with the full
 * version). The Feedback form is every customer's, and waits for something
 * to be typed; somebody whose adapter will not connect, on a stage, is not
 * going to type. So the Bluetooth report (screens/BluetoothReport.js) is a
 * row of answers, and a tap on one sends it there and then, with the log,
 * through the same one-tap send the log screen uses (lib/reports sendLogs).
 *
 * WHAT GOES WHERE, and why nothing new goes in the report's details. The
 * details (lib/reports context) go with every report, a suggestion too, and
 * the privacy page and the form's own small print list exactly what is in
 * them: version, unit, OS, screen. So the Bluetooth facts (the unit picked
 * on the page, the unit that answered instead, where the link stands, the
 * adapter by its name) go in the head of the LOG (lib/logHead), which is a
 * record of what the app did and is only sent with a bug report, and the
 * answer tapped goes as the message, its first line, which is what the
 * email's subject is made of.
 *
 * Pure: no imports, so a test reads it as it is.
 */

/*
 * THE ANSWERS, in the order a player meets the problems: it will not
 * connect; it connects and the unit says nothing; the unit answers and
 * something on Play does not work; the tuner; the names. Then the rest, and
 * last the report that matters as much as any: it works. "It works on my
 * unit" from an FM9 owner is how a unit nobody here has gets tried.
 */
export const REASONS = Object.freeze([
  { key: 'connect', label: 'It won’t connect' },
  { key: 'answer', label: 'The unit doesn’t answer' },
  { key: 'button', label: 'A button didn’t work' },
  { key: 'tuner', label: 'The tuner' },
  { key: 'names', label: 'Preset or scene names' },
  { key: 'other', label: 'Something else' },
  { key: 'works', label: 'It works on my unit' }
])

/** Every report this screen sends starts with this, so the email's subject says what it is about. */
export const REPORT_HEAD = 'Bluetooth (beta)'

/**
 * The message a tap sends: the answer on its first line, then what the app
 * was saying when the report was opened (a fault line, when it came from
 * one). Nothing a person typed, because nothing is typed here.
 */
export function reportNote(key, said = null) {
  const reason = REASONS.find((r) => r.key === key) || REASONS.find((r) => r.key === 'other')
  const lines = [`${REPORT_HEAD}: ${reason.label}`]
  const words = typeof said === 'string' ? said.trim() : ''
  if (words) lines.push(`The app said: ${words}`)
  return lines.join('\n')
}

/* Where the link to the adapter stands, as lib/bluetooth's phase says it, in words for the head. */
const PHASES = {
  off: 'off',
  idle: 'on, not started',
  'no-unit': 'on, no unit picked',
  'no-adapter': 'on, no adapter chosen',
  locked: 'on, waiting for the full version',
  connecting: 'connecting',
  connected: 'connected',
  held: 'on, held'
}
/* What stands between the device and the adapter, when the device knows (lib/bluetooth NOW.trouble). */
const TROUBLES = {
  'bluetooth-off': 'Bluetooth is off on the device',
  permission: 'Bluetooth is not allowed for the app',
  restricted: 'Bluetooth is blocked by Screen Time or whoever manages the device'
}

/**
 * The Bluetooth lines for the log's head, from lib/bluetooth bluetoothFacts:
 * `unit` the unit picked on the page (its name), `answeredAs` the unit that
 * answered instead of it, `phase` and `trouble` where the link stands, and
 * `adapter` the adapter, by name only. `adapter` is the name lib/bluetooth
 * adapterName gave (never its id, which on Android can be the adapter's
 * Bluetooth address), '' for an adapter chosen that has no name, and null
 * for none chosen.
 *
 * A line with nothing to say is left out (shared/report-rules headLines
 * drops it), so a report with no wrong unit answering says nothing about one.
 */
export function bluetoothHead({ unit = null, answeredAs = null, phase = 'off', trouble = null, adapter = null } = {}) {
  const state = PHASES[phase] || String(phase || 'off')
  return {
    'bluetooth unit': unit || 'none picked',
    'bluetooth link': TROUBLES[trouble] ? `${state} · ${TROUBLES[trouble]}` : state,
    'answered as': answeredAs || undefined,
    adapter: adapter === null || adapter === undefined ? 'none chosen' : adapter || 'one with no name'
  }
}
