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
 * AND A BLOCK THAT IS OFF IS SWITCHED ON, SO THE CAPTURE IS HEARD (17
 * November 2026: "need to make sure that it turns it on automatically to
 * listen"). A pick only chooses the capture: in a block that was off it
 * made no sound, and the line still said "is playing". So once the unit
 * has named a capture in the block, a block the chain on screen shows as
 * off is switched on (`switchOnToHear` says when; lib/namOnHere sends it),
 * and the line says which happened (`pickedLine`'s `on`). Only then: never
 * for an empty slot or a pick that failed, never once the preset or the
 * scene has moved since the TAP (it would switch a block on somewhere the
 * player did not ask: a capture that is sent first takes half a minute over
 * Bluetooth, and a scene can be stepped to meanwhile, so the page takes the
 * moment at the tap and not at the pick), and nothing is sent for a block
 * that is on already. A block left off, because the unit moved or because
 * the switch did not land, is never said to be playing and is not ticked.
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
export function heardPick(known, { block, slot, name = '', failed = false, empty = false, off = false, asked = null, answered = null }) {
  const next = { ...(known || {}) }
  delete next[block]
  /* `off`: the unit named the capture, and the block stayed switched off, so it is not playing it. */
  if (failed || empty || off || !Number.isInteger(slot) || !sameMoment(asked, answered)) return next
  next[block] = { slot, name, preset: answered.preset, scene: answered.scene, rev: answered.rev }
  return next
}

/** What became of a block that was off, for the line: the unit took the switch; it was sent and did not land (or its answer was lost); or it was left off because the unit had moved since the tap. */
export const SWITCHED_ON = 'switched on'
export const STILL_OFF = 'still off'
export const LEFT_OFF = 'left off'

/**
 * Whether the block is to be switched on now that the unit has named a
 * capture in it. `off` is what the chain on screen says of the block (true,
 * false, or null where it does not say); `asked` and `now` are where the
 * unit was at the tap and where it is. Only a block known to be off, and
 * only while the unit is where the tap was made.
 */
export const switchOnToHear = ({ off = null, asked = null, now = null } = {}) => off === true && sameMoment(asked, now)

/** The other half: a block known to be off where the unit is now, with the unit somewhere other than where the tap was made. Nothing is switched, and the line says so (LEFT_OFF). */
export const leftOffAfterMove = ({ off = null, asked = null, now = null } = {}) => off === true && !sameMoment(asked, now)

/** Whether a line says the block is playing the capture: never one for a block that stayed off. */
export const saysPlaying = (on) => on !== STILL_OFF && on !== LEFT_OFF

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
 * claiming nothing of what the block held before the tap. `on` is what
 * became of a block that was off (SWITCHED_ON, STILL_OFF, LEFT_OFF), and
 * null where the app saw nothing to switch: a block left off is never said
 * to be playing. STILL_OFF claims nothing of the block's state either: a
 * switch whose answer was lost may have landed.
 */
export function pickedLine({ n, name, before = null, on = null }) {
  const which = `NAM ${n === 2 ? 2 : 1}`
  if (on === SWITCHED_ON) return `${which} was off, so it is switched on now, and it is playing “${name}” through your own rig. Save the preset to keep it that way.`
  if (on === STILL_OFF) return `${which} is set to “${name}” now, but the app couldn’t switch ${which} on. If you don’t hear it, switch ${which} on.`
  if (on === LEFT_OFF) return `${which} is set to “${name}” now, but ${which} is switched off and the app left it off, because the scene, the preset or the connection changed after your tap. Switch ${which} on to hear it.`
  if (before && before.name === name) return `Asked the unit again: ${which} is playing “${name}”. Save the preset to keep it there.`
  return `${which} is playing “${name}” now, through your own rig. Save the preset to keep it there.`
}
