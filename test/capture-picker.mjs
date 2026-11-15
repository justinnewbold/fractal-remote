/**
 * WHICH CAPTURE A NAM BLOCK PLAYS, CHOSEN IN EDIT (mobile/src/lib/
 * captureList.js, lib/captureListHere.js, components/CapturePicker.js,
 * screens/Edit.js).
 *
 * "then a capture picker in Edit (the list of all 257, read once and kept,
 * and the same typed write)" was the next thing on the list after the
 * captures themselves. Edit said "The capture is chosen on the unit itself."
 * His account first.
 *
 * The list's own rules are run here against a pretend asker; the messages
 * that reach a unit are held in test/bluetooth.mjs against the stand-in
 * Axe-Fx III, and the computer's half in ForgeFX's own tests.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

const lib = () => import('../mobile/src/lib/captureList.js')

/**
 * A pretend unit: which slots hold what, and an asker over it that answers
 * a piece as the wire and the computer do ({ from, heads, stopped? }).
 * `silent` is slots that say nothing, each for that many asks.
 */
function unit(held = { 0: 'Brit Crunch', 1: 'Clean One', 2: 'High Gain Three', 28: 'MV25 Ch1 Crunch', 255: 'The Last One', 256: 'MV25 Ch1 Crunch' }) {
  const u = { held: { ...held }, asked: [], pieces: [], silent: {}, busy: 0, fail: null, order: [] }
  const head = (slot) => {
    const name = u.held[slot]
    return name ? { slot, name, by: 'somebody', make: 'Marshall', model: 'JCM', gearType: 'amp', toneType: 'crunch', empty: false } : { slot, name: '<EMPTY>', by: '', make: '', model: '', gearType: '', toneType: '', empty: true }
  }
  const heads = async (from, count) => {
    u.pieces.push([from, count])
    u.order.push(`heads ${from}`)
    if (u.fail) throw u.fail
    if (u.busy > 0) {
      u.busy--
      throw Object.assign(new Error('The capture tools are already at work. Try again in a moment.'), { status: 409 })
    }
    const out = []
    for (let slot = from; slot < Math.min(257, from + count); slot++) {
      u.asked.push(slot)
      if (u.silent[slot] > 0) {
        u.silent[slot]--
        return { from, heads: out, stopped: slot }
      }
      out.push(head(slot))
    }
    return { from, heads: out }
  }
  return { u, heads }
}

/*
 * A clock for the list. Its time moves only when everything that can run at
 * the present moment has run: then the earliest wait is over. So two waits
 * begun together end together, as on a real clock, and `pauses` says how long
 * each one asked for.
 */
function clock() {
  const c = { t: 0, pauses: [], waiting: [] }
  let due = false
  const tick = () => {
    if (due) return
    due = true
    setImmediate(() => {
      due = false
      if (!c.waiting.length) return
      c.waiting.sort((a, b) => a.at - b.at)
      const next = c.waiting.shift()
      c.t = Math.max(c.t, next.at)
      next.done()
      if (c.waiting.length) tick()
    })
  }
  c.now = () => c.t
  c.pause = (ms) =>
    new Promise((done) => {
      c.pauses.push(Math.round(ms))
      c.waiting.push({ at: c.t + ms, done })
      tick()
    })
  return c
}

