/**
 * TONE3000, FIRST PIECE (mobile/src/lib/sha256.js, tone3000.js,
 * tone3000Here.js, nam-file.js, components/Tone3000Test.js).
 *
 * "Next I want to add TONE3000 so users can search, preview and download
 * tones for the NAM block directly in the app." (Justin, 13 November 2026.)
 * Signing in and picking on TONE3000's own page, the tone and its captures,
 * and a capture fetched and counted. His account's, on the Developer pages.
 * Nothing here sends anything to a unit.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

const sha = () => import('../mobile/src/lib/sha256.js')
const lib = () => import('../mobile/src/lib/tone3000.js')
const nam = () => import('../mobile/src/lib/nam-file.js')

/** A pretend TONE3000 and a pretend device: what was asked, in order, and what is kept. */
function world({ expires = 3600 } = {}) {
  const kept = new Map()
  const asked = []
  const opened = []
  let clock = 1_000_000
  let serial = 0
  const state = { tokenStatus: 200, apiStatus: null, refreshes: 0, validAccess: new Set() }
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) })
  const fetch = async (url, init = {}) => {
    asked.push({ url, method: init.method || 'GET', body: init.body || null, auth: init.headers?.Authorization || null })
    if (url === 'https://www.tone3000.com/api/v1/oauth/token') {
      if (state.tokenStatus !== 200) return json(state.tokenStatus, { error: 'invalid_grant' })
      const form = Object.fromEntries(String(init.body).split('&').map((p) => p.split('=').map(decodeURIComponent)))
      if (form.grant_type === 'refresh_token') state.refreshes++
      const access = `access-${++serial}`
      state.validAccess = new Set([access])
      return json(200, { access_token: access, refresh_token: `refresh-${serial}`, expires_in: expires })
    }
    if (state.apiStatus) return json(state.apiStatus, {})
    if (!state.validAccess.has(String(init.headers?.Authorization || '').replace('Bearer ', ''))) return json(401, {})
    if (url.startsWith('https://www.tone3000.com/api/v1/tones/42')) return json(200, { id: 42, title: 'Plexi Crunch', license: 'cc-by', user: { username: 'ampguy' } })
    if (url.startsWith('https://www.tone3000.com/api/v1/models?')) {
      return json(200, { data: [{ id: 7, name: 'Crunch', size: 'standard', architecture_version: '2', model_url: 'https://www.tone3000.com/api/v1/models/7/file' }, { id: 8, name: 'No address' }] })
    }
    if (url === 'https://www.tone3000.com/api/v1/models/7/file') return json(200, '{"architecture":"WaveNet","weights":[1,2,3]}')
    return json(404, {})
  }
  const store = { get: async (k) => kept.get(k) ?? null, set: async (k, v) => void kept.set(k, v), remove: async (k) => void kept.delete(k) }
  let n = 0
  const random = (count) => Array.from({ length: count }, () => (n++ * 37 + 11) & 0xff)
  return { kept, asked, opened, state, fetch, store, random, open: async (u) => void opened.push(u), now: () => clock, tick: (ms) => (clock += ms) }
}

const queryOfUrl = (u) => Object.fromEntries(u.slice(u.indexOf('?') + 1).split('&').map((p) => p.split('=').map(decodeURIComponent)))

