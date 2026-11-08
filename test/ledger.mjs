/**
 * THE BUILD LEDGER, READ ONE WAY, AND THE RULE IT HOLDS BLUETOOTH (BETA)'S
 * THRESHOLD TO, for every test that reads either.
 *
 * Not a test file: run.mjs never runs it. test/bluetooth.mjs (the version
 * rule and the ledger) and test/server.mjs (the setup emails' switch) each
 * read docs/expo-builds.md, and each had its own copy of the reader, with
 * the same columns and the same marker. A change to the ledger's table fixed
 * in one and not the other would have left the other reading something else,
 * so there is one, here.
 */
import { bluetoothOpen, EDIT_UNITS, unitOffered } from '../mobile/src/lib/ble-rule.js'
import { BLE_UNITS } from '../mobile/src/lib/bleWire.js'
import { isOlder } from '../shared/versions.mjs'

/* The words a row says when it is the build that opened Bluetooth (beta) to customers (docs/expo-builds.md's header). */
export const OPENING = /Bluetooth \(beta\) for customers/

/*
 * AND THE WORDS A ROW SAYS WHEN ITS BUILD OPENED EDIT OVER BLUETOOTH TO
 * CUSTOMERS ON SOME UNITS (mobile/src/lib/ble-rule.js EDIT_FROM_STORE, one
 * entry per unit): these words, a colon, and the units that build opened, by
 * the names the Bluetooth page gives them (lib/bleWire BLE_UNITS), as
 *
 *   Editing over Bluetooth for customers: AM4, FM3
 *
 * One unit at a time. Each unit's entry opens on its own store version, so
 * each is held by the two rules below on the rows that name it (editOpening),
 * with its own words (editWords) and its own pin (EDIT_OPENED_AT[unit]). One
 * marker for every unit, as there was, read a row that opened the AM4 and the
 * FM3 as the opening of the FM9 and the Axe-Fx III too: left null, they failed
 * ("marked as the opening, and the threshold is null"), and the only way to
 * green was to open them by update on copies reviewed without them, which the
 * stores forbid. A row that says the words without a list of units, or with
 * something in its list that is not one of these names, is refused
 * (editRowProblems), so a unit can never be marked by accident or missed by a
 * typo.
 */
export const EDIT_MARKER = 'Editing over Bluetooth for customers'

/* The name each unit goes by in a row: the Bluetooth page's own, for every unit whose Edit over Bluetooth is built (EDIT_UNITS). Never the VP4, which has none. */
export const EDIT_UNIT_NAMES = Object.freeze(Object.fromEntries(EDIT_UNITS.map((unit) => [unit, BLE_UNITS.find((u) => u.key === unit)?.name ?? null])))

const unitByName = (name) => Object.keys(EDIT_UNIT_NAMES).find((unit) => EDIT_UNIT_NAMES[unit] === name) ?? null
const nameOf = (unit) => {
  const name = Object.prototype.hasOwnProperty.call(EDIT_UNIT_NAMES, unit) ? EDIT_UNIT_NAMES[unit] : null
  if (!name) throw new Error(`${String(unit)} is not a unit whose Edit over Bluetooth is built (EDIT_FROM_STORE in mobile/src/lib/ble-rule.js)`)
  return name
}

/*
 * What one row's What it was for says about Edit over Bluetooth: null when it
 * does not say the words at all; otherwise the units its list names, anything
 * in the list that is not one of their names, and whether the words come
 * without a list, or more than once. The list runs from the colon to the
 * first full stop, semicolon, colon, bracket or dash, its names parted by
 * commas or "and", each with or without "the" in front.
 */
export const editRowUnits = (why) => {
  const text = String(why ?? '')
  const said = (text.match(/editing over bluetooth for customers/gi) || []).length
  if (!said) return null
  const at = text.indexOf(`${EDIT_MARKER}: `)
  const list = at < 0 ? '' : text.slice(at + EDIT_MARKER.length + 2).split(/[.;:()\u2013\u2014|]/)[0]
  const items = list
    .split(/\s*,\s*(?:and\s+)?|\s+and\s+/)
    .map((item) => item.trim().replace(/^the\s+/i, ''))
    .filter(Boolean)
  return {
    units: items.map(unitByName).filter(Boolean),
    unknown: items.filter((item) => !unitByName(item)),
    bare: items.length === 0,
    twice: said > 1
  }
}

/*
 * The marker for one unit, for ledgerBuilds: a row is that unit's opening
 * when its list names the unit. Not a RegExp, which could not read a list,
 * but asked the same way (`test`).
 */
