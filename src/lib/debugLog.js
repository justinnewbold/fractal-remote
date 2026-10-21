/**
 * One log for everything, in the order it happened.
 *
 * "Make a unified debug log with a copy log button to send back to you for
 * debugging." Until now the record of a bad evening was in four places: the
 * wire log and the verification log in forgefx.js, the generation log in
 * stream.js, the app's own change log in App, and whatever the browser
 * console had — which on a phone is nowhere. Each was a table of one kind of
 * thing, and none of them said what happened BETWEEN the things, so "the
 * tone took four minutes and then the write said ok:false" could not be read
 * off any of them in that order.
 *
 * Every one of those sources now also writes a line here, with the time and
 * where it came from, and errors and crashes that never reached any of them
 * land here too. The panel in Setup shows it and copies it — the whole thing,
 * with the version and the unit at the top — so the report is one paste.
 *
 * Plain arrays, no React: this is written to from library code that must
 * not know about components, and read by one panel that subscribes.
 */

const MAX = 400
const lines = []
const listeners = new Set()

/** How much of a detail is worth keeping on one line. */
const DETAIL_CHARS = 320

function compact(detail) {
  if (detail === undefined || detail === null || detail === '') return ''
  if (typeof detail === 'string') return detail
  if (detail instanceof Error) return detail.message || String(detail)
  try {
    const s = JSON.stringify(detail)
    return s.length > DETAIL_CHARS ? `${s.slice(0, DETAIL_CHARS)}…` : s
  } catch {
    return String(detail)
  }
}

/**
 * Write a line. `source` is where it came from — ai, wire, check, unit, app,
 * error, crash — and is the first thing a reader filters by.
 */
export function logDebug(source, message, detail) {
  const entry = { at: Date.now(), source: String(source || 'app'), message: String(message ?? ''), detail: compact(detail) }
  lines.push(entry)
  if (lines.length > MAX) lines.splice(0, lines.length - MAX)
  for (const fn of listeners) {
    try {
      fn(entry)
    } catch {
      // A listener that throws must not take the log down with it.
    }
  }
  return entry
}

/**
 * A button was pressed — and, when it was worth saying, how long what it
 * started took to finish.
 *
 * "Can we add more, like what buttons get tapped and what the app does, how
 * long it takes to activate what the button was suppose to do?"
 *
 * The wire log already said how long each request took, which answers "was the
 * unit slow". It could not answer "I pressed the thing and nothing happened",
 * because nothing wrote down that anything was pressed. A log of the answers
 * with none of the questions makes a bad evening unreadable in exactly the way
 * it is most often bad.
 *
 * THE LINE IS WRITTEN AT THE START, not the end, and that is the point: a tap
 * whose work never finishes is a tap with no second line, which is the shape of
 * the failure most worth finding. The second line only comes when the work took
 * long enough to be worth reading about, or when it failed — every button in
 * this app would otherwise cost two lines to say "that was instant", and the
 * buffer holds four hundred.
 */
const WORTH_SAYING_MS = 100

export function logTap(what, detail) {
  const began = Date.now()
  logDebug('tap', what, detail)
  let said = false
  return (outcome) => {
    if (said) return
    said = true
    const took = Date.now() - began
    if (took < WORTH_SAYING_MS && !outcome) return
    logDebug('tap', `${what} — ${took}ms`, outcome)
  }
}

/** Oldest first — the order a person reads a story in. */
export const getDebugLog = () => lines.slice()

export function clearDebugLog() {
  lines.length = 0
  for (const fn of listeners) {
    try {
      fn(null)
    } catch {
      // As above.
    }
  }
}

