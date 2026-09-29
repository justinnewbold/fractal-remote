/**
 * How much of the stage screen one button gets.
 *
 * The Play screen has always been one size, chosen once, for a phone held at
 * arm's length in the dark. That is the right default and the wrong rule: a
 * preset with eight scenes and nine blocks does not fit at that size, and a
 * preset with two scenes wastes most of the screen at it. Which of those you
 * have is not something the app can know, and it changes with the preset.
 *
 * So it is a setting, and the setting is two buttons. Bigger trades how much
 * you can see for how easily you can hit it; smaller trades back. Nobody has
 * to be told which they want — they press one and look.
 *
 * The steps are concrete pixel pairs rather than a multiplier on a base,
 * because the two numbers do not scale together: the column floor decides how
 * many fit across a row, and it has to clear a scene NAME at the size the tile
 * is drawn, not a proportion of it.
 */

/**
 * `tile` is the button's min-height; `col` the grid's column floor, which is
 * what actually decides how many land on a row.
 *
 * STEP 1 IS THE DEFAULT, and it is now the layout he chose from a screenshot:
 * scenes two across in colour, effects four across in three letters. It was
 * "today's screen, exactly" before that, which is the right instinct for a
 * control that changes what you reach for mid-song — but the whole point of
 * this change is that the default look moved.
 *
 * `scenes` and `fx` are how many land on a ROW ON A PHONE, which is the thing
 * the layout he asked for is actually about: scenes two across in colour, the
 * effects four across underneath in three letters. A pixel floor could not say
 * that — it says "at least this wide" and lets the viewport decide the rest,
 * which is why the default came out three across and never two.
 *
 * Phone only. On a desktop the grids stay on the pixel floors and auto-fit,
 * because two scene buttons across 1200px is not a design, it is a mistake.
 *
 * A scene is WIDER than an effect at every step, including the smallest — "try
 * making them wider". Two grids of identical tiles read as one grid however
 * they are coloured, and size is the difference you notice before you have
 * looked at anything.
 */
export const SIZES = [
  { name: 'Smallest', tile: 48, col: 88, scenes: 2, fx: 4 },
  { name: 'Small', tile: 62, col: 110, scenes: 2, fx: 4 },
  { name: 'Medium', tile: 78, col: 132, scenes: 2, fx: 3 },
  { name: 'Large', tile: 96, col: 158, scenes: 2, fx: 2 },
  { name: 'Largest', tile: 120, col: 190, scenes: 1, fx: 1 }
]

/*
 * Smallest, so the whole rig is on the screen the first time it is seen.
 *
 * "Make the default play screen button sizes (smallest) so that everything
 * fits on the screen. Currently, it's set to small, as the default. You have
 * to scroll up and down a little to see everything."
 *
 * One step up put the scenes and the effects over the bottom of a phone, so
 * the first impression of the stage screen was one you had to scroll — and a
 * stage screen you scroll is one you cannot use with a guitar on. Anybody who
 * wants bigger targets can still have them, and that choice is remembered;
 * the DEFAULT is the one that fits.
 */
export const DEFAULT_SIZE = 0

const KEY = 'fractal.gigSize'

/** Clamp to a real step. Anything unreadable is the default, never a crash. */
export const clampSize = (n) => {
  // Number(null) is 0, which is a real step — so an absent value would read as
  // the smallest size rather than as no choice at all.
  if (n === null || n === undefined || n === '') return DEFAULT_SIZE
  const i = Math.round(Number(n))
  if (!Number.isFinite(i)) return DEFAULT_SIZE
  return Math.min(SIZES.length - 1, Math.max(0, i))
}

/**
 * The CSS the Play screen is drawn with at a given step.
 *
 * Blocks sit in wider columns than scenes at every size — a block carries a
 * name, a state and a channel where a scene carries a number and a name — so
 * the gap between them is kept rather than recomputed.
 */
export const sizeVars = (n) => {
  const i = clampSize(n)
  const s = SIZES[i]
  return {
    '--gig-tile': `${s.tile}px`,
    '--gig-col': `${s.col}px`,
    /*
     * A block column is wider than a scene column at every size but the bottom
     * one, where the extra 20px is what puts blocks three to a row instead of
     * four — and a fourteen-block preset five rows deep instead of four. The
     * name inside is clipped to one line at this size, so the width no longer
     * has to hold a whole name; it holds a state and a channel.
     */
    '--gig-col-block': `${s.col + (i === 0 ? 4 : 20)}px`,
    '--gig-scene-cols': String(s.scenes),
    '--gig-fx-cols': String(s.fx)
  }
}

