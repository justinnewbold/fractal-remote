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
 *
 * Turned on its side the status bar is gone (the top inset is 0) and the
 * notch's inset is on the left and right instead, so the inset on the
 * notch's side is the larger of the three: an X on its side is an X still,
 * not a big phone zoomed.
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
 *   top, bottom, left, right   the safe-area insets. The bottom one is the
 *           home indicator: 34 on a Face ID iPhone (21 on its side), 20 on a
 *           rounded iPad, and 0 on every iPhone and iPad with a home button,
 *           whose glass is square. Left and right are the notch's on its side.
 *   pad     whether this is an iPad (Platform.isPad)
 */
export const cornerRadius = (screen = {}) => glassCorner(screen).radius

/**
 * The same, and whether it is MEASURED: a value iOS itself reports for that
 * size (the iPhone table). Every other is a guess that already errs round
 * (Android's, ZOOMED, NEWER_IPHONE, IPAD), and beatFrame rounds only a
 * measured one further.
 */
export function glassCorner({ os, width, height, top = 0, bottom = 0, left = 0, right = 0, pad = false } = {}) {
  const w = Math.round(Math.min(width || 0, height || 0))
  const h = Math.round(Math.max(width || 0, height || 0))
  const guess = (radius) => ({ radius, measured: false })
  if (!w || !h) return guess(0)
  if (os === 'ios') {
    if (!(bottom > 0)) return guess(0)
    if (pad) return guess(IPAD)
    const size = `${w}x${h}`
    /* The notch's side: the top in portrait, the left or right on its side. */
    if (size === '375x812' && !NATIVE_375.includes(Math.round(Math.max(top, left, right)))) return guess(ZOOMED)
    return size in IPHONES ? { radius: IPHONES[size], measured: true } : guess(NEWER_IPHONE)
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
    return guess(Math.min(60, Math.ceil(w * 0.13)))
  }
  return guess(0)
}

/*
 * THE BEAT'S FRAME, IN FROM THE EDGE AND ROUNDER THAN THE GLASS.
 *
 * "Also the light on the phone cuts off on the corners" (Justin, 16
 * November 2026, his iPhone 17 Pro Max: 440 × 956, 62 in the table). The
 * frame was drawn to the very edge with the glass's own curve, so its
 * outside edge WAS the glass's edge: in theory all of it on the screen, in
 * fact nothing to spare. The last pixel of a curve is the one the display's
 * own mask shades off, and a glass even a little rounder than the table
 * says (nobody can ask the phone, above) takes the corner of the line
 * with it.
 *
 * So it is drawn BEAT_INSET points in from every edge, and BEAT_ROUNDER
 * times as round as the glass where the glass's value is MEASURED (the
 * iPhone table, glassCorner). A guess already errs round (Android's, Display
 * Zoom's, an unlisted iPhone's, an iPad's), and rounding it again swung the
 * frame's corners 12 to 16 points inside the screen's while its sides sat 2
 * in (an independent read: a Pixel 8 Pro, an X on its side); so there the
 * frame takes the guess as it is, moved in by the inset. Both only take it
 * further in: a corner the
 * glass's own shape moved in by the inset sits inside the glass by at least
 * the inset everywhere, and a rounder corner of the same kind cuts more off
 * at every point. With both, the 4-point line (BEAT_LINE) sits wholly
 * inside the visible curve on every size listed above, by at least
 * BEAT_CLEAR points, a measured one stays inside a glass a fifth rounder
 * than the table says (ERRS ROUND, again), and its corner is no more than
 * BEAT_CORNER points inside the screen's. Worked out on Apple's continuous curve and
 * on a plain circle (Android, which draws no continuous curve), every size,
 * in test/line-up.mjs; the price is a sliver of dark in each corner, a few
 * points wide at most.
 */
export const BEAT_INSET = 2
export const BEAT_LINE = 4
export const BEAT_ROUNDER = 1.15
export const BEAT_CLEAR = 1.5
export const BEAT_CORNER = 8

/** Where the beat's frame is drawn on a screen: `{ inset, radius, line }`, in points. A square screen gets a square frame, in from its edges all the same. */
export function beatFrame(screen = {}) {
  const glass = glassCorner(screen)
  return { inset: BEAT_INSET, radius: glass.radius > 0 ? Math.ceil(glass.radius * (glass.measured ? BEAT_ROUNDER : 1)) : 0, line: BEAT_LINE }
}
