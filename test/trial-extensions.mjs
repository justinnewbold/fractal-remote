/**
 * MORE TIME ON A FREE TRIAL, AND THE ONE EMAIL NEAR ITS END (25 November 2026).
 *
 * A trial started and never used again tells Justin nothing. So: one plain
 * email from him on a trial's last day, a week more by itself for somebody
 * who never connected a unit (never on an iPhone or iPad's trial: Apple's
 * 3.1.1), a button on his Trials page that gives any trial more days, and
 * every extension written down. The ways it can be quietly wrong, each held
 * here:
 *
 *   - an email, or a week, while the switch is off
 *   - two emails to one trial, or two automatic weeks
 *   - an iPhone or iPad's trial extended by itself
 *   - "I've added 7 more days" said of a week that was not added
 *   - a week added to somebody who was never emailed about it
 *   - an extension the device throws away (the kept end never moved later)
 *   - a client able to extend its own trial, or read who was extended
 *
 * grant-access's own three actions are run in test/server.mjs, beside the
 * rest of that function's.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  DAY_MS,
  NUDGE_TELL_MS,
  NUDGE_WITHIN_MS,
  TRIAL_DAYS,
  TRIAL_EXTRA_DAYS,
  TRIAL_EXTRA_MOST,
  extraDaysOk,
  keptTrial,
  nudgePlan,
  trialLive
} from '../shared/trial-rule.mjs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const flat = (p) => code(read(p)).replace(/\s+/g, ' ')
const SQL = 'supabase/migrations/20261125_trial_extensions.sql'
const sqlOf = (p) => read(p).replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim()
/* One function's body, between its `as $$` and the `$$;` that closes it. */
const fnBody = (sql, name) => {
  const at = sql.indexOf(`create or replace function public.${name}(`)
  assert.ok(at >= 0, `the migration has no ${name}`)
  const open = sql.indexOf('as $$', at)
  return { head: sql.slice(at, open), body: sql.slice(open + 5, sql.indexOf('$$;', open)).trim() }
}

/* Noon on 25 November 2026. */
const NOW = new Date(2026, 10, 25, 12, 0, 0).getTime()
const iso = (ms) => new Date(ms).toISOString()

/*
 * TRIAL-NUDGE, RUN. A fresh copy of the function for every run, with Deno
 * stood in for and a fetch that answers as the database and Resend would:
 *
 *   secret    what trial_nudge_hook_secret() gives
 *   given     the x-hook-secret the caller sends
 *   token     a bearer token instead (the service key, for the sample)
 *   sending   the switch
 *   resendKey RESEND_API_KEY, '' for none
 *   due       what trial_nudges_due() answers
 *   claim     (body) => what claim_trial_nudge() answers
 *   extend    (body) => what extend_trial() answers, or 'fail' for a 500
 *   resend    (payload) => the status Resend answers, or { status, name, message }
 *
 * Every call is kept, in order, and every line logged.
 */
const PROJECT = 'https://project.test'
const SERVICE = 'the-service-role-key'
const HOOK = 'the-nudge-secret'
const URL_OF = new URL('../supabase/functions/trial-nudge/index.ts', import.meta.url).href
const ANN = '11111111-2222-4333-8444-555555555555'
const BOB = '22222222-2222-4333-8444-555555555555'
const CAT = '33333333-2222-4333-8444-555555555555'
let runs = 0

