/**
 * The number under a knob while it is being typed, and how much of it is
 * selected, as pure functions.
 *
 * "We need to make it so in tapping on one of the numbers it highlights it so
 * that you can just quickly type -3 or whatever number without having to go
 * to the back and delete it and then retype" (13 November 2026, on a NAM
 * block's knobs, an iPhone).
 *
 * The box asked for that with `selectTextOnFocus` and an iPhone never gave
 * it, for two reasons read in mobile/node_modules/react-native (0.86):
 *
 *   - On an iPhone `selectTextOnFocus` acts only on a focus asked for from
 *     the code (RCTTextInputComponentView `-focus`). A thumb's tap comes in
 *     through `textInputDidBeginEditing`, which selects nothing: the caret
 *     goes where the thumb landed.
 *   - The box swaps its text as it takes focus ("-3.00 dB" becomes "-3", so
 *     the unit is not in the way), and text that arrives from the code into a
 *     focused field keeps the caret where it stood from the END. So even a
 *     selection made in time was collapsed by the swap.
 *
 * So, as the tempo box does (lib/tempo-field, which has the long version),
 * the box hands TextInput a `selection` of the whole number, in the same
 * frame as the swapped text: TextInput sends the two down together
 * (setTextAndSelection), which both phones honour.
 *
 * It is held only until the player takes over: the first keystroke ends it
 * (a digit typed over a selection replaces the whole number, Backspace
 * empties the box), and so does a move of the cursor that is the player's
 * own, or a thumb could never put the cursor anywhere.
 *
 * Telling the player's move from the phone's. The tap that opens the box
 * puts a caret down too, and that one is the phone's: the hold puts the
 * selection back. Android reports every selection, the one the box asked for
 * among them, so there a caret after the whole number was `seen` selected is
 * a finger's. An iPhone never reports a selection the code made, so there it
 * goes by the clock: a caret in the box's first moments (`SETTLE_MS`) is the
 * tap that opened it, and one after that is a finger's.
 *
 * Nothing in this file imports anything, so the test suite can call it.
 */

/** How long after the box opens a caret is still taken for the tap that opened it. */
export const SETTLE_MS = 400

/** What the box opens on: the value to two places and no unit, so typing replaces "6.70 dB" rather than adding to it. */
export const plainNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '')

/** A box just tapped: its number in it, the selection held on the whole of it. */
export const openField = (value, now) => {
  const text = plainNumber(value)
  return { typed: text, from: text, held: true, seen: false, at: now }
}

/** The selection the box asks TextInput for: all of it while held, the player's own after. */
export const fieldSelection = (field) => (field && field.held && field.typed ? { start: 0, end: field.typed.length } : undefined)

/** A keystroke. The number is the player's from here, and so is the cursor. */
export const fieldTyped = (field, text) => (field ? { ...field, typed: String(text ?? ''), held: false } : field)

/** The phone saying where the selection is now. */
export function fieldSelectionMoved(field, selection, now) {
  if (!field || !field.held) return field
  const whole = !!selection && selection.start === 0 && selection.end === field.typed.length
  if (whole) return field.seen ? field : { ...field, seen: true }
  /* Seen whole on the phone and now not, or long after the tap that opened it: a finger. Otherwise the phone's own caret. */
  return field.seen || now - field.at >= SETTLE_MS ? { ...field, held: false } : field
}

/**
 * What the box writes when it is left: the number typed, or null for nothing.
 *
 * An emptied box writes nothing. It used to write 0 (an empty string is the
 * number 0 to JavaScript), which with the whole number selected is one
 * Backspace and a tap elsewhere away from a knob at zero. And a box that was
 * tapped and left as it opened writes nothing either: it opens on the value
 * rounded to two places, and leaving it used to send that rounding to the
 * unit as if it had been typed.
 */
export function fieldNumber(field) {
  if (!field) return null
  if (field.typed === field.from) return null
  const t = String(field.typed).replace(',', '.').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
