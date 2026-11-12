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
 * is has been made four times, each on his phone's word: a ring the thumb
 * runs round, a list that glides under a bar as it turns, faster the faster
 * the thumb goes and coasting on after a flick, a click and a tap for each
 * preset that passes the bar, and a button in the middle that loads the
 * preset under the bar ("the wheel", below, has the why).
 * NOTHING LOADS UNTIL THAT BUTTON OR A ROW IS PRESSED, exactly as in the
 * list: the bar is where the eye is, not what the unit is playing.
 *
 * WHO SEES THE SETTING is his account until features
 * PRESET_WHEEL_FOR_EVERYONE (`presetWheelOn`), as every new thing is.
 *
 * What follows is the arithmetic, kept apart so it can be tested: what a
 * turn of the ring is worth at the speed it is turned, how a flick coasts
 * and where it lands, how the room is shared, and when a click is due.
 * Nothing here imports anything.
 */

/** Whether an account is offered the wheel at all: his, or everyone once the switch is on. */
export const presetWheelOn = ({ admin = false, everyone = false } = {}) => admin === true || everyone === true

/* ------------------------------------------------------------ the setting */

/** Where the choice is kept, on the device (lib/store carries keys that start `fractal.`). */
export const WHEEL_KEY = 'fractal.presetWheel'

/** What a device has until somebody chooses: the list, and clicks for the day the wheel is chosen, heard and felt. */
export const WHEEL_DEFAULT = Object.freeze({ on: false, clicks: true, feel: 'both' })

/*
 * WHAT A CLICK IS MADE OF. "On the clicker, it's mostly the sound not
 * matching ... maybe there's an option we can add also that we're just the
 * sound. Is there instead of the haptic feedback or vice versa?" (Justin,
 * 12 November 2026.) The sound and the tap are asked of the device by two
 * different roads, and the sound's is the slower, so a player can have
 * both, the sound alone, or the tap alone. (`clicks`, the tick box over
 * these, is still what turns all of it off.)
 */
export const WHEEL_FEELS = Object.freeze(['both', 'sound', 'tap'])

/** What a setting asks for on each preset that passes: `{ sound, tap }`. Nothing with the clicks off. */
export function wheelFeel(setting) {
  if (setting?.clicks !== true) return { sound: false, tap: false }
  const feel = WHEEL_FEELS.includes(setting?.feel) ? setting.feel : WHEEL_DEFAULT.feel
  return { sound: feel !== 'tap', tap: feel !== 'sound' }
}

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
    clicks: typeof kept.clicks === 'boolean' ? kept.clicks : WHEEL_DEFAULT.clicks,
    feel: WHEEL_FEELS.includes(kept.feel) ? kept.feel : WHEEL_DEFAULT.feel
  }
}

/** One half changed and the other kept. Answers what is now kept. */
export function saveWheel(patch, storage) {
  const next = { ...wheelSetting(storage) }
  if (typeof patch?.on === 'boolean') next.on = patch.on
  if (typeof patch?.clicks === 'boolean') next.clicks = patch.clicks
  if (WHEEL_FEELS.includes(patch?.feel)) next.feel = patch.feel
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
  wheelSub: 'Run your thumb round the wheel to move through your presets, slowly for one at a time or with a flick to fly through them, then press Load. Nothing loads until you do.',
  clicks: 'Click and tap as the wheel turns',
  clicksSub: 'A click you hear and a small tap you feel for each preset that passes. No sound in silent mode.',
  feels: Object.freeze({ both: 'Sound and tap', sound: 'Sound only', tap: 'Tap only' }),
  feelSub: 'The tap usually lands closer to the preset than the sound does.'
})

/* -------------------------------------------------------------- the wheel */

