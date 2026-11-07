/**
 * THE SEVEN-DAY FREE TRIAL (7 November 2026).
 *
 * "Okay, let's get the seven-day trial built out." One per account, ever, and
 * one per device; seven days of everything the full version gives on that
 * copy; day 8 back to the purchase page with everything kept; buying ends it.
 * The ways it can be quietly wrong, each held here:
 *
 *   - the length counted two ways (the phone's seven days, the server's eight)
 *   - a trial that never ends offline, or ends later after the clock is moved
 *   - a trial that overwrites, shortens or outlives a purchase, or a purchase
 *     that does not win over it
 *   - a second trial for an account, or a fresh one for a device on a new
 *     account, or the install number kept as it was sent
 *   - an iPhone trial started without the App Store's free item (Apple's
 *     3.1.1), or a button shown before that item exists
 *   - a trial opening anything a store version keeps closed (Bluetooth for
 *     customers, Editing over Bluetooth): it stands in for the purchase only
 *   - the free item sold as the unlock by first-wins, or counted as a sale
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  DAY_MS,
  TRIAL_DAYS,
  TRIAL_MS,
  TRIAL_PRODUCT_ID,
  deviceIdOk,
  keptTrial,
  trialAnswer,
  trialClock,
  trialDaysLeft,
  trialEndsFrom,
  trialLive,
  trialOffered,
  trialStart
} from '../shared/trial-rule.mjs'
import {
  DEMO_NUDGE_AFTER_MS,
  DEMO_TRIAL_NUDGE,
  DEMO_TRIAL_PILL,
  TRIAL_BUTTON,
  trialAccountWord,
  trialLine,
  trialRefusal,
  trialTerms
} from '../shared/trial-words.mjs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const sqlOf = (p) => read(p).replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim()
const flat = (p) => code(read(p)).replace(/\s+/g, ' ')

/* 10:00 on 7 November 2026, in this process's own time zone. */
const START = new Date(2026, 10, 7, 10, 0, 0).getTime()
const ENDS = trialEndsFrom(START)

/*
 * THE TRIAL FUNCTION, RUN: supabase/functions/trial loaded as it is, with
 * Deno stood in for and a fetch that answers as Supabase and RevenueCat
 * would. `rows` is the database's start_trial: (args) => its answer.
 */
const PROJECT = 'https://project.test'
const RC = 'https://api.revenuecat.com/v2/projects/proj827190e9'
const ENV = { SUPABASE_URL: PROJECT, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', REVENUECAT_SECRET: 'rc', TRIAL_DEVICE_SALT: 'salt' }
const ACCOUNT = '11111111-2222-4333-8444-555555555555'
let runs = 0

async function trialFn({ token = 'good', body, start = () => ({ ok: true }), purchases = [], products = [] } = {}) {
  const calls = []
  const was = { fetch: globalThis.fetch, Deno: globalThis.Deno, log: console.log, error: console.error }
  const answer = (status, value) => new Response(value === undefined ? '' : JSON.stringify(value), { status })
  let handler = null
  globalThis.Deno = { serve: (h) => (handler = h), env: { get: (n) => ENV[n] } }
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), body: init.body ? JSON.parse(init.body) : null }
    calls.push(call)
    if (call.url === `${PROJECT}/auth/v1/user`) {
      return init.headers.Authorization === 'Bearer good' ? answer(200, { id: ACCOUNT, email: 'a@b.c' }) : answer(401, {})
    }
    if (call.url === `${PROJECT}/rest/v1/rpc/start_trial`) return answer(200, start(call.body))
    if (call.url.startsWith(`${RC}/customers/`) && call.url.includes('/purchases')) return answer(200, { items: purchases })
    if (call.url.startsWith(`${RC}/products`)) return answer(200, { items: products })
    return answer(500, { msg: `nothing answers ${call.url}` })
  }
  console.log = () => {}
  console.error = () => {}
  try {
    await import(`${new URL('../supabase/functions/trial/index.ts', import.meta.url).href}?run=${++runs}`)
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    const res = await handler(new Request('https://functions.test/trial', { method: 'POST', headers, body: JSON.stringify(body) }))
    return { status: res.status, said: await res.json(), calls, started: calls.filter((c) => c.url.endsWith('/rpc/start_trial')).map((c) => c.body) }
  } finally {
    globalThis.fetch = was.fetch
    globalThis.Deno = was.Deno
    console.log = was.log
    console.error = was.error
  }
}

