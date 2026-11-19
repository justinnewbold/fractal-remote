/*
 * THE BUTTON ON A HELD AMP THAT SWAPS IT FOR A NAM BLOCK (lib/ampToNam,
 * lib/ampToNamHere). It asks first, since the amp and its settings leave
 * the preset, says what the unit did, and hands the NAM block's id back so
 * the pop-up can become that block's, with its captures open.
 */
import { useState } from 'react'
import { Alert, View } from 'react-native'

import { color } from '../lib/theme'
import { ampToNamFor, SWAP_LABEL, SWAP_SUB, swapAsk, SWAPPING } from '../lib/ampToNam'
import { swapAmpForNam, useAmpToNam } from '../lib/ampToNamHere'
import { useRig } from '../lib/rig'
import Note from './Note'
import Press from './Press'

/** Whether the block held is offered the swap. */
export function useAmpSwap(block) {
  const allowed = useAmpToNam()
  const slug = useRig((s) => s.deviceSlug)
  return ampToNamFor(allowed, block, slug)
}

export function AmpSwapDoor({ block, onSwapped }) {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')
  const go = async () => {
    setBusy(true)
    setSaid('')
    const r = await swapAmpForNam(block)
    setBusy(false)
    if (!r.ok) return setSaid(r.words)
    onSwapped(r.id, r.note || '')
  }
  const ask = () => {
    const w = swapAsk(block?.name)
    Alert.alert(w.title, w.body, [
      { text: w.no, style: 'cancel' },
      { text: w.yes, style: 'destructive', onPress: go }
    ])
  }
  return (
    <View style={{ gap: 8 }}>
      <Press label={busy ? SWAPPING : SWAP_LABEL} sub={SWAP_SUB} tone="live" inkColor={color.live} subInk={color.live} height={56} disabled={busy} onPress={ask} />
      {said ? <Note tone="warn">{said}</Note> : null}
    </View>
  )
}
