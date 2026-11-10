import { View } from 'react-native'
import { font, space } from '../lib/theme'
import { usePlayHead } from '../lib/playHead'
import Press from './Press'

/*
 * PLAY'S PRESET AND SETLISTS IN THE APP'S TOP BAR, on a phone held on its
 * side, where that leaves the tiles more height (lib/sidewaysPlay `headUp`;
 * lib/playHead says why the words come from there). The same two buttons
 * Play draws in its own page everywhere else, doing the same two things:
 * the preset opens All presets, Setlists opens your setlists. Nothing at
 * all while Play has them in its page.
 */
export default function PlayHead({ onOpenPresets = null, onOpenSetlists = null }) {
  const head = usePlayHead()
  if (!head) return null
  return (
    <View style={ROW}>
      <Press
        label={head.preset}
        sub={head.sub || undefined}
        bar
        height={HIGH}
        labelSize={font.body}
        disabled={!onOpenPresets}
        onPress={onOpenPresets}
        style={[PRESET, head.edge || null]}
      />
      <Press
        caption="Setlists"
        label={head.setlists}
        sub={head.where || undefined}
        tone="signal"
        on={head.on === true}
        height={HIGH}
        labelSize={font.small}
        disabled={!onOpenSetlists}
        onPress={onOpenSetlists}
        style={SETLISTS}
      />
    </View>
  )
}

/* Under a thumb's 44 on purpose: the bar is 48, and Press reaches 44 by its own hit slop. */
const HIGH = 36
const ROW = { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm }
const PRESET = { flexShrink: 1, minWidth: 0, paddingHorizontal: space.md, paddingVertical: 1 }
const SETLISTS = { paddingHorizontal: space.md, paddingVertical: 1 }
