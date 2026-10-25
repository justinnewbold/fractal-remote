/**
 * THE SETUP EMAIL: ONE A DAY AFTER THE FULL VERSION, IF NO COMPUTER HAS
 * SIGNED IN, AND AT MOST ONE REMINDER.
 *
 * "Get new buyers past 'no computer yet.' About 12 of your first 40 paying
 * customers never got the computer app signed in. ... one friendly email a
 * day after buying if no computer has signed in" — approved 15 October 2026,
 * with: the email goes only if no computer has signed in yet, replies come
 * to Justin, at most one reminder after that.
 *
 * CALLED BY THE DATABASE, once an hour (supabase/migrations/
 * 20261015_setup_reminders_schedule.sql), never by an app. `verify_jwt` is
 * off because the caller is Postgres, so the gate is the x-hook-secret header:
 * a secret the database made and this reads back through an RPC only
 * service_role may call, exactly as feedback-email does. Compared in full, and
 * both halves must exist.
 *
 * WHO GETS ONE IS THE DATABASE'S RULE, NOT THIS FILE'S. setup_reminders_due()
 * says who is due and which email; claim_setup_reminder() checks that rule
 * again at the moment of asking and writes down that it went, so asking is
 * claiming and two runs at once cannot both send. This file only sends what
 * it has claimed.
 *
 * A REFUSAL STOPS THE RUN, and only a refusal of the person's own address
 * is held against the account (refusalOf, below, says which is which). A
 * wrong mail key turned every due buyer into "refused for good" in one run
 * before this, and then, sorted by status alone, one an hour: now it
 * costs nobody anything, and the next hour tries again. A fault on the mail
 * service's side is the other way round: it can come back after the email
 * was taken, so that one stays claimed and reads as sent. A missed first
 * email still has its reminder to come; a second copy would be three.
 *
 * SWITCHED OFF UNTIL JUSTIN SAYS. With the switch off (setup_reminder_switch,
 * off to begin with) or no RESEND_API_KEY, a run still looks — so the record
 * of which accounts have had a computer keeps up — and answers how many WOULD
 * go, and sends nothing. The claim reads the switch again before every email,
 * so turning it off in the middle of a run stops that run at the next one.
 *
 * NO ADDRESS EVER LEAVES THIS FILE except as the recipient of the email
 * itself: not in an answer, not in a log line. Counts, and account ids in the
 * log when something is refused, the way grant-access logs Confirm now, with
 * the mail service's status by number and what it means in words.
 *
 * And one more caller: grant-access, with the service-role key Supabase gives
 * every function here, may ask for 'sample' and nothing else — both emails,
 * marked [Sample], to the reply address, which is Justin's own inbox. That is
 * how he reads the words before turning the emails on. It touches nothing in
 * the database.
 *
 * WHAT HAS TO BE SET, in Supabase → Edge Functions → Secrets:
 *
 *   RESEND_API_KEY   already set: feedback-email and download-link use it
 *   SETUP_FROM       optional; noreply@newbold.cloud, which is verified
 *   SETUP_REPLY_TO   optional; where replies go, Justin's gmail by default
 */

const RESEND = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Fractal Remote <noreply@newbold.cloud>'
/** Where a reply lands: "replies come to Justin". The address on the support and privacy pages. */
const DEFAULT_REPLY_TO = 'justinnewbold@gmail.com'
const DOWNLOADS = 'fractal.newbold.cloud/downloads'
/*
 * THE DOORS IN THE COMPUTER APP, by the names it shows. These emails are for
 * the people who stopped at signing in, so "sign in" alone is not enough:
 * a new computer app's first screen offers "Get started", which leads to a
 * free way in that needs no sign-in, and the way in for somebody who has
 * already bought is the button under it. Copied, not imported (a function
 * deploys from its own folder); test/server.mjs holds each to the app's own
 * words:
 *
 *   I_HAVE_ONE   the first screen's button (P1.haveCode, shared/onboarding.mjs)
 *   SETTINGS_DOOR  for a computer app already past that screen: the Settings
 *                  sheet behind the gear, its row and the row's button
 *                  (src/App.jsx, src/components/PhoneRemote.jsx)
 */
