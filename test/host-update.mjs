/**
 * THE PHONE'S HALF OF A RASPBERRY PI PUTTING IN ITS OWN UPDATES
 * (mobile/src/lib/hostUpdate.js, lib/hostUpdateHere.js,
 * components/HostUpdate.js).
 *
 * "I will update the pis but we need to figure out how to have them auto
 * update" (Justin, 17 November 2026). The computer half (computer app
 * 1.92.0, desktop/lib/updates.mjs) tells the phones how its update is going
 * (updateNote, in host.name) and acts on a phone's request (updateAsk). The
 * phone shows the computer's version and how its update is going on
 * Settings → Phone & computer, and Update now when a Pi has one ready: his
 * account only, behind features COMPUTER_UPDATE_FOR_EVERYONE.
 *
 * What these hold, against the computer AS BUILT: the computer's own note,
 * for every state it can be in, fed to the phone's words; the phone's own
 * request fed to the computer's own rule; the request written at most twice
 * a tap, against a stood-in Pi run on the computer's own rules; and that
 * every other account sees and sends exactly what it did.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const flat = (s) => s.replace(/\s+/g, ' ')
const phone = () => import('../mobile/src/lib/hostUpdate.js')
const computer = () => import('../desktop/lib/updates.mjs')

const ACCOUNT = '5a1c2c4e-0000-4000-8000-000000000001'
const PI_OS = 'Raspberry Pi 5'
/** Nothing a person reads says this phone, beta, tried, official or soon; nor a time for the restart, nor that the sound keeps going. */
const BANNED = /this phone|\bbeta\b|\btried\b|\btested\b|official|\bsoon\b|seconds|\bminute\b|sound|keeps playing|\d+\s*s\b/i

/**
 * A Raspberry Pi, run on the computer's own rules: it looks for a request
 * every ten seconds (main.js UPDATE_ASK_LOOK_MS, lookAtAsk), answers it in
 * its note (updateNote's `asked`) and clears it (`{ done: at }`), and an
 * install comes back as a new run on the new version some seconds later.
 */
async function standInPi({ fresh = false, account = ACCOUNT, busy = null, restartMs = 20000, takes = true, readable = () => true } = {}) {
  const c = await computer()
  const pi = {
    name: 'pedalboard',
    version: '1.92.0',
    state: { kind: 'ready', version: '1.92.3' },
    asked: null,
    doc: null,
    rev: 0,
    mark: undefined,
    lookedAt: 0,
    restartAt: null,
    goingAt: null,
    writes: [],
    answers: []
  }
  const look = () => {
    const said = c.updateAsk({ doc: pi.doc, mark: pi.mark, ownName: pi.name, accountId: account, update: pi.state, selfUpdating: true, busy })
    pi.mark = said.mark
    if (!said.act) return
    const result = said.act === 'install' ? 'installing' : said.why
    pi.asked = { at: said.at, result }
    pi.answers.push(result)
    pi.rev++
    pi.doc = { rev: pi.rev, updatedAt: pi.rev, data: { done: said.at } }
    if (said.act === 'install') {
      /* It tells the phones "installing" before it stops answering (main.js lookAtAsk: tellNow, then installNow). */
      pi.goingAt = pi.clock + 8000
      pi.restartAt = pi.clock + restartMs
    }
  }
  pi.clock = 0
  /* A computer that has been up a while has learned the store's request already; a fresh one learns the first it sees. */
  if (!fresh) look()
  pi.advance = (to) => {
    while (pi.lookedAt + 10000 <= to) {
      pi.lookedAt += 10000
      pi.clock = pi.lookedAt
      if (pi.restartAt !== null && pi.clock >= pi.restartAt) {
        pi.restartAt = null
        if (takes) {
          pi.version = '1.92.3'
          pi.state = { kind: 'current' }
        }
        pi.asked = null
        pi.mark = undefined
      }
      if (pi.restartAt === null) look()
    }
    pi.clock = to
  }
  pi.writtenAt = []
  pi.write = async (body) => {
    pi.writes.push(body)
    pi.writtenAt.push(pi.clock)
    pi.rev++
    pi.doc = { rev: pi.rev, updatedAt: pi.rev, data: body.data }
  }
  pi.readNote = async () => {
    if ((pi.restartAt !== null && pi.clock >= pi.goingAt) || !readable(pi.clock)) return undefined
    return { name: pi.name, version: pi.version, update: c.updateNote(pi.state, { selfUpdating: true, asked: pi.asked }) }
  }
  return pi
}

/** One Update now against a stood-in Pi, on a clock that only moves when the phone sleeps. */
async function tapOn(pi, { mayWrite = () => null, version = '1.92.3', stretch = (ms) => ms } = {}) {
  const h = await phone()
  let now = 1_000_000
  const start = now
  const logs = []
  const phases = []
  const result = await h.askUpdate({
    name: pi.name,
    version,
    from: pi.version,
    account: ACCOUNT,
    write: pi.write,
    readNote: pi.readNote,
    mayWrite,
    now: () => now,
    /* `stretch`: how long the device really held the look (the app in the background holds it far longer). */
    sleep: async (ms) => {
      now += stretch(ms)
      pi.advance(now - start)
    },
    log: (line) => logs.push(line),
    onState: (p) => phases.push(p)
  })
  return { result, logs, phases, took: now - start }
}

/**
 * lib/hostUpdateHere.js as it is, with lib/hostUpdate.js as it is, beside
 * stand-ins for the link, the relay, the Bluetooth account news and React.
 * The link reads whichever computer `bench.driven` names (as the relay
 * does), and a write of the request goes to that computer. The clock moves
 * only when the code sleeps; `bench.onSleep` runs at each sleep.
 */
