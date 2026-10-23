/**
 * A report in the table becomes a report in an inbox.
 *
 * "Let's set up actual emails to get sent in when someone leaves feedback."
 *
 * Until now the Tell us box wrote a row into `public.feedback` and that was the
 * end of it. Nobody was told. The reports were real, they were arriving, and
 * the only way to read one was to open the database and go looking — which
 * nobody does on a day when nothing is known to be wrong. A bug report nobody
 * reads is the same as no bug report, only more disappointing for the person
 * who took the trouble.
 *
 * Called by a trigger on that table (see the migration beside this file), not
 * by the app. That matters: the app inserts the row and is finished, so a
 * failure to send mail can never lose a report or stall someone's phone on a
 * stage. The row is the record; this is a courtesy on top of it.
 *
 * WHAT HAS TO BE SET, in Supabase → Edge Functions → Secrets:
 *
 *   RESEND_API_KEY   from resend.com. The only one that is required.
 *   FEEDBACK_TO      where reports land (default: the address below)
 *   FEEDBACK_FROM    who they come from. Optional now: with nothing set this
 *                    sends from noreply@newbold.cloud, which is verified.
 *
 * There is deliberately no secret to keep in step by hand. An earlier version
 * had one — FEEDBACK_HOOK_SECRET here, the same string in Vault — and that is
 * the step that breaks: two halves typed twice, and when they disagree the
 * failure is a 401 nobody is looking at. The database generates the secret
 * instead and this reads it back through an RPC that only `service_role` may
 * call, using the key Supabase injects here on its own.
 *
 * With no RESEND_API_KEY this answers 200 and does nothing. Deliberate: the
 * trigger fires on every insert from the moment it exists, and a function that
 * threw until the day someone got round to signing up for Resend would fill the
 * logs with failures that were not failures.
 *
 * WHAT THE EMAIL CARRIES (22 October 2026). Justin, holding one: "Is this all
 * the information the logs send? Where's the space to enter a message and
 * upload photos?" It had the kind, the message, the context and the row id,
 * and none of the log, so a report sent in one tap read as nearly empty.
 * Now:
 *
 *   - the log's head (which build, which unit, which computers and which one
 *     is driven, the versions at both ends), the lines about which computer
 *     answered and why it is the one driven, the last lines that went wrong,
 *     the end of the run before this one, and the top of the computer's own
 *     log, in the body;
 *   - the whole log attached as a .txt file;
 *   - the screenshots the person added, each ATTACHED and shown in the body
 *     (an inline attachment, `content_id`). Attached rather than linked:
 *     a link that expires is dead by the time a report from a gig is read a
 *     week later, and a link that does not is a public picture. The app caps
 *     each at 1.5 MB and the bucket at 2 MB, so three are about 6 MB once
 *     encoded, well inside Resend's 40 MB and Gmail's 25 MB. Read from the
 *     private bucket with the service key here, and only from the sender's own
 *     folder (SHOT_PATH and the row's user_id), so a row cannot point this at
 *     somebody else's picture; only one no other row has named, so a picture
 *     put in once is mailed, and read out of storage, once (anybody can write
 *     a row, and a row is a few hundred bytes); and only bytes that are a
 *     JPEG, because the bucket checks the type the uploader declared and
 *     never the bytes;
 *   - a reply address: the one they typed, as before, or when there is none
 *     and the report came from an account, that account's email, looked up
 *     here with the service key and labeled "the account's email".
 *
 * Every request this makes has a deadline (WAIT_MS, RESEND_WAIT_MS), the
 * whole of it stays inside BUDGET_MS (the trigger waits sixty seconds), and a
 * picture or an address that cannot be had costs the email one line, never
 * the email. An email Resend refuses with its pictures goes again without
 * them, saying so, so a picture it will not take cannot cost the report.
 *
 * AND IT TIDIES THE BUCKET (review, 23 October 2026). Every time it is
 * called for a report, and once a day when asked with `{"sweep": true}`
 * (migrations/20261022_report_shots_sweep.sql), it deletes the pictures that
 * are due: older than 7 days, or older than an hour and named by no report
 * (public.report_shots_due). Through Storage's API with the service key,
 * because the database refuses a delete straight from storage.objects.
 */

const RESEND = 'https://api.resend.com/emails'

/** Where reports go when nothing says otherwise. */
const DEFAULT_TO = 'justinnewbold@gmail.com'

