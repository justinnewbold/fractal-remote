/*
 * THE NAM BLOCK'S OWN PICTURE: a small neural network, drawn here.
 *
 * "Make the NAM block look similar to this. but with the same aesthetics
 * that we use in our app now. But like with the rainbow type color in that
 * same type of glyph." (Justin, 14 November 2026, with a picture of the
 * block as his editor draws it: a web of dots and lines over the word NAM,
 * on a wash of colours.)
 *
 * OUR OWN DRAWING, MADE BY THIS FILE. Nothing is taken from Fractal's
 * editor: no file of theirs, no tracing of their glyph. A neural network as
 * every textbook draws one (three columns of dots, every dot joined to every
 * dot in the next column), three, four and three dots where theirs has
 * more, and the colours are a plain rainbow from left to right. The picture
 * he sent is not in this repository and never will be.
 *
 * TWO FILES, both in mobile/assets/icons, the phone's and the browser's:
 *
 *   nam.png          96 x 96, white, like every other block's picture: the
 *                    one that is tinted (grey when off, the quiet outline)
 *   nam-rainbow.png  192 x 192, in its own colours, over a dark edge that
 *                    reaches a little past every dot and line, so the
 *                    violet end still reads on a lit purple tile and the
 *                    yellow on a pale one. Drawn as it is, never tinted.
 *
 * NO DRAWING PACKAGE: the phone has no SVG and no gradient (either would be
 * a build), so the rainbow is baked into a PNG, and the PNG is written here
 * from nothing but zlib. A test (test/nam-icon.mjs) draws both again and
 * holds the files to them, dot for dot, so neither can be swapped for a
 * picture from anywhere else.
 *
 *   node scripts/nam-icon.mjs     writes both files
 */
import zlib from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** The rainbow, left to right. */
export const NAM_RAINBOW = Object.freeze(['#ff5252', '#ff9f43', '#ffd93d', '#4cd97b', '#38c6f4', '#6f7bff', '#c86bff'])
/** Dots in each column, left to right. */
export const NAM_LAYERS = Object.freeze([3, 4, 3])

/* In a square one unit wide. */
const PAD = 0.05
const DOT = 0.09
const LINE = 0.03
/*
 * The dark edge under the coloured picture: how far past the shape, and how
 * dark. Sized on the NAM block's own tile, the hardest ground it has: the
 * violet end of the rainbow is nearly the tile's purple (#7742e0), and at
 * the smallest picture a tile draws (14 points) a thinner, lighter edge let
 * that whole column fade into it (an independent read measured it).
 */
const EDGE = 0.035
const EDGE_ALPHA = 0.7
/* A line is a little lighter than a dot, so the dots stay the thing seen. */
const LINE_ALPHA = 0.8
/* Each dot of the picture is sampled this many times across and down. */
const SAMPLES = 4

const STOPS = NAM_RAINBOW.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))
function rainbow(t) {
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1)
  const i = Math.min(STOPS.length - 2, Math.floor(x))
  const f = x - i
  return STOPS[i].map((c, k) => c + (STOPS[i + 1][k] - c) * f)
}

/** Where the dots are, column by column, and the lines between them. A shorter column is centred on the tallest. */
export function namShape() {
  const tall = Math.max(...NAM_LAYERS)
  const room = 1 - 2 * PAD - 2 * DOT
  const step = room / (tall - 1)
  const dots = NAM_LAYERS.map((n, i) => {
    const x = PAD + DOT + room * (i / (NAM_LAYERS.length - 1))
    const top = 0.5 - (step * (n - 1)) / 2
    return Array.from({ length: n }, (_, j) => ({ x, y: top + step * j }))
  })
  const lines = []
  for (let i = 0; i + 1 < dots.length; i++) for (const a of dots[i]) for (const b of dots[i + 1]) lines.push([a, b])
  return { dots, lines }
}

/* Square root of a sum of squares, spelt out: it is rounded the same on every machine, where Math.hypot is only promised to be close, and a sample on the very edge of a dot must fall the same side wherever the test draws it again. */
const far = (dx, dy) => Math.sqrt(dx * dx + dy * dy)

const toLine = (px, py, a, b) => {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / (vx * vx + vy * vy)))
  return far(px - a.x - t * vx, py - a.y - t * vy)
}

/* 2 on a dot, 1 on a line, 0 off the shape; `grow` widens both. */
function hit(shape, px, py, grow) {
  for (const col of shape.dots) for (const d of col) if (far(px - d.x, py - d.y) <= DOT + grow) return 2
  for (const [a, b] of shape.lines) if (toLine(px, py, a, b) <= LINE / 2 + grow) return 1
  return 0
}

/**
 * The picture's dots, `size` across and down, as RGBA bytes (not
 * premultiplied). `own`: in its own colours with the dark edge; without it,
 * white.
 */
export function namPixels(size, { own = false } = {}) {
  const shape = namShape()
  const out = Buffer.alloc(size * size * 4)
  const n = SAMPLES * SAMPLES
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      /* Each sample is worked out whole, the shape over the edge's black, and the samples are averaged with their colour weighted by their cover. */
      let a = 0
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const ux = (x + (sx + 0.5) / SAMPLES) / size
          const uy = (y + (sy + 0.5) / SAMPLES) / size
          const what = hit(shape, ux, uy, 0)
          if (what) {
            const top = what === 2 ? 1 : LINE_ALPHA
            const c = own ? rainbow((ux - PAD) / (1 - 2 * PAD)) : [255, 255, 255]
            /* A line lets a fifth of what is under it through: in the coloured picture that is the edge's black, never the tile. */
            a += own ? top + EDGE_ALPHA * (1 - top) : top
            r += c[0] * top
            g += c[1] * top
            b += c[2] * top
          } else if (own && hit(shape, ux, uy, EDGE)) a += EDGE_ALPHA
        }
      }
      if (a <= 0) continue
      const o = (y * size + x) * 4
      out[o] = Math.round(r / a)
      out[o + 1] = Math.round(g / a)
      out[o + 2] = Math.round(b / a)
      out[o + 3] = Math.round((a / n) * 255)
    }
  }
  return out
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (bytes) => {
  let c = 0xffffffff
  for (const v of bytes) c = CRC[(c ^ v) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc(body))
  return Buffer.concat([length, body, sum])
}

/** RGBA bytes as a PNG file: eight bits a channel, with alpha, every row unfiltered. */
export function pngOf(pixels, size) {
  const head = Buffer.alloc(13)
  head.writeUInt32BE(size, 0)
  head.writeUInt32BE(size, 4)
  head[8] = 8
  head[9] = 6
  const row = size * 4 + 1
  const raw = Buffer.alloc(size * row)
  for (let y = 0; y < size; y++) pixels.copy(raw, y * row + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

/** The two files: where each goes (from the repository's root), its size, and whether it is the coloured one. */
export const NAM_FILES = Object.freeze([
  Object.freeze({ file: 'mobile/assets/icons/nam.png', size: 96, own: false }),
  Object.freeze({ file: 'mobile/assets/icons/nam-rainbow.png', size: 192, own: true })
])

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const { file, size, own } of NAM_FILES) {
    const png = pngOf(namPixels(size, { own }), size)
    writeFileSync(new URL(`../${file}`, import.meta.url), png)
    console.log(`${file}: ${size} x ${size}, ${png.length} bytes`)
  }
}
