import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'

import { color } from '../lib/theme'

/**
 * A GREEN LIGHT ON TAP THAT FLASHES AT THE TEMPO.
 *
 * "Can we add a green light dot to the tap tempo button that flashes at the
 * current tempo." The unit's own Tap LED does this, and it is the quickest
 * way to see whether the tempo is right without counting the number: tap
 * along, and watch the light land on the beat or not.
 *
 * Plain Animated with the native driver, so it keeps time on the UI thread
 * however busy the JavaScript is. A short flash on each beat, dim between.
 * No tempo from the unit, no light — a light blinking at a made-up speed
 * would be worse than none.
 */
export default function TempoDot({ bpm, size = 8 }) {
  const glow = useRef(new Animated.Value(0.25)).current
  const beat = Number.isFinite(bpm) && bpm >= 20 && bpm <= 400 ? 60000 / bpm : null

  useEffect(() => {
    if (!beat) return undefined
    const flash = Math.min(90, beat * 0.3)
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: flash, useNativeDriver: true }),
        Animated.timing(glow, {
          toValue: 0.25,
          duration: Math.max(1, beat - flash - 1),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        })
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [beat, glow])

  if (!beat) return null
  return (
    <Animated.View
      accessible={false}
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color.ok,
        opacity: glow
      }}
    />
  )
}
