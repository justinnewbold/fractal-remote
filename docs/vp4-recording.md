# Recording what VP4-Edit says to the VP4

Fractal Remote controls Fractal units from a phone. Its VP4 side has never
been checked on a real pedal. This guide records what Fractal's VP4-Edit
sends the VP4 and what the pedal answers, while you do a list of everyday
things in VP4-Edit. That recording is what Justin works from.

**You need:** a Mac, or a Windows PC with an Intel or AMD chip; VP4-Edit;
the VP4 and its USB cable; your guitar and amp; about an hour (20 to 25
minutes of it is the recording itself).

**What changes on your pedal:** only your spare slot (or two), which gets a
test copy called TEST ONE, with a scene called TEST SCENE. You pick the
slot, and it must be empty. Everything else you try is put back, or thrown
away without saving. The one pedal-wide thing you change is the tempo, and
step 13 has you put it back by hand. You back up the whole pedal first.

## 1. Before you start

1. Don't update anything today: not the VP4, not VP4-Edit, not your
   computer. If anything offers an update, decline it.
2. **Quit Fractal Remote's computer app**, if you have it, so only VP4-Edit
   talks to the pedal. It can start by itself when the computer starts, so
   check. Mac: its icon in the menu bar > Quit. Windows: right-click its
   icon by the clock, bottom right (click the small ^ arrow first if you
   can't see it) > Quit.
3. **Back up the VP4.** In VP4-Edit, go to Tools > Fractal-Bot and use
   **Receive** (never Send). If it offers a choice, back up everything
   (presets and system settings). Save the file somewhere you can find it,
   and check it is there before going on. Then close Fractal-Bot, and keep
   VP4-Edit open for step 4.
4. **Write these down** (a text file is fine). A recording with no notes
   usually can't be worked out.
   - The VP4's firmware version and date: on the pedal, SETUP > System Info.
     Record on whatever you have; just write it down (4.04 is the newest).
     Don't update it for this.
   - The VP4-Edit version: find About VP4-Edit in VP4-Edit's menus (on a
     Mac, usually the VP4-Edit menu; on Windows, usually Help). 1.01.12 is
     the newest.
   - Your computer's system version. Mac: Apple menu > About This Mac.
     Windows: Settings > System > About, under Windows specifications.
   - **Start preset:** one with a Delay and at least one other effect, a
     Drive if you have one. Write its place and name (for example "B2 Fuzz
     Wall"), its tempo (the number in VP4-Edit's tempo box), which scene
     it's on, and which mode the pedal is in (light colour: green Preset,
     red Scene, blue Effects, yellow Tuner/Tempo).
   - **Spare slot:** one that holds nothing you want. Banks V to Z come
     blank from the factory, but many owners keep their own sounds there,
     so check it really is empty: click it in VP4-Edit's preset list and
     make sure it has no name you know and isn't a sound you use. Not Y1,
     and not your start preset. If you can, pick a second spare far from
     the first (for example V1 and Z4) and check it the same way. Then
     click your start preset again and put it back on the scene you wrote
     down. If VP4-Edit asks whether to save changes, choose Don't Save.
5. Guitar plugged in, amp low. The sound cuts out while the tuner is on;
   that's normal.
6. Unplug any MIDI foot controller from the VP4.
7. Close VP4-Edit, Fractal-Bot and any recording software (Logic, Cubase
   and so on).

Then follow the section for your computer: Mac (2) or Windows (3).

## 2. Mac: MIDI Monitor

### Install

1. Go to https://www.snoize.com/MIDIMonitor/ and click Download. Open
   MIDIMonitor.dmg and drag MIDI Monitor into Applications. The first time
   you open it, macOS may warn that it came from the internet: click Open.
   (Version 1.5.4 is the newest. It works on macOS 27 Golden Gate and 26
   Tahoe, and back to 10.13.)
