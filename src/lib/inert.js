/**
 * ONE PART OF THE PAGE, SEVERAL REASONS TO SHUT IT, AND IT OPENS ONLY WHEN THE
 * LAST OF THEM GOES.
 *
 * Two things shut part of the page. A sheet over the screen makes the app
 * under it inert (components/Sheet), and the startup card makes everything
 * but itself inert (components/IndependentNotice). Each used to set `inert`
 * and clear it again on its own, so whichever went first opened the page for
 * the other: a sheet that closed while the card was up gave the keyboard the
 * app behind the card, and OK on the card gave it the app behind a sheet that
 * was still open.
 *
 * So each takes a hold, and gives it back, and an element stays inert for as
 * long as anybody holds it. What it was before the first hold (inert in the
 * markup, say, or shut by something that never asked here) is what it goes
 * back to after the last.
 *
 * Returns what gives this hold back. Giving it back twice is giving it back
 * once.
 */
const holds = new WeakMap()

export function holdInert(el) {
  if (!el) return () => {}
  const held = holds.get(el)
  if (held) held.count += 1
  else holds.set(el, { count: 1, before: Boolean(el.inert) })
  el.inert = true
  let given = false
  return () => {
    if (given) return
    given = true
    const now = holds.get(el)
    if (!now || --now.count > 0) return
    holds.delete(el)
    el.inert = now.before
  }
}
