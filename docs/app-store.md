# Getting onto the App Store

**Live on the App Store since 8 October 2026**, first as 1.86.83 (build 24),
and as 1.87.11 (build 27) since Apple approved it on 12 October 2026:
https://apps.apple.com/app/id6812916461. Everything below still applies to
every new version sent for review.

**When a new version goes live in either store**, its number goes into
`public/store-versions.json` that day, and not before (docs/expo-builds.md
says how). It is what tells a phone on an older store copy that a newer one
is in the store, and it is a change to the website, made like any other.

Everything App Store Connect asks for, answered. Copy the fields straight
across; the notes say why an answer is what it is where that matters.

**The one that gets apps like this rejected** is near the bottom, under *Review
notes*. Read that one even if you skip the rest.

**The version in the store and the next one are kept apart.** The store has
had 1.87.11 since 12 October 2026, and everything down to *Review notes* (the
listing, the privacy answers and the rest) is for it. The texts it was
reviewed with are near the bottom, under *1.87.11, the version in the store
now*, and the next version's notes start from those. The *Review notes* block
is the 1.86.83 one Apple approved on 8 October, and the 1.87.1 texts are at
the very end. Both are kept for the record and are not for pasting.

---

## The listing

| Field | Limit | Value |
|---|---|---|
| **Name** | 30 | `Fractal Remote` |
| **Subtitle** | 30 | `Phone remote, needs a computer` |
| **Category** | — | Primary: **Music**. Secondary: **Utilities** |
| **Price** | — | **Free** (USD 0.00). The $9.99 unlock is an in-app purchase, set up separately under In-App Purchases |

**Say it needs a computer before anything else.** "I think we need to make it
more clear that this app requires a computer connected to the fractal to work…
It's a lot of reading to get to that point." So the promotional text, the
description and the Play summary all open on it (in capitals everywhere but
the Play summary, which Google asks not to shout), and the demo paragraph
says the demo is the one part that needs nothing.

**Never call the computer app free.** "That could confuse people thinking the
iOS/android app is free." Call it the desktop app. A test holds every block
here to both rules.

Each block below is pasted as it stands: one line per paragraph, so the store
keeps the paragraphs and adds no line breaks of its own.

### Promotional text (170, editable any time without a new build)

The paragraph at the very top of the listing, and the one part of it that
changes without a build or a review. It is not pasted: Actions → store-text →
Run workflow, tick **Write it**, and it goes straight to the live version.
Unticked, it only shows what is there now. **Run it again after each new
version is released:** a version in review keeps its own copy of the
paragraph, and that copy can be empty. 1.87.11 came out on 12 October 2026
with no promotional text at all. The run warns about any version it could not
change.

```
REQUIRES A COMPUTER. Your Fractal plugs by USB into a Mac, PC or Linux computer running our desktop app, and your phone controls it from there. The demo needs no gear.
```

### Keywords (100, commas, no spaces after them)

```
guitar,amp,fm3,fm9,axefx,am4,vp4,preset,scene,setlist,tuner,rig,stage,pedalboard
```

Naming the hardware you work with is ordinary and allowed — it is how someone
searching for it finds you. It is also why the affiliation disclaimer matters:
the listing says which gear this works with, and never implies it comes from
the people who make that gear.

### Description

Changes only with a new version, so it goes in with the next build. The same
text goes on Google Play, where it can change any time (see below).

**This is the one written for 1.87.11, and the one the next version keeps.**
It says nothing about Bluetooth. If the live App Store page does not show it,
it goes in with the next version, since Apple changes it only with one.
For one day (10 October 2026) it did: the demo paragraph and HOW IT WORKS
both said that, in beta, a Bluetooth MIDI adapter could take the computer's
place. Then, on 11 October: "Is there any way to just get the Bluetooth on
the developers mode for my own phone? I just feel like it's not ready to
have public." So Bluetooth (beta) shows on Justin's account alone, and a
listing that promoted it would be promising customers something they cannot
open (Apple's 2.3, and Google Play's rule that the listing matches the app).
Both places say the computer again. **On Google Play it can go on whenever
it suits:** nothing in it waits for 1.87.11 any more.

