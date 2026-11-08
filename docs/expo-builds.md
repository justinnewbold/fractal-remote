# Expo builds used, month by month

Justin gets **15 iOS and 15 Android** Expo builds a month. A build is only
started when he says yes (CLAUDE.md), and iPhone and Android are always
built together.

Add a row every time a build is started, including one that fails after
being queued: it still used a slot.

The one exception so far: 1.88.3 on 24 October 2026, iPhone only, because
only the iPhone's fingerprint moved and Justin asked for "the iPhone
build". When Android's fingerprint has not moved, an Android build would be
the same as the one already in the store, and Android keeps taking updates.

**The build that opens Bluetooth (beta) to customers says so in its row**,
in these words in What it was for: "Bluetooth (beta) for customers". Write
them in that row alone, the build whose review notes describe it, and only
for a build that opens it on every phone the row built. It is one build
pair, one row built on both phones, and the threshold is set on both
phones together: the test refuses an opening marked on one phone alone, a
split row (one phone's build marked, the other's of the same version not),
and a threshold set on one phone only. If a one-phone opening is ever
wanted, the rule in test/ledger.mjs is changed first, on purpose, and says
why. test/bluetooth.mjs
reads every row against the rule in mobile/src/lib/ble-rule.js: until a row
says it, every build here has to stay closed to a customer on both phones;
once one does, `BLUETOOTH_FROM_STORE` has to be set for each phone that row
built and has to open on that row's version, so no later update can set it
back and take Bluetooth away from the copies that were reviewed with it.
The opening build's row is written in the first pull request after the
build is started, before any other merge. A ledger-test failure that names
the threshold and this app's version in the meantime means one of two
things: if a build was started from that threshold, the row is missing, and
the fix is the row, never moving the threshold; only if no build was ever
made from it is the threshold set back to null, or moved with the version.
The pull request that writes the row also sets `OPENED_AT` in
test/ledger.mjs to that build (its version, and the threshold on each
phone), and the test fails until it does. From then on the row, the
threshold and the pin each hold the others, so a later change cannot take
the row out and set the threshold back together without undoing all
three.

The pull request that sets the threshold, the build pull request, is merged
only after Justin's yes to the build and right before the pair is started,
never on green alone: its fingerprint moves on both phones and the watch
(the waiting patches applied in it, 26 October 2026), and its merge puts a
public APK that opens Bluetooth on the Releases page (CLAUDE.md says why).
From that merge on, updates made on main reach only 1.89.0 copies: phones
on TestFlight's 1.88.3 and Play's 1.88.0 keep the last update made before
it until they take 1.89.0 from the store.

**A build that opens Edit over Bluetooth to customers says so too, and
names its units**, in these words in What it was for: "Editing over
Bluetooth for customers: " and the units that build opened, by the names
the Bluetooth page gives them, as
"Editing over Bluetooth for customers: AM4, FM3".
Each unit opens on its own row, the build whose store version opens that
unit: the AM4 and the FM3 can open in one version, and the FM9 and the
Axe-Fx III stay closed and open in a later one of their own, with a row of
their own then. The list is the names alone (AM4, FM3, FM9, Axe-Fx III),
parted by commas or "and", and ends at the next full stop or bracket; the
words with no list after them, or a name that is not one of those (the VP4
has no Edit over Bluetooth), fail the test. The same rules as Bluetooth's
hold each unit, with its own switch and its own pin: its entry in
`EDIT_FROM_STORE` in mobile/src/lib/ble-rule.js, null until the build pull
request sets that unit to the build's version on both phones, and its entry
in `EDIT_OPENED_AT` in test/ledger.mjs, set in the pull request that writes
the row, for every unit the row names and no other. A unit the row does not
name stays null, or keyed to a later store version of its own. Until a row
names it, Edit over Bluetooth on a unit is Justin's account's alone, on
every copy, by update.

**That pair, 1.89.0, is started with the Send box unticked**, the one build
where it is: platform `all`, profile `production`, and "Send it to
TestFlight, and to Google Play production" left off. Ticked, Android would
go straight to Google's review before its release notes and App access note
are in. The iPhone then goes to TestFlight with a second run
(platform `ios`, "Skip building; send the last build that succeeded"),
which spends no slot, and Android is uploaded by hand in Play Console.
docs/app-store.md, *Submission day for 1.89.0*, has the steps; the row says
how each phone was sent.

**And on the day a build goes live in a store, move its number in
`public/store-versions.json`** (`ios` for the App Store, `android` for Google
Play), in its own pull request, that day and not before: live means
"Ready for Distribution" on the App Store, and rolled out on Google Play's
production track, not just sent for review. The phone app reads that file
once a day and tells a phone whose store copy is older that a newer one is
in the store (mobile/src/lib/store-rule.js). A number moved early sends
people to a store that does not have it yet; one never moved leaves the old
copies, which stop getting updates once the new build changes what an update
needs, with nothing telling them. It says 1.87.11 for both since 13 October
2026.

