/**
 * How round the corners of this phone's screen are, in points.
 *
 * "The metronome when it flashes on the edge of the screen. I think it's like
 * a rectangle, so the corners of the screen get cut off where they're
 * rounded." The beat's frame is drawn to the very edge of the screen, so a
 * square one puts its corners behind the glass's curve. Rounded to the same
 * curve, the frame runs round the corners the way the screen does.
 *
 * Neither phone tells an app this. iOS keeps it private and Android only
 * answers from native code, and this is worth no build. So it is read off
 * the screen's size, which on an iPhone names the model family, and the
 * curves below are the ones those families are known to have.
 *
 * ERRS ROUND. A frame curving a little more than the glass sits just inside
 * the corner and is all visible; one curving less is cut off, which is the
 * thing being fixed. So a size two models share takes the rounder of the two,
 * and a size not listed takes the roundest current iPhone.
 */

/* Portrait width × height in points → the corner radius in points. */
const IPHONES = {
  '375x812': 44, // X, XS, 11 Pro (39); 12 mini, 13 mini (44)
  '414x896': 41.5, // XR, 11 (41.5); XS Max, 11 Pro Max (39)
  '390x844': 47.33, // 12, 12 Pro, 13, 13 Pro, 14, 16e
  '428x926': 53.33, // 12 Pro Max, 13 Pro Max, 14 Plus
  '393x852': 55, // 14 Pro, 15, 15 Pro, 16
  '430x932': 55, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  '402x874': 62, // 16 Pro, 17, 17 Pro
  '440x956': 62 // 16 Pro Max, 17 Pro Max
}

/* An iPhone this list does not know yet, with a notch or an island. */
const NEWER_IPHONE = 62

/* iPads with rounded screens (no home button). */
const IPAD = 18

/**
 * The corner radius for a screen.
 *
 *   os      'ios' | 'android'
 *   width, height   the screen in points (Dimensions.get('screen'))
 *   top     the safe-area inset at the top: a phone with a home button has
 *           only the status bar there (20), and square corners
 *   pad     whether this is an iPad (Platform.isPad)
 */
export function cornerRadius({ os, width, height, top = 0, pad = false } = {}) {
  const w = Math.round(Math.min(width || 0, height || 0))
  const h = Math.round(Math.max(width || 0, height || 0))
  if (!w || !h) return 0
  if (os === 'ios') {
    /* A home button: square glass. */
    if (top <= 24) return 0
    if (pad) return IPAD
    return IPHONES[`${w}x${h}`] ?? NEWER_IPHONE
  }
  if (os === 'android') {
    /*
     * Every maker curves its own, and only native code can ask. About a
     * tenth of the width covers the round ones (a Pixel or a Galaxy sits
     * near 35 to 45 on a 400-point-wide screen), and on a phone with square
     * corners it is only a soft corner on the flash.
     */
    return Math.round(w * 0.11)
  }
  return 0
}