```
REQUIRES A COMPUTER. Your Fractal unit plugs into a Mac, Windows or Linux computer with a USB cable, and that computer runs the Fractal Remote desktop app (get it at fractal.newbold.cloud/downloads). Your phone controls the unit through it, so the computer has to stay on and connected while you play.

Fractal Remote turns your phone into a remote control for your Fractal Audio rig. Switch presets and scenes, turn blocks on and off, change channels, tune up and tap tempo, without walking back to your unit. Build a setlist for tonight and step through it with two big buttons you can hit in the dark.

SUPPORTED UNITS
FM3, FM9, Axe-Fx III, AM4 and VP4.

TRY THE DEMO, FOR AS LONG AS YOU LIKE
The demo is the whole app running against a simulated unit. Nothing is cut short and nothing expires. The demo needs no hardware and no computer. Controlling your real unit needs the computer described at the top.

WHAT IT DOES
• Switch any of your presets, by name, in slot order or from a setlist
• Scenes, with the names your unit already uses
• Turn blocks on and off, and pick channels A to D
• Open a block and change its real parameters on real knobs
• Tuner, with the note and how far off you are
• Tap tempo, with the tempo on the button
• Setlists and starred presets, kept with your account across devices
• Colors that match your unit's own screen, so you find things by looking

HOW IT WORKS
A phone needs something between it and your Fractal unit: the desktop app. It runs on your Mac, Windows PC or Linux computer, holds the USB cable, and your phone talks to it. Get it at fractal.newbold.cloud/downloads.

Once the two are paired, the phone works from anywhere: the same room, the far side of the stage, or a different building.

ONE PAYMENT, LIFETIME UNLOCK
Controlling real hardware is a single purchase. It unlocks the full app on every device you own, forever, including every future update, on all supported Fractal units. No subscription.

Fractal Remote is an independent app. It is in no way affiliated with, endorsed by, or sponsored by Fractal Audio Systems, Inc. “Fractal Audio”, “Axe-Fx”, “FM3”, “FM9”, “AM4” and “VP4” are trademarks of Fractal Audio Systems, Inc., used here only to say which hardware this app works with.
```

### Google Play

Both of these change any time, with no build: Play Console → Fractal Remote →
**Grow users → Store presence → Store listings** → the default listing. Paste
them, press **Save**, then **Publishing overview → Send changes for review**.
Google usually passes a text change within a day.

- **Full description (4000):** the Description above, exactly. It mentions
  no Bluetooth, so it does not wait for 1.87.11. *By hand in Play Console for
  1.87.11*, at the bottom, says the rest.
- **Short description (80):** the line under the app's name. **Not in
  capitals.** Google's help for this one field says "Do not use capitalization
  for emphasis", and its metadata policy lists "ALL CAPS although not part of
  brand name" as a violation. Apple has no such rule, so the capitals stay on
  the App Store, and the headings in the full description (SUPPORTED UNITS and
  the rest) have been on Play since launch.

### Google Play: short description (80)

```
Requires a computer and our desktop app. Control your Fractal from your phone.
```

### URLs

| Field | Value |
|---|---|
| Support URL | `https://fractal.newbold.cloud/support.html` |
| Marketing URL | `https://fractal.newbold.cloud` |
| Privacy Policy URL | `https://fractal.newbold.cloud/privacy.html` |

---

## Screenshots

Required for **6.9" iPhone** (1290 × 2796 or 1320 × 2868). Because
`supportsTablet` is on, **13" iPad** (2064 × 2752) is required too — turning
tablet support off is the alternative and would be a worse app.

Up to 10 each; 3–5 is plenty. Take them **in the demo**, so every screen is
full of real-looking presets rather than "no computer".

Worth showing, in this order:

1. The stage screen with a preset up and scenes along the bottom
2. The chain, with blocks on and off
3. The tuner
4. A setlist
5. Setup, showing it connected

---

## App Privacy (the nutrition label)

Answer **Yes** to collecting data, then declare exactly these. Everything is
**"used for App Functionality"**, and **nothing is used for tracking** — say No
to the tracking question, because it is true and it keeps you out of App
Tracking Transparency entirely.

| Data type | Collected | Linked to the user | Why |
|---|---|---|---|
| Contact Info → **Email Address** | Yes | Yes | Account sign-in, and answering a support message if they leave one |
| User Content → **Other User Content** | Yes | Yes | Setlists, so they follow you between devices |
| Identifiers → **User ID** | Yes | Yes | The account id that ties your setlists to you |
| Diagnostics → **Other Diagnostic Data** | Yes | Yes | The debug log, and only when somebody presses Send on a bug report |
| Purchases → **Purchase History** | Yes | Yes | The unlock. RevenueCat keeps the purchase record so it follows the account to other devices |
| Diagnostics → **Crash Data** | Yes | No | After a launch that crashed, the phone's update check sends Expo the error message the app stopped on, so a broken update can be found and taken back. The privacy page says so. Added 11 October 2026: the live label does not have it yet, and it can be added any time in App Store Connect → App Privacy, with no build |

Do **not** declare location, contacts, photos, audio, search history, browsing
history or advertising data. None are collected — and the
privacy page says so, so a wrong answer here contradicts a published document.

**Why the log is declared even though it is opt-in:** Apple asks what the app
is *capable* of sending, not what it usually sends. Declaring it and being able
to point at a policy that explains it is the strong position.

---

## Age rating

**Social media features: No.** From September 2026 every update is asked this
in the age-rating questionnaire. The app has no feed, no profiles and nothing
one user can show another.

**4+.** Every question in the questionnaire is None / No — including the newer
ones about parental controls, age assurance, unrestricted web access,
user-generated content, messaging, advertising, and medical or wellness
topics. Links to the downloads page open in the phone's own browser; that is
not unrestricted web access inside the app. There is no user
generated content shown to other people, no web browsing, no gambling, no
contests and no messaging between users — a bug report goes to one inbox and
is never shown to anyone else.

