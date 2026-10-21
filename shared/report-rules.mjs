/**
 * What a report carries, and what it must never carry.
 *
 * "Add a way to submit the debug log. Keep the last 200 lines plus the last
 * 10 errors, only when they press send, cap it around 100KB, and attach the
 * versions, OS, device, connection and last error automatically. Let them see
 * it before it goes." And, separately: "a feedback and feature suggestion
 * section, separate from bug reports, with no debug log, an optional email,
 * and a different inbox."
 *
 * TWO KINDS AND THEY ARE NOT THE SAME THING, which is the rule everything
 * else here hangs off. A bug report is useless without the log; a feature
 * suggestion has no business carrying one. Somebody writing "it would be nice
 * if the tuner were bigger" has not consented to sending a transcript of
 * their evening, and would be right to be annoyed to find they had. So
 * `carriesLog` answers that question in one place and both apps ask it rather
 * than each deciding.
 *
 * WHY THE RULES LIVE HERE rather than in either app. The phone is where the
 * bad evenings happen and the browser is where they get read, and a phone
 * that trimmed the log differently would produce reports that look like a
 * different app's. The shape of a report is not a detail either end should
 * own.
 */

/** What a report can be. Two, because a third would only ever be "other". */
export const KINDS = ['bug', 'idea']

/** The longest message the table will take, mirrored so the box can say so. */
export const MAX_MESSAGE = 4000

/** The tail of the log that goes with a bug report. */
export const LOG_LINES = 200

/**
 * Plus the last errors, however far back they are.
 *
 * The 200-line window alone loses the thing that matters in exactly the case
 * that matters most: a crash early in a long session, followed by an hour of
 * ordinary traffic that pushes it out. Those ten are pulled back in wherever
 * they were, so a report about "it broke when I started and has been odd
 * since" carries both halves.
 */
export const LOG_ERRORS = 10

/**
 * And the whole thing fits in this.
 *
 * A number that exists because a text column with no ceiling is a text column
 * somebody eventually pastes a megabyte into. It is generous — 200 lines is
 * nowhere near it in normal use — so the cap only bites when a single line is
 * enormous, which is precisely when something has gone wrong enough to be
 * worth truncating rather than refusing.
 */
export const LOG_BYTES = 100_000

/** Whether a kind of report carries the log at all. Only one does. */
export const carriesLog = (kind) => kind === 'bug'

/** The lines that count as trouble, by the source they were written with. */
export const isTrouble = (entry) => entry?.source === 'error' || entry?.source === 'crash'

/**
 * Which lines go, given the whole log.
 *
 * The last `LOG_LINES`, plus any of the last `LOG_ERRORS` troubles that fell
 * outside that window, back in the order they happened. Never a copy of a
 * line already in the window — an error inside the last 200 is simply there.
 *
 * Takes the array rather than reading the log itself, so it can be tested
 * with a log nobody had to produce, and so the phone and the browser can each
 * hand it their own.
 */
export function pickForReport(lines = []) {
  const all = Array.isArray(lines) ? lines : []
  const from = Math.max(0, all.length - LOG_LINES)

  /* The two halves cannot overlap — one is taken from before `from` and the
     other from after it — so this needs no de-duplicating. Index order, not
     timestamp order: lines written in the same millisecond are common, and
     the array is already the order they happened in. */
  const older = all.slice(0, from).filter(isTrouble).slice(-LOG_ERRORS)
  return [...older, ...all.slice(from)]
}

/**
 * Cut text to the cap, from the FRONT.
 *
 * Which end to drop is the whole of this function. The lines just before a
 * failure are the ones that explain it; the ones an hour earlier are context
 * somebody might like. Truncating the end would throw away the answer and
 * keep the preamble, which is the wrong way round and is what a naive
 * `slice(0, cap)` does.
 *
 * What is dropped is said rather than silently gone, because a reader who
 * cannot tell a short log from a trimmed one will read the first surviving
 * line as the beginning of the story.
 */
export function trimToBytes(text, cap = LOG_BYTES) {
  const s = String(text ?? '')
  if (bytesOf(s) <= cap) return s

  const lines = s.split('\n')
  const kept = []
  let bytes = 0
  for (let i = lines.length - 1; i >= 0; i--) {
    const cost = bytesOf(lines[i]) + 1
    if (bytes + cost > cap - 80) break
    kept.unshift(lines[i])
    bytes += cost
  }
  const gone = lines.length - kept.length
  return [`… ${gone} earlier line${gone === 1 ? '' : 's'} left out to fit`, ...kept].join('\n')
}

