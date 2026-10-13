import { isOlder } from './versions.js'

/**
 * WHETHER THIS PHONE'S COPY OF THE APP IS OLDER THAN THE STORE'S, as pure
 * functions and nothing else.
 *
 * Over-the-air updates only reach a copy whose insides match the update. When
 * a new store version changes those insides, every copy still on the version
 * before stops getting updates — and nothing told them. Some Android phones
 * were still on 1.87.1 when 1.87.11 was on Google Play. So the app now says
 * so: a quiet line under Settings → About → Updates for as long as it is
 * true, and a card at the top of Settings once per store version.
 *
 * Two numbers are compared. The installed STORE version is the one built into
 * the copy on the phone (lib/storeVersion.js reads it); it never changes with
 * an update, which is the point. The newest store version comes from
 * public/store-versions.json on the website, which the project moves on the
 * day a version goes live in a store (docs/expo-builds.md says when). Anything
 * that cannot be read — no number, a number that is not three plain parts, a
 * file that did not answer — is no note at all: telling somebody to update a
 * copy that is current is worse than saying nothing.
 *
 * Nothing here imports more than the versions helper the rest of the app
 * already shares, so test/mobile.mjs calls it directly.
 */

/** The file on the website. Fetched at most once a day; see lib/storeVersion.js. */
export const STORE_VERSIONS_URL = 'https://fractal.newbold.cloud/store-versions.json'

/** A day, between asks. */
export const ASK_EVERY_MS = 24 * 60 * 60 * 1000

/** The app's own page in each store. Plain web links: both open the store app on a phone that has it. */
export const STORE_PAGE = {
  ios: 'https://apps.apple.com/app/id6812916461',
  android: 'https://play.google.com/store/apps/details?id=cloud.newbold.fractalremote'
}

/** Google Play's own way in, tried first on Android; the web page above if nothing answers it. */
export const PLAY_APP_LINK = 'market://details?id=cloud.newbold.fractalremote'

/*
 * Each platform's own store, picked by the platform the caller passes
 * (lib/storeVersion.js passes Platform.OS): an iPhone is only ever given the
 * App Store's words, and Apple's 2.3.10 asks no less.
 */
const STORE_NAME = { ios: 'the App Store', android: 'Google Play' }
const STORE_WHERE = { ios: 'in the App Store', android: 'on Google Play' }
const STORE_ROW = { ios: 'App Store', android: 'Google Play' }
const STORE_BUTTON = { ios: 'Open the App Store', android: 'Open Google Play' }

const plain = (v) => (typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v.trim()) ? v.trim() : null)

/** The newest version the file gives for this platform, or null. */
export function newestFrom(file, platform) {
  if (!file || typeof file !== 'object') return null
  return plain(file[platform])
}

/**
 * What to say, or null for nothing. `platform` is 'ios' or 'android';
 * `installed` the store version built into this copy; `newest` the store's.
 */
export function storeNote({ platform, installed, newest } = {}) {
  if (!STORE_PAGE[platform]) return null
  const mine = plain(installed)
  const theirs = plain(newest)
  if (!mine || !theirs || isOlder(mine, theirs) !== true) return null
  return {
    newest: theirs,
    page: STORE_PAGE[platform],
    store: STORE_NAME[platform],
    title: `A newer version of Fractal Remote is ${STORE_WHERE[platform]}`,
    why: 'Some fixes can only arrive with a new version from the store, so install it when you can. Your setlists and settings stay as they are.',
    button: STORE_BUTTON[platform],
    /* The quiet line under Settings → About → Updates. */
    row: STORE_ROW[platform],
    /* The row's title already names the store, and at 320 wide a longer line is cut off. */
    line: 'A newer version is out · tap to get it'
  }
}

/** The card is due when there is a note, and it has not been shown for that store version yet. */
export const cardDue = (note, seenFor) => Boolean(note) && seenFor !== note.newest

/** Time to ask the website again: never asked, a day since, or a clock that went backwards past the last ask. */
export function askDue(lastAskedAt, now) {
  const last = Number(lastAskedAt)
  if (!(last > 0)) return true
  return now - last >= ASK_EVERY_MS || now < last
}