export function run(test) {
  test('tone3000: SHA-256 and web-address base64 are the standards’ own, to the letter', async () => {
    const s = await sha()
    /* FIPS 180-2's examples. */
    assert.equal(s.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    assert.equal(s.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    assert.equal(s.sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
    /* And against the machine's own, over every length that crosses a block's edge, and text that is not plain ASCII. */
    for (let len = 0; len <= 130; len++) {
      const text = 'x'.repeat(len)
      assert.equal(s.sha256Hex(text), createHash('sha256').update(text).digest('hex'), `length ${len}`)
    }
    for (const text of ['Justin’s AX3 — “TONE3000”', 'ñandú 🎸 amp', '\u0000\u007f\u0080߿ࠀ￿']) {
      assert.equal(s.sha256Hex(text), createHash('sha256').update(text, 'utf8').digest('hex'), text)
    }
    /* RFC 4648's examples, in the web-address alphabet and with no padding. */
    const b = (t) => s.base64url([...Buffer.from(t)])
    assert.deepEqual(['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar'].map(b), ['', 'Zg', 'Zm8', 'Zm9v', 'Zm9vYg', 'Zm9vYmE', 'Zm9vYmFy'])
    assert.equal(s.base64url([0xfb, 0xff, 0xfe]), '-__-')
    for (let len = 0; len < 40; len++) {
      const bytes = Array.from({ length: len }, (_, i) => (i * 73 + len) & 0xff)
      assert.equal(s.base64url(bytes), Buffer.from(bytes).toString('base64url'), `length ${len}`)
    }
    /* It imports nothing: it is forty lines of arithmetic. */
    assert.ok(!/\bimport\b|\brequire\(/.test(code(read('mobile/src/lib/sha256.js'))))
  })

  test('tone3000: the address that opens TONE3000’s page, and the proof it carries, are as TONE3000’s own client makes them', async () => {
    const t = await lib()
    /* RFC 7636, appendix B: the one-time word and its proof. */
    assert.equal(t.challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
    const url = t.authorizeUrl({ challenge: 'CHALLENGE', state: 'STATE' })
    assert.ok(url.startsWith('https://www.tone3000.com/api/v1/oauth/authorize?'))
    assert.deepEqual(queryOfUrl(url), {
      client_id: t.T3K_KEY,
      redirect_uri: 'fractalremote://tone3000',
      response_type: 'code',
      code_challenge: 'CHALLENGE',
      code_challenge_method: 'S256',
      state: 'STATE',
      /* The pick-a-tone page, NAM captures of the A2 kind (the Axe-Fx III's NAM block plays no other), its audition players, its own close button. */
      prompt: 'select_tone',
      format: 'nam',
      architecture: '2',
      preview: 'true',
      menubar: 'true'
    })
    /* The link is the app's own scheme, which the app is registered for; and the Siri links, the same scheme, take no notice of it. */
    assert.match(read('mobile/app.json'), /"scheme": "fractalremote"/)
    const { parseLink } = await import('../mobile/src/lib/siri-rule.js')
    assert.equal(parseLink('fractalremote://tone3000?code=abc&state=def&tone_id=42'), null)
    /* The key in the app is the publishable one, and the secret kind is nowhere in the repository's app code. */
    assert.match(t.T3K_KEY, /^t3k_pub_[A-Za-z0-9]+$/)
    for (const p of ['mobile/src/lib/tone3000.js', 'mobile/src/lib/tone3000Here.js', 'mobile/src/components/Tone3000Test.js']) {
      assert.ok(!/t3k_cs_[A-Za-z0-9]/.test(read(p)), `${p} holds a secret key`)
    }
    assert.equal(t.T3K_POWERED, 'Powered by TONE3000')
  })

  test('tone3000: what comes back is read out of the link, and only TONE3000’s own return is taken for one', async () => {
    const { readCallback } = await lib()
    assert.deepEqual(readCallback('fractalremote://tone3000?code=abc%2F1&state=s-1&tone_id=42'), { code: 'abc/1', state: 's-1', error: null, toneId: '42', canceled: false })
    assert.deepEqual(readCallback('fractalremote://tone3000?canceled=true&state=s'), { code: null, state: 's', error: null, toneId: null, canceled: true })
    assert.deepEqual(readCallback('fractalremote://tone3000?error=access_denied&state=s'), { code: null, state: 's', error: 'access_denied', toneId: null, canceled: false })
    assert.deepEqual(readCallback('fractalremote://tone3000'), { code: null, state: null, error: null, toneId: null, canceled: false })
    for (const other of ['fractalremote://next', 'fractalremote://tuner/off', 'fractalremote://tone3000x?code=1', 'https://www.tone3000.com/?code=1', '', null]) {
      assert.equal(readCallback(other), null, String(other))
    }
  })

  test('tone3000: a sign-in from start to a tone and its captures, with the pass going to TONE3000 and nowhere else', async () => {
    const t = await lib()
    const w = world()
    const c = t.tone3000(w)
    assert.equal(await c.signedIn(), false)
    const url = await c.start()
    assert.deepEqual(w.opened, [url])
    const q = queryOfUrl(url)
    const pending = JSON.parse(w.kept.get(t.T3K_PENDING_KEY))
    assert.equal(q.state, pending.state)
    assert.equal(q.code_challenge, t.challengeOf(pending.verifier), 'the proof sent is not of the word kept')
    assert.ok(pending.verifier.length >= 43, 'the one-time word is shorter than the standard’s least')

    const done = await c.finish(`fractalremote://tone3000?code=THE-CODE&state=${encodeURIComponent(q.state)}&tone_id=42`)
    assert.deepEqual(done, { ok: true, toneId: '42', canceled: false })
    const swap = w.asked[0]
    assert.equal(swap.url, 'https://www.tone3000.com/api/v1/oauth/token')
    assert.equal(swap.method, 'POST')
    assert.deepEqual(Object.fromEntries(swap.body.split('&').map((p) => p.split('=').map(decodeURIComponent))), {
      grant_type: 'authorization_code',
      code: 'THE-CODE',
      code_verifier: pending.verifier,
      redirect_uri: 'fractalremote://tone3000',
      client_id: t.T3K_KEY
    })
    assert.equal(await c.signedIn(), true)
    /* The one-time word is gone, so the same return a second time is nobody's. */
    assert.equal(w.kept.has(t.T3K_PENDING_KEY), false)
    assert.equal(await c.finish(`fractalremote://tone3000?code=THE-CODE&state=${encodeURIComponent(q.state)}&tone_id=42`), null)

    const tone = await c.tone(42)
    assert.equal(tone.title, 'Plexi Crunch')
    assert.equal(t.toneCredit(tone), 'by ampguy · CC BY')
    assert.equal(t.toneCredit({}), 'by an unnamed creator · Licence not stated')
    /* A2 asked for by name on both (left out, TONE3000 answers with the older kind), and a capture with no address is not offered. */
    const models = await c.models(42)
    assert.deepEqual(models.map((m) => m.id), [7])
    assert.ok(w.asked.some((a) => a.url === 'https://www.tone3000.com/api/v1/tones/42?architecture=2'))
    assert.ok(w.asked.some((a) => a.url === 'https://www.tone3000.com/api/v1/models?tone_id=42&architecture=2&page_size=100'))
    assert.equal(await c.modelText(models[0]), '{"architecture":"WaveNet","weights":[1,2,3]}')
    /* Every request after the swap carried the pass, and every one went to TONE3000's own site. */
    for (const a of w.asked.slice(1)) {
      assert.equal(a.auth, 'Bearer access-1')
      assert.ok(a.url.startsWith('https://www.tone3000.com/'), a.url)
    }
    /* A capture whose address names another host is asked of TONE3000's site by its path, so the pass never leaves it. */
    const before = w.asked.length
    await c.modelText({ model_url: 'https://elsewhere.example/api/v1/models/7/file' })
    assert.equal(w.asked[before].url, 'https://www.tone3000.com/api/v1/models/7/file')
  })

  test('tone3000: a return that does not match, is late, was closed or was refused never becomes a sign-in', async () => {
    const t = await lib()
    const fresh = async () => {
      const w = world()
      const c = t.tone3000(w)
      const q = queryOfUrl(await c.start())
      return { w, c, state: q.state }
    }
    /* Somebody else's state: refused, and nothing asked of TONE3000. */
    let x = await fresh()
    let done = await x.c.finish('fractalremote://tone3000?code=C&state=not-this-one&tone_id=1')
    assert.equal(done.ok, false)
    assert.match(done.why, /doesn’t match the sign-in this device started/)
    assert.equal(x.w.asked.length, 0)
    assert.equal(await x.c.signedIn(), false)
    /* Closed before signing in. */
    x = await fresh()
    done = await x.c.finish(`fractalremote://tone3000?canceled=true&state=${x.state}`)
    assert.deepEqual(done, { ok: false, why: 'Closed without signing in.', canceled: true })
    /* Signed in, then closed without a pick: the sign-in is kept. */
    x = await fresh()
    done = await x.c.finish(`fractalremote://tone3000?canceled=true&code=C&state=${x.state}`)
    assert.deepEqual(done, { ok: true, toneId: null, canceled: true })
    assert.equal(await x.c.signedIn(), true)
    /* TONE3000's own error. */
    x = await fresh()
    done = await x.c.finish(`fractalremote://tone3000?error=access_denied&state=${x.state}`)
    assert.equal(done.why, 'TONE3000 said: access_denied.')
    /* Half an hour on. */
    x = await fresh()
    x.w.tick(t.T3K_PENDING_MS + 1)
    done = await x.c.finish(`fractalremote://tone3000?code=C&state=${x.state}`)
    assert.match(done.why, /started too long ago/)
    assert.equal(x.w.asked.length, 0)
    /* The code refused at the swap. */
    x = await fresh()
    x.w.state.tokenStatus = 400
    done = await x.c.finish(`fractalremote://tone3000?code=C&state=${x.state}`)
    assert.equal(done.ok, false)
    assert.match(done.why, /refused the sign-in \(invalid_grant\)/)
    assert.equal(await x.c.signedIn(), false)
    /* A link that is not TONE3000's, or one with no sign-in waiting, is nobody's. */
    x = await fresh()
    assert.equal(await x.c.finish('fractalremote://next'), null)
    const w = world()
    assert.equal(await t.tone3000(w).finish('fractalremote://tone3000?code=C&state=S'), null)
  })

  test('tone3000: the pass is renewed a minute early, once at a time, once more on a 401, and a refused renewal signs out', async () => {
    const t = await lib()
    const w = world({ expires: 600 })
    const c = t.tone3000(w)
    const q = queryOfUrl(await c.start())
    await c.finish(`fractalremote://tone3000?code=C&state=${q.state}&tone_id=42`)
    await c.tone(42)
    assert.equal(w.state.refreshes, 0)
    /* Inside the last minute: renewed before the request, and two requests at once share one renewal. */
    w.tick(600_000 - t.T3K_EARLY_MS + 1)
    await Promise.all([c.tone(42), c.models(42)])
    assert.equal(w.state.refreshes, 1)
    assert.ok(w.asked.slice(-2).every((a) => a.auth === 'Bearer access-2'))
    /* A 401 with time left on the pass: renewed and asked once more. */
    w.state.validAccess = new Set()
    const asks = w.asked.length
    w.state.validAccess = new Set(['access-3'])
    await c.tone(42)
    assert.equal(w.state.refreshes, 2)
    assert.deepEqual(w.asked.slice(asks).map((a) => a.auth), ['Bearer access-2', null, 'Bearer access-3'])
    /* The renewal itself refused: the sign-in is over, and the device forgets it. */
    w.tick(600_000)
    w.state.tokenStatus = 400
    await assert.rejects(c.tone(42), /run out\. Sign in again/)
    assert.equal(await c.signedIn(), false)
    /* TONE3000 down is not the end of a sign-in. */
    const w2 = world({ expires: 600 })
    const c2 = t.tone3000(w2)
    const q2 = queryOfUrl(await c2.start())
    await c2.finish(`fractalremote://tone3000?code=C&state=${q2.state}`)
    w2.tick(600_000)
    w2.state.tokenStatus = 503
    await assert.rejects(c2.tone(42), /couldn’t renew the sign-in just now/)
    assert.equal(await c2.signedIn(), true)
    /* Too many requests, and a tone that has gone, are said in plain words. */
    const w3 = world()
    const c3 = t.tone3000(w3)
    const q3 = queryOfUrl(await c3.start())
    await c3.finish(`fractalremote://tone3000?code=C&state=${q3.state}`)
    w3.state.apiStatus = 429
    await assert.rejects(c3.tone(42), /too many requests/)
    w3.state.apiStatus = 404
    await assert.rejects(c3.tone(42), /isn’t on TONE3000 any more/)
    /* Sign out forgets both what is kept. */
    await c3.signOut()
    assert.equal(w3.kept.size, 0)
  })

  test('tone3000: a .nam file is read and counted, an A2 capture is told from the older kind, and the sizes are an estimate that says so', async () => {
    const n = await nam()
    const a2 = JSON.stringify({
      version: '0.7.0',
      architecture: 'SlimmableContainer',
      sample_rate: 48000,
      metadata: { name: ' Plexi ' },
      config: {
        submodels: [
          { max_value: 0.5, model: { architecture: 'WaveNet', config: {}, weights: Array.from({ length: 1871 }, (_, i) => i / 1871) } },
          { max_value: 1.0, model: { architecture: 'WaveNet', config: {}, weights: Array.from({ length: 12146 }, (_, i) => -i / 12146) } }
        ]
      },
      weights: []
    })
    const got = n.readNam(a2)
    assert.deepEqual(got, { ok: true, architecture: 'SlimmableContainer', version: '0.7.0', a2: true, numbers: 14017, networks: [{ numbers: 1871, share: 0.5 }, { numbers: 12146, share: 1 }], sampleRate: 48000, name: 'Plexi' })
    /* The open NAM engine's own A2 example measures the same: 14,017 numbers, 56,068 bytes at four a number, about 64 KB as MIDI. */
    assert.deepEqual(n.sendEstimate(14017), { bytes: 56068, midiBytes: 64078, dinSeconds: 21 })
    assert.equal(n.DIN_BYTES_A_SECOND, 3125)
    assert.equal(
      n.namSaid(got),
      'An A2 capture: 14,017 numbers (1,871 and 12,146). About 63 KB to send: about 21 seconds over a Bluetooth adapter, a second or two by USB. An estimate until installing is built.'
    )
    /* The older kind is read, and said to be what the NAM block does not play. */
    const a1 = n.readNam(JSON.stringify({ version: '0.5.0', architecture: 'WaveNet', config: { layers: [] }, weights: [0.1, 0.2, 0.3] }))
    assert.equal(a1.ok, true)
    assert.equal(a1.a2, false)
    assert.equal(a1.numbers, 3)
    assert.match(n.namSaid(a1), /older kind of capture \(WaveNet\)\. The Axe-Fx III’s NAM block plays A2 captures only\./)
    /* What is not a capture says so, and never throws. */
    for (const bad of ['', 'not json', '[]', '{"weights":[1]}', '{"architecture":"WaveNet","weights":[]}', '{"architecture":"WaveNet","weights":["a"]}']) {
      const r = n.readNam(bad)
      assert.equal(r.ok, false, bad)
      assert.ok(r.why.length > 10)
      assert.equal(n.namSaid(r), r.why)
    }
    /* Nothing in it builds a message for a unit: how a capture is packed is not known yet, and the file says so. */
    const src = read('mobile/src/lib/nam-file.js')
    assert.ok(!/\bimport\b|\brequire\(/.test(code(src)))
    assert.match(flat(src).replace(/ \* /g, ' '), /HOW AXE-EDIT PACKS THOSE NUMBERS FOR THE UNIT IS NOT KNOWN YET/)
    assert.ok(!/0xf0|0xF0|sysex|buildFrame|frame\(/i.test(code(src)))
  })

  test('tone3000: the card is on the Developer testing page only, sends nothing to a unit, and says whose page and whose tone it is', async () => {
    const card = read('mobile/src/components/Tone3000Test.js')
    const here = read('mobile/src/lib/tone3000Here.js')
    const settings = flat(read('mobile/src/screens/Settings.js'))
    /* Drawn once, on the Testing page, his account's. */
    assert.equal(settings.match(/<Tone3000Test \/>/g).length, 1)
    const testing = settings.slice(settings.indexOf("{head('Testing', 'back')}"), settings.indexOf("{head('Footswitches', 'back')}"))
    assert.ok(testing.includes('<Tone3000Test />'), 'the TONE3000 card is not on the Developer testing page')
    for (const p of ['mobile/App.js', 'mobile/src/screens/Edit.js', 'mobile/src/screens/Stage.js', 'mobile/src/screens/Bluetooth.js']) {
      let src = ''
      try {
        src = read(p)
      } catch {
        continue
      }
      assert.ok(!/tone3000/i.test(src), `${p} reaches TONE3000`)
    }
    /* Nothing of the unit's: no wire, no device, no Bluetooth. */
    for (const src of [card, here, read('mobile/src/lib/tone3000.js')]) {
      assert.ok(!/from '\.\.?\/(lib\/)?(device|bleWire|bluetooth|rig|link)'/.test(src), 'the TONE3000 piece imports the unit’s code')
    }
    /* TONE3000's terms: its name on it, the creator and licence with the tone, a capture fetched only on its own tap. */
    assert.match(card, /\{T3K_POWERED\}/)
    assert.match(card, /\{toneCredit\(tone\)\}/)
    assert.equal(code(card).match(/t3k\.modelText\(/g).length, 1)
    assert.match(flat(code(card)), /const check = async \(m\) => \{ if \(busy\) return setBusy\(m\.id\) setFault\(''\) try \{ const text = await t3k\.modelText\(m\)/)
    /* The pass and the one-time word are never written to the log. */
    for (const line of code(card).match(/logDebug\([^\n]*\)/g) || []) assert.ok(!/access|refresh|verifier|token|code\b/i.test(line), line)
    /* The phone's bindings: its storage, its browser, its network, and both ways a link can arrive. */
    assert.match(here, /open: \(url\) => Linking\.openURL\(url\)/)
    assert.match(here, /Linking\.addEventListener\('url'/)
    assert.match(here, /Linking\.getInitialURL\(\)/)
    /* No new package: nothing native is asked for that the build does not have. */
    const pkg = JSON.parse(read('mobile/package.json'))
    for (const name of ['expo-web-browser', 'expo-auth-session', 'expo-crypto', 'expo-secure-store', 'react-native-webview']) {
      assert.equal(pkg.dependencies[name], undefined, `${name} is a native package: that is a build`)
    }
  })
}
