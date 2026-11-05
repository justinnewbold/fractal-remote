/**
 * GOOGLE PLAY FROM GITHUB — the store listing's words, its pictures, and
 * Google's own crash reports, by a robot that cannot touch a release.
 *
 * Until 3 November 2026 every Play Console job was a prompt pasted into
 * somebody else's browser. Justin made a robot for it instead,
 * fractal-remote-listing, with no account-wide permissions at all and, on
 * Fractal Remote only, "Manage store presence" and "View app information
 * (read-only)" (and the two Google ties to the first: "View app quality
 * information (read-only)" and "Manage policy declarations"). Its key is the
 * GOOGLE_PLAY_KEY secret. Not the robot Expo sends the builds with: this one
 * cannot touch a release or another app, and the job refuses any other
 * robot's key, so it never will.
 *
 * The job does less than the key can. It reads and writes the listing's
 * three texts and reads the pictures and the vitals, and nothing else. But
 * Google's "Manage store presence" also changes the price, the in-app
 * products, the countries and the content rating, and "Manage policy
 * declarations" edits Data safety, so a key that leaked could do all of
 * that. Which is why it lives in one step's environment, masked, and is
 * never printed.
 *
 * Three things, one at a time:
 *
 *   listing  what Play's listing says, next to store/google-play/, and what
 *            would change. The live listing is the truth Justin set by hand,
 *            so this only SHOWS, and the draft it opens in Play Console to
 *            read it is thrown away, unless "Write it" is ticked.
 *   images   the screenshots, the icon and the feature graphic, with a link
 *            to each. Only read.
 *   vitals   how often the app crashed or froze in the last 28 days, against
 *            Google's lines, and the problems that came up most. Only read.
 *
 * Run by .github/workflows/play-text.yml, by hand, from main only.
 *
 *   node scripts/play-text.mjs                   shows what is there and what would change
 *   node scripts/play-text.mjs --apply           writes the languages that differ, sends them to Google's review, reads them back
 *   node scripts/play-text.mjs --apply --hold    the same, but leaves them in Play Console to send by hand
 *   node scripts/play-text.mjs --mode images     the pictures, read only
 *   node scripts/play-text.mjs --mode vitals     crashes and freezes, read only
 *
 * Node's own fetch and crypto, and nothing from npm: the job installs nothing.
 */
import { createPrivateKey, sign } from 'node:crypto'
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { NOT_AFFILIATED, TRADEMARKS } from '../shared/affiliation.mjs'

const app = JSON.parse(readFileSync(new URL('../mobile/app.json', import.meta.url), 'utf8')).expo

/** The package the Android app is built as, which is what Play files it under. */
export const PACKAGE = app.android.package
/** The name, which stays (CLAUDE.md: never suggest renaming). */
export const APP_NAME = app.name

