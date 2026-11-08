/**
 * READ THE BUG REPORTS, AND NOTHING ELSE.
 *
 * "A read-only login for bug reports ... so I can open people's reports
 * myself instead of you forwarding the emails" (Justin said yes, 8 November
 * 2026). scripts/report.mjs used to read public.feedback through the
 * Management API with the full-account SUPABASE_TOKEN, which can do
 * anything to the project. This answers the same two questions, and no
 * others, to a caller holding a key that can do nothing else:
 *
 *   GET  …/functions/v1/read-reports?latest=10   the newest 1 to 50, one line's worth each
 *   GET  …/functions/v1/read-reports?id=014f2692  one report in full (the newest of at most
 *                                                two whose id starts so: 8 to 36 hex digits
 *                                                and dashes)
 *   POST …/functions/v1/read-reports/enroll      { "enroll": "<READ_REPORTS_ENROLL>" }, once:
 *                                                keep this request's key (below)
 *
 * Answered { ok: true, reports: [...] }, or { ok: false, why } with 400 (a
 * question it does not answer), 401 (no key, or one it does not know), 403
 * (enrolment closed, or the wrong token), 404, 405 (anything but those
 * three: there is no way to write a report, change one or delete one), 409
 * (three keys kept already) or 502 (the database did not answer).
 *
 * THE KEY. Every request carries `x-reports-key`. In a Claude session it is
 * never typed anywhere: Justin saves it once in the session's secure
 * credential form (host biznwrqeckviawjuhvyg.supabase.co, header
 * x-reports-key), and the network proxy adds it to every request to that
 * host. Here only its SHA-256 is kept (private.report_reader_keys,
 * migrations/20261108_report_readers.sql), every kept hash is compared with
 * the caller's in constant time, and the key is never logged, never
 * answered and never sent on to the database.
 *
 * ENROLMENT. To keep a key's hash, the lead sets the function secret
 * READ_REPORTS_ENROLL to a fresh random value (made in the shell, never
 * printed), POSTs it once to /enroll with the key riding on the request
 * from the proxy, and unsets it. With the secret unset, /enroll is shut
 * whatever is sent. `"replace": true` keeps the new key and takes back
 * every other, which is how a key is rolled over. supabase/README.md,
 * "Reading the reports without the full-account key", has the steps.
 *
 * NO CORS, on purpose: nothing in a web page reads reports, so no page is
 * let read an answer. Deployed with --no-verify-jwt: the caller has no
 * Supabase sign-in, and the key is the lock.
 */

/** The most a list gives, as scripts/report.mjs says it. */
export const MOST = 50
/** A key shorter than this is never kept or matched: a made-up password long enough not to be guessed over the wire. */
export const KEY_MIN = 20
/** Nor longer than this, so a huge header is not hashed. */
export const KEY_MAX = 256
/** READ_REPORTS_ENROLL shorter than this keeps /enroll shut: a short secret is a guessable one. */
export const ENROLL_MIN = 32
/** The most an /enroll body may be. */
const BODY_MAX = 2048

const ID_PREFIX = /^[0-9a-f-]{8,36}$/
const COUNT = /^[1-9][0-9]?$/

const env = (name: string) => Deno.env.get(name) || ''

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export type Route =
  | { kind: 'enroll' }
  | { kind: 'latest'; most: number }
  | { kind: 'one'; prefix: string }
  | { kind: 'refused'; status: number; why: string; read: boolean }

/**
 * What a request asks, from its method and address alone. `read: true` on a
 * refusal means it came to the reading door: the key is checked first, so a
 * caller without one learns nothing about what the door would answer.
 */
export function route(method: string, address: string): Route {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return { kind: 'refused', status: 400, why: 'bad address', read: false }
  }
  const parts = url.pathname.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || ''
  if (last === 'enroll') {
    if (method !== 'POST') return { kind: 'refused', status: 405, why: 'method not allowed', read: false }
    if ([...url.searchParams.keys()].length) return { kind: 'refused', status: 400, why: 'enroll takes no query', read: false }
    return { kind: 'enroll' }
  }
  if (last !== 'read-reports') return { kind: 'refused', status: 404, why: 'not found', read: false }
  if (method !== 'GET') return { kind: 'refused', status: 405, why: 'method not allowed', read: false }

  const asked = [...url.searchParams.keys()]
  const ask = (why: string): Route => ({ kind: 'refused', status: 400, why, read: true })
  if (asked.length !== 1) return ask('ask ?latest=N (1 to 50) or ?id=<the start of a report id>, one of them')
  const value = url.searchParams.get(asked[0]) || ''
  if (asked[0] === 'latest') {
    if (!COUNT.test(value) || Number(value) > MOST) return ask(`latest is a whole number from 1 to ${MOST}`)
    return { kind: 'latest', most: Number(value) }
  }
  if (asked[0] === 'id') {
    const prefix = value.toLowerCase()
    if (!ID_PREFIX.test(prefix)) return ask('an id is 8 to 36 hex digits and dashes, like 014f2692')
    return { kind: 'one', prefix }
  }
  return ask('ask ?latest=N (1 to 50) or ?id=<the start of a report id>, one of them')
}

