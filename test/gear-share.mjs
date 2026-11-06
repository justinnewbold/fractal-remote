/**
 * WHAT WORKS: THE GEAR NOTES, OFF UNLESS SOMEBODY SAYS YES.
 *
 * "Build the analytics opt-in, opt out, and whatever needs to be built so
 * that we can collect which devices have been connected and tested ... so
 * that it helps us put together a list of everything that works." (Justin,
 * 26 October 2026.)
 *
 * The card promises things the code has to keep, and a promise like "not
 * linked to you" is broken by one well-meant field added later. So each is
 * held here, and most of it is RUN, with a pretend storage and a pretend
 * database (lib/gear-share-rules.js takes both as arguments):
 *
 *   - off until Yes, and storage that will not answer is off too;
 *   - nothing sent while off;
 *   - one note per combination of gear in 30 days;
 *   - nothing in a note but the fields on the list, and no account or
 *     install number among them, at the phone or in the table;
 *   - the card's words, as the card draws them;
 *   - What works, on the Developer pages, for his account alone, at both
 *     ends of the wire.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const RULES = '../mobile/src/lib/gear-share-rules.js'

/** A storage like AsyncStorage, in memory. `broken` throws on every call. */
const memory = ({ broken = false, start = {} } = {}) => {
  const kept = { ...start }
  return {
    kept,
    async getItem(k) {
      if (broken) throw new Error('no storage')
      return k in kept ? kept[k] : null
    },
    async setItem(k, v) {
      if (broken) throw new Error('no storage')
      kept[k] = v
    }
  }
}

/** A database that keeps what it was given. */
const database = () => {
  const rows = []
  return { rows, insert: async (r) => (rows.push(r), { error: null }) }
}

const FM3_COMPUTER = {
  via: 'computer',
  outcome: 'answered',
  unit: 'FM3',
  firmware: '10.01',
  computer_version: '1.89.4',
  phone_os: 'ios',
  phone_os_version: '18.1',
  phone_model: 'iPhone',
  app_version: '1.89.4'
}
const AM4_BLUETOOTH = {
  via: 'bluetooth',
  outcome: 'not answering',
  unit: 'AM4',
  adapter: 'WIDI Uhost',
  phone_os: 'android',
  phone_os_version: '14',
  phone_model: 'Google Pixel 8',
  app_version: '1.89.4'
}

/*
 * LIB/GEARSHARE.JS ON A BENCH, RUN, with the rig, the link and Bluetooth as
 * stores a test moves, a pretend database, and the clock swapped for one the
 * test turns (Date.now, the timers and Math.random). What is under test is
 * when a note goes and what it carries, the way the phone really decides it.
 */
