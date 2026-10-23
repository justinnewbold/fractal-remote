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
 *
 * Grayed by having no frame and no weight, not by faint ink: silkFaint is
 * 3.7:1 on the light page, under 4.5:1 for words this size, and it read
 * noticeably fainter than everything round it in daylight. silkDim is 5.5:1
 * light and 5.3:1 dark.
 */
export default function MissingPick({ name, onForget }) {
  const row = missingPickRow(name)
  if (!row) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Text style={{ flex: 1, color: color.silkDim, fontSize: font.body, fontWeight: '400', paddingHorizontal: space.sm }}>{row.label}</Text>
      <Press label={row.forget} height={44} onPress={onForget} />
    </View>
  )
}
