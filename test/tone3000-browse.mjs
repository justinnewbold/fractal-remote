/**
 * TONE3000'S LIST, DRAWN IN THE APP (mobile/src/lib/tone3000Browse.js,
 * components/Tone3000Browser.js, the search half of lib/tone3000.js, and
 * the card that draws them, components/Tone3000Test.js).
 *
 * "It to look like that and function like that. Not just going off a
 * built-in web browser in our app but actually native in our app using the
 * API." (Justin, 14 November 2026, with a picture of the Tones tab of his
 * HeadRush app.) What is held here: what TONE3000 is asked and when (its
 * search is the most heavily limited thing it answers, so never on a
 * keystroke), that a late answer never lands under a newer question, that a
 * key search is not open to still shows something, and that the screen
 * keeps what TONE3000 asks of a list of its tones in somebody else's app.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

const lib = () => import('../mobile/src/lib/tone3000.js')
const browse = () => import('../mobile/src/lib/tone3000Browse.js')

const queryOfUrl = (u) => Object.fromEntries(u.slice(u.indexOf('?') + 1).split('&').map((p) => p.split('=').map(decodeURIComponent)))

const tone = (id, more = {}) => ({ id, title: `Tone ${id}`, gear: 'amp', format: 'nam', a2_models_count: 2, downloads_count: 10 * id, user: { username: `maker${id}` }, ...more })

/** A pretend TONE3000, signed in already: every request made of it, and answers a test can change. */
function site() {
  const kept = new Map()
  const asked = []
  const state = { search: null, status: null, user: { username: 'justin', avatar_url: 'https://www.tone3000.com/a.png' } }
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) })
  const fetch = async (url, init = {}) => {
    asked.push({ url, auth: init.headers?.Authorization || null })
    if (url === 'https://www.tone3000.com/api/v1/oauth/token') return json(200, { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 })
    if (state.status) return json(state.status, {})
    if (url.startsWith('https://www.tone3000.com/api/v1/tones/search?')) return json(200, state.search || { data: [], page: 1, page_size: 25, total: 0, total_pages: 1 })
    if (url.startsWith('https://www.tone3000.com/api/v1/tones/trending')) return json(200, { data: [tone(1), tone(2, { format: 'ir' })] })
    if (url === 'https://www.tone3000.com/api/v1/tones/latest') return json(200, { data: [tone(3), tone(4, { gear: 'pedal' }), tone(5, { a2_models_count: 0 })] })
    if (url === 'https://www.tone3000.com/api/v1/user') return json(200, state.user)
    return json(404, {})
  }
  const store = { get: async (k) => kept.get(k) ?? null, set: async (k, v) => void kept.set(k, v), remove: async (k) => void kept.delete(k) }
  let n = 0
  const opened = []
  return { kept, asked, opened, state, fetch, store, random: (count) => Array.from({ length: count }, () => (n++ * 37 + 11) & 0xff), open: async (u) => void opened.push(u), now: () => 1_000_000 }
}

/** A client of that site, signed in by a sign-in with no tone picked. */
async function signedIn() {
  const t = await lib()
  const w = site()
  const c = t.tone3000(w)
  const url = await c.start({ pick: false })
  const done = await c.finish(`fractalremote://tone3000?code=CODE&state=${encodeURIComponent(queryOfUrl(url).state)}`)
  return { t, w, c, url, done }
}

/** A search and a feed a test answers by hand, one question at a time: `asks` is every question, each with `answer` and `refuse`. */
function byHand() {
  const asks = []
  const ask = (kind) => (...args) =>
    new Promise((answer, refuse) => {
      asks.push({ kind, args, answer, refuse })
    })
  return { asks, search: ask('search'), feed: ask('feed') }
}
const page = (ids, at = 1, of = 1) => ({ tones: ids.map((id) => tone(id)), page: at, pages: of, total: ids.length })
const settle = () => new Promise((r) => setTimeout(r, 0))

