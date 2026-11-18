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
 * THE DEVICE'S BEAT ON THE UNIT'S BEAT (lib/beatLock, lib/unitBeat), for
 * everyone.
 *
 * "The metronome is not matching up properly into the sound coming out of
 * speakers. There's a delay." (Justin, 16 November 2026.) With the unit
 * clicking and the device lighting or clicking beside it, the device now
 * listens for the unit's own beat and moves its own onto it. Whether his
 * unit sends that beat down its USB port has not been seen: with none
 * heard, nothing changes and the log says why. It was his account only
 * until he had seen it line up.
 *
 * OPEN TO EVERYONE SINCE 17 NOVEMBER 2026, store version 2.0.0: "Enable
 * all new features for all users that were on my account. Except for the
 * scroll wheel for presets" (Justin, release day). The pull request that
 * turned it on moved main to the 2.0.0 build's fingerprint, so it reaches
 * only copies of 2.0.0, reviewed with notes that describe it. Not seen
 * lining up on a unit yet: with no beat heard it changes nothing. Off
 * again, it is his account only.
 */
export const BEAT_LOCK_FOR_EVERYONE = true

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
 * "This is the landscape view on iPhone ... let's split the screen in half
 * kind of like the iPhone duo" (Justin, 10 November 2026), built from
 * pictures he approved the same day, his account only until it was seen on
 * his iPhone 17 Pro Max on the 2.0.0 test build (17 November 2026, Play
 * alone). A phone turns only from the copy whose native side lets it
 * (phone-turns, in 2.0.0); the smallest phones stay upright by the rule.
 *
 * OPEN TO EVERYONE SINCE 17 NOVEMBER 2026, store version 2.0.0: "Enable
 * all new features for all users that were on my account. Except for the
 * scroll wheel for presets" (Justin, release day). The pull request that
 * turned it on moved main to the 2.0.0 build's fingerprint, so it reaches
 * only copies of 2.0.0, reviewed with notes that describe it. Off again,
 * it is his account only.
 */
export const PHONE_SIDEWAYS_FOR_EVERYONE = true

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
 * THE METRONOME'S FLASH ROUND THE EDGE OF THE SCREEN, AS A CHOICE
 * (lib/edgeFlash): a switch on Settings → Metronome that turns the flash
 * off, and that lets it run without the device's own click, so the screen
 * lights in silence while the unit clicks. "On the phone have an option for
 * the screen to flash somewhere like the outside edge of the screen"
 * (Justin, 12 November 2026). Built on his account first, as every new
 * thing is, with the sound choice (Off, the device, the unit, both) behind
 * the same line.
 *
 * OPEN TO EVERYONE SINCE 17 NOVEMBER 2026, store version 2.0.0: "Enable
 * all new features for all users that were on my account. Except for the
 * scroll wheel for presets" (Justin, release day). The pull request that
 * turned it on moved main to the 2.0.0 build's fingerprint, so it reaches
 * only copies of 2.0.0, reviewed with notes that describe it. Off again,
 * the switch is drawn for his account only, and for every other account the
 * edge flashes with the device's own click and never without it.
 */
export const METRONOME_FLASH_CHOICE_FOR_EVERYONE = true

/**
 * LINING UP THE LIGHT AND THE CLICK (lib/lineUp): on Settings → Metronome,
 * two nudges kept on the device, the light and the device's own click, each
 * Earlier or Later, and Tap along, which sets both from taps on the unit's
 * click. "Will you make sure everything's in sync properly somehow or have a
 * way for a user to calibrate" (Justin, 16 November 2026). Built on his
 * account first, as every new thing is. It needs BEAT_LOCK_FOR_EVERYONE
 * open with it (test/line-up.mjs).
 *
 * OPEN TO EVERYONE SINCE 17 NOVEMBER 2026, store version 2.0.0: "Enable
 * all new features for all users that were on my account. Except for the
 * scroll wheel for presets" (Justin, release day). The pull request that
 * turned it on moved main to the 2.0.0 build's fingerprint, so it reaches
 * only copies of 2.0.0, reviewed with notes that describe it. Off again,
 * it is drawn for his account only, and for every other account the nudges
 * are neither drawn nor applied, whatever the device has kept.
 */
export const METRONOME_LINE_UP_FOR_EVERYONE = true

/**
 * QUICK EDIT ON THE APPLE WATCH (lib/watchQuick, lib/watchQuickEdit): a
 * pedal held on the watch opens its channels with a list of the block's
 * knobs under them, and the Digital Crown turns the one picked.
 *
 * "On the watch, we have pushed to hold on the channels to switch amps. Can
 * we set up quick edits on that as well? And change the name to hold to
 * quick edit?" Then, of three pictures: "For the watch, mock up B."
 * (Justin, 12 November 2026.) Built on his account first, as every new
 * thing is. The watch's half is in the 2.0.0 iPhone build (watch-page-order):
 * the phone says nothing of it to a watch that has not said it knows how.
 * Where it opens it still needs the hold pop-up's own knobs (lib/holdPop
 * popKnobsOn: Edit's door, never a VP4), so this line opens no editing
 * anywhere Edit is closed.
 *
 * OPEN TO EVERYONE SINCE 17 NOVEMBER 2026, store version 2.0.0: "Enable
 * all new features for all users that were on my account. Except for the
 * scroll wheel for presets" (Justin, release day). The pull request that
 * turned it on moved main to the 2.0.0 build's fingerprint, so it reaches
 * only copies of 2.0.0, reviewed with notes that describe it. Off again,
 * it is his account only, and every other account's watch opens a held
 * pedal's channels alone.
 */
