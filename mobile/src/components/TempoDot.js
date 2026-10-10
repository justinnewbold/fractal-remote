import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'

import { onPhoneBeat, usePhoneClicking } from '../lib/metronome'
import { nextBeat } from '../lib/metronome-rules'
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
 * Otherwise on a beat counted from when it started (shared nextBeat), the way
 * the phone's own click is. It used to loop an animation one beat long, and
 * an animation loop restarts on whole screen frames: every beat came out a
 * frame long, so at 120 BPM the light ran at about 116 and was a whole beat
 * behind within half a minute. Counted from the start, a timer that is late
 * once is late once. Each flash itself is still drawn natively.
 *
 * No tempo from the unit, no light — a light blinking at a made-up speed
 * would be worse than none.
 */
export default function TempoDot({ bpm, size = 8 }) {
  const glow = useRef(new Animated.Value(0.25)).current
  const beat = Number.isFinite(bpm) && bpm >= 20 && bpm <= 400 ? 60000 / bpm : null
  const followsPhone = usePhoneClicking()

  useEffect(() => {
    if (!beat) return undefined
    const flash = Math.min(90, beat * 0.3)
    const light = () => {
      glow.setValue(1)
      Animated.timing(glow, { toValue: 0.25, delay: flash, duration: Math.max(1, beat - flash), easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
    }
    glow.setValue(0.25)
    if (followsPhone) return onPhoneBeat(light)
    const startedAt = Date.now()
    let timer = null
    const step = () => {
      light()
      timer = setTimeout(step, Math.max(0, nextBeat(startedAt, Date.now(), beat) - Date.now()))
    }
    step()
    return () => clearTimeout(timer)
  }, [beat, followsPhone, glow])

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
