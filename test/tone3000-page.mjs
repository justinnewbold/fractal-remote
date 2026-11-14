/**
 * TONE3000 INSIDE THE APP (mobile/src/lib/tone3000Parts.js, tone3000Page.js,
 * tone3000Keep.js, tone3000Here.js, components/Tone3000Page.js, and
 * docs/pending/tone3000-in-app.patch).
 *
 * "Have you built out the built-in tone 3000 into our app so you don't have
 * to go to Safari?" (Justin, 14 November 2026.) The page inside the app is a
 * web view, the pass belongs in the phone's secure storage and the one-time
 * word in its secure random numbers: three native packages, which wait for a
 * build in a patch that adds them and nothing else. Everything that uses
 * them is in the tree already and has to do exactly what it did before on a
 * copy built without them. Both halves are held here.
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const there = (p) => existsSync(join(ROOT, p))
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

const page = () => import('../mobile/src/lib/tone3000Page.js')
const keepLib = () => import('../mobile/src/lib/tone3000Keep.js')
const lib = () => import('../mobile/src/lib/tone3000.js')

/** The three, and the version of each the patch asks for: Expo 57's own pairing, which is also TONE3000's example's. */
const PARTS = Object.freeze({
  'react-native-webview': '13.16.1',
  'expo-secure-store': '~57.0.4',
  'expo-crypto': '~57.0.4'
})
const PATCH = 'docs/pending/tone3000-in-app.patch'

/** Every .js file of the phone app's own. */
function phoneFiles(dir = 'mobile/src', out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = `${dir}/${name}`
    if (statSync(join(ROOT, p)).isDirectory()) phoneFiles(p, out)
    else if (/\.(js|jsx|mjs)$/.test(name)) out.push(p)
  }
  return out
}

/** A pretend storage: what it holds, and every call made of it in order. */
function box(name, calls, { failSet = () => false, failRemove = () => false, failGet = () => false, slow = 0 } = {}) {
  const kept = new Map()
  const wait = () => (slow ? new Promise((r) => setTimeout(r, slow)) : Promise.resolve())
  return {
    kept,
    async get(key) {
      calls.push(`${name}.get ${key}`)
      await wait()
      if (failGet(key)) throw new Error(`${name} would not read ${key}`)
      return kept.has(key) ? kept.get(key) : null
    },
    async set(key, value) {
      calls.push(`${name}.set ${key}=${value}`)
      await wait()
      if (failSet(key, value)) throw new Error(`${name} would not take ${key}`)
      kept.set(key, value)
    },
    async remove(key) {
      calls.push(`${name}.remove ${key}`)
      await wait()
      if (failRemove(key)) throw new Error(`${name} would not let go of ${key}`)
      kept.delete(key)
    }
  }
}