/** Hear every new line. Returns the function that stops listening. */
export function onDebugLog(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function stamp(at) {
  const d = new Date(at)
  const two = (n) => String(n).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

export function formatLine(entry) {
  return `${stamp(entry.at)} [${entry.source}] ${entry.message}${entry.detail ? ` — ${entry.detail}` : ''}`
}

/**
 * The whole log as text, with what a reader needs first at the top: which
 * build, which unit, which end of the link, what kind of screen.
 */
export function formatDebugLog(header = {}, extra = '') {
  const head = Object.entries(header)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
  const body = lines.length ? lines.map(formatLine) : ['(nothing logged yet this session)']
  return [...head, '', `${lines.length} lines, oldest first`, ...body, ...(extra ? ['', extra] : [])].join('\n')
}

/**
 * What the Mac's device server said about itself, as lines for the report.
 *
 * The shape is ForgeFX's /diag: whether its port to the unit is open and
 * which, what it resolved, the serial ports it can see, the last ten times
 * it found its port closed and opened it again (`reopens`), and the last
 * lines it said (`recent`). A port lost once is a cable; a port lost every
 * few seconds is something else; and the phone's own log shows both as
 * "port not open".
 */
export function formatMacDiag(d) {
  if (!d || typeof d !== 'object') return ''
  const serial = Array.isArray(d.ports?.serial) ? d.ports.serial : []
  const ports = serial.map((p) => `${p.id}${p.fractal ? ' (Fractal)' : ''}`).join(', ') || 'none'
  // Neither field exists on a Mac app older than 7.191.0, and "0 times" is
  // not what that means.
  const reopens = Array.isArray(d.reopens) ? d.reopens : null
  const recent = Array.isArray(d.recent) ? d.recent : null
  const traffic = d.traffic
  return [
    "COMPUTER'S DEVICE SERVER",
    `port to the unit: ${d.transportOpen ? 'open' : 'NOT OPEN'}${d.transportLabel ? ` · ${d.transportLabel}` : ''}`,
    `resolved: ${d.resolved ? `${d.resolved.transport} ${d.resolved.id}` : 'no unit found'}`,
    `serial ports: ${ports}`,
    `detected: ${d.detected ? 'yes' : 'no'} · profile ${d.profile?.key || '?'} · telemetry ${d.telemetryMode || '?'}`,
    typeof d.uptime === 'number' ? `server up: ${Math.round(d.uptime / 60)} min` : null,
    traffic ? `traffic: ${traffic.txMsgs ?? '?'} sent, ${traffic.rxMsgs ?? '?'} received since ${traffic.since || '?'}` : null,
    /*
     * Whether the computer is asking the unit for its output levels right now
     * (shared/relay-rules.mjs METERS_OFF_PATH). Only a computer app that
     * carries the quiet device server says; an older one says nothing here,
     * rather than a guess.
     */
    typeof d.metersWanted === 'boolean' ? `level readings: ${d.metersWanted ? 'on' : 'off'}` : null,
    ...linuxMidiLines(d),
    d.listError ? `port listing error: ${d.listError}` : null,
    reopens
      ? `port lost and reopened: ${reopens.length} time${reopens.length === 1 ? '' : 's'}`
      : 'port lost and reopened: this computer app does not say (older than 7.191.0)',
    ...(reopens || []).map((r) => `  ${r.at} ${r.label} — ${r.reason}`),
    ...(recent ? (recent.length ? ['', `server log, last ${recent.length} lines:`, ...recent] : ['server log: nothing said yet']) : ['server log: this computer app does not keep one (older than 7.191.0)'])
  ]
    .filter((l) => l !== null)
    .join('\n')
}

/*
 * WHAT LINUX HOLDS FOR THE UNIT'S REPLIES: ForgeFX's /diag `linuxMidi`, said
 * only by a computer on Linux reaching its unit over USB-MIDI (computer app
 * 1.87.47 on). "The same names are not showing up again at all. on the AM4"
 * (Justin, 21 October 2026): on his Raspberry Pi 3 every AM4 preset read
 * came back as 3,095 of 12,352 bytes, because the kernel takes a USB-MIDI
 * port's input into a buffer one memory page long and drops the rest. Which
 * Pi, which buffer, and whether anything was lost could only be had by
 * somebody typing into a Terminal on it. Now they are in the report:
 *
 *   the page size, which is that buffer unless the Pi was told otherwise;
 *   snd-seq-midi's input buffer, which is what the one-line fix sets;
 *   the unit's own input lines in /proc/asound (bytes in, buffer, overruns);
 *   RtMidi's input pool lines, the queue that can overflow once the buffer
 *   holds a whole dump (a Pi 5's 16 KB pages, or a Pi given the fix).
 *
 * And which road the input takes, ForgeFX's own ALSA client or RtMidi's,
 * when a line the server said is still in its log to say so. Bounded, so
 * the summary stays a summary (shared/report-rules.mjs COMPUTER_HEAD_LINES):
 * at most LINUX_MIDI_MOST ports and pools each. Nothing at all from a
 * computer that does not say: a Mac, Windows, serial, or an older one.
 */
const LINUX_MIDI_MOST = 4
function linuxMidiLines(d) {
  const lm = d.linuxMidi
  if (!lm || typeof lm !== 'object') return []
  const bytes = (n) => (Number.isInteger(n) ? `${n} bytes` : null)
  const plain = (line) => String(line).trim().replace(/\s*:\s*/, ': ').replace(/\s+/g, ' ')
  const out = ['linux midi:']
  const road = inputRoad(d.recent)
  if (road) out.push(`  input: ${road}`)
  out.push(`  page size: ${bytes(lm.pageSize) ?? 'not known'}`)
  out.push(
    `  snd-seq-midi input buffer: ${bytes(lm.seqMidiInputBufferSize) ?? 'not shown (the module is built in or not loaded)'}` +
      (Number.isInteger(lm.seqMidiOutputBufferSize) ? ` · output ${lm.seqMidiOutputBufferSize} bytes` : '')
  )
  const ports = Array.isArray(lm.ports) ? lm.ports.filter((p) => p && typeof p === 'object') : []
  for (const p of ports.slice(0, LINUX_MIDI_MOST)) {
    const lines = Array.isArray(p.lines) ? p.lines.map(plain) : []
    out.push(`  unit's port: card ${p.card ?? '?'} ${p.id || p.name || '?'} ${p.device || ''}`.trimEnd() + (lines.length ? ` · ${lines.join(' · ')}` : ' · no input lines'))
  }
  if (!ports.length) out.push("  unit's port: not found in /proc/asound")
  if (ports.length > LINUX_MIDI_MOST) out.push(`  … and ${ports.length - LINUX_MIDI_MOST} more`)
  const pools = Array.isArray(lm.inputPools) ? lm.inputPools.map(plain) : []
  for (const line of pools.slice(0, LINUX_MIDI_MOST)) out.push(`  ${line}`)
  if (!pools.length) out.push('  RtMidi input pool: none listed')
  return out
}

/*
 * Which road the unit's replies take in, from the newest line the server
 * said about it: its MIDI port's open line ("· input via ForgeFX's ALSA
 * client (queue 2000)", or nothing after the ports, which is RtMidi), or
 * the own reader giving way to RtMidi afterwards. null when no such line is
 * left in the log: its ring is 400 lines, which an AM4's traffic fills in
 * seconds, and a guess is worse than nothing.
 */
function inputRoad(recent) {
  if (!Array.isArray(recent)) return null
  for (let i = recent.length - 1; i >= 0; i--) {
    const line = String(recent[i] ?? '')
    const gave = /\[forgefx\]\[midi\] own ALSA reader (.+?) — back to RtMidi input/.exec(line)
    if (gave) return `RtMidi (ForgeFX's ALSA client ${gave[1]})`
    if (!/\[forgefx\]\[midi\] opened:/.test(line)) continue
    const via = /· input via (ForgeFX's ALSA client \(queue \d+\))/.exec(line)
    return via ? via[1] : 'RtMidi'
  }
  return null
}

/**
 * Things that never reached any log before: a script error, a promise nobody
 * caught. On a phone these went to a console nobody can open. Installed once
 * by the app; harmless where there is neither a window nor a phone runtime.
 *
 * TWO RUNTIMES, AND THE PHONE IS NOT THE BROWSER. A browser hands script
 * errors to `window.addEventListener('error')`. React Native has no event
 * target on `window` at all — the name is there, as an alias of the global,
 * but `addEventListener` is not — so the first version of this returned a
 * no-op on every phone, and the crash that has been chased across a dozen
 * builds never wrote a line. Not because the log did not survive; because
 * nothing was ever told. A phone routes an uncaught error through
 * `ErrorUtils.setGlobalHandler`, and a dropped promise through Hermes's
 * rejection tracker, which React Native only switches on in development.
 */
let installed = false
export function installCrashCapture(target = typeof window !== 'undefined' ? window : null) {
  if (installed || !target) return () => {}
  /* The phone first: no browser has ErrorUtils, but a phone polyfill could
     well grow an addEventListener that fires for nothing. */
  if (typeof target.ErrorUtils?.setGlobalHandler === 'function') return installPhoneCapture(target)
  if (typeof target.addEventListener === 'function') return installBrowserCapture(target)
  return () => {}
}

function installBrowserCapture(target) {
  installed = true
  const onError = (e) => {
    logDebug('crash', e?.message || 'script error', e?.error?.stack || e?.filename || '')
  }
  const onRejection = (e) => {
    const r = e?.reason
    logDebug('crash', 'unhandled promise', r?.stack || r?.message || compact(r))
  }
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return () => {
    installed = false
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}

/**
 * How long a fatal error's line is given to reach disk before the phone's own
 * handler runs. React Native's handler ends the app on a fatal error, and it
 * would end it before anything logged a moment earlier had been written.
 * lib/logKeep writes a crash line the instant it is logged; this is the head
 * start that write gets.
 */
export const CRASH_FLUSH_MS = 250

function installPhoneCapture(target) {
  installed = true
  const utils = target.ErrorUtils
  const before = typeof utils.getGlobalHandler === 'function' ? utils.getGlobalHandler() : null
  utils.setGlobalHandler((e, isFatal) => {
    logDebug('crash', e?.message || 'script error', `${isFatal ? 'fatal' : 'not fatal'}${e?.stack ? `\n${e.stack}` : ''}`)
    if (!before) return
    if (isFatal) setTimeout(() => before(e, isFatal), CRASH_FLUSH_MS)
    else before(e, isFatal)
  })
  const hermes = target.HermesInternal
  const tracks = typeof hermes?.enablePromiseRejectionTracker === 'function'
  if (tracks) {
    hermes.enablePromiseRejectionTracker({
      allRejections: true,
      onUnhandled: (id, r) => logDebug('crash', 'unhandled promise', r?.stack || r?.message || compact(r)),
      onHandled: () => {}
    })
  }
  return () => {
    installed = false
    if (before) utils.setGlobalHandler(before)
    if (tracks) hermes.enablePromiseRejectionTracker({ allRejections: false, onUnhandled: () => {}, onHandled: () => {} })
  }
}
