# Finished work waiting for a build

Changes here are done and tested, but they touch the built-in part of the app
(native code), so merging them stops over-the-air updates reaching phones
until a new Expo build is installed. They wait here, as patches against main,
until Justin agrees to the next build.

When the build is agreed:

    git apply docs/pending/<name>.patch      # in the order of the table below
    (cd mobile && npm install)                # when a patch adds a package
    npm run sync:rules
    npm run fingerprint -- --write
    npm test

then bump the version, delete the patch file in the same change, and build.

| Patch | What it does | Moves |
|---|---|---|
| `bluetooth-beta.patch` | Bluetooth (beta): the phone talks straight to the unit through a Bluetooth MIDI adapter, with no computer. Built once, as TestFlight build 25 (1.87.0, a test build that was never sent as an update), and on 8 Oct it read and switched an AM4 through his CME WIDI adapter (it named itself "WIDI Uhost Bluetooth"): preset, names, scene, blocks on and off, channels and tempo. Kept here rather than on a branch so a security fix could go out without it. Not for the store until Justin says so. | android, ios (a new native module, Bluetooth permissions) |

**Since build 25**, from the AM4 test and what Justin said about it ("setting up the Bluetooth is kind of weird. A lot of different buttons to press"), and all of it already in the patch:

- Setting it up is two steps and one button. Step 1 picks the unit. Step 2 is Connect: Apple's Bluetooth screen opens (or the phone looks, on Android), the phone picks the adapter itself when only one could be meant, and Bluetooth turns on. A list appears only when there is a real choice. Once it is on, the one button is Stop. The check is folded under Testing tools.
- Apple's own "Network Session 1" (Wi-Fi MIDI, driver `com.apple.AppleMIDIRTPDriver`) is never offered as an adapter. On the test it was offered first, picked, and answered nothing.
- The first question after connecting went unanswered, so one question now wakes the link before the real ones are asked (`bleLink.js`). Why the first one was lost is not known yet; the debug log of the next test will show it.
- Over Bluetooth the bar at the top says so: CONNECTED is Bluetooth blue instead of green, and the dot beside the unit's name is the Bluetooth mark, blue while the unit answers and red when it does not ("instead of a green dot next to the unit name have a Bluetooth icon"). The adapter's name is in the note under CONNECTED, and a screen reader is told it is Bluetooth.
- On an AM4 over Bluetooth, Play no longer offers Refresh names, which could only fail there: the AM4 gives scene names out only in a whole-preset dump, never sent to it over Bluetooth. Names this phone has already seen through the computer still show, from the same store ("On the Bluetooth connection is it supposed to read the scene names?").

**From the Bluetooth gap audit (9 Oct)**, also in the patch, none of it a new message to any unit:

- A unit that has never answered is sent nothing but "are you there?". The wrong-unit guard only tripped when an AM4 said something; one picked as an FM3 that stayed silent went on being sent FM3 messages by the full read and every check (`unheard` in `bleWire.js`). Reads held this way come back as "not answering"; writes are refused with the reason.
- On an iPhone, Connect with a remembered adapter that is not connected to the phone opens Apple's Bluetooth screen, as the hint always said it would.
- The words: Android 11 and older is told to allow Location and turn it on (not "Nearby devices", which it does not have), and an Android search that finds nothing says so. The iPhone's "no adapter" says to check Bluetooth is on and allowed. A connected adapter the unit never answers says it has to carry MIDI both ways. "What's different from USB" names the looper, volume, unit metronome and Footswitches page.
- The metronome page says the unit's click cannot be switched over Bluetooth, instead of "the unit didn't take it". The tuner with no readings no longer blames a computer that is not there.
- Refresh names on an FM3, FM9 or Axe-Fx III reads the scene names again instead of handing back the kept copy.
- The preset list's Refresh puts a name back when its re-read fails, on screen and on disk. Over Bluetooth a failed read is likely, and the name used to be lost for good.

Left alone, with the reason: the FM9's and Axe-Fx III's extra blocks (Amp 2, Cab 2, Drive 3 and so on) do not show as pedals over Bluetooth. The fix needs their block numbers, which are not in this repository and nobody here has either unit to check them against; a wrong guess could put an output block on the pedal board.

**Decided, 9 Oct: the unlock check over Bluetooth stays as it is for now.** It fails open, like the rest of the app: a phone may drive a unit over Bluetooth when it has paid OR when the store cannot answer (no signal, the store not reached yet, nothing to sell, or a copy that cannot take payments, such as the APK on GitHub). So an unpaid phone with no signal, or that APK, can use Bluetooth without paying. Justin chose this over requiring a remembered "paid" answer ("Leave it as is for now"), which would close that gap at the cost of locking out a paying customer on a fresh install who has never reached the store. Ask again only if he raises it.

This patch leaves out the version number and the build log (docs/expo-builds.md already has build 25's row), so it applies to main as it moves. Apply it with `git apply`, then the steps above.
