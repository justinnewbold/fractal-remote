/**
 * Sending a bug report or an idea.
 *
 * Goes into a table in the same Supabase project the phone remote already
 * uses, so there is no new service to run, nothing to pay for, and nothing new
 * to sign into. The table is insert-only: anyone can write one and nobody can
 * read them back through the public key. One person's bug report is not
 * another person's business, and a table readable with a key that ships inside
 * the app is a table that leaks whatever people paste into it.
 *
 * Deliberately usable without an account. Most people driving a unit from the
 * Mac or over their own wifi never sign in at all, and they are exactly the
 * people who hit the bugs worth hearing about. A signed-in report is stamped
 * with who sent it so a reply is possible; an anonymous one carries no user.
 *
 * WHAT IS IN A REPORT is decided in shared/report-rules.mjs rather than here,
 * because the phone sends these too and a phone that trimmed the log
 * differently would produce reports nobody could compare. This file is only
 * the part that is genuinely the browser's: which client, which user, and
 * what the browser knows about itself.
 *
 * Named reports rather than feedback because lib/feedback.js is already taken,
 * by the flash and the buzz under a thumb on a tap-tempo button.
 */
import {
  KINDS,
  LOGS_ONLY_MESSAGE,
  MAX_MESSAGE,
  SENT_WORDS,
  SHOT_BUCKET,
  buildReport,
  carriesLog,
  contextFrom,
  inTime,
  lastErrorFrom,
  logsMessage,
  notSent,
  reportKey,
  reportLog,
  shotsLostWords,
  uploadShots,
  withShots
} from '../../shared/report-rules.mjs'
import { formatLine, getDebugLog, logDebug } from './debugLog.js'
import { DEFAULT_PROJECT, supabaseClient } from './remote.js'
import { VERSION } from './version.js'

export { KINDS, MAX_MESSAGE, SENT_WORDS, carriesLog, shotsLostWords }

/**
 * What was going on when they wrote it.
 *
 * The difference between a report that can be acted on and one that cannot is
 * almost always this, and it is exactly what a person cannot be expected to
 * type: which version, which unit, how they were connected, what last went
 * wrong.
 *
 * Nothing identifying is collected. No preset contents, no account details,
 * nothing else typed into the app — the report carries what someone chose to
 * write and what shape of setup they were on, and that is all.
 */
export function context({ device, link, platform, macVersion } = {}) {
  return contextFrom({
    version: VERSION,
    macVersion,
    unit: device?.model,
    role: link?.role,
    platform,
    /* The browser's own account of itself. Not a fingerprint — the user agent
       is what tells a reader "this is Safari on an iPad", which is the whole
       of what a layout bug report needs and is not worth making somebody
       describe. */
    os: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    language: typeof navigator !== 'undefined' ? navigator.language : undefined,
    screen:
      typeof window !== 'undefined' && window.innerWidth
        ? `${window.innerWidth}x${window.innerHeight}`
        : undefined,
    lastError: lastErrorFrom(getDebugLog())
  })
}

/**
 * Exactly the log that would be sent, as text — for showing somebody first.
 *
 * "Let them see it before it goes." This is not an approximation of what goes:
 * it is the same function the send path calls (shared/report-rules
 * reportLog), with the same head, so a preview cannot drift from the thing it
 * is previewing. Anything that changed the trimming would change both at
 * once or neither.
 *
 * Empty string for a kind that carries no log, so a caller can show nothing
 * without asking a second question.
 */
export function logPreview(kind, { head = '' } = {}) {
  if (!carriesLog(kind)) return ''
  return reportLog({ lines: getDebugLog(), format: formatLine, head })
}

/**
 * Post one report.
 *
 * Throws with something a person can read. The failure that matters is having
 * no network at all, which is common enough on a stage and must not lose what
 * they typed — the caller keeps the text on screen when this rejects.
 */
