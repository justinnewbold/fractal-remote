/**
 * THE AM4 FINDER: what changed on the unit between two snapshots.
 *
 * "Is that the only way to do it? I thought we could do it ourselves without
 * all that other stuff." The AM4's tempo, its metronome switch and the rest
 * are somewhere in the unit; nobody has written down where. Rather than
 * record what Fractal's AM4-Edit says to it, this asks the unit itself for
 * everything it will tell us, twice — once before Justin changes one thing on
 * the AM4, once after — and lists what moved. Whatever moved is where that
 * setting lives, and the same address is then written to, to prove it.
 *
 * Two questions, both read-only:
 *
 *   GET_ALL_PARAMS (fn 0x1F), per effect id: every value a block (or a
 *     virtual block — global, controllers) holds, as 16-bit numbers. The
 *     computer app already asks this of the four placed blocks on every
 *     preset read; this asks it of every id from 1 to 255.
 *   The active-buffer dump (fn 0x03 7F 7F): the whole edit buffer, 12 KB,
 *     for anything a block read does not carry.
 *
 * Sent through the computer app's POST /debug/raw, which only answers on
 * the computer itself — so this works in the Mac app's own window and
 * nowhere else. Wire shapes are forgefx-midi's (src/am4/setParam.ts
 * buildGetAllParams, buildRequestActiveBufferDump; src/devices/am4/shared/
 * readOps.ts for the reply).
 */

const HEAD = [0xf0, 0x00, 0x01, 0x74, 0x15]

/** Fractal's checksum: every byte from F0 to the last body byte, XORed, seven bits. */
export const checksum = (bytes) => bytes.reduce((a, b) => a ^ b, 0) & 0x7f

const frame = (body) => {
  const head = [...HEAD, ...body]
  return [...head, checksum(head), 0xf7]
}

export const toHex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
export const fromHex = (hex) => (String(hex || '').match(/../g) || []).map((x) => parseInt(x, 16))

/** Ask one effect id for every value it holds. */
export const getAllParams = (eid) => frame([0x1f, eid & 0x7f, (eid >> 7) & 0x7f])

/** Ask for the whole edit buffer. */
export const activeDump = () => frame([0x03, 0x7f, 0x7f, 0x00])

/** The effect ids a full sweep asks about. */
export const SWEEP = Array.from({ length: 255 }, (_, i) => i + 1)

const isFn = (f, fn) => f.length >= 7 && HEAD.every((b, i) => f[i] === b) && f[5] === fn
const decode14 = (lo, hi) => (lo & 0x7f) | ((hi & 0x7f) << 7)
const decode16 = (b0, b1, b2) => (b0 & 0x7f) | ((b1 & 0x7f) << 7) | ((b2 & 0x03) << 14)

/**
 * One effect id's values, out of whatever frames came back, or null.
 *
 * Only the triple whose header names THIS id counts: the computer app's own
 * polling uses the same read for the placed blocks, and its replies can land
 * in the same window. NACKed (fn 0x64) or silent ids are null — nothing lives
 * there.
 */
export function valuesFrom(eid, frames) {
  const fs = (frames || []).map((f) => (typeof f === 'string' ? fromHex(f) : f))
  let mine = false
  let count = 0
  const out = []
  for (const f of fs) {
    if (isFn(f, 0x74)) {
      mine = decode14(f[6], f[7]) === eid
      if (mine) count = decode14(f[8], f[9])
      continue
    }
    if (isFn(f, 0x76)) {
      if (mine) break
      continue
    }
    if (mine && isFn(f, 0x75)) {
      const n = decode14(f[6], f[7])
      for (let i = 0; i < n; i++) {
        const o = 8 + i * 3
        if (o + 2 >= f.length - 2) break
        out.push(decode16(f[o], f[o + 1], f[o + 2]))
      }
    }
  }
  if (!out.length) return null
  return count && out.length > count ? out.slice(0, count) : out
}

/** The edit buffer's bytes, out of a dump's frames: every fn 0x78 chunk, in order. */
export function dumpFrom(frames) {
  const fs = (frames || []).map((f) => (typeof f === 'string' ? fromHex(f) : f))
  return fs.filter((f) => isFn(f, 0x78)).flatMap((f) => f.slice(6, -2))
}

/** Everything that differs between two snapshots, block values first. */
export function differences(a, b) {
  const out = []
  const ids = new Set([...Object.keys(a?.blocks || {}), ...Object.keys(b?.blocks || {})])
  for (const id of [...ids].map(Number).sort((x, y) => x - y)) {
    const va = a?.blocks?.[id] || []
    const vb = b?.blocks?.[id] || []
    const n = Math.max(va.length, vb.length)
    /* Four channels side by side (readOps: "CHANNEL-BLOCKED"): the index
       inside one channel is the address a write uses. */
    const stride = n % 4 === 0 && n >= 4 ? n / 4 : n
    for (let i = 0; i < n; i++) {
      if (va[i] !== vb[i]) out.push({ kind: 'block', eid: id, index: i, param: i % stride, channel: stride === n ? null : Math.floor(i / stride), before: va[i] ?? null, after: vb[i] ?? null })
    }
  }
  const da = a?.dump || []
  const db = b?.dump || []
  for (let i = 0; i < Math.max(da.length, db.length); i++) {
    if (da[i] !== db[i]) out.push({ kind: 'dump', offset: i, before: da[i] ?? null, after: db[i] ?? null })
  }
  return out
}

/** The differences as text to paste back: one line each, the block ones first. */
export function describe(changes, { limit = 200 } = {}) {
  if (!changes.length) return 'Nothing changed between the two snapshots.'
  const lines = changes.slice(0, limit).map((c) =>
    c.kind === 'block'
      ? `block ${c.eid} value ${c.index}${c.channel == null ? '' : ` (param ${c.param}, channel ${'ABCD'[c.channel]})`}: ${c.before} → ${c.after}`
      : `dump byte ${c.offset}: ${c.before} → ${c.after}`
  )
  if (changes.length > limit) lines.push(`…and ${changes.length - limit} more`)
  return lines.join('\n')
}