2. Nothing else to install, and no Privacy setting to change. On its first
   run MIDI Monitor puts a small helper (MIDI Monitor.plugin) in your home
   folder under Library/Audio/MIDI Drivers. It does nothing when MIDI
   Monitor isn't in use. To remove it all later: drag MIDI Monitor from
   Applications to the Trash. Then in Finder choose Go > Go to Folder...,
   type ~/Library/Audio/MIDI Drivers, press Return, drag MIDI
   Monitor.plugin to the Trash, and restart the Mac. (These steps are under
   Uninstall at https://www.snoize.com/MIDIMonitor/docs.)
3. On a MacBook with an Apple chip, the first time the VP4 is plugged in,
   macOS may ask whether to allow the accessory to connect: click Allow. If
   it was refused before: System Settings > Privacy & Security > "Allow
   accessories to connect".

### Set up (VP4 plugged in and on, VP4-Edit closed)

1. Plug the VP4 straight into the Mac, no hub. If your Mac only has the
   small oval USB-C sockets, a cable with that plug on the end, or one
   simple adapter, is fine; a box or dock with several sockets is a hub.
   Keep the Mac on power.
2. Open MIDI Monitor and press Command-comma (MIDI Monitor > Settings...;
   some copies say Preferences...).
   - **Display** tab: Time format "Clock time" (already set).
   - **Sources** tab: under "New windows will observe:", tick "MIDI
     sources" and "Spy on output to destinations". Leave "Act as destination
     for other programs" unticked. Leave "When new MIDI sources or
     destinations are added:" on "Select them in the current window".
   - **Other** tab: leave "Ask to save when a changed window is closed"
     ticked.
   - Close Settings.
3. Press Command-N for a fresh window. Then click the window that opened at
   launch and press Command-W to close it (click Don't Save if asked; it
   holds nothing yet).
4. In the new window, click the grey arrow next to "Sources".
   - VP4 must be ticked under "MIDI sources" (what the pedal says).
   - VP4 must be ticked under "Spy on output to destinations" (what
     VP4-Edit sends).
   - Tick either by hand if it isn't. If there are several VP4 lines, tick
     them all.
   - Leave "Act as destination for other programs" unticked. Under
     "Filter", leave every box ticked.
5. Find "Remember up to [1000] events" in the window. Click in the box,
   delete the 1000, type **1000000** (no commas) and press Return. This
   matters: the 1000 setting threw away the important part of an earlier
   VP4 recording. Every new window starts at 1000 again.
6. Show seconds on the clock, so the video can be matched to the recording:
   - macOS 27 Golden Gate and 26 Tahoe: System Settings > Menu Bar > Menu
     Bar Controls > Clock Options > "Display the time with seconds".
   - macOS 15 Sequoia, 14 Sonoma and 13 Ventura: System Settings > Control
     Center > Clock Options... > the same switch.
   - macOS 11 and 12: System Preferences > Dock & Menu Bar > Clock >
     "Display the time with seconds". Older: System Preferences > Date &
     Time > Clock > the same tick.
   - Turn on Do Not Disturb.
7. Close email and anything private first: the video shows the whole
   screen. Then start a screen recording with your voice: Shift-Command-5 >
   Record Entire Screen > Options > Microphone: the built-in mic > Record.
   (On macOS 10.13 there is no Shift-Command-5: use QuickTime Player > File
   > New Screen Recording.)
8. Go to **4. While recording**. When VP4-Edit opens in step 1, lines pour
   into MIDI Monitor. The Source column must show both "To VP4" and "From
   VP4" lines (the name may be longer). Only "From"? See section 6.

### Saving a part (Mac)

**Never press Clear** (Command-K, or Events > Clear Events). MIDI Monitor
keeps a saved window's file up to date by itself, so Clear would empty the
part you just saved. Each part gets its own window instead.

1. Click the MIDI Monitor window first, so "MIDI Monitor" shows at the top
   left of the menu bar. Then choose File > Save... (or press Command-S).
   The box that opens must ask for a name next to "Save As". If anything
   else happens, press Escape, stop, and tell Justin. Name it vp4-part1
   (then vp4-part2, and so on), Where: Desktop, click Save. Wait until it
   finishes; a big part can take a few seconds.
2. With MIDI Monitor still in front, press Command-W to close that window.
3. For the next part, with MIDI Monitor in front: Command-N, then do set-up
   steps 4 and 5 again (both VP4 ticks, 1000000 and Return).

Only do this where the list says **Save part**: the moments between windows
aren't recorded.

**At the very end:** save and close the last window, quit MIDI Monitor
(MIDI Monitor > Quit MIDI Monitor), then click the stop button in the menu
bar to end the screen recording. The video (.mov) lands on the Desktop, or
wherever Options > "Save to" points, and can be several GB.

## 3. Windows: Wireshark with USBPcap

### Read this first

- **Intel or AMD PCs only.** It does not work on Windows on Arm laptops
  (Snapdragon / Copilot+). To check: Settings > System > About, under
  Device specifications, "System type". If it mentions ARM, use a Mac.
- USBPcap, the part that records the USB cable, adds a small driver to
  Windows, needs a restart, and is marked experimental. One open report
  (March 2026) has USBPcap 1.5.4.0 causing a blue screen on Windows 11
  25H2 (a recent Windows 11 update; Settings > System > About shows yours
  under Version).
- To remove it later: Settings > Apps > Installed apps, click the three
  dots next to USBPcap > Uninstall, then restart the PC. USBPcap has its
  own line in that list, so remove it on its own. Wireshark and Npcap (the
  other small driver the installer adds) can be removed the same way, or
  kept.
- If you'd rather not install any of it, that's fine: use a Mac, or just
  tell Justin.
- Each part can be hundreds of MB to several GB, because the VP4 also sends
  its sound over USB. Keep about 20 GB free.

### Install

1. If they aren't already on the PC, install the VP4 USB driver and
   VP4-Edit (from https://www.fractalaudio.com/vp4-downloads/), and check
   that VP4-Edit connects. Don't remove or change Fractal's own VP4 driver;
   USBPcap sits next to it.
2. Go to https://www.wireshark.org/download.html. Under Stable Release
   4.6.9, click "Windows x64 Installer" (Wireshark-4.6.9-x64.exe) and run
   it.
3. Click through the License page ("Noted"), Choose Components, Additional
   Tasks and the install folder, leaving everything as it is.
4. "Packet Capture" page (Npcap): leave it as it is.
5. "USB Capture" page: tick **"Install USBPcap 1.5.4.0"** (it starts
   unticked). Then Install.
6. Two small installers open, one after the other:
   - Npcap: I Agree, keep its ticks, Install, Finish.
   - USBPcap: I Agree, Next, Install, Close.
7. Save and close any other work, then on the last page choose "Reboot
   now". The restart is needed.
8. After the restart, check that your mouse, keyboard and other USB things
   still work. If anything misbehaves, see section 6.

### Record

1. Save and close any other work first (because of the blue-screen report).
2. Plug the VP4 straight into the PC, no hub, and switch it on.
3. If Fractal Remote's computer app is running again after the restart,
   quit it: right-click its icon by the clock, bottom right (click the
   small ^ arrow first if you can't see it) > Quit. While it's open,
   VP4-Edit can't reach the pedal. Close VP4-Edit, Fractal-Bot and any
   recording software.
4. Show seconds on the clock, so the video can be matched to the recording:
   - Most Windows 11 PCs: right-click the taskbar clock > "Adjust date and
     time" (or Settings > Time & language > Date & time). Open "Show time
     and date in the System tray" and tick "Show seconds in system tray
     clock".
   - If that isn't there: Settings > Personalization > Taskbar > Taskbar
     behaviors > "Show seconds in system tray clock".
   - Turn on Do not disturb.
5. Close email and anything private first: the video shows the whole
   screen. Then start a screen recording with your voice: press
   Win+Shift+R (Snipping Tool), pick the whole screen, switch the
   microphone on in its toolbar (it can start muted), then Start. Use the
   built-in mic or one with a normal plug, not a USB mic or webcam:
   Wireshark would record it along with the pedal.
6. Click Start, type Wireshark, right-click Wireshark in the list > "Run as
   administrator" > Yes.
   - The start screen lists USBPcap1, USBPcap2 and so on. Hold Ctrl and
     click every USBPcap line.
   - No USBPcap lines? Check it was run as administrator. Still none?
     Restart the PC.
7. **Privacy:** this records everything on those USB ports, including
   typing on a USB keyboard.
   - Don't type anything private while recording (TEST ONE is fine).
   - Save the files to the PC's own drive, not a USB stick or drive.
   - If you're comfortable with it: click the gear next to the USBPcap line
     whose "Attached USB Devices" list shows the VP4, untick "Capture from
     all devices connected" and tick only the VP4. Otherwise leave it.
   - Leave "Inject already connected devices descriptors into capture data"
     ticked.
8. Click the blue shark fin ("Start capturing packets"). **Then** go to
   **4. While recording**, whose step 1 opens VP4-Edit.
   - If Windows asks "Do you want to allow this app to make changes to your
     device?" for USBPcapCMD, click Yes.
   - You should see bursts of lines in time with your clicks.

### Saving a part (Windows)

1. Click the red square (Stop).
2. File > Save As..., keep the type "pcapng", name it vp4-part1.pcapng
   (then vp4-part2.pcapng, and so on), choose the Desktop (or Downloads, if
   your Desktop is backed up to OneDrive, because these files are big),
   Save.
3. Click the shark fin again for the next part (if Windows asks to allow
   USBPcapCMD, click Yes). If Wireshark asks whether to save before
   starting a new capture, choose "Save before Continue".

Only do this where the list says **Save part**.

**At the very end:** stop and save the last part, quit Wireshark, then
click Stop in the Snipping Tool toolbar. The video (.mp4) saves itself to
Videos > Screen Recordings. Afterwards you can remove USBPcap as "Read this
first" says, then restart.

## 4. While recording

**How to do each step**

- Say what you're about to do, do it **once**, say the number or name now
  on screen, then hands off for 5 seconds.
- Click nothing else between steps. Even opening an effect makes VP4-Edit
  ask the pedal about it, which muddles the steps.
- Footswitches are numbered 1 to 4 from the left. The pedal steps assume
  the factory footswitch layout. If you've changed yours, use the
  footswitch that does that job on your pedal and say which. Change modes
  the way you normally do.
- If you need a break, take it straight after saving a part, never in the
  middle of one.
- **Never click Save in parts 1 to 3, and never press Command-S or Ctrl-S
  while VP4-Edit is in front.**
- If VP4-Edit asks whether to save changes when you change preset, choose
  **Don't Save** (it may say No or Discard; pick whichever doesn't save).
- Don't use the mouse scroll wheel over VP4-Edit's knobs or boxes: it can
  change values.
- If VP4-Edit has no Tuner or TAP button, say so out loud and carry on.

Start by saying out loud: the firmware, the VP4-Edit version, your start
preset and scene, and your spare slot(s).

### Part 1: looking only (about 6 minutes)

1. Open VP4-Edit. Wait until the preset list and the four effects show,
   then 10 seconds more.
2. Preset menu > Refresh Preset Names. Wait until it finishes.
3. Click effect 1 to open its page, change nothing, wait 5 seconds. Then
   effects 2, 3 and 4.
4. If VP4-Edit has a Tuner button: click it, play the open A string for
   about 5 seconds, say the note it shows, and close it in VP4-Edit. If
   there is none, say "no tuner in VP4-Edit".
5. On the VP4: press footswitches 3 and 4 together (or Mode Select >
   Tuner), play the A string, then tap footswitch 4 to leave. Don't press
   PAGE RIGHT (that's the pedal-wide tuner settings).
6. Scenes in VP4-Edit. If the preset isn't on scene 1, click 1 first and
   say so. Then click these one at a time, 5 seconds apart:
   **2, 1, 3, 1, 4, 2, 3, 2, 4, 3, 4, 1**.
7. On the pedal, in Scene mode (red), tap footswitch 2, wait, then
   footswitch 1.
8. Presets in VP4-Edit: click the place right after your start preset,
   then a far one (for example M3), then your start preset again.
9. On the pedal, in Preset mode (green), tap the footswitch of the next
   preset in the bank, wait, then your start preset's footswitch.
10. Optional, look only; skip it if unsure. In VP4-Edit, open the Setup
    page's MIDI/Remote section. Click no box and use no scroll wheel there.
    Say or write the numbers shown for Scene Select, Tuner, Tempo Tap, FX
    1-4 Bypass and FX 1-4 Channel. Close it.

**Save part 1** as "Saving a part" says for your computer. On a Mac that
means a new window afterwards, both VP4 ticks again, and 1000000 and Return
again.

### Part 2: tempo, on/off, channels (about 4 minutes)

All of this is put back, or thrown away in part 4.

11. Say the tempo shown. Set it to 120, wait, then to 90 (VP4-Edit's tempo
    box, or the Controllers > Tempo page).
12. If VP4-Edit has a TAP button, click it 4 times evenly and say the
    tempo. Then on the pedal, press footswitches 3 and 4 together
    (Tuner/Tempo mode), tap footswitch 1 four times, say the tempo, and tap
    footswitch 4 to leave.
13. Put the tempo back: type the number you wrote down into VP4-Edit's
    tempo box. This one matters: tapping on the pedal sets the VP4's tempo
    for the whole pedal, not just this preset.
14. In VP4-Edit, turn effect 1 off, wait, on. Then effect 2 off, wait, on.
15. On the pedal, in Effects mode (blue), tap effect 1's footswitch: off,
    wait, on.
16. In VP4-Edit, on the Delay, say which channel it's on, click channel B
    (or A if it's already on B), wait, then click the channel it was on.
17. On the pedal, in Effects mode, hold the Delay's footswitch to show its
    channels and tap B (or A if it's already on B). A tap picks the channel
    and leaves that page. Wait, then hold it again and tap the channel it
    was on.

**Save part 2** as "Saving a part" says for your computer. On a Mac that
means a new window afterwards, both VP4 ticks again, and 1000000 and Return
again.

### Part 3: knobs and switches (about 4 minutes)

18. On the Delay's page, say Mix's number, set it to exactly 25, wait, then
    75, wait, then back to where it was. Type the numbers if VP4-Edit lets
    you; otherwise drag and say where it landed.
19. Look at the Delay's Tempo setting. If it says NONE: set Time to 500 ms,
    wait, then 250 ms, wait, then back. If it shows a note value (for
    example 1/8 DOT), skip this step and say so: Time is locked while it
    follows the tempo.
20. Change the Delay's Tempo setting from NONE to 1/4, wait, then back to
    NONE. If it wasn't NONE, set it to NONE, wait, then back.
21. Change the Delay's Type to another model, saying both names, wait, then
    back. This resets the Delay's settings. That's fine: nothing is saved,
    and part 4 throws it away.
22. Optional: the same Type change on the Drive.

**Save part 3** as "Saving a part" says for your computer. On a Mac that
means a new window afterwards, both VP4 ticks again, and 1000000 and Return
again.

### Part 4: saving and naming, spare slot only (about 4 minutes)

23. Click your spare slot in VP4-Edit's preset list to load it. If asked
    whether to save changes to the preset you were on, choose **Don't
    Save**. Say the place and name now on screen. This throws away every
    change from parts 2 and 3: your start preset stays exactly as stored.
24. Change the preset's name to TEST ONE in VP4-Edit's name box. Don't
    save. Wait 5 seconds. (If the name can only be typed in the Save
    window, go on to step 25.)
25. Click Save.
    - If a window opens, check twice that the place shown is your spare
      slot (the one now loaded) and the name is TEST ONE, then confirm.
    - If it saves without asking, that's fine: the loaded place is the
      spare slot.
26. Optional: save again, but only if the Save window lets you pick the
    place. Choose your second spare slot and confirm. Otherwise skip.
27. If VP4-Edit lets you name scenes, rename scene 1 to TEST SCENE, then
    Save again, checking the place shown is one of your spare slots. If you
    can't find a way to name a scene, say so and skip this step.
28. Click your start preset to load it again. Put the pedal back in the
    mode it was in. Quit VP4-Edit and wait 5 seconds.

**Save part 4, then stop the screen recording** (see "Saving a part" and
"At the very end" for your computer).

Your pedal is now as you found it, apart from the test copy in your spare
slot(s), which you can save over any time.

## 5. Sending it

1. Put the part files in one zip:
   - Mac: select the vp4-part .mMon files on the Desktop, right-click >
     Compress.
   - Windows: select the .pcapng files, right-click > Compress to > ZIP
     File.
2. Put the zip, the screen recording and your written notes into a Google
   Drive, Dropbox or WeTransfer link. They're too big for email, and can be
   too big for a free Dropbox or WeTransfer account too. Google Drive's free
   15 GB usually fits. If nothing fits, tell Justin.
3. Send the link to Justin.

Optional extra, your call: VP4-Edit keeps a file listing every effect's
knob names. Its name starts with effectDefinitions. If you find it in one
of these folders, add it to the zip; if not, skip it:

- Mac: ~/Library/Application Support/Fractal Audio/VP4-Edit/ (in Finder,
  Go > Go to Folder... and paste that).
- Windows: %APPDATA%\Fractal Audio\VP4-Edit\ (paste that into File
  Explorer's address bar).

## 6. If something goes wrong

- **Clicked something by mistake:** say so out loud and carry on.
- **VP4-Edit asks whether to save changes:** Don't Save, every time. The
  only saving is the Save button in part 4, into your spare slot.
- **Mac, only "From VP4" lines, never "To VP4":** close VP4-Edit and stop
  the screen recording. Quit everything and restart the Mac (a quicker
  thing to try first is Special > Rescan MIDI in MIDI Monitor). If Fractal
  Remote's computer app opens by itself, quit it again. Open MIDI Monitor
  before VP4-Edit, do Mac set-up steps 3 to 8 again (a fresh window, both
  VP4 ticks, 1000000 and Return, the clock, a new screen recording), then
  start part 1 again from step 1. If it still only shows "From", record
  anyway and say so in your notes: that half is still useful. A Windows PC
  with Intel or AMD is the other way.
- **Mac, a few doubled lines:** harmless.
- **Mac, a message that the MIDI server can't be opened** (in MIDI Monitor
  or Audio MIDI Setup): stop and tell Justin.
- **Windows, mouse, keyboard or other USB things misbehave after
  installing, or a blue screen:** uninstall USBPcap (Settings > Apps >
  Installed apps, three dots next to USBPcap > Uninstall) and restart the
  PC. If that doesn't fix it: click Start, type "restore point", open
  "Create a restore point", click System Restore..., and pick the one made
  when USBPcap was installed. It may not be there, because Windows only
  makes them when System Restore is switched on. Then tell Justin.
- **Windows says a driver can't load, or suggests switching off Core
  isolation / Memory integrity or Smart App Control:** don't switch them
  off. Stop and tell Justin.
- **One of your own presets changed by mistake:** stop and tell Justin
  before doing anything else. Your backup from section 1 has the original.
