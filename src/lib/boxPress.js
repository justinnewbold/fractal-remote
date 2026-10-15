/**
 * A PRESS INSIDE A BOX WHOSE FIELD SETS WHAT WAS TYPED WHEN IT LOSES FOCUS —
 * the Tap box (TapTempo), which holds the metronome switch under its tempo.
 *
 * "Also, can we add the metronome on and off to this screen as well so they
 * can quickly turn the metronome on and off?" The field (BpmBox) sets its
 * tempo on blur, so a press on the switch below it used to send whatever was
 * in the field and shut the box before the switch was reached.
 *
 * Two guards, because browsers disagree about who gets focus on a press:
 *
 * - The mouse-down on anything but the field is stopped from taking focus off
 *   it at all. That is a computer, and Chrome on a phone.
 * - If the field loses focus anyway — Safari on an iPhone can, with nothing
 *   to hand it to — `keepOpen` tells BpmBox the blur was the box's own, and
 *   the number stays where it is, unsent. From the press going down until
 *   its click has done its work: on an iPhone the blur comes between the two.
 *
 * Over at the click (just after it, so the press's own blur is still covered),
 * at a key, or when the press turns into a scroll and no click is coming: a
 * flag left up there would keep the keyboard's Done from setting the tempo.
 * A blur after that is judged on its own, and sets as it always did.
 *
 * `group` is the box's selector, for focus moved by Tab onto something else
 * in it. Takes nothing it could call: no press in the box can reach a write
 * of the tempo through here. No imports, so the tests load it as it is.
 */
export function boxPresses(group) {
  let pressing = false
  const field = (e) => e.target?.tagName === 'INPUT'
  const handlers = {
    onPointerDown: (e) => {
      pressing = !field(e)
    },
    onMouseDown: (e) => {
      if (!field(e)) e.preventDefault()
    },
    onPointerCancel: () => {
      pressing = false
    },
    onClickCapture: () => {
      setTimeout(() => (pressing = false), 0)
    },
    onKeyDown: () => {
      pressing = false
    }
  }
  const keepOpen = (e) => pressing || !!(e.relatedTarget && e.currentTarget?.closest(group)?.contains(e.relatedTarget))
  return { handlers, keepOpen }
}
