/**
 * Waiting for the computer to carry out a save asked for from somewhere else.
 *
 * A phone cannot write a slot: the computer refuses that from a handset, and
 * should. So the request is left in the computer's store and the computer's
 * answer is read back from it. Both ends have done this for a while — the
 * browser on a phone and the phone app — and each did its own waiting. This is
 * the waiting, once, so the two cannot drift.
 *
 * "Save takes 60-90 s and locks the page." The write itself is one message to
 * the unit. The minute was the computer only looking for a parked request
 * every six seconds, which a hidden window stretches to about once a minute.
 * The computer's store announces every write to it the moment it lands — the
 * same announcement a phone already hears for scene names — so both sides now
 * listen for that and look straight away, and keep the timed look as the
 * fallback for an announcement lost on the way.
 *
 * THREE DOCUMENTS, NOT TWO. The request, the answer, and whether the computer
 * has picked the request up. The third is its own document because phone
 * builds already out there take ANY answer with their request's id as final:
 * "picked it up" written into the answer would read on those phones as a
 * finished save that never said whether it worked.
 *
 * CANCELLING IS AN OVERWRITE. A phone cannot delete from the computer's store
 * (the relay refuses DELETE), so a cancelled request is replaced by one with
 * no slot in it. Every computer, old or new, ignores a request without a slot.
 *
 * Pure: the store reads and writes, the announcements and the clock are all
 * handed in.
 */

/** Longest wait for a computer that has not picked the request up. */
export const SAVE_WAIT_MS = 2 * 60 * 1000
/** And the extra a computer that has picked it up gets to finish. */
export const SAVE_WORKING_MS = 60 * 1000
/** When the plain "Saving…" is joined by a word about the computer. */
export const SAVE_LATE_MS = 15 * 1000
/** How often to look when no announcement arrives. */
export const SAVE_POLL_MS = 3000
/*
 * How old a request the computer will still carry out. Past the longest
 * anybody waits — the phone has said "nothing was saved" by then, and written
 * over the request — with room for a phone's clock and the computer's to
 * disagree by a minute or two, since the age is one clock's time read on the
 * other. Was fifteen minutes, which let a save land long after the phone had
 * said it had not.
 */
export const SAVE_FRESH_MS = 5 * 60 * 1000

/** The documents, by the unit's slug. */
export const pendingSaveDoc = (slug) => `fractal.pendingSave.${slug}`
export const saveResultDoc = (slug) => `fractal.saveResult.${slug}`
export const saveProgressDoc = (slug) => `fractal.saveProgress.${slug}`

/** What overwrites a request to cancel it. No slot, so nothing will carry it out. */
export const cancelledSave = (id) => ({ id, cancelled: true })

/** Words, for a guitarist. */
export const SAVE_LATE_WORDS = 'Still saving. The computer hasn’t answered yet.'
export const SAVE_TIMED_OUT =
  'The computer didn’t answer, so nothing was saved. Check Fractal Remote is open on the computer, then save again.'
export const SAVE_CANCELLED = 'Cancelled. Nothing was saved.'
export const SAVE_REFUSED = 'The computer could not save it.'
/*
 * Two ends where "nothing was saved" would be a guess. Once the computer has
 * the request, a store may already be done that no overwrite can undo; and a
 * cancel that never arrived leaves the request there for the computer to
 * carry out. Either way the slot may have changed, and saying it did not is
 * the one answer that loses a preset.
 */
export const SAVE_UNSURE = 'The computer took it but didn’t say whether it saved. Check the slot on the unit before saving again.'
export const SAVE_UNSENT = 'Couldn’t reach the computer to call the save off, so it may still happen. Check the slot before saving again.'

/**
 * Wait for the answer to request `id`.
 *
 * Returns `{ done, cancel, stop }`:
 *   - `done` resolves `{ ok: true, slot }`, or `{ ok: false, error, timedOut?,
 *     cancelled?, unsure? }`. It never rejects: a slow computer is a state to
 *     say, not a fault. `unsure` is a slot that may have been written — see
 *     SAVE_UNSURE — and is never also `cancelled`.
 *   - `cancel()` is the person saying stop. The request is overwritten so the
 *     computer will not carry it out later, and `done` says so — unless the
 *     computer had already picked it up, in which case its answer is waited
 *     for and what it says is what happened.
 *   - `stop()` is the screen going away. Nothing is written.
 *
 * `listen(fn)` subscribes to the store's announcements, calling
 * `fn(docId, data)`; it returns an unsubscribe. `onState({ late, picked })`
 * is told whenever either changes.
 */
