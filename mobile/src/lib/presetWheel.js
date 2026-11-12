/*
 * THE PRESET WHEEL: All presets as a wheel, beside the list it has always
 * been.
 *
 * "One thing I was thinking on the iPhone app is when they're scrolling
 * through the presets. It makes like a clicking and a vibration kind of like
 * the old iPod wheels did and maybe make some a little bigger and smaller as
 * you're scrolling through them ... to kinda highlight the prominent one in
 * the middle that they're looking for" (Justin, 11 November 2026). Shown
 * three pictures of it, he took the first, as a choice: "Can we do preset
 * scrolling option a as a setting? So we can have both the original and
 * that one."
 *
 * So the list is untouched and stays what a player gets. The wheel is a
 * setting (Settings → Play screen → Tiles & scenes → Preset list). What it
 * is has been made three times, each on his phone's word, and the third is
 * a real click wheel: a ring the thumb runs round, a bar that moves one
 * preset a notch with a click and a tap, and a button in the middle that
 * loads the preset under the bar ("the wheel", below, has the why).
 * NOTHING LOADS UNTIL THAT BUTTON OR A ROW IS PRESSED, exactly as in the
 * list: the bar is where the eye is, not what the unit is playing.
 *
 * WHO SEES THE SETTING is his account until features
 * PRESET_WHEEL_FOR_EVERYONE (`presetWheelOn`), as every new thing is.
 *
 * What follows is the arithmetic, kept apart so it can be tested: what a
 * turn of the ring is worth, where the bar goes, how the room is shared,
 * and when a click is due. Nothing here imports anything.
 */

/** Whether an account is offered the wheel at all: his, or everyone once the switch is on. */
export const presetWheelOn = ({ admin = false, everyone = false } = {}) => admin === true || everyone === true

/* ------------------------------------------------------------ the setting */

/** Where the choice is kept, on the device (lib/store carries keys that start `fractal.`). */
export const WHEEL_KEY = 'fractal.presetWheel'

/** What a device has until somebody chooses: the list, and clicks for the day the wheel is chosen. */
export const WHEEL_DEFAULT = Object.freeze({ on: false, clicks: true })

/** The setting out of whatever is on disk: anything unreadable is the default, and each half is true or false and nothing else. */
export function wheelSetting(storage) {
  let raw = null
  try {
    raw = JSON.parse(storage?.getItem?.(WHEEL_KEY) || 'null')
  } catch {
    raw = null
  }
  const kept = raw && typeof raw === 'object' ? raw : {}
  return {
    on: typeof kept.on === 'boolean' ? kept.on : WHEEL_DEFAULT.on,
    clicks: typeof kept.clicks === 'boolean' ? kept.clicks : WHEEL_DEFAULT.clicks
  }
}

/** One half changed and the other kept. Answers what is now kept. */
export function saveWheel(patch, storage) {
  const next = { ...wheelSetting(storage) }
  if (typeof patch?.on === 'boolean') next.on = patch.on
  if (typeof patch?.clicks === 'boolean') next.clicks = patch.clicks
  try {
    storage?.setItem?.(WHEEL_KEY, JSON.stringify(next))
  } catch {
    /* Costs the next launch, not this press. */
  }
  return next
}

/** The words Settings shows. */
export const WHEEL_WORDS = Object.freeze({
  section: 'Preset list',
  list: 'List',
  listSub: 'Every preset the same size, as it has always been.',
  wheel: 'Wheel',
  wheelSub: 'Run your thumb round the wheel to move through your presets a click at a time, then press Load. Nothing loads until you do.',
  clicks: 'Click and tap as the wheel turns',
  clicksSub: 'A click you hear and a small tap you feel for each notch of the wheel. No sound in silent mode.'
})

/* -------------------------------------------------------------- the wheel */

