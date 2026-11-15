import { View } from 'react-native'

import { space } from '../lib/theme'
import Press from './Press'

/**
 * A row of tabs: one of a few things picked, and only that one's content
 * drawn under it.
 *
 * "Let's add Bluetooth device specific as well as the fractal units specific
 * trouble shooting with tabs so we don't have to sort through so much
 * information not relevant to the unit and device they are using" (Justin,
 * 15 November 2026). How to connect my Bluetooth device drew every adapter
 * for the unit as a fold-out row, and Troubleshooting was one list with
 * every adapter's lines in it.
 *
 * The app's own buttons, lit when picked, as the unit row on the Bluetooth
 * page has always been (it draws through this now). They wrap onto a second
 * line rather than scroll sideways: five units fit a phone in two lines, and
 * a tab off the edge of the screen is one nobody knows is there. Words, never
 * a picture alone. Each says "tab" and whether it is the one picked to a
 * screen reader.
 *
 * @param {{ key: string, label: string }[]} items
 * @param {string|null} picked   the key of the one showing
 * @param {(key: string) => void} onPick
 * @param {boolean} [disabled]
 * @param {string} [name]        what the tabs choose between, for a screen reader ("Your unit")
 */
export default function Tabs({ items, picked, onPick, disabled = false, name = '' }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={name || undefined} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {items.map((it) => (
        <Press
          key={it.key}
          label={it.label}
          tone="signal"
          on={it.key === picked}
          disabled={disabled}
          height={44}
          style={{ paddingHorizontal: space.md }}
          accessibilityLabel={`${it.label}, tab${it.key === picked ? ', selected' : ''}`}
          onPress={() => onPick(it.key)}
        />
      ))}
    </View>
  )
}
