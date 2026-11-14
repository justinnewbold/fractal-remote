/**
 * A NAM block read again after its capture was changed from OUTSIDE Edit's
 * own pick.
 *
 * Edit's capture picker has a way to more captures (components/
 * CapturePicker), whose page plays one in the block by its own pick, not
 * Edit's. So Edit is told (`onChanged`) and reads the block again, and
 * what the read says is what the Capture button shows.
 *
 * Three things a plain "read it again" gets wrong, each found by a read of
 * the first version before it went out:
 *
 * - It is called from closures made at an earlier drawing (a Get's, half a
 *   minute old over Bluetooth). So everything it goes by is asked for when
 *   it runs (`ends()`), never kept from when it was made.
 * - One that comes while a read is out must not be dropped: the read out
 *   may have left before the change. The block is read once more after it.
 * - A read that fails, or (through the computer) comes back with every
 *   knob at nought and no capture, would leave the button on the old
 *   capture and the preset not marked changed, after the page has told the
 *   player the block is playing the new one and to save the preset. So
 *   where the unit itself said which slot the block was pointed at
 *   (`pointedAt`), that is believed, as a pick of Edit's own is believed
 *   whatever the read after it does.
 *
 * - While a pick of Edit's own is under way (`held`) this one stands
 *   back: that pick reads the block itself. But its read may have left
 *   before the change, so the call is remembered, and `after()`, called
 *   when the pick is over, reads once more if one was. With no slot
 *   vouched for: which of the two picks reached the unit last is not
 *   known.
 *
 * Imports nothing, so a test runs every path of it.
 *
 * `ends()` answers, for now:
 *   read()        the block's read (may throw)
 *   held()        a pick or a restore of Edit's own is under way: it reads
 *                 the block itself, so this one waits for `after()`
 *   now()         the slot the button is on
 *   show(fresh)   draw a read that says which capture the block is on
 *   point(slot)   put the button on a slot, knobs as they are
 *   edited()      the preset has been changed
 *   busy(yes)     the block is being read again
 */
export function captureReread(ends) {
  const job = { going: false, again: false, slot: null, missed: false }
  const run = async (pointedAt = null) => {
    if (Number.isInteger(pointedAt)) job.slot = pointedAt
    if (job.going) {
      job.again = true
      return
    }
    if (ends().held()) {
      job.slot = null
      job.missed = true
      return
    }
    job.going = true
    job.missed = false
    ends().busy(true)
    try {
      do {
        job.again = false
        let fresh = null
        try {
          fresh = await ends().read()
        } catch {
          /* The read failed: the button goes by what the unit said of the pick, if it said. */
        }
        const to = ends()
        const was = to.now()
        if (Number.isInteger(fresh?.capture?.slot)) {
          if (fresh.capture.slot !== was) to.edited()
          to.show(fresh)
        } else if (Number.isInteger(job.slot)) {
          if (job.slot !== was) to.edited()
          to.point(job.slot)
        }
      } while (job.again)
    } finally {
      job.going = false
      job.slot = null
      ends().busy(false)
    }
  }
  /** Whoever held it is done: read now, if a change was told meanwhile. */
  run.after = () => (job.missed ? run() : undefined)
  return run
}
