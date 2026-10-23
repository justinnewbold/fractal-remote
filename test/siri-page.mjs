/**
 * SETTINGS → SIRI: WHAT THE PAGE SAYS, HELD TO WHAT THE APP DOES.
 *
 * "Let's add all of the Siri commands to the build that we can and update a
 * section in the app that will say how to manage Siri." (Justin, 23 October
 * 2026.) The page's words are lib/siri-help's and the page is
 * components/SiriHelp, which Settings opens from a row under Help.
 *
 * Help text goes stale the way store text does: nothing in the build reads
 * it. So every phrase the page tells somebody to say is held to the Swift's
 * own phrases (a phrase that is not one would simply not work, on stage);
 * every pedal to the Swift's list; the tempo range to shared/tempo.mjs; the
 * links to lib/siri-rule parseLink, never Tuner on; the Play rule to the
 * words lib/siri hands Siri. And the words themselves to the house rules:
 * plain US English, the device in hand by its own name and never "this
 * phone", nothing official, no other name for the app, nothing for an iPad
 * that only an iPhone has, and nothing about Siri on Android. Then the page
 * is drawn, and the row and the page are held to the gate the links use.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { enumCases, shortcuts, swiftCode } from './siri-native.mjs'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const LIB = 'mobile/src/lib'

/* lib/siri-help and lib/siri-rule as the phone has them, on a bench: the mobile folder is not an ES module package. */
async function wordsOnABench() {
  const dir = mkdtempSync(join(tmpdir(), 'siri-page-'))
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
  for (const f of ['siri-help.js', 'siri-rule.js', 'versions.js']) writeFileSync(join(dir, f), read(`${LIB}/${f}`))
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    return { help: await import(at('siri-help.js')), rule: await import(at('siri-rule.js')) }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* The Swift's phrases as Siri hears them: the app's name, any scene, any pedal by the word the Swift shows for it. */
function spokenForms(code) {
  const pedals = pedalWords(code)
  /* The three tokens a phrase may hold, as the Swift source writes them. */
  const TOKENS = { '\\(.applicationName)': 'Fractal Remote', '\\(\\.$scene)': '[1-8]', '\\(\\.$pedal)': `(?:${pedals.join('|')})` }
  const toRegex = (phrase) => {
    const parts = phrase.split(/(\\\(\.applicationName\)|\\\(\\\.\$scene\)|\\\(\\\.\$pedal\))/)
    const plain = parts.filter((p) => !(p in TOKENS))
    assert.ok(!plain.some((p) => p.includes('\\(')), `“${phrase}” holds something this test cannot read`)
    return new RegExp(`^${parts.map((p) => TOKENS[p] ?? p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}$`, 'i')
  }
  return shortcuts(code).map((s) => ({ intent: s.intent, phrases: s.phrases, match: s.phrases.map(toRegex) }))
}

/* PedalKind's words, as the Swift shows them (its caseDisplayRepresentations). */
function pedalWords(code) {
  const start = code.indexOf('static let caseDisplayRepresentations: [PedalKind: DisplayRepresentation] = [')
  assert.ok(start > 0, 'the Swift no longer shows its pedals by word')
  const body = code.slice(start, code.indexOf(']', code.indexOf('[', start + 60)))
  return [...body.matchAll(/\.(\w+): "([^"]+)"/g)].map((m) => m[2])
}

/* Every phrase in a sentence that names the app, inside “ ”: more than the name alone, which is said as a name. */
const quotedPhrases = (text) => [...text.matchAll(/“([^”]*Fractal Remote[^”]*)”/g)].map((m) => m[1]).filter((p) => p !== 'Fractal Remote')

/* Every page the app can show: an iPhone and an iPad with the phrases and without, an Android phone and tablet. */
const PAGES = [
  { os: 'ios', kind: 'phone', native: true },
  { os: 'ios', kind: 'ipad', native: true },
  { os: 'ios', kind: 'phone', native: false },
  { os: 'ios', kind: 'ipad', native: false },
  { os: 'android', kind: 'phone', native: false },
  { os: 'android', kind: 'tablet', native: false }
]
/* The noun as lib/device-word gives it for each kind, and one no sentence could have typed in. */
const NOUN = { phone: 'phone', ipad: 'iPad', tablet: 'tablet' }
const PLACEHOLDER = 'GADGET'

export function run(test) {
  const code = swiftCode(read('mobile/targets/watch/_shared/SiriShortcuts.swift'))

  test('Siri page: every phrase it says to say is one of the Swift’s, and every command has one', async () => {
    const { help } = await wordsOnABench()
    const forms = spokenForms(code)
    const page = help.siriPage({ os: 'ios', kind: 'phone', native: true, noun: 'phone' })
    const said = page.flatMap((s) => (s.phrases || []).flatMap((p) => p.say))
    /* And the ones inside sentences, such as the app's name first. */
    const quoted = page.flatMap((s) => [s.note || '', ...(s.lines || []), ...(s.phrases || []).map((p) => p.does)]).flatMap(quotedPhrases)
    assert.ok(quoted.length > 0, 'the page no longer shows the app’s name first in a phrase')
    for (const phrase of [...said, ...quoted]) {
      assert.ok(
        forms.some((f) => f.match.some((r) => r.test(phrase))),
        `“${phrase}” is on the Siri page, and no phrase in SiriShortcuts.swift is that: Siri would not know it`
      )
    }
    /* Every App Shortcut is on the page, by one of its own phrases. */
    for (const f of forms) {
      assert.ok(said.some((p) => f.match.some((r) => r.test(p))), `${f.intent} is a Siri phrase the page never mentions`)
    }
    /* No phrase on the copy without the Swift, which has none to say. */
    for (const kind of ['phone', 'ipad']) {
      const none = help.siriWords({ os: 'ios', kind, native: false, noun: NOUN[kind] }).flatMap(quotedPhrases)
      assert.deepEqual(none, [], `the ${kind} page without the phrases tells somebody to say ${none.join(', ')}`)
    }
  })

  test('Siri page: the pedals, the tempo, the scenes and the links are the app’s own', async () => {
    const { help, rule } = await wordsOnABench()
    /* The pedals as Siri hears them, Boost (an AM4 amp's) with them. */
    assert.deepEqual([...help.SIRI_PEDAL_WORDS], pedalWords(code), 'the page’s pedals are not the Swift’s')
    const pedalsJs = /SIRI_PEDALS = Object\.freeze\(\[([^\]]*)\]\)/.exec(read(`${LIB}/siriPipe.js`))
    assert.ok(pedalsJs, 'lib/siriPipe no longer lists SIRI_PEDALS')
    assert.deepEqual(
      help.SIRI_PEDAL_WORDS.map((w) => w.toLowerCase()),
      [...pedalsJs[1].matchAll(/'(\w+)'/g)].map((m) => m[1]),
      'the page’s pedals are not the ones the handler acts on'
    )
    const page = help.siriWords({ os: 'ios', kind: 'phone', native: true, noun: 'phone' }).join('\n')
    for (const w of help.SIRI_PEDAL_WORDS.filter((p) => p !== 'Boost')) assert.ok(page.includes(w), `the page never names ${w}`)
    assert.match(page, /On an AM4, Boost is the amp’s boost/)
    /* And the "Also" list under a pedal's phrases is the others: not the one the phrases just showed. */
    const pedalLine = help.siriPage({ os: 'ios', kind: 'phone', native: true, noun: 'phone' })[0].phrases.find((p) => /^Also /.test(p.does))
    const shown = pedalLine.say.map((p) => p.split(' ')[0])
    const also = /^Also ([^.]*)\./.exec(pedalLine.does)[1].split(/, | and /)
    assert.deepEqual(also.filter((w) => shown.includes(w)), [], `the page shows “${pedalLine.say[0]}” and then “Also ${also.join(', ')}”`)
    assert.deepEqual([...shown.slice(0, 1), ...also].sort(), help.SIRI_PEDAL_WORDS.filter((w) => w !== 'Boost').sort(), 'a pedal Siri knows is missing from the page, or one it does not is on it')

    /* The tempo Siri takes is the units' own (and the Swift's, which test/siri-native holds to it). */
    const { UNIT_BPM } = await import('../shared/tempo.mjs')
    assert.deepEqual({ ...help.SIRI_TEMPO }, { ...UNIT_BPM }, 'the page’s tempo range is not shared/tempo.mjs UNIT_BPM')
    assert.ok(page.includes(`Anything from ${UNIT_BPM.min} to ${UNIT_BPM.max}`), 'the page does not say the tempo range')

    /* Scenes 1 to 8, the Swift's list, and every unit with fewer by name: four on an AM4 and on a VP4, as the demo's units have them. */
    assert.deepEqual(enumCases(code, 'SceneNumber').map((c) => c.raw), ['1', '2', '3', '4', '5', '6', '7', '8'])
    assert.match(page, /Any scene from 1 to 8, or 1 to 4 on an AM4 or VP4\./)
    const { UNITS } = await import('../src/lib/demoUnits.js')
    const fewer = UNITS.filter((u) => u.scenes < 8)
    assert.deepEqual(fewer.map((u) => [u.name, u.scenes]), [['AM4', 4], ['VP4', 4]], 'a unit with another number of scenes than the page says')
    const scenesSaid = help.siriPage({ os: 'ios', kind: 'phone', native: true, noun: 'phone' })[0].phrases[0].does
    for (const u of fewer) assert.ok(scenesSaid.includes(u.name), `the page offers scenes 5 to 8 on a ${u.name}, which has ${u.scenes}`)
    assert.ok(help.SIRI_LINKS.some((l) => l.url.includes('/scene/') && /any scene your unit has, 1 to 8/.test(l.does)), 'the scene link promises 1 to 8 on every unit')

    /* Each link is one the app answers, and between them they are all four; never Tuner on. */
    const asked = help.SIRI_LINKS.map((l) => rule.parseLink(l.url))
    for (const [i, a] of asked.entries()) assert.ok(a, `${help.SIRI_LINKS[i].url} is on the page and is not a link the app answers`)
    assert.deepEqual(asked.map((a) => a.command).sort(), ['next', 'previous', 'scene', 'tunerOff'])
    assert.equal(rule.parseLink('fractalremote://tuner/on'), null)
    for (const args of PAGES) {
      const words = help.siriWords({ ...args, noun: NOUN[args.kind] }).join('\n')
      assert.ok(!/tuner\/on/i.test(words), 'a page offers a link that would mute the rig')
      assert.match(words, /There’s no link for Tuner on/, `the ${args.os} ${args.kind} page does not say why there is no Tuner on link`)
    }
  })

  test('Siri page: the one rule, the speed, the locked phone, the watch, a loud room, the click, and what Siri won’t do', async () => {
    const { help, rule } = await wordsOnABench()
    const noun = 'iPad'
    const page = help.siriPage({ os: 'ios', kind: 'phone', native: true, noun })
    const words = help.siriWords({ os: 'ios', kind: 'phone', native: true, noun }).join('\n')
    assert.deepEqual(
      page.map((s) => s.title),
      ['What to say', 'Keep Play open', 'How fast', 'Good to know', 'Your own shortcuts', 'Action button', 'Back Tap', 'Links', 'Turning it off', 'What Siri won’t do, on purpose']
    )
    /* The rule, in the words lib/siri hands Siri off Play. */
    assert.ok(rule.SIRI_SAYS.openPlay(noun).startsWith(`Open Play on this ${noun}`))
    assert.match(words, new RegExp(`Anywhere else in the app, Siri says to open Play on this ${noun}\\.`))
    assert.match(words, /Tuner off is the exception: it works from any screen/)
    assert.match(words, /between songs, not on a downbeat/)
    assert.match(words, /within a second and a half isn’t sent at all/)
    assert.match(words, /It all works in the demo too\./)
    /* No promise of what Siri says back, which Apple makes none of for a command that opens the app. */
    assert.match(words, /Play shows what happened, as it does for a tap, and Siri may say it too\./)
    assert.ok(!/Siri (will )?(says?|tells you) “?(Scene|Tempo|Not sent)/.test(words), 'the page promises what Siri says back')
    /* Locked, as Apple says it for iOS 27, and for 26 and earlier by each version's name for Siri's row. */
    assert.match(words, /Siri asks you to unlock it first, because these commands open the app/)
    assert.match(words, /on iOS 27, look under Allow Access When Locked in Settings → Face ID & Passcode/)
    assert.match(words, /On iOS 26 and earlier, turn on Allow Siri When Locked in Settings → Siri \(or Apple Intelligence & Siri, or Siri & Search\)\./)
    assert.match(words, /the watch may answer instead, and these commands don’t run on the watch/)
    /* Siri's button on the iPhone: the side button, or the Home button on an iPhone with one (an iPhone SE's side button is power off). */
    assert.match(words, /hold its side button \(the Home button, on an iPhone with one\) to talk to Siri on the iPhone/)
    assert.match(words, /In a loud room Siri may not hear you over the rig/)
    assert.match(words, new RegExp(`While Siri listens, this ${noun}’s own metronome click may stop\\.`))
    assert.match(words, /on iOS 27, Settings → Siri → Language, and on iOS 26 and earlier, Language in Settings → Siri \(or Apple Intelligence & Siri, or Siri & Search\)\./)
    /* Shortcuts, the Action button and Back Tap, each by the steps Apple's guides give. */
    assert.match(words, /“Song four”[\s\S]*Say “Siri, song four”, with no app name/)
    assert.match(words, /under App Shortcuts → Fractal Remote/)
    assert.match(words, /Settings → Action Button, swipe to Shortcut, tap Choose a Shortcut/)
    assert.match(words, /\(iPhone 15 Pro and later\)/)
    assert.match(words, /Settings → Accessibility → Touch → Back Tap, choose Double Tap or Triple Tap/)
    assert.match(words, /Use Triple Tap for anything that changes your sound/)
    assert.match(words, /its Open URLs step/)
    /*
     * Turning it off, version by version as Apple's own pages say it: iOS 27's App Access, whose switches
     * Apple does not name; 18 and 26's Apps and the switch the Siri privacy page names in their words;
     * 16 and 17's Siri & Search; and all of Siri, by 27's Turn Off Siri and the older Talk to Siri.
     * Changed only after reading Apple's pages again.
     */
    assert.match(words, /on iOS 27: Settings → Siri → App Access → Fractal Remote, and turn its switches off\. Which switches it has depends on the version of Siri\./)
    assert.match(words, /On iOS 18 and 26: Settings → Siri \(or Apple Intelligence & Siri\) → Apps → Fractal Remote, then turn off Use with Siri Requests\./)
    assert.match(words, /On iOS 17 and earlier: Settings → Siri & Search, then Fractal Remote in the list of apps/)
    assert.match(words, /To turn Siri off altogether, on iOS 27: Settings → Siri, then Turn Off Siri at the bottom\./)
    assert.match(words, /On iOS 26 and earlier: in Settings → Siri \(or Apple Intelligence & Siri, or Siri & Search\), set Talk to Siri \(or Listen for\) to Off, then turn off Press Side Button for Siri \(or Press Home for Siri\)\./)
    const ipad = help.siriWords({ os: 'ios', kind: 'ipad', native: true, noun: 'iPad' }).join('\n')
    assert.match(ipad, /On iPadOS 26 and earlier: in Settings → Siri \(or Apple Intelligence & Siri, or Siri & Search\), set Talk to Siri \(or Listen for\) to Off, then turn off Press Top Button for Siri \(or Press Home for Siri\)\./)
    /*
     * And every path into Siri's settings says which version it is for: the row is Siri only on 27, and
     * a bare "Settings → Siri" sent an iOS 26 phone with Apple Intelligence, or an iOS 17 one, to a row it does not have.
     */
    for (const [kind, system] of [['phone', 'iOS'], ['ipad', 'iPadOS']]) {
      for (const native of [true, false]) {
        const sentences = help.siriWords({ os: 'ios', kind, native, noun: NOUN[kind] }).flatMap((w) => w.split(/(?<=\.)\s+/))
        for (const sentence of sentences.filter((x) => x.includes('Settings → Siri'))) {
          /* Each mention, read against the version said last before it. */
          for (const at of [...sentence.matchAll(/Settings → Siri(?! \(or| & Search)/g)].map((m) => m.index)) {
            const said = [...sentence.slice(0, at).matchAll(new RegExp(`${system} (\\d+)`, 'g'))].at(-1)?.[1]
            assert.equal(said, '27', `“${sentence}” gives version 27’s Siri row ${said ? `for ${system} ${said}` : 'without saying for which version'}`)
          }
          assert.ok(new RegExp(`${system} \\d+`).test(sentence), `“${sentence}” sends somebody to Siri’s settings without saying for which version`)
        }
      }
    }
    /* And what it won't do, each with its reason. */
    const wont = page.find((s) => s.title === 'What Siri won’t do, on purpose').lines
    for (const what of ['Tap tempo', 'Volume', 'Saving', 'Editing', 'Global settings and the unit’s own click', 'The looper']) {
      const line = wont.find((l) => l.startsWith(`${what}: `))
      assert.ok(line && line.length > what.length + 20, `“${what}” is not on the list of what Siri won’t do, with a reason`)
    }
  })

  test('Siri page: plain US words, the device by its own name, nothing official, no other name for the app', async () => {
    const { help } = await wordsOnABench()
    for (const args of PAGES) {
      const where = `the ${args.os} ${args.kind} page${args.native ? '' : ' without the phrases'}`
      /* With a noun no sentence could have typed: any "phone" left is one written in. */
      const typed = help.siriWords({ ...args, noun: PLACEHOLDER }).join('\n')
      assert.ok(!/this phone|this iPhone|this iPad|this tablet/i.test(typed), `${where} names the device in its own words, not deviceNoun’s`)
      const words = help.siriWords({ ...args, noun: NOUN[args.kind] }).join('\n')
      assert.ok(!/\b(official(ly)?|certified|approved|endorsed|sponsored|partner(ed)?|authori[sz]ed)\b/i.test(words), `${where} calls the app something it is not`)
      assert.ok(!/\bFractal\b(?! Remote)/.test(words), `${where} calls the app, or says, “Fractal” alone`)
      assert.ok(!/\bFM3\b|\bFM9\b|Axe-Fx/.test(words), `${where} names a unit Siri has no phrase for`)
      assert.ok(!/colou?r|favourite|grey|licence|behaviour|centre|recognise/i.test(words.replace(/\bcolor\b/g, '')), `${where} is not in US spelling`)
      assert.ok(!/\b(JavaScript|Swift|intent|native|module|relay|deadline|API)\b/i.test(words), `${where} has developer words in it`)
      if (args.kind === 'ipad' || args.kind === 'tablet') {
        assert.ok(!/\bphone\b|iPhone|Action button|Back Tap|Apple Watch/i.test(words), `${where} offers what only an iPhone has`)
      }
      if (args.os === 'android') {
        assert.ok(!/Siri|Apple|iPhone|iPad|Shortcuts app/.test(words), `${where} talks about Siri or Apple`)
      }
      /* The row's one line fits a 320-wide phone (Settings SetupRow, numberOfLines 1). */
      const row = help.siriRow(args)
      assert.ok(row.status.length <= 36, `“${row.status}” is longer than a Settings row’s one line`)
    }
    assert.deepEqual(help.siriRow({ os: 'ios', native: true }), { title: 'Siri', status: 'Scenes, songs and pedals by voice' })
    assert.equal(help.siriRow({ os: 'ios', native: false }).title, 'Siri')
    assert.equal(help.siriRow({ os: 'android' }).title, 'Links for Tasker')
  })

  test('Siri in the store notes, on the support page and in docs/later.md: what the build does, and no more', async () => {
    const { help } = await wordsOnABench()
    const store = read('docs/app-store.md')
    const at = store.indexOf("**For the next version's notes: Siri, and the links**")
    assert.ok(at > 0, 'the next version’s notes say nothing of Siri, and 2.3.1(a) wants every new feature described')
    const para = store.slice(at, store.indexOf('### Notes for App Review, 1.87.11', at))
    const block = /```\n([\s\S]*?)\n```/.exec(para)?.[1]
    assert.ok(block, 'the Siri paragraph has no block to paste into Notes for Review')
    /* Every App Shortcut by its first phrase, as the Swift has it, the scene and the pedal by what they stand for. */
    for (const s of shortcuts(code)) {
      const first = s.phrases[0].replaceAll('\\(.applicationName)', 'Fractal Remote').replaceAll('\\(\\.$scene)', '[1-8]').replaceAll('\\(\\.$pedal)', '[pedal]')
      assert.ok(block.includes(`"${first}"`), `the review notes never name "${first}" (${s.intent})`)
    }
    assert.match(block, /They work with the Play screen open; on any other screen the app says to open Play\. Tuner off works from any screen\./)
    assert.match(block, /start the demo as above, keep the Play screen open, and say "Scene 3 in Fractal Remote"/, 'the notes do not say how to try it without hardware')
    assert.match(block, /fractalremote:\/\/next, \/previous, \/scene\/1 to \/scene\/8 and \/tuner\/off/)
    assert.match(block, /The app receives only the command, never the audio\./)
    assert.ok(!/tuner\/on|official|approved|endorsed|\bFractal\b(?! Remote| Audio)/.test(block), 'the notes offer a Tuner on link, or call the app something it is not')
    /* One line in the box, and room left in its 4000 bytes for everything else the next version says. */
    assert.ok(!block.includes('\n'), 'the paragraph is broken across lines, which the Notes box shows as breaks')
    assert.ok(Buffer.byteLength(block) <= 1100, `the Siri paragraph is ${Buffer.byteLength(block)} bytes of the Notes box's 4000`)
    const flatPara = para.replace(/\s+/g, ' ')
    assert.match(flatPara, /What's New gets one line: "Siri: say "Scene 3 in Fractal Remote", "Next song in Fractal Remote" and more, with the Play screen open\. Settings → Siri lists every phrase/)
    assert.match(flatPara, /Google Play's release notes get one line on the links[^"]*"Links for Tasker and similar apps: fractalremote:\/\/next, previous, scene\/1 to 8 and tuner\/off\. Settings → Links for Tasker says how\."/)
    assert.match(flatPara, /\*\*The privacy label is unchanged, and so is Google's Data safety\.\*\* Siri does the listening and the recognizing/)
    assert.match(flatPara, /\*\*Before this version goes to Apple\*\*, try Siri on the TestFlight copy/)
    /* The two row names the store lines send people to are the app's own. */
    assert.equal(help.siriRow({ os: 'ios', native: true }).title, 'Siri')
    assert.equal(help.siriRow({ os: 'android' }).title, 'Links for Tasker')

    /* The support page: the same rule, the same links, and true before the store version is out as after. */
    const support = read('public/support.html')
    const siri = support.slice(support.indexOf('<h2 id="siri">'), support.indexOf('<h2>Inside the app</h2>'))
    assert.ok(siri.length > 400, 'the support page has no Siri section')
    const text = siri.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    assert.match(text, /Settings → Siri in the app lists every one/)
    assert.match(text, /They come with the App Store version after 1\.87\.11: if Settings has no Siri row yet/)
    assert.match(text, /Everything except Tuner off works only with Play on screen\. Tuner off works from any screen/)
    assert.match(text, /within a second and a half isn’t sent at all/)
    assert.match(text, /Siri asks you to unlock first/)
    assert.match(text, /They come with the Google Play version after 1\.87\.11, and Settings → Links for Tasker says how\. There is no link for Tuner on/)
    for (const url of ['fractalremote://next', 'fractalremote://previous', 'fractalremote://scene/1', 'fractalremote://scene/8', 'fractalremote://tuner/off']) assert.ok(text.includes(url), `the support page does not give ${url}`)
    for (const quoted of quotedPhrases(text)) {
      assert.ok(spokenForms(code).some((f) => f.match.some((r) => r.test(quoted))), `the support page offers “${quoted}”, which Siri does not know`)
    }
    assert.ok(!/this phone|tuner\/on|official|approved|endorsed/i.test(text))

    /* docs/later.md: what is built is said as built, and what is parked keeps its reason. */
    const later = read('docs/later.md')
    const item = later.slice(later.indexOf('## Siri, the Action button and Back Tap'), later.indexOf('## Blind and low-vision players'))
    assert.ok(!/Nothing built\./.test(item), 'docs/later.md still says nothing of Siri is built')
    assert.match(item.replace(/\s+/g, ' '), /\*\*Built, 23 October 2026, for the build pair after 1\.87\.52:\*\* nine built-in phrases/)
    for (const parked of ['**Songs by name**', '**Amp and pedal channels**', '**Siri on the Apple Watch.**', '**A button in Control Center or on the Lock Screen**', '**Android voice.**']) {
      assert.ok(item.includes(parked), `docs/later.md lost the parked ${parked}`)
    }
  })

  test('Siri page: drawn, it shows every word and nothing else, and Settings opens it only where the links are open', async () => {
    const { transformSync } = await import('esbuild')
    const dir = mkdtempSync(join(tmpdir(), 'siri-help-'))
    try {
      const files = {
        'package.json': '{ "type": "module" }',
        'react.mjs': 'export const h = (type, props, ...children) => ({ type, props: props || {}, children })\nexport const Frag = "frag"\n',
        'rn.mjs': "export const View = 'View'\nexport const Text = 'Text'\nexport const Platform = { OS: 'ios', select: (o) => o.ios }\n",
        'theme.mjs': 'const any = new Proxy({}, { get: () => 1 })\nexport const color = any\nexport const font = any\nexport const space = any\nexport const mono = { ios: "Menlo" }\n',
        'Note.mjs': "export default function Note({ children }) { return { type: 'Note', props: {}, children: [children] } }\n",
        'siri-help.js': read(`${LIB}/siri-help.js`)
      }
      let src = transformSync(read('mobile/src/components/SiriHelp.js'), { loader: 'jsx', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Frag', format: 'esm' }).code
      for (const [a, b] of [
        ['from "react-native"', "from './rn.mjs'"],
        ['from "../lib/theme"', "from './theme.mjs'"],
        ['from "../lib/siri-help"', "from './siri-help.js'"],
        ['from "./Note"', "from './Note.mjs'"]
      ])
        src = src.replaceAll(a, b)
      const left = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((m) => !m.startsWith('./'))
      assert.deepEqual(left, [], 'SiriHelp imports something the bench has no stand-in for')
      files['SiriHelp.mjs'] = "import { h, Frag } from './react.mjs'\n" + src
      for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
      const at = (f) => pathToFileURL(join(dir, f)).href
      const SiriHelp = (await import(at('SiriHelp.mjs'))).default
      const help = await import(at('siri-help.js'))
      /* Every string drawn, with the components inside called as React would. */
      const texts = (node, out = []) => {
        if (node == null || node === false) return out
        if (typeof node === 'string' || typeof node === 'number') return out.push(String(node)), out
        if (Array.isArray(node)) return node.forEach((n) => texts(n, out)), out
        if (typeof node.type === 'function') return texts(node.type({ ...node.props, children: node.children.length === 1 ? node.children[0] : node.children }), out)
        for (const c of node.children || []) texts(c, out)
        return out
      }
      for (const args of PAGES) {
        const noun = NOUN[args.kind]
        const drawn = texts(SiriHelp({ ...args, noun })).map((t) => t.replace(/^“(.*)”$/, '$1'))
        const words = help.siriWords({ ...args, noun })
        const row = help.siriRow(args)
        const expected = words.filter((w, i) => !(i < 2 && (w === row.title || w === row.status)))
        assert.deepEqual([...new Set(drawn)].sort(), [...new Set(expected)].sort(), `the ${args.os} ${args.kind} page draws other words than lib/siri-help’s`)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }

    /* Settings: the row under Help and the page, both behind the links' own gate, which no update can open (lib/siri-rule linksOpen). */
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /const siriOpen = useSiriLinksOpen\(\)/)
    assert.match(settings, /const siriNative = siriPresent\(\)/)
    assert.match(settings, /const SIRI_TITLE = siriRow\(\{ os: Platform\.OS \}\)\.title/)
    assert.match(settings, /const siriStatus = siriRow\(\{ os: Platform\.OS, native: siriNative \}\)\.status/)
    assert.match(settings, /\{siriOpen \? <SetupRow title=\{SIRI_TITLE\} status=\{siriStatus\} onPress=\{\(\) => setPage\('siri'\)\} \/> : null\}/)
    const help = settings.slice(settings.indexOf('<Group title="Help">'), settings.indexOf('<Group title="About">'))
    assert.ok(help.includes("setPage('siri')"), 'the Siri row is not under Help')
    assert.match(settings, /\{page === 'siri' && siriOpen \? \(\s*<>\s*\{head\(SIRI_TITLE, 'back'\)\}\s*<SiriHelp os=\{Platform\.OS\} kind=\{deviceKind\(\)\} native=\{siriNative\} noun=\{deviceNoun\(\)\} \/>/)
    /* Not behind the purchase: Apple's reviewer tries Siri in the demo. */
    assert.ok(!/mayDrive\(purchase\) && siriOpen|siriOpen && mayDrive/.test(settings), 'the Siri page waits for the full version, and the demo needs it')
  })
}
