/*
 * PLAY'S VIEW: which of the presets, the scenes and the pedals Play shows.
 *
 * "I would like to make more options for people to be able to adjust their
 * views of the screens. Right now it's mostly based around scenes they
 * should be able to adjust the views of their presets as well" (Justin, 23
 * November 2026). He was shown five pictures and said "I like that", with
 * the way in "a little round icon in between the volume and the settings".
 *
 * So Play can draw PRESET TILES, one tap to load, as a scene tile is one tap:
 *
 *   rig      scenes and pedals, Play as it always was
 *   top      a block of preset tiles over the scenes and the pedals
 *   both     presets and scenes, no pedals       (a phone held upright only)
 *   presets  presets only, as big as the screen  (a phone held upright only)
 *
 * EACH WAY OF HOLDING THE DEVICE KEEPS ITS OWN (`postureOf`): a phone, or a
 * fold or Duo closed; a big screen wider than tall; a big screen taller than
 * wide. From Play's own shape (lib/playShape `wide`) and its own width and
 * height, never the kind of device.
 *
 * WHICH PRESETS (`tilesFor`): the ones around the preset the unit is on, the
 * setlist that is on, the starred ones, or the ones wearing the same colour
 * tag. Always as PAGES of `count`, so the tiles stand still while a player
 * taps within a page, and turn only when the preset moves to the next page.
 *
 * His account first (lib/features PLAY_VIEWS_FOR_EVERYONE, lib/usePlayViews).
 * This file imports nothing, so a test runs it whole.
 */
export const VIEWS = Object.freeze(['rig', 'top', 'both', 'presets'])
export const POSTURES = Object.freeze(['phone', 'wide', 'tall'])
export const SOURCES = Object.freeze(['around', 'setlist', 'starred', 'colour'])
export const COUNTS = Object.freeze([4, 8, 12, 16])

export const VIEW_WORDS = Object.freeze({ rig: 'Scenes & pedals', top: 'Presets on top', both: 'Presets & scenes', presets: 'Presets only' })
export const SOURCE_WORDS = Object.freeze({ around: 'Around this one', setlist: 'Setlist', starred: 'Starred', colour: 'By color' })
/** Beside PRESETS on Play: what the tiles are showing. */
export const SOURCE_SAID = Object.freeze({ around: 'Around this one', setlist: 'Setlist', starred: 'Starred', colour: 'Same color' })
export const VIEW_TITLE = 'View'
export const VIEW_NOTE = (device) => `Pick a picture. Play changes as you tap, and this ${device} remembers it for the way you are holding it.`
export const TILES_SHOW = 'Preset tiles show'
export const HOW_MANY = 'How many'
export const VIEW_BUTTON = 'View'
export const VIEW_HINT = 'Choose what Play shows: presets, scenes and pedals'
/** Under the choices, when the one picked has nothing to show and the tiles fall back to the presets around this one. */
export const SOURCE_EMPTY = Object.freeze({
  setlist: 'No setlist is on, so the tiles show the presets around this one.',
  starred: 'No presets are starred yet, so the tiles show the presets around this one.',
  colour: 'No presets have a color tag yet, so the tiles show the presets around this one.'
})

/** Which way the device is held, from Play's own shape and size. */
export const postureOf = ({ wide = false, across = 0, tall = 0 } = {}) => (!wide ? 'phone' : !(tall > 0) || across >= tall ? 'wide' : 'tall')

/** The views a posture is offered: every one on a phone; on a big screen Play as it was, and presets on top. */
export const viewsFor = (posture) => (posture === 'phone' ? VIEWS : Object.freeze(['rig', 'top']))

export const viewKey = (posture) => `fractal.play.view.${POSTURES.includes(posture) ? posture : 'phone'}`
export const SOURCE_KEY = 'fractal.play.presetTiles.show'
export const COUNT_KEY = 'fractal.play.presetTiles.count'

const read = (storage, key) => {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}
const write = (storage, key, value) => {
  try {
    storage?.setItem(key, String(value))
    return true
  } catch {
    return false
  }
}

/** The view kept for a posture: 'rig' until one is chosen, and for anything kept that the posture is not offered. */
export function loadView(storage, posture) {
  const kept = read(storage, viewKey(posture))
  return viewsFor(posture).includes(kept) ? kept : 'rig'
}
export const saveView = (view, posture, storage) => (viewsFor(posture).includes(view) ? write(storage, viewKey(posture), view) : false)