export const WATCH_QUICK_EDIT_FOR_EVERYONE = true

/**
 * THE NAM BLOCK'S KNOBS IN EDIT, on an Axe-Fx III over Bluetooth or its USB
 * cable into the phone (lib/axefx3-own-knobs, lib/axefx3-edit `withNam`):
 * Input Gain, Bass, Mid, Treble, Bright, Bright Cap and the block's Level,
 * with five of its switches read and guarded beside them.
 *
 * "Yes build the NAM reader now" (Justin, 12 November 2026), and the reader
 * ran on his own Axe-Fx III the next day: what it read, with the names off
 * Axe-Edit III's NAM page, is docs/ax3-readings.md. Built on his account
 * first, as every new thing is, and for a harder reason than most: these
 * settings were read off one unit and no write has gone to a NAM block
 * yet, so the first knob he turns is the first check that the unit takes
 * them. Off, it is his account only (lib/bluetooth hands the wire
 * `namKnobs`), and for every other account the III's NAM is exactly what it
 * was: its name, its on and off, a line saying its knobs aren't in the app
 * yet, and its reads and writes refused at the way out (bleWire
 * gen3Sender). It opens to everyone when he says so, after it has run on
 * his unit, with its What's new line in that pull request; Edit's own door
 * (lib/ble-rule.js EDIT_FROM_STORE) still decides whether a copy edits at
 * all.
 *
 * OPEN TO EVERYONE SINCE 13 NOVEMBER 2026. He turned them on his own
 * Axe-Fx III over Bluetooth that day ("Knobs all work over Bluetooth
 * correctly") and, asked whether to open them now or keep them on his
 * account, said "Open them to everyone". So this is true: every account
 * whose Edit is open on an Axe-Fx III gets the NAM block's knobs (lib/bleWire
 * ownEditOf `'nam'`, axefx3-edit `namOnly`).
 *
 * SINCE 16 NOVEMBER 2026 (1.91.2) THIS SWITCH DECIDES NOTHING:
 * OWN_KNOBS_FOR_EVERYONE, below, is on, and it gives every account the whole
 * list, the NAM block in it (lib/bluetooth ownKnobsLevel reads it first). So
 * turning this one off alone closes nothing. To take the NAM block's knobs
 * back to his account, turn OWN_KNOBS_FOR_EVERYONE off as well; to leave
 * customers the NAM block and nothing else of the list, turn only that one
 * off.
 */
export const NAM_KNOBS_FOR_EVERYONE = true

/**
 * AND THE REST OF THE III'S OWN BLOCKS' KNOBS (1.90.49): the IR Player, the
 * Vocoder, the Crossover, Tone Match and Dynamic Distortion, in the same
 * hand-written list (lib/axefx3-own-knobs.js). His account only until he had
 * turned them: "I verified knobs are working correctly on the 5 AX3 blocks",
 * then, asked whether to open them, "Yes, open the knobs for everyone now"
 * (Justin, 16 November 2026). So this is true, with its What's new line, and
 * every account whose Edit is open on an Axe-Fx III is read through the whole
 * list (axefx3-edit `withNam`). Only the knobs: the blocks' list settings
 * (EDIT_SETTINGS_FOR_EVERYONE) and their names through the computer
 * (OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE) are switches of their own, both
 * open to everyone since 2.0.0. On, it also carries the NAM block for everybody, whatever
 * NAM_KNOBS_FOR_EVERYONE says. Off, the five are his account's alone again,
 * and every other account goes back to what NAM_KNOBS_FOR_EVERYONE gives.
 */
export const OWN_KNOBS_FOR_EVERYONE = true

/*
 * AN AXE-FX III'S AND AN FM9'S OWN BLOCKS ON PLAY THROUGH THE COMPUTER,
 * NAMED BY THE PHONE (lib/ownBlocks).
 *
 * "NAM shows up on Bluetooth but not when connected through my raspberry
 * pie" and "I would rather use the pi if that's possible." (Justin, 13
 * November 2026.) Through the computer the engine passes the NAM block, the
 * IR Player, the Crossover, the Vocoder, Tone Match and Dynamic Distortion
 * on with no name, so Play left them out. The phone names them from the
 * list it uses over Bluetooth, and Play draws and switches them through the
 * computer's own on/off and channel routes, which take any block's id.
 * Built on his account first, as every new thing is. Through his Raspberry
 * Pi the chain editor put NAM 1 and NAM 2 into a preset and found them
 * there, and NAM 1 was switched off from Play (15 November 2026); the other
 * five blocks have not been switched through a computer. OPEN TO EVERYONE
 * SINCE 2.0.0 (17 November 2026): "Enable all new features for all users
 * that were on my account" (Justin, release day). Off again, it is his
 * account only (lib/ownBlocksHere), and every other account's block is the
 * New block it was.
 */
export const OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE = true

