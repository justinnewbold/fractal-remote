/**
 * TONE3000 FROM A HELD NAM BLOCK (mobile/src/lib/tone3000Quick.js,
 * tone3000Words.js, useTone3000Quick.js, components/Tone3000Quick.js, and
 * their place in screens/Stage's hold pop-up and components/Tone3000Test).
 *
 * "I want it in the app in a few places. One is if they hold a nam block it
 * pulls up the quick edit screen on top of it have it say tone 3000 where
 * they can click on it and browse tones preview them and then download them
 * directly and then it'll take them back to that screen so it's very
 * streamlined." (Justin, 14 November 2026.)
 *
 * Held here: it is offered on a NAM block and nothing else, to his account
 * until the switch says everybody; the pop-up everybody else gets is the
 * one it was; Preview plays in the block that was held, Get plays it there
 * and hands the pop-up back to its knobs only when the block has said it is
 * playing; and every word says what happens in the place it is said.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

const rule = () => import('../mobile/src/lib/tone3000Quick.js')
const words = () => import('../mobile/src/lib/tone3000Words.js')

export function run(test) {
  test('tone3000 quick: it is offered on a NAM block and nothing else, and only where the account is let in', async () => {
    const { tone3000QuickFor, namNumber } = await rule()
    const { NAM_BLOCKS } = await import('../mobile/src/lib/nam-install.js')
    assert.deepEqual([...NAM_BLOCKS], [206, 207])
    const nam = (more = {}) => ({ slug: 'nam', name: 'NAM 1', ...more })
    /* The two NAM blocks, for an account it is open to. */
    assert.equal(tone3000QuickFor(true, nam(), 206), true)
    assert.equal(tone3000QuickFor(true, nam({ name: 'NAM 2' }), 207), true)
    assert.deepEqual([namNumber(206), namNumber(207), namNumber(58), namNumber(null)], [1, 2, 0, 0])
    /* The family AND the number: another unit's block with the same number is never offered it, nor a NAM-named block with another number. */
    for (const [block, id] of [[{ slug: 'amp' }, 206], [{ slug: 'cab' }, 207], [nam(), 58], [nam(), 205], [nam(), null], [nam(), '206'], [{ slug: 'NAM' }, 206], [{}, 206], [null, 206], [undefined, 207]]) {
      assert.equal(tone3000QuickFor(true, block, id), false, JSON.stringify([block, id]))
    }
    /* An answer that is not exactly yes is a no: closed, not yet known, or anything else. */
    for (const allowed of [false, null, undefined, 1, 'yes', {}]) assert.equal(tone3000QuickFor(allowed, nam(), 206), false, String(allowed))
    /* Pure: it imports the capture tools' own list of NAM blocks and nothing else. */
    assert.deepEqual([...code(read('mobile/src/lib/tone3000Quick.js')).matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['./nam-install.js'])
  })

  test('tone3000 quick: his account first, behind a switch of its own, and the pop-up everybody else gets is the one it was', async () => {
    const features = await import('../mobile/src/lib/features.js')
    assert.equal(features.TONE3000_QUICK_FOR_EVERYONE, false)
    const hook = flat(code(read('mobile/src/lib/useTone3000Quick.js')))
    /* His account by the sign-in kept on the device, as the capture picker's is: never a question asked of the server. */
    assert.match(hook, /import \{ useBluetoothAdmin \} from '\.\/bluetooth' import \{ TONE3000_QUICK_FOR_EVERYONE \} from '\.\/features' export const useTone3000Quick = \(\) => \{ const his = useBluetoothAdmin\(\) return TONE3000_QUICK_FOR_EVERYONE \|\| his \}/)
    const door = flat(code(read('mobile/src/components/Tone3000Quick.js')))
    assert.match(door, /export function useTone3000Door\(block\) \{ const allowed = useTone3000Quick\(\) const id = block \? idOf\(block\) : null const offered = tone3000QuickFor\(allowed, block, id\) return \{ offered, id: offered \? id : null, n: offered \? namNumber\(id\) : 0 \} \}/)

    /* Play's pop-up. Only the one with the knobs ("the quick edit screen") is asked; the one with the channels alone is held word for word by test/hold-pop.mjs. */
    const stage = flat(code(read('mobile/src/screens/Stage.js')))
    const sheet = stage.slice(stage.indexOf('function ChannelSheet('), stage.indexOf('export const DOWN_DIM'))
    assert.match(sheet, /const library = useTone3000Door\(withKnobs \? block : null\)/)
    /* Nothing is drawn where it is not offered: no button, and the page cannot be up. */
    assert.match(sheet, /const libraryDoor = library\.offered \? \( <> <Tone3000Door n=\{library\.n\} onPress=\{\(\) => setBrowsing\(true\)\} \/>/)
    assert.match(sheet, /if \(browsing && library\.offered\) \{/)
    assert.equal((sheet.match(/\{libraryDoor\}/g) || []).length, 1)
    /* Over the knobs, in the pop-up that has them: "on top of it have it say tone 3000". */
    assert.match(sheet, /\{libraryDoor\} <PopKnobs block=\{block\} onScrollLock=\{setHeld\} \/>/)
    /* The page is in the SAME pop-up (same title, same way out, open on the same condition), with the channels put away while it is up. */
    assert.match(sheet, /<Sheet open=\{!!block && channels\?\.length > 1\} onClose=\{onClose\} title=\{name\} note="Captures" tall scrollKey="library"> <Tone3000InPop id=\{library\.id\} n=\{library\.n\} onBack=\{\(line\) => \{ setCame\(line\) setBrowsing\(false\) \}\} \/> <\/Sheet>/)
    /* It is one sheet, so each of its two pages starts at its own top: left where a long list was scrolled to, the knobs came up blank. */
    const sheetSrc = flat(code(read('mobile/src/components/Sheet.js')))
    assert.match(sheetSrc, /<ScrollView key=\{scrollKey\} contentContainerStyle=/)
    assert.match(sheetSrc, /still = false, scrollKey = undefined, children \}\)/)
    /* Another block held, or the pop-up closed, starts on the knobs with nothing said. */
    assert.match(sheet, /useEffect\(\(\) => \{ setBrowsing\(false\) setCame\(''\) \}, \[library\.id\]\)/)
    /* And what the block said it is playing is over the knobs when a Get hands them back. */
    assert.match(sheet, /\{came \? <Text style=\{\{[^}]*\}\}>\{came\}<\/Text> : null\}/)
    /* Play's own file holds the door and nothing of TONE3000's: no client, no card, no words of its own. */
    const src = code(read('mobile/src/screens/Stage.js'))
    assert.deepEqual([...src.matchAll(/from '([^']*[Tt]one3000[^']*)'/g)].map((m) => m[1]), ['../components/Tone3000Quick'])
    assert.ok(!/TONE3000|t3k\b|tone3000Here|Tone3000Test/.test(src))
  })

  test('tone3000 quick: Preview plays in the block that was held, and Get plays it there and gives the pop-up back to its knobs only once the block says it is playing', () => {
    const door = flat(code(read('mobile/src/components/Tone3000Quick.js')))
    const card = flat(code(read('mobile/src/components/Tone3000Test.js')))
    /* The page is the Developer page's own, told which block it was opened from. */
    assert.match(door, /<Press label=\{backToKnobs\(n\)\} height=\{44\} disabled=\{working\} onPress=\{\(\) => onBack\(''\)\} \/> <Tone3000Test block=\{id\} held onDone=\{\(line\) => onBack\(line \|\| ''\)\} onWorking=\{setWorking\} \/>/)
    /* The way back waits while a capture is being fetched, sent or pointed at, as the page's own Back does; not while TONE3000's page opens or a tone is read. */
    assert.match(card, /const working = busy !== null && busy !== 'open' && busy !== 'back' && busy !== 'tone' useEffect\(\(\) => \{ onWorking\?\.\(working\) \}, \[working\]\)/)
    /*
     * And a send that lands after the page has gone (the pop-up closed, a
     * preset changed on the unit) is still written down as on the unit,
     * before anything asks whether the page is there: forgotten, the same
     * capture was offered again and went into a second slot.
     */
    assert.match(card, /if \(went\.ok && went\.got\.name !== NAM_EMPTY\) place\(m\.id, slot, !!went\.got\.name\) if \(!alive\.current\) return if \(!went\.ok\) \{/)
    assert.equal((card.match(/\bplace\(m\.id, slot,/g) || []).length, 1)
    /* The steps and the note are said for the place the page is in, never the Developer page's by default. */
    assert.match(card, /\{stepsFor\(where\)\.map\(/)
    assert.match(card, /\{stepsFoot\(where\)\}/)
    assert.match(card, /\{capturesNote\(where\)\}/)
    assert.ok(!/stepsFor\(\)|stepsFoot\(\)|capturesNote\(\)/.test(card))
    /* The word on the button that was tapped: Get's, though from a held block it plays too. */
    assert.match(card, /setTapped\(play && !back \? 'play' : 'keep'\)/)
    /* Two ways back on a tone there, one over the other: each says where it goes. And no sign-out in a quick-edit pop-up. */
    assert.match(card, /\{where\.held \? BACK_TO_LIST_HELD : BACK_TO_LIST\}/)
    assert.match(card, /export const BACK_TO_LIST_HELD = '‹ Back to the list'/)
    assert.match(card, /\{signedIn && !where\.held \? <Press label="Sign out of TONE3000"/)
    assert.match(door, /<Press label=\{T3K_QUICK\} sub=\{quickSub\(n\)\} tone="live" height=\{56\} onPress=\{onPress\} \/>/)
    /* Never a block that is not a NAM, whatever is handed in; and "held" needs a way back to mean anything. */
    assert.match(card, /const playIn = NAM_BLOCKS\.includes\(block\) \? block : NAM_BLOCKS\[0\]/)
    assert.match(card, /const where = \{ n: NAM_BLOCKS\.indexOf\(playIn\) \+ 1, held: held === true && typeof onDone === 'function' \}/)
    /* Preview: the one send, then the held block pointed at it. It stays on the page. */
    assert.match(card, /onPress=\{\(\) => sendToUnit\(m, null, false, true\)\} \/>/)
    assert.match(card, /setBusy\(`pick \$\{playIn\}`\) const nowPlaying = await point\(playIn, slot, m\.id\)/)
    /* Get, from a held block: the same, and then back, but only where the block answered with what it is playing. */
    assert.match(card, /onPress=\{\(\) => sendToUnit\(m, null, false, where\.held, where\.held\)\} \/>/)
    assert.match(card, /if \(back && nowPlaying && alive\.current\) onDone\?\.\(nowPlaying\)/)
    assert.equal((card.match(/if \(back && nowPlaying && alive\.current\) onDone\?\.\(nowPlaying\)/g) || []).length, 2)
    assert.equal((card.match(/onDone\?\.\(/g) || []).length, 2, 'the pop-up is handed back from somewhere else')
    /*
     * `point` answers with the block's own line only where the unit named
     * what it is playing. A slot it names empty, a pick it refused and one
     * that never came back all answer nothing, so the page stays up with
     * the reason on it rather than going back to knobs over nothing.
     */
    const point = card.slice(card.indexOf('const point = async (block, slot, id) => {'), card.indexOf('const useIn = async'))
    assert.deepEqual(point.match(/return [^ ]+/g), ['return line', 'return null'])
    assert.match(point, /if \(got\.name === NAM_EMPTY\) \{ played\(/)
    assert.match(point, /\} else \{ const line = `\$\{which\} is playing “\$\{got\.name\}” now, through your own rig\. Save the preset to keep it there\.` played\(line\)/)
    const answered = point.indexOf('return line')
    assert.ok(answered > 0 && answered < point.indexOf('} catch (err) {'), 'only a pick the unit answered returns a line')
    /* A send that stopped part-way and is sent again is still the button it was: a Get from a held block still goes back. */
    assert.match(card, /\[m\.id\]: \{ again: err\.slot, fill: err\?\.filled === true, play, back, line \}/)
    assert.match(card, /sendToUnit\(m, halted\.again, halted\.fill, halted\.play, halted\.back === true\)/)
    /* A capture already on the unit, there: hear it in that block, or take it and go back. Not the other block's button, which is not what was held. */
    assert.match(card, /\{there && where\.held \? \( <> <Press label=\{busy === `pick \$\{playIn\}` && mine \? 'Changing…' : `Play it in \$\{namBlockSaid\(where\.n\)\}`\} sub="In the preset the unit is on" height=\{48\} disabled=\{!!busy\} onPress=\{\(\) => useIn\(playIn, at\.slot, m\.id\)\} \/> <Press label=\{USE_AND_BACK\} sub=\{useAndBackSub\(where\.n\)\} tone="live" height=\{48\} disabled=\{!!busy\} onPress=\{\(\) => useIn\(playIn, at\.slot, m\.id, true\)\} \/> <\/> \) : null\}/)
    /* The Developer page is handed nothing, so it is what it was: NAM 1, Get leaves what is playing alone, and nothing goes back anywhere. */
    assert.match(flat(code(read('mobile/src/screens/Settings.js'))), /\{head\('TONE3000', 'back'\)\} <Tone3000Test \/>/)
  })

  test('tone3000 quick: every word says what happens where it is said, for NAM 1 and NAM 2, and none says a preview is not kept', async () => {
    const w = await words()
    assert.deepEqual([w.namBlockSaid(1), w.namBlockSaid(2), w.namBlockSaid(0), w.namBlockSaid(undefined)], ['NAM 1', 'NAM 2', 'NAM 1', 'NAM 1'])
    /* The door, and the way back. */
    assert.equal(w.T3K_QUICK, 'TONE3000')
    assert.equal(w.quickSub(2), 'Browse captures, preview them, and get one for NAM 2')
    assert.equal(w.backToKnobs(2), '‹ Back to NAM 2’s knobs')
    assert.equal(w.USE_AND_BACK, 'Use it and go back')
    assert.equal(w.useAndBackSub(1), 'Plays it in NAM 1 and returns to its knobs')
    /* From a held block: Preview plays there; Get does the same and goes back. Both keep the capture on the unit, and say so. */
    /* "Once NAM 2 is playing it": a Get whose send or pick fails stays on the page with the reason, and the words allow for it. */
    assert.equal(w.capturesNote({ n: 2, held: true }), 'Preview puts the capture in an empty slot on the unit and plays it in NAM 2. Get does the same and, once NAM 2 is playing it, takes you back to its knobs. Either way it stays on the unit.')
    assert.equal(w.getSays('Plexi', { n: 2, held: true }), 'Get Plexi: puts it on the Axe-Fx III, plays it in NAM 2 and goes back to its knobs')
    assert.equal(w.previewSays('Plexi', 2), 'Preview Plexi: puts it on the Axe-Fx III and plays it in NAM 2')
    assert.match(w.stepsFor({ n: 2, held: true })[1], /Preview puts it on the Axe-Fx III and plays it in NAM 2, so you hear it through your own rig\. Get does the same and, once NAM 2 is playing it, takes you back to its knobs\.$/)
    assert.equal(w.stepsFoot({ n: 2, held: true }), 'Which capture NAM 2 plays is not saved until you save the preset, and a capture already on the unit is never written over.')
    /* On its own page they are what they were: NAM 1, and Get leaves what is playing alone. */
    assert.equal(w.capturesNote(), 'Preview and Get both put the capture in an empty slot on the unit, and it stays there. Preview also plays it in NAM 1.')
    assert.match(w.stepsFor()[1], /Get puts it on the unit and leaves what you are playing alone\.$/)
    assert.match(w.stepsFoot(), /^For Preview, the preset you are on needs NAM 1 in it/)
    assert.equal(w.stepsFor().length, 4)
    /* A held block's page never names the block that was not held, and never says the preset needs a block: it was opened from one. */
    for (const n of [1, 2]) {
      const said = [...w.stepsFor({ n, held: true }), w.stepsFoot({ n, held: true }), w.capturesNote({ n, held: true }), w.getSays('X', { n, held: true }), w.previewSays('X', n), w.quickSub(n), w.backToKnobs(n), w.useAndBackSub(n)].join(' ')
      assert.ok(!said.includes(`NAM ${n === 1 ? 2 : 1}`), said)
      assert.ok(!/needs NAM/.test(said), said)
      /* Plain words, and the house rules for them. */
      assert.ok(!/\b(Safari|Chrome|beta|soon|coming|official|this phone|this device)\b/i.test(said), said)
      assert.ok(!/without keeping|try before|temporar|not (be )?kept|isn’t kept|isn't kept|removed after|goes away|quick listen|just listen/i.test(said), said)
      assert.match(said, /stays there|stays on the unit/)
    }
    /* No phone and no screen in the words: a test reads them as they are. */
    assert.ok(!/\bimport\b|\brequire\(/.test(code(read('mobile/src/lib/tone3000Words.js'))))
  })
}
