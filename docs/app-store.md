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

**The next two versions are written already.** 1.88.3's notes (TestFlight
build 29, Bluetooth still the developer's alone) are in the 1.87.11 section,
under *Notes for App Review, 1.88.3*, and go to Apple first. 1.89.0, the
version that opens Bluetooth (beta) to customers on both phones, has a
section of its own near the end, *1.89.0: Bluetooth (beta) for customers*,
with every text it needs and the steps for the day it is sent. None of
1.89.0's texts is pasted before that day.

---

## The listing

| Field | Limit | Value |
|---|---|---|
| **Name** | 30 | `Fractal Remote` |
| **Subtitle** | 30 | `Independent · needs a computer` |
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

**And say whose app it is not, near the top** (18 October 2026). Fractal
Audio's letter on Approved Vendor status asks for a clear statement that the
app "is independently developed and is not affiliated with, endorsed by, or
supported by Fractal Audio Systems, LLC", for their products to be named in
plain text only to say what the app works with, and for support to come
through Justin's own channels. Justin: "I wanna comply as much as I can. I'm
just not gonna change the app name unless Fractal pushes back on it." So:

- The **subtitle**, the one short line under the name, says it:
  `Independent · needs a computer` (30 of 30, and it still says computer).
  Apple changes the subtitle only with a new version, so it goes in with the
  next one.
- The **promotional text** carries the short form, after REQUIRES A COMPUTER.
- The **Description** carries the full sentence and the trademark line as its
  second paragraph, straight after REQUIRES A COMPUTER, not at the very end
  where both stores' "more" hides it.
- The **Google Play short description** says "Not made or supported by
  Fractal Audio."
- **Never "official", "certified", "approved" or "endorsed"** about the app,
  here, on the website or in the app, and a test holds the listing to it. If
  Approved Vendor status ever comes, the letter itself says it "does not
  constitute certification or endorsement": it is forum participation, and
  no badge or line in a listing presents it as more.
- **The name stays "Fractal Remote"**, by Justin's decision, unless Fractal
  sends a formal demand. The letter does not approve it; it says naming
  Fractal's products in plain text to state compatibility is fine, which is
  all the listing does.

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

**On a VP4 it says what does not work yet** (since 15 October 2026), because
it is the one part of the App Store page that can change before the next
version, and the live Description there still promises a VP4 presets,
scenes, the tuner and tap tempo (see *Description*, below). It names the
same five things the purchase page does, and gave up "and your phone
controls it from there" and "The demo needs no gear" for the room: the
Description says both straight after it.

**And it says whose app it is not** (18 October 2026), in the short form of
Fractal Audio's sentence (NOT_AFFILIATED_SHORT in shared/affiliation.mjs),
because the live Description on the App Store keeps its old disclaimer, at
its very end, until the next version. 170 characters do not hold the full
sentence beside the computer and the VP4, so the order is the one that
matters: the computer first, the disclaimer second, and the VP4 line
shortened to fit ("knobs, tuner, tap tempo, channels and saving", the same
five, without "the app's"). 169 of 170. It goes live only when the
store-text workflow is run with **Write it**, which is Justin's call, not a
merge's. And whether the App Store's web page shows promotional text at all
(the App Store app on an iPhone does, above the description) is worth a look
in a desktop browser before anybody is told it is there.

```
REQUIRES A COMPUTER. Not affiliated with, endorsed by, or supported by Fractal Audio Systems, LLC. On a VP4, knobs, tuner, tap tempo, channels and saving don't work yet.
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

**The disclaimer is its second paragraph now** (18 October 2026), Fractal
Audio's sentence and the trademark line, straight after REQUIRES A COMPUTER.
It was the very last paragraph, below "more" on both stores, so a reader met
the brand dozens of times before the line that says the app is not theirs.
And WHAT IT DOES says "Colors that can match your Fractal unit (Settings →
Colors)": since 18 October 2026 without the words that tied the app's look
to Fractal's own editing software, and since 19 October 2026 with "can" and
where, because the app starts in its own colors (Fractal Remote) now and
matching the unit is a look you pick. **On the
App Store this waits for the next version**: the live 1.87.11 page keeps the
old Description, whose last line says "Not affiliated with, authorised by,
or endorsed by Fractal Audio Systems", until then. On Google Play it can go
on now.

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

**From 1.89.0 it is replaced** by the Description under *1.89.0: Bluetooth
(beta) for customers*, near the end of this file: this one with a sentence
on Bluetooth (beta) after REQUIRES A COMPUTER, the demo paragraph's last
sentence and HOW IT WORKS's first made true of an AM4 on Bluetooth, and a
BLUETOOTH (BETA), FOR THE AM4 section after HOW IT WORKS. Until 1.89.0 is
sent to Apple, and rolled out to everybody on Google Play, this one stays on
both stores: a
listing that offered Bluetooth before the copy in a customer's hand had it
would be wrong the other way.

**And on a VP4 it says what the app does there, and no more** (15 October
2026). It said "FM3, FM9, Axe-Fx III, AM4 and VP4" and then promised every
one of them presets, scenes, channels, the tuner and tap tempo, and on a VP4
the app did little more than switch effects on and off. "I didn't know that those
settings didn't work on the VP4. I thought that they did, so yeah, if they
don't, we need to put that in there for now." So SUPPORTED UNITS gives the
VP4 a line of its own, the purchase page's sentence word for word
(VP4_SO_FAR in shared/vp4-safety.mjs; test/vp4-safety.mjs holds this file,
the download page and both purchase pages to it): effects on and off,
presets, and scenes once one number is set on the VP4, which are new and
untried by us; knobs, the tuner, tap tempo, channels and saving not yet; and
what a VP4 owner meets on the first screen, since WHAT IT DOES, just under
it, promises presets "by name, in slot order": the list shows A1 to Z4, not
names, the effects say neither on nor off until tapped, and Previous and Next
go through a setlist or the stars, not slot by slot.
"Not yet", never "coming": Apple's 2.3.1(a) forbids "promoting content or
services that it does not actually offer", and a promise with no date is
that. Presets and scenes on a VP4 need the computer app that carries them,
so this goes on Google Play once that computer app is out, by hand (see
*Google Play*, below). The App Store gets it with the next version; until
then the promotional text, above, says what does not work. The day one of
the five works, the sentence changes in shared/vp4-safety.mjs and here
together.

```
REQUIRES A COMPUTER. Your Fractal unit plugs into a Mac, Windows or Linux computer with a USB cable, and that computer runs the Fractal Remote desktop app (get it at fractal.newbold.cloud/downloads). Your phone controls the unit through it, so the computer has to stay on and connected while you play.

Fractal Remote is independently developed and is not affiliated with, endorsed by, or supported by Fractal Audio Systems, LLC. “Fractal Audio”, “Axe-Fx”, “FM3”, “FM9”, “AM4” and “VP4” are trademarks of Fractal Audio Systems, LLC, used here only to say which hardware this app works with.

Fractal Remote turns your phone into a remote control for your Fractal Audio rig. Switch presets and scenes, turn blocks on and off, change channels, tune up and tap tempo, without walking back to your unit. Build a setlist for tonight and step through it with two big buttons you can hit in the dark.

SUPPORTED UNITS
FM3, FM9, Axe-Fx III and AM4, and the VP4 in part.
On a VP4, the app turns effects on and off, changes presets, and changes scenes once you set one number on the VP4 itself. Changing presets and scenes is new on a VP4, and nobody on our side has tried it on one yet. Knobs, the tuner, tap tempo, channels and saving don't work on a VP4 from the app yet. The app can't show the names of a VP4's presets, except the one it is on, or whether its effects are on or off, yet. On a VP4, Previous and Next go through a setlist or your starred presets, not slot by slot.

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
• Colors that can match your Fractal unit (Settings → Colors), so you find things by looking

HOW IT WORKS
A phone needs something between it and your Fractal unit: the desktop app. It runs on your Mac, Windows PC or Linux computer, holds the USB cable, and your phone talks to it. Get it at fractal.newbold.cloud/downloads.

Once the two are paired, the phone works from anywhere: the same room, the far side of the stage, or a different building.

ONE PAYMENT, LIFETIME UNLOCK
Controlling real hardware is a single purchase. It unlocks the full app on every device you own, forever, including every future update, on all supported Fractal units (on a VP4, what SUPPORTED UNITS says). No subscription.
```

### Google Play

Both of these change any time, with no build: Play Console → Fractal Remote →
**Grow users → Store presence → Store listings** → the default listing. Paste
them, press **Save**, then **Publishing overview → Send changes for review**.
Google usually passes a text change within a day. While Managed publishing
is on (only around 1.89.0: *Submission day for 1.89.0*, steps 3 to 16), a
change Google has passed also waits under Changes ready to publish until
**Publish changes** is pressed.

- **Full description (4000):** the Description above, exactly. It mentions
  no Bluetooth, so it does not wait for 1.87.11. *By hand in Play Console for
  1.87.11*, at the bottom, says the rest. Its VP4 lines say the VP4 changes
  presets and scenes, which is true once the computer app that does it is
  out, so they are pasted once it is, not before.
- **Short description (80):** the line under the app's name. **Not in
  capitals.** Google's help for this one field says "Do not use capitalization
  for emphasis", and its metadata policy lists "ALL CAPS although not part of
  brand name" as a violation. Apple has no such rule, so the capitals stay on
  the App Store, and the headings in the full description (SUPPORTED UNITS and
  the rest) have been on Play since launch.

### Google Play: short description (80)

The line right under the app's name on Play. It said "Control your Fractal
from your phone", which, under the name Fractal Remote, reads as Fractal's
own remote for your Fractal. Since 18 October 2026 it says whose app it is
not instead, cut to fit: 80 of 80, still opening on the computer, and in
ordinary letters.

```
Requires a computer and our desktop app. Not made or supported by Fractal Audio.
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

**iPhone Duo screenshots: optional now, required from April 2027.** Apple's
post of 5 October 2026 ("Prepare and submit your apps for iPhone Duo"): the
Duo went on sale on 23 October 2026, its screenshots put a badge on the
product page, and "starting April 2027, all submitted apps and games must
include iPhone Duo screenshots". So the first submission from April 2027
needs a set taken on a Duo, opened up, in the demo, with Play's wide layout.

Worth showing, in this order:

1. The stage screen with a preset up and scenes along the bottom
2. The chain, with blocks on and off
3. The tuner
4. A setlist
5. Setup, showing it connected

**Never a Fractal logo, a product photo or a real Fractal unit** (18 October
2026), in any screenshot, App Preview, Play feature graphic, store video or
picture on the website. Fractal Audio's letter asks for no logos, no
official product photographs and no other proprietary artwork, and names in
plain text are the one use it allows. That includes a photograph of
Justin's own FM3: the hardware wears Fractal's logo. Google Play's welcome
screenshot, with the FM3 photograph that has since left the app, is exactly
what this rule is for. **The one exception is the review videos** linked in
App Review Information (*Notes for App Review*, below): they have to show the
real hardware, under Apple's 2.1, and they stay private links for the
reviewer. Never an App Preview, never on the website, never posted.

---

## App Privacy (the nutrition label)

