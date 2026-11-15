/**
 * Add, from a block's card in the chain editor: where the new block goes,
 * and what is said about it, under the card that was tapped.
 *
 * "Not sure if it added the block it was trying to add here. No
 * confirmation after I clicked add. Check the logs" (Justin, 15 November
 * 2026, on an Axe-Fx III through the Raspberry Pi: a row of thirteen
 * blocks, Add tapped on the Vocoder and then on Comp 2, and Wah 1, Drive 1
 * and Formant 1 tapped in the list that came up). His log had the three
 * taps and nothing after them: no message had gone to the unit. The row
 * was full from the tapped block to its end, the editor had said "No free
 * space after…" in its one line at the TOP of the chain, a dozen cards up
 * and off the screen, and it had written nothing in the log.
 *
 * So, three things, all here so that a test can run them:
 *
 * - WHERE IT WILL GO IS SAID BEFORE ANYTHING IS TAPPED. The new block goes
 *   in the first free space after the card in its row (`freeAfter`), which
 *   is the next column only when that one is free; the list's line used to
 *   say "right after" whichever it was. Where there is no free space, the
 *   list is not drawn at all: the words are (`noRoomAfter`), so no tap can
 *   land on a button that does nothing.
 * - WHAT HAPPENED IS SAID UNDER THE CARD THAT WAS TAPPED (`addedWords`, and
 *   the unit's refusal the same way), where the finger is, and stays until
 *   the next thing is done.
 * - A TAP THAT SENDS NOTHING IS IN THE LOG, with why.
 */

/** The heading of the editor's other way to add, under the chain: the words that point at it use its own. */
export const EMPTY_SPACE = 'Put a block in an empty space'

/** The first free column after `col` in the lane, or null where there is none. */
export const freeAfter = (lane, col) => {
  const free = (lane?.gaps || []).filter((c) => Number.isInteger(c) && c > col).sort((a, b) => a - b)[0]
  return free === undefined ? null : free
}

/** Whether a block that can be taken out sits after `col` in the lane: an Input and an Output cannot be, and a block newer than the app has nothing to press. */
export const removableAfter = (lane, col) => (lane?.blocks || []).some((b) => b.col > col && !['input', 'output'].includes(b.slug))

/** The line under the list of blocks: where a tapped one will go. "Right after" only where the free space (`free`) is the very next one to the card's (`col`); `at` is that space in the editor's words. */
export const addHint = ({ name, at, col, free }) => (free === col + 1 ? `Tap a block to put it right after ${name}.` : `Tap a block to put it at ${at}, the first free space after ${name}.`)

/** Whether there is a free space anywhere in the chain: what "Put a block in an empty space" needs before it can be pointed at. */
export const roomAnywhere = (lanes) => (lanes || []).some((l) => (l?.gaps || []).some((c) => Number.isInteger(c)))

/**
 * In the list's place, where nothing can be added after the card: why, and
 * what would work, which is not the same everywhere.
 *
 * `more` is whether a block after the card could be taken out to make room
 * (after the last slot of an AM4, or with only an Output after it, none
 * can: "Remove a block first" was said there, and a player who did was no
 * further on). `elsewhere` is whether there is a free space anywhere, so
 * that the editor's other way to add is only pointed at where it has
 * somewhere to put a block. `linear` is a unit with one row of slots (an
 * AM4), which has no rows to speak of.
 */
export const noRoomAfter = ({ name, linear = false, more = false, elsewhere = false }) => {
  const why = linear ? `There is no free slot after ${name}.` : more ? `This row is full after ${name}, so a block can’t be added here.` : `There is no room after ${name} in its row, so a block can’t be added here.`
  const other = `“${EMPTY_SPACE}”, under the chain`
  const what = more
    ? elsewhere
      ? `Remove a block after it first, or use ${other}, to add one where there is room.`
      : 'Remove a block after it first.'
    : elsewhere
      ? `Use ${other}, to add one where there is room.`
      : `Nothing else is free either: remove a block first, then use ${other}.`
  return `${why} ${what}`
}

/** Under the card, once the unit holds the new block: the answer to the button just pressed, with a tick. */
export const addedWords = (name, at) => `✓ Added ${name} at ${at}.`

/** The same, for a block that was already in the chain (the list offers every block when it is searched): a unit has one of each, so it was moved, and "Added" would have been a second one that is not there. */
export const movedWords = (name, at, was) => `✓ ${name} is at ${at} now. It was at ${was}: the unit has one ${name}, so it moved.`

/** The cell holds a block, and it is not the one that was asked for. */
export const otherWords = (name, at, put) => `${at} holds another block, and the unit has ${name} at ${put}. Nothing was added there.`

/**
 * WHAT AN ADD CAME TO, off the chain as the unit read it back afterwards.
 *
 * `blocks` is that read; `is(block)` says whether a block is the one that
 * was asked for (by the unit's own id for it); `row` and `col` are the cell
 * it was asked into; `was` is where that very block sat BEFORE the write,
 * or null where it was not in the chain.
 *
 * - 'empty': the cell holds nothing. `put` is where the unit has the block
 *   (null where nowhere), and `stayed` whether that is simply where it was
 *   all along, which is not somewhere the unit "put it instead".
 * - 'other': the cell holds a block and it is not this one, while the read
 *   does have this one elsewhere (`put`). No tick for somebody else's block.
 * - 'moved': the block is in the cell and is gone from where it was: a unit
 *   has one of each, and the list offers blocks already in the chain when
 *   it is searched.
 * - 'added': the block is in the cell. Also where the read carries no id
 *   the list's can be matched to (the cell holding a block is then all
 *   there is to go by), and where a read lists the block in both places
 *   (the demo does): two are on the screen, so "moved" would be untrue.
 *
 * THE CELL IS ASKED FIRST. A first cut asked where the unit had the block
 * and took the first place it found: with the block listed twice that was
 * the old place, and "holds another block. Nothing was added there" was
 * said under the new block's own card.
 */
export function addOutcome({ blocks, is, row, col, was = null }) {
  const all = Array.isArray(blocks) ? blocks : []
  const at = (b, r, c) => b?.row === r && b?.col === c
  const inCell = all.filter((b) => at(b, row, col))
  const mine = inCell.some(is)
  /* Where the read has the block, the first place it lists it: only asked where the cell does not hold it, so it is somewhere else. */
  const elsewhere = all.find(is) || null
  if (!inCell.length) return { kind: 'empty', put: elsewhere, stayed: !!(elsewhere && was && at(elsewhere, was.row, was.col)) }
  if (!mine && elsewhere) return { kind: 'other', put: elsewhere }
  /* Gone from where it was (which, for a block put back where it already sat, it is not). */
  const left = !!was && !all.some((b) => is(b) && at(b, was.row, was.col))
  return { kind: mine && left ? 'moved' : 'added', put: null }
}

/** Whether what was said for the cell "row:col" (`key`) belongs under the run of empty spaces from `col` to `last` in `row`: a cell that has just been emptied joins the run beside it, which is drawn as one button named by its FIRST column. */
export const saidInRun = (key, row, col, last) => {
  const [r, c] = String(key || '').split(':').map(Number)
  return Number.isInteger(r) && Number.isInteger(c) && r === row && c >= col && c <= last
}

/** What the log says of an Add that sent nothing. */
export const NOT_SENT = 'not sent: no free space after it in this row'
