/**
 * BACKUPS ON THE PHONE: a preset kept on the computer, and put back from it.
 *
 * "What was the status on making a way to back up and restore presets?" and
 * "Yes, build the backups screen through the computer" (Justin, 22 November
 * 2026). The browser and the computer's own window have had Snapshots for
 * months (src/components/Versions.jsx): a raw copy of one slot at one
 * moment, kept on the computer's disk, thirty a slot. The phone had none of
 * it.
 *
 * A phone may READ the list (GET /versions travels the relay) and may not
 * take or put back a snapshot itself: /backup and /version are refused from
 * a handset, and should be. So it asks as the browser on a phone asks, and
 * as a save from the phone asks: a request left in the computer's store,
 * carried out by the computer app's window, and its answer read back
 * (src/lib/restoreViaComputer.js, whose documents and waiting these are; a
 * test holds the names and the times equal).
 *
 * THREE THINGS CAN BE ASKED:
 *   put   the snapshot written over the slot it came from. The computer keeps
 *         what is in the slot as a snapshot first, and writes nothing if it
 *         cannot.
 *   play  the snapshot loaded to be heard, in no slot.
 *   keep  a copy of a slot taken now, as it is SAVED on the unit. New with
 *         this screen, so it needs a computer app that knows it; an older
 *         one never answers, and the wait says so.
 *
 * WHERE THEY ARE KEPT: on the computer, never on this device and never on
 * a server. Over Bluetooth or the unit's USB cable there is no computer, so
 * there is nothing to list and nobody to ask; the page says so.
 *
 * Pure: the store, the clock and the device are handed in. The wiring is
 * lib/backupsHere.js and the page components/Backups.js.
 */
import { SAVE_FRESH_MS, SAVE_LATE_MS, SAVE_POLL_MS, startSaveWait } from './save-wait.js'
import { DEFAULT_SLUG, deviceSlug } from './device-slug.js'

/** The three documents, the browser's own (src/lib/restoreViaComputer.js). */
export const pendingRestoreDoc = (slug) => `fractal.pendingRestore.${slug}`
export const restoreResultDoc = (slug) => `fractal.restoreResult.${slug}`
export const restoreProgressDoc = (slug) => `fractal.restoreProgress.${slug}`

export const RESTORE_WAIT_MS = 45 * 1000
export const RESTORE_WORKING_MS = 90 * 1000
export const RESTORE_FRESH_MS = SAVE_FRESH_MS

export const MODES = ['put', 'play', 'keep']

/* Words, for a guitarist. */
export const BACKUPS_TITLE = 'Backups'
export const BACKUPS_ROW_STATUS = 'Keep a copy of a preset, and put one back'
export const BACKUPS_WHERE = 'Backups are kept on your computer, not on this device. A backup is the preset as it was saved on the unit at that moment.'
export const BACKUPS_NEED_COMPUTER =
  'Backups are kept on a computer, so they need one. Connect through a computer or a Raspberry Pi to back up a preset or put one back.'
export const BACKUPS_NOT_VP4 = 'Backups aren’t available for a VP4.'
/*
 * AN AM4 (26 November 2026): the computer app keeps and puts back an AM4's
 * presets from version AM4_BACKUPS_FROM (its engine had no snapshot of one
 * before: "Couldn’t back up slot 92", Justin's AM4). An older one is told to
 * update, in place of a button that fails; one whose version is not known is
 * let try. And an AM4's backup cannot be PLAYED first: the computer has no
 * way to load one to be heard, only to put it back in its slot, so its rows
 * have Restore alone (the computer refuses a Play it there in words).
 */
export const AM4_BACKUPS_FROM = '2.5.5'
export const BACKUPS_NOT_AM4 = `Update the computer app to version ${AM4_BACKUPS_FROM} or later to back up an AM4’s presets.`
export const AM4_NO_PLAY_NOTE = 'On an AM4 a backup can’t be played first: Restore puts it straight back in its slot.'
/** Whether the computer app is too old for an AM4's backups. `older(a, b)` is lib/versions isOlder. */
export const am4TooOld = (slug, version, older) => slug === 'am4' && typeof version === 'string' && !!version && older(version, AM4_BACKUPS_FROM) === true
/** Whether a row gets Play it: never an AM4's. */
export const playsHere = (slug) => slug !== 'am4'
/* RESTORE PRESET, at the foot of Edit (components/RestorePreset): the backups of the preset the unit is on, where there are any. */
export const RESTORE_BUTTON = 'Restore preset'
export const RESTORE_TITLE = 'Restore preset'
export const RESTORE_ROW = 'Restore'
export const restoreSub = (n) => (n === 1 ? '1 earlier version kept on the computer' : `${n} earlier versions kept on the computer`)
export const RESTORE_NOTE = 'Each is this preset as it was saved before a change. Restore puts one back in the slot.'
/** What a save says, and that the version before it was kept where it was. */
export const savedWords = (slot, kept) =>
  kept === true ? `Saved to slot ${slot}. The version before it is backed up: Restore preset is at the bottom of Edit.` : `Saved to slot ${slot}.`
