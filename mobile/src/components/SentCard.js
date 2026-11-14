import { Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { ON_UNIT } from '../lib/tone3000Words'

/**
 * A capture is on the unit: said so that it cannot be missed.
 *
 * "Need better confirmation that a tone was sent. It doesn't do much after
 * a tone does send successfully." (Justin, 14 November 2026: a capture that
 * had gone to his Axe-Fx III was one grey line among the others.) So a card
 * in the green that means "done", with a tick: what happened in bold
 * (`head`), where it is (`line`), and what the block is doing with it now
 * (`more`). Drawn on the capture's own line once it is on the unit, and
 * over a block's knobs, or its list of captures, when a Get hands them back.
 *
 * It says only what it is handed: the words are lib/tone3000Words', and the
 * head says "On" the unit only where the unit has named the slot.
 *
 * GREEN AND A TICK ONLY WHERE IT IS SURE (`sure`, true unless told): a send
 * the unit took and then said nothing of is not confirmed, and is drawn
 * plain, with no tick, so it does not look like one that was.
 */
export default function SentCard({ head, line = '', more = '', sure = true }) {
  const ink = sure ? color.ok : color.silk
  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={[head, line, more].filter(Boolean).join('. ')}
      style={{ gap: 2, borderWidth: 1, borderColor: sure ? color.ok : color.rule, borderRadius: radius.md, padding: space.md, backgroundColor: sure ? `${color.ok}1f` : 'transparent' }}
    >
      <Text style={{ color: ink, fontSize: font.body, fontWeight: '700' }}>{sure ? `✓ ${head}` : head}</Text>
      {line ? (
        <Text numberOfLines={2} style={{ color: color.silkDim, fontSize: font.small, lineHeight: 19 }}>
          {line}
        </Text>
      ) : null}
      {more ? <Text style={{ color: color.silk, fontSize: font.small, lineHeight: 19 }}>{more}</Text> : null}
    </View>
  )
}

/** The card over a block's knobs, or its list of captures, after a Get: the block has said what it is playing (`line`). */
export function NowPlayingCard({ line }) {
  return <SentCard head={ON_UNIT} more={line} />
}