/** The one robot this job takes a key from. */
export const LISTING_ROBOT = 'fractal-remote-listing@fractal-remote.iam.gserviceaccount.com'
export const TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const SCOPES = {
  publisher: 'https://www.googleapis.com/auth/androidpublisher',
  reporting: 'https://www.googleapis.com/auth/playdeveloperreporting'
}
export const PUBLISHER = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`
export const REPORTING = `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${PACKAGE}`
export const MODES = ['listing', 'images', 'vitals']

/** Play's three boxes, the words they are called in a sentence, and the file each is kept in. */
export const FIELDS = [
  ['title', 'title', 'title.txt'],
  ['shortDescription', 'short description', 'short_description.txt'],
  ['fullDescription', 'full description', 'full_description.txt']
]
/** Google's limits, in characters (an emoji or an accented letter is one). */
export const LIMITS = { title: 30, shortDescription: 80, fullDescription: 4000 }

/** Where the repo keeps Play's words: one folder per language, one file per box. */
export const REPO_DIR = fileURLToPath(new URL('../store/google-play/', import.meta.url))
/**
 * The marker on a folder filled from docs/app-store.md rather than read from
 * Play. While it is there, Write it is refused for every language: the live
 * listing is what Justin set by hand, and a copy that was never checked
 * against it would put the old words back over his.
 */
export const UNCHECKED = 'UNCHECKED.txt'

/** Every kind of picture Google's interface lists. Chromebook screenshots are not among them. */
export const IMAGE_TYPES = [
  ['phoneScreenshots', 'Phone screenshots'],
  ['sevenInchScreenshots', '7-inch tablet screenshots'],
  ['tenInchScreenshots', '10-inch tablet screenshots'],
  ['tvScreenshots', 'TV screenshots'],
  ['wearScreenshots', 'Watch screenshots'],
  ['icon', 'Icon'],
  ['featureGraphic', 'Feature graphic'],
  ['tvBanner', 'TV banner']
]

const length = (s) => [...String(s ?? '')].length
const count = (n) => n.toLocaleString('en-US')

/*
 * THE KEY. A service-account file, JSON, read from the environment and
 * nowhere else. Every message about it is a fixed sentence: JSON.parse's own
 * error quotes the text it choked on, and the text is the key, in a log the
 * whole world can read (the repository is public).
 */
const NOT_A_KEY = 'GOOGLE_PLAY_KEY is not a Google service-account key file'

/*
 * GitHub masks the secret as it is stored: one line of JSON, the key's line
 * breaks written as \n. Parsed, the key has real line breaks, and no mask
 * matches a line of it, so each line is masked the moment it exists (its
 * BEGIN and END lines are the same in every key, and are not secret).
 */
export function serviceAccount(raw, mask = () => {}) {
  let key
  try {
    key = JSON.parse(String(raw ?? ''))
  } catch {
    throw new Error(NOT_A_KEY)
  }
  if (typeof key?.private_key === 'string') {
    for (const line of key.private_key.split(/\r?\n/)) {
      if (line.trim() && !/^-----(BEGIN|END) [A-Z ]+-----$/.test(line.trim())) mask(line.trim())
    }
  }
  if (!key || typeof key !== 'object' || key.type !== 'service_account') throw new Error(NOT_A_KEY)
  for (const f of ['client_email', 'private_key', 'private_key_id']) {
    if (typeof key[f] !== 'string' || !key[f]) throw new Error(`${NOT_A_KEY}: it has no ${f}`)
  }
  if (key.client_email !== LISTING_ROBOT) {
    /* A robot's address is not secret; anything else in that box is not named. */
    const who = /^[\w.-]+@[\w.-]+\.iam\.gserviceaccount\.com$/.test(key.client_email) ? key.client_email : 'another account'
    throw new Error(`GOOGLE_PLAY_KEY belongs to ${who}, not the listing robot (${LISTING_ROBOT}); this job takes that robot's key and no other`)
  }
  let type
  try {
    type = createPrivateKey(key.private_key).asymmetricKeyType
  } catch {
    throw new Error(`${NOT_A_KEY}: its private_key is not a key`)
  }
  if (type !== 'rsa') throw new Error(`${NOT_A_KEY}: its private_key is not an RSA key, and Google signs these with RSA`)
  return { email: key.client_email, privateKey: key.private_key, keyId: key.private_key_id }
}

/**
 * The signed note Google trades for an hour's access: RS256 (RSA with
 * SHA-256, which is what Node's sign gives for an RSA key), the key's id in
 * the header, the robot in the body, and an hour at most (Google refuses a
 * longer one).
 */
export function assertion({ email, privateKey, keyId, scope, now = Math.floor(Date.now() / 1000) }) {
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = part({ alg: 'RS256', typ: 'JWT', kid: keyId })
  const body = part({ iss: email, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  const signature = sign('sha256', Buffer.from(`${head}.${body}`), createPrivateKey(privateKey))
  return `${head}.${body}.${signature.toString('base64url')}`
}

/** An access token for one scope. Neither the note nor the token is ever printed, and both are masked as soon as they exist. */
export async function accessToken({ key, scope, fetch, now, mask = () => {} }) {
  const note = assertion({ ...key, scope, now })
  mask(note)
  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: note
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  })
  let answer = {}
  try {
    answer = JSON.parse(await res.text())
  } catch {}
  if (!res.ok || typeof answer?.access_token !== 'string' || !answer.access_token) {
    const why = [answer?.error, answer?.error_description].filter((x) => typeof x === 'string').join(' ').slice(0, 300)
    throw new Error(`Google refused the sign-in (${res.status}): ${why || 'no reason given'}`)
  }
  mask(answer.access_token)
  return answer.access_token
}

/** What Google answered, when it was not yes. Its words are kept, cut short; never a header. */
export class PlayError extends Error {
  constructor({ api, method, path, status, text }) {
    super(`${method} ${path} answered ${status}: ${text}`)
    Object.assign(this, { api, method, path, status, text })
  }
}

