/*
 * THE BLOCKS THE COMPUTER'S ENGINE HAS NO NAME FOR, NAMED FOR PLAY IN THE
 * BROWSER AND THE COMPUTER'S OWN WINDOW.
 *
 * "Nam blocks are showing in the APP but not computer" (Justin, 13 November
 * 2026, with a picture of the computer app's window on his Raspberry Pi: an
 * Axe-Fx III on a preset called NAM, and no NAM tile in its chain).
 *
 * The engine (ForgeFX, at the pin) passes an Axe-Fx III's NAM, IR Player,
 * Vocoder, Crossover, Tone Match and Dynamic Distortion on with their place,
 * their on and off, their channel and their effect id, and NO SLUG. The
 * phone names them itself since 1.90.48 (mobile/src/lib/ownBlocks.js, from
 * mobile/src/lib/gen3Catalog.js OWN); this page drew only blocks with a
 * slug, so Play left them out. This is the phone's list, for this end: the
 * same ids, the same names, the same picture each one borrows, held equal
 * to the phone's by a test.
 *
 * ONLY PLAY ASKS IT. The chain as the rest of the page keeps it is untouched
 * (no slug, so still a New block to Edit, the chain editor, the report and
 * the assistant: shared/new-block.mjs), and what Play gets back is a copy
 * with the name on, still marked `unknown`. Nothing more is needed from the
 * engine to switch one: its on/off and channel routes take the id as it is,
 * which is how Edit's strip has always switched a New block.
 *
 * Only on an FM9 or an Axe-Fx III, by the name the computer gives the unit
 * (shared/device-slug: "Axe-Fx III" is axefxiii), and only these ids: every
 * other block with no slug stays the New block it was.
 */
import { isAdmin } from './admin.mjs'

/** By the unit's slug: each family's first id, its name, and how many of it the unit has (each the next id). */
export const OWN_BLOCKS = Object.freeze({
  /* By Fractal's enum and Blocks Guide, not read off a unit. */
  fm9: Object.freeze([
    Object.freeze({ id: 134, slug: 'vocoder', name: 'Vocoder', count: 1 }),
    Object.freeze({ id: 142, slug: 'crossover', name: 'Crossover', count: 2 }),
    Object.freeze({ id: 170, slug: 'tonematch', name: 'Tone Match', count: 1 })
  ]),
  /* Read off his own Axe-Fx III (docs/ax3-readings.md), and Fractal's enum; 143, 196 to 198 and 203 are the next ids, not read. */
  axefxiii: Object.freeze([
    Object.freeze({ id: 134, slug: 'vocoder', name: 'Vocoder', count: 1 }),
    Object.freeze({ id: 142, slug: 'crossover', name: 'Crossover', count: 2 }),
    Object.freeze({ id: 170, slug: 'tonematch', name: 'Tone Match', count: 1 }),
    Object.freeze({ id: 195, slug: 'irplayer', name: 'IR Player', count: 4 }),
    Object.freeze({ id: 202, slug: 'dynadist', name: 'Dynamic Distortion', count: 2 }),
    Object.freeze({ id: 206, slug: 'nam', name: 'NAM', count: 2 })
  ])
})

/**
 * The picture each one borrows, and no new picture: the NAM block is a
 * captured amp and wears the amp's, the IR Player plays cabinet responses
 * and wears the cab's, Dynamic Distortion the drive's, a crossover (a pair
 * of filters) the filter's, Tone Match (an EQ curve) the graphic EQ's, the
 * Vocoder the formant's. The phone's own choice, word for word
 * (mobile/src/lib/blockIcons.js PHONE_ONLY).
 */
export const OWN_ICON = Object.freeze({ nam: 'amp', irplayer: 'cab', dynadist: 'drive', crossover: 'filter', tonematch: 'geq', vocoder: 'formant' })

/** One of them by the unit's slug and the block's effect id: `{ slug, name }`, numbered where the unit has more than one ("NAM 1"), or null. */
export function ownBlock(unitSlug, effectId) {
  const list = OWN_BLOCKS[String(unitSlug || '').toLowerCase()]
  if (!list || !Number.isInteger(effectId)) return null
  for (const fam of list) {
    const instance = effectId - fam.id + 1
    if (instance >= 1 && instance <= fam.count) return { slug: fam.slug, name: fam.count > 1 ? `${fam.name} ${instance}` : fam.name }
  }
  return null
}

/**
 * THE SWITCH. False: Justin's account only, as the phone's own naming
 * through the computer still is (mobile/src/lib/features.js
 * OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE), until he has switched one
 * through his Raspberry Pi. True opens it to everybody. Every other account,
 * signed out, and the demo get exactly the Play they had.
 */
export const OWN_BLOCKS_ON_THE_WEB_FOR_EVERYONE = false

/** Whether the account signed in on this page is shown them: `id` is the same read the Developer rows use (link.account?.id). */
export const ownBlocksOpenTo = (id, everyone = OWN_BLOCKS_ON_THE_WEB_FOR_EVERYONE) => everyone === true || isAdmin(id)

/**
 * The chain for Play: each block the engine sent with no slug that this unit
 * has a name for, named, and still `unknown`. The same list back, untouched,
 * when there is nothing to name or the account is not shown them.
 */
export function nameOwnBlocks(blocks, unitSlug, open) {
  if (open !== true || !Array.isArray(blocks)) return blocks
  if (!OWN_BLOCKS[String(unitSlug || '').toLowerCase()]) return blocks
  let named = false
  const out = blocks.map((b) => {
    if (!b || typeof b !== 'object' || b.slug) return b
    const own = ownBlock(unitSlug, b.effectId)
    if (!own) return b
    named = true
    return { ...b, slug: own.slug, name: own.name, unknown: true, onPlay: true }
  })
  return named ? out : blocks
}
