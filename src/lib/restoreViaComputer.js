/**
 * Putting back a snapshot, from wherever the button was pressed.
 *
 * "Put back" and "Play it" both went to the unit as `/version/…`, and the relay
 * refuses every one of those — so from a phone, or the website on one, both
 * buttons failed with "You can't load or restore a version from your phone".
 * The refusal is right and stays: a snapshot written over a slot from across
 * a room is exactly the mis-tap the relay is there to stop. What goes over
 * instead is the same thing a save from the phone does — a request left in the
 * computer's store, carried out by the Mac window where writing was always
 * allowed, and its answer read back. See shared/save-wait.mjs, whose waiting
 * this uses.
 *
 * And the panel said something that was not true. "One is taken before a slot
 * is overwritten" — nothing took one, so a Put back could not itself be put
 * back. `restoreNow` does it now, on every Put back, at the Mac or from away:
 * what is in the slot is kept as a snapshot first, and a slot whose copy
 * cannot be taken is not written at all. An empty slot has nothing to keep,
 * and the computer answers 422 for it — but it answers 422 for a slot whose
 * dump failed its checksum too ("empty/invalid preset"), and that one has a
 * real preset in it. So a 422 is only believed when the unit itself names the
 * slot `<EMPTY>`; otherwise the copy is asked for once more, and if it still
 * will not come the slot is left alone.
 *
 * The version's own bytes are read BEFORE that copy is taken. The computer
 * keeps thirty snapshots a slot and drops the oldest when a thirty-first
 * arrives — so putting back the oldest one would otherwise push out the very
 * snapshot being put back, between checking it was there and using it.
 */
import { deviceSlug, DEFAULT_SLUG } from '../../shared/device-slug.mjs'
import { SAVE_FRESH_MS, SAVE_LATE_MS, SAVE_POLL_MS, startSaveWait } from '../../shared/save-wait.mjs'
import { isEmptySlotName } from './presetName.js'

/** The three documents, as a save has: the ask, the answer, and "picked up". */
export const pendingRestoreDoc = (slug) => `fractal.pendingRestore.${slug}`
export const restoreResultDoc = (slug) => `fractal.restoreResult.${slug}`
export const restoreProgressDoc = (slug) => `fractal.restoreProgress.${slug}`

/*
 * Shorter than a save's two minutes. A Mac window that knows about this hears
 * the request the moment it lands; one that does not will never answer, and
 * the only thing to tell the person holding the phone is that, sooner.
 */
export const RESTORE_WAIT_MS = 45 * 1000
/* Reading the slot for its copy is a dump over the cable, then a load and a store. */
export const RESTORE_WORKING_MS = 90 * 1000
export const RESTORE_FRESH_MS = SAVE_FRESH_MS

/** Words, for a guitarist. */
export const RESTORE_TIMED_OUT = 'The computer didn’t answer — it may need updating. Nothing was changed.'
export const RESTORE_CANCELLED = 'Canceled. Nothing was changed.'
export const RESTORE_REFUSED = 'The computer couldn’t put that snapshot back.'
export const RESTORE_UNSURE = 'The computer took it but didn’t say how it went. Check the unit before trying again.'
export const RESTORE_UNSENT = 'Couldn’t reach the computer to call it off, so it may still happen. Check the unit before trying again.'
export const RESTORE_UNREACHED = 'Couldn’t reach the computer to ask it. Nothing was changed.'
export const RESTORE_STALE = 'The computer saw this too late, so it left it alone. Nothing was changed — ask again.'
export const RESTORE_GONE = 'That snapshot isn’t on the computer any more. Nothing was changed.'
export const RESTORE_NO_LIST = 'Couldn’t read the list of snapshots on the computer. Nothing was changed.'
export const RESTORE_MOVED = 'That snapshot has changed on the computer since this list was read. Nothing was changed — open the list again.'
export const RESTORE_NO_SLOT = 'That snapshot isn’t from a slot, so there’s nowhere to put it back. Use Play it instead.'
export const RESTORE_UNREADABLE = 'The computer couldn’t read that snapshot. Nothing was changed.'
export const RESTORE_LATE_WORDS = 'Still waiting for the computer.'

export const MODES = ['put', 'play']

