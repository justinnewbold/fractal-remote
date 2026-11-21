import { useEffect } from 'react'

import { noteEdited, useRig } from '../lib/rig'
import { SaveButton, SaveNotes, useSaveToSlot } from './SaveToSlot'

const ofPreset = (s) => s.preset
const ofUnsaved = (s) => s.unsaved

/**
 * SAVE, AT THE TOP OF A HELD NAM BLOCK'S POP-UP, ONCE A CAPTURE IS GOT.
 *
 * "After getting an amp, add save at the top of the screen, next to where it
 * says NAM - with the warning that it'll overwrite the preset." (Justin, 21
 * November 2026, of the pop-up that reads "NAM 1 is playing … Save the preset
 * to keep it there." and had nothing to save it with.)
 *
 * `came` is what the block said it is playing when a Get handed the pop-up
 * back (screens/Stage ChannelSheet). From then the preset counts as changed
 * (rig.noteEdited, which marks nothing where the app cannot save), and while
 * it does `button` is Save for the title's row and `notes` its warning and
 * its answer for under the title, as they are after any other change made
 * in the pop-up. It is the app's one Save (components/
 * SaveToSlot): a first tap brings up "This will overwrite the current
 * preset", the second writes. Nothing here while the preset is as saved,
 * and nothing where the app has no Save on this connection.
 */
export function useSaveAfterGet(came) {
  const preset = useRig(ofPreset)
  const unsaved = useRig(ofUnsaved)
  const saveTo = useSaveToSlot()
  useEffect(() => {
    if (came) noteEdited()
  }, [came])
  /*
   * AND AFTER ANY CHANGE MADE IN THE POP-UP, not only a Get: "let's put the
   * save button at the top of each of these screens" (his report the same
   * day, of the quick-edit pop-ups: he turned a chorus's knobs and had to
   * leave the pop-up to save). Whatever marked this preset changed (a knob,
   * a channel's capture, a Get) brings Save up beside the title.
   */
  const pending = !!unsaved && unsaved.number === preset?.number
  useEffect(() => {
    if (!pending && saveTo.armed) saveTo.disarm()
  }, [pending, saveTo])
  const busy = saveTo.saving || !!saveTo.said
  return {
    button: pending || saveTo.saving ? <SaveButton s={saveTo} waiting /> : null,
    notes: (pending && saveTo.armed) || busy ? <SaveNotes s={saveTo} /> : null
  }
}