/* Bytes, not characters: the column's limit is bytes and a log full of
   em-dashes and arrows is not the length it looks. */
const bytesOf = (v) => (typeof TextEncoder === 'undefined' ? v.length : new TextEncoder().encode(v).length)

/**
 * "Send logs to developer": the log sent in one tap, with nothing to write.
 *
 * "Check if the log was sent. There was no confirmation." It was not. The
 * button on the phone's log screen only opened the Feedback form, whose Send
 * stays dark until something is typed, so pressing Done there sent nothing
 * and said nothing. Now the button sends, there and then, and says so under
 * itself. The form is still in Settings for anybody with something to say.
 *
 * A report must carry a message (buildReport refuses an empty one, and the
 * email's subject line is made from it), so the app writes this one itself:
 * the first words of the email say which button sent it and that nobody
 * typed anything, which is the first thing worth knowing about the report.
 */
export const LOGS_ONLY_MESSAGE = 'Send logs to developer: logs only, no message written.'

/** What both ends say once a report has gone: the Feedback form's own words. */
export const SENT_WORDS = 'Sent to the developer — thank you.'

/**
 * What a report that did not go says, in words a person can read.
 *
 * The network sentence promises that what was written is still on screen,
 * which is true on the Feedback form and false for a log sent with nothing
 * written, so that one is told only to try again (or to copy the log, which
 * needs no network).
 *
 * ANY OTHER REFUSAL IS SAID PLAINLY TOO. The database's own words ('new row
 * violates row-level security policy for table "feedback"') are nothing a
 * guitarist can act on, and on the one-tap button nothing was typed to give
 * them a clue. The reason is kept for the developer instead: notSent puts it
 * on the error as `reason`, and the sender writes it into the log.
 */
export function notSentWords(error, { wrote = true } = {}) {
  const said = String(error?.message || error || '')
  if (/fetch|network/i.test(said)) {
    return wrote
      ? "Couldn't reach the internet to send that. What you wrote is still here — try again in a moment."
      : "Couldn't reach the internet to send that. Try again in a moment."
  }
  return wrote
    ? "That didn't send. What you wrote is still here — try again in a moment."
    : "That didn't send. Try again in a moment, or use Copy Logs instead."
}

/** The error a sender throws: notSentWords to show, and the database's own words as `reason`, for the log. */
export function notSent(error, options) {
  return Object.assign(new Error(notSentWords(error, options)), { reason: String(error?.message || error || '') })
}

/**
 * THE COMPUTER'S OWN LOG GOES WITH IT, when there is one.
 *
 * The phone's lines say what the phone saw: "port not open", "your computer
 * didn't answer". Why is in the computer's own log, which /diag hands over
 * (ForgeFX: the port's state, its reopens, and the last lines the server
 * said, with the lines it holds on purpose at the head of them). Copy Logs in
 * the browser has asked for it for a while; a report sent from either end
 * now carries it too, under its own heading after the sender's own lines.
 *
 * Asked for once, at send, and given COMPUTER_WAIT_MS to answer. A computer
 * that cannot be asked, or does not answer in time, costs the report one line
 * saying why, never the report itself.
 */
export const COMPUTER_WAIT_MS = 5000

/**
 * The computer's own share of LOG_BYTES.
 *
 * The sender's own lines come first and keep everything above this, so a
 * long computer log can never push them out: at most this much of the cap is
 * kept back for the computer, and only as much as it needs. When the sender's
 * lines are short, which is nearly always, the computer has the rest of the
 * cap as well and its log goes whole.
 */
export const COMPUTER_BYTES = 30_000

/**
 * How many lines at the top of the computer's part stay when it has to be
 * cut: its summary (formatMacDiag, at most 23 lines) and the lines ForgeFX
 * holds at the head of its server log (logHeld in its recent.ts keeps 24).
 * Those held lines are the evidence of a failure kept past the ring on
 * purpose, and once the ring has let them go they sit at the FRONT, so
 * cutting from the front the way trimToBytes does would throw away exactly
 * them. This cuts the middle.
 *
 * A Linux computer that says what its MIDI input holds adds up to 13 lines
 * to the summary (formatMacDiag's linux midi lines), usually 6 or 7. A held
 * line that pushes past the head then is in the middle, where COMPUTER_HELD
 * below keeps it: every kind ForgeFX holds is one it matches.
 */
export const COMPUTER_HEAD_LINES = 48

