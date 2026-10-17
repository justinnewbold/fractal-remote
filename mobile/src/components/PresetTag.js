import { Pressable, Text, View } from 'react-native'

import { color, font, isDark, radius, space, TAP } from '../lib/theme'
import { TAG_WIDTH, tagButtonWords, tagFill } from '../lib/colourPage'
import { tick } from '../lib/feedback'

/**
 * A PRESET'S COLOUR TAG, the editors' "Assign Color": a thin bar on its row
 * in the preset list and in a setlist, and down the left of its button on
 * Play, so a set of presets can be told apart by eye — the clean ones blue,
 * the heavy ones red. Kept per unit and preset number like a star (lib/looks
 * setPresetColour), and chosen on the colour sheet every other colour is.
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
 * The Colour button beside a preset's star: a dot in the preset's colour, or
 * an empty ring for one without, over the word. Its own target, like the
 * star, because it does the opposite of the row beside it — the row loads a
 * preset, and a mis-hit while tagging between songs must not change what the
 * unit is playing.
 */
export function TagButton({ words, fill, onPress }) {
  const dot = fill ? tagFill(fill, { light: !isDark() }) : null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tagButtonWords(words, fill)}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        width: TAP,
        minHeight: TAP,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.rule,
        backgroundColor: color.panel,
        opacity: pressed ? 0.7 : 1
      })}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          borderWidth: dot ? 0 : 2,
          borderColor: color.silkFaint,
          backgroundColor: dot || 'transparent'
        }}
      />
      <Text style={{ color: color.silkDim, fontSize: font.micro }}>Colour</Text>
    </Pressable>
  )
}

/**
 * A preset's tag on the colour sheet, drawn as its row in the preset list
 * draws it: the name, and the bar down its left edge (tagEdge above).
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
      <Text numberOfLines={1} style={{ color: color.silk, fontSize: font.body, fontWeight: '600' }}>
        {words}
      </Text>
    </View>
  )
}