---

## Content rights

**Yes, it contains third-party content** — the names of Fractal Audio's
hardware (FM3, FM9, Axe-Fx, AM4, VP4) and pictures of those units. Answer
**Yes** to having the rights only if the unit pictures are photos you took or
were given permission to use; the names are used only to say which hardware
the app works with, which the affiliation line in the description covers.

---

## Export compliance

**Already handled — nothing to do.** The app uses HTTPS and nothing else,
which is standard encryption and exempt, and `mobile/app.json` already carries
`ITSAppUsesNonExemptEncryption: false` in its `infoPlist`. That answers the
question automatically on every submission rather than asking you each time.

---

## Only you can do these

- **Paid Applications Agreement** — App Store Connect → Business. Until it is
  signed and active, a paid app cannot be sold at all.
- **Banking and tax forms** — same place. These take the longest, sometimes
  days, so start them before you need them.
- **The app record itself** — bundle ID `cloud.newbold.fractalremote`.
- **Pricing and Availability** — App Store Connect → the app → Pricing and
  Availability: price **Free**, and the countries it is sold in. Without it an
  approved app is listed nowhere. The EU asks for a trader-status declaration
  (Digital Services Act) before it will list the app there.
- **After approval, give it a few hours.** "Ready for Distribution" means
  released, but on 8 October 2026 the listing answered 404 for some hours —
  with Pricing and Availability already set — and then came up by itself.

---

## Review notes

**The notes Apple approved for 1.86.83 on 8 October 2026, kept as they were
sent.** This is the paragraph that decides whether the app is rejected as
non-functional, and every later version's notes open on the same four taps.

**This block is no longer the one to paste.** The store has 1.87.11 now, and
the notes Apple approved for it are at the bottom, under *1.87.11, the version
in the store now*. The next version's notes start from those.

```
This app is a remote control for Fractal Audio guitar hardware. Normally it
connects to a computer that has the guitar unit plugged into it over USB.

You will not have that hardware, so the app includes a full demo mode that
needs nothing but the phone, and no account:

  1. Tap "Get started"
  2. Tap "Got it"
  3. Tap "Start free demo"
  4. Choose any unit, then tap "Play with ..."

That loads a simulated unit with twelve presets and named scenes. Every
screen works — presets, scenes, the signal chain, the tuner, tap tempo,
setlists, settings. Nothing in the demo reaches real hardware.

The demo is free and needs no account. An account is used for one thing
only: joining this phone to a computer that has the guitar unit plugged
into it.

A demo account for the signed-in screens is in App Review Information
(Sign-in required).

Deleting an account (Guideline 5.1.1(v)): tap the gear at the top right for
Settings, tap the account card at the top, then Delete account, then
"Delete my account". It deletes the account and everything stored under it
straight away. To try it, please create a new account rather than deleting
the demo account, which the rest of the review needs. A new account that has
not bought the full version opens on the purchase page instead of Settings;
Delete account is at the foot of that page, and does the same.

Hardware (Guideline 2.1): a video filmed on an iPhone with a real FM3 on
screen, from the first pairing through the whole workflow, is linked in App
Review Information.

Apple Watch: the watch app comes with the iPhone app. It works in the demo
too. Start the demo as above, keep the Play screen open on the iPhone, then
open Fractal on the watch. Swipe up or down between Scenes, Pedals, Presets
and Tuner.
```

**Why this matters more than anything else here.** A reviewer opens the app,
sees "no computer", and has no way to know there is anything behind it. The
demo is three taps in, but only if somebody tells them it is there.

**AND WHY IT IS WRITTEN OUT TAP BY TAP.** The paragraph that used to be here
said *"On the first screen, tap 'Just looking? Try the demo'"* — and the trap
is that this was a REAL button. It sat on the sign-in screen, which is not the
first screen: a fresh install opens the walkthrough, and the sign-in screen is
only reached after it. So a reviewer looked for a button that exists, on a
screen that does not have it, and had nothing to go on. Right button, wrong
screen, same rejection.

It also claimed the app worked "on a local network" without an account, and
that signing in was only for reaching a computer from outside your home wifi.
Both stopped being true when pairing became account-only.

Store copy goes stale silently, because nothing in the build reads it. Two
tests read it instead — one holds every label here against the walkthrough's
own strings, the other against the sign-in screen's — and both read only the
fenced block above, because this paragraph quotes the wording it replaced and
a search of the whole file finds the explanation rather than the instruction.

---

## 1.87.11, the version in the store now (approved 12 October 2026)

**These are the texts that went with the 1.87.11 build,** made on 11 October
2026 from main 3e7ffbf (mobile.yml run 38162666072, one iOS build to
TestFlight and one Android build straight to Google Play production): the
Notes for App Review and What's New that Apple approved, and the App access
note and release notes for Google. The next version's texts start from these.
The 1.87.1 texts they replaced are kept at the very end, under *Kept for the
record*, and are not for pasting.

