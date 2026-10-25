/**
 * A SIGN-IN THAT RAN OUT WITH NO SIGNAL IS STILL A SIGN-IN, AT THE DOOR.
 *
 * "A customer at a gig with no phone signal can be locked out of the whole
 * app, Bluetooth included." The audit of 25 October 2026 found it, and it was
 * true: the sign-in kept on the phone proves who you are for an hour by the
 * account service's default, and past that hour supabase-js asks the account
 * service to renew it. With no signal there is no answer, supabase-js says
 * there is no session, and App.js drew the sign-in screen, in front of
 * somebody who had paid, driving an AM4 over Bluetooth with no computer and
 * no internet to sign in over.
 *
 * What these hold, on the phone's relay.js run against supabase-js itself:
 *
 *   - a renewal that got no answer (no signal, the twelve-second cap, the
 *     account service down) leaves the phone signed in, as the account it
 *     was, and supabase-js renews it by itself once the signal is back;
 *   - a renewal the account service turned away (the sign-in ended
 *     somewhere else, the account deleted) is nobody, the sign-in screen, as
 *     it always was;
 *   - nothing on the phone is nobody, and so is a sign-out somebody asked
 *     for, even one made with no signal, which supabase-js on its own leaves
 *     behind on the phone;
 *   - the relay itself is exactly as before: nothing that talks to the
 *     account service or the computer is let through on a sign-in that could
 *     not be renewed;
 *   - the door does not wait out supabase-js's own twenty-five seconds of
 *     retries to say so;
 *   - and App.js's launch, lifted out of the file and run, opens on the app
 *     or on the sign-in screen by that answer.
 *
 * SUPABASE-JS AS THE ROOT INSTALLS IT, which is the browser's copy (2.112.4
 * when this was written), because CI installs nothing under mobile/. The
 * phone ships its own (mobile/package-lock.json), and the four functions all
 * of this rests on — getSession's __loadSession, _callRefreshToken,
 * _recoverAndRefresh and _signOut in auth-js's GoTrueClient — were read in
 * both and are the same. The last test holds both installs to the versions
 * they were read in, so a move asks for them to be read again.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/* The real thing, by the address the root's install gives it. */
const SUPABASE = import.meta.resolve('@supabase/supabase-js')

const CUSTOMER = '0b6c7a51-8f1e-4c2a-9d3b-5e7f9a1c2d4e'

/* Where supabase-js keeps the sign-in, worked out the way it works it out: from the project's address. */
const PROJECT_URL = read('mobile/src/lib/project.js').match(/url: '([^']+)'/)[1]
const KEY = `sb-${new URL(PROJECT_URL).hostname.split('.')[0]}-auth-token`

/* A token that reads as one: realtime-js looks inside the ones it is handed. */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (sub, exp) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, exp, role: 'authenticated' })}.bench`
const nowSec = () => Math.floor(Date.now() / 1000)

/* The sign-in as supabase-js writes it to the phone: `ago` seconds past its hour, or still inside it when negative. */
const keptSignIn = ({ id = CUSTOMER, ago = 600, refresh = 'refresh-1' } = {}) =>
  JSON.stringify({
    access_token: jwt(id, nowSec() - ago),
    refresh_token: refresh,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nowSec() - ago,
    user: { id, email: 'player@example.com', aud: 'authenticated' }
  })

/*
 * The account service, and the signal between it and the phone, as the
 * phone's fetch sees them (notForever is the fetch relay.js builds the client
 * with). `net.mode`:
 *
 *   'offline'  — fetch throws, as a phone's does with no signal;
 *   'timeout'  — notForever's own twelve-second cap, said the way it says it;
 *   'down'     — a 502 page from in front of the account service;
 *   'captive'  — the question is taken and never answered (wifi with nothing
 *                behind it, before notForever's cap): it never settles;
 *   'refused'  — the account service answers, and turns the renewal away with
 *                `net.code`;
 *   'ok'       — it answers, and renews.
 *
 * Every request is written down, by method and path. And every one that gets
 * no answer costs ten seconds of the bench's clock (net.tick, see benchClock):
 * supabase-js retries a renewal for up to thirty seconds by Date.now, sleeping
 * longer between each, so it still makes its whole round of tries and the
 * runner waits well under a second for them.
 */
const NET = `
  export const net = { mode: 'offline', code: 'refresh_token_not_found', asked: [], renewals: 0, tick: () => {} }
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const jwt = (sub, exp) => b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub, exp, role: 'authenticated' }) + '.bench'
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' } })
  export async function notForever(url, options = {}) {
    const at = new URL(String(url))
    net.asked.push((options.method || 'GET') + ' ' + at.pathname)
    if (net.mode === 'captive') return new Promise(() => {})
    if (['offline', 'timeout', 'down'].includes(net.mode)) net.tick()
    if (net.mode === 'offline') throw new TypeError('Network request failed')
    if (net.mode === 'timeout') throw new Error('The account service timed out.')
    if (net.mode === 'down') return new Response('<html>502 Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' })
    if (at.pathname === '/auth/v1/token') {
      if (net.mode === 'refused') return json(400, { code: net.code, message: 'Invalid Refresh Token: ' + net.code })
      net.renewals += 1
      const exp = Math.floor(Date.now() / 1000) + 3600
      const sub = JSON.parse(options.body).refresh_token.startsWith('refresh-') ? '${CUSTOMER}' : 'nobody'
      return json(200, { access_token: jwt(sub, exp), refresh_token: 'refresh-' + (net.renewals + 1), token_type: 'bearer', expires_in: 3600, expires_at: exp, user: { id: sub, email: 'player@example.com', aud: 'authenticated' } })
    }
    if (at.pathname === '/auth/v1/logout') return new Response(null, { status: 204 })
    return json(404, { message: 'not on the bench' })
  }
