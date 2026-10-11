# Getting onto the App Store

**Live on the App Store since 8 October 2026** (build 24, 1.86.83):
https://apps.apple.com/app/id6812916461. Everything below still applies to
every new version sent for review.

Everything App Store Connect asks for, answered. Copy the fields straight
across; the notes say why an answer is what it is where that matters.

**The one that gets apps like this rejected** is near the bottom, under *Review
notes*. Read that one even if you skip the rest.

**The version in the store and the next one are kept apart.** Everything down
to the end of *Review notes* is for the version in the store now, except where
it says it waits for the next build. What goes with the next version, 1.87.1,
is at the very bottom, under *For the next version*.

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
version is released:** a version already in review keeps its own copy of the
paragraph, and the run warns about any it could not change.

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

**This is the one to paste for 1.87.1.** It says nothing about Bluetooth.
For one day (10 October 2026) it did: the demo paragraph and HOW IT WORKS
both said that, in beta, a Bluetooth MIDI adapter could take the computer's
place. Then, on 11 October: "Is there any way to just get the Bluetooth on
the developers mode for my own phone? I just feel like it's not ready to
have public." So Bluetooth (beta) shows on Justin's account alone, and a
listing that promoted it would be promising customers something they cannot
open (Apple's 2.3, and Google Play's rule that the listing matches the app).
Both places say the computer again. **On Google Play it can go on whenever
it suits:** nothing in it waits for 1.87.1 any more.

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
  no Bluetooth, so it does not wait for 1.87.1. *By hand in Play Console for
  1.87.1*, at the bottom, says the rest.
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

**Paste this into App Review Information → Notes.** This is the paragraph that
decides whether the app is rejected as non-functional.

**This block is the one for the version in the store now (1.86.83).** For
1.87.1, use the notes under *For the next version* at the bottom instead.

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

## For the next version (1.87.1, not yet submitted)

**Everything above this heading is for the version in the store now** (1.86.83,
build 24, and the updates it has had since), except the Description and the
Subtitle, which are already the new ones and wait for this version (Apple
changes both only with a new version). **Everything under it is for 1.87.1,**
the next store build, and is pasted when that version is set up in App Store
Connect. Until then the notes above stay as they are.

Why the notes change at all: Apple's guideline 2.3.1(a) says every new feature
"must be described with specificity in the Notes for Review", and 2.3.12 says
What's New has to list the bigger changes. Three things are new to a reviewer
since 1.86.83 was approved: an account can be made before buying, Edit says
(Beta), and, on iPhone, Appearance set to Auto now follows the phone's light
or dark setting (in 1.86.83 Auto was always dark, so a reviewer whose phone is
set to light now sees the light theme first). And
one sentence in the old notes stopped being true: "An account is used for one
thing only: joining this phone to a computer". An account also carries the
full version and the setlists to other devices, and anybody can make one now,
so it is rewritten below.

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
say in one paragraph that the code is there, whom it is for, and that nobody
else sees it or is asked for Bluetooth. The same guideline also wants new
features "accessible for review", and this one is described rather than
reachable: that is the one place Apple could push back. If it does, the
choice is Justin's: show it to the review account too, with a video of it
working, or a build without the module.

### Notes for App Review, 1.87.1

**Paste this into App Review Information → Notes**, in place of the block
above, when 1.87.1 is sent.

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

The demo is free and needs no account. An account is what joins this phone
to a computer that has the guitar unit plugged into it, and it carries the
full version and the user's setlists to their other devices.

New in this version:

Accounts before buying. Anybody can now make an account, before buying or
without buying: Create account is on the sign-in screen. Making one unlocks
nothing; the full version is still the one in-app purchase. An account that
has not bought the full version opens on the purchase page instead of
Settings, and Delete account is at the foot of that page.

Edit (Beta). The Edit screen, opened with Edit at the bottom of the Play
screen, is now marked Beta. Everything it shows works, in the demo too. It
is marked Beta because it does not yet cover every block and control of
every unit, and a control may not yet move quite the way it does on the
unit itself, as the note at the foot of that screen says.

Bluetooth MIDI code, switched on only for the developer. This build
contains Bluetooth MIDI code for a feature that lets the phone reach the
guitar unit through a Bluetooth MIDI adapter instead of a computer. While it
is tested, it is switched on only for the developer's own account.
Customers and the review account don't see it anywhere in the app, and the
app never asks them for Bluetooth permission. It will be offered to
customers only in a later version, sent for review with notes that describe
it.

Appearance. On iPhone, Appearance in Settings set to Auto, which is the
default, now follows the phone's own light or dark setting. Earlier
versions stayed dark on Auto, so on a phone set to light the app now opens
in its light theme.

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

Tested on: iPhone 17 Pro Max, iOS [version]; Apple Watch [model], watchOS
[version].

Services the app uses: Supabase (accounts, setlists, and the link between
the phone and the computer), RevenueCat with Apple in-app purchase (the one
purchase that unlocks the full version), Resend (account emails), and Expo
(app updates).

