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