async function gearShareOnABench({ stored = { 'fractal.gearShare.v2': 'yes' } } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gear-share-'))
  const lib = (f) => read(`mobile/src/lib/${f}`)
  const esm = (src) =>
    src
      .replace(/from 'react'/g, "from './react.js'")
      .replace(/from 'react-native'/g, "from './react-native.js'")
      .replace(/from '@react-native-async-storage\/async-storage'/g, "from './async-storage.js'")
      .replace(/import\('@supabase\/supabase-js'\)/g, "import('./supabase.js')")
      .replace(/from '\.\/([\w.-]+)'/g, (whole, name) => (/\.m?js$/.test(name) ? whole : `from './${name}.js'`))
  const clocked = (src) =>
    "import * as __clock from './clock.js'\n" +
    src
      .replace(/\bDate\.now\b/g, '__clock.now')
      .replace(/\bMath\.random\b/g, '__clock.random')
      .replace(/\bsetTimeout\(/g, '__clock.setTimeout(')
      .replace(/\bclearTimeout\(/g, '__clock.clearTimeout(')
  const files = {
    'package.json': '{ "type": "module" }',
    'clock.js': `
      let t = 1000000
      let seq = 0
      const timers = new Map()
      export const bench = { random: 0.5 }
      export const now = () => t
      export const random = () => bench.random
      export function setTimeout(fn, ms = 0, ...args) {
        const id = ++seq
        timers.set(id, { id, at: t + Math.max(0, Number(ms) || 0), fn, args })
        return id
      }
      export function clearTimeout(id) { timers.delete(id) }
      const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => globalThis.setImmediate(r)) }
      export async function advance(ms) {
        const end = t + ms
        await flush()
        for (;;) {
          let next = null
          for (const x of timers.values()) if (x.at <= end && (!next || x.at < next.at || (x.at === next.at && x.id < next.id))) next = x
          if (!next) break
          timers.delete(next.id)
          t = next.at
          next.fn(...next.args)
          await flush()
        }
        t = end
        await flush()
      }
    `,
    'react.js': 'export const useSyncExternalStore = () => null\n',
    'react-native.js': `
      const heard = []
      export const AppState = { addEventListener: (what, fn) => (heard.push(fn), { remove() {} }) }
      export const appGoes = (status) => { for (const fn of heard) fn(status) }
    `,
    'async-storage.js': `
      export const kept = ${JSON.stringify(stored)}
      export default { async getItem(k) { return k in kept ? kept[k] : null }, async setItem(k, v) { kept[k] = v } }
    `,
    'supabase.js': `
      import * as clock from './clock.js'
      export const bench = { refuse: false, tries: [], rows: [] }
      export function createClient() {
        return { from: () => ({ insert: async (row) => {
          bench.tries.push({ at: clock.now(), row })
          if (bench.refuse) return { error: { message: 'new row violates check constraint' }, status: 400 }
          bench.rows.push({ at: clock.now(), row })
          return { error: null, status: 201 }
        } }) }
      }
    `,
    'project.js': "export const DEFAULT_PROJECT = { url: 'https://bench.example', anonKey: 'public' }\n",
    'version.js': "export const APP_VERSION = '1.89.39'\n",
    'debugLog.js': 'export const lines = []\nexport const logDebug = (...said) => { lines.push(said.join(" ")) }\n',
    'notForever.js': "export const notForever = () => { throw new Error('no network on this bench') }\n",
    'admin.js': "export const ago = () => 'today'\n",
    'thisDevice.js': "export const deviceFacts = () => ({ os: 'ios', osVersion: '27.2', model: 'iPhone' })\n",
    'rig.js': `
      import * as clock from './clock.js'
      let state = { unit: 'unknown', deviceName: null, firmware: null, simulated: false, capabilities: null }
      let readAt = -1
      const heard = []
      export const getState = () => state
      export const subscribeRig = (fn) => (heard.push(fn), () => {})
      export const unitReadSince = (t) => readAt >= t
      /* read: the unit said what it is just now (rig readAll). */
      export function set(next, { read = false } = {}) {
        if (read) readAt = clock.now()
        state = { ...state, ...next }
        for (const fn of heard) fn(state)
      }
    `,
    'link.js': `
      let state = { link: 'off', hostVersion: null, hostOs: null }
      let via = 'computer'
      const heard = []
      export const linkState = () => state
      export const linkVia = () => via
      export const subscribeLink = (fn) => (heard.push(fn), () => {})
      export function set(next, how) {
        if (how) via = how
        state = { ...state, ...next }
        for (const fn of heard) fn(state)
      }
    `,
    'bluetooth.js': `
      let phase = 'off'
      let saved = {}
      let cable = false
      const heard = []
      export const bluetoothSettings = () => saved
      export const bluetoothPhase = () => phase
      export const subscribeBluetooth = (fn) => (heard.push(fn), () => {})
      export const unitName = (k) => ({ am4: 'AM4', fm3: 'FM3' })[k] || 'unit'
      export const adapterName = (a) => (a && a.name) || null
      export const cableNow = () => cable
      export const bluetoothFacts = () => ({ answeredAs: null })
      export function set(next) {
        if ('phase' in next) phase = next.phase
        if ('saved' in next) saved = next.saved
        if ('cable' in next) cable = next.cable
        for (const fn of heard) fn()
      }
    `
  }
  for (const f of ['tapTimes.js', 'bleAdapters.js', 'device-word.js']) files[f] = esm(lib(f))
  files['gear-share-rules.js'] = clocked(esm(lib('gear-share-rules.js')))
  files['gearShare.js'] = clocked(esm(lib('gearShare.js')))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => import(pathToFileURL(join(dir, f)).href)
  const [glue, clock, rig, link, bt, db, taps, app, store, log] = await Promise.all(
    ['gearShare.js', 'clock.js', 'rig.js', 'link.js', 'bluetooth.js', 'supabase.js', 'tapTimes.js', 'react-native.js', 'async-storage.js', 'debugLog.js'].map(at)
  )
  await clock.advance(0)
  glue.startGearShare()
  return {
    glue,
    clock,
    rig,
    link,
    bt,
    db: db.bench,
    tap: (ms) => taps.tapTime(ms),
    appGoes: app.appGoes,
    kept: store.kept,
    lines: log.lines,
    sec: (s) => clock.advance(s * 1000),
    rows: () => db.bench.rows.map((x) => x.row),
    /* A unit answering through a computer, 0.8 s after the link started trying. */
    async computer({ os = 'macOS 27.0 (Apple silicon)', unit = 'FM3' } = {}) {
      link.set({ link: 'joining' }, 'computer')
      await clock.advance(800)
      rig.set({ unit: 'present', deviceName: unit, firmware: '10.01' }, { read: true })
      link.set({ link: 'connected', hostVersion: '1.89.36', hostOs: os })
    },
    /* A unit answering over Bluetooth (or a cable), 1.2 s after the link started trying. */
    async bluetooth({ adapter = 'WIDI Jack', cable = false } = {}) {
      link.set({ link: 'joining' }, 'bluetooth')
      bt.set({ phase: 'connecting', cable, saved: { unit: 'am4', adapter: { id: adapter, name: adapter } } })
      await clock.advance(1200)
      rig.set({ unit: 'present', deviceName: 'AM4' }, { read: true })
      bt.set({ phase: 'connected' })
      link.set({ link: 'connected' })
    },
    done: () => rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  test('What works is off until somebody taps Yes, share, and storage that will not answer is off', async () => {
    const r = await import(RULES)
    for (const stored of [null, undefined, '', 'true', 'YES', '1', 'maybe']) {
      assert.equal(r.answerFrom(stored), null, `${stored} reads as an answer`)
      assert.equal(r.sharing(r.answerFrom(stored)), false, `${stored} switches sharing on`)
    }
    assert.equal(r.sharing('no'), false)
    assert.equal(r.sharing('yes'), true)
    const fresh = r.createGearSharer({ storage: memory(), insert: async () => ({}) })
    assert.equal(await fresh.answer(), null, 'a new install has an answer it never gave')
    const broken = r.createGearSharer({ storage: memory({ broken: true }), insert: async () => ({}) })
    assert.equal(r.sharing(await broken.answer()), false, 'storage that will not answer switches sharing on')
    /* The phone asks the card only when there is no answer (or a Yes to the words before), and reads it as off meanwhile. */
    assert.equal(await fresh.owed(), 'first')
    assert.equal(await broken.owed(), 'first')
    const glue = read('mobile/src/lib/gearShare.js')
    assert.match(glue, /export async function shareQuestionDue\(\) \{\n  return sharer\.owed\(\)\n\}/, 'the card is owed on some other condition than the sharer says')
    assert.match(glue, /const readOn = \(\) => sharing\(answer\)/, 'the Settings switch reads something other than the stored answer')
  })

  test('Nothing is sent while sharing is off, whatever connects', async () => {
    const r = await import(RULES)
    for (const start of [{}, { [r.SHARE_KEY]: 'no' }, { [r.SHARE_KEY]: 'garbage' }]) {
      const db = database()
      const s = r.createGearSharer({ storage: memory({ start }), insert: db.insert })
      for (const facts of [FM3_COMPUTER, AM4_BLUETOOTH]) {
        const said = await s.report(facts)
        assert.equal(said.sent, false)
        assert.equal(said.why, 'off')
      }
      assert.equal(db.rows.length, 0, `a note went with ${JSON.stringify(start)} stored`)
    }
    /* Yes, then No thanks in Settings: nothing from then on. */
    const db = database()
    const storage = memory()
    const s = r.createGearSharer({ storage, insert: db.insert })
    await s.setAnswer(true)
    assert.equal(storage.kept[r.SHARE_KEY], 'yes')
    assert.equal(storage.kept[r.SHARE_KEY_BEFORE], 'yes', 'a copy from before the new words reads an older answer')
    assert.equal((await s.report(FM3_COMPUTER)).sent, true)
    await s.setAnswer(false)
    assert.equal(storage.kept[r.SHARE_KEY], 'no')
    assert.equal(storage.kept[r.SHARE_KEY_BEFORE], 'no', 'a No reaches the key a copy from before reads')
    assert.equal((await s.report(AM4_BLUETOOTH)).sent, false, 'turning it off in Settings did not stop the notes')
    assert.equal(db.rows.length, 1)
    /* And the phone does not even start a wait while it is off. */
    assert.match(read('mobile/src/lib/gearShare.js'), /function look\(\) \{\n  if \(!sharing\(answer\)\) return/, 'the phone watches for gear while sharing is off')
  })

  test('One note per combination of gear in 30 days, counted on the device', async () => {
    const r = await import(RULES)
    let now = Date.parse('2026-10-26T12:00:00Z')
    const db = database()
    const storage = memory({ start: { [r.SHARE_KEY]: 'yes' } })
    const s = r.createGearSharer({ storage, insert: db.insert, now: () => now })
    assert.equal((await s.report(FM3_COMPUTER)).sent, true)
    assert.equal((await s.report(FM3_COMPUTER)).why, 'sent already')
    /* An app update is not new gear. */
    assert.equal((await s.report({ ...FM3_COMPUTER, app_version: '1.89.5' })).why, 'sent already', 'every app update sends every rig again')
    /* New firmware, or another adapter, is. */
    assert.equal((await s.report({ ...FM3_COMPUTER, firmware: '10.02' })).sent, true)
    assert.equal((await s.report(AM4_BLUETOOTH)).sent, true)
    assert.equal((await s.report({ ...AM4_BLUETOOTH, adapter: 'WIDI Master' })).sent, true)
    assert.equal(db.rows.length, 4)
    /* Two together cannot both find it unsent. */
    const both = await Promise.all([s.report({ ...FM3_COMPUTER, unit: 'FM9' }), s.report({ ...FM3_COMPUTER, unit: 'FM9' })])
    assert.deepEqual(both.map((b) => b.sent), [true, false], 'two changes landing together sent one combination twice')
    /* 29 days on, still sent; 30, again. */
    now += 29 * 24 * 3600 * 1000
    assert.equal((await s.report(FM3_COMPUTER)).sent, false)
    now += 1 * 24 * 3600 * 1000
    assert.equal((await s.report(FM3_COMPUTER)).sent, true, 'a combination is never sent again after its 30 days')
    /* What is kept on the device is keys and times, and only those inside the 30 days. */
    const kept = JSON.parse(storage.kept[r.SENT_KEY])
    for (const [k, at] of Object.entries(kept)) {
      assert.match(k, /^g[0-9a-f]{8}$/, 'the sent list keeps something other than a key')
      assert.ok(now - at < r.RESEND_MS)
    }
    assert.deepEqual(r.sentFrom('not json'), {})
    assert.deepEqual(r.sentFrom({ a: Date.now() + 99999 }), {}, 'a time in the future holds a combination back for ever')
    /* A note the database refused is not marked sent, so it goes again, but not sooner than RETRY_MS. */
    let tries = 0
    const refusing = r.createGearSharer({ storage: memory({ start: { [r.SHARE_KEY]: 'yes' } }), insert: async () => (tries++, { error: { message: 'no table' } }), now: () => now })
    assert.equal((await refusing.report(FM3_COMPUTER)).why, 'not sent')
    assert.equal((await refusing.report(FM3_COMPUTER)).why, 'tried just now', 'a refused note is sent again at every settle')
    assert.equal(tries, 1)
    assert.equal((await refusing.report(AM4_BLUETOOTH)).why, 'not sent', 'one refused note holds back other gear')
    now += r.RETRY_MS - 1
    assert.equal((await refusing.report(FM3_COMPUTER)).why, 'tried just now')
    now += 1
    assert.equal((await refusing.report(FM3_COMPUTER)).why, 'not sent', 'a refused note was counted as sent, or never tried again')
    assert.equal(tries, 3)
    const throwing = r.createGearSharer({ storage: memory({ start: { [r.SHARE_KEY]: 'yes' } }), insert: async () => { throw new Error('offline') } })
    assert.equal((await throwing.report(FM3_COMPUTER)).sent, false, 'a send that threw got out of report')
  })

  test('A note carries the listed fields and nothing else: no account, no install number, nothing typed', async () => {
    const r = await import(RULES)
    const db = database()
    const s = r.createGearSharer({ storage: memory({ start: { [r.SHARE_KEY]: 'yes' } }), insert: db.insert })
    await s.report({
      ...FM3_COMPUTER,
      user_id: '7dfe6912-e43b-49bf-84e4-b56afbd442b1',
      account: 'a@b.c',
      email: 'a@b.c',
      install_id: 'abc',
      device_id: 'abc',
      preset: 'Lead Tone',
      macName: "Justin's MacBook",
      location: '40.7,-111.9'
    })
    const [row] = db.rows
    assert.deepEqual(Object.keys(row).sort(), [...r.FIELDS].sort(), 'a note carries a field that is not on the list')
    const allowed = ['via', 'unit', 'firmware', 'adapter', 'outcome', 'computer_os', 'computer_version', 'phone_os', 'phone_os_version', 'phone_model', 'app_version', 'connect_ms', 'tap_ms']
    assert.deepEqual([...r.FIELDS].sort(), [...allowed].sort(), 'the list of fields moved: the card, the privacy page and the label say what they say about this list')
    assert.ok(!JSON.stringify(row).includes('7dfe6912') && !JSON.stringify(row).includes('a@b.c') && !JSON.stringify(row).includes('Lead Tone') && !JSON.stringify(row).includes('MacBook'))
    /* The adapter only over Bluetooth, the computer only through one. */
    assert.equal(r.gearRecord({ ...FM3_COMPUTER, adapter: 'WIDI' }).adapter, null)
    assert.equal(r.gearRecord({ ...AM4_BLUETOOTH, computer_version: '1.0' }).computer_version, null)
    /* No unit, or a way or outcome not on the list, is no note. */
    assert.equal(r.gearRecord({ ...FM3_COMPUTER, unit: '  ' }), null)
    assert.equal(r.gearRecord({ ...FM3_COMPUTER, via: 'demo' }), null)
    assert.equal(r.gearRecord({ ...FM3_COMPUTER, outcome: 'great' }), null)
    /* Long text is cut to what the table takes, never refused. */
    assert.equal(r.gearRecord({ ...AM4_BLUETOOTH, adapter: 'x'.repeat(500) }).adapter.length, r.LIMITS.adapter)

    /* The table: the same fields and lengths, no account column, read by nobody through the API. */
    const sql = read('supabase/migrations/20261026_gear_reports.sql')
    const table = sql.slice(sql.indexOf('create table'), sql.indexOf(');', sql.indexOf('create table')))
    for (const [field, max] of Object.entries(r.LIMITS)) {
      if (field === 'via' || field === 'outcome') continue
      assert.ok(table.includes(`check (length(${field})`) && new RegExp(`length\\(${field}\\)[^\\n]*${max}\\)`).test(table), `the table and the phone disagree about how long ${field} may be`)
    }
    assert.match(table, /via in \('computer', 'bluetooth'\)/)
    assert.match(table, /outcome in \('answered', 'not answering'\)/)
    assert.ok(!/user_id|account|install|device_id|email|ip_|address/i.test(table.replace(/--.*$/gm, '')), 'the table has a column that could say whose note it was')
    assert.match(sql, /alter table public\.gear_reports enable row level security/)
    assert.match(sql, /revoke all on table public\.gear_reports from anon, authenticated/)
    assert.ok(!/for select|for update|for delete|for all/.test(sql.replace(/--.*$/gm, '')), 'somebody can read, change or delete a note through the API')
    assert.match(sql, /interval '2 years'/, 'the table keeps notes longer than the privacy page says')
    /* The phone sends it with no session, so no account rides along in the request either. */
    const glue = read('mobile/src/lib/gearShare.js')
    assert.match(glue, /persistSession: false, autoRefreshToken: false/, 'the note goes on a client that can carry a sign-in')
    assert.ok(!/supabaseClient|getSession|accountId|currentAccount|haveSession/.test(glue.replace(/\/\*[\s\S]*?\*\//g, '')), 'the note is sent alongside the account')
    assert.ok(!/deviceName|Constants/.test(glue.replace(/\/\*[\s\S]*?\*\//g, '')), 'the name somebody gave their device can reach a note')
    /* No new package: the store build count is precious. */
    const pkg = JSON.parse(read('mobile/package.json'))
    for (const dep of ['expo-device', 'expo-application', 'expo-constants', 'react-native-device-info']) {
      assert.ok(!(dep in pkg.dependencies), `${dep} was added for the gear notes, which would cost a store build`)
    }
  })

  test('What the app knows becomes a note only for real gear that connected', async () => {
    const r = await import(RULES)
    const phone = { os: 'ios', osVersion: '18.1', model: 'iPhone' }
    const computer = (rig, link = { link: 'connected', hostVersion: '1.89.4' }) => r.noteFacts({ rig, via: 'computer', link, phone, appVersion: '1.89.4' })
    assert.equal(r.noteFacts({ rig: { unit: 'present', deviceName: 'FM3' }, via: 'demo', phone }), null, 'the demo sends a note')
    assert.equal(computer({ unit: 'present', deviceName: 'FM3', simulated: true }), null, 'the simulated unit sends a note')
    assert.equal(computer({ unit: 'missing' }), null, 'a computer with no unit sends a note')
    assert.equal(computer({ unit: 'present', deviceName: 'FM3' }, { link: 'joining' }), null)
    const fm3 = r.gearRecord(computer({ unit: 'present', deviceName: 'FM3', firmware: '10.01' }))
    assert.equal(fm3.outcome, 'answered')
    assert.equal(fm3.computer_version, '1.89.4')
    const bt = (rig, bluetooth) => r.gearRecord(r.noteFacts({ rig, via: 'bluetooth', bluetooth, phone, appVersion: '1.89.4' }))
    assert.equal(bt({ unit: 'present', deviceName: 'AM4' }, { phase: 'connecting', unit: 'AM4', adapter: 'WIDI Uhost' }), null, 'an adapter not yet connected is a result')
    const silent = bt({ unit: 'missing' }, { phase: 'connected', unit: 'FM3', adapter: 'WIDI Uhost' })
    assert.deepEqual([silent.unit, silent.adapter, silent.outcome], ['FM3', 'WIDI Uhost', 'not answering'])
    assert.equal(bt({ unit: 'present', deviceName: 'AM4' }, { phase: 'connected', unit: 'AM4', adapter: '' }).adapter, null, 'an adapter with no name is sent as an empty name')
    /* A different unit answered (the adapter in the FM3, the AM4 picked): a mix-up, never "AM4 not answering", nor a note for the FM3. */
    assert.equal(bt({ unit: 'missing' }, { phase: 'connected', unit: 'AM4', adapter: 'WIDI Uhost Bluetooth', answeredAs: 'FM3' }), null, 'a wrong unit answering is sent as the picked unit not answering')
    assert.equal(bt({ unit: 'present', deviceName: 'FM3' }, { phase: 'connected', unit: 'AM4', adapter: 'WIDI Uhost Bluetooth', answeredAs: 'FM3' }), null)
    assert.match(read('mobile/src/lib/gearShare.js'), /answeredAs: bluetoothFacts\(\)\.answeredAs/, 'the phone never tells the rule a different unit answered')
  })

  test('The card says exactly what goes and what never does, and Settings changes it', async () => {
    const r = await import(RULES)
    const words = await import('../mobile/src/lib/device-word.js')
    assert.equal(r.SHARE_TITLE, 'Help make Fractal Remote better?')
    assert.equal(r.SHARE_YES, 'Yes, share')
    assert.equal(r.SHARE_NO, 'No thanks')
    const [what, never, change] = r.shareWords()
    for (const want of ['which gear it is', 'how well it connected', 'a list of what works']) {
      assert.ok(what.includes(want), `the card does not say it sends ${want}`)
    }
    /* Short enough to fit on a phone's screen with both buttons (Justin, 6 November 2026), the rest one tap away. */
    assert.ok([what, never, change].join(' ').length <= 300, 'the card has grown long again: the full list belongs on the privacy page')
    assert.equal(r.SHARE_DETAILS_URL, 'https://fractal.newbold.cloud/privacy.html#which-gear')
    assert.match(read('public/privacy.html'), /<h3 id="which-gear">Which gear works/, 'the card’s link lands nowhere on the privacy page')
    assert.match(read('mobile/src/components/GearShareNotice.js'), /Linking\.openURL\(SHARE_DETAILS_URL\)[\s\S]*\{SHARE_DETAILS\}/, 'the card does not link to the whole list')
    for (const want of ['presets', 'anything you type', 'where you are', 'who you are']) {
      assert.ok(never.includes(want), `the card does not say ${want}`)
    }
    assert.match(change, /Off unless you tap Yes, share/)
    assert.match(change, /Settings → Troubleshooting/)
    /* And the row in Settings says the three ways, and how quickly. */
    assert.ok(r.shareRowLine(true).includes('a computer, Bluetooth or a USB cable'), 'the Settings row leaves out a way a note can come in')
    assert.ok(r.shareRowLine(true).includes('how quickly'), 'the Settings row does not say the times go')
    /* The device in hand by its name, read when drawn. */
    words.setDevice('ipad')
    try {
      assert.match(r.shareWords()[0], /this iPad shares/)
    } finally {
      words.setDevice('phone')
    }
    for (const text of [...r.shareWords(), r.shareRowLine(true), r.shareRowLine(false)]) {
      assert.ok(!/beta|Fractal Audio|official|endorsed/i.test(text), `the gear words say something they must not: ${text}`)
    }
    /* "this phone" is never typed: the device is named by deviceNoun() when the words are read. */
    assert.ok(!/this phone/.test(read('mobile/src/lib/gear-share-rules.js').replace(/\/\*[\s\S]*?\*\//g, '')), 'the gear words type "this phone"')
    /* The card draws those words and those two buttons, and says first what is new to somebody who said Yes to less. */
    const card = read('mobile/src/components/GearShareNotice.js')
    assert.match(card, /const \[what, never, change\] = shareWords\(\)/)
    assert.match(card, /\{again \? <Text[^\n]*\{SHARE_AGAIN\}<\/Text> : null\}/, 'the card shown again does not say why')
    for (const want of ['a USB cable', 'how fast your unit answers', 'nothing new is sent']) {
      assert.ok(r.SHARE_AGAIN.includes(want), `the card shown again does not say ${want}`)
    }
    assert.match(read('mobile/App.js'), /<GearShareNotice\n\s+again=\{shareDue === 'again'\}/, 'the card shown again looks like the first time')
    assert.match(card, /label=\{SHARE_YES\}[^\n]*onAnswer\?\.\(true\)/)
    assert.match(card, /label=\{SHARE_NO\}[^\n]*onAnswer\?\.\(false\)/)
    /* Shown after the independent card and the walkthrough, signed in and past the paywall, never in the demo, in Play's place. */
    const app = read('mobile/App.js')
    assert.match(app, /const askShare = shareDue && auth === 'in' && !demo\n/, 'the sharing card can come in the demo or before the sign-in')
    const at = (s) => app.indexOf(s)
    assert.ok(at(') : independentDue ? (') > 0 && at(') : independentDue ? (') < at(') : askShare ? ('), 'the sharing card can come before "An independent app"')
    assert.ok(at(') : seenWalk === false ? (') < at(') : askShare ? ('), 'the sharing card can come before the walkthrough')
    assert.ok(at(") : auth === 'paywall' ? (") < at(') : askShare ? ('), 'the sharing card can come before the purchase page')
    assert.match(app, /onAnswer=\{\(yes\) => \{\n\s+setSharing\(yes\)\n\s+setShareDue\(false\)/, 'an answer on the card is not kept')
    /* And Settings → Troubleshooting has the switch. */
    const settings = read('mobile/src/screens/Settings.js')
    const trouble = settings.slice(settings.indexOf("{page === 'trouble' ? ("), settings.indexOf("{page === 'link' ? ("))
    assert.match(trouble, /<GearShareSwitch \/>/, 'Troubleshooting has no way to change the answer')
    assert.match(read('mobile/src/components/GearShareSwitch.js'), /onPress=\{\(\) => setSharing\(!on\)\}/)
  })

  test('What works is on the Developer pages for his account alone, and the server checks before it reads', async () => {
    const { ADMINS } = await import('../shared/admin.mjs')
    const settings = read('mobile/src/screens/Settings.js')
    /* Under Developer → App health since 30 October 2026, when ten Developer rows became four. */
    assert.match(settings, /\{page === 'health' && isAdmin\(account\?\.id\) \?[^]*?\{devTab\.health === 'works' \? <WhatWorksTool \/> : null\}/, 'What works is drawn for anybody')
    /* The row is under the Developer heading on the front of Settings since 2 November 2026,
       on his account only, so back from App health goes to Settings. */
    const developer = settings.slice(settings.indexOf('{isAdmin(account?.id) ? (\n            <Group title="Developer"'), settings.indexOf('</Group>', settings.indexOf('<Group title="Developer"')))
    assert.ok(developer.length > 0, 'the Developer rows moved; this check reads them')
    assert.match(developer, /title="App health"[^\n]*setPage\('health'\)/, 'the row is not under Developer')
    assert.match(settings, /\{ key: 'works', label: 'What works' \}/, 'App health has no What works button')
    assert.ok(!/health: 'developer'/.test(settings), 'Back from App health goes to a Developer page that is not there any more')

    const fn = read('supabase/functions/gear-reports/index.ts')
    assert.deepEqual(JSON.parse((fn.match(/const ADMINS = (\[[^\]]*\])/) || [])[1]?.replace(/'/g, '"') || 'null'), ADMINS, 'the gear server and the apps disagree about whose tools these are')
    const handler = fn.slice(fn.indexOf('Deno.serve('))
    const lock = handler.indexOf('ADMINS.includes(me.id)')
    assert.ok(lock > 0 && lock < handler.indexOf('await rows(') && lock < handler.indexOf('await sweep()'), 'the gear server reads before checking who is asking')
    assert.ok(!/\bfold\(|5381|me\.email\)/.test(fn.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), 'the gear server decides who is Justin from the email address')
    assert.ok(!/method: 'DELETE'|method: 'PATCH'/.test(fn), 'the gear page can change or delete a note')

    /* The call never throws, and the page adds the notes up. */
    const r = await import(RULES)
    assert.equal((await r.gearAction({ url: 'x', anonKey: 'k', token: null })).message, 'Sign in first.')
    assert.equal((await r.gearAction({ url: 'x', anonKey: 'k', token: 't', fetchImpl: () => Promise.reject(new Error('offline')) })).ok, false)
    const now = Date.parse('2026-10-26T12:00:00Z')
    const reports = [
      { created_at: '2026-10-26T10:00:00Z', via: 'bluetooth', unit: 'AM4', adapter: 'WIDI Uhost', outcome: 'answered', phone_os: 'ios' },
      { created_at: '2026-10-25T10:00:00Z', via: 'bluetooth', unit: 'AM4', adapter: 'WIDI Uhost', outcome: 'not answering', phone_os: 'android' },
      { created_at: '2026-10-20T10:00:00Z', via: 'computer', unit: 'AM4', outcome: 'answered', firmware: '2.00' },
      { created_at: '2026-10-24T10:00:00Z', via: 'computer', unit: 'FM3', computer_os: 'macOS', outcome: 'answered', firmware: '10.01' }
    ]
    const sections = r.gearSections({ ok: true, reports }, now)
    assert.deepEqual(sections.map((s) => s.title), ['AM4', 'FM3'], 'the units are not newest first')
    assert.deepEqual(sections[0].rows.map((x) => x.label), ['Bluetooth · WIDI Uhost', 'Computer · system not said'])
    assert.equal(sections[0].rows[0].value, '1 worked · 1 didn’t answer\nnewest today\nAndroid, iOS')
    assert.equal(sections[1].rows[0].value, '1 worked · 0 didn’t answer\nnewest 2 days ago · firmware 10.01')
    assert.equal(sections[1].rows[0].label, 'Computer · macOS')
    /*
     * Everything a note carries is on the page (3 November 2026, "Can we get
     * more information about the computers being used at all?"): the
     * computer app's version, the phone and its system, the app's version,
     * newest first and a few at most; and Apple's network session, never an
     * adapter, is left off.
     */
    const full = r.gearSections(
      {
        ok: true,
        reports: [
          { created_at: '2026-10-26T10:00:00Z', via: 'computer', unit: 'FM3', computer_os: 'Raspberry Pi 3 · Debian 12 (64-bit)', computer_version: '1.89.27', firmware: '13.0', outcome: 'answered', phone_os: 'ios', phone_os_version: '27.2', phone_model: 'iPhone', app_version: '1.89.27' },
          { created_at: '2026-10-25T10:00:00Z', via: 'computer', unit: 'FM3', computer_os: 'Raspberry Pi 3 · Debian 12 (64-bit)', computer_version: '1.89.9', firmware: '13.0', outcome: 'answered', phone_os: 'android', phone_os_version: '10', phone_model: 'HUAWEI CLT-L29', app_version: '1.89.10' },
          { created_at: '2026-10-24T10:00:00Z', via: 'computer', unit: 'FM3', computer_os: 'Raspberry Pi 3 · Debian 12 (64-bit)', computer_version: '1.89.22', outcome: 'not answering', phone_os: 'ios', phone_os_version: '27.2', phone_model: 'iPhone', app_version: '1.89.20' },
          { created_at: '2026-10-23T10:00:00Z', via: 'computer', unit: 'FM3', computer_os: 'Raspberry Pi 3 · Debian 12 (64-bit)', computer_version: '1.88.0', outcome: 'answered', phone_os: 'ios', phone_os_version: '27.2', phone_model: 'iPhone', app_version: '1.89.20' },
          { created_at: '2026-10-22T10:00:00Z', via: 'bluetooth', unit: 'FM3', adapter: 'Rețea Session 1', outcome: 'not answering', phone_os: 'ios' }
        ]
      },
      now
    )
    assert.deepEqual(full.map((x) => x.rows.map((y) => y.label)), [['Computer · Raspberry Pi 3 · Debian 12 (64-bit)']], 'Apple’s network session is on the page as an adapter')
    assert.equal(
      full[0].rows[0].value,
      '3 worked · 1 didn’t answer\nnewest today · firmware 13.0\ncomputer app 1.89.27, 1.89.22, 1.89.9 and 1 older\nHUAWEI CLT-L29 · Android 10, iPhone · iOS 27.2\nFractal Remote 1.89.27, 1.89.20, 1.89.10'
    )
    assert.match(r.gearSections({ ok: true, reports: [] })[0].rows[0].value, /Nothing has come in yet/)
    assert.deepEqual(r.gearSections({ ok: false }), [])
  })

  test('The privacy page and the store notes say what the gear notes are', async () => {
    const page = read('public/privacy.html').replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, '’').replace(/&ldquo;|&rdquo;/g, '"').replace(/&rarr;/g, '→').replace(/\s+/g, ' ')
    for (const want of [
      'Which gear works — only if you say yes',
      'It is off unless you tap Yes, share',
      'Settings → Troubleshooting → Share what gear works',
      'It is not linked to you.',
      'at most once every 30 days',
      'two years from when each was sent',
      'through the computer app, Bluetooth or a USB cable',
      'how long it took to connect, and how quickly the unit answers a tap',
      'gear and versions is sent at most once every 30 days',
      'keeps its own record of every request it receives',
      'A VP4 over Bluetooth or a USB cable sends no note'
    ]) {
      assert.ok(page.includes(want), `the privacy page does not say: ${want}`)
    }
    const store = read('docs/app-store.md')
    const part = store.slice(store.indexOf('### What works: the gear notes'), store.indexOf('## Age rating'))
    assert.match(part, /Diagnostics → Other\s+Diagnostic\s+Data/)
    assert.match(part, /Device or other IDs:\s+no change/)
    /* The two times are Performance Data on Apple's label (4 November 2026). */
    assert.match(part, /Performance Data/, 'the store notes do not say the times go on the label as Performance Data')
    assert.match(store, /\| Diagnostics → \*\*Performance Data\*\* \| Yes \| No \|/, 'the label table has no Performance Data row')
  })

  /*
   * A USB CABLE IS ITS OWN KIND (4 November 2026, Justin: "Yes, add the
   * cable connection server change"). Before, a unit on a cable sent no note
   * at all, rather than be called Bluetooth.
   */
  test('What works: a unit on a USB cable is noted as a USB cable, with the cable’s name, never as Bluetooth', async () => {
    const r = await import(RULES)
    const phone = { os: 'ios', osVersion: '27.2', model: 'iPhone' }
    const facts = (via) => r.noteFacts({ via, rig: { unit: 'present', deviceName: 'AM4' }, bluetooth: { phase: 'connected', unit: 'AM4', adapter: 'AM4' }, phone, appVersion: '1.89.38' })
    const usb = r.gearRecord(facts('usb'))
    assert.ok(usb, 'a unit on a USB cable makes no note')
    assert.deepEqual([usb.via, usb.unit, usb.adapter, usb.outcome, usb.computer_os, usb.computer_version], ['usb', 'AM4', 'AM4', 'answered', null, null])
    assert.equal(r.gearRecord({ ...facts('usb'), computer_version: '1.89.36', computer_os: 'macOS 27.0' }).computer_version, null, 'a cable note carries a computer')
    assert.notEqual(r.gearKey(usb), r.gearKey(r.gearRecord(facts('bluetooth'))), 'a cable and Bluetooth count as the same combination')
    assert.ok(r.VIAS.includes('usb'))
    /* A cable that connected to a unit that did not answer is a note too, as over Bluetooth. */
    const silent = r.gearRecord(r.noteFacts({ via: 'usb', rig: { unit: 'missing' }, bluetooth: { phase: 'connected', unit: 'FM3', adapter: 'C2MIDI Pro' }, phone, appVersion: '1.89.38' }))
    assert.deepEqual([silent.via, silent.unit, silent.adapter, silent.outcome], ['usb', 'FM3', 'C2MIDI Pro', 'not answering'])
    assert.equal(r.wayOf({ via: 'usb', adapter: 'C2MIDI Pro' }), 'USB cable · C2MIDI Pro')
    assert.equal(r.wayOf({ via: 'usb', adapter: null }), 'USB cable · a unit with no name')
    const page = r.gearSections({ ok: true, reports: [{ created_at: '2026-11-04T10:00:00Z', via: 'usb', unit: 'AM4', adapter: 'AM4', outcome: 'answered' }] }, Date.parse('2026-11-04T12:00:00Z'))
    assert.deepEqual(page.map((x) => x.rows.map((y) => y.label)), [['USB cable · AM4']])
    /* The phone tells a cable from Bluetooth, and sends it. */
    const glue = read('mobile/src/lib/gearShare.js')
    assert.match(glue, /const via = linkVia\(\) === 'bluetooth' && cableNow\(\) \? 'usb' : linkVia\(\)/, 'the phone sends a cable as Bluetooth')
    assert.ok(!/cableNow\(\)\) return null/.test(glue), 'the phone still sends no note for a cable')
    /* And the table takes it. */
    const sql = read('supabase/migrations/20261104_gear_reports_usb_and_times.sql')
    assert.match(sql, /drop constraint if exists gear_reports_via_check/)
    assert.match(sql, /via in \('computer', 'bluetooth', 'usb'\)/)
  })

  /*
   * HOW LONG THINGS TAKE (4 November 2026, Justin: "Go with your picks"):
   * how long the unit took to answer once the link started trying, and the
   * middle of the player's own taps, from what the phone does anyway.
   */
  test('What works: the two times are rounded milliseconds in the table’s range or nothing, and never make a new combination', async () => {
    const r = await import(RULES)
    assert.deepEqual(Object.keys(r.TIMES), ['connect_ms', 'tap_ms'])
    assert.ok(!('connect_ms' in r.LIMITS) && !('tap_ms' in r.LIMITS), 'a time is cut as text')
    const kept = r.gearRecord({ ...FM3_COMPUTER, connect_ms: 2400.4, tap_ms: 140 })
    assert.equal(kept.connect_ms, 2400)
    assert.equal(kept.tap_ms, 140)
    /*
     * ROUNDED, so a connect time is not the gap between two lines of a debug
     * log to the thousandth: a connection to the nearest 100 ms, a tap to 10.
     */
    assert.deepEqual(r.TIME_STEPS, { connect_ms: 100, tap_ms: 10 })
    assert.deepEqual([2449, 2450, 1, 49, 599999].map((ms) => r.gearRecord({ ...FM3_COMPUTER, connect_ms: ms }).connect_ms), [2400, 2500, 0, 0, 600000])
    assert.deepEqual([144, 145, 4, 599996].map((ms) => r.gearRecord({ ...FM3_COMPUTER, tap_ms: ms }).tap_ms), [140, 150, 0, 600000])
    for (const ms of [0, 1, 777, 1234, 59999, 600000]) {
      const rec = r.gearRecord({ ...FM3_COMPUTER, connect_ms: ms, tap_ms: ms })
      assert.equal(rec.connect_ms % 100, 0, `${ms} is sent to the millisecond`)
      assert.equal(rec.tap_ms % 10, 0)
      assert.ok(rec.connect_ms <= r.TIMES.connect_ms && rec.tap_ms <= r.TIMES.tap_ms)
    }
    for (const bad of ['fast', '2400', -1, 600001, NaN, Infinity, null, undefined, {}]) {
      const rec = r.gearRecord({ ...FM3_COMPUTER, connect_ms: bad, tap_ms: bad })
      assert.equal(rec.connect_ms, null, `${String(bad)} is kept as a connect time`)
      assert.equal(rec.tap_ms, null, `${String(bad)} is kept as a tap time`)
    }
    assert.equal(r.gearRecord({ ...FM3_COMPUTER, tap_ms: 600000 }).tap_ms, 600000)
    assert.equal(r.gearKey(r.gearRecord(FM3_COMPUTER)), r.gearKey(kept), 'a different time counts as new gear')
    /* The key of a note with no times is the one it always was, so nothing already sent goes again. */
    assert.equal(r.gearKey(r.gearRecord(FM3_COMPUTER)), r.gearKey({ ...r.gearRecord(FM3_COMPUTER), connect_ms: undefined, tap_ms: undefined }))
    /* Only a note that answered carries them, and a tap time only through a computer: over Bluetooth or a cable it would be the wire's own wait. */
    const phone = { os: 'ios', osVersion: '27.2', model: 'iPhone' }
    const times = { connectMs: 2400, tapMs: 140 }
    for (const via of ['bluetooth', 'usb']) {
      const answered = r.gearRecord(r.noteFacts({ via, rig: { unit: 'present', deviceName: 'AM4' }, bluetooth: { phase: 'connected', unit: 'AM4', adapter: 'WIDI Jack' }, phone, appVersion: '1.89.38', times }))
      assert.deepEqual([answered.connect_ms, answered.tap_ms], [2400, null], `a tap over ${via} is sent as how quickly the unit answered`)
    }
    const silent = r.gearRecord(r.noteFacts({ via: 'bluetooth', rig: { unit: 'missing' }, bluetooth: { phase: 'connected', unit: 'AM4', adapter: 'WIDI Jack' }, phone, appVersion: '1.89.38', times }))
    assert.deepEqual([silent.connect_ms, silent.tap_ms], [null, null], 'a unit that did not answer is sent with times')
    const computer = r.gearRecord(r.noteFacts({ via: 'computer', rig: { unit: 'present', deviceName: 'FM3' }, link: { link: 'connected', hostVersion: '1.89.36' }, phone, appVersion: '1.89.38', times }))
    assert.deepEqual([computer.connect_ms, computer.tap_ms], [2400, 140])

    /* The table: two integer columns, each checked, in the insert grant, and still nothing that says whose note it was. */
    const sql = read('supabase/migrations/20261104_gear_reports_usb_and_times.sql')
    const bare = sql.replace(/--.*$/gm, '')
    assert.match(bare, /add column if not exists connect_ms integer check \(connect_ms between 0 and 600000\)/)
    assert.match(bare, /add column if not exists tap_ms integer check \(tap_ms between 0 and 600000\)/)
    assert.match(bare, /grant insert \(connect_ms, tap_ms\) on table public\.gear_reports to anon, authenticated/)
    for (const [field, max] of Object.entries(r.TIMES)) assert.match(bare, new RegExp(`${field} between 0 and ${max}\\)`), `the table and the phone disagree about how long ${field} may be`)
    assert.ok(!/for select|for update|for delete|for all|grant select|grant update|grant delete/i.test(bare), 'somebody can read, change or delete a note through the API')
    assert.ok(!/user_id|account|install|device_id|email|ip_|address/i.test(bare.replace(/comment on table[\s\S]*$/, '')), 'the new columns could say whose note it was')
    assert.match(bare, /comment on table public\.gear_reports is\s+'[^']*USB cable[^']*no account, no install id/)
    /* And What works is handed them. */
    assert.match(read('supabase/functions/gear-reports/index.ts'), /app_version,connect_ms,tap_ms&order=created_at\.desc/, 'the gear server leaves the times out')
  })

  test('What works: the clock starts when the link starts trying, stops at the unit’s first answer, and keeps only the taps after it', async () => {
    const r = await import(RULES)
    let t = 0
    const c = r.createGearClock(() => t)
    let readAt = -1
    const readSince = (since) => readAt >= since
    c.step({ link: 'off', unit: 'unknown', readSince })
    c.step({ link: 'joining', unit: 'unknown', readSince })
    c.tap(50)
    assert.equal(c.tapCount(), 0, 'a tap before the unit answered is counted')
    t = 900
    c.step({ link: 'connected', unit: 'present', readSince })
    assert.deepEqual(c.times(), { connectMs: null, tapMs: null }, 'a unit left over from before, not read on this link, counts as answering')
    t = 2400
    readAt = 2400
    c.step({ link: 'connected', unit: 'present', readSince })
    assert.equal(c.times().connectMs, 2400)
    assert.equal(c.times().tapMs, null, 'a connection with no taps has a tap time')
    for (const ms of [100, 300, 200]) c.tap(ms)
    assert.deepEqual(c.times(), { connectMs: 2400, tapMs: 200 })
    c.tap(250)
    assert.equal(c.times().tapMs, 225)
    for (const bad of [-1, NaN, 'fast', Infinity]) c.tap(bad)
    assert.equal(c.tapCount(), 4)
    /* Later changes on the same answered link move nothing. */
    t = 9000
    readAt = 9000
    c.step({ link: 'connected', unit: 'present', readSince })
    assert.equal(c.times().connectMs, 2400)
    /* Only the newest TAPS_KEPT. */
    for (let i = 0; i < r.TAPS_KEPT + 10; i++) c.tap(1000)
    assert.equal(c.tapCount(), r.TAPS_KEPT)
    assert.equal(c.times().tapMs, 1000)
    /* A drop, then a rejoin: until the unit is read again it is the connection before, and then a new one, timed from the drop, with no taps. */
    t = 10000
    c.step({ link: 'joining', unit: 'present', readSince })
    assert.equal(c.tapCount(), r.TAPS_KEPT, 'a break throws away the taps before it is known to be a new connection')
    assert.equal(c.times().connectMs, 2400)
    t = 10500
    readAt = 10500
    c.step({ link: 'connected', unit: 'present', readSince })
    assert.equal(c.times().connectMs, 500)
    assert.equal(c.tapCount(), 0, 'a rejoin keeps the taps of the connection before it')
    /* The unit unplugged on a connected link is a new start too. */
    t = 11000
    c.step({ link: 'connected', unit: 'missing', readSince })
    t = 14000
    readAt = 14000
    c.step({ link: 'connected', unit: 'present', readSince })
    assert.equal(c.times().connectMs, 3000)
    /*
     * A BREAK THAT HEALS IS THE SAME CONNECTION: a request that timed out
     * (relay.js seen(false), so 'no-answer'), or the channel coming back by
     * itself, with no new read of the unit. Its time and its taps carry on.
     */
    for (const blip of ['no-answer', 'joining']) {
      t = 20000
      readAt = 20000
      const h = r.createGearClock(() => t)
      h.step({ link: 'joining', unit: 'unknown', readSince })
      t = 21200
      readAt = 21200
      h.step({ link: 'connected', unit: 'present', readSince })
      h.tap(90)
      t = 30000
      h.step({ link: blip, unit: 'present', readSince })
      t = 30400
      h.step({ link: 'connected', unit: 'present', readSince })
      for (let i = 0; i < 10; i++) h.tap(110)
      assert.equal(h.tapCount(), 11, `after a ${blip} that healed, taps stop counting`)
      assert.deepEqual(h.times(), { connectMs: 1200, tapMs: 110 }, `a ${blip} that healed is a new connection with no times`)
      /* Another computer (the rig unsettled, readSince false) is waited on, and timed from the break once it is read. */
      let settled = true
      const unsettled = (since) => settled && readAt >= since
      t = 40000
      settled = false
      h.step({ link: 'connected', unit: 'present', readSince: unsettled })
      h.step({ link: 'connected', unit: 'present', readSince: unsettled })
      assert.equal(h.tapCount(), 11)
      t = 41500
      readAt = 41500
      settled = true
      h.step({ link: 'connected', unit: 'present', readSince: unsettled })
      assert.deepEqual(h.times(), { connectMs: 1500, tapMs: null }, 'another computer is the same connection')
    }
    /* Longer than the table holds is no time. */
    const slow = r.createGearClock(() => t)
    t = 0
    readAt = -1
    slow.step({ link: 'joining', unit: 'unknown', readSince })
    t = 600001
    readAt = 600001
    slow.step({ link: 'connected', unit: 'present', readSince })
    assert.equal(slow.times().connectMs, null, 'a wait past ten minutes is sent')
    /* Gone off and back: timed from the moment it left 'off' again. */
    t = 700000
    slow.step({ link: 'off', unit: 'present', readSince })
    t = 700100
    slow.step({ link: 'joining', unit: 'present', readSince })
    t = 701100
    readAt = 701100
    slow.step({ link: 'connected', unit: 'present', readSince })
    assert.equal(slow.times().connectMs, 1000)
  })

  test('What works: a note that answered through a computer waits for a few taps or two minutes, and one that did not, or came over Bluetooth or a cable, is due at once', async () => {
    const r = await import(RULES)
    assert.equal(r.TAPS_FOR_NOTE, 3)
    assert.equal(r.NOTE_AFTER_MS, 2 * 60 * 1000)
    assert.equal(r.RETRY_MS, 5 * 60 * 1000)
    assert.equal(r.noteDue({ outcome: 'not answering', taps: 0, waited: 15000 }), true, 'a unit that did not answer waits for taps it cannot have')
    assert.equal(r.noteDue({ outcome: 'answered', taps: 2, waited: 60000 }), false)
    assert.equal(r.noteDue({ outcome: 'answered', taps: 3, waited: 15000 }), true)
    assert.equal(r.noteDue({ outcome: 'answered', taps: 0, waited: 120000 }), true, 'a connection with no taps never sends its note')
    assert.equal(r.noteDue({ outcome: 'answered', taps: 0, waited: 15000, leaving: true }), true, 'a note is lost when the app leaves the screen')
    for (const via of ['bluetooth', 'usb']) assert.equal(r.noteDue({ outcome: 'answered', via, taps: 0, waited: 15000 }), true, `a note over ${via} waits for tap times it never has`)
    assert.equal(r.noteDue({ outcome: 'answered', via: 'computer', taps: 0, waited: 15000 }), false)
    /* And it goes a while later, at a moment of its own, from 20 s to a minute and a half. */
    assert.deepEqual({ ...r.SEND_AFTER_MS }, { least: 20000, most: 90000 })
    assert.equal(r.sendDelay(() => 0), 20000)
    assert.ok(r.sendDelay(() => 0.999999) < 90000)
    for (const odd of [() => NaN, () => -1, () => 1, () => 'x']) assert.equal(r.sendDelay(odd), 55000)
    for (let i = 0; i < 200; i++) {
      const ms = r.sendDelay()
      assert.ok(ms >= 20000 && ms < 90000 && Number.isInteger(ms), String(ms))
    }
    /* The phone: the clock, the taps, the wait and the screen. */
    const glue = read('mobile/src/lib/gearShare.js')
    const bare = glue.replace(/\/\*[\s\S]*?\*\//g, '')
    assert.match(bare, /onTapTime\(tapped\)/, 'the taps never reach the clock')
    assert.match(bare, /clock\.step\(\{ link: linkState\(\)\.link, unit: rigState\(\)\.unit, readSince: unitReadSince \}\)/)
    assert.match(bare, /subscribeRig\(stepClock\)[\s\S]*subscribeLink\(stepClock\)/, 'the clock is not told the link and the unit')
    assert.ok(bare.indexOf('subscribeRig(stepClock)') < bare.indexOf('subscribeRig(look)'), 'a note is looked at before the clock has heard the change')
    assert.match(bare, /times: clock\.times\(\)/, 'the note never carries the times')
    assert.match(bare, /noteDue\(\{ outcome: record\?\.outcome, via: record\?\.via, taps: clock\.tapCount\(\)/)
    assert.match(bare, /AppState\.addEventListener\('change', \(status\) => \{\s+if \(status === 'background'\) release\(\)/, 'a held note is lost when the app goes to the background')
    assert.match(bare, /if \(held && key === held\.key\) return/, 'a held note is waited on again at every change')
    assert.match(bare, /said\?\.why !== 'not sent'[\s\S]*?RETRY_MS/, 'a note the server did not take is never tried again')
    assert.match(bare, /setTimeout\(\(\) => \{\s+sharer\.report\(facts\)[\s\S]*?\}, sendDelay\(\)\)/, 'a note goes at once, at a fixed distance from a logged line')
    assert.equal(bare.split('sharer.report(').length - 1, 1, 'a note goes some way other than after its random moment')
    /* The stopwatch is beside the player's own taps only, and never a VP4's or the demo's. */
    const device = read('mobile/src/lib/device.js').replace(/\/\*[\s\S]*?\*\//g, '')
    const guard = device.slice(device.indexOf('const timedTap = '), device.indexOf('\n}\n', device.indexOf('const timedTap = ')))
    assert.match(guard, /if \(Number\.isFinite\(opts\?\.deadline\) && !onVp4 && !demoDevice\(\) && !bluetoothWire\(\)\) \{\s+const began = Date\.now\(\)\s+return send\(\)\.then\(\(r\) => \{\s+if \(r\?\.ok !== false\) tapTime\(Date\.now\(\) - began\)/, 'a tap is timed with no deadline, on a VP4, in the demo, over Bluetooth or a cable, or when it was refused')
    assert.equal(device.split('tapTime(').length - 1, 1, 'a tap is timed somewhere other than its guard')
    assert.equal(device.split('timedTap(opts, () =>').length - 1, 4, 'a preset, a scene, an effect or a channel is not timed, or something else is')
    for (const write of ["post('/preset/select', { number }, tapOf(opts))", "post('/scene', { index }, tapOf(opts))", 'post(`/preset/blocks/${eid}/bypass`, { bypassed }, tapOf(opts))', 'post(`/preset/blocks/${eid}/channel`, { channel }, tapOf(opts))']) {
      assert.ok(device.includes(write), `a tap's request changed: ${write}`)
    }
    /* The hand-over: never throws, one listener. */
    const taps = await import('../mobile/src/lib/tapTimes.js')
    const heard = []
    taps.onTapTime((ms) => heard.push(ms))
    taps.tapTime(120)
    taps.onTapTime(() => {
      throw new Error('broken')
    })
    taps.tapTime(130)
    taps.onTapTime(null)
    taps.tapTime(140)
    assert.deepEqual(heard, [120])
    assert.ok(!/^import /m.test(read('mobile/src/lib/tapTimes.js')), 'the tap times take something with them into device.js')
  })

  test('What works: the page says how long things took, the middle of each way’s notes', async () => {
    const r = await import(RULES)
    const now = Date.parse('2026-11-04T12:00:00Z')
    const two = r.gearSections(
      {
        ok: true,
        reports: [
          { created_at: '2026-11-04T10:00:00Z', via: 'bluetooth', unit: 'AM4', adapter: 'WIDI Jack', outcome: 'answered', connect_ms: 2000, tap_ms: 120 },
          { created_at: '2026-11-04T09:00:00Z', via: 'bluetooth', unit: 'AM4', adapter: 'WIDI Jack', outcome: 'answered', connect_ms: 2800, tap_ms: 160 },
          { created_at: '2026-11-04T08:00:00Z', via: 'bluetooth', unit: 'AM4', adapter: 'WIDI Jack', outcome: 'not answering', connect_ms: null, tap_ms: null }
        ]
      },
      now
    )
    assert.equal(two[0].rows[0].value, '2 worked · 1 didn’t answer\nnewest today\nconnects in about 2.4 s · a tap about 140 ms')
    const one = r.gearSections({ ok: true, reports: [{ created_at: '2026-11-04T10:00:00Z', via: 'computer', unit: 'FM3', computer_os: 'macOS 27.0', outcome: 'answered', connect_ms: 1500, tap_ms: null }] }, now)
    assert.equal(one[0].rows[0].value, '1 worked · 0 didn’t answer\nnewest today\nconnects in about 1.5 s')
    const tap = r.gearSections({ ok: true, reports: [{ created_at: '2026-11-04T10:00:00Z', via: 'computer', unit: 'FM3', computer_os: 'macOS 27.0', outcome: 'answered', tap_ms: 88 }] }, now)
    assert.equal(tap[0].rows[0].value, '1 worked · 0 didn’t answer\nnewest today\na tap about 88 ms')
  })

  /*
   * A VP4 OVER BLUETOOTH OR A CABLE CANNOT BE HEARD (lib/bleVp4 sendOnly):
   * its wire says connected for an adapter plugged into nothing, so a note
   * would say "answered" about any VP4, or none.
   */
  test('What works: a VP4 over Bluetooth or a cable sends no note, and through a computer it still does', async () => {
    const r = await import(RULES)
    const phone = { os: 'ios', osVersion: '27.2', model: 'iPhone' }
    const vp4 = { unit: 'present', deviceName: 'VP4', capabilities: { via: 'bluetooth', sendOnly: true } }
    for (const via of ['bluetooth', 'usb']) {
      assert.equal(r.noteFacts({ via, rig: vp4, bluetooth: { phase: 'connected', unit: 'VP4', adapter: 'WIDI Jack' }, phone, appVersion: '1.89.38' }), null, `a VP4 over ${via} says it answered`)
      assert.equal(r.noteFacts({ via, rig: { unit: 'missing' }, bluetooth: { phase: 'connected', unit: 'VP4', adapter: 'WIDI Jack' }, phone, appVersion: '1.89.38' }), null, `a closed VP4 wire over ${via} says the VP4 did not answer`)
      assert.equal(r.noteFacts({ via, rig: { unit: 'present', deviceName: 'AM4', capabilities: { sendOnly: true } }, bluetooth: { phase: 'connected', unit: 'AM4', adapter: 'WIDI Jack' }, phone, appVersion: '1.89.38' }), null)
    }
    const computer = r.gearRecord(r.noteFacts({ via: 'computer', rig: { unit: 'present', deviceName: 'VP4' }, link: { link: 'connected', hostVersion: '1.89.36' }, phone, appVersion: '1.89.38' }))
    assert.deepEqual([computer.unit, computer.via, computer.outcome], ['VP4', 'computer', 'answered'], 'a VP4 through a computer, which hears it, sends no note')
    /* Every other unit over Bluetooth is a note as before. */
    assert.ok(r.noteFacts({ via: 'bluetooth', rig: { unit: 'present', deviceName: 'FM3', capabilities: { via: 'bluetooth' } }, bluetooth: { phase: 'connected', unit: 'FM3', adapter: 'WIDI Uhost' }, phone, appVersion: '1.89.38' }))
  })

  /*
   * NOT LINKED TO YOU, IN THE LOG TOO, as far as the phone can see to it: the
   * log stamps each line to the millisecond, and a bug report sends it with
   * the email address ticked. No line names a note or marks the moment one
   * went; the note goes at a random moment of its own (sendDelay), and its
   * times are rounded (TIME_STEPS). The table's own stamp of when a note
   * came in is the server's, and is Justin's to make coarser.
   */
  test('What works: no line in the log names a note or marks when one went', async () => {
    const r = await import(RULES)
    const lines = []
    const db = database()
    const s = r.createGearSharer({ storage: memory({ start: { [r.SHARE_KEY]: 'yes' } }), insert: db.insert, log: (...said) => lines.push(said.join(' ')) })
    assert.equal((await s.report(AM4_BLUETOOTH)).sent, true)
    assert.equal(db.rows.length, 1)
    assert.deepEqual(lines, [], 'a note that went is in the log')
    assert.ok(!/a gear note went/.test(read('mobile/src/lib/gear-share-rules.js')), 'the log line for a note that went is back')
    /* A refusal still is, with nothing of the gear in it. */
    const refused = r.createGearSharer({ storage: memory({ start: { [r.SHARE_KEY]: 'yes' } }), insert: async () => ({ error: { message: 'no table' } }), log: (...said) => lines.push(said.join(' ')) })
    await refused.report(AM4_BLUETOOTH)
    assert.deepEqual(lines, ['a gear note did not go no table'])
    assert.ok(!lines.some((l) => /AM4|WIDI|bluetooth/i.test(l)))
  })

  test('What works: an owner’s name is taken off the adapter’s or the cable’s name, and a factory name is left alone', async () => {
    const r = await import(RULES)
    const named = (adapter) => r.gearRecord({ ...AM4_BLUETOOTH, adapter }).adapter
    assert.equal(named('Justin’s WIDI Jack'), 'WIDI Jack')
    assert.equal(named("Maria's iPad"), 'iPad')
    assert.equal(named('Mary Jane’s WIDI Master'), 'WIDI Master')
    assert.equal(named('MacBook Pro de Justin'), 'MacBook Pro')
    assert.equal(named('iPhone di Marco'), 'iPhone')
    for (const factory of ['WIDI Uhost Bluetooth', 'C2MIDI Pro', 'AM4', 'Quad Cortex Bluetooth', 'WIDI Jack', 'CME U2MIDI Pro', 'Rețea Session 1', 'Mac']) {
      assert.equal(named(factory), factory, `${factory} is changed`)
    }
    /* A phone's, tablet's or computer's own name, wherever the owner's was put, says only what it is. */
    for (const [given, said] of [
      ['Justins iPad', 'iPad'],
      ['Justin的iPad', 'iPad'],
      ['JustinのMacBook Pro', 'MacBook Pro'],
      ['Mary Ann Smith’s iPad', 'iPad'],
      ['Galaxy Tab S9 de Maria', 'Galaxy'],
      ['Pixel 8 di Marco', 'Pixel'],
      ['iPad (2)', 'iPad'],
      ['Studio Mac mini', 'Mac mini'],
      ['Justin’s MacBook Air', 'MacBook Air']
    ]) {
      assert.equal(named(given), said, `${given} keeps somebody’s name`)
    }
    /* A possessive of up to three words, and a name that is nothing but one, is no name. */
    assert.equal(named('Mary Ann Smith’s WIDI Master'), 'WIDI Master')
    assert.equal(named("James' WIDI Jack"), 'WIDI Jack')
    assert.equal(r.ownerless('Justin’s '), null, 'an adapter named only for its owner sends the owner’s name')
    assert.equal(r.ownerless("Mary Jane's"), null)
    assert.equal(r.ownerless('   '), null)
    assert.equal(r.ownerless(null), null)
    /* On a cable's note too. */
    assert.equal(r.gearRecord({ ...AM4_BLUETOOTH, via: 'usb', adapter: "Justin's C2MIDI Pro" }).adapter, 'C2MIDI Pro')
  })

  test('What works: the 30 days hold even when storage will not keep the list', async () => {
    const r = await import(RULES)
    const db = database()
    const storage = memory({ start: { [r.SHARE_KEY]: 'yes' } })
    const full = {
      getItem: (k) => storage.getItem(k),
      async setItem(k, v) {
        if (k === r.SENT_KEY) throw new Error('the disk is full')
        return storage.setItem(k, v)
      }
    }
    const s = r.createGearSharer({ storage: full, insert: db.insert })
    assert.equal((await s.report(FM3_COMPUTER)).sent, true)
    assert.equal((await s.report(FM3_COMPUTER)).why, 'sent already', 'a full disk sends the same gear at every report')
    assert.equal(db.rows.length, 1)
  })

  test('What works: a send that hangs is cut off, and the next note still goes', async () => {
    const r = await import(RULES)
    const glue = read('mobile/src/lib/gearShare.js')
    assert.match(glue, /import \{ notForever \} from '\.\/notForever'/)
    assert.match(glue, /global: \{ fetch: notForever \}/, 'the gear notes go on a fetch with no limit, so one that hangs holds every note after it')
    assert.match(glue, /persistSession: false, autoRefreshToken: false, detectSessionInUrl: false/)
    /* Cut off, it is a note not sent, and the one after it runs. */
    const db = database()
    let first = true
    const insert = async (row) => {
      if (first) {
        first = false
        throw new Error('The account service timed out.')
      }
      return db.insert(row)
    }
    const lines = []
    const s = r.createGearSharer({ storage: memory({ start: { [r.SHARE_KEY]: 'yes' } }), insert, log: (...said) => lines.push(said.join(' ')) })
    /*
     * Cut off, it may have landed all the same: counted as sent, so the same
     * gear is never in the table twice, and with nothing in the log.
     */
    assert.equal((await s.report(FM3_COMPUTER)).why, 'cut off')
    assert.equal((await s.report(AM4_BLUETOOTH)).sent, true, 'a note cut off holds the next one')
    assert.equal((await s.report(FM3_COMPUTER)).why, 'sent already', 'a note cut off, which may have landed, is sent again')
    assert.equal(db.rows.length, 1)
    assert.deepEqual(lines, [], 'a note cut off, which may have landed, is in the log')
    /* As supabase-js says it: the fetch error inside { error }. */
    const wrapped = r.createGearSharer({ storage: memory({ start: { [r.SHARE_KEY]: 'yes' } }), insert: async () => ({ error: { message: 'Error: The account service timed out.' }, status: 0 }) })
    assert.equal((await wrapped.report(FM3_COMPUTER)).why, 'cut off')
    assert.equal((await wrapped.report(FM3_COMPUTER)).why, 'sent already')
  })

  test('What works: a note through a computer waits until the computer has said its version', async () => {
    const r = await import(RULES)
    const phone = { os: 'ios', osVersion: '27.2', model: 'iPhone' }
    const computer = (link) => r.noteFacts({ rig: { unit: 'present', deviceName: 'FM3', firmware: '10.01' }, via: 'computer', link, phone, appVersion: '1.89.38' })
    assert.equal(computer({ link: 'connected', hostVersion: null }), null, 'a note goes before the computer has said what it is')
    assert.equal(computer({ link: 'connected' }), null)
    const note = r.gearRecord(computer({ link: 'connected', hostVersion: '1.89.36', hostOs: 'macOS 27.0 (Apple silicon)' }))
    assert.deepEqual([note.computer_version, note.computer_os], ['1.89.36', 'macOS 27.0 (Apple silicon)'])
  })

  test('What works: the 29 October mix-up from before 1.89.8 is not shown as an AM4 that did not answer', async () => {
    const r = await import(RULES)
    const now = Date.parse('2026-11-04T12:00:00Z')
    const mixup = { created_at: '2026-10-29T10:00:00Z', via: 'bluetooth', unit: 'AM4', adapter: 'WIDI Uhost Bluetooth', outcome: 'not answering', app_version: '1.89.7' }
    const worked = { created_at: '2026-11-01T10:00:00Z', via: 'bluetooth', unit: 'AM4', adapter: 'WIDI Uhost Bluetooth', outcome: 'answered', app_version: '1.89.20' }
    assert.match(r.gearSections({ ok: true, reports: [worked, mixup] }, now)[0].rows[0].value, /^1 worked · 0 didn’t answer\n/, 'a note from before 1.89.8 says the AM4 did not answer through the WIDI Uhost')
    /* From 1.89.8 on it is a real result, and counts. */
    assert.match(r.gearSections({ ok: true, reports: [worked, { ...mixup, app_version: '1.89.8' }] }, now)[0].rows[0].value, /^1 worked · 1 didn’t answer\n/)
    assert.match(r.gearSections({ ok: true, reports: [worked, { ...mixup, app_version: '1.89.10' }] }, now)[0].rows[0].value, /^1 worked · 1 didn’t answer\n/)
    /* A computer's, or one that answered, from before is left as it was. */
    assert.match(r.gearSections({ ok: true, reports: [{ ...worked, app_version: '1.89.7' }] }, now)[0].rows[0].value, /^1 worked · 0 didn’t answer\n/)
  })

  /*
   * A HELD NOTE IS NEVER LOST (4 November 2026). A unit that answered
   * through a computer waits for a few taps or two minutes, for its tap
   * time; gear that changes or goes before then sends it as it was. Quick
   * adapter-by-adapter checks are how the real notes have come in.
   */
  test('What works, run: a held note goes as it was when the gear changes, the unit goes, or the link goes off', async () => {
    const changes = {
      'another computer': async (b) => b.link.set({ hostOs: 'Windows 11 24H2' }),
      'the unit unplugged': async (b) => b.rig.set({ unit: 'missing' }, { read: true }),
      'the link off': async (b) => b.link.set({ link: 'off' }),
      'the app in the background': async (b) => b.appGoes('background')
    }
    for (const [what, change] of Object.entries(changes)) {
      const b = await gearShareOnABench()
      try {
        await b.computer()
        await b.sec(45)
        assert.equal(b.db.tries.length, 0, 'a note through a computer went before its taps or its two minutes')
        b.tap(123)
        await b.sec(5)
        const changedAt = b.clock.now()
        await change(b)
        await b.sec(95)
        const first = b.rows()[0]
        assert.ok(first, `the note that answered is lost when ${what}`)
        assert.ok(b.db.rows[0].at - changedAt >= 20000, `${what}: the note went at once`)
        assert.deepEqual([first.unit, first.via, first.outcome, first.computer_os, first.connect_ms, first.tap_ms], ['FM3', 'computer', 'answered', 'macOS 27.0 (Apple silicon)', 800, 120], `${what}: the note went with other times or other gear`)
        await b.sec(200)
        const rows = b.rows()
        if (what === 'another computer') assert.deepEqual(rows.map((r) => r.computer_os), ['macOS 27.0 (Apple silicon)', 'Windows 11 24H2'])
        else assert.equal(rows.length, 1, `${what}: ${JSON.stringify(rows)}`)
        assert.ok(!rows.some((r) => r.outcome === 'not answering'), 'a computer with no unit is sent as a note')
      } finally {
        b.done()
      }
    }
    /* Control Center pulled down or the app switcher ('inactive') is not leaving: the note keeps waiting for its taps. */
    const b = await gearShareOnABench()
    try {
      await b.computer()
      await b.sec(30)
      b.appGoes('inactive')
      await b.sec(5)
      for (const ms of [100, 100, 100]) b.tap(ms)
      await b.sec(95)
      assert.deepEqual(b.rows().map((r) => r.tap_ms), [100], 'the app switcher sent the held note without its taps')
    } finally {
      b.done()
    }
  })

  test('What works, run: over Bluetooth a switch of adapter, or a unit that stops answering, keeps both notes, with no tap time', async () => {
    for (const then of ['WIDI Master', 'not answering', 'Bluetooth off']) {
      const b = await gearShareOnABench()
      try {
        await b.bluetooth()
        b.tap(40)
        await b.sec(45)
        if (then === 'WIDI Master') b.bt.set({ saved: { unit: 'am4', adapter: { id: 'm', name: 'WIDI Master' } } })
        else if (then === 'not answering') b.rig.set({ unit: 'missing' }, { read: true })
        else {
          b.bt.set({ phase: 'off' })
          b.link.set({ link: 'off' }, 'computer')
        }
        await b.sec(300)
        const said = b.rows().map((r) => `${r.unit} · ${r.adapter} · ${r.outcome} · ${r.connect_ms} · ${r.tap_ms}`)
        const want = {
          'WIDI Master': ['AM4 · WIDI Jack · answered · 1200 · null', 'AM4 · WIDI Master · answered · 1200 · null'],
          'not answering': ['AM4 · WIDI Jack · answered · 1200 · null', 'AM4 · WIDI Jack · not answering · null · null'],
          'Bluetooth off': ['AM4 · WIDI Jack · answered · 1200 · null']
        }[then]
        assert.deepEqual(said, want, `then ${then}`)
        assert.ok(b.rows().every((r) => r.via === 'bluetooth'))
      } finally {
        b.done()
      }
    }
    /* A cable is 'usb', with the cable's name. */
    const c = await gearShareOnABench()
    try {
      await c.bluetooth({ adapter: 'AM4', cable: true })
      await c.sec(200)
      assert.deepEqual(c.rows().map((r) => [r.via, r.adapter, r.outcome, r.tap_ms]), [['usb', 'AM4', 'answered', null]])
    } finally {
      c.done()
    }
  })

  test('What works, run: a note goes at a random moment a while after it is due, never inside a tap', async () => {
    for (const [random, lands] of [
      [0, 20],
      [0.5, 55],
      [0.99, 90]
    ]) {
      const b = await gearShareOnABench()
      try {
        b.clock.bench.random = random
        await b.computer()
        await b.sec(16)
        for (const ms of [100, 300]) b.tap(ms)
        await b.sec(4)
        b.tap(200)
        await b.clock.advance(0)
        assert.equal(b.db.tries.length, 0, 'the third tap sent the note inside the tap')
        await b.sec(lands - 1)
        assert.equal(b.db.tries.length, 0, `with ${random} it went before its moment`)
        await b.sec(1)
        assert.equal(b.db.tries.length, 1, `with ${random} it did not go at its moment`)
        assert.equal(b.rows()[0].tap_ms, 200)
        assert.deepEqual(b.lines.filter((l) => /gear/.test(l)), [], 'the note that went is in the log')
      } finally {
        b.done()
      }
    }
  })

  test('What works, run: a note the server refuses is tried again no sooner than five minutes on, however often the gear settles', async () => {
    const b = await gearShareOnABench()
    try {
      b.db.refuse = true
      await b.bluetooth()
      for (let i = 0; i < 30; i++) {
        b.rig.set({ preset: i })
        await b.sec(20)
      }
      const tries = b.db.tries.map((x) => x.at)
      assert.ok(tries.length >= 2 && tries.length <= 3, `${tries.length} tries in ten minutes`)
      for (let i = 1; i < tries.length; i++) assert.ok(tries[i] - tries[i - 1] >= 5 * 60 * 1000, 'tried again inside five minutes')
      assert.equal(b.rows().length, 0)
      /* And the server back: it goes once, and only once. */
      b.db.refuse = false
      for (let i = 0; i < 20; i++) {
        b.rig.set({ preset: 100 + i })
        await b.sec(30)
      }
      assert.equal(b.rows().length, 1)
    } finally {
      b.done()
    }
  })

  /*
   * A YES TO LESS (4 November 2026): somebody who said Yes before the card
   * named a USB cable and the two times said it to fewer things. The card
   * comes back once, and until it is answered the phone sends what the words
   * then promised.
   */
  test('What works, run: a Yes given to the words before sends no times and no cable, and the card is owed again', async () => {
    const r = await import(RULES)
    assert.equal(r.SHARE_KEY, 'fractal.gearShare.v2')
    assert.equal(r.SHARE_KEY_BEFORE, 'fractal.gearShare.v1')
    for (const [start, owed, on] of [
      [{}, 'first', false],
      [{ 'fractal.gearShare.v1': 'yes' }, 'again', true],
      [{ 'fractal.gearShare.v1': 'no' }, false, false],
      [{ 'fractal.gearShare.v1': 'yes', 'fractal.gearShare.v2': 'no' }, false, false],
      [{ 'fractal.gearShare.v1': 'no', 'fractal.gearShare.v2': 'yes' }, false, true],
      [{ 'fractal.gearShare.v2': 'yes' }, false, true]
    ]) {
      const s = r.createGearSharer({ storage: memory({ start }), insert: async () => ({}) })
      assert.equal(await s.owed(), owed, JSON.stringify(start))
      assert.equal(r.sharing(await s.answer()), on, JSON.stringify(start))
    }
    const b = await gearShareOnABench({ stored: { 'fractal.gearShare.v1': 'yes' } })
    try {
      assert.equal(await b.glue.shareQuestionDue(), 'again')
      await b.computer()
      await b.sec(20)
      for (const ms of [100, 100, 100]) b.tap(ms)
      await b.sec(100)
      assert.deepEqual(b.rows().map((x) => [x.unit, x.connect_ms, x.tap_ms]), [['FM3', null, null]], 'a Yes to the words before sends the times')
      b.link.set({ link: 'off' })
      await b.bluetooth({ adapter: 'C2MIDI Pro', cable: true })
      await b.sec(200)
      assert.equal(b.rows().length, 1, 'a Yes to the words before sends a cable')
      /* Yes on the card shown again: everything, from then on. */
      await b.glue.setSharing(true)
      assert.equal(await b.glue.shareQuestionDue(), false)
      assert.equal(b.kept['fractal.gearShare.v2'], 'yes')
      await b.sec(200)
      b.rig.set({ preset: 1 })
      await b.sec(200)
      assert.deepEqual(b.rows().slice(1).map((x) => [x.via, x.adapter, x.connect_ms]), [['usb', 'C2MIDI Pro', 1200]])
    } finally {
      b.done()
    }
  })
}
