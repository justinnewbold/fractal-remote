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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
 * Fractal Audio's own models, whose drawings wore a FRACTAL AUDIO badge and
 * were taken out. Their gear cards show words only; test/limits.mjs holds the
 * rest of the catalog to having a picture, with these 34 as the one gap.
 */
export const FRACTAL_ORIGINALS = [
  'big-hair', 'bit-crusher', 'brit-brown', 'buddah-duomaster', 'fas-6160', 'fas-bass', 'fas-boost', 'fas-brootalz',
  'fas-brown', 'fas-class-a', 'fas-crunch', 'fas-express', 'fas-hot-rod', 'fas-lead-1', 'fas-lead-2', 'fas-led-drive',
  'fas-modern', 'fas-modern-ii', 'fas-modern-iii', 'fas-rhythm', 'fas-skull-crusher', 'fas-stealth-blue', 'fas-wreck',
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
    assert.match(promoText(store), new RegExp(`^REQUIRES A COMPUTER\\. ${NOT_AFFILIATED_SHORT.replace(/[.,]/g, '\\$&')} On a VP4`), 'the promotional text does not put the computer first and the disclaimer second')

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

  test('the startup card: once on every device, under its own key, before anything else, at both ends', () => {
    /* THE PHONE. The card, from the shared words, and OK. */
    const card = read('mobile/src/components/IndependentNotice.js')
    assert.match(card, /import \{ NOT_AFFILIATED, STARTUP_NOTICE_TITLE, SUPPORT_LINE \} from '\.\.\/lib\/affiliation'/)
    for (const piece of ['{STARTUP_NOTICE_TITLE}', '{NOT_AFFILIATED}', '{SUPPORT_LINE}', 'label="OK"']) {
      assert.ok(card.includes(piece), `the phone’s card has lost ${piece}`)
    }
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
    const small = phone.slice(phone.indexOf('<Section>The small print</Section>'))
    assert.match(small, /<Note>\{AFFILIATION\}<\/Note>[\s\S]{0,600}<Note>\{SUPPORT_LINE\}<\/Note>\s+<Press\s+label="Help with this app"[\s\S]{0,120}onPress=\{\(\) => Linking\.openURL\(SUPPORT_URL\)\}/, 'the phone’s About has no Help with this app')
    const web = read('src/App.jsx')
    const about = web.slice(web.indexOf('<Section key="small-print"'))
    assert.match(about, /<p className="hint">\{SUPPORT_LINE\}<\/p>\s+<div className="history-actions">\s+<a className="chip" href=\{SUPPORT_URL\} target="_blank" rel="noreferrer">\s+Help with this app/, 'the browser’s About has no Help with this app')
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

  test('Fractal Audio’s own models show their words alone, and a picture that does not arrive is never a broken frame', async () => {
    /* None of the 34 is in either list, on the website, or in the record of where pictures came from. */
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
    for (const name of ['FAS Modern', 'FAS Modern III', 'Thordendal Vintage', 'Big Hair', 'Supertweed', 'Buddah DuoMaster', 'Tube Pre', 'Treble Boost']) {
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
    assert.match(words, /Settings → Troubleshooting → Feedback → "Something is broken"/)
    assert.match(words, /Settings → Troubleshooting → Fixes/)
  })

  test('the store text says whose app it is not near the top, and the rules for what it may show are written down', async () => {
    const { fenced } = await import('../scripts/store-text.mjs')
    const store = read('docs/app-store.md')
    assert.equal(store.match(/\| \*\*Subtitle\*\* \| 30 \| `([^`]+)` \|/)?.[1], 'Independent · needs a computer')
    assert.equal(fenced(store, '### Google Play: short description').trim(), 'Requires a computer and our desktop app. Not made or supported by Fractal Audio.')
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
