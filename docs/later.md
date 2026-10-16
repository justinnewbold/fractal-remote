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

Researched 15 October 2026. Nothing built.

- **A free first step.** mobile/app.json has had `"scheme": "fractalremote"`
  since 5 September, so every store build already answers fractalremote://
  links, and nothing listens. A listener for next, previous, scene 1-8 and
  tuner off is JavaScript only. A player makes a Shortcut ("Fractal next")
  and Siri, the Action button or Back Tap runs it. The phone has to be
  unlocked and the app comes to the front. Apple wants a new feature named in
  the review notes, so the ready-made shortcuts go public with a store
  version.
- **Built-in phrases** ("Scene 3 in Fractal Remote", "Next song in Fractal
  Remote") are App Intents, Swift, so a build. Apple requires the app's name
  in every phrase, which is a safety on stage. Expo's own expo-app-intents is
  alpha and needs SDK 58, so it would be built by hand, copying the watch
  bridge (mobile/modules/fractal-watch).
- **Limits.** Siri takes about 1-3 seconds, so it suits a change between
  songs, not the downbeat. It is reliable only with Play on screen (Play keeps
  the phone awake); from a locked phone in a pocket most commands would miss
  the 1.5-second tap deadline and be dropped. A tempo cannot be said in one
  phrase.
- Android: the same links work from Samsung Routines or Tasker; Gemini's
  equivalent is not open to apps like this.

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

## From the improvement list of 15 October 2026

Done: pick 1, the quiet level readings (1.87.31); pick 6, fewer and smaller
computer updates (1.87.30); the tempo box (1.87.29). Being finished: pick 2,
the next song's name under Next; pick 3, help for buyers with no computer and
the Handled button on Paid twice; the VP4's honest words and its presets and
scenes. Still on the list, not started:

- **Lock the computer's page to your own phone.** Anyone on the same Wi-Fi
  can open the computer's page (ForgeFX listens on 0.0.0.0) and change
  presets or sign it out. Found with it: Sign out in the computer app calls
  auth.signOut() with no scope (forgefx server/src/runtime/cloud.ts), which
  defaults to signing out every device on the account, phones included.
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
"DEX code optimization is below our threshold … Fix by Feb 2027". Google
says an app that misses these may lose visibility and some publishing
abilities on Play, not be taken down.

- **Code optimization, February 2027.** Done and waiting for a build:
  docs/pending/r8.patch, proven for free by the android-minified workflow.
  JavaScript is not what Play scores, so no update can fix it; only a store
  build can.
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
- **Not fixable from here, and nothing due:** Play's "deprecated APIs for
  edge-to-edge" names code inside React Native and Google's own libraries,
  which their updates fix; and "Remove resizability and orientation
  restrictions" is the portrait lock, which Android 16 already ignores on
  tablets. That one is a suggestion, and the sideways tablet picture from
  android-minified shows what it looks like today.

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