export const editOpening = (unit) => {
  nameOf(unit)
  return Object.freeze({ test: (why) => editRowUnits(why)?.units.includes(unit) === true })
}

/* What the rules below call each: in what they say, nothing else. */
export const BLUETOOTH_WORDS = Object.freeze({ name: 'Bluetooth (beta)', row: 'Bluetooth (beta) for customers', pin: 'OPENED_AT' })

/* And Edit over Bluetooth on one unit: its own name, the row that names it, and its own pin. */
export const editWords = (unit) => {
  const name = nameOf(unit)
  return Object.freeze({ name: `editing over Bluetooth on the ${name}`, row: `${EDIT_MARKER}: ${name}`, pin: `EDIT_OPENED_AT.${unit}` })
}

/* Every row of docs/expo-builds.md's tables that is a build: a version in its second cell. */
const ledgerRows = (text) => {
  const out = []
  for (const line of String(text).split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 7 || !/^\d+\.\d+\.\d+$/.test(cells[2])) continue
    out.push({ date: cells[1], version: cells[2], ios: cells[3], android: cells[4], why: cells[5] })
  }
  return out
}

/*
 * Every build in docs/expo-builds.md, once for each phone it built: a cell
 * that starts with a number is a build on that phone. `marker` is anything
 * with a `test` of the row's What it was for: OPENING for Bluetooth itself,
 * editOpening(unit) for Edit over Bluetooth on one unit.
 */
export const ledgerBuilds = (text, marker = OPENING) => {
  const out = []
  for (const row of ledgerRows(text)) {
    const opening = marker.test(row.why)
    for (const [platform, cell] of [['ios', row.ios], ['android', row.android]]) {
      if (/^\d/.test(cell)) out.push({ date: row.date, version: row.version, platform, opening })
    }
  }
  return out
}

/*
 * What is wrong with the ledger's Edit over Bluetooth rows themselves: a list
 * of sentences, empty when nothing is. A row that says the words says them
 * once, followed by ": " and the units its build opened, by name, and nothing
 * else in that list: the words alone would mark no unit and leave the build's
 * units unmarked, and a misspelt or unknown name (the VP4, say) would mark
 * nothing while looking as if it did.
 */
export const editRowProblems = (text) => {
  const out = []
  const names = Object.values(EDIT_UNIT_NAMES).join(', ')
  for (const row of ledgerRows(text)) {
    const said = editRowUnits(row.why)
    if (!said) continue
    const where = `docs/expo-builds.md, the ${row.version} row of ${row.date}`
    if (said.twice) out.push(`${where}: says "${EDIT_MARKER}" more than once; it says it once, with every unit that build opened after it`)
    if (said.bare) {
      out.push(
        `${where}: says "${EDIT_MARKER}" without ": " and the units that build opened after it. Write "${EDIT_MARKER}: " and their names (${names}), as "${EDIT_MARKER}: AM4, FM3", so each unit opens on its own row`
      )
    }
    for (const item of said.unknown) {
      out.push(`${where}: "${item}" in its list of units is not a unit whose Edit over Bluetooth is built (${names}): the list is their names alone, up to the next full stop or bracket`)
    }
  }
  return out
}

/*
 * The ledger as it was before any build opened Bluetooth (beta): every row
 * marked as the opening taken out. For the checks that try the rule on
 * made-up ledgers, which must go on meaning the same thing the day the real
 * opening row is written, rather than finding it there and breaking.
 */
/*
 * The ledger as it was before the opening: the opening row and every build
 * row after it gone (a later build, 1.89.3's on 26 October 2026, is not
 * marked as the opening but was built after it, so it is not part of the
 * ledger before it either).
 */
export const withoutOpening = (text) => {
  let after = false
  return String(text)
    .split('\n')
    .filter((line) => {
      const row = line.trim().startsWith('|') && /^\|\s*\d{1,2} [A-Z][a-z]{2}\s*\|/.test(line.trim())
      if (row && OPENING.test(line)) after = true
      return !(row && after)
    })
    .join('\n')
}

/*
 * THE PIN: the build that opened Bluetooth (beta) to customers, written here
 * by hand. Null until then.
 *
 * The ledger test trusts the ledger, so once the opening row is written, a
 * later change that took the row out and set the threshold back to null
 * together would pass every check in thresholdProblems, and close Bluetooth
 * by update on every copy reviewed with it. This is the third thing such a change has to
 * undo, and it is checked both ways (pinProblems): a ledger that marks an
 * opening needs it, and once it is set the ledger has to keep that row on
 * both phones and the threshold has to stay exactly what it says. So the
 * pull request that writes the opening row sets it, in the same change, to
 * that build: its version, and the threshold on each phone, as
 *
 *   export const OPENED_AT = Object.freeze({ version: '1.89.0', ios: '1.89.0', android: '1.89.0', units: ['am4', 'fm3', 'fm9', 'axefx3', 'vp4'] })
 *
 * and cannot go green without it. `units` is every unit that build opened
 * to customers (UNITS_FROM_STORE in mobile/src/lib/ble-rule.js, as it was
 * built): from then on each stays open on that version, and no other unit
 * may open on it (unitProblems, below). After that, taking the protection out
 * takes three deliberate edits (the row, the threshold and this), never one
 * slip.
 */
