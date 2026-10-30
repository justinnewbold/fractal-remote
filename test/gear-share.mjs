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
import { readFileSync } from 'node:fs'

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
    /* The phone asks the card only when there is no answer, and reads it as off meanwhile. */
    const glue = read('mobile/src/lib/gearShare.js')
    assert.match(glue, /return \(await sharer\.answer\(\)\) === null/, 'the card is owed on some other condition than never answered')
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
    assert.equal((await s.report(FM3_COMPUTER)).sent, true)
    await s.setAnswer(false)
    assert.equal(storage.kept[r.SHARE_KEY], 'no')
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
    /* A note the database refused is not marked sent, so it goes next time. */
    const refusing = r.createGearSharer({ storage: memory({ start: { [r.SHARE_KEY]: 'yes' } }), insert: async () => ({ error: { message: 'no table' } }) })
    assert.equal((await refusing.report(FM3_COMPUTER)).why, 'not sent')
    assert.equal((await refusing.report(FM3_COMPUTER)).why, 'not sent', 'a refused note was counted as sent')
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
    const allowed = ['via', 'unit', 'firmware', 'adapter', 'outcome', 'computer_os', 'computer_version', 'phone_os', 'phone_os_version', 'phone_model', 'app_version']
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
    for (const want of ['which unit and its firmware', 'computer or Bluetooth', 'computer app’s version', 'Bluetooth adapter’s name', 'whether the unit answered', 'system version', 'app’s version', 'once a month at most']) {
      assert.ok(what.includes(want), `the card does not say it sends ${want}`)
    }
    for (const want of ['preset or song names', 'anything you type', 'where you are', 'your account or email', 'not linked to you', 'no advertising', 'nothing goes to anyone else']) {
      assert.ok(never.includes(want), `the card does not say ${want}`)
    }
    assert.match(change, /off unless you tap Yes, share/)
    assert.match(change, /Settings → Troubleshooting/)
    /* The device in hand by its name, read when drawn. */
    words.setDevice('ipad')
    try {
      assert.match(r.shareWords()[0], /this iPad sends/)
    } finally {
      words.setDevice('phone')
    }
    for (const text of [...r.shareWords(), r.shareRowLine(true), r.shareRowLine(false)]) {
      assert.ok(!/beta|Fractal Audio|official|endorsed/i.test(text), `the gear words say something they must not: ${text}`)
    }
    /* "this phone" is never typed: the device is named by deviceNoun() when the words are read. */
    assert.ok(!/this phone/.test(read('mobile/src/lib/gear-share-rules.js').replace(/\/\*[\s\S]*?\*\//g, '')), 'the gear words type "this phone"')
    /* The card draws those words and those two buttons. */
    const card = read('mobile/src/components/GearShareNotice.js')
    assert.match(card, /const \[what, never, change\] = shareWords\(\)/)
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
    const developer = settings.slice(settings.indexOf("{page === 'developer' && isAdmin(account?.id) ? ("), settings.indexOf('{/* ------------------------------------------------------ appearance */}'))
    assert.match(developer, /title="App health"[^\n]*setPage\('health'\)/, 'the row is not on the Developer page')
    assert.match(settings, /\{ key: 'works', label: 'What works' \}/, 'App health has no What works button')
    assert.match(settings, /health: 'developer'/, 'Back from App health does not go to Developer')

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
    assert.deepEqual(sections[0].rows.map((x) => x.label), ['Bluetooth · WIDI Uhost', 'Computer'])
    assert.match(sections[0].rows[0].value, /^1 worked · 1 didn’t answer\nnewest today · iOS, Android$/)
    assert.match(sections[1].rows[0].value, /^1 worked · 0 didn’t answer\nnewest 2 days ago · firmware 10\.01$/)
    assert.equal(sections[1].rows[0].label, 'Computer · macOS')
    assert.match(r.gearSections({ ok: true, reports: [] })[0].rows[0].value, /Nothing has come in yet/)
    assert.deepEqual(r.gearSections({ ok: false }), [])
  })

  test('The privacy page and the store notes say what the gear notes are', async () => {
    const page = read('public/privacy.html').replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, '’').replace(/&ldquo;|&rdquo;/g, '"').replace(/&rarr;/g, '→').replace(/\s+/g, ' ')
    for (const want of ['Which gear works — only if you say yes', 'It is off unless you tap Yes, share', 'Settings → Troubleshooting → Share what gear works', 'It is not linked to you.', 'at most once every 30 days', 'two years from when each was sent']) {
      assert.ok(page.includes(want), `the privacy page does not say: ${want}`)
    }
    const store = read('docs/app-store.md')
    const part = store.slice(store.indexOf('### What works: the gear notes'), store.indexOf('## Age rating'))
    assert.match(part, /Diagnostics → Other\s+Diagnostic\s+Data/)
    assert.match(part, /Device or other IDs:\s+no change/)
  })
}
