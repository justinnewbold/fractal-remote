/**
 * How wide one tile is when `n` share a row `width` points wide.
 *
 * THE ROW LESS ITS GAPS, DIVIDED BY THE TILES — and then rounded DOWN to a
 * whole pixel of the screen, with one pixel to spare.
 *
 * "On a tablet it's showing everything on the left side… on any setting it
 * shows everything in one line straight down as far as the scenes go instead
 * of putting them up on the side of each other."
 *
 * The exact share came out as something like 223.67 points. React Native lays
 * every tile out on the screen's own pixel grid, and on a screen whose density
 * is not a whole number — the Galaxy Tab A's is 1.33 — each tile is rounded UP
 * to the next pixel. Four of them came to a pixel more than the row, so the
 * last one wrapped: the chain went three across in a grid built for four, and
 * the two scenes beside each other became one scene per line at half width.
 * Phones with a density of 3 round to nothing, which is why only the tablet
 * showed it.
 *
 * So each tile is floored to the pixel grid and gives back one pixel. The
 * difference is invisible, and the row can never add up to more than it has.
 *
 * `scale` is the screen's pixels per point (PixelRatio.get()), handed in so
 * this can be tested without a phone.
 */
export function tileWidth(width, n, gap, scale = 1) {
  const cols = Math.max(1, n)
  if (!width) return undefined
  const exact = (width - gap * (cols - 1)) / cols
  const px = scale > 0 ? scale : 1
  return Math.max(0, Math.floor(exact * px) / px - 1 / px)
}

/**
 * WHERE PLAY'S NOT CONNECTED FLOATS, in points from the top of the screen.
 *
 * A little over a third of the way down (`BAND_AT`), over the tiles, where
 * the eye already is — and never under a card at the top. On the smallest
 * phones, 320 by 568 (the first iPhone SE, or a later one set to Larger
 * Text), the fifteen-second advice reaches further down than that, and its
 * Troubleshooting button sat over the word: 7 points of it with the iPhone's
 * font, nearly all of it with Android's wider one. The card is drawn on top,
 * as it should be, so its buttons stay pressable; the word goes below it
 * instead, `gap` under the card's bottom edge. Both float, so nothing under
 * either one moves.
 *
 * `viewport` is the screen's measured height, 0 before the first layout;
 * `cardBottom` the bottom edge of the card up now, 0 with none. Before the
 * screen is measured the plain share is a percentage, as it always was.
 */
export const BAND_AT = 0.38
export function bandTop(viewport, cardBottom = 0, gap = 0) {
  const clear = cardBottom > 0 ? Math.ceil(cardBottom + gap) : 0
  if (!(viewport > 0)) return clear > 0 ? clear : `${Math.round(BAND_AT * 100)}%`
  return Math.max(Math.round(viewport * BAND_AT), clear)
}

/**
 * A PEDAL'S WHOLE NAME, for a Play wide enough to spell it out
 * (lib/playShape `names`): the unit's own name for the block, less a lone "1".
 * "Drive 1" is Drive and "Delay 2" stays Delay 2, the same rule the three
 * letters keep (shortName shortBlock: DRV, and DLY 2 only for a second
 * one).
 *
 * And no whole name at all ('') for a block with no name of its own: none
 * given, only its code word ("volpan", "geq": the AM4 over Bluetooth names
 * every block after it), or a code nobody has a name for ("0x7e"). Those
 * keep their three letters (VOL, EQ), as they have under 621 points of row,
 * rather than spelling a code word out in lowercase.
 */
export function pedalName(block) {
  const slug = String(block?.slug || '').trim()
  const name = String(block?.name || '').trim()
  if (!name || name === slug || /^0x[0-9a-f]+$/i.test(name)) return ''
  return name.replace(/\s+1$/, '')
}

/**
 * Whether a whole name was laid out whole: in at most `most` lines, and
 * broken only between words. `lines` is what React Native's onTextLayout
 * says it drew, a line at a time. A name that needed a third line, or had
 * a word cut in two to fit ("Multiplex" over "er"), does not fit, and the
 * tile shows its three letters instead.
 */
export function laidWhole(name, lines, most = 2) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length || !Array.isArray(lines) || !lines.length || lines.length > most) return false
  /* The lines put back together, a line break as a space: a word cut in two comes back as two words, an ellipsis as a word that is not the name's. */
  const again = lines.map((l) => String(l?.text ?? '')).join(' ').trim().split(/\s+/).filter(Boolean)
  return again.length === words.length && again.every((w, i) => w === words[i])
}
