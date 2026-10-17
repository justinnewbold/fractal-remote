/**
 * Which letters read on a colour, and the few sums the colours are checked by.
 *
 * The letters on a tile are never part of a colour. "Fix the text so when
 * it's on lighter tiles it's black and when it's on darker tiles it's white,
 * like we already had set up." A palette that names its own ink names it for
 * the colour it was written next to — and the moment anybody draws that
 * colour differently, or picks another one for their drive, the stored ink is
 * the wrong answer. So the app works it out from the colour actually drawn,
 * every time, and nothing stores it.
 *
 * Shared, with no imports, so the phone and the browser pick the same letters
 * for the same tile. The phone's lib/vivid re-exports what it used to keep for
 * itself, so nothing that imported it from there had to move.
 */

/** The two inks. The dark one is the panel colour, not black: black on a lit
    tile reads as a hole in it. */
export const DARK_INK = '#15181d'
export const LIGHT_INK = '#ffffff'

const hex2 = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')

/** '#rgb' or '#rrggbb' to {r,g,b} 0-255, or null for anything else. */
export function readHex(value) {
  const s = String(value || '').trim()
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s)
  if (!m) return null
  const body = m[1]
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  }
}

const toHex = ({ r, g, b }) => `#${hex2(r)}${hex2(g)}${hex2(b)}`

const lin = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

const unlin = (v) => {
  const c = Math.max(0, Math.min(1, v))
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
}

/** WCAG relative luminance, 0 (black) to 1 (white), or null for anything that is not a colour. */
export function luminance(value) {
  const rgb = readHex(value)
  if (!rgb) return null
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b)
}

/** WCAG contrast between two colours, 1 to 21, or null if either is not a colour. */
export function contrast(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Black letters or white, whichever reads better on this colour.
 *
 * The palette's own ink is only the answer for a colour this cannot read — a
 * CSS variable, say — which is what `fallback` is for.
 */
export function inkOn(value, fallback = LIGHT_INK) {
  const L = luminance(value)
  if (L === null) return fallback
  const onWhite = 1.05 / (L + 0.05)
  const onDark = (L + 0.05) / (luminance(DARK_INK) + 0.05)
  return onDark > onWhite ? DARK_INK : LIGHT_INK
}

/**
 * `a` with `t` of `b` mixed in, channel by channel — exactly what CSS's
 * `color-mix(in srgb, a, b t)` and a translucent panel over a tile both draw.
 * That is the point of doing it this crudely: the tests measure the colour
 * the screen shows, and the screen does not mix in a nicer colour space.
 */
export function mix(a, b, t) {
  const x = readHex(a)
  const y = readHex(b)
  if (!x || !y) return a
  const k = Math.max(0, Math.min(1, t))
  return toHex({ r: x.r + (y.r - x.r) * k, g: x.g + (y.g - x.g) * k, b: x.b + (y.b - x.b) * k })
}

/**
 * `ink` taken toward `full` just far enough to read at `ratio` on every one of
 * `grounds`, in twentieths: the quiet letters on a tile — a scene's number, an
 * effect's Off — stay as quiet as the tile lets them and no quieter than it
 * can carry. `full` itself if nothing short of it reads.
 */
export function enoughOn(ink, full, grounds, ratio = 4.5) {
  for (let i = 0; i <= 20; i++) {
    const c = i ? mix(ink, full, i / 20) : ink
    if (grounds.every((g) => (contrast(c, g) ?? 0) >= ratio)) return c
  }
  return full
}

/** The same colour with `k` of black mixed in (0 to 1). */
export const darker = (value, k = 0.5) => mix(value, '#000000', k)

/** The same colour with `k` of white mixed in (0 to 1). */
export const lighter = (value, k = 0.45) => mix(value, '#ffffff', k)

/*
 * THE EDGE A TILE NEEDS ON PAPER.
 *
 * On the dark page a tile's own colour is its edge, and every colour the app
 * offers is chosen bright enough to stand 3:1 off the black. On the Light page
 * the same colour can be nearly the paper — a pale Sunlight tile dissolved
 * into it at 1.13:1 — so there the edge is the colour taken half way to black.
 * Half is the amount that holds 3:1 for the palest colour there is, white,
 * against the warmest paper either end draws. styles.css writes the same 50%
 * by hand, and a test holds the two to each other.
 */
export const PAPER_EDGE = 0.5
export const paperEdge = (value) => darker(value, PAPER_EDGE)

/* ------------------------------------------------------------------ */
/* OKLab: lightness moved, hue kept                                    */
/* ------------------------------------------------------------------ */

function toOklab(value) {
  const rgb = readHex(value)
  if (!rgb) return null
  const r = lin(rgb.r)
  const g = lin(rgb.g)
  const b = lin(rgb.b)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  }
}

function fromOklab(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ]
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6)
const Y = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]

/**
 * The same hue at the luminance asked for. Chroma is kept where sRGB has room
 * for it and given up only where it has not, so a red moved lighter is still
 * that red and never turns into a pink of another hue.
 */
export function withLuminance(value, target) {
  const lab = toOklab(value)
  if (!lab) return value
  const C0 = Math.hypot(lab.a, lab.b)
  const h = Math.atan2(lab.b, lab.a)
  const solve = (C) => {
    const a = C * Math.cos(h)
    const b = C * Math.sin(h)
    let lo = 0
    let hi = 1
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (Y(fromOklab(mid, a, b)) < target) lo = mid
      else hi = mid
    }
    return fromOklab((lo + hi) / 2, a, b)
  }
  for (let C = C0; C > 0; C -= 0.002) {
    const rgb = solve(C)
    if (inGamut(rgb)) return toHex({ r: unlin(rgb[0]), g: unlin(rgb[1]), b: unlin(rgb[2]) })
  }
  const grey = solve(0)
  return toHex({ r: unlin(grey[0]), g: unlin(grey[1]), b: unlin(grey[2]) })
}

