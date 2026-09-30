/**
 * Saving to a slot from a phone, which a phone cannot do.
 *
 * "After a chain or setting has been updated there needs to be a save button
 * that actually writes it and saves it to the unit."
 *
 * The computer refuses POST /preset/store from a phone — see REMOTE_FORBIDDEN
 * in relay-rules — and it is right to: a stray tap on a dark stage must not
 * overwrite slot 67. What a phone CAN do is leave a request in the computer's
 * store, and the app at the computer has been carrying those out for weeks:
 * it checks the request is fresh and that the unit is still on the preset the
 * phone was editing, writes the slot, and leaves an answer in the store under
 * the request's id. The browser on a phone has used this since the Save sheet
 * said "the computer writes it". The phone app uses the same documents, and
 * the waiting itself is shared with the browser (lib/save-wait, generated
 * from shared/save-wait.mjs), so the two ends cannot drift.
 *
 * Pure: the store reads and writes and the clock are handed in.
 */
import {
  SAVE_POLL_MS,
  SAVE_WAIT_MS,
  cancelledSave,
  pendingSaveDoc,
  saveProgressDoc,
  saveResultDoc,
  startSaveWait
} from './save-wait.js'

export { SAVE_POLL_MS, SAVE_WAIT_MS, pendingSaveDoc, saveProgressDoc, saveResultDoc }

/** A request id nobody else will produce. */
export const saveId = (now = Date.now(), random = Math.random) =>
  `p${now.toString(36)}${Math.floor(random() * 1e6).toString(36)}`

/**
 * Ask the computer to save what the unit is playing over `slot`, and wait for
 * its answer. Returns `{ done, cancel }`; see startSaveWait.
 *
 * `done` resolves `{ ok: true, slot }` when the computer says it wrote it,
 * `{ ok: false, error }` when it says it could not, when it has not answered
 * in time, or when the person cancelled. Never rejects.
 */
export function startComputerSave({
  park,
  readResult,
  readProgress,
  listen,
  onState,
  slug = '',
  slot,
  name = '',
  id = saveId(),
  waitMs = SAVE_WAIT_MS,
  pollMs = SAVE_POLL_MS,
  lateMs,
  workingMs,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = Date.now
}) {
  if (!Number.isInteger(slot)) {
    return { done: Promise.resolve({ ok: false, error: 'No preset is loaded to save.' }), cancel: () => {}, stop: () => {} }
  }
  let wait = null
  let cancelled = false
  let stopped = false
  const done = (async () => {
    const startedAt = now()
    try {
      /* `fromSlot` is what lets the computer refuse a save if the unit has
         moved on to another preset by the time it looks. */
      await park({ id, slot, name: String(name || '').trim(), fromSlot: slot, fromName: name || null })
    } catch (err) {
      return { ok: false, error: `Couldn’t leave the request for the computer: ${err?.message || err}` }
    }
    wait = startSaveWait({
      id,
      resultDoc: saveResultDoc(slug),
      progressDoc: saveProgressDoc(slug),
      readResult,
      readProgress,
      /* Over the request, since a phone cannot delete it. */
      cancelRequest: () => park(cancelledSave(id)),
      listen,
      onState,
      startedAt,
      waitMs,
      pollMs,
      ...(lateMs != null ? { lateMs } : {}),
      ...(workingMs != null ? { workingMs } : {}),
      sleep,
      now
    })
    if (cancelled) wait.cancel()
    if (stopped) wait.stop()
    const res = await wait.done
    return res.ok ? { ok: true, slot: Number.isInteger(res.slot) ? res.slot : slot } : res
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

/** The same, for a caller that only wants the answer. */
export const askComputerToSave = (opts) => startComputerSave(opts).done
