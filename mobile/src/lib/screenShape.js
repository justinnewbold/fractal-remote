/**
 * A SCREEN OF ANY SHAPE: what the app keeps clear of, and which way up its
 * pop-ups may turn.
 *
 * The app was drawn for a phone held upright, and two things about that were
 * written in as if they were always true: that only the top and the bottom of
 * the screen have something of the phone's own in them (the clock, the island,
 * the home bar), and that a pop-up only ever opens the right way up. An iPad
 * turned on its side, an Android tablet or a Galaxy Fold that sets the upright
 * lock aside, and the iPhone Duo, whose clock and camera sit in a strip down
 * one side of the screen, make neither true.
 *
 * Neither changes a phone held upright: it has nothing of its own down its
 * sides, and it cannot be turned while the app is locked upright.
 */

/**
 * Every edge, so nothing is drawn under the strip down the side where the
 * Duo keeps its clock and camera, or under a tablet's camera on its side.
 * The app's frame (App.js) and Add songs (components/SongPicker) each hold
 * the rest of the app inside these.
 */
export const SAFE_EDGES = ['top', 'bottom', 'left', 'right']

/**
 * Every way up, on every pop-up (each React Native Modal: the sheets, the
 * tuner, the tempo box, the volume, the password box and Add songs).
 *
 * An iPhone pop-up turns only upright unless it is told otherwise, whatever
 * the screen under it is doing (React Native's RCTModalHostViewComponentView);
 * an iPad's already turns every way, which is what this asks for by name.
 * A pop-up can only turn the ways the app itself is allowed to (app.json's
 * "portrait" lock on an iPhone), so an iPhone held upright sees no change.
 * The one place it can show is an iPhone with a Home button held upside
 * down, where iOS may now turn an open pop-up the right way up for whoever
 * is holding it, as an iPad's always has.
 */
export const ANY_WAY_UP = ['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']

/**
 * HOW WIDE TO DRAW SOMETHING BEFORE IT HAS MEASURED ITSELF: Play's first
 * frame every time it comes back (from Setlists, Settings, Edit), and a
 * sheet's every time it opens. The measurement corrects it one frame later,
 * as it always has, and every line is decided by that measurement from then
 * on; this is only the frame before it exists.
 *
 * `kept` is what was measured before, newest first, each { width, window }:
 * the width measured, and how wide the window said it was at that moment.
 * The first of them measured in a window the width it is now is believed,
 * so a Play that left an iPad or a Duo opened comes back in the shape it left
 * in, even where the window's own size does not follow a fold. One measured
 * in a window of any other width is not: the window changed while it was
 * away (a Galaxy Fold folded on Setlists, an iPad's divider dragged on
 * Settings), and the old width would draw the old shape for a frame.
 *
 * With nothing believed, the window's width less the phone's own down its
 * sides (`insets`), which is the width the app's frame leaves Play wherever
 * the window follows a resize. On a phone held upright that is the window's
 * own width, to the fraction an Android phone's has (411.43 on most of
 * them): the width Play's first frame was always drawn at. And so is one
 * believed within a point of it: a measurement is that same width in the
 * layout's own rounding (411.428558 for 411.428571), and the window's own
 * number keeps the first frame the one it always was, pixel for pixel. Only
 * the shape it was in is taken from what was kept, for the lines' memory.
 */
export function firstFrame(window, kept = [], insets = null) {
  const across = Math.max(0, Number(window) || 0)
  const side = (n) => Math.max(0, Number(n) || 0)
  const guess = Math.max(0, across - side(insets?.left) - side(insets?.right))
  const same = kept.find((k) => k && k.width > 0 && k.window === across)
  if (!same) return { width: guess, window: across, shape: null }
  return Math.abs(same.width - guess) < 1 ? { ...same, width: guess } : same
}

/**
 * A POP-UP'S SIDES, clear of the phone's own. Each pop-up (a React Native
 * Modal) is a screen of its own over the app, outside the app's frame, so
 * the frame keeping clear of every side (SAFE_EDGES) does nothing for it:
 * on the iPhone Duo closed, a sheet's ✕ and the tempo box's right edge sat
 * under the strip down the side where it keeps its clock and camera, and an
 * Android tablet's camera on its side did the same. So each pop-up's own
 * margin `pad` is taken from the strip rather than from the glass's edge:
 * `pad` plus what the phone keeps down that side, as the app's own pages are
 * 16 in from it.
 *
 * A phone held upright has nothing down its sides, so its pop-ups have
 * exactly the margin they always had. null when there is nothing to add.
 */
export function clearSides(insets, pad = 0) {
  const side = (n) => Math.max(0, Number(n) || 0)
  const left = pad + side(insets?.left)
  const right = pad + side(insets?.right)
  return left || right ? { paddingLeft: left, paddingRight: right } : null
}
