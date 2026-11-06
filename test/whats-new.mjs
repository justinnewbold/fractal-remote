/**
 * WHAT'S NEW: one list (shared/whats-new.json), shown on the phone's About
 * page and on the website, held to plain words a player can read.
 *
 * "Under the about menu can we make a change log that shows what each
 * update change was made? Needs to be user friendly." (Justin, 1 November
 * 2026.)
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const flat = (rel) => read(rel).replace(/\s+/g, ' ')
const parts = (v) => String(v).split('.').map(Number)
const older = (a, b) => {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i]
  return false
}

export function run(test) {
  test('the list is newest first, each day a real date and a version no newer than the app’s, and the app shows a short run of it', async () => {
    const list = JSON.parse(read('shared/whats-new.json'))
    const { version } = JSON.parse(read('package.json'))
    assert.ok(Number.isInteger(list.shownInApp) && list.shownInApp >= 5 && list.shownInApp <= 15, 'the app shows too few days, or too many to read')
    assert.ok(list.days.length > 0)
    for (const [i, d] of list.days.entries()) {
      assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/, d.date)
      assert.ok(!Number.isNaN(Date.parse(`${d.date}T12:00:00Z`)), d.date)
      assert.match(d.version, /^\d+\.\d+\.\d+$/, d.version)
      assert.ok(!older(version, d.version), `${d.date} says version ${d.version}, newer than the app’s own ${version}`)
      assert.ok(Array.isArray(d.lines) && d.lines.length > 0 && d.lines.length <= 6, `${d.date}: a day with no lines, or too many to read`)
      if (i === 0) continue
      const before = list.days[i - 1]
      assert.ok(before.date > d.date, `${before.date} and ${d.date} are not newest first, or the same day twice`)
      assert.ok(older(d.version, before.version), `${d.date}’s version ${d.version} is not older than ${before.date}’s ${before.version}`)
    }
    const { dayWords } = await import('../scripts/whats-new.mjs')
    assert.equal(dayWords('2026-10-31'), '31 October 2026')
    assert.equal(dayWords('2026-11-01'), '1 November 2026')
  })

  test('every line is plain, short, and says nothing a player is not to read', () => {
    const list = JSON.parse(read('shared/whats-new.json'))
    const OTHER_PHONES = { ios: /android|google|play store|\bapk\b/i, android: /iphone|\bipad|apple watch|\bsiri\b|\bios\b|testflight|app store/i }
    for (const d of list.days) {
      for (const line of d.lines) {
        const { text, only = null } = typeof line === 'string' ? { text: line } : line
        assert.ok(typeof text === 'string' && text.length > 10 && text.length <= 320, `${d.date}: a line too long to read on a phone: ${text}`)
        assert.ok(only === null || only === 'ios' || only === 'android', `${d.date}: only is ${only}`)
        assert.ok(/[.!?]$/.test(text), `${d.date}: a line that is not a sentence: ${text}`)
        /* Apple's 2.3.10: no other phone's name in an iPhone app. A line for both phones names neither. */
        if (only !== 'android') assert.ok(!OTHER_PHONES.ios.test(text), `${d.date}: an iPhone shows a line that names Android: ${text}`)
        if (only !== 'ios') assert.ok(!OTHER_PHONES.android.test(text), `${d.date}: an Android phone shows a line that names Apple’s: ${text}`)
        /* The house rules for words a player reads (CLAUDE.md). */
        assert.ok(!/this phone/i.test(text), `${d.date}: “this phone”: ${text}`)
        assert.ok(!/\bofficial|certified|endorsed|approved by/i.test(text), `${d.date}: ${text}`)
        assert.ok(!/bluetooth[^.]*\bbeta\b|\bbeta\b[^.]*bluetooth/i.test(text), `${d.date}: Bluetooth called a beta: ${text}`)
        assert.ok(!/\btried\b|\btested\b|not tried/i.test(text), `${d.date}: says what has been tried, which is the Developer page’s: ${text}`)
        assert.ok(!/developer|admin|his account|justin/i.test(text), `${d.date}: names something only the developer has: ${text}`)
        assert.ok(!/\b(OTA|EAS|SysEx|fingerprint|commit|pull request|CI|PR)\b/.test(text), `${d.date}: developer words: ${text}`)
        /* Editing over Bluetooth is his account's until a store version opens it (ble-rule EDIT_FROM_STORE). */
        assert.ok(!/edit[^.]*over bluetooth|bluetooth[^.]*\bediting\b(?! or saving)/i.test(text.replace(/no editing or saving/gi, '')), `${d.date}: promises editing over Bluetooth: ${text}`)
      }
    }
  })

  test('the phone draws the newest days for its own platform, with All updates to the website’s page', async () => {
    const { WHATS_NEW, SHOWN_IN_APP, daysFor } = await import('../mobile/src/lib/whatsNew.js')
    const list = JSON.parse(read('shared/whats-new.json'))
    assert.equal(SHOWN_IN_APP, list.shownInApp)
    assert.equal(WHATS_NEW.length, list.days.length)
    for (const os of ['ios', 'android']) {
      const days = daysFor(os)
      assert.ok(days.length > 0)
      for (const d of days) for (const line of d.lines) assert.equal(typeof line, 'string')
    }
    const all = (os) => daysFor(os).flatMap((d) => d.lines).join(' ')
    assert.ok(!/android/i.test(all('ios')), 'an iPhone is shown a line for Android')
    assert.ok(!/apple watch/i.test(all('android')), 'an Android phone is shown a line for the Apple Watch')
    /* The page: the newest SHOWN_IN_APP, newest first, and the website for the rest. */
    const page = flat('mobile/src/screens/WhatsNew.js')
    assert.match(page, /export const daysHere = \(\) => daysFor\(Platform\.OS\)\.slice\(0, SHOWN_IN_APP\)/)
    assert.match(page, /<Press label="All updates" sub="On the website" height=\{52\} onPress=\{\(\) => Linking\.openURL\(WHATS_NEW_URL\)\.catch\(\(\) => \{\}\)\} \/>/)
    assert.ok(!/this phone/i.test(page))
    /* Under About on the front of Settings, beside Updates (2 November 2026: About opens
       onto its rows, with no page of its own between), so back goes to Settings. */
    const settings = flat('mobile/src/screens/Settings.js')
    const about = settings.slice(settings.indexOf('<Group title="About"'), settings.indexOf('</Group>', settings.indexOf('<Group title="About"')))
    assert.ok(about.indexOf('title="Updates"') > 0 && about.indexOf('title="Updates"') < about.indexOf('<SetupRow title="What’s new"'), 'What’s new is not under Updates in About')
    assert.match(about, /<SetupRow title="What’s new" status=\{latestLine\(\)\} onPress=\{\(\) => setPage\('whats-new'\)\} \/>/)
    assert.match(settings, /\{page === 'whats-new' \? \( <> \{head\('What’s new', 'back'\)\} <WhatsNew \/> <\/> \) : null\}/)
    assert.ok(!/'whats-new': 'about'/.test(settings), 'back from What’s new goes to a page that is not there any more')
  })

  test('the browser opens the website’s page, and never carries the list, so a new line is never a new computer release', async () => {
    const { WHATS_NEW_URL } = await import('../shared/affiliation.mjs')
    assert.equal(WHATS_NEW_URL, 'https://fractal.newbold.cloud/whats-new.html')
    const app = flat('src/App.jsx')
    assert.match(app, /<SetupRow key="whats-new" title="What’s new" status="What each update changed" onClick=\{\(\) => window\.open\(WHATS_NEW_URL, '_blank', 'noopener'\)\} \/>/)
    assert.ok(!/whats-new\.json|whatsNew/.test(read('src/App.jsx')), 'the web app imports the list')
    const { WEBSITE_ONLY } = await import('../scripts/computer-fingerprint.mjs')
    assert.ok(WEBSITE_ONLY.includes('public/whats-new.html'), 'the website’s page counts in the computer app’s fingerprint')
  })

  test('the website’s page says every day there is, with each phone’s own lines marked', async () => {
    const list = JSON.parse(read('shared/whats-new.json'))
    const html = read('public/whats-new.html')
    const { dayWords } = await import('../scripts/whats-new.mjs')
    for (const d of list.days) {
      assert.ok(html.includes(`<h2>${dayWords(d.date)}</h2>`), `the page leaves out ${d.date}`)
      assert.ok(html.includes(`Version ${d.version}`))
    }
    assert.match(html, /<title>What’s new — Fractal Remote<\/title>/)
    assert.ok(html.includes('(iPhone and iPad)') && html.includes('(Android)'), 'a line for one phone is not marked as such on the website')
  })

  test('a new-version card has What’s new, which opens Settings straight on the list', async () => {
    const { WHATS_NEW_LINK, WHATS_NEW_PAGE } = await import('../mobile/src/lib/whats-new-rule.js')
    assert.equal(WHATS_NEW_LINK, 'What’s new')
    assert.equal(WHATS_NEW_PAGE, 'whats-new')
    /* The link: words, a link to a screen reader, a thumb's 44, and the one wording. */
    const link = flat('mobile/src/components/WhatsNewLink.js')
    assert.match(link, /accessibilityRole="link"/)
    assert.match(link, /const THUMB = 44/)
    assert.match(link, /minHeight: THUMB/, 'the link is shorter than a thumb')
    assert.match(link, /\{WHATS_NEW_LINK\}/, 'the link says its own words instead of the shared ones')
    assert.ok(!/this phone/i.test(link))
    /* The over-the-air card: beside Restart now in both forms, the floating one no taller and its sentence unchanged. */
    const ready = flat('mobile/src/components/UpdateReady.js')
    assert.match(ready, /export default function UpdateReady\(\{ over = false, onWhatsNew = null \}\)/)
    assert.equal((ready.match(/\{onWhatsNew \? <WhatsNewLink onPress=\{onWhatsNew\} \/> : null\}/g) || []).length, 2, 'What’s new is missing from one of the two cards')
    const floating = ready.slice(ready.indexOf('<Toast open={open} yields>'), ready.indexOf('</Toast>'))
    assert.match(floating, /<View style=\{ROW\}> <Press label="Restart now" tone="signal" height=\{44\} grow onPress=\{\(\) => applyNow\(\)\} \/> \{onWhatsNew \? <WhatsNewLink onPress=\{onWhatsNew\} \/> : null\} <\/View>/, 'the floating card’s link is not beside Restart now, so the card grew a row')
    assert.match(ready, /const ROW = \{ flexDirection: 'row', alignItems: 'center', gap: space\.sm \}/)
    assert.match(ready, /useEffect\(\(\) => \{ if \(open\) askWaiting\(updates\.waitingVersion\) \}, \[open, updates\.waitingVersion\]\)/, 'the waiting update’s lines are not asked for while its card is up')
    /* App opens Settings on the page, and the card draws no link while the page is on screen. */
    const app = flat('mobile/App.js')
    assert.match(app, /const whatsNewOpen = screen === 'settings' && settingsAt === WHATS_NEW_PAGE const openWhatsNew = whatsNewOpen \? null : \(\) => openSettings\(WHATS_NEW_PAGE\)/)
    assert.equal((app.match(/<UpdateReady (over )?onWhatsNew=\{openWhatsNew\} \/>/g) || []).length, 2, 'one of the two cards opens nothing')
    /* The store card, at the top of Settings: Settings' own page change, so Back comes up to the list. */
    const store = flat('mobile/src/components/NewerInStore.js')
    assert.match(store, /export default function NewerInStore\(\{ onWhatsNew = null \}\)/)
    assert.match(store, /\{onWhatsNew \? <WhatsNewLink onPress=\{onWhatsNew\} \/> : null\}/)
    const settings = flat('mobile/src/screens/Settings.js')
    assert.match(settings, /<NewerInStore onWhatsNew=\{\(\) => setPage\(WHATS_NEW_PAGE\)\} \/>/)
    assert.match(settings, /\{page === 'whats-new' \? \( <> \{head\('What’s new', 'back'\)\} <WhatsNew \/> <\/> \) : null\}/, 'the page the link opens is not there')
    assert.ok(!/'whats-new': /.test(settings), 'back from What’s new goes somewhere other than the Settings list')
  })

  test('the waiting update’s lines go on top, newer days first, each day once, and nothing newer than the update', async () => {
    const { withWaiting, daysFromFile } = await import('../mobile/src/lib/whats-new-rule.js')
    const day = (date, version, ...lines) => ({ date, day: date, version, lines })
    const mine = [day('2026-11-05', '1.89.46', 'b'), day('2026-11-04', '1.89.40', 'a')]
    /* Nothing fetched, or nothing newer: the phone's own list, as it was. */
    assert.deepEqual(withWaiting(mine, []), mine)
    assert.deepEqual(withWaiting(mine, null), mine)
    assert.deepEqual(withWaiting(mine, [day('2026-11-04', '1.89.40', 'other')]), mine, 'a day the phone already has at the same version is replaced')
    assert.deepEqual(withWaiting(mine, [day('2026-11-03', '1.89.30', 'old')]), mine, 'an older day the phone does not show is put in')
    /* A newer day goes on top; the same day at a newer version takes the phone's copy's place. */
    const fetched = [day('2026-11-06', '1.89.50', 'new'), day('2026-11-05', '1.89.48', 'b', 'c'), day('2026-11-04', '1.89.40', 'a')]
    assert.deepEqual(withWaiting(mine, fetched), [fetched[0], fetched[1], mine[1]])
    assert.deepEqual(withWaiting(mine, [...fetched].reverse()).map((d) => d.date), ['2026-11-06', '2026-11-05', '2026-11-04'], 'not newest first')
    /* Never past the update that is waiting: the website can be ahead of the download. */
    assert.deepEqual(withWaiting(mine, fetched, { upTo: '1.89.48' }), [fetched[1], mine[1]])
    assert.deepEqual(withWaiting(mine, fetched, { upTo: '1.89.46' }), mine)
    assert.deepEqual(withWaiting(mine, fetched, { upTo: 'nonsense' }), mine, 'a version it cannot read lets anything through')
    /* The file as the phone reads it: its own lines only, and anything malformed left out. */
    const file = {
      days: [
        { date: '2026-11-06', day: '6 November 2026', version: '1.89.50', lines: [{ text: 'both', only: null }, { text: 'ios one', only: 'ios' }, { text: 'android one', only: 'android' }] },
        { date: '2026-11-05', day: '5 November 2026', version: '1.89.48', lines: [{ text: 'android only', only: 'android' }] },
        { date: 'yesterday', day: 'x', version: '1.89.47', lines: [{ text: 'bad date' }] },
        { date: '2026-11-04', day: '4 November 2026', version: 'v1', lines: [{ text: 'bad version' }] },
        { date: '2026-11-03', day: '3 November 2026', version: '1.89.30', lines: 'not a list' },
        null
      ]
    }
    assert.deepEqual(daysFromFile(file, 'ios'), [{ date: '2026-11-06', day: '6 November 2026', version: '1.89.50', lines: ['both', 'ios one'] }])
    assert.deepEqual(daysFromFile(file, 'android').map((d) => d.lines), [['both', 'android one'], ['android only']])
    for (const junk of [null, undefined, {}, { days: 'x' }, []]) assert.deepEqual(daysFromFile(junk, 'ios'), [])
  })

  test('the website keeps the newest days as JSON for the phone, read with a timeout and failing silent', async () => {
    const { websiteList } = await import('../scripts/whats-new.mjs')
    const { WHATS_NEW_JSON_URL } = await import('../mobile/src/lib/whats-new-rule.js')
    const { WHATS_NEW_URL } = await import('../shared/affiliation.mjs')
    const list = JSON.parse(read('shared/whats-new.json'))
    const json = read('public/whats-new.json')
    assert.equal(json, websiteList(read('shared/whats-new.json')), 'public/whats-new.json is stale: npm run sync:rules')
    const file = JSON.parse(json)
    assert.equal(file.days.length, Math.min(list.shownInApp, list.days.length))
    assert.equal(file.days[0].version, list.days[0].version)
    assert.equal(WHATS_NEW_JSON_URL, WHATS_NEW_URL.replace(/\.html$/, '.json'), 'the list is asked for somewhere other than beside its page')
    const { WEBSITE_ONLY } = await import('../scripts/computer-fingerprint.mjs')
    assert.ok(WEBSITE_ONLY.includes('public/whats-new.json'), 'a new line would make a computer release')
    /* The ask: notForever's timeout, never a throw, asked again on the next open after a failure. */
    const ask = flat('mobile/src/lib/whatsNewWaiting.js')
    assert.match(ask, /const ASK_MS = 8000/)
    assert.match(ask, /notForever\(WHATS_NEW_JSON_URL, \{ headers: \{ Accept: 'application\/json' \}, cache: 'no-store' \}, ASK_MS\)/)
    assert.match(ask, /\} catch \{ \/\*[^*]*\*\/ asked = null \}/, 'a failed ask is never asked again')
    assert.ok(!/AsyncStorage/.test(ask), 'the website’s lines are kept past the restart that brings them')
    /* The page: the website's newer days only while something is waiting, cut to the same length. */
    const page = flat('mobile/src/screens/WhatsNew.js')
    assert.match(page, /const behind = waiting \|\| Boolean\(store\.note\)/)
    assert.match(page, /const days = behind && fetched\.file \? withWaiting\(daysHere\(\), daysFromFile\(fetched\.file, Platform\.OS\), \{ upTo \}\)\.slice\(0, SHOWN_IN_APP\) : daysHere\(\)/)
    /* The waiting update's version, from its manifest: only a plain number. */
    const updates = read('mobile/src/lib/updates.js')
    const src = updates.slice(updates.indexOf('const versionIn = '), updates.indexOf('\n}', updates.indexOf('const versionIn = ')) + 2)
    const versionIn = new Function(`${src}; return versionIn`)()
    assert.equal(versionIn({ extra: { expoClient: { version: '1.89.50' } } }), '1.89.50')
    for (const m of [null, {}, { extra: {} }, { extra: { expoClient: { version: 'v2' } } }, { extra: { expoClient: { version: 7 } } }]) assert.equal(versionIn(m), null)
    assert.match(updates, /const got = await api\.fetchUpdateAsync\(\)\s+set\(\{ phase: 'ready', waitingVersion: versionIn\(got\?\.manifest\) \|\| versionIn\(found\?\.manifest\) \}\)/)
  })

  test('Check for updates shows Checking… for a moment however quick the answer, then when it last checked', async () => {
    const settings = read('mobile/src/screens/Settings.js')
    assert.match(settings, /const CHECK_SHOWN_MS = 1200/)
    assert.match(settings, /updates\.phase === 'checking' \|\| checkShown\s*\? 'Checking…'/, 'a quick answer leaves nothing on screen to show a check was made')
    assert.match(settings, /showCheck\(\)\s*return checkNow\(\)/)
    assert.match(settings, /up to date\$\{updates\.checkedAt \? ` · checked /)
    assert.match(read('mobile/src/lib/updates.js'), /set\(\{ phase: 'current', checkedAt: Date\.now\(\) \}\)/)
  })
}