/*
 * A CLICK WHEEL THAT GLIDES. Two tries at a scrolling list that clicked
 * felt wrong on his phone, and he took a ring to spin over a drum to drag
 * ("let's do number A", 11 November 2026). The third was that ring, moving
 * a bar one whole row a notch: on time, but stiff. "It just still needs a
 * lot of work do some more research. Let's figure out how to get it
 * smoother and maybe like momentum where if I flicked it, it would go fast
 * if I went slow, it go slow, kinda like that kind of like an original
 * iPod would." (Justin, 12 November 2026.)
 *
 * WHAT THE MUSIC PLAYER DID, from its maker's patents on accelerated
 * scrolling and from the open firmware written for it: the ring reports
 * how far the thumb has turned; a slow turn is one item a notch; past a
 * turning speed the same turn is worth more, the faster the more, up to a
 * most; and a pause puts it back to one.
 *
 * WHY THE FIRST TWO COULD NEVER CLICK ON TIME: a flicked list coasted on
 * the system's own, and the app could only watch it go by and click after
 * the fact. So the rule that the third try found is kept: THE APP MOVES
 * THE LIST ITSELF. Where the list is (`place`, in rows, and not only whole
 * ones) is a number this code owns; the thumb's turn adds to it
 * (`wheelFlow`), a flick carries on from the thumb's own speed and slows
 * to rest on a row (`wheelCoast`), and every time a new preset comes under
 * the bar the click and the tap are fired by the same line that moved it.
 * There is still no scrolling list here, and nothing to fall behind.
 *
 *   - `WHEEL_NOTCH_DEG` of turn is one preset, turned slowly: clockwise
 *     goes down the list.
 *   - Turned faster than `WHEEL_EASY_DEG_S`, the same turn is worth more,
 *     rising smoothly with the speed (`wheelGain`), never more than the
 *     list is long enough to want, and never a blur past reading
 *     (`WHEEL_ROWS_MOST` a second).
 *   - Lifting the thumb while it is still turning lets the list coast: it
 *     starts at the speed it had, slows like a wheel with a little
 *     friction, and comes to rest exactly on a row. Lifting a thumb that
 *     had stopped settles on the nearest row. While the thumb is down the
 *     list stays wherever the thumb has it, so a slow thumb loses nothing.
 *   - The rows can be dragged and flicked too, a row of thumb for a row of
 *     list, and coast the same way.
 *   - The middle button loads the preset under the bar. NOTHING LOADS
 *     UNTIL IT, OR A ROW, IS PRESSED.
 */

/** How tall one row of the wheel's list is. */
export const WHEEL_ROW = 44
/** How big a name is on the wheel (the list's is 15). One size under the bar and round it, so a name gliding into the bar does not change shape half-way. */
export const WHEEL_NAME = 18
export const WHEEL_NAME_ROUND = 18

/** How much turn is one preset, turned slowly: twenty-four to a turn. */
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

const rowsOf = (count) => Math.max(0, Math.floor(Number(count)) || 0)

/** Where the list is, held inside a list of `count`: any place from its first row to its last, whole or between two. -1 with no presets. */
export function wheelPlace(place, count) {
  const rows = rowsOf(count)
  if (!rows) return -1
  return Math.min(rows - 1, Math.max(0, Number(place) || 0))
}

/** The preset under the bar with the list at `place`: the nearest row. -1 with no presets. */
export const wheelRow = (place, count) => (rowsOf(count) ? Math.round(wheelPlace(place, count)) : -1)

/**
 * WHICH PRESET IS UNDER THE BAR as the list moves: the nearest row, but a
 * preset that is under it stays under it until the list is WHEEL_STICK of a
 * row past half-way to the next. Without that, a thumb resting on the line
 * between two would click back and forth with every tremble.
 */
export const WHEEL_STICK = 0.1
export function wheelUnder(place, was, count) {
  const rows = rowsOf(count)
  if (!rows) return -1
  const at = wheelPlace(place, rows)
  if (was >= 0 && was < rows && Math.abs(at - was) < 0.5 + WHEEL_STICK) return was
  return Math.round(at)
}

/** The bar after `moves` presets, never past either end of a list of `count`. -1 with no presets. */
export function wheelMove(at, moves, count) {
  const rows = rowsOf(count)
  if (!rows) return -1
  const next = (Math.floor(Number(at)) || 0) + (Math.trunc(Number(moves)) || 0)
  return Math.min(rows - 1, Math.max(0, next))
}

/*
 * HOW FAST IS WORTH HOW MUCH. Under WHEEL_EASY_DEG_S (two thirds of a turn
 * a second) a notch is a preset, however long the thumb keeps going: that
 * is the speed of looking for one. Over it the worth rises with the square
 * of how far over, so a little quicker is a little more and a real spin
 * flies. It is held to what the list is long enough to want (a full turn
 * at the most is never more than half the list) and to WHEEL_ROWS_MOST
 * presets a second, past which nothing can be read anyway.
 */
export const WHEEL_EASY_DEG_S = 240
export const WHEEL_GAIN_MOST = 12
export const WHEEL_ROWS_MOST = 240

/** The most a notch is ever worth in a list of `count`. */
export const wheelGainMost = (count = Infinity) => Math.max(1, Math.min(WHEEL_GAIN_MOST, (Number(count) || 0) / ((2 * 360) / WHEEL_NOTCH_DEG)))

/** What a notch is worth with the thumb turning at `speed` degrees a second. */
export function wheelGain(speed, count = Infinity) {
  const fast = Math.abs(Number(speed) || 0)
  const over = (fast - WHEEL_EASY_DEG_S) / WHEEL_EASY_DEG_S
  if (!(over > 0)) return 1
  const most = Math.max(1, Math.min(wheelGainMost(count), (WHEEL_ROWS_MOST * WHEEL_NOTCH_DEG) / fast))
  return Math.min(most, 1 + over * over)
}

