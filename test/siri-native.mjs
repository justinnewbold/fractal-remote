/**
 * SIRI'S NATIVE HALF: THE PHRASES AND THE HAND-OFF.
 *
 * "Let's add all of the Siri commands to the build that we can." (Justin,
 * 23 October 2026.) The phrases are Swift in the iPhone app's own target
 * (mobile/targets/watch/_shared/SiriShortcuts.swift), the hand-off is the
 * FractalSiri module (mobile/modules/fractal-siri), and the JavaScript end of
 * it is mobile/src/lib/siriPipe.js. Nothing on this machine compiles Swift,
 * so the Swift is READ here, against Apple's rules and against the JavaScript
 * it talks to; watch.yml's iphone job and duo.yml compile it on a Mac. The
 * JavaScript end is RUN, against a stand-in module.
 *
 * What these hold:
 *   - Apple's rules for App Shortcuts: at most ten, and the app's own name in
 *     every phrase, with no other name for the app ("Fractal" or "FM3" alone:
 *     guideline 2.5.11(ii), and Fractal Audio's letter);
 *   - that it is the iPhone's: inside #if os(iOS), because the watch builds
 *     the same folder;
 *   - that nothing in it is newer than iOS 16, which the app still installs
 *     on, apart from iOS 26's supportedModes;
 *   - that every command brings the app to the front;
 *   - that both ends name the commands, the pedals, the event, the reply, the
 *     timeout and the "Not sent." alike, and that the time a command arrived
 *     is taken before anything waits;
 *   - no Siri entitlement and no usage string, which App Shortcuts do not need.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

const SHORTCUTS = 'mobile/targets/watch/_shared/SiriShortcuts.swift'
const MODULE = 'mobile/modules/fractal-siri/ios/FractalSiriModule.swift'
const PIPE_JS = 'mobile/src/lib/siriPipe.js'

/* Swift without its comments. Its block comments nest, so the file is first held to having none inside another. */
export function swiftCode(text) {
  let out = ''
  let depth = 0
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (depth === 0 && inString) {
      out += c
      if (c === '\\') {
        out += text[++i]
        continue
      }
      if (c === '"' || c === '\n') inString = false
      continue
    }
    if (depth === 0 && text.startsWith('//', i)) {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
      continue
    }
    if (text.startsWith('/*', i)) {
      depth++
      assert.equal(depth, 1, 'a Swift comment opens inside another one, and Swift nests them: everything after it is a comment')
      i++
      continue
    }
    if (depth > 0) {
      if (text.startsWith('*/', i)) {
        depth--
        i++
      }
      continue
    }
    if (c === '"') inString = true
    out += c
  }
  assert.equal(depth, 0, 'a Swift comment is never closed')
  return out
}

/* Every string literal in Swift code, as written (escapes kept). */
export const swiftStrings = (code) => [...code.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1])

/* The phrases of each App Shortcut, in order. */
export function shortcuts(code) {
  const body = code.slice(code.indexOf('static var appShortcuts: [AppShortcut] {'))
  return [...body.matchAll(/AppShortcut\(\s*intent: (\w+)\(\),\s*phrases: \[([\s\S]*?)\]\s*\)/g)].map((m) => ({
    intent: m[1],
    phrases: swiftStrings(m[2])
  }))
}