/** Calls to one of Google's two interfaces, with the token. */
export function client({ base, token, fetch }) {
  const api = base.includes('playdeveloperreporting') ? 'the Google Play Developer Reporting API' : 'the Google Play Android Developer API'
  return async function call(method, path, { query, body } = {}) {
    const pairs = Object.entries(query ?? {}).filter(([, v]) => v !== undefined && v !== null)
    const qs = pairs.length ? `?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}` : ''
    const res = await fetch(`${base}${path}${qs}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
    const text = await res.text()
    if (!res.ok) throw new PlayError({ api, method, path: `${path}${qs}`, status: res.status, text: text.slice(0, 800) })
    return text ? JSON.parse(text) : {}
  }
}

/**
 * The permission a refused call needed, by the call. Google's own words for
 * a refusal ("The caller does not have permission") never name one.
 */
export function permissionFor(err) {
  if (err.api.includes('Reporting')) return 'View app quality information (read-only)'
  if (err.method === 'PUT' || /:(validate|commit)\b/.test(err.path)) return 'Manage store presence'
  return 'View app information (read-only)'
}

/*
 * Google has two opposite answers about the hold box (fastlane's
 * supply/lib/supply/client.rb catches both): "Please set the query parameter
 * changesNotSentForReview to true", when this app's changes cannot go to
 * review by themselves, and "The query parameter changesNotSentForReview
 * must not be set", when they can only go that way. The first can come from
 * :validate as well as :commit.
 */
const HOLD_NEEDED = /changesNotSentForReview\W+to\s+true/i
const HOLD_REFUSED = /changesNotSentForReview\W+must not be set/i

/** Google's answer, in words that say what to do. `hold` is whether the hold box was ticked. */
export function explain(err, { hold = false } = {}) {
  if (!(err instanceof PlayError)) return err.message
  const google = ` (Google: ${err.text})`
  if (/:(validate|commit)\b/.test(err.path)) {
    if (HOLD_REFUSED.test(err.text)) {
      return 'Google sends this app\'s changes to review by itself right now, so it will not hold this one back. Nothing went out. Run it again with "Write it" alone, and the change goes to Google\'s review as usual.' + google
    }
    if (HOLD_NEEDED.test(err.text) && !hold) {
      return 'Google will not send this change for review by itself. Nothing went out. Run it again with "Write it" and the hold box both ticked, then send it from Play Console → Publishing overview → Send changes for review.' + google
    }
  }
  if (/:commit\b/.test(err.path) && !/changesNotSentForReview/.test(err.text) && /review/i.test(err.text)) {
    return 'Google is reviewing something else for this app right now, probably the new Android build. Nothing was sent, and that review goes on as it was. Run this again once it is over.' + google
  }
  if (err.status === 403 && /SERVICE_DISABLED|has not been used in project|it is disabled/i.test(err.text)) {
    return `${err.api[0].toUpperCase()}${err.api.slice(1)} is switched off in the fractal-remote Google Cloud project: Google Cloud → fractal-remote → APIs & Services → Library → search for it → Enable.` + google
  }
  if (err.status === 401 || err.status === 403) {
    return (
      `The robot needs "${permissionFor(err)}" on Fractal Remote for this (${err.method} ${err.path}): Play Console → Users and permissions → fractal-remote-listing → App permissions. ` +
      'A permission given in the last day may not have reached Google\'s interface yet.' +
      google
    )
  }
  return err.message
}

/*
 * THE REPO'S COPY. One folder per language (en-US), one file per box, the
 * full description one paragraph a line, as Play shows it: so a change to one
 * paragraph is one line in a pull request, not the whole description.
 */
export const norm = (s) => String(s ?? '').replace(/\r\n?/g, '\n').trimEnd()
export const same = (a, b) => norm(a) === norm(b)

export function readRepo(dir = REPO_DIR) {
  if (!existsSync(dir)) throw new Error('store/google-play/ is not in the repo')
  const out = {}
  for (const entry of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const lang = entry.name
    if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(lang)) throw new Error(`store/google-play/${lang} is not a language Play knows (en-US, say)`)
    const listing = { language: lang, unchecked: existsSync(join(dir, lang, UNCHECKED)) }
    for (const [field, , file] of FIELDS) {
      const p = join(dir, lang, file)
      if (!existsSync(p)) throw new Error(`store/google-play/${lang} has no ${file}`)
      listing[field] = norm(readFileSync(p, 'utf8'))
    }
    out[lang] = listing
  }
  if (!Object.keys(out).length) throw new Error('store/google-play/ has no language in it')
  return out
}

/** Line by line (a line is a paragraph): what Play says ('-'), what the repo says ('+'), and what both say (' '). */
export function diffLines(was, now) {
  const a = norm(was).split('\n')
  const b = norm(now).split('\n')
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  }
  const out = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: ' ', text: a[i] })
      i++
      j++
    } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ kind: '-', text: a[i++] })
    else out.push({ kind: '+', text: b[j++] })
  }
  while (i < a.length) out.push({ kind: '-', text: a[i++] })
  while (j < b.length) out.push({ kind: '+', text: b[j++] })
  return out
}

/** The difference as it is printed: a line of what both say either side of a change, the rest folded. */
export function showDiff(diff) {
  const near = (k) => [k - 1, k + 1].some((x) => diff[x] && diff[x].kind !== ' ')
  const lines = []
  let folded = 0
  const fold = () => {
    if (folded) lines.push(`    … (${folded} ${folded === 1 ? 'line' : 'lines'} the same)`)
    folded = 0
  }
  diff.forEach((d, k) => {
    if (d.kind === ' ' && !near(k)) return void folded++
    fold()
    lines.push(`  ${d.kind} ${d.text}`.trimEnd())
  })
  fold()
  return lines.join('\n')
}

/*
 * WHAT IS NEVER WRITTEN. Each of these is a rule this project already holds
 * its own store texts to (test/limits.mjs, test/independent.mjs, CLAUDE.md),
 * checked here on the words that would be live, before anything is sent.
 */
/* The same list test/independent.mjs holds the repo's own texts to, word for word (a test keeps the two the same). */
export const NEVER = /\b(official\w*|certified|approved|endorsed|authori[sz]ed)\b/i
const DISCLAIMER = /not affiliated with, endorsed by, or\s+supported by/gi
/* "free" as its own word, so "hands-free" and "free-standing" are not it. */
const FREE_APP = /(?<![\w-])free(?![\w-])[^.\n]{0,40}\bapp\b|\bapp\b[^.\n]{0,20}\bis free(?![\w-])/i
/* Edit (Beta) is another feature, and keeps its word (CLAUDE.md); every other beta in a text about Bluetooth reads as Bluetooth's. */
const EDIT_BETA = /\bEdit \(Beta\)/gi
/* Capitals that are a name, not emphasis: Google's policy allows "ALL CAPS" that is "part of brand name". */
const NOT_SHOUTING = new Set(['MIDI', 'WIDI'])
/* Characters nobody sees, which would hide a word from these rules: zero-width spaces and joiners, the word joiner, the byte-order mark, the soft hyphen. */
export const unseen = (s) => String(s ?? '').replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')

export function problems(listing) {
  const out = []
  for (const [field, name] of FIELDS) {
    const text = norm(listing[field])
    if (!text) out.push(`the ${name} is empty`)
    else if (length(text) > LIMITS[field]) {
      out.push(`the ${name} is ${count(length(text))} characters; Google Play takes ${count(LIMITS[field])}`)
    }
  }
  if (norm(listing.title) && norm(listing.title) !== APP_NAME) out.push(`the title is "${norm(listing.title)}", and the app is called ${APP_NAME}`)
  const full = norm(listing.fullDescription)
  /* Fractal Audio's sentence, word for word (their letter of 18 October 2026), and the trademark line every Description carries. */
  if (!full.includes(NOT_AFFILIATED)) out.push(`the full description does not carry Fractal Audio's sentence word for word: "${NOT_AFFILIATED}"`)
  if (!full.includes(TRADEMARKS)) out.push(`the full description does not carry the trademark line word for word: "${TRADEMARKS}"`)
  for (const [field, name] of FIELDS) {
    const text = unseen(norm(listing[field]))
    if (/Fractal Audio Systems,? Inc\b/.test(text)) out.push(`the ${name} calls Fractal Audio "Inc."; it is Fractal Audio Systems, LLC`)
    if (/sponsored by/i.test(text)) out.push(`the ${name} says "sponsored by" where Fractal Audio asked for "supported by"`)
    const never = text.replace(DISCLAIMER, '').match(NEVER)
    if (never) out.push(`the ${name} says "${never[0]}" (never official, certified, approved or endorsed about the app)`)
    if (/bluetooth\s*\(beta\)/i.test(text) || (/bluetooth/i.test(text) && /\bbeta\b/i.test(text.replace(EDIT_BETA, '')))) {
      out.push(`the ${name} calls Bluetooth a beta, and it has not been one since 26 October 2026 (Edit (Beta) is the one beta a text about Bluetooth may name)`)
    }
    const tried = text.match(/\b(tried|untried|tested|untested)\b/i)
    if (tried) out.push(`the ${name} says "${tried[0]}": what has been tried is kept on the Developer page, never in a store text`)
    if (FREE_APP.test(text)) out.push(`the ${name} calls an app free, which reads as though the phone app were`)
  }
  const shout = [...unseen(norm(listing.shortDescription)).matchAll(/\b[A-Z]{4,}\b/g)].map((m) => m[0]).find((w) => !NOT_SHOUTING.has(w))
  if (shout) out.push(`the short description shouts ("${shout}"), which Google's metadata policy calls a violation`)
  return out
}

/** A text in the step summary, fenced so it can be copied exactly. */
const block = (text) => {
  const fence = '~'.repeat(Math.max(4, ...[...String(text).matchAll(/~+/g)].map((m) => m[0].length + 1)))
  return `${fence}text\n${text}\n${fence}\n`
}

/** Default language first, then the rest in order. */
const ordered = (listings, first) =>
  [...listings].sort((a, b) => (a.language === first ? -1 : b.language === first ? 1 : a.language.localeCompare(b.language)))

/*
 * THE DATES THE REPORTS ARE ASKED FOR. Google's daily figures are days in
 * Los Angeles, given with no hours; its error search wants whole hours, in
 * UTC. Both come from what Google says it has (its "freshness"), so the
 * window ends where its data does.
 */
export function daysBefore({ year, month, day, ...rest }, n) {
  const d = new Date(Date.UTC(year, month - 1, day - n))
  return { ...rest, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/* A daily point is a day and its zone: Google refuses one that carries hours, minutes, seconds or nanos. */
export const wholeDay = ({ year, month, day, timeZone }) => ({ year, month, day, ...(timeZone ? { timeZone } : {}) })

export const hourFloorUTC = (date) => new Date(Math.floor(new Date(date).getTime() / 3_600_000) * 3_600_000)

export function flatInterval(start, end) {
  const out = {}
  for (const [k, d] of [['startTime', start], ['endTime', end]]) {
    out[`interval.${k}.year`] = d.getUTCFullYear()
    out[`interval.${k}.month`] = d.getUTCMonth() + 1
    out[`interval.${k}.day`] = d.getUTCDate()
    out[`interval.${k}.hours`] = d.getUTCHours()
    out[`interval.${k}.timeZone.id`] = 'UTC'
  }
  return out
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const dayWords = (t) => (t?.year ? `${t.day} ${MONTHS[t.month - 1]} ${t.year}` : 'the last day Google has')
const dayKey = (t) => Date.UTC(t?.year ?? 0, (t?.month ?? 1) - 1, t?.day ?? 1)

/** Today in Los Angeles, as Google's daily figures count days, for when Google gives no end. */
const laToday = (now) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(new Date(now))
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)])
  )
  return { year: parts.year, month: parts.month, day: parts.day, timeZone: { id: 'America/Los_Angeles' } }
}

