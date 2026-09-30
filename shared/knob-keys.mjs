/**
 * Turning a knob a step at a time, and how those steps reach the unit.
 *
 * "Knobs ignore the keyboard." They didn't, quite: the arrow key moved the
 * knob and asked for the write in the same instant, and the write read the
 * value from BEFORE the move. So the unit missed every other press, the knob
 * flicked back, and the last press was never sent at all. VoiceOver's
 * swipe-to-adjust on the phone did exactly the same thing.
 *
 * Three rules, one copy of each for both apps:
 *
 *   - A step says where it goes (keyTarget), and that value is the one that
 *     is written. Nothing reads it back out of state that has not caught up.
 *   - A run of steps is one write, sent a moment after the last of them
 *     (settleWrites). Ten presses of an arrow are one decision, and ten
 *     checked writes down a relay would still be arriving after the hand had
 *     stopped. The knob sends what it has at once if it loses focus or the
 *     editor closes, so nothing is left behind.
 *   - One write in flight per control (oneWriteAtATime). A value that arrives
 *     while one is out waits, and only the newest waiting value goes next —
 *     two checked writes to the same control racing each other is how the
 *     second one reads back the first.
 */

/** How long the keys have to be still before what they reached is written. */
export const KEY_SETTLE_MS = 250

/** Steps through the range, as a fraction of it. Shift is the fine step. */
export const KEY_STEP = 0.01
export const KEY_FINE_STEP = 0.002
export const KEY_PAGE_STEP = 0.1

const clamp01 = (v) => Math.max(0, Math.min(1, v))

/**
 * Where a key takes a knob sitting at `norm` (0..1), or null for a key that
 * does not turn knobs. The phone's VoiceOver actions are the arrows by other
 * names.
 */
export function keyTarget(key, norm, { fine = false } = {}) {
  const at = clamp01(Number.isFinite(norm) ? norm : 0)
  const step = fine ? KEY_FINE_STEP : KEY_STEP
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
    case 'increment':
      return clamp01(at + step)
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'decrement':
      return clamp01(at - step)
    case 'PageUp':
      return clamp01(at + KEY_PAGE_STEP)
    case 'PageDown':
      return clamp01(at - KEY_PAGE_STEP)
    case 'Home':
      return 0
    case 'End':
      return 1
    default:
      return null
  }
}

/**
 * Hold the newest value and write it once the steps stop.
 *
 * `push` restarts the wait; `flush` writes what is held now, if anything;
 * `held` says what is waiting, so the next step can start from it rather
 * than from a value on screen that has not caught up. The timers are passed
 * in only so a test can drive them.
 */
export function settleWrites(write, { wait = KEY_SETTLE_MS, later = setTimeout, cancel = clearTimeout } = {}) {
  let timer = null
  let has = false
  let value
  const flush = () => {
    if (timer !== null) {
      cancel(timer)
      timer = null
    }
    if (!has) return
    const v = value
    has = false
    value = undefined
    write(v)
  }
  return {
    push(v) {
      value = v
      has = true
      if (timer !== null) cancel(timer)
      timer = later(flush, wait)
    },
    flush,
    held: () => (has ? value : undefined)
  }
}

/**
 * One write in flight per control, and only the newest waiting value next.
 *
 * `send(id, value)` writes now if nothing is out for that id; otherwise it
 * replaces whatever was waiting and resolves when the lane is empty again.
 * `busy(id)` says whether a write is out — a caller that skips a value equal
 * to the one on screen must not skip it while an older one is still going,
 * or turning a knob back to where it started never reaches the unit.
 *
 * The writer reports its own failures; a throw here does not strand what was
 * waiting behind it.
 *
 * `same(a, b)` decides when a waiting value is the one just written, so it is
 * not sent twice. The default, Object.is, only works for plain values — both
 * apps send a fresh job object per turn, so they pass their own.
 */
export function oneWriteAtATime(write, { same = Object.is } = {}) {
  const lanes = new Map()
  const send = (id, value) => {
    const lane = lanes.get(id)
    if (lane) {
      lane.waiting = { value }
      return lane.done
    }
    const me = { waiting: null, done: null }
    lanes.set(id, me)
    me.done = (async () => {
      let v = value
      try {
        for (;;) {
          try {
            await write(v)
          } catch {
            /* Said by the writer, where it can be said beside the knob. */
          }
          const next = me.waiting
          me.waiting = null
          if (!next || same(next.value, v)) break
          v = next.value
        }
      } finally {
        lanes.delete(id)
      }
    })()
    return me.done
  }
  return { send, busy: (id) => lanes.has(id) }
}
