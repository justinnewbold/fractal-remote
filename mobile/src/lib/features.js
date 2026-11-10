/**
 * What this build of the phone app ships with.
 *
 * ONE SWITCH, and it is the bench.
 *
 * There were two. The other was the AI, which shipped `false` from the first
 * release — "For the initial releases I only want to release the stuff related
 * to the live gig pedal board, nothing with the AI or chat changes or things
 * like that" — and it was kept as a switch rather than a deletion because the
 * tone screen worked and was expected back.
 *
 * It is not coming back. The tone designer and the chat are out of all four
 * apps now, so the switch, the screen, lib/tone.js and the play-mode setting
 * that existed only to hide the ✦ Tone button have gone with it. What was
 * built is not lost: the branch feature/ai-builder-preserved holds the whole
 * of it.
 *
 * Nothing about the relay or the allowlist changed with it. A phone was
 * already refused a save to a slot, a backup, a restore and firmware by the
 * host rather than by this app — see shared/relay-rules.mjs — and that is
 * untouched.
 */

/**
 * The bench — the Edit screen — and it is ON.
 *
 * It was off for about twenty minutes, on the strength of "just remove edit for
 * now", and then: "actually just fix the edit screen I actually like it."
 *
 * WHAT WAS ACTUALLY WRONG WAS NOT THE SCREEN. "The knobs just scroll the screen
 * up and down when trying to change them" is a gesture problem, not a missing
 * feature — a knob turns on a vertical drag and lives on a screen that scrolls
 * vertically, and on iOS the scroll view's pan gesture recogniser is NATIVE: it
 * takes the touch back and terminates the drag rather than losing to a
 * JavaScript responder. Switching the screen off would have been hiding a
 * two-line fix behind a feature flag.
 *
 * The fix is `onScrollLock` — see components/Knob, which stops the screen
 * scrolling at the earliest hook there is, the capture phase of the touch,
 * before the scroll view has been asked anything.
 *
 * The switch stays because it is the honest way to take something out if it
 * ever needs taking out again.
 */
export const BENCH = true

/**
 * TWO SIDES ON A BIG SCREEN (lib/twoSides, components/Sides), for everyone.
 *
 * ON since 9 November 2026: "Go ahead and flip the switch though to turn
 * this on for all users" (Justin, the day Apple put 1.90.0 live, with
 * steps 2 and 3 on his own iPad: Edit, Setlists, All presets and the tuner
 * beside Play). It was his account only while it was built in steps ("How
 * do I put these side by side on the iPad?"). It shows only on a window
 * wide enough and wider than tall; every phone held upright is drawn
 * exactly as before. Turned off again, it goes back to his account only.
 */
export const SIDES_FOR_EVERYONE = true

/**
 * HOLD A BLOCK FOR ITS KNOBS (step 4, Derek's panel: lib/twoSides holdGoes,
 * components/BlockSide), for everyone.
 *
 * ON since 10 November 2026: "Activate the other hold for knobs i checked
 * it" (Justin, after trying it on his own iPad). It landed the same hour
 * the two sides opened to everyone, so it was his account only until he
 * had seen it on a screen, as each step before it was. It opens only
 * where the two sides show on a big screen and where Edit opens for the
 * unit and connection (never a VP4); everywhere else a hold is still the
 * channel pop-up. Turned off again, it goes back to his account only.
 */
export const HOLD_KNOBS_FOR_EVERYONE = true

/**
 * A PHONE HELD ON ITS SIDE SPLITS IN TWO (lib/twoSides phoneSidewaysOn,
 * lib/sidewaysPlay), for everyone the two sides are open to.
 *
 * OFF: his account only. "This is the landscape view on iPhone ... let's
 * split the screen in half kind of like the iPhone duo" (Justin, 10
 * November 2026), built from pictures he approved the same day and not yet
 * seen on a phone. Every other account's Play on a phone on its side is
 * what it was. This is the one line that opens it, with its line in What's
 * new in the same pull request.
 */
export const PHONE_SIDEWAYS_FOR_EVERYONE = false

/**
 * THE HOLD POP-UP CARRIES THE BLOCK'S KNOBS, OVER ITS CHANNELS (lib/holdPop,
 * components/PopKnobs), for everyone.
 *
 * OFF: his account only. "Also when not in landscape mode on all devices
 * and screens instead of just having channels pop up to change have the
 * knobs only pop up above the channels so some one can quick change a
 * setting" (Justin, 10 November 2026), built the same day and not yet seen
 * on a phone. Every other account's pop-up is the channels alone, as it
 * was. Where it opens it still needs Edit's own door (lib/editDoor) and is
 * never a VP4's, so this line opens no editing anywhere Edit is closed.
 * This is the one line that opens it, with its line in What's new in the
 * same pull request.
 */
export const HOLD_POPUP_KNOBS_FOR_EVERYONE = false

/**
 * THE TIDIER EDIT, AND THE HANDLE ON THE LINE BETWEEN THE TWO SIDES
 * (lib/tidyEdit, lib/sidesSplit, components/SidesHandle), for everyone.
 *
 * OFF: his account only. "What can we do to improve the edit screen to
 * make it more like the real ax edit software" (Justin, 9 November 2026,
 * Edit beside Play on his iPad), built from the pictures sent that day
 * after his "yes to all your other non build suggestions" on the 10th, and
 * not yet seen on a screen. One switch for both halves of it: Edit's
 * denser rows (the block's name, channels and on/off in one row, the model
 * beside them where there is room, the knobs as many across as fit) and
 * the handle that swaps and resizes the two sides. Every other account's
 * Edit and two sides are what they were. This is the one line that opens
 * it, with its line in What's new in the same pull request.
 */
export const TIDY_EDIT_FOR_EVERYONE = false

 * STAGE VIEW (lib/stageView, components/StageView): Play's preset, scene and
 * what comes next, big enough to read from a stand, for everyone.
 *
 * OFF: his account only. One of the ideas he said yes to on 10 November
 * 2026 ("yes to all your other non build suggestions as well"), built with
 * no picture and not yet seen on a screen. Closed to an account there is no
 * Stage view button in the top bar and no row for it in Settings. This is
 * the one line that opens it, with its line in What's new in the same pull
 * request.
 */
export const STAGE_VIEW_FOR_EVERYONE = false

/**
 * SONG NOTES (lib/songNotes, components/SongNotes): lyrics, chords or cues
 * for each song in a setlist, beside Play, for everyone.
 *
 * OFF: his account only, by the same yes and for the same reason. Closed to
 * an account there is no Notes on the list of what goes beside Play, no
 * Notes button on a song in Setlists or in Stage view, and whatever notes
 * the device holds are left exactly as they are. This is the one line that
 * opens it, with its line in What's new in the same pull request.
 */
export const SONG_NOTES_FOR_EVERYONE = false
