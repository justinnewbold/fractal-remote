/*
 * THE HANDLE ON THE LINE BETWEEN THE TWO SIDES: swap, resize, let go.
 *
 * "A handle on the line between the halves: tap it to swap, drag it to
 * resize, drag it to the edge for full screen" (offered 10 November 2026;
 * Justin: "yes to all your other non build suggestions"). On a big screen
 * with two sides up, the line between them has a small handle on it:
 *
 *   tap         swaps the two sides (the top bar's Swap, which goes away
 *               where the handle is: one Swap, on the line).
 *   drag        moves the line. Neither side goes under SIDE_LEAST, the
 *               least a side may ever be (lib/twoSides).
 *   drag past   SPLIT_LETS_GO beyond a side's least, and that side lets go:
 *               the other fills the window, as the tool's Full screen or
 *               its Done would have done.
 *   two taps    put the line back where the window has it by itself.
 *
 * WHERE THE LINE MAY NOT MOVE. On the iPhone Duo the line is the fold
 * (lib/twoSides splitSides: the window's middle, off the frame's middle by
 * half the clock strip), and a side's edge must never sit off the crease,
 * so there the handle swaps and nothing else. And the tuner's narrow column
 * on an iPad keeps its own width. A phone held on its side has no handle
 * at all: its sides are both at their least already.
 *
 * WHAT IS KEPT is Play's share of the window (lib/sidesKeep), so a swap
 * leaves Play as wide as it was. Turning the device puts the line back.
 *
 * Nothing here imports anything, so the tests run it as it is. The numbers
 * that are lib/twoSides' own are handed in (`least`, `narrowAt`).
 */

/** How far past a side's least the line is dragged before that side lets go. */
export const SPLIT_LETS_GO = 80
/** The least room the line needs to move in before a resize is worth offering. */
export const SPLIT_ROOM = 40
/** A press that moved less than this is a tap. */
export const HANDLE_TAP = 6
/** Two taps this close together put the line back. */
export const HANDLE_TWICE_MS = 350
/** How far one step moves the line for a screen reader's adjust. */
export const SPLIT_STEP = 40

const num = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0)

/** Whether the line between the sides is a fold: the phone keeps more down one side than the other (the Duo's strip), so the window's middle is not the frame's. */
export const foldHere = ({ left = 0, right = 0 } = {}) => Math.abs(num(left) - num(right)) > 0.5

/**
 * Whether the handle is drawn: an account it is open to (`allowed`), a big
 * screen (`big`, lib/twoSides twoSidesOn; never a phone on its side), and a
 * tool beside Play, not filling the window.
 */
export const handleOn = ({ allowed = false, big = false, tool = null, full = false } = {}) => allowed === true && big === true && Boolean(tool) && full !== true

/**
 * Whether the line may be dragged in a frame `width` across: not on a fold,
 * not the tuner's narrow column (`tool` 'tuner' from `narrowAt`), and only
 * with room to move between the two leasts.
 */
export function resizeOn({ width = 0, left = 0, right = 0, tool = null, least = 360, narrowAt = 1000 } = {}) {
  const w = num(width)
  if (!w || !tool) return false
  if (foldHere({ left, right })) return false
  if (tool === 'tuner' && w >= narrowAt) return false
  return w - 2 * least >= SPLIT_ROOM
}

/**
 * Play's share of a frame `width` across, held so that neither side is
 * under `least`; null for no share kept, one that is not a number, or a
 * frame with no room for one.
 */
export function clampShare(share, width, least = 360) {
  const w = num(width)
  const s = Number(share)
  if (!w || !Number.isFinite(s) || s <= 0 || s >= 1) return null
  if (w - 2 * least < 0) return null
  const play = Math.min(w - least, Math.max(least, Math.round(w * s)))
  return play / w
}

/**
 * Where a drag that ends with the line `x` points from the frame's left
 * edge leaves the two sides: `lets` is the side that let go ('play' or
 * 'tool', its edge dragged SPLIT_LETS_GO past its least) or null, and
 * `share` Play's share of the window otherwise, held at the leasts.
 */
export function dragEnds({ width = 0, x = 0, playOnRight = true, least = 360 } = {}) {
  const w = num(width)
  if (!w) return { lets: null, share: null }
  const at = Math.max(0, Math.min(w, Number(x) || 0))
  /* The side on the left is the tool's with Play on the right, and Play's otherwise. */
  const leftIs = playOnRight ? 'tool' : 'play'
  const rightIs = playOnRight ? 'play' : 'tool'
  if (at < least - SPLIT_LETS_GO) return { lets: leftIs, share: null }
  if (at > w - least + SPLIT_LETS_GO) return { lets: rightIs, share: null }
  const line = Math.min(w - least, Math.max(least, at))
  const play = playOnRight ? w - line : line
  return { lets: null, share: clampShare(play / w, w, least) }
}

/** How far the line may be drawn from where it is while a finger has it: anywhere in the frame, so letting go can be seen coming. */
export const dragHolds = ({ width = 0, line = 0, dx = 0 } = {}) => Math.max(0, Math.min(num(width), num(line) + (Number(dx) || 0))) - num(line)

/** Whether a line `x` points along a frame `width` across is past where a side lets go, for the handle to say so while it is held: 'left' | 'right' | null. */
export function dragLetsGo({ width = 0, x = 0, least = 360 } = {}) {
  const w = num(width)
  if (!w) return null
  if (x < least - SPLIT_LETS_GO) return 'left'
  if (x > w - least + SPLIT_LETS_GO) return 'right'
  return null
}
