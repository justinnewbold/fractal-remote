/**
 * THE BLOCK TO ADD, AS A MENU THAT OPENS AND SCROLLS, in the phone's chain
 * editor (mobile/src/lib/blockMenu.js, mobile/src/components/BlockMenu.js,
 * and the editor in mobile/src/screens/Edit.js).
 *
 * "In edit, make picking blocks to add a drop down scroll menu" (Justin, 15
 * November 2026, with a picture of an Axe-Fx III's list: a find box over
 * forty-five buttons in a dozen wrapped rows, with NAM 1, the one he had
 * picked, the very last of them).
 *
 * What these hold: which blocks the menu lists and in what order; the words
 * on its button; that the list comes up over the page and is not drawn into
 * it; that a card's Add brings it up with that one tap, and that it never
 * comes up by itself; and that a pick still does what it did.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const flat = (s) => s.replace(/\s+/g, ' ')
const lib = () => import('../mobile/src/lib/blockMenu.js')

/* An Axe-Fx III's list as the unit gives it: by its own numbers, so its own blocks come after Wah. */
const named = (names) => names.map((name, i) => ({ page: 100 + i, name }))
const UNIT_ORDER = ['Amp 1', 'Amp 2', 'Cab 1', 'Chorus 1', 'Chorus 2', 'Compressor 1', 'Delay 1', 'Drive 1', 'Drive 2', 'Drive 10', 'Looper', 'Wah 1', 'Vocoder', 'Crossover 1', 'Tone Match', 'IR Player 1', 'Dynamic Distortion 1', 'NAM 1', 'NAM 2']

