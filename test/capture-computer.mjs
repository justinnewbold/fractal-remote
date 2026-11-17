/**
 * A CAPTURE IS NOT SENT THROUGH A COMPUTER APP TOO OLD TO HAVE IT KEPT
 * (mobile/src/lib/captureComputer.js, and the TONE3000 card that asks it,
 * mobile/src/components/Tone3000Test.js).
 *
 * His log of 16 November 2026: the phone on 1.91.6 drove his Axe-Fx III
 * through "raspberry pi 5", whose computer app was 1.90.63. Two TONE3000
 * Previews went, every message was taken, and the unit kept neither (name
 * bytes 0x02 and 0x17: that computer app puts the name XORed in). The card
 * said "The Axe-Fx III took the capture 2 different ways and still shows
 * slot 041 as empty, so it did not keep it. The app's log has what the unit
 * answered each time." Nothing on the screen said the Pi was too old.
 *
 * Held here: the rule and its words, run as they are; and the card itself,
 * bundled with stand-ins for everything it draws with and sends through and
 * driven as a player drives it (the pattern of test/volume-drag.mjs), so
 * that what is checked is what a tap does, not what the file looks like.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const read = (p) => readFileSync(repo(p), 'utf8')
const lib = () => import('../mobile/src/lib/captureComputer.js')

const PI = { name: 'raspberry pi 5', version: '1.90.63' }
const TOO_OLD_PI = 'The computer app on raspberry pi 5 is version 1.90.63. The Axe-Fx III drops most captures sent through one that old. Update the computer app to 1.90.70 or later, then send it again. Or connect over Bluetooth, which sends it from this phone.'
const NOT_KEPT_OLD = 'The Axe-Fx III took the capture 2 different ways and still shows slot 041 as empty, so it did not keep it. The computer app on raspberry pi 5 is older than 1.90.70, and the unit drops most captures sent through one that old. Update the computer app to 1.90.70 or later, then send it again. Or connect over Bluetooth, which sends it from this phone.'
const NOT_KEPT_TODAY = 'The Axe-Fx III took the capture 2 different ways and still shows slot 041 as empty, so it did not keep it. The app’s log has what the unit answered each time.'

/*
 * The card's world. Hooks kept by call order (a state keeps its value, an
 * effect runs after the draw that changed what it depends on); the link,
 * the wire and TONE3000 as the test sets them; every send and fetch written
 * down in H.log.
 */