/** How long the thumb's speed is averaged over: long enough that one late touch does not kick the list, short enough to follow a thumb that slows. */
export const WHEEL_SPEED_MS = 60
/** A thumb that has not moved for this long has stopped: lifting it then is not a flick, and the list settles on the nearest row. */
export const WHEEL_STILL_MS = 110

/** A thumb has landed on the ring at `angle`. */
export const wheelFlowStart = (angle, now = 0) => ({ angle: Number(angle) || 0, at: Number(now) || 0, speed: 0 })

/**
 * The thumb has moved to `angle`. Answers the turn as it now stands (with
 * the thumb's speed, in degrees a second, signed), how far it turned, and
 * how many rows of list that is worth, signed and not only whole ones:
 * clockwise is down the list.
 */
export function wheelFlow(state, angle, now = 0, count = Infinity) {
  const was = state || wheelFlowStart(angle, now)
  const to = Number(angle) || 0
  const at = Number(now) || 0
  const turned = wheelTurn(was.angle, to)
  const gap = Math.max(1, at - was.at)
  const just = (turned / gap) * 1000
  let speed
  const weight = 1 - Math.exp(-gap / WHEEL_SPEED_MS)
  /* After a pause, or turning back, the speed starts again from nothing: none of the last spin is carried into this one, and one sudden move is not a spin. */
  if (gap > WHEEL_STILL_MS || (just && was.speed && Math.sign(just) !== Math.sign(was.speed))) speed = just * weight
  else speed = was.speed + (just - was.speed) * weight
  /* What this move is worth: by the thumb's averaged speed, and never so much that this one move, at the speed it was itself made, outruns the most the list may go. */
  const worth = Math.min(wheelGain(speed, count), Math.max(1, (WHEEL_ROWS_MOST * WHEEL_NOTCH_DEG) / Math.max(1, Math.abs(just))))
  const rows = (turned / WHEEL_NOTCH_DEG) * worth
  return { state: { angle: to, at, speed }, turned, rows }
}

/** The thumb has lifted. How fast the list was going, in rows a second (signed): nothing if the thumb had stopped first. */
export function wheelLetGo(state, now = 0, count = Infinity) {
  if (!state || (Number(now) || 0) - state.at > WHEEL_STILL_MS) return 0
  return (state.speed / WHEEL_NOTCH_DEG) * wheelGain(state.speed, count)
}

/*
 * THE COAST. A list let go at `speed` rows a second slows as a wheel with
 * a little friction does: mostly in proportion to its speed (WHEEL_DRAG a
 * second, about what the system's own lists use), and by a small steady
 * amount on top (WHEEL_GRIP rows a second, every second), which is what
 * brings it to a stop in a moment instead of creeping for seconds. How far
 * that takes it is known at once, so the stop is moved to the nearest row
 * and the whole coast scaled to end there: it never stops between two and
 * shuffles. A list that would run off its end stops at the end.
 */
export const WHEEL_DRAG = 2.2
export const WHEEL_GRIP = 14
/** Slower than this when let go is not a flick: the list settles on the nearest row. */
export const WHEEL_COAST_LEAST = 7
/** How long settling on the nearest row takes. */
export const WHEEL_SETTLE_MS = 130

const HOLD = WHEEL_GRIP / WHEEL_DRAG
/* How far a coast that began at `v` rows a second has gone after `t` seconds, before it stops. */
const coasted = (v, t) => ((v + HOLD) * (1 - Math.exp(-WHEEL_DRAG * t))) / WHEEL_DRAG - HOLD * t

/** The list easing from `from` onto the nearest row. */
export function wheelSettle(from, count) {
  if (!rowsOf(count)) return null
  const at = wheelPlace(from, count)
  const to = Math.round(at)
  return { kind: 'settle', from: at, to, ms: at === to ? 0 : WHEEL_SETTLE_MS }
}

/** The list let go at `from`, going `speed` rows a second (signed). Answers the plan of what it does next: a coast, or a settle if that was no flick. Null with no presets. */
export function wheelCoast(from, speed, count) {
  const rows = rowsOf(count)
  if (!rows) return null
  const at = wheelPlace(from, rows)
  const v = Math.min(WHEEL_ROWS_MOST, Math.abs(Number(speed) || 0))
  const dir = Math.sign(Number(speed) || 0)
  if (!dir || v < WHEEL_COAST_LEAST) return wheelSettle(at, rows)
  const time = Math.log(1 + v / HOLD) / WHEEL_DRAG
  const far = coasted(v, time)
  const end = dir > 0 ? rows - 1 : 0
  const room = Math.abs(end - at)
  if (far >= room) {
    /* It reaches the end of the list still moving, and stops there: when, by halving. */
    let lo = 0
    let hi = time
    for (let i = 0; i < 30; i += 1) {
      const mid = (lo + hi) / 2
      if (coasted(v, mid) < room) lo = mid
      else hi = mid
    }
    return { kind: 'coast', from: at, to: end, dir, speed: v, scale: 1, ms: Math.round(hi * 1000) }
  }
  const to = Math.round(at + dir * far)
  const reach = Math.abs(to - at)
  if (!reach) return wheelSettle(at, rows)
  return { kind: 'coast', from: at, to, dir, speed: v, scale: reach / far, ms: Math.round(time * 1000) }
}

