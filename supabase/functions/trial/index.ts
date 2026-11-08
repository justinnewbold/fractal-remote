/**
 * START THE SEVEN-DAY FREE TRIAL.
 *
 * "Okay, let's get the seven-day trial built out." (Justin, 7 November 2026.)
 * One trial per account, ever, and one per device. The phone, the website and
 * the computer app all ask here, the same way:
 *
 *   POST /functions/v1/trial
 *   Authorization: Bearer <the signed-in session's token>
 *   { "action": "start", "device": "<install number>", "platform": "ios" | "android" | "web" | "computer" }
 *
 * and are answered { ok, why?, trial: { startedAt, endsAt, live } | null }.
 * How long it is, and when an iPhone's begins, is shared/trial-rule.mjs
 * (copied beside this as ../_shared/trial-rule.mjs by `npm run sync:rules`).
 * Whether a running trial lets somebody in is answered by `entitlement` and,
 * for the relay, by public.is_entitled (20261107_trials.sql).
 *
 * WHO IS ASKING IS NOT UP TO THE CALLER: the account comes out of the token,
 * verified by Supabase, never out of the body. The body says only which
 * device and which kind of copy, and neither can give anybody more than one
 * trial: the account is held to one by the table's key, and the device by a
 * salted hash of its install number, kept even after the account is deleted.
 *
 * AN iPHONE OR iPAD STARTS IT BY BUYING THE APP STORE'S FREE ITEM, never by
 * asking alone. Apple's guideline 3.1.1 lets an app that is not a
 * subscription offer a time-based trial only as a Non-Consumable at price
 * tier 0 ("7-Day Trial", product trial_7day; docs/app-store.md). So for
 * `ios` this asks RevenueCat whether that item is on the account, and the
 * trial begins when it was bought, never later; a test purchase (App
 * Review's and TestFlight's Apple IDs, `storeTrialAt`) as if bought now.
 * Elsewhere there is no store item, and the trial begins now.
 *
 * WHAT HAS TO BE SET, in Supabase -> Edge Functions -> Secrets:
 *
 *   REVENUECAT_SECRET     the V2 secret key `entitlement` already uses
 *   TRIAL_DEVICE_SALT     a long random string, set ONCE and never changed:
 *                         a new one would make every device that has had a
 *                         trial look new. Without it a fixed salt is used,
 *                         which still keeps the install number itself out
 *                         of the table.
 *
 * Deployed with verify_jwt on, like `entitlement`.
 */
import { TRIAL_PRODUCT_ID, deviceIdOk, trialAnswer, trialStart } from '../_shared/trial-rule.mjs'

const RC = 'https://api.revenuecat.com/v2'
const DEFAULT_PROJECT = 'proj827190e9'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const env = (name: string) => Deno.env.get(name) || ''

/** The account a Supabase token belongs to, verified by Supabase, or null. */
async function accountFrom(token: string): Promise<{ id: string; email: string } | null> {
  try {
    const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
      headers: { apikey: env('SUPABASE_ANON_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return null
    const user = await res.json()
    return user?.id ? { id: String(user.id), email: String(user.email || '') } : null
  } catch {
    return null
  }
}

/** A database function, as the service role. Throws on a refusal. */
async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  })
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

/** The device key the table keeps: SHA-256 of the salt and the install number, in hex. */
async function deviceKey(device: string): Promise<string> {
  const salt = env('TRIAL_DEVICE_SALT') || 'fractal-remote-trial'
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${device}`))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** RevenueCat, with the project's secret key, or null when it did not answer. */
async function rcJson(path: string): Promise<any> {
  try {
    const res = await fetch(`${RC}/projects/${env('REVENUECAT_PROJECT') || DEFAULT_PROJECT}${path}`, {
      headers: { Authorization: `Bearer ${env('REVENUECAT_SECRET')}`, Accept: 'application/json' }
    })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

/**
 * When this account bought the App Store's free trial item, in ms, or null
 * when it has none (or RevenueCat did not say). RevenueCat names a purchase's
 * product by its own id (prod…), so the project's products are read to find
 * which of its ids is the store's trial_7day; the store's name itself is
 * accepted too.
 *
 * A TEST PURCHASE STARTS IT NOW. Apple's reviewers, and TestFlight, buy with
 * test Apple IDs, and RevenueCat marks what they buy `environment:
 * "sandbox"` (its V2 purchase object: "production" or "sandbox", the field
 * grant-access already reads to tell a test purchase from a sale). A
 * reviewer's test Apple ID may have bought trial_7day weeks before, while
 * the item itself was in review, and by its date that trial would be over
 * before it began: "This Apple ID has had its free trial already", a
 * purchase that looks broken (guideline 2.1). So a sandbox purchase counts
 * as bought at `now`, and the trial runs its seven days from the tap. A real
 * purchase keeps the rule exactly: when there is one, the oldest real one is
 * the date, and a test one never moves it.
 */
async function storeTrialAt(account: string, now: number): Promise<number | null> {
  const bought = await rcJson(`/customers/${encodeURIComponent(account)}/purchases?limit=100`)
  const items: any[] = bought?.items || []
  if (!items.length) return null
  const products = await rcJson('/products?limit=100')
  const ids = new Set<string>([TRIAL_PRODUCT_ID])
  for (const p of products?.items || []) if (p?.store_identifier === TRIAL_PRODUCT_ID && p?.id) ids.add(String(p.id))
  const trials = items.filter((p) => ids.has(String(p?.product_id || '')) && p?.status !== 'refunded')
  const times = trials
    .filter((p) => p?.environment !== 'sandbox')
    .map((p) => (typeof p?.purchased_at === 'number' ? p.purchased_at : null))
    .filter((t): t is number => t !== null)
  if (times.length) return Math.min(...times)
  return trials.some((p) => p?.environment === 'sandbox') ? now : null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  const auth = req.headers.get('Authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  const who = token ? await accountFrom(token) : null
  if (!who) return json({ ok: false, why: 'signed-out', trial: null }, 401)

  let input: Record<string, unknown> = {}
  try {
    input = (await req.json()) || {}
  } catch {
    return json({ ok: false, why: 'bad request', trial: null }, 400)
  }
  if (input.action !== 'start') return json({ ok: false, why: 'bad request', trial: null }, 400)
  const platform = String(input.platform || '')
  if (!deviceIdOk(input.device)) return json({ ok: false, why: 'no device', trial: null }, 400)

  /* An iPhone's trial is the App Store's free item, bought; nothing else starts it there. */
  const now = Date.now()
  const storeAt = platform === 'ios' ? await storeTrialAt(who.id, now) : null
  const plan = trialStart({ platform, storeAt, now })
  if (!plan.ok) return json({ ok: false, why: plan.why, trial: null })

  try {
    const said = (await rpc('start_trial', {
      uid: who.id,
      device: await deviceKey(String(input.device)),
      from_platform: platform,
      from_source: plan.source,
      began: new Date(plan.startedAt).toISOString(),
      ends: new Date(plan.endsAt).toISOString()
    })) as Record<string, unknown> | null
    const trial = trialAnswer(said)
    console.log(`trial: ${said?.ok ? 'started' : `not started (${said?.why})`} on ${platform}`)
    return json({ ok: Boolean(said?.ok), why: said?.ok ? undefined : String(said?.why || 'failed'), trial })
  } catch (err) {
    console.error(`trial: could not start (${err})`)
    return json({ ok: false, why: 'failed', trial: null }, 500)
  }
})