/** What was chosen last time, on this device. */
export function loadSize(storage) {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    const raw = store?.getItem(KEY)
    return raw === null || raw === undefined ? DEFAULT_SIZE : clampSize(raw)
  } catch {
    // Private windows and blocked site data both throw on read. A stage screen
    // that renders at the default beats one that does not render.
    return DEFAULT_SIZE
  }
}

/** Remember it. A failure here costs the next reload, not this press. */
export function saveSize(n, storage) {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    store?.setItem(KEY, String(clampSize(n)))
    return true
  } catch {
    return false
  }
}

/*
 * Fit: not a step on the ladder, a different rule.
 *
 * "It would be nice just to have everything static on the screen without
 * being able to scroll." Every step above is a fixed height, so whether a rig
 * fits depends on how many scenes and blocks the preset has — Smallest fits
 * the demo and scrolls on a fourteen-block preset. Fit turns that round: the
 * screen decides the height. The Play screen measures what is left once its
 * own chrome is on, and this shares it out among the rows of tiles.
 */
const FIT_KEY = 'fractal.gigFit'

/** The most effects a row ever holds — see the last paragraph below. */
export const FX_MAX = 4

/**
 * How tall a tile can be for every scene and every block to be on screen at
 * once, and how many blocks to a row that takes.
 *
 * `available` is the height left for the two grids together. Blocks start at
 * `fxCols` to a row and may go wider when the tile would otherwise drop under
 * the tap floor, but never past four — see FX_MAX. When no width gets the
 * tile over the floor, the floor wins: a preset that big scrolls, which is
 * what it did before.
 *
 * TWO LIMITS ON GOING WIDER, both from an FM3 on a small phone:
 *
 * "On smaller phones, it looks like the tiles are too small to see the
 * glyphs… it looks like having six across might be too many."
 *
 * Eight scenes and eight blocks went six across, and the six-across row was
 * no shorter than four across would have been: eight blocks are two rows at
 * four, five or six. So the tiles got narrower for nothing — the picture
 * landed on top of the On and the names became "C…" and "TR…". A wider row
 * is only worth taking when it saves a row, and when two widths save the
 * same, the narrower one wins.
 *
 * And a tile has to stay wide enough for what is drawn on it: the picture,
 * three letters, On/Off in one corner and the channel in the other. `width`
 * is the row it has to fit in; `minWidth` is the narrowest tile that still
 * holds all of that.
 *
 * AND NEVER MORE THAN FOUR ACROSS.
 *
 * "Make this so on the effects pedals, there's only a max of four across
 * that can go on the screen. Because it looks good on the iPhone. And looks
 * terrible on the Android phone." Side by side, the same FM3 preset: four
 * across on the iPhone, every name whole; six on the Android, every name
 * "C…", "A…", "P…". Five and six were the old answer to a long chain not
 * fitting, and they bought the rows back by making every tile unreadable. A
 * chain that does not fit at four scrolls instead.
 */
export function fitTiles({
  available,
  scenes = 0,
  blocks = 0,
  sceneCols = 2,
  fxCols = 4,
  gap = 8,
  min = 44,
  max = 96,
  width = 0,
  minWidth = 56
} = {}) {
  const room = Math.max(0, Number(available) || 0)
  const sceneRows = Math.ceil(Math.max(0, scenes) / Math.max(1, sceneCols))
  const first = Math.max(1, Math.min(FX_MAX, fxCols))
  const across = Number(width) > 0 ? Math.floor((Number(width) + gap) / (minWidth + gap)) : FX_MAX
  const last = Math.max(first, Math.min(FX_MAX, across))
  const count = Math.max(0, blocks)
  let best = null
  for (let cols = first; cols <= last; cols++) {
    const rows = sceneRows + Math.ceil(count / cols)
    if (!rows) return { tile: max, fxCols: cols }
    /* The same number of rows as a narrower grid: nothing gained, so the
       narrower one stands. */
    if (best && rows >= best.rows) continue
    const tile = Math.floor((room - gap * (rows - 1)) / rows)
    best = { rows, tile, cols }
    if (tile >= min) break
  }
  return { tile: Math.max(min, Math.min(max, best.tile)), fxCols: best.cols }
}