export function startSaveWait({
  id,
  resultDoc,
  progressDoc,
  readResult,
  readProgress = async () => null,
  cancelRequest = async () => {},
  listen = () => () => {},
  onState = () => {},
  startedAt,
  waitMs = SAVE_WAIT_MS,
  workingMs = SAVE_WORKING_MS,
  lateMs = SAVE_LATE_MS,
  pollMs = SAVE_POLL_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now
}) {
  const start = Number.isFinite(startedAt) ? startedAt : now()
  const heard = { result: null, progress: null }
  let wake = null
  let cancelled = false
  let stopped = false
  let late = false
  let picked = false

  const poke = () => {
    const go = wake
    wake = null
    go?.()
  }
  /* A nap that an announcement, a cancel or a stop cuts short. */
  const nap = (ms) =>
    new Promise((resolve) => {
      wake = resolve
      Promise.resolve(sleep(ms)).then(() => {
        if (wake === resolve) wake = null
        resolve()
      })
    })

  const off = listen((docId, data) => {
    if (!data || data.id !== id) return
    if (docId === resultDoc) heard.result = data
    else if (docId === progressDoc) heard.progress = data
    else return
    poke()
  })

  const say = (next) => {
    if (next.late === late && next.picked === picked) return
    late = next.late
    picked = next.picked
    try {
      onState({ late, picked })
    } catch {
      // A screen that has gone cannot stop the wait.
    }
  }

  const answer = (res) =>
    res.ok
      ? { ok: true, slot: Number.isInteger(res.slot) ? res.slot : null }
      : { ok: false, error: res.error || SAVE_REFUSED, ...(res.cancelled ? { cancelled: true } : {}) }

  const look = async () => {
    if (heard.result) return heard.result
    try {
      const res = await readResult()
      return res && res.id === id ? res : null
    } catch {
      return null
    }
  }

  const lookPicked = async () => {
    if (picked || heard.progress) return true
    try {
      const p = await readProgress()
      return !!p && p.id === id
    } catch {
      return false
    }
  }

  /*
   * Written over, then looked at again. A computer that never picked the
   * request up will now pass it over, so one look is enough. One that has it
   * may be past its last check, storing: its answer is what happened, so it is
   * waited for — heard the moment it is written — and a computer that obeyed
   * the cancel says so too. Picked up is asked afresh once the overwrite has
   * landed: the computer writes it before that last check, so a save that went
   * ahead anyway always shows here.
   */
  const giveUp = async (words) => {
    let calledOff = true
    try {
      await cancelRequest()
    } catch {
      calledOff = false
    }
    const took = await lookPicked()
    if (took) {
      /* Plain "Saving…" again: Cancel has been pressed, and it is finishing. */
      say({ late, picked: true })
      /* A cancel gets the computer's working time; a timeout has had it. */
      const until = now() + (cancelled ? workingMs : Math.min(pollMs, 1500))
      for (;;) {
        const last = await look()
        if (last) return answer(last)
        if (stopped) return { ok: false, error: '', stopped: true }
        const left = until - now()
        if (left <= 0) break
        await nap(Math.max(1, Math.min(pollMs, 1500, left)))
      }
    } else {
      const last = await look()
      if (last) return answer(last)
    }
    /* Not flagged cancelled, so both ends show these as the warning they are. */
    const why = cancelled ? {} : { timedOut: true }
    if (took) return { ok: false, error: SAVE_UNSURE, unsure: true, ...why }
    if (!calledOff) return { ok: false, error: SAVE_UNSENT, unsure: true, ...why }
    return { ok: false, error: words, ...(cancelled ? { cancelled: true } : why) }
  }

  const done = (async () => {
    try {
      for (;;) {
        if (stopped) return { ok: false, error: '', stopped: true }
        if (cancelled) return await giveUp(SAVE_CANCELLED)
        const res = await look()
        if (res) return answer(res)
        if (stopped) return { ok: false, error: '', stopped: true }
        const isPicked = await lookPicked()
        const spent = now() - start
        say({ late: spent >= lateMs, picked: isPicked })
        const limit = waitMs + (picked ? workingMs : 0)
        if (spent >= limit) return await giveUp(SAVE_TIMED_OUT)
        if (cancelled) continue
        await nap(Math.max(1, Math.min(pollMs, limit - spent)))
      }
    } finally {
      off?.()
    }
  })()

  return {
    done,
    cancel: () => {
      cancelled = true
      poke()
    },
    stop: () => {
      stopped = true
      poke()
    }
  }
}