Regions: the app works the same in every country.
```

**Bluetooth is in this build, switched on for Justin's account alone.** The
Bluetooth (beta) row on Settings, and the page it opens, are drawn only for
the account that opens his Developer pages, read from the sign-in kept on
the phone (CLAUDE.md, *Bluetooth (beta) is the developer's only*). The
review account is not that account, so the reviewer never meets it, and the
paragraph above says so instead of telling them where it is. No video of
Bluetooth goes with this version: there is nothing for the reviewer to
reach. (The Hardware paragraph's FM3 video, which is about the computer,
still does.)

**Never switched on for customers by an update.** When it is ready, it goes
in a new store version whose review notes describe it, the way this
section's notes did on 10 October (they are in this file's history), with
the video and the setup guide. Turning
it on for everybody over the air instead, after Apple has reviewed a build
that hides it, is the hidden feature 2.3.1(a) forbids, and a change to what
the app does that Apple's licence (3.3.1(C)) and Google's rule on features
activated remotely both keep for reviewed versions.

**Two things before that block is pasted:**

- **The three lines Apple's help page asks for.** Fill in the brackets in
  "Tested on" with the iOS version on the iPhone and the watch model and
  watchOS version it was tried with (Settings → General → About on each).
  Apple's 2.1(a) says placeholder text has to be gone before it is sent.
- **The demo account has the full version.** The signed-in screens are
  behind the unlock, so the account Apple signs in with has to have it, or
  the reviewer stops at the purchase page. If that account opens on the
  purchase page instead of Settings, it does not have it yet.

**Marked beta, not a beta app.** Guideline 2.2 keeps test versions of whole
apps off the store. A finished app with one feature marked beta is what Edit
(Beta) already is in these notes, and the notes say everything else works
without it. The Edit paragraph keeps its one honest sentence on why it is a
Beta, which matches the note on that screen, and no longer adds "It is still
being improved", which reads as unfinished. And the Bluetooth page, with its
Testing tools (a bench that says "For testing." and offers write checks),
shows only on Justin's own account, so no reviewer or customer meets either;
the one Bluetooth paragraph in the notes says the code is there and whose it
is, so nothing in the app is undescribed.

### What's New in This Version, 1.87.1

Plain words, one change a line. The App Store takes 4000 characters, and
all of it fits. Google Play's release notes take only 500, so on Play use the
first five lines. No Bluetooth line: for one day it led this list, and since
11 October Bluetooth (beta) is the developer's alone, so What's New does not
announce what customers cannot open. The Appearance line is the sixth, after
Play's five, because it is about the iPhone only.

```
• You can now make an account before buying.
• Delete account is also at the bottom of the purchase page.
• Edit is marked Beta while more blocks are added. If anything on it looks wrong, tell us with Feedback in Settings.
• Preset names no longer go blank again after Refresh names.
• With the phone's own metronome click on, the screen stays awake on every screen, so the click no longer stops when the phone would have gone to sleep.
• On iPhone, Appearance set to Auto now follows your phone's light or dark setting.
• The metronome's flash follows the rounded corners of your screen.
• Scrolling the signal chain sideways on Edit no longer swipes you back to Play.
• The Mac, Windows and Linux icons on Connect a computer open the download page.
• The demo no longer says NO COMPUTER a moment after it starts.
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

### By hand in Play Console for 1.87.1

None of this needs a build. It is all typed into Play Console, and each part
ends with **Save**, then **Publishing overview → Send changes for review**.
Google usually passes it within a day. Do the first two before 1.87.1 goes to
Google, or the same day: Google can hold back any update over them, this one
included.

**1. Data safety** (App content → Data safety → Manage). The live form lists
only Email address, Other user-generated content, Crash logs and Diagnostics.
Add these four, each **collected** and **not shared**:

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
restricted → Add instructions). Google's reviewer needs the same thing
Apple's does: the demo account Apple signs in with, which has to have the
full version, or it stops at the purchase page. Put its email and password
in the boxes for them, and this in "Any other information":

```
This account has the full version.

No hardware? The app has a full demo that needs no account and no gear:
  1. Tap "Get started"
  2. Tap "Got it"
  3. Tap "Start free demo"
  4. Choose any unit, then tap "Play with ..."

This build also contains Bluetooth MIDI code for a feature switched on only for the developer's own account while it is tested. This account does not see it, and the app never asks it for Nearby devices or Location.
```

The last line is the same disclosure as Apple's notes, in Android's words:
the manifest of 1.87.1 declares Nearby devices (and Location on Android 11
and older) because the Bluetooth code is in it, and a reviewer who sees
those declared and never asked for should be told why.

**3. The listing** (Grow users → Store presence → Store listings → the default
listing), any time: nothing in it waits for 1.87.1 now.

- **Short description:** the one under *Google Play: short description*,
  which starts "Requires a computer" in ordinary letters. The live one is
  in capitals.
- **Full description:** the Description at the top of this file. It says
  nothing about Bluetooth, because no customer can open it. It once said
  Bluetooth (beta) could take the computer's place, partly so that the
  Nearby devices permission 1.87.1 declares matched something the listing
  promoted; the App access note above now says why that permission is
  declared and never asked for instead.
- **The trademark line** at the end has to be the one in this file, which
  names the VP4 and Fractal Audio. The live one says "FM3, FM9, Axe-Fx and
  AM4 are trademarks of their respective owner" and leaves the VP4 out.

The build itself reaches Play with no release notes: EAS cannot send them.
The first five lines of *What's New* above are the Play copy, for anywhere
Play Console offers a place to paste them.
