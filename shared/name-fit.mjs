/**
 * How big a scene's name can be drawn in its tile, for both apps.
 *
 * "The scene names are kind of small on the AM4. Can we make those auto
 * adjust to the screen size so the text is bigger on screens that allow it,
 * and if there's more scenes like on an FM3, the text can shrink?" (Justin,
 * 25 October 2026, with Play on an AM4: four scenes, two across, each tile
 * the size of a palm, and its name in the same small type as the FM3's eight.)
 *
 * So the names take the biggest size their tiles have room for: each whole
 * name on at most two lines, no word cut in two, and no taller than the
 * tile's room under the scene's number. Four big tiles get big names; eight
 * small ones keep the size they always had, which is the floor (`min`), never
 * smaller. A name too long for two lines even at the floor is not fitted at
 * all (`fits` false), and is drawn exactly as it was before.
 *
 * ONE SIZE FOR THE WHOLE GRID (`together`). Each name fitted on its own came
 * out "JUMPED" at 26 beside "CRUNCH BRIGHT" at 15, which reads as two kinds
 * of button. So every fitted name on a screen takes the smallest of their
 * sizes: as big as the longest name allows, the same for all of them.
 *
 * Text is measured once, at one size (`ref`), and scaled: a word twice the
 * size is twice as wide, letter spacing included where it is a share of the
 * size (both ends set it that way for a fitted name). Each end measures its
 * own way, the phone with an unseen copy of the name, the browser with a
 * canvas, and both hand this the same numbers, so a name is the same size on
 * both for the same room.
 */

/** The size a fitted name is measured at. Any size would do; this one keeps rounding small. */
export const NAME_REF = 20

/** The biggest a fitted name grows: big enough to read from a stand, short of shouting. */
export const NAME_MAX = 30

/** Letter spacing as a share of the size, so it scales with the name. */
export const NAME_TRACK = 0.04

/* A little room left at the edges: the two ends round text differently, and a name one pixel too wide would take a third line. */
const ROOM = 0.94

/**
 * How many lines the words take at a size, laid out the way text is: as many
 * words on a line as fit, then the next line. Infinity when one word alone is
 * wider than the line, which no size this one or bigger can fix.
 */
export function linesAt(words, space, scale, width) {
  let lines = 0
  let used = 0
  for (const word of words) {
    const w = word * scale
    if (w > width) return Infinity
    if (lines && used + space * scale + w <= width) used += space * scale + w
    else {
      lines += 1
      used = w
    }
  }
  return lines
}

/**
 * The size to draw a name at, and on how many lines.
 *
 * `words`: each word's width at `ref`. `space`: a space's width at `ref`.
 * `line`: one line's height at `ref`. `width` and `height`: the room for the
 * name in the tile, in the same units. `min` and `max`: the sizes allowed.
 * Null when there is nothing to fit or no room measured yet, which means
 * "draw it as before".
 */
export function fitName({ words, space, line, ref = NAME_REF, width, height, min, max = NAME_MAX, most = 2 } = {}) {
  if (!Array.isArray(words) || !words.length || words.some((w) => !(w > 0))) return null
  if (!(ref > 0) || !(line > 0) || !(space >= 0) || !(width > 0) || !(height > 0) || !(min > 0)) return null
  const top = Math.max(min, Math.floor(max))
  for (let size = top; size >= min; size--) {
    const scale = size / ref
    const lines = linesAt(words, space, scale, width * ROOM)
    if (lines <= most && lines * line * scale <= height) return { size, lines, fits: true }
  }
  return { size: min, lines: most, fits: false }
}

/**
 * The one size for every fitted name in a grid: the smallest of the sizes
 * that fit, or null when none did. A name that did not fit at the floor is
 * left out, and drawn as it always was.
 */
export function together(fitted) {
  const sizes = (fitted || []).filter((f) => f && f.fits && f.size > 0).map((f) => f.size)
  return sizes.length ? Math.min(...sizes) : null
}
