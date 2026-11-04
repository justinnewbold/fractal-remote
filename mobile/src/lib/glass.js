/**
 * Frosted glass: what each piece of the chrome is drawn with.
 *
 * "As far as the real iPhone liquid glass, let's wait on that, but let's go
 * ahead and do the other one with the frosted glass look." And before it: "I
 * just don't wanna lose all the colors and current color scheme cause I like
 * those also." So the rule is CONTENT FIRST. The scene tiles, the pedals, the
 * Looper, the swatches and the lists keep their colours and their shapes; only
 * the controls and the chrome (buttons, bars, sheets, panes, list groups)
 * float as glass over them: a see-through fill, a thin bright edge along the
 * top, a soft rim and a soft shadow. The layout, the words and what every
 * button does stay exactly as they were. A rim on a piece that had no border
 * is drawn as a ring inside it, so nothing moves by a point.
 *
 * NOTHING HERE RELIES ON A BLUR. Android has none without a native view
 * (expo-blur falls back to a flat tint), so every fill is chosen to read at
 * 4.5:1 or better with no credit for what a blur would take away. Real blur
 * stays where it was: the top bar, the sheets and the four pop-up panes.
 *
 * NOR ON A SHADOW. React Native 0.86 draws box-shadow on Android only from
 * Android 9 for a drop and Android 10 for an inset (OutsetBoxShadowDrawable,
 * InsetBoxShadowDrawable), and skips it below without a word; the app runs
 * from Android 7. So on Android 9 and older the light along the top and the
 * ring inside unbordered glass are not drawn, and on Android 8.1 and older
 * no drop either. Nothing breaks: every fill and every word was worked out
 * with no shadow at all, and the glass against the page is about what the
 * old panel was. Newer phones, and every iPhone, draw all of it.
 *
 * SOLID IN SUNLIGHT. Sunlight is the look for reading on a bright stage, and
 * an iPhone set to Reduce Transparency has asked for the same thing: there
 * the glass keeps its shapes and its light edge, and is opaque (lib/theme
 * setSolidChrome swaps the five fills for the colour each draws on the plain
 * ground).
 *
 * Pure, and loaded by the tests under plain Node: it imports the theme alone,
 * by its file name, and nothing from react-native. Every builder reads
 * `color` when it is called, never once at load, so a change of theme, look
 * or Reduce Transparency repaints it on the next render.
 */
import { color, radius } from './theme.js'

/** The look whose chrome is drawn solid. */
export const SUNLIGHT_LOOK = 'sunlight'

/** Whether the glass is drawn solid: the Sunlight look, or Reduce Transparency on. */
export const chromeSolid = ({ look, reduceTransparency } = {}) => look === SUNLIGHT_LOOK || reduceTransparency === true

/** A capsule's corner: half its height. */
export const capsule = (height) => height / 2

/**
 * A control on the plain ground: the frosted fill, a rim and the lift.
 * `bordered` (a piece with its own 1px border) colours that border; without
 * one, the rim is a ring drawn inside, so the layout does not change.
 */
export function glassControl({ pressed = false, bordered = true } = {}) {
  const backgroundColor = pressed ? color.glassFillHi : color.glassFill
  return bordered
    ? { backgroundColor, borderColor: color.glassRim, boxShadow: color.glassLift }
    : { backgroundColor, boxShadow: color.glassLiftRing }
}

/**
 * A card or a list group, at the glass's corner. `flat` has no drop shadow:
 * a row, or a card inside a sheet, where a button on it is the second layer
 * of glass and never the third.
 */
export function glassCard({ pressed = false, bordered = false, flat = false } = {}) {
  const backgroundColor = pressed ? color.glassFillHi : color.glassFill
  return bordered
    ? { backgroundColor, borderRadius: radius.card, borderColor: color.glassRim, boxShadow: flat ? color.glassTop : color.glassLift }
    : { backgroundColor, borderRadius: radius.card, boxShadow: flat ? color.glassFlat : color.glassLiftRing }
}

/** Something floating over the tiles: it keeps its own opaque fill and shadow, and gets the light along its top. */
export const glassFloat = () => ({ boxShadow: color.glassTop })

/** A bottom sheet's panel. */
export const glassSheet = () => ({ backgroundColor: color.sheetFill, borderColor: color.glassRim, boxShadow: color.sheetLift })

/** A pop-up pane, which keeps its own fill. */
export const glassPane = () => ({ borderColor: color.glassRim, boxShadow: color.glassLift })

/**
 * A lit control, in its colour: amber, cyan or silk. `glowing` is one that
 * already has a glow or elevation of its own, so it gets the light only.
 */
export function glassLit(accent, { glowing = false } = {}) {
  return {
    backgroundColor: accent,
    borderColor: accent,
    boxShadow: glowing ? color.glassLitTop : color.glassLit,
    experimental_backgroundImage: color.glassSheen
  }
}

/** A text field: frosted, rimmed, at the card's corner, with no shadow. */
export const glassField = () => ({ backgroundColor: color.glassFill, borderColor: color.glassRim, borderRadius: radius.card })
