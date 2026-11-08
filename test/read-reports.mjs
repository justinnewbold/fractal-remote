/**
 * THE READ-ONLY DOOR TO THE BUG REPORTS (8 November 2026).
 *
 * "A read-only login for bug reports ... so I can open people's reports
 * myself instead of you forwarding the emails." scripts/report.mjs read
 * them with the full-account SUPABASE_TOKEN; now it asks
 * supabase/functions/read-reports with a key that can do nothing else. The
 * ways that door could be quietly wrong, each held here:
 *
 *   - a question it should not answer (a third kind, a count past 50, an id
 *     that is SQL), or any way to write, change or delete through it
 *   - an answer to somebody with no key, a short key or the wrong one, or a
 *     refusal that tells a stranger more than "not allowed"
 *   - enrolment open with the secret unset, or to the wrong token, or a key
 *     kept as it was sent rather than as its hash
 *   - the key in a log line, an answer, or a request to the database
 *   - the database functions reachable by the app's public key, or reading
 *     anything but public.feedback
 *   - the script putting a secret on curl's command line, or reaching for
 *     the full-account token unless asked
 *
 * The function is run as it is, under Node (which strips TypeScript's types
 * itself), with Deno stood in for and a fetch that answers as the database
 * would.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const sqlOf = (p) => read(p).replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim()
const sha = (s) => createHash('sha256').update(s).digest('hex')

const FN = 'supabase/functions/read-reports/index.ts'
const SQL = 'supabase/migrations/20261108_report_readers.sql'
const PROJECT = 'https://project.test'
const SERVICE = 'the-service-role-key'
const KEY = 'correct horse battery staple violin'
const OTHER = 'a-different-key-nobody-enrolled-0000'
const ENROLL = 'e'.repeat(16) + '0123456789abcdef0123456789abcdef'
const ROWS = [{ id: '014f2692-0000-4000-8000-000000000001', created_at: '2026-11-08T10:00:00+00:00', kind: 'bug', message: 'It froze', contact: null, unit: 'FM3', version: '1.89.75', os: 'ios', log_length: 1200 }]
let runs = 0

/** The function's module, loaded with Deno stood in for (its pure helpers need nothing else). */
async function load(env = {}) {
  const was = globalThis.Deno
  let handler = null
  globalThis.Deno = { serve: (h) => (handler = h), env: { get: (n) => env[n] } }
  try {
    const mod = await import(`${new URL(`../${FN}`, import.meta.url).href}?run=${++runs}`)
    return { mod, handler }
  } finally {
    globalThis.Deno = was
  }
}

/*
 * THE FUNCTION, RUN. `hashes` is what report_reader_hashes() answers (or
 * 'fail'), `enrolled(body)` what enroll_report_reader answers, `rows` what
 * either read answers (or 'fail'). Every call and every logged line is kept.
 */
async function door({ method = 'GET', path = '/read-reports?latest=10', key, body, secret, hashes = [sha(KEY)], enrolled = () => ({ ok: true, why: 'enrolled', keys: 1 }), rows = ROWS } = {}) {
  const calls = []
  const logged = []
  const env = { SUPABASE_URL: PROJECT, SUPABASE_SERVICE_ROLE_KEY: SERVICE, ...(secret === undefined ? {} : { READ_REPORTS_ENROLL: secret }) }
  const was = { fetch: globalThis.fetch, Deno: globalThis.Deno, log: console.log, error: console.error }
  const answer = (status, value) => new Response(value === undefined ? '' : JSON.stringify(value), { status })
  globalThis.Deno = { serve: () => {}, env: { get: (n) => env[n] } }
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, raw: init.body || '', body: init.body ? JSON.parse(init.body) : null }
    calls.push(call)
    const rpc = call.url.startsWith(`${PROJECT}/rest/v1/rpc/`) ? call.url.slice(`${PROJECT}/rest/v1/rpc/`.length) : null
    if (rpc === 'report_reader_hashes') return hashes === 'fail' ? answer(500, { message: 'no' }) : answer(200, hashes)
    if (rpc === 'enroll_report_reader') return answer(200, enrolled(call.body))
    if (rpc === 'read_reports_latest' || rpc === 'read_report') return rows === 'fail' ? answer(500, { message: 'no' }) : answer(200, rows)
    return answer(500, { msg: `nothing answers ${call.url} here` })
  }
  console.log = (...a) => logged.push(a.join(' '))
  console.error = (...a) => logged.push(a.join(' '))
  try {
    const mod = await import(`${new URL(`../${FN}`, import.meta.url).href}?run=${++runs}`)
    const headers = { ...(key === undefined ? {} : { 'x-reports-key': key }), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }
    const res = await mod.handle(new Request(`https://functions.test${path}`, { method, headers, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) }))
    const text = await res.text()
    return { status: res.status, text, said: JSON.parse(text), headers: res.headers, calls, logged, rpcs: calls.map((c) => c.url.split('/rpc/')[1]) }
  } finally {
    globalThis.fetch = was.fetch
    globalThis.Deno = was.Deno
    console.log = was.log
    console.error = was.error
  }
}

