/**
 * THE METRONOME'S FLASH ROUND THE EDGE OF THE SCREEN, AS A CHOICE
 * (mobile/src/lib/edgeFlash.js, lib/metronome.js, components/
 * MetronomeBeat.js, screens/Settings.js), AND THE WATCH'S
 * (docs/pending/watch-page-order.patch).
 *
 * "Can we set it where it can run the metronome on the device and the phone
 * at the same time or either one? And then on the phone have an option for
 * the screen to flash somewhere like the outside edge of the screen ... I
 * also wanna make it so the watch can do a light up type function as well
 * on the metronome ... have the watch outside edge flash with the same as
 * the tempo." (Justin, 12 November 2026.)
 *
 * Unit, the device or both was there already (shared/metronome.mjs), and so
 * was the flash, tied to the device's own click. What is new on the phone is
 * the choice: off, or on without the device's click. His account until
 * features METRONOME_FLASH_CHOICE_FOR_EVERYONE; for every other account the
 * metronome is what it always was. The watch's light is native, and waits in
 * the watch's patch for a build.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

/** The rule file imports nothing, and is run from a copy. */
async function rules() {
  const dir = mkdtempSync(join(tmpdir(), 'edge-flash-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    const src = read('mobile/src/lib/edgeFlash.js')
    assert.doesNotMatch(src, /^import /m, 'lib/edgeFlash.js imports something; this check runs it on its own')
    writeFileSync(join(dir, 'rule.js'), src)
    return await import(pathToFileURL(join(dir, 'rule.js')).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  test('edge flash: the choice is his account only until its switch, and the switch is off', async () => {
    const r = await rules()
    assert.equal(r.edgeChoiceOn({ admin: true, everyone: false }), true)
    assert.equal(r.edgeChoiceOn({ admin: false, everyone: false }), false)
    assert.equal(r.edgeChoiceOn({ admin: false, everyone: true }), true)
    assert.equal(r.edgeChoiceOn(), false)
    assert.equal(r.edgeChoiceOn({ admin: 'yes' }), false, 'only a plain yes opens it')
    assert.match(read('mobile/src/lib/features.js'), /^export const METRONOME_FLASH_CHOICE_FOR_EVERYONE = false$/m, 'the choice is open to every account before he has said so')
    const metronome = flat(read('mobile/src/lib/metronome.js'))
    assert.match(metronome, /const offered = edgeChoiceOn\(\{ admin: useBluetoothAdmin\(\), everyone: METRONOME_FLASH_CHOICE_FOR_EVERYONE \}\)/)
    /* It has always flashed: on until somebody switches it off, and anything unreadable is on. */
    assert.equal(r.edgeKept(null), true)
    assert.equal(r.edgeKept('on'), true)
    assert.equal(r.edgeKept('nonsense'), true)
    assert.equal(r.edgeKept('off'), false)
    assert.equal(r.edgeKept(r.edgeToKeep(false)), false)
    assert.equal(r.edgeKept(r.edgeToKeep(true)), true)
    assert.match(r.EDGE_KEY, /^fractal\./)
  })

  test('edge flash: for an account not offered the choice the metronome is what it always was, whatever the device has kept', async () => {
    const r = await rules()
    for (const edge of [true, false]) {
      for (const metronomeOn of [true, false]) {
        assert.deepEqual(r.edgeBeat({ offered: false, edge, metronomeOn, deviceClicks: true }), { flash: true, silent: false }, 'the edge flashes with the device’s own click')
        assert.deepEqual(r.edgeBeat({ offered: false, edge, metronomeOn, deviceClicks: false }), { flash: false, silent: false }, 'and never without it')
      }
    }
    assert.deepEqual(r.edgeBeat(), { flash: false, silent: false })
  })

  test('edge flash: offered, it can be switched off, and it can light in silence while the unit clicks alone', async () => {
    const r = await rules()
    /* On, with the device clicking: the light, the sound and the tap, as ever. */
    assert.deepEqual(r.edgeBeat({ offered: true, edge: true, metronomeOn: true, deviceClicks: true }), { flash: true, silent: false })
    /* On, with the click on the unit alone: the light and nothing else. */
    assert.deepEqual(r.edgeBeat({ offered: true, edge: true, metronomeOn: true, deviceClicks: false }), { flash: true, silent: true })
    /* Off: no light, and never a silent beat kept for nothing. */
    assert.deepEqual(r.edgeBeat({ offered: true, edge: false, metronomeOn: true, deviceClicks: true }), { flash: false, silent: false })
    assert.deepEqual(r.edgeBeat({ offered: true, edge: false, metronomeOn: true, deviceClicks: false }), { flash: false, silent: false })
    /* The metronome off is everything off. */
    for (const edge of [true, false]) assert.deepEqual(r.edgeBeat({ offered: true, edge, metronomeOn: false, deviceClicks: false }), { flash: false, silent: false })
  })

  test('edge flash: in silence the device makes no sound and no tap and opens no audio, and with the flash off the click and the tap carry on', () => {
    const metronome = flat(read('mobile/src/lib/metronome.js'))
    const click = metronome.slice(metronome.indexOf('export function usePhoneClick('))
    assert.match(click, /const sound = clicks\(s, can, heardOn\)\.phone const choice = useEdgeFlash\(\) const \{ flash, silent \} = edgeBeat\(\{ offered: choice\.offered, edge: choice\.on, metronomeOn: s\.on, deviceClicks: sound \}\) const on = sound \|\| silent/)
    /* The sound only where the device clicks. */
    assert.match(click, /const sounding = sound \? click\(\) : null/)
    assert.equal(click.match(/\bclick\(\)/g)?.length, 1, 'something else plays the click')
    /* The tap only with the sound; the light only where it is to flash; and nothing waited for where there is no sound. */
    assert.match(click, /if \(sound\) tick\(\) if \(flash\) onBeat\?\.\(\) for \(const fn of beatWatchers\) fn\(\)/)
    assert.match(click, /sound \? flashLead\(Platform\.OS, nudge\) : 0/)
    /* No audio is opened, or let go, for a beat kept in silence. */
    assert.match(click, /\(sound \? prepareClick\(\) : Promise\.resolve\(\)\)\.finally\(/)
    assert.match(click, /if \(sound\) releaseLater\(\)/)
    assert.equal(metronome.match(/prepareClick\(\)/g)?.length, 2, 'the sound is made ready somewhere a silent beat could reach')
    /* The frame lights on what it is handed, and is handed nothing it should not light on. */
    const beat = flat(read('mobile/src/components/MetronomeBeat.js'))
    assert.match(beat, /const clicking = usePhoneClick\(bpm, onBeat\)/)
    assert.match(beat, /\{clicking \? <StayAwake \/> : null\}/, 'a screen that is keeping time in silence may sleep')
  })

  test('edge flash: the switch is on Settings → Metronome, only for an account it is offered to, and says what it cannot do', async () => {
    const r = await rules()
    const settings = flat(read('mobile/src/screens/Settings.js'))
    assert.match(settings, /const edgeChoice = useEdgeFlash\(\)/)
    assert.match(
      settings,
      /\{edgeChoice\.offered \? \( <> <Section>\{EDGE_WORDS\.section\}<\/Section> <Press label=\{edgeChoice\.on \? EDGE_WORDS\.on : EDGE_WORDS\.off\} tone="live" on=\{edgeChoice\.on\} onPress=\{\(\) => setEdgeFlash\(!edgeChoice\.on\)\} \/>/,
      'the switch is drawn for an account it is not offered to, or is not the one switch'
    )
    assert.match(settings, /EDGE_WORDS\.note\(deviceNoun\(\)\)/, 'the device in hand is named when the words are shown')
    assert.match(settings, /edgeChoice\.on && unitCan\.can && clickSetting\.where !== 'phone' \? ` \$\{EDGE_WORDS\.apart\}` : ''/, 'it is not said that the light and the unit’s click can be apart, where the unit clicks')
    /* The words. */
    const said = [r.EDGE_WORDS.section, r.EDGE_WORDS.on, r.EDGE_WORDS.off, r.EDGE_WORDS.note('iPad'), r.EDGE_WORDS.apart].join(' ')
    assert.match(r.EDGE_WORDS.note('iPad'), /this iPad lights and stays silent/)
    assert.match(r.EDGE_WORDS.apart, /tempo, not its exact beat/)
    assert.doesNotMatch(said, /this phone|your phone|\bbeta\b|\btried\b|official/i)
    assert.doesNotMatch(read('mobile/src/lib/edgeFlash.js').replace(/\/\*[\s\S]*?\*\//g, ''), /this phone/i)
    /* Nothing of it is the browser's or the computer's: shared/ is inside the computer app, and this is no computer release. */
    assert.doesNotMatch(read('shared/metronome.mjs'), /edgeBeat|EDGE_|edgeChoice/)
  })

  test('edge flash: the watch lights its edge on the beat its metronome taps, over every page and under no thumb (waiting in the watch’s patch)', () => {
    const patch = read('docs/pending/watch-page-order.patch')
    const added = patch
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.slice(1))
      .join('\n')
    const swift = added.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ')
    /* The same beat as the tap: the metronome hands it over, and there is no second clock. */
    assert.match(swift, /var onBeat: \(\(\) -> Void\)\?/)
    assert.match(swift, /onBeat\?\(\)/)
    assert.match(swift, /wrist\.onBeat = \{ lightTheEdge\(\) \}/)
    /* Lit at once, let go a moment later. */
    assert.match(swift, /private func lightTheEdge\(\) \{ beatLit = true if Launch\.flag\("beatDemo"\) \{ return \} Task \{ @MainActor in try\? await Task\.sleep\(nanoseconds: UInt64\(EdgeBeatLook\.heldMs\) \* 1_000_000\) withAnimation\(\.easeOut\(duration: EdgeBeatLook\.fade\)\) \{ beatLit = false \} \} \}/)
    /* Over every page, taking no touch, and nothing for VoiceOver to read. */
    assert.match(swift, /\.overlay \{ EdgeBeat\(lit: beatLit\) \}/)
    assert.match(swift, /struct EdgeBeat: View \{[^]*?\.strokeBorder\(Color\.green, lineWidth: EdgeBeatLook\.line\)[^]*?\.ignoresSafeArea\(\) \.allowsHitTesting\(false\) \.accessibilityHidden\(true\)/)
    /* The corners follow the screen's, by a rule the watch's own tests run. */
    assert.match(swift, /func watchEdgeRadius\(width: Double\) -> Double \{/)
    assert.match(swift, /func testTheBeatsLightFollowsTheScreensCorners\(\)/)
    /* And CI takes a picture of it lit. */
    assert.match(added, /shoot -page 4 -beatDemo YES\nxcrun simctl io "\$UDID" screenshot "screens\/tempo-beat\.png"/)
  })
}
