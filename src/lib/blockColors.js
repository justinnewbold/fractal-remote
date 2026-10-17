/**
 * The colour a block is drawn in, so this app's blocks match the unit.
 *
 * The point is recognition on a dark stage: on the AM4's own screen the drive
 * is red and the delay is blue, and a screen pretending to be that hardware
 * should agree with it.
 *
 * The colours themselves are in lib/blockPalettes — one table per kind of
 * unit, read out of Fractal's own pictures, and the looks a player can wear
 * instead. This only decides which of them a tile gets, in this order:
 *
 *   1. your own colour for that family, from Settings → Colours
 *   2. the look's colour for the unit you are on (Match my unit has one table
 *      per kind of unit; Footswitch lights one ring colour per kind)
 *   3. the look's own colour for the family
 *   4. NEUTRAL, for a block nobody here can name
 *
 * The letters are worked out from the colour (lib/ink), never stored — except
 * in Fractal Remote, the app's look as it always was, which keeps the letters
 * it always had.
 *
 * Asked once per tile per render, so the answer is kept until the looks or
 * the unit change: after that it is an object lookup.
 */
import { FRACTAL_REMOTE, FRACTAL_REMOTE_LOOK, NEUTRAL, familyOf, lookById } from './blockPalettes.js'
import { inkOn } from './ink.js'
import { currentPaletteId, lookId, looksVersion, yourFamily } from './looks.js'

let keptFor = null
const kept = new Map()

/* Steps 2 to 4: what a look paints a family on a kind of unit, yours aside. */
function fromLook({ key, family }, id, palette) {
  if (id === FRACTAL_REMOTE_LOOK) return FRACTAL_REMOTE[key] || FRACTAL_REMOTE[family] || NEUTRAL
  const look = lookById(id)
  const forUnit = look.byUnit?.[palette]
  const fill = forUnit?.[key] || forUnit?.[family] || look.families[key] || look.families[family]
  return fill ? Object.freeze({ fill, ink: inkOn(fill) }) : NEUTRAL
}

function resolve(slug) {
  const found = familyOf(slug)
  if (!found) return NEUTRAL
  const own = yourFamily(found.family)
  if (own) return Object.freeze({ fill: own, ink: inkOn(own) })
  return fromLook(found, lookId(), currentPaletteId())
}

/**
 * The colour a look gives a block when you have chosen none for it — the
 * same steps as blockColor, without step 1.
 *
 * The look being worn and the unit connected unless told otherwise, which is
 * what the colour sheet's first swatch and its "Back to the unit's colour"
 * are. The Colours page asks about the looks NOT being worn too, to draw each
 * one's card as Play would draw it.
 */
export function lookColour(slug, { look = lookId(), palette = currentPaletteId() } = {}) {
  const found = familyOf(slug)
  return found ? fromLook(found, look, palette).fill : NEUTRAL.fill
}

/** The colour for a block, by its slug. Unknown families stay neutral. */
export function blockColor(slug) {
  const stamp = `${looksVersion()}|${currentPaletteId()}`
  if (stamp !== keptFor) {
    kept.clear()
    keptFor = stamp
  }
  const k = slug == null ? '' : String(slug)
  let hit = kept.get(k)
  if (!hit) {
    hit = resolve(k)
    kept.set(k, hit)
  }
  return hit
}

/**
 * Whether a block is one of the chain's two ends, which are drawn as a quiet
 * outline rather than a lit tile on both ends of the app. "The plumbing, not
 * the tone": neither has an on or off, and an Input and an Output lit up like
 * pedals competed with the amp for a strip you read left to right. The
 * browser's edit strip has always drawn them so; now the phone and the rows
 * do too. Fractal Remote, the app's look as it always was, keeps them as the
 * phone always drew them.
 */
export function quietEnd(slug) {
  const family = familyOf(slug)?.family
  return (family === 'input' || family === 'output') && lookId() !== FRACTAL_REMOTE_LOOK
}
