/**
 * THE TIDIER EDIT, AND THE HANDLE ON THE LINE BETWEEN THE TWO SIDES
 * (mobile/src/lib/tidyEdit.js, lib/sidesSplit.js, lib/useTidyEdit.js,
 * lib/useSidesSplit.js, lib/sidesKeep.js, components/SidesHandle.js,
 * components/Sides.js, components/SidesLead.js, screens/Edit.js, App.js).
 *
 * "What do you think we can do to make this more intuitive it just feels a
 * little clunky still and what can we do to improve the edit screen to make
 * it more like the real ax edit software" (Justin, 9 November 2026), and
 * "We want as many knobs visible in edit" with his yes to "a handle on the
 * line between the halves: tap it to swap, drag it to resize, drag it to
 * the edge for full screen" (10 November 2026).
 *
 * His account until features TIDY_EDIT_FOR_EVERYONE opens it; closed to an
 * account, Edit and the two sides are what they were. The two rule files
 * import nothing and are run as they are; the rest is read for how it is
 * wired.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/* Comments out, so a check reads the code and not its explanation. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

/** lib/tidyEdit, lib/sidesSplit and lib/twoSides, each run from a copy: none imports anything. */
async function rules() {
  const dir = mkdtempSync(join(tmpdir(), 'tidy-edit-'))
  try {
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    const out = {}
    for (const f of ['tidyEdit', 'sidesSplit', 'twoSides']) {
      const src = read(`mobile/src/lib/${f}.js`)
      assert.doesNotMatch(src, /^import /m, `lib/${f} imports something; this check runs it on its own`)
      writeFileSync(join(dir, `${f}.js`), src)
      Object.assign(out, await import(pathToFileURL(join(dir, `${f}.js`)).href))
    }
    return out
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  test('tidier Edit: the knobs are as many across as the panel takes, three on a phone and eight at most', async () => {
    const r = await rules()
    const gap = 12
    /* The panel is the page less its 16 points each side. */
    const across = (page) => r.knobsAcross(page - 32, gap)
    assert.equal(across(393), 3, 'an iPhone held upright')
    assert.equal(across(440), 3, 'an iPhone Pro Max held upright: a fourth would be under 96 points')
    assert.equal(across(392), 3, 'the narrower side of an opened Duo')
    assert.equal(across(475), 4, 'the wider side of an opened Duo')
    assert.equal(across(416), 3, 'half a Pro Max on its side')
    assert.equal(across(590), 5, 'half an 11-inch iPad on its side: the picture’s five')
    assert.equal(across(820), 7, 'an 11-inch iPad held upright')
    assert.equal(across(1180), 8, 'the whole of an 11-inch iPad on its side: the picture’s eight')
    assert.equal(across(1366), 8, 'never more than eight, however wide')
    /* Nothing measured: what Edit always drew, and a cell that keeps its old share of the row. */
    assert.equal(r.knobsAcross(0), r.KNOBS_LEAST)
    assert.equal(r.knobsAcross(undefined), 3)
    assert.equal(r.knobCell(0), 0)
    assert.equal(r.knobSize(0), 64, 'an unmeasured panel draws Edit’s own knob')
    /* Over every width: the row is filled and never overflowed, no cell is under the least once four fit, and the knob is never wider than its cell. */
    for (let w = 200; w <= 1400; w += 7) {
      const cols = r.knobsAcross(w, gap)
      const cell = r.knobCell(w, gap)
      assert.ok(cols >= r.KNOBS_LEAST && cols <= r.KNOBS_MOST, `${w}: ${cols} across`)
      assert.ok(cols * cell + (cols - 1) * gap <= w, `${w}: ${cols} cells of ${cell} overflow the row`)
      assert.ok(cols * (cell + 1) + (cols - 1) * gap > w, `${w}: the cells leave more than a point each`)
      if (cols > r.KNOBS_LEAST) assert.ok(cell >= r.KNOB_CELL_LEAST, `${w}: ${cols} across at ${cell}, under the least`)
      if (cols < r.KNOBS_MOST) assert.ok(r.knobCell(w, gap) < 2 * r.KNOB_CELL_LEAST + gap, `${w}: room for another knob was left`)
      const knob = r.knobSize(cell)
      assert.ok(knob >= 56 && knob <= 84 && knob <= Math.max(56, cell), `${w}: a ${knob}-point knob in a ${cell}-point cell`)
    }
    /* The model joins the block's row only where the panel is wide enough; under that it stays under the knobs, where his 9 November message put it. */
    assert.equal(r.headShape(361).model, false, 'a phone held upright')
    assert.equal(r.headShape(443).model, false, 'the Duo’s wider side')
    assert.equal(r.headShape(558).model, true, 'half an iPad on its side')
    assert.equal(r.headShape(1148).model, true)
    assert.equal(r.headShape(0).model, false, 'an unmeasured panel')
    assert.equal(r.HEAD_MODEL_AT, 520)
    assert.ok(r.HEAD_TALL < 44 && r.HEAD_TALL >= 36)
  })

  test('the handle: drawn only on a big screen beside a tool, and it resizes everywhere but a fold and the tuner’s column', async () => {
    const r = await rules()
    const yes = { allowed: true, big: true, tool: 'edit', full: false }
    assert.equal(r.handleOn(yes), true)
    assert.equal(r.handleOn({ ...yes, allowed: false }), false, 'an account it is closed to got the handle')
    assert.equal(r.handleOn({ ...yes, big: false }), false, 'a phone on its side, or one side, got the handle')
    assert.equal(r.handleOn({ ...yes, tool: null }), false, 'Play alone got the handle')
    assert.equal(r.handleOn({ ...yes, full: true }), false, 'a tool filling the window got the handle')
    for (const not of [undefined, null, 1, 'yes']) assert.equal(r.handleOn({ ...yes, allowed: not }), false, `allowed ${String(not)} counted as yes`)
    for (const tool of ['edit', 'setlists', 'presets', 'tuner', r.BLOCK]) assert.equal(r.handleOn({ ...yes, tool }), true, `${tool} beside Play has no handle`)
    assert.equal(r.handleOn(), false)

    const own = { least: r.SIDE_LEAST, narrowAt: r.TUNER_NARROW_AT }
    const ipad = { width: 1180, left: 0, right: 0 }
    const duo = { width: 867, left: 0, right: 84 }
    assert.equal(r.resizeOn({ ...ipad, tool: 'edit', ...own }), true, 'an iPad on its side')
    assert.equal(r.resizeOn({ ...ipad, tool: 'tuner', ...own }), false, 'the tuner’s narrow column was offered a resize')
    assert.equal(r.resizeOn({ width: 841, tool: 'tuner', ...own }), true, 'the tuner in half a Fold is a half like any other')
    assert.equal(r.resizeOn({ ...duo, tool: 'edit', ...own }), false, 'the Duo’s line left its fold')
    assert.equal(r.resizeOn({ ...duo, left: 84, right: 0, tool: 'edit', ...own }), false, 'the Duo turned over')
    assert.equal(r.foldHere(duo), true)
    assert.equal(r.foldHere(ipad), false)
    assert.equal(r.foldHere({ left: 62, right: 62 }), false, 'a phone on its side has the same down both sides: no fold')
    assert.equal(r.resizeOn({ width: 750, tool: 'edit', ...own }), false, 'no room to move the line in')
    assert.equal(r.resizeOn({ ...ipad, tool: null, ...own }), false)
    assert.equal(r.resizeOn(), false)
  })

  test('the handle: a drag keeps both sides at their least, lets a side go past it, and Play keeps its share through a swap', async () => {
    const r = await rules()
    const least = r.SIDE_LEAST
    const w = 1180
    for (const playOnRight of [true, false]) {
      const leftIs = playOnRight ? 'tool' : 'play'
      const rightIs = playOnRight ? 'play' : 'tool'
      const at = (x) => r.dragEnds({ width: w, x, playOnRight, least })
      /* In the middle: nothing lets go, and Play's share is its own side of the line. */
      const mid = at(700)
      assert.equal(mid.lets, null)
      assert.ok(Math.abs(mid.share - (playOnRight ? 480 : 700) / w) < 1e-9, `Play on the ${playOnRight ? 'right' : 'left'}: ${mid.share}`)
      /* Between a side's least and where it lets go: held at the least. */
      assert.equal(at(least - 1).lets, null)
      assert.ok(Math.abs(at(least - 40).share - (playOnRight ? w - least : least) / w) < 1e-9, 'the line went under the left side’s least')
      assert.ok(Math.abs(at(w - least + 40).share - (playOnRight ? least : w - least) / w) < 1e-9, 'the line went under the right side’s least')
      assert.equal(at(least - r.SPLIT_LETS_GO).lets, null, 'a side let go on the line, not past it')
      /* Past it: that side lets go. */
      assert.deepEqual(at(least - r.SPLIT_LETS_GO - 1), { lets: leftIs, share: null })
      assert.deepEqual(at(0), { lets: leftIs, share: null })
      assert.deepEqual(at(w - least + r.SPLIT_LETS_GO + 1), { lets: rightIs, share: null })
      assert.deepEqual(at(w + 500), { lets: rightIs, share: null }, 'a finger past the edge')
      /* And the widths the sides are then drawn at are that share, both ways round. */
      const drawn = r.sideWidths({ width: w, playOnRight, tool: 'edit', share: mid.share })
      assert.deepEqual(drawn, playOnRight ? { play: 480, tool: 700 } : { play: 700, tool: 480 })
      assert.deepEqual(r.sideWidths({ width: w, playOnRight: !playOnRight, tool: 'edit', share: mid.share }).play, drawn.play, 'a swap changed how wide Play is')
    }
    assert.deepEqual(r.dragEnds(), { lets: null, share: null })

    /* No share kept, or one that is not a share: the window's own split, exactly. */
    const own = r.sideWidths({ width: w, tool: 'edit' })
    for (const share of [null, undefined, 0, 1, -0.2, 1.5, NaN, 'half']) assert.deepEqual(r.sideWidths({ width: w, tool: 'edit', share }), own, `share ${String(share)} moved the line`)
    /* A share kept on a wider window never puts a side under its least on a narrower one. */
    for (const width of [760, 841, 1024, 1180, 1366]) {
      for (const share of [0.05, 0.3, 0.5, 0.7, 0.95]) {
        const s = r.sideWidths({ width, tool: 'edit', share })
        assert.ok(s.play >= least && s.tool >= least && s.play + s.tool === width, `${width} at ${share}: ${s.play} and ${s.tool}`)
        const c = r.clampShare(share, width, least)
        assert.ok(c * width >= least - 0.5 && (1 - c) * width >= least - 0.5, `${width}: a share of ${c} is under a least`)
      }
    }
    assert.equal(r.clampShare(null, w, least), null)
    assert.equal(r.clampShare(0.5, 600, least), null, 'a frame with no room for two sides kept a share')
    /* Never on a fold, whatever was kept: the Duo's sides are where the fold has them. */
    const duo = { width: 867, right: 84, tool: 'edit' }
    assert.deepEqual(r.sideWidths({ ...duo, share: 0.6 }), r.sideWidths(duo), 'the Duo’s line left its fold')
    /* Nor the tuner's narrow column. */
    assert.deepEqual(r.sideWidths({ width: w, tool: 'tuner', share: 0.6 }), r.sideWidths({ width: w, tool: 'tuner' }))
    /* And the top bar's reach follows the line. */
    assert.equal(r.leadReach({ width: w, tool: 'edit', share: 480 / w }), 700 + r.SWAP_WIDE / 2)
    assert.equal(r.leadReach({ width: w, tool: 'edit' }), 590 + r.SWAP_WIDE / 2)

    /* While a finger has it, the line is drawn anywhere in the frame, and says which side would go. */
    assert.equal(r.dragHolds({ width: w, line: 590, dx: 100 }), 100)
    assert.equal(r.dragHolds({ width: w, line: 590, dx: -9999 }), -590)
    assert.equal(r.dragHolds({ width: w, line: 590, dx: 9999 }), 590)
    assert.equal(r.dragLetsGo({ width: w, x: 590, least }), null)
    assert.equal(r.dragLetsGo({ width: w, x: least - r.SPLIT_LETS_GO - 1, least }), 'left')
    assert.equal(r.dragLetsGo({ width: w, x: w - least + r.SPLIT_LETS_GO + 1, least }), 'right')
  })

  test('tidier Edit and the handle: his account until the switch, and wired so everybody else’s Edit and sides are untouched', () => {
    const features = read('mobile/src/lib/features.js')
    assert.match(features, /^export const TIDY_EDIT_FOR_EVERYONE = false$/m, 'the tidier Edit is not behind its switch, or the switch is open before he has seen it')
    const hook = flat(read('mobile/src/lib/useTidyEdit.js'))
    assert.match(hook, /export const useTidyEdit = \(\) => \{ const his = useBluetoothAdmin\(\) return TIDY_EDIT_FOR_EVERYONE \|\| his \}/, 'the tidier Edit is open to somebody other than his account and the switch')

    /* EDIT: every tidy line is a branch beside the one that was there. */
    const edit = flat(read('mobile/src/screens/Edit.js'))
    assert.match(edit, /const tidy = useTidyEdit\(\) const nameOnPlay = tidy && beside/)
    assert.match(edit, /contentContainerStyle=\{\{ padding: space\.lg, gap: space\.lg, paddingBottom: space\.xxl \}\} \{\.\.\.\(tidy \? \{ contentContainerStyle: PAGE_TIDY \} : null\)\}/, 'the page’s own spacing is gone, or the tidier one is not laid over it')
    assert.match(edit, /\{nameOnPlay \? null : \( <Text numberOfLines=\{1\}/, 'the preset’s name is not left to Play beside it, or is dropped elsewhere')
    assert.match(edit, /\{nameOnPlay \|\| caps\?\.hasScenes === false \? null : \(/)
    const panel = edit.slice(edit.indexOf('export function BlockPanel('), edit.indexOf('function BlockColour('))
    assert.match(panel, /const tidyOn = useTidyEdit\(\) const \[wide, setWide\] = useState\(0\) const cell = tidyOn \? knobCell\(wide, space\.md\) : 0/)
    assert.match(panel, /const tidy = tidyOn && !panel && !bare && !knobless/, 'the block’s one row is drawn in Derek’s panel, the hold pop-up, or for a block with no knobs to read')
    assert.match(panel, /const modelUp = tidy && headShape\(wide\)\.model && models\.length > 0/)
    assert.match(panel, /<View style=\{\{ gap: space\.md \}\} \{\.\.\.\(tidyOn \? \{ onLayout: \(e\) => setWide\(Math\.round\(e\.nativeEvent\.layout\.width\)\) \} : null\)\}>/, 'the panel is measured for an account the tidier Edit is closed to, or not at all')
    /* The old rows stand aside only for `tidy`, and are otherwise word for word. */
    assert.match(panel, /\{panel \|\| tidy \? null : \( <View style=\{\{ flexDirection: 'row', alignItems: 'center', gap: space\.md, borderLeftWidth: 4, borderLeftColor: hue\.fill, paddingLeft: space\.md \}\} >/)
    assert.match(panel, /\{channels\?\.length > 1 && !tidy \? \( <View style=\{\{ flexDirection: 'row', gap: space\.sm \}\}>/)
    assert.match(panel, /height=\{tidy \? HEAD_TALL : 44\}/)
    assert.match(panel, /width: cell \|\| '30%'/, 'a knob’s cell is not its old share of the row where the tidier Edit is closed')
    assert.match(panel, /onScrollLock=\{onScrollLock\} \{\.\.\.\(cell \? \{ size: knobSize\(cell\) \} : null\)\} \/>/)
    assert.match(panel, /\{panel \|\| tidy \|\| \['input', 'output'\]\.includes\(block\.slug\) \? null : \( <Press label=\{unsure \? 'Turn it off' : engaged \? 'Engaged' : 'Bypassed'\}/)
    assert.match(panel, /\{models\.length && !modelUp \? \( <View style=\{\{ gap: space\.sm \}\}> <Press caption="Model"/)
    /* The one row has everything the rows it replaces had: the name, the channels (not during an Undo), the on/off (never on the chain's two ends), the model where it fits, and Color under the knobs. */
    const row = panel.slice(panel.indexOf('{tidy ? ( <View style={TIDY_HEAD}>'), panel.indexOf('{modelUp && picking ?'))
    assert.ok(row.length > 200, 'the block’s one row is not drawn')
    assert.match(row, /<Text accessibilityRole="header" numberOfLines=\{2\}[^>]*> \{block\.name\} <\/Text>/)
    assert.match(row, /\{modelUp \? \( <Press label=\{current\?\.name \|\| `\$\{models\.length\} to choose from`\}/)
    assert.match(row, /on=\{block\.channel === ch\}[\s\S]{0,200}disabled=\{!!restoring\} onPress=\{\(\) => pickChannel\(ch\)\}/)
    assert.match(row, /\{\['input', 'output'\]\.includes\(block\.slug\) \? null : \( <Press label=\{unsure \? 'Turn it off' : engaged \? 'On' : 'Off'\}[\s\S]{0,280}onPress=\{flip\}/)
    assert.match(panel, /const flip = \(\) => writeBlockBypass\(eid, engaged\)/)
    assert.match(panel, /\{modelUp && picking \? \( <View style=\{\{ gap: space\.sm \}\}>[\s\S]{0,200}\{modelList\} <\/View> \) : null\}/)
    assert.match(panel, /\{tidy && paintable\(block\.slug\) \? \( <View style=\{\{ alignSelf: 'flex-start' \}\}> <BlockColour slug=\{block\.slug\} \/> <\/View> \) : null\}/)
    /* One list of models, drawn in whichever place the button is. */
    assert.equal(panel.split('placeholder="Find a model"').length - 1, 1, 'the model list is written twice')
    assert.match(panel, /\{picking \? modelList : null\}/)

    /* THE HANDLE: App asks the rule, hands the share only on a big screen, and each thing the handle does is one App already had. */
    const app = flat(read('mobile/App.js'))
    assert.match(app, /const tidyAllowed = sidesAdmin \|\| \(sidesAllowed && TIDY_EDIT_FOR_EVERYONE\) const split = useSidesSplit\(\{ allowed: tidyAllowed, big \}\)/)
    assert.match(app, /const sideHandle = handleOn\(\{ allowed: tidyAllowed, big, tool: twoSidesUp \? sideTool : null, full: sideFull \}\) const sideShare = big \? split\.share : null/, 'a phone on its side is handed a dragged share, or the handle is not asked for by its rule')
    assert.match(app, /const sideLetsGo = \(which\) => \{ if \(which === 'play'\) return sideTool === BLOCK \? undefined : setSideFull\(true\) return sideTool === 'tuner' \? writeTuner\(false\) : sideTool === BLOCK \? closeBlock\(\) : closeSide\(\) \}/, 'a side let go does not do what its own Done, Stop tuner or Close does')
    assert.match(app, /onFull=\{setSideFull\} handle=\{sideHandle\} share=\{sideShare\} three=\{thirdUp \? third : null\}/)
    assert.match(app, /full: sideFull, share: sideShare \}\)/)
    assert.match(app, /handle=\{sideHandle\} share=\{sideShare\} onSwap=\{swapSides\} onSplitReset=\{split\.reset\} onShare=\{split\.set\} onLetGo=\{sideLetsGo\}/)
    assert.match(app, /<Edit onBack=\{closeSide\} jump=\{editJump\}[\s\S]{0,160}beside=\{playBeside\} \/>/)
    const sides = flat(read('mobile/src/components/Sides.js'))
    assert.match(sides, /handle = false, share = null, onSwap = null, onSplitReset = null, onShare = null, onLetGo = null,/)
    assert.match(sides, /\{handle && beside \? \( <SidesHandle line=\{playOnRight \? widths\.tool : widths\.play\} width=\{frame\?\.width \|\| 0\} resize=\{resizeOn\(\{ width: frame\?\.width, left: frame\?\.left, right: frame\?\.right, tool, least: SIDE_LEAST, narrowAt: TUNER_NARROW_AT \}\)\} moved=\{share !== null\}/)
    const lead = flat(read('mobile/src/components/SidesLead.js'))
    assert.match(lead, /\{handle \? \( <View style=\{\{ width: SWAP_WIDE \}\} \/> \) : \( <Press label=\{SIDE_WORDS\.swap\}/, 'Swap is drawn twice where the handle is, or its room is not kept')
    assert.match(lead, /handle = false, share = null \}\)/)

    /* The handle itself: the sides are laid out once, when the finger lifts; the touch is its own; a tap swaps, and two put the line back. */
    const handle = flat(read('mobile/src/components/SidesHandle.js'))
    assert.match(handle, /onStartShouldSetPanResponderCapture: \(\) => \{ holdSideways\(\) return true \}/)
    assert.match(handle, /onPanResponderTerminationRequest: \(\) => false/)
    const move = handle.slice(handle.indexOf('onPanResponderMove:'), handle.indexOf('onPanResponderRelease:'))
    assert.doesNotMatch(move, /onShare|onLetGo|onSwap/, 'the sides are laid out again while the handle is being dragged')
    assert.match(move, /if \(!n\.resize\) return/)
    assert.match(handle, /if \(lost\) return if \(Math\.abs\(g\.dx\) < HANDLE_TAP && Math\.abs\(g\.dy\) < HANDLE_TAP\) return tap\(\) if \(!n\.resize\) return/)
    assert.match(handle, /if \(end\.lets\) n\.onLetGo\?\.\(end\.lets\) else if \(end\.share !== null\) n\.onShare\?\.\(end\.share\)/)
    assert.match(handle, /if \(twice\) \{ n\.onReset\?\.\(\) return \}/)
    assert.match(handle, /if \(!n\.moved\) n\.onSwap\?\.\(\) else waiting\.current = setTimeout\(\(\) => now\.current\.onSwap\?\.\(\), HANDLE_TWICE_MS\)/)

    /* Kept on the device as Play's share, read only for an account it is open to, and put back by turning the device (a big screen that stops being one), never at launch. */
    const keep = flat(read('mobile/src/lib/sidesKeep.js'))
    assert.match(keep, /const SHARE_KEY = 'fractal-remote:play-share'/)
    assert.match(keep, /if \(share === null \|\| !Number\.isFinite\(v\) \|\| v <= 0 \|\| v >= 1\) AsyncStorage\.removeItem\(SHARE_KEY\)/)
    const use = flat(read('mobile/src/lib/useSidesSplit.js'))
    assert.match(use, /if \(!allowed\) return undefined let alive = true readPlayShare\(\)/)
    assert.match(use, /if \(wasBig\.current && !big && allowed\) \{ setShare\(null\) keepPlayShare\(null\) \} wasBig\.current = big/)
    assert.match(use, /share: allowed \? share : null,/)
  })
}
