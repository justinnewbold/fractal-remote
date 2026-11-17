/**
 * "PLAY IT IN NAM 1" SAYS WHEN NAM 1 ALREADY PLAYS THAT CAPTURE
 * (mobile/src/lib/namPlaying.js, drawn by components/Tone3000Test.js).
 *
 * His log of 17 November 2026: Preview played a capture in NAM 1, and a tap
 * on Play it in NAM 1 under it sent the pick again, said "Changing…" for a
 * moment and left the same line standing, so the tap looked as if it did
 * nothing. Where the unit itself has said, on this page and since nothing
 * has moved, that a block is on a capture's slot, the button says "✓
 * Playing in NAM 1"; a tap still asks the unit, and the line then says the
 * capture was already there. The rule is run whole here, and the page is
 * driven on test/capture-computer.mjs's bench, as a player drives it.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bench } from './capture-computer.mjs'

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const rule = () => import('../mobile/src/lib/namPlaying.js')

const NAM1 = 206
const NAM2 = 207
const HERE = { preset: 386, scene: 0, rev: 4, linked: true }
const CAPTURE = 'FNDR BFSR VB Edge WRM2 CAB FREE'
const ALREADY = `Asked the unit again: NAM 1 is playing “${CAPTURE}”. Save the preset to keep it there.`
const NOW = `NAM 1 is playing “${CAPTURE}” now, through your own rig. Save the preset to keep it there.`

export function run(test) {
  test('NAM playing: the rule, every case, run as it is', async () => {
    const r = await rule()
    const button = (known, now, block, slot, more = {}) => r.namPlayButton({ known, now, block, n: block === NAM2 ? 2 : 1, slot, ...more })
    const plain1 = { ticked: false, label: 'Play it in NAM 1', sub: 'In the preset the unit is on' }
    const tick1 = { ticked: true, label: '✓ Playing in NAM 1', sub: 'The unit said so. Tap to ask it again.' }
    const plain2 = { ticked: false, label: 'Play it in NAM 2', sub: 'In the preset the unit is on' }
    const tick2 = { ticked: true, label: '✓ Playing in NAM 2', sub: 'The unit said so. Tap to ask it again.' }
    const heard = (known, block, slot, more = {}) => r.heardPick(known, { block, slot, name: CAPTURE, asked: HERE, answered: HERE, ...more })

    /* Not known: the plain button, and no line of its own. */
    assert.deepEqual(button({}, HERE, NAM1, 40), plain1)
    assert.deepEqual(button(undefined, HERE, NAM1, 40), plain1)
    /* The unit named NAM 1 on slot 40: the tick under the capture on 40, and only for NAM 1. */
    const on40 = heard({}, NAM1, 40)
    assert.deepEqual(on40, { [NAM1]: { slot: 40, name: CAPTURE, preset: 386, scene: 0, rev: 4 } })
    assert.deepEqual(button(on40, HERE, NAM1, 40), tick1)
    assert.deepEqual(button(on40, HERE, NAM2, 40), plain2)
    /* Known on another slot: the plain button under this capture. */
    assert.deepEqual(button(on40, HERE, NAM1, 41), plain1)
    /* Both blocks on the slot: both ticked. */
    const both = heard(on40, NAM2, 40)
    assert.deepEqual(button(both, HERE, NAM1, 40), tick1)
    assert.deepEqual(button(both, HERE, NAM2, 40), tick2)
    /* Another capture played in that block: the block has moved, the first capture's tick goes, the other block's stays. */
    const moved = heard(both, NAM1, 41)
    assert.deepEqual(button(moved, HERE, NAM1, 40), plain1)
    assert.deepEqual(button(moved, HERE, NAM1, 41), tick1)
    assert.deepEqual(button(moved, HERE, NAM2, 40), tick2)
    /* A pick in that block that failed (it may have landed): plain again, the other block's kept. */
    const failed = heard(both, NAM1, 40, { failed: true })
    assert.deepEqual(button(failed, HERE, NAM1, 40), plain1)
    assert.deepEqual(button(failed, HERE, NAM2, 40), tick2)
    /* One that named an empty slot: plain again. */
    assert.deepEqual(button(heard(on40, NAM1, 40, { name: '<EMPTY>', empty: true }), HERE, NAM1, 40), plain1)
    /* An answer that came after the preset, the scene or the link had moved is not vouched for. */
    for (const answered of [{ ...HERE, preset: 387 }, { ...HERE, scene: 1 }, { ...HERE, rev: 5 }, { ...HERE, linked: false }]) {
      assert.deepEqual(heard(on40, NAM1, 40, { answered }), {}, JSON.stringify(answered))
    }
    /* A slot that is not a number is never kept. */
    assert.deepEqual(heard({}, NAM1, null), {})
    /* The preset or the scene changes, or the link drops: plain at once, and dropped for good, so going back does not bring the tick back. */
    /* The same preset loaded again (a Revert, the same preset picked again) is only a new `rev`: the unit threw the unsaved pick away. */
    for (const away of [{ ...HERE, preset: 387 }, { ...HERE, scene: 2 }, { ...HERE, rev: 5 }, { ...HERE, linked: false }]) {
      assert.deepEqual(button(both, away, NAM1, 40), plain1, JSON.stringify(away))
      const kept = r.keptWhile(both, away)
      assert.deepEqual(kept, {}, JSON.stringify(away))
      assert.deepEqual(button(kept, HERE, NAM1, 40), plain1, `back from ${JSON.stringify(away)}`)
    }
    /* Kept while nothing has moved. */
    assert.deepEqual(r.keptWhile(both, HERE), both)
    assert.deepEqual(r.keptWhile(both, null), {})
    /* While its pick is out the button says so, whatever it said before. */
    assert.equal(button(on40, HERE, NAM1, 40, { changing: true }).label, 'Changing…')
    assert.equal(button({}, HERE, NAM1, 40, { changing: true }).label, 'Changing…')

    /* The words after a tap: "already" only where the block was known on that slot, with that capture, at the tap. */
    const before = r.playingOn(on40, HERE, NAM1, 40)
    assert.deepEqual(before, on40[NAM1])
    assert.equal(r.pickedLine({ n: 1, name: CAPTURE, before }), ALREADY)
    assert.equal(r.pickedLine({ n: 1, name: CAPTURE, before: null }), NOW)
    assert.equal(r.pickedLine({ n: 1, name: 'ANOTHER ONE', before }), 'NAM 1 is playing “ANOTHER ONE” now, through your own rig. Save the preset to keep it there.')
    assert.equal(r.pickedLine({ n: 2, name: CAPTURE, before: r.playingOn(both, HERE, NAM2, 40) }), `Asked the unit again: NAM 2 is playing “${CAPTURE}”. Save the preset to keep it there.`)
    assert.equal(r.playingOn(on40, { ...HERE, scene: 1 }, NAM1, 40), null)
    /* After the same preset is loaded again, a tap on the same capture is not said as asked again: the pick was thrown away. */
    assert.equal(r.playingOn(on40, { ...HERE, rev: 5 }, NAM1, 40), null)
    assert.equal(r.pickedLine({ n: 1, name: CAPTURE, before: r.playingOn(on40, { ...HERE, rev: 5 }, NAM1, 40) }), NOW)
    /* And the line claims nothing about what the block held before the tap. */
    assert.doesNotMatch(r.pickedLine({ n: 1, name: CAPTURE, before }), /already|still is/)

    /* Plain words, and none the house keeps off a screen. */
    const words = [plain1, tick1, plain2, tick2].flatMap((b) => [b.label, b.sub]).concat(ALREADY, NOW, r.CHANGING)
    for (const w of words) assert.doesNotMatch(w, /this phone|\bbeta\b|\btried\b|\bofficial\b|\bsoon\b/i, w)
    /* It imports nothing, so this runs every path of it. */
    assert.doesNotMatch(read('mobile/src/lib/namPlaying.js'), /^import /m)
  })

  test('NAM playing: on the page, Play it in NAM 1 becomes ✓ Playing in NAM 1, a tap asks again and says it was already there, and anything that moves takes the tick away', async () => {
    const b = await bench()
    b.H.link = { ...b.H.link, hostVersion: '1.90.90' }
    b.H.placed[748130] = { slot: 40, sure: true }
    await b.openTone()
    assert.ok(b.button('Play it in NAM 1') && b.button('Play it in NAM 2'), 'the two buttons are not there')
    const tap = async (label) => {
      const btn = b.button(label)
      assert.ok(btn, `no ${label} button`)
      btn.props.onPress()
      await b.wait(5)
      await b.draw()
    }
    await tap('Play it in NAM 1')
    assert.deepEqual(b.sent(), [['pick', 206, 40]])
    assert.match(b.said(), new RegExp(NOW.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.equal(b.button('✓ Playing in NAM 1')?.props.sub, 'The unit said so. Tap to ask it again.')
    assert.ok(b.button('Play it in NAM 2'), 'NAM 2 was ticked by NAM 1’s pick')
    /* A tap on the tick still asks the unit, and the line says it was already there. */
    await tap('✓ Playing in NAM 1')
    assert.deepEqual(b.sent(), [['pick', 206, 40], ['pick', 206, 40]])
    assert.ok(b.said().includes(ALREADY), b.said())
    assert.ok(!b.said().includes(NOW), 'the old line still stands')
    assert.ok(b.button('✓ Playing in NAM 1'))
    /* Both blocks on the slot: both ticked. */
    await tap('Play it in NAM 2')
    assert.ok(b.button('✓ Playing in NAM 1') && b.button('✓ Playing in NAM 2'), 'both blocks on the slot are not both ticked')

    /* The scene changes: plain, and still plain once back. The same for the preset, and for a link that drops. */
    for (const [away, back] of [
      [() => (b.H.rig = { ...b.H.rig, sceneIndex: 3 }), () => (b.H.rig = { ...b.H.rig, sceneIndex: 0 })],
      [() => (b.H.rig = { ...b.H.rig, preset: { number: 387 } }), () => (b.H.rig = { ...b.H.rig, preset: { number: 386 } })],
      [() => b.link({ link: 'no-answer' }), () => b.link({ link: 'connected' })],
      /* The same preset loaded again (a Revert): only the rig's bufferRev moves, and the unsaved pick is gone. */
      [() => (b.H.rig = { ...b.H.rig, bufferRev: b.H.rig.bufferRev + 1 }), () => undefined]
    ]) {
      await tap('Play it in NAM 1').catch(async () => tap('✓ Playing in NAM 1'))
      assert.ok(b.button('✓ Playing in NAM 1'), 'not ticked before the move')
      await away()
      await b.draw()
      assert.ok(b.button('Play it in NAM 1') && !b.button('✓ Playing in NAM 1'), `still ticked after ${away}`)
      await back()
      await b.draw()
      assert.ok(b.button('Play it in NAM 1') && !b.button('✓ Playing in NAM 1'), `ticked again after ${back}`)
    }

    /* A pick that fails: plain again. */
    await tap('Play it in NAM 1')
    assert.ok(b.button('✓ Playing in NAM 1'))
    b.H.picks.push(new Error('The unit did not answer.'))
    await tap('✓ Playing in NAM 1')
    assert.ok(b.button('Play it in NAM 1') && !b.button('✓ Playing in NAM 1'), 'a failed pick kept the tick')

    /* A pick answered after the scene changed under it is not vouched for, even where the scene is back before the page is drawn again. */
    const late = await bench()
    late.H.placed[748130] = { slot: 40, sure: true }
    await late.openTone()
    late.H.picks.push(
      new Promise((done) => setTimeout(() => done({ block: 206, slot: 40, name: CAPTURE }), 3)).then((x) => {
        late.H.rig = { ...late.H.rig, sceneIndex: 5 }
        return x
      })
    )
    late.button('Play it in NAM 1').props.onPress()
    await late.wait(10)
    late.H.rig = { ...late.H.rig, sceneIndex: 0 }
    await late.draw()
    assert.deepEqual(late.sent(), [['pick', 206, 40]])
    assert.ok(late.button('Play it in NAM 1') && !late.button('✓ Playing in NAM 1'), 'an answer that came after a scene change was ticked')
  })

  test('NAM playing: the held block’s view gets the same tick on its Play button', async () => {
    const b = await bench()
    b.H.placed[748130] = { slot: 40, sure: true }
    let done = null
    await b.openTone({ block: 207, held: true, onDone: (l) => (done = l) })
    b.button('Play it in NAM 2').props.onPress()
    await b.wait(5)
    await b.draw()
    assert.equal(b.button('✓ Playing in NAM 2')?.props.sub, 'The unit said so. Tap to ask it again.')
    assert.ok(!b.button('Play it in NAM 1') && !b.button('✓ Playing in NAM 1'), 'the other block is offered from a held block')
    /* Use it and go back hands back the "already" line, the pick still sent. */
    b.button('Use it and go back').props.onPress()
    await b.wait(5)
    await b.draw()
    assert.deepEqual(b.sent(), [['pick', 207, 40], ['pick', 207, 40]])
    assert.equal(done, `Asked the unit again: NAM 2 is playing “${CAPTURE}”. Save the preset to keep it there.`)
  })

  test('NAM playing: the page draws the button and the line from the rule, and has no words of its own for them', () => {
    const card = flat(code(read('mobile/src/components/Tone3000Test.js')))
    assert.doesNotMatch(card, /Play it in NAM|Playing in NAM|Changing…|is playing “|already playing/, 'the page has words of its own for the button or the line')
    assert.equal((card.match(/namPlayButton\(\{ known: playing, now, block: (nam|playIn), n: (i \+ 1|where\.n), slot: at\.slot, changing: busy === `pick \$\{(nam|playIn)\}` && mine \}\)/g) || []).length, 2)
    assert.equal((card.match(/<Press (key=\{nam\} )?label=\{b\.label\} sub=\{b\.sub\} height=\{48\}/g) || []).length, 2)
    assert.match(card, /const line = pickedLine\(\{ n, name: got\.name, before \}\)/)
    assert.match(card, /const asked = unitNow\(\) const before = playingOn\(playingNow\.current, asked, block, slot\)/)
    assert.match(card, /heard\(\{ name: got\.name, empty: got\.name === NAM_EMPTY \}\)/)
    assert.match(card, /heard\(\{ failed: true \}\)/)
    assert.match(card, /useEffect\(\(\) => \{ setPlaying\(\(was\) => keptWhile\(was, \{ preset, scene, rev, linked \}\)\) \}, \[preset, scene, rev, linked\]\)/)
    assert.match(card, /const \{ preset, scene, rev \} = usePresetAndScene\(\) .* const now = \{ preset, scene, rev, linked \}/)
  })
}
