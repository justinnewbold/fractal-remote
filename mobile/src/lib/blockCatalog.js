/*
 * Every block the unit can place, with its effect id (`page`): what a status
 * read's ids are named and coloured by before the chain has been read. See
 * lib/chain-outline. The FM3's list, read off the unit; an id it does not
 * hold is left off the outline, and the chain read brings it in.
 */
import blocks from '../data/blocks.json' with { type: 'json' }

export const blockCatalog = blocks