Answer **Yes** to collecting data, then declare exactly these. Everything is
**"used for App Functionality"**, and **nothing is used for tracking** — say No
to the tracking question, because it is true and it keeps you out of App
Tracking Transparency entirely.

| Data type | Collected | Linked to the user | Why |
|---|---|---|---|
| Contact Info → **Email Address** | Yes | Yes | Account sign-in, and answering a support message: the address they leave, or, when they leave none and are signed in, the account's own (22 October 2026) |
| User Content → **Other User Content** | Yes | Yes | Setlists, so they follow you between devices |
| User Content → **Photos or Videos** | Yes | Yes | Screenshots somebody chooses to add to a bug report (up to three, pasted or picked on a phone, picked on the website), sent only when they press Send. Added 22 October 2026: **not on the live label yet** |
| User Content → **Customer Support** | Yes | Yes | What somebody writes in a bug report or suggestion: the Feedback form, and the note beside Send logs to developer. It was true before the note came, and was never on the label; add it with Photos or Videos. **Not on the live label yet** |
| Identifiers → **User ID** | Yes | Yes | The account id that ties your setlists to you |
| Diagnostics → **Other Diagnostic Data** | Yes | Yes | The debug log, and only when somebody presses Send on a bug report |
| Purchases → **Purchase History** | Yes | Yes | The unlock. RevenueCat keeps the purchase record so it follows the account to other devices |
| Diagnostics → **Crash Data** | Yes | No | After a launch that crashed, the phone's update check sends Expo the error message the app stopped on, so a broken update can be found and taken back. The privacy page says so. Added 11 October 2026, and on the live label by 24 October 2026 (apps.apple.com shows Crash Data under Not Linked) |

Do **not** declare location, contacts, audio, search history, browsing
history or advertising data. None are collected — and the
privacy page says so, so a wrong answer here contradicts a published document.
Photos are declared only for the screenshots somebody adds to a report: the
app reads nothing from the photo library itself (the phone's own picker hands
it only the pictures picked, and Paste takes a copied one), which the privacy
page says too. The build carries NSPhotoLibraryUsageDescription for the
picker, and a camera sentence that says the camera is never used: the
picker's own code asks about the camera, and Apple's upload check refuses a
binary with no purpose string for an API its code reaches (ITMS-90683), so
switching the sentence off would have cost the build. The app never opens
the camera, so nobody is ever shown it. On Android the camera is blocked,
and the microphone is off on both.

**Before the next version is sent to Apple** (still not on the live label
on 24 October 2026, which shows Purchase History, Email Address, Other User
Content, User ID, Other Diagnostic Data and Crash Data). **22 October 2026:
two rows to add in App Store Connect → App Privacy**, both
"used for App Functionality", linked to the user, not used for tracking:
Photos or Videos, and Customer Support. And one to edit: Email Address's use
now includes replying from the account's own address. None needs a build.
Justin makes these; nothing here says they are done until he has.

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

**Yes, it contains third-party content**: the names of Fractal Audio's
hardware (FM3, FM9, Axe-Fx, AM4, VP4), in plain text only, to say which
hardware the app works with. **Yes, it has the rights to use it**: naming a
product to say truthfully what yours works with is ordinary, and the
affiliation line near the top of the Description says the app is not
theirs.

No pictures of those units any more (18 October 2026). The FM3 photograph,
the FM3 with Fractal's logo on its screen, the rack front with the FRACTAL
AUDIO logo and the 35 gear drawings of Fractal's own models (34 of them with
a FRACTAL AUDIO badge) are all gone from the app and the website, so there
is no Fractal logo, product photo or artwork left for this answer to cover.

**What Fractal's letter does and does not say.** Fractal Audio's letter of
18 October 2026 says naming its products in plain text to state
compatibility is fine. It does not approve the name "Fractal Remote", which
it asked to be changed before Approved Vendor status goes ahead, and it is
not a licence for the app. Never call it written permission for the app, here
or anywhere.

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
with the module or the build is refused). 2.3.1(a) said, and 2.5.19 says
since 16 October 2026, "Don't include any hidden, dormant, or undocumented
features in your app", so the notes below
say in one paragraph that the code is there, whom it is for, and that in
that build nobody else is shown it or asked for Bluetooth. The same guideline also wants new features "accessible for review", and this
one is described rather than reachable. That was the one place Apple could
have pushed back, and with 1.87.11 it did not: the build was approved with the
paragraph below as it stands. A later review could still ask. If one does, the
choice is Justin's: show it to the review account too, with a video of it
working, or a build without the module.

**Apple's guidelines of 16 October 2026, read on 24 October** (the page says
"Last Updated: October 16, 2026"). The sentence quoted above left 2.3.1 for
a guideline of its own, word for word: 2.5.19, which Apple's post of the
same day says "clarifies long-standing policy" and aims at "bait-and-switch"
apps that add features after approval. The rule is the same, so the answer
is too: the next notes keep the Bluetooth paragraph, saying the code is
there and whose it is, and this file names 2.5.19 for it from now on. The
two things the app keeps for the developer's account alone are both said in
the next notes: Bluetooth (beta) and the Developer pages (below, no longer
left out). Nothing is ever opened
to customers by an update (CLAUDE.md's Bluetooth rule is this guideline),
and the fractalremote:// links, Justin's alone by update until now, open to
everybody in the next build, which is the version whose notes say so.
The same update added 2.3.14 on creative assets (the new product page
headers and search result pictures): the app uses none, and any made later
carry no Fractal logo or artwork, no price and no claim that cannot be
checked. 1.2, 3.1.1(a) and section 5 changed in ways that do not touch the
app. 2.5.11, Siri and Shortcuts, did not change; the Siri paragraph below
was checked against it.

**For the next version's notes: Dark by default** (18 October 2026). "Can
we make the default dark mode on the app?" Settings → Play screen still has
Auto, Light and Dark, and Auto still follows the iPhone's own setting
(app.json keeps userInterfaceStyle "automatic"), but a phone, browser or
computer that never chose now starts dark rather than on Auto. Anybody who
chose Auto or Light keeps it. For the Notes for Review and What's New:
"The app starts in Dark appearance; Settings, under Play screen, has Auto,
Light and Dark."

**For the next version's notes: the app's own colors by default** (19
October 2026). "Can we change it so the fractal remote colors scene is the
default? But then the first time the app loads, also let people know that
they can change the theme to match their actual unit in settings?" A phone,
browser or computer that never chose a look now starts in Fractal Remote,
the app's own colors, rather than Match my unit; anybody who chose a look
keeps it. Once on every device, after the startup card, the walkthrough
and Play's other one-time notes, Play says "Match your unit’s colors in
Settings", and pressing it opens Settings → Colors. The looks and
Settings → Colors are not in the app Apple reviewed: they came after
1.87.11, by update (1.87.40, 18 October 2026), so 2.3.1(a) wants the next
version's *New since 1.87.11* to describe the Colors page as new, with the
looks it offers and which one a first launch wears. For the Notes for
Review and What's New: "New: Settings → Colors, with six looks for the
tiles and scenes: Fractal Remote (the app's own colors, which a first
launch wears), Match my unit (the colors of your Fractal unit), Footswitch
lights, Color-blind safe, Sunlight and Stompbox." The Description above
already says it ("Colors that can match your Fractal unit (Settings →
Colors)").

**For the next version's notes: the startup card** (18 October 2026). Since
then the app opens, once on every device, on a card headed "An independent
app", with Fractal Audio's sentence, where help comes from, and an OK
button, before the walkthrough or anything else; and Fractal's sentence sits
under the spinner and "Finding your computer…" while the app starts. A
reviewer's first launch meets the card before "Get started", so the next
version's demo steps open on it: "1. Tap "OK" on the card that says the app
is independent", then the four taps as they are. 2.3.1(a) wants what is new
described, so *New since 1.87.11* gets one paragraph on it, and nothing in
the notes calls the app approved by, or connected with, Fractal. A test
holds the steps to the walkthrough's own words, and that test learns the
card's OK on the day those notes are written. (The next build carries the
card inside it, so a reviewer's very first launch has it. The 1.87.1 and
1.87.11 builds do not: on the first launch after a fresh install or a store
update they run the copy built into them, `fallbackToCacheTimeout` being 0.
After a fresh install that is the old first screen, with the FM3 photograph
and no card, once; after a store update, the walkthrough long since seen, it
is only no card on that one launch. The card and the plain box come with the
update, from the next launch. Only the next build pair closes that, and it
is asked for like any other.)

**For the next version's notes: the VP4** (15 October 2026). Its presets and
scenes reach phones by an update and the computer app, not by a build, and
2.3.1(a) wants a new feature described in the next notes, so the next
version's *New since 1.87.11* says it in a paragraph: on a VP4 the app now
changes presets (a MIDI Program Change, A1 to Z4) and scenes (the VP4's own
Scene Select message, on a number the player sets on the VP4 and types into
a "VP4 scenes & presets" page in Settings, which shows only with a real VP4
connected), new and not yet tried on a VP4 by us; and on a VP4 the app says
in words, rather than doing, what it can't do there yet: knobs, the tuner,
tap tempo, channels and saving. The review account has no VP4, so the page
is described rather than reachable, as Bluetooth is above; the demo's VP4
says what a real one does not do. What's New gets one line: "On a VP4, the
app changes presets, and scenes once you set one number on the VP4." The
Description above already says it.

**For the next version's notes: the AM4's amp pedal is its boost** (22
October 2026). "On the AM4 the amp on off button should do an amp boost
instead of turning the amp completely off. It should say Boost on, Boost off
when they tap it." Since 1.87.49, by update, on an AM4 the amp's pedal on
Play, on the phone, the watch and the browser, switches the amp's Out Boost
and never turns the amp off. On the phone and in the browser it says Boost
on or Boost off; Amp off when the amp itself is off in that scene; no word,
with a dashed edge, until the unit has said. The watch says the same words
from this version on (23 October 2026, the build pair after 1.87.52): under
the AMP pedal's name, Boost on, Boost off or Amp off, and nothing until the
unit has said, sent by the phone with the pedal in Play's own words; the
pedal is lit for Boost on and dark otherwise, as it already was. The watch
app in 1.87.11 has no words to draw, so there the AMP pedal is only lit or
dark. The amp's own on and off is where a block is edited: Edit, the amp,
Engaged / Bypassed.
That is a change to what a control in the reviewed app does, so 2.3.1(a)
wants it in the next *New since 1.87.11*: one paragraph, saying the demo's
AM4 shows it, and that on the Apple Watch the amp's pedal says Boost on,
Boost off or Amp off under its name. What's New gets one line: "On an AM4,
the amp's pedal on Play now switches the amp's boost, and says Boost on or
Boost off, on the Apple Watch too. Turn the amp itself on and off in Edit."
The Description's "Turn blocks on and off" is still true (Edit does it for
every block).

