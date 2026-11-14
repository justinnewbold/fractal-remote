import { useEffect, useRef, useState } from 'react'
import { TextInput, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { CAPTURES_SHOWN, captureMore, captureNumber, captureSaid, capturesFound } from '../lib/captureList'
import { captureHead, loadCaptures, nameCapture, useCaptures } from '../lib/captureListHere'
import Note from './Note'
import Press from './Press'
import Sheet from './Sheet'
import { Tone3000Door, Tone3000InPop, useTone3000Door } from './Tone3000Quick'

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
 *
 * AND THE WAY TO MORE OF THEM (components/Tone3000Quick, which says for
 * whom): "Also want it on the capture screen when I can they see the ones
 * they've already downloaded but then they can also click tone 3000 from
 * that and it pulls up and they can browse preview and do it that way as
 * well" (Justin, 14 November 2026, with a picture of this list). For an
 * account it is open to, a button over the list; a tap puts the capture
 * library in the list's place IN THIS SHEET. A capture previewed or got
 * there is played in this block by the library's own page, not by `onPick`,
 * so whatever it did, `onChanged()` tells Edit to read the block again
 * when the list comes back, with the slot the unit last said the block was
 * pointed at there (none if it was not), and the list is read again if a
 * capture was sent (lib/captureListHere marks it changed). `block` is the
 * NAM block this picker is drawn for.
 */
export default function CapturePicker({ slot, choosing = null, disabled = false, onPick, block = null, onChanged = null }) {
  const captures = useCaptures()
  const [open, setOpen] = useState(false)
  const [find, setFind] = useState('')
  /* The capture library, where this account is offered it: in the list's place while `browsing`, and what the block said it is playing when a Get handed the list back. */
  const library = useTone3000Door(block)
  const [browsing, setBrowsing] = useState(false)
  const [came, setCame] = useState('')
  /*
   * The slot the library last pointed this block at, by the unit's own
   * word, and whether the library has been left since. Edit is handed the
   * slot with `onChanged`, so its button does not hang on a read of the
   * block that may fail; and a pick still out when the sheet was closed
   * tells Edit when it lands, not before.
   */
  const pointed = useRef(null)
  const left = useRef(true)
  const changed = useRef(onChanged)
  changed.current = onChanged
  const browse = () => {
    pointed.current = null
    left.current = false
    setBrowsing(true)
  }
  const leave = () => {
    left.current = true
    changed.current?.(pointed.current)
  }
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
    /* Closed from the library: the block may be on another capture now, and Edit has not been told. */
    if (browsing) leave()
    setBrowsing(false)
    setCame('')
  }
  const show = () => {
    setFind('')
    setCame('')
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
      <Sheet
        open={open}
        onClose={close}
        title="Capture"
        note={browsing && library.offered ? 'Captures from TONE3000. One you preview or get plays on the channel this block is on.' : 'The captures on the unit. The one picked plays on the channel this block is on.'}
        tall={browsing && library.offered}
        scrollKey={browsing && library.offered ? 'library' : undefined}
      >
        {open && browsing && library.offered ? (
          <Tone3000InPop
            id={library.id}
            n={library.n}
            from="captures"
            onPointed={(at) => {
              pointed.current = at
              /* Pointed after the library was left (the sheet closed with the pick still out): Edit was told too early, and is told again. */
              if (left.current) changed.current?.(at)
            }}
            onBack={(line) => {
              setCame(line)
              setBrowsing(false)
              /* A capture sent from there is not in the list yet (read again only if one was), and the block may be on another capture than this panel last read. */
              loadCaptures()
              leave()
            }}
          />
        ) : open ? (
          <View style={{ gap: space.sm }}>
            {library.offered ? <Tone3000Door n={library.n} onPress={browse} /> : null}
            {came ? <Note>{came}</Note> : null}
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
