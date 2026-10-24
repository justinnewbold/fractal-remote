import { requireOptionalNativeModule } from 'expo'
import { logDebug } from './debugLog'

/*
 * THE FOLD SENSOR, FROM THE JAVASCRIPT SIDE: the native FractalFold module
 * (mobile/modules/fractal-fold), read and written to the debug log, and
 * nothing more.
 *
 * On an iPhone Duo with a build that has the module, the Swift reports the
 * hinge (shut, partly or fully open, and its angle), where the fold runs,
 * what covers the screen (the cameras), the app's own window and which side
 * the system's side bar takes. NOTHING IN THE APP DRAWS FROM IT YET: Play
 * measures itself and takes the fold to be the middle of its window. This
 * file only writes a line in the debug log when the shape changes, so the
 * logs that come back from a real Duo show what it reports before anything
 * leans on it. What does lean on it comes later, by update, which is why the
 * reading's shape is frozen here and in test/fold-native.mjs now: the Swift
 * cannot change until the next build. The contract is written out in
 * FractalFoldModule.swift.
 *
 * INERT ON ANY OTHER BUILD. requireOptionalNativeModule answers null on
 * Android, in the browser and on every build made before the module, and
 * the module itself answers an empty reading, and sends nothing, below iOS
 * 27.1 or when the Swift was built without the iOS 27.1 SDK (compiledIn
 * false). Each of those is one line in the log at most, and none on Android
 * or in the browser.
 */

/** The event the Swift sends, with a reading, each time the reading changes. */
export const FOLD_EVENT = 'onFold'

/** A reading's keys, the same the Swift's FoldReading sends. */
export const FOLD_KEYS = Object.freeze(['hinge', 'fold', 'occlusions', 'window', 'verticalBarEdge'])

/** UIHinge.Status, by name. */
export const HINGE_STATUSES = Object.freeze(['closed', 'partiallyOpen', 'fullyOpen', 'unknown'])

/** UIVerticalBarEdge, by name, and 'unknown' for a case Apple adds later. */
export const BAR_EDGES = Object.freeze(['leading', 'trailing', 'unspecified', 'unknown'])

/** At most one line in this long: a hinge that flaps at a threshold must not fill the 400-line log. */
export const FOLD_LOG_MS = 1000

let native
function sensor() {
  if (native !== undefined) return native
  try {
    native = requireOptionalNativeModule('FractalFold')
  } catch {
    native = null
  }
  return native
}

/** Whether this build carries the module at all (iPhone only). */
export const foldSensorPresent = () => !!sensor()

/** Whether its iOS 27.1 code was compiled in: false on a build made without the iOS 27.1 SDK. */
export const foldCompiledIn = () => sensor()?.compiledIn === true

/** And whether it runs here: compiled in, on iOS 27.1 or later. */
export const foldAvailable = () => foldCompiledIn() && sensor()?.available === true

const finite = (v) => typeof v === 'number' && Number.isFinite(v)

function box(v) {
  if (!v || typeof v !== 'object') return null
  const { x, y, width, height } = v
  return [x, y, width, height].every(finite) ? { x, y, width, height } : null
}

function region(v) {
  const b = box(v)
  return b && typeof v.active === 'boolean' ? { ...b, active: v.active } : null
}

/**
 * One reading from the module, checked: `{ hinge, fold, occlusions, window,
 * verticalBarEdge }`, each null (occlusions empty) when it is missing or not
 * what the Swift sends, or null for anything that is not a reading.
 */
export function foldReading(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const h = raw.hinge
  const hinge = h && HINGE_STATUSES.includes(h.status) && finite(h.angle) ? { status: h.status, angle: h.angle } : null
  return {
    hinge,
    fold: region(raw.fold),
    occlusions: Array.isArray(raw.occlusions) ? raw.occlusions.map(region).filter(Boolean) : [],
    window: box(raw.window),
    verticalBarEdge: BAR_EDGES.includes(raw.verticalBarEdge) ? raw.verticalBarEdge : null
  }
}

/** The module's latest reading, or null on a build without it. */
export function readFold() {
  const mod = sensor()
  if (!mod?.now) return null
  try {
    return foldReading(mod.now())
  } catch {
    return null
  }
}

