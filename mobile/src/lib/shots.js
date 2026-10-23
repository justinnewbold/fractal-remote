import * as Clipboard from 'expo-clipboard'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { toByteArray } from 'base64-js'

import { SHOT_BYTES, SHOT_EDGE, SHOT_PHONE_QUALITIES, SHOT_QUALITIES, base64Bytes } from './report-rules'

/**
 * A screenshot for a report, pasted from the clipboard.
 *
 * BY PASTE, AND FROM THE PHONE'S OWN PICKER. Paste came first, with no new
 * build: expo-clipboard reads a picture somebody has copied ("Copy and
 * Delete" on an iPhone, Copy on Android). Choose a screenshot opens the
 * phone's own photo picker (expo-image-picker, pickShots below), which hands
 * the app only the pictures picked, and expo-image-manipulator draws each
 * one again at SHOT_EDGE, as the browser does.
 *
 * An iPhone asks "Allow Paste?" when an app reads a picture from the
 * clipboard (iOS 16 on), unless Settings → Fractal Remote → Paste from Other
 * Apps says Allow. That is the phone's own question and it is expected; the
 * clipboard is read once per tap, and a second time only for a picture still
 * over SHOT_BYTES (shared/report-rules SHOT_PHONE_QUALITIES).
 *
 * Answers `{ shot }` or `{ why }`, where `why` is 'empty', 'refused',
 * 'tooBig' or 'unreadable', the keys of PASTE_WORDS (shared/report-rules,
 * which says what each means and what the screen says for it). Never throws.
 */
export async function pasteShot() {
  try {
    /* No prompt for this one: it asks only whether there is a picture, not for it. */
    if (!(await Clipboard.hasImageAsync())) return { why: 'empty' }
    for (const jpegQuality of SHOT_PHONE_QUALITIES) {
      const image = await Clipboard.getImageAsync({ format: 'jpeg', jpegQuality })
      /*
       * hasImageAsync has just said a picture is there, so nothing back means
       * it was not handed over: "Don't Allow Paste" on an iPhone, or Paste
       * from Other Apps set to Deny, which asks nothing. Not "there is no
       * picture": the person has just copied one.
       */
      if (!image?.data) return { why: 'refused' }
      const comma = image.data.indexOf(',')
      const b64 = comma >= 0 ? image.data.slice(comma + 1) : image.data
      const size = base64Bytes(b64)
      if (size > SHOT_BYTES) continue
      const bytes = toByteArray(b64)
      return {
        shot: {
          /* What the upload sends: the JPEG's own bytes, as the storage client takes them on a phone. */
          body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          /* What the thumbnail shows: the same picture, as the data address it came as. */
          uri: image.data,
          width: image.size?.width || 0,
          height: image.size?.height || 0,
          size
        }
      }
    }
    return { why: 'tooBig' }
  } catch {
    return { why: 'unreadable' }
  }
}

/** The JPEG's bytes as a shot, the shape pasteShot's are in. */
function shotOf(b64, width, height) {
  const bytes = toByteArray(b64)
  return {
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    uri: `data:image/jpeg;base64,${b64}`,
    width,
    height,
    size: bytes.byteLength
  }
}

/**
 * A picture drawn again at no more than SHOT_EDGE on its long side, as a
 * JPEG at the best of SHOT_QUALITIES under SHOT_BYTES, or null. A side the
 * picker did not say (0) is left to the picture's own size.
 */
async function shrink(uri, width = 0, height = 0) {
  const context = ImageManipulator.manipulate(uri)
  if (Math.max(width, height) > SHOT_EDGE) context.resize(width >= height ? { width: SHOT_EDGE } : { height: SHOT_EDGE })
  const image = await context.renderAsync()
  try {
    for (const compress of SHOT_QUALITIES) {
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true })
      const size = base64Bytes(saved.base64)
      if (size > 0 && size <= SHOT_BYTES) return shotOf(saved.base64, saved.width, saved.height)
    }
    return null
  } finally {
    image.release?.()
    context.release?.()
  }
}

/**
 * Screenshots from the phone's own photo picker, up to `room` of them.
 *
 * No permission is asked for: the system picker (iOS 14 on, Android 13 on,
 * and Google Play's copy of it before that) hands the app only what was
 * picked. Answers `{ shots }`, with `why` (a key of SHOT_WORDS) when a picked
 * picture could not be made small enough or opened. Never throws.
 */
export async function pickShots(room) {
  if (!(room > 0)) return { shots: [], why: 'full' }
  try {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 1,
      exif: false
    })
    if (picked?.canceled || !picked?.assets?.length) return { shots: [] }
    const shots = []
    let why
    for (const asset of picked.assets.slice(0, room)) {
      const shot = await shrink(asset.uri, asset.width, asset.height).catch(() => undefined)
      if (shot) shots.push(shot)
      else why = shot === null ? 'tooBig' : 'unreadable'
    }
    return why ? { shots, why } : { shots }
  } catch {
    return { shots: [], why: 'unreadable' }
  }
}