/**
 * The two rates Google judges an app by, and its lines for them
 * (developer.android.com/topic/performance/vitals).
 *
 * THE SCALE IS NOT CONFIRMED YET. Google's reference calls each a
 * "Percentage of distinct users", as a google.type.Decimal, and shows no
 * value. This reads it as a fraction of 1 (0.0012 is 0.12%), unless a value
 * in the set is over 1, which a fraction cannot be, and then as a percentage
 * already. Each rate line prints Google's own figure beside it, so the first
 * real run can be checked against Play Console → Android vitals; when it has
 * been, say so here, with the date.
 */
const RATES = [
  {
    set: 'crashRateMetricSet',
    name: 'Crashes',
    perceived: 'userPerceivedCrashRate28dUserWeighted',
    all: 'crashRate28dUserWeighted',
    daily: 'userPerceivedCrashRate',
    line: 1.09,
    allWords: 'counting crashes nobody saw, in the background'
  },
  {
    set: 'anrRateMetricSet',
    name: 'Freezes (ANR: the app stopped answering)',
    perceived: 'userPerceivedAnrRate28dUserWeighted',
    all: 'anrRate28dUserWeighted',
    daily: 'userPerceivedAnrRate',
    line: 0.47,
    allWords: 'counting freezes nobody saw'
  }
]