/*
 * THE DOMAIN IS VERIFIED NOW, so this is the real one.
 *
 * It used to be `onboarding@resend.dev` — Resend's own address, which works
 * the day you sign up and is why it was written that way. What the comment
 * did not say is the catch: that address may only send to the ONE address
 * that owns the Resend account. Every other recipient is refused outright.
 *
 * Which is exactly what happened. "Send link" to an address that was not his
 * gmail came back "The mail service refused it", and the reason was not the
 * app or the key — it was this line, plus a newbold.cloud that had been
 * sitting unverified since December with none of its three DNS records ever
 * added. The records are in now and the domain is proved, so the fallback is
 * the domain rather than the practice address.
 */
const DEFAULT_FROM = 'Fractal Remote <noreply@newbold.cloud>'

/**
 * The secret the trigger sends, read from where the database keeps it.
 *
 * Held across invocations on purpose: a warm function answers without the extra
 * round trip, and a cold one pays it once. Only a successful read is cached, so
 * a blip while the secret is being rotated does not lock this out until the
 * next deploy.
 */
let cachedSecret: string | null = null

async function hookSecret(): Promise<string | null> {
  if (cachedSecret) return cachedSecret
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  try {
    const res = await within(`${url}/rest/v1/rpc/feedback_hook_secret`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}'
    })
    if (!res.ok) {
      console.error('feedback-email: could not read the hook secret', res.status, await res.text())
      return null
    }
    const value = await res.json()
    if (typeof value === 'string' && value) cachedSecret = value
    return cachedSecret
  } catch (err) {
    console.error('feedback-email: could not read the hook secret', err)
    return null
  }
}

/** Nothing from a stranger's keyboard reaches an inbox as markup. */
const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** How long any one request here may take; Resend's gets longer, for an email of a few MB. */
const WAIT_MS = 10_000
const RESEND_WAIT_MS = 15_000
/**
 * The whole of one call, inside the trigger's sixty seconds: a cold read of
 * the secret (10), the pictures, each checked and then read (20, all at once),
 * the email (15), and a second go without its pictures only in what is left.
 */
const BUDGET_MS = 55_000

/*
 * THE SCREENSHOTS' BUCKET, and the only places in it a report may name: the
 * sender's account id (or `anon`), the report's own random key, and which of
 * the three it is. The same pattern as shared/report-rules.mjs SHOT_PATH and
 * the bucket's insert rule (migrations/20261022_report_screenshots.sql); a
 * test holds the three to each other.
 */
const SHOT_BUCKET = 'report-shots'
const SHOT_PATH =
  /^(anon|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[1-3]\.jpg$/
const SHOTS_MAX = 3
/** The bucket's own limit, so anything bigger is not a picture the app sent. */
const SHOT_LIMIT = 2 * 1024 * 1024

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/* The box invites "your email, if you want an answer", and people put all sorts in it. */
const ADDRESS = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/

/** Bytes as base64, a piece at a time: a log is 100 KB and a picture more, too many for one call. */
export function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(out)
}

/* The headings a report's log is cut into (shared/report-rules.mjs fitReport). */
const BEFORE_AT = /\n\n(THE RUN BEFORE THIS ONE|\d+ RUNS AGO) — /
const COMPUTER_AT = "\n\nCOMPUTER'S DEVICE SERVER"
/* A line that went wrong: and a bare "error" (the relay's "channel error — socket closed") and the link going down, the moment a connection dropped. */
const TROUBLE = /\[(error|crash)\]|\berror\b|\[link\] down\b|fail|gave up|refused|timed out|could not/i

/** A JPEG starts FF D8 FF. Anything else under a .jpg name is not a screenshot the app made. */
export const isJpeg = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff

/**
 * The parts of a report's log worth reading in the email itself.
 *
 *   head      the `key: value` lines at its top, when the app wrote them
 *             (their first key is `app`; an older app's log starts with its
 *             first line instead, and has none)
 *   link      the last line saying which computers answered and which one is
 *             driven and why, then the last saying what the computer is and
 *             the last about the unit, each only when it came AFTER that
 *             choice, all in the order they were written. One from before
 *             is about whichever computer was answering then: "[unit] the
 *             computer has a unit — AM4" from the Pi, thirty seconds before
 *             the MacBook with the FM3 was picked, read as the MacBook's.
 *   trouble   the last ten lines of the sender's own that went wrong
 *   before    the run before this one: its heading and its last lines, which
 *             are what it said on the way out
 *   computer  the top of the computer's own log: its summary, up to its
 *             server lines, or the one line saying why it was not asked
 */
