# One bench session: the FC6, the FM3 and FM3-Edit

This is for one sitting at home with your FM3 and FC6, before anything in
Fractal Remote is allowed to change a footswitch. Today the app only looks
at your switches (Settings → My rig → Footswitches). Changing a ring colour,
a label or the layout from the app is not built, and won't be until this
session shows how FM3-Edit does it and what the FM3 keeps afterwards.

What it finds out, in order:

1. what FM3-Edit sends the FM3 when it changes one ring colour, one label
   and the layout, and whether it does anything extra to keep the change;
2. what is still there after the FM3 is switched off and on again;
3. which FC6 switch lights up for which spot on the app's Footswitches page;
4. whether what the app says each switch picks ("Scene 3", "Preset 125")
   matches what FM3-Edit says.

**You need:** your Mac; the FM3 and its USB cable; the FC6 and the XLR
cable it normally uses; FM3-Edit; your phone with Fractal Remote; about an
hour.

(Have an Axe-Fx III as well? It is the better unit for the recording part:
see "With an Axe-Fx III, instead or as well", near the end, before you
start.)

**What changes on your FM3:** one switch's ring colour and one switch's
label, on one layout, and which layout is on. All three are put back by
hand in step 6. Nothing else is touched, no preset is saved, and you back
up the whole FM3 first, so nothing can be lost even if something goes
wrong.

**One thing to know first.** Fractal's FM3 manual says the FM3 isn't a USB
MIDI device: FM3-Edit talks to it over its own USB link. So the recorder
below (MIDI Monitor) may show nothing from the FM3 at all. Step 2.5 checks
that in a minute. If it shows nothing, don't try to fix it: do everything
else here anyway. The before-and-after readings in the app, the
switch-off check and the FC6 table are most of what's needed, and the
screen recording shows exactly what you clicked.

## 1. Before you start

1. Don't update anything today: not the FM3, not the FC6, not FM3-Edit, not
   the Mac. If anything offers an update, decline it.
2. Switch the FM3 off, plug the FC6 into the FM3's FASLINK socket with its
   XLR cable, the way you normally use it, and switch the FM3 back on. The
   FC6's switches should light up.
3. Plug the FM3 into the Mac with its USB cable, straight in, no hub.
4. **Quit Fractal Remote's computer app**, so only FM3-Edit talks to the
   FM3: its icon in the menu bar → Quit. It can start by itself when the
   Mac starts, so check.
5. **Back up the FM3.** Open FM3-Edit, then Tools → Fractal-Bot (it's
   built into FM3-Edit; the standalone Fractal-Bot is the same thing). Use
   the **Receive** tab, never Send. Tick **System** (that's where the
   footswitch layouts, colours and labels live) and all the preset banks.
   Save it in a folder named with today's date, for example "261108 - FM3",
   and check the files are there before going on. Then close Fractal-Bot
   and quit FM3-Edit.
6. **Write these down** (a text file is fine):
   - the FM3's firmware version: on the FM3, press SETUP; the version is
     shown at the top of the Setup menu;
   - FM3-Edit's version: FM3-Edit menu → About FM3-Edit;
   - the Mac's system version: Apple menu → About This Mac;
   - which layout the FM3 is on: on the FM3's home page, the number in
     brackets next to FC Layout (knob E);
   - which layout the FC6 is on, if its little screens say.
7. Pick the switch you'll change: one on a layout you don't use much, not
   the Master layout (Layout 9), and not the middle switch's hold (that
   opens the Master Layout Menu). Write down its layout, and which of the
   twelve spots it is (FM3-Edit numbers them 1 to 12).

## 2. Before: what the app reads

1. Start Fractal Remote's computer app again (FM3-Edit stays closed).
2. On your phone: Settings → My rig → Footswitches. It's only there when
   the FM3 is connected through the computer, not on Bluetooth.
3. Pick the layout from step 1.7, and the view your switch is on. In the
   app, View 1 is spots 1-3, View 2 is spots 4-6, View 3 is 7-9 and View 4
   is 10-12; Switch 1, 2 and 3 are the three in that view, left to right.
