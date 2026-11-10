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
| `phone-turns.patch` | Lets a phone be turned on its side: on Play, on what opens beside Play and in Stage view, for an account the sideways layout is open to (his, until `PHONE_SIDEWAYS_FOR_EVERYONE`). Every other page, every other account and every tablet are as they were. Adds expo-screen-orientation. | **android and ios** (the watch line does not move) |

One patch is waiting, phone-turns (10 November 2026); its section is next.
Before it, android-usb-midi was applied on 4 November 2026 in the
build pull request for the Android build 1.89.36 (an Android build on its
own, Justin's "You are good to do the android build on expo go as soon as
it's ready", since it moves the android line alone), and its file deleted
in the same change. Before it, watch-fill, tablet-turns,
logbox-android and shrink-resources were applied on 26 October 2026, in that order, in the
build pull request for the 1.89.0 build pair (the one that opens Bluetooth
(beta) to customers), and their files deleted in the same change. With
tablet-turns and shrink-resources in, 1.89.0 moves the android and ios
lines of `npm run fingerprint` as well as the watch's, so updates made on
main from that merge on reach only 1.89.0 copies. ble-pair-ios27 was applied
on 24 October 2026 for the iPhone build after 1.88.0 (1.88.3), and its file
deleted in the same change. The four before it
(watch-name, r8, watch-channels and photo-picker) were applied on 23 October
2026 for the build pair after 1.87.52 (1.88.0). What each one carried, and
what goes with it that was not in it, is in its section below.

**phone-turns.patch, and why it waits.** Justin, 10 November 2026, with two
screenshots of his iPhone held on its side and the app still upright:
"Landscape mode on iPhone is not working." It could not: the split for a
phone on its side (lib/twoSides `phoneSidewaysOn`, lib/sidewaysPlay, merged
that day in #850) was drawn for a window no phone could ever give it. An
iPhone was held upright by app.json's `"orientation": "portrait"`, and an
Android phone by plugins/withTabletTurns, which put it back upright at
every configuration change, and a phone turning is one. (His first
landscape screenshot, the one the layout was drawn from, was the website in
the phone's browser.) Asked whether to make the build or do the website
only, he said: "Do both." Letting a phone turn is in the built-in part of
the app on both phones, so it waits here for his yes to the build.

**One thing about the patch file itself.** Its first change to
mobile/app.json starts on the `"orientation"` line with no lines of context
before it, by hand: the line before it is the app's version, and a patch
that quotes the version stops applying at the next version number. If the
patch is ever remade with `git diff`, take those leading lines out again
(the hunk's header is then `@@ -7,4 +7,4 @@`).

**What it does, in the app.** A phone starts upright and stays upright,
except that on Play, on what opens beside Play (Edit, Setlists, All
presets, the tuner in a side, Notes, a held block's knobs) and in Stage
view it may be held on either side as well as upright, never upside down.
The startup card, the walkthrough, the sign-in, the purchase page, Settings
and every page in it, Bluetooth, Troubleshooting, the reports, Gear, How do
you connect to your unit? and the sharing card stay upright: opening
Settings from Play on its side turns the screen upright, and going back
lets it turn again. Only for an account the sideways layout is open to
(App.js `sidewaysAllowed`: his, until `PHONE_SIDEWAYS_FOR_EVERYONE`), so
for every customer the app is exactly as it was until that switch opens.
Only on a phone long enough to split (720 points across on its side: not an
iPhone SE or a 13 mini), which otherwise stays upright rather than show
Play stretched. A tablet (an iPad, or a short side of 600 or more) is asked
for nothing and turns every way, as before. The rule is
mobile/src/lib/phoneTurns.js, and test/phone-turns.mjs runs it over phones,
tablets, every screen and both kinds of account.

**What is in it.**

- **The package**, expo-screen-orientation `~57.0.3` (what `npx expo
  install` gives for Expo 57), in mobile/package.json and
  mobile/package-lock.json. It is the only way the app's own code can say
  which way up the screen may be.
- **The iPhone** (mobile/app.json). `"orientation"` goes from `"portrait"`
  to `"default"`, and `ios.infoPlist` lists the iPhone's ways itself:
  `UISupportedInterfaceOrientations` is Portrait, LandscapeLeft and
  LandscapeRight, with no upside down (Expo's own "default" would add it).
  The package's plugin, with `initialOrientation: "PORTRAIT_UP"`, writes
  `EXDefaultScreenOrientationMask` = `UIInterfaceOrientationMaskPortrait`,
  so an iPhone opens upright before any of the app's code runs. An iPad
  keeps `UISupportedInterfaceOrientations~ipad` with all four, which Expo
  writes for `supportsTablet` as it did, and `UIRequiresFullScreen` stays
  false, which is what makes iPadOS ignore an app's orientation locks
  altogether. `EXDefaultScreenOrientationMask~ipad` =
  `UIInterfaceOrientationMaskAll` is a second guard for the iPad: if that
  start-upright key were ever honoured on one, its own key says every way.
- **Android phones** (mobile/plugins/withTabletTurns.js). The Kotlin it
  writes into MainActivity no longer puts a phone upright at every
  configuration change. A tablet is as before: whatever was asked is set
  back to "unspecified", which is what Google Play asked for in October
  2026 and is unchanged. A phone is put upright only while nothing has been
  asked ("unspecified": every launch, every new MainActivity), and left
  alone once the app has asked. The app asks "portrait" for upright and
  "user" where it may turn (the phone's own choice: it follows the phone's
  auto-rotate switch and is never upside down), and never "unspecified"
  from a phone, which the Kotlin would take for nothing asked. The manifest
  is as it was: no `android:screenOrientation` on MainActivity.
- **The app's own code.** lib/phoneTurns.js (the rule, pure),
  lib/turnScreen.js (the one file that asks the phone, through expo's
  `requireOptionalNativeModule`, so a copy without the package logs one
  line and carries on) and components/PhoneTurns.js (draws nothing; mounted
  once in App.js over every screen; asks only when the answer changes, asks
  nothing on a tablet, and asks Android again when the app comes back to
  the front, since a new MainActivity starts upright).
- **Two corrections to the sideways layout** that real phones need. An
  Android phone on its side keeps its camera clear down ONE side; the rule
  and the line between the sides were worked out as for a fold (the middle
  of the whole screen), which cut one side short and kept a 780-point
  phone, 748 across, from splitting at all. `phoneSidewaysOn` now asks for
  each half of the frame, and App.js puts the line in the middle of the
  frame there (`sidesFrame`); an iPhone, which keeps the same down both
  sides, is unchanged. And lib/screenShape's note on pop-ups says what is
  true now: they were already let turn every way (`ANY_WAY_UP`), and the
  package answers iOS for the whole app, so a pop-up over Settings stays
  upright and one over Play turns with Play.
- **Its tests**: test/phone-turns.mjs (new, in test/run.mjs), and the
  lines of test/duo.mjs and test/two-sides.mjs that pinned the old lock and
  the old Kotlin.

**What it moves, and what that costs.** `npm run fingerprint` with the
patch applied: the android line and the ios line move, and the watch line
does not (checked 10 November 2026, on main at 1.90.26). So it is a build
pair, one iOS slot and one Android. From the merge that applies it, updates
made on main reach only the new copies: the App Store's 1.90.0 and Google
Play's copies keep the last update made before that merge until their
owners take the new version. Nothing about it is one phone alone.

**What was checked for free.**

- `npx expo prebuild --no-install --clean` for both phones, in a scratch
  copy of the tree with the patch in (it runs on Linux; nothing native was
  left in the repository). Info.plist came out with
  `UISupportedInterfaceOrientations` Portrait, LandscapeLeft,
  LandscapeRight; `UISupportedInterfaceOrientations~ipad` all four;
  `EXDefaultScreenOrientationMask` `UIInterfaceOrientationMaskPortrait`;
  `UIRequiresFullScreen` false. AndroidManifest's MainActivity has no
  `android:screenOrientation` and still takes `orientation`, `screenSize`
  and `smallestScreenSize` itself; MainActivity.kt has `holdPhonesUpright()`
  before `super.onCreate` and in `onConfigurationChanged`, with the new
  rule. (Expo says while it runs that it is ignoring `"orientation":
  default` for iOS because the Info.plist list is given. That is the
  intent.)
- `npx expo export` for ios and android with the patch in: both bundle.
- The whole suite with the patch in, and on main with only the patch file
  added (test/mobile.mjs tries it against the tree on every change, and
  web.yml runs the suite a second time with it applied).
- android-minified.yml runs on any pull request that touches
  docs/pending/**: it applies the patch and compiles a real minified
  Android build, so the Kotlin and the package's Android half are compiled
  at no Expo cost, and it starts the app on a phone emulator held sideways,
  which must still be drawn upright, past the startup card and into the
  demo (upright by the rule: the demo has no account the sideways layout is
  open to). The day `PHONE_SIDEWAYS_FOR_EVERYONE` opens, that check has to
  change with it, since Play in the demo will then turn.
- The iPhone's half has one free compile to ask for: duo.yml, started by
  hand on the branch that carries this file, applies the waiting patches
  and builds and opens the iPhone app on Xcode 27.1's simulator, the
  package's Swift with it. It has not been run for this patch yet.
  watch.yml's `iphone` job builds the iPhone project too, on the build pull
  request (it runs when mobile/app.json or the package files change).

**What only a real phone can show**, most likely first:

1. An iPhone on Play, turned on its side: the screen turns, and the two
   halves appear (his account). This is the whole point, and nothing here
   can see it.
2. From Play on its side, open Settings: the screen turns upright. Back to
   Play with the phone still on its side: it should turn back by itself. If
   it waits until the phone is moved, that is iOS, and the fix is in the
   app's code (an update), not another build.
3. The same two on an Android phone, with its auto-rotate on; and with
   auto-rotate off, where Play stays as the phone is locked.
4. An iPad and an Android tablet: every way up on every page, exactly as
   before. The iPad is the one to look at first, since `initialOrientation`
   is new to it.
5. Opening the app with an iPhone already on its side: the splash may show
   sideways for a blink before the app is upright, as an Android phone's
   has since October 2026. iOS draws the splash from Info.plist before any
   code runs, and Info.plist now lists the two sides.
6. The heights. #850's layout measures its own room (the frame under the
   top bar, the top of the tiles), so nothing in it was a fixed guess, but
   its tests' frames were: 108 points off the height, 832 by 332 on a Pro
   Max. The first look says whether the squares, the five buttons along the
   bottom and the bar's buttons sit as the six pictures show.
7. A pop-up over Play on its side (hold a block, the tempo box): it should
   open turned with Play, not upright.

**What goes with it in the build pull request, outside the patch:**

- `(cd mobile && npm install)` after applying it, since it adds a package;
  if the build job then stops at expo-doctor on Expo's package versions,
  run it again with keep_packages ticked (CLAUDE.md says why);
- the review notes for that version (docs/app-store.md), which need one
  plain sentence on turning, since the layout is in the build whoever it is
  open to: on an iPhone held on its side, Play and the pages that open
  beside it turn and show two halves side by side, every other page stays
  upright, and iPads turn every way as before. Google's notes the same;
- no What's new line while it is his account only; the line goes in with
  the pull request that sets `PHONE_SIDEWAYS_FOR_EVERYONE` true, which is
  an update and needs no build once this one is out;
- CLAUDE.md's section on a phone held on its side, which says nothing has
  run on a phone: after the build it should say phones turn only from this
  version, and that older copies show Play upright whatever the switch
  says;
- docs/expo-builds.md's row for the pair.

No store-version key: the code that turns a phone exists only in the new
build, and a copy built before it has no package to ask (lib/turnScreen
finds none and says so once in the log), so no update can turn an older
copy.

**android-usb-midi.patch, and why it waited** (applied for the Android build 1.89.36). Justin, 3 November 2026:
"let's build out the direct plug to the USB for android. I tried it and it
doesn't work." And of the iPhone, the same day: "I've already used my
iPhone and it does connect. It just says it's a Bluetooth connection and
not USB, even though it is USB." The two phones are not the same here. The
iPhone's half of the module has always listed every two-way MIDI port,
cable or Bluetooth, and since 1.87.32 it says which driver each one is on
(Apple's USB MIDI driver for the AM4's own USB-C and for a C2MIDI Pro
plugged straight into the iPhone, in his reports of 27 October 2026), so
the iPhone needs no build: an update (1.89.35) names a cable for what it
is, and Connect no longer opens Apple's Bluetooth screen when one is
plugged in and nothing else could be meant. Android's half opens Bluetooth MIDI devices only, found by a
scan, so a cable never lists, and listing it is native code: a build.

**What it moves, and what that costs.** FractalBleMidiModule.kt only, so
only the android line of `npm run fingerprint` moves; the iPhone and the
watch take the same updates before and after (`npm run fingerprint` with
the patch applied is the check: the android line alone). From the merge that applies it
on, an update made on main is made for the new Android build: Android
phones on Google Play's 1.89.3 (version code 14) keep the last update made
before that merge until they take the new build from Google Play. Because
only Android moves, it can ride the next build pair, or be an Android build
alone if Justin asks for one (the way 1.88.3 was an iPhone build alone);
it gives an iPhone build nothing.

**What the JavaScript expects of it, and why today's builds ignore it.** A
USB entry in the list is `{ id: 'usb:<vvvv>:<pppp>', name, transport:
'usb' }` (the vendor and product numbers in four lowercase hex digits,
with `#2`, `#3` for twins, in the order Android numbered them, so two of
one unit can swap ids after one is replugged; and `usb:name:<product>`
when Android gives no numbers; never Android's own device number, which
changes at every replug), and every Bluetooth entry gains `transport:
'bluetooth'`. `listsUsb()` answers true (the module's way of saying it
lists cables, as `pairsOnIOS27()` says Apple's fix is in); today's builds
have no such function, so `cablesHere()` in mobile/src/lib/bluetooth.js is
false on them and nothing on an Android copy mentions a cable.
`connect('usb:…')` opens the device with no Bluetooth check and no
permission, and says `connected` once its first port is open both ways;
pulling the cable says `disconnected` with reason `removed`, and a plug or
a pull sends the whole list again. Today's Android builds send `{ id:
<Bluetooth address>, name, rssi }`, with no transport and no `usb:` id, so
`isCable` in mobile/src/lib/bleAdapters.js never fires on them: the
JavaScript that uses the patch is on main from 1.89.35 and does nothing on
a copy without it.

**What was checked for free.** android-minified.yml runs on any pull
request that touches docs/pending/**: it applies every waiting patch in
this table's order and compiles a real minified Android build (R8 on), then
starts it on emulators, so the Kotlin is compiled at no Expo cost. web.yml
runs the whole suite a second time with the patch in, and test/mobile.mjs
tries it against the tree on every change. An emulator cannot plug a unit
in, so the cable itself first runs on Justin's phone, from the build.

**What goes with it in the build pull request, outside the patch:**

- the Android words, which an iPhone never shows: "or plug the unit in by
  USB cable" on No adapter found, and a hint for phones that need USB OTG
  switched on in their settings, both behind `Platform.OS` and on
  test/mobile.mjs's KNOWN list (no store text or screen an iPhone reads
  may name Android);
- Google's release notes and App access note (docs/app-store.md, *Later: a
  USB cable*), with nothing new in the Data safety form: no permission and
  no data;
- a What's new line with `only: 'android'`;
- and, if a cable has run on an FM9, Axe-Fx III or VP4 by then, that
  unit's line in shared/bluetooth-gear.mjs's TRIED_NOTES. No text names a
  unit as working by cable before it has.

No store-version key: the code exists only in the new build, so no update
can open it on an older copy. The FM3 stays out of it: its USB port is
serial (FM3-Edit's kind), not MIDI, so Android's MIDI service never lists
it, and a serial driver for Android is a project of its own (docs/later.md).

**watch-fill.patch, and why it waited** (applied for 1.89.0). Justin, 25 October 2026, with a
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

**tablet-turns, logbox-android and shrink-resources, and why they waited**
(applied for 1.89.0, after Justin's yes to the build pair on 25 October
2026: "I approve all that"). Google Play Console's four suggestions for 1.88.0, which Justin
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
  and that is longer than the build. All of them wait through Google's
  review and then Apple's (docs/app-store.md, *Submission day for 1.89.0*,
  step 15). Four in five then wait three quiet days or more at 20% (steps
  14 and 17). If the rollout is halted (*After it is out*, item 2), they get
  no fix by update until another build reaches them, where without these
  patches a halted 1.88.0 still takes updates. iPhones on TestFlight's
  1.88.3 (build 29) wait too, until build 30 is on TestFlight, except with
  logbox-android.patch alone, which moves Android only. Everything merged
  before that day still reaches them. iPhones on the App Store's 1.87.11
  lose nothing: they are held on update 1.87.60 until 1.89.0 anyway.
- **What said 1.89.0's phones stay "Unchanged" was reworded the day they were
  applied** (26 October 2026, in the build pull request), because it was no
  longer so: CLAUDE.md, the paragraph "And say
  so BEFORE a change that would need a build instead of an update" (and the
  same words under "Merge it yourself" and "THAT PULL REQUEST NEEDS JUSTIN'S
  YES"), and its "It is switched on for customers", whose copies on the
  current runtime (TestFlight 1.88.3 and Play 1.88.0) no update after that
  merge reaches; docs/expo-builds.md, the paragraph on the build pull
  request ("its phones' fingerprint says Unchanged"); docs/app-store.md,
  *Submission day for 1.89.0*, step 6, and the *After it is out* table's
  "Android halted | Nothing" row (halted, 1.88.0 no longer takes updates);
  mobile/src/lib/ble-rule.js, the comment's paragraphs WHY THE STORE
  VERSION ("moves the watch's line alone, so the phones' fingerprints stay
  where they are") and AND THAT PULL REQUEST WAITS FOR JUSTIN'S YES ("Its
  phones' fingerprint says Unchanged"); and the watch-fill row, which
  left the table with its patch ("every update keeps reaching every phone,
  before and after the build").
  The build pull request waits for Justin's yes either way; with these in,
  its fingerprint says it is a build too.
- **Google Play's release notes** (docs/app-store.md, *Google Play release
  notes, 1.89.0*) got one bullet for the three, last: "• Android tablets and
  foldables now turn sideways." The block had grown to 498 of Play's 500
  characters by then, so the Bluetooth and sign-in lines were made shorter
  to fit it (496), and the count over the block says so. Nothing goes in
  Apple's notes, because the iPhone app comes out the same.

**tablet-turns.patch, and why it waited** (applied for 1.89.0). Play's "Remove resizability and
orientation restrictions in your app to support large screen devices" quotes
one line of 1.88.0's manifest: MainActivity locked upright
(`android:screenOrientation="1"`), which app.json's "orientation": "portrait"
puts there. On an Android tablet, foldable or Chromebook on Android 12 to 15,
the app held sideways is an upright strip with black bars at its sides; a
tablet on 7 to 11 turns its whole screen upright instead. Android 16 and newer
already ignore the lock on a big screen, and iPads already turn every way. The
patch takes the lock out of the Android manifest and holds the app upright
from MainActivity when the screen is a phone's: a short side under 600 points,
the app's own TABLET_SIDE (shared/device-word.mjs), so the device the app
calls a tablet is the device that turns. It is measured on the whole screen,
never the window, so a tablet with the app beside another one is still a
tablet, and asked again at every fold and unfold. The plugin's comment says
why the screen and not the window, and why the lock leaves the manifest rather
than being lifted once the app starts.

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
sideways again. Each look reads the hold back first, and the tablet is told
first to show an upright app as a strip, as a real Android 12 to 15 tablet
does: its emulator image would otherwise turn the whole screen for the app,
and a turned screen the app fills passes whatever the patch does.

**logbox-android.patch, and why it waited** (applied for 1.89.0). Play's "Your app uses deprecated
APIs or parameters for edge-to-edge" reads, by other apps' reports, every line
of the app's code, code that never runs included. Read the same way, 1.88.0's
code has six such places, none of them the app's own (a forecast: Play
Console's own list for 1.88.0 has not been seen here, and is what to check
this against): React Native's WindowUtil (enableEdgeToEdge, and its old
statusBarHide and statusBarShow), React Native's StatusBarModule, AndroidX's
splash screen 1.2.0, Material Components 1.13.0 (MaterialDatePicker), and
expo-image-picker's crop screen. The app already draws edge to edge correctly
(target 36 forces it, and App.js keeps clear of all four edges), and nothing
clears the notice today: React Native 0.88 still makes most of those calls,
and the splash library has no newer version. Material is the one the app can
take out. It is in the Android app only because Expo's developer error screen,
@expo/log-box 57.0.4, asks for it (its android/build.gradle). This leaves
log-box out of Android's autolinking (`expo.autolinking.android.exclude` in
mobile/package.json, which expo-modules-autolinking 57.0.16 reads for Android
alone), and Material goes with it, from Play's list and from the download. The
notice stays, for the other five.

What a store build loses: nothing. log-box's one Android class,
ExpoLogBoxPackage, gives React Native nothing unless the build is a debug
one made with EXPO_UNSTABLE_LOG_BOX switched on, so in a store build it was
already doing nothing. What a developer's build loses: on Android, a debug
build made with EXPO_UNSTABLE_LOG_BOX=1 shows React Native's own red error
screen instead of Expo's newer one; one made without it already did. The
iPhone keeps log-box, so its fingerprint stays where it is.

What was checked for free, 25 October 2026: Android's autolinking finds 24
modules with the patch and 25 on main, log-box the only one gone, and the
iPhone's still 28, log-box among them. expo-doctor passes (20 of 20), and both
platforms bundle. Nothing else among the app's Android libraries asks for
Material: not their build files and code under mobile/node_modules, nor the
published dependency lists of the image cropper
(com.vanniktech:android-image-cropper 4.7.0), RevenueCat (purchases 10.21.1
and purchases-hybrid-common 19.0.0) and React Native's own Android library;
the app's theme is AppCompat's. android-minified, on its pull request, builds
it, fails if a Material class is left in the built app, and lists what Play's
edge-to-edge notice will find, to read beside the six above and Play Console's
own list. Its test is in test/mobile.mjs: package.json takes no comment, so
the reason lives there and here.

**shrink-resources.patch, and why it waited** (applied for 1.89.0). 1.88.0 already has R8 fully on:
about 83% on each of Play's three measures (Play's line is 25%), and its code
9.0 MB, under Play's 10 MB line. Since September 2026 Play's R8 card has asked
other apps for two things more (quoted from another app's console,
github.com/Selftend/selftend/issues/2335, 11 September 2026; if Justin's card
says something different, this patch's reason changes): optimized resource
shrinking, which this turns on, and an Android Gradle plugin of 9.0 or newer,
which only Expo SDK 58 brings (its React Native, 0.88, uses 9.2.1), a bigger
upgrade for a build pair of its own. `enableShrinkResourcesInReleaseBuilds` in
mobile/app.json turns resource shrinking on, and
mobile/plugins/withR8Optimize.js writes
`android.r8.optimizedResourceShrinking=true` into gradle.properties, which
makes it R8's own: pictures and layouts that only unused library code asked
for go. The gain is small (all the pictures together are 0.58 MB of a download
of about 14 MB), and it takes one line off Play's card.

What it must not drop is anything looked up by name, which no shrinker can
see. The app's own pictures and sounds are found by name (by React Native,
expo-asset, expo-audio and expo-updates), and Expo's bundling writes a keep
list naming every one (res/raw/keep.xml: 61 names in 1.88.0's bundle, 59
pictures and 2 sounds). Three files Google Play's billing library carries for
Google's own services to read are named by nothing in the app, so the plugin
writes a keep file of the app's own for them. Everything else the app needs by
name is named in its manifest or theme (the launcher icon, the splash picture,
the runtime version), which counts as used.

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
for crashes and for any missing resource a library reports, with the demo's
Play in the pictures (a picture React Native cannot find is drawn as
nothing without a word, so the keep-list check is the one that counts).
Drop this patch if that run shows a picture gone.

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
