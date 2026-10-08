/**
 * MESSAGES FROM USERS — read inside the app, by Justin only.
 *
 * "Messages from users. Everything people send through Troubleshooting →
 * 'tell us', readable inside the app with the log they attached, instead of
 * only arriving by email." (docs/later.md)
 *
 * Every report lands in public.feedback (migrations/20260905_feedback_email.sql),
 * which no client may read back. This reads it with the service role, for one
 * caller: the owner's account, proved by a token Supabase has signed. The
 * same lock as grant-access, on the same account id: test/mobile.mjs holds
 * both copies to shared/admin.mjs.
 *
 *   list     the newest reports, without their logs (a log can run long)
 *   message  one report, with its log
 *
 * Read-only on purpose. Nothing here changes or deletes a report.
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
async function caller(token: string): Promise<{ id: string; email: string } | null> {
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

/** The feedback table, read as the service role. */
async function rows(query: string): Promise<Record<string, unknown>[]> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/feedback?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  })
  if (!res.ok) throw new Error(`feedback: ${res.status} ${await res.text()}`)
  return await res.json()
}

const LIST = 'select=id,created_at,kind,message,contact,context,user_id,has_log:log&order=created_at.desc&limit=150'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  const me = token ? await caller(token) : null
  /* The lock, before anything is read. */
  if (!me || !ADMINS.includes(me.id)) return json({ ok: false, message: 'Not allowed.' }, 403)

  let input: { action?: string; id?: string } = {}
  try {
    input = await req.json()
  } catch {
    /* an empty body is a list */
  }
  const action = String(input.action || 'list')

  try {
    if (action === 'list') {
      const found = await rows(LIST)
      /* A log is only said to exist here; it is fetched with the one report. */
      const messages = found.map((r) => ({ ...r, has_log: Boolean(r.has_log) }))
      return json({ ok: true, messages })
    }
    if (action === 'message') {
      const id = String(input.id || '')
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, message: 'No such report.' }, 400)
      const [one] = await rows(`select=*&id=eq.${id}&limit=1`)
      return one ? json({ ok: true, message: one }) : json({ ok: false, message: 'No such report.' }, 404)
    }
    return json({ ok: false, message: 'Unknown action.' }, 400)
  } catch (err) {
    console.error(`owner-messages: ${err}`)
    return json({ ok: false, message: 'The reports could not be read just now.' }, 502)
  }
})
