/**
 * ADD, FROM A BLOCK'S CARD IN THE CHAIN EDITOR (mobile/src/lib/chainAdd.js,
 * and the editor in mobile/src/screens/Edit.js).
 *
 * "Not sure if it added the block it was trying to add here. No
 * confirmation after I clicked add. Check the logs" (Justin, 15 November
 * 2026). His log had three taps on a block to add and nothing after any of
 * them: the row was full after the card he had tapped, the editor said so
 * in its one line over the chain, a dozen cards up and off the screen, and
 * wrote nothing down.
 *
 * What these hold: where a block added from a card goes; that a row with no
 * room says so IN THE LIST'S PLACE, before anything is tapped; that what an
 * Add did is said under the card it was tapped on; and that an Add that
 * sends nothing is in the log.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const flat = (s) => s.replace(/\s+/g, ' ')
const lib = () => import('../mobile/src/lib/chainAdd.js')

export function run(test) {
  test('chain add: a block added from a card goes in the first free space after it, and a row with none says so', async () => {
    const c = await lib()
    const { lanesFor } = await import('../mobile/src/lib/grid-plan.js')

    assert.equal(c.freeAfter({ gaps: [1, 5, 9] }, 2), 5)
    assert.equal(c.freeAfter({ gaps: [9, 5, 1] }, 2), 5, 'the first free space is the nearest one, however the gaps are listed')
    assert.equal(c.freeAfter({ gaps: [1, 5, 9] }, 5), 9, 'the card’s own column is not after it')
    assert.equal(c.freeAfter({ gaps: [1, 2] }, 2), null, 'a free space BEFORE the card is not one after it')
    assert.equal(c.freeAfter({ gaps: [] }, 0), null)
    assert.equal(c.freeAfter({ gaps: ['7', 6.5, null] }, 2), null)
    for (const none of [null, undefined, {}]) assert.equal(c.freeAfter(none, 0), null)

    /*
     * HIS ROW: an Axe-Fx III's fourteen columns, every one taken, the Output
     * in the last. Add on the block in column 9 and on the one in column 13
     * (as the editor counts them), as he tapped them.
     */
    const caps = { gridRows: 6, gridCols: 14, gridRouting: true }
    const names = ['Input 1', 'Comp 1', 'Drive 1', 'Amp 1', 'Dyn Dist', 'Tone Match', 'NAM 1', 'NAM 2', 'Vocoder', 'IR Player 1', 'Rotary 1', 'Reverb 1', 'Comp 2', 'Output 1']
    const row = names.map((name, col) => ({ row: 2, col, name, slug: col === 0 ? 'input' : col === 13 ? 'output' : 'amp', effectId: 100 + col }))
    const lane = lanesFor(row, caps).find((l) => l.row === 2)
    assert.equal(lane.blocks.length, 14)
    assert.equal(c.freeAfter(lane, 8), null)
    assert.equal(c.freeAfter(lane, 12), null)
    assert.equal(c.removableAfter(lane, 8), true)
    assert.equal(c.removableAfter(lane, 12), false, 'the Output was counted as a block that could be taken out to make room')
    assert.equal(c.removableAfter({ blocks: [{ col: 0, slug: 'input' }, { col: 1, slug: 'amp' }] }, 1), false)
    assert.equal(c.removableAfter(null, 0), false)
    /* One block taken out further along, and there is room: in that space, not "right after". */
    const freed = lanesFor(row.filter((b) => b.col !== 11), caps).find((l) => l.row === 2)
    assert.equal(c.freeAfter(freed, 8), 11)
    assert.equal(c.freeAfter(freed, 10), 11)
    assert.equal(c.freeAfter(freed, 12), null)

    /* THE WORDS. Where it will go, said before the tap: "right after" only where it is. */
    assert.equal(c.addHint({ name: 'Rotary 1', at: 'row 3, column 12', col: 10, free: 11 }), 'Tap a block to put it right after Rotary 1.')
    assert.equal(c.addHint({ name: 'Vocoder', at: 'row 3, column 12', col: 8, free: 11 }), 'Tap a block to put it at row 3, column 12, the first free space after Vocoder.')
    /* No room: why, and what to do, in each of the three cases. */
    assert.equal(c.noRoomAfter({ name: 'Vocoder', more: true }), 'This row is full after Vocoder, so a block can’t be added here. Remove a block after it first, or use “Put a block in an empty space”, under the chain, to add one where there is room.')
    assert.equal(c.noRoomAfter({ name: 'Comp 2' }), 'There is no room after Comp 2 in its row, so a block can’t be added here. Use “Put a block in an empty space”, under the chain, to add one where there is room.')
    assert.equal(c.noRoomAfter({ name: 'Delay', linear: true, more: true }), 'There is no free slot after Delay. Remove a block first.')
    assert.equal(c.noRoomAfter({ name: 'Delay', linear: true }), 'There is no free slot after Delay. Remove a block first.')
    assert.equal(c.addedWords('Wah 1', 'row 3, column 12'), '✓ Added Wah 1 at row 3, column 12.')
    assert.equal(c.NOT_SENT, 'not sent: no free space after it in this row')
    for (const said of [c.addHint({ name: 'X', at: 'row 1, column 2', col: 0, free: 1 }), c.addHint({ name: 'X', at: 'row 1, column 3', col: 0, free: 2 }), c.noRoomAfter({ name: 'X', more: true }), c.noRoomAfter({ name: 'X' }), c.noRoomAfter({ name: 'X', linear: true }), c.addedWords('X', 'slot 2')])
      assert.ok(!/this phone|\bbeta\b|\bsoon\b|coming|tried|official|undefined|null/i.test(said), said)
  })

  test('chain add: the editor says it under the card that was tapped, draws no list where nothing can be added, and writes down an Add that sends nothing', async () => {
    const c = await lib()
    const editor = flat(code(read('mobile/src/screens/Edit.js')))
    assert.match(editor, /import \{ addedWords, addHint, EMPTY_SPACE, freeAfter, noRoomAfter, NOT_SENT, removableAfter \} from '\.\.\/lib\/chainAdd'/)

    /* The other way to add is named by its own heading, so the words that point at it cannot drift from it. */
    assert.match(editor, /<Label>\{EMPTY_SPACE\}<\/Label>/)
    assert.equal(c.EMPTY_SPACE, 'Put a block in an empty space')

    /* NO ROOM: the words in the list's place. The list of blocks is drawn only where a tapped one has somewhere to go, and its line says where. */
    assert.match(
      editor,
      /adding=\{ addAfter !== `\$\{lane\.row\}:\$\{item\.col\}` \? null : freeAfter\(lane, item\.col\) === null \? \( <Note tone="warn">\{noRoomAfter\(\{ name: item\.block\.name, linear, more: removableAfter\(lane, item\.col\) \}\)\}<\/Note> \) : \( paletteBox\( \(b\) => addAfterCard\(lane, item\.col, b\.page, item\.block\.name\), addHint\(\{ name: item\.block\.name, at: where\(lane\.row, freeAfter\(lane, item\.col\)\), col: item\.col, free: freeAfter\(lane, item\.col\) \}\) \) \) \}/
    )
    assert.doesNotMatch(editor, /put it right after \$\{/, 'the list still says "right after" wherever the block goes')
    assert.doesNotMatch(editor, /No free space after/, 'the old line, said only over the chain, is still there')

    /* SAID UNDER THE CARD: one thing at a time, by the card's own place, drawn whether or not its buttons are open, with a cross. */
    assert.match(editor, /const \[told, setTold\] = useState\(null\)/)
    assert.match(editor, /note=\{told && told\.at === `\$\{lane\.row\}:\$\{item\.col\}` \? told : null\} onNoteDismiss=\{\(\) => setTold\(null\)\}/)
    assert.match(editor, /\{note \? \( <Note tone=\{note\.tone === 'ok' \? 'hint' : 'warn'\} strong=\{note\.tone === 'ok'\} onDismiss=\{onNoteDismiss\}> \{note\.text\} <\/Note> \) : null\} \{acting && adding \? adding : null\}/)

    /* An Add from a card is said under THAT card; one into an empty space, under the new block's own. */
    assert.match(editor, /const add = async \(row, col, page = choice, from = null\) => \{ if \(page === null \|\| page === undefined\) return chainUndo\.clear\(\) setBusy\(true\) setIssue\(null\) setTold\(null\) const under = from \|\| `\$\{row\}:\$\{col\}` const name = \(palette \|\| \[\]\)\.find\(\(b\) => b\.page === Number\(page\)\)\?\.name \|\| 'the block'/)
    assert.match(editor, /add\(lane\.row, free, page, `\$\{lane\.row\}:\$\{col\}`\)/)
    assert.match(editor, /onPress=\{\(\) => add\(lane\.row, item\.col\)\}/)
    /* Done only where the unit holds the block, by the read after the write; else what the unit did, under the card too. */
    assert.match(editor, /setIssue\(words\) if \(from\) setTold\(\{ at: from, tone: 'warn', text: words \}\) \} else setTold\(\{ at: under, tone: 'ok', text: addedWords\(name, where\(row, col\)\) \}\)/)
    assert.match(editor, /if \(!holds\(row, col\)\) \{ const put = placeOf\(Number\(page\)\)/)
    assert.match(editor, /setIssue\(err\.message\) if \(from\) setTold\(\{ at: from, tone: 'warn', text: err\.message \}\) onError\(err\.message\)/)
    /* A block the unit would not take out is said under its own card as well. */
    assert.match(editor, /setIssue\(words\) setTold\(\{ at: `\$\{row\}:\$\{col\}`, tone: 'warn', text: words \}\) \} else if \(putBack\)/)

    /* IN THE LOG: an Add opened where there is no room, and (a row that filled since) a block tapped that was not sent. */
    assert.match(editor, /if \(opening && freeAfter\(lane, item\.col\) === null\) logDebug\('chain', `Add after \$\{item\.block\?\.name\} at \$\{where\(lane\.row, item\.col\)\}`, NOT_SENT\)/)
    assert.match(editor, /if \(free === null\) \{ const words = noRoomAfter\(\{ name, linear, more: removableAfter\(lane, col\) \}\) logDebug\('chain', `add block \$\{page\} after \$\{where\(lane\.row, col\)\}`, NOT_SENT\) setIssue\(words\) setTold\(\{ at: `\$\{lane\.row\}:\$\{col\}`, tone: 'warn', text: words \}\) return \}/)

    /* What was said is put away when something else is done: another card tapped, an Add opened, a write begun. */
    assert.match(editor, /setAddAfter\(null\) setTold\(null\) \}\}/)
    assert.match(editor, /setTold\(null\) setAddAfter\(opening \? `\$\{lane\.row\}:\$\{item\.col\}` : null\)/)
    assert.ok(editor.match(/setIssue\(null\) setTold\(null\)/g).length >= 3, 'a move or a remove leaves the last Add’s line standing')
  })
}