/**
 * A BLOCK'S LIST SETTINGS IN EDIT, under its knobs (lib/editSettings,
 * components/BlockSettings): Bypass Mode, Tone Stack Type, Input Mode and
 * every other setting that is one of a list, which Edit read with each block
 * and drew none of.
 *
 * "Yes, I like B for the edit screen" and "Menu style B" (Justin, 13
 * November 2026, of three ways shown on a NAM block): two or three choices
 * are buttons, more is a row that opens a list. On every unit and every
 * connection Edit opens on, since the settings come with the block's own
 * read and are written by the write Edit already had for one (lib/device
 * setEnum); never a Cab's.
 *
 * His account first, as every new thing is: no switch of any block has been
 * tapped from the app on a unit. OPEN TO EVERYONE SINCE 2.0.0 (17 November
 * 2026): "Enable all new features for all users that were on my account"
 * (Justin, release day). Off again, it is his account only
 * (lib/useEditSettings), and every other account's Edit is the knobs it
 * always was.
 */
export const EDIT_SETTINGS_FOR_EVERYONE = true

/**
 * WHICH CAPTURE A NAM BLOCK PLAYS, CHOSEN IN EDIT (lib/captureList,
 * components/CapturePicker): a button with the capture the block is on, its
 * number and name as the unit and Axe-Edit say them, and a list of the
 * captures on the unit to choose another from. Edit said "The capture is
 * chosen on the unit itself."
 *
 * It was the next thing on the list after the captures themselves ("then a
 * capture picker in Edit", CLAUDE.md), and it stands on what his unit has
 * already done: the unit's list was read by Axe-Edit's own questions in his
 * recording, and his first pick from the TONE3000 card was answered with the
 * slot it asked for (14 November 2026). An Axe-Fx III only, over Bluetooth,
 * its USB cable, or through a computer app that has the list.
 *
 * His account first, as every new thing is. The capture tools on the
 * device's own wire follow this line and TONE3000_QUICK_FOR_EVERYONE
 * (lib/bluetooth capturesOverBluetooth: his account, or either switch), so
 * opening this opened them; the Block reader stays his.
 *
 * OPEN TO EVERYONE SINCE 17 NOVEMBER 2026, store version 2.0.0: "Enable
 * all new features for all users that were on my account. Except for the
 * scroll wheel for presets" (Justin, release day). The pull request that
 * turned it on moved main to the 2.0.0 build's fingerprint, so it reaches
 * only copies of 2.0.0, reviewed with notes that describe it. Off again,
 * with TONE3000_QUICK_FOR_EVERYONE off too, it and the wire's capture tools
 * are his account only, and everybody else's NAM block says the capture is
 * chosen on the unit.
 */
export const NAM_PICKER_FOR_EVERYONE = true

/**
 * TONE3000 FROM A HELD NAM BLOCK (lib/tone3000Quick, components/
 * Tone3000Quick): "I want it in the app in a few places. One is if they hold
 * a nam block it pulls up the quick edit screen on top of it have it say
 * tone 3000 where they can click on it and browse tones preview them and
 * then download them directly and then it'll take them back to that screen
 * so it's very streamlined." (Justin, 14 November 2026.)
 *
 * On Play, a hold on NAM 1 or NAM 2 of an Axe-Fx III opens its pop-up with
 * a TONE3000 button over the knobs. It opens TONE3000's list in the same
 * pop-up; Preview plays a capture in that block, and Get puts it on the
 * unit, plays it in that block and gives the pop-up back to its knobs.
 *
 * His account first, as every new thing is. His Axe-Fx III kept two
 * captures of two sent from the app through the Raspberry Pi on computer app
 * 1.90.90 (17 November 2026), each on the first try; a whole send over
 * Bluetooth since the last fixes has not been seen. Every Preview and Get
 * fills a slot on the unit. The sender on the device's own wire follows
 * this line and NAM_PICKER_FOR_EVERYONE (lib/bluetooth
 * capturesOverBluetooth). The Developer page's TONE3000 card stays his.
 *
 * OPEN TO EVERYONE SINCE 17 NOVEMBER 2026, store version 2.0.0: "Enable
 * all new features for all users that were on my account. Except for the
 * scroll wheel for presets" (Justin, release day). The pull request that
 * turned it on moved main to the 2.0.0 build's fingerprint, so it reaches
 * only copies of 2.0.0, reviewed with notes that describe it, with the
 * sign-in inside the app (tone3000-in-app). It is a plain switch: it is NOT
 * keyed to a store version the way Edit over Bluetooth is
 * (`EDIT_FROM_STORE` in lib/ble-rule, with a ledger pin), which the notes
 * had asked for; the only lock is that the 1.90.0 copies take no update
 * from that merge on. Nor has TONE3000 signed off these screens: the notes
 * still list that as wanted (he has their approval to publish). Off again,
 * it is his account only (lib/useTone3000Quick).
 */
export const TONE3000_QUICK_FOR_EVERYONE = true