const KINDS = { CRASH: 'Crash', APPLICATION_NOT_RESPONDING: 'Freeze (ANR)', NON_FATAL: 'Caught error' }

/**
 * The whole job, with Google, the key, the log and the repo folder handed in,
 * so the tests can run every path of it with no network and no real key.
 */
export async function run({
  mode = 'listing',
  apply = false,
  hold = false,
  rawKey,
  fetch,
  log = console.log,
  repoDir = REPO_DIR,
  summary = () => {},
  mask = () => {},
  now = Date.now()
} = {}) {
  if (!MODES.includes(mode)) throw new Error(`there is no mode "${mode}": it is listing, images or vitals`)
  const seconds = Math.floor(now / 1000)
  try {
    if (mode === 'listing') return await listing({ apply, hold, rawKey, fetch, log, repoDir, summary, mask, seconds })
    if (apply || hold) log(`"Write it" does nothing in ${mode}: it only reads. Nothing was written.\n`)
    if (mode === 'images') return await images({ rawKey, fetch, log, mask, seconds })
    return await vitals({ rawKey, fetch, log, mask, seconds, now })
  } catch (err) {
    if (err instanceof PlayError) throw Object.assign(new Error(explain(err, { hold })), { cause: err })
    throw err
  }
}

/**
 * Opens a draft, hands it to `work`, and throws it away after unless `work`
 * says it was committed. `sending` is set while a commit is out with Google
 * and its answer is not in: if the answer is lost (the connection dropped, a
 * 5xx, a timeout), Google may have taken it, and a draft that cannot be
 * thrown away then is most likely one Google already sent.
 */