/**
 * Which way the fold runs, by Apple's own rule, its frame's width against its
 * height: 'down' the window (opened like a book, a page each side), 'across'
 * it (like a laptop, a half above and below), or null.
 */
export function foldRuns(fold) {
  if (!fold) return null
  if (fold.height > fold.width) return 'down'
  if (fold.width > fold.height) return 'across'
  return null
}

const pt = (v) => Math.round(v)

/** The reading in one line, for the log. */
export function foldLine(r) {
  const parts = []
  parts.push(r.hinge ? `hinge ${r.hinge.status} at ${pt(r.hinge.angle)}°` : 'no hinge')
  if (r.fold) {
    const runs = foldRuns(r.fold)
    const at = runs === 'across' ? `y ${pt(r.fold.y)}, ${pt(r.fold.height)} tall` : `x ${pt(r.fold.x)}, ${pt(r.fold.width)} wide`
    parts.push(`fold runs ${runs || 'nowhere'} at ${at}, ${r.fold.active ? 'active' : 'inactive'}`)
  } else {
    parts.push('no fold')
  }
  parts.push(r.window ? `window ${pt(r.window.width)}×${pt(r.window.height)}` : 'no window')
  if (r.verticalBarEdge) parts.push(`side bar ${r.verticalBarEdge}`)
  const on = r.occlusions.filter((o) => o.active).length
  parts.push(`${r.occlusions.length} covered ${r.occlusions.length === 1 ? 'area' : 'areas'}, ${on} active`)
  return `Fold: ${parts.join('; ')}`
}

/** What a log line is written for: the shape, in whole points, and not every degree of the hinge. */
export function foldShape(r) {
  const rect = (b) => (b ? [pt(b.x), pt(b.y), pt(b.width), pt(b.height)] : null)
  return JSON.stringify([
    r.hinge?.status ?? null,
    r.fold ? [...rect(r.fold), r.fold.active] : null,
    rect(r.window),
    r.verticalBarEdge,
    r.occlusions.map((o) => [...rect(o), o.active])
  ])
}

/**
 * Write a line in the debug log each time the fold's shape changes, for the
 * life of the app (App.js). One line first to say whether the sensor is in
 * this build and runs here, then one for the reading as it starts and one for
 * each change after it, never two within FOLD_LOG_MS: a change inside that
 * time is held and the newest written when it is up. A reading with no
 * window yet (the probe not in it) is not written. Returns the way to stop.
 * Nothing else reads the sensor.
 */
export function logFoldChanges({ log = logDebug, now = Date.now, later = setTimeout, cancel = clearTimeout } = {}) {
  const mod = sensor()
  if (!mod) return () => {}
  if (mod.compiledIn !== true) {
    log('fold', 'Fold sensor: compiled out of this build (made without the iOS 27.1 SDK)')
    return () => {}
  }
  if (mod.available !== true) {
    log('fold', 'Fold sensor: in this build, not on this iOS (below 27.1)')
    return () => {}
  }
  log('fold', 'Fold sensor: on')
  let written = null
  let writtenAt = -Infinity
  let held = null
  let timer = null
  const write = (r) => {
    written = foldShape(r)
    writtenAt = now()
    log('fold', foldLine(r))
  }
  const flush = () => {
    timer = null
    const r = held
    held = null
    if (r && foldShape(r) !== written) write(r)
  }
  const seen = (raw) => {
    const r = foldReading(raw)
    if (!r?.window) return
    if (timer) {
      held = r
      return
    }
    if (foldShape(r) === written) return
    const wait = writtenAt + FOLD_LOG_MS - now()
    if (wait <= 0) {
      write(r)
      return
    }
    held = r
    timer = later(flush, wait)
  }
  let sub = null
  try {
    sub = mod.addListener?.(FOLD_EVENT, seen)
    seen(mod.now?.())
  } catch (err) {
    log('fold', 'Fold sensor: could not be read', err?.message || String(err))
  }
  return () => {
    if (timer) cancel(timer)
    timer = null
    held = null
    sub?.remove?.()
  }
}
