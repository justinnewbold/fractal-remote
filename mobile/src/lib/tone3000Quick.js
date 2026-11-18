/*
 * WHERE TONE3000 IS OFFERED IN PLAY'S HOLD POP-UP. Pure: a test runs it.
 *
 * "One is if they hold a nam block it pulls up the quick edit screen on top
 * of it have it say tone 3000" (Justin, 14 November 2026: "I want it in the
 * app in a few places"). It is also where TONE3000 asks an app to put its
 * way in: "associated with adding a tone to a signal block" (its Design
 * Requirements).
 *
 * ONLY ON A NAM BLOCK: the one kind of block that plays a capture, which
 * only an Axe-Fx III has. Told by the block's own family (the name the
 * app's catalog files it under) AND its effect id, the two the capture
 * tools themselves take (lib/nam-install NAM_BLOCKS), so a block of another
 * unit that happens to share a number is never offered it.
 *
 * HIS ACCOUNT FIRST (`allowed`: lib/useTone3000Quick, features
 * TONE3000_QUICK_FOR_EVERYONE). Closed to an account, the pop-up it gets is
 * exactly the one it had.
 */
import { namBlocksOf, onAm4 } from './captureUnit.js'

/**
 * Whether the pop-up for `block` (whose effect id is `id`) offers TONE3000. Every part has to be exactly right.
 * An AM4's NAM block too (lib/am4-nam, firmware 3.00): the wire names it only for an account its switch is open to
 * (lib/features AM4_NAM_FOR_EVERYONE, his account until then), so a block that is here with that id is one of theirs.
 */
export const tone3000QuickFor = (allowed, block, id) => allowed === true && !!block && block.slug === 'nam' && !!namBlocksOf(id)

/** Which NAM block that is, 1 or 2, or 0 for a block that is neither. */
export const namNumber = (id) => (namBlocksOf(id) || []).indexOf(id) + 1

/**
 * The block to offer TONE3000 on in a pop-up: the one whose knobs are up ("the quick edit screen"), or, with no
 * knobs up, an AM4's NAM block, which has none in the app yet and would otherwise have no way in at all.
 */
export const doorBlock = (withKnobs, block, id) => (withKnobs ? block : block && block.knobs === false && onAm4(id) ? block : null)