/*
 * AN AM4 (26 November 2026). Its snapshot cannot be loaded to be heard: the
 * computer has no way to put a preset in an AM4's edit buffer. It goes back
 * by being sent again as it came, which writes the slot it was taken from
 * (api.restoreDump). So Play it is refused in words, and a Put back keeps
 * its copy of the slot first as ever, sends the dump, and asks the unit to
 * load the slot again where it is the one playing (api.reload).
 */
export const VERBATIM_UNITS = ['am4']
export const AM4_NO_PLAY = 'An AM4 can’t play a backup without putting it back. Use Restore to put it back in its slot. Nothing was changed.'

/*
 * AND A THIRD ASK, FROM THE PHONE APP'S BACKUPS PAGE (22 November 2026):
 * keep a copy of a slot NOW, as it is saved on the unit. The relay refuses
 * /backup from a handset as it refuses /version, so it comes the same way:
 * a request left in the store, `{ id, mode: 'keep', slot }`, with no version
 * in it. A computer app from before this passes it over (it wants a
 * version), and the phone's wait says the computer may need updating.
 */
export const KEEP = 'keep'
export const KEEP_NO_SLOT = 'There’s no preset to back up. Nothing was changed.'

/** Do it, here: a snapshot of what slot `req.slot` holds. `api` is restoreNow's. */
export async function keepNow(req, api) {
  const slot = req?.slot
  if (!Number.isInteger(slot) || slot < 0) throw new Error(KEEP_NO_SLOT)
  if (api.slotOutside?.(slot)) throw new Error(`Slot ${slot} isn’t on this unit. Nothing was changed.`)
  const failed = () => new Error(`Couldn’t back up slot ${slot}. Nothing was changed.`)
  let kept = false
  try {
    kept = !!(await api.snapshotSlot(slot))?.version
  } catch (err) {
    /* 422 is an empty slot, or a dump that failed its checksum: only the unit's own <EMPTY> says which (see restoreNow). */
    if (err?.status !== 422) throw failed()
    let name = null
    try {
      name = await api.slotName?.(slot)
    } catch {}
    if (isEmptySlotName(name)) throw new Error(`Slot ${slot} is empty, so there’s nothing to back up.`)
    try {
      kept = !!(await api.snapshotSlot(slot))?.version
    } catch {}
  }
  if (!kept) throw failed()
  return { ok: true, mode: KEEP, slot, kept: true, said: `Backed up slot ${slot} as it is saved on the unit.` }
}

/*
 * AND A COPY KEPT BEFORE A SAVE WRITES OVER A SLOT (26 November 2026).
 * "Let's make it back it up automatically when someone changes a preset or
 * adds a NAM block ... where after they save there's a button ... Restore
 * preset" (Justin). A save the phone asks for may say `keepFirst: true`; the
 * computer then takes a snapshot of the slot AS IT IS SAVED, before the
 * store, so the version the save replaces is the newest backup of that slot.
 *
 * NEVER IN THE SAVE'S WAY: a snapshot that fails, is refused (a unit the
 * computer cannot snapshot, an empty slot) or takes longer than
 * KEEP_FIRST_MS is given up on and the save goes on. The answer says whether
 * one was kept, and nothing else changes. A save that does not ask is
 * exactly the save it always was.
 */
export const KEEP_FIRST_MS = 8000

/** `{ asked, kept, why? }`; never throws. `api.snapshotSlot` is restoreNow's. */
export async function keepBeforeSave(req, api, { limitMs = KEEP_FIRST_MS, timer = setTimeout, clear = clearTimeout } = {}) {
  if (req?.keepFirst !== true || !Number.isInteger(req?.slot) || req.slot < 0) return { asked: false, kept: false }
  let t = null
  try {
    const late = new Promise((_, no) => {
      t = timer(() => no(new Error('took too long')), limitMs)
    })
    const got = await Promise.race([Promise.resolve().then(() => api.snapshotSlot(req.slot)), late])
    return { asked: true, kept: !!got?.version }
  } catch (err) {
    return { asked: true, kept: false, why: err?.message || String(err) }
  } finally {
    if (t != null) clear(t)
  }
}

/** What the asking side leaves for the computer. */
export function restoreRequest(version, mode, { id, now = Date.now } = {}) {
  return {
    id: id || `${now()}-${Math.random().toString(36).slice(2, 7)}`,
    mode,
    versionId: version.id,
    slot: Number.isInteger(version.location) ? version.location : null,
    model: typeof version.model === 'string' ? version.model : null,
    name: version.name || ''
  }
}

