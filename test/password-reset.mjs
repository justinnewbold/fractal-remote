/**
 * FORGOT PASSWORD?: THE EMAIL'S LINK OPENS A PAGE TO CHOOSE A NEW PASSWORD.
 *
 * "I received the link to reset my password but when I clicked it, it did
 * not ever take me to a page where I can actually make the password change.
 * I tried this on both my computer and my phone." (a customer on the forum,
 * 8 November 2026.)
 *
 * The link checks the email's token at the account service and then opens
 * the website with a sign-in for the account after the # in the address.
 * Nothing read it but supabase-js, inside the website's own sign-in, which
 * kept it as this browser's and showed the ordinary site. Held here:
 *
 *   - the landing read as the account service writes it (a sign-in, an
 *     expired link, nothing), and wiped from the address bar at once
 *   - read before anything else on the website, and the app not started
 *     under the page, so no client of the app's takes the sign-in: run with
 *     the real supabase-js, the website's restoreSession signed the browser
 *     in from the email's address, and with the landing taken first it does
 *     not
 *   - the save made on a client that keeps nothing: setSession, then
 *     updateUser, then that one sign-in signed out
 *   - the account service's refusals in plain words, the expired link's
 *     among them, and the page's three states drawn
 *   - what Forgot password? says at both ends once the email has gone
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { addressWithout, emailOf, parseLanding, takeLanding } from '../src/lib/recoveryLanding.js'
import {
  KEEP_NOTHING,
  RESET_DONE,
  RESET_EXPIRED,
  RESET_EXPIRED_TITLE,
  RESET_GUESSABLE,
  RESET_MISMATCH,
  RESET_MIX,
  RESET_OFFLINE,
  RESET_SAME,
  RESET_TITLE,
  RESET_TOO_SHORT,
  explainReset,
  makeReset,
  resetTooShortThere
} from '../src/lib/recovery.js'
import { PASSWORD_MIN, RESET_CHECK, RESET_NEXT, RESET_NOT_SENT, RESET_ROW_SUB, RESET_SENT, RESET_SENT_IF_ACCOUNT, RESET_SENT_TO } from '../shared/password-reset.mjs'
import { NOT_AFFILIATED } from '../shared/affiliation.mjs'
import { DEFAULT_PROJECT } from '../desktop/lib/project.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(root, p), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
/* Code with its comments out: a comment about the old way is not the old way. */
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

/** A sign-in's token as the account service makes one: three parts, the middle one the account's details. */
const tokenFor = (claims) =>
  ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'c2lnbmF0dXJl'].join('.')

/** The address the Reset password button opens, exactly as the account service writes it. */
const now = () => Math.floor(Date.now() / 1000)
const ACCESS = tokenFor({ sub: 'user-1', email: 'player@example.com', exp: now() + 3600, aud: 'authenticated' })
const EMAILED = `https://fractal.newbold.cloud/#access_token=${ACCESS}&expires_at=${now() + 3600}&expires_in=3600&refresh_token=r3fr35h&token_type=bearer&type=recovery`
const EXPIRED = 'https://fractal.newbold.cloud/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'

/** A window with just what the landing and supabase-js read: the address, and a history that rewrites it. */
function aWindow(href) {
  const loc = { href }
  const rewrites = []
  const win = {
    location: {
      get href() {
        return loc.href
      },
      set hash(v) {
        loc.href = loc.href.split('#')[0] + (v ? `#${v}` : '')
      }
    },
    history: {
      state: { screen: 'play' },
      replaceState(state, _title, url) {
        rewrites.push({ state, url })
        loc.href = new URL(url, loc.href).href
      }
    },
    addEventListener() {},
    removeEventListener() {}
  }
  return { win, rewrites, href: () => loc.href }
}

/**
 * supabase-js's client, stood in for: what it was made with and every call,
 * in order. `answers` says what each call returns; a function is called with
 * what the call was given, so a test can change its mind between calls.
 */