const STANDINS = `
export const H = { slots: [], i: 0, effects: [], log: [], placed: {}, link: { link: 'connected', macName: 'raspberry pi 5', hostVersion: '1.90.63' }, through: true, linkFns: new Set(), installs: [], rig: { preset: { number: 386 }, sceneIndex: 0, bufferRev: 0 }, picks: [], models: [{ id: 748130, name: 'FNDR BFSR VB Edge WRM2 CAB FREE' }] }
export function useState(init) {
  const k = H.i++
  if (!(k in H.slots)) H.slots[k] = { v: typeof init === 'function' ? init() : init }
  const s = H.slots[k]
  return [s.v, (n) => { s.v = typeof n === 'function' ? n(s.v) : n }]
}
export function useRef(init) {
  const k = H.i++
  if (!(k in H.slots)) H.slots[k] = { current: init }
  return H.slots[k]
}
export function useEffect(fn, deps) {
  const k = H.i++
  const prev = H.slots[k]
  const changed = !prev || !deps || deps.some((d, j) => !Object.is(d, prev.deps[j]))
  if (changed) H.effects.push(() => { prev?.cleanup?.(); const cleanup = fn(); H.slots[k] = { deps, cleanup } })
}
export const createElement = (type, props, ...children) => ({ type, props: props || {}, children })
export const Fragment = 'Fragment'
export const Image = 'Image', Pressable = 'Pressable', Text = 'Text', View = 'View'
export const color = new Proxy({}, { get: () => '#000' }), font = new Proxy({}, { get: () => 12 }), radius = new Proxy({}, { get: () => 8 }), space = new Proxy({}, { get: () => 8 }), TAP = 44
export const thud = () => {}, tick = () => {}
export const fire = (what, fn) => fn()
export const logDebug = (...said) => { H.log.push(['log', ...said]) }
export const gearSaid = () => 'amp', readCallback = () => null, T3K_POWERED = 'Powered by TONE3000', toneCredit = () => 'credit'
export const creatorImage = () => null, creatorOf = () => 'maker', makesOf = () => '', toneBrowser = () => ({}), toneImage = () => null
export const hostPage = () => () => {}, onTone3000Return = () => () => {}, pageInApp = () => false, startOutside = async () => {}
export const t3k = {
  signedIn: async () => true,
  me: async () => ({ username: 'justin' }),
  tone: async (id) => ({ id, title: 'Fender Super Reverb', user: { username: 'maker' }, license: 'x' }),
  models: async () => H.models,
  modelText: async (m) => { H.log.push(['fetch', m.id]); return 'nam text' },
  search: async () => [], feed: async () => [], finish: async () => null, start: async () => {}, signOut: async () => {}
}
export const readNam = () => ({ ok: true, a2: true }), namSaid = () => 'An A2 capture'
export const NAM_BLOCKS = [206, 207], NAM_EMPTY = '<EMPTY>'
export const namSlotSaid = (slot) => String(slot + 1).padStart(3, '0')
/* What the packer would make, without a file: the name XORs to 0x02, 0x60 is packed, with or without the hash. */
export const namRecord = (text, named) => ({ ok: true, name: named.name, words: [], xor: 0x02, byte: 0x60, hashed: named.hash !== false })
export const isPlaced = (id) => id in H.placed, placedNow = () => ({ ...H.placed }), settled = () => {}, watchPlaced = () => () => {}
export const place = (id, slot, sure) => { H.placed[id] = { slot, sure: !!sure } }
export const unplace = (id) => { delete H.placed[id] }
export const claimSlot = () => {}, forgetNotKept = () => {}, notKept = () => {}, notKeptIn = () => null
export const capturesThroughComputer = () => H.through
export const namEmptySlotHere = async () => { H.log.push(['empty']); return { slot: 40, heads: [] } }
export const namInstallHere = async (slot, words) => { H.log.push(['install', slot]); return H.installs.length ? H.installs.shift() : { slot, name: '<EMPTY>', replaced: null, seconds: 0.5 } }
/* What the unit answers a pick, in turn (\`H.picks\`: an answer, or an Error it throws), else the capture by name. */
export const namPickHere = async (block, slot) => { H.log.push(['pick', block, slot]); const next = H.picks.shift(); if (next instanceof Error) throw next; return next || { block, slot, name: 'FNDR BFSR VB Edge WRM2 CAB FREE' } }
export const linkState = () => H.link
/* Where the unit is (lib/rig), as a test sets it: \`H.rig\`. */
export const useRig = (select) => select(H.rig), getState = () => H.rig
export const subscribeLink = (fn) => { H.linkFns.add(fn); return () => H.linkFns.delete(fn) }
export default 'Drawn'
`

/* The libraries that are the card's own rules run as they are; everything else is a stand-in. */
const REAL = {
  '../lib/captureComputer': 'mobile/src/lib/captureComputer.js',
  '../lib/captureComputerHere': 'mobile/src/lib/captureComputerHere.js',
  '../lib/captureLine': 'mobile/src/lib/captureLine.js',
  '../lib/namPlaying': 'mobile/src/lib/namPlaying.js',
  '../lib/namPlayingHere': 'mobile/src/lib/namPlayingHere.js',
  '../lib/captureSend': 'mobile/src/lib/captureSend.js',
  '../lib/tone3000Words': 'mobile/src/lib/tone3000Words.js',
  '../lib/device-word': 'mobile/src/lib/device-word.js'
}
const STAND_IN_FROM_LIB = new Set(['./nam-install.js', './capturePlaced.js', './device', './link', './rig'])