export async function sendReport({ kind, message, contact, context: ctx = {}, withLog = true, computer = '', head = '', shots = [] }) {
  const row = buildReport({
    kind,
    message,
    contact,
    context: ctx,
    /*
     * Read at send, never before. "Only when they press send" is the rule, and
     * this is where it is kept: nothing is gathered while somebody types, and
     * a report abandoned half-written leaves no copy of anything anywhere.
     *
     * An empty list when they turned the log off, which buildReport then turns
     * into a null column rather than an empty one.
     */
    lines: withLog ? getDebugLog() : [],
    format: withLog ? formatLine : null,
    /* The computer's own log, when the caller asked for it (sendLogs). */
    computer: withLog ? computer : '',
    /* And the log's head, which Copy Logs puts at the top of a paste (lib/logHead). */
    head: withLog ? head : ''
  })

  /*
   * The signed-in client when there is one, a bare anon client otherwise.
   * supabaseClient() only exists once a remote session has been set up, which
   * is never for a Mac or wifi user — and they must still be able to report.
   */
  let c = supabaseClient()
  let userId = null
  if (c) {
    try {
      const { data } = await c.auth.getUser()
      userId = data?.user?.id || null
    } catch {
      // No session is not a problem; it goes as an anonymous report.
    }
  } else {
    const { createClient } = await import('@supabase/supabase-js')
    c = createClient(DEFAULT_PROJECT.url, DEFAULT_PROJECT.anonKey)
  }

  /*
   * The screenshots first, so they are in the bucket by the time the row's
   * email goes: under the account's id, or `anon`, all of them given
   * SHOT_WAIT_MS together. One that fails or is late is left out and the
   * report goes without it, saying how many (shared/report-rules
   * uploadShots). The row then gets SEND_WAIT_MS.
   */
  const pictures = await uploadShots(shots, {
    owner: userId || 'anon',
    key: reportKey(),
    put: async (path, shot) => {
      const { error } = await c.storage.from(SHOT_BUCKET).upload(path, shot.body, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      return true
    }
  })
  if (pictures.lost) logDebug('app', 'screenshots not added to the report', `${pictures.lost} — ${pictures.why}`)

  const answer = await inTime(() => c.from('feedback').insert({ ...row, context: withShots(row.context, pictures), user_id: userId })).catch(
    (late) => ({ error: late })
  )
  const error = answer?.error

  /* Nothing was written for a log sent in one tap, so nothing is "still here".
     The database's own words go into the log, never onto the screen. */
  if (error) {
    const err = notSent(error, { wrote: row.message !== LOGS_ONLY_MESSAGE })
    logDebug('app', 'report not sent', err.reason)
    throw err
  }
  return { sent: true, shotsLost: pictures.lost }
}

/**
 * "Send logs to developer", from Settings → Troubleshooting → Debug log: a
 * bug report in one press, the phone's button at this end too.
 *
 * No form. The message is the note typed in the box beside the button, or
 * the app's own sentence (LOGS_ONLY_MESSAGE) when there is none, the
 * context is the one the Feedback form sends, the log goes, and `computer`
 * is the computer's own account as Copy Logs builds it (DebugLog's
 * macReport), which the caller has already asked for. Throws in words a
 * person can read, like sendReport, and writes into the log whether it went.
 */
let sendingLogs = null
export function sendLogs(options) {
  /* Never two at once: a second call while one is going is handed that one. */
  if (!sendingLogs) {
    sendingLogs = sendLogsNow(options).finally(() => {
      sendingLogs = null
    })
  }
  return sendingLogs
}

async function sendLogsNow({ context: ctx = {}, computer = '', note = '', shots = [], head = '' } = {}) {
  let sent
  try {
    /* The note, when one was typed; the app's own sentence when not, so the one press still sends. */
    sent = await sendReport({ kind: 'bug', message: logsMessage(note), context: ctx, withLog: true, computer, head, shots })
  } catch (err) {
    /* A refusal's own words are on the line sendReport wrote just before; anything else's are here. */
    logDebug('app', 'logs not sent to the developer', err?.reason ? '' : err?.message)
    throw err
  }
  logDebug('app', 'logs sent to the developer')
  return sent
}