/* THE ENTITLEMENT FUNCTION, RUN, for what it says beside the purchase. */
async function entitlementFn({ owns = false, trial = null, trialFails = false } = {}) {
  const was = { fetch: globalThis.fetch, Deno: globalThis.Deno, log: console.log, error: console.error }
  const answer = (status, value) => new Response(value === undefined ? '' : JSON.stringify(value), { status })
  let handler = null
  const written = []
  globalThis.Deno = { serve: (h) => (handler = h), env: { get: (n) => ENV[n] } }
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url)
    const body = init.body ? JSON.parse(init.body) : null
    if (u === `${PROJECT}/auth/v1/user`) return answer(200, { id: ACCOUNT, email: 'a@b.c' })
    if (u.endsWith('/active_entitlements')) return answer(200, { items: owns ? [{ entitlement_id: 'full' }] : [] })
    if (u === `${RC}/entitlements`) return answer(200, { items: [] })
    if (u.endsWith('/rpc/record_entitlement')) {
      written.push(body)
      return answer(204)
    }
    if (u.endsWith('/rpc/is_waiting_grant')) return answer(200, false)
    if (u.endsWith('/rpc/trial_of')) return trialFails ? answer(404, { message: 'no such function' }) : answer(200, trial)
    return answer(500, {})
  }
  console.log = () => {}
  console.error = () => {}
  try {
    await import(`${new URL('../supabase/functions/entitlement/index.ts', import.meta.url).href}?run=${++runs}`)
    const res = await handler(new Request('https://functions.test/entitlement', { method: 'POST', headers: { Authorization: 'Bearer t' }, body: '{}' }))
    return { said: await res.json(), written }
  } finally {
    globalThis.fetch = was.fetch
    globalThis.Deno = was.Deno
    console.log = was.log
    console.error = was.error
  }
}

/*
 * lib/purchases ON A BENCH, for the trial's half of it: the real file with
 * React Native, the phone's storage, the account service, the relay pass and
 * RevenueCat's SDK stood in for.
 */