/** The card on a bench. `source` is the file's text, so a check can run a copy with the fix taken out. */
export async function bench(source = read('mobile/src/components/Tone3000Test.js')) {
  const { build } = await import('esbuild')
  const dir = mkdtempSync(join(tmpdir(), 'capture-computer-'))
  try {
    const standins = join(dir, 'standins.mjs')
    writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
    writeFileSync(standins, STANDINS)
    writeFileSync(join(dir, 'Card.js'), source)
    await build({
      entryPoints: [join(dir, 'Card.js')],
      bundle: true,
      format: 'esm',
      outfile: join(dir, 'out.mjs'),
      loader: { '.js': 'jsx', '.png': 'empty' },
      jsx: 'transform',
      jsxFactory: '__h',
      jsxFragment: '__F',
      banner: { js: `import { createElement as __h, Fragment as __F } from './standins.mjs';` },
      logLevel: 'silent',
      plugins: [
        {
          name: 'standins',
          setup(b) {
            b.onResolve({ filter: /.*/ }, (a) => {
              if (a.kind === 'entry-point') return undefined
              if (REAL[a.path]) return { path: repo(REAL[a.path]) }
              if (a.importer.startsWith(repo('mobile/src/lib/'))) return STAND_IN_FROM_LIB.has(a.path) ? { path: './standins.mjs', external: true } : { path: repo(`mobile/src/lib/${a.path.replace(/^\.\//, '').replace(/(\.js)?$/, '.js')}`) }
              return { path: './standins.mjs', external: true }
            })
          }
        }
      ]
    })
    const { default: Card } = await import(pathToFileURL(join(dir, 'out.mjs')).href)
    const { H } = await import(pathToFileURL(standins).href)
    const wait = (ms) => new Promise((done) => setTimeout(done, ms))
    let tree = null
    let props = {}
    const all = (n, is, out = []) => {
      if (!n || typeof n !== 'object') return out
      if (Array.isArray(n)) {
        for (const c of n) all(c, is, out)
        return out
      }
      if (n.props && is(n)) out.push(n)
      all(n.children, is, out)
      all(n.props?.children, is, out)
      return out
    }
    const text = (n) => {
      if (n == null || n === false) return ''
      if (typeof n === 'string' || typeof n === 'number') return String(n)
      if (Array.isArray(n)) return n.map(text).join('')
      return text(n.children) + text(n.props?.children)
    }
    const draw = async (p = props) => {
      props = p
      /* A few rounds: an effect's promise lands, its state is set, the card is drawn again. */
      for (let round = 0; round < 4; round++) {
        H.i = 0
        tree = Card(props)
        const run = H.effects
        H.effects = []
        for (const fn of run) fn()
        await wait(3)
      }
    }
    return {
      H,
      draw,
      wait,
      /** Signed in, the list up, a tone tapped: its view, with its capture's two buttons. */
      async openTone(p = {}) {
        await draw(p)
        const list = all(tree, (n) => typeof n.props.onOpen === 'function')[0]
        assert.ok(list, 'the list was not drawn')
        list.props.onOpen({ id: 88775, title: 'Fender Super Reverb' })
        await draw()
      },
      button: (label) => all(tree, (n) => n.props.label === label)[0] || null,
      /** Every sentence on the view, wherever it is drawn: a note's children, a card's lines. */
      said: () => [...all(tree, (n) => n.type === 'Drawn' && typeof n.props.head === 'string').map((n) => `${n.props.head}|${n.props.line}|${n.props.more || ''}`), ...all(tree, (n) => n.type === 'Drawn').map((n) => text(n))].join('\n'),
      cards: () => all(tree, (n) => n.type === 'Drawn' && typeof n.props.head === 'string').map((n) => ({ head: n.props.head, line: n.props.line })),
      /** What went to the unit or TONE3000 for a capture: fetches, slot searches, installs, picks. */
      sent: () => H.log.filter((l) => l[0] !== 'log'),
      logs: () => H.log.filter((l) => l[0] === 'log').map((l) => l.slice(1).join(' ')),
      /** The link changes, as lib/link tells its watchers. */
      async link(next) {
        H.link = { ...H.link, ...next }
        for (const fn of [...H.linkFns]) fn(H.link)
        await draw()
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* How many times a sentence is on the view. */
const times = (all, s) => all.split(s).length - 1

/* A copy of the card's file with one piece taken out, for the checks that a fix is what makes a test pass. */
export const without = (from, to) => {
  const src = read('mobile/src/components/Tone3000Test.js')
  assert.ok(src.includes(from), `the card no longer has: ${from}`)
  return src.replace(from, to)
}

export function run(test) {
  test('captures through a computer: the version, the rule, and its words, run as they are', async () => {
    const c = await lib()
    /* ForgeFX 64c44a7, pinned by the 1.90.70 change: computer release v1.90.70 is the first that sends the name byte as packed and says which byte went. */
    assert.equal(c.CAPTURES_KEPT_FROM, '1.90.70')
    const lock = read('mobile/src/lib/captureComputer.js')
    assert.match(lock, /ForgeFX 64c44a7/, 'the version no longer says where it comes from')
    /* Never above the app's own version: a computer is never told to update to one that may not exist. */
    const { isOlder } = await import('../shared/versions.mjs')
    const app = JSON.parse(read('package.json')).version
    assert.equal(isOlder(app, c.CAPTURES_KEPT_FROM), false)

    /* Through the computer, its app said 1.90.63: too old, and named. */
    assert.deepEqual(c.computerTooOld({ through: true, ...PI }), PI)
    /* The other computers of that log: the MacBook on 1.90.82 is new enough, and so is the release itself. */
    assert.equal(c.computerTooOld({ through: true, name: 'MacBook Pro SG 566', version: '1.90.82' }), null)
    assert.equal(c.computerTooOld({ through: true, name: 'x', version: '1.90.70' }), null)
    assert.deepEqual(c.computerTooOld({ through: true, name: 'raspberry pi 3', version: '1.90.69' }), { name: 'raspberry pi 3', version: '1.90.69' })
    /* Never on a guess: a computer that has not said its version, or said something that is not one. */
    for (const version of [null, undefined, '', 'unknown', '1.90']) assert.equal(c.computerTooOld({ through: true, name: 'raspberry pi 5', version }), null, String(version))
    /* Never over Bluetooth, the unit's USB cable into the phone, or the demo: those send from the phone itself. */
    assert.equal(c.computerTooOld({ through: false, ...PI }), null)
    assert.equal(c.computerTooOld({ ...PI }), null)

    /* The words, as they are shown, naming the computer and both versions and the device in hand. */
    assert.equal(c.tooOldWords(PI, 'phone'), TOO_OLD_PI)
    assert.match(c.tooOldWords(PI, 'iPad'), /which sends it from this iPad\.$/)
    assert.match(c.tooOldWords({ name: '', version: '1.90.63' }, 'phone'), /^The computer app is version 1\.90\.63\./)
    /* Short enough for the hold pop-up's sheet, and none of the words the house rules keep off a screen. */
    for (const s of [c.tooOldWords(PI, 'phone'), c.unkeptWords({ tries: 2, slotSaid: '041', computer: { name: 'raspberry pi 5', version: null } }, 'phone')]) {
      assert.ok(s.split(/\s+/).length <= 70, `too long for the sheet: ${s.split(/\s+/).length} words`)
      assert.doesNotMatch(s, /\bbeta\b|\btried\b|\bofficial\b|\bsoon\b|XOR|0x/i)
    }
    /* The source names the device by deviceNoun, never "this phone" in its own words. */
    assert.doesNotMatch(lock.replace(/\/\*[\s\S]*?\*\//g, ''), /this phone/)
  })

  test('captures through a computer: a capture the unit did not keep says the computer is too old where the computer did not say which byte went, and nothing else changes', async () => {
    const c = await lib()
    /* The computer did not say which byte went, and its version was not known: the reason and the remedy, in place of the log. */
    const pi = c.oldAfterSend({ old: true, version: null, name: 'raspberry pi 5' })
    assert.deepEqual(pi, { name: 'raspberry pi 5', version: null })
    assert.equal(c.unkeptWords({ tries: 2, slotSaid: '041', computer: pi }, 'phone'), NOT_KEPT_OLD)
    /* One way only (a file with no hash), the same reason. */
    assert.match(c.unkeptWords({ tries: 1, slotSaid: '041', computer: pi }, 'phone'), /^The Axe-Fx III took the capture and then still shows slot 041 as empty, so it did not keep it\. The computer app on raspberry pi 5 is older than 1\.90\.70/)
    /* A version known and older (said after the send began) is named. */
    assert.match(c.unkeptWords({ tries: 2, slotSaid: '041', computer: c.oldAfterSend({ old: true, ...PI }) }, 'phone'), /The computer app on raspberry pi 5 is version 1\.90\.63, and the unit drops most/)
    /* Every other not-kept case keeps today's words: the computer said which byte went, or its version is new enough. */
    assert.equal(c.oldAfterSend({ old: false, ...PI }), null)
    assert.equal(c.oldAfterSend({ old: true, name: 'x', version: '1.90.82' }), null)
    assert.equal(c.unkeptWords({ tries: 2, slotSaid: '041', computer: null }, 'phone'), NOT_KEPT_TODAY)
    assert.equal(c.unkeptWords({ tries: 1, slotSaid: '035', computer: null }, 'phone'), 'The Axe-Fx III took the capture and then still shows slot 035 as empty, so it did not keep it. Send it once more; if it says this again, the app’s log has what the unit answered.')

    /* lib/captureSend says when an answer had no byte in it (`old`), and when every answer did. */
    const { sendCapture } = await import('../mobile/src/lib/captureSend.js')
    const { namRecord } = await import('../mobile/src/lib/nam-install.js')
    /* A small A2 file, as test/bluetooth.mjs makes them: two networks of the right sizes, a name, no hash. */
    const w = (n, at) => Array.from({ length: n }, (_, i) => Math.fround((at + i) / 100000))
    const text = JSON.stringify({ version: '0.7.0', architecture: 'SlimmableContainer', config: { submodels: [{ max_value: 0.5, model: { weights: w(1871, 1) } }, { max_value: 1, model: { weights: w(12146, 50001) } }] }, weights: [], sample_rate: 48000, metadata: { name: 'Short One', loudness: -17.5, gain: 0.5 } })
    assert.ok(namRecord(text, { name: 'Short One' }).ok, 'the fixture is no capture')
    const go = (answer) => sendCapture({ text, named: { name: 'Short One' }, slot: 40, install: async (slot) => ({ slot, name: '<EMPTY>', seconds: 0.5, ...answer }) })
    assert.equal((await go({})).old, true, 'an answer with no byte in it is not said as an older computer app')
    assert.equal((await go({ nameByte: 0x60 })).old, false)
  })

  test('captures through a computer: the tone’s view says it once, up top, and never twice', async () => {
    const c = await lib()
    assert.equal(c.tooOldUpTop({ computer: PI, captures: true, send: null }), true)
    /* A capture's own card says it now: not up top as well. */
    assert.equal(c.tooOldUpTop({ computer: PI, captures: true, send: { id: 1, line: TOO_OLD_PI, old: true } }), false)
    /* Another capture's card, about something else: still up top. */
    assert.equal(c.tooOldUpTop({ computer: PI, captures: true, send: { id: 1, line: 'That capture couldn’t be fetched.' } }), true)
    assert.equal(c.tooOldUpTop({ computer: null, captures: true, send: null }), false)
    assert.equal(c.tooOldUpTop({ computer: PI, captures: false, send: null }), false)
  })

  test('captures through a computer: on the card, through raspberry pi 5 on 1.90.63, Preview and Get send nothing, fetch nothing and say why once, under the capture', async () => {
    for (const which of ['Preview', 'Get']) {
      const b = await bench()
      await b.openTone()
      /* Up top as the view opens, once. */
      assert.equal(times(b.said(), TOO_OLD_PI), 1, `the view does not say it once as it opens: ${b.said()}`)
      /* LineButton is the card's own: its onPress is the tap. */
      const btn = b.button(which)
      assert.ok(btn, `no ${which} button`)
      btn.props.onPress()
      await b.draw()
      assert.deepEqual(b.sent(), [], `${which} sent or fetched something through a computer app too old: ${JSON.stringify(b.sent())}`)
      assert.deepEqual(b.cards(), [{ head: 'Not on your Axe-Fx III', line: TOO_OLD_PI }], `${which}: the card under the capture does not say why`)
      /* Said once on the view: the card, and no longer up top. */
      assert.equal(times(b.said(), TOO_OLD_PI), 1, `${which}: said twice on one view`)
      assert.ok(b.logs().some((l) => /capture 748130 \(FNDR BFSR VB Edge WRM2 CAB FREE\) was not sent: the computer app on raspberry pi 5 is 1\.90\.63, older than 1\.90\.70/.test(l)), b.logs().join(' | '))
    }
  })

  test('captures through a computer: over Bluetooth, a computer that is new enough, or one that has not said its version, the card sends as it did and says nothing of it', async () => {
    for (const [why, set] of [
      ['Bluetooth', (H) => (H.through = false)],
      ['1.90.70', (H) => (H.link = { ...H.link, hostVersion: '1.90.70' })],
      ['1.90.82', (H) => (H.link = { ...H.link, macName: 'MacBook Pro SG 566', hostVersion: '1.90.82' })],
      ['no version', (H) => (H.link = { ...H.link, hostVersion: null })]
    ]) {
      const b = await bench()
      set(b.H)
      await b.openTone()
      assert.doesNotMatch(b.said(), /drops most captures/, `${why}: said up top`)
      b.H.installs.push({ slot: 40, name: 'FNDR BFSR VB Edge WRM2 CAB FREE', seconds: 0.5, nameByte: 0x60 })
      b.button('Get').props.onPress()
      await b.wait(10)
      await b.draw()
      assert.deepEqual(b.sent().slice(0, 3), [['fetch', 748130], ['empty'], ['install', 40]], `${why}: not sent`)
    }
  })

  test('captures through a computer: a computer that turns out too old says so on the card that is up, and a newer one, or Bluetooth, takes it back down', async () => {
    const b = await bench()
    b.H.link = { ...b.H.link, hostVersion: null }
    await b.openTone()
    assert.doesNotMatch(b.said(), /drops most captures/)
    /* The computer says its version (lib/link asks every two minutes). */
    await b.link({ hostVersion: '1.90.63' })
    assert.equal(times(b.said(), TOO_OLD_PI), 1)
    b.button('Preview').props.onPress()
    await b.draw()
    assert.deepEqual(b.sent(), [])
    /* Updated: the card that said so comes down, and the buttons send. */
    await b.link({ hostVersion: '1.90.90' })
    assert.doesNotMatch(b.said(), /drops most captures/, 'the card still says to update a computer that has been')
    assert.deepEqual(b.cards(), [])
  })

  test('captures through a computer: Send it again, after a send that stopped part-way, sends nothing through one too old either', async () => {
    const b = await bench()
    b.H.link = { ...b.H.link, hostVersion: null }
    await b.openTone()
    /* A send that stops part-way, through a computer that has not said its version. */
    b.H.installs.push(Promise.reject(Object.assign(new Error('The capture stopped part of the way into slot 041.'), { partial: true, slot: 40 })))
    b.H.installs[0].catch(() => {})
    b.button('Get').props.onPress()
    await b.wait(10)
    await b.draw()
    const again = b.button('Send it again to slot 041')
    assert.ok(again, 'no Send it again')
    b.H.log.length = 0
    await b.link({ hostVersion: '1.90.63' })
    b.button('Send it again to slot 041').props.onPress()
    await b.draw()
    assert.deepEqual(b.sent(), [], 'Send it again went through a computer app too old')
    assert.deepEqual(b.cards(), [{ head: 'Not on your Axe-Fx III', line: TOO_OLD_PI }])
  })

  test('captures through a computer: playing a capture already on the unit is not a send, and goes as it did through a computer app too old', async () => {
    const b = await bench()
    b.H.placed[748130] = { slot: 40, sure: true }
    await b.openTone()
    b.button('Play it in NAM 1').props.onPress()
    await b.wait(5)
    await b.draw()
    assert.deepEqual(b.sent(), [['pick', 206, 40]])
    /* From a held block: Play it in that block, and Use it and go back. */
    const held = await bench()
    held.H.placed[748130] = { slot: 40, sure: true }
    let done = null
    await held.openTone({ block: 207, held: true, onDone: (l) => (done = l) })
    held.button('Use it and go back').props.onPress()
    await held.wait(5)
    await held.draw()
    assert.deepEqual(held.sent(), [['pick', 207, 40]])
    assert.match(String(done), /^NAM 2 is playing/)
  })

  test('captures through a computer: a capture sent through a computer that did not say its version, and not kept, says the computer is too old in place of the log', async () => {
    const b = await bench()
    b.H.link = { ...b.H.link, hostVersion: null }
    await b.openTone()
    /* As his log: two ways, every answer with no byte in it, the slot empty after each. */
    b.button('Preview').props.onPress()
    await b.wait(10)
    await b.draw()
    assert.deepEqual(b.sent(), [['fetch', 748130], ['empty'], ['install', 40], ['install', 40]])
    assert.deepEqual(b.cards(), [{ head: 'Not on your Axe-Fx III', line: NOT_KEPT_OLD }])
    assert.doesNotMatch(b.said(), /The app’s log has what the unit answered/)
    /* The log line stays as it was, and is still there. */
    assert.ok(b.logs().some((l) => /try 1, way 1 .*AN OLDER COMPUTER APP, WHICH PUTS THE NAME XORED IN.*Update the computer app, so that 0x60 goes/.test(l)))

    /* The same not kept through a computer that said which byte went: today's words. */
    const told = await bench()
    told.H.link = { ...told.H.link, hostVersion: null }
    await told.openTone()
    told.H.installs.push({ slot: 40, name: '<EMPTY>', seconds: 0.5, nameByte: 0x60 }, { slot: 40, name: '<EMPTY>', seconds: 0.5, nameByte: 0x60 })
    told.button('Preview').props.onPress()
    await told.wait(10)
    await told.draw()
    assert.deepEqual(told.cards(), [{ head: 'Not on your Axe-Fx III', line: NOT_KEPT_TODAY }])
  })

  test('captures through a computer: the words that name a button are true on every view the card is drawn on', async () => {
    /* The card is drawn on the Developer page, and through components/Tone3000Quick in the hold pop-up and in the capture picker's sheet: the same file, the same words. */
    assert.match(read('mobile/src/screens/Settings.js'), /<Tone3000Test \/>/)
    assert.match(read('mobile/src/components/Tone3000Quick.js'), /<Tone3000Test block=\{id\} held backTo=\{from\}/)
    assert.match(read('mobile/src/components/CapturePicker.js'), /Tone3000Quick/)
    const c = await lib()
    /* It names no button at all: "send it again" is what every one of those views has (Preview, Get, Send it again), and Bluetooth is a way to connect, not a button on them. */
    for (const s of [c.tooOldWords(PI, 'phone'), c.unkeptWords({ tries: 2, slotSaid: '041', computer: { name: 'raspberry pi 5', version: null } }, 'phone')]) {
      assert.doesNotMatch(s, /\bTap\b|\bPreview\b|\bGet\b|Browse TONE3000|Back to/)
    }
    for (const where of ['Developer', 'held', 'captures']) {
      const b = await bench()
      await b.openTone(where === 'Developer' ? {} : { block: 206, held: true, onDone: () => {}, backTo: where === 'held' ? 'knobs' : 'captures' })
      assert.equal(times(b.said(), TOO_OLD_PI), 1, `${where}: not said once`)
      b.button('Get').props.onPress()
      await b.draw()
      assert.deepEqual(b.sent(), [], `${where}: Get sent something`)
      assert.equal(times(b.said(), TOO_OLD_PI), 1, `${where}: said twice after a tap`)
    }
  })
}
