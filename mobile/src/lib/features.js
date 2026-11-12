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
 * ON, for everyone, since 10 November 2026: "Activate all of the features that were just on my account to all the
 * other accounts obviously besides the developer portal" (Justin, 10
 * November 2026).
 * He asked for it the same day ("Also when not in landscape mode on all
 * devices and screens instead of just having channels pop up to change have
 * the knobs only pop up above the channels so some one can quick change a
 * setting") and had it on his own account first. Where it opens it still
 * needs Edit's own door (lib/editDoor) and is never a VP4's, so this line
 * opens no editing anywhere Edit is closed: there the pop-up is the
 * channels alone, as it was. Off, it is his account only again.
 */
export const HOLD_POPUP_KNOBS_FOR_EVERYONE = true

/**
 * THE TIDIER EDIT, AND THE HANDLE ON THE LINE BETWEEN THE TWO SIDES
 * (lib/tidyEdit, lib/sidesSplit, components/SidesHandle), for everyone.
 *
 * ON, for everyone, since 10 November 2026: "Activate all of the features that were just on my account to all the
 * other accounts obviously besides the developer portal" (Justin, 10
 * November 2026).
 * It began with "What can we do to improve the edit screen to make it more
 * like the real ax edit software" (9 November 2026, Edit beside Play on his
 * iPad), built after his "yes to all your other non build suggestions" on
 * the 10th and on his own account first. One switch for both halves of it:
 * Edit's denser rows (the block's name, channels and on/off in one row, the
 * model beside them where there is room, the knobs as many across as fit)
 * and the handle that swaps and resizes the two sides. Off, it is his
 * account only again, and every other account's Edit and two sides are
 * what they were before.
 */
export const TIDY_EDIT_FOR_EVERYONE = true

/**
 * STAGE VIEW (lib/stageView, components/StageView): Play's preset, scene and
 * what comes next, big enough to read from a stand, for everyone.
 *
 * ON, for everyone, since 10 November 2026: "Activate all of the features that were just on my account to all the
 * other accounts obviously besides the developer portal" (Justin, 10
 * November 2026).
 * One of the ideas he said yes to that day ("yes to all your other non
 * build suggestions as well"), on his own account first. Off, it is his
 * account only again: closed to an account there is no Stage view button
 * in the top bar and no row for it in Settings.
 */
export const STAGE_VIEW_FOR_EVERYONE = true

/**
 * SONG NOTES (lib/songNotes, components/SongNotes): lyrics, chords or cues
 * for each song in a setlist, beside Play, for everyone.
 *
 * ON, for everyone, since 10 November 2026, by the same words as Stage
 * view above. Off, it is his account only again: closed to an account
 * there is no Notes on the list of what goes beside Play, no Notes button
 * on a song in Setlists or in Stage view, and whatever notes the device
 * holds are left exactly as they are.
 */
export const SONG_NOTES_FOR_EVERYONE = true

/**
 * THREE ACROSS ON A VERY WIDE WINDOW (lib/threeSides; components/Sides,
 * components/SidesLead): Play and two tools at once, for everyone.
 *
 * ON, for everyone the two sides are open to, since 10 November 2026:
 * "Activate all of the features that were just on my account to all the
 * other accounts obviously besides the developer portal" (Justin, 10
 * November 2026).
 * One of the ideas he said yes to that day ("yes to all your other non
 * build suggestions as well": "Three across on the big iPad Pro: Play,
 * Edit and a list at once"), on his own account first. Off, it is his
 * account only again: closed to an account, a 13-inch iPad on its side
 * shows two sides, exactly as it did, with no Add a side in the top bar
 * and nothing kept.
 */
export const THREE_SIDES_FOR_EVERYONE = true

/**
 * A PRESET INTO A SETLIST FROM ALL PRESETS (lib/addToSetlist;
 * screens/Presets): hold a preset, pick the setlist, for everyone.
 *
 * ON, for everyone, since 10 November 2026: "Activate all of the features that were just on my account to all the
 * other accounts obviously besides the developer portal" (Justin, 10
 * November 2026).
 * One of the ideas he said yes to that day ("yes to all your other non
 * build suggestions as well": "Drag a preset from All presets into a
 * setlist"), built as a hold and on his own account first. It changes what
 * a hold on a preset does: the hold is a sheet with the player's setlists
 * on it and the colour as its last row. Off, it is his account only again,
 * and every other account's hold is the preset's colour tag, as it was.
 */
export const ADD_TO_SETLIST_FOR_EVERYONE = true

/**
 * ALL PRESETS AS A WHEEL (lib/presetWheel; components/PresetWheel,
 * screens/Presets), a choice in Settings beside the list.
 *
 * "Can we do preset scrolling option a as a setting? So we can have both
 * the original and that one." (Justin, 11 November 2026, of the three
 * pictures he was shown of "a clicking and a vibration kind of like the old
 * iPod wheels did".) Built on his account first, as every new thing is: it
 * has never run on a device, and how the click sounds and how the wheel
 * feels under a thumb are his to say. Off, the choice is drawn for his
 * account only, and every other account's All presets is the list it has
 * always been, whatever the device has kept. It opens to everyone when he
 * says so, with its What's new line in that pull request.
 */
export const PRESET_WHEEL_FOR_EVERYONE = false

/**
 * THE METRONOME'S FLASH ROUND THE EDGE OF THE SCREEN, AS A CHOICE
 * (lib/edgeFlash): a switch on Settings → Metronome that turns the flash
 * off, and that lets it run without the device's own click, so the screen
 * lights in silence while the unit clicks. "On the phone have an option for
 * the screen to flash somewhere like the outside edge of the screen"
 * (Justin, 12 November 2026). Built on his account first, as every new
 * thing is. Off, the switch is drawn for his account only, and for every
 * other account the edge flashes with the device's own click and never
 * without it, as it always has. It opens to everyone when he says so, with
 * its What's new line in that pull request.
 */
export const METRONOME_FLASH_CHOICE_FOR_EVERYONE = false
