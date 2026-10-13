/**
 * Whether the words in a tile's top corners can be drawn without touching
 * its picture, for both apps.
 *
 * "Looks like we need to fix the overlapping play word on the looper." The
 * corner words cost a tile no height, which is the whole point of putting
 * them there: the fit-to-screen arithmetic budgets the picture and the name
 * and nothing else. The picture is centred in what is left, so on any tile
 * shorter than about 82pt it rises into the corner row — and the looper's
 * "Rec · Play" was long enough to reach past the middle of every three- and
 * four-across tile on every phone, straight through it.
 *
 * Pushing the two apart is not on offer. On a short tile the picture is at
 * least 14, the name line 18, and Fit owns the height, so there is no room
 * to take. A corner word sits BESIDE the picture or it is not drawn. Never
 * cut short: half a word in a corner reads as a different word.
 *
 * One rule at both ends, because the phone and the browser draw the same
 * tile and a word that is hidden on one and drawn over the picture on the
 * other is one of them wrong.
 */

/**
 * Which corner words have room, from what was laid out.
 *
 * Every number is in the tile's own points, measured from its outer edge:
 * `width` is the tile's outer width, `inset` how far in from that edge the
 * corner words start, `pictureTop` and `bandBottom` how far down the picture
 * starts and the corner row ends. The picture is centred, so its box is
 * (width - picture) / 2 to (width + picture) / 2, and `picture` 0 is a tile
 * with none — pictures switched off in Settings, which leaves nothing to
 * collide with.
 *
 * `left` and `right` are the words' measured widths, 0 or null where there
 * is no word. A word that is there but not measured yet is undefined and is
 * not drawn: the first frame is drawn before anything has been measured, and
 * a word that will not fit must never flash over the picture on it.
 *
 * `pair` is two words that are one phrase — the looper's Rec and Play — so
 * they show together or not at all. On and a channel letter are two facts,
 * and each shows on its own.
 *
 * `between` is the room the corner row keeps between its two words: the
 * browser's row has a gap of its own, and the phone's has none, so there it
 * is the same two points as the gap to the picture.
 */
export function cornerFit({ width, picture, pictureTop, bandBottom, inset, left, right, gap = 2, between = gap, pair = false }) {
  const measured = (w) => Number.isFinite(w) && Number.isFinite(width) && Number.isFinite(inset)
  const none = (w) => w === null || w === 0

  /* Whole in the row, whatever else is in the tile. A tall tile, or one with
     no picture, has nothing for a word to touch, and that was taken to mean
     any word fits: on a 76px browser tile with its picture below the row,
     Rec and Play came out as "R… Pl…", each cut to share a row too narrow
     for both. So every word is measured against the row, in every tile. */
  let l = none(left) || (measured(left) && inset + left + inset <= width)
  let r = none(right) || (measured(right) && inset + right + inset <= width)

  /* Beside the picture, by GAP or more, so the end of a word and the edge of
     the picture never read as one shape — unless the picture starts below
     the corner row, the tall tile, where the two cannot meet. */
  if (picture > 0 && !(pictureTop >= bandBottom)) {
    const from = (width - picture) / 2
    const to = (width + picture) / 2
    l = l && (none(left) || inset + left + gap <= from)
    r = r && (none(right) || width - inset - right - gap >= to)
  }

  /* And beside each other. Two words that each fit can still not fit
     together; then one goes rather than both being cut short, and it is the
     right one — the channel, on an effect — because whether a block is on
     is the thing a player is looking for. */
  if (l && r && !none(left) && !none(right) && inset + left + between + right + inset > width) r = false

  if (pair && !(l && r)) return { left: false, right: false }
  return { left: l, right: r }
}
