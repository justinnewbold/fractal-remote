import { SHOT_BYTES, SHOT_QUALITIES, shotSize } from '../../shared/report-rules.mjs'

/**
 * A screenshot for a report, from a file somebody picked (or pasted).
 *
 * SHRUNK BEFORE IT GOES. Drawn again at no more than SHOT_EDGE on its long
 * side and written as a JPEG, at the best of SHOT_QUALITIES that comes in
 * under SHOT_BYTES (shared/report-rules, which says why those numbers). A
 * picture the browser cannot open, a HEIC in a browser that does not read
 * them for instance, is said so rather than sent as it is: the bucket takes
 * JPEGs only.
 *
 * Answers `{ shot }` or `{ why }`, where `why` is 'tooBig' or 'unreadable',
 * the keys of SHOT_WORDS. Never throws. `shot.uri` is an object URL for the
 * thumbnail, which the caller lets go of (`forget`) when the picture is
 * removed or sent.
 */
export async function shrinkShot(file) {
  let source = null
  try {
    source = await decode(file)
    const { width, height } = shotSize(source.width, source.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const pen = canvas.getContext('2d')
    /* A see-through screenshot has nothing behind it in a JPEG: paint the app's own dark first. */
    pen.fillStyle = '#0d0f12'
    pen.fillRect(0, 0, width, height)
    pen.drawImage(source.image, 0, 0, width, height)
    for (const quality of SHOT_QUALITIES) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob) return { why: 'unreadable' }
      if (blob.size <= SHOT_BYTES) {
        return { shot: { body: blob, uri: URL.createObjectURL(blob), width, height, size: blob.size } }
      }
    }
    return { why: 'tooBig' }
  } catch {
    return { why: 'unreadable' }
  } finally {
    source?.done?.()
  }
}

/** Lets go of a thumbnail's object URL. */
export function forget(shot) {
  try {
    if (shot?.uri?.startsWith('blob:')) URL.revokeObjectURL(shot.uri)
  } catch {
    /* Nothing held, then. */
  }
}

/** The picture files in a paste, for a box that takes a pasted screenshot. */
export function pastedImages(event) {
  const files = [...(event?.clipboardData?.files || [])]
  return files.filter((f) => /^image\//.test(f.type || ''))
}

/* The picture, decoded, with its size: createImageBitmap where there is one, an <img> where not. */
async function decode(file) {
  if (typeof globalThis.createImageBitmap === 'function') {
    const bitmap = await globalThis.createImageBitmap(file)
    return { image: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close?.() }
  }
  const url = URL.createObjectURL(file)
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('unreadable'))
    img.src = url
  })
  return { image, width: image.naturalWidth, height: image.naturalHeight, done: () => URL.revokeObjectURL(url) }
}
