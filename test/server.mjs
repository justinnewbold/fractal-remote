/**
 * The functions that run on a server, and the three ways this one can be
 * badly wrong without looking it.
 *
 * Nothing in supabase/functions was tested before this. They had got away with
 * it: both of the others send email, and email that does not arrive gets
 * reported by the person waiting for it. `entitlement` is different. It decides
 * whether somebody who paid gets to drive their rig from a computer, and every
 * way it can fail is silent — a wrong answer looks exactly like a right one to
 * everybody except the person locked out of a thing they bought.
 *
 * Read as text rather than imported: it is Deno TypeScript, which node will not
 * load, and standing up a Deno runtime to check three properties would be a
 * heavier answer than the question deserves. The properties are the point.
 *
 * Except grant-access's Confirm now, at the bottom, which is run: node strips
 * TypeScript's types itself now (22.18 on; CI runs 24), and a lock is worth
 * more tried than read.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/* THE BUILD LEDGER, a build at a time: docs/expo-builds.md's rows, read the one way test/bluetooth.mjs reads them too. */
import { ledgerBuilds, withoutOpening } from './ledger.mjs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/* Comments quote the traps by name, so every check below reads the code with
   the prose taken out. This repository has failed on its own explanation
   seven times; that is enough times to make it the default here. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

/*
 * GRANT-ACCESS, RUN. The function loaded as it is, with Deno's two calls
 * stood in for and a fetch that answers as Supabase would: who a token
 * belongs to, what account_details finds, whether the address is on the
 * waiting list (`waiting`, or 'fail' for a refusal), and the Auth admin call.
 * RevenueCat answers as it does for a customer who has bought nothing, which
 * is what a Check needs. Anything else it asks for is a 500, so a request
 * nobody expected shows up as one.
 */
const RC_PROJECT = 'https://api.revenuecat.com/v2/projects/proj827190e9'
const ADMIN = '7dfe6912-e43b-49bf-84e4-b56afbd442b1'
const STRANGER = '00000000-0000-4000-8000-000000000000'
const CUSTOMER = '11111111-2222-4333-8444-555555555555'
const PROJECT = 'https://project.test'
const SERVICE = 'the-service-role-key'
const ENV = { SUPABASE_URL: PROJECT, SUPABASE_ANON_KEY: 'the-anon-key', SUPABASE_SERVICE_ROLE_KEY: SERVICE, REVENUECAT_SECRET: 'rc' }
let grantHandler = null

async function grantAccess({ token, body, account = null, refuse = 0, waiting = false, rpcs = {}, purchases = {}, setup = null, users = null }) {
  const calls = []
  const logged = []
  const was = { fetch: globalThis.fetch, Deno: globalThis.Deno, log: console.log, error: console.error }
  const answer = (status, value) => new Response(value === undefined ? '' : JSON.stringify(value), { status })
  globalThis.Deno = { serve: (h) => (grantHandler = h), env: { get: (name) => ENV[name] } }
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null }
    calls.push(call)
    if (call.url === `${PROJECT}/auth/v1/user`) {
      const who = { 'Bearer his-token': ADMIN, 'Bearer a-strangers-token': STRANGER }[call.headers.Authorization]
      return who ? answer(200, { id: who, email: 'someone@example.com' }) : answer(401, { msg: 'JWT expired' })
    }
    /* Database functions a test answers itself (the setup emails' ones), each by name. */
    const named = call.url.startsWith(`${PROJECT}/rest/v1/rpc/`) ? call.url.slice(`${PROJECT}/rest/v1/rpc/`.length) : null
    if (named && named in rpcs) return answer(200, typeof rpcs[named] === 'function' ? rpcs[named](call.body) : rpcs[named])
    if (call.url === `${PROJECT}/rest/v1/rpc/account_details`) return answer(200, account)
    if (call.url === `${PROJECT}/rest/v1/rpc/is_waiting_grant`) return waiting === 'fail' ? answer(500, { msg: 'no' }) : answer(200, waiting)
    if (call.url === `${RC_PROJECT}/entitlements`) return answer(200, { items: [{ id: 'entl-full', lookup_key: 'full' }] })
    const bought = call.url.match(/\/customers\/([^/]+)\/purchases/)?.[1]
    if (bought && decodeURIComponent(bought) in purchases) {
      const items = purchases[decodeURIComponent(bought)]
      return items === 'fail' ? answer(500, { message: 'RevenueCat is having a bad minute' }) : answer(200, { items })
    }
    if (call.url.startsWith(`${RC_PROJECT}/customers/`)) return answer(200, call.url.endsWith(account?.id || '-') ? { id: account.id } : { items: [] })
    if (call.url === `${PROJECT}/functions/v1/setup-reminder` && setup) return answer(setup.status, setup.body)
    /* The account service's list of accounts, for Sales' never-confirmed ones: `users`, one page. */
    if (call.url.startsWith(`${PROJECT}/auth/v1/admin/users?`) && users) return answer(200, { users })
    if (call.url.startsWith(`${PROJECT}/auth/v1/admin/users/`)) {
      return refuse ? answer(refuse, { msg: 'no' }) : answer(200, { id: CUSTOMER, email_confirmed_at: '2026-10-11T12:00:00Z' })
    }
    return answer(500, { msg: `nothing answers ${call.url} here` })
  }
  console.log = (...a) => logged.push(a.join(' '))
  console.error = (...a) => logged.push(a.join(' '))
  try {
    if (!grantHandler) await import(new URL('../supabase/functions/grant-access/index.ts', import.meta.url).href)
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    const res = await grantHandler(new Request('https://functions.test/grant-access', { method: 'POST', headers, body: JSON.stringify(body) }))
    return { status: res.status, said: await res.json(), calls, logged }
  } finally {
    globalThis.fetch = was.fetch
    globalThis.Deno = was.Deno
    console.log = was.log
    console.error = was.error
  }
}

/*
 * SETUP-REMINDER, RUN. A fresh copy of the function for every run (the query
 * on its address makes Node load it anew, so the secret it keeps between
 * calls starts empty each time), with Deno stood in for and a fetch that
 * answers as the database and Resend would:
 *
 *   secret    what setup_reminder_hook_secret() gives, or 'fail'
 *   given     the x-hook-secret the caller sends
 *   token     a bearer token instead (the service key, for the sample)
 *   sending   the switch
 *   resendKey RESEND_API_KEY, '' for none
 *   due       what setup_reminders_due() answers
 *   claim     (body) => what claim_setup_reminder() answers
 *   resend    (payload) => the status Resend answers, or 'throw' for none
 *
 * Every call is kept, and every line logged.
 */
const SETUP_URL = new URL('../supabase/functions/setup-reminder/index.ts', import.meta.url).href
const HOOK = 'the-hook-secret'
let setupRuns = 0

