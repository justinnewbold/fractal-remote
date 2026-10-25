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
| `tablet-turns.patch` | On an **Android tablet, foldable or Chromebook, the app turns sideways**, and an Android phone stays upright as it is. The upright lock comes out of the Android manifest (the one line Play's large-screen notice quotes), and MainActivity holds the app upright itself when the whole screen's short side is under 600 points, the app's own TABLET_SIDE, asked again at every fold and unfold: mobile/plugins/withTabletTurns.js, listed in mobile/app.json, with its test in test/duo.mjs. The iPhone keeps its lock and an iPad its four ways: app.json still says "portrait", and the iPhone app comes out the same. | **Android and iPhone** (tried on 25 October 2026: `npm run fingerprint` moves the android and ios lines and leaves the watch's; app.json and the plugin file are hashed for both phones, though nothing in the iPhone app changes) |
| `logbox-android.patch` | **Expo's developer error screen (@expo/log-box) is left out of the Android app**, and with it Google's Material Components, which only it asks for and which is one of the places Play's edge-to-edge notice names. One entry in mobile/package.json (`expo.autolinking.android.exclude`), with its test in test/mobile.mjs. A store build loses nothing: the screen does nothing outside a developer's build. | **Android only** (tried on 25 October 2026: the android line moves, the ios and watch lines stay) |
| `shrink-resources.patch` | **R8 shrinks the Android app's pictures and layouts too**, the line Play's R8 card still asks for: `enableShrinkResourcesInReleaseBuilds` in mobile/app.json, and mobile/plugins/withR8Optimize.js makes it R8's own (`android.r8.optimizedResourceShrinking`) and writes a keep file for the three files Google Play's billing library carries for Google's own services. Every picture and sound the app finds by name stays, held by the keep list Expo's bundling writes. Its test is in test/mobile.mjs. | **Android and iPhone** (tried on 25 October 2026: the android and ios lines move, the watch's stays; app.json and the plugin file are hashed for both phones) |

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

**tablet-turns, logbox-android and shrink-resources, waiting for Justin's
yes.** Google Play Console's four suggestions for 1.88.0, which Justin
pasted on 25 October 2026 with: "R8 and the image fix are quick wins at
build time. The large-screen change is the one most worth doing for reach,
since a lot of guitarists keep a tablet on a music stand." They are meant to
ride the 1.89.0 build pair, which is being made anyway, so they cost no build
of their own. But they move the phones' fingerprints, which 1.89.0's would
otherwise leave alone (only the watch's moves, from watch-fill.patch), and
that is his to decide. Each is its own patch, so any one can be dropped by
deleting its file and its row. What goes with all three that is not in them:

- **Updates stop reaching the store copies already out there until they take
  1.89.0.** From the merge that applies any of them (the 1.89.0 build pull
  request) on, an update made on main is made for 1.89.0's fingerprint.
  Android phones on Google Play's 1.88.0 (version code 12) keep the last
  update made before that merge until they install 1.89.0 from Google Play,
  and so do iPhones on TestFlight's 1.88.3 (build 29), except with
  logbox-android.patch alone, which moves Android only. Everything merged
  before that day still reaches them. iPhones on the App Store's 1.87.11
  lose nothing: they are held on update 1.87.60 until 1.89.0 anyway.
- **What says 1.89.0's phones stay "Unchanged" is reworded the day they are
  applied**, because it is no longer so: CLAUDE.md, the paragraph "And say
  so BEFORE a change that would need a build instead of an update" (and the
  same words under "Merge it yourself" and "THAT PULL REQUEST NEEDS JUSTIN'S
  YES"); docs/expo-builds.md, the paragraph on the build pull request ("its
  phones' fingerprint says Unchanged"); docs/app-store.md, *Submission day
  for 1.89.0*, step 6; and the watch-fill row above ("every update keeps
  reaching every phone, before and after the build"). The build pull request
  waits for Justin's yes either way; with these in, its fingerprint says it
  is a build too.
- **Google Play's What's New** gets one line for the three: "On Android
  tablets and foldables, the app now turns sideways." Nothing goes in
  Apple's notes, because the iPhone app comes out the same.

**tablet-turns.patch, and why it waits.** Play's "Remove resizing and
orientation restrictions in your app to support large screen devices" quotes
one line of 1.88.0's manifest: MainActivity locked upright
(`android:screenOrientation="1"`), which app.json's "orientation": "portrait"
puts there. On an Android tablet, foldable or Chromebook older than Android
16, the app held sideways is an upright strip with black bars at its sides.
Android 16 and newer already ignore the lock on a big screen, and iPads
already turn every way. The patch takes the lock out of the Android manifest
and holds the app upright from MainActivity when the screen is a phone's: a
short side under 600 points, the app's own TABLET_SIDE (shared/device-word.mjs),
so the device the app calls a tablet is the device that turns. It is
measured on the whole screen, never the window, so a tablet with the app
beside another one is still a tablet, and asked again at every fold and
unfold. The plugin's comment says why the screen and not the window, and why
the lock leaves the manifest rather than being lifted once the app starts.

Sideways, Play shapes itself by its own width, as it already does on an iPad
and an Android 16 tablet (mobile/src/lib/playShape.js: whole names and fixed
buttons from 621, four scenes and six pedals from 700, eight pedals from
936). The other pages stretch edge to edge, and work; centering them is an
update for later, and helps iPads too. The one thing a phone can see: held
sideways with auto-rotate on, the splash screen may show sideways for a
blink at launch before the app turns upright. A phone held upright, or with
auto-rotate off, sees nothing different.

What was checked for free, 25 October 2026: its test runs the plugin against
stand-ins for Expo's config plugins and the template's MainActivity, and
holds its line to TABLET_SIDE. `expo prebuild` in a copy of the app wrote a
manifest with no lock and a MainActivity with the rule, and a second
prebuild left it as it was. That MainActivity.kt, word for word, compiled
with no warning, with the Kotlin and Android Gradle plugin this React Native
uses (2.1.20 and 8.12.0), against React Native 0.86.3's own Android library
and Android 16 (API 36), with stand-ins for the two Expo classes it imports.
The iPhone settings `expo config --type introspect` reads (Info.plist:
upright on an iPhone, all four ways on an iPad) are the same as main's, and
both platforms bundle. What only a run shows is android-minified's, on this
patch's pull request: a phone emulator held sideways keeps the app upright,
and an Android 15 tablet shows it filling the screen sideways, upright, and
sideways again.

**logbox-android.patch, and why it waits.** Play's "Your app uses deprecated
APIs or parameters for edge-to-edge" reads every line of the app's code,
code that never runs included. In 1.88.0 it finds six places, none of them
the app's own: React Native's WindowUtil (enableEdgeToEdge, and its old
statusBarHide and statusBarShow), React Native's StatusBarModule, AndroidX's
splash screen 1.2.0, Material Components 1.13.0 (MaterialDatePicker), and
expo-image-picker's crop screen. The app already draws edge to edge
correctly (target 36 forces it, and App.js keeps clear of all four edges),
and nothing clears the notice today: React Native 0.88 still makes most of
those calls, and the splash library has no newer version. Material is the one the
app can take out. It is in the Android app only because Expo's developer
error screen, @expo/log-box 57.0.4, asks for it (its android/build.gradle).
This leaves log-box out of Android's autolinking (`expo.autolinking.android.exclude`
in mobile/package.json, which expo-modules-autolinking 57.0.16 reads for
Android alone), and Material goes with it, from Play's list and from the
download. The notice stays, for the other five.

What a store build loses: nothing. log-box's one Android class,
ExpoLogBoxPackage, gives React Native nothing unless the build is a debug
one made with EXPO_UNSTABLE_LOG_BOX switched on, so in a store build it was
already doing nothing. What a developer's build loses: on Android, a debug
build made with EXPO_UNSTABLE_LOG_BOX=1 shows React Native's own red error
screen instead of Expo's newer one; one made without it already did. The
iPhone keeps log-box, so its fingerprint stays where it is.

What was checked for free, 25 October 2026: Android's autolinking finds 24
modules with the patch and 25 on main, log-box the only one gone, and the
iPhone's still 28, log-box among them. expo-doctor passes (20 of 20), and
both platforms bundle. Nothing else among the app's Android libraries asks
for Material: not their build files and code under mobile/node_modules, nor
the published dependency lists of the image cropper
(com.vanniktech:android-image-cropper 4.7.0), RevenueCat (purchases 10.21.1
and purchases-hybrid-common 19.0.0) and React Native's own Android library;
the app's theme is AppCompat's. android-minified, on its pull request,
builds it, fails if a Material class is left in the built app, and lists
what Play's edge-to-edge notice will find, to read beside 1.88.0's six
above. Its test is in test/mobile.mjs: package.json takes no comment, so
the reason lives there and here.

**shrink-resources.patch, and why it waits.** 1.88.0 already has R8 fully
on: about 83% on each of Play's three measures (Play's line is 25%), and its
code 9.0 MB, under Play's 10 MB line. Since September 2026 Play's R8 card
asks for two things more: optimized resource shrinking, which this turns on,
and an Android Gradle plugin of 9.0 or newer, which only Expo SDK 58 brings
(its React Native, 0.88, uses 9.2.1), a bigger upgrade for a build pair of
its own. `enableShrinkResourcesInReleaseBuilds` in mobile/app.json turns
resource shrinking on, and mobile/plugins/withR8Optimize.js writes
`android.r8.optimizedResourceShrinking=true` into gradle.properties, which
makes it R8's own: pictures and layouts that only unused library code asked
for go. The gain is small (all the pictures together are 0.58 MB of a
download of about 14 MB), and it takes one line off Play's card.

What it must not drop is anything looked up by name, which no shrinker can
see. The app's own pictures and sounds are found by name (by React Native,
expo-asset, expo-audio, and expo-updates, which copies every one of them at
the first launch), and Expo's bundling writes a keep list naming every one
(res/raw/keep.xml: 61 names in 1.88.0's bundle, 59 pictures and 2 sounds).
Three files Google Play's billing library carries for Google's own services
to read are named by nothing in the app, so the plugin writes a keep file of
the app's own for them. Everything else the app needs by name is named in
its manifest or theme (the launcher icon, the splash picture, the runtime
version), which counts as used.

What was checked for free, 25 October 2026: its test runs the plugin against
stand-ins, and `expo prebuild` in a copy wrote the line into gradle.properties
beside the two expo-build-properties writes, and the keep file. A small app
built with the Android Gradle plugin 8.12.0, R8's resource shrinking and Play
Billing 8.3.0 showed why both keep lists matter: without the app's keep file
the billing library's three files were gone from the APK, and with it all
three were there; and a picture named in a keep list stayed while one named
nowhere went, even though the code looked up a name made at runtime that
began the same way. android-minified, on its pull request, builds the real
app and fails if any name in either keep list is missing from it (tried on
itself with a name planted to be missing), and reads each emulator's minute
for anything missing by name, with the demo's Play in the pictures. Drop
this patch if that run shows a picture gone.

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