/** A key this door could keep or match: printable, and long enough. */
export const keyShapeOk = (key: unknown): key is string =>
  typeof key === 'string' && key.length >= KEY_MIN && key.length <= KEY_MAX && /^[\x20-\x7e]+$/.test(key)

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

export const sha256Hex = async (text: string) => hex(await sha256(text))

/** Equal or not, in a time that depends on the length alone, never on where the first difference is. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** Two hex hashes, the same way: every character looked at. */
export function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Whether `mine` is among `kept`, every one compared, none skipped once one has matched. */
export function among(kept: unknown, mine: string): boolean {
  let hit = 0
  for (const h of Array.isArray(kept) ? kept : []) hit |= sameHex(String(h), mine) ? 1 : 0
  return hit === 1
}

/** Two secrets, compared as their SHA-256, so neither their contents nor their lengths show in the time taken. */
export async function sameSecret(given: string, expected: string): Promise<boolean> {
  return sameBytes(await sha256(given), await sha256(expected))
}

/** One of the four database functions, as the service role. Throws on a refusal. */
async function rpc(name: 'report_reader_hashes' | 'enroll_report_reader' | 'read_reports_latest' | 'read_report', args: Record<string, unknown>): Promise<unknown> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  })
  if (!res.ok) throw new Error(`${name}: ${res.status} ${(await res.text()).slice(0, 300)}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

/** Whether this key is one of the kept ones. A key of the wrong shape is a no before anything is asked. */
async function known(key: string): Promise<boolean> {
  if (!keyShapeOk(key)) return false
  const mine = await sha256Hex(key)
  return among(await rpc('report_reader_hashes', {}), mine)
}

async function enroll(req: Request, key: string): Promise<Response> {
  const secret = env('READ_REPORTS_ENROLL')
  if (secret.length < ENROLL_MIN) {
    if (secret) console.error('read-reports: READ_REPORTS_ENROLL is too short, so enrolment stays shut')
    return json({ ok: false, why: 'enrolment is closed' }, 403)
  }
  const text = await req.text()
  if (text.length > BODY_MAX) return json({ ok: false, why: 'bad request' }, 400)
  let body: Record<string, unknown> = {}
  try {
    body = JSON.parse(text) || {}
  } catch {
    return json({ ok: false, why: 'bad request' }, 400)
  }
  const token = typeof body.enroll === 'string' ? body.enroll : ''
  if (!token || !(await sameSecret(token, secret))) {
    console.log('read-reports: enrolment refused, the wrong token')
    return json({ ok: false, why: 'wrong enrolment token' }, 403)
  }
  if (!keyShapeOk(key)) {
    return json({ ok: false, why: `no x-reports-key of ${KEY_MIN} to ${KEY_MAX} printable characters came with the request` }, 400)
  }
  try {
    const said = (await rpc('enroll_report_reader', { key_hash: await sha256Hex(key), replace_others: body.replace === true })) as Record<string, unknown> | null
    const keys = Number(said?.keys) || 0
    console.log(`read-reports: enrolment ${String(said?.why || 'failed')}, ${keys} kept`)
    if (said?.ok) return json({ ok: true, why: String(said.why), keys })
    if (said?.why === 'full') return json({ ok: false, why: 'three keys are kept already: take one back first, or send "replace": true', keys }, 409)
    return json({ ok: false, why: 'not enrolled' }, 500)
  } catch (err) {
    console.error(`read-reports: enrolment failed (${err})`)
    return json({ ok: false, why: 'the database did not answer' }, 502)
  }
}

export async function handle(req: Request): Promise<Response> {
  const asked = route(req.method, req.url)
  if (asked.kind === 'refused' && !asked.read) return json({ ok: false, why: asked.why }, asked.status)
  /* Trimmed by the platform; read here once and never repeated anywhere. */
  const key = req.headers.get('x-reports-key') || ''
  if (asked.kind === 'enroll') return await enroll(req, key)

  try {
    if (!(await known(key))) {
      console.log(`read-reports: refused, ${key ? 'a key that is not kept' : 'no key'}`)
      return json({ ok: false, why: 'not allowed' }, 401)
    }
  } catch (err) {
    console.error(`read-reports: could not check the key (${err})`)
    return json({ ok: false, why: 'the database did not answer' }, 502)
  }
  if (asked.kind === 'refused') return json({ ok: false, why: asked.why }, asked.status)

  try {
    const said =
      asked.kind === 'latest' ? await rpc('read_reports_latest', { most: asked.most }) : await rpc('read_report', { prefix: asked.prefix })
    const reports = Array.isArray(said) ? said : []
    console.log(`read-reports: ${asked.kind === 'latest' ? `latest ${asked.most}` : `report ${asked.prefix}`}, ${reports.length} answered`)
    return json({ ok: true, reports })
  } catch (err) {
    console.error(`read-reports: could not read (${err})`)
    return json({ ok: false, why: 'the database did not answer' }, 502)
  }
}

Deno.serve(handle)
