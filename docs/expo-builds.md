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
never on green alone: its phones' fingerprint says Unchanged, and its merge
puts a public APK that opens Bluetooth on the Releases page (CLAUDE.md says
why).

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

**Left this month: 7 iOS, 8 Android.** The count starts again on 1 November.