/** What overwrites a request to call it off: no version, so nothing carries it out. */
export const cancelledRestore = (id) => ({ id, cancelled: true })

const slotName = (v) => (v?.name ? `“${v.name}”` : 'the snapshot')

/**
 * Do it, here, with the unit this machine has the cable to.
 *
 * `req` is `{ versionId, mode, slot?, model? }`; slot and model are what the
 * asking side saw, and a version that no longer matches them is refused rather
 * than written somewhere nobody chose. `api` is the unit and the computer's
 * store: listVersions, versionBytes, snapshotSlot, loadPresetBytes,
 * storePreset, slotName(n) — the unit's own name for a slot, raw, `<EMPTY>`
 * and all — and optionally unitSlug and slotOutside(n).
 *
 * Returns `{ ok: true, mode, slot, kept, said }`. Throws with words to show.
 */
export async function restoreNow(req, api) {
  if (!MODES.includes(req?.mode)) throw new Error(RESTORE_REFUSED)
  let list
  try {
    list = (await api.listVersions())?.versions || []
  } catch {
    /* Not read is not gone: the snapshot is most likely still there. */
    throw new Error(RESTORE_NO_LIST)
  }
  const v = list.find((x) => x.id === req.versionId)
  if (!v) throw new Error(RESTORE_GONE)
  /* The one that was picked, and not a different one wearing its id. */
  if (Number.isInteger(req.slot) && v.location !== req.slot) throw new Error(RESTORE_MOVED)
  if (req.model && v.model && req.model !== v.model) throw new Error(RESTORE_MOVED)
  /*
   * And from this kind of unit. An FM3's snapshot loaded into an Axe-Fx III is
   * not a sound, it is a refusal halfway through — or worse, one that isn't.
   * Only refused when both are known: the computer names a model it cannot
   * place as model_0x…, and that is not evidence of anything.
   */
  const here = api.unitSlug?.()
  if (v.model && !/^model_0x/i.test(v.model) && here && here !== DEFAULT_SLUG && deviceSlug(v.model) !== here) {
    throw new Error(`That snapshot is from an ${v.model}, and the unit plugged in isn’t one. Nothing was changed.`)
  }
  const slot = v.location
  if (req.mode === 'put') {
    if (!Number.isInteger(slot) || slot < 0) throw new Error(RESTORE_NO_SLOT)
    if (api.slotOutside?.(slot)) throw new Error(`Slot ${slot} isn’t on this unit. Nothing was changed.`)
  }

  /* First — see the top of this file for why. */
  let bytes
  try {
    bytes = await api.versionBytes(v.id)
  } catch {
    throw new Error(RESTORE_UNREADABLE)
  }
  if (!bytes || (!bytes.length && !api.demo)) throw new Error(RESTORE_UNREADABLE)

  const verbatim = VERBATIM_UNITS.includes(here)
  if (verbatim && (req.mode === 'play' || typeof api.restoreDump !== 'function')) throw new Error(req.mode === 'play' ? AM4_NO_PLAY : RESTORE_REFUSED)

  if (req.mode === 'play') {
    await api.loadPresetBytes(bytes)
    return {
      ok: true,
      mode: 'play',
      slot,
      kept: false,
      said: `Playing ${slotName(v)} from slot ${slot}. It isn’t saved to a slot — save it to keep it.`
    }
  }

  /*
   * What is in the slot now, kept before it goes. Anything that stops the copy
   * stops the Put back — the panel promises a copy, and a Put back without one
   * is the overwrite that cannot be undone.
   *
   * Except an empty slot, which has nothing to keep. The computer answers 422
   * for that, and ALSO for a real preset whose dump came back failing its
   * checksum — the same answer for both. Only the unit's own `<EMPTY>` settles
   * which. A blank name does not: that is what comes back when the name could
   * not be read at all. And a damaged dump is usually a one-off, so it is
   * asked for once more before giving up.
   */
  const noCopy = () => new Error(`Couldn’t keep a copy of what’s in slot ${slot} first, so nothing was changed.`)
  let kept
  try {
    const snap = await api.snapshotSlot(slot)
    kept = !!snap?.version
  } catch (err) {
    if (err?.status !== 422) throw noCopy()
    let name = null
    try {
      name = await api.slotName?.(slot)
    } catch {}
    if (isEmptySlotName(name)) {
      kept = false
    } else {
      try {
        kept = !!(await api.snapshotSlot(slot))?.version
      } catch {}
      if (!kept) throw noCopy()
    }
  }
  if (verbatim) {
    await api.restoreDump(bytes)
    /* The slot is written; what is PLAYING is still the old sound until the slot is loaded again. Best effort: the write has happened either way. */
    try {
      await api.reload?.(slot)
    } catch {}
  } else {
    await api.loadPresetBytes(bytes)
    await api.storePreset(slot)
  }
  return {
    ok: true,
    mode: 'put',
    slot,
    kept,
    said: kept
      ? `Put ${slotName(v)} back in slot ${slot}. What was there is kept as a snapshot, so that can go back too.`
      : `Put ${slotName(v)} back in slot ${slot}. The slot was empty, so there was nothing to keep.`
  }
}

