/**
 * Delete the account that is asking, for good.
 *
 * Apple rejected 1.86.8 under Guideline 5.1.1(v): an app that lets people
 * make an account has to let them delete it from inside the app, and turning
 * it off is not enough. Deleting a Supabase account needs the service-role
 * key, which can never be in an app, so the phone asks here.
 *
 * WHO IS DELETED IS NOT UP TO THE CALLER. As in entitlement, the account id
 * comes out of the caller's own session token, verified by Supabase, never out
 * of the request body. Anything else would let one person delete another.
 *
 * WHAT GOES WITH IT, and in what order, is ../_shared/forget-account.ts:
 * every row the cascade reaches, the few keyed by an email address that it
 * cannot, the report pictures and videos, the note telling the developer
 * which report emails to delete, the account itself, then its RevenueCat
 * customer. Shared since 2 November 2026 with grant-access, which deletes an
 * account from Developer → Accounts the same way; this file keeps only the
 * part that is its own, finding out who is asking.
 *
 * The body must say {"confirm":"delete"}, so a stray or replayed call with a
 * valid token cannot delete anything by accident.
 */
import { forgetAccount } from '../_shared/forget-account.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })

async function accountFrom(url: string, key: string, token: string): Promise<{ id: string; email: string } | null> {
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return null
    const user = await res.json()
    const id = String(user?.id || '')
    return id ? { id, email: String(user?.email || '').trim().toLowerCase() } : null
  } catch (err) {
    console.error(`delete-account: could not verify the token (${err})`)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || service
  if (!url || !service || !anon) return json({ error: 'The account server is not set up.' }, 500)

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const body = await req.json().catch(() => ({}))
  if (body?.confirm !== 'delete') return json({ error: 'Not confirmed.' }, 400)

  const who = token ? await accountFrom(url, anon, token) : null
  if (!who) return json({ error: 'Sign in again, then delete the account.' }, 401)
  const id = who.id

  /* Everything that goes with it, in its order (../_shared/forget-account.ts). */
  const done = await forgetAccount(url, service, who, 'delete-account')
  if (!done.ok) return json({ error: 'The account could not be deleted. Try again in a minute.' }, 502)

  console.log(`delete-account: deleted ${id}`)
  return json({ deleted: true })
})
