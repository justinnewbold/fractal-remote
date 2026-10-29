/**
 * Sending a bug report or an idea, from the phone.
 *
 * THE PHONE IS WHERE THE BAD EVENINGS HAPPEN, and until now it was the one
 * surface with nowhere to say so. The browser has had this for a while; a
 * handset on a dark stage had a log it could copy and no way to send it, which
 * meant the report only ever arrived if somebody remembered to paste it into a
 * message later, from a different device, after the gig.
 *
 * What a report contains is decided in shared/report-rules.mjs, copied here by
 * `npm run sync:rules`. This file is only the part that is genuinely the
 * phone's: which client, which account, and what a handset knows about itself.
 *
 * The table is insert-only — anybody can write one and nobody can read them
 * back with the key that ships in the app — and works signed out, which
 * matters because a phone that cannot reach its computer often cannot reach
 * its account either, and that is exactly when somebody wants to complain.
 */
import { Dimensions, Platform } from 'react-native'

import {
  KINDS,
  LOGS_ONLY_MESSAGE,
  MAX_MESSAGE,
  SENT_WORDS,
  SHOT_BUCKET,
  askComputer,
  buildReport,
  carriesLog,
  computerUnaskedWhy,
  contextFrom,
  inTime,
  lastErrorFrom,
  logsMessage,
  notSent,
  reportKey,
  reportLog,
  shotsLostWords,
  uploadShots,
  videoLostWords,
  videoPath,
  withShots,
  withVideo,
  VIDEO_BUCKET,
  VIDEO_WAIT_MS
} from './report-rules'
import { DEFAULT_PROJECT, remoteRequest, supabaseClient } from './relay'
import { APP_VERSION } from './version'
import { formatLine, formatMacDiag, getDebugLog, logDebug } from './debugLog'
import { linkState, linkVia } from './link'
import { deviceFacts } from './thisDevice'

export { KINDS, MAX_MESSAGE, SENT_WORDS, carriesLog, shotsLostWords, videoLostWords }

/**
 * What was going on when they wrote it.
 *
 * Nothing identifying. No preset contents, no account details, nothing else
 * typed into the app — what someone chose to write, and what shape of setup
 * they were on.
 */
export function context({ deviceName } = {}) {
  const link = linkState()
  const win = Dimensions.get('window')
  return contextFrom({
    version: APP_VERSION,
    /* The computer's version as well. "The phone is on 7.344 and the Mac is on
       7.191" is the answer to a surprising number of reports, and it is the one
       fact nobody would think to type. */
    macVersion: link?.hostVersion,
    /* The phone tracks the unit as a name off the rig, not an object — see
       lib/rig.js, where `deviceName` is caps.short or caps.name. */
    unit: deviceName,
    role: link?.link,
    platform: 'phone',
    /* No expo-device here, so this is what a handset can honestly say about
       itself: which OS and which version of it. Enough to tell an iOS 17 bug
       from an Android one, which is the whole of what a layout report needs. */
    os: `${Platform.OS} ${Platform.Version}`,
    /* Which handset: the maker and model on Android, iPhone or iPad on Apple's
       (lib/thisDevice deviceFacts, the gear notes' own words), never the name
       somebody gave it. "Have the log sent with what devices they're using"
       (Justin, 29 October 2026). */
    device: deviceFacts().model,
    screen: win?.width ? `${Math.round(win.width)}x${Math.round(win.height)}` : undefined,
    lastError: lastErrorFrom(getDebugLog())
  })
}

/**
 * Exactly the log that would be sent, as text — for showing somebody first.
 *
 * The same function the send path calls (shared/report-rules reportLog), with
 * the same head and runs before, so what is shown cannot drift from what
 * goes. Empty string for a kind that carries no log, so a caller can show
 * nothing without asking a second question.
 */
export function logPreview(kind, { head = '', before = [] } = {}) {
  if (!carriesLog(kind)) return ''
  return reportLog({ lines: getDebugLog(), format: formatLine, head, before })
}

/**
 * Post one report.
 *
 * Throws with something a person can read. The failure that matters is having
 * no network at all — common on a stage, and it must not lose what they typed,
 * so the caller keeps the text on screen when this rejects.
 *
 * `head` is the log's head (lib/logHead logHeader, as lines) and `before` the
 * runs before this one (lib/logHead runsBefore): both ride with the log and
 * never without it. `shots` are the screenshots (lib/shots pasteShot), which
 * go to the bucket first, under the account's id or `anon`, each given
 * SHOT_WAIT_MS together: one that fails or is late is left out, the report
 * goes without it, and the answer says how many (`shotsLost`). Never waits
 * past SEND_WAIT_MS for the row either.
 *
 * `typed` is whether the message is something a person wrote, which decides
 * whether the words for a report that did not go may say "What you wrote is
 * still here"; left out, it is anything but the log screen's own sentence
 * (LOGS_ONLY_MESSAGE). `copyLogs` is whether the screen it was sent from has
 * Copy Logs to offer instead (the log screen's does; see notSentHere).
 *
 * `video` is one picked by lib/shots pickMedia, sent from the file it is on
 * the phone (putVideo, below) before anything else, since it is the long
 * part; `onVideoProgress` hears how much of it has gone, 0 to 1. One that
 * does not go costs the report a line, never the report (`videoLost`).
 *
 * `anonymous` is "Include my email" unticked on the report screen: "It would
 * be nice to know what user it's coming from unless they want it anonymous"
 * (Justin, 29 October 2026). Then nothing about the account goes: no
 * account id on the row, no address, and the row and everything with it go
 * on a database client with no sign-in at all, so not even the request
 * carries one (the gear notes' way, lib/gearShare), and the files go under
 * anon/, where the bucket keeps everybody's signed-out ones.
 */