/* Each `struct X: AppIntent { … }`, by name, to the brace that closes it at the start of a line. */
function intents(code) {
  const out = {}
  for (const m of code.matchAll(/^struct (\w+): AppIntent \{/gm)) {
    const end = code.indexOf('\n}', m.index)
    assert.ok(end > m.index, `${m[1]} is never closed`)
    out[m[1]] = code.slice(m.index, end + 2)
  }
  return out
}

/* An enum's cases and raw values, in order. */
export function enumCases(code, name) {
  const body = code.slice(code.indexOf(`enum ${name}: String, AppEnum {`), code.indexOf('static let typeDisplayRepresentation', code.indexOf(`enum ${name}:`)))
  return [...body.matchAll(/^\s*case (\w+)(?: = "([^"]*)")?\s*$/gm)].map((m) => ({ name: m[1], raw: m[2] ?? m[1] }))
}

/*
 * siriPipe.js on a bench: 'expo' swapped for a stand-in whose
 * requireOptionalNativeModule answers `mod` (null for a build without the
 * module), written afresh each time so the module's own memory starts empty.
 */
async function pipeOnABench(mod) {
  const dir = mkdtempSync(join(tmpdir(), 'siri-pipe-'))
  let lib = read(PIPE_JS)
  assert.ok(lib.includes("from 'expo'"), 'siriPipe.js no longer imports expo: the bench needs telling')
  lib = lib.replace("from 'expo'", "from './expo.js'")
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
  writeFileSync(join(dir, 'expo.js'), 'export const native = { module: null, asked: [] }\nexport const requireOptionalNativeModule = (name) => { native.asked.push(name); return native.module }\n')
  writeFileSync(join(dir, 'siriPipe.js'), lib)
  const at = (f) => pathToFileURL(join(dir, f)).href
  const expo = await import(at('expo.js'))
  expo.native.module = mod
  return { pipe: await import(at('siriPipe.js')), asked: expo.native.asked, done: () => rmSync(dir, { recursive: true, force: true }) }
}

/* A stand-in FractalSiri module: what JavaScript hears, and what it says back. */
function fakeModule() {
  const listeners = []
  const replies = []
  const removed = []
  return {
    mod: {
      addListener: (event, fn) => {
        listeners.push({ event, fn })
        return { remove: () => removed.push(event) }
      },
      reply: (id, words) => replies.push([id, words])
    },
    emit: (body) => listeners.filter((l) => l.event === 'onCommand').forEach((l) => l.fn(body)),
    listeners,
    replies,
    removed
  }
}

export function run(test) {
  const shortcutsText = read(SHORTCUTS)
  const moduleText = read(MODULE)
  const code = swiftCode(shortcutsText)
  const moduleCode = swiftCode(moduleText)

  test('the Siri phrases are the iPhone app’s own, and the watch, which builds the same folder, gets nothing', () => {
    /* The folder @bacons/apple-targets links into the iPhone app as well as the watch (its README, "_shared"), and watch.yml builds both on every pull request that touches it. */
    const app = JSON.parse(read('mobile/app.json')).expo
    assert.ok(app.plugins.includes('@bacons/apple-targets'), 'nothing links the _shared folder into the iPhone app')
    assert.match(read('mobile/package.json'), /"@bacons\/apple-targets": "\^5\./, 'apple-targets moved off 5.x, whose _shared folder was read for this')
    assert.match(read('mobile/targets/watch/expo-target.config.js'), /type: 'watch'/)
    const wf = read('.github/workflows/watch.yml')
    for (const path of ["'mobile/targets/watch/**'", "'mobile/modules/**'"]) assert.ok(wf.includes(path), `watch.yml does not build a pull request that changes ${path}`)
    /* All of it inside #if os(iOS), the module's import too: the watch has no FractalSiri. */
    const lines = code.split('\n').map((l) => l.trim()).filter(Boolean)
    assert.equal(lines[0], '#if os(iOS)', 'the Siri file does not start with #if os(iOS)')
    assert.equal(lines.at(-1), '#endif', 'the Siri file does not end with the #endif of os(iOS)')
    assert.equal((code.match(/^\s*#if\b/gm) || []).length, (code.match(/^\s*#endif\b/gm) || []).length, 'an #if is never closed')
    assert.ok(code.indexOf('internal import FractalSiri') > code.indexOf('#if os(iOS)'), 'the watch is asked to import a module only the iPhone has')
    assert.match(code, /^import AppIntents$/m)
  })

  test('at most ten App Shortcuts, and every phrase says the app’s own name and no other', () => {
    const list = shortcuts(code)
    assert.ok(list.length > 0, 'no App Shortcuts were found to check')
    assert.ok(list.length <= 10, `${list.length} App Shortcuts; Apple allows ten`)
    assert.equal(list.length, (code.match(/\bAppShortcut\(/g) || []).length, 'an App Shortcut was not read by this test')
    assert.equal(list.length, 9, 'nine, one kept free: a change here is a change to what Siri offers, and to the review notes')
    const seen = new Set()
    for (const { intent, phrases } of list) {
      assert.ok(phrases.length > 0, `${intent} has no phrase`)
      for (const p of phrases) {
        assert.equal(p.split('\\(.applicationName)').length - 1, 1, `“${p}” does not say the app’s name exactly once`)
        assert.ok(!/fractal|fm3|fm9|am4|vp4|axe/i.test(p.replace('\\(.applicationName)', '')), `“${p}” calls the app by another name, or names a unit`)
        assert.ok(!seen.has(p.toLowerCase()), `“${p}” is said twice`)
        seen.add(p.toLowerCase())
        /* At most one choice from a list in a phrase, and only a list: Apple takes no open number. */
        assert.ok((p.match(/\\\(\\\.\$/g) || []).length <= 1, `“${p}” holds more than one choice`)
      }
    }
    /* Each intent offered once, and each one there is offered. */
    assert.deepEqual(list.map((s) => s.intent).sort(), Object.keys(intents(code)).sort())
    /* No name for the app but its own, anywhere it could be set. */
    const app = JSON.parse(read('mobile/app.json')).expo
    assert.ok(!('INAlternativeAppNames' in (app.ios.infoPlist || {})), 'the app has another name for Siri')
    assert.ok(!/negativePhrases|INAlternativeAppNames/.test(code))
    assert.equal(app.name, 'Fractal Remote', 'the name Siri hears in every phrase is not Fractal Remote')
  })

  test('the commands Siri can give, and the lists it can hear, are the agreed ones', () => {
    const list = Object.fromEntries(shortcuts(code).map((s) => [s.intent, s.phrases]))
    assert.ok(list.GoToSceneIntent.includes('Scene \\(\\.$scene) in \\(.applicationName)'))
    assert.ok(list.NextSongIntent.includes('Next song in \\(.applicationName)'))
    assert.ok(list.PreviousSongIntent.includes('Previous song in \\(.applicationName)'))
    assert.ok(list.TunerOnIntent.includes('Tuner on in \\(.applicationName)'))
    assert.ok(list.TunerOffIntent.includes('Tuner off in \\(.applicationName)'))
    assert.ok(list.SetTempoIntent.includes('Set the tempo in \\(.applicationName)'))
    assert.ok(list.LoadPresetIntent.includes('Load a preset in \\(.applicationName)'))
    assert.ok(list.PedalOnIntent.includes('\\(\\.$pedal) on in \\(.applicationName)'))
    assert.ok(list.PedalOffIntent.includes('\\(\\.$pedal) off in \\(.applicationName)'))
    /* Scenes 1 to 8, said as the number. */
    assert.deepEqual(enumCases(code, 'SceneNumber').map((c) => c.raw), ['1', '2', '3', '4', '5', '6', '7', '8'])
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) assert.match(code, new RegExp(`\\.\\w+: "${n}",?\\n`), `scene ${n} has no name Siri hears`)
    /* The pedals, the same list the JavaScript knows, each with the name Siri hears. */
    const pedals = enumCases(code, 'PedalKind').map((c) => c.raw)
    assert.deepEqual(pedals, ['delay', 'drive', 'reverb', 'chorus', 'flanger', 'phaser', 'tremolo', 'pitch', 'wah', 'compressor', 'filter', 'rotary', 'gate', 'boost'])
    for (const p of pedals) assert.ok(code.includes(`.${p}: "${p[0].toUpperCase()}${p.slice(1)}"`), `${p} has no name Siri hears`)
    /* The command words each intent hands on, and the value with them. */
    const sent = Object.fromEntries(Object.entries(intents(code)).map(([name, body]) => [name, body.match(/handOff\("(\w+)"(?:, (number|word): ([\w.]+))?\)/)?.slice(1, 4)]))
    assert.deepEqual(sent, {
      GoToSceneIntent: ['scene', 'number', 'scene.number'],
      NextSongIntent: ['next', undefined, undefined],
      PreviousSongIntent: ['previous', undefined, undefined],
      TunerOnIntent: ['tunerOn', undefined, undefined],
      TunerOffIntent: ['tunerOff', undefined, undefined],
      SetTempoIntent: ['tempo', 'number', 'bpm'],
      LoadPresetIntent: ['preset', 'number', 'number'],
      PedalOnIntent: ['pedalOn', 'word', 'pedal.rawValue'],
      PedalOffIntent: ['pedalOff', 'word', 'pedal.rawValue']
    })
    /* A tempo and a preset number are asked for after the phrase. */
    assert.match(intents(code).SetTempoIntent, /requestValueDialog: IntentDialog\("What tempo\?"\)/)
    assert.match(intents(code).LoadPresetIntent, /requestValueDialog: IntentDialog\("Which preset number\?"\)/)
  })

  test('the tempo Siri takes is the units’ own range, asked again outside it', async () => {
    const { UNIT_BPM } = await import('../shared/tempo.mjs')
    const tempo = intents(code).SetTempoIntent
    assert.ok(tempo.includes(`inclusiveRange: (${UNIT_BPM.min}, ${UNIT_BPM.max})`), 'Siri’s tempo question is not held to 24 to 250')
    assert.ok(tempo.includes(`guard bpm >= ${UNIT_BPM.min}, bpm <= ${UNIT_BPM.max} else {`), 'a tempo outside 24 to 250 is handed on')
    assert.match(tempo, /throw \$bpm\.needsValueError\(IntentDialog\("What tempo, from 24 to 250\?"\)\)/, 'a tempo outside the range is not asked for again')
    assert.ok(tempo.indexOf('guard bpm') < tempo.indexOf('handOff('), 'the tempo is handed on before it is checked')
  })

  test('every command brings the app to the front, on every iOS that runs it', () => {
    for (const [name, body] of Object.entries(intents(code))) {
      assert.ok(body.includes('static let openAppWhenRun: Bool = true'), `${name} may run with the app out of sight`)
      assert.match(body, /#if compiler\(>=6\.2\)\s*@available\(iOS 26\.0, \*\)\s*static var supportedModes: IntentModes \{ \.foreground\(\.immediate\) \}\s*#endif/, `${name} does not say foreground on iOS 26`)
      assert.match(body, /func perform\(\) async throws -> some IntentResult & ProvidesDialog \{/, `${name} gives Siri nothing to say`)
    }
  })

  test('nothing in the phrases is newer than iOS 16, which the app still installs on', () => {
    /*
     * Apple's forums: iOS 16 runs an app's appShortcuts even when the provider
     * is marked iOS 17 only, and crashes on the iOS 17 code in it (thread
     * 747409, FB13711844). So no spoken synonyms and no short titles, both
     * iOS 17, and no @available but iOS 26's, on the one requirement only
     * iOS 26 reads. If the app's lowest iOS ever becomes 17, this can move.
     */
    assert.ok(!/\bsynonyms:/.test(code), 'a spoken synonym is iOS 17 and would crash iOS 16')
    assert.ok(!/\bshortTitle:|\bsystemImageName:/.test(code), 'a short title is iOS 17 and would crash iOS 16')
    const marks = [...code.matchAll(/@available\(([^)]*)\)/g)].map((m) => m[1])
    assert.ok(marks.length > 0 && marks.every((m) => m === 'iOS 26.0, *'), `an availability other than iOS 26's: ${marks.join('; ')}`)
    assert.ok(!/#available/.test(code), 'a runtime check inside the phrases: Apple reads them as they are written')
    assert.ok(!/@MainActor|Task \{/.test(code))
  })

  test('the module: one event, one reply, the time each command arrived, and Siri answered when nothing does', () => {
    const config = JSON.parse(read('mobile/modules/fractal-siri/expo-module.config.json'))
    assert.deepEqual(config.platforms, ['apple'])
    assert.deepEqual(config.apple.modules, ['FractalSiriModule'])
    const pod = read('mobile/modules/fractal-siri/ios/FractalSiri.podspec')
    assert.match(pod, /s\.name\s+= 'FractalSiri'/)
    assert.match(pod, /s\.platforms\s+= \{ :ios => '16\.4' \}/)
    assert.match(pod, /s\.static_framework = true/)
    assert.match(pod, /s\.dependency 'ExpoModulesCore'/)
    assert.match(moduleCode, /Name\("FractalSiri"\)/)
    assert.match(moduleCode, /Events\("onCommand"\)/)
    /* Its own event's listeners only: a module-wide OnStartObserving is what keeps it off the watch's module. */
    assert.match(moduleCode, /OnStartObserving\("onCommand"\) \{\s*FractalSiriPipe\.shared\.listen\(ObjectIdentifier\(self\), true\)/)
    assert.match(moduleCode, /OnStopObserving\("onCommand"\) \{\s*FractalSiriPipe\.shared\.listen\(ObjectIdentifier\(self\), false\)/)
    assert.match(moduleCode, /Function\("reply"\) \{ \(id: String, words: String\) in\s*FractalSiriPipe\.shared\.reply\(id, words\)/)
    assert.match(moduleCode, /OnDestroy \{\s*FractalSiriPipe\.shared\.detach\(ObjectIdentifier\(self\)\)/)
    /* The FractalWatch module is left as it was: no Siri event on it. */
    assert.ok(!/siri/i.test(swiftCode(read('mobile/modules/fractal-watch/ios/FractalWatchModule.swift'))))
    /* The body: id, at, command, value, answered. */
    for (const key of ['"id": id', '"at": (now.timeIntervalSince1970 * 1000).rounded()', '"command": command', 'body["value"] = number', 'body["value"] = word', 'body["answered"] = waiting[item.id] == nil']) {
      assert.ok(moduleCode.includes(key), `the event does not carry ${key}`)
    }
    /* The arrival time is read once, as perform() calls, before anything waits for the main queue or a listener. */
    const ask = moduleCode.slice(moduleCode.indexOf('public func ask('), moduleCode.indexOf('func attach('))
    assert.ok(ask.indexOf('let now = Date()') > 0 && ask.indexOf('let now = Date()') < ask.indexOf('withCheckedContinuation'), 'the arrival time is taken after the wait')
    assert.equal((ask.match(/Date\(\)/g) || []).length, 2, 'a second clock reading stands in for the arrival time')
    /* Held until JavaScript listens, the newest kept, and handed over in order. */
    assert.match(moduleCode, /static let HOLD_SECONDS: Double = 15/)
    assert.match(moduleCode, /static let HOLD_MOST = 8/)
    assert.match(moduleCode, /if self\.listening, self\.deliver != nil \{\s*self\.send\(item\)\s*\} else \{\s*self\.held\.append\(item\)/)
    assert.match(moduleCode, /let fresh = held\.filter \{ Date\(\)\.timeIntervalSince\(\$0\.at\) < FractalSiriPipe\.HOLD_SECONDS \}/)
    /* Siri always gets an answer: the first of the reply and the timeout, once. */
    assert.match(moduleCode, /guard let answer = waiting\.removeValue\(forKey: id\) else \{ return \}\s*answer\.resume\(returning: words \?\? FractalSiriPipe\.NOT_SENT\)/)
    assert.match(moduleCode, /DispatchQueue\.main\.asyncAfter\(deadline: \.now\(\) \+ wait\) \{ self\.finish\(id, nil\) \}/)
    assert.match(moduleCode, /guard !said\.isEmpty else \{ return \}/)
  })

  test('both ends of the hand-off say the same names, the same wait and the same “Not sent.”', async () => {
    const js = read(PIPE_JS)
    const { TAP_DEADLINE_MS } = await import('../shared/relay-rules.mjs')
    const bench = await pipeOnABench(null)
    try {
      const p = bench.pipe
      /* The commands the intents hand on are the JavaScript's list, and nothing else. */
      const handed = [...code.matchAll(/handOff\("(\w+)"/g)].map((m) => m[1])
      assert.deepEqual([...handed].sort(), [...p.SIRI_COMMANDS].sort())
      assert.deepEqual(enumCases(code, 'PedalKind').map((c) => c.raw), [...p.SIRI_PEDALS])
      /* The wait: a few seconds, longer than the tap rule, the same at both ends. */
      const seconds = Number(moduleCode.match(/static let REPLY_SECONDS: Double = (\d+(?:\.\d+)?)/)?.[1])
      assert.equal(seconds * 1000, p.SIRI_REPLY_MS)
      assert.ok(p.SIRI_REPLY_MS > TAP_DEADLINE_MS + 1000 && p.SIRI_REPLY_MS <= 10000, 'Siri’s wait is not a few seconds past the tap rule')
      assert.equal(moduleCode.match(/public static let NOT_SENT = "([^"]*)"/)?.[1], p.SIRI_NOT_SENT)
      assert.match(js, /requireOptionalNativeModule\('FractalSiri'\)/)
      assert.match(js, /mod\.addListener\('onCommand'/)
      assert.match(js, /pipe\(\)\?\.reply\?\.\(String\(id\), String\(words\)\)/)
      /* A build without the module: nothing listens, nothing throws, and it says so. */
      assert.equal(p.siriPresent(), false)
      const stop = p.onSiriCommand(() => assert.fail('a command arrived from nowhere'))
      assert.equal(typeof stop, 'function')
      stop()
      p.answerSiri('x', 'Scene 3.')
      assert.deepEqual(bench.asked, ['FractalSiri'], 'the module is asked for by another name, or asked every time')
    } finally {
      bench.done()
    }
  })

  test('the JavaScript takes each command as the Swift sends it, with the time it arrived, and answers by its id', async () => {
    const fake = fakeModule()
    const bench = await pipeOnABench(fake.mod)
    try {
      const p = bench.pipe
      assert.equal(p.siriPresent(), true)
      const heard = []
      const stop = p.onSiriCommand((cmd) => heard.push(cmd))
      assert.deepEqual(fake.listeners.map((l) => l.event), ['onCommand'])
      const at = Date.now() - 700
      fake.emit({ id: 'a', at, command: 'scene', value: 3, answered: false })
      fake.emit({ id: 'b', at, command: 'pedalOn', value: 'delay', answered: false })
      fake.emit({ id: 'c', at, command: 'next', answered: true })
      /* A clock ahead of the JavaScript's is read as now, never as a later deadline. */
      fake.emit({ id: 'd', at: Date.now() + 60000, command: 'tunerOff' })
      /* Not commands: no id, a word the Swift never sends, a value of the wrong kind. */
      fake.emit({ at, command: 'scene', value: 1 })
      fake.emit({ id: 'e', at, command: 'volumeUp' })
      fake.emit({ id: 'f', at, command: 'tempo', value: 120.5 })
      fake.emit(null)
      assert.deepEqual(heard.slice(0, 3), [
        { id: 'a', at, command: 'scene', value: 3, answered: false },
        { id: 'b', at, command: 'pedalOn', value: 'delay', answered: false },
        { id: 'c', at, command: 'next', value: null, answered: true }
      ])
      assert.equal(heard[3].command, 'tunerOff')
      assert.ok(heard[3].at <= Date.now(), 'a command from the future gets a later deadline')
      assert.deepEqual(heard.slice(4).map((c) => [c.id, c.value]), [['f', null]], 'something that is not a command was passed on, or a tempo of 120.5 kept')
      p.answerSiri('a', 'Scene 3.')
      assert.deepEqual(fake.replies, [['a', 'Scene 3.']])
      stop()
      assert.deepEqual(fake.removed, ['onCommand'])
    } finally {
      bench.done()
    }
  })

  test('what Siri is handed to show or say is plain, and asks for nothing an App Shortcut does not need', () => {
    const words = [...swiftStrings(code), ...swiftStrings(moduleCode)].filter((w) => /[a-z]{3}/i.test(w))
    assert.ok(words.length > 20, 'the words were not found to check')
    for (const w of words) {
      assert.ok(!/this phone/i.test(w), `“${w}” says “this phone”`)
      assert.ok(!/\b(official|certified|approved|endorsed|authori[sz]ed)\b/i.test(w), `“${w}”`)
      assert.ok(!/fractal audio|colour|favourite|grey\b/i.test(w), `“${w}”`)
    }
    /* No Siri entitlement (only an Intents extension handling Siri requests other than shortcuts needs one) and no usage string (only SiriKit's permission prompt does). */
    const app = JSON.parse(read('mobile/app.json')).expo
    assert.ok(!JSON.stringify(app).includes('com.apple.developer.siri'), 'a Siri entitlement App Shortcuts do not need')
    assert.ok(!('NSSiriUsageDescription' in (app.ios.infoPlist || {})), 'a Siri usage string App Shortcuts do not need')
    assert.ok(!/INPreferences|requestSiriAuthorization/.test(code + moduleCode))
  })

  test('duo.yml, on the Xcode EAS uses, checks the built app carries every phrase, and takes a link without falling over', () => {
    /*
     * A phrase file left out of the iPhone app's target, or never extracted,
     * compiles cleanly and gives Siri nothing to hear; only the built app's
     * Metadata.appintents shows it. And a link reaches an app with the scene
     * life cycle through Expo's scene delegate, which only an app opened on a
     * simulator exercises. Both on duo.yml, which builds with Xcode 27.1 as
     * the store build does (test/mobile.mjs holds that half).
     */
    const duo = read('.github/workflows/duo.yml')
    const step = duo.slice(duo.indexOf('- name: The Siri phrases are in the app'), duo.indexOf('- name: It opens, and stays open'))
    assert.ok(step.length > 100, 'duo.yml no longer checks the built app for the Siri phrases')
    assert.ok(duo.indexOf('- name: The Siri phrases are in the app') > duo.indexOf('- name: The app builds with Xcode 27.1'), 'the phrases are looked for before the app is built')
    assert.match(step, /test -d "\$APP\/Metadata\.appintents"/)
    const listed = /for INTENT in ([\w ]+); do/.exec(step)?.[1].trim().split(/\s+/) || []
    assert.deepEqual(listed.sort(), shortcuts(code).map((s) => s.intent).sort(), 'duo.yml looks for other commands than the App Shortcuts the Swift has')
    assert.match(step, /grep -rqa "\$INTENT" "\$APP\/Metadata\.appintents"/)
    /* A phrase, as the Swift writes it, that is in no title. */
    const phrase = /grep -rqa '([^']+)' "\$APP\/Metadata\.appintents"/.exec(step)?.[1]
    assert.ok(phrase && shortcuts(code).some((s) => s.phrases.some((p) => p.startsWith(phrase))), 'duo.yml looks for a phrase the Swift does not have')
    const titles = [...code.matchAll(/(?:title|description)(?:: LocalizedStringResource)? = (?:IntentDescription\()?"([^"]*)"/g)].map((m) => m[1])
    assert.ok(titles.length >= 9, 'the intents’ titles were not found to check against')
    assert.ok(!titles.some((t) => t.includes(phrase)), 'the phrase duo.yml looks for is also a title, so finding it proves nothing')
    /* The link, then still running, on every simulator it opens. */
    const launch = duo.slice(duo.indexOf('- name: It opens, and stays open'))
    const opened = launch.indexOf('xcrun simctl openurl "$UDID" fractalremote://scene/3')
    assert.ok(opened > launch.indexOf('xcrun simctl launch'), 'duo.yml never opens a fractalremote:// link on the running app')
    const loop = launch.indexOf('for PAIR in')
    assert.ok(loop > 0 && opened > loop && opened < launch.indexOf('\n          done', loop), 'the link is opened outside the loop over simulators')
    assert.match(launch.slice(opened), /^[^\n]*\n\s*sleep \d+\n[\s\S]*?launchctl list \| grep -q 'cloud\.newbold\.fractalremote' \\\n\s*\|\| \{ echo "(?:::error::)?The app is not running 10 seconds after fractalremote:\/\/scene\/3 was opened/)
    assert.doesNotMatch(duo, /pull_request:/, 'duo.yml runs on every pull request, on a preview runner that may never start')
  })
}