/**
 * AND THE HELD LINES STILL IN THE RING, which are in that middle.
 *
 * ForgeFX puts a held line at the head only after its 400-line ring has let
 * it go (recentLog: `l.n < oldest`). Until then it sits where it was said,
 * among the ring's lines, and with the AM4's MIDI lines a full ring is about
 * 100 KB, so a "dump scene names: attempt 1/3 failed" said a few hundred
 * lines ago is in the part the cut throws away. So the cut keeps these from
 * its middle as well, up to ForgeFX's own HOLD of 24, newest first, just
 * under the head: every line its am4 driver writes about a dump, and a
 * backup that took more than one attempt (the two kinds #logHeld writes),
 * and the piece of a cut SysEx its MIDI input dropped (computer app 1.87.47
 * on, the third kind: on a Raspberry Pi it is the trace of a dump the
 * kernel cut, and the reply it would have eaten).
 */
export const COMPUTER_HELD = /\[forgefx\]\[am4\] (dump |backup .* on attempt \d+\/\d+$)|\[forgefx\]\[midi\] dropped \d+B with no F7/
export const COMPUTER_HELD_LINES = 24

/** The one line said in place of the computer's log. Copy Logs' own words. */
export const computerUnasked = (why) => `COMPUTER'S DEVICE SERVER — could not be asked: ${why}`

/**
 * Why there is no computer to ask, or null when there is one.
 *
 * `via` is how the unit is reached ('demo', 'bluetooth' or 'computer', as
 * the phone's linkVia says it) and `link` is the link's own word for its
 * state. Only a computer that is connected is asked, so the report goes at
 * once rather than after a deadline nobody needed to wait out.
 */
export function computerUnaskedWhy({ via = 'computer', link = 'connected' } = {}) {
  if (via === 'demo') return 'the demo is on, so there is no computer to ask'
  if (via === 'bluetooth') return 'Bluetooth (beta) is on, so the unit is reached without a computer'
  if (link !== 'connected') return `not connected to a computer (${link || 'off'})`
  return null
}

const NO_ANSWER = Symbol('no answer')

/**
 * The computer's part of a report: its /diag as lines, or one line saying why
 * not.
 *
 * `ask` fetches the diag and `format` turns it into lines (formatMacDiag).
 * Never waits longer than `wait`, and never throws: whatever goes wrong is
 * the one line, and the report goes without the rest.
 */
