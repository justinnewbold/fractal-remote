# Expo builds used, month by month

Justin gets **15 iOS and 15 Android** Expo builds a month. A build is only
started when he says yes (CLAUDE.md), and iPhone and Android are always
built together.

Add a row every time a build is started, including one that fails after
being queued: it still used a slot.

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

**Left this month: 8 iOS, 8 Android.**
