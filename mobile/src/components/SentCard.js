import { Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { forUnit } from '../lib/captureUnit'
import { ON_UNIT } from '../lib/tone3000Words'
import { leftWords, percentSent, sentWords } from '../lib/captureLine'

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
 * FOUR LOOKS (`tone`), because the same card says what is becoming of a
 * capture from the tap on: "This is the screen that shows up after hitting
 * send.." (Justin, the same day, with a picture of a tone's view that had
 * nothing on it to say a tap had been taken).
 *
 *   'busy'   in the live colour: it is being got, or sent
 *   'ok'     green, with a tick: the unit has named the slot as holding it
 *   'plain'  no colour and no tick: the unit took it and said nothing of
 *            the slot, so it does not look like one that was confirmed
 *   'warn'   amber: it is not on the unit, and `line` says why
 */
const LOOKS = {
  ok: (c) => ({ ink: c.ok, edge: c.ok, wash: `${c.ok}1f`, mark: '✓ ' }),
  busy: (c) => ({ ink: c.live, edge: c.live, wash: `${c.live}1f`, mark: '' }),
  warn: (c) => ({ ink: c.signal, edge: c.signal, wash: `${c.signal}1f`, mark: '' }),
  plain: (c) => ({ ink: c.silk, edge: c.rule, wash: 'transparent', mark: '' })
}

export default function SentCard({ head, line = '', more = '', tone = 'ok', sent = undefined, of = undefined, left = undefined }) {
  const look = (LOOKS[tone] || LOOKS.plain)(color)
  /*
   * A SEND THAT IS GOING, WITH HOW FAR IT HAS GOT (`sent` of `of`): the
   * card grows a bar, the count in large figures and how long is left
   * ("it needs to be more prominent on the screen", 22 November 2026: half
   * a minute over an adapter behind one small grey line). Only on the busy
   * card and only with a count: every other card is as it was.
   */
  const going = tone === 'busy' && Number.isInteger(of) && of > 0 && Number.isInteger(sent)
  const percent = going ? percentSent(sent, of) : 0
  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={going ? [head, sentWords(sent, of), leftWords(left)].join('. ') : [head, line, more].filter(Boolean).join('. ')}
      style={{ gap: going ? space.sm : 2, borderWidth: going ? 2 : 1, borderColor: look.edge, borderRadius: radius.md, padding: going ? space.lg : space.md, backgroundColor: look.wash }}
    >
      <Text style={{ color: look.ink, fontSize: going ? font.lead : font.body, fontWeight: '700' }}>{`${look.mark}${head}`}</Text>
      {going ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm }}>
            <Text style={{ flex: 1, color: color.silk, fontSize: font.title, fontWeight: '700' }}>{sentWords(sent, of)}</Text>
            <Text style={{ color: look.ink, fontSize: font.title, fontWeight: '700' }}>{`${percent}%`}</Text>
          </View>
          {/* The bar: as wide as the card, filled by how much has gone. */}
          <View style={{ height: 14, borderRadius: radius.pill, backgroundColor: color.rule, overflow: 'hidden' }}>
            <View style={{ width: `${percent}%`, height: 14, borderRadius: radius.pill, backgroundColor: look.ink }} />
          </View>
          <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 22 }}>{leftWords(left)}</Text>
        </>
      ) : null}
      {line ? <Text style={{ color: tone === 'warn' ? color.silk : color.silkDim, fontSize: font.small, lineHeight: 19 }}>{going ? line.replace(/: \d+ of \d+$/, '') : line}</Text> : null}
      {more ? <Text style={{ color: color.silk, fontSize: font.small, lineHeight: 19 }}>{more}</Text> : null}
    </View>
  )
}

/** The card over a block's knobs, or its list of captures, after a Get: the block has said what it is playing (`line`). */
export function NowPlayingCard({ line, unit = undefined }) {
  return <SentCard head={forUnit(ON_UNIT, unit)} more={line} />
}
