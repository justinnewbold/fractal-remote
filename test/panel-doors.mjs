import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const flat = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')

/* The held block's doors on the big screen's knobs panel (mobile/src/components/PanelDoors.js). */
export function run(test) {
  test('panel doors: the knobs panel of a big screen has what the hold pop-up has, by the pop-up’s own hooks', () => {
    const doors = flat(read('mobile/src/components/PanelDoors.js'))
    /* The same three hooks the pop-up asks, so the same switches and the same rules for where each is offered. */
    assert.match(doors, /const library = useTone3000Door\(block, null\)/, 'TONE3000 is not asked for as the pop-up with knobs asks')
    assert.match(doors, /const ampSwap = useAmpSwap\(block\) && moves/)
    assert.match(doors, /const anySwap = useSwapBlock\(block, elsewhere\) && moves/)
    const stage = flat(read('mobile/src/screens/Stage.js'))
    for (const hook of ['useTone3000Door', 'useAmpSwap', 'useSwapBlock']) assert.match(stage, new RegExp(`\\b${hook}\\(`), `the pop-up no longer asks ${hook}: the two have drifted`)
    /* TONE3000's page takes the knobs' place, and a Get marks the preset changed so the panel's Save comes up. */
    assert.match(doors, /if \(browsing && library\.offered\) \{ return \{ page: \( <Tone3000InPop id=\{library\.id\} n=\{library\.n\} from=\{library\.from\}/)
    assert.match(doors, /useEffect\(\(\) => \{ if \(came\) noteEdited\(\) \}, \[came\]\)/)
    /* A swap hands the new block to the app's own hold, and an amp's opens on the NAM block's captures. */
    assert.match(doors, /onSwapped=\{\(id\) => \{ straight = id onMove\(id\) \}\}/)
    assert.match(doors, /const open = straight !== null && straight === library\.id if \(library\.id !== null\) straight = null setBrowsing\(open\)/)
    assert.match(doors, /<SwapBlockDoor key=\{block \? idOf\(block\) : 'none'\} block=\{block\} blocks=\{blocks\} onSwapped=\{\(id\) => onMove\(id\)\} \/>/)
    /* Nothing of its own reaches a unit. */
    assert.doesNotMatch(doors, /setParam|setEnum|placeBlock|clearCell|setCable|remoteRequest|namPickHere|writeChannel/)
  })

  test('panel doors: the panel draws them over and under Edit’s block view, and the app and Play hand it the hold to move by', () => {
    const side = flat(read('mobile/src/components/BlockSide.js'))
    assert.match(side, /const doors = usePanelDoors\(block, \{ blocks, elsewhere: chainNow\.elsewhere, onMove \}\)/)
    assert.match(side, /\{doors\.over\} \{doors\.page \? \( doors\.page \) : block \? \( <BlockPanel/, 'the doors are not over the knobs, or TONE3000’s page does not take their place')
    assert.match(side, /\{doors\.under\} <Text[^>]*>\{PANEL_FOOT\}<\/Text>/)
    assert.match(flat(read('mobile/App.js')), /<BlockSide eid=\{blockAt\} onClose=\{closeBlock\} onMove=\{holdBlock\} \/>/)
    assert.match(flat(read('mobile/src/screens/Stage.js')), /<BlockSide eid=\{knobsAt\} onClose=\{onCloseKnobs\} onScrollLock=\{setKnobHeld\} onMove=\{onHoldBlock\} \/>/)
    /* A name in small letters gets its capital; any other is left as it came. */
    const m = read('mobile/src/components/BlockSide.js').match(/const titled = (\(name\) => .*)\n/)
    assert.ok(m, 'the panel’s title rule moved')
    // eslint-disable-next-line no-new-func
    const titled = new Function(`return ${m[1]}`)()
    assert.equal(titled('amp'), 'Amp')
    assert.equal(titled('NAM'), 'NAM')
    assert.equal(titled('Amp 1'), 'Amp 1')
    assert.equal(titled(''), '')
    assert.equal(titled(undefined), '')
  })
}
