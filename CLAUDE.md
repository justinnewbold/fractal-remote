# Working on Fractal Remote

## How to talk to Justin

**Ask him for something only when you actually need it.** This started as
"put what you need from him at the end of the reply" and turned into a
numbered block of questions on every single reply, most of them asking him
to go and test the app. He does not want that:

> "Also remove the 123 questions at the end. Only ask things that you
> absolutely need of me, not just tell me to test the app. I'm obviously
> going to test the app. I'll let you know if something's wrong."

So: most replies should ask him nothing. Never ask him to test — he tests
everything and reports back on his own. Never ask him to confirm a fix
worked; ship it and wait. Only genuinely blocked work gets a question —
something only he can decide, or something only he can see (his rig, his
account, a screen you cannot reach).

When there IS such a question, it goes at the END of the reply, on its own,
in plain words. One question, not a numbered list. If there are somehow two,
two lines will do — the numbering was never the point.

What he asked for originally was that questions be *readable*, not that they
be *collected*: "I don't want a bunch of developer jargon, it's hard for me
to read and understand, so I just need crystal clear questions when you ask
them, that's all."

**When he is firing things off, hold every question to the end.**

> "I'm gonna fire them off, so if you ask questions in between, I'm not gonna
> see them. I'll let you know when I'm completely done, and then you can put
> all questions that you have to clarify into one section at the bottom of the
> chat, cause in the past you'll just keep asking questions and I'm not
> reading those because all I'm doing is sending screenshots and telling you
> what I want fixed quickly before you even have a chance to respond."

This is the rule above under load, and it changes what to do rather than only
how much to ask. In a run like that he is not in a conversation — he is
emptying his head onto the screen, and a question asked mid-run is not
answered late, it is never read at all. So a reply that ends in a question has
spent its last line on nothing.

Which means: do the work on what is unambiguous, make the call yourself where
a sensible default exists, and keep a list of what genuinely could not be
settled. He says when he is done. THEN the list goes out, once, at the bottom,
in plain words — and it should be short, because most of what looked like a
question at the time will have been answered by the screenshot after it.

The failure this guards against is not asking too much. It is stopping: a
question mid-run reads as waiting, and he is not there to unblock anything.
Never hold work for an answer that cannot arrive until the run is over.

**"AX3" is the Axe-Fx III.**

> "Also moving forward, I'm gonna call AXe-fx III the AX3. So when I say
> AX3, know that's what I mean." (12 November 2026)

His own short word for it, in what he writes and in replies to him. The
app, the website, the store texts and the logs still say "Axe-Fx III",
which is the unit's name. He has one since that day, with an FC, as well as
the FM3 and the AM4. It is an Axe-Fx III Mark II on firmware 33.01 (Axe-Edit
III said so, 13 November 2026).

**Write it for a guitarist, not a developer.** Justin is not a programmer.
Say what a change does to the app in front of him, not what it does to the
code. Name the file only when he needs to find it. "The buttons move up next
to PLAY" beats "the control is lifted into the tab row". If a question needs
jargon to make sense, the question is not finished yet.

Give options as plain choices with the consequence attached, and say which
one you would pick.

**He takes Android through the over-the-air updates, not the APK.**

> "No, I don't install direct on Android. I just use the over-the-air
> updates that you've been doing."

So don't paste the APK link after an ordinary merge. It is only for the
case where an update can't reach the phone — a native change, a fresh
phone, a build that had to be redone — and then it goes in the reply,
never left for him to find. The shape is fixed and the version is the only
part that moves:

```
https://github.com/justinnewbold/fractal-remote/releases/download/apk-v<VERSION>/fractal-remote-v<VERSION>.apk
```

**Never start an Expo build without asking him first.**

> "I have a very limited amount of free expo builds for iOS so I need to make
> sure that everything is actually correct before we push a build. We can't
> just do it every little tiny change."

This is the one place in the project where being wrong costs him something
that does not come back. A test suite can be run a hundred times; an iOS
build slot is spent. Three went on one evening, and only the first had to.

So: say what the build is for and wait. It is not covered by "he said keep
going" earlier in a session, because the cost is per build rather than per
task.

**When there is a build, it is both phones, together.**

> "Moving forward, let's always do android build and iOS build at the same
> time if there's any changes because I have the exact same amount available
> for each in Expo each month, which is 15."

A build is needed because the fingerprint moved (or, once, to open
Bluetooth (beta) to customers, below), and the two platforms share almost
everything that moves it — an iOS-only change (the watch) still moved
Android's. A build on one platform alone strands the
other: its testers keep a store copy that the next update no longer
matches, and nobody notices until they ask why nothing has changed. That
happened after the watch build, to the Play closed testers on 1.86.8.

The one exception is a change that moves only one platform's fingerprint,
and only when he asks for that platform's build. On 24 October 2026 Apple's
iOS 27 fix for the Bluetooth pairing screen moved the iPhone's and nothing
else, and he said "do the iPhone build now": an Android build would have
been the 1.88.0 already in Google's review, and Android kept taking updates
on it. `npm run fingerprint` says which platforms moved.

