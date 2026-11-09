# Two sides on big screens, and Derek's block panel

The plan, second draft (8 November 2026). It matches the pictures in
docs/two-sides/
(01 to 09).

## In short

- On an opened iPhone Duo, an iPad on its side, or an Android tablet or folding phone held sideways, the screen can show two sides: Play on one side, and the Tuner, Edit, Setlists or All presets on the other.
- Swap flips the two sides. Either side can fill the screen, and Two sides puts them back.
- Derek's idea is in it too. On a big screen, hold a block and the Scenes column becomes that block's panel.
- None of it needs an Expo build. Every step is an ordinary over-the-air update.
- Each step shows on your account first. Customers only see it once you say it's right.
- About 8 to 9 sessions in all.

## Where you get two sides

- **Two sides:** the Duo opened and held sideways, an iPad on its side, and Android tablets and folding phones held sideways.
- **One screen, exactly like today:**
  - any phone held upright
  - the Duo closed, or opened but held upright
  - an iPad held upright
  - usually, an iPad sharing its screen with another app. It goes by how much room the app gets, so a wide enough window can still get two sides.
- It goes by the size of the screen, not by what kind of device it is.
- On the Duo, the line between the sides sits right on the fold, so nothing you press is on the crease. Each side is about as wide as an iPhone, and the side away from the clock strip is a little wider.
- Play starts on the right with the tool on the left, the way you described it. Swap flips them, and the app remembers your choice.

## What the screen looks like (pictures 1 to 7)

**The bars**

- The app's own top bar (version, the Live pill, Unlock, the speaker and Settings) runs across the whole width above both sides, as it does today.
- Under it, each side has its own bar with three things: its name, Swap and Full screen. The buttons are big enough for a thumb.

**Choosing what goes beside Play**

- Tap a side's name for the list: Tuner, Edit, Setlists, All presets.
- Play is never on the list, because Play is always the other side. Tapping PLAY's name gives the same list, so you can pick what goes beside it.
- The list only offers what works right then:
  - Tuner: only where your unit has one. A VP4 over Bluetooth has no tuner, so it isn't offered there.
  - Edit: only where editing works (see "Who gets what").
  - All presets: only where Play offers it today, which is in the demo or once the unit is answering.
  - Setlists: always, since it doesn't need the rig.

**Play in a side**

- Previous, Tuner, Edit, Tap and Next stay fixed along the bottom, so Next never needs a scroll.
- On the Duo, a big preset scrolls a little above those buttons. The buttons themselves never move.
- When two sides are showing, Play's own buttons open things on the other side:
  - Tuner opens the tuner there, and pressing Tuner again turns it off.
  - Edit opens Edit there, where editing works. Where it doesn't yet (a customer on Bluetooth, say), it says why, as it does today.
  - Setlists opens your setlists there.
  - The preset name opens All presets there.
- All presets in a side stays open after you pick a preset, so you can keep browsing beside Play.

**Full screen and closing**

- Full screen on either bar makes that side fill the screen. Its bar then shows its name and Two sides, which brings the other side back as you left it. Swap comes back with the two sides.
- When Play fills a big screen, its bar shows PLAY and Two sides.
- A tool's own Done closes its side, and Play fills the screen.
- Nothing reopens by itself when the app starts. You start on Play, on the side you picked last.

## Rules that keep it safe on stage

### Play goes first over Bluetooth

- Over Bluetooth there's one adapter, and it carries one question at a time. With Edit beside Play, both of them want it.
- So the line has a fixed order:
  1. Play's presses
  2. Play's own reading
  3. Edit's knob turns
  4. Edit's reading
  5. the watch
- After a scene or preset change, Edit waits for Play to finish reading what changed before it reads its block again.
- One thing can't be helped: a question already on its way to the unit finishes first. On an FM3, FM9 or Axe-Fx III that takes at most about a second and a half.
  - A tap made at that exact moment can still arrive too late and be dropped. That can already happen today behind Play's own reading.
  - The log says when it happens.