/*
 * A REAL CLICK WHEEL. Two tries at a scrolling list that clicked both felt
 * wrong on his phone, the second after its rows were made to follow the
 * thumb: "I just tried the scroll wheel and it still needs. Research how
 * the iPod touch used to scroll through the songs, but I wanna make it like
 * a wheel right now it doesn't feel like a touch wheel.. and the haptics and
 * the sound still are not matching up properly so when you scroll fast, it
 * doesn't click at the right time when it slows down or at all sometimes"
 * (Justin, 11 November 2026). Shown a ring to spin and a drum to drag, he
 * took the ring: "let's do number A".
 *
 * WHY THE LIST COULD NEVER CLICK ON TIME. A flicked list coasts on its own,
 * and the app can only watch it go by and click after the fact: late when
 * it is busy drawing rows, and not at all past the fastest it may click.
 * The music player this is named for did not work that way. Its wheel was a
 * ring the thumb ran round; the list moved only while the thumb did, one
 * notch at a time, each notch a click; the same turn moved the same amount
 * wherever on the ring it started; and a long fast spin geared up, which is
 * how thousands of songs were in reach. Nothing coasted.
 *
 * So here: the thumb's turn is read by the app itself (`wheelSpin`), a
 * notch is worked out there, and the bar moving, the click and the tap are
 * one step of the same code. There is no flick and nothing to fall behind.
 *
 *   - `WHEEL_NOTCH_DEG` of turn is one notch: clockwise goes down the list.
 *   - A notch moves one preset, until the spin has been fast for a while
 *     (`wheelGear`): then two, five and ten, so five hundred presets are a
 *     few turns. Slowing down, stopping, turning back or lifting the thumb
 *     puts it back to one.
 *   - The middle button loads the preset under the bar. NOTHING LOADS
 *     UNTIL IT, OR A ROW, IS PRESSED.
 *   - The rows can be dragged too, a row of the list for a row of thumb,
 *     with the same click and no coasting (`wheelDrag`).
 */

/** How tall one row of the wheel's list is. */
export const WHEEL_ROW = 44
/** How big the name under the bar is, and the names round it (the list's is 15). */
export const WHEEL_NAME = 19
export const WHEEL_NAME_ROUND = 17

/** How much turn is one notch: twenty-four to a turn. */
export const WHEEL_NOTCH_DEG = 15

/** Where a touch is round the middle of the ring, in degrees: 0 at three o'clock, rising clockwise on a screen (y grows downward). */
export const wheelAngle = (dx, dy) => (Math.atan2(Number(dy) || 0, Number(dx) || 0) * 180) / Math.PI

