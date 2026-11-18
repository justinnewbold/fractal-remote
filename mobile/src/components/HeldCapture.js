/*
 * WHICH CAPTURE A HELD AM4 NAM BLOCK PLAYS, AND THE LIST TO CHOOSE ANOTHER.
 *
 * An Axe-Fx III's NAM block has its Capture button in Edit, over its knobs
 * (components/CapturePicker, drawn where the block's own read says which
 * capture it is on). An AM4's NAM block (firmware 3.00) has no knobs in the
 * app yet, so Edit has nowhere for it; its hold pop-up, which is its
 * channels, is where a player meets the block. So the same button is here,
 * over the channels, under TONE3000's.
 *
 * WHICH CAPTURE is asked of the unit itself (lib/device namWhichHere, the
 * AM4's own question), when the pop-up opens and again when the preset, the
 * scene or the block's channel moves: each channel keeps its own. A PICK is
 * the captures' own write (lib/captureListHere chooseCapture), believed
 * where the unit answers it, and the block is asked again where it did not.
 * Nothing is saved by a pick; the preset is saved the usual way, and the
 * preset is marked changed so Save is offered where the app saves.
 *
 * His account first: the block is only named NAM, and so only reaches this,
 * where lib/features AM4_NAM_FOR_EVERYONE or his account opens it.
 */
import { useEffect, useRef, useState } from 'react'

import { chooseCapture } from '../lib/captureListHere'
import { idOf, namWhichHere } from '../lib/device'
import { usePresetAndScene } from '../lib/namPlayingHere'
import { noteEdited } from '../lib/rig'
import CapturePicker from './CapturePicker'
import Note from './Note'

export const READING_CAPTURE = 'Reading which capture it plays…'

export default function HeldCapture({ block }) {
  const id = block ? idOf(block) : null
  const { preset, scene, rev } = usePresetAndScene()
  const [slot, setSlot] = useState(null)
  const [choosing, setChoosing] = useState(null)
  const [fault, setFault] = useState('')
  /* Which read is the one wanted: an answer for another preset, scene or channel is not drawn. */
  const asked = useRef(0)
  const read = () => {
    if (id === null) return
    const mine = ++asked.current
    namWhichHere(id)
      .then((got) => {
        if (mine !== asked.current) return
        setFault('')
        setSlot(Number.isInteger(got?.slot) ? got.slot : null)
      })
      .catch((err) => {
        if (mine !== asked.current) return
        setFault(err?.message || 'The unit didn’t say which capture it plays.')
      })
  }
  useEffect(() => {
    setSlot(null)
    setFault('')
    read()
    return () => {
      asked.current += 1
    }
  }, [id, preset, scene, rev, block?.channel])

  const pick = async (to) => {
    if (id === null || choosing !== null) return
    setChoosing(to)
    setFault('')
    try {
      const got = await chooseCapture(id, to)
      asked.current += 1
      setSlot(Number.isInteger(got?.slot) ? got.slot : to)
      noteEdited()
    } catch (err) {
      setFault(err?.message || 'The capture couldn’t be changed.')
      /* Its answer may have been lost with the pick taken: what the unit says now is what the button shows. */
      read()
    } finally {
      setChoosing(null)
    }
  }
  /* TONE3000's page, opened from the list, points the block by its own pick: the slot the unit named there, else ask. */
  const changed = (pointed) => {
    if (Number.isInteger(pointed)) {
      asked.current += 1
      setSlot(pointed)
      noteEdited()
    } else read()
  }

  if (id === null) return null
  return (
    <>
      {Number.isInteger(slot) ? <CapturePicker slot={slot} choosing={choosing} disabled={choosing !== null} onPick={pick} block={block} onChanged={changed} /> : fault ? null : <Note>{READING_CAPTURE}</Note>}
      {fault ? <Note tone="warn">{fault}</Note> : null}
    </>
  )
}
