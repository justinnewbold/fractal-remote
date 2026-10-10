import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'

import { onPhoneBeat, usePhoneClicking } from '../lib/metronome'
import { color } from '../lib/theme'

/**
 * A GREEN LIGHT ON TAP THAT FLASHES AT THE TEMPO.
 *
 * "Can we add a green light dot to the tap tempo button that flashes at the
 * current tempo." The unit's own Tap LED does this, and it is the quickest
 * way to see whether the tempo is right without counting the number: tap
 * along, and watch the light land on the beat or not.
 *
 * WHILE THE PHONE CLICKS, IT LIGHTS ON THE PHONE'S OWN BEAT — the same moment
 * as the edge flash and the tap you feel (lib/metronome onPhoneBeat). A light
 * on a clock of its own beside a click on another is the "they're not at the
 * same time" this was changed for.
 *
 * Otherwise one native timing, looped on the UI thread. It used to be a loop
 * of a three-step sequence, and a sequence is not looped natively: every beat
 * went back to the JavaScript to start the next, and was stretched by the
 * trip, so the light slid behind the tempo a little more each bar. One timing
 * of one beat's length, read through a curve that is bright for the flash and
 * fades after it, never leaves the UI thread.
 *
 * No tempo from the unit, no light — a light blinking at a made-up speed
 * would be worse than none.
 */
export default function TempoDot({ bpm, size = 8 }) {
  const glow = useRef(new Animated.Value(0.25)).current
  const phase = useRef(new Animated.Value(0)).current
  const beat = Number.isFinite(bpm) && bpm >= 20 && bpm <= 400 ? 60000 / bpm : null
  const followsPhone = usePhoneClicking()

  useEffect(() => {
    if (!beat || !followsPhone) return undefined
    const flash = Math.min(90, beat * 0.3)
    glow.setValue(0.25)
    return onPhoneBeat(() => {
      glow.setValue(1)
      Animated.timing(glow, { toValue: 0.25, delay: flash, duration: Math.max(1, beat - flash), easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
    })
  }, [beat, followsPhone, glow])

  useEffect(() => {
    if (!beat || followsPhone) return undefined
    phase.setValue(0)
    const loop = Animated.loop(Animated.timing(phase, { toValue: 1, duration: beat, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [beat, followsPhone, phase])

  /* Bright for the flash, then an ease-out fade to dim, drawn as points: a native curve takes no easing of its own. */
  const lit = beat ? Math.min(90, beat * 0.3) / beat : 0.3
  const fade = (t) => lit + (1 - lit) * t
  const looped = phase.interpolate({
    inputRange: [0, lit, fade(0.15), fade(0.35), fade(0.6), 1],
    outputRange: [1, 1, 0.73, 0.47, 0.32, 0.25]
  })

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
        opacity: followsPhone ? glow : looped
      }}
    />
  )
}
