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
 * the screen's size, which on an iPhone names the model family. The iPhone
 * values are the ones iOS itself reports (kylebshr/ScreenCorners lists
 * them); the Android ones are Google's own (AOSP rounded_corner_radius).
 *
 * ERRS ROUND. A frame curving more than the glass sits wholly inside the
 * corner and is all seen, with a sliver of dark at the corner; one curving
 * less loses its corner behind the glass, which is the thing being fixed. So
 * a size two models share takes the rounder of the two, and a size not
 * listed takes the roundest iPhone.
 */

/* Portrait width × height in points → the corner radius in points. */
const IPHONES = {
  '320x693': 50, // Display Zoom on the 5.4- to 6.3-inch Face ID iPhones (the roundest is 49.4)
  '375x812': 44, // X, XS, 11 Pro (39); 12 mini, 13 mini (44). And Display Zoom on the big ones: see ZOOMED
  '414x896': 41.5, // XR, 11 (41.5); XS Max, 11 Pro Max (39)
  '390x844': 47.33, // 12, 12 Pro, 13, 13 Pro, 14, 16e; the 17e is assumed the same
  '428x926': 53.33, // 12 Pro Max, 13 Pro Max, 14 Plus
  '393x852': 55, // 14 Pro, 15, 15 Pro, 16
  '430x932': 55, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  '402x874': 62, // 16 Pro, 17, 17 Pro; the 18 Pro is the same panel, assumed the same
  '420x912': 62, // Air
  '440x956': 62 // 16 Pro Max, 17 Pro Max; the 18 Pro Max is the same panel, assumed the same
}

/*
 * DISPLAY ZOOM. With Larger Text zoom on, every big Face ID iPhone — a
 * 17 Pro Max among them — says it is 375 × 812, the size of an X. Its glass
 * in those zoomed points is far rounder than an X's (52.8 on a 17 Pro Max,
 * 55.4 on an Air), so 44 would cut its corners off again. The phones that
 * really are 375 × 812 have a status bar of 44 (X, XS, 11 Pro) or 50 (12 and
 * 13 mini); anything else at that size is a bigger phone, zoomed.
 */
const NATIVE_375 = [44, 50]
const ZOOMED = 58

/* An iPhone this list does not know yet. */
const NEWER_IPHONE = 62

/* iPads with rounded screens: 18 on the Pro and Air, reported up to 21.5 on the mini. */
const IPAD = 22

/**
 * The corner radius for a screen.
 *
 *   os      'ios' | 'android'
 *   width, height   the window in points (the same as the screen on a phone)
 *   top, bottom     the safe-area insets. The bottom one is the home
 *           indicator: 34 on a Face ID iPhone, 20 on a rounded iPad, and 0 on
 *           every iPhone and iPad with a home button, whose glass is square.
 *   pad     whether this is an iPad (Platform.isPad)
 */
export function cornerRadius({ os, width, height, top = 0, bottom = 0, pad = false } = {}) {
  const w = Math.round(Math.min(width || 0, height || 0))
  const h = Math.round(Math.max(width || 0, height || 0))
  if (!w || !h) return 0
  if (os === 'ios') {
    if (!(bottom > 0)) return 0
    if (pad) return IPAD
    const size = `${w}x${h}`
    if (size === '375x812' && !NATIVE_375.includes(Math.round(top))) return ZOOMED
    return IPHONES[size] ?? NEWER_IPHONE
  }
  if (os === 'android') {
    /*
     * Every maker curves its own, and only native code can ask. Google's
     * own: Pixel 8 39, 8a 49, 9 50, 9 Pro 52, 9 Pro XL 51, 8 Pro 30 (on
     * screens 411 to 448 wide); Samsung publishes none. A little over an
     * eighth of the width is rounder than all of them, and on a phone with
     * square corners it is only a soft corner on the flash. Capped, so a
     * tablet or an unfolded phone is not given a curve its glass lacks.
     */
    return Math.min(60, Math.ceil(w * 0.13))
  }
  return 0
}
