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
| `watch-name.patch` | The Apple Watch app is called **Fractal Remote** instead of plain "Fractal", under its icon and in the iPhone's Watch app, and the phone's watch tips (Settings, WATCH_KEEP: "tap Fractal Remote", "comes back to Fractal Remote", "Fractal Remote stays on screen") name it the same way. | Android, iOS and watch (tried on 13 October 2026: changing `displayName` in mobile/targets/watch/expo-target.config.js moves all three) |

**watch-name.patch, and why it waits.** Justin, 12 October 2026, about "the
Fractal app": "a fractal app is probably gonna confuse people to think it's
made by fractal, which would be like the FM3 edit." The phone, the browser
and the computer were renamed by an update that day; the watch could not
be, because its name is built into the iPhone app. Because the change moves
the fingerprint, the new tips reach only the build that carries the new
name, and the copies already on phones keep "tap Fractal", which is what
their watch still says. Settings' metronome line already says "while the
Fractal Remote app is open on the watch", so it needs nothing.

One thing goes with it that is not in the patch, because the text it would
change is a record of what was sent: the next version's Notes for App Review
start from the 1.87.11 block in docs/app-store.md, which says "open Fractal
on the watch" (as the 1.86.83 block does). The new notes say **open Fractal
Remote on the watch**.

test/mobile.mjs fails while the watch is called anything but Fractal Remote
and this patch is not here, and holds the tip's "tap …" to the watch's name
either way.

The last patch before this one, `bluetooth-beta.patch`, went into
1.87.1 on 10 October 2026, when Justin said "If Bluetooth is ready, let's get
it submitted": Bluetooth (beta) for everyone who has unlocked the app, with a
beta note, the parts and how they plug in, and the setup guide at
fractal.newbold.cloud/bluetooth.html. What it carried, and why each part is
the way it is, is in that change's pull request and in the comments of the
files themselves (mobile/src/lib/bluetooth.js, bleWire.js, bleLink.js,
mobile/src/screens/Bluetooth.js, shared/bluetooth-gear.mjs). The next day,
11 October, it went back to Justin's account alone, by an update ("I just
feel like it's not ready to have public"); the guide moved to
bluetooth-guide.html, and CLAUDE.md says how it is gated.

Still true from the work it carried:

- **Decided, 9 Oct: the unlock check over Bluetooth stays as it is for now.**
  It fails open, like the rest of the app: a phone may drive a unit over
  Bluetooth when it has paid OR when the store cannot answer (no signal, the
  store not reached yet, nothing to sell, or a copy that cannot take
  payments, such as the APK on GitHub). Justin chose this ("Leave it as is
  for now") over requiring a remembered "paid" answer. Ask again only if he
  raises it.
- Left alone, with the reason: the FM9's and Axe-Fx III's extra blocks
  (Amp 2, Cab 2, Drive 3 and so on) do not show as pedals over Bluetooth.
  The fix needs their block numbers, which are not in this repository and
  nobody here has either unit to check them against; a wrong guess could put
  an output block on the pedal board.
