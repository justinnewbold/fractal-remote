/**
 * The Apple Watch's pages: which are shown, and in what order, chosen on the
 * iPhone. And the fifth page, Tempo.
 *
 * Justin, 11 November 2026: "On the watch, can we add a way for a user to
 * select which order their pages show up in on the Watch app?" Asked whether
 * a page could be hidden too: "Yes, add hiding pages." And of a Tempo page
 * with Tap on it: "OK, well let's add that as well then."
 *
 * TWO HALVES, AND ONLY ONE OF THEM TRAVELS IN AN UPDATE. The phone's half is
 * in the tree: the rules (shared/watch-link.mjs), the pages as chosen kept
 * on the device (mobile/src/lib/watchPages.js), the Settings rows
 * (components/WatchPageOrder), the fields in the picture (`pages`, `hidden`,
 * `tempo`) and the two requests the Tempo page makes (`tap`, `wrist`). The
 * watch's half is Swift, which reaches a wrist only inside an iPhone build,
 * so it waits in docs/pending/watch-page-order.patch.
 *
 * So the phone's half is INERT until a watch says it does this (its hello's
 * `knows`): no rows in Settings, none of the fields in the picture, and both
 * requests refused. The first tests hold that, whatever the tree. The last
 * one reads the watch's Swift and asks which tree this is: without the patch
 * the watch is exactly what it was and the patch is listed; with it
 * (web.yml's second run, and the build pull request) the Swift half is held
 * to the phone's, word for word and answer for answer, through one fixture
 * both sides read (mobile/watch-ci/Tests/WatchModelTests/pages.json, written
 * by `pagesFixture` below).
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const at = (p) => new URL(`../${p}`, import.meta.url)
const read = (p) => readFileSync(at(p), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

const link = () => import('../shared/watch-link.mjs')

const ALL = ['scenes', 'pedals', 'presets', 'tempo', 'tuner']
/** The fixture's picture: every page out of its usual place, and one hidden. */
const CHOSEN = ['tuner', 'scenes', 'presets', 'tempo', 'pedals']
const CHOSEN_HIDDEN = ['presets']
/** An order kept from before Tempo was a page: four names. */
const BEFORE_TEMPO = ['tuner', 'scenes', 'presets', 'pedals']
/** The fixture's Tempo page: a tempo that is not a whole number, Tap offered, the wrist's switch on, the metronome not running. */
const TEMPO = { bpm: 121.4, why: '', wrist: true, running: false }

/**
 * What both sides are held to: a picture with pages and a tempo in it, and
 * lists that are not quite right with what each has to come to. Only lists
 * of names, or none: that is all a picture can carry and still be read
 * (anything else the phone repairs before it sends, which the tests below
 * hold).
 *
 * To write the file again after a rule changes on purpose:
 *   node -e "import('./test/watch-pages.mjs').then(async (m) => console.log(JSON.stringify(await m.pagesFixture(), null, 2)))" > mobile/watch-ci/Tests/WatchModelTests/pages.json
 */
export async function pagesFixture() {
  const { watchState, watchPageOrder, watchPagesHidden, watchPagesShown, watchTunerStopsOnLeaving, watchTunerStopsOnHiding, watchHereDue, WATCH_HERE_MS, WATCH_HERE_TICK_MS } = await link()
  /* The check-in: on screen or not, the pages up or the waiting page, the demo or not, and the clock either side of its twenty seconds. Times in milliseconds. */
  const T = 1759363200000
  const due = [
    [true, true, false, T, T],
    [true, true, false, T, T + WATCH_HERE_MS - 1],
    [true, true, false, T, T + WATCH_HERE_MS],
    [true, true, false, T, T + WATCH_HERE_MS + WATCH_HERE_TICK_MS],
    [true, true, false, T, T + 600000],
    [true, true, false, null, T],
    [false, true, false, T, T + 600000],
    [false, true, false, null, T],
    [true, false, false, T, T + 600000],
    [true, false, false, null, T],
    [true, true, true, T, T + 600000],
    [true, true, true, null, T],
    [false, false, true, T, T + 600000],
    [true, true, false, T + 5000, T]
  ].map(([onScreen, pages, demo, lastSent, now]) => ({ onScreen, pages, demo, lastSent, now, due: watchHereDue({ onScreen, pages, demo, lastSent, now }) }))
  /* The tuner and leaving its page: every tuner on or off with the switch on, off or not said; and its page shown, hidden, or hidden already. */
  const leaving = [true, false].flatMap((on) => [true, false, null].map((stays) => ({ on, stays, stops: watchTunerStopsOnLeaving(on, stays) })))
  const hiding = [
    [ALL, ['scenes', 'pedals', 'presets', 'tempo'], true],
    [ALL, ['scenes', 'pedals', 'presets', 'tempo'], false],
    [CHOSEN, ['scenes'], true],
    [ALL, CHOSEN, true],
    [ALL, ['tuner'], true],
    [['scenes', 'pedals'], ['scenes'], true],
    [['scenes'], ALL, true],
    [['tuner'], ['tempo'], true]
  ].map(([was, now, on]) => ({ was, now, on, stops: watchTunerStopsOnHiding(was, now, on) }))
  const given = [
    [null, null],
    [[], []],
    [ALL, []],
    [CHOSEN, CHOSEN_HIDDEN],
    [CHOSEN, null],
    /* Kept from before Tempo: it comes in after the four, shown; and the four old names hidden leave it rather than none. */
    [BEFORE_TEMPO, ['presets']],
    [BEFORE_TEMPO, null],
    [['scenes', 'pedals', 'presets', 'tuner'], ['scenes', 'pedals', 'presets', 'tuner']],
    [['tuner'], null],
    [['presets', 'presets', 'scenes'], ['pedals']],
    [['tuner', 'looper', 'pedals'], ['looper']],
    [['Tuner', 'TUNER', ' tuner', ''], ['Tuner', ' tuner', '']],
    [['pedals', 'scenes', 'presets', 'tuner', 'scenes', 'setlists'], ['tuner', 'scenes']],
    [['setlists', 'looper'], ['setlists']],
    [null, ['tuner']],
    [null, ['tuner', 'tuner', 'tuner']],
    [null, ['presets', 'scenes', 'pedals', 'tempo']],
    [CHOSEN, ['scenes', 'pedals', 'tuner', 'tempo']],
    [null, ALL],
    [CHOSEN, ['tuner', 'presets', 'pedals', 'tempo', 'scenes']],
    [['scenes'], [...ALL, 'looper']]
  ]
  return {
    state: watchState({
      at: 1759363200000,
      linked: true,
      preset: { number: 12, name: 'Crunch Rhythm' },
      label: '012',
      scene: 1,
      sceneNames: ['Clean', 'Crunch', 'Lead'],
      sceneCount: 8,
      tempo: TEMPO,
      tunerStays: true,
      pages: CHOSEN,
      hidden: CHOSEN_HIDDEN
    }),
    tuner: { leaving, hiding },
    here: { everyMs: WATCH_HERE_MS, tickMs: WATCH_HERE_TICK_MS, cases: due },
    cases: given.map(([pages, hidden]) => ({
      pages,
      hidden,
      order: watchPageOrder(pages),
      off: watchPagesHidden(hidden),
      shown: watchPagesShown(pages, hidden)
    }))
  }
}

/** The lines a patch adds to one file, joined: the whole of a file it makes new. */
function addedTo(patch, file) {
  const from = patch.indexOf(`diff --git a/${file} b/${file}`)
  if (from < 0) return ''
  const next = patch.indexOf('\ndiff --git ', from + 1)
  return patch
    .slice(from, next < 0 ? undefined : next)
    .split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1))
    .join('\n')
}

