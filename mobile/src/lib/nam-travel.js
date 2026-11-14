/*
 * A CAPTURE'S RECORD AS IT TRAVELS TO THE COMPUTER.
 *
 * Through the computer (or the Raspberry Pi) the device does not send the
 * unit's messages itself: it hands the computer app the record it packed
 * (lib/nam-install namRecord, the one packer, proven against a real file)
 * and the computer app sends Axe-Edit's messages (ForgeFX
 * server/src/namCaptures.ts namRecordFrom reads what this writes). The
 * record goes as base64 of its words, four bytes each, low byte first, up
 * to the last word that is not nought: a record ends in noughts, and the
 * computer puts them back. About 75,000 characters for a capture, well
 * inside what one message to the computer may carry.
 *
 * Imports nothing, so lib/device can use it without reaching the file that
 * builds the unit's messages.
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** The fewest words the computer takes for a record: its 272 bytes of text and numbers. */
export const NAM_TRAVEL_WORDS_LEAST = 68

/** Bytes as base64, padded. */
export function base64Of(bytes) {
  let out = ''
  const n = bytes.length
  for (let i = 0; i < n; i += 3) {
    const a = bytes[i]
    const b = i + 1 < n ? bytes[i + 1] : 0
    const c = i + 2 < n ? bytes[i + 2] : 0
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)] + (i + 1 < n ? B64[((b & 15) << 2) | (c >> 6)] : '=') + (i + 2 < n ? B64[c & 63] : '=')
  }
  return out
}

/** A record's words as the computer takes them, or null for what is not a record's words. */
export function namRecordTravels(words) {
  if (!words || !Number.isInteger(words.length) || words.length < NAM_TRAVEL_WORDS_LEAST) return null
  let last = words.length
  while (last > NAM_TRAVEL_WORDS_LEAST && !(words[last - 1] >>> 0)) last -= 1
  const bytes = new Uint8Array(last * 4)
  for (let i = 0; i < last; i++) {
    const w = words[i] >>> 0
    bytes[i * 4] = w & 0xff
    bytes[i * 4 + 1] = (w >>> 8) & 0xff
    bytes[i * 4 + 2] = (w >>> 16) & 0xff
    bytes[i * 4 + 3] = w >>> 24
  }
  return base64Of(bytes)
}
