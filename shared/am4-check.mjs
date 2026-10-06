/**
 * THE AM4 CHECK: read ONE setting, once, when a person presses a button.
 *
 * "What happened to the AM4 metronome tester? How do we test it now?"
 *
 * The finder that came before this asked the AM4 about every block id from 1
 * to 255 in a row, and his AM4 froze on SAVING until it was power-cycled. So
 * this is the opposite of that in every way that matters:
 *
 * - It only reads. Nothing here can write, save or change the unit.
 * - One question per press, never a loop, and never two at once.
 * - Only addresses named below, each with the reason it is there.
 * - The question is the AM4's long single-setting read (fn 0x01, action
 *   0x000D): the 18 bytes AM4-Edit sends over and over to follow a block's
 *   on/off state, answered with a 40-byte description of that one setting
 *   (forgefx-midi src/am4/setParam.ts, READ_TYPE_LONG).
 *
 * Why the long one. The first version asked with the short read (0x000E) and
 * every answer was 0.000 — tempo, tempo-to-use and metronome level alike,
 * while his AM4 was set to a real tempo. The codec says why, about bypass:
 * the short read "returns a static value that doesn't track" the unit; the
 * long read "tracks live state". Where in those 40 bytes the value sits is
 * not decoded yet, so the page shows which bytes moved between two reads.
 *
 * How it proves an address: read it, change that setting on the AM4's own
 * screen, read it again. If the number follows the screen, that is the
 * setting, and the app can be taught to set it.
 */

/*
 * What is asked, and why.
 *
 * AM4-Edit's own table of setting names (forgefx-midi
 * src/am4/variantResolverTables.ts, effect type 2) puts CONTROLLERS_TEMPO at
 * 28 and CONTROLLERS_TEMPOTOUSE at 29. On the FM3 the Controllers block is
 * effect id 2, and the AM4 has so far followed the FM3's ids for its virtual
 * blocks (Global is 1 on both; the tuner the app already reads is 35 = 0x23 on
 * both). So the AM4's tempo is most likely 2 / 28. The metronome's level is a
 * Global setting named GLOBAL_METLEVEL1, at 97 (0x61) in the same table.
 */
export const CHECKS = [
  { key: 'tempo', label: 'Tempo', where: 'Controllers → Tempo (found 2026-10-05)', pidLow: 0x0002, pidHigh: 0x001c },
  { key: 'metronome', label: 'Metronome level', where: 'Controllers → Metronome', pidLow: 0x0001, pidHigh: 0x0061 },
  /*
   * The cab. forgefx-midi's catalog has amp.cab, "Cab #" in AM4-Edit, at
   * (0x003E, 0x000C) — CABINET_TYPE1. If the long read's text names the cab
   * the AM4 shows, the cab picker can list and pick cabs by name.
   */
  { key: 'cab', label: 'Cab', where: 'Amp → Cab → Cab 1', pidLow: 0x003e, pidHigh: 0x000c },
  /*
   * The output level bar. AM4-Edit polls (0x002A, 0x0016) and (0x002A, 0x0017)
   * on its main page with the live-value read (action 0x0010), the same read
   * the tuner already uses (docs/AM4-CAPTURE-2026-07-05.md, "main/home meters").
   * Read while playing and while silent: a meter moves between the two.
   */
  { key: 'out-1', label: 'Output level (first)', where: 'Home screen meter', pidLow: 0x002a, pidHigh: 0x0016, read: 0x0010 },
  { key: 'out-2', label: 'Output level (second)', where: 'Home screen meter', pidLow: 0x002a, pidHigh: 0x0017, read: 0x0010 }
]

/** How long a person must wait between two questions. One at a time, unhurried. */
export const PAUSE_MS = 1000

const READ_LONG = 0x000d
const READ_ACTIONS = [0x000d, 0x000e, 0x0010, 0x0026]

const encode14 = (v) => [v & 0x7f, (v >> 7) & 0x7f]

/** Fractal's checksum: every byte from F0 up to the checksum, XORed, kept to 7 bits. */
export const checksum = (bytes) => bytes.reduce((x, b) => x ^ b, 0) & 0x7f

export const toHex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
export const fromHex = (hex) => (String(hex || '').match(/../g) || []).map((x) => parseInt(x, 16))

/** The 18-byte long read of one setting. */
export function readFrame({ pidLow, pidHigh, read = READ_LONG }) {
  const head = [0xf0, 0x00, 0x01, 0x74, 0x15, 0x01, ...encode14(pidLow), ...encode14(pidHigh), ...encode14(read), 0x00, 0x00, 0x00, 0x00]
  return [...head, checksum(head), 0xf7]
}

/* The AM4's 7-bit packing of raw bytes (forgefx-midi src/shared/packValue.ts). */
function unpack(wire, rawLen) {
  const out = new Uint8Array(rawLen)
  for (let i = 0; i < wire.length; i++) {
    const k = i + 1
    const b = wire[i] & 0x7f
    if (i > 0 && i - 1 < rawLen) out[i - 1] |= ((~(0x7f >> k) & b) >> (8 - k)) & 0xff
    if (i < rawLen) out[i] = (b << k) & 0xff
  }
  return out
}