export function summarize(log: unknown) {
  const text = String(log ?? '')
  const out = { head: [] as string[], link: [] as string[], trouble: [] as string[], before: [] as string[], computer: [] as string[] }
  if (!text.trim()) return out
  let rest = text
  if (rest.startsWith('app: ')) {
    const end = rest.indexOf('\n\n')
    out.head = (end < 0 ? rest : rest.slice(0, end)).split('\n').slice(0, 24)
    rest = end < 0 ? '' : rest.slice(end + 2)
  }
  const atComputer = rest.indexOf(COMPUTER_AT)
  const computer = atComputer >= 0 ? rest.slice(atComputer + 2) : rest.startsWith("COMPUTER'S DEVICE SERVER") ? rest : ''
  if (atComputer >= 0) rest = rest.slice(0, atComputer)
  else if (computer) rest = ''
  const atBefore = rest.search(BEFORE_AT)
  const before = atBefore >= 0 ? rest.slice(atBefore + 2) : /^(THE RUN BEFORE THIS ONE|\d+ RUNS AGO) — /.test(rest) ? rest : ''
  const own = (atBefore >= 0 ? rest.slice(0, atBefore) : before ? '' : rest).split('\n').filter(Boolean)

  const lastAt = (re: RegExp, from = 0) => {
    for (let i = own.length - 1; i >= from; i--) if (re.test(own[i])) return i
    return -1
  }
  const chose = lastAt(/\[link\] .*answered: .*driving /)
  out.link = [chose, lastAt(/\[link\] the computer is /, Math.max(0, chose)), lastAt(/\[unit\] /, Math.max(0, chose))]
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)
    .map((i) => own[i])
  out.trouble = own.filter((l) => TROUBLE.test(l)).slice(-10)
  if (before) {
    const lines = before.split('\n\n')[0].split('\n')
    out.before = [lines[0], ...lines.slice(2).slice(-6)]
  }
  if (computer) {
    const lines = computer.split('\n')
    const upTo = lines.findIndex((l) => /^server log\b/.test(l))
    out.computer = lines.slice(0, upTo > 0 ? Math.min(upTo, 16) : 16).filter(Boolean)
  }
  return out
}

/** A GET or POST that gives up after `ms` (WAIT_MS unless said). */
const within = (url: string, init: RequestInit = {}, ms = WAIT_MS) => fetch(url, { ...init, signal: AbortSignal.timeout(ms) })

/** The account's own email, read with the service key, or null. Logged by the account id only. */
async function accountEmail(id: unknown): Promise<string | null> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const who = String(id ?? '')
  if (!url || !key || !UUID.test(who)) return null
  try {
    const res = await within(`${url}/auth/v1/admin/users/${who}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    if (!res.ok) {
      console.error(`feedback-email: could not read the account's email for ${who} (${res.status})`)
      return null
    }
    const user = await res.json()
    const email = String(user?.email ?? '').trim()
    return ADDRESS.test(email) ? email : null
  } catch (err) {
    console.error(`feedback-email: could not read the account's email for ${who} (${err})`)
    return null
  }
}

type Picture = { filename: string; content: string; content_id: string }

/**
 * Whether a row other than this one already names the picture. A picture is
 * attached to one email only: anybody can write a row naming a picture under
 * anon/, so without this one upload could be read out of storage and mailed
 * again for every row that named it. Asked before the picture is read, so a
 * picture named again costs one small query, not its bytes. Answers 'no',
 * 'yes', or a reason it could not be told, which leaves the picture out.
 */
