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

/**
 * A NOTE, IF THEY WANT TO WRITE ONE.
 *
 * Justin, 22 October 2026, holding the email the one tap made: "Where's the
 * space to enter a message and upload photos?" So the log screen and the
 * Debug log have a box beside the button. It is optional, and the button
 * never waits for it: the one tap that sends with nothing written stays one
 * tap (the Feedback form's Send, which waits for words, is the form's own).
 *
 * A note typed is the message, in place of the app's sentence. A note of
 * nothing but spaces is no note.
 */
export const NOTE_PLACEHOLDER = 'What happened? (optional)'

/** The message a one-tap send carries: the note, or the app's own sentence when there is none. */
export function logsMessage(note) {
  const typed = String(note ?? '').trim()
  return typed ? typed.slice(0, MAX_MESSAGE) : LOGS_ONLY_MESSAGE
}

/**
 * SCREENSHOTS, UP TO THREE.
 *
 * A report says what the app did; a screenshot says what the person saw,
 * which is the half nobody can type. Three, because a fourth is almost
 * never a different problem and every one is a few hundred kilobytes over a
 * stage's two bars.
 *
 * SHRUNK BEFORE THEY GO. The browser draws each one again at no more than
 * SHOT_EDGE on its long side and writes it as a JPEG: a phone's screenshot
 * is about 2900 pixels tall and a Mac's about 2900 wide, and at 1600 the
 * words on a screen still read, at a third of the bytes. The phone has no
 * way to redraw a picture without a new build (no image library is built
 * into it), so it keeps the screenshot's size and asks the clipboard for a
 * JPEG at SHOT_PHONE_QUALITY, and once more at the lower one only if that is
 * still over SHOT_BYTES: each read of a pasted picture can make an iPhone
 * ask "Allow Paste?" again, so it is read as few times as it can be.
 *
 * SHOT_BYTES is the app's own cap on one picture, under the bucket's 2 MB
 * (supabase/migrations/20261022_report_screenshots.sql), so a picture the app
 * lets through is never one the server turns away. Three at the cap is
 * 4.5 MB, about 6 MB in the email, well inside both Resend's 40 MB and
 * Gmail's 25 MB.
 */
export const SHOTS_MAX = 3
export const SHOT_EDGE = 1600
export const SHOT_BYTES = 1_500_000
/** The browser's JPEG qualities, best first: the next only when a picture is still over SHOT_BYTES. */
export const SHOT_QUALITIES = [0.82, 0.6, 0.4]
/** The phone's: one read of the clipboard, and a second only for a picture still too big. */
export const SHOT_PHONE_QUALITIES = [0.6, 0.3]

/** Where they go: a private bucket, written to by the sender and read only by the email function. */
export const SHOT_BUCKET = 'report-shots'

/**
 * HOW LONG THE PICTURES MAY TAKE, and the row after them.
 *
 * All of them go at once and all of them get SHOT_WAIT_MS together; one
 * still going then is left behind, and the report goes without it, saying
 * so. The row itself gets SEND_WAIT_MS: a send never sits on "Sending…"
 * for ever on a connection that has stopped answering.
 */
export const SHOT_WAIT_MS = 20_000
export const SEND_WAIT_MS = 20_000

/**
 * A screenshot's place in the bucket: the sender's account id (or `anon`
 * for nobody signed in), then the report's own random key and which of the
 * three it is. The bucket's insert rule takes nothing else, and the email
 * function attaches nothing else, so a row cannot point it at somebody
 * else's picture.
 */
