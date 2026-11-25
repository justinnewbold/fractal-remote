/**
 * THE TRIAL EMAIL: ONE, ON A FREE TRIAL'S LAST DAY, ASKING HOW IT IS GOING.
 *
 * A trial started and never used again tells Justin nothing (25 November
 * 2026). So each trial gets one plain email from him near its end, asking
 * whether anything stopped them, with replies coming to him. And for
 * somebody who never got a unit connected, a week more by itself, said in
 * the same email. Never more than the one email a trial.
 *
 * WHICH EMAIL IS THE SHARED RULE'S, NOT THIS FILE'S: nudgePlan in
 * ../_shared/trial-rule.mjs (shared/trial-rule.mjs is the source; a test runs
 * every case). In short:
 *
 *   never connected, not an iPhone or iPad   a week is added
 *   (extend_trial, 'auto'), and the email    (extendedEmail)
 *   says so, no card needed
 *   an iPhone or iPad's trial, or an         the email asks, and offers more
 *   account that has connected a unit        time for a reply (askEmail)
 *
 * An iPhone or iPad's trial is never extended here: Apple's guideline 3.1.1
 * allows a free trial in an app that is not a subscription only as an item
 * named for its length ("7-Day Trial"). More time there is Justin's to give
 * by hand (grant-access 'extend-trial') when somebody replies.
 *
 * CALLED BY THE DATABASE, once an hour (run_trial_nudges in
 * supabase/migrations/20261125_trial_extensions.sql), never by an app.
 * `verify_jwt` is off because the caller is Postgres, so the gate is the
 * x-hook-secret header: a secret the database made and this reads back
 * through an RPC only service_role may call, exactly as setup-reminder does.
 * Compared in full, and both halves must exist.
 *
 * WHO IS DUE IS THE DATABASE'S RULE: trial_nudges_due() says who, and
 * claim_trial_nudge() checks that rule again at the moment of asking and
 * writes down that the email went, so asking is claiming and two runs at
 * once cannot both send. This file only sends what it has claimed, and only
 * adds a week to a trial it has claimed.
 *
 * SWITCHED OFF UNTIL JUSTIN SAYS. With the switch off (trial_nudge_switch,
 * off to begin with) or no RESEND_API_KEY, a run only counts how many WOULD
 * go: it sends nothing and extends nobody. The claim reads the switch again
 * before every email, so turning it off in the middle of a run stops that
 * run at the next one.
 *
 * A REFUSAL STOPS THE RUN, sorted as setup-reminder sorts it (refusalOf):
 * only a refusal of the person's own address is held against the account
 * ('refused', never tried again); a wrong key or a limit takes the claim
 * back, and the next hour tries again; a fault on the mail service's side
 * may have gone, so the claim stays and it reads as sent.
 *
 * NO ADDRESS EVER LEAVES THIS FILE except as the recipient of the email
 * itself: not in an answer, not in a log line. Counts, and account ids in
 * the log when something is refused.
 *
 * And one more caller: grant-access, with the service-role key Supabase
 * gives every function here, may ask for 'sample' and nothing else: both
 * emails, marked [Sample], to the reply address, which is Justin's own
 * inbox. That is how he reads the words before turning the email on. It
 * touches nothing in the database, with the switch on or off.
 *
 * WHAT HAS TO BE SET, in Supabase → Edge Functions → Secrets (the setup
 * emails' own, so nothing new):
 *
 *   RESEND_API_KEY   already set
 *   SETUP_FROM       optional; noreply@newbold.cloud, which is verified
 *   SETUP_REPLY_TO   optional; where replies go, Justin's gmail by default
 */
import { TRIAL_EXTRA_DAYS, nudgePlan } from '../_shared/trial-rule.mjs'