**For the next version's notes: Siri, and the links** (23 October 2026).
"Let's add all of the Siri commands to the build that we can and update a
section in the app that will say how to manage Siri." The build pair after
1.87.52 carries nine App Shortcuts in the iPhone app (mobile/targets/watch/
_shared/SiriShortcuts.swift), each phrase with the app's name and no other
(2.5.11(ii): no "Fractal" or "FM3" alias), and a Settings → Siri page that
says every command by a phrase, the one rule, the Shortcuts app, the Action
button, Back Tap and how to turn it off. The same build opens the fractalremote:// links
(next, previous, scene/1 to scene/8, tuner/off, never tuner on) to everybody:
before it they answer Justin's account alone, by update. Both are new
features, so 2.3.1(a) wants them described in the next *New since 1.87.11*,
and 2.5.11(iii) allows the two follow-up questions (which number, which
tempo) because each is needed. For the Notes for Review, one paragraph:

```
Siri (new in this version). Nine App Shortcuts, each with the app's name: "Scene [1-8] in Fractal Remote", "Next song in Fractal Remote", "Previous song in Fractal Remote", "Load a preset in Fractal Remote" (Siri asks for the number), "Set the tempo in Fractal Remote" (Siri asks for the tempo), "Tuner on in Fractal Remote", "Tuner off in Fractal Remote", "[pedal] on in Fractal Remote" and "[pedal] off in Fractal Remote" (Delay, Drive, Reverb and other pedal kinds). Each opens the app and does what the matching control on the Play screen does. They work with the Play screen open; on any other screen the app says to open Play. Tuner off works from any screen. To try them without hardware, start the demo as above, keep the Play screen open, and say "Scene 3 in Fractal Remote". The same actions are in the Shortcuts app, and the links fractalremote://next, /previous, /scene/1 to /scene/8 and /tuner/off do the same from a shortcut. Settings, then Siri, explains it all. The app receives only the command, never the audio.
```

What's New gets one line: "Siri: say "Scene 3 in Fractal Remote", "Next song in Fractal Remote" and
more, with the Play screen open. Settings → Siri lists every command, and how
to use them with Shortcuts, the Action button and Back Tap." Google Play's
release notes get one line on the links, which are all Android has (Google
opens no voice route to apps like this one): "Links for Tasker and similar
apps: fractalremote://next, previous, scene/1 to 8 and tuner/off. Settings →
Links for Tasker says how."

**The privacy label is unchanged, and so is Google's Data safety.** Siri does
the listening and the recognizing, under Apple's own privacy policy, and
hands the app only the command it recognized: which scene, which pedal, a
number. The app sends that to the computer exactly as it sends the same tap
from the Play screen, and nothing new leaves the phone. No Siri entitlement
and no usage string either: Apple's Siri entitlement is for "Intents app
extensions that handle any Siri requests other than shortcut requests", and
the usage string is for SiriKit's permission prompt, which nothing here
calls. Check the build log on the day for any request for one.

**Before this version goes to Apple**, try Siri on the TestFlight copy, since
nothing before a build can show Siri hearing the phrases, and phrases cannot
be reworded by an update: each phrase; a scene said as a word ("scene three")
as well as a number, because the scene list has no spoken synonyms (those are
iOS 17 only, and the app still installs on iOS 16.4); the two follow-up
questions, which developers report Siri sometimes asking again; and whether
Siri speaks the reply when the app comes forward, which Apple promises
nothing about, so the notes and the page promise only what Play shows. If a
phrase fails, the fix is another iPhone and Android build pair before Apple.
And on an iPhone on iOS 27, look at Settings → Siri → App Access → Fractal
Remote: Apple's iOS 27 guide names no switch there for Siri's requests (the
privacy page's Use with Siri Requests is in iOS 26's words), so the page
says "turn its switches off". If the switch is there by that name, the page
can say so in an update.

**For the next version's notes: the AM4's own tuner stays up** (23 October
2026). Waiting: not for a store version until Justin has watched his own
AM4 hold its tuner steady past 15 seconds, opened from the app through the
newest desktop app. Nobody has seen it on an AM4 yet. If the AM4's tuner
goes off and on every three seconds instead, these words are wrong and the
change comes out first.

