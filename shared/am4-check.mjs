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
 * - The question is the AM4's ordinary single-value read (fn 0x01, action
 *   0x000E): the same 18 bytes AM4-Edit sends to read one value, answered in
 *   23 (forgefx-midi src/am4/setParam.ts, buildReadParam / parseReadResponse).
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
  { key: 'tempo', label: 'Tempo', where: 'Controllers → Tempo', pidLow: 0x0002, pidHigh: 0x001c },
  { key: 'tempo-to-use', label: 'Tempo to use', where: 'Controllers → Tempo To Use', pidLow: 0x0002, pidHigh: 0x001d },
  { key: 'metronome', label: 'Metronome level', where: 'Controllers → Metronome', pidLow: 0x0001, pidHigh: 0x0061 }
]

/** How long a person must wait between two questions. One at a time, unhurried. */
export const PAUSE_MS = 1000

const READ_SHORT = 0x000e
const READ_ACTIONS = [0x000e, 0x0010, 0x0026]

const encode14 = (v) => [v & 0x7f, (v >> 7) & 0x7f]

/** Fractal's checksum: every byte from F0 up to the checksum, XORed, kept to 7 bits. */
export const checksum = (bytes) => bytes.reduce((x, b) => x ^ b, 0) & 0x7f

export const toHex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
export const fromHex = (hex) => (String(hex || '').match(/../g) || []).map((x) => parseInt(x, 16))

/** The 18-byte read of one setting. */
export function readFrame({ pidLow, pidHigh }) {
  const head = [0xf0, 0x00, 0x01, 0x74, 0x15, 0x01, ...encode14(pidLow), ...encode14(pidHigh), ...encode14(READ_SHORT), 0x00, 0x00, 0x00, 0x00]
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

/**
 * The value in a reply to a read of this address, or null.
 *
 * Every frame the unit sent back in the window is looked at, and only a
 * well-formed 23-byte answer naming this exact address counts: the AM4 talks
 * about other things too, and a number from the wrong question is worse than
 * none.
 */
export function valueFrom(check, frames) {
  for (const raw of frames || []) {
    const f = typeof raw === 'string' ? fromHex(raw) : raw
    if (!Array.isArray(f) || f.length !== 23) continue
    if (f[0] !== 0xf0 || f[22] !== 0xf7 || f[1] !== 0x00 || f[2] !== 0x01 || f[3] !== 0x74 || f[4] !== 0x15 || f[5] !== 0x01) continue
    if ((f[6] | (f[7] << 7)) !== check.pidLow || (f[8] | (f[9] << 7)) !== check.pidHigh) continue
    if (!READ_ACTIONS.includes(f[10] | (f[11] << 7))) continue
    if ((f[14] | (f[15] << 7)) !== 4) continue
    if (checksum(f.slice(0, 21)) !== f[21]) continue
    const bytes = unpack(f.slice(16, 21), 4)
    const view = new DataView(bytes.buffer)
    return { float: view.getFloat32(0, true), whole: view.getUint32(0, true) }
  }
  return null
}

/** The number in his words: a tempo as BPM, anything else as it came. */
export function sayValue(check, value) {
  if (!value) return 'No answer from the AM4 at this address.'
  const n = value.float
  if (!Number.isFinite(n)) return `An answer, but not a number (stored as ${value.whole}).`
  const shown = Math.abs(n) >= 100 ? n.toFixed(1) : n.toFixed(3)
  return check.key === 'tempo' && n >= 20 && n <= 400 ? `${Math.round(n)} BPM (${shown})` : shown
}
