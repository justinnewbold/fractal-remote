/**
 * The Apple Watch's pages: which are shown, and in what order, chosen on the
 * iPhone.
 *
 * Justin, 11 November 2026: "On the watch, can we add a way for a user to
 * select which order their pages show up in on the Watch app?" And, asked
 * whether a page could be hidden too: "Yes, add hiding pages."
 *
 * TWO HALVES, AND ONLY ONE OF THEM TRAVELS IN AN UPDATE. The phone's half is
 * in the tree: the rules (shared/watch-link.mjs watchPageOrder,
 * watchPagesHidden, watchPagesShown), the pages as chosen kept on the device
 * (mobile/src/lib/watchPages.js), the Settings rows
 * (components/WatchPageOrder) and the `pages` and `hidden` fields in the
 * picture. The watch's half is Swift, which reaches a wrist only inside an
 * iPhone build, so it waits in docs/pending/watch-page-order.patch.
 *
 * So the phone's half is INERT until a watch says it does this (its hello's
 * `knows`): no rows in Settings, and neither field in the picture. The first
 * tests hold that, whatever the tree. The last one reads the watch's Swift
 * and asks which tree this is: without the patch the watch is exactly what
 * it was and the patch is listed; with it (web.yml's second run, and the
 * build pull request) the Swift half is held to the phone's, word for word
 * and answer for answer, through one fixture both sides read
 * (mobile/watch-ci/Tests/WatchModelTests/pages.json, written by
 * `pagesFixture` below).
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const at = (p) => new URL(`../${p}`, import.meta.url)
const read = (p) => readFileSync(at(p), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

const link = () => import('../shared/watch-link.mjs')

/** The fixture's picture: every page out of its usual place, and one hidden. */
const CHOSEN = ['tuner', 'scenes', 'presets', 'pedals']
const CHOSEN_HIDDEN = ['presets']
const ALL = ['scenes', 'pedals', 'presets', 'tuner']

/**
 * What both sides are held to: a picture with pages in it, and lists that
 * are not quite right with what each has to come to. Only lists of names,
 * or none: that is all a picture can carry and still be read (anything else
 * the phone repairs before it sends, which the tests below hold).
 *
 * To write the file again after a rule changes on purpose:
 *   node -e "import('./test/watch-pages.mjs').then(async (m) => console.log(JSON.stringify(await m.pagesFixture(), null, 2)))" > mobile/watch-ci/Tests/WatchModelTests/pages.json
 */