4. Take a screenshot of what it says for that switch: tap, hold, label and
   light. If the app also says which layout is on now, which layout names
   it shows, or what a switch picks ("Scene 3", "Preset 125", "Drive 1
   on/off"), screenshot that too. (Those need the newest computer app; an
   older one just doesn't show them.)
5. Quit Fractal Remote's computer app again: menu bar icon → Quit.

## 3. Set up the recorder (MIDI Monitor)

1. Get MIDI Monitor from https://www.snoize.com/MIDIMonitor/ (Download,
   open the .dmg, drag it into Applications). The first time, macOS may say
   it came from the internet: click Open.
2. Open MIDI Monitor and press Command-comma (Settings):
   - **Sources** tab: tick "MIDI sources" and "Spy on output to
     destinations". Leave "Act as destination for other programs" unticked.
   - Close Settings.
3. Press Command-N for a fresh window, then close the window that opened at
   launch with Command-W (Don't Save).
4. In the new window, find "Remember up to [1000] events", click the box,
   type **1000000** and press Return. (The 1000 setting throws away the
   important part.)
5. Click the grey arrow next to "Sources". Is there an FM3 line under "MIDI
   sources" or "Spy on output to destinations"? If yes, tick every FM3 line
   in both. **If there's no FM3 anywhere, that's the case from the top of
   this guide:** write "MIDI Monitor saw no FM3" in your notes, leave MIDI
   Monitor open anyway, and carry on with the screen recording only.
6. Show seconds on the clock, so the video can be matched up: System
   Settings → Menu Bar (or Control Center) → Clock Options → "Display the
   time with seconds". Turn on Do Not Disturb.
7. Close email and anything private (the video shows the whole screen),
   then start a screen recording with your voice: Shift-Command-5 → Record
   Entire Screen → Options → Microphone: the built-in mic → Record.

## 4. While recording: four changes in FM3-Edit

**How to do each step:** say what you're about to do, do it **once**, say
what's on screen now, then hands off for 5 seconds. Click nothing else in
between. Don't use the scroll wheel over FM3-Edit's boxes: it can change
values. If FM3-Edit asks to save a preset, choose **Don't Save**.

1. Open FM3-Edit. Wait until it has finished loading, then 10 seconds more.
2. Open FM3-Edit's footswitch section (it may be called FC Controllers,
   Footswitches or Layouts). Go to the layout from step 1.7. Change
   nothing; wait 10 seconds.
3. Click your switch to open it. Change nothing; wait 5 seconds.
4. **Ring colour:** on the switch's Tap side, change Switch Ring Color to a
   colour it isn't now (Purple is a good one), saying the old and the new
   colour out loud. Look at the FC6 and the FM3: say which switch, if any,
   changed colour.
5. **Label:** change the Tap label to Custom and type **TEST** (or, if it's
   already Custom, change the text to TEST), saying the old text out loud.
   Look at the FC6 and the FM3 again: say which little screen, if any, now
   says TEST.
6. **Layout:** change which layout the FM3 is on (FM3-Edit's Devices page,
   Current Layout on the FM3's row) to another layout, saying both numbers.
   Say what the FM3's switches and the FC6 now show.
7. **Keeping it:** if FM3-Edit shows a Save, Store, Send, Write or Apply
   button anywhere on the footswitch pages, click it once and say its name
   out loud. If there's none, say "no save button". (The FM3 manual says
   footswitch changes take effect with no need to store, so "none" is a
   likely answer.)
8. Quit FM3-Edit. Wait 5 seconds.

**Save the recording:** click the MIDI Monitor window, then File → Save…
(Command-S), name it fc-part1, Desktop, Save. Then stop the screen
recording (the stop button in the menu bar). Don't press Clear in MIDI
Monitor.

## 5. After: what stayed

1. Start Fractal Remote's computer app. On your phone, Footswitches, the
   same layout, view and switch as in step 2. Screenshot what it says now.
2. Write down which layout the FM3's home page says it's on (FC Layout,
   knob E), and which layout the FC6 is on.
3. Switch the FM3 off, wait 10 seconds, and switch it back on. Wait for it
   to start.
4. Look at your switch on the FM3 or FC6: is it still Purple? Does its
   screen still say TEST? Which layout is the FM3 on now? (The FM3 goes
   back to its startup layout when it's switched on, so the layout
   changing back is expected; write down what you see either way.)
5. Read the switch in the app once more (the computer app reconnects by
   itself after the FM3 restarts; give it a moment) and screenshot it.

## 6. Put it back