## October 2026

| Date | Version | iOS | Android | What it was for |
|---|---|---|---|---|
| 3 Oct | 1.86.47 | 1 | — | The first build with the Apple Watch app inside (TestFlight build 22) |
| 3 Oct | 1.86.47 | — | 1 | The Play closed-testing build, so testers took updates again |
| 3 Oct | 1.86.53 | 1 | 1 | Delete account (Apple 5.1.1(v)), privacy manifests, the watch note, and the resubmission |
| 6 Oct | 1.86.83 | 1 | 1 | Apple refused build 23 (guideline 4: the watch icon's black background). The light-ground watch icon, plus the two pieces waiting for a build: watch taps with the phone locked, and the metronome's sound and wrist tap |
| 8 Oct | 1.87.0 | 1 (TestFlight, build 25) | 1 (errored on Expo's side: "temporary network issue", CREDENTIALS_TEMPORARY_NETWORK_ERROR, a minute in; counted, as every started build is) | Bluetooth (beta), a TEST build: made from branch claude/fractal-remote-continue-ljfqcd (draft PR #671, never merged; the work now waits in docs/pending/bluetooth-beta.patch), never sent as an update, takes none of main's. Not the store build: the cells say so in words, so the What's live page keeps 1.86.83 as the store copy |
| 10 Oct | 1.87.1 | 1 | 1 | Bluetooth (beta) for everyone who has unlocked the app ("If Bluetooth is ready, let's get it submitted"): the native Bluetooth MIDI module, the beta note, What you need and the setup guide, the iPhone Bluetooth permission check, Auto appearance on iPhone, three unused Android permissions dropped. iOS to TestFlight, Android straight to Google Play production. Started from main right after PR #680 merged |
| 11 Oct | 1.87.11 | 1 | 1 | The App Store's iPhones get every fix since 1.86.83: the pay-once fix (nobody is sold the full version twice), account help (the Confirm button, and look-in-Spam lines), the metronome on and off in the volume pop-up with its flash and click on the same beat, the AM4's own tuner, and Bluetooth (beta) kept to the developer's account. And the 1.87.1 builds' first-launch BLUETOOTH (BETA) card is gone, because this build carries the hidden version inside it. iOS to TestFlight (then the App Store submission, in place of build 26), Android straight to Google Play production. Started from main 3e7ffbf, mobile.yml run 38162666072 ("Yes spend the builds") |
| 24 Oct | 1.88.0 | 1 | 1 | The build pair after 1.87.11: Siri (nine App Shortcuts and Settings → Siri), the wider Play on iPad and an opened iPhone Duo with the fold sensor, screenshots picked from Photos in reports (the camera never used, and blocked on Android), the watch's hold-for-channel and Boost words and its name Fractal Remote, R8 code shrinking for Google Play, the fractalremote:// links for everyone, and the startup card built in, which closes the 1.87.11 first-launch gap. iOS to TestFlight (build 28), Android straight to Google Play production (version code 12). Started from main 8e6042d, mobile.yml run 40109325503 ("Go ahead and do the iPhone build and android build"). Phones on 1.87.11 and 1.87.1 keep 1.87.60, the last update made for them (main 45f9927), until they take 1.88.0 from the store |
| 24 Oct | 1.88.3 | 1 | — | iPhone only, TestFlight build 29: Apple's own fix for its Bluetooth MIDI pairing screen, which crashes the app on iOS 27 (TestFlight 1.88.0 (28) on iOS 27.0.1; developer.apple.com/forums/thread/850584), and Bluetooth (beta)'s page with Connect at the top. The one time the two phones were not built together, and why: only the iPhone's fingerprint moved (ios e56f74b8…; Android 5205f144… and the watch stayed where 1.88.0 left them), so an Android build would have been 1.88.0 again, and Android's 1.88.0 (version code 12, in Google's review) keeps taking updates. Started from main fc9ed4e, mobile.yml run 40117469824 ("Yeah, go ahead and do the iPhone build now"); Expo build 56246296, submitted to TestFlight. Phones on 1.88.0 (28) keep the last update made for it (main d58abf0, which keeps Apple's screen shut on iOS 27 so it cannot crash) until they take build 29 |
| 26 Oct | 1.89.0 | 1 | 1 | Bluetooth (beta) for customers, on all five units (AM4, FM3, FM9, Axe-Fx III, VP4), from store version 1.89.0 on both phones; with the watch's fuller AM4/VP4 page and Android tablets turning sideways. Started 02:10 UTC from main d734540, mobile.yml run 40257649461 (platform all, profile production), after Justin's "Just get it built and pushed to Apple" and "I approve all that". Send was TICKED, not left off as planned: Justin's call, "I don't want managed publishing on in Android. Just do it.", so Managed publishing stays off and Android goes live as soon as Google approves it. iOS Expo build f0af201b-65d6-4a74-a5e5-168ab7f38386 (TestFlight build 30, runtime c16f1c0d…) sent to TestFlight, and still to be added to the 1.89.0 version for review in App Store Connect by Justin; Android Expo build ac2f6f31-5423-4f77-9cd8-67f782aa858e (version code 13, runtime 25ad57fe…) sent straight to Google Play production. Phones on TestFlight's 1.88.3 and Play's 1.88.0 keep the last update made before d734540 until they take 1.89.0 from the store |
| 26 Oct | 1.89.3 | 1 | 1 | The 1.89.0 version for the App Store brought up to date before Justin submits it ("i havent submitted the 1.89.0 build yet so i want it all up to date as of now"): Bluetooth out of beta, the FM3 tried with the U2MIDI Pro, the streamlined Bluetooth page with every way to hook up each unit, Bluetooth from the Live pill. Built in, so its first launch never shows the old beta words. No native change (the fingerprint is 1.89.0's), so 1.89.0 copies keep taking the same updates. Started 17:03 UTC from main f55dac7, mobile.yml run 40365078785 (platform all, profile production, Send ticked: iOS to TestFlight, Android straight to Google Play production). iOS Expo build a6b564e6-a376-422e-b2e9-de4c5c0290d8 (TestFlight build 31, runtime c16f1c0d…, the same as 1.89.0's), to be put in the 1.89.0 version's place for review in App Store Connect by Justin; Android Expo build 18060505-b4c4-4d28-960d-7fbe29ff262c (version code 14, runtime 25ad57fe…) |

**Left this month: 5 iOS, 6 Android.** The count starts again on 1 November.

## November 2026

Before the Android build of 4 November, none had been started from this
project in November: Expo's build list, checked 3 November 2026, showed the
1.89.3 pair of 26 October as the newest. The month still started short: "I actually have 12 iOS builds left
and 13 android builds left. for November" (Justin, 3 November 2026), so 3
iOS and 2 Android slots went outside this ledger, by his own count. The
first this month is Android's cable, below.

| Date | Version | iOS | Android | What it was for |
|---|---|---|---|---|
| 4 Nov | 1.89.36 | — | 1 | Android plugs into the unit by USB cable: an AM4, FM9, Axe-Fx III or VP4 on its own USB cable, or a USB MIDI cable on a unit's MIDI jacks, opened through Android's own MIDI service (docs/pending/android-usb-midi.patch, applied in #789). An Android build on its own, the one exception CLAUDE.md allows: only the android line of the fingerprint moved (25ad57fe… to 27d15e4d…; iOS c16f1c0d… and the watch unchanged), and Justin asked for it ("You are good to do the android build on expo go as soon as it's ready", 4 November 2026). Started 02:01 UTC from main 4866839, mobile.yml run 41757997891 (platform android, profile production, Send ticked: straight to Google Play production). Android phones on Google Play's 1.89.3 (version code 14) keep the last update made before 4866839 until they take 1.89.36 from Google Play; iPhones keep taking the same updates. Google's release notes and the App access paragraph (docs/app-store.md) go in by hand once Justin has run the cable on this build |
| 8 Nov | 1.90.0 | 1 | 1 | Editing over Bluetooth for customers: AM4, FM3, FM9 and Axe-Fx III. Edit opens over Bluetooth and on a USB cable to every customer on these four units from store version 1.90.0 on both phones (EDIT_FROM_STORE set in #832; never the VP4), by the version built into the copy, so the App Store's 1.89.3 and Google Play's 1.89.36 take the update and stay closed. Justin's yes: "once everything native is done for the 1.90.0 build go ahead and submit it to Expo for both iPhone and Android" and, on the FM9 and the Axe-Fx III, untried with Edit, "I'm fine with turning them on for those devices" (8 November 2026). Nothing native was waiting in docs/pending, and the fingerprint is 1.89.36's on Android and 1.89.3's on iOS (android 27d15e4d…, ios c16f1c0d…, watch d6b9e9a5…), so these copies keep taking the same updates as the ones before them. Started 20:12 UTC from main e959653, mobile.yml run 42518954998 (platform all, profile production, Send ticked: iOS to TestFlight, Android straight to Google Play production, Managed publishing off as since 26 October). iOS EXPO_IOS; Android EXPO_ANDROID. The iPhone version is added to App Store Connect for review by Justin, after video 5 |

**Left this month: 11 iOS, 11 Android.**
