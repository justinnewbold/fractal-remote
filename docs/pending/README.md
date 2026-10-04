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
| `wake-on-tap.patch` | The phone can stay locked in a pocket: each watch tap wakes the app in the background to send the change (PR #641's first version, 1b4d304). | iOS + watch |
| `metronome-sound-and-watch.patch` | The metronome clicks out loud on the phone (expo-audio, a 30 ms click in `mobile/assets/click.wav`, plays with the ring switch on silent and mixes with music), and taps on the Apple Watch on every beat with its own switch on Settings → Metronome. Apply **after** `wake-on-tap.patch`: it was made on top of it. Adds `expo-audio ~57.0.5`, so `npm install` in `mobile/` writes the lockfile. | iOS + Android + watch |
