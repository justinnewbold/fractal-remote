# Later

Things Justin wants, but not yet. Each one says what it is in plain words and
what it would take. Start from here when he says "let's do the next one".

## Justin's own tools (only on justinnewbold@icloud.com)

Built so far: **Give someone access** with the **Customer lookup** under it, and
**Sales at a glance**, **Messages from users** (1.86.57), and the Customer lookup's **Help someone sign in** buttons (1.86.58), and **What's live** (1.86.59). Delete account works on the website and the Mac app too (1.86.60). **View as a new customer** is on the phone (1.86.61). All in Settings → Developer. "Do number one and five
for now, and then after that, let's put them on a list of to do sometime
later."

Nothing is left on this list.

## AM4

- ~~**Tap tempo and the tempo box on the AM4.**~~ **Done, 1.86.79, and
  confirmed on Justin's AM4 ("It works now").** Found without AM4-Edit or
  MIDI Monitor, with the app's own AM4 check: Controllers → Tempo is the
  parameter (0x0002, 0x001C), 24..250 BPM. Details in docs/am4-testing.md.
- **The AM4's own metronome level.** Global (0x0001, 0x0061), −64..+32 dB,
  read but never written. A Global write froze his AM4 on SAVING once, so
  the first write is to be tried by hand with the unit in view.

## Older Fractal units

The Axe-Fx II (Mark I, Mark II, XL and XL+) is in as of 1.86.0: presets,
scenes, blocks on and off, X/Y, placing blocks, knobs. None of it has been on
a real one yet — a friend of Justin's is the first tester. After that:

- **Axe-Fx II: tuner, tempo, scene names, the preset name list.** Each needs a
  recording of what the unit sends, from the tester's rig.
- **AX8.** Easy once the Axe-Fx II is proven: it is an Axe-Fx II with fewer
  blocks and a different model byte. **A friend of Justin's is willing to
  test one** (8 October). The plan offered that day, and not yet given a go:
  first the computer app stops sending FM3 messages to a unit it cannot
  drive (today it recognises an AX8 and then talks to it like an FM3), and
  shows an AX8 look-only, with every change blocked. Then four short sessions
  on the tester's rig: look only, small changes never saved, adding and
  changing blocks, and saving last of all, into a spare slot. None of it
  needs a phone build: it is the computer app, which updates itself, and
  ordinary phone updates. The tester needs free access, given by email as
  for any tester.
- **FX8 and FX8 Mk II.** Medium to hard. Fractal never published how it talks,
  and it has an 8-slot chain instead of a grid. Needs an owner and recordings
  of FX8-Edit.
- **Original Axe-Fx (Standard, Ultra).** Hard. A different language, no USB
  (a MIDI cable interface), no scenes, no X/Y. Needs an owner.

## The watch

- **Straight to the computer over Wi-Fi, with no phone.** Justin asked on 4
  October whether the watch could skip the phone and talk to the computer on
  the same Wi-Fi. Wake on tap went first instead (1.86.83: the phone stays
  locked in a pocket and each watch tap wakes it), and this was parked as "a
  good second step later". What it would take: the watch sends its taps to
  the computer app's own page on the home network (port 5056, the one
  "Playing with no internet" uses), and has to be told the computer's
  address once, by the phone or by typing it, because Apple does not let a
  watch look for it. What it would be like: fine for scenes, pedals and
  presets, but only on the computer's own Wi-Fi (often missing at a gig),
  a choppy tuner, because Apple lets a watch ask over and over but never
  keep a line open, and more watch battery while it is open. It needs a
  build, since watch code only reaches anyone inside the app, and trying on
  a real watch before it is worth one.

## Plugging the phone straight into the unit, with no computer

Researched 15 October 2026. **On hold:** "hold off on all the direct USB
connections until I can test it like you said when I get home." Nothing is
built for it.

| Unit | iPhone | Android |
|---|---|---|
| AM4 (USB-C to USB-C) | Probably works already, through the hidden Bluetooth (beta) page. Untried. | Needs new Android code, so a build |
| FM9 (USB-C to USB-B) | Probably works already, the same way. The manual: "The FM9 is a USB MIDI Device." | Needs a build |
| Axe-Fx III (USB-C to USB-B) | Probably works already. The manual calls it class-compliant MIDI over USB. | Needs a build |
| FM3 (USB-C to USB-B) | Never. The manual: "The FM3 is NOT a USB MIDI Device. It uses COM ports over USB". Apple (developer forums thread 834899, June 2026): an iPhone app cannot reach a USB serial device; DriverKit is iPad and Mac only. | Maybe, unproven: Android's USB host API can open the FM3's serial port, with an "Allow access" pop-up |
| VP4 (USB-C to USB-C) | Not until the phone can drive a VP4 at all | The same |