/** Nothing the key could be found in: not the answer, not a log line, not anything sent to the database. */
function keyNowhere(run, key = KEY) {
  assert.ok(!run.text.includes(key), 'the answer repeats the key')
  for (const line of run.logged) assert.ok(!line.includes(key), `a log line has the key: ${line}`)
  for (const c of run.calls) assert.ok(!c.raw.includes(key) && !JSON.stringify(c.headers).includes(key), `the key was sent to ${c.url}`)
}

export function run(test) {
  test('read-reports: two questions only, a count from 1 to 50 or an id’s start, and nothing it could write with', async () => {
    const { mod } = await load()
    const at = (p, m = 'GET') => mod.route(m, `https://functions.test${p}`)
    assert.equal(mod.MOST, 50)
    for (const n of [1, 10, 25, 50]) assert.deepEqual(at(`/read-reports?latest=${n}`), { kind: 'latest', most: n })
    /* The platform's own address shape, with the functions prefix, answers the same. */
    assert.deepEqual(at('/functions/v1/read-reports/?latest=5'), { kind: 'latest', most: 5 })
    for (const bad of ['0', '51', '99', '2.5', '-1', '010', 'ten', '', '1e1', '10;drop table x', ' 10', '10%20'])
      assert.deepEqual([at(`/read-reports?latest=${bad}`).kind, at(`/read-reports?latest=${bad}`).status], ['refused', 400], `latest=${bad} was taken`)
    assert.deepEqual(at('/read-reports?id=014F2692'), { kind: 'one', prefix: '014f2692' })
    assert.deepEqual(at('/read-reports?id=014f2692-0000-4000-8000-000000000001'), { kind: 'one', prefix: '014f2692-0000-4000-8000-000000000001' })
    for (const bad of ['', 'abc', '014f269', "014f2692'%20or%20'1'='1", '014f2692;--', 'zzzzzzzz', 'x'.repeat(40), '0'.repeat(37), '014f2692%25', '014f_692'])
      assert.equal(at(`/read-reports?id=${bad}`).status, 400, `id=${bad} was taken`)
    /* One question at a time, and only these two. */
    for (const q of ['', '?', '?latest=10&id=014f2692', '?latest=10&latest=10', '?limit=10', '?select=*', '?id=014f2692&table=users'])
      assert.deepEqual(at(`/read-reports${q}`), { kind: 'refused', status: 400, why: at(`/read-reports${q}`).why, read: true }, `${q} was answered`)
    /* Reading is a GET and nothing else; /enroll a POST with no query; nothing anywhere else. */
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) assert.deepEqual([at('/read-reports?latest=10', m).status, at('/read-reports?latest=10', m).read], [405, false], `${m} reads`)
    for (const m of ['GET', 'PUT', 'DELETE']) assert.equal(at('/read-reports/enroll', m).status, 405, `${m} /enroll`)
    assert.equal(at('/read-reports/enroll?x=1', 'POST').status, 400)
    assert.deepEqual(at('/read-reports/enroll', 'POST'), { kind: 'enroll' })
    for (const p of ['/read-reports/feedback', '/read-reports/users?latest=1', '/other?latest=1', '/read-reports/enroll/x']) assert.equal(at(p).status, 404, `${p} answered`)
  })

  test('read-reports: no key, a short key or the wrong one is a 401, before anything is read or anything about the question is said', async () => {
    for (const key of [undefined, '', 'short', 'x'.repeat(19), 'é'.repeat(30), 'x'.repeat(257)]) {
      const r = await door({ key })
      assert.equal(r.status, 401, `${JSON.stringify(key)} was let in`)
      assert.deepEqual(r.said, { ok: false, why: 'not allowed' })
      assert.deepEqual(r.calls, [], 'a key of the wrong shape asked the database anything')
    }
    const wrong = await door({ key: OTHER })
    assert.equal(wrong.status, 401)
    assert.deepEqual(wrong.rpcs, ['report_reader_hashes'], 'a wrong key reached a read')
    keyNowhere(wrong, OTHER)
    /* No keys kept yet is a door nobody opens. */
    assert.equal((await door({ key: KEY, hashes: [] })).status, 401)
    assert.equal((await door({ key: KEY, hashes: null })).status, 401)
    /* A bad question without a key is the same 401: a stranger learns nothing about what would be answered. */
    for (const path of ['/read-reports?latest=99', '/read-reports?id=nope', '/read-reports']) {
      const r = await door({ path, key: OTHER })
      assert.deepEqual([r.status, r.said], [401, { ok: false, why: 'not allowed' }], `${path} without a key said more than not allowed`)
    }
    /* The database not answering is a 502, never a way in. */
    const down = await door({ key: KEY, hashes: 'fail' })
    assert.deepEqual([down.status, down.rpcs], [502, ['report_reader_hashes']])
    /* A key that is only the start of a kept one, or a kept hash sent as the key, is not it. */
    assert.equal((await door({ key: KEY.slice(0, 25) })).status, 401)
    assert.equal((await door({ key: sha(KEY) })).status, 401)
  })

  test('read-reports: the right key gets the two answers, through the two fixed database questions, and the key goes nowhere', async () => {
    const list = await door({ key: KEY })
    assert.equal(list.status, 200)
    assert.deepEqual(list.said, { ok: true, reports: ROWS })
    assert.deepEqual(list.rpcs, ['report_reader_hashes', 'read_reports_latest'])
    assert.deepEqual(list.calls[1].body, { most: 10 })
    assert.equal(list.calls[1].headers.Authorization, `Bearer ${SERVICE}`)
    assert.equal(list.headers.get('cache-control'), 'no-store')
    assert.equal(list.headers.get('access-control-allow-origin'), null, 'a web page could read the reports')
    keyNowhere(list)
    assert.ok(list.logged.includes('read-reports: latest 10, 1 answered'), list.logged.join('\n'))

    const one = await door({ key: KEY, path: '/read-reports?id=014F2692' })
    assert.deepEqual([one.status, one.rpcs, one.calls[1].body], [200, ['report_reader_hashes', 'read_report'], { prefix: '014f2692' }])
    keyNowhere(one)
    /* Its key among three kept, in any place, opens it. */
    for (const hashes of [[sha(KEY), sha('a'), sha('b')], [sha('a'), sha(KEY), sha('b')], [sha('a'), sha('b'), sha(KEY)]]) assert.equal((await door({ key: KEY, hashes })).status, 200)
    /* With the key, a bad question is a 400, and nothing is read. */
    const bad = await door({ key: KEY, path: '/read-reports?latest=51' })
    assert.deepEqual([bad.status, bad.rpcs], [400, ['report_reader_hashes']])
    /* A read the database refuses is a 502 that says nothing of why. */
    const down = await door({ key: KEY, rows: 'fail' })
    assert.deepEqual([down.status, down.said], [502, { ok: false, why: 'the database did not answer' }])
    /* And no write anywhere: POST, PUT and DELETE to the reading door are 405 without a single call. */
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const r = await door({ key: KEY, method, body: { id: '014f2692', message: 'x' } })
      assert.deepEqual([r.status, r.calls.length], [405, 0], `${method} did something`)
    }
  })

  test('read-reports: /enroll is shut unless the secret is set, opens only to the token, and keeps the key’s hash, never the key', async () => {
    const enrol = (o = {}) => door({ method: 'POST', path: '/read-reports/enroll', key: KEY, body: { enroll: ENROLL }, secret: ENROLL, ...o })
    /* Secret unset, or too short to be a secret: shut, whatever is sent, and nothing asked. */
    for (const secret of [undefined, '', 'short', 'x'.repeat(31)]) {
      const r = await enrol({ secret, body: { enroll: secret ?? ENROLL } })
      assert.deepEqual([r.status, r.said.why, r.calls.length], [403, 'enrolment is closed', 0], `enrolment opened with ${JSON.stringify(secret)}`)
    }
    /* The wrong token, part of it, or none: 403, and nothing kept. */
    for (const body of [{ enroll: 'nope' }, { enroll: ENROLL.slice(0, -1) }, { enroll: `${ENROLL}x` }, { enroll: ENROLL.toUpperCase() }, {}, { enroll: 12 }, { token: ENROLL }]) {
      const r = await enrol({ body })
      assert.deepEqual([r.status, r.said.why, r.calls.length], [403, 'wrong enrolment token', 0], `${JSON.stringify(body)} enrolled`)
      keyNowhere(r)
    }
    for (const body of ['not json', 'x'.repeat(3000)]) assert.deepEqual([(await enrol({ body })).status, (await enrol({ body })).calls.length], [400, 0])
    /* The right token, but no key (the proxy sent none) or one too short to keep. */
    for (const key of [undefined, '', 'short-key']) {
      const r = await enrol({ key })
      assert.deepEqual([r.status, r.calls.length], [400, 0], `${JSON.stringify(key)} was kept`)
    }
    /* The right token and a key: its SHA-256 is kept, and nothing else is sent or said. */
    const ok = await enrol()
    assert.deepEqual([ok.status, ok.said], [200, { ok: true, why: 'enrolled', keys: 1 }])
    assert.deepEqual(ok.rpcs, ['enroll_report_reader'])
    assert.deepEqual(ok.calls[0].body, { key_hash: sha(KEY), replace_others: false })
    keyNowhere(ok)
    assert.ok(!ok.text.includes(sha(KEY)) && !ok.logged.some((l) => l.includes(sha(KEY))), 'the hash is answered or logged')
    assert.ok(!ok.logged.some((l) => l.includes(ENROLL)) && !ok.text.includes(ENROLL), 'the token is answered or logged')
    /* Rolling a key over: replace, and only when it says true. */
    assert.equal((await enrol({ body: { enroll: ENROLL, replace: true } })).calls[0].body.replace_others, true)
    assert.equal((await enrol({ body: { enroll: ENROLL, replace: 'yes' } })).calls[0].body.replace_others, false)
    /* Three kept already: 409, and it says how to make room. */
    const full = await enrol({ enrolled: () => ({ ok: false, why: 'full', keys: 3 }) })
    assert.equal(full.status, 409)
    assert.match(full.said.why, /three keys are kept already/)
    /* Enrolling never needs a key that is kept already: /enroll asks nothing about the reads. */
    assert.ok(!(await enrol({ hashes: [] })).rpcs.includes('report_reader_hashes'))
  })

  test('read-reports: the comparisons look at every character, and every kept hash, whatever matched', async () => {
    const { mod } = await load()
    assert.equal(mod.sameHex(sha('a'), sha('a')), true)
    assert.equal(mod.sameHex(sha('a'), sha('b')), false)
    assert.equal(mod.sameHex(sha('a'), sha('a').slice(0, 63)), false)
    assert.equal(mod.among([sha('a'), sha('b')], sha('b')), true)
    assert.equal(mod.among([], sha('b')), false)
    assert.equal(mod.among('not a list', sha('b')), false)
    assert.equal(await mod.sameSecret(ENROLL, ENROLL), true)
    assert.equal(await mod.sameSecret(ENROLL.slice(0, 40), ENROLL), false)
    assert.equal(await mod.sha256Hex(KEY), sha(KEY))
    /* No early way out: no return or break inside the loops, no === between secrets, no string compare of the key. */
    const src = code(read(FN))
    for (const name of ['sameBytes', 'sameHex', 'among']) {
      const at = src.indexOf(`export function ${name}(`)
      const body = src.slice(at, src.indexOf('\n}\n', at))
      const loop = body.slice(body.indexOf('for ('))
      assert.ok(!/\breturn\b|\bbreak\b/.test(loop.slice(0, loop.indexOf('\n'))), `${name} leaves its loop early`)
      assert.match(body, /diff \|=|hit \|=/, `${name} does not fold every comparison in`)
    }
    assert.ok(!/(token|secret|key|given|expected)\s*(===|!==|==|!=)\s*(token|secret|key|given|expected)\b/.test(src), 'two secrets are compared with ===')
    assert.ok(!/\.includes\(\s*mine\s*\)|indexOf\(\s*mine\s*\)/.test(src), 'the hash is looked up with includes')
  })

  test('read-reports: the function can only read, only through the four database functions, and never logs or repeats the key', () => {
    const src = code(read(FN))
    const named = [...src.matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1]).sort()
    assert.deepEqual([...new Set(named)], ['enroll_report_reader', 'read_report', 'read_reports_latest', 'report_reader_hashes'])
    /* No table through the API, no Storage, no Auth, no other service: one fetch, to rpc/. */
    assert.deepEqual([...src.matchAll(/fetch\(/g)].length, 1)
    assert.match(src, /fetch\(`\$\{env\('SUPABASE_URL'\)\}\/rest\/v1\/rpc\/\$\{name\}`/)
    assert.ok(!/storage\/v1|auth\/v1|\/rest\/v1\/(?!rpc)/.test(src), 'the function reaches past its four database functions')
    /* The key is read once, and goes only to the shape check and the hash. */
    assert.equal([...src.matchAll(/x-reports-key/g)].length, 2, 'the header is read or named in more places than its one read and its one refusal')
    assert.ok(!/console\.\w+\([^\n]*(\$\{\s*(key|token|secret)\s*\}|[,(+]\s*(key|token|secret)\s*[,)+])/.test(src), 'a log line could carry the key or the token')
    assert.match(src, /^Deno\.serve\(handle\)$/m)
    assert.ok(!/Access-Control-Allow/.test(src), 'the function answers web pages')
  })

  test('read-reports: no function on the project logs a request’s headers, since the proxy sends the key to all of them', () => {
    const dirs = readdirSync(new URL('../supabase/functions/', import.meta.url)).filter((d) => !d.startsWith('_') && !d.includes('.'))
    assert.ok(dirs.includes('read-reports'))
    for (const d of dirs) {
      const src = code(read(`supabase/functions/${d}/index.ts`))
      /* A request's headers are only ever asked one by one, by name: never walked, copied or handed on whole. */
      for (const m of src.matchAll(/\breq\.headers\b(.{0,40})/g)) assert.match(m[1], /^\.get\('[A-Za-z-]+'\)/, `${d} uses a request's headers whole: req.headers${m[1]}`)
      assert.ok(!/console\.\w+\([^\n]*\breq\b(?!\.method)/.test(src), `${d} logs the request`)
      if (d !== 'read-reports') assert.ok(!/x-reports-key/i.test(src), `${d} reads the reports key`)
    }
  })

  test('read-reports: the keys live in a private table, and the four database functions are the service role’s alone', () => {
    const q = sqlOf(SQL)
    assert.match(q, /create schema if not exists private;/)
    assert.match(q, /create table if not exists private\.report_reader_keys \( hash text primary key check \(hash ~ '\^\[0-9a-f\]\{64\}\$'\), created_at timestamptz not null default now\(\) \);/)
    assert.match(q, /alter table private\.report_reader_keys enable row level security;/)
    assert.match(q, /revoke all on table private\.report_reader_keys from public, anon, authenticated;/)
    assert.ok(!/create policy/.test(q), 'a policy opens the keys table to somebody')
    assert.ok(!/grant [^;]* to (anon|authenticated|public)/.test(q), 'something is granted to the app’s keys')
    const sigs = { report_reader_hashes: '', enroll_report_reader: 'text, boolean', read_reports_latest: 'integer', read_report: 'text' }
    for (const [name, args] of Object.entries(sigs)) {
      assert.ok(q.includes(`create or replace function public.${name}(`), `no ${name}`)
      assert.ok(q.includes(`revoke all on function public.${name}(${args}) from public, anon, authenticated;`), `${name} is not taken from the app’s keys`)
      assert.ok(q.includes(`grant execute on function public.${name}(${args}) to service_role;`), `${name} is not the service role’s`)
      const at = q.indexOf(`create or replace function public.${name}(`)
      const head = q.slice(at, q.indexOf(' as $$', at))
      assert.match(head, /set search_path = ''/, `${name} leaves its search path to the caller`)
      /* The keys need the definer (their schema is nobody else's); the reads run as the service role that calls them. */
      assert.equal(/security definer/.test(head), name.startsWith('report_reader') || name.startsWith('enroll'), `${name} has the wrong security`)
    }
    /* The function names exactly the four the migration makes. */
    const made = [...q.matchAll(/create or replace function public\.([a-z_]+)\(/g)].map((m) => m[1]).sort()
    const used = [...new Set([...code(read(FN)).matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1]))].sort()
    assert.deepEqual(made, used)
  })

  test('read-reports: the two database questions are the script’s old SELECTs, read only, on public.feedback alone, and the cap is three', async () => {
    const q = sqlOf(SQL)
    const body = (name) => {
      const at = q.indexOf(`create or replace function public.${name}(`)
      const open = q.indexOf('as $$', at)
      return q.slice(open + 5, q.indexOf('$$;', open))
    }
    const latest = body('read_reports_latest')
    const one = body('read_report')
    assert.match(latest, /if most is null or most < 1 or most > 50 then raise exception/)
    assert.ok(latest.includes("select f.id, f.created_at, f.kind, left(f.message, 140) as message, f.contact, f.context ->> 'unit' as unit, f.context ->> 'version' as version, f.context ->> 'os' as os, length(f.log) as log_length from public.feedback f order by f.created_at desc limit most"))
    assert.match(one, /if prefix is null or prefix !~ '\^\[0-9a-f-\]\{8,36\}\$' then raise exception/)
    assert.ok(one.includes("select f.id, f.created_at, f.kind, f.message, f.contact, f.context, f.log from public.feedback f where f.id::text like prefix || '%' order by f.created_at desc limit 2"))
    for (const [name, b] of [['read_reports_latest', latest], ['read_report', one]]) {
      assert.ok(!/\b(insert|update|delete|drop|alter|grant|truncate|execute|perform)\b/i.test(b), `${name} writes`)
      assert.deepEqual([...b.matchAll(/\bfrom ([a-z_.]+)/g)].map((m) => m[1]).filter((t) => t.includes('.')), ['public.feedback'], `${name} reads another table`)
      assert.ok(q.includes(`create or replace function public.${name}(`) && /stable/.test(q.slice(q.indexOf(`public.${name}(`), q.indexOf('as $$', q.indexOf(`public.${name}(`)))), `${name} is not marked read only`)
    }
    /* The script's old SQL (--management-api) and the database's ask the same columns of the same rows. */
    const r = await import('../scripts/report.mjs')
    const bare = (sql) => sql.replace(/\bf\./g, '').replace(/ public\.feedback f /, ' public.feedback ').replace(/\s*->>\s*/g, '->>').replace(/prefix \|\| '%'/, "'014f2692%'").replace(/limit most$/, 'limit 10')
    const fromSql = (b) => b.slice(b.indexOf('select f.id'), b.indexOf(' ) r '))
    assert.equal(bare(fromSql(latest)), r.listQuery(10))
    assert.equal(bare(fromSql(one)), r.oneQuery('014f2692'))
    const enrol = body('enroll_report_reader')
    assert.match(enrol, /if kept >= 3 then return jsonb_build_object\('ok', false, 'why', 'full'/)
    assert.match(enrol, /lock table private\.report_reader_keys in share row exclusive mode;/)
    /* Every delete names its rows, and the only table it touches is the keys. */
    for (const m of enrol.matchAll(/delete from ([a-z_.]+)( k)? ([^;]*);/g)) {
      assert.equal(m[1], 'private.report_reader_keys')
      assert.match(m[3], /^where /, 'a delete with no WHERE')
    }
    assert.ok(!/public\.feedback/.test(enrol + body('report_reader_hashes')), 'the keys’ functions reach the reports')
    assert.ok(read(SQL).includes('APPLY THIS BEFORE DEPLOYING read-reports.'))
  })

  test('report.mjs asks the function by default, with nothing secret on curl’s command line, and the full-account token only when asked', async () => {
    const r = await import('../scripts/report.mjs')
    const { mod } = await load()
    assert.equal(r.MOST, mod.MOST, 'the script and the function count to different numbers')
    assert.equal(r.FUNCTION_URL, 'https://biznwrqeckviawjuhvyg.supabase.co/functions/v1/read-reports')
    assert.equal(r.latestUrl(), `${r.FUNCTION_URL}?latest=10`)
    assert.equal(r.latestUrl(50), `${r.FUNCTION_URL}?latest=50`)
    assert.equal(r.reportUrl('014F2692'), `${r.FUNCTION_URL}?id=014f2692`)
    for (const bad of [0, 51, 2.5, '10; drop table x', 'ten', '1e1']) assert.throws(() => r.latestUrl(bad), `--latest ${bad} was taken`)
    for (const bad of ['', 'abc', "014f2692' or '1'='1", '014f2692;--', '014f2692&latest=1', 'x'.repeat(40)]) assert.throws(() => r.reportUrl(bad), `${bad} was taken`)
    /* Whatever the script asks, the function takes as the same question. */
    assert.deepEqual(mod.route('GET', r.latestUrl(25)), { kind: 'latest', most: 25 })
    assert.deepEqual(mod.route('GET', r.reportUrl('014f2692-0000')), { kind: 'one', prefix: '014f2692-0000' })
    /* The function's directory is the address's last part. */
    assert.ok(read(FN).length && r.FUNCTION_URL.endsWith('/read-reports'))

    /* curl's arguments: a GET of the address, no header at all for the proxy to fill, or the key on stdin. */
    const plain = r.functionArgs(r.latestUrl())
    assert.deepEqual(plain, ['-sS', '--fail-with-body', '--max-time', '120', r.latestUrl()])
    const off = r.functionArgs(r.latestUrl(), { keyOnStdin: true })
    assert.deepEqual(off.slice(-3), ['-H', '@-', r.latestUrl()])
    for (const args of [plain, off]) {
      assert.ok(!args.some((a) => /x-reports-key|Bearer|Authorization/i.test(a)), 'a secret goes on curl’s command line')
      assert.ok(!args.includes('-X') && !args.some((a) => /^--data/.test(a)), 'the read sends a body or another method')
    }

    /* The command line: the list by default, through the function, and the old way only by name. */
    const plan = (...a) => r.plan(['node', 'scripts/report.mjs', ...a])
    assert.deepEqual(plan(), { kind: 'list', management: false, count: 10, url: r.latestUrl(10) })
    assert.deepEqual(plan('--latest', '25'), { kind: 'list', management: false, count: 25, url: r.latestUrl(25) })
    assert.deepEqual(plan('014f2692'), { kind: 'one', management: false, id: '014f2692', url: r.reportUrl('014f2692') })
    assert.equal(plan('--management-api', '--latest', '3').management, true)
    assert.equal(plan('014f2692', '--management-api').kind, 'one')
    assert.throws(() => plan('--latest', '99'))

    /* SUPABASE_TOKEN is read in the old way's one function and nowhere else. */
    const src = code(read('scripts/report.mjs'))
    const uses = [...src.matchAll(/SUPABASE_TOKEN/g)].map((m) => m.index)
    const old = src.indexOf('function askManagement(')
    assert.ok(uses.length >= 1 && uses.every((i) => i > old && i < src.indexOf('\n}\n', old)), 'the full-account token is reached for outside --management-api')
    assert.match(src, /input: key \? `x-reports-key: \$\{key\}\\n` : ''/)
    assert.match(src, /if \(\/\[\\r\\n\]\/\.test\(key\)\)/, 'a line break in the key would be a second header')

    /* A refused key is said plainly, and a failed call never repeats the key. */
    const key = 'my-long-reports-key-for-the-test-123'
    const err = r.callError({ status: 22, stdout: `{"ok":false,"why":"not allowed","k":"${key}"}`, stderr: `curl: (22) ${key}` }, key)
    assert.ok(!err.message.includes(key), err.message)
    assert.match(err.message, /The reports key was refused\. .*x-reports-key/)
    assert.doesNotMatch(r.callError({ status: 22, stdout: '{"ok":false,"why":"the database did not answer"}' }).message, /reports key was refused/)
    /* The function's answer, read: its rows, or a plain refusal. */
    assert.deepEqual(r.readAnswer(JSON.stringify({ ok: true, reports: ROWS })), ROWS)
    for (const bad of ['', 'nope', '{"ok":false,"why":"not allowed"}', '{"ok":true}', '[]']) assert.throws(() => r.readAnswer(bad), `${bad} was read as reports`)
  })

  test('read-reports: the README puts it live in order, with the key in the secure form and the token never printed', () => {
    const readme = read('supabase/README.md')
    const from = readme.indexOf('## Reading the reports without the full-account key (8 November 2026)')
    assert.ok(from > 0, 'the README does not say how the door goes live')
    const end = readme.indexOf('\n## ', from + 1)
    const part = readme.slice(from, end < 0 ? undefined : end)
    const at = (s) => part.indexOf(s)
    const steps = [
      '**Apply `20261108_report_readers.sql`.**',
      '**Merge the change, with every check green.**',
      "**Deploy read-reports from the merged commit's files, with verify JWT\n   off**: `supabase functions deploy read-reports --no-verify-jwt",
      '**Justin saves the key, in the secure form, never in the chat.**',
      '**Enrol the key, in one shell command**'
    ]
    for (const s of steps) assert.ok(at(s) > 0, `the README leaves out ${s}`)
    for (let i = 1; i < steps.length; i++) assert.ok(at(steps[i - 1]) < at(steps[i]), `the README puts ${steps[i]} before ${steps[i - 1]}`)
    assert.ok(at('`biznwrqeckviawjuhvyg.supabase.co`, header `x-reports-key`') > 0, 'the credential’s host and header are not said')
    assert.ok(at('`verify_jwt: false`') > 0)
    /* The enrolment block: made in the shell, on stdin only, never echoed, shut by a trap. */
    const block = part.slice(at('```sh'), part.indexOf('```\n', at('```sh') + 5))
    assert.match(block, /T=\$\(openssl rand -hex 32\)/)
    assert.match(block, /trap shut EXIT/)
    assert.ok(block.indexOf('trap shut EXIT') < block.indexOf('READ_REPORTS_ENROLL","value"'), 'enrolment is opened before the trap that shuts it')
    assert.ok(!/echo[^\n]*\$T|\$\{?T\}?[^\n]*>|curl[^|\n]*\$T/.test(block), 'the token is printed, written down or put on curl’s command line')
    for (const line of block.split('\n').filter((l) => l.includes('"$T"'))) assert.match(line, /^\s*printf '[^']*' "\$T" \| curl .*--data-binary @-/, `the token goes somewhere but curl's stdin: ${line}`)
    assert.ok(!/x-reports-key/.test(block), 'the block sends a key of its own instead of the proxy’s')
    assert.match(block, /-H @<\(auth\)/)
    /* Rolling over and taking back. */
    assert.ok(at('"replace":true') > 0)
    assert.ok(at('delete from private.report_reader_keys where true;') > 0)
    assert.ok(at('deletes the credential from the\n  environment') > 0 || /deletes the credential from the\s+environment/.test(part))
  })
}
