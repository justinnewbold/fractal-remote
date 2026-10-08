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

**Before the next Bluetooth build**, two things the AM4 test showed. Apple's own "Network Session 1" (Wi-Fi MIDI, driver `com.apple.AppleMIDIRTPDriver`) was offered as an adapter, picked, and answered nothing; it must not be listed. And the first read after connecting went unanswered every time, so the first ask needs one retry. Both are JavaScript in `mobile/src/lib/bluetooth.js` and `bleWire.js`.

This patch leaves out the version number and the build log (docs/expo-builds.md already has build 25's row), so it applies to main as it moves. Apply it with `git apply`, then the steps above.
