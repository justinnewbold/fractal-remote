import { useCallback, useRef } from 'react'
import { Animated, Platform, StyleSheet, useWindowDimensions } from 'react-native'
import { useKeepAwake } from 'expo-keep-awake'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { usePhoneClick } from '../lib/metronome'
import { cornerRadius } from '../lib/screenCorners'
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
  const clicking = usePhoneClick(bpm, onBeat)
  /* Rounded with the glass, or the corners of the frame are cut off behind it: see lib/screenCorners.
     'continuous' is the iPhone's own curve, which starts bending sooner than a circle; Android ignores it. */
  const { width, height } = useWindowDimensions()
  const { top, bottom } = useSafeAreaInsets()
  const round = cornerRadius({ os: Platform.OS, width, height, top, bottom, pad: Platform.isPad })

  return (
    <>
      {clicking ? <StayAwake /> : null}
      <Animated.View
        pointerEvents="none"
        accessible={false}
        style={[StyleSheet.absoluteFill, { borderWidth: 4, borderRadius: round, borderCurve: 'continuous', borderColor: color.ok, opacity: glow }]}
      />
    </>
  )
}

/**
 * THE SCREEN STAYS ON FOR AS LONG AS THE PHONE IS CLICKING.
 *
 * Play and Edit already keep it awake (useKeepAwake in Stage and Edit), but
 * the click runs on every screen: this component is drawn over the whole app.
 * On the setlist or the preset list the phone locked itself when its own
 * screen timeout came round, and the click stopped with it, mid-song.
 *
 * Mounted only while the click is actually running (usePhoneClick says so),
 * so turning it off, or the tempo going away, lets the phone sleep again as
 * it always has. Its own tag, so it never lets go of the hold Play or Edit
 * has, or they of its: the screen sleeps only once every holder is gone.
 */
function StayAwake() {
  useKeepAwake('metronome')
  return null
}