export function loadSource(storage) {
  const kept = read(storage, SOURCE_KEY)
  return SOURCES.includes(kept) ? kept : 'around'
}
export const saveSource = (source, storage) => (SOURCES.includes(source) ? write(storage, SOURCE_KEY, source) : false)

export function loadCount(storage) {
  const kept = Number(read(storage, COUNT_KEY))
  return COUNTS.includes(kept) ? kept : 8
}
export const saveCount = (count, storage) => (COUNTS.includes(Number(count)) ? write(storage, COUNT_KEY, Number(count)) : false)

/**
 * The view Play draws: the one kept, except where Play has no room to be
 * anything but itself (`plain` false: in a half beside a tool, on a phone
 * held on its side, with a block's knobs open in the scenes' place), where
 * the two that hide something are drawn as presets on top, and a Play too
 * short for a block of presets stays as it was.
 */
export function viewDrawn(kept, { plain = true, short = false } = {}) {
  const view = VIEWS.includes(kept) ? kept : 'rig'
  if (view === 'rig' || short) return 'rig'
  return plain ? view : 'top'
}

export const showsScenes = (view) => view !== 'presets'
export const showsPedals = (view) => view === 'rig' || view === 'top'
export const showsPresets = (view) => view !== 'rig'

/** The page of `count` that holds `current` in a list of preset numbers; the first page when it is not in it. */
export function pageOf(list, current, count) {
  const size = Math.max(1, Math.floor(count) || 1)
  const at = list.indexOf(current)
  const page = at < 0 ? 0 : Math.floor(at / size)
  return list.slice(page * size, page * size + size)
}

/**
 * The preset numbers the tiles show, and which source they came from:
 * `source` where it has any, else the presets around the one the unit is on
 * (`fell` says so). `order` is the setlist that is on (lib/setlists
 * orderFor), `starred` the starred presets, `sameColour` the presets wearing
 * the tag the current one wears (every tagged preset where it wears none).
 */
export function tilesFor({ source = 'around', count = 8, current = null, slots = 0, order = null, starred = null, sameColour = null } = {}) {
  const size = COUNTS.includes(Number(count)) ? Number(count) : 8
  const total = Math.max(0, Math.floor(slots) || 0)
  const whole = (list) => (Array.isArray(list) ? [...new Set(list.filter((n) => Number.isInteger(n) && n >= 0 && (!total || n < total)))] : [])
  const from = source === 'setlist' ? whole(order) : source === 'starred' ? whole(starred).sort((a, b) => a - b) : source === 'colour' ? whole(sameColour).sort((a, b) => a - b) : []
  if (source !== 'around' && from.length) return { numbers: pageOf(from, current, size), source, fell: false }
  if (!total) return { numbers: [], source: 'around', fell: source !== 'around' }
  const here = Number.isInteger(current) && current >= 0 && current < total ? current : 0
  const start = Math.floor(here / size) * size
  const numbers = []
  for (let n = start; n < Math.min(total, start + size); n++) numbers.push(n)
  return { numbers, source: 'around', fell: source !== 'around' }
}

/** How many preset tiles to a row: two where they share the screen with nothing or with the scenes; four on a phone's top block; up to eight on a big screen. */
export function presetCols(view, { posture = 'phone', count = 8 } = {}) {
  if (view === 'both' || view === 'presets') return 2
  if (posture === 'phone') return 4
  return Math.min(Math.max(1, count), posture === 'wide' ? 8 : 6)
}

export const TOP_TILE = 52
export const TILE_LEAST = 44

/**
 * How tall a preset tile is. On top: TOP_TILE, a fixed block the scenes and
 * pedals fit under. Sharing the screen with the scenes (`both`): their share
 * of `room` by rows, no taller than `most`. Alone (`presets`): all of `room`.
 * `room` is what Play has for tiles (its height less everything that is not
 * a tile); with none measured yet, or Fit off, `plainTall` (the size step's
 * own tile).
 */
export function presetTall({ view, room = 0, presetRows = 0, sceneRows = 0, gap = 0, plainTall = TOP_TILE, most = 96, fit = true } = {}) {
  if (view === 'top' || view === 'rig') return TOP_TILE
  if (!fit || !(room > 0) || presetRows < 1) return Math.max(TILE_LEAST, plainTall)
  if (view === 'presets') return Math.max(TILE_LEAST, Math.min(200, Math.floor((room - gap * (presetRows - 1)) / presetRows) - 1))
  const rows = presetRows + Math.max(0, sceneRows)
  const share = (room * presetRows) / rows
  return Math.max(TILE_LEAST, Math.min(most, Math.floor((share - gap * (presetRows - 1)) / presetRows) - 1))
}
