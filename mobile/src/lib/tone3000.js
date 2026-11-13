/*
 * TONE3000: SIGNING IN, PICKING A TONE ON ITS OWN PAGE, AND FETCHING IT.
 *
 * "Next I want to add TONE3000 so users can search, preview and download
 * tones for the NAM block directly in the app." (Justin, 13 November 2026.)
 * His HeadRush app has it because that board talks to TONE3000 itself; a
 * Fractal unit has no internet, so here the app does the talking, with
 * TONE3000's own API and the key TONE3000 issued for Fractal Remote.
 *
 * THE WAY IN IS TONE3000'S "SELECT" FLOW (their documentation's first
 * choice for an app like this, and what their own examples use): the app
 * opens TONE3000's page, the player signs in there, browses, searches and
 * auditions on TONE3000's own players, and picks; TONE3000 sends the phone
 * back to the app with a one-time code and the tone picked. The app swaps
 * the code for a pass, and with the pass asks for the tone and its
 * captures. Everything browsed is TONE3000's page, under TONE3000's name,
 * which is what their terms ask of an integration.
 *
 * NO NEW BUILD. The page opens in the phone's browser and comes back
 * through the app's own link (fractalremote://tone3000, registered on the
 * key). An in-app page, with TONE3000's native preview player, is their
 * example for a phone app too, and needs native pieces: the next build.
 *
 * EVERY ADDRESS, FIELD AND ANSWER HERE IS AS TONE3000'S OWN EXAMPLE CLIENT
 * HAS IT (github.com/tone-3000/api, web/src/tone3000-client.ts, read 13
 * November 2026), not from memory: the authorize address and its
 * parameters, the token exchange as a form post, `expires_in` in seconds,
 * the callback's `code`, `state`, `tone_id`, `error` and `canceled`, the
 * refresh a minute early with one refresh at a time, one retry on a 401,
 * and a 400 or 401 from a refresh as the end of the sign-in.
 *
 * THE KEY BELOW IS THE PUBLISHABLE ONE ("t3k_pub_", the client id), which
 * TONE3000 makes to be shipped inside apps. The secret key ("t3k_cs_") is
 * never in this app, this repository or anything sent from a phone.
 *
 * WHAT A BROWSER HAS AND THE PHONE'S ENGINE HAS NOT: SHA-256 (lib/sha256),
 * and a guaranteed source of random bytes. `randomBytes` uses the engine's
 * own when it has one and falls back to the ordinary random numbers when it
 * has not: the one-time word then is harder to guess than `state` alone
 * makes it, not as hard as it should be, and the secure source comes with
 * the build that brings the in-app page.
 *
 * This file imports only lib/sha256. What touches the phone (storage, the
 * browser, the network) is handed in, so every step here runs in the tests.
 */
import { base64url, sha256, utf8 } from './sha256.js'

export const T3K_ORIGIN = 'https://www.tone3000.com'
/** The publishable key TONE3000 issued for Fractal Remote: the OAuth client id. Never the secret one. */
export const T3K_KEY = 't3k_pub_I1pEp3GxexaQ1zuYWEmGzQRtIdsBUwiW'
/** Where TONE3000 sends the phone back to: the app's own link, registered on the key. */
export const T3K_REDIRECT = 'fractalremote://tone3000'
/** What their terms ask an integration to say. */
export const T3K_POWERED = 'Powered by TONE3000'

/** Where a sign-in under way, and the pass, are kept on the device. */
export const T3K_PENDING_KEY = 'fractal.tone3000.pending'
export const T3K_TOKENS_KEY = 'fractal.tone3000.tokens'
/** A sign-in started and never finished is forgotten after this long. */
export const T3K_PENDING_MS = 30 * 60 * 1000
/** The pass is renewed this long before it runs out, as TONE3000's examples do. */
export const T3K_EARLY_MS = 60 * 1000

/** A list of pairs as the query of a web address. Written out: the phone's own URL tools are not all there. */
export const queryOf = (pairs) =>
  pairs
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')

/** `count` random bytes: the engine's own secure source where it has one, the ordinary one where it has not (see the head of this file). */
export function randomBytes(count, source = globalThis.crypto) {
  const out = new Array(count)
  if (source && typeof source.getRandomValues === 'function') {
    const got = source.getRandomValues(new Uint8Array(count))
    for (let i = 0; i < count; i++) out[i] = got[i]
    return out
  }
  for (let i = 0; i < count; i++) out[i] = Math.floor(Math.random() * 256)
  return out
}

/** The proof for a one-time word: its SHA-256 in web-address base64 (PKCE "S256", RFC 7636). */
export const challengeOf = (verifier) => base64url(sha256(utf8(verifier)))

/**
 * The address that opens TONE3000's page to pick a tone: NAM captures of
 * the A2 kind (what the Axe-Fx III's NAM block plays; left out, TONE3000
 * answers with the older kind only), its audition players on, and its own
 * back and close buttons, whose close comes back to the app as `canceled`.
 */
