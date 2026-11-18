import { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { color, font, space } from '../lib/theme'
import { onPlacedProgress } from '../lib/device'
import { placedReadingLine, placedSlowLine } from '../lib/chainOnWire'

/**
 * The chain editor's own line while the chain is read with its places over
 * Bluetooth (lib/chainOnWire): a turning circle, how far the read has got,
 * and, where it is the slow read, how long it takes. `back` after a change.
 */
export default function ChainReading({ back = false, slow = false, unit = '' }) {
  const [at, setAt] = useState(null)
  useEffect(() => onPlacedProgress(setAt), [])
  const line = placedReadingLine(at, { back })
  return (
    <View style={{ gap: space.xs }} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <ActivityIndicator color={color.silkDim} />
        <Text style={{ color: color.silk, fontSize: font.body, flexShrink: 1 }}>{line}</Text>
      </View>
      {slow ? <Text style={{ color: color.silkDim, fontSize: font.micro }}>{placedSlowLine(unit)}</Text> : null}
    </View>
  )
}