async function inEdit(call, log, work) {
  const edit = await call('POST', '/edits', { body: {} })
  const state = { committed: false, sending: false }
  try {
    return await work(edit.id, state)
  } finally {
    if (!state.committed) {
      try {
        await call('DELETE', `/edits/${edit.id}`)
      } catch (err) {
        /* Never louder than what went wrong first: an unused draft expires by itself. */
        log(
          state.sending
            ? `::warning::The send may have reached Google before its answer was lost (the draft could not be thrown away after: ${err.status ?? err.message}). Check Play Console → Publishing overview before running this again.`
            : `::warning::The draft opened in Play Console to read this was not thrown away (${err.status ?? err.message}). Nothing in it was sent, and Google throws it away by itself.`
        )
      }
    }
  }
}

async function listing({ apply, hold, rawKey, fetch, log, repoDir, summary, mask, seconds }) {
  const repo = readRepo(repoDir)
  const langs = Object.keys(repo).sort()

  /* BEFORE ANYTHING IS SENT: the limits and the words, on every language the repo has. */
  const found = langs.flatMap((lang) => problems(repo[lang]).map((p) => `${lang}: ${p}`))
  const unchecked = langs
    .filter((lang) => repo[lang].unchecked)
    .map(
      (lang) =>
        `${lang}: store/google-play/${lang} was filled from docs/app-store.md, not read from Play. Copy Play's own text in from a run without "Write it" (its summary has it) and delete store/google-play/${lang}/${UNCHECKED} first`
    )
  if (apply && (found.length || unchecked.length)) {
    throw new Error(`Nothing was sent. "Write it" is refused:\n${[...found, ...unchecked].map((p) => `  - ${p}`).join('\n')}`)
  }
  if (found.length) {
    log('Would be refused if written:')
    for (const p of found) log(`::warning::${p}`)
  }
  for (const p of unchecked) log(`::warning::${p}`)
  if (hold && !apply) log('The hold box does nothing without "Write it".')

  const key = serviceAccount(rawKey, mask)
  const token = await accessToken({ key, scope: SCOPES.publisher, fetch, now: seconds, mask })
  const call = client({ base: PUBLISHER, token, fetch })

  const changes = await inEdit(call, log, async (id, state) => {
    const details = await call('GET', `/edits/${id}/details`)
    const { listings = [] } = await call('GET', `/edits/${id}/listings`)
    log(`Google Play, ${PACKAGE}: ${listings.length} ${listings.length === 1 ? 'language' : 'languages'}, the default ${details.defaultLanguage ?? 'not given'}.`)
    summary(`## Google Play's listing, as Play has it now\n\nCopy these into store/google-play/<language>/ exactly.\n\n`)

    const changes = []
    for (const live of ordered(listings, details.defaultLanguage)) {
      const lang = live.language
      summary(`### ${lang}\n\n${FIELDS.map(([field, name]) => `**The ${name}** (${length(norm(live[field]))}/${LIMITS[field]})\n\n${block(norm(live[field]))}`).join('\n')}\n`)
      const mine = repo[lang]
      log('')
      if (!mine) {
        log(`${lang}: no copy in store/google-play/, so it is left as it is. Play says:`)
        for (const [field, name] of FIELDS) log(`  The ${name}:\n${norm(live[field]).split('\n').map((l) => `    ${l}`.trimEnd()).join('\n')}`)
        continue
      }
      for (const p of problems(live)) log(`  Play's own text, as it is now: ${p}`)
      const changed = []
      for (const [field, name] of FIELDS) {
        const [was, now] = [length(norm(live[field])), length(mine[field])]
        const where = `${lang}, the ${name} (${was === now ? `${now}/${LIMITS[field]}` : `Play ${was}, the repo ${now}, of ${LIMITS[field]}`})`
        if (same(live[field], mine[field])) {
          log(`${where}: already says this`)
          continue
        }
        log(`${where}: Play says the lines with -, and the repo says the lines with +:`)
        log(showDiff(diffLines(live[field], mine[field])))
        if (!apply) log('  — would change. Run with "Write it" ticked to change it.')
        changed.push(field)
      }
      if (changed.length) changes.push({ lang, live, mine, changed })
    }
    for (const lang of langs) {
      if (!listings.some((l) => l.language === lang)) {
        log(`::warning::Play has no ${lang} listing, and this job never adds a language, so store/google-play/${lang} was not used.`)
      }
    }

    if (!apply) {
      log('\nNothing was changed: the draft opened in Play Console to read this was thrown away.')
      return []
    }
    if (!changes.length) {
      log('\nNothing differs, so nothing was written.')
      return []
    }

    for (const c of changes) {
      const body = { language: c.lang, title: c.mine.title, shortDescription: c.mine.shortDescription, fullDescription: c.mine.fullDescription }
      /* The whole listing goes back (a PUT replaces it), so its video goes back with it. */
      if (c.live.video !== undefined) body.video = c.live.video
      const back = await call('PUT', `/edits/${id}/listings/${encodeURIComponent(c.lang)}`, { body })
      for (const [field, name] of FIELDS) {
        if (!same(back[field], body[field])) throw new Error(`${c.lang}: Google took the ${name} as something else. Nothing was sent.`)
      }
    }
    /*
     * Checked before it is sent, except with the hold box: :validate takes no
     * hold setting, and refuses an app whose changes cannot go to review by
     * themselves ("Please set ... changesNotSentForReview to true"), which is
     * the very case the box is for. A commit checks the draft itself anyway.
     */
    if (!hold) await call('POST', `/edits/${id}:validate`)
    /*
     * ERROR_IF_IN_REVIEW, always. Google's default is to CANCEL whatever is in
     * review and send it again with this: an Android build in Google's review
     * would go back to the start of the queue for a change of words. This way
     * Google says no, and nothing is cancelled. The hold setting goes only
     * when the box is ticked, and only as true: sent as false, Google can
     * answer that it "must not be set" (fastlane leaves it out for that).
     */
    state.sending = true
    try {
      await call('POST', `/edits/${id}:commit`, {
        query: { changesInReviewBehavior: 'ERROR_IF_IN_REVIEW', ...(hold ? { changesNotSentForReview: 'true' } : {}) }
      })
    } catch (err) {
      /* A 4xx is Google's own no: nothing was taken. Anything else, it may have been. */
      if (err instanceof PlayError && err.status >= 400 && err.status < 500) state.sending = false
      throw err
    }
    state.committed = true
    return changes
  })
  if (!changes.length) return { wrote: [] }

  log('')
  for (const c of changes) for (const field of c.changed) log(`${c.lang}, the ${FIELDS.find((f) => f[0] === field)[1]}: written.`)
  log(
    hold
      ? '  — left in Play Console under Changes not yet sent for review. Send it from Publishing overview → Send changes for review.'
      : '  — sent to Google\'s review. It goes live once Google passes it, usually within a day.'
  )

  /* And read back, in a fresh draft, the way store-text reads Apple's back. */
  await inEdit(call, log, async (id) => {
    for (const c of changes) {
      const now = await call('GET', `/edits/${id}/listings/${encodeURIComponent(c.lang)}`)
      for (const [field, name] of FIELDS) {
        if (!same(now[field], c.mine[field])) {
          throw new Error(
            `${c.lang}: sent, and the ${name} reads back as something else. Play says the lines with -, and the repo says the lines with +:\n${showDiff(diffLines(now[field], c.mine[field]))}`
          )
        }
      }
    }
  })
  log('  — and it reads back right.')
  return { wrote: changes.map((c) => c.lang) }
}