**Native work that is finished but waiting for a build lives in docs/pending/**,
as patches against main, so it is on GitHub rather than only in a container.
When a build is agreed, apply them first (docs/pending/README.md says how) so
the build carries them.

**Keep count in docs/expo-builds.md.** "Keep track, that should leave us with
13 builds left for this month." Every build started gets a row there with
what it was for, and the line under each month says how many are left.

So once he says yes to a build, run mobile.yml with platform `all`
(production, submit), so iOS goes to TestFlight and Android to Google Play's
production track in the same run. The yes still has to come first.

Except 1.89.0, the build pair that opens Bluetooth (beta) to customers: run
it with platform `all`, profile `production` and the Send box UNTICKED. Once
expo.dev shows the iOS build finished, send the iPhone with a second run:
platform `ios`, Skip building ticked (the Submit only box; never `all` or
`android`, which would send Android to Google's review just the same).
Android is uploaded by hand in Play Console after Managed publishing is on
and its release notes and App access note are in. docs/app-store.md,
"Submission day for 1.89.0", steps 3, 7, 9 and 14, says it in order.
What was done instead, on 26 October 2026: run 40257649461 had the Send box
ticked, Justin's call ("I don't want managed publishing on in Android. Just
do it."), so the iPhone went to TestFlight and Android straight to Google
Play production with Managed publishing off, and the iPhone build (30) still
has to be added to the 1.89.0 version for review in App Store Connect by
Justin.

> "I don't do any close testing anymore. Android. It's all production now"

That is from 10 October 2026, and it replaces the Play closed-testing track
that Android builds used to go to. The track a build is sent to is
`submit.production.android.track` in mobile/eas.json, which has to say
`production`.

If the build job stops at expo-doctor on Expo's package versions (Expo has
published patches since the last build), run it again with keep_packages
ticked, unless lining the packages up is the point of the build: lining
them up moves expo-updates, so the fingerprint, and every store copy before
the build then takes no update until its owner installs the new one. The
1.90.0 pair (8 November 2026) was the first to need it; the stop spent no
slot, since it comes before anything is queued.

**And say so BEFORE a change that would need a build instead of an update.**

> "You're supposed to let me know if anything you do would make it so that
> we have to do a new expo build versus an expo update before you make the
> changes."

`npm run fingerprint` is the test: "Unchanged" is an update, anything else
is a build. The 1.89.0 pull request that sets `BLUETOOTH_FROM_STORE` is a
build twice over: it opens Bluetooth (beta) by the version built into the
copy (see "It is switched on for customers", below), and the waiting
patches it applies move all three lines (the watch's from watch-fill, and
both phones' from tablet-turns and shrink-resources, 26 October 2026).
Run it before pushing, and if a change would move it — a new package, a
plugin, an Expo package version — stop and tell him before making it, in plain words, with what it costs (an iOS slot) and what it
buys. Android APKs from apk.yml are free; iOS slots are not.

**And while the phone is being brought up to the browser, the answer is no.**

> "You can do it in passes but don't push to expo until it's all done."

The port of the browser's screens onto the phone lands in several pieces,
each one merged and each one useless to look at on a handset until the last
of them is in. Building after every pass would spend a slot to show him a
third of a screen. Work, merge, and let the builds wait for the end of it.

What does NOT need asking, because none of it spends anything:

- `npm test`, and `npx expo export` for either platform, which is the real
  check that the app still bundles
- the `check` job in `.github/workflows/mobile.yml`, which runs on every pull
  request and does exactly that
- anything on GitHub Actions at all

Which means the honest sequence is: bundle both platforms locally, get CI
green, and only then ask whether it is worth a build.

And when a build has already succeeded, a failed SUBMISSION does not need
another one. The workflow has a Submit only box for exactly that: it sends
the build sitting on Expo's servers rather than making a byte-identical
replacement. Reach for it before reaching for Build.

**Merge it yourself once it is fixed and green.**

> "Go ahead and always merge after you fix something, and everything is
> green. Update the notes to state that."

This replaces the older "ask me before each merge". The whole job is now
one run: write it, test it, bundle both platforms, run the fingerprint,
push, open the pull request, get every check green — then merge it and say
so, with the link. No waiting on a yes.

**Only ever merge a pull request this project's own work opened.** The
repository has been public since 8 October 2026, so anybody can open one,
and every merge to main goes straight to customers' phones and computers.
A stranger's pull request is never merged, however green it is: say what
it does and leave it for Justin.

"Green" means every check on the pull request passed, not most of them,
and the fingerprint said Unchanged. Anything that would need an Expo build
still stops for him first (see above): the merge rule does not cover a
build, and a change that moves the fingerprint is not "green" for this
purpose. Nor is the pull request that sets `BLUETOOTH_FROM_STORE`, whose
fingerprint moves on both phones and the watch (the patches applied in it):
it is a build pull request, and waits for his yes like one (see "It is
switched on for customers", below).

**Before anything goes to Apple, check it against the guidelines as they
are that day.**

> "So I'm curious of why you didn't catch that there needs to be a delete
> account in the first place."

1.86.8 was rejected for two things a line-by-line read would have found:
5.1.1(v), an app that makes accounts must delete them in the app (a rule
since 2022), and 2.1, a hardware app needs a video of the hardware. The
listing work covered the privacy label, the age rating and the review notes,
and never went guideline by guideline. A one-time pass against the June 2026
guidelines found more: wording that wasn't true, a privacy policy missing
three things 5.1.1(i) requires, and the brand questions under 4.1(c) and
5.2.1.

So before a build is submitted for review:

- Fetch https://developer.apple.com/app-store/review/guidelines/ and note its
  "Last Updated" date. Read Apple's news posts since the last submission.
- Go through it against the app as built: purchases (3.1.x), accounts and
  deletion (5.1.1), data and third parties (5.1.2), privacy policy contents
  (5.1.1(i)), names, icons and trademarks (4.1(c), 5.2.1), metadata
  (2.3.x), and completeness and hardware (2.1).
- Check that docs/app-store.md's review notes match what the build actually
  does, and that every URL in the app and the listing still answers.
- Tell him what was found in plain words before he submits, not after Apple
  does.

Build 23 was then refused under guideline 4 for something no guideline names
outright: the Apple Watch app reused the phone icon, and a black background
does not read as a circle on the watch. The watch has its own light-ground
icon now (mobile/assets/watch-icon.png); keep it light.

**No VP4 in anything that goes to Apple.**

> "Leave out all the stuff on the VP4. ... Seriously remove it. It's getting
> frustrating. I have to keep deleting it every time I submit it to Apple
> and they approve it just fine so stop." (9 November 2026)

So the review notes, What's New, the Description and every other text
drafted for App Store Connect name the VP4 nowhere: no "never on a VP4",
no "presets and scenes only", no VP4 in a list of units, the trademark
line or the units Bluetooth is offered on. The 1.90.0 texts were the
first sent without it, and docs/app-store.md keeps them as submitted
(the Apple trademark line is shared/affiliation-apple.mjs, outside the
computer app so it makes no computer release). The keywords are the one
exception: they are his own, carried from 1.89.3 with "vp4" in them, and
are left to him. Start the next version's texts from what is live
(Show the texts), and keep them short: "We really don't need that much"
(the review notes went from about 3,900 to 2,350 characters). The app
itself is unchanged: its own VP4 words (shared/vp4-safety.mjs and the
rest) stay where a VP4 owner meets them.

**The app is live on both stores** (Google Play 4 October 2026, the App Store
8 October 2026). Two things follow:

- "Ready for Distribution" is released, but the listing takes a few hours to
  appear: on 8 October 2026 apps.apple.com answered 404 for some hours after
  approval with Pricing and Availability already set, then came up on its
  own. Wait before suspecting anything. Pricing and Availability (price and
  countries) still has to be set on any new app record, or it never appears.
- Every merge to main sends an over-the-air update on the production channel,
  and that now reaches paying customers on both stores (and a reviewer
  holding a build under review). Fixes go out as before; a big new phone
  feature waits until any review in progress is over.

**1.90.0 is live in both stores** (the App Store on 9 November 2026, 17:12
UTC by Apple's own listing; Google Play on 10 November 2026, by its own
listing and Justin's "Google's 1.9 0.0 is already live"), so Edit over
Bluetooth is open to every customer on a 1.90.0 copy, iPhone, iPad and
Android, and public/store-versions.json says 1.90.0 on both. The website's
editing words went out that day (bluetooth.html and support.html; the
guide, short since 9 November, says nothing of editing). `EDIT_IN_EMAILS`
is true, and THE DEPLOYED FUNCTION CARRIES IT SINCE 11 NOVEMBER 2026:
setup-reminder version 3, put up with the Supabase deploy tool on his word
("Also, you're good to complete the email set up like you suggested"), read
back from the server and the same as main's file byte for byte. Nothing
deploys it on a merge, so a later change to its words still needs his yes
and a redeploy (supabase/README.md; Send me a sample of both emails, in
Developer → Paid but no computer yet, is how he reads what goes out). He
had said the sentence was right the same day, shown it: "Yeah, that's fine. You probably just leave out the version
numbers though." So the email's Bluetooth paragraph names no version: it
says Bluetooth "is offered on" the five units and "You can also edit over
it" on the four, and "Update the app" before them covers an older copy
(`BLUETOOTH_FROM` and `EDIT_FROM` stay in the function as what the
switches are checked against, not as words). That is about the EMAIL: the
website's pages and What's new keep "From version 1.90.0".

**1.89.3 is live in both stores** (the App Store's listing and Google
Play both show it, 30 October 2026), so Bluetooth is open to customers, and
public/store-versions.json says 1.89.3 on both. What follows about waiting
for 1.89.0 is how it got there.

**The next App Store version is the Bluetooth one.** "Wait till the
Bluetooth version" (25 October 2026, when asked whether to send 1.88.3 to
the App Store with Bluetooth still hidden). So 1.88.3 stays on TestFlight,
and the iPhones that have the App Store's 1.87.11 stay on update 1.87.60,
with nothing merged since reaching them, until 1.89.0 is approved. Its
notes and What's New are the first Apple sees since 1.87.11, so they carry
everything new since then (the 1.88.3 block's paragraphs included), and
the listing changes held for 1.88.3 (Description, Keywords, Subtitle) go
in with it. The privacy label rows do not wait: the copies on the App Store
already send what they describe (screenshots and words in a report, the
update check's install number), and Apple wants the label to say what the
live version collects, so they are published any day.

And Bluetooth (beta) is for every unit, not the AM4 alone: "I also dont
want to only turn Bluetooth on only for the AM4 I want it built out for all
users. The only unit that might be more difficult to manage figure out is
the FM3 but luckily I have one of those ... I just want to submit with notes
for users that Bluetooth is in beta and some features might not work as
expected. And make it super easy for all users to submit bugs and
feedback." (25 October 2026.) And the same day: "I don't wanna wait for the
FM3 test. Just get it built and pushed to Apple. as long as there's warnings
for user that it's in beta and they're free to test it and submit feedback,
but it might not work properly", and "I'm curious why the VP4 is not listed?
... it uses the same architecture as the AM4." So 1.89.0 opens it on all
five units the page offers, AM4, FM3, FM9, Axe-Fx III and VP4, with no FM3
test first, and under these rules:

- **Not a beta any more, since 26 October 2026:** "I also think we're ready
  to get the Bluetooth out of beta so remove anything that says beta on it
  for Bluetooth." So nothing a person reads calls it Bluetooth (beta) or
  says it is in beta: the Settings row and the page are "Bluetooth", the
  note at the foot of the page points at Report a Bluetooth problem
  (`REPORT_NOTE`), and the store texts, the guide, the support, privacy
  and /bluetooth pages and the setup email say no beta either. (Edit (Beta)
  is another feature, and keeps its word.) The ledger's "Bluetooth (beta)
  for customers" marker stays, as a record, not words on a screen.
- **What has been tried is ours, not the customer's.** "We don't need to
  mention really whether or not something has been tested or not, we just
  need to keep track of it ourselves in the developer menu so that we can
  confirm it or if someone leaves us a note saying it doesn't work then we
  can investigate" (31 October 2026). So no screen, store text, web page
  or email says tried, untried or "not tried yet". The record is
  `TESTED`, `TRIED_WAYS` and `TRIED_NOTES` in shared/bluetooth-gear.mjs,
  drawn on Developer → App health → Tried (his account only), and the
  head of every log says "VP4 (not tried yet)" (`unitForReport`). Update
  it there when a unit or adapter is confirmed. So far: the AM4 and the
  FM3 from an iPhone and an Android phone (26 October 2026), the AM4
  through the WIDI Uhost with the C2MIDI Pro, a WIDI Master and a WIDI
  Jack, the FM3 through the WIDI Uhost with a CME U2MIDI Pro; the Axe-Fx
  III from an iPhone (31 October 2026, adapter not said, "It just works
  probably with all the connectors"); the FM9 ("FM9 has already been tested
  and works", 1 November 2026, phone and adapter not said). Not the VP4.
  Still never
  a sentence that says it works on a unit it has not run on.
- **The FM3 is the only unit with a heat warning.** "The FM three is the
  only one that ever has overheating issues so we don't need to worry
  about it for any other devices" (31 October 2026). So no heat check for
  any other unit. The FM3's stays red and in front of it: the WIDI Master
  and the C2MIDI Pro got very hot on an FM3 and the WIDI Master did not
  work; use the U2MIDI Pro, which runs on USB power only, works and stays
  cool. The C2MIDI Pro and the WIDI Master are never offered for one.
- **The VP4 does only what the computer path does for it, and less:** a
  Program Change for a preset and the player's Scene Select for a scene
  (mobile/src/lib/bleVp4.js, the computer's own bytes from ForgeFX
  drivers/vp4.ts), and not one byte of SysEx: nothing it has not been
  proven on. Its one way out (`vp4BleAllowed`) is held by a test over every
  two- and three-byte message there is. It reads nothing back, so the page
  says "sending to the VP4", never "answering", and names, effects and the
  tuner say they are not available over Bluetooth. Every rule in
  shared/vp4-safety.mjs holds over it as over the computer (device.js
  takes it for a VP4).

**Bluetooth (beta) is the developer's only on every copy out today, since 11
October 2026, and opens to customers in the next store version (1.89.0).**

> "Is there any way to just get the Bluetooth on the developers mode for my
> own phone? I just feel like it's not ready to have public."

The day before, it had gone out as a public beta in the 1.87.1 builds, which
went to TestFlight and to Google Play production on 10 October, never to the
App Store. The native module stays in those builds, with the iPhone's
Bluetooth permission text (a module that asks for Bluetooth without it gets
the build refused), and an update hides it from everybody but him:

- The Settings row and the page wait for `useBluetoothAllowed()` in
  mobile/src/lib/bluetooth.js, which asks `bluetoothOpen()` in
  mobile/src/lib/ble-rule.js: his account (`isAdmin` of the sign-in kept on
  the phone, `haveSession()`, never `currentAccount()`, which asks the server
  and would take his own Bluetooth away at a gig with no signal) on every
  copy, and anybody else only on a copy whose BUILT-IN store version is at or
  above `BLUETOOTH_FROM_STORE` (see the next rule). Customers are offered
  every unit keyed in `UNITS_FROM_STORE` on such a copy: all five, each
  keyed to `BLUETOOTH_FROM_STORE` itself (see the next rule for a unit added
  later). And a customer needs the purchase itself
  (`mayDriveBluetooth` in mobile/src/lib/unlock-rule.js, on the row, the
  page, Connect, the waiting screen and bleLink): never the computer's
  "the store cannot be reached" yes, which with no signal, and a sign-in
  kept offline, would be a free rig for good. His account keeps that yes.
- App.js asks it at launch, before the link starts, and at every change of
  who is signed in. Anybody it is not open to (or on a unit they are not
  offered) found on Bluetooth goes back to the computer
  (`setBluetooth(false)`, unit and adapter kept, except a unit the account
  is not offered, which is cleared where Bluetooth is open to it: a unit
  keyed to a later store version, say, on a 1.89.0 copy), and
  `setBluetooth(true)` refuses them.
- A sign-in that ran out at a gig with no signal still answers with its
  account (mobile/src/lib/relay.js `keptSession`, since 25 October 2026, for
  every customer: before, the launch waited 25 seconds and opened on the
  sign-in screen), so his Bluetooth stays on. No session at all is still not
  a no: Bluetooth goes off for now in memory and stays on on the phone's
  storage, and the next launch that knows it is his starts on Bluetooth.
  Only another real account's id, or a sign-out somebody asked for
  (`allowBluetooth(null, { signedOut: true })` from Sign out, Delete account,
  the paywall and `toSignIn`), writes the off down.
- Nothing touches the phone's Bluetooth before Connect is tapped on the
  Bluetooth page, so nobody who is not shown that page is asked for the
  permission.
- One gap an update cannot close: the 1.87.1 builds run the copy of the app
  built into them on their first launch after an install OR a store update
  (`fallbackToCacheTimeout` is 0 in mobile/app.json, and a new store build
  drops the updates made for the old one), and that copy shows a
  BLUETOOTH (BETA) card under Settings → Phone & computer to any account
  with the full version, until its first update has downloaded, usually by
  the next launch. The 1.87.11 builds closed it (11 October, one iOS and one Android, made from
  main after 1.87.8 was merged): they carry the hidden version inside them.
  Apple approved 1.87.11 for the App Store on 12 October, and the App Store
  never had 1.87.1, so no App Store copy shows the card. It is left only in
  build 26 on TestFlight, which is never sent for review, and in the 1.87.1
  Android copies from Google Play that have not yet taken the 1.87.11 store
  update. The privacy page says the gap as it is, and Google's 1.87.11 App
  access note leaves it out, because that build does not have it.
- /bluetooth on the website said it isn't in the app until the live day.
  Since 30 October 2026 (1.89.3 live in both stores) it is the real page:
  in the app from 1.89.0, the two ways (Bluetooth first since 7 November
  2026, below), what it does, the units it is offered on, the FM3's
  warning, and a link to the guide (bluetooth-guide.html), which search
  engines may list now. support.html says the two ways, Bluetooth first.
- The store listing no longer opens on REQUIRES A COMPUTER: "It doesn't
  require a computer anymore if people are using Bluetooth instead. So we
  can drop that now." (30 October 2026.) The promotional text and the Play
  summary say the two ways now; the Description and the subtitle follow
  with the next version (docs/app-store.md). And no VP4 warnings in the
  listing: "Don't give any warnings about VP4 I removed all those." (30
  October 2026.) It still promises a VP4 nothing it does not do. And
  nothing puts text live on the App Store: "No don't put any text live on
  the App Store. I already updated it the way I want it." He sets the
  listing himself, so the store-text workflow is never run with Write it.
  Its Show the texts box (scripts/store-read.mjs, 9 November 2026) only
  reads: the newest versions' texts, the subtitle and the review notes, so
  a new version's texts start from what he left there ("Also, can you read
  what's there on your own? I changed it last time and it was fine").
  Google Play has its own job, play-text (4 November 2026, the listing-only
  robot fractal-remote-listing and its GOOGLE_PLAY_KEY): it may be run
  unticked any time, to read the listing, its pictures or Android's crash
  numbers, and is run with Write it only when Justin has asked for that
  change on Google Play. Its key never goes to the other robot,
  fractal-remote-play, which holds the purchase and upload permissions.

**It is switched on for customers only in a new store version whose review
notes say so, never by an over-the-air update.** Apple's guideline 2.5.19
(part of 2.3.1(a) until 16 October 2026) bans hidden features, 2.3.1(a)
wants every new one described in the Notes for Review, its licence (3.3.1(C))
keeps a change to what an app does for a version it has reviewed, and Google
forbids features activated remotely after review. An update is exactly that:
every merge to main reaches every copy on the current runtime, whose review
notes say customers are not shown it. Until the 1.89.0 build pull request
that was TestFlight 1.88.3 and Play 1.88.0 (the App Store's 1.87.11, like
every 1.87.x copy, is frozen on update 1.87.60). That merge moves both
phones' fingerprints (tablet-turns and shrink-resources, applied in it), so
from it on no update reaches 1.88.3 or 1.88.0 either: they keep the last
update made before it until they take 1.89.0 from the store, and the
current runtime is 1.89.0's own.

So it opens by a fact about the copy itself, which no update can change: the
version BUILT INTO it (`installedStoreVersion()` in
mobile/src/lib/storeVersion.js), at or above `BLUETOOTH_FROM_STORE` in
mobile/src/lib/ble-rule.js. Moving the fingerprint is NOT the lock: the
version number is left out of it, and the watch's own hash is not what
updates are matched on. The rule's own comment and test/bluetooth.mjs hold
the rest:

- `BLUETOOTH_FROM_STORE` stays null on both phones until the build pull
  request that moves the version to 1.89.0, the last merge before the build
  pair, which sets both phones together: a test refuses one phone alone,
  since the pair builds both and the other would be reviewed with notes
  that say Bluetooth is there on a copy that keeps it closed. apk.yml makes
  a public APK at every version, and a number set early opens on it. The
  tests ask the threshold the ledger test's own question (test/ledger.mjs),
  so that pull request goes green with no assertion rewritten.
- THAT PULL REQUEST NEEDS JUSTIN'S YES, GREEN OR NOT. Its fingerprint
  moves on both phones and the watch (the version is left out of it, but
  tablet-turns and shrink-resources, applied in it, move both phones), so
  it is a build by the fingerprint too; and even if it were not, the merge
  puts out apk-v1.89.0, a public APK that opens Bluetooth, and website pages
  that say so, before Apple or Google has reviewed it. So: say what the build is for,
  wait for the yes, apply docs/pending's patches in that same pull request,
  and merge it only right before starting the build pair.
- It is set only after Justin's logs from iPhone 1.88.3 and Android 1.88.0
  show "store copy: 1.88.3" and "store copy: 1.88.0" in their head
  (lib/logHead.js), proving the built-in number is read, not the update's.
- The build's row in docs/expo-builds.md says "Bluetooth (beta) for
  customers", written in the first pull request after the build is started.
  From then on the threshold is never moved or set back to null by an
  update, which would take Bluetooth away from the copies reviewed with it;
  a test fails if it is. The pull request that writes the row also sets
  `OPENED_AT` in test/ledger.mjs to that build (its version, and the
  threshold on each phone), and cannot go green without it: then the row,
  the threshold and the pin hold each other, and taking Bluetooth back out
  takes three deliberate edits, never one slip. Only if no build was ever
  started from the threshold is it set back.
- Every unit opens to customers keyed the way Bluetooth is, by a store
  version for that unit against the copy's built-in one (`UNITS_FROM_STORE`
  in ble-rule.js; `CUSTOMER_UNITS` is its keys). The five open together in
  1.89.0, so all five are keyed to `BLUETOOTH_FROM_STORE`. A unit added to
  the page later is keyed to a later store version of its own, never to
  that threshold, which would reach every 1.89.0 copy by update, reviewed
  without it; the tests fail on a unit the page offers that is not keyed,
  and once the opening row is written `OPENED_AT.units` in test/ledger.mjs
  pins the five (`unitProblems`): none closed by update, and no other
  opened on 1.89.0. Closing one unit in an emergency is the deliberate
  edits docs/app-store.md describes, never one slip.
- The review notes, What's New, the descriptions, the setup guide the app
  opens (bluetooth-guide.html), the privacy page, support.html and /bluetooth
  all say so, and the build is asked for like any other. The setup emails'
  Bluetooth paragraph (supabase/functions/setup-reminder) is switched on, and
  the function redeployed, only on the day 1.89.0 is live (supabase/README.md
  says how, with Justin reading the sample first).

**How it is presented: Bluetooth first, and short.**

> "Make sure that it's simple, quick and easy for people to sign up, and
> it's crystal clear how to get started quickly using Bluetooth or a
> computer. I think most people are gonna opt for Bluetooth, probably 90%.
> So we need to make that the most prominent thing, we also need to
> eliminate so much of the text that it tells people, while we want to give
> them full information they need if they can't connect or they're having
> trouble, we don't need to put it all upfront that kind of stuff can come
> into troubleshooting guides. So we need to go through the whole app and
> make sure it's Bluetooth first as far as connection options go. It says no
> Bluetooth connects through a computer instead." (7 November 2026)

This replaces his 25 October rule ("make it clear that the computer is the
preferred method and that Bluetooth will have more lag and not have as many
features"), which made every wording say "The computer is the best one" and
put the computer first on every screen. Now Bluetooth is named first
wherever the two ways are set side by side, with no ranking either way.

The FULL wordings (`BLUETOOTH_WAYS`, `BLUETOOTH_PAYWALL`,
`NO_COMPUTER_BLUETOOTH`, the setup email's openings, /bluetooth and
support.html) say three things: Bluetooth first; that it needs no computer;
and what a computer adds, "A computer has less lag and more features".
That clause is our wording of his 25 October point, not his words, which
were "Bluetooth will have more lag and not have as many features". The
features half is true on every unit, the VP4 too: through a computer a VP4 also gets its
effects turned on and off, the name of the preset it is on, and a check
that a preset or scene landed, which Bluetooth cannot give it
(`VP4_OVER_BLUETOOTH`). Never the tuner, which a VP4 does not get from the
app either way (`VP4_NO_TUNER`). Never "plus editing and saving", which it
said for a day: through the computer a VP4 is not edited or saved either
(`VP4_SO_FAR`), and the purchase page names the VP4. So the clause does
not depend on `EDIT_FROM_STORE`, and no test ties it to that switch.

The SHORT lines leave the computer's clause out on purpose: the
walkthrough's (`WALKTHROUGH_TWO_WAYS`, the box before Unlock among them),
the sign-in screen's Get connected, How do you connect to your unit?
(`HOW_CONNECT`) and the website's `BLUETOOTH_IN_APPS` say the two ways,
Bluetooth first, and nothing more ("eliminate so much of the text"); a
test fails if one grows the clause back. Everything else (what to buy, the
FM3's warning, what Bluetooth can't do) goes where the adapter is chosen or
one tap away, not up front. The browser has no Bluetooth: it says in one
line that Bluetooth is in the iPhone, iPad and Android apps and that a web
browser connects through a computer only (`BLUETOOTH_IN_APPS` in
shared/stores.mjs, src/components/BluetoothInApps.jsx), on every screen of
its connect page and wherever it explains connecting, never in the
computer app's own window. Its walkthrough's How it works opens on the
phone's two ways, Bluetooth first and picked ("The initial walkthrough on
the website is the one that's not showing the Bluetooth stuff at first",
8 November 2026): the Bluetooth way's second box is the free app on a phone
or tablet, never the browser, and under it, "It's still confusing, even for
me, so let's add that Bluetooth will work if they download the app" (the
same day), "Bluetooth works in the app, not in a web browser. Download it
free:" over a button for each open store, the visitor's phone first
(`BROWSER_HOW_BLUETOOTH` in shared/stores.mjs, its labels the phone's
HOW_TWO_WAYS word for word). The one line says the same, plainer since that
day: "For Bluetooth, with no computer, download the free app for iPhone,
iPad or Android."

It is said in several wordings, each in one place:

- `BLUETOOTH_WAYS` in shared/bluetooth-gear.mjs, the full sentence: the
  foot of the Bluetooth page and What Bluetooth can't do, /bluetooth and
  support.html.
- `BLUETOOTH_PAYWALL` (same file): the purchase page's one line, with the
  parts one tap under it (`BLUETOOTH_PARTS`, every part by name and the
  FM3's two never). `VP4_SO_FAR` is one tap away there too, word for word.
- `BLUETOOTH_WAYS_SHORT` (same file), "No computer needed": under Connect
  over Bluetooth, the first thing on the waiting screen from its first
  second (also with a computer on another account on the wifi), on Phone &
  computer, the Which unit sheet and How do you connect to your unit?
- `BLUETOOTH_ROW_OFF` (same file): the Settings row, first in My rig, which
  has one line, so it says what it is for.
- `HOW_CONNECT` (same file): "How do you connect to your unit?", once per
  device and never again, in Play's place after an account is made, a trial
  started or the full version bought there (lib/howConnect.js: settled for
  good by either answer, by the walkthrough's choice of way after a found
  purchase, by a real link answering, the computer with or without a unit
  or an adapter, never the demo's, or by 'done' on disk; a device with a
  record of connecting from before the card existed counts as connected),
  drawn only while Play is the screen and never over a rig that is
  connected or reconnecting (`howConnectShown`). Bluetooth adapter first
  and biggest, then his "No Bluetooth adapter? Connect through a computer
  instead", which lands on Finding your computer…. The sharing card waits
  for a launch after a unit has connected.
- `WALKTHROUGH_TWO_WAYS` and `HOW_TWO_WAYS` (same file): the walkthrough
  (How it works opens on Bluetooth), the box before Unlock, and the sign-in
  screen's Get connected, which is one line where Bluetooth is open; there
  the computer's three steps are in Troubleshooting → It will not connect
  at all, and Connect a computer has its setup (the desktop app, the same
  account on both, the link by email).
- `NO_COMPUTER_BLUETOOTH` in shared/no-computer.mjs: over the no-computer
  words on Phone & computer, and first on the Fixes page. Not on the
  waiting screen, which has its own button for it.
- the first email's opening in supabase/functions/setup-reminder/index.ts:
  the setup email, which since 1 November 2026 says both ways under their
  own headings ("Having trouble getting connected? Here's how to set up the
  computer or connect with Bluetooth"), Bluetooth first since 7 November
  2026 in the repository (the deployed function changes only when it is
  redeployed, with Justin reading the sample first, supabase/README.md),
  and goes only to a buyer who has connected neither
  (20261101_bluetooth_seen.sql, told once by the phone, lib/bluetoothSeen.js).

A change to the wording changes all of them; a test holds the full wordings
(`BLUETOOTH_WAYS`, `BLUETOOTH_PAYWALL`, `NO_COMPUTER_BLUETOOTH`, the email's
opening) to the same three things (Bluetooth named first, no computer
needed, "less lag and more features"), no ranking and no editing or saving
promised, and the short lines to Bluetooth first, no ranking, thirty words
at most and no computer clause.
Each is shown only where this copy offers Bluetooth, except the purchase
page, the walkthrough and the sign-in screen, which show theirs only on a
copy that opens Bluetooth to customers (`openForCustomersHere()`), since
somebody who has not paid is not past the row's gate. Store records
(docs/app-store.md's past version blocks, store/google-play/*) keep the
words they were submitted with: a test pins the 1.89.0 Description to its
own literal, never to the live sentence.

**The Bluetooth symbol is allowed.**

> "Well, we're connecting official Bluetooth devices to our app, so I think
> it would be fine. So please make a note that we are allowed to use the
> Bluetooth icon, or I guess me telling you to use it." (6 November 2026)

So the Bluetooth symbol (the Runic B, mobile/assets/icons/bluetooth.png) is
back, after it was taken out on 25 October 2026 because the Bluetooth group's
brand guide gives its marks to members only. It is on the top bar's lamp over
Bluetooth, the Bluetooth adapter's card, Connect over Bluetooth on Phone &
computer, and the Bluetooth page's Connect, and never on a unit on a USB
cable, which is not Bluetooth (test/independent.mjs holds both). Justin made
this call knowing the brand guide; do not raise it again. If the Bluetooth
group or Apple ever asks, it comes out by update: the plain aerial
(icons/wireless.png) is kept for that. This is about Bluetooth's mark only;
the rules about Fractal's logos, and Apple's, Microsoft's and Linux's, are
unchanged.

**Edit over Bluetooth and USB: the AM4, FM3, FM9 and Axe-Fx III, his
account on every copy, and every customer from store version 1.90.0.**

> "I have an FM3 and AM4 I can test on. But I wanna make it an easy switch
> if it works to be able to get it out to everyone"

> "Push the edit over Bluetooth and USB to FM9 and AxeFX 3 as the over the
> air update asap." (8 November 2026)

> "I'm fine with turning them on for those devices that we haven't actually
> turned on Bluetooth yet. It says it's in beta, so if there's problems,
> they can notify us." (8 November 2026)

So the 1.90.0 build pull request sets all four entries of `EDIT_FROM_STORE`
to 1.90.0 on both phones, with no hardware check first on the FM9 and the
Axe-Fx III, and its texts (docs/app-store.md, *1.90.0: Editing over
Bluetooth for customers*) say Edit opens over Bluetooth on those four, the
cable said once as doing what Bluetooth does, Edit included. Copies built
before 1.90.0 (the App Store's 1.89.3, Google Play's 1.89.36) take that
update and stay closed. Never the VP4. The ledger's row and
`EDIT_OPENED_AT` come in the first pull request after the build is
started, and from then on no entry is moved or set back by an update. The
website's editing words (bluetooth.html and support.html) and the setup
email's editing sentence (`EDIT_IN_EMAILS`) waited for the live day in
both stores, since a merge publishes them before review, and went in on 10
November 2026 with the pull request that brought Google Play to 1.90.0
(test/limits.mjs refused them before, and holds them now). The What's new line is the one
exception, by the house rule: it goes in with the build pull request and
reaches every copy and whats-new.html on that merge, so it says "From
version 1.90.0 of the app" and never tells a player to update from the
store, which has no 1.90.0 to give until the live day (the same test).

Since 29 October 2026 Edit opens over Bluetooth on an AM4 and an FM3 for
his account (by update, on every copy), and since 8 November 2026 on an
FM9 and an Axe-Fx III the same way: knobs, models and on/off, read and
written by the phone the way the computer app does it
(mobile/src/lib/am4-edit.js for the AM4; mobile/src/lib/gen3-edit.js for
the three gen-3 units, bound to each unit's own catalog by fm3-edit.js,
fm9-edit.js and axefx3-edit.js; the bytes and the decoding checked against
the pinned codec, and the gen-3 units' against ForgeFX's own gen-3 driver,
run on the same answers). A unit on a USB cable into the phone (its own
USB port, or a USB MIDI cable on its MIDI jacks, such as the U2MIDI Pro on
an FM3) is the same wire as an adapter (`isCable`), so Edit opens there on
the same rule on all four, and its note says the USB cable instead of
Bluetooth (lib/cableWords `CABLE_EDIT_NOTE`); on
Android that needs the 1.89.36 build or later, the first with USB MIDI.
No saving, moving blocks, modifiers or names over Bluetooth or a cable
yet, and Edit says so; no cab picking on a gen-3 unit (that needs the
computer's cab state). Edit on an FM9 or an Axe-Fx III has not run on a
unit yet, so the first one edited through the phone is the first check
that ForgeFX's tables for them (an amp's Gain is setting 7 on an FM3, 11 on
an FM9 and 1 on a III) are what the unit takes; the phone sends exactly
what the computer sends for the same edit, and a test holds it there.

- **The NAM block has its knobs in Edit for EVERY account since 1.90.51,
  written by hand from what his AX3 said. He turned them on his unit
  ("Knobs all work over Bluetooth correctly") and, asked whether to open
  them or keep them on his account, said "Open them to everyone"** (13 November 2026). Over Bluetooth, or the unit's USB cable
  into the phone, Play draws and switches NAM 1 and NAM 2 (206 and 207, off
  a customer's log) for everybody. The codec's catalog has no NAM
  (axefx3-knobs.js is generated and never hand-edited), so its settings are
  in a file of their own, mobile/src/lib/axefx3-own-knobs.js, laid beside
  the catalog in axefx3-edit.js as a second Edit of the III's (`withNam`).
  - *Two switches in mobile/src/lib/features.js, and one level.*
    `NAM_KNOBS_FOR_EVERYONE` is true; `OWN_KNOBS_FOR_EVERYONE`, for the
    other five blocks in the list (below), is false. lib/bluetooth turns
    them into one answer (`ownKnobsLevel`), asked by the wire at each
    request and each send: `true`, the whole list, for his account
    (axefx3-edit `withNam`, named from when NAM was alone in it); `'nam'`,
    the NAM block alone, for everybody (`namOnly`); false, the codec's
    catalog as it was. Where a block is not in the account's Edit it is
    marked `knobs: false`, Edit says "This block's knobs aren't in the app
    yet", and a read or write of Edit's at its id is refused at the way
    out (bleWire gen3Sender, `ownEditOf`). Edit's own door
    (`EDIT_FROM_STORE`) still decides whether a copy edits at all.
  - *What is in it: only what is certain.* Eight knobs: Input Gain
    (setting 5), Bass, Mid and Treble (10, 11, 12), Bright (14) and Bright
    Cap (15, in pF, along a logarithmic travel), and the block's Level (1)
    and Balance (2) entered as every block's are, so Edit treats them as it
    treats any (the Level a box to type in, never below the floor; Balance
    no knob on the phone). And six switches, numbered as the UNIT numbers
    them (Axe-Edit sorts its menus by the alphabet): Bypass Mode (3: 0
    THRU, 1 MUTE), Phase Invert (6: 0 NORMAL, 1 INVERT), Scene Ignore (7:
    0 OFF, 1 ON, in the list since 1.90.51), Tone Stack
    Location (8: 0 PRE, 1 POST, 2 OFF), Tone Stack Type (9, twelve names)
    and Input Mode (13: 0 LEFT, 1 RIGHT, 2 SUM L+R). Every number was read
    off his unit but two, PRE and RIGHT, which are the one choice left in a
    list of three; the file's own comment says which is which. A test holds
    the rows to two reads of channel A, before and after he set four of
    the switches in Axe-Edit, coming out as Axe-Edit showed them.
  - *The switches are drawn since 1.90.52, for his account* (a block's
    params read carries them in `enums`): see "A block's list settings in
    Edit", below. Before that the six were read, guarded and could be
    written through the wire, and had nothing on screen.
  - *What is left out, so no frame can be built for it:* Type, the capture
    (0: 257 slots named by whatever is loaded on that unit, numbered from 0
    where Axe-Edit counts from 001, so the block has no model picker and
    no model write, `typeId: null`); the block's own bypass (4), which
    Play's on and off does; and values 16 and 17 of each channel, which
    follow the capture and are never written. Edit says the
    capture is chosen on the unit (lib/gen3Catalog `NAM_ON_THE_UNIT`).
  - *The same list and the same switch carry the III's other own blocks
    since 1.90.49* ("Want to get it all done", 13 November 2026): the IR
    Player, the Vocoder, the Crossover, Tone Match and Dynamic Distortion,
    his account only. A knob is in the list when Axe-Edit names it, the
    unit gave its range, and the number in the block's whole read comes
    out as what the unit showed (a test holds every row to its read). A
    number part-way along the travel also proves how the travel runs;
    where it sat at an end the row says "end only" (a cut frequency takes
    its type code's travel, which other settings proved logarithmic; a
    percentage is a straight line). A switch is in only when the unit
    listed its choices itself. LEFT OUT: what read the same as its
    neighbours (the Crossover's four levels and four pans, the IR Player's
    two IR levels and pans, the Vocoder's 48 band knobs), anything with no
    name on Axe-Edit's page, every bank, number and length of an impulse
    response, and Tone Match's start, match and export controls. Dynamic
    Distortion's Type is a switch, not a model. One way only for all of
    them, and none has been turned on a unit. An FM9 has no hand-written
    list: there these blocks keep their on and off and no knobs.
  - *THE CODEC HAS A MINED TABLE FOR FIVE OF THE SIX, AND IT PUT TWO
    NAMES RIGHT* (found 13 November 2026). forgefx-midi's AXE3_PARAMS
    carries VOCODER, CROSSOVER, TONEMATCH, IRPLAYER and DYNDIST, from the
    editor's own definitions, with the same record counts as his unit's
    reads; nothing reached them because the codec has no effect id for
    those blocks. The Vocoder's Frequency Shift is setting 5 (0.5 to 2)
    and its Filter Resonance setting 9 (0.2 to 5): the hand-written list
    had the two names the other way round, since both read 1.000, and is
    corrected in 1.90.51. The mined table also names what a read could not
    settle (the Crossover's levels are 2 Low Left, 3 Hi Left, 4 Low Right,
    5 Hi Right, its pans 6 to 9 the same order; Tone Match 4 is Match, 13
    Reference Solo; the Vocoder's 17 is its global mix), but its ranges
    are not all what the unit shows (Dynamic Distortion's Drive is 1 to
    1000 there and 0 to 10 on the unit's screen), so the hand-written rows
    stay what both ends serve. Check a name against it before guessing.
  - *THROUGH THE COMPUTER THE SAME LIST IS SERVED BY THE COMPUTER APP,
    from the release that carries ForgeFX 0488f11* (1.90.51: "let's get
    the computer out built ... right now I have no knobs showing when I'm
    connected over raspberry pie"). ForgeFX's server/src/ownBlocks.ts is
    this list, for an Axe-Fx III only (its ids mapped to their families in
    the III's profile, the rows served in the mined table's place, no
    editor layout, no walk laid over them). THE TWO ARE CHANGED TOGETHER:
    a row added or renamed in mobile/src/lib/axefx3-own-knobs.js goes into
    ownBlocks.ts, a new pin and a computer release. The chain read still
    passes these blocks on with no slug, so the phone still names them
    (lib/ownBlocks, below) and marks one whose knobs the computer answers
    `turns: true` in place of `knobs: false` (`turnsThroughComputer`: a
    III only, by the same level as over Bluetooth). Edit's own list and
    the hold pop-up take a `turns` block (lib/device `editBlocks`,
    `knobBlocks`); it is still `unknown` to the chain editor and never
    offered to Modifiers. On an older computer app its read answers no
    knobs and Edit says "Update the computer app to turn this block's
    knobs." (`OWN_KNOBS_NEED_COMPUTER`), so COMPUTER_NEEDED did not move.
    NOTHING HAS BEEN TURNED THROUGH THE COMPUTER ON THESE BLOCKS YET: his
    Raspberry Pi is the first check. The browser and the computer's own
    window name them on Play since 1.90.56, his account only (below); their
    Edit still says New block.
  - *THE NAM BLOCK'S KNOBS HAVE BEEN TURNED ON A REAL UNIT, AND THEY
    WORK.* "Knobs all work over Bluetooth correctly" (Justin, 13 November
    2026, his AX3 from his iPhone, app 1.90.48). That is the first write
    of Edit's to go to a NAM block, and the first knob of Edit's turned on
    any Axe-Fx III: the knob write every gen-3 knob gets (fn 0x01, 52 00
    for its place) is taken there. A NAM's knob is still never sent the
    typed way the app falls back to elsewhere (gen3-edit `typedKnobs:
    false`, "ONE WAY ONLY"): it did not need it. NOT TURNED YET: the NAM
    block's six switches (Edit draws none, so there is nothing to tap),
    and every knob of the other five blocks in the list, which is why
    they have a switch of their own (`OWN_KNOBS_FOR_EVERYONE`, false) and
    did not open with the NAM block's.
- **A block's list settings in Edit, under its knobs: built 13 November
  2026, HIS ACCOUNT ONLY** ("Yes, I like B for the edit screen" and "Menu
  style B", of three ways shown on a NAM block; the picture is in the
  session's scratchpad, not the repository). Edit drew knobs and nothing
  else; every setting that is one of a list (Bypass Mode, Tone Stack Type,
  Input Mode) came with each block's read, in `enums`, and had nowhere to
  go. Now, under the knobs and the Level of the page showing, a SETTINGS
  heading and one entry a setting (mobile/src/lib/editSettings.js,
  components/BlockSettings.js): two or three choices are buttons, one tap
  (`SHORT_MOST`); more is one button with its name over the choice it is
  on, which opens a list (with a find box from thirteen choices).
  - *The switch* is `EDIT_SETTINGS_FOR_EVERYONE` in features.js, false:
    his account only (lib/useEditSettings). It opens when he says so, with
    its What's new line then. NO SWITCH OF ANY BLOCK HAS BEEN TAPPED FROM
    THE APP ON A UNIT: his first tap is the first check.
  - *Every unit and connection Edit opens on*, since the settings come
    with the block's own read and go out by the write Edit already had for
    one (lib/device `setEnum`: through the computer its route, over
    Bluetooth the wire's typed write, held to the unit's catalog as ever).
    After a choice the block is read again (a choice can change what other
    settings read, and which pages there are), and what the read says is
    what the buttons show.
  - *Which page a setting is on* is the one Fractal's editor has it on,
    as the knobs are (`settingsByPage`, which reads lib/editPages and does
    not change it: that file is the browser's too). Mixer-row settings go
    with the Mix page; what the editor places nowhere, or on a page with
    no knobs of ours, goes on the last page (Extras); with no pages from
    the unit, the last page (a NAM block's only one).
  - *Words are the unit's own* ("THRU", "SUM L+R"): nothing is renamed.
  - *Left out:* a list with one choice, one the unit gave only numbers
    for, the block's own bypass, EVERY SETTING OF A CAB (its lists are
    impulse responses and mics, the cab picker's), and the hold pop-up,
    which stays knobs over channels. The browser draws none: that is a
    computer release nobody has asked for.
- **The block reader is how a block is asked what is in it** (12 November
  2026: "Yes build the NAM reader now"). No catalog named what is inside
  the NAM block, and through the computer it is still a New block. So
  Developer → Testing → Block reader (mobile/src/components/BlockReader,
  lib/gen3-describe, bleWire `gen3Describe`), his account only, over
  Bluetooth or the unit's USB cable into the phone, on an FM3, FM9 or
  Axe-Fx III: a block the unit has just listed is read whole and then asked
  to describe each of its settings (function 0x01 with a view: its range,
  its value as the unit writes it, the names in its lists), and what comes
  back is text he copies and pastes here.
  - *It only asks.* One way out (`describeAllowed`), and the wire answers
    it for nobody else and only for a request that says it is the reader's.
  - *It asks less than the computer's own walk* (forgefx-midi liveWalk,
    which this is a port of for one block): settings 0 to 127, a label only
    of a setting that is plainly a list, 48 labels at most, a pause before
    every question, and it stops at the second in a row with no answer. A
    label asked of a setting with no list froze an FM3 once (FORGEFX-32 in
    the codec's notes; switching it off and on cured it). Never loosen
    these to get more out of a unit.
  - *The unit does not say a setting's NAME.* Those are matched by hand
    from what he reads off the AX3's own screen or Axe-Edit III (never a
    picture of theirs committed). That is how NAM got its list (above);
    opening it to customers is a store version if it is new for them.
  - *It ran on his AX3 on 13 November 2026, and docs/ax3-readings.md is
    what it read.* It agreed with the app's own table on the block it was
    checked against (Input 1). NAM 1 and NAM 2 are the same: 16 settings,
    18 values a channel. The names came from Axe-Edit III's NAM page the
    same day, and a second read after he set four switches there gave
    their numbering; both are in that file, with a third read that named
    setting 7 (Scene Ignore). STILL NOT KNOWN: what values 16 and 17 mean
    (they follow the capture).
  - *Block 201, in every III preset, is the preset's Performance page*
    (ten controls: a label, the block it points at, the setting it turns),
    so it is in `NOT_BLOCKS` and no longer in the log's line of unnamed
    blocks. Its ten settings named the app's Axe-Fx III table right, ten
    for ten: the first check of ForgeFX's III tables against a unit, and
    Axe-Edit III's Perform page showed the same ten the same day. Edit
    itself was first turned on one that day too, on the NAM block (above). Reading that page into the
    app (his ten controls, his labels, per preset) was offered and not
    asked for.
  - *The blocks the app had no name for* ("double check we have all those
    blocks already set up", 13 November 2026). He put one of each in a
    preset, read them, and sent Axe-Edit III's page for each; the numbers
    and names are in docs/ax3-readings.md. Since 1.90.47 Play over
    Bluetooth draws and switches the Vocoder (134), Crossover 1 and 2
    (142, 143) and Tone Match (170) on an FM9 and an Axe-Fx III, and the
    III's Dynamic Distortion 1 and 2 (202, 203), for everybody
    (lib/gen3Catalog `OWN`). The III's were read off his unit (143 and 203
    are the next id of each pair, not read); the FM9's stand on Fractal's
    enum and Blocks Guide, not on a unit. The RTA (174) has no on and off,
    so it is in `NOT_BLOCKS` and never drawn. On the III they have knobs
    for his account since 1.90.49 (above); for everybody else, and on an
    FM9, Edit gives each its on and off. The switches Edit draws for no
    block and the NAM capture picker are the work left, in that order.
    Which of the Crossover's four levels and four pans is which was
    settled by the codec's mined table (above), not by a read.
  - *Through the computer the phone names them itself, HIS ACCOUNT ONLY*
    (1.90.48). "NAM shows up on Bluetooth but not when connected through
    my raspberry pie" and "I would rather use the pi if that's possible"
    (13 November 2026). The engine passes each of these on with its place,
    its on and off, its channel and its effect id, and no slug, and its
    on/off and channel routes take whatever id they are handed (ForgeFX at
    the pin: placedBlocks, setBypass). So no engine change and no computer
    release: lib/ownBlocks names a block the computer sent with no slug
    from the list the phone uses over Bluetooth (by the unit's name, an
    FM9 or a III only), lib/device takes it as a namer (`setChainNamer`,
    set once in lib/ownBlocksHere), and Play draws and switches it. IT
    STAYS `unknown: true`, so everything that moves or edits the chain
    still treats it as a New block (its cell held, never replaced, not
    opened in Edit): only `stageBlocks` lets it through, on `onPlay`. A
    hold on it opens its channels (`knobs: false`). The switch is
    `OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE` in features.js, false;
    nobody has switched one through a computer yet, and his Raspberry Pi
    is the first check. Edit through the computer for these blocks came in
    1.90.51 (above): the engine serves their knobs, and the phone still
    names them.
  - *The browser and the computer's own window name them on Play too, HIS
    ACCOUNT ONLY* (1.90.56). "Nam blocks are showing in the APP but not
    computer" (13 November 2026, a picture of the computer app's window on
    his Raspberry Pi: an Axe-Fx III on a preset called NAM, no NAM tile).
    That end drew only blocks with a slug. shared/own-blocks.mjs is the
    phone's list for this end (the same ids, names and borrowed pictures,
    held equal to the phone's by test/own-blocks.mjs), and ONLY PLAY ASKS
    IT (src/components/Gig.jsx names a copy of the chain it draws): a tile
    with its on and off and, on a hold, its channels, switched by the id
    as Edit's strip has always switched a New block. The chain the page
    keeps is untouched, so Edit there, the chain editor and the report
    still say New block, and no knobs of theirs are drawn in the browser.
    The switch is `OWN_BLOCKS_ON_THE_WEB_FOR_EVERYONE` in that file, false
    (`ownBlocksOpenTo(link.account?.id)`). It is inside the computer app,
    so it came with a computer release, and a change to the list is one
    too: KEEP IT IN STEP WITH mobile/src/lib/gen3Catalog.js `OWN`.
  - *A value's text is a C string in a 32-byte buffer*: the text, a NUL,
    and old bytes from earlier answers after it. The codec's decodeReply
    trims noughts off the end and wants the rest printable, so every value
    with a unit read "?" on his AX3. The reader takes the bytes up to the
    FIRST NUL (gen3-describe decodeDescribe), on purpose unlike the pinned
    codec, which has the same blind spot. What still is not text is
    printed as it came, never a bare "?".
- **Saving over Bluetooth is built, HIS ACCOUNT ONLY, since 1.90.52 (13
  November 2026).** He had thought it existed ("I think we can actually
  save on Bluetooth now", 12 November, and was told it did not), and then
  asked for it: "It still says we can't save in Bluetooth when you pull up
  the quick edit menus and stuff. Please enable that and remove the
  warning."
  - *What is sent* is the computer app's own save, byte for byte
    (mobile/src/lib/bleSave.js, held to forgefx-midi's frames by a test):
    on an FM3, FM9 or Axe-Fx III, function 0x01 with 26 00 and the slot
    (buildStorePreset); on an AM4, action 0x1B with the location
    (buildSaveToLocation, which ForgeFX calls hardware-confirmed). NEVER A
    VP4, whose wire has no save.
  - *Only over the preset the unit is on.* There is no "save to another
    slot" anywhere in it. The Save button asks the unit where it is
    (shared save-wait `stillOnPreset`), and the wire asks again itself
    straight before the frame (bleWire `storePreset`: a gen-3 unit's
    preset, an AM4's structure read afresh); a unit that has moved, or
    does not say, is sent nothing. The way out (gen3Sender, am4Sender)
    passes a frame of a save's shape only while that one save is being
    sent, and only as the save over that slot (`saveAllowed`).
  - *The switch* is `SAVE_OVER_BLUETOOTH_FOR_EVERYONE` in features.js,
    false. lib/bluetooth `saveOverBluetooth()` (his account, or the
    switch) is handed to the wire as `save`, which also wants Edit open;
    the wire's capabilities then say `supportsSave`, a change counts as
    unsaved (rig.noteEdited), and Edit's Save and Play's appear as they do
    through a computer (components/SaveToSlot, whose Bluetooth path calls
    lib/device `saveOnWire`).
  - *The note is gone where the app saves*: Edit's one-time line that a
    change is lost unless it is saved on the unit (BLE_NOTE, and the
    cable's) is not drawn in Edit, the panel or the hold pop-up
    (lib/editWords `editNoteUp`), and the Bluetooth page says Save among
    what Edit does and drops its sentence about saving (`editingLine` and
    `limitsLine`, with `saves`). Every other account reads every word as
    before.
  - *NOTHING HAS BEEN SAVED FROM THE PHONE TO A UNIT YET.* His first save
    is the first check, on each unit: an AM4, an FM3 and an Axe-Fx III are
    his to try; an FM9 he does not have.
  - *OPENING IT TO CUSTOMERS IS A STORE VERSION, not the switch alone.*
    Every copy out was reviewed with notes, and a listing, that say there
    is no saving over Bluetooth, exactly as Edit over Bluetooth was until
    1.90.0. So it goes in a build pair's pull request, keyed to that store
    version as `EDIT_FROM_STORE` keys Edit, with the review notes, What's
    New and the website's pages saying so, and never by an update.
  - Bluetooth → What Bluetooth can't do (lib/editWords, screens/Bluetooth
    `DIFFERENT`) still says, for everybody: no moving, adding or removing
    blocks, no modifiers, renaming or copying a channel, a cab chosen with
    the computer on the three gen-3 units, and no looper, volume button,
    unit metronome click or Footswitches page. Keep that page true
    whenever one of these is built.
- **The switch is one line**: `EDIT_FROM_STORE` in
  mobile/src/lib/ble-rule.js, one entry per unit whose knobs are built,
  null until a store version opens it. To get it out to everyone, set the
  unit to that store version on both phones in that build's pull request
  (`am4: { ios: '1.90.0', android: '1.90.0' }`), with the review notes and
  What's New saying editing works over Bluetooth on that unit. Never by an
  update: the listing and every copy's review notes say editing does not
  work over Bluetooth (the same rules as Bluetooth itself, below). The
  ledger holds each unit the same way, on its own: the build's row names
  the units it opened ("Editing over Bluetooth for customers: AM4, FM3",
  the Bluetooth page's names and nothing else in the list), and
  `EDIT_OPENED_AT` in test/ledger.mjs pins each of those units on its own
  entry, in the first pull request after the build. A unit the row does
  not name stays null, or is keyed to a later store version of its own and
  gets its own row and pin with that build.
- **The catalogs are generated**, mobile/src/lib/am4-knobs.js by
  scripts/am4-knobs.mjs, and fm3-knobs.js, fm9-knobs.js and
  axefx3-knobs.js by scripts/gen3-knobs.mjs, from forgefx-midi at the
  commit desktop/forgefx.lock.json pins (tests hold each to it). A new
  codec pin means running both scripts on it. Each gen-3 catalog comes
  from that unit's static tables through ForgeFX's own profile for it
  (server/src/devices.ts PROFILES: the FM9's family-shaped rosters, the
  III's ranges merged over its table and its read rosters); the computer
  may lay a walk of the unit over them, the phone cannot.
- **Every frame of Edit's is held** before it goes (am4EditAllowed;
  gen3Sender with the unit's own fm3EditAllowed, fm9EditAllowed or
  axefx3EditAllowed, picked by the frame's model byte): a read only of a
  block the unit has just said is in its preset, a write only to a setting
  the unit's catalog names on such a block, within its range. AM4_ALLOWED
  stays as it was for everything else, and everything a gen-3 unit was
  sent before Edit goes as it went. A request is Edit's only when it says
  so (device.js `EDITING`), so Play's own read of the amp, for its boost,
  stays refused over Bluetooth.
- **Each unit opens on its own entry** in `EDIT_FROM_STORE` (`am4`,
  `fm3`, `fm9`, `axefx3`), so any one can go out to everyone without the
  others: test/ledger.mjs `editProblems` asks each unit on the rows that
  name it, its own entry and its own pin. 1.90.0 opens all four together
  (Justin's call, 8 November 2026, above).
- **Where Edit is closed over Bluetooth or a cable, Play's Edit says why.**
  "Why isn't the edit buttons working on iPad?" (8 November 2026): it was
  never the iPad, the button was simply not drawn. On the four units whose
  Edit is built, the button stays and a tap says "Editing works through a
  computer" and what Play does over Bluetooth (or on the USB cable), from
  mobile/src/lib/editWords.js and nowhere else; never on a VP4, and never a
  "yet", a "coming" or a unit named as editing over Bluetooth. The rule is
  mobile/src/lib/editDoor.js, which also takes Edit back to Play when its
  door shuts while it is open (the link down past LINK_DOWN_HOLD_MS, or a
  move to Bluetooth where Edit is closed). The Bluetooth page's editing
  lines follow the same switch (`editingLine`, `limitsLine`): closed, its
  words are exactly what every customer copy has always shown.

**TONE3000 for the AX3's NAM block: started 13 November 2026, HIS ACCOUNT
ONLY. A capture can be sent to the unit from the Developer card since
1.90.58, and through the computer or the Raspberry Pi since 1.90.59. ONE
SEND HAS GONE TO HIS UNIT (14 November 2026, over Bluetooth): taken and not
kept; 1.90.60 carries what was changed for the next.**

> "Next I want to add TONE3000 so users can search, preview and download
> tones for the NAM block directly in the app. ... I already set up in
> another app I made called HeadRush remote." Then: "I already have approval
> from TONE3000 so you can skip that", and of the unit: "I'm not worried
> about damaging anything as I literally bought this just to test
> everything out ... it's a test unit." (13 November 2026)

His HeadRush app (justinnewbold/headrush) has it because that board is on
Wi-Fi and talks to TONE3000 itself; the app only asks the board. A Fractal
unit has no internet, so here the app talks to TONE3000 and then has to put
the capture on the unit, which is the hard half.

- **TONE3000's side is settled.** He has their approval (a paid app needs a
  commercial agreement and their sign-off before it is published; do not
  raise it again) and the key for Fractal Remote, made in tone3000.com →
  Settings → API Keys: the PUBLISHABLE one (`t3k_pub_…`, the client id,
  made to be shipped in apps) is in mobile/src/lib/tone3000.js, with
  `fractalremote://tone3000` on its list of return addresses. The secret
  one (`t3k_cs_…`) is never in the app, the repository or the chat. Their
  terms, which the code keeps: everything browsed is TONE3000's own page
  under TONE3000's name ("Powered by TONE3000"), the creator and licence
  are always shown, a capture is fetched only when a player asks for it,
  nothing is cached or fetched ahead.
- **Use TONE3000's own example, never memory.** github.com/tone-3000/api
  has the same three demo apps in six stacks; web/src/tone3000-client.ts
  is where every address, field and answer in lib/tone3000.js came from
  (the pick-a-tone page is `prompt=select_tone` with `format=nam`,
  `architecture=2`, `preview=true`; leaving `architecture` out returns the
  older kind only). Its react-native/ example is the in-app version: a web
  view and a native C++ preview player, both native, so the next build.
- **What is built (1.90.55): Developer → Testing → TONE3000.** Browse
  opens TONE3000's page in the device's browser (sign in, search, audition
  on its own players, pick), TONE3000 sends the device back by the app's
  link, and the card shows the tone, its creator and licence and its A2
  captures; a capture can be fetched and counted (lib/nam-file.js). No new
  package and no build: SHA-256 is written out (lib/sha256.js), the pass is
  in the app's ordinary storage (secure storage is native), and the
  one-time word uses the engine's secure random numbers where it has them.
  On a page only his account has, so it has no switch yet; it gets one in
  lib/features when it moves to where a player meets it.
- **What a capture is, measured** (the open NAM engine's own A2 example):
  666 KB of text holding 14,017 numbers, 1,871 in the lite network and
  12,146 in the full one, about 56 KB at four bytes a number and about 64
  KB as MIDI. So through a computer or a USB cable it is a second or two,
  and over a Bluetooth adapter on the MIDI jacks (3,125 bytes a second)
  about half a minute. An estimate until the packing is known: he was
  first told Bluetooth could not carry one, which was wrong.
- **HOW AXE-EDIT PUTS A CAPTURE ON THE UNIT IS KNOWN, from his recording
  (13 November 2026; docs/nam-install.md has all of it).** MIDI Monitor on
  his Mac while Axe-Edit III loaded one TONE3000 capture into slot 29,
  read the list back, pointed NAM 1 at it and saved. A capture on the unit
  is one record of 16,384 words: seven 32-byte lines of text (name, maker,
  gear make, model, gear kind, tone kind, a spare), thirty-two bytes
  Axe-Edit fills and Fractal's own captures leave at nought, four numbers
  (loudness, gain, two levels), then the file's 14,017 numbers as floats,
  lite network first. It goes as function 0x54 (slot and size), 128 of
  0x55 (128 words each) and 0x56 (every word XORed), the unit answering
  each; 0.4 seconds on USB, about 83 KB, so about 27 seconds over a
  Bluetooth adapter. The 257 slot names are read with function 0x01,
  08 01, and a NAM block is pointed at a slot by an ordinary typed write
  of its setting 0. mobile/src/lib/nam-install.js builds and reads all of
  it, and rebuilt the recorded upload byte for byte.
  - *THE PACKING IS PROVEN* (`NAM_PACKING_PROVEN`, 13 November 2026). He
    sent the three .nam files he had for that tone ("theses are the files i
    could find"); the one loaded is "Orange Amp: Flat EQ, Gain 6, AKG 414 +
    sm57". All 14,017 numbers are the recording's bit for bit, its loudness
    and gain are the two numbers before them, and the thirty-two bytes are
    the file's own `weights_hash`. `namRecord` packs that file to the
    record Axe-Edit sent, word for word, the name's check byte included
    (below). The files are not in the repository.
  - *THE FIRST SEND WAS TAKEN AND NOT KEPT, AND THE NAME HAS A CHECK BYTE
    (14 November 2026).* His first send from the card, over Bluetooth: all
    130 messages answered "taken", and then "NAM 1 is playing “<EMPTY>”
    now". The app's record differed from Axe-Edit's by ONE byte, the name's
    32nd: Axe-Edit sent 0x60, the unit's list answers a NUL there, and the
    first build took that for the unit's own ending and sent a NUL. 0x60 is
    the name's other 31 bytes XORed together, so the name field XORs to
    nought (`namCheck`); `namRecord` sends it since 1.90.60. LIKELY, NOT
    PROVEN: it is the best reading of the bytes, and it stays "likely"
    until a send from the app is kept by his unit. The lesson either way:
    A BYTE AXE-EDIT SENDS IS SENT, even one the unit seems to throw away;
    "the unit overwrote it" was a guess from one sample.
  - *The card after that send*: "this whole screen is confusing to me. What
    am I supposed to be doing?" It now says its steps in order, each
    capture has ONE button (Send it and play it in NAM 1: fetch, send,
    point NAM 1 at it), what became of the send and what the block said
    keep a line each, and a slot that still reads <EMPTY> after a send is
    said as "took the capture and ... did not keep it" with no Play button
    (the wire's log says the same, with the check byte it sent). What he
    hears on TONE3000's page is TONE3000's own demo, never his rig: the
    card says so.
  - *I cannot read his phone's log from here* (the read-only door for
    reports still waits on his key). He pastes a log when one is needed;
    the [tone3000] lines and "a capture went to slot" say what the unit
    answered.
  - *THE SENDER IS BUILT (1.90.58), HIS ACCOUNT ONLY: Developer → Testing →
    TONE3000.* A fetched capture has Send to the Axe-Fx III: the phone
    reads the unit's slots from the first up to the first that says
    <EMPTY>, sends Axe-Edit's own sequence into it (the slot read, "a
    transfer is under way", 130 messages each sent when the one before is
    answered, "it is over", the slot read back) with a count as it goes,
    and then offers Play it in NAM 1 / NAM 2 (the typed write of setting
    0). Over Bluetooth or the unit's USB cable into the device, on an
    Axe-Fx III only (bleWire `namEmptySlot`, `namInstall`, `namPick`;
    lib/device `namEmptySlotHere` and the two beside it). A slot in use is
    never written, except the one a stopped send of the card's own left
    half-filled. While it goes the watch asks nothing and any other write
    is refused. Every frame of these shapes is held at the way out
    (`namShaped`, `namAllowed`). The switch is the wire's `captures`
    option (lib/bluetooth: his account). His first send (above) was taken
    and not kept; his first pick was answered, with the slot it asked for.
    Nothing is saved on the unit by it: the preset is saved the usual way.
  - *WHILE A CAPTURE GOES, NOTHING ELSE LEAVES THE PHONE* (1.90.60, bleWire
    `pump`). Axe-Edit sent nothing between "a transfer is under way" and
    the unit's answer to the last message; the first build let reads
    through (the rig's half-minute "which preset are you on?" lands inside
    a half-minute upload nine times in ten). A read asked meanwhile waits
    and goes after; anything that would change the unit is refused up
    front (`request`), since a route that reads before it writes would
    otherwise write half a minute late. Round the end the phone rests as
    Axe-Edit did (`NAM_REST`), and a slot that reads <EMPTY> is read once
    more before it is called not kept. THE COMPUTER'S PATH DOES NOT HOLD
    OTHER REQUESTS YET (ForgeFX queues each of the 130 on its own): that
    is the next ForgeFX change, with a pin and a computer release.
  - *One send at a time, whoever draws the card* (`atWork` in the card):
    a send goes on after the card is left, and the computer refuses no
    second one. A capture is named by the file's own word where any of it
    survives as plain ASCII, else TONE3000's name, else "Capture <id>",
    and never "<EMPTY>". What the card says a send takes is the record's
    real size (`RECORD_SEND` in lib/nam-file, 83,227 bytes, held to the
    130 messages by a test), not the old estimate.
  - *The recording is not in the repository* (a creator's capture, and the
    names of Fractal's own). He has it as NAM.mmon. Never ask for his
    Fractal-Bot backup either: it holds Fractal's own captures.
  - *Slots over 127 are not named by an upload yet*: the 0x54 message was
    only seen for slot 29, so which bytes hold a bigger number is a guess.
    His unit had 31 captures (0 to 28 and 256) and Axe-Edit took the first
    empty one.
  - *THROUGH THE COMPUTER OR THE RASPBERRY PI SINCE 1.90.59, the same
    card, HIS ACCOUNT ONLY.* "But this will only work over Bluetooth or
    plugged in directly? Why not over a raspberry pi?" (14 November 2026.)
    The computer app sends Axe-Edit's messages itself from the release that
    carries ForgeFX 4e6f05b (server/src/namCaptures.ts, three routes:
    GET /nam/empty, POST /nam/slots/<n>, POST /nam/blocks/<id>/slot). The
    device packs the record (the one packer) and hands it over in one
    message (lib/nam-travel), so there is no count as it goes; on USB the
    unit takes a capture in about a second. THE COMPUTER NEVER REPLACES: it
    writes a slot only when it reads <EMPTY>, which is why a device may ask
    for these through the relay (shared/relay-rules `hostAllows`, in step
    with ForgeFX `remoteAllowed`). lib/device sends by whichever way the
    device is connected (`captureAsks`); only the Developer card calls it
    (a test holds that), which is what keeps it his. An older computer app
    is answered "Update the computer app to send a capture through it.";
    COMPUTER_NEEDED did not move. namCaptures.ts and nam-install.js ARE
    CHANGED TOGETHER. NOTHING HAS BEEN SENT TO A REAL UNIT THROUGH THE
    COMPUTER: his Raspberry Pi is the first check.
- **The order from here:** his first send from the card (either way); then
  a capture picker in Edit (the list of all 257, read once and kept, and
  the same typed write); then the TONE3000 screen where a player meets it,
  which is a store version (new for customers, and its in-app browser and
  preview are native). Only an Axe-Fx III has a NAM block. A slot is only
  ever written when it reads <EMPTY>, unless the player says to replace
  what is there (over the device's own wire only).
- **No build for it yet.** A build now would cut every store copy off from
  updates until it is in the stores, and the in-app TONE3000 screen will
  add native pieces of its own, so the build pair waits for the list to be
  whole. He has 7 iPhone and 10 Android builds left in November, by his
  own count. The free Android APK from a side branch is where the native
  pieces can be tried first.

**Two sides on a big screen: open to everyone since 9 November 2026; the
plan is docs/two-sides/README.md.**

> "How do I put these side by side on the iPad?" and "Check the side by
> side stuff is optimized for iPhone Duo also." (9 November 2026)

> "Go ahead and flip the switch though to turn this on for all users"
> (9 November 2026, the day Apple put 1.90.0 live)

The plan (8 November 2026) and its nine mockups are in docs/two-sides/.
On a window wide enough and wider than tall (mobile/src/lib/twoSides.js:
an iPad on its side, the opened iPhone Duo held sideways, Android tablets
and folds sideways; every phone upright, an iPad upright and the Duo
closed or opened upright stay one screen) Play keeps one half and Edit,
Setlists or All presets opens in the other (mobile/src/components/
Sides.js), each half with a bar: its name (tap for the list), Swap, Full
screen; Two sides brings the other back. With two sides up the tuner
borrows a side (a narrow column on an iPad, half on the Duo) instead of
the big pop-up (#840). The Duo's divider sits on the fold, the side away
from its strip wider. A Play hidden under a full-screen tool is asleep
(`picture.awake`).

- **The switch** is `SIDES_FOR_EVERYONE` in mobile/src/lib/features.js,
  true since his word above. Off, it is his account only again (the kept
  sign-in, as the Bluetooth gate).
- **Hold a block for its knobs** (step 4, Derek's panel:
  components/BlockSide.js, lib/twoSides `holdGoes`) is open to everyone
  the sides are open to since 10 November 2026: "Activate the other hold
  for knobs i checked it." Its switch is `HOLD_KNOBS_FOR_EVERYONE`, true.
  Where the panel does not open (every phone, anything upright), a hold is
  the channel pop-up, which can carry knobs too (below).
- **The sides' buttons are in the app's top bar on every window, since 10
  November 2026.** "The play and two sides buttons take up a whole row on
  iPad. What other options for those?" ... "Yes do that now." So no side
  has a bar of its own any more: components/SidesLead draws the names,
  Swap (on the line between the sides) and Full screen or Two sides in the
  top bar, after the version on a big screen (TopBar `leadKeepsVersion`,
  `leadWide`). Play alone on a big screen has one button there, Two sides,
  which brings the last tool back or opens the list. Play has no Full
  screen of its own: the Done of what is beside it does that.
- **Left:** step 5 (the Save / Don't save / Stay question before a preset
  change, icons on the bars in place of the words, pop-ups over their own
  side, VoiceOver), and the tidier Edit beside Play he asked for the same
  day ("it just feels a little clunky still ... more like the real ax edit
  software": how it works, never how it looks; mockups first).
- Nobody here has a Duo: its numbers come from the plan and are held by
  test/two-sides.mjs, and his first look is the real check.

**A phone held on its side splits in two as well: built 10 November 2026,
HIS ACCOUNT ONLY, and in the phone app IT CANNOT SHOW UNTIL A BUILD LETS
PHONES TURN.**

THE PHONE APP IS HELD UPRIGHT ON A PHONE, NATIVELY. iPhones by
`"orientation": "portrait"` in mobile/app.json (iPads turn through
`supportsTablet`), Android phones by `holdPhonesUpright()` in
mobile/plugins/withTabletTurns.js (a short side under 600 dp). No update
can change that. The picture this started from ("This is the landscape
view on iPhone") was the WEBSITE in his iPhone's browser: the faint PLAY
and EDIT tabs behind the version are the browser's, and its buttons were
two rows of three. It was taken for the app, the split was built in the
app (#850), and "Landscape mode on iPhone is not working" (the same day,
on 1.90.26, his own account) was the first anybody knew. Check that a
screen can be reached before building for it, and say before building
when it needs a build. His answer to the two ways forward was "Do both":

- **The app:** the native work that lets a phone turn waits as a patch in
  docs/pending (phone-turns), for a build pair he has to say yes to. In
  it a phone turns only on Play, on what opens beside Play and in Stage
  view, for an account the sideways layout is open to, and is upright
  everywhere else; tablets are as they are.
- **The website:** the browser's Play on a phone held on its side
  (src/lib/sidewaysPlay.js, components/SideHead.jsx, Gig.jsx, the last
  section of styles.css behind `data-sideways`): two halves of square
  tiles, five buttons in one row, the preset and Setlists over the halves
  or up in the top bar by the same rule as the app's. A window wider than
  tall, 720 or more across, 250 to under 500 tall, in a browser that
  calls itself a phone; never the computer app's window, a laptop or a
  tablet. Its switch is `PHONE_SIDEWAYS_ON_THE_WEB_FOR_EVERYONE` in
  src/lib/sidewaysPlay.js, false: his account only
  (`isAdmin(link.account?.id)`). The browser has its own copy of the
  squares' rule, held equal to the phone's by a test, and nothing under
  mobile/ imports it. It is in the web app the computer serves, so a
  change to it makes a computer release.

What follows is what #850 built in the app, which is right and waiting.

> "This is the landscape view on iPhone ... let's split the screen in half
> kind of like the iPhone duo even though things will be smaller. It'll
> still look better instead of just stretching everything give me some
> mock ups." Then: "Can you make the icons more square looking instead of
> stretched?", "What would the screens look like on an AM4?", and "Yes
> build them." (10 November 2026)

The six pictures he approved are docs/two-sides/phone-sideways-01…06.png
(FM3 and AM4), and docs/two-sides/README.md has "A phone on its side".

- **The rule** is `phoneSidewaysOn` in mobile/src/lib/twoSides.js: a frame
  wider than tall, at least 720 across (each half 360 or more: an iPhone
  17 on its side is 734, a Pro Max 832), and UNDER `SIDES_TALL`, which is
  what keeps every tablet and the Duo on `twoSidesOn`, untouched. App.js
  asks it only where the big-screen rule said no (`low`).
- **The switch** is `PHONE_SIDEWAYS_FOR_EVERYONE` in
  mobile/src/lib/features.js, false: his account only (the kept sign-in).
  It opens to everyone the two sides are open to when he says so, with its
  What's new line in that pull request. Every other account's Play on a
  phone on its side is what it always was.
- **Squares win over filling here**, the opposite of a tablet's `tilePlan`:
  mobile/src/lib/sidewaysPlay.js (`sidewaysPlan`). Play alone is two
  halves, scenes left and chain right, each grid centred in its half (an
  FM3's 8 and 8 are four across by two; an AM4's 4 and 4 are two by two),
  with Previous, Tuner, Edit, Tap and Next in one row along the bottom.
  No square under 64 points: past that the page scrolls.
- **The preset and Setlists go up into the top bar when that buys bigger
  squares** (`headUp`: 15% or more, or a scroll saved; the AM4's picture),
  and sit over the halves otherwise (the FM3's). By the size it buys,
  never by the unit's name. Play says the words (lib/playHead), the bar
  draws them (components/PlayHead), App owns what they open.
- **Beside a tool there is no second row of bars**: each side's name, Swap
  and Full or Two sides are in the app's top bar (components/SidesLead;
  TopBar `lead` and `slim`). The tools keep their own headers and their
  own Done. Play in a half has its preset row with Setlists at the end,
  the scenes as squares, the chain under them, and five short buttons
  (Prev, Tuner, Edit, Tap, Next).
- **A held block is today's channel pop-up there** (`holdAsks` gets
  `wide: big`): the knobs panel needs room this window does not have.
- **Not built yet:** the tidier Edit of picture 03 (ten knobs, five
  across). Edit in a half is today's Edit, as on the Duo. And nothing has
  run on a phone: the top bar's room with a tool beside Play on a small
  iPhone, Swap landing on the divider, and the real heights are the first
  things his look will settle.

**The hold pop-up carries the block's knobs: built 10 November 2026, open
to everyone the same day.**

> "Also when not in landscape mode on all devices and screens instead of
> just having channels pop up to change have the knobs only pop up above
> the channels so some one can quick change a setting." (10 November 2026)

Wherever a hold opens the channel pop-up (`holdGoes` answers null), and
Edit's door opens for this account, unit and connection (`editOpens`;
never a VP4), the pop-up shows the block's knobs and pages over the A to
D channels, which stay fixed at its foot (mobile/src/lib/holdPop.js
`popKnobsOn`, components/PopKnobs.js; the knobs are Edit's own
`BlockPanel`, drawn `bare`). The switch is
`HOLD_POPUP_KNOBS_FOR_EVERYONE` in features.js, true since his word below
(off, it is his account only again). Where Edit's door is shut (a VP4, or
Bluetooth on a copy older than 1.90.0), the pop-up is exactly the channels
it always was. A preset change still closes it, and so does picking a
channel.

Beside CHAIN, where the hold opens that pop-up with knobs, Play says "Hold
for quick edit" (`HOLD_FOR_QUICK_EDIT` in lib/holdPop.js): "On the gig
screen where it says, hold the switch channels, have it say hold for quick
edit" (12 November 2026). Where the pop-up is the channels alone it still
says "Hold to switch channels", because there a hold edits nothing, and so
does the browser, whose words (shared/play-words.mjs) were not touched: a
change there is a computer release. Where the hold opens the panel beside
Play it says "Hold for its knobs", as before.

**Built on 10 November 2026** ("yes to all your other non build suggestions
as well"), on his account first, **and open to everyone since that
evening:**

> "Activate all of the features that were just on my account to all the
> other accounts obviously besides the developer portal" (10 November 2026)

So the six switches for what he had in the app are true in
mobile/src/lib/features.js: the hold pop-up's knobs (above), and the five
below. Each still has its own switch, so one can be closed again (his
account only) without the others. The Developer pages are not behind these
switches: they are his account's (`isAdmin`), and stay so. NOT opened: a
phone on its side, in the app (`PHONE_SIDEWAYS_FOR_EVERYONE`), which no
account can see until a build lets a phone turn, and on the website
(`PHONE_SIDEWAYS_ON_THE_WEB_FOR_EVERYONE`), which was merged after he said
this and which he has not seen. The rule
for the next new thing is unchanged: his account first, behind its own
switch, and open when he says.

- **The tidier Edit and the handle on the line between the sides**
  (`TIDY_EDIT_FOR_EVERYONE`; lib/tidyEdit, lib/sidesSplit,
  components/SidesHandle). Edit's open block is one row (name, A to D,
  On/Off, and the model where the panel is 520 points or wider), the tabs
  one short row, and the knobs as many across as the measured width takes
  (three on a phone upright, five in half an 11-inch iPad, eight full
  screen). Beside Play, Edit's title drops the preset's name. On a big
  screen the handle swaps on a tap, resizes on a drag (neither side under
  360; past that the side closes), and two taps or turning the device put
  the line back; no resize on the Duo's fold or beside the tuner's column.
  The top bar's Swap is not drawn where the handle is. No More button: the
  rows it would hold are under the knobs. How an editor works, never how
  one looks.
- **Stage view** (`STAGE_VIEW_FOR_EVERYONE`; lib/stageView,
  components/StageView): the preset, the scene and what is next, sized
  from the room, with Previous and Next as the screen's edges on a wide
  window, the scenes as one row of big buttons, and the tuner as a strip.
  It sends only what Play sends. Ways in: a button in the top bar before
  Two sides on a big screen with Play alone, and a row in Settings → Play
  screen on every device.
- **Song notes** (`SONG_NOTES_FOR_EVERYONE`; lib/songNotes, lib/notesHere,
  components/SongNotes): each setlist song can carry up to 4,000
  characters of lyrics, chords or cues, written from Setlists → Set up
  each song, shown as the Notes tool beside Play (only while a setlist is
  on) and over the lower part of Stage view. KEPT ON THE DEVICE ONLY,
  under their own key: the setlist's own songs are cleaned by the file the
  browser and the computer app share, which would drop a notes field, and
  nothing here changes that file. No log or report can reach them (a test
  holds the list of files that can).

- **Three across** (`THREE_SIDES_FOR_EVERYONE`; lib/threeSides): on a
  frame 1290 points or more across (a 13-inch iPad Pro on its side, 1366;
  never an 11-inch, at most 1210, and never a fold), with a tool beside
  Play the top bar offers Add a side, and Play has two tools beside it in
  three even columns. The first tool's state is untouched: the third is an
  addition (App.js `third`) that closes first when the window narrows and
  comes back with the room. The tuner and a held block's knobs borrow the
  FIRST side, as always. No handle with three up; Swap is in the top bar.
- **Add to setlist from All presets** (`ADD_TO_SETLIST_FOR_EVERYONE`;
  lib/addToSetlist): a hold on a preset opens one sheet with his setlists,
  Starred, New setlist, and Give it a color… last (the hold was the colour
  tag's, which is still what it is for every other account). It adds
  through the Setlists page's own calls (lib/lists `addTo`, `updateList`),
  and says "Added" only of a save that reads back. THE REAL DRAG WAS LEFT
  OUT: a row dragged out of a scrolling list and across the line could not
  be made dependable without a device to try it on, and a half-working
  drag is worse than none. He was told (he had been offered "drag a
  preset ... across the two halves", which two sides cannot show: one is
  always Play).

That is everything from that yes. The three ideas that need a build
(keyboard and foot-pedal keys, a second screen, widgets) were offered,
not asked for.

**The next build pair is being collected, and NOTHING IS BUILT until he
says so.**

> "Before doing another build, let's make sure we have any native change
> set up that we want done first." (10 November 2026) And, the next day:
> "Don't build anything yet. I'm still going through the Watch to see if
> there's any other tweaks I want you to make before we do another build.
> And if there's any other native changes to make to the iPhone app."

So native work goes into docs/pending as it is finished, and the build is
asked for once, when he says the list is whole. Waiting there now:

- **phone-turns** (above): a phone may be turned on its side on Play.
- **watch-page-order** (11 November 2026), everything he asked of the
  Apple Watch that day, in one patch that moves the watch line only:
  - *Which pages, and their order.* "Can we add a way for a user to select
    which order their pages show up in on the Watch app?" and "Yes, add
    hiding pages." Chosen on the iPhone (Settings → Apple Watch → Watch
    pages: Move up, Move down, Hide, Show; one page always stays), sent in
    the picture as `pages` and `hidden`, repaired by one rule on both
    sides (shared/watch-link.mjs). The watch opens on the first shown.
  - *A fifth page, Tempo*: the BPM, Tap, and a switch for the wrist's
    metronome. He thought the watch had tap tempo already; it only tapped
    the beat. "OK, well let's add that as well then." Tap is Play's own
    `tapTempo()` and nothing else; where Play has no Tap, the watch says
    Play's sentence.
  - *The metronome lights the edge of the watch* (12 November 2026): "I
    also wanna make it so the watch can do a light up type function as
    well on the metronome ... have the watch outside edge flash with the
    same as the tempo." A soft green line round the edge of the screen on
    every beat the wrist's metronome taps, over every page, taking no
    touch. No switch of its own: it is part of the wrist's metronome,
    which still runs only while the metronome is on on the iPhone.
  - *The tuner page says what it is and what a tap does.* "Where it says
    tuner on I feel like that means it on." He picked mockup B
    (docs/watch/tuner-start-stop.png): "Off" with Start tuning, then Stop
    tuning. Never "Tuner on" / "Tuner off" as a button's words again.
  - *Tuner stays on when you swipe away*, a switch on the iPhone, off by
    default: "Some people wanna play while their tuner stays up on their
    screen." Hiding the Tuner page still stops it.
  - *A check-in* (`here`, about every 20 seconds while the watch app is on
    the watch's screen) that keeps a locked iPhone's app awake by renewing
    the existing 25-second wake: "Yes, add that to the build." No
    background mode, no native iPhone change. Over Bluetooth a phone kept
    awake this way still does not see a scene changed at the unit.
  - *Quick edit on a held pedal* (12 November 2026): "On the watch, we
    have pushed to hold on the channels to switch amps. Can we set up quick
    edits on that as well? And change the name to hold to quick edit?" and,
    of three mockups, "For the watch, mock up B"
    (docs/watch/quick-edit-list.png). Where the iPhone offers it, the line
    under the pedals reads "Hold a pedal for quick edit." and a hold opens
    the channels in one row over a list of the block's knobs; a tap picks
    one and the Digital Crown turns it. HIS ACCOUNT ONLY
    (`WATCH_QUICK_EDIT_FOR_EVERYONE` in features.js, false), and only
    where Play's own hold pop-up carries knobs (`popKnobsOn`: Edit's door,
    never a VP4). The knobs are Edit's: listed by lib/watchQuick, read and
    written by lib/watchQuickEdit through `blockParams` and
    `setParamConfirmed` and nothing else, so a block's Level is never on
    the wrist and nothing is saved. Where it is not offered the watch says
    "Hold a pedal for its channels." and opens the channel picker it
    always did. It opens to everyone when he says so, with its What's new
    line (`only: 'ios'`) in that pull request.
  The iPhone's half is merged and inert: its Settings rows and the new
  picture fields show only once the paired watch's hello says what it
  knows (mobile/src/lib/watchPages.js), which no watch does before the
  build. The Swift has never been compiled; watch.yml, started by hand
  with "Apply the watch patches waiting in docs/pending first", compiles
  and tests it for free.
- **bluetooth-done** (14 November 2026): a Done button on Apple's
  Bluetooth MIDI Devices screen. "Can we have this screen have a button
  that says done? All it says now is edit, which is confusing to people"
  (his picture, iOS 27.2.1). The build has always put a Done there; on
  iOS 27 Apple's screen takes it off again, so the sheet showed only Edit
  while every sentence in the app said "then Done". The patch draws
  Apple's screen inside a screen whose bar is the app's own (`PairingHost`
  in FractalBleMidiModule.swift): Done top right (the word, not the
  system's tick), Edit on the left. It moves the ios line only. THE WORDS WENT OUT BY UPDATE (1.90.60): on iOS
  26 and later (26, since that is where the system's Done became a tick),
  in a build that does not answer `pairHasDone`, the app
  says "then swipe that screen down" (lib/bluetooth `appleDoneGone`),
  which has always closed that sheet. The line under a button is two lines
  at most, so that sentence is kept to 88 characters (a test holds it). Never write "then Done" about
  Apple's screen in a sentence of its own again: use `appleScreenOpens()`
  or `appleScreenHint()`, which know (and which ask the device only when
  they are drawn: a customer Bluetooth is not open to is asked nothing).
  AND A BAR BUTTON THAT MUST SAY A WORD IS NEVER A SYSTEM ITEM: since iOS
  26 the system's Done, Cancel and Close items are drawn as symbols (a
  tick, a cross). The patch's Done is a titled action for that reason;
  its first version was the system item, and the two reviewers of the
  patch caught it before a build was spent.
- **Not in, by his word:** a second screen and home-screen widgets ("go
  ahead and skip the second screen and the widgets for now").
- **Offered, not yet answered:** keyboard and foot-pedal keys, lining the
  Expo packages up, the photo permission sentence naming the profile
  photo.

**The metronome's flash round the edge of the screen is a choice: built
12 November 2026, HIS ACCOUNT ONLY.**

> "Also on the metronome, can we set it where it can run the metronome on
> the device and the phone at the same time or either one? And then on the
> phone have an option for the screen to flash somewhere like the outside
> edge of the screen." (12 November 2026)

The first half was there already and he was told so: Settings → Metronome
→ Where it clicks is Unit, the device, or Both (shared/metronome.mjs;
only the device over Bluetooth, on an AM4 or in the demo, where the app
cannot switch the unit's click). The edge of the screen had always flashed
with the device's own click (components/MetronomeBeat). What is new is the
choice (mobile/src/lib/edgeFlash.js, which imports nothing): a switch on
that page, Flash the edge of the screen. Off, the click and the tap carry
on unlit. On with the click on the unit alone, the edge lights on every
beat and the device makes no sound and no tap, and opens no audio.

- **The switch** is `METRONOME_FLASH_CHOICE_FOR_EVERYONE` in
  mobile/src/lib/features.js, false: the choice is drawn for his account
  only, and for every other account the edge flashes with the device's own
  click and never without it, whatever the device has kept. It opens when
  he says so, with its What's new line in that pull request.
- **The light keeps the unit's tempo, not its beat.** The unit does not
  tell the app when its beats fall, so the light and the unit's click can
  be part of a beat apart; a press of Tap starts both together. The page
  says so where the unit clicks. Do not promise they are locked.
- **Axiom** (justinnewbold/Axiom-Fractal-Grok, which he pointed at) has
  the same three places, Phone / Pedal / Both, and a green light by Tap,
  and no flash round the screen: the edge flash is this app's own.
  Nothing in Axiom was changed.
- **The watch's light** is native and waits in watch-page-order (above).

**All presets as a wheel, a choice beside the list: built 11 November
2026, HIS ACCOUNT ONLY.**

> "One thing I was thinking on the iPhone app is when they're scrolling
> through the presets. It makes like a clicking and a vibration kind of
> like the old iPod wheels did and maybe make some a little bigger and
> smaller as you're scrolling through them ... to kinda highlight the
> prominent one in the middle." Then, shown three pictures: "Can we do
> preset scrolling option a as a setting? So we can have both the original
> and that one." (11 November 2026)

So the list is untouched, and the wheel is a choice: Settings → Play screen
→ Tiles & scenes → Preset list (List or Wheel, and while Wheel is chosen a
tick box, Click and tap as the wheel turns). Kept on the device
(`fractal.presetWheel`), the list until somebody chooses.

- **The switch** is `PRESET_WHEEL_FOR_EVERYONE` in
  mobile/src/lib/features.js, false: the choice is drawn for his account
  only, and every other account's All presets is the list whatever the
  device has kept. It opens when he says so, with its What's new line in
  that pull request (it has none yet).
- **It is a click wheel that glides, the fourth version (12 November
  2026).** The first two were a scrolling list that clicked, and both felt
  wrong on his phone: first "very clunky doesn't match up with the clicks
  properly ... remove the boxes around the outside edge of the presets as
  well and make the size of the preset names a little smaller", then,
  after the rows were made to follow the thumb, "it still needs. Research
  how the iPod touch used to scroll through the songs, but I wanna make it
  like a wheel right now it doesn't feel like a touch wheel.. and the
  haptics and the sound still are not matching up properly so when you
  scroll fast, it doesn't click at the right time when it slows down or at
  all sometimes". Shown a ring to spin (A) and a drum to drag (B): "let's
  do number A". The third was that ring, moving a bar one whole row a
  notch, with nothing coasting: on time, but stiff. "It just still needs a
  lot of work do some more research. Let's figure out how to get it
  smoother and maybe like momentum where if I flicked it, it would go fast
  if I went slow, it go slow, kinda like that kind of like an original
  iPod would."
  - *The rule that survives all four:* THE APP MOVES THE LIST ITSELF. A
    list the system scrolls coasts on its own, and the app can only watch
    it and click after the fact. Here where the list is is the app's own
    number, and the one function that sets it (components/PresetWheel
    `put`) fires the click and the tap the moment a new preset comes under
    the bar, whether a thumb or a coast moved it. DO NOT GO BACK TO A
    SCROLLING LIST, OR HAND THE MOVE TO AN ANIMATION, WITH CLICKS ON TOP:
    a test fails on either.
  - *What the music player did* (its maker's patents on accelerated
    scrolling, and the open firmware written for it): a slow turn is one
    item a notch; past a turning speed the same turn is worth more, the
    faster the more, up to a most; a pause puts it back to one.
  - *What it is* (components/PresetWheel.js): a ring under a short list
    that slides under a fixed light bar. Turned slowly, 15 degrees is one
    preset and the list moves with the thumb, part of a row for part of a
    notch. Turned faster than two thirds of a turn a second, the same turn
    is worth more, rising smoothly with the speed (`wheelGain`), held to
    what the list is long enough to want and to 240 presets a second.
    Lifting a thumb that is still turning lets the list coast from the
    speed it had, slow like a wheel with a little friction, and stop
    exactly on a row (`wheelCoast`); lifting one that had stopped settles
    on the nearest row. The rows can be dragged and flicked the same way.
    A thumb landing on the ring or the rows stops a coast. The list is
    never settled under a thumb that has only paused (a slow, careful
    thumb would lose the part of a notch it had turned). The middle
    button, Load, loads the preset under the bar by that row's own press;
    a row can be tapped too.
  - *Why it is smooth:* the rows are one strip slid by one number, set
    straight from the move, and are drawn again only every few rows
    (`WHEEL_REDRAW`), never for each preset that passes. The bar is fixed;
    the same strip is drawn inside it in dark ink, so a name turns dark as
    it slides in. Names are one size (18) under the bar and round it, or a
    name half in the bar would be two sizes at once.
  - *No boxes:* a preset is its name, slot and star on one line; the one
    being played is amber and says "Playing". Drawn in the plain colours,
    never the glass, so Classic is the same.
  - *The click* (lib/wheelClick.js) is ready before it is needed: on an
    iPhone four players take turns, each rewound two clicks ahead of its
    turn, and the device's sound is kept awake while a wheel is on screen.
    At most about thirty a second: a thumb looking for a preset hears
    every one, and a spin or a coast is a purr that thins into single
    clicks as it slows. Android's tap is its own dial tick.
  - *The list is not touched.* Its row in screens/Presets is word for word
    what it was before there was a wheel ("let's make sure we don't touch
    the other ones"); for the wheel, `rowOf(n, true)` answers what the
    same preset says and does (a test counts each of them twice). Never
    bend the list's row to share code with the wheel's.
- **NOTHING LOADS UNTIL LOAD OR A ROW IS PRESSED.** The bar is where the
  eye is, never what the unit plays.
- **The arithmetic** is mobile/src/lib/presetWheel.js (imports nothing):
  what a turn is worth at the speed it is made (`wheelFlow`), the coast
  and where it lands, which preset is under the bar, and how the room is
  shared between ring and rows.
- **The click** is the system's picker tap and the metronome's click
  played quietly: silent in silent mode, over a backing track rather than
  stopping it. The metronome's own out-loud mode is never set back by it
  (lib/audioMode.js).
- **Sound, tap or both, and a flying line (12 November 2026).** Asked
  which part was worst: "it's mostly the sound not matching. But it also
  lags quite a bit too if you scroll really fast, it doesn't keep up..
  maybe there's an option we can add also that we're just the sound. Is
  there instead of the haptic feedback or vice versa?" So while the wheel
  clicks, Settings offers Sound and tap, Sound only, Tap only (the
  setting's `feel`; `wheelFeel` says which halves a click is made of, and
  no sound is loaded for a wheel that only taps). And past 40 presets a
  second the rows are put away and one line says the slot the list is
  passing, big, with its name under it (`wheelFlying`, `WheelFlying`):
  drawing the rows again was the slowest thing the wheel did, every frame,
  for names nobody could read. They come back once when it slows under
  18, rests, or a thumb stops dead.
- **What an update cannot do:** the tap and the click are asked for
  through Expo's own haptics and sound, which answer a few hundredths of
  a second after they are asked. Making them land dead on the row needs a
  small native piece (the system's tap made ready ahead of time, and a
  sound played from memory), which is a build. Offered to him for the
  next build list; not built.
- **None of the four has run on a device here.** How far a notch is, how
  soon and how hard the speed-up comes in, how long a flick carries and
  the ring's size are his to say; they are single numbers in
  lib/presetWheel.js (`WHEEL_NOTCH_DEG`, `WHEEL_EASY_DEG_S`,
  `WHEEL_GAIN_MOST`, `WHEEL_ROWS_MOST`, `WHEEL_DRAG`, `WHEEL_GRIP`,
  `wheelLayout`).

**Amp & pedal names is its own button on the front of Settings, right
under the profile, at both ends** (12 November 2026): "Let's move the amp
and pedal button out of the Help menu and make it its own button in the
settings menu. Put it right below the profile menu." It was the third row
inside Help. Now it is the same row in a card of its own, in no section,
between the account card and My rig, on the phone (screens/Settings) and
on the website and the computer's window (src/App.jsx, `.setup-door`),
because a test holds the two ends' lists to each other. The website's half
is inside the computer app, so this made a computer release.

**In Edit the knobs come first.** "In edit move search bar and amp and
pedal names to the bottom. Have the Bluetooth warning also move to the
bottom. We want as many knobs visible in edit." (10 November 2026.) Then,
the same evening: "I kind of want this to mainly be to edit knob presets
quickly, and I feel like that these four other buttons are just taking up
space on the screen", and, shown docs/edit-more/: "Yes, I like those. Go
ahead and implement that." So (mobile/src/lib/editMore.js):

- Edit opens on a block, its knobs already showing: the one last open in
  that preset, else the amp, else the first that is not an end
  (`firstOpen`). Never on a VP4, which has no knobs to read.
- Amp & pedal names, Edit chain, Modifiers and Rename preset and scenes are
  in More (••• beside Done; ⋮ on Android), by the rules the buttons had,
  with the beta note and, on a VP4 or over Bluetooth, what Edit cannot do
  there. A tool opened from More draws under the chain in the open block's
  place until its Close.
- Find a control is the magnifier beside More: the box opens at the top of
  the page with the keyboard, and goes when a result is tapped.
- The shortcuts: the preset's name renames, the + tile at the end of the
  chain opens Edit chain, the i beside a model opens Amp & pedal names on
  that model, and a knob held still (`HOLD_MS`) opens Modifiers on it. The
  number box under every knob is where a value is typed.

**A tap on the number under a knob selects all of it** (13 November 2026):
"in tapping on one of the numbers it highlights it so that you can just
quickly type -3 or whatever number without having to go to the back and
delete it and then retype." An iPhone ignores `selectTextOnFocus` on a
thumb's tap, and the box swaps its text as it opens, so the box hands
TextInput the selection itself (mobile/src/lib/value-field.js, the tempo
box's rule with a clock in place of its pop-up; Edit's `ValueBox`, which is
the Level's box too). An emptied box, or one tapped and left as it opened,
writes nothing to the unit: it used to write 0, or its own rounding.

The Bluetooth note (and its USB-cable twin) stays at the foot of the page.
Nothing new goes above the knobs: over the chain there is only the title
row, Save's own lines, a fault, what the chain's read says, and the search
box while the magnifier has asked for it (test/mobile.mjs and
test/edit-more.mjs hold the order).

**A block's Level in Edit is typed, not read-only (phone, 10 November
2026).** A player on the Fractal forum (SASouth): "I'm interested in
knowing why levels in the output blocks are marked read-only. I often want
to tweak the volume of a preset without changing the amps gain." Justin:
"Yes, do an update for that right now, please." So the phone has the
browser's rule (mobile/src/lib/blockLevel.js): the level stays out of the
knobs (a level under a thumb dragged to the bottom is a silent preset), and
the number under them is a box to type into, decibels only, never below
-20 dB (`LEVEL_FLOOR_DB`, lib/guardrails' own number) and never over the
level's own top. On the Output block it is the setting called exactly
"Level", not a row's or a scene's. A level in anything but decibels still
says read-only. Over Bluetooth the Output block is not in Edit's chain at
all (bleWire `OFF_STAGE`), so there it reaches the amp's and the other
blocks' levels, not the preset's own; the speaker button on Play, which
moves the Output block's Level, is the computer's too.

**On a big screen Play's tiles take the whole screen.** "It would be
better if they looked like square boxes as much as possible" (9 November
2026, #841, mobile/src/lib/squarePlay.js), and then, shown an AM4's four
scenes and four pedals as two thin towers on an iPad upright: "it should
be taking full advantage of the iPad screen and all scenarios." So the
tiles fill all the room Play has, width and height, and the arrangement
chosen is the one whose tiles are closest to square (`tilePlan`; no tile
more than twice as long as it is wide or tall, none under 72 points, past
which the page scrolls). Filling wins over squareness where the two pull
apart: an AM4 on an iPad upright is its four scenes two by two over its
four pedals in a row. A phone held upright is never asked.

**On a tablet, a new screen takes its sizes from the room.** "These
screens are not using the space very efficiently. Very small." (9
November 2026, iPad.) mobile/src/lib/tabletScale.js is the rule (a window
whose short side is 600 points or more; 1.2 at the line, 1.4 on the
12.9-inch iPad Pro; a centred column up to 840) and useRoom.js reads the
window; the walkthrough and the Unlock page use it (#836), through the
Press and Note wrappers in components/Roomy.js. Phones are untouched, and
test/tablet-room.mjs holds them so.

**A plugged-in USB cable is offered by name.** Report 8519c338 (9 November
2026): the FM3's line said its USB port cannot plug in and sent him to an
adapter, and the U2MIDI Pro straight into the iPad was reachable only
through Apple's Bluetooth screen. Since #837 the Bluetooth page draws Use
the USB cable, named after the cable, for any cable Connect is not using
(lib/bluetooth cablesToOffer, chooseCableHere), the FM3's step-1 line
names that button (lib/cableWords fm3CableLine), and the page listens for
a cable plugged in while it is open. The FM3's two silences on the cable
in that log had no app-side cause.

**The App Store header and search artwork** ("Control your Fractal from
your iPhone", on a real Play screen under stage lights) is rendered from
docs/store-art/stage.html by docs/store-art/render.js (Playwright; it
needs a clean Play screenshot at ../shots/play-scene2-clean.png, captured
from the live demo with the demo and Unlock pills hidden, never
committed). Nothing uploads it: Justin puts the files in App Store
Connect → Product Page Information → Header and Search Results himself.
"iPhone" keeps its casing inside the capitals; no price, "free", URL or
logo, ever.

**Every Amazon link carries his Associates tag, and says so.**

> "Replace all the links for the devices with these ... with your tag
> added" and "Put this line near 'What to buy': 'As an Amazon Associate I
> earn from qualifying purchases.'" (9 November 2026)

His Amazon Associates Store ID is justinnewbold, and the tag on a link is
`?tag=justinnewbold-20` (`AMAZON_TAG` in shared/bluetooth-gear.mjs); it
follows him, not the app's name. Every amazon.com link the app or the
website shows has it and nothing else on the end: the nine parts in
`PARTS` (the five he listed and the WIDI Master, the two WIDI Jacks and
the Master's adapters, on the same tag, since an untagged link beside
tagged ones only earns nothing), the Bluetooth guide and the Raspberry Pi
guide. Amazon's sentence, word for word (`AMAZON_DISCLOSURE`), is on
every page that has those links, once, at the bottom:

> "Just put this in one section at the bottom of the page- not next to
> every link" (10 November 2026)

So it is a line of its own in the footer of both guides and the last line
of the app's How to connect page, never under What to buy or beside a
link (where it sat for a day). A new Amazon link gets the tag, and a new
page with one gets the sentence at its foot; tests hold both. The next store version's review notes
must not repeat the old "plain amazon.com pages with no tracking" line
(docs/app-store.md keeps it in the past blocks, as submitted). His
Associates account still needs payment and tax details, three sales
within 180 days, and the app and the website on its list of sites; those
are his to do in Associates Central.

A bare `link.amazon/…` link from him is his own Associates short link for
a product he wants linked. It redirects to an amazon.com/dp/ address with
his tag; read the ten-character product number from there, find what it is
by search (Amazon's own pages do not open from a cloud session), and write
it the house way, `/dp/<number>?tag=justinnewbold-20`, never the short
link, which the tests would refuse. The first, on 10 November 2026, was
the Raspberry Pi guide's kit: the CanaKit Raspberry Pi 5 Essentials
Starter Kit, 4 GB (B0CVQTWGBX).

**Fractal Audio wrote on 18 October 2026, and the app does what it asked,
except the name.** Their letter on Approved Vendor status asked for a clear
statement at startup, no logos or product artwork, products named in plain
text only, and support through Justin's own channels, and for a new name
before vendor status goes ahead.

> "I wanna comply as much as I can. I'm just not gonna change the app name
> unless Fractal pushes back on it right now ... if they sent me like a cease
> and desist, I'd probably remove it then, but until then, I'm gonna keep the
> app name."

So the name stays "Fractal Remote" unless Fractal sends a formal demand. Do
not suggest renaming. Everything else is held, and is not to regress:

- **The sentence is fixed, word for word**, and lives in
  shared/affiliation.mjs: "Fractal Remote is independently developed and is
  not affiliated with, endorsed by, or supported by Fractal Audio Systems,
  LLC." "Supported by", never "sponsored by" in its place, and "LLC", never
  "Inc." (the one "Inc." left is inside the codec's own upstream NOTICE,
  carried as its author wrote it). Every copy (the website's pages, the store
  text, NOTICES, licences/MODIFICATIONS.md, the computer app's tray) is held
  to that file by a test.
- **It is shown at startup**: a card, "An independent app", once on every
  device under its own storage key (the phone's launch gate, and the
  browser and computer window over everything, with the rest of the page
  inert so the keyboard cannot reach Play under it), and the sentence
  under the spinner and "Finding your computer…". A new key if the words
  ever change enough to be shown again. One gap an update cannot close: a store build
  made before 18 October 2026 (1.87.1 or 1.87.11) runs the copy built into
  it on the first launch after a fresh install or a store update (see the
  Bluetooth gap above). After a fresh install that is the old first screen,
  FM3 photograph and all, with no card, once; after a store update, where
  the walkthrough was seen long ago, it is only no card on that one launch.
  The card comes from the next launch, once the update has downloaded. The
  next build pair closes it.
- **Never a Fractal logo, an official product photo, or artwork taken from
  Fractal's editors, manuals or website**, in the app, on the website, or in
  a screenshot, store video or feature graphic. Colour VALUES sampled from
  their editors are fine (the colours work did that); the image files they
  came from are never committed. Their own models' gear cards show words
  only. The private review videos for Apple are the one place a real unit is
  seen, and they are never made public.
- **Never call the app official, certified, approved or endorsed**, anywhere.
  If Approved Vendor status ever comes, it is forum participation only (the
  letter says it "does not constitute certification or endorsement"), and
  no badge or line presents it as more. And the letter is never "written
  permission" for the app: it says plain-text product names are fine, and it
  does not approve the name.
- **Help with the app is Justin's own channels only**: Settings →
  Troubleshooting → Feedback, the support page, his email. Nothing sends a
  player to Fractal for help with the app (their own downloads, for the
  unit's USB driver and firmware, are not help with the app).

## Things that cost real time to learn here

**A squash merge carries every commit message on the branch, and one
`[skip ci]` in them stops everything on main.** On 6 November 2026 four
merges (#800 to #803) went to main and nothing ran: no update to the
phones, no computer release. The work-in-progress saves were pushed with
`[skip ci]` so they would not email Justin a failure each, and because the
branch keeps its history with `merge -s ours`, those saves stay among the
pull request's commits; GitHub's squash message lists them all, and GitHub
skips every workflow for a push whose message holds `[skip ci]` anywhere.
So every squash merge passes its own `commit_title` and `commit_message`
(the pull request's title and a short summary), never GitHub's default
body. After a merge, check that main's runs started (the Actions list for
the merge commit is not empty); if one ever did not, `mobile.yml` run by
hand with `update` ticked publishes the phones' update without a build.

**Every change needs a new version number.** The `version` job in
`.github/workflows/web.yml` compares this branch's `package.json` against the
base branch and fails if they match. `desktop/package.json` has to move with
it — a test holds the two to each other.

**And every change a player would notice gets a line in What's new.**

> "Under the about menu can we make a change log that shows what each
> update change was made? Needs to be user friendly." (1 November 2026)

shared/whats-new.json is the list, newest day first: Settings → About →
What's new on the phone shows the newest `shownInApp` days (10), and the
website's public/whats-new.html, which the phone's All updates and the
browser's About row open, keeps every one. Both are rendered from the list
by `npm run sync:rules` (scripts/whats-new.mjs). So in the same pull
request: add the line under today's date (or a new day on top), in plain
words for a guitarist, and move that day's version to this one. Internal
work (tests, store bookkeeping, the Developer pages, anything only his
account has) gets no line. A line naming the iPhone, iPad, Apple Watch or
Siri is `only: 'ios'`, one naming Android is `only: 'android'`.
test/whats-new.mjs holds the rest. The browser imports only the page's
address (`WHATS_NEW_URL`), never the list, so a new line is never a new
computer release.

**But a new number is not a new computer app.**

> "Fewer, smaller computer updates … a new computer version only when its
> own part changed, small Mac updates, and the red line only when it really
> matters."

Every merge runs desktop.yml, and its `decide` job compares a fingerprint
of what is inside the computer app (scripts/computer-fingerprint.mjs:
desktop/, the ForgeFX pin, and the web app it serves, import by import, with
the version number taken out) with the record on the newest computer
release. The same, and no release is made. So the computer is usually a few
numbers behind the phone, and that is normal. To put one out anyway (for
what the fingerprint cannot see, such as the newer Electron 33.x that
desktop/ has no lock file to pin), it needs a number with no computer
release yet, because a computer only takes a higher one: merge a change
first (one that changes nothing inside the computer app makes no release
of its own), then tick Publish on a hand-started desktop run on main, or
push a desktop-v tag on that commit. A forced run whose version is already
out stops red in the release job; it used to go green and put nothing on
any computer.

**The red "Update the computer app" line means the phone needs it.**

> "The red line only shows when the phone really needs something the
> computer doesn't have yet."

It is measured against `COMPUTER_NEEDED` in shared/versions.mjs, never the
phone's own number. Raise it only in the change that gives a phone feature
something it cannot work without on the computer (a route, an answer, a
behaviour), to the version of the computer release that carries that
thing. Something the phone merely does better with (the AM4 tuner opening
on the unit) does not raise it. Raised above the newest computer release,
the next merge makes one even with nothing changed inside, so no computer
is told to update to a version that does not exist. A test holds it to
three numbers and to no higher than the app's own version; the comment
over it says what each version brought.

**CI runs Node 24, and the Mac app does not — yet.** The runners moved off
Node 20 in 7.334.0. What did NOT move is the Node the packaged Mac app runs
the device server on: that one comes from Electron (`desktop/main.js` spawns
`process.execPath` with `ELECTRON_RUN_AS_NODE`), so it is whatever the
pinned Electron bundles. Electron 33 carries Node 20.18; Node 24 first
appears in Electron 40.

The watching brief that used to live here is discharged. Both of its
triggers had fired — GitHub forces the build actions onto Node 24 now, and
eas-cli 24.6.0 refuses to install on Node 20 at all, which is why
`mobile.yml`'s build job went to 22 ahead of everything else.

The fear it was written around turned out to be smaller than it read. The
two compiled addons are `serialport` (`@serialport/bindings-cpp`) and
`@julusian/midi`, and BOTH declare N-API: `napi_versions` 8 and 7. N-API is
ABI-stable by design — it is the whole reason those packages publish it — so
a module built for one Node loads under another, and under Electron, without
being rebuilt. Node 24 offers N-API 10 and everything below it.

And half of what the note called unprovable is already automated.
`.github/workflows/desktop.yml` has a step, "The native modules load under
Electron", that loads both addons under Electron-as-Node on every desktop
build. A move that broke them goes red there, before it reaches his machine.
What that step still cannot answer is whether the app FINDS the FM3 — that
needs the unit plugged in, and that is the one part to ask him about.

So an Electron bump is an ordinary change with one hardware check at the end,
not a change to be avoided. Nothing forces it today: nothing is broken on
Electron 33.

**A test that a Node version can hide.** Two `test(...)` calls once sat
inside another test's body, so they registered while the queue was draining
rather than while the file was read — which put one of them past the point
`settle()` counts the score. The tally printed "808 passed" on a run whose
809th test had FAILED, and the count moved with the runtime (809 on Node 22,
808 on Node 20 and 24). `settle()` now re-awaits until the chain stops
growing, and a structural check fails on any `test(` registered inside
another test's callback. If the count ever disagrees with itself across two
Node versions again, that is the shape of the bug to look for.

**`test/structure.mjs` reads App.jsx as text, not as code.** It finds screens
by searching for the literal conditional that opens them and takes the first
hit — so writing that same conditional higher up the file, *including inside
a comment*, hands the test the wrong block. Both of those have happened. Give
the condition a name instead.

**Never write "this phone" into a sentence the app shows.**

> "The app pretty much always uses the word phone instead of device. This
> app will work on phones, iPads, tablets … a sound guy might just want to
> use another computer to be able to control things remotely."

Since 16 October 2026 the app names the device it is on:
`deviceNoun()` and its kin in shared/device-word.mjs (phone, iPad, tablet,
browser, or "phone or tablet" on the computer app). The phone app says which
device it is in mobile/src/lib/thisDevice.js, the first import in App.js, and
the website says it by its role in src/lib/link.js. So a new sentence about
the device in hand says `this ${deviceNoun()}`, and one on the computer about
the remote says "phone or tablet". A shared sentence that names it must be
read when it is shown (a getter or a function), because the website changes
role after its files load.

Left as they are on purpose: the Bluetooth note's "from an iPhone"
(where it was tried, not the device in hand), the Apple Watch words (a watch pairs only with an iPhone, and an
iPad is not offered one), the feature names "Phone remote" and the computer's
"Phone & computer" page, the paywall's "Phone Remote", log lines, and the VP4
sentences in shared/vp4-safety.mjs, which are the computer's own word for
word.

**Over Bluetooth, an answer can be the question's own bytes.** A customer's
FM3 log (13 November 2026) had "no answer to the blocks in 1500 ms" and
Play's "The unit did not answer in time." on one preset, twice, with
everything around it answered. "Which blocks?" is the status frame with
nothing in it, and a preset with no blocks answers with the same frame, so
the echo guard (bleWire, for MIDI Thru) dropped the unit's answer as the
phone's own message coming back. A question may now say what its own bytes
coming back mean (`opts.same`; only the blocks question does): taken at once
where nothing has echoed on that connection, on the second copy where
something has, and never from a unit that has answered nothing else. That
the customer's preset was empty is the reading that fits, not something the
log proves. The same log's "the unit refused the tuner page: the message
arrived damaged" was 64 12 00 after every open and close of an FM3's tuner
page, with every checksum right: it is written down as what it is now, not
as a refusal. And on an iPhone whose adapter has gone, the waiting screen
offers Look for the adapter again from the first try that misses it
(lib/bluetooth `useAdapterGone`), not after fifteen seconds.

**The adapter kept for a unit is not always the adapter it is on today.**
Justin, 14 November 2026: "For some reason I can't get the aX3 to connect
over Bluetooth, I restarted the Bluetooth device and I turned Bluetooth on
and off on my phone, and I forced close the app and restarted it." His log
said, again and again, "nothing at all has come back from WIDI Master
Bluetooth since it connected (0 bytes)". The phone kept the WIDI Master for
the Axe-Fx III from the day before; the Axe-Fx III was on the WIDI Uhost
that day, and the WIDI Master was powered and connected to the phone, on
nothing that answered. Six minutes later he reached the WIDI Uhost and the
unit answered in 47 ms. Nothing in the wire was wrong (checked both ways
against 1.90.48, the version it last worked on: the same bytes out, and
every byte in is counted before anything looks at it). What was wrong was
what the page offered:

- **Zero bytes on a connected adapter means "is this the right adapter?"
  as much as "check the plugs".** With Bluetooth on, Use a different
  adapter was drawn only when the adapter was gone; connected and silent,
  the way to another one was Stop first. Now it is drawn there too
  (screens/Bluetooth `silentAdapter`), saying "If WIDI Master Bluetooth
  isn't on your Axe-Fx III" (the adapter first: "If your Axe-Fx III isn't
  on" read as the unit being switched off), and on an iPhone another
  adapter connected to it is offered by name, unless it is kept for
  another unit: that one is in Use a different adapter's list, marked as
  that unit's (the list is only read; never a search on Android under a
  live connection). Never for a VP4, which never answers.
- **Use a different adapter never goes straight back to the one let go
  of.** Apple's screen closed with the WIDI Master still the only one
  connected, and the phone chose it again as "the only one here". The pick
  now leaves it in the list for a tap (bleAdapters `pickAdapter`
  `letGoOf`, lib/bluetooth `letGoOf`, in memory until an adapter is chosen
  or another unit picked; a USB cable chosen does not end it) and the page
  says how to get the other one and how to keep this one after all
  (`sameAdapterWords`; the note goes when another unit is picked). One he
  connects in Apple's screen himself is still taken, and "just connected"
  there means connected now and not before the screen, whatever its ids:
  CoreMIDI keeps the ids of an adapter it already knows, so "an id that is
  new" missed the commonest case (the review of this fix found it).
- **The log says why the phone chose nothing** (`whyNotPicked`): his first
  two Connects that day ended with an adapter listed and nothing chosen,
  and nothing said why (the page was on another unit, and the adapter was
  one kept for the Axe-Fx III).
- **A throw in the wire's send step is a failed send**, said in the log,
  and no longer leaves every later request waiting for ever (bleWire
  `pump`).
- **A new connection starts as a unit being asked** (bleLink `connected`,
  from the review of the above). The rig's "missing" or "silent" outlived
  the connection it was said of, so the page redrew "isn't answering" the
  moment another adapter came up, with the adapter just left offered in
  the button's place. It is taken back to "unknown" as the connection is
  announced; and if that connection's first read fails before it says
  anything, the old word goes back (`askedOver`), because the rig's own
  watch reads a unit whole again only when one called missing or silent
  starts answering. A unit that was answering keeps its word across a
  drop, so nothing flashes mid-song.
- **The way to another adapter is on Play too**: the note under the pill
  has Use a different adapter beside Connect again (which only reconnects
  to the same adapter), opening the Bluetooth page. After each restart
  that morning he landed on Play, not on that page.
- **The few seconds after Apple's screen** (`tookAfterScreen`) never take
  an adapter kept for another unit: with "just connected" meaning
  connected now and not before, one that only came online by itself would
  otherwise be moved to this unit with no tap.

On an iPhone "connected" means CoreMIDI took the port, and "sent" that it
took the bytes: neither says a byte left the phone or reached a unit. When
a report shows 0 bytes, ask which adapter is on the unit before anything
else.

**The phone and the browser share one relay allowlist.** `shared/relay-rules.mjs`
is the source; `mobile/src/lib/relay-rules.js` is generated from it by
`npm run sync:rules` and a test fails if it is stale. Never hand-edit the
generated copy.
