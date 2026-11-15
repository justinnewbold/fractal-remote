/*
 * A PRETEND GEN-3 UNIT'S GRID, FOR THE TESTS: the answers a unit gives the
 * two grid reads (mobile/src/lib/gen3-grid.js), made from a list of cells.
 *
 * Nothing here is a recording of a unit and nothing is Fractal's: a preset
 * is built from nothing (a body of noughts with the grid's table in it,
 * coded with the plainest tree the container allows, every byte eight
 * bits), so no preset of anybody's is in the repository. What makes these
 * worth testing against is that the codec the computer app carries reads
 * them back as the same grid: scratch runs of forgefx-midi at the pinned
 * commit decoded `makeDump`'s frames with parsePresetDump, decodeRawPatch
 * and decodeGen3Body, and `makeLive`'s with parseGen3GridLayout (an FM3's
 * whole, an FM9's as far as its seven id bits go), on the day this was
 * written; test/gen3-grid.mjs pins their digests so a change here shows.
 *
 * A cell is `{ row, col, effectId, fromRows }`, rows and columns from zero;
 * an effectId of 1024 or more is a shunt, as the unit files one.
 */
const MODEL_ROWS = { 0x11: 4, 0x12: 6, 0x10: 6 }
const MODEL_COLS = { 0x11: 12, 0x12: 14, 0x10: 14 }
/** Chunks in a whole preset: 8 from an FM3 or FM9, 16 from an Axe-Fx III. */
const MODEL_CHUNKS = { 0x11: 8, 0x12: 8, 0x10: 16 }

const cks = (bytes) => bytes.reduce((x, b) => x ^ b, 0) & 0x7f
const frame = (model, fn, payload) => {
  const body = [0xf0, 0x00, 0x01, 0x74, model, fn, ...payload]
  return [...body, cks(body), 0xf7]
}

function crc(bytes) {
  let c = 0xaa55
  for (const b of bytes) {
    c ^= b << 8
    for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff
  }
  return c
}

/* The plainest code tree: every byte value a leaf eight forks down, in order, so a byte is coded as itself. */
function plainTreeBits() {
  const bits = []
  const walk = (depth, value) => {
    if (depth === 8) {
      bits.push(1)
      for (let i = 7; i >= 0; i--) bits.push((value >> i) & 1)
      return
    }
    bits.push(0)
    walk(depth + 1, value << 1)
    walk(depth + 1, (value << 1) | 1)
  }
  walk(0, 0)
  return bits
}

/** The frames a unit answers "send the preset being edited" with, holding this grid. `name` is the preset's. */
export function makeDump(model, cells, { name = 'TEST', chunks = MODEL_CHUNKS[model] } = {}) {
  const rows = MODEL_ROWS[model]
  const cols = MODEL_COLS[model]
  const bodySize = 0x104 + rows * cols * 4 + 64
  const body = new Array(bodySize).fill(0)
  for (const c of cells) {
    const at = 0x104 + (c.col * rows + c.row) * 4
    body[at] = c.effectId & 0xff
    body[at + 1] = (c.effectId >> 8) & 0xff
    let flag = 0
    for (const r of c.fromRows || []) flag |= 1 << r
    body[at + 2] = flag & 0xff
    body[at + 3] = (flag >> 8) & 0xff
  }
  const bits = plainTreeBits()
  for (const b of body) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1)
  const packed = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i + j] || 0)
    packed.push(v)
  }
  const raw = new Array(chunks * 2048).fill(0)
  for (let i = 0; i < 32 && i < name.length; i++) raw[0x08 + i] = name.charCodeAt(i) & 0x7f
  raw[0x48] = bodySize & 0xff
  raw[0x49] = bodySize >> 8
  raw[0x4a] = packed.length & 0xff
  raw[0x4b] = packed.length >> 8
  if (0x4c + packed.length > raw.length) throw new Error('the pretend preset does not fit')
  for (let i = 0; i < packed.length; i++) raw[0x4c + i] = packed[i]
  const sum = crc(raw)
  raw[4] = sum & 0xff
  raw[5] = sum >> 8
  const frames = [frame(model, 0x77, [0x7f, 0x7f, 0x00, 0x00, 0x20])]
  for (let k = 0; k < chunks; k++) {
    const payload = [0x00, 0x18]
    for (let i = k * 2048; i < (k + 1) * 2048; i += 2) {
      const w = raw[i] | (raw[i + 1] << 8)
      payload.push(w & 0x7f, (w >> 7) & 0x7f, (w >> 14) & 0x03)
    }
    frames.push(frame(model, 0x78, payload))
  }
  let x = 0
  for (let i = 0; i < raw.length; i += 2) x ^= raw[i] | (raw[i + 1] << 8)
  frames.push(frame(model, 0x79, [x & 0x7f, (x >> 7) & 0x7f, (x >> 14) & 0x03]))
  return frames
}

/**
 * The frame a unit answers the live grid read with, holding this grid.
 * `rowBit` is the bit of a cell's cable byte that names the top row (4 is
 * what an FM3 was seen to use); `shuntBase` what a shunt's block id is over
 * its number in this answer.
 */
export function makeLive(model, cells, { rowBit = model === 0x11 ? 4 : 2, shuntBase = 1024, total = 755 } = {}) {
  const rows = MODEL_ROWS[model]
  const stream = new Array(total - 10).fill(0)
  const put = (at, n, value) => {
    for (let i = 0; i < n; i++) {
      const bit = (value >> (n - 1 - i)) & 1
      const b = at + i
      /* The stream starts after F0; its first six bytes are the envelope and the sub-function, which the frame below writes. */
      const where = Math.floor(b / 7) - 7
      if (bit) stream[where] |= 1 << (6 - (b % 7))
    }
  }
  for (const c of cells) {
    const at = 2568 + (c.col * rows + c.row) * 32
    const shunt = c.effectId >= 1024
    put(at, 12, shunt ? c.effectId - shuntBase : c.effectId)
    put(at + 16, 8, shunt ? 0x40 : 0x00)
    let mask = 0
    for (const r of c.fromRows || []) mask |= 1 << (rowBit + r)
    put(at + 24, 8, mask)
  }
  return frame(model, 0x01, [0x2e, 0x00, ...stream])
}
