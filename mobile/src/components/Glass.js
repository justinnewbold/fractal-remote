import { View } from 'react-native'

import { glassCard } from '../lib/glass'
import { color } from '../lib/theme'

/**
 * A card of frosted glass: a list group, a tip, a step. See lib/glass.
 *
 * `clip` cuts what is inside to the rounded corner, for rows that reach the
 * card's edge. On an iPhone React Native gives a clipped view a separate
 * layer for its shadow, so the shadow still shows; on Android a view's own
 * overflow never clips its own shadow. `flat` has no drop (inside a sheet),
 * and `bordered` colours a 1px border the caller already gives it.
 */
export function GlassCard({ flat = false, bordered = false, clip = false, pressed = false, style, children, ...viewProps }) {
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
 * the icon is drawn over it.
 */
export function GlassDisc({ size = 30 }) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: size / 2,
        backgroundColor: color.glassFill,
        boxShadow: color.glassLiftRing
      }}
    />
  )
}