async function nudge({ secret = HOOK, given = HOOK, token = null, sending = true, resendKey = 're_key', due = [], claim = () => true, extend = () => ({ ok: true, ends_at: '2026-12-03T00:00:00Z' }), resend = () => 200, body = {} } = {}) {
  const calls = []
  const logged = []
  const was = { fetch: globalThis.fetch, Deno: globalThis.Deno, log: console.log, error: console.error, setTimeout: globalThis.setTimeout }
  const env = { SUPABASE_URL: PROJECT, SUPABASE_SERVICE_ROLE_KEY: SERVICE, RESEND_API_KEY: resendKey }
  const answer = (status, value) => new Response(value === undefined ? '' : JSON.stringify(value), { status })
  let handler = null
  globalThis.Deno = { serve: (h) => (handler = h), env: { get: (name) => env[name] || undefined } }
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null }
    const rpc = call.url.startsWith(`${PROJECT}/rest/v1/rpc/`) ? call.url.slice(`${PROJECT}/rest/v1/rpc/`.length) : null
    call.rpc = rpc
    calls.push(call)
    if (rpc === 'trial_nudge_hook_secret') return answer(200, secret)
    if (rpc === 'trial_nudge_sending') return answer(200, sending)
    if (rpc === 'trial_nudges_due') return answer(200, due)
    if (rpc === 'claim_trial_nudge') return answer(200, claim(call.body))
    if (rpc === 'extend_trial') {
      const said = extend(call.body)
      return said === 'fail' ? answer(500, { message: 'no' }) : answer(200, said)
    }
    /* A function that returns nothing answers 204 with no body at all. */
    if (rpc === 'note_trial_nudge_kind' || rpc === 'release_trial_nudge') return new Response(null, { status: 204 })
    if (call.url === 'https://api.resend.com/emails') {
      const said = resend(call.body)
      const { status, ...refusal } = said && typeof said === 'object' ? said : { status: said }
      if (status < 300) return answer(status, { id: 'em_1' })
      return answer(status, Object.keys(refusal).length ? { statusCode: status, ...refusal } : { message: `cannot send to ${call.body?.to?.[0]}` })
    }
    return answer(500, { msg: `nothing answers ${call.url} here` })
  }
  /* No real waiting between emails. */
  globalThis.setTimeout = (fn) => (fn(), 0)
  console.log = (...a) => logged.push(a.join(' '))
  console.error = (...a) => logged.push(a.join(' '))
  try {
    const mod = await import(`${URL_OF}?run=${++runs}`)
    const headers = { 'Content-Type': 'application/json', ...(given ? { 'x-hook-secret': given } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    const res = await handler(new Request('https://functions.test/trial-nudge', { method: 'POST', headers, body: JSON.stringify(body) }))
    const text = await res.text()
    let said = null
    try {
      said = text ? JSON.parse(text) : null
    } catch {
      /* "No", the refusal, is not JSON */
    }
    const of = (name) => calls.filter((c) => c.rpc === name).map((c) => c.body)
    return { status: res.status, said, calls, logged, mod, of, sent: calls.filter((c) => c.url === 'https://api.resend.com/emails'), order: calls.map((c) => c.rpc || (c.url === 'https://api.resend.com/emails' ? 'email' : c.url)) }
  } finally {
    globalThis.fetch = was.fetch
    globalThis.Deno = was.Deno
    globalThis.setTimeout = was.setTimeout
    console.log = was.log
    console.error = was.error
  }
}

/* Three trials on their last day (from the real clock: the function reads it): never connected on Android, never connected on an iPhone, and connected on Android. */
const lastDay = () => [
  { account_id: ANN, email: 'ann@example.com', platform: 'android', connected: false, ends_at: iso(Date.now() + 10 * 3600000), auto_extended_at: null },
  { account_id: BOB, email: 'bob@example.com', platform: 'ios', connected: false, ends_at: iso(Date.now() + 10 * 3600000), auto_extended_at: null },
  { account_id: CAT, email: 'cat@example.com', platform: 'android', connected: true, ends_at: iso(Date.now() + 10 * 3600000), auto_extended_at: null }
]

export function run(test) {
  test('trial email: which email, if any, for every kind of trial', () => {
    const lastDayOf = (over = {}) => nudgePlan({ platform: 'android', connected: false, endsAt: NOW + 10 * 3600000, now: NOW, ...over })
    /* Never connected a unit, and not an iPhone or iPad's trial: a week more, said in the email. */
    for (const platform of ['android', 'web', 'computer']) assert.equal(lastDayOf({ platform }), 'extend', `${platform}`)
    /* Apple's 3.1.1: the trial is the "7-Day Trial" item, so never a week by itself there. The email asks. */
    assert.equal(lastDayOf({ platform: 'ios' }), 'ask', 'an iPhone or iPad’s trial was extended by itself')
    /* Connected a unit: they have tried it, so the email asks. */
    assert.equal(lastDayOf({ connected: true }), 'ask')
    assert.equal(lastDayOf({ platform: 'ios', connected: true }), 'ask')
    /* A platform nobody knows is never given a week on a guess. */
    assert.equal(lastDayOf({ platform: 'tv' }), 'ask')
    assert.equal(lastDayOf({ platform: undefined }), 'ask')
    /* No email: bought, emailed already, not on its last day yet, or over. */
    assert.equal(lastDayOf({ bought: true }), 'none')
    assert.equal(lastDayOf({ nudged: true }), 'none')
    assert.equal(lastDayOf({ endsAt: NOW + NUDGE_WITHIN_MS + 1 }), 'none', 'a trial with more than a day left was emailed')
    assert.equal(lastDayOf({ endsAt: NOW + NUDGE_WITHIN_MS }), 'extend')
    assert.equal(lastDayOf({ endsAt: NOW }), 'none', 'a trial that has ended was emailed')
    assert.equal(lastDayOf({ endsAt: NOW - 1 }), 'none')
    assert.equal(lastDayOf({ endsAt: null }), 'none')
    assert.equal(lastDayOf({ endsAt: 'soon' }), 'none')
    assert.equal(nudgePlan(), 'none')
    /* The server's dates come as text. */
    assert.equal(lastDayOf({ endsAt: iso(NOW + 3600000) }), 'extend')
    /*
     * A week added by a run whose email did not go (the mail key refused,
     * the claim taken back): the trial now ends in a week, and the email
     * still owed says the week as added, and adds no second one.
     */
    const added = { endsAt: NOW + 7 * DAY_MS + 3600000, autoExtendedAt: iso(NOW - 3600000) }
    assert.equal(lastDayOf(added), 'extended', 'a week added in silence is never said')
    assert.equal(lastDayOf({ ...added, nudged: true }), 'none')
    assert.equal(lastDayOf({ ...added, bought: true }), 'none')
    /* Past two days, nothing is owed for it; and on that trial's own last day the email only asks: never a second week by itself. */
    assert.equal(lastDayOf({ ...added, autoExtendedAt: NOW - NUDGE_TELL_MS }), 'none')
    assert.equal(lastDayOf({ endsAt: NOW + 3600000, autoExtendedAt: NOW - 6 * DAY_MS }), 'ask', 'a second automatic week')
    /* The week is the trial's own length again, and the button's days are held to the database's check. */
    assert.equal(TRIAL_EXTRA_DAYS, 7)
    assert.equal(TRIAL_EXTRA_DAYS, TRIAL_DAYS)
    assert.equal(NUDGE_WITHIN_MS, DAY_MS)
    for (const ok of [1, 7, TRIAL_EXTRA_MOST]) assert.equal(extraDaysOk(ok), true)
    for (const bad of [0, -1, TRIAL_EXTRA_MOST + 1, 1.5, '7', null, undefined, NaN]) assert.equal(extraDaysOk(bad), false, `${bad} days`)
    /* The server's functions import the same rule (the copies are made by sync:rules, and a test holds them to the source). */
    assert.match(read('supabase/functions/trial-nudge/index.ts'), /import \{ TRIAL_EXTRA_DAYS, nudgePlan \} from '\.\.\/_shared\/trial-rule\.mjs'/)
  })

  test('trial email: an extension reaches the device, and nothing but the server’s answer makes a trial longer', () => {
    const ends = NOW - 3600000
    const kept = { account: 'a', endsAt: ends, used: true }
    /* Ended on the device an hour ago; the server says it was given a week. */
    const next = keptTrial({ kept, heard: { endsAt: iso(ends + 7 * DAY_MS) }, account: 'a' })
    assert.equal(next.endsAt, ends + 7 * DAY_MS)
    assert.equal(trialLive(next.endsAt, NOW), true, 'a trial given more time is still over on the device')
    /* Offline, or an older server: exactly what was kept. */
    assert.equal(keptTrial({ kept, heard: undefined, account: 'a' }).endsAt, ends)
    /* The phone keeps what keptTrial answers, and shows it against a clock that never runs back. */
    const lib = flat('mobile/src/lib/purchases.js')
    assert.match(lib, /const kept = keptTrial\(\{ kept: was, heard, account \}\)/)
    assert.match(lib, /const back = Math\.max\(0, trialClock\(now, kept\?\.seen \|\| 0\) - now\)/)
    /* The server answers the row's own end, which is the one extend_trial moved. */
    assert.match(flat('supabase/functions/_shared/trial-rule.mjs'), /const endsAt = timeOf\(row\.ends_at \?\? row\.endsAt\)/)
    assert.match(sqlOf('supabase/migrations/20261107_trials.sql'), /select jsonb_build_object\('started_at', t\.started_at, 'ends_at', t\.ends_at,/)
  })

  test('trial email: switched off, a run counts and does nothing else', async () => {
    for (const [why, over] of [['the switch off', { sending: false }], ['no mail key', { resendKey: '' }]]) {
      const run = await nudge({ due: lastDay(), ...over })
      assert.equal(run.status, 200)
      assert.deepEqual(run.said, { sending: false, extend: 1, ask: 2 }, why)
      assert.equal(run.sent.length, 0, `${why}: an email went`)
      assert.deepEqual(run.of('claim_trial_nudge'), [], `${why}: a trial was claimed`)
      assert.deepEqual(run.of('extend_trial'), [], `${why}: somebody was given a week`)
      assert.ok(run.logged.some((l) => /nothing sent and nobody given more time/.test(l)))
      assert.ok(!run.logged.some((l) => l.includes('@')), 'an address in the log')
    }
    /* Only the schedule's secret gets that far: both halves must exist and match. */
    for (const [why, over] of [['no secret sent', { given: null }], ['the wrong one', { given: 'guess' }], ['a vault with none', { secret: null }]]) {
      const run = await nudge({ due: lastDay(), ...over })
      assert.equal(run.status, 401, why)
      assert.deepEqual(run.of('trial_nudges_due'), [], `${why}: the list was read`)
      assert.equal(run.sent.length, 0)
    }
  })

  test('trial email: on, each trial is claimed, then given its week if it is owed one, then emailed, once', async () => {
    const run = await nudge({ due: lastDay() })
    assert.deepEqual(run.said, { sending: true, extend: 1, ask: 2, refused: 0, skipped: 0, stopped: null })
    /* Claimed with the email it is: a week for the one who never connected off an iPhone, asking for the other two. */
    assert.deepEqual(run.of('claim_trial_nudge'), [{ uid: ANN, which: 'extend' }, { uid: BOB, which: 'ask' }, { uid: CAT, which: 'ask' }])
    /* One week, automatic, and only for her: never the iPhone's trial, never somebody who connected. */
    assert.deepEqual(run.of('extend_trial'), [{ uid: ANN, days: 7, who: 'auto' }])
    /* The order for her: claimed, the week added, and only then the email that says it was. */
    const hers = run.order.slice(run.order.indexOf('claim_trial_nudge'))
    assert.deepEqual(hers.slice(0, 3), ['claim_trial_nudge', 'extend_trial', 'email'])
    assert.deepEqual(run.sent.map((s) => s.body.to), [['ann@example.com'], ['bob@example.com'], ['cat@example.com']])
    const [ann, bob, cat] = run.sent.map((s) => s.body)
    assert.match(ann.text, /I’ve added 7 more days to your trial/)
    assert.match(ann.text, /no card needed/)
    assert.doesNotMatch(ann.text, /like more time/, 'the email that gave a week offers more')
    for (const asked of [bob, cat]) {
      assert.match(asked.text, /if you’d like more time to try it, reply to this email/)
      assert.doesNotMatch(asked.text, /added|more days/, 'an email says days were added that were not')
    }
    /* Replies come to Justin; each real send says which email and whose account, so asked twice it is still one. */
    for (const s of run.sent) assert.equal(s.body.reply_to, 'justinnewbold@gmail.com')
    assert.deepEqual(run.sent.map((s) => s.headers['Idempotency-Key']), [`trial-nudge/extend/${ANN}`, `trial-nudge/ask/${BOB}`, `trial-nudge/ask/${CAT}`])
    assert.ok(!run.logged.some((l) => l.includes('@')), 'an address in the log')

    /* Not claimed (the switch turned off mid-run, another run got there, they bought): no week, no email. */
    const lost = await nudge({ due: lastDay(), claim: () => false })
    assert.deepEqual(lost.said, { sending: true, extend: 0, ask: 0, refused: 0, skipped: 3, stopped: null })
    assert.deepEqual(lost.of('extend_trial'), [], 'somebody unclaimed was given a week')
    assert.equal(lost.sent.length, 0)

    /* A row the rule gives no email (ended since the list was read, or days left) is never claimed. */
    const none = await nudge({ due: [{ ...lastDay()[0], ends_at: iso(Date.now() + 3 * DAY_MS) }, { ...lastDay()[0], ends_at: iso(Date.now() - 1000) }] })
    assert.deepEqual(none.of('claim_trial_nudge'), [])
    assert.equal(none.said.skipped, 2)
    /* Nor one whose address is not one. */
    const odd = await nudge({ due: [{ ...lastDay()[0], email: 'a@b.c, d@e.f' }, { ...lastDay()[0], email: '' }] })
    assert.deepEqual(odd.of('claim_trial_nudge'), [])
    assert.equal(odd.sent.length, 0)
  })

  test('trial email: a week is never said as added unless it was, and never added twice', async () => {
    /* The database will not add it (this account has had its automatic week): the email asks instead, and the record says so. */
    const had = await nudge({ due: [lastDay()[0]], extend: () => ({ ok: false, why: 'had' }) })
    assert.equal(had.sent.length, 1)
    assert.doesNotMatch(had.sent[0].body.text, /added|more days/, 'the email says a week was added that was not')
    assert.match(had.sent[0].body.text, /like more time/)
    assert.deepEqual(had.of('note_trial_nudge_kind'), [{ uid: ANN, which: 'ask' }])
    assert.deepEqual(had.said, { sending: true, extend: 0, ask: 1, refused: 0, skipped: 0, stopped: null })
    /* Bought a moment ago: nothing goes, and the claim is taken back. */
    const bought = await nudge({ due: [lastDay()[0]], extend: () => ({ ok: false, why: 'bought' }) })
    assert.equal(bought.sent.length, 0, 'somebody who has just bought was emailed about their trial')
    assert.deepEqual(bought.of('release_trial_nudge'), [{ uid: ANN }])
    /* The database did not answer: nothing goes, the claim is taken back, and the run ends. */
    const down = await nudge({ due: lastDay(), extend: () => 'fail' })
    assert.equal(down.status, 500)
    assert.equal(down.sent.length, 0)
    assert.deepEqual(down.of('release_trial_nudge'), [{ uid: ANN }])
    assert.deepEqual(down.of('claim_trial_nudge').length, 1, 'the run went on after the database failed')
    /* A week an earlier run added, whose email did not go: said as added, and not added again. */
    const owed = await nudge({ due: [{ ...lastDay()[0], ends_at: iso(Date.now() + 7 * DAY_MS), auto_extended_at: iso(Date.now() - 3600000) }] })
    assert.deepEqual(owed.of('claim_trial_nudge'), [{ uid: ANN, which: 'extend' }])
    assert.deepEqual(owed.of('extend_trial'), [], 'a second week was added')
    assert.match(owed.sent[0].body.text, /I’ve added 7 more days/)
  })

  test('trial email: a refusal stops the run, and only a refused address is held against anybody', async () => {
    /* The mail key refused: it did not go, the claim is taken back, and nobody after is tried. */
    const key = await nudge({ due: lastDay(), resend: () => 401 })
    assert.equal(key.sent.length, 1)
    assert.deepEqual(key.of('release_trial_nudge'), [{ uid: ANN }])
    assert.deepEqual(key.of('note_trial_nudge_kind'), [])
    assert.deepEqual(key.said.stopped, { status: 401, why: 'mail service' })
    assert.deepEqual(key.of('claim_trial_nudge').length, 1)
    /* This person's address refused: written down, never tried again, and never taken back. */
    const address = await nudge({ due: lastDay(), resend: () => ({ status: 422, name: 'validation_error', message: 'Invalid `to` field.' }) })
    assert.deepEqual(address.of('note_trial_nudge_kind'), [{ uid: ANN, which: 'refused' }])
    assert.deepEqual(address.of('release_trial_nudge'), [])
    assert.deepEqual(address.said.stopped, { status: 422, why: 'this email' })
    /* A fault on the mail service's side may have gone: the claim stays, so it is never sent twice. */
    const fault = await nudge({ due: lastDay(), resend: () => 502 })
    assert.deepEqual(fault.of('release_trial_nudge'), [])
    assert.deepEqual(fault.of('note_trial_nudge_kind'), [])
    assert.deepEqual(fault.said.stopped, { status: 502, why: 'may have gone' })
    for (const run of [key, address, fault]) assert.ok(!run.logged.some((l) => l.includes('@')), 'an address in the log')
  })

  test('trial email: the sample is both emails to Justin’s own inbox, with the switch on or off, and touches nothing', async () => {
    for (const sending of [false, true]) {
      const run = await nudge({ given: null, token: SERVICE, sending, body: { action: 'sample', email: 'attacker@example.com' } })
      assert.deepEqual(run.said, { ok: true, sent: 2 })
      assert.deepEqual(run.sent.map((s) => s.body.to), [['justinnewbold@gmail.com'], ['justinnewbold@gmail.com']], 'a sample went somewhere else')
      assert.deepEqual(run.sent.map((s) => s.body.subject), ['[Sample] 7 more days of Fractal Remote, on me', '[Sample] How is Fractal Remote going?'])
      assert.ok(run.sent.every((s) => !('Idempotency-Key' in s.headers)), 'a second sample in a day would be swallowed')
      assert.ok(!run.calls.some((c) => c.rpc), 'a sample read or wrote the database')
    }
    /* The service key opens the sample and nothing else; a stranger's token is nobody. */
    const other = await nudge({ given: null, token: SERVICE, body: { action: 'run' } })
    assert.equal(other.status, 400)
    assert.equal(other.sent.length, 0)
    const stranger = await nudge({ given: null, token: 'a-strangers-token', body: { action: 'sample' } })
    assert.equal(stranger.status, 401)
    assert.equal(stranger.sent.length, 0)
    const nokey = await nudge({ given: null, token: SERVICE, resendKey: '', body: { action: 'sample' } })
    assert.deepEqual(nokey.said, { ok: false, why: 'not configured' })
  })

  test('trial email: the words are short, plain and Justin’s, and promise nothing the app does not do', async () => {
    const { mod } = await nudge({ sending: false })
    const extend = mod.nudgeEmail('extend', 'ann@example.com')
    const ask = mod.nudgeEmail('ask', 'ann@example.com')
    assert.equal(
      extend.text,
      [
        'Hi,',
        '',
        'Thanks for trying Fractal Remote. Your free trial was nearly over, and it looks like the app hasn’t connected to your Fractal yet.',
        '',
        'So I’ve added 7 more days to your trial. There’s nothing to do and no card needed: open the app and it carries on.',
        '',
        'Did something get in the way of connecting, or was anything confusing? Reply to this email and tell me. It comes straight to me, and I’ll help you get it going.',
        '',
        'Justin',
        'Fractal Remote',
        '',
        '--',
        'You’re getting this because ann@example.com started a free trial of Fractal Remote. It’s the only email I’ll send about your trial.'
      ].join('\n')
    )
    assert.equal(
      ask.text,
      [
        'Hi,',
        '',
        'Thanks for trying Fractal Remote. Your free trial is nearly over, and I wanted to ask how it’s going.',
        '',
        'Is it doing what you hoped? Did anything stop you, or was something confusing?',
        '',
        'Reply to this email and tell me. It comes straight to me.',
        '',
        'And if you’d like more time to try it, reply to this email and I’ll add some.',
        '',
        'Justin',
        'Fractal Remote',
        '',
        '--',
        'You’re getting this because ann@example.com started a free trial of Fractal Remote. It’s the only email I’ll send about your trial.'
      ].join('\n')
    )
    for (const e of [extend, ask]) {
      /* No VP4, no unit named, no price, no day or date (a last day is "nearly over" in every time zone), no dashes for commas. */
      assert.doesNotMatch(`${e.subject} ${e.text}`, /VP4|AM4|FM3|FM9|Axe-Fx|\$|tomorrow|today|Monday|—| - /)
      assert.ok(e.text.split(/\s+/).length < 130, 'the trial email has grown long')
      /* The HTML says the same words, and nothing reaches it as markup. */
      for (const line of e.text.split('\n').filter((l) => l && l !== '--')) assert.ok(e.html.includes(line.replace(/'/g, '&#39;')), `the HTML email is missing: ${line}`)
    }
    assert.ok(mod.nudgeEmail('ask', '<b>@x.y').html.includes('&lt;b&gt;@x.y'), 'an address reaches the email as markup')
    /* Never to Apple's review login, whose address has no mailbox: the same list as the setup emails'. */
    const { REVIEW_LOGINS } = await import('../shared/admin.mjs')
    const copied = JSON.parse(read('supabase/functions/trial-nudge/index.ts').match(/const REVIEW_LOGINS = (\[[^\]]*\])/)?.[1]?.replace(/'/g, '"') || 'null')
    assert.deepEqual(copied, REVIEW_LOGINS)
    assert.match(flat('supabase/functions/trial-nudge/index.ts'), /!LOOKS_LIKE_EMAIL\.test\(to\) \|\| \(await isReviewLogin\(to\)\)\) \{ done\.skipped \+= 1 continue \}/)
  })

  test('trial email: the database keeps it all from clients, starts switched off, and only extend_trial moves an end', () => {
    const sql = sqlOf(SQL)
    /* The record of every extension, and what the email did, on the trial's own row. */
    assert.match(sql, /create table if not exists public\.trial_extensions \( id bigint generated always as identity primary key, account_id uuid not null references auth\.users \(id\) on delete cascade, days integer not null check \(days between 1 and 30\), "by" text not null check \("by" in \('owner', 'auto'\)\), old_ends_at timestamptz not null, new_ends_at timestamptz not null, created_at timestamptz not null default now\(\) \)/)
    assert.match(sql, /alter table public\.trials add column if not exists nudged_at timestamptz;/)
    assert.match(sql, /alter table public\.trials add column if not exists nudge_kind text;/)
    /* Off until Justin turns it on, and a second run of the file never turns it off or on. */
    assert.match(sql, /create table if not exists public\.trial_nudge_switch \( id boolean primary key default true check \(id\), enabled boolean not null default false,/)
    assert.match(sql, /insert into public\.trial_nudge_switch \(id, enabled\) values \(true, false\) on conflict \(id\) do nothing;/)
    /* Row level security on, no policy, and nothing granted to a client: tables or functions. */
    for (const table of ['trial_extensions', 'trial_nudge_switch']) {
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
      assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`))
    }
    assert.doesNotMatch(sql, /create policy/)
    const grants = [...sql.matchAll(/grant [^;]* to ([^;]*);/g)]
    assert.ok(grants.length > 10)
    for (const g of grants) assert.equal(g[1].trim(), 'service_role', `granted to a client: ${g[0]}`)
    const made = [...sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map((m) => m[1])
    assert.deepEqual(made.sort(), ['claim_trial_nudge', 'extend_trial', 'note_trial_nudge_kind', 'owner_trials', 'release_trial_nudge', 'run_trial_nudges', 'set_trial_nudge_switch', 'trial_connected', 'trial_nudge_due', 'trial_nudge_hook_secret', 'trial_nudge_sending', 'trial_nudges_due'])
    for (const name of made) {
      assert.ok(new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`).test(sql), `a client can call ${name}`)
      assert.match(fnBody(sql, name).head, /security definer set search_path = ''/, `${name} runs with a path a caller can bend`)
    }
    /* MORE TIME: its refusals, the row locked so two at once take turns, never a second automatic week, and the end only ever later. */
    const extend = fnBody(sql, 'extend_trial').body
    assert.match(extend, /if uid is null or days is null or days < 1 or days > 30 or who is null or who not in \('owner', 'auto'\) then return jsonb_build_object\('ok', false, 'why', 'bad'\)/)
    assert.match(extend, /select \* into t from public\.trials tr where tr\.account_id = uid for update; if not found then return jsonb_build_object\('ok', false, 'why', 'none'\)/)
    assert.match(extend, /if exists \(select 1 from public\.entitlements e where e\.account_id = uid and e\.active\) then return jsonb_build_object\('ok', false, 'why', 'bought'\)/)
    assert.match(extend, /if who = 'auto' and exists \(select 1 from public\.trial_extensions x where x\.account_id = uid and x\."by" = 'auto'\) then return jsonb_build_object\('ok', false, 'why', 'had'/)
    assert.match(extend, /new_end := greatest\(now\(\), t\.ends_at\) \+ make_interval\(days => days\); update public\.trials tr set ends_at = new_end where tr\.account_id = uid; insert into public\.trial_extensions \(account_id, days, "by", old_ends_at, new_ends_at\) values \(uid, days, who, t\.ends_at, new_end\)/)
    assert.ok(extend.indexOf('for update') < extend.indexOf("'had'"), 'the automatic week is checked before the row is locked, so two at once both pass')
    /* Nothing else in the file moves a trial's end, and nothing writes a purchase. */
    assert.equal((sql.match(/set ends_at =/g) || []).length, 1, 'something besides extend_trial moves a trial’s end')
    assert.ok(!/(insert into|update|delete from) public\.entitlements/.test(sql), 'more time writes the purchase record')
    /* WHO IS DUE: one email a trial, on its last day, to a confirmed person who has not bought. */
    const due = fnBody(sql, 'trial_nudge_due').body
    for (const rule of [
      't.nudged_at is null',
      't.ends_at > now()',
      "(t.ends_at <= now() + interval '24 hours' or x.at > now() - interval '2 days')",
      'u.deleted_at is null',
      'u.email_confirmed_at is not null',
      "lower(u.email) not like '%@pair.fractal.newbold.cloud'",
      'not exists (select 1 from public.entitlements p where p.account_id = t.account_id and p.active)'
    ]) assert.ok(due.includes(rule), `who is due the trial email is missing: ${rule}`)
    /* ASKING IS CLAIMING: the switch and the rule read again, and the write lands only on a trial not emailed yet. */
    const claim = fnBody(sql, 'claim_trial_nudge').body
    assert.match(claim, /if not public\.trial_nudge_sending\(\) then return false; end if; if not exists \(select 1 from public\.trial_nudge_due\(\) d where d\.account_id = uid\) then return false; end if; update public\.trials t set nudged_at = now\(\), nudge_kind = which where t\.account_id = uid and t\.nudged_at is null returning true into claimed/)
    /* A claim is taken back only minutes after it was made, and never a refusal. */
    assert.match(fnBody(sql, 'release_trial_nudge').body, /where t\.account_id = uid and t\.nudged_at > now\(\) - interval '15 minutes' and t\.nudge_kind is distinct from 'refused'/)
    /* Connected: a computer ever seen, or the phone's own word about Bluetooth. */
    assert.match(fnBody(sql, 'trial_connected').body, /select exists \(select 1 from public\.computer_seen c where c\.account_id = uid\) or exists \(select 1 from public\.bluetooth_seen b where b\.account_id = uid\)/)
    /* Justin's list: the email as before, never the account's id or the device, and the new facts. */
    const list = fnBody(sql, 'owner_trials').body
    assert.ok(!/'account_id'|'id'|device_key/.test(list), 'the Trials page is sent an account id or the device column')
    for (const field of ['email', 'started_at', 'ends_at', 'platform', 'source', 'converted', 'connected', 'nudged_at', 'nudge_kind', 'extended_days', 'extended_by', 'extended_at']) assert.ok(list.includes(`'${field}',`), `owner_trials has no ${field}`)
    /* The hourly look, off the hour and off the setup emails' minute, to the function by its own secret. */
    assert.match(sql, /perform cron\.schedule\('trial-nudges', '41 \* \* \* \*', 'select public\.run_trial_nudges\(\)'\)/)
    const call = fnBody(sql, 'run_trial_nudges').body
    assert.match(call, /fn_url text := 'https:\/\/biznwrqeckviawjuhvyg\.supabase\.co\/functions\/v1\/trial-nudge'/)
    assert.match(call, /where name = 'trial_nudge_hook_secret'/)
    assert.match(call, /'x-hook-secret', hook_secret/)
    assert.doesNotMatch(sql, /extensions\.net\.http_post/)
    /* No secret's value is in the file: it is made in the vault. */
    assert.match(sql, /vault\.create_secret\( encode\(extensions\.gen_random_bytes\(32\), 'hex'\), 'trial_nudge_hook_secret'/)
  })

  test('trial email: each trial on Justin’s page says connected or not, emailed, and extended, and counts them', async () => {
    const { TRIAL_EXTEND_DAYS, TRIAL_EXTEND_LABEL, TRIAL_NUDGE_TURN_ON, trialExtendAsk, trialExtendSaid, trialNotes, trialNudgeCard, trialNudgeProblem, trialSections, trialsPageSections } = await import('../shared/admin.mjs')
    assert.equal(TRIAL_EXTEND_DAYS, TRIAL_EXTRA_DAYS, 'the button gives a different number of days from the email’s week')
    assert.equal(TRIAL_EXTEND_LABEL, 'Give 7 more days')
    const day = (ms) => `${new Date(ms).toLocaleString('en-US', { month: 'short' })} ${new Date(ms).getDate()}, ${new Date(ms).getFullYear()}`
    const base = { started_at: iso(NOW - 6 * DAY_MS), ends_at: iso(NOW + DAY_MS), platform: 'android', source: 'server', converted: false }
    const answer = {
      ok: true,
      trials: [
        /* Never connected, emailed with its week. */
        { ...base, email: 'ann@x.y', ends_at: iso(NOW + 8 * DAY_MS), connected: false, nudged_at: iso(NOW - 3600000), nudge_kind: 'extend', extended_days: 7, extended_by: 'auto', extended_at: iso(NOW - 3600000) },
        /* An iPhone, connected, emailed, and given a week by hand. */
        { ...base, email: 'bob@x.y', platform: 'ios', ends_at: iso(NOW + 9 * DAY_MS), connected: true, nudged_at: iso(NOW - DAY_MS), nudge_kind: 'ask', extended_days: 7, extended_by: 'owner', extended_at: iso(NOW - 7200000) },
        /* Nothing yet. */
        { ...base, email: 'cat@x.y', connected: false, nudged_at: null, nudge_kind: null, extended_days: 0, extended_by: null, extended_at: null },
        /* Given a day, then got the full version. */
        { ...base, email: 'dan@x.y', started_at: iso(NOW - 20 * DAY_MS), ends_at: iso(NOW - 12 * DAY_MS), converted: true, connected: true, nudged_at: iso(NOW - 14 * DAY_MS), nudge_kind: 'ask', extended_days: 1, extended_by: 'owner', extended_at: iso(NOW - 13 * DAY_MS) },
        /* Ended, the email refused, nothing more. */
        { ...base, email: 'eve@x.y', started_at: iso(NOW - 20 * DAY_MS), ends_at: iso(NOW - 13 * DAY_MS), connected: false, nudged_at: iso(NOW - 14 * DAY_MS), nudge_kind: 'refused', extended_days: 0, extended_by: null, extended_at: null }
      ]
    }
    const page = trialsPageSections(answer, NOW)
    const row = (email) => page.flatMap((s) => s.rows).find((r) => r.email === email)
    assert.match(row('ann@x.y').value, new RegExp(`^Android, started .*, 8 days left \\(ends .*\\)\\. Never connected a unit\\. Emailed on ${day(NOW - 3600000)}\\. Extended by 7 days \\(automatically\\) on ${day(NOW - 3600000)}\\.$`))
    assert.match(row('bob@x.y').value, new RegExp(`\\. Connected a unit\\. Emailed on ${day(NOW - DAY_MS)}\\. Extended by 7 days \\(by you\\) on ${day(NOW - 7200000)}\\.$`))
    assert.match(row('cat@x.y').value, /left \(ends .*\)\. Never connected a unit\.$/)
    assert.match(row('dan@x.y').value, new RegExp(`Has the full version\\. Connected a unit\\. Emailed on .*\\. Extended by 1 day \\(by you\\) on ${day(NOW - 13 * DAY_MS)}\\.$`))
    assert.match(row('eve@x.y').value, /no full version\. Never connected a unit\. The trial email was refused on .*\.$/)
    /* The button: under every trial without the full version, running or ended; never under one that has it. */
    assert.deepEqual(page.flatMap((s) => s.rows).filter((r) => r.extend).map((r) => r.email).sort(), ['ann@x.y', 'bob@x.y', 'cat@x.y', 'eve@x.y'])
    assert.equal(row('dan@x.y').extend, false)
    /* The counts: emailed (a refusal is not one), given more time, and the full version after it. */
    const counts = Object.fromEntries(page[0].rows.map((r) => [r.label, r.value]))
    assert.equal(counts.Emailed, '3')
    assert.equal(counts['Given more time'], '3')
    assert.equal(counts['Full version after more time'], '1')
    assert.deepEqual(trialSections(answer, NOW)[0].rows.map((r) => r.label).slice(-3), ['Emailed', 'Given more time', 'Full version after more time'], 'Sales does not count them too')
    /* An older server says none of it: no notes, no counts, and nothing made up (a nought would be a guess). */
    const old = { ok: true, trials: [{ ...base, email: 'old@x.y' }] }
    assert.equal(trialNotes(old.trials[0]), '')
    assert.deepEqual(trialsPageSections(old, NOW)[0].rows.map((r) => r.label), ['Started today', 'Last 7 days', 'Last 30 days', 'All time', 'On a trial now', 'Full version after a trial'])
    assert.match(trialsPageSections(old, NOW)[1].rows[0].value, /left \(ends .*\)\.$/)
    /* What the button asks first, and says after. */
    assert.equal(trialExtendAsk('cat@x.y'), 'cat@x.y’s free trial gets 7 more days, counted from its end, or from now if it has ended. They aren’t emailed: their app shows the new end the next time it is opened with a connection.')
    assert.equal(trialExtendSaid({ ok: true, message: 'cat@x.y has 7 more days.', endsAt: iso(NOW + 8 * DAY_MS) }), `cat@x.y has 7 more days. Their trial now ends ${day(NOW + 8 * DAY_MS)}.`)
    assert.equal(trialExtendSaid({ ok: false, message: 'cat@x.y has the full version already, so there is no trial to add days to.' }), 'cat@x.y has the full version already, so there is no trial to add days to.')
    /* A server or a database from before it, in plain words. */
    assert.match(trialNudgeProblem({ ok: false, message: 'Unknown action.' }), /server update that goes with it/)
    assert.match(trialNudgeProblem({ ok: false, message: 'Something went wrong: extend_trial: 404 {"code":"PGRST202"}' }), /database change that goes with it/)
    assert.match(trialNudgeProblem({ ok: false, message: 'Something went wrong: trial_nudge_sending: 404' }), /database change/)
    assert.equal(trialNudgeProblem({ ok: true }), null)
    /* The card: on or off, as the server says, and nothing until it has. */
    assert.equal(trialNudgeCard({ ok: true, enabled: false }).title, 'Trial email: off')
    assert.equal(trialNudgeCard({ ok: true, enabled: true }).title, 'Trial email: on')
    assert.equal(trialNudgeCard({ ok: true }).on, false, 'a server that did not say is read as on')
    assert.equal(trialNudgeCard({ ok: false, message: 'Unknown action.' }), null)
    assert.equal(trialNudgeCard(null), null)
    for (const words of [TRIAL_NUDGE_TURN_ON, trialNudgeCard({ ok: true }).line, trialExtendAsk('a@b.c')]) assert.doesNotMatch(words, /this phone|VP4|—/)
  })

  test('trial email: the Trials page on both ends has the button, asked first, and the email’s switch and sample', () => {
    const phone = read('mobile/src/components/TrialsTool.js')
    const web = read('src/components/TrialsTool.jsx')
    for (const [name, src] of [['phone', phone], ['browser', web]]) {
      /* More time: asked first, sent by the address on the row, said in the shared words, and the list read again. */
      assert.match(src, /const res = await ask\('extend-trial', email\)/, `the ${name}’s button does not ask the server`)
      assert.match(src, /setGiven\(\{ email, ok: res\.ok, words: trialExtendSaid\(res\) \}\)\s+if \(res\.ok\) load\(\)/, `the ${name} does not say what the button did, or read the list again`)
      assert.match(src, /row\.extend \?/, `the ${name} draws the button under a trial that has the full version`)
      assert.match(src, /detail=\{under\}/)
      assert.match(src, /trialExtendAsk\(email\)/, `the ${name}’s button gives the days without asking`)
      /* The switch: read when the page opens, set only to exactly true or false, and on only after a yes. */
      assert.match(src, /setNudge\(await ask\('trial-nudge-switch'\)\)/, `the ${name} does not read the switch`)
      assert.match(src, /TRIAL_NUDGE_TURN_ON/, `the ${name} turns the trial email on without asking`)
      assert.match(src, /run\('sample', 'trial-nudge-sample'\)/, `the ${name} has no sample`)
      assert.match(src, /trialNudgeCard\(nudge\)/)
      assert.match(src, /trialNudgeProblem\(res\)/, `the ${name} shows the server’s refusal raw`)
    }
    assert.match(phone, /Alert\.alert\(`\$\{TRIAL_EXTEND_LABEL\}\?`, trialExtendAsk\(email\), \[\s+\{ text: 'Not now', style: 'cancel' \},\s+\{ text: TRIAL_EXTEND_LABEL, onPress: \(\) => extend\(email\) \}/)
    assert.match(phone, /if \(!on\) return run\('switch', 'trial-nudge-switch', \{ enabled: false \}\)\s+Alert\.alert\('Turn the trial email on\?', TRIAL_NUDGE_TURN_ON, \[\s+\{ text: 'Not yet', style: 'cancel' \},\s+\{ text: 'Turn it on', onPress: \(\) => run\('switch', 'trial-nudge-switch', \{ enabled: true \}\) \}/)
    assert.match(web, /if \(!window\.confirm\(`\$\{TRIAL_EXTEND_LABEL\}\? \$\{trialExtendAsk\(email\)\}`\)\) return/)
    assert.match(web, /if \(on && !window\.confirm\(`Turn the trial email on\? \$\{TRIAL_NUDGE_TURN_ON\}`\)\) return\s+run\('switch', 'trial-nudge-switch', \{ enabled: on \}\)/)
    /* Still his pages only: the tool is drawn where it was, behind his account. */
    assert.match(read('mobile/src/screens/Settings.js'), /\{devTab\.customers === 'trials' \? <TrialsTool \/> : null\}/)
    assert.match(read('src/App.jsx'), /\{setupPage === 'trials' && isAdmin\(link\.account\?\.id\) \? \(/)
  })

  test('trial email: the README says the order to put it live, and that the switch stays off until the sample is read', () => {
    const readme = read('supabase/README.md')
    const at = readme.indexOf('## Trial email and extensions')
    assert.ok(at >= 0, 'supabase/README.md has no section for the trial email')
    const section = readme.slice(at, readme.indexOf('\n## ', at + 5) < 0 ? undefined : readme.indexOf('\n## ', at + 5))
    const steps = ['migrations/20261125_trial_extensions.sql', '`supabase functions deploy trial-nudge --no-verify-jwt`', '`supabase functions deploy grant-access`', 'Send me a sample', 'Turn the trial email on'].map((s) => section.indexOf(s))
    assert.ok(steps.every((i) => i >= 0), `the section is missing a step: ${steps}`)
    assert.deepEqual(steps, [...steps].sort((a, b) => a - b), 'the steps are out of order')
    assert.match(section, /trial_nudge_hook_secret/)
    assert.match(section, /off until/i)
  })
}
