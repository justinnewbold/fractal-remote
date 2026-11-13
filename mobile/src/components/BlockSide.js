import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { color, font, space } from '../lib/theme'
import { editBlocks, idOf, sameBlock } from '../lib/device'
import { overBluetooth } from '../lib/bleSwitch'
import { useCableNow } from '../lib/bluetooth'
import { CABLE_EDIT_NOTE } from '../lib/cableWords'
import { editNoteUp } from '../lib/editWords'
import { bleEditNoteSeen, markBleEditNote } from '../lib/coach'
import { chainActs } from '../lib/chain-view'
import { blockColor } from '../lib/blockColors'
import { useRig } from '../lib/rig'
import { PANEL_FOOT, panelFollows } from '../lib/twoSides'
import { BLE_NOTE, BlockPanel } from '../screens/Edit'
import { useChain } from './ChainWait'
import Note from './Note'
import Press from './Press'
import { SaveButton, SaveNotes, useSaveToSlot } from './SaveToSlot'

const ofBlocks = (s) => s.allBlocks
const ofScene = (s) => s.sceneIndex
const ofBufferRev = (s) => s.bufferRev
const ofCaps = (s) => s.capabilities
const ofPreset = (s) => s.preset
const ofUnsaved = (s) => s.unsaved

/*
 * DEREK'S IDEA: HOLD A BLOCK, GET ITS PANEL (docs/two-sides, "Derek's idea",
 * picture 5; lib/twoSides says where a hold opens it and where it goes).
 *
 * On a big screen, holding a block on Play opens that block's knobs without
 * leaving Play: where the scenes were when Play fills the window
 * (screens/Stage), or in the other side when two sides are showing (App.js).
 *
 * WHAT IS IN IT: the block's name and Close; its channels, A to D; its knob
 * pages; its Level, read and never turned, as in Edit ("one slip on Level
 * can silence the rig mid-song"); and its model. Save, when there is
 * something to save, which is through the computer. Copy channel, the on/off
 * button and Color are left out (lib/twoSides PANEL_LEAVES_OUT): one tap on
 * the block on Play still turns it on and off, panel open or not.
 *
 * THE KNOBS ARE EDIT'S, NOT A SECOND COPY. Everything under the name is
 * Edit's own block view (screens/Edit BlockPanel, drawn with `panel`), so a
 * knob here is read and written by the same code, through the same senders
 * (lib/device, every one of them marked as Edit's), behind the same door
 * (lib/editDoor) and, over Bluetooth, held by the same rules for what Edit
 * may send. Nothing new goes down the wire.
 *
 * HOW IT BEHAVES. It stays until Close: no timer, and it never reopens when
 * the app starts (App keeps which block in memory only). Holding another
 * block moves it (`eid` changes). A scene change shows the new channel, and
 * a preset change follows the same block if the new preset has it and
 * otherwise closes (KnobsFollow, below); while the new preset's blocks are
 * on their way it waits, as Edit does.
 *
 * LEFT FOR STEP 5: the question before Previous, Next or a preset pick
 * throws unsaved changes away (Save, Don't save, Stay). Until then they go
 * at the next preset change, as they do from Edit today.
 */
