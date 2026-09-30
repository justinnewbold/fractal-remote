/**
 * How long "✓ Saved" stays up, and the timer that takes it down.
 *
 * Was four seconds. A save asked for from a phone is carried out by the page
 * at the Mac and reported back, so the word can arrive several seconds after
 * the press — and the press was very likely made from across a room. Long
 * enough to still be there when you look back at the phone; short enough that
 * walking away leaves a clean bar.
 */
export const SAVED_FOR_MS = 10000

/** Whether a save at `savedAt` still says so at `now`. */
export const saidSaved = (savedAt, now = Date.now()) => !!savedAt && now - savedAt < SAVED_FOR_MS

/**
 * Call `onGone` once the word's time is up. Returns a cancel.
 *
 * "✓ Saved never goes away." The one real way it could: a timer that fires a
 * hair early, as a browser is allowed to, found the word still due, drew it
 * again — and nothing ever set another timer, because nothing the bar
 * watches had changed. So a timer that fires early sets the next one for
 * what is left, every time, until the time really is up.
 */
export function whenSavedGoes(savedAt, onGone, { now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let id = null
  let over = false
  const check = () => {
    id = null
    if (over) return
    const left = SAVED_FOR_MS - (now() - savedAt)
    if (left > 0) {
      id = setTimer(check, left)
      return
    }
    over = true
    onGone()
  }
  id = setTimer(check, Math.max(0, SAVED_FOR_MS - (now() - savedAt)))
  return () => {
    over = true
    if (id !== null) clearTimer(id)
  }
}
