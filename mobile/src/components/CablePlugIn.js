import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'

import { color, font, space } from '../lib/theme'
import { acceptCable, doneSwitched, notNowCable, sawSwitched, useCablePlugIn } from '../lib/cablePlugIn'
import { CABLE_NOT_NOW, CABLE_OFFER_NOTE, CABLE_SWITCHED, CABLE_USE, cablePluggedIn } from '../lib/cableWords'
import Press from './Press'
import Toast, { useScreenReader, useStillNews } from './Toast'

/** How long "Switched to the USB cable." stays over Play, from when it is first drawn. */
export const SWITCHED_MS = 4000

/**
 * A UNIT PLUGGED IN BY USB CABLE, said over Play (lib/cablePlugIn).
 *
 * Through the computer: "AM4 plugged in by USB cable.", with Use USB cable
 * and Not now. It waits for a tap, since the computer is still the best way
 * and nothing is swapped from under it; Not now puts it away until the cable
 * is unplugged and plugged in again. From a Bluetooth adapter the app has
 * already switched by itself, and "Switched to the USB cable." says so for a
 * few seconds, counted from when Play first draws it (the link reconnects
 * behind the waiting screen first).
 *
 * A Toast, where Play's faults float and the Colors Undo is drawn
 * (components/Colours LookUndo), one card at a time: it stands aside while a
 * fault is up. With a screen reader on the switch's line stays until its ✕,
 * as Undo's does, and the offer is announced.
 */
export function CablePlugIn() {
  const { offer, switched } = useCablePlugIn()
  const reader = useScreenReader()
  const said = offer ? cablePluggedIn(offer.name) : null
  /* The offer waits for its answer, so it never runs out; on an iPhone it is read out when it comes. */
  const offered = useStillNews(said, offer?.at, Infinity)
  const left = switched ? (switched.shownAt ? Math.max(0, switched.shownAt + SWITCHED_MS - Date.now()) : SWITCHED_MS) : 0
  const showing = useStillNews(switched && !offer ? CABLE_SWITCHED : null, switched?.at, left)
  useEffect(() => {
    if (switched && !switched.shownAt) sawSwitched()
  }, [switched])
  /* Its time up, the line goes for good, not only out of sight: Play left and come back to never brings it back. */
  const spent = Boolean(switched) && !offer && !showing
  useEffect(() => {
    if (spent) doneSwitched()
  }, [spent])
  if (offer && offered) {
    return (
      <Toast open yields>
        <View style={{ gap: space.sm, padding: space.sm, paddingLeft: space.md }} accessibilityLiveRegion="polite">
          <Text style={{ color: color.silk, fontSize: font.body }}>{said}</Text>
          {offer.mode === 'computer' ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{CABLE_OFFER_NOTE}</Text> : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Press label={CABLE_USE} tone="live" height={44} onPress={() => acceptCable()} />
            </View>
            <View style={{ flex: 1 }}>
              <Press label={CABLE_NOT_NOW} height={44} onPress={() => notNowCable()} />
            </View>
          </View>
        </View>
      </Toast>
    )
  }
  return (
    <Toast open={Boolean(switched && showing)} yields>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, paddingLeft: space.md }} accessibilityLiveRegion="polite">
        <Text style={{ flex: 1, color: color.silk, fontSize: font.body }}>{CABLE_SWITCHED}</Text>
        {/* With a screen reader on it stays until answered, so it can be put away. */}
        {reader ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={12} onPress={() => doneSwitched()} style={{ paddingHorizontal: space.xs }}>
            <Text style={{ color: color.silkFaint, fontSize: font.body }}>✕</Text>
          </Pressable>
        ) : null}
      </View>
    </Toast>
  )
}