async function images({ rawKey, fetch, log, mask, seconds }) {
  const key = serviceAccount(rawKey, mask)
  const token = await accessToken({ key, scope: SCOPES.publisher, fetch, now: seconds, mask })
  const call = client({ base: PUBLISHER, token, fetch })
  await inEdit(call, log, async (id) => {
    const details = await call('GET', `/edits/${id}/details`)
    const { listings = [] } = await call('GET', `/edits/${id}/listings`)
    for (const { language } of ordered(listings, details.defaultLanguage)) {
      log(`\n${language}`)
      for (const [type, name] of IMAGE_TYPES) {
        const { images: pictures = [] } = await call('GET', `/edits/${id}/listings/${encodeURIComponent(language)}/${type}`)
        log(`  ${name}: ${pictures.length || 'none'}`)
        pictures.forEach((p, i) => log(`    ${i + 1}. ${p.url ?? '(no link)'}${p.sha256 ? `  sha256 ${p.sha256.slice(0, 12)}…` : ''}`))
      }
    }
    log("\nChromebook screenshots are not in Google's interface for this; Play Console shows them.")
    log('Nothing was changed: the draft opened in Play Console to read this was thrown away.')
  })
  return { wrote: [] }
}

const pct = (v, scale) => `${(v * scale).toFixed(2)}%`

