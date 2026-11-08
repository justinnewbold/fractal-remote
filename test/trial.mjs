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
    /* The pretend SDK itself, so a test can make the store answer otherwise, and what the store holds. */
    api: holder.api,
    setInfo: (next) => {
      info = next
    },
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
    /* An Apple ID's free item older than the trial (moved here from another account by RevenueCat): refused, never a row already ended. */
    assert.deepEqual(trialStart({ platform: 'ios', storeAt: now - 8 * DAY_MS, now }), { ok: false, why: 'store-trial-over' })
    assert.equal(trialStart({ platform: 'ios', storeAt: now - 6 * DAY_MS, now }).ok, true, 'an Apple ID’s trial with a day left is refused')
    const { trialRefusal: refusal } = await import('../shared/trial-words.mjs')
    assert.equal(refusal('store-trial-over'), 'This Apple ID has had its free trial already, on another account.')
    assert.equal(deviceIdOk('$RCAnonymousID:0123456789abcdef'), true, 'the browser’s made-up number is refused')
    assert.equal(deviceIdOk('a b c d e f g h'), false)
  })

  test('trial: a test purchase (App Review’s and TestFlight’s Apple IDs) starts an iPhone’s trial now, and a real one keeps its date', async () => {
    /*
     * Apple's reviewer buys with a test Apple ID, which may have bought the
     * free item weeks before, while the item itself was in review. RevenueCat
     * marks that purchase environment "sandbox", and by its own date the trial
     * would be over before it began ("This Apple ID has had its free trial
     * already"), which reads as a broken purchase under guideline 2.1.
     */
    const products = [{ id: 'prod_trial', store_identifier: TRIAL_PRODUCT_ID }, { id: 'prod_full', store_identifier: 'cloud.newbold.fractalremote.full' }]
    const ios = (purchases) =>
      trialFn({ body: { action: 'start', device: 'install-number-1234', platform: 'ios' }, purchases, products, start: (x) => ({ ok: true, started_at: x.began, ends_at: x.ends }) })
    const item = (daysAgo, more = {}) => ({ product_id: 'prod_trial', purchased_at: Date.now() - daysAgo * DAY_MS, status: 'owned', store: 'app_store', ...more })

    /* A test purchase thirty days old: seven days from now, from the free item. */
    const before = Date.now()
    const a = await ios([item(30, { environment: 'sandbox' })])
    assert.equal(a.said.ok, true, 'App Review’s old test purchase is told it has had its trial')
    assert.equal(a.started.length, 1)
    assert.equal(a.started[0].from_source, 'app_store_trial', 'a test purchase’s trial is not the free item’s')
    const began = Date.parse(a.started[0].began)
    assert.ok(began >= before && began <= Date.now(), 'a test purchase’s trial does not begin when it is asked')
    assert.equal(Date.parse(a.started[0].ends) - began, TRIAL_MS)
    assert.equal(a.said.trial.live, true)

    /* A real purchase keeps the rule exactly: past seven days it is refused, as before. */
    const b = await ios([item(30, { environment: 'production' })])
    assert.deepEqual([b.said.ok, b.said.why, b.started.length], [false, 'store-trial-over', 0], 'a real purchase older than the trial starts one')
    const c = await ios([item(30)])
    assert.equal(c.said.why, 'store-trial-over', 'a purchase that does not say its environment is taken for a test one')
    /* And from its own date when it is younger. */
    const realAt = Date.now() - 2 * DAY_MS
    const d = await ios([{ ...item(0, { environment: 'production' }), purchased_at: realAt }])
    assert.equal(Date.parse(d.started[0].began), realAt, 'a real purchase’s trial no longer begins when it was bought')

    /* A test purchase never moves a real one: the real date wins whichever is older. */
    const e = await ios([item(30, { environment: 'sandbox' }), { ...item(0, { environment: 'production' }), purchased_at: realAt }])
    assert.equal(Date.parse(e.started[0].began), realAt, 'an older test purchase moved a real one’s date')
    const f = await ios([item(30, { environment: 'production' }), item(1, { environment: 'sandbox' })])
    assert.equal(f.said.why, 'store-trial-over', 'a test purchase gave a real Apple ID’s spent trial back')

    /* Only the free item, and never a refunded one. */
    assert.equal((await ios([item(30, { environment: 'sandbox', status: 'refunded' })])).said.why, 'no-store-trial', 'a refunded test purchase starts a trial')
    assert.equal((await ios([item(30, { environment: 'sandbox', product_id: 'prod_full' })])).said.why, 'no-store-trial', 'a test purchase of the full version starts a trial')

    /* Elsewhere nothing changes: there is no store item to ask about. */
    const g = await trialFn({ body: { action: 'start', device: 'install-number-1234', platform: 'android' }, purchases: [item(30, { environment: 'sandbox' })], products, start: (x) => ({ ok: true, started_at: x.began, ends_at: x.ends }) })
    assert.equal(g.started[0].from_source, 'server')
    assert.ok(!g.calls.some((x) => x.url.includes('/purchases')), 'Android asks RevenueCat for the App Store’s free item')
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

  test('trial: one purchase is one account: an Apple ID that bought for another account gives no trial and no unlock here, and says why', async () => {
    /*
     * 7 November 2026: the free item, bought on a new account, sent the Apple
     * ID's history to RevenueCat, which moved the full version off the
     * account that bought it. Transfer moves and never copies, so it stays
     * (Justin, the same day); the trial says when the purchase arrives, and
     * should the setting ever be Keep, receipt_already_in_use (code 7) is
     * said in plain words too.
     */
    const inUse = Object.assign(new Error('The receipt is already in use by another subscriber.'), { code: '7' })
    const ios = await phone({ os: 'ios', storeTrial: true })
    try {
      await ios.p.startPurchases()
      ios.api.purchaseStoreProduct = async () => {
        throw inUse
      }
      const out = await ios.p.startTrial()
      assert.deepEqual([out.ok, out.why], [false, 'other-account'])
      assert.match(out.message, /^This Apple ID bought the full version already, for another Fractal Remote account\. Sign in with that account to use it/)
      assert.deepEqual(ios.pass.asks, [], 'the server was asked for a trial the store refused')
      assert.equal(ios.p.purchaseState().unlocked, false, 'another account’s purchase unlocked this one')
      ios.api.restorePurchases = async () => {
        throw inUse
      }
      const back = await ios.p.restorePurchase()
      assert.equal(back.ok, false)
      assert.equal(back.otherAccount, true)
      assert.match(back.message, /for another Fractal Remote account/)
      assert.equal(ios.p.purchaseState().unlocked, false)
    } finally {
      ios.done()
    }

    /* And where the store did carry this Apple ID's own purchase across: unlocked, no trial, and said. */
    const own = await phone({ os: 'ios', storeTrial: true })
    try {
      await own.p.startPurchases()
      own.api.purchaseStoreProduct = async (p) => {
        own.bought.push(p.identifier)
        const next = { entitlements: { active: { full: { isActive: true, store: 'APP_STORE' } } }, nonSubscriptionTransactions: [{ productIdentifier: p.identifier }], allPurchasedProductIdentifiers: ['cloud.newbold.fractalremote.full', p.identifier] }
        own.setInfo(next)
        return { customerInfo: next }
      }
      const out = await own.p.startTrial()
      assert.deepEqual([out.ok, out.why], [false, 'apple-id-owns'])
      assert.deepEqual(own.pass.asks, [], 'a trial was started on an account the full version had just reached')
      assert.equal(own.p.purchaseState().unlocked, true)
    } finally {
      own.done()
    }

    /* Said in plain words, and RevenueCat's setting is written down where it is set. */
    assert.match(trialRefusal('other-account'), /^This Apple ID bought the full version already, for another Fractal Remote account\./)
    /* A trial that began when the App Store's item was bought, days before this account arrived on the Apple ID: its own days, or over, never seven. */
    const { trialStartedWords, TRIAL_STARTED, TRIAL_OVER } = await import('../shared/trial-words.mjs')
    const now = new Date(2026, 10, 7, 12).getTime()
    const ends = (days) => ({ endsAt: new Date(now + days * 86400000).toISOString() })
    assert.deepEqual(trialStartedWords(ends(7), now), { over: false, text: TRIAL_STARTED })
    assert.deepEqual(trialStartedWords(ends(4), now), { over: false, text: 'Your free trial has 4 days left. Unlock now and it carries on for good.' })
    assert.deepEqual(trialStartedWords({ endsAt: new Date(now - 3600000).toISOString() }, now), { over: true, text: TRIAL_OVER })
    assert.deepEqual(trialStartedWords(null, now), { over: false, text: TRIAL_STARTED }, 'an answer with no trial in it says nothing it does not know')
    assert.match(flat('mobile/src/screens/Paywall.js'), /if \(out\.ok\) \{ const said = trialStartedWords\(out\.trial\) if \(said\.over\) return setSaid\(\{ tone: 'warn', text: said\.text \}\) Alert\.alert\('Free trial', said\.text\)/, 'the purchase page says seven days have started whatever the server answered')
    assert.match(trialRefusal('apple-id-owns'), /so the full version is on this account now and no trial is needed\. Any other account it was on doesn’t have it any more\.$/)
    assert.match(read('docs/app-store.md'), /Restore behavior: Transfer to new App\s+User ID\*\*, RevenueCat's default, left as it is/, 'the RevenueCat setting, and why it stays, is not written down')
    const pay = flat('mobile/src/screens/Paywall.js')
    assert.match(pay, /if \(out\.why === 'apple-id-owns'\) \{ Alert\.alert\('Already unlocked', trialRefusal\(out\.why\)\) return onUnlocked\?\.\(\) \}/)
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
    /* By the one constant, never a copy of its letters that could drift from it. */
    assert.match(picker, /\.filter\(\(p\) => p\?\.product\?\.identifier !== TRIAL_PRODUCT_ID\)/)
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
    assert.match(bar, /const offerTrial = Boolean\(onUnlock\) && shouldOffer\(\{ demo \}\) && trialOnOffer\(purchase\)/)
    assert.match(bar, /\{offerTrial \? \( <Text numberOfLines=\{2\}[^>]*> \{DEMO_TRIAL_PILL\} <\/Text> \) : null\} <Text[^>]*>Unlock<\/Text>/, 'the demo’s bar does not say the trial over Unlock')
    const pay = flat('mobile/src/screens/Paywall.js')
    assert.match(pay, /\{offerTrial \? \( <> <Press label=\{TRIAL_BUTTON\} tone="signal" on disabled=\{busy\} onPress=\{tryIt\} \/> <Text[^>]*>\{trialTerms\(price\)\}<\/Text> <\/> \) : null\} <Press label=\{price \?/, 'the trial is not offered beside Unlock, or without its terms')
    /* "It should show everything on the screen instead of having to scroll up" (8 November 2026): the buttons over what it unlocks, in a sheet that comes up to the status bar. */
    assert.ok(pay.indexOf('{freeFirst ? (') > 0 && pay.indexOf('{freeFirst ? (') < pay.indexOf('glassCard({ flat: asked'), 'the Unlock page’s buttons are under its list of features again')
    assert.ok(pay.indexOf('glassCard({ flat: asked') < pay.indexOf('{BLUETOOTH_PAYWALL}'), 'the Bluetooth line moved over the features')
    assert.match(pay, /<Sheet open tall onClose=\{\(\) => onBack\?\.\(\)\} title="Unlock" note="One payment, once">/, 'the Unlock sheet is not tall')
    assert.match(flat('mobile/src/screens/Stage.js'), /<TrialLine onUnlock=\{onUnlock\} \/>/)
    assert.match(flat('mobile/src/screens/Stage.js'), /<DemoTrialNudge onUnlock=\{onUnlock\} waiting=\{notesUp \|\| coach \|\| watchTip\} \/>/)
    assert.match(flat('mobile/src/components/DemoTrialNudge.js'), /if \(!demo \|\| !due \|\| gone !== false \|\| waiting \|\| !onUnlock \|\| !trialOnOffer\(purchase\)\) return null/)
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

  test('trial: Sales counts the trials, and the Trials page lists who is on one now', async () => {
    const { trialSections, trialsPageSections, trialLeft, salesSections, TRIALS_NOW_TITLE, TRIALS_DONE_TITLE, NOBODY_ON_TRIAL } = await import('../shared/admin.mjs')
    const now = START + 10 * DAY_MS
    const iso = (ms) => new Date(ms).toISOString()
    const answer = {
      ok: true,
      sales: [],
      trials: [
        /* Started today (an hour ago), on now. */
        { email: 'd@x.y', started_at: iso(now - 3600000), ends_at: iso(now - 3600000 + 7 * DAY_MS), platform: 'ios', converted: false },
        /* Started 5 days ago, on now, ends sooner, so listed first. */
        { email: 'a@x.y', started_at: iso(START + 5 * DAY_MS), ends_at: iso(START + 12 * DAY_MS), platform: 'android', converted: false },
        /* Bought during the trial: not on a trial any more. */
        { email: 'e@x.y', started_at: iso(START + 6 * DAY_MS), ends_at: iso(START + 13 * DAY_MS), platform: 'web', converted: true },
        /* Ten days ago, ended: one bought, one did not. */
        { email: 'b@x.y', started_at: iso(START), ends_at: iso(ENDS), platform: 'ios', converted: true },
        { email: 'c@x.y', started_at: iso(START), ends_at: iso(ENDS), platform: 'web', converted: false }
      ]
    }
    /* "How many people have signed up for trials in the last day or seven days or whatever, just like all the other stuff" (8 November 2026). */
    const [totals] = trialSections(answer, now)
    assert.equal(totals.title, 'Free trials')
    assert.deepEqual(totals.rows.map((r) => r.label), ['Started today', 'Last 7 days', 'Last 30 days', 'All time', 'On a trial now', 'Full version after a trial'])
    assert.deepEqual(totals.rows.map((r) => r.value), ['1', '3', '5', '5', '2', '2, 50% of the trials that have ended'])
    assert.equal(trialSections(answer, now).length, 1, 'Sales lists the people as well as counting them; the list is on the Trials page')
    assert.ok(salesSections(answer, now).some((s) => s.title === 'Free trials'))
    assert.deepEqual(trialSections({ ok: true }, now), [], 'an older server’s answer grows a trials section')

    /* "Can we add people that are on trials currently into the developer section": everyone on one now, the one ending soonest first. */
    const page = trialsPageSections(answer, now)
    assert.deepEqual(page.map((s) => s.title), ['Free trials', TRIALS_NOW_TITLE, TRIALS_DONE_TITLE])
    const on = page[1].rows
    assert.deepEqual(on.map((r) => r.label), ['a@x.y', 'd@x.y'], 'not everyone on a trial now, soonest ending first, or a buyer still listed as on a trial')
    assert.match(on[0].value, /^Android, started .*, 2 days left \(ends .*\)\.$/)
    assert.match(on[1].value, /^iPhone or iPad, started .*, 7 days left \(ends .*\)\.$/)
    const done = page[2].rows
    assert.deepEqual(done.map((r) => r.label), ['e@x.y', 'b@x.y', 'c@x.y'])
    /* "Has the full version", never "Bought": an unlock given by hand is kept the same way as a purchase (owner_trials' converted). */
    assert.match(done[0].value, /Has the full version\.$/)
    assert.match(done[2].value, /^Website, started .*\. Ended .*, no full version\.$/)
    for (const sec of page) for (const r of sec.rows) assert.doesNotMatch(`${r.label} ${r.value}`, /\bbought\b|\bbuy\b/i, `the Trials page claims a sale: ${r.label} ${r.value}`)
    /* Nobody on one: said, never an empty box. */
    const none = trialsPageSections({ ok: true, trials: [answer.trials[3]] }, now)
    assert.deepEqual(none[1].rows, [{ label: '', value: NOBODY_ON_TRIAL }])
    /* A server that cannot list them says so; a refusal draws nothing (the page shows its message). */
    assert.match(trialsPageSections({ ok: true, trials: null }, now)[0].rows[0].value, /can’t list the free trials yet/)
    assert.deepEqual(trialsPageSections({ ok: false, message: 'Not allowed.' }, now), [])
    /* A server without the 'trials' answer yet (the page's update can arrive first): plain words, not "Unknown action.". */
    const { trialsProblem } = await import('../shared/admin.mjs')
    assert.match(trialsProblem({ ok: false, message: 'Unknown action.' }), /server update that goes with it/)
    assert.equal(trialsProblem({ ok: false, message: 'Not allowed.' }), 'Not allowed.')
    assert.equal(trialsProblem({ ok: true }), null)
    /* And it does not wait for that server update: an "Unknown action." server is asked for Sales, whose answer carries the same trials. */
    const { trialsAnswer } = await import('../shared/admin.mjs')
    const asked = []
    const oldServer = async (action) => (asked.push(action), action === 'trials' ? { ok: false, message: 'Unknown action.' } : { ok: true, sales: [], trials: answer.trials, accounts: 9 })
    assert.deepEqual(await trialsAnswer(oldServer), { ok: true, trials: answer.trials })
    assert.deepEqual(asked, ['trials', 'sales'])
    const newServer = async (action) => (asked.push(action), { ok: true, trials: answer.trials })
    asked.length = 0
    assert.deepEqual(await trialsAnswer(newServer), { ok: true, trials: answer.trials })
    assert.deepEqual(asked, ['trials'], 'a server with the trials answer is asked for Sales as well')
    /* Any other refusal is said, never retried as Sales (a stranger's 403 stays a 403). */
    asked.length = 0
    const refused = await trialsAnswer(async (action) => (asked.push(action), { ok: false, message: 'Not allowed.' }))
    assert.deepEqual([refused.message, asked], ['Not allowed.', ['trials']])
    /* Sales refused too: its refusal is said. */
    assert.equal((await trialsAnswer(async (action) => (action === 'trials' ? { ok: false, message: 'Unknown action.' } : { ok: false, message: 'RevenueCat is busy.' }))).message, 'RevenueCat is busy.')
    /* The last day says so, rather than "0 days left". */
    assert.equal(trialLeft(now + 3600000, now), 'ends today')
    assert.equal(trialLeft(now + DAY_MS, now), `1 day left (ends ${new Date(now + DAY_MS).toLocaleString('en-US', { month: 'short' })} ${new Date(now + DAY_MS).getDate()}, ${new Date(now + DAY_MS).getFullYear()})`)
    assert.equal(trialLeft(null, now), 'end unknown')
  })

  test('trial: the Trials page is Justin’s, on both ends, asking the server for the trials alone', () => {
    const phone = read('mobile/src/components/TrialsTool.js')
    const web = read('src/components/TrialsTool.jsx')
    for (const [name, src] of [['phone', phone], ['browser', web]]) {
      assert.match(src, /setSaid\(await trialsAnswer\(ask\)\)/, `the ${name}’s Trials page does not ask the server for the trials`)
      assert.equal((src.match(/accessAction\(/g) || []).length, 1, `the ${name}’s Trials page asks the server some other way`)
      assert.match(src, /trialsPageSections\(said\)/, `the ${name}’s Trials page has words of its own`)
      assert.match(src, /trialsProblem\(said\)/, `the ${name}’s Trials page shows the server’s refusal raw`)
      assert.doesNotMatch(src, /said\.message/, `the ${name}’s Trials page shows the server’s refusal raw`)
    }
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /\{ key: 'trials', label: 'Trials' \}/, 'the phone’s Developer page has no Trials tab')
    assert.match(settings, /\{devTab\.customers === 'trials' \? <TrialsTool \/> : null\}/)
    const app = read('src/App.jsx')
    assert.match(app, /\{setupPage === 'trials' && isAdmin\(link\.account\?\.id\) \? \(/, 'the browser’s Free trials page is not behind his account')
    assert.match(app, /<SetupRow key="trials" title="Free trials"/)
    /* The server's answer: his account only (the lock every action is behind), the trials and nothing else, no email asked for. */
    const fn = read('supabase/functions/grant-access/index.ts')
    assert.match(fn, /const ACTIONS = \[[^\]]*'trials'/)
    assert.match(fn, /if \(!\['sales', 'accounts', 'usage', 'trials', /)
    assert.match(fn, /if \(action === 'trials'\) return json\(\{ ok: true, trials: await trialsList\(\) \}\)/)
  })
  test('trial: the App Store item is made from the notes, within Apple’s limits, and its picture is one Apple takes', async () => {
    const { trialItem, freePoint, pngSize, reviewPicture, LIMITS, SCREENSHOT } = await import('../scripts/iap-trial.mjs')
    const md = read('docs/app-store.md')
    const item = trialItem(md)
    assert.equal(item.productId, TRIAL_PRODUCT_ID, 'the item the store sells is not the one the iPhone buys')
    assert.equal(item.type, 'NON_CONSUMABLE', 'guideline 3.1.1 allows a free trial only as a Non-Consumable')
    assert.equal(item.familySharable, false)
    assert.equal(item.displayName, `${TRIAL_DAYS}-day Trial`, 'the name is not 3.1.1’s own "XX-day Trial"')
    /* App Store Connect Help, "In-App Purchase information": 64, 30, 45 and 4000, never the marketing page's 35 and 55. */
    assert.deepEqual(LIMITS, { referenceName: 64, displayName: 30, description: 45, reviewNote: 4000 })
    for (const [key, most] of Object.entries(LIMITS)) assert.ok([...item[key]].length <= most, `${key} is longer than App Store Connect takes`)
    assert.ok(item.reviewNote.includes(TRIAL_BUTTON), 'the review notes name a button the page does not have')
    assert.match(item.reviewNote, /Restart now/, 'the review notes do not say how to get the button on a fresh install’s first launch')
    /* Refused where Apple would refuse it, before anything is sent. */
    const row = '| Localization Description | `Try the full version free for 7 days.`'
    assert.ok(md.includes(row))
    assert.throws(() => trialItem(md.replace(row, '| Localization Description | `The full version free for 7 days, with your own rig.`')), /description is 52 characters; App Store Connect takes 45/)
    assert.throws(() => trialItem(md.replace('| Product ID | `trial_7day`', '| Product ID | `trial_week`')), /the app buys trial_7day/)
    assert.throws(() => trialItem(md.replace('Display Name | `7-day Trial`', 'Display Name | `Free Trial`')), /not "7-day Trial"/)
    assert.equal(freePoint([{ id: 'a', attributes: { customerPrice: '0.99' } }, { id: 'b', attributes: { customerPrice: '0.0' } }]).id, 'b')
    assert.equal(freePoint([{ id: 'a', attributes: { customerPrice: '0.99' } }]), null)
    const bytes = readFileSync(new URL(`../${SCREENSHOT}`, import.meta.url))
    assert.deepEqual(pngSize(bytes), { width: 1290, height: 2796, alpha: false })
    assert.equal(reviewPicture(bytes).fileName, 'trial-7day-review.png')
    const odd = Buffer.from(bytes)
    odd.writeUInt32BE(1000, 16)
    assert.throws(() => reviewPicture(odd), /not one of the iPhone screenshot sizes Apple takes/)
    const clear = Buffer.from(bytes)
    clear[25] = 6
    assert.throws(() => reviewPicture(clear), /transparency/)
    assert.throws(() => reviewPicture(Buffer.from('not a picture at all, not at all')), /is not a PNG/)
  })

  test('trial: the App Store item is made once, part by part, finished by the next run when one stops, and sent for review only when asked', async () => {
    const { run: makeItem, client, trialItem, reviewPicture, SCREENSHOT, FULL_PRODUCT_ID, READY_WAIT_MS, READY_LOOK_MS } = await import('../scripts/iap-trial.mjs')
    const { APPLE } = await import('../shared/stores.mjs')
    const item = trialItem(read('docs/app-store.md'))
    const picture = reviewPicture(readFileSync(new URL(`../${SCREENSHOT}`, import.meta.url)))

    /*
     * A pretend App Store Connect: what is there, and every request it is
     * sent. Anything it does not know is refused. Like Apple, it processes
     * the picture after the upload: UPLOAD_COMPLETE first, COMPLETE a few
     * looks later, and the item says MISSING_METADATA until then.
     */
    const pretend = ({ full = { state: 'APPROVED', inAppPurchaseType: 'NON_CONSUMABLE' }, failUpload = 0, processLooks = 2 } = {}) => {
      const apple = {
        items: [{ id: 'full1', type: 'inAppPurchases', attributes: { productId: FULL_PRODUCT_ID, name: 'Full Version', ...full } }],
        locales: [],
        schedule: null,
        availability: null,
        shot: null,
        uploaded: [],
        sent: [],
        failUpload,
        looks: 0
      }
      const answer = (status, body) => ({ ok: status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) })
      const trialOf = () => apple.items.find((x) => x.attributes.productId === TRIAL_PRODUCT_ID)
      const settle = () => {
        const t = trialOf()
        if (apple.shot?.state === 'UPLOAD_COMPLETE' && ++apple.looks >= processLooks) apple.shot.state = 'COMPLETE'
        if (t && t.attributes.state === 'MISSING_METADATA' && apple.locales.length && apple.schedule && apple.availability && apple.shot?.state === 'COMPLETE') t.attributes.state = 'READY_TO_SUBMIT'
      }
      const fetch = async (url, init = {}) => {
        const method = init.method ?? 'GET'
        if (url.startsWith('https://upload.example/')) {
          assert.equal(method, 'PUT')
          assert.equal(init.headers['Content-Type'], 'image/png', 'the upload drops the headers Apple asked for')
          if (apple.failUpload > 0) {
            apple.failUpload -= 1
            return answer(500, { error: 'busy' })
          }
          apple.uploaded.push(Buffer.from(init.body))
          return answer(200)
        }
        const path = url.replace('https://api.appstoreconnect.apple.com', '')
        assert.match(init.headers.Authorization, /^Bearer /)
        assert.equal(init.headers.Accept, 'application/json', 'the price points may answer CSV')
        const body = init.body ? JSON.parse(init.body) : null
        apple.sent.push({ method, path, body })
        const t = trialOf()
        switch (`${method} ${path.split('?')[0]}`) {
          case `GET /v1/apps/${APPLE.id}/inAppPurchasesV2`:
            return answer(200, { data: apple.items, links: {} })
          case 'POST /v2/inAppPurchases': {
            const made = { id: 't1', type: 'inAppPurchases', attributes: { ...body.data.attributes, state: 'MISSING_METADATA' } }
            apple.items.push(made)
            return answer(201, { data: made })
          }
          case 'PATCH /v2/inAppPurchases/t1':
            Object.assign(t.attributes, body.data.attributes)
            return answer(200, { data: t })
          case 'GET /v2/inAppPurchases/t1':
            settle()
            return answer(200, { data: t })
          case 'GET /v2/inAppPurchases/t1/inAppPurchaseLocalizations':
            return answer(200, { data: apple.locales, links: {} })
          case 'POST /v1/inAppPurchaseLocalizations': {
            const made = { id: 'l1', type: 'inAppPurchaseLocalizations', attributes: body.data.attributes }
            apple.locales.push(made)
            return answer(201, { data: made })
          }
          case 'PATCH /v1/inAppPurchaseLocalizations/l1':
            Object.assign(apple.locales[0].attributes, body.data.attributes)
            return answer(200, { data: apple.locales[0] })
          case 'GET /v2/inAppPurchases/t1/iapPriceSchedule':
            return apple.schedule ? answer(200, apple.schedule) : answer(404, { errors: [{ status: '404' }] })
          case 'GET /v2/inAppPurchases/t1/pricePoints':
            /* Two pages, the free one on the second, so a run that reads only the first finds no free price. */
            return path.includes('cursor=2')
              ? answer(200, { data: [{ id: 'pp-free', attributes: { customerPrice: '0.0' } }], links: {} })
              : answer(200, {
                  data: [{ id: 'pp-099', attributes: { customerPrice: '0.99' } }],
                  links: { next: `https://api.appstoreconnect.apple.com/v2/inAppPurchases/t1/pricePoints?filter[territory]=USA&limit=200&cursor=2` }
                })
          case 'POST /v1/inAppPurchasePriceSchedules':
            apple.schedule = { data: { id: 's', relationships: { manualPrices: { data: body.data.relationships.manualPrices.data } } }, included: body.included }
            return answer(201, apple.schedule)
          case 'GET /v2/inAppPurchases/full1/inAppPurchaseAvailability':
            return answer(200, { data: { id: 'av-full', attributes: { availableInNewTerritories: false } } })
          case 'GET /v1/inAppPurchaseAvailabilities/av-full/availableTerritories':
            return answer(200, { data: [{ id: 'USA' }, { id: 'CAN' }, { id: 'GBR' }], links: {} })
          case 'GET /v2/inAppPurchases/t1/inAppPurchaseAvailability':
            return apple.availability ? answer(200, { data: apple.availability }) : answer(404, { errors: [{ status: '404' }] })
          case 'POST /v1/inAppPurchaseAvailabilities':
            apple.availability = { id: 'av1', ...body.data }
            return answer(201, { data: apple.availability })
          case 'GET /v2/inAppPurchases/t1/appStoreReviewScreenshot':
            return apple.shot ? answer(200, { data: { id: apple.shot.id, attributes: { assetDeliveryState: { state: apple.shot.state } } } }) : answer(404, { errors: [] })
          case 'POST /v1/inAppPurchaseAppStoreReviewScreenshots': {
            assert.equal(apple.shot, null, 'a second review picture was reserved over the first')
            const sid = `shot${apple.sent.filter((r) => r.method === 'POST' && r.path === '/v1/inAppPurchaseAppStoreReviewScreenshots').length}`
            apple.shot = { id: sid, ...body.data.attributes, state: 'AWAITING_UPLOAD' }
            apple.uploaded = []
            const half = Math.floor(picture.fileSize / 2)
            const ops = [
              { method: 'PUT', url: 'https://upload.example/1', offset: 0, length: half, requestHeaders: [{ name: 'Content-Type', value: 'image/png' }] },
              { method: 'PUT', url: 'https://upload.example/2', offset: half, length: picture.fileSize - half, requestHeaders: [{ name: 'Content-Type', value: 'image/png' }] }
            ]
            return answer(201, { data: { id: sid, attributes: { uploadOperations: ops } } })
          }
          default: {
            const shotPath = path.match(/^\/v1\/inAppPurchaseAppStoreReviewScreenshots\/(shot\d+)$/)
            if (shotPath && apple.shot?.id === shotPath[1] && method === 'PATCH') {
              apple.shot.state = body.data.attributes.uploaded ? 'UPLOAD_COMPLETE' : apple.shot.state
              apple.shot.checksum = body.data.attributes.sourceFileChecksum
              return answer(200, { data: { id: apple.shot.id } })
            }
            if (shotPath && apple.shot?.id === shotPath[1] && method === 'DELETE') {
              apple.shot = null
              return answer(204)
            }
            if (method === 'POST' && path === '/v1/inAppPurchaseSubmissions') {
              t.attributes.state = 'WAITING_FOR_REVIEW'
              return answer(201, { data: { id: 'sub1' } })
            }
            throw new Error(`the pretend App Store Connect does not know ${method} ${path}`)
          }
        }
      }
      const waited = []
      const asc = client({ jwt: 'x.y.z', fetch, wait: async (ms) => waited.push(ms) })
      const writes = () => apple.sent.filter((r) => r.method !== 'GET')
      return { apple, asc, waited, writes }
    }
    const quiet = () => {}

    /* Unticked: it reads, and nothing is written. */
    const a = pretend()
    const looked = await makeItem({ asc: a.asc, item, picture, log: quiet })
    assert.equal(looked.made, false)
    assert.deepEqual(a.writes(), [], 'a run with nothing ticked changed App Store Connect')

    /* Make it: every part, as Apple wants it, and not sent for review. */
    const made = await makeItem({ asc: a.asc, item, picture, apply: true, log: quiet })
    assert.equal(made.state, 'MISSING_METADATA', 'Make it waited for the picture to be processed, which only sending needs')
    const created = a.writes().find((r) => r.path === '/v2/inAppPurchases').body.data
    assert.equal(created.attributes.inAppPurchaseType, 'NON_CONSUMABLE')
    assert.equal(created.attributes.productId, TRIAL_PRODUCT_ID)
    assert.equal(created.attributes.name, '7-day Trial')
    assert.equal(created.attributes.familySharable, false)
    assert.equal(created.attributes.reviewNote, item.reviewNote)
    assert.deepEqual(created.relationships.app.data, { type: 'apps', id: APPLE.id })
    assert.deepEqual(a.apple.locales[0].attributes, { locale: 'en-US', name: '7-day Trial', description: item.description })
    const price = a.writes().find((r) => r.path === '/v1/inAppPurchasePriceSchedules').body
    assert.deepEqual(price.data.relationships.baseTerritory.data, { type: 'territories', id: 'USA' })
    assert.equal(price.data.relationships.manualPrices.data[0].id, price.included[0].id, 'the price schedule points at a price it does not include')
    assert.deepEqual(price.included[0].relationships.inAppPurchasePricePoint.data, { type: 'inAppPurchasePricePoints', id: 'pp-free' }, 'the trial is not priced Free')
    assert.deepEqual(a.apple.availability.relationships.availableTerritories.data.map((x) => x.id), ['USA', 'CAN', 'GBR'], 'the trial is not sold where the full version is')
    assert.equal(a.apple.availability.attributes.availableInNewTerritories, false, 'the trial goes to new countries the full version does not')
    assert.deepEqual(Buffer.concat(a.apple.uploaded), picture.bytes, 'the review picture arrived in pieces that do not make the file')
    assert.equal(a.apple.shot.checksum, picture.checksum)
    assert.equal(a.apple.shot.fileSize, picture.fileSize)
    assert.ok(!a.writes().some((r) => r.path === '/v1/inAppPurchaseSubmissions'), 'Make it sent the item for review')

    /* Again: nothing written. A whole item is left alone. */
    const before = a.writes().length
    await makeItem({ asc: a.asc, item, picture, apply: true, log: quiet })
    assert.equal(a.writes().length, before, 'a second run changed what the first made')

    /* Send for review: it waits for Apple to finish with the picture, then sends, once. */
    const sent = await makeItem({ asc: a.asc, item, picture, submit: true, log: quiet })
    assert.equal(sent.submitted, true)
    assert.equal(sent.state, 'WAITING_FOR_REVIEW')
    await makeItem({ asc: a.asc, item, picture, submit: true, log: quiet })
    assert.equal(a.writes().filter((r) => r.path === '/v1/inAppPurchaseSubmissions').length, 1, 'the item was sent for review twice')

    /* And an item already with Apple is never edited under it, even if the notes moved. */
    const edits = a.writes().length
    await makeItem({ asc: a.asc, item: { ...item, description: 'Changed in the notes after it went in.' }, picture, apply: true, log: quiet })
    assert.equal(a.writes().length, edits, 'the item’s words were changed while Apple has it')

    /* A picture whose upload fails: its reservation is taken back, and the next run makes it from nothing. */
    const b = pretend({ failUpload: 1 })
    await assert.rejects(makeItem({ asc: b.asc, item, picture, apply: true, log: quiet }), /uploading the review picture answered 500/)
    assert.equal(b.apple.shot, null, 'a failed upload left its reservation behind, which no later run would fill')
    await makeItem({ asc: b.asc, item, picture, apply: true, log: quiet })
    assert.ok(['UPLOAD_COMPLETE', 'COMPLETE'].includes(b.apple.shot.state), 'the next run did not make the picture again')
    assert.deepEqual(Buffer.concat(b.apple.uploaded), picture.bytes)

    /* A reservation a stopped run left unfilled is replaced, never "there already". */
    const c = pretend()
    await makeItem({ asc: c.asc, item, picture, apply: true, log: quiet })
    c.apple.shot.state = 'AWAITING_UPLOAD'
    const stale = c.apple.shot.id
    await makeItem({ asc: c.asc, item, picture, apply: true, log: quiet })
    assert.ok(c.writes().some((r) => r.method === 'DELETE' && r.path === `/v1/inAppPurchaseAppStoreReviewScreenshots/${stale}`), 'an unfilled reservation was left alone for good')
    assert.ok(['UPLOAD_COMPLETE', 'COMPLETE'].includes(c.apple.shot.state), 'the unfilled reservation was not made again')

    /* Sent the moment it is made: it waits, at most READY_WAIT_MS, for the picture to be processed. */
    const d = pretend({ processLooks: 3 })
    const straight = await makeItem({ asc: d.asc, item, picture, submit: true, log: quiet })
    assert.equal(straight.state, 'WAITING_FOR_REVIEW')
    assert.ok(d.waited.length >= 1 && d.waited.every((ms) => ms === READY_LOOK_MS), 'sending did not wait for Apple to process the picture')
    const e = pretend({ processLooks: 1e9 })
    await assert.rejects(makeItem({ asc: e.asc, item, picture, submit: true, log: quiet }), /MISSING_METADATA after 4 minutes/)
    assert.equal(e.waited.length, READY_WAIT_MS / READY_LOOK_MS, 'it waited longer, or shorter, than it says')
    assert.ok(!e.writes().some((r) => r.path === '/v1/inAppPurchaseSubmissions'))

    /* On its own only with an approved Non-Consumable before it (App Store Connect Help, "Submit an In-App Purchase"). */
    const f = pretend({ full: { state: 'WAITING_FOR_REVIEW', inAppPurchaseType: 'NON_CONSUMABLE' } })
    await assert.rejects(makeItem({ asc: f.asc, item, picture, submit: true, log: quiet }), /Attach it to the next app version instead/)
    assert.ok(!f.writes().some((r) => r.path === '/v1/inAppPurchaseSubmissions'))

    /* Only what differs is changed; and Family Sharing switched on by hand is said, never fought on every run. */
    const g = pretend()
    await makeItem({ asc: g.asc, item, picture, apply: true, log: quiet })
    g.apple.items.find((x) => x.id === 't1').attributes.reviewNote = 'old notes'
    await makeItem({ asc: g.asc, item, picture, apply: true, log: quiet })
    const patch = g.writes().filter((r) => r.method === 'PATCH' && r.path === '/v2/inAppPurchases/t1')
    assert.equal(patch.length, 1)
    assert.deepEqual(patch[0].body.data.attributes, { reviewNote: item.reviewNote }, 'the PATCH sent more than what differs')
    g.apple.items.find((x) => x.id === 't1').attributes.familySharable = true
    await assert.rejects(makeItem({ asc: g.asc, item, picture, apply: true, log: quiet }), /Apple never lets it be switched off again/)
  })

  test('trial: the App Store item’s job only reads unless a box is ticked, and the key never outlives it', () => {
    const job = read('.github/workflows/iap-trial.yml')
    assert.match(job, /workflow_dispatch:/)
    assert.doesNotMatch(job, /^\s*(push|pull_request|schedule):/m, 'the App Store item job runs by itself')
    assert.match(job, /else node scripts\/iap-trial\.mjs\n/, 'unticked, the job does more than read')
    assert.match(job, /if \[ "\$SUBMIT" = "true" \]; then node scripts\/iap-trial\.mjs --submit/)
    assert.match(job, /if: always\(\)\n\s+run: rm -f "\$RUNNER_TEMP\/asc\.p8"/, 'the Apple key is left on the runner')
    for (const secret of ['ASC_KEY_P8', 'ASC_KEY_ID', 'ASC_ISSUER_ID']) assert.ok(job.includes(`secrets.${secret}`), `the job does not use the builds' ${secret}`)
    assert.doesNotMatch(job, /GOOGLE_PLAY|REVENUECAT|SUPABASE/, 'the App Store item job is handed a key it has no use for')
  })
}
