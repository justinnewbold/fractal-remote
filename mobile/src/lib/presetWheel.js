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
 * setting (Settings → Play screen → Tiles & scenes → Preset list): the
 * preset in the middle is drawn big and bright, the ones above and below
 * shrink and fade the further away they are, and each preset that crosses
 * the middle gives a click and a small tap you can feel. NOTHING LOADS UNTIL
 * A ROW IS TAPPED, exactly as in the list: the middle is where the eye is,
 * not what the unit is playing.
 *
 * WHO SEES THE SETTING is his account until features
 * PRESET_WHEEL_FOR_EVERYONE (`presetWheelOn`), as every new thing is.
 *
 * What follows is the arithmetic, kept apart so it can be tested: how big a
 * row is at each step from the middle, which row is in the middle for a
 * place in the scroll, and when a click is due. Nothing here imports
 * anything.
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
  wheelSub: 'The preset in the middle is big and bright, and the ones above and below shrink and fade. Nothing loads until you tap one.',
  clicks: 'Click and tap as presets pass',
  clicksSub: 'A click you hear and a small tap you feel for each preset that crosses the middle. No sound in silent mode.'
})

/* ----------------------------------------------------------- the geometry */

/*
 * EVERY ROW MOVES EXACTLY AS FAR AS THE THUMB DOES. The first wheel drew its
 * rows closer together the further they were from the middle, by moving
 * them, so a preset under a thumb slid at half the thumb's speed, in tall
 * boxes that took most of a thumb's travel each. Justin, on his own phone
 * (11 November 2026): "It's very clunky doesn't match up with the clicks
 * properly. I think on that we probably want to remove the boxes around the
 * outside edge of the presets as well and make the size of the preset names
 * a little smaller."
 *
 * So a row is never moved: it is only drawn smaller and fainter the further
 * it is from the middle, in the place the scroll puts it. The rows are names
 * with no box round them, a short slot each, and two faint lines mark the
 * middle slot: a name crossing a line is the click.
 */

/** How tall a row is drawn in the middle. Every row is laid out this tall and drawn smaller, never larger: type scaled down stays sharp. */
export const WHEEL_ROW = 50
/** How much of the scroll one preset takes: the row and the space under it. */
export const WHEEL_SLOT = 54
/** How big a preset's name is in the middle (the list's is 15). */
export const WHEEL_NAME = 19

/*
 * A ROW AT EACH STEP FROM THE MIDDLE: how big it is drawn (a share of its
 * size in the middle) and how bright. Step 0 is the middle. Past the last
 * step a row keeps the last step's size and brightness, so a tall tablet
 * has small faint names to its edges rather than nothing.
 */
export const WHEEL_STEPS = Object.freeze([
  Object.freeze({ scale: 1, opacity: 1 }),
  Object.freeze({ scale: 0.86, opacity: 0.8 }),
  Object.freeze({ scale: 0.76, opacity: 0.6 }),
  Object.freeze({ scale: 0.69, opacity: 0.44 }),
  Object.freeze({ scale: 0.64, opacity: 0.32 }),
  Object.freeze({ scale: 0.6, opacity: 0.24 }),
  Object.freeze({ scale: 0.58, opacity: 0.2 })
])

/**
 * WHAT A ROW IS TOLD, as two curves over the scroll's place: its size and
 * its brightness, given at each whole step either side of the place where it
 * is in the middle (index × WHEEL_SLOT, wheelOffset). Nothing here moves a
 * row: where it is, is the scroll's to say, and only the scroll's.
 *
 * `input` always rises, which is what the animation asks of it, and both
 * curves stop at the last step.
 */
export function wheelCurve(index, slot = WHEEL_SLOT) {
  const last = WHEEL_STEPS.length - 1
  const input = []
  const scale = []
  const opacity = []
  for (let k = -last; k <= last; k += 1) {
    const step = WHEEL_STEPS[Math.abs(k)]
    input.push((index + k) * slot)
    scale.push(step.scale)
    opacity.push(step.opacity)
  }
  return { input, scale, opacity }
}

/** Where the list is scrolled to with row `index` in the middle. */
export const wheelOffset = (index, slot = WHEEL_SLOT) => Math.max(0, Math.floor(Number(index)) || 0) * slot

/** The space over the first row and under the last, so each can reach the middle of a list `room` points tall. */
export const wheelPad = (room, slot = WHEEL_SLOT) => Math.max(0, ((Number(room) || 0) - slot) / 2)

/** Which row is in the middle for a place in the scroll: the nearest, and never past either end. -1 with no rows. */
export function wheelCentre(y, count, slot = WHEEL_SLOT) {
  const rows = Math.max(0, Math.floor(Number(count)) || 0)
  if (!rows) return -1
  const at = Math.round((Number(y) || 0) / slot)
  return Math.min(rows - 1, Math.max(0, at))
}

/** The rows drawn around the middle one, whose names are worth asking the unit for: `reach` either side. */
export function wheelAround(centre, count, reach = WHEEL_REACH) {
  const rows = Math.max(0, Math.floor(Number(count)) || 0)
  if (!rows || !(centre >= 0)) return []
  const from = Math.max(0, centre - reach)
  const to = Math.min(rows - 1, centre + reach)
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}
/** Rows either side of the middle that a phone's screen shows, with a few to spare. */
export const WHEEL_REACH = 10

/* -------------------------------------------------------------- the click */

/** The least time between two clicks. A flick through a hundred presets is a purr, not a hundred clicks. */
export const WHEEL_CLICK_GAP_MS = 32

/** Whether a click is due: the middle row changed, and the last click was long enough ago. */
export const clickDue = (now, last, gap = WHEEL_CLICK_GAP_MS) => !(last > 0) || now - last >= gap

/** How long after the last movement the wheel counts as at rest: the names around the middle are asked for then, never during a flick. */
export const WHEEL_REST_MS = 140