export function run(test) {
  test('block menu: the list is one of each kind by name with nothing typed, every match by name with something typed, and never a block twice', async () => {
    const m = await lib()
    const palette = named(UNIT_ORDER)
    const kinds = palette.filter((b) => ['Amp 1', 'Cab 1', 'Chorus 2', 'Compressor 1', 'Delay 1', 'Drive 1', 'Looper', 'Wah 1', 'Vocoder', 'Crossover 1', 'Tone Match', 'IR Player 1', 'Dynamic Distortion 1', 'NAM 1'].includes(b.name))
    const names = (list) => list.map((b) => b.name)

    /* NOTHING TYPED: the kinds the editor hands it, and no other block; by name, so NAM is between Looper and Tone Match and not at the end. */
    assert.deepEqual(names(m.blocksListed(palette, kinds, '')), ['Amp 1', 'Cab 1', 'Chorus 2', 'Compressor 1', 'Crossover 1', 'Delay 1', 'Drive 1', 'Dynamic Distortion 1', 'IR Player 1', 'Looper', 'NAM 1', 'Tone Match', 'Vocoder', 'Wah 1'])
    assert.deepEqual(names(m.blocksListed(palette, kinds)), names(m.blocksListed(palette, kinds, '   ')), 'spaces in the find box are a search')
    /* The same blocks as it was handed: none dropped, none added. */
    assert.deepEqual(new Set(m.blocksListed(palette, kinds, '').map((b) => b.page)), new Set(kinds.map((b) => b.page)))
    /* The rows are the unit's own blocks, as they are: a pick hands the editor the block it always got. */
    for (const b of m.blocksListed(palette, kinds, '')) assert.equal(b, palette.find((p) => p.page === b.page))
    /* And the editor's list is left as it was: sorting is of a copy. */
    const before = names(kinds)
    m.blocksListed(palette, kinds, '')
    assert.deepEqual(names(kinds), before, 'the menu reordered the editor’s own list')

    /* SOMETHING TYPED: every block whose name has it, numbers and all, whatever the kinds are; any case, spaces round it ignored. */
    assert.deepEqual(names(m.blocksListed(palette, kinds, 'drive')), ['Drive 1', 'Drive 2', 'Drive 10'])
    assert.deepEqual(names(m.blocksListed(palette, kinds, '  DRIVE ')), ['Drive 1', 'Drive 2', 'Drive 10'])
    assert.deepEqual(names(m.blocksListed(palette, kinds, 'na')), ['Dynamic Distortion 1', 'NAM 1', 'NAM 2'])
    assert.deepEqual(names(m.blocksListed(palette, [], 'amp')), ['Amp 1', 'Amp 2'], 'a search needs the kinds')
    assert.deepEqual(m.blocksListed(palette, kinds, 'zzz'), [])
    /* By number where the words are the same: 2 before 10, which a sort of the words alone gets wrong. */
    assert.deepEqual(names([{ name: 'Drive 10' }, { name: 'drive 2' }, { name: 'Drive 1' }, { name: 'Delay 3' }, { name: 'Looper' }].sort(m.byName)), ['Delay 3', 'Drive 1', 'drive 2', 'Drive 10', 'Looper'])
    assert.equal(m.byName({ name: 'Amp 1' }, { name: 'amp 1' }), 0)
    assert.ok(m.byName({ name: 'Ten-Tap Delay 1' }, { name: 'Tone Match' }) < 0)
    for (const odd of [null, undefined, {}, { name: null }]) assert.doesNotThrow(() => m.byName(odd, { name: 'Amp 1' }))

    /* A search is cut to the most a person scrolls, after it is put in order, so the first of them are the first by name. */
    const many = named(Array.from({ length: 60 }, (_, i) => `Delay ${60 - i}`))
    const found = m.blocksListed(many, [], 'delay')
    assert.equal(found.length, m.FIND_MOST)
    assert.equal(m.FIND_MOST, 40)
    assert.deepEqual(names(found).slice(0, 3), ['Delay 1', 'Delay 2', 'Delay 3'])
    /* With nothing typed nothing is cut: a unit with more kinds than that lists them all. */
    assert.equal(m.blocksListed(many, many, '').length, 60)

    /* Never a block twice, were the unit to list one twice; and nothing a list can break on. */
    assert.deepEqual(names(m.blocksListed([...palette, palette[0]], [...kinds, kinds[0]], '')).filter((n) => n === 'Amp 1'), ['Amp 1'])
    assert.deepEqual(names(m.blocksListed([...palette, palette[0]], kinds, 'amp 1')), ['Amp 1'])
    assert.deepEqual(m.blocksListed(null, null, ''), [])
    assert.deepEqual(m.blocksListed(null, null, 'amp'), [])
    assert.deepEqual(names(m.blocksListed([null, { page: 1, name: null }, { page: 2, name: 'Amp 1' }], [], 'amp')), ['Amp 1'])
  })

  test('block menu: the button says the block it is on, or that none is picked, and that it opens a list', async () => {
    const m = await lib()
    const palette = named(UNIT_ORDER)
    const nam = palette.find((b) => b.name === 'NAM 1')
    assert.equal(m.pickedOf(palette, nam.page), nam)
    assert.equal(m.pickedOf(palette, String(nam.page)), nam, 'a page kept as text is not found')
    for (const none of [null, undefined]) assert.equal(m.pickedOf(palette, none), null)
    assert.equal(m.pickedOf(palette, 9999), null, 'a block the unit does not list is picked')
    assert.equal(m.pickedOf(null, nam.page), null)
    /* Page 0 is a page like any other, not "none". */
    assert.deepEqual(m.pickedOf([{ page: 0, name: 'Input 1' }], 0), { page: 0, name: 'Input 1' })

    assert.equal(m.BLOCK_TO_ADD, 'Block to add')
    assert.equal(m.menuSaid(nam), 'NAM 1 ▾')
    assert.equal(m.menuSaid(null), 'Pick a block ▾')
    assert.equal(m.menuLabel(m.BLOCK_TO_ADD, nam), 'Block to add: NAM 1. Opens a list.')
    assert.equal(m.menuLabel(m.BLOCK_TO_ADD, null), 'Block to add: none picked. Opens a list.')
    assert.equal(m.FIND_A_BLOCK, 'Find a block')
    assert.equal(m.NOTHING_FOUND, 'No block named like that.')
    /* Nothing the menu says names the device in hand, or is spelt another way. */
    for (const words of [m.BLOCK_TO_ADD, m.NONE_PICKED, m.FIND_A_BLOCK, m.NOTHING_FOUND, m.menuLabel(m.BLOCK_TO_ADD, null)]) assert.doesNotMatch(words, /this phone|your phone|colour|soon|beta/i)
  })

  test('block menu: one button, and the list comes up over the page in the app’s sheet, the find box staying at its top', async () => {
    const menu = flat(code(read('mobile/src/components/BlockMenu.js')))
    /* The button: its name over the block it is on, as a block's list settings are drawn. Words, never a picture alone, and a Press, so the tap is in the log. */
    assert.match(menu, /<Press label=\{label\} sub=\{menuSaid\(picked\)\} height=\{52\} disabled=\{disabled\} accessibilityLabel=\{menuLabel\(label, picked\)\} onPress=\{\(\) => \{ setFind\(''\) setOpen\(true\) \}\} \/>/)
    assert.ok(!/Pressable|icon=/.test(menu))
    /* The list is the app's sheet, over the page: nothing under it moves, it scrolls by itself, and it is tall, for a list this long. */
    assert.match(menu, /<Sheet open=\{open\} onClose=\{close\} title=\{title\} note=\{note\} tall fill head=\{ <TextInput /)
    /*
     * HELD AT ITS FULL HEIGHT (`fill`). A sheet is as tall as its rows, up
     * from the bottom of the screen: a search that left one row shrank it
     * until the find box and that row were both behind the keyboard. Its
     * full height keeps the head at the top of the screen, and a drag on
     * the rows puts the keyboard down, so the rows under it can be reached.
     */
    const whole = flat(code(read('mobile/src/components/Sheet.js')))
    assert.match(whole, /const highest = tall \? Math\.max\(height \* 0\.8, height - Math\.max\(top, STATUS_AT_LEAST\) - GLASS\) : height \* 0\.8/)
    assert.match(whole, /fill \? \{ height: highest \} : null\]\}/)
    assert.match(whole, /keyboardDismissMode=\{fill \? 'on-drag' : 'none'\}/)
    /* No other sheet asked for it: every other sheet is as tall as what is in it, as it was. */
    const askers = ['mobile/src/components', 'mobile/src/screens'].flatMap((dir) => readdirSync(new URL(`../${dir}/`, import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`)).filter((f) => /<Sheet\b[^>]*\bfill\b/.test(flat(code(read(f)))))
    assert.deepEqual(askers, ['mobile/src/components/BlockMenu.js'])
    /* The find box is the sheet's head, which stays while the rows scroll under it (components/Sheet). */
    assert.match(menu, /head=\{ <TextInput value=\{find\} onChangeText=\{setFind\} placeholder=\{FIND_A_BLOCK\} placeholderTextColor=\{color\.silkFaint\} autoCorrect=\{false\} autoCapitalize="none" accessibilityLabel="Find a block to add" style=\{fieldLook\} \/> \}/)
    const sheet = flat(code(read('mobile/src/components/Sheet.js')))
    assert.match(sheet, /\{head \? <View style=\{\{ gap: space\.sm, paddingHorizontal: space\.lg, paddingTop: space\.sm \}\}>\{head\}<\/View> : null\} <ScrollView/, 'the sheet’s head scrolls away with its rows')
    assert.match(sheet, /keyboardShouldPersistTaps="handled"/, 'with the keyboard up, the first tap on a row only puts the keyboard down')
    /* The rows: the blocks the lib lists, a button each with its name, the one picked lit; a tap shuts the list and hands the block over. */
    assert.match(menu, /const rows = blocksListed\(palette, kinds, find\)/)
    assert.match(menu, /\{rows\.map\(\(b\) => \( <Press key=\{b\.page\} label=\{b\.name\} tone="signal" on=\{!!picked && b\.page === picked\.page\} disabled=\{disabled\} onPress=\{\(\) => \{ close\(\) onPick\(b\) \}\} \/> \)\)\}/)
    assert.match(menu, /\{!rows\.length \? <Note>\{NOTHING_FOUND\}<\/Note> : null\}/)
    /* Shutting it empties the find box: the next time it opens on the whole list. */
    assert.match(menu, /const close = \(\) => \{ setOpen\(false\) setFind\(''\) \}/)
    /* No row of wrapped buttons drawn into the page any more, here or in the editor. */
    assert.ok(!/flexWrap/.test(menu), 'the menu wraps its blocks into rows of buttons')
    /* The find box's look is the editor's own, handed in: this file reads no glass, so the Classic look is held where it always was (test/glass-classic). */
    assert.ok(!/glassField|from '\.\.\/lib\/glass'/.test(menu))
  })

  test('block menu: a card’s Add brings its list up with that tap, the list never comes up by itself, and a pick does what it always did', async () => {
    const src = read('mobile/src/screens/Edit.js')
    const editor = flat(code(src))
    const menu = flat(code(read('mobile/src/components/BlockMenu.js')))

    /* WHETHER THE LIST IS UP is kept by whoever draws the menu, when they say so; else by the menu, which then opens on its button alone. */
    assert.match(menu, /export default function BlockMenu\(\{ palette, kinds, chosen = null, title, note = null, label = BLOCK_TO_ADD, fieldLook, disabled = false, up = false, onUp = null, onPick \}\)/)
    assert.match(menu, /const \[own, setOwn\] = useState\(false\) const open = onUp \? !!up : own const setOpen = onUp \|\| setOwn/)
    /* Never up because it was drawn: nothing starts it open. */
    assert.ok(!/startOpen|useState\(true\)|useState\(!!/.test(menu), 'a menu comes up by being drawn')
    /*
     * Taken off the page with its list up, it tells the keeper the list is
     * down: the next menu under that card stays shut. ONLY IF ITS OWN LIST
     * WAS UP: a menu left shut under one card goes when another card's Add
     * is tapped, and told "down" by that, the list the tap had just asked
     * for never came (found by a second reader, before it shipped).
     */
    assert.match(menu, /const wasUp = useRef\(false\) useEffect\(\(\) => \{ wasUp\.current = open \}\) useEffect\( \(\) => \(\) => \{ if \(wasUp\.current\) onUp\?\.\(false\) \}, \[onUp\] \)/)
    assert.equal((menu.match(/onUp\?\.\(false\)/g) || []).length, 1, 'the keeper is told the list is down somewhere it is not guarded')

    /* THE CARD'S ADD: the tap that opens Add brings the list up, where the row has room; a row with none has the words in the list's place, and no list. */
    assert.match(editor, /const \[listUp, setListUp\] = useState\(false\)/)
    assert.match(editor, /setAddAfter\(opening \? `\$\{lane\.row\}:\$\{item\.col\}` : null\) setListUp\(opening && freeAfter\(lane, item\.col\) !== null\)/)
    assert.match(editor, /\{ title: `Add after \$\{item\.block\.name\}`, up: listUp, onUp: setListUp \}/)
    /* Only that tap, and the menu's own button, ever bring it up. */
    assert.equal((editor.match(/setListUp\(/g) || []).length, 1, 'something else brings a card’s list up')
    assert.equal((editor.match(/\bsetListUp\b/g) || []).length, 3, 'setListUp is handed somewhere this test does not know')

    /* THE OTHER WAY, under the chain: its own menu, which keeps itself, and says the block picked on its button. With ONE empty space the pick puts the block there (19 November 2026: a NAM picked twice on an AM4 and never placed); with several, each is offered right under the pick. */
    assert.ok(editor.includes("<Label>{EMPTY_SPACE}</Label> {blockMenu( (b) => { if (b.page === Number(choice)) return setChoice(null) setChoice(b.page) if (spaces.length === 1 && !busy) add(spaces[0].row, spaces[0].item.col, b.page) },"), 'the pick under the chain does something else')
    assert.ok(editor.includes("{ title: 'Pick a block', note: spaces.length === 1 ? 'It goes in the empty space.' : 'Then choose which empty space it goes in.', chosen: choice } )}"))
    assert.ok(editor.includes("const spaces = lanes.flatMap((lane) => laneItems(lane).filter((it) => it.kind === 'gap').map((item) => ({ row: lane.row, item })))"))
    assert.ok(editor.includes("{picked && spaces.length > 1 ? spaces.slice(0, 8).map((sp) => ( <Press key={`put${sp.row}:${sp.item.col}`} caption={whereGap(sp.row, sp.item)} label={`Put ${picked.name} here`} disabled={busy} height={48} onPress={() => add(sp.row, sp.item.col)} /> )) : null}"), 'the spaces are not offered under the pick')

    /* BOTH ARE THE ONE MENU, handed the unit's whole list, one of each kind, the find box's look and what a pick does; shut while the editor is sending. */
    assert.match(
      editor,
      /const blockMenu = \(onPick, hint, \{ title, note = hint, chosen = null, up = false, onUp = null \}\) => \( <View style=\{\{ gap: space\.sm \}\}> \{palette === null \? \( <Note>Asking your unit what it can add…<\/Note> \) : !palette\.length \? \( <Note tone="warn">Couldn’t read the list of blocks from your unit\.<\/Note> \) : \( <> <BlockMenu palette=\{palette\} kinds=\{kinds\} chosen=\{chosen\} title=\{title\} note=\{note\} fieldLook=\{findLook\} disabled=\{busy\} up=\{up\} onUp=\{onUp\} onPick=\{onPick\} \/> <Text style=\{\{ color: color\.silkDim, fontSize: font\.micro \}\}>\{hint\}<\/Text> <\/> \)\} <\/View> \)/
    )
    assert.equal((editor.match(/blockMenu\(/g) || []).length, 2, 'a third list of blocks somewhere')
    /* The wall of buttons is gone from the editor: no find box of its own, no button for every kind drawn into the page. */
    const chain = editor.slice(editor.indexOf('const kinds = nextOfEachKind('), editor.indexOf('function BlockCard('))
    assert.ok(chain.length > 2000, 'the editor was not found')
    assert.ok(!/paletteBox|offered\.map|<TextInput|setHunt|placeholder="Find a block"/.test(chain), 'the editor still draws its own find box or a button for every block')
    /* The find box's look is still the editor's, as main drew it, so Classic is held to it here. */
    assert.match(editor, /const findLook = \{ minHeight: TAP, paddingHorizontal: space\.md, borderWidth: 1, \.\.\.glassField\(\), color: color\.silk, fontSize: font\.body \}/)
  })
}
