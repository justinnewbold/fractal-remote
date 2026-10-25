/**
 * How big a one-line word or name is drawn on a button, for both apps.
 *
 * "The previous/next buttons and the preset names are not showing up
 * correctly on the previous and next buttons" (Justin, 25 October 2026, with
 * Play on his iPhone reading "Previ..." over "OLIVIA RODRI..." beside a whole
 * "Next" over "GREEN DAY"). The word and the line under it were each cut to
 * the width of a third of the screen, and a cut name is the one thing that
 * line is there to say.
 *
 * So a word or line too wide for its room is drawn smaller, just as much as
 * it needs, down to a floor (`least`), and only past the floor is it cut. A
 * size is rounded down to the half point, and a little room is left at the
 * edge, because the two ends round text differently and a name one pixel
 * too wide would still be cut.
 *
 * Measured once, at the size it would be drawn (`size`), and scaled: a word
 * at nine tenths of the size is nine tenths as wide. Each end measures its
 * own way, the phone with an unseen copy of the words, the browser with a
 * canvas, and both hand this the same numbers.
 */

/* A little room left at the edges, as name-fit leaves. */
export const LINE_ROOM = 0.97

/** The smallest the words Previous and Next are drawn at, from the body size (15). */
export const STEP_WORD_LEAST = 11

/** The smallest the name under Previous or Next is drawn at, from the micro size (11). */
export const STEP_LINE_LEAST = 9

/**
 * How far the line under Previous and Next reaches into the button's side
 * padding, each side: to 4 from the edge, where the name has the most room a
 * button can give it without touching its border.
 */
export const STEP_LINE_EDGE = 4

/**
 * The size to draw a one-line text at, and whether it fits there.
 *
 * `natural`: its width drawn at `size`. `room`: the width it has. `least`:
 * the smallest size allowed. Not measured yet (no width, no room) is drawn as
 * before, at `size`, and said to fit, so nothing is changed on a guess.
 * Too wide even at `least` is `least`, cut, and `fits` false.
 */
export function fitLine({ natural, room, size, least } = {}) {
  if (!(size > 0)) return { size, fits: true }
  if (!(natural > 0) || !(room > 0)) return { size, fits: true }
  const floor = least > 0 && least < size ? least : size
  const space = room * LINE_ROOM
  if (natural <= space) return { size, fits: true }
  const scaled = Math.floor(((size * space) / natural) * 2) / 2
  if (scaled >= floor) return { size: scaled, fits: true }
  return { size: floor, fits: false }
}

/**
 * Previous or Next on the phone: the size of its word, whether its chevron
 * gives way, and the size of the line under it, from the button's own
 * measures (`pad` its side padding, `border` its border, `gap` the space
 * beside a picture, `picture` a picture's width, `pictures` how many sit
 * beside the word) and the two texts' widths at their usual sizes (`word` at
 * `size`, `under` at `underSize`).
 *
 * The word fits beside its chevron if it can; if it cannot, the chevron
 * gives way and the word takes the whole button, fitted again, because the
 * word is what says which way the button goes. The line under runs to `edge`
 * inside the border. A button not measured yet is drawn as before.
 */
export function fitStep({ box, pad, border, gap, picture, pictures = 0, word, size, under, underSize, edge = STEP_LINE_EDGE } = {}) {
  const inner = box > 0 ? box - 2 * pad - 2 * border : 0
  const beside = inner - pictures * (picture + gap)
  let label = inner > 0 && pictures > 0 && beside <= 0 ? { size, fits: false } : fitLine({ natural: word, room: beside, size, least: STEP_WORD_LEAST })
  let bare = false
  if (!label.fits && pictures > 0) {
    label = fitLine({ natural: word, room: inner, size, least: STEP_WORD_LEAST })
    bare = true
  }
  const line = fitLine({ natural: under, room: inner > 0 ? inner + 2 * (pad - edge) : 0, size: underSize, least: STEP_LINE_LEAST })
  return { label, bare, line }
}