async function vitals({ rawKey, fetch, log, mask, seconds, now }) {
  const key = serviceAccount(rawKey, mask)
  const token = await accessToken({ key, scope: SCOPES.reporting, fetch, now: seconds, mask })
  const call = client({ base: REPORTING, token, fetch })

  for (const r of RATES) {
    const set = await call('GET', `/${r.set}`)
    const end = wholeDay(set.freshnessInfo?.freshnesses?.find((f) => f.aggregationPeriod === 'DAILY')?.latestEndTime ?? laToday(now))
    const { rows = [] } = await call('POST', `/${r.set}:query`, {
      body: {
        timelineSpec: { aggregationPeriod: 'DAILY', startTime: daysBefore(end, 28), endTime: end },
        metrics: [r.perceived, r.all, r.daily],
        pageSize: 100
      }
    })
    const value = (row, metric) => {
      const v = row.metrics?.find((m) => m.metric === metric)?.decimalValue?.value
      return v === undefined || v === null || v === '' ? null : Number(v)
    }
    const days = [...rows].sort((a, b) => dayKey(a.startTime) - dayKey(b.startTime))
    const last = days.at(-1)
    const perceived = last && value(last, r.perceived)
    if (perceived === null || perceived === undefined) {
      log(`${r.name}: Google has too few people's data to give a rate yet.`)
      continue
    }
    const all = value(last, r.all)
    /* A fraction of 1, unless any figure is over 1 (see RATES). */
    const scale = days.some((d) => [r.perceived, r.all, r.daily].some((m) => (value(d, m) ?? 0) > 1)) ? 1 : 100
    const over = perceived * scale >= r.line ? ", OVER Google's line: Play may show the app to fewer people, and warn them on its page" : ''
    log(
      `${r.name}, the 28 days to ${dayWords(last.startTime)} (Google's days, Los Angeles time): ` +
        `${pct(perceived, scale)} of people while they were using the app (Google's figure ${perceived}; its line is ${r.line}%${over})` +
        `${all === null ? '' : `, ${pct(all, scale)} ${r.allWords}`}.`
    )
    const worst = days.map((d) => [d, value(d, r.daily)]).filter(([, v]) => v !== null).sort((a, b) => b[1] - a[1])[0]
    if (worst && worst[1] > 0) log(`  The worst day: ${dayWords(worst[0].startTime)}, ${pct(worst[1], scale)}.`)
  }

  const counts = await call('GET', '/errorCountMetricSet')
  const hourly = counts.freshnessInfo?.freshnesses?.find((f) => f.aggregationPeriod === 'HOURLY')?.latestEndTime
  const end = hourly ? new Date(Date.UTC(hourly.year, hourly.month - 1, hourly.day, hourly.hours ?? 0)) : hourFloorUTC(now)
  const start = new Date(end.getTime() - 28 * 24 * 3_600_000)
  /*
   * The issues only, with no sample reports: a report can carry what a
   * player typed, and this log is public. And no counts, of reports or of
   * people: they would say how many people use the app, closer than Play's
   * install bands do. Most first is the order; the counts are behind each
   * problem's link, in Play Console.
   */
  const { errorIssues = [] } = await call('GET', '/errorIssues:search', {
    query: { ...flatInterval(start, end), orderBy: 'errorReportCount desc', pageSize: 10, sampleErrorReportLimit: 0 }
  })
  log(`\nThe problems that came up most, most first, the 28 days to ${end.toISOString().slice(0, 13)}:00 UTC (how many, in Play Console behind each link):`)
  if (!errorIssues.length) log('  None: Google has no crash, freeze or caught error on record for them.')
  errorIssues.forEach((e, i) => {
    const versions = [e.firstAppVersion?.versionCode, e.lastAppVersion?.versionCode].filter((v) => v !== undefined)
    const when = [
      versions.length ? `version codes ${[...new Set(versions)].join(' to ')}` : '',
      e.lastErrorReportTime ? `last on ${String(e.lastErrorReportTime).slice(0, 10)}` : ''
    ].filter(Boolean)
    log(
      `  ${i + 1}. ${KINDS[e.type] ?? e.type ?? 'Problem'}: ${e.cause ?? 'no cause given'}${e.location ? ` in ${e.location}` : ''}` +
        `${when.length ? ` — ${when.join(', ')}` : ''}`
    )
    if (e.issueUri) log(`     ${e.issueUri}`)
    for (const a of e.annotations ?? []) if (a.title) log(`     Google says: ${a.title}`)
  })
  return { wrote: [] }
}

async function main() {
  const args = process.argv.slice(2)
  const at = args.indexOf('--mode')
  const mode = at >= 0 ? args[at + 1] || 'listing' : 'listing'
  const known = new Set(['--apply', '--hold', '--mode', ...(at >= 0 ? [args[at + 1]] : [])])
  const stray = args.filter((a) => !known.has(a))
  if (stray.length) throw new Error(`not understood: ${stray.join(' ')}`)
  const rawKey = process.env.GOOGLE_PLAY_KEY
  delete process.env.GOOGLE_PLAY_KEY
  if (!rawKey) throw new Error('GOOGLE_PLAY_KEY is not set: it is the GitHub secret this job is handed')
  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  await run({
    mode,
    apply: args.includes('--apply'),
    hold: args.includes('--hold'),
    rawKey,
    fetch: globalThis.fetch,
    log: console.log,
    summary: summaryFile ? (md) => appendFileSync(summaryFile, md) : () => {},
    /* On GitHub, each line of the key, the signed note and the token are masked as soon as they exist, so not even a stray print could show them. */
    mask: process.env.GITHUB_ACTIONS === 'true' ? (t) => console.log(`::add-mask::${t}`) : () => {}
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`::error::${err.message}`)
    process.exit(1)
  })
}
