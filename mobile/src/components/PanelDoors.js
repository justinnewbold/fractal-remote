/*
 * THE HELD BLOCK'S DOORS, ON THE KNOBS PANEL OF A BIG SCREEN.
 *
 * "I'm not seeing the Tone 3000 on the AM4 on the Raspberry Pi." (Justin, 26
 * November 2026, with Play on a fold opened up: he had held the amp, and
 * its knobs came up in the panel beside the chain with nothing over them.)
 *
 * On a phone a hold opens the pop-up (screens/Stage ChannelSheet), which
 * has, over and under the knobs: Swap for a NAM block on an amp
 * (components/AmpToNam), TONE3000 on a NAM block (components/Tone3000Quick)
 * and Swap for another pedal (components/SwapBlock). On a big screen a hold
 * opens the panel instead (components/BlockSide, lib/twoSides holdGoes),
 * which is Edit's block view and had none of the three, so on an iPad, a
 * fold opened or any wide window there was no way to them from Play.
 *
 * This is those same three, by the same hooks and so the same switches and
 * the same rules for where each is offered, for the panel to draw: `over`
 * the knobs, `under` them, and `page`, TONE3000's page, which takes the
 * knobs' place while it is up, as it does in the pop-up. Nothing here
 * reaches a unit by itself: each door does what it does in the pop-up.
 *
 * A swap puts another block where the held one was, and the panel follows
 * its block (BlockSide KnobsFollow closes it when the block has gone), so
 * the new block is handed to `onMove`, which is the app's own hold: the
 * panel opens on it. After an amp is swapped for a NAM block it opens on
 * that block's captures, as the pop-up does (`straight`, kept outside the
 * component because the panel is closed and opened again in between).
 */
import { useEffect, useState } from 'react'

import { idOf } from '../lib/device'
import { noteEdited } from '../lib/rig'
import { AmpSwapDoor, useAmpSwap } from './AmpToNam'
import { NowPlayingCard } from './SentCard'
import { SwapBlockDoor, useSwapBlock } from './SwapBlock'
import { Tone3000Door, Tone3000InPop, useTone3000Door } from './Tone3000Quick'

/* The NAM block an amp was just swapped for: its panel opens on TONE3000's page. */
let straight = null

export function usePanelDoors(block, { blocks = null, elsewhere = false, onMove = null } = {}) {
  const moves = typeof onMove === 'function'
  const library = useTone3000Door(block, null)
  const [browsing, setBrowsing] = useState(false)
  const [came, setCame] = useState('')
  const ampSwap = useAmpSwap(block) && moves
  const anySwap = useSwapBlock(block, elsewhere) && moves
  useEffect(() => {
    const open = straight !== null && straight === library.id
    if (library.id !== null) straight = null
    setBrowsing(open)
    setCame('')
  }, [library.id])
  /* A Get changed what the block plays: the preset is marked changed, so the panel's own Save comes up. */
  useEffect(() => {
    if (came) noteEdited()
  }, [came])
  if (browsing && library.offered) {
    return {
      page: (
        <Tone3000InPop
          id={library.id}
          n={library.n}
          from={library.from}
          onBack={(line) => {
            setCame(line)
            setBrowsing(false)
          }}
        />
      ),
      over: null,
      under: null
    }
  }
  return {
    page: null,
    over:
      ampSwap || library.offered ? (
        <>
          {ampSwap ? (
            <AmpSwapDoor
              block={block}
              onSwapped={(id) => {
                straight = id
                onMove(id)
              }}
            />
          ) : null}
          {library.offered ? <Tone3000Door n={library.n} onPress={() => setBrowsing(true)} /> : null}
          {library.offered && came ? <NowPlayingCard line={came} unit={library.unit} /> : null}
        </>
      ) : null,
    under: anySwap ? <SwapBlockDoor key={block ? idOf(block) : 'none'} block={block} blocks={blocks} onSwapped={(id) => onMove(id)} /> : null
  }
}