const I_HAVE_ONE = 'I already have an account'
const SETTINGS_DOOR = { row: 'Phone & computer', button: 'Sign in to set up the phone remote' }
/*
 * BLUETOOTH (BETA) IN THESE EMAILS: OFF, AND ONE SWITCH TURNS IT ON.
 *
 * Once Bluetooth (beta) opens to customers, in store version 1.89.0 and for
 * the AM4 only, a buyer with an AM4 has a second way that needs no computer,
 * and "your phone has nothing to connect to" stops being true for them. So
 * with this on, both emails offer both ways: the computer app first, the best
 * way and the only one for every unit but the AM4, and then, for an AM4,
 * Bluetooth (beta), with what it costs ("make it clear that there's multiple
 * ways to connect the device, but also make it clear that the computer is
 * the preferred method and that Bluetooth will have more lag and not have as
 * many features") and where in the app it is.
 *
 * OFF UNTIL THE STORE VERSION THAT OPENS IT IS IN BOTH STORES. The email goes
 * to every buyer, on whatever store copy they have, and this function cannot
 * tell which. Sent too early it would point people at a Settings row their
 * app does not have, and tell customers about a feature the store versions
 * they hold were reviewed without. Two things have to be true, both of them,
 * on the day it goes on:
 *
 *   - BLUETOOTH_FROM is live on the App Store AND on Google Play
 *     (public/store-versions.json says so for both, moved that day);
 *   - and it is the build that opens Bluetooth (beta) to customers: its row
 *     in docs/expo-builds.md says "Bluetooth (beta) for customers", for both
 *     phones. A 1.89.0 that reached the stores without it (a review that
 *     went wrong, the version moved at build time) is not that build, and
 *     its copies do not draw the row this email names.
 *
 * test/server.mjs checks both against those two files, and against the
 * version rule's thresholds once mobile/src/lib/ble-rule.js is here, and
 * fails on `true` without them. It reads only what the files say, so it
 * catches a switch turned on with the files not yet moved, never a file
 * moved wrong: the day itself is looked at by eye (supabase/README.md,
 * "Bluetooth (beta) in the emails, from 1.89.0", says how). Then the
 * setup emails are turned off, this function is redeployed, Justin reads
 * the sample, and only then are they turned on again.
 *
 * A constant, not a secret: the words it turns on are reviewed in the same
 * change that turns them on, and the test above can see it.
 */
export const BLUETOOTH_IN_EMAILS = false
/**
 * The first store version that offers Bluetooth (beta) to customers, as the
 * email says it: one number to iPhone and Android buyers alike, so the
 * version rule's threshold for each phone has to be this same one.
 */
export const BLUETOOTH_FROM = '1.89.0'
/** A run's most. The backlog on the first day is about a dozen. */
const AT_MOST = 25
/* Resend takes a couple of requests a second; one at a time with a gap stays under it. */
const GAP_MS = 700
/* The same strict rule as download-link's: one address, nothing that makes a list. */
const LOOKS_LIKE_EMAIL = /^[^@\s,;<>"]+@[^@\s,;<>".]+\.[^@\s,;<>"]{2,}$/

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
    const value = await rpc('setup_reminder_hook_secret', {})
    if (typeof value === 'string' && value) cachedSecret = value
    return cachedSecret
  } catch (err) {
    console.error(`setup-reminder: could not read the hook secret (${String((err as Error)?.message || err).slice(0, 80)})`)
    return null
  }
}

/* -------------------------------------------------------------- the words */

type Kind = 'first' | 'reminder'

/**
 * THE TWO EMAILS, every word fixed here. The only thing from outside is the
 * address, which is the account's own and is only ever escaped into it.
 * Never "yesterday you bought": on the day these are switched on, the
 * customers waiting longest get the first one, some of them weeks after.
 *
 * `bluetooth` is BLUETOOTH_IN_EMAILS unless a test asks for the other
 * wording: the emails that go are only ever the switch's (send, below).
 */
