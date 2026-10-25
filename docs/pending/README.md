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
test/mobile.mjs tries every patch alone against the tree and all of them one
after another in the table's order (in a copy), so a patch remade for one of
those must still pass the other.

| Patch | What it does | Moves |
|---|---|---|
| `watch-fill.patch` | On the Apple Watch, **four or fewer scenes or pedals fill the page** (an AM4's, a VP4's) instead of its top half: the rows stretch to the page under the heading, into half of the bottom margin the screen's rounded corners keep, pedals two across instead of three, a lone scene or pedal across the whole width, and the names and letters grow with their buttons. A scene name of two words or more may take two lines; its type is never bigger than lets its longest word fit, so no word is broken. The whole of a pedal's button takes the tap and the hold, off as well as on (an off pedal used to answer only on its letters and outline). Eight scenes and five or more pedals (an FM3's) are drawn as before, on the same scrolling page. The rules are `fewTiles`, `fillHeight`, `tileRows`, `sceneColumns`, `pedalColumns`, `grownSize`, `wordFitSize` and `sceneNameSize` in mobile/targets/watch/Model.swift, with the watch's own tests, and CI takes two pictures of an AM4-shaped demo (`-am4Demo YES`: am4-scenes.png, am4-pedals.png). | **Watch only** (tried on 25 October 2026: `npm run fingerprint` moves the watch line alone, so every update keeps reaching every phone, before and after the build) |

ble-pair-ios27 was applied on 24 October 2026 for the iPhone build after
1.88.0 (1.88.3), and its file deleted in the same change. The four before it
(watch-name, r8, watch-channels and photo-picker) were applied on 23 October
2026 for the build pair after 1.87.52 (1.88.0). What each one carried, and
what goes with it that was not in it, is in its section below.

**watch-fill.patch, and why it waits.** Justin, 25 October 2026, with a
photo of the watch on an AM4: "On the VP4 and the AM4, can we make the watch
buttons bigger somehow to maximize the watch space? It's already pretty
small and we're only using about half the space.. on the FM3 and other
devices, it seems like it's good." The watch app is built into the iPhone
app, so it reaches a wrist only with the next iPhone build; it rides the
build that opens Bluetooth to customers, and costs nothing of its own. It
was compiled, its tests run and its pictures taken on GitHub's Mac before
it was parked here (watch.yml, dispatched on the branch, four rounds, the
last on 25 October 2026 after an independent review whose findings it
carries: the whole tile tappable, a lone tile full width, no word broken,
the FM3's page untouched). A watch that has not had the build keeps the old
page, which works as it always did.

Nothing goes with it outside the patch: it adds no feature (the same
buttons, bigger), so the Notes for App Review need no line for it. What's
New may say "On the Apple Watch, an AM4's or VP4's scenes and pedals fill
the screen."

**ble-pair-ios27.patch, and why it waited** (applied for 1.88.3). Justin, 24 October 2026, with a
TestFlight crash report from 1.88.0 (28) on iOS 27.0.1: "iPhone App crashed
when trying to enable Bluetooth." The crash is inside Apple's screen, not
ours: `-[CABTMIDICentralViewController loadView]` builds its list from the
status bar's height, which iOS 27 no longer answers, so the table is NaN
points tall and Core Animation throws (CALayerInvalidGeometry, "CALayer
bounds contains NaN"). It is iOS 27's bug in every app that opens that
screen, however it is presented (so 1.87.11 on iOS 27 most likely has it
too: the forum's reports do not say which Xcode built them); Apple's
engineers confirmed it and posted the workaround
this patch uses (developer.apple.com/forums/thread/850584, FB25301268): hand
the screen a table before it loads, so its loadView never runs, then run its
viewDidLoad once by hand, which starts the search. Apple tested it with a
Bluetooth LE MIDI adapter, and other apps have shipped it.

The simulator has no CoreAudioKit Bluetooth screen, so nothing free can open
it. What is checked for free: the patch still applies (test/mobile.mjs), and
duo.yml applies every waiting patch before it builds, so the device build
with Xcode 27.1 compiles this one.

What goes with it that is not in it: until a build carries it, an update on
main keeps Apple's screen shut on iOS 27 (mobile/src/lib/bluetooth.js
pairScreenCrashes), with a line on the Bluetooth page saying why, and lists
any adapter that is already connected. The patch adds `pairsOnIOS27()`,
which reopens it. Bluetooth is the developer's alone, so nothing in the
store texts changes.

**photo-picker.patch, and why it waits.** Justin, 22 October 2026: "Where's
the space to enter a message and upload photos?" The note and the screenshots
go out by an update, with Paste a screenshot on the phone, because the phone
has no photo picker built in and expo-clipboard can read a copied picture. A copied screenshot is easy on an iPhone (Copy and Delete)
and awkward on Android, which has no Copy on its screenshot preview. The
picker is the one-tap way, and it is native, so it waits for the next build
pair. Checked against expo-image-picker 57.0.20's own plugin and manifest:
its manifest asks for CAMERA (blocked by the plugin's `cameraPermission:
false`) and READ and WRITE_EXTERNAL_STORAGE up to Android 12 (already
blocked in app.json); the picker it opens is the system's own (Android's
photo picker, or Google Play's copy of it on older phones), which needs
neither, and on iOS 14 and later PHPicker hands over only what was picked.
No permission is asked before it opens. test/bluetooth.mjs holds the camera
and microphone to off whenever the package is in the app.

What goes with it that is not in the patch: the next version's Notes for App
Review and What's New say that a bug report can carry screenshots chosen
from the phone's photos (Apple's 2.3.1(a)), and the App Store privacy label's
Photos or Videos row (docs/app-store.md, added 22 October 2026) is already
the answer for it. Google Play needs no new permission declaration.

**r8.patch, and why it waits.** Google Play, October 2026, on 1.87.11:
"DEX code optimization is below our threshold … Obfuscation (3%) … Fix by Feb
2027." Google: "From February 2027 … You will need to achieve a minimum of 25%
optimization, obfuscation and shrinking for any app uploads to Play Console"
(support.google.com/googleplay/android-developer/answer/17492799), and a title
below it "may see reduced app visibility and publishing capabilities". Only a
new store build carries it, because R8 runs when the app is compiled; an
over-the-air update cannot change the score either way (the JavaScript is not
DEX). The app's DEX is about 41 MB, four times Play's 10 MB line, so the rule
applies.

What android-minified showed on 16 October 2026 (#717): obfuscation 82.8%,
optimization 82.4% and shrinking 82.7% in the bundle's own r8.json (Play
wants 25%); the DEX down from about 41 MB to 8.7 MB; the deobfuscation map
inside the bundle; the app started on a phone and on a sideways tablet, still
running a minute later with nothing in the log about missing code. And one
surprise: a build without the database rule came out byte for byte the same
as the build with it, because R8 8.12 (the one this React Native's Android
tooling brings) keeps that constructor anyway, and expo-modules-core's own
rules already keep Records whole. The three rules are kept all the same:
they are what Expo 58 ships, and they cost nothing. The fourth rule came
out of a read of everything a minute cannot reach (buying and restoring, an
over-the-air update arriving and launching, Bluetooth, sound, the server and
the relay link, checked against the build's mapping.txt and DEX): nothing
there breaks, but an Expo error code is made from its class's name, and R8
renames the class, so a failed native call would say ERR_A or ERR_F. Nothing
in the app checks those codes; the rule is for the logs. Before applying the
patch, read the latest run of android-minified on its pull request again:
the scores, the minute on each emulator, and the check catching the crash it
makes on purpose. After the Play release, check App
bundle explorer for the three percentages; the deobfuscation map rides inside
the .aab, so nothing is uploaded by hand. Expo SDK 58 does all of this by
default, so an upgrade to 58 replaces this patch (drop the plugin and the
rules then).

**watch-channels.patch, and why it waits.** Justin, 13 October 2026: "Can
I add the tap to hold on the effects switches on the watch where you can
switch through the channels?" — and, before agreeing to it, "as long as it's
not gonna make it so it holds off on future over-the-air updates". It does
not: the watch app is native, so the hold reaches a wrist only with the next
iPhone build, but nothing in this patch moves the Android or iOS
fingerprint, so a build carrying it takes the same updates as the copies
already on phones, and so do they. It was compiled and its pictures taken on
GitHub's Mac before it was parked here (draft pull request #702, closed
unmerged): the watch app, the iPhone app with the watch inside it for the
simulator and for a real device, the watch's own tests, and a picture of a
pedal's channels open (mobile/watch-ci/screens.sh, channels.png).

**The two patches together move the phones.** watch-name.patch changes the
watch's displayName in mobile/targets/watch/expo-target.config.js, which both
phones' fingerprints include. A build with both is a build whose updates no
longer reach the copies already on phones until they take the store update.
A build with only this one keeps every phone on the same updates. They share
no file and apply in either order.

One thing goes with it that is not in the patch: the next version's Notes
for App Review and What's New say that holding a pedal on the watch opens
its channels (Apple's 2.3.1(a): a new feature is described in the notes).

Written again on 13 October 2026 over the tap deadline ("a scene tap that
can't get through is dropped"): a channel picked on the wrist goes with the
moment the phone heard it, `writeChannel(cmd.id, cmd.channel, receivedAt)`,
and is dropped like any other tap that cannot land in time. Nothing else in
it moved.

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