export const SHOT_PATH =
  /^(anon|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[1-3]\.jpg$/

export const shotPath = (owner, key, n) => `${owner || 'anon'}/${key}-${n}.jpg`

/**
 * A report's own random key. Not a secret (nothing can read the bucket but
 * the server), only different from every other report's.
 */
export function reportKey() {
  try {
    const made = globalThis.crypto?.randomUUID?.()
    if (made) return made
  } catch {
    /* Made by hand below. */
  }
  const hex = (n) => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`
}

/** The size to draw a picture at: its own, or smaller so its long side is `edge`. Never larger. */
export function shotSize(width, height, edge = SHOT_EDGE) {
  const w = Math.max(1, Math.round(Number(width) || 0))
  const h = Math.max(1, Math.round(Number(height) || 0))
  const long = Math.max(w, h)
  if (long <= edge) return { width: w, height: h }
  const k = edge / long
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

/** Bytes in a base64 string, without decoding it. */
export function base64Bytes(b64) {
  const s = String(b64 ?? '').replace(/\s/g, '')
  if (!s) return 0
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0
  return Math.floor((s.length * 3) / 4) - pad
}

/** The screenshots kept, with one more: never past SHOTS_MAX, and never a picture over SHOT_BYTES. */
export function withShot(shots = [], shot) {
  const list = Array.isArray(shots) ? shots : []
  if (!shot || list.length >= SHOTS_MAX) return list
  if (!(shot.size > 0) || shot.size > SHOT_BYTES) return list
  return [...list, shot]
}

/** What the screens say about screenshots, at both ends; the browser's words for a picked file. */
export const SHOT_WORDS = {
  full: `That's ${SHOTS_MAX} screenshots, the most one report can carry. Remove one to add another.`,
  tooBig: "That picture is too big to send, even made smaller. Pick a screenshot instead.",
  unreadable: "That picture couldn't be opened. Pick a screenshot or a photo (a .png or .jpg file).",
  limit: `Up to ${SHOTS_MAX}. They're made smaller before they go.`
}

/**
 * The phone's words for a paste. Nobody pasting can choose a file's format,
 * so these never name one, and say what to do next instead.
 *
 *   empty       the clipboard really has no picture. On an iPhone or iPad
 *               (inPhotos) it says how to copy one already in Photos: "I
 *               tried to paste this … it said no screenshot to paste." A
 *               screenshot goes to Photos, not to copy and paste, and the
 *               copy hint under the button only covers taking a new one
 *   refused     it has one, and the app was not handed it: "Don't Allow
 *               Paste" on an iPhone, or Paste from Other Apps set to Deny
 *               there, which asks nothing at all. iPhone and iPad only; on
 *               Android a picture that is there and not handed over is one
 *               that could not be read
 *   unreadable  the clipboard's picture could not be read
 *   tooBig      still over SHOT_BYTES at the lower quality, which a
 *               screenshot never is and a camera photo can be
 */
export const PASTE_WORDS = {
  empty: 'There’s no picture to paste. Copy a screenshot first.',
  inPhotos: 'There’s no picture to paste. For a screenshot already in Photos: open it there, tap Share, then Copy Photo. Then come back and tap Paste a screenshot.',
  refused:
    'The app wasn’t allowed to paste it. Tap Paste a screenshot again and choose Allow Paste. If you aren’t asked, go to Settings → Fractal Remote → Paste from Other Apps and choose Allow.',
  unreadable: 'That picture couldn’t be read. Copy the screenshot again and paste it.',
  tooBig: 'That picture is too big to send. Paste a screenshot rather than a photo.'
}

/** What a paste that brought no picture says, by why and on which system. */
export function pasteWords(why, os) {
  if (why === 'refused' && os !== 'ios') return PASTE_WORDS.unreadable
  if (why === 'empty' && os === 'ios') return PASTE_WORDS.inPhotos
  return PASTE_WORDS[why] || PASTE_WORDS.unreadable
}

/**
 * A thumbnail's size, the same at both ends: a fixed width and the picture's
 * own shape, no taller than THUMB_TALL (a phone's screenshot) and no shorter
 * than THUMB_LOW (a wide computer window, whole, rather than a strip from its
 * middle). A picture with no size known is drawn as a phone's.
 */
export const THUMB_TALL = 128
export const THUMB_LOW = 24

export function thumbSize(width, height, across = 64) {
  const w = Number(width) || 0
  const h = Number(height) || 0
  if (!(w > 0 && h > 0)) return { width: across, height: Math.round(across * 1.5) }
  return { width: across, height: Math.min(THUMB_TALL, Math.max(THUMB_LOW, Math.round((across * h) / w))) }
}

/** The one line said when pictures did not go, on the screen and in the report. */
export function shotsLostWords(lost) {
  if (!(lost > 0)) return ''
  return lost === 1
    ? "One screenshot couldn't be added, so the report went without it."
    : `${lost} screenshots couldn't be added, so the report went without them.`
}

/**
 * Put the pictures in the bucket, all at once, and say which went.
 *
 * `put(path, shot)` is each end's own upload, which throws when it fails.
 * Never throws itself and never waits past `wait`: a picture that fails or
 * is late is counted in `lost`, with the first reason in `why`, and the
 * report goes without it.
 */
export async function uploadShots(shots = [], { owner, key = reportKey(), put, wait = SHOT_WAIT_MS } = {}) {
  const list = (Array.isArray(shots) ? shots : []).slice(0, SHOTS_MAX)
  if (!list.length || typeof put !== 'function') return { paths: [], lost: 0, why: '' }
  let timer = null
  const late = new Promise((resolve) => {
    timer = setTimeout(() => resolve(NO_ANSWER), wait)
  })
  const one = async (shot, i) => {
    const path = shotPath(owner, key, i + 1)
    try {
      const done = await Promise.race([Promise.resolve().then(() => put(path, shot)), late])
      if (done === NO_ANSWER) return { why: `no answer within ${wait % 1000 ? `${wait} ms` : `${wait / 1000} seconds`}` }
      return { path }
    } catch (e) {
      return { why: e?.message || String(e) }
    }
  }
  try {
    const done = await Promise.all(list.map(one))
    const paths = done.map((d) => d.path).filter(Boolean)
    return { paths, lost: list.length - paths.length, why: done.find((d) => d.why)?.why || '' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The report's context with its pictures: where each one that went is, and
 * a line for any that did not. Inside context rather than a column of its
 * own, so the row the app inserts is the row it always inserted and no app
 * older than this one is touched by the change.
 */
export function withShots(context = {}, { paths = [], lost = 0, why = '' } = {}) {
  const out = { ...context }
  if (paths.length) out.screenshots = paths.slice(0, SHOTS_MAX)
  if (lost > 0) out.screenshotsLost = `${lost} of ${paths.length + lost} could not be added${why ? ` (${why})` : ''}`
  return out
}

/** What the phone's report screen sends as the message when only pictures or a video were added: a row has to say something. */
export const ATTACHED_ONLY_MESSAGE = 'No message written, only what is attached.'

/**
 * THE MESSAGE THE PHONE'S REPORT SCREEN SENDS (screens/Report): what was
 * written, and, when the screen was opened from Bluetooth or from a fault,
 * a line under it saying so, which is the one place that survives the log
 * being unticked. What was written stays the first line, which is what the
 * email's subject is made of; nothing written is ATTACHED_ONLY_MESSAGE.
 * Never longer than MAX_MESSAGE: what was written gives way to the line.
 */
export function formMessage({ typed = '', bluetooth = false, said = null } = {}) {
  const words = typeof said === 'string' ? said.trim().slice(0, 600) : ''
  const tail = [bluetooth ? 'Opened from Bluetooth.' : '', words ? `The app said: ${words}` : ''].filter(Boolean).join(' ')
  const room = MAX_MESSAGE - (tail ? tail.length + 2 : 0)
  const body = String(typed ?? '').trim().slice(0, room).trim() || ATTACHED_ONLY_MESSAGE
  return tail ? `${body}\n\n${tail}` : body
}

/*
 * A VIDEO IN A REPORT (29 October 2026). "A box to type out a message, upload
 * a photo or video, and have the log sent with what devices they're using"
 * (Justin, on the phone's report screen). One a report, picked from the
 * phone's own picker, which hands the app only the one picked and asks no
 * permission for it.
 *
 * NOT ATTACHED, LINKED. A screenshot is 1.5 MB at most and rides in the
 * email; a minute of video is tens of MB, past what an inbox takes. So it goes
 * to a private bucket of its own (`report-videos`), and the email carries a
 * link signed for VIDEO_LINK_DAYS, the days the bucket keeps it
 * (functions/feedback-email, migrations/20261029_report_videos.sql).
 *
 * VIDEO_BYTES is the project's own cap on any one upload (Storage's file
 * size limit, 50 MB), so a video under it is one the bucket takes. An iPhone
 * makes a picked video smaller as it hands it over (720p); Android hands the
 * file as it is, so a long one is turned away here, before anything is sent.
 *
 * VIDEO_PATH is the only shape a video's place may have, as SHOT_PATH is
 * for a picture: the sender's folder, the report's key, and its kind. The
 * bucket's insert rule and the email function take nothing else; a test
 * holds the three to each other.
 */
export const VIDEO_BUCKET = 'report-videos'
export const VIDEO_BYTES = 50 * 1024 * 1024
export const VIDEO_LINK_DAYS = 7
/** How long the video may take to go: minutes, not seconds, on a phone's upload. */
export const VIDEO_WAIT_MS = 300_000
/** Each kind of video the bucket takes, by the ending its place has. */
export const VIDEO_TYPES = Object.freeze({ mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp' })
export const VIDEO_PATH =
  /^(anon|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-video\.(mp4|mov|webm|3gp)$/

export const videoPath = (owner, key, ext) => `${owner || 'anon'}/${key}-video.${VIDEO_TYPES[ext] ? ext : 'mp4'}`

/**
 * Which kind a picked video is, from what the picker said its type was, or
 * the ending of its file: a key of VIDEO_TYPES, or null for one the bucket
 * would turn away.
 */
export function videoKind(mimeType, uri = '') {
  const type = String(mimeType || '').toLowerCase()
  for (const [ext, t] of Object.entries(VIDEO_TYPES)) if (type === t) return ext
  const end = String(uri || '').toLowerCase().split('?')[0].match(/\.([a-z0-9]+)$/)?.[1]
  if (end === 'qt') return 'mov'
  if (end === 'm4v') return 'mp4'
  return end && VIDEO_TYPES[end] ? end : null
}

/** A size in MB, in the words a person reads: "12 MB", "0.4 MB". */
export function mbWords(bytes) {
  const mb = (Number(bytes) || 0) / (1024 * 1024)
  return `${mb >= 10 ? Math.round(mb) : Math.max(0.1, Math.round(mb * 10) / 10)} MB`
}

/** How long a video runs, from the picker's milliseconds: "0:34", "2:05". Empty when it did not say. */
export function videoLength(ms) {
  const s = Math.round((Number(ms) || 0) / 1000)
  if (!(s > 0)) return ''
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** What the screens say about a video, in the picker's words, never a file format. */
export const VIDEO_WORDS = {
  one: 'One video a report. Remove it to add a different one.',
  tooBig: (bytes) =>
    `That video is too big to send (${mbWords(bytes)}; a report can carry ${mbWords(VIDEO_BYTES)}). Trim it in your Photos app, or choose a shorter one.`,
  unreadable: 'That video couldn’t be opened. Choose another one.'
}

/** The one line said when the video did not go, on the screen and in the report. */
export function videoLostWords(lost) {
  return lost ? "The video couldn't be added, so the report went without it." : ''
}

/**
 * The report's context with its video: where it went, or a line saying it
 * could not be added. Inside context, as the screenshots are, so the row is
 * the row every app has always inserted.
 */
export function withVideo(context = {}, { path = '', why = '' } = {}) {
  const out = { ...context }
  if (path && VIDEO_PATH.test(path)) out.video = path
  else if (why) out.videoLost = `the video could not be added (${why})`
  return out
}

/** Waits for `work`, or for `wait`, and throws a network error past it. */
export async function inTime(work, wait = SEND_WAIT_MS) {
  let timer = null
  const late = new Promise((resolve) => {
    timer = setTimeout(() => resolve(NO_ANSWER), wait)
  })
  try {
    const done = await Promise.race([Promise.resolve().then(work), late])
    if (done === NO_ANSWER) throw new Error(`network: no answer within ${wait % 1000 ? `${wait} ms` : `${wait / 1000} seconds`}`)
    return done
  } finally {
    clearTimeout(timer)
  }
}

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
  /*
   * The app's own deadline (inTime), not a dropped connection: the row may
   * still land after it, and sending again at once would make a second
   * report and a second email. So it says to wait.
   */
  if (/no answer within/i.test(said)) {
    return wrote
      ? "The internet didn't answer in time. It may still arrive, so wait a minute before sending it again. What you wrote is still here."
      : "The internet didn't answer in time. It may still arrive, so wait a minute before sending it again."
  }
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
  if (via === 'bluetooth') return 'Bluetooth is on, so the unit is reached without a computer'
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
  return fitReport({ mine: given, computer }, cap)
}

/**
 * THE HEAD OF A REPORT'S LOG: the lines Copy Logs has always put at the top
 * (which build, which unit, which computer and which of them is driven, the
 * versions at both ends), as `key: value` lines.
 *
 * "Is this all the information the logs send?" The email had the context and
 * nothing else, and the row's log began with its first timestamp, so the
 * header a paste carries was in neither. Now it starts every report's log,
 * and the email puts it in its body. Its first key is `app`, which is how
 * the email tells a log with a head from one sent by an older app.
 */
export const HEAD_BYTES = 3000

export function headLines(header = {}) {
  const lines = Object.entries(header || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
  return trimToBytes(lines.join('\n'), HEAD_BYTES)
}

/**
 * THE RUNS BEFORE THIS ONE, labeled.
 *
 * The phone keeps the end of its last three runs on disk (mobile/src/lib/
 * logKeep.js), and Copy Logs has carried them, but a report sent only this
 * run: and "every time I open the app now…" is a report about the run that
 * ended. So a report carries them too, under the headings the paste has
 * always used, newest first, inside the same LOG_BYTES.
 *
 * `when` turns a run's time into words; each end says it its own way.
 */
export const BEFORE_BYTES = 24_000

export function beforeBlocks(runs = [], when = (at) => (at ? new Date(at).toISOString() : 'at an unknown time')) {
  return (Array.isArray(runs) ? runs : [])
    .filter((run) => Array.isArray(run?.lines) && run.lines.length)
    .map((run, i) =>
      [
        `${i === 0 ? 'THE RUN BEFORE THIS ONE' : `${i + 1} RUNS AGO`} — ${run.lines.length} lines, oldest first, last written ${when(run.at)}`,
        '(if the app crashed or was killed, this is what it said on the way)',
        ...run.lines.map((l) => String(l ?? ''))
      ].join('\n')
    )
}

/**
 * The runs before, cut to `cap`. The run before this one comes first and is
 * the one that matters, so it is kept, losing its OLDEST lines if anything
 * (its last lines are what it said on the way out) and never its two-line
 * heading. An older run goes in only whole, and only if it fits.
 */
export function fitBefore(blocks = [], cap = BEFORE_BYTES) {
  const list = (Array.isArray(blocks) ? blocks : [blocks]).map((b) => sendable(b).trim()).filter(Boolean)
  if (!list.length || cap <= 0) return ''
  const gap = '\n\n'
  const [first, ...older] = list
  let out = first
  if (bytesOf(first) > cap) {
    const lines = first.split('\n')
    const heading = lines.slice(0, 2).join('\n')
    const room = cap - bytesOf(heading) - 1
    if (room < 200) return ''
    out = `${heading}\n${trimToBytes(lines.slice(2).join('\n'), room)}`
  }
  for (const block of older) {
    if (bytesOf(out) + gap.length + bytesOf(block) > cap) break
    out += gap + block
  }
  return out
}

/**
 * THE WHOLE LOG OF A REPORT, inside LOG_BYTES: the head, the sender's own
 * lines, the runs before, and the computer's own log, in that order, each
 * after a blank line.
 *
 * The sender's lines come first in the budget as they always have: the head
 * (at most HEAD_BYTES) is paid for, the computer's share (COMPUTER_BYTES, no
 * more than it needs) and the runs' share (BEFORE_BYTES, no more than they
 * need) are kept back, and the sender's lines have the rest, losing their
 * oldest if anything. The runs before then have at most their share, and the
 * computer whatever is left, never less than its own. With no head and no
 * runs before this is exactly what fitLog always was.
 */
export function fitReport({ head = '', mine = '', before = [], computer = '' } = {}, cap = LOG_BYTES) {
  const top = trimToBytes(sendable(head).trim(), HEAD_BYTES)
  const own0 = sendable(mine)
  const blocks = (Array.isArray(before) ? before : [before]).map((b) => sendable(b).trim()).filter(Boolean)
  const theirs = sendable(computer).trim()
  const gap = '\n\n'
  if (!top && !blocks.length) {
    /* fitLog as it always was, byte for byte. */
    if (!theirs) return trimToBytes(own0, cap)
    const share = Math.min(bytesOf(theirs), COMPUTER_BYTES)
    const own = trimToBytes(own0, cap - share - gap.length)
    if (!own) return trimComputer(theirs, cap)
    return own + gap + trimComputer(theirs, cap - bytesOf(own) - gap.length)
  }
  const parts = []
  let used = 0
  const add = (text) => {
    if (!text) return
    used += (parts.length ? gap.length : 0) + bytesOf(text)
    parts.push(text)
  }
  add(top)
  const runsShare = blocks.length ? Math.min(bytesOf(blocks.join(gap)), BEFORE_BYTES) + gap.length : 0
  const compShare = theirs ? Math.min(bytesOf(theirs), COMPUTER_BYTES) + gap.length : 0
  add(trimToBytes(own0, Math.max(0, cap - used - gap.length - runsShare - compShare)))
  if (blocks.length) add(fitBefore(blocks, Math.min(BEFORE_BYTES, cap - used - gap.length - compShare)))
  if (theirs) add(trimComputer(theirs, cap - used - gap.length))
  return parts.join(gap)
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
 * A report's log, from the log's own lines: the one function the send and
 * the Feedback form's preview both call, so what is shown cannot drift from
 * what goes.
 */
export function reportLog({ lines = [], format, head = '', before = [], computer = '' } = {}) {
  return fitReport({ head, mine: pickForReport(lines).map(format).join('\n'), before, computer })
}

/**
 * Everything a report sends, assembled once so both apps send the same shape.
 *
 * Returns the log as `null` rather than an empty string when the kind does
 * not carry one — a column that is null says "no log was sent", and a column
 * holding "" says "a log was sent and it was empty", and those are different
 * answers to the question a reader is actually asking.
 */
export function buildReport({ kind, message, contact, context = {}, lines = [], format, computer = '', head = '', before = [] }) {
  const body = String(message ?? '').trim()
  if (!KINDS.includes(kind)) throw new Error('Say whether this is a bug or an idea.')
  if (!body) throw new Error('Write something first.')
  if (body.length > MAX_MESSAGE) throw new Error('That is longer than this box can send.')

  /* The computer's part rides with the log and never without it: no log, no
     computer log either, and no head or runs before (see fitReport for how
     the four share the cap). */
  let log = null
  if (carriesLog(kind) && typeof format === 'function') {
    log = reportLog({ lines, format, head, before, computer })
  }

  return {
    kind,
    message: body,
    contact: String(contact ?? '').trim() || null,
    context,
    log
  }
}