/**
 * Whether Play fits itself to the screen on this device.
 *
 * THREE STATES, NOT TWO, and the third is why. This stored '1' or nothing, so
 * "off" and "never chosen" were the same value — which is fine while the
 * default is off and impossible the moment it is on. The phone wants fit ON
 * out of the box:
 *
 *   "Make one that says fit on screen... so they don't have to manually push
 *   up and down for sizes and then go back to the play screen to see what it
 *   did and then go back, so that way it's just always set up, good to go.
 *   Also make this the default setting from the beginning."
 *
 * With two states, somebody turning it off would be indistinguishable from
 * somebody who had never touched it, and it would switch itself back on at
 * the next launch. So off is written down as '0' and `fallback` decides only
 * what an UNSET value means.
 *
 * The browser passes nothing and therefore keeps the default it has always
 * had. Only the phone asks for true — see mobile/src/screens/Stage.js.
 */
export function loadFit(storage, fallback = false) {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    const raw = store?.getItem(FIT_KEY)
    if (raw === '1') return true
    if (raw === '0') return false
    return fallback
  } catch {
    // Private windows and blocked site data both throw. Answer the default
    // rather than refusing to draw the screen.
    return fallback
  }
}

export function saveFit(on, storage) {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    /* Written either way, never removed: removing it would read as "never
       chosen" and hand the answer back to the default. */
    store?.setItem(FIT_KEY, on ? '1' : '0')
    return true
  } catch {
    return false
  }
}

/*
 * THE EFFECT PICTURES, ON OR OFF.
 *
 * "Is it something that could be turned on and off?" Yes: some players read
 * the letters and want nothing else on a tile. On unless somebody turns them
 * off, at both ends, kept per device like the tile size.
 */
const ICONS_KEY = 'fractal.gigIcons'

export function loadIcons(storage) {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    return store?.getItem(ICONS_KEY) !== '0'
  } catch {
    return true
  }
}

export function saveIcons(on, storage) {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    store?.setItem(ICONS_KEY, on ? '1' : '0')
    return true
  } catch {
    return false
  }
}

/*
 * WHERE THE SCENES SIT: ACROSS, DOWN, LIKE THE UNIT, OR WHEREVER YOU PUT THEM.
 *
 * "I prefer arrangement of the scenes - first row 1234, second row 5678 as it
 * is in the screen of my unit." That was a yes-or-no box, rows of four or not.
 * Then Justin: "Make an option in settings to select on the left side one,
 * two, three, four for the scenes, and on the right side five, six, seven,
 * eight, instead of them just going across like a snake. And actually, can
 * you make it so you can grab and drop the scenes wherever you want them on
 * the screen?"
 *
 * So one choice with four answers, kept per device like the tile size:
 *
 *   across — 1 2 / 3 4 / 5 6 / 7 8, the layout Justin chose and the default.
 *            On a wide browser window the grid still fills the row as before.
 *   down   — 1 2 3 4 down the left, 5 6 7 8 down the right. Two columns at
 *            every width; with an odd count the left column holds the extra.
 *   four   — 1 2 3 4 over 5 6 7 8, the unit's own screen. Four across at every
 *            width, because a row that re-flowed to fit the window would stop
 *            matching the unit.
 *   mine   — two columns, in an order the player dragged them into on the
 *            Appearance page. Arranged there and never on Play: a mis-drag in
 *            the middle of a song must not be possible.
 *
 * Whatever the layout, a tile is still its own scene. Tile "5" says 5, wears
 * scene 5's colour and selects scene 5 wherever it is drawn — only the place
 * it is drawn moves.
 */
const SCENE_LAYOUT_KEY = 'fractal.sceneLayout'
/* Where the old box kept its answer. Read, never written, so a phone that had
   rows of four turned on still has them after the box became a choice. */
const SCENE_ROWS_KEY = 'fractal.gigScenesFour'
const SCENE_ORDER_KEY = 'fractal.sceneOrder'