export function run(test) {
  test('tone3000 list: the address of a search is TONE3000’s own, always for NAM captures of the kind the unit plays', async () => {
    const t = await lib()
    /* Nothing asked for: the first page of what is trending, 25 to a page (the most TONE3000 gives), in the order its own client writes them. */
    assert.equal(t.searchPath(), '/api/v1/tones/search?page=1&page_size=25&sort=trending&format=nam&architecture=2')
    assert.equal(t.T3K_PAGE_SIZE, 25)
    /* Words typed are trimmed and written so the address survives them. */
    const q = queryOfUrl(t.searchPath({ query: '  mesa & boogie/5150  ', page: 3, sort: 'downloads', gear: 'amp-cab' }))
    assert.deepEqual(q, { page: '3', page_size: '25', query: 'mesa & boogie/5150', sort: 'downloads-all-time', gears: 'amp-cab', format: 'nam', architecture: '2' })
    assert.ok(!/[ &]boogie|\/5150/.test(t.searchPath({ query: 'mesa & boogie/5150' }).split('?')[1].replace(/&(sort|format|architecture|page_size)=/g, '')), 'the words are in the address unwritten')
    /* The chips' words, and TONE3000's word for each. The order no longer offered ("oldest") and a kind it does not have are not sent. */
    assert.deepEqual(t.T3K_SORTS.map((s) => [s.key, s.label, s.sort]), [['trending', 'Trending', 'trending'], ['newest', 'Newest', 'newest'], ['downloads', 'Most downloaded', 'downloads-all-time']])
    assert.deepEqual(t.T3K_GEARS.map((g) => [g.key, g.label]), [['', 'All'], ['amp', 'Amps'], ['amp-cab', 'Amp + Cab'], ['pedal', 'Pedals']])
    for (const s of t.T3K_SORTS) assert.equal(queryOfUrl(t.searchPath({ sort: s.key })).sort, s.sort)
    assert.equal(queryOfUrl(t.searchPath({ sort: 'oldest' })).sort, 'trending')
    assert.equal(queryOfUrl(t.searchPath({ gear: 'ir' })).gears, undefined)
    assert.equal(queryOfUrl(t.searchPath({ gear: '' })).gears, undefined)
    /* A page that is no page is the first. */
    for (const bad of [0, -2, 'x', null, undefined, NaN]) assert.equal(queryOfUrl(t.searchPath({ page: bad })).page, '1', String(bad))
    assert.equal(queryOfUrl(t.searchPath({ page: 2.9 })).page, '2')
    /* Whatever is asked, it is NAM and the A2 kind: left out, TONE3000 answers with the older kind only, which the Axe-Fx III's NAM block does not play. */
    for (const what of [{}, { query: 'x' }, { gear: 'pedal' }, { sort: 'newest', page: 9 }]) {
      const got = queryOfUrl(t.searchPath(what))
      assert.deepEqual([got.format, got.architecture, got.page_size], ['nam', '2', '25'])
    }
    /* A kind of gear in TONE3000's own words. */
    assert.deepEqual(['amp', 'amp-cab', 'full-rig', 'pedal', 'outboard', 'mystery', '', null].map(t.gearSaid), ['Amp Head', 'Amp + Cab', 'Amp + Cab', 'Pedal', 'Outboard', 'mystery', '', ''])
  })

  test('tone3000 list: the sign-in alone opens TONE3000’s sign-in and nothing after it, and comes back signed in with no tone', async () => {
    const t = await lib()
    const w = site()
    const c = t.tone3000(w)
    const url = await c.start({ pick: false })
    assert.deepEqual(w.opened, [url])
    const pending = JSON.parse(w.kept.get(t.T3K_PENDING_KEY))
    /* Its documentation: "prompt omitted: standard authorization only". None of the pick-a-tone page's words go with it; its bar does. */
    assert.ok(url.startsWith('https://www.tone3000.com/api/v1/oauth/authorize?'))
    assert.deepEqual(queryOfUrl(url), {
      client_id: t.T3K_KEY,
      redirect_uri: 'fractalremote://tone3000',
      response_type: 'code',
      code_challenge: t.challengeOf(pending.verifier),
      code_challenge_method: 'S256',
      state: pending.state,
      menubar: 'true'
    })
    /* TONE3000 sends the player back with a code and no tone: signed in, and nothing picked. */
    const done = await c.finish(`fractalremote://tone3000?code=CODE&state=${encodeURIComponent(pending.state)}`)
    assert.deepEqual(done, { ok: true, toneId: null, canceled: false })
    assert.equal(await c.signedIn(), true)
    /* And the page to pick a tone on is what it was: asked for with nothing, or with pick true. */
    for (const how of [undefined, {}, { pick: true }]) {
      const picked = queryOfUrl(await t.tone3000(site()).start(how))
      assert.deepEqual([picked.prompt, picked.format, picked.architecture, picked.preview, picked.menubar], ['select_tone', 'nam', '2', 'true', 'true'])
    }
    assert.equal(queryOfUrl(t.authorizeUrl({ challenge: 'C', state: 'S' })).prompt, 'select_tone')
    assert.equal(queryOfUrl(t.authorizeUrl({ challenge: 'C', state: 'S', pick: false })).prompt, undefined)
  })

  test('tone3000 list: a search, TONE3000’s short lists and whose sign-in it is are asked of TONE3000 with the pass, and only tones the unit can play are listed', async () => {
    const { w, c } = await signedIn()
    w.state.search = { data: [tone(1), tone(2, { format: 'ir' }), tone(3, { a2_models_count: 0 }), { title: 'no id' }, null, tone(4, { format: undefined, a2_models_count: undefined })], page: 2, page_size: 25, total: 61, total_pages: 3 }
    const before = w.asked.length
    const got = await c.search({ query: 'plexi', page: 2, sort: 'newest', gear: 'amp' })
    assert.equal(w.asked.length, before + 1, 'a search is more than one request')
    assert.equal(w.asked[before].url, 'https://www.tone3000.com/api/v1/tones/search?page=2&page_size=25&query=plexi&sort=newest&gears=amp&format=nam&architecture=2')
    assert.equal(w.asked[before].auth, 'Bearer access-1')
    /* An impulse response, a tone with no A2 capture and one with no id are not rows; a tone that does not say is. */
    assert.deepEqual(got.tones.map((x) => x.id), [1, 4])
    assert.deepEqual([got.page, got.pages, got.total], [2, 3, 61])
    /* An answer with nothing in it is an empty first page, never a fault. */
    w.state.search = {}
    assert.deepEqual(await c.search({ page: 4 }), { tones: [], page: 4, pages: 1, total: 0 })
    w.state.search = null

    /* Its short lists: trending for one kind of gear by its own question, the newest picked out here. */
    assert.deepEqual((await c.feed('trending')).map((x) => x.id), [1])
    assert.equal(w.asked.at(-1).url, 'https://www.tone3000.com/api/v1/tones/trending')
    await c.feed('trending', 'amp-cab')
    assert.equal(w.asked.at(-1).url, 'https://www.tone3000.com/api/v1/tones/trending?gear=amp-cab')
    await c.feed('trending', 'not-a-kind')
    assert.equal(w.asked.at(-1).url, 'https://www.tone3000.com/api/v1/tones/trending')
    assert.deepEqual((await c.feed('latest')).map((x) => x.id), [3, 4])
    assert.equal(w.asked.at(-1).url, 'https://www.tone3000.com/api/v1/tones/latest')
    assert.deepEqual((await c.feed('latest', 'pedal')).map((x) => x.id), [4])

    /* Whose sign-in it is. */
    assert.deepEqual(await c.me(), { username: 'justin', avatar_url: 'https://www.tone3000.com/a.png' })
    assert.equal(w.asked.at(-1).url, 'https://www.tone3000.com/api/v1/user')
    for (const a of w.asked.slice(1)) assert.equal(a.auth, 'Bearer access-1', a.url)

    /* What TONE3000 refuses carries its number: 403 is "search is not open to this key", which the list reads. */
    w.state.status = 403
    await assert.rejects(c.search({}), (err) => err.status === 403)
    w.state.status = 429
    await assert.rejects(c.search({}), (err) => err.status === 429 && /too many requests/.test(err.message))
  })

  test('tone3000 list: TONE3000 is asked when the list opens, on Search, on a chip and for More, and never twice for the same thing', async () => {
    const { toneBrowser } = await browse()
    const h = byHand()
    const list = toneBrowser(h)
    const seen = []
    const stop = list.subscribe((s) => seen.push(s))
    /* Made, it has asked nothing and has nothing to show yet. */
    assert.equal(h.asks.length, 0)
    assert.deepEqual([list.get().tones, list.get().busy, list.get().sort, list.get().gear, list.get().query], [null, null, 'trending', '', ''])

    /* It opens: one question, the first page of what is trending. Drawn again while that is out, or after, it asks nothing. */
    list.start()
    list.start()
    assert.equal(h.asks.length, 1)
    assert.deepEqual(h.asks[0].args, [{ query: '', page: 1, sort: 'trending', gear: '' }])
    assert.equal(list.get().busy, 'list')
    h.asks[0].answer(page([1, 2, 3], 1, 3))
    await settle()
    list.start()
    assert.equal(h.asks.length, 1)
    assert.deepEqual([list.get().tones.map((x) => x.id), list.get().page, list.get().pages, list.get().busy, list.hasMore()], [[1, 2, 3], 1, 3, null, true])

    /* The chip already on asks nothing; a word that is no chip asks nothing. */
    list.sort('trending')
    list.gear('')
    list.sort('oldest')
    list.gear('ir')
    assert.equal(h.asks.length, 1)

    /* More: the next page, added under what is there, and a tone handed over twice is shown once. A second More while one is out asks nothing. */
    list.more()
    list.more()
    assert.equal(h.asks.length, 2)
    assert.deepEqual(h.asks[1].args, [{ query: '', page: 2, sort: 'trending', gear: '' }])
    assert.equal(list.get().busy, 'more')
    assert.deepEqual(list.get().tones.map((x) => x.id), [1, 2, 3], 'the list went away while More was out')
    h.asks[1].answer(page([3, 4, 5], 2, 3))
    await settle()
    assert.deepEqual(list.get().tones.map((x) => x.id), [1, 2, 3, 4, 5])

    /* Search, with the box's words trimmed: page one of a new question. */
    list.find('  plexi  ')
    assert.deepEqual(h.asks[2].args, [{ query: 'plexi', page: 1, sort: 'trending', gear: '' }])
    h.asks[2].answer(page([9], 1, 1))
    await settle()
    assert.deepEqual([list.get().query, list.get().tones.map((x) => x.id), list.hasMore()], ['plexi', [9], false])
    /* On the last page More has nothing to fetch. */
    list.more()
    assert.equal(h.asks.length, 3)

    /* A chip keeps the words and the other chip. */
    list.sort('downloads')
    assert.deepEqual(h.asks[3].args, [{ query: 'plexi', page: 1, sort: 'downloads', gear: '' }])
    /* While a first page is out, More asks nothing and the note of the list before it is gone. */
    list.more()
    assert.deepEqual([h.asks.length, list.get().busy, list.get().note], [4, 'list', ''])
    h.asks[3].answer(page([], 1, 1))
    await settle()
    list.gear('pedal')
    assert.deepEqual(h.asks[4].args, [{ query: 'plexi', page: 1, sort: 'downloads', gear: 'pedal' }])
    h.asks[4].answer(page([7], 1, 1))
    await settle()
    assert.equal(h.asks.length, 5)
    /* Handed the box's words, a chip asks with those: the rows are never an answer to words the box no longer shows. Still one question a tap. */
    list.sort('newest', '')
    assert.deepEqual(h.asks[5].args, [{ query: '', page: 1, sort: 'newest', gear: 'pedal' }])
    h.asks[5].answer(page([8], 1, 1))
    await settle()
    list.gear('amp', '  5150 ')
    assert.deepEqual(h.asks[6].args, [{ query: '5150', page: 1, sort: 'newest', gear: 'amp' }])
    h.asks[6].answer(page([9], 1, 1))
    await settle()
    assert.equal(list.get().query, '5150')
    /* The chip already on asks nothing, whatever the box says. */
    list.gear('amp', 'other words')
    list.sort('newest', 'other words')
    assert.deepEqual([h.asks.length, list.get().query], [7, '5150'])
    assert.ok(h.asks.every((a) => a.kind === 'search'), 'a short list was asked for while search answers')

    /* Whoever is listening is told of each change, and nobody after they stop. */
    assert.ok(seen.length >= 10)
    assert.equal(seen.at(-1), list.get())
    stop()
    const told = seen.length
    list.find('x')
    assert.equal(seen.length, told)
  })

  test('tone3000 list: an answer to anything but the newest question is thrown away, whichever comes back last', async () => {
    const { toneBrowser } = await browse()
    const h = byHand()
    const list = toneBrowser(h)
    list.start()
    list.sort('newest')
    list.sort('downloads')
    assert.equal(h.asks.length, 3)
    /* The newest question is answered first, then the two before it. */
    h.asks[2].answer(page([30, 31]))
    await settle()
    assert.deepEqual([list.get().tones.map((x) => x.id), list.get().busy], [[30, 31], null])
    h.asks[0].answer(page([1]))
    h.asks[1].refuse(Object.assign(new Error('late and failed'), { status: 500 }))
    await settle()
    assert.deepEqual([list.get().tones.map((x) => x.id), list.get().fault, list.get().sort], [[30, 31], '', 'downloads'], 'an old answer landed under the newer question')

    /* The same for More: a chip tapped while More is out, and More's page never joins the new list. */
    const h2 = byHand()
    const list2 = toneBrowser(h2)
    list2.start()
    h2.asks[0].answer(page([1, 2], 1, 2))
    await settle()
    list2.more()
    list2.gear('amp')
    h2.asks[2].answer(page([50], 1, 1))
    await settle()
    h2.asks[1].answer(page([3, 4], 2, 2))
    await settle()
    assert.deepEqual([list2.get().tones.map((x) => x.id), list2.get().page, list2.get().gear], [[50], 1, 'amp'])
  })

  test('tone3000 list: a first page that fails leaves nothing under the new question, and a further one leaves what is there', async () => {
    const { toneBrowser, NO_TONES, nothingFound } = await browse()
    const h = byHand()
    const list = toneBrowser(h)
    list.start()
    h.asks[0].answer(page([1, 2], 1, 3))
    await settle()
    /* More fails: the two rows stay, the fault is said, and More can be asked again. */
    list.more()
    h.asks[1].refuse(new Error('TONE3000 took too long.'))
    await settle()
    assert.deepEqual([list.get().tones.map((x) => x.id), list.get().fault, list.get().busy, list.hasMore()], [[1, 2], 'TONE3000 took too long.', null, true])
    list.more()
    assert.deepEqual(h.asks[2].args[0].page, 2)
    h.asks[2].answer(page([3], 2, 3))
    await settle()
    assert.deepEqual([list.get().tones.map((x) => x.id), list.get().fault], [[1, 2, 3], ''])
    /* A new question fails: the old rows would read as its answer, so they go. */
    list.find('nothing')
    h.asks[3].refuse(new Error('No internet.'))
    await settle()
    assert.deepEqual([list.get().tones, list.get().fault, list.get().busy, list.hasMore()], [[], 'No internet.', null, false])
    /* A failure with no words of its own still says something. */
    list.find('again')
    h.asks[4].refuse({})
    await settle()
    assert.equal(list.get().fault, 'TONE3000 couldn’t be reached.')
    /* "No tones found" is for an answer that came back empty: never over a fault, never while a question is out, never before the first. */
    assert.equal(NO_TONES, 'No tones found.')
    assert.equal(nothingFound(list.get()), false)
    list.find('more')
    assert.equal(nothingFound(list.get()), false)
    h.asks[5].answer(page([], 1, 1))
    await settle()
    assert.equal(nothingFound(list.get()), true)
    assert.equal(nothingFound(toneBrowser(byHand()).get()), false)
    assert.match(flat(code(read('mobile/src/components/Tone3000Browser.js'))), /\{nothingFound\(now\) \? <Note>\{NO_TONES\}<\/Note> : null\}/)
  })

  test('tone3000 list: where search is not open to the app’s key, TONE3000’s own short lists stand in, the screen says so, and search is not asked again', async () => {
    const { toneBrowser, TRENDING_ONLY, NEWEST_ONLY, SEARCH_NOT_OPEN, nothingFound } = await browse()
    const no = () => Object.assign(new Error('TONE3000 couldn’t answer for That search (403).'), { status: 403 })
    const h = byHand()
    const list = toneBrowser(h)
    list.start()
    h.asks[0].refuse(no())
    await settle()
    /* Trending: its top ten, for every kind. */
    assert.deepEqual([h.asks[1].kind, h.asks[1].args], ['feed', ['trending', '']])
    assert.equal(list.get().busy, 'list', 'the list said it was done before the short list came')
    h.asks[1].answer([tone(1), tone(2)])
    await settle()
    assert.deepEqual([list.get().tones.map((x) => x.id), list.get().note, list.get().fault, list.hasMore()], [[1, 2], TRENDING_ONLY, '', false])
    /* From here search is not asked: Newest goes straight to the ten newest, a kind of gear to trending for that kind. */
    list.sort('newest')
    assert.deepEqual([h.asks.length, h.asks[2].kind, h.asks[2].args], [3, 'feed', ['latest', '']])
    h.asks[2].answer([tone(3)])
    await settle()
    /* The note says which of the two lists it is, and neither gives a number: the ten are cut down to what the NAM block plays. */
    assert.deepEqual([list.get().tones.map((x) => x.id), list.get().note], [[3], NEWEST_ONLY])
    list.sort('trending')
    h.asks[3].answer([tone(1)])
    await settle()
    list.gear('pedal')
    assert.deepEqual(h.asks[4].args, ['trending', 'pedal'])
    h.asks[4].answer([])
    await settle()
    /* A short list with nothing in it for this kind says so, under the note. */
    assert.deepEqual([list.get().tones, list.get().note, nothingFound(list.get())], [[], TRENDING_ONLY, true])
    /* Words typed, and Most downloaded, have no short list: nothing is asked, and the screen says where everything is. */
    const before = h.asks.length
    list.find('plexi')
    await settle()
    assert.equal(h.asks.length, before, 'something was asked for words search will not take')
    assert.deepEqual([list.get().tones, list.get().note, list.get().busy], [[], SEARCH_NOT_OPEN, null])
    /* Nothing was asked, so nothing is "not found". */
    assert.equal(nothingFound(list.get()), false)
    list.find('')
    h.asks[before].answer([tone(1)])
    await settle()
    list.sort('downloads')
    await settle()
    assert.equal(h.asks.length, before + 1)
    assert.deepEqual([list.get().tones, list.get().note], [[], SEARCH_NOT_OPEN])
    assert.ok(h.asks.slice(1).every((a) => a.kind === 'feed'), 'search was asked again after its no')
    /* A short list that fails is a fault, not a blank. */
    list.sort('newest')
    h.asks.at(-1).refuse(new Error('No internet.'))
    await settle()
    assert.deepEqual([list.get().tones, list.get().fault, list.get().note, nothingFound(list.get())], [[], 'No internet.', '', false])
    /* And one that fails with no words of its own still says something. */
    list.sort('trending')
    h.asks.at(-1).refuse({})
    await settle()
    assert.equal(list.get().fault, 'TONE3000 couldn’t be reached.')
    /* A late answer from a short list is thrown away like any other: Newest then Trending, the newer answered first. */
    list.sort('newest')
    const older = h.asks.at(-1)
    list.sort('trending')
    const newer = h.asks.at(-1)
    newer.answer([tone(1)])
    await settle()
    older.answer([tone(3), tone(4)])
    await settle()
    assert.deepEqual([list.get().tones.map((x) => x.id), list.get().note, list.get().sort], [[1], TRENDING_ONLY, 'trending'], 'an old short list landed under the newer question')
    list.sort('newest')
    const older2 = h.asks.at(-1)
    list.sort('trending')
    h.asks.at(-1).answer([tone(2)])
    await settle()
    older2.refuse(new Error('late and failed'))
    await settle()
    assert.deepEqual([list.get().tones.map((x) => x.id), list.get().fault], [[2], ''])
    /* The sentences say where the rest is, truly (TONE3000's page is opened for the NAM block's captures alone, so not "everything"), give no number, and promise nothing. */
    for (const said of [TRENDING_ONLY, NEWEST_ONLY, SEARCH_NOT_OPEN]) {
      assert.match(said, /^TONE3000 hasn’t opened its search to this app yet/)
      assert.match(said, /Browse TONE3000, below, has every capture the NAM block can play\.$/)
      assert.ok(!/\b(soon|coming|beta|not yet tried|everything|ten|10)\b/i.test(said), said)
    }
    assert.match(TRENDING_ONLY, /trending/)
    assert.match(NEWEST_ONLY, /newest/)

    /* The no can come on More: what is there stays, and the screen says why there is no more. */
    const h2 = byHand()
    const list2 = toneBrowser(h2)
    list2.start()
    h2.asks[0].answer(page([1, 2], 1, 2))
    await settle()
    list2.more()
    h2.asks[1].refuse(no())
    await settle()
    assert.deepEqual([list2.get().tones.map((x) => x.id), list2.get().note, list2.get().busy, h2.asks.length], [[1, 2], SEARCH_NOT_OPEN, null, 2])
    /* And the list ends there: a More left up would ask nothing for ever. */
    assert.equal(list2.hasMore(), false)
    list2.more()
    assert.equal(h2.asks.length, 2)
    assert.deepEqual([list2.get().page, list2.get().pages], [1, 1])
  })

  test('tone3000 list: a row says who made the tone, the kind of gear, the format and its downloads, and a picture is only ever a web address', async () => {
    const b = await browse()
    assert.equal(b.toneLine({ user: { username: 'amalgamaudio' }, gear: 'amp-cab', downloads_count: 44988 }), 'amalgamaudio · Amp + Cab · NAM · 44,988 downloads')
    /* A verified creator's own name is the one TONE3000 shows. */
    assert.equal(b.toneLine({ user: { username: 'u', display_name: 'Amalgam Audio' }, gear: 'pedal', downloads_count: 1 }), 'Amalgam Audio · Pedal · NAM · 1 download')
    assert.equal(b.toneLine({ user: { username: 'u' }, gear: 'amp', downloads_count: 0 }), 'u · Amp Head · NAM · 0 downloads')
    /* What a tone does not say is left out, never written as a blank. */
    assert.equal(b.toneLine({}), 'NAM')
    assert.equal(b.toneLine(null), 'NAM')
    assert.equal(b.toneLine({ gear: 'amp' }), 'Amp Head · NAM')
    assert.deepEqual([0, 7, 999, 1000, 44988, 1234567, -5, 'x', null, 12.9].map(b.grouped), ['0', '7', '999', '1,000', '44,988', '1,234,567', '0', '0', '0', '12'])
    assert.equal(b.creatorOf({ user: {} }), '')
    /* The gear a tone is a capture of, by TONE3000's own names for it. */
    assert.equal(b.makesOf({ makes: [{ name: 'Two-Rock SSS 100W' }] }), 'Two-Rock SSS 100W')
    assert.equal(b.makesOf({ makes: [{ name: 'Mesa Boogie Dual Rectifier' }, 'Mesa 4x12', { name: '  ' }, { id: 3 }, null, 7] }), 'Mesa Boogie Dual Rectifier, Mesa 4x12')
    for (const none of [{ makes: [] }, { makes: 'Fender' }, {}, null]) assert.equal(b.makesOf(none), '', JSON.stringify(none))
    /* Pictures: the first of a tone's, the creator's, and nothing that is not an https address. */
    assert.equal(b.toneImage({ images: ['https://www.tone3000.com/i/1.jpg', 'https://x/2.jpg'] }), 'https://www.tone3000.com/i/1.jpg')
    for (const bad of [{ images: [] }, { images: ['http://plain/1.jpg'] }, { images: ['javascript:alert(1)'] }, { images: [{ url: 'https://x' }] }, { images: 'https://x' }, {}, null]) assert.equal(b.toneImage(bad), null, JSON.stringify(bad))
    assert.equal(b.creatorImage({ user: { avatar_url: 'https://www.tone3000.com/a.png' } }), 'https://www.tone3000.com/a.png')
    for (const bad of [{ user: { avatar_url: 'file:///a.png' } }, { user: { avatar_url: 7 } }, { user: {} }, {}, null]) assert.equal(b.creatorImage(bad), null, JSON.stringify(bad))
  })

  test('tone3000 list: the screen never asks on a keystroke or a clock, keeps nothing, and asks only through the list it is handed', () => {
    const rules = read('mobile/src/lib/tone3000Browse.js')
    const view = read('mobile/src/components/Tone3000Browser.js')
    const src = flat(code(view))
    /* Typing only fills the box; Search and the keyboard's own search key ask. */
    assert.match(src, /onChangeText=\{setTyped\}/)
    assert.equal((src.match(/onChangeText/g) || []).length, 1)
    assert.match(src, /onSubmitEditing=\{find\}/)
    assert.match(src, /const find = \(\) => list\.find\(typed\)/)
    /* The one thing done on its own is the first list, once, and it hangs on the list alone, never on what is typed. */
    assert.match(src, /useEffect\(\(\) => \{ list\.start\(\) \}, \[list\]\)/)
    for (const effect of src.match(/useEffect\(\(\) => \{[^}]*\}, \[[^\]]*\]\)/g)) assert.ok(!/typed|find|sort|gear|more/.test(effect), `an effect asks TONE3000 on its own: ${effect}`)
    /* Every question it can cause, and what causes it. */
    assert.deepEqual([...src.matchAll(/\blist\.(\w+)\(/g)].map((m) => m[1]).sort(), ['find', 'gear', 'get', 'hasMore', 'more', 'sort', 'start'])
    /* No clock in either half: nothing asks after a pause, on a timer or again and again. */
    for (const [name, body] of [['the list’s rules', code(rules)], ['the screen', code(view)]]) {
      assert.ok(!/setTimeout|setInterval|requestAnimationFrame|debounce|throttle/.test(body), `${name} runs a clock`)
      /* Nothing written down (TONE3000's terms: nothing cached). */
      assert.ok(!/AsyncStorage|SecureStore|localStorage|\.setItem\(|writeAsString/.test(body), `${name} keeps something on the device`)
    }
    /* The rules import the client's words and nothing else; the screen never reaches the client or the network itself. */
    assert.deepEqual([...code(rules).matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['./tone3000.js'])
    assert.ok(!/tone3000Here|\bt3k\b|fetch\(/.test(code(view)), 'the screen asks TONE3000 by a way of its own')
    /* A sideways row is the app's own, which keeps its drags from the back gesture. */
    assert.match(src, /<SideScroll showsHorizontalScrollIndicator=\{false\}/)
    /* Nothing of the glass: plain colours, the same in both looks. */
    assert.ok(!/\bglass[A-Z]\w*\(|color\.glass|from '\.\.\/lib\/glass'|<Glass|radius\.card/.test(code(view)))
    /* The rows of the question before are not left up under a new one while it is out. */
    assert.match(src, /\{now\.tones && !asking \? \( <View>/)
  })

  test('tone3000 list: every row and the tone’s own view show what TONE3000 asks of a list of its tones, and its own page is always one tap away', async () => {
    const view = flat(code(read('mobile/src/components/Tone3000Browser.js')))
    const card = flat(code(read('mobile/src/components/Tone3000Test.js')))
    const c = await import('../mobile/src/lib/tone3000.js')
    /* A row: the tone's picture, its title, who made it by picture and name, the kind of gear and the format (toneLine, held above). */
    const row = view.slice(view.indexOf('export function ToneRow('), view.indexOf('export default function Tone3000Browser('))
    assert.match(row, /<Picture uri=\{toneImage\(tone\)\} size=\{44\} \/>/)
    assert.match(row, /\{title\}/)
    assert.match(row, /\{creatorOf\(tone\) \? <Avatar uri=\{creatorImage\(tone\)\} size=\{14\} \/> : null\}/)
    assert.match(row, /const line = toneLine\(tone\)/)
    assert.match(row, /\{line\}/)
    /* The chips are the client's own lists, so a chip can never ask for what the address does not know. */
    assert.match(view, /\{T3K_SORTS\.map\(\(s\) => \( <Chip key=\{s\.key\} label=\{s\.label\} on=\{now\.sort === s\.key\} disabled=\{disabled\} onPress=\{\(\) => list\.sort\(s\.key, typed\)\} \/> \)\)\}/)
    assert.match(view, /\{T3K_GEARS\.map\(\(g\) => \( <Chip key=\{g\.key \|\| 'all'\} label=\{g\.label\} on=\{now\.gear === g\.key\} disabled=\{disabled\} onPress=\{\(\) => list\.gear\(g\.key, typed\)\} \/> \)\)\}/)
    /* More only where there is more, and never while a first page is out. */
    assert.match(view, /\{now\.tones && !asking && list\.hasMore\(\) \? <Press label=\{now\.busy === 'more' \? 'Loading…' : MORE\}/)

    /* The card: TONE3000's name on every view, whose sign-in it is, and "Powered by TONE3000". */
    assert.match(card, /<Text accessibilityRole="header" style=\{\{[^}]*\}\}> TONE3000 <\/Text>/)
    assert.match(card, /const whoSaid = me\?\.username \? `@\$\{me\.username\}` : 'Signed in'/)
    /* On every view: after the sign-out button's own condition, under no condition of its own. */
    assert.match(card, /onPress=\{signOut\} \/> : null\} <Text style=\{\{[^}]*\}\}>\{T3K_POWERED\}<\/Text>/)
    assert.equal(c.T3K_POWERED, 'Powered by TONE3000')
    /* Before a sign-in: TONE3000's own words for what this is, with the app's name in, and Continue to its sign-in alone. */
    const words = await wordsOf()
    assert.equal(words.PARTNER, 'Fractal Remote has partnered with TONE3000 to give you access to a massive library of Neural Amp Modeler (NAM) captures of real analog gear, created by a global community of musicians.')
    assert.equal(words.CONTINUE, 'Continue')
    assert.match(card, /\{signedIn === false \? \( <View style=\{\{ gap: space\.md \}\}> <Text style=\{\{[^}]*\}\}>\{PARTNER\}<\/Text>/)
    assert.match(card, /<Press label=\{busy === 'open' \? 'Opening…' : CONTINUE\} tone="live" disabled=\{!!busy\} onPress=\{\(\) => browse\(false, false\)\} \/>/)
    /* Neither the list nor the sign-in view is drawn before the device has said which it is. */
    assert.match(card, /const \[signedIn, setSignedIn\] = useState\(null\)/)
    assert.match(card, /\{signedIn && !tone \? <Tone3000Browser list=\{list\.current\} disabled=\{!!busy\} onOpen=\{openTone\} \/> : null\}/)
    /* Signed in, on the list or on a tone: TONE3000's own page, with everything it has, is one tap away. */
    assert.match(card, /\{signedIn \? <Press label=\{busy === 'open' \? 'Opening…' : 'Browse TONE3000'\} sub="Every capture the NAM block can play, on its own page, with play buttons" disabled=\{!!busy\} onPress=\{\(\) => browse\(\)\} \/> : null\}/)
    /* A tone's own view: its picture, title, maker by picture and name, kind and format, the creator and licence, its description, and its captures. */
    const toneView = card.slice(card.indexOf('{signedIn && tone ? ('), card.indexOf("{signedIn ? <Press label={busy === 'open'"))
    for (const piece of ['source={{ uri: picture }}', "{tone.title || 'Untitled tone'}", '<Avatar uri={creatorImage(tone)} size={16} />', "{[madeBy, gearSaid(tone.gear), 'NAM'].filter(Boolean).join(' · ')}", '{gearNamed}', '{toneCredit(tone)}', '{String(tone.description)}', '{(models || []).map((m) => {', '{where.held ? BACK_TO_LIST_HELD : BACK_TO_LIST}', '{CAPTURES_HEAD}']) {
      assert.ok(toneView.includes(piece), `a tone’s view no longer has ${piece}`)
    }
    /* A sign-in TONE3000 no longer takes goes back to the sign-in view with a reason, in place of a list that can only fail. */
    assert.match(card, /const whenSignedOut = \(err\) => \{ if \(err\?\.status === 401 && alive\.current\) \{ list\.current = newList\(\) wanted\.current \+= 1 setBusy\(\(was\) => \(was === 'tone' \? null : was\)\) setSignedIn\(false\) setTone\(null\) setModels\(null\) setFault\(''\) setSaid\(SIGN_IN_AGAIN\) \} throw err \}/)
    /* Every request the card makes of TONE3000 goes back to the sign-in view on that answer: the list's, whose sign-in it is, a tone, its captures, a capture's file. */
    assert.match(card, /await Promise\.all\(\[t3k\.tone\(toneId\)\.catch\(whenSignedOut\), t3k\.models\(toneId\)\.catch\(whenSignedOut\)\]\)/)
    assert.match(card, /const text = await t3k\.modelText\(m\)\.catch\(whenSignedOut\)/)
    assert.match(card, /\.catch\(\(err\) => \(live \? whenSignedOut\(err\) : null\)\)/)
    for (const asked of card.match(/\bt3k\.(search|feed|me|tone|models|modelText)\([^)]*\)\s*\.?\w*/g)) assert.match(asked, /\.(catch|then)$/, `${asked} is asked with no way back to the sign-in view`)
    /* Whose sign-in it is: asked again at each sign-in that finishes, and an answer that lands after a sign-out is nobody's. */
    assert.match(card, /setSignedIn\(true\) setMeAsk\(\(n\) => n \+ 1\)/)
    assert.match(card, /let live = true t3k \.me\(\) \.then\(\(who\) => live && alive\.current && setMe\(who \|\| null\)\)/)
    assert.match(card, /return \(\) => \{ live = false \} \}, \[signedIn, meAsk\]\)/)
    assert.match(card, /const newList = \(\) => toneBrowser\(\{ search: \(what\) => t3k\.search\(what\)\.catch\(whenSignedOut\), feed: \(which, gear\) => t3k\.feed\(which, gear\)\.catch\(whenSignedOut\) \}\)/)
    /* A tone left while it was being fetched does not come back up when its answer lands. */
    assert.match(card, /const mine = \+\+wanted\.current/)
    assert.match(card, /if \(!alive\.current \|\| mine !== wanted\.current\) return/)
    assert.match(card, /if \(alive\.current && mine === wanted\.current\) setFault\(/)
    assert.match(card, /if \(alive\.current && mine === wanted\.current\) setBusy\(\(was\) => \(was === 'tone' \? null : was\)\)/)
    assert.match(card, /const toList = \(\) => \{ if \(busy && busy !== 'tone'\) return wanted\.current \+= 1 setBusy\(\(was\) => \(was === 'tone' \? null : was\)\)/)
    /* A tone picked on TONE3000's own page opens here, but never over a capture that is going to the unit. */
    assert.match(card, /if \(!done\.toneId\) return if \(goingNow\(\)\) setSaid\(PICK_AFTER_SEND\) else load\(done\.toneId\)/)
    /* The words on the screen: no browser by name, nothing promised, nothing called a beta. */
    for (const said of [words.PARTNER, words.SIGN_IN_AGAIN, words.BACK_TO_LIST, words.HOW_IT_WORKS, words.PICK_AFTER_SEND, words.PREVIEW, words.GET, words.CAPTURES_HEAD, words.CAPTURES_NOTE, ...words.STEPS, words.STEPS_FOOT]) {
      assert.ok(!/\b(Safari|Chrome|beta|soon|coming|official|this phone|this device)\b/i.test(said), said)
    }
    /* What names the device in hand is read when it is shown, by the device's own word. */
    assert.match(card, /export const partnerMore = \(\) => `Continue opens TONE3000’s own sign-in: your email, then a code it sends you\. After that it stays signed in on this \$\{deviceNoun\(\)\}\.`/)
    assert.match(card, /\{partnerMore\(\)\}<\/Text>/)
    /* A sign-in that could not be finished names no button: before a sign-in the one on screen is Continue, after one it is Browse TONE3000. */
    assert.match(card, /setFault\(`The sign-in to TONE3000 couldn’t be finished on this \$\{deviceNoun\(\)\}\. Try again\.`\)/)
    assert.ok(!/Tap Browse TONE3000 again/.test(card))
  })
}

export function runPreviewAndGet(test) {
  test('tone3000 list: a tone is laid out as the HeadRush app’s, and each capture has Preview and Get, which say truly what they do on an Axe-Fx III', async () => {
    const card = flat(code(read('mobile/src/components/Tone3000Test.js')))
    const words = await wordsOf()
    assert.deepEqual([words.PREVIEW, words.GET, words.BACK_TO_LIST], ['Preview', 'Get', '‹ Back'])
    /* The title with Back beside it, on one line. */
    assert.match(card, /<View style=\{\{ flexDirection: 'row', alignItems: 'center', gap: space\.md \}\}> <Text accessibilityRole="header" numberOfLines=\{2\} style=\{\{[^}]*\}\}> \{tone\.title \|\| 'Untitled tone'\} <\/Text> <Pressable accessibilityRole="button" accessibilityLabel=\{where\.held \? 'Back to the tones' : 'Back to the list'\}/)
    /* A line a capture: its name, then the two buttons, each with a picture AND its word (never a picture alone). */
    assert.match(card, /<LineButton icon=\{playIcon\} label=\{word\('play', PREVIEW\)\} says=\{previewSays\(named, where\.n\)\} disabled=\{!!busy\} onPress=\{\(\) => sendToUnit\(m, null, false, true\)\} \/>/)
    /* Get plays only where the page was opened from a held block (`where.held`, which is false on the Developer page): there it is the end of the errand, test/tone3000-quick.mjs. */
    assert.match(card, /<LineButton icon=\{saveIcon\} label=\{word\('keep', GET\)\} says=\{getSays\(named, where\)\} lit disabled=\{!!busy\} onPress=\{\(\) => sendToUnit\(m, null, false, where\.held, where\.held\)\} \/>/)
    assert.match(card, /const where = \{ n: NAM_BLOCKS\.indexOf\(playIn\) \+ 1, held: held === true && typeof onDone === 'function', back: backTo === 'captures' \? 'captures' : 'knobs' \}/)
    assert.match(card, /export default function Tone3000Test\(\{ block = NAM_BLOCKS\[0\], held = false, onDone = null, onWorking = null, backTo = 'knobs', onPointed = null \}\)/)
    const said = await import('../mobile/src/lib/tone3000Words.js')
    assert.equal(said.previewSays('Plexi', 1), 'Preview Plexi: puts it on the Axe-Fx III and plays it in NAM 1')
    assert.equal(said.getSays('Plexi'), 'Get Plexi: puts it on the Axe-Fx III')
    const button = card.slice(card.indexOf('function LineButton('), card.indexOf('export default function Tone3000Test('))
    assert.match(button, /<Image source=\{icon\} accessible=\{false\}[^>]*\/> <Text maxFontSizeMultiplier=\{1\.4\} style=\{\{[^}]*\}\}> \{label\} <\/Text>/)
    /* Get is the lit one, as in his picture: dark ink on a light ground. */
    assert.match(button, /const ink = lit \? color\.chassis : color\.silk/)
    assert.match(button, /backgroundColor: lit \? color\.silk :/)
    /* The word on the button that was tapped says what it is doing, and only that one. */
    assert.match(card, /setTapped\(play && !back \? 'play' : 'keep'\)/)
    assert.match(card, /const word = \(which, said\) => \(working && tapped === which \? \(busy === m\.id \? 'Fetching…' : 'Sending…'\) : said\)/)
    /* The name keeps room of its own, and at the largest text sizes the buttons drop under it. */
    assert.match(card, /<View style=\{\{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space\.sm \}\}> <Text numberOfLines=\{2\} style=\{\{ flex: 1, minWidth: 96,/)
    assert.match(button, /accessibilityLabel=\{says\}/)
    assert.match(button, /minHeight: TAP/)
    /* What each does. Both put the capture in the unit's first empty slot (the one send); Preview alone then points NAM 1 at it, Get leaves what is playing alone. */
    assert.match(card, /const sendToUnit = async \(m, again = null, fill = false, play = true, back = false\) => \{/)
    assert.match(card, /if \(!play\) return setBusy\(`pick \$\{playIn\}`\) const nowPlaying = await point\(playIn, slot, m\.id\)/)
    assert.match(card, /if \(went\.ok && went\.got\.name !== NAM_EMPTY\) place\(m\.id, slot, !!went\.got\.name\)/)
    /* On the Developer page that block is NAM 1: nothing handed in, or a block that is no NAM. */
    assert.match(card, /const playIn = NAM_BLOCKS\.includes\(block\) \? block : NAM_BLOCKS\[0\]/)
    /*
     * A capture the app has put on the unit is never sent a second time into
     * another slot: not by a second tap, and not after Back and the same tone
     * again. So what is on the unit is kept for as long as the app runs,
     * outside any one drawing of the page, and forgotten only when the unit
     * names the slot empty. Nothing that clears the view clears it.
     */
    assert.match(card, /if \(again === null && placed\.has\(String\(m\.id\)\)\) return/)
    assert.equal((card.match(/const placed = new Map\(\)/g) || []).length, 1)
    assert.ok(card.indexOf('const placed = new Map()') < card.indexOf('export default function Tone3000Test('), 'what is on the unit is forgotten with each drawing of the page')
    assert.match(card, /const \[onUnit, setOnUnit\] = useState\(placedNow\)/)
    assert.deepEqual(card.match(/placed\.(set|delete|clear)\(/g), ['placed.set(', 'placed.delete('])
    assert.match(card, /const place = \(id, slot, sure\) => \{ placed\.set\(String\(id\), \{ slot, sure \}\) if \(alive\.current\) setOnUnit\(placedNow\(\)\) \}/)
    assert.match(card, /const unplace = \(id\) => \{ placed\.delete\(String\(id\)\) if \(alive\.current\) setOnUnit\(placedNow\(\)\) \}/)
    assert.equal((card.match(/\bunplace\(/g) || []).length, 1, 'something other than an empty slot takes a capture off the list of what is on the unit')
    assert.ok(!/setOnUnit\(\{\}\)/.test(card))
    /* "On the unit" only where the unit said the slot holds it; a send it took and said nothing of is "Sent to slot", until a block pointed at it names what is there. */
    assert.match(card, /\{at\.sure \? `On the unit · slot \$\{namSlotSaid\(at\.slot\)\}` : `Sent to slot \$\{namSlotSaid\(at\.slot\)\}`\}/)
    assert.match(card, /if \(placed\.has\(String\(id\)\)\) place\(id, slot, true\)/)
    /* What a fetched file turned out to be is still said under a capture that cannot be sent, and under the one in hand. */
    assert.match(card, /\{checked\[m\.id\] && \(noUse \|\| mine\) \? \( <Text selectable style=\{\{[^}]*\}\}> \{checked\[m\.id\]\} <\/Text> \) : null\}/)
    /* Once on the unit, which NAM block plays it is one tap, whichever button put it there, and what the block says lands under THAT capture. */
    assert.match(card, /\{there && !where\.held \? NAM_BLOCKS\.map\(\(nam, i\) => \( <Press key=\{nam\} label=\{busy === `pick \$\{nam\}` && mine \? 'Changing…' : `Play it in NAM \$\{i \+ 1\}`\} sub="In the preset the unit is on" height=\{48\} disabled=\{!!busy\} onPress=\{\(\) => useIn\(nam, at\.slot, m\.id\)\} \/> \)\) : null\}/)
    assert.match(card, /const useIn = async \(block, slot, id, back = false\) => \{ if \(busy\) return setSend\(\(was\) => \(was\?\.id === id \? was : \{ id, slot, done: true, line: `In slot \$\{namSlotSaid\(slot\)\}\.` \}\)\)/)
    /* A send that stopped part-way belongs to the view: forgotten with the tone, the list and the sign-in, and when that capture is sent again. */
    assert.equal((card.match(/setChecked\(\{\}\) setStopped\(\{\}\)/g) || []).length, 4)
    assert.equal((card.match(/setChecked\(\{\}\)/g) || []).length, 4)
    assert.match(card, /setStopped\(\(was\) => Object\.fromEntries\(Object\.entries\(was\)\.filter\(\(\[key\]\) => key !== String\(m\.id\)\)\)\) let slot = again/)
    /* The steps say what the two do, and that a preview stays in a slot: on this unit there is no hearing a capture without keeping it, and no sentence says there is. */
    const steps = words.STEPS.join(' ')
    assert.match(steps, /Preview puts it on the Axe-Fx III and plays it in NAM 1, so you hear it through your own rig\. Get puts it on the unit and leaves what you are playing alone\./)
    assert.match(steps, /Either way it goes into the unit’s first empty capture slot and stays there: the Axe-Fx III can only play a capture that is in a slot\./)
    /* And the view itself says it, where he is looking when he taps: not only the steps behind the ⓘ. */
    assert.equal(words.CAPTURES_NOTE, 'Preview and Get both put the capture in an empty slot on the unit, and it stays there. Preview also plays it in NAM 1.')
    assert.match(card, /<Text style=\{\{[^}]*\}\}>\{CAPTURES_HEAD\}<\/Text> <Text style=\{\{[^}]*\}\}>\{capturesNote\(where\)\}<\/Text>/)
    /* No words of the usual kinds say a preview is not kept, in anything this view can show or read aloud. (A list of words: it catches these, not every way of saying it.) */
    /* In both places the page can be: on its own, and from a held NAM block, either one. */
    const places = [{ n: 1, held: false }, { n: 1, held: true }, { n: 2, held: true }]
    const shown = `${steps} ${words.STEPS_FOOT} ${words.CAPTURES_HEAD} ${places.map((at) => `${said.stepsFor(at).join(' ')} ${said.stepsFoot(at)} ${said.capturesNote(at)} ${said.previewSays('X', at.n)} ${said.getSays('X', at)} ${said.useAndBackSub(at.n)}`).join(' ')}`
    assert.ok(!/without keeping|try before|temporar|not (be )?kept|isn’t kept|isn't kept|removed after|goes away|quick listen|just listen/i.test(shown), shown)
    assert.equal((shown.match(/puts it on the Axe-Fx III/g) || []).length >= 3, true)
    /* What waits for a preset save is which block plays it, not the capture, which is in its slot already. */
    assert.match(words.STEPS_FOOT, /Which NAM block plays a capture is not saved until you save the preset, and a capture already on the unit is never written over\.$/)
    assert.ok(!/Nothing is saved/.test(words.STEPS_FOOT))
    /* The old single button and the file check are gone from the line: two buttons, as in the picture. */
    assert.ok(!/SEND_AND_PLAY|Check the file only/.test(card))
    /* And the pictures are ones the app already carries: nothing new for a build. */
    assert.match(card, /import playIcon from '\.\.\/\.\.\/assets\/icons\/play\.png' import saveIcon from '\.\.\/\.\.\/assets\/icons\/save\.png'/)
  })
}

/** The card's own words, read out of its source: the file draws with React Native, which the tests do not load. */
async function wordsOf() {
  const src = read('mobile/src/components/Tone3000Test.js')
  const one = (name) => {
    const m = src.match(new RegExp(`export const ${name} = '((?:[^'\\\\]|\\\\.)*)'`))
    assert.ok(m, `the card no longer has ${name}`)
    return m[1]
  }
  const said = await import('../mobile/src/lib/tone3000Words.js')
  return {
    PARTNER: one('PARTNER'),
    PICK_AFTER_SEND: one('PICK_AFTER_SEND'),
    PREVIEW: one('PREVIEW'),
    GET: one('GET'),
    CAPTURES_HEAD: one('CAPTURES_HEAD'),
    CONTINUE: one('CONTINUE'),
    BACK_TO_LIST: one('BACK_TO_LIST'),
    HOW_IT_WORKS: one('HOW_IT_WORKS'),
    SIGN_IN_AGAIN: one('SIGN_IN_AGAIN'),
    /* What depends on the block is lib/tone3000Words', read here as the Developer page says it: NAM 1, not from a held block. */
    STEPS_FOOT: said.stepsFoot(),
    STEPS: [...said.stepsFor()],
    CAPTURES_NOTE: said.capturesNote()
  }
}
