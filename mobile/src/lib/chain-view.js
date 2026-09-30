/* Generated from shared/chain-view.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * Whose chain is on the screen, decided once for the phone and the browser.
 *
 * On the play test the new preset's name went up the moment it was chosen and
 * the last preset's blocks stayed under it. That part is on purpose: the chain
 * is read once, a moment after the switch, because reading it straight away
 * is a whole preset dumped down the port while the unit is still loading (see
 * own-echo.mjs). What was wrong was that nothing on screen knew. The old tiles
 * looked current and stayed live — a double-tap on one switched a block on
 * the NEW preset, found by its number.
 *
 * So each store says which preset the blocks on screen were read for, and
 * whether a read of the chain is on its way. The rest is this:
 *
 *   'loading'   the blocks are another preset's and this one's are coming.
 *               They are not drawn at all — they belong to another song —
 *               and grey cards stand where they go.
 *   'failed'    the blocks are another preset's and nothing is coming: the
 *               read failed, or never started. Said, with a way to ask again.
 *   'updating'  this preset's chain, being read again after an Add, a Remove,
 *               a Save or a Revert. It stays up; it greys, and says so, only
 *               once the read has taken long enough to notice.
 *   'ready'     this preset's chain, and nothing is reading it.
 *
 * KNOWN_CHAINS. "Presets are loading much slower now when switching, taking
 * about 3 seconds to load scene name and pedals." The grey cards were right
 * for a preset never seen, and a wait for nothing on one played a minute ago:
 * its chain was on screen then. So each store keeps, per unit and per slot,
 * the last chain it read straight after loading that slot — the slot as
 * stored, before any edit — and puts it up on the tap, as that preset's.
 * `known` says so. It is dropped when this app changes the preset's
 * structure or saves over the slot, and the read after the switch replaces
 * it whatever it finds. A slot never read still gets the cards.
 *
 * Only 'ready' and 'updating' may switch anything. The other two are drawing
 * nothing to switch, and the stores refuse a write made from a tile that was
 * drawn before the preset changed.
 */

/**
 * How long a re-read of the same chain goes unmentioned. Most of them land
 * well inside this, and a chain that greyed and came back on every Add would
 * be a chain that flickers.
 */
export const UPDATING_AFTER_MS = 400

/**
 * `want` is the preset the screen is for: the one on screen, or one this app
 * has just asked the unit for. `chainFor` is the preset the blocks were read
 * for, null when nobody knows. `busy` is whether a read of the chain is on
 * its way, a wait before one included.
 */
export function chainView({ want, chainFor, busy, known = null }) {
  /* No preset yet, or a unit too busy to say which: nothing to hold the
     blocks to, so what there is is drawn. */
  if (!Number.isInteger(want) || want < 0) return 'ready'
  if (chainFor !== want) return busy ? 'loading' : 'failed'
  /* This preset's chain as it was last read, put up the moment it was
     chosen (see KNOWN_CHAINS): the one read after the switch confirms it or
     replaces it, and until then it is drawn and played like any other. Not
     'updating' — nothing about it is being changed. */
  if (known === want) return 'ready'
  return busy ? 'updating' : 'ready'
}

/** Whether a tile drawn from this chain may write to the unit. */
export const chainActs = (view) => view === 'ready' || view === 'updating'

/** Whether the blocks on screen belong to another preset, and are not drawn. */
export const chainElsewhere = (view) => view === 'loading' || view === 'failed'

/** The words, the same on both ends. */
export const CHAIN_WORDS = Object.freeze({
  loading: (number) => `Loading preset ${number}’s chain…`,
  failed: 'Couldn’t read this preset’s chain',
  retry: 'Try again',
  updating: 'Updating…',
  /* What a write refused for that reason says, if anything ever shows it. */
  refused: 'That preset’s chain is still loading.'
})
