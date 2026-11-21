/**
 * FOUR BIG PEDALS, TWO BY TWO, ON A PHONE HELD UPRIGHT.
 *
 * "On the AM4 and VP4 let's make the scenes 2×2 instead of four so that we
 * can use up more of the screen and make them bigger ... make the presets
 * square as well ... so that they're the same size as the scenes ... We just
 * wanna take up the whole screen and use everything we can. Or if we can
 * make that a setting, the user can change in settings as well." (Justin, 21
 * November 2026, of Play on his AM4: four scenes two by two, four pedals in
 * one short row under them, and a third of the screen empty under the
 * buttons. "The presets" there are the pedals.)
 *
 * So where a preset has four pedals or fewer and four scenes or fewer (an
 * AM4, a VP4), on a phone held upright, the pedals are two to a row like
 * the scenes, every tile of both the same height, and that height is what
 * the screen has left, shared between the rows: never taller than a tile
 * is wide (a square is the most), never shorter than the tiles were.
 *
 * A choice, on out of the box, in Settings → Play screen → Tiles & scenes.
 * Kept on the device under its own key; lib/gigSize is the browser's file
 * too and is not touched. Nothing here draws or asks a unit anything.
 */
export const BIG_FOUR_KEY = 'fractal.play.bigFour'
export const BIG_FOUR_LABEL = 'Big pedals, two by two'
export const BIG_FOUR_SUB = 'With four pedals or fewer (an AM4 or a VP4), the pedals are as big as the scenes and fill the screen.'
/* The most pedals, and the most scenes, it is for. */
export const BIG_FOUR_MOST = 4
/* How many pedals share a row. */
export const BIG_FOUR_ACROSS = 2

export function loadBigFour(storage) {
  try {
    const raw = storage?.getItem(BIG_FOUR_KEY)
    if (raw === '0') return false
    return true
  } catch {
    return true
  }
}

export function saveBigFour(on, storage) {
  try {
    storage?.setItem(BIG_FOUR_KEY, on ? '1' : '0')
    return true
  } catch {
    return false
  }
}

/**
 * Whether Play is drawn this way. `plain` is Play as a phone held upright
 * draws it: not opened up, not lined up, not filling a big screen, not in a
 * side. `scenes` and `pedals` are how many of each this preset shows.
 */
export function bigFourOn({ on, plain, scenes = 0, pedals = 0 } = {}) {
  if (!on || !plain) return false
  if (!Number.isInteger(pedals) || pedals < 1 || pedals > BIG_FOUR_MOST) return false
  if (!Number.isInteger(scenes) || scenes < 0 || scenes > BIG_FOUR_MOST) return false
  return true
}

/**
 * How tall every tile is: the room the two grids have between them, less
 * the gaps between their rows, shared by the rows; a point under, so the
 * page never comes out a hair longer than the screen. `room` is nought
 * until Play has measured itself, and then the tiles are as they were.
 */
export function bigFourTile({ room = 0, sceneRows = 0, pedalRows = 0, gap = 0, least = 0, wide = 0 } = {}) {
  const rows = Math.max(0, sceneRows) + Math.max(0, pedalRows)
  if (!(room > 0) || rows < 1) return least
  const gaps = Math.max(0, sceneRows - 1) + Math.max(0, pedalRows - 1)
  const share = Math.floor((room - gaps * gap) / rows) - 1
  const most = wide > 0 ? Math.floor(wide) : share
  return Math.max(least, Math.min(share, most))
}
