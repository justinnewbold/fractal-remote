/* Generated from shared/chain-outline.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * The pedals of a preset never seen before, drawn before its chain is read.
 *
 * "The preset and effects pedals are still taking a little too long to load.
 * Is there any way to pull like the label in the pedal outline or something
 * real fast first before it actually pulls the rest of the info from the
 * device... even if it takes another second or two in the background."
 *
 * The chain read is a whole preset dumped down the port, and it waits for the
 * unit to finish loading on purpose (see own-echo.mjs). A preset played
 * before is already put up from memory at once (see chain-view.mjs,
 * KNOWN_CHAINS). A preset never seen had grey cards for the whole wait.
 *
 * But one small read already says which blocks are placed: the status read,
 * GET /preset/scene-state, every placed block's effect id with its bypass and
 * channel — about forty bytes, no dump, and the same read a scene tap already
 * makes, so it is known not to cut the sound. An effect id is enough to name
 * a block and colour it. So the tiles go up from that a moment after the
 * select, and the one chain read still comes when it always did and replaces
 * them, with the unit's own order and names.
 *
 * Zero imports, so both ends carry it: the browser imports it, the phone gets
 * a generated copy (npm run sync:rules). Each end hands in its own copy of the
 * block catalog (data/blocks.json), whose `page` is the block's effect id.
 */

/*
 * How long after the select the status read goes. Long enough for the unit to
 * have taken the select; well inside the wait before the chain read.
 */
export const OUTLINE_AFTER_MS = 250

/*
 * The order the tiles are drawn in, until the chain read says where each
 * block really sits: the way most chains run, input to output. A family not
 * listed goes after the listed ones, before the looper and the output.
 */
const SIGNAL_ORDER = [
  'input',
  'gate',
  'wah',
  'filter',
  'formant',
  'comp',
  'multicomp',
  'drive',
  'enhancer',
  'amp',
  'cab',
  'geq',
  'peq',
  'pitch',
  'synth',
  'ringmod',
  'resonator',
  'chorus',
  'flanger',
  'phaser',
  'rotary',
  'tremolo',
  'volume',
  'delay',
  'multitap',
  'megatap',
  'tentap',
  'plex',
  'reverb',
  'mixer',
  'multiplexer',
  'send',
  'return'
]
const TAIL = ['looper', 'output']

const rankOf = (slug) => {
  const t = TAIL.indexOf(slug)
  if (t >= 0) return SIGNAL_ORDER.length + 1 + t
  const i = SIGNAL_ORDER.indexOf(slug)
  return i >= 0 ? i : SIGNAL_ORDER.length
}

/**
 * The blocks a status read lists, as tiles: slug, name and effect id from
 * the catalog, bypass and channel from the read, in signal order. An id the
 * catalog does not know is left out rather than guessed at.
 *
 * null when there is nothing to draw — no read, an empty one (a unit too busy
 * to answer), or no id the catalog knows — and the caller keeps its cards.
 */
export function outlineChain(states, catalog) {
  if (!Array.isArray(states) || !states.length || !Array.isArray(catalog)) return null
  const byId = new Map()
  for (const c of catalog) if (Number.isInteger(c?.page) && c.slug) byId.set(c.page, c)
  const seen = new Set()
  const out = []
  for (const s of states) {
    const id = s?.effectId
    if (!Number.isInteger(id) || seen.has(id)) continue
    const c = byId.get(id)
    if (!c) continue
    seen.add(id)
    out.push({
      slug: c.slug,
      name: c.name || c.slug,
      effectId: id,
      bypassed: typeof s.bypassed === 'boolean' ? s.bypassed : null,
      channel: typeof s.channel === 'string' && s.channel ? s.channel : null
    })
  }
  if (!out.length) return null
  return out.sort((a, b) => rankOf(a.slug) - rankOf(b.slug) || a.effectId - b.effectId)
}
