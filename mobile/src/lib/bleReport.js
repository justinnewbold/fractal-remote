/**
 * WHAT A REPORT'S LOG SAYS ABOUT BLUETOOTH, in the head at its top
 * (lib/logHead): the unit picked, where the link stands, the adapter by its
 * name, and how each command goes.
 *
 * WHAT GOES WHERE, and why nothing new goes in the report's details. The
 * details (lib/reports context) go with every report, and the privacy page
 * and the report screen's own small print list exactly what is in them:
 * version, unit, the phone's model and OS, screen. So the Bluetooth facts go
 * in the head of the LOG, which is a record of what the app did, can be read
 * first and unticked on the report screen, and goes only with the log.
 *
 * It used to hold the answers of Report a Bluetooth problem as well, seven
 * buttons that each sent a report in one tap. "It should basically be Leave
 * feedback or report a problem. Then a box to type out a message" (Justin,
 * 29 October 2026): every report button opens the one report screen now
 * (screens/Report), and these lines are what is left.
 *
 * Pure: no imports, so a test reads it as it is.
 */

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
