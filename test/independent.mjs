/**
 * WHOSE APP THIS IS NOT: WHAT FRACTAL AUDIO'S LETTER ASKED FOR, HELD.
 *
 * Fractal Audio wrote on 18 October 2026, about Approved Vendor status. They
 * asked for a clear statement at startup that the app "is independently
 * developed and is not affiliated with, endorsed by, or supported by Fractal
 * Audio Systems, LLC"; for no logos, official product photographs or other
 * proprietary artwork; for their products to be named in plain text only, to
 * say what the app works with; and for support through the developer's own
 * channels. And for a new name, which Justin declined: "I wanna comply as much
 * as I can. I'm just not gonna change the app name unless Fractal pushes back
 * on it."
 *
 * Everything but the name was done in one change, and a change like that
 * drifts back one well-meant edit at a time: a footer copied from an old
 * page, a picture dropped into a mockup, a store line rewritten to sell. So
 * each part is held here. The words are compared with shared/affiliation.mjs,
 * never typed into this file a second time, except the sentence itself, once,
 * because the sentence is the thing Fractal asked for and the module must not
 * be able to drift away from it either.
 *
 * Most of this reads files as text, as the rest of the suite reads screens.
 * What can be run is run: the gear lookup, at both ends.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(root, p), 'utf8')
const flat = (s) => s.replace(/\s+/g, ' ')
/* Text as somebody reads it: comments, scripts, styles and tags out, the quote entities as characters, one space. */
const pageText = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&rsquo;/g, '’')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
const quotesFlat = (s) => s.replace(/[“”]/g, '"').replace(/\s+/g, ' ')
/* Code with its comments out: a comment explaining the old words is not a copy of them. */
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
const walk = (dir) =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const rel = (p) => p.slice(root.length).replaceAll('\\', '/')

/** The sentence, as Fractal Audio wrote it. */
const THEIR_SENTENCE = 'Fractal Remote is independently developed and is not affiliated with, endorsed by, or supported by Fractal Audio Systems, LLC.'

/**
 * Fractal Audio's own models, whose drawings were taken out: 34 wore a
 * FRACTAL AUDIO badge, and FAS Buttery's showed a Budda amp under the name of
 * a Fractal original. Their gear cards show words only; test/limits.mjs holds
 * the rest of the catalog to having a picture, with these 35 as the one gap.
 */
export const FRACTAL_ORIGINALS = [
  'big-hair', 'bit-crusher', 'brit-brown', 'buddah-duomaster', 'fas-6160', 'fas-bass', 'fas-boost', 'fas-brootalz',
  'fas-brown', 'fas-class-a', 'fas-crunch', 'fas-express', 'fas-hot-rod', 'fas-lead-1', 'fas-lead-2', 'fas-led-drive',
  'fas-modern', 'fas-modern-ii', 'fas-modern-iii', 'fas-rhythm', 'fas-skull-crusher', 'fas-stealth-blue', 'fas-wreck', 'fas-buttery',
  'fet-boost', 'fet-preamp', 'hard-fuzz', 'mid-boost', 'shimmer-drive', 'supertweed', 'tape-distortion',
  'thordendal-modern', 'thordendal-vintage', 'treble-boost', 'tube-pre'
]

/** The three pictures that showed a Fractal unit, its logo, or both. */
const GONE_PICTURES = ['mobile/assets/welcome/fm3.jpg', 'mobile/assets/unit-fm3.png', 'mobile/assets/piece-unit.png']

/** Every file the app, the computer app and the website are made of. */
const shippedFiles = () =>
  [
    ...walk(join(root, 'src')),
    ...walk(join(root, 'mobile/src')),
    ...walk(join(root, 'shared')),
    ...walk(join(root, 'public')).filter((f) => !f.includes('/public/gear/')),
    join(root, 'mobile/App.js'),
    join(root, 'index.html'),
    join(root, 'desktop/main.js'),
    ...walk(join(root, 'desktop/lib'))
  ].filter((f) => /\.(m?js|jsx|cjs|html|css|json|txt)$/.test(f))

/**
 * The notes at the top of the phone's Play, as they are (UnlockOffer,
 * Vp4DemoNote, OnlyOnThisPhone, ColoursNotice, and lib/coach with the rule
 * for whose turn it is), their JSX turned into calls by esbuild and drawn
 * against stand-ins: a hook store for each note that keeps its state across
 * draws as a mounted component does, the phone's storage as a Map that
 * outlives a launch, and the demo and the purchase as the bench says.
 *
 * Each call is one launch: the files are written afresh, so the notes' own
 * memory of the launch (ColoursNotice's `launch`, lib/coach's) starts empty
 * and only the storage carries over. `play()` draws the four the way Stage
 * does, with Stage's props and lib/coach turnTaken, until nothing moves, and
 * returns what each drew; `press(tree, label)` presses a button in one.
 */