export function authorizeUrl({ challenge, state, key = T3K_KEY, redirect = T3K_REDIRECT }) {
  return `${T3K_ORIGIN}/api/v1/oauth/authorize?${queryOf([
    ['client_id', key],
    ['redirect_uri', redirect],
    ['response_type', 'code'],
    ['code_challenge', challenge],
    ['code_challenge_method', 'S256'],
    ['state', state],
    ['prompt', 'select_tone'],
    ['format', 'nam'],
    ['architecture', '2'],
    ['preview', 'true'],
    ['menubar', 'true']
  ])}`
}

/**
 * What TONE3000 sent back, out of the link that reopened the app, or null
 * for any link that is not TONE3000's return (the Siri links are the same
 * scheme, and are lib/siri's).
 */
export function readCallback(url, redirect = T3K_REDIRECT) {
  const text = String(url || '')
  if (text !== redirect && !text.startsWith(`${redirect}?`) && !text.startsWith(`${redirect}/?`) && !text.startsWith(`${redirect}#`)) return null
  const at = text.indexOf('?')
  const query = at < 0 ? '' : text.slice(at + 1).split('#')[0]
  const got = {}
  for (const part of query.split('&')) {
    if (!part) continue
    const eq = part.indexOf('=')
    const k = eq < 0 ? part : part.slice(0, eq)
    const v = eq < 0 ? '' : part.slice(eq + 1)
    try {
      got[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '))
    } catch {
      // A value that is not proper encoding is left out; the state check refuses a callback without one.
    }
  }
  return {
    code: got.code || null,
    state: got.state || null,
    error: got.error || null,
    toneId: got.tone_id || null,
    canceled: got.canceled === 'true'
  }
}

/** A failure with words for the screen and, where there is one, the status the server gave. */
const failure = (message, status = null) => Object.assign(new Error(message), { status })

/** What a licence code is called. Shown beside the creator's name, never left out (their terms). */
export const T3K_LICENSES = Object.freeze({
  t3k: 'TONE3000 licence',
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
  'cc-by-nc': 'CC BY-NC',
  'cc-by-nc-sa': 'CC BY-NC-SA',
  'cc-by-nd': 'CC BY-ND',
  'cc-by-nc-nd': 'CC BY-NC-ND',
  cco: 'CC0'
})
export const licenseSaid = (code) => T3K_LICENSES[code] || (code ? String(code) : 'Licence not stated')

/** One line about a tone: who made it and under what licence. */
export const toneCredit = (tone) => `by ${tone?.user?.username || 'an unnamed creator'} · ${licenseSaid(tone?.license)}`

/**
 * The client. `fetch`, `store` ({ get, set, remove }, each a promise, values
 * as strings), `open` (opens a web address), `now` and `random` are handed
 * in; lib/tone3000Here gives it the phone's.
 */
export function tone3000({ fetch, store, open, now = () => Date.now(), random = randomBytes, key = T3K_KEY, redirect = T3K_REDIRECT }) {
  let refreshing = null

  const kept = async (name) => {
    try {
      const raw = await store.get(name)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
  const keep = (name, value) => store.set(name, JSON.stringify(value))

  const tokensFrom = (data) => {
    if (!data || typeof data.access_token !== 'string' || !data.access_token) throw failure('TONE3000 answered without a pass.')
    return {
      access: data.access_token,
      refresh: typeof data.refresh_token === 'string' ? data.refresh_token : null,
      until: now() + Math.max(0, Number(data.expires_in) || 0) * 1000
    }
  }

  const tokenPost = async (pairs) => {
    const res = await fetch(`${T3K_ORIGIN}/api/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: queryOf(pairs)
    })
    return res
  }

  /** Whether a pass is kept on this device. */
  const signedIn = async () => !!(await kept(T3K_TOKENS_KEY))?.access

  /** Forget the pass and any sign-in under way. */
  async function signOut() {
    refreshing = null
    await store.remove(T3K_TOKENS_KEY)
    await store.remove(T3K_PENDING_KEY)
  }

  /**
   * Start: a fresh one-time word and state, kept on the device for the
   * return (the app may be closed while the browser is in front), and
   * TONE3000's page opened.
   */
  async function start() {
    const verifier = base64url(random(32))
    const state = base64url(random(16))
    await keep(T3K_PENDING_KEY, { verifier, state, at: now() })
    const url = authorizeUrl({ challenge: challengeOf(verifier), state, key, redirect })
    await open(url)
    return url
  }

  /**
   * Finish: TONE3000's return, checked against the sign-in that was started
   * here, and its code swapped for a pass. The one-time word is forgotten
   * whatever happens, so a return played twice is refused the second time.
   *
   * `{ ok: true, toneId, canceled }` (a pick, or signed in and closed
   * without one), `{ ok: false, why }`, or null for a link that is not
   * TONE3000's or has no sign-in waiting for it.
   */
  async function finish(url) {
    const back = readCallback(url, redirect)
    if (!back) return null
    const pending = await kept(T3K_PENDING_KEY)
    if (!pending) return null
    await store.remove(T3K_PENDING_KEY)
    if (now() - (Number(pending.at) || 0) > T3K_PENDING_MS) return { ok: false, why: 'That sign-in was started too long ago. Start again.' }
    if (!back.state || back.state !== pending.state) return { ok: false, why: 'That return from TONE3000 doesn’t match the sign-in this device started. Start again.' }
    if (back.canceled && !back.code) return { ok: false, why: 'Closed without signing in.', canceled: true }
    if (back.error) return { ok: false, why: `TONE3000 said: ${back.error}.` }
    if (!back.code) return { ok: false, why: 'TONE3000 came back without a code. Start again.' }
    let res
    try {
      res = await tokenPost([
        ['grant_type', 'authorization_code'],
        ['code', back.code],
        ['code_verifier', pending.verifier],
        ['redirect_uri', redirect],
        ['client_id', key]
      ])
    } catch {
      return { ok: false, why: 'TONE3000 couldn’t be reached to finish signing in. Check the internet and start again.' }
    }
    if (!res.ok) {
      const said = await res.json().catch(() => ({}))
      return { ok: false, why: `TONE3000 refused the sign-in (${said?.error || res.status}). Start again.` }
    }
    try {
      await keep(T3K_TOKENS_KEY, tokensFrom(await res.json()))
    } catch (err) {
      return { ok: false, why: err?.message || 'TONE3000 answered without a pass.' }
    }
    return { ok: true, toneId: back.toneId, canceled: back.canceled }
  }

  /** The pass to send, renewed first when it is about to run out. One renewal at a time. */
  async function pass({ force = false } = {}) {
    const tokens = await kept(T3K_TOKENS_KEY)
    if (!tokens?.access) throw failure('Not signed in to TONE3000.', 401)
    if (!force && now() <= tokens.until - T3K_EARLY_MS) return tokens.access
    if (!tokens.refresh) {
      if (!force && now() < tokens.until) return tokens.access
      await signOut()
      throw failure('The TONE3000 sign-in has run out. Sign in again.', 401)
    }
    if (!refreshing) {
      refreshing = (async () => {
        const res = await tokenPost([
          ['grant_type', 'refresh_token'],
          ['refresh_token', tokens.refresh],
          ['client_id', key]
        ])
        if (!res.ok) {
          /* 400 or 401: the sign-in is over. Anything else (the network, a 5xx) keeps it for another try. */
          if (res.status === 400 || res.status === 401) {
            await signOut()
            throw failure('The TONE3000 sign-in has run out. Sign in again.', 401)
          }
          throw failure('TONE3000 couldn’t renew the sign-in just now. Try again.', res.status)
        }
        const fresh = tokensFrom(await res.json())
        /* A renewal that sends no new renewing word keeps the old one. */
        if (!fresh.refresh) fresh.refresh = tokens.refresh
        await keep(T3K_TOKENS_KEY, fresh)
        return fresh.access
      })().finally(() => {
        refreshing = null
      })
    }
    return refreshing
  }

  /** One request with the pass; on a 401, once more with a renewed one. `at` is a path, or a whole address on TONE3000's own site. */
  async function ask(at, what) {
    const address = /^https?:\/\//.test(at) ? at : `${T3K_ORIGIN}${at}`
    /* The pass goes to TONE3000 and nowhere else, whatever address a model says it is at. */
    if (address !== T3K_ORIGIN && !address.startsWith(`${T3K_ORIGIN}/`)) throw failure(`${what} is not at TONE3000, so it wasn’t asked for.`)
    let res = await fetch(address, { headers: { Authorization: `Bearer ${await pass()}` } })
    if (res.status === 401) res = await fetch(address, { headers: { Authorization: `Bearer ${await pass({ force: true })}` } })
    if (!res.ok) {
      if (res.status === 429) throw failure('TONE3000 says that’s too many requests for now. Wait a minute.', 429)
      if (res.status === 404) throw failure(`${what} isn’t on TONE3000 any more, or isn’t yours to open.`, 404)
      throw failure(`TONE3000 couldn’t answer for ${what} (${res.status}).`, res.status)
    }
    return res
  }

  /** A tone, by the id the pick came back with. */
  const tone = async (id) => (await ask(`/api/v1/tones/${encodeURIComponent(String(id))}?architecture=2`, 'That tone')).json()

  /** A tone's A2 captures: `[{ id, name, size, model_url, architecture_version }]`. */
  async function models(toneId) {
    const got = await (await ask(`/api/v1/models?${queryOf([['tone_id', toneId], ['architecture', '2'], ['page_size', 100]])}`, 'That tone’s captures')).json()
    return Array.isArray(got?.data) ? got.data.filter((m) => m && m.id != null && typeof m.model_url === 'string') : []
  }

  /**
   * One capture's file, as its text. Asked for only when somebody asks for
   * that capture (their terms: no fetching ahead). `model_url` is a whole
   * address; as in TONE3000's own client, its path is asked of TONE3000's
   * site, so the pass never goes to whatever host an address names.
   */
  const modelText = async (model) => (await ask(String(model?.model_url || '').replace(/^https?:\/\/[^/]+/, ''), 'That capture')).text()

  return { start, finish, signedIn, signOut, tone, models, modelText }
}
