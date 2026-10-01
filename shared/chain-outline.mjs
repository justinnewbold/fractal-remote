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

/*
 * THE PRESETS EITHER SIDE, READ BEFORE THEY ARE ASKED FOR.
 *
 * "The amp pedal names are blank for about half a second before it shows
 * their names. Can you preload the previous preset and preload the next
 * preset with those names so it instantly changes... preload the next one and
 * keep the previous one." A preset played before already goes up from memory
 * on the tap (KNOWN_CHAINS). One never played had grey cards until the status
 * read above came back — a round trip after the select, longer through the
 * relay.
 *
 * So once a preset has settled and the screen is quiet, the slots Previous and
 * Next would land on are read — the stored slot decoded, without loading it,
 * GET /presets/{n}/summary — and their pedals kept, in signal order. A tap on
 * one puts those pedals up with the name, dimmed like any outline, and the
 * status read and the chain read still go as they always did and replace them.
 * The one you came from is in KNOWN_CHAINS already: that is the "keep the
 * previous one".
 *
 * Gentle, because the dropouts came from reading the unit while it loads: one
 * read at a time, never while a preset is loading, the chain being read or the
 * tuner running, and only READ_AHEAD_MS after the last thing happened. A slot
 * read once is not read again, and a unit that has no such read says so once
 * and is not asked again.
 */
export const READ_AHEAD_MS = 2500

/*
 * A stored preset's summary, as the tiles a tap would put up. No bypass and no
 * channel — a summary does not say which scene is on — so these are drawn as
 * an outline, and the status read fills the states in.
 *
 * null for a summary that is about another slot, or names no block the
 * catalog knows: the tap waits for the status read, as before.
 */
export function aheadChain(summary, number, catalog) {
  if (!summary || typeof summary !== 'object') return null
  if (Number.isInteger(summary.number) && summary.number !== number) return null
  const blocks = Array.isArray(summary.blocks) ? summary.blocks : []
  const states = blocks.filter((b) => b && Number.isInteger(b.effectId)).map((b) => ({ effectId: b.effectId }))
  return outlineChain(states, catalog)
}

/**
 * The reading itself, one end's copy each. `read(n)` makes the read and
 * answers with what to keep (aheadChain's answer, null included); `has(n)` is
 * whether that slot needs no read — kept already, or known from being played;
 * `keep(n, list)` files the answer; `ready()` is whether the unit is quiet
 * enough to be asked. `wait` and `clear` are the clock, so a test can drive it.
 *
 * `want([next, previous])` says where Previous and Next would land now; the
 * first one still unknown is read after the wait, then the other. An empty
 * want, or `stop()`, calls it all off.
 */
export function createReadAhead({ read, has, keep, ready, wait = setTimeout, clear = clearTimeout, after = READ_AHEAD_MS }) {
  let wanted = []
  let timer = null
  let reading = false
  let off = false
  const missed = new Set()
  const owed = () => wanted.find((n) => !missed.has(n) && !has(n))
  const schedule = () => {
    if (timer !== null) clear(timer)
    timer = null
    if (off || reading || owed() === undefined) return
    timer = wait(tick, after)
  }
  const tick = async () => {
    timer = null
    if (off || reading) return
    if (!ready()) return schedule()
    const n = owed()
    if (n === undefined) return
    reading = true
    try {
      keep(n, await read(n))
    } catch (err) {
      /* 501: this unit cannot decode a stored slot. Nothing else will either. */
      if (err?.status === 501) off = true
      missed.add(n)
    } finally {
      reading = false
    }
    schedule()
  }
  return {
    want(numbers) {
      const next = (Array.isArray(numbers) ? numbers : []).filter((n, i, all) => Number.isInteger(n) && n >= 0 && all.indexOf(n) === i)
      if (next.join(',') !== wanted.join(',')) missed.clear()
      wanted = next
      schedule()
    },
    /* Something just happened at the unit: the quiet starts again from now. */
    nudge: schedule,
    stop() {
      wanted = []
      if (timer !== null) clear(timer)
      timer = null
    },
    get reading() {
      return reading
    }
  }
}
