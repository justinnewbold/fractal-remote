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
 * THE DEVICE'S BEAT ON THE UNIT'S BEAT (lib/beatLock, lib/unitBeat), his
 * account only.
 *
 * "The metronome is not matching up properly into the sound coming out of
 * speakers. There's a delay." (Justin, 16 November 2026.) With the unit
 * clicking and the device lighting or clicking beside it, the device now
 * listens for the unit's own beat and moves its own onto it. Whether his
 * unit sends that beat down its USB port has not been seen: with none
 * heard, nothing changes and the log says why. `false` is his account
 * only, as every new thing is; `true` when he has seen it line up.
 */
export const BEAT_LOCK_FOR_EVERYONE = false

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

/**
 * LINING UP THE LIGHT AND THE CLICK (lib/lineUp): on Settings → Metronome,
 * two nudges kept on the device, the light and the device's own click, each
 * Earlier or Later, and Tap along, which sets both from taps on the unit's
 * click. "Will you make sure everything's in sync properly somehow or have a
 * way for a user to calibrate" (Justin, 16 November 2026). Built on his
 * account first, as every new thing is. Off, it is drawn for his account
 * only, and for every other account the nudges are neither drawn nor
 * applied, whatever the device has kept. It opens to everyone when he says
 * so, with its What's new line in that pull request.
 */
export const METRONOME_LINE_UP_FOR_EVERYONE = false

/**
 * QUICK EDIT ON THE APPLE WATCH (lib/watchQuick, lib/watchQuickEdit): a
 * pedal held on the watch opens its channels with a list of the block's
 * knobs under them, and the Digital Crown turns the one picked.
 *
 * "On the watch, we have pushed to hold on the channels to switch amps. Can
 * we set up quick edits on that as well? And change the name to hold to
 * quick edit?" Then, of three pictures: "For the watch, mock up B."
 * (Justin, 12 November 2026.) Built on his account first, as every new
 * thing is, and it cannot show anywhere until an iPhone build carries the
 * watch's half (docs/pending/watch-page-order.patch): the phone says
 * nothing of it to a watch that has not said it knows how. Where it opens
 * it still needs the hold pop-up's own knobs (lib/holdPop popKnobsOn: Edit's
 * door, never a VP4), so this line opens no editing anywhere Edit is
 * closed. Off, it is his account only, and every other account's watch
 * opens a held pedal's channels alone, as it always has. It opens to
 * everyone when he says so, with its What's new line in that pull request.
 */
export const WATCH_QUICK_EDIT_FOR_EVERYONE = false

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
 * (OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE) are switches of their own, still
 * his. On, it also carries the NAM block for everybody, whatever
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
 * Built on his account first, as every new thing is: nobody has switched
 * one of these through a computer yet, and his Raspberry Pi is the first
 * check. Off, it is his account only (lib/ownBlocksHere), and for every
 * other account each stays the New block it was. It opens to everyone when
 * he says so, with its What's new line in that pull request.
 */
export const OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE = false

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
 * tapped from the app on a unit. Off, it is his account only
 * (lib/useEditSettings), and every other account's Edit is the knobs it
 * always was. It opens to everyone when he says so, with its What's new
 * line in that pull request.
 */
export const EDIT_SETTINGS_FOR_EVERYONE = false

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
 * His account first, as every new thing is. NO LIST HAS BEEN READ FROM THE
 * APP, and no pick made from Edit: his first is the first check. Off, it is
 * his account only (lib/useCapturePicker), and everybody else's NAM block
 * says what it said. It opens to everyone when he says so, with its What's
 * new line in that pull request. The capture tools on the device's own wire
 * answer his account alone as well (lib/bluetooth `captures`), so opening
 * this opens those, for reads and the pick, in the same pull request.
 */
export const NAM_PICKER_FOR_EVERYONE = false

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
 * His account first, as every new thing is: sending a capture answers his
 * account alone on the device's own wire as well (lib/bluetooth
 * `captures`), and NO CAPTURE SENT FROM THE APP HAS BEEN KEPT BY HIS UNIT
 * YET. Off, it is his account only (lib/useTone3000Quick) and everybody
 * else's pop-up is the one it was. Opening it to customers is a store
 * version (new for them, and TONE3000 has to sign the screen off), never
 * this switch alone.
 */
export const TONE3000_QUICK_FOR_EVERYONE = false

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
 * PRESET, and no save has gone from the phone to a unit yet. Off, it is his
 * account only (lib/bluetooth saveOverBluetooth): every other account's
 * Bluetooth says what it always said, shows no Save, and a save's frame is
 * refused at the way out.
 *
 * OPENING IT TO CUSTOMERS IS A STORE VERSION, not this switch alone: every
 * copy out was reviewed with notes, and a listing, that say there is no
 * saving over Bluetooth (CLAUDE.md, "It is switched on for customers only in
 * a new store version"), as Edit over Bluetooth itself was (lib/ble-rule.js
 * EDIT_FROM_STORE). So this says true only in the pull request of a build
 * pair whose texts say saving works over Bluetooth, keyed to that store
 * version, and only once he has saved from his phone and said so.
 */
export const SAVE_OVER_BLUETOOTH_FOR_EVERYONE = false

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
 * NOT ONE OF THESE MESSAGES HAS GONE TO A UNIT FROM A PHONE YET: no block
 * placed, no cable, and neither grid read over an adapter. So it is his
 * account only (lib/bluetooth chainOverBluetooth): every other account's
 * Bluetooth answers the four routes "not over Bluetooth" as it always did,
 * shows nothing new, and a frame of these shapes is refused at the way out.
 *
 * OPENING IT TO CUSTOMERS IS A STORE VERSION, not this switch alone: every
 * copy out was reviewed with notes, and a listing, that say blocks are not
 * moved, added or removed over Bluetooth (CLAUDE.md, "It is switched on for
 * customers only in a new store version"), as Edit over Bluetooth itself
 * was (lib/ble-rule.js EDIT_FROM_STORE). So this says true only in the pull
 * request of a build pair whose texts say so, keyed to that store version,
 * and only once he has built a chain from his phone and said so.
 */
export const CHAIN_OVER_BLUETOOTH_FOR_EVERYONE = false

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
 * blocks are drawn where the unit has them, as through the computer. It
 * opens to everyone once his own log from a unit shows the order read
 * agreeing with the status read ("block order from the unit’s grid"), with
 * its line in What's new then.
 */
export const BLOCK_ORDER_FROM_GRID_FOR_EVERYONE = false

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
 * His account first, as every new thing is: NOBODY HAS BUILT A CHAIN THIS
 * WAY ON A REAL UNIT YET, nor run its Undo. Off, it is his account only
 * (lib/useQuickBuild); every other account's empty preset says "This preset
 * is empty." as it always did, and Settings has no Starter chains row.
 * Where it is drawn is lib/quickBuild `quickBuildHere`: never a VP4, only
 * where the unit's capabilities say `gridEdit`, and only on this preset's
 * own chain. It asks nothing about the wire, so it works over Bluetooth on
 * the day the wire says `gridEdit` there.
 */
export const QUICK_BUILD_FOR_EVERYONE = false
