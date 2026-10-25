/**
 * "NO COMPUTER IS SIGNED IN WITH THIS ACCOUNT YET", AND ONLY WHEN IT IS TRUE.
 *
 * "Clearer help for new customers. 'No computer is signed in with this
 * account yet, here's the download' instead of 'make sure it's awake.'" —
 * what Justin approved on 13 October 2026, for the phone and the browser.
 * About twelve of the first forty paid accounts had never signed in on a
 * computer, and the advice they were given was to wake one.
 *
 * What these hold: the account server answers only about the caller, yes or
 * no; only a definite no changes the words, and an error, no signal, a
 * database without the function, Bluetooth, the demo, signed out or a
 * computer on another account all keep today's; the question goes at most
 * once a minute and never after a yes; and on the phone the download address
 * is words, never a link.
 *
 * The rule itself (shared/no-computer.mjs) and each end's question to the
 * account server are RUN. Where the screens draw it is read, as the rest of
 * the suite reads the screens.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const repoUrl = (p) => new URL(`../${p}`, import.meta.url).href
const flat = (p) => read(p).replace(/\s+/g, ' ')
const MIGRATION = 'supabase/migrations/20261014_account_has_computer.sql'

/* SQL without its comments: the header quotes the old advice and names the other function. */
const sqlBody = () =>
  read(MIGRATION)
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/*
 * THE WHOLE OF IT, word for word. Every pattern below can be satisfied by a
 * function that says more than it should — an `or` on the end answering yes
 * whenever ANY account has a computer, a coalesce turning "no caller" into a
 * no — so the migration is held to exactly this, and changing what it does
 * means changing this line on purpose.
 */
const SQL_EXACTLY =
  "drop function if exists public.account_has_computer(); " +
  "create or replace function public.account_has_computer() returns boolean language sql stable security definer set search_path = '' as $$ " +
  "select case when auth.uid() is null then null else exists ( select 1 from auth.sessions s where s.user_id = auth.uid() and s.user_agent like 'node%' ) end " +
  "$$; " +
  'revoke all on function public.account_has_computer() from public, anon; ' +
  'grant execute on function public.account_has_computer() to authenticated;'

/*
 * One end's accountHasComputer, lifted out of its file and run against a
 * stand-in account service. `rpc` is what the service does when asked; the
 * calls it saw are kept, so a test can say what was asked.
 */
function lift(file) {
  const src = read(file)
  const start = src.indexOf('export async function accountHasComputer(')
  assert.ok(start >= 0, `${file} has no accountHasComputer`)
  const end = src.indexOf('\n}\n', start)
  return src.slice(start, end + 2).replace(/^export /, '')
}
function phoneAsk(rpc) {
  const calls = []
  const service = { rpc: async (...args) => (calls.push(args), rpc(...args)) }
  const fn = new Function('supabase', `${lift('mobile/src/lib/relay.js')}\nreturn accountHasComputer`)(() => service)
  return { ask: fn, calls }
}
function webAsk(rpc) {
  const calls = []
  const client = rpc ? { rpc: async (...args) => (calls.push(args), rpc(...args)) } : null
  const fn = new Function('client', `${lift('src/lib/remote.js')}\nreturn accountHasComputer`)(client)
  return { ask: fn, calls }
}

/* The rule on a clock turned by hand, with an account server that answers what it is told to. */
async function checkOnABench() {
  const { computerCheck, ASK_EVERY_MS } = await import('../shared/no-computer.mjs')
  const bench = { t: 1_000_000, asks: 0, answer: () => false }
  const check = computerCheck(
    async () => {
      bench.asks++
      return bench.answer()
    },
    () => bench.t
  )
  const me = { id: 'u1', email: 'player@example.com' }
  const later = (ms) => {
    bench.t += ms
  }
  return { check, bench, me, later, ASK_EVERY_MS }
}

/*
 * The phone's useNoComputer (mobile/src/lib/useNoComputer.js), RUN: drawn the
 * way App draws it, by a stand-in React small enough to read — state, a
 * reducer, effects with their dependencies and their cleanups — against a
 * stand-in relay whose session and account server answer when the test says.
 *
 *   draw(active)   draws the hook, runs its effects, draws again until it
 *                  settles; every draw's answer is kept in `draws`
 *   release()      the phone finishes reading its own session (which with
 *                  bad signal can take seconds: supabase-js waits on any
 *                  token refresh)
 *   answer(v)      the account server answers the question that is out
 *   bench.session  whose session is on the phone right now
 */