**Since 12 October 2026 this is the version in the store** (1.87.11, build
27). The *Review notes* block above is the 1.86.83 one, kept as Apple approved
it on 8 October. The next version's notes start from the block below, with
*New since 1.87.11* in place of *New since 1.86.83*. The Description and the
Subtitle above were written to go in with 1.87.11 (Apple changes both only
with a new version). If the live listing does not show them, they go in with
the next one.

Why the notes change at all: Apple's guideline 2.3.1(a) says every new feature
"must be described with specificity in the Notes for Review", and 2.3.12 says
What's New has to list the bigger changes. Five things are new to a reviewer
since 1.86.83 was approved: an account can be made before buying; Edit says
(Beta); on iPhone, Appearance set to Auto now follows the phone's light or
dark setting (in 1.86.83 Auto was always dark, so a reviewer whose phone is
set to light now sees the light theme first); paying once, which is what the
purchase page now says to somebody who bought on another device, and the
account the app asks for after a purchase made with nobody signed in; and
the metronome's switch in the volume pop-up. And one sentence in the old
notes stopped being true: "An account is used for one thing only: joining
this phone to a computer". An account also carries the full version and the
setlists to other devices, and anybody can make one now, so it is rewritten
below.

The one of those most likely to draw a question is the account after a
purchase. Read quickly, "we paid and were then asked to make an account"
can look like a breach of 5.1.1(v), which says an app may not make you sign
up for what does not need an account. So the notes say why (an account is
what joins the phone to the computer the unit is plugged into) and that
nothing is forced: the demo keeps working and the purchase waits on the
phone. (What the app does after such a purchase: bought from the
walkthrough, the sign-in screen opens on Create account; bought in the
demo, the Play screen says the purchase is only on this phone so far, with
a button to make an account or sign in.) And the reviewer's demo account
already has the full version, so they would never see the price at all
unless the notes say where it is: they do, in the demo.