1. Quit Fractal Remote's computer app, open FM3-Edit.
2. Set the switch's ring colour back to what it was, and its label back to
   what it was (from your step 4 notes).
3. Put the FM3 back on the layout it was on (from step 1.6).
4. Quit FM3-Edit. If anything looks wrong, the backup from step 1.5 has
   everything: Fractal-Bot → Send → the System file.

## 7. The FC6 table

With the computer app running again and the FM3 on the layout you use most,
fill this in. "Spot" is FM3-Edit's number for the switch in that layout (1
to 12). "In the app" is where the Footswitches page shows that spot.

| FC6 switch (from the left) | Its little screen says | Its ring colour | Spot in FM3-Edit (1-12) | In the app (View, Switch) |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |

And the FM3's own three switches on the same layout:

| FM3 switch (from the left) | Its little screen says | Spot in FM3-Edit (1-12) | In the app (View, Switch) |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

If the app shows which layout is on now, add one line: what the app says,
what the FM3's home page says, and what the FC6 is on.

If it shows what switches pick, add one line each for a Scene switch and a
Preset switch: what the app says it picks, and what FM3-Edit says (for
example "app: Scene 3, FM3-Edit: Scene 3", or "app: Preset 125, FM3-Edit:
Preset 124"). One of each settles how the numbers count.

## 8. Sending it

Put fc-part1 from the Desktop, the screen recording (.mov), your
screenshots and your notes with the two tables into one Google Drive or
Dropbox folder, and send the link. The backup from step 1.5 stays with you;
it isn't needed.

## With an Axe-Fx III, instead or as well

"I also have an Axe-FX III coming today so we could use that as well if we
want instead of the FM3 or both either way." (Justin, 12 November 2026.)

Both is best, and each gives something the other can't:

- **The FM3** is the only unit the app reads the live footswitch setup
  from today, so the before and after screenshots (steps 2 and 5) only
  work there.
- **The Axe-Fx III** is the one the recorder should actually see. Unlike
  the FM3, it shows up on a Mac as a MIDI device, and that is how its
  editor, Axe-Edit III, talks to it. So this is the unit most likely to
  show what an editor sends when it changes a switch, which is the one
  thing editing in the app is waiting for.

If there's only time for one, do the Axe-Fx III.

The steps are the same, with these differences:

1. Everywhere this guide says FM3-Edit, use **Axe-Edit III**. Fractal-Bot
   is in its Tools menu too; back up System and the presets first (step
   1.5), the same way.
2. The FC6 plugs into the Axe-Fx III's FASLINK II socket with the same XLR
   cable. Switch the Axe-Fx III off before plugging it in.
3. **Skip step 2, and 5.1 and 5.5:** the app's Footswitches page doesn't
   show the live setup on an Axe-Fx III yet. Instead, take a phone photo of
   the FC6 before, after the changes, and after switching the Axe-Fx III
   off and on.
4. In step 3.5, look for an **Axe-Fx III** line under "MIDI sources" and
   under "Spy on output to destinations", and tick every one. If it's
   there, the recording will have what we need. If it isn't, write "MIDI
   Monitor saw no Axe-Fx III" and carry on, as with the FM3.
5. The Axe-Fx III has no footswitches of its own, so every "look at the
   FM3" is "look at the FC6", and the second table in step 7 is left out.
   To find which layout it is on, look for FC Controllers under SETUP on
   the front panel, or use what Axe-Edit III shows.
6. Name the saved recording **fc-axefx3** instead of fc-part1, so the two
   units' files can't be mixed up, and write down the Axe-Fx III's
   firmware and Axe-Edit III's version as in step 1.6.

Do one unit at a time, with the other one unplugged from the Mac.

## If something goes wrong

- **Clicked something by mistake:** say so out loud and carry on.
- **FM3-Edit won't connect:** check Fractal Remote's computer app is quit
  (menu bar), unplug and replug the USB cable, and open FM3-Edit again.
- **A switch or layout you didn't mean to touch changed:** stop, and put it
  back in FM3-Edit by hand if you know what it was. If you don't, the
  backup from step 1.5 has the original: Fractal-Bot → Send → the System
  file. Then say what happened when you send the link.
- **The FC6 goes dark:** switch the FM3 off, check the XLR cable at both
  ends, switch it on again.