export const OPENED_AT = Object.freeze({ version: '1.89.0', ios: '1.89.0', android: '1.89.0', units: ['am4', 'fm3', 'fm9', 'axefx3', 'vp4'] })

/*
 * THE SAME PIN FOR EDIT OVER BLUETOOTH, ONE PER UNIT: each null until a build
 * opens that unit to customers. The pull request that writes that build's row
 * ("Editing over Bluetooth for customers: AM4, FM3") sets, in the same change,
 * the entry of every unit the row names to that build, and leaves every other
 * unit's as it is:
 *
 *   am4: Object.freeze({ version: '1.90.0', ios: '1.90.0', android: '1.90.0' }),
 *
 * and cannot go green without it (editProblems asks pinProblems of each unit,
 * on its own rows and its own entry). A unit opened by a later store version
 * gets its pin then, from its own row. One entry for every unit in
 * EDIT_FROM_STORE, held by test/bluetooth.mjs.
 */
export const EDIT_OPENED_AT = Object.freeze({ am4: null, fm3: null, fm9: null, axefx3: null })

/* The first build marked as the opening on this phone, or null. */
const firstOpening = (builds, platform) =>
  builds.filter((b) => b.platform === platform && b.opening).sort((a, b) => (isOlder(a.version, b.version) ? -1 : 1))[0] || null

/**
 * What is wrong with this threshold (`from`, BLUETOOTH_FROM_STORE's shape),
 * against these builds, for an app at `appVersion`: a list of sentences,
 * empty when nothing is.
 *
 * Designed so that it does not break the day the 1.89.0 row is written, nor
 * on the build pull request itself, and so that no later update can quietly
 * set the threshold back:
 *
 *   - every build older than the first one marked as the opening (every
 *     build, while none is) is closed to a customer;
 *   - a build marked as the opening ("Bluetooth (beta) for customers" in
 *     its row, docs/expo-builds.md's header says so) has the threshold
 *     set for each phone it built, and opens on its version: null, or a
 *     higher number, would take Bluetooth away from the copies reviewed
 *     with it, which only a store version whose notes say so may do;
 *   - with no build marked, the threshold is null, or exactly this app's
 *     own version: the build pull request, whose build is the opening.
 *     A number set any earlier would open every APK apk.yml makes from
 *     then on, and would be wrong by the next version anyway;
 *   - so a threshold with no build marked, and not this app's version,
 *     is one of two things, and the message says both. If a build has
 *     already been started from that threshold (the build pull request
 *     merged, the pair built, and the next pull request moved the
 *     version as every one does), the fix is that build's row in
 *     docs/expo-builds.md, marked as the opening, and OPENED_AT above,
 *     with the threshold left as it is: moved to match the version, or
 *     set back to null, it would close Bluetooth by update on the copies
 *     under review. Only if no build was ever made from it is it moved
 *     with the version or set back to null;
 *   - never above this app's version, which a build from here would not
 *     reach;
 *   - AND BOTH PHONES TOGETHER. The opening is one build pair, so with no
 *     build marked the two thresholds agree (both null, or both this
 *     app's version), and once one is marked, the first build marked is
 *     the same version on both phones. Each phone checked on its own
 *     would pass a build pull request that set one phone and left the
 *     other null: the pair would be built, two slots spent, and the other
 *     phone sent for review with notes that say Bluetooth is there and a
 *     copy that keeps it closed, found only by the row's pull request,
 *     when the only fixes left are another build or opening it by update.
 *     And a split row (the opening marked on one phone's build, the same
 *     version's other build left unmarked) would hide that from the row's
 *     check. A one-phone opening is not allowed by this rule; if one is
 *     ever wanted, this rule is changed first, on purpose, and says why
 *     (docs/expo-builds.md's header says the same).
 *
 * The rule test in test/bluetooth.mjs asks this of the threshold as it is,
 * so the two can never disagree about what the build pull request may say.
 */