Why the iPhone may already work: the iPhone half of the Bluetooth module
(mobile/modules/fractal-ble-midi/ios/FractalBleMidiModule.swift, devices())
lists every two-way CoreMIDI port with an entity, cable or Bluetooth alike,
and bleAdapters.js isAdapter() only leaves out Apple's network sessions. The
Android half opens Bluetooth devices only (openBluetoothDevice, a scan
filtered to the BLE-MIDI service), so Android needs MidiManager.openDevice for
USB, which is native code and a build.

**The first step is Justin's own try, when he is home:** AM4 out of the
computer, WIDI off; unlock the iPhone, then plug the AM4 in with a data
USB-C cable; Settings → Bluetooth (beta) → Connect (or "Use a different
adapter" if it offers the WIDI); tap Done on Apple's Bluetooth screen; Play
should show the preset with no computer. "Stop using Bluetooth" goes back.

If it works, in order: a proper "Plugged into this phone" choice on the
iPhone for his account only (JavaScript, an update, about 2-3 days); Android
by cable (a build); the FM3 on Android (the largest and riskiest piece);
customers only in a new store version whose review notes say so, the same
rule as Bluetooth. At a gig: the phone cannot charge while the unit is in,
unless a USB-C hub with a charging port (plug the charger in first); phone
sounds may come out of the unit (Do Not Disturb); a cable plugged into a
locked iPhone does nothing until it is unlocked (iOS 26's Wired Accessories
setting).

## Siri, the Action button and Back Tap

**Built, 23 October 2026, for the build pair after 1.87.52:** nine built-in
phrases in the iPhone app ("Scene 3 in Fractal Remote", Next song, Previous
song, Load a preset, Set the tempo, Tuner on, Tuner off, a pedal on, and a
pedal off, with Boost among the pedals on an AM4), the fractalremote://
links (next, previous, scene/1 to 8, tuner/off), and Settings → Siri, which
says how to use them, with the Shortcuts app, the Action button and Back
Tap, and how to turn it off. All of it needs Play on screen except Tuner
off. The links answer Justin's account alone until that build is in the
stores. docs/app-store.md has the review notes paragraph and what is to be
tried on the TestFlight copy first.

Parked, each for its reason:

- **Songs by name** ("Play Schism in Fractal Remote"). The app knows a
  preset's name only once it has read it from the unit, so the list Siri
  would hear has gaps, and it has to be handed to Siri again whenever it
  changes. Developers also report phrases like this misfiring. One of Apple's
  ten phrase slots is kept free for it, once the scene phrase has proven
  itself on his iPhone.
- **Amp and pedal channels** (A, B, C, D) by voice. A phrase holds one choice
  from a list, and this needs two (which block, which channel). It could come
  as an amp-only phrase later.
- **Siri on the Apple Watch.** The iPhone's phrases do not run on the watch;
  the watch app would need its own, said word for word (the watch has no
  flexible matching), and more Swift in the watch. Later, if wanted.
- **A button in Control Center or on the Lock Screen** (Apple's Controls). It
  needs a separate widget piece in the app, and Apple's forums report trouble
  getting its button to run the app's own code. The Action button already
  does the job through Shortcuts. Worth another look once the phrases have
  worked on his iPhone.
- **Android voice.** App Actions went with Google Assistant, and Gemini's way
  in for apps (AppFunctions) is experimental and open only to invited testers
  (Google's page, 19 October 2026). The links work from Tasker and apps like
  it. Look again when Google opens AppFunctions to everybody.

## Blind and low-vision players

Audited 15 October 2026. Nothing built. VoiceOver and TalkBack are on every
phone, but they say only what the app tells them.

- **The biggest gap:** on an iPhone VoiceOver cannot get inside any pop-up.
  The glass behind each one is a single "Close" button (Sheet.js, Tuner.js,
  Volume.js, TempoBox.js, PasswordBox.js, the computer note in TopBar.js), so
  the volume slider, Stop on the tuner and Delete account cannot be reached.
  The fix also needs accessibilityViewIsModal and onAccessibilityEscape,
  used nowhere today. Half a day; first.
- Then, all free updates: scene tiles say "Scene 3, Rhythm", effects say
  "Delay, on, channel A", the tuner says "F sharp"; changes spoken as they
  happen; two-finger double-tap on Play for Next (Magic Tap); Move up / Move
  down for setlist songs; a tuner by words, tones or a buzz; Play that holds
  up at large text sizes, and the light-mode faint grey (#767d87, 3.3:1)
  darkened. Speaking with VoiceOver off needs a new package, so a build.
- The App Store's accessibility answers can be set without a build. Dark
  interface can be claimed now; VoiceOver only after the fixes and a real
  iPhone pass.

## The iPhone Duo (the foldable)

Researched 15 October 2026. Pre-orders opened 16 October, phones from 23
October. 5.4-inch outside, 7.6-inch inside, iOS 27.1. Justin is getting one.

- Today's store copy, built with the iOS 26 tools, shows phone-sized in the
  middle of the inside screen. No update changes that; only a build made with
  Xcode 27.1 fills it.
- Free groundwork: keep the left and right edges clear (the SafeAreaView in
  mobile/App.js has top and bottom only), and a sideways Play for wide
  windows (scenes left, effects right), which helps iPads and Android
  foldables at once.
- The Duo build (a build pair, his yes first): pin the EAS image
  macos-tahoe-26.6-xcode-27.1, and add expo-build-properties with
  ios.enableSceneSupport, which Apple's TN3187 makes mandatory with the new
  SDK ("your app won't launch"). That is a new package. Prove it compiles on
  GitHub's free xcode-27 runner first. Duo screenshots are required from
  April 2027.
- On his phone, the day it comes: today's store copy as it is, then fold and
  unfold mid-song with the link up, the tempo box with the keyboard, the NOT
  CONNECTED band, the watch.
- The fold sensor (mobile/modules/fractal-fold) rides that build pair and
  only reports: the hinge, where the fold runs, what covers the screen, the
  window and the side bar's edge, as "Fold:" lines in the debug log
  (mobile/src/lib/foldSensor.js, started from App.js). Nothing draws from it.
  Its shape is frozen in test/fold-native.mjs, so what reads it can follow by
  update, once his logs show a real Duo reporting it right. duo.yml fails if
  its iOS 27.1 code was compiled out (the canImport version number is
  Expo's, not Apple's). Android has no fold reader yet.

## From the improvement list of 15 October 2026

Done: pick 1, the quiet level readings (1.87.31); pick 6, fewer and smaller
computer updates (1.87.30); the tempo box (1.87.29). Being finished: pick 2,
the next song's name under Next; pick 3, help for buyers with no computer and
the Handled button on Paid twice; the VP4's honest words and its presets and
scenes. Still on the list, not started:

- **Lock the computer's page to your own phone.** Anyone on the same Wi-Fi
  can open the computer's page (ForgeFX listens on 0.0.0.0) and do whatever
  that page does: change sounds, store to a slot, restore a backup, send the
  unit raw messages, pick another port. Still parked. What it would take: a
  pairing step, so the page answers only a phone or tablet that was shown a
  code on the computer once. The "key" design weighed on 23 October is the
  start of it (the computer's window is given its key by the app itself, so
  a page it has kept from before still works). Until then, at a venue, put
  the computer on your phone's hotspot rather than the venue's Wi-Fi.
  - ~~Sign out in the computer app signed out every device on the account,
    phones included (auth.signOut() with no scope, which means all of
    them).~~ **Done, computer app 1.87.55:** it signs out the computer only
    (scope 'local'), the way the phone and the browser always have.
  - ~~**Found again on 23 October:** the device server answered CORS for
    any origin, and POST /cloud/delete-account and /cloud/logout took no
    check, so any web page open on that computer could reach them.~~
    **Done, computer app 1.87.55:** the device server answers only its own
    callers (forgefx server/src/guard.ts): the computer's window, the Wi-Fi
    page it served itself, the app's own process, the relay, and the public
    site opened on the computer (named in FORGEFX_ALLOWED_ORIGINS, which
    the app sets). A web page in a browser on the computer, or someone on
    the Wi-Fi, can no longer sign it out, sign it into another account,
    turn its phone remote on, or read its saved sign-in. Signing in, out
    and the phone remote's switch answer only the computer itself. POST
    /cloud/delete-account is closed (nothing ever called it: the apps
    delete an account through the account service). A name the computer is
    not known by (a router's name like raspberrypi.lan, a Tailscale name)
    is answered with one line saying which address to open instead.
  - ~~**GET /store/cloud over the relay** handed the computer's saved
    sign-in to any device on the account.~~ **Done, 1.87.55:** closed three
    ways: the device server answers the store's `config` collection only,
    the relay refuses every other collection and /local, and both apps'
    copy of the rule says so (shared/relay-rules.mjs).
  - **Left open on purpose, with why.** The public site opened on the
    computer keeps the computer's account buttons, because it is the
    tray's "fractal.newbold.cloud" and it sets the computer up. So a fault
    in that site, opened on the computer, could still reach them. A
    Content-Security-Policy on the site (vercel.json) is the next step that
    narrows it. And names outside the list above stay refused unless a
    customer actually reports one.
  - **Two parked items, with why.** Both came up on 23 October from "how
    can a user remove old units they aren't connected to"; 1.87.53 says
    under Which unit how to do it at the computer instead.
    - A server-side "Computers on this account" page, for old sign-ins.
      Parked because "off" can only be guessed, from 90 minutes with no
      sign-in refresh (a MacBook asleep in a gig bag looks exactly like a
      retired one), and removing a computer means deleting its
      auth.sessions rows directly, which no supported Supabase Auth call
      does.
    - A phone-side remote sign-out. Parked because its "in use" check is a
      guess (every device's first request on a link goes to every
      computer), it works only on computers already updated to know it,
      and undoing it means typing the password at that computer.
- **No signal at the venue:** say "This phone isn't online" and offer the
  computer's page over the same Wi-Fi, with the setlists on it.
- **A volume for the AM4**, with its four scene levels.
- Quick wins: a setlist tap sets the song's scene and tempo too; Android's
  back swipe on Play asks first; after a crash, offer once to send the log;
  the volume slider always moves Output 1; the Windows warnings on the
  download card; help-page sentences no longer true.
- Bigger: setlists made of songs (own title, same preset twice, a short
  note); scene volume in the volume pop-up; a Gig lock; "how fast is the
  link"; "No sound?" on the phone; the computer saying exactly why it cannot
  see the unit; a weekly backup of every preset; page-turner pedals; iPad
  sideways.
- Growth: a 60-second video on a real rig; an honest forum post; a real
  front page with link previews and /demo/fm3 links; ask for star ratings
  (one rating so far); sign the Windows installer.
- Health: an undo for a bad phone update and updates to a few phones first;
  an alarm when something breaks; a safety catch on the computer against AM4
  Global writes from a phone; GitHub refusing a red merge to main; a current
  Electron (33 stopped getting security fixes in April 2025); Supabase
  backups and two-step sign-in on the service accounts; a limit on the bug
  report emails.

## Google Play's 2027 rules

Looked into on 16 October 2026, after Play Console's Android vitals warned
"DEX code optimization is below our threshold … Fix by Feb 2027", and again
on 25 October 2026 against the 1.88.0 file Google Play has (Expo build
360c7e98, version code 12), when Play Console listed four suggestions for
it. Google says an app that misses these may lose visibility and some
publishing abilities on Play, not be taken down.

- **Code optimization, February 2027.** In since 1.88.0
  (docs/pending/r8.patch, applied for that build pair): R8 is fully on in
  that build, and its own score sheet says 82.9% obfuscated, 82.6% optimized
  and 83.0% shrunk, where Play asks for 25%. The code is 9.0 MB, under the
  10 MB from which the February rule counts at all. Play's R8 card can still
  show, for two lines seen on another app's card (Justin's own is what to
  check): "optimized resource shrinking", which
  docs/pending/shrink-resources.patch turns on for the next build, and an
  Android Gradle plugin of 9.0 or newer, which only comes with Expo SDK 58
  (its React Native 0.88 uses 9.2.1), a bigger move for a build pair of its
  own. JavaScript is not what Play scores, so no update can change any of
  it; only a store build can.
- **Staying signed in on a new Android phone, April 2027** ("Zero-Tap
  Sign-In"). An app with accounts has to put the player back in their
  account by itself when they move to a new phone, through Android's
  Restore Credentials. It is bigger than R8: a new native piece
  (androidx.credentials 1.5 or newer, so a build), and a server side the
  project does not have yet, because the key it saves is a passkey-style
  key the server has to issue and check. The way out for apps already
  using Google's Block Store closed on 30 September 2026. Games are exempt;
  this app is not a game. Its own build, after the R8 one, before April.
  developer.android.com/identity/sign-in/restore-credentials-implementation
- **Tablets turning sideways, nothing due.** Play's "Remove resizability
  and orientation restrictions" is one line of the app's own:
  `"orientation": "portrait"` in mobile/app.json, which locks the whole
  Android app upright. Android 16 and newer already ignore it on a big
  screen; a tablet, foldable or Chromebook on 12 to 15 held sideways shows
  the app as an upright strip with black bars. The fix is parked for
  1.89.0 in docs/pending/tablet-turns.patch: the lock comes off on Android,
  and a screen whose short side is under 600 points (a phone) is held
  upright by the app itself, so only bigger screens turn. iPhones stay
  upright and iPads already turn. It is a build, and it moves both phones.
- **What android-minified's sideways tablet picture showed.** Less than it
  was taken for. The emulator runs Android 16, which ignores the lock
  anyway (its log says so: "Ignoring manifest-declared fixed orientation
  … since target sdk 36"). Its quarter turn did turn the Pixel Tablet
  upright, since that tablet is sideways to begin with, but the app was
  started with monkey, which puts the screen back at its natural way up
  with auto-rotate on the moment it finishes, so it was back before the
  picture was taken. And the picture is the "An independent app" card
  stretched across the screen, because the run never tapped OK. So it had
  never shown Play or Settings sideways on Android. Since 25 October 2026
  it holds an Android 15 tablet sideways, upright and back (with
  tablet-turns.patch in, the app must fill the screen each time), told
  first to show an upright app as a strip the way a real Android 12 to 15
  tablet does, which its emulator image would not; holds a phone sideways
  (the app must stay upright); reads the hold back before every look; and
  starts the app the way the launcher does and taps past the startup card
  into the demo's Play. It runs on anything in docs/pending.
- **Mostly not fixable from here, and nothing due:** Play's "deprecated
  APIs for edge-to-edge" names code inside React Native and Google's own
  libraries (React Native's window code, the splash screen library,
  Material, the photo picker's crop screen), which their updates fix; the
  screen itself is already drawn edge to edge. React Native 0.88 still
  makes the same calls. One of them can go: Material is in the app only
  for Expo's developer error screen, which does nothing in a store build,
  and docs/pending/logbox-android.patch leaves it out of Android for
  1.89.0. That shortens Play's list without emptying it.
- **Bitmap image optimization, nothing due.** Play's scan looks for code
  that downloads a picture and decodes it by hand, and every place it can
  find is library code: Expo's update library (a restart screen picture
  this app never asks for), React Native's own picture loader, the photo
  picker's and the audio library's. It is not about the size of the app's
  own pictures, which were made smaller anyway by update on 25 October
  2026, so the suggestion will most likely stay. The rule that binds, from
  February 2027, is picture memory while the app is in the background, over
  200 MB; the pictures on the app's own screens come to about 4.5 MB when
  opened, all of them together, and even a library picture the app never
  shows (media3's album picture, about 17 MB) leaves it far under that.

## Waiting on something

- **A VP4 owner's recording.** "That sounds good. Let's do it." (16 October
  2026.) Rather than guess at the VP4 from the AM4, a VP4 owner records what
  VP4-Edit sends the pedal and what it answers, while doing a set list of
  things, and the next VP4 features are built from that. The guide is
  docs/vp4-recording.md (MIDI Monitor on a Mac, Wireshark with USBPcap on an
  Intel or AMD Windows PC), written from checked research and checked twice.
  The message Justin sends with it is below. Nothing about the VP4 is built
  further until a recording comes back.

  > Hi! I make Fractal Remote, an app that controls Fractal units from a
  > phone. Its VP4 side has never been checked on a real VP4, and I'm looking
  > for an owner willing to help. … The step-by-step guide:
  > https://github.com/justinnewbold/fractal-remote/blob/main/docs/vp4-recording.md

- **The iPhone/iPad app on Apple-silicon Macs.** The app supports tablets,
  so App Store Connect may offer it on M-series Macs as an iPad app, where
  it would call the Mac "this iPad" (Platform.isPad is true there). The
  computer app is the Mac's app, so the simple answer is App Store Connect →
  Pricing and Availability → turn off "iPhone and iPad Apps on Apple Silicon
  Macs". Justin's to decide; no build either way.

The GitHub description and RevenueCat's sample products were both done by
Justin on 29 September.