export const BACKUPS_NONE_SLOT = 'No backups of this preset yet.'
export const BACKUPS_NONE = 'No backups on the computer yet.'
export const BACKUPS_NO_LIST = 'Couldn’t read the backups on the computer.'
export const KEEP_BUTTON = 'Back up this preset'
export const KEEP_NOTE = 'It backs up the preset as it is saved on the unit. Changes you haven’t saved aren’t in it: save first to keep those.'
export const PLAY_BUTTON = 'Play it'
export const PUT_BUTTON = 'Put back'
export const THIS_PRESET = 'This preset'
export const ALL_PRESETS = 'All'
export const TIMED_OUT = 'The computer didn’t answer. The computer app may need updating, or its window may be closed. Nothing was changed.'
export const CANCELLED = 'Canceled. Nothing was changed.'
export const REFUSED = 'The computer couldn’t do that.'
export const UNSURE = 'The computer took it but didn’t say how it went. Check the unit before trying again.'
export const UNSENT = 'Couldn’t reach the computer to call it off, so it may still happen. Check the unit before trying again.'
export const UNREACHED = 'Couldn’t reach the computer to ask it. Nothing was changed.'
export const LATE_WORDS = 'Still waiting for the computer.'

/** What is asked before a Put back: it writes over a slot. */
export const putAsk = (v, { unsaved = false } = {}) => ({
  title: `Put this backup back in slot ${v.slot}?`,
  body: `It writes over what is saved in slot ${v.slot}. The computer keeps what is there now as a backup first, so that can go back too.${unsaved ? ' Your unsaved changes to the preset you’re on will be lost.' : ''}`,
  yes: `Put back in slot ${v.slot}`
})
/** And before a Play it, only where something unsaved would go. */
export const playAsk = () => ({
  title: 'Play this backup?',
  body: 'It replaces the sound that is loaded. Your unsaved changes to the preset you’re on will be lost.',
  yes: PLAY_BUTTON
})

/** While one is out. */
export const waitingWords = (mode, slot, { late = false, picked = false } = {}) =>
  late && !picked
    ? LATE_WORDS
    : mode === 'keep'
      ? `Backing up slot ${slot}…`
      : mode === 'play'
        ? 'Loading the backup…'
        : `Putting it back in slot ${slot}…`

/** A request id nobody else will produce. */
export const askId = (now = Date.now(), random = Math.random) => `b${now.toString(36)}${Math.floor(random() * 1e6).toString(36)}`

/** What is left for the computer to put back or play: the browser's own shape. */
export function restoreRequest(version, mode, { id = askId() } = {}) {
  return {
    id,
    mode,
    versionId: version.id,
    slot: Number.isInteger(version.slot) ? version.slot : null,
    model: typeof version.model === 'string' ? version.model : null,
    name: version.name || ''
  }
}

/** And to keep a copy of a slot now. No version in it: an older computer app passes it over. */
export function keepRequest(slot, { id = askId(), name = '' } = {}) {
  return { id, mode: 'keep', slot, name: String(name || '') }
}

/** What overwrites a request to call it off. */
export const cancelledAsk = (id) => ({ id, cancelled: true })

/**
 * The computer's list, made into rows: newest first, each with the slot it
 * is of and when it was taken. Anything that is no snapshot is left out.
 * `slot`, when given, keeps that slot's alone. `unit` (the linked unit's
 * slug) leaves out a backup the computer says is ANOTHER unit's: a computer
 * that has had two units plugged in keeps both units' backups in one list,
 * and a tap on the other's could only be refused ("That snapshot is from an
 * FM3, and the unit plugged in isn’t one": Justin's AM4, 26 November 2026).
 * One whose unit is not known is kept, as the computer keeps it.
 */