/**
 * SAVING FROM THE APP OVER BLUETOOTH OR THE UNIT'S USB CABLE (lib/bleSave,
 * bleWire storePreset): Edit's Save, and Play's, write the unit's edit
 * buffer over the preset it is on, with no computer.
 *
 * "It still says we can't save in Bluetooth when you pull up the quick edit
 * menus and stuff. Please enable that and remove the warning." (Justin, 13
 * November 2026.) It was not built: a change played and was lost at the next
 * preset change unless it was saved on the unit. Now the phone sends the
 * computer app's own save, byte for byte, on an AM4, FM3, FM9 and Axe-Fx
 * III, only over the preset the unit says it is on. Never a VP4.
 *
 * His account first, and for a harder reason than most: A SAVE WRITES A
 * PRESET, and no save has gone from the phone to a unit yet.
 *
 * OPEN TO EVERYONE SINCE 2.0.0 (17 November 2026): "Enable all new features
 * for all users that were on my account" (Justin, release day, before any
 * save from his phone). It opens by this switch and not by a store-version
 * key because the release-day pull request that sets it moves main's
 * fingerprint to the 2.0.0 build's: from that merge on no update reaches a
 * 1.90.0 copy, reviewed with notes that say there is no saving over
 * Bluetooth, and every copy that takes it is 2.0.0, reviewed with notes
 * that describe it. Off again, it is his account only (lib/bluetooth
 * saveOverBluetooth): Bluetooth shows no Save, and a save's frame is refused
 * at the way out. Never a VP4.
 */
export const SAVE_OVER_BLUETOOTH_FOR_EVERYONE = true

/**
 * THE CHAIN, READ AS A GRID AND CHANGED OVER BLUETOOTH OR THE UNIT'S OWN USB
 * CABLE (lib/gen3-grid on an FM3, FM9 or Axe-Fx III; lib/am4-chain on an
 * AM4): a block put in a cell or a slot, a cell emptied, a cable joined.
 *
 * "The four screens are good. I need everything with the chain builder to
 * work over Bluetooth also" (Justin, 15 November 2026, of Quick build and
 * the starter chains). Until then the chain could only be changed through
 * the computer. What is sent is the computer app's own, byte for byte (the
 * tests hold every frame to the pinned codec), and every frame of it is
 * held at the way out to the one job the wire has in hand.
 *
 * Seen on a unit once: one Quick build on his Axe-Fx III over a WIDI Master,
 * on row 3 (16 November 2026). Not on another row, an FM3, an FM9 or an
 * AM4, another adapter, or an Undo.
 *
 * OPEN TO EVERYONE SINCE 2.0.0 (17 November 2026): "Enable all new features
 * for all users that were on my account" (Justin, release day). By this
 * switch, not a store-version key, because the release-day pull request
 * that sets it moves main's fingerprint to the 2.0.0 build's, so no update
 * from it on reaches a 1.90.0 copy, and every copy that takes it was
 * reviewed with notes that describe it. What it opens is Quick build on an
 * empty preset; the chain EDITOR (one block moved, added or removed) is
 * still not over Bluetooth, and Edit says so (lib/editWords noChainLine). Off again, it
 * is his account only (lib/bluetooth chainOverBluetooth), and a frame of
 * these shapes is refused at the way out.
 */
export const CHAIN_OVER_BLUETOOTH_FOR_EVERYONE = true

/**
 * PLAY'S AND EDIT'S BLOCKS IN THE UNIT'S OWN ORDER, OVER BLUETOOTH OR THE
 * UNIT'S OWN USB CABLE, on an FM3, FM9 or Axe-Fx III (bleWire gridOrder).
 *
 * "The order of the Effects doesn't correspond to the real order of the
 * FM9" (a customer, an FM9 through a WIDI Master, November 2026). Over
 * Bluetooth the one block read is the status read, which lists the blocks
 * by their number and says nothing of where they sit, so Play and Edit put
 * them in the order chains usually run (lib/chain-outline). Through the
 * computer they come column by column off the grid, the unit's own order.
 *
 * On, the phone asks the unit where its blocks are (the grid's live read,
 * 01 2E 00: one answer of about 750 bytes, a quarter of a second) once for
 * each preset on a connection, after the status read, and uses it for the
 * ORDER and nothing else: column by column, top row first, the computer's
 * own walk. Only when the blocks in it are exactly the ones the status read
 * listed; a preset seen again, and a scene change, ask nothing. No answer, a
 * refusal, an answer it cannot read or other blocks, and the order is the
 * usual one, with a line in the log saying why.
 *
 * His account first: NO UNIT HAS ANSWERED THIS READ FROM A PHONE YET. The
 * answers on record came over USB to a computer (FM9-Edit's own, and an
 * FM3's), never down a MIDI jack through an adapter, and an Axe-Fx III's has
 * never been seen. Off, it is his account only (lib/bluetooth
 * blockOrderFromGrid): every other account's Play and Edit are in the usual
 * order, and the read's frame is refused at the way out.
 *
 * It moves, adds and removes nothing, and no screen says anything new: the
 * blocks are drawn where the unit has them, as through the computer. OPEN
 * TO EVERYONE SINCE 2.0.0 (17 November 2026), before any log from a unit
 * had shown the order read agreeing: "Enable all new features for all
 * users that were on my account" (Justin, release day). A grid that does
 * not agree with the status read still leaves the usual order.
 */
export const BLOCK_ORDER_FROM_GRID_FOR_EVERYONE = true