const RESEND = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Fractal Remote <noreply@newbold.cloud>'
/** Where a reply lands: Justin. The address on the support and privacy pages. */
const DEFAULT_REPLY_TO = 'justinnewbold@gmail.com'
/** A run's most. */
const AT_MOST = 25
/* Resend takes a couple of requests a second; one at a time with a gap stays under it. */
const GAP_MS = 700
/* The same strict rule as setup-reminder's: one address, nothing that makes a list. */
const LOOKS_LIKE_EMAIL = /^[^@\s,;<>"]+@[^@\s,;<>".]+\.[^@\s,;<>"]{2,}$/
/*
 * NEVER APPLE'S REVIEW LOGIN, whose address has no mailbox (setup-reminder
 * says the whole of why). Named by the sha256 of its trimmed, lower-case
 * address, never the address (shared/admin.mjs REVIEW_LOGINS is the source;
 * a test holds this copy to it).
 */
const REVIEW_LOGINS = ['132dcf3f4a48ad6cad50a6389e88c02c2f27a09e3ec89f92b67987a1d592acb9']

async function isReviewLogin(address: string): Promise<boolean> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address.trim().toLowerCase()))
  return REVIEW_LOGINS.includes([...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join(''))
}

const env = (name: string) => Deno.env.get(name) || ''

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Nothing reaches the email as markup but what is written here. */
const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** A database function, as the service role. Its error is its name and status only: an answer could carry an address. */
async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  })
  if (!res.ok) throw new Error(`${name} answered ${res.status}`)
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    /* Not the parser's own message, which quotes what it could not read. */
    throw new Error(`${name} answered something that is not JSON`)
  }
}

/** The secret the schedule sends, read from where the database keeps it. Only a good read is kept. */
let cachedSecret: string | null = null
async function hookSecret(): Promise<string | null> {
  if (cachedSecret) return cachedSecret
  if (!env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) return null
  try {
    const value = await rpc('trial_nudge_hook_secret', {})
    if (typeof value === 'string' && value) cachedSecret = value
    return cachedSecret
  } catch (err) {
    console.error(`trial-nudge: could not read the hook secret (${String((err as Error)?.message || err).slice(0, 80)})`)
    return null
  }
}

/* -------------------------------------------------------------- the words */

/** Which of the two emails: 'extend' says a week was added, 'ask' offers more time for a reply. */
export type Kind = 'ask' | 'extend'

/**
 * THE TWO EMAILS, every word fixed here. The only thing from outside is the
 * address, which is the account's own and is only ever escaped into it.
 *
 * Short, and in Justin's own voice: a question, not a pitch. No price, no
 * button, no unit named (the email cannot tell which they have), and never
 * a day of the week or a date: a trial's last day is "nearly over" in every
 * time zone. `days` is the week the 'extend' email says was added.
 */
export function nudgeEmail(kind: Kind, email: string, days: number = TRIAL_EXTRA_DAYS): { subject: string; text: string; html: string } {
  const who = String(email || '').trim()
  const extend = kind === 'extend'
  const subject = extend ? `${days} more days of Fractal Remote, on me` : 'How is Fractal Remote going?'
  const opening = extend
    ? 'Thanks for trying Fractal Remote. Your free trial was nearly over, and it looks like the app hasn’t connected to your Fractal yet.'
    : 'Thanks for trying Fractal Remote. Your free trial is nearly over, and I wanted to ask how it’s going.'
  const middle = extend
    ? `So I’ve added ${days} more days to your trial. There’s nothing to do and no card needed: open the app and it carries on.`
    : 'Is it doing what you hoped? Did anything stop you, or was something confusing?'
  const ask = extend
    ? 'Did something get in the way of connecting, or was anything confusing? Reply to this email and tell me. It comes straight to me, and I’ll help you get it going.'
    : 'Reply to this email and tell me. It comes straight to me.'
  /* Only the email that added nothing offers more: the other has just given it. */
  const more = extend ? null : 'And if you’d like more time to try it, reply to this email and I’ll add some.'
  const why = `You’re getting this because ${who} started a free trial of Fractal Remote. It’s the only email I’ll send about your trial.`

  const text = ['Hi,', '', opening, '', middle, '', ask, '', ...(more ? [more, ''] : []), 'Justin', 'Fractal Remote', '', '--', why].join('\n')

  const p = (t: string, style = 'margin:0 0 16px') => `<p style="${style}">${esc(t)}</p>`
  const html = `
    <div style="font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1d21;max-width:560px">
      ${p('Hi,')}
      ${p(opening)}
      ${p(middle)}
      ${p(ask)}${more ? `\n      ${p(more)}` : ''}
      ${p('Justin', 'margin:0')}
      ${p('Fractal Remote', 'margin:0 0 24px;color:#5f6670')}
      ${p(why, 'margin:0;color:#8b9099;font-size:13px')}
    </div>`
  return { subject, text, html }
}