export function run(test) {
  test('capture picker: a capture is said by its number as the unit counts it and its name, and found by any of its words', async () => {
    const c = await lib()
    assert.equal(c.CAPTURES_LISTED, 256)
    assert.equal(c.CAPTURES_SHOWN, 40)
    assert.equal(c.captureNumber(0), '001')
    assert.equal(c.captureNumber(28), '029')
    assert.equal(c.captureNumber(255), '256')
    assert.equal(c.captureSaid(28, { name: 'MV25 Ch1 Crunch' }), '029 MV25 Ch1 Crunch')
    /* Until its name is known, its number alone; an empty slot is said as empty; and nothing where there is no slot. */
    assert.equal(c.captureSaid(28, null), '029')
    assert.equal(c.captureSaid(4, { name: '<EMPTY>', empty: true }), '005 (empty)')
    assert.equal(c.captureSaid(null, null), '')
    /* Under the name: who made it and of what, where the capture says, and nothing where it does not. */
    assert.equal(c.captureMore({ by: 'somebody', make: 'Marshall', model: 'JCM 800' }), 'by somebody · Marshall JCM 800')
    assert.equal(c.captureMore({ by: '', make: 'Orange', model: '' }), 'Orange')
    assert.equal(c.captureMore({ by: 'me' }), 'by me')
    assert.equal(c.captureMore({}), '')
    assert.equal(c.captureMore(null), '')
    const list = [
      { slot: 0, name: 'Brit Crunch', by: 'somebody', make: 'Marshall', model: 'JCM' },
      { slot: 28, name: 'MV25 Ch1 Crunch', by: 'other', make: 'Mesa', model: 'Mark V' },
      { slot: 100, name: 'Clean One', by: 'somebody', make: 'Fender', model: 'Twin' }
    ]
    assert.deepEqual(c.capturesFound(list, '').map((h) => h.slot), [0, 28, 100])
    assert.deepEqual(c.capturesFound(list, 'crunch').map((h) => h.slot), [0, 28])
    assert.deepEqual(c.capturesFound(list, 'CRUNCH mesa').map((h) => h.slot), [28])
    assert.deepEqual(c.capturesFound(list, '029').map((h) => h.slot), [28])
    assert.deepEqual(c.capturesFound(list, 'fender twin').map((h) => h.slot), [100])
    assert.deepEqual(c.capturesFound(list, 'somebody').map((h) => h.slot), [0, 100])
    assert.deepEqual(c.capturesFound(list, 'zzz'), [])
    /* Nothing the app shows of it names the device in hand, promises anything, or calls it a test. */
    for (const said of [c.NO_CAPTURE_LIST, c.CAPTURES_STOPPED, c.captureNotAsListed(29, 'Listed Name', 'Real Name'), c.captureNotAsListed(29, 'Listed Name', '<EMPTY>')]) assert.ok(!/this phone|beta|\bsoon\b|coming|tried|official/i.test(said), said)
    /* A pick from a row whose name was not what the unit had there: said with both names and the slot as the unit counts it. */
    assert.equal(c.captureNotAsListed(29, 'Listed Name', 'Real Name'), 'The unit has “Real Name” in slot 030, not “Listed Name”. The list of captures will be read again.')
    assert.equal(c.captureNotAsListed(29, 'Listed Name', '<EMPTY>'), 'Slot 030 is empty on the unit now, not “Listed Name”. The list of captures will be read again.')
  })

  test('capture picker: the newest captures are on top, and the list goes from newest to oldest', async () => {
    /*
     * "Change it so the newest added captures are at the top of the list, and
     * go from newest to oldest." The unit says nothing of when a capture was
     * added, so: a capture the list saw arrive, latest first; then the rest
     * by slot, highest first (a capture is loaded into the first empty slot,
     * which on a unit as it comes is the one after Fractal's own).
     */
    const c = await lib()
    const rows = [{ slot: 0, name: 'A' }, { slot: 28, name: 'B' }, { slot: 34, name: 'C' }, { slot: 5, name: 'D', added: 2000 }, { slot: 40, name: 'E', added: 1000 }, { slot: 7, name: 'F', added: 2000 }]
    assert.deepEqual(c.newestFirst(rows).map((h) => h.name), ['F', 'D', 'E', 'C', 'B', 'A'])
    assert.deepEqual(rows.map((h) => h.name), ['A', 'B', 'C', 'D', 'E', 'F'], 'the list handed in was put in another order')
    assert.deepEqual(c.newestFirst([{ slot: 3, name: 'x', added: 'soon' }, { slot: 9, name: 'y', added: NaN }, { slot: 1, name: 'z' }]).map((h) => h.slot), [9, 3, 1], 'a stamp that is no time counts as none')
    assert.deepEqual(c.newestFirst([{ slot: 3, name: 'x', added: 'soon' }, { slot: 1, name: 'y', added: 5 }, { slot: 2, name: 'z', added: Infinity }]).map((h) => h.slot), [1, 3, 2])
    for (const none of [null, undefined, 'text']) assert.deepEqual(c.newestFirst(none), [])

    /* THE FIRST READ: every capture is new to the app and none is new to the unit. Nothing is stamped, and the order is the slots', highest first. */
    const { u, heads } = unit({ 0: 'Brit Crunch', 1: 'Clean One', 28: 'MV25 Ch1 Crunch', 29: 'Orange Flat', 256: 'MV25 Ch1 Crunch' })
    let t = 1000
    const kept = []
    const list = c.captureList({ heads, pause: async () => {}, now: () => t, rest: () => 0, keep: (k) => kept.push(JSON.parse(JSON.stringify(k))) })
    const first = await list.load()
    assert.ok(first.list.every((h) => h.added === undefined), 'a capture was called newly arrived on the first read of a unit')
    assert.deepEqual(first.list.map((h) => h.slot), [0, 1, 28, 29], 'the list itself is no longer kept in slot order')
    assert.deepEqual(c.newestFirst(first.list).map((h) => h.slot), [29, 28, 1, 0])
    assert.ok(kept.at(-1).heads.every((h) => !('added' in h)))

    /*
     * A capture loaded since, INTO A GAP BELOW the others (the first empty
     * slot is wherever one is): by its slot it would be in the middle of
     * Fractal's own. It was seen to arrive, so it is on top; and one that
     * arrives after it goes over it.
     */
    u.held[5] = 'Jcm800'
    list.stale()
    t = 5000
    const second = await list.load()
    assert.equal(second.list.find((h) => h.slot === 5).added, 5000)
    assert.deepEqual(c.newestFirst(second.list).map((h) => h.slot), [5, 29, 28, 1, 0])
    u.held[30] = 'MES DRECF'
    list.stale()
    t = 9000
    const third = await list.load()
    assert.deepEqual(c.newestFirst(third.list).map((h) => [h.slot, h.added]), [[30, 9000], [5, 5000], [29, undefined], [28, undefined], [1, undefined], [0, undefined]])
    /* Read again with nothing new: the same capture in the same slot keeps the time it arrived, it does not arrive again. */
    list.stale()
    t = 20000
    assert.deepEqual(c.newestFirst((await list.load()).list).map((h) => [h.slot, h.added]).slice(0, 2), [[30, 9000], [5, 5000]])
    /* ANOTHER capture put in a slot that held one is one that arrived; an emptied slot has no stamp to leave behind. */
    u.held[28] = 'Replaced'
    delete u.held[5]
    list.stale()
    t = 30000
    const fourth = await list.load()
    assert.deepEqual(c.newestFirst(fourth.list).map((h) => [h.slot, h.added]), [[28, 30000], [30, 9000], [29, undefined], [1, undefined], [0, undefined]])
    u.held[5] = 'Back Again'
    list.stale()
    t = 40000
    assert.equal((await list.load()).list.find((h) => h.slot === 5).added, 40000)

    /* WRITTEN DOWN AND REMEMBERED: the next launch shows the same order, and remembering a capture is not seeing it arrive. */
    const written = kept.at(-1)
    assert.deepEqual(written.heads.filter((h) => 'added' in h).map((h) => [h.slot, h.added]), [[5, 40000], [28, 30000], [30, 9000]])
    const next = unit(u.held)
    const later = c.captureList({ heads: next.heads, pause: async () => {}, now: () => 99999, rest: () => 0 })
    assert.equal(later.recall(written), true)
    assert.deepEqual(c.newestFirst(later.get().list).map((h) => [h.slot, h.added]), [[5, 40000], [28, 30000], [30, 9000], [29, undefined], [1, undefined], [0, undefined]])
    assert.deepEqual(next.u.asked, [])

    /* A capture a block was pointed at, in a slot the list had as empty: seen to arrive there and then (the app has just sent it). */
    const noted = c.captureList({ heads: unit().heads, pause: async () => {}, now: () => 777, rest: () => 0 })
    await noted.load()
    noted.note(40, 'Sent Just Now')
    assert.deepEqual(c.newestFirst(noted.get().list).map((h) => [h.slot, h.added])[0], [40, 777])
    noted.note(0, 'Brit Crunch')
    assert.equal(noted.get().list.find((h) => h.slot === 0).added, undefined, 'a capture that was there all along was called new when a block was pointed at it')
    noted.note(40, '<EMPTY>')
    assert.equal(noted.head(40).added, undefined)

    /*
     * AND A CAPTURE SENT JUST BEFORE THE APP WAS CLOSED IS READ IN THE NEXT
     * TIME: "out of date" is written down with the list, where it was only
     * ever kept in memory, and the list remembered says so and is read again
     * when the picker is next opened.
     */
    const disk = []
    const sender = unit({ 0: 'Brit Crunch' })
    const before = c.captureList({ heads: sender.heads, pause: async () => {}, now: () => 50, rest: () => 0, keep: (k) => disk.push(JSON.parse(JSON.stringify(k))) })
    await before.load()
    assert.equal(disk.at(-1).stale, undefined)
    sender.u.held[1] = 'Sent, Then Closed'
    before.stale()
    assert.equal(disk.at(-1).stale, true, 'that the list is out of date was not written down')
    const relaunch = unit(sender.u.held)
    const after = c.captureList({ heads: relaunch.heads, pause: async () => {}, now: () => 60, rest: () => 0, keep: (k) => disk.push(JSON.parse(JSON.stringify(k))) })
    assert.equal(after.recall(disk.at(-1)), true)
    assert.equal(after.get().stale, true)
    assert.deepEqual(after.get().list.map((h) => h.slot), [0])
    const reread = await after.load()
    assert.ok(relaunch.u.asked.length > 0, 'a list remembered as out of date was not read again')
    assert.deepEqual(c.newestFirst(reread.list).map((h) => [h.name, h.added]), [['Sent, Then Closed', 60], ['Brit Crunch', undefined]])
    assert.equal(disk.at(-1).stale, undefined, 'a list just read whole is still written down as out of date')
    /* Nothing is written down for a list that was never read: there is none to keep. */
    const blank = []
    c.captureList({ heads: unit().heads, pause: async () => {}, keep: (k) => blank.push(k) }).stale()
    assert.deepEqual(blank, [])

    /* The picker draws that order, and finds in it; the sheet says which order it is. */
    const picker = read('mobile/src/components/CapturePicker.js')
    assert.match(picker, /const found = capturesFound\(newest \? newestFirst\(captures\.list\) : captures\.list, find\)/)
    assert.match(picker, /: newest \? 'The captures on the unit, newest first\. The one picked plays on the channel this block is on\.' : 'The captures on the unit\. The one picked plays on the channel this block is on\.'\}/)
    /*
     * THE ORDER IS SETTLED AS THE LIST COMES UP, never while it is on show:
     * a first read comes in by slot, and newest first each piece went in
     * over the rows already drawn. So it is newest first only for a list
     * that had been read whole when the sheet was opened (or when the list
     * came back from TONE3000's page), and nothing else moves it.
     */
    const flatPicker = flat(code(picker))
    assert.match(flatPicker, /const \[newest, setNewest\] = useState\(false\)/)
    assert.match(flatPicker, /const show = \(\) => \{ setFind\(''\) setCame\(''\) setNewest\(captures\.done\) setOpen\(true\) loadCaptures\(\) \}/)
    assert.match(flatPicker, /onBack=\{\(line\) => \{ setCame\(line\) setBrowsing\(false\) setNewest\(captures\.done\) loadCaptures\(\) leave\(\) \}\}/)
    assert.equal(flatPicker.match(/setNewest\(/g).length, 2, 'the order is settled somewhere else too')
  })

  test('capture picker: a slot one read missed is not a new capture when it answers again, and a capture the app sent is new even on a first read', async () => {
    /*
     * What an independent read of "newest first" found. A slot that says
     * nothing for one read is taken out of the list; when it answered again
     * it was "unheard of", so one of Fractal's own captures went to the top
     * as the newest, and stayed there (the stamp is kept on the device).
     */
    const c = await lib()
    const mk = (held, t0 = 1000) => {
      const made = unit(held)
      const kept = []
      const clock = { t: t0 }
      const list = c.captureList({ heads: made.heads, pause: async () => {}, now: () => clock.t, rest: () => 0, keep: (k) => kept.push(JSON.parse(JSON.stringify(k))) })
      const again = async (t) => {
        clock.t = t
        list.stale()
        return list.load()
      }
      return { u: made.u, heads: made.heads, kept, clock, list, again }
    }
    const order = (got) => c.newestFirst(got.list).map((h) => [h.slot, h.added])

    /* Missed by one read, back the next under the name it always had: where it was, with no stamp. And what was set aside is written down, then forgotten once the slot has answered. */
    const a = mk({ 0: 'Brit Crunch', 12: 'Fractal Twelve', 20: 'Orange Flat' })
    await a.list.load()
    a.u.silent[12] = 2
    assert.deepEqual((await a.again(2000)).list.map((h) => h.slot), [0, 20])
    assert.deepEqual(a.kept.at(-1).gone, [{ slot: 12, name: 'Fractal Twelve' }])
    assert.deepEqual(order(await a.again(3000)), [[20, undefined], [12, undefined], [0, undefined]], 'a capture that was there all along came back as the newest')
    assert.equal(a.kept.at(-1).gone, undefined, 'a slot that has answered is still written down as left out')

    /* One that HAD been seen to arrive keeps when, through one read that missed it and through two running. */
    const b = mk({ 0: 'Brit Crunch' })
    await b.list.load()
    b.u.held[5] = 'Jcm800'
    assert.deepEqual(order(await b.again(5000))[0], [5, 5000])
    b.u.silent[5] = 2
    await b.again(6000)
    assert.deepEqual(b.kept.at(-1).gone, [{ slot: 5, name: 'Jcm800', added: 5000 }])
    b.u.silent[5] = 2
    await b.again(7000)
    assert.deepEqual(b.kept.at(-1).gone, [{ slot: 5, name: 'Jcm800', added: 5000 }], 'missed a second time, what the slot held was forgotten')
    assert.deepEqual(order(await b.again(8000))[0], [5, 5000], 'a capture missed by a read lost when it arrived')

    /* ANOTHER capture in a slot that was missed is one that arrived. */
    const d = mk({ 0: 'Brit Crunch', 12: 'Fractal Twelve' })
    await d.list.load()
    d.u.silent[12] = 2
    await d.again(2000)
    d.u.held[12] = 'Something Else'
    assert.deepEqual(order(await d.again(3000))[0], [12, 3000])

    /* A slot that has NEVER answered (silent on the very first read) is not known to be new when it does. */
    const e = mk({ 0: 'Brit Crunch', 12: 'Fractal Twelve' })
    e.u.silent[12] = 2
    assert.deepEqual((await e.list.load()).list.map((h) => h.slot), [0])
    assert.deepEqual(e.kept.at(-1).gone, [{ slot: 12 }])
    assert.deepEqual(order(await e.again(3000)), [[12, undefined], [0, undefined]], 'a slot that had never answered was called a new capture')

    /* An EMPTY slot that was missed, with a capture in it afterwards: that one arrived. And an empty slot is not written down, left out or not. */
    const f = mk({ 0: 'Brit Crunch' })
    await f.list.load()
    f.u.silent[13] = 2
    await f.again(2000)
    assert.equal(f.kept.at(-1).gone, undefined)
    f.u.held[13] = 'Into The Gap'
    assert.deepEqual(order(await f.again(3000))[0], [13, 3000])

    /* A block pointed at a missed slot says its name: the same rule, by that way in. */
    const g = mk({ 0: 'Brit Crunch', 12: 'Fractal Twelve' })
    await g.list.load()
    g.u.silent[12] = 2
    await g.again(2000)
    g.clock.t = 2500
    g.list.note(12, 'Fractal Twelve')
    assert.equal(g.list.head(12).added, undefined)

    /* AND AFTER THE APP HAS BEEN CLOSED: what was set aside is remembered with the list. Only what can be a slot left out is taken back. */
    const disk = { at: 1, heads: [{ slot: 0, name: 'Brit Crunch' }], gone: [{ slot: 12, name: 'Fractal Twelve' }, { slot: 14 }, { slot: 15, name: 'Stamped', added: 444 }, { slot: 0, name: 'Listed Too' }, { slot: -1, name: 'No Slot' }, { slot: 'x' }, null] }
    const h = mk({ 0: 'Brit Crunch', 12: 'Fractal Twelve', 14: 'Never Heard', 15: 'Stamped', 16: 'Really New' }, 9000)
    assert.equal(h.list.recall(disk), true)
    h.list.stale()
    assert.deepEqual(h.kept.at(-1).gone, [{ slot: 12, name: 'Fractal Twelve' }, { slot: 14 }, { slot: 15, name: 'Stamped', added: 444 }])
    assert.deepEqual(order(await h.list.load()), [[16, 9000], [15, 444], [14, undefined], [12, undefined], [0, undefined]])

    /*
     * A CAPTURE THE APP SENT DURING THE FIRST READ. Nothing is stamped on a
     * first read, so the one just sent sat among the others by its slot,
     * under any capture in a higher slot, for good. The send says which slot
     * it went into, and that one is stamped with when it was sent.
     */
    const s = mk({ 0: 'Brit Crunch', 40: 'Factory 40' }, 1234)
    s.u.held[20] = 'Sent From TONE3000'
    s.list.stale(20)
    s.clock.t = 5000
    assert.deepEqual(order(await s.list.load()), [[20, 1234], [40, undefined], [0, undefined]], 'a capture the app sent during the first read is not on top')
    assert.deepEqual(order(await s.again(6000)), [[20, 1234], [40, undefined], [0, undefined]])
    /* Said once: another capture in that slot later is stamped when IT is seen, not with the old send's time. */
    s.u.held[20] = 'Loaded With The Editor'
    assert.deepEqual(order(await s.again(7000))[0], [20, 7000])
    /* A capture sent OVER one of the same name is new all the same. */
    s.clock.t = 8000
    s.list.stale(0)
    s.clock.t = 8500
    assert.deepEqual(order(await s.list.load())[0], [0, 8000])
    /* And a send that says no slot (an older computer app) marks the list out of date and nothing more. */
    const quiet = mk({ 0: 'Brit Crunch', 2: 'Two', 3: 'Three' })
    for (const none of [undefined, null, '3', 2.5, '2']) quiet.list.stale(none, 'A Name With No Slot')
    assert.deepEqual(order(await quiet.list.load()), [[3, undefined], [2, undefined], [0, undefined]])
    assert.equal(quiet.list.get().list.some((h) => h.name === 'A Name With No Slot'), false)
    /* Nor does an answer with no name in it put a nameless row in the list. */
    quiet.list.stale(6, '  ')
    assert.equal(quiet.list.head(6).empty, true)
    assert.equal(quiet.list.get().list.some((h) => h.slot === 6), false)

    /*
     * A SEND THE UNIT DID NOT KEEP (it has dropped three of his): the slot
     * reads empty afterwards, and that ends the send. Left standing, its
     * time went to whatever was loaded into that slot later, which then sat
     * UNDER a capture sent before it.
     */
    const dropped = mk({ 0: 'Brit Crunch', 1: 'Factory' })
    await dropped.list.load()
    dropped.clock.t = 2000
    dropped.list.stale(5)
    await dropped.list.load()
    dropped.u.held[7] = 'Sent Later'
    dropped.clock.t = 3000
    dropped.list.stale(7)
    await dropped.list.load()
    dropped.u.held[5] = 'Loaded With The Editor'
    assert.deepEqual(order(await dropped.again(9000)).slice(0, 2), [[5, 9000], [7, 3000]], 'a capture loaded later took the time of a send the unit had dropped')
    /* The same where the send's own answer says the slot is still empty. */
    const said = mk({ 0: 'Brit Crunch' })
    await said.list.load()
    said.clock.t = 2000
    said.list.stale(5, '<EMPTY>')
    assert.equal(said.list.head(5).empty, true)
    said.u.held[5] = 'Loaded With The Editor'
    assert.deepEqual(order(await said.again(9000))[0], [5, 9000])

    /*
     * AND THE CAPTURE IS IN THE LIST AS THE SEND ENDS, where its answer says
     * what the slot holds: on top at once, before anything is read again.
     * The list that came back from TONE3000's page did not have it until
     * the read reached its slot, seconds later, and then it went in over the
     * rows on show. The read that follows finds the same capture there and
     * moves nothing.
     */
    const got = mk({ 0: 'Brit Crunch', 29: 'Factory 29' })
    await got.list.load()
    got.u.held[30] = 'Sent From TONE3000'
    got.clock.t = 4000
    got.list.stale(30, 'Sent From TONE3000 ')
    assert.deepEqual(order(got.list.get()), [[30, 4000], [29, undefined], [0, undefined]], 'a capture just sent is not in the list until it is read again')
    assert.equal(got.list.get().stale, true)
    assert.deepEqual(got.kept.at(-1).heads.find((h) => h.slot === 30), { slot: 30, name: 'Sent From TONE3000', by: '', make: '', model: '', added: 4000 })
    assert.equal(got.kept.at(-1).stale, true)
    got.clock.t = 5000
    assert.deepEqual(order(await got.list.load()), [[30, 4000], [29, undefined], [0, undefined]])
    /* The same capture is the same however its name was spaced: one way in trims what the unit said, the list's own read does not. */
    got.u.held[8] = 'Spaced Out '
    got.clock.t = 6000
    got.list.note(8, 'Spaced Out ')
    assert.equal(got.list.head(8).added, 6000)
    assert.equal((await got.again(7000)).list.find((h) => h.slot === 8).added, 6000, 'a capture arrived a second time for a space after its name')
    /* On a first read too: named by its send, stamped by it, and the read keeps both. */
    const early = mk({ 0: 'Brit Crunch', 40: 'Factory 40' }, 1234)
    early.u.held[20] = 'Sent From TONE3000'
    early.list.stale(20, 'Sent From TONE3000')
    assert.deepEqual(order(early.list.get()), [[20, 1234]])
    early.clock.t = 5000
    assert.deepEqual(order(await early.list.load()), [[20, 1234], [40, undefined], [0, undefined]])

    assert.match(flat(code(read('mobile/src/lib/captureListHere.js'))), /onCaptureSent\(\(got\) => list\.stale\(got\?\.slot, got\?\.name\)\)/)
  })

  test('capture picker: the list is read in pieces, shown as it comes, and holds the captures of slots 001 to 256 and no empty one', async () => {
    const c = await lib()
    const { u, heads } = unit()
    const seen = []
    const kept = []
    const pauses = []
    const list = c.captureList({ heads, pause: async (ms) => void pauses.push(ms), now: () => 1234, piece: () => 8, rest: () => 150, keep: (k) => kept.push(k) })
    /* Before anything is read: nothing, and not loading. */
    assert.deepEqual([list.get().list.length, list.get().loading, list.get().done, list.get().asked, list.get().total], [0, false, false, 0, 256])
    list.subscribe(() => seen.push([list.get().asked, list.get().list.length, list.get().loading]))
    const got = await list.load()
    assert.deepEqual(got.list.map((h) => [h.slot, h.name]), [[0, 'Brit Crunch'], [1, 'Clean One'], [2, 'High Gain Three'], [28, 'MV25 Ch1 Crunch'], [255, 'The Last One']], 'the list is not the unit’s captures, in slot order')
    assert.deepEqual([got.done, got.loading, got.asked, got.at, got.fault], [true, false, 256, 1234, null])
    /* Every slot from 001 to 256 asked once, eight at a time, and never the 257th: it is not offered until it is understood. */
    assert.deepEqual(u.asked, Array.from({ length: 256 }, (_, i) => i))
    assert.equal(u.pieces.length, 32)
    assert.ok(u.pieces.every(([from, count], i) => from === i * 8 && count === 8))
    assert.ok(!got.list.some((h) => h.slot === 256))
    /* A moment between two pieces, for a tap and the footswitch watch: after every piece but the last. */
    assert.deepEqual(pauses, new Array(31).fill(150))
    /* Shown as it comes: the count went up a piece at a time, the first captures there from the first piece. */
    assert.deepEqual(seen.filter(([, , loading]) => loading).map(([asked]) => asked), [0, ...Array.from({ length: 32 }, (_, i) => (i + 1) * 8)])
    assert.equal(seen.find(([asked]) => asked === 8)[1], 3)
    /* Written down when it is whole: what the row needs of each capture, and when. */
    assert.deepEqual(kept, [{ at: 1234, heads: [0, 1, 2, 28, 255].map((slot) => ({ slot, name: u.held[slot], by: 'somebody', make: 'Marshall', model: 'JCM' })) }])
    /* The same object until something changes (the screen's hook asks for it at every draw). */
    assert.equal(list.get(), list.get())
    /* Here, and nothing says it has changed: opened again, nothing is asked. `again` reads it whatever. */
    u.asked.length = 0
    await list.load()
    assert.deepEqual(u.asked, [])
    u.held[7] = 'New Since'
    delete u.held[1]
    const second = await list.load({ again: true })
    assert.equal(u.asked.length, 256)
    assert.deepEqual(second.list.map((h) => h.slot), [0, 2, 7, 28, 255], 'a capture gone from the unit is still listed, or a new one is not')
    /* Through a computer: as many slots as it takes at once, and no waiting between two. */
    const fast = unit()
    const fastPauses = []
    const quick = c.captureList({ heads: fast.heads, pause: async (ms) => void fastPauses.push(ms), piece: () => 32, rest: () => 0 })
    await quick.load()
    assert.deepEqual(fast.u.pieces, Array.from({ length: 8 }, (_, i) => [i * 32, 32]))
    assert.deepEqual(fastPauses, [])
  })

  test('capture picker: one read at a time, a slot that says nothing is asked once more after a moment, and a unit that answers nothing is said so', async () => {
    const c = await lib()
    /* Two asks for the list while one is going are the one read. */
    const both = unit()
    const one = c.captureList({ heads: both.heads, pause: async () => {} })
    const [a, b] = await Promise.all([one.load(), one.load()])
    assert.equal(a, b)
    assert.equal(both.u.asked.length, 256)

    /* A slot that says nothing once: the piece ended there, a moment's wait, and asked from it again. Every slot is still asked, that one twice. */
    const shy = unit()
    shy.u.silent[10] = 1
    const shyClock = clock()
    const list = c.captureList({ heads: shy.heads, pause: shyClock.pause, now: shyClock.now, rest: () => 0 })
    const got = await list.load()
    assert.deepEqual([got.done, got.fault], [true, null])
    assert.deepEqual(shy.u.pieces.slice(0, 4), [[0, 8], [8, 8], [10, 8], [18, 8]])
    /* The wait is longer than a late answer can take to come (the senders' own two seconds), or it would be taken for the next question's. */
    assert.deepEqual(shyClock.pauses, [2500], 'no wait, or too short a one, before a slot that said nothing was asked again')
    assert.equal(shy.u.asked.filter((s) => s === 10).length, 2)
    assert.deepEqual(got.list.map((h) => h.slot), [0, 1, 2, 28, 255])

    /* A slot that says nothing twice running is left out, and the rest of the list is read. A capture in it is not listed: it could not be named. */
    const mute = unit()
    mute.u.silent[28] = 2
    const skipping = c.captureList({ heads: mute.heads, pause: async () => {}, rest: () => 0 })
    const skipped = await skipping.load()
    assert.deepEqual([skipped.done, skipped.fault], [true, null])
    assert.deepEqual(skipped.list.map((h) => h.slot), [0, 1, 2, 255])
    assert.equal(mute.u.asked.filter((s) => s === 28).length, 2)
    assert.ok(mute.u.asked.includes(29) && mute.u.asked.includes(255))

    /* A unit that answers none of it (a firmware older than the NAM block): said so after two questions, not 257, and nothing is called read. */
    const old = unit()
    old.u.silent[0] = 99
    const none = c.captureList({ heads: old.heads, pause: async () => {} })
    const dead = await none.load()
    assert.deepEqual([dead.done, dead.loading, dead.fault, dead.list.length], [false, false, c.NO_CAPTURE_LIST, 0])
    assert.deepEqual(old.u.asked, [0, 0])
    /* And asked again when the unit answers: nothing of the failure is left. */
    old.u.silent[0] = 0
    const back = await none.load()
    assert.deepEqual([back.done, back.fault, back.list.length], [true, null, 5])

    /* The capture tools at work (a capture being sent from the card): asked again after a moment, a few times, and the list still comes. */
    const sending = unit()
    sending.u.busy = 3
    const waits = []
    const patient = c.captureList({ heads: sending.heads, pause: async (ms) => void waits.push(ms), rest: () => 0 })
    const came = await patient.load()
    assert.deepEqual([came.done, came.fault, waits], [true, null, [1200, 1200, 1200]])
    /* For ever, and it is said rather than waited out: after long enough for a capture to be sent over a Bluetooth adapter (half a minute), not ten seconds. */
    const stuck = unit()
    stuck.u.busy = 999
    const stuckClock = clock()
    const gaveUp = await c.captureList({ heads: stuck.heads, pause: stuckClock.pause, now: stuckClock.now }).load()
    assert.deepEqual([gaveUp.done, gaveUp.fault], [false, 'The capture tools are already at work. Try again in a moment.'])
    assert.ok(stuckClock.t >= 40000 && stuckClock.t <= 60000, `the list waited ${stuckClock.t} ms for the capture tools`)
    assert.equal(stuck.u.pieces.length, 39)
    const brief = unit()
    brief.u.busy = 999
    await c.captureList({ heads: brief.heads, pause: async () => {}, busyEvery: 1000, busyFor: 8000 }).load()
    assert.equal(brief.u.pieces.length, 9)

    /* Any other failure (the line went, a computer app from before the list) is said in its own words, and what was read before it stays on show. */
    const cut = unit()
    const breaking = c.captureList({ heads: async (from, count) => (from >= 16 ? Promise.reject(new Error('Update the computer app to choose a capture from here.')) : cut.heads(from, count)), pause: async () => {} })
    const part = await breaking.load()
    assert.deepEqual([part.done, part.fault, part.list.map((h) => h.slot), part.asked], [false, 'Update the computer app to choose a capture from here.', [0, 1, 2], 16])

    /* An asker that answers with nothing at all, or out of order, cannot spin it for ever. */
    const empty = await c.captureList({ heads: async (from) => ({ from, heads: [] }), pause: async () => {} }).load()
    assert.deepEqual([empty.done, typeof empty.fault], [false, 'string'])
    const wrong = await c.captureList({ heads: async (from) => ({ from, heads: [{ slot: from + 3, name: 'x', empty: false }] }), pause: async () => {} }).load()
    assert.deepEqual([wrong.done, typeof wrong.fault], [false, 'string'])
  })

  test('capture picker: the slot a block is on is asked by itself, what was kept is shown at once, and the list is read again when there is reason to', async () => {
    const c = await lib()
    /* The button's name, before the list is read: one question, for that slot. */
    const { u, heads } = unit()
    const list = c.captureList({ heads, pause: async () => {}, rest: () => 0 })
    const head = await list.ensure(28, { fresh: true })
    assert.deepEqual([head.slot, head.name, head.empty], [28, 'MV25 Ch1 Crunch', false])
    assert.deepEqual(u.pieces, [[28, 1]])
    assert.deepEqual(list.get().list.map((h) => h.slot), [28])
    assert.equal(list.get().done, false, 'one slot is not the list')
    /* Known, and not asked fresh: nothing is asked. The 257th can be named (a block may be on it) and is still not listed. */
    await list.ensure(28)
    assert.equal(u.pieces.length, 1)
    assert.equal((await list.ensure(256, { fresh: true })).name, 'MV25 Ch1 Crunch')
    assert.ok(!list.get().list.some((h) => h.slot === 256))
    /* What is no slot asks nothing; an asker that fails leaves what was known. */
    assert.equal(await list.ensure(null), null)
    assert.equal(await list.ensure(-1), null)
    const failing = c.captureList({ heads: async () => Promise.reject(new Error('gone')), pause: async () => {} })
    assert.equal(await failing.ensure(3, { fresh: true }), null)

    /* Written down the last time: shown at once and whole, with nothing asked. */
    const kept = { at: 999, heads: [{ slot: 0, name: 'Brit Crunch', by: 'somebody', make: 'Marshall', model: 'JCM' }, { slot: 28, name: 'MV25 Ch1 Crunch', by: 'x', make: '', model: '' }, { slot: 256, name: 'not listed' }, { slot: 5, name: '' }, { slot: 'x', name: 'bad' }] }
    const again = unit()
    const recalled = c.captureList({ heads: again.heads, pause: async () => {}, rest: () => 0 })
    assert.equal(recalled.recall(kept), true)
    assert.deepEqual([recalled.get().done, recalled.get().at, recalled.get().asked, recalled.get().list.map((h) => h.slot)], [true, 999, 256, [0, 28]])
    await recalled.load()
    assert.deepEqual(again.u.asked, [], 'a kept list was read again with no reason to')
    /* Nothing kept, or nothing in it, or a list already here: not taken. */
    for (const not of [null, undefined, {}, { at: 1, heads: [] }, { heads: [{ slot: 0, name: 'x' }] }, 'text']) assert.equal(c.captureList({ heads, pause: async () => {} }).recall(not), false)
    assert.equal(recalled.recall(kept), false)

    /* The slot a block is on reads as the kept list has it: nothing to do. */
    await recalled.ensure(28, { fresh: true })
    assert.equal(recalled.get().stale, false)
    /* It reads as something else (the captures were changed on the unit, or this is another unit): the list is out of date, and the next open reads it again. */
    again.u.held[28] = 'Somebody Else’s Capture'
    await recalled.ensure(28, { fresh: true })
    assert.equal(recalled.get().stale, true)
    assert.equal(recalled.get().list.find((h) => h.slot === 28).name, 'Somebody Else’s Capture', 'the button says a name the unit no longer has there')
    again.u.asked.length = 0
    const reread = await recalled.load()
    assert.equal(again.u.asked.length, 256, 'a list out of date was not read again when it was opened')
    assert.deepEqual([reread.stale, reread.done], [false, true])
    /* A capture where the kept list had none, and none where it had one, say the same. */
    const more = unit()
    const m = c.captureList({ heads: more.heads, pause: async () => {}, rest: () => 0 })
    m.recall({ at: 1, heads: [{ slot: 0, name: 'Brit Crunch' }, { slot: 40, name: 'Gone Now' }] })
    await m.ensure(2, { fresh: true })
    assert.equal(m.get().stale, true, 'a capture the kept list did not have did not mark it out of date')
    const less = c.captureList({ heads: more.heads, pause: async () => {}, rest: () => 0 })
    less.recall({ at: 1, heads: [{ slot: 0, name: 'Brit Crunch' }, { slot: 40, name: 'Gone Now' }] })
    await less.ensure(40, { fresh: true })
    assert.equal(less.get().stale, true)

    /* A capture sent from the app (the TONE3000 card): out of date at once, what is here stays on show, and the next open reads again. */
    const sent = unit()
    const s = c.captureList({ heads: sent.heads, pause: async () => {}, rest: () => 0 })
    await s.load()
    const before = s.get()
    s.stale()
    assert.deepEqual([s.get().stale, s.get().list.length, s.get().done], [true, before.list.length, true])
    sent.u.held[3] = 'Just Sent'
    sent.u.asked.length = 0
    assert.deepEqual((await s.load()).list.map((h) => h.slot), [0, 1, 2, 3, 28, 255])
    assert.equal(sent.u.asked.length, 256)

    /* A capture sent WHILE the list is being read may be in a slot the read has already passed: the read ends still out of date, and the next open reads again. */
    const mid = unit()
    let midList = null
    let sentOnce = false
    const during = c.captureList({
      heads: async (from, count) => {
        if (from === 16 && !sentOnce) {
          sentOnce = true
          mid.u.held[3] = 'Sent Mid-Read'
          midList.stale()
        }
        return mid.heads(from, count)
      },
      pause: async () => {},
      rest: () => 0
    })
    midList = during
    const first = await during.load()
    assert.deepEqual([first.done, first.stale], [true, true], 'a capture sent during the read was forgotten when the read ended')
    assert.ok(!first.list.some((h) => h.slot === 3))
    mid.u.asked.length = 0
    const next = await during.load()
    assert.equal(mid.u.asked.length, 256)
    assert.deepEqual([next.stale, next.list.some((h) => h.slot === 3)], [false, true])

    /* What the unit said a slot holds when a block was pointed at it is the list's name for it from then. */
    s.note(3, 'Renamed On The Unit')
    assert.equal(s.get().list.find((h) => h.slot === 3).name, 'Renamed On The Unit')
    s.note(9, '<EMPTY>')
    assert.ok(!s.get().list.some((h) => h.slot === 9))
    const same = s.get()
    s.note(3, 'Renamed On The Unit')
    s.note(null, 'x')
    s.note(3, null)
    assert.equal(s.get(), same, 'a note that changes nothing redrew the screen')
  })

  /*
   * WHAT AN INDEPENDENT READ FOUND before this went out (14 November 2026),
   * each held here:
   *
   *   - A UNIT THAT STOPS ANSWERING PART-WAY (its MIDI cable pulled, or
   *     switched off, with the adapter still connected) had every slot left
   *     asked twice, some twenty minutes of it, and the read then ended as a
   *     whole list, written down over the good one with those captures gone.
   *   - AN ANSWER THAT COMES LATE. A slot's answer does not say which slot it
   *     is, and only the list's own next piece waited after a slot said
   *     nothing: the question for a block's button, asked in between, was
   *     handed the late answer and filed it under its own slot.
   */
  test('capture picker: a unit that stops answering part-way is said so after four questions, and the list it had is neither cut down nor written over', async () => {
    const c = await lib()
    const { u, heads } = unit()
    const kept = []
    const k = clock()
    const list = c.captureList({ heads, pause: k.pause, now: k.now, rest: () => 0, keep: (x) => kept.push(x) })
    const whole = await list.load()
    assert.deepEqual(whole.list.map((h) => h.slot), [0, 1, 2, 28, 255])
    assert.equal(kept.length, 1)

    /* Read again, and from slot 020 on the unit says nothing. */
    for (let slot = 20; slot < 257; slot++) u.silent[slot] = 99
    u.held[5] = 'New Before It Stopped'
    u.asked.length = 0
    u.pieces.length = 0
    const began = k.t
    const cut = await list.load({ again: true })
    assert.equal(cut.fault, c.CAPTURES_STOPPED)
    assert.deepEqual([cut.loading, cut.done], [false, true], 'the list it had is no longer on show')
    /* Two slots running that each said nothing twice (021 and 022), not two questions for every slot left. */
    assert.deepEqual(u.asked.filter((s) => s >= 20), [20, 20, 21, 21])
    assert.ok(u.pieces.length <= 7, `${u.pieces.length} requests were made of a unit that had stopped answering`)
    assert.ok(k.t - began <= 10000, `the list went on for ${k.t - began} ms after the unit stopped`)
    /* What it heard before the stop is taken; nothing past it is taken out; and NOTHING IS WRITTEN DOWN. */
    assert.deepEqual(cut.list.map((h) => h.slot), [0, 1, 2, 5, 28, 255])
    assert.equal(kept.length, 1, 'a read that failed part-way was written down over the list')
    /* The next open reads again by itself: what is on show is part this read's and part the last one's. */
    assert.equal(cut.stale, true)
    for (let slot = 20; slot < 257; slot++) delete u.silent[slot]
    u.asked.length = 0
    const back = await list.load()
    assert.equal(u.asked.length, 256)
    assert.deepEqual([back.fault, back.stale, back.list.map((h) => h.slot)], [null, false, [0, 1, 2, 5, 28, 255]])
    assert.equal(kept.length, 2)

    /* One slot of its own that will not say (twice silent, its neighbours answering) is still only left out, with the read whole: and it is taken out only once the read has ended whole. */
    u.silent[28] = 2
    const one = await list.load({ again: true })
    assert.deepEqual([one.fault, one.done, one.list.map((h) => h.slot)], [null, true, [0, 1, 2, 5, 255]])
    /* Left out by a read that then FAILS, it stays as it was. */
    u.held[28] = 'MV25 Ch1 Crunch'
    await list.load({ again: true })
    u.silent[28] = 2
    for (let slot = 100; slot < 257; slot++) u.silent[slot] = 99
    const half = await list.load({ again: true })
    assert.equal(half.fault, c.CAPTURES_STOPPED)
    assert.ok(half.list.some((h) => h.slot === 28), 'a slot that said nothing was taken out of the list by a read that never finished')
    assert.ok(half.list.some((h) => h.slot === 255), 'a capture past where the unit stopped answering was taken out of the list')

    /* A sender that says a silent slot as a failure (504) and not as `stopped` is the same thing: waited out, asked again, and a unit that has stopped is said so. */
    const thrown = unit()
    let asks = 0
    const t2 = clock()
    const strict = c.captureList({
      heads: async (from, count) => {
        asks++
        if (from >= 16) throw Object.assign(new Error('The unit didn’t say what is in capture slot 017.'), { status: 504 })
        return thrown.heads(from, count)
      },
      pause: t2.pause,
      now: t2.now,
      rest: () => 0
    })
    const failed = await strict.load()
    /* Four of them running, each waited out, and no slot is left out on its word: it did not say which slot. */
    assert.deepEqual([failed.done, failed.fault, asks], [false, c.CAPTURES_STOPPED, 6])
    assert.deepEqual(t2.pauses, [2500, 2500, 2500], 'a slot was asked straight after one that was said not to have answered')
    assert.deepEqual(failed.list.map((h) => h.slot), [0, 1, 2])

    /* A UNIT THAT HAS ANSWERED BEFORE and now says nothing from its first slot is one that has stopped answering, not one whose firmware is older than the NAM block. */
    const gone = unit()
    const g = c.captureList({ heads: gone.heads, pause: async () => {}, rest: () => 0 })
    await g.load()
    for (let slot = 0; slot < 257; slot++) gone.u.silent[slot] = 99
    gone.u.asked.length = 0
    const quietNow = await g.load({ again: true })
    assert.equal(quietNow.fault, c.CAPTURES_STOPPED)
    assert.deepEqual(gone.u.asked, [0, 0, 1, 1])
    assert.deepEqual(quietNow.list.map((h) => h.slot), [0, 1, 2, 28, 255])
    /* And one that only ever answered the question for a block's button, the same. */
    const button = unit()
    const b2 = c.captureList({ heads: button.heads, pause: async () => {}, rest: () => 0 })
    await b2.ensure(28, { fresh: true })
    for (let slot = 0; slot < 257; slot++) button.u.silent[slot] = 99
    assert.equal((await b2.load()).fault, c.CAPTURES_STOPPED)

    /*
     * ONE SLOT OF ITS OWN THAT WILL NOT SAY, AND A LOST ANSWER RIGHT AFTER
     * IT, is not a unit that has stopped: slot 006 is left out, slot 007
     * answers the second time it is asked, and the read ends whole. (The
     * first fix counted three unanswered questions running, whichever
     * slots: this ended as a failure, at every open, and the list was never
     * written down.)
     */
    const flaky = unit()
    flaky.u.silent[5] = 99
    flaky.u.silent[6] = 1
    flaky.u.held[6] = 'After A Lost Answer'
    const keptFlaky = []
    const f = c.captureList({ heads: flaky.heads, pause: async () => {}, rest: () => 0, keep: (x) => keptFlaky.push(x) })
    const fl = await f.load()
    assert.deepEqual([fl.fault, fl.done, fl.list.map((h) => h.slot)], [null, true, [0, 1, 2, 6, 28, 255]])
    assert.equal(keptFlaky.length, 1)
    /* Every slot's answer lost once (a poor link): still whole, every slot asked twice at most. */
    const poor = unit()
    for (let slot = 0; slot < 256; slot++) poor.u.silent[slot] = 1
    const pl = await c.captureList({ heads: poor.heads, pause: async () => {}, rest: () => 0 }).load()
    assert.deepEqual([pl.fault, pl.done, pl.list.map((h) => h.slot)], [null, true, [0, 1, 2, 28, 255]])
    assert.ok(poor.u.asked.length <= 512)
    /* Two slots side by side that never say: taken for a unit that has stopped, after four questions. */
    const pair = unit()
    pair.u.silent[5] = 99
    pair.u.silent[6] = 99
    const pr = await c.captureList({ heads: pair.heads, pause: async () => {}, rest: () => 0 }).load()
    assert.equal(pr.fault, c.CAPTURES_STOPPED)
    assert.deepEqual(pair.u.asked.filter((s) => s >= 5), [5, 5, 6, 6])

    /* A slot the read left out, which then ANSWERS the question for a block's button, keeps what it said when the read ends (the first fix took it out with the rest). */
    const late = unit()
    late.u.silent[28] = 2
    let lateList = null
    let looked = null
    const lt = c.captureList({
      heads: async (from, count) => {
        if (from > 40 && !looked) looked = lateList.ensure(28, { fresh: true })
        return late.heads(from, count)
      },
      pause: async () => {},
      rest: () => 0
    })
    lateList = lt
    const ended = await lt.load()
    assert.equal((await looked).name, 'MV25 Ch1 Crunch')
    assert.equal(lt.head(28)?.name, 'MV25 Ch1 Crunch', 'a slot that answered after the read left it out was taken out of the list')
    assert.ok(lt.get().list.some((h) => h.slot === 28))
    assert.equal(ended.fault, null)
  })

  test('capture picker: after a slot says nothing, no slot is asked until its late answer is gone, by the list or for a block’s button; a pick does not wait', async () => {
    const c = await lib()
    const { u, heads } = unit()
    const k = clock()
    const asked = []
    const list = c.captureList({
      heads: async (from, count) => {
        asked.push([from, count, k.t])
        return heads(from, count)
      },
      pause: k.pause,
      now: k.now,
      rest: () => 0
    })
    /* The slot a block is on says nothing (its answer is slow). Nothing is known of it, and nothing is made up. */
    u.silent[40] = 1
    assert.equal(await list.ensure(40, { fresh: true }), null)
    assert.equal(list.head(40), null)
    /* The list is opened at once. Its first question waits: asked now, it would be handed slot 041's late answer as slot 001's, and every name after it would be one slot out. */
    const got = await list.load()
    assert.deepEqual(asked.slice(0, 2).map(([from, count, at]) => [from, count, at]), [[40, 1, 0], [0, 8, 2500]])
    assert.deepEqual(k.pauses, [2500])
    assert.deepEqual([got.done, got.fault], [true, null])

    /* The other way round: a piece of the list ends on a silent slot, and the question for a block's button, asked meanwhile, waits too. A pick asked then does NOT: its answer is not a slot's, and it is under the player's thumb. */
    const second = unit()
    const k2 = clock()
    const order = []
    let button = null
    let pick = null
    second.u.silent[10] = 1
    const busyList = c.captureList({
      heads: async (from, count) => {
        order.push(`heads ${from}/${count} at ${k2.t}`)
        if (from === 8 && !button) {
          pick = busyList.turn(async () => void order.push(`pick at ${k2.t}`))
          button = busyList.ensure(28, { fresh: true })
        }
        return second.heads(from, count)
      },
      pause: k2.pause,
      now: k2.now,
      rest: () => 0
    })
    await busyList.load()
    await pick
    assert.equal((await button).name, 'MV25 Ch1 Crunch')
    assert.deepEqual(order.slice(0, 4), ['heads 0/8 at 0', 'heads 8/8 at 0', 'pick at 0', 'heads 10/8 at 2500'])
    /* The button's question waited out the same quiet: asked once, and not before it was over. */
    assert.deepEqual(order.filter((x) => x.startsWith('heads 28/1')), ['heads 28/1 at 2500'])

    /* A pick tapped AFTER the list has begun waiting goes straight in too: the wait is not taken with the line in hand. (It was, for a day: a pick then waited the whole quiet and a piece of the list.) */
    const third0 = unit()
    const k3 = clock()
    const log = []
    third0.u.silent[10] = 1
    let tapped = null
    const waitingList = c.captureList({
      heads: async (from, count) => {
        log.push(`heads ${from} at ${k3.t}`)
        return third0.heads(from, count)
      },
      pause: (ms) => {
        /* The quiet has just begun: the player taps a capture now. */
        if (ms === 2500 && !tapped) tapped = waitingList.turn(async () => void log.push(`pick at ${k3.t}`))
        return k3.pause(ms)
      },
      now: k3.now,
      rest: () => 0
    })
    await waitingList.load()
    await tapped
    assert.deepEqual(log.slice(0, 4), ['heads 0 at 0', 'heads 8 at 0', 'pick at 0', 'heads 10 at 2500'])

    /*
     * The wait is never longer than the quiet itself, whatever the device's
     * clock does. Here it is set back ten minutes just after a slot has said
     * nothing: the quiet was reckoned by the old time, and unclamped the list
     * would wait those ten minutes with a pick's turn behind it.
     */
    const jump = unit()
    let stepped = 0
    const waits = []
    jump.u.silent[10] = 1
    const jl = c.captureList({
      heads: async (from, count) => {
        const got = await jump.heads(from, count)
        if (got.stopped === 10 && !stepped) stepped = 1
        return got
      },
      pause: async (ms) => void waits.push(Math.round(ms)),
      /* The first reading after the silence is the one the quiet is reckoned from; every one after it is ten minutes earlier. */
      now: () => {
        if (stepped === 1) {
          stepped = 2
          return 1000000
        }
        return stepped === 2 ? 400000 : 1000000
      },
      rest: () => 0
    })
    await jl.load()
    assert.equal(stepped, 2)
    assert.deepEqual(waits, [2500], `the list waited ${waits.join(', ')} ms after the clock was set back`)

    /*
     * A SLOT QUESTION ALREADY WAITING ITS TURN when the one before it comes
     * back silent is not sent into the quiet either. The lane starts its next
     * job before whoever asked hears the answer, so the quiet has to begin
     * with the lane still in hand. No pick is between the two here: one gave
     * the read the moment it needed, and hid this.
     */
    const queued = unit()
    const kq = clock()
    const sentAt = []
    queued.u.silent[0] = 1
    let behind = null
    let ql = null
    const qList = c.captureList({
      heads: async (from, count) => {
        sentAt.push(`${from}/${count} at ${kq.t}`)
        /* A NAM block is opened while the first piece is out: its button's question joins the lane behind it, with no quiet to see yet. */
        if (from === 0 && count === 8 && !behind) behind = ql.ensure(5, { fresh: true })
        return queued.heads(from, count)
      },
      pause: kq.pause,
      now: kq.now,
      rest: () => 0
    })
    ql = qList
    await qList.load()
    await behind
    assert.deepEqual(sentAt.slice(0, 2).map((x) => x.split(' at ')[1]), ['0', '2500'], `a slot was asked ${sentAt[1]} straight after one that said nothing: ${sentAt.slice(0, 3).join(', ')}`)
    assert.ok(sentAt.every((x, i) => i === 0 || Number(x.split(' at ')[1]) >= 2500))

    /* The unit has just NAMED a slot (a pick's answer) that the read had left out as silent: it stays, though the name is the one the list had. */
    const named = unit()
    const nl = c.captureList({ heads: named.heads, pause: async () => {}, rest: () => 0 })
    await nl.load()
    named.u.silent[28] = 2
    let noted = false
    const nl2 = c.captureList({
      heads: async (from, count) => {
        if (from > 40 && !noted) {
          noted = true
          again2.note(28, 'MV25 Ch1 Crunch')
        }
        return named.heads(from, count)
      },
      pause: async () => {},
      rest: () => 0
    })
    const again2 = nl2
    nl2.recall({ at: 1, heads: nl.get().list })
    nl2.stale()
    await nl2.load()
    assert.equal(nl2.head(28)?.name, 'MV25 Ch1 Crunch', 'a slot the unit had just named was taken out of the list when the read ended')
    /* And a note that changes nothing still does not redraw the screen. */
    const before = nl2.get()
    nl2.note(28, 'MV25 Ch1 Crunch')
    assert.equal(nl2.get(), before)

    /* "It has answered before" is of late, not for ever: there is one list for the app, and another unit may be on the line an hour later. */
    const hour = unit()
    let clockNow = 0
    const hl = c.captureList({ heads: hour.heads, pause: async () => {}, now: () => clockNow, rest: () => 0 })
    await hl.load()
    for (let slot = 0; slot < 257; slot++) hour.u.silent[slot] = 99
    clockNow = 5 * 60 * 1000
    assert.equal((await hl.load({ again: true })).fault, c.CAPTURES_STOPPED)
    clockNow = 61 * 60 * 1000
    hour.u.asked.length = 0
    assert.equal((await hl.load({ again: true })).fault, c.NO_CAPTURE_LIST)
    assert.deepEqual(hour.u.asked, [0, 0])

    /* What is known of one slot, an empty one and the 257th too: the rows leave those out, a block's button says them. */
    const third = unit()
    const plain = c.captureList({ heads: third.heads, pause: async () => {}, rest: () => 0 })
    await plain.load()
    assert.deepEqual([plain.head(40).empty, plain.head(40).name], [true, '<EMPTY>'])
    assert.equal(c.captureSaid(40, plain.head(40)), '041 (empty)')
    assert.equal(plain.head(256), null)
    await plain.ensure(256, { fresh: true })
    assert.equal(c.captureSaid(256, plain.head(256)), '257 MV25 Ch1 Crunch')
    assert.ok(!plain.get().list.some((h) => h.slot === 40 || h.slot === 256))
    assert.equal(plain.head(999), null)

    /* The slot a block is on reads differently WHILE the list is being read: out of date only if the read has already passed that slot. One still ahead of it is about to be read anyway. */
    for (const [slot, expect] of [[2, true], [200, false]]) {
      const moving = unit()
      let looked = null
      let again = null
      const l = c.captureList({
        heads: async (from, count) => {
          if (from === 16 && !looked) {
            moving.u.held[slot] = 'Changed On The Unit'
            looked = again.ensure(slot, { fresh: true })
          }
          return moving.heads(from, count)
        },
        pause: async () => {},
        rest: () => 0
      })
      again = l
      await l.recall({ at: 1, heads: [{ slot: 2, name: 'High Gain Three' }, { slot: 200, name: 'Was Here Before' }] })
      l.stale()
      const end = await l.load()
      await looked
      assert.equal(end.stale, expect, `slot ${slot + 1} read differently during the read`)
      assert.equal(end.list.find((h) => h.slot === slot).name, 'Changed On The Unit')
    }
  })

  test('capture picker: a pick goes in its turn between two pieces of the list, never beside one', async () => {
    const c = await lib()
    const { u, heads } = unit()
    let going = 0
    let most = 0
    let picked = null
    const list = c.captureList({
      heads: async (from, count) => {
        going++
        most = Math.max(most, going)
        /* A capture picked while the third piece is being read. */
        if (from === 16 && !picked) picked = list.turn(async () => {
          going++
          most = Math.max(most, going)
          u.order.push('pick')
          await Promise.resolve()
          going--
          return { block: 206, slot: 1, name: 'Clean One' }
        })
        const got = await heads(from, count)
        await Promise.resolve()
        going--
        return got
      },
      pause: async () => {},
      rest: () => 150
    })
    await list.load()
    assert.deepEqual(await picked, { block: 206, slot: 1, name: 'Clean One' })
    assert.equal(most, 1, 'a pick and a piece of the list were on the line together')
    /* Straight after the piece it was asked during, before the next one. */
    assert.deepEqual(u.order.slice(0, 5), ['heads 0', 'heads 8', 'heads 16', 'pick', 'heads 24'])
    /* A turn that fails is its caller's failure, and the next thing still goes. */
    await assert.rejects(list.turn(async () => Promise.reject(new Error('refused'))), /refused/)
    assert.equal((await list.ensure(0, { fresh: true })).name, 'Brit Crunch')
  })

  test('capture picker: Edit draws it on a NAM block for his account alone, first, in place of the line that says the unit chooses, and picks by the unit’s own write', async () => {
    const features = await import('../mobile/src/lib/features.js')
    assert.equal(features.NAM_PICKER_FOR_EVERYONE, false, 'the picker opened to everyone: that is his say, with its What’s new line')
    assert.match(flat(read('mobile/src/lib/useCapturePicker.js')), /export const useCapturePicker = \(\) => \{ const his = useBluetoothAdmin\(\) return NAM_PICKER_FOR_EVERYONE \|\| his \}/)

    const raw = read('mobile/src/screens/Edit.js')
    const edit = flat(code(raw))
    assert.match(edit, /import \{ useCapturePicker \} from '\.\.\/lib\/useCapturePicker'/)
    assert.match(edit, /import \{ chooseCapture \} from '\.\.\/lib\/captureListHere'/)
    assert.match(edit, /import CapturePicker from '\.\.\/components\/CapturePicker'/)
    /* What the block's read says, kept with its knobs and switches at every read. */
    assert.match(edit, /setEnums\(p\?\.enums \|\| \[\]\) setCapture\(p\?\.capture \?\? null\)/)
    /* Drawn only on a NAM block with knobs, never in the hold pop-up, only for the accounts it is open to, and only where the read says which capture the block is on (so never through a computer app from before it). */
    assert.match(edit, /const namPicker = namOnUnit && pickerOn && Number\.isInteger\(capture\?\.slot\)/)
    assert.match(edit, /const pickerOn = useCapturePicker\(\)/)
    assert.equal((edit.match(/<CapturePicker /g) || []).length, 1)
    assert.match(edit, /\{namPicker \? <CapturePicker slot=\{capture\.slot\} choosing=\{capturing\} disabled=\{!!restoring \|\| capturing !== null \|\| rereading\} onPick=\{pickCapture\} block=\{block\} onChanged=\{captureChanged\} \/> : null\}/)
    /* First: over the knobs, as a model is over an amp's. And the line that says the unit chooses is not drawn with it. */
    assert.ok(edit.indexOf('<CapturePicker ') > 0 && edit.indexOf('<CapturePicker ') < edit.indexOf('shown.map((p) =>'), 'the capture is under the knobs')
    assert.match(edit, /\{namOnUnit && !namPicker \? <Note>\{NAM_ON_THE_UNIT\}<\/Note> : null\}/)
    /* A pick: the unit's own write for it, then the block read again, and what the read says is what the button shows. Never Edit's write for a list setting, which has no row for the capture and must not get one. */
    assert.match(
      edit,
      /const pickCapture = async \(slot\) => \{ if \(restoring \|\| capturing !== null \|\| rereading\) return ownPick\.current = true setCapturing\(slot\) const show = \(fresh\) => \{ if \(!Number\.isInteger\(fresh\?\.capture\?\.slot\)\) return false setParams\(fresh\.named \|\| \[\]\) setEnums\(fresh\.enums \|\| \[\]\) setLayout\(fresh\.layout \|\| null\) setCapture\(fresh\.capture\) return true \} let got = null try \{ got = await chooseCapture\(eid, slot\) noteEdited\(\) if \(Number\.isInteger\(got\?\.slot\)\) setCapture\(\{ slot: got\.slot \}\) show\(await blockParams\(eid\)\) if \(got\?\.listed\) onError\(captureNotAsListed\(got\.slot, got\.listed, got\.name\)\) \} catch \(err\) \{ setCapturing\(null\) setRereading\(true\) onError\(got\?\.listed \? captureNotAsListed\(got\.slot, got\.listed, got\.name\) : err\.message\) try \{ const fresh = await blockParams\(eid\) if \(show\(fresh\) && !got && err\?\.status !== 409 && fresh\.capture\.slot === slot\) noteEdited\(\) \} catch \{ \} \} finally \{ ownPick\.current = false setCapturing\(null\) setRereading\(false\) recapture\.current\?\.after\(\) \} \}/,
      'Edit’s pick is not what it has to be. The unit’s own write; an answered pick believed at once, whatever the read after it does; the block read again and drawn only where the read says which capture (through the computer a failed read comes back as every knob at nought, not as a failure); after a pick that FAILED too, with the button back on what is known before that read, and the preset marked changed only if the unit is then on the capture that was tapped and the pick was not one refused with nothing sent'
    )
    /* While that second read is out the picker waits. */
    assert.match(edit, /const \[rereading, setRereading\] = useState\(false\)/)
    assert.ok(!/setEnum\(eid, 0\b/.test(edit), 'the capture is written as a list setting')

    /* The picker draws and asks; it writes nothing itself. */
    const picker = code(read('mobile/src/components/CapturePicker.js'))
    assert.ok(!/chooseCapture|namPickHere|setEnum|setParam|blockParams|remoteRequest|lib\/device|lib\/rig/.test(picker), 'the picker writes to the unit itself')
    assert.match(flat(picker), /export default function CapturePicker\(\{ slot, choosing = null, disabled = false, onPick, block = null, onChanged = null \}\)/)
    /* The way to more captures (components/Tone3000Quick, test/tone3000-quick.mjs) is drawn here and plays by its own page: still nothing of the picker's own writes to the unit. */
    assert.match(flat(picker), /import \{ captureHead, loadCaptures, nameCapture, useCaptures \} from '\.\.\/lib\/captureListHere'/)
    /* The button says what is known of the slot the block is on, an empty one and the 257th too; the rows are the list on show, which leaves those out. */
    assert.match(flat(picker), /const here = captureHead\(at\)/)
    assert.ok(!/captures\.list\.find/.test(picker), 'the button looks its slot up in the rows: a block on an empty slot, or the 257th, would say a bare number')
    /* The name of the slot the block is on is asked by itself; the list is read when the sheet is opened, and again when asked. */
    assert.match(flat(picker), /useEffect\(\(\) => \{ if \(Number\.isInteger\(slot\)\) nameCapture\(slot\) \}, \[slot\]\)/)
    assert.match(flat(picker), /const show = \(\) => \{ setFind\(''\) setCame\(''\) setNewest\(captures\.done\) setOpen\(true\) loadCaptures\(\) \}/)
    assert.match(flat(picker), /onPress=\{\(\) => loadCaptures\(\{ again: true \}\)\}/)
    /* No more rows at once than the model list and the cab list draw; a pick of the capture it is on asks nothing. */
    assert.match(flat(picker), /found\.slice\(0, CAPTURES_SHOWN\)\.map\(\(h\) =>/)
    assert.match(flat(picker), /onPress=\{\(\) => \{ if \(h\.slot !== at\) onPick\(h\.slot\) close\(\) \}\}/)
    /* Its words: plain, and none of the ones the app never says. */
    const words = [...read('mobile/src/components/CapturePicker.js').matchAll(/(?:label|sub|title|note|placeholder|accessibilityLabel)=(?:"([^"]+)"|\{`([^`]+)`\}|\{'([^']+)'\})|<Note[^>]*>\{?[`']?([^<{}`']+)/g)].map((m) => m[1] || m[2] || m[3] || m[4]).filter(Boolean)
    assert.ok(words.includes('Capture') && words.includes('Find a capture'), words.join(' | '))
    /* The sheet's note is one of two now (the captures on the unit, or the way to more of them): both are read. */
    const notes = [...read('mobile/src/components/CapturePicker.js').match(/note=\{[^}]*\}/)[0].matchAll(/'([^']+)'/g)].map((m) => m[1])
    assert.deepEqual(notes, ['Captures from TONE3000. One you preview or get plays on the channel this block is on.', 'The captures on the unit, newest first. The one picked plays on the channel this block is on.', 'The captures on the unit. The one picked plays on the channel this block is on.'])
    for (const said of [...words, ...notes]) assert.ok(!/this phone|\bbeta\b|\bsoon\b|coming|tried|official|iPhone|Android/i.test(said), said)

    /* The wiring: one list for the app, kept under one key, the device's own asker either way it is connected, and told when the card has sent a capture. */
    const here = flat(code(read('mobile/src/lib/captureListHere.js')))
    assert.match(here, /const KEY = 'fractal\.captures'/)
    assert.match(here, /heads: \(from, count\) => namHeadsHere\(from, count\)/)
    assert.match(here, /piece: \(\) => \(capturesThroughComputer\(\) \? NAM_HEADS_MOST : 8\)/)
    assert.match(here, /rest: \(\) => \(capturesThroughComputer\(\) \? 0 : 150\)/)
    assert.match(here, /onCaptureSent\(\(got\) => list\.stale\(got\?\.slot, got\?\.name\)\)/)
    assert.match(here, /export const nameCapture = \(slot\) => list\.ensure\(slot, \{ fresh: true \}\)/)
    assert.match(here, /export const captureHead = \(slot\) => list\.head\(slot\)/)
    /* A pick: in the list's own lane, the unit's answer noted as that slot's name, and a name that is not the one the row had says the list is out of date, with the name that was tapped handed back for Edit to say. */
    assert.match(
      here,
      /export const chooseCapture = \(block, slot\) => \{ const row = list\.head\(slot\) const listed = row && !row\.empty && typeof row\.name === 'string' \? row\.name\.trim\(\) : '' return list \.turn\(\(\) => namPickHere\(block, slot\)\) \.then\(\(got\) => \{ const name = typeof got\?\.name === 'string' \? got\.name\.trim\(\) : null list\.note\(got\?\.slot, got\?\.name\) if \(listed && name !== null && got\?\.slot === slot && name !== listed\) \{ list\.stale\(\) return \{ \.\.\.got, listed \} \} return got \}\) \}/
    )
    /* The list's own rules import nothing: a test runs them as they are. */
    assert.deepEqual([...read('mobile/src/lib/captureList.js').matchAll(/^import .* from '([^']+)'/gm)], [])
    /* The same most slots a piece as the wire and the computer take. */
    const nam = await import('../mobile/src/lib/nam-install.js')
    assert.equal(nam.NAM_HEADS_MOST, 32)
    assert.equal(nam.NAM_SLOTS, 257)
    assert.match(read('mobile/src/lib/gen3-edit.js'), /const CAPTURE_SLOTS = 257\n/)
    /* Where a read finds the capture is said for the NAM block alone, and it is still no row of knobs or switches there: nothing of Edit's can build a write for it, which stays the captures' own (their guard, his account). */
    const own = await import('../mobile/src/lib/axefx3-own-knobs.js')
    assert.deepEqual(Object.entries(own.AXE3_OWN_FAMILIES).filter(([, f]) => 'captureId' in f).map(([name, f]) => [name, f.captureId, f.typeId]), [['NAM', 0, null]])
    const namFamily = own.AXE3_OWN_FAMILIES.NAM
    /* Rows are [setting, name, …]; selectors are keyed by their setting. */
    for (const rows of [namFamily.knobs, namFamily.switches]) assert.ok(!rows.some((r) => r[0] === 0), 'the capture has a row in Edit’s list: Edit could write it its own way')
    assert.ok(!Object.keys(namFamily.selectors || {}).map(Number).includes(0))
    /* The browser draws none of it: that would be a computer release nobody has asked for. */
    for (const f of ['src/components/Console.jsx', 'src/components/Gig.jsx']) assert.ok(!/CapturePicker|captureList|nam\/heads/.test(read(f)), f)
    /* And no line in What's new until it is everybody's. */
    assert.ok(!/capture/i.test(JSON.stringify(JSON.parse(read('shared/whats-new.json'))[0] ?? '')) || features.NAM_PICKER_FOR_EVERYONE, 'What’s new has a line for something only his account has')
  })
}