export const thresholdProblems = (builds, from, appVersion, w = BLUETOOTH_WORDS) => {
  const out = []
  const firsts = { ios: firstOpening(builds, 'ios'), android: firstOpening(builds, 'android') }
  if (!firsts.ios && !firsts.android) {
    const ios = from.ios ?? null
    const android = from.android ?? null
    if (ios !== android) {
      out.push(
        `the threshold is ${ios === null || android === null ? 'set on one phone only' : 'not the same on both phones'} (ios ${ios}, android ${android}) with no build marked as the opening: ` +
          `the build pull request sets both to this app’s version, ${appVersion}, since the pair builds both phones`
      )
    }
  } else if (firsts.ios?.version !== firsts.android?.version) {
    out.push(
      `the opening is marked on ios at ${firsts.ios?.version ?? 'no build'} and on android at ${firsts.android?.version ?? 'no build'}: ` +
        `${w.name} opens on both phones with one build pair, so its one row builds both phones and says "${w.row}" once, for both`
    )
  }
  for (const platform of ['ios', 'android']) {
    const at = from[platform] ?? null
    const open = (v) => bluetoothOpen({ platform, installed: v, admin: false, from })
    const mine = builds.filter((b) => b.platform === platform)
    const first = firsts[platform]
    for (const b of mine) {
      const before = !first || isOlder(b.version, first.version) === true
      if (before && open(b.version)) out.push(`${platform} ${b.version} (${b.date}) is open to a customer, and no build before it is marked as the opening`)
    }
    if (first && !at) out.push(`${platform}: ${first.version} is marked as the opening, and the threshold is null`)
    if (first && at && !open(first.version)) out.push(`${platform}: ${first.version} is marked as the opening, and the threshold ${at} does not open on it`)
    if (!first && at && at !== appVersion) {
      out.push(
        `${platform}: the threshold is ${at} with no build marked as the opening, and it is not this app’s version ${appVersion}. ` +
          `If a build has already been started from threshold ${at}, add its row to docs/expo-builds.md with "${w.row}" in What it was for, set ${w.pin} in test/ledger.mjs to that build, and leave the threshold as it is: moving it or setting it to null would close ${w.name} by update on the copies under review. ` +
          `Only if no build was ever made from ${at}, move it with the version or set it back to null.`
      )
    }
    if (at && isOlder(appVersion, at) !== false) out.push(`${platform}: the threshold ${at} is above this app’s version ${appVersion}, so a build from here would not open it`)
  }
  return out
}

/**
 * What is wrong with the pin (`pin`, OPENED_AT's shape) against these
 * builds, this threshold (`from`) and the store versions live
 * (public/store-versions.json, `stores`): a list of sentences, empty when
 * nothing is.
 *
 *   - a ledger that marks an opening has the pin set, to that build's
 *     version: the row's pull request cannot go green without it;
 *   - a pin that is set has its build in the ledger, marked as the
 *     opening, on every phone it names, and the threshold exactly as it
 *     says: so the row and the threshold cannot be taken out together;
 *   - and, not reading the ledger at all, a store whose live version is
 *     the pin's or later has that phone's threshold set and open on the
 *     pin's version: the copies customers took from it were reviewed with
 *     Bluetooth.
 */
export const pinProblems = ({ builds, from, stores, pin, w = BLUETOOTH_WORDS }) => {
  const out = []
  const opened = ['ios', 'android'].map((p) => firstOpening(builds, p)).filter(Boolean).sort((a, b) => (isOlder(a.version, b.version) ? -1 : 1))[0] || null
  if (opened && !pin) {
    out.push(
      `docs/expo-builds.md marks ${opened.version} as the opening, and ${w.pin} in test/ledger.mjs is null: the pull request that writes the row sets it to that build, ` +
        `{ version: '${opened.version}', ios: <the threshold on ios>, android: <the threshold on android> }, so the row and the threshold cannot be taken out together`
    )
  }
  if (!pin) return out
  if (opened && opened.version !== pin.version) out.push(`${w.pin} says ${pin.version} opened ${w.name}, and docs/expo-builds.md marks ${opened.version} as the opening`)
  for (const platform of ['ios', 'android']) {
    const at = from[platform] ?? null
    if (pin[platform] && !builds.some((b) => b.platform === platform && b.version === pin.version && b.opening)) {
      out.push(`${platform}: ${w.pin} says ${pin.version} opened ${w.name}, and docs/expo-builds.md has no ${platform} build of ${pin.version} marked "${w.row}": the row is never taken out`)
    }
    if (at !== (pin[platform] ?? null)) {
      out.push(`${platform}: ${w.pin} says the threshold is ${pin[platform] ?? null}, and it is ${at}: once a build has opened ${w.name}, the threshold is never moved or set back by an update`)
    }
    if (isOlder(stores?.[platform], pin.version) === false && !bluetoothOpen({ platform, installed: pin.version, admin: false, from })) {
      out.push(`${platform}: public/store-versions.json says ${stores[platform]} is live, at or after ${pin.version}, which opened ${w.name}, and the threshold ${at} does not open on ${pin.version}`)
    }
  }
  return out
}

