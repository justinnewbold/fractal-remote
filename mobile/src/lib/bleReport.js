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

/**
 * What the Feedback form starts with when "Write it out, or add a screenshot"
 * opens it from Report a Bluetooth problem (App.js `writingOut`): the same
 * first line, so the email's subject still says what it is about, and the
 * line that screen said goes with it, then a blank line for what they write.
 * They can change any of it; it is only where the box starts.
 */
export function writeOutNote(said = null) {
  const words = typeof said === 'string' ? said.trim() : ''
  return words ? `${REPORT_HEAD}\nThe app said: ${words}\n\n` : `${REPORT_HEAD}\n\n`
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

/*
 * HOW EACH COMMAND GOES, in the testing tools' own names (screens/Bluetooth
 * WAY_NAMES), so a line in a report reads the same as the button he would
 * press. In the testing tools' order.
 */
const WAY_KEYS = ['scene', 'channel', 'tempo', 'preset', 'tuner']
const WAY_NAMES = { published: 'Published', edit: 'FM3-Edit’s', sysex: 'SysEx', pc: 'Program Change', poll: 'Poll', push: 'Push' }

/**
 * The ways line, from bluetoothFacts' `ways` ({learned, forced}, lib/bluetooth
 * methodsFor): each command auto has found a way for, any way forced in the
 * testing tools, marked "(chosen)", and the Program Change channel when it
 * is not 1. "none found yet" for a unit nothing
 * has been learned on, and nothing at all with no unit picked. Short on
 * purpose: five words at most a command, in a head held to HEAD_BYTES.
 */
export function waysLine(ways) {
  if (!ways || typeof ways !== 'object') return undefined
  const learned = ways.learned || {}
  const forced = ways.forced || {}
  const said = WAY_KEYS.flatMap((k) => {
    if (forced[k]) return [`${k} ${WAY_NAMES[forced[k]] || forced[k]} (chosen)`]
    if (learned[k]) return [`${k} ${WAY_NAMES[learned[k]] || learned[k]}`]
    return []
  })
  /* The Program Change channel only when it is not the 1 every unit starts on. */
  if (Number.isInteger(ways.pcChannel) && ways.pcChannel !== 1) said.push(`Program Change on channel ${ways.pcChannel}`)
  return said.length ? said.join(', ') : 'none found yet'
}

/**
 * The Bluetooth lines for the log's head, from lib/bluetooth bluetoothFacts:
 * `unit` the unit picked on the page (its name), `answeredAs` the unit that
 * answered instead of it, `phase` and `trouble` where the link stands,
 * `adapter` the adapter, by name only, and `ways` how each command goes to
 * the unit picked (waysLine). `adapter` is the name lib/bluetooth
 * adapterName gave (never its id, which on Android can be the adapter's
 * Bluetooth address), '' for an adapter chosen that has no name, and null
 * for none chosen.
 *
 * A line with nothing to say is left out (shared/report-rules headLines
 * drops it), so a report with no wrong unit answering says nothing about one.
 */
export function bluetoothHead({ unit = null, answeredAs = null, phase = 'off', trouble = null, adapter = null, ways = null } = {}) {
  const state = PHASES[phase] || String(phase || 'off')
  return {
    'bluetooth unit': unit || 'none picked',
    'bluetooth link': TROUBLES[trouble] ? `${state} · ${TROUBLES[trouble]}` : state,
    'answered as': answeredAs || undefined,
    adapter: adapter === null || adapter === undefined ? 'none chosen' : adapter || 'one with no name',
    'bluetooth ways': waysLine(ways)
  }
}
