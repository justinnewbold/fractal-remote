import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { chainViewOf, retryChain, useRig } from '../lib/rig'
import { CHAIN_WORDS, UPDATING_AFTER_MS, chainElsewhere } from '../lib/chain-view'
import Press from './Press'

const ofView = chainViewOf
const ofNumber = (s) => s.preset?.number

/**
 * Whose chain is on screen, for a screen that draws it — the browser's
 * ChainWait.jsx, on the phone.
 *
 * `late` is a re-read of this preset's own chain (after an Add, a Remove, a
 * move) that has gone on long enough to mention; before that the tiles just
 * stay as they are, because a row that greyed on every Add would flicker.
 * `elsewhere` is a chain that belongs to another preset and is not drawn.
 */
export function useChain() {
  const view = useRig(ofView)
  const number = useRig(ofNumber)
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (view !== 'updating') {
      setLate(false)
      return undefined
    }
    const timer = setTimeout(() => setLate(true), UPDATING_AFTER_MS)
    return () => clearTimeout(timer)
  }, [view])
  return { view, number, late: view === 'updating' && late, elsewhere: chainElsewhere(view) }
}

/**
 * Where the tiles go while they are another preset's: grey cards, and the
 * sentence. Not the old tiles greyed out — those are the last song's, and a
 * new preset replaces them. Try again when nothing is coming.
 */
export default function ChainWait({ chain, cards = 4, height = 56 }) {
  const failed = chain.view === 'failed'
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {Array.from({ length: cards }, (_, i) => (
          <View
            key={i}
            style={{
              width: 84,
              height,
              borderRadius: radius.sm,
              backgroundColor: color.panelHi,
              borderWidth: 1,
              borderColor: color.rule
            }}
          />
        ))}
      </View>
      <Text style={{ color: color.silkDim, fontSize: font.small }}>
        {failed ? CHAIN_WORDS.failed : CHAIN_WORDS.loading(chain.number)}
      </Text>
      {failed ? <Press label={CHAIN_WORDS.retry} height={44} onPress={() => retryChain()} /> : null}
    </View>
  )
}

/** The word a slow re-read of this preset's own chain shows over it. */
export function ChainUpdating({ chain }) {
  if (!chain.late) return null
  return (
    <Text accessibilityLiveRegion="polite" style={{ color: color.silkFaint, fontSize: font.micro }}>
      {CHAIN_WORDS.updating}
    </Text>
  )
}
