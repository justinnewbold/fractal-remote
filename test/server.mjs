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

async function grantAccess({ token, body, account = null, refuse = 0, waiting = false }) {
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
    if (call.url === `${PROJECT}/rest/v1/rpc/account_details`) return answer(200, account)
    if (call.url === `${PROJECT}/rest/v1/rpc/is_waiting_grant`) return waiting === 'fail' ? answer(500, { msg: 'no' }) : answer(200, waiting)
    if (call.url === `${RC_PROJECT}/entitlements`) return answer(200, { items: [{ id: 'entl-full', lookup_key: 'full' }] })
    if (call.url.startsWith(`${RC_PROJECT}/customers/`)) return answer(200, call.url.endsWith(account?.id || '-') ? { id: account.id } : { items: [] })
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
      assert.deepEqual(answer.unconfirmed, [{ email: 'typo@x.com', stores: ['app_store'], at: [now - 2 * DAY], near: ['right@x.com'] }], 'a purchase on an account never confirmed is not named, or not beside the card sale that day')
      assert.ok(answer.sales.some((s) => s.email === 'typo@x.com' && s.store === 'app_store'), 'the purchase on the unconfirmed account is not counted as a sale')
      assert.ok(!asked.some((u) => u.includes('/customers/acct-old/')), 'an unconfirmed account from over a month ago was asked about')
      assert.ok(!asked.some((u) => u.includes('/customers/acct-fine/')), 'a confirmed account was asked about as one never confirmed')
      assert.equal(asked.filter((u) => u.includes('/customers/acct-right/')).length, 1, 'a confirmed buyer was asked about twice')
      /* The old fields are all still there, for a phone too old to know the new one. */
      for (const field of ['accounts', 'unlocked', 'sales', 'twice', 'givenByHand', 'unanswered']) assert.ok(field in answer, `the answer lost ${field}`)

      /* And the page says it, in plain words, right after Paid twice. */
      const { salesSections } = await import('../shared/admin.mjs')
      const sections = salesSections(answer, now)
      assert.equal(sections[0]?.title, 'Paid, account never confirmed')
      assert.equal(sections[0].rows[0].label, 'typo@x.com')
      assert.match(sections[0].rows[0].value, /^Paid on the App Store, .+, but never confirmed this account, so the computer and the website can’t see the purchase\. A card sale on the website that day went to right@x\.com: maybe the same person, who paid twice\.$/)
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
}