/**
 * THE INPUT AND OUTPUT BLOCKS IN EDIT OVER BLUETOOTH OR THE UNIT'S USB
 * CABLE, THE VOLUME BUTTON THERE ON OUTPUT 1, AND EACH SCENE'S OWN LEVEL
 * (lib/sceneLevel; bleWire `io`; components/Volume; screens/Edit).
 *
 * A customer with an FM9 over Bluetooth asked for "scenes levels and IN and
 * OUT blocks" (16 November 2026). Over Bluetooth the wire threw the Input
 * and Output blocks away, so Edit had no IN or OUT there and the top bar no
 * volume button; and on every connection a scene's level (the Output
 * block's Scene 1 to 8 Level, -20 to +20 dB) was read and never drawn.
 * Open, on an FM3, FM9 or Axe-Fx III where Edit is open over the wire:
 * Edit draws IN and OUT as the chain's ends, as it does through the
 * computer; the volume button is there and moves Output 1; the volume
 * pop-up has a row for the scene the unit is on; and Edit's Output block
 * has the eight scene levels as typed boxes. Through the computer, the last
 * three. Play still never shows the Input or the Output.
 *
 * NONE OF IT HAS BEEN SEEN ON A UNIT: not an FM9 listing its Input and
 * Output over Bluetooth, nor how many values its Output block's read
 * carries, nor a scene level written from the app landing where asked.
 * Off, it is his account only (lib/bluetooth outputAndSceneLevels): every
 * other account sees and sends exactly what it did, the wire leaves both
 * blocks out of its chain answer, and a read or write of either is refused
 * before it goes and at the way out.
 *
 * OPEN TO EVERYONE SINCE 2.0.0 (17 November 2026), before he had moved a
 * scene level on a unit: "Enable all new features for all users that were
 * on my account" (Justin, release day). Every copy that takes it is 2.0.0
 * (the release-day pull request moves main's fingerprint), and the
 * Bluetooth page drops the volume button from its list where it is there
 * (lib/editWords notOverBluetoothLine).
 */
export const OUTPUT_AND_SCENE_LEVELS_FOR_EVERYONE = true

/**
 * QUICK BUILD AND STARTER CHAINS (shared/starter-chains.mjs,
 * components/QuickBuild, components/StarterChains): on an empty preset, the
 * blocks tapped in order go into one row and are joined from the Input to
 * the Output, the chain is read back and what landed is said, with one Undo;
 * and named chains the player keeps, offered on every empty preset and kept
 * in Settings → Starter chains.
 *
 * "Let's also look into building out a way to build a preset quickly from an
 * empty preset. Maybe a "quick build" to build what blocks go in them
 * (including NAM blocks) and a quick default starter chain option as well
 * with settings a user where A user can create their own custom starter
 * chains with what blocks they want in their starter chain." Then, of the
 * four pictures: "The four screens are good. I need everything with the
 * chain builder to work over Bluetooth also" (Justin, 15 November 2026).
 *
 * His account first, as every new thing is. His Axe-Fx III has joined
 * row 3 four times (once over a WIDI Master, three times through the Pi);
 * no other row, no other unit, and no Undo has run on a unit. OPEN TO
 * EVERYONE SINCE 2.0.0 (17 November 2026): "Enable all new features for
 * all users that were on my account" (Justin, release day). Off again, it is
 * his account only (lib/useQuickBuild); an empty preset says "This preset
 * is empty." and Settings has no Starter chains row.
 * Where it is drawn is lib/quickBuild `quickBuildHere`: never a VP4, only
 * where the unit's capabilities say `gridEdit`, and only on this preset's
 * own chain. It asks nothing about the wire, so it works over Bluetooth on
 * the day the wire says `gridEdit` there.
 */
export const QUICK_BUILD_FOR_EVERYONE = true

/**
 * THE COMPUTER APP'S OWN UPDATE ON PHONE & COMPUTER (lib/hostUpdate,
 * components/HostUpdate): under the computer's card, how its update is going
 * as the computer says it (computer app 1.92.0 on), and Update now when a
 * Raspberry Pi has one ready; and in Which unit, each computer's version
 * and how its update is going, read only.
 *
 * "I will update the pis but we need to figure out how to have them auto
 * update" (Justin, 17 November 2026). The computer half came first (1.92.0):
 * a Pi puts its update in by itself once nobody has used it for half an
 * hour, and acts on a phone's request written into its store.
 *
 * His account first. NOBODY HAS PRESSED UPDATE NOW ON A REAL PI YET, and how
 * long the restart takes, and whether the unit's sound carries on through
 * it, have not been seen, so no sentence says either (and its What's new
 * line names no time). The ready line and the give-up line say the day's
 * wait a customer's computer makes and his own do not (lib/hostUpdate
 * `owner`).
 *
 * OPEN TO EVERYONE SINCE 17 NOVEMBER 2026, store version 2.0.0: "Enable
 * all new features for all users that were on my account. Except for the
 * scroll wheel for presets" (Justin, release day). The pull request that
 * turned it on moved main to the 2.0.0 build's fingerprint, so it reaches
 * only copies of 2.0.0, reviewed with notes that describe it. Off again,
 * it is his account only (lib/hostUpdateHere useComputerUpdate); every
 * other account sees the computer's card as it was and nothing is written
 * for it.
 */
export const COMPUTER_UPDATE_FOR_EVERYONE = true