async function hereOnABench() {
  const dir = mkdtempSync(join(tmpdir(), 'host-update-'))
  const files = {
    'package.json': '{ "type": "module" }',
    'bench.mjs': `
      export const bench = {
        t: 1000000, admin: true, via: 'computer', hosts: ['pedalboard'], sending: { out: 0, at: 0 }, user: ${JSON.stringify(ACCOUNT)}, kept: null,
        state: { link: 'connected', macName: null, hostVersion: null, hostOs: null, hostUpdate: null },
        computers: {}, driven: null, requests: [], logged: [], onSleep: null,
        now: () => bench.t,
        setTimeout(fn, ms) {
          bench.t += ms
          for (const pi of Object.values(bench.computers)) pi.advance(bench.t - pi.since)
          if (bench.onSleep) bench.onSleep(ms)
          Promise.resolve().then(fn)
          return 0
        }
      }
    `,
    'react.mjs': 'export const useEffect = () => {}\nexport const useState = (v) => [v, () => {}]\nexport const useSyncExternalStore = (sub, get) => get()\n',
    'bluetooth.mjs': "import { bench } from './bench.mjs'\nconst seers = new Set()\nexport const bluetoothAdmin = () => bench.admin\nexport const useBluetoothAdmin = () => bench.admin\nexport const subscribeBluetooth = (fn) => (seers.add(fn), () => seers.delete(fn))\nexport const announce = () => { for (const fn of [...seers]) fn() }\n",
    'debugLog.mjs': "import { bench } from './bench.mjs'\nexport const logDebug = (tag, line) => bench.logged.push(`${tag} ${line}`)\n",
    'features.mjs': 'export const COMPUTER_UPDATE_FOR_EVERYONE = false\n',
    'link.mjs': `
      import { bench } from './bench.mjs'
      const seers = new Set()
      export const linkState = () => bench.state
      export const subscribeLink = (fn) => (seers.add(fn), () => seers.delete(fn))
      export const linkVia = () => bench.via
      export function setLink(patch) {
        bench.state = { ...bench.state, ...patch }
        for (const fn of [...seers]) fn(bench.state)
      }
      /* As link.js: the computer driven now, its document, into the link's state; undefined when it cannot be read. */
      export async function readHostAgain() {
        const doc = await bench.computers[bench.driven]?.readNote()
        if (!doc) return undefined
        setLink({ macName: doc.name, hostVersion: doc.version, hostUpdate: doc.update ?? null })
        return { name: bench.state.macName, version: bench.state.hostVersion, update: bench.state.hostUpdate }
      }
    `,
    'relay.mjs': `
      import { bench } from './bench.mjs'
      export const keptAccount = async () => bench.kept
      export const remoteHosts = () => bench.hosts
      export const remoteRollCall = () => ({ answers: [], read: async (a) => a })
      export const remoteUserId = () => bench.user
      export const sendingHere = () => bench.sending
      /* Every request, and the request document written to the computer driven now. */
      export async function remoteRequest(path, options = {}) {
        bench.requests.push({ path, method: options.method || 'GET', body: options.body ?? null })
        if (path === '/store/config/host.update' && options.method === 'PUT') return bench.computers[bench.driven].write(JSON.parse(options.body))
        throw new Error('the bench answers nothing else')
      }
    `
  }
  const clockIn = (src) => "import { bench as __bench } from './bench.mjs'\n" + src.replace(/\bDate\.now\b/g, '__bench.now').replace(/(?<![.\w])setTimeout\(/g, '__bench.setTimeout(')
  let phoneRules = read('mobile/src/lib/hostUpdate.js')
  assert.ok(phoneRules.includes("from './versions.js'"), 'hostUpdate.js no longer imports versions.js; the bench needs telling')
  phoneRules = phoneRules.replace("from './versions.js'", `from '${new URL('../mobile/src/lib/versions.js', import.meta.url).href}'`)
  files['hostUpdate.mjs'] = clockIn(phoneRules)
  let src = read('mobile/src/lib/hostUpdateHere.js')
  for (const [from, to] of [
    ["from 'react'", "from './react.mjs'"],
    ["from './bluetooth'", "from './bluetooth.mjs'"],
    ["from './debugLog'", "from './debugLog.mjs'"],
    ["from './features'", "from './features.mjs'"],
    ["from './hostUpdate'", "from './hostUpdate.mjs'"],
    ["from './link'", "from './link.mjs'"],
    ["from './relay'", "from './relay.mjs'"]
  ]) {
    assert.ok(src.includes(from), `hostUpdateHere.js no longer imports ${from}; the bench needs telling`)
    src = src.replace(from, to)
  }
  const left = [...src.matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1]).filter((m) => !m.endsWith('.mjs'))
  assert.deepEqual(left, [], 'hostUpdateHere.js imports something the bench has no stand-in for')
  files['hostUpdateHere.mjs'] = clockIn(src)
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    const here = await import(at('hostUpdateHere.mjs'))
    const link = await import(at('link.mjs'))
    const bt = await import(at('bluetooth.mjs'))
    const { bench } = await import(at('bench.mjs'))
    const h = await phone()
    const words = () => {
      const s = link.linkState()
      return h.computerUpdateWords({ name: s.macName, version: s.hostVersion, os: s.hostOs, update: s.hostUpdate, ...h.runSays(here.useUpdateRun(), s) })
    }
    /* A stand-in Pi driven, its clock starting now, its document read into the link. */
    const drive = async (pi) => {
      pi.since = bench.t
      bench.computers[pi.name] = pi
      bench.driven = pi.name
      const doc = await pi.readNote()
      link.setLink({ link: 'connected', macName: doc.name, hostVersion: doc.version, hostOs: PI_OS, hostUpdate: doc.update })
      return pi
    }
    return { here, link, bt, bench, drive, words, line: () => words().line }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  /* ------------------------------------------------------------ the words */

  test('host update: the computer’s own note, for every state it can be in, gives the phone’s words', async () => {
    const h = await phone()
    const c = await computer()
    const name = 'pedalboard'
    const words = (state, opts = {}, extra = {}) => h.computerUpdateWords({ name, version: '1.92.0', os: PI_OS, update: c.updateNote(state, opts), ...extra })
    const ready = { kind: 'ready', version: '1.92.3' }

    // A Pi that takes its own: ready, and Update now offered.
    let w = words(ready, { selfUpdating: true })
    // The computer's own window's words (src/lib/desktop.js), true for every account: a customer's waits a day after the release too.
    assert.equal(w.line, 'Version 1.92.3 is ready. It goes in by itself once it has been out for a day and nobody has used pedalboard for half an hour.')
    assert.match(read('src/lib/desktop.js'), /it goes in by itself once it has been out for a day and nobody has used this computer for half an hour\./, 'the computer’s window words its wait differently now: say what it says')
    assert.equal(w.button, true, 'a Pi with its update ready offers no Update now')
    // His own computer (signed in to his account, as the device is) skips the day's wait (desktop OWNER_ACCOUNTS, ownerBox): its line leaves the day out, and only its.
    const his = h.computerUpdateWords({ name, version: '1.92.0', os: PI_OS, update: c.updateNote(ready, { selfUpdating: true }), owner: true })
    assert.equal(his.line, 'Version 1.92.3 is ready. It goes in by itself once nobody has used pedalboard for half an hour.', 'his own computer is told of a day’s wait it does not make')
    assert.equal(his.button, true)
    for (const owner of [false, undefined, 'yes', 1]) assert.equal(h.computerUpdateWords({ name, version: '1.92.0', os: PI_OS, update: c.updateNote(ready, { selfUpdating: true }), owner }).line, w.line, `a customer’s computer (owner ${String(owner)}) is told it skips the day`)
    // The give-up line, both ways.
    const gaveUp = (owner) => h.computerUpdateWords({ name, version: '1.92.0', os: PI_OS, update: c.updateNote(ready, { selfUpdating: true }), result: { state: 'gave-up', version: '1.92.0' }, owner }).line
    assert.equal(gaveUp(true), "pedalboard didn't update. It stays on version 1.92.0. The new version goes in by itself once nobody has used pedalboard for half an hour.")
    assert.match(gaveUp(false), /once it has been out for a day and nobody has used pedalboard for half an hour\.$/)
    // Which unit's line says the same as the card, for whoever reads it.
    assert.equal(h.hostCardLine({ name, version: '1.92.0', os: PI_OS, update: c.updateNote(ready, { selfUpdating: true }) }, { driven: true, owner: true }), `v1.92.0 · ${his.line}`)
    // Whose computer it is comes from the device's own sign-in, on both of the computer's lines.
    const card = flat(code(read('mobile/src/components/HostUpdate.js')))
    assert.match(card, /const words = computerUpdateWords\(\{ name, version: s\.hostVersion, os: s\.hostOs, update: s\.hostUpdate, owner, \.\.\.runSays\(run, s\) \}\)/)
    assert.match(card, /const line = hostCardLine\(fact, \{ driven, twice: sameNameTwice\(remoteHosts\(\), name\), owner \}\)/)
    assert.equal((card.match(/const owner = useOwnComputer\(\)/g) || []).length, 2)
    assert.match(flat(code(read('mobile/src/lib/hostUpdateHere.js'))), /export const useOwnComputer = \(\) => useBluetoothAdmin\(\) === true/)
    // A Mac (or a PC, or a Pi the computer says does not take its own): quit and open.
    w = words(ready, {}, { os: 'macOS 15.3' })
    assert.equal(w.line, 'Version 1.92.3 is ready. It goes in the next time the computer app is quit and opened again.')
    assert.equal(w.button, false, 'Update now is offered where the computer says it cannot be done')
    // The .deb.
    w = words(ready, { deb: true }, { os: 'Ubuntu 24.04' })
    assert.equal(w.line, 'Version 1.92.3 is ready. It needs the computer’s password, so put it in at pedalboard.'.replace('’', "'"))
    assert.equal(w.button, false)
    // A Pi whose last install did not take: not offered, and not "by itself" (it is not tried again by itself).
    w = words(ready, { selfUpdating: true, stuck: true })
    assert.equal(c.updateNote(ready, { selfUpdating: true, stuck: true }).goesIn, 'idle', 'the computer’s note changed: read this row again')
    assert.equal(w.line, "Version 1.92.3 is ready, but it didn't go in last time. Put it in at pedalboard: Restart to update on its own screen.")
    assert.equal(w.button, false, 'Update now is offered for an update that did not take')
    // A release pulled after it was downloaded: the computer says it goes in at a quit.
    w = words(ready, { selfUpdating: true, pulled: true })
    assert.equal(w.line, 'Version 1.92.3 is ready. It goes in the next time the computer app is quit and opened again.')
    assert.equal(w.button, false, 'Update now is offered for a pulled release')
    // On its way.
    assert.equal(words({ kind: 'downloading', percent: 41.6, version: '1.92.3' }).line, 'Downloading version 1.92.3… 42%')
    assert.equal(words({ kind: 'found', version: '1.92.3' }).line, 'Downloading version 1.92.3…')
    assert.equal(words({ kind: 'staging', version: '1.92.3' }).line, 'Downloading version 1.92.3…')
    assert.equal(words({ kind: 'downloading', percent: 7 }).line, 'Downloading an update… 7%')
    assert.equal(words({ kind: 'current' }).line, 'Up to date')
    assert.equal(words({ kind: 'checking' }).line, 'Looking for updates…')
    assert.equal(words({ kind: 'building', version: '1.92.3' }).line, 'Version 1.92.3 is still being built')
    assert.equal(words({ kind: 'trouble', message: 'ENOTFOUND' }).line, "Couldn't look for updates. It tries again by itself.")
    assert.equal(words({ kind: 'stuck', version: '1.92.3' }).line, "Version 1.92.3 didn't go in. Get it from fractal.newbold.cloud/downloads.")
    w = words({ kind: 'misplaced' }, {}, { os: 'macOS 15.3' })
    assert.equal(w.line, 'Move Fractal Remote to Applications on pedalboard to get updates.')
    assert.equal(w.link, 'updating')
    // Nothing to say yet (no state, or idle): a computer new enough says nothing, and nothing is added.
    for (const state of [null, { kind: 'idle' }]) {
      assert.equal(c.updateNote(state), null)
      assert.deepEqual(words(state), { line: null, button: false, link: null, tone: 'hint' }, 'a 1.92.0 computer with nothing to say is called older')
    }
    // Only `ready` with canNow ever has the button.
    for (const kind of ['checking', 'found', 'downloading', 'staging', 'current', 'building', 'trouble', 'stuck', 'misplaced']) {
      assert.equal(words({ kind, version: '1.92.3' }, { selfUpdating: true }).button, false, `Update now on ${kind}`)
    }
  })

  test('host update: an older computer says so, a Pi between 1.90.86 and 1.92.0 is told off and on, and nothing is said with no version', async () => {
    const h = await phone()
    const w = (version, os) => h.computerUpdateWords({ name: 'pedalboard', version, os, update: null })
    assert.equal(h.UPDATE_SAYS_FROM, '1.92.0', 'the computer half is 1.92.0')
    assert.equal(h.OFF_AND_ON_FROM, '1.90.86')
    assert.equal(w('1.90.90', PI_OS).line, "v1.90.90, an older computer app. Switch pedalboard off and on and give it five minutes. If it's still on this version, do it once more.")
    // A Pi on the .deb never puts it in at power-on, and the phone cannot tell: the way out the plain older line has.
    assert.equal(w('1.90.90', PI_OS).link, 'updating', 'the off-and-on line has no way to the Updating page')
    assert.equal(w('1.90.86', PI_OS).line.includes('off and on'), true)
    assert.equal(w('1.91.9', 'Raspberry Pi 4 Model B').line.includes('off and on'), true)
    // Below 1.90.86 a Pi with a window does not put it in at power-on: never told to switch it off and on.
    for (const [version, os] of [['1.90.63', PI_OS], ['1.90.85', PI_OS], ['1.91.0', 'macOS 15.3'], ['1.91.0', 'Windows 11'], ['1.91.0', null]]) {
      const said = w(version, os)
      assert.equal(said.line, `v${version}, an older computer app.`, `${version} on ${os}`)
      assert.equal(said.link, 'updating', 'an older computer has no way to the Updating page')
      assert.equal(said.button, false)
    }
    assert.deepEqual(w(null, PI_OS), { line: null, button: false, link: null, tone: 'hint' })
    assert.equal(w('1.92.0', PI_OS).line, null, 'the computer half itself is called older')
    assert.equal(w('2.0.1', PI_OS).line, null)
    assert.equal(h.computerUpdateWords({ name: null, version: '1.90.63', update: null }).line, null, 'words with no name')
  })

  test('host update: every answer the computer can give, and how a tap ends, in words', async () => {
    const h = await phone()
    const c = await computer()
    const src = read('desktop/lib/updates.mjs')
    const results = JSON.parse(src.match(/const ASKED_RESULTS = (\[[^\]]+\])/)[1].replace(/'/g, '"'))
    const said = {}
    for (const result of results) {
      said[result] = h.answerWords(result, { name: 'pedalboard', version: '1.92.3' })
      // And through the computer's own note: the answer it gives back is the one the words are for.
      const note = c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true, asked: { at: 7, result } })
      assert.deepEqual(h.noteOf(note).asked, { at: 7, result })
      assert.doesNotMatch(said[result], /didn't update\.$/, `the computer’s answer "${result}" has no words of its own`)
    }
    assert.equal(said.installing, 'Updating pedalboard… The remote comes back by itself.')
    assert.equal(said.screen, 'Somebody is using the screen on pedalboard. Try again in a couple of minutes.')
    assert.equal(said.busy, 'Somebody is using pedalboard right now. Try again in a few minutes.')
    assert.equal(said['not-ready'], 'pedalboard has no update ready to put in now.')
    assert.equal(said.stuck, "Version 1.92.3 didn't go in last time, so pedalboard won't put it in from here. Use Restart to update on its own screen.")
    assert.equal(said.pulled, "Version 1.92.3 was taken back, so pedalboard won't put it in by itself.")
    assert.equal(said.attended, 'pedalboard puts its update in when the computer app is quit and opened again.')
    assert.equal(said.password, 'pedalboard needs its password to update, so put it in at the computer.')
    assert.equal(said['other-account'], "pedalboard is signed in to another account, so it can't be updated from here.")

    const end = (result, extra = {}) => h.computerUpdateWords({ name: 'pedalboard', version: '1.92.0', os: PI_OS, update: { kind: 'ready', version: '1.92.3', goesIn: 'idle', canNow: true }, result, ...extra })
    assert.equal(end({ state: 'updated', version: '1.92.3' }).line, 'pedalboard is on version 1.92.3.')
    // Back on the new version with a newer one already ready: the computer's own words and Update now, as if no run had ended.
    const newer = c.updateNote({ kind: 'ready', version: '1.92.5' }, { selfUpdating: true })
    const updatedOn = (update) => h.computerUpdateWords({ name: 'pedalboard', version: '1.92.3', os: PI_OS, update, result: { state: 'updated', version: '1.92.3' } })
    assert.deepEqual(updatedOn(newer), h.computerUpdateWords({ name: 'pedalboard', version: '1.92.3', os: PI_OS, update: newer }), '"is on version 1.92.3" hides a newer version ready to go in')
    assert.equal(updatedOn(newer).line, 'Version 1.92.5 is ready. It goes in by itself once it has been out for a day and nobody has used pedalboard for half an hour.')
    assert.equal(updatedOn(newer).button, true, 'no Update now for the newer version under "is on version"')
    // The same version offered, or nothing: the line it ended on, with no button.
    for (const update of [c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true }), c.updateNote({ kind: 'current' }, { selfUpdating: true }), null]) {
      assert.deepEqual(updatedOn(update), { line: 'pedalboard is on version 1.92.3.', button: false, link: null, tone: 'hint' }, `the run's end is not said against ${JSON.stringify(update)}`)
    }
    // A newer version that is only on its way (not ready), or a version that cannot be compared: still the line it ended on.
    for (const update of [c.updateNote({ kind: 'downloading', version: '1.92.5', percent: 40 }, { selfUpdating: true }), { kind: 'ready', version: 'v1.92.5', goesIn: 'idle', canNow: true }, { kind: 'ready', goesIn: 'idle', canNow: true }]) {
      assert.deepEqual(updatedOn(update), { line: 'pedalboard is on version 1.92.3.', button: false, link: null, tone: 'hint' }, `"is on version 1.92.3" gave way to ${JSON.stringify(update)}`)
    }
    // A newer version ready that cannot go in from here (it did not go in last time): the computer's own warning, and no button.
    const newerStuck = c.updateNote({ kind: 'ready', version: '1.92.5' }, { selfUpdating: true, stuck: true })
    assert.equal(newerStuck.canNow, false)
    assert.deepEqual(updatedOn(newerStuck), h.computerUpdateWords({ name: 'pedalboard', version: '1.92.3', os: PI_OS, update: newerStuck }), 'a newer version that did not go in is hidden under "is on version"')
    assert.match(updatedOn(newerStuck).line, /^Version 1\.92\.5 is ready, but it didn't go in last time\./)
    assert.equal(updatedOn(newerStuck).button, false)
    assert.equal(end({ state: 'refused', result: 'screen', asked: '1.92.3' }).line, said.screen)
    // Which endings keep Update now: every one but 'updated', and only where the computer still offers it.
    const offers = c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true })
    const stuck = c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true, stuck: true })
    assert.equal(offers.canNow, true)
    assert.equal(stuck.canNow, false)
    const endings = [
      [{ state: 'updated', version: '1.92.3' }, false],
      [{ state: 'refused', result: 'screen', asked: '1.92.3' }, true],
      [{ state: 'gave-up', version: '1.92.0' }, true],
      [{ state: 'no-take', version: '1.92.0' }, true],
      [{ state: 'not-sent', why: 'busy' }, true]
    ]
    for (const [result, keeps] of endings) {
      const with_ = h.computerUpdateWords({ name: 'pedalboard', version: '1.92.0', os: PI_OS, update: offers, result })
      const without = h.computerUpdateWords({ name: 'pedalboard', version: '1.92.0', os: PI_OS, update: stuck, result })
      assert.equal(with_.button, keeps, `${result.state}, with Update now on offer: ${keeps ? 'nothing to try again with' : 'offered again over the line that says it went in'}`)
      assert.equal(without.button, false, `${result.state}: Update now offered where the computer no longer offers it`)
      assert.ok(with_.line && with_.line === without.line, `${result.state} has no line of its own`)
    }
    // A run that ended reading another computer says nothing at all: the computer's own note is said.
    assert.equal(end({ state: 'left' }).line, h.computerUpdateWords({ name: 'pedalboard', version: '1.92.0', os: PI_OS, update: { kind: 'ready', version: '1.92.3', goesIn: 'idle', canNow: true } }).line)
    assert.equal(end({ state: 'gave-up', version: '1.92.0' }).line, "pedalboard didn't update. It stays on version 1.92.0. The new version goes in by itself once it has been out for a day and nobody has used pedalboard for half an hour.", 'a customer’s computer is told it tries again with no word of the day it waits first')
    assert.equal(end({ state: 'no-take', version: '1.92.0' }).line, "pedalboard didn't update. It stays on version 1.92.0.", 'an install that did not take is said to be tried again by itself, which the computer never does')
    assert.equal(end({ state: 'not-sent', why: 'busy' }).line, 'Something is still being sent to pedalboard. Try again in a moment.')
    assert.equal(end(null, { sending: 'asking' }).line, 'Asking pedalboard to update…')
    assert.equal(end(null, { sending: 'asking' }).button, false, 'Update now offered while one is out')
    assert.equal(end(null, { sending: 'installing' }).line, said.installing)

    const ask = h.confirmWords('pedalboard')
    assert.deepEqual(ask, {
      title: 'Update pedalboard now?',
      body: "The remote stops while pedalboard restarts, then comes back by itself. Don't save or send a capture until it's back.",
      yes: 'Update now',
      no: 'Not now'
    })
    assert.equal(h.notAskedWords('clash', 'raspberrypi'), 'Two computers are called raspberrypi. Rename one to update it.')
    assert.equal(h.notAskedWords('account', 'pedalboard'), 'Sign in to update pedalboard from here.')
    assert.equal(h.notAskedWords('off', 'pedalboard'), null, 'an account the switch is off for is told about the switch')
  })

  test('host update: no sentence a person reads says this phone, beta, tried, official or soon, a time, or the sound', async () => {
    const h = await phone()
    const c = await computer()
    const lines = new Set()
    const add = (s) => s && lines.add(s)
    const states = [null, { kind: 'checking' }, { kind: 'found', version: '1.92.3' }, { kind: 'downloading', percent: 3, version: '1.92.3' }, { kind: 'ready', version: '1.92.3' }, { kind: 'current' }, { kind: 'building', version: '1.92.3' }, { kind: 'trouble' }, { kind: 'stuck', version: '1.92.3' }, { kind: 'misplaced' }]
    for (const state of states) {
      for (const opts of [{}, { selfUpdating: true }, { deb: true }, { selfUpdating: true, stuck: true }, { selfUpdating: true, pulled: true }]) {
        for (const [version, os] of [['1.92.0', PI_OS], ['1.90.90', PI_OS], ['1.90.63', PI_OS], ['1.91.0', 'macOS 15.3'], [null, null]]) {
          const update = version === '1.92.0' ? c.updateNote(state, opts) : null
          add(h.computerUpdateWords({ name: 'pedalboard', version, os, update }).line)
          add(h.hostCardLine({ name: 'pedalboard', version, os, update }, { driven: false }))
        }
      }
    }
    for (const r of ['installing', 'not-ready', 'stuck', 'pulled', 'attended', 'password', 'screen', 'busy', 'other-account', 'whatever']) add(h.answerWords(r, { name: 'pedalboard', version: '1.92.3' }))
    for (const state of ['updated', 'gave-up', 'no-take', 'not-sent', 'left']) add(h.computerUpdateWords({ name: 'pedalboard', version: '1.92.0', result: { state, version: '1.92.0', why: 'busy' } }).line)
    for (const why of ['clash', 'busy', 'account', 'not-ready']) add(h.notAskedWords(why, 'pedalboard'))
    add(h.computerUpdateWords({ name: 'pedalboard', sending: 'asking' }).line)
    for (const s of Object.values(h.confirmWords('pedalboard'))) add(s)
    // And the component's own two labels.
    const comp = read('mobile/src/components/HostUpdate.js')
    for (const m of comp.matchAll(/label="([^"]+)"/g)) add(m[1])
    assert.ok(lines.size > 40, `only ${lines.size} sentences were looked at`)
    for (const line of lines) {
      assert.doesNotMatch(line, BANNED, `"${line}" says something it may not`)
      assert.ok(!/\bthis (iPhone|iPad|tablet|device|browser)\b/.test(line), `"${line}" names the device in hand`)
    }
  })

  /* ------------------------------------------------------- may it ask */

  test('host update: mayAskUpdate is false for each missing condition in turn, and two computers by one name are never asked', async () => {
    const h = await phone()
    const c = await computer()
    const ok = {
      update: c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true }),
      switchOn: true,
      clash: false,
      busyHere: false,
      name: 'pedalboard',
      account: ACCOUNT,
      linked: true
    }
    assert.equal(h.mayAskUpdate(ok), true)
    assert.equal(h.whyNotAsk(ok), null)
    const each = [
      [{ switchOn: false }, 'off'],
      [{ switchOn: 'yes' }, 'off'],
      [{ update: c.updateNote({ kind: 'ready', version: '1.92.3' }, {}) }, 'not-ready'],
      [{ update: c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true, stuck: true }) }, 'not-ready'],
      [{ update: c.updateNote({ kind: 'downloading', version: '1.92.3' }, { selfUpdating: true }) }, 'not-ready'],
      [{ update: null }, 'not-ready'],
      [{ linked: false }, 'link'],
      [{ name: null }, 'link'],
      [{ account: null }, 'account'],
      [{ account: '' }, 'account'],
      [{ clash: true }, 'clash'],
      [{ busyHere: true }, 'busy']
    ]
    for (const [change, why] of each) {
      assert.equal(h.mayAskUpdate({ ...ok, ...change }), false, `asked with ${JSON.stringify(change)}`)
      assert.equal(h.whyNotAsk({ ...ok, ...change }), why)
    }
    assert.equal(h.mayAskUpdate(), false)
    // His Pi and a second one, both called raspberrypi: the roll call shows it, and nothing is asked.
    const two = ['raspberrypi', 'studio', 'raspberrypi']
    assert.equal(h.sameNameTwice(two, 'raspberrypi'), true)
    assert.equal(h.sameNameTwice(two, 'studio'), false)
    assert.equal(h.sameNameTwice([{ name: 'raspberrypi' }, { name: 'raspberrypi' }], 'raspberrypi'), true)
    assert.equal(h.sameNameTwice(['raspberrypi'], 'raspberrypi'), false)
    assert.equal(h.sameNameTwice([], 'raspberrypi'), false)
    assert.equal(h.mayAskUpdate({ ...ok, name: 'raspberrypi', clash: h.sameNameTwice(two, 'raspberrypi') }), false, 'two computers by one name are both restarted')
    // What this device sent lately.
    assert.equal(h.SENT_QUIET_MS, 10000)
    assert.equal(h.busySending({ out: 1, at: 0 }, 5), true, 'a save still going out is not waited for')
    assert.equal(h.busySending({ out: 0, at: 100 }, 100 + 9999), true, 'a capture finished a moment ago is not waited for')
    assert.equal(h.busySending({ out: 0, at: 100 }, 100 + 10000), false)
    assert.equal(h.busySending({ out: 0, at: 0 }, 5), false)
    assert.equal(h.busySending(), false)
  })

  /* --------------------------------------------------------- the request */

  test('host update: the phone’s request is the one the computer’s own rule acts on, and nothing it would not', async () => {
    const h = await phone()
    const c = await computer()
    assert.equal(h.HOST_UPDATE_ID, c.HOST_UPDATE_ID, 'the two ends name the request’s document differently')
    assert.equal(h.HOST_UPDATE_PATH, `/store/config/${c.HOST_UPDATE_ID}`)
    const { forbiddenRemotely } = await import('../shared/relay-rules.mjs')
    assert.equal(forbiddenRemotely('PUT', h.HOST_UPDATE_PATH), null, 'the relay refuses the request')

    const body = h.updateRequest({ name: 'pedalboard', version: '1.92.3', account: ACCOUNT, at: 1234 })
    assert.deepEqual(body, { data: { host: 'pedalboard', version: '1.92.3', account: ACCOUNT, at: 1234 }, origin: 'fractal' })
    const judge = (data, over = {}) =>
      c.updateAsk({ doc: { rev: 9, updatedAt: 9, data }, mark: 'learned before', ownName: 'pedalboard', accountId: ACCOUNT, update: { kind: 'ready', version: '1.92.3' }, selfUpdating: true, ...over })
    const said = judge(body.data)
    assert.equal(said.act, 'install', 'the computer does not act on the phone’s request')
    assert.equal(said.at, 1234, 'the computer’s answer is not matched to the request')
    // Each thing it carries is one the computer needs.
    const { host, ...noHost } = body.data
    assert.equal(judge(noHost).act, null, 'a request with no computer named is acted on')
    const { account, ...noAccount } = body.data
    assert.equal(judge(noAccount).act, null, 'a request with no account is acted on')
    assert.equal(judge({ ...body.data, host: 'studio' }).act, null)
    assert.equal(judge({ ...body.data, version: '1.92.2' }).why, 'not-ready')
    const { at, ...noAt } = body.data
    assert.equal(judge(noAt).at, null, 'without `at` the answer cannot be told from another phone’s')
    // The computer answers in the note with the phone's own `at`, which the phone reads back.
    const note = c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true, asked: { at: said.at, result: 'installing' } })
    assert.deepEqual(h.noteOf(note).asked, { at: 1234, result: 'installing' })
    // And the note the phone keeps is the computer's own, key for key.
    for (const [state, opts] of [[{ kind: 'ready', version: '1.92.3' }, { selfUpdating: true }], [{ kind: 'downloading', percent: 50, version: '1.92.3' }, {}], [{ kind: 'current' }, { deb: true }]]) {
      assert.deepEqual(h.noteOf(c.updateNote(state, opts)), c.updateNote(state, opts))
    }
    assert.equal(h.noteOf({ kind: 'idle' }), null)
    assert.equal(h.noteOf('ready'), null)
    assert.equal(h.noteOf({ kind: 'ready', canNow: true }).canNow, false, 'Update now offered with no version to ask for')

    // Written where the computer reads it, by the relay, PUT, with exactly this body, and nowhere else.
    const here = flat(code(read('mobile/src/lib/hostUpdateHere.js')))
    assert.match(here, /write: \(body\) => remoteRequest\(HOST_UPDATE_PATH, \{ method: 'PUT', body: JSON\.stringify\(body\) \}\)/)
    assert.equal(here.match(/remoteRequest\(/g).length, 1, 'Update now writes somewhere else too')
    assert.match(flat(code(read('mobile/src/lib/hostUpdate.js'))), /await write\(updateRequest\(\{ name, version, account, at \}\)\)/)
  })

  test('host update: one tap writes once, once more at 30 s only when the computer has not answered, and never a third time', async () => {
    const h = await phone()
    assert.equal(h.RETRY_AFTER_MS, 30000)
    assert.equal(h.MOST_WRITES, 2)
    assert.equal(h.GIVE_UP_MS, 180000)

    // A Pi up a while: the first request is acted on, the Pi restarts and comes back on the new version.
    let pi = await standInPi()
    let tap = await tapOn(pi)
    assert.deepEqual(tap.result, { state: 'updated', version: '1.92.3' })
    assert.equal(pi.writes.length, 1, 'written again after the computer had answered')
    assert.deepEqual(pi.answers, ['installing'])
    assert.deepEqual(tap.phases, ['asking', 'installing'])
    assert.ok(tap.logs.some((l) => /asked pedalboard to put in version 1\.92\.3 \(request \d+, 1 of 2\)/.test(l)), tap.logs.join('\n'))
    assert.ok(tap.logs.includes('Update now: pedalboard answered: installing'))
    assert.ok(tap.logs.includes('Update now: pedalboard is on version 1.92.3 (was 1.92.0)'))

    // A Pi that had only just started learns the first request without acting: the second is acted on.
    pi = await standInPi({ fresh: true })
    tap = await tapOn(pi)
    assert.equal(pi.writes.length, 2, 'a request the computer only learned is never asked again')
    assert.notEqual(pi.writes[0].data.at, pi.writes[1].data.at, 'the second request is the first again, which the computer takes for no change')
    assert.deepEqual(pi.writtenAt, [0, 30000], 'the second request does not wait the 30 seconds the computer has to answer the first')
    assert.deepEqual(pi.answers, ['installing'])
    assert.equal(tap.result.state, 'updated')

    // A Pi signed in to another account never answers: two writes, then the phone gives up at three minutes.
    pi = await standInPi({ account: 'another' })
    tap = await tapOn(pi)
    assert.equal(pi.writes.length, 2, `written ${pi.writes.length} times for one tap`)
    assert.deepEqual(tap.result, { state: 'gave-up', version: '1.92.0' })
    assert.ok(tap.took >= 180000 && tap.took <= 180000, `gave up after ${tap.took} ms`)
    assert.ok(tap.logs.some((l) => /gave up — pedalboard did not answer in 3 minutes, and is still on version 1\.92\.0/.test(l)))

    // Refused: said, and never asked again.
    pi = await standInPi({ busy: 'screen' })
    tap = await tapOn(pi)
    assert.deepEqual(tap.result, { state: 'refused', result: 'screen', asked: '1.92.3' })
    assert.equal(pi.writes.length, 1, 'a refusal is asked again')
    assert.ok(tap.logs.includes('Update now: pedalboard answered: not now (screen)'))

    // Installing, and back on the same version: did not take.
    pi = await standInPi({ takes: false })
    tap = await tapOn(pi)
    assert.deepEqual(tap.result, { state: 'no-take', version: '1.92.0' })
    assert.equal(pi.writes.length, 1)

    // Not written at all when the rules say no at the tap.
    pi = await standInPi()
    tap = await tapOn(pi, { mayWrite: () => 'busy' })
    assert.deepEqual(tap.result, { state: 'not-sent', why: 'busy' })
    assert.equal(pi.writes.length, 0, 'written while this device was sending a save')

    // And the second write asks the rules again: a save started meanwhile holds it back.
    pi = await standInPi({ account: 'another' })
    let asks = 0
    tap = await tapOn(pi, { mayWrite: () => (++asks > 1 ? 'busy' : null) })
    assert.equal(pi.writes.length, 1, 'the second request went while this device was sending')
    assert.ok(asks >= 2)
    assert.ok(tap.logs.includes('Update now: not written to pedalboard again (busy)'))
    // Held back at 30 s and let go at 45: the second goes then, and still no third.
    pi = await standInPi({ account: 'another' })
    asks = 0
    tap = await tapOn(pi, { mayWrite: () => (++asks === 2 ? 'busy' : null) })
    assert.equal(pi.writes.length, 2, 'a request held back once is never written')
    assert.equal(tap.result.state, 'gave-up')

    // Another phone's answer in the note is not this tap's.
    pi = await standInPi({ account: 'another' })
    pi.asked = { at: 1, result: 'busy' }
    tap = await tapOn(pi)
    assert.equal(tap.result.state, 'gave-up', 'an answer to another request is taken for this one’s')

    // A computer that now offers another version is not asked again for the old one.
    pi = await standInPi({ account: 'another' })
    const later = pi.readNote
    pi.readNote = async () => {
      const note = await later()
      return note && { ...note, update: { ...note.update, version: '1.92.4' } }
    }
    tap = await tapOn(pi)
    assert.equal(pi.writes.length, 1, 'asked again for a version the computer no longer has')

    // And only while the computer still offers it.
    pi = await standInPi({ account: 'another' })
    const offer = pi.readNote
    pi.readNote = async () => {
      const note = await offer()
      return note && { ...note, update: { ...note.update, canNow: false } }
    }
    tap = await tapOn(pi)
    assert.equal(pi.writes.length, 1, 'asked again of a computer no longer offering it')

    // A computer that cannot be read for a while is waited for, not taken for an answer.
    pi = await standInPi({ readable: (t) => t > 60000 })
    tap = await tapOn(pi)
    assert.equal(tap.result.state, 'updated')
  })

  /* -------------------------------------------------------- the roll call */

  test('host update: the roll call’s answers give each computer’s facts under the names hostNamesFrom gives, which is unchanged', async () => {
    const h = await phone()
    const c = await computer()
    const { hostNamesFrom } = await import('../shared/relay-rules.mjs')
    const answers = [
      JSON.stringify({ data: { name: 'pedalboard', version: '1.92.0', os: PI_OS, update: c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true }) } }),
      JSON.stringify({ data: { name: 'studio', version: '1.91.0', os: 'macOS 15.3' } }),
      'not json',
      JSON.stringify({ name: 'old launcher' }),
      JSON.stringify({ data: { name: '  pedalboard  ', version: '1.92.0', update: { kind: 'nonsense' } } })
    ]
    const read = async (a) => a
    const names = await hostNamesFrom(answers, read)
    const facts = await h.hostFactsFrom(answers, read)
    assert.deepEqual(facts.map((f) => f.name), names, 'the facts are under other names than the roll call’s')
    assert.deepEqual(names, ['pedalboard', 'studio', 'a computer', 'old launcher', 'pedalboard'])
    assert.equal(facts[0].update.canNow, true)
    assert.equal(facts[0].os, PI_OS)
    assert.deepEqual(facts[1], { name: 'studio', version: '1.91.0', os: 'macOS 15.3', update: null })
    assert.deepEqual(facts[2], { name: 'a computer', version: null, os: null, update: null })
    assert.equal(facts[4].update, null, 'a note the phone cannot read is believed')
    assert.equal(h.sameNameTwice(facts, 'pedalboard'), true)
    assert.deepEqual(await h.hostFactsFrom([], read), [])

    // hostNamesFrom is as it was, and the relay keeps the facts beside the names from the same answers.
    const relay = flat(code(read_('mobile/src/lib/relay.js')))
    assert.match(relay, /hosts = await namesFrom\(answers, decode\) rollAnswers = answers/)
    assert.match(relay, /hosts = \[\] rollAnswers = \[\]/, 'a channel going away keeps the last one’s facts')
    assert.match(relay, /export const remoteRollCall = \(\) => \(\{ answers: rollAnswers, read: decode \}\)/)
    // Read from those answers, with no request, and only for an account the switch is on for.
    const here = flat(code(read_('mobile/src/lib/hostUpdateHere.js')))
    assert.match(here, /export function useHostFacts\(on\) \{ const \[facts, setFacts\] = useState\(\[\]\) const names = on \? remoteHosts\(\)\.join\('\\n'\) : null useEffect\(\(\) => \{ if \(names === null\) return undefined let live = true const \{ answers, read \} = remoteRollCall\(\) hostFactsFrom\(answers, read\)/)
    assert.match(read_('shared/relay-rules.mjs'), /export async function hostNamesFrom\(answers, read\) \{\n  const named = \[\]/)

    // The Which unit line: version and words; a computer not driven with Update now on offer is to be picked first.
    const pi = facts[0]
    assert.equal(h.hostCardLine(pi, { driven: false }), 'v1.92.0 · Version 1.92.3 is ready. It goes in by itself once it has been out for a day and nobody has used pedalboard for half an hour. · Pick it to update it.')
    assert.equal(h.hostCardLine(pi, { driven: true }), 'v1.92.0 · Version 1.92.3 is ready. It goes in by itself once it has been out for a day and nobody has used pedalboard for half an hour.')
    assert.equal(h.hostCardLine(facts[1]), 'v1.91.0, an older computer app.')
    assert.equal(h.hostCardLine(pi, { twice: true }), null, 'a name two computers answer to is given one of their lines')
    assert.equal(h.hostCardLine(facts[2]), null)
    assert.equal(h.hostCardLine(null), null)
  })

  /* --------------------------------------------- his account, and nobody else */

  test('host update: the switch is pinned on since 2.0.0, and off, every other account sees and sends exactly what it did', async () => {
    const h = await phone()
    assert.match(read('mobile/src/lib/features.js'), /^export const COMPUTER_UPDATE_FOR_EVERYONE = true$/m, 'the computer’s update on Phone & computer is his account’s alone again: it opened to everyone with 2.0.0 (17 November 2026)')
    assert.equal(h.computerUpdateOn({ admin: true, everyone: false }), true)
    assert.equal(h.computerUpdateOn({ admin: false, everyone: false }), false)
    assert.equal(h.computerUpdateOn({ admin: false, everyone: true }), true)
    assert.equal(h.computerUpdateOn({ admin: 'yes' }), false)
    assert.equal(h.computerUpdateOn(), false)

    const here = flat(code(read('mobile/src/lib/hostUpdateHere.js')))
    assert.match(here, /export const useComputerUpdate = \(\) => computerUpdateOn\(\{ admin: useBluetoothAdmin\(\), everyone: COMPUTER_UPDATE_FOR_EVERYONE \}\)/)
    assert.match(here, /export const computerUpdateNow = \(\) => computerUpdateOn\(\{ admin: bluetoothAdmin\(\) === true, everyone: COMPUTER_UPDATE_FOR_EVERYONE \}\)/)
    // Every write asks the switch at that moment, and the log line waits for it too.
    assert.match(here, /mayWrite: \(\) => \{ const now = linkState\(\) return whyNotAsk\(\{ update: now\.macName === name \? now\.hostUpdate : null, switchOn: computerUpdateNow\(\),/)
    assert.match(here, /subscribeLink\(\(s\) => \{ if \(run\.result && !run\.phase && !stillSo\(run\.at, s\)\) clearUpdateRun\(\) if \(!computerUpdateNow\(\)\) return/)

    // What is drawn: nothing at all for an account the switch is off for.
    const comp = flat(code(read('mobile/src/components/HostUpdate.js')))
    assert.match(comp, /const on = useComputerUpdate\(\)[^]*?if \(!on \|\| demo \|\| throughAdapter \|\| s\.link !== 'connected' \|\| !s\.macName\) return null/)
    assert.match(comp, /export function HostCardLine\(\{ name, driven = false \}\) \{ const on = useComputerUpdate\(\) const owner = useOwnComputer\(\) const s = [^]*?if \(!on \|\| !name\) return null/)
    // And the screens hand it nothing else to draw: the cards are as they were, with the line beside them.
    const settings = flat(code(read('mobile/src/screens/Settings.js')))
    assert.match(settings, /<HostUpdate demo=\{demo\} throughAdapter=\{throughAdapter\} onOpenUpdating=\{\(\) => setPage\('updating'\)\} \/>/)
    assert.equal((settings.match(/<HostUpdate\b/g) || []).length, 1)
    assert.match(settings, /<Fragment key=\{card\.key\}> <UnitCard card=\{card\}[^]*?\/> <HostCardLine name=\{card\.name\} driven=\{card\.name === chosen\} \/> <\/Fragment>/)
    const live = flat(code(read('mobile/src/components/LiveUnit.js')))
    assert.match(live, /<Fragment key=\{card\.key\}> <UnitCard card=\{card\}[^]*?\/> <HostCardLine name=\{card\.name\} driven=\{card\.name === chosen\} \/> <\/Fragment>/)
    for (const [file, src] of [['Settings', settings], ['LiveUnit', live]]) {
      assert.doesNotMatch(src, /hostUpdate|updateNow|computerUpdateWords|remoteHostFacts/, `${file} draws the computer’s update itself, past the switch`)
    }

    // What is sent: the phone's reads of the computer are the reads they were, and the one new write is Update now's.
    const link = flat(code(read('mobile/src/lib/link.js')))
    assert.equal((link.match(/remoteRequest\(/g) || []).length, (flat(code(baseLink())).match(/remoteRequest\(/g) || []).length, 'link.js asks the computer something new')
    assert.match(link, /const doc = await remoteRequest\('\/store\/config\/host\.name'\)/)
    const relay = flat(code(read('mobile/src/lib/relay.js')))
    // The count of what is being sent only counts: the request goes on exactly as it did.
    assert.match(relay, /async function requestOnce\(path, method, options, trip = \{ went: false \}\) \{ if \(!countsAsSending\(method, path\)\) return requestOnceNow\(path, method, options, trip\) sendsOut\+\+ try \{ return await requestOnceNow\(path, method, options, trip\) \} finally \{ sendsOut = Math\.max\(0, sendsOut - 1\) lastSentAt = Date\.now\(\) \} \}/)
    assert.match(relay, /const countsAsSending = \(method, path\) => method !== 'GET' && !NOT_SENDING\.includes\(path\)/)
    const notSending = JSON.parse(relay.match(/const NOT_SENDING = (\[[^\]]+\])/)[1].replace(/'/g, '"'))
    const { PHONE_NOTE_PATH } = await import('../shared/phone-note.mjs')
    assert.deepEqual(notSending, [PHONE_NOTE_PATH, h.HOST_UPDATE_PATH], 'the phone’s own note, or the request itself, is counted as something being sent, and holds the request back for ever')
    assert.match(relay, /export const sendingHere = \(\) => \(\{ out: sendsOut, at: lastSentAt \}\)/)
    // Nothing anybody else draws reads the new state.
    for (const p of ['mobile/App.js', 'mobile/src/screens/Stage.js', 'mobile/src/components/Walk.js', 'mobile/src/components/UnitCard.js']) assert.doesNotMatch(read(p), /hostUpdate|HostUpdate|COMPUTER_UPDATE/, `${p} uses the computer’s update`)
  })

  test('host update: the log says what the computer said about its update when it changed, the request, the answer and the give-up', async () => {
    const h = await phone()
    const c = await computer()
    const ready = c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true })
    assert.equal(h.noteSaid('pedalboard', ready), 'pedalboard says its update: ready 1.92.3, goes in: idle, Update now offered')
    assert.equal(h.noteSaid('studio', c.updateNote({ kind: 'ready', version: '1.92.3' }, {})), 'studio says its update: ready 1.92.3, goes in: quit')
    assert.equal(h.noteSaid('pedalboard', c.updateNote({ kind: 'downloading', percent: 12, version: '1.92.3' })), 'pedalboard says its update: downloading 1.92.3 12%')
    assert.equal(h.noteSaid('pedalboard', c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true, asked: { at: 5, result: 'busy' } })), 'pedalboard says its update: ready 1.92.3, goes in: idle, Update now offered, answered request 5: busy')
    assert.equal(h.noteSaid('pedalboard', null), 'pedalboard says nothing about its update')
    // Written when it changes, and not for a percentage creeping up.
    const a = h.noteKey(c.updateNote({ kind: 'downloading', percent: 12, version: '1.92.3' }))
    assert.equal(a, h.noteKey(c.updateNote({ kind: 'downloading', percent: 13, version: '1.92.3' })))
    assert.notEqual(h.noteKey(ready), h.noteKey(c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true, asked: { at: 5, result: 'busy' } })))
    assert.equal(h.noteKey(null), null)
    // Each kept in the app's own log, under its own name.
    const here = flat(code(read('mobile/src/lib/hostUpdateHere.js')))
    assert.match(here, /if \(key === null \|\| key === saidKey\) return saidKey = key logDebug\('update', noteSaid\(s\.macName, s\.hostUpdate\)\)/)
    assert.match(here, /log: \(line\) => logDebug\('update', line\)/)
  })

  test('host update: the link keeps the computer’s note beside its version, and clears it with the version', async () => {
    const link = flat(code(read('mobile/src/lib/link.js')))
    assert.match(link, /set\(\{ macName: String\(name\), hostVersion: version \? String\(version\) : null, hostOs: data\?\.os \? String\(data\.os\)\.slice\(0, 40\) : null, hostUpdate: data\?\.update && typeof data\.update === 'object' \? data\.update : null \}\)/)
    assert.match(link, /if \('hostVersion' in patch && !\('hostUpdate' in patch\)\) next\.hostUpdate = null/, 'another computer’s, or Bluetooth’s, card shows the last computer’s update')
    assert.match(link, /sameNote\(next\.hostUpdate, state\.hostUpdate\) &&/, 'a changed note does not redraw the card')
    assert.match(link, /export async function readHostAgain\(\) \{ if \(!\(await readMacName\(\)\)\) return undefined return \{ name: state\.macName, version: state\.hostVersion, update: state\.hostUpdate \} \}/)
  })
  /* ------------------------------------------- what is still so, and when */

  test('host update: how a tap ended, and why one was not asked, are said only while the computer is still as it was', async () => {
    const h = await phone()
    const c = await computer()
    const ready = c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true })
    const pi = { link: 'connected', macName: 'pedalboard', hostVersion: '1.92.3', hostOs: PI_OS, hostUpdate: c.updateNote({ kind: 'current' }, { selfUpdating: true }) }
    const at = h.factsAt(pi)
    assert.deepEqual(at, { name: 'pedalboard', version: '1.92.3', note: h.noteKey(pi.hostUpdate) })
    assert.equal(h.stillSo(at, pi), true)
    assert.equal(h.stillSo(at, { ...pi, hostUpdate: { ...pi.hostUpdate } }), true, 'the same note read again is taken for another')
    assert.equal(h.stillSo(at, { ...pi, hostUpdate: { ...pi.hostUpdate, percent: 3 } }), true)
    for (const [change, what] of [
      [{ macName: 'studio' }, 'another computer'],
      [{ macName: null }, 'no computer'],
      [{ hostVersion: '1.92.5' }, 'another version'],
      [{ hostUpdate: c.updateNote({ kind: 'ready', version: '1.92.5' }, { selfUpdating: true }) }, 'a later ready note'],
      [{ hostUpdate: c.updateNote({ kind: 'downloading', version: '1.92.5' }) }, 'a download'],
      [{ hostUpdate: c.updateNote({ kind: 'current' }, { selfUpdating: true, asked: { at: 9, result: 'busy' } }) }, 'an answer'],
      [{ hostUpdate: null }, 'no note']
    ]) {
      assert.equal(h.stillSo(at, { ...pi, ...change }), false, `still said after ${what}`)
    }
    assert.equal(h.stillSo(null, pi), false)
    assert.equal(h.stillSo({ ...at, name: null }, { ...pi, macName: null }), false, 'said about no computer at all')

    // The card: where the run has got to, then how it ended, and then the computer's own news again.
    const ended = { name: 'pedalboard', phase: null, result: { state: 'updated', version: '1.92.3' }, at }
    const card = (run, s) => h.computerUpdateWords({ name: s.macName, version: s.hostVersion, os: s.hostOs, update: s.hostUpdate, ...h.runSays(run, s) })
    assert.deepEqual(h.runSays({ name: 'pedalboard', phase: 'asking', result: null, at: null }, pi), { sending: 'asking', result: null })
    assert.equal(card({ name: 'pedalboard', phase: 'installing', result: null, at: null }, pi).line, 'Updating pedalboard… The remote comes back by itself.')
    assert.deepEqual(h.runSays(ended, pi), { sending: null, result: ended.result })
    assert.equal(card(ended, pi).line, 'pedalboard is on version 1.92.3.')
    const later = { ...pi, hostUpdate: c.updateNote({ kind: 'ready', version: '1.92.5' }, { selfUpdating: true }) }
    assert.equal(card(ended, later).line, 'Version 1.92.5 is ready. It goes in by itself once it has been out for a day and nobody has used pedalboard for half an hour.', 'the last tap’s line hides the computer’s later news')
    assert.equal(card(ended, later).button, true, 'no Update now for a later version, because the last one went in')
    // A tap that did not go in, and the Pi then updated by itself: never "it stays on" beside its new version.
    const gaveUp = { name: 'pedalboard', phase: null, result: { state: 'gave-up', version: '1.92.0' }, at: h.factsAt({ ...pi, hostVersion: '1.92.0', hostUpdate: ready }) }
    assert.match(card(gaveUp, { ...pi, hostVersion: '1.92.0', hostUpdate: ready }).line, /didn't update\. It stays on version 1\.92\.0/)
    assert.equal(card(gaveUp, pi).line, 'Up to date')
    // Never on another computer's card, whatever it says.
    assert.deepEqual(h.runSays(ended, { ...pi, macName: 'studio' }), { sending: null, result: null })
    assert.deepEqual(h.runSays({ ...ended, phase: 'asking' }, { ...pi, macName: 'studio' }), { sending: null, result: null })
    assert.deepEqual(h.runSays({ name: null, phase: null, result: null, at: null }, pi), { sending: null, result: null })

    // The component draws the run through runSays, and the "not asked" note only while stillSo says it is about this computer.
    const comp = flat(code(read('mobile/src/components/HostUpdate.js')))
    assert.match(comp, /const words = computerUpdateWords\(\{ name, version: s\.hostVersion, os: s\.hostOs, update: s\.hostUpdate, owner, \.\.\.runSays\(run, s\) \}\)/)
    assert.match(comp, /const said = notAsked && stillSo\(notAsked\.at, s\) \? notAsked\.text : null/)
    assert.match(comp, /setNotAsked\(\{ text: notAskedWords\(why, name\), at: factsAt\(linkState\(\)\) \}\)/)
    assert.match(comp, /const offer = words\.button && !twice && !run\.phase/, 'Update now offered while another is out')
    assert.match(comp, /\{offer \? <Press label="Update now"/)
  })

  test('host update: Update now is reached only from the yes of the question before it', async () => {
    const comp = flat(code(read('mobile/src/components/HostUpdate.js')))
    assert.equal((comp.match(/updateNow\(/g) || []).length, 1, 'Update now is started somewhere other than the question’s yes')
    assert.match(comp, /const ask = confirmWords\(name\) Alert\.alert\(ask\.title, ask\.body, \[ \{ text: ask\.no, style: 'cancel' \}, \{ text: ask\.yes, onPress: \(\) => updateNow\(name\) \} \]\) \}/)
  })

  /* ---------------------------------------------- the right computer only */

  test('host update: a read of another computer is no read, and a run that ends on one says nothing about either', async () => {
    const h = await phone()
    const c = await computer()
    // Pedalboard asked; the relay then drives studio, on a higher version than pedalboard was asked for.
    let pi = await standInPi({ account: 'another' })
    const own = pi.readNote
    let away = false
    pi.readNote = async () => (away ? { name: 'studio', version: '1.92.4', update: c.updateNote({ kind: 'current' }) } : own())
    let tap = await tapOn(pi, {
      stretch: (ms) => {
        away = true
        return ms
      }
    })
    assert.deepEqual(tap.result, { state: 'left' }, 'studio’s version is taken for pedalboard’s')
    assert.ok(!tap.logs.some((l) => /is on version/.test(l)), tap.logs.join('\n'))
    assert.ok(tap.logs.includes('Update now: stopped waiting for pedalboard — another computer was being driven, so whether pedalboard updated is not known'))
    assert.equal(pi.writes.length, 1, 'asked again while another computer was being read')
    assert.equal(h.computerUpdateWords({ name: 'pedalboard', version: '1.92.0', result: tap.result, update: null }).line, null, 'a run that left says something about pedalboard')

    // Studio read while pedalboard restarts, and pedalboard back on the new version: that is pedalboard's own answer.
    // (Its restart is long enough that the phone looks while it is under way: it answers at 10 s, stops answering at 18 s, is back at 40 s; the phone looks at 15, 30 and 45 s.)
    pi = await standInPi({ restartMs: 30000 })
    const its = pi.readNote
    let studioReads = 0
    pi.readNote = async () => {
      if (pi.restartAt !== null && pi.clock >= pi.goingAt) {
        studioReads++
        return { name: 'studio', version: '1.91.0', update: null }
      }
      return its()
    }
    tap = await tapOn(pi)
    assert.ok(studioReads >= 1, 'studio was never read while pedalboard restarted')
    assert.deepEqual(tap.result, { state: 'updated', version: '1.92.3' })
    assert.equal(h.computerUpdateWords({ name: 'pedalboard', version: pi.version, os: PI_OS, update: c.updateNote(pi.state, { selfUpdating: true }), result: tap.result }).line, 'pedalboard is on version 1.92.3.')

    // One early read of studio, then pedalboard's own reads to the give-up: pedalboard's own answer, not "another computer".
    pi = await standInPi({ account: 'another' })
    const mine = pi.readNote
    let reads = 0
    let early = 0
    pi.readNote = async () => {
      if (++reads === 1) {
        early++
        return { name: 'studio', version: '1.92.4', update: c.updateNote({ kind: 'current' }) }
      }
      return mine()
    }
    tap = await tapOn(pi)
    assert.equal(early, 1, 'studio was never read')
    assert.ok(reads >= 2, 'studio was read and then pedalboard was never read again')
    assert.deepEqual(tap.result, { state: 'gave-up', version: '1.92.0' }, 'a read of studio long ago still counts after pedalboard’s own reads')
    assert.ok(tap.logs.some((l) => /gave up — pedalboard did not answer in 3 minutes, and is still on version 1\.92\.0/.test(l)), tap.logs.join('\n'))
    assert.ok(!tap.logs.some((l) => /stopped waiting/.test(l)), tap.logs.join('\n'))
  })

  test('host update: no request is written long after the tap, when the device held its look back', async () => {
    const h = await phone()
    assert.equal(h.RETRY_UNTIL_MS, 2 * h.RETRY_AFTER_MS)
    // The app in the background for twenty minutes, from the first look: the computer's answer has gone, and nothing more is written.
    let pi = await standInPi({ account: 'another' })
    let looks = 0
    let tap = await tapOn(pi, { stretch: (ms) => (++looks === 1 ? 20 * 60 * 1000 : ms) })
    assert.deepEqual(pi.writtenAt, [0], 'the second request went twenty minutes after the tap')
    assert.equal(tap.result.state, 'gave-up')
    // Just past the window: not written.
    pi = await standInPi({ account: 'another' })
    looks = 0
    tap = await tapOn(pi, { stretch: (ms) => (++looks === 1 ? h.RETRY_UNTIL_MS : ms) })
    assert.deepEqual(pi.writtenAt, [0], 'the second request went at the end of its window')
    // Just inside it: written once more, still.
    pi = await standInPi({ account: 'another' })
    looks = 0
    tap = await tapOn(pi, { stretch: (ms) => (++looks === 1 ? h.RETRY_UNTIL_MS - 1000 : ms) })
    assert.deepEqual(pi.writtenAt, [0, h.RETRY_UNTIL_MS - 1000])
    // Held past the give-up time after a busy answer was cleared: nothing.
    pi = await standInPi({ account: 'another' })
    looks = 0
    tap = await tapOn(pi, { stretch: (ms) => (++looks === 1 ? h.GIVE_UP_MS + 1 : ms) })
    assert.deepEqual(pi.writtenAt, [0])
  })

  /* ------------------------------------------------- the wiring, run */

  test('host update: Update now run whole on a bench asks for the note’s version, which the computer acts on, and shows asking, installing, then the result', async () => {
    const h = await phone()
    const c = await computer()
    const t = await hereOnABench()
    const pi = await t.drive(await standInPi())
    const lines = []
    t.bench.onSleep = () => lines.push(t.line())
    const result = await t.here.updateNow('pedalboard')
    lines.push(t.line())
    assert.deepEqual(result, { state: 'updated', version: '1.92.3' })
    assert.equal(pi.writes.length, 1)
    assert.deepEqual(pi.writes[0].data, { host: 'pedalboard', version: '1.92.3', account: ACCOUNT, at: pi.writes[0].data.at }, 'the request asks for another version than the one the note offers')
    assert.deepEqual(pi.answers, ['installing'], 'the computer’s own updateAsk did not act on it')
    assert.deepEqual(t.bench.requests.map((r) => `${r.method} ${r.path}`), ['PUT /store/config/host.update'])
    const said = lines.filter((l, i) => l !== lines[i - 1])
    assert.deepEqual(said, ['Asking pedalboard to update…', 'Updating pedalboard… The remote comes back by itself.', 'pedalboard is on version 1.92.3.'])
    assert.ok(t.bench.logged.includes('update Update now: pedalboard is on version 1.92.3 (was 1.92.0)'))

    // It goes when the computer moves on: a later ready note.
    t.link.setLink({ hostUpdate: c.updateNote({ kind: 'ready', version: '1.92.5' }, { selfUpdating: true }) })
    assert.equal(t.here.useUpdateRun().result, null, 'how the last tap ended is kept after the computer moved on')
    assert.equal(t.line(), 'Version 1.92.5 is ready. It goes in by itself once it has been out for a day and nobody has used pedalboard for half an hour.')
    assert.equal(t.words().button, true)

    // Back already offering a newer one (it had downloaded the next release): that offer, and Update now, from the moment the run ends.
    const u = await hereOnABench()
    const next = await u.drive(await standInPi())
    const plain = next.readNote
    next.readNote = async () => {
      const note = await plain()
      return note && note.version === '1.92.3' ? { ...note, update: c.updateNote({ kind: 'ready', version: '1.92.5' }, { selfUpdating: true }) } : note
    }
    assert.deepEqual(await u.here.updateNow('pedalboard'), { state: 'updated', version: '1.92.3' })
    assert.ok(u.here.useUpdateRun().result, 'the run’s end was not kept')
    assert.equal(u.line(), 'Version 1.92.5 is ready. It goes in by itself once it has been out for a day and nobody has used pedalboard for half an hour.')
    assert.equal(u.words().button, true, 'no Update now for the newer version once the run ended')
  })

  test('host update: the result goes when another computer is driven, and on a sign-out', async () => {
    const c = await computer()
    let t = await hereOnABench()
    await t.drive(await standInPi({ busy: 'screen' }))
    let result = await t.here.updateNow('pedalboard')
    assert.equal(result.state, 'refused')
    assert.equal(t.line(), 'Somebody is using the screen on pedalboard. Try again in a couple of minutes.')
    t.link.setLink({ macName: 'studio', hostVersion: '1.92.4', hostUpdate: c.updateNote({ kind: 'current' }) })
    assert.equal(t.here.useUpdateRun().result, null, 'the result outlives the computer it was about')
    t.link.setLink({ macName: 'pedalboard', hostVersion: '1.92.0', hostUpdate: c.updateNote({ kind: 'ready', version: '1.92.3' }, { selfUpdating: true }) })
    assert.equal(t.line(), 'Version 1.92.3 is ready. It goes in by itself once it has been out for a day and nobody has used pedalboard for half an hour.')
    // And once that run is over, Update now can be asked again, of the computer it names.
    const pedalboard = t.bench.computers.pedalboard
    result = await t.here.updateNow('pedalboard')
    assert.notEqual(result, null, 'Update now does nothing after one refused try')
    assert.equal(pedalboard.writes.length, 2, 'the second Update now wrote nothing')
    assert.equal(pedalboard.writes[1].data.host, 'pedalboard')

    t = await hereOnABench()
    await t.drive(await standInPi({ busy: 'screen' }))
    result = await t.here.updateNow('pedalboard')
    assert.equal(result.state, 'refused')
    // Bluetooth news with the switch still on (an adapter scan, say): the result stays.
    t.bt.announce()
    assert.deepEqual(t.here.useUpdateRun().result, result, 'the result goes on Bluetooth news for his own account')
    assert.equal(t.line(), 'Somebody is using the screen on pedalboard. Try again in a couple of minutes.')
    t.bench.admin = false
    t.bt.announce()
    assert.equal(t.here.useUpdateRun().result, null, 'the result outlives the sign-out')

    // Signed out while the run is out: how it ended is not kept for whoever signs in next.
    t = await hereOnABench()
    await t.drive(await standInPi({ busy: 'screen' }))
    t.bench.onSleep = () => {
      t.bench.admin = false
      t.bt.announce()
    }
    result = await t.here.updateNow('pedalboard')
    assert.equal(result.state, 'refused')
    assert.equal(t.here.useUpdateRun().result, null, 'a run that ended after a sign-out keeps its result')
  })

  test('host update: one run at a time for any computer, and a run that loses its computer never says it updated', async () => {
    const c = await computer()
    const t = await hereOnABench()
    const pedalboard = await t.drive(await standInPi({ account: 'another' }))
    const studio = await standInPi()
    studio.name = 'studio'
    studio.version = '1.92.4'
    studio.state = { kind: 'ready', version: '1.92.6' }
    let second
    let looks = 0
    t.bench.onSleep = () => {
      if (++looks !== 2) return
      // He picks studio, which has its own update ready, and taps Update now on it.
      t.bench.computers.studio = studio
      t.bench.driven = 'studio'
      t.link.setLink({ macName: 'studio', hostVersion: '1.92.4', hostUpdate: c.updateNote(studio.state, { selfUpdating: true }) })
      second = t.here.updateNow('studio')
    }
    const first = await t.here.updateNow('pedalboard')
    assert.equal(await second, null, 'a second Update now ran while one was out')
    assert.equal(studio.writes.length, 0, 'studio was asked while pedalboard’s run was out')
    assert.equal(pedalboard.writes.length, 1)
    assert.deepEqual(first, { state: 'left' }, 'studio’s version taken for pedalboard’s')
    assert.ok(!t.bench.logged.some((l) => /is on version|stays on|still on/.test(l)), t.bench.logged.join('\n'))
    // Nothing of pedalboard's run on studio's card: studio's own news.
    assert.equal(t.line(), 'Version 1.92.6 is ready. It goes in by itself once it has been out for a day and nobody has used studio for half an hour.')
    assert.equal(t.words().button, true)
    // And once it is over, studio can be asked.
    assert.equal(t.here.useUpdateRun().phase, null)
    const again = await t.here.updateNow('studio')
    assert.notEqual(again, null, 'Update now does nothing once a run has ended')
    assert.ok(studio.writes.length >= 1, 'studio was not asked once pedalboard’s run was over')
    assert.equal(studio.writes[0].data.host, 'studio')
    assert.equal(studio.writes[0].data.version, '1.92.6')
    assert.equal(pedalboard.writes.length, 1, 'pedalboard was asked for studio’s run')

    // Pedalboard said it was installing, and then studio was driven: still not known, and logged as such, never as "still on version".
    const u = await hereOnABench()
    await u.drive(await standInPi())
    const other = await standInPi()
    other.name = 'studio'
    other.version = '1.92.4'
    other.state = { kind: 'current' }
    let turns = 0
    u.bench.onSleep = () => {
      if (++turns !== 2) return
      other.since = u.bench.t
      u.bench.computers.studio = other
      u.bench.driven = 'studio'
    }
    const lost = await u.here.updateNow('pedalboard')
    assert.deepEqual(lost, { state: 'left' })
    assert.ok(u.bench.logged.includes('update Update now: pedalboard answered: installing'), u.bench.logged.join('\n'))
    assert.ok(u.bench.logged.includes('update Update now: stopped waiting for pedalboard — another computer was being driven, so whether pedalboard updated is not known'), u.bench.logged.join('\n'))
    assert.ok(!u.bench.logged.some((l) => /said it was installing|is on version|stays on|still on/.test(l)), u.bench.logged.join('\n'))
  })

  test('host update: the checks made at the tap and before each write refuse busy, two by one name and the wrong link, run', async () => {
    const c = await computer()
    const cases = [
      ['busy', (b) => (b.sending = { out: 1, at: 0 })],
      ['busy', (b) => (b.sending = { out: 0, at: b.t - 2000 })],
      ['clash', (b) => (b.hosts = ['pedalboard', 'studio', 'pedalboard'])],
      ['link', (b) => (b.via = 'bluetooth')],
      ['link', (b) => (b.via = 'demo')],
      ['link', (b) => (b.state = { ...b.state, link: 'joining' })],
      ['account', (b) => ((b.user = null), (b.kept = null))],
      ['not-ready', (b) => (b.state = { ...b.state, hostUpdate: c.updateNote({ kind: 'ready', version: '1.92.3' }, {}) })],
      ['off', (b) => (b.admin = false)]
    ]
    for (const [why, set] of cases) {
      const t = await hereOnABench()
      const pi = await t.drive(await standInPi())
      assert.equal(await t.here.whyNotNow('pedalboard'), null, 'refused with nothing against it')
      set(t.bench)
      assert.equal(await t.here.whyNotNow('pedalboard'), why, `the tap is let through with ${why}`)
      const result = await t.here.updateNow('pedalboard')
      assert.deepEqual(result, { state: 'not-sent', why }, `written with ${why}`)
      assert.equal(pi.writes.length, 0, `written with ${why}`)
      assert.deepEqual(t.bench.requests, [])
    }
    // The kept sign-in is the account when the relay has none.
    const t = await hereOnABench()
    await t.drive(await standInPi())
    t.bench.user = null
    t.bench.kept = { id: ACCOUNT }
    assert.equal(await t.here.whyNotNow('pedalboard'), null)
  })

}

/* link.js as it was at the computer half (a3636849): three requests in its code, kept as the count, so the old file need not be. */
function baseLink() {
  return "remoteRequest( ".repeat(BASE_LINK_REQUESTS)
}
const BASE_LINK_REQUESTS = 3
const read_ = read