async function namedElsewhere(url: string, key: string, path: string, id: string): Promise<string> {
  if (!UUID.test(id)) return 'the report has no id to check it against'
  const query = `id=neq.${id}&context->screenshots=cs.${encodeURIComponent(JSON.stringify([path]))}&limit=1`
  try {
    const res = await within(`${url}/rest/v1/feedback?select=id&${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    if (!res.ok) return `it could not be checked (${res.status})`
    const rows = await res.json()
    return Array.isArray(rows) && rows.length ? 'yes' : 'no'
  } catch (err) {
    return `it could not be checked (${err})`
  }
}

/**
 * The screenshots a row names, read from the bucket: each one that is the
 * sender's own, named by no other row, and comes back as a JPEG, as an
 * inline attachment, and a line for each that does not. All at once, so
 * three pictures take as long as one.
 */
async function screenshots(row: Record<string, unknown>, ctx: Record<string, unknown>) {
  const named = Array.isArray(ctx.screenshots) ? ctx.screenshots.slice(0, SHOTS_MAX) : []
  const owner = row.user_id ? String(row.user_id) : 'anon'
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const id = String(row.id ?? '')
  const one = async (raw: unknown, i: number): Promise<Picture | string> => {
    const path = String(raw ?? '')
    const n = i + 1
    if (!SHOT_PATH.test(path) || path.split('/')[0] !== owner) return `Screenshot ${n} was not the sender's own, so it was left out.`
    if (!url || !key) return `Screenshot ${n} could not be read: the function has no service key.`
    const elsewhere = await namedElsewhere(url, key, path, id)
    if (elsewhere === 'yes') return `Screenshot ${n} was already sent with another report, so it was left out.`
    if (elsewhere !== 'no') return `Screenshot ${n} was left out: ${elsewhere}.`
    try {
      const res = await within(`${url}/storage/v1/object/${SHOT_BUCKET}/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
      if (!res.ok) return `Screenshot ${n} could not be read from storage (${res.status}).`
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (!bytes.length || bytes.length > SHOT_LIMIT) return `Screenshot ${n} was ${bytes.length ? 'too big' : 'empty'}, so it was left out.`
      if (!isJpeg(bytes)) return `Screenshot ${n} was not a picture, so it was left out.`
      return { filename: `screenshot-${n}.jpg`, content: toBase64(bytes), content_id: `shot-${n}` }
    } catch (err) {
      return `Screenshot ${n} could not be read from storage (${err}).`
    }
  }
  const done = await Promise.all(named.map(one))
  return {
    files: done.filter((d): d is Picture => typeof d !== 'string'),
    missing: done.filter((d): d is string => typeof d === 'string')
  }
}

/**
 * THE TIDY: the pictures that are due, deleted. Asked of the database
 * (report_shots_due, which only the service key may call) and deleted through
 * Storage's API, the only way a file there can be deleted. Never throws:
 * a tidy that cannot be done today is done next time. Answers how many went.
 */
async function sweepShots(): Promise<number> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return 0
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  try {
    const res = await within(`${url}/rest/v1/rpc/report_shots_due`, { method: 'POST', headers, body: '{}' })
    if (!res.ok) {
      console.error('feedback-email: could not ask which screenshots are due', res.status)
      return 0
    }
    const due = (await res.json()) as unknown
    const paths = (Array.isArray(due) ? due : []).map((p) => String(p ?? '')).filter((p) => SHOT_PATH.test(p))
    if (!paths.length) return 0
    const gone = await within(`${url}/storage/v1/object/${SHOT_BUCKET}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: paths }) })
    if (!gone.ok) {
      console.error('feedback-email: could not delete the screenshots that are due', gone.status)
      return 0
    }
    return paths.length
  } catch (err) {
    console.error('feedback-email: could not tidy the screenshots', String(err))
    return 0
  }
}

const pre = (lines: string[]) =>
  `<pre style="white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,Menlo,monospace;background:#f4f2ee;border-radius:6px;padding:10px;margin:4px 0 12px">${esc(
    lines.join('\n')
  )}</pre>`
const part = (title: string, lines: string[]) =>
  lines.length ? `<p style="margin:12px 0 0;font-weight:600">${esc(title)}</p>${pre(lines)}` : ''

/**
 * The email for one row, given what was looked up for it. Kept apart from
 * the sending so a test can read exactly what would go.
 */
