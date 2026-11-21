/*
 * THE BUTTON ON A HELD PEDAL THAT SWAPS IT FOR ANOTHER (lib/swapBlock,
 * lib/swapBlockHere). A tap brings up the list of blocks the unit can add
 * (the chain editor's own menu, components/BlockMenu); a pick asks first,
 * since the held block and its settings leave the preset, says what the
 * unit did, and hands the new block's id back so the pop-up becomes that
 * block's.
 */
import { useEffect, useState } from 'react'
import { Alert, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { idOf } from '../lib/device'
import { SWAP_BLOCK_LABEL, SWAP_BLOCK_NO_LIST, SWAP_BLOCK_NOTE, SWAP_BLOCK_READING, SWAPPING_BLOCK, swapBlockAsk, swapBlockTitle, swapKinds, swapList } from '../lib/swapBlock'
import { swapBlockNow, swapPalette } from '../lib/swapBlockHere'
import BlockMenu from './BlockMenu'
import Note from './Note'

export { useSwapBlock } from '../lib/swapBlockHere'

/**
 * @param {object} block        the held block
 * @param {object[]} blocks     the preset's blocks as Play has them: what the list leaves out
 * @param {(id: number, note: string) => void} onSwapped
 */
export function SwapBlockDoor({ block, blocks, onSwapped }) {
  const [palette, setPalette] = useState(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')
  useEffect(() => {
    let stop = false
    swapPalette()
      .then((list) => !stop && setPalette(list))
      .catch(() => !stop && setPalette([]))
    return () => {
      stop = true
    }
  }, [])
  const name = block?.name || block?.slug || ''
  const used = new Set((blocks || []).map((b) => idOf(b)).filter(Number.isInteger))
  const go = async (pick) => {
    setBusy(true)
    setSaid('')
    const r = await swapBlockNow(block, pick)
    setBusy(false)
    if (!r.ok) return setSaid(r.words)
    onSwapped(r.id, r.note || '')
  }
  const ask = (pick) => {
    const w = swapBlockAsk(name, pick?.name)
    Alert.alert(w.title, w.body, [
      { text: w.no, style: 'cancel' },
      { text: w.yes, style: 'destructive', onPress: () => go(pick) }
    ])
  }
  const list = swapList(palette, used)
  return (
    <View style={{ gap: space.sm }}>
      {palette === null ? (
        <Note>{SWAP_BLOCK_READING}</Note>
      ) : !list.length ? (
        <Note tone="warn">{SWAP_BLOCK_NO_LIST}</Note>
      ) : (
        <BlockMenu
          palette={list}
          kinds={swapKinds(list, used)}
          title={swapBlockTitle(name)}
          note={SWAP_BLOCK_NOTE}
          label={busy ? SWAPPING_BLOCK : SWAP_BLOCK_LABEL}
          fieldLook={{ minHeight: TAP, paddingHorizontal: space.md, borderWidth: 1, borderColor: color.live, borderRadius: radius.md, backgroundColor: color.chassis, color: color.silk, fontSize: font.body }}
          disabled={busy}
          onPick={ask}
        />
      )}
      {said ? <Note tone="warn">{said}</Note> : null}
    </View>
  )
}