export async function pagesFixture() {
  const { watchState, watchPageOrder, watchPagesHidden, watchPagesShown } = await link()
  const given = [
    [null, null],
    [[], []],
    [ALL, []],
    [CHOSEN, CHOSEN_HIDDEN],
    [CHOSEN, null],
    [['tuner'], null],
    [['presets', 'presets', 'scenes'], ['pedals']],
    [['tuner', 'looper', 'pedals'], ['looper']],
    [['Tuner', 'TUNER', ' tuner', ''], ['Tuner', ' tuner', '']],
    [['pedals', 'scenes', 'presets', 'tuner', 'scenes', 'setlists'], ['tuner', 'scenes']],
    [['setlists', 'looper'], ['setlists']],
    [null, ['tuner']],
    [null, ['tuner', 'tuner', 'tuner']],
    [null, ['presets', 'scenes', 'pedals']],
    [CHOSEN, ['scenes', 'pedals', 'tuner']],
    [null, ALL],
    [CHOSEN, ['tuner', 'presets', 'pedals', 'scenes']],
    [['scenes'], ['scenes', 'pedals', 'presets', 'tuner', 'looper']]
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
      pages: CHOSEN,
      hidden: CHOSEN_HIDDEN
    }),
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
  test('watch pages: any list comes to the four pages in an order, the known ones first as given, the rest in the usual order', async () => {
    const { WATCH_PAGES, WATCH_PAGE_NAMES, watchPageOrder } = await link()
    assert.deepEqual(WATCH_PAGES, ALL, 'the usual order moved: it is what the watch draws with none said, and what CI’s -page N counts by')
    assert.deepEqual(WATCH_PAGE_NAMES, { scenes: 'Scenes', pedals: 'Pedals', presets: 'Presets', tuner: 'Tuner' })

    /* Nothing, or nothing usable: the usual order. */
    for (const none of [undefined, null, [], 'tuner', 7, {}, { 0: 'tuner', length: 1 }, [null, 3, {}, ['tuner']]]) {
      assert.deepEqual(watchPageOrder(none), WATCH_PAGES, JSON.stringify(none))
    }
    /* A full order is kept as it is. */
    assert.deepEqual(watchPageOrder(CHOSEN), CHOSEN)
    /* Short: what is missing follows, in the usual order. */
    assert.deepEqual(watchPageOrder(['tuner']), ['tuner', 'scenes', 'pedals', 'presets'])
    assert.deepEqual(watchPageOrder(['presets', 'scenes']), ['presets', 'scenes', 'pedals', 'tuner'])
    /* Twice: the first one counts. Unknown, or not quite the name: dropped. */
    assert.deepEqual(watchPageOrder(['presets', 'presets', 'scenes']), ['presets', 'scenes', 'pedals', 'tuner'])
    assert.deepEqual(watchPageOrder(['tuner', 'looper', 'pedals']), ['tuner', 'pedals', 'scenes', 'presets'])
    assert.deepEqual(watchPageOrder(['Tuner', 'TUNER', ' tuner', '']), WATCH_PAGES, 'a name that is not exactly a page’s was taken for one')
    /* Always all four, each once, and never the list handed in. */
    for (const list of [CHOSEN, ['tuner'], [], null, ['x', 'pedals', 'pedals']]) {
      const order = watchPageOrder(list)
      assert.deepEqual([...order].sort(), [...WATCH_PAGES].sort(), `${JSON.stringify(list)} lost a page from the order, or drew one twice`)
      assert.notEqual(order, list)
      assert.notEqual(order, WATCH_PAGES, 'the usual order itself was handed out, to be changed by whoever has it')
    }
  })

  test('watch pages: a page can be hidden, never the last one, and a list that hides all four hides none', async () => {
    const { WATCH_PAGES, watchPagesHidden, watchPagesShown, watchPagesKept, watchPagesUsual, watchPageMoved, watchPageHid } = await link()

    /* Hidden: the names known, each once, told in the usual order. */
    for (const none of [undefined, null, [], 'tuner', 7, {}, ['looper'], ['Tuner', ' tuner', ''], [null, 3, ['tuner']]]) {
      assert.deepEqual(watchPagesHidden(none), [], JSON.stringify(none))
    }
    assert.deepEqual(watchPagesHidden(['tuner']), ['tuner'])
    assert.deepEqual(watchPagesHidden(['tuner', 'scenes', 'tuner', 'nope']), ['scenes', 'tuner'])
    assert.deepEqual(watchPagesHidden(['presets', 'pedals', 'scenes']), ['scenes', 'pedals', 'presets'], 'three of the four can be hidden')
    /* ALL FOUR IS NONE: a watch always has a page. */
    assert.deepEqual(watchPagesHidden(ALL), [], 'a list that hides every page left the watch with none')
    assert.deepEqual(watchPagesHidden(['tuner', 'presets', 'pedals', 'scenes', 'looper']), [])

    /* Shown: the order with the hidden ones left out, and never empty, whatever the two lists. */
    assert.deepEqual(watchPagesShown(null, null), WATCH_PAGES)
    assert.deepEqual(watchPagesShown(CHOSEN, CHOSEN_HIDDEN), ['tuner', 'scenes', 'pedals'])
    assert.deepEqual(watchPagesShown(CHOSEN, ['tuner']), ['scenes', 'presets', 'pedals'], 'the watch does not open on the first SHOWN page')
    assert.deepEqual(watchPagesShown(CHOSEN, ALL), CHOSEN)
    assert.deepEqual(watchPagesShown(['tuner'], ['scenes', 'pedals', 'presets']), ['tuner'])
    const lists = [null, [], ['tuner'], CHOSEN, ALL, ['x'], ['scenes', 'pedals', 'presets'], ['tuner', 'tuner'], 'tuner', 9]
    for (const order of lists) {
      for (const hidden of lists) {
        const shown = watchPagesShown(order, hidden)
        assert.ok(shown.length >= 1, `${JSON.stringify(order)} with ${JSON.stringify(hidden)} hidden left the watch no page to open on`)
        assert.equal(new Set(shown).size, shown.length)
        assert.ok(shown.every((p) => WATCH_PAGES.includes(p)))
        /* And the iPhone's own list is the shown ones, then the hidden ones: the four, each once. */
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
    assert.deepEqual(watchPageHid(null, null, 'pedals', true), { order: ['scenes', 'presets', 'tuner', 'pedals'], hidden: ['pedals'] })
    assert.deepEqual(watchPageHid(['scenes', 'presets', 'tuner', 'pedals'], ['pedals'], 'scenes', true), { order: ['presets', 'tuner', 'pedals', 'scenes'], hidden: ['scenes', 'pedals'] })
    /* Show: back as the last of the shown ones, before what is still hidden. */
    assert.deepEqual(watchPageHid(['presets', 'tuner', 'pedals', 'scenes'], ['scenes', 'pedals'], 'scenes', false), { order: ['presets', 'tuner', 'scenes', 'pedals'], hidden: ['pedals'] })
    assert.deepEqual(watchPageHid(['scenes', 'presets', 'tuner', 'pedals'], ['pedals'], 'pedals', false), { order: ['scenes', 'presets', 'tuner', 'pedals'], hidden: [] })
    /* THE LAST SHOWN PAGE STAYS: hiding it changes nothing, whichever page it is. */
    for (const last of WATCH_PAGES) {
      const others = WATCH_PAGES.filter((p) => p !== last)
      const was = watchPagesKept(null, others)
      assert.deepEqual(watchPagesShown(was.order, was.hidden), [last])
      assert.deepEqual(watchPageHid(was.order, was.hidden, last, true), was, `the last shown page, ${last}, was hidden`)
    }
    /* Hidden one after another, the fourth is refused: never none. */
    let kept = watchPagesKept(null, null)
    for (const page of WATCH_PAGES) kept = watchPageHid(kept.order, kept.hidden, page, true)
    assert.deepEqual(kept, { order: ['tuner', 'scenes', 'pedals', 'presets'], hidden: ['scenes', 'pedals', 'presets'] })
    /* Nothing to do: the same lists. */
    assert.deepEqual(watchPageHid(null, ['tuner'], 'tuner', true), watchPagesKept(null, ['tuner']))
    assert.deepEqual(watchPageHid(null, null, 'tuner', false), watchPagesKept(null, null))
    assert.deepEqual(watchPageHid(null, null, 'looper', true), watchPagesKept(null, null))

    /* Move up and Move down: one place among the SHOWN pages, and the same lists back where it cannot go. */
    const usual = { order: WATCH_PAGES, hidden: [] }
    assert.deepEqual(watchPageMoved(null, null, 'tuner', -1), { order: ['scenes', 'pedals', 'tuner', 'presets'], hidden: [] })
    assert.deepEqual(watchPageMoved(null, null, 'scenes', 1), { order: ['pedals', 'scenes', 'presets', 'tuner'], hidden: [] })
    assert.deepEqual(watchPageMoved(null, null, 'scenes', -1), usual, 'the first page moved up')
    assert.deepEqual(watchPageMoved(null, null, 'tuner', 1), usual, 'the last page moved down')
    assert.deepEqual(watchPageMoved(null, null, 'looper', 1), usual)
    assert.deepEqual(watchPageMoved(null, null, 'pedals', 0), usual)
    /* A hidden page is not stepped over or into, and does not move. */
    assert.deepEqual(watchPageMoved(CHOSEN, ['pedals'], 'presets', 1), { order: CHOSEN, hidden: ['pedals'] }, 'the last shown page moved down into the hidden ones')
    assert.deepEqual(watchPageMoved(CHOSEN, ['pedals'], 'pedals', -1), { order: CHOSEN, hidden: ['pedals'] }, 'a hidden page was moved')
    assert.deepEqual(watchPageMoved(ALL, ['pedals'], 'presets', -1), { order: ['presets', 'scenes', 'tuner', 'pedals'], hidden: ['pedals'] })
    /* Three Move ups take the tuner from last to first: the page the watch opens on. */
    kept = usual
    for (let i = 0; i < 3; i++) kept = watchPageMoved(kept.order, kept.hidden, 'tuner', -1)
    assert.deepEqual(kept.order, ['tuner', 'scenes', 'pedals', 'presets'])
    assert.deepEqual(WATCH_PAGES, ALL, 'moving or hiding a page changed the usual order itself')
  })

  test('watch pages: the picture carries pages only when it is given an order, and to every other watch it is what it was', async () => {
    const { watchState, sameWatchState, WATCH_LINK_VERSION } = await link()
    const input = { at: 5, linked: true, preset: { number: 1, name: 'A' }, label: '001', sceneCount: 4 }
    const plain = watchState(input)
    assert.equal('pages' in plain, false, 'a watch that has not said it knows is sent an order')
    assert.equal('hidden' in plain, false, 'a watch that has not said it knows is sent hidden pages')
    for (const none of [{ pages: null }, { pages: undefined }, { pages: null, hidden: ['tuner'] }, { hidden: ['tuner'] }]) {
      assert.deepEqual(watchState({ ...input, ...none }), plain, `${JSON.stringify(none)} changed the picture`)
    }
    /* Given an order: both fields, repaired, last in the picture, and nothing else moved. */
    const ordered = watchState({ ...input, pages: ['tuner', 'tuner', 'nope'], hidden: ['pedals', 'nope', 'pedals'] })
    assert.deepEqual(ordered.pages, ['tuner', 'scenes', 'pedals', 'presets'])
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
    assert.deepEqual(WATCH_KNOWS, ['pages'])
    /* A watch from before: the one word it always was. */
    assert.deepEqual(watchCommand({ do: 'hello' }, null), { do: 'hello' })
    assert.deepEqual(watchCommand({ do: 'hello', knows: 'pages' }, null), { do: 'hello' }, 'a hello whose knows is not a list was taken for one')
    /* One that says so, and only what this phone knows of: never passed on as it came. */
    assert.deepEqual(watchCommand({ do: 'hello', knows: ['pages'] }, null), { do: 'hello', knows: ['pages'] })
    assert.deepEqual(watchCommand({ do: 'hello', knows: ['pages', 'looper', 7, 'pages'] }, null), { do: 'hello', knows: ['pages'] })
    assert.deepEqual(watchCommand({ do: 'hello', knows: [] }, null), { do: 'hello', knows: [] })
    assert.deepEqual(watchCommand({ do: 'hello', knows: ['looper'] }, null), { do: 'hello', knows: [] })
    for (const none of [undefined, null, 'pages', 3, {}]) assert.deepEqual(watchKnows(none), [])
    assert.deepEqual(watchKnows(['x', 'pages']), ['pages'])
    /* No other request grows a `knows`. */
    assert.deepEqual(watchCommand({ do: 'tuner', on: true, knows: ['pages'] }, null), { do: 'tuner', on: true })
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
    assert.match(bridge, /import \{ noteWatchKnows, pagesToSend, useWatchPages \} from '\.\/watchPages'/)
    /* The hello: what it knows is kept first, and the picture it is answered with is made with it. */
    assert.match(
      bridge.replace(/\s+/g, ' '),
      /if \(cmd\.do === 'hello'\) \{ noteWatchKnows\(cmd\.knows\) if \(lastFrom\.current\) last\.current = watchState\(\{ \.\.\.lastFrom\.current, \.\.\.pagesToSend\(\) \}\) sender\.current\?\.flush\(last\.current\)/,
      'a watch that takes its pages is answered with the usual four first'
    )
    /* Every picture: the pages from the one place that knows whether to send them, and from nowhere else. */
    assert.match(bridge, /const state = watchState\(\{ \.\.\.lastFrom\.current, \.\.\.pagesToSend\(\) \}\)/)
    assert.equal((bridge.match(/watchState\(/g) || []).length, 2, 'a picture is made somewhere that does not ask pagesToSend')
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
      WATCH_ORDER_USUAL: 'Show all four in the usual order',
      WATCH_ORDER_WHEN: 'Your watch takes a change the next time the Play screen is open on your iPhone.'
    })
    for (const line of Object.values(said)) {
      assert.ok(!/this (phone|iPhone|device)/i.test(line), `“${line}” says this phone`)
      assert.ok(!/\b(beta|tried|tested|official|default|array|index|reorder|toggle|disabled?)\b/i.test(line), `“${line}” is not a guitarist’s word`)
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

  test('watch pages: the watch’s half waits as a patch, and with it in the watch draws the shown pages in the order sent and still opens CI’s pages by name', async () => {
    const { WATCH_PAGES, WATCH_KNOWS } = await link()
    const model = read('mobile/targets/watch/Model.swift')
    const root = read('mobile/targets/watch/FractalWatchApp.swift')
    const fixtureAt = 'mobile/watch-ci/Tests/WatchModelTests/pages.json'
    const patched = /\bvar pages: \[String\]\? = nil/.test(model)

    if (!patched) {
      /* THE TREE AS MAIN HAS IT: the watch untouched, so its line of the fingerprint is where it was, and the Swift half listed as waiting. */
      assert.doesNotMatch(model, /WatchPage\b|watchPageOrder|watchPagesHidden|"knows"/, 'part of the watch’s half is in the tree, which moves the watch’s fingerprint, and part is not')
      assert.match(root, /@State private var page = Launch\.number\("page"\)/)
      assert.match(root.replace(/\s+/g, ' '), /ScenesPage\(state: state\)\.tag\(0\) PedalsPage\(state: state\)\.tag\(1\) PresetsPage\(state: state\)\.tag\(2\) TunerPage\(state: state\)\.tag\(3\)/)
      assert.equal(existsSync(at(fixtureAt)), false, 'the watch’s pages fixture is in the tree without the Swift that reads it')
      assert.match(read('docs/pending/README.md'), /^\| `watch-page-order\.patch` \|/m, 'the watch’s half of its pages is neither in the tree nor waiting in docs/pending')
      const patch = read('docs/pending/watch-page-order.patch')
      for (const f of ['mobile/targets/watch/Model.swift', 'mobile/targets/watch/FractalWatchApp.swift', 'mobile/watch-ci/Package.swift', 'mobile/watch-ci/Tests/WatchModelTests/WatchModelTests.swift', fixtureAt]) {
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

    /* The same four names, in the same usual order, and the same rules in the same steps. */
    const flat = model.replace(/\s+/g, ' ')
    assert.match(model, /enum WatchPage: String, CaseIterable, Equatable \{\s+case scenes, pedals, presets, tuner\b/)
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
    assert.match(view, /case \.scenes: ScenesPage\(state: state\) case \.pedals: PedalsPage\(state: state\) case \.presets: PresetsPage\(state: state\) case \.tuner: TunerPage\(state: state\)/)
    assert.doesNotMatch(view, /\.tag\(\d\)/, 'a page is still drawn at a fixed place')
    /* A page hidden under the watch: back to the first shown page, and a tuner left that way is turned off, as leaving its page does. */
    assert.match(
      view,
      /\.onChange\(of: link\.state\?\.shown\) \{ was, now in guard let now else \{ return \} let wasOn = watchPageOnShow\(page, was \?\? WatchPage\.usual\) if watchTunerLeftByHiding\(wasOn: wasOn, shown: now, tunerOn: link\.state\?\.tuner\.on == true\) \{ link\.send\(\.tuner\(on: false\)\) \} if let swiped = page, !now\.contains\(swiped\) \{ page = nil \} \}/
    )
    assert.match(flat, /func watchTunerLeftByHiding\(wasOn: WatchPage, shown: \[WatchPage\], tunerOn: Bool\) -> Bool \{ wasOn == \.tuner && tunerOn && !shown\.contains\(\.tuner\) \}/)
    /* CI's -page N is the Nth of the USUAL order, so its pictures are of the pages they always were. */
    assert.match(view, /@State private var page: WatchPage\? = Launch\.value\("page"\) == nil \? nil : WatchPage\.numbered\(Launch\.number\("page"\)\)/)
    assert.match(flat, /static func numbered\(_ n: Int\) -> WatchPage\? \{ usual\.indices\.contains\(n\) \? usual\[n\] : nil \}/)
    const shots = read('mobile/watch-ci/screens.sh')
    assert.match(shots, /-page 3 -tunerDemo YES/, 'CI’s tuner picture is no longer asked for as page 3')
    /* The tuner's own rules go with its page wherever it sits: nothing until tapped, and off when the page is left. */
    const pages = read('mobile/targets/watch/Pages.swift').replace(/\s+/g, ' ')
    assert.match(pages, /\.onDisappear \{ if state\.tuner\.on \{ link\.send\(\.tuner\(on: false\)\) \} \}/)
    assert.match(pages, /link\.send\(\.tuner\(on: true\)\) \} label:/)
    /* And the Swift tests ask the fixture's own questions. */
    const tests = read('mobile/watch-ci/Tests/WatchModelTests/WatchModelTests.swift')
    for (const name of [
      'testThePagesAreDrawnInTheOrderThePhoneSends',
      'testAListThatIsNotQuiteRightIsStillPagesToDraw',
      'testAPageHiddenUnderTheWatchGoesToTheFirstShown',
      'testHidingTheTunersPageWhileOnItTurnsTheTunerOff',
      'testTheWatchSaysWhatItKnows'
    ]) {
      assert.ok(tests.includes(`func ${name}(`), `the watch’s own tests have no ${name}`)
    }
  })
}
