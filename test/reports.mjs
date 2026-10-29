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
        auth: {
          getUser: async () => ({ data: { user: b.user ? { id: b.user } : null } }),
          getSession: async () => ({ data: { session: b.user ? { access_token: \`pass-\${b.user}\` } : null } })
        },
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
    'thisDevice.js': "export const deviceFacts = () => ({ os: 'ios', osVersion: '27.0.1', model: 'iPhone' })\n",
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
    /* The phone's own photo picker and the redraw, as their native halves would answer: `picked` (the picker's result) and `saved(compress)` (a base64 JPEG). */
    'picker.js': `
      const b = globalThis.__reportsBench
      export const VideoExportPreset = { Passthrough: 0, H264_1280x720: 6 }
      export const launchImageLibraryAsync = async (options) => {
        b.pickerAsked = options
        if (b.pickerThrows) throw new Error('no picker')
        return b.picked || { canceled: true, assets: null }
      }
    `,
    'manip.js': `
      const b = globalThis.__reportsBench
      export const SaveFormat = { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' }
      export const ImageManipulator = {
        manipulate: (uri) => {
          const context = {
            resize: (size) => { (b.resized ||= []).push({ uri, size }); return context },
            renderAsync: async () => ({
              saveAsync: async ({ format, compress, base64 }) => {
                ;(b.saves ||= []).push({ uri, format, compress, base64 })
                const out = b.saved ? b.saved(compress, uri) : null
                if (out === 'throw') throw new Error('cannot read it')
                return { uri: 'file:///out.jpg', width: 736, height: 1600, base64: out }
              },
              release: () => {}
            }),
            release: () => {}
          }
          return context
        }
      }
    `,
    'debugLog.js': read('mobile/src/lib/debugLog.js'),
    'report-rules.js': quick(read('mobile/src/lib/report-rules.js')),
    /* supabase-js itself, for the client with no sign-in an anonymous report goes on: what it was made with, and what it was asked. */
    'supa.js': `
      const b = globalThis.__reportsBench
      export const createClient = (url, key, options) => {
        ;(b.bare ||= []).push({ url, key, options })
        return {
          auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
          storage: {
            from: (bucket) => ({
              upload: async (path, body, options) => {
                b.uploads.push({ bucket, path, body, options, bare: true })
                return b.upload ? b.upload(path) : { error: null }
              }
            })
          },
          from: (table) => ({
            insert: async (row) => {
              b.inserts.push({ table, row, bare: true })
              return { error: b.insertError || null }
            }
          })
        }
      }
    `,
    'reports.js': esm(read('mobile/src/lib/reports.js'))
      .replace("from 'react-native'", "from './rn.js'")
      .replace(/import\('@supabase\/supabase-js'\)/g, "import('./supa.js')"),
    'shots.js': esm(read('mobile/src/lib/shots.js'))
      .replace("from 'expo-clipboard'", "from './clip.js'")
      .replace("from 'base64-js'", "from './b64.js'")
      .replace("from 'expo-image-picker'", "from './picker.js'")
      .replace("from 'expo-image-manipulator'", "from './manip.js'")
  }
  /*
   * React Native's XMLHttpRequest and FormData, as the video's upload uses
   * them: each request is kept with its headers and the form it sent, says
   * how much has gone (`b.progress`, a list of fractions), and answers
   * `b.video` (a status, or 'drop' for a dropped connection, or 'late').
   */
  const was = { XMLHttpRequest: globalThis.XMLHttpRequest, FormData: globalThis.FormData }
  class Form {
    constructor() {
      this.parts = []
    }
    append(key, value) {
      this.parts.push([key, value])
    }
  }
  class Xhr {
    constructor() {
      this.headers = {}
      this.upload = {}
      ;(bench.videoSends ||= []).push(this)
    }
    open(method, url) {
      this.method = method
      this.url = url
    }
    setRequestHeader(k, v) {
      this.headers[k] = v
    }
    send(form) {
      this.form = form
      setTimeout(() => {
        for (const part of bench.progress || []) this.upload.onprogress?.({ lengthComputable: true, loaded: part * 100, total: 100 })
        const said = bench.video ?? 200
        if (said === 'drop') return this.onerror?.()
        if (said === 'late') return this.ontimeout?.()
        this.status = said
        this.responseText = said === 200 ? '{"Key":"report-videos/x"}' : '{"statusCode":"413","error":"Payload too large"}'
        this.onload?.()
      }, 0)
    }
  }
  globalThis.XMLHttpRequest = Xhr
  globalThis.FormData = Form
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
    const at = (f) => import(pathToFileURL(join(dir, f)).href)
    const [reports, rules, log, shots] = await Promise.all([at('reports.js'), at('report-rules.js'), at('debugLog.js'), at('shots.js')])
    log.clearDebugLog()
    await use({ reports, rules, log, shots, bench })
  } finally {
    delete globalThis.__reportsBench
    globalThis.XMLHttpRequest = was.XMLHttpRequest
    globalThis.FormData = was.FormData
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
 *   userFail  the account lookup failing instead: a status, or 'timeout'
 *   stored    a path in the bucket → its bytes (anything else: 404)
 *   named     paths another row already names (the attach-once check)
 *   due       what report_shots_due answers (the tidy), or `dueStatus` for a refusal
 *   resend    the statuses Resend answers, one per email in turn (200 after the list)
 *   hold      ms each picture's read takes, to see them read at once
 *   resendKey RESEND_API_KEY, '' for none
 */
const FN = new URL('../supabase/functions/feedback-email/index.ts', import.meta.url).href
const PROJECT = 'https://project.test'
const SERVICE = 'the-service-role-key'
let fnRuns = 0

async function feedbackEmail({
  row,
  users = {},
  userFail = null,
  stored = {},
  named = [],
  due = [],
  dueStatus = 200,
  videoDue = [],
  videoNamed = [],
  signStatus = 200,
  resend = [],
  hold = 0,
  resendKey = 're_key',
  given = 'the-hook-secret'
} = {}) {
  const calls = []
  const logged = []
  const reads = { now: 0, most: 0 }
  const was = { fetch: globalThis.fetch, Deno: globalThis.Deno, log: console.log, error: console.error }
  const env = { SUPABASE_URL: PROJECT, SUPABASE_SERVICE_ROLE_KEY: SERVICE, RESEND_API_KEY: resendKey }
  const answer = (status, value) => new Response(value === undefined ? '' : JSON.stringify(value), { status })
  let handler = null
  let mails = 0
  globalThis.Deno = { serve: (h) => (handler = h), env: { get: (name) => env[name] || undefined } }
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null }
    calls.push(call)
    if (call.url === `${PROJECT}/rest/v1/rpc/feedback_hook_secret`) return answer(200, 'the-hook-secret')
    if (call.url === `${PROJECT}/rest/v1/rpc/report_shots_due`) return answer(dueStatus, dueStatus === 200 ? due : { message: 'Could not find the function public.report_shots_due' })
    if (call.url === `${PROJECT}/rest/v1/rpc/report_videos_due`) return answer(200, videoDue)
    if (call.url.startsWith(`${PROJECT}/rest/v1/feedback?select=id&`) && call.url.includes('context->>video=eq.')) {
      const asked = decodeURIComponent(call.url.match(/context->>video=eq\.([^&]+)/)[1])
      return answer(200, videoNamed.includes(asked) ? [{ id: 'another-row' }] : [])
    }
    if (call.url.startsWith(`${PROJECT}/storage/v1/object/sign/report-videos/`)) {
      const path = call.url.slice(`${PROJECT}/storage/v1/object/sign/report-videos/`.length)
      return signStatus === 200 ? answer(200, { signedURL: `/object/sign/report-videos/${path}?token=signed` }) : answer(signStatus, { error: 'not_found' })
    }
    if (call.url === `${PROJECT}/storage/v1/object/report-videos` && call.method === 'DELETE') return answer(200, [])
    if (call.url.startsWith(`${PROJECT}/rest/v1/feedback?select=id&`)) {
      const asked = JSON.parse(decodeURIComponent(call.url.match(/context->screenshots=cs\.([^&]+)/)[1]))
      return answer(200, asked.some((p) => named.includes(p)) ? [{ id: 'another-row' }] : [])
    }
    const user = call.url.match(/\/auth\/v1\/admin\/users\/([^/?]+)$/)?.[1]
    if (user && userFail === 'timeout') throw new DOMException('The signal has been aborted', 'TimeoutError')
    if (user && userFail) return answer(userFail, { msg: 'upstream' })
    if (user) return users[user] ? answer(200, { id: user, email: users[user] }) : answer(404, { msg: 'User not found' })
    if (call.url === `${PROJECT}/storage/v1/object/report-shots` && call.method === 'DELETE') return answer(200, [])
    const path = call.url.startsWith(`${PROJECT}/storage/v1/object/report-shots/`) ? call.url.slice(`${PROJECT}/storage/v1/object/report-shots/`.length) : null
    if (path !== null) {
      reads.now += 1
      reads.most = Math.max(reads.most, reads.now)
      if (hold) await new Promise((r) => setTimeout(r, hold))
      reads.now -= 1
      return stored[path] ? new Response(stored[path], { status: 200, headers: { 'Content-Type': 'image/jpeg' } }) : answer(404, { error: 'not_found' })
    }
    if (call.url === 'https://api.resend.com/emails') {
      const status = resend[mails++] ?? 200
      return status === 200 ? answer(200, { id: `em_${mails}` }) : answer(status, { name: 'validation_error', message: 'attachment too large' })
    }
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
    return { status: res.status, said: await res.json().catch(() => null), calls, logged, reads, sent: sent.map((c) => c.body), headers: sent.map((c) => c.headers), mod }
  } finally {
    globalThis.fetch = was.fetch
    globalThis.Deno = was.Deno
    console.log = was.log
    console.error = was.error
  }
}

/*
 * DELETE ACCOUNT, RUN, the same way: `reports` is what the feedback table
 * answers for this account (by id and by address alike), `folder` the names
 * in its own folder of the bucket, `resendKey` as above.
 */
const DEL = new URL('../supabase/functions/delete-account/index.ts', import.meta.url).href
let delRuns = 0

async function deleteAccount({ reports = [], folder = [], videoFolder = [], resendKey = 're_key', email = 'player@example.com', authStatus = 200, lookupStatus = {} } = {}) {
  const calls = []
  const logged = []
  const was = { fetch: globalThis.fetch, Deno: globalThis.Deno, log: console.log, error: console.error }
  const env = { SUPABASE_URL: PROJECT, SUPABASE_SERVICE_ROLE_KEY: SERVICE, SUPABASE_ANON_KEY: 'anon', RESEND_API_KEY: resendKey }
  const answer = (status, value) => new Response(value === undefined ? '' : JSON.stringify(value), { status })
  let handler = null
  globalThis.Deno = { serve: (h) => (handler = h), env: { get: (name) => env[name] || undefined } }
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null }
    calls.push(call)
    if (call.url === `${PROJECT}/auth/v1/user`) return answer(200, { id: USER, email })
    if (call.url.startsWith(`${PROJECT}/rest/v1/feedback?select=id,user_id,context&`)) {
      const byId = call.url.includes(`user_id=eq.${USER}`)
      const status = lookupStatus[byId ? 'byId' : 'byAddress'] || 200
      if (status !== 200) return answer(status, { message: 'upstream timeout' })
      return answer(200, reports.filter((r) => (byId ? r.user_id === USER : r.user_id !== USER)))
    }
    if (call.url === `${PROJECT}/storage/v1/object/list/report-shots`) return answer(200, folder.map((name) => ({ name })))
    if (call.url === `${PROJECT}/storage/v1/object/list/report-videos`) return answer(200, videoFolder.map((name) => ({ name })))
    if (call.url === `${PROJECT}/auth/v1/admin/users/${USER}` && call.method === 'DELETE') return answer(authStatus, authStatus === 200 ? {} : { msg: 'Database error deleting user' })
    return answer(200, {})
  }
  console.log = (...a) => logged.push(a.join(' '))
  console.error = (...a) => logged.push(a.join(' '))
  try {
    const mod = await import(`${DEL}?run=${++delRuns}`)
    const res = await handler(
      new Request('https://functions.test/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a-token' },
        body: JSON.stringify({ confirm: 'delete' })
      })
    )
    const removed = calls.find((c) => c.url === `${PROJECT}/storage/v1/object/report-shots` && c.method === 'DELETE')
    const videosRemoved = calls.find((c) => c.url === `${PROJECT}/storage/v1/object/report-videos` && c.method === 'DELETE')
    const notes = calls.filter((c) => c.url === 'https://api.resend.com/emails')
    return { status: res.status, said: await res.json().catch(() => null), calls, logged, removed: removed?.body?.prefixes || [], videosRemoved: videosRemoved?.body?.prefixes || [], notes, mod }
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
  /*
   * WHAT LAST WENT WRONG GOES WITH THE LOG AND NEVER WITHOUT IT (review of
   * 25 October 2026). Every fault the screen shows is a line in the log now
   * (lib/rig.js set()), so a report's details found it every time, and they
   * go with a suggestion too, and with a bug report whose log was turned
   * off: both of which the privacy page and the form's small print say
   * carry no log. The phone's sendReport, run.
   */
  test('the phone sends the last fault on screen only with the log: never with a suggestion, or a bug report with the log turned off', async () => {
    await phone({ user: USER }, async ({ reports, log, bench }) => {
      /* A fault, as lib/rig.js set() writes every one. */
      log.logDebug('error', 'The unit refused that preset.')
      const details = () => reports.context({ deviceName: 'FM3' })
      assert.equal(details().lastError, 'The unit refused that preset.', 'the details do not find the fault (lib/reports context)')

      await reports.sendReport({ kind: 'idea', message: 'A bigger tuner', context: details() })
      await reports.sendReport({ kind: 'bug', message: 'It froze', context: details(), withLog: false })
      await reports.sendReport({ kind: 'bug', message: 'It froze', context: details() })
      await reports.sendLogs({ deviceName: 'FM3' })
      const [idea, bare, bug, logs] = bench.inserts.map((i) => i.row)

      assert.equal(idea.log, null)
      assert.ok(!('lastError' in idea.context), 'a suggestion carries the last fault on screen')
      assert.equal(bare.log, null)
      assert.ok(!('lastError' in bare.context), 'a bug report with the log turned off carries the last fault on screen')
      assert.ok(bug.log)
      assert.equal(bug.context.lastError, 'The unit refused that preset.', 'a bug report with its log lost the last fault')
      assert.ok(logs.log)
      assert.equal(logs.context.lastError, 'The unit refused that preset.', 'Send logs to developer lost the last fault')
      /* Everything else in the details goes as it did. */
      for (const row of [idea, bare]) {
        assert.deepEqual(Object.keys(row.context).sort(), Object.keys(bug.context).filter((k) => k !== 'lastError').sort())
        assert.equal(row.context.unit, 'FM3')
        assert.equal(row.context.version, '1.87.48')
      }
      /* And what the caller handed in is not changed by it. */
      const handed = details()
      await reports.sendReport({ kind: 'idea', message: 'A bigger tuner', context: handed })
      assert.equal(handed.lastError, 'The unit refused that preset.')
    })
  })

  /*
   * AND THE BROWSER THE SAME (review of 25 October 2026). The privacy page is
   * the phone's and the website's, and App.jsx writes every fault on screen
   * into the log (`logDebug('error', error)`), so the website's details found
   * it too and sent it with a suggestion and with a bug report whose log was
   * turned off. The browser's sendReport, run.
   */
  test('the browser sends the last fault on screen only with the log: never with a suggestion, or a bug report with the log turned off', async () => {
    await browser({ user: USER }, async ({ reports, log, bench }) => {
      log.logDebug('error', 'The unit refused that preset.')
      const details = () => reports.context({ device: { model: 'FM3' } })
      assert.equal(details().lastError, 'The unit refused that preset.', 'the details do not find the fault (src/lib/reports context)')

      await reports.sendReport({ kind: 'idea', message: 'A bigger tuner', context: details() })
      await reports.sendReport({ kind: 'bug', message: 'It froze', context: details(), withLog: false })
      await reports.sendReport({ kind: 'bug', message: 'It froze', context: details() })
      await reports.sendLogs({ context: details(), note: '' })
      const [idea, bare, bug, logs] = bench.inserts.map((i) => i.row)

      assert.equal(idea.log, null)
      assert.ok(!('lastError' in idea.context), 'a suggestion carries the last fault on screen')
      assert.equal(bare.log, null)
      assert.ok(!('lastError' in bare.context), 'a bug report with the log turned off carries the last fault on screen')
      assert.ok(bug.log)
      assert.equal(bug.context.lastError, 'The unit refused that preset.', 'a bug report with its log lost the last fault')
      assert.ok(logs.log)
      assert.equal(logs.context.lastError, 'The unit refused that preset.', 'Send logs to developer lost the last fault')
      for (const row of [idea, bare]) {
        assert.deepEqual(Object.keys(row.context).sort(), Object.keys(bug.context).filter((k) => k !== 'lastError').sort())
        assert.equal(row.context.unit, 'FM3')
        assert.equal(row.context.version, '1.87.48')
      }
      const handed = details()
      await reports.sendReport({ kind: 'idea', message: 'A bigger tuner', context: handed })
      assert.equal(handed.lastError, 'The unit refused that preset.')
    })
  })

  /*
   * THE REPORT SCREEN IS TYPED INTO AND HAS NO COPY LOGS, so a report from
   * it that did not go says what was written is still there, and never "use
   * Copy Logs instead" (copyLogs: false, the default); the log screen's own
   * send says what it said before. Every Report a Bluetooth problem opens
   * this screen now (29 October 2026), where it was a screen of one-tap
   * answers with nothing to type.
   */
  test('a report from the report screen that did not go keeps what was written, and never says to use Copy Logs', async () => {
    const r = await import('../shared/report-rules.mjs')
    const written = { kind: 'bug', message: r.formMessage({ typed: 'It drops after a minute', bluetooth: true, said: 'No adapter was connected.' }), context: {} }
    const refusals = [
      { message: 'TypeError: Network request failed' },
      { message: 'new row violates row-level security policy for table "feedback"' },
      { message: 'duplicate key' }
    ]
    for (const insertError of refusals) {
      await phone({ user: USER, insertError }, async ({ reports, bench }) => {
        await assert.rejects(reports.sendReport(written), (err) => {
          assert.match(err.message, /What you wrote is still here/, `${insertError.message}: ${err.message}`)
          assert.doesNotMatch(err.message, /Copy Logs/, `${insertError.message}: ${err.message}`)
          assert.equal(err.reason, insertError.message, 'the database’s reason is lost')
          return true
        })
        /* It was the report screen that tried, with what was written first and the Bluetooth line under it. */
        assert.equal(bench.inserts[0].row.message, 'It drops after a minute\n\nOpened from Bluetooth. The app said: No adapter was connected.')
        /* The log screen's one tap with nothing written still offers Copy Logs on a refusal, and a typed note is still kept. */
        await assert.rejects(reports.sendLogs({ deviceName: 'AM4', note: '' }), (err) => !/What you wrote/.test(err.message))
        await assert.rejects(reports.sendLogs({ deviceName: 'AM4', note: 'It froze' }), /What you wrote is still here/)
      })
    }
    await phone({ user: USER, insertError: { message: 'new row violates row-level security policy' } }, async ({ reports }) => {
      await assert.rejects(reports.sendLogs({ deviceName: 'AM4', note: '' }), /^Error: That didn't send\. Try again in a moment, or use Copy Logs instead\.$/)
    })
    /* And the app's own deadline: wait, rather than send a second one. */
    await phone({ user: USER, insertHold: new Promise(() => {}) }, async ({ reports }) => {
      await assert.rejects(reports.sendReport(written), (err) => {
        assert.equal(err.message, "The internet didn't answer in time. It may still arrive, so wait a minute before sending it again. What you wrote is still here.")
        return true
      })
    })
  })

  /*
   * "IT WOULD BE NICE TO KNOW WHAT USER IT'S COMING FROM UNLESS THEY WANT IT
   * ANONYMOUS" (Justin, 29 October 2026). Include my email ticked: the
   * account and its address. Unticked: nothing about the account at all, not
   * on the row, not in the request (a client with no sign-in, the gear
   * notes' way), and the files under anon/.
   */
  test('a report sent with Include my email unticked carries no account, no address and no sign-in, and its files go under anon/', async () => {
    await phone({ user: USER }, async ({ reports, bench }) => {
      await reports.sendReport({ kind: 'bug', message: 'It froze', contact: 'player@example.com', context: {}, anonymous: true, shots: [shot(1)] })
      assert.equal(bench.inserts.length, 1)
      const { row, bare } = bench.inserts[0]
      assert.equal(row.user_id, null, 'an anonymous report names its account')
      assert.equal(row.contact, null, 'an anonymous report carries an address')
      assert.equal(bare, true, 'an anonymous report went on the signed-in client')
      assert.ok(bench.uploads[0].bare && bench.uploads[0].path.startsWith('anon/'), 'an anonymous report’s picture went under the account, or with its sign-in')
      /* The client with no sign-in keeps none and renews none. */
      assert.deepEqual(bench.bare[0].options, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    })
    /* Ticked: the account, its address, and the files in its own folder, on its own client. */
    await phone({ user: USER }, async ({ reports, bench }) => {
      await reports.sendReport({ kind: 'bug', message: 'It froze', contact: 'player@example.com', context: {}, shots: [shot(1)] })
      const { row, bare } = bench.inserts[0]
      assert.equal(row.user_id, USER)
      assert.equal(row.contact, 'player@example.com')
      assert.ok(!bare)
      assert.ok(bench.uploads[0].path.startsWith(`${USER}/`))
      assert.equal(bench.bare, undefined, 'a report from the account made a client with no sign-in')
    })
    /* The screen asks for it only with an account on the phone and the box unticked, and sends the address only ticked. */
    const form = flat('mobile/src/screens/Report.js')
    assert.match(form, /const anonymous = !!account && !includeMe/)
    assert.match(form, /contact: account \? \(includeMe \? email : ''\) : contact,/)
    assert.match(form, /keptAccount\(\)\.then\(\(a\) => alive && setAccount\(a \|\| null\)\)/, 'the address is not read off the phone')
  })

  /*
   * A VIDEO IN A REPORT (29 October 2026): one, from the phone's own picker,
   * sent from its file before anything else, saying how much has gone, under
   * the sender's folder; a video that does not go costs the report a line,
   * never the report.
   */
  test('a report’s video goes first, from its file, under the sender’s folder, says how much has gone, and never costs the report', async () => {
    const r = await import('../shared/report-rules.mjs')
    const video = { uri: 'file:///cache/ImagePicker/abc.mp4', ext: 'mp4', type: 'video/mp4', size: 12_000_000, duration: 34_000 }
    await phone({ user: USER, progress: [0.25, 0.5, 1] }, async ({ reports, bench }) => {
      const heard = []
      const sent = await reports.sendReport({ kind: 'bug', message: 'Watch this', context: {}, video, onVideoProgress: (p) => heard.push(p) })
      assert.equal(bench.videoSends.length, 1)
      const xhr = bench.videoSends[0]
      assert.equal(xhr.method, 'POST')
      const path = xhr.url.slice('https://example.invalid/storage/v1/object/report-videos/'.length)
      assert.ok(xhr.url.startsWith('https://example.invalid/storage/v1/object/report-videos/'))
      assert.ok(r.VIDEO_PATH.test(path) && path.startsWith(`${USER}/`), `${path} is not a video’s place in the sender’s folder`)
      /* Signed in with the account's own pass, never upserting, the file part named by its place on the phone. */
      assert.equal(xhr.headers.Authorization, `Bearer pass-${USER}`)
      assert.equal(xhr.headers['x-upsert'], 'false')
      assert.deepEqual(xhr.form.parts, [['cacheControl', '3600'], ['file', { uri: video.uri, name: 'video.mp4', type: 'video/mp4' }]])
      assert.deepEqual(heard, [0.25, 0.5, 1], 'the screen was not told how much had gone')
      /* The row names it, and the report says nothing was lost. */
      assert.equal(bench.inserts[0].row.context.video, path)
      assert.equal(sent.videoLost, false)
      /* The same key as the pictures would have had: one report, one key. */
      assert.equal(path.split('/')[1].replace(/-video\.mp4$/, '').length, 36)
    })
    /* Anonymous: under anon/, on the app's public key. */
    await phone({ user: USER }, async ({ reports, bench }) => {
      await reports.sendReport({ kind: 'bug', message: 'Watch this', context: {}, video, anonymous: true })
      const xhr = bench.videoSends[0]
      assert.ok(xhr.url.includes('/report-videos/anon/'))
      assert.equal(xhr.headers.Authorization, 'Bearer anon')
      assert.equal(bench.inserts[0].row.user_id, null)
    })
    /* Refused, dropped or late: the report goes without it, saying so, and the log says why. */
    for (const [said, why] of [
      [413, /storage answered 413/],
      ['drop', /network: the video could not be sent/],
      ['late', /no answer within 300 seconds/]
    ]) {
      await phone({ user: USER, video: said }, async ({ reports, bench, log }) => {
        const sent = await reports.sendReport({ kind: 'bug', message: 'Watch this', context: {}, video })
        assert.equal(bench.inserts.length, 1, `${said}: the report did not go without its video`)
        assert.equal(bench.inserts[0].row.context.video, undefined)
        assert.match(bench.inserts[0].row.context.videoLost, why)
        assert.equal(sent.videoLost, true)
        assert.ok(log.getDebugLog().some((l) => /video not added to the report/.test(l.message)), `${said}: the log does not say the video was left out`)
      })
    }
    /* No video: nothing is sent for one, and nothing about one is in the row. */
    await phone({ user: USER }, async ({ reports, bench }) => {
      const sent = await reports.sendReport({ kind: 'bug', message: 'No video', context: {} })
      assert.equal(bench.videoSends, undefined)
      assert.ok(!('video' in bench.inserts[0].row.context) && !('videoLost' in bench.inserts[0].row.context))
      assert.equal(sent.videoLost, false)
    })
    /* And the screen says it under Sent, with the pictures' line. */
    assert.match(flat('mobile/src/screens/Report.js'), /setSent\(\{ lost: \[shotsLostWords\(done\?\.shotsLost\), videoLostWords\(done\?\.videoLost\)\]\.filter\(Boolean\)\.join\(' '\) \}\)/)
    assert.equal(r.videoLostWords(true), "The video couldn't be added, so the report went without it.")
    assert.equal(r.videoLostWords(false), '')
  })

  test('a picked video is checked before it goes: its kind, its size, one a report, in the picker’s words', async () => {
    const r = await import('../shared/report-rules.mjs')
    assert.equal(r.videoKind('video/mp4'), 'mp4')
    assert.equal(r.videoKind('video/quicktime'), 'mov')
    assert.equal(r.videoKind('', 'file:///x/IMG_0001.MOV'), 'mov')
    assert.equal(r.videoKind(undefined, 'file:///x/a.m4v'), 'mp4')
    assert.equal(r.videoKind('video/x-matroska', 'file:///x/a.mkv'), null, 'a kind the bucket turns away is offered')
    assert.equal(r.mbWords(12_000_000), '11 MB')
    assert.equal(r.mbWords(400_000), '0.4 MB')
    assert.equal(r.videoLength(34_000), '0:34')
    assert.equal(r.videoLength(125_400), '2:05')
    assert.equal(r.videoLength(0), '')
    assert.equal(r.VIDEO_BYTES, 50 * 1024 * 1024, 'the app’s cap is not the project’s own 50 MB')
    for (const words of [r.VIDEO_WORDS.one, r.VIDEO_WORDS.tooBig(80_000_000), r.VIDEO_WORDS.unreadable]) {
      assert.doesNotMatch(words, /\b(mp4|mov|webm|3gp|quicktime)\b|this phone/i, words)
    }
    assert.match(r.VIDEO_WORDS.tooBig(80_000_000), /^That video is too big to send \(76 MB; a report can carry 50 MB\)\./)

    /* The picker, as its native half answers: pictures made smaller, the first video kept as a file, a second turned away. */
    const big = { type: 'video', uri: 'file:///big.mp4', mimeType: 'video/mp4', fileSize: 90_000_000, duration: 200_000 }
    const ok = { type: 'video', uri: 'file:///ok.mp4', mimeType: 'video/mp4', fileSize: 9_000_000, duration: 30_000 }
    const pic = { type: 'image', uri: 'file:///a.png', width: 1320, height: 2868 }
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64')
    await phone({ picked: { canceled: false, assets: [pic, ok, { ...ok, uri: 'file:///two.mp4' }] }, saved: () => jpeg }, async ({ shots, bench }) => {
      const got = await shots.pickMedia(3, true)
      assert.equal(got.shots.length, 1)
      assert.deepEqual(got.video, { uri: 'file:///ok.mp4', ext: 'mp4', type: 'video/mp4', size: 9_000_000, duration: 30_000 })
      assert.equal(got.videoWhy, r.VIDEO_WORDS.one, 'a second video is taken, or turned away without a word')
      /* Both kinds in the one picker, and an iPhone makes the video 720p as it hands it over. */
      assert.deepEqual(bench.pickerAsked.mediaTypes, ['images', 'videos'])
      assert.equal(bench.pickerAsked.allowsMultipleSelection, true)
      assert.equal(bench.pickerAsked.selectionLimit, 4)
      assert.equal(bench.pickerAsked.videoExportPreset, 6, 'an iPhone hands the video over at its full size')
    })
    await phone({ picked: { canceled: false, assets: [big] } }, async ({ shots }) => {
      const got = await shots.pickMedia(0, true)
      assert.equal(got.video, null)
      assert.equal(got.videoWhy, r.VIDEO_WORDS.tooBig(90_000_000))
    })
    /* With a video already added, the picker offers pictures only; with no room for pictures either, nothing. */
    await phone({ picked: { canceled: true, assets: null } }, async ({ shots, bench }) => {
      await shots.pickMedia(2, false)
      assert.deepEqual(bench.pickerAsked.mediaTypes, ['images'])
      assert.deepEqual(await shots.pickMedia(0, false), { shots: [], video: null, why: 'full' })
    })
  })

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
    /* A picture there and none handed over is "Don't Allow Paste" (or Paste from Other Apps set to Deny), not an empty clipboard. */
    await phone({ has: true, images: {} }, async ({ shots }) => {
      assert.deepEqual(await shots.pasteShot(), { why: 'refused' }, 'a refused paste is told it has nothing to paste, right after copying one')
    })

    /* The browser: drawn again at shotSize, as a JPEG, at the best quality under the cap. */
    const webShots = code(read('src/lib/shots.js'))
    assert.match(webShots, /const \{ width, height \} = shotSize\(source\.width, source\.height\)/)
    assert.match(webShots, /for \(const quality of SHOT_QUALITIES\)/)
    assert.match(webShots, /canvas\.toBlob\(resolve, 'image\/jpeg', quality\)/)
    assert.match(webShots, /if \(blob\.size <= SHOT_BYTES\)/)
    assert.deepEqual(r.SHOT_QUALITIES, [...r.SHOT_QUALITIES].sort((a, b) => b - a), 'the qualities are not best first')

    /* The phone's own picker: as many as there is room for, each drawn again at 1600 and saved as a JPEG under the cap. */
    const small64 = Buffer.alloc(300_000, 3).toString('base64')
    await phone(
      {
        picked: { canceled: false, assets: [{ uri: 'file:///a.png', width: 1320, height: 2868 }, { uri: 'file:///b.png', width: 0, height: 0 }] },
        saved: (compress) => (compress === r.SHOT_QUALITIES[0] ? Buffer.alloc(r.SHOT_BYTES + 1).toString('base64') : small64)
      },
      async ({ shots, bench }) => {
        const { shots: got, why } = await shots.pickShots(2)
        assert.equal(why, undefined)
        assert.equal(got.length, 2)
        assert.deepEqual(bench.pickerAsked, { mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 2, quality: 1, exif: false })
        assert.deepEqual(bench.resized, [{ uri: 'file:///a.png', size: { height: 1600 } }], 'a tall screenshot was not drawn at 1600, or one of no known size was')
        assert.deepEqual(bench.saves.filter((x) => x.uri === 'file:///a.png').map((x) => x.compress), [r.SHOT_QUALITIES[0], r.SHOT_QUALITIES[1]], 'the qualities were not tried best first, or past the one that fit')
        assert.ok(bench.saves.every((x) => x.format === 'jpeg' && x.base64 === true))
        assert.equal(got[0].size, 300_000)
        assert.equal(got[0].body.byteLength, 300_000)
        assert.match(got[0].uri, /^data:image\/jpeg;base64,/)
      }
    )
    await phone({ picked: { canceled: true, assets: null } }, async ({ shots }) => {
      assert.deepEqual(await shots.pickShots(3), { shots: [] }, 'closing the picker said something')
    })
    await phone({ picked: { canceled: false, assets: [{ uri: 'file:///x.heic', width: 4000, height: 3000 }] }, saved: () => 'throw' }, async ({ shots }) => {
      assert.deepEqual(await shots.pickShots(1), { shots: [], why: 'unreadable' })
    })
    await phone({ pickerThrows: true }, async ({ shots }) => {
      assert.deepEqual(await shots.pickShots(1), { shots: [], why: 'unreadable' })
    })
    await phone({}, async ({ shots, bench }) => {
      assert.deepEqual(await shots.pickShots(0), { shots: [], why: 'full' })
      assert.equal(bench.pickerAsked, undefined, 'the picker opened with no room left')
    })
    /*
     * No camera and no microphone come with it, and the photo library's words never say this phone.
     *
     * THE CAMERA'S SENTENCE STAYS IN, ON THE IPHONE, saying the camera is not
     * used. cameraPermission false deletes NSCameraUsageDescription, but the
     * picker's iPhone code still calls AVCaptureDevice.requestAccess and
     * authorizationStatus (ImagePickerPermissionRequesters.swift), and
     * Apple's upload check refuses a binary that references an API with no
     * purpose string for it (ITMS-90683: "If you're using external libraries
     * or SDKs, they may reference APIs that require a purpose string").
     * The app never opens the camera, so the sentence is never shown. On
     * Android the camera stays blocked (test/bluetooth.mjs). The microphone is
     * only looked up by name in Info.plist, never asked for, so it stays off.
     */
    const app = JSON.parse(read('mobile/app.json')).expo
    const plugin = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker')?.[1]
    assert.ok(plugin, 'the picker’s plugin is not in app.json')
    assert.equal(typeof plugin.cameraPermission, 'string', 'the camera’s purpose string is deleted, and the picker’s code still asks for the camera')
    assert.match(plugin.cameraPermission, /never uses the camera/)
    assert.ok(app.android.blockedPermissions.includes('android.permission.CAMERA'), 'Android asks for the camera')
    assert.equal(plugin.microphonePermission, false)
    for (const words of [plugin.photosPermission, plugin.cameraPermission]) assert.doesNotMatch(words, /this (phone|iphone|device)/i)

    /*
     * AND THE PICKER DOES NOT CRASH ON IOS 27.1. expo-image-picker 57.0.20
     * asks canLoadObject(ofClass: PHLivePhoto.self) of every picture picked,
     * which raises NSInvalidArgumentException on iOS 27.1 and closes the app
     * (fixed upstream in 58.0.5, expo/expo#50435, for SDK 58 only). The same
     * fix is carried here by patch-package, applied by every install.
     */
    const pkg = JSON.parse(read('mobile/package.json'))
    assert.equal(pkg.scripts?.postinstall, 'patch-package', 'nothing applies mobile/patches after an install')
    assert.ok(pkg.devDependencies?.['patch-package'], 'patch-package is not installed')
    /* By the version the lock file installs, since CI has no reason to install mobile/node_modules for this suite. */
    const version = JSON.parse(read('mobile/package-lock.json')).packages['node_modules/expo-image-picker']?.version
    assert.ok(version, 'the lock file has no expo-image-picker')
    assert.ok(Number(version.split('.')[0]) < 58, 'expo-image-picker 58 carries the fix itself: drop the patch and this check')
    const patch = read(`mobile/patches/expo-image-picker+${version}.patch`)
    assert.match(patch, /^-\s+if itemProvider\.canLoadObject\(ofClass: PHLivePhoto\.self\)/m, 'the patch no longer takes out the live photo check')
    assert.match(patch, /^\+\s+&& itemProvider\.hasItemConformingToTypeIdentifier\(UTType\.livePhoto\.identifier\)/m)
    assert.equal(JSON.parse(read('mobile/package-lock.json')).packages['node_modules/patch-package']?.version, pkg.devDependencies['patch-package'])

    /* Both ends stop at three, and say how many are in. */
    assert.match(flat('mobile/src/components/Shots.js'), /disabled=\{disabled \|\| pasting \|\| picking \|\| full\}/)
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
      /* The app's own deadline, not a dropped connection: the row may still land, so it says to wait rather than send again at once. */
      await assert.rejects(reports.sendLogs({ deviceName: 'FM3' }), /The internet didn't answer in time\. It may still arrive, so wait a minute before sending it again\.$/)
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

    /* The screens say it under the button, and keep the note and pictures until the report has gone (the phone's with the video's line beside it). */
    assert.match(flat('mobile/src/screens/Report.js'), /setSent\(\{ lost: \[shotsLostWords\(done\?\.shotsLost\), videoLostWords\(done\?\.videoLost\)\]\.filter\(Boolean\)\.join\(' '\) \}\)/)
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

  /*
   * THE VIDEO'S PLACE, the same in the app, the bucket's rule, the email and
   * Delete account, as a picture's is; and its bucket: private, a phone's four
   * kinds of video, 50 MB, a rule for putting in and none for anything else,
   * room counted per folder, and nothing kept past its week.
   */
  test('a video has one place in its bucket, the same in the app, the bucket’s rule, the email and Delete account, and the bucket keeps only so much for a week', async () => {
    const r = await import('../shared/report-rules.mjs')
    const plain = (re) => re.source.replace(/\\\//g, '/')
    const shared = plain(r.VIDEO_PATH)
    for (const f of ['supabase/functions/feedback-email/index.ts', 'supabase/functions/delete-account/index.ts']) {
      const m = read(f).match(/const VIDEO_PATH =\s*\/(.+)\/\n/)
      assert.ok(m, `${f} has no VIDEO_PATH`)
      assert.equal(m[1].replace(/\\\//g, '/'), shared, `${f} takes a different shape of video path from the app`)
      assert.match(read(f), /const VIDEO_BUCKET = 'report-videos'/)
    }
    const sql = read('supabase/migrations/20261029_report_videos.sql')
    assert.ok(sql.includes(`name ~ '${shared}'`), 'the bucket’s rule takes a different shape of path from the app')
    assert.equal(r.VIDEO_BUCKET, 'report-videos')
    assert.ok(r.VIDEO_PATH.test(r.videoPath(USER, KEY, 'mov')))
    assert.ok(r.videoPath(null, KEY, 'mp4').startsWith('anon/') && r.VIDEO_PATH.test(r.videoPath(null, KEY, 'mp4')))
    assert.equal(r.videoPath(USER, KEY, 'exe'), `${USER}/${KEY}-video.mp4`, 'a kind the bucket does not take was given a place')
    assert.ok(!r.VIDEO_PATH.test(`${USER}/${KEY}-1.jpg`) && !r.SHOT_PATH.test(r.videoPath(USER, KEY, 'mp4')), 'a picture’s place and a video’s can be taken for each other')
    assert.ok(!r.VIDEO_PATH.test(`${USER}/../${KEY}-video.mp4`))
    assert.deepEqual(r.withVideo({ unit: 'FM3' }, { path: r.videoPath(USER, KEY, 'mp4') }), { unit: 'FM3', video: `${USER}/${KEY}-video.mp4` })
    assert.deepEqual(r.withVideo({}, { path: 'gear/amp.png' }), {}, 'a place that is not a video’s went into the row')
    assert.deepEqual(r.withVideo({}, { why: 'storage answered 413' }), { videoLost: 'the video could not be added (storage answered 413)' })
    assert.deepEqual(r.withVideo({}, {}), {})

    const q = sql.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ')
    assert.match(q, /insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\) values \('report-videos', 'report-videos', false, 52428800, array\['video\/mp4', 'video\/quicktime', 'video\/webm', 'video\/3gpp'\]\)/)
    assert.equal(52428800, r.VIDEO_BYTES, 'the bucket and the app disagree on how big a video may be')
    assert.deepEqual(Object.values(r.VIDEO_TYPES).sort(), ['video/3gpp', 'video/mp4', 'video/quicktime', 'video/webm'], 'the app offers a kind of video the bucket turns away')
    assert.match(q, /on storage\.objects for insert to anon, authenticated with check \( bucket_id = 'report-videos' and name ~ /)
    assert.match(q, /\(storage\.foldername\(name\)\)\[1\] = 'anon' or \(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text \) and public\.report_videos_room\(\(storage\.foldername\(name\)\)\[1\]\) \);/)
    assert.equal((q.match(/create policy/g) || []).length, 1, 'the bucket has a rule for something besides putting a video in')
    assert.doesNotMatch(q, /for (select|update|delete|all)\b/, 'a video can be read, listed, replaced or removed through the app’s key')
    assert.doesNotMatch(q, /alter table public\.feedback/)
    assert.match(q, /split_part\(o\.name, '\/', 1\) = folder and o\.created_at > now\(\) - interval '1 hour'\) < 2/, 'the videos an hour are counted for everybody together')
    assert.match(q, /where o\.bucket_id = 'report-videos'\) < 1024 \* 1024 \* 1024/, 'nothing limits how much the bucket holds')
    assert.match(q, /split_part\(o\.name, '\/', 1\) = 'anon'\) < 500 \* 1024 \* 1024\)/, 'signed out, a stranger can fill the whole bucket')
    assert.match(q, /o\.created_at < now\(\) - interval '7 days' or \( o\.created_at < now\(\) - interval '1 hour' and not exists \( select 1 from public\.feedback f where coalesce\(f\.user_id::text, 'anon'\) = split_part\(o\.name, '\/', 1\) and f\.context ->> 'video' = o\.name \) \)/)
    assert.match(q, /revoke all on function public\.report_videos_due\(\) from public, anon, authenticated; grant execute on function public\.report_videos_due\(\) to service_role;/)
    assert.equal(r.VIDEO_LINK_DAYS, 7)
    assert.match(read('supabase/functions/feedback-email/index.ts'), /const VIDEO_LINK_DAYS = 7\n/, 'the email’s link outlives the video, or dies before it')

    /* The tidy, run: asked, it deletes what is due and is a video's place, and the pictures' as before. */
    const v = `anon/${KEY}-video.mp4`
    const sweep = await feedbackEmail({ row: { sweep: true }, due: [`anon/${KEY}-1.jpg`], videoDue: [v, `anon/${KEY}-1.jpg`, 'gear/amp.png'], resendKey: '' })
    assert.deepEqual(sweep.said, { swept: 2 })
    const gone = sweep.calls.filter((c) => c.method === 'DELETE')
    assert.deepEqual(gone.map((c) => [c.url, c.body.prefixes]).sort(), [
      [`${PROJECT}/storage/v1/object/report-shots`, [`anon/${KEY}-1.jpg`]],
      [`${PROJECT}/storage/v1/object/report-videos`, [v]]
    ], 'the tidy deleted something that is not its own bucket’s')

    /* Delete account: the account's own video, and one under anon/ named by a report it sent signed out; never another's. */
    const mine = `${USER}/${KEY}-video.mov`
    const anon = `anon/${KEY}-video.mp4`
    const theirs = `${OTHER}/${KEY}-video.mp4`
    const del = await deleteAccount({
      reports: [
        { id: 'a', user_id: USER, context: { video: mine } },
        { id: 'b', user_id: null, context: { video: anon } },
        { id: 'c', user_id: null, context: { video: theirs } }
      ],
      videoFolder: [`${KEY}-video.mp4`, 'notes.txt']
    })
    assert.equal(del.status, 200)
    assert.deepEqual([...del.videosRemoved].sort(), [anon, mine, `${USER}/${KEY}-video.mp4`].sort(), 'Delete account left a video of the account’s, or took somebody else’s')
  })

  test('the email links the video, signed for its week, once, and only the sender’s own', async () => {
    const path = `${USER}/${KEY}-video.mp4`
    const row = { id: '21be6661-e330-415e-b6e6-7bbae82da811', kind: 'bug', message: 'Watch this', contact: null, user_id: USER, context: { unit: 'AM4', video: path }, log: '' }
    const run = await feedbackEmail({ row, users: { [USER]: 'player@example.com' } })
    assert.equal(run.sent.length, 1)
    const html = run.sent[0].html
    assert.match(html, new RegExp(`<a href="${PROJECT}/storage/v1/object/sign/report-videos/${path}\\?token=signed" style="font-weight:600">Watch the video</a>`))
    assert.match(html, /the link works for 7 days, then the video is deleted/)
    assert.doesNotMatch(html, /<b>video<\/b>/, 'the video’s place was listed as a fact')
    assert.ok(!(run.sent[0].attachments || []).some((a) => /video/.test(a.filename)), 'the video was attached to the email')
    const signed = run.calls.find((c) => c.url.startsWith(`${PROJECT}/storage/v1/object/sign/report-videos/`))
    assert.deepEqual(signed.body, { expiresIn: 7 * 24 * 60 * 60 })
    assert.equal(signed.headers.Authorization, `Bearer ${SERVICE}`)
    assert.equal(run.said.video, true)

    /* Somebody else's, one already linked from another report, or one storage will not sign: a line, never a link. */
    for (const [why, options, said] of [
      ['another folder', { row: { ...row, context: { video: `${OTHER}/${KEY}-video.mp4` } } }, /The video was not the sender's own, so it was left out\./],
      ['anon/ from an account', { row: { ...row, context: { video: `anon/${KEY}-video.mp4` } } }, /The video was not the sender's own/],
      ['named before', { row, videoNamed: [path] }, /The video was already sent with another report, so it was left out\./],
      ['not signed', { row, signStatus: 404 }, /The video could not be linked \(404\); it is in the report-videos bucket for 7 days\./]
    ]) {
      const other = await feedbackEmail({ users: { [USER]: 'player@example.com' }, ...options })
      const body = other.sent[0].html
      assert.doesNotMatch(body, /Watch the video/, `${why}: the video was linked`)
      assert.match(body.replace(/&#39;|&apos;/g, "'"), said, `${why}: the email does not say why the video is missing`)
      assert.equal(other.said.video, undefined)
    }
    /* A report with no video asks nothing about one. */
    const none = await feedbackEmail({ row: { ...row, context: { unit: 'AM4' } }, users: { [USER]: 'player@example.com' } })
    assert.ok(!none.calls.some((c) => c.url.includes('/sign/') || c.url.includes('context->>video')), 'a report with no video asked about one')
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
    /* Which computer, and why: the choice, and nothing from before it, which was about whichever computer answered then. */
    const why = html.slice(html.indexOf('Which computer, and why'), html.indexOf('What went wrong'))
    assert.match(why, /driving raspberry pi 3, the one picked under Which unit, addressed/)
    assert.doesNotMatch(why, /the computer has a unit — AM4|the computer is MacBook/, 'a line from before the choice reads as being about the computer chosen')
    assert.match(html, /What went wrong[\s\S]*join failed after 12\.2s[\s\S]*gave up — The connection to your computer dropped\./)
    assert.doesNotMatch(html.slice(html.indexOf('What went wrong'), html.indexOf('How the run before')), /TypeError/, 'the run before’s crash was put among this run’s troubles')
    assert.match(html, /How the run before this one ended[\s\S]*THE RUN BEFORE THIS ONE — 3 lines[\s\S]*\[crash\] TypeError: undefined is not an object[\s\S]*the app stopped/)
    assert.match(html, /What the computer said/)
    assert.match(html, /What went wrong \(newest at the bottom\)/)
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
    /* What is read at a glance comes first, the pictures after it: three tall screenshots above the facts put them screens down. The line about a picture that could not come stays near the top. */
    const place = (s) => html.indexOf(s)
    assert.ok(place('What the computer said') < place('>Screenshots<') && place('>Screenshots<') < place('<img src="cid:shot-1"'), 'the pictures come before the facts and the log’s parts')
    assert.ok(place('Screenshot 2 could not be read') < place('<b>unit</b>'), 'the line about a picture that could not come went down with the pictures')
    assert.match(html, /Screenshot 3 was not the sender&#39;s own|Screenshot 3 was not the sender's own/)
    const asked = run.calls.filter((c) => c.url.includes('/storage/v1/object/')).map((c) => c.url.split('/report-shots/')[1])
    assert.deepEqual(asked, [shotA, shotB], 'the function read a picture outside the sender’s folder')
    for (const c of run.calls.filter((c) => c.url.includes('/storage/v1/object/'))) assert.equal(c.headers.Authorization, `Bearer ${SERVICE}`)

    /* One email per row, however often it is asked for. */
    assert.equal(run.headers[0]['Idempotency-Key'], 'feedback-email/21be6661-e330-415e-b6e6-7bbae82da811')
    assert.deepEqual(run.said, { sent: true, screenshots: 1, log: true })

    /* An older app's log, with no head and no runs before: the body still finds what went wrong, and says nothing it does not have. */
    const old = await feedbackEmail({ row: { id: 'x', kind: 'bug', message: 'Test', context: {}, log: '10:00:00.000 [wire] GET /device/detect gave up — no\n10:00:01.000 [tap] press X' } })
    assert.doesNotMatch(old.sent[0].html, /From the top of the log|How the run before|What the computer said/)
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
    assert.match(fn, /const within = \(url: string, init: RequestInit = \{\}, ms = WAIT_MS\) => fetch\(url, \{ \.\.\.init, signal: AbortSignal\.timeout\(ms\) \}\)/)
    assert.equal((fn.match(/\bfetch\(/g) || []).length, 1, 'a request is made without the deadline')
    /* And the trigger gives it time to finish: sixty seconds, and the function keeps itself under fifty-five. */
    assert.match(read('supabase/migrations/20261022_report_screenshots.sql'), /timeout_milliseconds := 60000/)
    assert.match(fn, /const BUDGET_MS = 55_000/)
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

    /* Nobody signed in: no reply address, and it says so. */
    for (const row of [{ ...base, user_id: null }, { ...base, user_id: 'not-an-id' }]) {
      const run = await feedbackEmail({ row, users: {} })
      assert.equal(run.sent.length, 1)
      assert.equal(run.sent[0].reply_to, undefined)
      assert.match(run.sent[0].html, /no reply address given/)
    }
    /*
     * Signed in, and the account's email could not be read (not found, a
     * refusal, the lookup timing out): the email still goes, and says it came
     * from an account, with the account to find it by, never as if sent
     * signed out (second review).
     */
    for (const [why, opts] of [['not found', { users: {} }], ['refused', { userFail: 503 }], ['timed out', { userFail: 'timeout' }]]) {
      const run = await feedbackEmail({ row: { ...base, contact: null, user_id: OTHER }, ...opts })
      assert.equal(run.sent.length, 1, `no email went when the account lookup ${why}`)
      assert.equal(run.sent[0].reply_to, undefined)
      assert.match(run.sent[0].html, new RegExp(`<b>Bug</b> — sent signed in, but the account(&#39;|')s email couldn(&#39;|')t be read \\(account ${OTHER}\\)<`), `a report whose account lookup ${why} reads as one sent signed out`)
      assert.doesNotMatch(run.sent[0].html, /no reply address given/)
    }
    const words = await feedbackEmail({ row: { ...base, contact: 'Thomas', user_id: OTHER }, userFail: 'timeout' })
    assert.match(words.sent[0].html, /they wrote "Thomas", which is not an address to reply to; sent signed in, but the account(&#39;|')s email couldn(&#39;|')t be read \(account /)
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

    /* The trigger's function is the live one with sixty seconds instead of five, and nothing else changed. */
    const body = (s) => s.slice(s.indexOf('create or replace function public.notify_feedback()'), s.indexOf('$$;', s.indexOf('create or replace function public.notify_feedback()')))
    const norm = (s) => body(s).replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim()
    assert.equal(norm(sql), norm(read('supabase/migrations/20260905_feedback_email.sql')).replace('timeout_milliseconds := 5000', 'timeout_milliseconds := 60000'))

    /* Delete account takes the pictures before the rows that name them, through Storage's own API. */
    const del = code(read('supabase/functions/delete-account/index.ts'))
    assert.ok(del.indexOf('await forgetShots(url, service, who, reports)') > 0 && del.indexOf('await forgetShots(url, service, who, reports)') < del.indexOf('await forgetRows(url, service, who)'), 'the rows go first, and with them where the pictures are')
    assert.match(del, /\/storage\/v1\/object\/list\/\$\{SHOT_BUCKET\}/, 'the account’s own folder is not looked through')
    assert.match(del, /\/storage\/v1\/object\/\$\{SHOT_BUCKET\}`, \{ method: 'DELETE', headers, body: JSON\.stringify\(\{ prefixes: \[\.\.\.paths\] \}\) \}/)
    assert.match(del, /feedback\?select=id,user_id,context&\$\{query\}/)

    /* Both senders upload before the row, with upsert off (the one thing the bucket's rule allows), and record the places in context. */
    for (const f of ['src/lib/reports.js', 'mobile/src/lib/reports.js']) {
      const src = code(read(f)).replace(/\s+/g, ' ')
      assert.match(src, /\.upload\(path, shot\.body, \{ contentType: 'image\/jpeg', upsert: false \}\)/, `${f} uploads in a way the bucket's rule does not allow`)
      assert.ok(src.indexOf('await uploadShots(') < src.indexOf(".from('feedback').insert("), `${f} writes the row before the pictures are in`)
    }
    const web = code(read('src/lib/reports.js')).replace(/\s+/g, ' ')
    assert.match(web, /owner: userId \|\| 'anon'/)
    assert.match(web, /context: withShots\(row\.context, pictures\)/)
    /* The phone: one owner and one key for the pictures and the video, and both in the row's context. */
    const mine = code(read('mobile/src/lib/reports.js')).replace(/\s+/g, ' ')
    assert.match(mine, /const owner = userId \|\| 'anon' const key = reportKey\(\)/)
    assert.match(mine, /uploadShots\(shots, \{ owner, key,/)
    assert.match(mine, /context: withVideo\(withShots\(row\.context, pictures\), moving\)/)
    assert.ok(mine.indexOf('await putVideo(') < mine.indexOf('await uploadShots('), 'the phone sends its pictures before the long part')
  })

  /*
   * THE REVIEW OF 23 OCTOBER 2026, server side. The app's key is public and
   * so is the repository, so anybody can put a picture under anon/ and write
   * a row naming it. What holds: the bucket takes only so much, nothing stays
   * past its week, a picture is mailed once, a picture is a JPEG, a refusal
   * over pictures still gets the report to the inbox, and Delete account
   * removes only what is the account's and tells the developer which emails
   * to delete.
   */
  test('the bucket takes only so much, and keeps nothing past its week', async () => {
    const sql = read('supabase/migrations/20261022_report_screenshots.sql')
    const q = sql.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ')
    const fnBody = (name) => q.slice(q.indexOf(`create or replace function public.${name}(`), q.indexOf('$$;', q.indexOf(`create or replace function public.${name}(`)))

    /* The rule asks for room in the folder the picture goes to before it lets it in. */
    assert.match(q, /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text \) and public\.report_shots_room\(\(storage\.foldername\(name\)\)\[1\]\) \);/, 'a picture goes in however full its folder or the bucket is')
    /*
     * Room, a share each (second review): fewer than 15 an hour into any one
     * folder, an account's or anon/; anon/ under 100 MB; the bucket under
     * 200 MB. One count for everybody let a stranger with the app's key hold
     * every sender's screenshots shut. Counted by the owner, answering only yes or no.
     */
    const room = fnBody('report_shots_room')
    assert.match(room, /^create or replace function public\.report_shots_room\(folder text\) returns boolean language sql stable security definer set search_path = ''/)
    assert.match(room, /from storage\.objects o where o\.bucket_id = 'report-shots' and split_part\(o\.name, '\/', 1\) = folder and o\.created_at > now\(\) - interval '1 hour'\) < 15/, 'the hour is counted for everybody together, so one sender can use up everybody’s')
    assert.match(room, /coalesce\(sum\(\(o\.metadata ->> 'size'\)::bigint\), 0\) from storage\.objects o where o\.bucket_id = 'report-shots'\) < 200 \* 1024 \* 1024/, 'nothing limits how much the bucket holds')
    assert.match(room, /\(folder <> 'anon' or \(select coalesce\(sum\(\(o\.metadata ->> 'size'\)::bigint\), 0\) from storage\.objects o where o\.bucket_id = 'report-shots' and split_part\(o\.name, '\/', 1\) = 'anon'\) < 100 \* 1024 \* 1024\)/, 'signed out, a stranger can fill the whole bucket and shut out every account')
    assert.match(q, /revoke all on function public\.report_shots_room\(text\) from public; grant execute on function public\.report_shots_room\(text\) to anon, authenticated;/)
    /*
     * Due: past its week, or past an hour with no report OF ITS OWN naming
     * it: a row from the folder's own sender, among the first three it names
     * (all the app writes, all the email reads). One row from a stranger
     * listing a hundred pictures kept all hundred for the week.
     */
    const due = fnBody('report_shots_due')
    assert.match(due, /returns setof text language sql stable security definer set search_path = ''/)
    assert.match(due, /o\.created_at < now\(\) - interval '7 days' or \( o\.created_at < now\(\) - interval '1 hour' and not exists \( select 1 from public\.feedback f where coalesce\(f\.user_id::text, 'anon'\) = split_part\(o\.name, '\/', 1\) and o\.name in \(f\.context -> 'screenshots' ->> 0, f\.context -> 'screenshots' ->> 1, f\.context -> 'screenshots' ->> 2\) \) \)/, 'a picture is kept by a row that is not its sender’s, or by a row naming more than the three a report carries')
    assert.doesNotMatch(due, /\? o\.name|jsonb_array_length/, 'kept by any row that names it, or by a count that fails on a row whose screenshots are not a list')
    assert.match(q, /revoke all on function public\.report_shots_due\(\) from public, anon, authenticated; grant execute on function public\.report_shots_due\(\) to service_role;/)
    /* The hour the rule counts is never emptied under it: the tidy takes nothing younger, and the email deletes nothing it sends. */
    assert.doesNotMatch(due, /interval '(\d+ minutes?|[0-9.]+ seconds?)'/)
    const fn = code(read('supabase/functions/feedback-email/index.ts'))
    assert.equal((fn.match(/method: 'DELETE'/g) || []).length, 2, 'the email function deletes something besides the two tidies (pictures and videos)')
    assert.match(fn, /async function sweepShots\(\)[\s\S]*?rpc\/report_shots_due[\s\S]*?method: 'DELETE', headers, body: JSON\.stringify\(\{ prefixes: paths \}\)/)

    /* And once a day, asked by the database with the trigger's own secret, in a file of its own because it needs pg_cron. */
    const cron = read('supabase/migrations/20261022_report_shots_sweep.sql').replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ')
    assert.match(cron, /create extension if not exists pg_cron with schema pg_catalog;/)
    assert.match(cron, /'x-hook-secret', hook_secret \), body := jsonb_build_object\('sweep', true\), timeout_milliseconds := 60000/)
    assert.match(cron, /revoke all on function public\.sweep_report_shots\(\) from public, anon, authenticated;/)
    assert.match(cron, /select cron\.schedule\('report-shots-sweep', '17 4 \* \* \*', \$\$select public\.sweep_report_shots\(\)\$\$\);/)
    assert.ok('20261022_report_screenshots.sql' < '20261022_report_shots_sweep.sql', 'the schedule would be applied before what it asks for')
    /* And only once the function that understands the tidy is out: the one before it would email a blank report every morning. */
    const readme = read('supabase/README.md')
    const live = readme.slice(readme.indexOf('### Putting it live, in this order'))
    assert.ok(live.indexOf('**Deploy feedback-email**') > 0 && live.indexOf('**Deploy feedback-email**') < live.indexOf('**Apply `20261022_report_shots_sweep.sql`**'), 'the README puts the daily tidy in before the function that knows what it is')
    assert.match(read('supabase/migrations/20261022_report_shots_sweep.sql'), /APPLY IT ONLY AFTER THE NEW feedback-email IS DEPLOYED/)

    /* Run: asked to tidy, it deletes what is due and is a place in the bucket, and sends nothing. With no mail key too. */
    const a = `anon/${KEY}-1.jpg`
    const b = `${USER}/${KEY}-2.jpg`
    const sweep = await feedbackEmail({ row: { sweep: true }, due: [a, b, 'gear/amp.png', `${USER}/../${KEY}-1.jpg`], resendKey: '' })
    assert.deepEqual(sweep.said, { swept: 2 })
    assert.equal(sweep.sent.length, 0, 'the tidy sent an email')
    const gone = sweep.calls.filter((c) => c.method === 'DELETE')
    assert.equal(gone.length, 1)
    assert.equal(gone[0].url, `${PROJECT}/storage/v1/object/report-shots`)
    assert.deepEqual(gone[0].body, { prefixes: [a, b] }, 'the tidy deleted something that is not a screenshot’s place')
    assert.equal(gone[0].headers.Authorization, `Bearer ${SERVICE}`)
    /* Nobody but the database may ask. */
    const stranger = await feedbackEmail({ row: { sweep: true }, due: [a], given: 'a guess' })
    assert.equal(stranger.status, 401)
    assert.ok(!stranger.calls.some((c) => c.method === 'DELETE'))

    /* Every report tidies on its way, and its email still goes; before the migration the tidy is refused and the email goes all the same. */
    const report = { id: '9b2f6a10-1c2d-4e3f-8a4b-5c6d7e8f9a0b', kind: 'bug', message: 'Hi', context: {}, log: null }
    const withReport = await feedbackEmail({ row: report, due: [a] })
    assert.equal(withReport.sent.length, 1)
    assert.ok(withReport.calls.some((c) => c.method === 'DELETE'), 'a report did not tidy the bucket')
    const early = await feedbackEmail({ row: report, dueStatus: 404 })
    assert.equal(early.sent.length, 1, 'a tidy that could not be done cost the email')
    assert.ok(!early.calls.some((c) => c.method === 'DELETE'))
    assert.ok(early.logged.some((l) => /could not ask which screenshots are due 404/.test(l)))
  })

  test('a picture goes in one email only, and only when it is a JPEG', async () => {
    const id = '9b2f6a10-1c2d-4e3f-8a4b-5c6d7e8f9a0b'
    const [a, b, c] = [1, 2, 3].map((n) => `anon/${KEY}-${n}.jpg`)
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])
    const page = Buffer.from('<html><body>not a picture</body></html>')
    const row = { id, kind: 'bug', message: 'Look', user_id: null, context: { screenshots: [a, b, c] }, log: '10:00:00.000 [link] off → joining — the computer · v1.87.48' }
    const run = await feedbackEmail({ row, stored: { [a]: jpeg, [b]: jpeg, [c]: page }, named: [b] })
    const [mail] = run.sent
    const pics = mail.attachments.filter((x) => /\.jpg$/.test(x.filename))
    assert.deepEqual(pics.map((p) => p.filename), ['screenshot-1.jpg'], 'a picture named before, or one that is not a JPEG, was attached')
    assert.match(mail.html, /Screenshot 2 was already sent with another report, so it was left out\./)
    assert.match(mail.html, /Screenshot 3 was not a picture, so it was left out\./)
    /* Asked before it is read: a picture named again costs a small query, never its bytes. */
    const readOut = run.calls.filter((x) => x.method === 'GET' && x.url.startsWith(`${PROJECT}/storage/v1/object/report-shots/`)).map((x) => x.url.split('/report-shots/')[1])
    assert.deepEqual(readOut.sort(), [a, c], 'a picture another report named was read out of storage again')
    const checks = run.calls.filter((x) => x.url.startsWith(`${PROJECT}/rest/v1/feedback?select=id&`))
    assert.equal(checks.length, 3)
    for (const check of checks) {
      assert.match(check.url, new RegExp(`id=neq\\.${id}&context->screenshots=cs\\.%5B%22anon%2F`), 'the check does not leave this row out, or does not ask by the picture’s place')
      assert.equal(check.headers.Authorization, `Bearer ${SERVICE}`)
    }
    /* Each attachment says what it is: the pictures JPEG, the log UTF-8, so "—", "→" and "·" read as themselves. */
    assert.equal(pics[0].content_type, 'image/jpeg')
    const logFile = mail.attachments.find((x) => /\.txt$/.test(x.filename))
    assert.equal(logFile.content_type, 'text/plain; charset=utf-8')
    assert.equal(Buffer.from(logFile.content, 'base64').toString('utf8'), row.log)
    assert.ok(run.mod.isJpeg(new Uint8Array(jpeg)) && !run.mod.isJpeg(new Uint8Array(page)) && !run.mod.isJpeg(new Uint8Array([0xff, 0xd8])))

    /* A row with no id to check against has its pictures left out, not mailed unchecked. */
    const noId = await feedbackEmail({ row: { ...row, id: undefined }, stored: { [a]: jpeg } })
    assert.equal((noId.sent[0].attachments || []).filter((x) => /\.jpg$/.test(x.filename)).length, 0)
    assert.match(noId.sent[0].html, /Screenshot 1 was left out: the report has no id to check it against\./)

    /* All at once: three pictures take as long as one. */
    const mine = [1, 2, 3].map((n) => `${USER}/${KEY}-${n}.jpg`)
    const together = await feedbackEmail({ row: { ...row, user_id: USER, context: { screenshots: mine } }, stored: Object.fromEntries(mine.map((p) => [p, jpeg])), hold: 40 })
    assert.equal(together.reads.most, 3, 'the pictures were read one after another')
    assert.equal(together.sent[0].attachments.filter((x) => /\.jpg$/.test(x.filename)).length, 3)
  })

  test('an email refused with its pictures goes again without them, and says so', async () => {
    const id = '9b2f6a10-1c2d-4e3f-8a4b-5c6d7e8f9a0b'
    const shotA = `${USER}/${KEY}-1.jpg`
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])
    const row = { id, kind: 'bug', message: 'Look at this', user_id: USER, context: { screenshots: [shotA] }, log: LOG }
    const run = await feedbackEmail({ row, stored: { [shotA]: jpeg }, resend: [422] })
    assert.equal(run.sent.length, 2, 'a refused email with pictures was not sent again')
    assert.ok(run.sent[0].attachments.some((x) => /\.jpg$/.test(x.filename)))
    assert.ok(!run.sent[1].attachments.some((x) => /\.jpg$/.test(x.filename)), 'the second go carried the pictures again')
    assert.ok(run.sent[1].attachments.some((x) => /\.txt$/.test(x.filename)), 'the second go left the log out too')
    assert.doesNotMatch(run.sent[1].html, /cid:shot-1/)
    assert.match(run.sent[1].html, /The screenshots couldn't be attached \(the mail service said 422\), so this email went without them\. They stay in the report-shots bucket for 7 days\./)
    assert.equal(run.headers[1]['Idempotency-Key'], `feedback-email/${id}/plain`, 'the second go would be taken for the first')
    assert.deepEqual(run.said, { sent: true, screenshots: 0, log: true, withoutScreenshots: true })

    /* Too many, or the same key again, is not about the pictures: once, as before. So is a refusal with no pictures in it, and a server's own trouble. */
    for (const [status, r] of [
      [429, row],
      [409, row],
      [500, row],
      [422, { ...row, context: {} }]
    ]) {
      const once = await feedbackEmail({ row: r, stored: { [shotA]: jpeg }, resend: [status] })
      assert.equal(once.sent.length, 1, `a ${status} was sent twice`)
      assert.equal(once.said.sent, false)
      assert.equal(once.said.status, status)
      assert.match(once.said.detail, /attachment too large/, 'what Resend said is not kept')
    }
  })

  test('the email says which computer was chosen from the lines after the choice, and catches the link going down', async () => {
    const { mod } = await feedbackEmail({ row: { id: 'x', kind: 'idea', message: 'x', context: {}, log: null } })
    const two = [
      'app: Fractal Remote (phone) v1.87.48',
      '',
      '16:48:55.833 [link] the computer is MacBook Pro SG 566, v1.87.47',
      '16:48:57.588 [unit] the computer has a unit — AM4',
      '16:49:00.277 [link] three computers answered: MacBook Pro SG 566 (FM3), raspberry pi 5 (no unit plugged in), raspberry pi 3 (AM4); driving raspberry pi 3, the one picked under Which unit',
      '16:49:00.387 [link] the computer is raspberry pi 3, v1.87.48',
      '16:49:07.199 [relay] channel channel error — socket closed: 1000',
      '16:49:09.202 [link] down — Play says not connected (joining)',
      '16:49:23.901 [link] the computer is MacBook Pro SG 566, v1.87.47',
      '16:49:28.338 [link] three computers answered: MacBook Pro SG 566 (FM3), raspberry pi 5 (no unit plugged in), raspberry pi 3 (AM4); driving MacBook Pro SG 566, the one with the unit',
      '16:49:30.010 [unit] the computer has a unit — FM3',
      '16:49:31.000 [tap] press Send logs to developer'
    ].join('\n')
    const sum = mod.summarize(two)
    assert.deepEqual(
      sum.link,
      [
        '16:49:28.338 [link] three computers answered: MacBook Pro SG 566 (FM3), raspberry pi 5 (no unit plugged in), raspberry pi 3 (AM4); driving MacBook Pro SG 566, the one with the unit',
        '16:49:30.010 [unit] the computer has a unit — FM3'
      ],
      'a line from before the last choice was put with it, or the lines are out of the order they were written in'
    )
    /* The moment the connection dropped is among what went wrong. */
    assert.ok(sum.trouble.includes('16:49:07.199 [relay] channel channel error — socket closed: 1000'), 'a bare "error" was missed')
    assert.ok(sum.trouble.includes('16:49:09.202 [link] down — Play says not connected (joining)'), 'the link going down was missed')
    assert.ok(!sum.trouble.some((l) => /the computer is|press Send/.test(l)))
    assert.deepEqual(mod.summarize('10:00:00.000 [link] errors: none\n10:00:01.000 [link] terror').trouble, [], 'a word with "error" inside it was taken for one')

    /* One computer, no roll call: the last of each, in the order written. */
    const one = mod.summarize(['10:00:01.000 [unit] the computer has a unit — FM3', '10:00:02.000 [link] the computer is Layton, v1.87.48'].join('\n'))
    assert.deepEqual(one.link, ['10:00:01.000 [unit] the computer has a unit — FM3', '10:00:02.000 [link] the computer is Layton, v1.87.48'])
  })

  test('Delete account removes only what is the account’s, and tells the developer which emails to delete', async () => {
    const mine = `${USER}/${KEY}-1.jpg`
    const theirs = `${OTHER}/${KEY}-1.jpg`
    const [anonA, anonB] = [`anon/${KEY}-1.jpg`, `anon/${KEY}-2.jpg`]
    const reports = [
      /* Sent signed in: its own folder's picture goes; an anon/ one in a signed-in row is not the shape the app writes. */
      { id: 'a1111111-1111-4111-8111-111111111111', user_id: USER, context: { screenshots: [mine, anonA] } },
      /* Sent signed out, giving this address: its anon/ picture is this person's. */
      { id: 'b2222222-2222-4222-8222-222222222222', user_id: null, context: { screenshots: [anonB] } },
      /* From another account, giving this address: anybody can write that, naming anything. Neither picture is this account's. */
      { id: 'c3333333-3333-4333-8333-333333333333', user_id: OTHER, context: { screenshots: [theirs, anonA] } }
    ]
    const run = await deleteAccount({ reports, folder: [`${KEY}-3.jpg`, 'notes.txt'] })
    assert.deepEqual(run.said, { deleted: true })
    assert.deepEqual([...run.removed].sort(), [mine, anonB, `${USER}/${KEY}-3.jpg`].sort(), 'Delete account removed a picture that was not the account’s, or left one that was')
    assert.ok(!run.removed.includes(theirs), 'another account’s picture was deleted')

    /* The note: one email, to the developer, once the rows have gone, by row id only. */
    assert.equal(run.notes.length, 1)
    const note = run.notes[0].body
    assert.deepEqual(note.to, ['justinnewbold@gmail.com'])
    assert.equal(note.subject, 'Account deleted: delete its 3 report emails')
    for (const r of reports) assert.match(note.text, new RegExp(`^Row ${r.id}$`, 'm'), `report ${r.id} is not named, so its email cannot be found`)
    assert.doesNotMatch(note.text, /player@example\.com/, 'the deleted account’s address went into a new email')
    assert.equal(run.notes[0].headers['Idempotency-Key'], `delete-account/${USER}`)
    const at = (pred) => run.calls.findIndex(pred)
    assert.ok(at((c) => c.method === 'DELETE' && c.url.startsWith(`${PROJECT}/rest/v1/feedback?`)) < at((c) => c.url === 'https://api.resend.com/emails'), 'the developer was told before the rows had gone')

    /*
     * The account's own delete refused AFTER the rows went (second review):
     * the note still goes, because a try again finds no rows to list, and the
     * try again sends no second one.
     */
    const refused = await deleteAccount({ reports, authStatus: 500 })
    assert.equal(refused.status, 502)
    assert.ok(refused.calls.some((c) => c.method === 'DELETE' && c.url === `${PROJECT}/rest/v1/feedback?user_id=eq.${USER}`), 'the rows did not go')
    assert.equal(refused.notes.length, 1, 'the rows went and the developer was never told which emails to delete')
    assert.equal(refused.notes[0].body.subject, 'Account deleted: delete its 3 report emails')
    const again = await deleteAccount({ reports: [] })
    assert.deepEqual(again.said, { deleted: true })
    assert.equal(again.notes.length, 0)

    /* A lookup that could not be done: nothing deleted, no note, try again. Never a row gone that no note listed. */
    for (const lookupStatus of [{ byId: 503 }, { byAddress: 500 }]) {
      const blind = await deleteAccount({ reports, lookupStatus })
      assert.equal(blind.status, 502, `a ${JSON.stringify(lookupStatus)} lookup went on to delete`)
      assert.ok(!blind.calls.some((c) => c.method === 'DELETE'), 'something was deleted without knowing which reports went')
      assert.equal(blind.notes.length, 0)
    }
    const single = await deleteAccount({ reports: reports.slice(0, 1) })
    assert.equal(single.notes[0].body.subject, 'Account deleted: delete its 1 report email')
    assert.match(single.notes[0].body.text, /One report it sent was emailed here, with its log and screenshots\./)

    /* No reports, or no mail key: no note, and the account is deleted all the same. */
    const none = await deleteAccount({ reports: [] })
    assert.equal(none.notes.length, 0)
    const quiet = await deleteAccount({ reports, resendKey: '' })
    assert.equal(quiet.notes.length, 0)
    assert.deepEqual(quiet.said, { deleted: true })
  })

  /*
   * THE REVIEW OF 23 OCTOBER 2026, screens and words.
   */
  test('the phone’s Send logs to developer and what it said stay on screen, whatever is above them', async () => {
    const log = code(read('mobile/src/screens/Log.js')).replace(/\s+/g, ' ')
    /* The scroller holds the note and the pictures, and nothing else: never Send, never what Send said. */
    const scroller = log.slice(log.indexOf('<ScrollView'), log.indexOf('</ScrollView>'))
    assert.ok(scroller.includes('<TextInput') && scroller.includes('<Shots shots={shots}'), 'the note or the pictures left the scroller')
    assert.doesNotMatch(scroller, /Send logs to developer|sentSaid\.words|Clear Logs/, 'Send, or what it said, is inside a scroller that shrinks, so a small phone puts it below the screen')
    /*
     * Capped, and the one that gives way after the log list, never Send; and
     * capped lower while the foot says something, or on a 320 by 568 screen a
     * four-line answer under Send left the log list two points tall (second
     * review; rendered: 2 before, 84 after, and 106 for "Couldn't reach").
     */
    assert.match(scroller, /<ScrollView style=\{\{ flexGrow: 0, flexShrink: 1, maxHeight: sentSaid \? '20%' : '35%' \}\}/, 'the scroller keeps its whole third while a tall answer under Send takes the log list’s room')
    const foot = log.slice(log.indexOf('</ScrollView>'))
    assert.match(foot, /^<\/ScrollView> (\{ \} )?<View style=\{\{ flexShrink: 0, [^}]*\}\}> <Press label=\{sending \? 'Sending…' : 'Send logs to developer'\}[^>]*\/> \{sentSaid \? \(/, 'Send and what it said are not fixed straight under the scroller')
    /* The log list takes only what is left (flex 1 from nothing), so it is the first to give up room. */
    assert.match(log, /<FlatList style=\{\{ flex: 1 \}\} data=\{\[\.\.\.lines\]\.reverse\(\)\}/)
    /* Clear Logs beside Copy Logs, as in the browser, and still waiting while a send is on its way. */
    const top = log.slice(log.indexOf("<Press label=\"Copy Logs\""), log.indexOf('<FlatList'))
    assert.match(top, /<Press label="Clear Logs" disabled=\{sending\} onPress=/, 'Clear Logs is not beside Copy Logs')
    /*
     * What a paste said, on the log screen, goes to the foot under Send, in
     * the same one place as Send's answer (the latest of the two), never into
     * the scroller, whose edge cut off the Settings path (second review).
     * Elsewhere (the Feedback form) it stays straight under its button.
     */
    assert.match(scroller, /<Shots shots=\{shots\} onChange=\{setShots\} disabled=\{sending\} say=\{sayPaste\} \/>/, 'what a paste says is left inside the short scroller')
    assert.match(log, /const sayPaste = \(words\) => setSentSaid\(words \? \{ ok: false, words, paste: true \} : null\)/)
    assert.match(foot, /<Note tone=\{sentSaid\.ok \? 'hint' : 'fault'\} strong=\{!sentSaid\.paste\} size=\{sentSaid\.paste \? undefined : font\.body\}>/)
    const shots = code(read('mobile/src/components/Shots.js')).replace(/\s+/g, ' ')
    assert.match(shots, /export default function Shots\(\{ shots = \[\], onChange, disabled = false, say \}\) \{ const \[own, setOwn\] = useState\(null\) const setSaid = say \|\| setOwn const said = say \? null : own/, 'a screen that takes what a paste says gets it said twice, or not at all')
    assert.ok(shots.indexOf('{said ? <Note tone="fault">{said}</Note> : null}') < shots.indexOf('{copyHint()}'), 'what a paste said is under the hint, where a short scroller hides it')
    assert.doesNotMatch(code(read('mobile/src/screens/Report.js')), /<Shots[^>]*\bsay=/, 'the Feedback form lost the message under its Paste button')

    /*
     * The note, the pictures and Send stay while there is anything to send:
     * Clear Logs took them away with the lines, a note typed and pictures
     * pasted out of sight, and the run before (which a report carries) could
     * not be sent at all (second review).
     */
    assert.match(log, /const sendable = Boolean\(lines\.length \|\| before\.length \|\| note \|\| shots\.length\)/)
    assert.match(log, /\{sendable \? \( <> (\{ \} )?<ScrollView/, 'the note box, the pictures and Send go when the log is cleared')
    assert.doesNotMatch(log.slice(log.indexOf('<FlatList')), /\{lines\.length \? \( <>/)
  })

  test('the phone says where a screenshot comes from on an iPhone and on Android, and why a paste brought nothing', async () => {
    const r = await import('../shared/report-rules.mjs')
    const shotsSrc = read('mobile/src/components/Shots.js')
    const hint = (os) => {
      const m = shotsSrc.match(/export function copyHint\(os = Platform\.OS\) \{\s*return os === 'ios'\s*\? '([^']+)'\s*: '([^']+)'/)
      return os === 'ios' ? m[1] : m[2]
    }
    /* The photo picker first, on both; on an iPhone the copy route too, with the check mark at the top right (Done only on older versions). */
    assert.equal(hint('ios'), 'Choose one from your photos, or copy one to paste: take a screenshot (if only a little picture shows in the corner, tap it), tap the check mark at the top right, then Copy and Delete. On older versions, tap Done at the top left instead.')
    /* Android: no maker's copy route to explain any more, because the picker is there. */
    assert.equal(hint('android'), 'Choose one from your photos (screenshots have a folder of their own), or paste one you have copied.')
    /* The support page says the same steps. */
    const support = read('public/support.html').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
    assert.match(support, /To add up to three screenshots, tap Choose a screenshot and pick them from your photos, or copy one and tap Paste a screenshot\./)
    assert.match(support, /To copy a screenshot on an iPhone or iPad: take a screenshot \(if only a little picture shows in the corner, tap it\), tap the check mark at the top right, then Copy and Delete\. On older versions, tap Done at the top left instead\./)
    assert.match(support, /For one already in Photos: open it there, tap Share, then Copy Photo\./)
    assert.match(support, /On the website and in the computer app: Settings → Troubleshooting → Debug log has the same button/, 'the support page sends website users to the Debug log by a path that is not there')
    assert.doesNotMatch(support, /Debug log under Settings/)

    /* Why a paste brought nothing, in words a person can act on: refused is not empty, and no file formats. */
    /* "It said no screenshot to paste": an iPhone's screenshot is in Photos, so an iPhone or iPad is told how to copy one from there. */
    assert.equal(r.pasteWords('empty', 'ios'), 'There’s no picture to paste. For a screenshot already in Photos: open it there, tap Share, then Copy Photo. Then come back and tap Paste a screenshot.')
    assert.equal(r.pasteWords('empty', 'android'), 'There’s no picture to paste. Copy a screenshot first.')
    assert.equal(r.pasteWords('refused', 'ios'), 'The app wasn’t allowed to paste it. Tap Paste a screenshot again and choose Allow Paste. If you aren’t asked, go to Settings → Fractal Remote → Paste from Other Apps and choose Allow.')
    assert.equal(r.pasteWords('refused', 'android'), r.PASTE_WORDS.unreadable, 'Android was told about an iPhone setting')
    assert.equal(r.pasteWords('unreadable', 'android'), 'That picture couldn’t be read. Copy the screenshot again and paste it.')
    assert.equal(r.pasteWords('tooBig', 'ios'), 'That picture is too big to send. Paste a screenshot rather than a photo.')
    assert.equal(r.pasteWords('anything else', 'ios'), r.PASTE_WORDS.unreadable)
    /* The browser's file words may name the files (a person picking one can see it); nothing the phone says names a format. */
    for (const words of [...Object.values(r.PASTE_WORDS), r.SHOT_WORDS.tooBig, hint('ios'), hint('android')]) {
      assert.doesNotMatch(words, /PNG|JPEG|this (phone|iphone|device)|Try a smaller one/i, `"${words}"`)
    }
    assert.equal(r.SHOT_WORDS.unreadable, "That picture couldn't be opened. Pick a screenshot or a photo (a .png or .jpg file).")
    /* The phone shows the paste's own words, never the browser's file words. */
    assert.match(shotsSrc, /else setSaid\(pasteWords\(why, Platform\.OS\)\)/)
    assert.doesNotMatch(code(shotsSrc), /SHOT_WORDS\[why\]|SHOT_WORDS\.unreadable|emptyWords/)
    /* And a picked picture that could not be used says so in the picker's words, never a file format. */
    assert.match(shotsSrc, /if \(why\) setSaid\(why === 'full' \? SHOT_WORDS\.full : PICK_WORDS\[why\] \|\| PICK_WORDS\.unreadable\)/)
    for (const words of shotsSrc.match(/const PICK_WORDS = \{([\s\S]*?)\}/)[1].match(/'[^']+'/g)) assert.doesNotMatch(words, /PNG|JPEG|\.jpg|\.png/i)
  })

  test('the screenshots are said the same way with or without the log, and shown whole, at both ends', async () => {
    /* Each sentence stands on its own: the browser's for its screenshots, the phone's for its pictures and its video. */
    const webForm = flat('src/components/Feedback.jsx')
    assert.match(webForm, /\{shots\.length \? ' The screenshots you added go too\.' : ''\}/, 'the browser’s screenshots sentence leans on one that may not be there')
    const phoneForm = flat('mobile/src/screens/Report.js')
    assert.match(phoneForm, /\{shots\.length \? ' The pictures you added go too\.' : ''\}/, 'the phone’s pictures sentence leans on one that may not be there')
    assert.match(phoneForm, /\{video \? ' The video goes too, and is deleted after 7 days\.' : ''\}/, 'the phone’s video sentence leans on one that may not be there')
    for (const src of [webForm, phoneForm]) assert.doesNotMatch(src, /So do the screenshots/)
    const r = await import('../shared/report-rules.mjs')
    assert.deepEqual(r.thumbSize(2880, 1800, 72), { width: 72, height: 45 }, 'a computer’s wide screenshot is drawn as a tall tile')
    assert.deepEqual(r.thumbSize(1320, 2868, 64), { width: 64, height: 128 })
    assert.deepEqual(r.thumbSize(1179, 2556, 72), { width: 72, height: 128 })
    assert.deepEqual(r.thumbSize(6000, 400, 72), { width: 72, height: r.THUMB_LOW })
    assert.deepEqual(r.thumbSize(0, 0, 64), { width: 64, height: 96 })
    const web = flat('src/components/Shots.jsx')
    assert.match(web, /<img src=\{shot\.uri\} alt=\{`Screenshot \$\{i \+ 1\}`\} style=\{thumbSize\(shot\.width, shot\.height, 72\)\} \/>/, 'the browser does not draw a thumbnail in its picture’s shape')
    const css = read('src/styles.css')
    const rule = css.slice(css.indexOf('.report-shots-list img {'), css.indexOf('}', css.indexOf('.report-shots-list img {')))
    assert.match(rule, /object-fit: contain;/)
    assert.doesNotMatch(rule, /object-fit: cover|height: 96px/, 'the browser crops a thumbnail to a strip of its middle')
    const list = css.slice(css.indexOf('.report-shots-list {'), css.indexOf('}', css.indexOf('.report-shots-list {')))
    assert.match(list, /align-items: flex-start;/, 'a short tile beside a tall one stretches its Remove button')
    const phone = flat('mobile/src/components/Shots.js')
    assert.match(phone, /resizeMode="contain" style=\{\{ \.\.\.thumbSize\(shot\.width, shot\.height, 64\),/)
    /* And opened at the thumbnail's size on Android, not as the whole screenshot (Google Play's 1.88.0
       review asked for pictures opened at the size they are shown). thumbSize always gives the box a
       size, which a resized picture needs before it opens at all. */
    assert.match(phone, /source=\{\{ uri: shot\.uri \}\} accessibilityLabel=\{`Screenshot \$\{i \+ 1\}`\} \/\*[^*]*\*\/ resizeMethod="resize"/, 'a thumbnail opens the whole screenshot on Android again')
    /* Half as much again as the box: Android shrinks a JPEG in eighths, rounded down, and a box in the
       picture's own shape alone would open up to a quarter smaller than it is drawn. With 1.5, every
       shape thumbSize gives, on every screen from 2x to 4x, opens at or above the size it is drawn. */
    assert.match(phone, /resizeMethod="resize" resizeMultiplier=\{1\.5\} \/\*/, 'a thumbnail opens smaller than it is drawn on Android, and goes soft')
    const { thumbSize } = await import('../shared/report-rules.mjs')
    const eighths = (r) => Math.min(8, Math.max(1, Math.floor(2 / 3 + 8 * r)))
    for (const [w, h] of [[1200, 1600], [1600, 1200], [1600, 900], [1600, 1000], [1600, 1067], [720, 1600], [1200, 1200]]) {
      const box = thumbSize(w, h, 64)
      for (const density of [2, 2.625, 2.75, 3, 3.5, 4]) {
        const [bw, bh] = [Math.round(box.width * density), Math.round(box.height * density)]
        const r = Math.max(Math.round(bw * 1.5) / w, Math.round(bh * 1.5) / h)
        const n = r >= 1 ? 8 : eighths(r)
        const scale = Math.min(bw / Math.ceil((w * n) / 8), bh / Math.ceil((h * n) / 8))
        assert.ok(scale <= 1.001, `a ${w}×${h} screenshot at ${density}x is drawn ${scale.toFixed(2)} times the size it was opened at`)
      }
    }
  })

  test('the privacy page says where every copy of a report goes, and for how long', async () => {
    const page = read('public/privacy.html').replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '’').replace(/\s+/g, ' ')
    /* Delete account: the rows and stored pictures go at once; the emailed copy is the developer's to delete, and he is told which. */
    assert.match(page, /deleting the account deletes the report, and its screenshots, too\. A copy of each report, with its log and screenshots, is also emailed to the person who builds the app when it is sent, and deleting a report from the database cannot reach that email: deleting the account tells him which reports went, and he deletes those emails too\./)
    assert.match(page, /straight away and for good\. Each of those bug reports was also emailed to the person who builds the app when it was sent, with its log and screenshots, and the app cannot reach his inbox: Delete account sends him a note listing them, and he deletes those emails too\./, 'the page says Delete account removes a report for good and leaves out the emailed copy')
    assert.match(code(read('supabase/functions/delete-account/index.ts')), /await tellDeveloper\(reports\.map\(\(r\) => r\.id\), id\)/, 'the page promises a note Delete account never sends')
    /* How long a stored picture stays, the same as the bucket's own tidy. */
    assert.match(page, /They are stored privately for a week/)
    assert.match(page, /Screenshots added to a report — the stored copy is deleted a week after it was sent, or an hour after if its report never arrived\./)
    const sql = read('supabase/migrations/20261022_report_screenshots.sql')
    assert.match(sql, /o\.created_at < now\(\) - interval '7 days'/)
    assert.match(sql, /o\.created_at < now\(\) - interval '1 hour'\s+and not exists/)
    assert.doesNotMatch(page, /Bug reports, and their screenshots — until the problem is fixed/)
    /* The browser's head has no preset; only the phone's does. */
    assert.match(page, /your unit \(and, from the phone app, the preset\)/)
    assert.doesNotMatch(page, /your unit and preset,/)
    assert.doesNotMatch(read('src/lib/logHead.js'), /\bpreset:/, 'the browser’s head names a preset now, and the page says it does not')
  })

  test('a send the app gave up waiting for says it may still arrive', async () => {
    const r = await import('../shared/report-rules.mjs')
    const late = new Error('network: no answer within 20 seconds')
    assert.equal(r.notSentWords(late), "The internet didn't answer in time. It may still arrive, so wait a minute before sending it again. What you wrote is still here.")
    assert.equal(r.notSentWords(late, { wrote: false }), "The internet didn't answer in time. It may still arrive, so wait a minute before sending it again.")
    /* A connection that really dropped is still said as before. */
    assert.equal(r.notSentWords(new TypeError('Network request failed'), { wrote: false }), "Couldn't reach the internet to send that. Try again in a moment.")
    await assert.rejects(r.inTime(() => new Promise(() => {}), 30), (err) => r.notSentWords(err).startsWith("The internet didn't answer in time."))
  })
}
