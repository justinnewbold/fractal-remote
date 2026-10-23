import { useState } from 'react'
import { Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import Press from './Press'

/**
 * WHICH COMPUTER PLAY IS ON, WHEN THAT IS THE QUESTION. With two or more
 * computers on the account, Play can be driving one that has no unit while
 * the unit he is playing is on another ("raspberry pi 3 has no unit plugged
 * in. Your FM3 is on MacBook Pro SG 566."), or one in place of a pick that
 * never answers. The words say which, and each button is the way out it
 * names: Which unit's own proved pick, or keeping the one driven. Nothing
 * moves until one is tapped (shared relay-rules unitElsewhere,
 * missingPickCard).
 *
 * In the Note's register, bordered rather than filled, and with its buttons
 * under the words: thumb-high, one per way out. A button's `sub` is the line
 * under its label, two lines long where the label has one: the computer's
 * name goes there, so a narrow phone or bigger text never cuts it off.
 */
export default function ComputerCard({ words, buttons = [] }) {
  const [busy, setBusy] = useState(null)
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        gap: space.sm,
        borderLeftWidth: 3,
        borderLeftColor: color.signal,
        backgroundColor: color.panel,
        borderRadius: radius.sm,
        padding: space.md
      }}
    >
      <Text style={{ color: color.silk, fontSize: font.small, lineHeight: 20 }}>{words}</Text>
      {buttons.map((b, i) => (
        <Press
          key={b.key || b.label}
          label={busy === i ? 'Switching…' : b.label}
          sub={b.sub}
          tone={i === 0 ? 'live' : 'plain'}
          disabled={busy !== null}
          onPress={async () => {
            setBusy(i)
            try {
              await b.onPress?.()
            } finally {
              setBusy(null)
            }
          }}
        />
      ))}
    </View>
  )
}
