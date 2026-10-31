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
  note on the page says where it has been tried and points at Report a
  Bluetooth problem, and the store texts, the guide, the support, privacy
  and /bluetooth pages and the setup email say no beta either. (Edit (Beta)
  is another feature, and keeps its word.) Names in the code that say
  beta (`BETA_NOTE_*`, `betaNote`) and the ledger's "Bluetooth (beta) for
  customers" marker stay, as records, not words on a screen.
- **Every untried unit says so.** The AM4 and the FM3 have run it, from an
  iPhone and an Android phone (26 October 2026): the AM4 through the WIDI
  Uhost with the C2MIDI Pro, and through a WIDI Master; the FM3 through the
  WIDI Uhost with a CME U2MIDI Pro ("Using the U2midi pro adapter the FM3
  works and does not get hot"). The Axe-Fx III from an iPhone since 31
  October 2026, through an adapter nobody said ("had someone confirm that
  this works on the Axefx lll so that one has been tested"), so its ways
  still each say not tried. The FM9 and VP4 say "not tried
  yet" wherever an owner looks, each with the one-tap Report a Bluetooth
  problem by it (`untried` and its kin in shared/bluetooth-gear.mjs). Never
  a sentence that says it works on a unit it has not run on. The FM3's
  warning stays red and in front of it: the WIDI Master and the C2MIDI Pro
  got very hot on an FM3 and the WIDI Master did not work; use the U2MIDI Pro, which runs
  on USB power only, works and stays cool. The C2MIDI Pro and the WIDI
  Master are never offered for one.
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
  in the app from 1.89.0, the two ways with the computer first, what it
  does, the untried units, the FM3's warning, and a link to the guide
  (bluetooth-guide.html), which search engines may list now. support.html
  says the two ways, the computer first.
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

How it is presented, in his words: "make it clear that there's multiple ways
to connect the device, but also make it clear that the computer is the
preferred method and that Bluetooth will have more lag and not have as many
features." It is said in several wordings, each in one place:

- `BLUETOOTH_WAYS` in shared/bluetooth-gear.mjs, the full sentence: the
  Bluetooth page, the Phone & computer note while Bluetooth is on, and the
  purchase page through `BLUETOOTH_PAYWALL`, which also names the parts.
- `BLUETOOTH_WAYS_SHORT` (same file): the line under the waiting screen's
  "No computer? Use Bluetooth", the same for every account since
  every unit opened together.
- `BLUETOOTH_ROW_OFF` (same file): the Settings row, which has one line, so
  it says what it is for and the lag only.
- `NO_COMPUTER_BLUETOOTH` in shared/no-computer.mjs: the no-computer note on
  Phone & computer, and the Fixes page. Not on the waiting screen, which
  has its own button for it.
- `secondWay` in supabase/functions/setup-reminder/index.ts: the setup email.

A change to the wording changes all of them; a test holds the three full
wordings to the same three things (the computer best, more lag, fewer
features). Each is shown only where this copy offers Bluetooth, except the
purchase page, which shows its line only on a copy that opens Bluetooth to
customers (`openForCustomersHere()`), since somebody who has not paid is not
past the row's gate.

**Edit over Bluetooth: the AM4 and the FM3, his account until a store
version opens each.**

> "I have an FM3 and AM4 I can test on. But I wanna make it an easy switch
> if it works to be able to get it out to everyone"

Since 29 October 2026 Edit opens over Bluetooth on an AM4 and an FM3 for
his account (by update, on every copy): knobs, models and on/off, read and
written by the phone the way the computer app does it
(mobile/src/lib/am4-edit.js, mobile/src/lib/fm3-edit.js; the bytes and the
decoding checked against the pinned codec, and the FM3's against ForgeFX's
own gen-3 driver, run on the same answers). No saving, moving blocks,
modifiers or names over Bluetooth yet, and Edit says so; no cab picking on
an FM3 (that needs the computer's cab state). Never an FM9 or Axe-Fx III:
their catalogs are not carried.

- **The switch is one line**: `EDIT_FROM_STORE` in
  mobile/src/lib/ble-rule.js, one entry per unit whose knobs are built,
  null until a store version opens it. To get it out to everyone, set the
  unit to that store version on both phones in that build's pull request
  (`am4: { ios: '1.90.0', android: '1.90.0' }`), with the review notes and
  What's New saying editing works over Bluetooth on that unit. Never by an
  update: the listing and every copy's review notes say editing does not
  work over Bluetooth (the same rules as Bluetooth itself, below). The
  ledger holds it the same way: its row says "Editing over Bluetooth for
  customers", and `EDIT_OPENED_AT` in test/ledger.mjs pins it.
- **The catalogs are generated**, mobile/src/lib/am4-knobs.js and
  mobile/src/lib/fm3-knobs.js, by scripts/am4-knobs.mjs and
  scripts/fm3-knobs.mjs from forgefx-midi at the commit
  desktop/forgefx.lock.json pins (tests hold each to it). A new codec pin
  means running both scripts on it. The FM3's comes from the static FM3
  tables; the computer may lay a walk of the unit over them, the phone
  cannot.
- **Every frame of Edit's is held** before it goes (am4EditAllowed;
  gen3Sender with fm3EditAllowed): a read only of a block the unit has just
  said is in its preset, a write only to a setting the catalog names on such
  a block, within its range. AM4_ALLOWED stays as it was for everything
  else, and everything the FM3 was sent before Edit goes as it went. A
  request is Edit's only when it says so (device.js `EDITING`), so Play's
  own read of the amp, for its boost, stays refused over Bluetooth.
- **Each unit opens on its own entry** in `EDIT_FROM_STORE` (`am4`,
  `fm3`), so the AM4 can go out to everyone without the FM3, or the other
  way round.

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

**Every change needs a new version number.** The `version` job in
`.github/workflows/web.yml` compares this branch's `package.json` against the
base branch and fails if they match. `desktop/package.json` has to move with
it — a test holds the two to each other.

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

**The phone and the browser share one relay allowlist.** `shared/relay-rules.mjs`
is the source; `mobile/src/lib/relay-rules.js` is generated from it by
`npm run sync:rules` and a test fails if it is stale. Never hand-edit the
generated copy.
