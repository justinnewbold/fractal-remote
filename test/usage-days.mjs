/**
 * HOW MANY PEOPLE, DAY BY DAY (4 November 2026).
 *
 * "A day-by-day history of how many people use the app, on your Developer
 * page." Three things here can be wrong without looking it:
 *
 *   - the night's count and the page's People counting one day two ways,
 *     which is why there is one rule (shared/usage-count.mjs) and these
 *     check that both ends use it, and use it the same way;
 *   - a day with no record drawn as a zero, which reads as "nobody used it"
 *     about a day nobody counted;
 *   - the table keeping more than totals, or anybody but grant-access being
 *     able to read or write it, or a past day being rewritten.
 *
 * The grant-access half, run, is in test/server.mjs, beside the function's
 * other runs (one copy of the function is loaded for all of them).
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const sqlOf = (p) => read(p).replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim()
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

const TABLE_SQL = 'supabase/migrations/20261104_usage_days.sql'
const SCHEDULE_SQL = 'supabase/migrations/20261104_usage_days_schedule.sql'

const HOUR = 3600000
const DAY = 86400000

/** Run `fn` with this process in time zone `tz`, and put it back after. */
const inZone = async (tz, fn) => {
  const was = process.env.TZ
  process.env.TZ = tz
  try {
    return await fn()
  } finally {
    if (was === undefined) delete process.env.TZ
    else process.env.TZ = was
  }
}

/** The How many people fixture (test/mobile.mjs), as of `now`. */
const fixture = (now) => {
  const hoursAgo = (h) => new Date(now - h * HOUR).toISOString()
  const daysAgo = (d) => new Date(now - d * DAY).toISOString()
  return {
    ok: true,
    total: 5,
    people: [
      { lastSignIn: daysAgo(40), devices: [{ kind: 'iphone-app', last_seen: hoursAgo(1) }, { kind: 'web-mac', last_seen: daysAgo(5) }], seen: { version: '1.86.62', platform: 'iOS', platformVersion: 'Version 27.1 (Build 25B74)', last: hoursAgo(1) } },
      { lastSignIn: daysAgo(60), devices: [], seen: { version: '1.86.9', platform: 'Android', platformVersion: '36', last: daysAgo(3) } },
      { lastSignIn: daysAgo(20), devices: [{ kind: 'computer', last_seen: daysAgo(20) }], seen: null },
      { lastSignIn: daysAgo(90), devices: [], seen: { version: '1.86.1', platform: 'iOS', platformVersion: '26.4', last: daysAgo(90) } }
    ]
  }
}

/** Words nothing on these pages may say: the device in hand by a fixed name, or what has been tried. */
const NEVER = /this phone|tried|tested|untried/i

