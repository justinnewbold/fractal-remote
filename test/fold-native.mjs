/**
 * THE FOLD SENSOR: THE IPHONE DUO'S HINGE AND FOLD, REPORTED AND NOTHING MORE.
 *
 * A native module rides the build pair (mobile/modules/fractal-fold) and
 * tells the app what the Duo knows of itself: the hinge, where the fold runs,
 * what covers the screen, the window and the side bar's edge. Nothing on
 * screen reads it yet. One small piece of JavaScript
 * (mobile/src/lib/foldSensor.js) writes a line in the debug log when the
 * shape changes, and whatever leans on it comes later, by update. So the
 * reading's shape is frozen here, now: the Swift cannot change until the next
 * build.
 *
 * Nothing on this machine compiles Swift, so the Swift is READ here: its two
 * guards (the iOS 27.1 SDK, and iOS 27.1 itself), the flag that says it was
 * compiled in, the probe's part in Auto Layout, where the regions are read,
 * the event's shape, and that it asks for nothing and reaches nowhere but the
 * iPhone. duo.yml (Xcode 27.1) compiles it in and fails if the flag reads
 * false; watch.yml's iphone job (Xcode 26.6) compiles it out. The JavaScript
 * is RUN, against stand-ins for the module.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { swiftCode, swiftStrings } from './siri-native.mjs'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

const DIR = 'mobile/modules/fractal-fold'
const MODULE = `${DIR}/ios/FractalFoldModule.swift`
const SENSOR_JS = 'mobile/src/lib/foldSensor.js'

/* The one guard on the SDK, written the same everywhere it is used. */
const GUARD = '#if canImport(UIKit, _version: 9127.0.85)'

