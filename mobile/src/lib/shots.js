import * as Clipboard from 'expo-clipboard'
import { toByteArray } from 'base64-js'

import { SHOT_BYTES, SHOT_PHONE_QUALITIES, base64Bytes } from './report-rules'

/**
 * A screenshot for a report, pasted from the clipboard.
 *
 * WITH NO NEW BUILD. The phone has no photo picker built into it, and adding
 * one is a native change that only a new store build carries (the patch for
 * that waits in docs/pending/photo-picker.patch). What it does have is
 * expo-clipboard, which reads a picture somebody has copied: a screenshot,
 * "Copy and Delete" on an iPhone, Copy on Android. So the report's
 * screenshots come in by Paste.
 *
 * An iPhone asks "Allow Paste?" when an app reads a picture from the
 * clipboard (iOS 16 on), unless Settings → Fractal Remote → Paste from Other
 * Apps says Allow. That is the phone's own question and it is expected; the
 * clipboard is read once per tap, and a second time only for a picture still
 * over SHOT_BYTES (shared/report-rules SHOT_PHONE_QUALITIES).
 *
 * Answers `{ shot }` or `{ why }`, where `why` is 'empty', 'tooBig' or
 * 'unreadable', the keys of SHOT_WORDS (and 'empty' has its own words on the
 * screen, because what to do next depends on the phone). Never throws.
 */
export async function pasteShot() {
  try {
    /* No prompt for this one: it asks only whether there is a picture, not for it. */
    if (!(await Clipboard.hasImageAsync())) return { why: 'empty' }
    for (const jpegQuality of SHOT_PHONE_QUALITIES) {
      const image = await Clipboard.getImageAsync({ format: 'jpeg', jpegQuality })
      /* Null when there is none, and when "Don't Allow" was tapped: the phone cannot tell the two apart. */
      if (!image?.data) return { why: 'empty' }
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
