/**
 * SETTINGS → NAM & TONE3000 (mobile/src/lib/namHelp.js,
 * components/NamHelp.js, and its row and page in screens/Settings.js).
 *
 * "Can we put something in the app that explains people how to use tone
 * 3000 and NAM? Some people might not know how to add a block for NAM. or
 * to access the tone 3000 section to add a NAM block" (Justin, 19 November
 * 2026).
 *
 * What these hold: the page says the steps in order for each unit; what it
 * names is really in the app under that name; it promises nothing the app
 * does not do (an AM4's NAM block is never added from the app, and a preview
 * is never said to be thrown away); and the row and the page are wired.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const lib = () => import('../mobile/src/lib/namHelp.js')

export function run(test) {
  test('NAM help: the steps in order for each unit, and the tab that opens is the linked unit’s', async () => {
    const h = await lib()
    assert.deepEqual(h.NAM_HELP_UNITS.map((u) => [u.key, u.label]), [['axefx3', 'Axe-Fx III'], ['am4', 'AM4']])
    assert.equal(h.namHelpTab('AM4'), 'am4')
    assert.equal(h.namHelpTab(' AM4 '), 'am4')
    for (const other of ['Axe-Fx III', 'FM3', 'FM9', 'VP4', '', null, undefined]) assert.equal(h.namHelpTab(other), 'axefx3', `${other} opens the wrong tab`)

    for (const unit of ['axefx3', 'am4']) {
      const page = h.namHelpPage(unit)
      assert.deepEqual(
        page.map((s) => s.title),
        ['1. Put a NAM block in your preset', '2. Open TONE3000', '3. Preview and Get', 'Captures already on the unit', 'If something is missing'],
        `${unit}: the steps are out of order`
      )
      const lines = page.flatMap((s) => s.lines)
      for (const s of page) assert.ok(s.lines.length > 0, `${unit}: “${s.title}” says nothing`)
      assert.equal(new Set(lines).size, lines.length, `${unit}: a line is said twice (they are the list’s keys)`)
      /* Short enough to read on a phone, and never the device in hand by a fixed word. */
      for (const line of lines) {
        assert.ok(line.length <= 260, `${unit}: a line runs to ${line.length} characters`)
        assert.doesNotMatch(line, /this phone/i)
        assert.doesNotMatch(line, /VP4/)
      }
    }
    /* An unknown unit is the Axe-Fx III's page, never an empty one. */
    assert.deepEqual(h.namHelpPage('fm3'), h.namHelpPage('axefx3'))
  })

  test('NAM help: each unit is told its own way to add the block, and its own name', async () => {
    const h = await lib()
    const said = (unit, i) => h.namHelpPage(unit)[i].lines.join(' ')

    /* An Axe-Fx III: the chain editor and Quick build, by the names on their buttons. */
    const more = read('mobile/src/lib/editMore.js')
    assert.match(more, /label: 'Edit chain'/, 'Edit’s More no longer calls it Edit chain')
    const { EMPTY_SPACE } = await import('../mobile/src/lib/chainAdd.js')
    assert.ok(said('axefx3', 0).includes('Edit chain'))
    assert.ok(said('axefx3', 0).includes(EMPTY_SPACE), 'the page names a button the chain editor does not have')
    assert.ok(said('axefx3', 0).includes('Quick build'))
    assert.match(read('shared/starter-chains.mjs'), /Quick build/, 'Quick build is no longer called that')

    /* An AM4: firmware 3.00, on the unit or in AM4-Edit, and never from the app. */
    assert.match(said('am4', 0), /firmware 3\.00/)
    assert.match(said('am4', 0), /AM4-Edit/)
    assert.match(said('am4', 0), /can’t put a NAM block in a slot/)
    for (const not of ['Edit chain', 'Quick build', EMPTY_SPACE]) assert.ok(!said('am4', 0).includes(not), `an AM4 is told to add its NAM block with ${not}, which cannot`)
    /* That is what an account the app cannot add the block for is told (AM4_NAM_ADD_FOR_EVERYONE shut). One it can add it for is told the app's own way, by the buttons' names, and never that the app can't. */
    const adds = h.namHelpPage('am4', { am4Adds: true })
    const told = adds[0].lines.join(' ')
    assert.match(told, /firmware 3\.00/)
    for (const has of ['Edit chain', 'Remove', EMPTY_SPACE, 'Quick build', 'AM4-Edit']) assert.ok(told.includes(has), `an AM4 the app adds NAM to is not told ${has}`)
    assert.ok(!/can’t put/.test(told))
    assert.ok(!told.includes('Axe-Fx III'))
    assert.match(adds[4].lines[0], /no NAM block yet/)
    assert.deepEqual(h.namHelpPage('axefx3', { am4Adds: true }), h.namHelpPage('axefx3'))
    /* And the page asks the same two gates the palette does, so the words and the list of blocks open together. */
    const drawn = read('mobile/src/components/NamHelp.js').replace(/\s+/g, ' ')
    assert.match(drawn, /const am4Adds = am4AddsHere\(\)/)
    assert.match(read('mobile/src/lib/namHelpHere.js'), /export const am4AddsHere = \(\) => am4NamOverBluetooth\(\) && am4NamAddHere\(\)/)
    assert.match(drawn, /namHelpPage\(unit, \{ am4Adds \}\)/)
    assert.match(read('mobile/src/lib/am4-chain.js'), /export const AM4_NAM_PLACE/)

    /* Quick build's result card goes straight to Edit's Rename, only where Edit offers Rename and something was built. */
    const qb = read('mobile/src/components/QuickBuild.js').replace(/\s+/g, ' ')
    assert.match(qb, /\{onRename && done\.landed\.tone !== 'fault' \? \( <Press label=\{NAME_PRESET\} sub=\{NAME_PRESET_SUB\} disabled=\{!!busy\} onPress=\{\(\) => \{ setOpen\(false\) onRename\(\) \}\} \/> \) : null\}/)
    assert.match(read('mobile/src/screens/Edit.js'), /onRename=\{renameHere \? \(\) => openTool\('rename'\) : null\}/)

    /* Each unit's page names that unit where a capture goes, and never the other. */
    for (const i of [2, 3]) {
      assert.ok(said('axefx3', i).includes('Axe-Fx III') && !said('axefx3', i).includes('AM4'))
      assert.ok(said('am4', i).includes('AM4') && !said('am4', i).includes('Axe-Fx III'))
    }
  })

  test('NAM help: the two ways in to TONE3000 are the app’s own, and a capture is never said to be thrown away', async () => {
    const h = await lib()
    const words = await import('../mobile/src/lib/tone3000Words.js')
    for (const unit of ['axefx3', 'am4']) {
      const open = h.namHelpPage(unit)[1].lines.join(' ')
      assert.ok(open.includes(words.T3K_QUICK), 'the button it names is not the one on the pop-up')
      assert.match(open, /hold the NAM pedal/)
      assert.match(open, /tap Capture, then TONE3000/)
      assert.ok(open.includes(`Settings → My rig → ${words.T3K_ROW_TITLE}`), 'the way to sign out is not where the row is')

      const all = h.namHelpPage(unit).flatMap((s) => s.lines).join(' ')
      assert.match(all, /stays there/, `${unit}: nothing says a capture stays in its slot`)
      assert.match(all, /Save the preset/)
      for (const lie of [/not kept/i, /isn’t kept/i, /without (keeping|saving)/i, /removed after/i, /temporar/i, /nothing is (stored|kept)/i, /\bfree\b/i]) {
        assert.doesNotMatch(all, lie, `${unit}: the page says ${lie}`)
      }
    }
    /* The Capture button it names is the picker's own word. */
    assert.match(read('mobile/src/components/CapturePicker.js'), /Capture/)
    /* And the sign-out row is under My rig. */
    const settings = read('mobile/src/screens/Settings.js')
    const rig = settings.slice(settings.indexOf('<Group title="My rig"'), settings.indexOf('<Group title="Help"'))
    assert.match(rig, /title=\{T3K_ROW_TITLE\}/)
  })

  test('NAM help: its own button on the front of Settings, under Amp & pedal names, for everybody, and its page goes back to Settings', async () => {
    const settings = read('mobile/src/screens/Settings.js')
    /* "Move the NAM and tone 3000 help section to the main settings screen" (19 November 2026): a card of its own, in no section. */
    const row = "<GlassCard clip bare> <SetupRow title={NAM_HELP_TITLE} status={NAM_HELP_LINE} onPress={() => setPage('nam-help')} /> </GlassCard>"
    const flatSet = settings.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\s+/g, ' ')
    assert.equal(flatSet.split(row).length - 1, 1, 'the button is not drawn once, in a card of its own')
    const gear = flatSet.indexOf('<SetupRow title="Amp & pedal names"')
    const rig = flatSet.indexOf('<Group title="My rig"')
    assert.ok(gear > 0 && flatSet.indexOf(row) > gear && flatSet.indexOf(row) < rig, 'the button is not between Amp & pedal names and My rig')
    const help = flatSet.slice(flatSet.indexOf('<Group title="Help"'), flatSet.indexOf('<Group title="About"'))
    assert.ok(!help.includes('NAM_HELP_TITLE'), 'the row is still inside Help')
    assert.match(settings, /\{page === 'nam-help' \? \(\s*<>\s*\{head\(NAM_HELP_TITLE, 'back'\)\}\s*<NamHelp deviceName=\{deviceName\} \/>/)
    assert.doesNotMatch(settings, /'nam-help':/, 'the page has a parent: it comes off the front of Settings')

    /* The component draws the lib's words and asks nothing of a unit. */
    const comp = read('mobile/src/components/NamHelp.js')
    for (const drawn of ['NAM_HELP_INTRO', 'namHelpPage(unit, { am4Adds }).map', '<Tabs items={NAM_HELP_UNITS} picked={unit} onPick={setUnit}', 'useState(() => namHelpTab(deviceName))']) {
      assert.ok(comp.includes(drawn), `the page does not draw ${drawn}`)
    }
    for (const reach of ['lib/device', 'lib/rig', 'lib/bluetooth', 'lib/tone3000']) assert.ok(!comp.includes(reach), `a help page reaches ${reach}`)
    const lib = read('mobile/src/lib/namHelp.js')
    assert.deepEqual([...lib.matchAll(/^import .* from '(.+)'$/gm)].map((m) => m[1]), ['./captureUnit.js'], 'the words import more than the units’ names')

    const h = await import('../mobile/src/lib/namHelp.js')
    assert.equal(h.NAM_HELP_TITLE, 'NAM & TONE3000')
    assert.ok(h.NAM_HELP_LINE.length <= 48, 'the row’s line wraps')
  })
}