/* The iOS 27.1 names, and the probe built from them: none may be compiled where the SDK has none of them. */
const NEW_NAMES = /\b(UIHingeInteraction|UIHinge|ReservedRegion|UIVerticalBarEdge|FoldProbe)\b|\breservedRegions\(|\.verticalBarEdge\b/

/* Each line of Swift (comments gone) with the #if conditions it sits under, innermost last; an #else is its #if negated. */
export function ifContext(code) {
  const stack = []
  return code.split('\n').map((text) => {
    const t = text.trim()
    assert.ok(!/^#elseif\b/.test(t), 'an #elseif: this reader does not follow one')
    if (/^#if\b/.test(t)) {
      stack.push(t)
      return { text, conditions: [...stack], directive: true }
    }
    if (/^#else\b/.test(t)) {
      stack.push(`!${stack.pop()}`)
      return { text, conditions: [...stack], directive: true }
    }
    if (/^#endif\b/.test(t)) {
      const conditions = [...stack]
      stack.pop()
      return { text, conditions, directive: true }
    }
    return { text, conditions: [...stack], directive: false }
  })
}

/* A declaration's body, from the line that opens it to the brace that closes it at the same indent. */
function block(code, opener) {
  const at = code.indexOf(opener)
  assert.ok(at >= 0, `${opener.trim()} was not found`)
  const indent = code.slice(code.lastIndexOf('\n', at) + 1).match(/^[ \t]*/)[0]
  const end = code.indexOf(`\n${indent}}`, at)
  assert.ok(end > at, `${opener.trim()} is never closed`)
  return code.slice(at, end + indent.length + 2)
}

/* The keys of a `var body: [String: Any]` in a struct, in the order written. */
function bodyKeys(code, struct) {
  const body = block(block(code, `struct ${struct}: Equatable {`), '  var body: [String: Any] {')
  return [...body.matchAll(/"(\w+)":|out\["(\w+)"\]/g)].map((m) => m[1] ?? m[2])
}

/*
 * foldSensor.js on a bench: 'expo' and the debug log swapped for stand-ins,
 * written afresh each time so the file's own memory starts empty.
 * requireOptionalNativeModule answers `mod`, null for a build without it.
 */
async function sensorOnABench(mod) {
  const dir = mkdtempSync(join(tmpdir(), 'fold-sensor-'))
  let lib = read(SENSOR_JS)
  for (const from of ["from 'expo'", "from './debugLog'"]) assert.ok(lib.includes(from), `foldSensor.js no longer imports ${from.slice(5)}: the bench needs telling`)
  lib = lib.replace("from 'expo'", "from './expo.js'").replace("from './debugLog'", "from './debugLog.js'")
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
  writeFileSync(join(dir, 'expo.js'), 'export const native = { module: null, asked: [] }\nexport const requireOptionalNativeModule = (name) => { native.asked.push(name); return native.module }\n')
  writeFileSync(join(dir, 'debugLog.js'), 'export const lines = []\nexport const logDebug = (source, message, detail) => { lines.push([source, message, detail]) }\n')
  writeFileSync(join(dir, 'foldSensor.js'), lib)
  const at = (f) => pathToFileURL(join(dir, f)).href
  const expo = await import(at('expo.js'))
  expo.native.module = mod
  const log = await import(at('debugLog.js'))
  return { fold: await import(at('foldSensor.js')), asked: expo.native.asked, lines: log.lines, done: () => rmSync(dir, { recursive: true, force: true }) }
}

/* A stand-in FractalFold module: its two flags, now(), and a way to send its event. */
function fakeSensor({ compiledIn = true, available = true, reading = null } = {}) {
  const listeners = []
  const removed = []
  let latest = reading
  return {
    mod: {
      compiledIn,
      available,
      now: () => latest,
      addListener: (event, fn) => {
        listeners.push({ event, fn })
        return { remove: () => removed.push(event) }
      }
    },
    emit: (body) => {
      latest = body
      listeners.filter((l) => l.event === 'onFold').forEach((l) => l.fn(body))
    },
    listeners,
    removed
  }
}

/* A clock and timers the test moves by hand. */
function fakeTime() {
  let t = 1_000_000
  const timers = new Map()
  let next = 1
  return {
    now: () => t,
    later: (fn, ms) => {
      const id = next++
      timers.set(id, { fn, due: t + ms })
      return id
    },
    cancel: (id) => timers.delete(id),
    pass(ms) {
      t += ms
      for (const [id, { fn, due }] of [...timers]) {
        if (due <= t) {
          timers.delete(id)
          fn()
        }
      }
    },
    pending: () => timers.size
  }
}

const reading = (over = {}) => ({
  hinge: { status: 'fullyOpen', angle: 180 },
  fold: { x: 475.5, y: 0, width: 0, height: 669, active: false },
  occlusions: [{ x: 880, y: 10, width: 60, height: 40, active: true }],
  window: { x: 0, y: 0, width: 951, height: 669 },
  verticalBarEdge: 'trailing',
  ...over
})

export function run(test) {
  const raw = read(MODULE)
  const code = swiftCode(raw)

  test('the fold sensor is the iPhone’s alone: nothing for Android, the browser, or the watch', () => {
    const config = JSON.parse(read(`${DIR}/expo-module.config.json`))
    assert.deepEqual(config.platforms, ['apple'], 'the fold sensor is offered to another platform')
    assert.deepEqual(config.apple.modules, ['FractalFoldModule'])
    assert.deepEqual(Object.keys(config).sort(), ['apple', 'platforms'], 'the module config names something more than the iPhone')
    /* Three files and no more: no Android source, no web entry, no package for a bundler to find. */
    const files = []
    const walk = (dir, rel = '') => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full, `${rel}${entry}/`)
        else files.push(`${rel}${entry}`)
      }
    }
    walk(fileURLToPath(new URL(`../${DIR}/`, import.meta.url)))
    assert.deepEqual(files.sort(), ['expo-module.config.json', 'ios/FractalFold.podspec', 'ios/FractalFoldModule.swift'])
    const pod = read(`${DIR}/ios/FractalFold.podspec`)
    assert.match(pod, /s\.name\s+= 'FractalFold'/)
    assert.match(pod, /s\.platforms\s+= \{ :ios => '16\.4' \}/, 'the pod is not the iPhone’s, at the app’s own lowest iOS')
    assert.match(pod, /s\.static_framework = true/)
    assert.match(pod, /s\.dependency 'ExpoModulesCore'/)
    assert.match(pod, /s\.swift_version\s+= '5\.9'/, 'the Swift language mode moved off the other modules’ 5.9')
    /* The JavaScript asks for it in the way that answers null where it is not. */
    const js = read(SENSOR_JS)
    assert.match(js, /requireOptionalNativeModule\('FractalFold'\)/)
    assert.doesNotMatch(js, /requireNativeModule\(/, 'a module that is missing on Android and in the browser is asked for in the way that throws')
    for (const twin of ['foldSensor.android.js', 'foldSensor.ios.js', 'foldSensor.web.js', 'foldSensor.native.js']) {
      assert.ok(!existsSync(new URL(`../mobile/src/lib/${twin}`, import.meta.url)), `${twin}: the sensor has a second face somewhere`)
    }
    /* The watch builds the shared Swift folder, and nothing of the fold is in it. */
    assert.ok(!/FractalFold|UIHinge|reservedRegions/.test(swiftCode(read('mobile/targets/watch/_shared/SiriShortcuts.swift'))))
    /* And every pull request that touches it is built on a Mac, compiled out, before an EAS slot is spent. */
    const wf = read('.github/workflows/watch.yml')
    assert.ok(wf.includes("'mobile/modules/**'"), 'watch.yml does not build a pull request that changes mobile/modules/fractal-fold')
    assert.match(wf, /npx expo prebuild -p ios --no-install/)
  })

  test('the iOS 27.1 code sits behind both guards: the SDK’s, and iOS 27.1’s own', () => {
    const lines = ifContext(code)
    const guards = lines.filter((l) => l.directive && /^#if\b/.test(l.text.trim()))
    assert.ok(guards.length >= 5, 'the guards were not found to check')
    for (const g of guards) assert.equal(g.text.trim(), GUARD, `an #if other than the one SDK guard: ${g.text.trim()}`)
    /* The probe class: inside the guard and marked iOS 27.1 as a whole. */
    const probe = block(code, 'final class FoldProbe: UIView {')
    assert.match(code, /@available\(iOS 27\.1, \*\)\nfinal class FoldProbe: UIView \{/, 'the probe is not marked iOS 27.1')
    const probeStart = code.slice(0, code.indexOf('final class FoldProbe: UIView {')).split('\n').length - 1
    const probeEnd = probeStart + probe.split('\n').length - 1
    let checked = 0
    lines.forEach((l, i) => {
      if (l.directive || !NEW_NAMES.test(l.text)) return
      checked++
      assert.ok(l.conditions.includes(GUARD) && !l.conditions.includes(`!${GUARD}`), `line ${i + 1} uses an iOS 27.1 name outside the SDK guard: ${l.text.trim()}`)
      if (i >= probeStart && i <= probeEnd) return
      /* Outside the probe: after an #available(iOS 27.1, *) in the same function. */
      let j = i
      while (j >= 0 && !/\bfunc \w+\(/.test(lines[j].text)) j--
      assert.ok(j >= 0, `line ${i + 1} is in no function`)
      const between = lines.slice(j, i + 1).map((x) => x.text).join('\n')
      assert.match(between, /#available\(iOS 27\.1, \*\)/, `line ${i + 1} uses an iOS 27.1 name with no #available(iOS 27.1, *) before it: ${l.text.trim()}`)
    })
    assert.ok(checked >= 10, `only ${checked} uses of the iOS 27.1 names were found to check`)
    /* Every line of the probe is under the guard. */
    for (let i = probeStart; i <= probeEnd; i++) assert.ok(lines[i].conditions.includes(GUARD), `line ${i + 1} of the probe is outside the SDK guard`)
    /* The number that no page of Apple's gives is said to be so, with where it came from. */
    assert.match(raw, /NOT ON APPLE'S PAGES: the version number in the canImport guard below,\s+\*\s+9127\.0\.85/)
    assert.match(raw, /expo-hinge 58\.0\.0/)
  })

  test('the module says whether its iOS 27.1 code was compiled in, and duo.yml fails when it was not', () => {
    const flag = block(code, '  static let compiledIn: Bool = {')
    assert.match(flag, new RegExp(`${GUARD.replace(/[.()]/g, '\\$&')}\\s*return true\\s*#else\\s*return false\\s*#endif`), 'compiledIn is not true exactly where the SDK guard lets the code in')
    const available = block(code, '  static var available: Bool {')
    assert.match(available, /if #available\(iOS 27\.1, \*\) \{\s*return true\s*\}\s*#endif\s*return false/)
    assert.match(code, /Constant\("compiledIn"\) \{\s*FoldSensor\.compiledIn\s*\}/, 'the flag is not handed to the JavaScript')
    assert.match(code, /Constant\("available"\) \{\s*FoldSensor\.available\s*\}/)
    /* Its own lines for duo.yml: only when launched with the argument, to standard error and the system log. */
    const argument = code.match(/static let CHECK_ARGUMENT = "([^"]+)"/)?.[1]
    const prefix = code.match(/static let CHECK_PREFIX = "([^"]+)"/)?.[1]
    assert.equal(argument, '-FractalFoldCheck')
    assert.equal(prefix, 'FractalFold check:')
    assert.match(code, /private let checking = ProcessInfo\.processInfo\.arguments\.contains\(FoldSensor\.CHECK_ARGUMENT\)/)
    const report = block(code, '  private func report(_ line: String) {')
    assert.match(report, /guard checking else \{ return \}/, 'the check’s lines are written on every phone')
    assert.match(report, /FileHandle\.standardError\.write\(contentsOf:/)
    assert.match(report, /NSLog\("%@", text\)/)
    assert.match(code, /report\("compiledIn=\\\(FoldSensor\.compiledIn\) available=\\\(FoldSensor\.available\) ios=/)
    assert.match(code, /report\("reading \\\(FoldSensor\.json\(reading\.body\)\)"\)/)
    assert.match(code, /JSONSerialization\.data\(withJSONObject: body, options: \[\.sortedKeys\]\)/)
    assert.match(block(code, '    OnCreate {'), /self\.sensor\.selfCheck\(\)/, 'the first line is not written as the module starts')

    const duo = read('.github/workflows/duo.yml')
    const name = '- name: The fold sensor is compiled in'
    assert.ok(duo.includes(name), 'duo.yml does not check the fold sensor was compiled in')
    assert.ok(duo.indexOf(name) > duo.indexOf('- name: The app builds with Xcode 27.1'), 'the flag is read before the app is built')
    assert.ok(duo.indexOf(name) > duo.indexOf('- name: Xcode 27.1'), 'the flag is read on another Xcode than 27.1')
    const step = duo.slice(duo.indexOf(name), duo.indexOf('- uses: actions/upload-artifact'))
    assert.ok(step.length > 200, 'the fold step is empty')
    assert.match(step, new RegExp(`xcrun simctl launch --stderr="\\$OUT" "\\$UDID" cloud\\.newbold\\.fractalremote ${argument} YES`), 'the app is not launched so that it writes its check lines where duo.yml reads them')
    assert.ok(step.includes(`grep -q '${prefix} compiledIn=true'`), 'duo.yml does not look for compiledIn=true')
    assert.match(step, /grep -q 'FractalFold check: compiledIn=true' \\\n\s*\|\| \{ echo "[^"]+"; exit 1; \}/, 'a false flag, or none, does not fail the run')
    assert.match(step, /grep -q 'FractalFold check: reading \.\*"window":\{' \\\n\s*\|\| \{ echo "[^"]+"; exit 1; \}/, 'a sensor that never reads the window passes')
    assert.match(step, /log show --last 5m --style compact/, 'the system log is not read when the file stays empty')
    assert.doesNotMatch(duo, /pull_request:/)
  })

  test('the probe takes part in Auto Layout, and reads the fold where UIKit tracks it and wherever it may have moved', () => {
    const probe = block(code, 'final class FoldProbe: UIView {')
    assert.match(probe, /override class var requiresConstraintBasedLayout: Bool \{\s*return true\s*\}/, 'the probe does not ask for constraint-based layout')
    assert.match(probe, /translatesAutoresizingMaskIntoConstraints = false/)
    const attach = block(code, '  func attach() {')
    for (const edge of ['leading', 'trailing', 'top', 'bottom']) {
      assert.ok(attach.includes(`fresh.${edge}Anchor.constraint(equalTo: window.${edge}Anchor)`), `the probe is not pinned to the window’s ${edge} edge`)
    }
    assert.match(attach, /NSLayoutConstraint\.activate\(\[/)
    assert.match(attach, /guard let window = SceneGeometry\.keyWindow\(\) else \{/)
    /* updateConstraints reads, changes nothing, asks for no second pass, and calls super last. */
    const update = block(probe, '  override func updateConstraints() {')
    assert.match(update, /\{\s*readNow\(\)\s*super\.updateConstraints\(\)\s*\}$/, 'updateConstraints does not read the regions and then call super last')
    assert.doesNotMatch(update, /setNeedsUpdateConstraints/, 'updateConstraints asks for another pass of itself: Apple’s feedback loop')
    /* Both kinds, inactive ones included, and the side bar from the probe's own traits. */
    const reader = block(probe, '  private func read(_ window: UIWindow) -> FoldReading {')
    assert.match(reader, /reservedRegions\(kind: \.division, options: \.includeInactive\)/)
    assert.match(reader, /reservedRegions\(kind: \.occlusion, options: \.includeInactive\)/)
    assert.match(reader, /traitCollection\.verticalBarEdge/)
    assert.match(reader, /window: FoldBox\(window\.bounds\)/, 'the reading does not carry the key window’s bounds')
    assert.match(reader, /divisions\.first\(where: \{ \$0\.isActive \}\) \?\? divisions\.first/)
    /* Read again on every hinge update, every change of size, on moving window, and once the hinge is still. */
    assert.match(probe, /UIHingeInteraction \{ \[weak self\] _, update in\s*self\?\.hingeMoved\(update\.hinge\)\s*\}/)
    assert.match(probe, /addInteraction\(interaction\)/)
    assert.match(block(probe, '  private func hingeMoved(_ update: UIHinge?) {'), /setNeedsUpdateConstraints\(\)\s*readNow\(\)\s*settleLater\(\)/)
    assert.match(block(probe, '  override func layoutSubviews() {'), /guard bounds != seenBounds else \{ return \}\s*seenBounds = bounds\s*setNeedsUpdateConstraints\(\)\s*readNow\(\)/)
    assert.match(block(probe, '  override func didMoveToWindow() {'), /setNeedsUpdateConstraints\(\)\s*readNow\(\)/)
    const settle = block(probe, '  private func settleLater() {')
    assert.match(settle, /settle\?\.cancel\(\)/)
    assert.match(settle, /try\? await Task\.sleep\(nanoseconds: FoldProbe\.SETTLE_NANOSECONDS\)\s*guard !Task\.isCancelled, let self else \{ return \}\s*self\.setNeedsUpdateConstraints\(\)\s*self\.readNow\(\)/)
    assert.match(probe, /static let SETTLE_NANOSECONDS: UInt64 = 500_000_000/)
    /* Seen by nobody: no touches, nothing drawn, nothing for VoiceOver. */
    for (const quiet of ['isUserInteractionEnabled = false', 'isOpaque = false', 'backgroundColor = .clear', 'isAccessibilityElement = false', 'accessibilityElementsHidden = true']) {
      assert.ok(probe.includes(quiet), `the probe is not ${quiet}`)
    }
    /* Into the window again when it may have changed. */
    assert.match(code, /for name in \[UIScene\.didActivateNotification, UIWindow\.didBecomeKeyNotification\]/)
    assert.match(block(code, '    OnAppBecomesActive {'), /self\.attachSoon\(\)/)
    assert.match(block(code, '    OnStartObserving("onFold") {'), /self\.sensor\.listen\(true\)\s*self\.attachSoon\(\)/)
    assert.match(code, /if let current = self\.probe, current\.window === window \{\s*return\s*\}/, 'the probe is put into a window it is already in')
  })

  test('the event’s shape is frozen, and both ends say it alike', async () => {
    const bench = await sensorOnABench(null)
    try {
      const f = bench.fold
      assert.deepEqual(bodyKeys(code, 'FoldReading'), [...f.FOLD_KEYS], 'the reading’s keys moved at one end')
      assert.deepEqual(bodyKeys(code, 'FoldHinge'), ['status', 'angle'])
      assert.deepEqual(bodyKeys(code, 'FoldBox'), ['x', 'y', 'width', 'height'])
      assert.deepEqual(bodyKeys(code, 'FoldRegion'), ['active'], 'a region is not a box and whether it is active')
      assert.match(block(code, 'struct FoldRegion: Equatable {'), /var out = box\.body/)
      /* Nulls are JavaScript's null, never left out. */
      for (const key of ['hinge', 'fold', 'window', 'verticalBarEdge']) assert.match(code, new RegExp(`"${key}": FoldReading\\.orNull\\(`))
      assert.match(code, /"occlusions": occlusions\.map \{ \$0\.body \}/)
      /* The words for the hinge and the bar's edge, Apple's case names, are the JavaScript's. */
      const hinge = block(code, '  static func hingeOf(_ hinge: UIHinge) -> FoldHinge {')
      assert.deepEqual([...hinge.matchAll(/case \.(\w+): status = "(\w+)"/g)].map((m) => [m[1], m[2]]), f.HINGE_STATUSES.map((s) => [s, s]))
      assert.match(hinge, /@unknown default: status = "unknown"/)
      assert.match(hinge, /angle: \(Double\(hinge\.angle\) \* 180 \/ \.pi\)\.rounded\(\)/, 'the angle is not whole degrees from Apple’s radians')
      const edge = block(code, '  static func edgeOf(_ edge: UIVerticalBarEdge) -> String {')
      const edges = [...edge.matchAll(/case \.(\w+): return "(\w+)"/g)].map((m) => [m[1], m[2]])
      assert.deepEqual(edges, f.BAR_EDGES.filter((e) => e !== 'unknown').map((e) => [e, e]))
      assert.match(edge, /@unknown default: return "unknown"/)
      /* Points to a tenth. */
      assert.match(code, /return \(Double\(value\) \* 10\)\.rounded\(\) \/ 10/)
      /* The names: the module, its event, its call. */
      assert.match(code, /Name\("FractalFold"\)/)
      assert.match(code, new RegExp(`Events\\("${f.FOLD_EVENT}"\\)`))
      assert.match(code, new RegExp(`self\\?\\.sendEvent\\("${f.FOLD_EVENT}", body\\.mapValues \\{ Optional\\(\\$0\\) \\}\\)`))
      assert.match(code, /Function\("now"\) \{ \(\) -> \[String: Any\] in\s*self\.sensor\.now\(\)\s*\}/)
      /* Its own event's listeners only, and sent only on a change while one listens. */
      assert.match(code, /OnStartObserving\("onFold"\)/)
      assert.match(code, /OnStopObserving\("onFold"\) \{\s*self\.sensor\.listen\(false\)\s*\}/)
      assert.doesNotMatch(code, /OnStartObserving \{|OnStopObserving \{/, 'a module-wide observer')
      const take = block(code, '  private func take(_ reading: FoldReading) {')
      assert.match(take, /let changed = reading != latest/)
      assert.match(take, /let tell = changed && listening \? onChange : nil/)
      assert.match(take, /guard changed else \{ return \}/)
      /* now() answers from a copy under a lock, never from UIKit on the JavaScript's thread. */
      assert.match(block(code, '  func now() -> [String: Any] {'), /lock\.lock\(\)\s*defer \{ lock\.unlock\(\) \}\s*return latest\.body/)
      assert.match(code, /static let empty = FoldReading\(hinge: nil, fold: nil, occlusions: \[\], window: nil, verticalBarEdge: nil\)/)
    } finally {
      bench.done()
    }
  })

  test('Apple’s own names are the ones written down at the top of the Swift', () => {
    const header = raw.slice(0, raw.indexOf('*/') + 2)
    for (const name of [
      'UIHingeInteraction',
      'init(updateHandler:)',
      'UIHingeInteraction.Update.hinge',
      'UIHinge.angle',
      'UIHinge.status',
      'UIView.reservedRegions(kind:options:)',
      'UIView.ReservedRegion',
      'UIView.ReservedRegion.Kind',
      'UIView.ReservedRegion.QueryOptions.includeInactive',
      'UITraitCollection.verticalBarEdge',
      'requiresConstraintBasedLayout',
      'updateConstraints()',
      'UIScene.didActivateNotification'
    ]) {
      assert.ok(header.includes(name), `${name} is used and not written down`)
    }
    assert.match(header, /fetched 23 October 2026/)
    assert.match(header, /"UIKit tracks the\s+\*\s+regions you read in updateConstraints\(\) and\s+\*\s+runs it again when the regions change\."/)
  })

  test('the fold sensor asks for nothing: no permission, no Info.plist key, no entitlement, no reason to give Apple', () => {
    const app = JSON.parse(read('mobile/app.json')).expo
    assert.doesNotMatch(JSON.stringify(app), /hinge|fractal-fold|FractalFold/i, 'app.json carries something for the fold sensor')
    const pod = read(`${DIR}/ios/FractalFold.podspec`)
    assert.doesNotMatch(pod, /frameworks|resource|info_plist|entitlements|xcprivacy/i, 'the pod brings a framework, a resource or a setting with it')
    /* Nothing in it that Apple's privacy manifest wants a reason for. */
    assert.doesNotMatch(code, /UserDefaults|systemUptime|mach_absolute_time|attributesOfItem|creationDate|modificationDate|volumeAvailableCapacity|activeInputModes/)
    assert.doesNotMatch(code, /requestAuthorization|AVCapture|CoreMotion|CMMotion/)
    /* What it writes is plain. */
    const words = swiftStrings(code).filter((w) => /[a-z]{3}/i.test(w))
    assert.ok(words.length > 5)
    for (const w of words) {
      assert.ok(!/this phone/i.test(w), `“${w}” says “this phone”`)
      assert.ok(!/\b(official|certified|approved|endorsed)\b/i.test(w), `“${w}”`)
    }
  })

  test('nothing in the app draws from the fold sensor: one line in the log, from App.js, and that is all', () => {
    const app = read('mobile/App.js')
    assert.match(app, /^import \{ logFoldChanges \} from '\.\/src\/lib\/foldSensor'$/m)
    assert.match(app, /useEffect\(\(\) => logFoldChanges\(\), \[\]\)/)
    assert.equal(app.match(/logFoldChanges/g).length, 2, 'App.js does more with the fold sensor than write it to the log')
    const users = []
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) {
          if (entry !== 'node_modules') walk(full)
        } else if (/\.(jsx?|mjs)$/.test(entry)) {
          const text = readFileSync(full, 'utf8')
          if (/foldSensor|FractalFold/.test(text)) users.push(full.split('/mobile/')[1])
        }
      }
    }
    walk(fileURLToPath(new URL('../mobile/src/', import.meta.url)))
    assert.deepEqual(users, ['src/lib/foldSensor.js'], 'something on screen reads the fold sensor before it has been seen right on a Duo')
  })

  test('on a build without the module, the sensor is nothing at all, and says nothing', async () => {
    const bench = await sensorOnABench(null)
    try {
      const f = bench.fold
      assert.equal(f.foldSensorPresent(), false)
      assert.equal(f.foldCompiledIn(), false)
      assert.equal(f.foldAvailable(), false)
      assert.equal(f.readFold(), null)
      const stop = f.logFoldChanges()
      assert.equal(typeof stop, 'function')
      stop()
      assert.deepEqual(bench.lines, [], 'Android, the browser or an old build writes a fold line')
      assert.deepEqual(bench.asked, ['FractalFold'], 'the module is asked for by another name, or asked every time')
    } finally {
      bench.done()
    }
  })

  test('compiled out, or below iOS 27.1, it is one line in the log and no listener', async () => {
    for (const [flags, said] of [
      [{ compiledIn: false, available: false }, /compiled out of this build/],
      [{ compiledIn: true, available: false }, /not on this iOS/]
    ]) {
      const fake = fakeSensor(flags)
      const bench = await sensorOnABench(fake.mod)
      try {
        const f = bench.fold
        assert.equal(f.foldSensorPresent(), true)
        assert.equal(f.foldCompiledIn(), flags.compiledIn)
        assert.equal(f.foldAvailable(), false)
        f.logFoldChanges()()
        assert.equal(bench.lines.length, 1)
        assert.equal(bench.lines[0][0], 'fold')
        assert.match(bench.lines[0][1], said)
        assert.deepEqual(fake.listeners, [], 'a sensor that sends nothing is listened to')
      } finally {
        bench.done()
      }
    }
  })

  test('on a Duo, a line for each change of shape, never two a second, and none for a degree of the hinge', async () => {
    const fake = fakeSensor({ reading: reading() })
    const bench = await sensorOnABench(fake.mod)
    try {
      const f = bench.fold
      const time = fakeTime()
      const stop = f.logFoldChanges({ now: time.now, later: time.later, cancel: time.cancel })
      const said = () => bench.lines.map((l) => l[1])
      assert.deepEqual(fake.listeners.map((l) => l.event), [f.FOLD_EVENT])
      assert.equal(said()[0], 'Fold sensor: on')
      assert.equal(said()[1], 'Fold: hinge fullyOpen at 180°; fold runs down at x 476, 0 wide, inactive; window 951×669; side bar trailing; 1 covered area, 1 active')
      assert.ok(bench.lines.every((l) => l[0] === 'fold'))
      /* The hinge moving a few degrees is not a change of shape. */
      time.pass(5000)
      fake.emit(reading({ hinge: { status: 'fullyOpen', angle: 176 } }))
      assert.equal(said().length, 2)
      /* Half-folded like a book: the fold comes into force. */
      fake.emit(reading({ hinge: { status: 'partiallyOpen', angle: 120 }, fold: { x: 465, y: 0, width: 21, height: 669, active: true } }))
      assert.equal(said().length, 3)
      assert.match(said()[2], /^Fold: hinge partiallyOpen at 120°; fold runs down at x 465, 21 wide, active;/)
      /* Two more inside a second: held, and only the newest written when the second is up. */
      fake.emit(reading({ hinge: { status: 'partiallyOpen', angle: 95 }, fold: { x: 465, y: 0, width: 21, height: 669, active: true }, verticalBarEdge: 'unspecified' }))
      fake.emit(reading({ hinge: { status: 'fullyOpen', angle: 178 } }))
      assert.equal(said().length, 3, 'a change inside a second of the last line was written at once')
      assert.equal(time.pending(), 1)
      time.pass(f.FOLD_LOG_MS)
      assert.equal(said().length, 4)
      assert.match(said()[3], /^Fold: hinge fullyOpen at 178°; fold runs down at x 476, 0 wide, inactive;/, 'the held line is not the newest reading')
      /* Not readings: no window yet, garbage, nothing. */
      time.pass(5000)
      fake.emit(reading({ window: null, hinge: { status: 'closed', angle: 0 } }))
      fake.emit({ hinge: 'open' })
      fake.emit(null)
      fake.emit([1, 2])
      assert.equal(said().length, 4, 'something that is not a reading with a window was written')
      /* Turned a quarter: the window tall, the fold across. */
      fake.emit(reading({ hinge: { status: 'partiallyOpen', angle: 100 }, window: { x: 0, y: 0, width: 669, height: 951 }, fold: { x: 0, y: 465, width: 669, height: 21, active: true }, verticalBarEdge: 'unspecified' }))
      assert.match(said()[4], /fold runs across at y 465, 21 tall, active; window 669×951; side bar unspecified;/)
      /* A change, then stopping before its second is up: nothing more, and the timer gone. */
      fake.emit(reading())
      assert.equal(time.pending(), 1)
      stop()
      assert.equal(time.pending(), 0)
      time.pass(5000)
      assert.equal(said().length, 5)
      assert.deepEqual(fake.removed, [f.FOLD_EVENT])
    } finally {
      bench.done()
    }
  })

  test('a reading is taken only as the Swift sends it', async () => {
    const bench = await sensorOnABench(null)
    try {
      const { foldReading, foldRuns } = bench.fold
      assert.deepEqual(foldReading(reading()), reading())
      assert.equal(foldReading(null), null)
      assert.equal(foldReading('fold'), null)
      assert.equal(foldReading([]), null)
      const odd = foldReading({
        hinge: { status: 'tent', angle: 90 },
        fold: { x: 1, y: 2, width: 3, height: 'tall', active: true },
        occlusions: [{ x: 1, y: 2, width: 3, height: 4, active: true }, { x: 1, y: 2, width: 3, height: 4 }, null],
        window: { x: 0, y: 0, width: Infinity, height: 1 },
        verticalBarEdge: 'left'
      })
      assert.deepEqual(odd, { hinge: null, fold: null, occlusions: [{ x: 1, y: 2, width: 3, height: 4, active: true }], window: null, verticalBarEdge: null })
      assert.deepEqual(Object.keys(foldReading({})), ['hinge', 'fold', 'occlusions', 'window', 'verticalBarEdge'])
      assert.equal(foldReading({ verticalBarEdge: 'unknown' }).verticalBarEdge, 'unknown')
      assert.equal(foldReading({ hinge: { status: 'unknown', angle: 0 } }).hinge.status, 'unknown')
      /* Apple's rule for which way the fold runs: its frame's width against its height. */
      assert.equal(foldRuns({ x: 465, y: 0, width: 21, height: 669 }), 'down')
      assert.equal(foldRuns({ x: 475, y: 0, width: 0, height: 669 }), 'down')
      assert.equal(foldRuns({ x: 0, y: 465, width: 669, height: 21 }), 'across')
      assert.equal(foldRuns(null), null)
    } finally {
      bench.done()
    }
  })
}
