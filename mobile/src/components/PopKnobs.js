import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import { space } from '../lib/theme'
import { idOf } from '../lib/device'
import { overBluetooth } from '../lib/bleSwitch'
import { useCableNow } from '../lib/bluetooth'
import { CABLE_EDIT_NOTE } from '../lib/cableWords'
import { bleEditNoteSeen, markBleEditNote } from '../lib/coach'
import { useRig } from '../lib/rig'
import { BLE_NOTE, BlockPanel } from '../screens/Edit'
import { useChain } from './ChainWait'
import Note from './Note'

const ofScene = (s) => s.sceneIndex
const ofBufferRev = (s) => s.bufferRev
const ofCaps = (s) => s.capabilities

/* The pop-up's knobs pick no model, so the three things Edit keeps for a model pick have nothing to keep. */
const nothing = () => {}

/*
 * THE KNOBS IN PLAY'S HOLD POP-UP, over its channels (lib/holdPop says
 * where a hold gets them; screens/Stage draws the pop-up).
 *
 * "Have the knobs only pop up above the channels so some one can quick
 * change a setting." (Justin, 10 November 2026.)
 *
 * THE KNOBS ARE EDIT'S, NOT A THIRD COPY. This is Edit's own block view
 * (screens/Edit BlockPanel, drawn as the panel and `bare`, and handed no
 * channels), as Derek's panel is (components/BlockSide): a knob here is
 * read and written by the same code,
 * through the same senders (lib/device, every one of them marked as
 * Edit's, so over Bluetooth it waits its turn behind Play), behind the same
 * door (lib/editDoor) and held by the same rules for what Edit may send.
 * Nothing new goes down the wire.
 *
 * WHAT IS IN IT: the block's knobs, and its pages where it has more than
 * one. Nothing else (lib/holdPop POP_LEAVES_OUT). The channels are the
 * pop-up's own, under this, and work the moment it opens: this part reads
 * after it is up, says it is reading while it does, and says so in Edit's
 * own words if the unit would not answer, with the channels still there.
 *
 * As Edit, it does not open a chain that is another preset's or up from
 * memory: it waits for this preset's own.
 */
export default function PopKnobs({
  /* The block held, from Play's own chain. */
  block,
  /* While a knob has the finger: the pop-up must not scroll under it (components/Knob). */
  onScrollLock = null
}) {
  const lockOut = useRef(onScrollLock)
  lockOut.current = onScrollLock
  const lock = useCallback((on) => lockOut.current?.(on), [])
  /* Gone with a knob still held: the pop-up is let go. */
  useEffect(() => () => lockOut.current?.(false), [])

  const scene = useRig(ofScene)
  const bufferRev = useRig(ofBufferRev)
  const caps = useRig(ofCaps)
  const chainNow = useChain({ editing: true })

  /* Over Bluetooth or a USB cable: Edit's own one-time note (a change plays, and is saved on the unit), put away for Edit, the panel and here by any one cross. */
  const viaBle = overBluetooth(caps)
  const onCable = useCableNow()
  const [bleNoteUp, setBleNoteUp] = useState(false)
  useEffect(() => {
    if (!viaBle) return undefined
    let alive = true
    bleEditNoteSeen().then((seen) => {
      if (alive && !seen) setBleNoteUp(true)
    })
    return () => {
      alive = false
    }
  }, [viaBle])

  const [error, setError] = useState(null)
  const eid = block ? idOf(block) : null
  /* Another block held: the last one's complaint is not this one's. */
  useEffect(() => setError(null), [eid])

  if (!block) return null
  return (
    <View style={{ gap: space.md }}>
      {viaBle && bleNoteUp ? (
        <Note
          onDismiss={() => {
            setBleNoteUp(false)
            markBleEditNote()
          }}
        >
          {onCable ? CABLE_EDIT_NOTE : BLE_NOTE}
        </Note>
      ) : null}
      {error ? (
        <Note tone="fault" onDismiss={() => setError(null)}>
          {error}
        </Note>
      ) : null}
      {chainNow.elsewhere ? (
        <Note>Reading what’s in this preset…</Note>
      ) : (
        <BlockPanel
          key={`${eid}:${block.channel || ''}:${scene}:${bufferRev}`}
          panel
          bare
          block={block}
          /* None: the pop-up's own channels are under the knobs, always on screen. */
          channels={null}
          focus={null}
          onError={setError}
          onScrollLock={lock}
          modelUndo={null}
          onModelUndo={nothing}
          restoring={null}
          onRestoring={nothing}
          undoSaid={null}
          onUndoSaid={nothing}
          overBle={viaBle}
        />
      )}
    </View>
  )
}