export function emailFor(
  row: Record<string, unknown>,
  { account = null, shots = { files: [], missing: [] } }: { account?: string | null; shots?: { files: Picture[]; missing: string[] } } = {}
) {
  const kind = row.kind === 'idea' ? 'Idea' : 'Bug'
  const message = String(row.message ?? '').slice(0, 4000)
  const contact = String(row.contact ?? '').trim()
  const ctx = (row.context ?? {}) as Record<string, unknown>
  const log = typeof row.log === 'string' && row.log ? row.log : ''
  const id = String(row.id ?? '')

  /*
   * The context is what makes a report actionable, and it is exactly what
   * nobody can be expected to type: which version, which unit, how they were
   * connected, what size screen. Laid out as a list rather than dumped as JSON
   * because this is read on a phone, in a hurry, usually while doing something
   * else. The screenshots' places are not a fact anybody reads; the pictures
   * themselves are below.
   */
  const facts = Object.entries(ctx)
    .filter(([k, v]) => k !== 'screenshots' && v !== null && v !== undefined && v !== '' && typeof v !== 'object')
    .map(([k, v]) => `<li><b>${esc(k)}</b>: ${esc(v)}</li>`)
    .join('')

  /*
   * Who to answer: the address they typed, or the account's own. A report
   * from an account whose email could not be read (a lookup that timed out
   * or was refused) says so, with the account's id to find it by, rather
   * than reading exactly like one sent signed out (second review).
   */
  const typed = ADDRESS.test(contact) ? contact : ''
  const replyTo = typed || account || ''
  const unread = !account && UUID.test(String(row.user_id ?? '')) ? `sent signed in, but the account's email couldn't be read (account ${esc(row.user_id)})` : ''
  const from = typed
    ? ` from ${esc(typed)}`
    : account
      ? ` from ${esc(account)} (the account's email)${contact ? `; they also wrote "${esc(contact)}"` : ''}`
      : contact
        ? ` — they wrote "${esc(contact)}", which is not an address to reply to${unread ? `; ${unread}` : ''}`
        : unread
          ? ` — ${unread}`
          : ' — no reply address given'

  const sum = summarize(log)
  const pictures = shots.files
    .map((f) => `<img src="cid:${esc(f.content_id)}" alt="${esc(f.filename)}" style="display:block;max-width:100%;height:auto;margin:6px 0;border:1px solid #ddd;border-radius:6px">`)
    .join('')
  const logName = `report-${id.slice(0, 8) || 'log'}.txt`
  const logBytes = new TextEncoder().encode(log)

  const subject = `${kind}: ${message.split('\n')[0].slice(0, 70) || '(no message)'}`
  /*
   * What is read at a glance first: who, the note, any picture that could
   * not come, the facts and the log's parts. The pictures after them, full
   * width: three phone screenshots above the facts put them screens down
   * (second review, 23 October 2026). Each is attached at full size too.
   */
  const html = `
    <div style="font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1d21">
      <p style="margin:0 0 4px"><b>${esc(kind)}</b>${from}</p>
      <pre style="white-space:pre-wrap;word-break:break-word;font:inherit;background:#f4f2ee;border-radius:6px;padding:12px;margin:12px 0">${esc(
        message
      )}</pre>
      ${shots.missing.length ? `<p style="color:#a03a2c;margin:8px 0">${shots.missing.map(esc).join('<br>')}</p>` : ''}
      ${facts ? `<ul style="margin:12px 0;padding-left:18px;color:#5f6670">${facts}</ul>` : ''}
      ${part('From the top of the log', sum.head)}
      ${part('Which computer, and why', sum.link)}
      ${part('What went wrong (newest at the bottom)', sum.trouble)}
      ${part('How the run before this one ended', sum.before)}
      ${part('What the computer said', sum.computer)}
      ${pictures ? `<p style="margin:12px 0 0;font-weight:600">Screenshots</p>${pictures}` : ''}
      ${log ? `<p style="color:#5f6670;margin:12px 0 0">The whole log is attached: ${esc(logName)} (${Math.max(1, Math.round(logBytes.length / 1024))} KB).</p>` : ''}
      <p style="color:#8b9099;font-size:12px;margin:16px 0 0">Row ${esc(id)}</p>
    </div>`

  /*
   * Each with its type said, rather than left for Resend to guess from the
   * name: a picture is a JPEG (the bytes were checked), and the log is UTF-8,
   * which it has to be said to be, because every log is full of "—", "→" and
   * "·", and a viewer left to assume Latin-1 shows "â€”" throughout.
   */
  const attachments: Record<string, string>[] = [
    ...shots.files.map((f) => ({ filename: f.filename, content: f.content, content_id: f.content_id, content_type: 'image/jpeg' })),
    ...(log ? [{ filename: logName, content: toBase64(logBytes), content_type: 'text/plain; charset=utf-8' }] : [])
  ]

  const payload: Record<string, unknown> = {
    from: Deno.env.get('FEEDBACK_FROM') || DEFAULT_FROM,
    to: [Deno.env.get('FEEDBACK_TO') || DEFAULT_TO],
    subject,
    html
  }
  /*
   * If they left an address, hitting Reply should answer them rather than
   * writing back to a sending domain nobody reads. With none, the account's
   * own, which is the address they sign in with.
   */
  if (replyTo) payload.reply_to = replyTo
  if (attachments.length) payload.attachments = attachments
  return payload
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  /* From here, everything inside BUDGET_MS. */
  const began = Date.now()

  /*
   * The database is the only thing that may call this.
   *
   * `verify_jwt` is off, because the caller is Postgres rather than a signed-in
   * person — so this is the gate instead. Without it the URL is a button
   * anybody on the internet could press to put whatever they liked in an inbox.
   * Compared in full rather than with a prefix so a partial guess proves
   * nothing.
   */
  const expected = await hookSecret()
  const given = req.headers.get('x-hook-secret')
  /*
   * Both halves must exist. Without the first test an unreadable secret would
   * make `null !== null` false and wave everything through — the failure that
   * turns a closed door into an open one.
   */
  if (!expected || !given || given !== expected) {
    return new Response('No', { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  /* The once-a-day tidy (migrations/20261022_report_shots_sweep.sql): no report, no email, only the bucket. */
  if (body?.sweep === true) {
    const swept = await sweepShots()
    return new Response(JSON.stringify({ swept }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) {
    // Not an error. See the note at the top: the trigger runs before anyone has
    // signed up for anything, and the row is already safe in the table.
    console.log('feedback-email: no RESEND_API_KEY set, nothing sent')
    return new Response(JSON.stringify({ sent: false, why: 'not configured' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Supabase sends `{ type, table, record, old_record }`; the migration sends
  // the record on its own. Accept either so the shape of the trigger can
  // change without this having to.
  const row = (body?.record ?? body) as Record<string, unknown>

  /* The tidy goes on beside the email, so it costs the email no time. */
  const tidy = sweepShots()
  const ctx = (row.context ?? {}) as Record<string, unknown>
  const contact = String(row.contact ?? '').trim()
  /* The account's email only when they gave no address of their own. */
  const [account, shots] = await Promise.all([
    ADDRESS.test(contact) || !row.user_id ? Promise.resolve(null) : accountEmail(row.user_id),
    screenshots(row, ctx)
  ])

  const send = (payload: Record<string, unknown>, suffix: string, ms: number) =>
    within(
      RESEND,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          /* One email per row, however many times this is called for it. */
          ...(row.id ? { 'Idempotency-Key': `feedback-email/${String(row.id)}${suffix}` } : {})
        },
        body: JSON.stringify(payload)
      },
      ms
    )
  const answer = (value: Record<string, unknown>) =>
    tidy.then(() => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }))

  let res: Response
  try {
    res = await send(emailFor(row, { account, shots }), '', RESEND_WAIT_MS)
  } catch (err) {
    console.error('feedback-email: Resend did not answer', String(err))
    return answer({ sent: false, why: 'no answer' })
  }

  /*
   * REFUSED WITH ITS PICTURES: once more without them. Pictures are the new
   * way for an email to be refused (their size, or an attachment Resend will
   * not take), and a refused email is a report nobody hears of. So a refusal
   * that is about the email (a 4xx, but not 409, the same key again, nor 429,
   * too many) goes again with the log and no pictures, saying why and where
   * they are, under a key of its own. Only in the time that is left.
   */
  let plain = false
  let detail = res.ok ? '' : await res.text().catch(() => '')
  if (!res.ok && shots.files.length && res.status >= 400 && res.status < 500 && res.status !== 409 && res.status !== 429) {
    const left = BUDGET_MS - (Date.now() - began)
    console.error('feedback-email: Resend refused the email with its screenshots', res.status, detail)
    if (left > 2000) {
      const without = {
        files: [],
        missing: [
          ...shots.missing,
          `The screenshots couldn't be attached (the mail service said ${res.status}), so this email went without them. They stay in the report-shots bucket for 7 days.`
        ]
      }
      try {
        res = await send(emailFor(row, { account, shots: without }), '/plain', Math.min(RESEND_WAIT_MS, left))
        plain = true
        detail = res.ok ? '' : await res.text().catch(() => '')
      } catch (err) {
        console.error('feedback-email: Resend did not answer the second time', String(err))
        return answer({ sent: false, why: 'no answer' })
      }
    }
  }

  if (!res.ok) {
    console.error('feedback-email: Resend refused', res.status, detail)
    // 200 on purpose. The row is saved and the person has been thanked; a
    // non-2xx here only makes pg_net record a failure nobody is watching.
    // The log line is the thing that gets read when mail stops arriving.
    return answer({ sent: false, status: res.status, detail })
  }

  return answer({ sent: true, screenshots: plain ? 0 : shots.files.length, log: Boolean(row.log), ...(plain ? { withoutScreenshots: true } : {}) })
})