export async function sendReport({
  kind,
  message,
  contact,
  context: ctx = {},
  withLog = true,
  computer = '',
  head = '',
  before = [],
  shots = [],
  video = null,
  onVideoProgress,
  anonymous = false,
  typed,
  copyLogs = false
}) {
  const row = buildReport({
    kind,
    message,
    contact: anonymous ? '' : contact,
    /*
     * WHAT LAST WENT WRONG GOES WITH THE LOG AND NEVER WITHOUT IT. `lastError`
     * is the newest fault the screen showed, read off the log (context, above),
     * and every fault is a line in the log now (lib/rig.js set()). The privacy
     * page and the form's small print say a suggestion carries the version,
     * the unit, the OS and the screen size and never the log, and that a bug
     * report can be sent without it, so a report that carries no log carries
     * none of the log's words either: not a suggestion, and not a bug report
     * with the log turned off.
     */
    context: withLog && carriesLog(kind) ? ctx : apartFromLog(ctx),
    /* Read at send and at no other moment. Nothing is gathered while somebody
       types, so a report abandoned half-written leaves no copy anywhere. */
    lines: withLog ? getDebugLog() : [],
    format: withLog ? formatLine : null,
    /* The computer's own log, when the caller asked for it (sendLogs). */
    computer: withLog ? computer : '',
    head: withLog ? head : '',
    before: withLog ? before : []
  })

  let c = anonymous ? await bareClient() : supabaseClient()
  let userId = null
  /* What the video's upload signs in with: the account's own pass, or the app's public key for nobody. */
  let pass = null
  if (c && !anonymous) {
    try {
      const { data } = await c.auth.getUser()
      userId = data?.user?.id || null
    } catch {
      // No session is not a problem; it goes as an anonymous report.
    }
    if (userId) {
      try {
        pass = (await c.auth.getSession())?.data?.session?.access_token || null
      } catch {
        pass = null
      }
    }
  } else if (!c) {
    const { createClient } = await import('@supabase/supabase-js')
    c = createClient(DEFAULT_PROJECT.url, DEFAULT_PROJECT.anonKey)
  }
  /* A pass that could not be read goes as nobody, under anon/, as its row does then. */
  if (!pass) userId = null
  const owner = userId || 'anon'
  const key = reportKey()

  /* The video first: the long part, so the pictures and the row follow it rather than waiting on it twice. */
  let moving = {}
  if (video?.uri) {
    const path = videoPath(owner, key, video.ext)
    try {
      await putVideo(path, video, { pass: pass || DEFAULT_PROJECT.anonKey, onProgress: onVideoProgress })
      moving = { path }
    } catch (e) {
      moving = { why: e?.message || String(e) }
      logDebug('app', 'video not added to the report', moving.why)
    }
  }

  /* The pictures next, so they are in the bucket by the time the row's email goes. */
  const pictures = await uploadShots(shots, {
    owner,
    key,
    put: async (path, shot) => {
      const { error } = await c.storage.from(SHOT_BUCKET).upload(path, shot.body, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      return true
    }
  })
  if (pictures.lost) logDebug('app', 'screenshots not added to the report', `${pictures.lost} — ${pictures.why}`)

  const answer = await inTime(() =>
    c.from('feedback').insert({ ...row, context: withVideo(withShots(row.context, pictures), moving), user_id: userId })
  ).catch((late) => ({ error: late }))
  const error = answer?.error

  /* Nothing was written for a log sent in one tap, so nothing is "still here".
     The database's own words go into the log, never onto the screen. */
  if (error) {
    const err = notSentHere(error, { wrote: typeof typed === 'boolean' ? typed : row.message !== LOGS_ONLY_MESSAGE, copyLogs })
    logDebug('app', 'report not sent', err.reason)
    throw err
  }
  return { sent: true, shotsLost: pictures.lost, videoLost: !!moving.why }
}

/*
 * A database client with no sign-in on it at all, for a report sent without
 * the account: made once, with the public key, and never keeping or renewing
 * a session (the gear notes' client, lib/gearShare).
 */
let bare = null
async function bareClient() {
  if (!bare) {
    const { createClient } = await import('@supabase/supabase-js')
    bare = createClient(DEFAULT_PROJECT.url, DEFAULT_PROJECT.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
  }
  return bare
}

/**
 * The video, sent to its bucket straight from its file on the phone.
 *
 * A form whose one file part names the file (React Native reads it from disk
 * as it goes), so a 50 MB video is never held in the app whole, as a
 * screenshot's bytes are. By XMLHttpRequest rather than the storage client:
 * React Native's form has no `has`, which the storage client asks of one, and
 * only XMLHttpRequest says how much of an upload has gone, which is what the
 * screen shows while a minute of video goes on a phone's connection. Given
 * VIDEO_WAIT_MS; throws in words for the log when it does not go.
 */
function putVideo(path, video, { pass, onProgress, wait = VIDEO_WAIT_MS }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${DEFAULT_PROJECT.url}/storage/v1/object/${VIDEO_BUCKET}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${pass}`)
    xhr.setRequestHeader('apikey', DEFAULT_PROJECT.anonKey)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.timeout = wait
    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (e) => {
        if (e?.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(true)
      reject(new Error(`storage answered ${xhr.status}${xhr.responseText ? `: ${String(xhr.responseText).slice(0, 160)}` : ''}`))
    }
    xhr.onerror = () => reject(new Error('network: the video could not be sent'))
    xhr.ontimeout = () => reject(new Error(`no answer within ${Math.round(wait / 1000)} seconds`))
    const form = new FormData()
    /* Before the file, which is where Storage reads it. */
    form.append('cacheControl', '3600')
    form.append('file', { uri: video.uri, name: `video.${video.ext}`, type: video.type })
    xhr.send(form)
  })
}

/** A report's details without what was read off the log (`lastError`), for a report that carries no log. */
function apartFromLog(ctx) {
  const out = { ...(ctx || {}) }
  delete out.lastError
  return out
}

/*
 * THE WORDS FOR A REPORT THAT DID NOT GO, FOR THE SCREEN IT WAS SENT FROM.
 * shared/report-rules notSentWords is the browser's and the phone's, and for
 * a report with nothing written it ends its last case with "or use Copy Logs
 * instead", which is the log screen's own button. Anywhere that has none (a
 * report that is not the log screen's) the sentence stops at "Try again in a
 * moment." Done here, on the phone, so the shared words (and
 * the computer app that carries them) stay as they are.
 */
const COPY_LOGS_TAIL = /, or use Copy Logs instead\.$/
function notSentHere(error, { wrote, copyLogs }) {
  const err = notSent(error, { wrote })
  if (!copyLogs) err.message = err.message.replace(COPY_LOGS_TAIL, '.')
  return err
}

/**
 * The computer's own log for a report: its /diag, or one line saying why not.
 *
 * Asked only when the phone is connected to a computer: not in the demo, not
 * over Bluetooth (beta), not while the link is down (shared/report-rules
 * computerUnaskedWhy). Straight to the relay with no wait for a dropped
 * channel, and given COMPUTER_WAIT_MS by askComputer, which answers in words
 * whatever happens. The relay's own, longer timeout is left as it is: a slow
 * answer to this one read is not taken as the computer being gone.
 */
export function computerPart() {
  return askComputer(() => remoteRequest('/diag', { graceMs: 0 }), formatMacDiag, {
    why: computerUnaskedWhy({ via: linkVia(), link: linkState()?.link })
  })
}

/**
 * "Send logs to developer", from the log screen: a bug report in one tap.
 *
 * No form. The message is the note when one was typed in the box beside the
 * button, and the app's own sentence (LOGS_ONLY_MESSAGE) when not; the
 * context is what the Feedback form sends, the log goes, and the computer's
 * own log goes with it when there is a computer to ask. Throws in words a
 * person can read, like sendReport. Whether it went is written into the log
 * as well, so the next copy of the log can say.
 *
 * NEVER TWO AT ONCE. A second call while one is on its way is handed the one
 * already going, rather than starting another report: the screen grays its
 * button too, but two taps can land before it has redrawn.
 */
let sendingLogs = null
export function sendLogs(options) {
  if (!sendingLogs) {
    sendingLogs = sendLogsNow(options).finally(() => {
      sendingLogs = null
    })
  }
  return sendingLogs
}

/*
 * `typed` is whether the note is something a person wrote (it is, from the
 * log screen's box, whenever there is one); Report a Bluetooth problem sends
 * a note the app made from the answer tapped, and says false, so a report
 * that did not go never says "What you wrote is still here" on a screen with
 * nothing to type. `copyLogs` is true on the log screen, which has Copy Logs
 * beside the button, and false from anywhere that has not.
 */
async function sendLogsNow({ deviceName, note = '', typed = !!String(note ?? '').trim(), copyLogs = true, shots = [], head = '', before = [] } = {}) {
  const computer = await computerPart()
  let sent
  try {
    sent = await sendReport({
      kind: 'bug',
      /* The note, when one was typed; the app's own sentence when not, so the one tap still sends. */
      message: logsMessage(note),
      context: context({ deviceName }),
      withLog: true,
      computer,
      head,
      before,
      shots,
      typed,
      copyLogs
    })
  } catch (err) {
    /* A refusal's own words are on the line sendReport wrote just before; anything else's are here. */
    logDebug('app', 'logs not sent to the developer', err?.reason ? '' : err?.message)
    throw err
  }
  logDebug('app', 'logs sent to the developer')
  return sent
}