/** The turn from one angle to the next, the short way round: positive is clockwise. Never more than half a turn, so crossing nine o'clock is not a spin backward. */
export function wheelTurn(from, to) {
  let d = ((Number(to) || 0) - (Number(from) || 0)) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

/** Whether a touch this far from the middle is on the ring: outside the middle button, and not past the rim. */
export const onWheelRing = (dx, dy, outer, inner) => {
  const r = Math.hypot(Number(dx) || 0, Number(dy) || 0)
  return r >= inner && r <= outer
}

/*
 * THE GEARS. A notch that comes within WHEEL_FAST_MS of the one before, in
 * the same direction, adds to the run; one slower than WHEEL_SLOW_MS, or
 * the other way, ends it. What a notch is worth by how long the run is:
 */
export const WHEEL_FAST_MS = 70
export const WHEEL_SLOW_MS = 160
export const WHEEL_GEARS = Object.freeze([
  Object.freeze({ from: 0, worth: 1 }),
  Object.freeze({ from: 20, worth: 2 }),
  Object.freeze({ from: 40, worth: 5 }),
  Object.freeze({ from: 64, worth: 10 })
])
export const wheelGear = (run) => WHEEL_GEARS.reduce((worth, g) => ((Number(run) || 0) >= g.from ? g.worth : worth), 1)

/** A thumb has landed on the ring at `angle`. */
export const wheelSpinStart = (angle, now = 0) => ({ angle: Number(angle) || 0, carry: 0, run: 0, dir: 0, at: Number(now) || 0 })

/**
 * The thumb has moved to `angle`. Answers the spin as it now stands, how
 * many notches that was (signed: clockwise is down the list) and how many
 * presets they are worth. Turn short of a notch is carried to the next
 * move, so slow turning adds up and nothing is lost.
 */
export function wheelSpin(state, angle, now = 0) {
  const was = state || wheelSpinStart(angle, now)
  const turned = wheelTurn(was.angle, angle)
  let carry = was.carry + turned
  const notches = Math.trunc(carry / WHEEL_NOTCH_DEG)
  carry -= notches * WHEEL_NOTCH_DEG
  if (!notches) return { state: { ...was, angle: Number(angle) || 0, carry }, notches: 0, moves: 0 }
  const dir = Math.sign(notches)
  const gap = (Number(now) || 0) - was.at
  /* The run carries on only the same way round and quickly; a notch in between the two speeds neither adds to it nor ends it. */
  let run = was.run
  if (dir !== was.dir || gap > WHEEL_SLOW_MS) run = 0
  else if (gap <= WHEEL_FAST_MS * Math.abs(notches)) run += Math.abs(notches)
  const moves = notches * wheelGear(run)
  return { state: { angle: Number(angle) || 0, carry, run, dir, at: Number(now) || 0 }, notches, moves }
}

/** The bar after `moves` presets, never past either end of a list of `count`. -1 with no presets. */
export function wheelMove(at, moves, count) {
  const rows = Math.max(0, Math.floor(Number(count)) || 0)
  if (!rows) return -1
  const next = (Math.floor(Number(at)) || 0) + (Math.trunc(Number(moves)) || 0)
  return Math.min(rows - 1, Math.max(0, next))
}

/**
 * The rows dragged instead: `dy` is how far the thumb has moved since the
 * last time, and a whole row of thumb is a row of list (down the screen is
 * back up the list, as a list is). What is short of a row is carried.
 */
export function wheelDrag(carry, dy, row = WHEEL_ROW) {
  const total = (Number(carry) || 0) + (Number(dy) || 0)
  const rows = Math.trunc(total / row)
  return { carry: total - rows * row, moves: rows ? -rows : 0 }
}

/*
 * HOW THE ROOM IS SHARED: the ring under, the list over. The ring is as big
 * as a thumb can run round comfortably and the room allows; the list is a
 * whole odd number of rows, so one of them is the middle and the bar is on
 * it.
 */
export const WHEEL_RING_MOST = 260
export const WHEEL_RING_LEAST = 150
export const WHEEL_GAP = 12

export function wheelLayout(width, height) {
  const w = Math.max(0, Number(width) || 0)
  const h = Math.max(0, Number(height) || 0)
  const ring = Math.round(Math.max(WHEEL_RING_LEAST, Math.min(WHEEL_RING_MOST, w - 96, h * 0.4)))
  const forList = h - ring - WHEEL_GAP * 2
  let rows = Math.floor(forList / WHEEL_ROW)
  if (rows % 2 === 0) rows -= 1
  rows = Math.max(3, Math.min(11, rows))
  return { ring, rows, middle: (rows - 1) / 2, inner: Math.round(ring * 0.19) }
}

/** Which presets the rows show with the bar on `at`: null for a row past either end. */
export function wheelWindow(at, rows, count) {
  const half = (rows - 1) / 2
  return Array.from({ length: rows }, (_, k) => {
    const i = at - half + k
    return i >= 0 && i < count ? i : null
  })
}

/** The presets drawn around the bar, whose names are worth asking the unit for: `reach` either side. */
export function wheelAround(at, count, reach = WHEEL_REACH) {
  const rows = Math.max(0, Math.floor(Number(count)) || 0)
  if (!rows || !(at >= 0)) return []
  const from = Math.max(0, at - reach)
  const to = Math.min(rows - 1, at + reach)
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}
/** Rows either side of the bar that a screen shows, with a few to spare. */
export const WHEEL_REACH = 8

/* -------------------------------------------------------------- the click */

/** The least time between two clicks: two notches worked out in the same instant are one click, and nothing a thumb can do is faster than this. */
export const WHEEL_CLICK_GAP_MS = 12

/** Whether a click is due: the middle row changed, and the last click was long enough ago. */
export const clickDue = (now, last, gap = WHEEL_CLICK_GAP_MS) => !(last > 0) || now - last >= gap

/** How long after the last notch the wheel counts as at rest: the names around the bar are asked for then, never during a spin. */
export const WHEEL_REST_MS = 140