export function setupEmail(kind: Kind, email: string, { bluetooth = BLUETOOTH_IN_EMAILS }: { bluetooth?: boolean } = {}): { subject: string; text: string; html: string } {
  const who = String(email || '').trim()
  const both = bluetooth === true
  const steps = [
    `On the computer your Fractal is plugged into, go to ${DOWNLOADS} and install the Fractal Remote computer app.`,
    `Open it, choose “${I_HAVE_ONE}”, and sign in with ${who}, the same email you use on your phone.`,
    'Open Fractal Remote on your phone. It finds the computer by itself.'
  ]
  /* For somebody who opened the computer app before and went past its first screen. */
  const opened = `Used the computer app before? Click the gear at the top, choose ${SETTINGS_DOOR.row}, then “${SETTINGS_DOOR.button}”, and sign in with ${who}.`
  const first = kind === 'first'
  const subject = first ? 'One more step: the Fractal Remote computer app' : 'Still need a hand with the Fractal Remote computer app?'
  /*
   * With Bluetooth (beta) in the emails, the computer is the best way rather
   * than the only one, and a phone with no computer is no longer one with
   * "nothing to connect to": an AM4 on Bluetooth has the unit itself.
   */
  const opening = first
    ? [
        'Thanks for getting Fractal Remote!',
        both
          ? 'The best way for your phone to control your Fractal is through a free app on the computer your unit is plugged into, and no computer has signed in with your account yet. Setting it up takes about five minutes:'
          : 'Your phone controls your Fractal through a free app on the computer your unit is plugged into, and no computer has signed in with your account yet. Setting it up takes about five minutes:'
      ]
    : [
        'Just checking in.',
        both
          ? `No computer has signed in to Fractal Remote with ${who} yet. The computer app is free, and it’s the same three steps:`
          : `No computer has signed in to Fractal Remote with ${who} yet, so your phone has nothing to connect to. The computer app is free, and it’s the same three steps:`
      ]
  /*
   * THE OTHER WAY, for an AM4, after the computer's steps and never before
   * them: what it is, that the computer is still the best way, what Bluetooth
   * costs (only what the app's own Bluetooth page says: no editing or saving,
   * footswitch changes a moment late and the preset list slow to load, which
   * is Justin's "more lag", and less on screen), and where in the app it is.
   * "Update the app" because the email cannot tell which store copy they
   * hold, and only BLUETOOTH_FROM and later have the row. Help stays the
   * reply to this email, below, which comes to Justin.
   *
   * THE COMPUTER IS THE ONLY WAY FOR THE OTHER UNITS, NAMED. It once said
   * "the one for every Fractal unit", which promises an Axe-Fx II, an AX8 or
   * an FX8 something the app does not do. These are the units the app works
   * with (docs/app-store.md SUPPORTED UNITS: the VP4 in part) less the AM4,
   * and test/server.mjs holds them to that list.
   */
  const secondWay = `Have an AM4? From version ${BLUETOOTH_FROM} of the app there’s a second way, with no computer: Bluetooth (beta), through a Bluetooth MIDI adapter plugged into the AM4’s MIDI In and MIDI Out. The computer is still the best way, and the only way for the FM3, FM9, Axe-Fx III and VP4: Bluetooth has more lag and does less, with no editing or saving. To try it, update the app, then open Settings → My rig → Bluetooth (beta), which says what to buy and how to plug it in.`
  const help = first
    ? 'If you get stuck anywhere, just reply to this email. It comes straight to me.'
    : 'If something got in the way, reply and tell me what you see, and I’ll help you get it going.'
  const why = first
    ? `You’re getting this because ${who} has the full version of Fractal Remote and no computer has signed in with it yet. I’ll send one reminder at most, and nothing after that.`
    : `This is the last email about it. You got it because ${who} has the full version of Fractal Remote and no computer has signed in with it.`

  const text = [
    'Hi,',
    '',
    opening.join(' '),
    '',
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    opened,
    '',
    ...(both ? [secondWay, ''] : []),
    help,
    '',
    'Justin',
    'Fractal Remote',
    '',
    '--',
    why
  ].join('\n')

  const p = (t: string, style = 'margin:0 0 16px') => `<p style="${style}">${esc(t)}</p>`
  const html = `
    <div style="font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1d21;max-width:560px">
      ${p('Hi,')}
      ${p(opening.join(' '))}
      <ol style="margin:0 0 20px;padding-left:22px">${steps.map((s) => `<li style="margin:0 0 8px">${esc(s)}</li>`).join('')}</ol>
      <p style="margin:0 0 20px">
        <a href="https://${DOWNLOADS}" style="background:#7c5cff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">Get the computer app</a>
      </p>
      ${p(opened)}${both ? `\n      ${p(secondWay)}` : ''}
      ${p(help)}
      ${p('Justin', 'margin:0')}
      ${p('Fractal Remote', 'margin:0 0 24px;color:#5f6670')}
      ${p(why, 'margin:0;color:#8b9099;font-size:13px')}
    </div>`
  return { subject, text, html }
}

/**
 * THE SAME EMAIL ASKED FOR TWICE IS STILL ONE EMAIL. Every real send carries
 * an Idempotency-Key made of which email and whose account (the id, never the
 * address), and Resend keeps it for a day: asked again with the same key and
 * the same words inside that day, it answers as it did and sends nothing. So
 * a claim taken back after the service turned the request away (refusalOf's
 * 'mail service'), and asked again the next hour, cannot become a second copy
 * even if Resend had in fact taken the first. Never on a sample, which Justin
 * may ask for twice in an hour and should get twice.
 */