/** Where a plan has the list `ms` after it began: at its end, and still, from the plan's own time on. */
export function wheelGlideAt(plan, ms) {
  if (!plan) return 0
  const t = Number(ms) || 0
  if (!(plan.ms > 0) || t >= plan.ms) return plan.to
  if (t <= 0) return plan.from
  if (plan.kind === 'settle') {
    const left = 1 - t / plan.ms
    return plan.to - (plan.to - plan.from) * left * left * left
  }
  const gone = plan.from + plan.dir * coasted(plan.speed, t / 1000) * plan.scale
  return plan.dir > 0 ? Math.min(plan.to, gone) : Math.max(plan.to, gone)
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

/*
 * WHICH ROWS ARE DRAWN. The list is one strip that slides under the bar,
 * and only the rows near the bar are on it: `reach` either side of the row
 * they were last drawn round. They are drawn again once the bar has moved
 * WHEEL_REDRAW rows from there, never for every row that passes, which is
 * what lets the strip slide without waiting for the drawing.
 */
export const WHEEL_SPARE = 8
export const WHEEL_REDRAW = 3

/** The presets drawn with the rows last centred on `centre`: `reach` either side, inside the list. */
export function wheelDrawn(centre, reach, count) {
  const rows = rowsOf(count)
  if (!rows || !(centre >= 0)) return []
  const from = Math.max(0, centre - reach)
  const to = Math.min(rows - 1, centre + reach)
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
}

/** The presets drawn around the bar, whose names are worth asking the unit for: `reach` either side. */
export const wheelAround = (at, count, reach = WHEEL_REACH) => wheelDrawn(at, reach, count)
/** Rows either side of the bar that a screen shows, with a few to spare. */
export const WHEEL_REACH = 8

/*
 * FLYING. "It also lags quite a bit too if you scroll really fast, it
 * doesn't keep up" (Justin, 12 November 2026). Drawing the rows again is
 * the slowest thing the wheel does, and at speed it was doing it every
 * frame for names nobody can read as they pass. So past WHEEL_FLY_FROM
 * presets a second the rows are put away and ONE line says where the list
 * is: the slot it is passing, big, with its name under it, as the music
 * player showed a letter over a list that was flying. Nothing is drawn
 * again until the list slows under WHEEL_FLY_UNTIL, or stops, and then
 * the rows come back once, round where it is. The gap between the two
 * numbers is so it does not flick in and out at one speed.
 */
export const WHEEL_FLY_FROM = 40
export const WHEEL_FLY_UNTIL = 18
/** The least time between two changes of the flying line: a number that changes faster than this cannot be read either. */
export const WHEEL_FLY_SAY_MS = 50

/** How fast the list is moving, in rows a second, kept from one move to the next: `{ at, rate }`. A move after a rest starts from nothing. */
export function wheelPace(was, moved, now = 0) {
  const at = Number(now) || 0
  const gap = at - (was?.at || 0)
  if (!was || gap > WHEEL_STILL_MS) return { at, rate: 0 }
  /* Two moves in the same instant are one: the next one counts them both. */
  if (!(gap > 0)) return was
  const just = (Math.abs(Number(moved) || 0) / gap) * 1000
  return { at, rate: was.rate + (just - was.rate) * (1 - Math.exp(-gap / WHEEL_SPEED_MS)) }
}

/** Whether the list is flying, from whether it was and how fast it is going now. */
export const wheelFlying = (was, rate) => (was === true ? rate > WHEEL_FLY_UNTIL : rate >= WHEEL_FLY_FROM)

/* -------------------------------------------------------------- the click */

/**
 * The least time between two clicks. A thumb looking for a preset passes
 * far fewer than this allows, so every one of those clicks; a spin or a
 * coast that passes more is a purr at this rate, which thins back into
 * single clicks as it slows.
 */
export const WHEEL_CLICK_GAP_MS = 32

/** Whether a click is due: a new preset is under the bar, and the last click was long enough ago. */
export const clickDue = (now, last, gap = WHEEL_CLICK_GAP_MS) => !(last > 0) || now - last >= gap

/** How long after the list comes to rest the names around the bar are asked for: never during a spin or a coast. */
export const WHEEL_REST_MS = 140