`

/*
 * THE BENCH'S CLOCK: the runner's, plus however long the phones on the bench
 * have spent waiting on a signal (NET's tick) or been moved on by a test
 * (`bench.pass`). It is Date.now itself, because the code it has to reach is
 * supabase-js's, read from node_modules, which no swap can get into; it is
 * the runner's again the moment the last bench is put away.
 */
const realNow = Date.now
const benchClock = { ahead: 0, live: 0 }
/*
 * And while a bench is out, the one thing supabase-js says to the console of
 * its own accord here — a renewal at start-up that got no answer, which it
 * warns about rather than throws — is not said into the runner's log, where
 * it would read as a failure. Anything else it says still is.
 */
const realWarn = console.warn
const quietWarn = (...said) => {
  if (said.length === 1 && said[0]?.name === 'AuthRetryableFetchError') return
  realWarn(...said)
}
function clockOn() {
  if (benchClock.live++ > 0) return
  Date.now = () => realNow() + benchClock.ahead
  console.warn = quietWarn
}
function clockOff() {
  if (--benchClock.live > 0) return
  Date.now = realNow
  console.warn = realWarn
  benchClock.ahead = 0
}

/**
 * The phone's relay.js on a bench: the file itself, its own imports copied in
 * or stood in for, supabase-js the real one, the phone's storage a Map, and
 * the network NET above. `disk` is what is on the phone when it starts, key
 * by key; `mode` the network it starts on. Starting the bench is a launch:
 * supabase-js, built on the first question, reads the phone and tries the
 * renewal there and then, as it does on the phone.
 */
async function relayOnABench({ disk = {}, mode = 'offline' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kept-session-'))
  const files = {
    'package.json': '{ "type": "module" }',
    'net.mjs': NET,
    'storage.mjs':
      `export const disk = new Map(Object.entries(${JSON.stringify(disk)}))\n` +
      'export default { getItem: async (k) => (disk.has(k) ? disk.get(k) : null), setItem: async (k, v) => { disk.set(k, String(v)) }, removeItem: async (k) => { disk.delete(k) } }\n',
    'nothing.mjs': 'export const logDebug = () => {}\nexport const decode = async (p) => p.body\nexport const withRetry = (fn) => fn()\n',
    'relay-rules.mjs': read('shared/relay-rules.mjs'),
    'confirm-code.mjs': read('shared/confirm-code.mjs'),
    'device-word.mjs': read('shared/device-word.mjs'),
    'project.mjs': read('mobile/src/lib/project.js')
  }
  const swaps = [
    ["from '@react-native-async-storage/async-storage'", "from './storage.mjs'"],
    ["from '@supabase/supabase-js'", `from '${SUPABASE}'`],
    ["from './debugLog'", "from './nothing.mjs'"],
    ["from './project'", "from './project.mjs'"],
    ["from './decode'", "from './nothing.mjs'"],
    ["from './retry'", "from './nothing.mjs'"],
    ["from './notForever'", "from './net.mjs'"],
    ["from './relay-rules'", "from './relay-rules.mjs'"],
    ["from './confirm-code'", "from './confirm-code.mjs'"],
    ["from './device-word'", "from './device-word.mjs'"]
  ]
  let src = read('mobile/src/lib/relay.js')
  for (const [from, to] of swaps) {
    assert.ok(src.includes(from), `relay.js no longer has ${from}; the bench needs telling`)
    src = src.replaceAll(from, to)
  }
  const left = [...src.matchAll(/^\s*(?:import|export)\b[^'\n]*from '([^']+)'|import\('([^']+)'\)/gm)]
    .map((m) => m[1] ?? m[2])
    .filter((p) => p !== SUPABASE && !(p.startsWith('./') && p.slice(2) in files))
  assert.deepEqual(left, [], 'relay.js imports something new; the bench does not cover it')
  files['relay.mjs'] = src
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  const { net } = await import(at('net.mjs'))
  net.mode = mode
  net.tick = () => {
    benchClock.ahead += 10_000
  }
  clockOn()
  const relay = await import(at('relay.mjs'))
  const store = (await import(at('storage.mjs'))).disk
  return {
    relay,
    net,
    disk: store,
    /* Whose sign-in the phone holds, and with which renewal token: what supabase-js wrote, read back. */
    kept: () => {
      const raw = store.get(KEY)
      if (!raw) return null
      const s = JSON.parse(raw)
      return { id: s.user?.id ?? null, refresh: s.refresh_token }
    },
    /* The phone as this launch leaves it, for the next. */
    left: () => Object.fromEntries(store),
    /* Time going by on the phone, by the bench's clock. */
    pass: (ms) => {
      benchClock.ahead += ms
    },
    done: async () => {
      /* supabase-js's own renewal ticker, stopped: it would go on asking the bench's network every thirty seconds. */
      try {
        await relay.supabaseClient().auth.stopAutoRefresh()
      } finally {
        clockOff()
        rmSync(dir, { recursive: true, force: true })
      }
    }
  }
}

/*
 * App.js's launch, the effect that sets the door, lifted out of the file and
 * run with what it calls stood in for: `haveSession` is the bench's, as
 * lib/link.js hands it over. Resolves with what the door was set to, and
 * whose phone lib/bluetooth was told it is.
 */
async function launchGate({ haveSession, demo = false }) {
  const app = read('mobile/App.js')
  const at = app.indexOf('restoreDemo()\n      .then((on) => (on ? true : haveSession()))')
  assert.ok(at > 0, 'the launch moved; this test reads it')
  const start = app.lastIndexOf('useEffect(() => {', at)
  const end = app.indexOf('}, [])', at) + '}, [])'.length
  const effect = app.slice(start, end)
  assert.match(effect, /^useEffect\(\(\) => \{\s*let alive = true\s*restoreDemo\(\)/, 'the launch is not one effect of its own any more; this test reads it')
  const module = `export default (stand) => new Promise((settled) => {
    const { restoreDemo, haveSession, allowBluetooth } = stand
    const setAuth = (auth) => settled({ auth, told: stand.told })
    const useEffect = (fn) => fn()
    ${effect}
  })`
  const run = (await import(`data:text/javascript,${encodeURIComponent(module)}`)).default
  const stand = {
    told: [],
    restoreDemo: async () => demo,
    haveSession,
    allowBluetooth: (id) => stand.told.push(id)
  }
  return run(stand)
}

export function run(test) {
  test('a sign-in that ran out with no signal lets the phone in, as that account, and renews itself when the signal is back', async () => {
    const bench = await relayOnABench({ disk: { [KEY]: keptSignIn() }, mode: 'offline' })
    try {
      assert.equal(await bench.relay.keptSession(), CUSTOMER, 'a paid customer at a gig with no signal is put in front of the sign-in screen')
      /* supabase-js's whole round of retries, every one of them unanswered, before it said so: an answer, not the door's wait. */
      assert.ok(bench.net.asked.filter((a) => a === 'POST /auth/v1/token').length >= 2, 'supabase-js did not try the renewal again on its own, so this proved nothing')
      assert.deepEqual(bench.kept(), { id: CUSTOMER, refresh: 'refresh-1' }, 'no signal took the sign-in off the phone')

      /* The relay is as it was: a sign-in that could not be renewed reaches no computer and asks the account service nothing on its say-so. */
      assert.equal(await bench.relay.restoreSession(), null, 'the relay takes a sign-in it could not renew for a good one')
      assert.equal(bench.relay.remoteUserId(), null, 'the door let the relay join as an account it could not renew')
      await assert.rejects(bench.relay.remoteConnect(), { message: 'Sign in first.' }, 'the relay joined on a sign-in it could not renew')

      /*
       * The signal back. supabase-js waits a minute after a renewal that
       * failed before it tries that token again (REFRESH_FAILURE_COOLDOWN_MS),
       * so the clock is moved past it; the next question the relay asks — the
       * link's next join, or supabase-js's own ticker — is then renewed, by
       * supabase-js and nothing else.
       */
      bench.net.mode = 'ok'
      assert.equal(await bench.relay.restoreSession(), null, 'tried again inside the minute supabase-js waits')
      bench.pass(61_000)
      assert.equal(await bench.relay.restoreSession(), CUSTOMER, 'the sign-in was not renewed once the signal was back')
      assert.equal(bench.relay.remoteUserId(), CUSTOMER, 'the relay was not given the renewed sign-in to join on')
      assert.equal(bench.net.renewals, 1)
      assert.deepEqual(bench.kept(), { id: CUSTOMER, refresh: 'refresh-2' }, 'the renewal was not written to the phone')
      assert.equal(await bench.relay.keptSession(), CUSTOMER)
    } finally {
      await bench.done()
    }

    /* The same for every way a renewal can go unanswered: the twelve seconds of notForever, and the account service down behind a gateway. */
    for (const mode of ['timeout', 'down']) {
      const again = await relayOnABench({ disk: { [KEY]: keptSignIn() }, mode })
      try {
        assert.equal(await again.relay.keptSession(), CUSTOMER, `${mode}: a renewal with no answer put a paid customer at the sign-in screen`)
        assert.ok(again.net.asked.includes('POST /auth/v1/token'), `${mode}: the renewal was never asked for`)
        assert.deepEqual(again.kept(), { id: CUSTOMER, refresh: 'refresh-1' }, `${mode}: the sign-in was taken off the phone`)
        assert.equal(await again.relay.restoreSession(), null)
      } finally {
        await again.done()
      }
    }

    /*
     * A question taken and never answered: supabase-js would wait on it, and
     * on its retries after, for as long as it takes. The door waits
     * KEPT_WAIT_MS and goes in on what is on the phone, and gives the relay
     * nothing it did not wait for.
     */
    const captive = await relayOnABench({ disk: { [KEY]: keptSignIn() }, mode: 'captive' })
    try {
      const began = realNow()
      /* Raced against a stopwatch of the test's own, so a door that waits for ever fails here rather than hanging the run. */
      let stopwatch
      const late = new Promise((go) => (stopwatch = setTimeout(() => go('still waiting'), captive.relay.KEPT_WAIT_MS + 5000)))
      const id = await Promise.race([captive.relay.keptSession(), late]).finally(() => clearTimeout(stopwatch))
      assert.equal(id, CUSTOMER, 'a network that never answers keeps a paid customer at the spinner')
      const took = realNow() - began
      assert.ok(took >= captive.relay.KEPT_WAIT_MS - 50 && took < captive.relay.KEPT_WAIT_MS + 1500, `the door took ${took} ms to go in on the sign-in on the phone`)
      assert.equal(captive.relay.remoteUserId(), null, 'the door gave the relay an answer it did not wait for')
      assert.deepEqual(captive.kept(), { id: CUSTOMER, refresh: 'refresh-1' })
    } finally {
      await captive.done()
    }
    /* And the wait is the door's, not the twenty-five seconds the phone's supabase-js takes to give up. */
    assert.ok(read('mobile/src/lib/relay.js').includes('export const KEPT_WAIT_MS = 3000'), 'the door waits some other time for the renewal; say why in keptSession')

    /* And one still inside its hour needs no signal at all, as before. */
    const fresh = await relayOnABench({ disk: { [KEY]: keptSignIn({ ago: -1800 }) }, mode: 'offline' })
    try {
      assert.equal(await fresh.relay.keptSession(), CUSTOMER)
      assert.equal(await fresh.relay.restoreSession(), CUSTOMER)
      assert.ok(!fresh.net.asked.includes('POST /auth/v1/token'), 'a sign-in inside its hour was sent to be renewed')
    } finally {
      await fresh.done()
    }
  })

  test('a sign-in the account service turned away, or nothing on the phone at all, is nobody, as before', async () => {
    /*
     * Turned away: the sign-in ended somewhere else (session_not_found), the
     * account was deleted, which takes its renewal tokens with it
     * (refresh_token_not_found), or the renewal token was used twice
     * (refresh_token_already_used). supabase-js takes it off the phone, and
     * the door finds nobody, with or without a signal at the next launch.
     */
    for (const code of ['refresh_token_not_found', 'session_not_found', 'refresh_token_already_used']) {
      const bench = await relayOnABench({ disk: { [KEY]: keptSignIn() }, mode: 'refused' })
      bench.net.code = code
      let after
      try {
        assert.equal(await bench.relay.keptSession(), null, `${code}: a sign-in the account service turned away still opens the app`)
        assert.ok(bench.net.asked.includes('POST /auth/v1/token'), `${code}: the renewal was never asked for`)
        assert.equal(bench.kept(), null, `${code}: a sign-in the account service turned away was left on the phone`)
        assert.equal(await bench.relay.restoreSession(), null)
        after = bench.left()
      } finally {
        await bench.done()
      }
      const next = await relayOnABench({ disk: after, mode: 'offline' })
      try {
        assert.equal(await next.relay.keptSession(), null, `${code}: the launch after, with no signal, opened the app on a sign-in that was turned away`)
      } finally {
        await next.done()
      }
    }

    /* Nothing on the phone: nobody, signal or none, and nothing asked of the account service. */
    for (const mode of ['offline', 'ok']) {
      const bench = await relayOnABench({ mode })
      try {
        assert.equal(await bench.relay.keptSession(), null, `${mode}: a phone that was never signed in opens the app`)
        assert.ok(!bench.net.asked.includes('POST /auth/v1/token'))
      } finally {
        await bench.done()
      }
    }

    /* And what is on the phone under that key, but is not a sign-in supabase-js would write, is nobody too: it can only fail closed. */
    for (const odd of ['not json', JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: nowSec() - 600 }), JSON.stringify({ ...JSON.parse(keptSignIn()), user: { id: 7 } })]) {
      const bench = await relayOnABench({ disk: { [KEY]: odd }, mode: 'offline' })
      try {
        assert.equal(await bench.relay.keptSession(), null, `something that is not a sign-in let the phone in: ${odd.slice(0, 40)}`)
      } finally {
        await bench.done()
      }
    }
  })

  test('Sign out leaves no sign-in on the phone, even made with no signal on one that had run out', async () => {
    /*
     * With a signal: supabase-js signs out and takes it off the phone, and
     * the next launch is the sign-in screen.
     */
    {
      const bench = await relayOnABench({ disk: { [KEY]: keptSignIn({ ago: -1800 }) }, mode: 'ok' })
      let after
      try {
        assert.equal(await bench.relay.keptSession(), CUSTOMER)
        await bench.relay.signOut()
        assert.equal(bench.kept(), null, 'Sign out left the sign-in on the phone')
        assert.equal(await bench.relay.keptSession(), null)
        after = bench.left()
      } finally {
        await bench.done()
      }
      const next = await relayOnABench({ disk: after, mode: 'offline' })
      try {
        assert.equal(await next.relay.keptSession(), null, 'the launch after Sign out opened the app')
      } finally {
        await next.done()
      }
    }

    /*
     * With none, on a sign-in past its hour: supabase-js's signOut tries the
     * renewal first, gets no answer, and gives up with the sign-in still on
     * the phone. relay.signOut takes it off, so the sign-out somebody asked
     * for holds at the next launch, with no signal and with one.
     */
    for (const nextMode of ['offline', 'ok']) {
      const bench = await relayOnABench({ disk: { [KEY]: keptSignIn() }, mode: 'offline' })
      let after
      try {
        assert.equal(await bench.relay.keptSession(), CUSTOMER)
        await bench.relay.signOut()
        assert.equal(bench.kept(), null, 'Sign out with no signal left the sign-in on the phone, for the next launch to open the app on')
        assert.equal(bench.disk.has(`${KEY}-user`), false)
        assert.equal(await bench.relay.keptSession(), null, 'signed out, and still let in')
        after = bench.left()
      } finally {
        await bench.done()
      }
      const next = await relayOnABench({ disk: after, mode: nextMode })
      try {
        assert.equal(await next.relay.keptSession(), null, `the launch after Sign out (${nextMode === 'ok' ? 'with a signal, which renewed it' : 'with no signal'}) opened the app`)
        assert.equal(next.net.renewals, 0, 'a sign-out was renewed back in')
      } finally {
        await next.done()
      }
    }
  })

  test('the launch opens on the app or on the sign-in screen by that answer, and tells Bluetooth whose phone it is first', async () => {
    const door = async ({ disk, mode }) => {
      const bench = await relayOnABench({ disk, mode })
      try {
        return await launchGate({ haveSession: () => bench.relay.keptSession() })
      } finally {
        await bench.done()
      }
    }
    /* The haveSession App.js is handed is this one. */
    const link = read('mobile/src/lib/link.js').replace(/\s+/g, ' ')
    assert.match(link, /export const haveSession = \(\) => keptSession\(\)/, 'the launch asks something other than keptSession whose phone this is')
    assert.match(read('mobile/App.js'), /import \{ haveSession, [^}]*\} from '\.\/src\/lib\/link'/)

    assert.deepEqual(await door({ disk: { [KEY]: keptSignIn() }, mode: 'offline' }), { auth: 'in', told: [CUSTOMER] }, 'run out with no signal: the sign-in screen, for a paid customer at a gig')
    assert.deepEqual(await door({ disk: { [KEY]: keptSignIn() }, mode: 'ok' }), { auth: 'in', told: [CUSTOMER] })
    assert.deepEqual(await door({ disk: { [KEY]: keptSignIn() }, mode: 'refused' }), { auth: 'out', told: [null] }, 'turned away by the account service: the app opens anyway')
    assert.deepEqual(await door({ disk: {}, mode: 'offline' }), { auth: 'out', told: [null] }, 'nobody signed in: the app opens anyway')

    /* Signed out with no signal, then launched with none: the sign-in screen. */
    const bench = await relayOnABench({ disk: { [KEY]: keptSignIn() }, mode: 'offline' })
    let after
    try {
      await bench.relay.signOut()
      after = bench.left()
    } finally {
      await bench.done()
    }
    assert.deepEqual(await door({ disk: after, mode: 'offline' }), { auth: 'out', told: [null] }, 'signed out on purpose: the next launch opens the app')

    /* The demo is let in with no sign-in at all, and says nothing to Bluetooth here, as before. */
    assert.deepEqual(await launchGate({ haveSession: async () => assert.fail('the demo asked for a sign-in'), demo: true }), { auth: 'in', told: [] })
  })

  test('the phone’s supabase-js is the one whose renewal and sign-out were read', () => {
    /*
     * Everything above rests on four functions in auth-js's GoTrueClient,
     * and runs them in the root's install, which is the browser's. The
     * phone's is its own install, and CI has none: this holds it to the
     * version they were read in, 25 October 2026, side by side with the
     * root's. A move is a reason to read them again in the new one, then to
     * move this:
     *
     *   - __loadSession: a renewal that fails hands back no session, and the
     *     error it failed with;
     *   - _callRefreshToken: an AuthRetryableFetchError (fetch threw, or a
     *     5xx) leaves the sign-in where it is; any other error, once the
     *     hour is up, takes it off (_removeSession). Failures are kept a
     *     minute (REFRESH_FAILURE_COOLDOWN_MS) before the same token is tried
     *     again;
     *   - _recoverAndRefresh: the renewal at start-up, by the same rules;
     *   - _signOut: a renewal that failed, on the way to signing out, returns
     *     before anything is removed (what relay.signOut makes up for).
     */
    const lock = JSON.parse(read('mobile/package-lock.json'))
    assert.equal(lock.packages['node_modules/@supabase/auth-js']?.version, '2.115.0', 'the phone’s auth-js moved: read the four functions named here again, then move this')
    const root = JSON.parse(read('package-lock.json'))
    assert.equal(root.packages['node_modules/@supabase/auth-js']?.version, '2.112.4', 'the root’s auth-js, which the tests above run, moved: read the four functions named here again, then move this')

    /* And the phone's relay builds its client the way the bench's does: the phone's storage, kept, renewed by supabase-js itself. */
    const relay = read('mobile/src/lib/relay.js').replace(/\s+/g, ' ')
    assert.match(relay, /auth: \{ storage: AsyncStorage, persistSession: true, autoRefreshToken: true,/, 'the client no longer keeps the sign-in on the phone, or no longer renews it by itself')
    assert.match(relay, /import \{ createClient, isAuthRetryableFetchError \} from '@supabase\/supabase-js'/, 'no answer is told from a no some other way than supabase-js’s own')
  })
}
