/**
 * WHAT WORKS — read inside the app, by Justin only.
 *
 * Every note a phone sends after its owner said Yes to "Help make Fractal
 * Remote better?" lands in public.gear_reports
 * (migrations/20261026_gear_reports.sql), which no client may read back.
 * This reads it with the service role, for one caller: the owner's account,
 * proved by a token Supabase has signed. The same lock as owner-messages and
 * grant-access, on the same account id: test/gear-share.mjs holds this copy
 * to shared/admin.mjs.
 *
 *   list   the newest notes (up to 5000), every field but the row's id;
 *          the phone adds them up into Settings → Developer → What works
 *          (mobile/src/lib/gear-share-rules.js gearSections)
 *
 * Read-only, but for the two-year sweep (public.sweep_gear_reports), asked
 * for on the way, so the page never shows a note older than the privacy page
 * says is kept. Nothing here can change a note.
 */

/* His account's id, as in grant-access: never a hash of an address, which a made-up address could match. */
const ADMINS = ['7dfe6912-e43b-49bf-84e4-b56afbd442b1']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const env = (name: string) => Deno.env.get(name) || ''

/** Who is calling, from their signed token. */
async function caller(token: string): Promise<{ id: string } | null> {
  try {
    const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
      headers: { apikey: env('SUPABASE_ANON_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return null
    const user = await res.json()
    return user?.id ? { id: String(user.id) } : null
  } catch {
    return null
  }
}

const service = () => {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  return { apikey: key, Authorization: `Bearer ${key}` }
}

/** The notes, read as the service role. */
async function rows(query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/gear_reports?${query}`, { headers: service() })
  if (!res.ok) throw new Error(`gear_reports: ${res.status} ${await res.text()}`)
  return await res.json()
}

/** Anything past its two years, gone. A failure is logged and the page still answers. */
async function sweep(): Promise<void> {
  try {
    const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/sweep_gear_reports`, {
      method: 'POST',
      headers: { ...service(), 'Content-Type': 'application/json' },
      body: '{}'
    })
    if (!res.ok) console.error(`gear-reports: sweep ${res.status} ${await res.text()}`)
  } catch (err) {
    console.error(`gear-reports: sweep ${err}`)
  }
}

const LIST =
  'select=created_at,via,unit,firmware,adapter,outcome,computer_os,computer_version,phone_os,phone_os_version,phone_model,app_version&order=created_at.desc&limit=5000'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  const me = token ? await caller(token) : null
  /* The lock, before anything is read. */
  if (!me || !ADMINS.includes(me.id)) return json({ ok: false, message: 'Not allowed.' }, 403)

  let input: { action?: string } = {}
  try {
    input = await req.json()
  } catch {
    /* an empty body is a list */
  }
  if (String(input.action || 'list') !== 'list') return json({ ok: false, message: 'Unknown action.' }, 400)

  try {
    await sweep()
    return json({ ok: true, reports: await rows(LIST) })
  } catch (err) {
    console.error(`gear-reports: ${err}`)
    return json({ ok: false, message: 'The gear notes could not be read just now.' }, 502)
  }
})
