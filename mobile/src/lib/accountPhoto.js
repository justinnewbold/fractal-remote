import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { toByteArray } from 'base64-js'

import { supabaseClient } from './relay'
import { isPairAccount } from './pairing'
import { base64Bytes } from './report-rules'
import { logDebug } from './debugLog'
import {
  PHOTO_BUCKET,
  PHOTO_BYTES,
  PHOTO_EDGE,
  PHOTO_KEY,
  PHOTO_QUALITIES,
  PHOTO_WORDS,
  jpegBase64,
  keepPhoto,
  keptPhoto,
  photoGone,
  photoPath,
  photoUri
} from './profile-photo'

/**
 * The signed-in account's profile photo, for the top bar's circle and the
 * account sheet (shared/profile-photo.mjs says where it is kept and why).
 *
 * One small store: `{ id, uri }`, the account it is for (null when nobody is
 * signed in to a real account here) and the photo as a data address (null
 * for the silhouette). App.js says who is signed in (showPhotoFor), Settings
 * changes it (choosePhoto, removePhoto), and the top bar only reads it.
 *
 * NO SIGNAL, NO DIFFERENCE. The copy kept on the device is read first and
 * shown at once; the bucket is asked afterwards, once per account each time
 * the app runs, and only a bucket that says there is no photo takes it away.
 * A refused or missing pass, a sign-in being renewed or no answer at all
 * leaves the copy where it is.
 *
 * Nothing new is installed: the picker and the drawing-again are the two the
 * report screen already uses (lib/shots.js), so this rides an update.
 */
let state = { id: null, uri: null }
const listeners = new Set()
/* Which account the bucket has been asked about since the app started, and a count of changes made here, so a slow answer cannot undo one. */
let fetchedFor = null
let changes = 0
/* A count of showPhotoFor's calls, so only the latest one's answer is shown: a sign-out cannot be undone by a read of the disk still under way. */
let asking = 0

const publish = (next) => {
  state = next
  for (const fn of listeners) fn()
}
const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const read = () => state

/** `{ id, uri }`: the account the top bar draws a circle for, and its photo or null. */
export const useProfilePhoto = () => useSyncExternalStore(subscribe, read, read)

/* The copy on the device, read and written without ever throwing: a disk that refuses is no photo, never a crash. */
async function readKept(id) {
  try {
    return keptPhoto(await AsyncStorage.getItem(PHOTO_KEY), id)
  } catch {
    return null
  }
}
async function writeKept(id, uri) {
  try {
    if (uri) await AsyncStorage.setItem(PHOTO_KEY, keepPhoto(id, uri))
    else await AsyncStorage.removeItem(PHOTO_KEY)
  } catch {
    /* The top bar still shows it until the app is closed; the next launch asks the bucket again. */
  }
}

/** A Blob as its base64, by the reader React Native has (readAsDataURL). */
const blobBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('unreadable'))
    reader.readAsDataURL(blob)
  })

/*
 * THE BUCKET'S COPY, fetched with the account's own pass: only when the
 * sign-in supabase-js holds is this account's, so a missing or renewing pass
 * is never read as "there is no photo" (the bucket answers a file nobody may
 * see as not found).
 */
async function fetchPhoto(id, at) {
  const path = photoPath(id)
  if (!path) return
  try {
    const c = supabaseClient()
    const { data: held } = await c.auth.getSession()
    if (held?.session?.user?.id !== id) return
    const { data, error } = await c.storage.from(PHOTO_BUCKET).download(path)
    if (state.id !== id || changes !== at) return
    if (error) {
      if (photoGone(error)) {
        publish({ id, uri: null })
        await writeKept(id, null)
      } else logDebug('account', 'profile photo not fetched', error?.message || String(error))
      return
    }
    const uri = photoUri(await blobBase64(data))
    if (!uri || state.id !== id || changes !== at) return
    publish({ id, uri })
    await writeKept(id, uri)
  } catch (err) {
    logDebug('account', 'profile photo not fetched', err?.message || String(err))
  }
}

/**
 * Who is signed in on this device now, as App.js knows it: `{ id, email }`,
 * or null for nobody. A pairing code's account is nobody here (it has no
 * account sheet to open). Nobody also takes the device's copy off it, so a
 * photo does not stay behind a sign-out; another account's copy goes too.
 */
