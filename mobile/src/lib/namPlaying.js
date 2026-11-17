/*
 * WHETHER A NAM BLOCK IS ALREADY ON A CAPTURE, AS THE TONE3000 PAGE SAYS IT.
 *
 * "Play it in NAM 1" sent the pick again when NAM 1 already played that
 * capture, said "Changing…" for a moment, and left the same line standing,
 * so the tap looked as if it did nothing (Justin's log, 17 November 2026,
 * his Axe-Fx III through a Raspberry Pi). So where the unit itself has said,
 * on this page and since nothing has moved, that a block is on a capture's
 * slot, that block's button under that capture says so ("✓ Playing in NAM
 * 1"). A tap still asks the unit (the pick is sent as before), and when the
 * unit names the same capture again the line says it asked again. Never
 * that the block "was already" on it: the page knows only what the unit
 * said after its own last pick, and the block can have been changed at the
 * unit or in another editor since.
 *
 * What the page keeps, by block: `{ slot, name, preset, scene, rev }`, the
 * slot the unit named the block on and what it called it, with the preset,
 * scene and load of it (the rig's `bufferRev`) it was on when it said so. It is the page's own: the parents' rule
 * for "where the block is" (components/Tone3000Test `onPointed`: the unit's
 * own answer to a pick, never a guess, and nothing vouched for after a pick
 * that failed, since it may have landed) is this one's, and on top of it a
 * tick is dropped the moment it can no longer be vouched for:
 *
 *   a pick in that block fails, or names an empty slot
 *   the preset or the scene changes before the answer, or after it
 *   the same preset is loaded again (a Revert, the same preset picked
 *   again): the unit throws an unsaved pick away, and only the rig's
 *   `bufferRev` says so, the number and the scene being the same
 *   the link drops
 *   another capture is played in that block (the block has moved)
 *   the page is left (the page keeps it, so it goes with the page)
 *
 * PURE and imports nothing: test/nam-playing.mjs runs every case of it, and
 * the page draws what it answers.
 */

/** The one place the button's words are: the page has none of its own. */
export const playItIn = (n) => `Play it in NAM ${n === 2 ? 2 : 1}`
export const playingIn = (n) => `✓ Playing in NAM ${n === 2 ? 2 : 1}`
export const CHANGING = 'Changing…'
export const PLAY_IN_SUB = 'In the preset the unit is on'
export const PLAYING_SUB = 'The unit said so. Tap to ask it again.'

const sameMoment = (a, b) => !!a && !!b && a.linked === true && b.linked === true && a.preset === b.preset && a.scene === b.scene && a.rev === b.rev

/**
 * What the page knows after the unit answered a pick in `block`.
 * `asked` and `answered` are where the unit was ({ preset, scene, rev, linked })
 * when the pick went and when its answer came: one that moved between the
 * two is not vouched for. `failed`: the pick threw. `empty`: the unit named
 * the slot as holding nothing.
 */
export function heardPick(known, { block, slot, name = '', failed = false, empty = false, asked = null, answered = null }) {
  const next = { ...(known || {}) }
  delete next[block]
  if (failed || empty || !Number.isInteger(slot) || !sameMoment(asked, answered)) return next
  next[block] = { slot, name, preset: answered.preset, scene: answered.scene, rev: answered.rev }
  return next
}

/** What is still vouched for `now`: nothing once the link is down, and only what was said on this preset, scene and load of it. */
export function keptWhile(known, now) {
  if (!now || now.linked !== true) return {}
  return Object.fromEntries(Object.entries(known || {}).filter(([, k]) => k && k.preset === now.preset && k.scene === now.scene && k.rev === now.rev))
}

/** What the page knows of `block` on `slot` now, or null. */
export function playingOn(known, now, block, slot) {
  const k = keptWhile(known, now)[block]
  return k && Number.isInteger(slot) && k.slot === slot ? k : null
}

/**
 * The button under a capture on `slot` for `block` (NAM `n`): `ticked`
 * where the unit has said the block is on that slot, `label` and `sub` as
 * drawn. `changing` while that pick is out.
 */
export function namPlayButton({ known, now, block, n, slot, changing = false }) {
  const ticked = !!playingOn(known, now, block, slot)
  return {
    ticked,
    label: changing ? CHANGING : ticked ? playingIn(n) : playItIn(n),
    sub: ticked ? PLAYING_SUB : PLAY_IN_SUB
  }
}

/**
 * The line under the capture once the unit has named what the block is on.
 * `before` is what the page knew of the block on that slot when the tap was
 * made (playingOn): the same capture named again is said as asked again,
 * claiming nothing of what the block held before the tap.
 */
export function pickedLine({ n, name, before = null }) {
  const which = `NAM ${n === 2 ? 2 : 1}`
  if (before && before.name === name) return `Asked the unit again: ${which} is playing “${name}”. Save the preset to keep it there.`
  return `${which} is playing “${name}” now, through your own rig. Save the preset to keep it there.`
}
