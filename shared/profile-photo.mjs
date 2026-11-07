/**
 * A profile photo on an account: one small square picture, the account's own.
 *
 * "Let's also add an ability to add a profile photo that also puts a little
 * profile photo up next to [the Live pill] ... in the top header bar with
 * the little circle. [People] that don't have the picture just have a
 * picture of a silhouette of a person, and if they tap that, it will take
 * them to their profile to edit it." (Justin, 7 November 2026.)
 *
 * WHERE IT GOES. Into the private bucket `profile-photos`
 * (supabase/migrations/20261107_profile_photos.sql), at one fixed place in
 * the account's own folder: `<account id>/photo.jpg`. One picture per
 * account, so changing it replaces it and nothing piles up. The bucket's
 * rules let a signed-in account put in, replace, read and remove that one
 * file and nothing else, and let nobody signed out do anything at all.
 * Deleting the account deletes it (supabase/functions/_shared/forget-account.ts).
 *
 * AND A COPY ON THE DEVICE, so the top bar shows it with no signal: the
 * JPEG itself, as a data address, under PHOTO_KEY with the account it is
 * for. It is read at launch, fetched again from the bucket at each sign-in
 * and each launch with a signal, replaced the moment the photo is changed
 * here, and taken off when nobody is signed in.
 *
 * Shared because the server's tests hold the bucket's name and the place to
 * the migration and to Delete account. Plain ESM and zero imports, for Node
 * and Metro alike; the phone's copy is mobile/src/lib/profile-photo.js, made
 * by npm run sync:rules. The browser and the computer app do not draw it.
 */

/** The private bucket, the same name in the migration and in Delete account (a test holds the three to each other). */
export const PHOTO_BUCKET = 'profile-photos'

/** The one file an account may have there, in its own folder. */
export const PHOTO_NAME = 'photo.jpg'

/** An account's photo's place: its id, then PHOTO_NAME. The bucket's rules take this and nothing else. */
export const PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/photo\.jpg$/

/** Where this account's photo goes, or null for anything that is not an account id. */
export function photoPath(accountId) {
  const path = `${String(accountId ?? '').toLowerCase()}/${PHOTO_NAME}`
  return PHOTO_PATH.test(path) ? path : null
}

/**
 * HOW BIG. A square PHOTO_EDGE pixels a side: the top bar draws it 24 points
 * across, which is 72 pixels on a sharp iPhone screen, so 256 is more than
 * enough anywhere it is shown and small enough to keep on the device. Saved
 * as a JPEG at the first of PHOTO_QUALITIES that comes in under PHOTO_BYTES
 * (a 256-pixel photo is usually 15 to 40 KB at the first). The bucket takes
 * a little more, PHOTO_BUCKET_BYTES, so a photo the app lets through is
 * never one the bucket turns away.
 */
export const PHOTO_EDGE = 256
export const PHOTO_QUALITIES = [0.8, 0.65, 0.5, 0.35]
export const PHOTO_BYTES = 100 * 1024
export const PHOTO_BUCKET_BYTES = 128 * 1024

/** Where the device keeps its own copy. */
export const PHOTO_KEY = 'fractal.profilePhoto'

/** A JPEG's base64 always begins so (its first bytes, FF D8 FF). */
const JPEG_START = '/9j/'

/** The base64 of a JPEG, from a data address or bare, or null for anything that is not one. */
export function jpegBase64(text) {
  if (typeof text !== 'string') return null
  const comma = text.startsWith('data:') ? text.indexOf(',') : -1
  const b64 = (comma >= 0 ? text.slice(comma + 1) : text).replace(/\s+/g, '')
  return b64.startsWith(JPEG_START) && /^[A-Za-z0-9+/]+={0,2}$/.test(b64) ? b64 : null
}

/** What the top bar draws: the JPEG as a data address, or null. */
export function photoUri(text) {
  const b64 = jpegBase64(text)
  return b64 ? `data:image/jpeg;base64,${b64}` : null
}

/** What the device keeps: this account's photo, as the JSON written under PHOTO_KEY. */
export function keepPhoto(id, uri, at = Date.now()) {
  return JSON.stringify({ id, uri: photoUri(uri), at })
}

/** The copy kept on the device, as the photo's address, when it is a JPEG and it is this account's; null otherwise. */
export function keptPhoto(raw, id) {
  if (!id || typeof raw !== 'string') return null
  try {
    const kept = JSON.parse(raw)
    if (!kept || typeof kept !== 'object' || kept.id !== id) return null
    return photoUri(kept.uri)
  } catch {
    return null
  }
}

/**
 * Whether the bucket said there is no photo, as opposed to not being reached.
 * Only that clears the copy on the device: no signal, a sign-in being renewed
 * or a refused pass keep it, and the top bar keeps showing it. Storage
 * answers a missing file with 404, or with 400 and a statusCode of "404"
 * ("Object not found"), depending on its version.
 */
export function photoGone(error) {
  if (!error || typeof error !== 'object') return false
  if (error.name !== 'StorageApiError') return false
  return error.status === 404 || String(error.statusCode) === '404' || /object not found/i.test(String(error.message || ''))
}

/**
 * Whether the top bar draws the circle at all: for an account somebody is
 * signed in to on this device (a real address, never a pairing code's), and
 * never in the demo, which is nobody's.
 */
export function avatarShown({ demo = false, account = null } = {}) {
  return !demo && Boolean(account?.id)
}

/** The words, in one place: the account sheet's rows, what is said after, and what goes wrong, in plain words. */
export const PHOTO_WORDS = {
  add: 'Add a photo',
  addSub: 'A small round picture at the top of the app',
  change: 'Change photo',
  changeSub: 'Pick another picture',
  remove: 'Remove photo',
  removeSub: 'Back to the plain circle',
  saving: 'Saving your photo…',
  removing: 'Removing…',
  saved: 'Photo saved.',
  removed: 'Photo removed.',
  unreadable: 'That picture couldn’t be opened. Try another one.',
  tooBig: 'That picture couldn’t be made small enough. Try another one.',
  notSaved: 'The photo couldn’t be saved. Check the internet and try again.',
  notRemoved: 'The photo couldn’t be removed. Check the internet and try again.'
}