"On the AM4 when turning on the tuner it stays on for about 15 seconds on
the unit and then turns off. On the phone it stays on until you hit close.
We want it to stay on until the user hits close." With an AM4 whose Tuner
setting has a MIDI number, the tuner on the AM4 itself stays up for as long
as the tuner is open in the app and the app is on screen: the newest
desktop app sends the AM4's Tuner number again every three seconds, and so
does Bluetooth (the developer's only). Put the phone away or hide the page
with the tuner open, and the AM4 goes back to letting go of its tuner by
itself, within about 35 seconds. Control Center or Notification Center
pulled down over the tuner, Siri listening, or the first peek of the app
switcher is not putting it away: the AM4 stays on its tuner through those.
While the tuner is open in the app, a
tuner left at the AM4 itself comes back within three seconds; Close in the
app is what closes it. An older desktop app still lets the AM4's tuner go
after about 15 seconds, and the tuner in the app works the same with
either. It makes a reviewed feature do what its words already say, so the
review notes need nothing new. What's New gets one line: "With an AM4, the
tuner on the AM4 itself now stays up until you close the tuner in the app.
Needs the newest desktop app."

**For the next version's notes: the top bar** (24 October 2026). "Can we
list the computer and device it's connected to like this instead of the
word connected? Also have that be the button that can switch what unit it's
connected to?" Since 1.87.60, by update, Play's top bar says the state, the
unit and, under them, the computer ("Live ● AM4 / on raspberry pi 3"), and
tapping it opens the demo's units, Which unit with two computers, or Phone &
computer. It is in the 1.88.0 build and the notes have one line for it; the
startup card and Colors lines were cut to make the room.

### Notes for App Review, 1.88.3 (the next version)

**Written on 24 October 2026 for the next build pair, to paste when it goes
to Apple.** It is the block for 1.88.3 (build 29), which keeps Bluetooth
the developer's; 1.89.0's, which opens it to customers, is in its own
section near the end. It starts from the 1.87.11 block below, with the five
*New since 1.86.83* paragraphs out (Apple has seen them) and one paragraph
for each *For the next version's notes* above, cut to fit: every one
together came to about 5300 bytes, and Apple's box takes 4000. The longer
words for each stay in their paragraphs above, and the Siri page in the app
says the rest, so the notes point at it rather than listing every phrase.
The 2.5.19 pair is in it whole: the Bluetooth code, and the Developer pages.
test/limits.mjs holds it under 3950 bytes with the brackets filled the way
it holds the 1.87.11 block, and to the facts below. The four things to do
every time a block is pasted (under the 1.87.11 block) apply to this one
too, and so does the AM4 tuner paragraph's wait: until Justin has seen it on
his own AM4, What's New leaves that line out.

```
This app is a remote control for Fractal Audio guitar units, through a computer the unit is plugged into by USB.

Without that hardware, use the demo. It needs no account:

1. Tap "OK" on the card that says the app is independent
2. Tap "Get started"
3. Tap "Got it"
4. Tap "Start free demo"
5. Choose any unit, then tap "Play with ..."

Every screen works in the demo, and nothing in it reaches real hardware. The in-app purchase: in the demo, tap Unlock at the top of the Play screen; Restore a purchase is under the price. For the signed-in screens, use the demo account in App Review Information. It has the full version.

New since 1.87.11:

Siri. Nine App Shortcuts, each phrase with the app's name, such as "Scene 3 in Fractal Remote". Settings, then Siri, lists them all. Try them with the demo's Play screen open: elsewhere the app says to open Play, but Tuner off works from any screen. The links fractalremote://next, /previous, /scene/1 to /scene/8 and /tuner/off do the same from a shortcut. The app receives only the command, never the audio.

Startup card. Step 1 above; it shows once.

Colors. Settings, then Colors, has six looks for the tiles.

Bigger screens. On iPad and an opened iPhone Duo, Play spreads across the wider screen.

Top bar. Play's top bar says which unit, on which computer; tap it to change unit.

AM4. The amp's pedal on Play now switches the amp's boost, saying Boost on or Boost off, on the watch too. The demo's AM4 shows it.

VP4. The app changes a VP4's presets, and its scenes once a number is set on the VP4 (Settings, VP4 scenes & presets, shown only with a real VP4).

Apple Watch. Hold a pedal on the watch to choose its channel. The watch app is now named Fractal Remote.

Screenshots. Feedback and Log (Settings, Troubleshooting) can add up to three screenshots, picked in the system photo picker or pasted. Only those are sent; the camera is never used.

Bluetooth MIDI code, switched on only for the developer. This build contains Bluetooth MIDI code for a feature that lets the phone reach the guitar unit through a Bluetooth MIDI adapter instead of a computer. While it is tested, it is switched on only for the developer's own account. Customers and the review account don't see it in this build, and the app doesn't ask them for Bluetooth permission.

Settings also has Developer pages (accounts, sales, messages) that open only for the developer's own account; the server checks which account is asking.

Deleting an account (Guideline 5.1.1(v), video 3 below): tap the gear at the top right for Settings, the account card at the top, Delete account, then "Delete my account". It deletes the account and everything stored under it at once. An account that has not bought the full version opens on the purchase page instead of Settings, and Delete account is at the foot of that page. Please try it on a new account, not the demo account.

Hardware (Guideline 2.1): a video filmed on an iPhone with a real FM3 on screen, from the first pairing through the whole workflow, is video 1 below.

Apple Watch (it comes with the iPhone app): keep the demo's Play screen open on the iPhone, open Fractal Remote on the watch, and swipe up or down between Scenes, Pedals, Presets and Tuner.

Tested on: iPhone 17 Pro Max, iOS [version]; Apple Watch [model], watchOS [version].

Services the app uses: Supabase (accounts, setlists, the phone-to-computer link), RevenueCat with Apple in-app purchase, Resend (emails), Expo (updates).

Regions: the app works the same in every country.

Videos:
1. FM3 hardware: [FM3 video link]
2. Presets: [presets video link]
3. Deleting an account: [account deletion video link]
```

### What's New in This Version, 1.88.3

App Store Connect → the 1.88.3 version → What's New in This Version.
Written for 1.88.0 and the same for 1.88.3: the iPhone that goes to Apple is
1.88.3 (build 29, 24 October 2026), which is 1.88.0 with Apple's iOS 27 fix
for the Bluetooth pairing screen, and Bluetooth is still the developer's
alone, so nothing a customer sees changed. Build 28 (1.88.0) was never sent
for review, and no 1.88.0 version page was made in App Store Connect, so the
version page is made as 1.88.3. Android stays 1.88.0 (version code 12), whose
notes are below. Plain
words, one change a line, everything since 1.87.11, the version on the App
Store before it, written on 24 October 2026 from the *For the next version's
notes* paragraphs above and the changes since. Apple takes 4000 characters,
and all of it fits. No Bluetooth line (it is still the developer's alone),
and no line for the AM4's tuner staying up until Justin has seen it on his
own AM4 (that paragraph's wait, above).

```
• Siri: say "Scene 3 in Fractal Remote", "Next song in Fractal Remote" and more, with the Play screen open. Settings → Siri lists every command, and how to use them with Shortcuts, the Action button and Back Tap.
• Play's top bar now names your unit and the computer it goes through. Tap it to switch units, or to see Phone & computer.
• On iPad and an opened iPhone Duo, Play spreads across the wider screen.
• New: Settings → Colors, with six looks for the tiles and scenes: Fractal Remote (the app's own colors, which a first launch wears), Match my unit (the colors of your Fractal unit), Footswitch lights, Color-blind safe, Sunlight and Stompbox.
• The app starts in Dark appearance; Settings, under Play screen, has Auto, Light and Dark.
• On an AM4, the amp's pedal on Play now switches the amp's boost, and says Boost on or Boost off, on the Apple Watch too. Turn the amp itself on and off in Edit.
• On a VP4, the app changes presets, and scenes once you set one number on the VP4.
• Apple Watch: hold a pedal to choose its channel. The watch app is now called Fractal Remote.
• Feedback and Log (Settings → Troubleshooting) can add up to three screenshots, picked from your photos or pasted.
• The app opens once on a card saying it is independent of Fractal Audio.
• Next and Previous now show the name of what each will load.
• The tempo box opens with the tempo selected, and has the metronome switch in it.
• Two computers on one account? Which unit shows the unit on each, and switches between them.
• A new account can be confirmed with the code in its email.
• Play says NOT CONNECTED as soon as the link drops, and a tap that can't get through is dropped instead of landing late.
• No unit on the computer you picked? Play says where your unit is, with one tap to switch.
• No computer signed in yet? The app says so, and where to get the computer app.
• The looper's Rec and Play no longer sit under its picture.
```

### Google Play release notes, 1.88.0

Play Console → Test and release → Production → the 1.88.0 release → Edit
release → Release notes (en-US). Play takes 500 characters. The build
reaches Play with none, because EAS cannot send them; if Play will not let
the release be edited while it is in review, leave it, as with 1.87.11.
Android has no Siri, so its line is the links instead.

```
• Play's top bar names your unit and the computer it goes through. Tap it to switch units.
• Feedback and Log can add up to three screenshots from your photos.
• Links for Tasker and similar apps: fractalremote://next, previous, scene/1 to 8 and tuner/off. Settings → Links for Tasker says how.
• Settings → Colors: six looks. The app starts in its own colors, and Dark.
• On an AM4, the amp's pedal switches its boost.
• Tablets and opened foldables get a wider Play screen.
```

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
that hides it, is the hidden feature 2.5.19 forbids, and a change to what
the app does that Apple's licence (3.3.1(C)) and Google's rule on features
activated remotely both keep for reviewed versions. **And while a version is in review,** nothing is merged that changes what its
notes describe (the purchase page, Bluetooth, Delete account): from its second
launch, the reviewer's copy runs whatever is on main. Apple has finished with
1.87.11, so nothing waits on Apple now. Whether Google has finished with the
1.87.11 Android build was not known on 12 October, and Google's reviewer takes
updates from main the same way, so keep the same care until Play Console shows
1.87.11 out in production.

**The Developer pages: left out of 1.87.11's notes, in the next ones.**
Justin's own account also has Settings → Developer (accounts, sales,
messages, account help with its Confirm button, What's live). No other
account is shown it, the review account included, and the server checks
which account is asking. They were already there when Apple approved
1.86.83 with nothing said about them, and nobody but Justin can reach them,
so 1.87.11's notes left them out. Since 16 October 2026 2.5.19 says an
app's functionality "should be clear to end users and App Review", so the
next notes say them in the one line Google's App access note already has:
"Settings also has Developer pages (accounts, sales, messages) that open
only for the developer's own account; the server checks which account is
asking." If Apple asks, they are the developer's own support tools.

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

That version is 1.89.0, and its Description was not taken from the draft:
it is written fresh from the app as it is on 25 October 2026 (the AM4
alone, REQUIRES A COMPUTER still first, as Justin asked, and the computer
said to be the best way), under *1.89.0: Bluetooth (beta) for customers*,
below.

### By hand in Play Console for 1.87.11

None of this needs a build. It is all typed into Play Console, and each part
ends with **Save**, then **Publishing overview → Send changes for review**.
Google usually passes it within a day (and while Managed publishing is on,
around 1.89.0 only, it then waits for **Publish changes**). Do the first two first, at the next
sitting: Google can hold back any update over them, 1.87.11 included, and
whether Google had finished reviewing 1.87.11 was not known on 12 October
2026.

**1. Data safety** (App content → Data safety → Manage). **The four below
are done:** on 24 October 2026 Google Play's public page shows User IDs,
Purchase history, Device or other IDs and App interactions. What is left is
Photos and the Email address purpose, further down. As it was, **still not
done on 11 October 2026:** Google Play's public Data safety page for the app lists
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

And, from 22 October 2026 (screenshots in reports), one more, **collected**
and **not shared**:

- **Photos and videos → Photos.** Optional (only the screenshots somebody
  adds to a bug report, up to three, sent when they press Send). For App
  functionality. Not processed ephemerally: they are kept a week in storage
  (an hour, if their report never arrived), and in the report's email.

Email address, already declared, now also answers a report from the
account's own address when nobody typed one: keep App functionality and
Account management ticked for it (tick App functionality: on 24 October
2026 Google's page showed only Account management). Nothing else changes.

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
  1. Tap "OK" on the card that says the app is independent
  2. Tap "Get started"
  3. Tap "Got it"
  4. Tap "Start free demo"
  5. Choose any unit, then tap "Play with ..."

Delete account: Settings (the gear, top right) → the account card at the top → Delete account → "Delete my account". A new account, without the full version, opens on the purchase page instead, and Delete account is at the foot of that page. Please try it on a new account, not this one.

This build contains Bluetooth MIDI code for a feature (reaching the guitar unit through a Bluetooth MIDI adapter instead of a computer) that is switched on only for the developer's own account while it is tested. No other account sees it, this one included. That code is why the app declares Nearby devices, and Location on Android 11 and older, where Android needs it to find a Bluetooth device; it never reads where the phone is. They are asked for only after Connect is tapped on the Bluetooth page, which this account cannot open. If it is offered to everyone, that will be in a later version, sent for review with a description of it.

Settings also has Developer pages (accounts, sales, messages) that open only for the developer's own account; the server checks which account is asking.
```

If the box will not take all of it, drop the last paragraph first. If it is
still too long, use this short version instead:

```
This account has the full version. No hardware? Demo, no account needed: OK on the independent-app card → Get started → Got it → Start free demo → any unit → Play with ...

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
October 2026, the live listing had two faults below, in the short
description and the trademark line; checked again on 15 October, both had
been put right on Play, and what it still lacked was the VP4 line (the last
one). Since 18 October 2026 it also lacks Fractal Audio's sentence near the
top, the new short description, and a screenshot set without the FM3
photograph, each below. Google reviews the listing along with a
build, so the next one is cheapest done in the same sitting.

- **Short description:** the one under *Google Play: short description*,
  which starts "Requires a computer" in ordinary letters and, since 18
  October 2026, ends "Not made or supported by Fractal Audio." That second
  half is new and is still to be pasted.
- **The welcome-screen screenshot.** One of the phone screenshots is the
  walkthrough's old first screen, with the FM3 product photograph and
  "CONTROL YOUR FRACTAL FROM YOUR PHONE", which is exactly what Fractal's
  letter asks not to be used (*Screenshots*, above). Delete it; the other
  three are enough. Look in the 7-inch tablet, 10-inch tablet and
  Chromebook boxes and at the feature graphic too, and take out any copy of
  that screen there.
- **Full description:** the Description at the top of this file. It says
  nothing about Bluetooth, because customers cannot open it. It once said
  Bluetooth (beta) could take the computer's place, partly so that the
  Nearby devices permission 1.87.1 declares matched something the listing
  promoted; the App access note above now says why that permission is
  declared and when it is asked for instead, and the risk that leaves is
  named under it.
- **The trademark line** in the second paragraph has to be the one in this
  file, which names the VP4 and Fractal Audio, with Fractal's sentence
  before it (18 October 2026: "independently developed", "supported by",
  "LLC"). Play had the old one, at the end, since before 15 October 2026;
  delete that paragraph at the end when pasting the new one up top. The
  live App Store page still says "FM3, FM9, Axe-Fx and AM4 are trademarks
  of their respective owner" and leaves the VP4 out; it goes right with the
  next version, which brings this Description.
- **The VP4 line** under SUPPORTED UNITS (15 October 2026). The live
  listing still says "FM3, FM9, Axe-Fx III, AM4 and VP4." and promises all
  five presets, scenes, channels, the tuner and tap tempo. Paste the whole
  Description once the computer app that changes a VP4's presets and scenes
  is out, since the VP4 line says it does.

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

## 1.89.0: Bluetooth (beta) for customers

**The store version after 1.88.3, on both phones** (written on 25 October
2026). "I have tried it from an android phone and it works great." "I'm
fine with doing new builds for Apple and android." "Make it clear that
there's multiple ways to connect the device, but also make it clear that
the computer is the preferred method and that Bluetooth will have more lag
and not have as many features." So 1.89.0 is the version whose notes,
What's New and Description say Bluetooth (beta) is in the app, for an AM4,
for everybody with the full version. It opens by the version built into
the copy (`BLUETOOTH_FROM_STORE` in mobile/src/lib/ble-rule.js, set in the
build pull request), never by an update (CLAUDE.md, *It is switched on for
customers*). Every block here but the last (Google's location question, for
2027) is pasted on the day 1.89.0 is sent (Google Play's Description later
still, on the day its rollout reaches everybody), and none of it before:
until then every copy in a customer's hand was reviewed with notes that say
customers are not shown it.

**Written on the plan that 1.88.3 goes to Apple first.** TestFlight 1.88.3
(build 29, Bluetooth still the developer's alone) is sent with its own
notes, above, and Apple reviews one version at a time, so 1.89.0 goes once
Apple has decided 1.88.3. That is why the notes below say *New since
1.88.3* and carry only what 1.88.3's do not. On Google Play, 1.89.0 follows
1.88.0 (version code 12), which is in Google's review or live, and goes
only once Google has finished with it.

**If Justin skips 1.88.3 instead** (build 29 never sent, and 1.89.0 the
next thing Apple sees), five things change:

- The notes become *New since 1.87.11*: the nine paragraphs of 1.88.3's
  block (Siri down to Screenshots), then this block's Bluetooth paragraph and
  its developer-only paragraph, with this block's opening, Hardware,
  Services and Videos lines. That comes to about 5170 bytes filled, over
  Apple's 4000, so about 1250 bytes come out: each 1.88.3 paragraph down to
  its first sentence, and the Bluetooth one down to its steps (pick AM4,
  Connect, the permission, video 4). The test that holds this block
  (test/limits.mjs) is pointed at *New since 1.87.11* with it, and still
  holds it to 3950.
- What's New is 1.88.3's list with this one's lines on top.
- The version page in App Store Connect is 1.89.0. If a 1.88.3 page was
  made, its number is changed to 1.89.0 and build 30 picked in place of 29,
  and step 5's Apple part is only that nothing is in review or waiting at
  Pending Developer Release.
- Apple's iOS 27 fix for its Bluetooth screen, the reason build 29 exists,
  reaches App Store customers with 1.89.0 instead (build 30 carries it).
- Nothing changes on Google Play: Android goes from 1.88.0 to 1.89.0
  either way.

**What a customer gets, which every text below says and no more.** Each
line is the app as it is on 25 October 2026:

- **Where:** Settings → My rig → Bluetooth (beta), and on the screen that
  waits for a computer, "No computer? Use Bluetooth (beta)". Only with the
  full version (a purchase or a grant, never "the store cannot be
  reached": `mayDriveBluetooth`), and only on a phone or tablet that can do
  Bluetooth MIDI. On Android that is a device with both MIDI and Bluetooth
  LE (FractalBleMidiModule.kt `supported()`), so a device or emulator
  without them never shows it.
- **Which unit:** the AM4 alone (`CUSTOMER_UNITS`). The FM3, FM9 and Axe-Fx
  III stay on the developer's account, with the testing tools, and the
  page tells everybody "Not for an FM3" under step 1.
- **The two ways, the computer first:** `BLUETOOTH_WAYS` in
  shared/bluetooth-gear.mjs, "There are two ways to connect. The computer
  is the best one. Bluetooth (beta) needs no computer, but it has more lag
  and fewer features." It is said on the page, the row, the waiting
  screen's button and the purchase page.
- **What it does:** presets, scenes, effects on and off, channels, tempo and
  the tuner. No editing or saving, no looper, volume button, unit metronome
  click or Footswitches page, and about 30 feet of range (the page's *What's
  different from USB*).
- **What it asks:** nothing touches Bluetooth before Connect is tapped. On
  an iPhone or iPad, Connect asks to use Bluetooth and opens Apple's own
  Bluetooth MIDI screen; on Android it asks for Nearby devices (Location on
  Android 11 and older) and looks for ten seconds.
- **What it needs:** parts sold separately, by other companies: a CME WIDI
  Uhost, a CME C2MIDI Pro and two Type-A MIDI to 3.5 mm adapters (LOOTOOLS),
  plus a USB charger or power bank. The View on Amazon buttons open plain
  amazon.com pages with no tracking, and the app earns nothing from them.

**Not one word of Android in Apple's texts** (2.3.10: "don't include names,
icons, or imagery of other mobile platforms"). The notes, What's New, the
Description and the keywords below name no other platform, and the
Description, which both stores share, names neither phone: it says where
Bluetooth was tried by the unit and the parts, not the phone.

### Notes for App Review, 1.89.0

App Store Connect → the 1.89.0 version → App Review Information → Notes, in
place of 1.88.3's. It starts from 1.88.3's block with its *New since
1.87.11* paragraphs out (Apple will have seen them), and with every line
that said the app works only through a computer made true: the opening
line, the Hardware line (video 4 is Bluetooth) and the Services line
(Bluetooth goes through no server). Three things a reviewer would trip
over are said outright: nothing is picked on the Bluetooth page at first
and Connect stays dimmed until a unit is, so the steps say to tap AM4 first;
the demo with no account has no Bluetooth (the row waits for the full
version), so it is found signed in; and with no adapter Apple's screen finds
nothing and the page says so, which is not a fault. The developer-only
paragraph is 2.5.19's ("functionality should be clear to end users and App
Review"): everything his account sees and the review account does not, the
Developer pages (Access, which grants the full version, among them), the
testing tools and the three units not yet offered to customers.

test/limits.mjs holds it to 3950 bytes with the brackets filled the way the
1.87.11 block's are (3933 measured that way, about 3870 with the real
ones), to four
videos, to the AM4 as the one unit offered (`CUSTOMER_UNITS`), and to the
labels the Bluetooth page and Settings really draw. One paragraph a line,
as before.

```
This app is a remote control for Fractal Audio guitar units, through a computer the unit is plugged into by USB, or, new in this version and marked beta, on an AM4 only, through a Bluetooth MIDI adapter plugged into the unit, with no computer.

Without that hardware, use the demo. It needs no account:

1. Tap "OK" on the card that says the app is independent
2. Tap "Get started"
3. Tap "Got it"
4. Tap "Start free demo"
5. Choose any unit, then tap "Play with ..."

Every screen but Bluetooth (beta) works in the demo, and nothing in it reaches real hardware. The in-app purchase: in the demo, tap Unlock at the top of the Play screen; Restore a purchase is under the price. For the signed-in screens, use the demo account in App Review Information. It has the full version.

New since 1.88.3:

Bluetooth (beta), part of the full version, for the AM4 only. With a Bluetooth MIDI adapter in the AM4's MIDI In and MIDI Out (tried with a CME WIDI Uhost and a CME C2MIDI Pro cable), the app controls the AM4 with no computer: presets, scenes, effects on and off, channels, tempo and the tuner, with no editing or saving. It is not in the no-account demo. Signed in with the demo account: tap the gear at the top right for Settings, then Bluetooth (beta) under My rig. On that page, tap AM4 under "1 · Pick your unit" first (Connect stays dimmed until a unit is picked), then tap Connect. Only then does the app ask for Bluetooth permission, and Apple's Bluetooth MIDI screen opens to choose the adapter. With no adapter it finds none, and the page says no adapter was connected. Video 4 below shows it working: filmed on an iPhone signed in with the demo account, from Connect to presets and scenes changing on a real AM4. It is marked beta: the AM4 is the only unit it has run on. Its View on Amazon buttons open amazon.com pages for the parts, which other companies make and sell; the app earns nothing from them.

Only on the developer's own account: Settings has Developer pages (access, sales, accounts, messages and the like), and the Bluetooth page has testing tools and offers three more units (FM3, FM9, Axe-Fx III). No other account is shown them, the demo account included; for the Developer pages, the server checks which account is asking.

Deleting an account (Guideline 5.1.1(v), video 3 below): tap the gear at the top right for Settings, the account card at the top, Delete account, then "Delete my account". It deletes the account and everything stored under it at once. An account that has not bought the full version opens on the purchase page instead of Settings, and Delete account is at the foot of that page. Please try it on a new account, not the demo account.

Hardware (Guideline 2.1): video 1 below, filmed on an iPhone with a real FM3 on screen, shows the computer way from the first pairing through the whole workflow. Video 4 shows Bluetooth with a real AM4.

Apple Watch (it comes with the iPhone app): keep the demo's Play screen open on the iPhone, open Fractal Remote on the watch, and swipe up or down between Scenes, Pedals, Presets and Tuner.

Tested on: iPhone 17 Pro Max, iOS [version]; Apple Watch [model], watchOS [version].

Services the app uses: Supabase (accounts, setlists, the phone-to-computer link), RevenueCat with Apple in-app purchase, Resend (emails), Expo (updates). Bluetooth goes from the phone straight to the adapter, through no server.

Regions: the app works the same in every country.

Videos:
1. FM3 hardware: [FM3 video link]
2. Presets: [presets video link]
3. Deleting an account: [account deletion video link]
4. Bluetooth with an AM4: [Bluetooth video link]
```

**Four things every time this block is pasted** (the 1.87.11 list, as it
stands for 1.89.0):

- **The three lines Apple's help page asks for:** the brackets in "Tested
  on", from Settings → General → About on the iPhone and the watch the
  build was tried on.
- **The demo account, on TestFlight build 30.** Signed in with the account
  in App Review Information, it opens with the full version, a Bluetooth
  (beta) row under My rig, and on that page AM4 as the only unit to pick;
  tap AM4, then check there is no Testing tools button under the beta note
  at the foot of the page (it is drawn only once a unit is picked, even on
  his own account). Settings has no Developer section. If the row is not
  there, stop: the notes would send Apple to something it cannot find. (Its
  log's head says "store copy: 1.89.0 · Bluetooth for customers: open".)
- **The four video links** replace the brackets under Videos, the fourth
  being video 4 below. Each is a Google Drive link shared as Anyone with the
  link.
- **The day's guideline pass** (CLAUDE.md, *Before anything goes to
  Apple*): the guidelines as they are that day, Apple's news posts since
  1.88.3, and every URL in the app and the listing answering, the setup
  guide the Bluetooth page opens among them.

### What's New in This Version, 1.89.0

App Store Connect → the 1.89.0 version → What's New in This Version.
Everything a customer sees that changed since 1.88.3, Bluetooth first, in
Justin's terms: two ways, the computer still the best one, Bluetooth with
more lag and fewer features. 2.3.12 wants the bigger changes listed, and
this is the biggest since launch. 873 characters of Apple's 4000, and no
other platform named. The Apple Watch line is there because the build pull
request applies docs/pending/watch-fill.patch; if it did not, that line
comes out. The AM4 tuner line still waits for Justin to see it hold on his
own AM4 (*For the next version's notes: the AM4's own tuner stays up*,
above); if he has by then, and 1.88.3 went out without it, it goes in here
in that paragraph's words.

```
• New, in beta: Bluetooth for the AM4. With a Bluetooth MIDI adapter plugged into the AM4's MIDI In and MIDI Out, the app controls it with no computer: presets, scenes, effects on and off, channels, tempo and the tuner. There are now two ways to connect, and the computer is still the best one: Bluetooth has more lag and fewer features, with no editing or saving. It is part of the full version, and the adapter parts are sold separately, by other companies. Settings → My rig → Bluetooth (beta) says what to buy and how to plug it in.
• No computer signed in yet? The app now offers Bluetooth (beta) as the other way, for an AM4.
• No signal at a gig? The app no longer stops on the sign-in screen when your sign-in has run out.
• Scene names on Play are as big as their tiles have room for.
• Apple Watch: on an AM4 or a VP4, the scenes and pedals fill the watch's page.
```

### Description, from 1.89.0 (App Store and Google Play)

The *Description* at the top of this file, with four changes and nothing
else: one sentence after REQUIRES A COMPUTER, which stays first, as Justin
asked; the demo paragraph's last sentence and HOW IT WORKS's first, which
said the computer is the only way; and a BLUETOOTH (BETA), FOR THE AM4
section after HOW IT WORKS, which opens on `BLUETOOTH_WAYS` word for word.
Fractal Audio's sentence and the trademark line stay the second paragraph,
SUPPORTED UNITS and the VP4 line are unchanged, and the parts are named in
plain words, with who makes them and that the app earns nothing from the
links. 3903 characters of both stores' 4000.

On the App Store it goes in with 1.89.0 (Apple changes it only with a
version, and anybody reading it can get 1.89.0 that day, by downloading it
or updating by hand, even while the phased release holds back the copies
that update by themselves). On Google Play it is pasted on the day the
1.89.0 rollout reaches everybody (*Submission day*, step 17), not with the
release and not before: until then most Android customers, new ones
included, are given 1.88.0, which has no Bluetooth row, and Google's own
staged-rollout page says "If your app update requires changes to the store
listing, we recommend updating your store listing after your release rolls
out to 100% of users." Once it is live, the risk named under *By hand in
Play Console for 1.87.11*, permissions the listing gives no reason for, is
closed: the listing now promotes what Nearby devices is declared for.

```
REQUIRES A COMPUTER. Your Fractal unit plugs into a Mac, Windows or Linux computer with a USB cable, and that computer runs the Fractal Remote desktop app (get it at fractal.newbold.cloud/downloads). Your phone controls the unit through it, so the computer has to stay on and connected while you play. An AM4 can also use Bluetooth (beta), with more lag: see below.

Fractal Remote is independently developed and is not affiliated with, endorsed by, or supported by Fractal Audio Systems, LLC. “Fractal Audio”, “Axe-Fx”, “FM3”, “FM9”, “AM4” and “VP4” are trademarks of Fractal Audio Systems, LLC, used here only to say which hardware this app works with.

Fractal Remote turns your phone into a remote control for your Fractal Audio rig. Switch presets and scenes, turn blocks on and off, change channels, tune up and tap tempo, without walking back to your unit. Build a setlist for tonight and step through it with two big buttons you can hit in the dark.

SUPPORTED UNITS
FM3, FM9, Axe-Fx III and AM4, and the VP4 in part.
On a VP4, the app turns effects on and off, changes presets, and changes scenes once you set one number on the VP4 itself. Changing presets and scenes is new on a VP4, and nobody on our side has tried it on one yet. Knobs, the tuner, tap tempo, channels and saving don't work on a VP4 from the app yet. The app can't show the names of a VP4's presets, except the one it is on, or whether its effects are on or off, yet. On a VP4, Previous and Next go through a setlist or your starred presets, not slot by slot.

TRY THE DEMO, FOR AS LONG AS YOU LIKE
The demo is the whole app running against a simulated unit. Nothing is cut short and nothing expires. The demo needs no hardware and no computer. Controlling your real unit needs the computer described at the top (or Bluetooth (beta), on an AM4).

WHAT IT DOES
• Switch any of your presets, by name, in slot order or from a setlist
• Scenes, with the names your unit already uses
• Turn blocks on and off, and pick channels A to D
• Open a block and change its real parameters on real knobs
• Tuner, with the note and how far off you are
• Tap tempo, with the tempo on the button
• Setlists and starred presets, kept with your account across devices
• Colors that can match your Fractal unit (Settings → Colors), so you find things by looking

HOW IT WORKS
A phone needs something between it and your Fractal unit, and the best one is the desktop app. It runs on your Mac, Windows PC or Linux computer, holds the USB cable, and your phone talks to it. Get it at fractal.newbold.cloud/downloads.

Once the two are paired, the phone works from anywhere: the same room, the far side of the stage, or a different building.

BLUETOOTH (BETA), FOR THE AM4
There are two ways to connect. The computer is the best one. Bluetooth (beta) needs no computer, but it has more lag and fewer features. For now it is for an AM4 only: with a Bluetooth MIDI adapter in the AM4's MIDI In and MIDI Out, your phone controls it directly, with presets, scenes, effects on and off, channels, tempo and the tuner, within about 30 feet. No editing or saving, and no looper. It is part of the full version, and a beta, tried on an AM4 with a CME WIDI Uhost, a CME C2MIDI Pro cable and two Type-A MIDI to 3.5 mm adapters; it may not work correctly with every adapter. Those parts are sold separately, by other companies (CME and LOOTOOLS); Fractal Remote has nothing to do with them or with Amazon, and gets nothing from the app's links to them. Not for an FM3: when we tried Bluetooth on one, the adapter's cable got very hot. What to buy and how to plug it in: Settings → My rig → Bluetooth (beta).

ONE PAYMENT, LIFETIME UNLOCK
Controlling real hardware is a single purchase. It unlocks the full app on every device you own, forever, including every future update, on all supported Fractal units (on a VP4, what SUPPORTED UNITS says). No subscription.
```

### Keywords, from 1.89.0

App Store only, with 1.89.0: the keywords above with `bluetooth,midi` on
the end, 95 of 100 characters. Never `cme` or `widi`: they are another
company's names and say nothing about this app, which is the packing
2.3.7 warns against.

```
guitar,amp,fm3,fm9,axefx,am4,vp4,preset,scene,setlist,tuner,rig,stage,pedalboard,bluetooth,midi
```

### Google Play release notes, 1.89.0

Play Console → the 1.89.0 release → Release notes (en-US). 438 of Play's 500
characters: the changes Android customers see since 1.88.0. This time they
go in before Google's review, because the release is made by hand
(*Submission day*, below) rather than by EAS, which cannot send them.

```
• New, in beta: Bluetooth for the AM4. With the full version and a Bluetooth MIDI adapter on the AM4's MIDI In and MIDI Out, control it with no computer. The computer is still the best way: Bluetooth has more lag and fewer features, with no editing or saving. Settings → My rig → Bluetooth (beta) says what to buy.
• No signal at a gig? The app no longer stops on the sign-in screen.
• Scene names are as big as their tiles have room for.
```

### Google Play App access, 1.89.0

App content → App access → the instruction with the review account → "Any
other information", in the same sitting as the release, in place of the
1.87.11 note: on 1.89.0 every sentence of that note's Bluetooth paragraph
stops being true. The same review account, with the full version. Three
things Google's reviewer would otherwise miss: the row is there only on a
device with both MIDI and Bluetooth LE, so a device or emulator without
them, which a review may well run on, shows none; Connect stays dimmed
until AM4 is picked; and with no adapter, it looks for ten seconds and says
"No adapter found", which is not a fault. And where a new account deletes
itself: it opens on the purchase page, not Settings, as Apple's notes say. The video is the same video 4 Apple gets (filmed on
an iPhone: nothing in Google's rules asks for an Android one, and Justin
takes Android by update, not by installing the APK).

```
This account has the full version.

No hardware? The app has a full demo that needs no account and no gear:
  1. Tap "OK" on the card that says the app is independent
  2. Tap "Get started"
  3. Tap "Got it"
  4. Tap "Start free demo"
  5. Choose any unit, then tap "Play with ..."

Delete account: Settings (the gear, top right) → the account card at the top → Delete account → "Delete my account". A new account, without the full version, opens on the purchase page instead, and Delete account is at the foot of that page. Please try it on a new account, not this one.

Bluetooth (beta), new in this version and part of the full version: the phone controls an AM4 with no computer, through a Bluetooth MIDI adapter plugged into the AM4's MIDI In and MIDI Out. Signed in with this account: Settings (the gear, top right) → My rig → Bluetooth (beta). The row is there only on a device that has both MIDI and Bluetooth LE, so a device or emulator without them does not show it. On the page, tap AM4 under "1 · Pick your unit" first (Connect stays dimmed until a unit is picked), then Connect. Only then does Android ask for Nearby devices (Location on Android 11 and older, where Android needs it to find a Bluetooth device); the app never reads where the phone is. With no adapter, it looks for ten seconds and says No adapter found. A video of it working on a real AM4: [Bluetooth video link]

Only on the developer's own account: Settings has Developer pages (access, sales, accounts, messages and the like), and the Bluetooth page has testing tools and offers three more units (FM3, FM9, Axe-Fx III). No other account sees them, this one included; for the Developer pages, the server checks which account is asking.
```

If the box will not take all of it, drop the last paragraph first. If it is
still too long, paste the short one instead (485 characters as written):

```
This account has the full version. Demo, no account: OK on the independent-app card → Get started → Got it → Start free demo → any unit → Play with ...

Bluetooth (beta), new: Settings → My rig → Bluetooth (beta), only on devices with MIDI and Bluetooth LE. Tap AM4, then Connect: only then is Nearby devices asked for (Location on Android 11 and older), never to read location. Video: [Bluetooth video link]. Developer pages, testing tools, three more units: developer's account only.
```

### Video 4: Bluetooth with an AM4 (Justin films it)

Apple's rule for an app that needs hardware (2.1) is a video, not a screen
recording, of the app on a real iPhone as it pairs with the hardware and
works it. The reviewer has no AM4 and no adapter, so this video is the only
way they see Bluetooth do anything. Google's reviewer gets the same link.

**When:** on TestFlight build 30 (1.89.0), once it is on your iPhone, and
before 1.89.0 is sent to Apple.

**Before you start:**

- Delete the app and install it again from TestFlight. That way the
  iPhone's "use Bluetooth" question comes up in the video, as it will for
  the reviewer.
- Then sign in with the review account (the one in App Review Information),
  not yours. The video then shows exactly what a customer gets: AM4 the only
  unit to pick, no Testing tools. It also proves the new version opens
  Bluetooth for a customer.
- Film with a second phone or a camera, in one take, with the iPhone's
  screen readable. Not a screen recording.
- Keep anything else with Fractal's name or logo out of the shot: no box,
  poster, sticker or Fractal web page. The AM4 itself is the one exception,
  and only in a private review video like this one (CLAUDE.md: the review
  videos are the one place a real unit is seen).

**What to film, in this order:**

1. **The plugs first.** Start on the AM4 and the parts: the WIDI Uhost,
   with the C2MIDI Pro's USB-C plug in its left-hand socket and the charger
   in its right-hand one, and the C2MIDI Pro's black plug in the AM4's MIDI
   IN and its white plug in MIDI OUT, through the two 3.5 mm adapters. Hold
   the shot long enough to read the jacks. If your plugs go in differently
   from the app's steps, film yours, and say so: the app's steps and the
   guide change to match what works.
2. On the iPhone: the gear for Settings, then Bluetooth (beta) under My rig.
3. Tap **AM4** under "1 · Pick your unit", then **Connect**.
4. The iPhone asks to use Bluetooth: tap **Allow**.
5. Apple's Bluetooth screen opens. Tap the Uhost, wait until it says
   Connected, then tap **Done**.
6. Back on the Bluetooth page, it says it is connected and the AM4 is
   answering.
7. Go to Play. Change a preset, then a scene, then turn an effect off and
   on, turning the camera to the AM4 each time so the change shows on the
   unit.
8. Back in Settings → Bluetooth (beta), tap **Stop using Bluetooth**.

A minute or two is plenty. Afterwards, sign out and back in with your own
account, and turn Bluetooth on again on the Bluetooth page: signing out
turns it off.

**Sharing:** upload it to Google Drive, then Share → General access →
**Anyone with the link**. Apple's reviewers are not signed in to Google, and
a link that asks them to sign in is the same as no video. **Never make it
public**: not YouTube, not the website, not the store listing, not social
media. It is a private link for the two reviewers, and nothing else.

Paste the link in place of `[Bluetooth video link]` in the Apple notes and
in Google's App access note.

### Submission day for 1.89.0, step by step

In order. The steps marked **Justin** are his (App Store Connect, Play
Console, his phones); the rest are pull requests and runs on GitHub. Only
step 7 spends builds, and it waits for his yes, as every build does.

**A. Any day before the build**

1. **Justin: App Store Connect → App Privacy**, the rows owed since 22
   October (*App Privacy*, above): add Photos or Videos and Customer Support,
   and edit Email Address's use. They are owed for 1.88.3 too, so they may
   be done by then. Bluetooth adds nothing to the label: nothing it touches
   leaves the phone.
2. **Justin: Macs and Apple Vision Pro.** App Store Connect → the app →
   Pricing and Availability. Unless it was switched off, the App Store also
   offers the iPad app on Macs with Apple silicon and on Apple Vision Pro,
   and Bluetooth (beta) would open there too. Nobody has tried the app on
   either, Bluetooth or not. Look for "iPhone and iPad Apps on Apple Silicon
   Mac" and the Apple Vision Pro setting beside it, and choose:
   - **Untick both.** Nobody new gets the app on a Mac or a Vision Pro.
     Costs no build and no review. My pick.
   - **Leave them.** The first customer on a Mac is the first test, and
     nothing in the notes or the listing says a Mac was tried.
3. **Justin: Play Console → Publishing overview → Managed publishing →
   on.** From then on nothing Google approves goes live until he presses
   Publish. It has to be on before the Android build reaches Google, and it
   also catches a run 1 started with the Send box ticked by mistake:
   Android would still reach Google's review too early, but no customer
   would get it. (If 1.88.0 is still in review when it goes on, 1.88.0
   waits for his Publish too.) **So when Google approves 1.88.0, go to
   Publishing overview and press Publish changes straight away**, and if
   1.88.0 already shows under Changes ready to publish when Managed
   publishing goes on, press it now, before step 4. Step 4 needs 1.88.0 on
   your Android phone from Play, and step 5 means 1.88.0 is live, not only
   approved.
4. **Justin's logs**, from his iPhone on 1.88.3 and his Android phone on
   1.88.0, with "store copy: 1.88.3" and "store copy: 1.88.0" at the top
   (CLAUDE.md: the threshold is set only once these are seen).
5. **Both stores have finished with the version they have:** Apple with
   1.88.3 released (Ready for Distribution: one version in review at a
   time, and an approved one left at Pending Developer Release keeps the +
   in step 13 from making 1.89.0), Google with 1.88.0 live in Production,
   not waiting under Changes ready to publish (no new Android release while
   one is in review).

**B. The build, after Justin's yes**

6. **GitHub: the build pull request**, merged right before the build:
   version 1.89.0, `BLUETOOTH_FROM_STORE` set to '1.89.0' on both phones,
   docs/pending/watch-fill.patch applied. Its phones' fingerprint says
   Unchanged, so it waits for the yes like a build and is never merged on
   green alone. CLAUDE.md's build rule already says 1.89.0 is built with
   the Send box unticked and the iPhone sent by a second run (25 October
   2026), so a session that reads only CLAUDE.md does not send Android to
   Google's review with nothing in.
7. **GitHub: mobile.yml, run 1, the build pair.** Actions → mobile → Run
   workflow, from main:
   - Which platform to build: **all**
   - Which eas.json build profile: **production**
   - Send it to TestFlight, and to Google Play production (everyone), when
     it finishes: **unticked**
   - Skip building; send the last build that succeeded: unticked
   - Publish a JS update instead of building: unticked

   One iPhone and one Android build slot, and nothing is sent anywhere:
   both builds wait on Expo's servers. **This is the one build whose Send
   box stays unticked.** Ticked, it sends Android straight to Google's
   review, before its release notes and App access note are in, and, were
   Managed publishing off, from there to every Android customer the moment
   it is approved. mobile/eas.json is not changed for
   it: Android goes by hand (step 14), which is the one way the release
   notes go in before the review.
8. **GitHub: the ledger row**, in the first pull request after the build is
   started: 1.89.0, one and one, "Bluetooth (beta) for customers", and
   `OPENED_AT` in test/ledger.mjs (docs/expo-builds.md says how).
9. **GitHub: mobile.yml, run 2, the iPhone to TestFlight**, once expo.dev
   shows the iOS 1.89.0 build finished:
   - Which platform to build: **ios**
   - Which eas.json build profile: **production**
   - Skip building; send the last build that succeeded: **ticked**

   No slot: it sends the build that already exists, and it becomes
   TestFlight build 30. Not before the build has finished: until then "the
   last build that succeeded" is 1.88.3 (build 29), already on TestFlight.
   **Never with all or android** for 1.89.0: Skip building sends Android to
   Google's review straight away too, the same as the ticked box in run 1.

**C. Justin, on TestFlight build 30**

10. Signed in with the review account: the Bluetooth (beta) row under My
    rig, AM4 the only unit on its page; tap AM4, then check there is no
    Testing tools button under the beta note at the foot of the page (it is
    drawn only once a unit is picked, so the check means nothing before);
    and the log's head says "store copy: 1.89.0 · Bluetooth for customers:
    open". Then video 4 (above).

**D. Submission day**

11. **The guideline pass** (CLAUDE.md, *Before anything goes to Apple*),
    against the guidelines as they are that day, and what it found said to
    Justin in plain words before he sends anything. On 25 October 2026 they
    say "Last Updated: October 16, 2026", the update that added 2.5.19
    (hidden or dormant features), which the developer-only paragraph of the
    notes answers. And App Store Connect → Business (and the banner at the
    top of developer.apple.com/account): if an agreement is waiting to be
    accepted, such as the licence agreement update Apple posted on 13
    October 2026, Justin accepts it first, or Add for Review and Submit in
    step 13 can be refused.
12. **GitHub: the website, merged before anything is sent**, in words that
    are true both before and after approval:
    - **bluetooth-guide.html**, the page the app's Full setup guide button
      opens, which a reviewer may well tap: Bluetooth (beta) is in the app
      from version 1.89.0, with the full version, for an AM4; if Settings
      has no Bluetooth (beta) row, update the app from the store; and the
      Settings → My rig path. It stays unlisted (noindex) until the live
      day.
    - **privacy.html**, both stores' Privacy Policy URL: from version 1.89.0
      Bluetooth (beta) is in the app for everyone with the full version, and
      earlier versions show it only on the developer's own account; an
      iPhone or iPad asks only to use Bluetooth; Nearby devices, and
      Location on Android 11 and older, as it says now.
    - **support.html**, the App Store's Support URL, which a reviewer
      checking the listing's links reads: one sentence after "The phone
      doesn't talk to the unit directly, which is why there is a computer
      in the middle.", saying "From version 1.89.0, an AM4 can also
      connect with no computer, by Bluetooth (beta); the computer is still
      the best way." The rest of its rewrite waits for the live day (step
      18).
    - **Not yet** /bluetooth (bluetooth.html), which says the app has no
      Bluetooth: until the live day that is true of every copy a customer
      can get.
13. **Justin: App Store Connect.**
    1. The + beside iOS App → 1.89.0 (or, if 1.88.3 was skipped, the page
       made for it, renamed 1.89.0).
    2. Build: **30** (1.89.0).
    3. What's New, Description and Keywords: the 1.89.0 blocks above. The
       subtitle and the promotional text stay as they are.
    4. App Review Information → Notes: the 1.89.0 block, with the Tested on
       brackets and the four video links filled in. The review account's
       email and password as before.
    5. Version Release: **Manually release this version**, so it waits at
       Pending Developer Release for step 15. And Phased Release for
       Automatic Updates: **Release update over 7-day period using phased
       release**, the iPhone's twin of Android's 20% (step 14). Once
       released, iPhones that update by themselves get it a share at a time
       (1% the first day, then 2, 5, 10, 20 and 50%, and everybody on the
       seventh); anybody can still download it new or update by hand from
       the first day, so the listing is never ahead of what a customer can
       get. While it runs it can be paused (the plan below). After a few
       quiet days, **Release to All Users** ends it early.
    6. Add for Review, then Submit.
14. **Justin: Play Console, in one sitting**, Managed publishing on since
    step 3:
    1. expo.dev → Fractal Remote → Builds → the Android 1.89.0 production
       build → **Download**. It is an .aab file: the same file EAS would
       have sent, signed the same way.
    2. Test and release → Production → **Create new release** → upload the
       .aab. The release name fills itself in (1.89.0, version code 13).
       Release notes: the 1.89.0 block above. Rollout: **20%** (see below).
       **Save**, not send.
    3. App content → App access → the review account's instruction → Any
       other information: the 1.89.0 note. **Save**.
    4. Data safety: no change for Bluetooth. Check its privacy policy link
       still answers.
    5. The store listing: **no change today.** The Full description and the
       short description stay as they are until the rollout reaches
       everybody (step 17).
    6. Publishing overview → Changes not yet sent for review: the release
       and App access, both → **Send changes for review**. If anything else
       is listed there, it would go out with them: stop and ask.

    **Rollout, a choice, and the listing follows it:**
    - **20% first, then everybody after three quiet days.** My pick. If
      something goes wrong early, four in five Android customers never got
      it, and Halt rollout stops it with no build (the plan below): the twin
      of the iPhone's phased release (step 13.5). The listing changes only
      once the rollout reaches everybody (step 17), as Google's own
      staged-rollout page advises: "If your app update requires changes to
      the store listing, we recommend updating your store listing after
      your release rolls out to 100% of users." Google picks the 20% at
      random, new installs included, so a listing that offered Bluetooth on
      the first day would sell it to people who are given 1.88.0, which has
      no Bluetooth row. For those few days the listing says less than the
      app does, which is the safe way round.
    - **Everybody at once.** The listing goes in this same sitting (step
      17's Full description moved here, and sent with the release), so app
      and listing always match. Halt rollout still works on a release that
      is fully out (Google, answer/16285429: new installs, and anyone not
      yet on 1.89.0, are given 1.88.0 instead; copies already on 1.89.0 keep
      it), but by then most customers who update by themselves have it.

    Either way, Android's live day is the day it reaches everybody.

**E. Each store's live day**

15. **Both stores approve, then both go out in the same hour.** Apple
    approves: it waits at Pending Developer Release (step 13.5); do not
    release it yet. Google approves: it waits under Changes ready to
    publish (Managed publishing, step 3). **Release only once both have
    approved**, then, in the same hour: App Store Connect → the 1.89.0
    version → **Release This Version** (the 7-day phased release starts),
    Play Console → Publishing overview → **Publish changes** (the 20%
    starts), and the iPhone's pull request in step 18 merged. Why together:
    if either store says no to Bluetooth, no customer on either phone has
    it yet, so "both wait" stays a choice that costs nothing extra (the plan
    below). What it costs: iPhone customers wait for however long Google's
    review takes, usually a few days.
16. **Justin: Play Console → Publishing overview → Managed publishing →
    off**, right after that Publish. Raising the rollout from 20% to
    everybody does not need it on (Google lets a rise to 100% through
    either way). Left on, every later Android release and listing change
    would pass Google's review and then sit under Changes ready to publish,
    reaching nobody, the next build pair included.
17. **Justin: Android's 100% day**, after three quiet days at 20% (if
    everybody at once was picked, both of these were done in step 14, and
    the 100% day is step 15's):
    1. Test and release → Production → the 1.89.0 release → raise the
       rollout to **100%**.
    2. Grow users → Store presence → Store listings → the default listing
       → Full description: the 1.89.0 Description. The short description
       stays. **Save**, then Publishing overview → **Send changes for
       review**. With Managed publishing off, it goes live as soon as
       Google passes it, usually within a day.
18. **GitHub, a pull request for each store as it goes live**, the iPhone
    the hour it is released (step 15), Android on its 100% day (step 17):
    - /bluetooth (bluetooth.html) becomes the real page, naming only the
      store or stores that are live, and links the guide.
    - support.html: "The phone doesn't talk to the unit directly" becomes
      the two ways, the computer first, with help through Justin's own
      channels and nobody else's.
    - bluetooth-guide.html: the noindex comes off (with the first of them).
    - public/store-versions.json: that store's number to 1.89.0 (ios once
      it is Ready for Distribution, android once it has rolled out to
      everybody), that day and not before.
    - CLAUDE.md's lines on which copies show Bluetooth to customers.
19. **The setup emails' Bluetooth paragraph**, only once 1.89.0 is live in
    both stores (Android at 100%): supabase/README.md, *Bluetooth (beta) in
    the emails, from 1.89.0*. Emails off, the function redeployed, Justin
    reads the sample, emails on.
20. **The promotional text:** Actions → store-text → Run workflow, **Write
    it** ticked, once 1.89.0 is released (a version in review keeps its own
    copy of the paragraph, and that copy can be empty). The paragraph
    itself does not change: it still opens on REQUIRES A COMPUTER.

### If Bluetooth has to be switched off, or Apple says no to it

Written down before the day, because two of these cost a build and the
first launch of a copy decides more than an update can. Two facts sit under
all of it:

- **A fresh install's first launch runs the copy built into it**
  (`fallbackToCacheTimeout` is 0 in mobile/app.json), and build 30's has
  the threshold set. So no update can make a 1.89.0 copy keep Bluetooth
  closed from its very first launch: only another build can.
- **Once a 1.89.0 copy reached customers, the threshold is not moved by an
  update in the ordinary way** (CLAUDE.md, and the `OPENED_AT` pin in
  test/ledger.mjs): it would take a reviewed feature away from the copies
  Apple and Google approved with it, and customers would lose it mid-gig.

**While Apple is reviewing it:**

- **Apple asks a question, or wants a better video or clearer notes.** Answer
  in App Store Connect, with a new video link if asked. No build.
- **Apple wants different words in the listing** (What's New, the
  Description, the keywords). Change them in App Store Connect. No build.
- **Apple wants different words in the app**, for instance no "(beta)" under
  2.2 (Apple accepted Edit (Beta) in 1.87.11, so this is unlikely). The
  words go out as an update, with no build, but the reviewer sees them only
  after a restart: the first launch after the update is out still runs the
  words the device already had, whether build 30 is a fresh install (then
  the words built into it: *Two facts*, above) or the copy already on their
  device, and the update comes in from a later launch. So the reply to Apple
  says how to see the change, for example: "The new words come as an app
  update. Open the app and wait about ten seconds. When 'A new version is
  ready' appears, tap Restart now, or close the app fully and open it again.
  The change shows from then on." A build only if Apple wants the change in
  the build itself.
- **Apple says no to Bluetooth itself.** First, if it reads like a
  misunderstanding (the reviewer could not find the row, or thought the
  empty Apple screen was a fault), reply with the steps and video 4, or ask
  the App Review Board. No build. If Apple still says no, no customer on
  either phone has Bluetooth yet (step 15 releases the two only once both
  have approved), so the choice is:
  - **Both phones wait for Bluetooth.** Android's 1.89.0 is taken back out
    of Play's queue, the day Apple's no is final, in this order:
    1. Publishing overview: move the 1.89.0 release and the App access
       change back to "Changes not yet sent for review", whether they are
       still in review or already under Changes ready to publish (Google's
       help, answer/9859654, says approved changes can be moved back there).
    2. Test and release → Production: discard the 1.89.0 draft release, or
       replace it with the closed Android build.
    3. App content → App access: paste the 1.87.11 note (*By hand in Play
       Console for 1.87.11*) back in. With 20% first the store listing was
       never changed; if everybody at once was picked and the 1.89.0
       Description went in, paste the Description at the top of this file
       back in too. Do this before anything else is sent for review or
       published.

    **Never leave approved changes waiting under Changes ready to
    publish:** Publish puts out everything listed there, and changes saved
    for later come back with the next send, so the next Publish for anything
    else would put Bluetooth out on Android after Apple refused it. Then one
    new iPhone build, 1.89.1 or later, goes to Apple with the threshold back
    to null and the 1.88.3 notes' disclosure paragraph. One iPhone slot, and
    an Android one unless the 1.89.0 release was discarded (replacing it
    needs the closed Android build). Setting the threshold back is allowed
    here, and only here, because no copy that opens it ever reached a
    customer; it is the three deliberate edits docs/expo-builds.md describes
    (the row's marker, `OPENED_AT`, the threshold), with the reason written
    in. On the website, only the guide, the privacy page and support.html
    said "from 1.89.0", and they go back to what they said before. My pick:
    it keeps the two phones the same, and every page true.
  - **Android goes ahead without the iPhone.** Android's 1.89.0 is
    published with Bluetooth; one iPhone build with the threshold null on
    iOS alone. One iPhone slot, and the two phones disagree: the setup
    emails, the guide and /bluetooth have to say which phone, and the
    ledger test, which refuses an opening on one phone alone, is changed
    first, on purpose, saying why.

**While Google is reviewing it:** the same, in Play Console. Words in the
listing, the release notes or App access change there, with no build; words
in the app go as an update, with the same restart line in the reply. If
Google says no to Bluetooth itself, the Android release is not published,
and Apple's approved 1.89.0 waits unreleased at Pending Developer Release
(step 15 holds it until both have approved), so the same choice is made the
other way round:

- **Both wait.** App Store Connect → the 1.89.0 version → cancel the pending
  release, so the version reads **Developer Rejected**. App Store Connect
  takes no other build or version for review while 1.89.0 sits at Pending
  Developer Release, so this comes first. Then one Android build and one
  iPhone build, the threshold back to null on both (the same three
  deliberate edits), with the 1.88.3 notes' disclosure paragraph for Apple
  and the 1.87.11 App access note for Google, and Android's 1.89.0 taken out
  of Play's queue as above. One slot each.
- **The iPhone goes ahead alone.** Apple's 1.89.0 is released with
  Bluetooth, and Android's 1.89.0 is never published. One Android build
  follows with the threshold null on Android alone: the ledger test, which
  refuses an opening on one phone alone, and `OPENED_AT`'s android value are
  changed first, on purpose, saying why, and the setup emails, the guide,
  /bluetooth and support.html say "iPhone only". One Android slot.

If the iPhone had been released before Google decided (not what step 15
says), only the second would be left: "both wait" would then be the
emergency threshold update, which this plan keeps for a unit at risk, not
for a refusal.

**After it is out, if something goes wrong** (a unit or a cable harmed, the
way the FM3's cable ran hot, or a crash on connect):

1. **Words, the same day, no build:** a warning on the Bluetooth page by
   update (words are an update), the same on the guide and /bluetooth, and
   the promotional text through store-text (Write it) if it is serious.
   Help stays Justin's own channels.
2. **Android:** Play Console → Production → **Halt rollout**. No build, at
   any share. At 20%, customers who have 1.89.0 keep it and nobody new gets
   it, and the listing, never changed, stays as it is. Google can halt a
   release that is fully out too (answer/16285429): new installs, and
   anyone not yet on 1.89.0, are given 1.88.0 instead, and copies already
   on 1.89.0 keep it; then the Description at the top of this file goes
   back into the listing the same day.
3. **Apple:** if 1.89.0 is approved but not yet released, do not release
   it. No build. While the 7-day phased release is running (step 13.5), App
   Store Connect → the 1.89.0 version → Phased Release for Automatic
   Updates → **Pause Phased Release** stops automatic updates to 1.89.0. It
   costs no build. Pauses can add up to 30 days in all, and resuming carries
   on from the day it stopped. A pause does not stop new downloads or
   people who update by hand, and once the rollout reaches everybody (or
   Release to All Users is clicked) the only halt left is taking the app
   off sale, which ends the phased release for that version for good.
4. **Bluetooth closed on the 1.89.0 copies, an emergency step only,** with
   Justin's say-so and only when a unit is at risk: an update that moves the
   threshold above 1.89.0 closes it on every 1.89.0 copy from the launch
   after it downloads. It costs no build, but it changes what a reviewed
   version does, so it is the three deliberate edits again (the tests fail
   on it otherwise, as they should), the setup emails' paragraph is
   switched off and redeployed the same hour, and a store version follows,
   a build pair whose notes and What's New say Bluetooth is off and why. A
   fresh install's first launch still opens it until that version is out.

| What happens | What it costs |
|---|---|
| Apple or Google asks a question, or wants other words in the store | Nothing: answer, or change it in the console |
| Other words in the app | An update, no build, as long as the reply tells the reviewer to restart once. A build only if Apple wants the change in the build itself |
| Apple says no to Bluetooth, and still no after a reply | One iPhone build (and Android's 1.89.0 taken back out of Play's queue) |
| Google says no to Bluetooth, and still no after a reply | One Android build (and, for both to wait, an iPhone one, once the pending release is cancelled) |
| Trouble after release: a warning | An update and the website, no build |
| Trouble after release: Android halted | Nothing: Halt rollout, at 20% or after it is out (halted before 100%, the listing keeps the old Description) |
| Trouble after release: iPhone paused | Nothing: Pause Phased Release, while it is still phasing (automatic updates only) |
| Trouble after release: Bluetooth closed for customers | An emergency update, then a build pair to say so |

### Later: Google's question about location (from 27 January 2027)

Nothing to do for 1.89.0. Today Play's location form is only for location in
the background, which the app never uses. Google's preview of its next
policy (answer/16909972, read on 25 October 2026) says that from 27 January
2027 "Apps that request device location permissions ... will be subject to
a developer console declaration process", and that precise location goes
only to apps that cannot make do with the approximate one. The app asks for
precise location on Android 11 and older alone, only when Connect is tapped
on the Bluetooth page, because Android 10 and 11 give an app no Bluetooth
LE scan results without it. On Android 7 to 9 approximate location would
do, but the one permission line in the manifest (ACCESS_FINE_LOCATION up to
Android 11) and the one request in FractalBleMidiModule.kt cover every
version below 12, so the answer says so rather than claim otherwise. When
Play Console asks, this is the answer:

```
Fractal Remote asks for precise location only on Android 11 and older, and only when the user taps Connect on its Bluetooth (beta) page, because Android 10 and 11 return no Bluetooth LE scan results to an app targeting Android 10 or newer without ACCESS_FINE_LOCATION; approximate location is not enough there. On Android 9 and older, where approximate location would be enough, the same single permission declaration applies. It uses it only to find the user's own Bluetooth MIDI adapter, and never reads, stores or sends where the device is. On Android 12 and newer it uses BLUETOOTH_SCAN with neverForLocation and asks for no location at all.
```

**Before it is sent, one question to settle:** Google may push back on
Android 7 to 9, where precise location is more than the scan needs. If an
Android build comes before January for another reason, it can ask for
approximate location below Android 10 instead (ACCESS_COARSE_LOCATION up
to Android 9, ACCESS_FINE_LOCATION only for 10 and 11, and the module's
request to match), and the Android 9 sentence comes out of the answer.
Otherwise the answer goes as it is, saying it plainly.

If Google refuses it, the way out is an Android build that drops Location
and hides Bluetooth (beta) on Android 11 and older: Android's fingerprint
alone moves, so it is one Android slot.

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