/**
 * THE SAME EMAIL ASKED FOR TWICE IS STILL ONE EMAIL: every real send carries
 * an Idempotency-Key made of which email and whose account (the id, never
 * the address), which Resend keeps for a day (setup-reminder's onceKey says
 * the whole of why). Never on a sample.
 */
export const onceKey = (kind: Kind, account: string) => `trial-nudge/${kind}/${account}`

/* What Resend's refusal was about, read to sort it and then dropped (setup-reminder's readRefusal, word for word). */
const TO_FIELD = /[`'"]to[`'"]|(?:^|[^\w])to\s+field\b/i
export function readRefusal(text: string): { name: string; toField: boolean } {
  let said: any = null
  try {
    said = JSON.parse(text)
  } catch {
    /* not JSON: about nothing */
  }
  const raw = said && typeof said === 'object' ? said.name : undefined
  const name = typeof raw === 'string' && /^[a-z_]{1,64}$/.test(raw) ? raw : ''
  const message = said && typeof said === 'object' && typeof said.message === 'string' ? said.message : ''
  return { name, toField: TO_FIELD.test(message) && (raw === undefined || raw === 'validation_error') }
}

/** One email through Resend. Never throws: a failure is { ok: false } with the status (0 for no answer at all). */
async function send(key: string, to: string, kind: Kind, how: { account?: string; sample?: boolean }): Promise<{ ok: boolean; status: number; name?: string; toField?: boolean }> {
  const words = nudgeEmail(kind, to)
  const sample = how.sample === true
  const once = !sample && how.account ? onceKey(kind, how.account) : null
  try {
    const res = await fetch(RESEND, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(once ? { 'Idempotency-Key': once } : {}) },
      body: JSON.stringify({
        from: env('SETUP_FROM') || DEFAULT_FROM,
        to: [to],
        reply_to: env('SETUP_REPLY_TO') || DEFAULT_REPLY_TO,
        subject: sample ? `[Sample] ${words.subject}` : words.subject,
        text: words.text,
        html: words.html
      })
    })
    /* Read for sorting only, and dropped: Resend's answer to a refusal can repeat the address. */
    const text = await res.text().catch(() => '')
    if (res.ok) return { ok: true, status: res.status }
    return { ok: false, status: res.status, ...readRefusal(text) }
  } catch {
    return { ok: false, status: 0 }
  }
}

/**
 * WHAT A REFUSAL MEANS, by the status Resend answered (setup-reminder's
 * refusalOf, which says each case in full):
 *
 *   'this email'     a 400 or 422 about the `to` field: this person's
 *                    address. Kept ('refused'), never tried again.
 *   'mail service'   the request was turned away before it was taken (a 400
 *                    or 422 about anything else, a 401, 403 or 429). It did
 *                    not go: the claim is taken back, and the next hour
 *                    tries again.
 *   'may have gone'  no answer, a 5xx, or a status that does not say. The
 *                    claim stays and it reads as sent: one email missed at
 *                    worst, never the same one twice.
 */