**And Bluetooth (beta), which is in the build but not for customers.** On 10
October 2026 it was to go in this version for every paying customer ("If
Bluetooth is ready, let's get it submitted ... let's just say that Bluetooth
is beta though in the app"), and the 1.87.1 builds were made that day with
the native Bluetooth MIDI module in them. On 11 October Justin took it back:
"Is there any way to just get the Bluetooth on the developers mode for my own
phone? I just feel like it's not ready to have public." So it is switched on
for his account alone, by an update, and the code stays in the binary (taking
it out is a new build, and the iPhone's Bluetooth permission text has to stay
with the module or the build is refused). 2.3.1(a) says "Don't include any
hidden, dormant, or undocumented features in your app", so the notes below
say in one paragraph that the code is there, whom it is for, and that in
that build nobody else is shown it or asked for Bluetooth. The same guideline also wants new features "accessible for review", and this
one is described rather than reachable. That was the one place Apple could
have pushed back, and with 1.87.11 it did not: the build was approved with the
paragraph below as it stands. A later review could still ask. If one does, the
choice is Justin's: show it to the review account too, with a video of it
working, or a build without the module.

### Notes for App Review, 1.87.11

**These are the ones Apple approved with this build,** and the ones the next
version's notes start from.

**Sent and approved: the 1.87.11 build, made from main 3e7ffbf on 11 October
2026 (run 38162666072), not the 10 October build 26, whose first launch still
shows Bluetooth.** Build 26 stays on TestFlight and is never sent for review.
Every later version is a build made from main after 1.87.8 was merged, so it
has the hidden version built in too.

Why: a fresh install runs the copy of the app built into it on its very first
launch, and only takes the latest update on the launch after
(`fallbackToCacheTimeout` is 0 in mobile/app.json, so the app never waits for
an update before it opens). Build 26's built-in copy is the 10 October one,
which shows a BLUETOOTH (BETA) card under Settings → Phone & computer to any
account with the full version, and Apple's demo account has the full
version. So a reviewer installing build 26 can meet Bluetooth on that first
launch, and the paragraph about it below would not be true for them. A build
made from main after 11 October has the hidden version built in, and the
notes below are written for that build. The 1.87.11 pair is that build: one
iOS and one Android, agreed by Justin on 11 October ("Yes spend the
builds").

**This is what went into App Review Information → Notes** for 1.87.11, in
place of the block above. **Apple's Notes box takes 4000 bytes**
(App Store Connect's own reference: "The Notes field can contain up to 4000
bytes"; a dash or an arrow counts as three), and the first draft of these
notes was over 5000, so the block is cut to what the reviewer needs and the
reasons stay out here. It is one line per paragraph, so the box shows
paragraphs rather than lines broken where this file wraps them.

**The three videos are in it, at the end.** On 11 October 2026 the notes as
they stood came to 3897 characters, and the three Google Drive links (the
FM3, presets, and deleting an account) would not fit after them. So the
block was cut again, and a test holds it under 3950 bytes with each Videos
bracket filled in by something as long as a Drive link and each Tested on
bracket by 30 characters, so it fits with the real ones in (about 3835 with
real values). The brackets here stay empty, for the next version to fill.

**And the way to delete a new account is in the deletion paragraph.** The
notes ask the reviewer to try Delete account on a new account, and one that
has not bought opens on the purchase page, with no gear: its Delete account
is at the foot of that page. That used to be said six paragraphs earlier,
under Accounts before buying, so a reviewer following the deletion steps
alone would look for a gear that is not there. The 1.86.83 notes Apple
approved had it in the deletion paragraph, and 1.86.8 was refused under
5.1.1(v), so it is back there. Auto is named by where it is (Settings, under
Play screen), since nothing on that row says Appearance.

```
This app is a remote control for Fractal Audio guitar units, through a computer the unit is plugged into by USB.

Without that hardware, use the demo. It needs only the phone, and no account:

1. Tap "Get started"
2. Tap "Got it"
3. Tap "Start free demo"
4. Choose any unit, then tap "Play with ..."

Every screen works in the demo, and nothing in it reaches real hardware.

The demo is free. An account joins the phone to the user's computer, and carries the full version and their setlists to their other devices.

The in-app purchase: in the demo, tap Unlock at the top of the Play screen. Buying needs no account, and Restore a purchase is the button under the price.

For the signed-in screens, use the demo account in App Review Information. It has the full version.

New since 1.86.83:

Accounts before buying. Anybody can now make an account, before buying: Create account is on the sign-in screen. Making one unlocks nothing. A new account is confirmed from its email before it can be signed in to.

Paying once. With nobody signed in, the purchase page now tells someone who bought on another device to sign in instead of buying again, and the app checks again just before charging, so nothing is charged twice. After a purchase with nobody signed in, the app offers to make an account, since an account is what joins the phone to the user's computer. Nothing is forced: the demo keeps working, and the purchase waits on the phone.

Edit (Beta). Edit, at the bottom of the Play screen, is now marked Beta. Everything it shows works, in the demo too. It is marked Beta because it does not yet cover every block and control of every unit, and a control may not yet move quite the way it does on the unit itself.

Bluetooth MIDI code, switched on only for the developer. This build contains Bluetooth MIDI code for a feature that lets the phone reach the guitar unit through a Bluetooth MIDI adapter instead of a computer. While it is tested, it is switched on only for the developer's own account. Customers and the review account don't see it in this build, and the app doesn't ask them for Bluetooth permission. If it is offered to customers, that will be in a later version, sent for review with notes that describe it.

Appearance. On iPhone, Auto (Settings, under Play screen), which is the default, now follows the phone's own light or dark setting.

Metronome. The volume pop-up (the speaker at the top) now has a metronome on/off switch.

Deleting an account (Guideline 5.1.1(v), video 3 below): tap the gear at the top right for Settings, the account card at the top, Delete account, then "Delete my account". It deletes the account and everything stored under it at once. An account that has not bought the full version opens on the purchase page instead of Settings, and Delete account is at the foot of that page. Please try it on a new account, not the demo account.

Hardware (Guideline 2.1): a video filmed on an iPhone with a real FM3 on screen, from the first pairing through the whole workflow, is video 1 below.

Apple Watch (it comes with the iPhone app): keep the demo's Play screen open on the iPhone, open Fractal on the watch, and swipe up or down between Scenes, Pedals, Presets and Tuner.

Tested on: iPhone 17 Pro Max, iOS [version]; Apple Watch [model], watchOS [version].

Services the app uses: Supabase (accounts, setlists, the phone-to-computer link), RevenueCat with Apple in-app purchase, Resend (emails), Expo (updates).

Regions: the app works the same in every country.

Videos:
1. FM3 hardware: [FM3 video link]
2. Presets: [presets video link]
3. Deleting an account: [account deletion video link]
```

**Bluetooth is in this build, switched on for Justin's account alone.** The
Bluetooth (beta) row on Settings, and the page it opens, are drawn only for
the account that opens his Developer pages, read from the sign-in kept on
the phone (CLAUDE.md, *Bluetooth (beta) is the developer's only*). The
review account is not that account, so in a build made after 11 October the
reviewer is not shown it, and the paragraph above says so instead of telling
them where it is. No video of Bluetooth goes with this version, because that
build does not let the reviewer open it. (Build 26 would, on its first
launch: see the line at the top of these notes. The Hardware paragraph's FM3
video, which is about the computer, still goes.) The AM4's own tuner screen
over Bluetooth, new in 1.87.11, works only over that Bluetooth link, so the
notes say nothing of it either.

**Never switched on for customers by an update.** When it is ready, it goes
in a new store version whose review notes describe it, the way this
section's notes did on 10 October (they are in this file's history), with
the video and the setup guide. Turning
it on for everybody over the air instead, after Apple has reviewed a build
that hides it, is the hidden feature 2.3.1(a) forbids, and a change to what
the app does that Apple's licence (3.3.1(C)) and Google's rule on features
activated remotely both keep for reviewed versions. **And while a version is in review,** nothing is merged that changes what its
notes describe (the purchase page, Bluetooth, Delete account): from its second
launch, the reviewer's copy runs whatever is on main. Apple has finished with
1.87.11, so nothing waits on Apple now. Whether Google has finished with the
1.87.11 Android build was not known on 12 October, and Google's reviewer takes
updates from main the same way, so keep the same care until Play Console shows
1.87.11 out in production.

**Left out on purpose: the Developer pages.** Justin's own account also has
Settings → Developer (accounts, sales, messages, account help with its
Confirm button, What's live). No other account is shown it, the review
account included, and the server checks which account is asking. They were
already there when Apple approved 1.86.83 with nothing said about them, and
nobody but Justin can reach them. If Apple asks, they are the developer's
own support tools. Google's App access note does name them, in one line,
because Google asks for an app to be what you see is what you get.

**Four things every time that block is pasted** (done for 1.87.11; the
brackets here are still empty, so the next version needs them again):

- **The three lines Apple's help page asks for.** Fill in the brackets in
  "Tested on" with the iOS version on the iPhone and the watch model and
  watchOS version it was tried with (Settings → General → About on each).
  Apple's 2.1(a) says placeholder text has to be gone before it is sent.
- **The demo account has the full version.** The signed-in screens are
  behind the unlock, so the account Apple signs in with has to have it, or
  the reviewer stops at the purchase page. If that account opens on the
  purchase page instead of Settings, it does not have it yet.
- **The demo account is not Justin's own.** His is the only account that
  shows Bluetooth (beta) and the Developer pages, and those pages show
  customers' email addresses. Sign in once on a phone with the account in
  App Review Information: it should open on Settings, with no Bluetooth
  (beta) row and no Developer section. The same account goes in Google's
  App access.
- **The three video links replace the brackets under Videos,** at the very
  end: the FM3 video (the Hardware paragraph calls it video 1), the presets
  video, and the one of deleting an account (video 3). Each is a Google
  Drive link whose sharing is set to Anyone with the link: Apple's reviewers
  are not signed in to Google, and a link that asks them to is the same as
  no video under 2.1.

**Marked beta, not a beta app.** Guideline 2.2 keeps test versions of whole
apps off the store. A finished app with one feature marked beta is what Edit
(Beta) already is in these notes, and the notes say everything else works
without it. The Edit paragraph keeps its one honest sentence on why it is a
Beta, which matches the note on that screen, and no longer adds "It is still
being improved", which reads as unfinished. And the Bluetooth page, with its
Testing tools (a bench that says "For testing." and offers write checks),
shows only on Justin's own account, so in a build made after 11 October the
reviewer meets neither; the one Bluetooth paragraph in the notes says the code is there and whose it
is, so nothing in the app is undescribed.

### What's New in This Version, 1.87.11

App Store Connect → the 1.87.11 version → What's New in This Version. Plain
words, one change a line, everything since 1.86.83, the version on the App
Store before it. Apple takes 4000 characters, and all of it fits. No Bluetooth
line: since 11 October Bluetooth (beta) is the developer's alone, so What's
New does not announce what customers cannot open. Google Play gets its own
shorter list, under *Google Play release notes* below.

```
• Bought it on another device? The purchase page now says to sign in with that account instead of buying again.
• Paid before you had an account? The app now points you straight to making one, and your purchase goes with it.
• Turn the metronome on and off from the volume pop-up.
• The metronome's flash and click now land on the same beat.
• With an AM4, the tuner can now open on the AM4 itself too, once its Tuner setting has a MIDI number (SETUP > MIDI/Remote > Tuner). Needs the newest desktop app.
• No confirmation email? The app now says to look in Spam, Junk or Promotions.
• On iPhone, Appearance set to Auto now follows your phone's light or dark setting.
• You can now make an account before buying.
• Delete account is also at the bottom of the purchase page.
• Edit is marked Beta while more blocks are added. If anything on it looks wrong, tell us with Feedback in Settings.
• Tap tempo ignores stray taps outside the tempos your unit can use.
• A message about a problem now floats over the screen instead of pushing it down.
• Phone & computer in Settings says in red when the desktop app needs updating.
• Preset names no longer go blank again after Refresh names.
• With the phone's own metronome click on, the screen stays awake on every screen, so the click no longer stops when the phone would have gone to sleep.
• The metronome's flash follows the rounded corners of your screen.
• Scrolling the signal chain sideways on Edit no longer swipes you back to Play.
• The Mac, Windows and Linux icons on Connect a computer open the download page.
• The demo no longer says NO COMPUTER a moment after it starts.
```

### Google Play release notes, 1.87.11

Play Console → Test and release → Production → the 1.87.11 release → Edit
release → Release notes (en-US). Play takes 500 characters. These are the
changes since 1.87.1, the version on Google Play before it (and still the one
there until Google has finished with 1.87.11), and say nothing about
Bluetooth. The build reaches Play with no release notes, because EAS cannot
send them. If Play will not let the release be edited while it is in
review, leave it: release notes are optional, and Google does not turn an
update down for missing them.

```
• Bought it on another device? The purchase page now says to sign in with that account instead of buying again.
• Paid before you had an account? The app now points you straight to making one, and your purchase goes with it.
• Turn the metronome on and off from the volume pop-up. Its flash and click now land on the same beat.
• No confirmation email? The app now says to look in Spam, Junk or Promotions.
• Tap tempo ignores stray taps outside the tempos your unit can use.
```

### The Description with Bluetooth (beta): withdrawn

There was a draft here, for Justin to say yes to, of a Description and
Subtitle that opened "REQUIRES A COMPUTER, OR (IN BETA) A BLUETOOTH MIDI
ADAPTER." and gave Bluetooth a paragraph of its own, in an App Store copy and
a Google Play copy. It was withdrawn on 11 October 2026, when Bluetooth (beta)
went back to Justin's account alone: a listing has to describe the app its
readers get. When Bluetooth goes to customers in a new store version, the
draft is in this file's history (git log -p docs/app-store.md, the commit
that withdrew it), and it is checked again against that version before it is
used.

### By hand in Play Console for 1.87.11

None of this needs a build. It is all typed into Play Console, and each part
ends with **Save**, then **Publishing overview → Send changes for review**.
Google usually passes it within a day. Do the first two first, at the next
sitting: Google can hold back any update over them, 1.87.11 included, and
whether Google had finished reviewing 1.87.11 was not known on 12 October
2026.

**1. Data safety** (App content → Data safety → Manage). **Still not done on
11 October 2026:** Google Play's public Data safety page for the app lists
only Email address, Other user-generated content, Crash logs and
Diagnostics. Add these four, each **collected** and **not shared**:

- **Financial info → Purchase history.** Required. For App functionality and
  Analytics. RevenueCat keeps the purchase record, the app reads it every
  time it opens, and RevenueCat's own Play guide says to declare it. Apple's
  label already has it.
- **Personal info → User IDs.** Optional (only for somebody signed in). For
  App functionality and Account management. The account's number goes to
  RevenueCat and with every bug report.
- **Device or other IDs.** Required. For App functionality. The number
  RevenueCat makes up for a phone that is not signed in, sent every time the
  app opens, and the number Expo's update check carries for that install.
- **App activity → App interactions.** Optional (only inside a bug report,
  when Send is pressed). For Analytics. The debug log records the buttons
  pressed.

Keep **No data shared with third parties**: RevenueCat, Supabase, Resend and
Expo only do their part of the job for the app. In the same form, check the
delete-account link is https://fractal.newbold.cloud/privacy.html.

Leave **Location** out, the same as Apple's answers ("Do not declare location"
above). The country RevenueCat notes is worked out by RevenueCat from the
internet connection, not read from the phone, and the privacy page says so
under "No location". Declaring it here would contradict that page.

**2. App access** (App content → App access → All or some functionality is
restricted → the instruction with the review account, or Add instructions).
Google's reviewer needs the same thing Apple's does: the demo account Apple
signs in with, which has to have the full version for good, with nothing
that runs out, or it stops at the purchase page. Its email and password go
in their own boxes. Replace whatever is in "Any other information" now (the
1.87.1 note, if it was pasted: it described a first-launch Bluetooth card
that this build does not have) with this:

```
This account has the full version.

No hardware? The app has a full demo that needs no account and no gear:
  1. Tap "Get started"
  2. Tap "Got it"
  3. Tap "Start free demo"
  4. Choose any unit, then tap "Play with ..."

Delete account: Settings (the gear, top right) → the account card at the top → Delete account → "Delete my account". Please try it on a new account, not this one.

This build contains Bluetooth MIDI code for a feature (reaching the guitar unit through a Bluetooth MIDI adapter instead of a computer) that is switched on only for the developer's own account while it is tested. No other account sees it, this one included. That code is why the app declares Nearby devices, and Location on Android 11 and older, where Android needs it to find a Bluetooth device; it never reads where the phone is. They are asked for only after Connect is tapped on the Bluetooth page, which this account cannot open. If it is offered to everyone, that will be in a later version, sent for review with a description of it.

Settings also has Developer pages (accounts, sales, messages) that open only for the developer's own account; the server checks which account is asking.
```

If the box will not take all of it, drop the last paragraph first. If it is
still too long, use this short version instead:

```
This account has the full version. No hardware? Demo, no account needed: Get started → Got it → Start free demo → any unit → Play with ...

This build has Bluetooth MIDI code for a feature switched on only for the developer's own account while it is tested; this account never sees it. It is why Nearby devices (Location on Android 11 and older) is declared. They are asked for only after Connect on the Bluetooth page, which this account can't open.
```

The Bluetooth paragraph is the same disclosure as Apple's notes, in
Android's words, and says the one thing Apple's does not have to: why the
manifest declares Nearby devices (and Location on Android 11 and older),
and when they are asked for. The 1.87.1 note said the first launch after an
install or a Play update could still show a BLUETOOTH (BETA) card. That was
true of the 1.87.1 build, whose built-in copy was made on 10 October; the
1.87.11 build carries the hidden version inside it, so it never shows the
card, and 1.87.11 is the build Google's reviewer now has.

**A risk to know about: permissions the listing gives no reason for.** The
manifest (1.87.1's, and 1.87.11's, which is the same) declares Nearby
devices, and Location up to Android 11, while
nothing in the listing promotes a feature that needs them: the Description
says nothing about Bluetooth, because customers cannot open it. Google asks
that declared permissions serve something the app offers, and could flag
that. Nothing in the listing changes for it now. If Google does flag it,
there are two ways out, and the choice is Justin's:

- **A build without the Android Bluetooth permissions.** That moves the
  fingerprint, so it is a new build for both phones, one iOS and one Android
  slot, and Bluetooth stops working on Android for his phone too until it
  comes back.
- **Listing Bluetooth, once customers have it.** Only in the version that
  opens it to them, never before (*Never switched on for customers by an
  update*, above).

I would wait: answer Google with the App access note above if they ask, and
take the build only if they insist.

**3. The listing** (Grow users → Store presence → Store listings → the default
listing), any time: nothing in it waits for 1.87.11 now. Checked on 11
October 2026, the live listing still has both faults below, and Google
reviews the listing along with the build, so this is cheapest done in the
same sitting.

- **Short description:** the one under *Google Play: short description*,
  which starts "Requires a computer" in ordinary letters. The live one is
  in capitals.
- **Full description:** the Description at the top of this file. It says
  nothing about Bluetooth, because customers cannot open it. It once said
  Bluetooth (beta) could take the computer's place, partly so that the
  Nearby devices permission 1.87.1 declares matched something the listing
  promoted; the App access note above now says why that permission is
  declared and when it is asked for instead, and the risk that leaves is
  named under it.
- **The trademark line** at the end has to be the one in this file, which
  names the VP4 and Fractal Audio. The live one says "FM3, FM9, Axe-Fx and
  AM4 are trademarks of their respective owner" and leaves the VP4 out.

**4. Old testing tracks** (Test and release → Testing → Closed testing, and
Internal testing). Google Play's public page for the app lists the camera,
USB storage and "draw over other apps" among its permissions, and neither
1.87.1 nor 1.87.11 asks for any of them (the camera was taken out in
1.86.8, the other three in 1.87.1), while the privacy page says the camera is never
used. The likeliest reason is an old release still live on a testing
track, which Google's page counts too. Everything is production now ("I
don't do any close testing anymore"), so pause any testing track that still
has a release live. Once 1.87.11 is processed, App bundle explorer → 1.87.11
→ Permissions should show none of the three.

---

## Kept for the record: the 1.87.1 texts (not for pasting)

These were written for the 1.87.1 builds of 10 October 2026, and the 1.87.11
texts above replace them. Apple never got them: build 26 went to TestFlight
only, and is not to be submitted. The App access note may be in Play Console
now, if it was pasted for 1.87.1; the 1.87.11 note above goes in its place.
They are quoted here rather than fenced, so nothing in this part is mistaken
for a block to paste.

**The 1.87.1 Notes for App Review** were the 1.87.11 notes above without
three paragraphs (*The in-app purchase*, *Paying once* and *Metronome*) and
the sentence on the confirmation email, and with "New in this version:"
where the 1.87.11 notes say which version they are new since. The full text
is in this file's history (git log -p docs/app-store.md).

**The 1.87.1 What's New** (the first five lines were the Play copy):

> - You can now make an account before buying.
> - Delete account is also at the bottom of the purchase page.
> - Edit is marked Beta while more blocks are added. If anything on it looks wrong, tell us with Feedback in Settings.
> - Preset names no longer go blank again after Refresh names.
> - With the phone's own metronome click on, the screen stays awake on every screen, so the click no longer stops when the phone would have gone to sleep.
> - On iPhone, Appearance set to Auto now follows your phone's light or dark setting.
> - The metronome's flash follows the rounded corners of your screen.
> - Scrolling the signal chain sideways on Edit no longer swipes you back to Play.
> - The Mac, Windows and Linux icons on Connect a computer open the download page.
> - The demo no longer says NO COMPUTER a moment after it starts.

**The 1.87.1 App access note for Google** ("Any other information"):

> This account has the full version.
>
> No hardware? The app has a full demo that needs no account and no gear:
> 1. Tap "Get started"
> 2. Tap "Got it"
> 3. Tap "Start free demo"
> 4. Choose any unit, then tap "Play with ..."
>
> This build also contains Bluetooth MIDI code for a feature switched on only for the developer's own account while it is tested. Once the app has downloaded its first update, usually from its second launch, this account does not see it. On the first launch after this version is installed or updated, the copy built into it can still show a BLUETOOTH (BETA) card under Settings → Phone & computer; the app asks for Nearby devices (or Location, on Android 11 and older) only if Connect is tapped on the page it opens.
