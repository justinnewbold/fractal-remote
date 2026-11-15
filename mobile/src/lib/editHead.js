/*
 * THE HEAD OF EDIT: the title on the left, and on the right the magnifier,
 * More, the Save button and Done.
 *
 * "Edit (Beta)" came out one letter to a line (Justin's picture of 15
 * November 2026, a 375-point window with Confirm changes showing). The Save
 * button is 62 points wide as "Save" and about 157 as "Confirm changes", the
 * four buttons then want 331 of the row's 343, and the title's side used to
 * get whatever was left.
 *
 * THREE RULES, AND THE ORDER THEY MATTER IN.
 *
 * 1. NOTHING ELSE CAN EVER STAND WHERE DONE IS. The first cut of this let
 *    all four buttons wrap onto a second row, and a reader found what that
 *    did: the row filled from the left, so on a small phone "Confirm
 *    changes" took the top right corner, where Done had been a moment
 *    before. A thumb going for Done would have written over the preset. The
 *    second cut wrapped them upwards instead, and a second reader found the
 *    same thing at a larger system text size, by another road (the wrapped
 *    block is centred, so Confirm changes came up under Done's old place).
 *    So it is not left to arithmetic: Done is not IN the group that wraps
 *    (Edit.js `HEAD_SIDE` holds that group and then Done, and does not
 *    wrap). Whatever the other three do, Done has a column to itself.
 * 2. CONFIRM CHANGES IS WHERE SAVE WAS. While the save is asked about or
 *    going (`saveBusy`), on a row too narrow for all four beside a readable
 *    title, the magnifier and More step aside (`headTucked`), and Confirm
 *    changes grows leftwards from where Save stood, under the thumb that
 *    tapped it, with its right edge where Save's was. They come back when
 *    the save is over or put down, and not before: a save left asked about
 *    keeps them away, and a search box that was open stays open (picking a
 *    result closes it).
 * 3. THE TITLE'S SIDE takes what the right side leaves and never less than
 *    72 points, which its two words fit in at the standard text size
 *    (Edit.js `HEAD_TITLE`). If that is still too much, the three buttons
 *    that may wrap do, upwards: the Save button takes the upper line, the
 *    magnifier and More the lower, and Done stands centred beside the two.
 *
 * What is NOT promised, and a third reader measured (a button modelled with
 * its word in it, where the author's model had given it a fixed width):
 * - that nothing moves up or down when the title's lines or the buttons'
 *   lines change (the row is centred);
 * - that Confirm changes is whole. The group gives way before the title's
 *   floor does, so where the row cannot hold the title, Confirm changes
 *   and Done, the button's one-line label is CUT SHORT ("Confirm chan…"):
 *   on a 320-point window at any text size, on a 375-point one from about
 *   the second size above standard. The warning under the head stays whole;
 * - that the title is whole at large text: "(Beta)" outgrows 72 points at
 *   about one and a half times the text size;
 * - anything by the text size at all: `HEAD_ROOM` is worked out at the
 *   standard size, so a wide row (an iPad) at a large one keeps all four
 *   buttons, wraps them and squeezes the title to its floor.
 * A head of two lines at large text sizes would mend all four, and is a
 * change to see before it is made. What IS promised is rule 1, at every
 * width and text size either reader tried: where Done was there is Done or
 * nothing.
 *
 * The rule is here, with no screen in it, so a test can run it.
 */

/**
 * The widest row (in points) that cannot hold all four buttons with Confirm
 * changes showing beside a title on one line: 40 + 40 + 157 + 70 and three
 * gaps of 8 is 331, a gap of 12, and about 104 for "Edit (Beta)". Every
 * phone held upright is under it (a 440-point window has a 408-point row);
 * an iPad, and a half of one in Split View, is over.
 */
export const HEAD_ROOM = 448

/** Whether the magnifier and More step aside: only while a save is asked about or going, and only on a row measured and found narrow. */
export const headTucked = (rowWide, saveBusy) => !!saveBusy && Number.isFinite(rowWide) && rowWide > 0 && rowWide < HEAD_ROOM