/**
 * EDIT'S KNOBS FOLLOW THE UNIT (lib/liveKnobs, the rules; lib/liveKnobsHere,
 * Edit's block panel, the hold pop-up and the big screen's panel; bleWire
 * heardReport), on an FM3, an FM9 or an Axe-Fx III, never an AM4 or a VP4.
 *
 * "Changing a parameter on the unit itself doesn't reflect on the Amp." (A
 * customer's FM9 over Bluetooth through a WIDI Master, 16 November 2026.)
 * Edit read a block's knobs as its panel opened and then only after its own
 * changes, a scene, a channel or a preset. Now the open block is read again
 * every few seconds over Bluetooth or the unit's USB cable, as the app comes
 * back to the front and as the panel opens, and at once when the unit says
 * itself that a knob moved: in its own block report over Bluetooth or the
 * cable, or in the news the computer app passes on.
 *
 * His account first, as every new thing is: NOBODY HAS WATCHED A KNOB TURNED
 * ON A UNIT SHOW UP HERE YET, nor listened for whether a read every few
 * seconds is heard on one. Off, it is his account only (lib/useLiveKnobs for
 * the screens, lib/bluetooth liveKnobsOverBluetooth for the wire), and every
 * other account's Edit reads and sends exactly what it did. The unit's own
 * report is written in the log for every account, which is how a customer's
 * log says whether their unit sends one. OPEN TO EVERYONE SINCE 2.0.0 (17
 * November 2026): "Enable all new features for all users that were on my
 * account" (Justin, release day), with the one cost written down in
 * CLAUDE.md left as it was (a clock read can hold a Play tap up to the
 * read's own time).
 */
export const LIVE_KNOBS_FOR_EVERYONE = true

/**
 * AN FM9'S OR AN AXE-FX III'S TUNER OVER BLUETOOTH OR A USB CABLE ASKS THE
 * UNIT, the computer app's own way, when Fractal's switch brings no readings
 * (bleWire `asksOn`, gen3TunerOn).
 *
 * "I want to enable all of the items currently available to computer bridge
 * users to Bluetooth like chain editing and live tuner on phone and Apple
 * Watch." (Justin, 18 November 2026.) Through a computer those two units'
 * tuner needs nothing set on the unit. Over Bluetooth it showed a needle
 * only with Send Realtime Sysex on (Setup → MIDI/Remote), which is off on a
 * unit as it comes. Open, a switch that brings nothing in 1.2 s is followed
 * by the tuner page and the frequency question, the two messages the
 * computer app sends every gen-3 unit and this wire already sends an FM3.
 * The watch's tuner is the phone's, so it follows.
 *
 * His account first, as every new thing is: NOT SEEN ON A UNIT over its
 * MIDI jacks. Off, it is his account only (lib/bluetooth
 * tunerAsksOverBluetooth) and every other account's tuner sends the switch
 * alone, as before.
 *
 * OPEN TO EVERY ACCOUNT SINCE 2.0.5 (18 November 2026): "Open it up to
 * everyone" (Justin, the day it was built, before any of it had run on a
 * unit; his call). Off, it is his account only again.
 */
export const TUNER_ASKS_FOR_EVERYONE = true

/**
 * THE CHAIN EDITOR OVER BLUETOOTH OR A USB CABLE: one block moved, added or
 * removed in a chain that has blocks, rows and splits, and Undo, on an AM4,
 * FM3, FM9 or Axe-Fx III (bleWire gen3PlacedBlocks, lib/device
 * wantPlacedChain, Edit's chainTools).
 *
 * "I want to enable all of the items currently available to computer bridge
 * users to Bluetooth like chain editing" (Justin, 18 November 2026). The
 * messages that place a block and join a cable went out with Quick build
 * (CHAIN_OVER_BLUETOOTH_FOR_EVERYONE); what the editor lacked was every
 * block's place, which Play's read over Bluetooth does not carry. The wire
 * now answers them from the preset read whole, while the editor is open.
 * Slow down an adapter from a gen-3 unit (half a minute from an Axe-Fx III
 * over a WIDI Master, after every change), a moment on the unit's USB cable
 * or an AM4, and the editor says so.
 *
 * His account first: NO BLOCK HAS BEEN MOVED, ADDED OR REMOVED THIS WAY ON A
 * UNIT. Off, it is his account only (lib/bluetooth
 * chainEditorOverBluetooth) and every other account's Edit says what it
 * said. It also wants the chain itself open (CHAIN_OVER_BLUETOOTH_FOR_EVERYONE).
 *
 * OPEN TO EVERY ACCOUNT SINCE 2.0.5 (18 November 2026): "Open it up to
 * everyone" (Justin, the day it was built, before any of it had run on a
 * unit; his call). Off, it is his account only again.
 */
export const CHAIN_EDITOR_OVER_BLUETOOTH_FOR_EVERYONE = true

