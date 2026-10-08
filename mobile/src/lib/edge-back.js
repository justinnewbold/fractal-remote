/**
 * WHEN A SIDEWAYS DRAG MEANS "BACK" — the decisions behind EdgeBack, kept out
 * of the component so they can be tested without a phone.
 *
 * "On the edit screen when swiping from left to right to scroll the blocks it
 * goes back to the Home Screen."
 *
 * FROM ANYWHERE ON THE SCREEN, AND THAT IS NOW ON PURPOSE. EdgeBack was
 * written to take only drags that began at the left edge, and it read where
 * the drag began from PanResponder's `x0`. React Native only fills `x0` in
 * when the responder is GRANTED; before that it is the 0 it was reset to when
 * the finger went down, and the question is asked before any grant. So every
 * drag "began at the edge", and back has always worked from anywhere. That is
 * the swipe everyone has been using since it shipped, and it is how iOS 26
 * itself goes back, so it stays — said plainly here instead of hidden behind
 * a check that never ran.
 *
 * WHAT IT GIVES WAY TO is the same thing iOS gives way to: a row that
 * scrolls sideways. Left to right is exactly how such a row is scrolled back
 * towards its start, and the chain on the Edit screen is a long row by
 * design. So a sideways scroller (SideScroll) says so the moment it is
 * touched, and the back gesture stands aside until every finger is up.
 * Knobs, sliders and swipe-to-remove rows claim their own drags and keep
 * them; this never captures from a child.
 */

/** How far it has to travel before the claim is made, in pixels. */
export const CLAIM = 10
/** How far it has to end up, unless it was thrown. */
export const TRAVEL = 60
/** A flick: fast enough that distance stops mattering. */
export const FLICK = 0.35

/** Whether a drag in progress is the back gesture, and should be taken. */
export function claimsBack(g, sideways = false) {
  if (sideways) return false
  return g.dx > CLAIM && Math.abs(g.dx) > Math.abs(g.dy) * 2
}

/** Whether a claimed drag, let go, went far enough (or fast enough) to go back. */
export const goesBack = (g) => g.dx > TRAVEL || (g.vx > FLICK && g.dx > CLAIM)

/*
 * The sideways hold. One for the whole app, because only one touch sequence
 * happens at a time and both EdgeBacks (the app's and Settings' own) need to
 * hear it. Set by SideScroll on touch-down; cleared by EdgeBack when the last
 * finger lifts or the touch is cancelled, so it cannot outlive the drag.
 */
let held = false
export const holdSideways = () => {
  held = true
}
export const releaseSideways = () => {
  held = false
}
export const sidewaysHeld = () => held