export function otherUnits(model, unit) {
  if (!unit || unit === DEFAULT_SLUG || typeof model !== 'string' || !model || /^model_0x/i.test(model)) return false
  return deviceSlug(model) !== unit
}
export function backupRows(versions, { slot = null, unit = null } = {}) {
  const rows = []
  for (const v of Array.isArray(versions) ? versions : []) {
    if (!v || (typeof v.id !== 'string' && typeof v.id !== 'number')) continue
    const at = Number(v.at ?? v.capturedAt)
    const of = Number.isInteger(v.location) ? v.location : null
    if (slot != null && of !== slot) continue
    if (otherUnits(v.model, unit)) continue
    rows.push({
      id: v.id,
      slot: of,
      name: typeof v.name === 'string' && v.name.trim() ? v.name.trim() : of != null ? `Slot ${of}` : 'A backup',
      model: typeof v.model === 'string' ? v.model : null,
      label: typeof v.label === 'string' && v.label.trim() ? v.label.trim() : null,
      at: Number.isFinite(at) ? at : null
    })
  }
  return rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
}

/** "today 3:42 PM", "yesterday 9:05 AM", "14 Nov 9:05 AM": when a backup was taken. */
export function whenWords(at, now = Date.now()) {
  if (!Number.isFinite(at)) return ''
  const d = new Date(at)
  const n = new Date(now)
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((day(n) - day(d)) / 86400000)
  const h = d.getHours()
  const time = `${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  if (days === 0) return `today ${time}`
  if (days === 1) return `yesterday ${time}`
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getDate()} ${months[d.getMonth()]}${d.getFullYear() === n.getFullYear() ? '' : ` ${d.getFullYear()}`} ${time}`
}

/** The line under a row's name. */
export const rowLine = (row, now = Date.now()) =>
  [row.slot != null ? `slot ${row.slot}` : null, whenWords(row.at, now) || null, row.label].filter(Boolean).join(' · ')

/**
 * Whether the page can do anything here, and what it says if not.
 * `way` is how the device is connected: 'computer', 'bluetooth', 'cable' or
 * 'demo' (lib/linkWay); `linked` whether a unit is there.
 */
export function backupsHere({ way, vp4 = false, am4 = false } = {}) {
  if (vp4) return { ok: false, why: BACKUPS_NOT_VP4 }
  if (way !== 'computer') return { ok: false, why: BACKUPS_NEED_COMPUTER }
  if (am4) return { ok: false, why: BACKUPS_NOT_AM4 }
  return { ok: true, why: null }
}

/** Whether the row and the page are drawn at all: his account until the switch. */
export const backupsOn = ({ admin = false, everyone = false } = {}) => everyone === true || admin === true

/**
 * Ask the computer, and wait for its answer. `park` writes the request,
 * `readResult` and `readProgress` read the two answers, `listen` hears the
 * store. Returns `{ done, cancel, stop }`; `done` never rejects.
 */
export function startBackupAsk({ request, slug = '', park, readResult, readProgress, listen, onState, sleep, now = Date.now, waitMs = RESTORE_WAIT_MS, workingMs = RESTORE_WORKING_MS, pollMs = SAVE_POLL_MS, lateMs = SAVE_LATE_MS }) {
  let wait = null
  let cancelled = false
  let stopped = false
  const done = (async () => {
    const startedAt = now()
    try {
      const ok = await park({ ...request, at: startedAt })
      if (ok === false) return { ok: false, error: UNREACHED }
    } catch {
      return { ok: false, error: UNREACHED }
    }
    wait = startSaveWait({
      id: request.id,
      resultDoc: restoreResultDoc(slug),
      progressDoc: restoreProgressDoc(slug),
      readResult,
      readProgress,
      /* Over the request, since a phone cannot delete it. A cancel that did not land must not read as "nothing was changed". */
      cancelRequest: async () => {
        await park({ ...cancelledAsk(request.id), at: now() })
      },
      listen,
      onState,
      startedAt,
      waitMs,
      workingMs,
      lateMs,
      pollMs,
      ...(sleep ? { sleep } : {}),
      now,
      words: { timedOut: TIMED_OUT, cancelled: CANCELLED, refused: REFUSED, unsure: UNSURE, unsent: UNSENT }
    })
    if (cancelled) wait.cancel()
    if (stopped) wait.stop()
    return wait.done
  })()
  return {
    done,
    cancel: () => {
      cancelled = true
      wait?.cancel()
    },
    stop: () => {
      stopped = true
      wait?.stop()
    }
  }
}