async function phoneHookOnABench() {
  const dir = mkdtempSync(join(tmpdir(), 'no-computer-hook-'))
  const files = {
    'package.json': '{ "type": "module" }',
    'react.mjs': `
      const slots = []
      let at = 0
      let effects = []
      let dirty = false
      export const draws = []
      export function useState(initial) {
        const k = at++
        if (!slots[k]) slots[k] = { value: typeof initial === 'function' ? initial() : initial }
        const slot = slots[k]
        const set = (v) => {
          const next = typeof v === 'function' ? v(slot.value) : v
          if (!Object.is(next, slot.value)) {
            slot.value = next
            dirty = true
          }
        }
        return [slot.value, set]
      }
      export function useReducer(reducer, initial) {
        const k = at++
        if (!slots[k]) slots[k] = { value: initial }
        const slot = slots[k]
        return [slot.value, (a) => { slot.value = reducer(slot.value, a); dirty = true }]
      }
      export function useEffect(fn, deps) {
        const k = at++
        const slot = slots[k] || (slots[k] = { deps: undefined, cleanup: null })
        const changed = slot.deps === undefined || !deps || deps.some((d, j) => !Object.is(d, slot.deps[j]))
        if (!changed) return
        slot.deps = deps
        effects.push(() => {
          if (slot.cleanup) slot.cleanup()
          const c = fn()
          slot.cleanup = typeof c === 'function' ? c : null
        })
      }
      export function draw(hook, ...args) {
        for (let n = 0; n < 20; n++) {
          at = 0
          dirty = false
          const out = hook(...args)
          draws.push(out)
          const run = effects
          effects = []
          for (const e of run) e()
          if (!dirty) return out
        }
        throw new Error('the hook never settled')
      }
    `,
    'relay.mjs': `
      export const bench = { session: null, reading: [], asking: [], asks: 0 }
      export function sessionAccount() {
        return new Promise((resolve) => bench.reading.push(resolve))
      }
      export function accountHasComputer() {
        bench.asks++
        return new Promise((resolve) => bench.asking.push(resolve))
      }
      export const remoteUserId = () => bench.session?.id || null
      export const subscribeHostSeen = () => () => {}
    `,
    'pairing.mjs': 'export const isPairAccount = (email) => /^pair-/.test(email || "")\n',
    /* No real timers: the fifteen-second poke would keep the run alive, and the bench turns the clock by hand. */
    'timers.mjs': 'export const setInterval = () => 0\nexport const clearInterval = () => {}\n'
  }
  let src = read('mobile/src/lib/useNoComputer.js')
  const swaps = [
    ["from 'react'", "from './react.mjs'"],
    ["from './no-computer'", `from '${repoUrl('shared/no-computer.mjs')}'`],
    ["from './pairing'", "from './pairing.mjs'"],
    ["from './relay'", "from './relay.mjs'"]
  ]
  for (const [from, to] of swaps) {
    assert.ok(src.includes(from), `useNoComputer.js no longer imports ${from}; the bench needs telling`)
    src = src.replaceAll(from, to)
  }
  const left = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((m) => !m.endsWith('.mjs'))
  assert.deepEqual(left, [], 'useNoComputer.js imports something the bench has no stand-in for')
  files['useNoComputer.mjs'] = "import { setInterval, clearInterval } from './timers.mjs'\n" + src
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    const { useNoComputer } = await import(at('useNoComputer.mjs'))
    const react = await import(at('react.mjs'))
    const { bench } = await import(at('relay.mjs'))
    const settle = async () => {
      for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
    }
    return {
      bench,
      draws: react.draws,
      draw: (active) => react.draw(useNoComputer, active),
      release: async () => {
        for (const resolve of bench.reading.splice(0)) resolve(bench.session)
        await settle()
      },
      answer: async (v) => {
        for (const resolve of bench.asking.splice(0)) resolve(v)
        await settle()
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/*
 * The phone's SendLinkButton, DRAWN: its JSX turned into plain calls by
 * esbuild (which Vite already brings), with React, React Native, the theme,
 * the download link and Press stood in for. `h` draws a component by calling
 * it, so the button comes back as the props it handed Press. The memory
 * (lib/sendLink.js) is the real one, and so is everything the button decides.
 */
async function sendButtonOnABench() {
  const { transformSync } = await import('esbuild')
  const dir = mkdtempSync(join(tmpdir(), 'send-link-'))
  const bench = { sent: [], said: [], answer: { ok: true } }
  globalThis.__sendLinkBench = bench
  const files = {
    'package.json': '{ "type": "module" }',
    'react.mjs': `
      export const useSyncExternalStore = (watch, get) => get()
      export const useEffect = () => {}
      export const useState = (v) => [v, () => {}]
    `,
    'react-native.mjs': 'export const AccessibilityInfo = { announceForAccessibility: (s) => globalThis.__sendLinkBench.said.push(s) }\n',
    'theme.mjs': 'export const TAP = 56\n',
    'downloadLink.mjs': `
      export async function sendDownloadLink(email) {
        globalThis.__sendLinkBench.sent.push(email)
        return globalThis.__sendLinkBench.answer
      }
    `,
    'Press.mjs': 'export default function Press(props) { return { drawn: "Press", props } }\n'
  }
  let src = read('mobile/src/components/SendLinkButton.js')
  const swaps = [
    ["from 'react'", "from './react.mjs'"],
    ["from 'react-native'", "from './react-native.mjs'"],
    ["from '../lib/theme'", "from './theme.mjs'"],
    ["from '../lib/downloadLink'", "from './downloadLink.mjs'"],
    ["from '../lib/sendLink'", `from '${repoUrl('mobile/src/lib/sendLink.js')}'`],
    ["from './Press'", "from './Press.mjs'"]
  ]
  for (const [from, to] of swaps) {
    assert.ok(src.includes(from), `SendLinkButton.js no longer imports ${from}; the bench needs telling`)
    src = src.replaceAll(from, to)
  }
  const code = transformSync(src, { loader: 'jsx', format: 'esm', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Fragment' }).code
  files['SendLinkButton.mjs'] = `const h = (type, props) => (typeof type === 'function' ? type({ ...(props || {}) }) : { drawn: type, props })\nconst Fragment = 'Fragment'\n${code}`
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  try {
    const { default: SendLinkButton } = await import(pathToFileURL(join(dir, 'SendLinkButton.mjs')).href)
    return { bench, draw: (props) => SendLinkButton(props) }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/*
 * THE OTHER WAY, DRAWN: the phone's NoComputerWords and its Fixes page, their
 * JSX turned into plain calls by esbuild, against the real
 * useBluetoothOffered (lib/useBluetoothOffered.js) and the real rule for the
 * full version (lib/unlock-rule.js), with the purchase, who may have
 * Bluetooth (beta) and whether the phone can do it stood in for, as the
 * bench says:
 *
 *   bench.purchase   what usePurchase() answers
 *   bench.allowed    what useBluetoothAllowed() answers: Justin's account
 *                    alone today, every customer false
 *   bench.supported  what bluetoothSupported() answers; `bench.asked` counts
 *                    every time it is asked
 *   bench.on         whether Bluetooth (beta) is on (lib/bleSwitch)
 *
 * The words are the phone's generated copy (lib/no-computer.js), and the
 * Fixes page's guide the shared one it is generated from: the copies are held
 * to their sources elsewhere. `h` draws a component by calling it, so a Note
 * comes back as { drawn: 'Note', tone, children }.
 *
 *   words(email)      NoComputerWords, as the text it says
 *   fixes(open)       the Fixes page with `open` unfolded, as a tree
 */
async function otherWayOnABench() {
  const { transformSync } = await import('esbuild')
  const dir = mkdtempSync(join(tmpdir(), 'no-computer-ble-'))
  const bench = { purchase: { unlocked: true, available: true }, allowed: false, supported: true, asked: 0, on: false }
  globalThis.__otherWayBench = bench
  const files = {
    'package.json': '{ "type": "module" }',
    'react.mjs': 'export const useState = (v) => [v, () => {}]\n',
    'react-native.mjs': "export const Text = 'Text'\nexport const View = 'View'\nexport const ScrollView = 'ScrollView'\n",
    'theme.mjs': 'const any = new Proxy({}, { get: () => 1 })\nexport const color = any\nexport const font = any\nexport const radius = any\nexport const space = any\n',
    'bluetooth.mjs': `
      const b = globalThis.__otherWayBench
      export const useBluetoothAllowed = () => b.allowed
      export function bluetoothSupported() { b.asked++; return b.supported }
    `,
    'purchases.mjs': 'const b = globalThis.__otherWayBench\nexport const usePurchase = () => ({ ...b.purchase })\n',
    'bleSwitch.mjs': 'const b = globalThis.__otherWayBench\nexport const bluetoothOn = () => b.on\n',
    'version.mjs': "export const APP_VERSION = '1.88.4'\n",
    'demo.mjs': 'export const isDemo = () => false\n',
    'device.mjs': 'export const vp4Capabilities = () => null\nexport const vp4Here = () => null\n',
    'vp4-safety.mjs': 'export const vp4ComputerLacks = () => null\n',
    'Note.mjs': "export default function Note({ children, ...props }) { return { drawn: 'Note', tone: props.tone, children } }\n",
    'Press.mjs': "export default function Press(props) { return { drawn: 'Press', props } }\n"
  }
  const H =
    "const h = (type, props, ...children) => (typeof type === 'function' ? type({ ...(props || {}), children }) : { drawn: type, props: props || {}, children })\n" +
    "const Fragment = 'Fragment'\n"
  const take = (from, as, swaps) => {
    let src = read(from)
    for (const [a, b] of swaps) {
      assert.ok(src.includes(a), `${from} no longer imports ${a}; the bench needs telling`)
      src = src.replaceAll(a, b)
    }
    const code = transformSync(src, { loader: 'jsx', format: 'esm', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Fragment' }).code
    const left = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((m) => !m.startsWith('./') && !m.startsWith('file:'))
    assert.deepEqual(left, [], `${from} imports something the bench has no stand-in for`)
    files[as] = (/\bh\(/.test(code) ? H : '') + code
  }
  take('mobile/src/lib/useBluetoothOffered.js', 'useBluetoothOffered.mjs', [
    ["from './bluetooth'", "from './bluetooth.mjs'"],
    ["from './purchases'", "from './purchases.mjs'"],
    ["from './unlock-rule'", `from '${repoUrl('mobile/src/lib/unlock-rule.js')}'`]
  ])
  take('mobile/src/components/NoComputer.js', 'NoComputer.mjs', [
    ["from 'react-native'", "from './react-native.mjs'"],
    ["from '../lib/no-computer'", `from '${repoUrl('mobile/src/lib/no-computer.js')}'`],
    ["from '../lib/useBluetoothOffered'", "from './useBluetoothOffered.mjs'"]
  ])
  take('mobile/src/screens/Fixes.js', 'Fixes.mjs', [
    ["from 'react'", "from './react.mjs'"],
    ["from 'react-native'", "from './react-native.mjs'"],
    ["from '../lib/theme'", "from './theme.mjs'"],
    ["from '../lib/troubleshooting'", `from '${repoUrl('shared/troubleshooting.mjs')}'`],
    ["from '../lib/version'", "from './version.mjs'"],
    ["from '../components/Note'", "from './Note.mjs'"],
    ["from '../components/Press'", "from './Press.mjs'"],
    ["from '../lib/bleSwitch'", "from './bleSwitch.mjs'"],
    ["from '../lib/demo'", "from './demo.mjs'"],
    ["from '../lib/device'", "from './device.mjs'"],
    ["from '../lib/vp4-safety'", "from './vp4-safety.mjs'"],
    ["from '../lib/no-computer'", `from '${repoUrl('mobile/src/lib/no-computer.js')}'`],
    ["from '../lib/useBluetoothOffered'", "from './useBluetoothOffered.mjs'"]
  ])
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  /* Everything said in a tree, in order, as one string. */
  const said = (node) =>
    node === null || node === undefined || node === false || node === true
      ? ''
      : Array.isArray(node)
        ? node.map(said).join('')
        : typeof node === 'object'
          ? said(node.children)
          : String(node)
  /* Every Note in a tree. */
  const notes = (node, out = []) => {
    if (Array.isArray(node)) for (const n of node) notes(n, out)
    else if (node && typeof node === 'object') {
      if (node.drawn === 'Note') out.push({ tone: node.tone, says: said(node.children) })
      notes(node.children, out)
    }
    return out
  }
  try {
    const { default: NoComputerWords } = await import(at('NoComputer.mjs'))
    const { default: Fixes } = await import(at('Fixes.mjs'))
    return {
      bench,
      said,
      notes,
      words: (email) => said(NoComputerWords({ email })),
      wordsTree: (email) => NoComputerWords({ email }),
      fixes: (open) => Fixes({ onBack: () => {}, open, hostVersion: null })
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  /* ------------------------------------------------------------------ */
  /* The account server                                                   */
  /* ------------------------------------------------------------------ */

  test('the account server answers only about the caller’s own account, yes or no', () => {
    const sql = sqlBody()
    assert.equal(sql, SQL_EXACTLY, 'the migration is not exactly the function that answers only about the caller')
    /* And the reasons, said one at a time, so a change to the line above has to answer them. */
    const body = sql.slice(sql.indexOf('as $$') + 5, sql.lastIndexOf('$$;'))
    assert.ok(!/\bor\b/i.test(body), 'the function has an “or”, which could answer yes about somebody else’s computer')
    assert.ok(!/\bcoalesce\b|\bnullif\b/i.test(body), 'the function turns “no caller” into an answer')
    assert.ok(!/\bunion\b/i.test(body), 'the function joins in another question')
    assert.equal((body.match(/\bauth\.sessions\b/g) || []).length, 1, 'the function looks at sessions more than once')
    assert.match(sql, /create or replace function public\.account_has_computer\(\) returns boolean/, 'it takes an argument, which could name another account, or says more than yes or no')
    assert.match(sql, /language sql stable security definer set search_path = '' as \$\$/, 'it is not a fixed-path security definer function, so a caller’s own schema could stand in for auth')
    /* The caller, and nobody else: every comparison on whose session it is, is with auth.uid(). */
    const owners = [...sql.matchAll(/\buser_id\s*(=|<>|!=|\bin\b|\bnot\b)\s*([^ ]+)/g)].map((m) => `${m[1]} ${m[2]}`)
    assert.deepEqual(owners, ['= auth.uid()'], `it looks at sessions that are not the caller’s own: ${owners.join(', ')}`)
    assert.match(sql, /when auth\.uid\(\) is null then null/, 'with no caller it answers something other than can’t tell')
    assert.match(sql, /from auth\.sessions s where s\.user_id = auth\.uid\(\) and s\.user_agent like 'node%'/, 'it is not asking whether a computer app’s device server has a session on this account')
    assert.ok(!/auth\.users/.test(sql), 'it reads account details, which it has no need of')
    assert.ok(!/\bip\b|x-forwarded-for|request\.headers/.test(sql), 'it looks at where anybody is, which this question has no need of')
    assert.ok(!/<>|!=/.test(sql), 'it compares the caller with other accounts')
    assert.match(sql, /revoke all on function public\.account_has_computer\(\) from public, anon;/, 'anybody at all, signed in or not, can ask')
    assert.match(sql, /grant execute on function public\.account_has_computer\(\) to authenticated;/, 'a signed-in phone cannot ask')
    assert.ok(!/to (anon|public)\b/.test(sql), 'it is granted to somebody who is not signed in')
  })

  test('each end asks about its own session only, and reads anything but true or false as can’t tell', async () => {
    for (const [end, make] of [['phone', phoneAsk], ['browser', webAsk]]) {
      const no = make(async () => ({ data: false, error: null }))
      assert.equal(await no.ask(), false, `${end}: a definite no is not read as one`)
      assert.deepEqual(no.calls, [['account_has_computer']], `${end}: asks something else, or names an account in the question`)
      assert.equal(await make(async () => ({ data: true, error: null })).ask(), true, `${end}: a yes is not read as one`)
      /* No caller: the server's null. */
      assert.equal(await make(async () => ({ data: null, error: null })).ask(), null, `${end}: no caller reads as a no`)
      /* An older database without the function. */
      const missing = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.account_has_computer without parameters' } }
      assert.equal(await make(async () => missing).ask(), null, `${end}: a database without the function reads as a no`)
      /* An error that still carries a false. */
      assert.equal(await make(async () => ({ data: false, error: { message: 'JWT expired' } })).ask(), null, `${end}: an error reads as a no`)
      /* No signal. */
      assert.equal(await make(async () => { throw new TypeError('Network request failed') }).ask(), null, `${end}: no signal reads as a no`)
      /* Something odd. */
      assert.equal(await make(async () => ({ data: 'false', error: null })).ask(), null, `${end}: an answer that is not a boolean reads as one`)
    }
    /* The browser with nobody signed in has no client at all. */
    assert.equal(await webAsk(null).ask(), null, 'browser: signed out reads as a no')
    const { hasComputerFrom } = await import('../shared/no-computer.mjs')
    assert.equal(hasComputerFrom({ data: false }), false)
    assert.equal(hasComputerFrom({ data: true }), true)
    for (const reply of [undefined, null, {}, { data: null }, { error: { message: 'x' } }, { data: false, error: {} }, { data: 0 }]) {
      assert.equal(hasComputerFrom(reply), null, `the shared reading takes ${JSON.stringify(reply)} for an answer`)
    }
  })

  /* ------------------------------------------------------------------ */
  /* When it is asked                                                     */
  /* ------------------------------------------------------------------ */

  test('the account server is asked at most once a minute', async () => {
    const { check, bench, me, later, ASK_EVERY_MS } = await checkOnABench()
    assert.equal(ASK_EVERY_MS, 60000, 'the limit is not a minute')
    await check.poke(me)
    assert.equal(bench.asks, 1, 'the first look did not ask')
    for (const ms of [1, 1000, 29000, 29998]) {
      later(ms)
      await check.poke(me)
    }
    assert.equal(bench.asks, 1, 'asked again inside the minute')
    later(1)
    await check.poke(me)
    assert.equal(bench.asks, 2, 'not asked again once the minute was up')
    /* Two screens asking at once are one question. */
    later(ASK_EVERY_MS)
    await Promise.all([check.poke(me), check.poke(me), check.poke(me)])
    assert.equal(bench.asks, 3, 'three screens asking at once asked three times')
    /* Nobody signed in is never asked about. */
    later(ASK_EVERY_MS)
    await check.poke(null)
    await check.poke({ id: '', email: 'x@example.com' })
    assert.equal(bench.asks, 3, 'asked with nobody signed in')
  })

  test('after a yes it is never asked again, and a computer answering on the relay is a yes', async () => {
    const yes = await checkOnABench()
    yes.bench.answer = () => true
    await yes.check.poke(yes.me)
    for (let i = 0; i < 10; i++) {
      yes.later(yes.ASK_EVERY_MS)
      await yes.check.poke(yes.me)
    }
    assert.equal(yes.bench.asks, 1, 'asked again after a yes')
    assert.equal(yes.check.none(yes.me.id), null, 'a yes says there is no computer')

    const seen = await checkOnABench()
    seen.check.seen(seen.me.id)
    await seen.check.poke(seen.me)
    seen.later(10 * seen.ASK_EVERY_MS)
    await seen.check.poke(seen.me)
    assert.equal(seen.bench.asks, 0, 'asked after a computer had answered on the relay')
    assert.equal(seen.check.none(seen.me.id), null)

    /* A no first, then the computer answers: the no is gone at once. */
    const late = await checkOnABench()
    await late.check.poke(late.me)
    assert.ok(late.check.none(late.me.id), 'the bench did not start from a no')
    late.check.seen(late.me.id)
    assert.equal(late.check.none(late.me.id), null, 'a computer answering on the relay left the no up')
  })

  /* ------------------------------------------------------------------ */
  /* What counts as a no                                                  */
  /* ------------------------------------------------------------------ */

  test('only a definite no from the account server is a no', async () => {
    const no = await checkOnABench()
    assert.equal(no.check.none(no.me.id), null, 'a no before anything was asked')
    await no.check.poke(no.me)
    assert.deepEqual(no.check.none(no.me.id), { email: 'player@example.com' }, 'a definite no is not said, or names no account')
    assert.equal(no.check.none('someone-else'), null, 'one account’s no is said about another')

    for (const [what, answer] of [
      ['no caller, or a missing function', () => null],
      ['an error', () => Promise.reject(new Error('fetch failed'))],
      ['no signal', () => { throw new TypeError('Network request failed') }],
      ['something odd', () => 'false']
    ]) {
      const b = await checkOnABench()
      b.bench.answer = answer
      await b.check.poke(b.me)
      assert.equal(b.check.none(b.me.id), null, `${what} reads as a no`)
    }

    /* A no, then a minute later an error: back to today's words, not a no held over. */
    const then = await checkOnABench()
    await then.check.poke(then.me)
    assert.ok(then.check.none(then.me.id))
    then.bench.answer = () => null
    then.later(then.ASK_EVERY_MS)
    await then.check.poke(then.me)
    assert.equal(then.check.none(then.me.id), null, 'an error after a no kept the no')

    /* Another account signing in starts again from nothing. */
    const other = await checkOnABench()
    await other.check.poke(other.me)
    other.bench.answer = () => true
    await other.check.poke({ id: 'u2', email: 'second@example.com' })
    assert.equal(other.bench.asks, 2, 'a second account inside the minute was not asked about')
    assert.equal(other.check.none('u2'), null)
    assert.equal(other.check.none(other.me.id), null, 'the first account’s no is still said after the second signed in')
  })

  /*
   * The same, with the answers still on their way: with bad signal one can
   * take seconds, and a new account can sign in, or the next minute come,
   * before it lands. Only the answer to the LAST question, about the account
   * signed in NOW, is ever listened to. The account server here holds every
   * answer until the test lets it go, so the order they land in is the test's.
   */
  test('an answer that lands after a newer question, or after another account has signed in, is not said', async () => {
    const flush = () => new Promise((r) => setImmediate(r))
    const A = { id: 'u-a', email: 'first@example.com' }
    const B = { id: 'u-b', email: 'second@example.com' }

    /* A is asked about, then B signs in and is asked about, then A's no lands. */
    const two = await checkOnABench()
    const held = []
    two.bench.answer = () => new Promise((resolve) => held.push(resolve))
    const askA = two.check.poke(A)
    const askB = two.check.poke(B)
    await flush()
    assert.equal(held.length, 2, 'the bench did not get both questions out')
    held[0](false)
    await askA
    assert.equal(two.check.none(B.id), null, 'the first account’s no, landing late, was said to the second account, who has a computer')
    assert.equal(two.check.none(A.id), null, 'a no is said about an account that is no longer the one signed in')
    held[1](true)
    await askB
    assert.equal(two.check.none(B.id), null, 'the second account’s own yes did not stand')
    assert.equal(two.check.none(A.id), null)

    /* The bench is not one that can never say no: B's own late no is said, naming B. */
    const own = await checkOnABench()
    const mine = []
    own.bench.answer = () => new Promise((resolve) => mine.push(resolve))
    const firstA = own.check.poke(A)
    const thenB = own.check.poke(B)
    await flush()
    mine[1](false)
    await thenB
    mine[0](true)
    await firstA
    assert.deepEqual(own.check.none(B.id), { email: B.email }, 'the second account’s own no was not said, or the first account’s late yes was taken for the second’s')

    /* One account, two questions a minute apart: the newer can't-tell lands first, then the older no. */
    const again = await checkOnABench()
    const out = []
    again.bench.answer = () => new Promise((resolve) => out.push(resolve))
    const older = again.check.poke(A)
    await flush()
    again.later(again.ASK_EVERY_MS)
    const newer = again.check.poke(A)
    await flush()
    assert.equal(out.length, 2, 'the bench did not ask again after the minute')
    out[1](null)
    await newer
    assert.equal(again.check.none(A.id), null)
    out[0](false)
    await older
    assert.equal(again.check.none(A.id), null, 'an older answer, landing after a newer one, was taken over it')
  })

  test('on the phone, one account’s no is never said to the next account to sign in', async () => {
    const A = { id: 'u-a', email: 'first@example.com' }
    const B = { id: 'u-b', email: 'second@example.com' }
    const phone = await phoneHookOnABench()

    /* A is signed in, the computer has been looked for fifteen seconds, and the account server says no. */
    phone.bench.session = A
    assert.equal(phone.draw(true), null, 'the words came up before anything was asked')
    await phone.release()
    assert.equal(phone.bench.asks, 1, 'the bench did not get as far as asking')
    await phone.answer(false)
    assert.deepEqual(phone.draw(true), { email: A.email }, 'the bench did not reach a definite no for the first account')

    /* A signs out: nothing is being looked for. */
    phone.bench.session = null
    assert.equal(phone.draw(false), null, 'the words stayed up with nothing being looked for')

    /* B signs in on the same phone, and the looking starts again — the phone still reading its own session. */
    phone.bench.session = B
    const from = phone.draws.length
    phone.draw(true)
    await phone.release()
    phone.draw(true)
    assert.equal(phone.bench.asks, 2, 'the second account was not asked about')
    phone.draw(true)
    /* B's own answer: a no that names B. */
    await phone.answer(false)
    assert.deepEqual(phone.draw(true), { email: B.email }, 'the second account’s own no is not said, or names somebody else')

    const said = phone.draws.slice(from).filter(Boolean)
    assert.ok(
      said.every((d) => d.email === B.email),
      `the second account was told about the first one’s computer: ${JSON.stringify(said)}`
    )
    const beforeB = phone.draws.slice(from, phone.draws.length - 1)
    assert.ok(beforeB.every((d) => d === null), 'the words came up for the second account before its own answer')
  })

  test('on the phone, a new account whose computer is set up never sees the old account’s no', async () => {
    const A = { id: 'u-a', email: 'first@example.com' }
    const B = { id: 'u-b', email: 'second@example.com' }
    const phone = await phoneHookOnABench()
    phone.bench.session = A
    phone.draw(true)
    await phone.release()
    await phone.answer(false)
    assert.ok(phone.draw(true), 'the bench did not reach a definite no for the first account')
    phone.bench.session = null
    phone.draw(false)

    /* B has a computer, and the phone is slow to read its own session. */
    phone.bench.session = B
    const from = phone.draws.length
    for (let i = 0; i < 3; i++) phone.draw(true)
    await phone.release()
    phone.draw(true)
    await phone.answer(true)
    phone.draw(true)
    assert.deepEqual(phone.draws.slice(from).filter(Boolean), [], 'an account with a computer was told it has none')
  })

  /* ------------------------------------------------------------------ */
  /* The words                                                            */
  /* ------------------------------------------------------------------ */

  test('the words are the ones approved, naming the account, and the address is the downloads page', async () => {
    const words = await import('../shared/no-computer.mjs')
    assert.equal(words.NO_COMPUTER_TITLE, 'No computer is signed in with this account yet.')
    assert.equal(
      words.noComputerBody('player@example.com'),
      'Install the Fractal Remote computer app on the computer your Fractal is plugged into, and sign in there with player@example.com. On that computer, go to fractal.newbold.cloud/downloads.'
    )
    assert.equal(
      `${words.noComputerSteps('player@example.com')} ${words.NO_COMPUTER_GO} ${words.NO_COMPUTER_ADDRESS}.`,
      words.noComputerBody('player@example.com'),
      'the browser’s pieces do not make the phone’s sentence'
    )
    assert.match(words.noComputerSteps(''), /sign in there with this same account\.$/, 'with no email the sentence names nobody')
    const downloads = read('mobile/src/lib/downloadLink.js').match(/export const DOWNLOADS_URL = '([^']+)'/)[1]
    assert.equal(words.NO_COMPUTER_ADDRESS, downloads, 'the address is not the downloads page the rest of the app gives')
    /* The phone carries a generated copy. */
    assert.match(read('scripts/sync-relay-rules.mjs'), /\{ source: '\.\.\/shared\/no-computer\.mjs', target: '\.\.\/mobile\/src\/lib\/no-computer\.js' \}/, 'the phone has no copy of the words')
    assert.ok(!/\bMac\b/.test(read('shared/no-computer.mjs').replace(/\/\*[\s\S]*?\*\//g, ' ')), 'the words call the computer a Mac')
  })

  test('on the phone the address is words, not a link; in the browser it may be a link', () => {
    const phone = read('mobile/src/components/NoComputer.js')
    const drawn = phone.replace(/\/\*[\s\S]*?\*\//g, ' ')
    assert.match(drawn, /\{NO_COMPUTER_TITLE\}/, 'the phone does not say the first line')
    assert.match(drawn, /\{noComputerBody\(email\)\}/, 'the phone does not say what to do, with the address')
    assert.ok(!/Linking|openURL|onPress|Press\b|https:/.test(drawn), 'the phone’s address can be tapped through to a download page')
    assert.match(drawn, /from '\.\.\/lib\/no-computer'/, 'the phone has words of its own')

    const web = flat('src/components/NoComputer.jsx')
    assert.match(web, /\{noComputerSteps\(email\)\} \{NO_COMPUTER_GO\}\{' '\} <a href=\{`https:\/\/\$\{NO_COMPUTER_ADDRESS\}`\} target="_blank" rel="noreferrer noopener"> \{NO_COMPUTER_ADDRESS\} <\/a> \. <\/p>/, 'the browser does not link the address, or says it differently')
    assert.match(web, /from '\.\.\/\.\.\/shared\/no-computer\.mjs'/, 'the browser has words of its own')
  })

  /* ------------------------------------------------------------------ */
  /* Where it is said                                                     */
  /* ------------------------------------------------------------------ */

  test('the phone asks only when the advice comes up, and never on Bluetooth, in the demo or signed out', () => {
    const app = flat('mobile/App.js')
    /* lookedLong is the fifteen seconds, and is never on in the demo or signed out (pinned in mobile.mjs). */
    assert.match(app, /const lookedLong = useLookedLong\(auth === 'in' && !demo && looking, /, 'the fifteen seconds run in the demo or signed out')
    assert.match(app, /const noComputer = useNoComputer\(lookedLong && !bluetooth\)/, 'the phone asks before the advice comes up, or over Bluetooth')
    const waking = app.slice(app.indexOf('function Waking('))
    assert.match(waking, /const noComputer = useNoComputer\(long && !bluetooth\)/, 'the waiting screen asks before its advice comes up, or over Bluetooth')
    assert.equal((app.match(/useNoComputer\(/g) || []).length, 2, 'the phone asks from somewhere else as well')

    const hook = read('mobile/src/lib/useNoComputer.js')
    assert.match(hook, /^const check = computerCheck\(accountHasComputer\)$/m, 'each screen keeps its own memory, so a yes is forgotten and the minute is not shared')
    assert.match(hook, /subscribeHostSeen\(\(up\) => \{\s*if \(up\) check\.seen\(remoteUserId\(\)\)\s*\}\)/, 'a computer answering on the relay is not a yes')
    assert.match(hook, /if \(!active\) \{\s*setWho\(null\)\s*return undefined\s*\}/, 'the phone asks while nothing is looking for the computer, or keeps whose account it was once the looking stops')
    assert.match(hook, /return active && who \? check\.none\(who\) : null/, 'the words can show when nothing is looking for the computer, or before the phone knows whose account it is')
    assert.match(hook, /const real = me && !isPairAccount\(me\.email\) \? me : null/, 'a pairing code’s account is asked about')
    assert.match(hook, /const me = await sessionAccount\(\)/, 'the phone does not know whose account it is asking about')
    /* The session is read off the phone, not asked of the server. */
    const relay = read('mobile/src/lib/relay.js')
    const session = relay.slice(relay.indexOf('export async function sessionAccount('), relay.indexOf('\n}\n', relay.indexOf('export async function sessionAccount(')))
    assert.match(session, /auth\.getSession\(\)/)
    assert.ok(!/getUser|rpc\(/.test(session), 'whose account it is asks the server')
  })

  test('the browser asks only when its advice comes up, and never for a pairing code', () => {
    const connect = flat('src/components/ConnectScreen.jsx')
    assert.match(connect, /const asking = \(state === 'joining' && long\) \|\| state === 'no-answer'/, 'the connect screen’s moment moved')
    assert.match(connect, /const none = useNoComputer\(asking && !paired && elsewhere === false, account\)/, 'the connect screen asks before its advice comes up, for a pairing code, or before the account warning has answered')
    const remote = flat('src/components/PhoneRemote.jsx')
    assert.match(remote, /const lost = link\.link === 'no-answer' && !isPairAccount\(email\)/, 'Setup asks before its advice comes up, or for a pairing code')
    assert.match(remote, /const none = useNoComputer\(lost && elsewhere === false, link\.account\)/, 'Setup asks before the account warning has answered')
    const hook = read('src/lib/noComputer.js')
    assert.match(hook, /^const check = computerCheck\(accountHasComputer\)$/m, 'each panel keeps its own memory')
    assert.match(hook, /subscribeHostSeen\(\(up\) => \{\s*if \(up\) check\.seen\(remoteUserId\(\)\)\s*\}\)/, 'a computer answering on the relay is not a yes')
    assert.match(hook, /const id = active && account\?\.id \? account\.id : null/, 'the browser asks while nothing is looking, or with nobody signed in')
    assert.match(hook, /if \(!id\) return undefined/)
    assert.match(hook, /return id \? check\.none\(id\) : null/)
  })

  test('the new words are only ever drawn behind a definite no, and today’s words stay for everything else', () => {
    /* The play screen's card. */
    const stage = flat('mobile/src/screens/Stage.js')
    const card = stage.slice(stage.indexOf("<Toast open={lost && !lostAway && !error} onLayout={endOf('advice')}>"))
    const advice = card.slice(0, card.indexOf('</Toast>'))
    assert.match(
      advice,
      /<Note tone="warn" onDismiss=\{\(\) => onPutAway\?\.\(\)\}> \{noComputer \? \( <NoComputerWords email=\{noComputer\.email\} \/> \) : \( <> The \{deviceNoun\(\)\} can’t reach your computer\. Open the Fractal Remote app on the computer and make sure the computer is awake\. This keeps trying on its own\. <\/> \)\} <\/Note>/,
      'the play screen says the new words without a definite no, or lost today’s'
    )
    assert.match(advice, /<Press label="Look for the computer again" height=\{44\} onPress=\{\(\) => onLookAgain\?\.\(\)\} \/>/, 'Look for the computer again went')
    assert.match(advice, /<Press label="Troubleshooting" height=\{44\} onPress=\{\(\) => onOpenFix\('connect'\)\} \/>/, 'Troubleshooting went')
    assert.match(stage, /export default function Stage\(\{[^}]*\bnoComputer = null,/, 'the play screen starts from a no')
    const app = flat('mobile/App.js')
    assert.match(app, /noComputer=\{noComputer\} lost=\{lookedLong && !bluetooth && !elsewhereSaid\}/, 'the play screen is not told, or the card shows over the account warning')

    /* The waiting screen. */
    const waking = app.slice(app.indexOf('function Waking('))
    assert.match(waking, /const noneSaid = Boolean\(noComputer\) && !bluetooth && elsewhere === false/, 'the waiting screen says it over Bluetooth, or before the account warning has answered')
    assert.match(
      waking,
      /\) : elsewhere \? \( <Note tone="fault">[\s\S]*?<\/Note> \) : noneSaid \? \( <Note tone="warn"> <NoComputerWords email=\{noComputer\.email\} \/> <\/Note> \) : \( <Note tone="warn"> Open the Fractal Remote app on the computer and make sure the computer is awake\. This keeps trying on its own\. <\/Note> \)\}/,
      'the waiting screen puts the new words before the account warning, or lost today’s'
    )
    assert.match(waking, /<Press label="Look for the computer again" onPress=\{\(\) => onRetry\?\.\(\)\} \/>/, 'Look for the computer again went')
    assert.match(waking, /\{onTroubleshoot && !bluetooth \? <Press label="Troubleshooting" onPress=\{onTroubleshoot\} \/> : null\}/, 'Troubleshooting went')

    /* Settings → Phone & computer. */
    const settings = flat('mobile/src/screens/Settings.js')
    assert.match(settings, /const noneSaid = link === 'no-answer' && Boolean\(noComputer\) && elsewhere === false/, 'Setup says it before the account warning has answered')
    assert.match(
      settings,
      /\{link === 'no-answer' && elsewhere \? \( <Note tone="fault">[\s\S]*?<\/Note> \) : noneSaid \? \( <Note tone="warn"> <NoComputerWords email=\{noComputer\.email\} \/> <\/Note> \) : link === 'no-answer' \? \( <Note tone="warn"> Open the Fractal Remote app on the computer and make sure the computer is awake\. This keeps trying on its own\. <\/Note> \) : null\}/,
      'Setup puts the new words before the account warning, or lost today’s'
    )
    assert.match(app, /noComputer=\{noComputer\} \/\* As the top bar says it[^*]*\*\/ link=\{shownLink\.link\}/, 'Setup is not told')

    /* Nowhere else on the phone. */
    const uses = []
    for (const file of ['mobile/App.js', 'mobile/src/screens/Stage.js', 'mobile/src/screens/Settings.js', 'mobile/src/components/WrongAccount.js']) {
      for (const m of read(file).matchAll(/<NoComputerWords /g)) uses.push(`${file}@${m.index}`)
    }
    assert.equal(uses.length, 3, `the phone says it somewhere else as well: ${uses.join(', ')}`)

    /* The browser's connect screen: both states, the warning first, today's words otherwise. */
    const connect = flat('src/components/ConnectScreen.jsx')
    assert.match(connect, /const noneSaid = !mismatch && none \? <NoComputer email=\{none\.email\}/, 'the connect screen says it over the account warning')
    assert.equal((connect.match(/\{mismatch \|\| noneSaid \|\| \( <p[^>]*> Make sure the Fractal Remote app is open on the computer and the computer is awake\. This keeps trying on its own\. <\/p> \)\}/g) || []).length, 2, 'Connecting or Not answering lost today’s words, or put the new ones first')
    assert.equal((connect.match(/<NoComputer /g) || []).length, 1, 'the connect screen says it somewhere else as well')
    assert.equal((connect.match(/onClick=\{onRetry\}/g) || []).length, 2, 'Try now went')
    assert.equal((connect.match(/onClick=\{onTroubleshoot\}/g) || []).length, 2, 'Troubleshooting went')

    /* The browser's Setup. */
    const remote = flat('src/components/PhoneRemote.jsx')
    assert.match(
      remote,
      /\{none \? \( <NoComputer email=\{none\.email\} className="hint" \/> \) : \( <p className="hint"> Make sure the Fractal Remote app is open on the computer and the computer is awake\. This keeps trying on its own\. <\/p> \)\}/,
      'Setup says the new words without a definite no, or lost today’s'
    )
    assert.equal((remote.match(/<NoComputer /g) || []).length, 1, 'Setup says it somewhere else as well')
  })

  test('beside the new words: no “make sure you’re connected”, and the browser keeps its way to the download', () => {
    /*
     * "Make sure you're connected to your computer using <email>" beside "No
     * computer is signed in with this account yet" says the opposite of it,
     * and names the account a second time. Gone wherever the new words are.
     */
    const settings = flat('mobile/src/screens/Settings.js')
    assert.match(
      settings,
      /\{link === 'no-answer' && account\?\.email && !isPairAccount\(account\.email\) && !noneSaid \? \( <Note>\{`Make sure you’re connected to your computer using \$\{account\.email\}\.`\}<\/Note> \) : null\}/,
      'Phone & computer says “make sure you’re connected” beside the new words'
    )
    const app = flat('mobile/App.js')
    const waking = app.slice(app.indexOf('function Waking('))
    assert.match(
      waking,
      /\{email && link\.link !== 'connected' && !bluetooth && !noneSaid \? \( <Text[^>]*> \{'Make sure you’re connected to your computer using '\}/,
      'the waiting screen says “make sure you’re connected” over the new words'
    )
    const connect = flat('src/components/ConnectScreen.jsx')
    assert.match(connect, /\{account && !noneSaid \? <Using email=\{remembered\} paired=\{paired\} \/> : null\}/, 'Connecting… says “make sure you’re connected” beside the new words')
    assert.match(connect, /\{noneSaid \? null : <Using email=\{remembered\} paired=\{paired\} \/>\}/, 'Not answering says “make sure you’re connected” beside the new words')

    /*
     * The customer we know has no computer keeps the big Download button (or,
     * on a phone or tablet, the address to copy): only the question "Haven't
     * set up the computer yet?" goes, because the new words have answered it.
     */
    const noAnswer = connect.slice(connect.indexOf("state === 'no-answer' ? ("), connect.indexOf('<h2>Connect to your computer</h2>'))
    assert.match(noAnswer, /<NoComputerYet asked=\{!noneSaid\} \/>/, 'Not answering drops the download under the new words, or keeps the question')
    const yet = connect.slice(connect.indexOf('function NoComputerYet('))
    const drawn = yet.slice(0, yet.indexOf(' } /**'))
    assert.match(drawn, /^function NoComputerYet\(\{ asked = true \}\)/, 'everywhere else loses the question')
    assert.match(
      drawn,
      /\{asked \? \( <p className="hint"> Haven&rsquo;t set up the computer yet\?[\s\S]*?<\/p> \) : null\} \{onPhone \? \(/,
      'the question is not the only thing the new words take away'
    )
    assert.match(drawn, /\{P6\.downloadNow\}/, 'the Download button went')
    assert.match(drawn, /className="connect-copy" onClick=\{copy\}/, 'the address to copy went')

    /* The address in the browser reads on the dark page: not the browser's own link blue. */
    const web = flat('src/components/NoComputer.jsx')
    assert.match(web, /<p className=\{className \? `no-computer \$\{className\}` : 'no-computer'\} role="status">/, 'the browser’s words have no class to colour the address by')
    const css = flat('src/styles.css')
    assert.match(css, /\.no-computer a \{ color: var\(--silk\); text-decoration: underline; text-underline-offset: 2px; \}/, 'the downloads address is drawn in the browser’s link blue, about 2:1 on the dark page')
  })

  test('the account warning waits for its answer, so the new words never come up a moment before it', () => {
    /* Null until answered at both ends; the account warning reads null as "not yet", the new words wait for false. */
    const hook = flat('mobile/src/lib/useComputerElsewhere.js')
    assert.match(hook, /const \[elsewhere, setElsewhere\] = useState\(null\)/, 'the phone’s account check starts from a no')
    assert.match(hook, /if \(!active\) \{ setElsewhere\(null\)/, 'the phone’s account check forgets to an answer rather than to not asked')
    const connect = flat('src/components/ConnectScreen.jsx')
    assert.match(connect, /const \[elsewhere, setElsewhere\] = useState\(null\)/, 'the connect screen’s account check starts from a no')
    assert.match(connect, /if \(!asking \|\| paired\) \{ setElsewhere\(null\)/)
    /* And the warning is still said as it was. */
    assert.match(connect, /const mismatch = elsewhere \? <Mismatch email=\{remembered\} \/> : null/)
    assert.match(flat('mobile/src/components/WrongAccount.js'), /const saying = Boolean\(active && elsewhere\)/)
  })

  /* ------------------------------------------------------------------ */
  /* "Send me the download link"                                          */
  /* ------------------------------------------------------------------ */

  /*
   * "Add a 'Send me the download link' button on the three screens where
   * they get stuck" — Justin, 15 October 2026. Under the words that say no
   * computer was ever set up, on the waiting screen, the play screen's card
   * and Phone & computer, and only behind the same definite no.
   */
  test('the download link button is under the no-computer words on all three screens, behind the same no, and nowhere else', () => {
    const app = flat('mobile/App.js')
    const waking = app.slice(app.indexOf('function Waking('))
    const wakingWords = waking.indexOf('<NoComputerWords email={noComputer.email} />')
    const wakingButton = waking.indexOf('{noneSaid ? <SendLinkButton email={noComputer.email} /> : null}')
    assert.ok(wakingWords > 0, 'the waiting screen lost the words')
    assert.ok(wakingButton > wakingWords, 'the waiting screen has no download link button under the words, or not behind the same no')
    assert.ok(wakingButton < waking.indexOf('<Press label="Look for the computer again"'), 'the waiting screen’s button is not with the words, above Look for the computer again')

    const stage = flat('mobile/src/screens/Stage.js')
    const card = stage.slice(stage.indexOf("<Toast open={lost && !lostAway && !error} onLayout={endOf('advice')}>"))
    const advice = card.slice(0, card.indexOf('</Toast>'))
    const stageButton = advice.indexOf('{noComputer ? <SendLinkButton email={noComputer.email} height={44} /> : null}')
    assert.ok(stageButton > advice.indexOf('</Note>'), 'the play screen’s card has no download link button under its words, behind the same no, at 44')
    assert.ok(stageButton < advice.indexOf('<Press label="Look for the computer again"'), 'the play screen’s button is not above Look for the computer again')
    assert.ok(stage.indexOf('<SendLinkButton ') > stage.indexOf('</ScrollView>'), 'the button is in the scrolling content, where it pushes the foot under a thumb')

    const settings = flat('mobile/src/screens/Settings.js')
    const settingsWords = settings.indexOf('<NoComputerWords email={noComputer.email} />')
    const settingsButton = settings.indexOf('{noneSaid ? <SendLinkButton email={noComputer.email} /> : null}')
    assert.ok(settingsButton > settingsWords && settingsWords > 0, 'Phone & computer has no download link button under the words, or not behind the same no')
    assert.ok(settingsButton < settings.indexOf('Make sure you’re connected to your computer using'), 'Phone & computer’s button is not with the words')

    /* Three, and only three, on the whole phone; never inside the words themselves, which stay words. */
    const uses = []
    const walk = (dir) => {
      for (const name of readdirSync(new URL(`../${dir}`, import.meta.url))) {
        const path = `${dir}/${name}`
        if (statSync(new URL(`../${path}`, import.meta.url)).isDirectory()) walk(path)
        else if (/\.js$/.test(name)) for (const m of read(path).matchAll(/<SendLinkButton /g)) uses.push(`${path}@${m.index}`)
      }
    }
    walk('mobile/src')
    for (const m of read('mobile/App.js').matchAll(/<SendLinkButton /g)) uses.push(`mobile/App.js@${m.index}`)
    assert.equal(uses.length, 3, `the button is drawn somewhere else as well, or somewhere is missing it: ${uses.join(', ')}`)
    assert.ok(!/SendLinkButton|sendDownloadLink/.test(read('mobile/src/components/NoComputer.js')), 'the words about the download became a button')
  })

  test('the button sends the account’s own address through the download-link function the walkthrough uses, and nothing else', () => {
    const code = read('mobile/src/components/SendLinkButton.js').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
    const imports = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1])
    assert.deepEqual(imports, ['react', 'react-native', '../lib/theme', '../lib/downloadLink', '../lib/sendLink', './Press'], 'the button reaches for something besides the download link')
    assert.match(code, /import \{ sendDownloadLink \} from '\.\.\/lib\/downloadLink'/, 'the button does not send through the download link the walkthrough uses')
    assert.match(code, /^const sender = linkSender\(sendDownloadLink\)$/m, 'each button keeps its own memory, or sends some other way')
    assert.ok(!/\bfetch\(|Linking|openURL|supabase|https?:|TextInput/.test(code), 'the button opens a page, asks the server something else, or takes a typed address')
    assert.match(code, /sender\.press\(email\)/, 'the button sends something other than the address it was given')
    /* Given the account's own address, at every place it is drawn. */
    for (const file of ['mobile/App.js', 'mobile/src/screens/Stage.js', 'mobile/src/screens/Settings.js']) {
      for (const m of flat(file).matchAll(/<SendLinkButton ([^/]*)\/>/g)) {
        assert.match(m[1], /^email=\{noComputer\.email\}( height=\{44\})? $/, `${file} hands the button an address other than the account’s own: ${m[1]}`)
      }
    }
    /* The download link itself is the deployed function, as it was. */
    const link = read('mobile/src/lib/downloadLink.js')
    assert.match(link, /fetch\(`\$\{DEFAULT_PROJECT\.url\}\/functions\/v1\/download-link`/, 'the download link goes somewhere other than the download-link function')
    assert.match(link, /body: JSON\.stringify\(\{ email: addr \}\)/, 'the download link sends more than the address')
    /* And the memory is plain, so it can be run. */
    assert.ok(!/^import /m.test(read('mobile/src/lib/sendLink.js')), 'lib/sendLink.js imports something, so a test can no longer run it as it is')
  })

  test('the button says one short line at a time, and a link sent from one screen reads as sent on the others for ten minutes', async () => {
    const { linkSender, sendLinkSaid, SEND_LINK, SENT_FOR_MS } = await import('../mobile/src/lib/sendLink.js')
    assert.equal(SENT_FOR_MS, 10 * 60 * 1000, '“Sent” is not held for the download-link function’s own ten minutes')
    const rate = read('supabase/functions/download-link/index.ts').match(/const EVERY_MINUTES = (\d+)/)?.[1]
    assert.equal(Number(rate) * 60 * 1000, SENT_FOR_MS, 'the button and the download-link function disagree about how long one send lasts')
    assert.deepEqual(SEND_LINK, {
      idle: 'Send me the download link',
      sending: 'Sending…',
      sent: 'Sent. Check your email',
      failed: 'Didn’t send. Tap to try again'
    })
    /* One line on the smallest phone: short, and never two lines. */
    for (const label of Object.values(SEND_LINK)) {
      assert.ok(!label.includes('\n') && label.length <= 30, `“${label}” could take two lines and move the card`)
    }

    const clock = { t: 5_000_000 }
    const sent = []
    let answer = () => ({ ok: true })
    const held = []
    const send = (email) => {
      sent.push(email)
      return new Promise((resolve, reject) => held.push(() => {
        try {
          resolve(answer())
        } catch (err) {
          reject(err)
        }
      }))
    }
    const memory = linkSender(send, () => clock.t)
    const told = []
    memory.watch(() => told.push(memory.phase('player@example.com')))
    const land = async (p) => {
      held.shift()()
      await p
    }

    assert.equal(memory.phase('player@example.com'), 'idle')
    const first = memory.press(' Player@Example.com ')
    assert.equal(memory.phase('player@example.com'), 'sending', 'a link on its way does not say so')
    assert.equal(await memory.press('player@example.com'), null, 'a second tap while one is on its way sends again')
    await land(first)
    assert.deepEqual(sent, ['Player@Example.com'], 'it sent something other than the address it was given, or sent twice')
    /* Another screen, the same account: the same answer. */
    assert.equal(memory.phase('PLAYER@example.com'), 'sent', 'a link sent from one screen does not read as sent on another')
    assert.equal(await memory.press('player@example.com'), null, 'a tap inside the ten minutes sends again, which the function would swallow')
    clock.t += SENT_FOR_MS - 1
    assert.equal(memory.phase('player@example.com'), 'sent')
    assert.ok(memory.sentLeft('player@example.com') === 1, 'the button does not know when “Sent” runs out')
    clock.t += 1
    assert.equal(memory.phase('player@example.com'), 'idle', '“Sent” stays after the ten minutes')
    assert.deepEqual(told, ['sending', 'sent'], 'the other screens are not told')

    /* Refused, said as a failure with its reason, and a tap tries again. */
    answer = () => ({ ok: false, message: 'Email isn’t set up yet. Open fractal.newbold.cloud/downloads on your computer.' })
    const second = memory.press('player@example.com')
    await land(second)
    assert.equal(memory.phase('player@example.com'), 'failed')
    assert.match(sendLinkSaid('failed', 'player@example.com', memory.why('player@example.com')).spoken, /^The download link didn’t send\. Email isn’t set up yet\./, 'a screen reader is not told why')
    answer = () => {
      throw new Error('offline')
    }
    const third = memory.press('player@example.com')
    await land(third)
    assert.equal(memory.phase('player@example.com'), 'failed', 'a send that threw reads as sent')
    assert.equal(sent.length, 3)

    /* No address, no send. */
    assert.equal(await memory.press(''), null)
    assert.equal(await memory.press(null), null)
    assert.equal(sent.length, 3, 'it sent with no address')

    /* What each moment says, and whether a tap does anything. */
    assert.deepEqual(sendLinkSaid('idle', 'a@b.co'), { label: 'Send me the download link', spoken: 'Send me the download link. It goes to a@b.co.', busy: false })
    assert.equal(sendLinkSaid('sending', 'a@b.co').busy, true)
    /* Sent is the line that says it worked: drawn at full strength, never dimmed (a tap on it sends nothing; see press above). */
    assert.equal(sendLinkSaid('sent', 'a@b.co').busy, false, 'Sent is dimmed, so the line that says it worked is hard to read')
    assert.match(sendLinkSaid('sent', 'a@b.co').spoken, /^Sent the download link to a@b\.co\. Open it on the computer your Fractal is plugged into\.$/)
    assert.equal(sendLinkSaid('failed', 'a@b.co').busy, false, 'a failure cannot be tried again')
    for (const phase of ['idle', 'sending', 'sent', 'failed']) {
      assert.ok(!/\bMac\b/.test(sendLinkSaid(phase, 'a@b.co', 'x').spoken), 'the button calls the computer a Mac')
    }
  })

  test('the button, drawn: nothing without an address, one label at a fixed height with nothing under it, and the account’s own address sent', async () => {
    const { bench, draw } = await sendButtonOnABench()
    assert.equal(draw({ email: '' }), null, 'a button with no address to send to is drawn')
    assert.equal(draw({ email: '   ' }), null)
    assert.equal(draw({}), null)

    const onPlay = draw({ email: 'fan@example.com', height: 44 })
    assert.equal(onPlay.drawn, 'Press')
    assert.equal(onPlay.props.label, 'Send me the download link')
    assert.equal(onPlay.props.height, 44, 'the play screen’s button is not the height of the buttons beside it')
    for (const grows of ['sub', 'caption', 'icon', 'after', 'badge']) {
      assert.equal(onPlay.props[grows], undefined, `the button has a ${grows}, which can change its height`)
    }
    assert.equal(onPlay.props.disabled, false)
    assert.match(onPlay.props.accessibilityLabel, /fan@example\.com/, 'a screen reader is not told where it goes')
    assert.equal(draw({ email: 'fan@example.com' }).props.height, 56, 'off the play screen the button is not a full-size button')

    await onPlay.props.onPress()
    assert.deepEqual(bench.sent, ['fan@example.com'], 'the button sent something other than the address it was given')
    const after = draw({ email: 'fan@example.com', height: 44 })
    assert.equal(after.props.label, 'Sent. Check your email')
    assert.equal(after.props.disabled, false, 'Sent is drawn dimmed and faint, so the line that says it worked is hard to read')
    await after.props.onPress()
    assert.deepEqual(bench.sent, ['fan@example.com'], 'a tap on Sent sent the link again')
    assert.equal(after.props.height, 44, 'the button changed height with its words')
    assert.match(bench.said.at(-1) || '', /^Sent the download link to fan@example\.com\./, 'a screen reader is not told it went')
    /* Another screen, drawn after: it went. */
    assert.equal(draw({ email: 'FAN@example.com' }).props.label, 'Sent. Check your email', 'another screen offers to send it again')

    bench.answer = { ok: false, message: 'Couldn’t reach the mail service.' }
    const other = draw({ email: 'second@example.com' })
    const going = other.props.onPress()
    /* On its way: dimmed, the one moment a tap does nothing and it says so. */
    const sending = draw({ email: 'second@example.com' })
    assert.equal(sending.props.label, 'Sending…')
    assert.equal(sending.props.disabled, true, 'Sending… looks like it can be tapped again')
    await going
    assert.equal(draw({ email: 'second@example.com' }).props.label, 'Didn’t send. Tap to try again')
    assert.match(bench.said.at(-1) || '', /Couldn’t reach the mail service\./, 'a screen reader is not told why it did not send')
    delete globalThis.__sendLinkBench
  })

  /* ------------------------------------------------------------------ */
  /* The other way: Bluetooth (beta), for an AM4                         */
  /* ------------------------------------------------------------------ */

  /*
   * Once Bluetooth (beta) opens to customers (store version 1.89.0, the AM4
   * only), an AM4 owner may never sign a computer in, and "No computer is
   * signed in with this account yet" alone tells them the computer is the
   * only way. Justin, on how it is to be put: "make it clear that there's
   * multiple ways to connect the device, but also make it clear that the
   * computer is the preferred method and that Bluetooth will have more lag
   * and not have as many features." It is said only where this copy offers
   * Bluetooth (beta) — and on every customer's copy today it does not, so
   * there the words must be exactly what they were.
   */
  test('the other way’s words: a second way for an AM4, the computer still the best, what Bluetooth costs, and where it is', async () => {
    const words = await import('../shared/no-computer.mjs')
    const line = words.NO_COMPUTER_BLUETOOTH
    assert.equal(
      line,
      'Have an AM4? The app can also connect to it with no computer, by Bluetooth (beta) through an adapter. The computer is still the best way: Bluetooth is slower and does less, with no editing or saving. Settings → My rig → Bluetooth (beta) says what to buy.'
    )
    /* In Justin's order: more than one way, the computer the best of them, what Bluetooth costs, then where. */
    const at = ['AM4', 'with no computer', 'The computer is still the best way', 'slower and does less', 'no editing or saving', 'Settings → My rig → Bluetooth (beta)'].map((w) => line.indexOf(w))
    assert.ok(at.every((i) => i >= 0), 'the line lost one of the things it has to say')
    assert.deepEqual([...at].sort((a, b) => a - b), at, 'the line says them out of order: the computer is not named the best before what Bluetooth costs')
    /* What it costs, only as far as the Bluetooth page itself says it. */
    const page = read('mobile/src/screens/Bluetooth.js')
    assert.ok(page.includes("'No editing or saving over Bluetooth.'"), 'the Bluetooth page no longer says there is no editing or saving; the line should not either')
    assert.ok(page.includes("'Slower to load the preset list.'"), 'the Bluetooth page no longer says it is slower; the line should not either')
    /* Where it sends them is a row that is there: Bluetooth (beta), under My rig. */
    const settings = flat('mobile/src/screens/Settings.js')
    const rig = settings.indexOf('<Group title="My rig">')
    const row = settings.indexOf('<SetupRow title="Bluetooth (beta)"')
    assert.ok(rig > 0 && row > rig && row < settings.indexOf('<Group title=', rig + 1), 'Settings has no Bluetooth (beta) row under My rig, where the line sends them')
    /* Plain, for every device and both stores: no phone named, no other platform, and nothing official. */
    assert.ok(!/\bphone\b|iPhone|Android|iPad|tablet|\bMac\b|official|endorsed|approved/i.test(line), `the line says something it should not: ${line}`)
    /* The browser has no Bluetooth (beta), and never says it. */
    for (const file of ['src/components/NoComputer.jsx', 'src/components/ConnectScreen.jsx', 'src/components/PhoneRemote.jsx', 'src/App.jsx']) {
      assert.ok(!read(file).includes('NO_COMPUTER_BLUETOOTH'), `${file} offers Bluetooth (beta), which a browser does not have`)
    }
  })

  test('the other way is said only where the Bluetooth (beta) row is drawn: the row’s own gate, in its order', () => {
    /* The row, and its page, behind the full version, then who may have it, then whether the phone can do it. */
    const settings = flat('mobile/src/screens/Settings.js')
    assert.match(settings, /\{mayDrive\(purchase\) && bluetoothAllowed && bluetoothSupported\(\) \? \( <SetupRow title="Bluetooth \(beta\)"/, 'the Bluetooth (beta) row is behind a different gate now; lib/useBluetoothOffered.js must be the same one')
    assert.match(settings, /const bluetoothAllowed = useBluetoothAllowed\(\)/)
    assert.match(settings, /const purchase = usePurchase\(\)/)
    /* The hook, the same three, in the same order, and nothing else deciding. */
    const hook = read('mobile/src/lib/useBluetoothOffered.js').replace(/\/\*[\s\S]*?\*\//g, ' ')
    assert.deepEqual([...hook.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]), ['./bluetooth', './purchases', './unlock-rule'], 'the hook asks something besides the row’s three')
    assert.match(hook, /const purchase = usePurchase\(\)\s+const allowed = useBluetoothAllowed\(\)\s+return mayDrive\(purchase\) && allowed && bluetoothSupported\(\)/, 'the hook is not the row’s gate, or asks the phone whether it can do Bluetooth before who may have it')
    assert.ok(!/isAdmin|Platform|APP_VERSION|expoConfig|storeVersion/.test(hook), 'the hook decides who may have Bluetooth (beta) for itself: that is useBluetoothAllowed’s alone')

    /* Drawn in the words themselves, after the computer’s steps, and nowhere on the phone but there and Fixes. */
    const drawn = flat('mobile/src/components/NoComputer.js').replace(/\/\*[\s\S]*?\*\//g, ' ')
    assert.match(drawn, /const bluetooth = useBluetoothOffered\(\)/)
    assert.match(drawn, /\{noComputerBody\(email\)\} \{bluetooth \? `\\n\\n\$\{NO_COMPUTER_BLUETOOTH\}` : null\} <\/>/, 'the other way is not after the computer’s steps, or not behind the hook')
    const fixes = flat('mobile/src/screens/Fixes.js')
    assert.match(fixes, /const bluetoothOffered = useBluetoothOffered\(\)/)
    assert.match(fixes, /\{fix\.id === 'connect' && bluetoothOffered && !bluetoothOn\(\) \? \( <Note tone="hint">\{NO_COMPUTER_BLUETOOTH\}<\/Note> \) : null\}/, 'Fixes says the other way somewhere other than under It will not connect at all, or not behind the hook')
    const uses = []
    const walk = (dir) => {
      for (const name of readdirSync(new URL(`../${dir}`, import.meta.url))) {
        const path = `${dir}/${name}`
        if (statSync(new URL(`../${path}`, import.meta.url)).isDirectory()) walk(path)
        /* Said, not mentioned: comments name it, and the generated copy defines it. */
        else if (/\.js$/.test(name) && path !== 'mobile/src/lib/no-computer.js' && read(path).replace(/\/\*[\s\S]*?\*\//g, ' ').includes('NO_COMPUTER_BLUETOOTH')) uses.push(path)
      }
    }
    walk('mobile/src')
    if (read('mobile/App.js').replace(/\/\*[\s\S]*?\*\//g, ' ').includes('NO_COMPUTER_BLUETOOTH')) uses.push('mobile/App.js')
    assert.deepEqual(uses.sort(), ['mobile/src/components/NoComputer.js', 'mobile/src/screens/Fixes.js'], 'the other way is said somewhere else on the phone as well')
  })

  test('the no-computer words, drawn: word for word as they were wherever this copy does not offer Bluetooth (beta), and the AM4’s other way where it does', async () => {
    const b = await otherWayOnABench()
    const words = await import('../mobile/src/lib/no-computer.js')
    const before = `${words.NO_COMPUTER_TITLE}\n${words.noComputerBody('fan@example.com')}`
    const after = `${before}\n\n${words.NO_COMPUTER_BLUETOOTH}`

    /* Every customer's copy today: not theirs to have. The full version, a phone that can do it, and still nothing — and the phone never asked. */
    b.bench.allowed = false
    assert.equal(b.words('fan@example.com'), before, 'a customer’s copy is told about Bluetooth (beta), or its words changed')
    assert.equal(b.bench.asked, 0, 'a phone Bluetooth (beta) is not open to was asked whether it can do Bluetooth')
    /* The title is still its own bold line. */
    const tree = b.wordsTree('fan@example.com')
    assert.equal(tree.drawn, 'Fragment')
    assert.equal(tree.children[0].drawn, 'Text')
    assert.equal(b.said(tree.children[0]), words.NO_COMPUTER_TITLE)

    /* Where it is offered: the row's three yeses. */
    b.bench.allowed = true
    assert.equal(b.words('fan@example.com'), after, 'where Bluetooth (beta) is offered, the words do not add the other way after the computer’s')
    assert.equal(b.bench.asked, 1)

    /* Allowed, but each of the other two a no: the words as they were. */
    b.bench.supported = false
    assert.equal(b.words('fan@example.com'), before, 'a phone that cannot do Bluetooth is sent to a row it does not have')
    b.bench.supported = true
    b.bench.purchase = { unlocked: false, available: true }
    const asked = b.bench.asked
    assert.equal(b.words('fan@example.com'), before, 'a copy without the full version is sent to a row it does not have')
    assert.equal(b.bench.asked, asked, 'the phone was asked whether it can do Bluetooth before the full version was')
    /* A store that cannot take money is no paywall (unlock-rule mayDrive), and the row shows: so does the line. */
    b.bench.purchase = { unlocked: false, available: false }
    assert.equal(b.words('fan@example.com'), after, 'where the row shows with purchasing impossible, the words do not say it')
    /* With no email, the same: only the account's name changes. */
    b.bench.purchase = { unlocked: true, available: true }
    assert.equal(b.words(''), `${words.NO_COMPUTER_TITLE}\n${words.noComputerBody('')}\n\n${words.NO_COMPUTER_BLUETOOTH}`)
    delete globalThis.__otherWayBench
  })

  test('Fixes, drawn: the other way under “It will not connect at all”, only where this copy offers Bluetooth (beta) and it is off, and the page as it was everywhere else', async () => {
    const b = await otherWayOnABench()
    const { NO_COMPUTER_BLUETOOTH } = await import('../mobile/src/lib/no-computer.js')
    const { fixById } = await import('../shared/troubleshooting.mjs')
    const says = (open) => b.said(b.fixes(open))
    const lines = (open) => b.notes(b.fixes(open)).filter((n) => n.says === NO_COMPUTER_BLUETOOTH)

    /* Every customer's copy today: nothing about Bluetooth on the page at all, whichever fix is open. */
    b.bench.allowed = false
    for (const open of [null, 'connect', 'frozen', 'versions', 'preset']) {
      assert.deepEqual(lines(open), [], `a customer’s copy is told about Bluetooth (beta) on Fixes (${open})`)
      assert.ok(!/Bluetooth/.test(says(open)), `a customer’s copy reads the word Bluetooth on Fixes (${open})`)
    }
    assert.equal(b.bench.asked, 0, 'a phone Bluetooth (beta) is not open to was asked whether it can do Bluetooth')

    /* Offered and off: once, as a hint, under the connect fix's last step. */
    b.bench.allowed = true
    assert.deepEqual(lines('connect'), [{ tone: 'hint', says: NO_COMPUTER_BLUETOOTH }], 'It will not connect at all does not offer the other way where it is offered')
    const page = says('connect')
    const steps = fixById('connect').steps
    assert.ok(page.indexOf(NO_COMPUTER_BLUETOOTH) > page.indexOf(steps.at(-1)), 'the other way comes before the computer’s steps')
    /* Under no other fix, and not with every fix shut. */
    for (const open of [null, 'frozen', 'versions', 'preset']) assert.deepEqual(lines(open), [], `the other way is said under ${open}`)

    /* Already on Bluetooth (beta): it is not another way, and is not offered as one. */
    b.bench.on = true
    assert.deepEqual(lines('connect'), [], 'the other way is offered to somebody already on it')
    b.bench.on = false
    /* A phone that cannot do it. */
    b.bench.supported = false
    assert.deepEqual(lines('connect'), [], 'a phone that cannot do Bluetooth is sent to a row it does not have')
    delete globalThis.__otherWayBench
  })
}