/* 7 raw bytes travel as 8, a shorter last run as one more than it holds. */
function unpackChunked(wire, rawLen) {
  const out = []
  let w = 0
  while (out.length < rawLen) {
    const raw = Math.min(7, rawLen - out.length)
    const take = raw === 7 ? 8 : raw + 1
    out.push(...unpack(wire.slice(w, w + take), raw))
    w += take
  }
  return out
}

/**
 * The bytes in a reply to a read of this address, or null.
 *
 * Every frame the unit sent back in the window is looked at, and only a
 * well-formed answer naming this exact address, with a good checksum, counts:
 * the AM4 talks about other things too, and bytes from the wrong question are
 * worse than none. A 4-byte answer also carries its number.
 */
export function valueFrom(check, frames) {
  for (const raw of frames || []) {
    const f = typeof raw === 'string' ? fromHex(raw) : raw
    if (!Array.isArray(f) || f.length < 23) continue
    const end = f.length - 1
    if (f[0] !== 0xf0 || f[end] !== 0xf7 || f[1] !== 0x00 || f[2] !== 0x01 || f[3] !== 0x74 || f[4] !== 0x15 || f[5] !== 0x01) continue
    if ((f[6] | (f[7] << 7)) !== check.pidLow || (f[8] | (f[9] << 7)) !== check.pidHigh) continue
    if (!READ_ACTIONS.includes(f[10] | (f[11] << 7))) continue
    if (checksum(f.slice(0, end - 1)) !== f[end - 1]) continue
    const size = f[14] | (f[15] << 7)
    const wire = f.slice(16, end - 1)
    if (!size || wire.length < size + Math.ceil(size / 7)) continue
    const bytes = unpackChunked(wire, size)
    const out = { bytes }
    if (size === 4) {
      const view = new DataView(new Uint8Array(bytes).buffer)
      out.float = view.getFloat32(0, true)
      out.whole = view.getUint32(0, true)
    }
    return out
  }
  return null
}

/** The number at a 4-byte boundary, as a float, or null when it is not a sensible one. */
export function floatAt(bytes, offset) {
  if (!bytes || offset + 4 > bytes.length) return null
  const n = new DataView(new Uint8Array(bytes.slice(offset, offset + 4)).buffer).getFloat32(0, true)
  return Number.isFinite(n) && (n === 0 || (Math.abs(n) > 1e-6 && Math.abs(n) < 1e7)) ? n : null
}

/** Which bytes moved between two answers: [{offset, before, after}]. */
export function moved(a, b) {
  if (!a?.bytes || !b?.bytes) return []
  const out = []
  for (let i = 0; i < Math.max(a.bytes.length, b.bytes.length); i++) {
    if (a.bytes[i] !== b.bytes[i]) out.push({ offset: i, before: a.bytes[i] ?? null, after: b.bytes[i] ?? null })
  }
  return out
}

const short = (n) => (Math.abs(n) >= 100 ? n.toFixed(1) : n.toFixed(3))

/** What moved, in a line he can paste: each changed byte, and any number around it that changed with it. */
export function sayMoved(a, b) {
  const m = moved(a, b)
  if (!m.length) return 'Nothing moved since the last read.'
  const bytes = m.map((x) => `byte ${x.offset}: ${x.before} → ${x.after}`).join(', ')
  const words = [...new Set(m.map((x) => x.offset - (x.offset % 4)))]
    .map((o) => [o, floatAt(a.bytes, o), floatAt(b.bytes, o)])
    .filter(([, x, y]) => x !== null && y !== null)
    .map(([o, x, y]) => `number at ${o}: ${short(x)} → ${short(y)}`)
  return `Moved: ${bytes}${words.length ? `. ${words.join(', ')}` : ''}`
}

/** One answer in his words: its number when it is a 4-byte answer, its size and bytes otherwise. */
export function sayValue(check, value) {
  if (!value) return 'No answer from the AM4 at this address.'
  if (value.bytes.length === 4) {
    const n = value.float
    if (!Number.isFinite(n)) return `An answer, but not a number (stored as ${value.whole}).`
    return check.key === 'tempo' && n >= 20 && n <= 400 ? `${Math.round(n)} BPM (${short(n)})` : short(n)
  }
  const shows = displayText(value.bytes)
  return shows ? `AM4 shows “${shows}” (${value.bytes.length} bytes: ${toHex(value.bytes)})` : `${value.bytes.length} bytes: ${toHex(value.bytes)}`
}

/**
 * The AM4's own words for the setting, from a long answer: bytes 8 on are the
 * text its screen shows ("250 BPM", "PRESET", "0.00 dB" on his AM4), ended by
 * a zero. Null when they are not plain text.
 */
export function displayText(bytes) {
  if (!Array.isArray(bytes) || bytes.length <= 8) return null
  const end = bytes.indexOf(0, 8)
  const text = bytes.slice(8, end === -1 ? bytes.length : end)
  if (!text.length || text.some((b) => b < 0x20 || b > 0x7e)) return null
  return String.fromCharCode(...text)
}