export async function showPhotoFor(account) {
  const id = account?.id && !isPairAccount(account.email) ? account.id : null
  const ask = ++asking
  if (!id) {
    fetchedFor = null
    publish({ id: null, uri: null })
    await writeKept(null, null)
    return
  }
  if (state.id !== id) {
    const kept = await readKept(id)
    if (ask !== asking) return
    publish({ id, uri: kept })
    if (!kept) await writeKept(null, null)
  }
  if (fetchedFor === id) return
  fetchedFor = id
  await fetchPhoto(id, changes)
}

/*
 * THE PICTURE PICKED, AS THE PHOTO: drawn again square, from the middle of
 * whatever the picker handed back, at PHOTO_EDGE a side, then saved as a
 * JPEG at the first of PHOTO_QUALITIES under PHOTO_BYTES. Its base64, or
 * null when no quality was small enough. Throws when it cannot be opened.
 */
async function squarePhoto(uri) {
  const opened = ImageManipulator.manipulate(uri)
  let whole = null
  let squared = null
  let made = null
  try {
    /* Its own size, as drawn the right way up, rather than what the picker said. */
    whole = await opened.renderAsync()
    const side = Math.min(whole.width, whole.height)
    squared = ImageManipulator.manipulate(whole)
    if (whole.width !== whole.height && side > 0) {
      squared.crop({ originX: Math.floor((whole.width - side) / 2), originY: Math.floor((whole.height - side) / 2), width: side, height: side })
    }
    squared.resize({ width: PHOTO_EDGE, height: PHOTO_EDGE })
    made = await squared.renderAsync()
    for (const compress of PHOTO_QUALITIES) {
      const saved = await made.saveAsync({ format: SaveFormat.JPEG, compress, base64: true })
      const b64 = jpegBase64(saved.base64)
      if (b64 && base64Bytes(b64) <= PHOTO_BYTES) return b64
    }
    return null
  } finally {
    made?.release?.()
    squared?.release?.()
    whole?.release?.()
    opened.release?.()
  }
}

/**
 * ADD A PHOTO, OR CHANGE IT: the phone's own picker, which asks no
 * permission and hands over only the picture picked, with its square crop
 * (allowsEditing), then the bucket, then the copy here and the top bar.
 * Answers true when a photo was saved, false when the picker was closed;
 * throws a sentence for the account sheet when it could not be.
 */
export async function choosePhoto({ onPicked = null } = {}) {
  const id = state.id
  const path = photoPath(id)
  if (!path) throw new Error(PHOTO_WORDS.notSaved)
  let picked
  try {
    picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1, exif: false })
  } catch {
    throw new Error(PHOTO_WORDS.unreadable)
  }
  const asset = picked?.canceled ? null : picked?.assets?.[0]
  if (!asset?.uri) return false
  onPicked?.()
  let b64
  try {
    b64 = await squarePhoto(asset.uri)
  } catch {
    throw new Error(PHOTO_WORDS.unreadable)
  }
  if (!b64) throw new Error(PHOTO_WORDS.tooBig)
  const bytes = toByteArray(b64)
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  try {
    const { error } = await supabaseClient().storage.from(PHOTO_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: true, cacheControl: '0' })
    if (error) throw error
  } catch (err) {
    logDebug('account', 'profile photo not saved', err?.message || String(err))
    throw new Error(PHOTO_WORDS.notSaved)
  }
  changes += 1
  if (state.id !== id) return true
  const uri = photoUri(b64)
  publish({ id, uri })
  await writeKept(id, uri)
  logDebug('account', 'profile photo saved')
  return true
}

/** REMOVE PHOTO: out of the bucket, then off the device and the top bar. Throws a sentence when the bucket could not be reached. */
export async function removePhoto() {
  const id = state.id
  const path = photoPath(id)
  if (!path) return
  try {
    const { error } = await supabaseClient().storage.from(PHOTO_BUCKET).remove([path])
    if (error) throw error
  } catch (err) {
    logDebug('account', 'profile photo not removed', err?.message || String(err))
    throw new Error(PHOTO_WORDS.notRemoved)
  }
  changes += 1
  if (state.id !== id) return
  publish({ id, uri: null })
  await writeKept(id, null)
  logDebug('account', 'profile photo removed')
}
