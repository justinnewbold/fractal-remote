/**
 * EDIT IS FOR TURNING KNOBS (mobile/src/lib/editMore.js, screens/Edit.js,
 * components/Knob.js, screens/Gear.js; the mockups in docs/edit-more/).
 *
 * "I kind of want this to mainly be to edit knob presets quickly, and I feel
 * like that these four other buttons are just taking up space on the screen"
 * (Justin, 10 November 2026). Edit opens on a block with its knobs showing;
 * Amp & pedal names, Edit chain, Modifiers and Rename preset and scenes are in
 * More beside Done, with the beta note; Find a control is the magnifier; and
 * the preset's name, a + tile at the end of the chain, an i beside the model
 * and a knob held still are the shortcuts.
 *
 * The words and rules file imports nothing, so it is run as it is.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

async function rules() {
  const src = read('mobile/src/lib/editMore.js')
  assert.doesNotMatch(src, /^import /m, 'lib/editMore imports something; this check runs it on its own')
  const dir = mkdtempSync(join(tmpdir(), 'edit-more-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    writeFileSync(join(dir, 'editMore.js'), src)
    return await import(pathToFileURL(join(dir, 'editMore.js')).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  test('Edit opens on a block by itself: the one last open in this preset, else the amp, else the first that is not an end', async () => {
    const { firstOpen } = await rules()
    const chain = [
      { id: 37, slug: 'input' },
      { id: 62, slug: 'gate' },
      { id: 133, slug: 'drive' },
      { id: 58, slug: 'amp' },
      { id: 42, slug: 'output' }
    ]
    assert.equal(firstOpen(chain), 58, 'the amp is not what Edit opens on')
    assert.equal(firstOpen(chain, 133), 133, 'the block last open in this preset is not kept')
    assert.equal(firstOpen(chain, 999), 58, 'a block no longer in the chain is opened')
    assert.equal(firstOpen(chain.filter((b) => b.slug !== 'amp')), 62, 'with no amp, an end is opened, or nothing')
    assert.equal(firstOpen([{ id: 37, slug: 'input' }, { id: 42, slug: 'output' }]), null, 'an end is opened for its knobs')
    assert.equal(firstOpen([]), null)
    assert.equal(firstOpen(null), null)
    /* Once per preset, never on a VP4 or from the last song's chain, and a block already open that this preset has stays open. */
    const edit = flat(code(read('mobile/src/screens/Edit.js')))
    assert.match(edit, /if \(chainNow\.elsewhere \|\| vp4Bench\(\) \|\| !blocks\.length \|\| autoFor\.current === presetNumber\) return autoFor\.current = presetNumber setOpenEid\(\(was\) => was !== null && blocks\.some\(\(b\) => sameBlock\(b, was\)\) \? was : firstOpen\(/)
    assert.match(edit, /if \(openEid !== null && presetNumber !== null\) keptOpen\.set\(presetNumber, openEid\)/)
  })

  test('More holds the four buttons that sat under the knobs, by their old rules, and the beta note', async () => {
    const { MORE_ROWS } = await rules()
    assert.deepEqual(Object.keys(MORE_ROWS), ['chain', 'modifiers', 'rename', 'gear'])
    assert.deepEqual(
      Object.values(MORE_ROWS).map((r) => r.label),
      ['Edit chain', 'Modifiers', 'Rename preset and scenes', 'Amp & pedal names'],
      'More’s rows are not the four buttons, by their own names'
    )
    const edit = flat(code(read('mobile/src/screens/Edit.js')))
    assert.match(edit, /const chainTools = chainEditorHere\(\{ vp4: vp4Bench\(\), viaBle, caps, elsewhere: chainNow\.elsewhere \}\) const modsHere = chainTools && !viaBle && modifiersBind const renameHere = !vp4Bench\(\) && \(!viaBle \|\| caps\?\.namesWritable === true\) && !chainNow\.elsewhere/)
    const more = edit.slice(edit.indexOf('<Sheet open={moreOpen}'), edit.indexOf('</Sheet>'))
    for (const [rule, row] of [['chainTools', 'chain'], ['modsHere', 'modifiers'], ['renameHere', 'rename']]) {
      assert.match(more, new RegExp(`\\{${rule} \\? <Press label=\\{MORE_ROWS\\.${row}\\.label\\} sub=\\{MORE_ROWS\\.${row}\\.sub\\} onPress=\\{\\(\\) => openTool\\('${row}'\\)\\} \\/> : null\\}`), `More’s ${row} row is not behind ${rule}`)
    }
    assert.match(more, /\{onOpenGear \? \( <Press label=\{MORE_ROWS\.gear\.label\}/)
    assert.match(more, /\{vp4Bench\(\) \? <Note tone="hint">\{VP4_NO_EDITS\}<\/Note> : viaBle \? <Note tone="hint">\{noChainLine\(quickBuildHere\(\{ on: quickOn, caps \}\), \{ editor: caps\?\.chainEditor === true, tools: caps\?\.namesWritable === true \}\)\}<\/Note> : null\}/)
    assert.match(more, /<Note tone="warn">\{BETA_NOTE\}<\/Note>/)
    /* None of the four is a button on the page any more, and the beta note is not a box at its foot. */
    const page = edit.slice(edit.indexOf('export default function Edit('), edit.indexOf('<Sheet open={moreOpen}'))
    assert.doesNotMatch(page, /label="Amp & pedal names"|label="Edit chain"|label="Modifiers"|label="Rename preset and scenes"|betaNoteUp/, 'one of the four is back on the page')
    /* The tool opened shows under the chain in the open block's place, until its Close. */
    assert.match(edit, /const toolShown = tool === 'chain' \? chainTools : tool === 'modifiers' \? modsHere : tool === 'rename' \? renameHere : false/)
    assert.match(edit, /\{block && !toolShown \? \( <View onLayout=\{panelLaid\}>/)
    /* A block's tile, with a tool up, closes it and opens that block. */
    assert.match(edit, /onPress=\{\(\) => \{ if \(toolShown\) \{ setTool\(null\) setOpenEid\(idOf\(b\)\) \} else setOpenEid\(open \? null : idOf\(b\)\) \}\}/)
    assert.match(edit, /function RenameDoor\(\{ onClose \}\)/)
    assert.match(edit, /function ChainEditor\(\{ blocks, caps, overWire = false, slow = false, unit = '', onError, onScrollLock, onClose \}\) \{ const open = true const setOpen = \(on\) => \{ if \(!on\) onClose\?\.\(\) \}/)
    assert.match(edit, /function Modifiers\(\{ blocks, onError, onClose, start = null \}\) \{ const open = true const setOpen = \(on\) => \{ if \(!on\) onClose\?\.\(\) \}/)
  })

  test('the title row: the magnifier and More beside Done, More as ⋮ on Android, and Find a control only while asked for', () => {
    const edit = flat(code(read('mobile/src/screens/Edit.js')))
    assert.match(edit, /\{vp4Bench\(\) \|\| tucked \? null : \( <RoundButton icon=\{searchIcon\} label=\{FIND_LABEL\} on=\{finding\} onPress=\{\(\) => setFinding\(\(was\) => !was\)\} \/> \)\} \{tucked \? null : \( <RoundButton icon=\{Platform\.OS === 'android' \? moreAndroidIcon : moreIcon\} label=\{MORE_LABEL\} on=\{moreOpen\} onPress=\{\(\) => setMoreOpen\(true\)\} \/> \)\} \{pending \? <SaveButton s=\{saveTo\} waiting \/> : null\} <\/View> <Press label="Done" height=\{40\} onPress=\{onBack\} \/>/)
    for (const icon of ['search', 'more', 'more-vertical']) {
      const png = readFileSync(new URL(`../mobile/assets/icons/${icon}.png`, import.meta.url))
      assert.equal(png.readUInt32BE(16), 96)
      assert.equal(png.readUInt32BE(20), 96)
    }
  })

  /*
   * "Edit (Beta)" came out one letter to a line (Justin's picture of 15
   * November 2026: a 375-point window with Confirm changes showing). The
   * buttons took the width they wanted and the title's side got what was
   * left, seven points. lib/editHead has the three rules. The layout was
   * tried in a browser's own flex engine at 320 to 768 points before it was
   * written down; what is held here is the rules' parts.
   */
  test('Edit’s title keeps a width its words fit in, and nothing else can ever stand where Done is', async () => {
    const { HEAD_ROOM, headTucked } = await import('../mobile/src/lib/editHead.js')
    const edit = flat(code(read('mobile/src/screens/Edit.js')))
    /*
     * RULE 1. DONE HAS A COLUMN TO ITSELF. Two independent reads each found
     * a way for "Confirm changes" (which writes over the preset) to come to
     * stand where Done had just been: the first cut wrapped all four buttons
     * downwards, the second wrapped them upwards and was caught out at a
     * larger system text size. So Done is not in the group that wraps at
     * all: the right side is that group and THEN Done, in a row that does
     * not wrap. Laid out in Yoga itself (the engine React Native lays out
     * with) at sixteen widths, nine text sizes and seven title heights,
     * every move a save makes left only Done, or nothing, where Done had
     * been.
     */
    assert.match(edit, /const HEAD_SIDE = \{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: space\.sm \}/)
    assert.ok(!/const HEAD_SIDE = \{[^}]*flexWrap/.test(edit), 'the row that holds Done wraps')
    assert.match(edit, /<View style=\{HEAD_SIDE\}> <View style=\{HEAD_BUTTONS\}> \{vp4Bench\(\) \|\| tucked \? null : \( <RoundButton icon=\{searchIcon\} label=\{FIND_LABEL\} on=\{finding\} onPress=\{\(\) => setFinding\(\(was\) => !was\)\} \/> \)\} \{tucked \? null : \( <RoundButton icon=\{Platform\.OS === 'android' \? moreAndroidIcon : moreIcon\} label=\{MORE_LABEL\} on=\{moreOpen\} onPress=\{\(\) => setMoreOpen\(true\)\} \/> \)\} \{pending \? <SaveButton s=\{saveTo\} waiting \/> : null\} <\/View> <Press label="Done" height=\{40\} onPress=\{onBack\} \/> <\/View> <\/View> <SaveNotes s=\{saveTo\} \/>/)
    /* Done is drawn once in the head, after the group has closed and never inside it. Counted over the WHOLE head, the title's side too: a third reader put a second Done there and nothing failed. */
    const whole = edit.slice(edit.indexOf('<View onLayout={(e) => setHeadWide('), edit.indexOf('<SaveNotes s={saveTo} />'))
    assert.ok(whole.includes('<View style={HEAD_TITLE}>') && whole.includes('<View style={HEAD_SIDE}>'), 'the head was not found whole')
    assert.equal((whole.match(/label="Done"/g) || []).length, 1, 'Done is drawn twice in the head')
    assert.equal((whole.match(/onBack/g) || []).length, 1, 'something else in the head leaves the page')
    /* And the four styles are what their literals say: nothing is assigned to them afterwards. */
    assert.ok(!/\bHEAD_(SIDE|BUTTONS|TITLE|NAMES)\s*(\.|\[)[^;\n]*=[^=]|Object\.assign\(\s*HEAD_/.test(edit), 'a head style is changed after it is made')
    const head = edit.slice(edit.indexOf('<View style={HEAD_SIDE}>'), edit.indexOf('<SaveNotes s={saveTo} />'))
    assert.equal((head.match(/<Press label="Done"/g) || []).length, 1)
    assert.ok(head.indexOf('</View> <Press label="Done"') > head.indexOf('<SaveButton'), 'Done is inside the group that wraps')
    const group = head.slice(head.indexOf('<View style={HEAD_BUTTONS}>'), head.indexOf('</View> <Press label="Done"'))
    assert.ok(!/label="Done"|onBack/.test(group), 'Done is inside the group that wraps')
    /* The group may wrap, among its own three, upwards and against the right: the Save button, its last, takes the upper line, the magnifier and More the lower, and Done stands centred beside the two. */
    assert.match(edit, /const HEAD_BUTTONS = \{ flexDirection: 'row', flexWrap: 'wrap-reverse', justifyContent: 'flex-end', flexShrink: 1, gap: space\.sm \}/)

    /*
     * RULE 2. CONFIRM CHANGES IS WHERE SAVE WAS: while a save is asked about
     * or going, on a row too narrow for all four beside a readable title,
     * the magnifier and More step aside.
     */
    for (const row of [288, 328, 343, 361, 408, 447]) {
      assert.equal(headTucked(row, true), true, `${row} points: a narrow row with the save asked about`)
      assert.equal(headTucked(row, false), false, `${row} points: nothing is tucked away while the Save button is at rest`)
    }
    /* A wide row (an iPad, half of one) has room for all four and a whole title: nothing moves there. */
    for (const row of [448, 475, 736, 1000]) assert.equal(headTucked(row, true), false, `${row} points`)
    /* A row not measured yet, or measured as nothing, tucks nothing: the buttons are never taken away on a guess. */
    for (const row of [null, undefined, NaN, 0, -1, '343', Infinity]) assert.equal(headTucked(row, true), false, String(row))
    for (const busy of [undefined, null, 0, '']) assert.equal(headTucked(343, busy), false)
    /* The line between them: four buttons with Confirm changes (40 + 40 + about 157 + about 70, three gaps of 8), a gap of 12 and a one-line title of about 104. Every phone held upright is under it (the widest window, 440, has a row of 408). */
    assert.ok(HEAD_ROOM >= 440 && HEAD_ROOM <= 460, `${HEAD_ROOM}: an upright phone is not tucked, or half an iPad is`)
    /* Edit goes by the rule, with the row's own measured width and the save's two busy states. */
    assert.match(edit, /import \{ headTucked \} from '\.\.\/lib\/editHead'/)
    assert.match(edit, /const \[headWide, setHeadWide\] = useState\(null\)/)
    assert.match(edit, /const tucked = headTucked\(headWide, pending && \(saveTo\.armed \|\| saveTo\.saving\)\)/)
    assert.match(edit, /<View onLayout=\{\(e\) => setHeadWide\(Math\.round\(e\.nativeEvent\.layout\.width\)\)\} style=\{\{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space\.md \}\} > <View style=\{HEAD_TITLE\}> <Text accessibilityRole="header" accessibilityLabel="Edit, beta"/)

    /* RULE 3. The title's side takes what the right side leaves and never less than its floor. `flex: 1`, not a shrink factor: a shared shrink takes a point off the buttons and wraps one where everything fitted. */
    const min = /const HEAD_TITLE_MIN = (\d+)/.exec(edit)
    assert.ok(min, 'the title’s least width is gone')
    /* Wide enough for "(Beta)", the wider of its two words, on a line of its own; and with plain Save showing on a 375-point phone the four buttons want about 236 of the row’s 343, so a floor over 95 would wrap one where everything fits today. */
    assert.ok(Number(min[1]) >= 56 && Number(min[1]) <= 90, `${min[1]}: too narrow for “(Beta)” on one line, or wide enough to wrap a button on a 375-point phone with Save showing`)
    assert.match(edit, /const HEAD_TITLE = \{ flex: 1, minWidth: HEAD_TITLE_MIN \}/)
    assert.ok(!/HEAD_TITLE = \{[^}]*flexShrink/.test(edit), 'the title’s side shrinks by a factor again')
    /* The names under the title are a button no wider than their own words: the gap to the buttons is not a place to tap. */
    assert.match(edit, /const HEAD_NAMES = \{ alignSelf: 'flex-start', maxWidth: '100%' \}/)
    assert.match(edit, /onPress=\{\(\) => openTool\('rename'\)\} style=\{HEAD_NAMES\} >/)
    /* The preset's name still cuts short on one line, so it cannot push the row wider (the scene's two lines are test/mobile.mjs's). */
    assert.match(edit, /<Text numberOfLines=\{1\} style=\{\{ color: color\.silk, fontSize: font\.small, fontWeight: '600' \}\} >/)
    /* And the Save button's three words are the ones the rule was sized for: a longer one would need the line moved. */
    assert.match(flat(code(read('mobile/src/components/SaveToSlot.js'))), /label=\{s\.saving \? 'Saving…' : s\.armed \? 'Confirm changes' : 'Save'\}/)
  })

  test('the shortcuts: the preset’s name renames, + at the end of the chain edits it, the i opens a model’s page, and a held knob opens Modifiers on it', async () => {
    const { gearStart, GEAR_KINDS, HOLD_MS, HOLD_SLOP, CHAIN_TILE } = await rules()
    const edit = flat(code(read('mobile/src/screens/Edit.js')))
    assert.match(edit, /<Pressable disabled=\{!renameHere\} accessibilityRole=\{renameHere \? 'button' : undefined\} accessibilityHint=\{renameHere \? 'Rename the preset and its scenes' : undefined\} onPress=\{\(\) => openTool\('rename'\)\} style=\{HEAD_NAMES\} >/)
    assert.match(edit, /\{chainTools && blocks\.length \? \( <Tile label=\{CHAIN_TILE\.label\} sub=\{CHAIN_TILE\.sub\}/)
    assert.deepEqual(CHAIN_TILE, { label: '+', sub: 'Chain' })
    /* The i: a kind Amp & pedal names has a page for, opened on that model; Gear opens on it. */
    const { GEAR_FAMILIES } = await import('../src/lib/gearCatalog.js')
    assert.deepEqual(GEAR_KINDS, GEAR_FAMILIES.map((f) => f.key), 'the i is offered for a kind Amp & pedal names has no page for, or not for one it has')
    assert.deepEqual(gearStart('amp', ' Diezel Herbert '), { family: 'amp', name: 'Diezel Herbert' })
    assert.equal(gearStart('reverb', 'Large Hall'), null)
    assert.equal(gearStart('amp', ''), null)
    assert.match(edit, /onModelInfo=\{onOpenGear \? \(start\) => onOpenGear\(start\) : null\}/)
    assert.match(edit, /const infoAt = onModelInfo \? gearStart\(block\.slug, current\?\.name\) : null const modelInfo = infoAt \? \(\) => onModelInfo\(infoAt\) : null/)
    const gear = flat(read('mobile/src/screens/Gear.js'))
    assert.match(gear, /export default function Gear\(\{ onBack, start = null \}\)/)
    assert.match(gear, /const \[open, setOpen\] = useState\(startEntry\)/)
    const app = flat(read('mobile/App.js'))
    assert.equal((app.match(/onOpenGear=\{\(start\) => \{ setGearStart\(start \|\| null\) setGearBack\('edit'\) setScreen\('gear'\) \}\}/g) || []).length, 3, 'an Edit does not hand Amp & pedal names the model it was opened on')
    assert.match(app, /onOpenGear=\{\(\) => \{ setGearStart\(null\) setGearBack\('settings'\) setScreen\('gear'\) \}\}/, 'Settings opens Amp & pedal names on the last model Edit asked for')
    /* A held knob: longer than a phone's own long press, no further than a few points, writes nothing, and only where More offers Modifiers. */
    assert.ok(HOLD_MS >= 600 && HOLD_SLOP <= 8)
    assert.match(edit, /onHoldKnob=\{modsHere && block\.turns !== true \? \(eid, paramId\) => openTool\('modifiers', \{ eid, paramId \}\) : null\}/)
    const knob = flat(read('mobile/src/components/Knob.js'))
    assert.match(knob, /if \(holdWait\.current && \(Math\.abs\(gesture\.dy\) > HOLD_SLOP \|\| Math\.abs\(gesture\.dx\) > HOLD_SLOP\)\) stopHold\(\) if \(holding\.current\) return/)
    assert.equal((knob.match(/if \(holding\.current\) \{ holding\.current = false dragged\.current = undefined return \}/g) || []).length, 2, 'a held knob writes a value when it is let go')
    /* Only Edit hands the hold and the i over: Play's pop-up and Derek's panel draw the knobs as they were. */
    for (const f of ['mobile/src/components/PopKnobs.js', 'mobile/src/components/BlockSide.js']) {
      assert.doesNotMatch(read(f), /onHoldKnob|onModelInfo/, `${f} hands the knobs Edit’s shortcuts`)
    }
  })

  test('the mockups he said yes to are kept with the code', () => {
    for (const f of ['01-iphone-today-vs-new', '02-iphone-more-and-shortcuts', '03-android-phone', '04-ipad-sideways', '05-ipad-upright', '06-android-tablet-beside-play']) {
      assert.ok(existsSync(new URL(`../docs/edit-more/${f}.png`, import.meta.url)), `docs/edit-more/${f}.png is missing`)
    }
  })
}