/*
 * THE TWO WINDOWS A FILL MAY SIT IN.
 *
 * White letters read at 4.5:1 on anything darker than about 0.183; black ones
 * on anything lighter than about 0.215. And a lit tile has to stand 3:1 clear
 * of an unlit one on the dark stage, which puts a floor under the white
 * window. Everything the app paints sits in one of the two, a margin inside
 * each edge.
 */
export const WHITE_WINDOW = [0.132, 0.178]
export const DARK_FROM = 0.222

/**
 * The nearest colour of the same hue whose letters read and which still looks
 * lit: kept exactly when it already does, otherwise only its lightness moves.
 * What a free pick goes through before it is used.
 */
export function readable(value) {
  const L = luminance(value)
  if (L === null) return value
  const [lo, hi] = WHITE_WINDOW
  if ((L >= lo && L <= hi) || L >= DARK_FROM) return value.toLowerCase()
  const target = L < lo ? lo + 0.008 : L - hi <= DARK_FROM - L ? hi - 0.006 : DARK_FROM + 0.008
  return withLuminance(value, target)
}

/* ------------------------------------------------------------------ */
/* CIEDE2000: how far apart two colours look                            */
/* ------------------------------------------------------------------ */

function toLab(value) {
  const rgb = readHex(value)
  if (!rgb) return null
  const r = lin(rgb.r)
  const g = lin(rgb.g)
  const b = lin(rgb.b)
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const Yv = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)
  return { L: 116 * f(Yv) - 16, a: 500 * (f(X) - f(Yv)), b: 200 * (f(Yv) - f(Z)) }
}

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => {
  const d = (r * 180) / Math.PI
  return d < 0 ? d + 360 : d
}

/**
 * CIEDE2000 between two colours. About 1 is the smallest step anybody sees
 * side by side; 10 is two colours nobody mistakes for each other at arm's
 * length. Null if either is not a colour.
 */
export function deltaE(x, y) {
  const p = toLab(x)
  const q = toLab(y)
  if (!p || !q) return null
  const C1 = Math.hypot(p.a, p.b)
  const C2 = Math.hypot(q.a, q.b)
  const Cb7 = ((C1 + C2) / 2) ** 7
  const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + 25 ** 7)))
  const a1 = (1 + G) * p.a
  const a2 = (1 + G) * q.a
  const c1 = Math.hypot(a1, p.b)
  const c2 = Math.hypot(a2, q.b)
  const h1 = c1 ? deg(Math.atan2(p.b, a1)) : 0
  const h2 = c2 ? deg(Math.atan2(q.b, a2)) : 0
  const dL = q.L - p.L
  const dC = c2 - c1
  let dh = 0
  if (c1 * c2) {
    dh = h2 - h1
    if (dh > 180) dh -= 360
    else if (dh < -180) dh += 360
  }
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(rad(dh / 2))
  const Lb = (p.L + q.L) / 2
  const cb = (c1 + c2) / 2
  let hb = h1 + h2
  if (c1 * c2) {
    if (Math.abs(h1 - h2) > 180) hb += h1 + h2 < 360 ? 360 : -360
    hb /= 2
  }
  const T =
    1 -
    0.17 * Math.cos(rad(hb - 30)) +
    0.24 * Math.cos(rad(2 * hb)) +
    0.32 * Math.cos(rad(3 * hb + 6)) -
    0.2 * Math.cos(rad(4 * hb - 63))
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2)
  const SC = 1 + 0.045 * cb
  const SH = 1 + 0.015 * cb * T
  const cb7 = cb ** 7
  const RT = -2 * Math.sqrt(cb7 / (cb7 + 25 ** 7)) * Math.sin(rad(60 * Math.exp(-(((hb - 275) / 25) ** 2))))
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))
}

/** OKLCH hue in degrees, or null for a colour with almost no colour in it — a grey has no hue to keep. */
export function hueOf(value) {
  const lab = toOklab(value)
  if (!lab || Math.hypot(lab.a, lab.b) < 0.02) return null
  return deg(Math.atan2(lab.b, lab.a))
}

/* ------------------------------------------------------------------ */
/* The same colour, as a colour-blind player sees it                    */
/* ------------------------------------------------------------------ */

/*
 * Machado, Oliveira and Fernandes (2009), at full strength, in linear light:
 * the three kinds of colour blindness the looks were built and checked
 * against. About one man in twelve has the first two in some measure, which
 * on a stage is a player in most bands.
 */
const SEEN = Object.freeze({
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998]
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881]
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039]
  ]
})

/** Normal vision first, then the three the colour sheet warns about. */
export const VISIONS = Object.freeze(['normal', 'protan', 'deutan', 'tritan'])

/**
 * The colour a player with that kind of colour vision sees. 'normal' is the
 * colour itself; anything that is not a colour comes back as it went in.
 */
export function seenWith(value, vision = 'normal') {
  const M = SEEN[vision]
  const rgb = readHex(value)
  if (!M || !rgb) return value
  const v = [lin(rgb.r), lin(rgb.g), lin(rgb.b)]
  const [r, g, b] = M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2])
  return toHex({ r: unlin(r), g: unlin(g), b: unlin(b) })
}
