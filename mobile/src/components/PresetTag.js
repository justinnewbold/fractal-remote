import { Pressable, Text, View } from 'react-native'

import { color, font, isDark, radius, space, TAP } from '../lib/theme'
import { TAG_WIDTH, tagButtonWords, tagFill, tagSaid } from '../lib/colourPage'
import { tick } from '../lib/feedback'

/**
 * A PRESET'S COLOUR TAG, the editors' "Assign Color": a thin bar on its row
 * in the preset list and in a setlist, and down the left of its button on
 * Play, so a set of presets can be told apart by eye — the clean ones blue,
 * the heavy ones red. Kept per unit and preset number like a star (lib/looks
 * setPresetColour), and chosen on the colour sheet every other colour is:
 * by holding the preset in the list, or from Settings → Colours.
 *
 * A bar, never a fill: the row is still the row, its letters the app's own,
 * and the amber that marks the preset you are on still the one thing in the
 * list that says so.
 */

/**
 * The bar, as a style for the left edge of whatever is the preset's row.
 * Null for a preset without a tag, so a row nobody tagged is drawn exactly as
 * it was. The colour is lib/colourPage tagFill's, the one rule both ends draw
 * the bar by: the colour itself on the dark page, half way to black on paper.
 */
export function tagEdge(fill) {
  if (!fill) return null
  return { borderLeftWidth: TAG_WIDTH, borderLeftColor: tagFill(fill, { light: !isDark() }) }
}

/**
 * The loaded preset, on the Colours page, drawn as its row in the list is —
 * the bar, if it has one — and a press opens its colour sheet. What its tag
 * is now is said on the right, so the row reads as a choice already made or
 * still to make. In the list itself a preset is held for this instead
 * (screens/Presets): a button on every row there cost every name its width.
 */
export function TagRow({ words, fill, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tagButtonWords(words, fill)}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: TAP,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.rule,
        backgroundColor: pressed ? color.panelHi : color.panel,
        ...tagEdge(fill)
      })}
    >
      <Text numberOfLines={1} style={{ flex: 1, color: color.silk, fontSize: font.body, fontWeight: '600' }}>
        {words}
      </Text>
      <Text style={{ color: color.silkDim, fontSize: font.small }}>{tagSaid(fill)}</Text>
    </Pressable>
  )
}

/**
 * A preset's tag on the colour sheet, drawn as its row in the preset list
 * draws it: the name, and the bar down its left edge (tagEdge above) once it
 * has one. The name on two lines if it needs them: the sheet is titled
 * "Preset colour", so this is where the name is read.
 */
export function TagPreview({ words, fill }) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: TAP,
        justifyContent: 'center',
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.rule,
        backgroundColor: color.panel,
        ...tagEdge(fill)
      }}
    >
      <Text numberOfLines={2} style={{ color: color.silk, fontSize: font.body, fontWeight: '600' }}>
        {words}
      </Text>
    </View>
  )
}
