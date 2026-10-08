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

This patch leaves out the version number and the build log (docs/expo-builds.md already has build 25's row), so it applies to main as it moves. Apply it with `git apply`, then the steps above.
