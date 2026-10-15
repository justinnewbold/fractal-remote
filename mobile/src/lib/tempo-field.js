/**
 * The tempo box's number, and how much of it is selected, as pure functions.
 *
 * "On the tap tempo button where you hold it down and it pops up to enter the
 * tempo, make it so it highlights it so that they can just start typing.
 * Right now they have to hit the back button to delete the tempo to reenter
 * it, so we wanna make it so it can be done quickly."
 *
 * The box asked for exactly that and never got it. It had `autoFocus` and
 * `selectTextOnFocus`, and the number was put in by an effect AFTER the box
 * had opened — so the field took focus while it was still empty, and the 120
 * arrived a moment later with the cursor parked behind it. Two things in React
 * Native 0.86 made sure of it, both read in mobile/node_modules/react-native:
 *
 *   - On iPhone, `selectTextOnFocus` only acts on a focus asked for from the
 *     code (`focus()`, RCTTextInputComponentView `-focus`). `autoFocus` comes
 *     in through `-didMoveToWindow`, which calls becomeFirstResponder and
 *     never selects anything.
 *   - On both, text that arrives from the code into a focused field keeps the
 *     cursor where it stood from the END (`_setAttributedString` on iPhone,
 *     `updateExtraData` on Android). Empty, then "120", is a cursor after 120.
 *
 * So the number is there from the first frame, and the selection is not
 * left to `selectTextOnFocus` alone: the box hands TextInput a `selection` of
 * the whole number. That is the one route both platforms honour in this
 * version. TextInput sends it down with setTextAndSelection whenever what the
 * phone last reported differs from it, and the iPhone puts it back again
 * itself when the field arrives on screen (`_restoreTextSelection`). A phone
 * that drops the cursor at the end as the keyboard comes up is simply told
 * again.
 *
 * It is held only until the player takes over. The first keystroke ends it —
 * a digit typed over a selection replaces the whole number, and Backspace
 * empties the box — and so does the first move of the cursor that is the
 * player's own. Held for ever, a thumb could never put the cursor anywhere.
 *
 * Telling the player's move from the phone's. Until the box knows the whole
 * number is selected on the phone itself, a caret is the phone placing one —
 * as the field takes focus (an iPhone puts it at the end), or as a new number
 * from the unit goes in under it — and the hold puts the selection back. Once
 * it knows, a different selection can only have come from a finger, and the
 * cursor is the player's.
 *
 * It knows in one of two ways, because the two phones do not say the same
 * things. Android reports every selection, including the one the box asked
 * for, so there it is `seen`: this number, reported selected whole. An iPhone
 * in 0.86 never reports a selection the code made — `_restoreTextSelection`,
 * the TextInput's own selection and `setSelection` all go round the one
 * setter that tells JavaScript (RCTUITextField `setSelectedTextRange:`) — so
 * there it would never be seen, and every tap in the number would snap back
 * to the whole of it. So there is `shown` as well: the box selected the whole
 * number itself once it was up (onShow, in TempoBox). From then on the phone
 * holds it whole whatever comes in: TextInput sends the selection down WITH
 * every new number while the hold is on, in the same command
 * (setTextAndSelection), so a tempo that moves under the open box is
 * selected whole the moment it lands.
 *
 * Nothing in this file imports anything, so the test suite can call it.
 */

/** A box just opened: nothing typed, the selection held on the whole number, not yet seen or selected by hand. */
export const freshField = () => ({ typed: null, held: true, seen: null, shown: false })

/**
 * What the box shows: what was typed, or else the tempo the unit is at.
 *
 * Nothing typed is null rather than the number, so the box follows the unit
 * until it is touched. A tap's read-back can land just after the hold opens
 * the box; a copy taken at the moment it opened would then sit there stale,
 * and Set would send that stale number back to the unit.
 */
export const shownText = (field, bpm) => field.typed ?? (Number.isFinite(bpm) ? String(Math.round(bpm)) : '')

/** The selection the box asks TextInput for: all of it while held, the player's own after. */
export const heldSelection = (field, text) => (field.held && text ? { start: 0, end: text.length } : undefined)

/** A keystroke. The number is the player's from here, and so is the cursor. */
export const typedInto = (field, text) => ({ ...field, typed: String(text ?? '').replace(/[^0-9]/g, ''), held: false })

/** The box has selected the whole number itself, once it was up: from here a caret is a finger's (see above). */
export const selectedByHand = (field) => (field.held && !field.shown ? { ...field, shown: true } : field)

/**
 * The phone saying where the selection is now, over `text`, the number on show.
 *
 * `seen` is the number it was last reported selected whole on, not a yes or
 * no: a new number from the unit has not been seen selected yet, however
 * often the old one was. `shown` needs no number, because the selection goes
 * down with each new one.
 */
export function selectionMoved(field, selection, text) {
  if (!field.held) return field
  const whole = !!selection && selection.start === 0 && selection.end === text.length
  if (whole) return field.seen === text ? field : { ...field, seen: text }
  /* Known to be whole on the phone, and now not: a finger. Otherwise the phone's own caret. */
  return field.seen === text || field.shown ? { ...field, held: false } : field
}
