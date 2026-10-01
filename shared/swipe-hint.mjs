/**
 * The first-time hint on a setlist: "Swipe left to delete."
 *
 * "Make some kind of gesture or a toast notification. The first time that
 * screen opens for a new user that says swipe left to delete and kind of show
 * them and have them confirm it."
 *
 * One set of words for both ends, shown once per phone or browser, over a
 * list that has at least one song in it — a hint about a gesture with nothing
 * to do it to is a hint nobody can try. While it is up the first song slides
 * part of the way open and back, so the words have a picture beside them, and
 * it goes when Got it is pressed.
 */
export const SWIPE_HINT = {
  head: 'Swipe left to remove a song',
  body: 'Slide a song to the left. A short slide shows a ✕ to tap; a long slide removes it straight away. The preset itself stays on your unit.',
  ok: 'Got it'
}

/** Where each end remembers the hint was confirmed. */
export const SWIPE_HINT_KEY = 'fractal.coach.swipe.v1'

/** Up only once somebody has a song to try it on, and only until they say they have it. */
export const showSwipeHint = (seen, songs) => seen === false && songs > 0

/* The gesture's numbers, the same at both ends. */
/** How far a row parks when it is opened, and how wide the ✕ behind it is. */
export const SWIPE_OPEN = 84
/** Past this the swipe was not a question: the song goes. */
export const SWIPE_FULL = 180
/** Sideways by this much before the row claims the gesture at all. */
export const SWIPE_CLAIM = 12

/** Where a row lands when it is let go, from how far it was dragged (negative is left). */
export function swipeLanding(dx) {
  if (dx <= -SWIPE_FULL) return 'remove'
  if (dx <= -SWIPE_OPEN / 2) return 'open'
  return 'closed'
}
