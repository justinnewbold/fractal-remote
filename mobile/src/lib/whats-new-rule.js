import { isOlder } from './versions.js'

/**
 * WHAT'S NEW, WITH THE UPDATE THAT IS WAITING FOR A RESTART.
 *
 * "On the card that says a new version of the app is available. Can you have
 * a link that says what's new? And have that be a link that takes them
 * straight to the part of the app that shows them what's new?" (Justin,
 * 6 November 2026.)
 *
 * The list What's new draws travels inside each update (lib/whatsNew.js), so
 * while a downloaded update waits for a restart, the list on screen is the
 * running one's, one update short: exactly the lines the card is offering are
 * missing. The website keeps the same list as JSON (public/whats-new.json,
 * from shared/whats-new.json by npm run sync:rules), and the page reads it
 * (lib/whatsNewWaiting.js) and puts the newer days on top here.
 *
 * Only what is newer than the list on the phone, and nothing newer than the
 * update that is waiting: a day the phone does not have, or the same day at a
 * newer version, which takes the place of the phone's copy of it. Anything the
 * file gets wrong is left out, and with no file at all the list is the
 * phone's own, as it always was.
 */

/** The words that are the same on both cards. */
export const WHATS_NEW_LINK = 'What’s new'
/** The Settings page the link opens (Settings.js `page`). */
export const WHATS_NEW_PAGE = 'whats-new'
/** The website's copy, beside its page. */
export const WHATS_NEW_JSON_URL = 'https://fractal.newbold.cloud/whats-new.json'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const VERSION = /^\d+\.\d+\.\d+$/

/** The file's days as this phone shows them (lib/whatsNew.js daysFor), with anything malformed left out. */
export function daysFromFile(file, os) {
  const days = Array.isArray(file?.days) ? file.days : []
  const out = []
  for (const d of days) {
    if (!d || !DATE.test(String(d.date)) || !VERSION.test(String(d.version)) || typeof d.day !== 'string' || !Array.isArray(d.lines)) continue
    const lines = d.lines
      .filter((l) => l && typeof l.text === 'string' && l.text.trim() && (!l.only || l.only === os))
      .map((l) => l.text)
    if (lines.length) out.push({ date: d.date, day: d.day, version: d.version, lines })
  }
  return out
}

/**
 * The phone's days with the file's newer ones on top, newest first, one of
 * each day. `upTo` is the waiting update's version: nothing newer than it is
 * taken, since the website can be ahead of the download. Null takes the file
 * as it is.
 */
export function withWaiting(bundled, fetched, { upTo = null } = {}) {
  const mine = Array.isArray(bundled) ? bundled : []
  const newest = mine.reduce((top, d) => (d.date > top ? d.date : top), '')
  const byDate = new Map(mine.map((d) => [d.date, d]))
  for (const d of Array.isArray(fetched) ? fetched : []) {
    if (upTo && isOlder(upTo, d.version) !== false) continue
    const have = byDate.get(d.date)
    if (have ? isOlder(have.version, d.version) === true : d.date > newest) byDate.set(d.date, d)
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
