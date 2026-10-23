/**
 * A report that carries a note, screenshots and the whole log, in the email.
 *
 * Justin, 22 October 2026, holding the email Send logs to developer made: "Is
 * this all the information the logs send? Where's the space to enter a
 * message and upload photos? Let's get it all set up if it's not already."
 *
 * What is held here, end to end: the note (optional, and the one tap still
 * sends with none), the screenshots (three at most, made smaller, and a
 * failed one never costs the report), the head and the runs before inside the
 * log's one budget, the email (its body, its attachments, its reply address),
 * and the one shape of a screenshot's place in the bucket that the app, the
 * bucket's rule, the email and Delete account all agree on.
 *
 * The phone's and the browser's lib/reports.js are RUN, copied beside the real
 * rules and the real debug log with the network stood in for, as test/mobile.mjs
 * runs the one-tap send. The email function is run too, with Deno stood in for,
 * as test/server.mjs runs grant-access and setup-reminder.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const flat = (p) => read(p).replace(/\s+/g, ' ')
/* Comments out, so a check reads the code and not its explanation. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

const USER = '7dfe6912-e43b-49bf-84e4-b56afbd442b1'
const OTHER = '11111111-2222-4333-8444-555555555555'
const KEY = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'

/** The deadlines, cut so the cases that wait them out cost no real time. */
const quick = (rules) =>
  rules
    .replace('export const COMPUTER_WAIT_MS = 5000', 'export const COMPUTER_WAIT_MS = 40')
    .replace('export const SHOT_WAIT_MS = 20_000', 'export const SHOT_WAIT_MS = 60')
    .replace('export const SEND_WAIT_MS = 20_000', 'export const SEND_WAIT_MS = 80')

/**
 * The phone's reports.js and shots.js, run. `b` is what the stand-ins answer:
 * `user` (an account id or null), `upload(path)` (Supabase Storage's answer, a
 * promise of one), `insertError`, `insertHold`, and for the clipboard `has`
 * and `images` (a JPEG quality to the data address it hands back).
 */
async function phone(b, use) {
  const dir = mkdtempSync(join(tmpdir(), 'reports-phone-'))
  const bench = (globalThis.__reportsBench = { uploads: [], inserts: [], reads: [], ...b })
  const esm = (src) => src.replace(/from '\.\/([\w.-]+)'/g, (whole, name) => (/\.m?js$/.test(name) ? whole : `from './${name}.js'`))
  const files = {
    'package.json': '{ "type": "module" }',
    'rn.js': "export const Platform = { OS: 'ios', Version: '27.0.1' }\nexport const Dimensions = { get: () => ({ width: 440, height: 956 }) }\n",
    'relay.js': `
      const b = globalThis.__reportsBench
      export const DEFAULT_PROJECT = { url: 'https://example.invalid', anonKey: 'anon' }
      export const remoteRequest = async () => ({ transportOpen: true, recent: [], reopens: [] })
      export const supabaseClient = () => ({
        auth: { getUser: async () => ({ data: { user: b.user ? { id: b.user } : null } }) },
        storage: {
          from: (bucket) => ({
            upload: async (path, body, options) => {
              b.uploads.push({ bucket, path, body, options })
              return b.upload ? b.upload(path) : { error: null }
            }
          })
        },
        from: (table) => ({
          insert: async (row) => {
            b.inserts.push({ table, row })
            if (b.insertHold) await b.insertHold
            return { error: b.insertError || null }
          }
        })
      })
    `,
    'version.js': "export const APP_VERSION = '1.87.48'\n",
    'link.js': "export const linkState = () => ({ link: 'connected', hostVersion: '1.87.47' })\nexport const linkVia = () => 'computer'\n",
    'clip.js': `
      const b = globalThis.__reportsBench
      export const hasImageAsync = async () => Boolean(b.has)
      export const getImageAsync = async ({ format, jpegQuality }) => {
        b.reads.push({ format, jpegQuality })
        const data = b.images?.[jpegQuality]
        return data ? { data, size: { width: 1320, height: 2868 } } : null
      }
    `,
    'b64.js': "export const toByteArray = (s) => new Uint8Array(Buffer.from(s, 'base64'))\n",
    'debugLog.js': read('mobile/src/lib/debugLog.js'),
    'report-rules.js': quick(read('mobile/src/lib/report-rules.js')),
    'reports.js': esm(read('mobile/src/lib/reports.js')).replace("from 'react-native'", "from './rn.js'"),
    'shots.js': esm(read('mobile/src/lib/shots.js')).replace("from 'expo-clipboard'", "from './clip.js'").replace("from 'base64-js'", "from './b64.js'")
  }
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
    const at = (f) => import(pathToFileURL(join(dir, f)).href)
    const [reports, rules, log, shots] = await Promise.all([at('reports.js'), at('report-rules.js'), at('debugLog.js'), at('shots.js')])
    log.clearDebugLog()
    await use({ reports, rules, log, shots, bench })
  } finally {
    delete globalThis.__reportsBench
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The browser's reports.js, run the same way. */
async function browser(b, use) {
  const dir = mkdtempSync(join(tmpdir(), 'reports-web-'))
  const bench = (globalThis.__webReportsBench = { uploads: [], inserts: [], ...b })
  const files = {
    'package.json': '{ "type": "module" }',
    'remote.js': `
      const b = globalThis.__webReportsBench
      export const DEFAULT_PROJECT = { url: 'https://example.invalid', anonKey: 'anon' }
      export const supabaseClient = () => ({
        auth: { getUser: async () => ({ data: { user: b.user ? { id: b.user } : null } }) },
        storage: { from: (bucket) => ({ upload: async (path, body, options) => { b.uploads.push({ bucket, path, body, options }); return b.upload ? b.upload(path) : { error: null } } }) },
        from: (table) => ({ insert: async (row) => { b.inserts.push({ table, row }); return { error: b.insertError || null } } })
      })
    `,
    'version.js': "export const VERSION = '1.87.48'\n",
    'debugLog.js': read('src/lib/debugLog.js'),
    'report-rules.mjs': quick(read('shared/report-rules.mjs')),
    'reports.js': read('src/lib/reports.js').replace("from '../../shared/report-rules.mjs'", "from './report-rules.mjs'")
  }
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
    const at = (f) => import(pathToFileURL(join(dir, f)).href)
    const [reports, rules, log] = await Promise.all([at('reports.js'), at('report-rules.mjs'), at('debugLog.js')])
    log.clearDebugLog()
    await use({ reports, rules, log, bench })
  } finally {
    delete globalThis.__webReportsBench
    rmSync(dir, { recursive: true, force: true })
  }
}