export function run(test) {
  test('tone3000 in the app: the page loads the web, never TONE3000’s return, and is over once', async () => {
    const { pageFlow, pageOrigins, pageReturn, PAGE_REFUSED, PAGE_UNREACHED, T3K_PAGE_TITLE, T3K_PAGE_CLOSE } = await page()
    const { T3K_REDIRECT } = await lib()
    /* Their terms: TONE3000's own page, under its name. */
    assert.equal(T3K_PAGE_TITLE, 'TONE3000')
    assert.equal(T3K_PAGE_CLOSE, 'Close')
    /* The return's scheme is on the list, or the web view hands it to the phone without asking (their example's own comment). */
    assert.deepEqual(pageOrigins(), ['https://*', 'http://*', 'fractalremote://*'])
    assert.deepEqual(pageOrigins('tone3000-example://oauth/callback'), ['https://*', 'http://*', 'tone3000-example://*'])

    const back = `${T3K_REDIRECT}?code=abc&state=xyz&tone_id=42`
    assert.equal(pageReturn(back), true)
    assert.equal(pageReturn(T3K_REDIRECT), true)
    assert.equal(pageReturn(`${T3K_REDIRECT}?canceled=true`), true)
    /* Siri's links are the same scheme and are not TONE3000's; nor is a web page that only mentions it. */
    assert.equal(pageReturn('fractalremote://next'), false)
    assert.equal(pageReturn(`https://www.tone3000.com/?next=${encodeURIComponent(back)}`), false)
    assert.equal(pageReturn(`${T3K_REDIRECT}x?code=abc`), false)
    for (const odd of [undefined, null, 42, {}, '']) assert.equal(pageReturn(odd), false)

    const told = []
    const flow = (over = {}) => pageFlow({ onReturn: (u) => told.push(['return', u]), onClosed: () => told.push(['closed']), onFault: (w, status) => told.push(status === undefined ? ['fault', w] : ['fault', w, status]), ...over })

    /* A return: not loaded, told once, and nothing loads after it. */
    let f = flow()
    assert.equal(f.mayLoad('https://www.tone3000.com/api/v1/oauth/authorize?client_id=x'), true)
    assert.equal(f.mayLoad('https://www.tone3000.com/tones/42'), true)
    assert.equal(f.mayLoad('about:blank'), true)
    assert.equal(f.over(), false)
    assert.equal(f.mayLoad(back), false)
    assert.equal(f.over(), true)
    /* A web view asks about the same address again; and a late close or failure is nobody's business. */
    assert.equal(f.mayLoad(back), false)
    assert.equal(f.mayLoad('https://www.tone3000.com/'), false)
    f.close()
    f.loadError('https://www.tone3000.com/')
    f.httpError(500, 'https://www.tone3000.com/api/v1/oauth/authorize')
    assert.deepEqual(told, [['return', back]])

    /* Closed by the player: told once, and a return after it is not taken up. */
    told.length = 0
    f = flow()
    f.close()
    f.close()
    assert.equal(f.mayLoad(back), false)
    assert.deepEqual(told, [['closed']])

    /* TONE3000 turning the sign-in down ends it, in words; any other error answer leaves its own page up. */
    told.length = 0
    f = flow()
    f.httpError(404, 'https://www.tone3000.com/tones/9999')
    f.httpError(500, 'https://www.tone3000.com/search?q=plexi')
    f.httpError(403, 'https://evil.example/api/v1/oauth/authorize')
    f.httpError(200, 'https://www.tone3000.com/api/v1/oauth/authorize')
    f.httpError(undefined, 'https://www.tone3000.com/api/v1/oauth/authorize')
    f.httpError(400, back)
    assert.deepEqual(told, [])
    assert.equal(f.over(), false)
    f.httpError(400, 'https://www.tone3000.com/api/v1/oauth/authorize?client_id=x')
    /* In words, and the number TONE3000 answered with beside them for the log: never on the screen. */
    assert.deepEqual(told, [['fault', PAGE_REFUSED, 400]])
    assert.equal(PAGE_REFUSED, 'TONE3000 turned the sign-in down. Tap Browse TONE3000 again.')
    assert.ok(!/\d/.test(PAGE_REFUSED.replaceAll('TONE3000', '')) && !/\d/.test(PAGE_UNREACHED.replaceAll('TONE3000', '')), 'a web error number is in words the card shows')
    assert.equal(f.mayLoad('https://www.tone3000.com/'), false)

    /* A page that would not load ends it; a failed load OF the return is the return (their iPhone example). */
    told.length = 0
    f = flow()
    f.loadError('https://www.tone3000.com/')
    assert.deepEqual(told, [['fault', PAGE_UNREACHED]])
    assert.equal(PAGE_UNREACHED, 'TONE3000 couldn’t be reached. Check the internet and try again.')
    told.length = 0
    f = flow()
    f.loadError(back)
    f.loadError('https://www.tone3000.com/')
    assert.deepEqual(told, [['return', back]])

    /* Nobody listening is not a crash. */
    f = pageFlow({})
    assert.equal(f.mayLoad(back), false)
    f = pageFlow({})
    f.close()
    f.loadError(undefined)

    /* No phone and no package in the page's rules: the test above ran them as they are. */
    const src = code(read('mobile/src/lib/tone3000Page.js'))
    assert.deepEqual(src.match(/^import [^\n]+$/gm), ["import { readCallback, T3K_ORIGIN, T3K_REDIRECT } from './tone3000.js'"])
    assert.ok(!/\brequire\(/.test(src))
  })

  test('tone3000 in the app: a copy without the secure storage keeps the pass exactly where it always has', async () => {
    const { movingStore } = await keepLib()
    const calls = []
    const plain = box('plain', calls)
    /* Not a wrapper that happens to do the same: the ordinary storage itself. */
    assert.equal(movingStore({ plain }), plain)
    assert.equal(movingStore({ secure: null, plain, log: () => {} }), plain)
    assert.equal(movingStore({ secure: undefined, plain }), plain)
  })

  test('tone3000 in the app: the pass moves to the secure storage the first time it is read, and nothing is left behind', async () => {
    const { movingStore } = await keepLib()
    const calls = []
    const said = []
    const plain = box('plain', calls)
    const secure = box('secure', calls)
    const store = movingStore({ secure, plain, log: (l) => said.push(l) })

    /* Signed in before the build: the pass is in the ordinary storage. */
    plain.kept.set('k', 'old-pass')
    assert.equal(await store.get('k'), 'old-pass')
    assert.equal(secure.kept.get('k'), 'old-pass')
    assert.equal(plain.kept.has('k'), false, 'the pass was left in the ordinary storage after it moved')
    assert.deepEqual(calls, ['plain.get k', 'secure.set k=old-pass', 'plain.remove k'])
    /* From then on it is read from the secure storage. */
    calls.length = 0
    assert.equal(await store.get('k'), 'old-pass')
    assert.deepEqual(calls, ['plain.get k', 'secure.get k'])
    /* Nothing kept reads as nothing. */
    assert.equal(await store.get('other'), null)

    /* A write: out of the ordinary storage FIRST, then into the secure one. */
    calls.length = 0
    await store.set('k', 'new-pass')
    assert.deepEqual(calls, ['plain.remove k', 'secure.set k=new-pass'])
    assert.equal(await store.get('k'), 'new-pass')
    assert.equal(plain.kept.size, 0)

    /* Signed out: gone from both. */
    plain.kept.set('k', 'stray')
    await store.remove('k')
    assert.equal(secure.kept.has('k'), false)
    assert.equal(plain.kept.has('k'), false)
    assert.equal(await store.get('k'), null)
    assert.deepEqual(said, [], 'something was written to the log when nothing went wrong')
  })

  test('tone3000 in the app: a secure storage that refuses a write leaves the pass working in the ordinary storage, and never an older one on top', async () => {
    const { movingStore } = await keepLib()
    const calls = []
    const said = []
    let refuse = true
    const plain = box('plain', calls)
    const secure = box('secure', calls, { failSet: () => refuse, failRemove: () => refuse })
    const store = movingStore({ secure, plain, log: (l) => said.push(l) })

    /* The secure storage holds an older pass and will neither take the new one nor let go of the old. */
    secure.kept.set('k', 'older')
    await store.set('k', 'newer')
    assert.equal(plain.kept.get('k'), 'newer')
    assert.equal(secure.kept.get('k'), 'older')
    /* What is read is the newer one: the ordinary storage is read first, because whatever is there is the newest. */
    assert.equal(await store.get('k'), 'newer')
    assert.equal(await store.get('k'), 'newer')
    /* The write went to the ordinary storage BEFORE the secure one was asked to let go: stopped between the two, the newer pass is kept, never nothing. */
    assert.deepEqual(calls.slice(0, 4), ['plain.remove k', 'secure.set k=newer', 'plain.set k=newer', 'secure.remove k'])
    /* Signing out over a storage that will not let go fails, AND leaves the newer pass where it is: taking it out would leave the older one to be read from here on. */
    await assert.rejects(store.remove('k'), /secure would not let go of k/)
    assert.equal(plain.kept.get('k'), 'newer', 'a refused sign-out threw away the newest pass and left the older one')
    assert.equal(await store.get('k'), 'newer')
    /* Said once, with the storage's own words and never the pass. */
    assert.equal(said.length, 1)
    assert.match(said[0], /^the secure storage would not take TONE3000’s sign-in, so it stays in the ordinary storage: secure would not take k$/)
    assert.ok(!said.join(' ').includes('newer') && !said.join(' ').includes('older'), 'a pass was written to the log')

    /* The storage comes right: the next read moves it, and the older one is gone. */
    refuse = false
    assert.equal(await store.get('k'), 'newer')
    assert.equal(secure.kept.get('k'), 'newer')
    assert.equal(plain.kept.has('k'), false)

    /* A secure storage that refuses the write but will let go: the older pass is taken out of it, so it holds nothing stale. */
    const callsB = []
    const plainB = box('plain', callsB)
    const secureB = box('secure', callsB, { failSet: () => true })
    const storeB = movingStore({ secure: secureB, plain: plainB })
    secureB.kept.set('k', 'older')
    await storeB.set('k', 'newer')
    assert.equal(secureB.kept.has('k'), false, 'the older pass was left in the secure storage under a newer one')
    assert.equal(plainB.kept.get('k'), 'newer')
    assert.equal(await storeB.get('k'), 'newer')
    /* And when the ordinary storage will not take it either, the write fails with the older pass still kept: never with nothing. */
    const plainC = box('plain', [], { failSet: () => true })
    const secureC = box('secure', [], { failSet: () => true })
    const storeC = movingStore({ secure: secureC, plain: plainC })
    secureC.kept.set('k', 'older')
    await assert.rejects(storeC.set('k', 'newer'), /plain would not take k/)
    assert.equal(secureC.kept.get('k'), 'older', 'a write that failed everywhere left nothing kept at all')

    /* A pass that came from before the build and will not move stays where it is, readable, every time. */
    const calls2 = []
    const plain2 = box('plain', calls2)
    const secure2 = box('secure', calls2, { failSet: () => true })
    const store2 = movingStore({ secure: secure2, plain: plain2 })
    plain2.kept.set('k', 'from-before')
    assert.equal(await store2.get('k'), 'from-before')
    assert.equal(await store2.get('k'), 'from-before')
    assert.equal(plain2.kept.get('k'), 'from-before')

    /* A read the secure storage refuses is a failure, not "nothing kept" (lib/tone3000 turns it into "not signed in" for now; the pass is still there). */
    const secure3 = box('secure', [], { failGet: () => true })
    const store3 = movingStore({ secure: secure3, plain: box('plain', []) })
    await assert.rejects(store3.get('k'), /secure would not read k/)

    /* Signing out over a secure storage that will not let go says so: never "signed out" with the pass still there. The ordinary one is not touched, so what is read afterwards is what was read before. */
    const calls4 = []
    const plain4 = box('plain', calls4)
    const secure4 = box('secure', calls4, { failRemove: () => true })
    const store4 = movingStore({ secure: secure4, plain: plain4 })
    plain4.kept.set('k', 'x')
    secure4.kept.set('k', 'y')
    await assert.rejects(store4.remove('k'), /secure would not let go of k/)
    assert.deepEqual(calls4, ['secure.remove k'])
    assert.equal(plain4.kept.get('k'), 'x')
    assert.equal(await store4.get('k'), 'x')

    /* An ordinary storage that will not let go, at the start of a write, fails the write with nothing changed. */
    const plain5 = box('plain', [], { failRemove: () => true })
    const secure5 = box('secure', [])
    const store5 = movingStore({ secure: secure5, plain: plain5 })
    plain5.kept.set('k', 'was')
    await assert.rejects(store5.set('k', 'next'), /plain would not let go of k/)
    assert.equal(plain5.kept.get('k'), 'was')
    assert.equal(secure5.kept.has('k'), false)
    /* And after a move it is in both, the same in each, and still read. */
    assert.equal(await store5.get('k'), 'was')
    assert.equal(secure5.kept.get('k'), 'was')
  })

  test('tone3000 in the app: a read that is moving the pass and a write of a newer one do not cross', async () => {
    const { movingStore } = await keepLib()
    const calls = []
    const plain = box('plain', calls, { slow: 5 })
    const secure = box('secure', calls, { slow: 5 })
    const store = movingStore({ secure, plain })
    plain.kept.set('k', 'old')
    /* Both asked at once: the read starts moving "old" while the write of "new" is already waiting. */
    const reading = store.get('k')
    const writing = store.set('k', 'new')
    const again = store.get('k')
    assert.equal(await reading, 'old')
    await writing
    assert.equal(await again, 'new')
    assert.equal(secure.kept.get('k'), 'new', 'the older pass landed on top of the newer one')
    assert.equal(plain.kept.has('k'), false)
    /* One at a time for the name: the write's first call comes after the read's last. */
    assert.deepEqual(calls, ['plain.get k', 'secure.set k=old', 'plain.remove k', 'plain.remove k', 'secure.set k=new', 'plain.get k', 'secure.get k'])
    /* Another name does not wait for this one. */
    calls.length = 0
    const a = store.set('a', '1')
    const b = store.set('b', '2')
    await Promise.all([a, b])
    assert.deepEqual(calls.slice(0, 2), ['plain.remove a', 'plain.remove b'])
    /* A failure does not jam the name for whoever is next. */
    const plain2 = box('plain', [], { failRemove: (k) => k === 'k' })
    const store2 = movingStore({ secure: box('secure', []), plain: plain2 })
    await assert.rejects(store2.set('k', 'x'))
    assert.equal(await store2.get('k'), null)
  })

  test('tone3000 in the app: the one-time word comes from the phone’s secure random numbers, and from the old source when those fail or do nothing', async () => {
    const { sureRandom } = await keepLib()
    const spare = (count) => Array.from({ length: count }, (_, i) => 200 + (i % 50))
    /* No secure source in this copy: the old one itself, not a wrapper round it. */
    assert.equal(sureRandom(null, spare), spare)
    assert.equal(sureRandom(undefined, spare), spare)

    /* A source that fills what it is handed and hands it back (expo-crypto's getRandomValues). */
    const said = []
    let fills = 0
    const good = sureRandom(
      (bytes) => {
        fills++
        for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7 + 3) & 0xff
        return bytes
      },
      spare,
      (l) => said.push(l)
    )
    const got = good(32)
    assert.ok(Array.isArray(got), 'the one-time word’s bytes are a plain list (base64url takes one)')
    assert.equal(got.length, 32)
    assert.deepEqual(got.slice(0, 4), [3, 10, 17, 24])
    assert.equal(fills, 1)
    /* One that fills in place and hands back nothing is the same. */
    const quiet = sureRandom((bytes) => void bytes.fill(9), spare)
    assert.deepEqual(quiet(16), new Array(16).fill(9))

    /* One that throws, one that does nothing at all, and one that hands back the wrong amount: the old source, said once. */
    const bad = sureRandom(
      () => {
        throw new Error('no entropy')
      },
      spare,
      (l) => said.push(l)
    )
    assert.deepEqual(bad(16), spare(16))
    assert.deepEqual(bad(32), spare(32))
    assert.deepEqual(said, ['the phone’s secure random numbers were not used: no entropy'])
    const idle = sureRandom((bytes) => bytes, spare, (l) => said.push(l))
    assert.deepEqual(idle(32), spare(32), 'a source that left every byte at nought made the one-time word')
    assert.match(said[1], /all nought/)
    const short = sureRandom(() => new Uint8Array(4), spare)
    assert.deepEqual(short(16), spare(16))
    /* A few noughts are only noughts: seven asked for and seven noughts back is taken as it is. */
    assert.deepEqual(sureRandom((bytes) => bytes, spare)(7), new Array(7).fill(0))
  })

  test('tone3000 in the app: a sign-in kept before the build is still a sign-in after it, in the secure storage', async () => {
    const { movingStore, sureRandom } = await keepLib()
    const { tone3000, randomBytes, readCallback, T3K_PENDING_KEY, T3K_TOKENS_KEY } = await lib()
    const calls = []
    const plain = box('plain', calls)
    const secure = box('secure', calls)
    /* What the copy before the build left: a pass in the ordinary storage. */
    plain.kept.set(T3K_TOKENS_KEY, JSON.stringify({ access: 'a-1', refresh: 'r-1', until: 9_000_000 }))
    const opened = []
    let n = 0
    const fetch = async (url, init = {}) => {
      if (url === 'https://www.tone3000.com/api/v1/oauth/token') return { ok: true, status: 200, json: async () => ({ access_token: 'a-2', refresh_token: 'r-2', expires_in: 3600 }) }
      assert.equal(init.headers?.Authorization, 'Bearer a-1')
      return { ok: true, status: 200, json: async () => ({ id: 42, title: 'Plexi' }) }
    }
    const t3k = tone3000({
      fetch,
      store: movingStore({ secure, plain }),
      open: async (u) => void opened.push(u),
      now: () => 1_000_000,
      random: sureRandom((bytes) => {
        for (let i = 0; i < bytes.length; i++) bytes[i] = (n++ * 37 + 11) & 0xff
        return bytes
      }, randomBytes)
    })
    assert.equal(await t3k.signedIn(), true, 'the app update signed him out of TONE3000')
    assert.equal(plain.kept.has(T3K_TOKENS_KEY), false)
    assert.equal(JSON.parse(secure.kept.get(T3K_TOKENS_KEY)).access, 'a-1')
    assert.equal((await t3k.tone(42)).title, 'Plexi')

    /* A new sign-in: what is kept for the return, and the pass, go to the secure storage and never the ordinary one. */
    const url = await t3k.start()
    assert.equal(opened[0], url)
    assert.ok(secure.kept.has(T3K_PENDING_KEY))
    assert.equal(plain.kept.size, 0)
    const state = new URL(url).searchParams.get('state')
    const done = await t3k.finish(`fractalremote://tone3000?code=c&state=${state}&tone_id=42`)
    assert.deepEqual(done, { ok: true, toneId: '42', canceled: false })
    assert.equal(JSON.parse(secure.kept.get(T3K_TOKENS_KEY)).access, 'a-2')
    assert.equal(secure.kept.has(T3K_PENDING_KEY), false)
    assert.equal(plain.kept.size, 0, 'something of the sign-in was written to the ordinary storage')
    assert.ok(readCallback(`fractalremote://tone3000?code=c&state=${state}`))
    await t3k.signOut()
    assert.equal(secure.kept.size, 0)
    assert.equal(await t3k.signedIn(), false)

    /*
     * A return that comes in while the device will not read what it kept
     * for the sign-in is a FAILURE, thrown to the card, which says so. It
     * used to read as "no sign-in waiting", which shows nothing at all: the
     * page closed, and no tone, no fault. What was kept is still there, so
     * the same return finishes once the device reads again.
     */
    let refuseRead = false
    const secure2 = box('secure', [], { failGet: (k) => refuseRead && k === T3K_PENDING_KEY })
    const t3k2 = tone3000({ fetch, store: movingStore({ secure: secure2, plain: box('plain', []) }), open: async () => {}, now: () => 1_000_000, random: (count) => Array.from({ length: count }, (_, i) => (i * 13 + 5) & 0xff) })
    const url2 = await t3k2.start()
    const back2 = `fractalremote://tone3000?code=c&state=${new URL(url2).searchParams.get('state')}&tone_id=7`
    refuseRead = true
    await assert.rejects(t3k2.finish(back2), /secure would not read fractal\.tone3000\.pending/)
    assert.ok(secure2.kept.has(T3K_PENDING_KEY), 'a return that could not be read used up the sign-in')
    refuseRead = false
    assert.deepEqual(await t3k2.finish(back2), { ok: true, toneId: '7', canceled: false })
    /* A link that is not TONE3000's is still nobody's business, read or no read. */
    refuseRead = true
    assert.equal(await t3k2.finish('fractalremote://next'), null)
    /* Whether a pass is kept still reads a refused read as "not signed in" for now, and does not throw at the card when it is first drawn. */
    const secure3b = box('secure', [], { failGet: () => true })
    const t3k3 = tone3000({ fetch, store: movingStore({ secure: secure3b, plain: box('plain', []) }), open: async () => {} })
    assert.equal(await t3k3.signedIn(), false)
  })

  test('tone3000 in the app: the three native packages are asked for in one file, each inside a try of its own, and nowhere else', () => {
    const parts = code(read('mobile/src/lib/tone3000Parts.js'))
    /* Three tries, one package in each: one that is missing must not take the others with it. */
    const tries = parts.match(/try \{[\s\S]*?\} catch \{[\s\S]*?\}/g) || []
    assert.equal(tries.length, 3)
    const asked = tries.map((t) => (t.match(/require\('([^']+)'\)/g) || []).map((r) => r.slice(9, -2)))
    assert.deepEqual(asked, [['react-native-webview'], ['expo-secure-store'], ['expo-crypto']])
    /* Asked for with require inside the try, never import: a package that is not installed cannot be imported, and the app would not bundle. */
    assert.ok(!/^\s*import\b/m.test(parts), 'lib/tone3000Parts imports something: every copy without the package stops bundling')
    assert.equal((parts.match(/\brequire\(/g) || []).length, 3)
    /* And `require` is never anything but those three calls: the bundler rewrites the call, and a bare `require` is a name the phone does not have. */
    assert.equal((parts.match(/\brequire\b/g) || []).length, 3)
    assert.match(parts, /export \{ WebView, SecureStore, Crypto \}/)
    /* Each starts as nothing, and a piece that is there but not what was expected is nothing too. */
    assert.match(parts, /let WebView = null\nlet SecureStore = null\nlet Crypto = null/)
    assert.match(flat(parts), /SecureStore = typeof got\?\.getItemAsync === 'function' && typeof got\?\.setItemAsync === 'function' && typeof got\?\.deleteItemAsync === 'function' \? got : null/)
    assert.match(flat(parts), /Crypto = typeof got\?\.getRandomValues === 'function' \? got : null/)

    /* Nothing else in the phone app names the three, by import or by require. */
    const files = [...phoneFiles(), 'mobile/App.js', 'mobile/index.js'].filter((p) => p !== 'mobile/src/lib/tone3000Parts.js' && there(p))
    assert.ok(files.length > 100, 'the phone app’s files were not found')
    for (const p of files) {
      const src = code(read(p))
      for (const name of Object.keys(PARTS)) {
        assert.ok(!new RegExp(`(from|require\\()\\s*['"]${name}(/[^'"]*)?['"]`).test(src), `${p} asks for ${name} itself: on a copy built without it the app would not start`)
      }
    }
    /* The pieces are handed on by that one file to the bindings and the page, and to nothing else. */
    const users = files.filter((p) => /from '\.\.?\/(lib\/)?tone3000Parts'/.test(read(p))).sort()
    assert.deepEqual(users, ['mobile/src/components/Tone3000Page.js', 'mobile/src/lib/tone3000Here.js'])
  })

  test('tone3000 in the app: the bindings use each piece where it came and the old way where it did not', () => {
    const here = flat(code(read('mobile/src/lib/tone3000Here.js')))
    /* The pass: the secure storage when there is one, moved by lib/tone3000Keep; on this device only. */
    assert.match(here, /const KEPT = SecureStore && SecureStore\.WHEN_UNLOCKED_THIS_DEVICE_ONLY != null \? \{ keychainAccessible: SecureStore\.WHEN_UNLOCKED_THIS_DEVICE_ONLY \} : \{\}/)
    assert.match(here, /const secure = SecureStore \? \{ get: \(key\) => SecureStore\.getItemAsync\(key, KEPT\), set: \(key, value\) => SecureStore\.setItemAsync\(key, value, KEPT\), remove: \(key\) => SecureStore\.deleteItemAsync\(key, KEPT\) \} : null/)
    assert.match(here, /store: movingStore\(\{ secure, plain, log: said \}\)/)
    /* Never Face ID or a passcode prompt over it: the app has no sentence for one, and the patch tells the build so. */
    assert.ok(!/requireAuthentication|authenticationPrompt/.test(here))
    /* The one-time word. */
    assert.match(here, /random: sureRandom\(Crypto \? \(bytes\) => Crypto\.getRandomValues\(bytes\) : null, randomBytes, said\)/)
    /* The page: inside the app only with the web view AND somebody drawing it, and never when the browser was asked for. */
    assert.match(here, /export const pageInApp = \(\) => !!WebView/)
    assert.match(here, /export function hostPage\(show\) \{ host = show return \(\) => \{ if \(host === show\) host = null \} \}/)
    assert.match(here, /export async function startOutside\(\) \{ outside = true try \{ return await t3k\.start\(\) \} finally \{ outside = false \} \}/)
  })

  test('tone3000 in the app: the two names the sign-in is kept under are names the secure storage takes', async () => {
    /* It takes letters, digits, ".", "-" and "_" and throws "Invalid key" at anything else (expo-secure-store, isValidKey): a name with a ":" or a "/" in it would fail every read and write on a copy that has the package. The app's own two, as it has them. */
    const { T3K_PENDING_KEY, T3K_TOKENS_KEY } = await lib()
    for (const key of [T3K_PENDING_KEY, T3K_TOKENS_KEY]) assert.match(key, /^[\w.-]+$/, `${key} is not a name the secure storage takes`)
    assert.notEqual(T3K_PENDING_KEY, T3K_TOKENS_KEY)
    /* And the bindings hand the secure storage the name as it is, with nothing put in front of it. */
    const here = flat(code(read('mobile/src/lib/tone3000Here.js')))
    assert.match(here, /get: \(key\) => SecureStore\.getItemAsync\(key, KEPT\)/)
  })

  test('tone3000 in the app: the page is TONE3000’s example’s web view, draws nothing without the piece, and runs nothing of the app’s inside TONE3000’s page', () => {
    const raw = read('mobile/src/components/Tone3000Page.js')
    const src = flat(code(raw))
    /* Nothing at all on a copy built without the web view (after the hooks, which run the same either way). */
    assert.match(src, /if \(!WebView\) return null/)
    assert.ok(src.indexOf('if (!WebView) return null') > src.indexOf('useEffect('), 'the page leaves before its hooks have run')
    /* Their example's settings (react-native/src/t3k/auth.tsx), and the two their iPhone and Android examples set that it leaves out. */
    assert.match(src, /source=\{\{ uri: url \}\}/)
    assert.match(src, /originWhitelist=\{ORIGINS\}/)
    assert.match(src, /const ORIGINS = pageOrigins\(\)/)
    assert.match(src, /onShouldStartLoadWithRequest=\{\(request\) => flow\.mayLoad\(request\?\.url\)\}/)
    assert.match(src, /onHttpError=\{\(event\) => flow\.httpError\(event\?\.nativeEvent\?\.statusCode, event\?\.nativeEvent\?\.url\)\}/)
    assert.match(src, /onError=\{\(event\) => flow\.loadError\(event\?\.nativeEvent\?\.url\)\}/)
    assert.match(src, /startInLoadingState/)
    assert.match(src, /setSupportMultipleWindows=\{false\}/)
    assert.match(src, /allowsInlineMediaPlayback/)
    assert.match(src, /mediaPlaybackRequiresUserAction=\{false\}/)
    /* A new page of rules for each page shown, so one showing's ending cannot end the next. */
    assert.match(src, /const flow = useMemo\( \(\) => pageFlow\(\{[^}]*\}\), \[url\] \)/)
    /* The sign-in is kept between showings: never a private window, never the store wiped. */
    assert.ok(!/incognito|cacheEnabled=\{false\}|clearCache|clearCookies/.test(src))
    /* TONE3000's page is TONE3000's: the app puts no code into it, reads nothing out of it, and is not named to it as anything but the web view it is. */
    assert.ok(!/injectedJavaScript|injectJavaScript|onMessage|postMessage|userAgent|applicationNameForUserAgent|sharedCookiesEnabled/.test(src), 'the app reaches into TONE3000’s page')
    /* Its name across the top and a Close that is a button of the app's own height, said aloud as what it closes. */
    assert.match(src, /\{T3K_PAGE_TITLE\}/)
    assert.match(src, /accessibilityLabel=\{`\$\{T3K_PAGE_CLOSE\} \$\{T3K_PAGE_TITLE\}`\}/)
    assert.match(src, /minHeight: TAP/)
    /* Android's Back goes back a page and closes from the first; an iPhone's sheet dragged away closes. */
    assert.match(src, /const out = \(\) => \{ if \(Platform\.OS === 'android' && canGoBack\.current\) \{ web\.current\?\.goBack\?\.\(\) return \} flow\.close\(\) \}/)
    assert.match(src, /onRequestClose=\{out\}/)

    const card = flat(code(read('mobile/src/components/Tone3000Test.js')))
    /* The card is where the page is drawn while it is up, and stops being when it goes. */
    assert.match(card, /const unhost = hostPage\(\(url\) => alive\.current && setPage\(url\)\)/)
    assert.match(card, /return \(\) => \{ alive\.current = false stop\(\) unhost\(\) \}/)
    /* One return is finished once, whichever way it came, and the page closes for it either way. */
    assert.match(card, /const returned = async \(url\) => \{ if \(!readCallback\(url\) \|\| url === lastReturn\.current\) return lastReturn\.current = url if \(!alive\.current\) return setPage\(null\)/)
    assert.match(card, /const stop = onTone3000Return\(returned\)/)
    /* A return that could not be finished on the device may be handed over again, and says so on the card. */
    assert.match(card, /catch \(err\) \{ logDebug\('tone3000', `the return was not finished: \$\{err\?\.message \|\| err\}`\) lastReturn\.current = null if \(alive\.current\) setFault\(/)
    assert.match(card, /<Tone3000Page url=\{page\} onReturn=\{returned\}/)
    /* The number TONE3000 answered with is written to the log, and only there. */
    assert.match(card, /onFault=\{\(why, status\) => \{ logDebug\('tone3000', `TONE3000’s page was closed: \$\{why\}\$\{status \? ` It answered \$\{status\}\.` : ''\}`\)/)
    assert.match(src, /onFault: \(why, status\) => told\.current\.onFault\?\.\(why, status\)/)
    /* Browse is never handed the tap itself, which would read as "in the browser". */
    assert.match(card, /onPress=\{\(\) => browse\(\)\}/)
    assert.ok(!/onPress=\{browse\}/.test(card))
    assert.match(card, /await \(outside === true \? startOutside\(\) : t3k\.start\(\)\)/)
    /* The browser is offered beside it only where the page inside the app exists: every copy today shows the card as it was. */
    assert.match(card, /\{pageInApp\(\) \? <Press label=\{BROWSE_OUTSIDE\} sub=\{BROWSE_OUTSIDE_SUB\} height=\{40\} disabled=\{!!busy\} onPress=\{\(\) => browse\(true\)\} \/> : null\}/)
    /* A send that is going keeps its own word on the buttons when a return comes in under it. */
    assert.match(card, /setBusy\(\(was\) => \(was === null \|\| was === 'open' \? 'back' : was\)\)/)
    assert.match(card, /setBusy\(\(was\) => \(was === 'back' \? null : was\)\)/)
    assert.match(card, /setBusy\(\(was\) => \(was === 'open' \? null : was\)\)/)
  })

  test('tone3000 in the app: the app lists the three packages only once the waiting patch is in, at the versions it asks for', () => {
    const waiting = there(PATCH)
    /* The same question test/mobile.mjs asks of every waiting patch: web.yml's second run has them all applied. */
    const applied = Boolean(process.env.PENDING_APPLIED)
    const expected = !waiting || applied
    const pkg = JSON.parse(read('mobile/package.json'))
    const lock = JSON.parse(read('mobile/package-lock.json'))
    const plugins = JSON.parse(read('mobile/app.json')).expo.plugins

    for (const [name, range] of Object.entries(PARTS)) {
      if (expected) {
        assert.equal(pkg.dependencies[name], range, `${name} is not at the version the patch asked for. The app talks to these three by their own front doors (lib/tone3000Parts); a new version means reading its notes first`)
        assert.equal(lock.packages[''].dependencies[name], range)
        assert.ok(lock.packages[`node_modules/${name}`], `${name} is in package.json and not in the lock file`)
      } else {
        assert.equal(pkg.dependencies[name], undefined, `${name} is a native package: that is a build, and it waits in ${PATCH}`)
        assert.equal(lock.packages[`node_modules/${name}`], undefined)
      }
    }
    /*
     * THE SECURE STORAGE'S PLUGIN IS NEVER LISTED IN app.json, with the
     * patch or without. The package works without it. Listed, it does two
     * things by default, and both are wrong for this app:
     *   - it writes a Face ID sentence into the iPhone app, which never asks
     *     for Face ID (a question from App Review);
     *   - it gives the Android app backup rules that back up the app's
     *     settings file and NOTHING ELSE. Android backs up everything unless
     *     a rule names something to include, and from then on only what is
     *     named. The app's own sign-in, setlists and settings are kept in a
     *     database, which those rules do not name: every Android customer
     *     moving to a new phone would have lost them.
     * The first cut of the patch listed it, with the Face ID half switched
     * off. A reviewer read the plugin's rule files (14 November 2026).
     */
    const listed = plugins.filter((p) => p === 'expo-secure-store' || (Array.isArray(p) && p[0] === 'expo-secure-store'))
    assert.deepEqual(listed, [], 'expo-secure-store’s plugin is listed in app.json: by default it stops Android backing up the app’s sign-in, setlists and settings, and gives the iPhone app a Face ID sentence')
    /* And nothing else gives the Android app backup rules of its own: it backs up everything, as it always has. */
    assert.ok(!/allowBackup|fullBackupContent|dataExtractionRules/.test(read('mobile/app.json')))
    /* Never the phone's in-app browser or its sign-in sheet, patch or no patch: TONE3000's examples use a web view, and say why. */
    for (const name of ['expo-web-browser', 'expo-auth-session']) assert.equal(pkg.dependencies[name], undefined)

    /* Whichever version is installed where this runs is the one asked for (a checkout without the phone's packages has nothing to read). */
    for (const [name, range] of Object.entries(PARTS)) {
      const at = `mobile/node_modules/${name}/package.json`
      if (!expected || !there(at)) continue
      const version = JSON.parse(read(at)).version
      assert.ok(range.startsWith('~') ? version.startsWith(range.slice(1, range.lastIndexOf('.') + 1)) : version === range, `${name} ${version} is installed, and ${range} was asked for`)
    }
  })

  test('tone3000 in the app: the waiting patch is three packages and nothing else, written so phone-turns and it can both be in', () => {
    if (!there(PATCH)) return
    const patch = read(PATCH)
    /* Nothing of the app's own code: that is in the tree already, so the patch never has to be remade because the card changed. */
    /* And nothing in app.json: no plugin, no setting, no permission (the test above has why the secure storage's plugin stays out). */
    assert.deepEqual(
      (patch.match(/^diff --git a\/(\S+) /gm) || []).map((l) => l.slice(13, -1)),
      ['mobile/package-lock.json', 'mobile/package.json']
    )
    const added = (patch.match(/^\+(?!\+\+).*$/gm) || []).map((l) => l.slice(1))
    const removed = (patch.match(/^-(?!--).*$/gm) || []).map((l) => l.slice(1))
    /* Each package once in package.json and once in the lock's own list, at its version. */
    for (const [name, range] of Object.entries(PARTS)) {
      const lines = added.filter((l) => l.trim().replace(/,$/, '') === `"${name}": "${range}"`)
      assert.equal(lines.length, 2, `${name} ${range} is not added to package.json and to the lock’s list`)
      assert.equal(added.filter((l) => l.trim() === `"node_modules/${name}": {`).length, 1)
    }
    /* All it takes out is the comma-less last line of each list, put back with its comma. */
    assert.deepEqual(removed.map((l) => l.trim()), ['"react-native-url-polyfill": "^4.0.0"', '"react-native-url-polyfill": "^4.0.0"'])
    assert.equal(added.filter((l) => l.trim() === '"react-native-url-polyfill": "^4.0.0",').length, 2)
    /* No install script comes with any of the three: what npm runs at install is still only this app's own patch-package. */
    assert.ok(!added.some((l) => /"hasInstallScript"/.test(l)), 'the patch adds a hasInstallScript line: phone-turns adds the same one to the same place, and the two then cannot both apply')
    /*
     * BY HAND, and to be done again if the patch is remade from a tree npm
     * has written: expo-secure-store's place by the alphabet is the line
     * under expo-keep-awake, which is where phone-turns puts
     * expo-screen-orientation, and its block in the lock file belongs just
     * before expo-server's, which is where phone-turns puts its own. A line
     * of this patch's between phone-turns' lines and phone-turns can no
     * longer be told to be in the tree (test/mobile.mjs has the day it
     * happened). So the secure storage's lines ride directly under
     * expo-crypto's, in package.json, in the lock's list and in its blocks.
     * The order of those lists means nothing to npm, which reads them by
     * name; it writes them back by the alphabet the next time it installs.
     */
    assert.ok(!patch.includes('expo-keep-awake'), 'a hunk touches expo-keep-awake’s line: that is inside phone-turns’ own lines')
    assert.ok(!patch.includes('"node_modules/expo-server"'), 'a hunk touches expo-server’s block in the lock file: that is inside phone-turns’ own lines')
    assert.equal((patch.match(/^\+\s+"expo-crypto": "~57\.0\.4",\n\+\s+"expo-secure-store": "~57\.0\.4",$/gm) || []).length, 2)
    assert.match(patch, /^\+ {4}"node_modules\/expo-crypto": \{\n(\+[^\n]*\n){7}\+ {4}\},\n\+ {4}"node_modules\/expo-secure-store": \{$/m)

    /* The README says what it is and what it moves: both phones, so a build pair. */
    const readme = read('docs/pending/README.md')
    assert.match(readme, /^\| `tone3000-in-app\.patch` \|.*react-native-webview, expo-secure-store and expo-crypto.*\| \*\*android and ios\*\* \(the watch line does not move\) \|$/m)
    assert.ok(readme.includes('**tone3000-in-app.patch, and why it waits.**'))
  })
}