/**
 * Whether what is now loaded counts as unsaved, once a restore is done.
 *
 * Play it leaves a sound that is in no slot, and says "save it to keep it" —
 * with no unsaved mark there was no Save button to do that with. Put back
 * leaves the unit holding exactly what the slot now holds, so edits it just
 * wrote over are not still waiting to be saved, whatever the screen said
 * before.
 */
export const dirtyAfterRestore = (mode) => mode === 'play'

/**
 * At the Mac: one request the phone left. Carried out, passed over, or
 * refused — and the phone told which, every time.
 *
 * `api` is restoreNow's, plus the store: take() reads the request, clear()
 * removes it, picked(id) and report(result) write the two answers. `handled`
 * is a Set that outlives the call, marked before anything is awaited: the
 * Mac looks again while this is part-way through, and a request still parked
 * would otherwise be carried out twice.
 *
 * Returns what was reported, or null when there was nothing to do.
 */
export async function carryOutRestore(req, api, { handled, now = Date.now, freshMs = RESTORE_FRESH_MS } = {}) {
  /* A cancelled request has no version in it, and is passed over. */
  const keep = req?.mode === KEEP
  if (!req?.id || req.cancelled || (!keep && (!req.versionId || !MODES.includes(req.mode)))) return null
  if (handled?.has(req.id)) return null
  handled?.add(req.id)
  const tell = async (result) => {
    await api.clear().catch(() => {})
    const out = { id: req.id, mode: req.mode, ...result }
    await Promise.resolve(api.report(out)).catch(() => {})
    return out
  }
  if (now() - (req.at || 0) >= freshMs) return tell({ ok: false, error: RESTORE_STALE })
  try {
    await api.picked(req.id)
    /* Still wanted? A phone that gave up wrote over it; asked once more, before the part that can't be undone. */
    const still = await api.take()
    if (still && (still.id !== req.id || still.cancelled)) {
      return tell({ ok: false, cancelled: true, error: RESTORE_CANCELLED })
    }
    const done = keep ? await keepNow(req, api) : await restoreNow(req, api)
    return tell(done)
  } catch (err) {
    return tell({ ok: false, error: err?.message || RESTORE_REFUSED })
  }
}

/**
 * On the asking side: wait for the answer, with the save's rules and these
 * words. `readResult`, `readProgress`, `cancelRequest` and `listen` are the
 * store; see startSaveWait for what `done` resolves.
 */
export function startRestoreWait({ id, slug, readResult, readProgress, cancelRequest, listen, onState, startedAt, ...rest }) {
  return startSaveWait({
    /* The clock and the naps, for a test; never the documents or the words. */
    ...rest,
    id,
    resultDoc: restoreResultDoc(slug),
    progressDoc: restoreProgressDoc(slug),
    readResult,
    readProgress,
    cancelRequest,
    listen,
    onState,
    startedAt,
    waitMs: RESTORE_WAIT_MS,
    workingMs: RESTORE_WORKING_MS,
    lateMs: SAVE_LATE_MS,
    pollMs: SAVE_POLL_MS,
    words: {
      timedOut: RESTORE_TIMED_OUT,
      cancelled: RESTORE_CANCELLED,
      refused: RESTORE_REFUSED,
      unsure: RESTORE_UNSURE,
      unsent: RESTORE_UNSENT
    }
  })
}
