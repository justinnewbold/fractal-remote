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

/**
 * In the list's place, where nothing can be added after the card. `more` is
 * whether a block after it could be taken out to make room; `linear` is a
 * unit with one row of slots (an AM4), which has no other row to point at.
 */
export const noRoomAfter = ({ name, linear = false, more = false }) =>
  linear
    ? `There is no free slot after ${name}. Remove a block first.`
    : more
      ? `This row is full after ${name}, so a block can’t be added here. Remove a block after it first, or use “${EMPTY_SPACE}”, under the chain, to add one where there is room.`
      : `There is no room after ${name} in its row, so a block can’t be added here. Use “${EMPTY_SPACE}”, under the chain, to add one where there is room.`

/** Under the card, once the unit holds the new block: the answer to the button just pressed, with a tick. */
export const addedWords = (name, at) => `✓ Added ${name} at ${at}.`

/** What the log says of an Add that sent nothing. */
export const NOT_SENT = 'not sent: no free space after it in this row'
