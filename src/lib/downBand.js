/**
 * WHERE PLAY'S NOT CONNECTED FLOATS IN THE BROWSER, in pixels from the top
 * of the window.
 *
 * "When the link drops, Play says so right away. The tiles go dim under NOT
 * CONNECTED." Under, and over the tiles. It used to sit a fixed 42% of the
 * way down the window, which is the phone's rule (mobile/src/lib/tileGrid
 * bandTop) and right on a phone, where Play fills the screen. In a browser
 * on a tablet or a computer Play is shorter than the window, and 42% down was
 * the bottom row of buttons or the empty page under them: on an iPad held
 * upright the word sat right over Tap, tempo and all; held sideways, over
 * the word on Setlists, which still works while the link is down; on a big
 * screen it floated under everything, nowhere near the tiles it was about.
 *
 * So it is placed by what is on the screen, not by the window: the middle of
 * the part of the scenes that is in view, less half the band's own height.
 * With the scenes scrolled out of sight (a small phone held sideways,
 * scrolled to the pedals) it is the middle of what shows of the pedals
 * instead, and with neither measured yet, the old 42%. A sliver of a grid
 * peeking out under the top bar does not count as in view: the band would
 * sit half on it and half on whatever is below.
 *
 * Never under the top bar, which is drawn over it, and never off the bottom
 * of the window. It takes no touch and no room, so wherever it lands nothing
 * under it moves.
 *
 * It is the WORD that is centred, not the band: a dropped tap's note hangs
 * under it for a few seconds, and centring the two together moved the word
 * up when the note came and down when it went — and, over one row of scenes
 * on a big screen, up onto the preset's name.
 *
 * `scenes` and `blocks` are each grid's box in the window ({ top, bottom },
 * getBoundingClientRect's), null when there is none; `floor` the bottom edge
 * of the top bar; `height` the band's first line (the word, or the note when
 * it is alone), and `whole` all of it, both 0 before it has been drawn.
 */
export const BAND_SHARE = 0.42
/* Clear of the top bar and of the window's bottom edge. */
export const BAND_EDGE = 8
/* Less of a grid in view than this, or than twice the band (or all of it, when it is shorter), and the band does not go over it. */
export const BAND_MIN_SEEN = 48

export function downBandTop({ viewport, floor = 0, scenes = null, blocks = null, height = 0, whole = height }) {
  if (!(viewport > 0)) return null
  const tall = Math.max(0, height || 0)
  const all = Math.max(tall, whole || 0)
  const seen = (box) => {
    if (!box || !(box.bottom > box.top)) return null
    const top = Math.max(box.top, floor)
    const bottom = Math.min(box.bottom, viewport)
    /* All of a short grid, or enough of a tall one: a row of scenes 56 px high is in view when all of it is. */
    const enough = Math.min(box.bottom - box.top, Math.max(BAND_MIN_SEEN, tall * 2))
    return bottom - top >= enough ? { top, bottom } : null
  }
  const over = seen(scenes) || seen(blocks)
  const want = over ? (over.top + over.bottom) / 2 - tall / 2 : viewport * BAND_SHARE
  const highest = floor + BAND_EDGE
  /* Note and all on screen. */
  const lowest = Math.max(highest, viewport - all - BAND_EDGE)
  return Math.round(Math.min(Math.max(want, highest), lowest))
}
