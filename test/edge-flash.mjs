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
    assert.match(click, /const choice = useEdgeFlash\(\) const sound = deviceSounds\(\{ clicks: clicks\(s, can, heardOn\)\.phone, offered: choice\.offered, quiet: choice\.quiet \}\) const \{ flash, silent \} = edgeBeat\(\{ offered: choice\.offered, edge: choice\.on, metronomeOn: s\.on, deviceClicks: sound \}\) const on = sound \|\| silent/)
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
    assert.match(settings, /edgeChoice\.on && unitCan\.can && clickSetting\.where !== 'phone' \? ` \$\{EDGE_WORDS\.apart\}\.` : ''/, 'it is not said that the light and the unit’s click can be apart, where the unit clicks')
    /* The words. */
    const said = [r.EDGE_WORDS.section, r.EDGE_WORDS.on, r.EDGE_WORDS.off, r.EDGE_WORDS.note('iPad'), r.EDGE_WORDS.apart].join(' ')
    assert.match(r.EDGE_WORDS.note('iPad'), /this iPad lights and stays silent/)
    assert.match(r.EDGE_WORDS.apart, /tempo, not its exact beat$/)
    /* And nothing says a press of Tap lines them up: Tap sends the unit a number, and its beat stays where it was. */
    assert.doesNotMatch(said, /start them together|Press Tap/i)
    assert.doesNotMatch(said, /this phone|your phone|\bbeta\b|\btried\b|official/i)
    assert.doesNotMatch(read('mobile/src/lib/edgeFlash.js').replace(/\/\*[\s\S]*?\*\//g, ''), /this phone/i)
    /* Nothing of it is the browser's or the computer's: shared/ is inside the computer app, and this is no computer release. */
    assert.doesNotMatch(read('shared/metronome.mjs'), /edgeBeat|EDGE_|edgeChoice/)
  })

  test('no sound: kept on the device, a sound until Off is picked, and the device is silent only for an account offered the choice', async () => {
    const r = await rules()
    /* There has always been a sound: anything but the word for Off is a sound. */
    assert.equal(r.quietKept(null), false)
    assert.equal(r.quietKept('on'), false)
    assert.equal(r.quietKept('nonsense'), false)
    assert.equal(r.quietKept('off'), true)
    assert.equal(r.quietKept(r.quietToKeep(true)), true)
    assert.equal(r.quietKept(r.quietToKeep(false)), false)
    assert.match(r.QUIET_KEY, /^fractal\./)
    assert.notEqual(r.QUIET_KEY, r.EDGE_KEY, 'the sound and the flash are kept under one key')
    /* The device sounds where the shared rule says it clicks, unless it is quiet AND the choice is this account's. */
    assert.equal(r.deviceSounds({ clicks: true, offered: true, quiet: false }), true)
    assert.equal(r.deviceSounds({ clicks: true, offered: true, quiet: true }), false)
    assert.equal(r.deviceSounds({ clicks: true, offered: false, quiet: true }), true, 'a device handed to another account makes no sound, with no way to give it one')
    assert.equal(r.deviceSounds({ clicks: false, offered: true, quiet: false }), false)
    assert.equal(r.deviceSounds({ clicks: false, offered: false, quiet: true }), false)
    assert.equal(r.deviceSounds(), false)
    /* And quiet, the silent beat is the light alone, through the rule that was there already. */
    const sound = r.deviceSounds({ clicks: true, offered: true, quiet: true })
    assert.deepEqual(r.edgeBeat({ offered: true, edge: true, metronomeOn: true, deviceClicks: sound }), { flash: true, silent: true })
    assert.deepEqual(r.edgeBeat({ offered: true, edge: false, metronomeOn: true, deviceClicks: sound }), { flash: false, silent: false }, 'a beat is kept with no sound and no light')
  })

  test('no sound: the row is Off and then the shared rule’s places, one of them lit, and a pick says what it changes', async () => {
    const r = await rules()
    const m = await import('../shared/metronome.mjs')
    /* Off is no place of the shared rule: nothing of this is inside the computer app. */
    assert.ok(!m.PLACES.some((p) => p.key === r.SOUND_OFF), 'Off is one of the shared rule’s places')
    assert.equal(m.metronomeSetting({ on: true, where: r.SOUND_OFF }).where, 'unit', 'the shared rule keeps a place called Off')
    assert.doesNotMatch(read('shared/metronome.mjs'), /QUIET_|SOUND_|soundPicked|deviceSounds|soundLine/)
    /* Where the unit’s click can be switched: Off, Unit, the device, Both. Where it cannot: Off and the device. */
    assert.deepEqual(r.soundChoices(m.placesFor(true)).map((c) => c.key), ['none', 'unit', 'phone', 'both'])
    assert.deepEqual(r.soundChoices(m.placesFor(false)).map((c) => c.key), ['none', 'phone'])
    assert.equal(r.soundChoices(m.placesFor(true))[0].label, 'Off')
    assert.deepEqual(r.soundChoices(m.placesFor(true)).slice(1).map((c) => c.label), m.placesFor(true).map((p) => p.label), 'a place is drawn under another word than the shared rule’s')
    assert.deepEqual(r.soundChoices(), [{ key: 'none', label: 'Off' }])
    /* One lit: Off while it is quiet, whatever place is kept under it; or else the place the shared rule lights. */
    for (const can of [true, false]) {
      for (const where of ['unit', 'phone', 'both']) {
        const places = m.placesFor(can)
        const lit = (key) => m.placeLit({ on: true, where }, key, can)
        assert.equal(r.soundLit({ quiet: true, places, lit }), 'none')
        assert.equal(r.soundLit({ quiet: false, places, lit }), can ? where : 'phone', `${where}, the unit ${can ? 'can' : 'cannot'}: the wrong one is lit`)
      }
    }
    assert.equal(r.soundLit(), null)
    /* Off: quiet, the place put on the device (which is what tells the unit to stop), and the light on. Everywhere: it replaces a saved Unit also where the unit cannot click, so Off is never kept over a place the unit clicks at. */
    assert.deepEqual(r.soundPicked('none', { can: true }), { quiet: true, where: 'phone', edge: true })
    assert.deepEqual(r.soundPicked('none', { can: false }), { quiet: true, where: 'phone', edge: true }, 'Off where the unit cannot click leaves a saved Unit to click once it can')
    assert.equal(m.clicks({ on: true, where: r.soundPicked('none').where }, true, true).unit, false, 'the place Off leaves behind still has the unit clicking')
    /* A place: no longer quiet, and written only where the unit’s click can be switched. */
    for (const key of ['unit', 'phone', 'both']) {
      assert.deepEqual(r.soundPicked(key, { can: true }), { quiet: false, where: key })
      assert.deepEqual(r.soundPicked(key, { can: false }), { quiet: false }, 'a pick where the unit cannot click wipes the saved place')
    }
  })

  test('no sound: the line under the row says what the metronome does now, and promises nothing about the unit’s beat', async () => {
    const r = await rules()
    const m = await import('../shared/metronome.mjs')
    const note = (key) => m.PLACES.find((p) => p.key === key).note
    const line = (o) => r.soundLine({ noun: 'iPad', unit: true, note: note(o.where || 'unit'), ...o })
    /* Quiet: the light alone, or nothing at all, said as it is. */
    assert.equal(line({ quiet: true, edge: true, where: 'phone' }), 'No sound. The edge of the screen lights on every beat')
    assert.equal(line({ quiet: true, edge: false, where: 'phone' }), 'No sound and no flash, so nothing keeps time. Pick a sound, or switch the flash on')
    /*
     * Quiet where the unit's own click is out of the app's hands (over
     * Bluetooth, on an AM4): Off silences the device and nothing else, so a
     * unit clicking by its own switch still is. It is the device that is
     * called silent, and what to do about the unit is said.
     */
    const own = 'The app can’t switch the unit’s own click from here: if the unit is clicking, switch its Metronome off on the unit'
    assert.equal(line({ quiet: true, edge: true, where: 'phone', unit: false }), `No sound from this iPad. The edge of the screen lights on every beat. ${own}`)
    assert.equal(line({ quiet: true, edge: false, where: 'phone', unit: false }), `No sound from this iPad and no flash, so it keeps no time. Pick a sound, or switch the flash on. ${own}`)
    /* Never in the demo, whose unit makes no sound at all. */
    assert.equal(line({ quiet: true, edge: true, where: 'phone', unit: false, demo: true }), 'No sound. The edge of the screen lights on every beat')
    assert.equal(line({ quiet: true, edge: false, where: 'phone', unit: false, demo: true }), 'No sound and no flash, so nothing keeps time. Pick a sound, or switch the flash on')
    /* The device clicking with the flash switched off: the shared note says "with a flash", which is not so. */
    assert.match(note('phone'), /with a flash$/, 'the shared note changed: the line below was written against it')
    assert.equal(line({ where: 'phone', edge: true }), note('phone'))
    assert.equal(line({ where: 'phone', edge: false }), 'Clicks out loud on this iPad, with no flash')
    /* Wherever the unit clicks with the edge lit, alone or with the device: two clocks, and said so. */
    assert.equal(line({ where: 'unit', edge: true }), `${note('unit')}. The light keeps the unit’s tempo, not its exact beat`)
    assert.equal(line({ where: 'both', edge: true }), `${note('both')}. The light keeps the unit’s tempo, not its exact beat`, 'under Both the unit clicks on its own clock too, and the line reads as if they were one')
    assert.equal(line({ where: 'unit', edge: false }), note('unit'))
    assert.equal(line({ where: 'both', edge: false }), note('both'))
    assert.equal(line({ where: 'unit', edge: true, unit: false }), note('unit'), 'the light is called apart from a click the unit is not making')
    assert.equal(line({ where: 'both', edge: true, unit: false }), note('both'))
    /* Settings' line under each place: the shared note, but under the device with the flash switched off, for an account offered the flash as a choice. */
    const phone = m.PLACES.find((p) => p.key === 'phone')
    assert.equal(r.placeNote(phone, { offered: true, edge: false, noun: 'iPad' }), 'Clicks out loud on this iPad, with no flash')
    assert.equal(r.placeNote(phone, { offered: true, edge: true, noun: 'iPad' }), note('phone'))
    assert.equal(r.placeNote(phone, { offered: false, edge: false, noun: 'iPad' }), note('phone'), 'another account’s Settings changed: its edge always flashes with the device’s click')
    for (const key of ['unit', 'both']) for (const edge of [true, false]) assert.equal(r.placeNote(m.PLACES.find((p) => p.key === key), { offered: true, edge, noun: 'iPad' }), note(key))
    assert.equal(r.placeNote(null), '')
    /* The words. */
    const said = [
      ...Object.values(r.SOUND_WORDS).map((w) => (typeof w === 'function' ? w('iPad') : w)),
      line({ quiet: true, edge: true }),
      line({ quiet: true, edge: false }),
      line({ quiet: true, edge: true, unit: false }),
      line({ quiet: true, edge: false, unit: false }),
      line({ where: 'phone', edge: false }),
      line({ where: 'unit', edge: true })
    ].join(' ')
    assert.doesNotMatch(said, /this phone|your phone|\bbeta\b|\btried\b|\btested\b|official|\bsoon\b|coming|together|in time with|in sync|lined up/i)
    assert.equal(r.SOUND_WORDS.said('Unit'), 'Sound: Unit')
    assert.match(r.SOUND_WORDS.noTempo('tablet'), /the tablet has nothing to flash to$/)
  })

  test('no sound: the row and the flash are in the volume pop-up and on Settings → Metronome, for an account offered them, through one picker', () => {
    const sw = flat(read('mobile/src/components/MetronomeSwitch.js'))
    /* Only for an account offered them, never in the tempo box, and only where the pop-up has the room. */
    assert.match(sw, /const choice = useEdgeFlash\(\)/)
    assert.match(sw, /const choices = !compact && choice\.offered && tall >= ROOM_FOR_CHOICES/)
    assert.match(sw, /\{choices \? \( <> <Text accessibilityRole="header"[^>]*> \{SOUND_WORDS\.section\.toUpperCase\(\)\} <\/Text>/, 'the row is drawn for an account it is not offered to, or has no heading')
    /* One row of the app’s own buttons: words, the picked one lit and said selected, each fitted at one size. */
    assert.match(
      sw,
      /<View accessibilityRole="radiogroup" accessibilityLabel=\{SOUND_WORDS\.section\} style=\{\{ flexDirection: 'row', gap: space\.sm \}\}> \{sounds\.map\(\(c\) => \( <Press key=\{c\.key\} label=\{c\.label\} tone="live" on=\{c\.key === lit\} grow fit fitWith=\{sounds\.filter\(\(o\) => o\.key !== c\.key\)\.map\(\(o\) => o\.label\)\} height=\{TAP\} accessibilityLabel=\{SOUND_WORDS\.said\(c\.label\)\} onPress=\{\(\) => pickSound\(c\.key\)\} \/> \)\)\} <\/View>/
    )
    assert.match(sw, /const sounds = soundChoices\(places\)/)
    assert.match(sw, /const places = placesFor\(unitCan\.can\)/)
    assert.match(sw, /const lit = soundLit\(\{ quiet: choice\.quiet, places, lit: \(key\) => placeLit\(setting, key, unitCan\.can\) \}\)/)
    /* The flash’s own switch under it, the one Settings draws. */
    assert.match(sw, /<Press label=\{choice\.on \? EDGE_WORDS\.on : EDGE_WORDS\.off\} tone="live" on=\{choice\.on\} height=\{TAP\} onPress=\{\(\) => setEdgeFlash\(!choice\.on\)\} \/> <\/> \) : null\}/)
    /* A pick goes through the one picker, with the same "here" the switch writes the unit with. */
    assert.match(sw, /const answer = await setMetronomeSound\(key, slug, clickHere\)/)
    assert.equal(sw.match(/setMetronomeSound\(/g).length, 1)
    /* The line under them is the rule’s, for an account offered the choice; every other account reads what it always read. */
    assert.match(sw, /const where = choice\.offered \? choice\.quiet \|\| unitCan\.can \? soundLine\(\{ quiet: choice\.quiet, edge: choice\.on, where: place\?\.key, note: place\?\.note \|\| '', unit: unitCan\.can, demo, noun: deviceNoun\(\) \}\) : unitCan\.why : unitCan\.can \? place\?\.note \|\| '' : unitCan\.why/)
    /* Never "nothing to click to" with the sound picked Off. */
    assert.match(sw, /const sounding = deviceSounds\(\{ clicks: clicks\(setting, unitCan\.can, heard\)\.phone, offered: choice\.offered, quiet: choice\.quiet \}\)/)

    const settings = flat(read('mobile/src/screens/Settings.js'))
    /* Settings: No sound first, only where it is offered; the places not lit under it; every press through the same picker. */
    assert.match(
      settings,
      /<Section>Where it clicks<\/Section> \{ \} \{edgeChoice\.offered \? \( <View style=\{\{ gap: space\.xs \}\}> <Press label=\{SOUND_WORDS\.noSound\} tone="live" on=\{edgeChoice\.quiet\} onPress=\{\(\) => changeSound\(SOUND_OFF\)\} \/>/,
      'No sound is drawn for an account it is not offered to, or is not first'
    )
    /* The line under it is the pop-up's own for the state: what picking it gives (the light, which the pick switches on), or, lit with the flash switched off since, that nothing keeps time. Never "lights on every beat" under a flash that is off. */
    assert.match(settings, /\{soundLine\(\{ quiet: true, edge: edgeChoice\.quiet \? edgeChoice\.on : true, unit: unitCan\.can, demo, noun: deviceNoun\(\) \}\)\}/, 'the line under No sound is not the rule’s for the state the device is in')
    /* And under each place, the rule's: not "with a flash" with the flash switched off. */
    assert.match(settings, /\{placeNote\(p, \{ offered: edgeChoice\.offered, edge: edgeChoice\.on, noun: deviceNoun\(\) \}\)\}/)
    assert.doesNotMatch(settings, /\{p\.note\}/)
    assert.match(settings, /const said = await setMetronomeSound\(key, rigSlug, clickHere\)/)
    assert.match(settings, /on=\{!edgeChoice\.quiet && placeLit\(clickSetting, p\.key, unitCan\.can\)\}/, 'a place is lit under No sound')
    /* Flash timing moves the flash to meet the click: not offered with no click to meet. */
    assert.match(settings, /const phoneMayClick = deviceSounds\(\{ clicks: clicks\(\{ \.\.\.clickSetting, on: true \}, unitCan\.can, clickHeard\)\.phone, offered: edgeChoice\.offered, quiet: edgeChoice\.quiet \}\)/)

    const metronome = flat(read('mobile/src/lib/metronome.js'))
    /* Quiet is false for an account not offered the choice, wherever it is read. */
    assert.match(metronome, /return \{ offered, on, quiet: offered && silenced \}/)
    /* The picker: quiet first, then the light, then the place through the setting’s own road to the unit (past setMetronome, which lets go of Off for any place picked). */
    assert.match(
      metronome,
      /export async function setMetronomeSound\(key, slug, here = \{\}\) \{ const picked = soundPicked\(key, \{ can: unitClick\(slug, here\)\.can \}\) setQuiet\(picked\.quiet\) if \(picked\.edge\) setEdgeFlash\(true\) if \(!picked\.where\) return \{ ok: true \} return change\(\{ where: picked\.where \}, slug, here\) \}/
    )
    assert.match(metronome, /export async function setMetronome\(patch, slug, here = \{\}\) \{ if \(patch && 'where' in patch\) setQuiet\(false\) return change\(patch, slug, here\) \}/, 'a place picked through the setting’s own door does not let go of Off')
    /* The tempo box keeps to its switch and its one block of words. */
    assert.doesNotMatch(flat(read('mobile/src/components/TempoBox.js')), /setMetronomeSound|soundChoices|SOUND_WORDS/)
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