export function run(test) {
  test('Day by day: People and the night count one answer by one rule, and only the day’s start differs', async () => {
    const counts = await import('../shared/usage-count.mjs')
    const { usageSections } = await import('../shared/admin.mjs')
    /* 2026-11-04 02:00 UTC: 7 pm on the 3rd in Denver. */
    const now = Date.UTC(2026, 10, 4, 2, 0)
    const answer = fixture(now)

    /* The windows People has always used: since the day began, the last 7×24 hours, the last 30×24. */
    const c = counts.countsAt(answer, { dayStart: now - 12 * HOUR, now })
    assert.equal(c.active_day, 1)
    assert.equal(c.active_7, 2)
    assert.equal(c.active_30, 3)
    assert.equal(c.accounts, 5)
    assert.deepEqual(c.places.month, { 'iPhone app': 1, 'Android app': 1, 'Computer app': 1, Website: 1 })
    assert.deepEqual(c.versions.month, { '1.86.62': 1, '1.86.9': 1 }, 'the summer’s version is counted, or one is missing')
    assert.deepEqual(c.systems.month, { 'iOS 27.1': 1, 'Android 16': 1 })
    assert.deepEqual(c.places.day, { 'iPhone app': 1, 'Android app': 0, 'Computer app': 0, Website: 0 })

    /* The night: a UTC day. Somebody on at 11 pm UTC on the 3rd is in Denver's today, and not in the 4th's. */
    const late = { ...answer, people: [...answer.people, { lastSignIn: new Date(Date.UTC(2026, 10, 3, 23, 0)).toISOString(), devices: [], seen: null }] }
    const night = counts.dayCounts(late, now)
    assert.equal(night.day, '2026-11-04')
    assert.equal(night.active_day, 1, 'the night counts from somewhere other than midnight UTC')
    await inZone('America/Denver', () => {
      const today = usageSections(late, now).find((s) => s.title === 'People who used it').rows.find((r) => r.label === 'Today').value
      assert.equal(today, '2', 'People’s Today no longer starts at midnight where the device is')
    })

    /* And People's sections are exactly the rule's numbers, so the two cannot drift apart. */
    await inZone('UTC', () => {
      const rows = (title) => Object.fromEntries((usageSections(answer, now).find((s) => s.title === title)?.rows || []).map((r) => [r.label, r.value]))
      const same = counts.dayCounts(answer, now)
      assert.deepEqual(rows('People who used it'), { Today: String(same.active_day), 'Last 7 days': String(same.active_7), 'Last 30 days': String(same.active_30), 'Everyone with an account': '5' })
      assert.deepEqual(rows('Where, in the last 30 days'), Object.fromEntries(Object.entries(same.places.month).map(([k, v]) => [k, String(v)])))
    })

    /* What the night keeps has these fields and no others: totals, never a person. */
    assert.deepEqual(Object.keys(night).sort(), ['accounts', 'active_30', 'active_7', 'active_day', 'counted', 'day', 'places', 'systems', 'unanswered', 'versions'])
    for (const part of ['places', 'versions', 'systems']) assert.deepEqual(Object.keys(night[part]).sort(), ['day', 'month'])
    const kept = JSON.stringify(night)
    assert.ok(!/@|lastSignIn|last_seen|devices|"seen"|people/.test(kept), 'the night’s count carries something about a person')

    /* People's two shared names are read from the rule, not kept beside it. */
    const admin = code(read('shared/admin.mjs'))
    assert.match(admin, /import \{[^}]*\bcountsAt\b[^}]*\} from '\.\/usage-count\.mjs'/)
    assert.doesNotMatch(admin, /const (PLACES|placeOf|placeOfPlatform|byVersion) =/, 'a second copy of the counting rule is back in admin.mjs')
    assert.match(admin, /const counts = countsAt\(answer, \{ dayStart: dayStart\(new Date\(now\)\), now \}\)/, 'People counts from somewhere other than the shared rule, or from a day start other than this device’s')
    assert.doesNotMatch(read('shared/usage-count.mjs'), /^import /m, 'the counting rule imports something, and its copies are plain copies')
  })

  test('Day by day: phone systems in words, from what RevenueCat keeps, iOS first and newest first', async () => {
    const { systemOf, bySystem, LABEL_MAX } = await import('../shared/usage-count.mjs')
    for (const [platform, platformVersion, want] of [
      ['iOS', 'Version 27.2 (Build 24C5)', 'iOS 27.2'],
      ['iOS', 'Version 27.2.1 (Build 24C101)', 'iOS 27.2'],
      ['iOS', '27.2.1', 'iOS 27.2'],
      ['iOS', 'iOS 27.0', 'iOS 27'],
      ['ios', '18', 'iOS 18'],
      ['iOS', 'iPadOS 27.1', 'iPadOS 27.1'],
      ['iPadOS', '27.1', 'iPadOS 27.1'],
      ['Android', '35', 'Android 15'],
      ['android', '36', 'Android 16'],
      ['Android', '32', 'Android 12L'],
      ['Android', '16', 'Android 16'],
      ['Android', 'Android 16', 'Android 16'],
      ['Android', '99', 'Android (API 99)'],
      ['iOS', null, 'iOS (version unknown)'],
      ['Android', '', 'Android (version unknown)'],
      ['web', 'Mozilla/5.0', null],
      ['macOS', '15.1', null],
      [null, null, null]
    ]) {
      assert.equal(systemOf({ platform, platformVersion }), want, `${platform} ${platformVersion}`)
    }
    assert.ok(systemOf({ platform: 'iOS', platformVersion: '9'.repeat(200) }).length <= LABEL_MAX, 'a label can be any length')
    /* A number past four digits is no system's: never "iOS 1e+200", which no table check would expect. */
    assert.equal(systemOf({ platform: 'iOS', platformVersion: '9'.repeat(200) }), 'iOS (version unknown)')
    assert.equal(systemOf({ platform: 'Android', platformVersion: '9'.repeat(30) }), 'Android (version unknown)')
    assert.equal(systemOf({ platform: 'iOS', platformVersion: '0027.02' }), 'iOS 27.2')
    const sorted = ['Android 12L', 'iOS 26.4', 'Android (version unknown)', 'iOS 27.2', 'Android 16', 'iOS 27.10', 'iPadOS 27.1', 'Other', 'iOS (version unknown)'].sort(bySystem)
    assert.deepEqual(sorted, ['iOS 27.10', 'iOS 27.2', 'iOS 26.4', 'iOS (version unknown)', 'iPadOS 27.1', 'Android 16', 'Android 12L', 'Android (version unknown)', 'Other'])

    /* People lists them, with a line saying where they come from, from the first day: no history needed. */
    const { usageSections, SYSTEMS_TITLE } = await import('../shared/admin.mjs')
    const now = Date.UTC(2026, 10, 4, 18, 0)
    const section = usageSections(fixture(now), now).find((s) => s.title === SYSTEMS_TITLE)
    assert.ok(section, 'People has no System versions section')
    assert.equal(SYSTEMS_TITLE, 'System versions, last 30 days')
    assert.deepEqual(section.rows.slice(0, 2), [{ label: 'iOS 27.1', value: '1 person' }, { label: 'Android 16', value: '1 person' }], 'the summer’s iOS 26.4 is counted, or the order is not iOS first')
    assert.match(section.rows.at(-1).value, /iPhones and iPads both show as iOS/)
    assert.doesNotMatch(JSON.stringify(section), NEVER)
    /* A busy minute at RevenueCat is said, not hidden in a smaller number. */
    const note = (a) => JSON.stringify(usageSections(a, now).find((s) => s.title === 'Note'))
    assert.match(note({ ...fixture(now), unanswered: 2 }), /RevenueCat didn’t answer about 2 people just now, so these may be a little low\. Refresh to ask again\./)
    assert.doesNotMatch(note(fixture(now)), /didn’t answer/)
  })

  test('Day by day: one day can hold only so many labels, the rest added up as Other', async () => {
    const { capped, countsAt, MOST_LABELS, LABEL_MAX } = await import('../shared/usage-count.mjs')
    assert.equal(MOST_LABELS, 40)
    const many = Object.fromEntries(Array.from({ length: 55 }, (_, i) => [`1.${i}.0`, i + 1]))
    const kept = capped(many)
    assert.equal(Object.keys(kept).length, MOST_LABELS)
    assert.equal(Object.values(kept).reduce((a, b) => a + b, 0), Object.values(many).reduce((a, b) => a + b, 0), 'people were lost folding the rest into Other')
    assert.equal(kept.Other, Array.from({ length: 16 }, (_, i) => i + 1).reduce((a, b) => a + b, 0), 'Other is not the smallest ones added up')
    assert.deepEqual(capped({ a: 2, b: 0 }), { a: 2 }, 'a label nobody was on is kept')
    const now = Date.UTC(2026, 10, 4, 18, 0)
    const people = Array.from({ length: 60 }, (_, i) => ({ lastSignIn: null, devices: [], seen: { version: `9.${i}.0`, platform: 'iOS', platformVersion: '27.1', last: new Date(now - HOUR).toISOString() } }))
    const c = countsAt({ ok: true, people }, { dayStart: now - 2 * HOUR, now })
    assert.equal(Object.keys(c.versions.day).length, MOST_LABELS)
    assert.ok(Object.keys(c.versions.month).length <= MOST_LABELS)
    assert.ok(Object.keys(c.versions.month).every((k) => k.length <= LABEL_MAX), 'a version label is longer than the table allows')
  })

  test('Day by day: an app version is kept only as a version number, so no label can name anybody', async () => {
    const { countsAt, VERSION_LABEL } = await import('../shared/usage-count.mjs')
    const now = Date.UTC(2026, 10, 4, 18, 0)
    const on = (version) => ({ lastSignIn: null, devices: [], seen: { version, platform: 'iOS', platformVersion: '27.1', last: new Date(now - HOUR).toISOString() } })
    /* RevenueCat keeps what the app on the phone said: a copy that sent words in its place is counted, as Other, and its words are not. */
    const said = ['1.89.37', ' 1.89.3 ', '2', '1.2.3.4', 'justin@example.com', 'Justin Newbold', '1.89.37 (31)', '1.2.3.4.5', `9.1.${'x'.repeat(60)}`, '', null]
    const c = countsAt({ ok: true, people: said.map(on) }, { dayStart: now - 2 * HOUR, now })
    assert.deepEqual(c.versions.day, { '1.89.37': 1, '1.89.3': 1, 2: 1, '1.2.3.4': 1, Other: 5 })
    assert.deepEqual(c.versions.month, c.versions.day)
    for (const label of Object.keys(c.versions.month)) assert.match(label, VERSION_LABEL)
    assert.ok(!/@|Justin|x{10}/.test(JSON.stringify(c)), 'words a phone sent as its version are kept')
    /* The table holds the versions to the very same pattern, so a label the rule lets through is one the table takes. */
    assert.ok(sqlOf(TABLE_SQL).includes(`versions jsonb not null default '{}'::jsonb check (public.usage_breakdown_ok(versions, '${VERSION_LABEL.source}'))`), 'the table and the rule disagree on what a version looks like')
  })

  test('Day by day: 30 bars, today on the right; before counting began is no record yet and never a zero', async () => {
    const { dayBars, dayLine, barLabel, barPoints, axisLabels, scaleLine, STUB_HEIGHT, CHART_HEIGHT, SHOWN_DAYS, ZERO_HEIGHT, LEAST_HEIGHT } = await import('../shared/admin.mjs')
    const now = Date.UTC(2026, 10, 4, 18, 0)
    const answer = fixture(now)
    const row = (day, n, more = {}) => ({ day, active_day: n, active_7: n + 3, active_30: n + 9, accounts: 89, counted: 89, unanswered: 0, places: { day: { 'iPhone app': n, 'Android app': 0, 'Computer app': 0, Website: 0 }, month: {} }, versions: {}, systems: {}, ...more })

    /* Counting began on the 1st; the 2nd was missed; the 3rd was kept; today is not kept yet. Newest first, as the server answers. */
    const days = [row('2026-11-03', 6, { unanswered: 2 }), row('2026-11-01', 0)]
    const { bars, most, first } = dayBars({ ...answer, days }, now)
    assert.equal(bars.length, SHOWN_DAYS)
    assert.equal(bars.at(-1).day, '2026-11-04', 'today is not on the right')
    assert.equal(bars[0].day, '2026-10-06')
    assert.equal(first, '2026-11-01')
    const by = Object.fromEntries(bars.map((b) => [b.day, b]))
    assert.equal(by['2026-10-31'].kind, 'none')
    assert.equal(by['2026-11-01'].kind, 'counted')
    assert.equal(by['2026-11-01'].value, 0, 'a day that was counted as nobody is not a zero')
    assert.equal(by['2026-11-02'].kind, 'missed')
    assert.equal(by['2026-11-03'].value, 6)
    assert.equal(by['2026-11-04'].kind, 'so-far')
    assert.equal(by['2026-11-04'].value, 1, 'today so far is not the live count since midnight UTC')
    for (const b of bars.filter((x) => x.kind === 'none' || x.kind === 'missed')) {
      assert.equal(b.value, null, `${b.day} has a number, and nothing was counted`)
      assert.equal(barPoints(b), STUB_HEIGHT)
      assert.doesNotMatch([barLabel(b), ...dayLine(b, { first })].join(' '), /\b0\b|nobody/, `${b.day} reads as a zero`)
    }
    assert.match(dayLine(by['2026-10-31'], { first }).join(' '), /^Oct 31: no record yet\. Counting began Nov 1\.$/)
    assert.match(dayLine(by['2026-11-02'], { first }).join(' '), /^Nov 2: not counted that day\.$/)
    assert.equal(barLabel(by['2026-11-02']), 'Nov 2, not counted')

    /* Heights against the busiest day shown; a real zero is a thin line, not the stub. */
    assert.equal(most, 6)
    assert.equal(by['2026-11-03'].height, 1)
    assert.equal(barPoints(by['2026-11-03']), CHART_HEIGHT)
    assert.equal(barPoints(by['2026-11-01']), 2)
    assert.ok(bars.every((b) => b.height === null || (b.height >= 0 && b.height <= 1)))
    assert.equal(scaleLine(most), 'Most in one day: 6')
    assert.deepEqual(axisLabels(bars), ['Oct 6', 'Oct 20', 'Nov 4'])

    /* A kept day says its three numbers, where they were, and a night RevenueCat was short. */
    const line = dayLine(by['2026-11-03'], { first, offset: -420 })
    assert.equal(line[0], 'Nov 3: 6 people that day, 9 in the 7 days to then, 15 in the 30 days to then.')
    assert.equal(line[1], 'That day: iPhone app 6.')
    assert.match(line[2], /^RevenueCat didn’t answer about 2 people when the day was counted, so the numbers may be a little low\.$/)
    assert.equal(line.length, 3)
    assert.equal(dayLine(by['2026-11-04'], { offset: -420 })[0], 'Nov 4 so far: 1 person. The day is kept at 4:53 pm here.')
    for (const b of bars) assert.doesNotMatch([barLabel(b), ...dayLine(b, { first })].join(' '), NEVER)
    /* RevenueCat missing a quarter or more of the month's people is not "a little". */
    const short = (missed) => dayLine(dayBars({ ...answer, days: [row('2026-11-03', 6, { unanswered: missed })] }, now).bars.find((b) => b.day === '2026-11-03'), { offset: -420 }).at(-1)
    assert.match(short(3), /may be a little low\.$/)
    assert.equal(short(4), 'RevenueCat didn’t answer about 4 people when the day was counted, so that day’s numbers are low, maybe by a lot.')
    assert.match(short(15), /maybe by a lot\.$/)

    /* A day with one person is drawn taller than a real zero, however busy the busiest day. */
    const busy = dayBars({ ...answer, days: [row('2026-11-03', 200), row('2026-11-02', 1), row('2026-11-01', 0)] }, now).bars
    const of = (day) => busy.find((b) => b.day === day)
    assert.equal(barPoints(of('2026-11-01')), ZERO_HEIGHT)
    assert.ok(barPoints(of('2026-11-02')) >= LEAST_HEIGHT && LEAST_HEIGHT > ZERO_HEIGHT, 'one person draws like nobody')
    assert.equal(barPoints(of('2026-11-03')), CHART_HEIGHT)

    /* Today, once the night has kept it, is the kept number, not the live one. */
    const late = Date.UTC(2026, 10, 4, 23, 58)
    const keptToday = dayBars({ ...fixture(late), days: [row('2026-11-04', 9, { computed_at: '2026-11-04T23:53:40Z' }), ...days] }, late).bars.at(-1)
    assert.equal(keptToday.kind, 'counted')
    assert.equal(keptToday.value, 9)
    assert.ok(!keptToday.early)

    /* A count asked for by hand during the day is only a first look: today stays so far, the live count or the first look's if more. */
    const early = (n) => dayBars({ ...answer, days: [row('2026-11-04', n, { computed_at: '2026-11-04T04:00:00Z' }), ...days] }, now).bars.at(-1)
    assert.equal(early(0).kind, 'so-far', 'a count made at 4 am UTC is drawn as the day’s number')
    assert.equal(early(0).value, 1, 'today so far is not the live count')
    assert.equal(early(9).value, 9)
    assert.equal(dayLine(early(0), { offset: -420 })[0], 'Nov 4 so far: 1 person. The day is kept at 4:53 pm here.')
    assert.equal(barLabel(early(0)), 'Nov 4 so far, 1 person')

    /* After the night's counts, with none come through, today says so rather than promising a time gone by. */
    const missedNight = dayBars({ ...fixture(late), days }, late).bars.at(-1)
    assert.equal(missedNight.kind, 'so-far')
    assert.ok(missedNight.over)
    assert.equal(dayLine(missedNight, { offset: -420 })[0], 'Nov 4 so far: 1 person. The day’s count didn’t come through, so this day won’t be kept.')
    const firstOnly = dayBars({ ...fixture(late), days: [row('2026-11-04', 1, { computed_at: '2026-11-04T03:38:00Z' }), ...days] }, late).bars.at(-1)
    assert.equal(dayLine(firstOnly, { offset: -420 })[0], 'Nov 4 so far: 1 person. The day’s count didn’t come through, so the day keeps the one made at 8:38 pm here.')
    assert.ok(!dayBars({ ...fixture(late), days }, Date.UTC(2026, 10, 4, 23, 54)).bars.at(-1).over, 'the 23:53 count is said to have failed while it may still be running')
    /* And a past day kept only by its first look says when it was counted. */
    const pastEarly = dayBars({ ...answer, days: [row('2026-11-03', 6, { computed_at: '2026-11-03T09:00:00Z' })] }, now).bars.find((b) => b.day === '2026-11-03')
    assert.equal(pastEarly.kind, 'counted')
    assert.equal(pastEarly.early, true)
    assert.deepEqual(dayLine(pastEarly, { offset: -420 }).slice(1), ['That day: iPhone app 6.', 'Counted at 2 am here, before the day was over, so it may be low.'])

    /* The days could not be read just now: the days before today are neither zeros nor "no record yet", because the records are there. */
    const unread = dayBars({ ...answer, days: null, daysError: true }, now)
    assert.ok(unread.bars.slice(0, -1).every((b) => b.kind === 'unread' && b.value === null && barPoints(b) === STUB_HEIGHT))
    assert.equal(unread.bars.at(-1).kind, 'so-far')
    for (const b of unread.bars.slice(0, -1)) {
      const said = [barLabel(b), ...dayLine(b, { first: unread.first })].join(' ')
      assert.doesNotMatch(said, /\b0\b|nobody|no record/, `${b.day} reads as a zero or as never counted`)
    }
    assert.equal(dayLine(unread.bars[0])[0], 'Oct 6: couldn’t be read just now.')

    /* Nothing kept yet: every day before today is no record yet, and nothing is a zero but a real one. */
    const empty = dayBars({ ...answer, days: [] }, now)
    assert.ok(empty.bars.slice(0, -1).every((b) => b.kind === 'none' && b.value === null))
    assert.equal(empty.bars.at(-1).kind, 'so-far')
    /* Everybody's zero: nothing divides by it, every bar is a floor line. */
    const nobody = dayBars({ ok: true, people: [], days: [row('2026-11-03', 0)] }, now)
    assert.equal(nobody.most, 0)
    assert.ok(nobody.bars.filter((b) => b.value !== null).every((b) => b.height === 0 && barPoints(b) === 2))
    /* A day from a wrong clock, after today, is not drawn. */
    assert.equal(dayBars({ ...answer, days: [row('2026-11-09', 50)] }, now).most, 1)
  })

  test('Day by day: days are labelled by the UTC calendar, wherever the device is, and the note says when midnight UTC is here', async () => {
    const { dayBars, dayOf, utcNote, hereAt, daysProblem, offsetHere } = await import('../shared/admin.mjs')
    /* 02:00 UTC on the 4th: still the 3rd in Denver, already the 4th in India. */
    const now = Date.UTC(2026, 10, 4, 2, 0)
    for (const [tz, local] of [['America/Denver', 'Nov 3, 2026'], ['Asia/Kolkata', 'Nov 4, 2026'], ['UTC', 'Nov 4, 2026']]) {
      await inZone(tz, () => {
        assert.equal(dayOf(now), local, `${tz} is not where this test thinks`)
        const { bars } = dayBars({ ok: true, people: [], days: [] }, now)
        assert.equal(bars.at(-1).label, 'Nov 4', `${tz}: the newest day is labelled by this device’s calendar, not the day it is`)
        assert.equal(bars[0].label, 'Oct 6')
      })
    }
    await inZone('America/Denver', () => assert.equal(offsetHere(now), -420))

    assert.equal(hereAt(0, 0, -420), '5 pm')
    assert.equal(hereAt(23, 53, -420), '4:53 pm')
    assert.equal(hereAt(0, 0, 330), '5:30 am')
    assert.equal(hereAt(23, 53, 330), '5:23 am')
    assert.equal(hereAt(0, 0, 0), 'midnight')
    assert.equal(hereAt(12, 0, 0), 'noon')
    assert.equal(hereAt(23, 53, 0), '11:53 pm')
    assert.equal(utcNote(now, -420), 'Each day runs midnight to midnight UTC, which is 5 pm to 5 pm here, and is counted at 4:53 pm, a few minutes before it ends, so it won’t always match Today above.')
    assert.match(utcNote(now, 330), /which is 5:30 am to 5:30 am here, and is counted at 5:23 am/)
    assert.equal(utcNote(now, 0), 'Each day runs midnight to midnight UTC, the same as here, and is counted at 11:53 pm, a few minutes before it ends.')

    /* What Day by day is waiting for, in plain words. */
    assert.match(daysProblem({ ok: true, people: [] }, now, -420), /needs the server update that goes with it/)
    assert.match(daysProblem({ ok: true, people: [], days: null }, now, -420), /needs the database change that goes with it/)
    assert.equal(daysProblem({ ok: true, people: [], days: null, daysError: true }, now, -420), 'The days kept couldn’t be read just now. Refresh to try again.')
    assert.equal(daysProblem({ ok: true, people: [], days: [] }, now, -420), 'Nothing has been kept yet. The first day is counted at 4:53 pm here.')
    assert.equal(daysProblem({ ok: true, people: [], days: [{ day: '2026-11-03' }] }, now, -420), null)
    assert.equal(daysProblem({ ok: false, message: 'Not allowed.' }), null)
    for (const s of [utcNote(now, -420), utcNote(now, 0), daysProblem({ ok: true }, now, 0), daysProblem({ ok: true, days: [] }, now, 0)]) assert.doesNotMatch(s, NEVER)
  })

  test('Day by day: a tap anywhere on the chart picks the day under it', async () => {
    const { barAt } = await import('../shared/admin.mjs')
    assert.equal(barAt(0, 300, 30), 0)
    assert.equal(barAt(299.9, 300, 30), 29)
    assert.equal(barAt(150, 300, 30), 15)
    assert.equal(barAt(9.9, 300, 30), 0, 'a tap on the right half of the first bar picks the second')
    assert.equal(barAt(19.9, 300, 30), 1)
    assert.equal(barAt(-5, 300, 30), 0)
    assert.equal(barAt(400, 300, 30), 29)
    assert.equal(barAt(10, 0, 30), 29, 'before the chart is measured, a tap should land on today')
  })

  test('Day by day: the phone draws it under People with plain views and the theme’s own colours, for him alone', () => {
    const tool = read('mobile/src/components/UsageTool.js')
    const body = code(tool)
    /* Inside the People tool, after its first section, from the same one answer: no second fetch. */
    assert.match(body, /usageSections\(said\)\.map\(\(s, i\) => \([\s\S]*?\{i === 0 \? <DayBars answer=\{said\} \/> : null\}/, 'Day by day is not drawn under People who used it')
    assert.equal((body.match(/action: 'usage'/g) || []).length, 1, 'the page asks the server twice')
    assert.match(body, /^function DayBars\(\{ answer \}\)/m)
    /* No drawing library: React Native's own views, and only these imports. */
    const imports = [...tool.matchAll(/^import [\s\S]*? from '([^']+)'/gm)].map((m) => m[1])
    assert.deepEqual(imports.filter((m) => !m.startsWith('.')), ['react', 'react-native'], 'the chart brings in a package')
    const chart = body.slice(body.indexOf('function DayBars'))
    assert.doesNotMatch(chart, /color\.(signal|live|ok|fault|ble)\b/, 'the chart uses a colour that means something else in this app')
    assert.doesNotMatch(chart, /#[0-9a-f]{3,8}\b|rgba?\(/i, 'the chart has a colour of its own instead of the theme’s')
    /* A day with no number is outlined in the dim text colour: the rule's all but vanishes on the dark panel (#262b33 on #15181d). */
    assert.match(chart, /empty\s*\? \{[^}]*borderColor: color\.silkDim,[^}]*opacity: chosen \? 1 : 0\.5[^}]*\}/, 'the no-record outline is drawn in a colour that does not show in the dark')
    /* The whole chart is the one thing to tap, a thumb tall at least, measured across itself. */
    assert.match(chart, /<Pressable[\s\S]*?onPress=\{\(e\) => setPicked\(barAt\(e\.nativeEvent\.locationX, width, bars\.length\)\)\}[\s\S]*?style=\{\{ height: CHART_HEIGHT/)
    assert.match(chart, /<View pointerEvents="none"/, 'a tap is measured inside one bar instead of across the chart')
    assert.match(chart, /accessibilityRole="adjustable"/)
    const tall = Number(read('shared/admin.mjs').match(/export const CHART_HEIGHT = (\d+)/)?.[1])
    const thumb = Number(read('mobile/src/lib/theme.js').match(/export const TAP = (\d+)/)?.[1])
    assert.ok(thumb > 0 && tall >= thumb, 'the chart is smaller than a thumb')
    /* Every word on it comes from shared/admin.mjs. */
    assert.doesNotMatch(chart, />[A-Za-z][^<{]*</, 'the chart writes words of its own')
    /* Only the Developer tools import their words: the chart lives in UsageTool, not in a file of its own. */
    assert.ok(!readdirSync(new URL('../mobile/src/components/', import.meta.url)).includes('DayBars.js'))
  })

  test('Day by day: the counting rule is copied, never retyped, to the phone and beside the server’s functions', async () => {
    const { state } = await import('../scripts/sync-relay-rules.mjs')
    const files = state()
    for (const target of ['../mobile/src/lib/usage-count.js', '../supabase/functions/_shared/usage-count.mjs']) {
      const f = files.find((x) => x.target === target)
      assert.ok(f, `${target} is not kept in step with shared/usage-count.mjs`)
      assert.equal(f.source, '../shared/usage-count.mjs')
      assert.equal(f.copyText, f.expected, `${target} is stale — run \`npm run sync:rules\``)
    }
    assert.match(read('mobile/src/lib/admin.js'), /from '\.\/usage-count\.js'/, 'the phone’s admin.js imports a file the phone does not have')
    const grant = code(read('supabase/functions/grant-access/index.ts'))
    assert.match(grant, /import \{ dayCounts \} from '\.\.\/_shared\/usage-count\.mjs'/)
    assert.match(grant, /const counts = dayCounts\(answer, Date\.now\(\)\)/)
    assert.match(grant, /const answer = await usage\(\{ history: false \}\)/, 'the night counts something other than what People counts')
    /* And the README sends the copy with the function. */
    assert.match(read('supabase/README.md'), /`_shared\/usage-count\.mjs`/)
  })

  test('Day by day: the table keeps totals only, behind grant-access, and only today can be written', async () => {
    const sql = sqlOf(TABLE_SQL)
    const raw = read(TABLE_SQL)
    /* Every column, pinned: a column that could hold somebody fails here first. */
    const body = raw.slice(raw.indexOf('create table if not exists public.usage_days ('))
    const columns = [...body.slice(0, body.indexOf(');')).matchAll(/^\s+(\w+) (?:date|integer|jsonb|timestamptz)/gm)].map((m) => m[1])
    assert.deepEqual(columns, ['day', 'active_day', 'active_7', 'active_30', 'accounts', 'counted', 'unanswered', 'places', 'versions', 'systems', 'computed_at'], 'what a day keeps changed; the privacy page says totals only')
    assert.doesNotMatch(body.slice(0, body.indexOf(');')), /uuid|text\b|references|email|account_id|user_id/, 'a day can hold who somebody is')
    assert.match(sql, /create table if not exists public\.usage_days \( day date primary key,/)
    for (const part of ['places', 'systems']) {
      assert.match(sql, new RegExp(`${part} jsonb not null default '\\{\\}'::jsonb check \\(public\\.usage_breakdown_ok\\(${part}\\)\\)`), `${part} can hold something that is not a count`)
    }
    assert.match(sql, /versions jsonb not null default '\{\}'::jsonb check \(public\.usage_breakdown_ok\(versions, '\^/, 'an app version can be any words')
    /* The breakdown's shape: day and month only, 40 labels of 40 letters, whole numbers of nought or more. */
    const ok = sql.slice(sql.indexOf('create or replace function public.usage_breakdown_ok'), sql.indexOf('create table'))
    assert.match(ok, /if part\.key not in \('day', 'month'\)/)
    assert.match(ok, /> 40 then return false/)
    assert.match(ok, /^create or replace function public\.usage_breakdown_ok\(b jsonb, shape text default null\) returns boolean language plpgsql immutable/)
    assert.match(ok, /length\(entry\.key\) not between 1 and 40 or \(shape is not null and entry\.key !~ shape\) or jsonb_typeof\(entry\.value\) <> 'number' or \(entry\.value #>> '\{\}'\)::numeric < 0 or \(entry\.value #>> '\{\}'\)::numeric <> trunc/)

    /* Nobody but the server: row level security on, no policy, nothing granted to a client. */
    assert.match(sql, /alter table public\.usage_days enable row level security; revoke all on table public\.usage_days from public, anon, authenticated;/)
    assert.doesNotMatch(sql, /create policy/i)
    assert.doesNotMatch(sql, /grant [^;]* to [^;]*\b(anon|authenticated|public)\b/i, 'a client is given something')

    /* Every function: its own search path, nobody but service_role, and the four that act as the owner say so. */
    const made = [...sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map((m) => [m[1], m[2]])
    assert.deepEqual(made.map((m) => m[0]), ['usage_breakdown_ok', 'record_usage_day', 'owner_usage_days', 'usage_day_hook_secret', 'run_usage_day'])
    for (const [name] of made) {
      const head = sql.slice(sql.indexOf(`create or replace function public.${name}(`)).split(' as $$')[0]
      assert.match(head, /set search_path = ''/, `${name} has no fixed search path`)
      if (name !== 'usage_breakdown_ok') assert.match(head, /security definer/, `${name} runs as whoever calls it`)
    }
    for (const sig of ['usage_breakdown_ok(jsonb, text)', 'record_usage_day(date, jsonb)', 'owner_usage_days(integer)', 'usage_day_hook_secret()', 'run_usage_day()']) {
      assert.ok(sql.includes(`revoke all on function public.${sig} from public, anon, authenticated;`), `a client can call ${sig}`)
      assert.ok(sql.includes(`grant execute on function public.${sig} to service_role;`), `the server cannot call ${sig}`)
    }

    /*
     * Only today, by the UTC calendar. A later count replaces the day: always
     * over a first look made before the night's counts begin, when it saw
     * more people, or when RevenueCat missed no more of them; so a count by
     * hand at 3 am is never the day's number, and a busy minute at
     * RevenueCat never overwrites a fuller count.
     */
    const record = sql.slice(sql.indexOf('create or replace function public.record_usage_day'), sql.indexOf('create or replace function public.owner_usage_days'))
    assert.match(record, /if d is null or d <> \(now\(\) at time zone 'utc'\)::date then raise exception/, 'a day other than today can be written')
    assert.match(
      record,
      /on conflict \(day\) do update set [^;]* where u\.computed_at < \(d \+ time '(\d\d:\d\d)'\) at time zone 'utc' or excluded\.active_day > u\.active_day or excluded\.unanswered <= u\.unanswered returning true into kept;/,
      'a first look by hand can stay the day’s number, or a count that saw more people is refused for one more RevenueCat miss'
    )
    const { COUNT_HOUR_UTC, COUNT_MINUTES_UTC, nightStarts } = await import('../shared/usage-count.mjs')
    const night = record.match(/time '(\d\d:\d\d)'/)[1]
    assert.equal(night, `${COUNT_HOUR_UTC}:${String(Math.min(...COUNT_MINUTES_UTC)).padStart(2, '0')}`, 'the table and the schedule disagree on when the night’s counts begin')
    assert.equal(new Date(nightStarts('2026-11-04')).toISOString(), `2026-11-04T${night}:00.000Z`, 'the page and the table disagree on when the night’s counts begin')
    assert.doesNotMatch(record, /delete from/, 'the two-year sweep waits for a count to succeed')
    assert.equal((sql.match(/insert into public\.usage_days/g) || []).length, 1, 'the table is written somewhere besides record_usage_day')
    assert.equal((sql.match(/delete from public\.usage_days/g) || []).length, 1)
    /* The read is the columns above and nothing else, newest first, at most 800. */
    const owner = sql.slice(sql.indexOf('create or replace function public.owner_usage_days'), sql.indexOf('do $$'))
    const named = [...owner.matchAll(/'(\w+)', u\.(\w+)/g)].map((m) => (m[1] === m[2] ? m[1] : `${m[1]}≠${m[2]}`))
    assert.deepEqual(named, columns)
    assert.match(owner, /order by day desc limit greatest\(1, least\(coalesce\(most, 31\), 800\)\)/)
  })

  test('Day by day: the nightly call carries its own secret and the app’s public key, and the schedule is the job alone', async () => {
    const sql = sqlOf(TABLE_SQL)
    const run = sql.slice(sql.indexOf('create or replace function public.run_usage_day'), sql.indexOf('revoke all on function'))
    /* Two years, then gone: swept first, at every firing, before the secret is read or anything is asked, so a failing count never stops it. */
    assert.match(run, /^create or replace function public\.run_usage_day\(\) [^$]*as \$\$ declare [^;]*; [^;]*; [^;]*; begin delete from public\.usage_days where day < \(now\(\) at time zone 'utc'\)::date - 730; select decrypted_secret/, 'the sweep is not the first thing every firing does')
    /* Its own secret, made here, read from the vault, never typed. */
    assert.match(sql, /if not exists \(select 1 from vault\.decrypted_secrets where name = 'usage_day_hook_secret'\) then perform vault\.create_secret\( encode\(extensions\.gen_random_bytes\(32\), 'hex'\), 'usage_day_hook_secret',/)
    assert.match(run, /where name = 'usage_day_hook_secret'/)
    assert.match(run, /if hook_secret is null then raise log [^;]*; return; end if;/)
    assert.match(run, /begin perform net\.http_post\( url := fn_url, [^;]*\); exception when others then raise log/, 'the call is not inside an exception block')
    assert.doesNotMatch(sql, /extensions\.net\.http_post/)
    assert.match(run, /body := jsonb_build_object\('action', 'usage-day'\), timeout_milliseconds := 120000/)
    assert.match(run, /'Authorization', 'Bearer ' \|\| public_key, 'apikey', public_key, 'x-hook-secret', hook_secret/)
    /* The public key is the one the app ships, at the project the app signs into, so a changed key fails here rather than silently every night. */
    const project = read('mobile/src/lib/project.js')
    const anonKey = project.match(/anonKey:\s*'([^']+)'/)?.[1]
    const url = project.match(/url: '([^']+)'/)?.[1]
    assert.ok(anonKey && url)
    assert.equal(run.match(/public_key text := '([^']+)'/)?.[1], anonKey, 'the nightly call’s key is not the app’s public key')
    assert.equal(run.match(/fn_url text := '([^']+)'/)?.[1], `${url}/functions/v1/grant-access`)
    assert.equal(JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url').toString()).role, 'anon', 'the key in the migration is not the public one')
    assert.ok(!/service_role/.test(run), 'the nightly call carries the service key')
    assert.doesNotMatch(sql, /\bcron\./, 'the schedule is in the same file as the table')

    /* The schedule: the job, nothing else, at the times the page says. */
    const { COUNT_HOUR_UTC, COUNT_MINUTES_UTC } = await import('../shared/usage-count.mjs')
    assert.equal(sqlOf(SCHEDULE_SQL), `select cron.schedule('usage-days', '${COUNT_MINUTES_UTC.join(',')} ${COUNT_HOUR_UTC} * * *', $$select public.run_usage_day()$$);`)
    assert.deepEqual([COUNT_HOUR_UTC, COUNT_MINUTES_UTC], [23, [43, 53]])
    assert.ok(TABLE_SQL < SCHEDULE_SQL, 'the schedule would be applied before the table it fills')
    /* Nothing else asks at those minutes: the setup emails are at :23. */
    const others = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter((f) => f !== SCHEDULE_SQL.split('/').pop()).map((f) => read(`supabase/migrations/${f}`))
    for (const text of others) for (const m of text.matchAll(/cron\.schedule\('[^']+', '([^']+)'/g)) assert.ok(!COUNT_MINUTES_UTC.some((x) => m[1].split(' ')[0].split(',').includes(String(x))), `another job runs at ${m[1]}`)

    /* And the README puts the function out before the schedule. */
    const readme = read('supabase/README.md')
    const live = readme.slice(readme.indexOf('## How many people, day by day'))
    const at = (s) => live.indexOf(s)
    assert.ok(at('**Apply `20261104_usage_days.sql`.**') > 0)
    /* Merged, with every check green, before the function is deployed, so what runs is what is on GitHub. */
    assert.ok(at('**Apply `20261104_usage_days.sql`.**') < at('**Merge the app change, with every check green**'))
    assert.ok(at('**Merge the app change, with every check green**') < at("**Deploy grant-access from the merged commit's files**"), 'the function is deployed before the change it carries is merged')
    assert.ok(at('**Deploy grant-access from the merged commit') < at('select public.run_usage_day();'))
    assert.match(live, /This\s+count is only a first look at the day/, 'the README does not say the count by hand is replaced at night')
    assert.match(live, /select id, status_code, timed_out, error_msg, left\(content, 200\), created\s+from net\._http_response/, 'the check cannot show why a call got no answer')
    assert.match(live, /If the `usage-days` job is ever\s+taken off the schedule, empty or drop `public\.usage_days` in the same\s+change/)
    assert.ok(at('select public.run_usage_day();') < at('**Apply `20261104_usage_days_schedule.sql`.**'), 'the README schedules the count before the function that answers it')
  })

  test('Day by day: the privacy page says the day’s totals are kept, name nobody, and for how long', () => {
    const words = read('public/privacy.html').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    assert.match(words, /How many people — how many accounts were used today, in the last 7 days and in the last 30, on which kinds of device, on which app versions and on which versions of the phone's system; and the same totals for each day, kept once a day\. Counts, naming nobody\./)
    assert.match(words, /Once a day, a few minutes before the day ends \(UTC\), that day's totals are kept, as numbers that name nobody, so he can see them day by day\./)
    assert.doesNotMatch(words, /each night|Each night/, 'the privacy page says night, and the count runs in the afternoon across the Americas')
    const kept = words.slice(words.indexOf('How long it is kept'), words.indexOf('Deleting your data'))
    assert.match(kept, /Each day's totals on How many people — numbers only, naming nobody, kept two years, then deleted\./)
    assert.match(sqlOf(TABLE_SQL), /delete from public\.usage_days where day < \(now\(\) at time zone 'utc'\)::date - 730;/, 'the page says two years and the table keeps another length')
    const when = words.match(/last updated (\d{1,2} \w+ 2026)/)?.[1]
    assert.ok(when && Date.parse(`${when} UTC`) >= Date.parse('4 November 2026 UTC'), `the privacy page still says it was last updated ${when}`)
    /* And the label change is put to Justin as needed, in his words, and not marked done. */
    const store = read('docs/app-store.md')
    const at = store.indexOf('**4 November 2026: one tick needed, for How many people.**')
    assert.ok(at > 0, 'docs/app-store.md does not put the Analytics tick to Justin')
    const note = store.slice(at, at + 2000).replace(/\s+/g, ' ')
    assert.match(note, /in App Store Connect → App Privacy → Usage Data → Product Interaction, tick \*\*Analytics\*\* next to App Functionality \(still linked to the user, still not tracking\)/)
    assert.match(note, /Done 5 November 2026 \(Justin\)\./)
    assert.doesNotMatch(note, /to consider|Justin's call/, 'the tick is still put to him as optional, and the label says less than the privacy page')
  })
}
