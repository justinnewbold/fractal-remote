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
}