async function phone({ os = 'ios', storeTrial = true, session = ACCOUNT } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'trial-'))
  const real = (f) => new URL(`../mobile/src/lib/${f}`, import.meta.url).href
  let lib = read('mobile/src/lib/purchases.js')
  for (const [from, to] of [
    ["from 'react'", "from './react.js'"],
    ["from 'react-native'", "from './react-native.js'"],
    ["from 'expo'", "from './expo.js'"],
    ["from '@react-native-async-storage/async-storage'", "from './storage.js'"],
    ["from 'expo-constants'", "from './constants.js'"],
    ["from './debugLog'", "from './debugLog.js'"],
    ["from './unlock-rule'", `from '${real('unlock-rule.js')}'`],
    ["from './owner-unlock'", `from '${real('owner-unlock.js')}'`],
    ["from './device-word'", `from '${real('device-word.js')}'`],
    ["from './trial-rule'", `from '${real('trial-rule.js')}'`],
    ["from './relay'", "from './relay.js'"],
    ["from './demo'", "from './demo.js'"],
    ["from './relayPass'", "from './relayPass.js'"],
    ["import('react-native-purchases')", "import('./rnp.js')"]
  ]) {
    assert.ok(lib.includes(from), `lib/purchases no longer has ${from}: the bench needs telling`)
    lib = lib.replace(from, to)
  }
  const product = { identifier: TRIAL_PRODUCT_ID, priceString: '$0.00' }
  const files = {
    'package.json': '{ "type": "module" }',
    'purchases.js': lib,
    'react.js': 'export const useSyncExternalStore = (s, read) => read()\n',
    'react-native.js': `export const Platform = { OS: ${JSON.stringify(os)}, select: (o) => (${JSON.stringify(os)} in o ? o[${JSON.stringify(os)}] : o.default) }\n`,
    'expo.js': "export const requireOptionalNativeModule = (n) => (n === 'EASClient' ? { clientID: 'install-number-1234' } : null)\n",
    'storage.js': 'export const disk = new Map()\nexport default { getItem: async (k) => (disk.has(k) ? disk.get(k) : null), setItem: async (k, v) => { disk.set(k, String(v)) }, removeItem: async (k) => { disk.delete(k) } }\n',
    'constants.js': "export default { expoConfig: { extra: { revenuecat: { ios: 'appl_bench', android: 'goog_bench' } } } }\n",
    'debugLog.js': 'export const logDebug = () => {}\n',
    'relay.js': `export const who = { session: ${JSON.stringify(session)} }\nexport const signedInOnPhone = async () => who.session\nexport const currentAccount = async () => (who.session ? { id: who.session, email: 'p@e.c' } : null)\n`,
    'demo.js': 'export const demo = { on: false }\nexport const isDemo = () => demo.on\nexport const setDemo = (on) => { demo.on = Boolean(on) }\n',
    'relayPass.js':
      'export const pass = { asks: [], answer: { ok: false, why: \'offline\', trial: null }, heard: null }\n' +
      'export const claimRelay = async () => false\n' +
      'export const hearTrial = (fn) => { pass.heard = fn }\n' +
      `export const askForTrial = async (a) => { pass.asks.push(a); const out = pass.answer; if (out.trial) await pass.heard?.(${JSON.stringify(session)}, out.trial); return out }\n`,
    'rnp.js': 'export const holder = { api: null }\nexport default new Proxy({}, { get: (_, k) => holder.api?.[k] })\n'
  }
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  const holder = (await import(at('rnp.js'))).holder
  const bought = []
  let info = { entitlements: { active: {} }, nonSubscriptionTransactions: [], allPurchasedProductIdentifiers: [] }
  holder.api = {
    PRODUCT_CATEGORY: { NON_SUBSCRIPTION: 'NON_SUBSCRIPTION' },
    configure: () => {},
    getAppUserID: async () => session,
    isAnonymous: async () => false,
    logIn: async () => ({ customerInfo: info }),
    getCustomerInfo: async () => info,
    invalidateCustomerInfoCache: async () => {},
    canMakePayments: async () => true,
    getOfferings: async () => ({
      current: { availablePackages: [{ product: { identifier: 'cloud.newbold.fractalremote.full', priceString: '$9.99' } }] },
      all: {}
    }),
    getProducts: async (ids) => (storeTrial && ids.includes(TRIAL_PRODUCT_ID) ? [product] : []),
    purchaseStoreProduct: async (p) => {
      bought.push(p.identifier)
      info = { ...info, nonSubscriptionTransactions: [{ productIdentifier: p.identifier }] }
      return { customerInfo: info }
    },
    addCustomerInfoUpdateListener: () => {}
  }
  const p = await import(at('purchases.js'))
  return {
    p,
    bought,
    pass: (await import(at('relayPass.js'))).pass,
    disk: (await import(at('storage.js'))).disk,
    done: () => rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  test('trial: seven days, said once, and the phone, the server and the words all count from it', () => {
    assert.equal(TRIAL_DAYS, 7)
    assert.equal(TRIAL_MS, 7 * DAY_MS)
    assert.equal(ENDS - START, 7 * DAY_MS)
    /* The phone's and the server's copies are the source, character for character (sync:rules also holds this). */
    const source = read('shared/trial-rule.mjs')
    assert.ok(read('mobile/src/lib/trial-rule.js').endsWith(source), 'the phone counts the trial by another rule')
    assert.ok(read('supabase/functions/_shared/trial-rule.mjs').endsWith(source), 'the server counts the trial by another rule')
    assert.match(code(read('supabase/functions/trial/index.ts')), /from '\.\.\/_shared\/trial-rule\.mjs'/, 'the server function works the end out some other way')
    /* No second number for the length anywhere it is said. */
    assert.equal(TRIAL_BUTTON, 'Start 7-day free trial')
    assert.equal(DEMO_TRIAL_PILL, 'Try it on your rig free for 7 days')
    assert.equal(DEMO_TRIAL_NUDGE, 'Like it? Plug in your unit and try everything free for 7 days.')
    assert.ok(DEMO_NUDGE_AFTER_MS >= 60000 && DEMO_NUDGE_AFTER_MS <= 10 * 60000, 'the demo’s card comes too soon or too late to be "after a few minutes"')
  })

  test('trial: days left on Play, "ends today" on its last day, and nothing from the second it ends', () => {
    assert.equal(trialLine(ENDS, START), 'Trial: 7 days left · Unlock')
    assert.equal(trialLine(ENDS, START + 4 * DAY_MS), 'Trial: 3 days left · Unlock')
    assert.equal(trialLine(ENDS, START + 6 * DAY_MS), 'Trial: 1 day left · Unlock')
    assert.equal(trialLine(ENDS, ENDS - 60000), 'Trial ends today · Unlock')
    assert.equal(trialLine(ENDS, ENDS), null, 'day 8 still shows a trial')
    assert.equal(trialLine(null, START), null)
    assert.equal(trialDaysLeft(ENDS, ENDS + 1), null)
    assert.equal(trialAccountWord(ENDS, START + 4 * DAY_MS), 'Free trial, 3 days left')
    assert.equal(trialAccountWord(ENDS, ENDS - 1), 'Free trial, ends today')
    /* Apple's 3.1.1: how long, what stops, and the charge after, before the tap. */
    const terms = trialTerms('$9.99')
    for (const part of [/7 days/, /connecting to your rig stops/, /\$9\.99/, /one-time payment/, /Nothing is charged automatically/, /setlists and settings are kept/, /One free trial per account/]) assert.match(terms, part)
    assert.doesNotMatch(trialTerms(null), /for null/)
    for (const why of ['used', 'device', 'bought', 'signed-out', 'no-store-trial', 'offline', undefined]) {
      assert.ok(trialRefusal(why).length > 10)
    }
    assert.match(read('shared/trial-words.mjs'), /return `This \$\{deviceNoun\(\)\} has had a free trial already, on another account\.`/, 'a refusal names the device by a fixed word')
  })

  test('trial: day 8 locks, a running trial stands in for the purchase, and a purchase wins', async () => {
    const rule = await import('../mobile/src/lib/unlock-rule.js')
    const live = { trialEndsAt: ENDS, now: START + DAY_MS }
    const over = { trialEndsAt: ENDS, now: ENDS }
    /* The one written-out copy agrees with the shared rule at every edge. */
    for (const now of [START, ENDS - 1, ENDS, ENDS + 1]) assert.equal(rule.trialRunning(ENDS, now), trialLive(ENDS, now), `the two rules disagree at ${now - START}`)
    assert.equal(rule.trialRunning(null, START), false)
    /* Running: may drive, over the computer and Bluetooth, and is not asked to pay. */
    assert.equal(rule.mayDrive({ available: true, ...live }), true)
    assert.equal(rule.mayDriveBluetooth({ available: true, ...live }, false), true)
    assert.equal(rule.shouldAskToPay({ inApp: true, checking: false, available: true, ...live }), false)
    /* Day 8: none of it, and the purchase page is back. */
    assert.equal(rule.mayDrive({ available: true, ...over }), false)
    assert.equal(rule.mayDriveBluetooth({ available: true, ...over }, false), false)
    assert.equal(rule.shouldAskToPay({ inApp: true, checking: false, available: true, ...over }), true)
    /* Offline at a gig, past the end: the store's "cannot be reached" never gives Bluetooth to a trial that has ended. */
    assert.equal(rule.mayDriveBluetooth({ available: false, ...over }, false), false, 'a trial that ended lives on over Bluetooth with no signal')
    /* Bought: the purchase, whatever the trial says. */
    assert.equal(rule.mayDriveBluetooth({ unlocked: true, available: true, ...over }, false), true)
    assert.equal(rule.shouldAskToPay({ inApp: true, checking: false, available: true, unlocked: true, ...over }), false)
    /* The demo is never asked, trial or none. */
    assert.equal(rule.shouldAskToPay({ inApp: true, demo: true, checking: false, available: true, ...over }), false)
  })

  test('trial: offline the phone keeps the last end it heard, for that account only, and never moves it later', () => {
    const kept = { account: 'a', endsAt: ENDS, used: true }
    /* No answer (no signal, an older server): what was kept, for its own account only. */
    assert.deepEqual(keptTrial({ kept, heard: undefined, account: 'a' }), kept)
    assert.equal(keptTrial({ kept, heard: undefined, account: 'b' }), null, 'one account’s trial shows on another')
    /* The server's word wins, and never lengthens what was kept. */
    assert.equal(keptTrial({ kept, heard: { endsAt: new Date(ENDS + 5 * DAY_MS).toISOString() }, account: 'a' }).endsAt, ENDS, 'a later end from anywhere moved the trial later')
    assert.equal(keptTrial({ kept, heard: { endsAt: new Date(ENDS - DAY_MS).toISOString() }, account: 'a' }).endsAt, ENDS - DAY_MS)
    assert.deepEqual(keptTrial({ kept, heard: null, account: 'a' }), { account: 'a', endsAt: null, used: false })
    /* A clock put back is not more trial: the latest time seen is the clock. */
    assert.equal(trialClock(START, ENDS + 1), ENDS + 1)
    assert.equal(trialLive(ENDS, trialClock(START, ENDS + 1)), false, 'a clock set back a week is a week more trial')
    /* The phone saves what it heard with the latest time seen, and reads it at launch before the network. */
    const lib = flat('mobile/src/lib/purchases.js')
    assert.match(lib, /const known = await remembered\(\) if \(known\) set\(\{ unlocked: true \}\) await loadTrial\(\)/, 'the trial is not read off the phone before the store is asked')
    assert.match(lib, /const back = Math\.max\(0, trialClock\(now, kept\?\.seen \|\| 0\) - now\)/, 'a clock put back gives the trial more time')
    /* And the offline yes for a purchase never reads the trial: the store's "unknown" gives no trial user anything past its end. */
    assert.match(flat('mobile/src/lib/unlock-rule.js'), /export const mayDriveBluetooth = \(\{ unlocked = false, available = false, trialEndsAt = null, now = Date\.now\(\) \} = \{\}, admin = false\) => admin === true \? mayDrive\(\{ unlocked, available, trialEndsAt, now \}\) : hasIt\(\{ unlocked, trialEndsAt, now \}\)/)
  })

  test('trial: the server starts one per account and one per device, the device hashed, and an iPhone only from the free App Store item', async () => {
    const now = Date.now()
    /* Android: starts now, for seven days, with the install number never sent to the database as it came. */
    const a = await trialFn({ body: { action: 'start', device: 'install-number-1234', platform: 'android' }, start: (x) => ({ ok: true, started_at: x.began, ends_at: x.ends }) })
    assert.equal(a.said.ok, true)
    assert.equal(a.started.length, 1)
    const row = a.started[0]
    assert.match(row.device, /^[0-9a-f]{64}$/, 'the device is kept as something other than a hash')
    assert.ok(!JSON.stringify(a.calls).includes('install-number-1234') || a.calls.every((c) => !c.url.includes('/rpc/') || !JSON.stringify(c.body).includes('install-number-1234')), 'the install number reached the database as it was sent')
    assert.equal(row.from_source, 'server')
    assert.equal(Date.parse(row.ends) - Date.parse(row.began), TRIAL_MS)
    assert.ok(Math.abs(Date.parse(row.began) - now) < 60000)
    assert.equal(a.said.trial.live, true)
    /* The same device, hashed the same: that is what holds one per device. */
    const b = await trialFn({ body: { action: 'start', device: 'install-number-1234', platform: 'web' }, start: () => ({ ok: false, why: 'device' }) })
    assert.equal(b.started[0].device, row.device)
    assert.deepEqual([b.said.ok, b.said.why, b.said.trial], [false, 'device', null])
    /* Asked again on an account that has had one: the same row back, never a new end. */
    const was = { ok: false, why: 'used', started_at: new Date(START).toISOString(), ends_at: new Date(ENDS).toISOString() }
    const c = await trialFn({ body: { action: 'start', device: 'install-number-9999', platform: 'android' }, start: () => was })
    assert.equal(c.said.why, 'used')
    assert.equal(c.said.trial.endsAt, new Date(ENDS).toISOString())
    /* An iPhone with no free item on the account: nothing starts, the database is not asked. */
    const d = await trialFn({ body: { action: 'start', device: 'install-number-1234', platform: 'ios' }, purchases: [] })
    assert.deepEqual([d.said.ok, d.said.why, d.started.length], [false, 'no-store-trial', 0])
    /* With it: from when the item was bought, never later. */
    const boughtAt = now - 2 * DAY_MS
    const e = await trialFn({
      body: { action: 'start', device: 'install-number-1234', platform: 'ios' },
      purchases: [{ product_id: 'prod_trial', purchased_at: boughtAt, status: 'owned' }, { product_id: 'prod_full', purchased_at: now, status: 'owned' }],
      products: [{ id: 'prod_trial', store_identifier: TRIAL_PRODUCT_ID }, { id: 'prod_full', store_identifier: 'cloud.newbold.fractalremote.full' }],
      start: (x) => ({ ok: true, started_at: x.began, ends_at: x.ends })
    })
    assert.equal(e.started[0].from_source, 'app_store_trial')
    assert.equal(Date.parse(e.started[0].began), boughtAt, 'an iPhone’s trial does not begin when the free item was bought')
    /* A refunded free item starts nothing. */
    const f = await trialFn({ body: { action: 'start', device: 'install-number-1234', platform: 'ios' }, purchases: [{ product_id: 'prod_trial', purchased_at: boughtAt, status: 'refunded' }], products: [{ id: 'prod_trial', store_identifier: TRIAL_PRODUCT_ID }] })
    assert.equal(f.said.why, 'no-store-trial')
    /* Who is asking is the token's, a device is required, and anything else is refused. */
    assert.equal((await trialFn({ token: 'bad', body: { action: 'start', device: 'install-number-1234', platform: 'web' } })).status, 401)
    assert.equal((await trialFn({ body: { action: 'start', device: 'x', platform: 'web' } })).status, 400)
    assert.equal((await trialFn({ body: { action: 'start', device: 'install-number-1234', platform: 'tv' } })).said.why, 'platform')
    assert.ok(!/body\.(account|uid|user)/.test(code(read('supabase/functions/trial/index.ts'))), 'the account comes from the body')
    /* The rule, by itself, at every refusal. */
    assert.equal(trialStart({ platform: 'web', bought: true }).why, 'bought')
    assert.equal(trialStart({ platform: 'web', had: true }).why, 'used')
    assert.equal(trialStart({ platform: 'web', deviceTaken: true }).why, 'device')
    assert.equal(trialStart({ platform: 'ios', storeAt: now + DAY_MS, now }).startedAt, now, 'a free item dated ahead starts the trial in the future')
    assert.equal(deviceIdOk('$RCAnonymousID:0123456789abcdef'), true, 'the browser’s made-up number is refused')
    assert.equal(deviceIdOk('a b c d e f g h'), false)
  })

  test('trial: the database holds one per account and one per device, keeps them from clients, and never touches a purchase', () => {
    const sql = sqlOf('supabase/migrations/20261107_trials.sql')
    assert.match(sql, /create table if not exists public\.trials \( account_id uuid primary key references auth\.users \(id\) on delete cascade,/)
    assert.match(sql, /create unique index if not exists trials_one_per_device on public\.trials \(device_key\)/)
    assert.match(sql, /create table if not exists public\.trial_devices \( device_key text primary key/, 'a deleted account frees its device for another trial')
    for (const table of ['trials', 'trial_devices']) {
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
      assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`))
      assert.ok(!new RegExp(`create policy[^;]*on public\\.${table}`).test(sql), `a client can reach ${table}`)
    }
    for (const fn of ['start_trial(uuid, text, text, text, timestamptz, timestamptz)', 'trial_of(uuid)', 'owner_trials()']) {
      assert.ok(sql.includes(`revoke all on function public.${fn} from public, anon, authenticated`), `a client can call ${fn}`)
      assert.ok(sql.includes(`grant execute on function public.${fn} to service_role`), `the server cannot call ${fn}`)
    }
    /* Never a second trial, never an end moved, never a purchase written. */
    assert.ok(!/update public\.trials/.test(sql), 'a trial’s end can be changed')
    assert.ok(!/(insert into|update|delete from) public\.entitlements/.test(sql), 'a trial writes the purchase record')
    assert.match(sql, /if exists \(select 1 from public\.entitlements where account_id = uid and active\) then return jsonb_build_object\('ok', false, 'why', 'bought'\)/)
    /* The relay: paid, or a trial still running, by the clock. */
    assert.match(sql, /select coalesce\(\(select active from public\.entitlements where account_id = uid\), false\) or exists \(select 1 from public\.trials where account_id = uid and now\(\) < ends_at\)/)
    assert.match(sql, /function public\.is_entitled\(uid uuid\) returns boolean language sql stable security definer set search_path = public, pg_temp/)
    assert.ok(!/'device_key'/.test(sql.slice(sql.indexOf('function public.owner_trials'))), 'Sales is sent the device column')
  })

  test('trial: the server answers it beside the purchase, never in it', async () => {
    const live = { started_at: new Date(Date.now() - DAY_MS).toISOString(), ends_at: new Date(Date.now() + 6 * DAY_MS).toISOString() }
    const a = await entitlementFn({ trial: live })
    assert.equal(a.said.unlocked, false, 'a trial is answered as a purchase')
    assert.equal(a.said.trial.live, true)
    assert.deepEqual(a.written.map((w) => w.is_active), [false], 'a trial is written into the purchase record')
    /* Bought: the purchase, and no trial beside it. */
    const b = await entitlementFn({ owns: true, trial: live })
    assert.deepEqual([b.said.unlocked, 'trial' in b.said], [true, false])
    /* The table not there yet: no trial said at all, so a phone keeps what it heard. */
    const c = await entitlementFn({ trialFails: true })
    assert.equal('trial' in c.said, false)
    /* Never had one: a definite null. */
    assert.equal((await entitlementFn({ trial: null })).said.trial, null)
    assert.equal(trialAnswer(null), null)
  })

  test('trial: an iPhone offers it only with the App Store’s free item, buys that item first, and Android asks the server', async () => {
    assert.equal(trialOffered({ platform: 'ios', storeTrial: false }), false, 'an iPhone offers a trial before Apple has the free item')
    assert.equal(trialOffered({ platform: 'ios', storeTrial: true }), true)
    assert.equal(trialOffered({ platform: 'android' }), true)
    assert.equal(trialOffered({ platform: 'android', unlocked: true }), false, 'somebody who bought is offered a trial')
    assert.equal(trialOffered({ platform: 'web', used: true }), false, 'a second trial is offered')

    const none = await phone({ os: 'ios', storeTrial: false })
    try {
      await none.p.startPurchases()
      assert.equal(none.p.trialAvailable(), false, 'the button shows with no free item in the store')
      assert.equal((await none.p.startTrial()).why, 'no-store-trial')
      assert.deepEqual(none.pass.asks, [], 'the server was asked to start an iPhone trial with no free item bought')
    } finally {
      none.done()
    }

    const ios = await phone({ os: 'ios', storeTrial: true })
    try {
      await ios.p.startPurchases()
      assert.equal(ios.p.trialAvailable(), true)
      ios.pass.answer = { ok: true, why: null, trial: { startedAt: new Date().toISOString(), endsAt: new Date(Date.now() + TRIAL_MS).toISOString(), live: true } }
      const out = await ios.p.startTrial()
      assert.equal(out.ok, true)
      assert.deepEqual(ios.bought, [TRIAL_PRODUCT_ID], 'the free item was not bought before the trial')
      assert.deepEqual(ios.pass.asks, [{ device: 'install-number-1234', platform: 'ios' }])
      const state = ios.p.purchaseState()
      assert.equal(state.unlocked, false, 'the trial was taken for the purchase')
      assert.ok(state.trialEndsAt > Date.now())
      assert.equal(ios.p.mayConnectBluetooth(false), true)
      assert.equal(ios.p.trialAvailable(), false, 'a second trial is offered')
      assert.match(ios.disk.get('fractal.trial'), /"account":"11111111-2222-4333-8444-555555555555"/, 'the trial is not kept for a gig with no signal')
    } finally {
      ios.done()
    }

    const android = await phone({ os: 'android' })
    try {
      await android.p.startPurchases()
      android.pass.answer = { ok: false, why: 'device', trial: null }
      const out = await android.p.startTrial()
      assert.deepEqual([out.ok, out.why], [false, 'device'])
      assert.deepEqual(android.bought, [], 'Android bought a store item for the trial')
      assert.equal(android.p.purchaseState().trialEndsAt, null)
    } finally {
      android.done()
    }

    const nobody = await phone({ os: 'android', session: null })
    try {
      await nobody.p.startPurchases()
      assert.equal((await nobody.p.startTrial()).why, 'signed-out')
      assert.deepEqual(nobody.pass.asks, [])
    } finally {
      nobody.done()
    }
  })

  test('trial: the free item is never sold as the unlock, and never counted as a sale', () => {
    const phonePicker = read('mobile/src/lib/purchases.js')
    const picker = phonePicker.slice(phonePicker.indexOf('const theUnlockIn'), phonePicker.indexOf('const loadPrice'))
    assert.match(picker, /\.filter\(\(p\) => p\?\.product\?\.identifier !== '([^']+)'\)/)
    assert.equal(picker.match(/!== '([^']+)'/)[1], TRIAL_PRODUCT_ID)
    const web = read('src/lib/webPurchase.js')
    assert.equal(web.match(/webBillingProduct\?\.identifier !== '([^']+)'/)[1], TRIAL_PRODUCT_ID)
    const grant = code(read('supabase/functions/grant-access/index.ts'))
    assert.match(grant, /\.filter\(\(p: any\) => !trialIds\.has\(String\(p\?\.product_id \|\| ''\)\)\)/, 'the free trial item is a sale on Sales')
    /* And never on the `full` entitlement: the docs say so where the item is set up. */
    assert.match(read('docs/app-store.md'), /NOT attached to the `full` entitlement/)
  })

  test('trial: a trial never opens what a store version keeps closed', () => {
    /* The store-version gates read no purchase and no trial. */
    const ble = code(read('mobile/src/lib/ble-rule.js'))
    assert.ok(!/trial|unlocked|purchase/i.test(ble), 'the Bluetooth and Edit store gates read the purchase or the trial')
    /* Everywhere Bluetooth is offered, the trial (through the purchase rule) is ANDed with the store gate, never ORed. */
    assert.match(flat('mobile/src/screens/Settings.js'), /\{mayDriveBluetooth\(purchase, bluetoothAdmin\) && bluetoothAllowed && bluetoothSupported\(\) \? \( <SetupRow title="Bluetooth"/)
    assert.match(flat('mobile/src/lib/useBluetoothOffered.js'), /return mayDriveBluetooth\(purchase, admin\) && allowed && bluetoothSupported\(\)/)
    /* Nothing about the trial reaches the opening thresholds. */
    for (const f of ['shared/trial-rule.mjs', 'shared/trial-words.mjs', 'supabase/functions/trial/index.ts']) {
      assert.ok(!/BLUETOOTH_FROM_STORE|EDIT_FROM_STORE|UNITS_FROM_STORE|bluetoothOpen/.test(code(read(f))), `${f} reaches a store-version gate`)
    }
  })

  test('trial: the demo stays free and points at the trial; Play, the purchase page and both ends say it', () => {
    /* The phone. */
    const bar = flat('mobile/src/components/TopBar.js')
    assert.match(bar, /const offerTrial = Boolean\(onUnlock\) && shouldOffer\(\{ demo \}\) && trialAvailable\(purchase\)/)
    assert.match(bar, /\{offerTrial \? \( <Text numberOfLines=\{2\}[^>]*> \{DEMO_TRIAL_PILL\} <\/Text> \) : null\} <Text[^>]*>Unlock<\/Text>/, 'the demo’s bar does not say the trial over Unlock')
    const pay = flat('mobile/src/screens/Paywall.js')
    assert.match(pay, /\{offerTrial \? \( <> <Press label=\{TRIAL_BUTTON\} tone="signal" disabled=\{busy\} onPress=\{tryIt\} \/> <Text[^>]*>\{trialTerms\(price\)\}<\/Text> <\/> \) : null\} <Press label=\{price \?/, 'the trial is not offered beside Unlock, or without its terms')
    assert.match(flat('mobile/src/screens/Stage.js'), /<TrialLine onUnlock=\{onUnlock\} \/>/)
    assert.match(flat('mobile/src/screens/Stage.js'), /<DemoTrialNudge onUnlock=\{onUnlock\} waiting=\{notesUp \|\| coach \|\| watchTip\} \/>/)
    assert.match(flat('mobile/src/components/DemoTrialNudge.js'), /if \(!demo \|\| !due \|\| gone !== false \|\| waiting \|\| !onUnlock \|\| !trialAvailable\(purchase\)\) return null/)
    assert.match(flat('mobile/App.js'), /\[auth, demo, purchase\.checking, purchase\.available, purchase\.unlocked, purchase\.trialEndsAt\]/, 'day 8 does not bring the purchase page back')
    /* The browser and the computer app. */
    const app = flat('src/App.jsx')
    assert.match(app, /const mustPay = Boolean\(link\.role === 'remote'[^\n]*?!paid\.unknown\) && !onTrial/)
    assert.match(app, /\{trialHere \? \( <> <button type="button" className="primary unlock-trial"[^>]*> \{TRIAL_BUTTON\} <\/button> <p className="hint">\{trialTerms\(webPriceText\)\}<\/p> <\/> \) : null\}/)
    assert.match(app, /unlockTrial=\{trialHere \? DEMO_TRIAL_PILL : null\}/)
    assert.match(app, /kind: 'line', text: trialLine\(trialEndsAt\)/)
    assert.match(app, /kind: 'nudge', text: DEMO_TRIAL_NUDGE/)
    assert.match(flat('src/lib/link.js'), /const unlocked = answer\.unlocked \|\| \(Number\.isFinite\(trialEnds\) && Date\.now\(\) < trialEnds\)/, 'the computer’s phone remote does not come on for a trial')
    /* Never "this phone" in a trial sentence. */
    for (const f of ['shared/trial-words.mjs', 'mobile/src/components/TrialLine.js', 'mobile/src/components/DemoTrialNudge.js']) assert.doesNotMatch(read(f), /this phone/i)
  })

  test('trial: Sales shows how the trials do', async () => {
    const { trialSections, salesSections } = await import('../shared/admin.mjs')
    const now = START + 10 * DAY_MS
    const answer = {
      ok: true,
      sales: [],
      trials: [
        { email: 'a@x.y', started_at: new Date(START + 5 * DAY_MS).toISOString(), ends_at: new Date(START + 12 * DAY_MS).toISOString(), platform: 'android', converted: false },
        { email: 'b@x.y', started_at: new Date(START).toISOString(), ends_at: new Date(ENDS).toISOString(), platform: 'ios', converted: true },
        { email: 'c@x.y', started_at: new Date(START).toISOString(), ends_at: new Date(ENDS).toISOString(), platform: 'web', converted: false }
      ]
    }
    const [totals, latest] = trialSections(answer, now)
    assert.equal(totals.title, 'Free trials')
    assert.deepEqual(totals.rows.map((r) => r.value), ['3', '1', '1, 50% of the trials that have ended'])
    assert.match(latest.rows[0].value, /^Android, started .*, ends .*\. Not bought yet\.$/)
    assert.match(latest.rows[1].value, /Bought\.$/)
    assert.match(latest.rows[2].value, /^Website, .* Didn’t buy\.$/)
    assert.ok(salesSections(answer, now).some((s) => s.title === 'Free trials'))
    assert.deepEqual(trialSections({ ok: true }, now), [], 'an older server’s answer grows a trials section')
  })
}
