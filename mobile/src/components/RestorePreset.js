import { useCallback, useEffect, useRef, useState } from 'react'

import { isDemo } from '../lib/demo'
import { listSnapshots } from '../lib/device'
import { isVp4 } from '../lib/vp4-safety'
import { useRig } from '../lib/rig'
import { RESTORE_BUTTON, RESTORE_TITLE, am4TooOld, backupRows, backupsHere, restoreSub } from '../lib/backups'
import { linkState } from '../lib/link'
import { isOlder } from '../lib/versions'
import { useAutoBackup } from '../lib/useBackups'
import Backups from './Backups'
import Press from './Press'
import Sheet from './Sheet'

const ofPreset = (s) => s.preset
const ofSlug = (s) => s.deviceSlug
const ofCaps = (s) => s.capabilities
const ofUnsaved = (s) => s.unsaved

/**
 * RESTORE PRESET, at the foot of Edit (lib/backups; "after they save there’s
 * a button somewhere, probably the bottom of the page ... Restore preset.
 * And that only needs to be there if they’ve changed that preset", Justin,
 * 26 November 2026).
 *
 * Drawn only where the computer holds a backup of the preset the unit is on
 * (a save from this app asks the computer to keep one first: SaveToSlot's
 * `keepFirst`), so a preset nobody has changed has no button. A tap opens
 * those backups, newest first, each with when it was taken, Play it and
 * Restore: the Backups page's own list and its own asks, nothing new sent.
 *
 * The list is read when the preset changes, when a save lands (the rig's
 * `unsaved` going) and when the sheet closes; a read that fails draws
 * nothing.
 */
export default function RestorePreset() {
  const allowed = useAutoBackup()
  const preset = useRig(ofPreset)
  const slug = useRig(ofSlug)
  const caps = useRig(ofCaps)
  const unsaved = useRig(ofUnsaved)
  const slot = Number.isInteger(preset?.number) ? preset.number : null
  const way = isDemo() ? 'demo' : caps?.via === 'bluetooth' ? 'bluetooth' : 'computer'
  const here = allowed && slot != null && backupsHere({ way, vp4: isVp4(slug), am4: am4TooOld(slug, linkState().hostVersion, isOlder) }).ok
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const asked = useRef(0)

  const load = useCallback(async () => {
    const mine = ++asked.current
    if (!here) {
      setCount(0)
      return
    }
    try {
      const rows = backupRows(await listSnapshots(slot), { slot, unit: slug })
      if (asked.current === mine) setCount(rows.length)
    } catch {
      if (asked.current === mine) setCount(0)
    }
  }, [here, slot, slug])
  const changed = !!unsaved
  useEffect(() => {
    load()
  }, [load, changed])

  if (!here || (!count && !open)) return null
  return (
    <>
      <Press label={RESTORE_BUTTON} sub={count ? restoreSub(count) : undefined} onPress={() => setOpen(true)} />
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false)
          load()
        }}
        title={RESTORE_TITLE}
        tall
      >
        {open ? <Backups only /> : null}
      </Sheet>
    </>
  )
}