- For now this only matters on your account. Customers don't get Edit over Bluetooth until a store version opens it, and nothing else they use crowds the line this way.

### The tuner

- While two sides can show, the tuner always opens in a side, never as today's big pop-up. That holds whether Play's Tuner button, the watch's Tuner page or Siri turns it on.
- The tuner borrows the side. Whatever was there (Edit, Setlists or All presets) comes back when the tuner goes off.
- If Play was filling the screen, turning the tuner on brings back two sides with the tuner beside Play.
- How much room it gets:
  - on an iPad, a narrow column, so Play keeps most of the screen
  - on the Duo, half
- It turns off when you press Stop, close its side, make Play full screen or fold the Duo. It never turns itself back on, and it never starts with the app.
- Your unit's own Tuner setting decides whether the sound mutes while the tuner is on (it usually does). The tuner side says so, in one line under Stop tuner (pictures 1 and 6).

### A Play you can't see does nothing

- When Edit or another tool fills the screen, Play is out of sight. It stays ready so it comes back instantly, but it's asleep:
  - Siri and the watch behave as they do today while Edit is open. Siri tells you to open Play.
  - Play's own pop-ups wait until Play is back on screen: the watch tip, hints, the colours note, the demo's nudge, the channel pop-up and the tempo box.
  - The screen stays awake.
- With two sides showing, Play is on screen, and Siri and the watch work just as they do on Play today.

### Folding the Duo

- **What the closed Duo shows:**
  - Two sides were showing: the front screen shows Play, which is what you need mid-song. The tuner turns off.
  - Edit or another tool was filling the screen: the front screen shows that tool exactly as it was, and nothing is read again.
- **Opening it again:** the tool comes back on its side, on the same block and the same page.
- **Kept when you fold:**
  - which tool was open
  - Edit's block and page
  - the Undo after you changed a model
  - your open setlist
  - which side Play is on
- **Read again:** the block's settings, once, from the unit, when Edit comes back. That takes a moment through the computer and up to a second or so over Bluetooth. The knobs really live in the unit, so this also picks up anything changed on the unit in the meantime.
- **Dropped:**
  - a "Save to another slot" you had half picked. You pick it again.
  - a knob you were turning at the very moment you folded. The last value that reached the unit stands.
- Unsaved changes live in the unit, not on the screen, so folding never loses them. As today, they go at the next preset change.
- Making a side full screen and back works the same way: the hidden tool is put away and comes back like this.

### Unsaved changes get a warning before Play throws them away

- Through the computer, if Edit or Derek's panel has unsaved changes, these ask first, with Save, Don't save or Stay:
  - Previous or Next on Play
  - picking a preset in All presets
  - picking a song in Setlists
- The watch, Siri and the unit's own footswitches can't be asked, so they go ahead as they do today.
- Over Bluetooth, Play doesn't ask. The app can't tell whether you saved on the unit itself, and Edit already says that changes over Bluetooth last until the next preset.

## Derek's idea: hold a block, get its panel (picture 5)

**Where it shows**

- Only where editing works. Everywhere else, holding a block gives today's channel pop-up with A to D (picture 9).
- **Play filling a big screen** (an iPad on its side, an Android tablet sideways, or the Duo with Play full screen): the Scenes column becomes the block's panel, and the blocks stay where they are.
- **Two sides showing:** the panel opens in the other side.
  - If Edit is there, Edit jumps to that block.
  - If the tuner, your setlists or All presets are there, the panel borrows the side (the tuner turns off), and Close gives it back.
- **Phones, and anything held upright:** today's pop-up.

**What's in it**

- The block's name and Close, channels A to D, the model and its knob pages.
- Save shows up when there's something to save, which is through the computer.
- Copy channel and the on/off button are left out, because one tap on the block already does that.
- The block's own Level stays read-only, as it is in Edit. The panel turns Drive, Tone, Gain and the rest. The app has always kept Level away from a finger, because one slip can silence the rig mid-song.

