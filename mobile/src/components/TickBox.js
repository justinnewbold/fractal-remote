import { Pressable, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { tick } from '../lib/feedback'

/**
 * A tick box: a square that fills when it is on, with its sentence beside it
 * and the line under that saying what on or off means. The whole row is the
 * target, since the sentence is the bigger one, and it has the checkbox role,
 * so a screen reader says "checked" rather than "selected". The welcome's
 * own (screens/Onboarding Agree), with the line under it.
 *
 * "They should be able to just click a checkbox that says include email"
 * (Justin, 29 October 2026, on the report screen). A tick box reads as one at
 * a glance, where a lit button had to say "on" and "off" in its own words
 * before anybody could tell it was a switch at all.
 */
export default function TickBox({ on, label, sub, disabled = false, onPress }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!on, disabled: !!disabled }}
      accessibilityLabel={label}
      accessibilityHint={sub || undefined}
      disabled={disabled}
      onPress={() => {
        tick()
        onPress?.()
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.md,
        paddingVertical: space.sm,
        minHeight: 44,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1
      })}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radius.sm,
          borderWidth: on ? 0 : 1,
          borderColor: color.silkFaint,
          backgroundColor: on ? color.signal : color.panel,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {on ? <Text style={{ color: color.onSignal, fontSize: font.body, fontWeight: '700' }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: color.silk, fontSize: font.body, lineHeight: font.body * 1.35 }}>{label}</Text>
        {sub ? <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.4 }}>{sub}</Text> : null}
      </View>
    </Pressable>
  )
}