export function run(test) {
  test('watch pages: any list comes to every page in an order, the known ones first as given, the rest in the usual order', async () => {
    const { WATCH_PAGES, WATCH_PAGE_NAMES, watchPageOrder, watchPagesShown } = await link()
    assert.deepEqual(WATCH_PAGES, ALL, 'the usual order moved: it is what the watch draws with none said')
    assert.equal(WATCH_PAGES.at(-1), 'tuner', 'the tuner is no longer last in the usual order')
    assert.deepEqual(WATCH_PAGE_NAMES, { scenes: 'Scenes', pedals: 'Pedals', presets: 'Presets', tempo: 'Tempo', tuner: 'Tuner' })

    /* Nothing, or nothing usable: the usual order. */
    for (const none of [undefined, null, [], 'tuner', 7, {}, { 0: 'tuner', length: 1 }, [null, 3, {}, ['tuner']]]) {
      assert.deepEqual(watchPageOrder(none), WATCH_PAGES, JSON.stringify(none))
    }
    /* A full order is kept as it is. */
    assert.deepEqual(watchPageOrder(CHOSEN), CHOSEN)
    /* Short: what is missing follows, in the usual order. */
    assert.deepEqual(watchPageOrder(['tuner']), ['tuner', 'scenes', 'pedals', 'presets', 'tempo'])
    assert.deepEqual(watchPageOrder(['presets', 'scenes']), ['presets', 'scenes', 'pedals', 'tempo', 'tuner'])
    /* Twice: the first one counts. Unknown, or not quite the name: dropped. */
    assert.deepEqual(watchPageOrder(['presets', 'presets', 'scenes']), ['presets', 'scenes', 'pedals', 'tempo', 'tuner'])
    assert.deepEqual(watchPageOrder(['tuner', 'looper', 'pedals']), ['tuner', 'pedals', 'scenes', 'presets', 'tempo'])
    assert.deepEqual(watchPageOrder(['Tuner', 'TUNER', ' tuner', '']), WATCH_PAGES, 'a name that is not exactly a page’s was taken for one')
    /* Always every page, each once, and never the list handed in. */
    for (const list of [CHOSEN, ['tuner'], [], null, ['x', 'pedals', 'pedals']]) {
      const order = watchPageOrder(list)
      assert.deepEqual([...order].sort(), [...WATCH_PAGES].sort(), `${JSON.stringify(list)} lost a page from the order, or drew one twice`)
      assert.notEqual(order, list)
      assert.notEqual(order, WATCH_PAGES, 'the usual order itself was handed out, to be changed by whoever has it')
    }

    /*
     * THE LIST GROWS BY THE SAME RULE. An order kept from before Tempo was a
     * page names four: Tempo is what is missing, so it comes in after them,
     * and it is shown. Nobody's order is thrown away for a new page.
     */
    assert.deepEqual(watchPageOrder(BEFORE_TEMPO), [...BEFORE_TEMPO, 'tempo'])
    assert.deepEqual(watchPagesShown(BEFORE_TEMPO, ['presets']), ['tuner', 'scenes', 'pedals', 'tempo'], 'a page hidden before Tempo existed came back, or Tempo did not appear')
    assert.deepEqual(watchPagesShown(BEFORE_TEMPO, []), [...BEFORE_TEMPO, 'tempo'])
  })

  test('watch pages: a page can be hidden, never the last one, and a list that hides every page hides none', async () => {
    const { WATCH_PAGES, watchPagesHidden, watchPagesShown, watchPagesKept, watchPagesUsual, watchPageMoved, watchPageHid } = await link()

    /* Hidden: the names known, each once, told in the usual order. */
    for (const none of [undefined, null, [], 'tuner', 7, {}, ['looper'], ['Tuner', ' tuner', ''], [null, 3, ['tuner']]]) {
      assert.deepEqual(watchPagesHidden(none), [], JSON.stringify(none))
    }
    assert.deepEqual(watchPagesHidden(['tuner']), ['tuner'])
    assert.deepEqual(watchPagesHidden(['tuner', 'scenes', 'tuner', 'nope']), ['scenes', 'tuner'])
    assert.deepEqual(watchPagesHidden(['tempo', 'presets', 'pedals', 'scenes']), ['scenes', 'pedals', 'presets', 'tempo'], 'all but one can be hidden')
    /* EVERY PAGE IS NONE: a watch always has a page. */
    assert.deepEqual(watchPagesHidden(ALL), [], 'a list that hides every page left the watch with none')
    assert.deepEqual(watchPagesHidden(['tuner', 'presets', 'pedals', 'tempo', 'scenes', 'looper']), [])

    /* Shown: the order with the hidden ones left out, and never empty, whatever the two lists. */
    assert.deepEqual(watchPagesShown(null, null), WATCH_PAGES)
    assert.deepEqual(watchPagesShown(CHOSEN, CHOSEN_HIDDEN), ['tuner', 'scenes', 'tempo', 'pedals'])
    assert.deepEqual(watchPagesShown(CHOSEN, ['tuner']), ['scenes', 'presets', 'tempo', 'pedals'], 'the watch does not open on the first SHOWN page')
    assert.deepEqual(watchPagesShown(CHOSEN, ALL), CHOSEN)
    assert.deepEqual(watchPagesShown(['tuner'], ['scenes', 'pedals', 'presets', 'tempo']), ['tuner'])
    /* The four names there were before Tempo, hidden by a list from then, leave the new page rather than none. */
    assert.deepEqual(watchPagesShown(null, ['scenes', 'pedals', 'presets', 'tuner']), ['tempo'])
    const lists = [null, [], ['tuner'], CHOSEN, ALL, BEFORE_TEMPO, ['x'], ['scenes', 'pedals', 'presets'], ['tuner', 'tuner'], 'tuner', 9]
    for (const order of lists) {
      for (const hidden of lists) {
        const shown = watchPagesShown(order, hidden)
        assert.ok(shown.length >= 1, `${JSON.stringify(order)} with ${JSON.stringify(hidden)} hidden left the watch no page to open on`)
        assert.equal(new Set(shown).size, shown.length)
        assert.ok(shown.every((p) => WATCH_PAGES.includes(p)))
        /* And the iPhone's own list is the shown ones, then the hidden ones: every page, each once. */
        const kept = watchPagesKept(order, hidden)
        assert.deepEqual(kept.order.slice(0, shown.length), shown)
        assert.deepEqual([...kept.order.slice(shown.length)].sort(), [...kept.hidden].sort())
        assert.deepEqual([...kept.order].sort(), [...WATCH_PAGES].sort())
      }
    }

    /* The usual pages: the usual order AND nothing hidden. */
    assert.equal(watchPagesUsual(WATCH_PAGES, []), true)
    assert.equal(watchPagesUsual(null, null), true)
    assert.equal(watchPagesUsual(['scenes'], undefined), true)
    assert.equal(watchPagesUsual(CHOSEN, []), false)
    assert.equal(watchPagesUsual(WATCH_PAGES, ['tuner']), false, 'a hidden page is taken for the usual pages, so there is no way back offered')
    assert.equal(watchPagesUsual(WATCH_PAGES, ALL), true)

    /* Hide: to the foot of the list. */
    assert.deepEqual(watchPageHid(null, null, 'pedals', true), { order: ['scenes', 'presets', 'tempo', 'tuner', 'pedals'], hidden: ['pedals'] })
    assert.deepEqual(watchPageHid(['scenes', 'presets', 'tempo', 'tuner', 'pedals'], ['pedals'], 'scenes', true), { order: ['presets', 'tempo', 'tuner', 'pedals', 'scenes'], hidden: ['scenes', 'pedals'] })
    /* Show: back as the last of the shown ones, before what is still hidden. */
    assert.deepEqual(watchPageHid(['presets', 'tempo', 'tuner', 'pedals', 'scenes'], ['scenes', 'pedals'], 'scenes', false), { order: ['presets', 'tempo', 'tuner', 'scenes', 'pedals'], hidden: ['pedals'] })
    assert.deepEqual(watchPageHid(['scenes', 'presets', 'tempo', 'tuner', 'pedals'], ['pedals'], 'pedals', false), { order: ['scenes', 'presets', 'tempo', 'tuner', 'pedals'], hidden: [] })
    /* THE LAST SHOWN PAGE STAYS: hiding it changes nothing, whichever page it is. */
    for (const last of WATCH_PAGES) {
      const others = WATCH_PAGES.filter((p) => p !== last)
      const was = watchPagesKept(null, others)
      assert.deepEqual(watchPagesShown(was.order, was.hidden), [last])
      assert.deepEqual(watchPageHid(was.order, was.hidden, last, true), was, `the last shown page, ${last}, was hidden`)
    }
    /* Hidden one after another, the last is refused: never none. */
    let kept = watchPagesKept(null, null)
    for (const page of WATCH_PAGES) kept = watchPageHid(kept.order, kept.hidden, page, true)
    assert.deepEqual(kept, { order: ['tuner', 'scenes', 'pedals', 'presets', 'tempo'], hidden: ['scenes', 'pedals', 'presets', 'tempo'] })
    /* Nothing to do: the same lists. */
    assert.deepEqual(watchPageHid(null, ['tuner'], 'tuner', true), watchPagesKept(null, ['tuner']))
    assert.deepEqual(watchPageHid(null, null, 'tuner', false), watchPagesKept(null, null))
    assert.deepEqual(watchPageHid(null, null, 'looper', true), watchPagesKept(null, null))

    /* Move up and Move down: one place among the SHOWN pages, and the same lists back where it cannot go. */
    const usual = { order: WATCH_PAGES, hidden: [] }
    assert.deepEqual(watchPageMoved(null, null, 'tuner', -1), { order: ['scenes', 'pedals', 'presets', 'tuner', 'tempo'], hidden: [] })
    assert.deepEqual(watchPageMoved(null, null, 'scenes', 1), { order: ['pedals', 'scenes', 'presets', 'tempo', 'tuner'], hidden: [] })
    assert.deepEqual(watchPageMoved(null, null, 'scenes', -1), usual, 'the first page moved up')
    assert.deepEqual(watchPageMoved(null, null, 'tuner', 1), usual, 'the last page moved down')
    assert.deepEqual(watchPageMoved(null, null, 'looper', 1), usual)
    assert.deepEqual(watchPageMoved(null, null, 'pedals', 0), usual)
    /* A hidden page is not stepped over or into, and does not move. */
    assert.deepEqual(watchPageMoved(CHOSEN, ['pedals'], 'tempo', 1), { order: CHOSEN, hidden: ['pedals'] }, 'the last shown page moved down into the hidden ones')
    assert.deepEqual(watchPageMoved(CHOSEN, ['pedals'], 'pedals', -1), { order: CHOSEN, hidden: ['pedals'] }, 'a hidden page was moved')
    assert.deepEqual(watchPageMoved(ALL, ['pedals'], 'presets', -1), { order: ['presets', 'scenes', 'tempo', 'tuner', 'pedals'], hidden: ['pedals'] })
    /* Four Move ups take the tuner from last to first: the page the watch opens on. */
    kept = usual
    for (let i = 0; i < 4; i++) kept = watchPageMoved(kept.order, kept.hidden, 'tuner', -1)
    assert.deepEqual(kept.order, ['tuner', 'scenes', 'pedals', 'presets', 'tempo'])
    assert.deepEqual(WATCH_PAGES, ALL, 'moving or hiding a page changed the usual order itself')
  })

  test('watch pages: the picture carries pages only when it is given an order, and to every other watch it is what it was', async () => {
    const { watchState, sameWatchState, WATCH_LINK_VERSION } = await link()
    const input = { at: 5, linked: true, preset: { number: 1, name: 'A' }, label: '001', sceneCount: 4 }
    const plain = watchState(input)
    assert.equal('pages' in plain, false, 'a watch that has not said it knows is sent an order')
    assert.equal('hidden' in plain, false, 'a watch that has not said it knows is sent hidden pages')
    assert.equal('tempo' in plain, false, 'a watch that has not said it has the Tempo page is sent a tempo')
    assert.equal('tunerStays' in plain, false, 'a watch that has not said it knows how is sent the tuner’s switch')
    for (const none of [{ pages: null }, { pages: undefined }, { pages: null, hidden: ['tuner'] }, { hidden: ['tuner'] }, { tempo: null }, { tempo: undefined }, { tunerStays: null }, { tunerStays: undefined }]) {
      assert.deepEqual(watchState({ ...input, ...none }), plain, `${JSON.stringify(none)} changed the picture`)
    }
    /* Given an order: both fields, repaired, last in the picture, and nothing else moved. */
    const ordered = watchState({ ...input, pages: ['tuner', 'tuner', 'nope'], hidden: ['pedals', 'nope', 'pedals'] })
    assert.deepEqual(ordered.pages, ['tuner', 'scenes', 'pedals', 'presets', 'tempo'])
    assert.deepEqual(ordered.hidden, ['pedals'])
    const { pages: _pages, hidden: _hidden, ...rest } = ordered
    assert.deepEqual(rest, plain, 'pages changed something else in the picture')
    assert.deepEqual(Object.keys(ordered).slice(-2), ['pages', 'hidden'])
    /* All shown is said, as an empty list, so a watch can be put back. */
    assert.deepEqual(watchState({ ...input, pages: [] }).pages, ALL)
    assert.deepEqual(watchState({ ...input, pages: [] }).hidden, [])
    /* A picture never leaves a watch with no page. */
    assert.deepEqual(watchState({ ...input, pages: CHOSEN, hidden: ALL }).hidden, [])
    /* The link's version does not move: nothing an older watch reads changed meaning. */
    assert.equal(WATCH_LINK_VERSION, 1)
    assert.equal(ordered.v, 1)
    /* A new order, or a page hidden, is a new picture, so it is sent. */
    assert.equal(sameWatchState(ordered, watchState({ ...input, pages: ['scenes'], hidden: ['pedals'] })), false, 'a new order was taken for the same picture and not sent')
    assert.equal(sameWatchState(ordered, watchState({ ...input, pages: ['tuner'], hidden: [] })), false, 'a page shown again was taken for the same picture and not sent')
    assert.equal(sameWatchState(ordered, plain), false)
  })

  test('watch pages: a watch says what it knows in its hello, and one that says nothing is asked nothing new', async () => {
    const { watchCommand, watchKnows, WATCH_KNOWS } = await link()
    assert.deepEqual(WATCH_KNOWS, ['pages', 'tempo', 'stay', 'here'])
    /* A watch from before: the one word it always was. */
    assert.deepEqual(watchCommand({ do: 'hello' }, null), { do: 'hello' })
    assert.deepEqual(watchCommand({ do: 'hello', knows: 'pages' }, null), { do: 'hello' }, 'a hello whose knows is not a list was taken for one')
    /* One that says so, and only what this phone knows of: never passed on as it came. */
    assert.deepEqual(watchCommand({ do: 'hello', knows: ['pages', 'tempo', 'stay', 'here'] }, null), { do: 'hello', knows: ['pages', 'tempo', 'stay', 'here'] })
    assert.deepEqual(watchCommand({ do: 'hello', knows: ['here', 'stay', 'tempo', 'pages', 'looper', 7, 'pages'] }, null), { do: 'hello', knows: ['pages', 'tempo', 'stay', 'here'] })
    assert.deepEqual(watchCommand({ do: 'hello', knows: ['pages', 'tempo'] }, null), { do: 'hello', knows: ['pages', 'tempo'] })
    assert.deepEqual(watchCommand({ do: 'hello', knows: ['pages'] }, null), { do: 'hello', knows: ['pages'] })
    assert.deepEqual(watchCommand({ do: 'hello', knows: [] }, null), { do: 'hello', knows: [] })
    assert.deepEqual(watchCommand({ do: 'hello', knows: ['looper'] }, null), { do: 'hello', knows: [] })
    for (const none of [undefined, null, 'pages', 3, {}]) assert.deepEqual(watchKnows(none), [])
    assert.deepEqual(watchKnows(['x', 'pages']), ['pages'])
    /* No other request grows a `knows`. */
    assert.deepEqual(watchCommand({ do: 'tuner', on: true, knows: ['pages'] }, null), { do: 'tuner', on: true })
  })

  test('watch tempo: the picture says the tempo, whether Tap is offered and why not, and the wrist’s switch, only when it is given one', async () => {
    const { watchState, sameWatchState } = await link()
    const input = { at: 5, linked: true, sceneCount: 4 }
    /* What the phone knows, as the page needs it. */
    assert.deepEqual(watchState({ ...input, tempo: TEMPO }).tempo, { bpm: 121.4, tap: true, why: '', wrist: true, running: false })
    assert.deepEqual(Object.keys(watchState({ ...input, tempo: TEMPO }).tempo), ['bpm', 'tap', 'why', 'wrist', 'running'])
    /* The number: to a tenth, and null (a dash on the watch) for none, never a nought. */
    const bpm = (v) => watchState({ ...input, tempo: { bpm: v } }).tempo.bpm
    assert.equal(bpm(120), 120)
    assert.equal(bpm(121.44), 121.4)
    for (const none of [null, undefined, 0, -3, NaN, Infinity, 'fast', {}]) assert.equal(bpm(none), null, String(none))
    /* No tempo known and nothing against tapping: the button still taps. */
    assert.deepEqual(watchState({ ...input, tempo: {} }).tempo, { bpm: null, tap: true, why: '', wrist: false, running: false })
    /* Where Play's Tap sends nothing: the sentence, and Tap is not offered. One follows from the other, so they cannot disagree. */
    const no = watchState({ ...input, tempo: { bpm: 90, why: 'The app can’t set this unit’s tempo yet. Tap tempo on the unit itself for now.' } }).tempo
    assert.equal(no.tap, false)
    assert.equal(no.why, 'The app can’t set this unit’s tempo yet. Tap tempo on the unit itself for now.')
    assert.equal(no.bpm, 90, 'a unit whose tempo cannot be set lost the tempo it is on')
    /* Both of the phone's sentences for it reach the watch whole. */
    const { NO_TEMPO } = await import('../shared/unsupported.mjs')
    const { VP4_NO_TEMPO } = await import('../shared/vp4-safety.mjs')
    for (const why of [NO_TEMPO, VP4_NO_TEMPO]) assert.equal(watchState({ ...input, tempo: { why } }).tempo.why, why, 'the phone’s sentence was cut short on its way to the watch')
    assert.ok(watchState({ ...input, tempo: { why: 'x'.repeat(900) } }).tempo.why.length <= 160)
    for (const notWords of [null, 7, true, {}, ['x']]) assert.equal(watchState({ ...input, tempo: { why: notWords } }).tempo.tap, true, String(notWords))
    /* The switch and the metronome: true only when said so. */
    for (const v of [1, 'yes', {}, null, undefined, false]) {
      assert.equal(watchState({ ...input, tempo: { wrist: v } }).tempo.wrist, false, String(v))
      assert.equal(watchState({ ...input, tempo: { running: v } }).tempo.running, false, String(v))
    }
    /* A tempo that moved, or a switch, is a new picture. */
    const a = watchState({ ...input, tempo: TEMPO })
    assert.equal(sameWatchState(a, watchState({ ...input, tempo: { ...TEMPO, bpm: 122 } })), false)
    assert.equal(sameWatchState(a, watchState({ ...input, tempo: { ...TEMPO, wrist: false } })), false)
    assert.equal(sameWatchState(a, watchState({ ...input, at: 9, tempo: TEMPO })), true)
  })

  test('watch tempo: a tap and the wrist’s switch are the only two new requests, each refused unless the last picture gave the watch that page', async () => {
    const { watchState, watchCommand, watchTapInTime, WATCH_TAP_LATE_MS } = await link()
    const input = { at: 5, linked: true, sceneCount: 4, pedals: [{ id: 50, name: 'Drive' }] }
    const withPage = watchState({ ...input, tempo: TEMPO })
    const noTap = watchState({ ...input, tempo: { ...TEMPO, why: 'The app can’t set this unit’s tempo yet.' } })
    const without = watchState(input)

    /* A tap: only where the picture offered one, and nothing rides in on it. */
    assert.deepEqual(watchCommand({ do: 'tap' }, withPage), { do: 'tap' })
    assert.deepEqual(watchCommand({ do: 'tap', bpm: 300, at: 1, times: 9 }, withPage), { do: 'tap' }, 'a tap carried something to the phone besides the tap')
    assert.equal(watchCommand({ do: 'tap' }, noTap), null, 'a tap was taken where Play’s own Tap sends nothing')
    assert.equal(watchCommand({ do: 'tap' }, without), null, 'a tap was taken from a watch that was never given the Tempo page')
    assert.equal(watchCommand({ do: 'tap' }, null), null)
    assert.equal(watchCommand({ do: 'tap' }, { tempo: { tap: 'yes' } }), null)
    /* The switch: on or off, and nothing else; taken where Tap is not (it is a setting of the phone's, not the unit's). */
    assert.deepEqual(watchCommand({ do: 'wrist', on: true }, withPage), { do: 'wrist', on: true })
    assert.deepEqual(watchCommand({ do: 'wrist', on: false, where: 'both', metronome: true }, withPage), { do: 'wrist', on: false }, 'the switch carried more than on or off')
    assert.deepEqual(watchCommand({ do: 'wrist', on: true }, noTap), { do: 'wrist', on: true })
    for (const bad of [{ do: 'wrist' }, { do: 'wrist', on: 'yes' }, { do: 'wrist', on: 1 }, { do: 'wrist', on: null }]) assert.equal(watchCommand(bad, withPage), null, JSON.stringify(bad))
    assert.equal(watchCommand({ do: 'wrist', on: true }, without), null, 'the switch was taken from a watch that was never given the Tempo page')
    assert.equal(watchCommand({ do: 'wrist', on: true }, null), null)
    assert.equal(watchCommand({ do: 'wrist', on: true }, { tempo: 'yes' }), null)

    /* NINE THINGS, and nothing else: no way to set a tempo by number, start the metronome or choose where it clicks from the wrist. */
    const asked = ['hello', 'scene', 'pedal', 'channel', 'preset', 'tuner', 'tap', 'wrist', 'here']
    const door = code(read('shared/watch-link.mjs'))
    const cases = [...door.slice(door.indexOf('export function watchCommand(')).matchAll(/case '([a-z]+)':/g)].map((m) => m[1])
    assert.deepEqual([...cases].sort(), [...asked].sort(), 'the watch’s door takes a request this list does not name')
    for (const no of ['tempo', 'bpm', 'metronome', 'click', 'taps', 'setTempo', 'save']) {
      assert.equal(watchCommand({ do: no, on: true, bpm: 120 }, withPage), null, `the watch may ask for “${no}”`)
    }

    /* A tap is a beat: one held on its way is not counted late. */
    assert.equal(WATCH_TAP_LATE_MS, 400)
    assert.equal(watchTapInTime(1000, 1000), true)
    assert.equal(watchTapInTime(1000, 1400), true)
    assert.equal(watchTapInTime(1000, 1401), false)
    assert.equal(watchTapInTime(1000, 16000), false, 'a tap held while nothing listened was counted when the app opened')
    for (const none of [undefined, null, NaN, '1000']) assert.equal(watchTapInTime(none, 1000), false, String(none))
  })

  test('watch tempo: the phone answers a tap with Play’s own Tap and the switch with the wrist’s own setting, and tells the watch what Play would say', async () => {
    const bridge = code(read('mobile/src/lib/watchBridge.js'))
    const flat = bridge.replace(/\s+/g, ' ')
    assert.match(bridge, /import \{ getState, noTapTempo, tapTempo, [^}]*\} from '\.\/rig'/)
    assert.match(bridge, /import \{ metronome, setWatchTap, useMetronome \} from '\.\/metronome'/)
    /* A TAP: Play's own function, with nothing passed to it, as it arrives or not at all. Never held for the link, and never tried again. */
    assert.match(flat, /if \(cmd\.do === 'tap'\) \{ if \(!watchTapInTime\(receivedAt\)\) \{ logDebug\('watch', 'tap not counted: it was held too long on its way'\) return \} if \(asleep\) probeNow\(\) tapTempo\(\) return \}/)
    assert.equal((bridge.match(/\btapTempo\(/g) || []).length, 1, 'Tap is pressed for the watch somewhere else as well')
    assert.doesNotMatch(bridge, /writeTempo|setTempo|tempoSender/, 'the watch has a way to the unit’s tempo that is not Play’s Tap button')
    /* THE SWITCH: the wrist's own setting and nothing else, with nothing to wait for. */
    assert.match(flat, /if \(cmd\.do === 'wrist'\) \{ setWatchTap\(cmd\.on\) return \}/)
    assert.doesNotMatch(bridge, /setMetronome|setUnitMetronome/, 'the watch can reach the metronome itself, or the unit’s click')
    /* Both are answered before the requests that wait for a woken phone's link: neither is `run`'s. */
    const run = flat.slice(flat.indexOf('const run = () => {'), flat.indexOf('if (!asleep) {'))
    assert.ok(run.length > 100 && !/tap|wrist/.test(run), 'a tap or the switch goes through the wait for a woken phone’s link')
    assert.ok(flat.indexOf("if (cmd.do === 'tap')") < flat.indexOf('const run = () => {'))
    assert.ok(flat.indexOf("if (cmd.do === 'wrist')") < flat.indexOf('const run = () => {'))

    /* THE PICTURE: Play's number, Play's own test for where Tap sends nothing with Play's sentence, and the metronome's setting as it is. */
    assert.match(bridge, /const tempo = \{ bpm: getState\(\)\.bpm, why: noTapTempo\(\), wrist: beat\.watch === true, running: beat\.on === true \}/)
    /* Sent only to a watch that has said it has the page, by the one function both pictures are made with. */
    assert.match(bridge, /const pictured = \(from\) => watchState\(\{ \.\.\.from, tempo: watchHasTempo\(\) \? from\.tempo : null, /)
    assert.match(code(read('mobile/src/lib/watchPages.js')), /export const watchHasTempo = \(\) => knows\.includes\('tempo'\)/)
    /* And the metronome's setting is watched, so the switch is in the next picture. */
    assert.match(bridge, /\n  useMetronome\(\)\n/)

    /* The wrist's setting alone: `watch`, kept, and no word to the unit. */
    const metro = code(read('mobile/src/lib/metronome.js'))
    const setter = metro.slice(metro.indexOf('export function setWatchTap(on) {'), metro.indexOf('export function useUnitMetronome('))
    assert.match(setter.replace(/\s+/g, ' '), /^export function setWatchTap\(on\) \{ const next = metronomeSetting\(\{ \.\.\.setting, watch: on === true \}\) if \(next\.watch === setting\.watch\) return setting = next announce\(\) AsyncStorage\.setItem\(KEY, JSON\.stringify\(setting\)\)\.catch\(\(\) => \{\}\) \}/)
    assert.doesNotMatch(setter, /switchUnit|setUnitMetronome|readUnitMetronome/, 'the wrist’s switch writes to the unit')
    /* By the rule itself: the wrist's switch changes neither the unit's click nor the phone's, whatever else is set. */
    const { clicks } = await import('../shared/metronome.mjs')
    for (const on of [true, false]) {
      for (const where of ['unit', 'phone', 'both']) {
        for (const can of [true, false]) {
          for (const heard of [true, false]) {
            const off = clicks({ on, where, watch: false }, can, heard)
            const onWrist = clicks({ on, where, watch: true }, can, heard)
            assert.equal(onWrist.unit, off.unit, 'the wrist’s switch moved the unit’s click')
            assert.equal(onWrist.phone, off.phone, 'the wrist’s switch moved the phone’s click')
            assert.equal(onWrist.watch, on, 'the wrist taps without the metronome on, or does not with it on')
          }
        }
      }
    }

    /* The tips on Settings → Apple Watch follow the watch: five pages and a line for Tempo only for one that has it. */
    const words = read('mobile/src/lib/watchBridge.js')
    assert.match(words, /^export const WATCH_HOW_PAGES_TEMPO = 'Swipe up or down on the watch, or turn the Digital Crown, to move between its pages: Scenes, Pedals, Presets, Tempo and Tuner\.'$/m)
    assert.match(words, /^export const WATCH_HOW_TEMPO = 'Tempo shows the tempo\. Tap its button in time to set a new one\.'$/m)
    assert.match(words, /to move between its four pages: Scenes, Pedals, Presets and Tuner\./, 'a watch from before the Tempo page is told of a page it does not have')
  })

  test('watch pages: the phone keeps them on the device, and offers and sends them only to a watch that has said it takes them', () => {
    const kept = code(read('mobile/src/lib/watchPages.js'))
    /* Kept on the device, repaired on the way in and on the way out. */
    assert.match(kept, /const ORDER_KEY = 'fractal\.watch\.pages'/)
    assert.match(kept, /const HIDDEN_KEY = 'fractal\.watch\.hidden'/)
    assert.match(kept, /const KNOWS_KEY = 'fractal\.watch\.knows'/)
    assert.match(kept, /\(\{ order, hidden \} = watchPagesKept\(read\(ORDER_KEY\), read\(HIDDEN_KEY\)\)\)/)
    assert.match(kept, /function keep\(next\) \{\s+const fixed = watchPagesKept\(next\.order, next\.hidden\)/)
    assert.match(kept, /export const moveWatchPage = \(name, by\) => keep\(watchPageMoved\(order, hidden, name, by\)\)/)
    assert.match(kept, /export const hideWatchPage = \(name, hide\) => keep\(watchPageHid\(order, hidden, name, hide\)\)/, 'a page is hidden some way that does not ask the rule, which is what keeps the last one')
    assert.match(kept, /export const usualWatchPages = \(\) => keep\(\{ order: WATCH_PAGES, hidden: \[\] \}\)/, 'the way back to the usual pages leaves one hidden')
    /* Starts as "the watch has said nothing": no rows, no fields. */
    assert.match(kept, /let knows = \[\]\n/)
    assert.match(kept, /export const watchOrdersPages = \(\) => knows\.includes\('pages'\)/)
    assert.match(kept, /export const pagesToSend = \(\) => \(watchOrdersPages\(\) \? \{ pages: order, hidden \} : null\)/, 'pages are sent to a watch that has not said it takes them')
    /* The watch's word is what a hello said, through the phone's own filter, and a hello that says nothing takes it back. */
    assert.match(kept, /export function noteWatchKnows\(list\) \{\s+heard = true\s+const next = watchKnows\(list\)/)
    assert.doesNotMatch(kept, /watchPaired|Platform\.|isAdmin|features/, 'whether the watch takes its pages is guessed from something other than the watch saying so')

    const bridge = code(read('mobile/src/lib/watchBridge.js'))
    assert.match(bridge, /import \{ noteWatchKnows, pagesToSend, [^}]*\buseWatchPages\b[^}]*\} from '\.\/watchPages'/)
    /* The hello: what it knows is kept first, and the picture it is answered with is made with it. */
    assert.match(
      bridge.replace(/\s+/g, ' '),
      /if \(cmd\.do === 'hello'\) \{ noteWatchKnows\(cmd\.knows\) if \(lastFrom\.current\) last\.current = pictured\(lastFrom\.current\) sender\.current\?\.flush\(last\.current\)/,
      'a watch that takes its pages is answered with the usual ones first'
    )
    /* Every picture: made by the one function that knows what this watch is sent, and nowhere else. */
    assert.match(bridge, /const state = pictured\(lastFrom\.current\)/)
    assert.equal((bridge.match(/watchState\(/g) || []).length, 1, 'a picture is made somewhere that does not ask what this watch is sent')
    assert.doesNotMatch(bridge, /[{,]\s*(pages|hidden):/, 'the pages are put in the picture by hand')
    /* And a change to them, or to what the watch knows, draws the bridge again so the picture goes out. */
    assert.match(bridge, /\n  useWatchPages\(\)\n/)

    /* Settings: the rows are the component's, and the component draws nothing for a watch that has not said so. */
    const rows = code(read('mobile/src/components/WatchPageOrder.js'))
    assert.match(rows, /const \{ order, hidden, can \} = useWatchPages\(\)\s+if \(!can\) return null/, 'the Watch pages rows are drawn for a watch that takes none')
    assert.match(rows, /onPress=\{\(\) => moveWatchPage\(page, -1\)\}/)
    assert.match(rows, /onPress=\{\(\) => moveWatchPage\(page, 1\)\}/)
    assert.match(rows, /disabled=\{i === 0\}/)
    assert.match(rows, /disabled=\{i === shown\.length - 1\}/)
    /* Hide beside every shown page, switched off on the last one; Show beside every hidden one. */
    assert.match(rows, /const last = shown\.length === 1/)
    assert.match(rows.replace(/\s+/g, ' '), /label=\{WATCH_ORDER_HIDE\} height=\{44\} disabled=\{last\} accessibilityLabel=\{`Hide \$\{name\} on your watch`\} onPress=\{\(\) => hideWatchPage\(page, true\)\}/, 'the last shown page’s Hide can be pressed')
    assert.match(rows, /label=\{WATCH_ORDER_SHOW\} height=\{44\} accessibilityLabel=\{`Show \$\{name\} on your watch`\} onPress=\{\(\) => hideWatchPage\(page, false\)\}/)
    assert.match(rows, /\{last \? <Text[^>]*>\{WATCH_ORDER_LAST\}<\/Text> : null\}/)
    assert.match(rows, /\{watchPagesUsual\(order, hidden\) \? null : <Press label=\{WATCH_ORDER_USUAL\} height=\{44\} onPress=\{usualWatchPages\} \/>\}/, 'the way back to the usual pages is offered while they are the usual ones, or not at all')
    assert.doesNotMatch(rows, /PanResponder|onLongPress|Draggable/, 'the order is dragged: it is stepped, with two buttons a row')
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /import WatchPageOrder from '\.\.\/components\/WatchPageOrder'/)
    const page = settings.slice(settings.indexOf("{page === 'watch' ? ("), settings.indexOf("{page === 'siri' && siriOpen ? ("))
    assert.ok(page.length > 200, 'the Apple Watch page moved; this check reads it')
    assert.equal((page.match(/<WatchPageOrder \/>/g) || []).length, 1, 'the Watch pages rows are not on the Apple Watch page, once')
    assert.equal((settings.match(/<WatchPageOrder \/>/g) || []).length, 1)
    /* And that page is an iPhone's only, as it always was: an iPad has no watch. */
    assert.match(settings, /Platform\.OS === 'ios' && deviceKind\(\) !== 'ipad' && watchSupported\(\) \? \(\s+<SetupRow\s+title="Apple Watch"/)
  })

  test('watch pages: the words are a guitarist’s, and say which page the watch opens on', () => {
    const rows = read('mobile/src/components/WatchPageOrder.js')
    const said = Object.fromEntries([...rows.matchAll(/^export const (WATCH_ORDER_\w+) = '([^']+)'$/gm)].map((m) => [m[1], m[2]]))
    assert.deepEqual(said, {
      WATCH_ORDER_HEAD: 'Watch pages',
      WATCH_ORDER_LEAD: 'Choose which pages your Apple Watch shows, and their order. The first one is the page the watch opens on.',
      WATCH_ORDER_FIRST: 'Opens first',
      WATCH_ORDER_UP: 'Move up',
      WATCH_ORDER_DOWN: 'Move down',
      WATCH_ORDER_HIDE: 'Hide',
      WATCH_ORDER_SHOW: 'Show',
      WATCH_ORDER_HIDDEN: 'Hidden',
      WATCH_ORDER_LAST: 'Your watch always keeps one page, so the last one stays.',
      WATCH_ORDER_USUAL: 'Show every page in the usual order',
      WATCH_ORDER_WHEN: 'Your watch takes a change the next time the Play screen is open on your iPhone.'
    })
    for (const line of Object.values(said)) {
      assert.ok(!/this (phone|iPhone|device)/i.test(line), `“${line}” says this phone`)
      assert.ok(!/\b(beta|tried|tested|official|default|array|index|reorder|toggle|disabled?)\b/i.test(line), `“${line}” is not a guitarist’s word`)
      /* No count of pages in the words: the list grew once already. */
      assert.ok(!/\b(four|five|4|5)\b/i.test(line), `“${line}” counts the pages`)
    }
    /* Each shown row says its page by the watch's own name for it, numbered, and the first says it opens first. */
    const drawn = code(rows)
    assert.match(drawn, /\{`\$\{i \+ 1\}\. \$\{name\}`\}/)
    assert.match(drawn, /\{i === 0 \? <Text[^>]*>\{WATCH_ORDER_FIRST\}<\/Text> : null\}/)
    assert.match(drawn, /accessibilityLabel=\{`Move \$\{name\} up`\}/)
    assert.match(drawn, /accessibilityLabel=\{`Move \$\{name\} down`\}/)
    /* A hidden row says its name and that it is hidden, with no number: it is not one of the watch's pages just now. */
    assert.match(drawn, /<Text[^>]*>\{name\}<\/Text>\s+<Text[^>]*>\{WATCH_ORDER_HIDDEN\}<\/Text>/)
  })

  test('watch check-in: while the watch is on screen it says “here” every twenty seconds, which keeps the iPhone awake and reaches the unit as nothing', async () => {
    const { watchCommand, watchState, watchHereDue, WATCH_HERE_MS, WATCH_HERE_TICK_MS } = await link()
    /* The word: itself and nothing else, whatever rides in on it, with or without a picture. */
    assert.deepEqual(watchCommand({ do: 'here' }, null), { do: 'here' })
    assert.deepEqual(watchCommand({ do: 'here', scene: 3, tuner: true, on: true, index: 1, bpm: 200 }, watchState({ sceneCount: 4 })), { do: 'here' }, 'a check-in carried something to the phone besides itself')

    /* WHEN ONE IS DUE, with the clock handed in. */
    assert.equal(WATCH_HERE_MS, 20000)
    assert.equal(WATCH_HERE_TICK_MS, 2000)
    const at = 1_000_000
    const due = (over) => watchHereDue({ onScreen: true, pages: true, demo: false, lastSent: at, now: at + WATCH_HERE_MS, ...over })
    assert.equal(due({}), true)
    assert.equal(due({ now: at + WATCH_HERE_MS - 1 }), false, 'a check-in went before its twenty seconds')
    assert.equal(due({ now: at + 600000 }), true, 'a wrist raised after ten minutes sends none')
    assert.equal(due({ lastSent: null }), true)
    assert.equal(due({ lastSent: undefined }), true)
    assert.equal(due({ lastSent: at + 5000, now: at }), false)
    /* THE WRIST DOWN: never, however long it has been. That is what lets the iPhone go back to sleep. */
    assert.equal(due({ onScreen: false, now: at + 600000 }), false, 'the watch checks in with its screen off, and the iPhone never sleeps')
    /* The waiting page, and the demo: never. */
    assert.equal(due({ pages: false, now: at + 600000 }), false)
    assert.equal(due({ demo: true, now: at + 600000 }), false)
    /* Only a plain yes is a yes. */
    for (const odd of [1, 'yes', null, undefined]) {
      assert.equal(due({ onScreen: odd }), false, String(odd))
      assert.equal(due({ pages: odd }), false, String(odd))
    }
    assert.equal(watchHereDue(), false)

    /*
     * INSIDE THE PHONE'S AWAKE WINDOW, with room to spare: a check-in goes
     * at most one tick after it is due, and the phone sleeps WAKE_SECONDS
     * after the last message it heard. Three seconds for the message to
     * cross, or the phone would nod off between two of them.
     */
    const native = read('mobile/modules/fractal-watch/ios/FractalWatchModule.swift')
    const wake = Number(/private static let WAKE_SECONDS: Double = (\d+)/.exec(native)?.[1]) * 1000
    assert.ok(wake > 0, 'the phone’s awake window is not where this test reads it')
    assert.ok(WATCH_HERE_MS + WATCH_HERE_TICK_MS + 3000 <= wake, `a check-in every ${WATCH_HERE_MS / 1000} s, up to ${WATCH_HERE_TICK_MS / 1000} s late, does not fit the ${wake / 1000} s the phone stays awake`)
    /* THE PHONE'S NATIVE HALF NEEDS NO CHANGE: any message from the watch renews the window, one task held, ended by the timer or by iOS's own expiry. */
    const flat = native.replace(/\s+/g, ' ')
    assert.match(flat, /private func arrived\(_ json: String, _ at: Date\) \{ stayAwake\(\)/, 'a message from the watch no longer renews the phone’s awake window before anything else')
    assert.match(flat, /if awake == \.invalid \{ awake = UIApplication\.shared\.beginBackgroundTask\(withName: "watch tap"\) \{ \[weak self\] in self\?\.sleep\(\) \} \} sleepAt\?\.cancel\(\)/, 'the awake window is no longer one task, renewed, and ended when iOS says its time is up')
    assert.match(flat, /private func sleep\(\) \{ sleepAt\?\.cancel\(\) sleepAt = nil if awake != \.invalid \{ UIApplication\.shared\.endBackgroundTask\(awake\) awake = \.invalid \} \}/)
    assert.doesNotMatch(native, /UIBackgroundModes|AVAudioSession|HKWorkoutSession|WKExtendedRuntimeSession/, 'the phone is kept awake some other way than the wake a watch message gives')
    assert.doesNotMatch(JSON.stringify(JSON.parse(read('mobile/app.json')).expo.ios.infoPlist || {}), /UIBackgroundModes/, 'the iPhone app has a background mode')

    /* THE PHONE'S JAVASCRIPT: nothing for the unit. A phone found asleep rejoins its connection, as the hello's does; an awake one does nothing at all. */
    const bridge = code(read('mobile/src/lib/watchBridge.js')).replace(/\s+/g, ' ')
    assert.match(bridge, /if \(cmd\.do === 'here'\) \{ if \(asleep\) \{ logDebug\('watch', 'here', 'the watch is on screen \(kept the phone awake\)'\) probeNow\(\) \} return \}/)
    const run = bridge.slice(bridge.indexOf('const run = () => {'), bridge.indexOf('if (!asleep) {'))
    assert.ok(run.length > 100 && !/'here'/.test(run), 'a check-in reaches the requests that are sent to the unit')
    assert.ok(bridge.indexOf("if (cmd.do === 'here')") < bridge.indexOf("if (cmd.do === 'hello')"), 'a check-in is not answered first, before anything that sends')

    /* THE WORDS, for a watch that checks in: what it costs, when it stops, and no more than happens. */
    const words = read('mobile/src/lib/watchBridge.js')
    const tip = /^export const WATCH_HOW_LOCKED_HERE =\n  '([^']+)'$/m.exec(words)?.[1]
    assert.equal(
      tip,
      'For every tap on the watch to land, keep your iPhone unlocked with this app on the Play screen. With the iPhone locked, the watch keeps this app awake while the watch app is on the watch’s screen, which uses more of the iPhone’s battery. Lower your wrist and the iPhone goes back to sleep about half a minute later; the first tap after that may not go through, so tap again straight away. The live tuner needs the phone open. If this app has been swiped closed on the iPhone, open it again: the watch can’t.'
    )
    assert.ok(!/this (phone|device)\b/i.test(tip), 'the tip says this phone')
    assert.ok(!/\b(always|never miss|every tap lands|stays in step|follows your unit)\b/i.test(tip.replace('For every tap on the watch to land, keep your iPhone unlocked', '')), 'the tip promises more than a locked iPhone does')
    assert.match(words, /const howLines = \(\) => \(watchWakes\(\) \? \[watchChecksIn\(\) \? WATCH_HOW_LOCKED_HERE : WATCH_HOW_LOCKED, \.\.\.WATCH_HOW\.slice\(1\)\] : WATCH_HOW\)/, 'a watch that does not check in is told its iPhone is kept awake')
    assert.match(code(read('mobile/src/lib/watchPages.js')), /export const watchChecksIn = \(\) => knows\.includes\('here'\)/)
  })

  test('watch tuner: leaving its page turns it off unless the iPhone says it stays, and hiding its page turns it off whatever the iPhone says', async () => {
    const { watchState, sameWatchState, watchTunerStopsOnLeaving, watchTunerStopsOnHiding } = await link()
    /* LEAVING. Off is the default and is what the watch has always done: only a plain `true` keeps the tuner on. */
    assert.equal(watchTunerStopsOnLeaving(true, false), true)
    for (const notSaid of [undefined, null, 0, 1, 'yes', 'true', {}]) assert.equal(watchTunerStopsOnLeaving(true, notSaid), true, `a tuner was left on behind a swipe by ${JSON.stringify(notSaid)}`)
    assert.equal(watchTunerStopsOnLeaving(true, true), false, 'the tuner was turned off by a swipe with the switch on')
    /* Nothing to turn off, nothing sent. */
    for (const stays of [true, false, null]) assert.equal(watchTunerStopsOnLeaving(false, stays), false)
    assert.equal(watchTunerStopsOnLeaving('on', false), false)

    /* HIDING. Its page was shown, is not now, and the tuner is on: off. The switch is no part of the question. */
    assert.equal(watchTunerStopsOnHiding.length, 3, 'hiding the tuner’s page asks something besides the pages and the tuner')
    assert.equal(watchTunerStopsOnHiding(ALL, ['scenes', 'pedals', 'presets', 'tempo'], true), true, 'a tuner was left on with no page on the watch to stop it from')
    assert.equal(watchTunerStopsOnHiding(ALL, ['scenes', 'pedals', 'presets', 'tempo'], false), false)
    /* Its page still there (a new order, another page hidden), or hidden already: not this. */
    assert.equal(watchTunerStopsOnHiding(ALL, CHOSEN, true), false)
    assert.equal(watchTunerStopsOnHiding(ALL, ['tuner'], true), false)
    assert.equal(watchTunerStopsOnHiding(['scenes', 'pedals'], ['scenes'], true), false)
    assert.equal(watchTunerStopsOnHiding(['scenes'], ALL, true), false)
    for (const none of [null, undefined, 'tuner', 7]) {
      assert.equal(watchTunerStopsOnHiding(none, ['scenes'], true), false)
      assert.equal(watchTunerStopsOnHiding(ALL, none, true), false)
    }

    /* THE PICTURE: the switch only when it is given one, and true only for a plain true. */
    const input = { at: 5, linked: true, sceneCount: 4 }
    assert.equal(watchState({ ...input, tunerStays: true }).tunerStays, true)
    assert.equal(watchState({ ...input, tunerStays: false }).tunerStays, false, 'the switch turned off is not said, so a watch could not be put back')
    for (const odd of [1, 'yes', {}, []]) assert.equal(watchState({ ...input, tunerStays: odd }).tunerStays, false, String(odd))
    assert.equal(sameWatchState(watchState({ ...input, tunerStays: true }), watchState({ ...input, tunerStays: false })), false, 'the switch moved and the picture was not sent')
  })

  test('watch tuner: the phone keeps the switch off unless it is turned on, offers and sends it only to a watch that knows how, and says the catch', () => {
    const kept = code(read('mobile/src/lib/watchPages.js'))
    assert.match(kept, /const STAYS_KEY = 'fractal\.watch\.tunerStays'/)
    /* Off to start, and on only for a kept, plain true. */
    assert.match(kept, /let stays = false\n/)
    assert.match(kept, /stays = read\(STAYS_KEY\) === true/)
    assert.match(kept.replace(/\s+/g, ' '), /export function setTunerStays\(on\) \{ const next = on === true if \(next === stays\) return stays = next announce\(\) AsyncStorage\.setItem\(STAYS_KEY, JSON\.stringify\(stays\)\)\.catch\(\(\) => \{\}\) \}/)
    /* Shown and sent only to a watch that has said `stay`. */
    assert.match(kept, /canStay: knows\.includes\('stay'\)/)
    assert.match(kept, /export const tunerStaysToSend = \(\) => \(knows\.includes\('stay'\) \? stays : null\)/, 'the tuner’s switch is sent to a watch that has not said it knows how')
    const bridge = code(read('mobile/src/lib/watchBridge.js'))
    assert.match(bridge, /const pictured = \(from\) => watchState\(\{ \.\.\.from, tempo: watchHasTempo\(\) \? from\.tempo : null, tunerStays: tunerStaysToSend\(\), \.\.\.pagesToSend\(\) \}\)/)
    /* The phone does nothing else with it: no request from the watch reads it, and nothing here turns a tuner on or off by it. */
    assert.equal((bridge.match(/tunerStaysToSend\(/g) || []).length, 2, 'the tuner’s switch is read somewhere besides the picture and the tips')

    const rows = read('mobile/src/components/WatchTunerStays.js')
    assert.match(code(rows), /const \{ stays, canStay \} = useWatchPages\(\)\s+if \(!canStay\) return null/, 'the tuner’s switch is drawn for a watch that cannot do it')
    assert.match(code(rows), /<Press label=\{stays \? WATCH_TUNER_STAYS_ON : WATCH_TUNER_STAYS_OFF\} tone="live" on=\{stays\} onPress=\{\(\) => setTunerStays\(!stays\)\} \/>/)
    assert.match(code(rows), /\{stays \? WATCH_TUNER_NOTE_ON : WATCH_TUNER_NOTE_OFF\}/)
    /* The phone's own sentence for it: the line under Stop tuner beside Play. */
    const mutes = /^export const TUNER_MUTES = '([^']+)'$/m.exec(read('mobile/src/lib/twoSides.js'))[1]
    assert.equal(mutes, 'Your unit’s own Tuner setting decides if the sound mutes.')
    assert.match(rows, /^import \{ TUNER_MUTES \} from '\.\.\/lib\/twoSides'$/m, 'the catch is not said in the phone’s own sentence for it')
    const said = Object.fromEntries([...rows.matchAll(/^export const (WATCH_TUNER_\w+) = ['`]([^'`]+)['`]$/gm)].map((m) => [m[1], m[2].replace('${TUNER_MUTES}', mutes)]))
    assert.deepEqual(said, {
      WATCH_TUNER_HEAD: 'Tuner on your watch',
      WATCH_TUNER_STAYS_ON: 'Stays on when you swipe away: on',
      WATCH_TUNER_STAYS_OFF: 'Stays on when you swipe away: off',
      WATCH_TUNER_NOTE_OFF: 'Off: swiping away from the Tuner page on your watch stops the tuner.',
      WATCH_TUNER_NOTE_ON:
        'On: swiping to another page on your watch doesn’t stop the tuner. Stop it with Stop tuning on the watch, or from your iPhone or the unit. Your unit’s own Tuner setting decides if the sound mutes. If it does, your sound stays muted until the tuner is stopped. Hiding the Tuner page still stops it.'
    })
    /* The catch, plainly, and no more than happens: never that the tuner stays on for good, or that the watch keeps showing the note. */
    assert.match(said.WATCH_TUNER_NOTE_ON, /stays muted until the tuner is stopped/)
    assert.match(said.WATCH_TUNER_NOTE_ON, /Hiding the Tuner page still stops it\./)
    for (const line of Object.values(said)) {
      assert.ok(!/this (phone|iPhone|device)/i.test(line), `“${line}” says this phone`)
      assert.ok(!/\b(always|forever|never turns off|keeps showing|locked|stays on until)\b/i.test(line), `“${line}” promises more than happens`)
    }
    /* On the Apple Watch page, once, under the pages. */
    const settings = read('mobile/src/screens/Settings.js')
    const page = settings.slice(settings.indexOf("{page === 'watch' ? ("), settings.indexOf("{page === 'siri' && siriOpen ? ("))
    assert.equal((settings.match(/<WatchTunerStays \/>/g) || []).length, 1)
    assert.ok(page.indexOf('<WatchTunerStays />') > page.indexOf('<WatchPageOrder />') && page.indexOf('<WatchPageOrder />') > 0, 'the tuner’s switch is not on the Apple Watch page, under the pages')
    /* And the tips there stop saying the tuner turns off when its page is left, while the switch is on. */
    const words = read('mobile/src/lib/watchBridge.js')
    assert.match(words, /^export const WATCH_HOW_TUNER_STAYS = 'The tuner starts only when you tap it\. Leaving its page doesn’t stop it, as you chose above: tap Stop tuning\.'$/m)
    assert.match(words, /const tuner = tunerStaysToSend\(\) === true \? WATCH_HOW_TUNER_STAYS : lines\[3\]/)
    /* watchHow places the tips by number, so there are four of them, the tuner's last. */
    const tips = words.slice(words.indexOf('export const WATCH_HOW = ['), words.indexOf(']', words.indexOf('export const WATCH_HOW = [')))
    assert.equal((tips.match(/^  (WATCH_HOW_OPEN|'[^\n]*'),?$/gm) || []).length, 4, 'the watch tips grew or shrank, and watchHow places them by number')
    assert.match(tips, /'The tuner starts only when you tap it, and turns off when you leave its page\.'\n$/, 'the tuner’s tip is no longer the last')
    assert.match(words, /'The tuner starts only when you tap it, and turns off when you leave its page\.'/)
    assert.match(code(settings), /const clickSetting = useMetronome\(\)\s+useWatchPages\(\)/, 'the Apple Watch page’s tips are not drawn again when the switch moves')
  })

  test('watch tuner: the mockup Justin picked is on record, with the day he picked it', () => {
    assert.ok(existsSync(at('docs/watch/tuner-start-stop.png')), 'the picture the tuner page was chosen from is not in the repository')
    const png = readFileSync(at('docs/watch/tuner-start-stop.png'))
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'tuner-start-stop.png is not a picture')
    const note = read('docs/watch/README.md')
    assert.match(note, /!\[[^\]]*\]\(tuner-start-stop\.png\)/)
    assert.match(note, /`tuner-start-stop\.png` is the mockup Justin picked on 11 November 2026/)
    assert.match(note, /"Go with option B for the watch I like that one\."/)
    for (const words of ['"Start tuning"', '"Stop tuning"', '"Off"', '"Tuner is off"']) assert.ok(note.includes(words), `docs/watch/README.md does not say ${words}`)
  })

  test('watch pages: the watch’s half waits as a patch, and with it in the watch draws the shown pages in the order sent, has its Tempo page, and still opens CI’s pages by name', async () => {
    const { WATCH_PAGES, WATCH_KNOWS } = await link()
    const model = read('mobile/targets/watch/Model.swift')
    const root = read('mobile/targets/watch/FractalWatchApp.swift')
    const fixtureAt = 'mobile/watch-ci/Tests/WatchModelTests/pages.json'
    const patched = /\bvar pages: \[String\]\? = nil/.test(model)

    if (!patched) {
      /* THE TREE AS MAIN HAS IT: the watch untouched, so its line of the fingerprint is where it was, and the Swift half listed as waiting. */
      assert.doesNotMatch(model, /WatchPage\b|watchPageOrder|watchPagesHidden|WatchTempo|tunerStays|watchHereDue|"knows"|"do":"tap"|"do":"here"/, 'part of the watch’s half is in the tree, which moves the watch’s fingerprint, and part is not')
      assert.match(root, /@State private var page = Launch\.number\("page"\)/)
      assert.match(root.replace(/\s+/g, ' '), /ScenesPage\(state: state\)\.tag\(0\) PedalsPage\(state: state\)\.tag\(1\) PresetsPage\(state: state\)\.tag\(2\) TunerPage\(state: state\)\.tag\(3\)/)
      assert.doesNotMatch(read('mobile/targets/watch/Pages.swift'), /TempoPage/)
      assert.equal(existsSync(at(fixtureAt)), false, 'the watch’s pages fixture is in the tree without the Swift that reads it')
      assert.match(read('docs/pending/README.md'), /^\| `watch-page-order\.patch` \|/m, 'the watch’s half of its pages is neither in the tree nor waiting in docs/pending')
      const patch = read('docs/pending/watch-page-order.patch')
      for (const f of [
        'mobile/targets/watch/Model.swift',
        'mobile/targets/watch/FractalWatchApp.swift',
        'mobile/targets/watch/Pages.swift',
        'mobile/targets/watch/PhoneLink.swift',
        'mobile/watch-ci/Package.swift',
        'mobile/watch-ci/screens.sh',
        'mobile/watch-ci/Tests/WatchModelTests/WatchModelTests.swift',
        fixtureAt
      ]) {
        assert.ok(patch.includes(`diff --git a/${f} b/${f}`), `the waiting patch does not carry ${f}`)
      }
      /* It quotes no version number, which stops a patch applying at the next one, and touches nothing an update could carry. */
      assert.doesNotMatch(patch, /"version": "\d+\.\d+\.\d+"/)
      assert.deepEqual(
        [...patch.matchAll(/^diff --git a\/(\S+) b\//gm)].map((m) => m[1]).filter((f) => !/^mobile\/(targets\/watch|watch-ci)\//.test(f)),
        [],
        'the watch’s patch changes something outside the watch app and its own tests'
      )
      /* And the fixture it carries is what the phone's rules give today: a rule changed here means the patch is made again. */
      assert.deepEqual(
        JSON.parse(addedTo(patch, fixtureAt)),
        await pagesFixture(),
        'the fixture in the waiting patch is not what the phone’s rules give any more: write it again and remake the patch (docs/pending/README.md says how)'
      )
      return
    }

    /* WITH THE PATCH IN. The fixture is what the phone's own rules write, so the Swift tests read the phone's answers. */
    assert.deepEqual(JSON.parse(read(fixtureAt)), await pagesFixture(), 'the watch’s pages fixture is not what the phone’s rules give any more: write it again (the command is over pagesFixture)')
    assert.match(read('mobile/watch-ci/Package.swift'), /resources: \[\.copy\("state\.json"\), \.copy\("pages\.json"\)\]/)

    /* The same names, in the same usual order, and the same rules in the same steps. */
    const flat = model.replace(/\s+/g, ' ')
    assert.match(model, new RegExp(`enum WatchPage: String, CaseIterable, Equatable \\{\\s+case ${WATCH_PAGES.join(', ')}\\b`), 'the watch’s pages are not the phone’s')
    assert.match(model, new RegExp(`static let usual: \\[WatchPage\\] = \\[${WATCH_PAGES.map((p) => `\\.${p}`).join(', ')}\\]`), 'the watch’s usual order is not the phone’s')
    assert.match(
      flat,
      /func watchPageOrder\(_ names: \[String\]\?\) -> \[WatchPage\] \{ var out: \[WatchPage\] = \[\] for name in names \?\? \[\] \{ if let page = WatchPage\(rawValue: name\), !out\.contains\(page\) \{ out\.append\(page\) \} \} for page in WatchPage\.usual where !out\.contains\(page\) \{ out\.append\(page\) \} return out \}/,
      'the watch repairs an order some other way than the phone does'
    )
    assert.match(
      flat,
      /func watchPagesHidden\(_ names: \[String\]\?\) -> \[WatchPage\] \{ let said = names \?\? \[\] let out = WatchPage\.usual\.filter \{ said\.contains\(\$0\.rawValue\) \} return out\.count < WatchPage\.usual\.count \? out : \[\] \}/,
      'the watch reads the hidden pages some other way than the phone does, or can be left with none'
    )
    assert.match(flat, /func watchPagesShown\(_ pages: \[String\]\?, _ hidden: \[String\]\?\) -> \[WatchPage\] \{ let off = watchPagesHidden\(hidden\) return watchPageOrder\(pages\)\.filter \{ !off\.contains\(\$0\) \} \}/)
    assert.match(model, /var hidden: \[String\]\? = nil/)
    assert.match(model, /var shown: \[WatchPage\] \{ watchPagesShown\(pages, hidden\) \}/)
    /* It says what it knows in its hello, in the phone's words, and still says hello. */
    assert.ok(model.includes(`case .hello: return #"{"do":"hello","knows":[${WATCH_KNOWS.map((k) => `"${k}"`).join(',')}]}"#`), 'the watch does not say what it knows in its hello, so the phone never offers its pages')

    /* Drawn: the shown pages only, in the order sent, each by name; the first shown until there has been a swipe. */
    const view = root.replace(/\s+/g, ' ')
    assert.match(view, /TabView\(selection: onShow\(state\.shown\)\) \{ ForEach\(state\.shown, id: \\\.self\) \{ which in drawn\(which, state\)\.tag\(which\) \} \}/, 'a hidden page is drawn, so it can be swiped to')
    assert.match(view, /Binding\(get: \{ watchPageOnShow\(page, shown\) \}, set: \{ page = \$0 \}\)/)
    assert.match(flat, /func watchPageOnShow\(_ swiped: WatchPage\?, _ shown: \[WatchPage\]\) -> WatchPage \{ if let swiped, shown\.contains\(swiped\) \{ return swiped \} return shown\.first \?\? \.scenes \}/)
    assert.match(view, /case \.scenes: ScenesPage\(state: state\) case \.pedals: PedalsPage\(state: state\) case \.presets: PresetsPage\(state: state\) case \.tempo: TempoPage\(state: state\) case \.tuner: TunerPage\(state: state\)/)
    assert.doesNotMatch(view, /\.tag\(\d\)/, 'a page is still drawn at a fixed place')
    /* A page hidden under the watch: a tuner whose page has just gone is turned off, whatever the switch says, and the watch is back on the first shown page. */
    assert.match(
      view,
      /\.onChange\(of: link\.state\?\.shown\) \{ was, now in guard let now else \{ return \} if watchTunerStopsOnHiding\(was: was \?\? WatchPage\.usual, now: now, tunerOn: link\.state\?\.tuner\.on == true\) \{ link\.send\(\.tuner\(on: false\)\) \} if let swiped = page, !now\.contains\(swiped\) \{ page = nil \} \}/
    )
    assert.match(flat, /func watchTunerStopsOnHiding\(was: \[WatchPage\], now: \[WatchPage\], tunerOn: Bool\) -> Bool \{ tunerOn && was\.contains\(\.tuner\) && !now\.contains\(\.tuner\) \}/)
    assert.match(flat, /func watchTunerStopsOnLeaving\(tunerOn: Bool, stays: Bool\?\) -> Bool \{ tunerOn && stays != true \}/)
    assert.match(model, /var tunerStays: Bool\? = nil/)
    /* CI's -page N is the page it has always been, by name: 3 is the tuner wherever it is drawn, and Tempo, which came later, is 4. */
    assert.match(view, /@State private var page: WatchPage\? = Launch\.value\("page"\) == nil \? nil : WatchPage\.numbered\(Launch\.number\("page"\)\)/)
    assert.match(model, /static let numbers: \[WatchPage\] = \[\.scenes, \.pedals, \.presets, \.tuner, \.tempo\]/)
    assert.match(flat, /static func numbered\(_ n: Int\) -> WatchPage\? \{ numbers\.indices\.contains\(n\) \? numbers\[n\] : nil \}/)
    const shots = read('mobile/watch-ci/screens.sh')
    assert.match(shots, /for page in 0 1 2 3; do\n  shoot -page "\$page"/)
    assert.match(shots, /-page 3 -tunerDemo YES/, 'CI’s tuner picture is no longer asked for as page 3')
    assert.match(shots, /shoot -page 4\nxcrun simctl io "\$UDID" screenshot "screens\/tempo\.png"/, 'CI takes no picture of the Tempo page')
    /* The tuner's own rules go with its page wherever it sits: nothing until tapped, and off when the page is left. */
    const pages = read('mobile/targets/watch/Pages.swift')
    const drawnPages = pages.replace(/\s+/g, ' ')
    assert.match(drawnPages, /\.onDisappear \{ if watchTunerStopsOnLeaving\(tunerOn: state\.tuner\.on, stays: state\.tunerStays\) \{ link\.send\(\.tuner\(on: false\)\) \} \}/, 'leaving the tuner’s page does not ask whether the iPhone says it stays')
    assert.equal((drawnPages.match(/link\.send\(\.tuner\(on: false\)\)/g) || []).length, 2, 'the tuner is turned off from the watch’s pages somewhere besides Stop tuning and leaving its page')
    assert.match(drawnPages, /link\.send\(\.tuner\(on: true\)\) \} label:/)

    /*
     * THE TUNER PAGE'S WORDS: option B, the mockup Justin picked (docs/watch).
     * "Where it says tuner on I feel like that means it on": the screen says
     * what the tuner IS, the buttons say what a tap will DO.
     */
    assert.match(flat, /enum TunerWords \{ static let off = "Off" static let offSpoken = "Tuner is off" static let start = "Start tuning" static let stop = "Stop tuning" \}/)
    const tunerPage = drawnPages.slice(drawnPages.indexOf('struct TunerPage: View {'), drawnPages.indexOf('private struct Needle: View {'))
    assert.ok(tunerPage.length > 200)
    /* Off: TUNER (not read twice), "Off" read as "Tuner is off", and Start tuning on the app's green with the tuning fork. */
    assert.match(tunerPage, /Text\("TUNER"\)\.font\(\.caption2\)\.foregroundStyle\(\.secondary\)\.accessibilityHidden\(true\) Text\(TunerWords\.off\) \.font\(\.system\(size: 26, weight: \.heavy\)\) \.foregroundStyle\(\.secondary\) \.accessibilityLabel\(TunerWords\.offSpoken\)/)
    assert.match(tunerPage, /link\.send\(\.tuner\(on: true\)\) \} label: \{ Label\(TunerWords\.start, systemImage: "tuningfork"\) \.font\(\.body\.weight\(\.bold\)\) \.foregroundStyle\(startInk\) \.frame\(maxWidth: \.infinity, minHeight: 52\) \.background\(signal, in: Capsule\(\)\) \}/)
    /* On: the note, the needle and the cents as they were, then Stop tuning, red. */
    assert.match(tunerPage, /Needle\(cents: tuner\.cents, live: !tuner\.note\.isEmpty, inTune: tuner\.inTune\)/)
    assert.match(tunerPage, /link\.send\(\.tuner\(on: false\)\) \} label: \{ Text\(TunerWords\.stop\) \.font\(\.body\.weight\(\.bold\)\) \.foregroundStyle\(stopInk\) \.frame\(maxWidth: \.infinity, minHeight: 40\) \.background\(stopFill, in: Capsule\(\)\) \}/)
    /* The mockup's colours. */
    assert.match(pages, /private let startInk = Color\(red: 0\.024, green: 0\.129, blue: 0\.055\)/)
    assert.match(pages, /private let stopInk = Color\(red: 1, green: 0\.412, blue: 0\.38\)/)
    assert.match(pages, /private let stopFill = Color\(red: 1, green: 0\.271, blue: 0\.227\)\.opacity\(0\.28\)/)
    assert.match(pages, /private let signal = Color\(red: 0\.36, green: 0\.85, blue: 0\.47\)/)
    /* Never a button that reads as the state, and no "Tap to tune." */
    assert.doesNotMatch(code(pages), /"Tuner on"|"Tuner off"|Tap to tune/, 'the tuner page has a button that reads as what the tuner is')

    /* THE TEMPO PAGE. The picture's fields by the phone's names, and the two requests in the phone's words. */
    for (const field of ['bpm: Double? = nil', 'tap: Bool', 'why: String? = nil', 'wrist: Bool? = nil', 'running: Bool? = nil']) {
      assert.ok(new RegExp(`struct WatchTempo: Codable, Equatable \\{[^}]*\\bvar ${field.replace(/[?.]/g, '\\$&')}\\b`).test(model), `the watch does not read the tempo’s ${field}`)
    }
    assert.match(model, /var tempo: WatchTempo\? = nil/)
    assert.ok(model.includes('case .tap: return #"{"do":"tap"}"#'), 'the watch cannot ask for a tap')
    assert.ok(model.includes('case .wrist(let on): return #"{"do":"wrist","on":\\#(on)}"#'), 'the watch cannot ask for the wrist’s switch')
    /* A tap is sent once or not at all. */
    assert.match(read('mobile/targets/watch/PhoneLink.swift').replace(/\s+/g, ' '), /let once = command\.once session\.sendMessage\(body, replyHandler: \{ _ in \}, errorHandler: \{ _ in guard !once else \{ return \} DispatchQueue\.main\.asyncAfter/, 'a tap that did not go is tried again a second later: a second, late beat')
    /* The page: the number, Tap, the phone's sentence where Tap is not offered, and the wrist's switch. Nothing decided on the watch. */
    const tempoPage = drawnPages.slice(drawnPages.indexOf('struct TempoPage: View {'), drawnPages.indexOf('// MARK: - Tuner'))
    assert.ok(tempoPage.length > 200, 'the watch has no Tempo page')
    assert.match(tempoPage, /let canTap = tempo\?\.tap == true/)
    assert.match(tempoPage, /let number = tempoNumber\(tempo\?\.bpm\)/)
    assert.match(tempoPage, /Text\(number\) \.font\(\.system\(size: 44, weight: \.bold, design: \.rounded\)\)/)
    assert.match(tempoPage, /let spoken: String = number == "—" \? "No tempo yet" : "\\\(number\) beats per minute"/)
    assert.match(tempoPage, /Text\("BPM"\)/)
    assert.match(tempoPage, /Button \{ tap\(\) link\.send\(\.tap\) \} label: \{ Label\("Tap", systemImage: "metronome"\)\.frame\(maxWidth: \.infinity, minHeight: 56\) \} \.disabled\(!canTap\)/)
    assert.match(tempoPage, /if !canTap, !why\.isEmpty \{ Text\(why\)/, 'where Tap is not offered the watch does not say the phone’s sentence')
    assert.match(tempoPage, /Toggle\("Wrist metronome", isOn: Binding\(get: \{ tempo\?\.wrist == true \}, set: \{ link\.send\(\.wrist\(on: \$0\)\) \}\)\)/)
    assert.match(tempoPage, /if tempo\?\.wrist == true, tempo\?\.running != true \{ Text\("The metronome is off on your iPhone\."\)/)
    assert.equal((tempoPage.match(/link\.send\(/g) || []).length, 2, 'the Tempo page asks the phone for something besides a tap and the wrist’s switch')
    assert.match(flat, /func tempoNumber\(_ bpm: Double\?\) -> String \{ guard let bpm, bpm\.isFinite, bpm > 0 else \{ return "—" \} return String\(Int\(bpm\.rounded\(\)\)\) \}/)

    /* THE CHECK-IN. The rule in the phone's steps, the word, and a timer that exists only while the app is on screen. */
    assert.match(flat, /let watchHereSeconds: Double = 20\b/)
    assert.match(flat, /let watchHereTick: Double = 2\b/)
    assert.match(flat, /func watchHereDue\(onScreen: Bool, pagesUp: Bool, demo: Bool, lastSent: Date\?, now: Date\) -> Bool \{ guard onScreen, pagesUp, !demo else \{ return false \} guard let lastSent else \{ return true \} return now\.timeIntervalSince\(lastSent\) >= watchHereSeconds \}/)
    assert.ok(model.includes('case .here: return #"{"do":"here"}"#'), 'the watch cannot check in')
    assert.match(flat, /var once: Bool \{ switch self \{ case \.tap, \.here: return true default: return false \} \}/)
    const phoneLink = read('mobile/targets/watch/PhoneLink.swift').replace(/\s+/g, ' ')
    assert.match(
      phoneLink,
      /func onScreen\(_ on: Bool\) \{ screenOn = on hereTimer\?\.invalidate\(\) hereTimer = nil guard on, !demo else \{ return \} checkIn\(\) hereTimer = Timer\.scheduledTimer\(withTimeInterval: watchHereTick, repeats: true\) \{ \[weak self\] _ in Task \{ @MainActor \[weak self\] in self\?\.checkIn\(\) \} \} \}/,
      'the check-in’s timer is not ended the moment the watch app leaves the screen'
    )
    assert.match(phoneLink, /private func checkIn\(\) \{ guard watchHereDue\(onScreen: screenOn, pagesUp: pagesUp, demo: demo, lastSent: lastSent, now: Date\(\)\) else \{ return \} send\(\.here\) \}/)
    assert.match(phoneLink, /private var pagesUp: Bool \{ guard let state else \{ return false \} return state\.linked && !state\.tooNew && !away \}/, 'the check-in runs on the waiting page')
    assert.match(phoneLink, /session\.isReachable else \{ return \} \/\*[^*]*\*\/ lastSent = Date\(\)/, 'a check-in is not counted from the last thing really sent')
    assert.equal((phoneLink.match(/send\(\.here\)/g) || []).length, 1)
    /* Started by the wrist coming up and ended by its going down, and nothing else keeps the watch app running. */
    assert.match(view, /\.onChange\(of: phase\) \{ _, now in if now == \.active \{ link\.woke\(\) \} \/\*[^*]*\*\/ link\.onScreen\(now == \.active\)/)
    assert.match(view, /\.onAppear \{ link\.onScreen\(phase == \.active\) \}/)
    for (const f of ['Model.swift', 'PhoneLink.swift', 'FractalWatchApp.swift', 'Pages.swift', 'Metronome.swift']) {
      assert.doesNotMatch(code(read(`mobile/targets/watch/${f}`)), /WKExtendedRuntimeSession|HKWorkoutSession|WKApplicationRefreshBackgroundTask|scheduleBackgroundRefresh/, `${f} keeps the watch app running with the wrist down`)
    }
    /* The waiting page's line for an app that was swiped closed, under "Open Fractal Remote on your iPhone". */
    assert.match(flat, /enum WaitingWords \{ static let closed = "If it was swiped closed, open it again\." \}/)
    assert.match(drawnPages, /if !tooNew, !phoneOnly \{ Text\(WaitingWords\.closed\)/)

    /* And the Swift tests ask the fixture's own questions. */
    const tests = read('mobile/watch-ci/Tests/WatchModelTests/WatchModelTests.swift')
    for (const name of [
      'testThePagesAreDrawnInTheOrderThePhoneSends',
      'testAListThatIsNotQuiteRightIsStillPagesToDraw',
      'testAPageHiddenUnderTheWatchGoesToTheFirstShown',
      'testHidingTheTunersPageTurnsTheTunerOffWhateverTheSwitchSays',
      'testLeavingTheTunersPageTurnsItOffUnlessTheIPhoneSaysItStays',
      'testTheWatchSaysWhatItKnows',
      'testTheTempoPageSaysWhatThePhoneSays',
      'testATapIsSentOnceAndTheSwitchIsOnlyTheWrists',
      'testTheTunerPagesWordsSayWhatATapDoes',
      'testACheckInIsDueOnlyOnScreenWithThePagesUp'
    ]) {
      assert.ok(tests.includes(`func ${name}(`), `the watch’s own tests have no ${name}`)
    }
  })
}
