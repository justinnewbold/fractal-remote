import { DEFAULT_PROJECT } from './project'
import { supabaseClient } from './relay'
import { logDebug } from './debugLog'

/**
 * Tell the relay this account has paid.
 *
 * The relay decides who may use it from a table on the server —
 * public.entitlements — rather than from anything on this phone, because
 * anything on this phone can be edited by whoever holds it. That table is kept
 * right from two directions: RevenueCat's webhook, the moment a purchase
 * happens, and this, whenever the app has reason to think the answer changed.
 *
 * This is the half that makes a missed webhook harmless. The function it calls
 * asks RevenueCat itself — this phone's word counts for nothing — and writes
 * the row from whatever RevenueCat says. So the worst a lost webhook can cost a
 * paying customer is the few seconds until their app next opens.
 *
 * Called when an account is linked (launch and sign-in), after a purchase, and
 * after a restore. Nothing waits on it: it is housekeeping on a server, and
 * the screen already knows the answer from the store.
 *
 * NEVER THROWS, and gives up quickly. A stage is exactly where the line is
 * worst, and a rejected promise here must not be the thing that goes wrong.
 */
const GIVE_UP_MS = 8000

/*
 * WHO IS TOLD WHAT THE SERVER SAID ABOUT THE FREE TRIAL: purchases.js, which
 * keeps the end it heard for the account signed in (shared/trial-rule.mjs
 * keptTrial). Set rather than imported, so this file does not import the
 * one that imports it.
 */
let trialHeard = null
export const hearTrial = (fn) => {
  trialHeard = fn
}

/**
 * ASK THE SERVER TO START THE FREE TRIAL (supabase/functions/trial), for the
 * account signed in. `device` is this install's number, `platform` 'ios' or
 * 'android'. On an iPhone the App Store's free item has been bought first;
 * the server checks that itself.
 *
 * Never throws: { ok, why, trial }, and `why` 'offline' when it could not be
 * asked at all.
 */
export async function askForTrial({ device, platform }) {
  const controller = new AbortController()
  const stop = setTimeout(() => controller.abort(), GIVE_UP_MS * 2)
  try {
    const { data } = await supabaseClient().auth.getSession()
    const token = data?.session?.access_token
    if (!token) return { ok: false, why: 'signed-out', trial: null }
    const res = await fetch(`${DEFAULT_PROJECT.url}/functions/v1/trial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: DEFAULT_PROJECT.anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'start', device, platform }),
      signal: controller.signal
    })
    const body = await res.json().catch(() => null)
    logDebug(`trial: ${res.status} ${body?.ok ? 'started' : `not started (${body?.why || 'no answer'})`}`)
    if (!body || typeof body.ok !== 'boolean') return { ok: false, why: 'offline', trial: null }
    if (body.trial) trialHeard?.(data?.session?.user?.id || null, body.trial)
    return { ok: body.ok, why: body.why || null, trial: body.trial || null }
  } catch (err) {
    logDebug(`trial: could not ask (${err?.message || err})`)
    return { ok: false, why: 'offline', trial: null }
  } finally {
    clearTimeout(stop)
  }
}

export async function claimRelay() {
  const controller = new AbortController()
  const stop = setTimeout(() => controller.abort(), GIVE_UP_MS)
  try {
    const { data } = await supabaseClient().auth.getSession()
    const token = data?.session?.access_token
    if (!token) return false
    const res = await fetch(`${DEFAULT_PROJECT.url}/functions/v1/entitlement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: DEFAULT_PROJECT.anonKey,
        /* The SESSION's token, not the anon key: the function reads who is
           asking out of it, verified by Supabase, and that is the whole
           reason this cannot be used to unlock somebody else. */
        Authorization: `Bearer ${token}`
      },
      body: '{}',
      signal: controller.signal
    })
    const body = await res.json().catch(() => ({}))
    logDebug(`relay pass: ${res.status} ${body?.unlocked ? 'paid' : 'not paid'}${body?.unknown ? ' (store unreachable)' : ''}`)
    /* And the free trial beside it, when the server says (a definite answer
       from a server new enough to know): purchases.js keeps its end. */
    if (res.ok && body && 'trial' in body) trialHeard?.(data?.session?.user?.id || null, body.trial)
    return Boolean(body?.unlocked)
  } catch (err) {
    logDebug(`relay pass: could not ask (${err?.message || err})`)
    return false
  } finally {
    clearTimeout(stop)
  }
}