async function playNotesOnABench({ kept = new Map(), demo = { demo: true, unit: 'am4' }, buy = {}, look = { loaded: true, id: 'fractalremote' } } = {}) {
  const { transformSync } = await import('esbuild')
  const { COLOURS_NOTICE } = await import('../src/lib/colourPage.js')
  const dir = mkdtempSync(join(tmpdir(), 'play-notes-'))
  globalThis.__playNotes = { kept, demo, look, buy: { unlocked: false, onlyHere: false, stuck: false, held: null, price: '$9.99', ...buy } }
  const files = {
    'package.json': '{ "type": "module" }',
    'react.mjs': `
      export const h = (type, props, ...children) => ({ type, props: props || {}, children })
      export const Frag = 'frag'
      export const moved = { n: 0 }
      const stores = new Map()
      let cur = null
      export function begin(name) {
        if (!stores.has(name)) stores.set(name, { slots: [], deps: [], cleanups: [], effects: [] })
        cur = stores.get(name)
        cur.at = 0
        cur.effects = []
        return cur
      }
      export function unmount(name) {
        const s = stores.get(name)
        if (s) for (const c of s.cleanups) if (typeof c === 'function') c()
        stores.delete(name)
      }
      export function useState(initial) {
        const s = cur
        const i = s.at++
        if (!(i in s.slots)) s.slots[i] = initial
        return [s.slots[i], (v) => { const next = typeof v === 'function' ? v(s.slots[i]) : v; if (next !== s.slots[i]) { s.slots[i] = next; moved.n++ } }]
      }
      export function useEffect(fn, inputs) {
        const s = cur
        const i = s.at++
        const was = s.deps[i]
        if (!was || inputs.length !== was.length || inputs.some((x, k) => x !== was[k])) { s.deps[i] = inputs; s.effects.push([i, fn]) }
      }
      export function runEffects(s) {
        const ran = s.effects.length
        for (const [i, fn] of s.effects) { const c = s.cleanups[i]; if (typeof c === 'function') c(); s.cleanups[i] = fn() }
        s.effects = []
        return ran
      }
    `,
    'storage.mjs': `
      const kept = globalThis.__playNotes.kept
      export default {
        getItem: async (k) => (kept.has(k) ? kept.get(k) : null),
        setItem: async (k, v) => { kept.set(k, String(v)) }
      }
    `,
    'rn.mjs': "export const View = 'View'\nexport const Text = 'Text'\nexport const Pressable = 'Pressable'\n",
    'theme.mjs': 'const any = new Proxy({}, { get: () => 1 })\nexport const color = any\nexport const font = any\nexport const radius = any\nexport const space = any\n',
    'feedback.mjs': 'export const tick = () => {}\n',
    'purchases.mjs': `
      const buy = globalThis.__playNotes.buy
      export const shouldOffer = ({ demo }) => Boolean(demo) && !buy.unlocked
      export const usePurchase = () => ({ ...buy })
      export const NOT_ACROSS = 'NOT_ACROSS'
      export const NOT_ACROSS_SIGNED_OUT = 'NOT_ACROSS_SIGNED_OUT'
      export const ONLY_HERE = 'ONLY_HERE'
      export const restorePurchase = async () => ({ ok: true })
    `,
    'demo.mjs': 'const d = globalThis.__playNotes.demo\nexport const useDemo = () => d.demo\nexport const useDemoUnit = () => d.unit\n',
    'device-word.mjs': "export const deviceNoun = () => 'phone'\n",
    'colourPage.mjs': `export const COLOURS_NOTICE = ${JSON.stringify(COLOURS_NOTICE)}\n`,
    /* Which look is worn, and whether the phone's storage has said yet: `look`, which a test can change between draws. */
    'looks.mjs': "const l = globalThis.__playNotes.look\nexport const looksLoaded = () => l.loaded\nexport const isFractalRemoteLook = () => l.id === 'fractalremote'\n",
    'parts.mjs': 'export default function Part() { return null }\n',
    'demoUnits.js': read('mobile/src/lib/demoUnits.js'),
    'vp4-safety.js': read('mobile/src/lib/vp4-safety.js'),
    'swipe-hint.js': read('mobile/src/lib/swipe-hint.js')
  }
  const swaps = [
    ['from "react"', "from './react.mjs'"],
    ['from "react-native"', "from './rn.mjs'"],
    ['from "@react-native-async-storage/async-storage"', "from './storage.mjs'"],
    ['from "../lib/theme"', "from './theme.mjs'"],
    ['from "../lib/feedback"', "from './feedback.mjs'"],
    ['from "../lib/purchases"', "from './purchases.mjs'"],
    ['from "../lib/demo"', "from './demo.mjs'"],
    ['from "../lib/device-word"', "from './device-word.mjs'"],
    ['from "../lib/demoUnits"', "from './demoUnits.js'"],
    ['from "../lib/colourPage"', "from './colourPage.mjs'"],
    ['from "../lib/looks"', "from './looks.mjs'"],
    ['from "../lib/coach"', "from './coach.mjs'"],
    ['from "./Note"', "from './parts.mjs'"],
    ['from "./Press"', "from './parts.mjs'"],
    ['from "./swipe-hint"', "from './swipe-hint.js'"]
  ]
  const take = (from, as) => {
    let src = transformSync(read(from), { loader: 'jsx', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Frag', format: 'esm' }).code
    for (const [a, b] of swaps) src = src.replaceAll(a, b)
    const left = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((m) => !m.startsWith('./'))
    assert.deepEqual(left, [], `${from} imports something the bench has no stand-in for`)
    files[as] = (/\bh\(/.test(src) ? "import { h, Frag } from './react.mjs'\n" : '') + src
  }
  take('mobile/src/lib/coach.js', 'coach.mjs')
  take('mobile/src/components/UnlockOffer.js', 'UnlockOffer.mjs')
  take('mobile/src/components/Vp4DemoNote.js', 'Vp4DemoNote.mjs')
  take('mobile/src/components/OnlyOnThisPhone.js', 'OnlyOnThisPhone.mjs')
  take('mobile/src/components/ColoursNotice.js', 'ColoursNotice.mjs')
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  const at = (f) => pathToFileURL(join(dir, f)).href
  try {
    const react = await import(at('react.mjs'))
    const coach = await import(at('coach.mjs'))
    const notes = {
      offer: (await import(at('UnlockOffer.mjs'))).default,
      vp4: (await import(at('Vp4DemoNote.mjs'))).default,
      only: (await import(at('OnlyOnThisPhone.mjs'))).default,
      colours: (await import(at('ColoursNotice.mjs'))).default
    }
    /* Stage's `wants`, and its `says`: one function per note, made once. */
    let wants = { only: null, vp4: null, offer: null }
    const say = (which) => (up) => {
      if (wants[which] === up) return
      wants = { ...wants, [which]: up }
      react.moved.n++
    }
    const says = { only: say('only'), vp4: say('vp4'), offer: say('offer') }
    /* What else Stage waits for: the quick tip and the watch's sheet, up, or not yet answered by the phone's storage. */
    const after = { coach: false, watchTip: false, coachPending: false, watchPending: false }
    /* How many times the colours line opened Settings → Colors (App's openSettings('colours')). */
    const opened = { n: 0 }
    const draw = () => {
      const noteBefore = (which) => coach.turnTaken(wants, which)
      const notesUp = coach.turnTaken(wants)
      const drawn = {}
      const stores = []
      const one = (name, props) => {
        stores.push(react.begin(name))
        drawn[name] = notes[name](props)
      }
      one('offer', { onUnlock: () => {}, waiting: noteBefore('offer'), onWant: says.offer })
      one('vp4', { waiting: noteBefore('vp4'), onWant: says.vp4 })
      one('only', { onAccount: () => {}, onWant: says.only })
      one('colours', { waiting: notesUp || after.coach || after.watchTip, unanswered: after.coachPending || after.watchPending, onOpen: () => opened.n++ })
      return { drawn, stores }
    }
    const play = async () => {
      for (let pass = 0; pass < 30; pass++) {
        const was = react.moved.n
        const { drawn, stores } = draw()
        let ran = 0
        for (const s of stores) ran += react.runEffects(s)
        await new Promise((r) => setTimeout(r, 0))
        if (!ran && react.moved.n === was) return Object.fromEntries(Object.entries(drawn).filter(([, v]) => v))
      }
      throw new Error('Play never settled')
    }
    /* The first frame, before any effect has run or the storage has answered; then put away unseen, so play() mounts afresh. */
    const firstDraw = () => {
      const shown = Object.fromEntries(Object.entries(draw().drawn).filter(([, v]) => v))
      for (const name of Object.keys(notes)) react.unmount(name)
      return shown
    }
    const find = (tree, test) => {
      if (!tree || typeof tree !== 'object') return null
      if (tree.props && test(tree.props)) return tree
      for (const c of [...(tree.children || []), tree.props?.children].flat(Infinity)) {
        const hit = find(c, test)
        if (hit) return hit
      }
      return null
    }
    /* A button by what it is called, or a Note's cross. */
    const press = (tree, label) => {
      const hit = label ? find(tree, (p) => p.accessibilityLabel === label) : find(tree, (p) => typeof p.onDismiss === 'function')
      assert.ok(hit, `nothing to press${label ? ` called ${label}` : ''}`)
      ;(label ? hit.props.onPress : hit.props.onDismiss)()
    }
    /* A Note's words, where they are a button of their own (Note's onPress). */
    const pressWords = (tree) => {
      const hit = find(tree, (p) => typeof p.onPress === 'function' && typeof p.onDismiss === 'function')
      assert.ok(hit, 'the note’s words cannot be pressed')
      hit.props.onPress()
    }
    return { play, firstDraw, press, pressWords, opened, after, kept, look, wants: () => wants, unmount: react.unmount, turnTaken: coach.turnTaken }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function run(test) {
  test('Fractal Audio’s sentence is the one in shared/affiliation.mjs, word for word, with where help comes from', async () => {
    const a = await import('../shared/affiliation.mjs')
    assert.equal(a.NOT_AFFILIATED, THEIR_SENTENCE, 'the disclaimer is not Fractal Audio’s sentence')
    assert.equal(
      a.TRADEMARKS,
      '“Fractal Audio”, “Axe-Fx”, “FM3”, “FM9”, “AM4” and “VP4” are trademarks of Fractal Audio Systems, LLC, used here only to say which hardware this app works with.'
    )
    assert.equal(a.AFFILIATION, `${THEIR_SENTENCE} ${a.TRADEMARKS}`)
    /* The welcome screen's line is the sentence now, not his shorter one. */
    assert.equal(a.WELCOME_NOTICE, THEIR_SENTENCE)
    assert.equal(a.NOT_AFFILIATED_SHORT, 'Not affiliated with, endorsed by, or supported by Fractal Audio Systems, LLC.')
    assert.equal(
      a.SUPPORT_LINE,
      'For help with this app, use Settings → Troubleshooting → Feedback or visit fractal.newbold.cloud/support.html. Fractal Audio does not provide support for this app.'
    )
    assert.equal(a.SUPPORT_URL, 'https://fractal.newbold.cloud/support.html')
    assert.equal(a.STARTUP_NOTICE_TITLE, 'An independent app')
    for (const [name, words] of Object.entries(a)) {
      assert.ok(!/this phone/i.test(words), `${name} says “this phone”, and the app runs on iPads, tablets and computers too`)
      assert.ok(!/sponsored by|Systems, Inc\b/.test(words), `${name} says “sponsored by” or “Inc.”, which Fractal Audio did not write`)
    }

    /* The phone's copy is the generated one, and says the same. */
    const phone = await import('../mobile/src/lib/affiliation.js')
    for (const [name, words] of Object.entries(a)) assert.equal(phone[name], words, `the phone’s ${name} is not the shared one; run npm run sync:rules`)

    /*
     * And the path the support line names is the real one, at both ends:
     * Feedback is a row under Troubleshooting, on the phone and in the
     * browser and the computer app alike.
     */
    const settings = read('mobile/src/screens/Settings.js')
    const trouble = settings.slice(settings.indexOf("page === 'trouble' ? ("))
    assert.match(settings, /title="Troubleshooting"[\s\S]{0,120}onPress=\{\(\) => setPage\('trouble'\)\}/, 'the phone’s Settings has no Troubleshooting row')
    assert.match(trouble.slice(0, 3000), /title="Feedback"/, 'the phone’s Feedback is not under Troubleshooting')
    const app = read('src/App.jsx')
    assert.match(app, /title="Troubleshooting"[\s\S]{0,200}onClick=\{\(\) => setSetupPage\('help'\)\}/, 'the browser’s Settings has no Troubleshooting row')
    assert.match(app, /help: 'Troubleshooting'/)
    assert.match(app.slice(app.indexOf("setupPage === 'help' ? (")), /<Section key="feedback" title="Feedback"/, 'the browser’s Feedback is not under Troubleshooting')
  })

  test('every copy that cannot import the sentence carries it, and none says “Inc.” or “sponsored by”', async () => {
    const { NOT_AFFILIATED, TRADEMARKS, AFFILIATION, NOT_AFFILIATED_SHORT } = await import('../shared/affiliation.mjs')

    /* Every page on the website, the footer of each: the two that had none (downloads, Android) included. */
    const pages = readdirSync(join(root, 'public')).filter((f) => f.endsWith('.html'))
    for (const want of ['android.html', 'bluetooth-guide.html', 'bluetooth.html', 'downloads.html', 'privacy.html', 'raspberry-pi.html', 'support.html']) {
      assert.ok(pages.includes(want), `public/${want} is gone; this test follows it`)
    }
    for (const page of pages) {
      const html = read(`public/${page}`)
      const at = html.indexOf('<footer>')
      assert.ok(at > 0, `public/${page} has no footer`)
      const foot = pageText(html.slice(at, html.indexOf('</footer>', at)))
      assert.ok(foot.includes(quotesFlat(NOT_AFFILIATED)), `public/${page}’s footer does not say Fractal Audio’s sentence`)
      assert.ok(foot.includes(quotesFlat(TRADEMARKS)), `public/${page}’s footer does not say whose the unit names are`)
    }

    /* The README on GitHub, near the top: in its first three paragraphs. */
    const readme = read('README.md')
    assert.ok(flat(readme.split(/\n\s*\n/).slice(0, 3).join(' ')).includes(NOT_AFFILIATED), 'the README does not say it near the top')

    /* The notices, both copies, and the modifications page the licences link. */
    for (const f of ['NOTICES.md', 'public/notices.txt']) {
      const text = read(f)
      assert.ok(text.includes(NOT_AFFILIATED) && text.includes(TRADEMARKS), `${f} does not carry the sentence; run npm run notices`)
    }
    assert.ok(flat(read('licences/MODIFICATIONS.md').replace(/\*\*/g, '')).includes(NOT_AFFILIATED), 'licences/MODIFICATIONS.md does not carry the sentence')

    /* The store listing, both stores: second paragraph, straight after the computer. */
    const { fenced, promoText } = await import('../scripts/store-text.mjs')
    const store = read('docs/app-store.md')
    const description = fenced(store, '### Description')
    const paragraphs = description.trim().split('\n\n')
    assert.match(paragraphs[0], /^REQUIRES A COMPUTER\./)
    assert.equal(paragraphs[1], AFFILIATION, 'the Description’s second paragraph is not the shared disclaimer')
    assert.equal(description.split(AFFILIATION).length, 2, 'the Description says the disclaimer twice')
    assert.ok(promoText(store).includes(NOT_AFFILIATED_SHORT), 'the App Store promotional text does not say it')
    assert.match(promoText(store), new RegExp(`^By computer or by Bluetooth\\. ${NOT_AFFILIATED_SHORT.replace(/[.,]/g, '\\$&')} VP4:`), 'the promotional text does not put the two ways first and the disclaimer second')

    /* The computer app's tray, which cannot import shared/. */
    const main = read('desktop/main.js')
    assert.ok(main.includes(`const NOT_AFFILIATED_SHORT = '${NOT_AFFILIATED_SHORT}'`), 'the tray’s line is not the shared short form')

    /*
     * NEVER "Inc." AND NEVER "sponsored by", anywhere the app, the computer
     * app, the website or the store text is made from. Fractal is an LLC and
     * asked for "supported by". The one exception is the codec's own NOTICE,
     * which Apache-2.0 section 4(d) makes us carry as its author wrote it: its
     * lines are taken out of the notices files before they are read.
     */
    const upstream = new Set(
      read('licences/forgefx-midi-NOTICE.txt')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    )
    assert.ok([...upstream].some((l) => /Fractal Audio Systems, Inc\./.test(l)), 'the upstream NOTICE no longer says Inc.; this exception can go')
    const withoutUpstream = (text) =>
      text
        .split(/\r?\n/)
        .filter((l) => !upstream.has(l.trim()))
        .join('\n')
    const texts = [
      ...shippedFiles().map((f) => [rel(f), /\.(m?js|jsx|cjs)$/.test(f) ? code(readFileSync(f, 'utf8')) : readFileSync(f, 'utf8')]),
      ...['README.md', 'docs/app-store.md', 'licences/MODIFICATIONS.md', 'NOTICES.md'].map((f) => [f, read(f)])
    ]
    for (const [f, text] of texts) {
      const t = /notices/i.test(f) ? withoutUpstream(text) : text
      assert.ok(!/Fractal Audio Systems,? Inc\b/.test(t), `${f} calls Fractal Audio “Inc.”; it is Fractal Audio Systems, LLC`)
      assert.ok(!/sponsored by/i.test(/\.html$/.test(f) ? pageText(t) : t), `${f} says “sponsored by” where Fractal Audio asked for “supported by”`)
    }
  })

  test('nothing calls the app official, certified, approved or endorsed', async () => {
    /*
     * The letter: Approved Vendor status, if it comes, "does not constitute
     * certification or endorsement". So nothing the app, the website or the
     * listing says may read as either, and the disclaimer's own "endorsed
     * by" is the one use of the word, taken out before reading.
     */
    const words = /\b(official|certified|approved|endorsed|authori[sz]ed)\b/i
    const disclaimer = /not affiliated with, endorsed by, or\s+supported by/gi

    /* The app's own words, all of them: strings in the code, comments out. */
    for (const f of shippedFiles().filter((p) => /\.(m?js|jsx|cjs)$/.test(p) && !/affiliation\.m?js$/.test(p))) {
      const m = code(readFileSync(f, 'utf8')).replace(disclaimer, '').match(words)
      assert.ok(!m, `${rel(f)} says “${m?.[0]}” on a screen`)
    }

    /* The store listing, every block a customer reads. */
    const { fenced, promoText } = await import('../scripts/store-text.mjs')
    const store = read('docs/app-store.md')
    const subtitle = store.match(/\| \*\*Subtitle\*\* \| 30 \| `([^`]+)` \|/)?.[1]
    for (const [where, text] of [
      ['promotional text', promoText(store)],
      ['Description', fenced(store, '### Description')],
      ['Play summary', fenced(store, '### Google Play: short description')],
      ['keywords', fenced(store, '### Keywords (100, commas, no spaces after them)')],
      ['subtitle', subtitle]
    ]) {
      const m = String(text).replace(disclaimer, '').match(words)
      assert.ok(!m, `the ${where} says “${m?.[0]}”`)
    }

    /* The website: no sentence that names Fractal or a unit also calls anything official. Raspberry Pi's official power supply is Raspberry Pi's. */
    for (const page of readdirSync(join(root, 'public')).filter((f) => f.endsWith('.html'))) {
      for (const sentence of pageText(read(`public/${page}`)).replace(disclaimer, '').split(/(?<=[.!?])\s+/)) {
        if (!/Fractal|Axe-Fx|\bFM3\b|\bFM9\b|\bAM4\b|\bVP4\b/.test(sentence)) continue
        assert.ok(!words.test(sentence), `public/${page}: “${sentence}”`)
      }
    }

    /* And the letter is never called written permission for the app: it says plain-text names are fine, and it does not approve the name. */
    for (const f of ['docs/app-store.md', 'README.md', 'CLAUDE.md']) {
      const t = flat(read(f)).replace(/Never call it written permission for the app/g, '').replace(/never "written permission" for the app/g, '')
      assert.ok(!/written permission/i.test(t), `${f} calls Fractal’s letter written permission`)
    }
  })

  test('the startup card: once on every device, under its own key, before anything else, at both ends', async () => {
    /* THE PHONE. The card, from the shared words, and OK. */
    const card = read('mobile/src/components/IndependentNotice.js')
    assert.match(card, /import \{ NOT_AFFILIATED, STARTUP_NOTICE_TITLE, SUPPORT_LINE \} from '\.\.\/lib\/affiliation'/)
    for (const piece of ['{STARTUP_NOTICE_TITLE}', '{NOT_AFFILIATED}', '{HELP_LINE}', 'label="OK"']) {
      assert.ok(card.includes(piece), `the phone’s card has lost ${piece}`)
    }
    /*
     * The help line is the shared one with one unseen place to break, after
     * the address's slash: on a 320-wide phone the address cut mid-word at
     * "support.ht" / "ml." without it. Run here as the card runs it.
     */
    const { SUPPORT_LINE } = await import('../shared/affiliation.mjs')
    const made = card.match(/const HELP_LINE = SUPPORT_LINE\.replace\('([^']+)', '([^']+)'\)/)
    assert.ok(made, 'the phone’s help line is not made from the shared one')
    const helpLine = SUPPORT_LINE.replace(made[1], JSON.parse(`"${made[2]}"`))
    assert.notEqual(helpLine, SUPPORT_LINE, 'the address has nowhere to break; the shared line no longer has what the card looks for')
    assert.equal(helpLine.replace(/\u200B/g, ''), SUPPORT_LINE, 'the phone’s help line says something besides the shared one')
    assert.ok(helpLine.includes('fractal.newbold.cloud/\u200Bsupport.html'))
    /* Its own key, not the walkthrough's, so every phone that had the app sees it once. */
    assert.match(card, /const KEY = 'fractal\.independent\.v1'/)
    assert.doesNotMatch(read('mobile/src/lib/walkthrough.js'), /fractal\.independent/, 'the card shares the walkthrough’s key, so nobody who had the app sees it')
    /* Storage that will not answer shows it: the failure that matters is the device that never saw it. */
    assert.match(card, /export async function independentNoticeSeen\(\) \{\s+try \{\s+return \(await AsyncStorage\.getItem\(KEY\)\) === 'done'\s+\} catch \{[\s\S]{0,80}return false/, 'a phone whose storage fails never sees the card')

    /* In the launch gate, after the spinner and before the walkthrough, the sign-in and Play: in place of them, never over them. */
    const app = read('mobile/App.js')
    const spinner = app.indexOf("{auth === 'checking' || seenWalk === null ? (")
    const gate = app.indexOf(') : independentDue ? (')
    const walk = app.indexOf(') : seenWalk === false ? (')
    const signIn = app.indexOf(") : auth === 'out' ? (")
    assert.ok(spinner > 0 && spinner < gate && gate < walk && walk < signIn, 'the card is not between the spinner and the walkthrough in the launch gate')
    assert.match(app.slice(gate, walk), /<IndependentNotice\s+onDone=\{\(\) => \{\s+markIndependentNotice\(\)\s+setIndependentDue\(false\)/, 'OK does not remember the card')
    assert.equal(app.split('<IndependentNotice').length, 2, 'the card is drawn somewhere besides the launch gate')
    /* Decided with the walkthrough's answer, in one moment, so nothing is drawn on a guess. */
    assert.match(app, /Promise\.all\(\[walkthroughSeen\(\), independentNoticeSeen\(\)\]\)\.then\(\(\[seen, noticed\]\) => \{[\s\S]{0,300}setIndependentDue\(!noticed\)\s+setSeenWalk\(seen\)/)
    /* The demo is no exception: nothing about the demo stands between the gate and the card. */
    assert.ok(!/demo/.test(app.slice(spinner, gate).replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '')), 'the demo skips the card')

    /* THE BROWSER, and the computer app's window, which is the same page. */
    const web = read('src/components/IndependentNotice.jsx')
    assert.match(web, /import \{ NOT_AFFILIATED, STARTUP_NOTICE_TITLE, SUPPORT_LINE \} from '\.\.\/\.\.\/shared\/affiliation\.mjs'/)
    for (const piece of ['{STARTUP_NOTICE_TITLE}', '{NOT_AFFILIATED}', '{SUPPORT_LINE}', '>\n          OK\n        </button>']) {
      assert.ok(web.includes(piece), `the browser’s card has lost ${JSON.stringify(piece)}`)
    }
    assert.match(web, /const KEY = 'fractal\.independent\.v1'/)
    assert.match(web, /localStorage\.getItem\(KEY\) === 'done'\s+\} catch \{[\s\S]{0,400}return false/, 'a browser with no storage never sees the card')
    assert.match(web, /role="dialog" aria-modal="true"/)
    const page = read('src/App.jsx')
    /* A named condition, decided in the first render; never the walkthrough's own conditional written above it (test/structure.mjs reads App.jsx as text). */
    assert.match(page, /const \[independentDue, setIndependentDue\] = useState\(\(\) => !independentNoticeSeen\(\)\)/)
    const drawn = page.indexOf('{independentDue ? (')
    assert.ok(drawn > page.indexOf('<PhoneWalkthrough') && drawn > page.indexOf('<Onboarding\n'), 'the card is not drawn after (over) the walkthrough')
    assert.ok(page.indexOf('open={walkthrough &&') === page.indexOf('<PhoneWalkthrough') + '<PhoneWalkthrough\n        '.length, 'the walkthrough’s conditional is written somewhere above its own screen')
    assert.match(page.slice(drawn), /^\{independentDue \? \(\s+<IndependentNotice\s+onDone=\{\(\) => \{\s+markIndependentNotice\(\)\s+setIndependentDue\(false\)/)
    /* Over everything: the walkthrough and every sheet, opaque. */
    const css = read('src/styles.css')
    const z = (name) => Number(css.match(new RegExp(`--z-${name}: (\\d+);`))?.[1])
    assert.ok(z('notice') > z('onb') && z('notice') > z('sheet') && z('notice') > z('over-sheet'), 'the card is not over the walkthrough and the sheets')
    const rule = css.slice(css.indexOf('\n.independent {'), css.indexOf('}', css.indexOf('\n.independent {')))
    assert.match(rule, /position: fixed;\s+inset: 0;\s+z-index: var\(--z-notice\);/)
    assert.match(rule, /background: var\(--chassis\);/, 'the card lets the app show through')
  })

  /*
   * THE STARTUP MESSAGES TAKE TURNS. On a first launch after the update that
   * brought the startup card and the colours, a player could meet the card,
   * the demo card, the quick tip and the colours line ("Colours now match
   * your unit" then, "Match your unit’s colors in Settings" since 19 October
   * 2026) — and on a 320 by 568 phone the colours line stood under the demo
   * card and pushed Tuner, Edit and Tap off the bottom of Play. So: the card
   * first and alone, then one note at a time, and the colours line last, at
   * both ends.
   */
  test('the startup messages take turns on the phone: the card alone, then one note at a time, the colours line last', async () => {
    /* The card is drawn by the launch gate in place of the walkthrough and Play (the test above), so nothing on Play is ever up beside it. */
    const app = read('mobile/App.js')
    assert.ok(app.indexOf(') : independentDue ? (') < app.indexOf(') : seenWalk === false ? (') && app.indexOf(') : seenWalk === false ? (') < app.indexOf('<Stage'), 'Play can be drawn beside the startup card or the walkthrough')

    /* Stage: the notes at the top in their turns, the quick tip and the watch's sheet after them, the colours line last. */
    const stage = read('mobile/src/screens/Stage.js')
    const coach = read('mobile/src/lib/coach.js')
    assert.match(coach, /export const NOTE_TURNS = Object\.freeze\(\['only', 'vp4', 'offer'\]\)/, 'the order the notes take their turns in moved; say why here')
    assert.match(stage, /const \[wants, setWants\] = useState\(\{ only: null, vp4: null, offer: null \}\)/, 'Play starts out sure of a note it has not heard from')
    assert.match(stage, /const noteBefore = \(which\) => turnTaken\(wants, which\)\n\s+const notesUp = turnTaken\(wants\)/)
    assert.match(stage, /<UnlockOffer onUnlock=\{onUnlock\} waiting=\{noteBefore\('offer'\)\} onWant=\{says\.offer\} \/>/)
    assert.match(stage, /<Vp4DemoNote waiting=\{noteBefore\('vp4'\)\} onWant=\{says\.vp4\} \/>/)
    assert.match(stage, /<OnlyOnThisPhone onAccount=\{onAccount\} onWant=\{says\.only\} \/>/)
    assert.match(stage, /<ColoursNotice waiting=\{notesUp \|\| coach \|\| watchTip\} unanswered=\{coachPending \|\| watchPending\} onOpen=\{onOpenColours\} \/>/, 'the colours line does not wait for every other note, or for one that has not answered yet')
    /* The quick tip's and the watch's "not answered yet" (found in review: the line was remembered as said, then the tip came up over it before it was drawn). */
    assert.match(stage, /const \[coachHeard, setCoachHeard\] = useState\(false\)\n\s+const coachPending = holdDoesSomething && !coachHeard\n/, 'the quick tip has no unanswered moment for the colours line to wait out')
    assert.match(stage, /coachSeen\(\)\.then\(\(seen\) => \{\s+if \(!live\) return\s+if \(!seen\) setCoach\(true\)\s+setCoachHeard\(true\)/, 'the quick tip is heard from before it is up')
    assert.match(stage, /const paired = watchPaired\(\)\n\s+const watchPending = paired && !watchHeard\n/, 'the watch’s sheet has no unanswered moment for the colours line to wait out')
    assert.match(stage, /watchTipSeen\(\)\.then\(\(seen\) => \{\s+if \(!live\) return\s+if \(!seen\) \{\s+markWatchTip\(\)\s+setWatchTip\(true\)\s+\}\s+setWatchHeard\(true\)/)
    assert.match(stage, /<Coach open=\{coach && !notesUp\} /, 'the quick tip is drawn beside a note at the top')
    assert.match(stage, /if \(!holdDoesSomething\) return undefined\s+\/\*[^*]*\*\/\s+if \(notesUp\) return undefined[\s\S]{0,200}\}, \[holdDoesSomething, notesUp\]\)/, 'the quick tip comes up before its turn')
    assert.match(stage, /if \(coach \|\| coachPending \|\| notesUp \|\| !paired\) return undefined[\s\S]{0,300}\}, \[coach, coachPending, notesUp, paired\]\)/, 'the watch’s sheet is remembered as shown before its turn, or never asked again once a watch is paired')
    assert.match(stage, /<Sheet open=\{watchTip && !coach && !notesUp\} /)

    /* The rule itself: only a plain no from every note before is a go-ahead. */
    const { turnTaken } = await playNotesOnABench()
    assert.equal(turnTaken({ only: false, vp4: false, offer: false }), false)
    assert.equal(turnTaken({ only: false, vp4: null, offer: false }), true, 'a note that has not answered yet is passed over')
    assert.equal(turnTaken({ only: true, vp4: false, offer: false }, 'vp4'), true)
    assert.equal(turnTaken({ only: false, vp4: false, offer: true }, 'offer'), false, 'the demo card waits for itself')
    assert.equal(turnTaken({ only: null, vp4: null, offer: null }, 'only'), false, 'the first note waits for something')
    assert.equal(turnTaken({}, 'vp4'), true)

    /*
     * A RETURNING DEMO PLAYER, the first launch after the update: the demo
     * card never put away, the colours line not yet said.
     */
    const kept = new Map([['fractal.walkthrough.v1', 'done']])
    let p = await playNotesOnABench({ kept })
    assert.deepEqual(Object.keys(p.firstDraw()), [], 'a note was drawn before the phone’s storage had answered')
    let drawn = await p.play()
    assert.deepEqual(Object.keys(drawn), ['offer'], 'the demo card is not alone at the top of Play')
    assert.equal(kept.get('fractal.coloursOffer.v1'), undefined, 'the colours line was remembered as said while it waited')
    p.press(drawn.offer, 'Put this away')
    drawn = await p.play()
    assert.deepEqual(Object.keys(drawn), ['colours'], 'the colours line does not come once the demo card is put away')
    assert.equal(kept.get('fractal.coloursOffer.v1'), 'done', 'the colours line is not remembered the moment it is shown')
    /* A note that comes up after it (the quick tip, on the first preset whose blocks have channels): it steps aside, and is back after. */
    p.after.coach = true
    assert.deepEqual(Object.keys(await p.play()), [], 'the colours line stayed up beside the quick tip')
    p.after.coach = false
    assert.deepEqual(Object.keys(await p.play()), ['colours'], 'the colours line did not come back after the quick tip')
    /* Play drawn afresh in the same launch (back from Settings): still there, until its cross. */
    p.unmount('colours')
    drawn = await p.play()
    assert.deepEqual(Object.keys(drawn), ['colours'], 'the colours line went with a trip to Settings')
    p.press(drawn.colours)
    assert.deepEqual(Object.keys(await p.play()), [])
    p.unmount('colours')
    assert.deepEqual(Object.keys(await p.play()), [], 'the colours line came back after its cross')
    /* The next launch: nothing. */
    p = await playNotesOnABench({ kept })
    assert.deepEqual(Object.keys(await p.play()), [], 'a note came back on the next launch')

    /*
     * FOUND IN REVIEW, on the demo AM4: the demo card put away while the
     * quick tip's storage had not answered yet. The line answered first, was
     * remembered as said, and the tip took the turn before it was drawn; a
     * Try it with no hold after it, or the app closed under the tip, and it
     * was never seen and never came back.
     */
    const race = new Map([['fractal.walkthrough.v1', 'done']])
    p = await playNotesOnABench({ kept: race })
    drawn = await p.play()
    assert.deepEqual(Object.keys(drawn), ['offer'])
    p.after.coachPending = true
    p.press(drawn.offer, 'Put this away')
    assert.deepEqual(Object.keys(await p.play()), [], 'the colours line was drawn while the quick tip might still take the turn')
    assert.equal(race.get('fractal.coloursOffer.v1'), undefined, 'the colours line was remembered as said while the quick tip had not answered')
    /* The tip is owed and comes up; Try it, no hold; the app is closed under it. */
    p.after.coachPending = false
    p.after.coach = true
    assert.deepEqual(Object.keys(await p.play()), [])
    assert.equal(race.get('fractal.coloursOffer.v1'), undefined, 'the colours line was remembered as said under the quick tip')
    /* The next launch, the tip seen: the line, and only now remembered. */
    p = await playNotesOnABench({ kept: race })
    drawn = await p.play()
    assert.deepEqual(Object.keys(drawn), ['colours'], 'the colours line never came, after a launch where the quick tip took its turn')
    assert.equal(race.get('fractal.coloursOffer.v1'), 'done')
    /* Said, and then a question opens before it (the first preset with channels, read late): it stays where it is rather than going and coming back. */
    p.after.coachPending = true
    assert.deepEqual(Object.keys(await p.play()), ['colours'], 'the colours line went away for a question, not a note')
    p.after.coachPending = false

    /* The watch's sheet the same: asked after the tip, and the line waits for its answer. */
    const watched = new Map([['fractal.walkthrough.v1', 'done']])
    p = await playNotesOnABench({ kept: watched, demo: { demo: false, unit: 'fm3' } })
    p.after.watchPending = true
    assert.deepEqual(Object.keys(await p.play()), [], 'the colours line was drawn while the watch’s sheet might still take the turn')
    assert.equal(watched.get('fractal.coloursOffer.v1'), undefined)
    p.after.watchPending = false
    assert.deepEqual(Object.keys(await p.play()), ['colours'], 'the colours line did not come once the watch’s sheet answered that it is seen')

    /* THE DEMO VP4: its sentence first, then the demo card, then the colours line. */
    const vp4 = new Map([['fractal.walkthrough.v1', 'done']])
    p = await playNotesOnABench({ kept: vp4, demo: { demo: true, unit: 'vp4' } })
    drawn = await p.play()
    assert.deepEqual(Object.keys(drawn), ['vp4'], 'the demo VP4’s sentence is not alone at the top of Play')
    p.press(drawn.vp4)
    drawn = await p.play()
    assert.deepEqual(Object.keys(drawn), ['offer'])
    p.press(drawn.offer, 'Put this away')
    assert.deepEqual(Object.keys(await p.play()), ['colours'])
    assert.equal(vp4.get('fractal.demo.note.vp4'), 'seen')

    /* BOUGHT ON THIS PHONE with no account yet: that line first, the colours line after it is put away. */
    const bought = new Map([['fractal.walkthrough.v1', 'done']])
    p = await playNotesOnABench({ kept: bought, demo: { demo: true, unit: 'fm3' }, buy: { unlocked: true, onlyHere: true } })
    drawn = await p.play()
    assert.deepEqual(Object.keys(drawn), ['only'], 'the line about a purchase on this phone is not alone at the top of Play')
    assert.equal(bought.get('fractal.coloursOffer.v1'), undefined)
    p.press(drawn.only)
    assert.deepEqual(Object.keys(await p.play()), ['colours'])

    /* NOT THE DEMO, nothing else owed: the colours line at once, alone. */
    const plain = new Map([['fractal.walkthrough.v1', 'done']])
    p = await playNotesOnABench({ kept: plain, demo: { demo: false, unit: 'fm3' } })
    assert.deepEqual(Object.keys(await p.play()), ['colours'])

    /*
     * SINCE 19 OCTOBER 2026 the line says where Match my unit is: "Can we
     * change it so the fractal remote colors scene is the default? But then
     * the first time the app loads, also let people know that they can change
     * the theme to match their actual unit in settings?"
     */
    /* Somebody who heard the old line, whose words are no longer true, hears this one: a new key. */
    const heardOld = new Map([['fractal.walkthrough.v1', 'done'], ['fractal.coloursNoticed', 'done']])
    p = await playNotesOnABench({ kept: heardOld, demo: { demo: false, unit: 'fm3' } })
    assert.deepEqual(Object.keys(await p.play()), ['colours'], 'somebody who heard “Colours now match your unit” is never told where Match my unit is')
    /* A first run too, on Play after the walkthrough (App draws the walkthrough in place of Play, so nothing is under it). */
    const firstRun = new Map()
    p = await playNotesOnABench({ kept: firstRun, demo: { demo: false, unit: 'fm3' } })
    drawn = await p.play()
    assert.deepEqual(Object.keys(drawn), ['colours'], 'a first run is not told where Match my unit is')
    assert.equal(firstRun.get('fractal.coloursOffer.v1'), 'done')
    /* Pressed: Settings → Colors, once, and the line is put away for this launch and the next. */
    p.pressWords(drawn.colours)
    assert.equal(p.opened.n, 1, 'pressing the line did not open Settings → Colors')
    assert.deepEqual(Object.keys(await p.play()), [], 'the line stayed up after it was pressed')
    p.unmount('colours')
    assert.deepEqual(Object.keys(await p.play()), [], 'the line came back on Play after Settings → Colors')
    p = await playNotesOnABench({ kept: firstRun, demo: { demo: false, unit: 'fm3' } })
    assert.deepEqual(Object.keys(await p.play()), [], 'the line came back on the next launch')

    /* SOMEBODY WHO CHOSE ANOTHER LOOK has found the page already: never said, and put away for good at its turn. */
    const chose = new Map([['fractal.walkthrough.v1', 'done']])
    p = await playNotesOnABench({ kept: chose, demo: { demo: false, unit: 'fm3' }, look: { loaded: true, id: 'unit' } })
    assert.deepEqual(Object.keys(await p.play()), [], 'somebody in Match my unit is told where Match my unit is')
    assert.equal(chose.get('fractal.coloursOffer.v1'), 'done', 'somebody in another look is asked again later')
    p.look.id = 'fractalremote'
    assert.deepEqual(Object.keys(await p.play()), [], 'back on Fractal Remote, somebody who had found the page is told about it')
    p = await playNotesOnABench({ kept: chose, demo: { demo: false, unit: 'fm3' } })
    assert.deepEqual(Object.keys(await p.play()), [])

    /* NOT BEFORE THE PHONE'S STORAGE HAS SAID WHICH LOOK: until then everybody reads as wearing the default. */
    const early = new Map([['fractal.walkthrough.v1', 'done']])
    const unknown = { loaded: false, id: 'fractalremote' }
    p = await playNotesOnABench({ kept: early, demo: { demo: false, unit: 'fm3' }, look: unknown })
    assert.deepEqual(Object.keys(await p.play()), [], 'the line was drawn before the look was known')
    assert.equal(early.get('fractal.coloursOffer.v1'), undefined, 'the line was remembered as said before the look was known')
    /* The colours land: Stompbox, chosen. Put away unsaid. */
    unknown.loaded = true
    unknown.id = 'stompbox'
    assert.deepEqual(Object.keys(await p.play()), [])
    assert.equal(early.get('fractal.coloursOffer.v1'), 'done')
    /* And the colours land on Fractal Remote: said. */
    const lateFr = new Map([['fractal.walkthrough.v1', 'done']])
    const later = { loaded: false, id: 'fractalremote' }
    p = await playNotesOnABench({ kept: lateFr, demo: { demo: false, unit: 'fm3' }, look: later })
    assert.deepEqual(Object.keys(await p.play()), [])
    later.loaded = true
    assert.deepEqual(Object.keys(await p.play()), ['colours'], 'the line never came once the look was known to be Fractal Remote')

    /* A look chosen while the line is up (from Settings, not from the line): gone, and it stays gone. */
    const switched = new Map([['fractal.walkthrough.v1', 'done']])
    p = await playNotesOnABench({ kept: switched, demo: { demo: false, unit: 'fm3' } })
    assert.deepEqual(Object.keys(await p.play()), ['colours'])
    p.look.id = 'sunlight'
    assert.deepEqual(Object.keys(await p.play()), [], 'the line stayed up in another look')
    p.look.id = 'fractalremote'
    assert.deepEqual(Object.keys(await p.play()), [], 'the line came back after a look was chosen and put back')
  })

  test('the startup messages take turns in the browser: the colours line waits for the startup card and the walkthrough as well', async () => {
    const page = read('src/App.jsx')
    /* A named condition (test/structure.mjs reads App.jsx as text): the card, then the walkthrough. */
    assert.match(page, /const startupOver = independentDue \|\| walkthrough\n/)
    assert.ok(page.indexOf('const startupOver') > page.indexOf('const [independentDue, setIndependentDue]'), 'startupOver is read before the card’s answer')
    assert.match(page, /noteAbove=\{startupOver \|\| signInOver \|\| \(!holdNoteSeen && holdOpensChannels\) \|\| \(isDemo\(\) && status === 'live' && !demoNoteSeen\)\}/, 'the colours line is said under the startup card, the walkthrough or the sign-in sheet')
    /*
     * Found in review, with a real browser at phone width: a returning demo
     * player through /join pressed OK, Create Account opened over Play, and
     * the line was said and remembered under the sheet. A sign-in from the
     * demo then reloads the page, so it was never seen at all. The sheet is
     * the same `signIn` that opens it, and the link's own answer counts too:
     * the line's effect runs before App's that opens the sheet, in the same
     * commit, so waiting on the sheet alone still said it under the sheet.
     */
    assert.match(page, /\}, \[independentDue\]\)\s+(?:\/\*[\s\S]*?\*\/\s+)?const signInOver = Boolean\(signIn\) \|\| Boolean\(joinOwed\.current\)\n/, 'the colours line is said in the moment the join link opens its sheet')
    assert.match(page, /<SignInSheet\s+open=\{Boolean\(signIn\)\}/, 'the colours line waits for something other than the sign-in sheet')
    /* And the hold tip still waits for the demo's line: one note at a time under the bar. */
    assert.match(page, /\{!holdNoteSeen && holdOpensChannels && !\(isDemo\(\) && status === 'live' && !demoNoteSeen\) \? \(/)

    /* The line itself, run: never said or remembered while it waits; out of the way of a note after it; back when that one goes. */
    const { transformSync } = await import('esbuild')
    const { COLOURS_NOTICE } = await import('../src/lib/colourPage.js')
    const dir = mkdtempSync(join(tmpdir(), 'web-colours-notice-'))
    const stored = new Map()
    globalThis.localStorage = { getItem: (k) => (stored.has(k) ? stored.get(k) : null), setItem: (k, v) => stored.set(k, String(v)) }
    try {
      let src = transformSync(read('src/components/ColoursNotice.jsx'), { loader: 'jsx', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Frag', format: 'esm' }).code
      src = src.replaceAll('from "react"', "from './react.mjs'").replaceAll('from "../lib/colourPage"', "from './colourPage.mjs'").replaceAll('from "../lib/looks"', "from './looks.mjs'")
      writeFileSync(join(dir, 'package.json'), '{ "type": "module" }')
      writeFileSync(join(dir, 'colourPage.mjs'), `export const COLOURS_NOTICE = ${JSON.stringify(COLOURS_NOTICE)}\n`)
      /* The look worn, which the test changes between draws (Gig repaints on a change of look). */
      globalThis.__webLook = { id: 'fractalremote' }
      writeFileSync(join(dir, 'looks.mjs'), "export const isFractalRemoteLook = () => globalThis.__webLook.id === 'fractalremote'\n")
      writeFileSync(
        join(dir, 'react.mjs'),
        `export const h = (type, props, ...children) => ({ type, props: props || {}, children })
        export const Frag = 'frag'
        let slots = [], deps = [], at = 0, effects = []
        export const mount = () => { slots = []; deps = []; at = 0; effects = [] }
        export const begin = () => { at = 0; effects = [] }
        export const ran = () => effects
        export function useState(initial) { const i = at++; if (!(i in slots)) slots[i] = initial; return [slots[i], (v) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }] }
        export function useEffect(fn, inputs) { const i = at++; const was = deps[i]; if (!was || inputs.some((x, k) => x !== was[k])) { deps[i] = inputs; effects.push(fn) } }\n`
      )
      writeFileSync(join(dir, 'ColoursNotice.mjs'), "import { h, Frag } from './react.mjs'\n" + src)
      const react = await import(pathToFileURL(join(dir, 'react.mjs')).href)
      let notice = await import(pathToFileURL(join(dir, 'ColoursNotice.mjs')).href)
      const draw = (props) => {
        for (let pass = 0; pass < 3; pass++) {
          react.begin()
          notice.default(props)
          for (const fn of react.ran()) fn()
        }
        react.begin()
        return notice.default(props)
      }
      /* Another visit to the page: the module afresh, with whatever the storage kept. */
      const visitAgain = async (name) => {
        notice = await import(`${pathToFileURL(join(dir, 'ColoursNotice.mjs')).href}?${name}`)
        react.mount()
      }
      react.mount()
      /* Under the startup card (noteAbove): nothing, and nothing kept. */
      assert.equal(draw({ waiting: true }), null, 'the colours line is drawn under the startup card')
      assert.equal(stored.get('fractal.coloursOffer.v1'), undefined, 'the colours line was remembered as said under the startup card')
      /* OK pressed, nothing else owed: said, and remembered. */
      let opened = 0
      const open = () => opened++
      const line = draw({ waiting: false, onOpen: open })
      assert.ok(line && JSON.stringify(line).includes('Match your unit’s colors in Settings'))
      assert.equal(stored.get('fractal.coloursOffer.v1'), 'done')
      /* The hold tip comes up after it: out of the way, and back when that is put away. */
      assert.equal(draw({ waiting: true, onOpen: open }), null, 'the colours line stayed up beside a note after it')
      const back = draw({ waiting: false, onOpen: open })
      assert.ok(back, 'the colours line did not come back')
      /* Two buttons: the words, which open Settings → Colors, and the cross. */
      const [words, cross] = back.children.filter((c) => c && c.type === 'button')
      assert.equal(words.props.className, 'colours-notice-open')
      assert.equal(cross.props['aria-label'], 'Dismiss')
      /* The cross puts it away, and opens nothing. */
      cross.props.onClick()
      assert.equal(opened, 0, 'the cross opened Settings')
      react.mount()
      assert.equal(draw({ waiting: false, onOpen: open }), null, 'the colours line came back after its cross')
      await visitAgain('next')
      assert.equal(draw({ waiting: false, onOpen: open }), null, 'the colours line came back on the next visit')

      /* A first visit, after the walkthrough: pressing the words opens Settings → Colors, and the line is put away. */
      stored.clear()
      await visitAgain('pressed')
      const fresh = draw({ waiting: false, onOpen: open })
      assert.ok(fresh, 'a first visit is not told where Match my unit is')
      fresh.children.find((c) => c && c.props?.className === 'colours-notice-open').props.onClick()
      assert.equal(opened, 1, 'pressing the line did not open Settings → Colors')
      react.mount()
      assert.equal(draw({ waiting: false, onOpen: open }), null, 'the colours line came back after it was pressed')

      /* Somebody who chose another look: never said, and put away for good at its turn. */
      stored.clear()
      globalThis.__webLook.id = 'unit'
      await visitAgain('elsewhere')
      assert.equal(draw({ waiting: true }), null)
      assert.equal(stored.get('fractal.coloursOffer.v1'), undefined, 'the line was put away before its turn')
      assert.equal(draw({ waiting: false }), null, 'somebody in Match my unit is told where Match my unit is')
      assert.equal(stored.get('fractal.coloursOffer.v1'), 'done', 'somebody in another look is asked again later')
      globalThis.__webLook.id = 'fractalremote'
      assert.equal(draw({ waiting: false }), null, 'back on Fractal Remote, somebody who had found the page is told about it')

      /* A look chosen while the line is up: gone, and it stays gone. */
      stored.clear()
      await visitAgain('switched')
      assert.ok(draw({ waiting: false }))
      globalThis.__webLook.id = 'sunlight'
      assert.equal(draw({ waiting: false }), null, 'the line stayed up in another look')
      globalThis.__webLook.id = 'fractalremote'
      assert.equal(draw({ waiting: false }), null, 'the line came back after a look was chosen and put back')
    } finally {
      delete globalThis.__webLook
      delete globalThis.localStorage
      rmSync(dir, { recursive: true, force: true })
    }
  })

  /*
   * ONE LINE AT 320 WIDE, AT BOTH ENDS. The line before it ("Colours now
   * match your unit · Settings → Colours") took two on a narrow phone, and
   * broke after "Settings" until no-break spaces held the path together. Its
   * successor is short enough not to break at all: measured in Inter at 13pt
   * (a little wider than the iPhone's own face), Roboto at 13 and Archivo at
   * 12px, it is about 215, 202 and 183 wide, where the phone's Note leaves
   * 235 beside its cross and the browser's row 206 beside its 44-wide one.
   * No fonts here to measure with, so its length is held instead.
   */
  test('the colours line is one short line, the same words at both ends', async () => {
    const { COLOURS_NOTICE } = await import('../src/lib/colourPage.js')
    assert.equal(COLOURS_NOTICE, 'Match your unit’s colors in Settings', 'the words of the colours line changed; measure them at 320 wide at both ends first')
    assert.ok(COLOURS_NOTICE.length <= 36, 'the colours line is too long for one line at 320 wide')
    assert.ok(!/colou?rs now match|this phone|colours/i.test(COLOURS_NOTICE), 'the line says the colours match, names the device, or is spelled the British way')
    /* The phone's copy is the generated one, and both ends draw the constant as it is. */
    assert.ok(read('mobile/src/lib/colourPage.js').includes("export const COLOURS_NOTICE = 'Match your unit’s colors in Settings'"))
    assert.match(read('mobile/src/components/ColoursNotice.js'), /\{COLOURS_NOTICE\}/)
    assert.match(read('src/components/ColoursNotice.jsx'), /className="colours-notice-open"[\s\S]{0,120}\{COLOURS_NOTICE\}/)
  })

  test('while the browser’s card is up, the keyboard reaches nothing behind it', async () => {
    /*
     * Found in review, with a real browser: from OK, Tab walked on into the
     * page under the card (Settings, NO DEVICE, and on Play the Next button),
     * and Enter pressed them where nobody could see, a preset change on a
     * real unit included. Covering the page stops a mouse; aria-modal stops a
     * screen reader; only inert stops Tab. So the card makes everything else
     * inert while it is up, and gives back exactly what it took when it goes.
     */
    const web = read('src/components/IndependentNotice.jsx')
    assert.match(web, /const own = useRef\(null\)\s+useNothingBehind\(own\)\s+return createPortal\(\s+<div ref=\{own\} className="independent"/, 'the card no longer shuts the page behind it, or is drawn inside the app again')
    assert.match(web, /<\/div>,\s+document\.body\s+\)\s+\}/, 'the card is not drawn into the body, beside the app')
    assert.match(web, /useEffect\(\(\) => \(own\.current \? nothingBehind\(own\.current\) : undefined\), \[own\]\)/, 'what the card shut is not given back when it goes')
    assert.match(web, /made\.set\(el, holdInert\(el\)\)/, 'the card shuts the page with a switch, which a sheet closing under it undoes')
    /*
     * Found in review, with a real browser at phone width: a first visit to
     * fractal.newbold.cloud/join opened Create Account in the same moment as
     * the card, the sheet made the app inert with the card inside it, and OK
     * did nothing. So a sheet shuts the app with a hold too, never a switch,
     * and keys a shut sheet hears are not its own.
     */
    const sheetCode = read('src/components/Sheet.jsx')
    assert.match(sheetCode, /const giveBack = holdInert\(root\)/, 'a sheet shuts the app with a switch again')
    assert.ok(!/root\.inert\s*=/.test(code(sheetCode)), 'a sheet sets the app inert by hand, and opens it under the card when it closes')
    assert.match(sheetCode, /const key = \(e\) => \{\s+(?:\/\*[\s\S]*?\*\/\s+)?if \(panel\.current\?\.closest\?\.\('\[inert\]'\)\) return\s+if \(e\.key === 'Escape'\)/, 'Escape on the card closes a sheet nobody can see under it')
    /* And the join link opens its form after OK, never under the card. */
    const page = read('src/App.jsx')
    assert.match(page, /if \(joinOwed\.current === null\) joinOwed\.current = arrivedToJoin\(\)\s+useEffect\(\(\) => \{\s+if \(!joinOwed\.current \|\| independentDue\) return\s+joinOwed\.current = false\s+window\.history\.replaceState\(null, '', '\/'\)\s+setSignInStart\('up'\)\s+setSignIn\('account'\)\s+\}, \[independentDue\]\)/, 'the join link opens Create Account under the startup card')

    /* And run: the card's own function and the holds, bundled as the page bundles them, on a page of stand-in elements. */
    const { build } = await import('esbuild')
    const out = await build({
      stdin: {
        contents: "export { nothingBehind } from './src/components/IndependentNotice.jsx'\nexport { holdInert } from './src/lib/inert.js'",
        resolveDir: root,
        loader: 'js'
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      jsx: 'automatic',
      logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"production"' }
    })
    const dir = mkdtempSync(join(tmpdir(), 'independent-'))
    const file = join(dir, 'card.cjs')
    writeFileSync(file, out.outputFiles[0].text)
    const watchers = new Set()
    class Element {
      constructor(name) {
        this.name = name
        this.nodeType = 1
        this.children = []
        this.parentElement = null
        this.inert = false
      }
      append(...kids) {
        for (const kid of kids) {
          kid.parentElement = this
          this.children.push(kid)
          for (const w of watchers) if (w.target === this) w.fn([{ addedNodes: [kid] }])
        }
        return this
      }
      contains(other) {
        for (let at = other; at; at = at.parentElement) if (at === this) return true
        return false
      }
    }
    const was = { MutationObserver: globalThis.MutationObserver, document: globalThis.document }
    globalThis.MutationObserver = class {
      constructor(fn) {
        this.fn = fn
      }
      observe(target) {
        this.target = target
        watchers.add(this)
      }
      disconnect() {
        watchers.delete(this)
      }
    }
    try {
      const { nothingBehind, holdInert } = createRequire(import.meta.url)(file)
      const el = (name) => new Element(name)
      /* Whether anything can reach it: inert is inherited, so it and everything it sits in. */
      const reachable = (e) => {
        for (let at = e; at; at = at.parentElement) if (at.inert) return false
        return true
      }
      /* The page as it is: the app (its shell holding the bar and Play) and, beside it in the body, the card, a sheet, and one thing inert already. */
      const body = el('body')
      const root = el('#root')
      const shell = el('.shell')
      const [bar, play, card, sheet, already] = ['bar', 'play', 'card', 'sheet', 'already'].map(el)
      already.inert = true
      body.append(root.append(shell.append(bar, play)), card, sheet, already)
      globalThis.document = { body }

      const giveBack = nothingBehind(card)
      assert.deepEqual([bar, play, sheet].map(reachable), [false, false, false], 'something beside the card can still be reached')
      assert.ok(reachable(card) && !body.inert, 'the card shut itself, or what holds it')
      /* What arrives while it is up: Play changing under it, a sheet opening by itself. */
      const later = el('settings sheet')
      const screen = el('connecting')
      body.append(later, { nodeType: 3, data: 'a text node' })
      shell.append(screen)
      assert.ok(!reachable(later) && !reachable(screen), 'something that arrived while the card was up can be reached')
      /* A sheet that opens by itself and closes again while the card is up: OK stays OK, and the app stays shut behind the card. */
      const sheetGoes = holdInert(root)
      assert.ok(reachable(card), 'a sheet opening under the card shut the card')
      sheetGoes()
      assert.ok(!reachable(bar), 'a sheet closing under the card opened the app behind it')

      giveBack()
      assert.deepEqual([bar, play, sheet, later, screen].map(reachable), [true, true, true, true, true], 'OK left part of the page dead')
      assert.equal(already.inert, true, 'OK woke something the card never shut')
      assert.equal(watchers.size, 0, 'the card goes on watching the page after it has gone')

      /* The other way round: a sheet already open (the join link, the unlock page after a reload) when the card comes up. */
      const signUp = el('create account')
      body.append(signUp)
      const signUpGoes = holdInert(root)
      const card2 = el('card again')
      body.append(card2)
      const giveBack2 = nothingBehind(card2)
      assert.ok(reachable(card2), 'a sheet open under the card shut the card, and OK did nothing')
      assert.ok(!reachable(signUp) && !reachable(play), 'the sheet, or the app, can be reached past the card')
      giveBack2()
      assert.ok(reachable(signUp), 'OK left the sheet that was waiting under it dead')
      assert.ok(!reachable(play), 'OK opened the app behind a sheet that is still open')
      signUpGoes()
      assert.ok(reachable(play), 'the last sheet closed and the app stayed shut')
      /* A hold given back twice is given back once. */
      const one = holdInert(root)
      const two = holdInert(root)
      one()
      one()
      assert.ok(root.inert, 'a hold given back twice let go of somebody else’s')
      two()
      assert.equal(root.inert, false)
    } finally {
      for (const [k, v] of Object.entries(was)) {
        if (v === undefined) delete globalThis[k]
        else globalThis[k] = v
      }
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('Fractal Audio’s sentence on the startup screens, and readable on the first one', () => {
    const app = read('mobile/App.js')
    /* Under the phone's spinner. */
    const spinner = app.slice(app.indexOf("{auth === 'checking' || seenWalk === null ? ("), app.indexOf(') : independentDue ? ('))
    assert.match(spinner, /<ActivityIndicator color=\{color\.silkDim\} \/>[\s\S]*\{NOT_AFFILIATED\}/, 'the phone’s spinner does not say it')
    /* Under "Finding your computer…", at the foot of the screen. */
    const waking = app.slice(app.indexOf('function Waking('))
    assert.match(waking, /\{NOT_AFFILIATED\}\s+<\/Text>\s+<\/ScrollView>/, 'the phone’s Finding your computer does not say it at its foot')
    for (const where of [spinner, waking]) {
      assert.match(where, /color: color\.silkDim, fontSize: font\.small/, 'the startup line is not small and readable')
    }
    assert.match(app, /import \{ NOT_AFFILIATED \} from '\.\/src\/lib\/affiliation'/)
    /* Under the browser's "Finding your computer.". */
    const connect = read('src/components/ConnectScreen.jsx')
    assert.match(connect, /<p>Finding your computer\.<\/p>[\s\S]{0,700}<p className="connect-independent">\{NOT_AFFILIATED\}<\/p>/, 'the browser’s Finding your computer does not say it')

    /* The walkthrough's first screen: the sentence at the foot, no longer the faintest and smallest. */
    const onboarding = read('mobile/src/screens/Onboarding.js')
    assert.match(onboarding, /<Text style=\{\{ color: color\.silkDim, fontSize: font\.small[^}]*\}\}>\s+\{WELCOME_NOTICE\}/, 'the phone’s first screen whispers the disclaimer again')
    const css = read('src/styles.css')
    const notice = css.slice(css.indexOf('.pw-welcome-notice {'), css.indexOf('}', css.indexOf('.pw-welcome-notice {')))
    assert.match(notice, /color: var\(--silk-dim\);/)
    assert.match(notice, /font-size: var\(--f-3\);/)
  })

  test('About says where help comes from and opens the support page, at both ends', () => {
    const phone = read('mobile/src/screens/Settings.js')
    const aboutPage = phone.slice(phone.indexOf("{page === 'about' ? ("))
    const phoneRows = aboutPage.slice(0, aboutPage.indexOf('<Section>The small print</Section>'))
    assert.match(phoneRows, /<SetupRow\s+title="Help with this app"[\s\S]{0,120}onPress=\{\(\) => Linking\.openURL\(SUPPORT_URL\)\}/, 'the phone’s About has no Help with this app')
    const small = aboutPage.slice(aboutPage.indexOf('<Section>The small print</Section>'))
    assert.match(small, /<Note>\{AFFILIATION\}<\/Note>[\s\S]{0,600}<Note>\{SUPPORT_LINE\}<\/Note>/, 'the phone’s small print does not say where help comes from')
    /*
     * The browser's, in sight: a row on the About page itself, as on the
     * phone, not a link inside the small print, which opens closed. Found in
     * review, where it was also the browser's own link blue on the dark panel.
     */
    const web = read('src/App.jsx')
    const page = web.slice(web.indexOf("{setupPage === 'about' ? ("))
    const rows = page.slice(page.indexOf('<div className="setup-rows">'), page.indexOf('<Section key="small-print"'))
    assert.match(rows, /<SetupRow\s+key="help"\s+title="Help with this app"[\s\S]{0,160}onClick=\{\(\) => window\.open\(SUPPORT_URL, '_blank', 'noopener'\)\}/, 'the browser’s About has no Help with this app in sight')
    assert.ok(rows.indexOf('key="help"') < rows.indexOf('</div>'), 'Help with this app is not one of the About page’s rows')
    const about = page.slice(page.indexOf('<Section key="small-print"'))
    assert.match(about, /<p className="hint">\{AFFILIATION\}<\/p>[\s\S]{0,400}<p className="hint">\{SUPPORT_LINE\}<\/p>/, 'the browser’s small print does not say where help comes from')
    /* And a link dressed as a chip reads as one, never the browser's own blue. */
    const css = read('src/styles.css')
    const chip = css.slice(css.indexOf('\na.chip {'), css.indexOf('}', css.indexOf('\na.chip {')))
    assert.match(chip, /color: var\(--silk-dim\);/, 'a link chip is the browser’s default link colour')
    assert.match(chip, /text-decoration: none;/)
  })

  test('no Fractal logo, product photo or unit picture is left, and the plain box is drawn in their place', () => {
    for (const f of GONE_PICTURES) assert.ok(!existsSync(join(root, f)), `${f} is back`)
    /* Nothing asks for them, anywhere the app or the website is made from. */
    for (const f of shippedFiles()) {
      const text = readFileSync(f, 'utf8')
      for (const name of ['welcome/fm3.jpg', 'unit-fm3', 'piece-unit']) {
        assert.ok(!text.includes(name), `${rel(f)} still asks for ${name}`)
      }
      assert.ok(!/A Fractal Audio FM3/.test(text), `${rel(f)} still captions a picture “A Fractal Audio FM3”`)
    }
    /* The replacement: one picture, a PNG drawn for this app, at both ends. */
    const png = readFileSync(join(root, 'mobile/assets/unit-plain.png'))
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'the plain box is not a PNG')
    assert.ok(png.length < 300000, 'the plain box is too heavy for a phone on a signal')
    const phone = read('mobile/src/screens/Onboarding.js')
    assert.match(phone, /const PIECES = \{ unit: unitPlain, computer: pieceComputer, phone: piecePhone \}/)
    assert.match(phone, /const UnitShot = \(\) => \(\s+<Image\s+source=\{unitPlain\}/)
    const web = read('src/components/PhoneWalkthrough.jsx')
    assert.match(web, /const PIECES = \{ unit: unitShot, computer: pieceComputer, phone: piecePhone \}/)
  })

  /*
   * NOR ANY OTHER COMPANY'S LOGO IN THE APP'S OWN DRAWINGS, since 25 October
   * 2026. The laptop in the walkthrough had Apple's logo on its screen, and
   * the Connect screen showed Apple's logo, Microsoft's Windows logo and
   * Linux's penguin under "Mac, Windows, Linux". Apple's rules for its
   * trademarks say "You may not use the Apple Logo" without its written
   * license, Microsoft's say the same of theirs, and the app goes to Apple's
   * review with every store version. The laptop's screen shows the app's own
   * tile now, and the three computers are plain drawings
   * (mobile/src/screens/Connect.js says why). The gear cards' photographs and
   * illustrations are another matter: they show the makers' badges on
   * purpose, for identification, under the trademark note in
   * docs/gear-illustrations.md, and this test does not look at them.
   *
   * And the Bluetooth symbol, the Runic B, which was the top bar's lamp and
   * the adapter's picture while the app is on Bluetooth. The Bluetooth
   * group's brand guide: "Only Members of Bluetooth SIG, Inc. ... are
   * licensed to use the Bluetooth word mark, figure mark, and combination
   * mark", and of the Runic B on its own, "Use of the Runic B standing alone
   * may not be used in any other circumstance." The app's maker is not a
   * member, and from the store version that opens Bluetooth to customers
   * every customer and Apple's reviewer would see it. It is a plain aerial
   * now (icons/wireless.png, TopBar.js says why); the word Bluetooth, said
   * in words, stays.
   *
   * Pixels cannot be read for a logo here, so what is held is what can drift
   * back: the old files, anything asking for them, and the drawings that
   * took their place.
   */
  test('no other company’s logo in the app’s own drawings either (gear photographs aside): the laptop shows the app, the computers are plain drawings, and Bluetooth is an aerial', () => {
    for (const f of ['mobile/assets/icons/apple.png', 'mobile/assets/icons/windows.png', 'mobile/assets/icons/linux.png', 'mobile/assets/icons/bluetooth.png']) {
      assert.ok(!existsSync(join(root, f)), `${f} is back`)
    }
    for (const f of shippedFiles()) {
      const text = readFileSync(f, 'utf8')
      for (const name of ['icons/apple', 'icons/windows', 'icons/linux', 'icons/bluetooth', 'appleIcon', 'windowsIcon', 'linuxIcon', 'bluetoothIcon']) {
        assert.ok(!text.includes(name), `${rel(f)} still asks for ${name}`)
      }
    }
    /* Over Bluetooth, the top bar's lamp and the adapter's card are the aerial. */
    assert.match(read('mobile/src/components/TopBar.js'), /import wirelessIcon from '\.\.\/\.\.\/assets\/icons\/wireless\.png'/, 'the top bar’s Bluetooth lamp is not the plain aerial')
    assert.match(read('mobile/src/components/Walk.js'), /adapter: wirelessIcon,/, 'the Bluetooth adapter’s card is not the plain aerial')
    /* Mac, Windows, Linux: a laptop, a screen on a stand, a command prompt, in that order, at both ends. */
    const phone = read('mobile/src/screens/Connect.js')
    assert.match(phone, /import desktopIcon from '\.\.\/\.\.\/assets\/icons\/desktop\.png'/)
    assert.match(phone, /import terminalIcon from '\.\.\/\.\.\/assets\/icons\/terminal\.png'/)
    assert.match(phone, /\[laptopIcon, 'Mac'\],\s+\[desktopIcon, 'Windows'\],\s+\[terminalIcon, 'Linux'\]/, 'the phone’s three computers are not the plain drawings')
    const web = read('src/components/ConnectScreen.jsx')
    assert.match(web, /import desktopIcon from '\.\.\/\.\.\/mobile\/assets\/icons\/desktop\.png'/)
    assert.match(web, /import terminalIcon from '\.\.\/\.\.\/mobile\/assets\/icons\/terminal\.png'/)
    assert.match(web, /<span className="cc-os">\s+<Pic src=\{laptopIcon\} \/>\s+<Pic src=\{desktopIcon\} \/>\s+<Pic src=\{terminalIcon\} \/>/, 'the browser’s three computers are not the plain drawings')
    /* The names are said in words, where the pictures cannot say them. */
    assert.match(read('shared/onboarding.mjs'), /foot: 'Free • Mac, Windows, Linux'/, 'the line above the three pictures no longer names the computers')
    /* And the laptop is still the walkthrough's, under its own name, at both ends. */
    assert.ok(read('mobile/src/screens/Onboarding.js').includes("import pieceComputer from '../../assets/piece-computer.png'"))
    assert.ok(read('src/components/PhoneWalkthrough.jsx').includes("import pieceComputer from '../../mobile/assets/piece-computer.png'"))
  })

  /*
   * THE WALKTHROUGH'S PICTURES ARE AS BIG AS THEY ARE EVER DRAWN, AND NO
   * BIGGER. Google Play's 1.88.0 review: "Improve your app's performance with
   * bitmap image optimization." The phone's picture was 360×570 for a box
   * 56 points tall, decoded at six times the pixels it was shown with; it is
   * 142×225 now. The rule each one is held to: the box it is drawn in,
   * fitted the way `contain` fits it, at the sharpest screen that box meets.
   * The phone app draws them at up to 4 pixels a point (an Android phone at
   * its sharpest; an iPhone is 3), and the browser at up to 3 (a phone's
   * browser; a laptop's is 2). The boxes are read from the code, so a bigger
   * box with the same picture fails here rather than going soft on a phone.
   */
  test('the walkthrough’s pictures are as big as their biggest box, at the sharpest screen, and no bigger', () => {
    const size = (f) => {
      const png = readFileSync(join(root, f))
      assert.equal(png.toString('ascii', 1, 4), 'PNG', `${f} is not a PNG`)
      return [png.readUInt32BE(16), png.readUInt32BE(20)]
    }
    const box = (src, re, what) => {
      const m = src.match(re)
      assert.ok(m, `${what}: the box it is drawn in moved; this check follows it`)
      return [Number(m[1]), Number(m[2])]
    }
    const phone = read('mobile/src/screens/Onboarding.js')
    const css = read('src/styles.css')
    const web = read('src/components/PhoneWalkthrough.jsx')
    const art = box(phone, /const Art = \(\{ kind \}\) => \(\s+<Image[\s\S]*?style=\{\{ width: (\d+), height: (\d+) \}\}/, 'the phone’s three pieces')
    const pwArt = box(css, /\n\.pw-art \{[^}]*?width: (\d+)px;\s+height: (\d+)px;/, 'the browser’s three pieces')
    const pwShot = box(css, /\n\.pw-unit-shot \{[^}]*?width: (\d+)px;\s+height: (\d+)px;/, 'the browser’s choice cards')
    assert.match(web, /<img className="pw-art" src=\{PIECES\[box\.key\] \|\| PIECES\.unit\} alt="" \/>/)
    assert.match(web, /<img className="pw-unit-shot" src=\{pieceComputer\} alt="" \/>/, 'the computer’s card no longer shows the laptop; this check follows it')
    const PHONE_DENSITY = 4
    const BROWSER_DENSITY = 3
    /* The pixels a box needs: the picture fitted inside it, times the screen's pixels a point. */
    const needs = ([w, h], [bw, bh], density) => {
      const k = Math.min(bw / w, bh / h)
      return [Math.round(w * k * density), Math.round(h * k * density)]
    }
    for (const [file, boxes] of [
      ['mobile/assets/piece-phone.png', [[art, PHONE_DENSITY], [pwArt, BROWSER_DENSITY]]],
      ['mobile/assets/piece-computer.png', [[art, PHONE_DENSITY], [pwArt, BROWSER_DENSITY], [pwShot, BROWSER_DENSITY]]]
    ]) {
      const got = size(file)
      const most = boxes.map(([b, d]) => needs(got, b, d)).reduce((a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1])])
      assert.ok(got[0] >= most[0] && got[1] >= most[1], `${file} is ${got.join('×')}, and its biggest box needs ${most.join('×')}: it goes soft there`)
      assert.ok(got[0] <= most[0] * 1.25 && got[1] <= most[1] * 1.25, `${file} is ${got.join('×')}, far more than the ${most.join('×')} it is ever drawn at`)
    }
    /* The plain box is drawn across the first screen, as wide as the device; it was re-saved, never shrunk. */
    const unit = size('mobile/assets/unit-plain.png')
    assert.ok(unit[0] >= 960 && unit[1] >= 520, `the plain box is ${unit.join('×')}, smaller than the 960×520 it was drawn at`)
  })

  test('Fractal Audio’s own models show their words alone, and a picture that does not arrive is never a broken frame', async () => {
    /* None of the 35 is in either list, on the website, or in the record of where pictures came from. */
    for (const f of ['src/data/gear-photos.json', 'mobile/src/data/gear-photos.json']) {
      const photos = JSON.parse(read(f))
      for (const key of FRACTAL_ORIGINALS) assert.ok(!(key in photos), `${f} still has ${key}`)
    }
    const csv = read('public/gear/sources.csv').split(/\r?\n/).map((l) => l.split(',')[0])
    for (const key of FRACTAL_ORIGINALS) {
      assert.ok(!csv.includes(key), `public/gear/sources.csv still has ${key}`)
      assert.ok(!existsSync(join(root, `public/gear/${key}.jpg`)), `public/gear/${key}.jpg is back`)
    }
    assert.ok(!/Fractal Audio \(original model\)/.test(read('docs/gear-illustrations.md')), 'docs/gear-illustrations.md still lists a Fractal original')

    /* Run, at both ends: no picture for any of them, and none of them lands on somebody else's by the family rule. */
    const web = await import('../src/lib/gearPhotos.js')
    const phone = await import('../mobile/src/lib/gearPhotos.js')
    for (const name of ['FAS Modern', 'FAS Modern III', 'FAS Buttery', 'Thordendal Vintage', 'Big Hair', 'Supertweed', 'Buddah DuoMaster', 'Tube Pre', 'Treble Boost']) {
      assert.equal(web.photoFor(name), null, `the browser shows a picture for ${name}`)
      assert.equal(phone.photoFor(name, '/gear'), null, `the phone shows a picture for ${name}`)
    }

    /*
     * A copy of the app from before still asks the website for them, and the
     * website answers with its own front page. This copy never asks, but any
     * picture can fail the same way, so a failed one is dropped and the card
     * shows its words, as for a model with no picture.
     */
    const card = read('src/components/GearCard.jsx')
    assert.match(card, /const \[failed, setFailed\] = useState\(null\)/)
    assert.match(card, /const photo = found && found\.src !== failed \? found : null/)
    assert.match(card, /<img src=\{photo\.src\} alt=\{photo\.alt\} loading="lazy" onError=\{\(\) => setFailed\(photo\.src\)\} \/>/, 'a gear picture that fails is drawn as a broken frame')
    assert.match(card, /\{!about\.length && !photo \? \(/, 'with no picture and no words the card says nothing')
    assert.ok(card.indexOf('const [failed, setFailed]') < card.indexOf('if (!entry) return null'), 'the gear card calls a hook after it can return early')
    const panel = read('src/components/Console.jsx')
    assert.match(panel, /const chosenPhoto = chosenFound && chosenFound\.src !== photoFailed \? chosenFound : null/)
    assert.match(panel, /onError=\{\(\) => setPhotoFailed\(chosenPhoto\.src\)\}/, 'the block editor’s picture that fails is drawn as a broken frame')
    const phoneCard = read('mobile/src/components/GearCard.js')
    assert.match(phoneCard, /const \[failed, setFailed\] = useState\(null\)/)
    assert.match(phoneCard, /const photo = found && found\.src !== failed \? found : null/)
    assert.match(phoneCard, /onError=\{\(\) => setFailed\(photo\.src\)\}/, 'a gear picture that fails is an empty grey box on the phone')
    assert.ok(phoneCard.indexOf('const [failed, setFailed]') < phoneCard.indexOf('if (!entry) return null'), 'the phone’s gear card calls a hook after it can return early')
  })

  test('the support page says help is ours alone, and names the real way to Feedback', () => {
    const page = read('public/support.html')
    const words = pageText(page)
    assert.match(
      page,
      /<h2 id="contact">Reaching a person<\/h2>\s+<p>\s+Fractal Remote is supported only by its developer\. Fractal Audio does not support this app,\s+so please contact us, not Fractal Audio, about anything in it\.\s+<\/p>/,
      'the support page does not say Fractal Audio does not support the app, under Reaching a person'
    )
    assert.ok(!/Settings → Feedback/.test(words), 'the support page sends people to Settings → Feedback, which is not there')
    assert.ok(!/Settings → Fixes/.test(words), 'the support page sends people to Settings → Fixes, which is not there')
    assert.match(words, /Settings → Troubleshooting → Feedback → "Problem"/)
    assert.match(words, /Settings → Troubleshooting → Fixes/)
  })

  test('the store text says whose app it is not near the top, and the rules for what it may show are written down', async () => {
    const { fenced } = await import('../scripts/store-text.mjs')
    const store = read('docs/app-store.md')
    assert.equal(store.match(/\| \*\*Subtitle\*\* \| 30 \| `([^`]+)` \|/)?.[1], 'Independent · needs a computer')
    assert.equal(fenced(store, '### Google Play: short description').trim(), 'Through a computer, or by Bluetooth. Not made or supported by Fractal Audio.')
    /* Written rules, so the next screenshot or listing does not undo them. */
    assert.match(flat(store), /\*\*Never a Fractal logo, a product photo or a real Fractal unit\*\* \(18 October 2026\), in any screenshot, App Preview, Play feature graphic, store video or picture on the website\./)
    assert.match(flat(store), /\*\*The one exception is the review videos\*\*/)
    assert.match(flat(store), /\*\*Never "official", "certified", "approved" or "endorsed"\*\* about the app/)
    const rights = flat(store.slice(store.indexOf('## Content rights'), store.indexOf('## Export compliance')))
    assert.ok(!/pictures of those units\. Answer/.test(rights), 'Content rights still says the app has pictures of Fractal’s units')
    assert.match(rights, /It does not approve the name "Fractal Remote"/)
    /* The next version's review notes are told about the card. */
    assert.match(store, /\*\*For the next version's notes: the startup card\*\*/)
  })

  test('CLAUDE.md keeps the rules, so the next change does not undo them', () => {
    const notes = flat(read('CLAUDE.md'))
    assert.ok(notes.includes(THEIR_SENTENCE), 'CLAUDE.md does not quote the sentence')
    assert.match(notes, /So the name stays "Fractal Remote" unless Fractal sends a formal demand\. Do not suggest renaming\./)
    assert.match(notes, /\*\*Never a Fractal logo, an official product photo, or artwork taken from Fractal's editors, manuals or website\*\*/)
    assert.match(notes, /\*\*Never call the app official, certified, approved or endorsed\*\*/)
    assert.match(notes, /\*\*Help with the app is Justin's own channels only\*\*/)
  })
}
