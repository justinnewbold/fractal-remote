/* Generated from shared/new-block.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * A block newer than the app: one the unit has in its preset and this app has
 * no name for.
 *
 * Axe-Fx III firmware 33 (November 2026) brought a block nobody had heard of
 * the week before, the NAM block, up to two to a preset. The computer passes
 * such a block on with its place in the grid and no slug: it knows WHERE it
 * is, and not WHAT it is. The phone used to drop every block like that on the
 * way in, so its cell in Edit looked empty, and a block put there went over
 * the top of the new one in the preset on the unit. Gone, settings and all,
 * for a tap the screen had invited.
 *
 * So a block with no slug is kept, and marked, and every screen that edits
 * the chain treats its cell as taken: never offered as free, never dealt a
 * block in a drag, never replaced. It is drawn as a plain tile in words and
 * left as it is. Play, the scenes and the knob lists still leave it out, as
 * they always have: they have nothing to switch or turn on it that the app
 * knows the meaning of.
 *
 * Words only, in one place, for both apps. Never a picture from Fractal's own
 * editors for it.
 */

/** What the tile says, in full and where there is room for three letters. */
export const NEW_BLOCK_NAME = 'New block'
export const NEW_BLOCK_SHORT = 'New'

/** The line under it, wherever it is opened or listed. */
export const NEW_BLOCK_NOTE = 'This block is newer than the app. It’s left as it is.'

/**
 * Whether a block is one the app has no name for. The computer says so with
 * an empty slug: '' from the chain read, null from a stored preset's summary.
 * The phone marks each one `unknown` as it comes in (markNewBlocks), and that
 * mark is the answer from then on.
 */
export const isNewBlock = (b) => !!b && typeof b === 'object' && (b.unknown === true || b.slug === '' || b.slug === null)

/** The blocks the app knows, for every list that switches, turns or names them. */
export const knownBlocks = (blocks) => (Array.isArray(blocks) ? blocks : []).filter((b) => b && !isNewBlock(b))

/**
 * The marked copy the phone keeps of the chain read: `unknown: true` on each
 * block with no slug, however the slug came to be missing. Every one of them
 * used to be dropped here; now each keeps its cell.
 */
export const markNewBlocks = (blocks) =>
  (Array.isArray(blocks) ? blocks : []).filter((b) => b && typeof b === 'object').map((b) => (b.slug ? b : { ...b, unknown: true }))
