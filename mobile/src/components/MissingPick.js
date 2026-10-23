import { Text, View } from 'react-native'

import { missingPickRow } from '../lib/relay-rules'
import { color, font, space } from '../lib/theme'
import Press from './Press'

/**
 * THE PICK THAT DOES NOT ANSWER, UNDER WHICH UNIT: listed after the units
 * that do, grayed, and with Forget, which leaves nothing picked so the next
 * launch drives the first computer with a unit by itself. Nothing to tap on
 * the name: there is nobody there to drive (shared relay-rules
 * missingPickRow). Settings and the sheet off the unit's name, the same.
 */
export default function MissingPick({ name, onForget }) {
  const row = missingPickRow(name)
  if (!row) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Text style={{ flex: 1, color: color.silkFaint, fontSize: font.body, paddingHorizontal: space.sm }}>{row.label}</Text>
      <Press label={row.forget} height={44} onPress={onForget} />
    </View>
  )
}
