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
    const caps = { grid: { rows: 6, cols: 14 } }
    assert.equal(lanesFor([], caps).length, 6)
    assert.equal(lanesFor([], caps)[0].gaps.length, 14)
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
    /*
     * No room: why, and WHAT WOULD WORK, which is not the same everywhere.
     * "Remove a block first" was said after the last slot of an AM4, where
     * taking one out makes no room after it: so removing is offered only
     * where a block after the card can be removed, and the editor's other
     * way to add only where it has somewhere to put a block.
     */
    assert.equal(c.noRoomAfter({ name: 'Vocoder', more: true, elsewhere: true }), 'This row is full after Vocoder, so a block can’t be added here. Remove a block after it first, or use “Put a block in an empty space”, under the chain, to add one where there is room.')
    assert.equal(c.noRoomAfter({ name: 'Comp 2', elsewhere: true }), 'There is no room after Comp 2 in its row, so a block can’t be added here. Use “Put a block in an empty space”, under the chain, to add one where there is room.')
    assert.equal(c.noRoomAfter({ name: 'Vocoder', more: true }), 'This row is full after Vocoder, so a block can’t be added here. Remove a block after it first.')
    assert.equal(c.noRoomAfter({ name: 'Comp 2' }), 'There is no room after Comp 2 in its row, so a block can’t be added here. Nothing else is free either: remove a block first, then use “Put a block in an empty space”, under the chain.')
    assert.equal(c.noRoomAfter({ name: 'Drive', linear: true, more: true, elsewhere: true }), 'There is no free slot after Drive. Remove a block after it first, or use “Put a block in an empty space”, under the chain, to add one where there is room.')
    assert.equal(c.noRoomAfter({ name: 'Drive', linear: true, more: true }), 'There is no free slot after Drive. Remove a block after it first.')
    assert.equal(c.noRoomAfter({ name: 'Delay', linear: true, elsewhere: true }), 'There is no free slot after Delay. Use “Put a block in an empty space”, under the chain, to add one where there is room.')
    assert.equal(c.noRoomAfter({ name: 'Delay', linear: true }), 'There is no free slot after Delay. Nothing else is free either: remove a block first, then use “Put a block in an empty space”, under the chain.')
    /* An AM4 with a block in its last slot: none after it can be taken out, whatever else is in the chain. */
    const am4 = lanesFor([{ row: 0, col: 0, name: 'Amp', slug: 'amp' }, { row: 0, col: 2, name: 'Drive', slug: 'drive' }, { row: 0, col: 3, name: 'Delay', slug: 'delay' }], { grid: { rows: 1, cols: 4 } })
    assert.equal(am4.length, 1)
    assert.equal(c.freeAfter(am4[0], 3), null)
    assert.equal(c.removableAfter(am4[0], 3), false)
    assert.equal(c.roomAnywhere(am4), true)
    assert.doesNotMatch(c.noRoomAfter({ name: 'Delay', linear: true, more: c.removableAfter(am4[0], 3), elsewhere: c.roomAnywhere(am4) }), /[Rr]emove/)
    assert.equal(c.roomAnywhere(lanesFor(row.filter((b) => b.row === 2), { grid: { rows: 3, cols: 14 } }).filter((l) => l.row === 2)), false)
    assert.equal(c.roomAnywhere([{ gaps: [] }, { gaps: ['x', null] }]), false)
    assert.equal(c.roomAnywhere([{ gaps: [] }, { gaps: [4] }]), true)
    for (const none of [null, undefined, []]) assert.equal(c.roomAnywhere(none), false)

    assert.equal(c.addedWords('Wah 1', 'row 3, column 12'), '✓ Added Wah 1 at row 3, column 12.')
    /* A block that was in the chain already was MOVED (a unit has one of each): "Added" would be a second one that is not there. And a cell that holds some other block is not a tick at all. */
    assert.equal(c.movedWords('Drive 1', 'row 3, column 12', 'row 3, column 3'), '✓ Drive 1 is at row 3, column 12 now. It was at row 3, column 3: the unit has one Drive 1, so it moved.')
    assert.equal(c.otherWords('Wah 1', 'row 3, column 12', 'row 2, column 4'), 'row 3, column 12 holds another block, and the unit has Wah 1 at row 2, column 4. Nothing was added there.')

    /*
     * WHAT AN ADD CAME TO, off the read after it. The cell is asked first:
     * a first cut asked where the unit had the block and took the first
     * place it found, which with the block listed twice (the demo lists a
     * moved block in both places) was the old one, and "holds another
     * block" was said under the new block's own card.
     */
    const is = (b) => b.id === 118
    const wah = (row, col) => ({ row, col, id: 118 })
    const amp = (row, col) => ({ row, col, id: 37 })
    assert.deepEqual(c.addOutcome({ blocks: [amp(2, 0), wah(2, 11)], is, row: 2, col: 11 }), { kind: 'added', put: null })
    /* Nothing in the cell: where the unit has it instead, if anywhere, and whether that is only where it always was. */
    assert.deepEqual(c.addOutcome({ blocks: [amp(2, 0)], is, row: 2, col: 11 }), { kind: 'empty', put: null, stayed: false })
    assert.deepEqual(c.addOutcome({ blocks: [amp(2, 0), wah(1, 11)], is, row: 2, col: 11 }), { kind: 'empty', put: wah(1, 11), stayed: false })
    assert.deepEqual(c.addOutcome({ blocks: [amp(2, 0), wah(2, 3)], is, row: 2, col: 11, was: { row: 2, col: 3 } }), { kind: 'empty', put: wah(2, 3), stayed: true })
    assert.deepEqual(c.addOutcome({ blocks: [amp(2, 0), wah(1, 5)], is, row: 2, col: 11, was: { row: 2, col: 3 } }), { kind: 'empty', put: wah(1, 5), stayed: false })
    /* Some other block in the cell, and this one elsewhere: no tick. */
    assert.deepEqual(c.addOutcome({ blocks: [amp(2, 11), wah(2, 3)], is, row: 2, col: 11 }), { kind: 'other', put: wah(2, 3) })
    /* A block in the cell and this one's id nowhere in the read: the read carries no id to go by, and the cell holding a block is all there is. */
    assert.deepEqual(c.addOutcome({ blocks: [amp(2, 11)], is, row: 2, col: 11 }), { kind: 'added', put: null })
    /* It was in the chain, and is gone from there: moved. Still listed there too (two on the screen): added, never "moved", never "another block". */
    assert.deepEqual(c.addOutcome({ blocks: [amp(2, 0), wah(2, 11)], is, row: 2, col: 11, was: { row: 2, col: 3 } }), { kind: 'moved', put: null })
    assert.deepEqual(c.addOutcome({ blocks: [wah(2, 3), amp(2, 0), wah(2, 11)], is, row: 2, col: 11, was: { row: 2, col: 3 } }), { kind: 'added', put: null })
    assert.deepEqual(c.addOutcome({ blocks: [amp(2, 0), wah(2, 11)], is, row: 2, col: 11, was: { row: 2, col: 11 } }), { kind: 'added', put: null }, 'a block put where it already was is not a move')
    /* It was in the chain, and the read after has it nowhere, with some block in the cell: not "moved", which is said of a block seen where it went. */
    assert.deepEqual(c.addOutcome({ blocks: [amp(2, 11)], is, row: 2, col: 11, was: { row: 2, col: 3 } }), { kind: 'added', put: null })
    for (const none of [null, undefined, 'x']) assert.deepEqual(c.addOutcome({ blocks: none, is, row: 0, col: 0 }), { kind: 'empty', put: null, stayed: false })

    /* A note for a cell that is now part of a run of empty spaces is under that run: a cell just emptied joins the run beside it, drawn as one button named by its first column. */
    assert.equal(c.saidInRun('2:3', 2, 3, 3), true)
    assert.equal(c.saidInRun('2:4', 2, 3, 6), true)
    assert.equal(c.saidInRun('2:6', 2, 3, 6), true)
    assert.equal(c.saidInRun('2:7', 2, 3, 6), false)
    assert.equal(c.saidInRun('2:2', 2, 3, 6), false)
    assert.equal(c.saidInRun('1:4', 2, 3, 6), false)
    for (const none of [null, undefined, '', 'x', '2', '2:x']) assert.equal(c.saidInRun(none, 2, 3, 6), false)
    assert.equal(c.NOT_SENT, 'not sent: no free space after it in this row')
    for (const said of [c.addHint({ name: 'X', at: 'row 1, column 2', col: 0, free: 1 }), c.addHint({ name: 'X', at: 'row 1, column 3', col: 0, free: 2 }), c.noRoomAfter({ name: 'X', more: true }), c.noRoomAfter({ name: 'X' }), c.noRoomAfter({ name: 'X', linear: true }), c.noRoomAfter({ name: 'X', more: true, elsewhere: true }), c.noRoomAfter({ name: 'X', linear: true, elsewhere: true }), c.addedWords('X', 'slot 2'), c.movedWords('X', 'slot 2', 'slot 1'), c.otherWords('X', 'slot 2', 'slot 1')])
      assert.ok(!/this phone|\bbeta\b|\bsoon\b|coming|tried|official|undefined|null/i.test(said), said)
  })

  test('chain add: the editor says it under the card that was tapped, draws no list where nothing can be added, and writes down an Add that sends nothing', async () => {
    const c = await lib()
    const editor = flat(code(read('mobile/src/screens/Edit.js')))
    assert.match(editor, /import \{ addedWords, addHint, addOutcome, EMPTY_SPACE, freeAfter, movedWords, noRoomAfter, NOT_SENT, otherWords, removableAfter, roomAnywhere, saidInRun \} from '\.\.\/lib\/chainAdd'/)

    /* The other way to add is named by its own heading, so the words that point at it cannot drift from it. */
    assert.match(editor, /<Label>\{EMPTY_SPACE\}<\/Label>/)
    assert.equal(c.EMPTY_SPACE, 'Put a block in an empty space')

    /* NO ROOM: the words in the list's place. The list of blocks is drawn only where a tapped one has somewhere to go, and its line says where. */
    assert.match(
      editor,
      /adding=\{ addAfter !== `\$\{lane\.row\}:\$\{item\.col\}` \? null : freeAfter\(lane, item\.col\) === null \? \( <Note tone="warn">\{noRoomAfter\(\{ name: item\.block\.name, linear, more: removableAfter\(lane, item\.col\), elsewhere: roomAnywhere\(lanes\) \}\)\}<\/Note> \) : \( blockMenu\( \(b\) => addAfterCard\(lane, item\.col, b\.page, item\.block\.name\), addHint\(\{ name: item\.block\.name, at: where\(lane\.row, freeAfter\(lane, item\.col\)\), col: item\.col, free: freeAfter\(lane, item\.col\) \}\), \{ title: `Add after \$\{item\.block\.name\}`, up: listUp, onUp: setListUp \} \) \) \}/
    )
    assert.doesNotMatch(editor, /put it right after \$\{/, 'the list still says "right after" wherever the block goes')
    assert.doesNotMatch(editor, /No free space after/, 'the old line, said only over the chain, is still there')

    /* SAID UNDER THE CARD: one thing at a time, by the card's own place, drawn whether or not its buttons are open, with a cross. */
    assert.match(editor, /const \[told, setTold\] = useState\(null\)/)
    assert.match(editor, /note=\{told && told\.at === `\$\{lane\.row\}:\$\{item\.col\}` \? told : null\} onNoteDismiss=\{\(\) => setTold\(null\)\}/)
    assert.match(editor, /<Told note=\{note\} onDismiss=\{onNoteDismiss\} \/> \{acting && adding \? adding : null\}/)
    assert.match(editor, /function Told\(\{ note, onDismiss \}\) \{ if \(!note\) return null return \( <Note tone=\{note\.tone === 'ok' \? 'hint' : 'warn'\} strong=\{note\.tone === 'ok'\} onDismiss=\{onDismiss\}> \{note\.text\} <\/Note> \) \}/)
    /* And under an EMPTY SPACE that was tapped: a block the unit would not put there has no card to be said under. */
    assert.match(editor, /onPress=\{\(\) => add\(lane\.row, item\.col\)\} \/> <Told note=\{told && saidInRun\(told\.at, lane\.row, item\.col, item\.last\) \? told : null\} onDismiss=\{\(\) => setTold\(null\)\} \/>/)

    /* An Add from a card is said under THAT card; one into an empty space, under the new block's own. */
    assert.match(editor, /const add = async \(row, col, page = choice, from = null\) => \{ if \(page === null \|\| page === undefined\) return chainUndo\.clear\(\) setBusy\(true\) setIssue\(null\) setTold\(null\) const under = from \|\| `\$\{row\}:\$\{col\}` const name = \(palette \|\| \[\]\)\.find\(\(b\) => b\.page === Number\(page\)\)\?\.name \|\| 'the block' const was = placeOf\(Number\(page\)\) beginChainWrite\(\)/)
    assert.match(editor, /add\(lane\.row, free, page, `\$\{lane\.row\}:\$\{col\}`\)/)
    /*
     * THE TICK IS FOR THE BLOCK THAT WAS ASKED FOR, by the read after the
     * write, and the rule is lib/chainAdd's (run whole, above): the editor
     * hands it the read, the unit's own id for the block, the cell and
     * where the block was before, and says each answer as what it is, under
     * the card or the space too.
     */
    assert.match(editor, /const got = addOutcome\(\{ blocks: getState\(\)\.allBlocks, is: \(b\) => idOf\(b\) === Number\(page\), row, col, was \}\) if \(got\.kind === 'empty'\) \{/)
    assert.match(editor, /!got\.put \? '' : got\.stayed \? ` \$\{name\} is still at \$\{where\(got\.put\.row, got\.put\.col\)\}\.` : ` The unit put it at \$\{where\(got\.put\.row, got\.put\.col\)\} instead\.`/)
    assert.match(editor, /setIssue\(words\) setTold\(\{ at: under, tone: 'warn', text: words \}\) \} else if \(got\.kind === 'other'\) \{/)
    assert.match(editor, /const words = otherWords\(name, where\(row, col\), where\(got\.put\.row, got\.put\.col\)\) setIssue\(words\) setTold\(\{ at: under, tone: 'warn', text: words \}\) \} else \{/)
    /* Done is said under the card Add was tapped on, unless that card has just left its cell (its own block moved): then under the block where it is now. */
    assert.match(editor, /const gone = from && !holds\(\.\.\.from\.split\(':'\)\.map\(Number\)\) setTold\(\{ at: gone \? `\$\{row\}:\$\{col\}` : under, tone: 'ok', text: got\.kind === 'moved' \? movedWords\(name, where\(row, col\), where\(was\.row, was\.col\)\) : addedWords\(name, where\(row, col\)\) \}\)/)
    assert.match(editor, /setIssue\(err\.message\) setTold\(\{ at: under, tone: 'warn', text: err\.message \}\) onError\(err\.message\)/)
    /* A block the unit would not take out, and a remove that failed, are said under that block's own card as well. */
    assert.match(editor, /setIssue\(words\) setTold\(\{ at: `\$\{row\}:\$\{col\}`, tone: 'warn', text: words \}\) \} else if \(putBack\)/)
    assert.match(editor, /setIssue\(err\.message\) setTold\(\{ at: `\$\{row\}:\$\{col\}`, tone: 'warn', text: err\.message \}\) onError\(err\.message\)/)

    /* IN THE LOG: an Add opened where there is no room, and (a row that filled since) a block tapped that was not sent. */
    assert.match(editor, /if \(opening && freeAfter\(lane, item\.col\) === null\) logDebug\('chain', `Add after \$\{item\.block\?\.name\} at \$\{where\(lane\.row, item\.col\)\}`, NOT_SENT\)/)
    assert.match(editor, /if \(free === null\) \{ const words = noRoomAfter\(\{ name, linear, more: removableAfter\(lane, col\), elsewhere: roomAnywhere\(lanes\) \}\) logDebug\('chain', `add block \$\{page\} after \$\{where\(lane\.row, col\)\}`, NOT_SENT\) setIssue\(words\) setTold\(\{ at: `\$\{lane\.row\}:\$\{col\}`, tone: 'warn', text: words \}\) return \}/)

    /* What was said is put away when something else is done: another card tapped, an Add opened, a write begun. */
    assert.match(editor, /setAddAfter\(null\) setTold\(null\) \}\}/)
    assert.match(editor, /setTold\(null\) setAddAfter\(opening \? `\$\{lane\.row\}:\$\{item\.col\}` : null\)/)
    assert.ok(editor.match(/setIssue\(null\) setTold\(null\)/g).length >= 3, 'a move or a remove leaves the last Add’s line standing')
  })
}