async function setupReminder({ secret = HOOK, given = HOOK, token = null, sending = false, resendKey = 're_key', due = [], claim = () => true, resend = () => 200, body = {} } = {}) {
  const calls = []
  const logged = []
  const was = { fetch: globalThis.fetch, Deno: globalThis.Deno, log: console.log, error: console.error, setTimeout: globalThis.setTimeout }
  const env = { SUPABASE_URL: PROJECT, SUPABASE_SERVICE_ROLE_KEY: SERVICE, RESEND_API_KEY: resendKey }
  const answer = (status, value) => new Response(value === undefined ? '' : JSON.stringify(value), { status })
  let handler = null
  globalThis.Deno = { serve: (h) => (handler = h), env: { get: (name) => env[name] || undefined } }
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null }
    calls.push(call)
    const rpc = call.url.startsWith(`${PROJECT}/rest/v1/rpc/`) ? call.url.slice(`${PROJECT}/rest/v1/rpc/`.length) : null
    if (rpc === 'setup_reminder_hook_secret') return secret === 'fail' ? answer(500, { msg: 'no' }) : answer(200, secret)
    if (rpc === 'setup_reminder_sending') return answer(200, sending)
    if (rpc === 'setup_reminders_due') return answer(200, due)
    if (rpc === 'claim_setup_reminder') return answer(200, claim(call.body))
    if (rpc === 'note_setup_reminder_failed') return answer(204)
    if (rpc === 'release_setup_reminder') return answer(204)
    if (call.url === 'https://api.resend.com/emails') {
      /*
       * A status alone, or Resend's own refusal as { status, name, message }
       * (raw: a body that is not JSON at all). A message can quote the
       * address, as Resend's can, so the tests can see it is never repeated.
       */
      const said = resend(call.body)
      const { status, raw, ...refusal } = said && typeof said === 'object' ? said : { status: said }
      /* 'throw' is no answer at all: the connection dropped, or it timed out. */
      if (status === 'throw') throw new TypeError('error sending request')
      if (status < 300) return answer(status, { id: 'em_1' })
      if (typeof raw === 'string') return new Response(raw, { status })
      return answer(status, Object.keys(refusal).length ? { statusCode: status, ...refusal } : { message: `cannot send to ${call.body?.to?.[0]}` })
    }
    return answer(500, { msg: `nothing answers ${call.url} here` })
  }
  /* No real waiting between emails. */
  globalThis.setTimeout = (fn) => (fn(), 0)
  console.log = (...a) => logged.push(a.join(' '))
  console.error = (...a) => logged.push(a.join(' '))
  try {
    await import(`${SETUP_URL}?run=${++setupRuns}`)
    const headers = { 'Content-Type': 'application/json', ...(given ? { 'x-hook-secret': given } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    const res = await handler(new Request('https://functions.test/setup-reminder', { method: 'POST', headers, body: JSON.stringify(body) }))
    const text = await res.text()
    let said = null
    try {
      said = text ? JSON.parse(text) : null
    } catch {
      /* "No", the refusal, is not JSON */
    }
    return { status: res.status, text, said, calls, logged, sent: calls.filter((c) => c.url === 'https://api.resend.com/emails').map((c) => c.body) }
  } finally {
    globalThis.fetch = was.fetch
    globalThis.Deno = was.Deno
    globalThis.setTimeout = was.setTimeout
    console.log = was.log
    console.error = was.error
  }
}

/* The setup emails' migration, comments out and whitespace flattened, as the SQL tests read it. */
const SETUP_SQL = 'supabase/migrations/20261015_setup_reminders.sql'
const SETUP_SCHEDULE = 'supabase/migrations/20261015_setup_reminders_schedule.sql'
const sqlOf = (p) => read(p).replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim()
/* One function's body, between its `as $$` and the `$$;` that closes it. */
const fnBody = (sql, name) => {
  const at = sql.indexOf(`create or replace function public.${name}(`)
  assert.ok(at >= 0, `the migration has no ${name}`)
  const open = sql.indexOf('as $$', at)
  return { head: sql.slice(at, open), body: sql.slice(open + 5, sql.indexOf('$$;', open)).trim() }
}

export function run(test) {
  test('who is asking is never the caller’s word', () => {
    /*
     * THE ONE THAT WOULD GIVE THE APP AWAY.
     *
     * The account id is what RevenueCat is asked about. If it came out of the
     * request body, anybody could type somebody else's id and be told yes —
     * and the ids are UUIDs that appear in ordinary traffic, not secrets. The
     * whole reason this check is on a server rather than in the page is that
     * the answer must not be the client's to choose.
     *
     * So the id comes out of a token, and the token is verified by Supabase
     * rather than decoded here. A JWT's middle segment is base64, not a
     * signature: reading `sub` out of it is reading the attacker's own claim
     * about who they are.
     */
    const src = code(read('supabase/functions/entitlement/index.ts'))
    assert.match(src, /auth\/v1\/user/, 'the token is not checked with Supabase')
    assert.match(src, /accountFrom\(token\)/, 'the account id does not come from the token')
    assert.ok(
      !/req\.json\(\)/.test(src),
      'the function reads the request body; the account id must never come from there'
    )
    assert.ok(
      !/atob|JSON\.parse\(.*split\('\.'\)|decodeJwt/.test(src),
      'the token is being decoded rather than verified, so a forged one would pass'
    )
  })

  test('an entitlement is recognised under either of its two names', () => {
    /*
     * THE ONE THAT WOULD LOCK OUT EVERYBODY WHO PAID.
     *
     * A RevenueCat entitlement has an `id` (entl…) and a `lookup_key` (`full`),
     * and the active-entitlements list reports one field called
     * `entitlement_id`. Which of the two names lands in it cannot be settled by
     * asking about a customer who has bought nothing — the list comes back
     * empty either way, and an empty list says nothing about the shape of a
     * full one.
     *
     * Match the wrong one and the gate tells a paying customer they have not
     * paid, for ever, with nothing on fire and nothing in a log. So both names
     * are accepted, and the id is read from the project rather than typed in.
     */
    const src = code(read('supabase/functions/entitlement/index.ts'))
    assert.match(src, /const ENTITLEMENT = 'full'/, 'the entitlement is not named')
    assert.match(src, /lookup_key === ENTITLEMENT/, 'the id is not resolved from the lookup key')
    assert.match(src, /names\.add\(String\(e\.id\)\)/, 'the entitlement’s own id is not accepted')
    assert.match(src, /names\.has\(String\(e\.entitlement_id\)\)/, 'the answer is not matched against both names')
    assert.ok(
      !/entitlement_id === ENTITLEMENT/.test(src),
      'only the lookup key is matched, so an id-shaped answer reads as unpaid'
    )
    /* And the id is never hardcoded: it is this project's today and would be
       a different string in any project rebuilt from scratch. */
    assert.ok(!/'entl[0-9a-f]+'/.test(src), 'an entitlement id is typed into the source')
  })

  test('a question that could not be asked is not a no', () => {
    /*
     * THE ONE THAT WOULD LOCK OUT EVERYBODY, FULL STOP.
     *
     * RevenueCat having a bad minute, a key rotated, a network that went away:
     * none of it is evidence that somebody did not pay. Treating it as a no
     * turns a third party's outage into every customer losing their rig.
     *
     * The phone follows this rule already — mobile/src/lib/unlock-rule fails
     * open for the same reason — and the two ends disagreeing about it would
     * be worse than either answer.
     */
    const src = code(read('supabase/functions/entitlement/index.ts'))
    assert.match(src, /Promise<boolean \| null>/, 'the check cannot say that it does not know')
    assert.match(src, /if \(answer === null\) return json\(\{ unlocked: true, unknown: true \}\)/, 'an unanswerable question locks the app')
    /* A customer RevenueCat has never heard of is a real no, not an outage:
       that is almost everybody, and it must not read as unknown. */
    assert.match(src, /if \(res\.status === 404\) return false/, 'a customer who never bought anything reads as an outage')
  })

  test('the entitlement the server checks is the one the phone checks', () => {
    /*
     * Two ends, one word. The phone reads `full` out of its own constant and
     * this reads `full` out of its own, and if the two ever part company the
     * computer would say unpaid about a purchase the phone had just made.
     */
    const server = code(read('supabase/functions/entitlement/index.ts'))
    const phone = code(read('mobile/src/lib/purchases.js'))
    const of = (src, name) => (src.match(new RegExp(`${name} = '([^']+)'`)) || [])[1]
    assert.equal(
      of(server, 'ENTITLEMENT'),
      of(phone, 'ENTITLEMENT'),
      'the server and the phone are asking about different entitlements'
    )
  })

  test('the server’s owner list is the phone’s owner list', async () => {
    /*
     * shared/owner-unlock.mjs cannot be imported into a Deno function on
     * Supabase, so `entitlement` carries a copy. A copy that drifted would
     * unlock an owner on the phone and lock them out of the relay — the
     * phone saying yes and the rig saying nothing, with no way to tell why.
     */
    const { OWNERS } = await import('../shared/owner-unlock.mjs')
    const src = code(read('supabase/functions/entitlement/index.ts'))
    const copied = JSON.parse((src.match(/const OWNERS(?:: string\[\])? = (\[[^\]]*\])/) || [])[1]?.replace(/'/g, '"') || 'null')
    assert.deepEqual(copied, OWNERS, 'the server and the phone disagree about who is an owner')
    /*
     * And by the signed account's id, never by its address. The list was once
     * an eight-character hash of an email, which a made-up address could match
     * in a second and so sign itself up into a free, sticky unlock.
     */
    assert.ok(!/\bfold\(|5381|OWNERS\.includes\([^)]*email/.test(src), 'the server decides who is an owner from the email address again')
  })

  test('only a definite answer is ever written down', () => {
    /*
     * `entitlement` fails OPEN for the screen — a store that cannot be
     * reached is not evidence somebody did not pay. That is right for a
     * phone on a stage and would be a disaster in the table: writing
     * "active" during an outage hands the relay to whoever asked, for ever.
     */
    const src = code(read('supabase/functions/entitlement/index.ts'))
    const handler = src.slice(src.indexOf('Deno.serve'))
    const unknown = handler.indexOf('if (answer === null) return json({ unlocked: true, unknown: true })')
    const written = handler.indexOf("await record(account, answer, 'revenuecat')")
    assert.ok(unknown > 0 && written > 0, 'the handler moved; this check reads it')
    assert.ok(unknown < written, 'the table is written before the unreachable case has returned')
    /* The owner check comes before RevenueCat is asked at all. */
    assert.ok(handler.indexOf('OWNERS.includes(who.id)') < handler.indexOf('await owns(account)'), 'an owner is asked about as a customer first')
  })

  test('the webhook trusts nobody without the secret, and reads nothing into the event', () => {
    const src = code(read('supabase/functions/revenuecat-webhook/index.ts'))
    /* No secret configured is a refusal, not an open door. */
    assert.match(src, /if \(!expected \|\| !same\(/, 'a webhook with no secret configured accepts anybody')
    assert.match(src, /diff \|= a\.charCodeAt\(i\) \^ b\.charCodeAt\(i\)/, 'the secret is compared in a way that leaks how close a guess was')
    /*
     * THE EVENT IS A DOORBELL. Twenty-one types, and most of the ways to get
     * this wrong are in reading them — a CANCELLATION is a refund for one
     * product and a lapse for another. So the only type it ever branches on
     * is TEST; everything else is "go and ask RevenueCat who has paid now".
     */
    const types = [...src.matchAll(/event\.type === '([A-Z_]+)'/g)].map((m) => m[1])
    assert.deepEqual(types, ['TEST'], 'the webhook has started interpreting event types')
    assert.match(src, /const answer = await owns\(id, project, key\)/, 'the webhook writes what the event says rather than what RevenueCat says now')
    /* Only account ids are written; a handset id names nobody. */
    assert.match(src, /\.filter\(\(id\) => ACCOUNT\.test\(id\)\)/, 'anonymous handset ids are being written as accounts')
    /* A failure is reported as one, which is how RevenueCat knows to retry. */
    assert.match(src, /failed \? 500 : 200/, 'a failed write is acknowledged and lost')
  })

  test('the webhook recognises the entitlement by both names, as the check does', () => {
    /*
     * The trap from the last round, in its second home. RevenueCat reported
     * this project's entitlement as entl… rather than `full`. The webhook
     * matching only the key would turn every purchase and every refund into
     * nothing.
     */
    const hook = code(read('supabase/functions/revenuecat-webhook/index.ts'))
    const check = code(read('supabase/functions/entitlement/index.ts'))
    for (const [where, src] of [['webhook', hook], ['entitlement', check]]) {
      assert.match(src, /lookup_key === ENTITLEMENT/, `${where} does not resolve the id from the lookup key`)
      assert.match(src, /names\.has\(String\(e\.entitlement_id\)\)/, `${where} does not accept both names`)
      assert.match(src, /const ENTITLEMENT = 'full'/, `${where} asks about a different entitlement`)
    }
  })

  test('nobody but the server can write who has paid', () => {
    const sql = read('supabase/migrations/20260923_entitlements.sql')
    /* The write path is service_role only; a client that could call it could
       unlock itself. */
    assert.match(sql, /revoke all on function public\.record_entitlement\(uuid, boolean, text\) from public, anon, authenticated;/, 'a client can write its own entitlement')
    assert.ok(!/grant[^;]*record_entitlement[^;]*authenticated/i.test(sql), 'record_entitlement is granted to signed-in users')
    /* The table has a read policy and no write policy at all. */
    assert.match(sql, /create policy "own entitlement: read"\s+on public\.entitlements for select/, 'somebody cannot see their own row')
    assert.ok(!/on public\.entitlements for (insert|update|delete|all)/i.test(sql), 'a client can write to the entitlements table')
    /* Security definer functions pin their search path, or the caller can
       redirect every name inside them. */
    for (const fn of ['is_entitled', 'record_entitlement']) {
      const body = sql.slice(sql.indexOf(`function public.${fn}`), sql.indexOf('$$;', sql.indexOf(`function public.${fn}`)))
      assert.match(body, /security definer/, `${fn} is not security definer`)
      assert.match(body, /set search_path = public, pg_temp/, `${fn} resolves names through the caller’s path`)
    }
    /* A sale's "no" never overwrites an owner. */
    assert.match(sql, /where e\.source <> 'owner' or excluded\.source = 'owner'/, 'a refund can revoke an owner')
  })

  test('the switch adds one condition to the relay and nothing else', () => {
    /*
     * The migration that decides who can use the relay. It replaces the two
     * existing rules — your own channel only — with the same two rules plus
     * "and has paid". If it ever widened a rule instead, the gate would be a
     * hole with a lock drawn on it.
     */
    const sql = read('supabase/migrations/20260923_relay_needs_a_purchase.sql')
    const live = sql.slice(0, sql.indexOf('-- UNDO'))
    for (const [name, clause] of [['own remote channel: read', 'using'], ['own remote channel: write', 'with check']]) {
      const at = live.indexOf(`create policy "${name}"`)
      assert.ok(at > 0, `the switch no longer rewrites "${name}"`)
      const body = live.slice(at, live.indexOf(');', at))
      assert.match(body, new RegExp(`${clause} \\(`), `"${name}" lost its ${clause}`)
      assert.match(body, /realtime\.topic\(\) = \('remote:'::text \|\| \(auth\.uid\(\)\)::text\)/, `"${name}" no longer confines an account to its own channel`)
      assert.match(body, /and public\.is_entitled\(auth\.uid\(\)\)/, `"${name}" does not ask whether the account has paid`)
      assert.match(body, /to authenticated/, `"${name}" is open to signed-out callers`)
    }
    /* And the way back is written down beside it. */
    assert.match(sql, /-- UNDO/, 'the switch has no written way back')
  })

  test('the phone tells the relay at every moment the answer can change', () => {
    const purchases = read('mobile/src/lib/purchases.js')
    const pass = read('mobile/src/lib/relayPass.js')
    /* The session's token, never the anon key: the server reads who is asking
       out of it, which is why this cannot unlock somebody else. */
    assert.match(pass, /Authorization: `Bearer \$\{token\}`/, 'the relay pass is sent without the session, so it proves nothing')
    assert.match(pass, /const token = data\?\.session\?\.access_token/, 'the relay pass does not use the signed-in session')
    /* Linking (launch and sign-in), buying, restoring. */
    const link = purchases.slice(purchases.indexOf('const linkTo = async'), purchases.indexOf('const LINK_WAIT_MS'))
    assert.match(link, /await api\.logIn\(id\)[\s\S]*claimRelay\(\)/, 'linking an account does not tell the relay')
    const buy = purchases.slice(purchases.indexOf('export const buyUnlock'), purchases.indexOf('export const restorePurchase'))
    assert.match(buy, /if \(yes\) claimRelay\(\)/, 'buying does not open the relay')
    const restore = purchases.slice(purchases.indexOf('export const restorePurchase'))
    assert.match(restore, /if \(yes\) \{[\s\S]*?claimRelay\(\)\s*return \{ ok: true/, 'restoring does not open the relay')
  })

  test('Sales names a purchase on an account nobody ever confirmed, and a card sale beside it the same day', async () => {
    /*
     * A phone that paid before it had an account puts the purchase on the
     * account made on it, before its email is confirmed. Never confirmed —
     * a mistyped address, a confirmation that never came — nothing ever
     * signs in to it, so the relay's table has no row and Sales never asked.
     * If the same person then paid by card under the right address, each
     * account held one purchase and Paid twice could not see it.
     *
     * The function itself, run: its TypeScript stripped by esbuild (which
     * Vite already brings), Deno and the network stood in for.
     */
    const { transformSync } = await import('esbuild')
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { pathToFileURL } = await import('node:url')
    const src = read('supabase/functions/grant-access/index.ts')
    const admin = src.match(/const ADMINS = \['([0-9a-f-]{36})'\]/)?.[1]
    assert.ok(admin, 'the owner id moved; this test reads it')
    const dir = mkdtempSync(join(tmpdir(), 'grant-'))
    const DAY = 86400000
    const now = Date.now()
    const asked = []
    const users = [
      { id: 'acct-typo', email: 'typo@x.com', created_at: new Date(now - 2 * DAY).toISOString(), email_confirmed_at: null },
      { id: 'acct-right', email: 'right@x.com', created_at: new Date(now - 2 * DAY).toISOString(), email_confirmed_at: new Date(now - 2 * DAY).toISOString() },
      { id: 'acct-empty', email: 'empty@x.com', created_at: new Date(now - 3 * DAY).toISOString(), email_confirmed_at: null },
      /* Confirmed, and not on the buyers list: none of this section's business. */
      { id: 'acct-fine', email: 'fine@x.com', created_at: new Date(now - 3 * DAY).toISOString(), email_confirmed_at: new Date(now - 3 * DAY).toISOString() },
      { id: 'acct-old', email: 'old@x.com', created_at: new Date(now - 40 * DAY).toISOString(), email_confirmed_at: null }
    ]
    const bought = {
      'acct-right': [{ store: 'rc_billing', purchased_at: now - 2 * DAY + 3600000, environment: 'production', status: 'owned' }],
      'acct-typo': [{ store: 'app_store', purchased_at: now - 2 * DAY, environment: 'production', status: 'owned' }],
      'acct-empty': [],
      'acct-fine': [{ store: 'play_store', purchased_at: now - 3 * DAY, environment: 'production', status: 'owned' }]
    }
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    const realFetch = globalThis.fetch
    let handler = null
    globalThis.Deno = {
      env: { get: (k) => ({ SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon', REVENUECAT_SECRET: 'sk_test' })[k] },
      serve: (fn) => {
        handler = fn
      }
    }
    globalThis.fetch = async (url) => {
      const u = String(url)
      asked.push(u)
      if (u === 'https://sb.test/auth/v1/user') return reply({ id: admin, email: 'owner@x.com' })
      if (u === 'https://sb.test/rest/v1/rpc/owner_overview') return reply({ accounts: 4, buyers: [{ id: 'acct-right', email: 'right@x.com' }] })
      if (u.startsWith('https://sb.test/auth/v1/admin/users?page=1&')) return reply({ users })
      const who = u.match(/\/customers\/([^/]+)\/purchases/)?.[1]
      if (who) return reply({ items: bought[decodeURIComponent(who)] || [] })
      return reply({}, 404)
    }
    try {
      writeFileSync(join(dir, 'grant.mjs'), transformSync(src, { loader: 'ts', format: 'esm' }).code)
      await import(pathToFileURL(join(dir, 'grant.mjs')).href)
      assert.ok(handler, 'the function no longer starts with Deno.serve')
      const res = await handler(new Request('https://fn.test/', { method: 'POST', headers: { Authorization: 'Bearer owner-token' }, body: JSON.stringify({ action: 'sales' }) }))
      const answer = await res.json()
      assert.equal(answer.ok, true)
      assert.deepEqual(
        answer.unconfirmed,
        [{ email: 'typo@x.com', stores: ['app_store'], at: [now - 2 * DAY], count: 1, near: ['right@x.com'], nearCount: 1, until: now - 2 * DAY + 3600000 }],
        'a purchase on an account never confirmed is not named, or not beside the card sale that day'
      )
      assert.ok(answer.sales.some((s) => s.email === 'typo@x.com' && s.store === 'app_store'), 'the purchase on the unconfirmed account is not counted as a sale')
      assert.ok(!asked.some((u) => u.includes('/customers/acct-old/')), 'an unconfirmed account from over a month ago was asked about')
      assert.ok(!asked.some((u) => u.includes('/customers/acct-fine/')), 'a confirmed account was asked about as one never confirmed')
      assert.equal(asked.filter((u) => u.includes('/customers/acct-right/')).length, 1, 'a confirmed buyer was asked about twice')
      /* The old fields are all still there, for a phone too old to know the new one. */
      for (const field of ['accounts', 'unlocked', 'sales', 'twice', 'givenByHand', 'unanswered']) assert.ok(field in answer, `the answer lost ${field}`)

      /* And the page says it, in plain words, after the sales (15 October 2026: below them, not on top). */
      const { salesSections } = await import('../shared/admin.mjs')
      const sections = salesSections(answer, now)
      const quiet = sections.find((s) => s.title === 'Paid, account never confirmed')
      assert.ok(quiet && sections.indexOf(quiet) > sections.findIndex((s) => s.title === 'Latest sales'), 'Paid, account never confirmed is not below the sales')
      assert.equal(quiet.rows[0].label, 'typo@x.com')
      assert.match(quiet.rows[0].value, /^Paid on the App Store, .+, but never confirmed this account, so the computer and the website can’t see the purchase\. A card sale on the website that day went to right@x\.com: maybe the same person, who paid twice\.$/)
      assert.ok(!salesSections({ ...answer, unconfirmed: undefined }, now).some((s) => s.title === 'Paid, account never confirmed'), 'an older server’s answer draws an empty section')
    } finally {
      globalThis.fetch = realFetch
      delete globalThis.Deno
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('only Justin can confirm somebody’s email by hand: no token, a stale one, a stranger’s and the server’s own key are all turned away', async () => {
    /*
     * "How can I resend a verification email to this person. He said he
     * didn't get it. Can we set up a way for me to do that myself?" Confirm
     * now lets an account in without its email, so it is the one action here
     * that must never run for anybody but him: a stranger who could ask it
     * would confirm any address they liked onto an account they made.
     */
    const account = { id: CUSTOMER, email: 'fan@example.com', confirmed: null }
    const body = { action: 'confirm', email: 'fan@example.com' }
    for (const [who, token, status] of [
      ['nobody signed in', undefined, 403],
      ['a token that has run out', 'an-expired-token', 403],
      ['somebody else', 'a-strangers-token', 403],
      /* The entitlement function's key may only claim a waiting grant. */
      ['the server’s own key', SERVICE, 400]
    ]) {
      const { status: got, said, calls } = await grantAccess({ token, body, account })
      assert.equal(got, status, `${who} was answered ${got}`)
      assert.equal(said.ok, false, `${who} was told it worked`)
      assert.ok(!calls.some((c) => c.url.includes('/admin/users/')), `${who} confirmed an account`)
      assert.ok(!calls.some((c) => c.url.includes('/rest/v1/rpc/')), `${who} had an account looked up for them`)
    }
  })

  test('Confirm now marks the email confirmed with one admin call, as the service role, and logs no address', async () => {
    const asHim = (over) => grantAccess({ token: 'his-token', body: { action: 'confirm', email: 'Fan@Example.com ' }, ...over })

    /* An address that never confirmed: one PUT, the shape supabase-js's updateUserById sends. */
    const done = await asHim({ account: { id: CUSTOMER, email: 'fan@example.com', confirmed: null } })
    assert.equal(done.status, 200)
    assert.deepEqual([done.said.ok, done.said.found, done.said.confirmed], [true, true, true], 'a confirmed account is not said to be')
    const admin = done.calls.filter((c) => c.url.includes('/auth/v1/admin/'))
    assert.equal(admin.length, 1, 'the account service was asked more or less than once')
    assert.equal(admin[0].url, `${PROJECT}/auth/v1/admin/users/${CUSTOMER}`, 'it confirmed some other account, or by its address')
    assert.equal(admin[0].method, 'PUT')
    assert.deepEqual(admin[0].body, { email_confirm: true }, 'the account service is asked for something other than confirming the email')
    assert.equal(admin[0].headers.Authorization, `Bearer ${SERVICE}`, 'the admin call is not made as the service role')
    assert.equal(admin[0].headers.apikey, SERVICE)
    assert.ok(!done.calls.some((c) => c.url.includes('revenuecat')), 'confirming an email asks RevenueCat about the unlock')
    assert.equal(done.logged.length, 1, 'confirming is not logged in one line')
    assert.ok(done.logged[0].includes(CUSTOMER) && !/fan@example\.com/i.test(done.logged[0]), `the log names the address: ${done.logged[0]}`)

    /* Confirmed already: nothing to do, and nothing done. */
    const already = await asHim({ account: { id: CUSTOMER, email: 'fan@example.com', confirmed: '2026-10-01T09:00:00Z' } })
    assert.deepEqual([already.said.ok, already.said.already], [true, true])
    assert.ok(!already.calls.some((c) => c.url.includes('/admin/users/')), 'an account already confirmed is confirmed again')

    /* No account: nothing to confirm, and the address is NOT put on the waiting list. */
    const nobody = await asHim({ account: null })
    assert.deepEqual([nobody.said.ok, nobody.said.found], [false, false], 'an address with no account is said to be confirmed')
    assert.deepEqual(nobody.calls.map((c) => c.url), [`${PROJECT}/auth/v1/user`, `${PROJECT}/rest/v1/rpc/account_details`], 'confirming an address with no account did more than look it up')

    /* Refused: said, and still no address in the log. */
    const refused = await asHim({ account: { id: CUSTOMER, email: 'fan@example.com', confirmed: null }, refuse: 500 })
    assert.equal(refused.status, 502)
    assert.equal(refused.said.ok, false, 'a refusal reads as done')
    assert.match(refused.said.message, /500/)
    assert.ok(refused.logged.length === 1 && !/fan@example\.com/i.test(refused.logged[0]), 'a refusal logs the address')

    const blank = await grantAccess({ token: 'his-token', body: { action: 'confirm' } })
    assert.equal(blank.status, 400, 'confirm with no address goes ahead')

    /* And Check on an address with no account answers as it always has. */
    const check = await grantAccess({ token: 'his-token', body: { action: 'check', email: 'new@example.com' } })
    assert.match(check.said.message, /^No account uses new@example\.com yet\. Give access puts them on the waiting list/, 'Confirm now changed what Check says')
  })

  test('Check says whether an account that never confirmed is on the waiting list, so Confirm now can say so first', async () => {
    /*
     * The waiting list is claimed at the first sign-in, on the confirmation
     * email's word that the address is theirs. Confirm now takes that word
     * away, so whoever made the account would get the unlock: the lookup says
     * so before he taps it (confirmNowHint in shared/admin.mjs).
     */
    const check = (over) => grantAccess({ token: 'his-token', body: { action: 'check', email: 'Fan@Example.com' }, ...over })
    const unconfirmed = { id: CUSTOMER, email: 'fan@example.com', confirmed: null }
    const asked = (r) => r.calls.filter((c) => c.url === `${PROJECT}/rest/v1/rpc/is_waiting_grant`)

    const waiting = await check({ account: unconfirmed, waiting: true })
    assert.equal(waiting.status, 200, waiting.said.message)
    assert.equal(waiting.said.found, true)
    assert.equal(waiting.said.details.waiting, true, 'an unconfirmed account on the waiting list is not said to be on it')
    assert.equal(asked(waiting).length, 1)
    assert.deepEqual(asked(waiting)[0].body, { address: 'fan@example.com' }, 'the waiting list is asked about some other address')

    const not = await check({ account: unconfirmed, waiting: false })
    assert.equal(not.said.details.waiting, false, 'an account not on the waiting list is said to be on it')

    /* A waiting list that cannot be asked is not a lookup that failed. */
    const unknown = await check({ account: unconfirmed, waiting: 'fail' })
    assert.equal(unknown.status, 200, 'the lookup fails when the waiting list cannot be asked')
    assert.equal(unknown.said.ok, true)
    assert.equal(unknown.said.details.waiting, null, 'a waiting list that could not be asked reads as a yes or a no')

    /* Confirmed already: Confirm now is not offered, so it is not asked. */
    const confirmed = await check({ account: { ...unconfirmed, confirmed: '2026-10-01T09:00:00Z' }, waiting: true })
    assert.equal(confirmed.said.details.waiting, false)
    assert.equal(asked(confirmed).length, 0, 'the waiting list is asked about an account that has confirmed')
  })

  /* ------------------------------------------------------------------ */
  /* Paid but no computer yet: the setup emails, and Justin's list        */
  /* ------------------------------------------------------------------ */

  test('only the database can start a setup-email run: no secret, a wrong one, one it cannot read, or a key are turned away before anything is read', async () => {
    for (const [who, over] of [
      ['nobody', { given: null }],
      ['a wrong secret', { given: 'a-guess' }],
      ['a secret that cannot be read, against nothing', { secret: 'fail', given: null }],
      ['a secret that cannot be read, against a guess', { secret: 'fail', given: 'null' }],
      ['the anon key', { given: null, token: 'the-anon-key' }]
    ]) {
      const run = await setupReminder({ ...over, sending: true, due: [{ account_id: CUSTOMER, email: 'fan@example.com', kind: 'first' }] })
      assert.equal(run.status, 401, `${who} was answered ${run.status}`)
      assert.ok(!run.calls.some((c) => /setup_reminders_due|claim_setup_reminder|setup_reminder_sending/.test(c.url)), `${who} had the list read`)
      assert.equal(run.sent.length, 0, `${who} sent an email`)
    }
    /* The service key may ask for the sample and nothing else. */
    const other = await setupReminder({ given: null, token: SERVICE, sending: true, body: { action: 'run' }, due: [{ account_id: CUSTOMER, email: 'fan@example.com', kind: 'first' }] })
    assert.equal(other.status, 400, 'the service key started a run')
    assert.equal(other.sent.length, 0)
    assert.ok(!other.calls.some((c) => c.url.includes('/rest/v1/rpc/')), 'the service key had the database read')
  })

  test('switched off, or with no mail key, a setup-email run looks and counts and sends nothing, and names nobody', async () => {
    const due = [
      { account_id: CUSTOMER, email: 'fan@example.com', kind: 'first' },
      { account_id: STRANGER, email: 'second@example.com', kind: 'first' },
      { account_id: ADMIN, email: 'third@example.com', kind: 'reminder' }
    ]
    for (const [why, over] of [['the switch off', { sending: false }], ['no mail key', { sending: true, resendKey: '' }]]) {
      const run = await setupReminder({ ...over, due })
      assert.equal(run.status, 200)
      assert.deepEqual(run.said, { sending: false, first: 2, reminder: 1 }, `with ${why} the run does not say only how many would go`)
      assert.equal(run.sent.length, 0, `with ${why} an email went`)
      assert.ok(!run.calls.some((c) => c.url.includes('claim_setup_reminder')), `with ${why} somebody was marked as emailed`)
      /* Still looked: the due list is what notes which accounts have had a computer. */
      assert.ok(run.calls.some((c) => c.url.endsWith('/rpc/setup_reminders_due')), `with ${why} the run did not look`)
      assert.ok(!run.text.includes('@'), `with ${why} the answer names somebody: ${run.text}`)
      assert.ok(!run.logged.some((l) => l.includes('@')), `with ${why} the log names somebody: ${run.logged.join(' | ')}`)
    }
    /* Only exactly true is on. */
    for (const sending of ['true', 1, null, {}]) {
      const run = await setupReminder({ sending, due })
      assert.equal(run.sent.length, 0, `a switch reading ${JSON.stringify(sending)} sent an email`)
    }
  })

  test('switched on, each setup email is claimed before it goes, from noreply to the account’s own address, with replies to Justin', async () => {
    const odd = "o'neil+&x@example.com"
    const order = []
    const run = await setupReminder({
      sending: true,
      body: { to: ['attacker@example.com'], subject: 'Free money', html: '<script>' },
      due: [
        { account_id: CUSTOMER, email: odd, kind: 'first' },
        { account_id: STRANGER, email: 'second@example.com', kind: 'reminder' }
      ],
      claim: (b) => (order.push(`claim ${b.uid} ${b.which}`), true),
      resend: (p) => (order.push(`send ${p.to[0]}`), 200)
    })
    assert.equal(run.status, 200)
    assert.deepEqual(run.said, { sending: true, first: 1, reminder: 1, refused: 0, skipped: 0, stopped: null })
    assert.deepEqual(order, [`claim ${CUSTOMER} first`, `send ${odd}`, `claim ${STRANGER} reminder`, 'send second@example.com'], 'an email went before it was claimed, or to somebody else')
    const [first, reminder] = run.sent
    for (const p of run.sent) {
      assert.equal(p.from, 'Fractal Remote <noreply@newbold.cloud>', 'the setup email comes from somewhere unverified')
      assert.equal(p.reply_to, 'justinnewbold@gmail.com', 'a reply to the setup email does not come to Justin')
      assert.equal(p.to.length, 1, 'one setup email went to more than one address')
      assert.ok(!JSON.stringify(p).includes('attacker@example.com') && !JSON.stringify(p).includes('Free money') && !JSON.stringify(p).includes('<script>'), 'something in the request reached the email')
    }
    assert.deepEqual(first.to, [odd])
    assert.equal(first.subject, 'One more step: the Fractal Remote computer app')
    assert.equal(reminder.subject, 'Still need a hand with the Fractal Remote computer app?')
    assert.ok(first.html.includes('o&#39;neil+&amp;x@example.com') && !first.html.includes(odd), 'the address goes into the email unescaped')
    assert.ok(first.text.includes(odd), 'the plain words do not name the address to sign in with')
    assert.ok(!run.text.includes('@'), 'the answer names somebody')
    assert.ok(!run.logged.some((l) => l.includes('@')), 'the log names somebody')
    /* Each one says which email to whom, by account id, so the same one asked for again is not sent again. */
    const keys = run.calls.filter((c) => c.url === 'https://api.resend.com/emails').map((c) => c.headers['Idempotency-Key'])
    assert.deepEqual(keys, [`setup-reminder/first/${CUSTOMER}`, `setup-reminder/reminder/${STRANGER}`], 'a setup email goes without saying which email to whom, so a second copy could go')
    assert.ok(!keys.some((k) => k.includes('@')), 'the key sent to the mail service carries the address')
  })

  /* Resend's own answer for an address it will not take, quoting it, as it can. */
  const REFUSED_TO = (to) => ({ name: 'validation_error', message: `Invalid \`to\` field. The email address needs to follow the \`email@example.com\` or \`Name <email@example.com>\` format. Got ${to}.` })

  test('a setup email the database will not claim is not sent, a refusal of the person’s address is written down and stops the run, and a row that is not one of the two emails is skipped', async () => {
    const AFTER = '00000000-0000-4000-8000-0000000000af'
    const run = await setupReminder({
      sending: true,
      due: [
        { account_id: CUSTOMER, email: 'fan@example.com', kind: 'first' },
        { account_id: ADMIN, email: 'third@example.com', kind: 'third' },
        { account_id: ADMIN, email: 'a@b.co, c@d.co', kind: 'reminder' },
        { account_id: '', email: 'nobody@example.com', kind: 'first' },
        { account_id: STRANGER, email: 'refused@example.com', kind: 'first' },
        { account_id: AFTER, email: 'after@example.com', kind: 'first' }
      ],
      claim: (b) => b.uid !== CUSTOMER,
      resend: (p) => (p.to[0] === 'refused@example.com' ? { status: 422, ...REFUSED_TO(p.to[0]) } : 200)
    })
    assert.equal(run.sent.length, 1, 'an email went that the database did not claim, one that is not an email, or one after the refusal')
    assert.deepEqual(run.sent[0].to, ['refused@example.com'])
    assert.deepEqual(run.said, { sending: true, first: 0, reminder: 0, refused: 1, skipped: 4, stopped: { status: 422, why: 'this email' } })
    const failed = run.calls.filter((c) => c.url.endsWith('/rpc/note_setup_reminder_failed'))
    assert.deepEqual(failed.map((c) => c.body), [{ uid: STRANGER, which: 'first' }], 'a refusal of the email is not written down, so the next hour mails that address again')
    assert.ok(!run.calls.some((c) => c.url.endsWith('/rpc/release_setup_reminder')), 'a refused email was handed back to be tried again')
    const claims = run.calls.filter((c) => c.url.endsWith('/rpc/claim_setup_reminder')).map((c) => c.body)
    assert.deepEqual(claims, [{ uid: CUSTOMER, which: 'first' }, { uid: STRANGER, which: 'first' }], 'something besides a first email or a reminder was claimed, or the run went on past the refusal')
    assert.ok(run.logged.some((l) => l.includes(STRANGER) && /refused this email, for its address \(status 422, validation_error\)/.test(l)), 'the refusal is not logged by account, status and Resend’s name for it')
    assert.ok(!run.logged.some((l) => l.includes('@')), 'the refusal’s log names the address')
    assert.ok(!run.text.includes('@'))
  })

  /*
   * A WRONG MAIL KEY IS NOT TWELVE REFUSED BUYERS. Resend takes an address it
   * cannot deliver to and reports the bounce later, so a refusal at the
   * moment of sending is the service: a bad or rotated key, a limit, an
   * outage. Before this, one such run marked every due buyer refused for
   * good, with nothing anywhere to undo it. A key or a limit is turned away
   * before Resend takes anything, so that claim is handed back; an outage is
   * the next test.
   */
  test('a mail service that turns the key away or hits a limit stops the run at the first email, holds nothing against anybody, and takes its claim back', async () => {
    const due = [
      { account_id: CUSTOMER, email: 'fan@example.com', kind: 'first' },
      { account_id: STRANGER, email: 'second@example.com', kind: 'reminder' },
      { account_id: ADMIN, email: 'third@example.com', kind: 'first' }
    ]
    for (const [status, said] of [
      [401, /the mail key was refused \(status 401\)/],
      [403, /the mail key was refused \(status 403\)/],
      [429, /sending limit was reached \(status 429\)/]
    ]) {
      const run = await setupReminder({ sending: true, due, resend: () => status })
      assert.equal(run.status, 200)
      assert.equal(run.sent.length, 1, `a ${status} did not stop the run: ${run.sent.length} emails tried`)
      assert.deepEqual(run.said, { sending: true, first: 0, reminder: 0, refused: 1, skipped: 0, stopped: { status, why: 'mail service' } })
      assert.ok(!run.calls.some((c) => c.url.endsWith('/rpc/note_setup_reminder_failed')), `a ${status} was written against the buyer, who then never gets the email`)
      const claims = run.calls.filter((c) => c.url.endsWith('/rpc/claim_setup_reminder')).map((c) => c.body)
      assert.deepEqual(claims, [{ uid: CUSTOMER, which: 'first' }], `a ${status} went on to claim the next buyer`)
      const released = run.calls.filter((c) => c.url.endsWith('/rpc/release_setup_reminder')).map((c) => c.body)
      assert.deepEqual(released, [{ uid: CUSTOMER, which: 'first' }], `after a ${status} the claim stays, so the email reads as sent and never goes`)
      assert.ok(run.logged.some((l) => l.includes(CUSTOMER) && said.test(l)), `the log does not say what a ${status} means: ${run.logged.join(' | ')}`)
      assert.ok(!run.logged.some((l) => l.includes('@')) && !run.text.includes('@'), `a ${status} named somebody`)
    }

    /* And a run where everything goes says it was not stopped. */
    const fine = await setupReminder({ sending: true, due })
    assert.deepEqual(fine.said, { sending: true, first: 2, reminder: 1, refused: 0, skipped: 0, stopped: null })
  })

  /*
   * A 400 OR A 422 IS MOSTLY OUR REQUEST, NOT THE PERSON. Resend answers 400
   * "API key is invalid" from every endpoint when the key is not in a key's
   * shape, 400 for a field it cannot read (a mistyped SETUP_FROM), and 422
   * for a missing field or a bad parameter. Sorted by status alone, each of
   * those wrote one paying customer down as refused for good, every hour the
   * switch was on: the ~12 waiting on day one, shut out inside 12 hours, with
   * "The email to them was refused" on the Developer page. Only an answer
   * about the `to` field is the person's now.
   */
  test('a 400 or 422 that is not about the address holds nothing against anybody, hands its claim back, and tries one more before it stops', async () => {
    const due = [
      { account_id: CUSTOMER, email: 'fan@example.com', kind: 'first' },
      { account_id: STRANGER, email: 'second@example.com', kind: 'reminder' },
      { account_id: ADMIN, email: 'third@example.com', kind: 'first' }
    ]
    for (const [status, answer, name] of [
      [400, { name: 'validation_error', message: 'API key is invalid' }, 'validation_error'],
      [400, { name: 'validation_error', message: 'Invalid `from` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.' }, 'validation_error'],
      [422, { name: 'validation_error', message: 'Invalid `reply_to` field. The email address needs to follow the `email@example.com` format.' }, 'validation_error'],
      [400, { name: 'validation_error', message: 'An error was found with one or more fields in the request.' }, 'validation_error'],
      [422, { name: 'missing_required_field', message: 'Missing `to` field.' }, 'missing_required_field'],
      [422, { name: 'invalid_parameter', message: 'The `to` parameter is not a valid UUID.' }, 'invalid_parameter'],
      [400, { name: 'invalid_idempotency_key', message: 'The key must be between 1-256 chars.' }, 'invalid_idempotency_key'],
      [400, { raw: '<html>Bad Request for fan@example.com</html>' }, ''],
      [422, { message: 'cannot send to fan@example.com' }, ''],
      [400, { name: 'Not A Name <fan@example.com>', message: 'Invalid `from` field.' }, '']
    ]) {
      const what = `${status} ${answer.message || answer.raw}`
      const run = await setupReminder({ sending: true, due, resend: () => ({ status, ...answer }) })
      assert.equal(run.status, 200)
      assert.ok(!run.calls.some((c) => c.url.endsWith('/rpc/note_setup_reminder_failed')), `a ${what} was written against the buyer, who then never gets the email`)
      /* The second one turned down the same way says it is the request: the run stops there, the third never claimed. */
      assert.equal(run.sent.length, 2, `a ${what} did not try exactly one more: ${run.sent.length} tried`)
      const claims = run.calls.filter((c) => c.url.endsWith('/rpc/claim_setup_reminder')).map((c) => c.body)
      assert.deepEqual(claims, [{ uid: CUSTOMER, which: 'first' }, { uid: STRANGER, which: 'reminder' }], `a ${what} went on past the second email`)
      const released = run.calls.filter((c) => c.url.endsWith('/rpc/release_setup_reminder')).map((c) => c.body)
      assert.deepEqual(released, [{ uid: CUSTOMER, which: 'first' }, { uid: STRANGER, which: 'reminder' }], `after a ${what} a claim stays, so an email that never went reads as sent`)
      assert.deepEqual(run.said, { sending: true, first: 0, reminder: 0, refused: 2, skipped: 0, stopped: { status, why: 'mail service' } })
      const tag = name ? `status ${status}, ${name}` : `status ${status}`
      assert.ok(run.logged.some((l) => l.includes(CUSTOMER) && l.includes(`turned the request itself down, not the address (check RESEND_API_KEY and SETUP_FROM) (${tag})`)), `the log does not say what a ${what} means: ${run.logged.join(' | ')}`)
      assert.ok(!run.logged.some((l) => l.includes('@')) && !run.text.includes('@'), `a ${what} named somebody: ${run.logged.join(' | ')}`)
      assert.ok(!run.logged.some((l) => /Invalid|API key is invalid|<html>/.test(l)), 'Resend’s own message reached the log, where it could carry an address')
    }

    /* The run above, hour after hour: nobody is ever written down. Before this, three hours were three buyers refused for good. */
    for (let hour = 0; hour < 3; hour += 1) {
      const run = await setupReminder({ sending: true, due, resend: () => ({ status: 400, name: 'validation_error', message: 'API key is invalid' }) })
      assert.ok(!run.calls.some((c) => c.url.endsWith('/rpc/note_setup_reminder_failed')), `hour ${hour + 1} wrote a buyer down as refused`)
    }

    /*
     * And when the one more goes, the first was about that person after all:
     * still nothing held against them, but nobody behind them is held up
     * either. The list is oldest first, so stopping on them would stop
     * everybody, every hour. The one more is once a run: the next doubt stops it.
     */
    const FOURTH = '00000000-0000-4000-8000-0000000000f4'
    const odd = await setupReminder({
      sending: true,
      due: [...due, { account_id: FOURTH, email: 'fourth@example.com', kind: 'first' }],
      resend: (p) => (p.to[0] === 'fan@example.com' || p.to[0] === 'third@example.com' ? { status: 422, message: 'This address cannot be sent to.' } : 200)
    })
    assert.deepEqual(odd.sent.map((p) => p.to[0]), ['fan@example.com', 'second@example.com', 'third@example.com'], 'one doubtful refusal held up the people behind it, or a second did not stop the run')
    assert.deepEqual(odd.said, { sending: true, first: 0, reminder: 1, refused: 2, skipped: 0, stopped: { status: 422, why: 'mail service' } })
    assert.deepEqual(odd.calls.filter((c) => c.url.endsWith('/rpc/release_setup_reminder')).map((c) => c.body), [{ uid: CUSTOMER, which: 'first' }, { uid: ADMIN, which: 'first' }])
    assert.ok(!odd.calls.some((c) => c.url.endsWith('/rpc/note_setup_reminder_failed')))
    const once = await setupReminder({ sending: true, due, resend: (p) => (p.to[0] === 'fan@example.com' ? { status: 400, message: 'no' } : 200) })
    assert.deepEqual(once.said, { sending: true, first: 1, reminder: 1, refused: 1, skipped: 0, stopped: null }, 'a run that got past its one doubt says it stopped')
  })

  test('only an answer about the `to` field is a refusal of the person, whatever else it says', async () => {
    const due = [
      { account_id: CUSTOMER, email: 'fan@example.com', kind: 'first' },
      { account_id: STRANGER, email: 'second@example.com', kind: 'first' }
    ]
    for (const [status, answer, why] of [
      [400, REFUSED_TO('fan@example.com'), 'this email'],
      [422, REFUSED_TO('fan@example.com'), 'this email'],
      [422, { name: 'validation_error', message: 'Invalid `to` field. Please use our testing email address instead of domains like `example.com`.' }, 'this email'],
      [422, { message: 'The to field must be a valid email address.' }, 'this email'],
      [400, { name: 'validation_error', message: 'Invalid `from` field. The email address needs to follow the `email@example.com` format.' }, 'mail service'],
      [422, { name: 'validation_error', message: 'Invalid `reply_to` field.' }, 'mail service'],
      [400, { name: 'validation_error', message: 'API key is invalid' }, 'mail service'],
      [422, { name: 'missing_required_field', message: 'Missing `to` field.' }, 'mail service'],
      [403, { name: 'validation_error', message: 'Invalid `to` field.' }, 'mail service'],
      [500, { name: 'application_error', message: 'Invalid `to` field.' }, 'may have gone']
    ]) {
      const run = await setupReminder({ sending: true, due, resend: () => ({ status, ...answer }) })
      assert.equal(run.said.stopped?.why, why, `${status} "${answer.message}" was sorted as ${JSON.stringify(run.said.stopped)}`)
      const failed = run.calls.filter((c) => c.url.endsWith('/rpc/note_setup_reminder_failed')).map((c) => c.body)
      assert.deepEqual(failed, why === 'this email' ? [{ uid: CUSTOMER, which: 'first' }] : [], `${status} "${answer.message}" ${failed.length ? 'was' : 'was not'} written down against the person`)
      assert.ok(!run.logged.some((l) => l.includes('@')), `${status} "${answer.message}" put the address in the log`)
    }
  })

  /*
   * NEVER A THIRD, WHEN THE ANSWER DOES NOT SAY. A 5xx — a 502 or a 504 from
   * a gateway above all — can come back after Resend has taken the email.
   * Taking that claim back would send the same first email again the next
   * hour, and then the reminder: three. So it stays claimed and reads as sent,
   * the same as no answer at all, and so does any status that does not say.
   */
  test('a mail service fault, no answer, or an answer that does not say whether it went keeps the claim, so the same email never goes twice', async () => {
    const due = [
      { account_id: CUSTOMER, email: 'fan@example.com', kind: 'first' },
      { account_id: STRANGER, email: 'second@example.com', kind: 'reminder' }
    ]
    for (const [status, said] of [
      [500, /the mail service had a fault, so it may have gone and is kept as sent \(status 500\)/],
      [502, /the mail service had a fault, so it may have gone and is kept as sent \(status 502\)/],
      [503, /the mail service had a fault, so it may have gone and is kept as sent \(status 503\)/],
      [504, /the mail service had a fault, so it may have gone and is kept as sent \(status 504\)/],
      [409, /does not say whether it went, so it is kept as sent \(status 409\)/],
      ['throw', /no answer from the mail service, so it may have gone and is kept as sent \(status 0\)/]
    ]) {
      const run = await setupReminder({ sending: true, due, resend: () => status })
      const answered = status === 'throw' ? 0 : status
      assert.equal(run.status, 200)
      assert.equal(run.sent.length, 1, `a ${answered} did not stop the run: ${run.sent.length} emails tried`)
      assert.deepEqual(run.said, { sending: true, first: 0, reminder: 0, refused: 1, skipped: 0, stopped: { status: answered, why: 'may have gone' } })
      assert.ok(!run.calls.some((c) => c.url.endsWith('/rpc/release_setup_reminder')), `after a ${answered} the claim was taken back, so an email that may have gone goes again`)
      assert.ok(!run.calls.some((c) => c.url.endsWith('/rpc/note_setup_reminder_failed')), `a ${answered} was written against the buyer`)
      assert.ok(run.logged.some((l) => l.includes(CUSTOMER) && said.test(l)), `the log does not say what a ${answered} means: ${run.logged.join(' | ')}`)
      assert.ok(!run.logged.some((l) => l.includes('@')) && !run.text.includes('@'), `a ${answered} named somebody`)
    }
  })

  test('the sample goes only to the reply address, marked [Sample], and touches nothing in the database', async () => {
    const run = await setupReminder({ given: null, token: SERVICE, sending: false, body: { action: 'sample', to: 'attacker@example.com' } })
    assert.equal(run.status, 200)
    assert.deepEqual(run.said, { ok: true, sent: 2 })
    assert.deepEqual(run.sent.map((p) => p.to), [['justinnewbold@gmail.com'], ['justinnewbold@gmail.com']], 'the sample went somewhere other than Justin’s inbox')
    assert.deepEqual(run.sent.map((p) => p.subject), ['[Sample] One more step: the Fractal Remote computer app', '[Sample] Still need a hand with the Fractal Remote computer app?'])
    assert.ok(!run.calls.some((c) => c.url.includes('/rest/v1/')), 'the sample read or wrote the database')
    /* No key on a sample: asked for twice in an hour, it goes twice. */
    assert.ok(run.calls.filter((c) => c.url === 'https://api.resend.com/emails').every((c) => !('Idempotency-Key' in c.headers)), 'a second sample asked for within the day would not go')
  })

  test('the setup emails say what to do in plain words, why they came, and that one reminder is the most', async () => {
    const { setupEmail } = await import(`${SETUP_URL}?words=1`).catch(async () => {
      /* Importing starts Deno.serve; give it somewhere to go. */
      globalThis.Deno = { serve: () => {}, env: { get: () => undefined } }
      return import(`${SETUP_URL}?words=2`)
    })
    delete globalThis.Deno
    const first = setupEmail('first', 'fan@example.com')
    const reminder = setupEmail('reminder', 'fan@example.com')
    for (const [which, e] of [['first', first], ['reminder', reminder]]) {
      assert.match(e.text, /1\. On the computer your Fractal is plugged into, go to fractal\.newbold\.cloud\/downloads and install the Fractal Remote computer app\./, `the ${which} email does not say where to download it`)
      assert.match(e.text, /2\. Open it, choose “I already have an account”, and sign in with fan@example\.com, the same email you use on your phone\./, `the ${which} email does not say which button to choose and to sign in with the same email`)
      assert.match(e.text, /3\. Open Fractal Remote on your phone\. It finds the computer by itself\./, `the ${which} email does not say the phone finds it`)
      assert.match(e.text, /\nUsed the computer app before\? Click the gear at the top, choose Phone & computer, then “Sign in to set up the phone remote”, and sign in with fan@example\.com\.\n/, `the ${which} email leaves out somebody whose computer app is past its first screen`)
      assert.ok(e.html.includes('choose “I already have an account”') && e.html.includes('Phone &amp; computer, then “Sign in to set up the phone remote”'), `the ${which} email’s HTML does not name the doors`)
      /* "Free" once: the opening says the app is free, and nothing says it twice. */
      assert.equal((e.text.match(/\bfree\b/gi) || []).length, 1, `the ${which} email says free ${(e.text.match(/\bfree\b/gi) || []).length} times`)
      assert.match(e.text, /reply/i, `the ${which} email does not say to reply`)
      assert.match(e.text, /\nJustin\n/, `the ${which} email is not from Justin`)
      assert.ok(e.html.includes('href="https://fractal.newbold.cloud/downloads"'), `the ${which} email has no link to the downloads page`)
      /* Plain, and for a guitarist: never "Mac", never "yesterday" (the first day sends to people weeks in). */
      assert.ok(!/\bMac\b|yesterday|\bOTA\b|\brelay\b/i.test(e.text + e.subject), `the ${which} email says something it should not`)
    }
    assert.match(first.text, /no computer has signed in with your account yet\. Setting it up takes about five minutes:/, 'the first email’s “it” has nothing to point to')
    assert.match(first.text, /If you get stuck anywhere, just reply to this email\. It comes straight to me\./)
    assert.match(first.text, /You’re getting this because fan@example\.com has the full version of Fractal Remote and no computer has signed in with it yet\./, 'the first email does not say why it came')
    assert.match(first.text, /I’ll send one reminder at most, and nothing after that\./, 'the first email does not say at most one reminder follows')
    assert.match(reminder.text, /This is the last email about it\./, 'the reminder does not say it is the last')
  })

  /*
   * BLUETOOTH (BETA) IN THE SETUP EMAILS, OFF UNTIL THE STORE VERSION THAT
   * OPENS IT IS IN BOTH STORES.
   *
   * Once Bluetooth (beta) opens to customers (store version 1.89.0, the AM4
   * only), an AM4 owner may never sign a computer in, and both emails would
   * tell them "your phone has nothing to connect to". So the function carries
   * a wording that offers both ways, behind one switch, BLUETOOTH_IN_EMAILS.
   * The email cannot tell which store copy a buyer has, so the switch may go
   * on only once the version it names is live in both stores AND is the
   * build that opened Bluetooth (beta) to customers. A 1.89.0 in the stores
   * is not enough by itself: one that went out without it (a review gone
   * wrong, the version moved at build time) does not draw the row the email
   * sends people to.
   */
  const setupWords = async () => {
    const mod = await import(`${SETUP_URL}?words=bluetooth`).catch(async () => {
      globalThis.Deno = { serve: () => {}, env: { get: () => undefined } }
      return import(`${SETUP_URL}?words=bluetooth-2`)
    })
    delete globalThis.Deno
    return mod
  }

  /*
   * WHEN THE EMAILS MAY OFFER BLUETOOTH (BETA), as one rule, so it can be
   * tried on the days it is there for as well as on today:
   *
   *   on          BLUETOOTH_IN_EMAILS
   *   from        BLUETOOTH_FROM, the version the email names
   *   stores      public/store-versions.json, moved the day a version is live
   *   builds      docs/expo-builds.md, read by ledgerBuilds
   *   thresholds  the version rule's BLUETOOTH_FROM_STORE ({ ios, android },
   *               mobile/src/lib/ble-rule.js)
   *
   * On needs every one of: both stores at `from` or later; a build at `from`
   * marked as the opening, for each phone; and the version rule's threshold
   * set on both phones. And once both thresholds are set, `from` is them,
   * switch on or off: the email says one version to iPhone and Android
   * buyers alike, so the pull request that sets the thresholds moves
   * BLUETOOTH_FROM with them if it has to.
   *
   * It reads only what the files say. A file moved wrong, or early, it
   * cannot see, which is why supabase/README.md has the day looked at by eye.
   */
  const emailSwitchProblems = ({ on, from, stores, builds, thresholds }, isOlder) => {
    const out = []
    const phones = ['ios', 'android']
    const store = { ios: 'the App Store', android: 'Google Play' }
    const set = phones.every((p) => typeof thresholds[p] === 'string' && thresholds[p] !== '')
    if (set) {
      for (const p of phones) if (thresholds[p] !== from) out.push(`${p}: the version rule opens Bluetooth (beta) from ${thresholds[p]}, and the emails say ${from}`)
    }
    if (!on) return out
    if (!set) out.push(`the emails offer Bluetooth (beta), and the version rule has not opened it to customers on both phones (ios ${thresholds.ios}, android ${thresholds.android})`)
    for (const p of phones) {
      if (isOlder(stores?.[p], from) !== false) out.push(`${p}: the emails offer Bluetooth (beta) from ${from}, and public/store-versions.json says ${store[p]} has ${stores?.[p]}`)
      if (!builds.some((b) => b.platform === p && b.version === from && b.opening)) out.push(`${p}: the emails offer Bluetooth (beta) from ${from}, and docs/expo-builds.md has no ${p} build of ${from} marked "Bluetooth (beta) for customers"`)
    }
    return out
  }

  /* The state as it is in this tree, the version rule's threshold included (ledger.mjs, imported above, reads ble-rule.js too). */
  const switchToday = async () => {
    const { BLUETOOTH_IN_EMAILS, BLUETOOTH_FROM } = await setupWords()
    const thresholds = (await import('../mobile/src/lib/ble-rule.js')).BLUETOOTH_FROM_STORE
    assert.ok(thresholds && typeof thresholds === 'object' && 'ios' in thresholds && 'android' in thresholds, 'the version rule’s thresholds are not { ios, android }; this check needs telling')
    return {
      on: BLUETOOTH_IN_EMAILS,
      from: BLUETOOTH_FROM,
      stores: JSON.parse(read('public/store-versions.json')),
      builds: ledgerBuilds(read('docs/expo-builds.md')),
      thresholds
    }
  }

  test('the setup emails say nothing of Bluetooth while the switch is off, and it goes on only once the version that opens it is live in both stores', async () => {
    const { setupEmail, BLUETOOTH_IN_EMAILS, BLUETOOTH_FROM } = await setupWords()
    const fn = code(read('supabase/functions/setup-reminder/index.ts'))
    /* One switch, a plain true or false, and one version, said the way the stores say it. */
    assert.equal((fn.match(/\bBLUETOOTH_IN_EMAILS\s*=/g) || []).length, 1, 'the switch is set in more than one place')
    assert.match(fn, /^export const BLUETOOTH_IN_EMAILS = (true|false)$/m, 'the switch is not a plain true or false')
    assert.match(BLUETOOTH_FROM, /^\d+\.\d+\.\d+$/)

    /* The rule, on the files as they are. */
    const { isOlder } = await import('../shared/versions.mjs')
    const today = await switchToday()
    assert.ok(today.builds.length >= 15, `only ${today.builds.length} builds were read from docs/expo-builds.md; the read is probably broken`)
    assert.deepEqual(emailSwitchProblems(today, isOlder), [])
    /* A cross-check only, until the version rule's thresholds say which version opens it: then they decide, above. */
    const decided = Boolean(today.thresholds.ios && today.thresholds.android)
    if (!decided) assert.equal(BLUETOOTH_FROM, '1.89.0', 'the version Bluetooth (beta) is planned to open in moved; the email says it, so it moves on purpose')

    /* The emails as they go are the switch's: asked with nothing, the switch decides. */
    for (const kind of ['first', 'reminder']) {
      assert.deepEqual(setupEmail(kind, 'fan@example.com'), setupEmail(kind, 'fan@example.com', { bluetooth: BLUETOOTH_IN_EMAILS }), `the ${kind} email is not the switch’s wording`)
    }
    /* Off: not a word of it, and the openings exactly what they were. */
    const first = setupEmail('first', 'fan@example.com', { bluetooth: false })
    const reminder = setupEmail('reminder', 'fan@example.com', { bluetooth: false })
    for (const [which, e] of [['first', first], ['reminder', reminder]]) {
      assert.ok(!/bluetooth|\bAM4\b|1\.89|My rig|adapter|second way/i.test(e.subject + e.text + e.html), `the ${which} email mentions Bluetooth (beta) with the switch off`)
    }
    assert.match(first.text, /\nThanks for getting Fractal Remote! Your phone controls your Fractal through a free app on the computer your unit is plugged into, and no computer has signed in with your account yet\. Setting it up takes about five minutes:\n/, 'the first email’s opening changed with the switch off')
    assert.match(reminder.text, /\nJust checking in\. No computer has signed in to Fractal Remote with fan@example\.com yet, so your phone has nothing to connect to\. The computer app is free, and it’s the same three steps:\n/, 'the reminder’s opening changed with the switch off')

    /* And a real hourly run sends the switch's words, and nothing else. */
    const run = await setupReminder({
      sending: true,
      due: [
        { account_id: CUSTOMER, email: 'fan@example.com', kind: 'first' },
        { account_id: STRANGER, email: 'other@example.com', kind: 'reminder' }
      ]
    })
    assert.equal(run.sent.length, 2)
    assert.deepEqual(
      run.sent.map((p) => [p.subject, p.text, p.html]),
      [setupEmail('first', 'fan@example.com'), setupEmail('reminder', 'other@example.com')].map((e) => [e.subject, e.text, e.html]),
      'an email went out in words other than the switch’s'
    )
    if (!BLUETOOTH_IN_EMAILS) assert.ok(run.sent.every((p) => !/bluetooth/i.test(p.text + p.html)), 'a real email mentioned Bluetooth (beta) with the switch off')
  })

  test('the switch’s rule, on the days it is there for: never on for a 1.89.0 that did not open Bluetooth (beta), one store alone, or a version the rule does not open', async () => {
    const { isOlder } = await import('../shared/versions.mjs')
    /* The ledger as it was before any build opened Bluetooth, so these mean the same thing the day the real opening row is written. */
    const ledger = withoutOpening(read('docs/expo-builds.md'))
    const row = (version, ios, android, why) => `| 1 Nov | ${version} | ${ios} | ${android} | ${why} |`
    const opened = ledgerBuilds(`${ledger}\n${row('1.89.0', '1', '1', 'Bluetooth (beta) for customers: the AM4, from both phones')}\n`)
    const plain = ledgerBuilds(`${ledger}\n${row('1.89.0', '1', '1', 'The build pair after 1.88.3')}\n`)
    const iosOnly = ledgerBuilds(`${ledger}\n${row('1.89.0', '1', '—', 'Bluetooth (beta) for customers, iPhone only')}\n`)
    const live = { ios: '1.89.0', android: '1.89.0' }
    const both = { ios: '1.89.0', android: '1.89.0' }
    const day = { on: true, from: '1.89.0', stores: live, builds: opened, thresholds: both }
    const problems = (change) => emailSwitchProblems({ ...day, ...change }, isOlder)
    const says = (change, pattern, why) => assert.ok(problems(change).some((p) => pattern.test(p)), `${why}: ${JSON.stringify(problems(change))}`)

    /* The day it is for: live in both stores, the opening build on both phones, the rule open on both. */
    assert.deepEqual(problems({}), [], 'the day 1.89.0 opens Bluetooth (beta) and is live in both stores, the switch is refused')
    assert.deepEqual(problems({ stores: { ios: '1.89.2', android: '1.89.1' } }), [], 'a store already past the opening version is read as not having it')
    /* Off, today: nothing to say. */
    assert.deepEqual(problems({ on: false, stores: { ios: '1.87.11', android: '1.87.11' }, builds: ledgerBuilds(ledger), thresholds: { ios: null, android: null } }), [])

    /* The finding: 1.89.0 in both stores, without Bluetooth opened. */
    says({ builds: plain }, /docs\/expo-builds\.md has no ios build of 1\.89\.0 marked/, 'a 1.89.0 that did not open Bluetooth (beta) lets the switch on')
    says({ builds: plain, thresholds: { ios: null, android: null } }, /has not opened it to customers on both phones/, 'the version rule closed lets the switch on')
    /* One store alone, or one phone's build alone. */
    says({ stores: { ios: '1.89.0', android: '1.88.0' } }, /^android: .*Google Play has 1\.88\.0/, 'the switch goes on with Google Play still on 1.88.0')
    says({ stores: { ios: '1.89.0' } }, /^android: .*Google Play has undefined/, 'a store that says nothing reads as having it')
    says({ builds: iosOnly }, /^android: .*no android build of 1\.89\.0/, 'an opening build on one phone lets both phones’ buyers be told')
    says({ thresholds: { ios: '1.89.0', android: null } }, /has not opened it to customers on both phones/, 'the rule open on one phone lets both phones’ buyers be told')
    /* The rule opening on another version than the email says, switch on or off. */
    says({ thresholds: { ios: '1.90.0', android: '1.90.0' } }, /^ios: the version rule opens Bluetooth \(beta\) from 1\.90\.0, and the emails say 1\.89\.0/, 'the email names a version the rule does not open')
    says({ on: false, thresholds: { ios: '1.89.0', android: '1.89.1' } }, /^android: the version rule opens Bluetooth \(beta\) from 1\.89\.1/, 'the build pull request leaves the email’s version behind the rule’s')
    /* The ledger read itself: the opening row is read on both phones, and a phone a row did not build is not. */
    assert.equal(opened.filter((b) => b.opening && b.version === '1.89.0').length, 2)
    assert.deepEqual(iosOnly.filter((b) => b.version === '1.89.0').map((b) => b.platform), ['ios'])
  })

  test('with the switch on, both emails offer both ways: the computer first and best, then Bluetooth (beta) for an AM4 from 1.89.0, and help still a reply to Justin', async () => {
    const { setupEmail, BLUETOOTH_FROM } = await setupWords()
    const second =
      `Have an AM4? From version ${BLUETOOTH_FROM} of the app there’s a second way, with no computer: Bluetooth (beta), through a Bluetooth MIDI adapter plugged into the AM4’s MIDI In and MIDI Out. ` +
      'The computer is still the best way, and the only way for the FM3, FM9, Axe-Fx III and VP4: Bluetooth has more lag and does less, with no editing or saving. ' +
      'To try it, update the app, then open Settings → My rig → Bluetooth (beta), which says what to buy and how to plug it in.'
    const first = setupEmail('first', 'fan@example.com', { bluetooth: true })
    const reminder = setupEmail('reminder', 'fan@example.com', { bluetooth: true })
    for (const [which, e, help] of [
      ['first', first, 'If you get stuck anywhere, just reply to this email.'],
      ['reminder', reminder, 'If something got in the way, reply and tell me what you see']
    ]) {
      assert.ok(e.text.includes(`\n\n${second}\n\n`), `the ${which} email does not say the second way as its own paragraph`)
      assert.ok(e.html.includes(`<p style="margin:0 0 16px">${second}</p>`), `the ${which} email’s HTML does not say the second way`)
      /* After every word about the computer, and before the help. */
      const at = e.text.indexOf(second)
      assert.ok(at > e.text.indexOf('3. Open Fractal Remote on your phone.') && at > e.text.indexOf('Used the computer app before?'), `the ${which} email offers Bluetooth before the computer`)
      assert.ok(at < e.text.indexOf(help), `the ${which} email’s help is not after the second way`)
      /* The computer's steps and the button to the download are all still there. */
      assert.match(e.text, /1\. On the computer your Fractal is plugged into, go to fractal\.newbold\.cloud\/downloads and install the Fractal Remote computer app\./)
      assert.ok(e.html.includes('href="https://fractal.newbold.cloud/downloads"'), `the ${which} email lost the download link`)
      /* Plain, and the same rules as the computer's words: "free" once, nothing for a developer, nothing official. */
      assert.equal((e.text.match(/\bfree\b/gi) || []).length, 1, `the ${which} email says free more than once`)
      assert.ok(!/\bMac\b|yesterday|\bOTA\b|\brelay\b|official|endorsed|approved/i.test(e.text + e.subject), `the ${which} email says something it should not`)
      /* Help is Justin's: the paragraph sends nobody anywhere else. */
      assert.ok(!/@|https?:|www\./.test(second), 'the second way sends people somewhere other than this email’s reply')
    }
    /* Never a promise for every Fractal unit: the computer is the way for the units the app works with, named, and those are SUPPORTED UNITS less the AM4. */
    assert.ok(!/every (Fractal )?unit/i.test(second), 'the email promises the computer for every Fractal unit, Axe-Fx II and AX8 among them')
    const supported = read('docs/app-store.md').match(/\nSUPPORTED UNITS\n([^\n]+)\n/)?.[1] || ''
    assert.equal(supported, 'FM3, FM9, Axe-Fx III and AM4, and the VP4 in part.', 'SUPPORTED UNITS changed; the email names the units the computer is the only way for, from that list')
    const units = (list) => list.split(/,\s*(?:and\s+)?(?:the\s+)?|\s+and\s+(?:the\s+)?/).map((u) => u.replace(/^the /, '').replace(/ in part\.?$|\.$/, '').trim()).filter(Boolean).sort()
    const named = second.match(/the only way for the ([^:]+):/)?.[1] || ''
    assert.deepEqual(units(named), units(supported).filter((u) => u !== 'AM4'), `the email names ${named} as the computer’s alone; SUPPORTED UNITS less the AM4 is ${units(supported).filter((u) => u !== 'AM4').join(', ')}`)
    /* Subjects as they were: the computer is still what the email is about. */
    assert.equal(first.subject, 'One more step: the Fractal Remote computer app')
    assert.equal(reminder.subject, 'Still need a hand with the Fractal Remote computer app?')
    /* The computer the best way rather than the only one, and nobody told their phone has nothing to connect to. */
    assert.match(first.text, /The best way for your phone to control your Fractal is through a free app on the computer your unit is plugged into, and no computer has signed in with your account yet\. Setting it up takes about five minutes:/)
    assert.match(reminder.text, /No computer has signed in to Fractal Remote with fan@example\.com yet\. The computer app is free, and it’s the same three steps:/)
    assert.ok(!/nothing to connect to/.test(first.text + reminder.text), 'with Bluetooth in the emails, an AM4 owner is told their phone has nothing to connect to')
    /* What it costs is only what the app's Bluetooth page says (more lag: the preset list slow to load and footswitch changes a moment late), and the row it names is there. */
    const page = read('mobile/src/screens/Bluetooth.js')
    for (const line of ["'No editing or saving over Bluetooth.'", "'Slower to load the preset list.'", "'Footswitch changes may take a moment to show.'"]) {
      assert.ok(page.includes(line), `the Bluetooth page no longer says ${line}, which the email’s “more lag and does less, with no editing or saving” stands on`)
    }
    const settings = read('mobile/src/screens/Settings.js').replace(/\s+/g, ' ')
    assert.ok(settings.indexOf('<SetupRow title="Bluetooth (beta)"') > settings.indexOf('<Group title="My rig">'), 'the email sends them to Settings → My rig → Bluetooth (beta), which is not there')
  })

  test('the way it goes on is written down: only for the build that opens it, in both stores, and Justin reads the sample before a customer gets one', () => {
    const readme = read('supabase/README.md').replace(/\s+/g, ' ')
    const from = readme.indexOf('### Bluetooth (beta) in the emails, from 1.89.0')
    assert.ok(from > 0, 'supabase/README.md does not say how the Bluetooth (beta) wording goes on')
    const section = readme.slice(from, readme.indexOf('## ', from + 4))
    assert.match(section, /`BLUETOOTH_IN_EMAILS = false`/)
    assert.match(section, /the day 1\.89\.0 is live on the App Store and on Google Play, both, and only if 1\.89\.0 is the build that opens Bluetooth \(beta\) to customers\*\*: its row in docs\/expo-builds\.md says "Bluetooth \(beta\) for customers", for both phones/, 'the README switches it on for any 1.89.0 in the stores')
    /* The test is a guard against the plain mistake, and never said to be more. */
    assert.ok(!/cannot go on early by accident/.test(section), 'the README says the test alone keeps the switch from going on early')
    assert.match(section, /It only reads those files, so it catches the switch turned on before they were moved, not a file moved wrong/)
    /* In this order: off, redeploy, the sample read, and only then on again. */
    const at = (s) => {
      const i = section.indexOf(s)
      assert.ok(i > 0, `the README’s steps no longer say ${s}`)
      return i
    }
    const steps = [
      at('set `BLUETOOTH_IN_EMAILS = true`'),
      at('Turn the setup emails off'),
      at('`supabase functions deploy setup-reminder --no-verify-jwt`'),
      at('Send me a sample of both emails'),
      at('Turn the setup emails on again')
    ]
    assert.deepEqual([...steps].sort((a, b) => a - b), steps, 'the README redeploys before the setup emails are off, or turns them on before the sample is read')
    assert.ok(section.includes('Idempotency-Key'), 'the README lost the note on the day’s one possible missed email')
    /* The buttons it names are the Developer page's own, and the sample needs no switch. */
    const tool = read('mobile/src/components/StuckTool.js')
    for (const label of ['Turn the setup emails off', 'Turn the setup emails on', 'Send me a sample of both emails']) assert.ok(tool.includes(`'${label}'`), `the Developer page has no “${label}”`)
    assert.match(read('shared/admin.mjs'), /Have you read the sample and left out the accounts that should never get one\?/, 'turning the emails on no longer asks whether the sample was read')
    const fn = code(read('supabase/functions/setup-reminder/index.ts'))
    assert.ok(fn.indexOf("input?.action !== 'sample'") > 0 && fn.indexOf("input?.action !== 'sample'") < fn.indexOf("rpc('setup_reminder_sending'"), 'the sample reads the switch, so it cannot be read with the emails off')
  })

  /*
   * THE BUTTONS THE EMAILS NAME ARE THE COMPUTER APP'S OWN. These emails are
   * for the people who stopped at signing in, and the computer app's first
   * screen offers a free way in that needs no sign-in at all, so the email
   * names the door rather than saying "sign in". The function cannot import
   * the app's words (it deploys from its own folder), so they are held equal
   * here: rename a button and this fails until the email says the new name.
   */
  test('the setup emails name the computer app’s own buttons, as the app has them', async () => {
    const fn = read('supabase/functions/setup-reminder/index.ts')
    const { P1 } = await import('../shared/onboarding.mjs')
    assert.equal(fn.match(/const I_HAVE_ONE = '([^']+)'/)?.[1], P1.haveCode, 'the email names a first-screen button the computer app does not have')
    /* That button is on the computer's first screen, and it opens the computer's sign-in. */
    const walk = read('src/components/PhoneWalkthrough.jsx').replace(/\s+/g, ' ')
    const welcome = walk.slice(walk.indexOf("{at === 'welcome' ? ("), walk.indexOf("{at === 'how' ? ("))
    assert.match(welcome, /onClick=\{\(\) => leave\(onAccount\)\}> \{P1\.haveCode\} <\/button>/, 'the first screen no longer has the button the email names')
    const app = read('src/App.jsx').replace(/\s+/g, ' ')
    assert.match(app, /onAccount=\{\(\) => computerEnd \? linkAction\('mac-setup'\)/, 'on a computer that button no longer opens the sign-in')
    /* And the way in for a computer app already past that screen: the gear's Settings, its row, the row's button. */
    const door = fn.match(/const SETTINGS_DOOR = \{ row: '([^']+)', button: '([^']+)' \}/)
    assert.ok(door, 'the email’s Settings door moved; this check reads it')
    assert.match(read('src/components/TopBar.jsx'), /className="topbar-gear"\s+onClick=\{onOpenSettings\}/, 'Settings is no longer behind the gear')
    assert.match(app, /title="Settings"/, 'the computer’s Settings is called something else now')
    assert.ok(app.includes(`<SetupRow key="link" title="${door[1]}"`), `Settings has no row called ${door[1]}`)
    assert.match(read('src/components/PhoneRemote.jsx').replace(/\s+/g, ' '), new RegExp(`onAction\\('mac-setup'\\)\\} disabled=\\{busy\\}> ${door[2]} </button>`), `${door[1]} has no button called ${door[2]}`)
  })

  test('the setup emails’ database: only the server reaches it, it starts switched off, and two emails is the most anybody gets', async () => {
    const sql = sqlOf(SETUP_SQL)
    /* Every function: fixed path, definer, revoked from everyone, granted to the server alone. */
    const made = [...sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map((m) => m[1])
    assert.ok(made.length >= 12, 'the migration lost its functions')
    for (const name of made) {
      const { head } = fnBody(sql, name)
      assert.match(head, /security definer set search_path = ''/, `${name} resolves names through the caller’s path`)
      assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`), `${name} can be called by anybody, signed in or not`)
      assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role;`), `${name} cannot be called by the server`)
    }
    /* A client role anywhere after `to`, first in the list or not. */
    assert.ok(!/\bgrant\b[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/.test(sql), 'something here is granted to a client')
    for (const fn of ['owner_setup_stuck', 'set_setup_reminder_switch', 'set_setup_left_out', 'claim_setup_reminder', 'clear_setup_reminder_refusal']) assert.ok(made.includes(fn), `the migration has no ${fn}`)
    /* Every table: row-level security on, no policy, no client grant. */
    const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1])
    assert.deepEqual(tables, ['computer_seen', 'unlock_seen', 'setup_reminders', 'setup_reminder_switch'])
    for (const t of tables) {
      assert.ok(sql.includes(`alter table public.${t} enable row level security;`), `${t} has no row-level security`)
      assert.ok(sql.includes(`revoke all on table public.${t} from public, anon, authenticated;`), `a client can read ${t}`)
    }
    assert.ok(!/create policy/.test(sql), 'a policy opens one of the tables to a client')
    /* Deleting the account clears every date kept. */
    for (const t of ['computer_seen', 'unlock_seen', 'setup_reminders']) {
      assert.match(sql, new RegExp(`create table if not exists public\\.${t} \\( account_id uuid primary key references auth\\.users \\(id\\) on delete cascade,`), `${t} outlives the account`)
    }
    /* Filled by looking, never by a trigger on who has paid or on a sign-in. */
    assert.ok(!/create trigger|create or replace trigger/.test(sql), 'the setup emails put a trigger on something')
    /* Off to begin with. */
    assert.match(sql, /sending boolean not null default false/, 'the switch starts on')
    assert.match(sql, /insert into public\.setup_reminder_switch \(id, sending\) values \(true, false\) on conflict \(id\) do nothing;/, 'the switch is made on, or turned off again by a second run')

    /* A computer is the device server or the computer app's window, in the ledger or signed in now. */
    const facts = fnBody(sql, 'note_setup_facts').body
    assert.match(facts, /\(s\.user_agent like 'node%' or s\.user_agent ilike '%electron%'\)/, 'a computer app signing in is not noted')
    assert.match(facts, /from public\.entitlements e where e\.active and e\.source = 'revenuecat'/)
    const stuck = fnBody(sql, 'setup_stuck').body
    for (const [rule, why] of [
      [/where e\.active and e\.source = 'revenuecat'/, 'somebody without the full version, or an owner, is in'],
      [/and u\.deleted_at is null/, 'a deleted account is in'],
      [/and lower\(u\.email\) not like '%@pair\.fractal\.newbold\.cloud'/, 'a pairing code’s account is in'],
      [/and not exists \(select 1 from public\.computer_seen c where c\.account_id = e\.account_id\)/, 'somebody who once had a computer is in'],
      [/and not exists \( select 1 from auth\.sessions s where s\.user_id = e\.account_id and \(s\.user_agent like 'node%' or s\.user_agent ilike '%electron%'\) \)/, 'somebody with a computer signed in right now is in']
    ]) {
      assert.match(stuck, rule, why)
    }
    /* Who is due: confirmed, not left out, never after a refusal or a reminder, a day after, four days between. */
    const due = fnBody(sql, 'setup_due').body
    assert.match(due, /from public\.setup_stuck\(\) s where s\.confirmed and not s\.left_out and s\.failed_at is null and s\.reminder_sent_at is null and s\.unlocked_at <= now\(\) - interval '24 hours' and \(s\.first_sent_at is null or s\.first_sent_at <= now\(\) - interval '4 days'\)$/, 'the rule for who is due an email changed')
    assert.match(due, /case when s\.first_sent_at is null then 'first' else 'reminder' end/, 'an email other than the first or the reminder can be due')
    /* The claim checks the same rule, and only ever lands on a row that has not had that email. */
    const claim = fnBody(sql, 'claim_setup_reminder').body
    assert.match(claim, /if not exists \(select 1 from public\.setup_due\(\) d where d\.account_id = uid and d\.kind = which\) then return false;/, 'an email can be claimed for somebody the rule does not name')
    /* The switch, read again at every claim, before anything is written: off in the middle of a run stops the rest of it. */
    const off = claim.indexOf('if not public.setup_reminder_sending() then return false; end if;')
    assert.ok(off > 0, 'an email can be claimed with the setup emails switched off, so turning them off does not stop a run already sending')
    assert.ok(off < claim.indexOf('insert into public.setup_reminders') && off < claim.indexOf('update public.setup_reminders'), 'the claim writes before it reads the switch')
    assert.match(claim, /set first_sent_at = now\(\) where r\.first_sent_at is null and r\.reminder_sent_at is null and r\.failed_at is null and r\.left_out_at is null returning true into claimed;/, 'a first email can be claimed twice, or after a refusal')
    assert.match(claim, /set reminder_sent_at = now\(\) where r\.account_id = uid and r\.first_sent_at is not null and r\.first_sent_at <= now\(\) - interval '4 days' and r\.reminder_sent_at is null and r\.failed_at is null and r\.left_out_at is null returning true into claimed;/, 'a reminder can be claimed twice, early, or without a first')
    /*
     * NEVER A THIRD. A date that says an email went is set only by the claim
     * above, only where it is empty. It is emptied in two places only: a
     * refusal of that email, which keeps failed_at, and the take-back after
     * the mail service did not take it at all, which reaches only a claim of
     * the last fifteen minutes and never one with a refusal against it.
     * failed_at itself is emptied in one place only, Justin's Try the email
     * again, which touches nothing else: the refused email's date was
     * emptied when the refusal was written, so it is that one email due
     * again, never a second copy of one that went.
     */
    assert.equal((sql.match(/first_sent_at = now\(\)/g) || []).length, 1, 'a first email can be marked sent somewhere besides the claim')
    assert.equal((sql.match(/reminder_sent_at = now\(\)/g) || []).length, 1, 'a reminder can be marked sent somewhere besides the claim')
    const failed = fnBody(sql, 'note_setup_reminder_failed').body
    assert.match(failed, /set failed_at = now\(\), failed_kind = which, first_sent_at = case when which = 'first' then null else r\.first_sent_at end, reminder_sent_at = case when which = 'reminder' then null else r\.reminder_sent_at end/, 'a refusal empties a date without keeping the refusal')
    const cleared = fnBody(sql, 'clear_setup_reminder_refusal').body
    assert.match(cleared, /^declare cleared boolean; begin update public\.setup_reminders r set failed_at = null, failed_kind = null where r\.account_id = uid and r\.failed_at is not null returning true into cleared; return coalesce\(cleared, false\); end;$/, 'Try the email again changes more than the refusal, or for somebody with none')
    assert.ok(!/failed_at = null|failed_at = case|set failed_at = (?!now\(\))/.test(sql.replace(cleared, '')), 'a refusal can be forgotten somewhere besides Try the email again, and the emails start again')
    assert.ok(!/(first_sent_at|reminder_sent_at) = null/.test(sql), 'a date that says an email went can be emptied')
    const emptied = [...sql.matchAll(/create or replace function public\.(\w+)\([^)]*\)[^$]*\$\$((?:(?!\$\$).)*)\$\$/g)].filter((m) => /(first_sent_at|reminder_sent_at) = case/.test(m[2])).map((m) => m[1])
    assert.deepEqual(emptied, ['note_setup_reminder_failed', 'release_setup_reminder'], 'a date that says an email went is emptied somewhere new')
    const release = fnBody(sql, 'release_setup_reminder').body
    assert.match(release, /set first_sent_at = case when which = 'first' then null else r\.first_sent_at end, reminder_sent_at = case when which = 'reminder' then null else r\.reminder_sent_at end where r\.account_id = uid and which in \('first', 'reminder'\) and r\.failed_at is null and \(case when which = 'first' then r\.first_sent_at else r\.reminder_sent_at end\) > now\(\) - interval '15 minutes'$/, 'a claim can be taken back long after, or after a refusal, which would let an email that went go again')
    assert.ok(!/failed_at|left_out_at/.test(release.replace(/and r\.failed_at is null/, '')), 'taking a claim back changes a refusal or a leave-out')
    const leftOut = fnBody(sql, 'set_setup_left_out').body
    assert.ok(!/first_sent_at|reminder_sent_at|failed_at/.test(leftOut), 'putting somebody back starts their emails again')
    /* His own account is left out from the start, by the same id as the tools. */
    const { ADMINS } = await import('../shared/admin.mjs')
    const seeded = sql.match(/insert into public\.setup_reminders as r \(account_id, left_out_at\) select u\.id, now\(\) from auth\.users u where u\.id = '([0-9a-f-]{36})'/)?.[1]
    assert.deepEqual([seeded], ADMINS, 'Justin’s own account is not left out, or by some other id')
    /* What the schedule calls, and how. */
    const call = fnBody(sql, 'run_setup_reminders').body
    assert.match(call, /begin perform net\.http_post\( url := fn_url, [^;]*\); exception when others then raise log/, 'the call to the email is not inside an exception block')
    assert.ok(!/extensions\.net\.http_post/.test(sql), 'net.http_post is named as a cross-database reference again')
    assert.match(call, /fn_url text := 'https:\/\/biznwrqeckviawjuhvyg\.supabase\.co\/functions\/v1\/setup-reminder'/)
    /* The schedule in a file of its own, so a refusal there cannot sink the tables. */
    assert.ok(!/\bcron\./.test(sql), 'the schedule is in the same file as the tables')
    const schedule = sqlOf(SETUP_SCHEDULE)
    /* With the two grants Supabase's own pg_cron steps give the postgres role, and nothing else. */
    assert.match(schedule, /^create extension if not exists pg_cron with schema pg_catalog; grant usage on schema cron to postgres; grant all privileges on all tables in schema cron to postgres; select cron\.schedule\('setup-reminders', '23 \* \* \* \*', \$\$select public\.run_setup_reminders\(\)\$\$\);$/, 'the schedule is not one hourly call and nothing else')
    /* And the function reads the switch, the due list and the claim by these names. */
    const fn = code(read('supabase/functions/setup-reminder/index.ts'))
    for (const name of ['setup_reminder_hook_secret', 'setup_reminder_sending', 'setup_reminders_due', 'claim_setup_reminder', 'note_setup_reminder_failed', 'release_setup_reminder']) {
      assert.ok(fn.includes(`'${name}'`), `the function no longer asks ${name}`)
      assert.ok(made.includes(name), `the function asks ${name}, which the migration does not make`)
    }
    const sends = fn.indexOf('await send(key, to, kind, { account: id })')
    assert.ok(sends > 0, 'the real email no longer goes through send() with the account it is for')
    assert.ok(fn.indexOf("rpc('claim_setup_reminder'") < sends, 'the email is sent before it is claimed')
    /* Yesterday's question stays exactly as it was. */
    assert.ok(!read(SETUP_SQL).includes('account_has_computer()'), 'the setup emails change the phone’s question about a computer')
  })

  test('Paid but no computer yet is his alone: no token, a stale one, a stranger’s and the server’s own key are turned away before anything is read', async () => {
    for (const body of [{ action: 'stuck' }, { action: 'reminders', on: true }, { action: 'leave-out', email: 'fan@example.com', out: true }, { action: 'try-again', email: 'fan@example.com' }, { action: 'reminder-sample' }]) {
      for (const [who, token, status] of [
        ['nobody signed in', undefined, 403],
        ['a token that has run out', 'an-expired-token', 403],
        ['somebody else', 'a-strangers-token', 403],
        ['the server’s own key', SERVICE, 400]
      ]) {
        const run = await grantAccess({ token, body, rpcs: { owner_setup_stuck: { stuck: [] }, set_setup_reminder_switch: true, set_setup_left_out: true, clear_setup_reminder_refusal: true }, setup: { status: 200, body: { ok: true } } })
        assert.equal(run.status, status, `${who} asking ${body.action} was answered ${run.status}`)
        assert.equal(run.said.ok, false, `${who} was told ${body.action} worked`)
        assert.ok(!run.calls.some((c) => c.url.includes('/rest/v1/rpc/')), `${who} had the database asked for ${body.action}`)
        assert.ok(!run.calls.some((c) => c.url.includes('/functions/v1/setup-reminder')), `${who} had a sample sent`)
      }
    }
    /* And the phone and the browser draw the page for his account alone. */
    const settings = read('mobile/src/screens/Settings.js').replace(/\s+/g, ' ')
    assert.match(settings, /\{page === 'stuck' && isAdmin\(account\?\.id\) \? \( <> \{head\('Paid but no computer yet', 'back'\)\} <StuckTool \/>/, 'the list is drawn for somebody other than Justin')
    const developer = settings.slice(settings.indexOf("{page === 'developer' && isAdmin(account?.id) ? ("), settings.indexOf('{/* ------------------------------------------------------ appearance */}'))
    assert.match(developer, /<SetupRow title="Paid but no computer yet" status="[^"]+" onPress=\{\(\) => setPage\('stuck'\)\} \/>/, 'the list’s row is not on the Developer page, which is his alone')
    assert.ok(!/setPage\('stuck'\)/.test(settings.replace(developer, '')), 'the list can be opened from somewhere besides the Developer page')
  })

  test('Paid but no computer yet: the list, the switch, leaving somebody out and the sample, as he sees them', async () => {
    const DAY = 86400000
    const now = Date.parse('2026-10-20T12:00:00Z')
    const iso = (ms) => new Date(ms).toISOString()
    const rows = [
      { id: CUSTOMER, email: 'fan@example.com', confirmed: true, unlocked_at: iso(now - 3 * DAY), estimated: false, first_sent_at: iso(now - 2 * DAY), reminder_sent_at: null, failed_at: null, failed_kind: null, left_out: false },
      { id: 'acct-given', email: 'tester@example.com', confirmed: true, unlocked_at: iso(now - 10 * DAY), estimated: true, first_sent_at: null, reminder_sent_at: null, failed_at: null, failed_kind: null, left_out: true },
      { id: 'acct-new', email: 'new@example.com', confirmed: false, unlocked_at: iso(now - 2 * 3600000), estimated: false, first_sent_at: null, reminder_sent_at: null, failed_at: null, failed_kind: null, left_out: false }
    ]
    const list = await grantAccess({
      token: 'his-token',
      body: { action: 'stuck' },
      rpcs: { owner_setup_stuck: { sending: false, due_first: 1, due_reminder: 0, set_up_after: 2, stuck: rows } },
      purchases: { [CUSTOMER]: [{ store: 'app_store', purchased_at: now - 3 * DAY, environment: 'production', status: 'owned' }], 'acct-given': [], 'acct-new': 'fail' }
    })
    assert.equal(list.status, 200, list.said.message)
    assert.equal(list.calls.filter((c) => c.url.endsWith('/rpc/owner_setup_stuck')).length, 1, 'the list is asked of the database more than once')
    assert.deepEqual(list.said.stuck.map((r) => r.paid?.store ?? null), ['app_store', 'promotional', null], 'how each got the full version is not RevenueCat’s word')
    assert.deepEqual([list.said.sending, list.said.dueFirst, list.said.dueReminder, list.said.setUpAfter, list.said.total], [false, 1, 0, 2, 3])

    const { stuckSections, stuckChoices, stuckProblem } = await import('../shared/admin.mjs')
    const sections = stuckSections(list.said, now)
    assert.equal(sections[0].title, 'Setup emails')
    assert.equal(sections[0].rows[0].value, 'Setup emails: off. Nothing is sent until you turn them on.')
    assert.deepEqual(sections[0].rows.slice(1).map((r) => [r.label, r.value]), [['Due now', '1 first email, 0 reminders'], ['Set up after an email', '2 people']])
    assert.equal(sections[1].title, 'Paid but no computer yet (3)')
    const [fan, tester, fresh] = sections[1].rows
    assert.equal(fan.value, 'fan@example.com\nPaid on the App Store, 3 days ago\nFirst email Oct 18, 2026. Reminder Oct 22, 2026, if there’s still no computer.')
    assert.equal(tester.value, 'tester@example.com\nGiven the full version by hand, on or before Oct 10, 2026\nLeft out: never emailed.')
    assert.equal(fresh.value, 'new@example.com\nGot the full version today\nEmail not confirmed, so the setup emails don’t go to them.\nNot emailed.')
    assert.deepEqual(stuckChoices(fan), { leaveOut: true, putBack: false, tryAgain: false })
    assert.deepEqual(stuckChoices(tester), { leaveOut: false, putBack: true, tryAgain: false })
    /* The other things a row can say. */
    const one = (row, sending = false) => stuckSections({ ok: true, sending, stuck: [{ email: 'a@b.co', confirmed: true, unlocked_at: iso(now - 9 * DAY), ...row }] }, now)[1].rows[0].line.split('\n').pop()
    assert.equal(one({}), 'Not emailed yet. It goes as soon as the emails are on.')
    assert.equal(one({}, true), 'Not emailed yet. The first goes within the hour.')
    assert.equal(one({ unlocked_at: iso(now - 3600000) }, true), 'Not emailed yet. The first goes a day after they got the full version.')
    assert.equal(one({ first_sent_at: iso(now - 5 * DAY) }, true), 'First email Oct 15, 2026. The reminder goes within the hour.')
    assert.equal(one({ first_sent_at: iso(now - 8 * DAY), reminder_sent_at: iso(now - 4 * DAY) }), 'First email Oct 12, 2026, reminder Oct 16, 2026. No more emails.')
    assert.equal(one({ failed_at: iso(now - DAY), failed_kind: 'first' }), 'The email to them was refused yesterday: the mail service won’t take their address. No more go unless you try again.')
    assert.equal(one({ first_sent_at: iso(now - 6 * DAY), failed_at: iso(now), failed_kind: 'reminder' }), 'First email Oct 14, 2026. The reminder to them was refused today: the mail service won’t take their address. No more go unless you try again.')
    /* A refused person can be tried again from their sheet; left out, there is nothing to try. */
    const refusedRow = (row) => stuckSections({ ok: true, stuck: [{ email: 'a@b.co', confirmed: true, unlocked_at: iso(now - 9 * DAY), ...row }] }, now)[1].rows[0]
    assert.deepEqual(stuckChoices(refusedRow({ failed_at: iso(now - DAY), failed_kind: 'first' })), { leaveOut: true, putBack: false, tryAgain: true })
    assert.deepEqual(stuckChoices(refusedRow({ failed_at: iso(now - DAY), failed_kind: 'first', left_out: true })), { leaveOut: false, putBack: true, tryAgain: false })
    assert.deepEqual(stuckChoices(refusedRow({})), { leaveOut: true, putBack: false, tryAgain: false })
    assert.match(stuckSections({ ok: true, sending: true, stuck: [] }, now)[0].rows[0].value, /^Setup emails: on\./)
    assert.equal(stuckSections({ ok: true, stuck: [] }, now)[1].rows[0].value, 'Nobody. Everyone with the full version has had a computer signed in.')
    for (const s of sections) for (const r of s.rows) assert.ok(!/\bMac\b/.test(r.value), `the list calls the computer a Mac: ${r.value}`)

    /* A server or a database without it says so, in words. */
    assert.match(stuckProblem({ ok: false, message: 'Unknown action.' }), /^The server doesn’t have this list yet\./)
    assert.match(stuckProblem({ ok: false, message: 'Something went wrong: owner_setup_stuck: 404 {"code":"PGRST202"}' }), /^The database doesn’t have this list yet\./)
    assert.match(stuckProblem({ ok: false, message: 'Something went wrong: clear_setup_reminder_refusal: 404' }), /^The database doesn’t have this list yet\./)
    assert.equal(stuckProblem({ ok: true }), null)

    /* The switch: only exactly true turns it on. */
    for (const [on, sent] of [[true, true], ['yes', false], [1, false], [undefined, false], [false, false]]) {
      const turned = await grantAccess({ token: 'his-token', body: { action: 'reminders', on }, rpcs: { set_setup_reminder_switch: (b) => b.turn_on } })
      const asked = turned.calls.filter((c) => c.url.endsWith('/rpc/set_setup_reminder_switch'))
      assert.deepEqual(asked.map((c) => c.body), [{ turn_on: sent }], `on: ${JSON.stringify(on)} turned the emails ${sent ? 'off' : 'on'}`)
      assert.equal(turned.said.sending, sent)
    }

    /* Leave somebody out by their account, found by address; out: false puts them back. */
    const account = { id: CUSTOMER, email: 'fan@example.com', confirmed: '2026-10-01T09:00:00Z' }
    const out = await grantAccess({ token: 'his-token', body: { action: 'leave-out', email: 'Fan@Example.com ', out: true }, account, rpcs: { set_setup_left_out: (b) => b.leave_out } })
    assert.deepEqual(out.calls.filter((c) => c.url.endsWith('/rpc/set_setup_left_out')).map((c) => c.body), [{ uid: CUSTOMER, leave_out: true }])
    assert.equal(out.said.leftOut, true)
    assert.match(out.said.message, /^fan@example\.com is left out\./)
    const back = await grantAccess({ token: 'his-token', body: { action: 'leave-out', email: 'fan@example.com', out: false }, account, rpcs: { set_setup_left_out: (b) => b.leave_out } })
    assert.deepEqual(back.calls.filter((c) => c.url.endsWith('/rpc/set_setup_left_out')).map((c) => c.body), [{ uid: CUSTOMER, leave_out: false }])
    const nobody = await grantAccess({ token: 'his-token', body: { action: 'leave-out', email: 'gone@example.com', out: true }, account: null, rpcs: { set_setup_left_out: true } })
    assert.equal(nobody.said.ok, false)
    assert.ok(!nobody.calls.some((c) => c.url.endsWith('/rpc/set_setup_left_out')), 'somebody with no account was left out')

    /* Try the email again: their refusal forgotten, by their account, found by address; nothing else asked. */
    const again = await grantAccess({ token: 'his-token', body: { action: 'try-again', email: 'Fan@Example.com ' }, account, rpcs: { clear_setup_reminder_refusal: true } })
    assert.equal(again.status, 200, again.said.message)
    assert.deepEqual(again.calls.filter((c) => c.url.includes('/rest/v1/rpc/') && !c.url.endsWith('/rpc/account_details')).map((c) => [c.url.split('/rpc/')[1], c.body]), [['clear_setup_reminder_refusal', { uid: CUSTOMER }]], 'Try the email again asks the database for something else')
    assert.equal(again.said.cleared, true)
    assert.equal(again.said.message, 'The email to fan@example.com will be tried again within the hour, if the setup emails are on and they still have no computer.')
    const none = await grantAccess({ token: 'his-token', body: { action: 'try-again', email: 'fan@example.com' }, account, rpcs: { clear_setup_reminder_refusal: false } })
    assert.equal(none.said.cleared, false)
    assert.equal(none.said.message, 'Nothing to them was refused, so there is nothing to try again.')
    const noone = await grantAccess({ token: 'his-token', body: { action: 'try-again', email: 'gone@example.com' }, account: null, rpcs: { clear_setup_reminder_refusal: true } })
    assert.equal(noone.said.ok, false)
    assert.ok(!noone.calls.some((c) => c.url.endsWith('/rpc/clear_setup_reminder_refusal')), 'somebody with no account had a refusal forgotten')
    const typed = await grantAccess({ token: 'his-token', body: { action: 'try-again' }, account, rpcs: { clear_setup_reminder_refusal: true } })
    assert.equal(typed.status, 400, 'Try the email again went ahead with no address')
    assert.ok(!typed.calls.some((c) => c.url.endsWith('/rpc/clear_setup_reminder_refusal')))

    /* The sample: asked of the email function with the server's key, carrying no address. */
    const sample = await grantAccess({ token: 'his-token', body: { action: 'reminder-sample', email: 'attacker@example.com' }, setup: { status: 200, body: { ok: true, sent: 2 } } })
    const asked = sample.calls.filter((c) => c.url === `${PROJECT}/functions/v1/setup-reminder`)
    assert.equal(asked.length, 1)
    assert.deepEqual(asked[0].body, { action: 'sample' }, 'the sample request carries an address')
    assert.equal(asked[0].headers.Authorization, `Bearer ${SERVICE}`)
    assert.match(sample.said.message, /^Both setup emails are on their way to your Gmail, marked \[Sample\]\./)
    const missing = await grantAccess({ token: 'his-token', body: { action: 'reminder-sample' }, setup: { status: 404, body: {} } })
    assert.match(missing.said.message, /isn’t on the server yet/)

    /* And accessAction carries the switch's and the leave-out's one extra, never a different action or address. */
    const { accessAction } = await import('../shared/admin.mjs')
    let posted = null
    await accessAction({ url: 'https://x', anonKey: 'k', token: 't', action: 'leave-out', email: 'a@b.co', extra: { out: false, action: 'grant', email: 'other@b.co' }, fetchImpl: async (u, init) => ((posted = JSON.parse(init.body)), new Response('{"ok":true}')) })
    assert.deepEqual(posted, { out: false, action: 'leave-out', email: 'a@b.co' }, 'an extra can change which action is asked, or about whom')
  })

  /*
   * SALES AT A GLANCE: HANDLED. "I've already handled this paid twice thing
   * ... I wanna [be able to] mark as completed or so that it doesn't appear
   * anymore after it's been handled. And probably doesn't need to be at the
   * top of the list you know." (15 October 2026.)
   */
  test('Sales leaves out a row marked handled and says how many, and a new purchase by that person brings them back', async () => {
    const DAY = 86400000
    const HOUR = 3600000
    const now = Date.now()
    const buyers = [{ id: CUSTOMER, email: 'p@x.com' }, { id: 'acct-q', email: 'q@x.com' }]
    const paid = (store, at, extra = {}) => ({ store, purchased_at: at, environment: 'production', status: 'owned', ...extra })
    const pApp = now - 7 * DAY
    const pCard = now - 7 * DAY + HOUR
    const uApp = now - 2 * DAY
    const users = [{ id: 'acct-u', email: 'u@x.com', created_at: new Date(now - 2 * DAY).toISOString(), email_confirmed_at: null }]
    const purchases = {
      [CUSTOMER]: [paid('app_store', pApp), paid('rc_billing', pCard)],
      'acct-q': [paid('play_store', now - 5 * DAY), paid('app_store', now - 4 * DAY)],
      'acct-u': [paid('app_store', uApp)]
    }
    const sales = (marks, bought = purchases, who = buyers) =>
      grantAccess({
        token: 'his-token',
        body: { action: 'sales' },
        rpcs: { owner_overview: { accounts: 3, buyers: who }, ...(marks === undefined ? {} : { sales_handled_list: marks }) },
        purchases: bought,
        users
      })
    const { salesSections, withHandled } = await import('../shared/admin.mjs')
    const rowsOf = (said) => salesSections(said, now).flatMap((s) => s.rows)
    const emailsIn = (said) => rowsOf(said).map((r) => r.email).filter(Boolean)
    const mark = (id, kind, paidUntil, bought, near = 0) => ({ id, kind, paid_until: paidUntil, bought_count: bought, near_count: near })

    /* Nothing marked: both lists in full, each row with how many purchases it counts. */
    const before = await sales([])
    assert.equal(before.status, 200, before.said.message)
    assert.deepEqual(before.said.twice.map((t) => [t.email, t.count]), [['p@x.com', 2], ['q@x.com', 2]])
    assert.deepEqual(before.said.unconfirmed.map((u) => [u.email, u.count, u.nearCount]), [['u@x.com', 1, 0]])
    assert.deepEqual(before.said.handled, { twice: 0, unconfirmed: 0 })

    /* Marked, as each row showed it: gone, and counted. A mark on the other list hides nothing. */
    const marks = [mark(CUSTOMER, 'twice', pCard, 2), mark('acct-u', 'unconfirmed', uApp, 1, 0), mark('acct-q', 'unconfirmed', now, 100, 100)]
    const after = await sales(marks)
    assert.deepEqual(after.said.twice.map((t) => t.email), ['q@x.com'], 'a row marked handled is still listed, or a mark on the other list hid one')
    assert.deepEqual(after.said.unconfirmed, [], 'a never-confirmed row marked handled is still listed')
    assert.deepEqual(after.said.handled, { twice: 1, unconfirmed: 1 })
    assert.ok(after.said.sales.some((s) => s.email === 'p@x.com'), 'a handled row’s purchases stopped counting as sales')
    assert.deepEqual(emailsIn(after.said), ['q@x.com'], 'the page still draws a row marked handled')
    const notes = salesSections(after.said, now).find((s) => s.title === 'Note').rows.map((r) => r.value)
    assert.deepEqual(notes, ['Paid twice: 1 handled earlier.', 'Paid, account never confirmed: 1 handled earlier.'])
    /* A mark from a database that keeps no counts hides nothing: it fails toward showing. */
    const noCounts = await sales([{ id: CUSTOMER, kind: 'twice', paid_until: now }])
    assert.ok(noCounts.said.twice.some((t) => t.email === 'p@x.com'), 'a mark with no count hid a row')

    /* A refund after the mark brings nobody back: RevenueCat keeps the refunded purchase, so the count stands. */
    const refunded = await sales([mark(CUSTOMER, 'twice', now - DAY, 3)], {
      ...purchases,
      [CUSTOMER]: [paid('app_store', pApp), paid('rc_billing', pCard), paid('play_store', now - DAY, { status: 'refunded' })]
    })
    assert.ok(!refunded.said.twice.some((t) => t.email === 'p@x.com'), 'a refund brought a handled row back')
    assert.equal(refunded.said.handled.twice, 1)

    /* A NEW payment by the same person, after the newest one marked: back on the list, all three purchases named. */
    const again = await sales(marks, {
      ...purchases,
      [CUSTOMER]: [...purchases[CUSTOMER], paid('play_store', now - HOUR)],
      'acct-u': [...purchases['acct-u'], paid('rc_billing', now - HOUR / 2)]
    })
    const back = again.said.twice.find((t) => t.email === 'p@x.com')
    assert.ok(back, 'paying twice again after being marked handled does not show them again')
    assert.deepEqual(back.stores, ['app_store', 'rc_billing', 'play_store'])
    assert.deepEqual(again.said.unconfirmed.map((u) => u.email), ['u@x.com'], 'a new purchase on a never-confirmed account marked handled does not show it again')
    assert.deepEqual(again.said.handled, { twice: 0, unconfirmed: 0 })
    assert.ok(emailsIn(again.said).includes('p@x.com'))

    /*
     * A new payment dated BEFORE the newest one marked. This is how paying
     * twice happens here: a phone that bought before it signed in brings its
     * purchase onto the account later, with its own date. Three real
     * payments, and the newest date has not moved: back, all three named.
     */
    const pPhone = pApp + HOUR / 2
    const late = await sales(marks, { ...purchases, [CUSTOMER]: [...purchases[CUSTOMER], paid('play_store', pPhone)] })
    const lateRow = late.said.twice.find((t) => t.email === 'p@x.com')
    assert.ok(lateRow, 'a third payment dated before the mark, brought across after it, stayed hidden')
    assert.deepEqual([lateRow.stores, lateRow.count], [['app_store', 'rc_billing', 'play_store'], 3])
    assert.equal(late.said.handled.twice, 0)

    /* The same, after he refunded the card and marked the row from the page as it was: the refund does not make room for it. */
    const refundThenPhone = await sales([mark(CUSTOMER, 'twice', pCard, 2)], {
      ...purchases,
      [CUSTOMER]: [paid('app_store', pApp), paid('rc_billing', pCard, { status: 'refunded' }), paid('play_store', pPhone)]
    })
    assert.deepEqual(refundThenPhone.said.twice.find((t) => t.email === 'p@x.com')?.stores, ['app_store', 'play_store'], 'a refund and then a new payment kept a handled row hidden')

    /*
     * Paid, account never confirmed: the sign that they paid twice is a card
     * sale on the website to another address, within a day. Made after the
     * mark, it adds nothing to the row's own purchases, and still brings it
     * back. The row's `until` takes the card sales beside it in, and
     * `nearCount` counts sales, not addresses. Marked with it already named,
     * it stays left out, and its refund makes no room for another.
     */
    const withW = [...buyers, { id: 'acct-w', email: 'w@x.com' }]
    const wCard = { ...purchases, 'acct-w': [paid('rc_billing', uApp + HOUR)] }
    const unmarked = await sales([], wCard, withW)
    assert.deepEqual(unmarked.said.unconfirmed.map((u) => [u.email, u.near, u.nearCount, u.until]), [['u@x.com', ['w@x.com'], 1, uApp + HOUR]])
    const cardAfter = await sales(marks, wCard, withW)
    assert.deepEqual(cardAfter.said.unconfirmed.map((u) => [u.email, u.near]), [['u@x.com', ['w@x.com']]], 'a card sale beside a handled never-confirmed row, made after the mark, did not bring it back')
    assert.equal(cardAfter.said.handled.unconfirmed, 0)
    /* As the page marks it (the round trip below checks the page sends exactly this). */
    const seenW = [mark(CUSTOMER, 'twice', pCard, 2), mark('acct-u', 'unconfirmed', uApp + HOUR, 1, 1)]
    const unchanged = await sales(seenW, wCard, withW)
    assert.deepEqual(unchanged.said.unconfirmed, [], 'a row marked with its card sale already named came back')
    assert.equal(unchanged.said.handled.unconfirmed, 1)
    /*
     * W's card sale refunded. A buyer whose only purchase is refunded is no
     * longer a paying account: revenuecat-webhook writes it inactive, and
     * owner_overview lists only active ones (`where e.source = 'revenuecat'
     * and e.active`), so Sales stops asking about W, and the card sales
     * beside the row go DOWN, to none. Nothing new was bought: still left out.
     */
    const wRefunded = { ...purchases, 'acct-w': [paid('rc_billing', uApp + HOUR, { status: 'refunded' })] }
    const refundedOut = await sales(seenW, wRefunded, buyers)
    assert.deepEqual(refundedOut.said.unconfirmed, [], 'refunding the card sale named beside it brought the row back')
    assert.equal(refundedOut.said.handled.unconfirmed, 1)
    /* And when W is still a paying account (given the full version by hand after the refund, say): the same. Unmarked, the refunded sale is counted but no longer named. */
    assert.deepEqual((await sales(seenW, wRefunded, withW)).said.unconfirmed, [], 'refunding the card sale named beside it, with W still listed, brought the row back')
    assert.deepEqual((await sales([], wRefunded, withW)).said.unconfirmed.map((u) => [u.email, u.near, u.nearCount, u.until]), [['u@x.com', [], 1, uApp + HOUR]], 'a refunded card sale is named beside the row, or not counted')
    /*
     * Then somebody else pays by card beside it. W has dropped out, so that
     * is one card sale beside the row, no more than marked, but it is newer
     * than anything marked: back.
     */
    const zAfterRefund = await sales(seenW, { ...wRefunded, 'acct-z': [paid('rc_billing', uApp + 2 * HOUR)] }, [...buyers, { id: 'acct-z', email: 'z@x.com' }])
    assert.deepEqual(zAfterRefund.said.unconfirmed.map((u) => [u.email, u.near, u.nearCount, u.until]), [['u@x.com', ['z@x.com'], 1, uApp + 2 * HOUR]], 'a new card sale after the named one was refunded and dropped out stayed hidden')
    assert.equal(zAfterRefund.said.handled.unconfirmed, 0)
    /*
     * Or W, locked out by the refund, pays by card again on the same address.
     * Still one address, so counting addresses would not move; two card
     * sales, and the new one newer than the mark: back. And not Paid twice
     * either, because W's first one was refunded.
     */
    const wAgain = await sales(seenW, { ...purchases, 'acct-w': [paid('rc_billing', uApp + HOUR, { status: 'refunded' }), paid('rc_billing', uApp + 3 * HOUR)] }, withW)
    assert.deepEqual(wAgain.said.unconfirmed.map((u) => [u.email, u.near, u.nearCount, u.until]), [['u@x.com', ['w@x.com'], 2, uApp + 3 * HOUR]], 'the address named beside it paying again after its refund stayed hidden')
    assert.ok(!wAgain.said.twice.some((t) => t.email === 'w@x.com'), 'a refunded card sale and a new one were called Paid twice')
    assert.equal(wAgain.said.handled.unconfirmed, 0)

    /* A database without the marks yet (the migration not applied): Sales still stands, with every row. */
    const older = await sales(undefined)
    assert.equal(older.said.ok, true, 'Sales broke on a database without the handled marks')
    assert.deepEqual(older.said.twice.map((t) => t.email), ['p@x.com', 'q@x.com'])

    /*
     * The round trip: the row the page draws carries what it showed (the
     * newest purchase, how many, and how many card sales beside it), Handled
     * sends exactly that, and the server's rule leaves that row out. The page
     * leaves it out at once as well (withHandled), by the same rule.
     */
    const row = rowsOf(before.said).find((r) => r.email === 'q@x.com')
    assert.deepEqual([row.kind, row.until, row.count, row.nearCount], ['twice', now - 4 * DAY, 2, 0])
    const told = await grantAccess({
      token: 'his-token',
      body: { action: 'handled', email: row.email, kind: row.kind, until: row.until, count: row.count, nearCount: row.nearCount },
      account: { id: 'acct-q', email: 'q@x.com' },
      rpcs: { mark_sales_handled: true }
    })
    assert.equal(told.said.ok, true, told.said.message)
    assert.equal(told.said.message, 'q@x.com is marked handled.')
    const marked = told.calls.filter((c) => c.url.endsWith('/rpc/mark_sales_handled')).map((c) => c.body)
    assert.deepEqual(marked, [{ uid: 'acct-q', what: 'twice', newest: now - 4 * DAY, bought: 2, near: 0 }], 'the mark is not the account, the list and what the row showed')
    const asStored = (m) => mark(m.uid, m.what, m.newest, m.bought, m.near)
    const roundTrip = await sales([asStored(marked[0])])
    assert.ok(!roundTrip.said.twice.some((t) => t.email === 'q@x.com'), 'the mark the page sends does not hide the row it was sent for')
    /* And a never-confirmed row with a card sale beside it. */
    const uRow = rowsOf(unmarked.said).find((r) => r.email === 'u@x.com')
    assert.deepEqual([uRow.kind, uRow.until, uRow.count, uRow.nearCount], ['unconfirmed', uApp + HOUR, 1, 1], 'the page does not carry the server’s own until for a never-confirmed row')
    const toldU = await grantAccess({
      token: 'his-token',
      body: { action: 'handled', email: uRow.email, kind: uRow.kind, until: uRow.until, count: uRow.count, nearCount: uRow.nearCount },
      account: { id: 'acct-u', email: 'u@x.com' },
      rpcs: { mark_sales_handled: true }
    })
    const markedU = toldU.calls.filter((c) => c.url.endsWith('/rpc/mark_sales_handled')).map((c) => c.body)
    assert.deepEqual(markedU, [{ uid: 'acct-u', what: 'unconfirmed', newest: uApp + HOUR, bought: 1, near: 1 }])
    assert.deepEqual(asStored(markedU[0]), seenW[1], 'the stories above were not marked as the page marks them')
    assert.deepEqual((await sales([asStored(markedU[0])], wCard, withW)).said.unconfirmed, [], 'the mark the page sends does not hide the never-confirmed row it was sent for')

    const local = withHandled(before.said, row)
    assert.deepEqual(local.twice.map((t) => t.email), ['p@x.com'])
    assert.deepEqual(local.handled, { twice: 1, unconfirmed: 0 })
    const pRow = rowsOf(before.said).find((r) => r.email === 'p@x.com')
    assert.equal(withHandled(again.said, pRow), again.said, 'the page hid a row with a purchase newer than the one marked')
    assert.equal(withHandled(late.said, pRow), late.said, 'the page hid a row with a third purchase dated before the one marked')
    const uBefore = rowsOf(before.said).find((r) => r.email === 'u@x.com')
    assert.equal(withHandled(cardAfter.said, uBefore), cardAfter.said, 'the page hid a row with a card sale named beside it since')
    assert.equal(withHandled(zAfterRefund.said, uRow), zAfterRefund.said, 'the page hid a row with a new card sale beside it after the named one dropped out')
    assert.equal(withHandled(wAgain.said, uRow), wAgain.said, 'the page hid a row whose named address paid again after its refund')
    assert.deepEqual(withHandled(unmarked.said, uRow).unconfirmed, [])
    assert.equal(withHandled({ ok: false }, row).ok, false)
  })

  test('Handled is his alone: no token, a stale one, a stranger’s and the server’s own key are turned away before anything is read, and an older server says so in words', async () => {
    const body = { action: 'handled', email: 'p@x.com', kind: 'twice', until: Date.now() - 86400000, count: 2 }
    for (const [who, token, status] of [
      ['nobody signed in', undefined, 403],
      ['a token that has run out', 'an-expired-token', 403],
      ['somebody else', 'a-strangers-token', 403],
      ['the server’s own key', SERVICE, 400]
    ]) {
      const run = await grantAccess({ token, body, account: { id: CUSTOMER, email: 'p@x.com' }, rpcs: { mark_sales_handled: true } })
      assert.equal(run.status, status, `${who} asking to mark a sale handled was answered ${run.status}`)
      assert.equal(run.said.ok, false, `${who} was told it was marked`)
      assert.ok(!run.calls.some((c) => c.url.includes('/rest/v1/rpc/')), `${who} had the database asked`)
    }
    /* Behind the lock, in the handler, as every other action is. */
    const server = code(read('supabase/functions/grant-access/index.ts'))
    const handler = server.slice(server.indexOf('Deno.serve('))
    assert.ok(handler.indexOf('ADMINS.includes(me.id)') < handler.indexOf('markHandled('), 'Handled runs before checking who is asking')
    assert.ok(handler.indexOf("rpc('account_details'") < handler.indexOf('markHandled('), 'Handled marks an account it did not look up')
    assert.equal((server.match(/rpc\('mark_sales_handled'/g) || []).length, 1, 'the mark is written somewhere besides Handled')

    /* Only the two lists, only a real purchase time, and only a count a row can have; nothing written otherwise. */
    for (const [over, why] of [
      [{ kind: 'sales' }, 'a third list'],
      [{ kind: undefined }, 'no list'],
      [{ until: undefined }, 'no time'],
      [{ until: '1760000000000' }, 'a time that is words'],
      [{ until: -1 }, 'a time before 1970'],
      [{ until: Date.now() + 30 * 86400000 }, 'a time next month, which would hide a new payment for a month'],
      [{ count: undefined }, 'no count, from a page that does not send one'],
      [{ count: '2' }, 'a count that is words'],
      [{ count: 2.5 }, 'half a purchase'],
      [{ count: 1 }, 'a Paid twice row with one purchase'],
      [{ count: 101 }, 'more purchases than the server ever reads, which would hide the next payment'],
      [{ kind: 'unconfirmed', count: 1 }, 'a never-confirmed row without its card sales'],
      [{ kind: 'unconfirmed', count: 1, nearCount: -1 }, 'fewer than no card sales'],
      [{ kind: 'unconfirmed', count: 1, nearCount: 600 * 100 + 1 }, 'more card sales than every account asked about could hold'],
      [{ kind: 'unconfirmed', count: 0, nearCount: 0 }, 'a never-confirmed row with no purchase']
    ]) {
      const run = await grantAccess({ token: 'his-token', body: { ...body, ...over }, account: { id: CUSTOMER, email: 'p@x.com' }, rpcs: { mark_sales_handled: true } })
      assert.equal(run.said.ok, false, `${why} was marked`)
      assert.ok(!run.calls.some((c) => c.url.endsWith('/rpc/mark_sales_handled')), `${why} was written`)
    }
    /* Card sales beside a row are counted one sale at a time, so more of them than there are accounts is a real row. */
    const many = await grantAccess({ token: 'his-token', body: { ...body, kind: 'unconfirmed', count: 1, nearCount: 601 }, account: { id: CUSTOMER, email: 'p@x.com' }, rpcs: { mark_sales_handled: true } })
    assert.equal(many.said.ok, true, 'a row with more card sales beside it than there are accounts could not be marked')
    const nobody = await grantAccess({ token: 'his-token', body, account: null, rpcs: { mark_sales_handled: true } })
    assert.equal(nobody.said.ok, false)
    assert.ok(!nobody.calls.some((c) => c.url.endsWith('/rpc/mark_sales_handled')), 'an address with no account was marked')

    /* A server from before Handled, and a database from before its table: plain words, not "Unknown action." or a stack. */
    const { handledProblem } = await import('../shared/admin.mjs')
    assert.equal(handledProblem({ ok: false, message: 'Unknown action.' }), 'Nothing was marked. The server doesn’t know Handled yet: it needs the server update that goes with it, which hasn’t been put live.')
    const noTable = await grantAccess({ token: 'his-token', body, account: { id: CUSTOMER, email: 'p@x.com' } })
    assert.equal(noTable.said.ok, false)
    assert.equal(handledProblem(noTable.said), 'Nothing was marked. The database has nowhere to keep it yet: it needs the database change that goes with it, which hasn’t been put live.')
    assert.equal(handledProblem({ ok: true }), null)
  })

  test('the handled marks’ database: only the server reaches it, a mark only moves forward, and it goes with the account', async () => {
    const sql = sqlOf('supabase/migrations/20261015_sales_handled.sql')
    const made = [...sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map((m) => m[1])
    assert.deepEqual(made, ['mark_sales_handled', 'sales_handled_list'])
    for (const name of made) {
      assert.match(fnBody(sql, name).head, /security definer set search_path = ''/, `${name} resolves names through the caller’s path`)
      assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`), `${name} can be called by anybody`)
      assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role;`), `${name} cannot be called by the server`)
    }
    assert.ok(!/\bgrant\b[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/.test(sql), 'something here is granted to a client')
    assert.ok(sql.includes('alter table public.sales_handled enable row level security;'), 'the marks have no row-level security')
    assert.ok(sql.includes('revoke all on table public.sales_handled from public, anon, authenticated;'), 'a client can read the marks')
    assert.ok(!/create policy|create trigger|create or replace trigger/.test(sql), 'a policy or a trigger came with the marks')
    assert.match(
      sql,
      /create table if not exists public\.sales_handled \( account_id uuid not null references auth\.users \(id\) on delete cascade, kind text not null check \(kind in \('twice', 'unconfirmed'\)\), paid_until bigint not null check \(paid_until >= 0\), bought_count integer not null default 0 check \(bought_count >= 0\), near_count integer not null default 0 check \(near_count >= 0\), handled_at timestamptz not null default now\(\), primary key \(account_id, kind\) \);/
    )
    /* Each of the three only moves forward on a second mark, and the server is handed all three back. */
    assert.match(
      fnBody(sql, 'mark_sales_handled').body,
      /on conflict \(account_id, kind\) do update set paid_until = greatest\(h\.paid_until, excluded\.paid_until\), bought_count = greatest\(h\.bought_count, excluded\.bought_count\), near_count = greatest\(h\.near_count, excluded\.near_count\), handled_at = now\(\)/,
      'marking again can move a mark back, and hide a payment it never saw'
    )
    assert.match(fnBody(sql, 'mark_sales_handled').body, /case when what = 'unconfirmed' then greatest\(coalesce\(near, 0\), 0\) else 0 end/, 'a Paid twice mark keeps card sales it never showed')
    assert.match(fnBody(sql, 'sales_handled_list').body, /'paid_until', h\.paid_until, 'bought_count', h\.bought_count, 'near_count', h\.near_count/, 'Sales is not handed the counts it compares')
    /* The two lists the server names are the database's two, and the page's. */
    const { HANDLED_KINDS } = await import('../shared/admin.mjs')
    const server = read('supabase/functions/grant-access/index.ts')
    assert.deepEqual(JSON.parse(server.match(/const HANDLED = (\[[^\]]*\])/)?.[1]?.replace(/'/g, '"') || 'null'), HANDLED_KINDS)
    assert.deepEqual(HANDLED_KINDS, ['twice', 'unconfirmed'])
    /* And the server asks for them by these names, with these arguments. */
    assert.match(server, /rpc\('mark_sales_handled', \{ uid: account, what, newest: Math\.floor\(upTo\), bought, near \}\)/)
    assert.match(sql, /function public\.mark_sales_handled\(uid uuid, what text, newest bigint, bought integer, near integer\)/)
    assert.match(server, /count: Number\(r\.bought_count\) \|\| 0, near: Number\(r\.near_count\) \|\| 0/, 'Sales reads the counts under other names than the database gives them')
    assert.match(server, /rpc\('sales_handled_list', \{\}\)/)
  })

  test('Sales at a glance: the sales first, Paid twice and Paid, account never confirmed after them, the same list with the same Handled on the phone and in the browser', async () => {
    const { salesSections, handledAsk } = await import('../shared/admin.mjs')
    const now = new Date(2026, 9, 15, 15, 0).getTime()
    const at = (d) => new Date(2026, 9, d, 12).getTime()
    const answer = {
      ok: true,
      accounts: 40,
      unanswered: 1,
      sales: [{ email: 'fan@example.com', store: 'rc_billing', at: at(8), gross: 9.99 }],
      twice: [{ email: 'fan@example.com', stores: ['app_store', 'rc_billing'], at: [at(8), at(8)] }],
      unconfirmed: [{ email: 'typo@x.com', stores: ['app_store'], at: [at(12)], near: [] }],
      handled: { twice: 2 }
    }
    const sections = salesSections(answer, now)
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Sales', 'Where they bought', 'Not sales', 'Accounts', 'Latest sales', 'Paid twice', 'Paid, account never confirmed', 'Note'],
      'the lists to sort out are back at the top, or the order moved'
    )
    assert.deepEqual(sections.at(-1).rows.map((r) => r.value), ['RevenueCat did not answer for 1 of them, so the numbers may be short.', 'Paid twice: 2 handled earlier.'])
    /* Handled is offered for exactly the rows of those two lists, and no other. */
    const offered = sections.map((s) => [s.title, s.rows.filter((r) => handledAsk(r)).length])
    assert.deepEqual(offered.filter(([, n]) => n), [['Paid twice', 1], ['Paid, account never confirmed', 1]])
    /* The question, short and in his words. */
    const twice = handledAsk(sections.find((s) => s.title === 'Paid twice').rows[0])
    assert.equal(`${twice.title} ${twice.message}`, 'Mark fan@example.com as handled? It won’t show here again unless they pay twice again.')
    assert.deepEqual([twice.cancel, twice.confirm], ['Not yet', 'Handled'])
    const never = handledAsk(sections.find((s) => s.title === 'Paid, account never confirmed').rows[0])
    assert.equal(`${never.title} ${never.message}`, 'Mark typo@x.com as handled? It won’t show here again unless they pay again.')
    for (const s of sections) for (const r of s.rows) assert.ok(!/\bMac\b/.test(r.value), `Sales calls the computer a Mac: ${r.value}`)

    /*
     * THE PHONE AND THE BROWSER, ONE LIST. Both draw the shared sections as
     * they come, in the order they come, through their Facts with the same
     * Handled under a row; both ask the same question first, send the same
     * five things, take the row away the same way, and say the same words
     * when it did not work. Neither sorts, filters or adds a section of its own.
     */
    const phone = read('mobile/src/components/SalesTool.js')
    const web = read('src/components/SalesTool.jsx')
    for (const [where, src] of [['phone', phone], ['browser', web]]) {
      const flat = code(src).replace(/\s+/g, ' ')
      assert.equal((flat.match(/salesSections\(/g) || []).length, 1, `the ${where} draws Sales from more than the shared sections`)
      assert.match(flat, /\{said\?\.ok \? salesSections\(said\)\.map\(\(s\) => <Facts key=\{s\.title\} title=\{s\.title\} rows=\{s\.rows\} detail=\{detail\} \/>\) : null\}/, `the ${where} does not draw the shared sections straight, with Handled under them`)
      assert.ok(!/salesSections\(said\)\.(filter|sort|slice|reverse)/.test(flat), `the ${where} reorders or drops sections`)
      assert.match(flat, /const detail = \(row\) => handledAsk\(row\) \?/, `the ${where} offers Handled under rows the shared words do not`)
      assert.match(flat, /ask\('handled', row\.email, \{ kind: row\.kind, until: row\.until, count: row\.count, nearCount: row\.nearCount \}\)/, `the ${where} sends something else to mark a row handled`)
      assert.match(flat, /setSaid\(\(was\) => withHandled\(was, row\)\)/, `the ${where} does not take the row away once it is marked`)
      assert.match(flat, /setSaid\(marked\.current\.reduce\(\(was, row\) => withHandled\(was, row\), answer\)\)/, `the ${where} can put a row it just marked back on a refresh`)
      assert.match(flat, /message: handledProblem\(res\)/, `the ${where} says a failed Handled in other words`)
      assert.match(flat, /'Marking…' : 'Handled'/, `the ${where}’s button is not called Handled`)
      /* The button asks first, and only the yes marks it. */
      assert.match(flat, /(onPress|onClick)=\{\(\) => confirm\(row\)\}/, `the ${where}’s Handled button does not ask first`)
      assert.equal((flat.match(/\bhandle\(row\)/g) || []).length, 1, `the ${where} can mark a row without the yes`)
      assert.match(flat, /from '(\.\.\/lib\/admin|\.\.\/\.\.\/shared\/admin\.mjs)'/)
    }
    assert.match(code(phone).replace(/\s+/g, ' '), /Alert\.alert\(q\.title, q\.message, \[ \{ text: q\.cancel, style: 'cancel' \}, \{ text: q\.confirm, onPress: \(\) => handle\(row\) \} \]\)/, 'the phone marks a row without asking first')
    assert.match(web, /if \(q && window\.confirm\(`\$\{q\.title\} \$\{q\.message\}`\)\) handle\(row\)/, 'the browser marks a row without asking first')
    /* A refusal leaves the row on screen, so it is said where the tap was, not only at the foot of the page. */
    assert.match(code(phone).replace(/\s+/g, ' '), /Alert\.alert\(handledProblem\(res\)\)/, 'a refused Handled on the phone is said only below the fold')
    assert.match(code(web).replace(/\s+/g, ' '), /window\.alert\(handledProblem\(res\)\)/, 'a refused Handled in the browser is said only below the fold')
    /* Both Facts draw what goes under a row. */
    assert.match(read('mobile/src/components/Facts.js'), /export default function Facts\(\{ title, rows, onRow, detail \}\)[\s\S]*const below = detail \? detail\(row\) : null/, 'the phone’s Facts draws nothing under a row')
    assert.match(read('src/components/Facts.jsx'), /\{detail \? detail\(row\) : null\}/, 'the browser’s Facts draws nothing under a row')
  })

  test('after Leave them out or Put them back, the person’s sheet says what the list says', async () => {
    /*
     * The sheet kept the row as it was when tapped, and changed only its
     * buttons: "Not emailed yet. It goes as soon as the emails are on."
     * right above "sam.player@gmail.com is left out. They won't get the
     * setup emails." It reads the person from the list now, every time.
     */
    const { stuckRow, withLeftOut, withRefusalCleared, stuckChoices, stuckTurnOnWords } = await import('../shared/admin.mjs')
    const DAY = 86400000
    const now = Date.parse('2026-10-20T12:00:00Z')
    const iso = (ms) => new Date(ms).toISOString()
    const email = 'sam.player@gmail.com'
    const list = {
      ok: true,
      sending: false,
      stuck: [
        { email, confirmed: true, unlocked_at: iso(now - 3 * DAY), left_out: false },
        { email: 'emailed@x.com', confirmed: true, unlocked_at: iso(now - 9 * DAY), first_sent_at: iso(now - 2 * DAY), left_out: false }
      ]
    }
    const tapped = stuckRow(list, email, null, now)
    assert.equal(tapped.line.split('\n').pop(), 'Not emailed yet. It goes as soon as the emails are on.')
    assert.deepEqual(stuckChoices(tapped), { leaveOut: true, putBack: false, tryAgain: false })

    const out = withLeftOut(list, email, true)
    const left = stuckRow(out, email, tapped, now)
    assert.equal(left.line.split('\n').pop(), 'Left out: never emailed.', 'after Leave them out the sheet still says the email is coming')
    assert.deepEqual(stuckChoices(left), { leaveOut: false, putBack: true, tryAgain: false })
    assert.equal(list.stuck[0].left_out, false, 'the list the page was given was changed in place')

    const back = stuckRow(withLeftOut(out, email, false), email, left, now)
    assert.equal(back.line.split('\n').pop(), 'Not emailed yet. It goes as soon as the emails are on.', 'after Put them back the sheet still says they are left out')
    assert.deepEqual(stuckChoices(back), { leaveOut: true, putBack: false, tryAgain: false })

    /* After Try the email again, the same: the sheet says the email is coming, and offers no second try. */
    const refusedList = { ...list, sending: true, stuck: [{ ...list.stuck[0], failed_at: iso(now - DAY), failed_kind: 'first' }, list.stuck[1]] }
    const refused = stuckRow(refusedList, email, null, now)
    assert.deepEqual(stuckChoices(refused), { leaveOut: true, putBack: false, tryAgain: true })
    const tried = stuckRow(withRefusalCleared(refusedList, email), email, refused, now)
    assert.equal(tried.line.split('\n').pop(), 'Not emailed yet. The first goes within the hour.', 'after Try the email again the sheet still says it was refused')
    assert.deepEqual(stuckChoices(tried), { leaveOut: true, putBack: false, tryAgain: false })
    assert.ok(refusedList.stuck[0].failed_at, 'the list the page was given was changed in place')

    const emailed = stuckRow(withLeftOut(list, 'emailed@x.com', true), 'emailed@x.com', null, now)
    assert.equal(emailed.line.split('\n').pop(), 'Left out. The first email went Oct 18, 2026, and no more will.')
    /* Gone from the list since (a computer signed in): the row as tapped, rather than an empty sheet. */
    assert.equal(stuckRow({ ok: true, stuck: [] }, email, tapped, now), tapped)
    assert.equal(stuckRow(list, null, tapped, now), null)

    /* The sheet draws that person, and the list takes the server's answer at once. */
    const tool = code(read('mobile/src/components/StuckTool.js')).replace(/\s+/g, ' ')
    assert.match(tool, /const person = stuckRow\(said, open\?\.email, open\)/)
    assert.match(tool, /const choices = stuckChoices\(person\)/)
    assert.match(tool, /\{person\?\.line\}/)
    assert.ok(!/open\?\.line|open\.line|open\?\.leftOut/.test(tool), 'the sheet draws the row as it was when tapped')
    assert.ok(!/setOpen\(\(was\)/.test(tool), 'the sheet patches its own copy of the row again')
    assert.match(tool, /setSaid\(\(was\) => withLeftOut\(was, open\.email, res\.leftOut === true\)\)/, 'the list does not take the server’s answer')
    assert.match(tool, /const res = await ask\('try-again', open\.email\)/, 'Try the email again asks about somebody other than the person on the sheet')
    assert.match(tool, /setSaid\(\(was\) => withRefusalCleared\(was, open\.email\)\) load\(\)/, 'after Try the email again the list still says they were refused')
    assert.match(tool, /\{choices\.tryAgain \? \( <Press label=\{doing === 'again' \? 'Trying again…' : 'Try the email again'\} height=\{TAP\} disabled=\{!!doing\} onPress=\{again\} \/> \) : null\}/, 'Try the email again is drawn for somebody with no refusal, or does something else')

    /* And the check before turning the emails on is counted right. */
    assert.match(stuckTurnOnWords({ dueFirst: 1 }), /^1 person is due one now, and it goes within the hour\. Have you read the sample/)
    assert.match(stuckTurnOnWords({ dueFirst: 2, dueReminder: 1 }), /^3 people are due one now, and they go within the hour\./)
    assert.match(stuckTurnOnWords({}), /^Nobody is due one right now\./)
    assert.match(tool, /Alert\.alert\( 'Turn the setup emails on\?', stuckTurnOnWords\(said\),/)
  })
}
