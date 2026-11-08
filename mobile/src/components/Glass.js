import { View } from 'react-native'

import { classic, glassCard } from '../lib/glass'
import { color } from '../lib/theme'

/**
 * A card of frosted glass: a list group, a tip, a step. See lib/glass.
 *
 * `clip` cuts what is inside to the rounded corner, for rows that reach the
 * card's edge. On an iPhone React Native gives a clipped view a separate
 * layer for its shadow, so the shadow still shows; on Android a view's own
 * overflow never clips its own shadow. `flat` has no drop (inside a sheet),
 * and `bordered` colours a 1px border the caller already gives it.
 *
 * In Classic the card is the panel it was before the glass (lib/theme lays
 * the colours and the corner back), and a `bare` one, a group that had no
 * card at all before, is a plain View with only the caller's own style.
 */
export function GlassCard({ flat = false, bordered = false, clip = false, pressed = false, bare = false, style, children, ...viewProps }) {
  if (bare && classic()) {
    return (
      <View {...viewProps} style={style}>
        {children}
      </View>
    )
  }
  return (
    <View {...viewProps} style={[glassCard({ pressed, bordered, flat }), clip ? { overflow: 'hidden' } : null, style]}>
      {children}
    </View>
  )
}

/**
 * A round disc of glass behind an icon that has none: the top bar's speaker
 * and gear. Drawn as the FIRST child of the icon's own button and centred on
 * it, absolutely, so it takes no room, moves nothing, and never takes a touch;
 * the icon is drawn over it. Not drawn at all in Classic, where the icons
 * stood on the bar by themselves.
 *
 * Centred by numbers, from the button's own size (`box`, the icon's: 24 for
 * the speaker, 22 for the gear), never by "50%" and a negative margin. That
 * was right across and wrong down: on the phone the halfway point down came
 * out of a taller box than the button, so both discs sat about 6 points
 * below their icons ("The volume and settings button is a little
 * off-center", Justin, 8 November 2026, with a screenshot).
 */
export function GlassDisc({ size = 30, box = 24 }) {
  if (classic()) return null
  const edge = (box - size) / 2
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
      style={{
        position: 'absolute',
        left: edge,
        top: edge,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color.glassFill,
        boxShadow: color.glassLiftRing
      }}
    />
  )
}
