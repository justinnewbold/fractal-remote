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
