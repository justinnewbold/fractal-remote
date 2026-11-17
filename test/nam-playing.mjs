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

  test('NAM playing: from a held block a capture already on the unit keeps Preview and Get, which play it there with nothing sent again', async () => {
    /*
     * "What's the difference between get it and use it and go back? Little
     * confusing. If I click each of those, would it do the same thing?"
     * (Justin, 17 November 2026.) A capture already on the unit had traded
     * its two buttons for "Play it in NAM 2" and "Use it and go back".
     */
    const b = await bench()
    b.H.placed[748130] = { slot: 40, sure: true }
    let done = null
    await b.openTone({ block: 207, held: true, onDone: (l) => (done = l) })
    assert.ok(b.button('Preview') && b.button('Get'), 'a capture on the unit lost its two buttons')
    for (const gone of ['Play it in NAM 1', 'Play it in NAM 2', '✓ Playing in NAM 2', 'Use it and go back']) assert.ok(!b.button(gone), `“${gone}” is drawn from a held block`)
    /* Read aloud as what they do there: nothing is put on the unit a second time. */
    assert.equal(b.button('Preview').props.says, `Preview ${CAPTURE}: plays it in NAM 2`)
    assert.equal(b.button('Get').props.says, `Get ${CAPTURE}: plays it in NAM 2 and goes back to its knobs`)
    /* Preview plays it where it is, in the block that was held: one pick, and the page stays. While the pick is out the button that was tapped says so, and only it. */
    let answer = null
    b.H.picks.push(new Promise((ok) => (answer = ok)))
    b.button('Preview').props.onPress()
    await b.draw()
    assert.ok(b.button('Changing…') && b.button('Get') && !b.button('Preview'), 'the tapped button does not say the pick is out')
    assert.equal(b.button('Changing…').props.disabled && b.button('Get').props.disabled, true, 'a second tap is taken while the pick is out')
    answer({ block: 207, slot: 40, name: CAPTURE })
    await b.wait(5)
    await b.draw()
    assert.deepEqual(b.sent(), [['pick', 207, 40]])
    assert.equal(done, null, 'Preview handed the pop-up back')
    assert.ok(b.said().includes(`NAM 2 is playing “${CAPTURE}” now, through your own rig. Save the preset to keep it there.`), b.said())
    assert.ok(b.button('Preview') && b.button('Get'), 'the two buttons went after a Preview')
    /* Get plays it and hands the pop-up back with what the block said: the pick is still sent, and said as asked again. */
    b.button('Get').props.onPress()
    await b.wait(5)
    await b.draw()
    assert.deepEqual(b.sent(), [['pick', 207, 40], ['pick', 207, 40]])
    assert.equal(done, `Asked the unit again: NAM 2 is playing “${CAPTURE}”. Save the preset to keep it there.`)
    /* A Get whose pick fails stays on the page, with the reason and both buttons. */
    const stay = await bench()
    stay.H.placed[748130] = { slot: 40, sure: true }
    let back = null
    await stay.openTone({ block: 206, held: true, onDone: (l) => (back = l) })
    stay.H.picks.push(new Error('The unit did not answer.'))
    stay.button('Get').props.onPress()
    await stay.wait(5)
    await stay.draw()
    assert.equal(back, null, 'a Get that failed went back to the knobs')
    assert.ok(stay.said().includes('The unit did not answer.'), stay.said())
    assert.ok(stay.button('Preview') && stay.button('Get'))
    /* On the Developer page nothing has changed: a capture on the unit has a Play button for each block, and no Preview or Get. */
    const dev = await bench()
    dev.H.placed[748130] = { slot: 40, sure: true }
    await dev.openTone()
    assert.ok(dev.button('Play it in NAM 1') && dev.button('Play it in NAM 2') && !dev.button('Preview') && !dev.button('Get'))
  })

  test('NAM playing: a block that is off is switched on once the unit has named a capture in it, and only then (the rule, every case)', async () => {
    const r = await rule()
    assert.equal(r.switchOnToHear({ off: true, asked: HERE, now: HERE }), true)
    /* On already, or not known to the chain on screen: nothing to switch. Only `true` is "off". */
    for (const off of [false, null, undefined, 'yes', 1]) assert.equal(r.switchOnToHear({ off, asked: HERE, now: HERE }), false, String(off))
    /* The unit has moved since the tap, or the link is down: a switch now would land somewhere the player did not ask. */
    for (const now of [{ ...HERE, preset: 387 }, { ...HERE, scene: 1 }, { ...HERE, rev: 5 }, { ...HERE, linked: false }, null]) assert.equal(r.switchOnToHear({ off: true, asked: HERE, now }), false, JSON.stringify(now))
    assert.equal(r.switchOnToHear({ off: true, asked: null, now: HERE }), false)
    assert.equal(r.switchOnToHear({ off: true, asked: { ...HERE, linked: false }, now: HERE }), false)
    assert.equal(r.switchOnToHear(), false)
    /* The line says which happened, and a block left off is never said to be playing. */
    /* And the other half: off where the unit is now, and the unit somewhere other than where the tap was made. Nothing is switched; the line says it was left off. */
    for (const now of [{ ...HERE, preset: 387 }, { ...HERE, scene: 1 }, { ...HERE, rev: 5 }, { ...HERE, linked: false }, null]) assert.equal(r.leftOffAfterMove({ off: true, asked: HERE, now }), true, JSON.stringify(now))
    assert.equal(r.leftOffAfterMove({ off: true, asked: HERE, now: HERE }), false)
    for (const off of [false, null, undefined]) assert.equal(r.leftOffAfterMove({ off, asked: HERE, now: { ...HERE, scene: 1 } }), false, String(off))
    assert.equal(r.leftOffAfterMove(), false)
    /* Never both, whatever is handed in. */
    for (const off of [true, false, null]) for (const now of [HERE, { ...HERE, scene: 1 }, null]) assert.ok(!(r.switchOnToHear({ off, asked: HERE, now }) && r.leftOffAfterMove({ off, asked: HERE, now })))
    const switched = r.pickedLine({ n: 2, name: CAPTURE, on: r.SWITCHED_ON })
    const stuck = r.pickedLine({ n: 1, name: CAPTURE, on: r.STILL_OFF })
    const left = r.pickedLine({ n: 1, name: CAPTURE, on: r.LEFT_OFF })
    assert.equal(switched, `NAM 2 was off, so it is switched on now, and it is playing “${CAPTURE}” through your own rig. Save the preset to keep it that way.`)
    /* A switch that did not land may have landed with its answer lost: the line claims nothing of the block's state. */
    assert.equal(stuck, `NAM 1 is set to “${CAPTURE}” now, but the app couldn’t switch NAM 1 on. If you don’t hear it, switch NAM 1 on.`)
    assert.doesNotMatch(stuck, /is switched off|is off\b/)
    assert.equal(left, `NAM 1 is set to “${CAPTURE}” now, but NAM 1 is switched off and the app left it off, because the scene, the preset or the connection changed after your tap. Switch NAM 1 on to hear it.`)
    for (const w of [stuck, left]) assert.doesNotMatch(w, /is playing/)
    /* Which lines say "playing": the card draws those inside itself and the others as a note, and only those tick a button. */
    assert.deepEqual([null, r.SWITCHED_ON, r.STILL_OFF, r.LEFT_OFF].map(r.saysPlaying), [true, true, false, false])
    assert.equal(new Set([r.SWITCHED_ON, r.STILL_OFF, r.LEFT_OFF]).size, 3)
    /* A block that stayed off is not kept as playing the capture. */
    assert.deepEqual(r.heardPick({ [NAM1]: { slot: 40, name: CAPTURE, preset: 386, scene: 0, rev: 4 } }, { block: NAM1, slot: 40, name: CAPTURE, off: true, asked: HERE, answered: HERE }), {})
    /* A switch is said even where the same capture was named again: "asked again" alone would hide that the block had been off. */
    const before = { slot: 40, name: CAPTURE, preset: 386, scene: 0, rev: 4 }
    assert.equal(r.pickedLine({ n: 2, name: CAPTURE, before, on: r.SWITCHED_ON }), switched)
    assert.equal(r.pickedLine({ n: 1, name: CAPTURE, before, on: r.STILL_OFF }), stuck)
    assert.equal(r.pickedLine({ n: 1, name: CAPTURE, before, on: r.LEFT_OFF }), left)
    /* Nothing switched: the lines are what they were. */
    assert.equal(r.pickedLine({ n: 1, name: CAPTURE, before: null, on: null }), NOW)
    assert.equal(r.pickedLine({ n: 1, name: CAPTURE, before, on: null }), ALREADY)
    for (const w of [switched, stuck, left]) assert.doesNotMatch(w, /this phone|\bbeta\b|\btried\b|\bofficial\b|\bsoon\b|bypass/i, w)
  })

  test('NAM playing: on the page, a capture played in a block that is off switches the block on and says so, and nothing is sent for a block that is on', async () => {
    /*
     * "If the NAM block is off when you hold it to browse tone 3000, does it
     * turn it on so you can listen to it, or does it leave it off? need to
     * make sure that it turns it on automatically to listen" (Justin, 17
     * November 2026). It left it off, and said "is playing" all the same.
     */
    const SWITCHED = `NAM 2 was off, so it is switched on now, and it is playing “${CAPTURE}” through your own rig. Save the preset to keep it that way.`
    const STUCK = `NAM 2 is set to “${CAPTURE}” now, but the app couldn’t switch NAM 2 on. If you don’t hear it, switch NAM 2 on.`
    const LEFT = `NAM 2 is set to “${CAPTURE}” now, but NAM 2 is switched off and the app left it off, because the scene, the preset or the connection changed after your tap. Switch NAM 2 on to hear it.`
    const chain = (nam1, nam2) => [{ effectId: 58, bypassed: false }, ...(nam1 === null ? [] : [{ effectId: 206, bypassed: nam1 }]), ...(nam2 === null ? [] : [{ effectId: 207, bypassed: nam2 }])]
    /* The held NAM 2's page, a capture already on the unit in slot 041, and the chain on screen as given. */
    const held = async (allBlocks, source) => {
      const b = await (source ? bench(source) : bench())
      b.H.placed[748130] = { slot: 40, sure: true }
      if (allBlocks) b.H.rig = { ...b.H.rig, allBlocks }
      b.done = null
      await b.openTone({ block: 207, held: true, onDone: (l) => (b.done = l) })
      b.tap = async (label) => {
        b.button(label).props.onPress()
        await b.wait(8)
        await b.draw()
      }
      return b
    }
    const inCard = (b, line) => b.said().split('\n').some((l) => l.startsWith('On your Axe-Fx III|') && l.includes(line))

    /* Off: the pick, then the block switched on, in that order, and the line says so in the capture's own card. */
    let b = await held(chain(false, true))
    await b.tap('Preview')
    assert.deepEqual(b.sent(), [['pick', 207, 40], ['bypass', 207, false]])
    assert.ok(inCard(b, SWITCHED), b.said())
    assert.ok(b.logs().some((l) => l.includes('NAM 2 was off: switched on, so the capture is heard')), b.logs().join(' | '))
    /* It is on now: the next Preview switches nothing, and says it asked again. */
    await b.tap('Preview')
    assert.deepEqual(b.sent(), [['pick', 207, 40], ['bypass', 207, false], ['pick', 207, 40]])
    assert.ok(b.said().includes(`Asked the unit again: NAM 2 is playing “${CAPTURE}”.`), b.said())
    /* Get does the same, and the pop-up is handed back the line that says the block was switched on. */
    b = await held(chain(false, true))
    await b.tap('Get')
    assert.deepEqual(b.sent(), [['pick', 207, 40], ['bypass', 207, false]])
    assert.equal(b.done, SWITCHED)

    /* On already: the pick alone, and the line it always had. */
    b = await held(chain(true, false))
    await b.tap('Preview')
    assert.deepEqual(b.sent(), [['pick', 207, 40]])
    assert.ok(inCard(b, `NAM 2 is playing “${CAPTURE}” now, through your own rig.`), b.said())
    /* Never the other block: NAM 1 off under a held NAM 2 is left as it is. */
    assert.ok(!b.sent().some((l) => l[0] === 'bypass' && l[1] === 206), 'the block that was not held was switched')
    /* The chain on screen does not hold the block, or there is no chain: not known to be off, so nothing is switched. */
    for (const blocks of [chain(true, null), [], undefined]) {
      b = await held(blocks)
      await b.tap('Preview')
      assert.deepEqual(b.sent(), [['pick', 207, 40]], JSON.stringify(blocks))
    }

    /* A pick that fails, and one that names an empty slot: nothing to hear, so nothing is switched. */
    b = await held(chain(false, true))
    b.H.picks.push(new Error('The unit did not answer.'))
    await b.tap('Preview')
    assert.deepEqual(b.sent(), [['pick', 207, 40]])
    b = await held(chain(false, true))
    b.H.picks.push({ block: 207, slot: 40, name: '<EMPTY>' })
    await b.tap('Preview')
    assert.deepEqual(b.sent(), [['pick', 207, 40]])
    /* The scene changed while the pick was out: the block is not switched on in a scene the tap was not made in, and the line says it was left off, as a note and never as "is playing". */
    b = await held(chain(false, true))
    b.H.picks.push(
      new Promise((ok) => setTimeout(() => ok({ block: 207, slot: 40, name: CAPTURE }), 3)).then((x) => {
        b.H.rig = { ...b.H.rig, sceneIndex: 5 }
        return x
      })
    )
    await b.tap('Preview')
    assert.deepEqual(b.sent(), [['pick', 207, 40]])
    assert.ok(b.said().includes(LEFT) && !inCard(b, LEFT) && !b.said().includes('is playing “'), b.said())
    assert.ok(b.logs().some((l) => l.includes('NAM 2 is off where the unit is now, and was left off')), b.logs().join(' | '))
    /* And the link down by the time the unit answered. */
    b = await held(chain(false, true))
    b.H.picks.push(
      new Promise((ok) => setTimeout(() => ok({ block: 207, slot: 40, name: CAPTURE }), 3)).then((x) => {
        b.H.link = { ...b.H.link, link: 'no-answer' }
        return x
      })
    )
    await b.tap('Preview')
    assert.deepEqual(b.sent(), [['pick', 207, 40]])
    /* A block that is ON where the unit moved to is said as it always was: nothing was off. */
    b = await held(chain(false, false))
    b.H.picks.push(
      new Promise((ok) => setTimeout(() => ok({ block: 207, slot: 40, name: CAPTURE }), 3)).then((x) => {
        b.H.rig = { ...b.H.rig, sceneIndex: 5 }
        return x
      })
    )
    await b.tap('Preview')
    assert.deepEqual(b.sent(), [['pick', 207, 40]])
    assert.ok(!b.said().includes(LEFT), b.said())

    /*
     * A CAPTURE THAT IS SENT FIRST IS HELD TO WHERE THE UNIT WAS AT THE TAP,
     * not at the pick: over Bluetooth the send takes half a minute, and a
     * scene stepped to meanwhile (the pop-up stays up through a scene
     * change) is not one the player tapped in. An independent read found
     * the first cut compared two moments that were both after the send.
     */
    const sentFirst = async (during) => {
      const s = await bench()
      s.H.link = { ...s.H.link, hostVersion: '1.90.90' }
      s.H.rig = { ...s.H.rig, allBlocks: chain(false, true) }
      /* Answered only once it is asked for (a thenable, not a promise already on its way): the unit moves while the send is out, after the tap. */
      s.H.installs.push({
        then(ok) {
          setTimeout(() => {
            during(s)
            ok({ slot: 40, name: CAPTURE, replaced: null, seconds: 0.5 })
          }, 3)
        }
      })
      s.done = null
      await s.openTone({ block: 207, held: true, onDone: (l) => (s.done = l) })
      return s
    }
    for (const during of [(s) => (s.H.rig = { ...s.H.rig, sceneIndex: 3 }), (s) => (s.H.rig = { ...s.H.rig, preset: { number: 400 } }), (s) => (s.H.rig = { ...s.H.rig, bufferRev: 9 })]) {
      const s = await sentFirst(during)
      s.button('Preview').props.onPress()
      await s.wait(40)
      await s.draw()
      assert.deepEqual(s.sent().map((l) => l[0]), ['fetch', 'empty', 'install', 'pick'], `switched on after the unit moved during the send: ${during}`)
      assert.ok(s.said().includes(LEFT) && !inCard(s, LEFT), s.said())
    }
    /* Nothing moved during the send: switched on, as above. */
    const still = await sentFirst(() => {})
    still.button('Preview').props.onPress()
    await still.wait(40)
    await still.draw()
    assert.deepEqual(still.sent().map((l) => l[0]), ['fetch', 'empty', 'install', 'pick', 'bypass'])

    /* The unit did not take the switch, or it threw: said plainly, as a note under the card and never as "is playing" inside it, and a Get still hands the line back. */
    for (const answer of [false, new Error('The connection dropped.')]) {
      b = await held(chain(false, true))
      b.H.switches.push(answer)
      await b.tap('Get')
      assert.deepEqual(b.sent(), [['pick', 207, 40], ['bypass', 207, false]])
      assert.equal(b.done, STUCK)
      b = await held(chain(false, true))
      b.H.switches.push(answer)
      await b.tap('Preview')
      assert.ok(b.said().includes(STUCK) && !inCard(b, STUCK), b.said())
      assert.ok(!b.said().includes('is playing “'), `a block left off is said to be playing: ${b.said()}`)
      assert.ok(b.logs().some((l) => l.includes('NAM 2 was off, and was not switched on')), b.logs().join(' | '))
    }
    /* On the Developer page a block that stayed off is not ticked "✓ Playing in NAM 1": the unit named the capture, and nothing is heard. */
    b = await bench()
    b.H.placed[748130] = { slot: 40, sure: true }
    b.H.rig = { ...b.H.rig, allBlocks: chain(true, false) }
    await b.openTone()
    b.H.switches.push(false)
    b.button('Play it in NAM 1').props.onPress()
    await b.wait(8)
    await b.draw()
    assert.deepEqual(b.sent(), [['pick', 206, 40], ['bypass', 206, false]])
    assert.ok(b.button('Play it in NAM 1') && !b.button('✓ Playing in NAM 1'), 'a block that stayed off is ticked as playing')
    /* Switched on, it is ticked. */
    b.button('Play it in NAM 1').props.onPress()
    await b.wait(8)
    await b.draw()
    assert.ok(b.button('✓ Playing in NAM 1'), 'a block switched on is not ticked')

    /* A capture that is not on the unit yet: fetched, sent, played, and then the block switched on. */
    b = await bench()
    b.H.link = { ...b.H.link, hostVersion: '1.90.90' }
    b.H.rig = { ...b.H.rig, allBlocks: chain(false, true) }
    b.H.installs.push({ slot: 40, name: CAPTURE, replaced: null, seconds: 0.5 })
    b.done = null
    await b.openTone({ block: 207, held: true, onDone: (l) => (b.done = l) })
    b.button('Get').props.onPress()
    await b.wait(30)
    await b.draw()
    assert.deepEqual(b.sent().map((l) => l[0]), ['fetch', 'empty', 'install', 'pick', 'bypass'])
    assert.deepEqual(b.sent().at(-1), ['bypass', 207, false])
    assert.equal(b.done, SWITCHED)

    /* The Developer page's Play buttons too: the block that is played in, and only it. */
    b = await bench()
    b.H.placed[748130] = { slot: 40, sure: true }
    b.H.rig = { ...b.H.rig, allBlocks: chain(true, false) }
    await b.openTone()
    b.button('Play it in NAM 2').props.onPress()
    await b.wait(8)
    await b.draw()
    assert.deepEqual(b.sent(), [['pick', 207, 40]])
    b.button('Play it in NAM 1').props.onPress()
    await b.wait(8)
    await b.draw()
    assert.deepEqual(b.sent(), [['pick', 207, 40], ['pick', 206, 40], ['bypass', 206, false]])
    assert.ok(b.said().includes(`NAM 1 was off, so it is switched on now, and it is playing “${CAPTURE}” through your own rig.`), b.said())

    /* This test's own check: with the switch taken out of the page, a block that is off is left off, and the line still says "is playing". */
    const card = read('mobile/src/components/Tone3000Test.js')
    const without = card.replace('const on = await hear(block, tapped || asked)', 'const on = null')
    assert.notEqual(without, card)
    b = await held(chain(false, true), without)
    await b.tap('Preview')
    assert.deepEqual(b.sent(), [['pick', 207, 40]])
    assert.ok(!b.said().includes(SWITCHED))
  })

  test('NAM playing: the page draws the button and the line from the rule, and has no words of its own for them', () => {
    const card = flat(code(read('mobile/src/components/Tone3000Test.js')))
    assert.doesNotMatch(card, /Play it in NAM|Playing in NAM|Changing…|is playing “|already playing|Use it and go back|was off, so|could not switch|is set to “/, 'the page has words of its own for the button or the line')
    /* The Play buttons are the Developer page's: one for each NAM block. From a held block a capture on the unit keeps Preview and Get. */
    assert.equal((card.match(/namPlayButton\(/g) || []).length, 1)
    assert.match(card, /\{there && !where\.held \? NAM_BLOCKS\.map\(\(nam, i\) => \{ const b = namPlayButton\(\{ known: playing, now, block: nam, n: i \+ 1, slot: at\.slot, changing: busy === `pick \$\{nam\}` && mine \}\)/)
    assert.equal((card.match(/<Press (key=\{nam\} )?label=\{b\.label\} sub=\{b\.sub\} height=\{48\}/g) || []).length, 1)
    assert.doesNotMatch(card, /there && where\.held/)
    /* The tapped one of a held block's two says the pick is out, in the rule's own word. */
    assert.match(card, /const picking = where\.held && mine && busy === `pick \$\{playIn\}` const word = \(which, said\) => \(tapped !== which \? said : working \? \(busy === m\.id \? 'Fetching…' : 'Sending…'\) : picking \? CHANGING : said\)/)
    assert.match(card, /const useIn = async \(block, slot, id, back = false\) => \{ if \(busy\) return setTapped\(back \? 'keep' : 'play'\)/)
    /* The block is switched on after the unit named the capture, by the rule, and the line is the rule's. */
    assert.match(card, /const on = await hear\(block, tapped \|\| asked\) const line = pickedLine\(\{ n, name: got\.name, before, on \}\) if \(!saysPlaying\(on\)\) heard\(\{ off: true \}\) played\(line, \{ playing: saysPlaying\(on\) \}\) return line/)
    assert.match(card, /const hear = async \(block, tapped\) => \{ const which = `NAM \$\{NAM_BLOCKS\.indexOf\(block\) \+ 1\}` const where = \{ off: namOffHere\(block\), asked: tapped, now: unitNow\(\) \} if \(leftOffAfterMove\(where\)\) \{ logDebug\([^)]*\) return LEFT_OFF \} if \(!switchOnToHear\(where\)\) return null/)
    /* A capture sent first: where the unit was at the tap, taken before anything is fetched or sent, and handed to the pick. One already on the unit is picked at once, so the pick's own moment is the tap's. */
    assert.match(card, /setTapped\(play && !back \? 'play' : 'keep'\) const tappedAt = unitNow\(\) if \(goingNow\(\)\) \{/)
    assert.match(card, /const nowPlaying = await point\(playIn, slot, m\.id, tappedAt\)/)
    assert.match(card, /const point = async \(block, slot, id, tapped = null\) => \{/)
    assert.equal((card.match(/namOnHere\(/g) || []).length, 1, 'the block is switched on from somewhere else on the page')
    assert.equal((card.match(/\bhear\(/g) || []).length, 1, 'the block is switched on at some other moment')
    assert.match(card, /const asked = unitNow\(\) const before = playingOn\(playingNow\.current, asked, block, slot\)/)
    assert.match(card, /heard\(\{ name: got\.name, empty: got\.name === NAM_EMPTY \}\)/)
    assert.match(card, /heard\(\{ failed: true \}\)/)
    assert.match(card, /useEffect\(\(\) => \{ setPlaying\(\(was\) => keptWhile\(was, \{ preset, scene, rev, linked \}\)\) \}, \[preset, scene, rev, linked\]\)/)
    assert.match(card, /const \{ preset, scene, rev \} = usePresetAndScene\(\) .* const now = \{ preset, scene, rev, linked \}/)
  })
}
