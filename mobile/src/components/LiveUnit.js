import { useState } from 'react'
import { Text, View } from 'react-native'

import { unitChoices } from '../lib/relay'
import { chooseHost } from '../lib/link'
import { color, font, space } from '../lib/theme'
import Press from './Press'
import Sheet from './Sheet'

/**
 * Which unit, one tap from the name in the corner, when more than one is on.
 *
 * "Can we make it a quick switch by making it so if they are live they can
 * click the unit name in the top left to pull up the switch like it does on
 * the demo version?" The demo's five units have been a sheet off that name
 * for a while (DemoUnit); this is the same thing for real ones — an AM4 on one
 * computer and an FM3 on another, both on this account.
 *
 * The same buttons as Settings → Phone & computer → Which unit, from the same
 * words (unitChoices), so the two can never name a unit differently. Closed
 * once the new unit has been read: the screen behind it is now a different
 * rig, which is the thing worth looking at.
 */
export default function LiveUnit({ open, onClose, hosts = [], units = {}, chosen = null }) {
  const [busy, setBusy] = useState(null)

  return (
    <Sheet open={open} onClose={onClose} title="Which unit" note="Each computer on this account">
      <View style={{ gap: space.md }}>
        {unitChoices(hosts, units, chosen).map((row) => (
          <View key={row.key} style={{ gap: space.xs }}>
            <Press
              label={busy === row.name ? 'Switching…' : row.label}
              tone="live"
              on={row.on}
              height={56}
              disabled={busy !== null}
              onPress={async () => {
                setBusy(row.name)
                try {
                  await chooseHost(row.name)
                } finally {
                  setBusy(null)
                }
                onClose()
              }}
            />
            <Text style={{ color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }}>{row.detail}</Text>
          </View>
        ))}
      </View>
    </Sheet>
  )
}