/** A picture as the storage client is handed it: the phone's shape. */
const shot = (n, size = 1000) => ({ body: new ArrayBuffer(size), uri: `data:image/jpeg;base64,${'A'.repeat(8)}${n}`, width: 1320, height: 2868, size })

/*
 * THE EMAIL FUNCTION, RUN. A fresh copy each time (the query on its address
 * makes Node load it anew, so the secret it keeps starts empty), with Deno
 * stood in for and a fetch that answers as the database, the account service,
 * Storage and Resend would:
 *
 *   users     account id → its email (anything else: 404)
 *   stored    a path in the bucket → its bytes (anything else: 404)
 *   resendKey RESEND_API_KEY, '' for none
 */
const FN = new URL('../supabase/functions/feedback-email/index.ts', import.meta.url).href
const PROJECT = 'https://project.test'
const SERVICE = 'the-service-role-key'
let fnRuns = 0

async function feedbackEmail({ row, users = {}, stored = {}, resendKey = 're_key', given = 'the-hook-secret' } = {}) {
  const calls = []
  const logged = []
  const was = { fetch: globalThis.fetch, Deno: globalThis.Deno, log: console.log, error: console.error }
  const env = { SUPABASE_URL: PROJECT, SUPABASE_SERVICE_ROLE_KEY: SERVICE, RESEND_API_KEY: resendKey }
  const answer = (status, value) => new Response(value === undefined ? '' : JSON.stringify(value), { status })
  let handler = null
  globalThis.Deno = { serve: (h) => (handler = h), env: { get: (name) => env[name] || undefined } }
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null }
    calls.push(call)
    if (call.url === `${PROJECT}/rest/v1/rpc/feedback_hook_secret`) return answer(200, 'the-hook-secret')
    const user = call.url.match(/\/auth\/v1\/admin\/users\/([^/?]+)$/)?.[1]
    if (user) return users[user] ? answer(200, { id: user, email: users[user] }) : answer(404, { msg: 'User not found' })
    const path = call.url.startsWith(`${PROJECT}/storage/v1/object/report-shots/`) ? call.url.slice(`${PROJECT}/storage/v1/object/report-shots/`.length) : null
    if (path !== null) return stored[path] ? new Response(stored[path], { status: 200, headers: { 'Content-Type': 'image/jpeg' } }) : answer(404, { error: 'not_found' })
    if (call.url === 'https://api.resend.com/emails') return answer(200, { id: 'em_1' })
    return answer(500, { msg: `nothing answers ${call.url} here` })
  }
  console.log = (...a) => logged.push(a.join(' '))
  console.error = (...a) => logged.push(a.join(' '))
  try {
    const mod = await import(`${FN}?run=${++fnRuns}`)
    const res = await handler(
      new Request('https://functions.test/feedback-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(given ? { 'x-hook-secret': given } : {}) },
        body: JSON.stringify(row)
      })
    )
    const sent = calls.filter((c) => c.url === 'https://api.resend.com/emails')
    return { status: res.status, said: await res.json().catch(() => null), calls, logged, sent: sent.map((c) => c.body), headers: sent.map((c) => c.headers), mod }
  } finally {
    globalThis.fetch = was.fetch
    globalThis.Deno = was.Deno
    console.log = was.log
    console.error = was.error
  }
}

const unb64 = (s) => Buffer.from(s, 'base64').toString('utf8')

/** A report's log as the app now writes it: the head, the phone's lines, the run before, the computer. */
const LOG = [
  'app: Fractal Remote (phone) v1.87.48',
  'platform: ios 27.0.1',
  'unit: FM3',
  'computer: MacBook Pro SG 566',
  'computer app: 1.87.47',
  'link: connected',
  'computers: MacBook Pro SG 566, raspberry pi 3; driving raspberry pi 3',
  '',
  '16:48:55.132 [link] off → joining',
  '16:48:55.833 [link] the computer is MacBook Pro SG 566, v1.87.47',
  '16:48:57.588 [unit] the computer has a unit — AM4',
  '16:49:00.277 [link] three computers answered: MacBook Pro SG 566 (FM3), raspberry pi 5 (no unit plugged in), raspberry pi 3 (AM4); driving raspberry pi 3, the one picked under Which unit, addressed',
  '16:49:07.302 [link] join failed after 12.2s — Finding your computer timed out.',
  '16:49:15.470 [wire] GET /store/config/host.name gave up — The connection to your computer dropped.',
  '16:49:33.255 [tap] press Send logs to developer',
  '',
  'THE RUN BEFORE THIS ONE — 3 lines, oldest first, last written 4:48:51 PM',
  '(if the app crashed or was killed, this is what it said on the way)',
  '16:40:00.000 [tap] press Next',
  '16:40:01.000 [crash] TypeError: undefined is not an object',
  '16:40:01.100 [app] the app stopped',
  '',
  "COMPUTER'S DEVICE SERVER",
  'port to the unit: open · /dev/tty.usbmodem14604',
  'detected: yes · profile fm3 · telemetry reduced',
  '',
  'server log, last 400 lines:',
  '2026-10-22T22:23:30.356Z log [forgefx] blockParams: eid=62 CABINET'
].join('\n')

