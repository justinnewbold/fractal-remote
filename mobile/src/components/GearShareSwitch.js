import { Text, View } from 'react-native'

import { SHARE_ROW, shareRowLine } from '../lib/gear-share-rules'
import { setSharing, useSharing } from '../lib/gearShare'
import { color, font, space, TAP } from '../lib/theme'
import Press from './Press'

/**
 * SHARE WHAT GEAR WORKS, ON AND OFF, in Settings → Troubleshooting: the same
 * answer the one-time card asks for (components/GearShareNotice), changed
 * any time. A lit button for on, as the metronome's is (MetronomeSwitch),
 * and a line under it saying what that means right now.
 */
export default function GearShareSwitch() {
  const on = useSharing()
  return (
    <View style={{ gap: space.sm }}>
      <Press label={`${SHARE_ROW}: ${on ? 'On' : 'Off'}`} tone="live" on={on} height={TAP} onPress={() => setSharing(!on)} />
      <Text style={{ color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }}>{shareRowLine(on)}</Text>
    </View>
  )
}
