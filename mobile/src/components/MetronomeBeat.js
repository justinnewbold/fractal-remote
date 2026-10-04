import { useCallback, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'

import { usePhoneClick } from '../lib/metronome'
import { color } from '../lib/theme'

/**
 * The phone's half of the metronome, until it can make a sound.
 *
 * A frame round the whole screen that lights on every beat, and a tap you feel
 * with it (usePhoneClick). Over everything and touching nothing — it never
 * takes a press away from the screen under it. Drawn only while the setting
 * says the phone clicks and there is a tempo to click at.
 */
export default function MetronomeBeat({ bpm }) {
  const glow = useRef(new Animated.Value(0)).current
  const onBeat = useCallback(() => {
    glow.setValue(1)
    Animated.timing(glow, { toValue: 0, duration: 140, useNativeDriver: true }).start()
  }, [glow])
  usePhoneClick(bpm, onBeat)

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      style={[StyleSheet.absoluteFill, { borderWidth: 4, borderColor: color.ok, opacity: glow }]}
    />
  )
}