export function run(test) {
  test('an empty note still sends the one tap, and a typed note is the message, at both ends', async () => {
    const r = await import('../shared/report-rules.mjs')
    assert.equal(r.logsMessage(''), r.LOGS_ONLY_MESSAGE, 'an empty note left the message empty, which the table refuses')
    assert.equal(r.logsMessage('   \n '), r.LOGS_ONLY_MESSAGE, 'a note of only spaces was taken as a note')
    assert.equal(r.logsMessage(undefined), r.LOGS_ONLY_MESSAGE)
    assert.equal(r.logsMessage('  Every time I open the app now it says Finding your computer.  '), 'Every time I open the app now it says Finding your computer.')
    assert.equal(r.logsMessage('x'.repeat(r.MAX_MESSAGE + 50)).length, r.MAX_MESSAGE, 'a note over the table’s limit would refuse the whole report')
    assert.equal(r.NOTE_PLACEHOLDER, 'What happened? (optional)')

    await phone({ user: USER }, async ({ reports, rules, log, bench }) => {
      log.logDebug('tap', 'press Send logs to developer')
      await reports.sendLogs({ deviceName: 'FM3', note: '' })
      assert.equal(bench.inserts.length, 1, 'the one tap with no note sent nothing')
      assert.equal(bench.inserts[0].row.message, rules.LOGS_ONLY_MESSAGE)
      await reports.sendLogs({ deviceName: 'FM3', note: '  Every time I open the app now…  ' })
      assert.equal(bench.inserts[1].row.message, 'Every time I open the app now…', 'the note is not the message')
      assert.equal(bench.inserts[1].row.kind, 'bug')
      assert.ok(bench.inserts[1].row.log, 'a note sent without the log')
      /* A note that did not go is still on the screen, and the words say so; with none, they make no such promise. */
      bench.insertError = { message: 'TypeError: Network request failed' }
      await assert.rejects(reports.sendLogs({ deviceName: 'FM3', note: 'It froze' }), /What you wrote is still here/)
      await assert.rejects(reports.sendLogs({ deviceName: 'FM3', note: '' }), (err) => !/still here/.test(err.message))
    })

    await browser({}, async ({ reports, rules, bench }) => {
      await reports.sendLogs({ context: { version: '1.87.48' }, computer: 'COMPUTER', note: '' })
      assert.equal(bench.inserts[0].row.message, rules.LOGS_ONLY_MESSAGE)
      await reports.sendLogs({ context: {}, computer: '', note: 'The tuner never opens' })
      assert.equal(bench.inserts[1].row.message, 'The tuner never opens')
    })

    /* The button stays live with the box empty, at both ends: nothing about the note is in what disables it. */
    const phoneLog = flat('mobile/src/screens/Log.js')
    assert.match(phoneLog, /<Press label=\{sending \? 'Sending…' : 'Send logs to developer'\} tone="signal" disabled=\{sending\} onPress=\{send\} \/>/, 'the phone’s button waits for something to be typed')
    assert.match(phoneLog, /placeholder=\{NOTE_PLACEHOLDER\}/)
    const web = flat('src/components/DebugLog.jsx')
    assert.match(web, /<button className="chip send-logs" onClick=\{sendNow\} disabled=\{sending \|\| !all\.length\}>/, 'the browser’s button waits for something to be typed')
    assert.match(web, /placeholder=\{NOTE_PLACEHOLDER\}/)
    for (const words of [r.NOTE_PLACEHOLDER, ...Object.values(r.SHOT_WORDS), r.shotsLostWords(1), r.shotsLostWords(2)]) {
      assert.doesNotMatch(words, /this (phone|iphone|device)/i, `"${words}" says this phone`)
    }
  })

  test('screenshots are three at most, and made smaller before they go', async () => {
    const r = await import('../shared/report-rules.mjs')
    assert.equal(r.SHOTS_MAX, 3)
    const one = { size: 1000 }
    let list = []
    for (let i = 0; i < 5; i++) list = r.withShot(list, { ...one, n: i })
    assert.equal(list.length, 3, 'a fourth screenshot was kept')
    assert.deepEqual(r.withShot([], { size: r.SHOT_BYTES + 1 }), [], 'a picture over the cap was kept')
    assert.deepEqual(r.withShot([], { size: 0 }), [], 'an empty picture was kept')
    assert.deepEqual(r.withShot([], null), [])

    /* Made smaller, never larger: a phone's screenshot and a Mac's, to 1600 on the long side. */
    assert.deepEqual(r.shotSize(1320, 2868), { width: 736, height: 1600 })
    assert.deepEqual(r.shotSize(2880, 1800), { width: 1600, height: 1000 })
    assert.deepEqual(r.shotSize(800, 600), { width: 800, height: 600 }, 'a small picture was blown up')
    assert.deepEqual(r.shotSize(0, 0), { width: 1, height: 1 })
    assert.equal(r.base64Bytes('QUJD'), 3)
    assert.equal(r.base64Bytes('QUI='), 2)
    assert.equal(r.base64Bytes('QQ=='), 1)
    assert.equal(r.base64Bytes(Buffer.alloc(12345).toString('base64')), 12345)

    /* Under the bucket's own limit, so the app never lets through a picture the server turns away. */
    const sql = read('supabase/migrations/20261022_report_screenshots.sql')
    const limit = Number(sql.match(/values \('report-shots', 'report-shots', false, (\d+), array\['image\/jpeg'\]\)/)?.[1])
    assert.ok(limit > r.SHOT_BYTES, `the bucket takes ${limit} bytes and the app sends up to ${r.SHOT_BYTES}`)
    assert.ok(r.SHOTS_MAX * r.SHOT_BYTES * 4 / 3 < 25 * 1024 * 1024, 'three screenshots at the cap do not fit in a Gmail inbox')

    /* The phone: the clipboard read as a JPEG, once, and once more at the lower quality only when that is too big. */
    const small = Buffer.alloc(200_000, 7).toString('base64')
    const big = Buffer.alloc(r.SHOT_BYTES + 10, 7).toString('base64')
    await phone({ has: true, images: { 0.6: `data:image/jpeg;base64,${big}`, 0.3: `data:image/jpeg;base64,${small}` } }, async ({ shots, bench }) => {
      const { shot: got, why } = await shots.pasteShot()
      assert.equal(why, undefined)
      assert.deepEqual(bench.reads, [{ format: 'jpeg', jpegQuality: 0.6 }, { format: 'jpeg', jpegQuality: 0.3 }], 'the clipboard was not read as a JPEG, or read more than it needed to be')
      assert.equal(got.size, 200_000)
      assert.equal(got.body.byteLength, 200_000, 'what goes up is not the picture’s own bytes')
      assert.equal(got.width, 1320)
      assert.match(got.uri, /^data:image\/jpeg;base64,/)
    })
    await phone({ has: true, images: { 0.6: `data:image/jpeg;base64,${small}` } }, async ({ shots, bench }) => {
      await shots.pasteShot()
      assert.equal(bench.reads.length, 1, 'a picture small enough the first time was read twice, which can ask Allow Paste twice')
    })
    await phone({ has: true, images: { 0.6: `data:image/jpeg;base64,${big}`, 0.3: `data:image/jpeg;base64,${big}` } }, async ({ shots, bench }) => {
      assert.deepEqual(await shots.pasteShot(), { why: 'tooBig' })
      assert.equal(bench.reads.length, 2)
    })
    await phone({ has: false }, async ({ shots, bench }) => {
      assert.deepEqual(await shots.pasteShot(), { why: 'empty' })
      assert.equal(bench.reads.length, 0, 'an empty clipboard was read anyway, which on an iPhone asks Allow Paste for nothing')
    })
    /* "Don't Allow" looks the same as nothing there. */
    await phone({ has: true, images: {} }, async ({ shots }) => {
      assert.deepEqual(await shots.pasteShot(), { why: 'empty' })
    })

    /* The browser: drawn again at shotSize, as a JPEG, at the best quality under the cap. */
    const webShots = code(read('src/lib/shots.js'))
    assert.match(webShots, /const \{ width, height \} = shotSize\(source\.width, source\.height\)/)
    assert.match(webShots, /for \(const quality of SHOT_QUALITIES\)/)
    assert.match(webShots, /canvas\.toBlob\(resolve, 'image\/jpeg', quality\)/)
    assert.match(webShots, /if \(blob\.size <= SHOT_BYTES\)/)
    assert.deepEqual(r.SHOT_QUALITIES, [...r.SHOT_QUALITIES].sort((a, b) => b - a), 'the qualities are not best first')

    /* Both ends stop at three, and say how many are in. */
    assert.match(flat('mobile/src/components/Shots.js'), /disabled=\{disabled \|\| pasting \|\| full\}/)
    assert.match(flat('src/components/Shots.jsx'), /disabled=\{disabled \|\| busy \|\| full\}/)
    for (const f of ['mobile/src/components/Shots.js', 'src/components/Shots.jsx']) {
      assert.match(read(f), /withShot\(/, `${f} adds a picture without the cap`)
    }
  })

  test('a screenshot that fails or is late costs the report one line, never the report', async () => {
    const r = await import('../shared/report-rules.mjs')
    await phone({ user: USER, upload: (path) => (path.endsWith('-2.jpg') ? { error: { message: 'Bucket not found' } } : { error: null }) }, async ({ reports, log, bench }) => {
      log.logDebug('tap', 'press Send logs to developer')
      const sent = await reports.sendLogs({ deviceName: 'FM3', note: 'Look at the second one', shots: [shot(1), shot(2)] })
      assert.equal(bench.inserts.length, 1, 'a failed picture stopped the report')
      const { row } = bench.inserts[0]
      /* Under the account's own folder, one key for the report, in the bucket the rule is written for. */
      assert.equal(bench.uploads.length, 2)
      for (const u of bench.uploads) {
        assert.equal(u.bucket, 'report-shots')
        assert.match(u.path, r.SHOT_PATH)
        assert.ok(u.path.startsWith(`${USER}/`), `${u.path} is not in the sender's folder`)
        assert.deepEqual(u.options, { contentType: 'image/jpeg', upsert: false })
      }
      assert.equal(bench.uploads[0].path.split('/')[1].slice(0, 36), bench.uploads[1].path.split('/')[1].slice(0, 36), 'one report’s pictures went under two keys')
      assert.deepEqual(row.context.screenshots, [bench.uploads[0].path], 'the row names a picture that is not there, or misses one that is')
      assert.equal(row.context.screenshotsLost, '1 of 2 could not be added (Bucket not found)')
      assert.equal(sent.shotsLost, 1)
      assert.equal(r.shotsLostWords(sent.shotsLost), "One screenshot couldn't be added, so the report went without it.")
      assert.ok(log.getDebugLog().some((l) => l.message === 'screenshots not added to the report' && /Bucket not found/.test(l.detail)))
      /* The rest of the context is the form's own. */
      assert.equal(row.context.unit, 'FM3')
      assert.equal(row.user_id, USER)
    })

    /* A picture that never answers is left behind at the deadline, and the report goes on time. */
    await phone({ user: null, upload: () => new Promise(() => {}) }, async ({ reports, bench }) => {
      const began = Date.now()
      const sent = await reports.sendLogs({ deviceName: 'AM4', shots: [shot(1)] })
      assert.ok(Date.now() - began < 2000, 'the report waited past the pictures’ deadline')
      assert.equal(bench.inserts.length, 1)
      assert.ok(bench.uploads[0].path.startsWith('anon/'), 'a signed-out sender’s picture is not under anon/')
      assert.equal(bench.inserts[0].row.context.screenshots, undefined)
      assert.equal(bench.inserts[0].row.context.screenshotsLost, '1 of 1 could not be added (no answer within 60 ms)')
      assert.equal(sent.shotsLost, 1)
    })

    /* No pictures: nothing asked of Storage, and nothing about pictures in the row. */
    await phone({ user: USER }, async ({ reports, bench }) => {
      const sent = await reports.sendLogs({ deviceName: 'FM3' })
      assert.equal(bench.uploads.length, 0)
      assert.ok(!('screenshots' in bench.inserts[0].row.context) && !('screenshotsLost' in bench.inserts[0].row.context))
      assert.equal(sent.shotsLost, 0)
    })

    /* And a row that never answers is not waited on for ever either. */
    await phone({ user: USER, insertHold: new Promise(() => {}) }, async ({ reports }) => {
      const began = Date.now()
      await assert.rejects(reports.sendLogs({ deviceName: 'FM3' }), /Couldn't reach the internet to send that/)
      assert.ok(Date.now() - began < 2000, 'a stalled insert held Sending… past its deadline')
    })

    /* The browser, the same: the form's report goes without the picture that failed. */
    await browser({ user: USER, upload: () => ({ error: { message: 'new row violates row-level security policy' } }) }, async ({ reports, bench }) => {
      const sent = await reports.sendReport({ kind: 'idea', message: 'A bigger tuner', context: { version: '1.87.48' }, shots: [{ body: 'blob', size: 5 }] })
      assert.equal(bench.inserts.length, 1)
      assert.equal(bench.inserts[0].row.log, null, 'an idea carried a log')
      assert.equal(bench.inserts[0].row.context.screenshotsLost, '1 of 1 could not be added (new row violates row-level security policy)')
      assert.equal(sent.shotsLost, 1)
    })

    /* The screens say it under the button, and keep the note and pictures until the report has gone. */
    assert.match(flat('mobile/src/screens/Report.js'), /setSent\(\{ lost: shotsLostWords\(done\?\.shotsLost\) \}\)/)
    assert.match(flat('src/components/Feedback.jsx'), /setSent\(\{ lost: shotsLostWords\(done\?\.shotsLost\) \}\)/)
  })

  test('a report carries the log’s head and the runs before, inside the same budget', async () => {
    const r = await import('../shared/report-rules.mjs')
    const bytes = (v) => new TextEncoder().encode(v).length

    /* Labeled as the paste has always labeled them, newest first. */
    const runs = [
      { at: 1, lines: ['b1', 'b2'] },
      { at: 2, lines: ['c1'] },
      { at: 3, lines: [] }
    ]
    const blocks = r.beforeBlocks(runs, (at) => `T${at}`)
    assert.equal(blocks.length, 2, 'an empty run was sent')
    assert.equal(blocks[0], 'THE RUN BEFORE THIS ONE — 2 lines, oldest first, last written T1\n(if the app crashed or was killed, this is what it said on the way)\nb1\nb2')
    assert.match(blocks[1], /^2 RUNS AGO — 1 lines/)

    /* In order: head, this run, the runs before, the computer. */
    const both = r.fitReport({ head: 'app: x\nunit: FM3', mine: 'now 1\nnow 2', before: blocks, computer: "COMPUTER'S DEVICE SERVER\nport: open" })
    assert.equal(both, `app: x\nunit: FM3\n\nnow 1\nnow 2\n\n${blocks[0]}\n\n${blocks[1]}\n\nCOMPUTER'S DEVICE SERVER\nport: open`)

    /* Everything huge: still under the cap; this run's newest line, the run before's heading and its last line, and the computer's newest all kept. */
    const huge = (tag, n, w = 150) => [...Array(n)].map((_, i) => `${tag} ${i} ${'x'.repeat(w)}`).join('\n')
    const fat = r.fitReport({
      head: 'app: Fractal Remote (phone) v1.87.48',
      mine: huge('now', 2000),
      before: r.beforeBlocks([{ at: 0, lines: huge('was', 600).split('\n') }, { at: 0, lines: huge('older', 600).split('\n') }]),
      computer: `COMPUTER'S DEVICE SERVER\n${huge('ring', 2000)}`
    })
    assert.ok(bytes(fat) <= r.LOG_BYTES, `${bytes(fat)} bytes, over the ${r.LOG_BYTES} cap`)
    assert.ok(fat.startsWith('app: Fractal Remote (phone) v1.87.48\n\n'), 'the head was cut or moved')
    assert.match(fat, /now 1999 x+\n\nTHE RUN BEFORE THIS ONE — 600 lines/, 'this run’s newest line was cut, or the run before is not after it')
    assert.match(fat, /\(if the app crashed or was killed, this is what it said on the way\)\n… \d+ earlier lines left out to fit\n/, 'the run before lost its heading, or was cut without saying so')
    assert.match(fat, /was 599 x+\n\nCOMPUTER'S DEVICE SERVER/, 'the run before lost its last line, which is how it ended')
    assert.doesNotMatch(fat, /2 RUNS AGO/, 'an older run took room it did not have')
    assert.match(fat, /ring 1999 x+$/)
    const [, runPart] = fat.split('\n\nTHE RUN BEFORE')
    assert.ok(bytes(runPart.split("\n\nCOMPUTER'S DEVICE SERVER")[0]) <= r.BEFORE_BYTES, 'the runs before took more than their share')

    /* Run, at the phone: the head from the screen, the runs before from the disk, in the row. */
    await phone({ user: USER }, async ({ reports, rules, log, bench }) => {
      log.logDebug('tap', 'press Send logs to developer')
      await reports.sendLogs({
        deviceName: 'FM3',
        head: rules.headLines({ app: 'Fractal Remote (phone) v1.87.48', unit: 'FM3', computers: undefined, link: 'connected' }),
        before: rules.beforeBlocks([{ at: 0, lines: ['16:40:01.000 [crash] TypeError: undefined is not an object'] }])
      })
      const text = bench.inserts[0].row.log
      assert.match(text, /^app: Fractal Remote \(phone\) v1\.87\.48\nunit: FM3\nlink: connected\n\n/, 'the head is not at the top, or an empty field went in it')
      const at = (s) => text.indexOf(s)
      assert.ok(at('[tap] press Send logs') < at('THE RUN BEFORE THIS ONE') && at('THE RUN BEFORE THIS ONE') < at("COMPUTER'S DEVICE SERVER"), 'the parts are out of order')
      assert.match(text, /\[crash\] TypeError: undefined is not an object/, 'the run before did not go')
    })

    /* And a suggestion carries none of it. */
    const idea = r.buildReport({ kind: 'idea', message: 'x', head: 'app: x', before: ['THE RUN BEFORE THIS ONE — 1'], lines: [{ message: 'y' }], format: (l) => l.message })
    assert.equal(idea.log, null)

    /* Both phone screens send the runs before, read from the disk as the log screen shows them. */
    assert.match(flat('mobile/src/screens/Log.js'), /before: runsBefore\(before\)/)
    assert.match(flat('mobile/src/screens/Report.js'), /before: runsBefore\(before\)/)
    assert.match(flat('mobile/src/screens/Report.js'), /pastRuns\(\)\.then\(\(runs\) => alive && setBefore\(runs\)\)/)
    /* And Copy Logs takes its runs from the same place, under the same headings. */
    assert.match(flat('mobile/src/screens/Log.js'), /formatDebugLog\(logHeader\(\{ deviceName, preset \}\), runsBefore\(before\)\.join\('\\n\\n'\)\)/)
    /* The browser keeps nothing from the page's last run, so it has none to send, and says why. */
    assert.match(read('src/lib/logHead.js'), /The browser keeps nothing from the page's last run/)
  })

  test('the email carries the head, what went wrong, the screenshots and the whole log', async () => {
    const shotA = `${USER}/${KEY}-1.jpg`
    const shotB = `${USER}/${KEY}-2.jpg`
    const theirs = `${OTHER}/${KEY}-1.jpg`
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])
    const row = {
      id: '21be6661-e330-415e-b6e6-7bbae82da811',
      kind: 'bug',
      message: 'Every time I open the app now it picks the Pi.',
      contact: null,
      user_id: USER,
      context: { version: '1.87.48', unit: 'FM3', screenshots: [shotA, shotB, theirs], screenshotsLost: '1 of 4 could not be added (timed out)' },
      log: LOG
    }
    const run = await feedbackEmail({ row, users: { [USER]: 'player@example.com' }, stored: { [shotA]: jpeg, [theirs]: jpeg } })
    assert.equal(run.status, 200)
    assert.equal(run.sent.length, 1, 'no email went')
    const [mail] = run.sent
    const html = mail.html

    /* The body: the message, the facts, the head, the computers and why, what went wrong, the run before's end, the computer's top. */
    assert.match(html, /Every time I open the app now it picks the Pi\./)
    assert.match(html, /<b>unit<\/b>: FM3/)
    assert.doesNotMatch(html, /<b>screenshots<\/b>/, 'the pictures’ places were listed as a fact')
    assert.match(html, /<b>screenshotsLost<\/b>: 1 of 4 could not be added/)
    assert.match(html, /From the top of the log[\s\S]*app: Fractal Remote \(phone\) v1\.87\.48[\s\S]*computers: MacBook Pro SG 566, raspberry pi 3; driving raspberry pi 3/)
    assert.match(html, /Which computer, and why[\s\S]*driving raspberry pi 3, the one picked under Which unit, addressed[\s\S]*the computer is MacBook Pro SG 566, v1\.87\.47[\s\S]*\[unit\] the computer has a unit/)
    assert.match(html, /What went wrong[\s\S]*join failed after 12\.2s[\s\S]*gave up — The connection to your computer dropped\./)
    assert.doesNotMatch(html.slice(html.indexOf('What went wrong'), html.indexOf('How the run before')), /TypeError/, 'the run before’s crash was put among this run’s troubles')
    assert.match(html, /How the run before this one ended[\s\S]*THE RUN BEFORE THIS ONE — 3 lines[\s\S]*\[crash\] TypeError: undefined is not an object[\s\S]*the app stopped/)
    assert.match(html, /The computer&#39;s own account|The computer's own account/)
    assert.match(html, /port to the unit: open · \/dev\/tty\.usbmodem14604/)
    assert.doesNotMatch(html, /blockParams/, 'the computer’s whole server log went into the body')
    assert.match(html, /Row 21be6661-e330-415e-b6e6-7bbae82da811/, 'the row id is gone')

    /* The whole log, attached, byte for byte. */
    const logFile = mail.attachments.find((a) => /\.txt$/.test(a.filename))
    assert.ok(logFile, 'the log is not attached')
    assert.equal(logFile.filename, 'report-21be6661.txt')
    assert.equal(unb64(logFile.content), LOG, 'the attached log is not the row’s log')
    assert.match(html, /The whole log is attached: report-21be6661\.txt \(\d+ KB\)/)

    /* The screenshot that is the sender's and was there: attached and shown. The missing one and the stranger's: a line each. */
    const pics = mail.attachments.filter((a) => /\.jpg$/.test(a.filename))
    assert.deepEqual(pics.map((p) => [p.filename, p.content_id]), [['screenshot-1.jpg', 'shot-1']])
    assert.deepEqual([...Buffer.from(pics[0].content, 'base64')], [...jpeg])
    assert.match(html, /<img src="cid:shot-1"/)
    assert.match(html, /Screenshot 2 could not be read from storage \(404\)\./)
    assert.match(html, /Screenshot 3 was not the sender&#39;s own|Screenshot 3 was not the sender's own/)
    const asked = run.calls.filter((c) => c.url.includes('/storage/v1/object/')).map((c) => c.url.split('/report-shots/')[1])
    assert.deepEqual(asked, [shotA, shotB], 'the function read a picture outside the sender’s folder')
    for (const c of run.calls.filter((c) => c.url.includes('/storage/v1/object/'))) assert.equal(c.headers.Authorization, `Bearer ${SERVICE}`)

    /* One email per row, however often it is asked for. */
    assert.equal(run.headers[0]['Idempotency-Key'], 'feedback-email/21be6661-e330-415e-b6e6-7bbae82da811')
    assert.deepEqual(run.said, { sent: true, screenshots: 1, log: true })

    /* An older app's log, with no head and no runs before: the body still finds what went wrong, and says nothing it does not have. */
    const old = await feedbackEmail({ row: { id: 'x', kind: 'bug', message: 'Test', context: {}, log: '10:00:00.000 [wire] GET /device/detect gave up — no\n10:00:01.000 [tap] press X' } })
    assert.doesNotMatch(old.sent[0].html, /From the top of the log|How the run before|own account/)
    assert.match(old.sent[0].html, /What went wrong[\s\S]*GET \/device\/detect gave up/)
    /* An idea: no log, so nothing attached and no log sections. */
    const idea = await feedbackEmail({ row: { id: 'y', kind: 'idea', message: 'A bigger tuner', context: {}, log: null } })
    assert.equal(idea.sent[0].attachments, undefined)
    assert.match(idea.sent[0].subject, /^Idea: A bigger tuner$/)

    /* With no mail key, nothing is asked of anybody, as before. */
    const off = await feedbackEmail({ row, resendKey: '' })
    assert.equal(off.sent.length, 0)
    assert.deepEqual(off.said, { sent: false, why: 'not configured' })
    assert.ok(!off.calls.some((c) => /storage|admin\/users/.test(c.url)), 'with no key it read pictures or an account anyway')
    /* And the database is still the only caller. */
    const stranger = await feedbackEmail({ row, given: 'a guess' })
    assert.equal(stranger.status, 401)
    assert.equal(stranger.sent.length, 0)

    /* Every request it makes has a deadline. */
    const fn = code(read('supabase/functions/feedback-email/index.ts'))
    assert.match(fn, /const within = \(url: string, init: RequestInit = \{\}\) => fetch\(url, \{ \.\.\.init, signal: AbortSignal\.timeout\(WAIT_MS\) \}\)/)
    assert.equal((fn.match(/\bfetch\(/g) || []).length, 1, 'a request is made without the deadline')
    /* And the trigger gives it time to finish. */
    assert.match(read('supabase/migrations/20261022_report_screenshots.sql'), /timeout_milliseconds := 30000/)
  })

  test('the reply address is the one they typed, or the account’s own, said so', async () => {
    const base = { id: 'r1', kind: 'bug', message: 'Hi', context: {}, log: null }

    /* Typed: replied to, and the account never asked. */
    const typed = await feedbackEmail({ row: { ...base, contact: 'me@example.com', user_id: USER }, users: { [USER]: 'account@example.com' } })
    assert.equal(typed.sent[0].reply_to, 'me@example.com')
    assert.match(typed.sent[0].html, /<b>Bug<\/b> from me@example\.com</)
    assert.ok(!typed.calls.some((c) => /admin\/users/.test(c.url)), 'the account was looked up when they had typed an address')

    /* Not typed, signed in: the account's email, labeled. */
    const account = await feedbackEmail({ row: { ...base, contact: null, user_id: USER }, users: { [USER]: 'account@example.com' } })
    assert.equal(account.sent[0].reply_to, 'account@example.com')
    assert.match(account.sent[0].html, /from account@example\.com \(the account&#39;s email\)|from account@example\.com \(the account's email\)/)
    const lookup = account.calls.find((c) => /admin\/users/.test(c.url))
    assert.equal(lookup.url, `${PROJECT}/auth/v1/admin/users/${USER}`)
    assert.equal(lookup.headers.Authorization, `Bearer ${SERVICE}`)

    /* Something typed that is not an address: kept in the words, and the account's email replied to. */
    const name = await feedbackEmail({ row: { ...base, contact: 'Thomas', user_id: USER }, users: { [USER]: 'account@example.com' } })
    assert.equal(name.sent[0].reply_to, 'account@example.com')
    assert.match(name.sent[0].html, /they also wrote "Thomas"/)

    /* An account the service cannot find, or nobody signed in: no reply address, and it says so. */
    for (const row of [{ ...base, user_id: OTHER }, { ...base, user_id: null }, { ...base, user_id: 'not-an-id' }]) {
      const run = await feedbackEmail({ row, users: {} })
      assert.equal(run.sent.length, 1, 'no email went when the account could not be read')
      assert.equal(run.sent[0].reply_to, undefined)
      assert.match(run.sent[0].html, /no reply address given/)
    }
    const nobody = await feedbackEmail({ row: { ...base, user_id: null } })
    assert.ok(!nobody.calls.some((c) => /admin\/users/.test(c.url)), 'an account was looked up for a report with none')
    /* The address is never written to the function's log. */
    assert.ok(!account.logged.some((l) => /account@example\.com/.test(l)))
  })

  test('one place in the bucket, the same in the app, the bucket’s rule, the email and Delete account', async () => {
    const r = await import('../shared/report-rules.mjs')
    const plain = (re) => re.source.replace(/\\\//g, '/')
    const shared = plain(r.SHOT_PATH)
    for (const f of ['supabase/functions/feedback-email/index.ts', 'supabase/functions/delete-account/index.ts']) {
      const m = read(f).match(/const SHOT_PATH =\s*\/(.+)\/\n/)
      assert.ok(m, `${f} has no SHOT_PATH`)
      assert.equal(m[1].replace(/\\\//g, '/'), shared, `${f} takes a different shape of path from the app`)
      assert.match(read(f), /const SHOT_BUCKET = 'report-shots'/)
    }
    const sql = read('supabase/migrations/20261022_report_screenshots.sql')
    assert.ok(sql.includes(`name ~ '${shared}'`), 'the bucket’s rule takes a different shape of path from the app')
    assert.equal(r.SHOT_BUCKET, 'report-shots')
    assert.ok(r.SHOT_PATH.test(r.shotPath(USER, KEY, 3)))
    assert.ok(r.SHOT_PATH.test(r.shotPath(null, KEY, 1)) && r.shotPath(null, KEY, 1).startsWith('anon/'))
    assert.ok(!r.SHOT_PATH.test(r.shotPath(USER, KEY, 4)), 'a fourth picture has a place')
    assert.ok(!r.SHOT_PATH.test(`${USER}/../${KEY}-1.jpg`))
    assert.match(r.reportKey(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

    /* The bucket: private, JPEG only, and one rule, for putting in: the sender's own folder or anon/, never another's. */
    const q = sql.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ')
    assert.match(q, /insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\) values \('report-shots', 'report-shots', false, 2097152, array\['image\/jpeg'\]\)/)
    assert.match(q, /on storage\.objects for insert to anon, authenticated with check \( bucket_id = 'report-shots' and name ~ /)
    assert.match(q, /\(storage\.foldername\(name\)\)\[1\] = 'anon' or \(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/)
    assert.equal((q.match(/create policy/g) || []).length, 1, 'the bucket has a rule for something besides putting a picture in')
    assert.doesNotMatch(q, /for (select|update|delete|all)\b/, 'a picture can be read, listed, replaced or removed through the app’s key')
    /* public.feedback itself is not touched: the pictures ride in context, so no older app's insert changes. */
    assert.doesNotMatch(q, /alter table public\.feedback/)

    /* The trigger's function is the live one with thirty seconds instead of five, and nothing else changed. */
    const body = (s) => s.slice(s.indexOf('create or replace function public.notify_feedback()'), s.indexOf('$$;', s.indexOf('create or replace function public.notify_feedback()')))
    const norm = (s) => body(s).replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim()
    assert.equal(norm(sql), norm(read('supabase/migrations/20260905_feedback_email.sql')).replace('timeout_milliseconds := 5000', 'timeout_milliseconds := 30000'))

    /* Delete account takes the pictures before the rows that name them, through Storage's own API. */
    const del = code(read('supabase/functions/delete-account/index.ts'))
    assert.ok(del.indexOf('await forgetShots(url, service, who)') > 0 && del.indexOf('await forgetShots(url, service, who)') < del.indexOf('await forgetRows(url, service, who)'), 'the rows go first, and with them where the pictures are')
    assert.match(del, /\/storage\/v1\/object\/list\/\$\{SHOT_BUCKET\}/, 'the account’s own folder is not looked through')
    assert.match(del, /\/storage\/v1\/object\/\$\{SHOT_BUCKET\}`, \{ method: 'DELETE', headers, body: JSON\.stringify\(\{ prefixes: \[\.\.\.paths\] \}\) \}/)
    assert.match(del, /feedback\?select=context&\$\{query\}/)

    /* Both senders upload before the row, with upsert off (the one thing the bucket's rule allows), and record the places in context. */
    for (const f of ['src/lib/reports.js', 'mobile/src/lib/reports.js']) {
      const src = code(read(f)).replace(/\s+/g, ' ')
      assert.match(src, /\.upload\(path, shot\.body, \{ contentType: 'image\/jpeg', upsert: false \}\)/, `${f} uploads in a way the bucket's rule does not allow`)
      assert.ok(src.indexOf('await uploadShots(') < src.indexOf(".from('feedback').insert("), `${f} writes the row before the pictures are in`)
      assert.match(src, /owner: userId \|\| 'anon'/)
      assert.match(src, /context: withShots\(row\.context, pictures\)/)
    }
  })
}