**How it behaves**

- One tap on a block always turns it on or off, whether the panel is open or not.
- Holding another block moves the panel to that block.
- Change preset and the panel follows the same block if the new preset has it. Otherwise it closes.
- Change scene and it shows the new channel.
- It stays until you press Close. There's no timer, and it never reopens when the app starts.
- The heading over the blocks says "Hold for its knobs" where holding opens the panel, and "Hold to switch channels" where it still opens the pop-up.

## Who gets what

- **Through the computer with the full version, and in the demo:** all of it, including Edit and the knobs in Derek's panel.
- **Over Bluetooth or a USB cable into the phone:**
  - Everyone gets two sides with the Tuner (not on a VP4), Setlists and All presets.
  - Edit in a side and Derek's panel are your account only, on the AM4, FM3, FM9 and Axe-Fx III, until a store version opens editing for that unit. Once it does, customers get them with no extra work.
  - Until then, customers keep today's channel pop-up, and Edit isn't on their list.
- **The VP4:** no knobs anywhere and no tuner over Bluetooth. Holding a block does nothing, as today.
- The computer app and the website stay as they are, and no computer update comes out of this.

## The steps

- Every step is an ordinary over-the-air update with no Expo build. It reaches the copies people have now: 1.89.3 on the App Store and 1.89.36 on Google Play.
- Every step shows on your account only, until step 6.
- None of it has to wait for the 1.90.0 build pair, or go in with it.
- It can start once the optional-names change (#828) is in. The Edit work it builds on is already in, as of 1.89.74.

### Step 1: Play first on the Bluetooth line (1 session)

- The order above, with tests.
- Nobody sees a difference yet. Customers' Bluetooth works exactly as it does now, because nothing they use sends Edit's kind of traffic.
- Over-the-air update: yes.

### Step 2: Edit, Setlists and All presets beside Play (3 sessions)

- Two sides, the bars, Swap, Full screen and Two sides, with Play's buttons fixed at the bottom.
- Folding and unfolding as described above, the sleeping Play, and the unsaved-changes question.
- A sideways swipe on Play never closes Edit. Android's back button undoes full screen first, then closes the side.
- Your account only. Over-the-air update: yes.

### Step 3: the tuner in a side (1 session) — done, 1.90.9 (#840)

- Everything in "The tuner" above, whether Play's button, the watch or Siri turns it on.
- Your account only. Over-the-air update: yes.

### Step 4: Derek's panel (2 sessions)

- Everything in Derek's section above.
- Your account only. Over-the-air update: yes.

### Step 5: finishing touches (1 session)

- Pop-ups (the tempo box, the Looper, the channel pop-up, the watch tip) appear over their own side, not across the fold.
- The tempo box works with the keyboard on the opened Duo.
- VoiceOver and TalkBack never read out a hidden side.
- Play opens at the right size inside a side straight away, with no jump.
- Your account only. Over-the-air update: yes.

### Step 6: open it to everyone (part of a session)

- When you say it's right, one small update opens it to customers, with one line in What's new.
- If Apple or Google is reviewing a store version that day (1.90.0, say), the update waits until the review is done.
- Over-the-air update: yes.

## Decisions only you can make

**1. Derek's mockup switches the panel when you tap another block. Should a tap do that, or only turn the block on and off?**
- My pick: a tap only ever turns a block on or off. Holding a different block moves the panel to it.
- Why: on stage a tap has to do the same thing every time. If a tap moved the panel, kicking a drive on mid-song would quietly just show its knobs. If a tap did both, you'd be switching pedals on just to look at them.

**2. Derek asked to "tweak a drive level live". If he meant the block's own Level (its volume), should the panel let a finger turn it?**
- My pick: no. Keep Level read-only, as it is in Edit.
- Why: one slip on Level can silence the rig mid-song, and the app refuses that everywhere on purpose. The Drive knob itself, which is what most players mean, turns freely.

**3. Which comes first: the two sides (your idea) or Derek's panel?**
- My pick: the two sides first, then the tuner, then Derek's panel.
- Why: it's what you asked for, and building the sides first means the panel goes in once, already knowing which side it belongs on.
- If you'd rather get Derek's sooner, his panel can come straight after step 1 and open to everyone on its own, in about 2 sessions.

## Later, not in this plan

- Derek's pedalboard view, with each block drawn as a stomp box showing two or three of its main knobs. It builds on the panel.
- The tuner above Play on a Duo or iPad held upright.
- Placing the line from the Duo's own fold sensor, once your logs from the Duo show it reading right.
- Duo screenshots for Apple, which are required from April 2027.
- A fold reader for Android would be native code, so it would need a build. It's left out.

---

# Engineer appendix

All paths are in `/home/user/fr-editg3` (main is at 1.89.74, with #826 and #827 merged; #828, the optional names change, is open). Line numbers are from 637e80ef and are approximate. Every pass runs `npm test`, then `npx expo export` for iOS and Android, then `npm run fingerprint` (it must say Unchanged), bumps the version in package.json, desktop/package.json and mobile/app.json, and merges once CI is green. Nothing goes in `src/` or `shared/`, so `decide` makes no computer release. What's new gets a line only in step 6: everything before it is his account only.

## A. The rule: mobile/src/lib/paneShape.js (new, no imports)

- Two sides when the frame under the top bar is:
  - at least 760 wide (off again at 720)
  - at least 500 tall (off at 460)
  - at least as wide as it is tall (off 40 under)
  - wide enough that each side is at least 360 after the split
- The 40-point hysteresis copies `LETS_GO` in playShape.js.
- The divider sits at the window's middle: `x = (insets.left + width + insets.right)/2 - insets.left`.
  - On the Duo that gives about 475 and 392 with the 84-pt strip on the right; mirrored when the strip is on the left.
  - On an iPad 11-inch it gives 590 and 590.
- A narrow tool (the tuner) gets 420 when that leaves Play at least 700: 760 on an iPad 11-inch, about 713 on an iPad mini, 956 on an iPad 13-inch. Otherwise it gets the middle (the Duo, an Android Fold).
- It returns `{ two, sideWidth, playWidth, dividerX }`.
- Tests (test/panes.mjs, registered in test/run.mjs):
  - two sides: the Duo open sideways, iPad landscape, a Fold at about 841x673, tablets at 1280x800
  - one screen: the Duo upright (669x951), closed (466x678), Split View (469), every iPhone, iPad portrait (820 and 744), an iPad half at 590
  - the hysteresis, both ways
  - a fail on `Platform.isPad`, `isTablet` or orientation in the rule or the host, as test/duo.mjs already does for Stage

## B. The host: mobile/src/components/Panes.js (new), always mounted

- Critic 5 showed that a host present only in two-side mode remounts Play on every fold, and loses Edit's state. So the host wraps Play and the side tools on **every** device, as a plain `View` (test/duo.mjs:224 allows SafeAreaView only in App.js and SongPicker).
- It has two keyed slots in fixed tree positions, PlaySlot and SideSlot, inside one row:
  - Swap flips `row` and `row-reverse`.
  - Full screen gives the hidden slot width 0, with `accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`.
- **One-side mode reproduces today's switch exactly:**
  - `screen === 'stage'`: PlaySlot is full width and SideSlot is empty.
  - `screen` is `'edit'`, `'setlists'` or `'presets'`: PlaySlot is empty (Stage unmounted, as today, so the watch and Siri go down as today) and SideSlot is full width.
  - Phones therefore see no change.
- Because Stage always sits in PlaySlot, folding and unfolding never remount Play while it is showing: its open sheets and a half-typed tempo survive, which test/duo.mjs:795-850 guards. (Folding with Edit full screen goes to `screen === 'edit'`, which empties PlaySlot as today; Play was asleep there anyway.) Because a full-screened Edit sits in SideSlot in both modes, folding with Edit full screen keeps Edit mounted, with nothing read again.
- The other screens stay outside the host and full screen, as today: Settings, Fixes, Report, Log, Connect, Gear, Bluetooth, Paywall, Waking, sign-in and the walkthrough. Coming back restores the sides from the state lifted into App. `gearBack 'edit'` still applies.
- State in App:
  - `side: { tool: 'edit'|'setlists'|'presets'|null, borrowed: 'tuner'|{block: eid}|null, full: 'play'|'side'|null }`
  - `playOnRight`: on the device, in try/catch, never synced, default true
  - `editKeep: { eid, tab, modelUndo }`, lifted from Edit.js:243 and :267
  - `setlistsKeep`
- `screen` stays the record of which tool is open, so the text pins in test/mobile.mjs:1566 and :3539 (`screen === 'setlists'`, `BENCH && screen === 'edit'`) keep matching. Give the new conditions names; never write them out in comments.
- **Going from two sides to one:**
  - If no side was full screen, set `screen = 'stage'` and keep `editKeep` and `setlistsKeep`, so the closed Duo shows Play.
  - If the side was full screen, keep `screen`, so the closed Duo shows that tool full screen.
  - Turn the tuner off (writeTuner(false)) in either case.
- **Going from one to two:** reopen `side.tool` from what was kept. Edit mounts on `editKeep.eid` and `.tab` and reads that block once (blockParams/blockTypes on mount, Edit.js around 748-780). That read is the honest cost, and the plain part says so.
- Dropped on purpose: `saveTo` (it disarms), `focus`, `restoring` and `undoSaid`. A knob mid-drag keeps the last value that was sent.
- Full screen and back use the same path. A hidden tool side unmounts, its state is kept, and its block is read again when it returns. One mechanism, not two. A hidden Play is the exception: it stays mounted at width 0 and asleep (D).
- Gate: his account (`isAdmin` of the kept sign-in through `haveSession()`, never `currentAccount()`), or `SIDES_FOR_EVERYONE`, which stays false until step 6. Put it in mobile/src/lib/features.js.
- Deliberately update the pins in test/duo.mjs (around 388-412): the useWindowDimensions count, the `screen` count and the firstFrame text.

## C. The bars: mobile/src/components/PaneHead.js (new)

- About 52 tall, with 44-pt buttons and `hitSlop` up to TAP 56 (theme.js:228). Touch areas don't overlap, and nothing pressable sits on the divider.
- Name chips:
  - A tool's chip opens the list: Tuner, Edit, Setlists, All presets, with the footnote "Play is always the other side."
  - PLAY's chip opens the same list, for what goes beside it.
- Swap is on both bars and does the same thing on each.
- Full screen becomes Two sides on the bar of the side that is full. Two sides with no tool chosen yet this run opens the list.
- List conditions, the same ones Play already uses:
  - **Tuner:** `caps?.tuner !== false` (Stage.js:1921; bleVp4.js:124 `tuner: false`)
  - **Edit:** `editDoor(...)` opens (lib/editDoor.js:30; the App.js gate `BENCH && (demo || connected) && (!overBluetooth || editOverBluetooth())`)
  - **All presets:** `demo || link.link === 'connected'` (App.js:1843)
  - **Setlists:** always
- When two sides can show, Play's buttons open the other side: Tuner, Edit, Setlists, and the preset name for All presets. Pass `onOpenSide(tool)` into Stage; in one-side mode they keep today's handlers.
  - Edit opens the side only when `editDoor(...).opens`. When it is `explained` (a customer over Bluetooth on a built unit), the button keeps today's EditWhy sheet, over Play's own side. On a VP4 there is no button, as today.
- Presets gets a `stay` prop, so a pick does not navigate back (Presets.js:431-434).
- Done or Close on a tool closes the side (`BACK_TO` edit:'stage', App.js:304-311).
- EdgeBack (App.js:1678) wraps SideSlot only, so a sideways swipe on Play never closes Edit.
- Android back (App.js:367) unwinds in this order: full screen, then a borrowed tuner or block, then the side, then today's handling.

## D. Play in a side (Stage.js, playShape.js)

- Add `inSide` to `playShape()`:
  - `footFixed: wide || inSide`, so the buttons are always in the fixed strip in a side (critic 1: at 392 the row is under OPENS_AT 550, which today puts Next below the edge).
  - `foldPad: spread && !inSide`, so `foldInset` (playShape.js:165) applies only when Play has the whole window.
- Phones are unchanged, because `inSide` is false there.
- The fixed foot has to fit 392. In the captures behind pictures 1 to 3 and 7 (today's foot, drawn at 392 with the strip fixed), Tuner's word touches its button's edge and Tap's dot sits on its word. In a side narrower than about 420, put each icon above its word or drop it, so every word fits inside its button, and check it at 392.
- The first frame comes from the side's width through a PaneWidth context, not `useWindowDimensions` (Stage.js:349-359, firstFrame/lastPlay).
- Ignore a zero-width `onLayout` while hidden, so `lastPlay` is never overwritten with 0.
- **Asleep (an `awake` prop, false when Play is in the zero-width slot):**
  - `useSiriPlay` (Stage.js:1109) is not registered.
  - `useWatchBridge` (watchBridge.js:110) behaves as unmounted.
  - Sheets that appear on their own are held: the watch tip, coach, ColoursNotice, DemoTrialNudge, EditWhy, UpdateReady, LookUndo and CablePlugIn.
  - The ChannelSheet and the tempo box can't be opened.
  - `useKeepAwake` (Stage.js:223) stays on.
- `playOnScreen` (App.js:672) means "Play is showing" in both modes. `playElsewhereOf` (siri-rule.js:107, App.js:819) takes that instead of `screen === 'stage'`. That fixes critic 4, where Siri would say "open Play" while Play was visible beside Edit.
- Re-render cost: each committed knob ends in a chain re-read with a new block identity (Edit.js:645-648), which redraws Play's tile grid. Memo the tiles or narrow the selectors, and time it on the oldest iPad and Android tablet in the simulator.

## E. Bluetooth order (mobile/src/lib/bleWire.js:518, step 1)

- Today the queue is `PRI = { write: 0, read: 1, poll: 2 }`. Edit's traffic shares write and read with Play's.
- Change it to `{ write: 0, read: 1, editWrite: 2, editRead: 3, poll: 4 }`.
  - Requests tagged `EDITING` in device.js (:273, used at :549, :867, :932, :974, :1115, :1156) carry `editing` down to `ex()`, which maps write to editWrite and read to editRead.
  - Play's presses keep `write` and their `deadline` (TAP_DEADLINE_MS 1500, relay-rules).
  - The watch keeps `poll`.
- An editRead does not start while any write or read is waiting, or for about 400 ms after a Play write went out. That gives Play's follow-up reads (the chain after a preset or scene change) time to queue first.
- Edit's BlockPanel re-keys on `scene` and `bufferRev` (Edit.js:548), so this matters after every scene tap.
- Edit's own one-write-per-control pacing (Edit.js:856) already coalesces a drag. Leave it.
- What can't be fixed: the exchange in flight runs to its end, up to about 1.5 s on gen-3 and longer on an AM4 sending a stored preset. A tap at that moment can be dropped by `tooLate()`, as it can be today behind Play's own reads. The log says so ("not sent, still waiting for the line at its deadline").
- Customers see no change: nothing they use is tagged EDITING over Bluetooth while `EDIT_FROM_STORE` is all null (ble-rule.js:205), and All presets reads no names there (`canScanNames: false`, bleWire.js:1221 and :1239).
- Tests in test/bluetooth.mjs:
  - a write queued behind waiting editReads goes first
  - an editRead never starts while a write or read waits
  - an editRead holds for the quiet window after a write
  - polls are still skipped when anything waits
  - customer-path order is identical (no EDITING tag means the old order)

## F. The tuner (step 3)

- Split Tuner.js:
  - **TunerFace:** the note, the bar, the cents or NOT CONNECTED, the stalled notes including tunerQuietLine and the computer note, NO_UNIT_TUNER, and Stop.
  - **The Modal shell:** used unchanged in one-side mode.
- TunerPane is TunerFace sized by its measured width, not the window (Tuner.js:63 and :94-95). It has Start and Stop, no "tap anywhere to close" (that would be a mis-tap beside Play), and no BlurView. Add one line that the unit's own Tuner setting may mute the sound.
- On and off stays the one rig state, `tunerOn` and `writeTuner` (rig.js:3363). The host watches `tunerOn`:
  - When it becomes true in a window that can show two sides (from the Stage button at :1929, the watch at watchBridge.js:181, or Siri at siri.js:466), set `side.borrowed = 'tuner'`.
  - If Play was full, open two sides.
  - When it becomes false, clear `borrowed` and give back `side.tool`.
- The Stage Modal becomes `<Tuner on={tunerOn && !twoSidesWindow} ...>`, still on Play's frame (Stage.js:1669; test/duo.mjs around 797 and 827). It never opens as a full-window Modal while two sides can show (critic 3).
- `writeTuner(false)` on: closing the side, Full screen on Play, a fold to one side, and the side being taken by Derek's panel.
- Leaving the app does what today's tuner does. The AM4 keep-alive already ends off screen (rig.js:3303-3345).
- bleLink's reopen after a drop (bleLink.js:417-431) only reopens a tuner that was already on, so it follows the same placement.
- The tuner is never restored at launch.
- It is the narrow tool in paneShape.

## G. Unsaved changes (step 2)

- This is only through the computer, where `rig.noteEdited` marks `state.unsaved` (rig.js:1742; it returns early over Bluetooth).
- While `unsaved.number === preset.number` and the Edit side or the panel is open or kept, Play's Previous, Next, an All presets pick and a Setlists song pick go through `confirmLeave()`, a Sheet with Save (useSaveToSlot, then go), Don't save (go) and Stay.
- Watch, Siri and unit footswitch changes are not intercepted. They discard as today (rig.js:198-200, discardUnsaved).
- Over Bluetooth nothing is marked, so nothing asks. Edit's `EDITING_LINE` already says to save on the unit (editWords.js:53).
- Tests: the question shows only with unsaved work, through the computer, with the side open or kept, and never over Bluetooth.

## H. Derek's panel (step 4): mobile/src/components/BlockSide.js (new)

- Export `BlockPanel` (Edit.js:671) as a named export, with ValueBox, Label, ChannelCopy, BlockColour and KNOB_HELP. Do not move it, because about ten tests read Edit.js as text.
- BlockSide wraps it:
  - the name and Close
  - A-D through the same `writeChannel` Play uses
  - the model and the knob pages
  - SaveButton when `pending` (computer)
- Hide Copy channel, Engaged and Color.
- Level stays read-only through `isLevelParam` (guardrails.js:40, `isSilencingParam` :151), exactly as Edit does.
- Gate: `editDoor` opens, which means:
  - through the computer with the full version, or in the demo
  - over Bluetooth or USB only where `editOverBluetooth()` or `editOffered()` (ble-rule.js:225) say so
- Otherwise there is no panel, and today's ChannelSheet appears (Stage.js:1654, :2084). Critic 8: customers over Bluetooth do not trade the Scenes column for four letters.
- A VP4 has no hold (holdDoesSomething).
- Placement, from the hold (Stage.js:1496):
  1. Two sides showing: Edit is the side tool, so set `editKeep.eid` to this block. Any other tool: `side.borrowed = {block}`, the tuner goes off, and Close gives the tool back.
  2. Play has the whole width and is lined (linedPlay.js): it replaces the Scenes lane (laneBox), and the chain stays put.
  3. Otherwise: ChannelSheet.
- Behaviour:
  - A tap is always on/off.
  - A hold on another block moves the panel.
  - On a preset change it follows the same block if present, else closes.
  - On a scene change it shows the new channel.
  - There is no timer, and it is never restored at launch.
  - `scrollEnabled={!held}` on Play's page while a knob is held.
- Every frame goes through the guards Edit uses (am4EditAllowed; gen3Sender with the unit's allow-list) and the EDITING tag, so section E's order applies.
- Words: add `HOLD_FOR_KNOBS = 'Hold for its knobs'` beside `HOLD_FOR_CHANNELS` (play-words.js:62). Use it where a hold opens the panel, and the old one elsewhere. The panel's footnote reads "Hold another block to show its knobs here. One tap on a block still turns it on or off."
- Tests in test/bluetooth.mjs and test/panes.mjs:
  - a customer over Bluetooth gets ChannelSheet, not the panel
  - his account gets knobs
  - a VP4 gets nothing
  - Level is read-only
  - the panel never mounts a second Stage

## I. Polish (step 5)

- Sheet.js centres and measures over its own side, still capped at SHEET_MAX 480.
- TempoBox works with the number pad on the opened Duo.
- VoiceOver and TalkBack skip the hidden slot.
- foldSensor.js logs its fold box against `dividerX` as a debug line only. Nothing draws from it until his Duo logs prove it (docs/later.md, Duo section).

## J. Opening (step 6)

- Set `SIDES_FOR_EVERYONE = true`.
- Hold the merge if a store version is in Apple's or Google's review (CLAUDE.md: a big new phone feature waits).
- Nothing here touches `EDIT_FROM_STORE`. Edit and knobs over Bluetooth for customers stay a store-version decision with review notes, as the ledger rules require.
- What's new line (shared/whats-new.json, then `npm run sync:rules`). It names no device, so no `only` tag, and never says "this phone":
  > "On a tablet held sideways or an opened foldable, the tuner, Edit, your setlists or all your presets can sit beside Play. Swap the two sides, or make either one fill the screen. Where editing works, hold an effect to turn its knobs where the scenes were."

## K. Builds

- No step moves the fingerprint. It is all JS on React Native core (View, onLayout, PanResponder) plus packages already in the build.
- app.json is untouched (`orientation: 'portrait'`, `supportsTablet: true`). The Duo's inner screen ignores the upright lock in the 1.88.0+ builds made with Xcode 27.1 (eas.json image `macos-tahoe-26.6-xcode-27.1`). iPads already turn, and Android tablets have turned since 1.89.0.
- The 1.87.x copies, frozen on update 1.87.60, never see any of this.
- What would cost a build, and is avoided: react-native-gesture-handler or reanimated, multiple windows (scenes) of the app, and an Android fold reader.

## L. Where each critic point went

| Critic point | Where it's handled |
|---|---|
| 1. Play's buttons cut off in a side | D (`footFixed` in a side); boards 01-03 and 07 redrawn with the fixed strip |
| 2. Edit and Play share one Bluetooth line | E, step 1, and the plain-words section "Play goes first over Bluetooth" |
| 3. The tuner as a full-window Modal through the watch or Siri | F: any tuner-on borrows the side, and the Modal is off while two sides can show |
| 4. A hidden Play still acts, and Siri's "open Play" | D (asleep) and `playElsewhereOf` from "Play is showing" |
| 5. "Not read again" was false | B: the host is always mounted; what is kept, read again and dropped is stated plainly |
| 6. Board 05 said tap | Board 05 now says hold; `HOLD_FOR_KNOBS` (H) |
| 7. Level is read-only | H, and decision 2 |
| 8. Bluetooth customers lose the scenes for A-D | H: the panel only where `editDoor` opens; board 09 shows today's pop-up |
| 9. Boards and plan disagreed | Plan follows the revised boards: full-width top bar, a bar on each side, a list without Play that includes All presets |
| 10. The list's conditions | C |
| 11. Unsaved edits lost by Next | G |
| 12. Two wording fixes | "Usually" for iPad Split View; the wider side is the one away from the strip |
