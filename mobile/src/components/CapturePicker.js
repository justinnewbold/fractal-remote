import { useEffect, useState } from 'react'
import { TextInput, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { CAPTURES_SHOWN, captureMore, captureNumber, captureSaid, capturesFound } from '../lib/captureList'
import { captureHead, loadCaptures, nameCapture, useCaptures } from '../lib/captureListHere'
import Note from './Note'
import Press from './Press'
import Sheet from './Sheet'

/**
 * WHICH CAPTURE A NAM BLOCK PLAYS, AND THE LIST TO CHOOSE ANOTHER FROM
 * (lib/captureList, which says how the list is read and kept). A button
 * with the capture the block is on, numbered as the unit and Axe-Edit
 * number it; a tap opens the captures on the unit, with a box to find one.
 *
 * It draws, asks for the list, and asks to be told the name of the slot the
 * block is on. IT WRITES NOTHING: `onPick(slot)` is Edit's own (BlockPanel),
 * which points the block at the slot and reads the block again, and
 * `choosing` is the slot just tapped while that is out, so the button says
 * it under the thumb and not a read later.
 *
 * The list is the unit's, read from the unit: about half a minute over a
 * Bluetooth adapter the first time, shown as it comes, and kept after that.
 * Nothing here is saved on the unit by a pick; the preset is saved the usual
 * way.
 */
export default function CapturePicker({ slot, choosing = null, disabled = false, onPick }) {
  const captures = useCaptures()
  const [open, setOpen] = useState(false)
  const [find, setFind] = useState('')
  const at = Number.isInteger(choosing) ? choosing : slot

  /* The name of the slot the block is on, asked of the unit by itself: one question, whether or not the whole list is here. */
  useEffect(() => {
    if (Number.isInteger(slot)) nameCapture(slot)
  }, [slot])

  /* What is known of the slot the block is on, an empty one and the 257th too: the rows leave those out, the button says them. */
  const here = captureHead(at)
  const close = () => {
    setOpen(false)
    setFind('')
  }
  const show = () => {
    setFind('')
    setOpen(true)
    /* Read now if it has never been read whole, or there is reason to think it has changed; else it is simply there. */
    loadCaptures()
  }
  const found = capturesFound(captures.list, find)
  const reading = captures.loading ? `Reading the captures on the unit: ${captures.asked} of ${captures.total}` : null

  return (
    <View style={{ gap: space.sm }}>
      <Press
        caption="Capture"
        label={captureSaid(at, here)}
        sub={here && !here.empty ? captureMore(here) || 'Tap to change' : 'Tap to change'}
        disabled={disabled}
        accessibilityLabel={`Capture: ${captureSaid(at, here)}. Opens the captures on the unit.`}
        onPress={show}
      />
      <Sheet open={open} onClose={close} title="Capture" note="The captures on the unit. The one picked plays on the channel this block is on.">
        {open ? (
          <View style={{ gap: space.sm }}>
            {reading ? <Note>{reading}</Note> : null}
            {captures.fault && !captures.loading ? <Note tone="warn">{captures.fault}</Note> : null}
            <TextInput
              value={find}
              onChangeText={setFind}
              placeholder="Find a capture"
              placeholderTextColor={color.silkFaint}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Find a capture"
              style={{ minHeight: TAP, paddingHorizontal: space.md, borderWidth: 1, borderColor: color.live, borderRadius: radius.md, backgroundColor: color.chassis, color: color.silk, fontSize: font.body }}
            />
            {found.slice(0, CAPTURES_SHOWN).map((h) => (
              <Press
                key={h.slot}
                label={`${captureNumber(h.slot)} ${h.name}`}
                sub={captureMore(h) || undefined}
                tone="signal"
                on={h.slot === at}
                disabled={disabled}
                accessibilityLabel={`Capture ${captureNumber(h.slot)}, ${h.name}`}
                onPress={() => {
                  if (h.slot !== at) onPick(h.slot)
                  close()
                }}
              />
            ))}
            {found.length > CAPTURES_SHOWN ? <Note>{`${found.length - CAPTURES_SHOWN} more. Type to narrow it down.`}</Note> : null}
            {!found.length && !captures.loading ? <Note>{captures.list.length ? 'No capture named like that.' : captures.fault ? 'The list isn’t here yet.' : 'No captures on the unit yet.'}</Note> : null}
            <Press label={captures.loading ? 'Reading…' : 'Read the list again'} sub="From the unit" disabled={captures.loading} onPress={() => loadCaptures({ again: true })} />
          </View>
        ) : null}
      </Sheet>
    </View>
  )
}
