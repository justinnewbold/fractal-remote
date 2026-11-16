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
    assert.match(sheetSrc, /still = false, scrollKey = undefined, locked = false, children \}\)/)
    /* Another block held, or the pop-up closed, starts on the knobs with nothing said. */
    assert.match(sheet, /useEffect\(\(\) => \{ setBrowsing\(false\) setCame\(''\) \}, \[library\.id\]\)/)
    /* And what the block said it is playing is over the knobs when a Get hands them back. */
    assert.match(sheet, /\{came \? <NowPlayingCard line=\{came\} \/> : null\}/)
    /* Play's own file holds the door and nothing of TONE3000's: no client, no card, no words of its own. */
    const src = code(read('mobile/src/screens/Stage.js'))
    assert.deepEqual([...src.matchAll(/from '([^']*[Tt]one3000[^']*)'/g)].map((m) => m[1]), ['../components/Tone3000Quick'])
    assert.ok(!/TONE3000|t3k\b|tone3000Here|Tone3000Test/.test(src))
  })

  test('tone3000 quick: Preview plays in the block that was held, and Get plays it there and gives the pop-up back to its knobs only once the block says it is playing', () => {
    const door = flat(code(read('mobile/src/components/Tone3000Quick.js')))
    const card = flat(code(read('mobile/src/components/Tone3000Test.js')))
    /* The page is the Developer page's own, told which block it was opened from. */
    assert.match(door, /<Press label=\{from === 'captures' \? BACK_TO_CAPTURES : backToKnobs\(n\)\} height=\{44\} disabled=\{working\} onPress=\{\(\) => onBack\(''\)\} \/> <Tone3000Test block=\{id\} held backTo=\{from\} onDone=\{\(line\) => onBack\(line \|\| ''\)\} onWorking=\{setWorking\} onPointed=\{onPointed\} \/>/)
    assert.match(door, /export function Tone3000InPop\(\{ id, n, onBack, from = 'knobs', onPointed = null \}\)/)
    /* The button's words are in the live colour: over the captures on the unit it is a row's size and shape, and in plain ink read as one more capture. */
    assert.match(door, /export function Tone3000Door\(\{ n, onPress \}\) \{ return <Press label=\{T3K_QUICK\} sub=\{quickSub\(n\)\} tone="live" inkColor=\{color\.live\} subInk=\{color\.live\} height=\{56\} onPress=\{onPress\} \/> \}/)
    /* Both lines of it, and only while it is neither lit nor disabled, like the label's own colour. */
    assert.match(flat(code(read('mobile/src/components/Press.js'))), /color: on \? color\.onSignal : subInk && !disabled \? subInk : color\.silkDim,/)
    /* The way back waits while a capture is being fetched, sent or pointed at, as the page's own Back does; not while TONE3000's page opens or a tone is read. */
    assert.match(card, /const working = busy !== null && busy !== 'open' && busy !== 'back' && busy !== 'tone' useEffect\(\(\) => \{ onWorking\?\.\(working\) \}, \[working\]\)/)
    /*
     * And a send that lands after the page has gone (the pop-up closed, a
     * preset changed on the unit) is still written down as on the unit,
     * before anything asks whether the page is there: forgotten, the same
     * capture was offered again and went into a second slot.
     */
    assert.match(card, /const \{ slot, went \} = await captureToSlot\(\{ id: m\.id, name: rec\.name, again, find, send, log: \(line\) => logDebug\('tone3000', `capture \$\{m\.id\}: \$\{line\}`\) \}\) if \(went === null\) return if \(went\.ok && went\.got\.name && went\.got\.name !== NAM_EMPTY && Number\.isInteger\(went\.way\)\) keptWay = went\.way if \(!alive\.current\) return if \(!went\.ok\) \{/)
    /* Placed by lib/captureSend captureToSlot (run whole in test/bluetooth.mjs, "one capture into one slot"), which has no page to ask after: never by the page itself. */
    assert.ok(!/\bplace\(m\.id/.test(card), 'the page places a capture itself')
    /* The steps and the note are said for the place the page is in, never the Developer page's by default. */
    assert.match(card, /\{stepsFor\(where\)\.map\(/)
    assert.match(card, /\{stepsFoot\(where\)\}/)
    assert.match(card, /\{capturesNote\(where\)\}/)
    assert.ok(!/stepsFor\(\)|stepsFoot\(\)|capturesNote\(\)/.test(card))
    /* The word on the button that was tapped: Get's, though from a held block it plays too. */
    assert.match(card, /setTapped\(play && !back \? 'play' : 'keep'\)/)
    /* Two ways back on a tone there, one over the other: each says where it goes. And no sign-out in a quick-edit pop-up. */
    assert.match(card, /\{where\.held \? BACK_TO_LIST_HELD : BACK_TO_LIST\}/)
    assert.match(card, /export const BACK_TO_LIST_HELD = '‹ Back to the tones'/)
    /* Never "the list": from Edit's capture list the other way back goes to a list too. Read aloud the same. */
    assert.match(card, /accessibilityLabel=\{where\.held \? 'Back to the tones' : 'Back to the list'\}/)
    assert.match(card, /\{signedIn && !where\.held \? <Press label="Sign out of TONE3000"/)
    /* Never a block that is not a NAM, whatever is handed in; and "held" needs a way back to mean anything. */
    assert.match(card, /const playIn = NAM_BLOCKS\.includes\(block\) \? block : NAM_BLOCKS\[0\]/)
    assert.match(card, /const where = \{ n: NAM_BLOCKS\.indexOf\(playIn\) \+ 1, held: held === true && typeof onDone === 'function', back: backTo === 'captures' \? 'captures' : 'knobs' \}/)
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
    assert.match(point, /\} else \{ const line = `\$\{which\} is playing “\$\{got\.name\}” now, through your own rig\. Save the preset to keep it there\.` played\(line, \{ playing: true \}\)/)
    const answered = point.indexOf('return line')
    assert.ok(answered > 0 && answered < point.indexOf('} catch (err) {'), 'only a pick the unit answered returns a line')
    /* A send that stopped part-way and is sent again is still the button it was: a Get from a held block still goes back. */
    assert.match(card, /\[m\.id\]: \{ again: err\.slot, way: Number\.isInteger\(err\?\.way\) \? err\.way : null, play, back, line \}/)
    assert.match(card, /sendToUnit\(m, halted\.again, halted\.way, halted\.play, halted\.back === true\)/)
    /* A capture already on the unit, there: hear it in that block, or take it and go back. Not the other block's button, which is not what was held. */
    assert.match(card, /\{there && where\.held \? \( <> <Press label=\{busy === `pick \$\{playIn\}` && mine \? 'Changing…' : `Play it in \$\{namBlockSaid\(where\.n\)\}`\} sub="In the preset the unit is on" height=\{48\} disabled=\{!!busy\} onPress=\{\(\) => useIn\(playIn, at\.slot, m\.id\)\} \/> <Press label=\{USE_AND_BACK\} sub=\{useAndBackSub\(where\.n, where\.back\)\} tone="live" height=\{48\} disabled=\{!!busy\} onPress=\{\(\) => useIn\(playIn, at\.slot, m\.id, true\)\} \/> <\/> \) : null\}/)
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
    /* Three steps: the fourth named TONE3000's own page, which is not offered (T3K_CATALOG_PAGE). No step names a button the page does not have. */
    assert.equal(w.stepsFor().length, 3)
    assert.equal(w.T3K_CATALOG_PAGE, false)
    for (const at of [{}, { n: 2, held: true }, { n: 1, held: true, back: 'captures' }]) assert.ok(!/Browse TONE3000/.test(w.stepsFor(at).join(' ')))
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

  test('tone3000 quick: on the capture list in Edit it is a button over the captures on the unit, the page takes the list’s place in the same sheet, and Edit reads the block again when the list comes back', async () => {
    const picker = flat(code(read('mobile/src/components/CapturePicker.js')))
    const edit = flat(code(read('mobile/src/screens/Edit.js')))
    const card = flat(code(read('mobile/src/components/Tone3000Test.js')))
    /* The same door as Play's pop-up, by the same rule (a NAM block, an account it is open to): the picker is handed the block it is drawn for. */
    assert.match(picker, /import \{ Tone3000Door, Tone3000InPop, useTone3000Door \} from '\.\/Tone3000Quick'/)
    assert.match(picker, /const library = useTone3000Door\(block\)/)
    assert.match(edit, /<CapturePicker slot=\{capture\.slot\} choosing=\{capturing\} disabled=\{!!restoring \|\| capturing !== null \|\| rereading\} onPick=\{pickCapture\} block=\{block\} onChanged=\{captureChanged\} \/>/)
    /* Over the list ("they see the ones they've already downloaded but then they can also click tone 3000 from that"), and nothing where it is not offered. */
    assert.match(picker, /<View style=\{\{ gap: space\.sm \}\}> \{library\.offered \? <Tone3000Door n=\{library\.n\} onPress=\{browse\} \/> : null\} \{came \? <NowPlayingCard line=\{came\} \/> : null\} \{reading \? <Note>\{reading\}<\/Note> : null\}/)
    assert.equal((picker.match(/<Tone3000Door /g) || []).length, 1)
    /* The page is in the SAME sheet, in the list's place, taller while it is up and starting at its own top; never where it is not offered. */
    assert.match(picker, /tall=\{browsing && library\.offered\} scrollKey=\{browsing && library\.offered \? 'library' : undefined\}/)
    assert.match(picker, /\{open && browsing && library\.offered \? \( <Tone3000InPop id=\{library\.id\} n=\{library\.n\} from="captures" onPointed=\{\(at\) => \{ pointed\.current = at if \(left\.current\) changed\.current\?\.\(at\) \}\} onBack=\{\(line\) => \{ setCame\(line\) setBrowsing\(false\) setNewest\(captures\.done\) loadCaptures\(\) leave\(\) \}\} \/> \) : open \? \(/)
    /*
     * Edit is told with the slot the unit last said the block was pointed
     * at in the library (none at each new visit), through the newest
     * `onChanged`, and a pick that lands after the library was left tells
     * it again.
     */
    assert.match(picker, /const pointed = useRef\(null\) const left = useRef\(true\) const changed = useRef\(onChanged\) changed\.current = onChanged const browse = \(\) => \{ pointed\.current = null left\.current = false setBrowsing\(true\) \} const leave = \(\) => \{ left\.current = true changed\.current\?\.\(pointed\.current\) \}/)
    assert.equal((picker.match(/onChanged/g) || []).length, 3, 'Edit is told from somewhere that does not go through the newest onChanged')
    /* And the page says it: by the unit's own word, for the block it is drawn for, before anything asks whether the page is still up. */
    assert.match(card, /if \(isPlaced\(id\)\) place\(id, slot, true\) if \(block === playIn\) onPointed\?\.\(slot\) return line/)
    /* An empty slot is said too (the block is on it), and a pick that failed says none: it may have landed, so the slot said before it is not vouched for any more. */
    assert.match(card, /unplace\(id\) if \(block === playIn\) onPointed\?\.\(slot\) \} else \{/)
    assert.match(card, /played\(err\?\.message \|\| `\$\{which\} was not changed\.`, \{ playing: false \}\) if \(block === playIn\) onPointed\?\.\(null\) \} return null/)
    assert.equal((card.match(/onPointed\?\.\(/g) || []).length, 3)
    /* And the picker keeps whatever it was last told, none included. */
    assert.match(picker, /onPointed=\{\(at\) => \{ pointed\.current = at /)
    assert.equal((picker.match(/<Sheet /g) || []).length, 1)
    /*
     * When the list comes back: it is read again if a capture was sent
     * (lib/captureListHere marks it changed; loadCaptures asks nothing
     * otherwise), and Edit is told to read the block, which the page may
     * have put on another capture by its own pick. The same when the sheet
     * is closed from the page; and the page is not what is up the next time.
     */
    assert.match(picker, /const close = \(\) => \{ setOpen\(false\) setFind\(''\) if \(browsing\) leave\(\) setBrowsing\(false\) setCame\(''\) \}/)
    assert.match(flat(code(read('mobile/src/lib/captureListHere.js'))), /onCaptureSent\(\(got\) => list\.stale\(got\?\.slot, got\?\.name\)\)/)
    /* The picker still writes nothing to the unit itself, and Edit's own file still holds nothing of TONE3000's. */
    assert.ok(!/chooseCapture|namPickHere|setEnum|setParam|blockParams|lib\/device|Tone3000Test|tone3000Here/.test(picker))
    assert.ok(!/tone3000|t3k/i.test(code(read('mobile/src/screens/Edit.js'))))
    /* Edit's read after it: drawn only where the read says which capture the block is on, and a different capture is a changed preset. */
    assert.match(edit, /const captureChanged = \(pointedAt = null\) => \{ if \(!recapture\.current\) recapture\.current = captureReread\(\(\) => captureEnds\.current\) return recapture\.current\(pointedAt\) \}/)
    assert.match(edit, /captureEnds\.current = \{ read: \(\) => blockParams\(eid\), held: \(\) => !!restoring \|\| ownPick\.current, now: \(\) => captureNow\.current\?\.slot, show: \(fresh\) => \{ setParams\(fresh\.named \|\| \[\]\) setEnums\(fresh\.enums \|\| \[\]\) setLayout\(fresh\.layout \|\| null\) setCapture\(fresh\.capture\) captureNow\.current = fresh\.capture \}, point: \(slot\) => \{ setCapture\(\{ slot \}\) captureNow\.current = \{ slot \} \}, edited: noteEdited, busy: setRereading \}/)
    assert.match(edit, /const captureNow = useRef\(null\) captureNow\.current = capture const captureEnds = useRef\(null\) const recapture = useRef\(null\) const ownPick = useRef\(false\)/)
    /* A pick of Edit's own, its read after a failure included, holds the outside one back, and lets it read when it is over. */
    assert.match(edit, /const pickCapture = async \(slot\) => \{ if \(restoring \|\| capturing !== null \|\| rereading\) return ownPick\.current = true setCapturing\(slot\)/)
    assert.match(edit, /\} finally \{ ownPick\.current = false setCapturing\(null\) setRereading\(false\) recapture\.current\?\.after\(\) \} \}/)
    assert.equal((edit.match(/ownPick\.current = /g) || []).length, 2)
    /* The words there: where Get goes back to is the captures on the unit, never "its knobs". */
    const w = await words()
    assert.equal(w.BACK_TO_CAPTURES, '‹ Back to the captures on the unit')
    const at = { n: 1, held: true, back: 'captures' }
    assert.equal(w.capturesNote(at), 'Preview puts the capture in an empty slot on the unit and plays it in NAM 1. Get does the same and, once NAM 1 is playing it, takes you back to the captures on the unit. Either way it stays on the unit.')
    assert.equal(w.getSays('Plexi', at), 'Get Plexi: puts it on the Axe-Fx III, plays it in NAM 1 and goes back to the captures on the unit')
    assert.equal(w.useAndBackSub(1, 'captures'), 'Plays it in NAM 1 and returns to the captures on the unit')
    assert.match(w.stepsFor(at)[1], /Get does the same and, once NAM 1 is playing it, takes you back to the captures on the unit\.$/)
    const said = [...w.stepsFor(at), w.stepsFoot(at), w.capturesNote(at), w.getSays('X', at), w.useAndBackSub(1, 'captures'), w.BACK_TO_CAPTURES].join(' ')
    assert.ok(!/knobs/.test(said), said)
    assert.ok(!/\b(Safari|Chrome|beta|soon|coming|official|this phone|this device)\b/i.test(said), said)
    assert.ok(!/without keeping|try before|temporar|not (be )?kept|isn’t kept|isn't kept|removed after|goes away|quick listen|just listen/i.test(said), said)
    /* From the knobs they are what they were. */
    assert.equal(w.useAndBackSub(2), 'Plays it in NAM 2 and returns to its knobs')
    assert.equal(w.getSays('Plexi', { n: 2, held: true, back: 'anything else' }), 'Get Plexi: puts it on the Axe-Fx III, plays it in NAM 2 and goes back to its knobs')
    /* The sheet's own note while the page is up says what it is, in the picker's own plain words. */
    assert.match(picker, /note=\{browsing && library\.offered \? 'Captures from TONE3000\. One you preview or get plays on the channel this block is on\.' : newest \? 'The captures on the unit, newest first\. The one picked plays on the channel this block is on\.' : 'The captures on the unit\. The one picked plays on the channel this block is on\.'\}/)
  })

  test('tone3000 quick: Edit reads the block again after the capture list’s page changed its capture: no call dropped, and the unit’s own word believed where the read fails', async () => {
    const { captureReread } = await import('../mobile/src/lib/captureReread.js')
    /* A stand-in for Edit: what the button is on, what was drawn, and reads that answer when told to. */
    const bench = (slot = 5) => {
      const b = { slot, held: false, edited: 0, shown: [], pointed: [], busy: [], reads: [] }
      b.ends = {
        read: () => new Promise((resolve, reject) => b.reads.push({ resolve, reject })),
        held: () => b.held,
        now: () => b.slot,
        show: (fresh) => {
          b.shown.push(fresh.capture.slot)
          b.slot = fresh.capture.slot
        },
        point: (at) => {
          b.pointed.push(at)
          b.slot = at
        },
        edited: () => b.edited++,
        busy: (yes) => b.busy.push(yes)
      }
      b.go = captureReread(() => b.ends)
      return b
    }
    const tick = () => new Promise((r) => setImmediate(r))

    /* A read that says another capture: drawn, and the preset is changed. */
    let b = bench(5)
    let done = b.go()
    assert.deepEqual(b.busy, [true])
    b.reads[0].resolve({ capture: { slot: 29 }, named: [] })
    await done
    assert.deepEqual([b.shown, b.edited, b.busy, b.pointed], [[29], 1, [true, false], []])

    /* The same capture as before: drawn, nothing changed. */
    b = bench(5)
    done = b.go()
    b.reads[0].resolve({ capture: { slot: 5 } })
    await done
    assert.deepEqual([b.shown, b.edited], [[5], 0])

    /* A read with no capture (through the computer, a read that failed) and no word from the unit: nothing drawn, nothing changed. */
    b = bench(5)
    done = b.go()
    b.reads[0].resolve({ named: [], enums: [] })
    await done
    assert.deepEqual([b.shown, b.pointed, b.edited, b.slot, b.busy], [[], [], 0, 5, [true, false]])

    /* The same read, with the slot the unit said the block was pointed at: the button goes there and the preset is changed. */
    b = bench(5)
    done = b.go(29)
    b.reads[0].resolve({ named: [] })
    await done
    assert.deepEqual([b.shown, b.pointed, b.edited, b.slot], [[], [29], 1, 29])

    /* A read that throws, the same. And pointed at the slot it was on already: no change to save. */
    b = bench(5)
    done = b.go(29)
    b.reads[0].reject(new Error('no answer'))
    await done
    assert.deepEqual([b.pointed, b.edited, b.busy], [[29], 1, [true, false]])
    b = bench(29)
    done = b.go(29)
    b.reads[0].reject(new Error('no answer'))
    await done
    assert.deepEqual([b.pointed, b.edited], [[29], 0])

    /* A read that answers is the unit's word on the whole block, and wins over the slot handed in. */
    b = bench(5)
    done = b.go(29)
    b.reads[0].resolve({ capture: { slot: 30 } })
    await done
    assert.deepEqual([b.shown, b.pointed, b.slot], [[30], [], 30])

    /*
     * One that comes while a read is out is not dropped: the read out may
     * have left before the change, so the block is read once more, and what
     * the unit said the second time is what a failed second read falls back
     * on.
     */
    b = bench(5)
    done = b.go()
    await b.go(31)
    assert.equal(b.reads.length, 1, 'two reads of the block are out at once')
    b.reads[0].resolve({ capture: { slot: 5 } })
    await tick()
    assert.equal(b.reads.length, 2, 'a change told while the block was being read is dropped')
    assert.deepEqual(b.busy, [true], 'the picker is let go between the two reads')
    b.reads[1].resolve({})
    await done
    assert.deepEqual([b.shown, b.pointed, b.edited, b.slot, b.busy], [[5], [31], 1, 31, [true, false]])
    /* And three while one is out are one more read, not three. */
    b = bench(5)
    done = b.go()
    b.go()
    b.go()
    b.go()
    b.reads[0].resolve({ capture: { slot: 5 } })
    await tick()
    b.reads[1].resolve({ capture: { slot: 5 } })
    await done
    await tick()
    assert.equal(b.reads.length, 2)

    /* While a pick or a restore of Edit's own is under way it reads the block itself: nothing is asked, and the slot handed in is not kept for a later call. */
    b = bench(5)
    b.held = true
    await b.go(29)
    assert.deepEqual([b.reads.length, b.busy], [0, []])
    b.held = false
    done = b.go()
    b.reads[0].resolve({})
    await done
    assert.deepEqual([b.pointed, b.edited], [[], 0], 'a slot from a call that was not taken up is used by a later one')
    /*
     * But the call is remembered: the pick's own read may have left before
     * the change, so when the pick is over the block is read once more.
     * With no slot vouched for (which pick reached the unit last is not
     * known), once, and not at all where nothing was told meanwhile.
     */
    b = bench(5)
    assert.equal(b.go.after(), undefined)
    assert.equal(b.reads.length, 0, 'the block is read after a pick though nothing was told')
    b.held = true
    await b.go(29)
    await b.go.after()
    assert.equal(b.reads.length, 0, 'read while the pick still holds it')
    b.held = false
    done = b.go.after()
    assert.equal(b.reads.length, 1, 'a change told during a pick of Edit’s own is lost')
    b.reads[0].resolve({})
    await done
    assert.deepEqual([b.pointed, b.edited, b.busy], [[], 0, [true, false]])
    assert.equal(b.go.after(), undefined)
    assert.equal(b.reads.length, 1, 'read again with nothing new told')
    /* A read of its own since then covers it. */
    b = bench(5)
    b.held = true
    await b.go()
    b.held = false
    done = b.go()
    b.reads[0].resolve({ capture: { slot: 5 } })
    await done
    assert.equal(b.go.after(), undefined)
    assert.equal(b.reads.length, 1)

    /* What it goes by is asked for when it runs: a closure made before a drawing still reaches the newest ends. */
    b = bench(5)
    const old = b.go
    b.ends = { ...b.ends, now: () => 29 }
    done = old()
    b.reads[0].resolve({ capture: { slot: 29 } })
    await done
    assert.equal(b.edited, 0, 'the slot the button is on is the one from when the closure was made')

    /* The slot handed in is forgotten when the job ends. */
    b = bench(5)
    done = b.go(29)
    b.reads[0].resolve({ capture: { slot: 29 } })
    await done
    done = b.go()
    b.reads[1].resolve({})
    await done
    assert.deepEqual(b.pointed, [])

    /* It imports nothing, so this test is the whole of it. */
    assert.ok(!/\bimport\b|require\(/.test(code(read('mobile/src/lib/captureReread.js'))))
  })
}
