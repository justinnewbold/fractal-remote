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
A phone cannot talk to a Fractal unit on its own. So the desktop app runs on your Mac, Windows PC or Linux computer, holds the USB cable, and your phone talks to that. Get it at fractal.newbold.cloud/downloads.

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

- **Full description (4000):** the Description above, exactly.
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
(Beta), and Bluetooth, if it goes in. And one sentence in the old notes stopped
being true: "An account is used for one thing only: joining this phone to a
computer". An account also carries the full version and the setlists to other
devices, and anybody can make one now, so it is rewritten below.

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
unit itself, as the note at the foot of that screen says. It is still being
improved.

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

**Only if Bluetooth goes in this version: Justin decides.** If it does not,
leave this paragraph out. If it does, move it into the notes block above,
after the Edit (Beta) paragraph, so what gets pasted is one block. It is
only true once two things are done first:
Bluetooth is shown only to chosen accounts with Apple's demo account among
them (today it would show to everyone who has paid), and a short phone video
of it working is linked in App Review Information. Apple's 2.3.1(a) also
says a new feature must be "accessible for review", which is why the demo
account has to be on the list rather than left off it.

```
Bluetooth (beta). This version can also reach the guitar unit with no
computer, through a Bluetooth MIDI adapter (for example a CME WIDI) plugged
into the unit's MIDI In and Out. While it is being tested it is shown only
to selected accounts, the demo account in App Review Information among
them: Settings, then Phone & computer, then BLUETOOTH (BETA). It needs the
adapter and a unit, so a video of it working is linked in App Review
Information. The phone asks for Bluetooth permission only when Connect is
tapped on that page.
```

**Check the list before this paragraph goes in.** The accounts Bluetooth is
shown to are `BLUETOOTH_TESTERS` in `shared/bluetooth-testers.mjs`, which the
Bluetooth work is adding. The reviewer signs in with the demo account, so the
demo account's own id has to be on that list: Justin's account being there is
not enough, and neither is the note in the file that says where it goes. The
id is in the Supabase dashboard, under Authentication → Users, beside the demo
address. Without it the reviewer finds no Bluetooth card where the notes say
there is one. Adding it is ordinary app code, so it goes out as an update, not
a build. Once this paragraph is in the block above, a test refuses a list that
holds nobody but the admins.

### What's New in This Version, 1.87.1

Plain words, one change a line. The App Store takes 4000 characters, and
all of it fits. Google Play's release notes take only 500, so on Play use the
first five lines, which come to 445.

```
• You can now make an account before buying.
• Delete account is also at the bottom of the purchase page.
• Edit is marked Beta while it keeps getting better. If anything on it looks wrong, tell us with Feedback in Settings.
• With the phone's own metronome click on, the screen stays awake on every screen, so the click no longer stops when the phone would have gone to sleep.
• The metronome's flash follows the rounded corners of your screen.
• Scrolling the signal chain sideways on Edit no longer swipes you back to Play.
• The Mac, Windows and Linux icons on Connect a computer open the download page.
• Preset names no longer go blank again after Refresh names.
• The demo no longer says NO COMPUTER a moment after it starts.
```

**Bluetooth is left out of What's New on purpose, even if it goes into this
build.** What's New is read by every customer, and while only chosen accounts
can see Bluetooth, a line about it would announce something they cannot open.
This line is for the version where Bluetooth opens to everyone, not this one:

```
• Bluetooth (beta): play with no computer, through a Bluetooth MIDI adapter on your unit.
```