/** How many scenes a row holds when they are laid out like the unit. */
export const SCENES_LIKE_UNIT = 4

/** The four answers, in the order the Appearance page offers them. */
export const SCENE_LAYOUTS = [
  { id: 'across', name: 'Across', sub: '1 2 on the top row, 3 4 under them, and so on down.' },
  {
    id: 'down',
    name: 'Down, in two columns',
    sub: '1 2 3 4 down the left side and 5 6 7 8 down the right.'
  },
  {
    id: 'four',
    name: 'Rows of four, like the unit',
    sub: "1 2 3 4 on top and 5 6 7 8 underneath, the way the unit's own screen shows them."
  },
  { id: 'mine', name: 'My own order', sub: 'Two columns, in whatever order you drag them into.' }
]

const LAYOUT_IDS = SCENE_LAYOUTS.map((l) => l.id)

const storeOf = (storage) => storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)

export function loadSceneLayout(storage) {
  try {
    const store = storeOf(storage)
    const kept = store?.getItem(SCENE_LAYOUT_KEY)
    if (LAYOUT_IDS.includes(kept)) return kept
    return store?.getItem(SCENE_ROWS_KEY) === '1' ? 'four' : 'across'
  } catch {
    return 'across'
  }
}

export function saveSceneLayout(layout, storage) {
  try {
    storeOf(storage)?.setItem(SCENE_LAYOUT_KEY, LAYOUT_IDS.includes(layout) ? layout : 'across')
    return true
  } catch {
    return false
  }
}

/** Scenes to a row: four like the unit, two for down or your own order, the size step's otherwise. */
export function sceneColsFor(step, layout) {
  if (layout === 'four') return SCENES_LIKE_UNIT
  if (layout === 'down' || layout === 'mine') return 2
  return step?.scenes ?? 2
}

/*
 * YOUR OWN ORDER, MENDED TO FIT THE PRESET IN FRONT OF YOU.
 *
 * Kept as a list of scene numbers (from 0) in the order they are drawn, left
 * to right and top to bottom, two to a row. One order for every preset, which
 * means it can meet a unit or a preset with fewer scenes than it was arranged
 * for — so anything past the count is dropped and anything missing goes on the
 * end. Every scene shows exactly once, whatever was stored.
 */
export function repairSceneOrder(order, count) {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  const seen = new Set()
  const out = []
  for (const v of Array.isArray(order) ? order : []) {
    if (Number.isInteger(v) && v >= 0 && v < n && !seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  for (let i = 0; i < n; i++) if (!seen.has(i)) out.push(i)
  return out
}

/** How many tiles the Arrange grid shows: the unit's eight. */
export const ARRANGE_COUNT = 8

export function loadSceneOrder(storage) {
  try {
    const raw = storeOf(storage)?.getItem(SCENE_ORDER_KEY)
    return repairSceneOrder(raw ? JSON.parse(raw) : null, ARRANGE_COUNT)
  } catch {
    return repairSceneOrder(null, ARRANGE_COUNT)
  }
}

export function saveSceneOrder(order, storage) {
  try {
    storeOf(storage)?.setItem(SCENE_ORDER_KEY, JSON.stringify(repairSceneOrder(order, ARRANGE_COUNT)))
    return true
  } catch {
    return false
  }
}

/** The order with the scenes at two places swapped — what one drag does. */
export function swapScenes(order, a, b) {
  const out = [...order]
  if (a === b || a < 0 || b < 0 || a >= out.length || b >= out.length) return out
  const kept = out[a]
  out[a] = out[b]
  out[b] = kept
  return out
}

/*
 * The scenes in the order they are DRAWN — left to right, then down — for a
 * grid that fills rows. "Down" is the one that has to be worked out: with two
 * columns, the left column is the first half (the bigger half when the count
 * is odd), so row r holds scene r on the left and scene r + half on the right.
 */
export function sceneOrderFor(layout, count, customOrder) {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (layout === 'mine') return repairSceneOrder(customOrder, n)
  const plain = Array.from({ length: n }, (_, i) => i)
  if (layout !== 'down') return plain
  const half = Math.ceil(n / 2)
  const out = []
  for (let r = 0; r < half; r++) {
    out.push(r)
    if (r + half < n) out.push(r + half)
  }
  return out
}
