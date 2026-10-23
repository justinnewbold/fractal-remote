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

Nothing is waiting today. The four that were here (watch-name, r8,
watch-channels and photo-picker) were applied on 23 October 2026 for the
build pair after 1.87.52, and their files deleted in the same change; what
each one carried, and what goes with it that was not in it, is in its
section below until that build is out.

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