export async function askComputer(ask, format, { wait = COMPUTER_WAIT_MS, why = null } = {}) {
  if (why) return computerUnasked(why)
  let timer = null
  const late = new Promise((resolve) => {
    timer = setTimeout(() => resolve(NO_ANSWER), wait)
  })
  try {
    const answer = await Promise.race([Promise.resolve().then(ask), late])
    if (answer === NO_ANSWER) return computerUnasked(`it did not answer within ${wait % 1000 ? `${wait} ms` : `${wait / 1000} seconds`}`)
    return format(answer) || computerUnasked('it answered with nothing to say')
  } catch (e) {
    return computerUnasked(e?.message || String(e))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The computer's part cut to `cap`, keeping its head, the held lines from its
 * middle (COMPUTER_HELD), and its newest lines.
 *
 * The rest of the middle goes, and says so. A head too big to leave room for
 * anything after it is cut from the front instead, like every other log here,
 * so the newest lines are what survive either way.
 */
export function trimComputer(text, cap = COMPUTER_BYTES, head = COMPUTER_HEAD_LINES) {
  const s = String(text ?? '')
  if (bytesOf(s) <= cap) return s
  const lines = s.split('\n')
  const top = lines.slice(0, head)
  const topBytes = top.reduce((n, l) => n + bytesOf(l) + 1, 0)
  if (lines.length <= head || topBytes > cap / 2) return trimToBytes(s, cap)

  /* The held lines below the head, the newest of them, paid for first: never more than a quarter of the cap. */
  let held = []
  for (let i = lines.length - 1; i >= head && held.length < COMPUTER_HELD_LINES; i--) {
    if (COMPUTER_HELD.test(lines[i])) held.unshift(i)
  }
  const cost = (i) => bytesOf(lines[i]) + 1
  let heldBytes = held.reduce((n, i) => n + cost(i), 0)
  while (held.length && heldBytes > cap / 4) heldBytes -= cost(held.shift())

  /* Then the newest lines, in what is left. A held line among them is already paid for. */
  const paid = new Set(held)
  let bytes = topBytes + heldBytes
  let from = lines.length
  for (let i = lines.length - 1; i >= head; i--) {
    const more = paid.has(i) ? 0 : cost(i)
    if (bytes + more > cap - 120) break
    bytes += more
    from = i
  }
  const between = held.filter((i) => i < from)
  const gone = from - head - between.length
  const note = `… ${gone} line${gone === 1 ? '' : 's'} in between left out to fit${
    between.length ? `; ${between.length} held line${between.length === 1 ? '' : 's'} from among them kept above` : ''
  }`
  return [...top, ...between.map((i) => lines[i]), note, ...lines.slice(from)].join('\n')
}

/*
 * Characters a row cannot hold. Postgres text refuses U+0000 and PostgREST
 * turns the whole row away for it, so one NUL in a name the unit sent, said
 * in the computer's log, would make every send fail until the line had left
 * its ring. The other control characters go with it; a tab and a line break
 * are kept.
 */
// eslint-disable-next-line no-control-regex
const UNSENDABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g
const sendable = (v) => String(v ?? '').replace(UNSENDABLE, '')

/**
 * The sender's lines and the computer's, together inside LOG_BYTES.
 *
 * The sender's first: they are cut only to what is left once the computer's
 * share is kept back (no more of it than the computer's part needs), and they
 * lose their OLDEST lines if anything, so the newest always go. The computer
 * then has whatever room is left, which is never less than that share.
 */
export function fitLog(given, computer = '', cap = LOG_BYTES) {
  const mine = sendable(given)
  const theirs = sendable(computer).trim()
  if (!theirs) return trimToBytes(mine, cap)
  const gap = '\n\n'
  const share = Math.min(bytesOf(theirs), COMPUTER_BYTES)
  const own = trimToBytes(mine, cap - share - gap.length)
  if (!own) return trimComputer(theirs, cap)
  return own + gap + trimComputer(theirs, cap - bytesOf(own) - gap.length)
}

/**
 * What was going on, which is the part a person cannot be expected to type.
 *
 * The difference between a report that can be acted on and one that cannot is
 * almost always this: which version, which unit, how they were connected, and
 * what the last thing to go wrong was.
 *
 * NOTHING IDENTIFYING. No preset contents, no account details, nothing else
 * typed into the app. Every field is one the app already knows about itself,
 * and a field with nothing in it is left out rather than sent empty — an
 * `unit: ""` reads like a unit that answered with a blank name.
 */
export function contextFrom({
  version,
  macVersion,
  unit,
  role,
  platform,
  os,
  device,
  screen,
  language,
  lastError
} = {}) {
  const out = {}
  const put = (k, v) => {
    if (v !== undefined && v !== null && v !== '') out[k] = String(v)
  }
  put('version', version)
  /* Both ends, when there are two. "The phone is on 7.344 and the Mac is on
     7.191" is the answer to a surprising number of reports. */
  put('macVersion', macVersion)
  put('unit', unit)
  put('role', role)
  put('platform', platform)
  put('os', os)
  put('device', device)
  put('screen', screen)
  put('language', language)
  put('lastError', lastError)
  return out
}

/**
 * The last thing that went wrong, for the line above.
 *
 * Deliberately the message only. A stack trace belongs in the log, where it
 * is in order with everything around it; repeated at the top of the context
 * it is noise in the one place that should be readable at a glance.
 */
export function lastErrorFrom(lines = []) {
  const all = Array.isArray(lines) ? lines : []
  for (let i = all.length - 1; i >= 0; i--) {
    if (isTrouble(all[i])) return all[i].message || all[i].detail || ''
  }
  return ''
}

/**
 * Everything a report sends, assembled once so both apps send the same shape.
 *
 * Returns the log as `null` rather than an empty string when the kind does
 * not carry one — a column that is null says "no log was sent", and a column
 * holding "" says "a log was sent and it was empty", and those are different
 * answers to the question a reader is actually asking.
 */
export function buildReport({ kind, message, contact, context = {}, lines = [], format, computer = '' }) {
  const body = String(message ?? '').trim()
  if (!KINDS.includes(kind)) throw new Error('Say whether this is a bug or an idea.')
  if (!body) throw new Error('Write something first.')
  if (body.length > MAX_MESSAGE) throw new Error('That is longer than this box can send.')

  /* The computer's part rides with the log and never without it: no log, no
     computer log either (see fitLog for how the two share the cap). */
  let log = null
  if (carriesLog(kind) && typeof format === 'function') {
    const picked = pickForReport(lines)
    log = fitLog(picked.map(format).join('\n'), computer)
  }

  return {
    kind,
    message: body,
    contact: String(contact ?? '').trim() || null,
    context,
    log
  }
}