export const onceKey = (kind: Kind, account: string) => `setup-reminder/${kind}/${account}`

/*
 * WHAT RESEND'S REFUSAL WAS ABOUT, read to sort it and then dropped. Its
 * message can quote the address, so nothing of it is kept: only whether it
 * is about the `to` field, the one part of the email that is the person's,
 * and its error name, and the name only when it is one of Resend's plain
 * snake_case words. A body that will not parse is about nothing, and so is a
 * `to` that Resend files under anything but a validation_error: a missing
 * field is our request, never the address (it always has one).
 */
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

/**
 * One email through Resend. Never throws: a failure is { ok: false } with the
 * status (0 for no answer at all), and what readRefusal made of the answer.
 */
async function send(key: string, to: string, kind: Kind, how: { account?: string; sample?: boolean }): Promise<{ ok: boolean; status: number; name?: string; toField?: boolean }> {
  const words = setupEmail(kind, to)
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
 * WHAT A REFUSAL MEANS, by the status Resend answered and, for a 400 or a
 * 422, what its answer was about (readRefusal).
 *
 * Resend takes an address it cannot deliver to and reports the bounce later,
 * as an event, so a refusal at the moment of sending is almost never about
 * the person it was for. Even a 400 or a 422 mostly is not: Resend answers
 * 400 "API key is invalid" from every endpoint when the key is not in a key's
 * shape, 400 for any field it cannot read (a mistyped SETUP_FROM), and 422
 * for a missing field or a bad parameter, none of them the recipient.
 *
 *   400, 422    'this email', only when Resend's answer is about the `to`
 *   naming to   field: it will not take this person's address. Written down
 *               (failed_at), and that account gets no more unless Justin
 *               taps Try the email again on the Developer page.
 *   400, 422    'mail service': the request itself was turned down — the key
 *   otherwise   in the wrong shape, SETUP_FROM or SETUP_REPLY_TO mistyped, a
 *               field missing. The same as a 401 below, with one difference
 *               in the run (`doubt`): the next email is tried, once, to tell
 *               which it was (see the loop).
 *   401, 403,   'mail service': the service turned the request away before
 *   429         taking it — the key wrong, rotated or missing (401, 403), a
 *               limit reached (429). It did not go, and the next person
 *               would fare the same, so the claim is taken back, nothing is
 *               held against the account, and the next hour asks again.
 *   any other   'may have gone': no answer at all (0), the service's own
 *               fault (5xx), or a status that does not say. A 502 or a 504
 *               from a gateway, in particular, can come back after Resend
 *               has taken the email. So the claim stays and it reads as sent:
 *               at worst one email missed (a first one still has its
 *               reminder to come), never the same one twice.
 *
 * Whichever it is, the run stops there (after the one more try a doubt
 * earns): one refusal is the most a run can hold against anybody.
 */
type Refusal = 'this email' | 'mail service' | 'may have gone'
export function refusalOf(status: number, answer: { toField?: boolean } = {}): { why: Refusal; said: string; doubt?: boolean } {
  if (status === 400 || status === 422) {
    if (answer.toField === true) return { why: 'this email', said: 'the mail service refused this email, for its address' }
    return { why: 'mail service', said: 'the mail service turned the request itself down, not the address (check RESEND_API_KEY and SETUP_FROM)', doubt: true }
  }
  if (status === 401 || status === 403) return { why: 'mail service', said: 'the mail key was refused' }
  if (status === 429) return { why: 'mail service', said: 'the mail service’s sending limit was reached' }
  if (!status) return { why: 'may have gone', said: 'no answer from the mail service, so it may have gone and is kept as sent' }
  if (status >= 500) return { why: 'may have gone', said: 'the mail service had a fault, so it may have gone and is kept as sent' }
  return { why: 'may have gone', said: 'the mail service’s answer does not say whether it went, so it is kept as sent' }
}

const pause = (ms: number) => new Promise((go) => setTimeout(go, ms))

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
    for (const kind of ['first', 'reminder'] as Kind[]) sent.push(await send(key, to, kind, { sample: true }))
    return json({ ok: sent.every((s) => s.ok), sent: sent.filter((s) => s.ok).length })
  }

  /* The schedule, by the secret the database made. Both halves must exist. */
  const expected = await hookSecret()
  const given = req.headers.get('x-hook-secret')
  if (!expected || !given || given !== expected) return new Response('No', { status: 401 })

  try {
    const sending = (await rpc('setup_reminder_sending', {})) === true
    const key = env('RESEND_API_KEY')

    if (!sending || !key) {
      /* Still looks (setup_reminders_due notes which accounts have a computer), and only counts. */
      const due = await rpc('setup_reminders_due', { at_most: 50 })
      const rows = Array.isArray(due) ? due : []
      const first = rows.filter((r: any) => r?.kind === 'first').length
      const reminder = rows.filter((r: any) => r?.kind === 'reminder').length
      console.log(`setup-reminder: ${sending ? 'no RESEND_API_KEY set' : 'switched off'}, nothing sent; ${first} first and ${reminder} reminder would go`)
      return json({ sending: false, first, reminder })
    }

    const due = await rpc('setup_reminders_due', { at_most: AT_MOST })
    const rows = Array.isArray(due) ? due : []
    const done = { first: 0, reminder: 0, refused: 0, skipped: 0 }
    let stopped: { status: number; why: Refusal } | null = null
    let stoppedSaid = ''
    let sentOne = false
    let doubted = false
    for (const row of rows as any[]) {
      const kind: Kind | null = row?.kind === 'first' || row?.kind === 'reminder' ? row.kind : null
      const id = String(row?.account_id || '')
      const to = String(row?.email || '').trim()
      if (!kind || !id || to.length > 254 || !LOOKS_LIKE_EMAIL.test(to)) {
        done.skipped += 1
        continue
      }
      /* Claimed first: the row says it went before it goes, so nothing is ever sent twice. */
      if ((await rpc('claim_setup_reminder', { uid: id, which: kind })) !== true) {
        done.skipped += 1
        continue
      }
      if (sentOne) await pause(GAP_MS)
      sentOne = true
      const out = await send(key, to, kind, { account: id })
      if (out.ok) {
        done[kind] += 1
        continue
      }
      done.refused += 1
      const refusal = refusalOf(out.status, out)
      const { why, said } = refusal
      /* Resend's error name is one of its snake_case words (readRefusal), never anything of the person's. */
      const status = `status ${out.status}${out.name ? `, ${out.name}` : ''}`
      if (why === 'this email') {
        console.error(`setup-reminder: stopped at the ${kind} email to account ${id}: ${said} (${status}). No more go to that account.`)
        try {
          await rpc('note_setup_reminder_failed', { uid: id, which: kind })
        } catch {
          console.error(`setup-reminder: could not write down the refusal for account ${id}`)
        }
      } else if (why === 'mail service') {
        const next = refusal.doubt && !doubted ? 'The next one, if there is one, is tried, to tell the request from the address.' : 'The run stops here.'
        console.error(`setup-reminder: the ${kind} email to account ${id}: ${said} (${status}). Nothing is held against the account; the next hour tries again. ${next}`)
        try {
          await rpc('release_setup_reminder', { uid: id, which: kind })
        } catch {
          /* The claim stays, so it reads as sent: one email missed, never one sent twice. */
          console.error(`setup-reminder: could not take back the claim for account ${id}, so it reads as sent`)
        }
      } else {
        /* 'may have gone': the claim stays, untouched, so it is never sent again and nothing is held against them. */
        console.error(`setup-reminder: stopped at the ${kind} email to account ${id}: ${said} (${status}).`)
      }
      /*
       * ONE MORE TRY, FOR A DOUBT, and only once a run. A 400 or 422 that does
       * not name the address is nearly always the request, and then the next
       * email is turned down the same way and the run stops on it. If it goes,
       * the first was about that person after all — and stopping on them
       * would hold up everybody behind them every hour, because the list is
       * oldest first and their claim was handed back. Nothing is written
       * against them either way.
       */
      if (refusal.doubt && !doubted) {
        doubted = true
        continue
      }
      /* Stopped here: everybody after this waits for the next hour, unclaimed. */
      stopped = { status: out.status, why }
      stoppedSaid = `${said} (${status})`
      break
    }
    console.log(
      `setup-reminder: ${done.first} first and ${done.reminder} reminder sent, ${done.refused} refused, ${done.skipped} skipped` +
        (stopped ? `; stopped early, ${stoppedSaid}` : '')
    )
    return json({ sending: true, ...done, stopped })
  } catch (err) {
    console.error(`setup-reminder: ${String((err as Error)?.message || err).slice(0, 200)}`)
    return json({ ok: false }, 500)
  }
})