function aService(answers = {}) {
  const made = []
  const calls = []
  const answer = (name, arg) => {
    const a = answers[name]
    return typeof a === 'function' ? a(arg) : a
  }
  const createClient = (url, key, options) => {
    made.push({ url, key, options })
    return {
      auth: {
        setSession: async (s) => (calls.push(['setSession', s]), answer('setSession', s) ?? { data: { session: { access_token: s.access_token } }, error: null }),
        updateUser: async (u) => (calls.push(['updateUser', u]), answer('updateUser', u) ?? { data: { user: { id: 'user-1' } }, error: null }),
        signOut: async (o) => (calls.push(['signOut', o]), answer('signOut', o) ?? { error: null })
      }
    }
  }
  return { made, calls, createClient }
}

export function run(test) {
  test('the email’s address is read as a sign-in for a new password, an expired link, or nothing', () => {
    const found = parseLanding(EMAILED)
    assert.equal(found.kind, 'recovery')
    assert.equal(found.accessToken, ACCESS)
    assert.equal(found.refreshToken, 'r3fr35h')
    assert.equal(found.expiresIn, 3600)
    assert.equal(found.email, 'player@example.com', 'the page cannot say whose password it is')
    assert.equal(emailOf('not a token'), null)

    const old = parseLanding(EXPIRED)
    assert.deepEqual(old, { kind: 'error', code: 'otp_expired', description: 'Email link is invalid or has expired', expired: true })
    /* Where the other way of signing in puts it: the query. */
    assert.equal(parseLanding('https://fractal.newbold.cloud/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired').kind, 'error')
    /* A recovery missing a token is a link that will not work, said as one. */
    assert.deepEqual(parseLanding('https://fractal.newbold.cloud/#type=recovery&access_token=abc'), { kind: 'error', code: 'incomplete', description: '', expired: true })

    /* Nothing: the ordinary site, the join link, an anchor, a sign-in of another kind, and a ?code=, which neither end's emails ever carry. */
    for (const href of [
      'https://fractal.newbold.cloud/',
      'https://fractal.newbold.cloud/join',
      'https://fractal.newbold.cloud/#top',
      'https://fractal.newbold.cloud/?fresh=123',
      `https://fractal.newbold.cloud/#access_token=${ACCESS}&refresh_token=x&type=signup`,
      'https://fractal.newbold.cloud/?code=8c6f0a0e-77b5-4d47-9d4b-5ee0c51e0d1a',
      'not an address'
    ]) {
      assert.equal(parseLanding(href), null, `${href} was taken for a reset link`)
    }
    /* And that ?code= can never come: neither end asks for that way of signing in. */
    assert.ok(!/flowType/.test(code(read('src/lib/remote.js'))), 'the website asks for links that land with a ?code=, which this page does not take')
    assert.ok(!/flowType/.test(code(read('mobile/src/lib/relay.js'))), 'the phone asks for links that land with a ?code=, which this page does not take')
  })

  test('the landing is wiped from the address bar the moment it is read', () => {
    assert.equal(addressWithout(EMAILED), '/')
    assert.equal(addressWithout(`${EXPIRED.split('#')[0]}?fresh=7&error=access_denied&error_code=otp_expired#error=access_denied`), '/?fresh=7', 'the rest of the query was lost, or the reasons were kept')

    const { win, rewrites, href } = aWindow(EMAILED)
    const found = takeLanding(win)
    assert.equal(found.kind, 'recovery')
    assert.deepEqual(rewrites, [{ state: { screen: 'play' }, url: '/' }], 'the address is not put back with history.replaceState, keeping the page’s own state')
    assert.equal(href(), 'https://fractal.newbold.cloud/')
    assert.ok(!/access_token|refresh_token|#/.test(href()), 'the sign-in is still in the address bar, where a bookmark or the history keeps it')

    const gone = aWindow(EXPIRED)
    assert.equal(takeLanding(gone.win).kind, 'error')
    assert.equal(gone.href(), 'https://fractal.newbold.cloud/')

    /* A history the page may not touch: the part after the # goes all the same. */
    const stuck = aWindow(EMAILED)
    stuck.win.history.replaceState = () => {
      throw new Error('SecurityError')
    }
    assert.equal(takeLanding(stuck.win).kind, 'recovery')
    assert.equal(stuck.href(), 'https://fractal.newbold.cloud/')

    /* An ordinary visit is left exactly as it is. */
    const plain = aWindow('https://fractal.newbold.cloud/join?x=1#top')
    assert.equal(takeLanding(plain.win), null)
    assert.deepEqual(plain.rewrites, [])
    assert.equal(plain.href(), 'https://fractal.newbold.cloud/join?x=1#top')
    /* And outside a browser there is nothing to take. */
    assert.equal(takeLanding(undefined), null)
  })

  test('the landing is read before anything else on the website, and the app is not started under the page', () => {
    const main = read('src/main.jsx')
    const imports = [...code(main).matchAll(/^import\s.+$/gm)].map((m) => m[0])
    assert.equal(imports[0], "import { landing } from './lib/recoveryLanding'", 'something is imported before the landing is read, and may read the address first')
    /* It runs first only if it waits on nothing: no imports of its own. */
    assert.ok(!/^\s*import\s/m.test(code(read('src/lib/recoveryLanding.js'))), 'the landing’s module imports something, which then runs before it')
    assert.match(read('src/lib/recoveryLanding.js'), /export const landing = takeLanding\(\)\n/, 'the landing is not read as the module runs')
    /* The page in the app's place, not over it: nothing of the app runs under it. */
    assert.match(flat(main), /const resetVisit = Boolean\(landing\)/)
    assert.match(flat(main), /\{resetVisit \? <ResetPassword landing=\{landing\} \/> : <App \/>\}/, 'the app is started on a reset link’s visit, its sign-in, startup card and walkthrough with it')
    assert.equal((main.match(/<App\b/g) || []).length, 1, 'the app is drawn somewhere else as well')
    /* And the page itself starts nothing of the app's: no sign-in, no link, no startup card, no walkthrough, no update check. */
    const page = code(read('src/components/ResetPassword.jsx'))
    for (const name of ['lib/remote', 'lib/link', 'IndependentNotice', 'Onboarding', 'PhoneWalkthrough', 'UpdateNotice', 'restoreSession', 'bootLink']) {
      assert.ok(!page.includes(name), `the page brings ${name} with it`)
    }
  })

  test('the website’s own sign-in starts no session from a reset link once the landing is taken, as it did before', () => {
    /*
     * The real supabase-js, the way the website runs it on every load
     * (restoreSession in src/lib/remote.js, from bootLink), in a stand-in
     * browser whose address is the one the email opens. In a Node of its
     * own, so the stand-in window, storage and fetch are never the rest of
     * the suite's, and a copy of remote.js for each run, so the sign-in one
     * run holds is not the next one's.
     */
    const dir = mkdtempSync(join(tmpdir(), 'reset-bench-'))
    try {
      const file = join(dir, 'bench.mjs')
      writeFileSync(
        file,
        `const landingAt = ${JSON.stringify(pathToFileURL(join(root, 'src/lib/recoveryLanding.js')).href)}
        const remoteAt = ${JSON.stringify(pathToFileURL(join(root, 'src/lib/remote.js')).href)}
        const kept = new Map()
        const storage = { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => void kept.set(k, String(v)), removeItem: (k) => void kept.delete(k) }
        const asked = []
        const put = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: true })
        put('document', { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} })
        put('localStorage', storage)
        /* No second tab to tell: supabase-js would otherwise hold this Node open listening for one. */
        put('BroadcastChannel', undefined)
        put('fetch', async (url) => {
          asked.push(String(url))
          return new Response(JSON.stringify({ id: 'user-1', email: 'player@example.com', aud: 'authenticated', role: 'authenticated' }), { status: 200, headers: { 'content-type': 'application/json' } })
        })
        const { takeLanding } = await import(landingAt)
        const once = async (href, takeFirst, n) => {
          kept.clear()
          asked.length = 0
          const loc = { href }
          put('window', {
            location: { get href() { return loc.href }, set hash(v) { loc.href = loc.href.split('#')[0] + (v ? '#' + v : '') } },
            history: { state: null, replaceState(state, title, url) { loc.href = new URL(url, loc.href).href } },
            addEventListener() {},
            removeEventListener() {},
            localStorage: storage
          })
          const found = takeFirst ? takeLanding(globalThis.window) : null
          const remote = await import(remoteAt + '?run=' + n)
          const id = await remote.restoreSession()
          return { id, found: found && found.kind, href: loc.href, stored: [...kept.keys()], asked: [...asked] }
        }
        const before = await once(${JSON.stringify(EMAILED)}, false, 1)
        const after = await once(${JSON.stringify(EMAILED)}, true, 2)
        process.stdout.write(JSON.stringify({ before, after }))
        `
      )
      const said = JSON.parse(execFileSync(process.execPath, [file], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString())

      /* As it was: the website's sign-in took the link's sign-in for this browser's own, and the address showed nothing. */
      assert.equal(said.before.id, 'user-1', 'the bench does not show what the customer met: supabase-js no longer reads the address, and this test proves nothing')
      assert.ok(said.before.asked.some((u) => u.endsWith('/auth/v1/user')))
      assert.ok(said.before.stored.length > 0)

      /* As it is: the landing taken first, the website's sign-in finds nothing to take, asks nothing, keeps nothing. */
      assert.equal(said.after.found, 'recovery', 'the landing was not taken')
      assert.equal(said.after.id, null, 'the website signed this browser in with the reset link’s sign-in')
      assert.deepEqual(said.after.asked, [], 'the website asked the account service about the reset link’s sign-in')
      assert.deepEqual(said.after.stored, [], 'the reset link’s sign-in was written to this browser’s storage')
      assert.equal(said.after.href, 'https://fractal.newbold.cloud/')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('the new password is saved on a client that keeps nothing: setSession, then updateUser, then signed out', async () => {
    const landing = parseLanding(EMAILED)
    const service = aService()
    const reset = makeReset({ landing, createClient: service.createClient })
    assert.deepEqual(await reset.save('new-secret', 'new-secret'), { ok: true })
    assert.equal(service.made.length, 1)
    assert.equal(service.made[0].url, DEFAULT_PROJECT.url)
    assert.equal(service.made[0].key, DEFAULT_PROJECT.anonKey)
    assert.deepEqual(service.made[0].options, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }, 'the save’s client keeps, renews or reads something')
    assert.deepEqual(KEEP_NOTHING, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false })
    assert.deepEqual(service.calls, [
      ['setSession', { access_token: landing.accessToken, refresh_token: landing.refreshToken }],
      ['updateUser', { password: 'new-secret' }],
      ['signOut', { scope: 'local' }]
    ])
    /* Saved once is saved: a second press sends nothing. */
    assert.deepEqual(await reset.save('new-secret', 'new-secret'), { ok: true })
    assert.equal(service.calls.length, 3)

    /* Nothing is sent for boxes that will not do. */
    const idle = aService()
    const early = makeReset({ landing, createClient: idle.createClient })
    assert.deepEqual(await early.save('abc', 'abc'), { ok: false, problem: RESET_TOO_SHORT })
    assert.deepEqual(await early.save('new-secret', 'new-secrte'), { ok: false, problem: RESET_MISMATCH })
    assert.equal(idle.made.length, 0, 'the account service was asked before the boxes were checked')
    assert.ok(RESET_TOO_SHORT.includes(String(PASSWORD_MIN)))

    /* A landing with no sign-in in it never asks at all. */
    const none = aService()
    assert.deepEqual(await makeReset({ landing: parseLanding(EXPIRED), createClient: none.createClient }).save('new-secret', 'new-secret'), { ok: false, expired: true, problem: RESET_EXPIRED })
    assert.equal(none.made.length, 0)
  })

  test('a password the account service refuses is said plainly, and the next one goes on the same sign-in', async () => {
    const landing = parseLanding(EMAILED)
    let refusal = { message: 'Password should be at least 8 characters.', code: 'weak_password', status: 422, reasons: ['length'] }
    const service = aService({ updateUser: () => (refusal ? { data: { user: null }, error: refusal } : undefined) })
    const reset = makeReset({ landing, createClient: service.createClient })
    assert.deepEqual(await reset.save('sixsix', 'sixsix'), { ok: false, problem: resetTooShortThere(8) })
    refusal = { message: 'New password should be different from the old password.', code: 'same_password', status: 422 }
    assert.deepEqual(await reset.save('old-one', 'old-one'), { ok: false, problem: RESET_SAME })
    refusal = null
    assert.deepEqual(await reset.save('a-new-one', 'a-new-one'), { ok: true })
    /* One client, one setSession: a sign-in from a link renews once, and a second client from the same tokens would be refused. */
    assert.equal(service.made.length, 1)
    assert.deepEqual(service.calls.map(([name]) => name), ['setSession', 'updateUser', 'updateUser', 'updateUser', 'signOut'])
    assert.ok(!service.calls.slice(0, -1).some(([name]) => name === 'signOut'), 'the sign-in was ended before the password was saved')

    /* The rest of the account service's refusals of a password. */
    assert.deepEqual(explainReset({ message: 'Password is known to be weak and easy to guess, please choose a different one.', code: 'weak_password', reasons: ['pwned'], status: 422 }), { problem: RESET_GUESSABLE })
    assert.deepEqual(explainReset({ message: 'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789.', code: 'weak_password', reasons: ['characters'], status: 422 }), { problem: RESET_MIX })
    /* No connection: the boxes stay, and so does the sign-in. */
    assert.deepEqual(explainReset({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }), { problem: RESET_OFFLINE })
    assert.deepEqual(explainReset(new TypeError('NetworkError when attempting to fetch resource.')), { problem: RESET_OFFLINE })
    assert.deepEqual(explainReset(new TypeError('Load failed'), 'session'), { problem: RESET_OFFLINE }, 'no connection while the link’s sign-in was read is said as an expired link')
    /* None of these is a developer's sentence. */
    for (const said of [RESET_SAME, RESET_GUESSABLE, RESET_MIX, RESET_OFFLINE, resetTooShortThere(8)]) {
      assert.ok(!/jwt|token|session|422|weak_password|supabase/i.test(said), `"${said}" is not for a guitarist`)
    }
  })

  test('a reset link that is old or used says so, and what to do instead', async () => {
    const landing = parseLanding(EMAILED)
    /* The link's sign-in refused: used already, or ended. */
    const used = aService({ setSession: { data: { session: null, user: null }, error: { message: 'Invalid Refresh Token: Already Used', code: 'refresh_token_already_used', status: 400 } } })
    assert.deepEqual(await makeReset({ landing, createClient: used.createClient }).save('new-secret', 'new-secret'), { ok: false, expired: true, problem: RESET_EXPIRED })
    assert.deepEqual(used.calls.map(([name]) => name), ['setSession'], 'a password was sent on a sign-in that was refused')
    /* Or ended between the page opening and Save. */
    const ended = aService({ updateUser: { data: { user: null }, error: { message: 'Session from session_id claim in JWT does not exist', code: 'session_not_found', status: 403 } } })
    assert.deepEqual(await makeReset({ landing, createClient: ended.createClient }).save('new-secret', 'new-secret'), { ok: false, expired: true, problem: RESET_EXPIRED })
    /* And the words: what happened, and the one thing to do, in the app’s own button’s name. */
    assert.equal(RESET_EXPIRED, 'This reset link has expired or was already used. In the app, tap Forgot password? again and use the newest email.')
    assert.ok(read('src/components/SignIn.jsx').includes('Forgot password?'), 'the website’s button is no longer called Forgot password?')
    assert.ok(read('mobile/src/screens/SignIn.js').includes('label="Forgot password?"'), 'the phone’s button is no longer called Forgot password?')
  })

  test('the page draws its three states: the boxes, expired, and the words the save ends on', async () => {
    const { build } = await import('esbuild')
    const out = await build({
      stdin: {
        contents: "export { default as ResetPassword } from './src/components/ResetPassword.jsx'\nexport { renderToStaticMarkup } from 'react-dom/server'\nexport { createElement } from 'react'",
        resolveDir: root,
        loader: 'js'
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      jsx: 'automatic',
      logLevel: 'silent',
      external: ['@supabase/supabase-js'],
      define: { 'process.env.NODE_ENV': '"production"' }
    })
    const dir = mkdtempSync(join(tmpdir(), 'reset-page-'))
    try {
      const file = join(dir, 'page.cjs')
      writeFileSync(file, out.outputFiles[0].text)
      const { ResetPassword, renderToStaticMarkup, createElement } = createRequire(import.meta.url)(file)
      const draw = (landing) => renderToStaticMarkup(createElement(ResetPassword, { landing }))
      const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

      const boxes = draw(parseLanding(EMAILED))
      assert.ok(text(boxes).startsWith(RESET_TITLE), 'the page does not open on Choose a new password')
      assert.ok(text(boxes).includes('For player@example.com'))
      assert.equal((boxes.match(/<input type="password" autoComplete="new-password"/gi) || boxes.match(/type="password"[^>]*autocomplete="new-password"/gi) || []).length, 2, 'not two boxes for the new password')
      assert.match(boxes, /type="checkbox"/)
      assert.ok(text(boxes).includes('Show password'))
      assert.match(boxes, /<button type="submit" class="primary reset-go"[^>]*>Save<\/button>/)
      assert.ok(text(boxes).includes(NOT_AFFILIATED), 'Fractal Audio’s sentence is not on the page')

      for (const landing of [parseLanding(EXPIRED), parseLanding('https://fractal.newbold.cloud/#type=recovery&access_token=abc')]) {
        const old = text(draw(landing))
        assert.ok(old.startsWith(RESET_EXPIRED_TITLE), 'an expired link opens on the boxes')
        assert.ok(old.includes(RESET_EXPIRED), 'an expired link does not say what to do')
        assert.ok(!old.includes('Save'), 'an expired link offers a Save that cannot work')
      }

      /* How the page moves between them, read as the page is written. */
      const page = flat(code(read('src/components/ResetPassword.jsx')))
      assert.match(page, /const reset = useMemo\(\(\) => makeReset\(\{ landing \}\), \[landing\]\)/, 'the page saves some other way')
      assert.match(page, /const said = await reset\.save\(password, again\)/)
      assert.match(page, /if \(said\.ok\) \{ setPassword\(''\) setAgain\(''\) setState\('done'\) \} else if \(said\.expired\) \{ setState\('expired'\) \} else \{ setProblem\(said\.problem\) \}/)
      assert.match(page, /\{RESET_DONE\}/, 'Password changed does not say where to sign in')
      assert.equal(RESET_DONE, 'Your password is changed. Sign in with it in the app on your phone, tablet or computer.')
      assert.match(page, /type=\{show \? 'text' : 'password'\}[\s\S]*type=\{show \? 'text' : 'password'\}/, 'Show password does not show both boxes')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('the page fits a phone’s browser, in the site’s own look', () => {
    const css = read('src/styles.css')
    const rule = (sel) => css.match(new RegExp(`\\n${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] || ''
    assert.match(rule('.reset'), /position: fixed;[\s\S]*inset: 0;[\s\S]*overflow: auto;/, 'the page does not scroll when a phone’s keyboard is up')
    assert.match(rule('.reset'), /background: var\(--chassis\)/)
    assert.match(rule('.reset-card'), /margin: auto 0;\s+width: 100%;\s+max-width: 460px;/, 'the card is not held to the screen, or hangs off its top when taller than it')
    assert.ok(!/place-items: center|align-items: center/.test(rule('.reset')), 'a card taller than the screen is centred past its top edge, where nobody can scroll to it')
    assert.match(css, /@media \(max-width: 420px\) \{\s+\.reset \{\s+padding: var\(--s-4\);\s+\}\s+\.reset-card \{\s+margin: 0;\s+padding: var\(--s-4\);/, 'a phone loses its 16px gutter')
    assert.match(rule('.reset-go'), /min-height: 48px/)
    /* The boxes are Sign in's own, at the 16px floor iOS needs. */
    assert.equal((read('src/components/ResetPassword.jsx').match(/<label className="signin-field">/g) || []).length, 2)
  })

  test('Forgot password? says what happens next, at both ends', () => {
    assert.equal(RESET_NEXT, 'Tap Reset password in it, choose a new password on the page that opens, then sign in here with it.')
    assert.equal(RESET_SENT, `Check your email. ${RESET_NEXT}`)
    assert.ok(RESET_SENT_IF_ACCOUNT.startsWith('If that address has an account, a reset email is on its way.'), 'the website says which addresses have an account')
    for (const said of [RESET_SENT, RESET_SENT_IF_ACCOUNT]) {
      assert.ok(!/this phone|this device/i.test(said), `"${said}" names a device the line may not be read on`)
      assert.ok(said.split(/\s+/).length <= 36, `"${said}" is too long for the line under the form`)
    }
    const phone = flat(read('mobile/src/screens/SignIn.js'))
    assert.match(phone, /await sendPasswordReset\(email\.trim\(\)\) \/\*[^*]*\*\/ setNote\(RESET_SENT\)/, 'the phone says something else once the email has gone')
    assert.match(phone, /import \{ RESET_SENT \} from '\.\.\/lib\/password-reset'/)
    const web = flat(read('src/components/SignIn.jsx'))
    assert.match(web, /await sendPasswordReset\(\{ \.\.\.project\(\), email: address, redirectTo: window\.location\.origin \}\) \/\*[^*]*\*\/ setNote\(RESET_SENT_IF_ACCOUNT\)/, 'the website says something else once the email has gone')
    /* The email itself is asked for as it was, so the account service's settings and every email already sent stay as they are. */
    assert.match(read('mobile/src/lib/relay.js'), /await supabase\(\)\.auth\.resetPasswordForEmail\(email\)\n/)
    assert.match(read('src/lib/remote.js'), /await c\.auth\.resetPasswordForEmail\(email, redirectTo \? \{ redirectTo \} : undefined\)/)
  })

  /*
   * "When I went to my profile and went send a link to reset password, it
   * didn't do anything. I did not receive an email." (Justin, 8 November
   * 2026.) It had gone, to the address signed in on that phone, and the line
   * saying so landed on the page behind the account sheet as it closed.
   */
  test('the account menu’s reset link names its address before the tap, and says it in front of everything after', () => {
    const at = 'someone@example.com'
    assert.equal(RESET_ROW_SUB(at), `Goes to ${at}`)
    assert.equal(RESET_ROW_SUB(undefined), 'For when the old one is forgotten', 'no address yet, no "Goes to undefined"')
    assert.equal(RESET_CHECK, 'Check your email')
    assert.ok(RESET_SENT_TO(at).startsWith(`A link is on its way to ${at}.`))
    assert.ok(RESET_SENT_TO(at).includes('Tap Reset password in it'), 'the message says what the link does')
    for (const said of [RESET_ROW_SUB(at), RESET_CHECK, RESET_SENT_TO(at), RESET_NOT_SENT]) {
      assert.ok(!/this phone|this device|undefined/i.test(said), `"${said}"`)
    }

    const settings = code(read('mobile/src/screens/Settings.js'))
    assert.match(settings, /import \{ RESET_CHECK, RESET_NOT_SENT, RESET_ROW_SUB, RESET_SENT_TO \} from '\.\.\/lib\/password-reset'/)
    const at0 = settings.indexOf("'Email me a link to reset it'")
    assert.ok(at0 > 0, 'the row is there')
    const row = flat(settings.slice(settings.lastIndexOf('<Press', at0), settings.indexOf('/>', settings.indexOf('finally', at0))))
    assert.match(row, /sub=\{RESET_ROW_SUB\(account\?\.email\)\}/, 'the row names the address it sends to')
    /* The message, not a line on the page behind the sheet; and the sheet stays open under it until it is put away. */
    assert.match(row, /await sendPasswordReset\(email\) const said = RESET_SENT_TO\(email\) setNote\(said\) Alert\.alert\(RESET_CHECK, said, \[\{ text: 'OK', onPress: close \}\], \{ cancelable: true, onDismiss: close \}\)/)
    assert.match(row, /Alert\.alert\(RESET_NOT_SENT, err\.message, \[\{ text: 'OK', onPress: close \}\], \{ cancelable: true, onDismiss: close \}\)/, 'a refusal is said in front too')
    const tried = row.slice(row.indexOf('try {'), row.indexOf('finally'))
    assert.ok(!/setAccountMenu\(false\)/.test(tried.replace(/const close = \(\) => setAccountMenu\(false\)/, '')), 'the sheet is not shut under the message before it is put away')
    assert.match(read('mobile/src/screens/Settings.js'), /^import \{ Alert,/m)

    /* The website's account page says the same, beside its button. */
    const app = read('src/App.jsx')
    assert.match(app, /import \{ RESET_SENT_TO \} from '\.\.\/shared\/password-reset\.mjs'/)
    assert.match(app, /setPasswordSaid\(RESET_SENT_TO\(link\.account\.email\)\)/)
  })
}