/**
 * EDIT'S SMALLER TOOLS OVER BLUETOOTH OR A USB CABLE: Rename preset and
 * scenes (lib/bleNames, bleWire writePresetName and writeSceneName), with
 * Copy a scene onto another under it, and Copy channel under a block's
 * knobs, on an AM4, FM3, FM9 or Axe-Fx III.
 *
 * "I want to enable all of the items currently available to computer bridge
 * users to Bluetooth" (Justin, 18 November 2026). The names are the
 * computer app's own messages, byte for byte, into the edit buffer; the two
 * copies are reads and writes Edit and Play already make there (a channel
 * switched, a block read, a knob, a model, a scene).
 *
 * His account first: NO NAME HAS BEEN WRITTEN AND NO CHANNEL COPIED THIS WAY
 * ON A UNIT. Off, it is his account only (lib/bluetooth
 * editToolsOverBluetooth) and every other account's Edit offers neither
 * over Bluetooth, as before.
 *
 * OPEN TO EVERY ACCOUNT SINCE 2.0.5 (18 November 2026): "Open it up to
 * everyone" (Justin, the day it was built, before any of it had run on a
 * unit; his call). Off, it is his account only again.
 */
export const EDIT_TOOLS_OVER_BLUETOOTH_FOR_EVERYONE = true

/**
 * THE LOOPER'S BUTTONS OVER BLUETOOTH OR A USB CABLE, on an FM3, FM9 or
 * Axe-Fx III (lib/bleTools, bleWire gen3LooperButton and
 * gen3LooperTelemetry).
 *
 * "Let's get the rest of the computer only items implemented for over
 * Bluetooth." (Justin, 18 November 2026.) Through the computer a preset's
 * Looper block is a pedal on Play that opens its eight buttons; over
 * Bluetooth the wire left the block out of the chain. Open, the wire hands
 * it on and sends the computer app's own message for each button, byte for
 * byte, and the panel's playhead and picture are read at the lowest place
 * in the line (the picture no more than once in six seconds).
 *
 * His account first: NO LOOPER BUTTON HAS BEEN SENT THIS WAY TO A UNIT. Off,
 * it is his account only (lib/bluetooth looperOverBluetooth), and every
 * other account's Play over Bluetooth has no looper, as before. It opens
 * when he says so, with its What's new line, and never while a store review
 * is under way with notes that do not describe it.
 *
 * OPEN TO EVERY ACCOUNT SINCE 2.0.8 (18 November 2026): "Enable the 5 new
 * Bluetooth items to all accounts, not just mine" (Justin, the day they
 * were built and the day Apple approved 2.0.0, before any of it had run on
 * a unit; his call). Off, it is his account only again.
 */
export const LOOPER_OVER_BLUETOOTH_FOR_EVERYONE = true

/**
 * THE UNIT'S OWN METRONOME CLICK OVER BLUETOOTH OR A USB CABLE, on an FM3,
 * FM9 or Axe-Fx III (lib/bleTools, bleWire gen3WriteClick and
 * gen3ReadClick).
 *
 * Through the computer Settings → Metronome → Where it clicks offers Unit
 * and Both, and the app switches the unit's own Metronome on and off; over
 * Bluetooth only the device was offered. Open, the wire writes that one
 * switch (a setting of the unit's Global block, its number the unit's own:
 * shared/metronome.mjs) as the computer writes it, and reads it back for
 * the metronome's own follow. Every screen that asked "is this Bluetooth?"
 * for the click now asks lib/bluetooth useBluetoothNoClick instead.
 *
 * His account first: THE SWITCH HAS NOT BEEN WRITTEN THIS WAY ON A UNIT.
 * Off, it is his account only (lib/bluetooth unitClickOverBluetooth), and
 * every other account reads and sends what it did. Never an AM4.
 *
 * OPEN TO EVERY ACCOUNT SINCE 2.0.8 (18 November 2026): "Enable the 5 new
 * Bluetooth items to all accounts, not just mine" (Justin, the day they
 * were built and the day Apple approved 2.0.0, before any of it had run on
 * a unit; his call). Off, it is his account only again.
 */
export const UNIT_CLICK_OVER_BLUETOOTH_FOR_EVERYONE = true

/**
 * MODIFIERS OVER BLUETOOTH OR A USB CABLE, on an FM3, FM9 or Axe-Fx III
 * (lib/gen3-tools, bleWire gen3BindModifier and gen3RawSlot).
 *
 * Through the computer Edit → More → Modifiers attaches a source (a pedal,
 * an LFO, an envelope) to a control and reads back what is attached; over
 * Bluetooth it was not offered. Open, the wire answers the computer app's
 * own three routes: its model for the unit (ForgeFX's own answer, carried
 * in lib/gen3-tools), a slot's stored numbers (the slot read whole) and the
 * attach (three typed writes on the slot's block, the computer's own).
 * As through the computer, only an FM3 lists its sources: an FM9's and an
 * Axe-Fx III's are not known, and the panel says so.
 *
 * His account first: NO MODIFIER HAS BEEN ATTACHED OR READ THIS WAY ON A
 * UNIT. Off, it is his account only (lib/bluetooth modifiersOverBluetooth).
 *
 * OPEN TO EVERY ACCOUNT SINCE 2.0.8 (18 November 2026): "Enable the 5 new
 * Bluetooth items to all accounts, not just mine" (Justin, the day they
 * were built and the day Apple approved 2.0.0, before any of it had run on
 * a unit; his call). Off, it is his account only again.
 */
export const MODIFIERS_OVER_BLUETOOTH_FOR_EVERYONE = true