export default function BlockSide({
  /* The block held, by its effect id (lib/device idOf). */
  eid,
  onClose,
  /* While a knob has the finger: Play's own page must not scroll under it either (Stage). */
  onScrollLock = null
}) {
  const [held, setHeld] = useState(false)
  const lockOut = useRef(onScrollLock)
  lockOut.current = onScrollLock
  const lock = useCallback((on) => {
    setHeld(on)
    lockOut.current?.(on)
  }, [])
  /* Gone with a knob still held: Play's page is let go. */
  useEffect(() => () => lockOut.current?.(false), [])

  const chainAll = useRig(ofBlocks)
  const blocks = useMemo(() => editBlocks(chainAll), [chainAll])
  const scene = useRig(ofScene)
  const bufferRev = useRig(ofBufferRev)
  const caps = useRig(ofCaps)
  const preset = useRig(ofPreset)
  const unsaved = useRig(ofUnsaved)
  /* As Edit: another preset's blocks, or this one's from memory, are not opened. */
  const chainNow = useChain({ editing: true })
  const block = chainNow.elsewhere ? null : blocks.find((b) => sameBlock(b, eid)) || null
  /* The name it had, for the row at the top while the next preset's blocks are on their way. */
  const named = useRef('')
  if (block) named.current = block.name
  const hue = block ? blockColor(block.slug) : null

  /* Save: only with something to save on this slot, which only the computer's path marks (rig.noteEdited). */
  const pending = !!unsaved && unsaved.number === preset?.number
  const saveTo = useSaveToSlot()
  useEffect(() => {
    if (!pending && saveTo.armed) saveTo.disarm()
  }, [pending, saveTo])

  /* Over Bluetooth or a USB cable: Edit's own one-time note, the one it shows at its top, put away for both by either cross. */
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
  /* What Edit keeps over its own block view, kept here the same way: the way back from a model pick outlives the view, which is drawn again at every channel and scene change. */
  const [modelUndo, setModelUndo] = useState(null)
  useEffect(() => setModelUndo(null), [eid, bufferRev])
  const [restoring, setRestoring] = useState({})
  const [undoSaid, setUndoSaid] = useState(null)
  useEffect(() => {
    if (!undoSaid || undoSaid.bad) return undefined
    const t = setTimeout(() => setUndoSaid(null), 10000)
    return () => clearTimeout(t)
  }, [undoSaid])
  /* Another block held: the last one's complaint is not this one's. */
  useEffect(() => setError(null), [eid])

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.md,
          paddingTop: space.md,
          paddingBottom: space.sm
        }}
      >
        <View style={{ flex: 1, borderLeftWidth: 4, borderLeftColor: hue ? hue.fill : color.rule, paddingLeft: space.md }}>
          <Text accessibilityRole="header" numberOfLines={1} style={{ color: color.silk, fontSize: font.lead, fontWeight: '700' }}>
            {block?.name || named.current}
          </Text>
        </View>
        {pending ? <SaveButton s={saveTo} waiting /> : null}
        <Press label="Close" height={44} onPress={onClose} accessibilityLabel={`Close ${block?.name || named.current || 'the block'}’s knobs`} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.lg, gap: space.md }}
        keyboardShouldPersistTaps="handled"
        /* A knob turns on a drag up and down: nothing scrolls while one has the finger (components/Knob). */
        scrollEnabled={!held}
        nestedScrollEnabled
      >
        <SaveNotes s={saveTo} />
        {editNoteUp({ viaBle, up: bleNoteUp, saves: caps?.supportsSave === true }) ? (
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
        {block ? (
          <BlockPanel
            key={`${idOf(block)}:${block.channel || ''}:${scene}:${bufferRev}`}
            panel
            block={block}
            channels={caps?.channelNames}
            focus={null}
            onError={setError}
            onScrollLock={lock}
            modelUndo={modelUndo && sameBlock(block, modelUndo.eid) && modelUndo.rev === bufferRev ? modelUndo.snap : null}
            onModelUndo={(snap) =>
              setModelUndo((u) => (snap ? { eid: idOf(block), rev: bufferRev, snap } : u && sameBlock(block, u.eid) ? null : u))
            }
            restoring={restoring[idOf(block)] || null}
            onRestoring={(p) =>
              setRestoring((all) => {
                const next = { ...all }
                if (p) next[idOf(block)] = p
                else delete next[idOf(block)]
                return next
              })
            }
            undoSaid={undoSaid && sameBlock(block, undoSaid.eid) && undoSaid.rev === bufferRev ? undoSaid : null}
            onUndoSaid={(said) => setUndoSaid(said ? { ...said, eid: idOf(block), rev: bufferRev } : null)}
            overBle={viaBle}
          />
        ) : (
          <Note>Reading what’s in this preset…</Note>
        )}
        <Text style={{ color: color.silkFaint, fontSize: font.small, lineHeight: 20, textAlign: 'center', paddingTop: space.sm }}>{PANEL_FOOT}</Text>
      </ScrollView>
    </View>
  )
}

/**
 * THE PANEL FOLLOWS ITS BLOCK (lib/twoSides panelFollows): after a preset
 * change it stays on the same block if the new preset has it, and closes if
 * it does not. Drawn by App for as long as a panel is open, wherever the
 * panel itself is drawn, and draws nothing: it only watches the chain, so
 * App is not drawn again at every block switched on or off.
 */
export function KnobsFollow({ eid, onClose }) {
  const chainAll = useRig(ofBlocks)
  const chainNow = useChain({ editing: true })
  const found = useMemo(() => editBlocks(chainAll).some((b) => sameBlock(b, eid)), [chainAll, eid])
  const says = panelFollows({ found, elsewhere: chainNow.elsewhere, acts: chainActs(chainNow.view) })
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (says === 'close') close.current?.()
  }, [says])
  return null
}
