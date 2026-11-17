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
 * FROM THE CAPTURE LIST OF A NAM BLOCK IN EDIT (`held` with `back:
 * 'captures'`): "Also want it on the capture screen when I can they see the
 * ones they've already downloaded but then they can also click tone 3000
 * from that and it pulls up and they can browse preview and do it that way
 * as well" (the same day). The same two buttons; what Get goes back to is
 * the captures on the unit, with the new one among them.
 *
 * Either way the capture goes into one of the unit's capture slots and
 * stays there: an Axe-Fx III plays nothing else. No sentence here says a
 * preview is not kept.
 *
 * FROM A HELD BLOCK EVERY CAPTURE HAS THE SAME TWO BUTTONS, on the unit
 * already or not, since 17 November 2026: "what's the difference between
 * get it and use it and go back? Little confusing. If I click each of
 * those, would it do the same thing?" A capture already on the unit had
 * traded Preview and Get for "Play it in NAM 2" and "Use it and go back",
 * which were the same two things with nothing to send. So the note over
 * the captures says what the two buttons do in one plain sentence each,
 * and where the capture is already there the buttons say only that
 * (`there`).
 *
 * AND A BLOCK THAT IS OFF IS SWITCHED ON TO BE HEARD (the same day: "need
 * to make sure that it turns it on automatically to listen"), in the scene
 * the unit is on. The note and the steps say so; lib/namPlaying has the
 * rule, and the line that says it happened.
 */

/** Where Get goes back to from a held page: the block's knobs (Play's pop-up), or the list of captures on the unit (Edit's). */
const backPlace = (back) => (back === 'captures' ? 'the captures on the unit' : 'its knobs')

/** A NAM block by its number, as the unit and the app name it. */
export const namBlockSaid = (n) => `NAM ${n === 2 ? 2 : 1}`

/**
 * WHETHER TONE3000'S OWN CATALOG PAGE IS OFFERED from the app's list
 * ("Browse TONE3000", which opens its website's pick-a-tone page). Off:
 * "I don't want it to access their web browser directly through our app. I
 * wanna use the API." (Justin, 14 November 2026.) The list, the search, a
 * tone's captures, Preview and Get are all the app's own, over TONE3000's
 * API. The one page of TONE3000's a player still meets is its sign-in (an
 * email, then a code), once: its API gives an app no other way to sign
 * somebody in.
 *
 * TONE3000's written Design Requirements ask for "a clear, persistent path
 * to browse the full TONE3000 catalog via the Select flow". If they hold
 * him to that when they sign the screens off, this is the one word to
 * change: the button, and every sentence that names it, come back with it.
 */
export const T3K_CATALOG_PAGE = false

/** The head of the card a capture gets once it is on the unit: said only where the unit has named the slot as holding it. */
export const ON_UNIT = 'On your Axe-Fx III'
/** The same where the unit took it and has not said what the slot holds. */
export const SENT_TO_UNIT = 'Sent to your Axe-Fx III'
/**
 * The heads of the same card while a capture is on its way, and when it did
 * not get there: after a tap on Preview or Get the capture's own line says
 * what is becoming of it at every moment, in words nobody can miss.
 */
export const GETTING_CAPTURE = 'Getting it from TONE3000…'
/*
 * WHILE AN EMPTY SLOT IS LOOKED FOR. Over an adapter the unit is asked a
 * slot at a time, a quarter of a second each, and his has thirty-odd
 * captures before the first empty one: ten seconds in which the card said
 * one unchanging line (15 November 2026). So it says which slot it is at,
 * and when a slot that said nothing is being asked again. Through a
 * computer the search is one answer and only the first line is ever seen.
 */
export const LOOKING_FOR_SLOT = 'Looking for an empty slot on the unit…'
export const lookingForSlot = (slotSaid, again = 1) =>
  again > 1 ? `Looking for an empty slot on the unit… slot ${slotSaid} didn’t answer, asking it again` : `Looking for an empty slot on the unit… checking slot ${slotSaid}`
export const SENDING_TO_UNIT = 'Sending to your Axe-Fx III…'
export const NOT_ON_UNIT = 'Not on your Axe-Fx III'
/** The card's second line: which slot, and the capture's name. */
export const onUnitLine = (slotSaid, name) => `Slot ${slotSaid}${name ? ` · ${name}` : ''}`

/** What to do, in order: the page's steps, behind its ⓘ. */
export function stepsFor({ n = 1, held = false, back = 'knobs' } = {}) {
  const nam = namBlockSaid(n)
  return Object.freeze([
    'Search here, or pick an order and a kind of gear. Only tones the Axe-Fx III’s NAM block can play are listed. Tap one to see its captures.',
    held
      ? `Each capture has two buttons. Preview puts it on the Axe-Fx III and plays it in ${nam}, so you hear it through your own rig. Get does the same and, once ${nam} is playing it, takes you back to ${backPlace(back)}.`
      : `Each capture has two buttons. Preview puts it on the Axe-Fx III and plays it in ${nam}, so you hear it through your own rig. Get puts it on the unit and leaves what you are playing alone.`,
    'Either way it goes into the unit’s first empty capture slot and stays there: the Axe-Fx III can only play a capture that is in a slot. It takes about half a minute over Bluetooth, a second or two through the computer or by USB.',
    held
      ? `A capture already on the unit is not sent again: Preview and Get play it where it is. If ${nam} is switched off in the scene you are on, it is switched on so you hear the capture.`
      : 'A NAM block that is switched off in the scene you are on is switched on when a capture is played in it, so you hear it.',
    ...(T3K_CATALOG_PAGE ? ['Browse TONE3000 opens TONE3000’s own page, which has play buttons: what you hear there is its own demo recording, not your rig.'] : [])
  ])
}

/** Under the steps: what has to be true of the preset, and what is and is not saved. */
export const stepsFoot = ({ n = 1, held = false } = {}) =>
  held
    ? `Which capture ${namBlockSaid(n)} plays, and its being switched on, are not saved until you save the preset. A capture already on the unit is never written over.`
    : 'For Preview, the preset you are on needs NAM 1 in it (with only NAM 2 there, Play it in NAM 2 is under the capture once it is on the unit). Which NAM block plays a capture is not saved until you save the preset, and a capture already on the unit is never written over.'

/** On the view itself, over a tone's captures: on this unit a preview is kept. */
export const capturesNote = ({ n = 1, held = false, back = 'knobs' } = {}) =>
  held
    ? `Preview plays a capture in ${namBlockSaid(n)}, so you hear it through your own rig. Get does the same and takes you back to ${backPlace(back)}. Either way the capture goes on the unit and stays there. If ${namBlockSaid(n)} is switched off in the scene you are on, it is switched on so you hear it.`
    : `Preview and Get both put the capture in an empty slot on the unit, and it stays there. Preview also plays it in ${namBlockSaid(n)}.`

/** What a screen reader says of Preview on a capture's line. `there`: the capture is on the unit already, so nothing is put there. */
export const previewSays = (name, n = 1, there = false) => (there === true ? `Preview ${name}: plays it in ${namBlockSaid(n)}` : `Preview ${name}: puts it on the Axe-Fx III and plays it in ${namBlockSaid(n)}`)

/** And of Get. From a held block, with the capture on the unit already (`there`), it plays it and goes back. */
export const getSays = (name, { n = 1, held = false, back = 'knobs', there = false } = {}) =>
  !held ? `Get ${name}: puts it on the Axe-Fx III` : there === true ? `Get ${name}: plays it in ${namBlockSaid(n)} and goes back to ${backPlace(back)}` : `Get ${name}: puts it on the Axe-Fx III, plays it in ${namBlockSaid(n)} and goes back to ${backPlace(back)}`

/*
 * THE WAY IN FROM A HELD NAM BLOCK, and the way back.
 */
/** The button over the block's knobs. TONE3000's name as it writes it (its rule for a way in). */
export const T3K_QUICK = 'TONE3000'
export const quickSub = (n) => `Browse captures, preview them, and get one for ${namBlockSaid(n)}`
/** Over the page, while it is up in the block's pop-up, or in the capture list's sheet. */
export const backToKnobs = (n) => `‹ Back to ${namBlockSaid(n)}’s knobs`
export const BACK_TO_CAPTURES = '‹ Back to the captures on the unit'

/*
 * SIGNING OUT OF TONE3000, IN SETTINGS (17 November 2026, for the store
 * version that opens TONE3000 to everybody; Apple's 5.1.1(v)). A row of its
 * own, drawn only while a TONE3000 sign-in is kept on the device, that says
 * whose it is where TONE3000 has said, and signs out after asking once.
 * What goes is the app's TONE3000 sign-in; the captures already put on the
 * unit stay on the unit, and the sentence says so, since that is the first
 * thing a player would wonder.
 */
export const T3K_ROW_TITLE = 'TONE3000'
/** The row's one line: whose sign-in it is, where TONE3000 has named it, and what a tap does. */
export const t3kRowLine = (name) => (name ? `Signed in as @${name} · tap to sign out` : 'Signed in · tap to sign out')
export const T3K_SIGN_OUT_ASK = 'Sign out of TONE3000?'
export const t3kSignOutBody = (name) =>
  `Fractal Remote forgets ${name ? `the TONE3000 sign-in of @${name}` : 'your TONE3000 sign-in'}. The captures already on your unit stay there. To get more, you sign in to TONE3000 again.`
export const T3K_SIGN_OUT = 'Sign out'
export const T3K_KEEP = 'Cancel'
export const T3K_SIGN_OUT_FAILED = 'TONE3000’s sign-in couldn’t be removed just now. Try again.'
