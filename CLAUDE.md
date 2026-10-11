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

A build is only ever needed because the fingerprint moved, and the two
platforms share almost everything that moves it — an iOS-only change (the
watch) still moved Android's. A build on one platform alone strands the
other: its testers keep a store copy that the next update no longer
matches, and nobody notices until they ask why nothing has changed. That
happened after the watch build, to the Play closed testers on 1.86.8.

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
is a build. Run it before pushing, and if a change would move it — a new
package, a plugin, an Expo package version — stop and tell him before
making it, in plain words, with what it costs (an iOS slot) and what it
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
purpose.

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

**Bluetooth (beta) is the developer's only, since 11 October 2026.**

> "Is there any way to just get the Bluetooth on the developers mode for my
> own phone? I just feel like it's not ready to have public."

The day before, it had gone out as a public beta in the 1.87.1 builds, which
went to TestFlight and to Google Play production on 10 October, never to the
App Store. The native module stays in those builds, with the iPhone's
Bluetooth permission text (a module that asks for Bluetooth without it gets
the build refused), and an update hides it from everybody but him:

- The Settings row and the page wait for `useBluetoothAllowed()` in
  mobile/src/lib/bluetooth.js: `isAdmin` of the account in the sign-in kept
  on the phone (`haveSession()`), never `currentAccount()`, which asks the
  server and would take his own Bluetooth away at a gig with no signal.
- App.js asks it at launch, before the link starts, and at every change of
  who is signed in. Anybody else found on Bluetooth goes back to the
  computer (`setBluetooth(false)`, unit and adapter kept), and
  `setBluetooth(true)` refuses them.
- No session on the phone is not a no. It is also what his own sign-in looks
  like when it ran out at a gig with no signal, so Bluetooth goes off for
  now in memory and stays on on the phone's storage, and the next launch that
  knows it is his starts on Bluetooth. Only another real account's id, or a
  sign-out somebody asked for (`allowBluetooth(null, { signedOut: true })`
  from Sign out, Delete account, the paywall and `toSignIn`), writes the off
  down.
- Nothing touches the phone's Bluetooth before Connect is tapped on the
  Bluetooth page, so nobody who is not shown that page is asked for the
  permission.
- One gap an update cannot close: a fresh install of the 1.87.1 builds runs
  the copy of the app built into it on its very first launch
  (`fallbackToCacheTimeout` is 0 in mobile/app.json), and that copy shows a
  BLUETOOTH (BETA) card under Settings → Phone & computer to any account
  with the full version, until its first update takes over on the next
  launch. Only a new build closes it, which is his call (one iOS and one
  Android build). So the App Store submission has to be a build made after
  11 October 2026, not build 26 (docs/app-store.md says so above the notes),
  and the privacy page and Google's App access note say the gap as it is.
- /bluetooth on the website says it isn't in the app and may be offered in
  a later version, with no promise and nothing to buy; the guide lives at
  bluetooth-guide.html, linked only from the app's own Bluetooth page.

**It is switched on for customers only in a new store version whose review
notes say so, never by an over-the-air update.** Apple's guideline 2.3.1(a)
bans hidden features and wants every new one described in the Notes for
Review, its licence (3.3.1(C)) keeps a change to what an app does for a
version it has reviewed, and Google forbids features activated remotely
after review. An update is exactly that: opening the gate on main would
reach every 1.87.1 phone with the reviewed notes still saying customers are
not shown it. So the day it is ready, the opening rides a build whose
fingerprint moved (then no update made for it can reach the older
binaries), with the review notes, What's New, the descriptions,
support.html and /bluetooth saying so, and the build is asked for like any
other.

## Things that cost real time to learn here

**Every change needs a new version number.** The `version` job in
`.github/workflows/web.yml` compares this branch's `package.json` against the
base branch and fails if they match. `desktop/package.json` has to move with
it — a test holds the two to each other.

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

**The phone and the browser share one relay allowlist.** `shared/relay-rules.mjs`
is the source; `mobile/src/lib/relay-rules.js` is generated from it by
`npm run sync:rules` and a test fails if it is stale. Never hand-edit the
generated copy.