/**
 * What is wrong with the units' keying (`units`, UNITS_FROM_STORE's shape),
 * against the threshold (`from`, BLUETOOTH_FROM_STORE) and the pin: a list
 * of sentences, empty when nothing is.
 *
 *   - every unit is keyed to both phones together, like the threshold: a
 *     unit open on one phone's copy and not the other's would be reviewed
 *     with notes that say it is there on a copy that keeps it closed;
 *   - with no pin, every unit opens no earlier than Bluetooth itself
 *     (keyed to the threshold, or to a later store version);
 *   - once pinned, every unit the opening build opened (pin.units) is still
 *     open on its version on both phones: closing one by update would take
 *     it from the copies reviewed with it. And every other unit is closed on
 *     that version: a unit added later, keyed to the threshold, would open
 *     by update on every copy reviewed without it. A later unit is keyed to
 *     a later store version of its own.
 */
export const unitProblems = ({ units, from, pin }) => {
  const out = []
  for (const [unit, at] of Object.entries(units || {})) {
    const ios = at?.ios ?? null
    const android = at?.android ?? null
    if (ios !== android) out.push(`${unit}: keyed to ios ${ios} and android ${android}; a unit opens on both phones together`)
    for (const platform of ['ios', 'android']) {
      const mine = at?.[platform] ?? null
      const blue = from?.[platform] ?? null
      if (mine !== null && (blue === null || isOlder(mine, blue) === true)) out.push(`${unit}: opens on ${platform} at ${mine}, before Bluetooth (beta) itself (${blue})`)
    }
  }
  if (!pin) return out
  const opened = Array.isArray(pin.units) ? pin.units : null
  if (!opened) {
    out.push('OPENED_AT has no `units`: the pull request that writes the opening row lists every unit that build opened, so none can be closed or added by update')
    return out
  }
  for (const platform of ['ios', 'android']) {
    if (!pin[platform]) continue
    for (const unit of opened) {
      if (!unitOffered(unit, { platform, installed: pin.version, units })) out.push(`${platform}: ${unit} was opened to customers by ${pin.version}, and is closed on it now: an update would take it from the copies reviewed with it`)
    }
    for (const unit of Object.keys(units || {})) {
      if (!opened.includes(unit) && unitOffered(unit, { platform, installed: pin.version, units })) {
        out.push(`${platform}: ${unit} opens on ${pin.version}, which was reviewed without it: key it to a later store version of its own`)
      }
    }
  }
  return out
}

/**
 * Everything wrong with Edit over Bluetooth's switch (`units`,
 * EDIT_FROM_STORE's shape) against the ledger's text, for an app at
 * `appVersion`, with these pins (`pins`, EDIT_OPENED_AT's shape) and the
 * store versions live (`stores`): a list of sentences, empty when nothing is.
 *
 * One unit at a time: each unit is asked thresholdProblems and pinProblems
 * on the rows that name it, its own entry and its own pin, exactly as
 * Bluetooth's threshold is asked of its own. So a unit left null beside one
 * that a row opens is fine, and so is one keyed to a later store version of
 * its own, whose row comes with its own build. And every row's list of units
 * is read (editRowProblems). Each sentence about a unit starts with its name.
 *
 * test/bluetooth.mjs asks this of the switch, the ledger and the pins as they
 * are, and of made-up ones, so the two never disagree about what the build
 * pull request and the row's pull request may say.
 */
export const editProblems = ({ text, units, appVersion, pins = null, stores = null }) => {
  const out = [...editRowProblems(text)]
  for (const unit of Object.keys(pins || {})) {
    if (!Object.prototype.hasOwnProperty.call(units || {}, unit)) out.push(`EDIT_OPENED_AT names ${unit}, which EDIT_FROM_STORE does not: a unit once opened is never taken out of the switch`)
  }
  for (const [unit, entry] of Object.entries(units || {})) {
    const from = entry || {}
    const w = editWords(unit)
    const builds = ledgerBuilds(text, editOpening(unit))
    const pin = pins?.[unit] ?? null
    for (const p of [...thresholdProblems(builds, from, appVersion, w), ...pinProblems({ builds, from, stores, pin, w })]) out.push(`${EDIT_UNIT_NAMES[unit]}: ${p}`)
  }
  return out
}
