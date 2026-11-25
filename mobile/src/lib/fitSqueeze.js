/**
 * FIT TO SCREEN, WHEN THE TILES ALONE CANNOT DO IT.
 *
 * "When fit to screen is selected (which I believe should be the default
 * setting) we should have everything actually fit on the screen so that you
 * don't have to scroll up or down to access the little things at the bottom
 * or top?" (Justin, 25 November 2026, with Play on his Axe-Fx III through
 * the Raspberry Pi on an iPhone 17 Pro Max: eight scenes, twelve pedals, and
 * Tuner, Edit and Tap cut off at the bottom of the screen.)
 *
 * Fit shrank the tiles and nothing else. A scene tile is never shorter than
 * its number over its name and a pedal never shorter than its picture over
 * its letters, so with eight scenes and twelve pedals every tile was at its
 * least and the page was still some fifty points too tall. Everything
 * around the tiles was at its ordinary size: the gaps between the sections,
 * the preset button's extra height, the bottom buttons' 56, the padding
 * under them.
 *
 * Those are exactly what the Smallest size already gives up (Stage `tight`,
 * "SMALLEST MEANS IT FITS"), about sixty points on a phone. So when Fit is
 * on, its tile has reached the floor and the page is still over, Play is
 * drawn tight. Nothing pressable goes under the platform's 44.
 *
 * ONLY ON A PHONE'S PLAIN PAGE (`plain`): where the buttons are a strip of
 * their own (a wide window, a side beside a tool) or Play is on its side,
 * the page has other rules for its room and `tight` reaches into them.
 *
 * AND IT IS KEPT (`squeezeKey`) for as long as the same screen holds the
 * same number of tiles, so it never goes back and forth: tight frees room,
 * and looser would overflow again. The key leaves out whether the chain is
 * still loading, which Fit's own correction keys on, so stepping through
 * presets of one size does not make the buttons jump.
 */

/* Fit's own least tile (lib/gigSize fitTiles `min`). */
export const FIT_FLOOR = 44
/* A pixel or two is rounding (Stage's own figure for the trim). */
export const FIT_SLACK = 2

/** Whether Play should now be drawn tight for Fit. */
export function squeezeNow({ fitOn, plain, tile, over, floor = FIT_FLOOR } = {}) {
  if (fitOn !== true || plain !== true) return false
  if (!(Number(tile) > 0) || Number(tile) > floor) return false
  return Number(over) > FIT_SLACK
}

/** What a squeeze is kept for: this screen, this many tiles. */
export function squeezeKey({ viewport, width, scenes, blocks, fitOn, sceneCols } = {}) {
  return `${viewport}:${width}:${scenes}:${blocks}:${fitOn === true}:${sceneCols}`
}
