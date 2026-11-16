/**
 * WHERE A KNOB POINTS, for the phone's knob and the browser's alike.
 *
 * "The design of the parameter knob does not match the actual one. This is
 * very irritating. So min on left side and max on right." (A customer on an
 * FM9, 16 November 2026.) He was right, on every connection and both ends:
 * the two knobs had the same start and sweep, and each turned its drawing a
 * further quarter turn on the way to the screen. The lowest setting pointed
 * to half past ten, the middle straight right and the highest to half past
 * seven, with the gap on the left, so a knob turned fully up looked like one
 * turned fully down on the unit. Two copies drifted by the same quarter turn
 * and nobody saw it, so there is one copy now and a test that asks where the
 * ends and the middle point.
 *
 * Angles are DEGREES CLOCKWISE FROM TWELVE O'CLOCK, as a watch reads them:
 * the phone turns a view by that much, and the browser works out the point
 * on its circle from it. A knob sweeps from half past seven (the lowest)
 * through twelve (the middle) to half past four (the highest), with the gap
 * at the bottom, as on the unit and in the Edit mockup Justin approved.
 *
 * A knob whose range is the same either side of nought (Balance, Pan, an
 * EQ's gain, Feedback) is lit from twelve outward, to the left for a value
 * under nought and to the right for one over it, as a centred control is
 * on the unit. One that only crosses nought (a Level of -80 to +20 dB) is
 * lit from its lowest, like any other.
 */

/** Where the sweep starts, clockwise from twelve: half past seven. */
export const DIAL_START = -135

/** How far it sweeps: to half past four. One number, if the unit's turns out wider. */
export const DIAL_SWEEP = 270

const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0)

/** The angle for a place along the knob's travel (0 the lowest, 1 the highest). */
export const dialAngle = (place) => DIAL_START + clamp01(place) * DIAL_SWEEP

/** Whether a setting's range is the same either side of nought, so the knob is lit from the middle. */
export function centred(param) {
  const min = Number(param?.min)
  const max = Number(param?.max)
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(min < 0 && max > 0) || param?.log === true) return false
  return Math.abs(min + max) <= 0.001 * Math.max(-min, max)
}

/** Where the lit part of the knob starts along its travel: the lowest, or the middle for a centred one. */
export const litFrom = (param) => (centred(param) ? 0.5 : 0)

/**
 * Which of `ticks` marks round the phone's dial are lit, as [first, last]:
 * from the lowest mark up to the value, or from the one at twelve out to it
 * for a centred setting (that mark alone at nought).
 */
export function litMarks(place, param, ticks) {
  const last = ticks - 1
  const at = Math.round(clamp01(place) * last)
  const from = Math.round(litFrom(param) * last)
  return [Math.min(from, at), Math.max(from, at)]
}
