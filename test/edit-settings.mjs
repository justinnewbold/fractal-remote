/**
 * A BLOCK'S LIST SETTINGS IN EDIT, UNDER ITS KNOBS (mobile/src/lib/
 * editSettings.js, components/BlockSettings.js, screens/Edit.js).
 *
 * "Yes, I like B for the edit screen" and "Menu style B" (Justin, 13 November
 * 2026, of three ways shown on a NAM block): two or three choices are
 * buttons, more is a row that opens a list. His account first.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

const lib = () => import('../mobile/src/lib/editSettings.js')
const pagesOf = async (read_) => {
  const { editPages } = await import('../mobile/src/lib/editPages.js')
  const { isSilencingParam } = await import('../mobile/src/lib/guardrails.js')
  return editPages(read_.named.filter((p) => !isSilencingParam(p.name)), read_.layout || null)
}

export function run(test) {
  test('edit settings: two or three choices are buttons and more is a list, in the unit’s own words, and what cannot be drawn is left out', async () => {
    const s = await lib()
    assert.equal(s.SHORT_MOST, 3)
    assert.equal(s.SETTINGS_HEAD, 'SETTINGS')
    const opts = (...labels) => labels.map((label, value) => ({ value, label }))
    const enums = [
      { id: 3, name: 'Bypass Mode', value: 0, options: opts('THRU', 'MUTE') },
      { id: 8, name: 'Tone Stack Location', value: 1, options: opts('PRE', 'POST', 'OFF') },
      { id: 9, name: 'Tone Stack Type', value: 5, options: opts('ACTIVE', 'BROWNFACE', 'BLACKFACE', 'BASSGUY', 'TOP BOOST', 'PLEXI') },
      { id: 20, name: 'Four', value: 0, options: opts('A', 'B', 'C', 'D') },
      /* Left out: one choice; numbers only; the block's own bypass; a choice with no words; no name; the same setting twice; and what is not a setting. */
      { id: 21, name: 'One', value: 0, options: opts('ONLY') },
      { id: 22, name: 'Numbers', value: 0, options: [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }] },
      { id: 4, name: 'Bypass', value: 0, options: opts('ENGAGED', 'BYPASSED') },
      { id: 23, name: 'Blank', value: 0, options: [{ value: 0, label: 'OFF' }, { value: 1, label: ' ' }] },
      { id: 24, name: ' ', value: 0, options: opts('A', 'B') },
      { id: 3, name: 'Bypass Mode again', value: 0, options: opts('THRU', 'MUTE') },
      null,
      { id: 'x', name: 'Bad id', value: 0, options: opts('A', 'B') },
      { id: 25, name: 'No options', value: 0 }
    ]
    const drawn = s.blockSettings(enums, 'nam')
    assert.deepEqual(drawn.map((d) => [d.id, d.name, s.settingKind(d)]), [[3, 'Bypass Mode', 'buttons'], [8, 'Tone Stack Location', 'buttons'], [9, 'Tone Stack Type', 'list'], [20, 'Four', 'list']])
    /* A list of OFF, 1, 2, 3 is named: one choice the unit named is enough. */
    assert.equal(s.blockSettings([{ id: 1, name: 'Taps', value: 0, options: [{ value: 0, label: 'OFF' }, { value: 1, label: '1' }, { value: 2, label: '2' }] }], 'delay').length, 1)
    /* Words exactly as the unit gave them, and nothing renamed. */
    assert.deepEqual(drawn[0].options, [{ value: 0, label: 'THRU' }, { value: 1, label: 'MUTE' }])
    assert.equal(s.choiceSaid(drawn[2], 5), 'PLEXI')
    assert.equal(s.choiceSaid(drawn[2], 99), '99', 'a number the list has no name for is said as something else')
    /* The choice shown: the one just tapped while its write is out, else the unit's. */
    assert.equal(s.settingValue(drawn[1], null), 1)
    assert.equal(s.settingValue(drawn[1], {}), 1)
    assert.equal(s.settingValue(drawn[1], { 8: 2 }), 2)
    assert.equal(s.settingValue(drawn[1], { 9: 2 }), 1)
    /* A Cab's lists are the cab picker's: none here, however the slug is spelt. */
    for (const cab of ['cab', 'CAB', 'Cab']) assert.deepEqual(s.blockSettings(enums, cab), [])
    assert.deepEqual(s.NO_SETTINGS_ON, ['cab'])
    for (const none of [null, undefined, 'x', {}]) assert.deepEqual(s.blockSettings(none, 'amp'), [])
    /* The find box: every word typed, anywhere in a name. */
    assert.deepEqual(s.choicesFound(drawn[2], 'b').map((o) => o.label), ['BROWNFACE', 'BLACKFACE', 'BASSGUY', 'TOP BOOST'])
    assert.deepEqual(s.choicesFound(drawn[2], 'top  boost').map((o) => o.label), ['TOP BOOST'])
    assert.equal(s.choicesFound(drawn[2], '  '), drawn[2].options)
    assert.deepEqual(s.choicesFound(drawn[2], 'zzz'), [])
    assert.ok(s.FIND_FROM > 6 && s.FIND_FROM <= 20)
  })

  test('edit settings: a NAM block’s six go under its one page of knobs, five as buttons and its twelve tone stacks as a list', async () => {
    const s = await lib()
    const e = await import('../mobile/src/lib/axefx3-edit.js')
    const NAM_A = [0, 52427, 32767, 0, 0, 32767, 0, 0, 1, 0, 32767, 32767, 32767, 2, 32767, 36526, 56445, 63805]
    const out = e.withNam.blockParamsOf(206, { count: 72, values: [...NAM_A, ...NAM_A, ...NAM_A, ...NAM_A] }, { channel: 0 })
    const pages = await pagesOf(out)
    assert.deepEqual(pages.map((p) => p.key), ['main'])
    const by = s.settingsByPage(s.blockSettings(out.enums, out.slug), out.layout || null, pages)
    assert.deepEqual([...by.keys()], ['main'])
    assert.deepEqual(by.get('main').map((d) => [d.name, s.settingKind(d), s.choiceSaid(d, d.value)]), [
      ['Bypass Mode', 'buttons', 'THRU'],
      ['Phase Invert', 'buttons', 'NORMAL'],
      ['Scene Ignore', 'buttons', 'OFF'],
      ['Tone Stack Location', 'buttons', 'POST'],
      ['Tone Stack Type', 'list', 'ACTIVE'],
      ['Input Mode', 'buttons', 'SUM L+R']
    ])
    /* Nothing to place, or no pages: an empty map, never a throw. */
    assert.equal(s.settingsByPage([], null, pages).size, 0)
    assert.equal(s.settingsByPage(by.get('main'), null, []).size, 0)
    assert.equal(s.settingsByPage(null, null, pages).size, 0)
  })

  test('edit settings: on a block with the editor’s pages, a setting goes with the knobs of the page the editor has it on, and every setting is on some page', async () => {
    const s = await lib()
    const e = await import('../mobile/src/lib/fm3-edit.js')
    const k = await import('../mobile/src/lib/fm3-knobs.js')
    const { currentPages } = await import('../mobile/src/lib/editPages.js')
    let blocks = 0
    let withPages = 0
    for (const [eidText, b] of Object.entries(k.FM3_BLOCKS)) {
      const eid = Number(eidText)
      const fam = k.FM3_FAMILIES[b[1]]
      if (!fam || eid !== b[3]) continue
      const out = e.blockParamsOf(eid, { count: fam.stride * 4, values: Array(fam.stride * 4).fill(0) }, { channel: 0 })
      if (!out) continue
      const pages = await pagesOf(out)
      const settings = s.blockSettings(out.enums, out.slug)
      const by = s.settingsByPage(settings, out.layout || null, pages)
      blocks++
      /* Only on pages there are; every setting on at least one; each page's in the read's own order, none twice. */
      for (const key of by.keys()) assert.ok(pages.some((p) => p.key === key), `${b[2]}: settings under a page that is not there (${key})`)
      const placed = new Set([...by.values()].flat().map((d) => d.id))
      assert.deepEqual([...placed].sort((x, y) => x - y), settings.map((d) => d.id).sort((x, y) => x - y), `${b[2]}: a setting the unit sent is on no page`)
      for (const [key, on] of by) {
        const order = on.map((d) => settings.indexOf(d))
        assert.deepEqual(order, [...order].sort((x, y) => x - y), `${b[2]} ${key}: out of the read’s order`)
        assert.equal(new Set(on).size, on.length)
      }
      /* Where the editor places a setting on a page that has knobs of ours, it is under those knobs. */
      if (!out.layout) continue
      const numbered = pages.filter((p) => /^page-\d+$/.test(p.key))
      for (const page of numbered) {
        const src = currentPages(out.layout).find((lp) => (lp.rows || []).some((r) => r.section === 'parameters' && (r.controls || []).some((c) => page.params.some((p) => p.id === c.paramId))))
        if (!src) continue
        withPages++
      }
    }
    assert.ok(blocks > 25, `only ${blocks} FM3 blocks were tried`)
    assert.ok(withPages > 40, `only ${withPages} pages had the editor’s own page behind them`)
    /* A Compressor, by name: its knee and detector with Basic's knobs, its sidechain's with Sidechain's, its mix's with Mix. */
    const comp = Object.entries(k.FM3_BLOCKS).find(([, b]) => b[2] === 'Compressor')
    const fam = k.FM3_FAMILIES[comp[1][1]]
    const out = e.blockParamsOf(Number(comp[0]), { count: fam.stride * 4, values: Array(fam.stride * 4).fill(0) }, { channel: 0 })
    const pages = await pagesOf(out)
    const by = s.settingsByPage(s.blockSettings(out.enums, out.slug), out.layout, pages)
    const counts = Object.fromEntries(pages.map((p) => [p.name, (by.get(p.key) || []).length]))
    assert.ok(counts.Basic > 0 && counts.Sidechain > 0 && counts.Mix > 0, JSON.stringify(counts))
    /* A Cab has none, whatever its read says. */
    const cab = Object.entries(k.FM3_BLOCKS).find(([, b]) => b[0] === 'cab')
    const cabFam = k.FM3_FAMILIES[cab[1][1]]
    const cabOut = e.blockParamsOf(Number(cab[0]), { count: cabFam.stride * 4, values: Array(cabFam.stride * 4).fill(0) }, { channel: 0 })
    assert.ok(cabOut.enums.length > 5)
    assert.deepEqual(s.blockSettings(cabOut.enums, cabOut.slug), [])
  })

  test('edit settings: Edit draws them under the knobs for his account alone, writes with the write it already had, and reads the block again', async () => {
    /* The switch, false: every other account's Edit is the knobs it always was. */
    assert.match(read('mobile/src/lib/features.js'), /^export const EDIT_SETTINGS_FOR_EVERYONE = false$/m, 'a block’s list settings are open to every account before he has tapped one and said so')
    assert.match(flat(code(read('mobile/src/lib/useEditSettings.js'))), /export const useEditSettings = \(\) => \{ const his = useBluetoothAdmin\(\) return EDIT_SETTINGS_FOR_EVERYONE \|\| his \}/)
    const edit = code(read('mobile/src/screens/Edit.js'))
    const one = flat(edit)
    assert.match(one, /const settingsOn = useEditSettings\(\)/)
    /* Never in the hold pop-up, never where there are no knobs to read, and never past the gate. */
    assert.match(edit, /const settings = settingsOn && !bare && !knobless \? blockSettings\(enums, block\.slug\) : \[\]\n/)
    assert.match(one, /const pageSettings = settings\.length \? settingsByPage\(settings, layout, pages\)\.get\(onPage\?\.key\) \|\| \[\] : \[\]/)
    /* What the read said, kept at every read of the block. */
    assert.ok((one.match(/setEnums\((p|fresh)\?\.enums \|\| \[\]\)/g) || []).length >= 3, 'the settings are not kept at every read of the block')
    /* The write is Edit's own for a list setting, the unsaved mark as a knob's, and then the block again. */
    assert.match(one, /const pickSetting = async \(setting, value\) => \{ if \(restoring\) return setChoosing\(\(prev\) => \(\{ \.\.\.prev, \[setting\.id\]: value \}\)\) try \{ await setEnum\(eid, setting\.id, value\) noteEdited\(\) const fresh = await blockParams\(eid\) setParams\(fresh\?\.named \|\| \[\]\) setEnums\(fresh\?\.enums \|\| \[\]\) setLayout\(fresh\?\.layout \|\| null\) \} catch \(err\) \{ onError\(err\.message\) \} finally \{/)
    /* Drawn once, under the knobs and the Level, over what is left to the unit and the block's on and off. */
    assert.equal((one.match(/<BlockSettings /g) || []).length, 1)
    assert.match(one, /\{pageSettings\.length \? <BlockSettings settings=\{pageSettings\} choosing=\{choosing\} disabled=\{!!restoring\} onPick=\{pickSetting\} \/> : null\}/)
    const raw = read('mobile/src/screens/Edit.js')
    assert.ok(raw.indexOf('shown.map((p) =>') < raw.indexOf('<BlockSettings '), 'the settings are over the knobs')
    assert.ok(raw.indexOf('{level && !bare ? (') < raw.indexOf('<BlockSettings '), 'the settings are over the Level')
    assert.ok(raw.indexOf('<BlockSettings ') < raw.indexOf('{namOnUnit ? <Note>'), 'the settings are under the line for what is left to the unit')
    /* The component draws and asks; it never writes. Buttons for a short list, one button that opens a sheet for a long one. */
    const comp = code(read('mobile/src/components/BlockSettings.js'))
    assert.ok(!/setEnum|setParam|blockParams|remoteRequest|lib\/device|lib\/rig/.test(comp), 'the settings component writes or reads the unit itself')
    assert.match(flat(comp), /if \(settingKind\(s\) === 'buttons'\) \{/)
    assert.match(flat(comp), /<Press label=\{o\.label\} height=\{TAP\} tone="signal" on=\{o\.value === at\} disabled=\{disabled\} accessibilityLabel=\{`\$\{s\.name\}: \$\{o\.label\}`\} onPress=\{\(\) => pick\(s, o\.value\)\} \/>/)
    assert.match(flat(comp), /<Press key=\{s\.id\} label=\{s\.name\} sub=\{`\$\{choiceSaid\(s, at\)\} ▾`\} disabled=\{disabled\}/)
    assert.match(flat(comp), /<Sheet open=\{!!shown\} onClose=\{close\} title=\{shown\?\.name \|\| ''\}>/)
    assert.match(flat(comp), /const pick = \(setting, value\) => \{ if \(disabled \|\| value === settingValue\(setting, choosing\)\) return onPick\(setting, value\) \}/)
    /* Phone only, and the page rule it reads is not changed: nothing of it in the files the computer app is made of. */
    assert.equal(read('mobile/src/lib/editSettings.js').match(/^import .*$/gm).join('\n'), "import { currentPages } from './editPages.js'")
    for (const f of ['src/lib/editPages.js', 'src/components/Console.jsx']) assert.ok(!/editSettings|BlockSettings|settingsByPage/.test(read(f)), f)
  })
}