type Refusal = 'this email' | 'mail service' | 'may have gone'
export function refusalOf(status: number, answer: { toField?: boolean } = {}): { why: Refusal; said: string } {
  if (status === 400 || status === 422) {
    if (answer.toField === true) return { why: 'this email', said: 'the mail service refused this email, for its address' }
    return { why: 'mail service', said: 'the mail service turned the request itself down, not the address (check RESEND_API_KEY and SETUP_FROM)' }
  }
  if (status === 401 || status === 403) return { why: 'mail service', said: 'the mail key was refused' }
  if (status === 429) return { why: 'mail service', said: 'the mail service’s sending limit was reached' }
  if (!status) return { why: 'may have gone', said: 'no answer from the mail service, so it may have gone and is kept as sent' }
  if (status >= 500) return { why: 'may have gone', said: 'the mail service had a fault, so it may have gone and is kept as sent' }
  return { why: 'may have gone', said: 'the mail service’s answer does not say whether it went, so it is kept as sent' }
}

const pause = (ms: number) => new Promise((go) => setTimeout(go, ms))

/** What the shared rule makes of one due row at `now`. */
const planOf = (row: any, now: number) =>
  nudgePlan({
    platform: String(row?.platform || ''),
    connected: row?.connected === true,
    endsAt: row?.ends_at ?? null,
    autoExtendedAt: row?.auto_extended_at ?? null,
    now
  })

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  /*
   * THE SAMPLE, for grant-access alone: the service-role key, which nothing
   * outside these functions holds, and 'sample' is all it may ask. Both
   * emails go to the reply address, never to an address in the request.
   */
  const auth = req.headers.get('Authorization') || ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  const service = env('SUPABASE_SERVICE_ROLE_KEY')
  if (token && service && token === service) {
    let input: { action?: string } = {}
    try {
      input = await req.json()
    } catch {
      /* no body is no action */
    }
    if (input?.action !== 'sample') return json({ ok: false, why: 'unknown action' }, 400)
    const key = env('RESEND_API_KEY')
    if (!key) return json({ ok: false, why: 'not configured' })
    const to = env('SETUP_REPLY_TO') || DEFAULT_REPLY_TO
    const sent = []
    for (const kind of ['extend', 'ask'] as Kind[]) sent.push(await send(key, to, kind, { sample: true }))
    return json({ ok: sent.every((s) => s.ok), sent: sent.filter((s) => s.ok).length })
  }

  /* The schedule, by the secret the database made. Both halves must exist. */
  const expected = await hookSecret()
  const given = req.headers.get('x-hook-secret')
  if (!expected || !given || given !== expected) return new Response('No', { status: 401 })

  try {
    const sending = (await rpc('trial_nudge_sending', {})) === true
    const key = env('RESEND_API_KEY')
    const now = Date.now()

    if (!sending || !key) {
      /* Only counts: nothing is claimed, sent or extended. */
      const due = await rpc('trial_nudges_due', { at_most: 50 })
      const plans = (Array.isArray(due) ? due : []).map((r: any) => planOf(r, now))
      const extend = plans.filter((p) => p === 'extend' || p === 'extended').length
      const ask = plans.filter((p) => p === 'ask').length
      console.log(`trial-nudge: ${sending ? 'no RESEND_API_KEY set' : 'switched off'}, nothing sent and nobody given more time; ${extend} with a week added and ${ask} asking would go`)
      return json({ sending: false, extend, ask })
    }

    const due = await rpc('trial_nudges_due', { at_most: AT_MOST })
    const rows = Array.isArray(due) ? due : []
    const done = { extend: 0, ask: 0, refused: 0, skipped: 0 }
    let stopped: { status: number; why: Refusal } | null = null
    let stoppedSaid = ''
    let sentOne = false
    for (const row of rows as any[]) {
      const plan = planOf(row, now)
      const id = String(row?.account_id || '')
      const to = String(row?.email || '').trim()
      if (plan === 'none' || !id || to.length > 254 || !LOOKS_LIKE_EMAIL.test(to) || (await isReviewLogin(to))) {
        done.skipped += 1
        continue
      }
      let kind: Kind = plan === 'ask' ? 'ask' : 'extend'
      /* Claimed first: the row says it went before it goes, so nothing is ever sent twice, and nobody unclaimed is given a week. */
      if ((await rpc('claim_trial_nudge', { uid: id, which: kind })) !== true) {
        done.skipped += 1
        continue
      }
      /*
       * THE WEEK, before the email that says it was added. 'extended' is a
       * week an earlier run added whose email did not go: said, never added
       * twice. A week the database will not add (the account bought a moment
       * ago, or has had its automatic week) is never said as added: bought,
       * the claim is taken back and nothing goes; otherwise the email asks.
       */
      if (plan === 'extend') {
        let added: { ok?: boolean; why?: string } | null = null
        try {
          added = (await rpc('extend_trial', { uid: id, days: TRIAL_EXTRA_DAYS, who: 'auto' })) as { ok?: boolean; why?: string } | null
        } catch (err) {
          /* The database did not answer: the claim is taken back if it can be, and the run ends (the catch below). */
          await rpc('release_trial_nudge', { uid: id }).catch(() => {})
          throw err
        }
        if (added?.ok !== true) {
          if (added?.why === 'had') {
            kind = 'ask'
            await rpc('note_trial_nudge_kind', { uid: id, which: 'ask' })
          } else {
            console.log(`trial-nudge: no week added for account ${id} (${String(added?.why || 'no answer').slice(0, 20)}), so no email`)
            await rpc('release_trial_nudge', { uid: id })
            done.skipped += 1
            continue
          }
        }
      }
      if (sentOne) await pause(GAP_MS)
      sentOne = true
      const out = await send(key, to, kind, { account: id })
      if (out.ok) {
        done[kind] += 1
        continue
      }
      done.refused += 1
      const { why, said } = refusalOf(out.status, out)
      /* Resend's error name is one of its snake_case words (readRefusal), never anything of the person's. */
      const status = `status ${out.status}${out.name ? `, ${out.name}` : ''}`
      if (why === 'this email') {
        console.error(`trial-nudge: stopped at the email to account ${id}: ${said} (${status}). It is not tried again.`)
        try {
          await rpc('note_trial_nudge_kind', { uid: id, which: 'refused' })
        } catch {
          console.error(`trial-nudge: could not write down the refusal for account ${id}`)
        }
      } else if (why === 'mail service') {
        console.error(`trial-nudge: the email to account ${id}: ${said} (${status}). Nothing is held against the account; the next hour tries again. The run stops here.`)
        try {
          await rpc('release_trial_nudge', { uid: id })
        } catch {
          /* The claim stays, so it reads as sent: one email missed, never one sent twice. */
          console.error(`trial-nudge: could not take back the claim for account ${id}, so it reads as sent`)
        }
      } else {
        /* 'may have gone': the claim stays, untouched, so it is never sent again. */
        console.error(`trial-nudge: stopped at the email to account ${id}: ${said} (${status}).`)
      }
      /* Stopped here: everybody after this waits for the next hour, unclaimed. */
      stopped = { status: out.status, why }
      stoppedSaid = `${said} (${status})`
      break
    }
    console.log(
      `trial-nudge: ${done.extend} with a week added and ${done.ask} asking sent, ${done.refused} refused, ${done.skipped} skipped` +
        (stopped ? `; stopped early, ${stoppedSaid}` : '')
    )
    return json({ sending: true, ...done, stopped })
  } catch (err) {
    console.error(`trial-nudge: ${String((err as Error)?.message || err).slice(0, 200)}`)
    return json({ ok: false }, 500)
  }
})
