/*
 * ON THE WAITING SCREEN, AFTER A LOOK THAT DID NOT BRING THE ADAPTER BACK
 * (lib/offerWords stillAwaySteps has the report and the words): what to try,
 * in order, under Look for the adapter again. An iPhone or iPad only: that
 * is where an adapter is connected in Apple's screen.
 */
import { Platform, Text, View } from 'react-native'

import { color, font, space } from '../lib/theme'
import { howToClose } from '../lib/closeApp'
import { deviceNoun } from '../lib/device-word'
import { stillAwayHead, stillAwaySteps } from '../lib/offerWords'
import Note from './Note'

export default function AdapterStillAway({ adapter, unit, misses }) {
  if (Platform.OS !== 'ios' || !(misses >= 1)) return null
  const steps = stillAwaySteps({ adapter, unit, misses })
  return (
    <View style={{ alignSelf: 'stretch', gap: space.sm }}>
      <Note tone="warn">{stillAwayHead(adapter, deviceNoun())}</Note>
      {steps.map((s, i) => (
        <View key={s.key} style={{ gap: 2 }}>
          <Text style={{ color: color.silk, fontSize: font.small, lineHeight: 20 }}>{`${i + 1}. ${s.text}`}</Text>
          {s.key === 'close' ? <Text style={{ color: color.silkDim, fontSize: font.micro, lineHeight: 18 }}>{howToClose(Platform.OS)}</Text> : null}
        </View>
      ))}
    </View>
  )
}