/**
 * A CAB PICKED BY NAME OVER BLUETOOTH OR A USB CABLE, on an FM3, FM9 or
 * Axe-Fx III (lib/gen3-tools, bleWire gen3CabState).
 *
 * Through the computer a cab block's model list is its DynaCabs and its IRs
 * by name, picked through the block's cab state (lib/cab-pick); over
 * Bluetooth a cab had knobs and no picker ("a cab is chosen with the
 * computer"). Open, the wire answers the cab state from the block's own
 * read, ForgeFX's rule line for line, and the unit's IR names from the
 * computer app's own lists (about 100 KB of names in the app). The picks
 * are Edit's own writes, which the way out already took. A player's own
 * User IRs show as numbers, as through the computer.
 *
 * His account first: NO CAB HAS BEEN PICKED THIS WAY ON A UNIT. Off, it is
 * his account only (lib/bluetooth cabPickerOverBluetooth).
 *
 * OPEN TO EVERY ACCOUNT SINCE 2.0.8 (18 November 2026): "Enable the 5 new
 * Bluetooth items to all accounts, not just mine" (Justin, the day they
 * were built and the day Apple approved 2.0.0, before any of it had run on
 * a unit; his call). Off, it is his account only again.
 */
export const CAB_PICKER_OVER_BLUETOOTH_FOR_EVERYONE = true

/**
 * THE FOOTSWITCHES PAGE OVER BLUETOOTH OR A USB CABLE, on an FM3 (the one
 * unit whose switches the computer reads live; lib/gen3-tools, bleWire
 * gen3FcState, gen3FcCurrent and gen3FcNames).
 *
 * Settings → Footswitches shows what each of the unit's switches does, read
 * off the unit. Reads only: one question a value (lib/bleTools buildFcRead),
 * some thirty to a switch, so a view of three switches is a few seconds
 * over an adapter. Nothing is ever written to the footswitch setup, here or
 * at the computer.
 *
 * His account first: NO SWITCH HAS BEEN READ THIS WAY ON A UNIT. Off, it is
 * his account only (lib/bluetooth footswitchesOverBluetooth).
 *
 * OPEN TO EVERY ACCOUNT SINCE 2.0.8 (18 November 2026): "Enable the 5 new
 * Bluetooth items to all accounts, not just mine" (Justin, the day they
 * were built and the day Apple approved 2.0.0, before any of it had run on
 * a unit; his call). Off, it is his account only again.
 */
export const FOOTSWITCHES_OVER_BLUETOOTH_FOR_EVERYONE = true

/**
 * THE AM4'S NAM PLAYER BLOCK (firmware 3.00) named on Play over Bluetooth or
 * a USB cable, with its on and off and its channels (lib/fractal-sysex
 * AM4_NEW_BLOCKS, bleWire am4NamOn).
 *
 * "Fractal just announced NAM support for AM4, so please research that and
 * let's get the support built in as well." (Justin, 18 November 2026.) His
 * AM4 on the 3.00 beta said the block's code the same day: 0xD1 (209). Open,
 * the wire asks that block for its on and off and its channel and writes
 * them, by the messages every AM4 block gets; closed, it is drawn by its
 * number and asked nothing, as before.
 *
 * OPEN TO EVERY ACCOUNT SINCE 2.1.3 (18 November 2026): "It works. Go ahead
 * and put it out to everybody.." (Justin, with his log: an AM4 on the 3.00
 * beta through a WIDI Jack, the block's channel set, a capture from TONE3000
 * sent, kept on the first try and played in NAM 1). It was his account's
 * from 2.0.9. With it open the capture tools answer an AM4 for every account
 * too (bleWire captureOn), so TONE3000 and the Capture button are on a held
 * AM4 NAM block for everybody. Back to false and it is his account's again.
 */
export const AM4_NAM_FOR_EVERYONE = true

/**
 * THE AM4'S NAM BLOCK'S KNOBS IN EDIT (lib/am4-own-knobs.js), over Bluetooth
 * or a USB cable: Level, Input Gain, Bass, Mid, Treble, Bright and three
 * tone-stack and phase switches, with the Capture button over them.
 *
 * "And go ahead and build it out for the computer and the raspberry pie and
 * do the knobs and edit" (Justin, 18 November 2026). His account first: the
 * names and ranges are the Axe-Fx III's NAM block's, matched to what his
 * AM4 told AM4-Edit, and NO KNOB OF THIS BLOCK HAS BEEN READ OR TURNED FROM
 * THE APP ON A UNIT. It opens when he says so, with its What's new line.
 */
export const AM4_NAM_EDIT_FOR_EVERYONE = false

/**
 * THE AM4'S NAM BLOCK THROUGH THE COMPUTER OR A RASPBERRY PI: named on Play
 * with its on and off and its channels, TONE3000 and the Capture button on a
 * held block (lib/ownBlocks nameAm4Nam; the computer app that carries
 * ForgeFX src/am4Nam.ts sends the block with no slug and answers the
 * captures' routes for an AM4).
 *
 * His account first: NOTHING OF IT HAS RUN ON A UNIT THROUGH A COMPUTER.
 * Through a computer app older than that release the block is what it was
 * (a number). It opens when he says so, with its What's new line.
 */
export const AM4_NAM_THROUGH_COMPUTER_FOR_EVERYONE = false
