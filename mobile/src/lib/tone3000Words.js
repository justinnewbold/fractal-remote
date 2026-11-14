/*
 * WHAT THE TONE3000 PAGE SAYS ABOUT ITS TWO BUTTONS, which depends on where
 * it was opened from. No phone and no screen in here: a test reads these as
 * they are.
 *
 * ON ITS OWN PAGE (Developer → TONE3000) Preview plays a capture in NAM 1
 * and Get leaves what is playing alone.
 *
 * FROM A HELD NAM BLOCK (`held`, with `n` the block's number): "if they hold
 * a nam block it pulls up the quick edit screen on top of it have it say
 * tone 3000 where they can click on it and browse tones preview them and
 * then download them directly and then it'll take them back to that screen
 * so it's very streamlined" (Justin, 14 November 2026). There Preview plays
 * in THAT block, and Get is the end of the errand: the capture goes on the
 * unit, the block plays it, and the page gives way to the block's knobs,
 * but only once the block has said it is playing it, which the words allow
 * for ("once NAM 2 is playing it"): a Get that fails stays on the page.
 *
 * Either way the capture goes into one of the unit's capture slots and
 * stays there: an Axe-Fx III plays nothing else. No sentence here says a
 * preview is not kept.
 */

/** A NAM block by its number, as the unit and the app name it. */
export const namBlockSaid = (n) => `NAM ${n === 2 ? 2 : 1}`

/** What to do, in order: the page's steps, behind its ⓘ. */
export function stepsFor({ n = 1, held = false } = {}) {
  const nam = namBlockSaid(n)
  return Object.freeze([
    'Search here, or pick an order and a kind of gear. Only tones the Axe-Fx III’s NAM block can play are listed. Tap one to see its captures.',
    held
      ? `Each capture has two buttons. Preview puts it on the Axe-Fx III and plays it in ${nam}, so you hear it through your own rig. Get does the same and, once ${nam} is playing it, takes you back to its knobs.`
      : `Each capture has two buttons. Preview puts it on the Axe-Fx III and plays it in ${nam}, so you hear it through your own rig. Get puts it on the unit and leaves what you are playing alone.`,
    'Either way it goes into the unit’s first empty capture slot and stays there: the Axe-Fx III can only play a capture that is in a slot. It takes about half a minute over Bluetooth, a second or two through the computer or by USB.',
    'Browse TONE3000 opens TONE3000’s own page, which has play buttons: what you hear there is its own demo recording, not your rig.'
  ])
}

/** Under the steps: what has to be true of the preset, and what is and is not saved. */
export const stepsFoot = ({ n = 1, held = false } = {}) =>
  held
    ? `Which capture ${namBlockSaid(n)} plays is not saved until you save the preset, and a capture already on the unit is never written over.`
    : 'For Preview, the preset you are on needs NAM 1 in it (with only NAM 2 there, Play it in NAM 2 is under the capture once it is on the unit). Which NAM block plays a capture is not saved until you save the preset, and a capture already on the unit is never written over.'

/** On the view itself, over a tone's captures: on this unit a preview is kept. */
export const capturesNote = ({ n = 1, held = false } = {}) =>
  held
    ? `Preview puts the capture in an empty slot on the unit and plays it in ${namBlockSaid(n)}. Get does the same and, once ${namBlockSaid(n)} is playing it, takes you back to its knobs. Either way it stays on the unit.`
    : `Preview and Get both put the capture in an empty slot on the unit, and it stays there. Preview also plays it in ${namBlockSaid(n)}.`

/** What a screen reader says of Preview on a capture's line. */
export const previewSays = (name, n = 1) => `Preview ${name}: puts it on the Axe-Fx III and plays it in ${namBlockSaid(n)}`

/** And of Get. */
export const getSays = (name, { n = 1, held = false } = {}) => (held ? `Get ${name}: puts it on the Axe-Fx III, plays it in ${namBlockSaid(n)} and goes back to its knobs` : `Get ${name}: puts it on the Axe-Fx III`)

/*
 * THE WAY IN FROM A HELD NAM BLOCK, and the way back.
 */
/** The button over the block's knobs. TONE3000's name as it writes it (its rule for a way in). */
export const T3K_QUICK = 'TONE3000'
export const quickSub = (n) => `Browse captures, preview them, and get one for ${namBlockSaid(n)}`
/** Over the page, while it is up in the block's pop-up. */
export const backToKnobs = (n) => `‹ Back to ${namBlockSaid(n)}’s knobs`
/** Under a capture that is already on the unit, there: hear it again, or take it and go back. */
export const USE_AND_BACK = 'Use it and go back'
export const useAndBackSub = (n) => `Plays it in ${namBlockSaid(n)} and returns to its knobs`
